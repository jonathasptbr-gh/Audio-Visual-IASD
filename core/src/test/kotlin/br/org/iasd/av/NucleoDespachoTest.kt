package br.org.iasd.av

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * O ORÁCULO DO DESPACHO — e a metade que carrega o arquivo é a **invariante
 * 9**.
 *
 * No Android ela é `host = null` no WebView do telão mais uma guarda em cada
 * método privilegiado, e o `CLAUDE.md` registra por extenso que **não há
 * oráculo para ela**: afirmá-la exigiria carregar o `native.js` com um
 * `__AVBridge` de mentira cujo `role()` devolvesse `display`.
 *
 * Aqui o papel é selado na SESSÃO, que a casca registra ao criar a janela, e a
 * recusa acontece no servidor. Isso a torna uma linha de tabela — e uma linha
 * de tabela se testa. É o degrau que o desenho do computador ganha de graça, e
 * está escrito aqui para não se perder.
 */
class NucleoDespachoTest {

    private class Escuta {
        val quadros = ArrayList<Triple<String, String?, String?>>()
        val paraCasca = ArrayList<NucleoPonte.Chamada>()
        val d: NucleoDespacho = NucleoDespacho(
            empurrar = { j, alvo, menos -> quadros.add(Triple(j, alvo, menos)) },
            paraCasca = { e -> paraCasca.add(NucleoPonte.ler(e)!!) },
        )
        fun chamar(sessao: String, metodo: String, vararg args: String) =
            d.chamada(sessao, NucleoPonte.montar("a:1", metodo, args.toList()))
    }

    private val CONTROLE = "sessao-do-controle"
    private val TELAO = "sessao-do-telao-x"

    private fun montado(): Escuta {
        val e = Escuta()
        e.d.registrarSessao(CONTROLE, "controle")
        e.d.registrarSessao(TELAO, "display")
        return e
    }

    // ---------- INVARIANTE 9 ----------

    /**
     * OS SEIS PRIVILEGIADOS não existem para o Telão. O desfecho é o
     * INOFENSIVO — o mesmo `null` que o Android devolve com `host == null` —,
     * e nada sai para a casca: é a casca que abriria o diálogo de arquivo, e
     * ela não pode nem ficar sabendo do pedido.
     */
    @Test
    fun oTelaoNaoAlcancaASuperficiePrivilegiada() {
        val e = montado()
        for (m in e.d.PRIVILEGIADOS) {
            e.quadros.clear(); e.paraCasca.clear()
            e.chamar(TELAO, m, "x")
            assertEquals("$m: nada pode ir para a casca", 0, e.paraCasca.size)
            assertEquals("$m: e a promessa resolve na hora", 1, e.quadros.size)
            assertTrue("$m → " + e.quadros[0].first, e.quadros[0].first.contains("\"v\":null"))
            assertEquals("$m: endereçado a quem chamou", TELAO, e.quadros[0].second)
        }
    }

    /**
     * O PAR da anterior, e sem ele a de cima seria aprovada por um despacho que
     * recusa tudo. O Controle alcança os mesmos seis.
     */
    @Test
    fun oControleAlcancaOsMesmosSeis() {
        val e = montado()
        for (m in e.d.PRIVILEGIADOS) {
            e.paraCasca.clear()
            e.chamar(CONTROLE, m, "x")
            // `espelhoLigar`/`espelhoLigarEm` ainda não têm dono no lote 3:
            // eles caem em [naoImplementados], que é um destino LEGÍTIMO e
            // visível. O que a asserção afirma é a AUSÊNCIA DE RECUSA POR
            // PAPEL, e ela vale nos dois casos.
            val recusadoPorPapel = e.paraCasca.isEmpty() && m in e.d.DA_CASCA
            assertTrue("$m foi recusado ao Controle", !recusadoPorPapel)
        }
    }

