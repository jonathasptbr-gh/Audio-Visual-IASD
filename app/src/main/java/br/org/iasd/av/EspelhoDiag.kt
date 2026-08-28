package br.org.iasd.av

// POR QUE ESTE ARQUIVO NÃO ESTÁ NO `:core` (v1.4.5)
//
// Ele é puro no sentido em que os outros cinco são — ZERO import de `android.*`
// — e mesmo assim NÃO É PORTÁVEL: `org.json` é API da PLATAFORMA Android, não
// da JVM. O compilador só disse isso quando o módulo existiu, e é exatamente o
// serviço que o `:core` presta.
//
// Ficar aqui é a resposta de menor custo: são ~116 linhas cujo trabalho é
// PRODUZIR JSON ("devolve JSON, não frase" — a regra de diagnóstico do
// projeto), e levá-las junto exigiria uma dependência nova só para isso. A
// artefato `org.json:json` do Maven, além de ser dependência, carrega a
// cláusula "Good, not Evil", que não é licença livre reconhecida e não combina
// com a GPLv3 deste repositório.
//
// Quando a casca de computador precisar do diário, a escolha é entre um
// escritor de JSON próprio (são poucas linhas: o anel só emite string, número e
// lista) ou uma biblioteca com licença compatível — e essa decisão é do lote
// daquela casca, não deste.

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
 * **A lição desta classe, que vale para a próxima aposentadoria:** apagar o
 * PRODUTOR de uma métrica e deixar o CONSUMIDOR de pé não produz silêncio —
 * produz um ZERO, e zero é um valor legítimo que o consumidor interpreta. (O
 * anel de `ritmo` daqui ficou sem produtor por dezenove versões e o Registro
 * imprimia `ALARME: ISTO É UM RETÂNGULO PRETO` em todo culto com vídeo no ar.)
 * Remoção de recurso é remoção dos dois lados do fio.
 *
 * O que este arquivo é hoje: o **diário de linhas**, alimentado pelo
 * `EspelhoServidor` (páginas entregues, pareamentos aceitos e recusados, telas
 * que caíram) e desenhado pelo Registro em ordem de relógio.
 *
 * ## Por que um anel, e por que com carimbo de relógio de parede
 *
 * A transmissão pode ficar horas no ar; guardar tudo seria vazamento lento num
 * processo que também hospeda dois WebViews e a projeção. [TETO_LINHAS] cobre a
 * janela que interessa (ligar → uma tela entrar → falhar).
 * Cada linha carrega `em` = `System.currentTimeMillis()` porque o Registro mostra
 * hora de PAREDE ("última desconexão: tela C · 12:41").
 *
 * ## Thread-safety não é opcional aqui
 *
 * As escritas chegam de uma thread por cliente do servidor e a leitura
 * (`paraJson`) da thread do WebView que atende `@JavascriptInterface`. Um
 * `ArrayDeque` sem lock daria `ConcurrentModificationException` dentro da ponte
 * — um diagnóstico que quebra justamente quando alguém foi olhá-lo.
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
