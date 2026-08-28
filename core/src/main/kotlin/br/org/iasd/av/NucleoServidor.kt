package br.org.iasd.av

import java.io.File
import java.io.OutputStream
import java.io.RandomAccessFile
import java.net.BindException
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * O SERVIDOR DE LOOPBACK DO NÚCLEO — o que serve a base web às janelas do
 * PRÓPRIO programa.
 *
 * ## Ele não é rede, e isso precisa estar dito
 *
 * O socket abre em `127.0.0.1` e **em nenhum outro endereço**: o que trafega
 * nele nunca sai da máquina — não passa por placa de rede, roteador nem
 * internet. O programa serve os próprios arquivos às próprias janelas.
 *
 * Isto não é uma invenção do desktop: é **exatamente o que o Android já faz**
 * com `https://appassets.androidplatform.net/`, que também não é um site — é o
 * app servindo a si mesmo através do `WebViewAssetLoader`.
 *
 * **E por que servir, em vez de abrir o arquivo direto?** Invariante 1: OPFS e
 * IndexedDB — onde mora o acervo inteiro — só existem em CONTEXTO SEGURO, e
 * `file://` não é um. `127.0.0.1` é *potentially trustworthy* por especificação.
 * Servir a si mesmo é o preço de ter biblioteca, não uma dependência de rede.
 *
 * ## A PORTA É A ORIGEM — e é por isso que ela não pode mudar
 *
 * `http://127.0.0.1:8420` e `:8421` são **origens diferentes**, com IndexedDB e
 * OPFS diferentes. O reflexo normal diante de uma porta ocupada — "pega outra
 * livre" — **apagaria a biblioteca do operador**: o Cronograma, o hinário, a
 * Bíblia e os vídeos ficariam órfãos num origin que ninguém mais abre, ocupando
 * disco, sem uma linha na tela dizendo o que houve.
 *
 * Daí [Recusa.PortaOcupada]: colisão é **falha alta com frase**, nunca uma
 * porta nova em silêncio. É a mesma disciplina que o `EspelhoPares` já aplica à
 * porta da transmissão, e pela mesma razão — só que ali o custo de errar é uma
 * tela que não conecta, e aqui é um acervo perdido.
 *
 * ## Este servidor e o da LAN são DOIS, de propósito
 *
 * Ver o KDoc de [NucleoRotas]: aqui `controle/` é servido (o operador está
 * nesta máquina), e no `EspelhoServidor` ele é recusado (a tela da rede recebe
 * o Display e mais nada). Um `if (ehLocal)` numa tabela só é a forma exata de
 * vazar o Controle para a rede da igreja no primeiro refactor distraído.
 */
