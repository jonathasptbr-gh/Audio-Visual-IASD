package br.org.iasd.av

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.File
import java.net.InetAddress
import java.net.Socket

/**
 * O SERVIDOR DE LOOPBACK, DE PONTA A PONTA — com socket de verdade.
 *
 * Ele cabe num teste de unidade porque o servidor **é** local por construção:
 * não há rede a simular, não há aparelho, não há navegador. É o mesmo motivo
 * pelo qual o `EspelhoHttpTest` existe — só que aqui o alvo é a soma das peças,
 * não a gramática de uma delas.
 *
 * A asserção que carrega o arquivo é [portaOcupadaRecusaEmVezDeEscolherOutra].
 */
class NucleoServidorTest {

    private lateinit var raiz: File
    private var srv: NucleoServidor? = null
    private var outro: NucleoServidor? = null

    /** Uma porta que está livre AGORA. O teste não pode cravar um número — a
     *  máquina do CI não é a nossa —, mas o SERVIDOR crava, e é isso que a
     *  asserção da porta ocupada mede. */
    private fun portaLivre(): Int =
        java.net.ServerSocket(0, 1, InetAddress.getLoopbackAddress()).use { it.localPort }

    @Before
    fun montar() {
        raiz = File.createTempFile("nucleo", "").let { it.delete(); it.mkdirs(); it }
        File(raiz, "controle").mkdirs()
        File(raiz, "shared").mkdirs()
        File(raiz, "controle/index.html").writeText("<!doctype html><title>Controle</title>")
        File(raiz, "shared/db.js").writeText("0123456789")
        File(raiz, "version.json").writeText("{\"version\":\"1.4.4\"}")
        File(raiz, "segredo.txt").writeText("nao deve sair")
    }

    @After
    fun desmontar() {
        srv?.desligar(); outro?.desligar()
        raiz.deleteRecursively()
    }

    private fun sobe(
        porta: Int = portaLivre(),
        ponte: (String, ByteArray) -> ByteArray = { _, _ -> "{}".toByteArray() },
    ): NucleoServidor {
        val s = NucleoServidor(raiz, porta, ponte)
        assertNull("o servidor devia subir", s.ligar())
        srv = s
        return s
    }

    /** Uma requisição crua, e a resposta crua. Nada de cliente HTTP: o que se
     *  mede aqui é o que vai no fio. */
    private fun pedir(porta: Int, cru: String, host: String? = null, limite: Int = 64 * 1024): String {
        val h = host ?: "127.0.0.1:$porta"
        val texto = cru.replace("{HOST}", h)
        Socket(InetAddress.getLoopbackAddress(), porta).use { c ->
            c.soTimeout = 5000
            c.getOutputStream().write(texto.toByteArray(Charsets.UTF_8))
            c.getOutputStream().flush()
            val buf = ByteArray(limite)
            var n = 0
            try {
                while (n < limite) {
                    val l = c.getInputStream().read(buf, n, limite - n)
                    if (l <= 0) break
                    n += l
                }
            } catch (_: Exception) { /* o servidor fechou: é o fim da resposta */ }
            return String(buf, 0, n, Charsets.UTF_8)
        }
    }

    private fun get(porta: Int, caminho: String, extra: String = "", host: String? = null) =
        pedir(porta, "GET $caminho HTTP/1.1\r\nHost: {HOST}\r\n$extra\r\n", host)

    // ---------- O BÁSICO ----------

    @Test
    fun serveOControle() {
        val s = sobe()
        val r = get(s.porta, "/controle/")
        assertTrue(r, r.startsWith("HTTP/1.1 200 "))
        assertTrue(r, r.contains("Content-Type: text/html; charset=utf-8"))
        assertTrue(r, r.contains("<title>Controle</title>"))
    }

    @Test
    fun aRaizDesviaParaOControle() {
        val s = sobe()
        val r = get(s.porta, "/")
        assertTrue(r, r.startsWith("HTTP/1.1 302 "))
        assertTrue(r, r.contains("Location: /controle/"))
    }

