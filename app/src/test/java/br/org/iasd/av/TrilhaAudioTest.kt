package br.org.iasd.av

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * QUAL TRILHA VAI AO TELÃO.
 *
 * O defeito que criou este arquivo é o mais silencioso que este caminho tem:
 * o download funciona, o vídeo entra no telão, a barra anda — e o testemunho
 * está **em inglês**, na frente da congregação. Nada erra alto, nada aparece
 * no Registro, e o operador descobre no sábado.
 *
 * Por isso os casos vêm em PARES sempre que possível: o que a regra passou a
 * recusar, e o que ela não pode ter passado a recusar junto. O segundo é o
 * que impede a correção de virar "só baixa se for português", que apagaria da
 * biblioteca todo vídeo estrangeiro sem nada que o explicasse.
 */
class TrilhaAudioTest {

    // As faixas são pares (idioma, tipo), que é exatamente o que a regra lê.
    private fun ptBr(tipo: String = TrilhaAudio.ORIGINAL) = "pt-BR" to tipo
    private fun en(tipo: String = TrilhaAudio.DUBLADA) = "en" to tipo
    private fun semTrilha() = "" to ""

    private fun escolher(vararg faixas: Pair<String, String>): List<Pair<String, String>> =
        TrilhaAudio.soPortugues(faixas.toList(), { it.first }, { it.second })
            .sortedBy { TrilhaAudio.ordem(it.first, it.second) }

    // ---- ehPortugues ----

    @Test
    fun `português é o IDIOMA da etiqueta, não um prefixo solto`() {
        assertTrue(TrilhaAudio.ehPortugues("pt"))
        assertTrue(TrilhaAudio.ehPortugues("pt-BR"))
        assertTrue(TrilhaAudio.ehPortugues("pt-PT"))
        assertFalse(TrilhaAudio.ehPortugues("en"))
        assertFalse(TrilhaAudio.ehPortugues("es-419"))
        assertFalse(TrilhaAudio.ehPortugues(""))
        // A armadilha do `startsWith("pt")`: um idioma que só COMEÇA como
        // português não é português.
        assertFalse(TrilhaAudio.ehPortugues("pta"))
    }

    // ---- ordem ----

    @Test
    fun `o português vem antes de tudo`() {
        assertEquals(0, TrilhaAudio.ordem("pt-BR", TrilhaAudio.ORIGINAL))
        assertEquals(0, TrilhaAudio.ordem("pt-BR", TrilhaAudio.DUBLADA))
        assertTrue(
            TrilhaAudio.ordem("pt-BR", TrilhaAudio.DUBLADA) <
                TrilhaAudio.ordem("en", TrilhaAudio.ORIGINAL),
        )
    }

    @Test
    fun `o vídeo SEM metadado de trilha não é rebaixado — é o caso normal do acervo`() {
        assertEquals(1, TrilhaAudio.ordem("", ""))
        // Antes do ORIGINAL noutro idioma: um vídeo que não declara trilha é um
        // vídeo com um áudio só, e é o caminho que sempre funcionou.
        assertTrue(TrilhaAudio.ordem("", "") < TrilhaAudio.ordem("en", TrilhaAudio.ORIGINAL))
    }

    @Test
    fun `entre idiomas estrangeiros, o ORIGINAL vem antes da dublagem`() {
        assertEquals(2, TrilhaAudio.ordem("en", TrilhaAudio.ORIGINAL))
        assertEquals(3, TrilhaAudio.ordem("es", TrilhaAudio.DUBLADA))
        assertTrue(
            TrilhaAudio.ordem("en", TrilhaAudio.ORIGINAL) <
                TrilhaAudio.ordem("es", TrilhaAudio.DUBLADA),
        )
    }

    @Test
    fun `a DESCRITIVA é a última em qualquer idioma, português inclusive`() {
        assertEquals(4, TrilhaAudio.ordem("pt-BR", TrilhaAudio.DESCRITIVA))
        assertEquals(4, TrilhaAudio.ordem("en", TrilhaAudio.DESCRITIVA))
        assertTrue(
            TrilhaAudio.ordem("pt-BR", TrilhaAudio.DESCRITIVA) >
                TrilhaAudio.ordem("en", TrilhaAudio.DUBLADA),
        )
    }

    // ---- soPortugues: a exclusividade ----

    @Test
    fun `havendo português, a dublagem em inglês nem entra na fila`() {
        // O caso do Provai e Vede: as duas trilhas na mesma lista.
        val fila = escolher(en(), ptBr())
        assertEquals(1, fila.size)
        assertEquals("pt-BR", fila[0].first)
    }

    @Test
    fun `e vale mesmo com VÁRIAS dublagens e mais de uma faixa em português`() {
        val fila = escolher(en(), "es" to TrilhaAudio.DUBLADA, ptBr(), "pt" to TrilhaAudio.DUBLADA)
        assertEquals(2, fila.size)
        assertTrue(fila.all { TrilhaAudio.ehPortugues(it.first) })
    }

    @Test
    fun `NÃO havendo português, nada muda — o vídeo estrangeiro continua tocando`() {
        val fila = escolher(en(), "es" to TrilhaAudio.DUBLADA)
        assertEquals(2, fila.size)
        // E o ORIGINAL na frente, que é o melhor palpite quando não há a nossa.
        assertEquals("en", fila[0].first)
    }

    @Test
    fun `o vídeo de faixa única passa inteiro — nenhuma exclusão por falta de metadado`() {
        val fila = escolher(semTrilha(), semTrilha())
        assertEquals(2, fila.size)
    }

    @Test
    fun `uma DESCRITIVA em português não exclui a original estrangeira`() {
        // Ela é a única trilha `pt` que não serve para projetar: deixá-la
        // disparar a exclusividade trocaria um problema por outro — o telão
        // ganharia a narração dos elementos visuais no lugar do vídeo.
        val fila = escolher(en(TrilhaAudio.ORIGINAL), ptBr(TrilhaAudio.DESCRITIVA))
        assertEquals(2, fila.size)
        assertEquals("en", fila[0].first)
    }

    @Test
    fun `mas havendo a comum em português, a descritiva em português fica atrás dela`() {
        val fila = escolher(ptBr(TrilhaAudio.DESCRITIVA), ptBr())
        assertEquals(1, fila.size)
        assertEquals(TrilhaAudio.ORIGINAL, fila[0].second)
    }

    @Test
    fun `lista vazia não explode`() {
        assertEquals(0, escolher().size)
    }
}