class NucleoServidor(
    /** A raiz do bundle web em disco — o `web/` que viaja ao lado do programa. */
    private val raizWeb: File,
    /** A porta FIXA. Ver o KDoc: ela é a origem, e não se troca. */
    val porta: Int,
    /**
     * Quem responde `POST /ponte/call`. O núcleo não sabe o que é um método da
     * ponte; ele sabe entregar bytes e devolver bytes.
     *
     * A [sessao] é a janela que chamou — ver [NucleoRotas.sessaoValida]. Sem
     * ela o despacho não teria como endereçar a resposta nem como excluir o
     * emissor de um comando do barramento.
     */
    private val ponte: (sessao: String, corpo: ByteArray) -> ByteArray,
) {

    /** Por que o servidor não subiu — em frases que a casca mostra sem traduzir. */
    sealed class Recusa(val frase: String) {
        /**
         * A frase diz o que fazer, e **não** oferece a saída que estraga tudo.
         * "Escolher outra porta" é o que o operador tentaria sozinho, e é
         * justamente o que apagaria o acervo (ver o KDoc da classe).
         */
        object PortaOcupada : Recusa(
            "A porta do programa já está em uso. Feche a outra cópia do Áudio Visual " +
                "IASD e abra de novo. Não troque a porta: é ela que identifica a sua " +
                "biblioteca, e mudá-la faria o programa abrir vazio."
        )
        object SemBundle : Recusa(
            "Os arquivos do aplicativo não foram encontrados ao lado do programa. " +
                "Reinstale."
        )
        class Outra(motivo: String) : Recusa("O programa não conseguiu iniciar: $motivo")
    }

    private val vivo = AtomicBoolean(false)
    private var socket: ServerSocket? = null
    private val fila = Executors.newCachedThreadPool { r ->
        Thread(r, "nucleo-http").apply { isDaemon = true }
    }
    private val hosts = NucleoRotas.hostsAceitos(porta)

    /** Um fio SSE aberto — a janela [sessao] e o cano por onde se empurra. */
    private class Fio(val sessao: String, val saida: OutputStream)

    /** Os fios SSE abertos — um por janela (Controle e Telão). */
    private val fios = CopyOnWriteArrayList<Fio>()

    /**
     * Sobe o servidor. Devolve `null` em sucesso, ou a [Recusa] — **nunca uma
     * exceção para a casca tratar**: quem sabe o que dizer ao operador é este
     * arquivo, e a casca só desenha.
     */
    fun ligar(): Recusa? {
        if (!raizWeb.isDirectory || !File(raizWeb, "controle/index.html").isFile) {
            return Recusa.SemBundle
        }
        return try {
            // `InetAddress.getLoopbackAddress()` e NÃO `null`: o padrão do
            // `ServerSocket` é escutar em TODAS as interfaces, e isto é o
            // oposto do que este servidor é. A mesma regra que o
            // `EspelhoServidor` já segue ("bind explícito, nunca 0.0.0.0"), e
            // aqui ela é ainda mais estrita: nem a rede local entra.
            val s = ServerSocket(porta, 64, InetAddress.getLoopbackAddress())
            socket = s
            vivo.set(true)
            Thread({ aceitar(s) }, "nucleo-accept").apply { isDaemon = true }.start()
            null
        } catch (e: BindException) {
            Recusa.PortaOcupada
        } catch (e: Exception) {
            Recusa.Outra(e.message ?: e.javaClass.simpleName)
        }
    }

    fun desligar() {
        vivo.set(false)
        for (f in fios) try { f.saida.close() } catch (_: Exception) {}
        fios.clear()
        try { socket?.close() } catch (_: Exception) {}
        fila.shutdownNow()
    }

    /**
     * Empurra um evento pelos fios SSE — **endereçado**, sempre.
     *
     * [alvo] é a janela que recebe (`null` = todas) e [menos] é a que NÃO
     * recebe. Os dois casos existem e não são o mesmo:
     *
     *  - a resposta de uma chamada volta para UMA janela (`alvo`), como o
     *    `evaluateJavascript` do Android endereça um WebView;
     *  - um comando do barramento vai para todas MENOS o emissor (`menos`),
     *    como o `MessageBus` e como o `BroadcastChannel`, que não entrega ao
     *    próprio. Sem essa exclusão o `busPost` do Controle voltaria para o
     *    Controle — e o `__mid` do `db.js` não o pegaria, porque o emissor
     *    nunca viu o próprio mid.
     *
     * Fio que não aceita mais bytes é DESCARTADO na hora: a janela fechou, e
     * insistir nela travaria o empurrão para a que continua aberta.
     */
    fun empurrar(json: String, alvo: String? = null, menos: String? = null) {
        if (fios.isEmpty()) return
        // `data:` de UMA linha só. O quadro é JSON e o [NucleoPonte.aspas] já
        // escapou toda quebra de dentro das strings, então esta troca não
        // altera nada legítimo — ela existe para que um quadro montado à mão
        // por engano quebre o enquadramento SSE em vez de virar dois eventos.
        val bytes = emChunk("data: " + json.replace("\n", " ") + "\n\n")
        for (f in fios) {
            if (alvo != null && f.sessao != alvo) continue
            if (menos != null && f.sessao == menos) continue
            try { f.saida.write(bytes); f.saida.flush() } catch (_: Exception) { fios.remove(f) }
        }
    }

    /** Quantas janelas estão ouvindo. A casca a consulta para saber se o
     *  Telão de fato subiu — e o oráculo, para esperar pelo FATO. */
    fun janelasLigadas(): Int = fios.size

    private fun aceitar(s: ServerSocket) {
        while (vivo.get()) {
            val c = try { s.accept() } catch (_: Exception) { return }
            fila.execute { atender(c) }
        }
    }

    private fun atender(cliente: Socket) {
        var viraFio = false
        try {
            cliente.tcpNoDelay = true
            val entrada = cliente.getInputStream()
            val saida = cliente.getOutputStream()
            // `lerRequisicao` NÃO lança: ela devolve `Result`, e é assim que o
            // `EspelhoServidor` a usa. Um `try/catch` aqui compilaria e nunca
            // pegaria nada — a requisição malformada viraria uma exceção de
            // `getOrThrow` num lugar sem resposta HTTP.
            val lida = EspelhoHttp.lerRequisicao(entrada, hosts) { caminho ->
                // O TETO DO CORPO É POR ROTA, e o padrão de 256 B do
                // `EspelhoHttp` está certo para o que ele protege — um socket
                // de REDE. Deixá-lo valendo aqui daria 413 em cima do
                // `salvarTexto` (que carrega o Registro inteiro) e de metade
                // dos `nowPlaying`; e o `native.js` lê um erro de rede como
                // `null`, isto é, EM SILÊNCIO. Ver [NucleoPonte.TETO_CORPO].
                if (caminho == "/ponte/call") NucleoPonte.TETO_CORPO else EspelhoHttp.TETO_CORPO
            }
            val req = lida.getOrElse { e ->
                val erro = e as? EspelhoHttp.Erro ?: EspelhoHttp.Erro.Malformado
                saida.write(EspelhoHttp.respostaDeErro(erro)); saida.flush(); return
            }
            when (val rota = NucleoRotas.decidir(req.metodo, req.caminho)) {
                is NucleoRotas.Rota.Raiz -> {
                    saida.write(
                        EspelhoHttp.resposta(
                            302, "text/plain; charset=utf-8", ByteArray(0),
                            listOf("Location: /controle/"),
                        )
                    )
                }
                is NucleoRotas.Rota.PonteCall -> {
                    // SEM SESSÃO VÁLIDA NÃO HÁ CHAMADA, e a resposta é o 404
                    // uniforme — não um 400 explicando o que faltou. Quem tem
                    // sessão é uma janela que a casca criou; quem não tem está
                    // tateando, e a disciplina do espelho vale aqui: a
                    // resposta não distingue "não existe" de "você não pode".
                    val s = req.query["s"]
                    if (!NucleoRotas.sessaoValida(s)) { saida.write(EspelhoHttp.naoEncontrado()); return }
                    val corpo = try { ponte(s!!, req.corpo) } catch (e: Exception) {
                        ("{\"erro\":" + NucleoPonte.aspas(e.message ?: "falhou") + "}").toByteArray(Charsets.UTF_8)
                    }
                    saida.write(EspelhoHttp.resposta(200, "application/json; charset=utf-8", corpo))
                }
                // O SSE NÃO FECHA: ele fica aberto até a janela sumir, e é por
                // ele que o núcleo empurra. `viraFio` diz isso ao `finally`.
                is NucleoRotas.Rota.PonteEventos -> {
                    val s = req.query["s"]
                    if (!NucleoRotas.sessaoValida(s)) { saida.write(EspelhoHttp.naoEncontrado()); return }
                    viraFio = true; servirSse(s!!, saida); return
                }
                is NucleoRotas.Rota.Bundle -> servirArquivo(req, rota, saida)
                is NucleoRotas.Rota.Arquivo -> {
                    // O REGISTRO É A FRONTEIRA. Sem ele nenhum arquivo do
                    // disco do operador é alcançável por HTTP; com ele,
                    // exatamente os que ele escolheu no seletor. Token
                    // desconhecido, sessão errada e arquivo que sumiu do disco
                    // dão o MESMO 404 — a disciplina do espelho: a resposta
                    // não distingue "não existe" de "você não pode".
                    val f = NucleoArquivos.arquivoDe(rota.sessao, rota.token)
                    if (f == null) saida.write(EspelhoHttp.naoEncontrado())
                    else servirDoDisco(req, f, NucleoArquivos.tipoDe(f.name), saida)
                }
                is NucleoRotas.Rota.NaoAchei -> saida.write(EspelhoHttp.naoEncontrado())
            }
            saida.flush()
        } catch (_: Exception) {
            // Um cliente que desiste no meio é o caso NORMAL (a janela fechou,
            // o `<video>` cancelou uma faixa). Não é evento.
        } finally {
            if (!viraFio) try { cliente.close() } catch (_: Exception) {}
        }
    }

    private fun servirSse(sessao: String, saida: OutputStream) {
        saida.write(
            EspelhoHttp.cabecalhoChunked(
                200,
                "text/event-stream; charset=utf-8",
                listOf("Cache-Control: no-store", "X-Accel-Buffering: no"),
            )
        )
        // O comentário SSE inicial existe para o `fetch` do outro lado resolver
        // já: sem um byte, alguns clientes seguram a Promise da resposta.
        saida.write(emChunk(": oi\n\n"))
        saida.flush()
        fios.add(Fio(sessao, saida))
    }

    /**
     * O corpo de uma resposta `chunked` VAI EM CHUNKS.
     *
     * Escrever os bytes crus depois de anunciar `Transfer-Encoding: chunked` é
     * o defeito que não dá erro em lugar nenhum: o navegador lê o começo do
     * `data:` como o TAMANHO hexadecimal do bloco, não casa, e o fio morre —
     * ou pior, fica pendurado esperando um bloco que nunca fecha. O
     * `EspelhoHttp` já emite o enquadramento, e é dele que se usa.
     */
    private fun emChunk(texto: String): ByteArray {
        val b = texto.toByteArray(Charsets.UTF_8)
        return EspelhoHttp.chunk(b, 0, b.size)
    }

    /**
     * Serve um arquivo do bundle, com `Range` de verdade.
     *
     * Quem interpreta a faixa é o [EspelhoHttp.alcanceDe] — **o mesmo código,
     * com os mesmos 22 testes de JUnit**, que já serve as telas da rede. Aqui
     * está a inversão da invariante 8 outra vez: num `ServerSocket` quem aplica
     * a faixa somos NÓS, ao contrário do `shouldInterceptRequest` do WebView,
     * onde devolver a fatia aplicaria o deslocamento duas vezes. Copiar o
     * `StreamProxy` para cá seria o erro exato.
     */
    private fun servirArquivo(
        req: EspelhoHttp.Req,
        rota: NucleoRotas.Rota.Bundle,
        saida: OutputStream,
    ) {
        val alvo = File(raizWeb, rota.relativo)
        // CINTO E SUSPENSÓRIO sobre a guarda do [NucleoRotas]: o caminho
        // canônico tem de continuar DENTRO da raiz. A decisão de rota já
        // recusou `..` e `\`, mas um link simbólico dentro do bundle não é uma
        // string — e esta é a única conferência que o enxerga.
        //
        // Ela NÃO vale para a rota `/saf/`, e não poderia: lá o arquivo mora
        // fora da raiz de propósito, e quem autoriza é o registro (o operador
        // escolheu aquele arquivo no seletor), não o caminho.
        if (!alvo.isFile || !alvo.canonicalPath.startsWith(raizWeb.canonicalPath + File.separator)) {
            saida.write(EspelhoHttp.naoEncontrado()); return
        }
        servirDoDisco(req, alvo, rota.tipo, saida)
    }

    /** Serve um arquivo já autorizado, com `Range` de verdade. */
    private fun servirDoDisco(
        req: EspelhoHttp.Req,
        alvo: File,
        tipo: String,
        saida: OutputStream,
    ) {
        val tamanho = alvo.length()
        val extra = mutableListOf(
            "Accept-Ranges: bytes",
            // A base é servida do disco do próprio programa e muda quando o
            // programa é atualizado: não há por que um cache intermediário
            // existir, e havê-lo é o defeito do OTA por outro caminho (metade
            // de cada versão na mesma página).
            "Cache-Control: no-store",
        )
        when (val a = EspelhoHttp.alcanceDe(req.intervalo, tamanho)) {
            is EspelhoHttp.Alcance.Insatisfazivel -> {
                saida.write(
                    EspelhoHttp.resposta(
                        416, "text/plain; charset=utf-8", ByteArray(0),
                        listOf("Content-Range: bytes */$tamanho"),
                    )
                )
            }
            is EspelhoHttp.Alcance.Parcial -> {
                val f = a.faixa
                extra.add("Content-Range: bytes ${f.ini}-${f.fim}/$tamanho")
                escrever(saida, alvo, f.ini, f.bytes, 206, tipo, extra)
            }
            is EspelhoHttp.Alcance.Inteiro -> {
                escrever(saida, alvo, 0, tamanho, 200, tipo, extra)
            }
        }
    }

    private fun escrever(
        saida: OutputStream,
        alvo: File,
        ini: Long,
        bytes: Long,
        status: Int,
        tipo: String,
        extra: List<String>,
    ) {
        // O cabeçalho é montado à mão porque [EspelhoHttp.resposta] recebe o
        // corpo INTEIRO em memória, e um vídeo de 2 GB não cabe nela. O corpo
        // sai em blocos, direto do disco para o socket.
        val cab = StringBuilder()
        cab.append("HTTP/1.1 ").append(status).append(if (status == 206) " Partial Content" else " OK").append("\r\n")
        cab.append("Content-Type: ").append(tipo).append("\r\n")
        cab.append("Content-Length: ").append(bytes).append("\r\n")
        for (l in EspelhoHttp.CABECALHOS_SEMPRE) cab.append(l).append("\r\n")
        for (l in extra) cab.append(l).append("\r\n")
        cab.append("\r\n")
        saida.write(cab.toString().toByteArray(Charsets.US_ASCII))
        RandomAccessFile(alvo, "r").use { raf ->
            raf.seek(ini)
            val buf = ByteArray(64 * 1024)
            var falta = bytes
            while (falta > 0) {
                val lidos = raf.read(buf, 0, minOf(buf.size.toLong(), falta).toInt())
                if (lidos <= 0) break
                saida.write(buf, 0, lidos)
                falta -= lidos
            }
        }
    }

}