    /**
     * **O socket não sai da máquina.** A asserção não é sobre uma resposta: é
     * sobre o ENDEREÇO em que o servidor escuta. Um `ServerSocket` construído
     * sem endereço escuta em TODAS as interfaces, e nesse dia o Controle da
     * igreja passa a estar num endereço que qualquer um da Wi-Fi alcança.
     */
    @Test
    fun escutaSoNoLoopback() {
        val s = sobe()
        val naoLocais = java.net.NetworkInterface.getNetworkInterfaces().toList()
            .flatMap { it.inetAddresses.toList() }
            .filter { !it.isLoopbackAddress && it is java.net.Inet4Address }
        for (ip in naoLocais) {
            var recusou = false
            try {
                Socket().use { it.connect(java.net.InetSocketAddress(ip, s.porta), 400) }
            } catch (_: Exception) { recusou = true }
            assertTrue("o servidor respondeu em $ip — devia escutar SÓ no loopback", recusou)
        }
    }

    // ---------- A PORTA É A ORIGEM ----------

    /**
     * A ASSERÇÃO QUE CARREGA O ARQUIVO.
     *
     * O reflexo normal diante de uma porta ocupada é pegar outra livre. Aqui
     * isso **apagaria a biblioteca do operador**: a origem de uma página inclui
     * a PORTA, então `:8420` e `:8421` têm IndexedDB e OPFS diferentes — o
     * Cronograma, o hinário, a Bíblia e os vídeos ficariam órfãos num endereço
     * que ninguém mais abre, ocupando disco, sem nada na tela dizendo o que
     * houve.
     *
     * O teste afirma as DUAS metades: que a segunda instância **recusa**, e que
     * a frase da recusa **não manda trocar a porta** — porque é isso que o
     * operador tentaria sozinho.
     */
    @Test
    fun portaOcupadaRecusaEmVezDeEscolherOutra() {
        val s = sobe()
        val segunda = NucleoServidor(raiz, s.porta) { _, _ -> "{}".toByteArray() }
        val recusa = segunda.ligar()
        outro = segunda
        assertNotNull("a segunda instância NÃO podia subir na mesma porta", recusa)
        assertTrue(recusa is NucleoServidor.Recusa.PortaOcupada)
        val frase = recusa!!.frase.lowercase()
        assertTrue("a frase precisa dizer o que fazer", frase.contains("feche"))
        assertTrue(
            "a frase NÃO pode sugerir trocar a porta — é isso que apaga o acervo",
            frase.contains("não troque a porta")
        )
    }

    @Test
    fun semBundleRecusaComFrasePropria() {
        val vazia = File.createTempFile("vazio", "").let { it.delete(); it.mkdirs(); it }
        val s = NucleoServidor(vazia, portaLivre()) { _, _ -> ByteArray(0) }
        val r = s.ligar()
        outro = s
        assertTrue(r is NucleoServidor.Recusa.SemBundle)
        vazia.deleteRecursively()
    }

    // ---------- TRAVESSIA E ALLOWLIST ----------

    /**
     * A ASSERÇÃO É A PROPRIEDADE — *o disco do operador não sai* —, **nunca o
     * código de status**, e essa distinção foi MEDIDA ao escrever o teste.
     *
     * A defesa é DUPLA, e cada camada responde diferente: `/shared/../x` é
     * recusado pelo próprio [EspelhoHttp] com **400** (ele endurece a
     * requisição antes de qualquer rota existir), e `/segredo.txt` chega
     * inteiro ao [NucleoRotas], que responde **404** porque a raiz é fechada.
     * As duas recusas estão certas.
     *
     * Um teste escrito contra "404" reprovaria a versão com a defesa mais
     * forte — e o reflexo diante dele seria AFROUXAR a camada de baixo para
     * fazer o teste passar. É assim que uma suíte ensina a piorar o código.
     */
    @Test
    fun travessiaNaoServeODiscoDoOperador() {
        val s = sobe()
        for (c in listOf("/shared/../segredo.txt", "/shared/..%2Fsegredo.txt", "/segredo.txt",
                         "/shared/..\\segredo.txt", "/./segredo.txt")) {
            val r = get(s.porta, c)
            assertTrue("$c foi ATENDIDO: $r", !r.startsWith("HTTP/1.1 200 "))
            assertTrue("$c vazou o conteúdo", !r.contains("nao deve sair"))
        }
        // O PAR: um arquivo legítimo do bundle continua saindo. Uma guarda que
        // recusa tudo passaria em todas as linhas acima.
        assertTrue(get(s.porta, "/shared/db.js").contains("0123456789"))
    }

