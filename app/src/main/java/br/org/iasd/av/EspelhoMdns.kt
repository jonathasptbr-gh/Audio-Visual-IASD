package br.org.iasd.av

import android.content.Context
import android.net.wifi.WifiManager
import android.util.Log
import java.net.DatagramPacket
import java.net.Inet4Address
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.MulticastSocket
import java.net.NetworkInterface

/**
 * O NOME NA REDE LOCAL: `av.local` responde pelo IP do celular.
 *
 * ## Por que isto existe, quando o Android já tem `NsdManager`
 *
 * `NsdManager.registerService` publica um **serviço** (`nome._http._tcp.local`)
 * e usa o hostname mDNS do próprio aparelho no registro de endereço. Não há API
 * para reivindicar um NOME. E um serviço anunciado não resolve o problema do
 * operador, que é **digitar** algo curto na barra de endereços de uma TV — para
 * isso o que precisa existir é um registro **A**, e é ele que este arquivo
 * publica. São ~200 linhas de Kotlin puro, sem dependência, e a metade
 * perigosa (o parser) mora em [EspelhoMdnsPacote], que é pura e tem JUnit.
 *
 * ## As duas coisas que ele NÃO conserta, e que precisam estar ditas
 *
 * 1. **A porta continua na URL.** Portas abaixo de 1024 são privilegiadas no
 *    Linux e um app Android não tem como reivindicá-las — `ServerSocket(80)`
 *    devolve `Permission denied`, e não existe permissão que destrave isso. O
 *    endereço curto é `http://av.local:8787`, nunca `http://av.local`.
 * 2. **Nem toda tela resolve `.local`.** Windows 10+, macOS, iOS e Linux com
 *    avahi sim; **o Chrome do Android e o WebView não** (o resolvedor do sistema
 *    não faz mDNS para apps), e as Smart TVs variam. Por isso o **IP continua
 *    sendo divulgado ao lado do nome**, e não no lugar dele: para metade das
 *    telas ele é o que funciona. Um recurso que substitui o caminho que
 *    funciona pelo que talvez funcione é uma regressão com cara de melhoria.
 *
 * ## A sondagem não é burocracia
 *
 * Reivindicar um nome que já é de outro aparelho quebra a rede de quem estava
 * lá primeiro — e numa igreja com um Chromecast, uma impressora e um notebook,
 * isso não é hipotético. Antes de anunciar, [ligar] sonda três vezes; se
 * qualquer resposta citar o nome, ele é abandonado e o espelho segue com o IP,
 * que nunca deixou de funcionar. O operador vê a frase no Registro.
 */
object EspelhoMdns {

    private const val TAG = "EspelhoMdns"

    /** O nome reivindicado. Sem ponto final: quem o codifica é o pacote. */
    const val NOME = "av.local"

    /** TTL dos registros, em segundos. É o valor da RFC 6762 para endereços. */
    private const val TTL = 120

    /** Sondagens antes de reivindicar, e a espera entre elas (RFC 6762: 250 ms). */
    private const val SONDAS = 3
    private const val ESPERA_SONDA_MS = 250L

    /** Anúncios gratuitos ao assumir o nome — o primeiro pacote pode se perder. */
    private const val ANUNCIOS = 3
    private const val ESPERA_ANUNCIO_MS = 1000L

    private const val MTU = 1500

    @Volatile private var socket: MulticastSocket? = null
    @Volatile private var lock: WifiManager.MulticastLock? = null
    @Volatile private var ip: ByteArray? = null
    @Volatile private var vivo = false

    /** O nome está NO AR? `false` também quando alguém já o tinha. */
    @Volatile var noAr = false
        private set

    /** Por que não está no ar, em texto — vazio quando está. */
    @Volatile var erro = ""
        private set

    /** O endereço curto para divulgar, ou vazio quando o nome não subiu. */
    fun endereco(porta: Int): String = if (noAr) "http://$NOME:$porta" else ""

    /**
     * Sobe o respondedor. Devolve `true` se o nome foi reivindicado.
     *
     * Nunca lança: um nome que não sobe é um recurso a menos, e derrubar o
     * espelho por causa dele seria trocar o que funciona pelo que é opcional.
     */
    @Synchronized
    fun ligar(app: Context, ipv4: Inet4Address): Boolean {
        desligar()
        erro = ""
        noAr = false
        val bytes = ipv4.address
        if (bytes == null || bytes.size != 4) { erro = "sem IPv4 da Wi-Fi"; return false }
        try {
            // SEM O MulticastLock O ANDROID NÃO ENTREGA O PACOTE. O Wi-Fi
            // descarta multicast que não seja para este aparelho para economizar
            // bateria, e o filtro é do driver: o socket abre, o `join` funciona,
            // e o `receive` simplesmente nunca volta. É o mesmo modo de falhar
            // do `onPermissionRequest` — tudo "certo", nada acontece.
            // A permissão CHANGE_WIFI_MULTICAST_STATE já está no manifest: ela é
            // pré-requisito do serviço `connectedDevice` do espelho.
            val wm = app.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
            lock = wm.createMulticastLock("av-mdns").apply {
                setReferenceCounted(false)
                acquire()
            }
            val s = MulticastSocket(EspelhoMdnsPacote.PORTA)
            // `reuseAddress` porque somos o SEGUNDO respondedor no aparelho: o
            // próprio Android roda um (o do NsdManager). Sem isto o bind falha
            // com "endereço em uso" em qualquer celular moderno.
            s.reuseAddress = true
            s.timeToLive = 255                 // RFC 6762 §11: mDNS usa TTL 255
            val grupo = InetAddress.getByName(EspelhoMdnsPacote.GRUPO)
            val nic = interfaceDe(ipv4)
            if (nic != null) s.joinGroup(InetSocketAddress(grupo, EspelhoMdnsPacote.PORTA), nic)
            else s.joinGroup(grupo)
            socket = s
            ip = bytes
        } catch (e: Exception) {
            Log.w(TAG, "não deu para abrir o mDNS", e)
            erro = "nao foi possivel abrir o mDNS: ${e.message}"
            desligar()
            return false
        }

        // A SONDAGEM É SÍNCRONA e curta (3 × 250 ms), porque o resultado dela
        // decide o que o operador vê escrito na folha no segundo seguinte.
        if (nomeJaEDeOutro()) {
            erro = "o nome $NOME ja e de outro aparelho na rede"
            desligar()
            return false
        }

        vivo = true
        noAr = true
        Thread({ ouvir() }, "av-mdns-ouvir").apply { isDaemon = true }.start()
        Thread({ anunciar() }, "av-mdns-anuncio").apply { isDaemon = true }.start()
        return true
    }

