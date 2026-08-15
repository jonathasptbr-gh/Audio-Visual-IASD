package br.org.iasd.av

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

/**
 * O CACHE DE MÍDIA da rota `/m/` — a fronteira nova da E4 do telão por
 * comandos. Um token aqui é uma CAPACIDADE: o que estes casos travam é quem a
 * rede alcança, e a regra do repositório para fronteira de rede é oráculo ou
 * dívida declarada.
 */
class EspelhoMidiaCacheTest {

    @get:Rule
    val tmp = TemporaryFolder()

    private fun cache(teto: Long = EspelhoMidiaCache.TETO_PADRAO) =
        EspelhoMidiaCache(tmp.newFolder(), teto)

    private val T1 = "aaaaaaaaaaaaaaaaaaaaaa"
    private val T2 = "bbbbbbbbbbbbbbbbbbbbbb"
    private val T3 = "cccccccccccccccccccccc"

    @Test
    fun `abrir, escrever, completar — o caminho feliz`() {
        val c = cache()
        val i = c.abrir(T1, "m1", "Hino 001", "video/mp4", 10)
        assertNotNull(i)
        assertEquals(4L, c.escrever(T1, byteArrayOf(1, 2, 3, 4)))
        assertEquals(10L, c.escrever(T1, byteArrayOf(5, 6, 7, 8, 9, 10)))
        c.completar(T1)
        val s = c.servir(T1)!!
        assertTrue(s.completo)
        assertEquals(10L, s.recebido)
        assertEquals(10L, s.arquivo.length())
    }

    @Test
    fun `o mesmo id devolve o MESMO item — a regra do SafRegistry`() {
        val c = cache()
        val a = c.abrir(T1, "m1", "n", "video/mp4", 10)!!
        c.escrever(T1, ByteArray(10))
        c.completar(T1)
        val b = c.abrir(T1, "m1", "n", "video/mp4", 10)
        assertTrue(a === b)
        assertTrue(b!!.completo)
    }

    /**
     * O mesmo id com token NOVO substitui — o caminho dos ids mutáveis (o
     * wallpaper trocado pelo operador). O token velho morre: quem já buscou a
     * URL antiga já tem os bytes dela.
     */
    @Test
    fun `o mesmo id com token novo SUBSTITUI e mata o token velho`() {
        val c = cache()
        val velho = c.abrir(T1, "m1", "n", "image/jpeg", 4)!!
        c.escrever(T1, ByteArray(4)); c.completar(T1)
        val novo = c.abrir(T2, "m1", "n", "image/jpeg", 6)
        assertNotNull(novo)
        assertNull(c.servir(T1))
        assertFalse(velho.arquivo.exists())
        assertEquals(6L, c.escrever(T2, ByteArray(6)))
    }

    @Test
    fun `token com forma invalida é recusado — a capacidade não pode ser fraca`() {
        val c = cache()
        assertNull(c.abrir("curto", "m1", "n", "video/mp4", 1))
        assertNull(c.abrir("tem espaco aaaaaaaaaaa", "m1", "n", "video/mp4", 1))
        assertNull(c.abrir("", "m1", "n", "video/mp4", 1))
        assertNull(c.abrir("a/../a/../a/../a/../aa", "m1", "n", "video/mp4", 1))
    }

    @Test
    fun `escrever num item completo ou desconhecido devolve -1`() {
        val c = cache()
        c.abrir(T1, "m1", "n", "video/mp4", 2)
        c.escrever(T1, byteArrayOf(1, 2))
        c.completar(T1)
        assertEquals(-1L, c.escrever(T1, byteArrayOf(3)))
        assertEquals(-1L, c.escrever(T2, byteArrayOf(3)))
    }

    @Test
    fun `cancelar apaga o parcial — meia mídia nunca é servível`() {
        val c = cache()
        val i = c.abrir(T1, "m1", "n", "video/mp4", 10)!!
        c.escrever(T1, ByteArray(4))
        c.cancelar(T1)
        assertNull(c.servir(T1))
        assertFalse(i.arquivo.exists())
        // O id fica LIVRE para um novo empurrão com token novo.
        assertNotNull(c.abrir(T3, "m1", "n", "video/mp4", 10))
    }

    @Test
    fun `o despejo é LRU por bytes e SÓ leva completos`() {
        val c = cache(teto = 100)
        c.abrir(T1, "m1", "n", "video/mp4", 60)
        c.escrever(T1, ByteArray(60))
        c.completar(T1)
        c.abrir(T2, "m2", "n", "video/mp4", 60)
        c.escrever(T2, ByteArray(60))
        // T2 NÃO está completo: mesmo estourando o teto, ele não pode sair —
        // há um empurrão vivo do outro lado do canal. Sai o T1 (completo).
        c.completar(T2)
        assertNull(c.servir(T1))
        assertNotNull(c.servir(T2))
    }

    @Test
    fun `o toque de LRU protege o mais usado`() {
        val c = cache(teto = 130)
        c.abrir(T1, "m1", "n", "video/mp4", 60); c.escrever(T1, ByteArray(60)); c.completar(T1)
        c.abrir(T2, "m2", "n", "video/mp4", 60); c.escrever(T2, ByteArray(60)); c.completar(T2)
        // Tocar o T1 o torna o mais recente; o T3 estoura o teto → sai o T2.
        c.servir(T1)
        c.abrir(T3, "m3", "n", "video/mp4", 60); c.escrever(T3, ByteArray(60)); c.completar(T3)
        assertNotNull(c.servir(T1))
        assertNull(c.servir(T2))
        assertNotNull(c.servir(T3))
    }

    @Test
    fun `zerar mata tokens e arquivos — a sessão morreu`() {
        val c = cache()
        val i = c.abrir(T1, "m1", "n", "video/mp4", 2)!!
        c.escrever(T1, ByteArray(2))
        c.completar(T1)
        c.zerar()
        assertNull(c.servir(T1))
        assertFalse(i.arquivo.exists())
        assertEquals(0, c.itens())
    }

    @Test
    fun `tipo estranho vira o genérico, nunca um erro`() {
        assertEquals("video/mp4", EspelhoMidiaCache.tipoValido("video/mp4"))
        assertEquals("audio/mp4", EspelhoMidiaCache.tipoValido("audio/mp4"))
        assertEquals("application/octet-stream", EspelhoMidiaCache.tipoValido("text/html"))
        assertEquals("application/octet-stream", EspelhoMidiaCache.tipoValido("video/mp4; codecs=\"avc1\""))
        assertEquals("application/octet-stream", EspelhoMidiaCache.tipoValido(""))
    }

    @Test
    fun `a cunhagem de reserva produz tokens válidos e distintos`() {
        val a = EspelhoMidiaCache.novoToken()
        val b = EspelhoMidiaCache.novoToken()
        assertTrue(EspelhoMidiaCache.tokenValido(a))
        assertTrue(EspelhoMidiaCache.tokenValido(b))
        assertTrue(a != b)
    }
}
