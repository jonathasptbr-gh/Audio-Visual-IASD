package br.org.iasd.av

import android.content.Context
import android.net.Uri
import android.util.Log
import java.io.File
import java.security.KeyStore
import java.security.SecureRandom
import java.security.cert.X509Certificate
import java.util.Base64

/**
 * O CERTIFICADO DO ESPELHO — o degrau opcional que fecha a parede de vidro.
 *
 * ## Por que TLS aqui é diferente de TLS em qualquer outro lugar
 *
 * `docs/ESPELHO-DE-PIXELS.md` §2.4 fecha a questão e vale reler antes de mexer:
 * **certificado público para IP privado não existe e nunca vai existir** (a
 * CA/Browser Forum proibiu *Reserved IP Addresses* em 2015 e mandou revogar os
 * remanescentes em 2016), e **autoassinado está descartado** — desde o Android
 * 7 apps com `targetSdk ≥ 24` não confiam em CA de usuário, o Chrome exige
 * Certificate Transparency, e o navegador de uma smart TV não tem UI para
 * instalar CA. Trocaria uma limitação silenciosa e previsível por uma tela
 * vermelha em cada culto, em cada aparelho.
 *
 * O que funciona é o modelo do Plex e do Tailscale: **um NOME que o operador
 * controla**, com registro `A` apontando para o IP privado e certificado
 * emitido por **DNS-01**. Daí este arquivo não emite nada, não fala com CA
 * nenhuma e não sabe o que é ACME: ele **guarda** um `.p12` que o operador
 * trouxe pronto, e entrega um `KeyStore` ao [EspelhoServidor].
 *
 * As três condições que fazem isso funcionar são **do operador, não do código**
 * (um wildcard por DNS-01, uma entrada estática de DNS no roteador da igreja, e
 * renovação automática) — e é por isso que o app não tenta adivinhar nenhuma
 * delas: ele diz o que tem, diz até quando vale, e recusa o que não serve.
 *
 * ## A senha do operador NÃO fica guardada
 *
 * O `.p12` chega por importação manual e a senha é digitada à mão — nunca no
 * mesmo canal do arquivo, pelo mesmo raciocínio que o `WebUpdater` já escreve
 * sobre o `sha256`: segredo que viaja junto com o que ele protege não protege
 * nada.
 *
 * E ela não sobrevive à importação. Guardar a senha do operador seria guardar,
 * em texto, uma senha que muito provavelmente é reusada noutro lugar — e o
 * ganho seria zero, porque quem lê os arquivos privados do app lê os dois. Em
 * vez disso o `.p12` é **reescrito com uma senha aleatória de 128 bits** gerada
 * aqui, que é a que fica. O material sensível na prateleira passa a ser só
 * nosso, e a senha do operador morre no fim do método.
 *
 * ## E ele NUNCA vai no backup
 *
 * `files/espelho-tls/` está excluído em `res/xml/backup_rules.xml` e em
 * `data_extraction_rules.xml`, pela MESMA razão do bundle OTA: uma chave
 * privada restaurada de um backup adulterado é um servidor da igreja falando
 * com a identidade da igreja. E, ao contrário do bundle, ela não tem como ser
 * reconstruída — perdê-la custa reemitir, o que é o custo certo.
 */
object EspelhoCert {

    private const val TAG = "AvIasd"
    private const val DIR = "espelho-tls"
    private const val ARQUIVO = "cert.p12"
    private const val PREFS = "espelho-tls"
    private const val KEY_SENHA = "senha"
    private const val KEY_HOST = "host"
    private const val KEY_ATE = "ate"
    private const val KEY_NOME = "nome"

    /** O que o operador vê, e o que o servidor precisa saber. */
    data class Estado(
        /** Há um `.p12` guardado e legível? */
        val temCert: Boolean,
        /** O nome para o qual ele vale — é o que vai na URL e na allowlist. */
        val host: String,
        /** `notAfter`, em ms de época. 0 quando não há certificado. */
        val ate: Long,
        /** O nome do arquivo que o operador importou, para ele se reconhecer. */
        val nome: String,
    )

