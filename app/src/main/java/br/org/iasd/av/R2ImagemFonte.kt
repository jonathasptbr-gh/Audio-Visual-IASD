package br.org.iasd.av

import android.util.Log
import android.util.Base64
import android.webkit.WebResourceResponse
import androidx.webkit.WebViewAssetLoader
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.security.SecureRandom
import java.util.concurrent.ConcurrentHashMap

/**
 * A FOTO DE FUNDO NUM BUCKET R2 QUE NÃO MANDA CORS — a metade de TRANSPORTE.
 *
 * ## O defeito, medido em Registro de operador
 *
 * O Hinário Adventista 2022 serve as fotos de fundo da letra por um bucket
 * Cloudflare R2 à parte, pinado em `Louvorja.CDN_HOSTS_CONHECIDOS` desde a
 * v1.10.9. `fetch()` daquele host, de dentro do WebView, falhava SEMPRE
 * (`TypeError: Failed to fetch`) — inclusive minutos depois da abertura,
 * inclusive numa sonda ISOLADA sem nenhuma outra rede em curso (a checagem
 * "O servidor entrega as imagens de fundo" da Verificação, v1.11.2). O
 * operador confirmou, a pedido, que a MESMA URL abre normalmente colada na
 * barra de endereços de um navegador comum, no mesmo aparelho e na mesma rede.
 *
 * A explicação que fecha os dois fatos: uma navegação de topo NUNCA passa
 * pela checagem de CORS — ela existe só para decidir se o CORPO de uma
 * resposta a um `fetch()`/XHR cross-origin pode ser exposto ao script que o
 * pediu. Um bucket R2 público (`pub-*.r2.dev`) não manda
 * `Access-Control-Allow-Origin` a menos que uma política de CORS seja
 * configurada explicitamente nele — e sem ela, TODO `fetch()` cross-origin
 * (com ou sem cabeçalhos extras) é bloqueado pelo próprio navegador antes de
 * o corpo chegar ao JS, indistinguível de uma falha de rede de verdade. O
 * operador não tem contato com quem administra aquele bucket.
 *
 * ## Por que a resposta é a MESMA do `CifraFonte`
 *
 * CORS é uma restrição do NAVEGADOR — não existe em requisições HTTP feitas
 * por código nativo Android. `StreamProxy.kt` já documentou a MESMA classe de
 * defeito para o googlevideo (que também não manda CORS): a saída de lá foi
 * um proxy nativo que serve os bytes pelo PRÓPRIO origin do app, eliminando o
 * cross-origin em vez de tentar convencer o navegador a liberá-lo. Este
 * arquivo faz a metade do `CifraFonte` (GET travado por host, sem parse); o
 * `R2ImagemRegistry`/`R2ImagemPathHandler` abaixo fazem a metade do
 * `SafPathHandler` (bytes expostos por uma URL do próprio origin, nunca por
 * base64 na ponte — ver o KDoc dele: *"a ponte entrega URLs SERVÍVEIS, não
 * bytes"*). Uma imagem cabe no espaço que um vídeo de 2 GB não caberia, mas o
 * PRINCÍPIO é o mesmo: nada de bytes brutos atravessando `evaluateJavascript`.
 *
 * ## As guardas, e por que cada uma
 *
 *  - **Host travado por COMPONENTE do `URI`** ([HOSTS_PERMITIDOS]), nunca por
 *    prefixo — a mesma invariante 2 do shell, e a mesma razão do
 *    `CifraFonte`: sem ela, este método é um proxy HTTP de uso geral pendurado
 *    num WebView privilegiado.
 *  - **`https` obrigatório**, e **redirecionamentos DESLIGADOS**
 *    (`instanceFollowRedirects = false`) — ao contrário do `CifraFonte`. Um
 *    bucket que redirecionasse para outro host faria o `HttpURLConnection`
 *    segui-lo sem revalidar a allowlist; aqui não há motivo NENHUM para um
 *    bucket estático de imagens redirecionar, e desligar é mais barato que
 *    validar o destino final.
 *  - **Teto de bytes** ([MAX_BYTES]) — uma foto de fundo vive na casa das
 *    centenas de kB (a mesma régua de `PAGINA_LEVE` do `controle/deck.js`); um
 *    bucket comprometido ou mal configurado devolvendo um arquivo enorme não
 *    pode encher a memória de um processo que já divide espaço com dois
 *    WebViews e um vídeo.
 *  - **Prazos curtos** ([TEMPO_MS]), bem abaixo do `CALL_TIMEOUT_MS` (60 s) do
 *    lado web — o pior caso (connect + read) tem de caber folgado, senão a
 *    varredura automática mente "não respondeu" quando o certo seria só mais
 *    lento.
 *
 * Nada aqui persiste em disco: os bytes vivem só no [R2ImagemRegistry], em
 * memória, e são descartados assim que servidos uma vez — quem grava em OPFS
 * é o `controle.js`, do outro lado do `fetch()` que lê `/r2img/<token>`.
 */
