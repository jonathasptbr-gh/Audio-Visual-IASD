package br.org.iasd.av

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * A REGRA DA DERIVA DO SOM — a parte pura do [EspelhoAudio].
 *
 * O resto daquele arquivo é `MediaCodec`, threads e um canal de WebView, e nada
 * disso cabe num teste de unidade. A REGRA, essa, é aritmética — e é ela que
 * decide se a tela da rede fica com som ou fica muda pelo resto do culto, que
 * foi o defeito da v5.185.
 *
 * O que cada caso trava está escrito no caso, e não aqui: um teste que precisa
 * de um cabeçalho para se explicar está afirmando a coisa errada.
 */
class EspelhoAudioTest {

    @Test
    fun `deriva dentro da zona morta nao mexe em nada`() {
        assertEquals(0L, EspelhoAudio.planoDeCorrecao(0L))
        assertEquals(0L, EspelhoAudio.planoDeCorrecao(120_000L))
        assertEquals(0L, EspelhoAudio.planoDeCorrecao(EspelhoAudio.DERIVA_MIN_US))
    }

    /**
     * O som ADIANTADO não é o defeito deste recurso, e tratá-lo como se fosse
     * seria pior que ignorá-lo: a única correção possível para trás é rebobinar
     * o `tfdt`, e um `tfdt` que anda para trás é o pior desfecho catalogado
     * deste desenho.
     */
    @Test
    fun `deriva negativa — som adiantado — nao e corrigida`() {
        assertEquals(0L, EspelhoAudio.planoDeCorrecao(-500_000L))
        assertEquals(0L, EspelhoAudio.planoDeCorrecao(-10_000_000L))
    }

    /**
     * **O passo é o TETO, nunca a deriva inteira** — e a primeira escrita deste
     * caso afirmava o contrário ("logo acima da zona morta, fecha de uma vez"),
     * o que reprovou no CI e estava certo em reprovar: `TETO_SILENCIO_US` e
     * `DERIVA_MIN_US` são iguais, então esse caso não existe.
     *
     * O que existe, e é o que sustenta a convergência, é a relação entre os
     * dois: o que sobra depois de um passo cai dentro da zona morta sempre que a
     * deriva era menor que a soma deles.
     */
    @Test
    fun `deriva media e fechada com silencio, em passos`() {
        val pouco = EspelhoAudio.DERIVA_MIN_US + 1_000L
        val passo = EspelhoAudio.planoDeCorrecao(pouco)
        assertEquals(EspelhoAudio.TETO_SILENCIO_US, passo)
        assertTrue("sobraram ${pouco - passo} µs", pouco - passo <= EspelhoAudio.DERIVA_MIN_US)
        // Grande demais para um passo: sai o teto, e o resto fica para a volta
        // seguinte do laço — os blocos chegam a cada ~40 ms.
        assertEquals(EspelhoAudio.TETO_SILENCIO_US, EspelhoAudio.planoDeCorrecao(2_000_000L))
    }

    /**
     * O limiar do salto é o `AUDIO_MUDO_MS` do cliente (3 s) por construção:
     * passado ele a tela já soltou a faixa de som, então não há continuidade a
     * preservar e encher o buraco de silêncio só atrasaria a volta.
     */
    @Test
    fun `deriva grande manda reancorar em vez de encher de silencio`() {
        assertEquals(-1L, EspelhoAudio.planoDeCorrecao(EspelhoAudio.DERIVA_SALTO_US))
        assertEquals(-1L, EspelhoAudio.planoDeCorrecao(30_000_000L))
    }

    /**
     * A propriedade que sustenta a correção inteira: **o silêncio inserido nunca
     * passa da deriva medida.** Passar dela poria o som À FRENTE do vídeo, e o
     * passo seguinte não teria como desfazer isso (ver o caso da deriva
     * negativa) — a correção viraria o defeito.
     */
    @Test
    fun `o silencio inserido nunca ultrapassa a deriva`() {
        var d = EspelhoAudio.DERIVA_MIN_US + 1
        while (d < EspelhoAudio.DERIVA_SALTO_US) {
            val plano = EspelhoAudio.planoDeCorrecao(d)
            assertTrue("plano $plano > deriva $d", plano <= d)
            assertTrue("plano $plano nao e silencio", plano > 0L)
            d += 7_331L
        }
    }

    /**
     * E a que garante CONVERGÊNCIA: toda deriva acima da zona morta produz um
     * passo grande o bastante para fazê-la encolher de verdade. Um plano que
     * devolvesse migalhas deixaria a deriva acima da zona morta para sempre,
     * corrigindo a cada bloco e nunca alcançando — que é o serrilhado que a
     * zona morta existe para evitar.
     */
    @Test
    fun `todo passo encolhe a deriva de forma apreciavel`() {
        var d = EspelhoAudio.DERIVA_MIN_US + 1
        while (d < EspelhoAudio.DERIVA_SALTO_US) {
            // O passo é sempre o MAIOR possível: ou fecha a deriva inteira, ou
            // gasta o teto. Um plano que devolvesse migalhas deixaria a deriva
            // acima da zona morta para sempre, corrigindo a cada bloco e nunca
            // alcançando — o serrilhado que a zona morta existe para evitar.
            assertEquals(
                minOf(d, EspelhoAudio.TETO_SILENCIO_US),
                EspelhoAudio.planoDeCorrecao(d),
            )
            d += 7_331L
        }
    }

    /**
     * E os degraus precisam estar em ordem, senão a regra não existe: um teto de
     * silêncio maior que o limiar do salto tornaria o silêncio inalcançável, e
     * uma zona morta maior que o teto faria toda correção ser recusada por
     * pequena depois de ter sido aprovada por grande.
     */
    @Test
    fun `os tres degraus estao em ordem`() {
        assertTrue(EspelhoAudio.DERIVA_MIN_US > 0)
        assertTrue(EspelhoAudio.TETO_SILENCIO_US >= EspelhoAudio.DERIVA_MIN_US)
        assertTrue(EspelhoAudio.DERIVA_SALTO_US > EspelhoAudio.TETO_SILENCIO_US)
    }
}
