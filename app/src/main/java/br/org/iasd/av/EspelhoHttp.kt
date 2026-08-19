package br.org.iasd.av

import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream

/**
 * O parser HTTP do telão por comandos. **ZERO import de Android, de propósito.**
 *
 * ## Por que este arquivo é puro
 *
 * É o primeiro código do projeto que aceita entrada de um DESCONHECIDO — todo o
 * resto vem do operador (SAF, share) ou de uma URL que o próprio app cunhou — e
 * o único lugar em que um erro não vira pixel errado: vira **controle de acesso
 * quebrado**. O mesmo argumento que fez este projeto recusar o RFC 6455 ("~150
 * linhas de protocolo SEM ORÁCULO") vale contra um parser HTTP com
 * autenticação; daí ele e o [EspelhoPares] serem puros, e daí o JUnit ser a
 * QUARTA EXCEÇÃO declarada à regra de zero dependência.
 *
 * Bytes entram, uma [Req] validada sai; uma decisão entra, bytes de resposta
 * saem. Nada aqui abre socket nem sabe o que é uma rota. O `EspelhoServidor` tem
 * threads e sockets e **não decide nada que este arquivo decida**.
 *
 * ## A invariante 8 do `CLAUDE.md` SE INVERTE aqui
 *
 * No `shouldInterceptRequest` o `InputStream` devolvido é o recurso INTEIRO e
 * quem aplica o `Range` é o **próprio WebView** (ver [StreamProxy]). **Num
 * `ServerSocket` quem o aplica somos NÓS** — é o que [alcanceDe] faz, com a
 * gramática do RFC 7233 e JUnit próprio. **Copiar o [StreamProxy] para cá é o
 * erro exato**, porque aquele devolve a fatia como se fosse o todo justamente
 * para o WebView refatiar por cima.
 *
 * ## As oito invariantes
 *
 * 1. **Tetos duros, todos** — [TETO_LINHA], [TETO_CABECALHOS], [TETO_CABECALHO],
 *    [TETO_CORPO]. Fora do teto ⇒ resposta curta e `close`, sem drenar o resto:
 *    [Erro.CorpoLongo] é lançado ANTES de ler um byte do corpo, então quem manda
 *    `Content-Length: 4000000` não consegue nos fazer ler 4 MB. (O
 *    `setSoTimeout` é do servidor, porque é do socket.)
 * 2. **`read()` NUNCA é tratado como se entregasse a mensagem inteira** — toda
 *    leitura passa pelo laço de [Fonte]. Sem isso o parser desanda **só quando a
 *    rede está ruim**, que é o pior modo de falha: nunca acontece na bancada e
 *    sempre acontece no salão.
 * 3. **Allowlist EXATA de `Host`** (`<ip>:<porta>`, mais o nome TLS quando
 *    existir), montada em runtime pelo servidor; qualquer outro ⇒ 404. É a
 *    defesa contra **DNS rebinding**: uma página qualquer da internet, aberta
 *    por um visitante NA REDE DA IGREJA, pode fazer `evil.com` resolver para o
 *    nosso IP privado e virar same-origin. O LNA do Chromium mitiga a partir de
 *    origem pública; Safari e Firefox não, e o navegador de uma smart TV menos.
 * 4. **`Origin` ausente ou igual ao próprio** — qualquer outra ⇒ 404. E **nunca**
 *    emitir `Access-Control-Allow-Origin`: nem `*`, nem eco. Há teste que confere
 *    isso em toda resposta que sai daqui.
 * 5. **404 IDÊNTICO** para rota inexistente, token inválido, `Host` recusado e
 *    `Origin` estranha — mesmo status, mesmo corpo, byte a byte: não vazar
 *    existência. [Erro] distingue os casos para o **Registro** (um diagnóstico
 *    que não separa "tentativa de rebinding" de "lixo na linha" não serve), e
 *    [respostaDeErro] os colapsa.
 * 6. **Cabeçalhos em TODA resposta** — [CABECALHOS_SEMPRE], mais
 *    [CABECALHOS_PAGINA] na página.
 * 7. **Sem keep-alive, sem `Content-Encoding`**: uma requisição por conexão,
 *    `Connection: close`. O `nosniff` não é enfeite — sem ele o navegador segura
 *    os primeiros ~512 B para adivinhar o tipo, atrasando o primeiro quadro.
 *    **`Range` existe** (a rota de mídia o exige) e é NOSSO: [alcanceDe]
 *    interpreta com a semântica do RFC 7233 — malformado é IGNORADO e vira 200
 *    inteiro; só a faixa válida que não cabe leva 416.
 * 8. **Uma conexão, uma requisição**, e é isso que apaga a classe inteira do
 *    *request smuggling*: sem keep-alive não existe "próxima mensagem" no mesmo
 *    socket, e `Transfer-Encoding` em requisição é recusado de saída. Ainda
 *    assim as ambiguidades clássicas são recusadas uma a uma (dois
 *    `Content-Length`, dois `Host`, espaço antes do dois-pontos, continuação de
 *    linha) — custa uma linha cada, e o dia em que alguém puser um proxy na
 *    frente disto não vai vir com aviso.
 */
object EspelhoHttp {

    /** Linha de requisição (`GET /v HTTP/1.1`), sem o CRLF. */
    const val TETO_LINHA = 2 * 1024

    /** Cada linha de cabeçalho, sem o CRLF. */
    const val TETO_CABECALHO = 4 * 1024

    /** Quantidade de cabeçalhos. */
    const val TETO_CABECALHOS = 32

    /**
     * Corpo de `POST`. Os dois únicos corpos do protocolo são o pareamento
     * (`{"ua":…,"w":…,"h":…}` — sem segredo nenhum desde a v5.189, quando a
     * porta passou a ser o endereço) e a volta do cliente (`{"do":"alive",…}`),
     * e os dois cabem folgadamente. É um teto de PROTOCOLO, não de conveniência: ele é o
     * que garante que ninguém nos faça alocar memória pedindo.
     */
    const val TETO_CORPO = 256

