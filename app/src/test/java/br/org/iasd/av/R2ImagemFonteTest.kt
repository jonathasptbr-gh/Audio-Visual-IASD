package br.org.iasd.av

import org.junit.Assert.assertFalse
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
}
