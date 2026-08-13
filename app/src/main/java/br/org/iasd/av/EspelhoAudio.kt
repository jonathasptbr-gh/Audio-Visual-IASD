package br.org.iasd.av

import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.webkit.WebView
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject
import java.nio.ByteBuffer
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong

/**
 * O ÁUDIO DO ESPELHO — recebe PCM do WebView do espelho e entrega AAC ao fio.
 *
 * ## A observação que destrava tudo
 *
 * **O WebView do espelho JÁ É contexto seguro.** Ele carrega
 * `https://appassets.androidplatform.net/` (invariante 1 do projeto), logo
 * `AudioWorklet` — que é `[SecureContext]` — **existe lá dentro**, mesmo com o
 * cliente da rede em `http://`. Daí o princípio geral, que merece ficar
 * escrito: *tudo o que precisa de contexto seguro pode ser movido para DENTRO
 * do WebView; só o que obrigatoriamente roda no navegador do visitante fica
 * preso ao piso `http://`.*
 *
 * ```
 * <video> do stage ──createMediaElementSource()──┬─ GainNode(0) ─→ destination   (SALÃO MUDO)
 *                                                └─ AudioWorkletNode ─ GainNode(0) ─→ destination
 *                                                        │ postMessage(ArrayBuffer Int16, ~40 ms)
 *                                                        ↓ addWebMessageListener (androidx.webkit)
 *                                                   MediaCodec AAC-LC 96 kbps
 *                                                        ↓ [0x11] no mesmo fio
 *                                          2ª SourceBuffer da MESMA MediaSource
 * ```
 *
 * **Nada disto é `MediaProjection`.** O plano anterior capturava o áudio do app
 * com `AudioPlaybackCapture`, o que exigia diálogo de consentimento por sessão,
 * indicador de gravação de tela antes de projetar num culto — e, pior, o mesmo
 * documento mandava silenciar o espelho, de modo que capturaria silêncio. Aqui
 * o som some do salão pelo próprio ROTEAMENTO: criado o
 * `MediaElementAudioSourceNode`, o áudio do elemento passa a existir só dentro
 * do grafo. (`video.muted` **não** é o mecanismo: mutar o elemento zera também
 * a saída do nó de Web Audio.)
 *
 * ## O contrato com o lado web, e ele é de mão dupla
 *
 * O objeto injetado chama-se **`__avEspelhoAudio`** e aceita três formas:
 *
 * | o que o JS manda | o que acontece |
 * |---|---|
 * | `postMessage('{"sr":48000,"ch":2}')` | configura e liga o encoder; a resposta `{"ok":true}` volta pelo `onmessage` do próprio objeto |
 * | `postMessage(arrayBuffer)` | um bloco de PCM **Int16 little-endian intercalado** |
 * | `postMessage('{"fim":true}')` | solta o encoder (o operador fechou o áudio) |
 *
 * A ordem é à prova de falha e está desenhada assim de propósito: o espelho
 * nasce com `forceMuted: true` (silêncio garantido) e só chama
 * `stage.setForceMuted(false)` **depois** do `{"ok":true}`. Se qualquer passo
 * falhar, o espelho fica mudo, o cliente mostra *"esta tela está sem som"* e o
 * salão continua em silêncio. **Nunca o contrário.**
 *
 * ## Blocos de ~40 ms, e não um por quantum
 *
 * `WebViewCompat.WebMessageListener.onPostMessage` é anotado **`@UiThread`**, e
 * o `AudioWorklet` processa em quanta de 128 amostras (~2,7 ms a 48 kHz): um
 * `postMessage` por quantum seriam **~375 mensagens por segundo entregues na
 * main thread** do processo que hospeda o Controle *e* a `Presentation` na TV,
 * cada uma pagando JNI, alocação e GC. Acumulando ~40 ms no worklet e já
 * convertendo para Int16, são ~25 msg/s e metade dos bytes — e a conversão sai
 * da main thread de brinde. Este arquivo confia nisso, mas não depende: o que
 * chega é enfileirado e sai da main thread na linha seguinte.
 *
 * ## As duas exceções, nomeadas
 *
 *  - **O embed do YouTube.** É um iframe de outra origem; o Web Audio não
 *    alcança o áudio dele. Aquela cena vai muda para a rede, e o cliente diz
 *    isso por um quadro `0x30`.
 *  - **O microfone ao vivo.** Push-to-talk é `getUserMedia → MediaStreamSource
 *    → GainNode → destination`, um caminho **disjunto** do `<video>` — e é uma
 *    escolha, não um acidente: capturar o FIM do grafo mandaria o microfone do
 *    santuário em AAC para três navegadores desconhecidos, em HTTP claro.
 *
 * @param onQuadro para onde vão o `csd` (`0x10`) e os quadros AAC (`0x11`) —
 *   na prática, o `difundir` do [EspelhoServidor]. O servidor decide **a quem**
 *   entregar; áudio é estritamente por cliente.
 * @param registrar linha crua para o diário do espelho.
 */
