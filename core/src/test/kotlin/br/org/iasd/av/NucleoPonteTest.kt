package br.org.iasd.av

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File

/**
 * A METADE CONSUMIDORA do envelope da ponte.
 *
 * A produtora está em `tools/ponte-envelope.test.mjs`, e as duas leem **as
 * mesmas fixtures** (`tools/fixtures/ponte-envelope.json`), escritas à mão. É
 * a forma que este projeto já viu falhar em silêncio duas vezes — o `__tela`
 * do `display-ready` e o `TIPOS_QUE_SOBEM` do dreno —, e a razão é sempre a
 * mesma: *ler cada lado isolado aprova os dois.*
 *
 * As fixtures NÃO são geradas por nenhum dos dois lados. Fossem, cada oráculo
 * provaria que um lado concorda consigo mesmo.
 */
class NucleoPonteTest {

    /**
     * Um leitor de JSON de dez linhas para as fixtures, e ele existe pelo
     * mesmo motivo que o `NucleoPonte` não tem um: `org.json` é API da
     * plataforma **Android**, não da JVM, e o `:core` não ganha dependência
     * por causa de um teste. Ele só entende o que a fixture usa.
     */
    private fun campos(bloco: String): Map<String, String> {
        val m = HashMap<String, String>()
        val re = Regex("\"(\\w+)\"\\s*:\\s*\"((?:[^\"\\\\]|\\\\.)*)\"")
        for (g in re.findAll(bloco)) m[g.groupValues[1]] = desescapar(g.groupValues[2])
        return m
    }

    private fun desescapar(s: String): String {
        val b = StringBuilder()
        var i = 0
        while (i < s.length) {
            val c = s[i]
            if (c != '\\') { b.append(c); i++; continue }
            when (val d = s[i + 1]) {
                'n' -> b.append('\n')
                'r' -> b.append('\r')
                't' -> b.append('\t')
                'u' -> { b.append(s.substring(i + 2, i + 6).toInt(16).toChar()); i += 4 }
                else -> b.append(d)
            }
            i += 2
        }
        return b.toString()
    }

    /** Os blocos `{...}` de um array nomeado da fixture, sem parser de verdade. */
    private fun blocos(nome: String): List<String> {
        val txt = File("../tools/fixtures/ponte-envelope.json").let {
            if (it.isFile) it else File("tools/fixtures/ponte-envelope.json")
        }.readText(Charsets.UTF_8)
        val ini = txt.indexOf("\"$nome\"")
        assertTrue("a fixture tem o array $nome", ini >= 0)
        val fim = txt.indexOf("\n  ]", ini)
        val corte = txt.substring(ini, fim)
        val fora = ArrayList<String>()
        var i = corte.indexOf('{')
        while (i >= 0) {
            var p = i
            var nivel = 0
            var dentro = false
            var escapa = false
            while (p < corte.length) {
                val c = corte[p]
                when {
                    escapa -> escapa = false
                    c == '\\' && dentro -> escapa = true
                    c == '"' -> dentro = !dentro
                    !dentro && c == '{' -> nivel++
                    !dentro && c == '}' -> { nivel--; if (nivel == 0) break }
                }
                p++
            }
            fora.add(corte.substring(i, p + 1))
            i = corte.indexOf('{', p + 1)
        }
        return fora
    }

    /** Os `args` de um bloco, na ordem — array de strings, e só. */
    private fun args(bloco: String): List<String> {
        val ini = bloco.indexOf("\"args\"")
        val a = bloco.indexOf('[', ini)
        val f = bloco.indexOf(']', a)
        val dentro = bloco.substring(a + 1, f)
        val re = Regex("\"((?:[^\"\\\\]|\\\\.)*)\"")
        return re.findAll(dentro).map { desescapar(it.groupValues[1]) }.toList()
    }

    // ---------- O CONTRATO ----------

    @Test
    fun leOsEnvelopesDaFixture() {
        val bs = blocos("bons")
        assertTrue("a fixture não pode estar vazia", bs.size >= 6)
        for (b in bs) {
            val c = campos(b)
            val nome = c["nome"]!!
            val lido = NucleoPonte.ler(c["fio"]!!.toByteArray(Charsets.UTF_8))
            assertNotNull(nome, lido)
            assertEquals(nome, c["id"], lido!!.id)
            assertEquals(nome, c["metodo"], lido.metodo)
            assertEquals(nome, args(b), lido.args)
        }
    }

