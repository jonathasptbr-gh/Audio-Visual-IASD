package br.org.iasd.av

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.File

/**
 * O ORÁCULO DA ROTA `/saf/` — a única porta para fora do bundle.
 *
 * A metade que carrega o arquivo é a **invariante 9 aplicada a ARQUIVO**. No
 * Android o WebView do telão é montado sem o handler `/saf/`: ele não tem como
 * buscar um, nem sabendo o token. No computador as duas janelas dividem UM
 * socket — a porta é a origem, e um segundo socket seria um segundo IndexedDB
 * —, então a negativa precisa vir de outro lugar, e vem da sessão na URL.
 */
class NucleoArquivosTest {

    private val CONTROLE = "sessao-do-controle"
    private val TELAO = "sessao-do-telao-x"
    private val BASE = "http://127.0.0.1:8420"
    private lateinit var pasta: File

    @Before
    fun montar() {
        pasta = File.createTempFile("saf", "").let { it.delete(); it.mkdirs(); it }
        File(pasta, "001. Santo.mp3").writeText("0123456789")
        File(pasta, "louvor.mp4").writeText("xx")
        File(pasta, "leia.txt").writeText("y")
        File(pasta, "uma-pasta").mkdirs()
    }

    @After
    fun desmontar() {
        NucleoArquivos.esquecer(CONTROLE)
        NucleoArquivos.esquecer(TELAO)
        pasta.deleteRecursively()
    }

    // ---------- A INVARIANTE 9, APLICADA A ARQUIVO ----------

    /**
     * O token do Controle **não vale na sessão do Telão**, e a defesa não é o
     * segredo do token: é não haver o que achar. Os métodos que cunham token
     * são todos privilegiados, e o [NucleoDespacho] os recusa fora do papel
     * `controle` — logo uma sessão de Telão nunca tem entrada nenhuma.
     */
    @Test
    fun oTokenDoControleNaoValeNoTelao() {
        val alvo = File(pasta, "001. Santo.mp3")
        val token = NucleoArquivos.registrar(CONTROLE, alvo)
        assertEquals(alvo, NucleoArquivos.arquivoDe(CONTROLE, token))
        assertNull("o Telão não alcança o disco do operador",
            NucleoArquivos.arquivoDe(TELAO, token))
    }

    /** O PAR: um token não existe até alguém cunhá-lo, e cunhar é privilégio. */
    @Test
    fun umaSessaoSemTokenNaoAchaNada() {
        assertNull(NucleoArquivos.arquivoDe(TELAO, "aaaaaaaaaaaaaaaaaaaa"))
        assertNull(NucleoArquivos.arquivoDe("sessao-nunca-vista", "aaaaaaaaaaaaaaaaaaaa"))
    }

    /** A janela fechou: o que era dela vai junto. */
    @Test
    fun fecharAJanelaApagaOsTokensDela() {
        val t = NucleoArquivos.registrar(CONTROLE, File(pasta, "louvor.mp4"))
        NucleoArquivos.esquecer(CONTROLE)
        assertNull(NucleoArquivos.arquivoDe(CONTROLE, t))
    }

    // ---------- AS REGRAS DO TOKEN ----------

    /**
     * O MESMO ARQUIVO DEVOLVE SEMPRE O MESMO TOKEN. Sem isto, cada
     * `listFolder` de uma pasta de 500 arquivos acrescentaria 500 entradas a
     * cada re-sincronização, num processo mantido vivo durante todo o culto.
     */
    @Test
    fun oMesmoArquivoDevolveOMesmoToken() {
        val a = File(pasta, "001. Santo.mp3")
        assertEquals(NucleoArquivos.registrar(CONTROLE, a), NucleoArquivos.registrar(CONTROLE, a))
        // E o PAR: arquivos diferentes, tokens diferentes.
        assertNotEquals(
            NucleoArquivos.registrar(CONTROLE, a),
            NucleoArquivos.registrar(CONTROLE, File(pasta, "louvor.mp4")),
        )
    }