    /**
     * `espelhoLigarEm` é o mesmo método com um argumento a mais — ele virou
     * método próprio para não encolher uma assinatura publicada (ver a regra
     * de entrega). Deixá-lo fora da lista seria a porta dos fundos exata do
     * que a lista fecha, e ele é o pior dos seis: abre um servidor na rede da
     * igreja.
     */
    @Test
    fun aListaCobreOIrmaoComArgumento() {
        val e = montado()
        assertTrue("espelhoLigar" in e.d.PRIVILEGIADOS)
        assertTrue("espelhoLigarEm" in e.d.PRIVILEGIADOS)
        assertTrue("listFolder" in e.d.PRIVILEGIADOS)
    }

    /**
     * UMA SESSÃO SEM PAPEL É TRATADA COMO NÃO-CONTROLE. A casca registra o
     * papel ao criar a janela; uma sessão que ninguém registrou não é uma
     * janela nossa, e a postura fechada é a única que faz sentido.
     */
    @Test
    fun sessaoDesconhecidaNaoEControle() {
        val e = montado()
        e.chamar("sessao-nunca-vista", "pickFolder")
        assertEquals(0, e.paraCasca.size)
        assertTrue(e.quadros[0].first.contains("\"v\":null"))
    }

    // ---------- O BARRAMENTO ----------

    /**
     * O comando vai para todas as janelas MENOS o emissor, e o JSON atravessa
     * VERBATIM — o núcleo não lê comando.
     *
     * A exclusão não é economia: o `BroadcastChannel` não entrega ao próprio
     * emissor, e o `__mid` do `db.js` só conhece os mids RECEBIDOS. Um eco
     * chegaria como mensagem NOVA, e o Controle passaria a processar os
     * próprios comandos.
     */
    @Test
    fun oBarramentoExcluiOEmissorEnaoLeOComando() {
        val e = montado()
        val cmd = "{\"type\":\"load\",\"mediaId\":\"x\",\"__mid\":\"zz:7\"}"
        e.chamar(CONTROLE, "busPost", cmd)
        assertEquals(1, e.quadros.size)
        val (json, alvo, menos) = e.quadros[0]
        assertEquals("não é endereçado a ninguém em particular", null, alvo)
        assertEquals("e exclui quem emitiu", CONTROLE, menos)
        assertTrue(json, json.contains(cmd))
    }

    /** O barramento é do NÚCLEO, não da casca: um comando por janela não pode
     *  atravessar o cano de stdio e voltar. */
    @Test
    fun oBarramentoNaoPassaPelaCasca() {
        val e = montado()
        e.chamar(TELAO, "busPost", "{\"type\":\"display-status\"}")
        assertEquals(0, e.paraCasca.size)
        assertEquals(1, e.quadros.size)
    }

    // ---------- O QUE AINDA NÃO EXISTE ----------

    /**
     * Um método sem dono resolve `null` NA HORA e entra numa lista.
     *
     * Sem isso ele resolveria `null` pelo prazo de 60 s do `native.js` — o
     * botão existe, é tocável, e depois de um minuto não acontece nada. A
     * diferença entre "o programa travou" e "esta parte ainda não existe nesta
     * versão" é uma linha de diagnóstico.
     */
    @Test
    fun oQueNaoTemDonoResolveNaHoraEFicaRegistrado() {
        val e = montado()
        e.chamar(CONTROLE, "ytSearch", "santo")
        assertEquals(1, e.quadros.size)
        assertTrue(e.quadros[0].first.contains("\"v\":null"))
        assertEquals(CONTROLE, e.quadros[0].second)
        assertTrue("ytSearch" in e.d.naoImplementados())
        // Sem repetição: a lista é o que FALTA, não um contador de toques.
        e.chamar(CONTROLE, "ytSearch", "outro")
        assertEquals(1, e.d.naoImplementados().count { it == "ytSearch" })
    }

    // ---------- A CASCA ----------

