package br.org.iasd.av

/**
 * O ENVELOPE DA PONTE — **PURO, zero import de nada**.
 *
 * No Android a ponte é `addJavascriptInterface`: o JavaScript chama um método
 * Kotlin direto, e a resposta volta por `evaluateJavascript("__avResolve(…)")`.
 * No computador não há essa costura — o que há é o servidor de loopback que o
 * programa já sobe para servir a própria base. A ponte então vira duas rotas
 * (`POST /ponte/call` e o SSE `GET /ponte/e`), e este arquivo é o que
 * atravessa as duas.
 *
 * ## Por que um formato PRÓPRIO, e não JSON
 *
 * Porque o `:core` não tem parser de JSON e **não vai ter um por causa disto**.
 * `org.json` é API da plataforma Android, não da JVM (foi o que o `EspelhoDiag`
 * descobriu ao tentar mudar de módulo), e trazer uma biblioteca para ler o
 * envelope contradiria a regra de dependências do projeto por uma necessidade
 * que não existe: **os argumentos da ponte são STRINGS**, sempre — inclusive os
 * três que carregam objeto (`busPost`, `bgProgress`, `nowPlaying`), que no
 * Android já chegam como `JSON.stringify(...)` e são parseados por quem sabe o
 * que aquele objeto é. Aqui é igual: o núcleo TRANSPORTA a string e quem a lê é
 * quem tem o parser — a casca, em C#, ou o extrator, em Java.
 *
 * O que este formato precisa entregar é só isto: uma lista de strings UTF-8
 * arbitrárias, **sem escape**, sem ambiguidade de fronteira. Comprimento na
 * frente resolve, e resolve num parser que cabe numa tela — que é o que separa
 * este arquivo de um leitor de JSON escrito às pressas.
 *
 * ```
 * AV1\n
 * <id>\n
 * <metodo>\n
 * <quantos>\n
 * <bytes do arg 1>\n<o arg 1>\n
 * <bytes do arg 2>\n<o arg 2>\n
 * ```
 *
 * **O `\n` depois de cada argumento não é enfeite: é a conferência.** Sem ele,
 * um comprimento errado por um byte desloca todos os argumentos seguintes e o
 * envelope continua parseando — com o texto trocado de lugar. Com ele, o mesmo
 * erro vira uma recusa. *Um formato que se cala diante de um erro de
 * comprimento é o mesmo defeito da invariante 8, num lugar novo.*
 *
 * ## O MESMO envelope nas DUAS direções
 *
 * Ele vai do navegador ao núcleo (`POST /ponte/call`) **e** do núcleo à casca
 * pelo cano de stdio, para as folhas que só o sistema operacional sabe
 * responder (seletor de arquivo, monitores, volume). Um formato só, um parser
 * só, um oráculo só — e a casca em C# escreve o mesmo dialeto.
 *
 * ## E ele tem DOIS produtores em linguagens diferentes
 *
 * O envelope é escrito em JavaScript (a folha injetada na janela) e lido aqui,
 * em Kotlin. É a forma exata que este projeto já viu falhar em silêncio duas
 * vezes — o `__tela` do `display-ready` e o `TIPOS_QUE_SOBEM` do dreno —, e a
 * resposta é a mesma: **as duas metades têm oráculo, contra as MESMAS
 * fixtures** (`tools/fixtures/ponte-envelope.json`). O produtor é cobrado no
 * `tools/ponte-envelope.test.mjs`, o consumidor no `NucleoPonteTest`. Ler cada
 * lado isolado aprova os dois.
 */
object NucleoPonte {

    /** A marca de versão do envelope. Um dialeto novo troca o número, e o
     *  parser recusa o desconhecido em vez de adivinhar. */
    const val MARCA = "AV1"

    /**
     * O teto do corpo de `POST /ponte/call`.
     *
     * O [EspelhoHttp.TETO_CORPO] são 256 bytes, e ele está certo para o que
     * ele protege: um socket de REDE, que qualquer um na Wi-Fi da igreja
     * alcança. Este é outro socket — loopback, com allowlist de `Host`, falando
     * só com as janelas do próprio programa —, e por ele passa `salvarTexto`,
     * que carrega o Registro inteiro (dezenas de kB: ele existe para ser
     * COPIADO, e não tem pressão de tamanho).
     *
     * 1 MiB continua sendo um teto de PROTOCOLO: a maior carga legítima medida
     * é o Registro, e o resto é folga. Deixar o padrão de 256 B valendo aqui
     * seria um 413 em cima do "Salvar como" e de metade dos `nowPlaying` — e
     * o `native.js` lê um erro de rede como `null`, isto é, **em silêncio**.
     */
    const val TETO_CORPO = 1024 * 1024