    /**
     * O teto do corpo do canal de VOLTA (`POST /r`), que é **autenticado**.
     *
     * Ele é maior que o [TETO_CORPO] por uma razão de diagnóstico, e a
     * diferença entre os dois é a razão de existirem dois. O `POST /par` é
     * ANÔNIMO — qualquer um na rede o alcança — e 256 B são de sobra para um
     * relato de capacidades; apertá-lo é o que garante que ninguém nos faça
     * alocar memória pedindo. O `POST /r` só existe depois de o operador
     * ter aprovado aquela tela, e é por ele que chega **a única informação que
     * o servidor não tem como obter sozinho**: se a imagem está de fato
     * andando do outro lado.
     *
     * Até aqui cabia uma frase de 110 caracteres, e o resultado foi que o
     * Registro respondia "quantos bytes eu escrevi" enquanto a pergunta do
     * operador era "por que a tela está travando". Quadros perdidos pelo
     * decodificador, a folga real do cursor, o tamanho da fila de append e o
     * codec negociado não cabiam — e nenhum deles existe do lado de cá.
     *
     * 4 KiB continua sendo um teto de PROTOCOLO e não de conveniência: um
     * relato completo mede ~500 B, e o resto é folga para campos futuros sem
     * mexer nisto de novo.
     */
    const val TETO_CORPO_RETORNO = 4 * 1024

    /**
     * Uma requisição já validada.
     *
     * [caminho] chega **decodificado** (percent-decoding aplicado) e provado
     * ASCII imprimível; [host] chega em caixa baixa e provado contra a
     * allowlist; [origem] é `null` quando o cabeçalho não veio (que é o caso
     * NORMAL: navegador nenhum manda `Origin` em `GET` same-origin) e, quando
     * veio, já foi provada contra a mesma allowlist. [autorizacao] é o valor CRU
     * do cabeçalho `Authorization` — quem entende de `Bearer` é o
     * [EspelhoPares.validar], não o parser.
     *
     * Não compare dois [Req]: o `equals` gerado compara [corpo] por identidade,
     * porque é um `ByteArray`. Nada neste projeto compara requisições.
     */
    data class Req(
        val metodo: String,
        val caminho: String,
        val query: Map<String, String>,
        val host: String?,
        val origem: String?,
        val autorizacao: String?,
        val corpo: ByteArray,
        /**
         * O cabeçalho `Range` CRU, ou `null` (o caso de sempre). Capturado
         * desde a E1 do telão por comandos (`docs/TELAO-POR-COMANDOS.md`):
         * a rota de mídia `/m/` responde faixas DE VERDADE — num
         * `ServerSocket` a invariante 8 se inverte e o Range é NOSSO. Quem o
         * interpreta é [alcanceDe]; o parser só o carrega, como faz com
         * `Authorization`. Duplicata é recusa, como nos outros quatro campos
         * lidos.
         */
        val intervalo: String? = null,
    )

    /**
     * Por que os erros são objetos e não códigos: o servidor precisa de DOIS
     * usos diferentes da mesma falha — a resposta que vai para o fio (onde
     * `HostRecusado` e `OrigemEstranha` **têm de ser indistinguíveis** de um 404
     * comum) e a linha do Registro (onde precisam ser distinguíveis, senão o
     * operador não tem como saber que alguém tentou rebinding).
     *
     * Eles herdam de `Exception` porque [lerRequisicao] devolve `Result<Req>`, e
     * o `Result` do Kotlin só carrega `Throwable` no lado da falha. Mas são
     * SINAIS, não acidentes: [fillInStackTrace] é anulado de propósito — como são
     * `object`s, a pilha capturada seria a da carga da classe, isto é, um rastro
     * que aponta para o lugar errado com toda a autoridade de um rastro de
     * verdade.
     */
    sealed class Erro(motivo: String) : Exception(motivo) {
        override fun fillInStackTrace(): Throwable = this

        object LinhaLonga : Erro("linha de requisição acima do teto")
        object CabecalhoLongo : Erro("linha de cabeçalho acima do teto")
        object CabecalhosDemais : Erro("cabeçalhos acima do teto")
        object CorpoLongo : Erro("corpo acima do teto")
        object Malformado : Erro("requisição malformada")
        object Truncado : Erro("a conexão acabou no meio da requisição")
        object HostRecusado : Erro("Host fora da allowlist")
        object OrigemEstranha : Erro("Origin de outro origin")
    }

    /**
     * Vão em TODA resposta.
     *
     * `Connection: close` é a única política de conexão que este servidor tem —
     * ver a invariante 8. `no-store` porque nada daqui é cacheável (a página é
     * um estado de pareamento e o resto é fluxo vivo). `nosniff` porque a
     * adivinhação de tipo do navegador atrasa o primeiro quadro. `no-referrer`
     * para o endereço privado do celular não vazar para lugar nenhum se um dia a
     * página ganhar um link para fora.
     */
    val CABECALHOS_SEMPRE = listOf(
        "Cache-Control: no-store",
        "X-Content-Type-Options: nosniff",
        "Referrer-Policy: no-referrer",
        "Connection: close",
    )