    /**
     * O token é OPACO, não o caminho codificado. Um caminho do Windows tem
     * `\`, `:` e espaços: ele viraria segmento de rota, comprimento de URL e
     * travessia — e ainda revelaria a árvore de diretórios do operador para
     * quem lesse a URL.
     */
    @Test
    fun oTokenNaoCarregaOCaminho() {
        val t = NucleoArquivos.registrar(CONTROLE, File(pasta, "001. Santo.mp3"))
        assertTrue(t, NucleoArquivos.tokenValido(t))
        assertTrue("nada do nome do arquivo sai no token", !t.contains("Santo"))
        assertTrue("nem do caminho", !t.contains(pasta.name))
        assertTrue("sem separador de caminho", !t.contains('/') && !t.contains('\\'))
        // E não é um contador: `/saf/1..N` não existe.
        assertTrue(t.length >= 16)
    }

    @Test
    fun aFormaDoTokenERecusadaQuandoAbsurda() {
        assertTrue(!NucleoArquivos.tokenValido(""))
        assertTrue(!NucleoArquivos.tokenValido("curto"))
        assertTrue(!NucleoArquivos.tokenValido("a".repeat(65)))
        assertTrue(!NucleoArquivos.tokenValido("aaaaaaaaaaaaaaaa/bbb"))
        assertTrue(!NucleoArquivos.tokenValido("aaaaaaaaaaaaaaaa.."))
    }

    /** Arquivo que sumiu do disco entre o registro e o pedido é 404, não uma
     *  exceção no meio de uma resposta HTTP. */
    @Test
    fun arquivoQueSumiuNaoEAchado() {
        val a = File(pasta, "leia.txt")
        val t = NucleoArquivos.registrar(CONTROLE, a)
        a.delete()
        assertNull(NucleoArquivos.arquivoDe(CONTROLE, t))
    }

    // ---------- AS ROTAS ----------

    @Test
    fun aRotaExigeSessaoEtokenBemFormados() {
        val t = NucleoArquivos.registrar(CONTROLE, File(pasta, "louvor.mp4"))
        val boa = NucleoRotas.decidir("GET", "/saf/$CONTROLE/$t")
        assertTrue(boa is NucleoRotas.Rota.Arquivo)
        assertEquals(CONTROLE, (boa as NucleoRotas.Rota.Arquivo).sessao)
        assertEquals(t, boa.token)

        // TRÊS SEGMENTOS EXATOS. Um a mais viraria um caminho DENTRO do
        // arquivo, e é assim que uma rota de arquivo vira uma travessia.
        assertTrue(NucleoRotas.decidir("GET", "/saf/$CONTROLE/$t/x") is NucleoRotas.Rota.NaoAchei)
        assertTrue(NucleoRotas.decidir("GET", "/saf/$t") is NucleoRotas.Rota.NaoAchei)
        assertTrue(NucleoRotas.decidir("GET", "/saf/") is NucleoRotas.Rota.NaoAchei)
        assertTrue(NucleoRotas.decidir("GET", "/saf/curta/$t") is NucleoRotas.Rota.NaoAchei)
        assertTrue(NucleoRotas.decidir("GET", "/saf/$CONTROLE/curto") is NucleoRotas.Rota.NaoAchei)
        // E só GET: um POST em `/saf/` não é uma rota que exista.
        assertTrue(NucleoRotas.decidir("POST", "/saf/$CONTROLE/$t") is NucleoRotas.Rota.NaoAchei)
    }

    // ---------- O TIPO ----------

    /**
     * O TIPO É O QUE DECIDE O *KIND* DA MÍDIA no `controle.js`. Um
     * `octet-stream` onde devia vir `audio/mpeg` faz um hino virar arquivo
     * genérico — e o telão, que mantém o wallpaper para `kind:'audio'`, passa
     * a mostrar outra coisa.
     */
    @Test
    fun oTipoCobreOQueOOperadorImporta() {
        assertEquals("audio/mpeg", NucleoArquivos.tipoDe("001. Santo.mp3"))
        assertEquals("audio/mp4", NucleoArquivos.tipoDe("playback.m4a"))
        assertEquals("video/mp4", NucleoArquivos.tipoDe("SERMAO.MP4"))
        assertEquals("image/jpeg", NucleoArquivos.tipoDe("fundo.JPG"))
        assertEquals("application/pdf", NucleoArquivos.tipoDe("roteiro.pdf"))
        assertEquals(
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            NucleoArquivos.tipoDe("slides.pptx"),
        )
        assertEquals("application/octet-stream", NucleoArquivos.tipoDe("coisa.xyz"))
        assertEquals("application/octet-stream", NucleoArquivos.tipoDe("semextensao"))
    }

