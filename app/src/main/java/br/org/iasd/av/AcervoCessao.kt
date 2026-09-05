package br.org.iasd.av

import android.os.SystemClock
import org.json.JSONObject
import java.security.SecureRandom
import java.util.ArrayDeque

/**
 * QUEM CEDE A BIBLIOTECA — o lado de origem do clone celular a celular.
 *
 * ===== POR QUE ELE NÃO É MAIS UMA ROTA DO TELÃO =====
 *
 * O servidor das telas da rede nasce com a porta ABERTA de propósito, e a
 * decisão continua certa: o que vaza por ele são os comandos e as mídias
 * **carregadas durante a transmissão**, isto é, o que a congregação já está
 * vendo. O acervo é outra coisa — é o aparelho inteiro: todo arquivo
 * importado, o Cronograma, o histórico do culto, as preferências. Pendurá-lo
 * na mesma porta alargaria em silêncio uma escolha que está escrita.
 *
 * Daí a **confirmação do operador**: quem chega faz `POST /acervo/par` e fica
 * AGUARDANDO; quem cede vê na tela quem pediu e decide. Não há código a
 * digitar — o pedido do operador é *"quanto mais automatizado melhor"* —, e
 * também não há porta aberta: o que autoriza é uma pessoa tocando em Permitir.
 *
 * ===== O SHELL NÃO LÊ O ACERVO, E É ISSO QUE DESENHA O RESTO =====
 *
 * A biblioteca mora em IndexedDB e OPFS, dentro do WebView — o Kotlin não tem
 * como abri-la, e reaching into `app_webview/` seria mexer no armazenamento
 * privado do Chromium. Logo o servidor **não serve o acervo**: ele serve o que
 * o Controle empurrou.
 *
 *   · o ÍNDICE vem inteiro pela ponte ([publicar]) — é JSON pequeno (MEDIDO na
 *     ordem de centenas de kB para um acervo de milhares de entradas), e ele
 *     precisa estar de pé ANTES do primeiro item;
 *   · cada ITEM chega pelo canal `__avTelaMidia`, o MESMO que a rota `/m/` já
 *     usa em produção toda semana. A rota que não acha o item no cache
 *     **injeta um pedido no barramento** e serve o item EM CRESCIMENTO
 *     enquanto o empurrão anda — o caminho do `/m/` para um item que ainda
 *     está chegando, sem uma linha nova de transporte.
 *
 * ===== A SESSÃO DO ÍNDICE É O QUE IMPEDE A CORRUPÇÃO SILENCIOSA =====
 *
 * O item é pedido por POSIÇÃO na lista do índice, e não por nome: caminhos de
 * OPFS e chaves de `state` têm barras e dois-pontos, e um id cru numa rota é a
 * armadilha que o [SafPathHandler] já documenta. Mas posição só vale enquanto
 * a lista for a MESMA — e a página do Controle pode recarregar no meio (OTA,
 * morte do renderer), montando outra.
 *
 * Por isso todo pedido carrega a `sessao` do índice que o originou. Sessão
 * diferente ⇒ **409**, e o destino busca o índice de novo. Sem isso, uma
 * recarga no meio de uma transferência de gigabytes escreveria o arquivo de
 * uma coleção sob o caminho de outra — sem erro em lugar nenhum, e aparecendo
 * só no sábado seguinte.
 */
object AcervoCessao {

    /** Um clone por vez. Não é limitação de recurso: é o pareamento tendo um
     *  dono, e o operador sabendo quem está copiando. */
    private const val PRAZO_PEDIDO_MS = 90_000L

    /** Quanto a rota espera o empurrão do Controle antes de desistir. Generoso
     *  porque do outro lado há uma leitura de OPFS e uma travessia de canal
     *  com ack por bloco; curto o bastante para não segurar a conexão de quem
     *  perdeu a página do Controle. */
    const val PRAZO_ITEM_MS = 45_000L

    private val random = SecureRandom()

    @Volatile var cedendo: Boolean = false
        private set

    /** O rótulo deste aparelho, o que aparece na lista do outro celular. */
    @Volatile var rotulo: String = ""
        private set

    /** Quem está esperando resposta do operador. */
    @Volatile private var pedinteRotulo: String = ""
    @Volatile private var pedinteOrigem: String = ""
    @Volatile private var pedinteEm: Long = 0L

    /** O par aprovado. `token` vazio = ninguém aprovado. */
    @Volatile private var token: String = ""
    @Volatile private var parRotulo: String = ""
    @Volatile private var parOrigem: String = ""