    /**
     * Só na PÁGINA (`GET /`), somados aos de sempre.
     *
     * A especificação escreve esta política como
     * `default-src 'self'; frame-ancestors 'none'; base-uri 'none'`, e é dela que
     * vem tudo o que está aqui **menos as duas últimas diretivas**. Elas existem
     * porque `default-src 'self'` sozinho **proíbe `blob:` e `data:`**, e a
     * página que sai daqui é o `/web/display/` de verdade, que usa os dois:
     *
     *  - `blob:` — o `shared/stage.js` resolve toda mídia local por
     *    `URL.createObjectURL` (o `File` do OPFS, o `Blob` do registro, cada
     *    página de um deck), e o `display.js` faz o mesmo com o wallpaper
     *    personalizado. É o MESMO motor do telão, e ele não tem um caminho
     *    alternativo: sem `blob:` a tela da rede nasce sem mídia nenhuma.
     *  - `data:` — o `POSTER_VAZIO` do `stage.js`, o GIF 1×1 transparente que
     *    cobre o pôster padrão do WebView enquanto um `<video>` espera o
     *    primeiro quadro. O atributo `poster` é uma IMAGEM, então quem o
     *    governa é `img-src`, não `media-src`.
     *
     * (Este KDoc justificava as duas diretivas pelo "modo imagem" (JPEG por
     * `createObjectURL`) e pelo "modo vídeo" (a `MediaSource` do `<video>`) do
     * CLIENTE DO ESPELHO DE PIXELS — as duas formas de um recurso aposentado na
     * v5.187. As diretivas continuam necessárias; as razões acima é que são as
     * de verdade. Corrigido na v5.206.)
     *
     * **Não há `style-src`, e isso é uma decisão, não um esquecimento**: sem
     * `'unsafe-inline'`, todo estilo desta página tem de ser FOLHA servida deste
     * origin. Foi essa regra que a v5.205 aprendeu do jeito caro — um `<style>`
     * criado em runtime pelo `espelho/tela.js` era anexado e nunca aplicado, e a
     * entrada da tela ficava invisível e inclicável, sem erro nenhum. Ver o
     * cabeçalho de `espelho/tela.css`.
     *
     * A rigidez que a política pretende continua inteira: `blob:` e `data:` são,
     * por construção, do próprio documento (não são rede), e
     * `script-src`/`connect-src` seguem herdando `'self'` — é a herança que
     * BARRA a IFrame API do YouTube nas telas da rede, que é a exclusão §1 da
     * especificação virando garantia em vez de promessa.
     */
    val CABECALHOS_PAGINA = listOf(
        "Content-Security-Policy: default-src 'self'; frame-ancestors 'none'; " +
            "base-uri 'none'; img-src 'self' blob: data:; media-src 'self' blob:",
        "X-Frame-Options: DENY",
    )

    /**
     * Lê UMA requisição de [entrada] e a valida.
     *
     * [hostsAceitos] é a allowlist EXATA de `Host` (invariante 3), montada em
     * runtime pelo servidor: `<ip da wi-fi>:<porta>` e, quando houver TLS, o nome
     * do certificado. A comparação ignora caixa (nome de host não tem caixa),
     * mas não normaliza mais nada: `localhost`, `127.0.0.1` e um nome que RESOLVA
     * para o nosso IP são todos "outro" e levam 404. Uma allowlist VAZIA recusa
     * tudo, que é a falha segura certa para um servidor que ainda não sabe em que
     * endereço subiu.
     *
     * Devolve `Result` em vez de lançar porque a falha aqui é o caso NORMAL — a
     * primeira coisa que um `ServerSocket` numa rede de igreja recebe é um
     * scanner —, e caso normal não é exceção. `IOException` (inclusive o
     * `SocketTimeoutException` do `setSoTimeout` do servidor) vira
     * [Erro.Truncado]: do ponto de vista do parser, "o socket morreu" e "a
     * mensagem não chegou inteira" são a mesma coisa e têm a mesma resposta.
     */
    fun lerRequisicao(
        entrada: InputStream,
        hostsAceitos: Set<String>,
        /**
         * O teto do corpo, **decidido por quem conhece as rotas** — que não é
         * este arquivo (ver o KDoc do objeto: "nada aqui sabe o que é uma rota
         * do espelho"). O `EspelhoServidor` passa [TETO_CORPO_RETORNO] para o
         * `/r` autenticado e [TETO_CORPO] para todo o resto; o padrão mantém a
         * assinatura antiga válida e a postura fechada para quem não decidir.
         *
         * Ele é consultado com o caminho JÁ decodificado e provado, e ANTES de
         * um único byte de corpo ser lido: quem anuncia 4 MB continua não nos
         * fazendo alocar 4 MB.
         */
        tetoCorpo: (String) -> Int = { TETO_CORPO },
    ): Result<Req> =
        try {
            Result.success(analisar(Fonte(entrada), hostsAceitos, tetoCorpo))
        } catch (e: Erro) {
            Result.failure(e)
        } catch (_: IOException) {
            Result.failure(Erro.Truncado)
        }

    /**
     * A resposta que vai para o fio quando [lerRequisicao] falhou.
     *
     * `HostRecusado` e `OrigemEstranha` devolvem o 404 IDÊNTICO ao de rota
     * inexistente e ao de token inválido (invariante 5) — quem chama nunca
     * descobre, pela resposta, se errou o endereço ou se o recurso existe. Os
     * demais são sobre a FORMA da requisição, não sobre o que existe atrás dela:
     * dizer 413 a quem mandou um corpo de 4 MB não vaza nada e evita que um
     * cliente legítimo com um defeito fique adivinhando.
     */
    fun respostaDeErro(erro: Erro): ByteArray = when (erro) {
        is Erro.LinhaLonga -> curta(414)
        is Erro.CabecalhoLongo -> curta(431)
        is Erro.CabecalhosDemais -> curta(431)
        is Erro.CorpoLongo -> curta(413)
        is Erro.HostRecusado -> naoEncontrado()
        is Erro.OrigemEstranha -> naoEncontrado()
        is Erro.Malformado -> curta(400)
        is Erro.Truncado -> curta(400)
    }

