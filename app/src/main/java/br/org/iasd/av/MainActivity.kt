package br.org.iasd.av

import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.hardware.display.DisplayManager
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.DocumentsContract
import android.provider.OpenableColumns
import android.provider.Settings
import android.util.Log
import android.view.Display
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.addCallback
import androidx.activity.result.contract.ActivityResultContracts
import kotlin.concurrent.thread
import org.json.JSONArray
import org.json.JSONObject

/**
 * A tela do operador: hospeda o WebView do **Controle** e orquestra a
 * `StagePresentation` (o Display) na TV.
 *
 * O que esta classe NÃO faz — de propósito: transporte, playlist, letra
 * sincronizada, Bíblia, fades, coleções. Tudo isso é a base web madura em
 * `assets/web/`, e reimplementar qualquer parte disso em Kotlin seria
 * duplicar lógica que já funciona.
 */
class MainActivity : ComponentActivity(), BridgeHost {

    private lateinit var root: FrameLayout

    /**
     * O tema em vigor, do ponto de vista do SHELL. Cópia da escolha que vive no
     * `localStorage` do Controle — ver [setTemaClaro]; aqui ela existe só para
     * pintar o cromo do sistema antes de o WebView carregar.
     */
    private var temaClaro = false
    private lateinit var webContainer: FrameLayout
    private lateinit var fullscreenContainer: KeepVisibleFrame
    private var web: WebView? = null

    private var presentation: StagePresentation? = null
    private var displayManager: DisplayManager? = null

    /**
     * O displayId do telão que está DE FATO no ar, ou -1.
     *
     * "HÁ TELA" NÃO É "HÁ TELÃO", e confundir os dois é o defeito que este
     * campo existe para fechar. [listDisplays] responde pelo DisplayManager e o
     * lado web decidia por ele quem toca o som (`acertarSaidaDeAudio`), se o
     * botão de microfone existe (`haOndeReproduzirMic`) e se o Modo Fácil
     * destrava. Mas a projeção é a `Presentation` — e ela pode não estar no ar
     * com a tela listada: `show()` lança quando o dongle está instável, e o
     * sistema derruba a janela sozinho numa oscilação de Miracast.
     *
     * O desfecho era o pior possível num culto: a tela listada calava a preview
     * (há para onde mandar o som) e não havia telão tocando — **silêncio nos
     * dois lados**, sem erro em lugar nenhum e sem nada na tela que explicasse.
     *
     * `@Volatile` porque a escrita é da MAIN THREAD (só [syncPresentation] e o
     * `setOnDismissListener`) e a leitura é da thread do WebView, em
     * [listDisplays].
     */
    @Volatile
    private var telaoDisplayId = -1

    /**
     * A ESCADA DE RETOMADA DO TELÃO. Sem ela, um `show()` que falha é definitivo:
     * `syncPresentation` só roda de novo por um evento do DisplayManager — que
     * pode não vir — ou por um `onResume`, que exige o operador sair do app e
     * voltar. Num culto o celular fica no suporte, e o estado "tela conectada,
     * telão no chão" durava o culto inteiro.
     *
     * Cresce (0,4 s → 8 s, ~15 s no total) pelo motivo da retomada de áudio do
     * `display.js`: o pior caso audível é uma falha no começo, não uma tentativa
     * a cada quadro. Zera em toda subida bem-sucedida e é CANCELADA quando a
     * tela some de verdade — aí não há o que retomar, e o caminho normal
     * (preview assume o som) já está certo.
     */
    private var telaoTentativa = 0
    private var telaoRetryPendente = false
    private val telaoRetomar = Runnable {
        telaoRetryPendente = false
        syncPresentation()
    }

    /** Fullscreen HTML5 (a preview do Controle em tela cheia). */
    private var customView: View? = null
    private var customCallback: WebChromeClient.CustomViewCallback? = null

    /** Callback do `AVNative.pickFolder()` em andamento. */
    private var pendingFolderPick: ((Uri?) -> Unit)? = null