    // ---------- A LISTAGEM ----------

    /**
     * `listFolder` não recorre e não devolve diretório — a mesma regra do
     * `listChildren` do Android. O que o lado web sincroniza é uma PASTA, não
     * uma árvore: uma varredura recursiva de "Meus Documentos" seria uma
     * travessia autorizada pelo próprio operador sem que ele soubesse.
     */
    @Test
    fun aListagemENaoRecursivaEsoDeArquivos() {
        File(pasta, "uma-pasta/escondido.mp3").writeText("z")
        val json = NucleoArquivos.listarPasta(BASE, CONTROLE, pasta)
        assertTrue(json, json.contains("001. Santo.mp3"))
        assertTrue(json, json.contains("louvor.mp4"))
        assertTrue("nenhum diretório na lista", !json.contains("uma-pasta"))
        assertTrue("e nada de dentro dele", !json.contains("escondido.mp3"))
    }

    @Test
    fun aListagemTemOsCamposQueOLadoWebLe() {
        val json = NucleoArquivos.listarPasta(BASE, CONTROLE, pasta)
        // Os cinco campos do `listChildren` do Android, com os mesmos nomes.
        for (campo in listOf("\"name\"", "\"type\"", "\"size\"", "\"mtime\"", "\"url\"")) {
            assertTrue("falta $campo em $json", json.contains(campo))
        }
        assertTrue("o tamanho é o de verdade", json.contains("\"size\":10"))
        // A URL é ABSOLUTA e do NOSSO origin — o mesmo contrato do Android
        // (`https://appassets.androidplatform.net/saf/…`).
        assertTrue(json, json.contains("\"$BASE/saf/$CONTROLE/"))
    }

    @Test
    fun umaPastaQueNaoExisteEListaVaziaEnaoErro() {
        assertEquals("[]", NucleoArquivos.listarPasta(BASE, CONTROLE, File(pasta, "nao-existe")))
    }

    // ---------- AS RESPOSTAS DA PONTE ----------

    @Test
    fun aPastaEscolhidaTemOsTresCampos() {
        val j = NucleoArquivos.comoPasta(pasta)
        assertTrue(j, j.contains("\"id\""))
        assertTrue(j, j.contains("\"uri\""))
        assertTrue(j, j.contains("\"name\":\"" + pasta.name + "\""))
    }

    @Test
    fun osDocumentosEscolhidosViramUrlsServiveis() {
        val j = NucleoArquivos.comoDocumentos(
            BASE, CONTROLE,
            listOf(File(pasta, "001. Santo.mp3"), File(pasta, "nao-existe.mp3")),
        )
        assertTrue(j, j.contains("\"url\":\"$BASE/saf/$CONTROLE/"))
        assertTrue(j, j.contains("\"type\":\"audio/mpeg\""))
        // O que não é arquivo não entra: um caminho que sumiu entre o diálogo e
        // a resposta viraria um item da biblioteca que nunca carrega.
        assertTrue("o inexistente não entra", !j.contains("nao-existe"))
    }

    /** Um nome com aspas ou barra invertida — comum num arquivo do Windows —
     *  não pode quebrar o JSON que o navegador vai parsear. */
    @Test
    fun oNomeDoArquivoEescapado() {
        val esquisito = File(pasta, "a\"b.mp3")
        esquisito.writeText("q")
        val j = NucleoArquivos.comoDocumentos(BASE, CONTROLE, listOf(esquisito))
        assertTrue(j, j.contains("a\\\"b.mp3"))
    }
}
