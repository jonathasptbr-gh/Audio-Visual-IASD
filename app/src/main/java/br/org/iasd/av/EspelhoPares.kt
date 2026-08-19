package br.org.iasd.av

import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64

/**
 * O controle de acesso do telão por comandos: tokens, prazo e o castigo de quem
 * foi derrubado. **ZERO import de Android**, pelo mesmo motivo do [EspelhoHttp]:
 * este e aquele são as duas peças em que um erro não vira pixel errado e sim
 * porta aberta, e são as duas que o JUnit cobre. O `EspelhoServidor` faz sockets
 * e threads e **não decide nada que este arquivo decida**.
 *
 * ## As invariantes
 *
 * 1. **Token de 128 bits em base64url, `SecureRandom`** — aleatório, não
 *    contador, opaco (o desenho do `SafRegistry`).
 * 2. **O token NUNCA viaja numa URL** — nem `?t=`, nem fragmento: URL vaza para
 *    histórico, cache, captura e compartilhamento de tela. Ele vive no
 *    `sessionStorage` e sobe em `Authorization: Bearer`, e é por isso que todo
 *    pedido do cliente é `fetch` (um `<img src>` não mandaria o cabeçalho).
 *    [validar] recebe o cabeçalho CRU e faz ela mesma a leitura do esquema —
 *    deixar o servidor fatiar string vinda da rede é o tipo de decisão que esta
 *    separação existe para impedir.
 * 3. **O token tem prazo FIXO e morre com a sessão** ([PRAZO_SESSAO_MS];
 *    [desligar] zera tudo). **Não é renovado pelo uso:** uma janela deslizante
 *    nunca expira enquanto alguém a usar, que é precisamente o caso do token
 *    vazado. O carimbo de uso ([Sessao.ultimoUsoMs]) só faz uma sessão morrer
 *    MAIS CEDO — é o que permite a [liberarVagaOciosa] tomar a vaga de quem foi
 *    embora, e nunca estende o prazo de ninguém.
 * 4. **Comparação em tempo constante** (`MessageDigest.isEqual`) — e, pelo mesmo
 *    motivo, as sessões vivem numa LISTA percorrida inteira: um `HashMap[token]`
 *    compara por hash e sai na primeira diferença, jogando fora no lookup o
 *    cuidado tomado na comparação. Com teto de três, percorrer é de graça.
 * 5. **A PORTA É O ENDEREÇO, e quem o abre ENTRA — sem código, sem fila.** O
 *    endereço deste aparelho nesta rede já é a credencial (quem não configurou a
 *    tela não o tem, e ele muda de rede para rede); o conteúdo é o que a
 *    congregação está vendo, e o dano de um curioso é ocupar uma das três vagas.
 *    O que SEGURA o recurso é o teto de [MAX_SESSOES], o [derrubar] com o
 *    castigo de [BLOQUEIO_DERRUBADA_MS] (sem ele "Desconectar" não faria nada) e
 *    o fato de o servidor só existir enquanto o operador o mantiver ligado.
 * 6. **A entrada é anônima e imediata**, e o único freio é o castigo: não há
 *    segredo a errar, logo não há bloqueio crescente. O mapa de castigos guarda
 *    **só** quem o operador derrubou. Sem vaga, [Veredito.Lotada] — uma FRASE, e
 *    não a recusa genérica, porque a saída dela é fechar uma das outras.
 * 7. **A página de pareamento é ANÔNIMA** — sem versão, nome do aparelho, SSID
 *    ou nome da igreja. Este arquivo colabora não tendo isso para dar.
 * 8. **Teto de [MAX_SESSOES].** (O teto de CONEXÕES em voo e a regra de que um
 *    `GET /v` com token repetido fecha a anterior são do servidor: sockets, não
 *    pareamento.)
 * 9. **Todo texto vindo da rede é saneado AQUI**, não no JS: `[\x20-\x7E]`, corte
 *    duro em [TETO_TEXTO], `\n`/`\r` impossíveis, aspas trocadas. O `ua` vai para
 *    o **Registro**, que o projeto manda copiar e repassar — um `\n` ali injeta
 *    linhas falsas, e **um diagnóstico que mente é pior que diagnóstico nenhum**.
 *    (O `controle.js` monta o Registro com `textContent`, nunca `innerHTML`:
 *    aquela linha é a diferença entre um espelho e a execução de JavaScript de
 *    um desconhecido no origin que injeta `__AVBridge`. Ela é load-bearing.)
 *
 * ## Por que um `object` com estado
 *
 * [ligar] **zera tudo**, o que torna "há exatamente uma transmissão, e ela começa
 * limpa" uma propriedade verificável em vez de convenção. Todo método público é
 * `@Synchronized` (o servidor é multithread, uma thread por cliente) e **todo
 * relógio entra por parâmetro** (`agora: Long`) — nada aqui chama
 * `System.currentTimeMillis()`, que é o que torna prazo, bloqueio e expiração
 * testáveis sem esperar um minuto de verdade.
 */
