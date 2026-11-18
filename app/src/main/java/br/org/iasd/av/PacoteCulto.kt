package br.org.iasd.av

/**
 * O PACOTE DE UM CULTO no shell (shell 90): a parte PURA — nomes, tipos e a
 * conferência dos bytes da capa. Sem Android aqui, e é de propósito: é o que o
 * `PacoteCultoTest` exercita na JVM.
 *
 * | o quê | onde |
 * |---|---|
 * | o `.avpkg` do culto e as capas | `files/pacote/culto/` ([PASTA]) — subpasta, e por isso o culto NÃO é o pronto do acervo nem leva o acervo na porta |
 * | o envio com capas | `ACTION_SEND_MULTIPLE`, tipo [tipoDoEnvio] (`*` + `/` + `*`), capas primeiro e o pacote por último |
 * | o MIME próprio | [MIME], servido pelo `PacoteProvider` só para o `.avpkg` desta pasta, e aceito pelo `intent-filter` de `ACTION_VIEW` |
 */
object PacoteCulto {
    /** A subpasta de `files/pacote/` (o `pacote_paths.xml` já a cobre: `path="pacote/"`). */
    const val PASTA = "culto"

    /** O tipo próprio do `.avpkg`. Só no item do culto — o envio do acervo segue com `application/octet-stream`. */
    const val MIME = "application/vnd.iasd.avpkg"

    /** O tipo de um envio de UM arquivo: um MIME desconhecido no Intent esvazia o seletor. */
    const val MIME_GENERICO = "application/octet-stream"

    /** Páginas de capa, no máximo — o mesmo `CULTO_CAPAS_MAX` do `controle.js`. */
    const val CAPAS_MAX = 6

    private val PNG = byteArrayOf(0x89.toByte(), 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)

    /**
     * O nome de ARQUIVO do culto. Ao contrário do `nomeDeArquivoSeguro` do acervo, ele GUARDA
     * acento e espaço: é o nome que aparece na bolha do WhatsApp. Sai o que escreveria fora da
     * pasta ou que o provedor recusa (`/ \ : * ? " < > |`, controle, ponto inicial); vazio vira
     * "Culto"; teto de 120 caracteres; termina sempre em `.avpkg`.
     */
    fun nomeDoArquivo(nome: String): String {
        var base = nome.replace(Regex("[\\u0000-\\u001f\\u007f/\\\\:*?\"<>|]+"), " ")
            .replace(Regex("\\s+"), " ").trim().trimStart('.').trim()
        if (base.endsWith(".avpkg", ignoreCase = true)) base = base.dropLast(6).trim()
        if (base.isEmpty()) base = "Culto"
        if (base.length > 114) base = base.take(114).trim()
        return "$base.avpkg"
    }

    /** O arquivo da página `pagina` (1-based) da capa. */
    fun nomeDaCapa(pagina: Int): String = "capa-$pagina.png"

    fun paginaValida(pagina: Int): Boolean = pagina in 1..CAPAS_MAX

    /** Com capa, a MISTURA (`*` + `/` + `*`); sem, o tipo genérico de um arquivo. */
    fun tipoDoEnvio(capas: Int): String = if (capas > 0) "*/*" else MIME_GENERICO

    /** O `.avpkg` da pasta do culto? (`path` da URI do provedor: `/pacote/culto/<nome>.avpkg`.) */
    fun ehPacoteDoCulto(path: String?): Boolean {
        val p = path ?: return false
        return p.contains("/$PASTA/") && p.endsWith(".avpkg", ignoreCase = true)
    }

    /**
     * Os bytes de uma capa vindos do web em base64, ou `null` quando não decodificam ou não são
     * PNG. NADA é recomprimido: o que entra é o que o `AVCapa` desenhou.
     */
    fun bytesDaCapa(base64: String): ByteArray? {
        val b = try {
            java.util.Base64.getDecoder().decode(base64.trim())
        } catch (_: IllegalArgumentException) {
            return null
        }
        return if (ehPng(b)) b else null
    }

    fun ehPng(b: ByteArray): Boolean =
        b.size > PNG.size && PNG.indices.all { b[it] == PNG[it] }
}
