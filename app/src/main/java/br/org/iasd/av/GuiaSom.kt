package br.org.iasd.av

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.ComponentDialog
import androidx.activity.addCallback
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import java.net.URI

/**
 * O GUIA DE SONOPLASTIA DENTRO DO APP (shell 87) — a regra pura.
 *
 * O guia é uma página do SITE (`https://audiovisualiasd.com.br/sonoplastia/`),
 * terceiro em relação ao origin do app. Ele não pode abrir no WebView do
 * Controle: aquele injeta `__AVBridge` em TODA página e frame que carregar
 * (`addJavascriptInterface` é por-WebView, não por-origem — invariante 2), e é
 * por isso que um `<iframe>` foi descartado. Abre no [GuiaSomDialog], um
 * WebView SEM ponte nenhuma.
 *
 * [urlDoGuia] é a cerca, e falha FECHADO: só `https`, só o host do site
 * comparado por COMPONENTE do `URI` (nunca prefixo ou sufixo), porta padrão.
 * A ponte a pergunta na entrada (`abrirGuia`) e o WebView do guia a cada
 * navegação do quadro principal — fora dela, o link vai para fora do app.
 */
object GuiaSom {
    private const val SITE_HOST = "audiovisualiasd.com.br"

    fun urlDoGuia(url: String?): Boolean {
        val alvo = try { URI(url ?: return false) } catch (_: Exception) { return false }
        return alvo.scheme.equals("https", ignoreCase = true) &&
            alvo.host.equals(SITE_HOST, ignoreCase = true) &&
            (alvo.port == -1 || alvo.port == 443) &&
            alvo.rawUserInfo == null
    }

    /**
     * A MESMA URL, com o marcador `app=1` que a página lê para esconder o
     * "voltar ao site" e reservar a esquerda ao "fechar" nativo
     * (`site/sonoplastia/index.html`, bloco `no-app`).
     *
     * Entra ANTES da âncora: `#dia` é a trilha do Modo Fácil e não pode se
     * perder. Idempotente, porque o WebView do guia reusa a URL a cada
     * navegação e o `abrirGuia` pode ser chamado de novo.
     */
    fun comMarcadorDeApp(url: String): String {
        val corte = url.indexOf('#')
        val base = if (corte >= 0) url.substring(0, corte) else url
        val ancora = if (corte >= 0) url.substring(corte) else ""
        if (Regex("(^|[?&])app=1(&|\$)").containsMatchIn(base)) return url
        val separador = when {
            base.endsWith("?") || base.endsWith("&") -> ""
            base.contains('?') -> "&"
            else -> "?"
        }
        return base + separador + "app=1" + ancora
    }
}

/**
 * A TELA DO GUIA: um `Dialog` em tela cheia e imersivo, sobre a [MainActivity].
 *
 * **Dialog, e não Activity, de propósito:** a Activity não passa por
 * `onPause`/`onStop` com um `Dialog` por cima. Nada muda no ciclo de vida que
 * defende a projeção — o `keepPlaying` do telão, a preview que É a projeção sem
 * tela (`projecaoLocal`), a ronda do OTA em primeiro plano. Abrir o guia não
 * pausa nem projeta nada; a `Presentation` é outra janela, em outro display.
 *
 * O WebView sai da [WebViewFactory.createGuia] — sem `addJavascriptInterface`,
 * sem asset loader e sem `/saf/`. VOLTAR: com histórico, uma página atrás; sem
 * ele, fecha e o app está como estava. A morte do renderer (é o MESMO processo
 * dos dois WebViews do app) é tratada: fecha o guia e devolve `true`.
 */
