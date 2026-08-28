package br.org.iasd.av

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

// SEPARADO DO `EspelhoParesTest` QUANDO O `:core` NASCEU (v1.4.5).
//
// As duas classes moravam no mesmo arquivo porque testam a mesma fronteira — o
// que entra na allowlist de `Host` do servidor. Com o `EspelhoPares` mudando
// para o módulo JVM puro e o `EspelhoCert` ficando aqui (ele lê `Context`,
// `Uri` e `Log` para tratar o `.p12`), um arquivo só passou a não compilar em
// lugar nenhum: no `:core` falta o `EspelhoCert`, e no `:app` faltaria o resto.
//
// A divisão é pelo que cada teste TESTA, que é como deveria ter sido desde o
// começo. Nada foi reescrito: o corpo abaixo é o mesmo, verbatim.

/**
 * O ORÁCULO DO NOME DO CERTIFICADO — as duas funções PURAS do [EspelhoCert].
 *
 * Elas decidem o que entra na allowlist de `Host` do servidor, e é aí que um
 * erro custa caro: um nome errado (ou um wildcard aceito por engano) faz o
 * `EspelhoHttp` devolver o 404 IDÊNTICO a toda requisição, e o sintoma no
 * aparelho é "com certificado o espelho para de funcionar" — sem nada no
 * Registro que o explique, porque o 404 é idêntico de propósito.
 *
 * Ficam neste arquivo, e não num terceiro, porque são da mesma família: o
 * controle de acesso do espelho, escrito sem Android e testado sem aparelho.
 */
class EspelhoCertNomeTest {

    @Test
    fun cnSimples() {
        assertEquals("telao.igreja.org.br", EspelhoCert.cnDe("CN=telao.igreja.org.br,O=Igreja,C=BR"))
    }

    @Test
    fun cnNoMeioEComEspacos() {
        assertEquals("telao.igreja.org.br", EspelhoCert.cnDe("O=Igreja, CN=telao.igreja.org.br, C=BR"))
    }

    @Test
    fun cnEmMinusculas() {
        assertEquals("x.igreja.org.br", EspelhoCert.cnDe("cn=x.igreja.org.br"))
    }

    /**
     * A vírgula ESCAPADA faz parte do valor. Dividir sem olhar o escape cortaria
     * um CN legítimo ao meio — raro, e silencioso quando acontece.
     */
    @Test
    fun cnComVirgulaEscapada() {
        assertEquals("Igreja, Central", EspelhoCert.cnDe("CN=Igreja\\, Central,O=X"))
    }

    @Test
    fun dnSemCnDaVazio() {
        assertEquals("", EspelhoCert.cnDe("O=Igreja,C=BR"))
        assertEquals("", EspelhoCert.cnDe(""))
    }

    /** "CNPJ=" começa com CN e NÃO é um CN. */
    @Test
    fun cnNaoCasaComPrefixoParecido() {
        assertEquals("", EspelhoCert.cnDe("CNPJ=123,O=X"))
    }

    @Test
    fun nomeUtilAceitaUmNomeDeVerdade() {
        assertTrue(EspelhoCert.nomeUtil("telao.igreja.org.br"))
        assertTrue(EspelhoCert.nomeUtil("a-b.c.d"))
    }

    /**
     * **O WILDCARD É RECUSADO**, e não é detalhe: a allowlist de `Host` é EXATA
     * por invariante, e um `*.lan.igreja.org.br` guardado ali não casaria com
     * `Host` nenhum — o servidor ficaria esperando uma conexão que nunca chega.
     */
    @Test
    fun nomeUtilRecusaWildcard() {
        assertFalse(EspelhoCert.nomeUtil("*.lan.igreja.org.br"))
    }

    /** Sem ponto é rótulo de rede local, não um nome que o roteador resolve. */
    @Test
    fun nomeUtilRecusaRotuloSemPonto() {
        assertFalse(EspelhoCert.nomeUtil("telao"))
    }

    @Test
    fun nomeUtilRecusaLixo() {
        assertFalse(EspelhoCert.nomeUtil(""))
        assertFalse(EspelhoCert.nomeUtil("com espaço.br"))
        assertFalse(EspelhoCert.nomeUtil("http://x.br"))
        assertFalse(EspelhoCert.nomeUtil("x.br:8787"))
        assertFalse(EspelhoCert.nomeUtil("a".repeat(254) + ".br"))
    }
}
