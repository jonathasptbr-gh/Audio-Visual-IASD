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

    private fun sobe(porta: Int = portaLivre(), ponte: (ByteArray) -> ByteArray = { "{}".toByteArray() }): NucleoServidor {
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
        val segunda = NucleoServidor(raiz, s.porta) { "{}".toByteArray() }
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
        val s = NucleoServidor(vazia, portaLivre()) { ByteArray(0) }
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

    @Test
    fun aPonteRecebeOCorpoEDevolveODela() {
        var visto: String? = null
        val s = sobe(ponte = { corpo ->
            visto = String(corpo, Charsets.UTF_8)
            "{\"ok\":1}".toByteArray(Charsets.UTF_8)
        })
        val corpo = "{\"m\":\"role\",\"id\":\"a:1\"}"
        val r = pedir(
            s.porta,
            "POST /ponte/call HTTP/1.1\r\nHost: {HOST}\r\n" +
                "Content-Type: application/json\r\nContent-Length: ${corpo.length}\r\n\r\n$corpo",
        )
        assertEquals(corpo, visto)
        assertTrue(r, r.startsWith("HTTP/1.1 200 "))
        assertTrue(r, r.contains("{\"ok\":1}"))
    }

    /**
     * Uma ponte que lança não pode derrubar o servidor nem pendurar a janela:
     * ela vira uma resposta com `erro`, e o `call()` do lado web já trata
     * qualquer coisa que não seja o esperado.
     */
    @Test
    fun aPonteQueLancaViraRespostaEnaoQueda() {
        val s = sobe(ponte = { throw IllegalStateException("estourou") })
        val r = pedir(
            s.porta,
            "POST /ponte/call HTTP/1.1\r\nHost: {HOST}\r\nContent-Length: 2\r\n\r\n{}",
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
}
