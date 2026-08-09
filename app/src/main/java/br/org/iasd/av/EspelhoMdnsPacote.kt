package br.org.iasd.av

/**
 * O FIO DO mDNS — desmontar uma pergunta, montar uma resposta. **PURO.**
 *
 * Zero import de Android, pelo mesmo motivo do [EspelhoHttp] e do
 * [EspelhoPares]: este é o segundo ponto do projeto que aceita bytes de um
 * desconhecido, e o único jeito de ter oráculo sobre ele é ele ser função pura.
 * A diferença para o HTTP é o transporte — aqui é UDP, e um datagrama chega
 * inteiro ou não chega, o que remove a metade do parser que trata leitura
 * parcial. O que sobra é justamente a parte perigosa: **ponteiros de
 * compressão**, que são um grafo e podem apontar para trás em laço.
 *
 * ## O que este arquivo faz, e o que ele SE RECUSA a fazer
 *
 * Ele responde a **uma** pergunta: "quem é `av.local`?". Não é um servidor
 * mDNS: não anuncia serviços, não faz DNS-SD, não resolve nome de terceiro, não
 * guarda cache. Publicar um serviço (`_http._tcp`) seria o que o `NsdManager`
 * da plataforma já faz — e é justamente o que NÃO resolve o problema do
 * operador, porque um serviço anunciado não vira um nome que se digita na barra
 * de endereços. O que vira é um registro **A**, e reivindicá-lo é a única razão
 * de este arquivo existir.
 *
 * ## Os limites são o ponto, não a moldura
 *
 * Um datagrama de rede local hostil não pode custar mais que microssegundos:
 * cada laço abaixo tem teto, e o do ponteiro de compressão tem DOIS (saltos e
 * comprimento acumulado), porque um só deles ainda deixa o laço A→B→A vivo.
 */
object EspelhoMdnsPacote {

    /** Porta e grupo do mDNS (RFC 6762). Aqui só para quem monta os sockets. */
    const val PORTA = 5353
    const val GRUPO = "224.0.0.251"

    /** Teto de perguntas por datagrama. Um cliente real manda uma ou duas. */
    private const val MAX_PERGUNTAS = 16

    /** Teto de saltos de compressão e de bytes de nome (RFC 1035: 255). */
    private const val MAX_SALTOS = 16
    private const val MAX_NOME = 255

    const val TIPO_A = 1
    const val TIPO_ANY = 255
    private const val CLASSE_IN = 1

    /**
     * O bit alto da CLASSE numa PERGUNTA é o `QU` — "responda por unicast".
     * Ele existe para o primeiro pacote de quem acabou de entrar na rede não
     * obrigar todo mundo a ouvir a resposta. Honrá-lo é higiene de rede, e
     * custa uma linha aqui e um `if` no chamador.
     */
    private const val BIT_UNICAST = 0x8000

    /**
     * O bit alto da CLASSE numa RESPOSTA é o `cache-flush`: "o que você tinha
     * guardado para este nome está velho, use este". Sem ele, uma tela que já
     * viu o app num IP anterior (o DHCP mudou, o celular é outro) continuaria
     * indo ao endereço velho até o TTL vencer — e o sintoma seria "digitei
     * av.local e não abriu", sem nada em lugar nenhum que explicasse.
     */
    private const val BIT_FLUSH = 0x8000

    data class Pergunta(val nome: String, val tipo: Int, val unicast: Boolean)