    private fun dir(ctx: Context) = File(ctx.filesDir, DIR)
    private fun arquivo(ctx: Context) = File(dir(ctx), ARQUIVO)
    private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /**
     * Importa um `.p12` vindo do seletor de arquivos do sistema.
     *
     * [origem] é a URL `/saf/<token>` que o `pickDoc` devolveu — a MESMA forma
     * que o `SlideDeck` consome, e pela mesma razão: a ponte entrega URLs
     * servíveis, nunca bytes. A pergunta é pelo **host** (`ORIGIN_HOST`) e
     * nunca por `startsWith("https")`, que é o erro que já deixou o PDF sem
     * funcionar por três versões.
     *
     * Devolve `""` quando deu certo, ou a FRASE do erro — nunca um booleano: as
     * causas aqui são todas acionáveis e diferentes ("a senha não abriu o
     * arquivo" manda tentar de novo, "não há chave privada dentro" manda
     * exportar de novo, "já venceu" manda renovar), e um `false` as igualaria.
     */
    fun importar(ctx: Context, origem: String, senha: String): String {
        val u = try { Uri.parse(origem) } catch (e: Exception) { return "endereço inválido" }
        if (u.host != WebViewFactory.ORIGIN_HOST) return "escolha o arquivo pelo seletor do aparelho"
        val token = u.lastPathSegment ?: return "arquivo sem token"
        val uri = SafRegistry.get(token) ?: return "o arquivo escolhido não está mais disponível"

        val bytes = try {
            ctx.contentResolver.openInputStream(uri)?.use { it.readBytes() }
        } catch (e: Exception) {
            Log.w(TAG, "certificado não pôde ser lido", e)
            null
        } ?: return "não foi possível ler o arquivo"
        // Teto de sanidade: um `.p12` de servidor tem alguns kB. Um arquivo de
        // megabytes aqui é outra coisa, e carregá-lo no `KeyStore` seria dar a
        // um parser de ASN.1 o que ele não deveria receber.
        if (bytes.size > 256 * 1024) return "arquivo grande demais para um certificado"

        val ks = try {
            KeyStore.getInstance("PKCS12").apply {
                load(bytes.inputStream(), senha.toCharArray())
            }
        } catch (e: Exception) {
            // A causa quase sempre é a senha, e dizer isso poupa o operador de
            // procurar defeito no arquivo. O `message` do JCE não serve para ser
            // mostrado (vem em inglês e cita classes), então ele fica no log.
            Log.w(TAG, "PKCS12 não abriu", e)
            return "a senha não abriu o arquivo (ou ele não é um .p12)"
        }

        val alias = ks.aliases().toList().firstOrNull { ks.isKeyEntry(it) }
            ?: return "o arquivo não tem chave privada dentro"
        val cert = ks.getCertificate(alias) as? X509Certificate
            ?: return "o arquivo não tem um certificado X.509"
        val host = hostDe(cert) ?: return "o certificado não diz para qual nome ele vale"
        val ate = cert.notAfter?.time ?: 0L
        if (ate > 0 && ate < System.currentTimeMillis()) return "este certificado já venceu"

        // A REESCRITA com senha nossa (ver o KDoc): a do operador morre aqui.
        val nossa = novaSenha()
        val d = dir(ctx)
        if (!d.exists() && !d.mkdirs()) return "não foi possível guardar o certificado"
        val destino = arquivo(ctx)
        try {
            destino.outputStream().use { ks.store(it, nossa.toCharArray()) }
        } catch (e: Exception) {
            Log.w(TAG, "certificado não pôde ser guardado", e)
            destino.delete()
            return "não foi possível guardar o certificado"
        }
        prefs(ctx).edit()
            .putString(KEY_SENHA, nossa)
            .putString(KEY_HOST, host)
            .putLong(KEY_ATE, ate)
            .putString(KEY_NOME, nomeDe(ctx, uri))
            .apply()
        Log.i(TAG, "certificado do espelho importado para $host")
        return ""
    }

    /** Apaga o certificado — o espelho volta a HTTP claro no próximo ligar. */
    fun apagar(ctx: Context) {
        arquivo(ctx).delete()
        prefs(ctx).edit().clear().apply()
        Log.i(TAG, "certificado do espelho removido")
    }

    fun estado(ctx: Context): Estado {
        val p = prefs(ctx)
        val tem = arquivo(ctx).isFile && !p.getString(KEY_SENHA, null).isNullOrEmpty()
        return Estado(
            temCert = tem,
            host = if (tem) p.getString(KEY_HOST, "") ?: "" else "",
            ate = if (tem) p.getLong(KEY_ATE, 0L) else 0L,
            nome = if (tem) p.getString(KEY_NOME, "") ?: "" else "",
        )
    }

