package br.org.iasd.av

import android.content.Context
import android.net.wifi.WifiManager
import android.os.BatteryManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.util.Log
import org.json.JSONObject

/**
 * A ENERGIA da transmissão: wake lock, Wi-Fi lock e a leitura térmica.
 *
 * ## Por que isto NÃO é um Service
 *
 * A energia não precisa de um: quem mantém o processo fora do congelamento é o
 * serviço em primeiro plano ([SessionService]), e o wake lock é do PROCESSO, não
 * de um componente. A transmissão já teve serviço e notificação próprios, e o
 * preço era a gaveta mostrando DOIS cartões do mesmo app.
 *
 * ## O pré-requisito do tipo `connectedDevice`, que derruba a primeira Release
 * de quem não o ler
 *
 * Além de `FOREGROUND_SERVICE_CONNECTED_DEVICE`, o tipo exige **pelo menos uma
 * de** `CHANGE_NETWORK_STATE` / `CHANGE_WIFI_STATE` /
 * `CHANGE_WIFI_MULTICAST_STATE` / `NFC` / `TRANSMIT_IR`. `INTERNET` e
 * `ACCESS_NETWORK_STATE` **não estão na lista**, e eram justamente as duas que
 * este app tinha: sem uma delas `startForeground` lança `SecurityException` e o
 * app morre com a projeção junto. O manifest declara
 * **`CHANGE_WIFI_MULTICAST_STATE`** (nível *normal*, a menos poderosa das
 * cinco), e ela FICA lá mesmo sem multicast nenhum no código — quem a exige é o
 * TIPO do serviço.
 *
 * E a nota da mesma página, escrita aqui para ninguém "consertar" isto daqui a
 * dois anos: *"if your app performs a **projection** … use the media projection
 * type instead"*. `mediaProjection` é **inalcançável de propósito** — não existe
 * token de `MediaProjection` neste desenho, e é isso que dispensa o diálogo de
 * consentimento por sessão e o indicador de gravação de tela **antes de
 * projetar, num culto**.
 *
 * ## O Wi-Fi lock, com a expectativa DITA e não prometida
 *
 * `WIFI_MODE_FULL` é *"deprecated and non-functional with no impact"*, e
 * `WIFI_MODE_FULL_HIGH_PERF` é tratado como ele. O `WIFI_MODE_FULL_LOW_LATENCY`
 * é real **mas só se aplica com o app em primeiro plano e a tela acesa** — isto
 * é, a única API que poderia consertar "a latência sobe com a tela apagada"
 * recusa-se a funcionar exatamente nessa situação. Ele é adquirido porque é
 * barato e ajuda com o app aberto; **não conserte latência confiando nele**, e
 * não prometa nada disso na UI.
 */
object EspelhoEnergia {

    private const val TAG = "EspelhoEnergia"

    private const val WAKELOCK_TIMEOUT_MS = 2 * 60 * 60 * 1000L // 2 h
    private const val WAKELOCK_RENEW_MIN_MS = 10 * 60 * 1000L // 10 min
    private const val TERMICA_MS = 60_000L

    private val relogio = Handler(Looper.getMainLooper())

    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null

    /** O contexto de APLICAÇÃO, guardado no [ligar]. Nunca uma Activity: este
     *  objeto sobrevive a ela, e reter uma seria um vazamento clássico. */
    @Volatile
    private var app: Context? = null

    /**
     * A transmissão está no ar (entre [ligar] e [desligar]).
     *
     * Herdeiro do `wanted` do serviço antigo, e responde à mesma pergunta: é ele
     * que distingue, quando o serviço morre, uma parada PEDIDA de uma morte que
     * o dono precisa saber ([onGone]).
     */
    @Volatile
    var ligada = false
        private set

    @Volatile
    private var endereco = ""

    @Volatile
    private var telas = 0

    @Volatile
    private var ultimaRenovacaoMs = 0L

    @Volatile
    private var termico = 0

    @Volatile
    private var termicoMaximo = 0

