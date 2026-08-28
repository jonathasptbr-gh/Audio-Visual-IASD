package br.org.iasd.av

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * ONDE O SERVIDOR DO TELÃO PODE ABRIR UM SOCKET.
 *
 * Este é o arquivo que decide a que rede a primeira fronteira do projeto se
 * expõe, e os dois modos de errar são opostos e igualmente caros:
 *
 * - **fechado demais** — o operador liga o ponto de acesso, o app não o acha e
 *   diz "sem Wi-Fi" com o hotspot ligado na frente dele;
 * - **aberto demais** — o socket sobe numa interface que não é a que ele
 *   pensa. O caso concreto não é hipótese: o Group Owner do Wi-Fi Direct serve
 *   `192.168.49.1` — privado, no ar, sem `Network` que o reivindique, a forma
 *   EXATA que a regra procura — e está no ar durante **todo culto com
 *   Miracast**.
 *
 * Por isso os casos vêm em PARES: o que a regra passou a aceitar, e o que ela
 * não pode ter aceitado junto. Sem a segunda metade, "aceita qualquer coisa
 * com IPv4 privado" passaria em todos os testes da primeira.
 */
class EspelhoInterfacesTest {

    private fun iface(
        nome: String,
        vararg ipv4: String,
        noAr: Boolean = true,
        loopback: Boolean = false,
        pontoAPonto: Boolean = false,
    ) = EspelhoInterfaces.Bruta(nome, noAr, loopback, pontoAPonto, ipv4.toList())

    private fun ler(
        vararg brutas: EspelhoInterfaces.Bruta,
        reivindicadas: Map<String, String> = emptyMap(),
    ) = EspelhoInterfaces.escolher(brutas.toList(), reivindicadas)

    private fun ips(leitura: EspelhoInterfaces.Leitura) = leitura.achados.map { it.ip }

    private fun motivo(leitura: EspelhoInterfaces.Leitura, nome: String) =
        leitura.recusadas.first { it.nome == nome }.motivo

    // ---- o que ENTRA ----

    @Test
    fun `os quatro nomes de soft AP entram, com o IP deles`() {
        // Os três primeiros são nomes de fabricante para o downstream do
        // tethering; o quarto é o Android 11+, que SORTEIA a barra 24.
        assertEquals(listOf("192.168.43.1"), ips(ler(iface("ap0", "192.168.43.1"))))
        assertEquals(listOf("192.168.43.1"), ips(ler(iface("swlan0", "192.168.43.1"))))
        assertEquals(listOf("192.168.174.1"), ips(ler(iface("wlan1", "192.168.174.1"))))
        assertEquals(listOf("192.168.43.1"), ips(ler(iface("uap0", "192.168.43.1"))))
    }

    @Test
    fun `wlan0 NAO reivindicada e o soft AP de quem reusa a interface`() {
        val l = ler(iface("wlan0", "192.168.43.1"))
        assertEquals(listOf("192.168.43.1"), ips(l))
        assertEquals(EspelhoInterfaces.Tipo.PONTO_DE_ACESSO, l.achados[0].tipo)
    }

    // ---- o PAR de cada um: o que NÃO pode ter entrado junto ----

    @Test
    fun `wlan0 REIVINDICADA e a Wi-Fi que o aparelho usa, nao a que ele serve`() {
        // Este é o par do teste acima, e é a linha inteira do discriminador:
        // o MESMO nome, o mesmo estado, e o desfecho oposto — porque o
        // ConnectivityManager conhece esta e não conhece aquela.
        val l = ler(
            iface("wlan0", "192.168.1.50"),
            reivindicadas = mapOf("wlan0" to "wifi"),
        )
        assertTrue(ips(l).isEmpty())
        assertEquals("reivindicada por wifi", motivo(l, "wlan0"))
    }

    @Test
    fun `o rmnet com IPv4 PRIVADO so e recusado pela familia`() {
        // O caso que prova por que a denylist de família existe: um CGNAT de
        // operadora entrega `10/8` ao chip, o filtro de RFC1918 o APROVA, e
        // nenhum `Network` precisa reivindicá-lo para ele estar ali.
        val l = ler(iface("rmnet_data0", "10.20.30.40"))
        assertTrue(ips(l).isEmpty())
        assertTrue(motivo(l, "rmnet_data0").startsWith("familia rmnet"))
    }

    @Test
    fun `o rmnet com CGNAT tambem sai — e por dois motivos independentes`() {
        val l = ler(iface("rmnet_data0", "100.64.3.7"))
        assertTrue(ips(l).isEmpty())
        // A família responde primeiro; o 100.64/10 estaria fora da RFC1918 de
        // qualquer jeito. As duas defesas são de propósito.
        assertFalse(EspelhoInterfaces.ehPrivado("100.64.3.7"))
    }

    @Test
    fun `o Group Owner do Wi-Fi Direct e recusado — ele tem a forma EXATA que a regra procura`() {
        // `192.168.49.1`: privado, no ar, e nenhum `Network` o reivindica.
        // Sem a família `p2p` na denylist, o servidor subiria no fio do dongle
        // durante todo culto com Miracast, e nenhuma tela da rede o alcançaria.
        val l = ler(iface("p2p-wlan0-0", "192.168.49.1"))
        assertTrue(ips(l).isEmpty())
        assertTrue(motivo(l, "p2p-wlan0-0").startsWith("familia p2p"))
    }