    /**
     * As perguntas de um datagrama — vazio quando ele não é uma consulta, está
     * truncado, ou é malformado de qualquer jeito.
     *
     * Devolver vazio em vez de lançar é deliberado: o chamador é um laço de
     * recepção que roda a vida inteira do espelho, e um datagrama estranho na
     * rede da igreja não pode ser um evento — é o normal.
     */
    fun perguntas(pacote: ByteArray, tam: Int): List<Pergunta> {
        if (tam < 12) return emptyList()
        val flags = u16(pacote, 2)
        // Bit QR: 1 = resposta. Resposta alheia não nos interessa aqui — quem
        // as lê é a SONDA, e ela olha o pacote cru por outro caminho.
        if (flags and 0x8000 != 0) return emptyList()
        val qd = u16(pacote, 4)
        if (qd == 0 || qd > MAX_PERGUNTAS) return emptyList()
        var p = 12
        val fora = ArrayList<Pergunta>(qd)
        for (i in 0 until qd) {
            val n = lerNome(pacote, tam, p) ?: return fora
            p = n.second
            if (p + 4 > tam) return fora
            val tipo = u16(pacote, p)
            val classe = u16(pacote, p + 2)
            p += 4
            if (classe and 0x7FFF != CLASSE_IN) continue
            fora.add(Pergunta(n.first, tipo, classe and BIT_UNICAST != 0))
        }
        return fora
    }

    /**
     * "Alguém já respondeu por este nome?" — a leitura de uma RESPOSTA alheia
     * durante a sondagem.
     *
     * Reivindicar um nome que já é de outro aparelho é o tipo de coisa que
     * funciona no laboratório e quebra a rede de quem estava lá primeiro. A
     * RFC 6762 manda sondar antes de anunciar; isto é o mínimo honesto disso:
     * se chegar qualquer resposta citando o nome, desistimos dele e o operador
     * fica com o IP, que nunca deixou de funcionar.
     */
    fun respondePor(pacote: ByteArray, tam: Int, nome: String): Boolean {
        if (tam < 12) return false
        val flags = u16(pacote, 2)
        if (flags and 0x8000 == 0) return false          // não é resposta
        val qd = u16(pacote, 4)
        val an = u16(pacote, 6)
        if (an == 0 || qd > MAX_PERGUNTAS || an > MAX_PERGUNTAS) return false
        var p = 12
        for (i in 0 until qd) {
            val n = lerNome(pacote, tam, p) ?: return false
            p = n.second + 4
        }
        for (i in 0 until an) {
            val n = lerNome(pacote, tam, p) ?: return false
            p = n.second
            if (p + 10 > tam) return false
            val tipo = u16(pacote, p)
            val rd = u16(pacote, p + 8)
            p += 10 + rd
            if (p > tam) return false
            if (tipo == TIPO_A && n.first.equals(nome, ignoreCase = true)) return true
        }
        return false
    }

    /**
     * A RESPOSTA: um registro A para [nome] apontando para [ipv4].
     *
     * `id = 0` porque numa resposta mDNS o ID é ignorado (RFC 6762 §18.1) — e
     * copiá-lo da pergunta seria dar a um desconhecido um campo que ele
     * escolhe dentro de um pacote que nós assinamos.
     *
     * [ttl] em segundos. 120 é o valor da RFC para registros de endereço; um
     * `0` é a DESPEDIDA (goodbye), que manda todo mundo esquecer o nome na
     * hora — o mesmo papel do quadro `adeus` do espelho, e pela mesma razão:
     * sumir sem avisar é indistinguível de uma queda de rede.
     */
    fun resposta(nome: String, ipv4: ByteArray, ttl: Int): ByteArray {
        require(ipv4.size == 4) { "A é IPv4" }
        val n = codificarNome(nome)
        val fora = ByteArray(12 + n.size + 10 + 4)
        // Cabeçalho: id 0, QR=1 + AA=1 (autoritativo), sem perguntas, 1 resposta.
        p16(fora, 0, 0)
        p16(fora, 2, 0x8400)
        p16(fora, 4, 0)
        p16(fora, 6, 1)
        p16(fora, 8, 0)
        p16(fora, 10, 0)
        var p = 12
        n.copyInto(fora, p); p += n.size
        p16(fora, p, TIPO_A); p += 2
        p16(fora, p, CLASSE_IN or BIT_FLUSH); p += 2
        p32(fora, p, ttl); p += 4
        p16(fora, p, 4); p += 2
        ipv4.copyInto(fora, p)
        return fora
    }