object EspelhoPares {

    /**
     * Prazo do token, a partir da aprovação. Seis horas cobrem qualquer culto com
     * folga e não cobrem o domingo seguinte — que é exatamente a divisão certa.
     */
    const val PRAZO_SESSAO_MS = 6L * 60 * 60 * 1000

    /**
     * Quanto tempo uma sessão pode ficar SEM SER USADA antes de a vaga dela
     * poder ser tomada por uma tela nova — e **só** nesse caso (ver
     * [liberarVagaOciosa]). Ela **não** encurta o prazo de ninguém sozinha: uma
     * sessão ociosa continua válida enquanto houver vaga sobrando.
     *
     * ## Por que isto existe, e por que ele não é uma janela deslizante
     *
     * A invariante 3 diz que o prazo é FIXO a partir da aprovação e **não é
     * renovado pelo uso** — e continua sendo: [PRAZO_SESSAO_MS] é absoluto e
     * nada aqui o estende. O que este número governa é o oposto: fazer uma
     * sessão morrer **antes** do prazo dela quando ela já não serve a ninguém.
     * Encurtar nunca afrouxa um controle de acesso.
     *
     * E ele conserta uma falha real, que a porta aberta da v5.170 tornou
     * frequente: uma sessão só saía de [vivas] por [encerrar], [recusar] ou o
     * prazo de SEIS HORAS. Uma tela que recarrega a página numa aba nova (a TV
     * que foi desligada e religada, o navegador que perdeu o `sessionStorage`)
     * pede um token novo e o antigo fica ocupando vaga. **Três recomeços
     * esgotavam o teto de [MAX_SESSOES] e o espelho passava a recusar todo mundo
     * pelo resto do culto**, sem uma linha em lugar nenhum que o explicasse.
     *
     * Quatro minutos porque uma tela viva é revalidada de segundo em segundo
     * (o vigia do `EspelhoServidor` confere o token de cada conexão aberta) e
     * uma tela que tenta reconectar bate no `GET /v` a cada 8 s no pior degrau
     * da escada. Quatro minutos sem NENHUMA das duas coisas é uma tela que foi
     * embora.
     */
    const val PRAZO_OCIOSA_MS = 4L * 60 * 1000

    /**
     * Quanto se espera antes de tomar a vaga de uma sessão que o SERVIDOR já
     * declarou sem conexão — ver [marcarSemConexao].
     *
     * 45 s, e o número é uma volta inteira de recuperação do cliente: o vigia de
     * fio dele aborta com 20 s sem bytes, mais a escada de reconexão de até 8 s,
     * mais o csd e o quadro-chave da conexão nova. Menos que isso trocaria um
     * fantasma por uma tela VIVA expulsa no meio da própria recuperação — que é
     * o defeito oposto, e pior, porque atinge quem estava funcionando.
     */
    const val PRAZO_SEM_CONEXAO_MS = 45_000L

