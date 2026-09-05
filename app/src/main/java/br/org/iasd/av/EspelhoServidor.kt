package br.org.iasd.av

import android.content.Context
import android.net.ConnectivityManager
import android.net.LinkProperties
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.SystemClock
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.net.Inet4Address
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.NetworkInterface
import java.net.ServerSocket
import java.net.Socket
import java.security.KeyStore
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong
import javax.net.ssl.KeyManagerFactory
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLSocket
import kotlin.concurrent.thread

/**
 * O SERVIDOR DO TELÃO POR COMANDOS — sockets, threads, roteamento e fan-out.
 *
 * Ele é o cano por onde o bundle, os COMANDOS e a MÍDIA saem para os navegadores
 * da rede local. **Não decide nada** que os arquivos puros já decidam: quem lê a
 * requisição é o [EspelhoHttp] e quem diz se a tela pode entrar é o
 * [EspelhoPares]. Aqui moram só as três coisas que exigem o Android e um
 * `ServerSocket`: onde o socket liga, quantas threads existem e o que cada
 * cliente recebe.
 *
 * ## Onde o socket liga — a linha mais importante deste arquivo
 *
 * `ServerSocket(porta)` liga em **0.0.0.0**: toda interface, inclusive a
 * `rmnet` da operadora. Sem internet na igreja o desfecho normal é o celular em
 * dados móveis, onde as operadoras brasileiras entregam **IPv6 globalmente
 * roteável**, sem NAT — o culto numa porta alcançável do mundo, sem ninguém no
 * prédio perceber. Por isso, e não é negociável:
 *
 * 1. bind **explícito a um IPv4 SERVÍVEL** (`ServerSocket().bind(...)`), nunca
 *    pelo construtor de porta e nunca em `::` (os IPv6 temporários do Android
 *    rotacionam);
 * 2. **recusa ligar** em qualquer endereço que a regra não aprove — com frase
 *    no Registro (ver [redeParaServir] e [Recusa]). Servível é: a Wi-Fi de que
 *    este aparelho é CLIENTE ([redeDaWifi]), ou o PONTO DE ACESSO que ele SERVE
 *    — uma interface no ar, com IPv4 RFC1918, que nenhum `Network` reivindica e
 *    que não é de nenhuma família recusada ([EspelhoInterfaces]). A `rmnet` da
 *    operadora, a VPN e o `p2p` do Wi-Fi Direct continuam fora, cada uma por
 *    uma regra própria;
 * 3. a rede que some **desliga o servidor** — por `registerNetworkCallback` de
 *    `TRANSPORT_WIFI` na Wi-Fi (v5.183, [observarRede]) e pela ENQUETE do
 *    [vigiarPontoDeAcesso] no ponto de acesso, que aquele callback não cobre.
 *
 * ## O transporte é `Transfer-Encoding: chunked`, não WebSocket
 *
 * O servidor HTTP existe de qualquer jeito (a página, o CSS, o JS — e o próprio
 * handshake do WebSocket É uma requisição HTTP). A comparação honesta é "HTTP"
 * contra "HTTP mais o RFC 6455": ~150 linhas de framing, unmasking obrigatório,
 * frames de controle e três casos de comprimento, sem oráculo. `chunked` é
 * `tamanho-em-hex CRLF bytes CRLF`, para sempre.
 *
 * ## O que ele NÃO serve — a diferença entre um espelho e um vazamento
 *
 * Nenhum arquivo do acervo, nenhum id, nenhuma listagem; **nunca `/saf/`** (os
 * tokens do SAF não expiram e indexam arquivos pessoais).
 *
 * E o que VEM da rede para o barramento é uma lista de PERMISSÃO de dois tipos
 * ([TIPOS_QUE_SOBEM], em [retorno]) — nunca "qualquer comando com `type`". O
 * upstream é `alive` e `st`, e o `st` é filtrado. (A lista existe também no
 * `espelho/tela.js`; validação que mora só no cliente não é validação.)
 *
 * Os estáticos saem do [WebPathHandler] (mesma resolução OTA→APK e mesma tabela
 * MIME dos WebViews) por uma **allowlist de PREFIXO** ([PREFIXOS_BUNDLE]) com
 * concatenação — a tela roda o próprio `/display/`, que carrega `/shared/`, e
 * um mapa fixo rota→caminho não daria conta. É por isso que ela depende de DUAS
 * guardas, e as duas são load-bearing: o parser recusa `..` no caminho, e o
 * `canonicalPath` do [WebPathHandler] contém o que sobrar. `/controle/` NUNCA
 * está entre os prefixos.
 *
 * ## A invariante 8 do `CLAUDE.md` se INVERTE aqui
 *
 * Num `shouldInterceptRequest` quem aplica o `Range` é o WebView, sobre o que o
 * app devolveu. **Num `ServerSocket` quem aplica é o servidor**, e é o que a
 * rota `/m/` faz: RFC 7233 de verdade, por [EspelhoHttp.alcanceDe] (com JUnit).
 * Copiar o [StreamProxy] para cá é o erro exato — aquele devolve a fatia como
 * se fosse o todo, porque do outro lado há um WebView que refatia.
 *
 * @param registrar linha crua para o diário (`EspelhoDiag`). O Kotlin devolve
 *   DADO; quem monta a frase é o `controle.js`.
 * @param aoPerderRede a Wi-Fi sumiu com a transmissão no ar. Este arquivo
 *   desliga o servidor; o dono solta o resto.
 * @param aoTrocarEndereco o endereço mudou e o socket foi RELIGADO nele (DHCP
 *   trocou, roteador reiniciou). Quem precisa saber é a notificação do serviço.
 *   Ver [religarNoIp].
 */