object R2ImagemFonte {
    private const val TAG = "R2ImagemFonte"

    /**
     * Os hosts que este método aceita — hoje só o bucket pinado das fotos do
     * Hinário Adventista 2022 (v1.10.9). Acrescentar um host aqui é acrescentar
     * superfície de rede ao app; a origem que publica as músicas
     * (`api.louvorja.com.br`) já manda CORS de verdade e NÃO precisa passar por
     * aqui — só o bucket sem CORS precisa deste desvio.
     */
    private val HOSTS_PERMITIDOS = setOf(
        "pub-8c0e123c55a14cdfa0c52fa182688782.r2.dev",
    )

    /** Conexão e leitura. Bem abaixo do `CALL_TIMEOUT_MS` (60 s) do lado web. */
    private const val TEMPO_MS = 15000

    /** Teto do corpo lido. Uma foto de fundo vive na casa das centenas de kB. */
    private const val MAX_BYTES = 8 * 1024 * 1024

    /**
     * A última tentativa, em texto — mesmo papel do `CifraFonte.ultimaTentativa`,
     * escrita só por [buscar] (sem segundo escritor, sem trava).
     */
    @Volatile
    var ultimaTentativa: String = ""
        private set

    /**
     * `https` + host na allowlist, por COMPONENTE do `URI` — nunca por
     * prefixo/sufixo de string (a invariante 2 do shell). PURA e sem import de
     * Android, de propósito: é a única metade deste arquivo testável sem
     * mockar `android.util.Log` ou abrir um socket de verdade, e é a que mais
     * importa provar — falhar aberto aqui é este método virar um proxy HTTP de
     * uso geral pendurado num WebView privilegiado. Ver `R2ImagemFonteTest`.
     */
    internal fun hostPermitido(url: String): Boolean {
        val alvo = try { URI(url) } catch (_: Exception) { null }
        val host = alvo?.host ?: ""
        return alvo?.scheme == "https" && host in HOSTS_PERMITIDOS
    }

    /**
     * `GET url`, host travado, e devolve `(status, bytes, mime)`.
     *
     * `status 0` é "não houve resposta" (sem rede, DNS, host recusado, prazo
     * vencido); qualquer outro status é resposta de verdade — a mesma
     * distinção do `CifraFonte.buscar`, e pelo mesmo motivo: as duas causas
     * pedem frases opostas do lado web. Nunca lança.
     */
    fun buscar(url: String): Triple<Int, ByteArray?, String?> {
        if (!hostPermitido(url)) {
            ultimaTentativa = "destino não permitido ($url)"
            Log.w(TAG, ultimaTentativa)
            return Triple(0, null, null)
        }

        var c: HttpURLConnection? = null
        return try {
            c = (URL(url).openConnection() as HttpURLConnection).apply {
                connectTimeout = TEMPO_MS
                readTimeout = TEMPO_MS
                instanceFollowRedirects = false
                requestMethod = "GET"
                setRequestProperty("User-Agent", "AudioVisualIASD")
                setRequestProperty("Accept", "image/*")
            }
            val status = c.responseCode
            if (status !in 200..299) {
                ultimaTentativa = "HTTP $status em $url"
                return Triple(status, null, null)
            }
            val corpo = lerAteOTeto(c)
            val mime = c.contentType?.substringBefore(';')?.trim()?.ifBlank { null }
                ?: adivinharMime(url)
            ultimaTentativa = "HTTP $status, ${corpo.size} byte(s) em $url"
            Triple(status, corpo, mime)
        } catch (e: Exception) {
            ultimaTentativa = "falhou (${e.javaClass.simpleName}) em $url"
            Log.i(TAG, ultimaTentativa)
            Triple(0, null, null)
        } finally {
            try { c?.disconnect() } catch (_: Exception) { /* já fechada */ }
        }
    }