    /**
     * Duração do castigo de uma tela DERRUBADA pelo operador — ver [derrubar].
     *
     * É o ÚNICO bloqueio que existe desde a v5.189: sem código não há tentativa
     * errada a punir, e o mapa de castigos passou a guardar só isto. Dois
     * minutos porque derrubar precisa DURAR alguma coisa — sem castigo nenhum a
     * tela volta em dois segundos e o botão "Desconectar" reporta sucesso sem
     * fazer nada visível — e enganar-se de tela não pode custar o domingo.
     */
    const val BLOQUEIO_DERRUBADA_MS = 2L * 60 * 1000

    /** Teto de sessões vivas (invariante 8). */
    const val MAX_SESSOES = 3

    /** Corte duro de todo texto vindo da rede (invariante 9). */
    const val TETO_TEXTO = 120

    /**
     * O que o cliente conta de si no pareamento, uma vez, e depois a cada 5 min
     * (só o `telaAcesaMin`). Responde, **sem ninguém abrir console em TV
     * nenhuma**: qual navegador roda ali, em que resolução, e há quanto tempo
     * aquela tela está acesa.
     *
     * **ELE ENCOLHEU NA v5.298, e o motivo é a régua da v5.206.** Havia seis
     * campos a mais — `seguro`, `mse`, `mms`, `fetchStream`, `videoDecoder`,
     * `wakeLock` —, todos do autorrelato de CAPACIDADE que o `espelho/cliente.js`
     * mandava na era dos pixels. Aquele arquivo foi apagado na v5.187 e nenhum
     * produtor os emite desde então: o `espelho/tela.js` manda `{ua, w, h}` e
     * mais nada. Como `optBoolean` lê campo ausente como `false` — um valor
     * LEGÍTIMO —, eles não sumiam: viravam seis negativas sobre toda tela
     * conectada, publicadas a cada leitura do estado. O consumidor delas saiu
     * na v5.206 (era ele que imprimia `MSE:nao seguro:nao wakeLock:nao` sobre a
     * única tela que estava funcionando); o produtor ficou, e é ele que sai
     * agora. **Apagar o produtor de um campo e deixar o consumidor de pé não
     * produz silêncio, produz um zero — e o inverso não produz defeito nenhum
     * hoje, produz uma armadilha para quem repuser a leitura amanhã.**
     *
     * Todo campo aqui **veio da rede** e não vale nada até passar por [sanear] —
     * o que [entrar] faz com o relato inteiro antes de guardá-lo.
     */
    data class Relato(
        val ua: String,
        val w: Int,
        val h: Int,
        val telaAcesaMin: Int,
    )

    /**
     * Uma tela aprovada.
     *
     * **Nunca imprima [token] no Registro** — o Registro tem botão de copiar e
     * existe para ser repassado. O `toString` já o esconde; a regra é para quem
     * for escrever `"...${sessao.token}..."` à mão.
     */
    data class Sessao(val token: String, val relato: Relato, val expiraEm: Long) {
        /**
         * Quando esta sessão foi USADA pela última vez (o relógio de fora, o
         * mesmo `agora` de todo este arquivo).
         *
         * Mora no CORPO da classe, e não no construtor, de propósito: propriedade
         * de corpo fica fora de `equals`/`hashCode`/`copy`/`toString`, então uma
         * sessão continua igual a si mesma depois de ser usada — e os testes que
         * comparam `Sessao` por valor seguem valendo.
         *
         * Ele **não estende prazo nenhum** (invariante 3). Serve a uma coisa só:
         * [liberarVagaOciosa], que é o que impede o teto de [MAX_SESSOES] de ser
         * consumido por telas que já foram embora.
         */
        @Volatile
        var ultimoUsoMs: Long = 0L

