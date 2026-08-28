package br.org.iasd.av

import java.io.File
import java.security.SecureRandom
import java.util.Base64
import java.util.concurrent.ConcurrentHashMap

/**
 * OS ARQUIVOS DO COMPUTADOR — a rota `/saf/`, e o único caminho para fora do
 * bundle.
 *
 * É o par do `SafPathHandler`/`SafRegistry` do Android, e o nome é o mesmo de
 * propósito: do lado web nada muda. **A ponte entrega URLs SERVÍVEIS, nunca
 * bytes** — um arquivo escolhido no seletor chega como
 * `http://127.0.0.1:8420/saf/…` e o `controle.js` usa `fetch()` + `Blob` como
 * já faz com o OPFS, então um vídeo de 2 GB nunca passa por base64.
 *
 * ## Ele é a fronteira, e por isso é um arquivo à parte
 *
 * O [NucleoServidor] serve o bundle e mais nada: sem este registro, **nenhum
 * arquivo do disco do operador é alcançável por HTTP**. Com ele, exatamente os
 * que o operador escolheu no seletor — nem um a mais. Toda a superfície de
 * "servir o computador para o navegador" cabe nesta classe.
 *
 * ## A INVARIANTE 9 VALE PARA ARQUIVO TAMBÉM, e ela quase se perdeu aqui
 *
 * No Android o WebView do telão é montado **sem** o handler `/saf/`
 * (`assetLoader(…, withSaf = false)`): ele não tem como buscar um, nem sabendo
 * o token. No computador as duas janelas dividem **um socket** — a porta é a
 * origem, e um segundo socket seria um segundo origin e um segundo IndexedDB.
 * Servir `/saf/<token>` puro devolveria ao Telão o que o Android lhe nega.
 *
 * Daí a URL carregar a SESSÃO: `/saf/<sessao>/<token>`, e o registro ser
 * indexado pelas duas. Como os métodos que cunham token são todos
 * privilegiados — e o [NucleoDespacho] os recusa fora do papel `controle` —,
 * **uma sessão de Telão nunca tem token nenhum**, e um caminho inventado por
 * ela não acha entrada. A defesa não é o segredo do token: é não haver o que
 * achar.
 *
 * ## As regras do token, que são as do `SafRegistry`
 *
 * - **Opaco**, não o caminho codificado: um caminho do Windows tem `\`, `:` e
 *   espaços, e vira segmento de rota, comprimento de URL e travessia.
 * - **Aleatório** (128 bits, `SecureRandom`), não um contador — as entradas não
 *   expiram, e não custa nada deixar `/saf/1..N` fora do alcance de quem
 *   enumerar.
 * - **O mesmo arquivo devolve sempre o mesmo token.** Sem isso, cada
 *   `listFolder` de uma pasta de 500 arquivos acrescentaria 500 entradas a cada
 *   re-sincronização, num processo mantido vivo durante todo o culto.
 */
object NucleoArquivos {

    private val aleatorio = SecureRandom()

    /** sessão → (caminho canônico → token) e (token → arquivo). */
    private class Cofre {
        val porCaminho = ConcurrentHashMap<String, String>()
        val porToken = ConcurrentHashMap<String, File>()
    }

    private val cofres = ConcurrentHashMap<String, Cofre>()

    /** Cunha (ou reaproveita) o token daquele arquivo, para AQUELA janela. */
    fun registrar(sessao: String, arquivo: File): String {
        val cofre = cofres.getOrPut(sessao) { Cofre() }
        val chave = try { arquivo.canonicalPath } catch (_: Exception) { arquivo.absolutePath }
        cofre.porCaminho[chave]?.let { return it }
        val b = ByteArray(16)
        aleatorio.nextBytes(b)
        val token = Base64.getUrlEncoder().withoutPadding().encodeToString(b)
        cofre.porCaminho[chave] = token
        cofre.porToken[token] = arquivo
        return token
    }

    /**
     * O arquivo daquele token, **naquela sessão**. `null` para token
     * desconhecido, sessão errada, ou arquivo que sumiu do disco entre o
     * registro e o pedido — os três dão o mesmo 404, pela disciplina do
     * espelho: a resposta não distingue "não existe" de "você não pode".
     */
    fun arquivoDe(sessao: String, token: String): File? {
        val f = cofres[sessao]?.porToken?.get(token) ?: return null
        return if (f.isFile) f else null
    }

    /** A janela fechou: o que era dela vai junto. */
    fun esquecer(sessao: String) { cofres.remove(sessao) }

