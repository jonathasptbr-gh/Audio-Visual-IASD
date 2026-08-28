package br.org.iasd.av

/**
 * A ÚNICA REGRA DA APRESENTAÇÃO QUE É UMA STRING — **PURA**.
 *
 * Rasterizar um PDF em imagens é plataforma (`PdfRenderer` no Android, PDFBox
 * no computador), mas *reconhecer um link do Google Apresentações e montar o
 * endereço de exportação* é uma transformação de texto, e as duas cascas
 * precisam da mesma.
 *
 * Ela mora aqui porque é o **único método síncrono-com-retorno da ponte que
 * não é uma constante**. Os outros três (`shellVersion`, `role`, `appVersion`)
 * a casca injeta como literais; este precisa de uma resposta, e o `native.js`
 * o lê como String, não como Promise. Reescrevê-lo em JavaScript na folha
 * injetada seria regra na casca — invariante 5 — e mudá-lo para Promise seria
 * encolher uma assinatura publicada, o que custa um degrau de
 * `SHELL_VERSION` **nas duas cascas**, com a do Android pagando por uma
 * mudança que não é dela.
 */
object NucleoApresentacao {

    /**
     * `docs.google.com/presentation/d/<id>` em qualquer das formas que o botão
     * de compartilhar do Google produz (`/edit`, `/view`, `?usp=sharing`).
     */
    private val SLIDES_ID = Regex("docs\\.google\\.com/presentation/d/([A-Za-z0-9_-]{16,})")

    /** A apresentação do Google vira PDF por esta URL, ou `null` se não for uma. */
    fun urlDeExportacao(link: String): String? {
        val id = SLIDES_ID.find(link)?.groupValues?.get(1) ?: return null
        return "https://docs.google.com/presentation/d/$id/export/pdf"
    }
}
