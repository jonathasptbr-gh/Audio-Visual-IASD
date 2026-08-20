package br.org.iasd.av

/**
 * QUAL TRILHA DE ÁUDIO VAI AO TELÃO — a regra, e só a regra.
 *
 * **PURO: zero import.** Não é organização — é a mesma razão do `EspelhoHttp`
 * e do `EspelhoMidiaCache`: o resto do [YoutubeGrab] é rede, biblioteca de
 * terceiro e `MediaMuxer`, e nada disso se testa sem aparelho. O que decide se
 * a congregação ouve português mora aqui, em três funções que rodam num JUnit
 * (`TrilhaAudioTest`).
 *
 * ## O defeito que a criou (v5.242)
 *
 * O YouTube dubla vídeo sozinho, e as dublagens chegam ao extrator na MESMA
 * lista de faixas de áudio da trilha original — sem nada na altura, no bitrate
 * ou no contêiner que as distinga. A ordem de escolha era cliente → contêiner
 * → bitrate, e nenhum desses três sabe de idioma: os episódios do Provai e
 * Vede foram para o telão **em inglês**.
 *
 * ## As duas metades da regra
 *
 * Ordenar não bastaria, e é por isso que são duas: o teto de candidatos é
 * pequeno (dois, no caminho da montagem), e um 403 na primeira faixa faria a
 * segunda — que pode ser a dublagem — descer calada. Então [ordem] decide
 * quem vem primeiro e [soPortugues] decide quem sequer é candidato.
 */
object TrilhaAudio {

    /** Os valores de `AudioTrackType` que interessam aqui, como o extrator os nomeia. */
    const val ORIGINAL = "ORIGINAL"
    const val DUBLADA = "DUBBED"
    const val DESCRITIVA = "DESCRIPTIVE"

    /**
     * A trilha é português?
     *
     * Pelo idioma da etiqueta BCP 47 (`pt`, `pt-BR`, `pt-PT`), e nunca por
     * prefixo solto: um `startsWith("pt")` casaria com um `pta` que ninguém
     * conferiu, e a comparação é de IDIOMA, que é a parte antes do primeiro
     * hífen.
     */
    fun ehPortugues(idioma: String): Boolean =
        idioma == "pt" || idioma.startsWith("pt-")

    /**
     * QUEM PRIMEIRO — e a régua é o IDIOMA, não a qualidade.
     *
     * | # | trilha |
     * |---|---|
     * | 0 | português (o que este app projeta) |
     * | 1 | **idioma desconhecido** — o vídeo de faixa única, o caso normal |
     * | 2 | ORIGINAL noutro idioma |
     * | 3 | outro idioma (uma dublagem que não nos serve) |
     * | 4 | DESCRITIVA, em qualquer idioma |
     *
     * O 1 vem ANTES do 2 de propósito: um vídeo sem metadado de trilha é um
     * vídeo com um áudio só, e rebaixá-lo por não se declarar penalizaria
     * justamente o caminho que sempre funcionou — que é a esmagadora maioria
     * do acervo.
     *
     * A DESCRITIVA é a última em QUALQUER idioma: ela é o áudio original com a
     * narração dos elementos visuais por cima, feita para quem não vê a tela.
     * Projetá-la seria pior que projetar o idioma errado — e ela só existe onde
     * a trilha comum também existe, então rebaixá-la nunca deixa o vídeo mudo.
     */
    fun ordem(idioma: String, tipo: String): Int = when {
        tipo == DESCRITIVA -> 4
        ehPortugues(idioma) -> 0
        idioma.isEmpty() -> 1
        tipo == ORIGINAL -> 2
        else -> 3
    }

    /**
     * **Havendo português, só ele é candidato.**
     *
     * Uma faixa do cliente errado é 403: ela não baixa, e a fila de candidatos
     * existe para absorver isso. Uma faixa do idioma errado baixa
     * perfeitamente — e vai ao telão, na frente da congregação. **Um resultado
     * errado entregue com sucesso é pior que uma tentativa perdida.**
     *
     * Não havendo trilha em português (o vídeo é mesmo de outro idioma, ou não
     * declara trilha nenhuma), devolve a lista inteira: nada muda em relação ao
     * comportamento de sempre, e um vídeo estrangeiro continua tocando.
     *
     * A DESCRITIVA em português **não** dispara a exclusividade, e isso é
     * deliberado: ela é a única trilha `pt` que não serve para projetar, e
     * deixá-la excluir a original em inglês trocaria um problema por outro.
     * Ela continua na lista, no fim, como último recurso.
     */
    fun <T> soPortugues(faixas: List<T>, idioma: (T) -> String, tipo: (T) -> String): List<T> {
        val boas = { f: T -> ehPortugues(idioma(f)) && tipo(f) != DESCRITIVA }
        return if (faixas.any(boas)) faixas.filter(boas) else faixas
    }

    /**
     * O que sobra de um CONTÊINER depois da regra — e a ORDEM dos dois cortes.
     *
     * ## Por que a ordem mora aqui, e não no chamador
     *
     * `YoutubeGrab` corta por `m4a`/`webm` porque o `MediaMuxer` exige o par do
     * mesmo lado. Cortar o contêiner PRIMEIRO e só então perguntar o idioma é a
     * regressão silenciosa desta regra inteira: se a trilha pt-BR existe só em
     * WEBMA e a original `en` em m4a, o corte apaga a exclusividade do português
     * e o m4a devolve o inglês — que **baixa, monta e vai ao telão com sucesso**.
     * Um resultado errado entregue com sucesso é pior que uma tentativa perdida.
     *
     * Enquanto a composição vivia no chamador, ela era código sem oráculo:
     * `candidatosAudio` é privada e recebe um `StreamInfo` do NewPipe, então
     * nenhum JUnit a alcança, e um teste que recompusesse os dois passos por
     * fora provaria só que o TESTE concorda consigo mesmo — inverter a ordem em
     * produção o deixaria verde. Aqui ela é PURA e coberta.
     *
     * [ptEm] responde a pergunta que o Registro faz quando o contêiner pedido
     * fica sem nada: "e onde o português está, então?". Vazio = não foi a
     * exclusividade que esvaziou (o contêiner simplesmente não tinha áudio).
     */
    class Escolha<T>(val candidatos: List<T>, val ptEm: List<String>)

    fun <T> noConteiner(
        faixas: List<T>,
        idioma: (T) -> String,
        tipo: (T) -> String,
        ext: String?,
        extDe: (T) -> String,
    ): Escolha<T> {
        val doContainer = { fs: List<T> -> fs.filter { ext == null || extDe(it).equals(ext, true) } }
        val comPt = soPortugues(faixas, idioma, tipo)
        val candidatos = doContainer(comPt)
        val ptEm =
            if (candidatos.isEmpty() && doContainer(faixas).isNotEmpty()) {
                comPt.map(extDe).distinct()
            } else {
                emptyList()
            }
        return Escolha(candidatos, ptEm)
    }
}