    /**
     * O 404 canônico — o ÚNICO 404 que este servidor emite.
     *
     * Rota inexistente, token inválido, `Host` recusado, `Origin` estranha:
     * todos passam por aqui, para que a resposta seja a mesma até no
     * `Content-Length`. Devolve um array novo a cada chamada de propósito: um
     * `ByteArray` compartilhado é mutável, e a economia de 100 bytes não paga o
     * dia em que alguém escrever dentro dele.
     */
    fun naoEncontrado(): ByteArray = curta(404)

    /** Resposta completa, com `Content-Length` e corpo (nunca `chunked`). */
    fun resposta(
        status: Int,
        tipo: String,
        corpo: ByteArray,
        extra: List<String> = emptyList(),
    ): ByteArray {
        val cab = StringBuilder()
        cab.append("HTTP/1.1 ").append(status).append(' ').append(razao(status)).append("\r\n")
        cab.append("Content-Type: ").append(semQuebra(tipo)).append("\r\n")
        cab.append("Content-Length: ").append(corpo.size).append("\r\n")
        for (linha in CABECALHOS_SEMPRE) cab.append(linha).append("\r\n")
        for (linha in extra) cab.append(semQuebra(linha)).append("\r\n")
        cab.append("\r\n")
        return juntar(cab.toString().toByteArray(Charsets.US_ASCII), corpo)
    }

    /**
     * Só o cabeçalho de uma resposta `chunked` — o corpo vem depois, em [chunk],
     * até o culto acabar.
     *
     * Sem `Content-Length` (é o que `chunked` significa) e sem
     * `Content-Encoding`: comprimir H.264 ou JPEG não economiza nada e ainda
     * introduz um buffer intermediário entre o encoder e a rede, que é exatamente
     * onde a latência deste recurso mora.
     */
    fun cabecalhoChunked(
        status: Int,
        tipo: String,
        extra: List<String> = emptyList(),
    ): ByteArray {
        val cab = StringBuilder()
        cab.append("HTTP/1.1 ").append(status).append(' ').append(razao(status)).append("\r\n")
        cab.append("Content-Type: ").append(semQuebra(tipo)).append("\r\n")
        cab.append("Transfer-Encoding: chunked\r\n")
        for (linha in CABECALHOS_SEMPRE) cab.append(linha).append("\r\n")
        for (linha in extra) cab.append(semQuebra(linha)).append("\r\n")
        cab.append("\r\n")
        return cab.toString().toByteArray(Charsets.US_ASCII)
    }

    /**
     * Um pedaço do corpo `chunked`: `<tamanho em hex> CRLF <bytes> CRLF`.
     *
     * **[tam] = 0 é recusado, e esta é a linha mais importante do arquivo.** Um
     * chunk de tamanho zero **é** o terminador do corpo: um quadro vazio que
     * escapasse daqui não daria erro em lugar nenhum — encerraria o fluxo do
     * cliente educadamente, e o telão dele congelaria para sempre sem uma única
     * exceção nos dois lados. É o modo de falha que ninguém liga à causa, e por
     * isso ele é um `require`, não um `if` silencioso: o chamador é código nosso,
     * e um quadro vazio ali é defeito, não entrada.
     */
    fun chunk(bytes: ByteArray, ini: Int, tam: Int): ByteArray {
        require(tam > 0) { "chunk de tamanho 0 encerraria o corpo chunked" }
        require(ini >= 0 && tam <= bytes.size - ini) { "fatia fora do array" }
        val cab = (Integer.toHexString(tam) + "\r\n").toByteArray(Charsets.US_ASCII)
        val fora = ByteArray(cab.size + tam + 2)
        System.arraycopy(cab, 0, fora, 0, cab.size)
        System.arraycopy(bytes, ini, fora, cab.size, tam)
        fora[fora.size - 2] = '\r'.code.toByte()
        fora[fora.size - 1] = '\n'.code.toByte()
        return fora
    }

    /** O terminador do corpo `chunked`. Só o `desligar()` e o adeus o usam. */
    fun chunkFinal(): ByteArray = "0\r\n\r\n".toByteArray(Charsets.US_ASCII)

    // ------------------------------------------------- Range (RFC 7233, E1)
    //
    // A invariante 7 dizia "sem Range", e ela valia enquanto todas as rotas
    // eram fluxos infinitos. A rota de mídia do telão por comandos
    // (`docs/TELAO-POR-COMANDOS.md` §5.3) muda isso — e num `ServerSocket` o
    // Range é NOSSO por inteiro (a inversão da invariante 8, escrita no topo
    // deste arquivo): 206 com `Content-Range` de verdade, nunca o 200 seco do
    // StreamProxy, que existe para o refatiamento do WebView e aqui seria o
    // erro exato.

    /** Uma faixa RESOLVIDA contra o tamanho do recurso: `ini..fim`, inclusivos,
     *  sempre `0 <= ini <= fim < tamanho`. */
    data class Faixa(val ini: Long, val fim: Long) {
        val bytes: Long get() = fim - ini + 1
    }

    /**
     * O que fazer com um pedido diante de um `Range` — as TRÊS respostas que o
     * RFC 7233 permite, e nenhuma outra.
     *
     * [Inteiro] cobre também o malformado e o que não se quer atender
     * (multi-faixa, unidade estranha): o RFC manda IGNORAR um `Range` que não
     * se entende e responder 200 com o recurso inteiro — que é a degradação
     * certa, porque um 400 aqui quebraria um player legítimo por um cabeçalho
     * que ele tinha todo o direito de mandar. [Insatisfazivel] é só para a
     * faixa SINTATICAMENTE válida que não cabe no recurso (`ini >= tamanho`,
     * sufixo de zero bytes): essa merece o 416, senão o player repete o pedido
     * para sempre.
     */
    sealed class Alcance {
        object Inteiro : Alcance()
        data class Parcial(val faixa: Faixa) : Alcance()
        object Insatisfazivel : Alcance()
    }

