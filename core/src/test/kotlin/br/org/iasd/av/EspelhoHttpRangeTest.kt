package br.org.iasd.av

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayInputStream

/**
 * RANGE E SSE — as fundações puras da E1 do telão por comandos
 * (`docs/TELAO-POR-COMANDOS.md` §6). Este servidor é a fronteira de rede do
 * projeto, e a rota de mídia é o primeiro lugar dele em que um byte no
 * deslocamento errado vira mídia corrompida SEM erro em lado nenhum — a
 * invariante 8 ao contrário, com as consequências dela.
 *
 * A doutrina do RFC 7233 que estes casos travam, porque inverter qualquer
 * metade quebra um player legítimo: **malformado é IGNORADO** (200 inteiro —
 * um 400 aqui derrubaria um `<video>` que tinha todo o direito de mandar o
 * cabeçalho), e **só a faixa sintaticamente válida que não cabe leva 416**
 * (sem o 416 o player repete o pedido impossível para sempre).
 */
class EspelhoHttpRangeTest {

    private fun parcial(a: EspelhoHttp.Alcance): EspelhoHttp.Faixa {
        assertTrue("esperava Parcial, veio $a", a is EspelhoHttp.Alcance.Parcial)
        return (a as EspelhoHttp.Alcance.Parcial).faixa
    }

    // ---------------------------------------------------------- as três formas

    @Test
    fun `sem cabecalho e o recurso inteiro`() {
        assertEquals(EspelhoHttp.Alcance.Inteiro, EspelhoHttp.alcanceDe(null, 1000))
    }

    @Test
    fun `faixa fechada`() {
        assertEquals(EspelhoHttp.Faixa(0, 499), parcial(EspelhoHttp.alcanceDe("bytes=0-499", 1000)))
        assertEquals(EspelhoHttp.Faixa(500, 999), parcial(EspelhoHttp.alcanceDe("bytes=500-999", 1000)))
    }

    @Test
    fun `faixa aberta vai ate o fim`() {
        assertEquals(EspelhoHttp.Faixa(500, 999), parcial(EspelhoHttp.alcanceDe("bytes=500-", 1000)))
        assertEquals(EspelhoHttp.Faixa(0, 999), parcial(EspelhoHttp.alcanceDe("bytes=0-", 1000)))
    }

    @Test
    fun `sufixo sao os ultimos n bytes`() {
        assertEquals(EspelhoHttp.Faixa(700, 999), parcial(EspelhoHttp.alcanceDe("bytes=-300", 1000)))
        // Sufixo maior que o recurso: o recurso inteiro, como manda o RFC.
        assertEquals(EspelhoHttp.Faixa(0, 999), parcial(EspelhoHttp.alcanceDe("bytes=-5000", 1000)))
    }

    @Test
    fun `fim alem do recurso e TRUNCADO, nunca recusado`() {
        // É a forma que players usam de verdade: pedem um bloco fixo e o
        // último bloco passa do fim. Recusar quebraria o último pedaço de
        // todo arquivo.
        assertEquals(EspelhoHttp.Faixa(900, 999), parcial(EspelhoHttp.alcanceDe("bytes=900-4999", 1000)))
    }

    @Test
    fun `a unidade ignora caixa`() {
        assertEquals(EspelhoHttp.Faixa(0, 1), parcial(EspelhoHttp.alcanceDe("Bytes=0-1", 10)))
    }

    // ------------------------------------------------------- o que leva 416

    @Test
    fun `inicio alem do fim do recurso e insatisfazivel`() {
        assertEquals(EspelhoHttp.Alcance.Insatisfazivel, EspelhoHttp.alcanceDe("bytes=1000-", 1000))
        assertEquals(EspelhoHttp.Alcance.Insatisfazivel, EspelhoHttp.alcanceDe("bytes=1000-2000", 1000))
    }

    @Test
    fun `sufixo de zero bytes e insatisfazivel`() {
        assertEquals(EspelhoHttp.Alcance.Insatisfazivel, EspelhoHttp.alcanceDe("bytes=-0", 1000))
    }