    fun urlDe(base: String, sessao: String, arquivo: File): String =
        base + "/saf/" + sessao + "/" + registrar(sessao, arquivo)

    /**
     * A FORMA de um token — a mesma família do `EspelhoMidiaCache`. Conferida
     * aqui para um caminho absurdo virar 404 antes de tocar num mapa, e não
     * porque a forma autentique alguém.
     */
    fun tokenValido(t: String): Boolean =
        t.length in 16..64 &&
            t.all { it in 'a'..'z' || it in 'A'..'Z' || it in '0'..'9' || it == '_' || it == '-' }

    /**
     * O TIPO DE UM ARQUIVO DO OPERADOR, pela extensão.
     *
     * Ele é uma tabela PRÓPRIA, e não a do [NucleoRotas], porque as duas
     * respondem perguntas diferentes: aquela cobre o que existe DENTRO do
     * bundle (e fecha no `application/octet-stream` para nada inesperado ser
     * interpretado); esta cobre o que o operador importa, e o `controle.js`
     * decide o *kind* da mídia lendo exatamente este campo — um `octet-stream`
     * onde devia vir `audio/mpeg` faz um hino virar arquivo genérico.
     */
    private val TIPOS = mapOf(
        "mp3" to "audio/mpeg", "m4a" to "audio/mp4", "aac" to "audio/aac",
        "wav" to "audio/wav", "ogg" to "audio/ogg", "opus" to "audio/opus",
        "flac" to "audio/flac",
        "mp4" to "video/mp4", "m4v" to "video/mp4", "webm" to "video/webm",
        "mkv" to "video/x-matroska", "mov" to "video/quicktime", "avi" to "video/x-msvideo",
        "jpg" to "image/jpeg", "jpeg" to "image/jpeg", "png" to "image/png",
        "gif" to "image/gif", "webp" to "image/webp", "bmp" to "image/bmp",
        "svg" to "image/svg+xml",
        "pdf" to "application/pdf",
        "pptx" to "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "txt" to "text/plain; charset=utf-8",
        "json" to "application/json; charset=utf-8",
    )

    fun tipoDe(nome: String): String =
        TIPOS[NucleoRotas.extensao(nome)] ?: "application/octet-stream"

    // ---------- as respostas da ponte, já em JSON ----------

    /** O `pickFolder`: `{ id, name, uri }`. O `uri` é o CAMINHO — é ele que
     *  volta no `listFolder`, e é o que o lado web guarda entre sessões. */
    fun comoPasta(pasta: File): String =
        "{\"id\":" + NucleoPonte.aspas(pasta.absolutePath) +
            ",\"uri\":" + NucleoPonte.aspas(pasta.absolutePath) +
            ",\"name\":" + NucleoPonte.aspas(pasta.name.ifEmpty { pasta.absolutePath }) + "}"

    /** O `pickDoc`: `[{ url, name, type }]`. */
    fun comoDocumentos(base: String, sessao: String, arquivos: List<File>): String {
        val b = StringBuilder("[")
        var i = 0
        for (f in arquivos) {
            if (!f.isFile) continue
            if (i++ > 0) b.append(',')
            b.append("{\"url\":").append(NucleoPonte.aspas(urlDe(base, sessao, f)))
                .append(",\"name\":").append(NucleoPonte.aspas(f.name))
                .append(",\"type\":").append(NucleoPonte.aspas(tipoDe(f.name)))
                .append('}')
        }
        return b.append(']').toString()
    }

    /**
     * O `listFolder`: `[{ name, size, mtime, type, url }]`.
     *
     * **Não recursivo e sem diretórios**, como o `listChildren` do Android: o
     * que o lado web sincroniza é uma pasta, não uma árvore, e uma varredura
     * recursiva de "Meus Documentos" seria uma travessia autorizada pelo
     * próprio operador sem que ele soubesse.
     */
    fun listarPasta(base: String, sessao: String, pasta: File): String {
        val filhos = pasta.listFiles() ?: return "[]"
        val b = StringBuilder("[")
        var i = 0
        for (f in filhos.sortedBy { it.name.lowercase() }) {
            if (!f.isFile || f.isHidden) continue
            if (i++ > 0) b.append(',')
            b.append("{\"name\":").append(NucleoPonte.aspas(f.name))
                .append(",\"type\":").append(NucleoPonte.aspas(tipoDe(f.name)))
                .append(",\"size\":").append(f.length())
                .append(",\"mtime\":").append(f.lastModified())
                .append(",\"url\":").append(NucleoPonte.aspas(urlDe(base, sessao, f)))
                .append('}')
        }
        return b.append(']').toString()
    }
}
