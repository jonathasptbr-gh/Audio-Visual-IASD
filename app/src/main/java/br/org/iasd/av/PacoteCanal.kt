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
import java.io.OutputStream
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.TimeUnit

/**
 * O CANAL DE BYTES web→arquivo DO PACOTE DE TRANSFERÊNCIA (`__avPacote`).
 *
 * ## Por que ele existe
 *
 * O acervo de uma igreja passa de gigabytes e mora em dois lugares que só o
 * lado web alcança (IndexedDB e OPFS); o "Salvar como" do sistema mora num
 * lugar que só o shell alcança (SAF). Entre os dois não há caminho pela ponte:
 * um `@JavascriptInterface` troca STRINGS, e base64 sobre gigabytes é
 * exatamente o que o princípio dela proíbe. E um `<a download>` sobre um Blob
 * não faz NADA neste WebView, que não tem `DownloadListener` — é a mesma
 * parede que criou o `salvarTexto`.
 *
 * Este é o SEGUNDO `addWebMessageListener` de `ArrayBuffer` do shell, irmão do
 * [EspelhoMidiaCanal], e ele repete as três guardas daquele uma a uma:
 * `allowedOriginRules` exato, `isMainFrame`, e `sourceOrigin.host` conferido de
 * novo. Ele é instalado **só no WebView do CONTROLE** (invariante 9: superfície
 * nativa é privilégio do Controle) e reinstalado a cada remontagem por morte de
 * renderer.
 *
 * ## O protocolo
 *
 * | o que o JS manda | o que acontece |
 * |---|---|
 * | `ArrayBuffer` | um bloco; a resposta `{"r":total}` é o ACK que segura o próximo — `postMessage` não tem backpressure, e sem o ack a main viraria fila de megabytes |
 * | `{"fim":true}` | descarrega o que estiver em buffer; responde `{"ok":true}` |
 *
 * ABRIR E FECHAR NÃO ESTÃO AQUI, e isso é a divisão de trabalho da ponte, não
 * uma omissão: os dois envolvem uma PESSOA (o seletor do SAF) ou um veredito
 * que o lado web precisa esperar (quantos bytes de fato foram gravados), e isso
 * é o que uma chamada de ponte faz bem. Quem os faz é a [MainActivity], por
 * `pacoteCriar`/`pacoteFechar`/`pacoteCancelar`; este canal só recebe bytes
 * enquanto houver destino aberto, e responde `-1` quando não houver.
 *
 * ## A escrita sai da main thread
 *
 * `onPostMessage` é `@UiThread` e escrever num `content://` pode bloquear
 * (cartão SD, provedor de nuvem). O trabalho de verdade vai para uma thread
 * própria por uma fila curta; a main só enfileira e volta. É a mesma anatomia
 * do [EspelhoMidiaCanal], e pelo mesmo motivo.
 */
class PacoteCanal {

    private val main = Handler(Looper.getMainLooper())
    private val fila = ArrayBlockingQueue<Trabalho>(FILA)

    @Volatile private var thread: Thread? = null
    @Volatile private var rodando = false
    @Volatile private var instalado = false

    /**
     * O destino aberto. `@Volatile` porque a [MainActivity] o troca na main e a
     * thread de escrita o lê. Nulo = não há pacote em curso, e todo bloco que
     * chegar é recusado com `-1` — que é o que faz um empurrão órfão (a página
     * recarregou no meio) parar sozinho em vez de gravar num arquivo de outra
     * sessão.
     */
    @Volatile private var saida: OutputStream? = null
    @Volatile private var uri: Uri? = null
    @Volatile private var escritos = 0L

    private class Trabalho(val bytes: ByteArray, val resposta: JavaScriptReplyProxy)

