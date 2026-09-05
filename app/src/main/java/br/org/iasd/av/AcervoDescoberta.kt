package br.org.iasd.av

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.os.Build
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.ConcurrentHashMap

/**
 * OS DOIS CELULARES SE ACHAM SOZINHOS — mDNS, sem digitar endereço nenhum.
 *
 * ===== POR QUE ELE EXISTE (shell 65) =====
 *
 * Pedido do operador: *"tente fazer um sistema de comunicação entre eles, para
 * que eu não tenha de digitar um endereço, quanto mais automatizado melhor."*
 *
 * O caminho do TELÃO mostra o endereço na tela e alguém o digita no navegador —
 * ali isso é aceitável, porque quem digita está sentado na frente de um
 * computador e faz aquilo uma vez por culto. Clonar a biblioteca é outra cena:
 * dois celulares, na mão de duas pessoas, e um endereço IP lido em voz alta é
 * exatamente o tipo de passo que se erra.
 *
 * ===== A ESCOLHA: `NsdManager`, E NÃO UM CÓDIGO NEM UM QR =====
 *
 * | candidato | por que não |
 * |---|---|
 * | digitar o IP | é o que o pedido recusa |
 * | um QR na tela de A | precisa da CÂMERA — uma permissão nova, e o app hoje NEGA câmera sempre (ver o `ControleChromeClient`). Abrir a câmera do aparelho do culto para economizar um toque é caro pelo lado errado |
 * | Wi-Fi Direct (`WifiP2pManager`) | liga os dois sem roteador — mas o app JÁ alcança isso pelo ponto de acesso (`EspelhoInterfaces`), com muito menos código novo e com algo que roda em produção toda semana |
 * | Quick Share / Nearby Share | **não é aberto a um app para DIRIGIR**. O máximo é entregar um arquivo ao seletor do sistema, que é o arquivo único tudo-ou-nada que este recurso existe para abandonar |
 *
 * `NsdManager` é da PLATAFORMA (nenhuma dependência) e **não pede permissão
 * nova**: o app já declara `CHANGE_WIFI_MULTICAST_STATE`, que o serviço da
 * transmissão exige. O multicast do mDNS anda na mesma rede em que o servidor
 * já escuta — inclusive no PONTO DE ACESSO do próprio celular, onde os dois
 * aparelhos estão no mesmo segmento por construção.
 *
 * ===== O QUE VIAJA NO ANÚNCIO, E POR QUE TÃO POUCO =====
 *
 * O registro TXT do mDNS tem teto apertado (255 bytes por valor), e o que ele
 * carrega aparece numa LISTA antes de qualquer conexão: o rótulo do aparelho, a
 * contagem de itens e o peso. É o bastante para o operador reconhecer o celular
 * certo — *"Galaxy A54 · 612 itens · 14,2 GB"* — e nada além disso.
 *
 * **NENHUM CONTEÚDO DO ACERVO VAI NO ANÚNCIO.** Ele é multicast: todo aparelho
 * da rede da igreja o recebe, sem pedir nada e sem deixar rastro. Nome de hino,
 * de coleção ou de arquivo ali seria o acervo vazando para quem só está
 * conectado ao Wi-Fi. O que se vê antes do pareamento é quantidade, nunca
 * conteúdo.
 */
object AcervoDescoberta {

    private const val TAG = "AcervoDescoberta"

    /** O tipo do serviço. O ponto final é exigido pelo `NsdManager`. */
    const val TIPO = "_avclone._tcp."

    /** Quantos aparelhos a lista guarda. Teto e não paginação: numa igreja há
     *  dois ou três, e um número grande aqui só serviria a um vizinho enchendo
     *  a rede de anúncios. */
    private const val TETO_ACHADOS = 12

    /** De quanto em quanto tempo um aparelho JÁ ACHADO pode ser resolvido de
     *  novo. Ver [enfileirarResolve]: sem esta janela o TXT do [reanunciar]
     *  nunca chegava; sem o limite dela, a fila de resolve viraria rajada. */
    private const val REVER_MS = 5_000L

    /** O anúncio é um só por processo — o celular CEDE de um lugar só. */
    private var registro: NsdManager.RegistrationListener? = null

    /** E a procura também. */
    private var procura: NsdManager.DiscoveryListener? = null

    private var nsd: NsdManager? = null

