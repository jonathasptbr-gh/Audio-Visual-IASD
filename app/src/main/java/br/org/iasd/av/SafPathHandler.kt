package br.org.iasd.av

import android.content.Context
import android.net.Uri
import android.util.Base64
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import androidx.webkit.WebViewAssetLoader
import java.security.SecureRandom
import java.util.concurrent.ConcurrentHashMap

/**
 * Registro de URIs do Storage Access Framework expostas ao lado web.
 *
 * PRINCÍPIO DA PONTE: entregamos ao JavaScript **URLs servíveis**, nunca
 * bytes. O lado web continua usando `fetch()` + `Blob` exatamente como já faz
 * com o OPFS — nenhuma função de importação precisou ser reescrita, e um
 * vídeo de 2 GB nunca passa por base64.
 *
 * O token é opaco (e não o próprio URI codificado) porque o `PathHandler`
 * recebe o caminho JÁ decodificado: um `content://` com barras viraria
 * segmentos de caminho e quebraria o roteamento. Ele é **aleatório**, e não um
 * contador: um contador é adivinhável por construção, e as entradas nunca
 * expiram (ver abaixo) — não custa nada não deixar `/saf/1..N` enumerável.
 *
 * TEMPO DE VIDA: as entradas vivem até o processo morrer; não há remoção. É
 * por isso que o reaproveitamento por URI importa de verdade — sem ele, cada
 * `listFolder` de uma pasta de 500 arquivos acrescentava 500 entradas novas
 * para os MESMOS arquivos, a cada re-sincronização, num processo que é mantido
 * vivo de propósito durante todo o culto.
 */
object SafRegistry {
    private val byToken = ConcurrentHashMap<String, Uri>()
    private val byUri = ConcurrentHashMap<Uri, String>()
    private val rnd = SecureRandom()

    /**
     * Registra (ou reaproveita) um URI e devolve a URL servível pelo loader.
     *
     * "Reaproveita" é literal: o mesmo URI devolve sempre o mesmo token. O
     * `putIfAbsent` resolve a corrida entre duas listagens simultâneas — quem
     * perde descarta o token que cunhou (ele nunca chegou a ser registrado em
     * [byToken], então não vira lixo servível).
     */
    fun urlFor(uri: Uri): String {
        val token = byUri[uri] ?: run {
            val fresh = newToken()
            val prev = byUri.putIfAbsent(uri, fresh)
            if (prev == null) {
                byToken[fresh] = uri
                fresh
            } else {
                prev
            }
        }
        return "${WebViewFactory.ORIGIN}/saf/$token"
    }

    fun get(token: String): Uri? = byToken[token]

    /**
     * 128 bits em base64url — sem `/` nem `=`, para caber num segmento de
     * caminho sem escapar nada (o `PathHandler` recebe o caminho decodificado).
     */
    private fun newToken(): String {
        val b = ByteArray(16)
        rnd.nextBytes(b)
        return Base64.encodeToString(b, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
    }
}

/** Serve os bytes de um documento do SAF em streaming, sob `/saf/<token>`. */
class SafPathHandler(private val ctx: Context) : WebViewAssetLoader.PathHandler {