    @Test
    fun `recurso vazio nao tem faixa satisfazivel`() {
        assertEquals(EspelhoHttp.Alcance.Insatisfazivel, EspelhoHttp.alcanceDe("bytes=0-", 0))
        assertEquals(EspelhoHttp.Alcance.Insatisfazivel, EspelhoHttp.alcanceDe("bytes=-1", 0))
    }

    // -------------------------------------- o que é IGNORADO (200 inteiro)

    @Test
    fun `malformado e ignorado, nunca recusado`() {
        val casos = listOf(
            "bytes=2-1",          // início depois do fim: sem leitura certa
            "bytes=a-b",          // não-dígito
            "bytes=1a-2",         // dígito misturado
            "bytes=-",            // nem início nem fim
            "bytes=",             // vazio
            "bytes",              // sem '='
            "chars=0-1",          // unidade que não entendemos
            "bytes=0-1,5-9",      // multi-faixa: exigiria multipart/byteranges
            "bytes= 0-1",         // espaço no meio da spec da faixa
            "bytes=0 -1",
            "=0-1",               // unidade vazia
            "bytes=1234567890123456-", // 16 dígitos: estouro, não posição
        )
        for (c in casos) {
            assertEquals("'$c' devia ser ignorado", EspelhoHttp.Alcance.Inteiro, EspelhoHttp.alcanceDe(c, 1000))
        }
    }

    // ------------------------------------------------- o parser captura Range

    @Test
    fun `o parser carrega o Range cru e recusa duplicata`() {
        val req = ("GET /m/abc HTTP/1.1\r\nHost: 10.0.0.2:8787\r\n" +
            "Range: bytes=0-499\r\n\r\n")
        val r = EspelhoHttp.lerRequisicao(
            ByteArrayInputStream(req.toByteArray(Charsets.US_ASCII)),
            setOf("10.0.0.2:8787"),
        )
        assertEquals("bytes=0-499", r.getOrThrow().intervalo)

        val dup = ("GET /m/abc HTTP/1.1\r\nHost: 10.0.0.2:8787\r\n" +
            "Range: bytes=0-1\r\nRange: bytes=2-3\r\n\r\n")
        val d = EspelhoHttp.lerRequisicao(
            ByteArrayInputStream(dup.toByteArray(Charsets.US_ASCII)),
            setOf("10.0.0.2:8787"),
        )
        assertTrue(d.exceptionOrNull() is EspelhoHttp.Erro.Malformado)
    }

    @Test
    fun `sem Range o campo e nulo`() {
        val req = "GET /v HTTP/1.1\r\nHost: 10.0.0.2:8787\r\n\r\n"
        val r = EspelhoHttp.lerRequisicao(
            ByteArrayInputStream(req.toByteArray(Charsets.US_ASCII)),
            setOf("10.0.0.2:8787"),
        )
        assertEquals(null, r.getOrThrow().intervalo)
    }

    // ----------------------------------------------------------- as respostas

    private fun texto(b: ByteArray): String = String(b, Charsets.US_ASCII)

    @Test
    fun `o 206 leva Content-Range e o tamanho DA FAIXA`() {
        val cab = texto(EspelhoHttp.cabecalhoParcial("video/mp4", EspelhoHttp.Faixa(500, 999), 4000))
        assertTrue(cab.startsWith("HTTP/1.1 206 Partial Content\r\n"))
        assertTrue(cab.contains("Content-Range: bytes 500-999/4000\r\n"))
        assertTrue(cab.contains("Content-Length: 500\r\n"))
        assertTrue(cab.contains("Accept-Ranges: bytes\r\n"))
        assertTrue(cab.endsWith("\r\n\r\n"))
    }

    @Test
    fun `o 200 de conteudo anuncia Accept-Ranges`() {
        val cab = texto(EspelhoHttp.cabecalhoConteudo("video/mp4", 4000))
        assertTrue(cab.startsWith("HTTP/1.1 200 OK\r\n"))
        assertTrue(cab.contains("Content-Length: 4000\r\n"))
        assertTrue(cab.contains("Accept-Ranges: bytes\r\n"))
    }

