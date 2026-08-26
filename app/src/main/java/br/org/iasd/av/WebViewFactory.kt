package br.org.iasd.av

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewAssetLoader
import java.io.ByteArrayInputStream

/**
 * Criação e configuração dos dois WebViews (Controle e Display).
 *
 * INVARIANTES (não quebrar — são o que sustenta toda a arquitetura web):
 *
 *  1. Servir por `https://appassets.androidplatform.net/`, JAMAIS por `file://`.
 *     É o contexto seguro que faz OPFS e IndexedDB funcionarem.
 *  2. Um ÚNICO origin para os dois WebViews — é o que preserva IndexedDB,
 *     OPFS e BroadcastChannel compartilhados entre Controle e Display,
 *     exatamente como os dois PWAs compartilham no navegador.
 *  3. Um único processo/perfil de WebView. Nada de processo isolado.
 *  4. `mediaPlaybackRequiresUserGesture = false` — é o que aposenta o
 *     overlay "Ligar Sistema" e toda a recuperação de áudio bloqueado.
 */
object WebViewFactory {

    private const val TAG = "WebViewFactory"

    /**
     * Host do origin servido. Fica separado de [ORIGIN] porque toda checagem de
     * origem tem de comparar o HOST do `Uri`, nunca o prefixo da string da URL
     * — `appassets.androidplatform.net.evil.com` começa com o origin e não tem
     * nada a ver com ele.
     */
    const val ORIGIN_HOST = "appassets.androidplatform.net"
    const val ORIGIN = "https://$ORIGIN_HOST"
    const val URL_CONTROLE = "$ORIGIN/web/controle/index.html"
    const val URL_DISPLAY = "$ORIGIN/web/display/index.html"

    /**
     * Loader dos WebViews.
     *
     * Ordem dos handlers importa: `/saf/` é avaliado ANTES de `/`, senão o
     * handler da base web (registrado na raiz) engoliria as requisições de
     * arquivos do dispositivo.
     *
     * A base web vem do bundle OTA da sessão quando existe um, senão dos
     * assets do APK — nos dois casos pelo MESMO origin, então IndexedDB,
     * OPFS e a ponte nativa não notam diferença nenhuma.
     *
     * @param withSaf registra o handler `/saf/`. Só o **Controle** precisa
     *   dele: os dois consumidores de arquivo do dispositivo são `importShare`
     *   e `syncDeviceFolder`, e os dois copiam os bytes para o OPFS antes de
     *   qualquer coisa chegar ao telão — o Display nunca busca um `/saf/`.
     *   Deixá-lo fora do loader da `Presentation` é a INVARIANTE 9, não
     *   higiene: com o handler registrado, qualquer script que rodasse naquele
     *   documento ganharia um servidor de bytes de todas as pastas que o
     *   operador já concedeu. (O embed do YouTube — que carregava script de
     *   terceiro ali por design — saiu na v5.212; a guarda não depende dele,
     *   e é `tools/ponte.test.mjs` que a trava.)
     */
    fun assetLoader(ctx: Context, withSaf: Boolean = true): WebViewAssetLoader =
        WebViewAssetLoader.Builder()
            .apply {
                if (withSaf) addPathHandler("/saf/", SafPathHandler(ctx.applicationContext))
            }
            .addPathHandler("/", WebPathHandler(ctx.applicationContext))
            .build()

    /**
     * WebView que NUNCA se declara oculto ao Chromium.
     *
     * O Chromium marca a página como `hidden` quando a janela da View some — e
     * é isso que acontece com o telão no instante em que o operador minimiza o
     * app. Uma página oculta é rebaixada pelo Chromium: temporizadores
     * estrangulados, renderer desacelerado.
     *
     * Reportar sempre `VISIBLE` tira o gatilho. **O telão É a projeção**, segue
     * no ar com o app minimizado de propósito, e não há razão para desacelerar
     * o renderer dele. (O motivo ORIGINAL era outro — o embed do YouTube
     * pausava sozinho ao ver `document.hidden` —, e saiu com ele na v5.212; o
     * que sustenta a subclasse hoje é a frase acima.) Vale SÓ para o WebView da
     * [StagePresentation] — ele é a projeção, e a projeção continua no ar com o
     * app minimizado de propósito (é para isso que existe o [SessionService]).
     * O WebView do Controle segue o ciclo normal: ali ser estrangulado em
     * segundo plano é o comportamento correto, e é justamente o que o
     * `snoopDisplayStatus` da ponte existe para contornar.
     *
     * O efeito colateral é o desejado e já era verdade: o renderer do telão não
     * é desacelerado quando o app sai da frente.
     */
    class KeepVisibleWebView(ctx: Context) : WebView(ctx) {
        /**
         * Ligado sempre para o WebView da [StagePresentation] (pelo parâmetro
         * `keepVisible` de [create]) e, desde a v1.3.12, EM RUNTIME para o do
         * Controle — só enquanto a preview dele for a projeção, isto é, só
         * enquanto não houver tela conectada. Ver
         * `MainActivity.setProjecaoLocal`, que é o outro (e único) ponto que
         * escreve este campo.
         *
         * Com `false` a subclasse é indistinguível de um WebView comum, e é
         * assim que o Controle nasce: COM uma tela lá fora, ser estrangulado em
         * segundo plano é o comportamento CERTO — o som está no telão, e é o
         * `snoopDisplayStatus` da ponte que contorna o estrangulamento.
         */
        var manterVisivel = false