class EspelhoAudio(
    private val onQuadro: (Quadro) -> Unit,
    private val registrar: (String) -> Unit = {},
) {

    private val main = Handler(Looper.getMainLooper())

    /**
     * A fila entre a main thread (que recebe) e a thread do encoder (que
     * trabalha). Limitada: um encoder travado não pode fazer a memória do
     * processo da projeção crescer sem teto.
     */
    private val fila = ArrayBlockingQueue<ByteArray>(FILA_BLOCOS)

    @Volatile private var codec: MediaCodec? = null
    @Volatile private var thread: Thread? = null
    @Volatile private var rodando = false
    @Volatile private var instalado = false

    @Volatile private var taxa = 0
    @Volatile private var canais = 0

    /**
     * Amostras (por canal) JÁ contabilizadas — inclusive as dos blocos
     * descartados, ver [aoReceberPcm]. É o eixo de tempo do áudio.
     *
     * `AtomicLong` porque tem DOIS escritores: a thread do encoder (o caminho
     * normal) e a main thread (quando a fila enche e o bloco é perdido). Um
     * `Long` volátil perderia um incremento na corrida, e o preço seria um
     * deslocamento permanente entre o áudio e o vídeo — pequeno, silencioso e
     * impossível de investigar depois.
     */
    private val amostras = AtomicLong(0)

    /**
     * Amostras (por canal) que o worklet JÁ NOS ENTREGOU — contadas na main
     * thread, no instante da entrega, e sem passar pela fila.
     *
     * Ele existe separado do [amostras] por um motivo que só aparece na segunda
     * leitura: [amostras] é o eixo de tempo (ele anda quando o bloco é
     * CONSUMIDO pelo encoder), e a fila entre os dois tem até
     * [FILA_BLOCOS] × ~40 ms de folga. Medir a deriva contra ele leria um
     * engasgo da main thread — os blocos empilhados esperando a vez — como
     * "o som parou de ser produzido", e a correção encheria de silêncio um
     * buraco que não existe: os blocos empilhados sairiam logo depois e
     * jogariam o som À FRENTE do vídeo, que é o único erro que este desenho não
     * tem como desfazer.
     *
     * A pergunta certa é "o worklet produziu tudo o que o relógio pedia?", e
     * quem a responde é este contador. Ver [derivaUs].
     */
    private val recebidas = AtomicLong(0)

    /** E as amostras MUDAS que nós mesmos inserimos, que também são tempo. */
    private val silenciadas = AtomicLong(0)

    @Volatile private var ancoraUs = 0L
    @Volatile private var ancorado = false

    /**
     * O RELÓGIO DE PAREDE no instante da âncora — a outra metade dela, e a peça
     * que faltava para o eixo do som ter como se conferir.
     *
     * `ancoraUs` diz ONDE o som entrou no eixo da sessão; este diz QUANDO. Com
     * os dois, "quanto tempo de som já foi produzido" (contagem de amostras)
     * pode ser comparado com "quanto tempo passou" (relógio) — e a diferença é
     * exatamente a defasagem contra o vídeo, que anda por relógio. Ver
     * [derivaUs] e [corrigirDeriva].
     *
     * `System.nanoTime()` porque é o MESMO `CLOCK_MONOTONIC` de onde saem os
     * carimbos da *input surface* do vídeo (`EspelhoCodec.carimbar`).
     * `elapsedRealtime()` conta o sono profundo e divergiria do eixo do vídeo
     * justamente no caso em que ninguém está olhando.
     */
    @Volatile private var ancoraRelogioUs = 0L

    /** Quantas vezes a deriva foi corrigida — por silêncio ou por salto. */
    @Volatile private var correcoes = 0L
    @Volatile private var saltos = 0L
    @Volatile private var silencioUs = 0L
    @Volatile private var piorDerivaUs = 0L
    @Volatile private var ultimoLogUs = 0L

    @Volatile private var csdEnviado = false
    @Volatile private var blocos = 0L
    @Volatile private var blocosDescartados = 0L
    @Volatile private var quadrosAac = 0L
    @Volatile private var marcoBlocos = 0L
    @Volatile private var blocosNaJanela = 0
    @Volatile private var blocosPorSegundo = 0

    val ativo: Boolean get() = rodando

    // ---------- instalação ----------

    /**
     * Abre o canal binário dentro do WebView do espelho.
     *
     * **Na MAIN THREAD**, como toda interação com um WebView — e chamado
     * ANTES de o `/display/` carregar, ou o objeto não existirá quando o script
     * do grafo de áudio for procurá-lo.
     *
     * **Precisa ser chamado de novo a cada remontagem do WebView** (morte do
     * renderer): o listener é por-instância, e a `MirrorPresentation` reconstrói
     * o WebView sozinha nesse caso.
     *
     * `allowedOriginRules` é a origem EXATA do app, nunca `"*"`: este WebView
     * hospeda a IFrame Player API do YouTube **por design**, e com o curinga um
     * script de terceiro ganharia um canal binário direto para o `MediaCodec`.
     * A documentação é explícita — *"avoid using the full wildcard unless
     * absolutely necessary"* —, e o `isMainFrame` do [onPostMessage] fecha a
     * outra metade: iframe nenhum fala por aqui.
     *
     * @return `false` quando a plataforma não entrega `ArrayBuffer` por este
     *   canal (WebView antigo). Falha segura: sem áudio na rede, e o salão
     *   segue em silêncio porque quem libera o `forceMuted` é a confirmação que
     *   nunca vai chegar.
     */
    fun instalar(web: WebView?): Boolean {
        val w = web ?: return false
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            registrar("audio: este WebView nao tem canal de mensagens — espelho sem som")
            return false
        }
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_ARRAY_BUFFER)) {
            registrar("audio: este WebView nao entrega ArrayBuffer — espelho sem som")
            return false
        }
        return try {
            WebViewCompat.addWebMessageListener(
                w,
                OBJETO_JS,
                setOf(WebViewFactory.ORIGIN),
                ouvinte,
            )
            instalado = true
            true
        } catch (e: Exception) {
            registrar("audio: nao foi possivel abrir o canal (${e.javaClass.simpleName})")
            Log.w(TAG, "addWebMessageListener falhou", e)
            false
        }
    }

    /** Fecha o canal e solta o encoder. Idempotente, e chamável de qualquer
     *  thread — a remoção do listener volta para a main sozinha. */
    fun soltar(web: WebView?) {
        pararEncoder()
        val w = web
        if (w != null && instalado) {
            val remover = Runnable {
                try {
                    WebViewCompat.removeWebMessageListener(w, OBJETO_JS)
                } catch (e: Exception) {
                    Log.w(TAG, "removeWebMessageListener falhou", e)
                }
            }
            if (Looper.myLooper() == Looper.getMainLooper()) remover.run() else main.post(remover)
        }
        instalado = false
    }

    /**
     * O diagnóstico, em JSON e sem uma frase — quem escreve
     * "áudio: contexto running · 24 blocos de PCM/s · AAC 96 kbps" é o
     * `controle.js`.
     *
     * **Blocos por segundo é o número que importa**, e é por isso que ele
     * existe: o modo de falha clássico deste desenho (um `AudioWorkletNode` sem
     * caminho até o `destination`) é zero áudio na rede, **sem exceção, sem log
     * e com o grafo aparentemente saudável**. Um contador que fica em zero é a
     * única coisa que denuncia isso.
     */
    fun paraJson(): JSONObject = JSONObject()
        .put("ligado", rodando)
        .put("taxa", taxa)
        .put("canais", canais)
        .put("blocosPorSegundo", blocosPorSegundo)
        .put("blocos", blocos)
        .put("descartados", blocosDescartados)
        .put("quadros", quadrosAac)
        .put("bitrate", BITRATE)
        // A DERIVA, e ela é o número que faltava no Registro inteiro.
        //
        // "o som ficou para trás" era a frase que a TELA escrevia, e do lado do
        // celular não havia UMA linha que a confirmasse ou a desmentisse — o
        // operador via `24 blocos de PCM/s` e `7424 quadros`, tudo saudável, e
        // uma tela muda. Estes quatro campos são a outra metade da frase.
        .put("derivaMs", derivaUs() / 1000)
        .put("piorDerivaMs", piorDerivaUs / 1000)
        .put("correcoes", correcoes)
        .put("saltos", saltos)
        .put("silencioMs", silencioUs / 1000)

    // ---------- o canal ----------

    private val ouvinte = object : WebViewCompat.WebMessageListener {
        override fun onPostMessage(
            view: WebView,
            message: WebMessageCompat,
            sourceOrigin: Uri,
            isMainFrame: Boolean,
            replyProxy: JavaScriptReplyProxy,
        ) {
            // DUAS GUARDAS, e nenhuma é redundante com o `allowedOriginRules`:
            // ele limita a ORIGEM, mas não distingue o documento do IFRAME dele
            // — e o iframe aqui é de terceiro por design (a IFrame Player API
            // do YouTube). Com `isMainFrame` falso, ninguém fala por este canal.
            if (!isMainFrame) return
            if (!daNossaOrigem(sourceOrigin)) return
            try {
                quandoChega(message, replyProxy)
            } catch (e: Exception) {
                Log.w(TAG, "mensagem de áudio ignorada", e)
            }
        }
    }

    private fun daNossaOrigem(origem: Uri?): Boolean =
        origem == null || origem.host == null || origem.host == WebViewFactory.ORIGIN_HOST

    /** Roda na MAIN THREAD (`@UiThread` do `onPostMessage`): tudo aqui é curto,
     *  e o trabalho de verdade acontece na thread do encoder. */
    private fun quandoChega(message: WebMessageCompat, replyProxy: JavaScriptReplyProxy) {
        if (message.type == WebMessageCompat.TYPE_ARRAY_BUFFER) {
            aoReceberPcm(message.arrayBuffer)
            return
        }
        val texto = message.data ?: return
        if (texto.length > TETO_TEXTO) return
        val json = try {
            JSONObject(texto)
        } catch (e: Exception) {
            return
        }
        if (json.optBoolean("fim", false)) {
            pararEncoder()
            return
        }
        val sr = json.optInt("sr", 0)
        val ch = json.optInt("ch", 0)
        val erro = ligarEncoder(sr, ch)
        val resposta = if (erro == null) {
            JSONObject().put("ok", true).put("sr", sr).put("ch", ch)
        } else {
            JSONObject().put("ok", false).put("erro", erro)
        }
        // A RESPOSTA É O QUE LIBERA O SOM DO SALÃO A SUMIR: só depois dela o
        // lado web chama `setForceMuted(false)`. Sem ela, o espelho fica mudo —
        // que é a falha segura.
        try {
            replyProxy.postMessage(resposta.toString())
        } catch (e: Exception) {
            Log.w(TAG, "não foi possível responder ao grafo de áudio", e)
        }
    }

    private fun aoReceberPcm(bytes: ByteArray) {
        if (!rodando) return
        if (bytes.isEmpty() || bytes.size > TETO_BLOCO) return
        contarBloco()
        // A ÂNCORA DO RELÓGIO NASCE AQUI, no primeiro bloco entregue — e não no
        // primeiro bloco CONSUMIDO: a fila fica entre os dois, e ancorar do
        // outro lado dela poria a folga da fila dentro da medida de deriva.
        if (ancoraRelogioUs == 0L) ancoraRelogioUs = relogioUs()
        val quadroPcm = 2 * canais
        if (quadroPcm > 0) recebidas.addAndGet((bytes.size / quadroPcm).toLong())
        if (fila.offer(bytes)) return
        // A FILA ENCHEU: o encoder não escoa. O bloco é perdido, mas as
        // amostras dele **contam** — o eixo de tempo do áudio é o tempo real, e
        // não a soma do que coube. Descontá-las empurraria todo o resto do
        // culto para trás, um buraco de cada vez, e o desencontro com o vídeo
        // só cresceria.
        blocosDescartados++
        val quadro = 2 * canais
        if (quadro > 0) amostras.addAndGet((bytes.size / quadro).toLong())
    }

    private fun contarBloco() {
        blocos++
        val agora = SystemClock.elapsedRealtime()
        if (marcoBlocos == 0L) marcoBlocos = agora
        blocosNaJanela++
        val decorrido = agora - marcoBlocos
        if (decorrido >= 1_000) {
            blocosPorSegundo = ((blocosNaJanela * 1000L) / decorrido).toInt()
            blocosNaJanela = 0
            marcoBlocos = agora
        }
    }

    // ---------- encoder ----------

    /** @return `null` quando ligou; a razão, em texto, quando não. */
    private fun ligarEncoder(sr: Int, ch: Int): String? {
        if (rodando) {
            // Reconfigurar no meio do caminho mudaria o eixo de tempo do áudio
            // sem avisar o cliente. O grafo é criado UMA vez, na abertura do
            // espelho (`createMediaElementSource` é porta de mão única), então
            // uma segunda configuração é sinal de recarga da página — e aí o
            // caminho certo é soltar e instalar de novo.
            if (sr != taxa || ch != canais) return "encoder ja ligado em $taxa Hz"
            // E CHEGAR AQUI É A PÁGINA TENDO RENASCIDO — reancore (v5.181).
            //
            // Este ramo devolvia "ok" sem tocar em nada, e o preço era uma
            // defesagem A/V **permanente**, do tamanho do buraco, que ACUMULA.
            //
            // Os dois eixos são de naturezas diferentes por desenho: o vídeo é
            // `brutoUs - baseUs` (relógio monotônico, anda sozinho) e o áudio é
            // `ancoraUs + amostras * 1e6 / taxa` (CONTAGEM DE AMOSTRAS, só anda
            // quando chega PCM). Numa remontagem do WebView do espelho — OOM do
            // renderer, `ERROR_RECLAIMED`, a Presentation recriada — o
            // `AudioWorklet` morre e por alguns segundos nenhum bloco chega. O
            // vídeo não para: o preto e o carregamento da página compõem, e os
            // carimbos vêm do relógio. A página volta, cai aqui, e daí em diante
            // **todo quadro AAC sai carimbado N segundos no passado**.
            //
            // Como a borda ao vivo do cliente é o MÍNIMO das duas faixas, a
            // projeção inteira passa a ser exibida N segundos atrás do vivo. Um
            // segundo buraco soma; cruzados os 3 s de `ATRASO_AUDIO_S`, o
            // cliente solta a faixa, remonta contra a MESMA defasagem, e ao
            // terceiro desiste: **muda pelo resto do culto, com a imagem
            // seguindo**.
            //
            // O KDoc de `ptsAgora` diz "nunca há reancoragem", e ele está certo
            // sobre o caso que descreve: reancorar NO MEIO do fluxo abre buraco
            // no `buffered`. Este não é aquele caso — aqui o fluxo já foi
            // interrompido pela morte do worklet, e o `fmp4.js` costura o salto
            // esticando a duração da amostra anterior (`dur = pts - anterior`,
            // sem teto), então o `buffered` continua sendo um intervalo só.
            //
            // E A FILA VAI JUNTO. O PCM que sobrou da página morta pertence ao
            // eixo velho: alimentá-lo depois da reancoragem carimbaria áudio de
            // antes do buraco com o tempo de depois dele.
            fila.clear()
            amostras.set(0)
            recebidas.set(0)
            silenciadas.set(0)
            ancoraRelogioUs = 0L
            ancorado = false
            registrar("audio: a pagina renasceu — eixo do som reancorado")
            return null
        }
        if (sr !in TAXAS_AAC) return "taxa de amostragem nao suportada: $sr"
        if (ch !in 1..2) return "numero de canais invalido: $ch"
        val c = try {
            val fmt = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, sr, ch).apply {
                setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
                setInteger(MediaFormat.KEY_BIT_RATE, BITRATE)
                setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, TETO_BLOCO)
            }
            MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC).apply {
                configure(fmt, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
                start()
            }
        } catch (e: Exception) {
            registrar("audio: encoder AAC nao subiu (${e.javaClass.simpleName})")
            Log.w(TAG, "encoder AAC não subiu", e)
            return "encoder AAC nao subiu"
        }
        taxa = sr
        canais = ch
        amostras.set(0)
        recebidas.set(0)
        silenciadas.set(0)
        ancoraRelogioUs = 0L
        ancorado = false
        correcoes = 0
        saltos = 0
        silencioUs = 0
        piorDerivaUs = 0
        csdEnviado = false
        quadrosAac = 0
        fila.clear()
        codec = c
        rodando = true
        thread = Thread({ laco(c) }, "av-espelho-aac").apply { isDaemon = true }
        thread?.start()
        registrar("audio: AAC-LC ${BITRATE / 1000} kbps, $sr Hz, $ch canal(is)")
        return null
    }

    private fun pararEncoder() {
        if (!rodando && codec == null) return
        rodando = false
        val t = thread
        thread = null
        try {
            t?.join(500)
        } catch (e: InterruptedException) {
            Thread.currentThread().interrupt()
        }
        val c = codec
        codec = null
        try {
            c?.stop()
        } catch (e: Exception) {
            // Um encoder em estado terminal recusa `stop`; o `release` abaixo é
            // o que de fato devolve o silício.
        }
        try {
            c?.release()
        } catch (e: Exception) {
            Log.w(TAG, "falhou soltando o encoder AAC", e)
        }
        fila.clear()
        taxa = 0
        canais = 0
        blocosPorSegundo = 0
        // A âncora do relógio morre com o encoder: a próxima sessão de som é
        // outra âncora, e uma sobrevivente daria uma deriva do tamanho do tempo
        // em que o espelho esteve desligado — que é o mesmo erro que o
        // `EspelhoDiag.novaSessao()` teve de consertar na v5.146.
        ancoraRelogioUs = 0L
    }

    /**
     * O laço do encoder, numa thread só dele.
     *
     * Alimenta e drena no mesmo giro: os dois lados do `MediaCodec` síncrono
     * dependem um do outro, e um laço que só alimentasse travaria assim que os
     * buffers de saída acabassem.
     */
    private fun laco(c: MediaCodec) {
        val info = MediaCodec.BufferInfo()
        while (rodando) {
            val bloco = try {
                fila.poll(50, TimeUnit.MILLISECONDS)
            } catch (e: InterruptedException) {
                break
            }
            // A CORREÇÃO VEM ANTES DO BLOCO, e só quando há bloco: ver
            // [corrigirDeriva]. Com o fio de PCM parado não se corrige nada —
            // quem responde por um som que não chega é o vigia do cliente.
            if (bloco != null) {
                corrigirDeriva(c)
                alimentar(c, bloco)
            }
            if (!drenar(c, info)) break
        }
    }

    /**
     * Alimenta o encoder com um bloco de PCM.
     *
     * **O QUE NÃO COUBE CONTA ASSIM MESMO**, e essa é a regra inteira desta
     * função — a mesma que [aoReceberPcm] já aplicava para a fila cheia, e que
     * aqui **faltava em cinco saídas**: encoder sem buffer de entrada depois de
     * [TENTATIVAS], `IllegalStateException` no `dequeue`, no `getInputBuffer` ou
     * no `queueInputBuffer`, e o buffer curto demais para um quadro de amostras.
     * Cada uma dessas saídas devolvia o resto do bloco ao nada **sem somar as
     * amostras dele**, e o eixo do som — que é contagem de amostras — recuava
     * permanentemente por esse tanto.
     *
     * Cada buraco EMPURRA todo o resto do culto para trás, e somados alguns a
     * borda do som fica mais de `ATRASO_AUDIO_S` (3 s) atrás da do vídeo: o
     * cliente solta a faixa com *"o som ficou para trás"*, remonta contra a
     * MESMA defasagem e ao terceiro desiste — **muda pelo resto do culto, com a
     * imagem seguindo**.
     *
     * O [corrigirDeriva] fecha esse buraco de qualquer jeito, e é justamente
     * por isso que a contagem daqui **não é redundante com ele**: a deriva é
     * medida contra o PCM RECEBIDO, então um bloco que se perde aqui dentro sem
     * ser contado é a única forma de defasagem que aquela medida **não
     * enxerga**.
     *
     * O `finally` é o que torna a regra estrutural em vez de disciplinar: uma
     * saída nova que alguém acrescente amanhã já nasce contando.
     */
    private fun alimentar(c: MediaCodec, bloco: ByteArray) {
        val quadro = 2 * canais
        if (quadro <= 0) return
        var off = 0
        var tentativas = 0
        try {
            while (off < bloco.size && rodando) {
                val idx = try {
                    c.dequeueInputBuffer(ESPERA_US)
                } catch (e: IllegalStateException) {
                    break
                }
                if (idx < 0) {
                    // Sem buffer de entrada agora: drena a saída (é o que os
                    // libera) e tenta de novo, com teto. Insistir para sempre
                    // seguraria a thread e a fila cresceria atrás.
                    val info = MediaCodec.BufferInfo()
                    if (!drenar(c, info)) break
                    if (++tentativas > TENTATIVAS) {
                        blocosDescartados++
                        break
                    }
                    continue
                }
                tentativas = 0
                val buf = entrada(c, idx) ?: break
                buf.clear()
                val cabe = minOf(buf.remaining(), bloco.size - off)
                // ALINHADO AO QUADRO DE AMOSTRAS: partir uma amostra de 16 bits
                // (ou um par estéreo) ao meio troca os canais do resto do bloco
                // e sai como estalo na caixa de som do templo.
                val n = cabe - (cabe % quadro)
                if (n <= 0) {
                    try {
                        c.queueInputBuffer(idx, 0, 0, ptsAgora(), 0)
                    } catch (e: IllegalStateException) {
                        // nada a fazer: o encoder saiu de estado
                    }
                    break
                }
                buf.put(bloco, off, n)
                try {
                    c.queueInputBuffer(idx, 0, n, ptsAgora(), 0)
                } catch (e: IllegalStateException) {
                    break
                }
                amostras.addAndGet((n / quadro).toLong())
                off += n
            }
        } finally {
            val resto = (bloco.size - off) / quadro
            if (resto > 0) amostras.addAndGet(resto.toLong())
        }
    }

    /** O buffer de entrada, ou `null` se o encoder saiu de estado. Existe como
     *  função para o `try` não se misturar com o elvis no ponto de uso. */
    private fun entrada(c: MediaCodec, idx: Int): ByteBuffer? = try {
        c.getInputBuffer(idx)
    } catch (e: IllegalStateException) {
        null
    }

    private fun saida(c: MediaCodec, idx: Int): ByteBuffer? = try {
        c.getOutputBuffer(idx)
    } catch (e: IllegalStateException) {
        null
    }

    /**
     * O PTS do próximo bloco, no MESMO eixo do vídeo.
     *
     * A âncora é `EspelhoCodec.ultimoCarimbo()` no instante do primeiro bloco —
     * e não um `System.nanoTime()`. O motivo é o mesmo que aquele arquivo já
     * escreve: os carimbos da *input surface* vêm do `BufferQueue`, e supor que
     * eles são o mesmo relógio lido noutro ponto do código é supor uma
     * igualdade que a plataforma não promete. Ancorar no último carimbo de
     * VÍDEO amarra as duas faixas ao mesmo eixo por construção, com o erro de
     * **um intervalo de quadro** — e esse número não é o dos 30 fps nominais
     * do encoder: numa cena PARADA quem produz quadro é só o batimento do
     * `display.js`, então o intervalo real é o dele.
     *
     * Isto já mordeu. Com o batimento em 1 Hz, ligar o áudio com uma estrofe
     * projetada ancorava com até **um segundo** de defasagem — permanente, já
     * que não há reancoragem — e a primeira rodada em aparelho relatou
     * exatamente "desincronia". A 8 Hz o pior caso cai para ~125 ms, na mesma
     * ordem da latência do próprio grafo de áudio, que é o que torna o erro
     * aceitável. **Quem mexer no batimento mexe nisto**: o teto de defasagem
     * do áudio é o intervalo do pulso, e não há aviso automático.
     *
     * Daí em diante o tempo anda por CONTAGEM DE AMOSTRAS, não por relógio: a
     * taxa do worklet é a do hardware de áudio, e é ela que manda.
     *
     * **A CONTAGEM DE AMOSTRAS É CONFERIDA CONTRA O RELÓGIO** (v5.184), e não
     * pode deixar de ser: ela é o eixo do som, o vídeo anda por relógio, e nada
     * fazia as duas coisas se olharem. Ver [corrigirDeriva] — o normal é
     * preencher o buraco com SILÊNCIO, que não é reancoragem nenhuma (o eixo
     * continua sendo contagem de amostras) e por isso não abre buraco no
     * `buffered`.
     *
     * **Reancoragem no meio do fluxo, essa, continua sendo a exceção**, e por
     * um motivo que segue valendo: um `tfdt` que salte para a frente com a
     * faixa CORRENDO abre buraco, e navegador para em buraco. Ela só acontece
     * onde o fluxo já foi interrompido de qualquer jeito — a página do espelho
     * tendo renascido (ver [ligarEncoder], v5.181) e a deriva acima de
     * [DERIVA_SALTO_US], que é o mesmo prazo em que o cliente já soltou a
     * faixa. Nos dois casos o `fmp4.js` costura o salto esticando a duração da
     * amostra anterior.
     */
    private fun ptsAgora(): Long {
        if (!ancorado) {
            ancoraUs = EspelhoCodec.ultimoCarimbo()
            ancorado = true
        }
        val t = taxa
        if (t <= 0) return ancoraUs
        return ancoraUs + amostras.get() * 1_000_000L / t
    }

    /** O `CLOCK_MONOTONIC`, em µs — o mesmo relógio dos carimbos do vídeo. */
    private fun relogioUs(): Long = System.nanoTime() / 1_000L

    /**
     * QUANTO O SOM ESTÁ ATRÁS DO VÍDEO, em microssegundos. Positivo = atrás.
     *
     * A conta é entre dois tempos DECORRIDOS desde a mesma âncora, e não entre
     * dois instantes absolutos — assim ela não depende de o eixo do vídeo e o do
     * som terem a mesma origem (eles não têm: a âncora é `ultimoCarimbo()`, que
     * pode estar até um intervalo de batimento no passado, e esse deslocamento
     * constante é erro conhecido e aceito desde a v5.144).
     *
     *  - decorrido do VÍDEO   = relógio de parede desde a âncora;
     *  - decorrido do SOM     = (amostras RECEBIDAS + silêncio inserido) ÷ taxa.
     *
     * **Recebidas, e não consumidas** — ver [recebidas]: entre a entrega e o
     * consumo existe uma fila, e lê-la como deriva mandaria encher de silêncio
     * um buraco que os blocos empilhados fechariam sozinhos meio segundo
     * depois. O eixo do PTS ([amostras]) contabiliza exatamente o mesmo total
     * assim que a fila drena, porque [alimentar] conta o que não coube — é essa
     * igualdade que faz medir de um lado e corrigir do outro ser correto.
     *
     * A diferença é a deriva, e ela tem três origens, todas reais e nenhuma
     * detectada até aqui:
     *
     *  1. **O `AudioWorklet` engasgando.** Os três WebViews dividem UM processo;
     *     uma rotatividade de decodificador rouba o fio que alimenta o worklet
     *     (é o defeito que a v5.177 descreve do outro lado). Enquanto ele não
     *     produz, o eixo do som PARA e o do vídeo segue andando.
     *  2. **O relógio do hardware de áudio.** Ele não é o relógio do sistema: as
     *     dezenas a centenas de ppm de diferença são décimos de segundo por
     *     hora, e um culto tem duas.
     *  3. **PCM perdido** (fila cheia, encoder sem buffer). Este o código já
     *     contabilizava — depois da correção do [alimentar].
     *
     * Nenhuma delas se recupera sozinha, e todas ACUMULAM.
     */
    private fun derivaUs(): Long {
        val t = taxa
        val marco = ancoraRelogioUs
        if (t <= 0 || marco == 0L) return 0L
        val doVideo = relogioUs() - marco
        val doSom = (recebidas.get() + silenciadas.get()) * 1_000_000L / t
        return doVideo - doSom
    }

    /**
     * FECHA O LAÇO: mede a deriva e a desfaz, antes de o bloco seguinte ser
     * carimbado.
     *
     * Até a v5.184 este laço era ABERTO — o eixo do som andava por contagem de
     * amostras e nada, em lugar nenhum, conferia essa contagem contra o relógio
     * que carimba o vídeo. A defasagem crescia em silêncio até a tela da rede
     * escrever *"o som ficou para trás"* e ficar muda pelo resto do culto, que é
     * exatamente o relato que abriu esta versão.
     *
     * **A correção normal é SILÊNCIO, não salto**, e a diferença importa:
     * inserir amostras mudas mantém a invariante deste arquivo intacta (o eixo
     * do som continua sendo contagem de amostras), não abre buraco nenhum no
     * `buffered` e não obriga o muxer a esticar amostra nenhuma. O que o
     * ouvinte percebe é o que de fato aconteceu — um trecho mudo do tamanho do
     * engasgo —, e depois dele o som volta ALINHADO em vez de voltar atrasado
     * para sempre.
     *
     * **O salto fica para a deriva grande**, e o limiar não é arbitrário: passado
     * o `AUDIO_MUDO_MS` do cliente (3 s), a tela JÁ soltou a faixa de som e vai
     * remontá-la — não há continuidade a preservar, e encher três segundos de
     * silêncio só atrasaria a volta. É a mesma reancoragem que a v5.182 já faz
     * quando a página do espelho renasce, pelo mesmo motivo: ali o fluxo também
     * já tinha sido interrompido.
     *
     * O `deadband` existe para a correção não virar um tique: a chegada dos
     * blocos tem jitter próprio (`postMessage` na main thread), e corrigir 20 ms
     * a cada bloco seria trocar uma deriva por um serrilhado.
     */
    private fun corrigirDeriva(c: MediaCodec) {
        val t = taxa
        val ch = canais
        if (t <= 0 || ch <= 0) return
        val deriva = derivaUs()
        if (deriva > piorDerivaUs) piorDerivaUs = deriva
        val plano = planoDeCorrecao(deriva)
        if (plano == 0L) return
        if (plano < 0L) {
            correcoes++
            // SALTO: o eixo do PTS recomeça no carimbo de vídeo de agora, e a
            // MEDIDA recomeça junto — as duas âncoras são a mesma decisão, e
            // deixar uma delas para trás faria a deriva já corrigida ser
            // corrigida de novo, para sempre.
            amostras.set(0)
            recebidas.set(0)
            silenciadas.set(0)
            ancoraRelogioUs = relogioUs()
            ancorado = false
            saltos++
            registrar("audio: o som ficou ${deriva / 1000} ms atras — eixo reancorado")
            return
        }
        val quadros = plano * t / 1_000_000L
        if (quadros <= 0L) return
        correcoes++
        // O SILÊNCIO CONTA ANTES DE SER ALIMENTADO, e não depois: `alimentar`
        // pode demorar (ele drena o encoder no caminho), e uma leitura de
        // [derivaUs] no meio disso veria a deriva ainda inteira e mandaria
        // encher de novo.
        silenciadas.addAndGet(quadros)
        // Um `ByteArray` nasce zerado, e zero é o silêncio do PCM Int16.
        alimentar(c, ByteArray((quadros * 2 * ch).toInt()))
        silencioUs += plano
        // Uma linha no diário, com freio: uma deriva grande é fechada em vários
        // passos de [TETO_SILENCIO_US], e uma linha por passo afogaria o anel
        // com a MESMA notícia. O número que interessa (o total) está no JSON.
        val agora = relogioUs()
        if (agora - ultimoLogUs >= LOG_CORRECAO_US) {
            ultimoLogUs = agora
            registrar("audio: ${deriva / 1000} ms de atraso preenchidos com silencio")
        }
    }

    /** @return `false` quando o encoder saiu de estado e o laço deve parar. */
    private fun drenar(c: MediaCodec, info: MediaCodec.BufferInfo): Boolean {
        while (true) {
            // `CodecException` PRIMEIRO: ela herda de `IllegalStateException`,
            // e na ordem inversa o segundo `catch` seria código morto.
            val idx = try {
                c.dequeueOutputBuffer(info, 0)
            } catch (e: MediaCodec.CodecException) {
                Log.w(TAG, "encoder AAC caiu", e)
                return false
            } catch (e: IllegalStateException) {
                return false
            }
            if (idx == MediaCodec.INFO_TRY_AGAIN_LATER) return true
            if (idx == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                csdDoFormato(c)
                continue
            }
            // INFO_OUTPUT_BUFFERS_CHANGED e qualquer outro negativo: ignorados
            // em silêncio, como manda a documentação do MediaCodec.
            if (idx < 0) continue
            val buf = saida(c, idx)
            if (buf != null && info.size > 0) {
                buf.position(info.offset)
                buf.limit(info.offset + info.size)
                val bytes = ByteArray(info.size)
                buf.get(bytes)
                if (info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0) {
                    enviarCsd(bytes)
                } else {
                    // Um quadro AAC é SEMPRE ponto de sincronismo — não existe
                    // "quadro AAC intermediário" —, e o cliente conta com isso
                    // para começar a tocar de onde entrou.
                    quadrosAac++
                    onQuadro(
                        Quadro(
                            tipo = EspelhoCodec.TIPO_AUDIO,
                            chave = true,
                            descontinuidade = false,
                            ptsUs = info.presentationTimeUs,
                            bytes = bytes,
                        ),
                    )
                }
            }
            try {
                c.releaseOutputBuffer(idx, false)
            } catch (e: IllegalStateException) {
                return false
            }
            if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) return false
        }
    }

    private fun csdDoFormato(c: MediaCodec) {
        val f = try {
            c.outputFormat
        } catch (e: Exception) {
            return
        }
        val b = f.getByteBuffer("csd-0")?.duplicate() ?: return
        val bytes = ByteArray(b.remaining())
        b.get(bytes)
        enviarCsd(bytes)
    }

    /**
     * O `AudioSpecificConfig` — dois bytes, e o `MediaCodec` os entrega prontos.
     *
     * É por isso que a segunda `SourceBuffer` custa ~10 linhas de JS no cliente
     * em vez das 150–200 de um `AudioWorklet` com ring buffer, relógio e
     * deriva: a sincronia A/V é do NAVEGADOR, uma `MediaSource`, uma linha do
     * tempo. Vai uma vez por sessão; um `csd` repetido não faz mal (o cliente o
     * ignora), mas um `csd` que nunca chega deixa a faixa de áudio sem
     * `esds` — e sem `esds` não há o que tocar.
     */
    private fun enviarCsd(bytes: ByteArray) {
        if (bytes.isEmpty() || csdEnviado) return
        csdEnviado = true
        onQuadro(
            Quadro(
                tipo = EspelhoCodec.TIPO_CSD_AUDIO,
                chave = true,
                descontinuidade = false,
                ptsUs = ptsAgora(),
                bytes = bytes,
            ),
        )
    }

    companion object {
        private const val TAG = "EspelhoAudio"

        /** O nome do objeto injetado no `window` do WebView do espelho. */
        const val OBJETO_JS = "__avEspelhoAudio"

        /** 96 kbps AAC-LC: ~8× menos banda que PCM cru pelo canal lateral, e
         *  transparente para voz e louvor num salão. */
        const val BITRATE = 96_000

        private const val FILA_BLOCOS = 64

        /** ~40 ms de estéreo a 48 kHz são 7,7 kB; 64 kB é teto de sanidade, não
         *  de operação — e existe para que uma mensagem gigante não vire uma
         *  alocação gigante na main thread. */
        private const val TETO_BLOCO = 64 * 1024

        private const val TETO_TEXTO = 512
        private const val ESPERA_US = 10_000L
        private const val TENTATIVAS = 50

        /**
         * A ZONA MORTA da correção de deriva. Abaixo dela não se mexe em nada.
         *
         * Ela precisa ser maior que o jitter de chegada dos blocos — que são
         * ~40 ms entregues por `postMessage` na main thread de um processo que
         * hospeda três WebViews —, senão a correção viraria um tique a cada
         * bloco. E ela precisa ser MUITO menor que os 3 s em que o cliente
         * desiste da faixa de som, porque o ponto inteiro é nunca chegar lá.
         */
        const val DERIVA_MIN_US = 250_000L

        /** Quanto silêncio se insere de uma vez. Uma deriva maior é fechada em
         *  passos: os blocos chegam a cada ~40 ms, então mesmo dois segundos de
         *  buraco somem em menos de meio segundo de relógio. */
        const val TETO_SILENCIO_US = 250_000L

        /**
         * A partir daqui não se preenche: reancora-se.
         *
         * Três segundos é o `AUDIO_MUDO_MS` do cliente — passado ele, a tela já
         * soltou a faixa de som e vai remontá-la, então não há continuidade a
         * preservar e encher o buraco de silêncio só atrasaria a volta. É a
         * mesma reancoragem da página que renasce (v5.182), pelo mesmo motivo.
         */
        const val DERIVA_SALTO_US = 3_000_000L

        /** Freio do diário: uma linha de correção a cada 5 s, no máximo. */
        private const val LOG_CORRECAO_US = 5_000_000L

        /**
         * O QUE FAZER COM UMA DERIVA — pura, e por isso com JUnit
         * (`EspelhoAudioTest`). O resto desta classe é `MediaCodec` e threads;
         * a REGRA é aritmética, e é ela que decide se o culto fica com som.
         *
         * @return `0` = nada a fazer · `-1` = reancorar (salto) · `> 0` = os
         *   microssegundos de silêncio a inserir agora.
         */
        fun planoDeCorrecao(derivaUs: Long): Long = when {
            derivaUs <= DERIVA_MIN_US -> 0L
            derivaUs >= DERIVA_SALTO_US -> -1L
            else -> minOf(derivaUs, TETO_SILENCIO_US)
        }

        /** As taxas que o AAC aceita. Um `AudioContext` de WebView entrega
         *  48000 (ou 44100 em alguns aparelhos); o resto está aqui para que um
         *  valor estranho vire uma RECUSA com texto em vez de um encoder que
         *  configura e não emite nada. */
        private val TAXAS_AAC = setOf(
            8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000, 64000, 88200, 96000,
        )
    }
}
