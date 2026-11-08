package br.org.iasd.av

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.core.content.FileProvider
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * O APK SE ATUALIZA SOZINHO — achar, baixar e entregar ao instalador.
 *
 * O [WebUpdater] já fazia isto para a base web, e a assimetria era o atrito:
 * um ajuste de JS chegava sozinho, e qualquer mudança de Kotlin obrigava o
 * operador a abrir o navegador, achar a Release no GitHub e caçar o `.apk`.
 * Numa semana de seis publicações isso é seis vezes.
 *
 * ## A garantia de segurança aqui é MAIS forte que a do OTA, e é de graça
 *
 * O bundle web precisa carregar um `sha256` no `version.json` porque nada mais
 * o valida: é código que passa a rodar no origin privilegiado. Um APK, não —
 * **o Android recusa instalar por cima um pacote que não esteja assinado com a
 * mesma chave**. Um binário adulterado no caminho simplesmente não instala, e o
 * erro é do sistema, não nosso. É por isso que este arquivo não replica o
 * `sha256`: a plataforma já dá uma garantia melhor, e uma segunda conferência
 * mais fraca ao lado dela só criaria a ilusão de que é ELA que protege.
 *
 * O que fica do [WebUpdater], porque continua valendo: **host travado** e
 * **https obrigatório**. Eles não provam autenticidade (quem escreve a Release
 * escreve o asset), mas impedem que um campo alterado aponte o download para um
 * servidor qualquer.
 *
 * ## O que ele NÃO faz
 *
 * **Não instala sozinho.** O diálogo do sistema é obrigatório e está certo que
 * seja: instalar um APK derruba o app inteiro, com a projeção junto. Quem
 * decide a hora é o operador, e o lado web nem oferece o botão com cena no ar,
 * download em curso ou espelho ligado — o mesmo `horaRuimParaAtualizar()` do
 * OTA, e aqui ele vale por inteiro, porque o custo é muito maior que um piscar.
 */
object ShellUpdater {

    private const val TAG = "ShellUpdater"

    /** O mesmo repositório do [WebUpdater], e agora por REFERÊNCIA: eram três
     *  constantes digitadas à mão (aqui, no [WebUpdater] e no [Farol]) e o
     *  contrato só nomeava duas. Renomear o repositório seguindo o contrato ao
     *  pé da letra deixaria a terceira falando de um nome que não existe mais —
     *  o `GET` viraria 404 e o farol pararia de contar em silêncio. */
    private const val REPO = WebUpdater.REPO

    /** Hosts permitidos, pelo mesmo motivo do [WebUpdater.HOSTS_OK]. */
    private val HOSTS_OK = setOf("api.github.com", "github.com", "objects.githubusercontent.com")

    /** Teto do APK. Generoso, mas não infinito: ele protege contra ABSURDO
     *  (um asset trocado por um arquivo de 4 GB), não contra número grande. */
    private const val TETO_BYTES = 300L * 1024 * 1024

    private const val TEMPO_MS = 20000

    /** O que a última procura achou. `null` = nunca procuramos, ou não há nada. */
    @Volatile private var achado: Achado? = null

    data class Achado(
        val versao: String,
        val url: String,
        val bytes: Long,
        val notas: String,
    )

    // ---------- o achado que vem PELO MANIFESTO (v5.234) ----------
    //
    // A partir da X1 ele é o ÚNICO caminho: a procura pela API do GitHub (o
    // `apkProcurar` da ponte e o `procurar` daqui) saiu com os órfãos. O
    // manifesto do canal OTA é um asset de release, baixá-lo não consome
    // limite nenhum, e desde a v5.234 ele carrega o bloco `shell` com a
    // versão, o link e o tamanho do APK — porque o workflow SEGURA a publicação
    // do bundle até a Release existir. A mesma requisição que já acontecia
    // responde as duas perguntas, e as responde juntas, que é o que permite a
    // tela falar de um lote em vez de dois eventos soltos.

