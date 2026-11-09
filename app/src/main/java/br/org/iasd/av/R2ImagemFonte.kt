package br.org.iasd.av

import android.util.Log
import java.util.Base64
import android.webkit.WebResourceResponse
import androidx.webkit.WebViewAssetLoader
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.security.SecureRandom

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
 * por código nativo Android. A transmissão direta (v1.8.82) já documentou a
 * MESMA classe de defeito para o googlevideo (que também não manda CORS): a
 * saída de lá foi um proxy nativo que serve os bytes pelo PRÓPRIO origin do
 * app, eliminando o
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
 *    WebViews e um vídeo. E passar do teto é FALHA (`status 0`), nunca corte:
 *    a metade da imagem seguia com `200` e tipo válido e virava fundo de letra
 *    corrompido no acervo, sem uma linha que dissesse por quê.
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
            // O motivo vai para o LOG e não para um campo: não há `r2Diag` na
            // ponte (o irmão `CifraFonte` tem o dele), e um campo que só o
            // próprio arquivo escreve é código morto que parece diagnóstico.
            Log.w(TAG, "destino não permitido ($url)")
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
                Log.i(TAG, "HTTP $status em $url")
                return Triple(status, null, null)
            }
            val corpo = lerAteOTeto(c)
            val mime = c.contentType?.substringBefore(';')?.trim()?.ifBlank { null }
                ?: adivinharMime(url)
            Log.i(TAG, "HTTP $status, ${corpo.size} byte(s) em $url")
            Triple(status, corpo, mime)
        } catch (e: Exception) {
            Log.i(TAG, "falhou (${e.javaClass.simpleName}: ${e.message}) em $url")
            Triple(0, null, null)
        } finally {
            try { c?.disconnect() } catch (_: Exception) { /* já fechada */ }
        }
    }

    /**
     * Lê o corpo respeitando [MAX_BYTES]. O `Content-Length` NÃO é a régua —
     * opcional, mentível e ausente em `chunked` — quem para é o laço.
     *
     * PASSAR DO TETO É FALHA, e não um `break` (revisão K6): a imagem cortada
     * seguia com 200 e o tipo de imagem certo, era gravada no OPFS pelo
     * `controle.js` e virava um fundo de letra com a metade de baixo corrompida
     * — sem uma linha que dissesse por quê. Uma foto de fundo vive na casa das
     * centenas de kB; oito megabytes é trava, e trava que dispara tem de
     * aparecer como falha. (Nada de `image` barra asterisco AQUI dentro: dentro
     * de um comentário de bloco isso abre um comentário ANINHADO, e o arquivo
     * inteiro deixa de compilar — foi o que a K6 levou ao CI.)
     */
    private fun lerAteOTeto(c: HttpURLConnection): ByteArray {
        val saida = ByteArrayOutputStream()
        val bloco = ByteArray(64 * 1024)
        c.inputStream.use { entrada ->
            while (true) {
                val n = entrada.read(bloco)
                if (n <= 0) break
                saida.write(bloco, 0, n)
                if (saida.size() > MAX_BYTES) {
                    throw java.io.IOException(
                        "imagem acima de ${MAX_BYTES / (1024 * 1024)} MB",
                    )
                }
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
 * `listFolder`/`syncDeviceFolder`); este guarda os BYTES JÁ BAIXADOS, que são
 * caros em memória — e é por isso que ele tem TETO, e não remoção no primeiro
 * `take()`.
 *
 * **Por que não consumir** (revisão X2): o `take` removia a entrada, e o
 * primeiro pedido que falhasse por fora — o retry do Chromium, a folha de
 * fundos refeita, o `fetch` que morreu com o renderer — recebia 404 e a
 * varredura acusava a FONTE por uma imagem que ela tinha entregado. Um
 * registro é barato de manter; acusar a fonte errada manda o operador
 * procurar defeito no lugar errado.
 */
object R2ImagemRegistry {
    /** Entradas em memória. A varredura busca até SEIS fotos de uma vez; 24
     *  cobre uma folha refeita sem crescer com o tamanho do hinário. */
    private const val MAX_ENTRADAS = 24

    /** O teto que de fato manda: uma foto de fundo vive na casa das centenas de
     *  kB, e 16 MB é a trava contra um bucket que devolva o teto de 8 MB por
     *  pedido em todas as fotos. */
    private const val MAX_BYTES = 16 * 1024 * 1024

    private class Par(val bytes: ByteArray, val mime: String)

    private val porToken = LinkedHashMap<String, Par>()
    private var total = 0
    private val rnd = SecureRandom()

    /** Registra os bytes e devolve a URL servível pelo loader do Controle. */
    fun store(bytes: ByteArray, mime: String): String {
        val token = newToken()
        synchronized(porToken) {
            porToken[token] = Par(bytes, mime)
            total += bytes.size
            // DESPEJO DO MAIS ANTIGO — a inserção é a ordem de chegada — e
            // sempre sobrando UMA: o pedido que acabou de ser feito não pode
            // nascer já despejado.
            while (porToken.size > 1 && (porToken.size > MAX_ENTRADAS || total > MAX_BYTES)) {
                val velho = porToken.keys.first()
                total -= porToken.getValue(velho).bytes.size
                porToken.remove(velho)
            }
        }
        return "${WebViewFactory.ORIGIN}/r2img/$token"
    }

    /** Os bytes de um token — NÃO consome (ver o KDoc do objeto). */
    fun take(token: String): Pair<ByteArray, String>? = synchronized(porToken) {
        porToken[token]?.let { it.bytes to it.mime }
    }

    /**
     * 128 bits em base64url, como o [SafRegistry] — opaco e não adivinhável.
     *
     * `java.util.Base64` (API 26, o `minSdk` do app) e não o `android.util`:
     * aquele é o que deixa o registro testável no JVM, onde TODO método do
     * `android.jar` responde `RuntimeException: Method … not mocked` — e foi
     * assim que o JUnit novo do registro reprovou no CI antes de rodar.
     */
    private fun newToken(): String {
        val b = ByteArray(16)
        rnd.nextBytes(b)
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b)
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
            // O WebView não guarda cópia: o registro já tem os bytes, e um
            // segundo pedido do MESMO token — o retry do Chromium, a folha
            // refeita — volta aqui e acha o registro (ver o KDoc do
            // [R2ImagemRegistry]).
            mapOf("Cache-Control" to "no-store"),
            ByteArrayInputStream(bytes),
        )
    }
}