    /** O nome que o sistema de fato registrou. O Android RENOMEIA sozinho
     *  quando o nome já existe na rede ("Galaxy A54 (2)"), e é este — não o que
     *  pedimos — que o outro lado enxerga. */
    @Volatile private var nomePublicado: String = ""

    /**
     * A INTENÇÃO de ceder, que é diferente de haver anúncio no ar.
     *
     * A cessão liga ANTES de existir índice, e o anúncio só sai quando há o que
     * anunciar (ver [preparar]). Entre um instante e o outro este aparelho quer
     * ceder e não está na rede — e é esta bandeira, não `registro != null`, que
     * autoriza o [reanunciar] a subir o primeiro anúncio.
     */
    @Volatile private var querAnunciar: Boolean = false

    /** O que o [reanunciar] repete. Ver o porquê do `applicationContext` lá. */
    @Volatile private var ultimoContexto: Context? = null
    @Volatile private var ultimaPorta: Int = 0
    @Volatile private var ultimoRotulo: String = ""
    @Volatile private var ultimosItens: Int = -1
    @Volatile private var ultimosBytes: Long = -1L

    /** Os achados, por nome de serviço. `ConcurrentHashMap` porque os callbacks
     *  do `NsdManager` chegam numa thread dele e o web lê da thread do WebView. */
    private val achados = ConcurrentHashMap<String, Achado>()

    /** A última coisa que aconteceu, para o Registro. Um recurso de rede que
     *  falha calado é o que este projeto não aceita. */
    @Volatile private var diario: String = "sem uso"

    data class Achado(
        val nome: String,
        val host: String,
        val porta: Int,
        val rotulo: String,
        val itens: Int,
        val bytes: Long,
        val achadoEm: Long,
    )

    private fun manager(ctx: Context): NsdManager? {
        if (nsd == null) {
            nsd = try {
                ctx.applicationContext.getSystemService(Context.NSD_SERVICE) as? NsdManager
            } catch (e: Exception) {
                Log.w(TAG, "NsdManager indisponível", e); null
            }
        }
        return nsd
    }

    // =====================================================================
    // ANUNCIAR — o celular que CEDE a biblioteca
    // =====================================================================

    /**
     * Anuncia este aparelho na rede. `porta` é a do [EspelhoServidor] já no ar
     * — o anúncio NÃO abre porta nenhuma, ele só diz onde a que existe está.
     *
     * Devolve `false` quando o `NsdManager` não existe ou já há um anúncio; o
     * chamador trata como "não deu", e o operador continua com o caminho de
     * digitar o endereço, que não sai do app.
     */
    /**
     * GUARDA O QUE O ANÚNCIO VAI PRECISAR, sem anunciar nada ainda.
     *
     * O anúncio saía aqui, com ZERO itens, porque o índice leva segundos para
     * ser montado — e o [reanunciar] o refaria com os números de verdade. Isso
     * não chegava ao outro celular: reanunciar é desanunciar e anunciar com o
     * MESMO nome de serviço, e quem procura ignora um nome que já achou. A
     * linha ficava em "medindo" para sempre.
     *
     * E havia um segundo defeito no mesmo lugar, mais caro que o rótulo: o
     * aparelho aparecia na lista do outro celular ANTES de ter índice, isto é,
     * OFERECIDO PARA TOQUE sem ter o que servir. É o mesmo argumento que já
     * obriga o servidor a subir antes do estado da cessão — *"o outro celular
     * acha o aparelho e não conecta"* —, um passo adiante.
     *
     * Hoje o primeiro anúncio é o do [reanunciar], com a contagem e o peso
     * dentro. Enquanto ele não sai, quem procura vê "Procurando na rede…", que
     * é a verdade.
     */
    fun preparar(ctx: Context, porta: Int, rotulo: String) {
        ultimoContexto = ctx.applicationContext
        ultimaPorta = porta
        ultimoRotulo = rotulo
        ultimosItens = -1
        ultimosBytes = -1L
        querAnunciar = true
        diario = "cedendo — o anúncio espera a contagem do acervo"
    }