        /**
         * QUANDO O SERVIDOR CONCLUIU QUE NÃO HÁ MAIS NINGUÉM DO OUTRO LADO —
         * `0` = há (ou nunca houve) conexão. Ver [marcarSemConexao].
         *
         * Ele existe porque [ultimoUsoMs] responde outra pergunta: ele é
         * renovado a cada volta do vigia enquanto a conexão existir, então uma
         * tela que morreu às 10h00 e foi fechada às 10h01 tem carimbo de "um
         * minuto atrás" — e [liberarVagaOciosa] só a solta quatro minutos depois
         * disso. Cinco minutos de vaga presa a um fantasma, com a folha do
         * operador listando duas telas e o espelho dizendo "lotado".
         */
        @Volatile
        var semConexaoDesde: Long = 0L

        override fun toString(): String =
            "Sessao(token=<oculto>, ua=${relato.ua}, expiraEm=$expiraEm)"
    }

    /**
     * A resposta de [entrar] — a única forma do `POST /par`.
     *
     * Um tipo selado, e não um booleano, porque cada variante corresponde a UMA
     * resposta do fio: quem roteia escreve um `when` com `else -> 403`, e
     * qualquer variante que este arquivo ganhe amanhã **nega** por omissão em vez
     * de autorizar. Falha fechada é a única postura possível num controle de
     * acesso, e ela sai de graça desta forma.
     *
     * (Saíram na v5.185, com a fila de aprovação: `Espera`, `Pendente` e
     * `Desconhecida`. Elas eram as três formas de dizer "ainda não" a uma tela
     * que tinha acertado o segredo — e agora acertar o código É entrar, porque o
     * gesto que o visitante gasta no botão é o mesmo que libera o som e a tela
     * cheia. Ver a invariante 5.)
     */
    sealed class Veredito {
        /** Vaga livre: o token, uma vez. `200 {"t": token}`. */
        data class Aprovada(val sessao: Sessao) : Veredito()

        /** Origem de castigo (o operador a derrubou) — [restaMs] até liberar. `403`. */
        data class Bloqueada(val restaMs: Long) : Veredito()

        /** As [MAX_SESSOES] vagas estão ocupadas. `403`. */
        object Lotada : Veredito()

        /** A transmissão não está ligada. `403`. */
        object Desligado : Veredito()

    }

    /** O castigo de UMA origem — só o [derrubar] o cria (invariante 6). */
    private class Castigo {
        var ate = 0L
        var visto = 0L
    }

    private var noAr = false
    private var rnd: SecureRandom = SecureRandom()

    private val vivas = ArrayList<Sessao>()
    private val castigos = HashMap<String, Castigo>()

    // ------------------------------------------------------------ interruptor

    /**
     * Liga o pareamento.
     *
     * Zera TUDO antes: sessões e castigos. Ligar a transmissão é começar do
     * zero, e é isso que faz o token não sobreviver ao culto anterior.
     *
     * [aleatorio] entra por parâmetro para o teste poder fixar a fonte do TOKEN;
     * em produção é um `SecureRandom` novo, como no `SafRegistry` e no
     * [StreamProxy].
     */
    @Synchronized
    fun ligar(agora: Long, aleatorio: SecureRandom = SecureRandom()) {
        zerar()
        rnd = aleatorio
        noAr = true
        // `agora` não é usado hoje — o estado nasce vazio, sem nada a expirar.
        // Ele está na assinatura porque toda porta deste arquivo recebe o relógio
        // de fora, e uma que não recebesse convidaria a próxima a chamar o
        // relógio por dentro.
    }

    /** Desliga e apaga tudo. Não há token que sobreviva a isto. */
    @Synchronized
    fun desligar() = zerar()

    /**
     * O mesmo que [desligar], sob o nome que o caminho de PARADA usa.
     *
     * Dois nomes para um ato só porque são dois pontos de vista: o operador
     * *desliga* o espelho; o servidor, ao morrer, *zera* o pareamento. Ter só um
     * deles obrigaria um dos dois lados a chamar uma coisa pelo nome da outra —
     * e neste arquivo o nome é a documentação.
     */
    @Synchronized
    fun zerar() {
        noAr = false
        vivas.clear()
        castigos.clear()
    }

    @Synchronized
    fun estaLigado(): Boolean = noAr

    // ------------------------------------------------------------- pareamento

