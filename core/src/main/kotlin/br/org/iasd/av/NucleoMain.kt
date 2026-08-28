package br.org.iasd.av

import java.io.File

/**
 * O NÚCLEO como programa — o `nucleo.jar` que a casca do Windows sobe.
 *
 * Ele não tem janela, não desenha nada e não decide nada de culto. O que ele é:
 * o servidor de loopback que serve a base web às janelas do programa, mais o
 * despacho da ponte. Tudo o que precisa de uma janela sai pelo cano de stdio
 * para a casca, e volta por ele.
 *
 * ```
 *  AudioVisualIASD.exe  ──stdio──►  nucleo.jar  ──HTTP/SSE──►  as duas janelas
 *   (C#: janela, monitores,  ◄──────  (Kotlin: servidor,  ◄────  (WebView2)
 *    diálogos, volume)                 despacho, `/saf/`)
 * ```
 *
 * **O que ele AINDA não faz** — e está dito porque um diagrama que promete
 * manda o próximo leitor procurar o que não existe: YouTube (`ytFetch`,
 * `ytSearch`, `ytStream`…), cifra (`cifraHtml`) e as telas da rede
 * (`espelho*`) são os lotes 4 e 6 de `docs/SEGUNDA-CASCA.md`. Hoje o
 * [NucleoDespacho] responde a eles com o desfecho inofensivo, como responde a
 * qualquer método que ninguém implementou ainda.
 *
 * ## Ele morre com a casca, e isso é o ponto
 *
 * Quando o cano fecha — a casca saiu, com ou sem cerimônia — o núcleo desliga
 * e termina. **Uma JVM órfã seria o pior desfecho possível deste desenho**: ela
 * continuaria segurando a porta, e a porta é a ORIGEM. A abertura seguinte
 * receberia [NucleoServidor.Recusa.PortaOcupada] e o operador leria "feche a
 * outra cópia" sem ter nenhuma cópia aberta na tela.
 */
object NucleoMain {

    /** A porta padrão. Ela é a ORIGEM (ver [NucleoServidor]), então é um valor
     *  escrito, não um sorteio — e não muda entre versões. */
    const val PORTA_PADRAO = 8420

    @JvmStatic
    fun main(argv: Array<String>) {
        val args = argv.toList()
        val raiz = File(valor(args, "--raiz") ?: ".")
        val porta = valor(args, "--porta")?.toIntOrNull() ?: PORTA_PADRAO

        val saida = System.out
        // O DIÁLOGO COM A CASCA SAI POR `stdout`, e nada mais pode sair por
        // ele: um `println` de depuração no meio do cano desloca o
        // comprimento e a casca perde o passo. Log vai para `stderr`.
        val erro = System.err

        // A referência é circular por natureza — o despacho empurra pelo
        // servidor, e o servidor chama o despacho —, e ela se fecha com uma
        // variável, não com um `lateinit`: o `empurrar` pode ser chamado antes
        // de o servidor existir (não é o caso hoje, e é justamente por isso
        // que um `lateinit` explodiria só no dia em que passar a ser).
        var servidor: NucleoServidor? = null

        val despacho = NucleoDespacho(
            empurrar = { json, alvo, menos -> servidor?.empurrar(json, alvo, menos) },
            paraCasca = { env -> synchronized(saida) { NucleoPonte.escreverNoCano(saida, env) } },
            base = "http://127.0.0.1:$porta",
        )

        val s = NucleoServidor(raiz, porta) { sessao, corpo -> despacho.chamada(sessao, corpo) }
        servidor = s

        val recusa = s.ligar()
        if (recusa != null) {
            // A FRASE vem do núcleo, e a casca a mostra sem traduzir — é a
            // mesma disciplina do `EspelhoDiag`: quem decidiu é quem sabe o
            // que dizer, e uma segunda escrita da explicação envelhece à parte.
            synchronized(saida) {
                NucleoPonte.escreverNoCano(
                    saida, NucleoPonte.montar("-", "recusa", listOf(recusa.frase)),
                )
            }
            erro.println("[nucleo] recusa: " + recusa.frase)
            return
        }
        synchronized(saida) {
            NucleoPonte.escreverNoCano(
                saida, NucleoPonte.montar("-", "pronto", listOf(porta.toString())),
            )
        }

        val entrada = System.`in`
        while (true) {
            val env = NucleoPonte.lerDoCano(entrada) ?: break
            try { despacho.daCasca(env) } catch (e: Exception) {
                // Um envelope que derrube o laço deixaria a casca falando
                // sozinha: as janelas continuariam de pé, a ponte muda, e nada
                // na tela diria por quê.
                erro.println("[nucleo] envelope recusado: " + (e.message ?: e.javaClass.simpleName))
            }
        }
        s.desligar()
    }

    private fun valor(args: List<String>, chave: String): String? {
        val i = args.indexOf(chave)
        return if (i >= 0 && i + 1 < args.size) args[i + 1] else null
    }
}