    @Test
    fun oQueEDaCascaVaiParaOCanoComASessaoNaFrente() {
        val e = montado()
        e.chamar(CONTROLE, "listFolder", "content://x")
        assertEquals(1, e.paraCasca.size)
        val c = e.paraCasca[0]
        assertEquals("listFolder", c.metodo)
        assertEquals("a:1", c.id)
        assertEquals("a sessão vai na frente — é por ela que a resposta volta",
            listOf(CONTROLE, "content://x"), c.args)
        // E NADA foi resolvido ainda: quem responde é a casca.
        assertEquals(0, e.quadros.size)
    }

    @Test
    fun aRespostaDaCascaVoltaParaAJanelaQuePerguntou() {
        val e = montado()
        e.d.daCasca(NucleoPonte.montar("-", "resolver", listOf(CONTROLE, "a:9", "[{\"name\":\"x\"}]")))
        assertEquals(1, e.quadros.size)
        assertEquals(CONTROLE, e.quadros[0].second)
        assertTrue(e.quadros[0].first.contains("\"id\":\"a:9\""))
        assertTrue(e.quadros[0].first.contains("[{\"name\":\"x\"}]"))
    }

    @Test
    fun oProgressoVaiParaOCanalCerto() {
        val e = montado()
        e.d.daCasca(NucleoPonte.montar("-", "progresso", listOf("yt", CONTROLE, "a:9", "5", "10")))
        val j = e.quadros[0].first
        assertTrue(j, j.contains("\"t\":\"p\""))
        assertTrue(j, j.contains("\"c\":\"yt\""))
        assertTrue(j, j.contains("\"a\":5"))
        assertTrue(j, j.contains("\"b\":10"))
    }

    @Test
    fun aCascaRegistraEEsqueceSessoes() {
        val e = Escuta()
        e.d.daCasca(NucleoPonte.montar("-", "sessao", listOf(CONTROLE, "controle")))
        assertEquals("controle", e.d.papelDe(CONTROLE))
        e.d.daCasca(NucleoPonte.montar("-", "fechou", listOf(CONTROLE)))
        assertEquals("", e.d.papelDe(CONTROLE))
    }

    /** Envelope ilegível não derruba nada e não resolve promessa nenhuma — não
     *  há id de onde tirá-la. */
    @Test
    fun envelopeIlegivelViraRecibo() {
        val e = montado()
        val r = String(e.d.chamada(CONTROLE, "lixo".toByteArray()), Charsets.UTF_8)
        assertTrue(r, r.contains("erro"))
        assertEquals(0, e.quadros.size)
        e.d.daCasca("lixo".toByteArray())
        assertEquals(0, e.quadros.size)
    }

    // ---------- O SÍNCRONO ----------

    /**
     * `deckExportUrl` é o ÚNICO método que responde no corpo do `POST`, porque
     * o `native.js` o lê como String na hora. A regra é do `:core` — a mesma
     * que o Android usa —, não uma segunda escrita na casca.
     */
    @Test
    fun oUnicoSincronoRespondeNoCorpo() {
        val e = montado()
        val r = String(
            e.d.chamada(
                CONTROLE,
                NucleoPonte.montar(
                    "=", "deckExportUrl",
                    listOf("https://docs.google.com/presentation/d/1aBcDeFgHiJkLmNoPq/edit?usp=sharing"),
                ),
            ),
            Charsets.UTF_8,
        )
        assertEquals(
            "{\"v\":\"https://docs.google.com/presentation/d/1aBcDeFgHiJkLmNoPq/export/pdf\"}", r,
        )
        assertEquals("não sai nada pelo fio", 0, e.quadros.size)
        // O que não é uma apresentação devolve vazio — e vazio é uma RESPOSTA
        // aqui, não uma falha: é assim que o `native.js` já o lê.
        val n = String(
            e.d.chamada(CONTROLE, NucleoPonte.montar("=", "deckExportUrl", listOf("https://exemplo.com/x"))),
            Charsets.UTF_8,
        )
        assertEquals("{\"v\":\"\"}", n)
    }
}
