package br.org.iasd.av

import android.content.Context
import android.content.pm.ApplicationInfo
import android.util.Log
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * O FAROL: uma busca por dia, para o app poder responder "quantos aparelhos
 * usaram isto esta semana?".
 *
 * ## O que ele é, e o que ele deliberadamente NÃO é
 *
 * Ele busca um arquivo estático de uma Release e joga fora a resposta. O que
 * conta é o `download_count` que o GitHub mantém naquele asset — um inteiro
 * público, agregado, que ninguém aqui lê e que este aparelho apenas incrementa.
 *
 * **Nada identificável atravessa a rede.** Não há corpo, não há cabeçalho
 * nosso, não há id — nem sorteado, nem derivado, nem com hash. É exatamente a
 * mesma requisição que o [WebUpdater] já faz 240 vezes por hora ao manifesto,
 * e por isso este arquivo **não acrescenta exposição nenhuma**: o IP que o
 * GitHub vê aqui é o mesmo que ele já via antes deste arquivo existir.
 *
 * **A regra que mantém isso verdadeiro: o farol não carrega query que varie por
 * APARELHO.** O `?t=` é carimbo de tempo contra cache (a mesma razão do
 * `WebUpdater.versionUrl`), não identidade — dois aparelhos que acendam no
 * mesmo milissegundo mandam a mesma URL, e é essa propriedade que separa
 * contagem agregada de rastreamento. Um parâmetro a mais aqui é uma decisão de
 * privacidade, nunca um detalhe de implementação.
 *
 * ## UM POR DIA, e não um por sessão
 *
 * A pergunta que interessa é "quantos APARELHOS", e um contador por sessão
 * responde outra coisa: quem abre o app quarenta vezes numa manhã de trabalho
 * vira quarenta. Com um por dia, a diferença entre duas leituras diárias é
 * **aparelhos ativos no dia** — que é a métrica de alcance — e o pior caso de
 * um aparelho é contribuir com 1.
 *
 * O relógio é [System.currentTimeMillis] (data), não [android.os.SystemClock]
 * (tempo de atividade): o que se quer é "já acendi HOJE?", e um aparelho que
 * fica ligado a semana inteira precisa acender de novo. O preço é que mexer no
 * relógio do aparelho mexe na contagem — irrelevante para uma agregação, e o
 * dado é guardado com [KEY_ULTIMO] em epoch para o retrocesso ser detectável
 * (relógio para trás acende uma vez a mais, nunca deixa de acender).
 *
 * ## NÃO HÁ MAIS CHAVE DE EXCLUSÃO (v1.4.42)
 *
 * Da v1.4.1 à v1.4.41 havia uma: uma linha de Configurações marcava o aparelho
 * do operador, e ele passava a acender **noutro contador** ([ASSET_DEV]). Ela
 * saiu a pedido dele — *"descarte a opção de contagem de uso como opcional,
 * deixe sempre ativo, não preciso do sistema de exclusividade"* —, e com ela
 * saíram a chave (`KEY_CONTA`), o `definirContar` e o `farolContar` da ponte.
 *
 * **O que sobra é a única exclusão que NUNCA foi opção: o build debuggável.**
 * Emulador e `assembleDebug` acendem no [ASSET_DEV] por
 * [ApplicationInfo.FLAG_DEBUGGABLE], lido em runtime e sem exigir o
 * `buildConfig` no Gradle. Ela fica porque não é uma preferência de ninguém —
 * é higiene de construção, sem UI, sem custo, e sem ela toda sessão de trabalho
 * entraria no número público como se fosse uma igreja.
 *
 * **O PREÇO ESTÁ DITO, e ele é do painel e não do código:** o aparelho de quem
 * publica passa a contar em [ASSET] como qualquer outro, todo dia. O número de
 * "aparelhos por dia" inclui o uso próprio a partir daqui, e é a página de
 * alcance que precisa dizer isso — um painel que não avisa é o "confiável e
 * falso" que este arquivo sempre nomeou, só que pelo outro lado.
 *
 * A chave que sobrou em `SharedPreferences` de quem já a usou **deixa de ser
 * lida**: [contar] não a consulta mais. Isso não é arrumação — é o ponto do
 * lote. Um aparelho marcado "fica de fora" e sem tela para desmarcar ficaria
 * fora da contagem para sempre, e contador não se corrige depois.
 *
 * ## E ELE FALHA CALADO, SEMPRE
 *
 * Sem rede, com a rede ruim, com a Release ainda não criada: nada acontece e
 * nada é dito. Não há retentativa, não há espera crescente e não há fila — um
 * dia perdido é um dia perdido, e o custo de errar para o lado do silêncio é
 * um ponto a menos numa série, contra o de gastar bateria e fio no meio de um
 * culto. É a única coisa deste projeto que pode falhar sem consequência.
 *
 * O acendimento é marcado **antes** da resposta chegar, e isso é deliberado:
 * o que se quer limitar é UMA TENTATIVA por dia. Marcar depois faria um
 * aparelho sem rede tentar a cada ronda, o dia inteiro.
 */