    /** Quantos argumentos um método pode ter. A maior aridade da ponte hoje é
     *  3 (`salvarTexto`, `deckPages`, `espelhoCertImportar`); o teto existe
     *  para um número absurdo no envelope não virar uma lista absurda. */
    const val TETO_ARGS = 8

    /** Uma chamada já lida e provada. */
    data class Chamada(val id: String, val metodo: String, val args: List<String>)

    /**
     * O NOME DO MÉTODO é o único campo com gramática estrita, e é de propósito.
     *
     * Ele seleciona uma entrada de despacho e aparece no diagnóstico; os
     * demais campos são dados que atravessam. Um nome com bytes estranhos não
     * causa estrago hoje — e é exatamente o tipo de coisa que passa a causar
     * quando alguém o usa para montar um caminho ou uma linha de log.
     */
    private fun metodoValido(m: String): Boolean =
        m.isNotEmpty() && m.length <= 40 &&
            m[0] in 'a'..'z' &&
            m.all { it in 'a'..'z' || it in 'A'..'Z' || it in '0'..'9' }

    /**
     * O ID volta para dentro de `window.__avResolve(id, …)`, então ele viaja
     * num quadro JSON e sai por [aspas]. A conferência aqui é de FORMA — ASCII
     * imprimível, sem quebra, curto —, não de escape: quem escapa é [aspas], e
     * duas defesas para a mesma coisa é como se perde a que importa.
     */
    private fun idValido(s: String): Boolean =
        s.isNotEmpty() && s.length <= 64 && s.all { it.code in 0x21..0x7E }

    /**
     * Lê um envelope. Devolve `null` para QUALQUER coisa que não seja um
     * envelope inteiro e bem formado — não há meio-envelope, e não há
     * "aproveitar o que deu para ler".
     */
    fun ler(corpo: ByteArray): Chamada? {
        var p = 0

        fun linha(): String? {
            val q = corpo.indexOfFrom(p, '\n'.code.toByte())
            if (q < 0) return null
            val s = String(corpo, p, q - p, Charsets.UTF_8)
            p = q + 1
            return s
        }

        if (linha() != MARCA) return null
        val id = linha() ?: return null
        if (!idValido(id)) return null
        val metodo = linha() ?: return null
        if (!metodoValido(metodo)) return null
        val quantos = (linha() ?: return null).toIntOrNull() ?: return null
        if (quantos < 0 || quantos > TETO_ARGS) return null

        val args = ArrayList<String>(quantos)
        repeat(quantos) {
            val tam = (linha() ?: return null).toIntOrNull() ?: return null
            if (tam < 0 || tam > corpo.size - p) return null
            args.add(String(corpo, p, tam, Charsets.UTF_8))
            p += tam
            // A CONFERÊNCIA: o byte seguinte tem de ser a quebra. Ver o KDoc —
            // é ela que transforma um comprimento errado numa recusa, em vez
            // de num argumento deslocado que o parser aceita sorrindo.
            if (p >= corpo.size || corpo[p] != '\n'.code.toByte()) return null
            p++
        }
        // Sobra depois do último argumento é envelope malformado. Aceitá-la
        // seria deixar um segundo envelope colado passar despercebido.
        if (p != corpo.size) return null
        return Chamada(id, metodo, args)
    }

    /**
     * Escreve um envelope. É este o lado que fala com a CASCA pelo cano de
     * stdio; o outro produtor é a folha injetada, em JavaScript.
     */
    fun montar(id: String, metodo: String, args: List<String>): ByteArray {
        val cab = StringBuilder()
        cab.append(MARCA).append('\n').append(id).append('\n')
            .append(metodo).append('\n').append(args.size).append('\n')
        var fora = cab.toString().toByteArray(Charsets.UTF_8)
        for (a in args) {
            val b = a.toByteArray(Charsets.UTF_8)
            fora += (b.size.toString() + "\n").toByteArray(Charsets.US_ASCII)
            fora += b
            fora += '\n'.code.toByte()
        }
        return fora
    }

