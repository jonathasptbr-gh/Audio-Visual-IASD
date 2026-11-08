package br.org.iasd.av

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * A GUARDA DE HOST DA CIFRA (revisão K6) — a mesma invariante 2 do shell que o
 * `R2ImagemFonteTest` prova para o desvio das fotos, agora no outro destino de
 * rede nativo do app: falhar ABERTO aqui vira um proxy HTTP de uso geral
 * pendurado num WebView privilegiado, com o IP do aparelho lendo a rede da
 * igreja.
 *
 * A regra é conferida em DOIS momentos de cada busca — na entrada e no destino
 * FINAL depois dos redirecionamentos (ver `CifraFonte.buscar`) —, e este
 * arquivo prova a regra em si, que é a metade PURA (sem socket, sem
 * `android.util.Log`). Os casos vêm em PARES, como no `EspelhoInterfacesTest`:
 * o que ela aceita, e o ataque vizinho que ela não pode ter aceitado junto.
 */
class CifraFonteTest {

    @Test
    fun aceitaAOrigemComWwwPorHttps() {
        assertTrue(CifraFonte.hostPermitido("https://www.cifraclub.com.br/hino/123"))
    }

    @Test
    fun aceitaARaizPorHttps() {
        // O outro lado do redirecionamento `www` ↔ raiz do próprio site: os
        // dois estão na allowlist porque a busca chega num e a resposta pode
        // vir do outro.
        assertTrue(CifraFonte.hostPermitido("https://cifraclub.com.br/hino/123"))
    }

    @Test
    fun recusaOMesmoHostPorHttpSemTls() {
        assertFalse(CifraFonte.hostPermitido("http://www.cifraclub.com.br/hino/123"))
    }

    @Test
    fun recusaUmHostQueSoTerminaComOHostPermitido() {
        // A invariante 2 pelo lado do SUFIXO: `cifraclub.com.br.evil.com` é um
        // domínio que qualquer um registra e um `endsWith` o autorizaria.
        assertFalse(CifraFonte.hostPermitido("https://cifraclub.com.br.evil.com/hino/1"))
    }

    @Test
    fun recusaUmHostQueSoComecaComOHostPermitido() {
        // E pelo lado do PREFIXO: `www.cifraclub.com.br-vizinho.net` começa com
        // o host permitido — é a classe de defeito da invariante 2.
        assertFalse(CifraFonte.hostPermitido("https://www.cifraclub.com.br-vizinho.net/hino/1"))
    }

    @Test
    fun recusaUmSubdominioQueNaoEstaNaLista() {
        // A allowlist é do HOST EXATO, não do domínio: um subdomínio novo (de
        // quem tomou a conta do site, por exemplo) não entra sozinho.
        assertFalse(CifraFonte.hostPermitido("https://m.cifraclub.com.br/hino/1"))
    }

    @Test
    fun recusaUmDestinoInternoQuePassaPelaAllowlistVizinha() {
        // O cenário que a segunda conferência existe para fechar: um
        // redirecionamento para o roteador da igreja. O `Location` sai do host
        // permitido, e o destino não.
        assertFalse(CifraFonte.hostPermitido("http://192.168.0.1/admin"))
    }

    @Test
    fun recusaUmaUrlMalformadaSemLancar() {
        assertFalse(CifraFonte.hostPermitido("não é uma url"))
    }

    @Test
    fun recusaStringVaziaSemLancar() {
        assertFalse(CifraFonte.hostPermitido(""))
    }
}
