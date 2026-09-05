package br.org.iasd.av

import android.util.Log
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import java.io.ByteArrayInputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL

/**
 * QUEM CLONA — o lado de DESTINO do clone celular a celular.
 *
 * ===== POR QUE ELE EXISTE: CONTEÚDO MISTO =====
 *
 * A página do Controle roda em `https://appassets.androidplatform.net/`
 * (invariante 1 — é o contexto seguro que faz OPFS e IndexedDB existirem), e o
 * celular que cede serve em `http://192.168.x.y:<porta>/`. **Um `fetch()` de
 * `http://` a partir de uma página `https://` é bloqueado pelo navegador,
 * sempre**, e não há cabeçalho que o autorize: subir o outro lado em TLS
 * exigiria um certificado que aquele aparelho não tem (o [EspelhoCert] pede um
 * `.p12` importado à mão).
 *
 * Então o shell do DESTINO repassa: `…/clone/<resto>` sai daqui como
 * `http://<host>:<porta>/acervo/<resto>`, com a credencial. O molde é o
 * [StreamProxy] — o mesmo problema (um recurso de fora servido pelo NOSSO
 * origin), a mesma armadilha.
 *
 * ===== A INVARIANTE 8, OUTRA VEZ =====
 *
 * O `InputStream` devolvido por um `shouldInterceptRequest` é o **recurso
 * inteiro a partir do byte 0**: quem aplica o `Range` é o próprio WebView, por
 * cima do que o app entregou. Devolver a fatia pedida sob um cabeçalho `Range`
 * aplicaria o deslocamento DUAS vezes.
 *
 * Daí a faixa viajar na QUERY (`?r=<ini>-<fim>`) e a resposta ser um **200
 * seco**: sem `Range` no pedido não há o que o WebView reaplique. Um cabeçalho
 * `Range` de verdade é RECUSADO com 400 — em voz alta, porque atender seria
 * entregar bytes deslocados sem erro em lugar nenhum.
 *
 * ===== O ALVO NÃO VIAJA NA URL =====
 *
 * Host, porta e token ficam AQUI, escritos pelo pareamento, exatamente como o
 * [StreamProxy] guarda a URL do googlevideo. A página pede `/clone/indice` e
 * `/clone/item/<sessao>/<n>` e não tem como apontar o proxy para outro
 * endereço — se o alvo viesse por parâmetro, qualquer script carregado neste
 * origin ganharia um proxy de saída para a rede local.
 */
object AcervoProxy {

    private const val TAG = "AcervoProxy"

    const val ROTA = "/clone/"

    private const val CONECTA_MS = 10_000
    // GENEROSO DE PROPÓSITO: o primeiro pedido de um item paga o empurrão
    // INTEIRO dele do outro lado (o Controle de lá lê o arquivo do OPFS e o
    // atravessa pelo canal, com ack por bloco). Um item de 380 MB leva dezenas
    // de segundos, e um prazo curto aqui derrubaria a cópia exatamente nos
    // arquivos que mais custam a refazer. Os pedidos seguintes do mesmo item
    // batem no cache e voltam na hora.
    private const val LE_MS = 240_000

    /** O mesmo teto do [StreamProxy]: o corpo é lido inteiro em memória, e é o
     *  lado web que fatia. */
    private const val TETO_PEDACO = 24 * 1024 * 1024

    @Volatile private var host: String = ""
    @Volatile private var porta: Int = 0
    @Volatile private var token: String = ""

    /** A última resposta que o proxy recebeu, para a linha do Registro. */
    @Volatile var diario: String = "sem uso"
        private set

    fun apontar(hostNovo: String, portaNova: Int, tokenNovo: String) {
        host = hostNovo
        porta = portaNova
        token = tokenNovo
        diario = "apontado para $hostNovo:$portaNova"
    }

    fun soltar() {
        host = ""; porta = 0; token = ""
        diario = "sem uso"
    }

    val apontado: Boolean get() = host.isNotEmpty() && porta > 0 && token.isNotEmpty()