    fun anunciar(ctx: Context, porta: Int, rotulo: String, itens: Int, bytes: Long): Boolean {
        if (registro != null) { diario = "já anunciando"; return true }
        val m = manager(ctx) ?: run { diario = "sem NsdManager"; return false }
        if (porta <= 0) { diario = "porta inválida"; return false }
        // O QUE O [reanunciar] PRECISA TER NA MÃO. `applicationContext` e não o
        // que veio: guardar uma Activity aqui a manteria viva além do ciclo
        // dela, que é o vazamento que o `companion` das filas da ponte já
        // documenta.
        ultimoContexto = ctx.applicationContext
        ultimaPorta = porta
        ultimoRotulo = rotulo
        ultimosItens = itens
        ultimosBytes = bytes
        val info = NsdServiceInfo().apply {
            // O NOME é o que aparece na lista do outro celular. Saneado porque
            // ele vira um rótulo de DNS: barra e ponto o quebrariam.
            serviceName = sanear(rotulo.ifBlank { Build.MODEL ?: "Celular" })
            serviceType = TIPO
            setPort(porta)
            try {
                setAttribute("v", "1")
                setAttribute("n", sanear(rotulo).take(60))
                setAttribute("i", itens.toString())
                setAttribute("b", bytes.toString())
            } catch (e: Exception) {
                // Um TXT recusado não derruba o anúncio: sem os atributos a
                // lista mostra só o nome, que já basta para escolher.
                Log.w(TAG, "atributo recusado", e)
            }
        }
        val ouvinte = object : NsdManager.RegistrationListener {
            override fun onServiceRegistered(s: NsdServiceInfo) {
                nomePublicado = s.serviceName ?: ""
                diario = "anunciando como \"$nomePublicado\" na porta $porta"
                Log.i(TAG, diario)
            }
            override fun onRegistrationFailed(s: NsdServiceInfo, erro: Int) {
                diario = "anúncio recusado (código $erro)"
                Log.w(TAG, diario)
                registro = null
            }
            override fun onServiceUnregistered(s: NsdServiceInfo) {
                nomePublicado = ""
                diario = "anúncio encerrado"
            }
            override fun onUnregistrationFailed(s: NsdServiceInfo, erro: Int) {
                Log.w(TAG, "não deu para encerrar o anúncio (código $erro)")
            }
        }
        return try {
            m.registerService(info, NsdManager.PROTOCOL_DNS_SD, ouvinte)
            registro = ouvinte
            true
        } catch (e: Exception) {
            diario = "anúncio falhou: " + (e.message ?: e.javaClass.simpleName)
            Log.w(TAG, diario, e)
            false
        }
    }

    /**
     * REANUNCIA COM OS NÚMEROS DE VERDADE.
     *
     * A cessão liga ANTES de o índice existir — ele varre o OPFS inteiro e leva
     * segundos —, então o primeiro anúncio sai com zero itens. Quando o
     * Controle publica o índice, este método o refaz com a contagem e o peso,
     * que é o que faz a lista do outro celular dizer *"Galaxy A54 · 612 itens ·
     * 14,2 GB"* em vez de um nome solto.
     *
     * **Anunciar de novo é desanunciar e anunciar**: o `NsdManager` só ganhou
     * `registerServiceInfoCallback`/atualização de TXT em versões recentes, e
     * um caminho que só funciona no Android novo falharia calado no aparelho
     * do culto. O buraco de alguns milissegundos entre os dois é inofensivo: a
     * procura do outro lado é contínua, e um anúncio que some e volta reaparece
     * na varredura seguinte.
     *
     * NO-OP quando não há anúncio no ar — quem não está cedendo não passa a
     * cedê-lo por publicar um índice.
     */
    fun reanunciar(itens: Int, bytes: Long): Boolean {
        val ctx = ultimoContexto ?: return false
        val porta = ultimaPorta
        val rotulo = ultimoRotulo
        // A GUARDA É A INTENÇÃO, e não "há anúncio no ar". Ela era
        // `registro == null`, e com o primeiro anúncio saindo daqui isso
        // recusaria justamente a subida que este método passou a fazer. O que
        // ela protege continua protegido: quem não está cedendo não passa a
        // ceder por publicar um índice.
        if (!querAnunciar || porta <= 0) return false
        if (itens == ultimosItens && bytes == ultimosBytes) return true
        pararAnuncio()
        querAnunciar = true      // `pararAnuncio` a baixa; a intenção não mudou
        return anunciar(ctx, porta, rotulo, itens, bytes)
    }

    /** Tira o anúncio do ar. Idempotente — chamar duas vezes é inofensivo, que
     *  é o que faz o caminho de desligar poder ser burro. */
    fun pararAnuncio() {
        // A INTENÇÃO CAI PRIMEIRO, e fora dos dois `return` abaixo: parar de
        // ceder antes de o primeiro anúncio ter subido é o caso NORMAL agora
        // (o índice falhou, o operador desistiu), e deixá-la de pé faria o
        // `acervoPublicar` seguinte pôr na rede um aparelho que ninguém está
        // cedendo.
        querAnunciar = false
        val m = nsd ?: return
        val r = registro ?: return
        registro = null
        nomePublicado = ""
        try { m.unregisterService(r) } catch (e: Exception) { Log.w(TAG, "unregister", e) }
    }