    /**
     * DNS REBINDING. Um site faz um nome apontar para 127.0.0.1 e passa a falar
     * com o núcleo pelo navegador do operador — e este servidor expõe a ponte
     * inteira. O `Host` é a única coisa que distingue as duas requisições.
     */
    @Test
    fun hostForaDaAllowlistNaoEAtendido() {
        val s = sobe()
        for (h in listOf("evil.com", "localhost:1", "127.0.0.1", "localhost:${s.porta}.evil.com")) {
            val r = get(s.porta, "/controle/", host = h)
            assertTrue("Host $h foi aceito: $r", !r.contains("<title>Controle</title>"))
        }
        // O PAR: os dois nomes legítimos passam.
        assertTrue(get(s.porta, "/controle/", host = "127.0.0.1:${s.porta}").contains("<title>"))
        assertTrue(get(s.porta, "/controle/", host = "localhost:${s.porta}").contains("<title>"))
    }

    // ---------- RANGE ----------

    /**
     * O `Range` é o do [EspelhoHttp.alcanceDe] — o MESMO código, com os mesmos
     * 22 testes, que já serve as telas da rede. Aqui se afirma só a LIGAÇÃO:
     * que o servidor de fato o consulta e escreve a fatia certa.
     */
    @Test
    fun rangeServeAFatiaCerta() {
        val s = sobe()
        val r = get(s.porta, "/shared/db.js", "Range: bytes=2-5\r\n")
        assertTrue(r, r.startsWith("HTTP/1.1 206 "))
        assertTrue(r, r.contains("Content-Range: bytes 2-5/10"))
        assertTrue(r, r.contains("Content-Length: 4"))
        assertTrue(r, r.endsWith("2345"))
    }

    @Test
    fun rangeForaDoArquivoE416() {
        val s = sobe()
        val r = get(s.porta, "/shared/db.js", "Range: bytes=99-200\r\n")
        assertTrue(r, r.startsWith("HTTP/1.1 416 "))
        assertTrue(r, r.contains("Content-Range: bytes */10"))
    }

    @Test
    fun semRangeVemInteiro() {
        val s = sobe()
        val r = get(s.porta, "/shared/db.js")
        assertTrue(r, r.startsWith("HTTP/1.1 200 "))
        assertTrue(r, r.contains("Accept-Ranges: bytes"))
        assertTrue(r, r.endsWith("0123456789"))
    }

    // ---------- A PONTE ----------

    /** Uma sessão de janela válida — ver [NucleoRotas.sessaoValida]. */
    private val SESSAO = "janela-controle-1"

    @Test
    fun aPonteRecebeOCorpoEDevolveODela() {
        var visto: String? = null
        var quem: String? = null
        val s = sobe(ponte = { sessao, corpo ->
            quem = sessao
            visto = String(corpo, Charsets.UTF_8)
            "{\"ok\":1}".toByteArray(Charsets.UTF_8)
        })
        val corpo = "AV1\na:1\nrole\n0\n"
        val r = pedir(
            s.porta,
            "POST /ponte/call?s=$SESSAO HTTP/1.1\r\nHost: {HOST}\r\n" +
                "Content-Type: application/octet-stream\r\nContent-Length: ${corpo.length}\r\n\r\n$corpo",
        )
        assertEquals(corpo, visto)
        assertEquals("a sessão da query chega ao despacho", SESSAO, quem)
        assertTrue(r, r.startsWith("HTTP/1.1 200 "))
        assertTrue(r, r.contains("{\"ok\":1}"))
    }

    /**
     * SEM SESSÃO NÃO HÁ CHAMADA — e a recusa é o 404 uniforme, não um 400 que
     * explique o que faltou. É a disciplina do espelho: a resposta não
     * distingue "não existe" de "você não pode".
     */
    @Test
    fun aPonteSemSessaoE404EnaoUmaExplicacao() {
        var chamou = false
        val s = sobe(ponte = { _, _ -> chamou = true; "{}".toByteArray() })
        // `%20` e não um espaço cru: um espaço na linha de requisição é
        // recusado pelo `EspelhoHttp` como MALFORMADO, antes de existir rota —
        // e um cliente de verdade nunca o manda assim. Testá-lo cru mediria a
        // camada de baixo e tentaria afrouxá-la para o 404 sair, que é o
        // caminho exato para enfraquecer a defesa mais forte das duas.
        for (query in listOf("", "?s=", "?s=curta", "?s=tem%20espaco", "?s=" + "x".repeat(65))) {
            val r = pedir(
                s.porta,
                "POST /ponte/call$query HTTP/1.1\r\nHost: {HOST}\r\nContent-Length: 0\r\n\r\n",
            )
            assertTrue(query + " → " + r.lineSequence().first(), r.startsWith("HTTP/1.1 404 "))
        }
        // A ASSERÇÃO QUE CARREGA O TESTE é esta, e não o status: o despacho —
        // e com ele a superfície inteira da ponte — não foi alcançado.
        assertTrue("o despacho não pode ter sido alcançado", !chamou)
    }