object Farol {

    private const val TAG = "Farol"

    /**
     * O mesmo repositório do [WebUpdater], e digitado à mão pelo mesmo motivo:
     * a URL está compilada no shell. Renomear o repositório exige mexer aqui
     * **e** publicar um APK — e o modo de falhar é mudo, então o Registro
     * mostra a última tentativa ([diagnostico]).
     */
    private const val REPO = "jonathasptbr-gh/Audio-Visual-IASD"

    /**
     * Tag PRÓPRIA, separada de `web-latest`, e isso é invariante e não
     * arrumação: o job `web-ota` RECOLHE assets antigos de `web-latest`
     * (`apk.yml`, "Recolher bundles antigos"), e apagar um asset **destrói o
     * contador dele para sempre**. Um farol vale justamente por ser velho.
     */
    private const val BASE = "https://github.com/$REPO/releases/download/dados-latest/"

    /** O contador de quem conta. */
    private const val ASSET = "b.txt"

    /** O contador de quem não conta — aparelho marcado, ou build debuggável. */
    private const val ASSET_DEV = "b-dev.txt"

    private const val PREFS = "farol"
    private const val KEY_ULTIMO = "ultimo"
    // (`KEY_CONTA` saiu na v1.4.42 com a chave de exclusão. A entrada continua
    //  gravada em quem já a usou e ninguém mais a lê — apagá-la exigiria uma
    //  migração para devolver bytes que não fazem falta, a mesma decisão do
    //  `cifraEscolhas` do lado web.)

    private const val UM_DIA_MS = 24L * 60 * 60 * 1000

    private const val CONNECT_TIMEOUT = 15_000
    private const val READ_TIMEOUT = 15_000

    /**
     * Fila PRÓPRIA, de uma thread e daemon.
     *
     * Ela não é nenhuma das quatro do [NativeBridge] porque não é chamada pela
     * ponte: quem a aciona é a ronda do [WebUpdater]. E não pode ser a `io`
     * daquele companion nem a thread da ronda — as duas são caminhos de que
     * outra coisa depende, e este é o único trabalho do app que pode esperar
     * para sempre sem que nada aconteça.
     */
    private val fila = Executors.newSingleThreadExecutor { r ->
        Thread(r, "farol").apply { isDaemon = true }
    }

    /** Cópia em memória de [KEY_ULTIMO]: a ronda bate a cada 15 s e ler o
     *  disco nesse compasso, para quase sempre não fazer nada, é desperdício.
     *  `Long.MIN_VALUE` é "ainda não li das prefs". */
    @Volatile
    private var ultimoEmMemoria = Long.MIN_VALUE

    /** O que o Registro mostra. Uma frase, escrita só por esta fila. */
    @Volatile
    private var diagnostico = "ainda não acendeu nesta sessão"