    @Test
    fun `o 416 diz o tamanho real com asterisco`() {
        val r = texto(EspelhoHttp.resposta416(4000))
        assertTrue(r.startsWith("HTTP/1.1 416 Range Not Satisfiable\r\n"))
        assertTrue(r.contains("Content-Range: bytes */4000\r\n"))
    }

    @Test
    fun `toda resposta nova leva os cabecalhos de sempre`() {
        // A mesma promessa da suíte antiga, estendida às respostas da E1 —
        // inclusive Connection close e nosniff, que são as duas com dente.
        for (b in listOf(
            EspelhoHttp.cabecalhoParcial("video/mp4", EspelhoHttp.Faixa(0, 1), 10),
            EspelhoHttp.cabecalhoConteudo("video/mp4", 10),
            EspelhoHttp.resposta416(10),
            EspelhoHttp.cabecalhoSse(),
        )) {
            val t = texto(b)
            for (linha in EspelhoHttp.CABECALHOS_SEMPRE) {
                assertTrue("faltou '$linha'", t.contains(linha + "\r\n"))
            }
            assertTrue(!t.contains("Access-Control-Allow-Origin"))
        }
    }

    // ------------------------------------------------------------------- SSE

    @Test
    fun `o cabecalho SSE e chunked com event-stream`() {
        val cab = texto(EspelhoHttp.cabecalhoSse())
        assertTrue(cab.startsWith("HTTP/1.1 200 OK\r\n"))
        assertTrue(cab.contains("Content-Type: text/event-stream\r\n"))
        assertTrue(cab.contains("Transfer-Encoding: chunked\r\n"))
        assertTrue(!cab.contains("Content-Length"))
    }

    @Test
    fun `um evento e data mais json mais linha dupla`() {
        assertArrayEquals(
            "data: {\"type\":\"load\"}\n\n".toByteArray(Charsets.UTF_8),
            EspelhoHttp.eventoSse("{\"type\":\"load\"}"),
        )
    }

    @Test
    fun `evento com quebra de linha e DEFEITO, nao entrada`() {
        // JSON.stringify/JSONObject.toString escapam \n dentro de strings; uma
        // quebra crua aqui só pode ser código nosso partindo o evento em dois.
        var lancou = false
        try {
            EspelhoHttp.eventoSse("{\"a\":\"x\ny\"}")
        } catch (e: IllegalArgumentException) {
            lancou = true
        }
        assertTrue(lancou)
    }

    @Test
    fun `o texto em portugues atravessa o evento intacto`() {
        // O caminho de comandos NÃO passa por sanear() — ele é do Registro e
        // apagaria acentos de versículo e letra (spec §5.2). UTF-8 de ponta a
        // ponta.
        val json = "{\"main\":\"Porque Deus amou o mundo de tal maneira…\"}"
        assertArrayEquals(
            ("data: " + json + "\n\n").toByteArray(Charsets.UTF_8),
            EspelhoHttp.eventoSse(json),
        )
    }

    @Test
    fun `o ping e comentario SSE com o epoch`() {
        assertArrayEquals(
            ": ping 1755100000000\n\n".toByteArray(Charsets.US_ASCII),
            EspelhoHttp.pingSse(1755100000000L),
        )
    }

    @Test
    fun `evento e ping cabem num chunk`() {
        // O fio real é chunk(eventoSse(...)): o framing SSE dentro do framing
        // chunked. O chunk exige tam > 0 — um evento nunca é vazio por
        // construção (o prefixo 'data: ' garante), e este caso trava isso.
        val ev = EspelhoHttp.eventoSse("{}")
        val c = EspelhoHttp.chunk(ev, 0, ev.size)
        assertTrue(c.isNotEmpty())
        val p = EspelhoHttp.pingSse(0)
        assertTrue(EspelhoHttp.chunk(p, 0, p.size).isNotEmpty())
    }
}