        override fun onWindowVisibilityChanged(visibility: Int) {
            super.onWindowVisibilityChanged(if (manterVisivel) View.VISIBLE else visibility)
        }

        /**
         * A visibilidade que o Chromium calcula tem DOIS componentes — a da
         * janela e a da View —, e mentir só sobre o primeiro deixava o segundo
         * derrubar a página do mesmo jeito. Foi por isso que a v1.26 não
         * resolveu nada: a metade que faltava é esta.
         */
        override fun onVisibilityChanged(changedView: View, visibility: Int) {
            super.onVisibilityChanged(changedView, if (manterVisivel) View.VISIBLE else visibility)
        }
    }

    /**
     * @param keepVisible ver [KeepVisibleWebView] — o telão nasce com ela. O
     *   Controle a recebe EM RUNTIME quando a preview vira a projeção (ver
     *   `MainActivity.setProjecaoLocal`), e não por este parâmetro.
     * @param onRendererGone chamado quando o processo do renderer morre. O
     *   WebView já foi desligado do barramento e destruído; cabe ao dono
     *   construir um novo no lugar. Sem callback, a página simplesmente some
     *   — mas o app continua vivo, que é o ponto.
     */
    @SuppressLint("SetJavaScriptEnabled")
    fun create(
        ctx: Context,
        loader: WebViewAssetLoader,
        keepVisible: Boolean = false,
        onRendererGone: (() -> Unit)? = null,
    ): WebView {
        // SEMPRE a subclasse, e desde a v1.3.12 isso voltou a ser CAPACIDADE, e
        // não só uniformidade.
        //
        // O motivo original era a "mesa de som" — o modo em que o celular ERA a
        // caixa de som e o WebView do CONTROLE não podia ser suspenso —, e ele
        // saiu na v5.189 com o modo inteiro. O CASO voltou por outra porta: sem
        // tela nenhuma conectada quem projeta é o `<video>` da PREVIEW, neste
        // WebView, e o Chromium pausa o `<video>` de uma página oculta. Quem
        // liga a proteção agora é `MainActivity.setProjecaoLocal`, EM RUNTIME e
        // só enquanto ela vale — este parâmetro segue sendo o do telão, que a
        // tem sempre.
        //
        // Com `false` a subclasse repassa o valor real de visibilidade e é
        // indistinguível de um `WebView` comum; é por isso que construí-la aqui
        // sempre nunca mudou comportamento nenhum, e é o que torna a alternância
        // em runtime possível sem um caminho de construção a mais.
        val web = KeepVisibleWebView(ctx).apply { manterVisivel = keepVisible }
        if (keepVisible) {
            // O renderer do telão NÃO pode ser rebaixado quando o app sai da
            // frente: `waivedWhenNotVisible = false` é literalmente "não abra
            // mão da prioridade só porque esta View não está visível", e é a
            // diferença entre um vídeo que continua e um que engasga ou morre
            // sob pressão de memória — com a `Presentation` ainda no ar na TV.
            web.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false)
        }
        web.setBackgroundColor(Color.BLACK)
        // O telão e a UI do operador nunca rolam a página inteira — o layout
        // web já é 100vh com áreas roláveis próprias.
        web.overScrollMode = WebView.OVER_SCROLL_NEVER
        web.isVerticalScrollBarEnabled = false
        web.isHorizontalScrollBarEnabled = false

        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true

            // Autoplay com som liberado: no APK não existe a política de
            // gesto do navegador, então o Display toca sozinho ao receber
            // um comando — sem overlay de destrave.
            mediaPlaybackRequiresUserGesture = false