    /**
     * Atende a requisição se ela for nossa; `null` deixa o asset loader seguir.
     *
     * **BLOQUEANTE** — roda na thread de carregamento de recursos do WebView.
     */
    fun tryHandle(request: WebResourceRequest): WebResourceResponse? {
        val u = request.url
        // Pelo COMPONENTE do Uri, nunca por prefixo de string (invariante 2).
        if (u.scheme != "https" || u.host != WebViewFactory.ORIGIN_HOST) return null
        val caminho = u.path ?: return null
        if (!caminho.startsWith(ROTA)) return null

        val cabecalho = request.requestHeaders?.entries
            ?.firstOrNull { it.key.equals("Range", true) }?.value
        if (!cabecalho.isNullOrBlank()) {
            // 400 EM VOZ ALTA. Ver a invariante 8 no KDoc: o WebView reaplicaria
            // o deslocamento sobre a fatia, e o desfecho seriam bytes errados
            // gravados no acervo sem nada dizendo por quê.
            return erro(400, "use ?r= e nunca o cabecalho Range")
        }
        if (!apontado) return erro(409, "nenhum aparelho pareado")

        val resto = caminho.removePrefix(ROTA)
        if (resto.isEmpty() || resto.contains("..")) return erro(404, "rota invalida")
        val faixa = try { u.getQueryParameter("r") } catch (e: Exception) { null }
        val par = faixa?.let { faixaDaQuery(it) ?: return erro(400, "faixa invalida: $it") }

        val alvo = "http://" + host + ":" + porta + "/acervo/" + resto
        return try {
            buscar(alvo, par)
        } catch (e: Throwable) {
            // `Throwable` e não `Exception`, pela razão do [StreamProxy]: um
            // `Error` escaparia pela thread de recursos e chegaria ao web como
            // mais um "Failed to fetch" sem status.
            Log.w(TAG, "falhou buscando $resto", e)
            diario = "falha: " + redigir(e)
            erro(502, redigir(e))
        }
    }

    private fun buscar(alvo: String, par: Pair<Long, Long>?): WebResourceResponse {
        val conn = (URL(alvo).openConnection() as HttpURLConnection).apply {
            connectTimeout = CONECTA_MS
            readTimeout = LE_MS
            instanceFollowRedirects = false
            setRequestProperty("Authorization", "Bearer $token")
            // O `Host` que o outro lado exige é o IP:porta que ele mesmo
            // anunciou — a allowlist de `Host` do [EspelhoServidor] é EXATA, e
            // deixar o `HttpURLConnection` montá-lo sozinho é o que produz o
            // valor certo. Não sobrescrever é a escolha, e ela está dita.
            if (par != null) setRequestProperty("Range", "bytes=${par.first}-${par.second}")
        }
        try {
            val codigo = conn.responseCode
            if (codigo >= 400) {
                // O CÓDIGO DO OUTRO CELULAR É REPASSADO COMO ESTÁ, e o lado web
                // decide: 409 é o índice remontado (busca o índice de novo e
                // continua), 503 é o Controle de lá não ter respondido
                // (tenta de novo), 404 é a credencial (o pareamento caiu).
                // Achatar os três em "não achei" apagaria a única informação
                // que separa "insista" de "comece de novo".
                diario = "HTTP $codigo em $alvo"
                return erro(codigo, corpoDeErro(conn) ?: ("HTTP " + codigo))
            }
            val faixaRespondida = conn.getHeaderField("Content-Range")
            // O OUTRO LADO PRECISA TER HONRADO A FAIXA. Um 200 com o recurso
            // INTEIRO no lugar da fatia é a corrupção silenciosa do
            // [StreamProxy]: o web appendaria bytes que não são os pedidos.
            // A conferência vem ANTES da leitura — deixar o recurso inteiro
            // entrar no `readBytes` sairia como "pedaço acima de 24 MB",
            // mensagem verdadeira sobre o defeito errado.
            if (par != null && codigo != 206 && inicioDoContentRange(faixaRespondida) != par.first) {
                return erro(502, "faixa ignorada pelo outro aparelho (HTTP $codigo)")
            }
            val mime = conn.contentType?.substringBefore(';')?.trim().orEmpty()
                .ifEmpty { "application/octet-stream" }
            val corpo = conn.inputStream.use { ler(it, TETO_PEDACO) }
            diario = "HTTP $codigo, ${corpo.size} byte(s)"
            return WebResourceResponse(
                mime,
                null,
                200,
                "OK",
                mapOf(
                    "Cache-Control" to "no-store",
                    // O TAMANHO TOTAL do item, quando o outro lado o disse. É
                    // por ele que o web sabe quantos pedaços pedir sem
                    // adivinhar — e `Content-Length` não serve: aqui ele é o da
                    // FATIA.
                    "X-Av-Total" to (totalDoContentRange(faixaRespondida)?.toString() ?: ""),
                ),
                ByteArrayInputStream(corpo),
            )
        } finally {
            conn.disconnect()
        }
    }