    /**
     * O manifesto anunciou um APK. **Transporte puro**: quem decide se ele é
     * mais novo que o instalado é este objeto, que é quem sabe a versão
     * instalada — o [WebUpdater] só repassa o que leu.
     */
    fun anunciar(app: Context, versao: String, url: String, bytes: Long) {
        val v = limpar(versao)
        if (v.isEmpty() || url.isEmpty()) return
        if (!hostOk(url)) {
            // Mesma regra do download: um manifesto adulterado não pode apontar
            // o app para um servidor qualquer. Aqui a consequência é menor que
            // no OTA (o Android recusa instalar por cima um pacote de outra
            // chave), mas "menor" não é "nenhuma" — e a linha custa nada.
            Log.w(TAG, "manifesto anunciou APK fora do GitHub: $url")
            return
        }
        if (WebUpdater.compareVersions(v, limpar(versaoInstalada(app))) <= 0) {
            // O MANIFESTO CONTINUA ANUNCIANDO O APK DEPOIS DE ELE SER
            // INSTALADO, e isso é o correto: ele descreve o LOTE, não o estado
            // do aparelho. Quem tem de esquecer é este lado, senão a tela
            // ofereceria para sempre a instalação da versão que já está rodando.
            achado = null
            return
        }
        val anterior = achado
        if (anterior?.versao == v && anterior.url == url) return
        achado = Achado(versao = v, url = url, bytes = bytes, notas = "")
        Log.i(TAG, "APK v$v anunciado pelo manifesto (instalado: ${versaoInstalada(app)})")
    }

    /**
     * O manifesto veio SEM o bloco `shell`: esta base web não acompanha APK.
     *
     * Desde a X1 TODO achado vem do manifesto, então esquecer é apagar.
     */
    fun esquecerAnuncio() {
        achado = null
    }

    /** Há APK publicado e mais novo que o instalado? */
    fun temNovidade(): Boolean = achado != null

    /**
     * O achado, revalidado contra a versão instalada AGORA.
     *
     * A revalidação não é zelo: entre o anúncio e esta leitura o operador pode
     * ter instalado o APK — o processo é derrubado e recriado pela instalação,
     * mas um `achado` guardado num objeto de processo sobrevive ao caminho em
     * que ele não é (o instalador recusado e retomado depois). Oferecer a
     * instalação de uma versão já instalada é o tipo de laço que só se percebe
     * na terceira vez.
     */
    fun novidade(app: Context): Achado? {
        val a = achado ?: return null
        if (WebUpdater.compareVersions(a.versao, limpar(versaoInstalada(app))) <= 0) {
            achado = null
            return null
        }
        return a
    }

    /**
     * BAIXA e entrega ao instalador do sistema. Devolve `""` no sucesso, ou a
     * FRASE do erro — o mesmo contrato do `espelhoCertImportar`.
     *
     * O progresso vai por [onProgresso] (0..100), que o lado web empurra na
     * faixa de aviso: o download é de dezenas de MB numa rede de igreja, e uma
     * tela parada por dois minutos sem número é indistinguível de travamento.
     *
     * **UM DOWNLOAD POR VEZ É REGRA DA PONTE, não deste objeto.** Quem recusa o
     * segundo toque é o `apkEmCurso` do [NativeBridge], no fio do WebView, e a
     * `apk` de uma thread que serializa o resto. Havia aqui um `baixando` com a
     * MESMA frase do `NativeBridge`: ele era inalcançável (o único chamador está
     * dentro daquela fila) e a regra ficava escrita duas vezes, com dois donos.
     */
    fun baixarEInstalar(app: Context, onProgresso: (Int) -> Unit): String {
        val a = achado ?: return "nao ha versao nova para baixar"
        // O ARQUIVO VIVE NO CACHE, e num nome FIXO por versão: um download
        // interrompido não pode virar lixo permanente, e o cache é o único
        // diretório que o sistema recolhe sozinho sob pressão de disco.
        val dir = File(app.cacheDir, "apk").apply { mkdirs() }
        val alvo = File(dir, "av-${limpar(a.versao)}.apk")
        val parcial = File(dir, alvo.name + ".part")
        try {
            // Faxina: qualquer APK de outra versão que tenha sobrado. São
            // dezenas de MB, e guardá-los não serve para nada — a instalação
            // por cima já aconteceu ou já falhou.
            dir.listFiles()?.forEach { if (it.name != alvo.name) it.delete() }
            if (!alvo.exists() || alvo.length() != a.bytes) {
                baixar(a.url, parcial, a.bytes, onProgresso)
                if (!parcial.renameTo(alvo)) return "nao deu para guardar o arquivo"
            }
            onProgresso(100)
            instalar(app, alvo)
            return ""
        } catch (e: Exception) {
            Log.w(TAG, "download do APK falhou", e)
            parcial.delete()
            return (e.message ?: "falha no download").take(140)
        }
    }

