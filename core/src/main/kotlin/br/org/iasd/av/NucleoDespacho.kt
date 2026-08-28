package br.org.iasd.av

import java.util.concurrent.ConcurrentHashMap

/**
 * O DESPACHO DA PONTE — quem responde o quê.
 *
 * Ele é o análogo do `NativeBridge` do Android, e a comparação diz o que ele
 * **não** é: lá cada método é uma função Kotlin com o corpo dentro do arquivo;
 * aqui há três destinos, e a escolha entre eles é o arquivo inteiro.
 *
 * | destino | o quê | por quê |
 * |---|---|---|
 * | o próprio núcleo | o barramento, e (nos lotes seguintes) YouTube, cifra e as telas da rede | é código Kotlin/Java que já existe e roda numa JVM |
 * | a CASCA, pelo cano de stdio | as folhas que só o sistema operacional responde: seletor de arquivo, monitores, volume, tema, cartão de mídia | não há como uma JVM sem janela abrir um diálogo do Windows |
 * | ninguém, ainda | o que um lote futuro traz | ver [naoImplementados] |
 *
 * ## O terceiro destino existe DE PROPÓSITO, e é o que evita o pior desfecho
 *
 * Um método que não esteja em tabela nenhuma resolveria `null` pelo prazo de
 * 60 s do `native.js` — o botão existe, é tocável, e depois de um minuto não
 * acontece nada. É o defeito que o `SHELL_VERSION` como PISO já produziu uma
 * vez neste projeto. Aqui ele resolve `null` **na hora** e entra numa lista
 * que o Registro imprime: a diferença entre "o programa travou" e "esta parte
 * ainda não existe nesta versão" é uma linha de diagnóstico.
 *
 * ## A INVARIANTE 9, aqui, é uma linha de tabela
 *
 * No Android a superfície privilegiada é negada por construção (`host = null`
 * no WebView do telão) mais uma guarda em cada método — e o `CLAUDE.md`
 * registra que **não há oráculo para ela**, porque afirmá-la exigiria montar
 * uma ponte de mentira com o papel `display`.
 *
 * Aqui o papel é selado na SESSÃO, que a casca registra quando cria a janela, e
 * a recusa acontece **no servidor**, antes de qualquer despacho. Isso a torna
 * testável com um `POST`: é o que o [NucleoDespachoTest] faz.
 */