    /**
     * O operador tocou em **Desligar transmissão** na notificação. Quem desmonta
     * o servidor é o dono — este objeto não sabe o que é um `ServerSocket`, e a
     * invariante 5 do projeto vale aqui como em todo lugar.
     */
    @Volatile
    var onDesligar: (() -> Unit)? = null

    /**
     * A proteção morreu SEM que ninguém pedisse (memória, `Force stop` parcial,
     * uma cota que o sistema passe a cobrar). O dono tem de ESQUECER que estava
     * servindo, senão o próximo `espelhoLigar()` encontra o estado antigo e vira
     * no-op CALADO — o mesmo defeito que a `MainActivity` já corrige para o
     * download, com token de geração e tudo.
     */
    @Volatile
    var onGone: (() -> Unit)? = null

    /**
     * O degrau térmico mudou (`PowerManager.THERMAL_STATUS_*`). Quem decide o
     * que fazer é o dono; este objeto só mede e avisa quando o degrau muda.
     */
    @Volatile
    var onTermica: ((Int) -> Unit)? = null

    private val rondaTermica = object : Runnable {
        override fun run() {
            medirTermica()
            if (ligada) relogio.postDelayed(this, TERMICA_MS)
        }
    }

    /**
     * A transmissão subiu. [endereco] é o que a notificação mostra: com o app
     * minimizado ela é a única janela para ela.
     */
    fun ligar(ctx: Context, endereco: String) {
        app = ctx.applicationContext
        this.endereco = endereco
        telas = 0
        termico = 0
        termicoMaximo = 0
        ligada = true
        acquireWakeLock()
        acquireWifiLock()
        relogio.removeCallbacks(rondaTermica)
        relogio.postDelayed(rondaTermica, TERMICA_MS)
        SessionService.transmissaoLigada(ctx, endereco)
    }

    /** A transmissão desceu: a energia é devolvida e o cartão volta a ser só o
     *  player (ou some, se não houver cena). */
    fun desligar(ctx: Context) {
        ligada = false
        endereco = ""
        telas = 0
        relogio.removeCallbacks(rondaTermica)
        releaseWakeLock()
        releaseWifiLock()
        SessionService.transmissaoDesligada(ctx)
    }

    /**
     * Um bloco foi ENTREGUE a um cliente. Chamado das threads de escrita do
     * [EspelhoServidor], dezenas de vezes por segundo — por isso não faz nada
     * além de uma leitura volátil e um piso de tempo.
     */
    fun progresso() {
        renovarWakeLock()
    }

    /** Uma tela entrou ou saiu: com o app minimizado a notificação é a única
     *  janela, e o número de telas é metade da resposta a "está funcionando?". */
    fun telasMudaram(ctx: Context, quantas: Int) {
        telas = quantas
        SessionService.transmissaoTelas(ctx, quantas)
    }

    /**
     * O endereço mudou com a transmissão no ar (o `religarNoIp` do
     * [EspelhoServidor], que reabre o socket num IP novo em vez de derrubar a
     * projeção). Sem isto a notificação continuaria mostrando um endereço que
     * não atende mais.
     */
    fun enderecoMudou(ctx: Context, novo: String) {
        endereco = novo
        SessionService.transmissaoEndereco(ctx, novo)
    }

    /**
     * O serviço que carregava a proteção morreu. Chamado pelo [SessionService]
     * no `onDestroy` dele — ver [onGone].
     */
    fun aoMorrerOServico() {
        if (!ligada) return
        ligada = false
        relogio.removeCallbacks(rondaTermica)
        releaseWakeLock()
        releaseWifiLock()
        try {
            onGone?.invoke()
        } catch (e: Exception) {
            Log.w(TAG, "falhou avisando a morte da proteção", e)
        }
    }

    /**
     * O que só este objeto sabe, em JSON e sem uma frase — o dono junta com o
     * resto do diagnóstico. O Kotlin devolve DADO; quem escreve
     * "térmica: NONE (máx na sessão: LIGHT) · carregador: SIM" é o
     * `controle.js`. **A FORMA é a mesma de quando isto era um serviço**: um
     * campo renomeado aqui apagaria uma linha do Registro sem nada que o
     * explicasse.
     */
    fun estado(ctx: Context): JSONObject = JSONObject()
        .put("servico", ligada && SessionService.emPrimeiroPlano())
        .put("url", endereco)
        .put("telas", telas)
        .put("termico", termico)
        .put("termicoMax", termicoMaximo)
        .put("carregando", carregando(ctx))