    // ---------- internos ----------

    private fun instalar(app: Context, apk: File) {
        // `FileProvider` porque um `file://` num Intent lança
        // `FileUriExposedException` desde o Android 7 — e o instalador é
        // justamente um app de fora, que precisa da concessão temporária.
        val uri = FileProvider.getUriForFile(app, app.packageName + ".apk", apk)
        val i = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            // A Activity que o chama pode estar em segundo plano quando o
            // download termina; sem NEW_TASK o Intent não sobe.
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        app.startActivity(i)
    }

    /**
     * O download do APK, com a CONTA FECHADA no fim.
     *
     * O laço sai quando a leitura devolve `-1`, e até a K5 isso era tomado por
     * "acabou": um corpo TRUNCADO (a publicação cortada, um proxy que encerra o
     * corpo, a conexão que fecha limpa no meio) era aceito como completo, o
     * progresso ia a 100 e o instalador abria sobre um pacote inválido —
     * *"Não foi possível analisar o pacote"*, sem uma linha que dissesse por quê.
     * A conferência de tamanho já existia, aplicada só ao REUSO do arquivo
     * (`alvo.length() != a.bytes`); quem acabou de baixar não passava por ela.
     *
     * `total > 0` é o caso em que há o que conferir: o tamanho anunciado pelo
     * manifesto, ou o `Content-Length`. Sem nenhum dos dois, a conta fica com o
     * `TETO_BYTES`, que é o limite honesto.
     */
    private fun baixar(url: String, destino: File, esperado: Long, onProgresso: (Int) -> Unit) {
        val c = abrir(url)
        try {
            if (c.responseCode !in 200..299) throw IllegalStateException("HTTP ${c.responseCode}")
            val total = if (esperado > 0) esperado else c.contentLengthLong
            if (total > TETO_BYTES) throw IllegalStateException("arquivo grande demais")
            var lidos = 0L
            destino.outputStream().use { saida ->
                c.inputStream.use { entrada ->
                    val buf = ByteArray(64 * 1024)
                    var ultimo = -1
                    while (true) {
                        val n = entrada.read(buf)
                        if (n <= 0) break
                        saida.write(buf, 0, n)
                        lidos += n
                        if (lidos > TETO_BYTES) throw IllegalStateException("arquivo grande demais")
                        if (total > 0) {
                            val pct = (lidos * 100 / total).toInt().coerceIn(0, 99)
                            if (pct != ultimo) { ultimo = pct; onProgresso(pct) }
                        }
                    }
                }
            }
            if (total > 0 && lidos != total) {
                throw IllegalStateException("download incompleto ($lidos de $total bytes)")
            }
        } finally {
            c.disconnect()
        }
    }

    private fun abrir(url: String): HttpURLConnection {
        if (!hostOk(url)) throw IllegalStateException("endereco fora do GitHub")
        val c = URL(url).openConnection() as HttpURLConnection
        c.connectTimeout = TEMPO_MS
        c.readTimeout = TEMPO_MS
        c.instanceFollowRedirects = true
        // O asset da Release redireciona para `objects.githubusercontent.com`,
        // que está na lista — o `followRedirects` do Java não reconfere o host,
        // e por isso os dois estão lá desde o `WebUpdater`.
        c.setRequestProperty("Accept", "application/vnd.github+json")
        c.setRequestProperty("User-Agent", "AudioVisualIASD")
        return c
    }

    private fun hostOk(url: String): Boolean = try {
        val u = URL(url)
        u.protocol.equals("https", true) && u.host in HOSTS_OK
    } catch (_: Exception) { false }

    /** `v1.76` e `1.76` são a mesma coisa para a comparação. */
    private fun limpar(v: String): String = v.trim().removePrefix("v").removePrefix("V")

    /** O `versionName` do APK instalado — público porque o Registro e o
     *  [WebUpdater.estado] precisam dizê-lo ao lado do que foi publicado. */
    fun versaoInstalada(app: Context): String = try {
        val pm = app.packageManager
        val info = if (Build.VERSION.SDK_INT >= 33) {
            pm.getPackageInfo(app.packageName, android.content.pm.PackageManager.PackageInfoFlags.of(0))
        } else {
            @Suppress("DEPRECATION") pm.getPackageInfo(app.packageName, 0)
        }
        info.versionName ?: "0"
    } catch (_: Exception) { "0" }
}