    /**
     * Callback do `<input type="file">` em andamento.
     *
     * Um WebView **ignora `<input type="file">` por completo** sem
     * `onShowFileChooser` — o toque simplesmente não faz nada. No navegador o
     * seletor é nativo da plataforma; aqui é o app que precisa abri-lo. É
     * disso que dependem a importação para o Cronograma e a escolha do
     * wallpaper.
     */
    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    private val fileChooser = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) { result ->
        val cb = filePathCallback
        filePathCallback = null
        // parseResult devolve null quando o operador cancela — entregar esse
        // null é o que destrava o input para uma próxima tentativa.
        cb?.onReceiveValue(
            WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data),
        )
    }

    /**
     * Share recebido por intent, aguardando o lado web consumir.
     *
     * `AtomicReference`, e não um campo comum: quem escreve é a main thread
     * (`onCreate`/`onNewIntent`), mas quem lê é [takePendingShare], chamado da
     * thread do WebView pela ponte — sem uma aresta de visibilidade a leitura
     * podia enxergar `null` (ou um objeto pela metade) por sorte de cache. O
     * `getAndSet(null)` do take também fecha, de graça, a janela de consumo
     * duplo entre duas chamadas concorrentes.
     */
    private val pendingShare =
        java.util.concurrent.atomic.AtomicReference<JSONObject?>(null)

    /** Há download em curso? (evita start/stop repetido do serviço) */
    private var backgroundWork = false

    /**
     * Geração do estado de [backgroundWork]. Incrementada a cada mudança aceita
     * em [setBackgroundWork]; o hook do `SyncService.onGone` captura o valor no
     * momento do aviso e só zera o espelho se ninguém mudou o estado no meio —
     * sem isso, um `keepAlive(true)` novo que cruzasse com o `onTimeout` da
     * cota de FGS era apagado pelo runnable atrasado, e o download seguinte
     * ficava sem proteção, calado.
     */
    @Volatile
    private var backgroundWorkGen = 0

    /**
     * O lado web pediu para receber os botões físicos de volume.
     *
     * Ligado por `AVNative.captureVolumeKeys(true)` só depois que o Controle
     * carrega: se a Activity interceptasse as teclas desde o `onCreate`, uma
     * falha no JS deixaria o aparelho sem NENHUM controle de volume enquanto o
     * app estivesse aberto.
     */
    private var captureVolumeKeys = false

    /**
     * A PROJEÇÃO É ESTE APARELHO: não há tela conectada e há cena no ar.
     *
     * Escrito pelo lado web (`AVNative.projecaoLocal`) — ver [setProjecaoLocal],
     * que explica o que o shell faz com ele. Guardado aqui porque o WebView do
     * Controle é REMONTADO a cada morte de renderer, e a página nova só pede a
     * proteção de volta depois de carregar: o estado atravessa a remontagem,
     * como o `backgroundWork` NÃO atravessa (e pelo motivo oposto — aquele
     * pertencia ao documento que morreu, este pertence à CONEXÃO, que não).
     */
    private var projecaoLocal = false

    // Android 13+ exige permissão para MOSTRAR a notificação do serviço de
    // sincronização. Negá-la não impede o serviço de rodar — só esconde o
    // indicador —, por isso o pedido é feito uma vez e sem bloquear nada.
    private val notifPermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { /* concedida ou não, o app segue igual */ }

    /**
     * Permissão do microfone (push-to-talk). Pedida **sob demanda**, quando o
     * operador abre a função — e não na abertura do app: um pedido de gravar
     * áudio logo no primeiro lançamento, sem contexto, é o tipo de coisa que
     * as pessoas negam por reflexo, e aí o recurso fica quebrado sem motivo.
     */
    private var pendingMicPermission: ((Boolean) -> Unit)? = null
    private val micPermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        val cb = pendingMicPermission
        pendingMicPermission = null
        cb?.invoke(granted)
    }

    /** Callback do `AVNative.pickDoc()` em andamento. */
    private var pendingDocPick: ((List<Uri>) -> Unit)? = null

    /**
     * Seletor de ARQUIVOS do sistema — a importação inteira do app passa por
     * aqui (imagem, vídeo, áudio, PDF e PPTX), não só documentos.
     *
     * O `<input type="file">` da página não serve para isto: ele devolve ao
     * JavaScript um `File` — bytes já lidos —, e quem desenha o PDF é o shell,
     * que precisa do ARQUIVO. Mandar os bytes de volta pela ponte inverteria o
     * princípio dela ("URLs servíveis, nunca bytes") e faria uma apresentação
     * de dezenas de MB passar pela memória do WebView à toa.
     *
     * `OpenDocument` (SAF), e não `GetContent`: só ele devolve um `content://`
     * que o `contentResolver` deste processo consegue abrir depois, que é
     * exatamente o que o [SlideDeck] faz.
     */
    private val docPicker = registerForActivityResult(
        ActivityResultContracts.OpenMultipleDocuments(),
    ) { uris ->
        val cb = pendingDocPick
        pendingDocPick = null
        cb?.invoke(uris ?: emptyList())
    }

    /** Callback do `AVNative.salvarTexto()` em andamento, com o texto a gravar. */
    private var pendingTextSave: Pair<String, (String) -> Unit>? = null

    /**
     * "Salvar como" do sistema. `CreateDocument` devolve um `content://` no
     * qual este processo pode ESCREVER — é o único caminho de gravação do app,
     * e ele existe porque o WebView não tem `DownloadListener` (ver
     * `NativeBridge.salvarTexto`).
     */
    private val textSaver = registerForActivityResult(
        ActivityResultContracts.CreateDocument("text/plain"),
    ) { uri ->
        val pend = pendingTextSave
        pendingTextSave = null
        if (pend == null) return@registerForActivityResult
        val (texto, cb) = pend
        if (uri == null) { cb(""); return@registerForActivityResult }
        val nome = try {
            contentResolver.openOutputStream(uri)?.use { it.write(texto.toByteArray(Charsets.UTF_8)) }
            uri.lastPathSegment?.substringAfterLast('/') ?: "registro.txt"
        } catch (e: Exception) {
            // Falhar aqui é o operador ficar sem o arquivo, não o app quebrar —
            // e a string vazia é o mesmo desfecho de ter desistido, que é o que
            // a tela sabe explicar.
            Log.w(TAG, "não consegui gravar o texto", e)
            ""
        }
        cb(nome)
    }

    /** Callback do `AVNative.pacoteCriar()` em andamento. */
    private var pendingPacoteCreate: ((String) -> Unit)? = null

    /**
     * "Salvar como" do PACOTE DE TRANSFERÊNCIA (shell 63).
     *
     * `application/octet-stream` e não um tipo próprio: o Android não conhece
     * `.avpkg`, e um MIME inventado faz provedores recusarem a criação. O nome
     * sugerido já traz a extensão; **se um provedor a trocar, nada quebra** —
     * quem identifica o arquivo na importação é a ASSINATURA nos primeiros bytes
     * (ver `AVPacote.lerAssinatura`), nunca o nome. É a mesma disciplina do
     * `SafRegistry`: o que vale é o conteúdo, não o rótulo.
     *
     * Ao contrário do [textSaver], que grava e fecha na hora, aqui o destino
     * fica ABERTO: o que vem depois são gigabytes em blocos de 1 MiB pelo
     * [PacoteCanal].
     */
    private val pacoteSaver = registerForActivityResult(
        ActivityResultContracts.CreateDocument("application/octet-stream"),
    ) { uri ->
        val cb = pendingPacoteCreate
        pendingPacoteCreate = null
        if (cb == null) return@registerForActivityResult
        if (uri == null) { cb(""); return@registerForActivityResult }
        val nome = try {
            val out = contentResolver.openOutputStream(uri, "wt")
                ?: throw java.io.IOException("provedor não abriu o documento")
            pacoteCanal.adotar(out, uri)
            nomeVisivelDoDocumento(uri)
        } catch (e: Exception) {
            // Não conseguir abrir é o operador ficar sem o arquivo, não o app
            // quebrar — e a string vazia é o MESMO desfecho de ter desistido,
            // que é o que a tela sabe explicar. O documento vazio que o SAF
            // acabou de criar é apagado aqui: deixá-lo seria um arquivo de zero
            // byte com nome de acervo.
            Log.w(TAG, "não consegui abrir o pacote para escrita", e)
            try { DocumentsContract.deleteDocument(contentResolver, uri) } catch (_: Exception) {}
            ""
        }
        cb(nome)
    }

    private val folderPicker = registerForActivityResult(
        ActivityResultContracts.OpenDocumentTree(),
    ) { uri ->
        val cb = pendingFolderPick
        pendingFolderPick = null
        if (uri != null) {
            // Permissão PERSISTENTE: sem isso, o re-sync da pasta pediria o
            // seletor de novo a cada abertura do app.
            try {
                contentResolver.takePersistableUriPermission(
                    uri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION,
                )
            } catch (e: SecurityException) {
                Log.w(TAG, "sem permissão persistente para $uri", e)
            }
        }
        cb?.invoke(uri)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        // O TEMA, E ELE PRECISA VIR ANTES DO `super` (v1.90). `setTheme` só tem
        // efeito enquanto a janela não foi criada, e é do TEMA que sai o
        // `windowBackground` — o que aparece enquanto o WebView carrega. Depois
        // da decor view instalada, mudar o tema não repinta mais esse fundo.
        // `getSharedPreferences` já funciona aqui: o contexto base é anexado em
        // `attachBaseContext`, que roda antes do `onCreate`.
        temaClaro = getSharedPreferences(TEMA_PREFS, MODE_PRIVATE).getBoolean(TEMA_CLARO_KEY, false)
        if (temaClaro) setTheme(R.style.Theme_AvIasd_Claro)
        super.onCreate(savedInstanceState)

        if (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0) {
            WebView.setWebContentsDebuggingEnabled(true)
        }

        // A tela do operador não pode apagar no meio do culto.
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // Volume desta Activity = mídia, sempre. Sem isto o Android escolhe a
        // stream pelo contexto e, com espelhamento ativo, os botões podem cair
        // na saída remota (o volume da TV) em vez do áudio do app.
        volumeControlStream = AudioManager.STREAM_MUSIC

        // Decide a base web ANTES de qualquer WebView existir, para Controle e
        // Display servirem sempre o mesmo bundle nesta sessão (e para o
        // watchdog do OTA armar uma única vez).
        WebUpdater.beginSession(this)

        root = FrameLayout(this)
        // A raiz é o que se vê no INTERVALO entre a janela existir e o WebView
        // pintar o primeiro quadro. Ela era `Color.BLACK` desde sempre, e com
        // um app só escuro isso nunca custou nada — `--bg` era quase preto. Com
        // o tema claro, um retângulo preto ali é um piscar do app inteiro a
        // cada abertura, então ela segue o tema como o `windowBackground`. (O
        // `fullscreenContainer`, logo abaixo, continua PRETO em qualquer tema:
        // ele hospeda a preview em tela cheia, que é PALCO — ver o bloco
        // compartilhado de `shared/tokens.css`.)
        root.setBackgroundColor(getColor(if (temaClaro) R.color.app_bg_claro else R.color.app_bg))
        webContainer = FrameLayout(this)
        fullscreenContainer = KeepVisibleFrame(this)
        fullscreenContainer.setBackgroundColor(Color.BLACK)
        fullscreenContainer.visibility = View.GONE
        root.addView(webContainer, matchParent())
        root.addView(fullscreenContainer, matchParent())
        setContentView(root)

        // Os ÍCONES das barras de sistema, e SÓ DEPOIS do `setContentView`:
        // quem os pinta é o `WindowInsetsController`, e ele só existe com a
        // decor view instalada (ver a armadilha em [aplicarCromoDoTema]).
        aplicarCromoDoTema(temaClaro)

        // SÓ na primeira criação. A única saída do app é `moveTaskToBack`, então
        // a Activity nunca é finalizada e `getIntent()` continua devolvendo o
        // mesmo ACTION_SEND para sempre: qualquer recriação (uma configuração
        // fora do `android:configChanges` — que a v1.4.19 encheu, mas que nunca
        // cobre tudo —, ou voltar pelo Recentes depois de o processo ser morto)
        // reparsearia o
        // MESMO compartilhamento e o lado web importaria uma segunda cópia
        // integral do arquivo, sem aviso e sem desfazer. `savedInstanceState`
        // não-nulo é exatamente "isto é uma recriação".
        if (savedInstanceState == null) {
            pendingShare.set(ShareIntake.parse(this, intent))
        }
        // E marca o intent como consumido, para o caso de o sistema recriar a
        // Activity SEM estado salvo: um ACTION_SEND que já foi lido nunca mais
        // pode ser lido de novo.
        consumeShareIntent()

        buildControleWebView()

        displayManager = getSystemService(DisplayManager::class.java)
        displayManager?.registerDisplayListener(displayListener, null)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            notifPermission.launch(android.Manifest.permission.POST_NOTIFICATIONS)
        }

        // Procura uma base web nova em segundo plano. O que for baixado só
        // entra em cena no PRÓXIMO lançamento — nunca troca a base no meio de
        // uma projeção (ou AGORA, se o operador aceitar o aviso).
        //
        // E a procura não é mais UMA: a ronda periódica, a retomada do app e a
        // rede voltando também disparam (ver `WebUpdater.iniciarVigilancia`).
        // Com o app aberto o dia inteiro — que é o normal —, uma única busca no
        // `onCreate` significava que uma versão publicada depois da abertura
        // não existia para o aparelho.
        WebUpdater.checkAsync(this, "abertura")
        WebUpdater.iniciarVigilancia(this)

        // E O AVISO APARECE NA HORA. O lado web enquete de dez em dez segundos
        // (`OTA_POLL_MS`), mas esperar por algo que o shell JÁ SABE é atraso à
        // toa: quando o bundle fica pronto, o shell empurra — a enquete
        // continua sendo o piso.
        // O EMPURRÃO LEVA O ESTADO INTEIRO, e não só a versão da base web: quem
        // pergunta "tem atualização?" precisa saber, no mesmo instante, se ela
        // vem com APK — senão a tela desenha a pergunta com metade do que ela
        // tem a dizer e se corrige meio segundo depois.
        WebUpdater.aoChegar = {
            val estado = WebUpdater.estado(this).toString()
            val js = "window.__avAtualizacao && window.__avAtualizacao($estado);"
            runOnUiThread { web?.evaluateJavascript(js, null) }
        }

        // (A APLICAÇÃO AUTOMÁTICA SAIU AQUI, na v5.234.) Da v1.68 até aqui este
        // ponto tinha um `WebUpdater.aplicarSozinho` que trocava a base no
        // instante em que ela ficava pronta, sem perguntar. Ele nasceu contra um
        // defeito real — "entra no próximo lançamento" nunca chegava, porque o
        // processo não morre — e o diagnóstico continua válido; o remédio é que
        // era largo demais. Quem decide QUANDO o telão pisca é o operador, e
        // agora ele é perguntado: o `controle.js` desenha o aviso e chama
        // `otaApply()`. O que tornou isso possível foi consertar a CAUSA — a
        // detecção ficou rápida e a supressão do lado web perdeu o espelho, que
        // era permanente e travava tudo. Ver o KDoc de `WebUpdater.aoChegar`.

        // Notificação de controles / tela de bloqueio / botões de mídia: o
        // sistema entrega a ação aqui e ela vai para o MESMO caminho dos botões
        // da tela (`window.__avRemote` → os handlers já existentes). Nada de
        // transporte é decidido em Kotlin — ver [SessionRemote].
        SessionRemote.onAction = { action ->
            val js = "window.__avRemote && window.__avRemote(${JSONObject.quote(action)});"
            runOnUiThread { web?.evaluateJavascript(js, null) }
        }

        // O serviço de sincronização pode morrer sem que ninguém aqui peça
        // (cota de FGS do Android 15). Se `backgroundWork` continuasse `true`, o
        // `if (on == backgroundWork)` de [setBackgroundWork] trataria o próximo
        // `keepAlive(true)` como repetido e o download seguinte ficaria sem
        // proteção nenhuma — em silêncio, que é a pior forma de perder isso.
        //
        // O TOKEN DE GERAÇÃO fecha a corrida do outro lado: entre o aviso do
        // `onTimeout` e o runnable rodar, um `keepAlive(true)` novo pode ter
        // mudado o estado (e subido o serviço de novo) — zerar por cima dele
        // recriava exatamente o defeito que este hook existe para evitar. A
        // geração é capturada NO MOMENTO do aviso; se ela mudou até a execução,
        // o estado já é de outro download e o runnable não toca em nada.
        SyncService.onGone = {
            val gen = backgroundWorkGen
            runOnUiThread {
                if (gen == backgroundWorkGen) backgroundWork = false
            }
        }

        // OS HOOKS DO ESPELHO, no `onCreate` e não no `startMirror`, pela mesma
        // razão do `SyncService.onGone` logo acima: eles capturam ESTA Activity,
        // e o espelho sobrevive a uma recriação de tela. Definidos só ao ligar,
        // uma mudança de fonte do sistema deixaria o botão "Desligar" da
        // notificação sem efeito — a única janela para o espelho com o app
        // minimizado, com o botão morto e nada dizendo por quê.
        //
        // `onGone` é o serviço morrendo sem ninguém pedir: o Kotlin tem de
        // ESQUECER que estava servindo, senão sobra um servidor sem serviço e a
        // folha continua dizendo "ligado".
        EspelhoEnergia.onDesligar = { stopMirror() }
        EspelhoEnergia.onGone = { runOnUiThread { desmontarEspelho() } }
        EspelhoEnergia.onTermica = { grau -> aoEsquentar(grau) }

        onBackPressedDispatcher.addCallback(this) { handleBack() }
    }

    /**
     * Neutraliza o ACTION_SEND já lido.
     *
     * O intent da Activity é reentregue em toda recriação; sem apagar a ação e
     * os extras, um compartilhamento consumido volta a ser encontrado e o
     * arquivo é importado de novo. `setIntent` mantém `getIntent()` coerente
     * com o objeto mutado, para nenhum outro caminho (por exemplo um
     * `onNewIntent` que reuse o mesmo Intent) reencontrar o conteúdo.
     */
    private fun consumeShareIntent() {
        val i = intent ?: return
        if (i.action != Intent.ACTION_SEND && i.action != Intent.ACTION_SEND_MULTIPLE) return
        i.action = Intent.ACTION_MAIN
        i.removeExtra(Intent.EXTRA_STREAM)
        i.removeExtra(Intent.EXTRA_TEXT)
        i.removeExtra(Intent.EXTRA_SUBJECT)
        setIntent(i)
    }

    /**
     * Botão VOLTAR do aparelho.
     *
     * Ele NUNCA encerra a Activity — no fim da fila apenas manda a tarefa para
     * segundo plano, com a sessão (e a `Presentation` na TV) viva. Quem sabe se
     * há popup, pasta aberta ou preview em tela cheia é o lado web
     * (`window.__avBack`): invariante 5, nenhuma hierarquia reimplementada aqui.
     *
     * A RESPOSTA É ASSÍNCRONA, e por isso há um prazo: `evaluateJavascript`
     * devolve por callback, e com o renderer morto, travado, ou num bundle sem
     * `__avBack`, esse callback pode nunca chegar — um voltar que não faz NADA é
     * pior que um que minimiza. O `postDelayed` garante a resposta padrão.
     *
     * O `AtomicBoolean` garante que `moveTaskToBack` roda no MÁXIMO uma vez por
     * toque. Ele NÃO garante que o app não minimize depois de o web já ter
     * fechado um popup: `__avBack()` executa de forma síncrona e o que chega
     * tarde é a RESPOSTA, não a ação — com o renderer ocupado o prazo pode
     * vencer com o popup já fechado. Fechar isso exigiria um token de corrida
     * (`__avBack(token)` → `__avResolve`), mudança de contrato da ponte; o prazo
     * é curto justamente para o caso comum nunca chegar perto dele.
     */
    private fun handleBack() {
        val w = web
        if (w == null) { moveTaskToBack(true); return }
        val resolvido = java.util.concurrent.atomic.AtomicBoolean(false)
        val minimizar = Runnable {
            if (resolvido.compareAndSet(false, true)) moveTaskToBack(true)
        }
        // Um bundle web anterior à v5.32 não define `__avBack`; o `try` devolve
        // false e o comportamento volta a ser o de sempre, sem erro no console.
        val js = "(function(){try{return !!(window.__avBack && window.__avBack());}" +
            "catch(e){return false;}})();"
        w.evaluateJavascript(js) { r ->
            if (r == "true") resolvido.set(true) else minimizar.run()
        }
        w.postDelayed(minimizar, BACK_JS_TIMEOUT_MS)
    }

    /**
     * Monta (ou remonta) o WebView do Controle. A remontagem acontece quando o
     * renderer morre: sem isso o framework mataria o processo inteiro, levando
     * junto a projeção na TV.
     */
    private fun buildControleWebView() {
        if (isFinishing || isDestroyed) return
        val loader = WebViewFactory.assetLoader(this)
        val w = WebViewFactory.create(this, loader, withSaf = true) {
            web = null
            // O estado de "download em curso" pertencia ao documento que acabou
            // de morrer: os `fetch` morreram com o renderer e o `finally` de
            // `withBgWork()` nunca vai rodar, então NINGUÉM mais chamaria
            // `keepAlive(false)`. Sem zerar aqui, sobravam para sempre o
            // foreground service, a notificação congelada no último progresso e
            // o wake lock parcial (2 h) — e, pior, a guarda de
            // [setBackgroundWork] fazia o próximo download real virar no-op.
            // A página nova recomeça a contagem do zero e volta a pedir a
            // proteção se ainda houver trabalho.
            if (backgroundWork) {
                backgroundWork = false
                try { SyncService.stop(this@MainActivity) } catch (e: Exception) {
                    Log.w(TAG, "serviço de sincronização não parou", e)
                }
            }
            // E A EXPORTAÇÃO EM CURSO, pela MESMA razão e com uma consequência
            // pior (shell 63): o empurrão dos blocos morreu com o renderer, mas
            // o destino do SAF continuaria ABERTO — e o que ficaria no cartão do
            // operador é meio acervo com nome de acervo inteiro, que importa em
            // silêncio até o registro em que os bytes acabam. `descartarPacote`
            // fecha e APAGA o parcial; a página nova não sabe que houve uma
            // exportação e nunca a retomaria.
            descartarPacote()
            // MESMA classe de estado do documento morto: os dois foram ligados
            // pela página que acabou de morrer, e a nova pede de novo ao
            // carregar. `captureVolumeKeys` órfão é o pior dos dois — com a
            // página morta (ou a recarga falhando), a Activity seguia
            // consumindo as teclas e entregando o passo a um `__avVolumeKey`
            // que não existe: o aparelho ficava sem NENHUM controle de volume.
            captureVolumeKeys = false
            // E A TELA CHEIA, a peça mais cara das três. `onShowCustomView`
            // guarda estado que vive na ACTIVITY (`customView`,
            // `customCallback`, a visibilidade dos dois containers e a trava de
            // paisagem), e o único ponto que o desfazia era `onHideCustomView` —
            // um método do WebChromeClient do WebView que acabou de morrer, e
            // que portanto nunca mais será chamado.
            //
            // Sem isto, `buildControleWebView` acrescenta o WebView NOVO a um
            // `webContainer` que continua `GONE`, com a View de tela cheia órfã
            // por cima. E este é o culto SEM TV, em que a preview em tela cheia
            // É a projeção: o renderer morre por OOM, o app remonta tudo certo
            // por dentro, e a tela fica congelada sem caminho de volta.
            sairDaTelaCheia(false)
            webContainer.post { buildControleWebView() }
        }
        w.webChromeClient = ControleChromeClient()
        val bridge = NativeBridge(
            ctx = applicationContext,
            role = "controle",
            host = this,
            webRef = { web },
        )
        w.addJavascriptInterface(bridge, "__AVBridge")
        webContainer.addView(w, matchParent())
        web = w
        MessageBus.attach(w)
        // O canal de mídia do telão por comandos (E4) — POR INSTÂNCIA de
        // WebView, como o do áudio do espelho: a remontagem por morte de
        // renderer chega aqui de novo e o reinstala sozinha. Instalado sempre
        // (a presença de `window.__avTelaMidia` é como o lado web detecta o
        // suporte); com a transmissão desligada o cache resolve nulo e o
        // canal recusa com frase.
        espelhoMidiaCanal.instalar(w)
        // O canal do PACOTE (shell 63), pela mesma regra e no mesmo lugar: por
        // instância de WebView, reinstalado sozinho a cada remontagem. Instalado
        // SEMPRE — a presença de `window.__avPacote` é como o lado web detecta o
        // suporte, exatamente como faz com o `__avTelaMidia` — e sem destino
        // aberto ele recusa todo bloco com `-1`.
        pacoteCanal.instalar(w)
        // A BASE SERVIDA MUDOU DESDE O LANÇAMENTO ANTERIOR: limpar o cache
        // antes de carregar. Ver `WebUpdater.baseTrocou` — as URLs não mudam de
        // nome entre versões da base, então sem isto a página nasce com metade
        // de cada bundle. O cache é do processo (os dois WebViews o dividem),
        // então basta aqui: o telão é criado depois e já pega o cache limpo.
        if (WebUpdater.baseTrocou) w.clearCache(true)
        // A PROTEÇÃO DA PREVIEW ATRAVESSA A REMONTAGEM (v1.3.12). Ela pertence à
        // CONEXÃO (não há tela lá fora), não ao documento que acabou de morrer —
        // e é justamente durante a recarga, com o renderer novo ainda montando a
        // página, que a página não tem como pedi-la de volta.
        aplicarProjecaoLocal()
        w.loadUrl(WebViewFactory.URL_CONTROLE)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val share = ShareIntake.parse(this, intent)
        // Consumido assim que lido — inclusive quando o parse devolve null, para
        // um intent inútil não ficar pendurado como o intent da Activity.
        consumeShareIntent()
        if (share == null) return
        pendingShare.set(share)
        // App já aberto: empurra o share na hora, sem esperar um novo init.
        web?.evaluateJavascript("window.__avShareArrived && window.__avShareArrived();", null)
    }

    override fun onResume() {
        super.onResume()
        syncPresentation()
        // VOLTAR AO APP É UM GATILHO. É quando o operador agiria sobre o aviso,
        // e é quando a rede costuma estar de volta (ele saiu, trocou de Wi-Fi,
        // ligou os dados). Rajadas de `onResume` — alternar entre dois apps
        // dispara um por toque — são absorvidas pelo piso do `checkAsync`.
        //
        // `forcar`, e é a exceção que prova a regra do piso: a retomada é o
        // único instante em que a resposta pode virar uma pergunta na tela, e
        // chegar cinco segundos atrasada nela é chegar depois de o operador já
        // ter olhado. Ela acontece no máximo uma vez por vinda ao app.
        WebUpdater.emPrimeiroPlano = true
        WebUpdater.checkAsync(this, "retomada", forcar = true)
    }

    /**
     * O ritmo da ronda segue a atenção do operador (v5.234).
     *
     * Não é economia de bateria — a ronda é um JSON de trezentos bytes. É que o
     * desfecho de uma detecção em segundo plano é uma pergunta que ninguém pode
     * responder: o aviso mora no WebView do Controle, e é justamente ele que o
     * Android estrangula quando o app sai da frente. A detecção continua
     * acontecendo, mais espaçada, para que a resposta já esteja pronta na
     * retomada — que é onde o gatilho acima a colhe.
     */
    override fun onPause() {
        super.onPause()
        WebUpdater.emPrimeiroPlano = false
    }

    /**
     * O app saiu da frente — e é AQUI que a projeção precisa ser defendida.
     *
     * O Chromium suspende o WebView quando o app vai para segundo plano, e o
     * telão é a única coisa do app que não pode parar: ele está na TV, na
     * frente da congregação. `keepPlaying()` desfaz essa suspensão no instante
     * exato em que ela aconteceria.
     *
     * O WebView do CONTROLE não recebe o mesmo tratamento de propósito: ali ser
     * desacelerado em segundo plano é o comportamento certo (é o celular na mão
     * de alguém), e é justamente o que o `snoopDisplayStatus` da ponte existe
     * para contornar.
     */
    override fun onStop() {
        super.onStop()
        presentation?.keepPlaying()
        // E O CONTROLE SÓ QUANDO ELE É A PROJEÇÃO (v1.3.12). Com telão ou tela
        // na rede ele volta a ser estrangulado, que é o certo para uma mesa de
        // comando: o som está lá fora, e é o `snoopDisplayStatus` que contorna o
        // estrangulamento. SEM nenhuma delas, quem toca é o `<video>` da preview
        // — e aí este WebView É a projeção. Ver [setProjecaoLocal].
        if (projecaoLocal) {
            try { web?.onResume(); web?.resumeTimers() } catch (e: Exception) {
                Log.w(TAG, "o WebView do Controle não retomou no onStop", e)
            }
        }
    }

    override fun onDestroy() {
        // O hook sai antes de tudo: ele captura esta Activity, e uma chamada
        // depois daqui mexeria num campo de uma tela que não existe mais.
        SyncService.onGone = null
        // Sem o WebView não há download para proteger — o serviço não pode
        // sobreviver à Activity segurando um wake lock à toa.
        if (backgroundWork) {
            backgroundWork = false
            try { SyncService.stop(this) } catch (e: Exception) {
                Log.w(TAG, "serviço de sincronização não parou", e)
            }
        }
        // Idem para a sessão: sem WebView não há quem execute a ação, e a
        // notificação de controles viraria um painel de botões mortos.
        SessionRemote.onAction = null
        // E A EXPORTAÇÃO EM CURSO, SEM A GUARDA DE `isChangingConfigurations`
        // (shell 63) — ao contrário do serviço de mídia e da transmissão, que
        // sobrevivem a uma recriação de propósito. Aqui não há o que sobreviver:
        // quem empurrava os blocos era o DOCUMENTO desta Activity, e ele morre
        // com ela nos dois casos. O que ficaria aberto é um destino do SAF que
        // ninguém mais alimenta, com meio acervo dentro e nome de acervo
        // inteiro. `descartarPacote` fecha e apaga; sem nada aberto é no-op.
        descartarPacote()
        // E o empurrão do OTA, pelo mesmo motivo dos dois acima: ele captura
        // esta Activity, e a ronda do `WebUpdater` sobrevive à tela.
        WebUpdater.aoChegar = null
        // A SESSÃO DE MÍDIA NÃO CAI NUMA RECRIAÇÃO (v1.4.19) — a mesma guarda do
        // espelho, logo abaixo, e pelo mesmo motivo, que só tinha sido aplicado a
        // ele.
        //
        // Parar o serviço aqui numa mudança de configuração custa mais que a
        // notificação: ele é o único serviço em PRIMEIRO PLANO de um culto
        // normal, e é o que impede o Android de congelar (12+) ou matar o
        // processo — o dos dois WebViews e da `Presentation`. Derrubado, o
        // `onCreate` seguinte precisa reerguê-lo, e `SessionService.iniciar`
        // ENGOLE a `ForegroundServiceStartNotAllowedException` (com razão: não há
        // o que fazer com ela). O desfecho seria um app minimizado durante o
        // culto de volta a ser descartável — exatamente o defeito que este
        // serviço foi criado para resolver.
        //
        // Numa recriação quem mantém a cena é o próprio serviço, que sobrevive à
        // Activity; o `onCreate` seguinte republica por cima quando o web voltar
        // a chamar `nowPlaying`.
        if (!isChangingConfigurations) {
            try { SessionService.stop(this) } catch (_: Exception) { }
        }
        // A TRANSMISSÃO NÃO SOBREVIVE AO FECHAMENTO DO APP — ela é auxiliar e
        // nasceu de um toque do operador. Deixá-la servindo com a Activity morta
        // manteria um `ServerSocket` na rede da igreja sem ninguém capaz de
        // desligá-lo, e as telas ficariam com a última cena congelada na frente
        // da congregação.
        //
        // `!isChangingConfigurations` NÃO É ZELO. Uma recriação de Activity
        // derrubaria a transmissão no meio do culto — e o `onCreate` seguinte
        // NÃO a traria de volta (nada aqui religa um servidor que o operador não
        // mandou religar, e o `ligar()` zera o pareamento: as três telas
        // voltariam ao botão de entrada). Numa recriação quem mantém tudo vivo é
        // o serviço em primeiro plano, e a referência do servidor está no
        // COMPANION por isto.
        //
        // ELA CONTINUA VALENDO DEPOIS DA v1.4.19, que encheu o `configChanges`
        // do manifest com as sete chaves que faltavam (`keyboard`, `fontScale`,
        // `locale`, `colorMode`…). Aquilo torna a recriação RARA; não a torna
        // impossível — sobram as configurações que nenhuma lista cobre e as
        // recriações que não vêm de configuração nenhuma. Esta guarda é o que
        // decide o desfecho quando uma acontece, e o mesmo raciocínio passou a
        // valer para o `SessionService`, logo acima.
        if (!isChangingConfigurations) {
            try {
                telaoPedido = false
                acervoPedido = false
                desmontarEspelho()
            } catch (e: Exception) {
                Log.w(TAG, "espelho não desligou", e)
            }
            // O CLONE MORRE COM A ACTIVITY pelo mesmo motivo da transmissão, e
            // com uma razão a mais: o anúncio mDNS é a única coisa deste app
            // que fica VISÍVEL na rede sem nenhuma tela dizendo que está — um
            // aparelho continuar se oferecendo com o app fechado é a falha
            // silenciosa que este recurso não pode ter.
            try {
                AcervoCessao.desligar()
                AcervoDescoberta.tudoAbaixo()
                AcervoProxy.soltar()
            } catch (e: Exception) {
                Log.w(TAG, "clone não desligou", e)
            }
        }
        // Os hooks saem SEMPRE, inclusive numa recriação: eles capturam ESTA
        // Activity, e o `onCreate` da próxima os redefine incondicionalmente —
        // é justamente por isso que eles são armados lá e não no `startMirror`.
        // Um hook apontando para uma tela morta é o mesmo defeito que o
        // `SyncService.onGone = null` daqui de cima já evita. (A ordem do
        // Android numa mudança de configuração é `onDestroy` da antiga e só
        // então `onCreate` da nova, então não há janela em que o espelho fique
        // sem dono.)
        EspelhoEnergia.onDesligar = null
        EspelhoEnergia.onGone = null
        EspelhoEnergia.onTermica = null
        displayManager?.unregisterDisplayListener(displayListener)
        // A escada de retomada captura ESTA Activity pelo `Runnable`: um pedido
        // em voo levantaria uma `Presentation` de uma tela que já morreu.
        cancelarRetomadaDoTelao()
        telaoDisplayId = -1
        presentation?.let {
            it.release()
            it.dismiss()
        }
        presentation = null
        web?.let {
            MessageBus.detach(it)
            webContainer.removeView(it)
            it.destroy()
        }
        web = null
        super.onDestroy()
    }

    // ---------- Presentation (o telão) ----------

    private val displayListener = object : DisplayManager.DisplayListener {
        override fun onDisplayAdded(displayId: Int) = syncPresentation()
        override fun onDisplayRemoved(displayId: Int) = syncPresentation()
        override fun onDisplayChanged(displayId: Int) = syncPresentation()
    }

    /**
     * As telas de apresentação EXTERNAS. Os dois pontos que perguntam "há
     * telão?" ([syncPresentation] e [listDisplays]) passam por aqui; filtrar na
     * fonte cobre de uma vez o `renderDisplayStatus`, o `applyPreviewAspect` e o
     * `simpleDisplay` do lado web, que leem o mesmo `lastDisplays`.
     *
     * HOJE ELE NÃO EXCLUI NADA, e precisa estar escrito, ou o próximo leitor o
     * apaga como código morto e leva a proteção junto. O que ele garante é que
     * NENHUM display privado vira telão: sem isso, [syncPresentation] criaria
     * uma `StagePresentation` numa janela que o operador não vê — e que, porque
     * `StagePresentation.buildWebView` instala o [MicChromeClient], estaria
     * habilitada a abrir o microfone do templo.
     *
     * O predicado é ESTRUTURAL (`Display.FLAG_PRIVATE`), nunca um nome nem um id
     * adivinhado. E o risco não é janela de corrida: no Android 14+ a ordenação
     * de `getDisplays` por tipo foi removida (hoje é ordem de `displayId`)
     * enquanto o javadoc continua prometendo "sorted by order of preference" —
     * é determinístico, e por isso a resposta é um filtro e não um `firstOrNull`
     * mais esperto.
     */
    private fun telasExternas(): List<Display> {
        val dm = displayManager ?: return emptyList()
        // A exclusão por displayId saiu com a tela virtual do espelho de pixels
        // (E6/E7); o filtro de FLAG_PRIVATE fica — é o cinto contra o Android
        // 14+ ter removido a ordenação por tipo de getDisplays, e contra
        // qualquer display privado que apareça aqui no futuro.
        return dm.getDisplays(DisplayManager.DISPLAY_CATEGORY_PRESENTATION).filter { d ->
            (d.flags and Display.FLAG_PRIVATE) == 0
        }
    }

    /**
     * Mantém no ar exatamente uma Presentation na primeira tela de
     * apresentação disponível — e nenhuma quando não há TV conectada (aí o
     * app funciona como o PWA sozinho: a preview em tela cheia projeta).
     */
    private fun syncPresentation() {
        if (displayManager == null) return
        val target = telasExternas().firstOrNull()
        val current = presentation

        if (target == null) {
            if (current != null) {
                current.release()
                current.dismiss()
                presentation = null
            }
            // NOTIFICA MESMO SEM PRESENTATION A DERRUBAR, e é este o defeito do
            // "ícone de cast continua vermelho depois de desconectar".
            //
            // Quando o dongle cai por distância, o sistema derruba a janela
            // sozinho: o `setOnDismissListener` abaixo zera `presentation` sem
            // avisar ninguém. O `onDisplayRemoved` que vem em seguida encontrava
            // `current == null`, entrava neste ramo e SAÍA SEM NOTIFICAR — o lado
            // web ficava com a última lista que recebeu, que ainda tinha a TV, e
            // o ícone seguia aceso. A saída antecipada estava dentro do `if`
            // errado: a notificação é sobre a TELA, não sobre a janela.
            //
            // A TELA SUMIU DE VERDADE: não há telão a retomar, e o caminho
            // normal (a preview assume o som) já é o certo. Cancelar aqui é o
            // que impede a escada de ficar batendo numa tela que foi embora.
            cancelarRetomadaDoTelao()
            telaoDisplayId = -1
            notifyDisplayChange()
            return
        }

        if (current != null) {
            if (current.display.displayId == target.displayId && current.isShowing) {
                // A mesma tela, a mesma janela: nada mudou para o app — mas o
                // `onDisplayChanged` também chega quando a RESOLUÇÃO muda, e é
                // ela que o rodapé de Configurações exibe. Notificar aqui é um
                // `evaluateJavascript` com uma leitura de lista do outro lado; o
                // lado web já deduplica pelo que desenha.
                cancelarRetomadaDoTelao()
                telaoDisplayId = target.displayId
                notifyDisplayChange()
                return
            }
            current.release()
            current.dismiss()
            presentation = null
        }

        val p = StagePresentation(this, target)
        p.setOnDismissListener {
            // Dismiss ESPONTÂNEO (o sistema derrubou a janela sem passar pelos
            // caminhos daqui): só anular a referência deixava o WebView do
            // telão vivo no MessageBus — recebendo comandos e, com autoplay
            // liberado, podendo TOCAR áudio numa janela que ninguém vê. O
            // `release()` é idempotente (na segunda chamada `web` já é null),
            // então os caminhos que já liberam antes do dismiss não pagam nada.
            if (presentation === p) {
                presentation = null
                p.release()
                // E AVISA O LADO WEB. Este é o caminho da queda por distância —
                // o sistema derruba a janela antes (ou sem) qualquer
                // `onDisplayRemoved` —, e sem esta linha o Controle só descobria
                // a desconexão no próximo evento do DisplayManager, que pode não
                // vir. `listDisplays` é reconsultado do outro lado, então se a
                // tela ainda estiver lá o web agora VÊ a diferença (`telao`) —
                // e é por isso que a escada abaixo é armada junto: a janela caiu
                // sozinha, mas a tela pode continuar lá, e ninguém mais tentaria
                // levantá-la.
                telaoDisplayId = -1
                notifyDisplayChange()
                agendarRetomadaDoTelao()
            }
        }
        try {
            p.show()
            presentation = p
            telaoDisplayId = target.displayId
            cancelarRetomadaDoTelao()
        } catch (e: Exception) {
            // A tela sumiu entre a consulta e o show() (dongle instável), ou o
            // WindowManager recusou o token. `show()` roda `onCreate` ANTES do
            // addView que lança: o WebView do telão já existe, já entrou no
            // MessageBus e já pediu a URL. Descartar só a referência deixaria
            // esse WebView vivo recebendo comandos e — com autoplay liberado —
            // TOCANDO áudio numa janela que ninguém vê. Liberar é obrigatório.
            Log.w(TAG, "tela de apresentação sumiu antes do show()", e)
            p.release()
            try { p.dismiss() } catch (_: Exception) { /* nunca chegou a exibir */ }
            presentation = null
            telaoDisplayId = -1
            // E TENTA DE NOVO. Sem isto a falha é DEFINITIVA: `syncPresentation`
            // só volta a rodar por um evento do DisplayManager — que numa tela
            // que continua listada não vem — ou por um `onResume`, que exige o
            // operador sair do app e voltar. É este o "conectei e não veio nada,
            // nem som".
            agendarRetomadaDoTelao()
        }
        notifyDisplayChange()
    }

    /**
     * Reagenda [syncPresentation] com espera crescente. Um pedido em voo NÃO é
     * reagendado: a escada é do episódio, não da chamada, e `onDisplayChanged`
     * chega em rajada durante uma negociação de Miracast — sem esta guarda cada
     * evento reiniciaria a contagem e a espera nunca cresceria.
     */
    private fun agendarRetomadaDoTelao() {
        if (telaoRetryPendente) return
        if (telaoTentativa >= TELAO_ESPERAS.size) return
        val espera = TELAO_ESPERAS[telaoTentativa]
        telaoTentativa++
        telaoRetryPendente = true
        webContainer.postDelayed(telaoRetomar, espera)
    }

    private fun cancelarRetomadaDoTelao() {
        telaoTentativa = 0
        telaoRetryPendente = false
        webContainer.removeCallbacks(telaoRetomar)
    }

    private fun notifyDisplayChange() {
        web?.evaluateJavascript("window.__avDisplaysChanged && window.__avDisplaysChanged();", null)
    }

    // ---------- botões físicos de volume ----------

    /**
     * Os botões de volume passam a mexer no **fader do app**, não na saída do
     * sistema.
     *
     * Era esse o problema durante o espelhamento: o Android roteia os botões
     * para a saída em uso, e com Miracast/Smart View ativo isso vira o volume da
     * TV — o operador mexia no botão e o fader não saía do lugar. Consumindo a
     * tecla aqui (`return true`, também no `onKeyUp`, senão o sistema ainda
     * reage à soltura) o evento vira um passo no `#volSlider`, como arrastar o
     * fader.
     *
     * **Válvula de escape:** com o fader no máximo (ou no zero), o lado web
     * devolve a tecla via `adjustSystemVolume()` e ela volta a valer para o
     * sistema, com a UI de volume do Android. Sem isso, um aparelho com o volume
     * de mídia baixo ficaria sem jeito de subir com o app aberto.
     */
    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        if (captureVolumeKeys && isVolumeKey(keyCode)) {
            val step = if (keyCode == KeyEvent.KEYCODE_VOLUME_UP) 1 else -1
            web?.evaluateJavascript("window.__avVolumeKey && window.__avVolumeKey($step);", null)
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onKeyUp(keyCode: Int, event: KeyEvent): Boolean {
        if (captureVolumeKeys && isVolumeKey(keyCode)) return true
        return super.onKeyUp(keyCode, event)
    }

    private fun isVolumeKey(keyCode: Int) =
        keyCode == KeyEvent.KEYCODE_VOLUME_UP || keyCode == KeyEvent.KEYCODE_VOLUME_DOWN

    // ---------- BridgeHost ----------

    override fun requestFolderPick(onResult: (Uri?) -> Unit) {
        runOnUiThread {
            // Um pedido anterior ainda em voo é RESOLVIDO como cancelado antes
            // de ser sobrescrito — o mesmo padrão do `onShowFileChooser`. Esta
            // Promise não tem prazo no lado web (espera uma pessoa), então um
            // callback atropelado era uma Promise pendurada para sempre.
            pendingFolderPick?.invoke(null)
            pendingFolderPick = onResult
            try {
                folderPicker.launch(null)
            } catch (e: Exception) {
                Log.w(TAG, "seletor de pasta indisponível", e)
                pendingFolderPick = null
                onResult(null)
            }
        }
    }

    override fun requestDocPick(mimes: Array<String>, onResult: (List<Uri>) -> Unit) {
        runOnUiThread {
            // Mesmo padrão do [requestFolderPick]: o pendente resolve vazio
            // antes de ser sobrescrito, senão a Promise sem prazo do lado web
            // fica pendurada para sempre.
            pendingDocPick?.invoke(emptyList())
            pendingDocPick = onResult
            try {
                docPicker.launch(mimes)
            } catch (e: Exception) {
                Log.w(TAG, "seletor de documento indisponível", e)
                pendingDocPick = null
                onResult(emptyList())
            }
        }
    }

    override fun requestTextSave(nome: String, texto: String, onResult: (String) -> Unit) {
        runOnUiThread {
            // Mesmo padrão do [requestDocPick]: o pendente resolve vazio antes
            // de ser sobrescrito, senão a Promise sem prazo do lado web fica
            // pendurada para sempre.
            pendingTextSave?.second?.invoke("")
            pendingTextSave = texto to onResult
            try {
                textSaver.launch(nome)
            } catch (e: Exception) {
                Log.w(TAG, "seletor de gravação indisponível", e)
                pendingTextSave = null
                onResult("")
            }
        }
    }

    override fun requestPacoteCreate(nome: String, onResult: (String) -> Unit) {
        runOnUiThread {
            // Mesmo padrão do [requestTextSave]: o pendente resolve vazio antes
            // de ser sobrescrito, senão a Promise sem prazo do lado web fica
            // pendurada para sempre.
            pendingPacoteCreate?.invoke("")
            pendingPacoteCreate = onResult
            try {
                pacoteSaver.launch(nome)
            } catch (e: Exception) {
                Log.w(TAG, "seletor de gravação do pacote indisponível", e)
                pendingPacoteCreate = null
                onResult("")
            }
        }
    }

    override fun pacoteFinish(onResult: (Long) -> Unit) {
        runOnUiThread { onResult(pacoteCanal.fechar()) }
    }

    override fun pacoteCancel() {
        runOnUiThread { descartarPacote() }
    }

    /**
     * Fecha o pacote em curso e APAGA o documento parcial.
     *
     * NOME PRÓPRIO, e não uma sobrecarga do [pacoteCancel] acima: em Kotlin as
     * duas teriam a MESMA assinatura na JVM — o compilador as recusa, e a
     * versão que "compilaria" (o `override` chamando a si mesmo dentro do
     * `runOnUiThread`) é recursão infinita na main thread.
     *
     * A ORDEM IMPORTA: o `uriEmCurso()` é lido ANTES do `fechar()`, que o zera.
     * Apagar um documento que o operador já vê no gerenciador de arquivos é a
     * resposta certa aqui — meio acervo com nome de acervo inteiro é pior que
     * arquivo nenhum, porque ele importa em silêncio até o registro em que os
     * bytes acabam.
     *
     * Roda na main (é de lá que os dois chamadores vêm: o `pacoteCancel` da
     * ponte e o `onRendererGone`), e é idempotente — sem nada aberto, o
     * `fechar()` devolve `-1` e o `uri` já é nulo.
     */
    private fun descartarPacote() {
        val alvo = pacoteCanal.uriEmCurso()
        pacoteCanal.fechar()
        if (alvo == null) return
        try {
            DocumentsContract.deleteDocument(contentResolver, alvo)
        } catch (e: Exception) {
            // O provedor pode recusar a exclusão (nuvem, somente-leitura). Aí
            // sobra o parcial no cartão, e é o cabeçalho do próprio arquivo que
            // impede o estrago: sem o registro `fim`, a importação recusa o
            // pacote inteiro em vez de aceitar meia biblioteca.
            Log.w(TAG, "não consegui apagar o pacote parcial", e)
        }
    }

    /**
     * O NOME DE EXIBIÇÃO de um documento recém-criado, para a tela poder dizer
     * onde o arquivo ficou. Cai no último segmento do URI quando o provedor não
     * responde — feio, mas nunca vazio: vazio é o código de "desistiu".
     */
    private fun nomeVisivelDoDocumento(uri: Uri): String {
        val nome = try {
            contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
                ?.use { c ->
                    val i = c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (i >= 0 && c.moveToFirst()) c.getString(i) else null
                }
        } catch (_: Exception) { null }
        return (nome ?: uri.lastPathSegment ?: "pacote").substringAfterLast('/')
    }

    /**
     * O SELETOR DE COMPARTILHAMENTO, com um texto (shell 63).
     *
     * `createChooser` e não um `startActivity` cru: sem ele o Android manda
     * direto para o app "padrão" de compartilhamento — e não existe padrão certo
     * aqui, porque a pergunta é *"para QUEM eu mando isto?"*, que muda a cada
     * vez. O chooser é a tela em que essa pergunta é feita.
     *
     * `FLAG_ACTIVITY_NEW_TASK` pelo mesmo motivo do [openExternalUrl]: o app
     * escolhido abre numa tarefa PRÓPRIA, e voltar do WhatsApp não pode
     * significar voltar para dentro desta Activity com a projeção no meio.
     */
    override fun shareText(texto: String) {
        runOnUiThread {
            try {
                val envio = Intent(Intent.ACTION_SEND)
                    .setType("text/plain")
                    .putExtra(Intent.EXTRA_TEXT, texto)
                startActivity(
                    Intent.createChooser(envio, getString(R.string.share_app_titulo))
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                )
            } catch (e: Exception) {
                // Um aparelho sem NADA que receba texto é improvável, e um
                // `ActivityNotFoundException` aqui derrubaria o app inteiro.
                Log.w(TAG, "nada recebeu o texto compartilhado", e)
            }
        }
    }

    override fun setBackgroundWork(on: Boolean) {
        runOnUiThread {
            if (on == backgroundWork) return@runOnUiThread
            backgroundWork = on
            // Toda mudança aceita vira uma geração nova — é contra ela que o
            // runnable atrasado do `SyncService.onGone` confere se ainda fala
            // do mesmo estado (ver o hook no onCreate).
            backgroundWorkGen++
            try {
                if (on) SyncService.start(this) else SyncService.stop(this)
            } catch (e: Exception) {
                // Um serviço recusado (política do fabricante, app em
                // background na hora do start) não pode derrubar a
                // sincronização: ela continua, só sem a proteção extra.
                Log.w(TAG, "serviço de sincronização indisponível", e)
                backgroundWork = false
            }
        }
    }

    /**
     * As telas que o lado web vê. É o escritor ÚNICO de `lastDisplays`, então o
     * filtro de [telasExternas] aqui é o que impede um display PRIVADO de
     * aparecer no app como se fosse uma TV — inclusive destravando o modo
     * simplificado, que se considera "conectado" pela primeira entrada da lista.
     * (Quem o produzia era a tela virtual do espelho de pixels, removida na
     * v5.187; ver o KDoc de [telasExternas] para por que o filtro fica.)
     */
    /**
     * As telas externas, e para cada uma **se o telão está de fato no ar nela**.
     *
     * O campo `telao` é a correção de um desencontro que durava desde o começo:
     * esta lista responde pelo DisplayManager e o lado web decidia por ela quem
     * toca o som, se o microfone é oferecido e se o Modo Fácil destrava — três
     * perguntas cuja resposta honesta é a `Presentation`, não a tela. Com a tela
     * listada e a janela no chão (o `show()` que lança num dongle instável, o
     * dismiss que o sistema faz sozinho numa oscilação de Miracast) o web calava
     * a preview por haver "para onde mandar o som" e não havia telão tocando:
     * **silêncio nos dois lados**, sem erro em lugar nenhum.
     *
     * A tela CONTINUA na lista quando o telão não subiu, e é isso que separa
     * este campo de um filtro: "não há TV" e "a TV está aí e o telão não subiu"
     * pedem frases diferentes no Registro e na folha de conexão, e a segunda é a
     * única das duas que diz o que está acontecendo.
     */
    override fun listDisplays(): JSONArray {
        val out = JSONArray()
        val noAr = telaoDisplayId
        for (d in telasExternas()) {
            val metrics = android.util.DisplayMetrics()
            @Suppress("DEPRECATION")
            d.getRealMetrics(metrics)
            out.put(
                JSONObject()
                    .put("id", d.displayId)
                    .put("name", d.name ?: "")
                    .put("w", metrics.widthPixels)
                    .put("h", metrics.heightPixels)
                    .put("density", metrics.density.toDouble())
                    .put("telao", d.displayId == noAr),
            )
        }
        return out
    }

    /**
     * Abre uma URL fora do app. Hoje o único chamador é o "Pesquisar … no
     * YouTube" do fim da busca do acervo: o acervo é o LouvorJA e não tem
     * tudo, e o caminho de volta para uma música que falta já existe (o
     * `intent-filter` de share). Faltava a ida.
     *
     * `ACTION_VIEW` sem escolher pacote: quem reivindica `youtube.com` no
     * aparelho abre — o app do YouTube, se instalado; o navegador, se não. O
     * esquema já foi restringido a `https` em [NativeBridge.openExternal].
     *
     * `FLAG_ACTIVITY_NEW_TASK` porque isto sai de uma thread do WebView por
     * um `post`, e o alvo tem de virar tarefa própria: o app de projeção
     * continua na dele, com a `Presentation` viva na TV.
     */
    override fun openExternalUrl(url: String) {
        runOnUiThread {
            try {
                startActivity(
                    Intent(Intent.ACTION_VIEW, Uri.parse(url))
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                )
            } catch (e: Exception) {
                // Aparelho sem nada que abra http(s) é improvável, mas um
                // `ActivityNotFoundException` aqui derrubaria o app inteiro.
                Log.w(TAG, "nada abriu a URL externa", e)
            }
        }
    }

    /**
     * Seletor de ESPELHAMENTO DE TELA (Smart View / Wireless display) — NÃO o
     * Google Cast. Os dois convivem no Android e são coisas diferentes: o Cast
     * envia uma URL para o dispositivo tocar sozinho; o espelhamento manda a
     * imagem da tela, que é o que este app precisa sem Presentation.
     *
     * `Settings.ACTION_CAST_SETTINGS` cai no GOOGLE CAST em vários aparelhos —
     * daí ser o último recurso. Não existe API pública para o popup das
     * configurações rápidas (`Settings.Panel` só cobre internet, wifi, nfc e
     * volume), então a cadeia procura o primeiro alvo que EXISTE neste aparelho
     * e NÃO resolve para o Play Services. As entradas da Samsung não são API
     * documentada e só são tentadas num aparelho Samsung (ver
     * `castCandidates`/`isSamsung`); não existindo, `resolveActivity` devolve
     * null e a cadeia segue.
     *
     * `resolveActivity` só enxerga esses alvos por causa do bloco `<queries>` no
     * AndroidManifest (visibilidade de pacotes do Android 11+).
     */
    override fun openCastPicker() {
        runOnUiThread {
            val chosen = pickCastIntent()
            if (chosen != null) {
                try {
                    startActivity(chosen.first.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                    return@runOnUiThread
                } catch (e: Exception) {
                    Log.w(TAG, "espelhamento recusou abrir: ${chosen.second}", e)
                }
            }
            // Nada de espelhamento neste aparelho: melhor abrir o seletor de
            // Cast (ou as Configurações) do que o botão não fazer nada.
            // Sem nenhum alvo de espelhamento: a tela de Tela vem ANTES da de
            // Cast — abrir o Google Cast é justamente o que não se quer aqui.
            for (action in listOf(Settings.ACTION_DISPLAY_SETTINGS, Settings.ACTION_CAST_SETTINGS, Settings.ACTION_SETTINGS)) {
                try {
                    startActivity(Intent(action).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                    return@runOnUiThread
                } catch (e: Exception) {
                    Log.w(TAG, "seletor indisponível: $action", e)
                }
            }
        }
    }

    /**
     * Para onde o botão de cast vai abrir, em texto — mostrado no popup de
     * Exibição. Como os alvos de espelhamento variam por fabricante e não são
     * API documentada, o operador (e quem for depurar) precisa poder VER o que
     * o aparelho ofereceu, em vez de descobrir só ao tocar.
     */
    override fun describeCastTarget(): String {
        // O rótulo do fallback tem de dizer o que o TOQUE de fato abre: sem
        // alvo de espelhamento, [openCastPicker] tenta DISPLAY_SETTINGS antes
        // de CAST_SETTINGS — anunciar "Google Cast" aqui era descrever o
        // último recurso como se fosse o primeiro.
        val chosen = pickCastIntent()
            ?: return "Configurações de tela (sem espelhamento neste aparelho)"
        return chosen.second
    }

    /**
     * Primeiro alvo de espelhamento que existe neste aparelho e **não é** o
     * Google Cast. Devolve o intent e um rótulo legível, ou null.
     */
    private fun shortComponent(pkg: String, cls: String): String =
        if (cls.startsWith("$pkg.")) pkg + "/" + cls.removePrefix(pkg) else "$pkg/$cls"

    private fun pickCastIntent(): Pair<Intent, String>? {
        for (intent in castCandidates()) {
            val target = packageManager.resolveActivity(intent, 0)?.activityInfo ?: continue
            // O alvo do Google Cast mora no Play Services. Pular aqui é o que
            // impede a cadeia de "resolver" num seletor de Cast quando ainda há
            // um de espelhamento a tentar depois.
            if (target.packageName == GMS_PACKAGE) continue
            // O componente entra no rótulo de propósito: os alvos variam por
            // fabricante e não são documentados, então quando o botão abre a
            // tela errada essa string é o que permite saber qual candidato
            // pegou, sem depender de logcat.
            return intent to (castLabel(target.packageName) + " (" + shortComponent(target.packageName, target.name) + ")")
        }
        return null
    }

    private fun castLabel(pkg: String): String = when {
        pkg.startsWith("com.samsung.android.smartmirroring") -> "Smart View"
        pkg.startsWith("com.samsung") -> "Espelhamento (Samsung)"
        pkg.startsWith("com.android.settings") -> "Espelhamento (Configurações)"
        else -> pkg
    }

    /**
     * Alvos de espelhamento, do mais específico ao mais genérico — e o ramo
     * específico é **por fabricante**: as entradas do Smart View só entram na
     * fila num aparelho Samsung (ver `isSamsung`); em qualquer outro a fila
     * começa direto no alvo AOSP.
     *
     * Para o Smart View da Samsung o nome da activity **não é adivinhado**: o
     * `PackageManager` é consultado sobre quais activities o pacote expõe
     * (`GET_ACTIVITIES`) e as exportadas entram na fila. Adivinhar o nome era
     * frágil — um palpite errado simplesmente não resolvia, a cadeia caía no
     * fallback e o botão abria o Google Cast, que é o oposto do pedido.
     *
     * Os nomes de pacote e as ações abaixo não são API documentada; nada aqui
     * quebra se não existirem (resolveActivity devolve null / startActivity
     * lança, e a cadeia segue).
     */
    private fun castCandidates(): List<Intent> {
        // MEMOIZADO POR PROCESSO: o conjunto de activities exportadas de
        // pacotes de sistema não muda enquanto o processo vive, e este método
        // roda a cada toque no botão de cast E a cada abertura de Configurações
        // (`describeCastTarget`) — sem o cache, cada uma pagava as consultas ao
        // PackageManager de novo, pelo mesmo resultado.
        castCandidatesCache?.let { return it }
        val out = mutableListOf<Intent>()
        // O ramo do Smart View só entra na fila NUM APARELHO SAMSUNG. Ele nasceu
        // do aparelho em que o app é operado, e a cadeia foi escrita em volta
        // dele — mas "Smart View primeiro" é regra de UM fabricante, não do
        // Android. Noutra marca esses pacotes não existem e a cadeia já caía no
        // caminho universal sozinha; o que a guarda acrescenta é dizer isso em
        // vez de deixar por acaso, e não varrer as activities de dois pacotes
        // ausentes a cada toque (e a cada abertura de Configurações, que chama
        // `describeCastTarget`).
        //
        // E há um caso em que o acaso não bastava: um pacote de OUTRO fabricante
        // com o mesmo nome (ou uma ROM que carregue os apps da Samsung) entraria
        // na frente do alvo AOSP sem que nada aqui tivesse decidido isso.
        if (isSamsung()) {
            for (pkg in SAMSUNG_MIRROR_PACKAGES) {
                for (cls in exportedActivities(pkg)) {
                    out.add(Intent().setClassName(pkg, cls))
                }
            }
            out.add(Intent("com.samsung.wfd.LAUNCH_WFD_PICKER"))
        }
        // O caminho UNIVERSAL, e o primeiro em qualquer aparelho que não seja
        // Samsung. AOSP: a tela de "Wireless display / Transmitir tela". Ação
        // legada, ainda declarada pelo app de Configurações em muitos aparelhos
        // — e a que NÃO é reivindicada pelo Play Services (ao contrário de
        // CAST_SETTINGS, que na Samsung testada abre o Google Cast).
        out.add(Intent("android.settings.WIFI_DISPLAY_SETTINGS"))
        // ===== E O ÚLTIMO DA CADEIA FILTRADA, que é uma REDE PARA QUEM NÃO É
        // SAMSUNG =====
        //
        // A assimetria que isto corrige: `CAST_SETTINGS` e `DISPLAY_SETTINGS`
        // são constantes PÚBLICAS do `Settings`; `WIFI_DISPLAY_SETTINGS` é um
        // literal — ação interna do AOSP, que nenhum contrato obriga o
        // fabricante a declarar. Num aparelho que não seja Samsung ela era a
        // ÚNICA candidata desta cadeia: faltando, `pickCastIntent` devolvia
        // null e o toque caía no laço CEGO lá de baixo, cuja primeira parada é
        // `DISPLAY_SETTINGS` — brilho e tempo de tela, que não é seletor de
        // coisa nenhuma.
        //
        // Aquela ordem foi escolhida contra uma medição EM SAMSUNG, onde o
        // Google Cast reivindica `CAST_SETTINGS`; noutras marcas quem a
        // reivindica costuma ser o próprio app de Configurações, e ali ela É o
        // seletor de tela sem fio. Entrando AQUI, ela passa pelo filtro de GMS
        // que já existe e a pergunta é respondida pelo aparelho em vez de por
        // um palpite: dono é o Play Services, o filtro pula e nada muda (o caso
        // Samsung, medido); dono é o fabricante, ela abre a tela certa.
        //
        // No FIM da lista de propósito — na Samsung o Smart View continua vindo
        // antes, e este acréscimo não tem como reordenar nada lá.
        out.add(Intent(Settings.ACTION_CAST_SETTINGS))
        castCandidatesCache = out
        return out
    }

    /**
     * `MANUFACTURER` **ou** `BRAND`: os dois costumam dizer "samsung" num
     * aparelho de fábrica, mas uma ROM alternativa (ou um emulador) mexe num e
     * esquece o outro, e aqui errar para o lado do "não é Samsung" custaria o
     * Smart View no aparelho em que o app é de fato operado. Comparação sem
     * caixa porque o valor não é normalizado por contrato — chega "samsung" na
     * maioria e "Samsung" em alguns.
     */
    private fun isSamsung(): Boolean =
        Build.MANUFACTURER.equals(SAMSUNG_VENDOR, ignoreCase = true) ||
            Build.BRAND.equals(SAMSUNG_VENDOR, ignoreCase = true)

    /** Activities EXPORTADAS de um pacote, ou vazio se ele não existir. */
    private fun exportedActivities(pkg: String): List<String> = try {
        @Suppress("DEPRECATION")
        packageManager.getPackageInfo(pkg, PackageManager.GET_ACTIVITIES)
            .activities.orEmpty()
            .filter { it.exported }
            .map { it.name }
    } catch (_: Exception) {
        emptyList()
    }

    /**
     * Aplica a base web nova AO VIVO e recarrega as duas páginas.
     *
     * A ORDEM importa. O `resolve` da ponte é entregue por `evaluateJavascript`
     * na página do Controle — a mesma que está prestes a ser recarregada —,
     * então a recarga vai para o fim da fila da UI: assim a Promise do lado web
     * chega a resolver antes de o documento morrer. Não é essencial (quem pediu
     * a atualização vai ver a tela recarregar de qualquer jeito), mas um
     * `otaApply()` que nunca resolve deixaria um `await` pendurado para sempre
     * num caminho de erro futuro.
     *
     * O TELÃO PRIMEIRO, pelo mesmo motivo pelo qual a reconexão do dongle
     * funciona: ele carrega, dispara `display-ready`, e o Controle — já
     * recarregado ou recarregando — reenvia a cena por `resendSceneToDisplay`.
     */
    override fun applyWebUpdate(onResult: (String?) -> Unit) {
        runOnUiThread {
            val versao = WebUpdater.applyNow(this)
            onResult(versao)
            if (versao == null) return@runOnUiThread
            webContainer.post {
                try { presentation?.recarregar() } catch (e: Exception) {
                    Log.w(TAG, "telão não recarregou na atualização", e)
                }
                web?.let {
                    // Ver `StagePresentation.recarregar`: sem limpar o cache, a
                    // página nova pode ser montada com pedaços da antiga.
                    it.clearCache(true)
                    it.loadUrl(WebViewFactory.URL_CONTROLE)
                }
            }
        }
    }

    override fun requestMicPermission(onResult: (Boolean) -> Unit) {
        runOnUiThread {
            if (MicChromeClient.hasRecordAudio(this)) { onResult(true); return@runOnUiThread }
            // Mesmo padrão do [requestFolderPick]: o pedido anterior resolve
            // negado antes de ser sobrescrito — Promise sem prazo do lado web.
            pendingMicPermission?.invoke(false)
            pendingMicPermission = onResult
            try {
                micPermission.launch(android.Manifest.permission.RECORD_AUDIO)
            } catch (e: Exception) {
                Log.w(TAG, "não foi possível pedir a permissão de microfone", e)
                pendingMicPermission = null
                onResult(false)
            }
        }
    }

    override fun setCaptureVolumeKeys(on: Boolean) {
        runOnUiThread { captureVolumeKeys = on }
    }

    /**
     * A PREVIEW É A PROJEÇÃO — e por isso ela não pode ser suspensa (v1.3.12).
     *
     * Sem tela conectada quem toca é o `<video>` do WebView do CONTROLE, e o
     * Chromium pausa o `<video>` de uma página oculta. Com o app minimizado o
     * louvor calava. As três correções anteriores desta família protegiam o
     * WebView do TELÃO (v1.26, v1.27, v1.28) — este é o outro.
     *
     * As DUAS metades da suspensão, as mesmas que o telão já usa:
     *  - **a visibilidade**, que o Chromium calcula da janela E da View
     *    ([WebViewFactory.KeepVisibleWebView] mente sobre as duas);
     *  - **a prioridade do renderer**, com `waivedWhenNotVisible = false` —
     *    literalmente "não abra mão da prioridade só porque esta View não está
     *    visível".
     *
     * E a visibilidade tem DOIS donos, não um: em TELA CHEIA o WebView deixa de
     * ser quem reporta ao motor, e a mentira passa a ser do contêiner — ver
     * [KeepVisibleFrame]. É o caso mais comum do culto sem TV, porque a preview
     * em tela cheia é a projeção justamente ali.
     *
     * `onResume`/`resumeTimers` ao LIGAR porque a proteção pode chegar com o
     * app já em segundo plano (uma TV que cai no meio do culto): sem eles a
     * página ficaria com a bandeira certa e o renderer já desacelerado.
     *
     * O ESTADO É LEMBRADO ([projecaoLocal]) porque o WebView é remontado a cada
     * morte de renderer — e a página nova só pede a proteção de volta depois de
     * carregar, que é justamente o intervalo em que ela mais falta.
     */
    override fun setProjecaoLocal(on: Boolean) {
        runOnUiThread {
            projecaoLocal = on
            aplicarProjecaoLocal()
        }
    }

    /**
     * Escreve [projecaoLocal] nos DOIS lugares que reportam visibilidade ao
     * motor — o WebView do Controle e o contêiner da tela cheia. Só na main
     * thread.
     *
     * O contêiner vem ANTES da guarda do WebView de propósito: ele existe desde
     * o `onCreate` e não morre com o renderer, então não há razão para a
     * proteção da tela cheia depender de haver um WebView vivo neste instante.
     */
    private fun aplicarProjecaoLocal() {
        // Ver [KeepVisibleFrame]: em tela cheia quem fala com o motor é a View
        // do Chromium pendurada aqui, e não o WebView abaixo.
        fullscreenContainer.manterVisivel = projecaoLocal
        val w = web ?: return
        (w as? WebViewFactory.KeepVisibleWebView)?.manterVisivel = projecaoLocal
        try {
            w.setRendererPriorityPolicy(
                if (projecaoLocal) WebView.RENDERER_PRIORITY_IMPORTANT else WebView.RENDERER_PRIORITY_BOUND,
                !projecaoLocal,
            )
        } catch (e: Exception) {
            Log.w(TAG, "prioridade do renderer do Controle não mudou", e)
        }
        if (projecaoLocal) {
            try { w.onResume(); w.resumeTimers() } catch (e: Exception) {
                Log.w(TAG, "o WebView do Controle não retomou", e)
            }
        }
    }

    /**
     * O tema escolhido no Controle (ver [NativeBridge.temaClaro]).
     *
     * Duas ações, e a segunda é a que explica a `SharedPreferences`: os ícones
     * das barras viram AGORA, e o `windowBackground` do PRÓXIMO lançamento
     * fica guardado — ele é um recurso do APK, resolvido pelo sistema antes de
     * o WebView existir, então não há como perguntar ao lado web a tempo.
     *
     * `runOnUiThread` porque todo `@JavascriptInterface` chega de uma thread
     * do WebView, e mexer na janela de fora dela é o tipo de coisa que
     * funciona num aparelho e falha calada noutro.
     */
    override fun setTemaClaro(claro: Boolean) {
        runOnUiThread {
            getSharedPreferences(TEMA_PREFS, MODE_PRIVATE).edit()
                .putBoolean(TEMA_CLARO_KEY, claro).apply()
            aplicarCromoDoTema(claro)
            // E A NOTIFICAÇÃO REPINTA (v5.210). Ela usa o mesmo `--bg` do tema
            // (ver `SessionService.corDoTema`), e sem este aviso ela só mudaria
            // no próximo `publish()` — que numa cena parada pode ser daqui a um
            // louvor inteiro. O app claro com um cartão escuro pendurado nele é
            // exatamente o tipo de divergência que ter UMA fonte de cor existe
            // para impedir.
            SessionService.temaMudou()
        }
    }

    /**
     * Pinta o que é do SISTEMA conforme o tema: ícones das barras e fundo da
     * janela.
     *
     * O fundo é aplicado aqui ALÉM de vir do tema do APK: o `windowBackground`
     * do XML é resolvido uma vez, quando a decor view é instalada, então trocar
     * de tema com o app aberto deixaria o retângulo do XML aparecendo sempre que
     * o WebView ainda não pintou. Quem cobre o PRIMEIRO quadro é o `setTheme` do
     * `onCreate`, antes do `super` — os dois caminhos existem e nenhum
     * substitui o outro.
     *
     * ARMADILHA (derrubou a v1.89): `window.insetsController` é, no
     * `PhoneWindow`, um `mDecor.getWindowInsetsController()` SEM verificação de
     * nulo, e o `mDecor` só nasce no `installDecor()` (chamado pelo
     * `setContentView`). O tipo devolvido é anulável, então o `?.` do Kotlin dá
     * a impressão de que a chamada é segura — QUEM LANÇA É O RECEPTOR, não o
     * retorno. Antes do `setContentView` isso é `NullPointerException` em todo
     * lançamento, com qualquer tema, e o sintoma é o app não abrir. Nada
     * aparece em compilação, e o CI compila e roda JUnit, não a Activity.
     *
     * `peekDecorView()` é a pergunta exata ("a decor view já existe?"), ao
     * contrário de `decorView`, que a CRIA. Com ela esta função é segura de
     * chamar de qualquer ponto — que é o que o `setTemaClaro` (vindo da thread
     * do WebView, a qualquer momento) precisa.
     */
    @Suppress("DEPRECATION")   // o ramo abaixo da API 30 (ver dentro)
    private fun aplicarCromoDoTema(claro: Boolean) {
        temaClaro = claro
        val fundo = getColor(if (claro) R.color.app_bg_claro else R.color.app_bg)
        window.setBackgroundDrawable(ColorDrawable(fundo))
        if (::root.isInitialized) root.setBackgroundColor(fundo)
        if (window.peekDecorView() == null) return
        // API 30+: `WindowInsetsController`. Abaixo dela, as bandeiras de
        // aparência da barra vivem no `systemUiVisibility` da decor view (que é
        // deprecado desde a 30 — daí o @Suppress na função), e ali só existe a
        // da barra de STATUS: a de navegação chegou na 27, e o par ficaria
        // assimétrico de qualquer forma. Aparelho antigo fica com os botões de
        // navegação claros sobre um fundo claro; o alvo deste app é o Android
        // 15+, e trocar isso por uma terceira variante não se paga.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val mascara = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS or
                WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
            window.insetsController?.setSystemBarsAppearance(if (claro) mascara else 0, mascara)
        } else {
            val v = window.decorView
            val bit = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
            v.systemUiVisibility =
                if (claro) v.systemUiVisibility or bit else v.systemUiVisibility and bit.inv()
        }
    }

    override fun adjustSystemVolume(step: Int) {
        runOnUiThread {
            val am = getSystemService(AudioManager::class.java) ?: return@runOnUiThread
            val dir = if (step > 0) AudioManager.ADJUST_RAISE else AudioManager.ADJUST_LOWER
            // FLAG_SHOW_UI: aqui a mudança é do SISTEMA, não do app — o
            // operador precisa ver que saiu do fader e entrou no volume geral.
            am.adjustStreamVolume(AudioManager.STREAM_MUSIC, dir, AudioManager.FLAG_SHOW_UI)
        }
    }

    override fun takePendingShare(): JSONObject? = pendingShare.getAndSet(null)

    /**
     * O LINK COPIADO, e só quando ele é novo — ver [BridgeHost.readClipboardUrl].
     *
     * A ORDEM DAS PERGUNTAS É O RECURSO INTEIRO, e ela é: descrição → carimbo →
     * conteúdo. Do Android 12 em diante, ler o conteúdo que outro app pôs ali
     * mostra um aviso do sistema na tela; consultar a DESCRIÇÃO
     * ([ClipboardManager.getPrimaryClipDescription]) não mostra nada. Invertida,
     * a ordem daria o aviso a cada vinda ao app — que é o modo de este recurso
     * ser pior que a ausência dele.
     *
     * Carimbo `0` DESISTE, e é a escolha conservadora: `getTimestamp` devolve 0
     * quando o sistema não sabe dizer quando aquilo foi copiado, e sem carimbo
     * não há como evitar a releitura. O desfecho é o recurso não acontecer
     * naquele aparelho, calado — e não um aviso do sistema em toda retomada.
     *
     * Roda na MAIN THREAD (o `ClipboardManager` quer uma thread com `Looper`, e
     * as filas da ponte são `Thread` daemon sem um). É trabalho de
     * microssegundos: não há o que enfileirar.
     */
    override fun readClipboardUrl(desde: Long, onResult: (JSONObject?) -> Unit) {
        runOnUiThread {
            val achado = try { lerLinkCopiado(desde) } catch (_: Throwable) { null }
            onResult(achado)
        }
    }

    private fun lerLinkCopiado(desde: Long): JSONObject? {
        val cb = getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager ?: return null
        // Do Android 10 em diante a área de transferência só é legível com FOCO,
        // e sem ele a descrição volta nula. Não é erro: é o caso normal de quem
        // chamou cedo demais, e a retomada seguinte pergunta de novo.
        val desc = cb.primaryClipDescription ?: return null
        if (!desc.hasMimeType(android.content.ClipDescription.MIMETYPE_TEXT_PLAIN)) return null
        val carimbo = desc.timestamp
        if (carimbo <= 0L || carimbo <= desde) return null
        // Só AQUI o conteúdo é lido — e é só aqui que o aviso do sistema aparece.
        val item = cb.primaryClip?.takeIf { it.itemCount > 0 }?.getItemAt(0) ?: return null
        val texto = (item.text ?: return null).toString().trim()
        // TETO DE TAMANHO e SCHEME obrigatório: privacidade, não classificação.
        // Quem decide se o endereço é do YouTube é o `controle.js`; o que estas
        // duas linhas fazem é impedir que um texto qualquer copiado — uma senha,
        // uma mensagem — entre no heap do JavaScript para ser descartado um
        // passo depois. Mesma família da regra do [ShareIntake], que só aceita
        // `content://`.
        if (texto.length > 2048) return null
        if (!texto.startsWith("https://") && !texto.startsWith("http://")) return null
        return JSONObject().put("texto", texto).put("carimbo", carimbo)
    }

    // ---------- transmissão para as telas da rede ----------
    //
    // A Activity é a COSTURA do recurso, e só isso. Ela é a dona por UMA razão,
    // e é de thread: os métodos abaixo precisam da MAIN THREAD (ver o KDoc de
    // [startMirror]), e as filas de IO da ponte não a têm. As peças são três e
    // não se conhecem — `EspelhoServidor` (sockets e rotas), `EspelhoPares` (a
    // porta e as sessões) e `EspelhoEnergia` (wake lock, Wi-Fi lock e térmica).
    //
    // Fora isso ela não sabe nada da transmissão: sockets, tokens e diagnóstico
    // vivem nos `Espelho*.kt`, como `WebUpdater` e `YoutubeGrab` guardam OTA e
    // YouTube. É a disciplina que impede esta classe de crescer com o app.

    /**
     * LIGAR — na MAIN THREAD, sempre, por duas razões:
     *  1. este caminho NÃO pode entrar nas filas de IO da ponte — a de
     *     transferência é de uma thread só e é onde roda o download do YouTube,
     *     então "ligar a transmissão" no meio de um download venceria pelo prazo
     *     de 60 s do `native.js` e resolveria `null`, um erro sem causa;
     *  2. serialização: `espelhoSrv` e `espelhoMidia` são escritos aqui e lidos
     *     pelo [mirrorState], e a main thread é a trava que este arquivo já usa.
     *
     * A ORDEM é rede → servidor → cache de mídia → pareamento → serviço,
     * escolhida pelo custo de DESFAZER cada passo. A rede é a primeira porque é
     * a recusa mais provável e a mais barata (dados móveis, VPN, sem Wi-Fi);
     * o servidor é o outro que pode RECUSAR (porta ocupada) e desfazê-lo é
     * fechar um socket; o pareamento nasce do zero por último entre os que
     * guardam estado — é o que faz nenhum token sobreviver ao culto anterior —
     * e o serviço fecha a fila, quando já há endereço para a notificação.
     *
     * Devolve o estado resultante (o mesmo objeto do [mirrorState]) com `erro`
     * preenchido quando não deu: a folha do Controle desenha os dois casos com
     * o mesmo código, e a FRASE da falha vem pronta de quem sabe o motivo. A
     * especificação proíbe degradar calado em todos os pontos deste caminho.
     */
    override fun startMirror(ip: String, onResult: (JSONObject) -> Unit) {
        // O PEDIDO É DO OPERADOR, e é ele que o `stopMirror` desfaz. A CESSÃO
        // sobe o mesmo servidor por outra porta de entrada (`subirServidor`) e
        // **não** marca esta bandeira: se marcasse, desligar a cessão deixaria
        // o servidor de pé para sempre, servindo um telão que ninguém pediu.
        telaoPedido = true
        subirServidor(ip, onResult)
    }

    private fun subirServidor(ip: String, onResult: (JSONObject) -> Unit) {
        runOnUiThread {
            if (espelhoSrv?.ligado == true) { onResult(mirrorJson()); return@runOnUiThread }

            // 1. A REDE — a Wi-Fi de que este aparelho é CLIENTE, ou o PONTO DE
            //    ACESSO que ele mesmo serve. A lista já vem na ordem certa
            //    (ponto de acesso primeiro), e `ip` só chega preenchido quando
            //    o operador ESCOLHEU entre duas — o que só é oferecido quando
            //    de fato existem duas.
            val redes = try {
                EspelhoServidor.redeParaServir(this)
            } catch (e: Exception) {
                emptyList<EspelhoServidor.Rede>()
            }
            val rede = (if (ip.isEmpty()) redes.firstOrNull()
            else redes.firstOrNull { it.ip.hostAddress == ip })
            if (rede == null) {
                // A FRASE NASCE AQUI, e é a única do caminho que muda com o
                // pedido: "escolhi e sumiu" e "não há nenhuma" pedem ações
                // opostas do operador.
                onResult(
                    mirrorJson(
                        erro = if (ip.isNotEmpty()) {
                            "a rede escolhida nao esta mais disponivel"
                        } else {
                            EspelhoServidor.motivoSemRede(this)
                        },
                    ),
                )
                return@runOnUiThread
            }

            // 2. O SERVIDOR. `aoPerderRede` é a Wi-Fi sumindo com a transmissão
            //    no ar: o servidor confirma a queda sozinho (v5.183 — suspeita
            //    não é veredito) e chama de volta, e é aqui que o resto cai
            //    junto, senão sobrariam o pareamento e o serviço em primeiro
            //    plano anunciando um endereço que não atende mais.
            val srv = EspelhoServidor(
                applicationContext,
                WebPathHandler(applicationContext),
                registrar = { linha -> espelhoDiag.registrar(linha) },
                aoPerderRede = { stopMirror() },
                // O ENDEREÇO TROCOU E O SOCKET RELIGOU NELE (v5.183). O servidor
                // se resolve sozinho (refaz o bind e a allowlist de `Host`); o
                // que ele não sabe fazer é reescrever a notificação, e sem isso
                // o cartão mostraria um endereço que não atende mais.
                //
                // O IP novo NÃO chega às telas sozinho — elas guardam a URL que
                // foi digitada — e é por isso que este caminho existe: o
                // operador precisa ler o endereço novo em algum lugar.
                aoTrocarEndereco = { enderecoNovo, _ ->
                    runOnUiThread { EspelhoEnergia.enderecoMudou(this, enderecoNovo) }
                },
            )
            // O CERTIFICADO, quando o operador importou um. Ausente, vencido ou
            // ilegível ⇒ `null`, e o espelho sobe em HTTP claro com o aviso na
            // folha: degradar é melhor que quebrar, e a alternativa (subir com
            // um certificado vencido) é a tela vermelha que o TLS existe para
            // evitar. Ver o KDoc de [EspelhoCert.material].
            val cert = EspelhoCert.material(this)
            val hostTls = if (cert != null) EspelhoCert.estado(this).host else ""
            val endereco = try {
                srv.ligar(
                    EspelhoServidor.PORTA_PADRAO, rede.ip,
                    cert?.first, cert?.second, hostTls,
                )
            } catch (e: Exception) {
                srv.desligar()
                onResult(mirrorJson(erro = e.message ?: "o servidor do espelho não subiu"))
                return@runOnUiThread
            }

            // 3. NÃO HÁ MAIS TELA VIRTUAL NEM ENCODER (E6, o corte do telão
            // por comandos): as telas da rede rodam o próprio /display/ servido
            // por este servidor e renderizam localmente — o que atravessa a
            // rede são COMANDOS. O que a assinatura carrega hoje é o `ip`
            // escolhido — a REDE, não um modo de transmitir: continua havendo
            // um só.
            //
            // (Saiu na v5.206: `espelhoDiag.novaSessao()`. Ela zerava a âncora
            // do atraso captura→fio do anel de `ritmo`, e aquele anel morreu com
            // o encoder que o alimentava — ver o KDoc do [EspelhoDiag].)
            espelhoDiag.registrar("transmissao por comandos ligada em " + endereco)
            espelhoSrv = srv
            // O TAP DA LAN (telão por comandos, E2): todo comando que o web
            // relaya por busPost passa a sair também no SSE das telas de
            // comandos. Escuro enquanto nenhuma tela abre o GET /e.
            NativeBridge.tapLan = { j -> espelhoSrv?.difundirJson(j) }
            // E o CACHE DE MÍDIA (E4) nasce com a transmissão — os tokens são
            // da sessão, e a rota /m/ responde 404 idêntico fora dela.
            espelhoMidia = EspelhoMidiaCache(java.io.File(cacheDir, "espelho-midia"))
            srv.midia = espelhoMidia

            // 4. O PAREAMENTO nasce do zero — é isto que faz nenhum token
            //    sobreviver ao culto anterior — e o SERVIÇO sobe por último,
            //    quando já há endereço para a notificação mostrar.
            EspelhoPares.ligar(System.currentTimeMillis())
            EspelhoEnergia.ligar(this, endereco)

            onResult(mirrorJson())
        }
    }

    /**
     * DESLIGAR — e este é o único do bloco que **não** salta para a main thread.
     *
     * O ponto é justamente esse: quem responde ao desligamento são as threads
     * de cliente do [EspelhoServidor], que consultam um campo `@Volatile` e um
     * socket fechado. Enfileirar a desistência atrás do trabalho que se quer
     * parar é o oposto de parar — a mesma lição do `ytCancel`.
     */
    override fun stopMirror() {
        telaoPedido = false
        // O SERVIDOR SÓ CAI SE NINGUÉM MAIS O QUISER — ver os dois booleanos
        // no bloco do clone. Desligar o telão no meio de uma cópia de
        // gigabytes derrubaria a cópia sem nada dizendo por quê.
        if (acervoPedido) return
        desmontarEspelho()
    }

    /**
     * Solta as três peças da transmissão: servidor, pareamento e serviço.
     *
     * Separado do [stopMirror] porque ele tem DOIS chamadores com origens
     * opostas — o operador desligando, e o serviço morrendo por conta própria
     * (`onGone`). Idempotente de propósito: `desligar()` de servidor e
     * pareamento já o são, e o `stopService` de um serviço que não está de pé é
     * um no-op.
     */
    private fun desmontarEspelho() {
        // O ANÚNCIO SAI COM O SERVIDOR, sempre. Um anúncio mDNS de pé sobre uma
        // porta fechada é pior que anúncio nenhum: o outro celular acha o
        // aparelho, toca nele e recebe uma falha de conexão sem causa.
        try { AcervoDescoberta.pararAnuncio() } catch (e: Exception) {
            Log.w(TAG, "anúncio do clone não parou", e)
        }
        NativeBridge.tapLan = null
        espelhoSrv?.desligar()
        espelhoSrv = null
        espelhoMidia?.zerar()
        espelhoMidia = null
        EspelhoPares.desligar()
        try { EspelhoEnergia.desligar(this) } catch (e: Exception) {
            Log.w(TAG, "serviço do espelho não parou", e)
        }
    }

    /**
     * O aparelho esquentou, e **não há mais nada a baixar** — só a frase no
     * Registro, para "ficou ruim" ter causa.
     *
     * (Este método existia para reagir à térmica cortando o BITRATE do encoder,
     * e o KDoc explicava por que nunca a resolução: ela mudaria a densidade da
     * tela virtual, e a densidade define o viewport CSS — o `/display/` refaria
     * a quebra de estrofe na frente da congregação. Encoder e tela virtual
     * saíram na v5.187, e com eles a única qualidade que este aparelho
     * produzia: hoje as telas renderizam localmente e o custo térmico da
     * transmissão é o de servir comandos e bytes.)
     */
    private fun aoEsquentar(grau: Int) {
        // A linha fica: térmica alta durante a transmissão continua sendo
        // leitura de Registro, mesmo sem atuador nenhum deste lado.
        if (grau >= 3) espelhoDiag.registrar("aparelho quente (grau " + grau + ")")
    }

    /**
     * O estado do espelho num objeto só — e é o MESMO que o [startMirror]
     * devolve, com `erro` preenchido quando não deu. Um formato, um desenho do
     * lado web: a folha do Controle não tem dois caminhos de render.
     */
    private fun mirrorJson(erro: String = ""): JSONObject {
        val srv = espelhoSrv?.estado()
        val ligado = espelhoSrv?.ligado == true
        // AS REDES SERVÍVEIS — inclusive na recusa, que é justamente quando o
        // operador precisa saber o que existe. A lista é DADO: quem escreve "a
        // Wi-Fi da igreja" ou "o ponto de acesso deste celular" é o
        // `controle.js` (invariante 5), e a escolha só é DESENHADA com mais de
        // uma — uma escolha que aparece no caso comum não cobra nada.
        //
        // **VAZIA COM A TRANSMISSÃO NO AR, e isso é deliberado.** Este objeto é
        // relido a cada 2,5 s enquanto a folha está aberta, e montá-lo ENUMERA
        // AS INTERFACES do aparelho na MAIN THREAD. Com o servidor de pé a
        // lista não é desenhada (trocar de rede exige desligar), então o que
        // sobraria era uma varredura por segundo e meio durante o culto inteiro
        // para alimentar um bloco que ninguém pinta. Quem quer a leitura com a
        // transmissão no ar tem o Registro, que a faz sob demanda.
        val redes = JSONArray()
        if (!ligado) {
            try {
                for (r in EspelhoServidor.redeParaServir(this)) {
                    redes.put(
                        JSONObject()
                            .put("ip", r.ip.hostAddress ?: "")
                            .put("via", r.via.name)
                            .put("iface", r.iface),
                    )
                }
            } catch (e: Exception) {
                Log.w(TAG, "não foi possível listar as redes servíveis", e)
            }
        }
        return JSONObject()
            .put("ligado", ligado)
            .put("endereco", srv?.optString("url") ?: "")
            .put("erro", erro)
            .put("via", srv?.optString("via") ?: "")
            .put("redes", redes)
            .put("telas", srv?.optJSONArray("telas") ?: JSONArray())
    }

    override fun mirrorState(onResult: (JSONObject) -> Unit) {
        runOnUiThread { onResult(mirrorJson()) }
    }

    /**
     * O diagnóstico inteiro, JUNTADO aqui: o **diário** do [EspelhoDiag] mais o
     * que só o servidor sabe (endereço, sessões, telas, cache de mídia) e o que
     * só a proteção sabe (wake lock, Wi-Fi lock, térmica). Cada um devolve DADO;
     * quem escreve as frases é o `blocoEspelho` do `controle.js`.
     */
    override fun mirrorDiag(onResult: (JSONObject) -> Unit) {
        runOnUiThread {
            val o = espelhoDiag.paraJson()
            o.put("ligado", espelhoSrv?.ligado == true)
            espelhoSrv?.let { o.put("servidor", it.estado()) }
            // AS INTERFACES VISTAS E O MOTIVO DE CADA RECUSA. É a única forma
            // de diagnosticar a distância um nome de interface de fabricante —
            // sem ela, "não achou o ponto de acesso" num aparelho com o hotspot
            // ligado não tem pista nenhuma, e isto é Kotlin: não há OTA que
            // conserte a regra depois.
            try { o.put("interfaces", EspelhoServidor.interfacesJson(this)) } catch (e: Exception) {
                Log.w(TAG, "leitura de interfaces indisponível", e)
            }
            try { o.put("servico", EspelhoEnergia.estado(this)) } catch (e: Exception) {
                Log.w(TAG, "estado do serviço do espelho indisponível", e)
            }
            onResult(o)
        }
    }

    /**
     * DERRUBAR UMA TELA — a única coisa que este método faz.
     *
     * O `id` é o RÓTULO da tela ("tela B"), que é o único identificador que a
     * lista do operador tem.
     */
    override fun derrubarTela(rotulo: String, onResult: (Boolean) -> Unit) {
        runOnUiThread {
            // Um rótulo VAZIO derrubaria a primeira tela que casasse com nada —
            // ou, pior, cairia num caminho de "todas". Recusar cedo é a única
            // resposta possível.
            if (rotulo.isBlank()) { onResult(false); return@runOnUiThread }
            onResult(espelhoSrv?.derrubarTela(rotulo) == true)
        }
    }

    // ---------- certificado do espelho (o degrau de TLS) ----------
    //
    // Os três saem da main thread — ler um `.p12` do SAF, abrir um PKCS12 e
    // reescrevê-lo é disco e cripto —, e saem numa THREAD PRÓPRIA e não numa
    // fila da ponte. A `transferencia` é de uma thread só e é onde roda o
    // download do YouTube: importar um certificado no meio de um download
    // ficaria preso por
    // minutos e a Promise venceria pelo prazo de 60 s do `native.js`,
    // resolvendo `null` — um "erro" sem causa. É a mesma razão pela qual os
    // cinco métodos do espelho ficam fora dela.

    override fun mirrorCertImport(origem: String, senha: String, onResult: (String) -> Unit) {
        thread(name = "av-cert", isDaemon = true) {
            val erro = try {
                EspelhoCert.importar(this, origem, senha)
            } catch (e: Exception) {
                Log.w(TAG, "importação do certificado falhou", e)
                "não foi possível importar (${e.javaClass.simpleName})"
            }
            runOnUiThread { onResult(erro) }
        }
    }

    override fun mirrorCertState(onResult: (JSONObject) -> Unit) {
        thread(name = "av-cert", isDaemon = true) {
            val e = EspelhoCert.estado(this)
            val json = JSONObject()
                .put("temCert", e.temCert)
                .put("host", e.host)
                .put("ate", e.ate)
                .put("nome", e.nome)
                // O ESTADO NO AR é diferente do estado GUARDADO, e a folha
                // precisa dos dois: importar um certificado com o espelho já
                // ligado não o promove a TLS — o socket já está de pé. Sem esta
                // distinção o operador leria "certificado válido" olhando para
                // um endereço `http://`.
                .put("noAr", espelhoSrv?.ligado == true)
                .put("servindoTls", (espelhoSrv?.estado()?.optBoolean("tls", false)) == true)
            runOnUiThread { onResult(json) }
        }
    }

    override fun mirrorCertRemove(onResult: () -> Unit) {
        thread(name = "av-cert", isDaemon = true) {
            EspelhoCert.apagar(this)
            runOnUiThread { onResult() }
        }
    }

    // ---------- o CLONE da biblioteca (shell 65) ----------
    //
    // O SERVIDOR PASSOU A TER DUAS RAZÕES DE VIVER: a transmissão do telão e a
    // cessão da biblioteca. É o padrão do [SessionService], que só para quando
    // cena E transmissão caem — e ele existe pelo mesmo motivo: ligar uma das
    // duas não pode desligar a outra, e num culto as duas podem estar no ar.
    //
    // Os dois booleanos abaixo são a memória de QUEM PEDIU. Sem eles, desligar
    // a cessão derrubaria o telão no meio da projeção — e o desfecho seria
    // indistinguível de uma queda de rede.

    /** O operador ligou a TRANSMISSÃO (o telão nas telas da rede). */
    private var telaoPedido = false

    /** O operador ligou a CESSÃO da biblioteca. */
    private var acervoPedido = false

    override fun acervoCeder(rotulo: String, onResult: (JSONObject) -> Unit) {
        runOnUiThread {
            // O SERVIDOR PRIMEIRO, e o estado só liga se ele subiu: `ligar` a
            // cessão sobre um servidor que não existe deixaria o anúncio no ar
            // apontando para uma porta fechada, que é a falha muda deste
            // caminho — o outro celular acha o aparelho e não conecta.
            if (espelhoSrv?.ligado != true) {
                subirServidor("") { estado ->
                    if (estado.optBoolean("ligado", false)) {
                        acervoPedido = true
                        ligarCessao(rotulo)
                    }
                    onResult(acervoJson(estado.optString("erro", "")))
                }
                return@runOnUiThread
            }
            acervoPedido = true
            ligarCessao(rotulo)
            onResult(acervoJson())
        }
    }

    private fun ligarCessao(rotuloPedido: String) {
        // O NOME DESTE APARELHO É RESOLVIDO AQUI, num ponto só. O web não tem
        // como saber o modelo (`Build` é do shell), e cada lugar que
        // improvisasse um nome genérico faria dois celulares chegarem ao outro
        // lado como "Celular" — justamente na tela em que uma pessoa decide se
        // autoriza a cópia.
        val rotulo = rotuloPedido.ifBlank { nomeDesteAparelho() }
        AcervoCessao.ligar(rotulo)
        val porta = espelhoSrv?.estado()?.optInt("porta", 0) ?: 0
        // O ANÚNCIO SAI COM ZERO ITENS, e é assim que tem de ser: o índice
        // varre o OPFS inteiro e leva segundos. O `acervoPublicar` o refaz com
        // os números de verdade — ver [AcervoDescoberta.reanunciar].
        AcervoDescoberta.anunciar(this, porta, rotulo, 0, 0L)
        espelhoDiag.registrar("cessao da biblioteca ligada")
    }

    override fun acervoPararCessao() {
        runOnUiThread {
            acervoPedido = false
            AcervoCessao.desligar()
            AcervoDescoberta.pararAnuncio()
            espelhoDiag.registrar("cessao da biblioteca desligada")
            // O SERVIDOR SÓ CAI SE NINGUÉM MAIS O QUISER.
            if (!telaoPedido) desmontarEspelho()
        }
    }

    /**
     * O `POST /acervo/par` do lado de quem CLONA — e ele sai do shell porque a
     * página é `https` e o outro celular serve `http`: o navegador bloquearia a
     * requisição antes de ela sair (ver [AcervoProxy]).
     *
     * Numa thread própria, e não numa das filas da ponte: é rede, e a fila de
     * `io` é justamente onde uma requisição de rede não pode entrar (ver o
     * KDoc das filas em [NativeBridge]).
     */
    override fun acervoParear(
        endereco: String,
        porta: Int,
        rotulo: String,
        onResult: (JSONObject) -> Unit,
    ) {
        thread(name = "av-acervo-par", isDaemon = true) {
            val r = pedirPar(endereco, porta, rotulo)
            if (r.optString("estado") == "pareado") {
                AcervoProxy.apontar(endereco, porta, r.optString("token"))
                espelhoDiag.registrar("clone: pareado com $endereco:$porta")
            }
            // O TOKEN NÃO VOLTA PARA O WEB. Ele é a credencial do outro
            // aparelho e o proxy já o tem — mandá-lo à página seria pô-lo num
            // lugar onde ele não precisa estar (a mesma regra do `/saf/`: a
            // ponte entrega o que serve, não o segredo).
            r.remove("token")
            runOnUiThread { onResult(r) }
        }
    }

    /** O nome deste aparelho, para o outro lado. Ponto ÚNICO — ver
     *  [ligarCessao]. */
    private fun nomeDesteAparelho(): String {
        val marca = (android.os.Build.MANUFACTURER ?: "").trim()
        val modelo = (android.os.Build.MODEL ?: "").trim()
        return when {
            modelo.isEmpty() -> marca.ifEmpty { "Celular" }
            // "Samsung SM-A546E" e não "samsung samsung SM-A546E": vários
            // fabricantes já põem a marca no modelo.
            marca.isEmpty() || modelo.startsWith(marca, ignoreCase = true) -> modelo
            else -> marca.replaceFirstChar { it.uppercase() } + " " + modelo
        }
    }

    private fun pedirPar(endereco: String, porta: Int, rotulo: String): JSONObject {
        if (endereco.isBlank() || porta <= 0) {
            return JSONObject().put("estado", "erro").put("erro", "endereco invalido")
        }
        var conn: java.net.HttpURLConnection? = null
        return try {
            val corpo = JSONObject()
                .put("rotulo", rotulo.ifBlank { nomeDesteAparelho() })
                .toString().toByteArray(Charsets.UTF_8)
            conn = (java.net.URL("http://$endereco:$porta/acervo/par").openConnection()
                as java.net.HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 8_000
                readTimeout = 8_000
                doOutput = true
                instanceFollowRedirects = false
                setRequestProperty("Content-Type", "application/json")
                setFixedLengthStreamingMode(corpo.size)
            }
            conn.outputStream.use { it.write(corpo) }
            val codigo = conn.responseCode
            val texto = (if (codigo >= 400) conn.errorStream else conn.inputStream)
                ?.use { String(it.readBytes(), Charsets.UTF_8) }.orEmpty()
            val json = try { JSONObject(texto) } catch (e: Exception) { JSONObject() }
            // O 404 É "ESTE APARELHO NAO ESTA CEDENDO", e ele merece frase
            // própria: o anúncio mDNS sobrevive alguns segundos ao desligar,
            // então tocar num aparelho que acabou de parar é o caso comum.
            if (!json.has("estado")) {
                json.put("estado", if (codigo == 404) "nao-cede" else "erro")
                if (codigo != 404) json.put("erro", "HTTP $codigo")
            }
            json
        } catch (e: Exception) {
            JSONObject().put("estado", "erro")
                .put("erro", e.javaClass.simpleName + ": " + (e.message ?: ""))
        } finally {
            conn?.disconnect()
        }
    }

    override fun acervoEstado(onResult: (JSONObject) -> Unit) {
        runOnUiThread {
            val o = JSONObject()
                .put("cessao", AcervoCessao.estadoJson())
                .put("endereco", espelhoSrv?.estado()?.optString("url") ?: "")
                .put("porta", espelhoSrv?.estado()?.optInt("porta", 0) ?: 0)
                .put("pareado", AcervoProxy.apontado)
                .put("proxy", AcervoProxy.diario)
                .put("descoberta", AcervoDescoberta.estadoJson())
                .put("achados", AcervoDescoberta.achados())
            onResult(o)
        }
    }

    private fun acervoJson(erro: String = ""): JSONObject = JSONObject()
        .put("cedendo", AcervoCessao.cedendo)
        .put("endereco", espelhoSrv?.estado()?.optString("url") ?: "")
        .put("porta", espelhoSrv?.estado()?.optInt("porta", 0) ?: 0)
        .put("erro", erro)

    // ---------- fullscreen HTML5 ----------

    private inner class ControleChromeClient : WebChromeClient() {

        /**
         * Abre o seletor de arquivos do sistema para um `<input type="file">`.
         * O intent vem pronto de [FileChooserParams.createIntent], já
         * respeitando o `accept` e o `multiple` declarados no HTML.
         */
        override fun onShowFileChooser(
            webView: WebView,
            callback: ValueCallback<Array<Uri>>,
            params: FileChooserParams,
        ): Boolean {
            // Um seletor anterior sem resposta deixaria o input travado para
            // sempre — encerra o pendente antes de abrir o novo.
            filePathCallback?.onReceiveValue(null)
            filePathCallback = callback
            return try {
                fileChooser.launch(params.createIntent())
                true
            } catch (e: Exception) {
                Log.w(TAG, "seletor de arquivos indisponível", e)
                filePathCallback = null
                callback.onReceiveValue(null)
                false
            }
        }

        /**
         * O WebView do Controle **não recebe mídia nenhuma** — áudio, câmera,
         * MIDI e proteção de conteúdo, todos negados, com log.
         *
         * O ÁUDIO ESTEVE AQUI (shell 50 → 54), pelo RECADO — o microfone
         * estilo walkie-talkie, que gravava neste WebView porque o telão só
         * existe com TV conectada e o recado precisava funcionar sem TV. O
         * recado saiu na v1.2.17: o motivo de ele existir era que o microfone
         * AO VIVO não abria sem TV, e isso acabou sendo um defeito NOSSO
         * (`MODIFY_AUDIO_SETTINGS` fora do manifest), não uma limitação.
         * Sem o recado, nada neste WebView pede captura — e uma concessão que
         * ninguém usa é superfície pela qual não se paga nada em troca.
         *
         * A CAPTURA SEGUE EXISTINDO, no [MicChromeClient], que é o WebView do
         * telão: é lá que o microfone ao vivo sempre foi aberto, e é lá que as
         * três regras (só `RESOURCE_AUDIO_CAPTURE`, só com `RECORD_AUDIO` no
         * processo, só da própria origem) continuam valendo.
         *
         * ELE NÃO PODE SER REMOVIDO por parecer inútil: um WebView sem
         * `onPermissionRequest` nega **em silêncio**, e o próximo que precisar
         * de mídia aqui descobriria a armadilha do zero — é a mesma razão pela
         * qual ele existia antes do shell 50, negando tudo.
         */
        override fun onPermissionRequest(request: PermissionRequest) {
            Log.w(
                TAG,
                "mídia negada ao Controle (${request.origin}): " +
                    request.resources.joinToString(),
            )
            request.deny()
        }

        override fun onShowCustomView(view: View, callback: CustomViewCallback) {
            if (customView != null) {
                callback.onCustomViewHidden()
                return
            }
            customView = view
            customCallback = callback
            fullscreenContainer.addView(view, matchParent())
            fullscreenContainer.visibility = View.VISIBLE
            webContainer.visibility = View.GONE
            // A preview em tela cheia é 16:9 — o equivalente nativo do
            // `screen.orientation.lock('landscape')` que o PWA faz.
            requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
            setSystemBarsHidden(true)
        }

        override fun onHideCustomView() = sairDaTelaCheia(true)

        override fun onConsoleMessage(msg: ConsoleMessage): Boolean {
            Log.d(TAG, "[web] ${msg.message()} (${msg.sourceId()}:${msg.lineNumber()})")
            return true
        }
    }

    /**
     * O contêiner da preview em TELA CHEIA, e a SEGUNDA metade da mentira de
     * visibilidade — a [WebViewFactory.KeepVisibleWebView] não alcança este
     * caso.
     *
     * Em tela cheia quem fala com o motor deixa de ser o WebView: o Chromium
     * entrega ao `onShowCustomView` uma View PRÓPRIA, transfere para ela o
     * tratamento real da View e deixa o WebView original com um tratamento
     * no-op. A partir daí os dois `override` da `KeepVisibleWebView` não vão a
     * lugar nenhum, e quem reporta visibilidade é essa View de terceiro — que o
     * app não subclassifica e que só recebe visibilidade pelo DESPACHO deste
     * contêiner (o `super` do `ViewGroup` é quem repassa o valor aos filhos).
     * Sem a mentira aqui, minimizar o app com a preview em tela cheia leva a
     * página a `hidden`, o Chromium pausa o `<video>` e o louvor cala — e sem
     * TV a preview em tela cheia É a projeção.
     *
     * Com [manterVisivel] em `false` a classe é indistinguível de um
     * `FrameLayout`, e é assim que ela nasce: com uma tela lá fora o Controle
     * DEVE ser estrangulado em segundo plano. Quem escreve o campo é
     * [aplicarProjecaoLocal], o mesmo (e único) ponto que escreve o do WebView.
     */
    private class KeepVisibleFrame(ctx: Context) : FrameLayout(ctx) {
        var manterVisivel = false

        override fun dispatchWindowVisibilityChanged(visibility: Int) {
            super.dispatchWindowVisibilityChanged(if (manterVisivel) View.VISIBLE else visibility)
        }

        /**
         * A visibilidade que o Chromium calcula tem DOIS componentes — a da
         * janela e a da View —, e mentir só sobre o primeiro deixa o segundo
         * derrubar a página do mesmo jeito. É o par do `onVisibilityChanged` da
         * `KeepVisibleWebView`, um nível acima.
         */
        override fun dispatchVisibilityChanged(changedView: View, visibility: Int) {
            super.dispatchVisibilityChanged(changedView, if (manterVisivel) View.VISIBLE else visibility)
        }
    }

    /**
     * Desfaz a TELA CHEIA da preview e devolve a Activity ao retrato.
     *
     * `avisarWebView` distingue os dois donos possíveis do pedido. Pelo caminho
     * normal (`onHideCustomView`) é o próprio documento que está saindo, e o
     * `CustomViewCallback` precisa ser avisado; na REMONTAGEM por morte de
     * renderer o dono daquele callback já não existe, e invocá-lo seria falar
     * com um WebView destruído — daí o `false`, com o `try` como cinto e
     * suspensório para o caminho normal.
     */
    private fun sairDaTelaCheia(avisarWebView: Boolean) {
        val v = customView ?: return
        fullscreenContainer.removeView(v)
        fullscreenContainer.visibility = View.GONE
        webContainer.visibility = View.VISIBLE
        customView = null
        if (avisarWebView) {
            try {
                customCallback?.onCustomViewHidden()
            } catch (e: Exception) {
                Log.w(TAG, "onCustomViewHidden falhou", e)
            }
        }
        customCallback = null
        requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
        setSystemBarsHidden(false)
    }

    @Suppress("DEPRECATION")
    private fun setSystemBarsHidden(hidden: Boolean) {
        root.systemUiVisibility = if (hidden) {
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_FULLSCREEN or
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        } else {
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        }
    }

    private fun matchParent() = FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT,
    )

    companion object {
        private const val TAG = "AvIasd"

        /** As esperas da escada de retomada do telão — ver [agendarRetomadaDoTelao]. */
        private val TELAO_ESPERAS = longArrayOf(400, 1000, 2000, 4000, 8000)
        /**
         * O tema escolhido, guardado só para o `windowBackground` do PRÓXIMO
         * lançamento (ver [setTemaClaro]). A fonte de verdade é o
         * `localStorage` do Controle — aqui é uma CÓPIA, e o lado web a
         * reescreve em toda carga da página, então uma divergência se corrige
         * sozinha na abertura seguinte. Arquivo próprio, e não o do OTA: o
         * `web-ota.xml` está fora do backup de propósito (é ponteiro para
         * CÓDIGO) e o tema é preferência do operador, que deve viajar na troca
         * de aparelho como qualquer outra.
         */
        private const val TEMA_PREFS = "tema"
        private const val TEMA_CLARO_KEY = "claro"

        /**
         * O tema escolhido, para quem não é a Activity.
         *
         * O [SessionService] precisa dele para pintar a notificação (v5.210), e
         * ele roda sem Activity — a instância pode nem existir quando o cartão
         * é publicado. A preferência é a MESMA que o primeiro quadro do app usa
         * (ver [setTemaClaro]): uma leitura de `SharedPreferences`, que é o
         * único lugar onde essa escolha sobrevive ao processo.
         *
         * Público de propósito, e não uma cópia da chave no outro arquivo: duas
         * constantes com o mesmo nome em dois lugares é a divergência que este
         * projeto recusa em toda parte.
         */
        fun temaClaroSalvo(ctx: Context): Boolean =
            ctx.getSharedPreferences(TEMA_PREFS, Context.MODE_PRIVATE)
                .getBoolean(TEMA_CLARO_KEY, false)
        private const val GMS_PACKAGE = "com.google.android.gms"
        /**
         * Prazo para o lado web responder ao botão voltar (ver [handleBack]).
         * Curto de propósito: acima disso o toque começa a parecer ignorado, e
         * a resposta padrão (minimizar) é sempre segura. Um WebView vivo
         * responde em poucos milissegundos.
         */
        private const val BACK_JS_TIMEOUT_MS = 350L
        /** `Build.MANUFACTURER`/`Build.BRAND` de um aparelho Samsung. */
        private const val SAMSUNG_VENDOR = "samsung"

        /** Pacotes do Smart View conhecidos (varia por versão do One UI). */
        private val SAMSUNG_MIRROR_PACKAGES = listOf(
            "com.samsung.android.smartmirroring",
            "com.samsung.android.app.smartmirroring",
        )

        /**
         * O servidor da transmissão — **no companion porque ele é do PROCESSO,
         * não desta Activity**.
         *
         * A transmissão sobrevive a uma recriação de tela de propósito: o
         * serviço em primeiro plano mantém o processo, o `ServerSocket` nunca
         * chega a fechar e as telas da rede não veem nada (o SSE delas está
         * ligado ao servidor, não a esta janela). Se a referência do
         * servidor morresse com a Activity, um simples ajuste de tamanho de
         * fonte deixaria um `ServerSocket` servindo o culto sem ninguém capaz de
         * desligá-lo — e a folha do Controle diria "Desligado" com telas
         * recebendo do outro lado. `EspelhoServidor` guarda o
         * `applicationContext`, então não há Activity retida aqui.
         */
        @Volatile
        private var espelhoSrv: EspelhoServidor? = null

        /** O anel de diagnóstico da transmissão. O dono do Registro é quem liga
         *  o servidor. */
        val espelhoDiag = EspelhoDiag()

        /** O cache da rota /m/ (E4) — vive com a transmissão, não com a
         *  Activity, pela mesma razão do servidor acima. */
        @Volatile
        private var espelhoMidia: EspelhoMidiaCache? = null

        /** O canal __avTelaMidia — um por PROCESSO (o listener é
         *  por-instância de WebView e é reinstalado a cada remontagem do
         *  Controle, mas a fila e a thread são uma só). O cache que ele
         *  alimenta resolve na hora: nulo com a transmissão desligada. */
        private val espelhoMidiaCanal = EspelhoMidiaCanal(
            cache = { espelhoMidia },
            registrar = { linha -> espelhoDiag.registrar(linha) },
        )

        /** O canal __avPacote (shell 63) — UM por processo, pela mesma razão do
         *  irmão acima: o listener é por-instância de WebView e é reinstalado a
         *  cada remontagem do Controle, mas a fila, a thread e o destino aberto
         *  são um só. Ele vive no companion também porque o destino precisa
         *  SOBREVIVER a uma morte de renderer no meio de uma exportação — não
         *  para continuar (o empurrão morre com a página), mas para o
         *  `pacoteCancel` do lançamento seguinte encontrar o que apagar. */
        private val pacoteCanal = PacoteCanal()

        /**
         * Cache de [castCandidates] — no companion porque a informação é do
         * PROCESSO (activities de pacotes de sistema), não desta Activity: uma
         * recriação de tela não a muda. Os `Intent` cacheados são reusados com
         * `addFlags`, o que é inócuo — a flag é sempre a mesma.
         */
        @Volatile
        private var castCandidatesCache: List<Intent>? = null
    }
}
