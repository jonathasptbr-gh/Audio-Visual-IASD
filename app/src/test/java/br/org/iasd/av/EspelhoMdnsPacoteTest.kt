package br.org.iasd.av

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * O oráculo do fio do mDNS.
 *
 * Ele existe pela mesma razão do `EspelhoHttpTest`: este é o segundo ponto do
 * projeto que aceita bytes de um desconhecido, e o único jeito de ter oráculo
 * sobre um parser é ele ser puro. A diferença é o que dá errado — no HTTP um
 * erro vira controle de acesso quebrado; aqui vira **laço infinito**, porque
 * ponteiros de compressão de DNS são um grafo e podem apontar para trás.
 */
class EspelhoMdnsPacoteTest {

    private fun consulta(nome: String, tipo: Int = 1, unicast: Boolean = false): ByteArray {
        val rotulos = nome.split('.').filter { it.isNotEmpty() }
        var n = 12 + 1 + 4
        for (r in rotulos) n += 1 + r.length
        val b = ByteArray(n)
        b[5] = 1                                  // QDCOUNT = 1
        var p = 12
        for (r in rotulos) {
            b[p++] = r.length.toByte()
            for (c in r) b[p++] = c.code.toByte()
        }
        b[p++] = 0
        b[p++] = 0; b[p++] = tipo.toByte()
        val classe = if (unicast) 0x8001 else 0x0001
        b[p++] = ((classe ushr 8) and 0xFF).toByte(); b[p] = (classe and 0xFF).toByte()
        return b
    }

    @Test
    fun leAPerguntaSimples() {
        val q = consulta("av.local")
        val fora = EspelhoMdnsPacote.perguntas(q, q.size)
        assertEquals(1, fora.size)
        assertEquals("av.local", fora[0].nome)
        assertEquals(EspelhoMdnsPacote.TIPO_A, fora[0].tipo)
        assertFalse(fora[0].unicast)
    }

    @Test
    fun honraOBitDeUnicast() {
        val q = consulta("av.local", unicast = true)
        assertTrue(EspelhoMdnsPacote.perguntas(q, q.size)[0].unicast)
    }

    /** Uma RESPOSTA não é uma pergunta — responder a ela seria uma tempestade. */
    @Test
    fun respostaNaoViraPergunta() {
        val q = consulta("av.local")
        q[2] = 0x84.toByte()                       // QR = 1
        assertTrue(EspelhoMdnsPacote.perguntas(q, q.size).isEmpty())
    }

    @Test
    fun datagramaTruncadoNaoQuebra() {
        val q = consulta("av.local")
        for (t in 0 until q.size) {
            // Não lança, não trava: devolve o que deu para ler.
            EspelhoMdnsPacote.perguntas(q, t)
        }
    }

    /**
     * O LAÇO DE PONTEIRO — o defeito que este arquivo existe para não ter.
     *
     * Um nome cujo ponteiro de compressão aponta para si mesmo faz um parser
     * ingênuo rodar para sempre, com um datagrama de dezoito bytes vindo da
     * rede. O teto de saltos é o que o impede.
     */
    @Test(timeout = 2000)
    fun ponteiroEmLacoNaoTrava() {
        val b = ByteArray(20)
        b[5] = 1
        b[12] = 0xC0.toByte(); b[13] = 12          // aponta para si mesmo
        assertTrue(EspelhoMdnsPacote.perguntas(b, b.size).isEmpty())
    }

    @Test(timeout = 2000)
    fun ponteiroMutuoNaoTrava() {
        val b = ByteArray(32)
        b[5] = 1
        b[12] = 0xC0.toByte(); b[13] = 14          // 12 → 14
        b[14] = 0xC0.toByte(); b[15] = 12          // 14 → 12
        assertTrue(EspelhoMdnsPacote.perguntas(b, b.size).isEmpty())
    }

    @Test
    fun ponteiroForaDoPacoteNaoLe() {
        val b = ByteArray(20)
        b[5] = 1
        b[12] = 0xC0.toByte(); b[13] = 0xFF.toByte()
        assertTrue(EspelhoMdnsPacote.perguntas(b, b.size).isEmpty())
    }

