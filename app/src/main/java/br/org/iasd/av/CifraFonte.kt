package br.org.iasd.av

import android.util.Log
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL

/**
 * A CIFRA, SOB DEMANDA — a metade de TRANSPORTE, e só ela.
 *
 * O visualizador de letras ganhou uma aba de cifra. O conteúdo dela mora fora
 * do aparelho e é lido **no momento em que o operador abre a aba**: nada é
 * baixado em lote, nada entra no bundle do OTA, nada é gravado em disco. Este
 * arquivo faz UMA coisa — um `GET` a um host permitido — e devolve o corpo
 * **cru**.
 *
 * ## Por que existe em Kotlin, se a regra é não reimplementar o que o web faz
 *
 * Não é escolha: é CORS. Os dois WebViews rodam em
 * `https://appassets.androidplatform.net/` (invariante 1) e um site de terceiro
 * não manda `Access-Control-Allow-Origin` para esse origin — um `fetch()` da
 * página morre antes de sair. O `<iframe>` cai no `X-Frame-Options`, que este
 * projeto já mediu quando tentou embutir a busca do YouTube. Sobra o shell.
 *
 * ## E por que ele NÃO INTERPRETA NADA
 *
 * A mesma divisão de trabalho das SÉRIES do YouTube (`ytCanalPlaylists` →
 * `controle/serie.js`): **o shell entrega bytes crus, quem lê é o lado web**.
 * A marcação de um site muda quando o dono dele quiser, e nesse dia:
 *
 *  - um ajuste em `controle/cifra.js` chega à frota **por OTA, em minutos**,
 *    com oráculo em Node (`tools/cifra.test.mjs`);
 *  - o mesmo ajuste aqui custaria um degrau de [NativeBridge.SHELL_VERSION] e
 *    uma Release por vírgula — e, até ela sair, a aba fica muda.
 *
 * Um parser HTML aqui dentro seria, literalmente, a peça mais frágil do app
 * colocada do lado que menos sabe consertá-la.
 *
 * ## As guardas, e por que cada uma
 *
 *  - **Host travado por COMPONENTE do `URI`** ([HOSTS_PERMITIDOS]), nunca por
 *    prefixo de string — é a mesma regra da invariante 2 e do
 *    `WebUpdater.ALLOWED_ASSET_HOSTS`. Sem ela este método é um proxy HTTP de
 *    uso geral pendurado num WebView privilegiado: qualquer script que
 *    chegasse ali leria a rede interna da igreja com o IP do aparelho.
 *  - **`https` obrigatório.**
 *  - **Teto de bytes** ([MAX_BYTES]). A resposta é lida para a memória de um
 *    processo que já divide o espaço com dois WebViews e um vídeo; uma URL que
 *    devolvesse um arquivo grande derrubaria o app, e o `largeHeap` não é
 *    licença para ler o que vier.
 *  - **Prazos curtos** ([TEMPO_MS]). O `call()` do lado web desiste em 60 s e
 *    resolve `null`; o pior caso daqui (conexão + leitura) tem de caber
 *    folgado dentro disso, senão a aba mente "não achei" quando o certo era
 *    "a rede não respondeu".
 *
 * Nada aqui persiste. O cache é um `Map` em memória no `controle.js`, morto ao
 * fechar o app — que é o contrato do recurso, não um detalhe de implementação.
 */
object CifraFonte {
    private const val TAG = "CifraFonte"

    /**
     * Os hosts que este método aceita. É uma lista de PERMISSÃO comparada por
     * igualdade de componente: `cifraclub.com.br.exemplo.com` é um domínio que
     * qualquer um registra, e um `endsWith` o autorizaria.
     *
     * Acrescentar um host aqui é acrescentar superfície de rede ao app — a
     * pergunta a fazer antes é "o `cifra.js` sabe ler este site?", porque um
     * host permitido que o parser não entende só troca um erro por um vazio.
     */
    private val HOSTS_PERMITIDOS = setOf(
        "www.cifraclub.com.br",
        "cifraclub.com.br",
    )