    /**
     * O TETO DO CORPO DA PONTE NÃO É O DA REDE.
     *
     * O `EspelhoHttp.TETO_CORPO` são 256 bytes, e ele está certo para o socket
     * que qualquer um na Wi-Fi da igreja alcança. Aqui passa o `salvarTexto`,
     * que carrega o Registro inteiro — e um 413 sobre ele chegaria ao
     * `native.js` como `null`, isto é, em silêncio.
     */
    @Test
    fun aPonteAceitaUmCorpoMuitoMaiorQueOTetoDaRede() {
        var recebido = 0
        val s = sobe(ponte = { _, corpo -> recebido = corpo.size; "{}".toByteArray() })
        val grande = "x".repeat(64 * 1024)
        val corpo = "AV1\na:1\nsalvarTexto\n1\n${grande.length}\n$grande\n"
        val r = pedir(
            s.porta,
            "POST /ponte/call?s=$SESSAO HTTP/1.1\r\nHost: {HOST}\r\n" +
                "Content-Length: ${corpo.length}\r\n\r\n$corpo",
        )
        assertTrue(r, r.startsWith("HTTP/1.1 200 "))
        assertEquals(corpo.length, recebido)
        // E o teto continua EXISTINDO: ele é de protocolo, não uma porta aberta.
        assertTrue(NucleoPonte.TETO_CORPO in 1..(8 * 1024 * 1024))
    }

    /**
     * Uma ponte que lança não pode derrubar o servidor nem pendurar a janela:
     * ela vira uma resposta com `erro`, e o `call()` do lado web já trata
     * qualquer coisa que não seja o esperado.
     */
    @Test
    fun aPonteQueLancaViraRespostaEnaoQueda() {
        val s = sobe(ponte = { _, _ -> throw IllegalStateException("estourou") })
        val r = pedir(
            s.porta,
            "POST /ponte/call?s=$SESSAO HTTP/1.1\r\nHost: {HOST}\r\nContent-Length: 0\r\n\r\n",
        )
        assertTrue(r, r.startsWith("HTTP/1.1 200 "))
        assertTrue(r, r.contains("\"erro\""))
        assertTrue(r, r.contains("estourou"))
        // E o servidor continua de pé.
        assertTrue(get(s.porta, "/controle/").contains("<title>"))
    }

    @Test
    fun oVerboErradoNaPonteE404EnaoOutraCoisa() {
        val s = sobe()
        val r = get(s.porta, "/ponte/call")
        assertTrue(r, r.startsWith("HTTP/1.1 404 "))
    }

    // ---------- O FIO SSE ----------

    /**
     * O FIO É ENDEREÇADO, e as duas metades importam.
     *
     * A resposta de uma chamada volta para UMA janela — como o
     * `evaluateJavascript` do Android endereça um WebView. Um comando do
     * barramento vai para todas MENOS o emissor — como o `BroadcastChannel`,
     * que não entrega ao próprio, e como o `MessageBus`. Sem a segunda, o
     * `busPost` do Controle voltaria para o Controle: o `__mid` do `db.js` só
     * conhece os mids RECEBIDOS, então o eco entraria como mensagem NOVA.
     */
    @Test
    fun oQueDesceEEnderecado() {
        val s = sobe()
        val a = fio(s.porta, "sessao-controle-a")
        val b = fio(s.porta, "sessao-telao-bbb")
        try {
            s.empurrar("{\"t\":\"r\",\"id\":\"a:1\"}", alvo = "sessao-controle-a")
            s.empurrar("{\"t\":\"b\",\"m\":1}", menos = "sessao-controle-a")
            val doA = leEventos(a, 1)
            val doB = leEventos(b, 1)
            assertTrue("a resposta foi para o Controle: $doA", doA.contains("\"t\":\"r\""))
            assertTrue("e não voltou para quem a emitiu: $doA", !doA.contains("\"t\":\"b\""))
            assertTrue("o comando foi para o Telão: $doB", doB.contains("\"t\":\"b\""))
            assertTrue("e a resposta do outro não vazou: $doB", !doB.contains("\"t\":\"r\""))
        } finally { a.close(); b.close() }
    }

