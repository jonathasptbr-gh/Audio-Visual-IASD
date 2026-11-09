package br.org.iasd.av

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.IOException
import java.io.InputStream

/**
 * A JANELA DE BYTES DO `/saf/` (shell 64) — a leitura que o importador do
 * pacote usa para NÃO materializar o arquivo inteiro.
 *
 * O que se prova aqui são os três jeitos de a janela sair errada SEM erro:
 *
 *  1. o laço que trata um `read` curto como fim de arquivo e entrega um buraco
 *     no meio — a corrupção silenciosa que o `SafJanela` existe para não ter;
 *  2. a faixa além do fim do documento, que tem de devolver MENOS bytes e
 *     deixar quem chamar conferir o tamanho (`pickDoc` já o deu);
 *  3. o `skip` curto tratado como completo, que entrega bytes de OUTRO trecho
 *     do arquivo (o deslocamento errado) — e o `skip` que não anda, que tem de
 *     falhar alto em vez de devolver lixo.
 *
 * Mais a validação do `?r=`, que é onde um pedido malformado ou gigante para
 * antes de virar memória. Tudo com `InputStream` de mentira: o
 * `ContentResolver` do Android fica FORA destas funções de propósito (ver o
 * KDoc de `SafJanela.lerJanela`), e é por isso que elas são testáveis.
 */
class SafJanelaTest {

    // ===== o `?r=` =====

    @Test
    fun faixaValidaViraPedidoInclusivo() {
        // `ini-fim` é INCLUSIVO nas duas pontas: 0-99 são cem bytes.
        assertEquals(SafJanela.Janela.Pedido(0, 100), SafJanela.janelaDe("0-99"))
        assertEquals(SafJanela.Janela.Pedido(100, 100), SafJanela.janelaDe("100-199"))
        assertEquals(SafJanela.Janela.Pedido(7, 1), SafJanela.janelaDe("7-7"))
    }

    @Test
    fun faixaMalformadaRecusa() {
        for (r in listOf("", "abc", "1", "1-", "-2", "1-2-3", "1 -2", " 1-2", "1-2 ")) {
            assertEquals(
                "a faixa \"$r\" não pode virar janela",
                SafJanela.Janela.Recusa(416, "faixa malformada"),
                SafJanela.janelaDe(r),
            )
        }
    }

    @Test
    fun faixaComMaisDeQuinzeDigitosRecusa() {
        // O regexo limita a quinze dígitos; dezesseis é malformada (e não um
        // `toLong` que estoura em silêncio).
        assertTrue(SafJanela.janelaDe("0-1234567890123456") is SafJanela.Janela.Recusa)
    }

    @Test
    fun faixaInvertidaRecusa() {
        assertEquals(
            SafJanela.Janela.Recusa(416, "faixa invertida"),
            SafJanela.janelaDe("10-9"),
        )
    }

    @Test
    fun janelaNoTetoPassaEUmByteAMaisRecusa() {
        val teto = SafJanela.TETO_JANELA
        assertEquals(
            SafJanela.Janela.Pedido(0, teto.toInt()),
            SafJanela.janelaDe("0-" + (teto - 1)),
        )
        assertEquals(
            SafJanela.Janela.Recusa(416, "janela acima de 24 MB"),
            SafJanela.janelaDe("0-" + teto),
        )
    }

    // ===== a leitura =====

    @Test
    fun leituraCurtaNoMeioNaoDeixaBuraco() {
        // Oito bytes, dois por `read`: quem tratasse o primeiro `read` como fim
        // devolveria uma janela de dois bytes.
        val dados = ByteArray(8) { it.toByte() }
        val lidos = SafJanela.lerJanela(PassoCurto(dados, 2), 8)
        assertEquals(8, lidos.size)
        assertTrue("os bytes têm de ser os do começo, na ordem", lidos.contentEquals(dados))
    }

    @Test
    fun janelaAlemDoFimDevolveMenosSemLancar() {
        // Documento de 4 bytes e janela de 10: devolve 4, e quem chamar confere
        // o tamanho que o `pickDoc` deu — nunca uma exceção que o web leria
        // como "a fonte falhou".
        val dados = byteArrayOf(10, 11, 12, 13)
        val lidos = SafJanela.lerJanela(ByteArrayInputStream(dados), 10)
        assertEquals(4, lidos.size)
        assertTrue(lidos.contentEquals(dados))
    }

    @Test
    fun janelaVaziaDevolveArrayVazio() {
        assertEquals(0, SafJanela.lerJanela(ByteArrayInputStream(ByteArray(4)), 0).size)
    }

    @Test
    fun posicaoPorSkipLevaAoByteCerto() {
        val dados = ByteArray(10) { it.toByte() }
        val s = ByteArrayInputStream(dados)
        SafJanela.posicionarPorSkip(s, 4)
        assertEquals(4, s.read())
    }

    @Test
    fun skipParcialNaoEntregaBytesDeOutroTrecho() {
        // O `skip` que anda um byte por vez é o provedor de nuvem lento: um
        // laço que chamasse `skip(ini)` uma vez e seguisse leria o byte 1.
        val dados = ByteArray(10) { it.toByte() }
        val s = SkipDeUm(dados)
        SafJanela.posicionarPorSkip(s, 7)
        assertEquals(7, s.read())
    }

    @Test
    fun skipQueNaoAndaFalhaAlto() {
        // Devolver lixo calado é o que este `throw` impede.
        try {
            SafJanela.posicionarPorSkip(SkipZero(), 3)
            fail("um skip que não anda tinha de lançar")
        } catch (e: IOException) {
            assertTrue(e.message!!.contains("nao deu para posicionar"))
        }
    }

    // ===== os streams de mentira =====

    /** Devolve no máximo [passo] bytes por `read` — o `content://` que entrega
     *  menos do que se pediu, que é o caso NORMAL. */
    private class PassoCurto(private val dados: ByteArray, private val passo: Int) : InputStream() {
        private var pos = 0

        override fun read(): Int = if (pos >= dados.size) -1 else dados[pos++].toInt() and 0xff

        override fun read(b: ByteArray, off: Int, len: Int): Int {
            if (pos >= dados.size) return -1
            val n = minOf(passo, len, dados.size - pos)
            System.arraycopy(dados, pos, b, off, n)
            pos += n
            return n
        }
    }

    /** `skip` que anda no máximo um byte — o provedor sem seek barato. */
    private class SkipDeUm(dados: ByteArray) : ByteArrayInputStream(dados) {
        override fun skip(n: Long): Long = super.skip(minOf(n, 1L))
    }

    /** `skip` que nunca anda — o provedor que não sabe pular. */
    private class SkipZero : InputStream() {
        override fun read(): Int = -1
        override fun skip(n: Long): Long = 0L
    }
}