    @Test
    fun respostaTemOEnderecoEOCacheFlush() {
        val r = EspelhoMdnsPacote.resposta("av.local", byteArrayOf(192.toByte(), 168.toByte(), 3, 35), 120)
        // QR + AA
        assertEquals(0x84, r[2].toInt() and 0xFF)
        assertEquals(0, r[5].toInt())              // sem perguntas
        assertEquals(1, r[7].toInt())              // uma resposta
        // Os quatro últimos bytes são o IP.
        assertEquals(192, r[r.size - 4].toInt() and 0xFF)
        assertEquals(168, r[r.size - 3].toInt() and 0xFF)
        assertEquals(3, r[r.size - 2].toInt() and 0xFF)
        assertEquals(35, r[r.size - 1].toInt() and 0xFF)
        // CLASSE com o bit de cache-flush: sem ele, uma tela que viu o app num
        // IP anterior continuaria indo ao endereço velho até o TTL vencer.
        //
        // Os offsets são contados DO FIM, e a conta é esta — a cauda do registro
        // tem tamanho fixo (10 bytes de TYPE/CLASS/TTL/RDLENGTH + 4 de RDATA),
        // enquanto o nome no começo não tem:
        //   RDATA     size-4 .. size-1
        //   RDLENGTH  size-6 .. size-5
        //   TTL       size-10 .. size-7
        //   CLASS     size-12 .. size-11
        //   TYPE      size-14 .. size-13
        val classe = ((r[r.size - 12].toInt() and 0xFF) shl 8) or (r[r.size - 11].toInt() and 0xFF)
        assertEquals(0x8001, classe)
        val tipo = ((r[r.size - 14].toInt() and 0xFF) shl 8) or (r[r.size - 13].toInt() and 0xFF)
        assertEquals(EspelhoMdnsPacote.TIPO_A, tipo)
    }

    /** A despedida é a mesma resposta com TTL zero — ver o `adeus` do espelho. */
    @Test
    fun despedidaTemTtlZero() {
        val vivo = EspelhoMdnsPacote.resposta("av.local", ByteArray(4), 120)
        // O caso positivo primeiro: sem ele, um offset errado faria o teste da
        // despedida passar sobre bytes que são zero por acaso (o RDLENGTH alto,
        // por exemplo) — que foi exatamente o que aconteceu ao escrevê-lo.
        assertEquals(120, ttlDe(vivo))
        assertEquals(0, ttlDe(EspelhoMdnsPacote.resposta("av.local", ByteArray(4), 0)))
    }

    private fun ttlDe(r: ByteArray): Int =
        (0 until 4).fold(0) { a, i -> (a shl 8) or (r[r.size - 10 + i].toInt() and 0xFF) }

    /**
     * A SONDAGEM lê a resposta de OUTRO aparelho — e é ela que impede o app de
     * roubar um nome que já é de alguém na rede da igreja.
     */
    @Test
    fun sondaEnxergaONomeJaTomado() {
        val alheia = EspelhoMdnsPacote.resposta("av.local", byteArrayOf(10, 0, 0, 9), 120)
        assertTrue(EspelhoMdnsPacote.respondePor(alheia, alheia.size, "av.local"))
        assertFalse(EspelhoMdnsPacote.respondePor(alheia, alheia.size, "outro.local"))
    }

    @Test
    fun perguntaNaoContaComoRespostaNaSonda() {
        val q = consulta("av.local")
        assertFalse(EspelhoMdnsPacote.respondePor(q, q.size, "av.local"))
    }

    @Test(timeout = 2000)
    fun lixoAleatorioNaoQuebraNemTrava() {
        val r = java.util.Random(42)
        for (i in 0 until 2000) {
            val b = ByteArray(4 + r.nextInt(120))
            r.nextBytes(b)
            EspelhoMdnsPacote.perguntas(b, b.size)
            EspelhoMdnsPacote.respondePor(b, b.size, "av.local")
        }
    }
}
