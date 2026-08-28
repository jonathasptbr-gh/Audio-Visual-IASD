package br.org.iasd.av

/**
 * A DECISÃO DE ROTA DO NÚCLEO — **PURA, zero import de nada**.
 *
 * Ela é o irmão do [EspelhoHttp] no eixo que ele não cobre: aquele lê a
 * requisição e não sabe o que é uma rota; este decide o que uma rota É, e não
 * sabe o que é um socket. Os dois juntos são o que o servidor precisa saber
 * antes de tocar num arquivo.
 *
 * ## Por que ela é um arquivo à parte, e puro
 *
 * Porque é aqui que mora a **travessia de diretório** — a única classe de falha
 * deste caminho que não é um pixel errado, é o disco do operador servido pela
 * rede. Um `GET /shared/../../../../etc/passwd` é uma string, e uma string se
 * testa sem abrir socket nenhum. O projeto já tomou essa decisão duas vezes
 * (`EspelhoHttp`, `EspelhoInterfaces`) e pelo mesmo motivo: *num parser com
 * controle de acesso, um erro não vira pixel errado — vira porta aberta.*
 *
 * ## O que este servidor tem e o da LAN NÃO tem
 *
 * `controle/`. O `EspelhoServidor` o recusa de propósito (a tela da rede recebe
 * o Display e mais nada — é controle de acesso, não economia), e aqui ele é o
 * ponto inteiro: o operador está NESTA máquina, e o socket não sai dela.
 *
 * **É por isso que são DOIS servidores e não um com uma bandeira.** Um
 * `if (ehLocal)` dentro da tabela de rotas do espelho é a forma exata de vazar
 * o Controle para a rede da igreja no primeiro refactor distraído — e o modo de
 * falhar seria mudo: tudo continua funcionando, e a folha de controle passa a
 * estar num endereço que qualquer um na Wi-Fi alcança.
 */
object NucleoRotas {

    /** O que uma requisição É, depois de decidida. */
    sealed class Rota {
        /** Um arquivo do bundle. [relativo] já é seguro: sem `..`, sem raiz. */
        data class Bundle(val relativo: String, val tipo: String) : Rota()

        /** `POST /ponte/call` — uma chamada da ponte. */
        object PonteCall : Rota()

        /** `GET /ponte/e` — o fio por onde o núcleo empurra (SSE). */
        object PonteEventos : Rota()

        /**
         * `GET /saf/<sessao>/<token>` — um arquivo do DISCO do operador.
         *
         * A sessão está na URL, e não é decoração: no Android o WebView do
         * telão é montado **sem** o handler `/saf/`, e aqui as duas janelas
         * dividem um socket (a porta é a origem — um segundo socket seria um
         * segundo IndexedDB). Sem a sessão no caminho, servir isto devolveria
         * ao Telão o que o Android lhe nega. Ver [NucleoArquivos].
         */
        data class Arquivo(val sessao: String, val token: String) : Rota()

        /** `GET /` — o operador abriu o endereço na mão. */
        object Raiz : Rota()

        /**
         * Tudo o mais. **404 uniforme**: ele não distingue "não existe" de
         * "existe e você não pode", que é a mesma disciplina do espelho.
         */
        object NaoAchei : Rota()
    }

    /**
     * OS PREFIXOS QUE ESTE SERVIDOR SERVE.
     *
     * Lista de PERMISSÃO, como o dreno do papel `tela`: um diretório novo em
     * `assets/web/` nasce **inacessível** e é preciso escrevê-lo aqui. O
     * inverso — uma lista de negação — deixaria um diretório novo exposto por
     * omissão, que é o defeito que ninguém procura.
     */
    val PREFIXOS = listOf("controle/", "display/", "shared/", "espelho/", "vendor/")

    /**
     * Os prefixos cujo diretório tem um `index.html` de verdade. Pedir
     * `/shared/` não é pedir um arquivo, e responder o índice de um diretório
     * que não tem um é confirmar que ele existe.
     */
    val COM_INDICE = setOf("controle/", "display/")

    /**
     * Os arquivos soltos da raiz do bundle que fazem sentido servir.
     *
     * `version.json` é lido pelo próprio app (o rodapé de Configurações);
     * `notas.json` é a linha do tempo da atualização. Nada mais da raiz sai —
     * em particular, não há caminho para um arquivo que alguém deixe ali.
     */
    val RAIZ_PERMITIDA = setOf("version.json", "notas.json")

    /**
     * O tipo de conteúdo pela EXTENSÃO, e um padrão que **não é HTML**.
     *
     * `application/octet-stream` de propósito: um arquivo desconhecido servido
     * como `text/html` é um convite a que o navegador o interprete. O padrão
     * fecha, e a lista abre.
     */
    val TIPOS = mapOf(
        "html" to "text/html; charset=utf-8",
        "js" to "text/javascript; charset=utf-8",
        "css" to "text/css; charset=utf-8",
        "json" to "application/json; charset=utf-8",
        "svg" to "image/svg+xml",
        "woff2" to "font/woff2",
        "png" to "image/png",
        "jpg" to "image/jpeg",
        "jpeg" to "image/jpeg",
        "webp" to "image/webp",
        "mp3" to "audio/mpeg",
        "m4a" to "audio/mp4",
        "mp4" to "video/mp4",
        "webm" to "video/webm",
    )

    const val TIPO_PADRAO = "application/octet-stream"