    @Test
    fun oFioSemSessaoE404() {
        val s = sobe()
        val r = get(s.porta, "/ponte/e")
        assertTrue(r, r.startsWith("HTTP/1.1 404 "))
    }

    /**
     * O CORPO DE UM `chunked` VAI EM CHUNKS. Escrever os bytes crus depois de
     * anunciar `Transfer-Encoding: chunked` não dá erro em lugar nenhum: o
     * navegador lê o começo do `data:` como o tamanho hexadecimal do bloco e o
     * fio morre — ou fica pendurado esperando um bloco que nunca fecha.
     */
    @Test
    fun oFioSaiEnquadrado() {
        val s = sobe()
        val c = fio(s.porta, "sessao-controle-a")
        try {
            val cab = c.cabecalho
            assertTrue(cab, cab.contains("text/event-stream"))
            assertTrue(cab, cab.contains("Transfer-Encoding: chunked"))
            s.empurrar("{\"t\":\"r\",\"id\":\"a:1\",\"v\":null}", alvo = "sessao-controle-a")
            val cru = leCru(c, 1)
            // Cada empurrão sai como UM chunk: tamanho em hexadecimal, CRLF,
            // os bytes, CRLF.
            assertTrue("o chunk anuncia o tamanho: $cru", Regex("^[0-9a-f]+\\r\\n").containsMatchIn(cru))
            assertTrue(cru, cru.contains("data: {"))
        } finally { c.close() }
    }

    // ---------- ferramentas do fio ----------

    /** Uma conexão SSE aberta e mantida — o que uma janela faz. */
    private class Fio(val s: Socket, val cabecalho: String) {
        val leitor = s.getInputStream().bufferedReader(Charsets.UTF_8)
        fun close() { try { s.close() } catch (_: Exception) {} }
    }

    private fun fio(porta: Int, sessao: String): Fio {
        val s = Socket(InetAddress.getLoopbackAddress(), porta)
        s.soTimeout = 4000
        s.getOutputStream().write(
            ("GET /ponte/e?s=$sessao HTTP/1.1\r\nHost: 127.0.0.1:$porta\r\n\r\n")
                .toByteArray(Charsets.US_ASCII)
        )
        s.getOutputStream().flush()
        // O cabeçalho vem inteiro antes do primeiro chunk; lê-se até a linha em
        // branco e nem um byte além, senão o corpo do teste some aqui.
        val ent = s.getInputStream()
        val cab = StringBuilder()
        while (!cab.endsWith("\r\n\r\n")) {
            val b = ent.read()
            if (b < 0) break
            cab.append(b.toChar())
        }
        return Fio(s, cab.toString())
    }

    /** Os `data:` que chegaram, esperando por [quantos] deles — pelo FATO, e
     *  nunca por um prazo: o `soTimeout` é a rede de segurança, não a régua. */
    private fun leEventos(f: Fio, quantos: Int): String {
        val fora = StringBuilder()
        var achados = 0
        while (achados < quantos) {
            val l = f.leitor.readLine() ?: break
            if (l.startsWith("data: ")) { fora.append(l).append('\n'); achados++ }
        }
        return fora.toString()
    }

    /** Os bytes CRUS do corpo, sem desfazer o enquadramento — é o
     *  enquadramento que se quer ver. */
    private fun leCru(f: Fio, quantosEventos: Int): String {
        val ent = f.s.getInputStream()
        val buf = ByteArray(4096)
        val fora = StringBuilder()
        var vistos = 0
        while (vistos < quantosEventos + 1) { // +1: o comentário `: oi` de abertura
            val n = ent.read(buf)
            if (n <= 0) break
            val pedaco = String(buf, 0, n, Charsets.UTF_8)
            fora.append(pedaco)
            vistos += Regex("data: |: oi").findAll(pedaco).count()
        }
        // Corta o comentário de abertura: o que interessa é o chunk do evento.
        val i = fora.indexOf("data: ")
        return if (i > 0) fora.substring(fora.lastIndexOf("\r\n", i - 3).coerceAtLeast(0) + 2) else fora.toString()
    }
}