    /** Dígitos no máximo neste tanto — a mesma disciplina do StreamProxy: um
     *  número de 16+ dígitos não é uma posição de arquivo, é um estouro. */
    private const val RANGE_DIGITOS = 15

    /**
     * Interpreta o cabeçalho `Range` de [Req.intervalo] contra um recurso de
     * [tamanho] bytes.
     *
     * Só `bytes` (a unidade é case-insensitive por RFC), só UMA faixa — as
     * três formas: `bytes=a-b`, `bytes=a-`, `bytes=-n`. Multi-faixa é
     * ignorada (200): atendê-la exigiria `multipart/byteranges`, que nenhum
     * `<video>` precisa. `a > b`, dígito quebrado, espaço no meio: malformado,
     * ignorado. `b` além do fim: TRUNCA (o RFC manda). `a >= tamanho` ou
     * sufixo `-0`: [Alcance.Insatisfazivel]. Recurso de tamanho 0 não tem
     * faixa satisfazível — qualquer `Range` válido vira 416, e sem `Range` o
     * chamador serve o 200 vazio de sempre.
     */
    fun alcanceDe(intervalo: String?, tamanho: Long): Alcance {
        if (intervalo == null) return Alcance.Inteiro
        val igual = intervalo.indexOf('=')
        if (igual <= 0) return Alcance.Inteiro
        // SEM trim interno, de propósito: o valor do cabeçalho já chegou com as
        // pontas aparadas pelo parser, e espaço DENTRO da especificação da
        // faixa está fora da gramática do RFC 7233. Tolerá-lo seria adivinhar —
        // e adivinhar é como nascem as divergências de interpretação entre dois
        // programas. Ignorado (200 inteiro), como todo malformado daqui.
        if (!intervalo.substring(0, igual).equals("bytes", ignoreCase = true)) {
            return Alcance.Inteiro
        }
        val resto = intervalo.substring(igual + 1)
        if (resto.contains(',')) return Alcance.Inteiro
        val traco = resto.indexOf('-')
        if (traco < 0) return Alcance.Inteiro
        val aTxt = resto.substring(0, traco)
        val bTxt = resto.substring(traco + 1)
        return when {
            // Sufixo: `bytes=-n`, os últimos n bytes.
            aTxt.isEmpty() -> {
                val n = numero(bTxt) ?: return Alcance.Inteiro
                if (n == 0L || tamanho <= 0L) return Alcance.Insatisfazivel
                val ini = maxOf(0L, tamanho - n)
                Alcance.Parcial(Faixa(ini, tamanho - 1))
            }
            // Aberta: `bytes=a-`, de a até o fim.
            bTxt.isEmpty() -> {
                val a = numero(aTxt) ?: return Alcance.Inteiro
                if (a >= tamanho) return Alcance.Insatisfazivel
                Alcance.Parcial(Faixa(a, tamanho - 1))
            }
            else -> {
                val a = numero(aTxt) ?: return Alcance.Inteiro
                val b = numero(bTxt) ?: return Alcance.Inteiro
                if (a > b) return Alcance.Inteiro
                if (a >= tamanho) return Alcance.Insatisfazivel
                Alcance.Parcial(Faixa(a, minOf(b, tamanho - 1)))
            }
        }
    }

    private fun numero(s: String): Long? {
        if (s.isEmpty() || s.length > RANGE_DIGITOS) return null
        for (c in s) if (c !in '0'..'9') return null
        return s.toLong()
    }

    /**
     * Só o CABEÇALHO de uma resposta com `Content-Length` — para corpos que o
     * servidor vai ESCREVER EM SEGUIDA, direto do arquivo, sem carregar na
     * memória (o StreamProxy lê o pedaço inteiro em RAM; três telas puxando um
     * vídeo de 380 MB por esse molde derrubariam o processo da projeção).
     * `Accept-Ranges: bytes` vai sempre: é ele que faz o `<video>` pedir
     * faixas em vez de recomeçar do zero a cada seek.
     */
    fun cabecalhoConteudo(
        tipo: String,
        tamanho: Long,
        extra: List<String> = emptyList(),
    ): ByteArray = cabecalhoComTamanho(200, tipo, tamanho, listOf("Accept-Ranges: bytes") + extra)

    /** O cabeçalho do 206: `Content-Range: bytes ini-fim/total` + o tamanho DA
     *  FAIXA — os dois números que um 206 não pode errar. */
    fun cabecalhoParcial(
        tipo: String,
        faixa: Faixa,
        total: Long,
        extra: List<String> = emptyList(),
    ): ByteArray = cabecalhoComTamanho(
        206,
        tipo,
        faixa.bytes,
        listOf(
            "Content-Range: bytes ${faixa.ini}-${faixa.fim}/$total",
            "Accept-Ranges: bytes",
        ) + extra,
    )

    /** O 416, com o `Content-Range` de asterisco (`bytes *&#47;total`) que diz
     *  ao player o tamanho real — sem ele não há como corrigir o pedido. */
    fun resposta416(total: Long): ByteArray = resposta(
        416,
        "text/plain; charset=utf-8",
        "416".toByteArray(Charsets.US_ASCII),
        listOf("Content-Range: bytes */$total"),
    )

    /**
     * O mesmo cabeçalho, para quem ESPELHA a resposta de outro servidor (a
     * rota `/s/` da transmissão direta, v5.189): ali o status e o
     * `Content-Range` vêm do CDN, não de um cálculo nosso, e as duas outras
     * portas ([cabecalhoConteudo] e [cabecalhoParcial]) presumem o contrário.
     */
    fun cabecalhoComTamanhoPublico(
        status: Int,
        tipo: String,
        tamanho: Long,
        extra: List<String> = emptyList(),
    ): ByteArray = cabecalhoComTamanho(status, tipo, tamanho, extra)