    /**
     * O `KeyStore` para o [EspelhoServidor], ou `null` quando não há (ou quando
     * o que há não serve mais).
     *
     * **Um certificado VENCIDO não é servido**, e essa recusa é deliberada: com
     * ele o navegador da TV mostraria a tela vermelha que a §2.4 diz que este
     * recurso existe para evitar, e o operador leria "o espelho parou de
     * funcionar". Sem ele, o espelho sobe em HTTP claro — funcionando, com o
     * aviso na folha. Degradar é melhor que quebrar.
     */
    fun material(ctx: Context): Pair<KeyStore, CharArray>? {
        val p = prefs(ctx)
        val senha = p.getString(KEY_SENHA, null) ?: return null
        val f = arquivo(ctx)
        if (!f.isFile) return null
        val ate = p.getLong(KEY_ATE, 0L)
        if (ate > 0 && ate < System.currentTimeMillis()) {
            Log.w(TAG, "certificado do espelho vencido — subindo em HTTP claro")
            return null
        }
        return try {
            val ks = KeyStore.getInstance("PKCS12").apply {
                load(f.inputStream(), senha.toCharArray())
            }
            ks to senha.toCharArray()
        } catch (e: Exception) {
            Log.w(TAG, "certificado guardado não abriu", e)
            null
        }
    }

    /**
     * O nome para o qual o certificado vale: o primeiro `dNSName` do SAN, e o
     * `CN` só como último recurso.
     *
     * **SAN primeiro porque o CN não vale mais nada**: navegadores ignoram o
     * Common Name para verificação de nome desde 2017 (Chrome 58). Ler o CN
     * aqui serviria só para o app CONCORDAR com um certificado que a TV vai
     * recusar — e a allowlist de `Host` montada a partir dele deixaria o
     * servidor esperando uma conexão que nunca chega.
     *
     * Um wildcard (`*.lan.igreja.org.br`) é recusado de propósito: ele não é um
     * nome, e a allowlist de `Host` é EXATA por invariante. O operador informa
     * o nome concreto ao exportar o `.p12`.
     */
    fun hostDe(cert: X509Certificate): String? {
        try {
            val sans = cert.subjectAlternativeNames ?: emptyList()
            for (san in sans) {
                // Tipo 2 = dNSName, na numeração da RFC 5280.
                if ((san.getOrNull(0) as? Int) != 2) continue
                val nome = (san.getOrNull(1) as? String)?.trim().orEmpty()
                if (nomeUtil(nome)) return nome.lowercase()
            }
        } catch (e: Exception) {
            Log.w(TAG, "SAN ilegível", e)
        }
        val cn = cnDe(cert.subjectX500Principal?.name.orEmpty())
        return if (nomeUtil(cn)) cn.lowercase() else null
    }

    /**
     * O `CN=` de um DN, PURO e testável.
     *
     * Escrito à mão em vez de `LdapName` porque o que se quer é um pedaço de
     * texto, e porque um DN malformado vindo de um arquivo do operador não pode
     * lançar uma exceção com nome de classe na cara dele.
     */
    fun cnDe(dn: String): String {
        // Vírgula é o separador do RFC 2253; uma vírgula escapada (`\,`) faz
        // parte do valor. Dividir sem olhar o escape cortaria um CN legítimo ao
        // meio — raro, e silencioso quando acontece.
        val partes = ArrayList<String>()
        val atual = StringBuilder()
        var i = 0
        while (i < dn.length) {
            val c = dn[i]
            when {
                c == '\\' && i + 1 < dn.length -> { atual.append(dn[i + 1]); i += 2 }
                c == ',' -> { partes.add(atual.toString()); atual.setLength(0); i++ }
                else -> { atual.append(c); i++ }
            }
        }
        partes.add(atual.toString())
        for (p in partes) {
            val t = p.trim()
            if (t.length > 3 && t.substring(0, 3).equals("CN=", ignoreCase = true)) {
                return t.substring(3).trim()
            }
        }
        return ""
    }

    /**
     * Um nome que este servidor pode de fato servir.
     *
     * Recusa vazio, wildcard (a allowlist é EXATA), qualquer coisa com `/`, `:`
     * ou espaço — e um nome sem ponto, que seria um rótulo de rede local e não
     * um nome resolvível pela entrada estática do roteador.
     */
    fun nomeUtil(nome: String): Boolean {
        if (nome.isEmpty() || nome.length > 253) return false
        if (nome.startsWith("*")) return false
        if (!nome.contains('.')) return false
        return nome.all { it.isLetterOrDigit() || it == '.' || it == '-' }
    }

    private fun novaSenha(): String {
        val b = ByteArray(16)
        SecureRandom().nextBytes(b)
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b)
    }

    private fun nomeDe(ctx: Context, uri: Uri): String = try {
        ctx.contentResolver.query(uri, null, null, null, null)?.use { c ->
            val i = c.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
            if (i >= 0 && c.moveToFirst()) c.getString(i) ?: "" else ""
        }.orEmpty()
    } catch (e: Exception) {
        ""
    }
}