    @Synchronized
    fun desligar() {
        val s = socket
        // A DESPEDIDA É UM ANÚNCIO COM TTL ZERO, e ela é o mesmo princípio do
        // quadro `adeus` do espelho: sem ela, a tela guarda o nome por dois
        // minutos e continua tentando um IP que não atende mais — o que se lê
        // como "às vezes funciona, às vezes não".
        if (vivo && s != null) {
            try { enviar(s, EspelhoMdnsPacote.resposta(NOME, ip ?: ByteArray(4), 0)) } catch (_: Exception) {}
        }
        vivo = false
        noAr = false
        socket = null
        ip = null
        try { s?.close() } catch (_: Exception) {}
        try { lock?.release() } catch (_: Exception) {}
        lock = null
    }

    // ---------- internos ----------

    private fun nomeJaEDeOutro(): Boolean {
        val s = socket ?: return false
        val buf = ByteArray(MTU)
        return try {
            val antes = s.soTimeout
            s.soTimeout = ESPERA_SONDA_MS.toInt()
            var achou = false
            for (i in 0 until SONDAS) {
                enviar(s, EspelhoMdnsPacote.sonda(NOME))
                val ate = System.currentTimeMillis() + ESPERA_SONDA_MS
                while (System.currentTimeMillis() < ate && !achou) {
                    val p = DatagramPacket(buf, buf.size)
                    try { s.receive(p) } catch (_: Exception) { break }
                    if (EspelhoMdnsPacote.respondePor(p.data, p.length, NOME)) achou = true
                }
                if (achou) break
            }
            s.soTimeout = antes
            achou
        } catch (e: Exception) {
            Log.w(TAG, "sondagem falhou", e)
            false
        }
    }

    private fun anunciar() {
        val meu = ip ?: return
        for (i in 0 until ANUNCIOS) {
            val s = socket
            if (!vivo || s == null) return
            try { enviar(s, EspelhoMdnsPacote.resposta(NOME, meu, TTL)) } catch (_: Exception) {}
            try { Thread.sleep(ESPERA_ANUNCIO_MS) } catch (_: InterruptedException) { return }
        }
    }

    private fun ouvir() {
        val buf = ByteArray(MTU)
        while (vivo) {
            val s = socket ?: return
            val p = DatagramPacket(buf, buf.size)
            try {
                s.receive(p)
            } catch (e: Exception) {
                if (vivo) Log.w(TAG, "recepção mDNS parou", e)
                return
            }
            val meu = ip ?: return
            val perguntas = EspelhoMdnsPacote.perguntas(p.data, p.length)
            var responder = false
            var unicast = false
            for (q in perguntas) {
                if (!q.nome.equals(NOME, ignoreCase = true)) continue
                if (q.tipo != EspelhoMdnsPacote.TIPO_A && q.tipo != EspelhoMdnsPacote.TIPO_ANY) continue
                responder = true
                if (q.unicast) unicast = true
            }
            if (!responder) continue
            val resp = EspelhoMdnsPacote.resposta(NOME, meu, TTL)
            try {
                if (unicast) {
                    // O bit `QU` da pergunta pede unicast — honrá-lo poupa o
                    // rádio de todo mundo na sala. O endereço é o de quem
                    // perguntou, não o grupo.
                    s.send(DatagramPacket(resp, resp.size, p.address, p.port))
                } else {
                    enviar(s, resp)
                }
            } catch (e: Exception) {
                Log.w(TAG, "não deu para responder", e)
            }
        }
    }

    private fun enviar(s: MulticastSocket, dados: ByteArray) {
        val grupo = InetAddress.getByName(EspelhoMdnsPacote.GRUPO)
        s.send(DatagramPacket(dados, dados.size, grupo, EspelhoMdnsPacote.PORTA))
    }

    /**
     * A INTERFACE É A DA WI-FI, e não a que o sistema escolher.
     *
     * `joinGroup` sem interface entra pelo caminho padrão da tabela de rotas —
     * que num celular com dados móveis ligados pode ser o `rmnet`. É a mesma
     * armadilha que o `EspelhoServidor` documenta para o `ServerSocket`, com o
     * agravante de aqui não haver ninguém do outro lado para reclamar: o
     * anúncio simplesmente sai pela rede errada e o nome nunca aparece.
     */
    private fun interfaceDe(ipv4: Inet4Address): NetworkInterface? = try {
        NetworkInterface.getNetworkInterfaces().toList().firstOrNull { nic ->
            nic.inetAddresses.toList().any { it.hostAddress == ipv4.hostAddress }
        }
    } catch (_: Exception) { null }
}
