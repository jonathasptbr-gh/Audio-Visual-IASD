package br.org.iasd.av

import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.WebView
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.TimeUnit

/**
 * O CANAL DE MÍDIA web→Kotlin do telão por comandos (`__avTelaMidia`, E4).
 *
 * O acervo vive no OPFS, que só o lado web lê; a rota `/m/` serve do
 * [EspelhoMidiaCache], que só o Kotlin escreve. Este canal é a ponte entre os
 * dois — o TERCEIRO uso do precedente `addWebMessageListener` de
 * `ArrayBuffer` (o `EspelhoAudio` foi o primeiro), com as três guardas dele
 * repetidas uma a uma: `allowedOriginRules` exato, `isMainFrame`, e
 * `sourceOrigin.host` conferido de novo.
 *
 * Ele é instalado no WebView do CONTROLE — o único com direito a ler o acervo
 * (invariante 9: superfície nativa é privilégio do Controle) — e reinstalado
 * a cada remontagem por morte de renderer, como o do áudio.
 *
 * ## O protocolo, e o controle de fluxo que ele embute
 *
 * | o que o JS manda | o que acontece |
 * |---|---|
 * | `{"abrir":{token,id,nome,tipo,tamanho}}` | registra no cache; responde `{"ok":true,"recebido":N,"completo":b}` — e o `recebido` é o CONTROLE DE FLUXO de retomada: um empurrão interrompido recomeça DALI, nunca do zero |
 * | `ArrayBuffer` | um bloco do item aberto; a resposta `{"r":total}` é o ACK que segura o próximo bloco — `postMessage` não tem backpressure, e sem o ack a main thread viraria fila de megabytes |
 * | `{"fim":true}` | o item vira completo (servível por Range) |
 * | `{"cancelar":true}` | o parcial sai do cache — meia mídia nunca é servível |
 *
 * Blocos de até [EspelhoMidiaCache.TETO_BLOCO] (1 MiB): o `onPostMessage` é
 * `@UiThread`, então o trabalho de verdade (escrever no arquivo) sai para uma
 * thread própria por uma fila curta — a main só enfileira e volta.
 */