    /** A origem que o operador RECUSOU. Uma só: recusar é sobre quem acabou de
     *  pedir, e um mapa aqui só serviria a quem insiste. */
    @Volatile private var recusada: String = ""

    /** O índice publicado pelo Controle, e a sessão dele. */
    @Volatile private var indice: ByteArray? = null
    @Volatile var sessao: String = ""
        private set
    @Volatile private var itens: Int = 0
    @Volatile private var bytes: Long = 0L

    /** Quantos itens o destino já buscou — só para o Registro e para a folha. */
    @Volatile private var entregues: Int = 0

    private val diario = ArrayDeque<String>()

    private fun anotar(linha: String) = synchronized(diario) {
        diario.addLast(linha)
        while (diario.size > 24) diario.removeFirst()
    }

    // ---------------------------------------------------------------- ciclo

    /**
     * LIGA a cessão. Não sobe servidor nenhum — quem o faz é a
     * [MainActivity], que já é dona da transmissão e agora a mantém de pé por
     * DUAS razões (o telão e a cessão), como o [SessionService] faz com cena e
     * transmissão.
     */
    fun ligar(rotuloDoAparelho: String) {
        cedendo = true
        rotulo = rotuloDoAparelho
        pedinteRotulo = ""; pedinteOrigem = ""; pedinteEm = 0L
        token = ""; parRotulo = ""; parOrigem = ""; recusada = ""
        indice = null; sessao = ""; itens = 0; bytes = 0L; entregues = 0
        anotar("cessão ligada")
    }

    /** DESLIGA, e o token morre com ela: nenhum pareamento sobrevive ao toque
     *  de desligar, nem a um culto anterior. */
    fun desligar() {
        cedendo = false
        token = ""; parRotulo = ""; parOrigem = ""
        pedinteRotulo = ""; pedinteOrigem = ""; pedinteEm = 0L
        recusada = ""
        indice = null; sessao = ""; itens = 0; bytes = 0L
        anotar("cessão desligada")
    }

    /**
     * O ÍNDICE, publicado pelo Controle. Chega ANTES de o destino poder pedir
     * qualquer item: é ele que define as posições, e a `sessao` que as valida.
     */
    fun publicar(sessaoNova: String, json: String): Boolean {
        if (!cedendo) return false
        if (!FORMA_SESSAO.matches(sessaoNova)) return false
        val corpo = json.toByteArray(Charsets.UTF_8)
        if (corpo.size > TETO_INDICE) { anotar("índice recusado: ${corpo.size} bytes"); return false }
        val o = try { JSONObject(json) } catch (e: Exception) { null }
            ?: run { anotar("índice recusado: não é JSON"); return false }
        indice = corpo
        sessao = sessaoNova
        itens = o.optJSONArray("itens")?.length() ?: 0
        bytes = o.optLong("bytes", 0L)
        entregues = 0
        anotar("índice publicado: $itens item(ns), ${corpo.size} bytes de lista")
        return true
    }

    // ------------------------------------------------------------ pareamento

    /**
     * `POST /acervo/par`. Devolve `(status, corpo)`, e os quatro desfechos são
     * distintos de propósito: o destino desenha frases diferentes para
     * *"esperando o outro celular"*, *"recusado"* e *"há outro clone em
     * curso"*, e as três pedem ações opostas de quem está com o aparelho na
     * mão.
     *
     * **Não há 404 uniforme aqui**, e a diferença com o resto do servidor é
     * deliberada: no telão o 404 esconde quais rotas existem de quem varre a
     * rede; esta rota só responde qualquer coisa que não seja 404 depois de
     * uma pessoa ter tocado em Permitir.
     */
    fun parear(origem: String, rotuloPedinte: String): Pair<Int, JSONObject> {
        if (!cedendo) return 404 to JSONObject()
        val nome = EspelhoPares.sanear(rotuloPedinte, 48).ifEmpty { "um aparelho" }

        // JÁ APROVADO — e para ESTA origem. O destino repete o pedido enquanto
        // espera, e é essa repetição que colhe o token.
        if (token.isNotEmpty() && parOrigem == origem) {
            return 200 to JSONObject().put("estado", "pareado").put("token", token)
        }
        if (token.isNotEmpty()) {
            return 409 to JSONObject().put("estado", "ocupado").put("com", parRotulo)
        }
        if (recusada == origem) {
            return 403 to JSONObject().put("estado", "recusado")
        }
        val agora = SystemClock.elapsedRealtime()
        // O PEDIDO VENCE, e vencer não é recusar: o operador pode não ter visto
        // a tela. Vencido, o pedido seguinte reabre a pergunta.
        if (pedinteOrigem.isNotEmpty() && agora - pedinteEm > PRAZO_PEDIDO_MS) {
            pedinteOrigem = ""; pedinteRotulo = ""
        }
        if (pedinteOrigem.isNotEmpty() && pedinteOrigem != origem) {
            return 409 to JSONObject().put("estado", "ocupado").put("com", pedinteRotulo)
        }
        if (pedinteOrigem.isEmpty()) {
            pedinteOrigem = origem
            pedinteRotulo = nome
            pedinteEm = agora
            anotar("pedido de clone: $nome ($origem)")
        }
        return 202 to JSONObject().put("estado", "aguardando")
    }

