package br.org.iasd.av

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * O APK SE ATUALIZA SOZINHO — procurar, baixar e entregar ao instalador.
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

    /** O mesmo repositório do [WebUpdater] — e a mesma armadilha: renomeá-lo
     *  exige mexer nas DUAS constantes **e** publicar um APK. */
    private const val REPO = "jonathasptbr-gh/Audio-Visual-IASD"

    private const val API = "https://api.github.com/repos/$REPO/releases/latest"

    /** Hosts permitidos, pelo mesmo motivo do [WebUpdater.HOSTS_OK]. */
    private val HOSTS_OK = setOf("api.github.com", "github.com", "objects.githubusercontent.com")

    /** Teto do APK. Generoso, mas não infinito: ele protege contra ABSURDO
     *  (um asset trocado por um arquivo de 4 GB), não contra número grande. */
    private const val TETO_BYTES = 300L * 1024 * 1024

    private const val TEMPO_MS = 20000

    @Volatile private var baixando = false

    /** O que a última procura achou. `null` = nunca procuramos, ou não há nada. */
    @Volatile private var achado: Achado? = null

    data class Achado(val versao: String, val url: String, val bytes: Long, val notas: String)

    /**
     * PROCURA — devolve o JSON que o `controle.js` desenha, e nunca lança.
     *
     * `{}` vazio quer dizer "nada novo", que é o caso normal e não é erro. O
     * campo `erro` só aparece quando a procura de fato falhou, porque "não
     * apareceu nada" e "não deu para perguntar" são leituras diferentes — é a
     * mesma lição da linha "Procura:" do Registro.
     */
    fun procurar(app: Context): JSONObject {
        val fora = JSONObject()
        try {
            val txt = pegarTexto(API) ?: return fora.put("erro", "sem resposta do GitHub")
            val o = JSONObject(txt)
            val tag = o.optString("tag_name").trim()
            if (tag.isEmpty()) return fora.put("erro", "release sem tag")
            val minha = versaoInstalada(app)
            // A comparação é NUMÉRICA por componente, como a do [WebUpdater]:
            // "1.9" é MAIOR que "1.76" como texto, e menor como versão.
            if (WebUpdater.compareVersions(limpar(tag), limpar(minha)) <= 0) return fora
            val assets = o.optJSONArray("assets") ?: return fora.put("erro", "release sem arquivo")
            var url = ""
            var bytes = 0L
            for (i in 0 until assets.length()) {
                val a = assets.optJSONObject(i) ?: continue
                if (!a.optString("name").endsWith(".apk", true)) continue
                url = a.optString("browser_download_url")
                bytes = a.optLong("size", 0L)
                break
            }
            if (url.isEmpty()) return fora.put("erro", "release sem .apk")
            if (!hostOk(url)) return fora.put("erro", "endereco do arquivo fora do GitHub")
            achado = Achado(tag, url, bytes, o.optString("body").take(600))
            return fora
                .put("versao", tag)
                .put("bytes", bytes)
                .put("notas", achado?.notas ?: "")
        } catch (e: Exception) {
            Log.i(TAG, "procura do APK falhou", e)
            return fora.put("erro", (e.message ?: "falha").take(120))
        }
    }

    /**
     * BAIXA e entrega ao instalador do sistema. Devolve `""` no sucesso, ou a
     * FRASE do erro — o mesmo contrato do `espelhoCertImportar`.
     *
     * O progresso vai por [onProgresso] (0..100), que o lado web empurra na
     * faixa de aviso: o download é de dezenas de MB numa rede de igreja, e uma
     * tela parada por dois minutos sem número é indistinguível de travamento.
     */
    fun baixarEInstalar(app: Context, onProgresso: (Int) -> Unit): String {
        val a = achado ?: return "nao ha versao nova para baixar"
        if (baixando) return "ja ha um download em curso"
        baixando = true
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
        } finally {
            baixando = false
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

    private fun baixar(url: String, destino: File, esperado: Long, onProgresso: (Int) -> Unit) {
        val c = abrir(url)
        try {
            if (c.responseCode !in 200..299) throw IllegalStateException("HTTP ${c.responseCode}")
            val total = if (esperado > 0) esperado else c.contentLengthLong
            if (total > TETO_BYTES) throw IllegalStateException("arquivo grande demais")
            destino.outputStream().use { saida ->
                c.inputStream.use { entrada ->
                    val buf = ByteArray(64 * 1024)
                    var lidos = 0L
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
        } finally {
            c.disconnect()
        }
    }

    private fun pegarTexto(url: String): String? {
        val c = abrir(url)
        return try {
            if (c.responseCode !in 200..299) null
            else c.inputStream.bufferedReader().use { it.readText() }
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

    private fun versaoInstalada(app: Context): String = try {
        val pm = app.packageManager
        val info = if (Build.VERSION.SDK_INT >= 33) {
            pm.getPackageInfo(app.packageName, android.content.pm.PackageManager.PackageInfoFlags.of(0))
        } else {
            @Suppress("DEPRECATION") pm.getPackageInfo(app.packageName, 0)
        }
        info.versionName ?: "0"
    } catch (_: Exception) { "0" }
}
