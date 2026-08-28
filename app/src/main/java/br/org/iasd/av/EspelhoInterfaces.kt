package br.org.iasd.av

/**
 * QUAL INTERFACE DESTE APARELHO PODE RECEBER O SERVIDOR DO TELÃO.
 *
 * **ZERO import de Android, de propósito** — a mesma regra do [EspelhoHttp],
 * do [EspelhoPares] e do [EspelhoMidiaCache], e pela mesma razão: este arquivo
 * decide ONDE a primeira fronteira de rede do projeto abre um socket, e decisão
 * de acesso sem oráculo é como este projeto define dívida. Tudo aqui é
 * `String` e `List`; o adaptador que fala com o Android mora no
 * `EspelhoServidor.redeParaServir`.
 *
 * ## Por que ele existe
 *
 * [EspelhoServidor.redeDaWifi] pergunta ao `ConnectivityManager` por uma rede
 * `TRANSPORT_WIFI`, e é a pergunta certa para a igreja com Wi-Fi. Ela não tem
 * resposta quando **o próprio celular é o ponto de acesso**: o downstream do
 * tethering é montado no netd sem `NetworkAgent`, então ele **não é um
 * `Network`** — nunca foi, e sempre viveu no eixo que devolve NOME DE
 * INTERFACE (`ap0`, `swlan0`, `wlan1`). Sobra o upstream celular, que a regra
 * de lá recusa por transporte, e o operador lê *"sem Wi-Fi"* com o ponto de
 * acesso ligado na frente dele.
 *
 * ## O DISCRIMINADOR NÃO É O NOME — e é isso que faz a regra durar
 *
 * A pergunta é *"que interface está no ar, com IPv4 privado, e que NENHUM
 * `Network` reivindica?"*. A do soft AP é, por construção, a única com essa
 * forma: **não é uma rede que este aparelho USA, é uma que ele SERVE**, e por
 * isso o ConnectivityManager não a conhece. O nome entra só na CLASSIFICAÇÃO,
 * depois de três filtros independentes — porque nome de interface é o que cada
 * fabricante muda sem avisar, e **aqui não há OTA que conserte: isto é Kotlin**.
 *
 * Daí a forma das recusas: uma **denylist de FAMÍLIA** que elimina o que nunca
 * é ponto de acesso, e não uma allowlist de nomes que precisaria adivinhar o
 * próximo OEM. Falhar FECHADO é o contrato — nome desconhecido custa o recurso
 * e uma frase, nunca um socket no lugar errado.
 *
 * ## ELA CLASSIFICA; ELA NÃO FILTRA POR POLÍTICA
 *
 * [escolher] devolve tudo que sobrou, com o [Tipo] de cada um. Quem decide
 * admitir só [Tipo.PONTO_DE_ACESSO] é o CHAMADOR — uma linha visível no
 * `EspelhoServidor`, e não um efeito colateral da ordem desta enumeração.
 */
object EspelhoInterfaces {

    /** O que a interface É, depois de passar por todas as recusas. */
    enum class Tipo {
        /** Ponto de acesso deste aparelho: o que este lote existe para achar. */
        PONTO_DE_ACESSO,

        /** Ethernet, USB tethering, dock. Servível em tese; não é este lote. */
        CABO,

        /** Sobreviveu às recusas e não se parece com nada conhecido. */
        DESCONHECIDO,
    }

    /**
     * A leitura CRUA de uma interface, como o `java.net.NetworkInterface` a
     * entrega — e nada além disso, para este arquivo continuar puro.
     */
    data class Bruta(
        val nome: String,
        val noAr: Boolean,
        val loopback: Boolean,
        val pontoAPonto: Boolean,
        val ipv4: List<String>,
    )

    /** Uma interface que pode receber o socket, e o que ela parece ser. */
    data class Achado(val nome: String, val ip: String, val tipo: Tipo)

    /** Uma interface recusada, com o motivo VERBATIM para o Registro. */
    data class Recusada(val nome: String, val motivo: String)

    /** As duas metades: o que passou e por que o resto não passou. */
    data class Leitura(val achados: List<Achado>, val recusadas: List<Recusada>)

    /**
     * FAMÍLIAS QUE NUNCA SÃO PONTO DE ACESSO, recusadas pelo prefixo do nome.
     *
     * Cada uma está aqui por um motivo que um filtro genérico NÃO pega:
     *
     * - `rmnet`/`ccmni`/`pdp`/`v4-rmnet`/`clat` — o rádio da operadora. Um chip
     *   pode receber IPv4 **privado** por CGNAT do provedor, então o filtro de
     *   RFC1918 o aprova: só a família o recusa. É o caso que prova por que
     *   esta lista existe.
     * - `tun`/`ppp`/`ipsec`/`wg` — VPN. Um socket ali sai do prédio.
     * - `p2p` — **o Group Owner do Wi-Fi Direct serve `192.168.49.1`**: IPv4
     *   privado, no ar, e sem `Network` que o reivindique — a forma EXATA que
     *   esta regra procura. Ele está no ar durante todo culto com Miracast, e
     *   sem esta linha o servidor subiria no fio do dongle, onde nenhuma tela
     *   da rede o alcança.
     * - `sit`/`dummy` — túneis e interfaces sintéticas do kernel.
     */
    private val FAMILIAS_RECUSADAS = listOf(
        "rmnet", "ccmni", "pdp", "v4-rmnet", "clat",
        "tun", "ppp", "ipsec", "wg",
        "p2p",
        "sit", "dummy",
    )