    /** O corpo de uma resposta de erro, para a frase chegar ao lado web. */
    private fun corpoDeErro(conn: HttpURLConnection): String? = try {
        conn.errorStream?.use { String(ler(it, 4096), Charsets.UTF_8) }?.takeIf { it.isNotBlank() }
    } catch (e: Exception) {
        null
    }

    private fun erro(codigo: Int, razao: String): WebResourceResponse {
        val texto = ascii(razao).ifBlank { "erro" }
        // CORPO NÃO VAZIO pela razão do [StreamProxy]: `available() == 0` faz o
        // `ComputeBounds` do WebView reprovar e a resposta inteira vira erro de
        // rede SEM STATUS — um erro que não chega é igual a erro nenhum.
        return WebResourceResponse(
            "text/plain",
            "utf-8",
            codigo,
            texto,
            mapOf("Cache-Control" to "no-store"),
            ByteArrayInputStream(texto.toByteArray(Charsets.US_ASCII)),
        )
    }

    private fun faixaDaQuery(r: String): Pair<Long, Long>? {
        val m = FAIXA.matchEntire(r.trim()) ?: return null
        val ini = m.groupValues[1].toLongOrNull() ?: return null
        val fim = m.groupValues[2].toLongOrNull() ?: return null
        if (fim < ini) return null
        if (fim - ini + 1 > TETO_PEDACO) return null
        return ini to fim
    }

    private val FAIXA = Regex("""^(\d{1,15})-(\d{1,15})$""")

    /** O primeiro byte de um `Content-Range: bytes A-B/T`; -1 quando ausente —
     *  nunca 0, que é um começo LEGÍTIMO e não pode nascer da falta do
     *  cabeçalho. */
    private fun inicioDoContentRange(cr: String?): Long =
        Regex("""bytes\s+(\d+)-""").find(cr ?: "")?.groupValues?.get(1)?.toLongOrNull() ?: -1

    /** O `T` de um `Content-Range: bytes A-B/T`. `*` (tamanho desconhecido,
     *  que é o item ainda em crescimento do outro lado) devolve `null`. */
    private fun totalDoContentRange(cr: String?): Long? =
        Regex("""/(\d+)\s*$""").find(cr ?: "")?.groupValues?.get(1)?.toLongOrNull()

    private fun redigir(e: Throwable): String =
        ascii((e.javaClass.simpleName + ": " + (e.message ?: "")).trim())

    private fun ascii(s: String): String =
        s.map { if (it.code in 32..126) it else '?' }.joinToString("").take(200)

    /** Lê no máximo [limite] bytes, e RECUSA o que passar dele — um corpo
     *  maior que o pedaço combinado é o outro lado tendo ignorado a faixa. */
    private fun ler(entrada: InputStream, limite: Int): ByteArray {
        val saida = java.io.ByteArrayOutputStream()
        val buf = ByteArray(64 * 1024)
        while (true) {
            val n = entrada.read(buf)
            if (n < 0) break
            if (saida.size() + n > limite) throw java.io.IOException("resposta acima de $limite bytes")
            saida.write(buf, 0, n)
        }
        return saida.toByteArray()
    }
}