    /**
     * O funil de cabeçalho VINDO DE FORA — a rota `/s/` repassa o
     * `Content-Type` e o `Content-Range` que o CDN mandou, e uma linha de
     * resposta de outro servidor não pode carregar `\r\n` para dentro da nossa
     * (injeção de cabeçalho).
     *
     * Ele **filtra**, ao contrário do [semQuebra] interno, que LANÇA. A
     * diferença é a origem do texto e ela é a regra do projeto inteiro: um
     * caractere inválido num cabeçalho que nós montamos é defeito de
     * programação (e uma exceção é a resposta certa); num cabeçalho que veio
     * da rede é só dado sujo, e derrubar a projeção por causa dele seria
     * deixar um terceiro escolher quando o culto para.
     */
    fun semQuebraPublica(s: String): String {
        val sb = StringBuilder(s.length)
        for (c in s) if (c >= ' ' && c <= '~') sb.append(c)
        return sb.toString()
    }

    private fun cabecalhoComTamanho(
        status: Int,
        tipo: String,
        tamanho: Long,
        extra: List<String>,
    ): ByteArray {
        require(tamanho >= 0) { "tamanho negativo" }
        val cab = StringBuilder()
        cab.append("HTTP/1.1 ").append(status).append(' ').append(razao(status)).append("\r\n")
        cab.append("Content-Type: ").append(semQuebra(tipo)).append("\r\n")
        cab.append("Content-Length: ").append(tamanho).append("\r\n")
        for (linha in CABECALHOS_SEMPRE) cab.append(linha).append("\r\n")
        for (linha in extra) cab.append(semQuebra(linha)).append("\r\n")
        cab.append("\r\n")
        return cab.toString().toByteArray(Charsets.US_ASCII)
    }

    // ------------------------------------------------------- SSE (E1/E2)
    //
    // O fluxo de comandos do telão por comandos é `text/event-stream` SOBRE o
    // chunked que este arquivo já emite — três linhas de framing, nenhum
    // protocolo novo. O cliente é `fetch`+`ReadableStream` (o mesmo transporte
    // do GET /v de sempre, com `Authorization` no header — `EventSource` não
    // manda header, e o token nunca viaja numa URL).

    /** O cabeçalho do fluxo de eventos. */
    fun cabecalhoSse(extra: List<String> = emptyList()): ByteArray =
        cabecalhoChunked(200, "text/event-stream", extra)

    /**
     * Um evento: `data: <json>\n\n`, pronto para virar UM [chunk].
     *
     * O `require` é a mesma doutrina do [semQuebra]: uma quebra de linha crua
     * dentro do JSON partiria o evento em dois — e ela só pode vir de código
     * NOSSO, porque `JSON.stringify`/`JSONObject.toString` escapam `\n` dentro
     * de strings. Defeito, não entrada.
     */
    fun eventoSse(json: String): ByteArray {
        for (c in json) require(c != '\n' && c != '\r') { "evento SSE com quebra de linha" }
        return ("data: " + json + "\n\n").toByteArray(Charsets.UTF_8)
    }

    /**
     * O batimento: um COMENTÁRIO SSE (`: ping <epoch-ms>`) a cada 15 s.
     *
     * Ele paga três contas de uma vez (spec §3.8): o vigia de fio do cliente,
     * a detecção de TCP meio-aberto do lado do servidor (a escrita falha) e a
     * renovação do wake lock do EspelhoService, que é por progresso real de
     * escrita. O epoch é a referência da correção de relógio das telas — o
     * cronômetro e o sorteio viajam por descritor ancorado em `Date.now()` do
     * celular, e uma Smart TV com o relógio minutos fora contaria errado.
     */
    fun pingSse(epochMs: Long): ByteArray =
        (": ping " + epochMs + "\n\n").toByteArray(Charsets.US_ASCII)

    // ---------------------------------------------------------------- interno