    /**
     * A ÚNICA porta: uma tela pedindo entrada, vinda de [origem] (o endereço do
     * socket). Vaga livre ⇒ [Veredito.Aprovada], com o token, na mesma resposta.
     *
     * ## Não há segredo a conferir (v5.189)
     *
     * A porta é o ENDEREÇO deste aparelho nesta rede — ver a invariante 5. O que
     * este método ainda decide é o que sempre foi o controle real: a transmissão
     * está ligada? esta origem está de castigo (o operador a derrubou há pouco)?
     * há vaga entre as [MAX_SESSOES]?
     *
     * A ordem importa e é esta: **castigo primeiro, vaga depois**. Uma tela
     * derrubada não pode reentrar tomando a vaga que o operador acabou de abrir.
     *
     * ## Por que não há fila de aprovação
     *
     * Porque o gesto do visitante é UM só. A página do cliente tem UM botão, e o
     * toque nele é também o que libera o som e a tela cheia — as duas exigem
     * ativação transitória do usuário, e uma aprovação que chegasse depois
     * encontraria o gesto já gasto: a tela entraria muda e em janela, e alguém
     * teria de atravessar o salão para tocar nela.
     *
     * ## Lotada é uma FRASE, não a recusa genérica
     *
     * Ela pede que se feche uma das outras telas — e insistir não resolve nem
     * uma vez. O status do fio é 403 (quem não entrou não entrou); o que
     * distingue é o corpo. **Lotado não gasta cota nenhuma**: o que faltou foi
     * vaga, e contá-lo faria a terceira tela do templo punir a si mesma.
     */
    @Synchronized
    fun entrar(origem: String, relato: Relato, agora: Long): Veredito {
        limpar(agora)
        if (!noAr) return Veredito.Desligado

        val chave = sanear(origem, 64)
        val c = castigos[chave]
        if (c != null) {
            if (c.ate > agora) {
                c.visto = agora
                return Veredito.Bloqueada(c.ate - agora)
            }
            // O castigo venceu: a origem volta ao normal e some do mapa. Não há
            // expoente a carregar adiante — o castigo é do DERRUBAR, e derrubar
            // duas vezes a mesma tela é o operador dizendo a mesma coisa duas
            // vezes, não uma escalada a punir.
            castigos.remove(chave)
        }

        val s = novaSessao(relato, agora) ?: return Veredito.Lotada
        return Veredito.Aprovada(s)
    }

    /**
     * O operador tirou ESTA tela do ar (o botão "Desconectar" da folha).
     *
     * Encerrar a sessão não basta: a tela derrubada perde o token e **entra de
     * novo em dois segundos** — com a porta aberta da v5.189, sem nem uma
     * digitação pelo caminho. O botão reportaria sucesso e não faria nada
     * visível. Por isso derrubar põe a origem de castigo por
     * [BLOQUEIO_DERRUBADA_MS], e é o ÚNICO caminho que cria um castigo.
     *
     * Curto de propósito. Derrubar a tela errada é um toque; ficar sem poder
     * readmiti-la pelo resto do culto seria o preço errado para isso.
     */
    @Synchronized
    fun derrubar(token: String, origem: String, agora: Long) {
        encerrar(token)
        val chave = sanear(origem, 64)
        if (chave.isEmpty()) return
        val c = castigos.getOrPut(chave) { Castigo() }
        c.visto = agora
        c.ate = agora + BLOQUEIO_DERRUBADA_MS
    }

    // (Saíram na v5.185, com a fila de aprovação: `esperaQr`, `abrirVagaQr`,
    // `despejar`, `consultar`, `pendentes`, `esperandoQr`, `aprovar` e
    // `recusar`. O QR existia para inverter quem mostra e quem lê o segredo, e
    // ele deixou de ter o que resolver quando o segredo virou um código de três
    // dígitos que a TELA digita — a inversão já não é necessária, e a página do
    // cliente não desenha mais nada. Ver a invariante 5.
    //
    // O que tomou o lugar deles é `derrubar`, acima: com a entrada imediata, o
    // controle do operador deixou de ser "quem eu deixo entrar" e passou a ser
    // "quem eu tiro do ar" — que é a pergunta que ele de fato faz durante um
    // culto, e a única que a lista de telas sabe responder.)

