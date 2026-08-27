package br.org.iasd.av

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.drawable.Icon
import android.media.MediaMetadata
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.ServiceCompat

/**
 * Ponte de mão dupla entre o sistema (notificação, tela de bloqueio, botões de
 * mídia) e o Controle, que vive dentro do WebView. O toque entra por aqui e sai
 * como uma string de ação; quem executa continua sendo o JS.
 *
 * Deliberadamente burro: NÃO decide nada sobre playlist, letra ou transporte —
 * é a invariante 5 do projeto (não reimplementar em Kotlin o que já existe em
 * JS). O `onAction` só entrega a ação a `window.__avRemote`, que aciona os
 * MESMOS handlers dos botões da tela.
 *
 * É também por isso que nenhuma ação é desabilitada aqui: quem sabe se "estrofe
 * anterior" faz sentido agora é o lado web, e lá isso já é um no-op natural
 * (botão `disabled`, limite de lista, texto sem áudio de fundo). Desabilitar em
 * dois lugares seria duplicar a regra — e a cópia em Kotlin envelheceria.
 */
object SessionRemote {

    const val PLAY = "play"
    const val PAUSE = "pause"
    const val PLAY_PAUSE = "playpause"
    const val PREV = "prev"
    const val NEXT = "next"
    const val STOP = "stop"
    const val VIEW = "view"

    /** Definido pela [MainActivity] enquanto ela existe; nulo depois. */
    @Volatile
    var onAction: ((String) -> Unit)? = null

    fun send(action: String) {
        onAction?.invoke(action)
    }
}

/**
 * O ÚNICO serviço em primeiro plano do culto: sessão de mídia, controles de
 * transporte e a proteção da TRANSMISSÃO para as telas da rede.
 *
 * Dois ganhos, e o segundo é o menos óbvio:
 *
 * 1. **Controlar sem abrir o app** — o celular fica no suporte, provavelmente
 *    bloqueado. Com [MediaSession] os controles aparecem também na tela de
 *    bloqueio e nas configurações rápidas, de graça.
 * 2. **A projeção deixa de ser descartável.** Sem ele o único serviço em
 *    primeiro plano era o [SyncService], que só sobe DURANTE downloads: num
 *    culto normal não havia nenhum, e o processo seguia candidato a ser morto
 *    sob pressão de memória, levando a `Presentation` junto.
 *
 * ## DUAS RAZÕES DE VIVER, e é isso que torna a fusão legítima
 *
 * - **CENA** ([scene]): mídia carregada, letra, versículo, mensagem, cronômetro
 *   ou sorteio no ar. Nasce e morre com o lado web.
 * - **TRANSMISSÃO** ([transmissao]): o servidor das telas da rede no ar. Nasce e
 *   morre por ação do operador, e pode durar o culto inteiro.
 *
 * Ele só para quando **as duas** caem. A transmissão já teve serviço próprio, e
 * o argumento da separação ("empilhar dono é o caminho para o cartão eterno")
 * estava certo sobre ciclo de vida e errado sobre o preço: a gaveta mostrava
 * DOIS cartões do mesmo app, e só um servia para alguma coisa. A disciplina
 * fica (`running`, `foregrounded`, `stopSelf(startId)`), agora com a condição de
 * parada num `if` explícito em vez de espalhada por dois arquivos.
 *
 * ## O TIPO é a união dos dois, e nenhum deles tem cota
 *
 * `mediaPlayback|connectedDevice` — o teto de tempo do Android 15 é do
 * `dataSync`/`mediaProcessing`. O pré-requisito de permissão do
 * `connectedDevice` (uma de `CHANGE_WIFI_MULTICAST_STATE` e companhia, que
 * **não** inclui `INTERNET`) está no KDoc do [EspelhoEnergia], e é ele que
 * derruba a primeira Release de quem a remover do manifest.
 *
 * ## O cartão tem DUAS CARAS, e a transmissão aparece nas duas
 *
 * Com cena: o player. Sem cena e com a transmissão no ar: o endereço, quantas
 * telas recebem e o botão **Desligar transmissão** — que só aparece aí, de
 * propósito (ao lado do transporte, no escuro, seria um toque errado derrubando
 * a projeção da igreja). Com cena, endereço e contagem viram o SUBTEXTO, que o
 * `MediaStyle` desenha sem disputar espaço com título nem botões.
 *
 * **Um player LITERAL em tempo integral não é possível, e a razão é da
 * plataforma.** O cartão sem cena viraria `MediaStyle` só com uma sessão com
 * estado, e do Android 13 em diante os botões saem do `PlaybackState`: com
 * `STATE_NONE` (o único honesto sem mídia) o sistema não desenha botão nenhum e
 * o "Desligar transmissão" sumiria nas versões novas; com estado PAUSADO ele
 * apareceria, mas a sessão seria promovida ao painel de mídia das configurações
 * rápidas — um player fantasma, com transporte morto.
 *
 * ## E os BOTÕES são escolhidos pelo lado web
 *
 * Ver [Scene.actions]. Cinco fixos serviam a uma cena só; a lista vem de fora
 * pela invariante 5 — quem sabe se "próxima estrofe" faz sentido é o
 * `controle.js`.
 */
class SessionService : Service() {