    // =====================================================================
    // PROCURAR — o celular que RECEBE
    // =====================================================================

    /**
     * Começa a procurar. Os achados vão sendo acumulados em [achados]; o
     * lado web enquete, que é o mesmo formato do `espelhoEstado`.
     *
     * O RESOLVE É SERIALIZADO. `NsdManager.resolveService` **não aceita dois
     * pedidos ao mesmo tempo** em boa parte das versões do Android: o segundo
     * volta em `FAILURE_ALREADY_ACTIVE` e o aparelho simplesmente não aparece
     * na lista — um celular invisível, sem erro em lugar nenhum. A fila abaixo
     * é o que impede isso.
     */
    fun procurar(ctx: Context): Boolean {
        if (procura != null) { diario = "já procurando"; return true }
        val m = manager(ctx) ?: run { diario = "sem NsdManager"; return false }
        achados.clear()
        val ouvinte = object : NsdManager.DiscoveryListener {
            override fun onDiscoveryStarted(tipo: String) {
                diario = "procurando aparelhos"
                Log.i(TAG, diario)
            }
            override fun onServiceFound(s: NsdServiceInfo) {
                // O PRÓPRIO ANÚNCIO VOLTA. Um celular que cede e procura ao
                // mesmo tempo se acharia na lista, e "clonar de si mesmo" é uma
                // linha que só pode confundir.
                if (s.serviceName != null && s.serviceName == nomePublicado) return
                if (s.serviceType?.contains("avclone") != true) return
                enfileirarResolve(m, s)
            }
            override fun onServiceLost(s: NsdServiceInfo) {
                achados.remove(s.serviceName ?: return)
            }
            override fun onDiscoveryStopped(tipo: String) { diario = "procura encerrada" }
            override fun onStartDiscoveryFailed(tipo: String, erro: Int) {
                diario = "procura recusada (código $erro)"
                Log.w(TAG, diario)
                procura = null
            }
            override fun onStopDiscoveryFailed(tipo: String, erro: Int) {
                Log.w(TAG, "não deu para encerrar a procura (código $erro)")
            }
        }
        return try {
            m.discoverServices(TIPO, NsdManager.PROTOCOL_DNS_SD, ouvinte)
            procura = ouvinte
            true
        } catch (e: Exception) {
            diario = "procura falhou: " + (e.message ?: e.javaClass.simpleName)
            Log.w(TAG, diario, e)
            false
        }
    }

    /** Para a procura. Os achados FICAM: o operador pode ter acabado de tocar
     *  num deles, e limpar a lista aqui tiraria da tela o que ele escolheu. */
    fun pararProcura() {
        val m = nsd ?: return
        val p = procura ?: return
        procura = null
        try { m.stopServiceDiscovery(p) } catch (e: Exception) { Log.w(TAG, "stopDiscovery", e) }
    }

    // ---- a fila de resolve, e por que ela existe (ver `procurar`) ----
    private val paraResolver = ArrayDeque<NsdServiceInfo>()
    private var resolvendo = false

    /**
     * UM NOME JÁ ACHADO PODE SER RESOLVIDO DE NOVO — passada a janela.
     *
     * A guarda era `containsKey`, e ela travava o recurso: o [reanunciar] põe
     * na rede o MESMO nome de serviço com o TXT novo, e um nome bloqueado para
     * sempre nunca relia a contagem. Do outro lado isso saía como uma linha
     * eternamente em "medindo".
     *
     * A janela é o que a substitui, e não a remoção da guarda: `onServiceFound`
     * chega em rajada a cada passada da descoberta, e resolver a cada uma delas
     * enche a fila SERIALIZADA (ver [procurar]) de trabalho que devolve sempre
     * a mesma resposta.
     */
    @Synchronized
    private fun enfileirarResolve(m: NsdManager, s: NsdServiceInfo) {
        val nome = s.serviceName ?: ""
        val ja = achados[nome]
        if (ja != null && System.currentTimeMillis() - ja.achadoEm < REVER_MS) return
        if (paraResolver.any { it.serviceName == nome }) return
        paraResolver.addLast(s)
        proximoResolve(m)
    }