    // --------------------------------------------------------------- sessões

    /**
     * Devolve a sessão viva de um token, ou `null`.
     *
     * Aceita as DUAS formas: o cabeçalho `Authorization` cru
     * (`Bearer <token>`, com o esquema sem caixa, como manda o RFC 7235) e o
     * token já extraído — porque há dois chamadores legítimos e eles têm coisas
     * diferentes na mão: a rota, que tem o cabeçalho, e o vigia das conexões, que
     * só guardou o token. Tolerar as duas não afrouxa nada: um token é base64url
     * e **não tem espaço**, então `Basic xyz` (ou qualquer outro esquema) nunca
     * casa com sessão nenhuma.
     *
     * O token NUNCA viaja numa URL (invariante 2) — isto aqui é o outro lado
     * daquela regra, e é o único ponto do projeto que lê um `Bearer`.
     *
     * Expiração é conferida ANTES da comparação (o [limpar] já removeu as
     * vencidas), então um token expirado é indistinguível de um inventado — que é
     * o que se quer. A varredura da lista é linear e em tempo constante por
     * elemento: ver a invariante 4.
     */
    @Synchronized
    fun validar(autorizacao: String?, agora: Long): Sessao? {
        limpar(agora)
        val cru = autorizacao?.trim() ?: return null
        val token = if (cru.regionMatches(0, "Bearer ", 0, 7, ignoreCase = true)) {
            cru.substring(7).trim()
        } else {
            cru
        }
        if (token.isEmpty() || token.contains(' ')) return null
        for (s in vivas) {
            if (!igual(token, s.token)) continue
            // MARCA O USO — e isto NÃO estende o prazo (invariante 3): o
            // `expiraEm` é absoluto e ninguém o toca. O carimbo serve só a
            // [liberarVagaOciosa], isto é, a saber qual das três vagas já não
            // tem ninguém do outro lado.
            s.ultimoUsoMs = agora
            return s
        }
        return null
    }

    /** Encerra UMA sessão (o operador tirando uma tela do ar, ou o teto). */
    @Synchronized
    fun encerrar(token: String) {
        vivas.removeAll { igual(token, it.token) }
    }

    /** As sessões vivas, para a folha do Controle e para o Registro. */
    @Synchronized
    fun sessoes(): List<Sessao> = ArrayList(vivas)

    /**
     * Recolhe o que venceu: sessões e castigos já cumpridos.
     *
     * Público porque o servidor a chama de tempos em tempos (uma transmissão
     * ligada sem cliente nenhum não teria quem passasse por aqui), e chamada no
     * começo de toda porta deste arquivo — assim nenhuma decisão é tomada sobre
     * estado podre, mesmo que ninguém varra nada.
     *
     * Um castigo cumprido é esquecido depois de outro tanto de silêncio: ele
     * não é um expoente que precise sobreviver (v5.189), só a memória curta de
     * "o operador acabou de tirar esta tela do ar".
     */
    @Synchronized
    fun limpar(agora: Long) {
        vivas.removeAll { it.expiraEm <= agora }
        val iter = castigos.entries.iterator()
        while (iter.hasNext()) {
            val c = iter.next().value
            if (c.ate <= agora && agora - c.visto > BLOQUEIO_DERRUBADA_MS) iter.remove()
        }
    }

    // ------------------------------------------------------------ diagnóstico

    /** Quantas telas estão de castigo agora (derrubadas há pouco) — o Registro. */
    @Synchronized
    fun origensEmBloqueio(agora: Long): Int = castigos.values.count { it.ate > agora }

    // ---------------------------------------------------------- saneamento