    /**
     * A METADE DAS RECUSAS, e ela é a que carrega o arquivo. Um parser que
     * recusa tudo passa em qualquer teste que só olhe as recusas — por isso ela
     * vem depois da de cima, nunca sozinha.
     */
    @Test
    fun recusaOsMalformadosDaFixture() {
        val bs = blocos("malformados")
        assertTrue(bs.size >= 10)
        for (b in bs) {
            val c = campos(b)
            assertNull(c["nome"], NucleoPonte.ler(c["fio"]!!.toByteArray(Charsets.UTF_8)))
        }
    }

    /**
     * O IDA E VOLTA do produtor Kotlin — que é o lado que fala com a CASCA
     * pelo cano de stdio, e portanto tem de produzir o mesmo dialeto que a
     * folha injetada produz.
     */
    @Test
    fun montarEDepoisLerDevolveOMesmo() {
        for (b in blocos("bons")) {
            val c = campos(b)
            val bytes = NucleoPonte.montar(c["id"]!!, c["metodo"]!!, args(b))
            assertEquals(c["nome"], c["fio"], String(bytes, Charsets.UTF_8))
            val lido = NucleoPonte.ler(bytes)!!
            assertEquals(args(b), lido.args)
        }
    }

    // ---------- O CANO ----------

    @Test
    fun oCanoEnquadraEDesenquadra() {
        val saida = ByteArrayOutputStream()
        val um = NucleoPonte.montar("a:1", "listFolder", listOf("x"))
        val dois = NucleoPonte.montar("a:2", "salvarTexto", listOf("r.txt", "linha1\nlinha2"))
        NucleoPonte.escreverNoCano(saida, um)
        NucleoPonte.escreverNoCano(saida, dois)
        val entrada = ByteArrayInputStream(saida.toByteArray())
        // O SEGUNDO envelope é o que prova o enquadramento: um argumento com
        // quebra de linha dentro passaria batido numa leitura por linhas.
        assertEquals("listFolder", NucleoPonte.ler(NucleoPonte.lerDoCano(entrada)!!)!!.metodo)
        val d = NucleoPonte.ler(NucleoPonte.lerDoCano(entrada)!!)!!
        assertEquals(listOf("r.txt", "linha1\nlinha2"), d.args)
        // Fim do cano: `null`, que é o desfecho NORMAL de a casca sair.
        assertNull(NucleoPonte.lerDoCano(entrada))
    }

    @Test
    fun oCanoRecusaComprimentoAbsurdo() {
        val abs = ("999999999\n").toByteArray(Charsets.US_ASCII)
        assertNull(NucleoPonte.lerDoCano(ByteArrayInputStream(abs)))
        // E não é o dígito: um comprimento legítimo passa.
        val ok = ByteArrayOutputStream()
        NucleoPonte.escreverNoCano(ok, NucleoPonte.montar("a:1", "otaApply", emptyList()))
        assertNotNull(NucleoPonte.lerDoCano(ByteArrayInputStream(ok.toByteArray())))
    }

    @Test
    fun oCanoRecusaComprimentoQueNaoEnumero() {
        assertNull(NucleoPonte.lerDoCano(ByteArrayInputStream("x\nabc".toByteArray())))
    }

    // ---------- OS QUADROS QUE DESCEM ----------

    @Test
    fun oQuadroDeRespostaCarregaOValorJaEmJson() {
        assertEquals(
            "{\"t\":\"r\",\"id\":\"ab:1\",\"v\":[1,2]}",
            NucleoPonte.quadroResolve("ab:1", "[1,2]"),
        )
        // Valor ausente vira `null` do JavaScript, que é o que todo chamador do
        // `native.js` já trata (lista vazia, string vazia, false).
        assertEquals("{\"t\":\"r\",\"id\":\"ab:1\",\"v\":null}", NucleoPonte.quadroResolve("ab:1", ""))
    }

    @Test
    fun oQuadroDoBarramentoNaoLeOComando() {
        // VERBATIM: o núcleo transporta comando, não o interpreta.
        val cmd = "{\"type\":\"load\",\"__mid\":\"ab:1\"}"
        assertEquals("{\"t\":\"b\",\"m\":$cmd}", NucleoPonte.quadroBus(cmd))
    }

    @Test
    fun oEscapeFechaAsQuebrasQueOSseUsaComoFRONTEIRA() {
        // Um `\n` cru dentro de um quadro terminaria o evento SSE no meio e o
        // resto viraria um segundo evento — que é como um título de louvor com
        // quebra de linha derrubaria a ponte.
        val q = NucleoPonte.quadroResolve("a:1", NucleoPonte.aspas("linha1\nlinha2"))
        assertTrue("nenhuma quebra crua no quadro", !q.contains('\n'))
        assertTrue(q.contains("\\n"))
        assertEquals("\"a\\\"b\\\\c\"", NucleoPonte.aspas("a\"b\\c"))
        assertEquals("\"\\u0000\"", NucleoPonte.aspas("\u0000"))
    }
}