    /**
     * O `User-Agent`.
     *
     * O do app basta no Cifra Club e está em uso desde o começo — trocá-lo
     * mexeria no único caminho que hoje funciona. A escolha POR HOST saiu com o
     * buscador externo (v1.2.7): sobrou um host, e um `if` sobre um conjunto de
     * um elemento é uma bifurcação que só existe para o leitor procurar o outro
     * ramo.
     */
    private const val AGENTE = "AudioVisualIASD"

    /** Conexão e leitura. Bem abaixo do `CALL_TIMEOUT_MS` (60 s) do lado web. */
    private const val TEMPO_MS = 15000

    /** Teto do corpo lido. Uma página de cifra vive na casa das centenas de kB. */
    private const val MAX_BYTES = 3 * 1024 * 1024

    /**
     * A última tentativa, em texto, para a linha "Cifra:" do Registro. Escrita
     * só por [buscar] — não há segundo escritor, e por isso ela não precisa de
     * trava. Ver a regra do diagnóstico no `CLAUDE.md`: o Kotlin guarda o
     * VEREDITO da função que decidiu; quem monta a frase é o `controle.js`.
     */
    @Volatile
    var ultimaTentativa: String = ""
        private set

    /**
     * `GET url` e devolve o corpo cru.
     *
     * O par `(status, html)` é o retorno inteiro, e os dois campos existem
     * porque respondem a perguntas diferentes: `status 0` é "não houve
     * resposta" (sem rede, DNS, prazo vencido) e `status 404` é "o site
     * respondeu que não tem". A aba diz coisas opostas nos dois casos, e um
     * retorno de string só as tornaria indistinguíveis — que é exatamente o
     * defeito que este projeto chama de mentir baixinho.
     *
     * Nunca lança: toda falha vira `status 0` com `html` vazio.
     */
    fun buscar(url: String): Pair<Int, String> {
        val alvo = try { URI(url) } catch (_: Exception) { null }
        val host = alvo?.host ?: ""
        if (alvo?.scheme != "https" || host !in HOSTS_PERMITIDOS) {
            ultimaTentativa = "destino não permitido ($url)"
            Log.w(TAG, ultimaTentativa)
            return 0 to ""
        }

        var c: HttpURLConnection? = null
        return try {
            c = (URL(url).openConnection() as HttpURLConnection).apply {
                connectTimeout = TEMPO_MS
                readTimeout = TEMPO_MS
                instanceFollowRedirects = true
                requestMethod = "GET"
                setRequestProperty("User-Agent", AGENTE)
                setRequestProperty("Accept", "text/html")
                setRequestProperty("Accept-Language", "pt-BR,pt")
            }
            val status = c.responseCode
            // 4xx/5xx respondem pelo `errorStream`; o corpo deles não interessa
            // (quem decide o que dizer é a aba), mas o STATUS interessa muito.
            if (status !in 200..299) {
                ultimaTentativa = "HTTP $status em $url"
                return status to ""
            }
            val corpo = lerAteOTeto(c)
            ultimaTentativa = "HTTP $status, ${corpo.length} caractere(s) em $url"
            status to corpo
        } catch (e: Exception) {
            ultimaTentativa = "falhou (${e.javaClass.simpleName}) em $url"
            Log.i(TAG, ultimaTentativa)
            0 to ""
        } finally {
            try { c?.disconnect() } catch (_: Exception) { /* já fechada */ }
        }
    }

    /**
     * Lê o corpo respeitando [MAX_BYTES]. O `Content-Length` NÃO é a régua: ele
     * é opcional, mentível e ausente em toda resposta `chunked` — quem tem de
     * parar é o laço de leitura.
     *
     * A decodificação é UTF-8 fixa. O site fala português com acento, e ler o
     * `charset` do cabeçalho seria uma segunda fonte de verdade para um valor
     * que, errado, produz "Ã§" no meio de um título — visível, mas só depois de
     * projetado.
     */
    private fun lerAteOTeto(c: HttpURLConnection): String {
        val saida = ByteArrayOutputStream()
        val bloco = ByteArray(64 * 1024)
        c.inputStream.use { entrada ->
            while (true) {
                val n = entrada.read(bloco)
                if (n <= 0) break
                saida.write(bloco, 0, n)
                if (saida.size() >= MAX_BYTES) break
            }
        }
        return saida.toString(Charsets.UTF_8.name())
    }
}