    override fun handle(path: String): WebResourceResponse? {
        val token = path.trim('/')
        if (token.isEmpty()) return WebViewFactory.notFound()
        val uri = SafRegistry.get(token) ?: return WebViewFactory.notFound()
        return try {
            val mime = ctx.contentResolver.getType(uri) ?: "application/octet-stream"
            val stream = ctx.contentResolver.openInputStream(uri)
                ?: return WebViewFactory.notFound()
            WebResourceResponse(
                mime,
                null,
                200,
                "OK",
                // Os bytes são copiados uma única vez para o OPFS; não há
                // motivo para o WebView guardar uma segunda cópia em cache.
                mapOf("Cache-Control" to "no-store"),
                stream,
            )
        } catch (_: Exception) {
            // Arquivo removido/movido no dispositivo depois de listado, ou
            // permissão revogada: o lado web trata como falha de leitura e
            // simplesmente pula o arquivo, como já faz no fluxo do OPFS.
            WebViewFactory.notFound()
        }
    }
}

/**
 * UMA JANELA DE BYTES SOBRE UM DOCUMENTO DO SAF — `/saf/<token>?r=<ini>-<fim>`.
 *
 * ===== POR QUE ELA EXISTE (shell 64) =====
 *
 * Relato do operador: *"Não estou conseguindo importar os dados, 'failed to
 * fetch' era um arquivo de 15GB. Tentei em um arquivo de 3,52GB e ele deu erro
 * como se o arquivo estivesse corrompido."*
 *
 * São DOIS defeitos, e o segundo é desta camada:
 *
 * 1. o lado web fazia `resp.blob()` — o arquivo INTEIRO materializado antes do
 *    primeiro byte ser lido. Quinze gigabytes não cabem em lugar nenhum, e o
 *    desfecho é o `Failed to fetch` do relato;
 * 2. **o [SafPathHandler] tem teto de 2 GB, e ele é estrutural.** O Chromium
 *    dimensiona toda resposta interceptada pelo `available()` do `InputStream`
 *    (é ele que vira o `Content-Length` — ver a invariante 8 e o KDoc do
 *    [StreamProxy]), e `InputStream.available()` devolve `int`. Acima de
 *    `Integer.MAX_VALUE` não há número a devolver: o que o web recebe é um
 *    arquivo CORTADO, sem erro nenhum, e o cursor do pacote tropeça no meio de
 *    um registro. É o segundo relato.
 *
 * ===== A FORMA É A DO `StreamProxy`, E PELO MESMO MOTIVO =====
 *
 * A faixa vai na QUERY e **nunca num cabeçalho `Range`**: com o cabeçalho, o
 * `ParseRange` do WebView aplicaria o deslocamento uma SEGUNDA vez sobre o que
 * já é uma fatia — a armadilha que a invariante 8 descreve inteira. Sem
 * cabeçalho não há `ParseRange`, não há `Seek` e não há `ComputeBounds`: a
 * resposta é um **200 seco** com exatamente os bytes pedidos, e o `available()`
 * do array é o tamanho da JANELA, não o do arquivo. O teto de 2 GB deixa de
 * existir porque nenhuma resposta chega perto dele.
 *
 * **E ela É SEEK, não `skip`.** `openFileDescriptor` + `FileChannel.position`
 * salta em O(1); pular quatorze gigabytes com `skip()` LÊ os quatorze, e a
 * importação ficaria quadrática. O `skip` continua como plano B para o
 * provedor que não devolve um descritor posicionável (nuvem, pipe) — ali ele é
 * lento e correto, que é melhor que rápido e ausente.
 *
 * **SÓ ONDE O `/saf/` EXISTE.** Ela é montada apenas no WebView que recebeu o
 * handler `/saf/` (invariante 9): sem isso, um script no documento do telão
 * leria qualquer arquivo já concedido, que é exatamente o que aquela
 * invariante existe para impedir.
 */
object SafJanela {

    /** O maior pedaço que uma janela entrega. Trava, não economia — ver o teto
     *  do [StreamProxy]: sem ele um erro de conta faz o processo que hospeda os
     *  dois WebViews tentar segurar um arquivo inteiro. */
    private const val TETO_JANELA = 24L * 1024 * 1024

    private val FAIXA = Regex("""^(\d{1,15})-(\d{1,15})$""")

    fun tryHandle(ctx: Context, request: WebResourceRequest): WebResourceResponse? {
        val u = request.url
        if (u.scheme != "https" || u.host != WebViewFactory.ORIGIN_HOST) return null
        val path = u.path ?: return null
        if (!path.startsWith("/saf/")) return null
        // SEM `r=` não é conosco: o caminho de sempre (o arquivo inteiro) segue
        // pelo [SafPathHandler], e é ele que serve toda importação de mídia.
        //
        // `getQueryParameter` e não uma busca no texto da query: um `find` sobre
        // a string casaria `r=` no meio de OUTRO parâmetro, e o que sairia daí
        // seria uma faixa lida de onde ninguém a escreveu.
        val r = try { u.getQueryParameter("r") } catch (_: Exception) { null } ?: return null
        val m = FAIXA.find(r) ?: return erro(416, "faixa malformada")
        val ini = m.groupValues[1].toLongOrNull() ?: return erro(416, "faixa malformada")
        val fim = m.groupValues[2].toLongOrNull() ?: return erro(416, "faixa malformada")
        if (fim < ini) return erro(416, "faixa invertida")
        val n = fim - ini + 1
        if (n > TETO_JANELA) return erro(416, "janela acima de 24 MB")

        val token = path.removePrefix("/saf/").trim('/')
        val uri = SafRegistry.get(token) ?: return erro(404, "token desconhecido")
        return try {
            val bytes = ler(ctx, uri, ini, n.toInt())
            WebResourceResponse(
                "application/octet-stream",
                null,
                200,
                "OK",
                // Nada aqui é reaproveitável: cada janela é pedida uma vez, na
                // ordem, e guardá-las seria uma segunda cópia do arquivo.
                mapOf("Cache-Control" to "no-store"),
                java.io.ByteArrayInputStream(bytes),
            )
        } catch (e: Exception) {
            erro(500, redigir(e))
        }
    }