    @Synchronized
    private fun proximoResolve(m: NsdManager) {
        if (resolvendo) return
        val s = paraResolver.removeFirstOrNull() ?: return
        resolvendo = true
        val ouvinte = object : NsdManager.ResolveListener {
            override fun onResolveFailed(info: NsdServiceInfo, erro: Int) {
                Log.w(TAG, "resolve falhou (${info.serviceName}, código $erro)")
                terminou(m)
            }
            override fun onServiceResolved(info: NsdServiceInfo) {
                guardar(info)
                terminou(m)
            }
        }
        try { m.resolveService(s, ouvinte) } catch (e: Exception) {
            Log.w(TAG, "resolve lançou", e); terminou(m)
        }
    }

    @Synchronized
    private fun terminou(m: NsdManager) {
        resolvendo = false
        proximoResolve(m)
    }

    private fun guardar(info: NsdServiceInfo) {
        val nome = info.serviceName ?: return
        @Suppress("DEPRECATION")
        val host = info.host?.hostAddress ?: return
        val porta = info.port
        if (porta <= 0) return
        // SÓ IPv4 PRIVADO, e é a mesma régua do `EspelhoInterfaces`: o servidor
        // do outro lado só abre em RFC1918, então um endereço fora disso é um
        // anúncio que não leva a lugar nenhum — ou não é nosso.
        if (!ehPrivadoV4(host)) return
        if (achados.size >= TETO_ACHADOS && !achados.containsKey(nome)) return
        achados[nome] = Achado(
            nome = nome,
            host = host,
            porta = porta,
            rotulo = txt(info, "n").ifBlank { nome },
            itens = txt(info, "i").toIntOrNull() ?: 0,
            bytes = txt(info, "b").toLongOrNull() ?: 0L,
            achadoEm = System.currentTimeMillis(),
        )
        diario = "achou \"$nome\" em $host:$porta"
    }

    private fun txt(info: NsdServiceInfo, chave: String): String = try {
        info.attributes?.get(chave)?.let { String(it, Charsets.UTF_8) } ?: ""
    } catch (_: Exception) { "" }

    /** RFC1918 — a mesma família que o [EspelhoInterfaces] aceita servir. */
    private fun ehPrivadoV4(ip: String): Boolean {
        val p = ip.split('.')
        if (p.size != 4) return false
        val n = p.map { it.toIntOrNull() ?: return false }
        if (n.any { it !in 0..255 }) return false
        return when {
            n[0] == 10 -> true
            n[0] == 172 && n[1] in 16..31 -> true
            n[0] == 192 && n[1] == 168 -> true
            else -> false
        }
    }

    /** Um nome de serviço mDNS não é texto livre: ponto e barra o quebram, e o
     *  teto de 63 bytes é do próprio DNS. */
    private fun sanear(s: String): String =
        s.map { if (it.isLetterOrDigit() || it == ' ' || it == '-' || it == '_') it else '-' }
            .joinToString("").trim().take(48).ifBlank { "Celular" }

    // =====================================================================
    // O QUE O WEB LÊ
    // =====================================================================

    /** DEVOLVE O OBJETO, e não a string dele: quem o compõe é a
     *  [MainActivity], num JSON maior. Serializar aqui obrigaria a reparsear
     *  lá — e um `put` de string num objeto entrega ao web uma string com cara
     *  de JSON, que é a forma de falhar mais silenciosa que existe deste lado
     *  (o `JSON.parse` do outro devolve texto e nada reclama). */
    fun achados(): JSONArray {
        val arr = JSONArray()
        achados.values.sortedBy { it.rotulo.lowercase() }.forEach { a ->
            arr.put(
                JSONObject()
                    .put("nome", a.nome)
                    .put("host", a.host)
                    .put("porta", a.porta)
                    .put("rotulo", a.rotulo)
                    .put("itens", a.itens)
                    .put("bytes", a.bytes),
            )
        }
        return arr
    }

    fun estadoJson(): JSONObject = JSONObject()
        .put("anunciando", registro != null)
        .put("nome", nomePublicado)
        .put("procurando", procura != null)
        .put("achados", achados.size)
        .put("diag", diario)

    /** Tudo abaixo do ar. Chamado quando a Activity morre — um anúncio que
     *  sobrevive ao app aponta para uma porta que já fechou. */
    fun tudoAbaixo() {
        pararProcura()
        pararAnuncio()
        achados.clear()
    }
}
