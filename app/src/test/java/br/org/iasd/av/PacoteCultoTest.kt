package br.org.iasd.av

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * O PACOTE DE UM CULTO no shell (shell 90): o nome que vai para a bolha do WhatsApp, o tipo do
 * envio (mistura com capa, genérico sem), a pasta que o separa do pronto do acervo e a capa que
 * chega do web em base64 sem ser recomprimida.
 */
class PacoteCultoTest {

    @Test
    fun nomeGuardaAcentoEEspacoETiraOQueEscreveriaForaDaPasta() {
        assertEquals("Culto Sábado 18-11.avpkg", PacoteCulto.nomeDoArquivo("Culto Sábado 18-11.avpkg"))
        assertEquals("a b c.avpkg", PacoteCulto.nomeDoArquivo("../a/b\\c"))
        assertEquals("Culto.avpkg", PacoteCulto.nomeDoArquivo("  "))
        assertEquals("x.avpkg", PacoteCulto.nomeDoArquivo("x.AVPKG"))
        assertEquals("x.avpkg", PacoteCulto.nomeDoArquivo("x"))
        val longo = PacoteCulto.nomeDoArquivo("n".repeat(300))
        assertTrue(longo.length <= 120 && longo.endsWith(".avpkg"))
    }

    @Test
    fun tipoDoEnvioEMimeProprioSoNaPastaDoCulto() {
        assertEquals("*/*", PacoteCulto.tipoDoEnvio(3))
        assertEquals("application/octet-stream", PacoteCulto.tipoDoEnvio(0))
        assertTrue(PacoteCulto.ehPacoteDoCulto("/pacote/culto/Culto Sábado 18-11.avpkg"))
        assertFalse(PacoteCulto.ehPacoteDoCulto("/pacote/acervo-av-20261118-1530.avpkg"))
        assertFalse(PacoteCulto.ehPacoteDoCulto("/pacote/culto/capa-1.png"))
        assertFalse(PacoteCulto.ehPacoteDoCulto(null))
    }

    @Test
    fun paginasDaCapa() {
        assertEquals("capa-1.png", PacoteCulto.nomeDaCapa(1))
        assertTrue(PacoteCulto.paginaValida(1) && PacoteCulto.paginaValida(6))
        assertFalse(PacoteCulto.paginaValida(0) || PacoteCulto.paginaValida(7))
    }

    @Test
    fun capaEmBase64ChegaIgualESoSeForPng() {
        val png = byteArrayOf(0x89.toByte(), 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3)
        val b64 = java.util.Base64.getEncoder().encodeToString(png)
        assertArrayEquals(png, PacoteCulto.bytesDaCapa(b64))
        assertNull(PacoteCulto.bytesDaCapa("isto não é base64 !!!"))
        assertNull(PacoteCulto.bytesDaCapa(java.util.Base64.getEncoder().encodeToString(byteArrayOf(1, 2, 3, 4, 5, 6, 7, 8, 9))))
    }
}