    /**
     * Os bytes de `[ini, ini+n)`. Devolve MENOS que `n` só no fim do arquivo —
     * quem confere se sobrou é o chamador, pelo tamanho que o `pickDoc` deu.
     *
     * O laço existe porque `read` **não promete encher o array**: um `read`
     * curto sobre um `content://` é normal, e tratá-lo como fim de arquivo
     * entregaria uma janela com um buraco no meio — a corrupção silenciosa que
     * este arquivo inteiro existe para não ter.
     */
    private fun ler(ctx: Context, uri: Uri, ini: Long, n: Int): ByteArray {
        val buf = ByteArray(n)
        var lidos = 0
        posicionar(ctx, uri, ini).use { entrada ->
            while (lidos < n) {
                val r = entrada.read(buf, lidos, n - lidos)
                if (r <= 0) break
                lidos += r
            }
        }
        return if (lidos == n) buf else buf.copyOf(lidos)
    }

    /**
     * Um stream já posicionado em `ini`. Seek de verdade quando o provedor
     * devolve um descritor; `skip` quando não devolve.
     *
     * `AutoCloseInputStream` E NÃO `FileInputStream(pfd.fileDescriptor)`: o
     * segundo NÃO É DONO do descritor, então fechar o stream deixaria o `pfd`
     * aberto — um vazamento de descritor por janela, e são milhares por
     * importação. O `AutoClose` fecha os dois.
     */
    private fun posicionar(ctx: Context, uri: Uri, ini: Long): java.io.InputStream {
        if (ini > 0) {
            var pfd: android.os.ParcelFileDescriptor? = null
            try {
                pfd = ctx.contentResolver.openFileDescriptor(uri, "r")
                if (pfd != null) {
                    val fis = android.os.ParcelFileDescriptor.AutoCloseInputStream(pfd)
                    fis.channel.position(ini)
                    return fis
                }
            } catch (_: Exception) {
                // Provedor sem descritor posicionável (nuvem, pipe): o `skip`
                // abaixo continua correto, só lento. Fechar aqui é obrigatório
                // — a exceção pode ter vindo DEPOIS do `open`.
                try { pfd?.close() } catch (_: Exception) {}
            }
        }
        val s = ctx.contentResolver.openInputStream(uri)
            ?: throw java.io.IOException("documento nao abre")
        var falta = ini
        while (falta > 0) {
            val p = s.skip(falta)
            if (p <= 0) throw java.io.IOException("nao deu para posicionar em $ini")
            falta -= p
        }
        return s
    }

    private fun redigir(e: Throwable): String =
        (e.message ?: e.javaClass.simpleName)
            .map { if (it.code in 0x20..0x7e) it else '?' }.joinToString("").take(120)

    /** CORPO NÃO VAZIO, pela mesma razão do [StreamProxy]: uma resposta de erro
     *  sem corpo pode nem chegar, e um erro que não chega é erro nenhum. */
    private fun erro(codigo: Int, razao: String): WebResourceResponse {
        val texto = razao.ifBlank { "erro" }
        val corpo = texto.toByteArray(Charsets.US_ASCII)
        return WebResourceResponse(
            "text/plain", "utf-8", codigo, texto,
            mapOf("Cache-Control" to "no-store"),
            java.io.ByteArrayInputStream(corpo),
        )
    }
}