    // ---------- OS QUADROS QUE DESCEM PELO SSE ----------
    //
    // Estes SÃO JSON, e por uma razão que não vale para o envelope: quem os lê
    // é o navegador, que tem `JSON.parse` de graça e não deve ganhar um parser
    // escrito à mão. A assimetria é deliberada — cada lado usa o que já tem.

    /** A resposta de uma chamada: vira `window.__avResolve(id, valor)`.
     *  [valorJson] é JSON JÁ PRONTO (o `null` do Kotlin vira o `null` do JS). */
    fun quadroResolve(id: String, valorJson: String): String =
        "{\"t\":\"r\",\"id\":" + aspas(id) + ",\"v\":" + (valorJson.ifBlank { "null" }) + "}"

    /**
     * O andamento de uma chamada longa (download do YouTube, rasterização).
     * [canal] é `yt` ou `deck` — a folha os roteia para `__avYtProgress` e
     * `__avDeckProgress`, que já existem no `native.js` e já recebem o id.
     */
    fun quadroProgresso(canal: String, id: String, a: Long, b: Long): String =
        "{\"t\":\"p\",\"c\":" + aspas(canal) + ",\"id\":" + aspas(id) +
            ",\"a\":" + a + ",\"b\":" + b + "}"

    /**
     * Um comando do barramento indo para a OUTRA janela — o papel que o
     * `MessageBus` faz no Android. [json] é o comando verbatim, como o
     * `busPost` o recebeu: o núcleo não lê comando, ele o entrega.
     */
    fun quadroBus(json: String): String = "{\"t\":\"b\",\"m\":" + json + "}"

    /**
     * Escape de string JSON. Ele existe aqui, e não numa biblioteca, pelo
     * mesmo motivo do resto do arquivo — e é usado também pelo
     * [NucleoServidor], que não tem o seu.
     */
    fun aspas(s: String): String {
        val b = StringBuilder(s.length + 2)
        b.append('"')
        for (c in s) when {
            c == '"' -> b.append("\\\"")
            c == '\\' -> b.append("\\\\")
            c == '\n' -> b.append("\\n")
            c == '\r' -> b.append("\\r")
            c == '\t' -> b.append("\\t")
            // `<` e `/` fora: o quadro vai por SSE e é lido por `JSON.parse`,
            // nunca inserido como HTML. Escapá-los aqui daria a impressão de
            // que este texto pode ir parar num documento — e é essa impressão
            // que faz alguém, um dia, mandá-lo para lá.
            c.code < 0x20 -> b.append(String.format("\\u%04x", c.code))
            else -> b.append(c)
        }
        return b.append('"').toString()
    }

    // ---------- O CANO DE STDIO ----------
    //
    // O envelope é auto-delimitado quando lido byte a byte, e escrever um
    // leitor incremental para o cano seria fácil — e seria um SEGUNDO parser
    // do mesmo formato, com as mesmas recusas escritas de novo. Duas escritas
    // da mesma gramática divergem no primeiro ajuste, e a divergência é muda.
    // Em vez disso o cano ganha UMA linha de comprimento na frente, e [ler]
    // continua sendo o único parser que existe.

    /** Escreve um envelope no cano, com o comprimento na frente. */
    fun escreverNoCano(saida: java.io.OutputStream, envelope: ByteArray) {
        saida.write((envelope.size.toString() + "\n").toByteArray(Charsets.US_ASCII))
        saida.write(envelope)
        saida.flush()
    }

    /**
     * Lê um envelope do cano. `null` = o outro lado fechou (a casca saiu, ou o
     * núcleo saiu) — que é o desfecho NORMAL de encerrar o programa, e não um
     * erro. Comprimento fora de forma também devolve `null`: um cano
     * dessincronizado não se recupera adivinhando.
     */
    fun lerDoCano(entrada: java.io.InputStream): ByteArray? {
        val n = StringBuilder()
        while (true) {
            val b = entrada.read()
            if (b < 0) return null
            if (b == '\n'.code) break
            if (n.length >= 12) return null
            n.append(b.toChar())
        }
        val tam = n.toString().toIntOrNull() ?: return null
        if (tam < 0 || tam > TETO_CORPO) return null
        val buf = ByteArray(tam)
        var lidos = 0
        while (lidos < tam) {
            val r = entrada.read(buf, lidos, tam - lidos)
            if (r < 0) return null
            lidos += r
        }
        return buf
    }

    private fun ByteArray.indexOfFrom(de: Int, alvo: Byte): Int {
        var i = de
        while (i < size) { if (this[i] == alvo) return i; i++ }
        return -1
    }
}