    /** A extensão em minúsculas, ou vazio. */
    fun extensao(caminho: String): String {
        val barra = caminho.lastIndexOf('/')
        val ponto = caminho.lastIndexOf('.')
        if (ponto <= barra + 1) return ""
        return caminho.substring(ponto + 1).lowercase()
    }

    fun tipoDe(caminho: String): String = TIPOS[extensao(caminho)] ?: TIPO_PADRAO

    /**
     * Decide o que [caminho] é. [metodo] importa: `/ponte/call` só existe em
     * POST, e um GET nele é 404 — **não 405**. Dizer "o método está errado" é
     * confirmar que a rota existe.
     *
     * [caminho] chega **já decodificado** pelo [EspelhoHttp] e é tratado como
     * hostil: qualquer `..` em qualquer segmento derruba a requisição inteira,
     * ANTES de qualquer normalização. Normalizar primeiro e conferir depois é a
     * ordem que produz as travessias que existem no mundo.
     */
    fun decidir(metodo: String, caminho: String): Rota {
        if (!caminho.startsWith("/")) return Rota.NaoAchei
        // Sem espaço, sem NUL e sem BARRA INVERTIDA. Ela entra aqui porque o
        // alvo é o Windows, onde `\` TAMBÉM é separador de caminho — um `\`
        // que chegue intacto até um `File` vira um nível acima que nenhuma
        // conferência escrita só com `/` pegaria.
        if (caminho.any { it == ' ' || it == '\\' || it.code == 0 }) return Rota.NaoAchei
        val cru = caminho.substring(1)
        if (cru.split('/').any { it == ".." || it == "." }) return Rota.NaoAchei

        if (cru.isEmpty()) return if (metodo == "GET") Rota.Raiz else Rota.NaoAchei
        if (cru == "ponte/call") return if (metodo == "POST") Rota.PonteCall else Rota.NaoAchei
        if (cru == "ponte/e") return if (metodo == "GET") Rota.PonteEventos else Rota.NaoAchei
        if (metodo != "GET") return Rota.NaoAchei

        if (cru.startsWith("saf/")) {
            val p = cru.split('/')
            // TRÊS segmentos EXATOS. Um a mais viraria um caminho dentro do
            // arquivo, e é assim que uma rota de arquivo vira uma travessia.
            if (p.size != 3 || !sessaoValida(p[1]) || !NucleoArquivos.tokenValido(p[2])) {
                return Rota.NaoAchei
            }
            return Rota.Arquivo(p[1], p[2])
        }

        if (cru in RAIZ_PERMITIDA) return Rota.Bundle(cru, tipoDe(cru))

        val prefixo = PREFIXOS.firstOrNull { cru.startsWith(it) } ?: return Rota.NaoAchei
        // Um pedido de DIRETÓRIO vira o `index.html` dele. É o que faz
        // `/controle/` funcionar como endereço, e é a mesma regra que o
        // servidor de mentira dos oráculos já usa.
        if (cru == prefixo) {
            return if (prefixo in COM_INDICE) Rota.Bundle(prefixo + "index.html", TIPOS["html"]!!)
            else Rota.NaoAchei
        }
        if (cru.endsWith("/")) return Rota.NaoAchei
        return Rota.Bundle(cru, tipoDe(cru))
    }


    /**
     * A FORMA de uma sessão de janela.
     *
     * Cada janela do programa (Controle e Telão) recebe da casca um
     * identificador aleatório, e ele viaja na query das duas rotas da ponte
     * (`?s=`). Ele responde a duas perguntas que o servidor não teria como
     * responder sozinho:
     *
     *  - **para quem volta a resposta.** No Android o `evaluateJavascript`
     *    endereça UM WebView; aqui há um fio SSE por janela, e um `resolve`
     *    entregue à janela errada resolveria a promise homônima dela.
     *  - **quem NÃO recebe um comando do barramento.** O `BroadcastChannel`
     *    não entrega ao próprio emissor e o `MessageBus` exclui a origem —
     *    sem essa exclusão o `busPost` do Controle voltaria para o Controle,
     *    e o `__mid` do `db.js` **não o pegaria**: aquele conjunto só conhece
     *    os mids RECEBIDOS, e o emissor nunca viu o próprio.
     *
     * Ele NÃO é segredo — este socket é de loopback e tem allowlist de `Host`.
     * É endereço. A forma é conferida porque ele indexa um mapa e sai num
     * diagnóstico, não porque ele autentique alguém.
     */
    fun sessaoValida(s: String?): Boolean =
        s != null && s.length in 8..64 &&
            s.all { it in 'a'..'z' || it in 'A'..'Z' || it in '0'..'9' || it == '_' || it == '-' }

    /**
     * A allowlist de `Host` deste servidor, para o [EspelhoHttp.lerRequisicao].
     *
     * **Sem ela o núcleo é alcançável por DNS rebinding**: um site qualquer faz
     * um nome apontar para 127.0.0.1 e passa a falar com ele pelo navegador do
     * operador — e este servidor expõe a ponte INTEIRA, que é a superfície mais
     * privilegiada do programa. É a mesma defesa que o espelho já tem, pela
     * mesma razão, com uma diferença que ajuda: aqui os dois nomes são literais
     * e conhecidos, não uma faixa de endereços.
     */
    fun hostsAceitos(porta: Int): Set<String> =
        setOf("127.0.0.1:$porta", "localhost:$porta")
}