    /**
     * Lê o corpo respeitando [MAX_BYTES]. O `Content-Length` NÃO é a régua —
     * opcional, mentível e ausente em `chunked` — quem para é o laço.
     */
    private fun lerAteOTeto(c: HttpURLConnection): ByteArray {
        val saida = ByteArrayOutputStream()
        val bloco = ByteArray(64 * 1024)
        c.inputStream.use { entrada ->
            while (true) {
                val n = entrada.read(bloco)
                if (n <= 0) break
                saida.write(bloco, 0, n)
                if (saida.size() >= MAX_BYTES) break
            }
        }
        return saida.toByteArray()
    }

    /** Só quando o servidor não manda `Content-Type` — extensão do caminho. */
    private fun adivinharMime(url: String): String {
        val semQuery = url.substringBefore('?').substringBefore('#')
        val ext = semQuery.substringAfterLast('.', "").lowercase()
        return when (ext) {
            "png" -> "image/png"
            "webp" -> "image/webp"
            "gif" -> "image/gif"
            else -> "image/jpeg"
        }
    }
}

/**
 * Registro EFÊMERO de imagens já baixadas por [R2ImagemFonte] — a metade
 * "URL servível" do princípio da ponte, para o mesmo host que não manda CORS.
 *
 * DIFERENÇA DELIBERADA CONTRA O `SafRegistry`: aquele guarda um `Uri` do SAF
 * para SEMPRE (o documento pode ser relido a qualquer momento, por
 * `listFolder`/`syncDeviceFolder`); este guarda os BYTES JÁ BAIXADOS de uma
 * imagem que só existe para ser lida UMA vez, imediatamente — então cada
 * token é consumido e REMOVIDO no primeiro `take()`. Sem o descarte, uma
 * varredura de centenas de fotos acumularia todas em memória até o processo
 * morrer, no mesmo processo que já divide espaço com dois WebViews e um
 * vídeo grande.
 */
object R2ImagemRegistry {
    private val porToken = ConcurrentHashMap<String, Pair<ByteArray, String>>()
    private val rnd = SecureRandom()

    /** Registra os bytes e devolve a URL servível pelo loader do Controle. */
    fun store(bytes: ByteArray, mime: String): String {
        val token = newToken()
        porToken[token] = bytes to mime
        return "${WebViewFactory.ORIGIN}/r2img/$token"
    }

    /** Consome UMA vez — a entrada não sobrevive a esta chamada. */
    fun take(token: String): Pair<ByteArray, String>? = porToken.remove(token)

    /** 128 bits em base64url, como o [SafRegistry] — opaco e não adivinhável. */
    private fun newToken(): String {
        val b = ByteArray(16)
        rnd.nextBytes(b)
        return Base64.encodeToString(b, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
    }
}

/** Serve os bytes de UMA imagem já baixada, sob `/r2img/<token>`. */
class R2ImagemPathHandler : WebViewAssetLoader.PathHandler {

    override fun handle(path: String): WebResourceResponse? {
        val token = path.trim('/')
        if (token.isEmpty()) return WebViewFactory.notFound()
        val (bytes, mime) = R2ImagemRegistry.take(token) ?: return WebViewFactory.notFound()
        return WebResourceResponse(
            mime,
            null,
            200,
            "OK",
            // Consumido uma vez só: guardar em cache não economizaria nada e
            // um segundo pedido para o MESMO token já não acha o registro.
            mapOf("Cache-Control" to "no-store"),
            ByteArrayInputStream(bytes),
        )
    }
}
