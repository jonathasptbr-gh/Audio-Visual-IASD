package br.org.iasd.av

import org.json.JSONArray
import org.json.JSONObject

/**
 * O diário da transmissão — e ele **devolve DADO, nunca frase**.
 *
 * ## O invariante único deste arquivo
 *
 * **O Kotlin entrega JSON; quem monta a frase é o `controle.js`.** É o que o
 * resto do projeto já faz (`otaDiag`, `ytDiag` — os dois nasceram string e são
 * exceção histórica, não modelo), é o que respeita a invariante 5 do
 * `CLAUDE.md` ("não reimplementar em Kotlin nada que já exista em JS") e é o
 * que torna a sanitização de texto vindo da rede auditável **num ponto só**.
 * Um `EspelhoDiag` que formata parágrafos é UI de diagnóstico escrita em
 * Kotlin, e este projeto faz o contrário.
 *
 * ## O QUE SAIU DAQUI, e por que a remoção é a correção (v5.206)
 *
 * Este arquivo nasceu para o ESPELHO DE PIXELS, e a v5.187 aposentou aquele
 * recurso por inteiro. Sobraram três coisas mortas, e uma delas não era inerte:
 *
 *  - **O anel de `ritmo`** (bytes/quadros/chaves/cadência por segundo, mais o
 *    atraso captura→fio). Quem o alimentava era `amostra()`, chamada uma vez por
 *    quadro pelo encoder H.264 — que não existe desde a v5.187. O anel ficou sem
 *    produtor e **`paraJson` continuou publicando o objeto**, zerado. Do outro
 *    lado do fio, o `blocoEspelho` do `controle.js` lê `kbps < 40` como "isto é
 *    um retângulo preto" e imprimia **`ALARME: ISTO É UM RETÂNGULO PRETO`** em
 *    todo culto com vídeo no ar — no Registro, que é o artefato que o operador
 *    COPIA E REPASSA quando algo não conecta. O KDoc desta classe já dizia, com
 *    todas as letras, que "diagnóstico que mente é pior que diagnóstico nenhum";
 *    a linha estava mentindo havia dezenove versões.
 *  - **`fato()`**, a publicação de fatos estruturados (tela virtual, readback,
 *    encoder, viewport). Zero chamadores desde que os três produtores foram
 *    apagados.
 *  - **`SondaClipe`/`SondaPathHandler`**, o instrumento que gerava um clipe
 *    magenta para medir o decodificador da TV. A `sonda.html` e a
 *    `MirrorPresentation` que a hospedava saíram na v5.187 — restaram ~310
 *    linhas de `MediaCodec`/`MediaMuxer` que nada alcançava.
 *
 * **A lição que fica escrita, porque ela vale para a próxima aposentadoria:**
 * apagar o PRODUTOR de uma métrica e deixar o CONSUMIDOR de pé não produz
 * silêncio — produz um zero, e um zero é um valor legítimo que o consumidor
 * interpreta. Remoção de recurso é remoção dos dois lados do fio.
 *
 * O que sobrou é o que sempre foi lido: o **diário de linhas**, alimentado pelo
 * `EspelhoServidor` (páginas entregues, pareamentos aceitos e recusados, telas
 * que caíram) e desenhado pelo Registro em ordem de relógio.
 *
 * ## Por que um anel, e por que com carimbo de relógio de parede
 *
 * A transmissão pode ficar horas no ar; guardar tudo seria vazamento de memória
 * lento num processo que também hospeda dois WebViews e a projeção. [TETO_LINHAS]
 * cobre com folga a janela que interessa (ligar → uma tela entrar → falhar), e o
 * que sai é o mais velho.
 *
 * Cada linha carrega `em` = `System.currentTimeMillis()` porque o Registro
 * mostra hora de parede ("última desconexão: tela C · 12:41"), e
 * `System.currentTimeMillis` é a única fonte disso.
 *
 * ## Thread-safety não é opcional aqui
 *
 * As escritas chegam de uma thread por cliente do servidor; a leitura
 * (`paraJson`) chega de outra: a thread do WebView que atende
 * `@JavascriptInterface`. Um `ArrayDeque` sem lock aqui daria
 * `ConcurrentModificationException` dentro da ponte — isto é, um diagnóstico
 * que quebra justamente quando alguém foi olhá-lo.
 */
class EspelhoDiag {

    private val trava = Any()

    /** Anel de linhas. Ver o KDoc da classe: o mais velho sai. */
    private val linhas = ArrayDeque<Linha>()

    private data class Linha(val em: Long, val txt: String)

    /**
     * Registra uma linha do diário da transmissão.
     *
     * [linha] é **saneada aqui também**, e isso é defesa em profundidade, não
     * duplicação: o texto que vem da rede (o `ua` de um cliente, por exemplo) já
     * é saneado no `EspelhoPares` antes de chegar perto daqui, mas um `\n` que
     * escapasse injetaria **linhas falsas** num artefato que o projeto manda
     * copiar e repassar (`copiarTexto`, no `controle.js`). O custo de sanear
     * duas vezes é um laço sobre 240 caracteres; o custo de não sanear é um
     * Registro forjado.
     */
    fun registrar(linha: String) {
        val txt = sanear(linha)
        if (txt.isEmpty()) return
        synchronized(trava) {
            linhas.addLast(Linha(System.currentTimeMillis(), txt))
            while (linhas.size > TETO_LINHAS) linhas.removeFirst()
        }
    }

    /**
     * O JSON inteiro, pronto para o `espelhoDiag()` da ponte devolver.
     *
     * Formato:
     * ```json
     * { "linhas": [ {"em": 1765..., "txt": "…"} ] }
     * ```
     *
     * Quem junta a este objeto o que só o servidor sabe (`servidor`, `telas`) e
     * o que só a proteção sabe (`servico`) é o `MainActivity.mirrorDiag` — ver
     * o KDoc de lá. **Este arquivo não publica mais nada além do diário**, e a
     * regra que isso encerra está no KDoc da classe: uma chave publicada sem
     * produtor vivo não fica em branco, fica em ZERO, e o consumidor a lê.
     */
    fun paraJson(): JSONObject = synchronized(trava) {
        val o = JSONObject()
        val arr = JSONArray()
        for (l in linhas) arr.put(JSONObject().put("em", l.em).put("txt", l.txt))
        o.put("linhas", arr)
        // Última EXPRESSÃO do bloco, e não `return o`: `synchronized` é inline,
        // então um `return` aqui seria um retorno não-local de uma função de
        // corpo-expressão — que o compilador recusa.
        o
    }

    private fun sanear(s: String): String {
        val sb = StringBuilder()
        for (ch in s) {
            if (sb.length >= TETO_TEXTO) break
            val c = ch.code
            sb.append(if (c < 0x20 || c == 0x7F) ' ' else ch)
        }
        return sb.toString().trim()
    }

    companion object {
        /** Linhas guardadas. Ver o KDoc da classe. */
        private const val TETO_LINHAS = 60

        /** Corte duro de cada linha. */
        private const val TETO_TEXTO = 240
    }
}