    private fun analisar(
        f: Fonte,
        hostsAceitos: Set<String>,
        tetoCorpo: (String) -> Int,
    ): Req {
        // RFC 7230 §3.5 manda tolerar UMA linha em branco antes da requisição
        // (clientes antigos emitem um CRLF sobrando depois de um corpo). Uma, e
        // não um laço: um laço é um cliente mudo prendendo a thread de graça.
        var linha = f.linha(TETO_LINHA, Erro.LinhaLonga)
        if (linha.isEmpty()) linha = f.linha(TETO_LINHA, Erro.LinhaLonga)

        val partes = linha.split(' ')
        if (partes.size != 3) throw Erro.Malformado
        val metodo = partes[0]
        // Só GET e POST existem no protocolo do espelho (§5.1). Recusar aqui, e
        // não no roteador, é o que garante que nenhum método exótico chegue perto
        // do controle de acesso.
        if (metodo != "GET" && metodo != "POST") throw Erro.Malformado
        if (partes[2] != "HTTP/1.1" && partes[2] != "HTTP/1.0") throw Erro.Malformado

        // Só origin-form. A forma absoluta (`GET http://host/x`) existe para
        // proxies e traria uma SEGUNDA fonte de "host" para dentro do parser —
        // duas fontes de verdade sobre o mesmo campo é precisamente a matéria
        // de que são feitos os ataques de confusão de host.
        val alvo = partes[1]
        if (!alvo.startsWith("/")) throw Erro.Malformado
        val corte = alvo.indexOf('?')
        val caminho = decodificar(if (corte < 0) alvo else alvo.substring(0, corte), false)
        for (c in caminho) if (c < ' ' || c > '~') throw Erro.Malformado
        // O roteamento é por MAPA FIXO, então um `..` não teria para onde ir —
        // mas ele também não tem por que existir numa rota nossa, e recusá-lo
        // custa uma linha. Mesma disciplina do `canonicalPath` no WebPathHandler.
        if (caminho.contains("..")) throw Erro.Malformado
        val query: Map<String, String> =
            if (corte < 0) emptyMap() else analisarQuery(alvo.substring(corte + 1))

        var host: String? = null
        var origem: String? = null
        var autorizacao: String? = null
        var intervalo: String? = null
        var tamanho: Int? = null
        var quantos = 0
        while (true) {
            val l = f.linha(TETO_CABECALHO, Erro.CabecalhoLongo)
            if (l.isEmpty()) break
            if (++quantos > TETO_CABECALHOS) throw Erro.CabecalhosDemais
            // Continuação de linha (obs-fold): morta desde o RFC 7230, e o que
            // ela faz de vivo é confundir intermediários.
            if (l.startsWith(" ")) throw Erro.Malformado
            val dp = l.indexOf(':')
            if (dp <= 0) throw Erro.Malformado
            // "No whitespace is allowed between the header field-name and colon"
            // — e a resposta prescrita a isso é rejeitar a mensagem inteira.
            if (l[dp - 1] == ' ') throw Erro.Malformado
            val nome = l.substring(0, dp).lowercase()
            val valor = l.substring(dp + 1).trim()
            // Duplicata de qualquer campo que este parser LEIA é recusa: com dois
            // `Host` ou dois `Content-Length` não existe leitura certa, existe
            // uma escolha — e é da divergência entre escolhas de dois programas
            // que nasce o request smuggling.
            when (nome) {
                "host" -> {
                    if (host != null) throw Erro.Malformado
                    host = valor.lowercase()
                }
                "origin" -> {
                    if (origem != null) throw Erro.Malformado
                    origem = valor
                }
                "authorization" -> {
                    if (autorizacao != null) throw Erro.Malformado
                    autorizacao = valor
                }
                "range" -> {
                    if (intervalo != null) throw Erro.Malformado
                    intervalo = valor
                }
                "content-length" -> {
                    if (tamanho != null) throw Erro.Malformado
                    tamanho = valor.toIntOrNull() ?: throw Erro.Malformado
                }
                // Não existe upload em chunks neste protocolo, e `Transfer-Encoding`
                // convivendo com `Content-Length` é o smuggling clássico.
                "transfer-encoding" -> throw Erro.Malformado
            }
        }

        val corpo: ByteArray
        if (metodo == "POST") {
            val n = tamanho ?: throw Erro.Malformado
            if (n < 0) throw Erro.Malformado
            // ANTES de ler: quem anuncia 4 MB não nos faz alocar 4 MB.
            if (n > tetoCorpo(caminho)) throw Erro.CorpoLongo
            corpo = f.exato(n)
        } else {
            // GET com corpo: legal na letra do RFC, sem sentido aqui, e ler (ou
            // não ler) esse corpo é justamente a divergência que o smuggling
            // explora. Recusa.
            if ((tamanho ?: 0) > 0) throw Erro.Malformado
            corpo = ByteArray(0)
        }

        // Host: exigido, exato, allowlist. Ausente cai no MESMO 404 — não é
        // "malformado" que interessa dizer aqui, é não dizer nada.
        val h = host ?: throw Erro.HostRecusado
        if (hostsAceitos.none { it.equals(h, ignoreCase = true) }) throw Erro.HostRecusado

        // Origin: ausente é o caso NORMAL (o navegador não manda `Origin` em GET
        // same-origin, mesmo com `Authorization`); presente só pode ser o nosso
        // (o POST de pareamento manda). "null" literal — origem opaca, isto é,
        // iframe sandbox ou `data:` — é recusada: nenhum cliente legítimo deste
        // servidor tem origem opaca.
        val o = origem
        if (o != null && !origemAceita(o, hostsAceitos)) throw Erro.OrigemEstranha

        return Req(metodo, caminho, query, h, o, autorizacao, corpo, intervalo)
    }

    private fun origemAceita(origem: String, hostsAceitos: Set<String>): Boolean {
        val semEsquema = when {
            origem.startsWith("http://", ignoreCase = true) -> origem.substring(7)
            origem.startsWith("https://", ignoreCase = true) -> origem.substring(8)
            else -> return false
        }
        if (semEsquema.isEmpty() || semEsquema.contains('/')) return false
        return hostsAceitos.any { it.equals(semEsquema, ignoreCase = true) }
    }

    /**
     * A query não é usada por rota nenhuma do protocolo — e não é por acaso: o
     * token NUNCA viaja numa URL ([EspelhoPares], invariante 2). Ela é decodificada
     * mesmo assim para que um dia ninguém precise escrever este código com pressa.
     */
    private fun analisarQuery(cru: String): Map<String, String> {
        if (cru.isEmpty()) return emptyMap()
        val mapa = LinkedHashMap<String, String>()
        for (parte in cru.split('&')) {
            if (parte.isEmpty()) continue
            val i = parte.indexOf('=')
            val chave = decodificar(if (i < 0) parte else parte.substring(0, i), true)
            val valor = decodificar(if (i < 0) "" else parte.substring(i + 1), true)
            // Depois de decodificar, o texto volta a poder conter controle — e é
            // por aí que se injeta linha falsa em log. Recusa, não saneamento:
            // aqui ainda dá para dizer não.
            for (c in chave) if (c.code < 0x20 || c.code == 0x7F) throw Erro.Malformado
            for (c in valor) if (c.code < 0x20 || c.code == 0x7F) throw Erro.Malformado
            mapa[chave] = valor
        }
        return mapa
    }