    private fun carregando(ctx: Context): Boolean = try {
        ctx.getSystemService(BatteryManager::class.java)?.isCharging ?: false
    } catch (e: Exception) {
        false
    }

    // ---------- energia ----------

    private fun acquireWakeLock() {
        if (wakeLock?.isHeld == true) return
        val pm = app?.getSystemService(PowerManager::class.java) ?: return
        // `setReferenceCounted(false)` é o que permite ao [renovarWakeLock]
        // repetir o `acquire` sem acumular uma contagem que um único `release`
        // não devolveria.
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "AvIasd:espelho").apply {
            setReferenceCounted(false)
            acquire(WAKELOCK_TIMEOUT_MS)
        }
        ultimaRenovacaoMs = SystemClock.elapsedRealtime()
    }

    /**
     * Renovado por **progresso REAL** — um bloco entregue a um cliente —, nunca
     * por tique de relógio. Uma transmissão morta (cliente nenhum, servidor
     * caído) não pode segurar a CPU acordada até a bateria acabar; um culto de
     * duas horas, esse sim, não pode perder a proteção no meio porque o teto de
     * 2 h venceu.
     */
    private fun renovarWakeLock() {
        val wl = wakeLock ?: return
        val agora = SystemClock.elapsedRealtime()
        if (agora - ultimaRenovacaoMs < WAKELOCK_RENEW_MIN_MS) return
        ultimaRenovacaoMs = agora
        try {
            wl.acquire(WAKELOCK_TIMEOUT_MS)
        } catch (e: Exception) {
            Log.w(TAG, "não foi possível renovar o wake lock", e)
        }
    }

    private fun releaseWakeLock() {
        try {
            wakeLock?.let { if (it.isHeld) it.release() }
        } catch (e: Exception) {
            Log.w(TAG, "não foi possível soltar o wake lock", e)
        }
        wakeLock = null
    }

    private fun acquireWifiLock() {
        if (wifiLock?.isHeld == true) return
        try {
            val wm = app?.getSystemService(Context.WIFI_SERVICE) as? WifiManager ?: return
            val modo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                WifiManager.WIFI_MODE_FULL_LOW_LATENCY
            } else {
                // Antes da API 29 não existe o modo de baixa latência, e os
                // outros dois são não-funcionais. Fica pelo custo zero.
                @Suppress("DEPRECATION")
                WifiManager.WIFI_MODE_FULL_HIGH_PERF
            }
            wifiLock = wm.createWifiLock(modo, "AvIasd:espelho").apply {
                setReferenceCounted(false)
                acquire()
            }
        } catch (e: Exception) {
            // Um Wi-Fi lock que não sobe não impede nada de funcionar — ver o
            // KDoc do objeto: ele já é um no-op com a tela apagada.
            Log.w(TAG, "não foi possível tomar o Wi-Fi lock", e)
        }
    }

    private fun releaseWifiLock() {
        try {
            wifiLock?.let { if (it.isHeld) it.release() }
        } catch (e: Exception) {
            Log.w(TAG, "não foi possível soltar o Wi-Fi lock", e)
        }
        wifiLock = null
    }

    /**
     * A ronda térmica. `PowerManager.getCurrentThermalStatus()` é uma leitura
     * barata, mas é IPC: a cada minuto é o suficiente para um aparelho que
     * esquenta em dezenas de minutos, e caro demais para ser feito por bloco.
     */
    private fun medirTermica() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return
        val pm = app?.getSystemService(PowerManager::class.java) ?: return
        val agora = try {
            pm.currentThermalStatus
        } catch (e: Exception) {
            return
        }
        if (agora > termicoMaximo) termicoMaximo = agora
        if (agora == termico) return
        termico = agora
        try {
            onTermica?.invoke(agora)
        } catch (e: Exception) {
            Log.w(TAG, "falhou avisando a térmica", e)
        }
    }
}
