package br.org.iasd.av

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files

/**
 * AS DUAS METADES PURAS DO `SlideDeck` — a que lê o link e a que APAGA.
 *
 * A revisão X2 as achou sem oráculo nenhum, e são justamente as duas que erram
 * calado:
 *
 *  - `urlDeExportacao` decide se o link compartilhado do Google Apresentações
 *    vira PDF (e com que `id`); um regex frouxo aqui manda o app baixar a
 *    página errada, e o defeito aparece como "não deu para abrir";
 *  - `pastaParaDescartar` decide o que APAGAR. Um token do `/saf/` também
 *    aponta para as pastas do operador, então a comparação com a raiz do nosso
 *    cache é o que separa "apagar o intermediário" de "apagar o original".
 *
 * O resto do arquivo (`renderizar`, `baixar`, `paginas`) toca `PdfRenderer`,
 * `ContentResolver` e rede — não cabe em JUnit sem Robolectric, e é o CI +
 * aparelho que o cobrem.
 */
class SlideDeckTest {

    private val id = "1AbCdEfGhIjKlMnOpQrStUv"   // 23 caracteres: acima do piso de 16

    @Test
    fun aceitaAsFormasDoBotaoDeCompartilhar() {
        // As TRÊS formas que o botão do Google produz. O sufixo é sempre o
        // mesmo, e o `id` tem de sobreviver intacto — é ele que a exportação
        // usa.
        for (link in listOf(
            "https://docs.google.com/presentation/d/$id/edit?usp=sharing",
            "https://docs.google.com/presentation/d/$id/view",
            "https://docs.google.com/presentation/d/$id/present#slide=id.p",
        )) {
            assertEquals(
                "o link $link tem de virar a URL de exportação do MESMO id",
                "https://docs.google.com/presentation/d/$id/export/pdf",
                SlideDeck.urlDeExportacao(link),
            )
        }
    }

    @Test
    fun recusaoQueNaoEapresentacao() {
        for (link in listOf(
            "",
            "https://docs.google.com/document/d/$id/edit",
            "https://docs.google.com/presentation/d/curto/edit",
            "https://exemplo.com/presentation/d/$id/edit",
            "não é um link",
        )) {
            assertNull("o link \"$link\" não pode virar exportação", SlideDeck.urlDeExportacao(link))
        }
    }

    @Test
    fun apagaSoASubpastaDoNossoCache() {
        val raiz = Files.createTempDirectory("slides-teste").toFile()
        try {
            val pasta = File(raiz, "chave-1").apply { mkdirs() }
            val pagina = File(pasta, "1.png").apply { writeText("png") }

            // Do nosso cache: devolve a SUBPASTA (as páginas moram juntas).
            assertEquals(pasta, SlideDeck.pastaParaDescartar(raiz, pagina.path))

            // O ARQUIVO DIRETO NA RAIZ não é uma subpasta de páginas.
            val solto = File(raiz, "solto.png").apply { writeText("x") }
            assertNull(SlideDeck.pastaParaDescartar(raiz, solto.path))

            // Fora da raiz — o original do operador, que um token `/saf/`
            // também alcança: NUNCA é nosso para apagar.
            val fora = Files.createTempDirectory("documento-do-operador").toFile()
            val alheio = File(fora, "hino.pdf").apply { writeText("pdf") }
            assertNull(SlideDeck.pastaParaDescartar(raiz, alheio.path))
            assertTrue("o arquivo do operador continua no disco", alheio.isFile)

            // Sem caminho não há o que apagar.
            assertNull(SlideDeck.pastaParaDescartar(raiz, null))
        } finally {
            raiz.deleteRecursively()
        }
    }

    @Test
    fun oDescarteApagaAsPaginasDaSubpasta() {
        // O efeito do [SlideDeck.pastaParaDescartar] quando o chamador o usa:
        // a subpasta INTEIRA sai (é o que `descartar` faz com o retorno).
        val raiz = Files.createTempDirectory("slides-teste").toFile()
        try {
            val pasta = File(raiz, "chave-2").apply { mkdirs() }
            File(pasta, "1.png").writeText("png")
            File(pasta, "2.png").writeText("png")
            val alvo = SlideDeck.pastaParaDescartar(raiz, File(pasta, "1.png").path)
            assertTrue(alvo!!.deleteRecursively())
            assertTrue("a raiz do cache continua de pé", raiz.isDirectory)
        } finally {
            raiz.deleteRecursively()
        }
    }
}