    /**
     * O funil por onde passa TODO texto vindo da rede (invariante 9).
     *
     * Fora de `[\x20-\x7E]` nada entra: `\n` e `\r` (que injetariam linhas falsas
     * no Registro), tabulação, NUL e qualquer byte alto. Corte duro em [teto].
     *
     * Aspas e contrabarra viram apóstrofo em vez de serem **escapadas**, e isso é
     * deliberado: esta string atravessa três contextos — o JSON do `espelhoDiag`,
     * o `textContent` do Registro e o texto que o operador copia — e não existe
     * um escape que esteja certo nos três (escapar para JSON e depois deixar o
     * `org.json` escapar de novo produz `\\"` na tela do operador). Remover é a
     * única codificação correta em todos.
     */
    fun sanear(texto: String, teto: Int = TETO_TEXTO): String {
        val sb = StringBuilder()
        for (c in texto) {
            if (sb.length >= teto) break
            if (c < ' ' || c > '~') continue
            sb.append(if (c == '"' || c == '\\') '\'' else c)
        }
        return sb.toString()
    }

    /**
     * O relato inteiro, saneado — e o ÚNICO caminho por onde um [Relato] entra
     * neste arquivo, porque [entrar] o aplica antes de guardar.
     *
     * É por isso que o `EspelhoServidor` pode montar o [Relato] **cru**, campo a
     * campo, a partir do JSON do corpo: `org.json` é da plataforma (num teste de
     * JVM ele é o esqueleto do `android.jar`, e todo método lança "not mocked"),
     * então o parse tem de ficar lá — e o saneamento, aqui, num ponto só e do
     * lado que tem teste. Cada um faz o que só ele pode.
     *
     * Os números também são domados: eles vêm do mesmo JSON que o `ua`, e um
     * `w: -2000000000` no Registro não é um ataque, é ruído que faz o operador
     * duvidar da linha inteira.
     */
    private fun sanear(r: Relato): Relato = r.copy(
        ua = sanear(r.ua),
        w = r.w.coerceIn(0, 20_000),
        h = r.h.coerceIn(0, 20_000),
        telaAcesaMin = r.telaAcesaMin.coerceIn(0, 100_000),
    )

    // ---------------------------------------------------------------- interno

    /**
     * Cunha uma sessão, ou `null` quando o teto de [MAX_SESSOES] está cheio **e
     * nenhuma das vagas está ociosa**.
     *
     * O relato chega CRU da rede e passa pelo funil aqui — um ponto só, do
     * lado que tem teste. Sanear duas vezes seria idempotente
     * (`[\x20-\x7E]` já filtrado continua filtrado); confiar em quem chama é
     * que seria a forma de um caminho novo entrar sem saneamento nenhum.
     */
    private fun novaSessao(relato: Relato, agora: Long): Sessao? {
        if (vivas.size >= MAX_SESSOES && !liberarVagaOciosa(agora)) return null
        val s = Sessao(novoToken(), sanear(relato), agora + PRAZO_SESSAO_MS)
        s.ultimoUsoMs = agora
        vivas.add(s)
        return s
    }