            // Os assets vêm todos pelo asset loader; acesso direto a
            // file:// e content:// fica desligado por segurança.
            allowFileAccess = false
            allowContentAccess = false

            useWideViewPort = true
            loadWithOverviewMode = false
            builtInZoomControls = false
            displayZoomControls = false
            setSupportZoom(false)
            javaScriptCanOpenWindowsAutomatically = false
            setSupportMultipleWindows(false)
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            cacheMode = WebSettings.LOAD_DEFAULT

            // Sem o marcador "; wv", os serviços que a base web consulta
            // (LouvorJA, miniaturas) veem um Chrome comum em vez de um WebView,
            // que alguns tratam de forma mais restritiva. Mesmo motor, sem a
            // degradação. (Nasceu para o embed do YouTube, que saiu na v5.212 —
            // a linha ficou porque o UA vale para TODA requisição do WebView,
            // não só para aquele player. O UA que o googlevideo enxerga é outro:
            // quem o escolhe é `YoutubeGrab.uaPara`/`StreamProxy`.)
            userAgentString = userAgentString.replace("; wv", "")
        }

        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest,
            ): WebResourceResponse? {
                // O PROXY DE TRANSMISSÃO vem ANTES do asset loader, e tem de
                // vir: ele é o único ponto do app que enxerga os CABEÇALHOS da
                // requisição, e a transmissão direta é feita de pedidos por
                // faixa de bytes (`Range`). Um `PathHandler` recebe só o
                // caminho — ver o KDoc do [StreamProxy].
                //
                // Ele vale para os DOIS WebViews, ao contrário do handler
                // `/saf/`: aqui quem projeta é o telão, então negá-lo ao
                // Display seria negar o recurso inteiro. A exposição é
                // diferente da do `/saf/` — um token de stream aponta para uma
                // faixa do vídeo que já está em cena, não para o índice de uma
                // pasta do aparelho.
                StreamProxy.tryHandle(request)?.let { return it }
                return loader.shouldInterceptRequest(request.url)
            }

            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest,
            ): Boolean {
                val url = request.url
                // Navegação dentro do app (os dois "PWAs" e seus assets)
                // segue no WebView; qualquer outra coisa é link externo e
                // não deve sequestrar a tela de projeção.
                //
                // A comparação é por COMPONENTE do Uri, nunca por prefixo da
                // string: `https://appassets.androidplatform.net.evil.com/x`
                // começa com o origin, é um domínio que qualquer um registra, e
                // com um `startsWith` a navegação era autorizada — dentro de um
                // WebView que injeta `__AVBridge` em TODA página que carregar
                // (o `addJavascriptInterface` é por-WebView, não por-origem).
                // Este é o único ponto que impede conteúdo estranho de entrar
                // aqui, então ele não pode falhar ABERTO.
                return !(url.scheme == "https" && url.host == ORIGIN_HOST)
            }

            /**
             * A implementação padrão devolve `false` — e aí o framework MATA o
             * processo do app. Com dois WebViews no mesmo processo, `largeHeap`,
             * um vídeo grande no telão e um player do YouTube, uma morte do
             * renderer por OOM levaria junto o Controle na mão do operador e a
             * projeção na TV, no meio do culto.
             *
             * Devolver `true` diz ao framework que o app tratou a perda: o
             * WebView morto sai do barramento e é destruído, e o dono recria a
             * página — o mesmo caminho que a reconexão do dongle já usa.
             */
            override fun onRenderProcessGone(
                view: WebView,
                detail: RenderProcessGoneDetail,
            ): Boolean {
                Log.w(TAG, "renderer morreu (crash=${detail.didCrash()}) — recriando o WebView")
                MessageBus.detach(view)
                (view.parent as? ViewGroup)?.removeView(view)
                view.destroy()
                onRendererGone?.invoke()
                return true
            }
        }

        return web
    }

    /**
     * Resposta 404 curta, usada quando um recurso do dispositivo sumiu.
     *
     * O corpo tem UM byte, não zero — é o corolário da invariante 8: o próprio
     * WebView aplica o `Range` da requisição sobre o que o app devolver, e um
     * corpo VAZIO é reprovado pelo `ComputeBounds` sempre que a faixa pedida
     * começa fora do zero — o erro inteiro evapora e no lugar do 404 chega só
     * um erro de rede sem status. Com um byte, há o que recortar e o status
     * sobrevive à requisição com faixa.
     */
    fun notFound(): WebResourceResponse = WebResourceResponse(
        "text/plain",
        "utf-8",
        404,
        "Not Found",
        emptyMap(),
        ByteArrayInputStream(ByteArray(1)),
    )
}
