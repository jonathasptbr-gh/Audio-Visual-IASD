package br.org.iasd.av

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * A GUARDA DE HOST DO DESVIO DE CORS (v1.11.3) — a mesma invariante 2 do
 * shell aplicada a um terceiro destino de `fetch()` nativo: falhar ABERTO
 * aqui vira um proxy HTTP de uso geral pendurado num WebView privilegiado.
 *
 * Só [R2ImagemFonte.hostPermitido] é testável sem mockar `android.util.Log`
 * ou abrir um socket de verdade — é a metade PURA deste arquivo, e é a que
 * mais importa provar. Os casos vêm em PARES, como no `EspelhoInterfacesTest`:
 * o que a regra aceita, e o ataque vizinho que ela não pode ter aceitado
 * junto.
 */
class R2ImagemFonteTest {

    private val hostPinado = "pub-8c0e123c55a14cdfa0c52fa182688782.r2.dev"

    @Test
    fun aceitaOHostPinadoPorHttps() {
        assertTrue(R2ImagemFonte.hostPermitido("https://$hostPinado/images/x.jpg"))
    }

    @Test
    fun recusaOMesmoHostPorHttpSemTls() {
        assertFalse(R2ImagemFonte.hostPermitido("http://$hostPinado/images/x.jpg"))
    }

    @Test
    fun recusaUmHostQueSoTerminaComOHostPinado() {
        // A invariante 2 pelo lado do SUFIXO: `evil-pub-....r2.dev` não é o
        // mesmo host que `pub-....r2.dev`, e um domínio assim é registrável
        // por qualquer um.
        assertFalse(R2ImagemFonte.hostPermitido("https://evil-$hostPinado/images/x.jpg"))
    }

    @Test
    fun recusaUmHostQueSoComecaComOHostPinado() {
        // E pelo lado do PREFIXO: `pub-....r2.dev.evil.com` começa com o host
        // pinado — um `startsWith` autorizaria a navegação.
        assertFalse(R2ImagemFonte.hostPermitido("https://$hostPinado.evil.com/images/x.jpg"))
    }

    @Test
    fun recusaUmSubdominioDoHostPinado() {
        // A allowlist é do HOST EXATO, nunca do domínio — diferente da trava
        // por domínio do `Louvorja.daOrigem`. Um subdomínio não é o bucket
        // medido no Registro do operador.
        assertFalse(R2ImagemFonte.hostPermitido("https://x.$hostPinado/images/x.jpg"))
    }

    @Test
    fun recusaAOrigemPrincipalQueJaMandaCorsDeVerdade() {
        // api.louvorja.com.br não precisa do desvio — só o bucket sem CORS
        // precisa, e um host fora da allowlist tem de continuar recusado.
        assertFalse(R2ImagemFonte.hostPermitido("https://api.louvorja.com.br/file/x.jpg"))
    }

    @Test
    fun recusaUmaUrlMalformadaSemLancar() {
        assertFalse(R2ImagemFonte.hostPermitido("não é uma url"))
    }

    @Test
    fun recusaStringVaziaSemLancar() {
        assertFalse(R2ImagemFonte.hostPermitido(""))
    }

    // ===== o registro efêmero (revisão X2) =====

    @Test
    fun oMesmoTokenServeMaisDeUmaVez() {
        // O RETRY DO CHROMIUM: o `take` removia a entrada, e o segundo pedido
        // do MESMO token recebia 404 — a varredura então acusava a FONTE por
        // uma imagem que ela tinha entregado.
        val bytes = byteArrayOf(1, 2, 3, 4)
        val url = R2ImagemRegistry.store(bytes, "image/png")
        val token = url.substringAfterLast('/')
        val primeira = R2ImagemRegistry.take(token)
        val segunda = R2ImagemRegistry.take(token)
        assertNotNull("o primeiro pedido encontra o registro", primeira)
        assertNotNull("e o segundo TAMBÉM", segunda)
        assertArrayEquals(bytes, segunda!!.first)
        assertEquals("image/png", segunda.second)
        assertTrue(
            "a URL servível nasce no origin do app",
            url.startsWith("https://appassets.androidplatform.net/r2img/"),
        )
    }

    @Test
    fun tokenDesconhecidoDevolveNull() {
        assertNull(R2ImagemRegistry.take("nao-existe"))
    }

    @Test
    fun oRegistroNaoCresceSemTeto() {
        // O teto de ENTRADAS é o que impede a varredura do hinário inteiro de
        // acumular bytes em memória (o teto de bytes é o outro). Despeja-se o
        // mais ANTIGO — a inserção é a ordem de chegada.
        var primeiro = ""
        var ultimo = ""
        for (i in 0 until 40) {
            val url = R2ImagemRegistry.store(byteArrayOf(i.toByte()), "image/jpeg")
            if (i == 0) primeiro = url.substringAfterLast('/')
            ultimo = url.substringAfterLast('/')
        }
        assertNull("o primeiro token já saiu do registro", R2ImagemRegistry.take(primeiro))
        assertNotNull("e o último continua servível", R2ImagemRegistry.take(ultimo))
    }
}