    /**
     * Abre UMA vaga tomando a sessão mais ociosa, quando ela estiver parada há
     * mais de [PRAZO_OCIOSA_MS]. `false` = todas as três estão em uso.
     *
     * É o conserto do teto consumido por fantasmas: até aqui uma sessão só saía
     * por [encerrar], por [recusar] ou pelas seis horas do prazo, e uma tela que
     * recomeça numa aba nova deixa a anterior ocupando vaga. Com a porta aberta
     * isso deixou de ser hipótese — três recomeços e o espelho passava a recusar
     * todo mundo pelo resto do culto.
     *
     * **A mais ociosa, e nunca a mais velha**: a mais velha pode ser justamente
     * a TV do templo, ligada desde o começo e usada a cada segundo. O que
     * qualifica uma vaga como livre é ninguém estar do outro lado dela.
     */
    private fun liberarVagaOciosa(agora: Long): Boolean {
        // PRIMEIRO A VAGA QUE O SERVIDOR JÁ SABE ESTAR VAZIA (v5.183).
        //
        // `ultimoUsoMs` é renovado a cada volta do vigia enquanto a conexão
        // existir, então uma tela desligada na tomada às 10h00 e fechada pelo
        // `TETO_SEM_RELATO_MS` às 10h01 fica com carimbo de "1 min atrás" — e o
        // critério de ociosidade só a soltaria às ~10h05. Nesse intervalo a TV
        // do saguão que alguém acabou de ligar recebe `{estado:lotado}` **com a
        // folha do operador listando duas telas**, e ele não tem em quem tocar
        // em "Desconectar". Pior: a MESMA TV religada é recusada pelo fantasma
        // dela própria, porque o token vive em `sessionStorage` e morre com o
        // navegador. É a §10-A.10 item 2 corrigida pela metade — ela falhava
        // justamente no exemplo que o doc nomeia.
        //
        // O piso de [PRAZO_SEM_CONEXAO_MS] não é zelo: uma tela em recuperação
        // normal fica sem conexão por uma volta inteira (o vigia de fio do
        // cliente aborta aos 20 s, mais a escada de até 8 s), e tomar a vaga
        // dela no meio disso trocaria um fantasma por uma tela viva expulsa.
        val fantasma = vivas
            .filter { it.semConexaoDesde != 0L && agora - it.semConexaoDesde > PRAZO_SEM_CONEXAO_MS }
            .maxByOrNull { agora - it.semConexaoDesde }
        if (fantasma != null) {
            encerrar(fantasma.token)
            return true
        }
        val alvo = vivas
            .filter { agora - it.ultimoUsoMs > PRAZO_OCIOSA_MS }
            .maxByOrNull { agora - it.ultimoUsoMs }
            ?: return false
        encerrar(alvo.token)
        return true
    }

    /**
     * O SERVIDOR CONCLUIU QUE ESTA SESSÃO FICOU SEM NINGUÉM DO OUTRO LADO.
     *
     * Chamado quando a thread de escrita de uma tela termina — isto é, quando o
     * `GET /v` daquela sessão acabou, por queda, por prazo ou por fecho. É a
     * única informação que o pareamento não tem por conta própria: ele vê
     * tokens, não sockets.
     *
     * `false` quando o token não é de nenhuma sessão viva — o que é normal (a
     * sessão pode ter sido encerrada antes) e não é erro.
     */
    @Synchronized
    fun marcarSemConexao(token: String, agora: Long): Boolean {
        val s = vivas.firstOrNull { igual(it.token, token) } ?: return false
        s.semConexaoDesde = agora
        return true
    }

    /**
     * E O CONTRÁRIO: há conexão de novo. Chamado quando um `GET /v` assume a
     * sessão, e é ele que impede uma tela que reconectou de continuar marcada
     * como fantasma pelo resto da sessão.
     */
    @Synchronized
    fun marcarComConexao(token: String): Boolean {
        val s = vivas.firstOrNull { igual(it.token, token) } ?: return false
        s.semConexaoDesde = 0L
        return true
    }

    /**
     * 128 bits em base64url sem padding — 22 caracteres, sem `/` nem `=`, os
     * mesmos do `SafRegistry` e do [StreamProxy].
     */
    private fun novoToken(): String {
        val b = ByteArray(16)
        rnd.nextBytes(b)
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b)
    }

    /**
     * Comparação em tempo constante (invariante 4).
     *
     * O `MessageDigest.isEqual` do JDK não sai na primeira diferença. Vazio nunca
     * é igual a vazio aqui: sem essa guarda, um token vazio casaria com o de uma
     * sessão malformada — o caso em que o segredo não existe é o caso em que ele
     * não pode valer. (Desde a v5.189 o único segredo comparado aqui é o TOKEN:
     * o código de entrada saiu.)
     */
    private fun igual(a: String, b: String): Boolean {
        if (a.isEmpty() || b.isEmpty()) return false
        return MessageDigest.isEqual(a.toByteArray(Charsets.UTF_8), b.toByteArray(Charsets.UTF_8))
    }
}