    private var session: MediaSession? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        ensureChannel()
        session = MediaSession(this, "AvIasd").apply {
            setCallback(object : MediaSession.Callback() {
                // onPlay/onPause chegam de fontes que SABEM o que querem (tela
                // de bloqueio, fone, Android Auto), então viram intenção
                // explícita. O botão da notificação, esse sim, é um alternador.
                override fun onPlay() = SessionRemote.send(SessionRemote.PLAY)
                override fun onPause() = SessionRemote.send(SessionRemote.PAUSE)
                override fun onStop() = SessionRemote.send(SessionRemote.STOP)
                override fun onSkipToPrevious() = SessionRemote.send(SessionRemote.PREV)
                override fun onSkipToNext() = SessionRemote.send(SessionRemote.NEXT)

                // Parar e a cortina do wallpaper chegam por aqui, não pelos
                // PendingIntent das Notification.Action — ver o comentário em
                // [publish] sobre quem desenha os botões no Android 13+.
                override fun onCustomAction(action: String, extras: android.os.Bundle?) =
                    SessionRemote.send(action)
            })
            isActive = true
        }
        instance = this
        running = true
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Publica SEMPRE, e ANTES de qualquer decisão de parar: um serviço
        // iniciado por `startForegroundService` DEVE chamar `startForeground`.
        // Sair sem isso não satisfaz a exigência — o `bringDownServiceLocked`
        // do sistema ainda encontra o pedido pendente e derruba o app inteiro
        // ("Context.startForegroundService() did not then call
        // Service.startForeground()"), levando junto os dois WebViews e a
        // projeção. Publicar primeiro custa uma notificação de alguns
        // milissegundos; a alternativa custa o culto.
        publish()