    /**
     * Chamado pela ronda do OTA, a cada 15 s na frente e 120 s em segundo
     * plano. Barato e quase sempre no-op: compara dois `Long` e volta.
     *
     * **Piggyback e não timer próprio.** A ronda já existe, já é daemon, já é
     * protegida por try/catch (uma exceção que escape dela CANCELA todas as
     * execuções seguintes) e já tem a cadência certa. Um segundo agendador
     * seria mais um lugar de onde a detecção pode morrer em silêncio.
     */
    fun talvezAcender(ctx: Context) {
        val app = ctx.applicationContext
        if (ultimoEmMemoria == Long.MIN_VALUE) {
            ultimoEmMemoria = prefs(app).getLong(KEY_ULTIMO, 0L)
        }
        val agora = System.currentTimeMillis()
        // `agora < ultimo` é o relógio andando para trás (fuso, NTP, a mão do
        // operador): acende, em vez de ficar mudo até o relógio alcançar o
        // carimbo antigo — que poderia ser meses.
        if (agora - ultimoEmMemoria in 0 until UM_DIA_MS) return

        ultimoEmMemoria = agora
        prefs(app).edit().putLong(KEY_ULTIMO, agora).apply()
        fila.execute { acender(app) }
    }

    /**
     * O aparelho entra na contagem pública?
     *
     * **Sempre, exceto num build debuggável** (v1.4.42). A chave de
     * Configurações que também respondia aqui saiu; ver o KDoc do arquivo.
     *
     * Ela continua sendo a resposta de UM lugar só, e é por isso que o
     * `farolEstado` da ponte devolve o VEREDITO (`conta`) e não a chave: no dia
     * em que aparecer um terceiro motivo, a tela não precisa saber que ele
     * existe.
     */
    fun contar(ctx: Context): Boolean = !debuggavel(ctx)

    fun ultimo(ctx: Context): Long = prefs(ctx).getLong(KEY_ULTIMO, 0L)

    fun diag(): String = diagnostico

    /**
     * Build debuggável, lido do próprio [ApplicationInfo].
     *
     * `BuildConfig.DEBUG` daria a mesma resposta e custaria ligar
     * `buildFeatures { buildConfig = true }` no Gradle — uma superfície de
     * build inteira para um booleano que a plataforma já entrega.
     */
    private fun debuggavel(ctx: Context): Boolean =
        (ctx.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0

    private fun prefs(ctx: Context) =
        ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun acender(app: Context) {
        val conta = contar(app)
        val asset = if (conta) ASSET else ASSET_DEV
        // Carimbo de tempo contra cache, NUNCA identidade — ver o KDoc do
        // arquivo. Sem ele um cache intermediário responde sem tocar no
        // contador, e o farol apaga sem nada dizer.
        val url = BASE + asset + "?t=" + System.currentTimeMillis()
        var conn: HttpURLConnection? = null
        try {
            conn = (URL(url).openConnection() as HttpURLConnection).apply {
                connectTimeout = CONNECT_TIMEOUT
                readTimeout = READ_TIMEOUT
                instanceFollowRedirects = true // releases/download redireciona
                setRequestProperty("Accept", "*/*")
                setRequestProperty("Cache-Control", "no-cache, no-store, max-age=0")
                setRequestProperty("Pragma", "no-cache")
            }
            // O CORPO PRECISA SER LIDO, e isto não é higiene de stream: uma
            // conexão abandonada antes do corpo pode ser cortada antes de o
            // GitHub registrar a entrega. São poucos bytes de propósito — o
            // asset existe para ser contado, não para ser lido.
            val codigo = conn.responseCode
            conn.inputStream.use { it.readBytes() }
            diagnostico = "$asset · HTTP $codigo · " + carimbo(System.currentTimeMillis())
            Log.i(TAG, "farol aceso: $asset HTTP $codigo")
        } catch (e: Exception) {
            // SEM RETENTATIVA. Ver o KDoc: um dia perdido custa um ponto na
            // série, e insistir custa fio e bateria no meio de um culto.
            diagnostico = "$asset · falhou (${e.javaClass.simpleName}) · " +
                carimbo(System.currentTimeMillis())
            Log.i(TAG, "farol não acendeu: ${e.message}")
        } finally {
            try { conn?.disconnect() } catch (_: Exception) {}
        }
    }

    private fun carimbo(ms: Long): String = try {
        java.text.SimpleDateFormat("dd/MM HH:mm", java.util.Locale.getDefault())
            .format(java.util.Date(ms))
    } catch (_: Exception) {
        ""
    }
}
