package br.org.iasd.av

import java.io.File
import java.io.IOException
import java.io.RandomAccessFile
import java.security.SecureRandom
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong

/**
 * O CACHE DE MÍDIA do telão por comandos — o que a rota `/m/<token>` serve.
 * (`docs/TELAO-POR-COMANDOS.md` §5.3/E4.)
 *
 * **ZERO import de Android, de propósito** — a mesma regra do [EspelhoHttp] e
 * pela mesma razão: este arquivo decide O QUE a rede alcança (um token é uma
 * capacidade), e decisão de acesso sem oráculo é como o projeto define dívida.
 * Tudo aqui é `java.io` + `java.security`, e o JUnit o cobre inteiro.
 *
 * ## O desenho
 *
 * O acervo vive no OPFS, que o Kotlin não lê. Quem tem os bytes é o lado web:
 * o Controle os EMPURRA por um canal de `ArrayBuffer` (`__avTelaMidia`, molde
 * do `EspelhoAudio`) para um arquivo neste cache, e a rota os serve — completo
 * com Range de verdade, ou EM CRESCIMENTO por chunked enquanto o empurrão
 * ainda anda (um vídeo começa a tocar progressivamente sem esperar o fim).
 * Quando o armazenamento do acervo migrar para um lugar Kotlin-legível, só o
 * abastecedor muda — o token, a rota e este arquivo ficam.
 *
 * ## O token é cunhado PELO CONTROLE, e isso não é preguiça
 *
 * O `load` enriquecido (`__rec.url = '/m/<token>'`) é montado de forma
 * SÍNCRONA na emissão do comando, e uma ida-e-volta ao Kotlin ali atrasaria
 * todo load do culto. O Controle cunha (crypto.randomUUID — ele roda em
 * contexto seguro) e REGISTRA o token no `abrir`; este arquivo só o valida:
 * 16+ caracteres de base64url/uuid, nada mais — a entropia é do lado que
 * cunha, e um token fraco só enfraquece o próprio recurso que ele nomeia.
 * As propriedades do SafRegistry ficam: opaco, por sessão de transmissão,
 * nunca derivado do id do acervo (ids de acervo não se enumeram pela rede).
 *
 * ## LRU por BYTES, e só do que está completo
 *
 * O teto é de bytes, não de itens (um culto tem meia dúzia de vídeos grandes,
 * não mil pequenos). Despeja-se o menos-usado COMPLETO — um item em
 * crescimento tem um empurrão em curso do outro lado, e despejá-lo faria o
 * canal escrever num arquivo órfão.
 */