    /** O operador respondeu. `sim` cunha o token; `não` guarda a origem para a
     *  insistência não virar uma segunda pergunta. */
    fun responder(sim: Boolean) {
        val origem = pedinteOrigem
        val nome = pedinteRotulo
        pedinteOrigem = ""; pedinteRotulo = ""; pedinteEm = 0L
        if (origem.isEmpty()) return
        if (!sim) {
            recusada = origem
            anotar("clone RECUSADO: $nome ($origem)")
            return
        }
        token = novoToken()
        parOrigem = origem
        parRotulo = nome
        recusada = ""
        anotar("clone PERMITIDO: $nome ($origem)")
    }

    /** Tira o par do ar sem desligar a cessão — o "Desconectar" da folha. */
    fun soltarPar() {
        if (token.isEmpty()) return
        anotar("clone encerrado: $parRotulo")
        token = ""; parRotulo = ""; parOrigem = ""
    }

    /**
     * A credencial. Comparação de tamanho constante não vale a pena aqui (o
     * token é aleatório de 128 bits e o canal é uma LAN), mas o token VAZIO
     * jamais autoriza — sem a primeira guarda, um `Authorization:` ausente
     * viraria acesso total antes do primeiro pareamento.
     */
    fun autorizado(bearer: String?): Boolean {
        val t = token
        if (t.isEmpty() || bearer.isNullOrEmpty()) return false
        return bearer == t
    }

    fun indiceBytes(): ByteArray? = indice

    /** O que o anúncio mDNS carrega — a contagem e o peso do que este aparelho
     *  oferece. É por eles que o operador reconhece o celular certo na lista. */
    val itensPublicados: Int get() = itens
    val bytesPublicados: Long get() = bytes

    /**
     * O token de cache de um item. `null` quando a sessão pedida não é a que
     * está publicada, ou a posição está fora da lista — os dois casos em que
     * responder alguma coisa seria responder o item errado.
     */
    fun tokenDoItem(sessaoPedida: String, n: Int): String? {
        val s = sessao
        if (s.isEmpty() || s != sessaoPedida) return null
        if (n < 0 || n >= itens) return null
        return s + "n" + n
    }

    fun contarEntrega() { entregues++ }

    // ------------------------------------------------------------- diagnóstico

    fun estadoJson(): JSONObject = JSONObject()
        .put("cedendo", cedendo)
        .put("rotulo", rotulo)
        .put("sessao", sessao)
        .put("itens", itens)
        .put("bytes", bytes)
        .put("entregues", entregues)
        .put("pedinte", pedinteRotulo)
        .put("pareado", token.isNotEmpty())
        .put("com", parRotulo)
        .put("diario", synchronized(diario) { diario.joinToString("\n") })

    private fun novoToken(): String {
        val b = ByteArray(16)
        random.nextBytes(b)
        return android.util.Base64.encodeToString(
            b,
            android.util.Base64.URL_SAFE or android.util.Base64.NO_PADDING or android.util.Base64.NO_WRAP,
        )
    }

    /** A sessão é cunhada pelo WEB (é ele que monta a lista), e o shell só
     *  valida a FORMA — ela entra numa rota. */
    private val FORMA_SESSAO = Regex("^[A-Za-z0-9_-]{8,32}$")

    /** O índice inteiro atravessa a ponte como string. MEDIDO num acervo de
     *  ~6.000 entradas: ~500 kB. O teto existe para o dia em que alguém tentar
     *  pôr conteúdo nele — ele é uma LISTA DE DECISÃO, nunca os dados. */
    private const val TETO_INDICE = 8 * 1024 * 1024
}