class EspelhoMidiaCanal(
    private val cache: () -> EspelhoMidiaCache?,
    private val registrar: (String) -> Unit = {},
) {

    private val main = Handler(Looper.getMainLooper())
    private val fila = ArrayBlockingQueue<Trabalho>(FILA)

    @Volatile private var thread: Thread? = null
    @Volatile private var rodando = false
    @Volatile private var instalado = false

    /** O item aberto — UM por vez, como o encoder do EspelhoAudio: a fila de
     *  empurrões é serializada do lado web. */
    @Volatile private var tokenAberto: String? = null

    private class Trabalho(val bytes: ByteArray, val resposta: JavaScriptReplyProxy)

    fun instalar(web: WebView?): Boolean {
        val w = web ?: return false
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER) ||
            !WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_ARRAY_BUFFER)
        ) {
            registrar("midia: este WebView nao tem canal de ArrayBuffer — telas sem midia")
            return false
        }
        return try {
            WebViewCompat.addWebMessageListener(w, OBJETO_JS, setOf(WebViewFactory.ORIGIN), ouvinte)
            ligar()
            instalado = true
            true
        } catch (e: Exception) {
            registrar("midia: nao foi possivel abrir o canal (${e.javaClass.simpleName})")
            Log.w(TAG, "addWebMessageListener falhou", e)
            false
        }
    }

    fun soltar(web: WebView?) {
        rodando = false
        thread?.interrupt()
        thread = null
        fila.clear()
        val w = web
        if (w != null && instalado) {
            val remover = Runnable {
                try {
                    WebViewCompat.removeWebMessageListener(w, OBJETO_JS)
                } catch (e: Exception) {
                    Log.w(TAG, "removeWebMessageListener falhou", e)
                }
            }
            if (Looper.myLooper() == Looper.getMainLooper()) remover.run() else main.post(remover)
        }
        instalado = false
    }

    private fun ligar() {
        if (rodando) return
        rodando = true
        thread = Thread({ laco() }, "av-tela-midia").apply { isDaemon = true }
        thread?.start()
    }

    private val ouvinte = object : WebViewCompat.WebMessageListener {
        override fun onPostMessage(
            view: WebView,
            message: WebMessageCompat,
            sourceOrigin: Uri,
            isMainFrame: Boolean,
            replyProxy: JavaScriptReplyProxy,
        ) {
            if (!isMainFrame) return
            val host = sourceOrigin.host
            if (host != null && host != WebViewFactory.ORIGIN_HOST) return
            try {
                quandoChega(message, replyProxy)
            } catch (e: Exception) {
                Log.w(TAG, "mensagem de mídia ignorada", e)
            }
        }
    }

    private fun quandoChega(message: WebMessageCompat, resposta: JavaScriptReplyProxy) {
        val c = cache()
        if (c == null) {
            responder(resposta, JSONObject().put("ok", false).put("erro", "transmissao desligada"))
            return
        }
        if (message.type == WebMessageCompat.TYPE_ARRAY_BUFFER) {
            val bytes = message.arrayBuffer
            if (bytes.isEmpty() || bytes.size > EspelhoMidiaCache.TETO_BLOCO) return
            // A main NÃO escreve arquivo (enfileira e volta) e NÃO espera
            // (`offer` sem prazo — bloquear a main é derrubar o app inteiro).
            // Com o ack por bloco a fila nunca passa de um ou dois itens; se
            // ainda assim encher (o disco engasgou), a recusa volta como erro
            // retentável e o lado web re-envia o MESMO bloco — o controle de
            // fluxo fecha sem descartar byte nenhum.
            if (!fila.offer(Trabalho(bytes, resposta))) {
                responder(resposta, JSONObject().put("ok", false).put("erro", "fila cheia"))
            }
            return
        }
        val texto = message.data ?: return
        if (texto.length > TETO_TEXTO) return
        val json = try { JSONObject(texto) } catch (e: Exception) { return }
        when {
            json.has("abrir") -> {
                val a = json.getJSONObject("abrir")
                val token = a.optString("token")
                val item = c.abrir(
                    token = token,
                    id = a.optString("id"),
                    nome = a.optString("nome"),
                    tipo = a.optString("tipo"),
                    esperado = a.optLong("tamanho", -1),
                )
                if (item == null) {
                    responder(resposta, JSONObject().put("ok", false).put("erro", "abrir recusado"))
                } else {
                    tokenAberto = item.token
                    responder(
                        resposta,
                        JSONObject().put("ok", true)
                            .put("recebido", item.recebido)
                            .put("completo", item.completo),
                    )
                }
            }
            json.optBoolean("fim", false) -> {
                tokenAberto?.let { c.completar(it) }
                tokenAberto = null
                responder(resposta, JSONObject().put("ok", true))
            }
            json.optBoolean("cancelar", false) -> {
                tokenAberto?.let { c.cancelar(it) }
                tokenAberto = null
                responder(resposta, JSONObject().put("ok", true))
            }
        }
    }

    private fun laco() {
        while (rodando) {
            val t = try {
                fila.poll(250, TimeUnit.MILLISECONDS)
            } catch (e: InterruptedException) {
                break
            } ?: continue
            val c = cache()
            val token = tokenAberto
            val total = if (c != null && token != null) c.escrever(token, t.bytes) else -1L
            // O ACK volta pela main (JavaScriptReplyProxy é do WebView): é ele
            // que libera o próximo bloco do lado web.
            responder(t.resposta, JSONObject().put("r", total))
        }
    }

    private fun responder(resposta: JavaScriptReplyProxy, json: JSONObject) {
        val js = json.toString()
        main.post {
            try {
                resposta.postMessage(js)
            } catch (e: Exception) {
                Log.w(TAG, "não foi possível responder ao empurrão", e)
            }
        }
    }

    companion object {
        private const val TAG = "EspelhoMidiaCanal"
        const val OBJETO_JS = "__avTelaMidia"
        private const val FILA = 8
        private const val TETO_TEXTO = 2048
    }
}
