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

    /**
     * `doManifesto` diz DE ONDE o achado veio, e não é enfeite: só o que veio
     * do manifesto pode ser desmentido por um manifesto seguinte
     * ([esquecerAnuncio]). Deduzir a origem pelo campo `notas` estar vazio
     * quase funciona — e falha calada no dia em que uma Release for publicada
     * sem corpo de texto.
     */
    data class Achado(
        val versao: String,
        val url: String,
        val bytes: Long,
        val notas: String,
        val doManifesto: Boolean = false,
    )

    // ---------- o achado que vem PELO MANIFESTO (v5.234) ----------
    //
    // ## Por que não perguntar à API, já que ela existe logo abaixo
    //
    // Porque a resposta autoritária que o operador pediu exige perguntar
    // DEPRESSA, e a API do GitHub não autenticada permite **60 requisições por
    // hora por IP**. A ronda do [WebUpdater] bate a cada 15 s — 240 por hora —,
    // então acoplar o APK a ela esgotaria o limite em quinze minutos e a
    // detecção passaria a falhar com 403 pelo resto da hora. Seria uma
    // detecção MAIS lenta e mais imprevisível do que a de 30 minutos que
    // existia antes: exatamente o defeito que este lote existe para acabar.
    //
    // O manifesto do canal OTA é um asset de release. Baixá-lo **não consome
    // limite nenhum**, e desde a v5.234 ele carrega o bloco `shell` com a
    // versão, o link e o tamanho do APK — porque o workflow SEGURA a publicação
    // do bundle até a Release existir. Ou seja: a mesma requisição que já
    // acontecia responde as duas perguntas, e as responde juntas, que é o que
    // permite a tela falar de um lote em vez de dois eventos soltos.
    //
    // A API continua viva em [procurar], e continua sendo o caminho certo para
    // o que ela sabe e o manifesto não: uma Release publicada SEM base web nova
    // (correção só de Kotlin), e o toque do operador que quer conferir agora.

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
        achado = Achado(v, url, bytes, "", doManifesto = true)
        Log.i(TAG, "APK v$v anunciado pelo manifesto (instalado: ${versaoInstalada(app)})")
    }

    /**
     * O manifesto veio SEM o bloco `shell`: esta base web não acompanha APK.
     *
     * Só apaga o que veio do manifesto — um achado da [procurar] (a Release
     * publicada sem base web nova) sobrevive, porque ele não é sobre este
     * manifesto e nada nele foi desmentido.
     */
    fun esquecerAnuncio() {
        if (achado?.doManifesto == true) achado = null
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
            // A tag do GitHub vem com o `v` (`limpar` existe só por isso), e
            // TUDO que este arquivo guarda ou compara vive no domínio LIMPO.
            val v = limpar(tag)
            val minha = versaoInstalada(app)
            // A comparação é NUMÉRICA por componente, como a do [WebUpdater]:
            // "1.9" é MAIOR que "1.76" como texto, e menor como versão.
            if (WebUpdater.compareVersions(v, limpar(minha)) <= 0) return fora
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
            // GUARDAR A TAG CRUA aqui é o achado que se apaga sozinho: a
            // leitura seguinte de [novidade] compararia "v1.3.12" com
            // "1.3.11", leria o `v` como componente ZERO e concluiria que a
            // Release é mais velha que o instalado — `achado = null`, e o
            // canal do APK volta a dizer que não há nada. O `versao` do JSON
            // continua cru de propósito: ali é RÓTULO de tela, não domínio de
            // comparação.
            achado = Achado(v, url, bytes, o.optString("body").take(600))
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