    /** Nomes que um fabricante dá ao downstream do tethering Wi-Fi. */
    private val FAMILIAS_AP = listOf("ap", "softap", "swlan", "uap")

    /** Ethernet, USB tethering e docks. */
    private val FAMILIAS_CABO = listOf("eth", "usb", "rndis", "ncm")

    /**
     * A LEITURA INTEIRA: o que serve, o que não serve, e por quê.
     *
     * @param brutas o que o sistema enumerou, sem filtro nenhum.
     * @param reivindicadas nome da interface → rótulo de quem a reivindica
     *   (`cm.allNetworks` × `LinkProperties.getInterfaceName()`). É o filtro que
     *   separa a Wi-Fi que este aparelho USA da que ele SERVE.
     */
    fun escolher(brutas: List<Bruta>, reivindicadas: Map<String, String>): Leitura {
        val achados = ArrayList<Achado>()
        val recusadas = ArrayList<Recusada>()

        for (b in brutas) {
            val nome = b.nome.lowercase()
            // A ORDEM É CONTRATO: ela decide qual motivo o Registro imprime
            // quando mais de um se aplica, e é o motivo que diz a quem lê a
            // distância se o defeito é nosso ou do aparelho.
            if (!b.noAr) { recusadas.add(Recusada(b.nome, "fora do ar")); continue }
            if (b.loopback) { recusadas.add(Recusada(b.nome, "loopback")); continue }
            if (b.pontoAPonto) { recusadas.add(Recusada(b.nome, "ponto-a-ponto")); continue }

            val familia = FAMILIAS_RECUSADAS.firstOrNull { nome.startsWith(it) }
            if (familia != null) {
                recusadas.add(Recusada(b.nome, "familia $familia nunca e ponto de acesso"))
                continue
            }

            val dono = reivindicadas[b.nome] ?: reivindicadas[nome]
            if (dono != null) {
                recusadas.add(Recusada(b.nome, "reivindicada por $dono"))
                continue
            }

            if (b.ipv4.isEmpty()) { recusadas.add(Recusada(b.nome, "sem IPv4")); continue }
            val privados = b.ipv4.filter { ehPrivado(it) }
            if (privados.isEmpty()) {
                recusadas.add(Recusada(b.nome, "IPv4 fora de RFC1918"))
                continue
            }

            val tipo = classificar(nome)
            for (ip in privados) achados.add(Achado(b.nome, ip, tipo))
        }

        // PONTO DE ACESSO PRIMEIRO. `sortedBy` é estável em Kotlin, então a
        // ordem de enumeração do sistema sobrevive dentro de cada tipo.
        return Leitura(achados.sortedBy { it.tipo.ordinal }, recusadas)
    }

    /**
     * O NOME, e só depois de três filtros independentes.
     *
     * `wlan` sem dígito (o `wlan0` de sempre) só chega aqui quando NENHUM
     * `Network` o reivindica — e uma `wlan0` no ar, com IPv4 privado e que o
     * ConnectivityManager não conhece é o soft AP de um aparelho que reusa a
     * mesma interface para servir.
     */
    fun classificar(nomeCru: String): Tipo {
        val nome = nomeCru.lowercase()
        if (FAMILIAS_AP.any { nome.startsWith(it) }) return Tipo.PONTO_DE_ACESSO
        if (nome.startsWith("wlan")) return Tipo.PONTO_DE_ACESSO
        if (FAMILIAS_CABO.any { nome.startsWith(it) }) return Tipo.CABO
        return Tipo.DESCONHECIDO
    }

    /**
     * RFC1918, e **só** ela: `10/8`, `172.16/12`, `192.168/16`.
     *
     * O CGNAT (`100.64/10`) fica de fora DE PROPÓSITO: ele é endereço de
     * operadora, não de rede local, e aceitá-lo abriria a porta exatamente onde
     * o KDoc do [EspelhoServidor] diz que ela não pode abrir.
     */
    fun ehPrivado(ip: String): Boolean {
        val partes = ip.split('.')
        if (partes.size != 4) return false
        val n = partes.map { it.toIntOrNull() ?: return false }
        if (n.any { it < 0 || it > 255 }) return false
        return when {
            n[0] == 10 -> true
            n[0] == 172 && n[1] in 16..31 -> true
            n[0] == 192 && n[1] == 168 -> true
            else -> false
        }
    }
}