class EspelhoServidor(
    private val ctx: Context,
    private val bundle: WebPathHandler,
    private val registrar: (String) -> Unit = {},
    private val aoPerderRede: () -> Unit = {},
    private val aoTrocarEndereco: (String, Inet4Address) -> Unit = { _, _ -> },
) {

    private val app: Context = ctx.applicationContext

    // ---------- estado da sessão de servidor ----------

    @Volatile private var servidor: ServerSocket? = null
    @Volatile private var ligadoEm = 0L
    @Volatile private var endereco = ""
    @Volatile private var ipServido = ""
    @Volatile private var portaServida = 0
    @Volatile private var comTls = false
    @Volatile private var ssl: SSLContext? = null
    @Volatile private var hostsAceitos: Set<String> = emptySet()

    /**
     * O nome do certificado desta sessão. Guardado porque a allowlist de `Host`
     * é REFEITA quando o endereço muda ([religarNoIp]), e sem ele o nome do TLS
     * cairia da lista — isto é, o navegador que conecta pelo nome (o único para
     * quem o certificado vale) passaria a receber o 404 idêntico.
     */
    @Volatile private var hostTlsServido = ""

    /** Rebinds por troca de endereço, com janela — ver [religarNoIp]. */
    @Volatile private var rebindsNaJanela = 0
    @Volatile private var marcoRebind = 0L

    /** As telas do telão por comandos (`GET /e`), chaveadas por token de
     *  sessão. (O KDoc órfão do `csd` que morava aqui saiu na v5.212 com o
     *  resto do vocabulário do encoder.) */
    private val telasSse = ConcurrentHashMap<String, TelaSse>()

    /** O cache que a rota `/m/` serve (E4) — ligado pela MainActivity junto
     *  com o canal `__avTelaMidia`; nulo = rota responde o 404 idêntico. */
    @Volatile var midia: EspelhoMidiaCache? = null

    /** Fluxos de `/m/` em curso — descontados do [TETO_EM_VOO] como os de
     *  tela: um vídeo grande é minutos de conexão que não volta. */
    private val midiaEmVoo = AtomicInteger(0)

    private val emVoo = AtomicInteger(0)
    private val conexoesTotais = AtomicInteger(0)
    private val proximoRotulo = AtomicInteger(0)
    private val desligando = AtomicBoolean(false)

    @Volatile private var ultimaSaida: JSONObject? = null

    /**
     * POR ONDE este socket está servindo, fixado no [ligar].
     *
     * Ele existe para o [confirmarRede] não migrar de via sozinho e para a
     * enquete do [vigiar] saber se precisa vigiar o ponto de acesso — o
     * callback de rede não o cobre, e nada mais o vigiaria.
     */
    @Volatile private var viaServida = Via.WIFI

    /** A interface em que o socket ligou (`ap0`, `wlan0`) — leitura de Registro. */
    @Volatile private var ifaceServida = ""

    /** Ver [vigiar]: quando a enquete do ponto de acesso conferiu pela última vez. */
    private var apConferidoEm = 0L

    /** Ver [suspeitarDaRede]: a rede parece ter caído desde quando, e por quê. */
    @Volatile private var redeSuspeitaDesde = 0L
    @Volatile private var redeSuspeitaMotivo = ""

    private val recusadas = ConcurrentHashMap<String, AtomicInteger>()

    private var cm: ConnectivityManager? = null
    private var callbackRede: ConnectivityManager.NetworkCallback? = null

    // ---------- ligar / desligar ----------

    /**
     * Sobe o servidor e devolve o endereço servido (`http://192.168.0.42:8787`).
     *
     * @param ipv4 um IPv4 servível, obtido em [redeParaServir]. Ele é
     *   **reconferido** aqui contra a lista de agora: é barato, e a alternativa
     *   é um bind num endereço que já não é deste aparelho.
     * @param tls o `PKCS12` do operador, quando existir (P8). Nulo = HTTP em
     *   claro, que é o transporte de produção — ver a §2.4 da especificação.
     * @throws Recusa quando não há endereço servível (nem Wi-Fi, nem ponto de
     *   acesso), quando o endereço pedido saiu da lista, ou quando o socket não
     *   sobe. **Nunca falha em silêncio**: a mensagem é a frase que o operador
     *   lê.
     */
    fun ligar(
        porta: Int,
        ipv4: InetAddress,
        tls: KeyStore?,
        senha: CharArray?,
        /**
         * O nome do certificado, quando há TLS. Ele entra na allowlist de
         * `Host` e vira o endereço que o operador divulga — **sem ele o TLS
         * seria inútil**: o navegador conecta pelo NOME (é para ele que o
         * certificado vale), o `Host` chega como o nome, e uma allowlist que só
         * conhece o IP devolveria o 404 idêntico a toda requisição. O sintoma
         * seria "com certificado o espelho para de funcionar", sem nada no
         * Registro que o explicasse.
         */
        hostTls: String = "",
    ): String {
        // SÓ desliga se havia um servidor de pé (religar sem desligar duplicaria
        // as threads). A guarda não é economia: [desligar] ZERA O PAREAMENTO, e
        // quem liga o espelho acabou de sortear o PIN — chamá-lo aqui sempre
        // apagaria o PIN que já está desenhado na tela do operador.
        if (servidor != null) desligar()
        // A RECONFERÊNCIA É CONTRA A LISTA INTEIRA, não contra a Wi-Fi.
        // Enquanto ela chamava `redeDaWifi`, um endereço de ponto de acesso
        // achado corretamente morria AQUI — o mesmo `Recusa`, três linhas
        // depois de a regra tê-lo aprovado.
        if (ipv4 !is Inet4Address) throw Recusa("o endereco pedido nao e IPv4")
        val rede = redeParaServir(app).firstOrNull { it.ip.hostAddress == ipv4.hostAddress }
            ?: throw Recusa("a rede desse endereco saiu do ar")
        ssl = tls?.let { montarTls(it, senha) }
        comTls = ssl != null

        val ss = ServerSocket()
        try {
            // Sem isto, religar o espelho logo depois de desligá-lo esbarra no
            // TIME_WAIT do socket anterior e o operador vê "endereço em uso"
            // por um motivo que não é dele.
            ss.reuseAddress = true
            ss.bind(InetSocketAddress(ipv4, porta), 8)
        } catch (e: IOException) {
            fecharQuieto(ss)
            throw Recusa("nao foi possivel abrir a porta $porta: ${e.message}")
        }
        servidor = ss
        desligando.set(false)
        ipServido = ipv4.hostAddress ?: ""
        portaServida = ss.localPort
        // COM TLS O ENDEREÇO É O NOME, não o IP: o certificado vale para o nome,
        // e um `https://192.168.x.y` daria a tela vermelha que a §2.4 diz que
        // este recurso existe para evitar.
        val comNome = comTls && hostTls.isNotEmpty()
        endereco = if (comNome) "https://$hostTls:$portaServida"
        else (if (comTls) "https://" else "http://") + ipServido + ":" + portaServida
        // ALLOWLIST EXATA DE `Host` — é a defesa contra DNS rebinding: uma
        // página qualquer da internet, aberta por um visitante na rede da
        // igreja, pode fazer `evil.com` resolver para o nosso IP e passar a ser
        // same-origin com este servidor. Quem confere é o [EspelhoHttp]; quem
        // monta a lista, em runtime, é este ponto.
        // Com nome, ele entra na lista — e o IP FICA, porque ele continua sendo
        // o que responde a quem digitar o endereço numérico. A allowlist não
        // afrouxa nada por ter duas entradas: ela segue EXATA, e o que ela
        // barra (DNS rebinding: `evil.com` resolvendo para o nosso IP) continua
        // barrado, porque `evil.com` não é nenhuma das duas.
        //
        // (O nome mDNS `av.local` entrava aqui pela mesma porta até a v5.185.
        // Ele saiu com o responder inteiro — ver [montarHosts] —, e a armadilha
        // que ele documentava continua valendo para o `hostTls`: um endereço
        // por onde o servidor atende e que NÃO esteja nesta lista recebe o 404
        // idêntico de sempre, isto é, "não funciona" sem uma linha em lugar
        // nenhum que o explique.)
        hostTlsServido = hostTls
        viaServida = rede.via
        ifaceServida = rede.iface
        hostsAceitos = montarHosts(comNome)
        ligadoEm = SystemClock.elapsedRealtime()
        conexoesTotais.set(0)
        proximoRotulo.set(0)
        redeSuspeitaDesde = 0L
        redeSuspeitaMotivo = ""

        Thread({ aceitarConexoes(ss) }, "av-espelho-accept").apply { isDaemon = true }.start()
        Thread({ vigiar() }, "av-espelho-vigia").apply { isDaemon = true }.start()
        observarRede()
        registrar("servidor ligado em $endereco" + if (comTls) " (TLS)" else " (HTTP)")
        Log.i(TAG, "espelho servindo em $endereco")
        return endereco
    }

    /**
     * A allowlist EXATA de `Host`, montada do estado atual.
     *
     * Extraída de [ligar] porque [religarNoIp] precisa REFAZÊ-LA: ela guarda
     * `ip:porta`, e um `Host` fora dela recebe o 404 idêntico de toda
     * requisição recusada (§3.4, invariante 5) — o modo de falhar mais mudo
     * deste servidor.
     *
     * Ela segue exata: `evil.com` resolvendo para o nosso IP continua barrado,
     * que é a defesa contra DNS rebinding. O que ela tem são os endereços por
     * onde ESTE servidor de fato atende — o IP e, quando há TLS, o nome do
     * certificado.
     *
     * **`av.local` saiu na v5.185, junto com o responder mDNS inteiro.** Ele
     * nunca resolveu no Chrome do Android nem na maioria das Smart TVs — que
     * são exatamente as telas deste recurso —, então o IP sempre foi o endereço
     * que de fato funcionava, e o nome ao lado dele era um segundo caminho que
     * dava errado numa fração dos casos sem dizer por quê.
     */
    private fun montarHosts(comNome: Boolean): Set<String> {
        val lista = HashSet<String>()
        lista.add("$ipServido:$portaServida")
        lista.add(ipServido)
        if (comNome) {
            lista.add("$hostTlsServido:$portaServida")
            lista.add(hostTlsServido)
        }
        return lista
    }

    /** Idempotente, e chamável de QUALQUER thread — inclusive de dentro do
     *  callback de rede que o derruba. */
    fun desligar() {
        if (servidor == null && telasSse.isEmpty()) {
            pararDeObservarRede()
            return
        }
        if (!desligando.compareAndSet(false, true)) return
        // A DESPEDIDA, e ela é a diferença entre uma página quieta e três telas
        // martelando o AP da igreja pelo resto do culto.
        //
        // O quadro `0x30 {"m":"adeus"}` estava escrito nos dois lados desde a
        // primeira versão — [avisar] aqui, `controle(j)` no `cliente.js` — e
        // **ninguém o emitia**: era código morto nas duas pontas. Sem ele o
        // operador desligar o espelho é, do lado do navegador, indistinguível
        // de uma queda de rede; o cliente entra na escada de reconexão e fica
        // batendo numa porta fechada a cada 8 s, para sempre, em até três
        // aparelhos ao mesmo tempo.
        //
        // Ele é enquadrado e ENFILEIRADO ANTES de `servidor` virar nulo, e a
        // ordem não é cosmética: o laço de [escrever] desiste quando a fila
        // esvazia **e** o servidor já saiu do ar, então uma despedida
        // enfileirada depois disso poderia chegar à escritora já encerrada.
        // Quem a entrega é [fechar], que a põe na frente do sentinela de fim.
        // A MESMA despedida para as telas de comandos — desde o primeiro
        // commit, porque a lição da v5.154 (código morto simétrico) e a da
        // v5.172 (o adeus que era sentença) já foram pagas uma vez cada.
        if (telasSse.isNotEmpty()) {
            val adeusSse = EspelhoHttp.eventoSse("""{"m":"adeus"}""")
            for (t in telasSse.values) fecharSse(t, "espelho desligado", adeusSse)
        }
        val ss = servidor
        servidor = null
        pararDeObservarRede()
        fecharQuieto(ss)
        telasSse.clear()
        endereco = ""
        ipServido = ""
        portaServida = 0
        comTls = false
        ssl = null
        hostsAceitos = emptySet()
        hostTlsServido = ""
        ligadoEm = 0
        redeSuspeitaDesde = 0L
        redeSuspeitaMotivo = ""
        rebindsNaJanela = 0
        marcoRebind = 0L
        // "O token tem prazo e MORRE COM A SESSÃO" (§3.5, invariante 3): não há
        // token que sobreviva ao culto.
        zerarPares()
    }

    val ligado: Boolean get() = servidor != null

    // ---------- o fan-out ----------

    // ---------- sockets ----------

    private fun aceitarConexoes(ss: ServerSocket) {
        while (!ss.isClosed && servidor === ss) {
            val cru = try {
                ss.accept()
            } catch (e: IOException) {
                break
            }
            // TETO DE CONEXÕES EM VOO, separado do teto de telas: três TCPs
            // mudos não podem consumir os três slots de sessão nem uma thread
            // por socket sem limite.
            //
            // **E as conexões de FLUXO não contam** — esta subtração é uma
            // correção, não um detalhe. O `servirEventos` (o SSE) não volta
            // enquanto a tela estiver conectada, então cada tela viva segurava
            // um slot pelo culto inteiro. Com três telas restavam cinco, e um navegador abre
            // até SEIS conexões paralelas por host só para carregar a página
            // (`/`, `/e.css`, `/e.js`, `/f.js`): a segunda tela a abrir
            // o endereço já esbarrava no teto e recebia conexões recusadas —
            // que na tela viram "não foi possível falar com o celular", sem
            // nada no Registro que ligasse uma coisa à outra. O teto de fluxos
            // já existe e é outro ([TETO_TELAS]).
            if (emVoo.get() - telasSse.size - midiaEmVoo.get() >= TETO_EM_VOO) {
                fecharQuieto(cru)
                continue
            }
            emVoo.incrementAndGet()
            val t = Thread({
                try {
                    aceitar(cru)
                } catch (e: Throwable) {
                    Log.w(TAG, "conexão terminou com erro", e)
                } finally {
                    emVoo.decrementAndGet()
                    fecharQuieto(cru)
                }
            }, "av-espelho-cli")
            t.isDaemon = true
            try {
                t.start()
            } catch (e: Throwable) {
                // Sem thread não há atendimento — e o contador não pode ficar
                // devendo, senão o teto se fecha sozinho para sempre.
                emVoo.decrementAndGet()
                fecharQuieto(cru)
                Log.w(TAG, "não foi possível atender a conexão", e)
            }
        }
        Log.i(TAG, "laço de aceite encerrado")
    }

    private fun aceitar(cru: Socket) {
        // 2 s para completar a linha de requisição (§3.5, invariante 8). O
        // [EspelhoHttp] tem o prazo dele para o corpo; este é o que impede um
        // socket mudo de segurar uma thread.
        cru.soTimeout = PRAZO_LINHA_MS
        // Nagle atrasaria cada quadro pequeno em dezenas de ms esperando
        // companhia — e este fluxo é feito de quadros pequenos.
        cru.tcpNoDelay = true
        // KEEPALIVE: a rede da igreja perde aparelhos sem FIN nenhum (a TV que
        // apagou, o tablet que saiu do alcance). Sem ele, um `write` num socket
        // meio-aberto só falha quando o buffer de envio enche — o que numa cena
        // parada leva minutos. Não substitui o [TETO_SEM_RELATO_MS] (o kernel
        // demora muito mais que 60 s para desistir); os dois se somam, e este é
        // grátis.
        try { cru.keepAlive = true } catch (e: Exception) {
            Log.i(TAG, "keepalive recusado: ${e.message}")
        }
        val (socket, entrada) = envelopar(cru)
        // O TETO DO CORPO É DECIDIDO AQUI, porque é aqui que se sabe o que é
        // uma rota. O `/r` é autenticado e carrega o relato da tela — a única
        // informação que este servidor não tem como obter sozinho —, e ele
        // ficou grande demais para 256 B. O `/par` é ANÔNIMO e continua onde
        // estava: apertá-lo é o que impede um desconhecido de nos fazer alocar.
        val r = EspelhoHttp.lerRequisicao(entrada, hostsAceitos) { caminho ->
            if (caminho == "/r") EspelhoHttp.TETO_CORPO_RETORNO else EspelhoHttp.TETO_CORPO
        }
        val req = r.getOrNull()
        if (req == null) {
            // A RESPOSTA é do [EspelhoHttp] (`HostRecusado` e `OrigemEstranha`
            // saem como o 404 idêntico); a LINHA do Registro, essa sim,
            // distingue — senão o operador não teria como saber que alguém
            // tentou rebinding contra o aparelho dele.
            val erro = r.exceptionOrNull()
            Log.i(TAG, "requisição recusada: ${erro?.message ?: "malformada"}")
            // O CONTADOR VEM ANTES DA RESPOSTA, e ele conta TODAS — inclusive
            // as que não viram linha no Registro. Ver [recusadas].
            recusadas
                .computeIfAbsent(rotuloDoErro(erro)) { AtomicInteger(0) }
                .incrementAndGet()
            if (erro is EspelhoHttp.Erro) {
                if (erro is EspelhoHttp.Erro.HostRecusado || erro is EspelhoHttp.Erro.OrigemEstranha) {
                    registrar("recusada: ${erro.message}")
                }
                responder(socket.getOutputStream(), EspelhoHttp.respostaDeErro(erro))
            } else {
                responder(socket.getOutputStream(), naoAchei())
            }
            return
        }
        val saida = socket.getOutputStream()
        val sessao = validarToken(req.autorizacao)
        rotear(req, saida, sessao, socket, cru)
    }

    /**
     * TLS envolve um `Socket` **CRU** — nunca um `SSLServerSocket`.
     *
     * Com um `SSLSocket` vindo de um `SSLServerSocket` não se tem o socket cru,
     * e `SSLSocket.close()` tenta emitir `close_notify` — isto é, tenta
     * ESCREVER, numa conexão que pode estar travada justamente em escrita. O
     * vigia de [TETO_ESCRITA_MS] deixaria de funcionar exatamente quando é
     * necessário, e o teto de três telas seria consumido por fantasmas. Quem
     * chama guarda o `cru`, e é ele que o vigia fecha.
     *
     * **TLS é propriedade do SERVIDOR, não da conexão**, e isso não era o
     * desenho original: a ideia era uma porta só, espiando o primeiro byte
     * (`0x16` = handshake TLS) e envolvendo ou não, devolvendo o byte pela
     * sobrecarga `createSocket(Socket, InputStream, boolean)`. **Ela não existe
     * no SDK do Android** (é do JDK). Sem como devolver um byte já lido a um
     * `SSLSocket`, a farejada sai inteira: havendo keystore o servidor sobe em
     * TLS e envolve tudo; não havendo, tudo é HTTP.
     *
     * O que se perde é a degradação por conexão — um cliente em `http://` num
     * servidor com TLS leva erro de handshake em vez de ser atendido em claro.
     * Aceitável porque o endereço com o esquema certo é o que a folha do
     * Controle e o Registro mostram, e porque o chão continua sendo o HTTP: TLS
     * só existe quando alguém instalou um certificado de propósito.
     */
    private fun envelopar(cru: Socket): Pair<Socket, InputStream> {
        val contexto = ssl ?: return cru to BufferedInputStream(cru.getInputStream())
        val s = contexto.socketFactory.createSocket(
            cru, cru.inetAddress?.hostAddress, cru.port, true,
        ) as SSLSocket
        s.useClientMode = false
        s.soTimeout = PRAZO_LINHA_MS
        return s to BufferedInputStream(s.inputStream)
    }

    private fun montarTls(ks: KeyStore, senha: CharArray?): SSLContext? = try {
        val kmf = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm())
        kmf.init(ks, senha ?: CharArray(0))
        SSLContext.getInstance("TLS").apply { init(kmf.keyManagers, null, null) }
    } catch (e: Exception) {
        // O degrau que não sobe não pode derrubar o chão: sem TLS o espelho
        // serve HTTP, que é o transporte de produção.
        registrar("TLS: RECUSADO — ${e.message}")
        Log.w(TAG, "TLS não subiu; seguindo em HTTP", e)
        null
    }

    // ---------- roteamento ----------

    /**
     * As cinco rotas da §5.1, e nada mais.
     *
     * **404 IDÊNTICO** para token inválido, rota inexistente, `Host` fora da
     * allowlist e `Origin` estranha: não vazar existência. O único desvio é o
     * `403` do pareamento (rota que existe, credencial errada) e o `503` do
     * quarto cliente, que precisa de uma FRASE em vez de silêncio.
     */
    private fun rotear(
        r: EspelhoHttp.Req,
        saida: OutputStream,
        sessao: EspelhoPares.Sessao?,
        socket: Socket,
        cru: Socket,
    ) {
        val rota = r.caminho
        when {
            // O CORTE (E6): quem abre o endereço recebe a TELA DE COMANDOS — o
            // próprio /display/ com a casca do tela.js. O cliente de pixels
            // deixa de ser alcançável por navegação (os arquivos dele saem na
            // E7); quem tiver a página antiga aberta recarrega no F5 e cai
            // aqui.
            r.metodo == "GET" && rota == "/" -> responder(
                saida,
                EspelhoHttp.resposta(
                    302,
                    "text/html; charset=utf-8",
                    "<a href=\"/display/index.html?tela=1\">Telão</a>".toByteArray(Charsets.UTF_8),
                    listOf("Location: /display/index.html?tela=1"),
                ),
            )
            r.metodo == "POST" && rota == "/par" -> parear(r, saida, cru)
            // A rota `/v` (o fluxo de PIXELS) morreu com o espelho na v5.187:
            // um GET nela cai no 404 idêntico do `else`, como toda rota que
            // não existe — nada de "gone" que confirme o que já existiu.
            r.metodo == "GET" && rota == "/e" -> {
                if (sessao == null) responder(saida, naoAchei()) else servirEventos(cru, saida, sessao)
            }
            r.metodo == "POST" && rota == "/r" -> {
                if (sessao == null) responder(saida, naoAchei()) else retorno(r, saida, sessao)
            }
            r.metodo == "GET" && caminhoDoBundle(rota) != null ->
                servirDoBundle(caminhoDoBundle(rota)!!, saida)
            // A MÍDIA é ANÔNIMA DE PROPÓSITO (spec §3.6): o token opaco na
            // rota É a capacidade — um <video src> não manda Authorization, e
            // o token de SESSÃO continua nunca viajando em URL. Quem não tem
            // o token de serviço leva o 404 idêntico de sempre.
            r.metodo == "GET" && rota.startsWith("/m/") ->
                servirMidia(rota.substring(3), r, saida)
            // A TRANSMISSÃO DIRETA (v5.189) — ANÔNIMA pelo mesmo motivo do
            // `/m/`: o token opaco na rota é a capacidade, e quem busca é o
            // `shared/mse.js`, que não sabe de sessão nenhuma.
            r.metodo == "GET" && rota.startsWith("/s/") ->
                servirTransmissao(rota.substring(3), r, saida)
            // ===== O CLONE DA BIBLIOTECA (shell 65) =====
            //
            // Três rotas com autorização PRÓPRIA — o acervo NÃO herda a porta
            // aberta do telão. Aqui o que autoriza é uma pessoa tocando em
            // Permitir no aparelho que cede; ver o KDoc do [AcervoCessao].
            r.metodo == "POST" && rota == "/acervo/par" -> parAcervo(r, saida, cru)
            r.metodo == "GET" && rota == "/acervo/indice" -> indiceAcervo(r, saida)
            r.metodo == "GET" && rota.startsWith("/acervo/item/") ->
                servirAcervo(rota.substring(13), r, saida)
            else -> responder(saida, naoAchei())
        }
    }

    /**
     * `POST /acervo/par` — o pareamento do CLONE, e o único ponto do servidor
     * em que um status que não seja 404 sai antes de haver credencial.
     *
     * Os quatro desfechos são distintos de propósito (`202` aguardando, `200`
     * com token, `403` recusado, `409` ocupado): o destino desenha uma frase
     * para cada um, e as três primeiras pedem ações opostas de quem está com o
     * aparelho na mão. Cessão desligada continua respondendo o 404 idêntico —
     * quem varre a rede não descobre que a rota existe.
     *
     * **`202` não vira linha do Registro**: o destino repete o pedido enquanto
     * espera a resposta do operador, e o anel tem 60 linhas.
     */
    private fun parAcervo(r: EspelhoHttp.Req, saida: OutputStream, cru: Socket) {
        val corpo = try {
            JSONObject(String(r.corpo, Charsets.UTF_8))
        } catch (e: Exception) {
            JSONObject()
        }
        val origem = enderecoDe(cru)
        val v = AcervoCessao.parear(origem, corpo.optString("rotulo"), SystemClock.elapsedRealtime())
        if (v.status == 404) return responder(saida, naoAchei())
        if (v.status != 202) registrar("clone: pedido de $origem respondido com ${v.status}")
        // O VEREDITO VIRA JSON AQUI, como no `respostaDoVeredito` do pareamento
        // das telas: o [AcervoCessao] devolve DADO, e é isso que o mantém
        // rodável em JUnit.
        val json = JSONObject().put("estado", v.estado)
        if (v.com.isNotEmpty()) json.put("com", v.com)
        if (v.token.isNotEmpty()) json.put("token", v.token)
        responder(
            saida,
            EspelhoHttp.resposta(v.status, "application/json", json.toString().toByteArray(Charsets.UTF_8)),
        )
    }

    /**
     * `GET /acervo/indice` — a LISTA DE DECISÃO, publicada pelo Controle.
     *
     * O `503` é o caso REAL de o operador ter acabado de ligar a cessão: o
     * anúncio na rede sobe junto com o servidor e o índice leva alguns
     * segundos para ser montado (ele varre o OPFS inteiro). Responder 404 ali
     * mandaria o destino concluir que não há nada a copiar.
     */
    private fun indiceAcervo(r: EspelhoHttp.Req, saida: OutputStream) {
        if (!AcervoCessao.autorizado(bearerDe(r.autorizacao))) return responder(saida, naoAchei())
        val bytes = AcervoCessao.indiceBytes()
            ?: return responder(saida, jsonSimples(503, "montando"))
        responder(saida, EspelhoHttp.resposta(200, "application/json", bytes))
    }

    /**
     * `GET /acervo/item/<sessao>/<n>` — um item do índice.
     *
     * **O shell não lê o acervo** (ele mora no IndexedDB/OPFS, dentro do
     * WebView), então a rota não serve nada por conta própria: o que ela faz é
     * PEDIR ao Controle e servir o que chegar pelo canal `__avTelaMidia`, que
     * é o mesmo caminho que a rota `/m/` usa toda semana — inclusive o item EM
     * CRESCIMENTO, que já sai por chunked enquanto o empurrão anda.
     *
     * O pedido entra pelo [MessageBus.post] com `from = null`, que **não**
     * passa pelo `busPost`: um pedido do clone não vai para o SSE das telas da
     * rede, e nenhum eco volta.
     *
     * Três recusas, e cada uma diz outra coisa: `409` é o índice ter sido
     * remontado (a página do Controle recarregou no meio — o destino busca o
     * índice de novo e continua de onde estava), `503` é o Controle não ter
     * respondido no prazo, e o `404` é a credencial.
     */
    private fun servirAcervo(resto: String, r: EspelhoHttp.Req, saida: OutputStream) {
        if (!AcervoCessao.autorizado(bearerDe(r.autorizacao))) return responder(saida, naoAchei())
        val corte = resto.indexOf('/')
        if (corte <= 0) return responder(saida, naoAchei())
        val n = resto.substring(corte + 1).toIntOrNull() ?: return responder(saida, naoAchei())
        val token = AcervoCessao.tokenDoItem(resto.substring(0, corte), n)
            ?: return responder(saida, jsonSimples(409, "indice-trocado"))
        val cache = midia ?: return responder(saida, naoAchei())
        // ESPERA O ITEM FICAR **COMPLETO**, e não só existir — esta é a
        // diferença que separa esta rota do `/m/`.
        //
        // Lá o item EM CRESCIMENTO sai por chunked de propósito: o `<video>` da
        // tela começa a tocar sem esperar o fim, e é isso que se quer. Aqui não
        // há nada tocando: o destino pede FAIXAS de bytes, e `servirMidia` só
        // honra `Range` num item completo — servir o crescimento ignoraria a
        // faixa e entregaria o começo do arquivo rotulado como o pedaço do
        // meio. O proxy do outro lado reprova isso (é a conferência de
        // `Content-Range` dele), mas o certo é não produzir a resposta errada.
        //
        // O PRAZO É DE PARADA, não de duração: enquanto os bytes andam, a
        // espera continua. Um item de 380 MB atravessa o canal em dezenas de
        // segundos, e um teto absoluto o mataria justamente nos arquivos que
        // mais custam a refazer.
        var item = cache.servir(token)
        if (item?.completo != true) {
            if (item == null) {
                MessageBus.post(
                    null,
                    JSONObject()
                        .put("type", "acervo-pedido")
                        .put("sessao", AcervoCessao.sessao)
                        .put("n", n)
                        .put("token", token)
                        .toString(),
                )
            }
            var recebido = item?.recebido ?: -1L
            var paradoDesde = SystemClock.elapsedRealtime()
            while (true) {
                item = cache.servir(token)
                if (item?.completo == true) break
                if (item?.cancelado == true) break
                if (desligando.get()) return
                val agora = SystemClock.elapsedRealtime()
                val atual = item?.recebido ?: -1L
                if (atual != recebido) { recebido = atual; paradoDesde = agora }
                if (agora - paradoDesde > AcervoCessao.PRAZO_ITEM_MS) break
                try {
                    Thread.sleep(120)
                } catch (e: InterruptedException) {
                    Thread.currentThread().interrupt()
                    return
                }
            }
            if (item?.completo != true) {
                registrar("clone: o item $n nao ficou pronto (parado por ${AcervoCessao.PRAZO_ITEM_MS} ms)")
                return responder(saida, jsonSimples(503, "sem-resposta"))
            }
        }
        AcervoCessao.contarEntrega()
        // DAQUI PARA A FRENTE É A ROTA `/m/` INTEIRA — Range de verdade para o
        // item completo, chunked para o que ainda está chegando. Reusá-la é o
        // ponto: um segundo servidor de bytes seria um segundo lugar para
        // errar a aritmética de faixa.
        servirMidia(token, r, saida)
    }

    private fun jsonSimples(status: Int, estado: String): ByteArray = EspelhoHttp.resposta(
        status,
        "application/json",
        JSONObject().put("estado", estado).toString().toByteArray(Charsets.UTF_8),
    )

    /** O token nu de um `Authorization: Bearer <t>`. O [EspelhoPares] tem a
     *  mesma leitura para as sessões DELE — são duas credenciais diferentes,
     *  e juntá-las faria o token de uma tela da rede valer no acervo. */
    private fun bearerDe(cru: String?): String? {
        val v = cru?.trim() ?: return null
        return if (v.regionMatches(0, "Bearer ", 0, 7, ignoreCase = true)) v.substring(7).trim() else v
    }

    /**
     * A rota de mídia — Range DE VERDADE, nosso (a inversão da invariante 8:
     * não há WebView no caminho, e o 200 seco do StreamProxy aqui seria o
     * erro exato). Streaming do arquivo em blocos, nunca o corpo inteiro em
     * memória: três telas puxando 380 MB pelo molde do StreamProxy
     * derrubariam o processo da projeção.
     *
     * Item EM CRESCIMENTO (o empurrão do Controle ainda anda) sai por chunked
     * progressivo — o <video> começa a tocar sem esperar o fim — e o Range só
     * vale para item completo, que é a regra simples declarada na spec §5.3.
     *
     * **Só a entrega que alcançou `item.esperado` escreve o terminador do
     * chunked**; as outras saídas do laço fecham a conexão sem ele, para o
     * cliente ver o erro de rede que de fato houve.
     */
    private fun servirMidia(token: String, r: EspelhoHttp.Req, saida: OutputStream) {
        val cache = midia
        val item = cache?.servir(token)
        if (item == null || item.cancelado) {
            // O ÚNICO 404 DO SERVIDOR QUE NÃO DEIXAVA RASTRO, e ele tem três
            // causas com correções OPOSTAS: transmissão sem cache, token que o
            // Controle nunca registrou (ou já substituiu — o wallpaper trocado),
            // e empurrão cancelado no meio. Sem a linha, as três chegam ao
            // operador como "a tela não toca o vídeo".
            //
            // SÓ TOKEN DE FORMA VÁLIDA VIRA LINHA: o anel tem 60 linhas e um
            // scanner na rede da igreja apagaria o diário com rotas inventadas.
            // E O TOKEN NÃO ENTRA NELA — ele é uma capacidade, e o Registro
            // existe para ser copiado e repassado.
            if (EspelhoMidiaCache.tokenValido(token)) {
                registrar(
                    "mídia não encontrada: " + when {
                        cache == null -> "não há cache nesta sessão"
                        item == null -> "token desconhecido (ou substituído)"
                        else -> "o empurrão foi cancelado"
                    },
                )
            }
            return responder(saida, naoAchei())
        }
        midiaEmVoo.incrementAndGet()
        try {
            if (item.completo) {
                val tamanho = item.recebido
                when (val alcance = EspelhoHttp.alcanceDe(r.intervalo, tamanho)) {
                    is EspelhoHttp.Alcance.Insatisfazivel ->
                        responder(saida, EspelhoHttp.resposta416(tamanho))
                    is EspelhoHttp.Alcance.Inteiro -> {
                        saida.write(EspelhoHttp.cabecalhoConteudo(item.tipo, tamanho))
                        copiarFaixa(item.arquivo, 0, tamanho - 1, saida)
                        saida.flush()
                    }
                    is EspelhoHttp.Alcance.Parcial -> {
                        val f = alcance.faixa
                        saida.write(EspelhoHttp.cabecalhoParcial(item.tipo, f, tamanho))
                        copiarFaixa(item.arquivo, f.ini, f.fim, saida)
                        saida.flush()
                    }
                }
                return
            }
            // EM CRESCIMENTO: chunked do byte 0, acompanhando o empurrão.
            saida.write(EspelhoHttp.cabecalhoChunked(200, item.tipo))
            saida.flush()
            var pos = 0L
            var paradoDesde = 0L
            val buf = ByteArray(64 * 1024)
            java.io.RandomAccessFile(item.arquivo, "r").use { raf ->
                while (true) {
                    val disponivel = item.recebido - pos
                    if (disponivel <= 0) {
                        if (item.completo || item.cancelado) break
                        val agora = SystemClock.elapsedRealtime()
                        if (paradoDesde == 0L) paradoDesde = agora
                        // O empurrão morreu (a página do Controle caiu no meio):
                        // um fluxo que não cresce não pode segurar a conexão e
                        // a vaga para sempre.
                        if (agora - paradoDesde > TETO_MIDIA_PARADA_MS) break
                        Thread.sleep(100)
                        continue
                    }
                    paradoDesde = 0
                    raf.seek(pos)
                    val n = raf.read(buf, 0, minOf(buf.size.toLong(), disponivel).toInt())
                    if (n <= 0) break
                    saida.write(EspelhoHttp.chunk(buf, 0, n))
                    saida.flush()
                    pos += n
                    EspelhoEnergia.progresso()
                }
            }
            // O TERMINADOR `0\r\n\r\n` **É** A AFIRMAÇÃO "o recurso acabou
            // aqui": num corpo chunked não há `Content-Length` que o desminta.
            // O laço tem QUATRO saídas e só uma delas é "acabou" — escrevê-lo
            // nas outras três (o empurrão morreu e o [TETO_MIDIA_PARADA_MS]
            // estourou, o item foi cancelado, o `read` não devolveu nada)
            // entrega MEIA MÍDIA como se fosse inteira: o <video> da tela, que
            // sem TV é a projeção, toca até onde chegou e dispara `ended` sem
            // erro em lugar nenhum. Fechar SEM ele faz o cliente ver um erro de
            // rede, que é a verdade; quem fecha é o `finally` do laço de aceite,
            // e ele não escreve byte nenhum.
            //
            // A CONTA É SOBRE OS BYTES, NÃO SOBRE A SAÍDA DO LAÇO: quem afirma
            // o fim é o `esperado` anunciado no `abrir` (que o Controle manda
            // como o `size` do próprio Blob). Entregues todos, o corpo está
            // inteiro mesmo que o `{"fim":true}` nunca tenha chegado — e faltando
            // um byte ele não está, nem com o item marcado completo.
            // `esperado <= 0` é tamanho desconhecido: ali o único sinal que
            // existe é o `completo` do empurrão, com o arquivo drenado.
            val inteiro = if (item.esperado > 0L) pos >= item.esperado
                else item.completo && !item.cancelado && pos >= item.recebido
            if (inteiro) {
                try {
                    saida.write(EspelhoHttp.chunkFinal())
                    saida.flush()
                } catch (e: IOException) {
                    // O cliente já foi.
                }
            } else {
                registrar(
                    "mídia ${item.nome}: entrega TRUNCADA em $pos byte(s)"
                        + (if (item.esperado > 0L) " de ${item.esperado}" else "")
                        + " — conexão fechada sem terminador",
                )
            }
        } catch (e: InterruptedException) {
            Thread.currentThread().interrupt()
        } catch (e: IOException) {
            Log.i(TAG, "mídia $token interrompida: ${e.message}")
        } finally {
            midiaEmVoo.decrementAndGet()
        }
    }

    /**
     * A TRANSMISSÃO DIRETA nas telas da rede (v5.189, a dívida §7 do contrato).
     *
     * Sem esta rota, "Tocar agora" num link do YouTube com a transmissão ligada
     * e sem TV era obrigado a BAIXAR o vídeo inteiro antes de projetar (o
     * `pularTransmissao` do `controle.js`). O motivo estava certo: o manifesto
     * aponta para `/stream/<token>` no origin do WebView, e uma tela da rede não
     * tem WebView no caminho. A saída é servir a MESMA faixa por aqui.
     *
     * ## Ela é um REPASSE, não um servidor de faixas
     *
     * O `Range` do cliente sobe CRU para o googlevideo e a resposta é espelhada
     * de volta (status, `Content-Type`, `Content-Length`, `Content-Range`). Não
     * se usa [EspelhoHttp.alcanceDe] aqui, e não é inconsistência com o `/m/`:
     * lá o recurso é um arquivo NOSSO, de tamanho conhecido; aqui o dono é o
     * CDN, e reimplementar a aritmética dele sobre um corpo que chega por
     * streaming seria inventar um segundo contrato para errar. (Nem vale o molde
     * do [StreamProxy]: aquele devolve a fatia como se fosse o todo porque o
     * WebView aplica o `Range` por cima — armadilha que num socket não existe.)
     *
     * ## O UA importa e o token é a capacidade
     *
     * Pedir uma faixa do visionOS anunciando um Chrome de Android é caminho
     * conhecido para 403, e por isso o UA sai do [StreamProxy.uaDaUrl], num
     * ponto só. O token é opaco (128 bits) e vive enquanto o processo viver; a
     * URL por trás expira sozinha em horas, e é ela que manda.
     */
    private fun servirTransmissao(token: String, r: EspelhoHttp.Req, saida: OutputStream) {
        if (!EspelhoMidiaCache.tokenValido(token)) return responder(saida, naoAchei())
        val alvo = StreamProxy.urlDoToken(token) ?: return responder(saida, naoAchei())
        midiaEmVoo.incrementAndGet()
        var conn: java.net.HttpURLConnection? = null
        try {
            conn = (java.net.URL(alvo).openConnection() as java.net.HttpURLConnection).apply {
                connectTimeout = 15_000
                readTimeout = 30_000
                instanceFollowRedirects = true
                setRequestProperty("User-Agent", StreamProxy.uaDaUrl(alvo))
                // Sem `Range` do cliente pedimos do zero: as URLs adaptativas do
                // googlevideo costumam recusar quem não pede faixa.
                setRequestProperty("Range", r.intervalo ?: "bytes=0-")
            }
            val status = conn.responseCode
            if (status !in 200..299) {
                Log.i(TAG, "transmissao $token: o CDN respondeu $status")
                return responder(saida, naoAchei())
            }
            val tipo = conn.contentType?.let { EspelhoHttp.semQuebraPublica(it) } ?: "application/octet-stream"
            val tamanho = conn.getHeaderField("Content-Length")?.toLongOrNull() ?: -1L
            val contentRange = conn.getHeaderField("Content-Range")
            val extra = if (contentRange.isNullOrEmpty()) emptyList()
                else listOf("Content-Range: " + EspelhoHttp.semQuebraPublica(contentRange))
            // Tamanho conhecido ⇒ espelha o 206/200 com `Content-Length`; sem
            // ele (o CDN não disse), sai por chunked, que é o único framing
            // honesto para um corpo de tamanho desconhecido.
            if (tamanho >= 0) {
                saida.write(
                    EspelhoHttp.cabecalhoComTamanhoPublico(
                        if (status == 206) 206 else 200, tipo, tamanho,
                        listOf("Accept-Ranges: bytes") + extra,
                    ),
                )
                conn.inputStream.use { ent -> copiarPara(ent, saida) }
            } else {
                saida.write(EspelhoHttp.cabecalhoChunked(200, tipo))
                saida.flush()
                val buf = ByteArray(64 * 1024)
                conn.inputStream.use { ent ->
                    while (true) {
                        val n = ent.read(buf)
                        if (n <= 0) break
                        saida.write(EspelhoHttp.chunk(buf, 0, n))
                        saida.flush()
                        EspelhoEnergia.progresso()
                    }
                }
                saida.write(EspelhoHttp.chunkFinal())
            }
            saida.flush()
        } catch (e: IOException) {
            Log.i(TAG, "transmissao $token interrompida: ${e.message}")
        } catch (e: Exception) {
            Log.w(TAG, "transmissao $token falhou", e)
        } finally {
            try { conn?.disconnect() } catch (e: Exception) { /* já foi */ }
            midiaEmVoo.decrementAndGet()
        }
    }

    /** Bombeia um fluxo de entrada para a saída, em blocos de 64 kB. */
    private fun copiarPara(entrada: java.io.InputStream, saida: OutputStream) {
        val buf = ByteArray(64 * 1024)
        while (true) {
            val n = entrada.read(buf)
            if (n <= 0) break
            saida.write(buf, 0, n)
            EspelhoEnergia.progresso()
        }
    }

    /** Copia `[ini..fim]` do arquivo para a saída, em blocos de 64 kB. */
    private fun copiarFaixa(arquivo: java.io.File, ini: Long, fim: Long, saida: OutputStream) {
        val buf = ByteArray(64 * 1024)
        java.io.RandomAccessFile(arquivo, "r").use { raf ->
            raf.seek(ini)
            var falta = fim - ini + 1
            while (falta > 0) {
                val n = raf.read(buf, 0, minOf(buf.size.toLong(), falta).toInt())
                if (n <= 0) break
                saida.write(buf, 0, n)
                falta -= n
                EspelhoEnergia.progresso()
            }
        }
    }

    /**
     * O caminho no bundle para uma rota de prefixo — ou `null` quando a rota
     * não é de bundle (e o 404 idêntico de sempre responde).
     *
     * O nome não pode ser vazio (`GET /display/` não é um arquivo) e o parser
     * já garantiu ASCII imprimível sem `..`; o resto da contenção é do
     * [WebPathHandler] (canonicalPath no bundle OTA, assets no APK).
     */
    private fun caminhoDoBundle(rota: String): String? {
        for ((prefixo, base) in PREFIXOS_BUNDLE) {
            if (rota.startsWith(prefixo) && rota.length > prefixo.length) {
                return base + rota.substring(prefixo.length)
            }
        }
        return null
    }

    private fun servirDoBundle(caminho: String, saida: OutputStream) {
        val bruto = lerDoBundle(caminho)
        if (bruto == null) {
            registrar("faltou no bundle: $caminho")
            return responder(saida, naoAchei())
        }
        val nome = caminho.substringAfterLast('/')
        val tipo = bundle.mimeOf(nome) + (bundle.encodingOf(nome)?.let { "; charset=$it" } ?: "")
        val pagina = nome.endsWith(".html")
        val corpo = if (pagina) comMarcaDeTela(bruto) else bruto
        if (pagina) registrar("página entregue: $caminho")
        // Toda PÁGINA leva a CSP — e é a CSP que FORÇA a exclusão do embed do
        // YouTube nas telas da rede (`default-src 'self'` barra a IFrame API;
        // spec §1). Os demais arquivos levam só os cabeçalhos de sempre.
        val extra = if (pagina) EspelhoHttp.CABECALHOS_PAGINA else emptyList()
        responder(saida, EspelhoHttp.resposta(200, tipo, corpo, extra))
    }

    /**
     * O PAPEL `tela` DEIXA DE DEPENDER DA QUERY (v1.92).
     *
     * O `espelho/tela.js` decidia pelo `?tela=1` de `location.search`, e esse
     * marcador chega por um 302 da rota `/` — uma corrente de elos frágeis em
     * que basta UM ceder para a tela abrir como `/display/` comum: mostra o
     * wallpaper, nunca desenha a entrada, nunca pede token e nunca conecta (o
     * par de sintomas relatado). Elos possíveis: navegador de TV que não
     * preserva a query no redirecionamento, endereço nos favoritos sem ela,
     * alguém digitando `/display/` direto, ou um atalho que a corta.
     *
     * A resposta é não depender da URL: **quem serve a página sabe o que ela
     * é** — este servidor não serve outra coisa (`web/controle/` nunca entra em
     * `PREFIXOS_BUNDLE`).
     *
     * É `<meta>` e não `<script>` de propósito: a CSP desta resposta é
     * `default-src 'self'` SEM `'unsafe-inline'`, e um script embutido seria
     * bloqueado em silêncio — o pior desfecho para uma correção que existe por
     * causa de uma falha silenciosa.
     *
     * Degrada nos dois sentidos: bundle antigo ignora a marca e usa a query;
     * shell antigo não a injeta e a query continua sendo o caminho.
     */
    private fun comMarcaDeTela(html: ByteArray): ByteArray {
        val texto = String(html, Charsets.UTF_8)
        val i = texto.indexOf("<head>")
        if (i < 0) return html
        val corte = i + "<head>".length
        return (texto.substring(0, corte) + MARCA_TELA + texto.substring(corte))
            .toByteArray(Charsets.UTF_8)
    }


    /**
     * Os estáticos vêm do MESMO lugar que os WebViews leem — bundle OTA da
     * sessão, caindo para os assets do APK, arquivo a arquivo.
     *
     * Reusar o [WebPathHandler] em vez de abrir os assets à mão não é economia
     * de linhas: é o que faz uma correção de JS do espelho chegar por OTA como
     * chega qualquer outra, e é o que impede uma segunda tabela MIME de existir
     * e divergir no primeiro `.woff2` novo.
     */
    private fun lerDoBundle(caminho: String): ByteArray? = try {
        bundle.handle(caminho)?.data?.use { it.readBytes() }
    } catch (e: Exception) {
        Log.w(TAG, "falhou lendo $caminho do bundle", e)
        null
    }

    private fun parear(r: EspelhoHttp.Req, saida: OutputStream, cru: Socket) {
        val corpo = try {
            JSONObject(String(r.corpo, Charsets.UTF_8))
        } catch (e: Exception) {
            return responder(saida, naoAchei())
        }
        // A ORIGEM DO CASTIGO É O ENDEREÇO DO PAR, e não o cabeçalho `Origin`:
        // quem o operador derrubou é **aquele aparelho**, e um cabeçalho é
        // escrito por quem tenta.
        val origem = enderecoDe(cru)
        // UM RAMO SÓ, e agora sem segredo nenhum (v5.189): o corpo traz o
        // RELATO da tela e mais nada — a porta é o endereço (invariante 5 do
        // [EspelhoPares]). Um corpo de bundle ANTIGO, que ainda mande `codigo`,
        // entra por este mesmo caminho: o campo a mais é ignorado, e é essa a
        // degradação certa — a tela velha continua entrando, só que sem
        // precisar do número que o Controle não mostra mais.
        val (status, json) = respostaDoVeredito(entrarNaSessao(origem, relatoDe(corpo)))
        // O REGISTRO PRECISA SABER QUE ALGUÉM BATEU (v1.92). Até aqui a única
        // linha do pareamento era a da tela que CONECTOU; uma tentativa recusada
        // (teto de sessões, castigo) não deixava rastro nenhum, e "a tela não
        // conecta" tinha duas causas indistinguíveis no diagnóstico: nenhum
        // navegador chegou a pedir, ou pediu e foi recusado. São ações opostas —
        // conferir a rede × derrubar uma tela ocupando a vaga — e o operador
        // ficava sem como escolher.
        registrar(
            if (status == 200) "pedido de entrada ACEITO ($origem)"
            else "pedido de entrada RECUSADO ($origem): $json",
        )
        responder(saida, EspelhoHttp.resposta(status, "application/json", json.toByteArray(Charsets.UTF_8)))
    }

    /**
     * O canal de volta do cliente. DOIS verbos desde o corte da v5.187, e os
     * dois inertes por construção: `alive` só atualiza números que vão para o
     * Registro, e `st` sobe ao barramento — **um de dois tipos, e nada mais**
     * (ver [TIPOS_QUE_SOBEM]).
     *
     * (Este KDoc descrevia `key` e `audio`, os verbos do espelho de PIXELS —
     * quadro-chave e entrega de AAC —, que saíram com o encoder na v5.187. É a
     * mesma classe de registro obsoleto que a v5.206 catalogou: um comentário
     * que nomeia um mecanismo morto manda o próximo leitor procurar o defeito
     * no lugar errado.)
     */
    private fun retorno(r: EspelhoHttp.Req, saida: OutputStream, sessao: EspelhoPares.Sessao) {
        val corpo = try {
            JSONObject(String(r.corpo, Charsets.UTF_8))
        } catch (e: Exception) {
            return responder(saida, naoAchei())
        }
        val tela = telasSse[sessao.token]
        // QUALQUER `POST /r` É SINAL DE VIDA, e não só o `alive`: o ping do
        // SSE só prova o NOSSO lado do fio — este carimbo é a voz do de lá.
        tela?.ultimoRelatoMs = SystemClock.elapsedRealtime()
        // O RAMO DO TELÃO POR COMANDOS (E5): o status da tela sobe verbatim ao
        // barramento — o Controle o consome como consome o espelho-status — e
        // alimenta a notificação de mídia (o snoop lê campos que o web já
        // calculou; é a exceção documentada dele). display-ready registra o
        // __de que roteia comando endereçado no SSE. NADA disso passa por
        // sanear(): o caminho de comandos não é o Registro (spec §5.2/§5.4).
        if (corpo.optString("do") == "st") {
            val st = corpo.optJSONObject("st") ?: return responder(saida, naoAchei())
            val tipo = st.optString("type")
            if (tipo.isEmpty()) return responder(saida, naoAchei())
            // A LISTA DE PERMISSÃO MORA AQUI, e não só no `espelho/tela.js`.
            //
            // O dreno de subida é documentado como lista de PERMISSÃO desde a
            // E3 — e estava escrito só no CLIENTE, que é o lado que um
            // desconhecido controla. A fronteira de confiança é este socket:
            // sem a guarda, `tipo` só precisava ser não-vazio e QUALQUER comando
            // subia daqui para os dois WebViews (o [MessageBus] entrega a
            // todos), incluindo `load`, `clear`, `text` e `mic` — a projeção da
            // igreja e o microfone do celular, alcançáveis por quem estiver na
            // Wi-Fi. A porta nasce ABERTA desde a v5.189 (conteúdo público, e a
            // decisão continua certa), então "estar pareado" nunca foi
            // credencial: por isso a filtragem não pode depender do cliente.
            //
            // Os dois tipos são os mesmos que o `tela.js` deixa subir:
            // `display-ready` faz o Controle reenviar a cena (ENDEREÇADO desde a
            // v5.140, então o telão descarta o que não é dele) e `tela-status`
            // tem nome próprio para que nada que espera "o telão" o receba por
            // engano. Tipo novo nasce mudo dos DOIS lados.
            if (tipo !in TIPOS_QUE_SOBEM) {
                registrar("relato recusado: uma tela tentou subir '${EspelhoPares.sanear(tipo, 40)}'")
                return responder(saida, naoAchei())
            }
            if (tipo == "display-ready") {
                telasSse[sessao.token]?.de = st.optString("__de").ifEmpty { null }
            }
            val json = st.toString()
            NativeBridge.snoopStatusDeFora(app, json)
            MessageBus.post(null, json)
            return responder(saida, EspelhoHttp.resposta(200, "application/json", OK_CURTO))
        }
        when (corpo.optString("do")) {
            "alive" -> if (tela != null) {
                tela.telaAcesaMin = corpo.optInt("telaAcesaMin", 0).coerceIn(0, 24 * 60)
                // Texto vindo da rede que termina no Registro: saneado AQUI,
                // do lado que tem teste (invariante 9 do EspelhoPares).
                tela.aviso = EspelhoPares.sanear(corpo.optString("aviso"), TETO_AVISO)
            }
        }
        responder(saida, EspelhoHttp.resposta(200, "application/json", OK_CURTO))
    }

    /**
     * O fluxo de COMANDOS do telão por comandos (`GET /e`, spec §5.1) —
     * `text/event-stream` sobre o chunked de sempre, com o batimento de
     * [PING_SSE_MS] carregando o epoch do celular.
     *
     * O molde é o do `servirFluxo` da era dos pixels (aposentado na v5.187),
     * regra a regra, porque as lições são as
     * mesmas: admissão atômica com teto e frase de lotado, troca da conexão
     * anterior do mesmo token, `soTimeout` zerado (o vigia cobre escrita),
     * `marcarComConexao`/`marcarSemConexao` com a guarda de dois argumentos.
     * O que NÃO existe aqui: csd, IDR, fila de bytes — comando é JSON pequeno
     * e a fila é de eventos inteiros.
     */
    private fun servirEventos(cru: Socket, saida: OutputStream, sessao: EspelhoPares.Sessao) {
        val tela = TelaSse(sessao, cru)
        var anterior: TelaSse? = null
        var lotado = false
        synchronized(telasSse) {
            val atual = telasSse[sessao.token]
            if (atual == null && telasSse.size >= TETO_TELAS) {
                lotado = true
            } else {
                anterior = atual
                telasSse[sessao.token] = tela
            }
        }
        if (lotado) {
            responder(saida, EspelhoHttp.resposta(503, "application/json", LOTADO))
            return
        }
        anterior?.let { fecharSse(it, "a mesma tela reabriu a página") }
        try {
            cru.soTimeout = 0
        } catch (e: Exception) {
            Log.w(TAG, "não foi possível zerar o soTimeout", e)
        }
        conexoesTotais.incrementAndGet()
        EspelhoPares.marcarComConexao(sessao.token)
        tela.rotulo = rotuloNovo()
        registrar("tela ${tela.rotulo} conectada (comandos, ${enderecoDe(cru)})")
        EspelhoEnergia.telasMudaram(app, telasSse.size)
        try {
            saida.write(EspelhoHttp.cabecalhoSse())
            saida.flush()
            // O "oi" com o epoch: a primeira amostra da correção de relógio da
            // tela, antes de qualquer comando.
            val oi = EspelhoHttp.eventoSse(
                JSONObject().put("m", "oi").put("ms", System.currentTimeMillis()).toString(),
            )
            escreverSse(tela, saida, oi)
            while (true) {
                val ev = tela.fila.poll(PING_SSE_MS, TimeUnit.MILLISECONDS)
                if (ev === FIM_SSE) break
                if (ev == null) {
                    if (!tela.viva || servidor == null) break
                    escreverSse(tela, saida, EspelhoHttp.pingSse(System.currentTimeMillis()))
                    continue
                }
                escreverSse(tela, saida, ev)
                tela.eventos++
            }
            try {
                saida.write(EspelhoHttp.chunkFinal())
                saida.flush()
            } catch (e: IOException) {
                // O cliente já foi: o fim de chunked é cortesia, não obrigação.
            }
        } catch (e: InterruptedException) {
            Thread.currentThread().interrupt()
        } catch (e: IOException) {
            Log.i(TAG, "tela de comandos caiu: ${e.message}")
        } finally {
            val eraNossa = telasSse.remove(sessao.token, tela)
            if (eraNossa) {
                EspelhoPares.marcarSemConexao(sessao.token, agoraMs())
            }
            ultimaSaida = JSONObject()
                .put("rotulo", tela.rotulo)
                .put("motivo", tela.motivoDaSaida)
            registrar("tela ${tela.rotulo} desconectada (${tela.motivoDaSaida})")
            EspelhoEnergia.telasMudaram(app, telasSse.size)
        }
    }

    private fun escreverSse(tela: TelaSse, saida: OutputStream, bytes: ByteArray) {
        tela.escritaIniciadaMs = SystemClock.elapsedRealtime()
        try {
            saida.write(EspelhoHttp.chunk(bytes, 0, bytes.size))
            saida.flush()
        } finally {
            tela.escritaIniciadaMs = 0
        }
        // PROGRESSO REAL — o mesmo contrato do fluxo de pixels: é a escrita, e
        // não um tique de relógio, que renova o wake lock do serviço.
        EspelhoEnergia.progresso()
    }

    /** Fecha uma tela de comandos de fora. Com [adeus], a fila é ESVAZIADA e o
     *  evento passa à frente de tudo — o pendente é status de uma cena que esta
     *  tela não vai mais mostrar. */
    private fun fecharSse(t: TelaSse, motivo: String, adeus: ByteArray? = null) {
        if (!t.viva) return
        t.motivoDaSaida = motivo
        t.viva = false
        if (adeus != null) {
            // A FILA É ESVAZIADA ANTES DA DESPEDIDA, e sem isso ela não é a
            // "frente" que o KDoc promete: `offer` põe na CAUDA, e a fila é
            // alimentada a ~4 Hz pelo `display-status` (o `difundirJson` não
            // lê tipo). Numa tela que escoa devagar — sem estar travada — o
            // acúmulo à frente passa do [ADEUS_PRAZO_MS] e o socket cai antes
            // de o adeus chegar ao fio: a tela entra na escada de reconexão
            // batendo numa porta que o `desligar` já fechou, em vez de saber
            // que a transmissão acabou.
            //
            // Descartar o pendente não custa nada: são status de uma cena que
            // esta tela não vai mais mostrar. É a mesma conta que o fan-out já
            // faz ao derrubar quem não escoa ("ela reconecta e recebe a cena
            // inteira de novo pelo `display-ready`").
            t.fila.clear()
            t.fila.offer(adeus)
        }
        if (!t.fila.offer(FIM_SSE)) {
            // Fila entupida: o sentinela não coube. O socket cai de fora, que é
            // o destravamento de sempre — e não há despedida a esperar, porque
            // ela também não foi enfileirada.
            fecharQuieto(t.cru)
            return
        }
        if (adeus == null) {
            fecharQuieto(t.cru)
            return
        }
        // A CORTESIA TEM PRAZO — [ADEUS_PRAZO_MS].
        //
        // Com [adeus] o socket NÃO cai aqui: quem o fecha é a escritora do
        // `GET /e`, ao drenar o sentinela e voltar pelo `finally` do laço de
        // aceite. Ela pode estar BLOQUEADA dentro de `saida.write` (a tela
        // parou de drenar e a janela TCP foi a zero), e nesse estado o único
        // destravamento que existe é fechar o socket de fora. O vigia não
        // serve: `viva` já é false, e o único chamador com adeus é [desligar],
        // que no mesmo fôlego zera `servidor` (encerrando o laço do vigia) e
        // limpa [telasSse] (apagando a última referência à tela). Sem prazo, a
        // thread, o socket e a instância morta do servidor ficam presos pelo
        // resto da vida do processo — que num culto é mantido vivo de propósito
        // pelos serviços em primeiro plano.
        //
        // Fechar um socket já fechado é no-op, então o caminho feliz continua
        // entregando o `{"m":"adeus"}` intacto e este fechamento não faz nada.
        thread(name = "av-espelho-adeus", isDaemon = true) {
            try {
                Thread.sleep(ADEUS_PRAZO_MS)
            } catch (e: InterruptedException) {
                Thread.currentThread().interrupt()
            }
            fecharQuieto(t.cru)
        }
    }

    /**
     * O TAP DO BARRAMENTO (spec §3.2): todo comando que o web relaya por
     * `busPost` chega aqui verbatim e sai no SSE de cada tela de comandos.
     *
     * O Kotlin NÃO interpreta (invariante 5) — a única leitura é o `__para`
     * do endereçamento, comparado por igualdade de string com o `__de` que a
     * tela anunciou; e ela só acontece quando a substring existe, para os
     * `display-status` a 4 Hz não pagarem um parse de JSON cada.
     *
     * Fila cheia = tela que não escoa = derrubada (ela reconecta e recebe a
     * cena inteira de novo pelo `display-ready`). Nunca descarte silencioso
     * de comando: um `load` perdido é a cena errada sem erro nenhum.
     */
    fun difundirJson(json: String) {
        if (servidor == null || telasSse.isEmpty()) return
        val para = if (json.contains("\"__para\"")) {
            try {
                JSONObject(json).optString("__para", "")
            } catch (e: Exception) {
                ""
            }
        } else {
            ""
        }
        val ev = try {
            EspelhoHttp.eventoSse(json)
        } catch (e: IllegalArgumentException) {
            // Quebra de linha crua num JSON do barramento é defeito nosso; o
            // evento partido derrubaria o parse do outro lado inteiro.
            Log.w(TAG, "comando com quebra de linha não relayado")
            return
        }
        for (t in telasSse.values) {
            if (!t.viva) continue
            if (para.isNotEmpty() && t.de != para) continue
            if (!t.fila.offer(ev)) {
                fecharSse(t, "a fila de comandos encheu (a tela não escoa)")
            }
        }
    }

    // ---------- vigia ----------

    /**
     * Um segundo de por vez: escrita travada, sessão vencida e a contagem de
     * telas na notificação.
     *
     * **Teto de tempo de ESCRITA** é o que este laço existe para impor.
     * `setSoTimeout` não cobre escrita, e um cliente que dormiu sem FIN prende
     * a thread por minutos — o retry do TCP não é curto. Estourado o teto, o
     * socket é fechado **de fora**, o que faz o `write()` bloqueado lançar.
     */
    private fun vigiar() {
        while (servidor != null) {
            try {
                Thread.sleep(1_000)
            } catch (e: InterruptedException) {
                return
            }
            val agora = SystemClock.elapsedRealtime()
            // As três regras de sobrevivência das telas de comando: escrita
            // travada (o ping de 15 s pode bloquear num socket meio-aberto),
            // silêncio do lado de lá (ping só prova o NOSSO lado do fio — o
            // alive do cliente é a única voz dele), e sessão vencida.
            for (t in telasSse.values) {
                val inicio = t.escritaIniciadaMs
                if (inicio != 0L && agora - inicio > TETO_ESCRITA_MS) {
                    fecharSse(t, "sem escrita ha ${(agora - inicio) / 1000} s (cliente dormiu)")
                    continue
                }
                if (agora - t.ultimoRelatoMs > TETO_SEM_RELATO_MS) {
                    fecharSse(t, "sem sinal de vida ha ${(agora - t.ultimoRelatoMs) / 1000} s")
                    continue
                }
                if (validarTokenCru(t.sessao.token) == null) {
                    fecharSse(t, "sessao expirada")
                }
            }
            vigiarPontoDeAcesso(agora)
            confirmarRede(agora)
            limparPares()
        }
    }

    // ---------- rede ----------

    /**
     * ASSINA A WI-FI, E NÃO A REDE PADRÃO (v5.183).
     *
     * `registerDefaultNetworkCallback` falaria da rede **padrão**, e é
     * justamente ela que vira a celular numa Wi-Fi sem uplink — ver o KDoc de
     * [wifiDe]. O `NetworkRequest` com `TRANSPORT_WIFI` faz os avisos chegarem
     * sobre a rede que de fato importa: a que carrega a projeção até as telas
     * da igreja.
     *
     * **`NET_CAPABILITY_NOT_VPN` entra; `NET_CAPABILITY_VALIDATED` NÃO.** O
     * primeiro é a mesma regra da §2.3 (uma VPN se sobrepõe a tudo e o socket
     * iria para o lugar errado); o segundo é a internet funcionando, que é
     * exatamente o que não se pode exigir aqui.
     *
     * **ELE NÃO COBRE O PONTO DE ACESSO, e é por isso que a enquete do
     * [vigiarPontoDeAcesso] existe** — não a apague como redundante. O
     * downstream do tethering não é um `Network`: em modo AP puro este callback
     * simplesmente nunca dispara, em nenhum dos quatro métodos. O registro
     * FICA de qualquer jeito, porque ele é inofensivo ali (um `onAvailable` de
     * uma Wi-Fi alheia só chama [redeVoltou], que retorna cedo com
     * `redeSuspeitaDesde == 0`) e é o mecanismo inteiro na igreja com Wi-Fi.
     */
    private fun observarRede() {
        val gerente = app.getSystemService(ConnectivityManager::class.java) ?: return
        val cb = object : ConnectivityManager.NetworkCallback() {
            override fun onLost(network: Network) = conferir()

            override fun onAvailable(network: Network) = redeVoltou()

            override fun onCapabilitiesChanged(network: Network, caps: NetworkCapabilities) {
                if (ehWifiLimpa(caps)) redeVoltou() else conferir()
            }

            override fun onLinkPropertiesChanged(network: Network, lp: LinkProperties) {
                // O ENDEREÇO PODE TROCAR SEM A REDE CAIR (renovação de DHCP, ou
                // o roteador reiniciando): o socket continua ligado a um IP que
                // já não é o do aparelho, e nenhuma conexão nova chega — sem
                // um único erro em lugar nenhum.
                //
                // A suspeita é levantada aqui e o VEREDITO é do [confirmarRede],
                // que sabe distinguir "trocou de endereço" (religa) de "sumiu"
                // (desliga). Ver o KDoc de lá.
                val temIp = lp.linkAddresses.any { it.address.hostAddress == ipServido }
                if (!temIp) suspeitarDaRede("o endereço da Wi-Fi mudou") else redeVoltou()
            }

            /**
             * Uma Wi-Fi saiu de cena. Isto é SUSPEITA, nunca veredito: com duas
             * redes Wi-Fi conhecidas (roaming entre APs de um mesh), o `onLost`
             * de uma chega antes de o `onAvailable` da outra ser processado.
             * Quem confere, 6 s depois e pelo que de fato importa, é o
             * [confirmarRede].
             */
            private fun conferir() {
                if (servidor == null) return
                if (ipAindaEServivel(app, ipServido)) redeVoltou() else suspeitarDaRede("a Wi-Fi sumiu")
            }
        }
        try {
            val pedido = NetworkRequest.Builder()
                .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
                .addCapability(NetworkCapabilities.NET_CAPABILITY_NOT_VPN)
                .build()
            gerente.registerNetworkCallback(pedido, cb)
            cm = gerente
            callbackRede = cb
        } catch (e: Exception) {
            Log.w(TAG, "não foi possível observar a rede", e)
        }
    }

    private fun pararDeObservarRede() {
        val cb = callbackRede ?: return
        callbackRede = null
        try {
            cm?.unregisterNetworkCallback(cb)
        } catch (e: Exception) {
            Log.w(TAG, "não foi possível parar de observar a rede", e)
        }
        cm = null
    }

    /**
     * A rede PARECE ter caído — e o espelho **não** desliga por causa disso
     * ainda.
     *
     * O Android reavalia a Wi-Fi o tempo todo (revalidação, roaming entre
     * pontos de acesso, um `onCapabilitiesChanged` durante o handover), e o
     * caminho antigo — que assinava a rede PADRÃO — lia esse piscar como "a rede
     * sumiu" e **derrubava a transmissão inteira** no meio do culto, com as
     * telas caindo e o operador sem nenhuma explicação na mão. A assinatura
     * passou a ser de `TRANSPORT_WIFI` (v5.183); esta graça é a segunda
     * defesa.
     *
     * Suspeita não é veredito: o motivo fica anotado, o [vigiar] confirma
     * [GRACA_REDE_MS] depois consultando o estado de verdade, e só então a queda
     * acontece. Uma oscilação some sozinha e não custa nada.
     */
    /**
     * O PONTO DE ACESSO CAIU? — a enquete que existe porque o callback não a faz.
     *
     * [observarRede] assina `TRANSPORT_WIFI`, e **em modo ponto de acesso puro
     * esse callback nunca dispara**: não há `Network` de Wi-Fi para ganhar nem
     * para perder. O desfecho não é uma queda errada — `redeSuspeitaDesde` fica
     * em zero e o [confirmarRede] retorna na primeira linha —, é coisa pior:
     * **nada vigiaria o AP caindo**, e o servidor ficaria para sempre num
     * socket amarrado a um endereço morto, com a folha anunciando um endereço
     * que não atende.
     *
     * E o caso não é raro: o ponto de acesso **se desliga sozinho por
     * ociosidade** em vários fabricantes, exatamente quando nenhuma tela está
     * conectada.
     *
     * Ela não decide nada — levanta a mesma SUSPEITA que o callback levanta, e
     * quem dá o veredito [GRACA_REDE_MS] depois continua sendo o
     * [confirmarRede]. A cada [AP_ENQUETE_MS], e **só quando é o ponto de
     * acesso que serve**: na igreja com Wi-Fi o callback já cobre tudo, e uma
     * enumeração de interfaces por segundo seria custo sem pergunta.
     */
    private fun vigiarPontoDeAcesso(agora: Long) {
        if (viaServida != Via.PONTO_DE_ACESSO || servidor == null) return
        if (redeSuspeitaDesde != 0L) return
        if (agora - apConferidoEm < AP_ENQUETE_MS) return
        apConferidoEm = agora
        if (!ipAindaEServivel(app, ipServido)) suspeitarDaRede("o ponto de acesso foi desligado")
    }

    private fun suspeitarDaRede(motivo: String) {
        if (servidor == null || redeSuspeitaDesde != 0L) return
        redeSuspeitaDesde = SystemClock.elapsedRealtime()
        redeSuspeitaMotivo = motivo
        registrar("$motivo — conferindo antes de desligar")
    }

    private fun redeVoltou() {
        if (redeSuspeitaDesde == 0L) return
        redeSuspeitaDesde = 0L
        registrar("a rede voltou — o espelho segue no ar")
    }

    /**
     * O veredito da suspeita, no compasso do [vigiar].
     *
     * A confirmação não repete a leitura que gerou a suspeita: ela pergunta pelo
     * que de fato importa — **o endereço em que este socket está ligado ainda é
     * um endereço deste aparelho numa Wi-Fi?**. É a única pergunta cuja resposta
     * negativa significa que nenhuma conexão nova vai chegar aqui.
     */
    private fun confirmarRede(agora: Long) {
        val desde = redeSuspeitaDesde
        if (desde == 0L || servidor == null) return
        if (agora - desde < GRACA_REDE_MS) return
        // A PERGUNTA CERTA É A MAIS FRACA (v5.183): o endereço em que este
        // socket está ligado ainda é endereço de alguma Wi-Fi deste aparelho?
        // Reusar a função de ADMISSÃO numa pergunta de SOBREVIVÊNCIA era o erro
        // estrutural — ver o KDoc de [ipAindaEServivel].
        if (ipAindaEServivel(app, ipServido)) {
            redeVoltou()
            return
        }
        // O ENDEREÇO TROCOU, MAS A WI-FI ESTÁ LÁ: religa o socket no IP novo em
        // vez de derrubar a projeção. É o caso do roteador reiniciando às 19h40,
        // do lease de DHCP que não devolve o mesmo endereço, e do mesh com DHCP
        // próprio — nenhum pacote da rede se perdeu e o aparelho está no mesmo
        // AP, mas até a v5.182 isso desligava servidor, tela virtual, encoder,
        // janela, mDNS e serviço, e **não havia religamento**.
        // A MESMA VIA, e nunca outra: migrar de ponto de acesso para Wi-Fi
        // sozinho seria LIGAR por conta própria, e o contrato do recurso diz
        // AUXILIAR — liga e desliga só por ação do operador.
        val ipNovo = try {
            redeParaServir(app).firstOrNull { it.via == viaServida }?.ip
        } catch (e: Exception) { null }
        if (ipNovo != null && ipNovo.hostAddress != ipServido) {
            redeSuspeitaDesde = 0L
            redeSuspeitaMotivo = ""
            if (religarNoIp(ipNovo)) return
            // Falhou o rebind: cai no desligamento de sempre, com a frase certa.
            queda("o endereço mudou e o servidor não subiu no novo")
            return
        }
        val motivo = redeSuspeitaMotivo
        redeSuspeitaDesde = 0L
        queda(if (motivo.isEmpty()) "a Wi-Fi sumiu" else motivo)
    }

    /**
     * RELIGA O SOCKET NUM ENDEREÇO NOVO, sem desmontar o resto (v5.183).
     *
     * **Não passa por [ligar]**: aquele chama [desligar] quando há servidor de
     * pé, e `desligar` termina em `zerarPares()` — as três telas voltariam ao
     * pareamento por uma troca de DHCP que elas nem viram. O que morre aqui é
     * exatamente um `ServerSocket`.
     *
     * **A allowlist de `Host` é refeita**: ela guarda `ip:porta`, e um `Host`
     * fora dela recebe o 404 IDÊNTICO de toda requisição recusada — "com o IP
     * novo o espelho para de funcionar", sem uma linha no Registro. É a mesma
     * armadilha que o `hostTls` já documenta em [ligar].
     *
     * As telas conectadas caem (os sockets estão no IP velho) e **nenhuma volta
     * sozinha** — sem o `av.local` (removido na v5.185) não há nome que as
     * reencontre. Por isso o endereço novo precisa CHEGAR AO OPERADOR:
     * [aoTrocarEndereco] reescreve a notificação, além do Registro e da folha.
     *
     * **Tangencia o item 25 do doc ("não deixar o espelho ligar sozinho"), e a
     * distinção é: ele não LIGA sozinho — CONTINUA ligado por uma decisão que o
     * operador já tomou, cuja premissa (o socket serve a LAN deste aparelho)
     * não mudou.** O teto de tentativas evita que uma rede instável vire um
     * laço de rebind.
     */
    private fun religarNoIp(ipNovo: Inet4Address): Boolean {
        val agora = SystemClock.elapsedRealtime()
        if (agora - marcoRebind > REBIND_JANELA_MS) rebindsNaJanela = 0
        if (rebindsNaJanela >= REBIND_MAX) {
            registrar("o endereço mudou ${rebindsNaJanela}× seguidas — desistindo de religar")
            return false
        }
        marcoRebind = agora
        rebindsNaJanela++

        val velho = ipServido
        val ss = ServerSocket()
        try {
            ss.reuseAddress = true
            ss.bind(InetSocketAddress(ipNovo, portaServida), 8)
        } catch (e: IOException) {
            fecharQuieto(ss)
            registrar("o endereço mudou para ${ipNovo.hostAddress}, mas a porta não abriu: ${e.message}")
            return false
        }
        // A TROCA, e a ordem importa: o laço de aceite antigo sai por
        // `servidor === ss`, então o campo é escrito ANTES de o socket velho ser
        // fechado — senão haveria um instante sem ninguém escutando em nada.
        val antigo = servidor
        servidor = ss
        fecharQuieto(antigo)
        ipServido = ipNovo.hostAddress ?: ""
        portaServida = ss.localPort
        val comNome = comTls && hostTlsServido.isNotEmpty()
        endereco = if (comNome) "https://$hostTlsServido:$portaServida"
        else (if (comTls) "https://" else "http://") + ipServido + ":" + portaServida
        hostsAceitos = montarHosts(comNome)
        Thread({ aceitarConexoes(ss) }, "av-espelho-accept").apply { isDaemon = true }.start()
        // "SEM PERDER O PAREAMENTO" É VERDADE NA WI-FI E CONFORTO FALSO NO AP:
        // se o ponto de acesso reiniciou, as telas perderam o SSID e vão
        // reentrar do zero — prometer o contrário no Registro é o artefato que
        // este projeto menos pode produzir, porque ele é lido a distância.
        registrar(
            "o endereço mudou de $velho para $ipServido — servidor religado" +
                if (viaServida == Via.PONTO_DE_ACESSO) "" else ", sem perder o pareamento",
        )
        try {
            aoTrocarEndereco(endereco, ipNovo)
        } catch (e: Exception) {
            Log.w(TAG, "falhou avisando a troca de endereço", e)
        }
        return true
    }

    private fun queda(motivo: String) {
        registrar("$motivo — espelho desligado")
        desligar()
        try {
            aoPerderRede()
        } catch (e: Exception) {
            Log.w(TAG, "falhou avisando a queda de rede", e)
        }
    }

    // ---------- diagnóstico ----------

    /**
     * O estado, **em JSON e sem uma frase sequer**.
     *
     * O Kotlin devolve DADO; quem monta o parágrafo do Registro é o
     * `controle.js`, como já acontece com `otaDiag` e `ytDiag`. Um servidor que
     * formata texto é UI de diagnóstico escrita em Kotlin, e este projeto faz o
     * contrário.
     *
     * `semConexaoMs` é a linha mais importante do diagnóstico inteiro: servidor
     * de pé, porta escutando e **nenhum SYN chegando** é a assinatura de AP
     * isolation, que não tem conserto do lado do app — e sem este número a
     * única resposta possível seria um palpite.
     */
    fun estado(): JSONObject {
        val agora = SystemClock.elapsedRealtime()
        val lista = JSONArray()
        // AS TELAS DE COMANDO — rotulo + conectadaMs é o que a folha lê;
        // eventos/pronta/fila e o aviso do alive são a leitura do Registro.
        for (t in telasSse.values) {
            lista.put(
                relatoJson(t.sessao.relato)
                    .put("rotulo", t.rotulo)
                    .put("comando", true)
                    .put("conectadaMs", agora - t.desdeMs)
                    .put("telaAcesaMin", t.telaAcesaMin)
                    .put("aviso", t.aviso)
                    .put("eventos", t.eventos)
                    .put("pronta", t.de != null)
                    .put("fila", t.fila.size),
            )
        }
        val est = JSONObject()
            .put("ligado", servidor != null)
            .put("url", endereco)
            .put("ip", ipServido)
            // POR ONDE ELE SERVE. Sem este campo o `blocoEspelho` do
            // `controle.js` cravava ", ligado à Wi-Fi)" em toda leitura — e no
            // instante em que o ponto de acesso passou a servir, aquela string
            // virou mentira no artefato que existe para ser copiado.
            .put("via", viaServida.name)
            .put("iface", ifaceServida)
            .put("porta", portaServida)
            .put("tls", comTls)
            .put("noArMs", if (ligadoEm == 0L) 0L else agora - ligadoEm)
            .put("telas", lista)
            .put("teto", TETO_TELAS)
            // SESSÕES VIVAS × TELAS CONECTADAS, lado a lado (v5.183).
            //
            // O teto de três é de SESSÕES, e a lista acima é de CONEXÕES: os
            // dois divergem enquanto uma tela que caiu ainda ocupa a vaga dela.
            // Sem este número, "o espelho diz lotado" com duas telas na folha é
            // uma contradição sem leitura possível — e foi exatamente o que a
            // vaga fantasma produzia.
            .put("sessoes", EspelhoPares.sessoes().size)
            // Quantas telas estão de CASTIGO agora (derrubadas pelo operador há
            // menos de dois minutos). Com o código fora (v5.189) não há mais
            // recusa a contar: este é o único freio que existe, e vê-lo no
            // Registro é o que explica uma tela que "não volta" logo depois de
            // o operador a desconectar sem querer.
            .put("origensBloqueadas", EspelhoPares.origensEmBloqueio(agoraMs()))
            .put("conexoesTotais", conexoesTotais.get())
            .put("semConexaoMs", if (conexoesTotais.get() == 0 && ligadoEm != 0L) agora - ligadoEm else 0L)
            .put("ultimaSaida", ultimaSaida ?: JSONObject.NULL)
            // QUEM BATEU NA PORTA E FOI RECUSADO, por motivo. Todas respondem o
            // mesmo 404 no fio (invariante 5), e é por isso que só aqui elas se
            // distinguem: `host` é tentativa de DNS rebinding contra este
            // aparelho, `malformada` em quantidade é um scanner na rede.
            .put("recusadas", JSONObject().also { o -> for ((k, v) in recusadas) o.put(k, v.get()) })
            // A BANDA QUE A REDE DIZ TER. Não é medição nossa — é o que o
            // Android reporta do enlace —, e ela responde antes do culto se
            // este AP tem fôlego, em vez de o operador descobrir durante.
            //
            // A pergunta que ela respondia era "cabem 3 Mbps × 3 telas neste
            // AP?", e aquela conta morreu com o espelho de PIXELS (v5.187): não
            // há mais fluxo contínuo por tela. O que atravessa a rede agora são
            // objetos JSON pequenos e a MÍDIA SOB DEMANDA — uma vez por item,
            // em rajada, e depois silêncio. O número cru continua valendo; o
            // teto de telas derivado dele não, e por isso ele saiu do Registro
            // na v5.206.
            .put("enlace", enlaceJson())
        // O CACHE DE MÍDIA — o que a rota `/m/` tem para servir. Sem estes três
        // números, "a tela não toca o vídeo" não separa o empurrão que não
        // chegou do item que o LRU despejou.
        //
        // A CHAVE SÓ EXISTE QUANDO HÁ CACHE: publicá-la zerada com a
        // transmissão desligada diria "cache vazio" onde a verdade é "não há
        // cache" — a forma de mentir que este bloco já pagou (o `ritmo` da
        // v5.206), porque zero é valor legítimo e o consumidor o lê.
        midia?.let { m ->
            est.put(
                "midia",
                JSONObject()
                    .put("itens", m.itens())
                    .put("bytes", m.bytesNoCache())
                    .put("teto", m.teto()),
            )
        }
        return est
    }

    /**
     * O que o Android sabe do enlace, sem pedir permissão nenhuma.
     *
     * `getLinkUpstreamBandwidthKbps` é uma ESTIMATIVA do sistema, não uma
     * medição — e vale exatamente por isso: ela vem de graça e responde antes
     * do culto a pergunta que decide o recurso ("cabem 3 Mbps × 3 telas neste
     * AP?"). O nome da interface entra junto porque é a confirmação estrutural
     * de que o socket está mesmo na Wi-Fi (`wlan0`) e não noutro caminho.
     *
     * **Nada aqui pede localização.** SSID, RSSI e `TransportInfo` exigem
     * `ACCESS_FINE_LOCATION` desde a API 29, e um app de projeção pedindo
     * localização para desenhar uma linha de diagnóstico é o tipo de troca que
     * este projeto não faz.
     */
    private fun enlaceJson(): JSONObject {
        val o = JSONObject()
        try {
            val gerente = cm ?: app.getSystemService(ConnectivityManager::class.java)
            val net = gerente?.activeNetwork ?: return o
            gerente.getNetworkCapabilities(net)?.let { c ->
                o.put("upKbps", c.linkUpstreamBandwidthKbps)
                o.put("downKbps", c.linkDownstreamBandwidthKbps)
                o.put("wifi", c.hasTransport(NetworkCapabilities.TRANSPORT_WIFI))
                o.put("validada", c.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED))
            }
            gerente.getLinkProperties(net)?.let { lp ->
                o.put("iface", lp.interfaceName ?: "?")
            }
        } catch (e: Exception) {
            Log.w(TAG, "estado do enlace indisponível", e)
        }
        return o
    }

    // ---------- PONTE COM O EspelhoPares ----------
    //
    // Todo contato com [EspelhoPares] passa por aqui, e por nenhum outro lugar
    // (fora as menções ao TIPO `Sessao`/`Relato` nas assinaturas). Se a
    // implementação dele divergir, é ESTE bloco que se conserta — o resto do
    // arquivo não sabe que ele existe.
    //
    // O que ESTE arquivo consome de lá, e nada mais: `Relato`, `Sessao` e
    // `Veredito` (os tipos), mais `validar`, `entrar`, `limpar`, `zerar`,
    // `derrubar`, `sessoes`, `origensEmBloqueio`, `marcarSemConexao`
    // e `marcarComConexao`.
    // `ligar` e `desligar` são do DONO (a `MainActivity`, pela ponte): quem
    // liga a transmissão é o operador, e o servidor não precisa saber disso —
    // ele só atende o que chega no `POST /par`, que é o que mantém a rede fora
    // do laço de decisão.
    //
    // O relógio entregue a ele é `System.currentTimeMillis()`, e não o
    // `elapsedRealtime` que este arquivo usa internamente: [EspelhoPares] é
    // PURO (zero import de Android) e precisa de um "agora" que um JUnit sem
    // aparelho também tenha.

    private fun agoraMs(): Long = System.currentTimeMillis()

    /**
     * O cabeçalho `Authorization` vai CRU para o [EspelhoPares].
     *
     * Quem entende de `Bearer` é ele — e é ele **sozinho**: extrair o token aqui
     * seria a mesma regra escrita em dois lugares, e a cópia deste lado
     * envelheceria calada. Ele aceita as duas formas (cabeçalho e token nu), que
     * é o que permite ao [vigiar] usar a mesma porta com o que tem na mão.
     */
    private fun validarToken(autorizacao: String?): EspelhoPares.Sessao? =
        EspelhoPares.validar(autorizacao, agoraMs())

    /** O mesmo, para um token que já está guardado (o vigia, que não tem
     *  cabeçalho nenhum na mão). */
    private fun validarTokenCru(token: String): EspelhoPares.Sessao? =
        EspelhoPares.validar(token, agoraMs())

    private fun entrarNaSessao(origem: String, relato: EspelhoPares.Relato) =
        EspelhoPares.entrar(origem, relato, agoraMs())

    private fun limparPares() = EspelhoPares.limpar(agoraMs())

    private fun zerarPares() = EspelhoPares.zerar()

    /**
     * O veredito do pareamento vira status + corpo — e este é o ÚNICO ponto do
     * arquivo que conhece a forma dele.
     *
     * O corpo é o da §5.1, com o `else` valendo por recusa: um veredito que
     * este código não conheça **nega**, nunca autoriza. Falha fechada é a única
     * postura possível num controle de acesso.
     */
    private fun respostaDoVeredito(v: EspelhoPares.Veredito): Pair<Int, String> = when (v) {
        is EspelhoPares.Veredito.Aprovada ->
            200 to JSONObject().put("t", v.sessao.token).toString()
        // LOTADO É UMA FRASE, e não a recusa genérica. As três vagas ocupadas e
        // o código errado são a mesma tela ("não deu para entrar") para quem
        // está do outro lado, e as duas têm saídas opostas: uma pede que alguém
        // feche uma página, a outra que se confira o número. O status continua
        // 403 — quem não entrou não entrou —, e o que muda é o corpo, que o
        // cliente lê para escolher a frase.
        is EspelhoPares.Veredito.Lotada -> 403 to LOTADO_JSON
        // Bloqueada (o operador derrubou esta tela há pouco) e Desligado caem
        // aqui, no corpo genérico: quem foi derrubado não recebe a duração do
        // castigo de volta — seria dizer a um curioso quanto falta.
        else -> 403 to RECUSADA
    }

    /**
     * O OPERADOR DERRUBA UMA TELA — o botão "Desconectar" da folha, e desde a
     * v5.185 o ÚNICO controle que ele tem sobre quem está vendo.
     *
     * O `controle.js` manda o **rótulo** da tela ("tela B"), que é o único
     * identificador que a folha tem e o único que faz sentido ali: numa lista de
     * três, o que o operador precisa é distinguir uma da outra.
     *
     * O rótulo é resolvido para a sessão de verdade, a sessão é encerrada, a
     * origem fica de castigo por [EspelhoPares.BLOQUEIO_DERRUBADA_MS] — senão a
     * tela derrubada digita o código de novo e volta em dois segundos, e o botão
     * reportaria sucesso sem fazer nada visível — e o socket é fechado de fora.
     * `false` = não há tela com esse rótulo.
     */
    fun derrubarTela(rotulo: String): Boolean {
        if (rotulo.isEmpty()) return false
        val alvo = telasSse.values.firstOrNull { it.rotulo == rotulo } ?: return false
        EspelhoPares.derrubar(alvo.sessao.token, enderecoDe(alvo.cru), agoraMs())
        telasSse.remove(alvo.sessao.token, alvo)
        fecharSse(alvo, "o operador desconectou esta tela")
        EspelhoEnergia.telasMudaram(app, telasSse.size)
        registrar("tela ${alvo.rotulo} desconectada pelo operador")
        return true
    }

    /**
     * O relato que veio no corpo do `POST /par`, **cru**.
     *
     * Ele é montado aqui e saneado LÁ: o `tentar` passa o relato inteiro pelo
     * `sanear` antes de guardá-lo (§3.5, invariante 9), num ponto só e do lado
     * que tem teste. Sanear aqui também seria a segunda cópia de uma regra de
     * segurança — exatamente o que este projeto não faz.
     *
     * Campo ausente vira o padrão do `opt*`: um cliente que não se descreve fica
     * com "não sei" em vez de derrubar o pareamento. O `telaAcesaMin` nasce em 0
     * e quem o mantém depois é o `POST /r {"do":"alive"}`, por CONEXÃO.
     */
    private fun relatoDe(json: JSONObject) = EspelhoPares.Relato(
        ua = json.optString("ua"),
        w = json.optInt("w", 0),
        h = json.optInt("h", 0),
        telaAcesaMin = json.optInt("telaAcesaMin", 0).coerceIn(0, 24 * 60),
    )

    /**
     * O relato do cliente vira JSON, campo a campo e com os MESMOS nomes da
     * §5.5 — que são os nomes que o cliente mandou e os que o `controle.js`
     * espera ler.
     *
     * Ele é repassado, nunca reinterpretado: quem SANEIA o texto que veio da
     * rede é o [EspelhoPares] (§3.5, invariante 9), num ponto só e antes de
     * qualquer coisa chegar aqui. O `ua` termina no Registro, que é o artefato
     * que este projeto manda COPIAR e repassar — um `\n` ali injetaria linhas
     * falsas num diagnóstico, e um diagnóstico que mente é pior que
     * diagnóstico nenhum.
     */
    private fun relatoJson(r: EspelhoPares.Relato): JSONObject = JSONObject()
        .put("ua", r.ua)
        .put("w", r.w)
        .put("h", r.h)
        // O do relato é o que a tela DECLAROU ao entrar; [estado] o sobrescreve
        // logo em seguida com o número vivo do `alive`.
        .put("telaAcesaMin", r.telaAcesaMin)

    // ---------- utilidades ----------

    private fun responder(saida: OutputStream, bytes: ByteArray) {
        try {
            saida.write(bytes)
            saida.flush()
        } catch (e: IOException) {
            Log.i(TAG, "resposta não chegou: ${e.message}")
        }
    }

    /** O 404 canônico é do [EspelhoHttp] — rota inexistente, token inválido,
     *  `Host` recusado e `Origin` estranha respondem o MESMO, até no
     *  `Content-Length`. */
    private fun naoAchei(): ByteArray = EspelhoHttp.naoEncontrado()

    private fun rotuloNovo(): String {
        val n = proximoRotulo.getAndIncrement()
        return if (n < 26) ('A' + n).toString() else "T$n"
    }

    /**
     * O nome curto de um motivo de recusa, para o mapa de [recusadas].
     *
     * Nomes NOSSOS, e não `e.javaClass.simpleName`: o segundo mudaria de valor
     * numa renomeação de classe e levaria junto a continuidade do diagnóstico,
     * que é a única coisa que um contador histórico tem a oferecer.
     */
    private fun rotuloDoErro(e: Throwable?): String = when (e) {
        is EspelhoHttp.Erro.HostRecusado -> "host"
        is EspelhoHttp.Erro.OrigemEstranha -> "origem"
        is EspelhoHttp.Erro.CorpoLongo -> "corpo"
        is EspelhoHttp.Erro.LinhaLonga, is EspelhoHttp.Erro.CabecalhoLongo,
        is EspelhoHttp.Erro.CabecalhosDemais,
        -> "grande"
        is EspelhoHttp.Erro.Truncado -> "truncada"
        else -> "malformada"
    }

    private fun enderecoDe(s: Socket): String =
        (s.inetAddress?.hostAddress ?: "?")

    private fun fecharQuieto(c: java.io.Closeable?) {
        try {
            c?.close()
        } catch (e: Exception) {
            // Fechar é o último ato: uma exceção aqui não muda nada.
        }
    }

    /**
     * Uma tela do telão por comandos — o assinante de UM `GET /e`.
     *
     * A fila carrega eventos JÁ enquadrados em SSE (`data: …\n\n`), prontos
     * para virar um chunk cada. Os campos de sobrevivência são os mesmos da
     * [Tela] de pixels, pelas lições já pagas: [escritaIniciadaMs] para o
     * vigia destravar um `write()` preso, [ultimoRelatoMs] porque ping só
     * prova o NOSSO lado do fio, [viva]/[motivoDaSaida] para o Registro dizer
     * como terminou.
     */
    private class TelaSse(val sessao: EspelhoPares.Sessao, val cru: Socket) {
        @Volatile var rotulo = ""

        /** O que o alive da tela conta de si — a frase e a tela acesa. */
        @Volatile var aviso = ""
        @Volatile var telaAcesaMin = 0

        val fila = ArrayBlockingQueue<ByteArray>(TETO_FILA_SSE)

        /** O `__de` que a tela anunciou no `display-ready` (E3) — é ele que
         *  roteia comando endereçado (`__para`). `null` até o anúncio. */
        @Volatile var de: String? = null

        @Volatile var ultimoRelatoMs = SystemClock.elapsedRealtime()
        @Volatile var escritaIniciadaMs = 0L
        @Volatile var eventos = 0L
        val desdeMs: Long = SystemClock.elapsedRealtime()
        @Volatile var viva = true
        @Volatile var motivoDaSaida = "fechou a página"
    }

    /** A rede recusou-se a servir, e a mensagem é a frase que o operador lê. */
    class Recusa(mensagem: String) : IOException(mensagem)

    /**
     * POR ONDE o socket serve — e ela existe para o [confirmarRede] não MIGRAR
     * sozinho de uma para a outra: o contrato do recurso diz AUXILIAR, e trocar
     * de rede por conta própria seria ligar por conta própria.
     */
    enum class Via { WIFI, PONTO_DE_ACESSO }

    /**
     * O que [redeDaWifi] e [redeParaServir] apuraram: o IPv4 servível, a
     * interface em que ele mora e por onde ele serve.
     *
     * `iface` e `via` têm padrão porque [redeDaWifi] segue devolvendo `Rede(ip)`
     * — ela é o degrau 1 e não mudou uma linha, que é o que garante zero
     * regressão na igreja que já funciona.
     */
    data class Rede(
        val ip: Inet4Address,
        val iface: String = "",
        val via: Via = Via.WIFI,
    )

    companion object {
        private const val TAG = "EspelhoServidor"

        const val PORTA_PADRAO = 8787

        /** Teto RÍGIDO de sessões — §3.5, invariante 8. */
        const val TETO_TELAS = 3

        /**
         * Conexões em voo **que ainda não viraram fluxo**, contadas à parte do
         * teto de telas: três TCPs mudos não podem consumir os três slots nem
         * uma thread cada, para sempre.
         *
         * Dezesseis, e não oito: um navegador abre até seis conexões paralelas
         * por host, e três telas carregando a página ao mesmo tempo (o que
         * acontece quando o operador liga o espelho com as TVs já apontadas para
         * o endereço) somam mais que oito sozinhas. Ver a subtração em
         * [aceitarConexoes].
         */
        private const val TETO_EM_VOO = 16



        /**
         * O corte da frase que a tela manda.
         *
         * O `EspelhoPares.TETO_TEXTO` (120) é o padrão e vale para o `ua` do
         * pareamento, que é anônimo. Este campo é do canal AUTENTICADO e cresceu
         * junto com ele: cortado em 120, o que se perdia era sempre o FIM — que
         * é onde a frase da tela diz a causa ("...não está conseguindo
         * decodificar o fluxo (5 recusas seguidas)"). O saneamento é o mesmo, e
         * é ele que continua garantindo que não entre `\n` no Registro.
         */
        private const val TETO_AVISO = 240
        /**
         * Prazo de LEITURA da requisição — por `read()`, não pela mensagem
         * inteira (é o que `setSoTimeout` significa).
         *
         * Eram 2 s, e 2 s é o que uma Wi-Fi congestionada leva para entregar um
         * corpo de 4 KiB quando três telas estão recebendo 3 Mbps cada. O
         * `POST /r` que estourasse esse prazo virava [EspelhoHttp.Erro.Truncado]
         * → 400, e desde que o vigia passou a exigir sinal de vida
         * ([TETO_SEM_RELATO_MS]) isso deixaria de ser um relato perdido para
         * virar uma tela derrubada por causa de um timer apertado. Dez segundos
         * é o número que o KDoc do [EspelhoHttp] já anunciava, e um socket mudo
         * continua limitado pelo [TETO_EM_VOO].
         */
        private const val PRAZO_LINHA_MS = 10_000
        private const val TETO_ESCRITA_MS = 20_000L

        /**
         * Quanto o `{"m":"adeus"}` tem para sair antes de o socket cair de
         * fora — ver o fim do [fecharSse].
         *
         * Bem abaixo do [TETO_ESCRITA_MS] de propósito: aquele é o prazo de uma
         * tela VIVA, e aqui a transmissão já foi desligada. No socket saudável
         * a despedida é um chunk de dezenas de bytes numa fila vazia, e sai em
         * microssegundos; um segundo e meio é folga, não espera.
         */
        private const val ADEUS_PRAZO_MS = 1_500L

        /**
         * O batimento do fluxo de COMANDOS (`GET /e`, telão por comandos —
         * `docs/TELAO-POR-COMANDOS.md` §5.1). Ele paga três contas de uma vez:
         * o vigia de fio do cliente (que no fluxo de pixels vivia dos bytes
         * contínuos do vídeo), a detecção de TCP meio-aberto deste lado (a
         * escrita do ping falha), e a renovação do wake lock do
         * [EspelhoEnergia], que é por progresso real de escrita — um SSE pode
         * ficar minutos sem comando numa cena parada, e sem o ping o teto de
         * 2 h venceria no meio do culto. O ping carrega o epoch que ancora a
         * correção de relógio das telas (cronômetro e sorteio viajam por
         * descritor em `Date.now()` do celular).
         */
        private const val PING_SSE_MS = 15_000L

        /**
         * Eventos na fila de UMA tela de comandos. O tráfego normal é
         * minúsculo (JSONs de operação + status a ~4 Hz), então uma fila que
         * ENCHE não é rajada: é um cliente que parou de escoar — e a resposta
         * certa é derrubá-lo (ele reconecta e recebe a cena de novo pelo
         * `display-ready`), nunca descartar comando em silêncio, porque um
         * `load` perdido é uma tela mostrando a cena errada sem erro nenhum.
         */
        private const val TETO_FILA_SSE = 256

        /**
         * O QUE UMA TELA PODE INJETAR NO BARRAMENTO — ver [retorno].
         *
         * É a metade servidora do dreno de subida do `espelho/tela.js`, e as
         * duas precisam existir: a do cliente evita o tráfego, esta é a que
         * **vale**. Mantê-las iguais é obrigação de quem acrescentar um tipo, e
         * quem cobra o par é o `tools/tipos-que-sobem.test.mjs` — Node puro, no
         * passo que BARRA o build. (Ele lê ESTE `setOf` e o `drenar()` do
         * `tela.js` como texto, e sabe que `display-status` sobe renomeado para
         * `tela-status`.)
         */
        private val TIPOS_QUE_SOBEM = setOf("display-ready", "tela-status")

        /**
         * Os PREFIXOS do bundle servidos à LAN (telão por comandos, E2) — a
         * tela da rede roda o próprio `/web/display/`, servido daqui com a
         * MESMA resolução OTA→APK dos WebViews ([WebPathHandler], arquivo a
         * arquivo).
         *
         * Allowlist de PREFIXO, e desde a v1.92 é a ÚNICA. Havia ao lado dela um
         * mapa fixo de rotas curtas (`ESTATICOS`), e as quatro entradas dele
         * apontavam para arquivos que a v5.187 APAGOU com o espelho de pixels
         * (`espelho/index.html`, `cliente.js`, `fmp4.js`, `espelho.css`) — três
         * rotas que só sabiam responder "faltou no bundle" e uma (`/`) que o
         * `when` já interceptava antes. Rota que aponta para arquivo que não
         * existe é pior que rota nenhuma: ela documenta um recurso morto.
         *
         * O prefixo existe porque o display carrega dezenas de arquivos
         * (`display.js`, os módulos de `shared/`, fontes) que um mapa fixo
         * obrigaria a enumerar um a um e a esquecer no primeiro arquivo novo. A
         * contenção não se perde: o parser já recusa `..` e não-ASCII no
         * caminho, e o [WebPathHandler] confere `canonicalPath` no bundle OTA.
         *
         * **`web/controle/` NUNCA entra aqui** — o Controle é a superfície do
         * operador, e servi-lo à rede entregaria a UI inteira a qualquer um no
         * Wi-Fi (§8 da spec).
         */
        private val PREFIXOS_BUNDLE = mapOf(
            "/display/" to "web/display/",
            "/shared/" to "web/shared/",
            "/espelho/" to "web/espelho/",
        )

        /** Sentinela de fim da fila SSE — o mesmo papel do [FIM] dos pixels. */
        private val FIM_SSE = ByteArray(0)

        /** Um fluxo de mídia EM CRESCIMENTO que fica este tanto sem byte novo
         *  perdeu o empurrão do outro lado (a página do Controle caiu): a
         *  conexão fecha SEM o terminador do chunked — a entrega foi truncada,
         *  e afirmar o contrário é o defeito — e o <video> da tela cai na
         *  recuperação normal dele. */
        private const val TETO_MIDIA_PARADA_MS = 30_000L

        /**
         * Silêncio do cliente que vale desconexão.
         *
         * ERAM 60 s, E ELES EXECUTAVAM TELAS VIVAS (v5.208). O raciocínio
         * original ("o cliente relata a cada 10 s, seis batidas perdidas é uma
         * tela que foi embora") supõe que o `setInterval` do outro lado bata.
         * **Um navegador de TV com a aba em segundo plano estrangula timer para
         * ~1 por minuto**, e alguns o suspendem com a tela dormindo: as seis
         * batidas viram UMA, exatamente na fronteira.
         *
         * O Registro do operador mostrou: tela conectada às 16:30:56 e derrubada
         * às 16:31:56 — 60 s cravados — e o MESMO navegador reentrando como tela
         * A, B, C, D ao longo do culto. Enquanto ele reentra, o comando não
         * chega: é o "deixa de controlar".
         *
         * Duas metades, e as duas são precisas:
         *  1. o cliente manda o sinal de vida PELO FIO (v5.208, `tela.js`) —
         *     byte que chega não é timer, e o ping daqui é de 15 s. Isso
         *     conserta a causa;
         *  2. este teto sobe para 150 s: ele existe para distinguir "foi embora"
         *     de "está lenta", e 60 s não distinguia. Com 150 s cabem dez pings,
         *     e uma tela que de fato saiu ainda cai em menos de três minutos.
         */
        private const val TETO_SEM_RELATO_MS = 150_000L

        /**
         * Quanto tempo uma suspeita de queda de rede precisa sobreviver antes de
         * virar desligamento. Ver [suspeitarDaRede] — o padrão do Android pisca
         * para a rede móvel durante uma revalidação da Wi-Fi, e o espelho não
         * pode morrer por causa de um piscar.
         */
        private const val GRACA_REDE_MS = 6_000L

        /**
         * De quanto em quanto a enquete do ponto de acesso confere — ver
         * [vigiarPontoDeAcesso]. Cinco segundos porque ela ENUMERA INTERFACES,
         * e o laço que a hospeda roda a cada segundo: o que se vigia aqui é o
         * operador desligando o hotspot, não um pacote perdido.
         */
        private const val AP_ENQUETE_MS = 5_000L

        /**
         * Quantas trocas de endereço se aceita religar, e em que janela.
         *
         * Existe para uma rede instável não virar um laço de rebind: cada
         * religamento fecha e reabre um `ServerSocket` e derruba as telas
         * conectadas, então repeti-lo sem fim seria trocar uma queda por um
         * piscar contínuo. Batido o teto, vale o desligamento de sempre — que é
         * o comportamento anterior a esta versão, e que o operador reconhece.
         *
         * Três numa hora é generoso para o caso real (o roteador reiniciando) e
         * apertado para o patológico (um DHCP que troca o endereço a cada minuto).
         */
        private const val REBIND_MAX = 3
        private const val REBIND_JANELA_MS = 60L * 60 * 1000

        /**
         * A marca do papel `tela`, injetada em toda página servida — ver
         * [comMarcaDeTela]. `<meta>` porque a CSP desta resposta não permite
         * script embutido.
         */
        private const val MARCA_TELA = "<meta name=\"av-tela\" content=\"1\">"

        private val OK_CURTO = "{\"ok\":true}".toByteArray(Charsets.US_ASCII)
        private val RECUSADA = "{\"estado\":\"recusada\"}"
        private val LOTADO_JSON = "{\"estado\":\"lotado\"}"
        private val LOTADO = LOTADO_JSON.toByteArray(Charsets.US_ASCII)

        /**
         * O IPv4 da Wi-Fi, ou uma [Recusa] com a frase pronta.
         *
         * Fica no companion porque quem liga o espelho precisa dela ANTES de
         * construir o servidor — para desenhar o endereço, o QR, e para não
         * oferecer o recurso num aparelho em dados móveis.
         */
        @JvmStatic
        fun redeDaWifi(ctx: Context): Rede {
            val cm = ctx.applicationContext.getSystemService(ConnectivityManager::class.java)
                ?: throw Recusa("sem acesso ao estado da rede")
            val net = wifiDe(cm)
                ?: throw Recusa("sem Wi-Fi — o espelho so liga em Wi-Fi")
            val lp = cm.getLinkProperties(net)
                ?: throw Recusa("a Wi-Fi nao informou endereco a este aparelho")
            val ip = ipv4De(lp)
                ?: throw Recusa("a Wi-Fi nao deu endereco IPv4 a este aparelho")
            return Rede(ip)
        }

        /**
         * A REDE DA WI-FI, E NUNCA A REDE PADRÃO (v5.183).
         *
         * `getActiveNetwork()` é a rede PADRÃO — por onde o tráfego geral sai.
         * Numa igreja com o AP no ar e o link de internet fora, o Android marca
         * a Wi-Fi como não validada e promove a CELULAR a padrão (dados móveis
         * ficam ligados porque o download do YouTube depende do IP do chip).
         *
         * O preço era duplo e silencioso: o operador tocava em "Mostrar numa
         * tela da rede" e lia *"so liga em Wi-Fi — este aparelho esta em dados
         * moveis"* com o celular associado à Wi-Fi; e, com o espelho no ar, a
         * troca de padrão derrubava a projeção com a LAN intacta.
         *
         * **A propriedade de segurança da §2.3 fica intacta:** procura-se uma
         * rede com `TRANSPORT_WIFI` e SEM VPN e SEM celular, e o socket segue
         * ligado a um IPv4 dela, nunca a `0.0.0.0`. Muda só a pergunta: "existe
         * uma Wi-Fi neste aparelho?" em vez de "a rede padrão é Wi-Fi?".
         *
         * **`NET_CAPABILITY_VALIDATED` fica DELIBERADAMENTE fora do filtro**: é
         * ele que falta numa igreja sem uplink, e exigi-lo reintroduziria o
         * defeito com outro nome.
         *
         * `getAllNetworks()` está deprecado desde a API 31 e é usado assim
         * mesmo: **não existe substituto SÍNCRONO**. O caminho moderno
         * (`registerNetworkCallback` + guardar o `Network` do `onAvailable`) é
         * assíncrono, e esta função é chamada no toque do operador, antes de
         * existir callback. O callback de `TRANSPORT_WIFI` é o de
         * [observarRede], que cuida do que vem DEPOIS.
         */
        @Suppress("DEPRECATION")
        private fun wifiDe(cm: ConnectivityManager): Network? {
            for (n in cm.allNetworks) {
                val caps = cm.getNetworkCapabilities(n) ?: continue
                if (ehWifiLimpa(caps) && cm.getLinkProperties(n)?.let { ipv4De(it) } != null) return n
            }
            return null
        }

        /** Wi-Fi de verdade: nem VPN (que se sobrepõe a tudo), nem celular. */
        @JvmStatic
        fun ehWifiLimpa(caps: NetworkCapabilities): Boolean =
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) &&
                !caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN) &&
                !caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)

        private fun ipv4De(lp: LinkProperties): Inet4Address? = lp.linkAddresses
            .map { it.address }
            .filterIsInstance<Inet4Address>()
            .firstOrNull { !it.isLoopbackAddress && !it.isAnyLocalAddress }

        /**
         * O `ipServido` ainda é um endereço SERVÍVEL deste aparelho?
         *
         * É a pergunta de SOBREVIVÊNCIA, e ela é mais fraca que a de admissão
         * de propósito: [redeDaWifi] escolhe *uma* Wi-Fi e devolve *o primeiro*
         * IPv4 dela, então reusá-la aqui reprovaria um aparelho com duas
         * interfaces Wi-Fi (ou dois endereços na mesma) por uma questão de
         * ordem de listagem — e a reprovação significa desligar a projeção.
         *
         * **O PASSO CUJA AUSÊNCIA DERRUBARIA O PONTO DE ACESSO INTEIRO:** o
         * primeiro degrau pergunta ao `ConnectivityManager`, que em modo AP
         * responde SEMPRE não — o downstream do tethering não é um `Network`.
         * Enquanto esta função só tinha aquele degrau, uma transmissão servida
         * pelo ponto de acesso morreria na primeira suspeita, com a frase da
         * Wi-Fi e o hotspot ligado o tempo todo.
         */
        @Suppress("DEPRECATION")
        @JvmStatic
        fun ipAindaEServivel(ctx: Context, ip: String): Boolean {
            if (ip.isEmpty()) return false
            val cm = ctx.applicationContext.getSystemService(ConnectivityManager::class.java)
            if (cm != null) {
                for (n in cm.allNetworks) {
                    val caps = cm.getNetworkCapabilities(n) ?: continue
                    if (!ehWifiLimpa(caps)) continue
                    val lp = cm.getLinkProperties(n) ?: continue
                    if (lp.linkAddresses.any { it.address.hostAddress == ip }) return true
                }
            }
            // DEGRAU 2 — e ele FALHA FECHADO: o ponto de acesso desligado leva
            // a interface embora (ou a derruba), e nenhum achado sobra.
            return try {
                lerInterfaces(ctx).achados.any { it.ip == ip }
            } catch (e: Exception) {
                Log.w(TAG, "não foi possível reler as interfaces", e)
                false
            }
        }

        /**
         * TODO ENDEREÇO EM QUE ESTE APARELHO PODE SERVIR, o melhor primeiro.
         *
         * Dois degraus, e o primeiro **não mudou uma linha**:
         *
         * 1. [redeDaWifi] — a pergunta ao `ConnectivityManager` de sempre. É a
         *    que responde na igreja com Wi-Fi, e mantê-la intacta é o que
         *    garante zero regressão onde o recurso já funciona.
         * 2. o **PONTO DE ACESSO**, e só quando o degrau 1 não respondeu por si
         *    — a enumeração de interfaces do [EspelhoInterfaces]. O soft AP não
         *    é um `Network`, então é o único eixo em que ele aparece.
         *
         * **Admitir só [EspelhoInterfaces.Tipo.PONTO_DE_ACESSO] é decisão DESTA
         * função, não da regra:** o `EspelhoInterfaces` classifica e devolve
         * tudo (inclusive `CABO` e `DESCONHECIDO`), e a política de quem entra
         * fica visível aqui, numa linha, em vez de escondida na ordem de uma
         * enumeração.
         *
         * Devolve lista vazia quando não há nada servível — quem transforma
         * isso na frase do operador é a [MainActivity], nunca este arquivo.
         */
        @JvmStatic
        fun redeParaServir(ctx: Context): List<Rede> {
            val fora = ArrayList<Rede>()
            try {
                fora.add(redeDaWifi(ctx))
            } catch (e: Recusa) {
                // Sem Wi-Fi é o caso NORMAL do ponto de acesso, não um erro:
                // segue para o degrau 2 sem registrar nada.
            } catch (e: Exception) {
                Log.w(TAG, "a leitura da Wi-Fi falhou", e)
            }
            try {
                for (a in lerInterfaces(ctx).achados) {
                    if (a.tipo != EspelhoInterfaces.Tipo.PONTO_DE_ACESSO) continue
                    if (fora.any { it.ip.hostAddress == a.ip }) continue
                    val ip = ipv4Literal(a.ip) ?: continue
                    fora.add(Rede(ip, a.nome, Via.PONTO_DE_ACESSO))
                }
            } catch (e: Exception) {
                Log.w(TAG, "não foi possível ler as interfaces", e)
            }
            return fora
        }

        /**
         * POR QUE não há endereço servível — a frase que o operador lê.
         *
         * Ela não é mais "sem Wi-Fi": desde que o ponto de acesso passou a
         * servir, essa resposta ficou incompleta (há outra saída) **e sugeria o
         * movimento errado** — quem a lia entendia que precisava achar uma
         * Wi-Fi, que é justamente o que a igreja sem rede não tem.
         *
         * Mas a recusa ESPECÍFICA da Wi-Fi continua valendo mais que a
         * genérica: "associada e sem IPv4" é um diagnóstico, e perdê-lo dentro
         * do [redeParaServir] trocaria uma pista por uma frase de cartilha.
         * Por isso ela é consultada aqui — e só o "sem Wi-Fi" cru, que é o caso
         * NORMAL de quem vai usar o ponto de acesso, cede lugar.
         */
        @JvmStatic
        fun motivoSemRede(ctx: Context): String {
            val daWifi = try {
                redeDaWifi(ctx); null
            } catch (e: Recusa) {
                e.message
            } catch (e: Exception) {
                null
            }
            if (daWifi != null && !daWifi.startsWith("sem Wi-Fi")) return daWifi
            return "sem rede para transmitir — ligue o ponto de acesso deste celular," +
                " ou entre numa Wi-Fi (nao precisa de internet)"
        }

        /**
         * A leitura crua das interfaces, entregue à regra pura.
         *
         * **`try/catch` POR INTERFACE**, e não um em volta do laço: `isUp()`
         * lança sozinho em builds OEM (há relatos de `SocketException` no
         * Android 11), e uma interface ilegível não pode levar junto a leitura
         * das outras — inclusive a do ponto de acesso, que é a que interessa.
         */
        @JvmStatic
        fun lerInterfaces(ctx: Context): EspelhoInterfaces.Leitura {
            val brutas = ArrayList<EspelhoInterfaces.Bruta>()
            val e = NetworkInterface.getNetworkInterfaces()
                ?: return EspelhoInterfaces.Leitura(emptyList(), emptyList())
            while (e.hasMoreElements()) {
                val ni = e.nextElement() ?: continue
                try {
                    brutas.add(
                        EspelhoInterfaces.Bruta(
                            nome = ni.name ?: "",
                            noAr = ni.isUp,
                            loopback = ni.isLoopback,
                            pontoAPonto = ni.isPointToPoint,
                            ipv4 = ni.inetAddresses.toList()
                                .filterIsInstance<Inet4Address>()
                                .mapNotNull { it.hostAddress },
                        ),
                    )
                } catch (ex: Exception) {
                    Log.w(TAG, "interface ilegível: ${ni.name}", ex)
                }
            }
            return EspelhoInterfaces.escolher(brutas, reivindicadas(ctx))
        }

        /**
         * Nome da interface → quem a reivindica, do `ConnectivityManager`.
         *
         * É o segundo argumento do discriminador: uma interface que o sistema
         * conhece é uma rede que este aparelho USA, e o ponto de acesso é, por
         * construção, uma que ele SERVE. `getInterfaceName()` é API pública
         * desde a 21.
         */
        @Suppress("DEPRECATION")
        private fun reivindicadas(ctx: Context): Map<String, String> {
            val cm = ctx.applicationContext.getSystemService(ConnectivityManager::class.java)
                ?: return emptyMap()
            val mapa = HashMap<String, String>()
            for (n in cm.allNetworks) {
                val nome = cm.getLinkProperties(n)?.interfaceName ?: continue
                mapa[nome] = rotuloDe(cm.getNetworkCapabilities(n))
            }
            return mapa
        }

        /** O rótulo que entra no motivo da recusa, para o Registro ser legível. */
        private fun rotuloDe(caps: NetworkCapabilities?): String = when {
            caps == null -> "uma rede do sistema"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN) -> "uma VPN"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "a rede celular"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "a Wi-Fi"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "a Ethernet"
            else -> "uma rede do sistema"
        }

        /**
         * `"192.168.43.1"` → [Inet4Address], **montado byte a byte**.
         *
         * `getByName` sobre um literal também não resolveria nada, mas montar o
         * endereço à mão tira o resolvedor do caminho por construção — e este é
         * o valor que vai virar o bind do servidor.
         */
        private fun ipv4Literal(ip: String): Inet4Address? {
            val partes = ip.split('.')
            if (partes.size != 4) return null
            val bytes = ByteArray(4)
            for (i in 0..3) {
                val n = partes[i].toIntOrNull() ?: return null
                if (n < 0 || n > 255) return null
                bytes[i] = n.toByte()
            }
            return try {
                InetAddress.getByAddress(bytes) as? Inet4Address
            } catch (e: Exception) {
                null
            }
        }

        /**
         * O que a varredura de interfaces viu, **em JSON e sem uma frase**.
         *
         * É a única forma de diagnosticar a distância um nome de interface de
         * fabricante: sem ela, "não achou o ponto de acesso" num aparelho que
         * está com ele ligado não tem pista nenhuma. Quem monta o parágrafo é o
         * `controle.js`, como todo o resto do Registro.
         */
        @JvmStatic
        fun interfacesJson(ctx: Context): JSONObject {
            val o = JSONObject()
            val achados = JSONArray()
            val recusadas = JSONArray()
            try {
                val l = lerInterfaces(ctx)
                for (a in l.achados) {
                    achados.put(
                        JSONObject().put("nome", a.nome).put("ip", a.ip)
                            .put("tipo", a.tipo.name),
                    )
                }
                for (r in l.recusadas) {
                    recusadas.put(JSONObject().put("nome", r.nome).put("motivo", r.motivo))
                }
            } catch (e: Exception) {
                o.put("erro", e.message ?: "falha lendo as interfaces")
            }
            return o.put("achados", achados).put("recusadas", recusadas)
        }
    }
}