class NucleoDespacho(
    /** Como empurrar um quadro. Separado da classe para o oráculo poder ouvir
     *  o que sai sem subir socket nenhum. */
    private val empurrar: (json: String, alvo: String?, menos: String?) -> Unit,
    /** O cano para a casca. Recebe um envelope [NucleoPonte.montar]. */
    private val paraCasca: (ByteArray) -> Unit,
    /** O endereço do próprio servidor (`http://127.0.0.1:8420`), para montar as
     *  URLs servíveis de `/saf/`. */
    private val base: String = "",
) {

    /**
     * OS CINCO PRIVILEGIADOS — a mesma lista da invariante 9.
     *
     * `espelhoLigarEm` entra junto porque é o mesmo método com um argumento a
     * mais (ver a regra de entrega: o argumento novo virou método próprio para
     * não encolher uma assinatura publicada). Deixá-lo de fora seria a porta
     * dos fundos exata do que a lista fecha — e ele é o pior dos seis: abre um
     * servidor na rede da igreja.
     */
    val PRIVILEGIADOS = setOf(
        "pickFolder", "listFolder", "pickDoc", "openExternal",
        "espelhoLigar", "espelhoLigarEm",
    )

    /**
     * O que só o SISTEMA OPERACIONAL sabe responder — as folhas de UI do
     * `BridgeHost`, e mais nada. Uma regra de culto aqui seria regra escrita na
     * casca, que é o que a invariante 5 proíbe.
     */
    val DA_CASCA = setOf(
        "pickFolder", "pickDoc", "salvarTexto",
        "displays", "openCast", "castTarget", "openExternal",
        "temaClaro", "systemVolume", "captureVolumeKeys", "projecaoLocal",
        "requestMic", "keepAlive", "bgProgress", "nowPlaying",
        "takeShare", "areaTransferencia",
    )

    /**
     * O ÚNICO MÉTODO QUE RESPONDE NO CORPO DA RESPOSTA HTTP.
     *
     * Toda a ponte é assíncrona por desenho — o recibo do `POST` é vazio e o
     * valor volta pelo SSE, como no Android ele volta por `evaluateJavascript`
     * e não pelo retorno do `@JavascriptInterface`. `deckExportUrl` é a
     * exceção porque o `native.js` o lê como String na hora, e mudá-lo para
     * Promise custaria um degrau de `SHELL_VERSION` **nas duas cascas**.
     *
     * A folha injetada o pede com uma requisição SÍNCRONA — o que o navegador
     * desaconselha é bloquear esperando a REDE, e aqui não há rede: é o mesmo
     * computador respondendo em microssegundos, uma vez, quando o operador
     * importa uma apresentação do Google.
     */
    private fun sincrono(c: NucleoPonte.Chamada): ByteArray? = when (c.metodo) {
        "deckExportUrl" -> {
            val u = NucleoApresentacao.urlDeExportacao(c.args.firstOrNull() ?: "") ?: ""
            ("{\"v\":" + NucleoPonte.aspas(u) + "}").toByteArray(Charsets.UTF_8)
        }
        else -> null
    }

    /** Os métodos que o NÚCLEO responde sozinho. Cresce a cada lote. */
    private val meus: Map<String, (String, NucleoPonte.Chamada) -> Unit> = mapOf(
        "busPost" to ::barramento,
        // `otaConfirm` é o watchdog do OTA da base web, e no computador não há
        // OTA: a base viaja DENTRO do programa e chega quando o programa
        // chega. Ele é aceito e ignorado — recusá-lo faria o `native.js` cair
        // no `catch` a cada abertura, sem que nada estivesse errado.
        "otaConfirm" to { _, _ -> },
        // `listFolder` é do NÚCLEO, não da casca, e a divisão não é arbitrária:
        // quem tem o sistema de arquivos E o registro de `/saf/` é ele. A casca
        // ESCOLHE a pasta (é ela que abre o diálogo); enumerar e cunhar as URLs
        // servíveis é trabalho de quem vai servi-las.
        "listFolder" to ::listarPasta,
    )

    private val papeis = ConcurrentHashMap<String, String>()

    /**
     * O que foi pedido e ainda não existe — em ordem de primeira vez, sem
     * repetição. É esta lista que a linha do Registro imprime.
     */
    private val faltando = java.util.Collections.synchronizedSet(LinkedHashSet<String>())

    fun naoImplementados(): List<String> = synchronized(faltando) { faltando.toList() }

    /** A casca registra a janela que acabou de criar, com o PAPEL dela. */
    fun registrarSessao(sessao: String, papel: String) {
        if (!NucleoRotas.sessaoValida(sessao)) return
        papeis[sessao] = papel
    }

    fun esquecerSessao(sessao: String) { papeis.remove(sessao) }

    fun papelDe(sessao: String): String = papeis[sessao] ?: ""

    /**
     * Responde `POST /ponte/call`. O corpo da resposta HTTP é só um recibo — o
     * VALOR volta pelo SSE, exatamente como no Android o valor volta por
     * `evaluateJavascript` e não pelo retorno do `@JavascriptInterface`.
     *
     * Manter essa forma não é fidelidade cerimonial: é o que faz o `native.js`
     * não mudar uma linha, e o `native.js` é o arquivo que as duas cascas
     * dividem.
     */
    fun chamada(sessao: String, corpo: ByteArray): ByteArray {
        val c = NucleoPonte.ler(corpo) ?: return RECIBO_MAU
        // A INVARIANTE 9, antes de tudo: uma sessão que não é `controle` não
        // alcança a superfície privilegiada. O desfecho é o INOFENSIVO — o
        // mesmo `null` que o Android devolve com `host == null` —, e não um
        // erro: quem chamou é a nossa própria base web num papel em que aquele
        // botão nem é desenhado, e um erro ali seria ruído sem ação.
        if (c.metodo in PRIVILEGIADOS && papeis[sessao] != "controle") {
            resolver(sessao, c.id, "null")
            return RECIBO_OK
        }
        sincrono(c)?.let { return it }
        val meu = meus[c.metodo]
        if (meu != null) { meu(sessao, c); return RECIBO_OK }
        if (c.metodo in DA_CASCA) {
            // A sessão viaja para a casca como PRIMEIRO argumento: é por ela
            // que a resposta acha o caminho de volta.
            paraCasca(NucleoPonte.montar(c.id, c.metodo, listOf(sessao) + c.args))
            return RECIBO_OK
        }
        // ANOTADO NA PRIMEIRA VEZ, e só nela. Sem um leitor, esta lista era
        // diagnóstico WRITE-ONLY: o KDoc prometia "uma linha de diagnóstico" e
        // não havia onde lê-la. O `stderr` do núcleo vai para o diário da
        // casca (`Nucleo.ErrorDataReceived`), que é onde se procura quando o
        // programa se comporta mal na igreja.
        if (faltando.add(c.metodo)) {
            System.err.println("[nucleo] método ainda sem dono: " + c.metodo)
        }
        resolver(sessao, c.id, "null")
        return RECIBO_OK
    }

    /**
     * Um envelope vindo da CASCA. São quatro, e nenhum deles é um método da
     * ponte: são o outro sentido do mesmo cano.
     */
    fun daCasca(corpo: ByteArray) {
        val c = NucleoPonte.ler(corpo) ?: return
        when (c.metodo) {
            // `resolver(sessao, id, valorJson)` — o valor JÁ EM JSON, montado
            // por quem sabe o que ele é. O núcleo não o interpreta.
            "resolver" -> if (c.args.size == 3) resolver(c.args[0], c.args[1], c.args[2])
            // `progresso(canal, sessao, id, a, b)`
            "progresso" -> if (c.args.size == 5) empurrar(
                NucleoPonte.quadroProgresso(
                    c.args[0], c.args[2],
                    c.args[3].toLongOrNull() ?: 0L, c.args[4].toLongOrNull() ?: 0L,
                ),
                c.args[1], null,
            )
            // A CASCA DEVOLVE CAMINHOS, NUNCA URLs. Quem cunha token é o
            // núcleo, porque é ele que vai servir os bytes — e porque o token
            // é ligado à SESSÃO (ver [NucleoArquivos]), que é o que impede o
            // Telão de alcançar o disco do operador.
            "resolverPasta" -> if (c.args.size == 3) {
                val f = java.io.File(c.args[2])
                resolver(c.args[0], c.args[1], if (f.isDirectory) NucleoArquivos.comoPasta(f) else "null")
            }
            "resolverArquivos" -> if (c.args.size >= 2) {
                val arquivos = c.args.drop(2).map { java.io.File(it) }
                resolver(c.args[0], c.args[1], NucleoArquivos.comoDocumentos(base, c.args[0], arquivos))
            }
            "sessao" -> if (c.args.size == 2) registrarSessao(c.args[0], c.args[1])
            "fechou" -> if (c.args.size == 1) {
                esquecerSessao(c.args[0])
                // A janela fechou: os tokens dela vão junto. Sem isto, uma
                // sessão de dias acumularia uma entrada por arquivo de toda
                // pasta re-sincronizada.
                NucleoArquivos.esquecer(c.args[0])
            }
        }
    }

    /**
     * `listFolder(uri)` — o conteúdo de uma pasta que o operador já concedeu.
     *
     * **Só o Controle**, pela guarda de [PRIVILEGIADOS] lá em cima: sem ela,
     * qualquer script no documento do Telão leria o índice inteiro (nome,
     * tamanho e token servível) de toda pasta concedida. Era a exceção do
     * Android — `listFolder` honra a mesma regra por ler o `ContentResolver`
     * direto —, e aqui é a mesma coisa por ler o disco direto.
     */
    private fun listarPasta(sessao: String, c: NucleoPonte.Chamada) {
        val caminho = c.args.firstOrNull()
        if (caminho.isNullOrBlank()) { resolver(sessao, c.id, "[]"); return }
        val pasta = java.io.File(caminho)
        // Lista VAZIA e não erro: é o que o `native.js` já trata, e é o que o
        // `controle.js` lê como "a pasta sumiu do aparelho" — que é a verdade.
        if (!pasta.isDirectory) { resolver(sessao, c.id, "[]"); return }
        resolver(sessao, c.id, NucleoArquivos.listarPasta(base, sessao, pasta))
    }

    private fun resolver(sessao: String, id: String, valorJson: String) {
        empurrar(NucleoPonte.quadroResolve(id, valorJson), sessao, null)
    }

    /**
     * O relay do barramento — o papel do `MessageBus` no Android.
     *
     * O comando vai para todas as janelas MENOS a que o emitiu. A exclusão não
     * é economia: o `BroadcastChannel` não entrega ao próprio emissor, e o
     * `__mid` do `db.js` só conhece os mids RECEBIDOS — um eco chegaria como
     * mensagem nova e o Controle passaria a processar os próprios comandos.
     *
     * O JSON atravessa VERBATIM. O núcleo não lê comando: quem lê é o
     * `display.js`, e quem filtra o que SOBE de uma tela da rede é o dreno do
     * `espelho/tela.js` — nenhum dos dois mora aqui.
     */
    private fun barramento(sessao: String, c: NucleoPonte.Chamada) {
        val json = c.args.firstOrNull() ?: return
        empurrar(NucleoPonte.quadroBus(json), null, sessao)
    }

    companion object {
        private val RECIBO_OK = "{}".toByteArray(Charsets.US_ASCII)
        /** Envelope ilegível. O recibo diz isso ao console da página — e não
         *  resolve promessa nenhuma, porque não há id de onde tirá-la. */
        private val RECIBO_MAU = "{\"erro\":\"envelope\"}".toByteArray(Charsets.US_ASCII)
    }
}
