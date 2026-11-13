package br.org.iasd.av

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * A CERCA DO GUIA DE SONOPLASTIA (shell 87) — [GuiaSom.urlDoGuia], a pergunta
 * que o `abrirGuia` da ponte faz na entrada e o WebView do guia a cada
 * navegação. Falhar ABERTO aqui transformaria a ponte num navegador embutido
 * para qualquer endereço. Os casos vêm em PARES: o que a regra aceita, e o
 * ataque vizinho que ela não pode ter aceitado junto.
 *
 * E o MARCADOR que transforma a página na tela do app
 * ([GuiaSom.comMarcadorDeApp]): antes da âncora, sem duplicar, e aceito pela
 * cerca.
 */
class GuiaSomTest {

    @Test
    fun aceitaOGuiaEAAncoraDoModoFacil() {
        assertTrue(GuiaSom.urlDoGuia("https://audiovisualiasd.com.br/sonoplastia/"))
        assertTrue(GuiaSom.urlDoGuia("https://audiovisualiasd.com.br/sonoplastia/#dia"))
        assertTrue(GuiaSom.urlDoGuia("https://audiovisualiasd.com.br/"))
    }

    @Test
    fun aceitaMaiusculasEAPortaPadrao() {
        assertTrue(GuiaSom.urlDoGuia("HTTPS://AudioVisualIASD.com.br/sonoplastia/"))
        assertTrue(GuiaSom.urlDoGuia("https://audiovisualiasd.com.br:443/sonoplastia/"))
    }

    @Test
    fun recusaOMesmoHostSemTls() {
        assertFalse(GuiaSom.urlDoGuia("http://audiovisualiasd.com.br/sonoplastia/"))
    }

    @Test
    fun recusaOutraPorta() {
        assertFalse(GuiaSom.urlDoGuia("https://audiovisualiasd.com.br:8443/sonoplastia/"))
    }

    @Test
    fun recusaHostQueSoComecaOuTerminaComOSite() {
        // Prefixo e sufixo são domínios que qualquer um registra (invariante 2).
        assertFalse(GuiaSom.urlDoGuia("https://audiovisualiasd.com.br.evil.com/sonoplastia/"))
        assertFalse(GuiaSom.urlDoGuia("https://evilaudiovisualiasd.com.br/sonoplastia/"))
        assertFalse(GuiaSom.urlDoGuia("https://www.evil.com/audiovisualiasd.com.br/"))
    }

    @Test
    fun recusaSubdominioEOutroHost() {
        assertFalse(GuiaSom.urlDoGuia("https://x.audiovisualiasd.com.br/"))
        assertFalse(GuiaSom.urlDoGuia("https://example.com/sonoplastia/"))
    }

    @Test
    fun recusaCredencialNaUrlEOHostNaAncora() {
        // `user@host`: o host é o site, mas a URL carrega credencial — recusa.
        assertFalse(GuiaSom.urlDoGuia("https://audiovisualiasd.com.br@evil.com/"))
        assertFalse(GuiaSom.urlDoGuia("https://x@audiovisualiasd.com.br/"))
        assertFalse(GuiaSom.urlDoGuia("https://evil.com/#@audiovisualiasd.com.br"))
    }

    @Test
    fun recusaEsquemasQueNaoSaoWeb() {
        assertFalse(GuiaSom.urlDoGuia("intent://audiovisualiasd.com.br/#Intent;end"))
        assertFalse(GuiaSom.urlDoGuia("javascript:alert(1)"))
        assertFalse(GuiaSom.urlDoGuia("file:///sdcard/x.html"))
        assertFalse(GuiaSom.urlDoGuia("https://appassets.androidplatform.net/web/controle/index.html"))
    }

    @Test
    fun recusaVazioNuloEIlegivel() {
        assertFalse(GuiaSom.urlDoGuia(null))
        assertFalse(GuiaSom.urlDoGuia(""))
        assertFalse(GuiaSom.urlDoGuia("https://audiovisualiasd.com.br\\@evil.com/"))
        assertFalse(GuiaSom.urlDoGuia("audiovisualiasd.com.br/sonoplastia/"))
    }

    @Test
    fun oMarcadorDeAppEntraAntesDaAncora() {
        assertEquals(
            "https://audiovisualiasd.com.br/sonoplastia/?app=1",
            GuiaSom.comMarcadorDeApp("https://audiovisualiasd.com.br/sonoplastia/"),
        )
        assertEquals(
            "https://audiovisualiasd.com.br/sonoplastia/?app=1#dia",
            GuiaSom.comMarcadorDeApp("https://audiovisualiasd.com.br/sonoplastia/#dia"),
        )
        assertTrue(
            GuiaSom.urlDoGuia(GuiaSom.comMarcadorDeApp("https://audiovisualiasd.com.br/sonoplastia/#dia")),
        )
    }

    @Test
    fun oMarcadorRespeitaAConsultaExistenteENaoDuplica() {
        assertEquals(
            "https://audiovisualiasd.com.br/sonoplastia/?modo=dia&app=1#d8",
            GuiaSom.comMarcadorDeApp("https://audiovisualiasd.com.br/sonoplastia/?modo=dia#d8"),
        )
        assertEquals(
            "https://audiovisualiasd.com.br/sonoplastia/?app=1#dia",
            GuiaSom.comMarcadorDeApp("https://audiovisualiasd.com.br/sonoplastia/?app=1#dia"),
        )
    }
}