    fun instalar(web: WebView?): Boolean {
        val w = web ?: return false
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER) ||
            !WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_ARRAY_BUFFER)
        ) {
            return false
        }
        return try {
            WebViewCompat.addWebMessageListener(w, OBJETO_JS, setOf(WebViewFactory.ORIGIN), ouvinte)
            ligar()
            instalado = true
            true
        } catch (e: Exception) {
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

    // ---------- o destino, dirigido pela Activity ----------

    /** Adota o destino recém-aberto pelo SAF. Um destino anterior é descartado. */
    fun adotar(saidaNova: OutputStream, uriNova: Uri) {
        fechar()
        saida = saidaNova
        uri = uriNova
        escritos = 0L
    }

    /** O documento em que se está gravando — a Activity o apaga ao cancelar. */
    fun uriEmCurso(): Uri? = uri

    /**
     * Fecha o destino e devolve os bytes gravados, ou `-1` se não havia nada
     * aberto **ou se o fecho falhou**.
     *
     * A SEGUNDA METADE É O PONTO: os acks por bloco já disseram "recebi" para
     * tudo, e é o `flush`/`close` que descobre que o cartão encheu. Achatar
     * essa falha num número plausível faria o app anunciar um pacote inteiro
     * sobre um arquivo truncado — e um pacote truncado importa em silêncio até
     * o registro em que os bytes acabam.
     */
    fun fechar(): Long {
        val s = saida ?: run { uri = null; return -1L }
        saida = null
        uri = null
        val n = escritos
        escritos = 0L
        return try {
            s.flush()
            s.close()
            n
        } catch (e: Exception) {
            Log.w(TAG, "não consegui fechar o pacote", e)
            try { s.close() } catch (_: Exception) {}
            -1L
        }
    }

    private fun ligar() {
        if (rodando) return
        rodando = true
        thread = Thread({ laco() }, "av-pacote").apply { isDaemon = true }
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
                Log.w(TAG, "mensagem do pacote ignorada", e)
            }
        }
    }

    private fun quandoChega(message: WebMessageCompat, resposta: JavaScriptReplyProxy) {
        if (message.type == WebMessageCompat.TYPE_ARRAY_BUFFER) {
            val bytes = message.arrayBuffer
            if (bytes.isEmpty() || bytes.size > TETO_BLOCO) {
                responder(resposta, JSONObject().put("r", -1))
                return
            }
            // A main NÃO escreve arquivo e NÃO espera: `offer` sem prazo,
            // porque bloquear a main é derrubar o app inteiro. Com o ack por
            // bloco a fila nunca passa de um ou dois itens; enchendo, a recusa
            // volta como erro RETENTÁVEL e o lado web re-envia o MESMO bloco —
            // o controle de fluxo fecha sem descartar byte nenhum.
            if (!fila.offer(Trabalho(bytes, resposta))) {
                responder(resposta, JSONObject().put("erro", "fila cheia"))
            }
            return
        }
        val texto = message.data ?: return
        if (texto.length > TETO_TEXTO) return
        val json = try { JSONObject(texto) } catch (e: Exception) { return }
        if (json.optBoolean("fim", false)) {
            // O `flush` aqui é o que faz o `{"ok":true}` significar alguma
            // coisa: sem ele a resposta diria "gravei" sobre bytes ainda no
            // buffer, e o `pacoteFechar` que vem em seguida é quem descobriria.
            val ok = try { saida?.flush(); true } catch (e: Exception) {
                Log.w(TAG, "flush do pacote falhou", e); false
            }
            responder(resposta, JSONObject().put("ok", ok).put("r", escritos))
        }
    }

    private fun laco() {
        while (rodando) {
            val t = try {
                fila.poll(250, TimeUnit.MILLISECONDS)
            } catch (e: InterruptedException) {
                break
            } ?: continue
            val s = saida
            val total = if (s == null) {
                -1L
            } else {
                try {
                    s.write(t.bytes)
                    escritos += t.bytes.size
                    escritos
                } catch (e: Exception) {
                    Log.w(TAG, "escrita do pacote falhou", e)
                    -1L
                }
            }
            // O ACK volta pela main (o `JavaScriptReplyProxy` é do WebView): é
            // ele que libera o próximo bloco do lado web.
            responder(t.resposta, JSONObject().put("r", total))
        }
    }

    private fun responder(resposta: JavaScriptReplyProxy, json: JSONObject) {
        val js = json.toString()
        main.post {
            try {
                resposta.postMessage(js)
            } catch (e: Exception) {
                Log.w(TAG, "não foi possível responder ao bloco do pacote", e)
            }
        }
    }

    companion object {
        private const val TAG = "PacoteCanal"
        const val OBJETO_JS = "__avPacote"
        private const val FILA = 8
        private const val TETO_TEXTO = 2048

        /**
         * 1 MiB, o mesmo teto do [EspelhoMidiaCache.TETO_BLOCO]. Não é um número
         * escolhido de novo: é o tamanho de bloco que aquele canal já provou
         * suportar num `postMessage` de `ArrayBuffer`, e blocos maiores só
         * trocam uma cópia por outra.
         */
        const val TETO_BLOCO = 1 shl 20
    }
}