        // A CENA PODE TER ACABADO ENQUANTO O SERVIÇO SUBIA. `nowPlaying` e
        // `stop` chegam da thread do WebView: publicar uma cena dispara
        // `startForegroundService`, e o `active:false` que vem logo atrás (o
        // operador toca em Parar, ou a cena esvazia) chega ANTES de o serviço
        // existir. Sem esta guarda o serviço nascia depois disso e ficava de pé
        // com "Nada em exibição" — e nada mais chamaria `stop()`, porque o lado
        // web deduplica por chave e não reenvia o `active:false`.
        //
        // `stopSelf(startId)` e não `stopSelf()`: se outro comando (uma cena
        // nova) já estiver na fila, ele tem `startId` maior e o pedido de
        // parada é ignorado, como manda o contrato do Service.
        if (scene == null && transmissao == null) {
            Log.i(TAG, "nada no ar antes de o serviço subir — parando")
            stopSelf(startId)
            return START_NOT_STICKY
        }
        val action = intent?.action
        if (action == ACTION_DESLIGAR_TX) {
            // O BOTÃO "Desligar transmissão" é a única forma de desligá-la com o
            // app minimizado, e é por isso que ele existe. Quem desmonta o
            // servidor é o DONO (o hook), não este serviço: ele não sabe o que é
            // um `ServerSocket` — a invariante 5, aqui como em todo lugar.
            Log.i(TAG, "desligar a transmissão, pedido pela notificação")
            val hook = EspelhoEnergia.onDesligar
            if (hook != null) mainHandler.post {
                try {
                    hook.invoke()
                } catch (e: Exception) {
                    Log.w(TAG, "falhou desligando a transmissão pela notificação", e)
                }
            }
            return START_NOT_STICKY
        }
        if (action != null && action.startsWith(ACTION_PREFIX)) {
            SessionRemote.send(action.removePrefix(ACTION_PREFIX))
        }
        // NOT_STICKY: sem o WebView vivo não há cena para controlar; recriar o
        // serviço sozinho só deixaria uma notificação órfã.
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        // `running` cai ANTES de tudo: uma publicação já enfileirada na main
        // (ver a guarda em [publish]) não pode ressuscitar a notificação
        // depois daqui.
        running = false
        session?.let {
            it.isActive = false
            it.release()
        }
        session = null
        instance = null
        foregrounded = false
        tiposPublicados = 0
        // A PROTEÇÃO MORREU JUNTO. Se a transmissão ainda se julga no ar, o dono
        // precisa saber: sem isto o próximo `espelhoLigar()` encontra o estado
        // antigo e vira no-op CALADO. Quando a parada foi pedida,
        // `transmissaoDesligada` já zerou tudo e nada é avisado aqui.
        // A conferência e a limpeza são um ato só (ver [trava]): uma contagem de
        // telas chegando de uma thread do servidor entre as duas ressuscitaria a
        // transmissão DEPOIS do aviso, e ninguém mais a desmontaria. O aviso em
        // si sai FORA do monitor — ele chama de volta o dono, pelo `onGone`.
        val haviaTx = synchronized(trava) {
            val havia = transmissao != null
            transmissao = null
            havia
        }
        if (haviaTx) EspelhoEnergia.aoMorrerOServico()
        // O sistema remove a notificação de um serviço em primeiro plano ao
        // destruí-lo, mas [publish] também usa `notify` quando o serviço já
        // está publicado — e um `notify` não tem relação nenhuma com o ciclo
        // de vida do Service. O cancelamento explícito é o que garante que
        // nada sobre na gaveta, do mesmo jeito que no [SyncService].
        try {
            getSystemService(NotificationManager::class.java)?.cancel(NOTIF_ID)
        } catch (e: Exception) {
            Log.w(TAG, "não foi possível remover a notificação de controles", e)
        }
        super.onDestroy()
    }

    private val mainHandler = android.os.Handler(android.os.Looper.getMainLooper())

    /** Espelha a cena atual na sessão de mídia e na notificação. */
    private fun publish() {
        // `update` é chamado da thread do WebView (todo @JavascriptInterface
        // roda fora da main). `MediaSession` tem handler próprio e não promete
        // ser thread-safe — mexer nele de outra thread é o tipo de coisa que
        // funciona num aparelho e falha calado noutro.
        if (android.os.Looper.myLooper() != android.os.Looper.getMainLooper()) {
            mainHandler.post { publish() }
            return
        }
        // O SALTO DE THREAD ACIMA ABRE UMA JANELA, e é dentro dela que o serviço
        // pode morrer: `update` roda na thread do WebView, confere `running` lá
        // e enfileira isto; entre uma coisa e outra o `onDestroy` (de um
        // `stopSelf` anterior) roda na main. Sem esta guarda a continuação
        // publicava numa instância já destruída — um `notify` que ninguém mais
        // cancela (o cartão eterno que o [SyncService] aprendeu a evitar) ou um
        // `startForeground` de um serviço que não existe. Como o lado web
        // deduplica por chave e não reenvia, a notificação órfã ficaria de pé
        // com os botões mortos até o app ser fechado.
        //
        // MAS A CENA PODE TER SOBREVIVIDO À MORTE DO SERVIÇO: um `active:false`
        // seguido de um `active:true` rápido faz o `update()` novo ver
        // `running == true`, enfileirar esta publicação, e o `onDestroy` do stop
        // anterior rodar ANTES dela. Descartar aqui deixava `scene` preenchida
        // sem serviço, e nada mais o religava. Redisparar o start fecha a
        // janela; o caminho NORMAL de parada não ressuscita nada, porque [stop]
        // limpa `scene` antes de derrubar o serviço.
        if (!running) {
            if (scene != null || transmissao != null) iniciar(applicationContext)
            return
        }
        val s = scene ?: Scene()
        // SEM CENA a sessão de mídia é ZERADA, e não preenchida com o placeholder
        // "Nada em exibição": com um `PlaybackState` pausado o sistema promove a
        // sessão ao painel de mídia das configurações rápidas, e o operador
        // ganharia um player fantasma para controlar coisa nenhuma. `STATE_NONE`
        // sem ações é o que diz "não há mídia aqui" — o cartão dessa hora é o da
        // transmissão, montado abaixo.
        if (scene == null) {
            session?.setPlaybackState(
                PlaybackState.Builder().setState(PlaybackState.STATE_NONE, 0L, 0f).build(),
            )
        }
        if (scene != null) session?.let { ms ->
            ms.setMetadata(
                MediaMetadata.Builder()
                    .putString(MediaMetadata.METADATA_KEY_TITLE, s.title)
                    .putString(MediaMetadata.METADATA_KEY_ARTIST, s.subtitle)
                    // Duração desconhecida vira -1: é assim que o sistema
                    // entende "sem barra de posição". Com 0 ele desenha uma
                    // barra zerada, que se lê como travada — e imagem, texto
                    // bíblico e mensagem não têm duração nenhuma.
                    .putLong(
                        MediaMetadata.METADATA_KEY_DURATION,
                        if (s.durationMs > 0) s.durationMs else -1L,
                    )
                    .build(),
            )
            // A partir do Android 13 o sistema DESENHA os controles a partir
            // deste PlaybackState — as `Notification.Action` abaixo são
            // ignoradas nessas versões. Por isso "Parar" e a cortina precisam
            // ser CUSTOM ACTIONS da sessão: como Notification.Action elas
            // simplesmente não apareciam, e só sobravam os botões nativos.
            // O CONJUNTO É O MESMO nos dois lugares — aqui e nas
            // `Notification.Action` de `buildNotification`. A partir do Android
            // 13 quem DESENHA é este `PlaybackState`; abaixo dele, as actions.
            // Declarar um botão só de um lado é fazê-lo existir em metade dos
            // aparelhos, que é o defeito da v1.17 com outro nome.
            val acoes = if (s.actions.isEmpty()) ACOES_PADRAO else s.actions
            var mascara = 0L
            if (acoes.contains(SessionRemote.PLAY_PAUSE)) {
                mascara = mascara or PlaybackState.ACTION_PLAY or
                    PlaybackState.ACTION_PAUSE or PlaybackState.ACTION_PLAY_PAUSE
            }
            if (acoes.contains(SessionRemote.PREV)) {
                mascara = mascara or PlaybackState.ACTION_SKIP_TO_PREVIOUS
            }
            if (acoes.contains(SessionRemote.NEXT)) {
                mascara = mascara or PlaybackState.ACTION_SKIP_TO_NEXT
            }
            if (acoes.contains(SessionRemote.STOP)) mascara = mascara or PlaybackState.ACTION_STOP
            ms.setPlaybackState(
                PlaybackState.Builder()
                    .setActions(mascara)
                    .let { b ->
                        if (!acoes.contains(SessionRemote.VIEW)) b else b.addCustomAction(
                        PlaybackState.CustomAction.Builder(
                            SessionRemote.VIEW,
                            if (s.wallpaper) "Mostrar mídia" else "Cobrir telão",
                            // O ÍCONE diz o ESTADO (telão coberto = imagem
                            // riscada) e o RÓTULO diz a ação — a mesma divisão
                            // que a base web adotou na v5.50. Até lá o ícone
                            // também era a ação, e a inversão do lado web
                            // deixaria o MESMO símbolo significando coisas
                            // opostas na tela e na notificação, que é
                            // exatamente o defeito que a convenção existe para
                            // evitar. Na tela quem carrega o estado é a cor;
                            // aqui, onde não há cor de estado, é o ícone —
                            // e o rótulo, que a notificação tem e a tela não,
                            // continua nomeando o que o toque faz.
                            if (s.wallpaper) R.drawable.ic_image_off else R.drawable.ic_image,
                        ).build(),
                        )
                    }
                    .let { b ->
                        if (!acoes.contains(SessionRemote.STOP)) b else b.addCustomAction(
                        PlaybackState.CustomAction.Builder(
                            SessionRemote.STOP,
                            "Parar",
                            // QUADRADO CHEIO, e vetor nosso: o sistema não tem
                            // um ícone de parar (ver o KDoc de `ic_stop`), e o
                            // ✕ que estava aqui dizia "fechar" ao lado de um
                            // play e de um ⏭ — a única coisa que este botão
                            // não faz. Mesmo símbolo do `#stop` da barra de
                            // transporte do app.
                            R.drawable.ic_stop,
                        ).build(),
                        )
                    }
                    .setState(
                        if (s.playing) PlaybackState.STATE_PLAYING else PlaybackState.STATE_PAUSED,
                        s.positionMs,
                        if (s.playing) 1f else 0f,
                    )
                    .build(),
            )
        }
        // Marco da extrapolação: é contra isto que `updateFromDisplay` decide
        // se o tempo do telão é um salto ou só o relógio andando. Os três sob o
        // mesmo monitor da cena ([trava]) porque são lidos JUNTOS lá — com a
        // gravação partida ao meio, um `lastPubAt` novo ao lado de um
        // `lastPubPosMs` velho fabrica um salto.
        synchronized(trava) {
            lastPubPosMs = s.positionMs
            lastPubAt = android.os.SystemClock.elapsedRealtime()
            lastPubPlaying = s.playing
        }

        val notif = buildNotification(this, s, session)
        // O TIPO acompanha as razões vivas, e por isso é recalculado a cada
        // publicação: a transmissão pode subir com o serviço já em primeiro
        // plano (o operador liga as telas no meio de um louvor), e um
        // `connectedDevice` que nunca fosse declarado deixaria a proteção
        // valendo só enquanto houvesse cena. `startForeground` chamado de novo
        // com a máscara nova é a forma suportada de mudá-la.
        val tipos = tiposAgora()
        if (foregrounded && tipos == tiposPublicados) {
            getSystemService(NotificationManager::class.java)?.notify(NOTIF_ID, notif)
        } else {
            ServiceCompat.startForeground(this, NOTIF_ID, notif, tipos)
            foregrounded = true
            tiposPublicados = tipos
        }
    }

    /** A união dos tipos das razões vivas — ver o KDoc da classe. */
    private fun tiposAgora(): Int {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return 0
        var t = ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
        if (transmissao != null) t = t or ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE
        return t
    }

    private fun ensureChannel() {
        val nm = getSystemService(NotificationManager::class.java) ?: return
        // OS CANAIS DA TRANSMISSÃO SAEM COM ELA (v5.190). Eles pertenciam ao
        // `EspelhoService`, que deixou de existir — e um canal órfão fica na
        // tela de notificações do app para sempre, oferecendo ao operador um
        // interruptor que não governa mais nada.
        for (velho in CANAIS_APOSENTADOS) {
            try { nm.deleteNotificationChannel(velho) } catch (e: Exception) {
                Log.i(TAG, "canal $velho não saiu: ${e.message}")
            }
        }
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return
        // IMPORTANCE_LOW: controles são um painel, não um alerta — nada de som
        // nem heads-up no meio de um culto.
        val ch = NotificationChannel(CHANNEL_ID, "Projeção", NotificationManager.IMPORTANCE_LOW).apply {
            description = "Controles do que está no ar"
            setShowBadge(false)
            enableVibration(false)
            setSound(null, null)
        }
        nm.createNotificationChannel(ch)
    }

    companion object {
        private const val TAG = "SessionService"
        private const val CHANNEL_ID = "session"

        /** Os canais do antigo `EspelhoService` — ver [ensureChannel]. */
        private val CANAIS_APOSENTADOS = listOf("espelho", "espelho2")
        private const val NOTIF_ID = 2   // 1 é do SyncService — as duas coexistem
        private const val ACTION_PREFIX = "br.org.iasd.av.remote."

        /** O "Desligar transmissão" do cartão — ver `cartaoDaTransmissao`. */
        private const val ACTION_DESLIGAR_TX = "br.org.iasd.av.espelho.desligar"

        /**
         * O que está no ar, reportado pelo lado web (`pushNowPlaying` em
         * controle.js). `slideMode` decide o que ⏮/⏭ significam — ver
         * [buildNotification].
         */
        data class Scene(
            val title: String = "Nada em exibição",
            val subtitle: String = "",
            val playing: Boolean = false,
            val slideMode: Boolean = false,
            /** Como o operador CHAMA o que ⏮/⏭ passam agora: "estrofe" numa
             *  letra, "página" numa apresentação. Vazio = o padrão de sempre. */
            val slideLabel: String = "",
            val wallpaper: Boolean = false,
            val positionMs: Long = 0,
            val durationMs: Long = 0,
            /**
             * OS BOTÕES DESTA CENA, na ordem, escolhidos pelo LADO WEB (v5.231).
             *
             * Cinco botões fixos serviam a uma cena só — a de mídia tocando. Com
             * um cronômetro no ar sem louvor nenhum, ⏮/⏭ e o play/pause não têm
             * o que fazer: eles ficavam ali, ocupando o modo compacto e roubando
             * o alvo de toque das duas ações que de fato existem (cobrir o telão
             * e parar).
             *
             * A LISTA VEM DE FORA por invariante (a 5 do CLAUDE.md): quem sabe
             * se "próxima estrofe" faz sentido agora é o `controle.js`, que tem
             * a cena inteira na mão. Uma cópia dessa regra em Kotlin envelheceria
             * à parte da de lá — foi por isso que o transporte nunca decidiu nada
             * aqui, e o conjunto de botões é a mesma decisão.
             *
             * Vazia = o conjunto clássico ([ACOES_PADRAO]): é o que um BUNDLE
             * ANTIGO num shell novo produz, e ele tem de continuar com os cinco
             * botões de sempre.
             */
            val actions: List<String> = emptyList(),
        )

        /**
         * O conjunto clássico — o que existia até a v5.231, e o que vale quando
         * o lado web não manda nada (bundle antigo).
         */
        private val ACOES_PADRAO = listOf(
            SessionRemote.PREV, SessionRemote.PLAY_PAUSE, SessionRemote.NEXT,
            SessionRemote.STOP, SessionRemote.VIEW,
        )

        /**
         * O MONITOR DAS DUAS RAZÕES DE VIVER ([scene] e [transmissao]) e dos
         * marcos da extrapolação (`lastPub*`).
         *
         * `@Volatile` dá VISIBILIDADE, nunca ATOMICIDADE — e as duas são
         * escritas por LER-CALCULAR-GRAVAR a partir de threads diferentes:
         * [update]/[stop] chegam pela thread da ponte do CONTROLE,
         * [updateFromDisplay] pela ponte do TELÃO (o `busPost`, a ~4 Hz) e
         * também pela thread de socket do [EspelhoServidor] (o `tela-status`
         * do `POST /r`), e as telas da transmissão mudam nas threads do
         * servidor. Sem o monitor, um Parar que cruze com um `display-status`
         * em voo RESSUSCITA a cena morta: a thread do telão já leu `s`
         * não-nulo e grava `s.copy(…)` por cima do `scene = null`, o serviço
         * sobe de novo e o cartão volta com o louvor que acabou de sair — e
         * ele não se conserta sozinho, porque o lado web deduplica por chave e
         * não reenvia o `active:false`. É o mesmo defeito que o
         * `getState`+`setState` que o projeto proíbe para o `state` do banco,
         * aqui em Kotlin.
         *
         * **`publish()` e [iniciar] ficam FORA do bloco.** O monitor cobre só
         * a leitura e a gravação dos campos; publicar salta para a main thread
         * e volta a chamar para cá, e segurar o monitor nesse caminho é
         * transformar uma correção de corrida numa fila.
         */
        private val trava = Any()

        @Volatile
        private var scene: Scene? = null

        /**
         * A SEGUNDA razão de viver: o servidor das telas da rede está no ar.
         *
         * Independente da [Scene] de propósito — ela nasce e morre com o lado
         * web, esta com o toque do operador, e o serviço só para quando as duas
         * caem (ver o KDoc da classe).
         */
        data class Transmissao(val endereco: String = "", val telas: Int = 0)

        @Volatile
        private var transmissao: Transmissao? = null

        @Volatile
        private var running = false

        /**
         * `startForeground` já foi chamado por este serviço.
         *
         * Fica no companion (e não na instância) porque quem precisa dele é o
         * [stop]: enquanto ele for falso, existe um `startForegroundService`
         * PENDENTE, e derrubar o serviço nessa janela é o que faz o sistema
         * matar o app por "did not then call Service.startForeground()".
         * `running` não serve para isso — é marcado no `onCreate`, que roda
         * antes do `onStartCommand` onde o `startForeground` de fato acontece.
         */
        @Volatile
        private var foregrounded = false

        /** A máscara de tipos já entregue ao `startForeground` — ver
         *  `tiposAgora`. Zerada no `onDestroy` junto com [foregrounded]. */
        @Volatile
        private var tiposPublicados = 0

        @Volatile
        private var instance: SessionService? = null

        /** O serviço está de pé e publicado? (o Registro da transmissão lê
         *  isto para dizer se a proteção existe). */
        fun emPrimeiroPlano(): Boolean = running && foregrounded

        /** Há cena no ar: sobe o serviço (se preciso) e atualiza a notificação. */
        fun update(ctx: Context, s: Scene) {
            synchronized(trava) { scene = s }
            val inst = instance
            if (running && inst != null) {
                inst.publish()
                return
            }
            iniciar(ctx)
        }

        /**
         * Dispara o serviço. Extraído do [update] porque agora há TRÊS
         * chamadores: a cena nova, a janela do [publish] (serviço morto com
         * cena viva) e o [updateFromDisplay] no mesmo estado. O nome NÃO é
         * `startService` de propósito: dentro da instância esse nome colide com
         * o `Context.startService(Intent)` herdado.
         */
        private fun iniciar(ctx: Context) {
            try {
                val i = Intent(ctx, SessionService::class.java)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    ctx.startForegroundService(i)
                } else {
                    ctx.startService(i)
                }
            } catch (e: Exception) {
                // Android 12+ recusa iniciar serviço em primeiro plano com o app
                // em segundo plano. Na prática a cena nasce de um toque na tela,
                // mas um avanço automático de playlist com o app minimizado e a
                // sessão já encerrada cairia aqui — sem notificação, e nada mais:
                // a projeção em si não depende deste serviço para funcionar.
                Log.w(TAG, "não foi possível iniciar a sessão", e)
            }
        }

        /**
         * Tolerância antes de republicar por causa da posição — mesma ideia (e
         * mesmo valor) do `POS_TOL_MS` do lado web: a sessão extrapola o tempo
         * sozinha, então só um SALTO precisa de reenvio. Absorve o jitter do
         * `display-status`, que chega com latência variável.
         */
        private const val POS_TOL_MS = 1500L

        @Volatile private var lastPubPosMs = 0L
        @Volatile private var lastPubAt = 0L
        @Volatile private var lastPubPlaying = false

        /**
         * Estado vindo do TELÃO (ver `NativeBridge.snoopDisplayStatus`). Só
         * corrige play/pause, posição e duração — o resto da cena continua
         * sendo do lado web.
         *
         * Sem cena publicada não faz nada: o telão pode estar emitindo status
         * de uma reprodução que o Controle ainda nem reportou, e a notificação
         * nasceria sem título nenhum.
         */
        fun updateFromDisplay(ctx: Context, playing: Boolean, positionMs: Long, durationMs: Long) {
            // A LEITURA E A GRAVAÇÃO DE `scene` SÃO INDIVISÍVEIS — ver [trava].
            // Esta thread não é a do lado web: fora do monitor, um `scene = null`
            // de um Parar concorrente seria sobrescrito por uma cópia da cena
            // anterior, e o cartão voltaria com o louvor que acabou de sair.
            synchronized(trava) {
                val s = scene ?: return
                val dur = if (durationMs > 0) durationMs else s.durationMs
                // Mesma economia do lado web: em reprodução contínua a sessão
                // extrapola sozinha, então só vale reenviar quando o play/pause
                // muda, a duração muda ou o tempo real destoa do extrapolado.
                val extrapolado = if (lastPubAt == 0L) null else {
                    lastPubPosMs + if (lastPubPlaying) android.os.SystemClock.elapsedRealtime() - lastPubAt else 0L
                }
                val saltou = extrapolado == null || Math.abs(positionMs - extrapolado) > POS_TOL_MS
                if (playing == s.playing && dur == s.durationMs && !saltou) return
                scene = s.copy(playing = playing, positionMs = positionMs, durationMs = dur)
            }
            val inst = instance
            if (inst != null) {
                inst.publish()
            } else {
                // Cena viva sem serviço: é a mesma janela que o [publish] fecha
                // — e o telão emitindo status é a prova de que há o que mostrar.
                // Religar aqui é o que dá a esta fonte (a única que sobrevive ao
                // estrangulamento do Controle) o poder de recuperar a
                // notificação, e é para isto que o `ctx` existe na assinatura.
                iniciar(ctx)
            }
        }

        /**
         * Sem cena: derruba o serviço, e a notificação vai junto.
         *
         * O `scene = null` é a parte que sempre acontece — é ele que fecha a
         * janela do serviço que ainda está SUBINDO: o `onStartCommand` lê a
         * cena, encontra `null` e se despede sozinho (depois de chamar
         * `startForeground`, como o sistema exige).
         *
         * `stopService` só entra quando o serviço JÁ está em primeiro plano.
         * Chamá-lo com um `startForegroundService` pendente é o caminho
         * conhecido para o app ser morto por "did not then call
         * Service.startForeground()" — o sistema derruba o serviço com o
         * pedido ainda armado e cobra a dívida do processo, que é o dos dois
         * WebViews e da `Presentation`. Perder a notificação de controles seria
         * um arranhão; perder a projeção, não.
         */
        fun stop(ctx: Context) {
            // A MORTE DA CENA E A DOS MARCOS SÃO O MESMO ATO — ver [trava]: é
            // este `scene = null` que o `display-status` em voo sobrescrevia.
            synchronized(trava) {
                scene = null
                // Os marcos da extrapolação morrem com a cena: sem isto, o
                // primeiro `display-status` da cena SEGUINTE era comparado com a
                // posição da anterior — um "salto" fabricado (ou, pior, um salto
                // real absorvido por coincidência de tempos).
                lastPubPosMs = 0L
                lastPubAt = 0L
                lastPubPlaying = false
            }
            pararSeNadaVivo(ctx)
        }

        /**
         * A REGRA DE PARADA, num lugar só: o serviço morre quando as DUAS razões
         * caem. Com uma delas viva, o cartão apenas troca de cara.
         */
        private fun pararSeNadaVivo(ctx: Context) {
            if (scene != null || transmissao != null) {
                // Sobrou razão: o cartão só troca de cara. E se o serviço tiver
                // morrido nesse meio-tempo, ele volta — a razão viva é a prova
                // de que há o que proteger.
                val inst = instance
                if (running && inst != null) inst.publish() else iniciar(ctx)
                return
            }
            if (!foregrounded) return
            try {
                ctx.stopService(Intent(ctx, SessionService::class.java))
            } catch (e: Exception) {
                Log.w(TAG, "não foi possível parar a sessão", e)
            }
        }

        // ---------- a TRANSMISSÃO (a segunda razão de viver) ----------

        /** O servidor das telas subiu: o cartão passa a existir mesmo sem cena. */
        fun transmissaoLigada(ctx: Context, endereco: String) {
            synchronized(trava) { transmissao = Transmissao(endereco, 0) }
            val inst = instance
            if (running && inst != null) inst.publish() else iniciar(ctx)
        }

        /** O servidor desceu: sem cena, o cartão vai junto. */
        fun transmissaoDesligada(ctx: Context) {
            synchronized(trava) { transmissao = null }
            pararSeNadaVivo(ctx)
        }

        // OS DOIS ABAIXO CHEGAM DAS THREADS DO SERVIDOR (uma tela que entra ou
        // sai, o `religarNoIp`), e o desligar chega da main: fora do monitor,
        // uma contagem de telas gravada por cima do `transmissao = null` faria o
        // cartão da transmissão renascer — e o `aoMorrerOServico` do `onDestroy`
        // já teria passado, deixando o dono julgando que a proteção existe.

        fun transmissaoTelas(ctx: Context, quantas: Int) {
            synchronized(trava) {
                val t = transmissao ?: return
                if (t.telas == quantas) return
                transmissao = t.copy(telas = quantas)
            }
            atualizarTransmissao(ctx)
        }

        fun transmissaoEndereco(ctx: Context, novo: String) {
            synchronized(trava) {
                val t = transmissao ?: return
                if (t.endereco == novo) return
                transmissao = t.copy(endereco = novo)
            }
            atualizarTransmissao(ctx)
        }

        /**
         * Republica por causa da transmissão — e **só quando ela é a cara
         * visível**. Com uma cena no ar o cartão é o player, e o endereço não
         * aparece nele: republicar ali seria gastar uma atualização de
         * notificação (que o Android limita) para redesenhar exatamente a mesma
         * coisa.
         */
        private fun atualizarTransmissao(ctx: Context) {
            if (scene != null) return
            val inst = instance
            if (running && inst != null) inst.publish() else iniciar(ctx)
        }

        private fun actionIntent(ctx: Context, action: String): PendingIntent {
            val i = Intent(ctx, SessionService::class.java).setAction(ACTION_PREFIX + action)
            return PendingIntent.getService(
                ctx,
                action.hashCode(),
                i,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )
        }

        /**
         * A COR DO CARTÃO SEGUE O TEMA DO APP (v5.210).
         *
         * Uma notificação `MediaStyle` sem cor declarada é pintada pelo sistema
         * com o cinza padrão dele — que não é nem o claro nem o escuro do app, e
         * fica visivelmente estranho ao lado da tela de onde ele veio. Como este
         * cartão é o app inteiro quando o celular está no suporte, ele passa a
         * usar o MESMO `--bg` da base web, pelo tema que o operador escolheu.
         *
         * `setColorized(true)` é o que faz o sistema de fato usá-la como FUNDO
         * (sem ele a cor é só um respingo no ícone), e ele só é honrado em
         * notificação de serviço em primeiro plano ou `MediaStyle` — que é
         * exatamente o caso dos dois cartões deste arquivo. O contraste do texto
         * quem resolve é o Android, a partir da luminância da cor.
         */
        private fun corDoTema(ctx: Context): Int =
            ctx.getColor(
                if (MainActivity.temaClaroSalvo(ctx)) R.color.app_bg_claro else R.color.app_bg,
            )

        /**
         * O OPERADOR TROCOU DE TEMA: o cartão que está na gaveta ficou com a cor
         * do tema anterior.
         *
         * Sem isto a notificação só mudaria de cor no próximo `publish()` — que
         * numa cena parada pode ser daqui a um louvor inteiro —, e o operador
         * veria o app claro com um cartão escuro pendurado nele. Chamado pela
         * [MainActivity.setTemaClaro].
         */
        fun temaMudou() {
            val inst = instance
            if (running && inst != null) inst.publish()
        }

        private fun acao(ctx: Context, icone: Int, rotulo: String, action: String): Notification.Action =
            Notification.Action.Builder(
                Icon.createWithResource(ctx, icone),
                rotulo,
                actionIntent(ctx, action),
            ).build()

        /** O que a transmissão tem a dizer numa linha — a mesma nos dois cartões. */
        private fun linhaDaTransmissao(tx: Transmissao): String = when {
            tx.endereco.isEmpty() -> "Preparando…"
            tx.telas == 0 -> tx.endereco + " · nenhuma tela ainda"
            tx.telas == 1 -> tx.endereco + " · 1 tela"
            else -> tx.endereco + " · " + tx.telas + " telas"
        }

        /**
         * O cartão quando NÃO há cena e a transmissão está no ar.
         *
         * É aqui — e **só** aqui — que mora o "Desligar transmissão". Ao lado do
         * transporte, durante um louvor, ele seria um toque errado no escuro
         * derrubando a projeção da igreja inteira; sem cena não há transporte a
         * mostrar, e sobra o espaço exato para ele.
         *
         * Sem `MediaStyle`: um player sem nada tocando é justamente o cartão que
         * esta cara existe para não ser.
         */
        private fun cartaoDaTransmissao(
            ctx: Context,
            tx: Transmissao,
            abrir: PendingIntent,
        ): Notification {
            val desligar = PendingIntent.getService(
                ctx,
                "tx-desligar".hashCode(),
                Intent(ctx, SessionService::class.java).setAction(ACTION_DESLIGAR_TX),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )
            val linha = linhaDaTransmissao(tx)
            val b = Notification.Builder(ctx, CHANNEL_ID)
                // O mesmo símbolo que a cortina usa nos controles: aqui ele diz
                // "há imagem saindo deste aparelho".
                .setSmallIcon(R.drawable.ic_image)
                .setContentTitle("Transmissão no ar")
                .setContentText(linha)
                .setContentIntent(abrir)
                // O endereço já está na tela do celular e à vista de quem estiver
                // perto da TV; escondê-lo na tela de bloqueio não protegeria nada
                // e tiraria a informação útil.
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setOnlyAlertOnce(true)
                .setShowWhen(false)
                .setOngoing(true)
                // A cara do app, nos dois cartões — ver `corDoTema`.
                .setColor(corDoTema(ctx))
                .setColorized(true)
                .addAction(
                    acaoDireta(ctx, android.R.drawable.ic_menu_close_clear_cancel, "Desligar transmissão", desligar),
                )
            // ADIADA: o sistema segura o cartão por ~10 s antes de mostrá-lo, e
            // uma transmissão ligada e desligada nesse intervalo (o operador
            // testando antes do culto) não chega a piscar nada. API 31+; abaixo
            // disso o cartão aparece na hora, como sempre apareceu.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                b.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_DEFERRED)
            }
            return b.build()
        }

        private fun acaoDireta(
            ctx: Context,
            icone: Int,
            rotulo: String,
            pi: PendingIntent,
        ): Notification.Action =
            Notification.Action.Builder(Icon.createWithResource(ctx, icone), rotulo, pi).build()

        private fun buildNotification(ctx: Context, s: Scene, ms: MediaSession?): Notification {
            val abrir = PendingIntent.getActivity(
                ctx,
                0,
                Intent(ctx, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_NEW_TASK
                },
                PendingIntent.FLAG_IMMUTABLE,
            )

            // A CARA DA TRANSMISSÃO: sem cena, o cartão deixa de ser um player
            // vazio ("Nada em exibição" com botões que não fazem nada) e passa a
            // dizer o que de fato está acontecendo — o endereço que as telas
            // precisam e quantas estão recebendo. Ver o KDoc da classe.
            val tx = transmissao
            if (scene == null && tx != null) return cartaoDaTransmissao(ctx, tx, abrir)

            // ⏮/⏭ mudam de significado conforme o que está no ar. Na tela os dois
            // eixos têm botões próprios (mídia na linha de transporte, estrofe ao
            // lado da preview), mas aqui só cabem três no modo compacto — e com
            // uma letra, um versículo ou uma mensagem em cena é a estrofe que o
            // operador está passando. O rótulo diz qual é o modo, para não virar
            // adivinhação.
            val unidade = s.slideLabel.ifBlank { "estrofe" }
            val rotuloPrev = if (s.slideMode) "Anterior ($unidade)" else "Anterior"
            val rotuloNext = if (s.slideMode) "Próxima ($unidade)" else "Próxima"

            // O CONJUNTO DE BOTÕES vem do lado web (ver [Scene.actions]); aqui
            // só se traduz id → ícone + rótulo. Um id desconhecido (bundle mais
            // novo que o shell) é IGNORADO em vez de virar botão vazio.
            val acoes = if (s.actions.isEmpty()) ACOES_PADRAO else s.actions
            val montadas = acoes.mapNotNull { id ->
                when (id) {
                    SessionRemote.PREV ->
                        acao(ctx, android.R.drawable.ic_media_previous, rotuloPrev, SessionRemote.PREV)
                    SessionRemote.PLAY_PAUSE -> acao(
                        ctx,
                        if (s.playing) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play,
                        if (s.playing) "Pausar" else "Reproduzir",
                        SessionRemote.PLAY_PAUSE,
                    )
                    SessionRemote.NEXT ->
                        acao(ctx, android.R.drawable.ic_media_next, rotuloNext, SessionRemote.NEXT)
                    // Parar: o quadrado cheio, não um ✕ (ver a custom action
                    // do `publish` e o KDoc de `ic_stop`).
                    SessionRemote.STOP -> acao(
                        ctx, R.drawable.ic_stop, "Parar", SessionRemote.STOP,
                    )
                    // Cortina do wallpaper: a ação mais usada num culto depois
                    // do play/pause — tirar a mídia do telão sem parar o áudio.
                    // Ícone = estado, rótulo = ação (ver a custom action do
                    // `publish`). Estas `Notification.Action` são decoração a
                    // partir do Android 13, mas precisam concordar com ela.
                    SessionRemote.VIEW -> acao(
                        ctx,
                        if (s.wallpaper) R.drawable.ic_image_off else R.drawable.ic_image,
                        if (s.wallpaper) "Mostrar mídia" else "Cobrir telão",
                        SessionRemote.VIEW,
                    )
                    else -> null
                }
            }

            val b = Notification.Builder(ctx, CHANNEL_ID)
                // Ícone = ESTADO, a mesma convenção da cortina: fixo em "play"
                // ele dizia "tocando" na barra de status com o louvor pausado.
                .setSmallIcon(
                    if (s.playing) android.R.drawable.ic_media_play
                    else android.R.drawable.ic_media_pause,
                )
                .setContentTitle(s.title)
                .setContentText(s.subtitle)
                .setContentIntent(abrir)
                // O que está projetado já está numa TV à vista de todos —
                // esconder o título na tela de bloqueio não protegeria nada e
                // tiraria justamente a informação útil.
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setOnlyAlertOnce(true)
                // A cor do app, e SÓ ela — ver `corDoTema`. Sem `largeIcon` de
                // propósito: não existe capa neste acervo, e uma capa inventada
                // seria decoração num cartão que o operador olha de relance no
                // escuro. Sólido e limpo lê mais rápido que ilustrado.
                .setColor(corDoTema(ctx))
                .setColorized(true)
                // Ongoing enquanto toca: evita que um deslize acidental tire o
                // painel de controle no meio do culto. Pausado ele é
                // dispensável, como manda o comportamento normal de um player.
                .setOngoing(s.playing)
            montadas.forEach { b.addAction(it) }

            // A TRANSMISSÃO APARECE AQUI TAMBÉM (v5.231). Com uma cena no ar
            // este cartão substitui o da transmissão, e até aqui isso a
            // apagava: o operador ligava as telas da rede, punha um louvor, e
            // a gaveta deixava de dizer que havia um servidor no ar. Agora ela
            // vira o SUBTEXTO — a linha do cabeçalho, que o `MediaStyle`
            // desenha e que não disputa espaço com o título nem com os botões.
            transmissao?.let { b.setSubText(linhaDaTransmissao(it)) }

            // O modo compacto mostra TRÊS, e eles são os três primeiros do
            // conjunto que de fato existe — com uma lista de dois, pedir o
            // índice 2 lançaria.
            val compactos = IntArray(minOf(3, montadas.size)) { it }
            val style = Notification.MediaStyle().setShowActionsInCompactView(*compactos)
            if (ms != null) style.setMediaSession(ms.sessionToken)
            b.setStyle(style)
            return b.build()
        }
    }
}