    /**
     * Percent-decoding. Escape quebrado ⇒ [Erro.Malformado]: um cliente que erra
     * o `%` é um cliente quebrado, e adivinhar o que ele quis dizer é como se
     * inventam as discordâncias de interpretação entre dois programas.
     */
    private fun decodificar(s: String, maisEhEspaco: Boolean): String {
        if (!s.contains('%') && !(maisEhEspaco && s.contains('+'))) return s
        val fora = ByteArrayOutputStream(s.length)
        var i = 0
        while (i < s.length) {
            val c = s[i]
            when {
                c == '%' -> {
                    if (i + 2 >= s.length) throw Erro.Malformado
                    fora.write((hex(s[i + 1]) shl 4) or hex(s[i + 2]))
                    i += 3
                }
                maisEhEspaco && c == '+' -> {
                    fora.write(0x20)
                    i++
                }
                else -> {
                    // A linha inteira já foi provada ASCII imprimível em [Fonte].
                    fora.write(c.code)
                    i++
                }
            }
        }
        return String(fora.toByteArray(), Charsets.UTF_8)
    }

    private fun hex(c: Char): Int = when (c) {
        in '0'..'9' -> c - '0'
        in 'a'..'f' -> c - 'a' + 10
        in 'A'..'F' -> c - 'A' + 10
        else -> throw Erro.Malformado
    }

    /**
     * Uma resposta de erro sem corpo útil, do tamanho de um respiro.
     *
     * O corpo é o número do status em texto porque um corpo VAZIO faz alguns
     * navegadores mostrarem a própria página de erro deles, o que confunde quem
     * está diagnosticando — e porque, sendo derivado só do status, ele mantém a
     * promessa da invariante 5: todos os 404 daqui são idênticos entre si.
     */
    private fun curta(status: Int): ByteArray =
        resposta(status, "text/plain; charset=utf-8", status.toString().toByteArray(Charsets.US_ASCII))

    /**
     * Um cabeçalho com CR ou LF dentro é injeção de resposta — mas aqui isso só
     * pode vir de código NOSSO (os valores da rede nunca são ecoados numa
     * resposta deste servidor), então é defeito de programação e sai como
     * `IllegalArgumentException`, não como 400.
     */
    private fun semQuebra(s: String): String {
        for (c in s) require(c >= ' ' && c <= '~') { "cabeçalho com caractere inválido" }
        return s
    }

    private fun razao(status: Int): String = when (status) {
        200 -> "OK"
        202 -> "Accepted"
        206 -> "Partial Content"
        302 -> "Found"
        400 -> "Bad Request"
        403 -> "Forbidden"
        404 -> "Not Found"
        413 -> "Payload Too Large"
        414 -> "URI Too Long"
        416 -> "Range Not Satisfiable"
        431 -> "Request Header Fields Too Large"
        500 -> "Internal Server Error"
        else -> if (status < 400) "OK" else "Error"
    }

    private fun juntar(a: ByteArray, b: ByteArray): ByteArray {
        val fora = ByteArray(a.size + b.size)
        System.arraycopy(a, 0, fora, 0, a.size)
        System.arraycopy(b, 0, fora, a.size, b.size)
        return fora
    }

    /**
     * O laço de leitura — a invariante 2 encarnada.
     *
     * `InputStream.read(buf, off, len)` **não promete `len` bytes**: promete pelo
     * menos um. Num socket de rede local isso quase sempre coincide com a
     * mensagem inteira, e é por isso que um parser escrito sem laço passa em toda
     * bancada e desanda só no aparelho, com a rede ruim, no domingo. Todo byte
     * que este arquivo lê passa por aqui.
     *
     * `read` devolvendo `<= 0` é tratado como fim de fluxo. O contrato só permite
     * 0 quando `len` é 0 (nunca é, aqui), mas um `InputStream` mal comportado que
     * devolvesse 0 num laço "tente de novo" prenderia a thread para sempre — e
     * este é um laço que roda com um desconhecido do outro lado.
     */
    private class Fonte(private val entrada: InputStream) {

        private val buf = ByteArray(2048)
        private var ini = 0
        private var fim = 0

        private fun encher(): Boolean {
            if (ini < fim) return true
            ini = 0
            fim = 0
            val n = entrada.read(buf, 0, buf.size)
            if (n <= 0) return false
            fim = n
            return true
        }

        private fun proximo(): Int {
            if (!encher()) throw Erro.Truncado
            return buf[ini++].toInt() and 0xFF
        }

        /**
         * Uma linha terminada em LF (com o CR opcional imediatamente antes), com
         * no máximo [teto] bytes ÚTEIS.
         *
         * O CR não conta para o teto — senão uma linha de exatamente [teto] bytes
         * seria recusada por causa do terminador, e um teto que reprova o valor
         * que ele mesmo anuncia é um teto errado.
         *
         * Depois do corte, tudo fora de `[\x20-\x7E]` é [Erro.Malformado]: é o
         * que barra NUL, tabulação, CR solto no meio e qualquer byte alto antes
         * de eles chegarem a um nome de cabeçalho, a um caminho ou a uma linha de
         * log.
         */
        fun linha(teto: Int, seEstourar: Erro): String {
            val sb = StringBuilder()
            while (true) {
                val b = proximo()
                if (b == 0x0A) break
                if (sb.length > teto) throw seEstourar
                sb.append(Char(b))
            }
            var linha = sb.toString()
            if (linha.endsWith('\r')) linha = linha.substring(0, linha.length - 1)
            if (linha.length > teto) throw seEstourar
            for (c in linha) if (c < ' ' || c > '~') throw Erro.Malformado
            return linha
        }

        /** Exatamente [n] bytes, ou [Erro.Truncado]. */
        fun exato(n: Int): ByteArray {
            val fora = ByteArray(n)
            var escrito = 0
            while (escrito < n) {
                if (!encher()) throw Erro.Truncado
                val lote = minOf(fim - ini, n - escrito)
                System.arraycopy(buf, ini, fora, escrito, lote)
                ini += lote
                escrito += lote
            }
            return fora
        }
    }
}