    @Test
    fun `a VPN e recusada mesmo com IPv4 privado`() {
        val l = ler(iface("tun0", "10.8.0.2"))
        assertTrue(ips(l).isEmpty())
        assertTrue(motivo(l, "tun0").startsWith("familia tun"))
    }

    @Test
    fun `loopback, fora do ar, ponto-a-ponto e sem IPv4 saem com o motivo de cada um`() {
        val l = ler(
            iface("lo", "127.0.0.1", loopback = true),
            iface("ap0", "192.168.43.1", noAr = false),
            iface("ppp-x", "10.0.0.2", pontoAPonto = true),
            iface("swlan0"),
        )
        assertTrue(ips(l).isEmpty())
        assertEquals("loopback", motivo(l, "lo"))
        assertEquals("fora do ar", motivo(l, "ap0"))
        assertEquals("ponto-a-ponto", motivo(l, "ppp-x"))
        assertEquals("sem IPv4", motivo(l, "swlan0"))
    }

    @Test
    fun `IPv4 publico numa interface aceitavel e recusado`() {
        val l = ler(iface("ap0", "8.8.8.8"))
        assertTrue(ips(l).isEmpty())
        assertEquals("IPv4 fora de RFC1918", motivo(l, "ap0"))
    }

    // ---- classificação: ela SEPARA, e o chamador decide ----

    @Test
    fun `o cabo entra na leitura, mas NUNCA como ponto de acesso`() {
        // Ele não é recusado — a regra classifica e não faz política —, e é
        // exatamente por isso que o tipo precisa estar certo: quem admite só
        // PONTO_DE_ACESSO é o chamador, e um `eth0` classificado errado
        // colocaria o socket num dock.
        val l = ler(iface("eth0", "192.168.0.9"))
        assertEquals(1, l.achados.size)
        assertEquals(EspelhoInterfaces.Tipo.CABO, l.achados[0].tipo)
    }

    @Test
    fun `o desconhecido sobrevive como DESCONHECIDO, nunca promovido`() {
        val l = ler(iface("bond0", "192.168.5.5"))
        assertEquals(EspelhoInterfaces.Tipo.DESCONHECIDO, l.achados[0].tipo)
    }

    @Test
    fun `a ORDEM poe o ponto de acesso na frente do cabo`() {
        // O chamador serve o PRIMEIRO da lista. Enumerado depois, o `ap0`
        // ainda tem de vir antes — senão um dock ganharia do hotspot.
        val l = ler(iface("eth0", "192.168.0.9"), iface("ap0", "192.168.43.1"))
        assertEquals(listOf("192.168.43.1", "192.168.0.9"), ips(l))
    }

    // ---- ehPrivado, nas bordas ----

    @Test
    fun `RFC1918 nas bordas, e o 172 so na faixa dele`() {
        assertTrue(EspelhoInterfaces.ehPrivado("10.0.0.1"))
        assertTrue(EspelhoInterfaces.ehPrivado("192.168.0.1"))
        assertTrue(EspelhoInterfaces.ehPrivado("172.16.0.1"))
        assertTrue(EspelhoInterfaces.ehPrivado("172.31.255.254"))
        // O par: os vizinhos da faixa do 172 são PÚBLICOS, e um `in 16..31`
        // escrito como `>= 16` os aceitaria.
        assertFalse(EspelhoInterfaces.ehPrivado("172.15.0.1"))
        assertFalse(EspelhoInterfaces.ehPrivado("172.32.0.1"))
        assertFalse(EspelhoInterfaces.ehPrivado("11.0.0.1"))
        assertFalse(EspelhoInterfaces.ehPrivado("192.169.0.1"))
        // Lixo não vira endereço privado por engano.
        assertFalse(EspelhoInterfaces.ehPrivado(""))
        assertFalse(EspelhoInterfaces.ehPrivado("10.0.0"))
        assertFalse(EspelhoInterfaces.ehPrivado("10.0.0.x"))
        assertFalse(EspelhoInterfaces.ehPrivado("10.0.0.300"))
    }

    // ---- o cenário inteiro, como o aparelho o entrega ----

    @Test
    fun `com hotspot ligado e Miracast no ar, sobra UMA interface`() {
        // A leitura real de um culto: chip da operadora, o fio do dongle, o
        // loopback, e o ponto de acesso. Só o último pode receber o socket.
        val l = ler(
            iface("lo", "127.0.0.1", loopback = true),
            iface("rmnet_data0", "10.20.30.40"),
            iface("p2p-wlan0-0", "192.168.49.1"),
            iface("ap0", "192.168.43.1"),
            reivindicadas = mapOf("rmnet_data0" to "celular"),
        )
        assertEquals(listOf("192.168.43.1"), ips(l))
        assertEquals(EspelhoInterfaces.Tipo.PONTO_DE_ACESSO, l.achados[0].tipo)
        assertEquals(3, l.recusadas.size)
    }
}