    /**
     * A SONDA: uma pergunta por QTYPE ANY do nome que queremos reivindicar.
     *
     * Ela sai com o bit `QU` desligado de propósito — a resposta precisa ser
     * ouvida por todo mundo, porque é assim que dois aparelhos que sondam ao
     * mesmo tempo descobrem um ao outro.
     */
    fun sonda(nome: String): ByteArray {
        val n = codificarNome(nome)
        val fora = ByteArray(12 + n.size + 4)
        p16(fora, 0, 0)
        p16(fora, 2, 0)     // consulta padrão
        p16(fora, 4, 1)
        p16(fora, 6, 0)
        p16(fora, 8, 0)
        p16(fora, 10, 0)
        var p = 12
        n.copyInto(fora, p); p += n.size
        p16(fora, p, TIPO_ANY); p += 2
        p16(fora, p, CLASSE_IN)
        return fora
    }

    // ---------- nomes ----------

    /**
     * Lê um nome a partir de [inicio] e devolve `(nome, próximo offset NO
     * FLUXO)`.
     *
     * "No fluxo" é a sutileza que faz um parser de DNS ficar errado em silêncio:
     * quando o nome termina num ponteiro de compressão, o offset a devolver é o
     * de DEPOIS DO PONTEIRO, e não o de depois do texto que ele apontou. Errar
     * isso desalinha todo o resto do pacote.
     */
    private fun lerNome(b: ByteArray, tam: Int, inicio: Int): Pair<String, Int>? {
        val sb = StringBuilder()
        var p = inicio
        var fim = -1
        var saltos = 0
        var total = 0
        while (true) {
            if (p < 0 || p >= tam) return null
            val len = b[p].toInt() and 0xFF
            if (len == 0) { p++; break }
            if (len and 0xC0 == 0xC0) {
                // PONTEIRO. Dois tetos, e os dois são necessários: sem o de
                // saltos, `A → B → A` roda para sempre; sem o de comprimento,
                // uma escada de ponteiros que sempre anda para a frente monta
                // um nome gigante em memória.
                if (p + 1 >= tam) return null
                if (fim < 0) fim = p + 2
                if (++saltos > MAX_SALTOS) return null
                p = ((len and 0x3F) shl 8) or (b[p + 1].toInt() and 0xFF)
                continue
            }
            if (p + 1 + len > tam) return null
            total += len + 1
            if (total > MAX_NOME) return null
            if (sb.isNotEmpty()) sb.append('.')
            for (i in 0 until len) sb.append((b[p + 1 + i].toInt() and 0xFF).toChar())
            p += 1 + len
        }
        return sb.toString() to (if (fim >= 0) fim else p)
    }

    private fun codificarNome(nome: String): ByteArray {
        val partes = nome.split('.').filter { it.isNotEmpty() }
        var n = 1
        for (r in partes) {
            require(r.length in 1..63) { "rótulo fora do limite do DNS" }
            n += 1 + r.length
        }
        val fora = ByteArray(n)
        var p = 0
        for (r in partes) {
            fora[p++] = r.length.toByte()
            for (c in r) fora[p++] = c.code.toByte()
        }
        fora[p] = 0
        return fora
    }

    private fun u16(b: ByteArray, p: Int): Int =
        ((b[p].toInt() and 0xFF) shl 8) or (b[p + 1].toInt() and 0xFF)

    private fun p16(b: ByteArray, p: Int, v: Int) {
        b[p] = ((v ushr 8) and 0xFF).toByte()
        b[p + 1] = (v and 0xFF).toByte()
    }

    private fun p32(b: ByteArray, p: Int, v: Int) {
        b[p] = ((v ushr 24) and 0xFF).toByte()
        b[p + 1] = ((v ushr 16) and 0xFF).toByte()
        b[p + 2] = ((v ushr 8) and 0xFF).toByte()
        b[p + 3] = (v and 0xFF).toByte()
    }
}