class GuiaSomDialog(
    private val activity: Activity,
    private val urlInicial: String,
    private val aoFechar: () -> Unit,
) : ComponentDialog(activity, android.R.style.Theme_DeviceDefault_NoActionBar_Fullscreen) {

    private var web: WebView? = null
    private lateinit var barra: ProgressBar
    private lateinit var roda: ProgressBar
    private lateinit var aviso: LinearLayout
    private var ultimaUrl: String = urlInicial
    private var falhou = false

    private fun dp(v: Int): Int = TypedValue.applyDimension(
        TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), context.resources.displayMetrics,
    ).toInt()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val ctx = context
        val fundo = ctx.getColor(R.color.app_bg)
        val texto = ctx.getColor(R.color.app_bg_claro)
        val raiz = FrameLayout(ctx).apply { setBackgroundColor(fundo) }

        val w = WebViewFactory.createGuia(ctx)
        w.setBackgroundColor(fundo)
        raiz.addView(w, FrameLayout.LayoutParams(MATCH, MATCH))

        roda = ProgressBar(ctx).apply { isIndeterminate = true }
        raiz.addView(roda, FrameLayout.LayoutParams(dp(48), dp(48), Gravity.CENTER))
        barra = ProgressBar(ctx, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100
            visibility = View.GONE
        }
        raiz.addView(barra, FrameLayout.LayoutParams(MATCH, dp(4), Gravity.TOP))

        aviso = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(32), dp(32), dp(32), dp(32))
            visibility = View.GONE
            addView(TextView(ctx).apply {
                text = "Não deu para abrir o guia.\nConfira a internet e tente de novo."
                setTextColor(texto)
                textSize = 18f
                gravity = Gravity.CENTER
            })
            addView(Button(ctx).apply {
                text = "Tentar de novo"
                setOnClickListener { tentarDeNovo() }
            }, LinearLayout.LayoutParams(WRAP, WRAP).apply { topMargin = dp(20) })
            addView(Button(ctx).apply {
                text = "Voltar ao app"
                setOnClickListener { dismiss() }
            }, LinearLayout.LayoutParams(WRAP, WRAP).apply { topMargin = dp(8) })
        }
        raiz.addView(aviso, FrameLayout.LayoutParams(MATCH, MATCH))

        // O "fechar" visível mora à ESQUERDA, no lugar do "voltar ao site" que a
        // página esconde quando é aberta pelo app (`?app=1`): à direita ele caía
        // sobre o "Imprimir". No imersivo a barra de navegação some, e o gesto de
        // voltar não é óbvio para todo operador.
        //
        // O miolo claro o mantém visível nos DOIS fundos que a página põe atrás
        // dele: a barra branca do guia e a barra escura do livreto
        // (`.caderno-bar`). A largura casa com o recuo que a página reserva
        // (`padding-left: 3.25rem`, no bloco `no-app` do site).
        val fechar = FrameLayout(ctx).apply {
            contentDescription = "Fechar o guia"
            isClickable = true
            isFocusable = true
            setOnClickListener { dismiss() }
            addView(TextView(ctx).apply {
                text = "✕"
                textSize = 20f
                setTextColor(fundo)
                gravity = Gravity.CENTER
                importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
                background = android.graphics.drawable.GradientDrawable().apply {
                    shape = android.graphics.drawable.GradientDrawable.OVAL
                    setColor(0xF2FFFFFF.toInt())
                    setStroke(dp(1), 0x33000000)
                }
            }, FrameLayout.LayoutParams(dp(40), dp(40), Gravity.CENTER))
        }
        raiz.addView(fechar, FrameLayout.LayoutParams(dp(52), dp(56), Gravity.TOP or Gravity.START))

        setContentView(raiz)
        window?.setLayout(MATCH, MATCH)

        w.webViewClient = Cliente()
        w.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, newProgress: Int) {
                barra.progress = newProgress
                barra.visibility = if (newProgress in 0..99) View.VISIBLE else View.GONE
            }
        }
        w.setDownloadListener { url, _, _, _, _ -> abrirFora(Uri.parse(url)) }
        web = w

        onBackPressedDispatcher.addCallback(this) {
            val v = web
            if (v != null && !falhou && v.canGoBack()) v.goBack() else dismiss()
        }
        setOnDismissListener { encerrar() }

        w.loadUrl(urlInicial)
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) esconderBarras()
    }

    private fun esconderBarras() {
        val win = window ?: return
        WindowCompat.getInsetsController(win, win.decorView).apply {
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            hide(WindowInsetsCompat.Type.systemBars())
        }
    }

    private fun tentarDeNovo() {
        falhou = false
        aviso.visibility = View.GONE
        roda.visibility = View.VISIBLE
        web?.loadUrl(ultimaUrl)
    }

    /** Link para fora do site: o navegador, e só `http(s)` — `intent://` e afins morrem aqui. */
    private fun abrirFora(alvo: Uri) {
        val esquema = alvo.scheme?.lowercase()
        if (esquema != "https" && esquema != "http") return
        try {
            activity.startActivity(Intent(Intent.ACTION_VIEW, alvo).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (e: Exception) {
            Log.w(TAG, "nada abriu o link de fora do guia", e)
        }
    }

    private fun encerrar() {
        val v = web ?: return aoFechar()
        web = null
        try {
            v.stopLoading()
            (v.parent as? ViewGroup)?.removeView(v)
            v.destroy()
        } catch (e: Exception) {
            Log.w(TAG, "o WebView do guia não fechou limpo", e)
        }
        aoFechar()
    }

    private inner class Cliente : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            // Quadro interno (um vídeo embutido) carrega onde está: não há ponte
            // neste WebView para ele alcançar. A cerca é o QUADRO PRINCIPAL.
            if (!request.isForMainFrame) return false
            val alvo = request.url
            if (GuiaSom.urlDoGuia(alvo.toString())) return false
            abrirFora(alvo)
            return true
        }

        override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
            ultimaUrl = if (GuiaSom.urlDoGuia(url)) url else ultimaUrl
        }

        override fun onPageCommitVisible(view: WebView, url: String) {
            if (!falhou) roda.visibility = View.GONE
        }

        override fun onPageFinished(view: WebView, url: String) {
            roda.visibility = View.GONE
            if (!falhou) view.visibility = View.VISIBLE
        }

        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
            if (!request.isForMainFrame) return
            falhou = true
            view.visibility = View.INVISIBLE
            roda.visibility = View.GONE
            aviso.visibility = View.VISIBLE
        }

        /** O renderer é o do app inteiro: o padrão (`false`) mataria o processo, telão junto. */
        override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
            Log.w(TAG, "renderer morreu com o guia aberto (crash=${detail.didCrash()})")
            if (web === view) {
                web = null
                (view.parent as? ViewGroup)?.removeView(view)
                view.destroy()
            }
            dismiss()
            return true
        }
    }

    private companion object {
        const val TAG = "GuiaSom"
        const val MATCH = ViewGroup.LayoutParams.MATCH_PARENT
        const val WRAP = ViewGroup.LayoutParams.WRAP_CONTENT
    }
}