class EspelhoMidiaCache(
    private val dir: File,
    private val tetoBytes: Long = TETO_PADRAO,
) {

    class Item internal constructor(
        val token: String,
        val id: String,
        val nome: String,
        val tipo: String,
        val arquivo: File,
        /** O tamanho anunciado no `abrir` — o alvo. `<= 0` = desconhecido. */
        val esperado: Long,
    ) {
        @Volatile var recebido = 0L
            internal set

        @Volatile var completo = false
            internal set

        @Volatile var cancelado = false
            internal set

        internal val usadoEm = AtomicLong(0)
    }

    private val porToken = ConcurrentHashMap<String, Item>()
    private val porId = ConcurrentHashMap<String, Item>()
    private val relogio = AtomicLong(0)

    init {
        // O cache é DA SESSÃO de transmissão: sobras de um processo anterior
        // são lixo sem registro (os tokens morreram com ele) e sairiam no
        // primeiro despejo de qualquer jeito — limpar na abertura é mais
        // barato que carregar um índice que não existe.
        dir.mkdirs()
        dir.listFiles()?.forEach { it.delete() }
    }

    /**
     * Registra um item e abre o arquivo dele para o empurrão.
     *
     * O MESMO id com o MESMO token devolve o MESMO item (a regra do
     * SafRegistry): dois loads da mesma mídia não viram dois arquivos, e o
     * segundo `abrir` de um item completo é a resposta "já tenho" que poupa o
     * re-empurrão inteiro. O mesmo id com token NOVO **substitui**: é o
     * caminho dos ids mutáveis (o wallpaper — o operador trocou a imagem), e
     * o token velho passa a responder o 404 idêntico — quem já buscou a URL
     * antiga já tem os bytes dela, e quem ainda não buscou não deve receber a
     * imagem que saiu de cena.
     */
    @Synchronized
    fun abrir(token: String, id: String, nome: String, tipo: String, esperado: Long): Item? {
        if (!tokenValido(token) || id.isEmpty()) return null
        porId[id]?.let { existente ->
            if (existente.token == token) return existente.tocar()
            porToken.remove(existente.token)
            porId.remove(id, existente)
            existente.cancelado = true
            existente.arquivo.delete()
        }
        if (porToken.containsKey(token)) return null
        val item = Item(token, id, saneadoParaNome(nome), tipoValido(tipo), File(dir, token), esperado)
        item.arquivo.delete()
        try {
            if (!item.arquivo.createNewFile()) return null
        } catch (e: IOException) {
            return null
        }
        porToken[token] = item
        porId[id] = item
        item.tocar()
        despejarSePreciso()
        return item
    }

    /** Acrescenta bytes ao item EM CRESCIMENTO. @return o total recebido, ou
     *  -1 quando o item não aceita mais (completo, cancelado, sumiu). */
    fun escrever(token: String, bytes: ByteArray): Long {
        val item = porToken[token] ?: return -1
        if (item.completo || item.cancelado) return -1
        return try {
            RandomAccessFile(item.arquivo, "rw").use { raf ->
                raf.seek(item.recebido)
                raf.write(bytes)
            }
            item.recebido += bytes.size
            item.recebido
        } catch (e: IOException) {
            -1
        }
    }

    /** O empurrão terminou: o item vira servível por Range. */
    fun completar(token: String) {
        val item = porToken[token] ?: return
        item.completo = true
        despejarSePreciso()
    }

    /** O empurrão desistiu: o arquivo parcial sai na hora — servi-lo seria
     *  entregar meia mídia como se fosse inteira. */
    @Synchronized
    fun cancelar(token: String) {
        val item = porToken.remove(token) ?: return
        item.cancelado = true
        porId.remove(item.id, item)
        item.arquivo.delete()
    }

    /** O item de um token, com o toque de LRU — ou `null`, que a rota devolve
     *  como o 404 idêntico de sempre. */
    fun servir(token: String): Item? = porToken[token]?.tocar()

    fun bytesNoCache(): Long = porToken.values.sumOf { it.recebido }

    fun itens(): Int = porToken.size

    /** O teto desta instância — o Registro o publica ao lado do uso, senão
     *  "1,2 GB no cache" não diz se falta pouco ou muito para o despejo. */
    fun teto(): Long = tetoBytes

    /** Zera tudo — o desligar da transmissão. Tokens morrem com a sessão. */
    @Synchronized
    fun zerar() {
        porToken.clear()
        porId.clear()
        dir.listFiles()?.forEach { it.delete() }
    }

    private fun Item.tocar(): Item {
        usadoEm.set(relogio.incrementAndGet())
        return this
    }

    @Synchronized
    private fun despejarSePreciso() {
        var total = bytesNoCache()
        if (total <= tetoBytes) return
        // Menos-usado primeiro, e SÓ completos: um item em crescimento tem um
        // empurrão vivo do outro lado do canal.
        val candidatos = porToken.values.filter { it.completo }.sortedBy { it.usadoEm.get() }
        for (c in candidatos) {
            if (total <= tetoBytes) break
            porToken.remove(c.token)
            porId.remove(c.id, c)
            total -= c.recebido
            c.arquivo.delete()
        }
    }

    companion object {
        /** 1,5 GiB: dois vídeos grandes de culto + folga, num cacheDir que o
         *  Android já considera descartável. */
        const val TETO_PADRAO = 1_500L * 1024 * 1024

        /** O maior bloco que o canal aceita por mensagem — sanidade, como o
         *  TETO_BLOCO do EspelhoAudio, dimensionado para mídia. */
        const val TETO_BLOCO = 1024 * 1024

        private val FORMA_TOKEN = Regex("^[A-Za-z0-9_-]{16,64}$")

        fun tokenValido(t: String): Boolean = FORMA_TOKEN.matches(t)

        /** A forma de um token deste cache, escrita como código: 128 bits de
         *  SecureRandom em base64url, o SafRegistry.
         *
         *  **NÃO HÁ CAMINHO DE RESERVA, e não pode haver**: quem cunha é o
         *  Controle, de forma síncrona na emissão do `load` (ver o KDoc do
         *  topo), e um token cunhado AQUI não teria como chegar ao `__rec` que
         *  já viajou. Sem chamador em produção de propósito — quem a exercita é
         *  o `EspelhoMidiaCacheTest`, que prende a forma que o [tokenValido]
         *  aceita. */
        fun novoToken(): String {
            val b = ByteArray(16)
            SecureRandom().nextBytes(b)
            val alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
            val sb = StringBuilder(22)
            var acc = 0L
            var bits = 0
            for (x in b) {
                acc = (acc shl 8) or (x.toLong() and 0xFF)
                bits += 8
                while (bits >= 6) {
                    bits -= 6
                    sb.append(alfabeto[((acc shr bits) and 0x3F).toInt()])
                }
            }
            return sb.toString()
        }

        private fun saneadoParaNome(s: String): String =
            s.filter { it.code in 0x20..0x7E }.take(120)

        /** O Content-Type que a rota anuncia. Só formas simples de mídia — um
         *  tipo estranho vira o genérico, nunca um erro: quem erra o tipo é
         *  código nosso, e a mídia ainda toca com o sniffing desligado do
         *  lado do <video> (que decide pelo conteúdo). */
        private val TIPO = Regex("^(video|audio|image)/[a-z0-9.+-]{1,32}$")
        fun tipoValido(t: String): String = if (TIPO.matches(t)) t else "application/octet-stream"
    }
}
