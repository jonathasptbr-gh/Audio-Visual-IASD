package br.org.iasd.av

import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64

/**
 * O controle de acesso do espelho de pixels: PIN, aprovação pelo operador,
 * tokens, prazo e limitação de taxa. **ZERO import de Android**, pelo mesmo
 * motivo do [EspelhoHttp] — este e aquele são as duas peças em que um erro não
 * vira pixel errado, e sim porta aberta, e são as duas que o JUnit cobre (ver a
 * QUARTA EXCEÇÃO declarada no `dependencies` de `app/build.gradle.kts`).
 *
 * O `EspelhoServidor` (P5) faz sockets e threads e **não decide nada que este
 * arquivo decida**: ele pergunta e obedece, exatamente como o
 * `MainActivity.handleBack()` pergunta ao `window.__avBack`.
 *
 * ## As nove invariantes
 *
 * 1. **Token de 128 bits em base64url, `SecureRandom`** — aleatório, não
 *    contador, opaco. É o mesmo desenho do `SafRegistry`
 *    (`SafPathHandler.kt`), e o mesmo motivo: um contador é adivinhável por
 *    construção. Vale igual para o `id` da espera, que também é um portador (quem
 *    o tem recebe o token quando o operador aprovar).
 * 2. **O token NUNCA viaja numa URL.** Nem em `?t=`, nem em fragmento, nem no QR.
 *    Ele vive no `sessionStorage` do cliente e sobe em `Authorization: Bearer` —
 *    e é por isso que [validar] recebe o cabeçalho CRU e faz ela mesma a leitura
 *    do esquema: deixar o servidor fatiar uma string vinda da rede é exatamente o
 *    tipo de decisão que esta separação existe para impedir. URL vaza para
 *    histórico, para cache, para captura de tela e para compartilhamento de tela;
 *    é por isso que até o modo imagem busca os quadros por `fetch`, e não por
 *    `<img src>` (um `<img>` não manda `Authorization`).
 * 3. **O token tem prazo e morre com a sessão.** [desligar] zera tudo; não existe
 *    token que sobreviva ao culto. O prazo é FIXO a partir da aprovação
 *    ([PRAZO_SESSAO_MS]) e **não é renovado pelo uso**: uma janela deslizante
 *    nunca expira enquanto alguém a usar, o que é precisamente o caso do token
 *    vazado sendo usado por outro. O uso é CARIMBADO ([Sessao.ultimoUsoMs]) e
 *    isso não é uma janela deslizante disfarçada: o carimbo só faz uma sessão
 *    morrer MAIS CEDO — ele é o que permite a [liberarVagaOciosa] tomar a vaga
 *    de quem já foi embora, e nunca estende o prazo de ninguém.
 * 4. **Comparação em tempo constante** (`MessageDigest.isEqual`) para PIN, token
 *    e id de espera. E, pelo mesmo motivo, as sessões vivem numa LISTA percorrida
 *    inteira: um `HashMap[token]` compara por hash e sai na primeira diferença —
 *    seria jogar fora, no lookup, o cuidado tomado na comparação. Com teto de
 *    três sessões, percorrer é de graça.
 * 5. **O operador fica no laço.** PIN correto ⇒ a tela entra como PENDENTE, e a
 *    folha do espelho no Controle mostra `tela pendente — aprovar?`. Há um
 *    interruptor "aprovar automaticamente nesta sessão", que **nasce desligado**
 *    ([definirAutoAprovar]) e morre com o [desligar]. Um PIN de seis dígitos
 *    visível na tela do celular durante todo o culto é fraco demais para ser o
 *    único controle.
 * 5b. **O QR INVERTE quem mostra e quem lê, e é por isso que ele é mais forte
 *    que o PIN, não mais fraco** ([esperaQr]). No PIN o celular exibe um
 *    segredo curto e a tela o digita; no QR a TELA exibe o `id` da própria
 *    espera — que não é segredo nenhum: o servidor o acabou de devolver para
 *    quem pediu — e o CELULAR o lê pela câmera. Não há o que espiar por cima do
 *    ombro, não há o que fotografar de longe que sirva para alguma coisa, e a
 *    aprovação continua sendo o mesmo ato do operador da invariante 5, só que
 *    apontando a câmera em vez de tocando numa lista.
 *
 *    Daí as três regras que sustentam isso, e que são o contrário de detalhes:
 *    uma espera de QR **não aparece na folha** ([pendentes] a esconde), **não é
 *    tocada pela aprovação automática** e **só é aprovada por quem apresentar o
 *    `id` exato**. Sem a primeira, qualquer um na rede encheria a lista do
 *    operador de linhas que ele não tem como distinguir; sem a segunda, o
 *    interruptor de conveniência viraria "qualquer aparelho da rede entra
 *    sozinho", que é precisamente o que ele nunca significou.
 * 6. **Bloqueio por ORIGEM antes de qualquer rotação global.** Cinco tentativas
 *    erradas do mesmo endereço ⇒ [BLOQUEIO_MS] de espera **para aquele
 *    endereço**. **O PIN NÃO ROTACIONA por tentativa errada** — isso seria negação
 *    de serviço contra o pareamento legítimo: um atacante erra dez vezes de
 *    propósito e o visitante que está digitando recebe "PIN inválido" para
 *    sempre, e numa rede com AP isolation o operador culparia a rede. O PIN muda
 *    só em [ligar] ou por [trocarPin] (ação do operador).
 * 7. **A página de pareamento é ANÔNIMA** — sem versão do app, sem nome do
 *    aparelho, sem SSID, sem nome da igreja. Este arquivo colabora não tendo nada
 *    disso para dar: o único dado que ele devolve a quem não provou nada é um id
 *    opaco.
 * 8. **Teto de [MAX_SESSOES] sessões.** Atingido, [aprovar] devolve `null` e o
 *    operador precisa [encerrar] uma — o recurso é auxiliar e finito de
 *    propósito. (O teto de CONEXÕES em voo, e a regra de que um `GET /v` com
 *    token repetido fecha a conexão anterior, são do servidor: são sobre sockets,
 *    não sobre pareamento.)
 * 9. **Todo texto vindo da rede é saneado AQUI**, não no JS: `[\x20-\x7E]`, corte
 *    duro em [TETO_TEXTO] caracteres, `\n`/`\r` impossíveis, aspas trocadas. O
 *    `ua` do relato vai para o **Registro** — que é justamente o artefato que o
 *    projeto manda copiar e repassar (`copiarTexto`, em `controle.js`) —, e um
 *    `\n` ali injetaria linhas falsas num diagnóstico. **Um diagnóstico que mente
 *    é pior que diagnóstico nenhum.** *(E vale registrar por escrito: o
 *    `controle.js` monta o Registro com `textContent`, não `innerHTML`. Aquela
 *    linha é a diferença entre um espelho e a execução de JavaScript de um
 *    desconhecido no origin privilegiado que injeta `__AVBridge`. Ela passa a ser
 *    load-bearing.)*
 *
 * ## Por que um `object` com estado, e não uma classe
 *
 * A especificação o desenha como `object` e o servidor é único por processo, mas
 * a razão de ficar assim é outra: [ligar] **zera tudo** e é o único ponto em que
 * o PIN nasce, o que torna "há exatamente um espelho, e ele começa limpo" uma
 * propriedade verificável em vez de uma convenção. Todo método público é
 * `@Synchronized` (o servidor é multithread — uma thread por cliente) e **todo
 * relógio entra por parâmetro** (`agora: Long`): nada aqui chama
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
     * Prazo de uma espera (aprovada ou não). Cinco minutos: acima disso o
     * visitante já desistiu ou fechou a aba, e uma fila de pendências velhas na
     * folha do Controle é ruído no meio do culto. Uma espera que morre não leva a
     * sessão junto — a sessão tem prazo próprio.
     */
    const val PRAZO_ESPERA_MS = 5L * 60 * 1000

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

    /** Erros de PIN da MESMA origem antes do bloqueio. */
    const val ERROS_ATE_BLOQUEIO = 5

    /** Duração do bloqueio de uma origem. */
    const val BLOQUEIO_MS = 60_000L

    /**
     * Duração do castigo de uma tela DERRUBADA pelo operador — ver [derrubar].
     *
     * Mais longo que o [BLOQUEIO_MS] (que existe para frear marteladas de PIN) e
     * muito mais curto que o culto: derrubar precisa DURAR alguma coisa com a
     * porta aberta, e enganar-se de tela não pode custar o domingo.
     */
    const val BLOQUEIO_DERRUBADA_MS = 2L * 60 * 1000

    /** Teto de sessões vivas (invariante 8). */
    const val MAX_SESSOES = 3

    /**
     * Teto de esperas simultâneas **do PIN**. Sem ele, quem descobriu o PIN pode
     * encher a folha do operador com pendências no meio do culto — e a folha é
     * onde ele decide. Nada a ver com o teto de conexões em voo do servidor.
     */
    const val MAX_ESPERAS = 8

    /**
     * Teto de esperas de QR, contado **à parte** do [MAX_ESPERAS].
     *
     * Separado porque a espera de QR nasce sem provar nada: qualquer aparelho
     * da rede que abra a página cria uma. Num balde só, encher de esperas de QR
     * seria negar o pareamento por PIN — o caminho que ainda funciona quando a
     * câmera falha —, e uma negação de serviço contra o plano B é pior que a
     * ausência do plano A.
     */
    const val MAX_ESPERAS_QR = 6

    /**
     * E quantas cada ORIGEM pode manter. Duas, porque uma tela que recarrega a
     * página legitimamente cria a segunda antes de a primeira vencer — e a
     * terceira despeja a mais velha daquele endereço, nunca a de outro.
     */
    const val MAX_QR_POR_ORIGEM = 2

    /** Corte duro de todo texto vindo da rede (invariante 9). */
    const val TETO_TEXTO = 120

    /**
     * O que o cliente conta de si no pareamento, uma vez, e depois a cada 5 min
     * (só o `telaAcesaMin`). Responde, **sem ninguém abrir console em TV
     * nenhuma**: a tela apaga? qual navegador roda ali? `WebCodecs` vale como
     * degrau algum dia?
     *
     * Todo campo aqui **veio da rede** e não vale nada até passar por [sanear] —
     * o que [tentar] faz com o relato inteiro antes de guardá-lo.
     */
    data class Relato(
        val ua: String,
        val w: Int,
        val h: Int,
        val seguro: Boolean,
        val mse: Boolean,
        val mms: Boolean,
        val fetchStream: Boolean,
        val videoDecoder: Boolean,
        val wakeLock: Boolean,
        val telaAcesaMin: Int,
    )

    /**
     * Uma tela que acertou o PIN e espera o operador.
     *
     * [id] é PORTADOR: quem o tem recebe o token quando a aprovação sair. Ele
     * fica fora do `toString` de propósito — este objeto vai para a folha do
     * Controle e daí, num dia ruim, para uma linha de log.
     */
    data class Pendente(val id: String, val relato: Relato, val desde: Long) {
        override fun toString(): String = "Pendente(id=<oculto>, ua=${relato.ua}, desde=$desde)"
    }

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
     * A resposta de [tentar] **e** de [consultar] — as duas formas do `POST /par`
     * (§5.1), num tipo só.
     *
     * Um tipo só, e não um por método, porque cada variante corresponde a UMA
     * resposta do fio: quem roteia escreve um `when` com `else -> 403`, e
     * qualquer variante que este arquivo ganhe amanhã **nega** por omissão em vez
     * de autorizar. Falha fechada é a única postura possível num controle de
     * acesso, e ela sai de graça desta forma.
     *
     * (Repare que [Veredito.Pendente] não é a `data class` [Pendente]: aquela é a
     * VISTA da fila que o operador vê no Controle, esta é a resposta "ainda não"
     * que o cliente recebe. Nomes iguais em escopos diferentes; sempre qualifique.)
     */
    sealed class Veredito {
        /** PIN certo: a tela entrou na fila do operador. `202 {"espera": id}`. */
        data class Espera(val id: String) : Veredito()

        /** A espera existe e o operador ainda não decidiu. `202 {"estado":"pendente"}`. */
        object Pendente : Veredito()

        /** O operador aprovou: o token, uma vez. `200 {"t": token}`. */
        data class Aprovada(val sessao: Sessao) : Veredito()

        /** PIN errado, ou o operador recusou. `403`. */
        object Recusada : Veredito()

        /** Origem bloqueada por tentativas erradas — [restaMs] até liberar. `403`. */
        data class Bloqueada(val restaMs: Long) : Veredito()

        /** PIN certo, mas a fila do operador está cheia ([MAX_ESPERAS]). `403`. */
        object Lotada : Veredito()

        /** Id de espera que não existe — ou que expirou, e é a mesma resposta. `403`. */
        object Desconhecida : Veredito()

        /** O espelho não está ligado. `403`. */
        object Desligado : Veredito()
    }

    private enum class Estado { AGUARDANDO, APROVADA, RECUSADA }

    /**
     * O registro interno de uma tela que acertou o PIN — o estado de verdade.
     *
     * São TRÊS nomes vizinhos, e a diferença entre eles é o leitor: [Pendencia] é
     * o estado (privado), [Pendente] é a vista que o OPERADOR recebe na folha do
     * Controle, e [Veredito.Espera]/[Veredito.Pendente] são o que o CLIENTE
     * recebe no fio. Nomes distintos porque são públicos distintos.
     */
    private class Pendencia(
        val id: String,
        val relato: Relato,
        val desde: Long,
        /** Nasceu de um QR (invariante 5b) e não de um PIN. */
        val viaQr: Boolean = false,
        /** O endereço que a criou — só usado para o teto por origem do QR. */
        val origem: String = "",
    ) {
        var estado: Estado = Estado.AGUARDANDO
        var sessao: Sessao? = null
    }

    private class Tentativas {
        var erros = 0
        var bloqueadoAte = 0L
        var visto = 0L
    }

    private var noAr = false
    private var pinAtual = ""
    /**
     * ACESSO ABERTO — quem abrir o endereço entra, sem PIN e sem o toque do
     * operador. **Nasce LIGADO** (v5.170).
     *
     * A decisão é sobre o que o espelho transmite: a imagem do que está sendo
     * projetado **para a congregação inteira**. É público por construção, e uma
     * fechadura sobre conteúdo público custa mais do que rende — foram três
     * degraus de tela e um número de seis dígitos em cartaz durante todo o
     * culto para proteger o que qualquer um na sala já está vendo.
     *
     * O que NÃO ficou aberto, e é o que sustenta a decisão: o microfone ao vivo
     * nunca sai na rede (§3.9), o token continua fora de qualquer URL, a
     * allowlist de `Host` continua exata (DNS rebinding), e o teto de três
     * sessões continua valendo. É esse teto, e não o sigilo, o dano real de um
     * curioso na rede — e a resposta a ele é o operador VER quem está
     * conectado e poder derrubar, que continua na folha.
     */
    private var autoOn = true
    private var rnd: SecureRandom = SecureRandom()
    private var recusados = 0

    private val esperas = ArrayList<Pendencia>()
    private val vivas = ArrayList<Sessao>()
    private val erros = HashMap<String, Tentativas>()

    // ------------------------------------------------------------ interruptor

    /**
     * Liga o pareamento e devolve o PIN novo.
     *
     * Zera TUDO antes: sessões, esperas, bloqueios e o interruptor de aprovação
     * automática. Ligar o espelho é começar do zero, e é isso que faz o token não
     * sobreviver ao culto anterior.
     *
     * [aleatorio] entra por parâmetro para o teste poder fixar a fonte; em
     * produção é um `SecureRandom` novo, como no `SafRegistry` e no [StreamProxy].
     */
    @Synchronized
    fun ligar(agora: Long, aleatorio: SecureRandom = SecureRandom()): String {
        zerar()
        rnd = aleatorio
        noAr = true
        pinAtual = novoPin(rnd)
        // `agora` não é usado hoje — o estado nasce vazio, sem nada a expirar.
        // Ele está na assinatura porque toda porta deste arquivo recebe o relógio
        // de fora, e uma que não recebesse convidaria a próxima a chamar o
        // relógio por dentro.
        return pinAtual
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
        pinAtual = ""
        // Volta ao PADRÃO, que é ABERTO — e não a `false`. Zerar precisa
        // devolver o estado de fábrica, senão desligar e ligar o espelho
        // trancaria a porta que nasce aberta, sem ninguém ter pedido.
        autoOn = true
        recusados = 0
        esperas.clear()
        vivas.clear()
        erros.clear()
    }

    @Synchronized
    fun estaLigado(): Boolean = noAr

    /** O PIN em cartaz, para a folha do Controle e para o QR. */
    @Synchronized
    fun pin(): String = pinAtual

    /**
     * Troca o PIN por ação do operador (invariante 6 — e só por ela).
     *
     * Não derruba sessão nem espera: quem já foi aprovado continua vendo, e é
     * isso que separa "trocar o PIN" de "desligar".
     */
    @Synchronized
    fun trocarPin(): String {
        if (!noAr) return ""
        pinAtual = novoPin(rnd)
        return pinAtual
    }

    @Synchronized
    fun definirAutoAprovar(ligado: Boolean) {
        autoOn = ligado
    }

    @Synchronized
    fun autoAprovando(): Boolean = autoOn

    /**
     * Seis dígitos, com os zeros à esquerda preservados.
     *
     * `nextInt(1_000_000)` não tem viés de módulo (o `Random.nextInt(bound)` do
     * JDK descarta o resto do intervalo), e o `SecureRandom` é o mesmo gerador do
     * token — um PIN previsível derrubaria o pareamento inteiro sem que nada
     * parecesse quebrado.
     */
    fun novoPin(aleatorio: SecureRandom): String =
        aleatorio.nextInt(1_000_000).toString().padStart(6, '0')

    // ------------------------------------------------------------- pareamento

    /**
     * Uma tentativa de PIN, vinda de [origem] (o endereço do socket).
     *
     * A ordem importa e é esta: bloqueio da origem primeiro, PIN depois. Um
     * atacante que acertasse o PIN na sexta tentativa **continua bloqueado** — e o
     * visitante legítimo que errou cinco vezes espera um minuto, que é o preço
     * combinado.
     *
     * Acertar o PIN **não** dá acesso: dá uma vaga na fila do operador
     * (invariante 5). Com "aprovar automaticamente" ligado, a aprovação sai aqui
     * mesmo — e se o teto de sessões estiver cheio ela simplesmente não sai, e a
     * espera fica na fila para o operador decidir. Degradar para o manual é o
     * comportamento certo: o interruptor existe para poupar toques, não para
     * inventar vaga.
     */
    @Synchronized
    fun tentar(pin: String, origem: String, relato: Relato, agora: Long): Veredito {
        limpar(agora)
        if (!noAr) return Veredito.Desligado

        val chave = sanear(origem, 64)
        val t = erros.getOrPut(chave) { Tentativas() }
        t.visto = agora
        if (t.bloqueadoAte > agora) return Veredito.Bloqueada(t.bloqueadoAte - agora)
        if (t.bloqueadoAte != 0L) {
            // O bloqueio venceu: a origem volta com a cota inteira. Sem isto, a
            // sexta tentativa de sempre seria bloqueada para sempre.
            t.bloqueadoAte = 0L
            t.erros = 0
        }

        // COM ACESSO ABERTO O PIN NÃO É PERGUNTADO. Ele continua existindo e
        // continua sendo aceito — é o plano B de quem desligar a abertura —,
        // mas exigi-lo aqui manteria o atrito inteiro que a v5.170 removeu: o
        // cliente teria de digitar seis dígitos para receber uma aprovação que
        // sai automaticamente na linha seguinte.
        //
        // O bloqueio por origem acima continua rodando: ele protege contra
        // marteladas, e martelada não deixa de existir por a porta estar
        // aberta.
        if (!autoOn && !igual(pin, pinAtual)) {
            t.erros++
            recusados++
            if (t.erros >= ERROS_ATE_BLOQUEIO) t.bloqueadoAte = agora + BLOQUEIO_MS
            return Veredito.Recusada
        }

        erros.remove(chave)
        // Só as esperas de PIN contam para este teto: ver [MAX_ESPERAS_QR].
        if (esperas.count { !it.viaQr } >= MAX_ESPERAS) return Veredito.Lotada

        val e = Pendencia(novoToken(), sanear(relato), agora)
        esperas.add(e)
        if (autoOn) aprovarPendencia(e, agora)
        return Veredito.Espera(e.id)
    }

    /**
     * A PORTA ABERTA (v5.170), agora com uma porta de verdade atrás dela.
     *
     * A v5.170 declarou que "quem abrir o endereço entra" e a v5.171 construiu a
     * folha em volta disso — mas o caminho **não existia**: o `cliente.js`
     * mandava um `POST /par` com o relato e mais nada, e o `when` do
     * `EspelhoServidor.parear` não tinha ramo para um corpo assim. Caía no
     * `else -> 403`. Toda tela continuava precisando de QR ou dos seis dígitos,
     * e o pior sintoma era o de recuperação: a cada queda de rede, a cada
     * religada do espelho e a cada expiração de token, as telas voltavam à
     * página de pareamento e **ficavam lá**, mostrando um QR que ninguém ia ler.
     * Era isto, e não a rede, a maior parte de "conecta mas não é confiável".
     *
     * O que ela faz, e o que ela deliberadamente NÃO faz:
     *
     *  - **não cria [Pendencia] nenhuma.** O caminho do PIN cria uma porque o
     *    operador pode ter de decidir; aqui não há decisão a tomar, e uma espera
     *    por entrada encheria o [MAX_ESPERAS] em minutos numa tela que reconecta
     *    — trancando o PIN, que é o plano B;
     *  - **respeita o bloqueio por origem** (invariante 6) e o teto de
     *    [MAX_SESSOES], que continua sendo o dano real de um curioso na rede;
     *  - **não conta erro nenhum** quando a porta está fechada: não houve
     *    segredo tentado. Contá-lo faria uma tela que só perguntou "posso
     *    entrar?" gastar a cota de tentativas do visitante que está digitando o
     *    PIN ao lado.
     */
    @Synchronized
    fun entrarAberto(origem: String, relato: Relato, agora: Long): Veredito {
        limpar(agora)
        if (!noAr) return Veredito.Desligado
        if (!autoOn) return Veredito.Recusada

        val chave = sanear(origem, 64)
        val t = erros[chave]
        if (t != null && t.bloqueadoAte > agora) return Veredito.Bloqueada(t.bloqueadoAte - agora)

        val s = novaSessao(relato, agora) ?: return Veredito.Lotada
        return Veredito.Aprovada(s)
    }

    /**
     * O operador tirou ESTA tela do ar (o botão "Desconectar" da folha).
     *
     * Encerrar a sessão não basta com a porta aberta: a tela derrubada perde o
     * token, volta ao pareamento e **entra de novo em dois segundos** — o botão
     * reportaria sucesso e não faria nada visível. Por isso derrubar também põe
     * a origem de castigo, pelo mesmo mecanismo do PIN errado e por um prazo
     * curto: [BLOQUEIO_DERRUBADA_MS].
     *
     * Curto de propósito. Derrubar a tela errada é um toque; ficar sem poder
     * readmiti-la pelo resto do culto seria o preço errado para isso.
     */
    @Synchronized
    fun derrubar(token: String, origem: String, agora: Long) {
        encerrar(token)
        val chave = sanear(origem, 64)
        if (chave.isEmpty()) return
        val t = erros.getOrPut(chave) { Tentativas() }
        t.visto = agora
        t.bloqueadoAte = agora + BLOQUEIO_DERRUBADA_MS
    }

    /**
     * A espera do QR: **sem PIN, e por isso invisível para o operador até ele
     * apontar a câmera** (invariante 5b).
     *
     * Devolve um `id` a quem quer que peça — o que soa alarmante escrito assim,
     * e não é: o `id` é o que a tela vai DESENHAR num QR, e ele só vira acesso
     * quando o operador ler aquele desenho e chamar [aprovar]. Quem pede um id
     * sem ter uma tela na frente do operador tem 22 caracteres inúteis.
     *
     * O bloqueio por origem da invariante 6 **vale aqui também**, e é o que
     * impede que a mesma origem que está martelando o PIN use este caminho para
     * seguir consumindo estado enquanto cumpre o castigo. Ele não é ARMADO
     * aqui (não há segredo a errar), só respeitado.
     */
    @Synchronized
    fun esperaQr(origem: String, relato: Relato, agora: Long): Veredito {
        limpar(agora)
        if (!noAr) return Veredito.Desligado

        val chave = sanear(origem, 64)
        val t = erros[chave]
        if (t != null && t.bloqueadoAte > agora) return Veredito.Bloqueada(t.bloqueadoAte - agora)
        if (!abrirVagaQr(chave)) return Veredito.Lotada

        val e = Pendencia(novoToken(), sanear(relato), agora, viaQr = true, origem = chave)
        esperas.add(e)
        // **Nunca [autoOn] aqui** (invariante 5b): "aprovar automaticamente"
        // significa "quem acertou o PIN não precisa esperar meu toque", e não
        // "qualquer aparelho da rede entra sozinho".
        return Veredito.Espera(e.id)
    }

    /**
     * Abre uma vaga de QR: primeiro no teto da origem, depois no global.
     *
     * **Só despeja espera AGUARDANDO.** Despejar uma já aprovada devolveria
     * [Veredito.Desconhecida] à tela que acabou de ser liberada — ela voltaria
     * ao pareamento com um slot de sessão consumido, e o operador veria "a tela
     * não foi liberada" logo depois de tê-la liberado. Não havendo o que
     * despejar, o pedido é recusado com [Veredito.Lotada], que é uma frase.
     */
    private fun abrirVagaQr(chave: String): Boolean {
        if (!despejar({ it.viaQr && it.origem == chave }, MAX_QR_POR_ORIGEM)) return false
        return despejar({ it.viaQr }, MAX_ESPERAS_QR)
    }

    private fun despejar(quais: (Pendencia) -> Boolean, teto: Int): Boolean {
        while (esperas.count(quais) >= teto) {
            // `esperas` é acrescida no fim, então a primeira que casa é a mais
            // velha — nenhuma ordenação é necessária.
            val velha = esperas.firstOrNull { quais(it) && it.estado == Estado.AGUARDANDO }
                ?: return false
            esperas.remove(velha)
        }
        return true
    }

    /**
     * O poll do cliente: "a minha espera saiu?".
     *
     * Id desconhecido e id expirado dão a MESMA resposta, pelo mesmo motivo do
     * 404 uniforme do [EspelhoHttp]. E a espera aprovada continua respondendo
     * [Veredito.Aprovada] até vencer o prazo dela — se a resposta se perdeu na
     * rede (que é o cenário deste recurso: rede ruim), o cliente repete o poll e
     * recebe o mesmo token, em vez de ser mandado de volta ao PIN.
     */
    @Synchronized
    fun consultar(id: String, agora: Long): Veredito {
        limpar(agora)
        val e = acharPendencia(id) ?: return Veredito.Desconhecida
        return when (e.estado) {
            Estado.APROVADA -> e.sessao?.let { Veredito.Aprovada(it) } ?: Veredito.Desconhecida
            Estado.RECUSADA -> Veredito.Recusada
            Estado.AGUARDANDO -> Veredito.Pendente
        }
    }

    /**
     * As telas que esperam o operador — é o que a folha do Controle mostra.
     *
     * **As de QR ficam de fora** (invariante 5b): elas não provaram nada, e uma
     * lista em que o operador não consegue distinguir "esta é a TV da sala
     * anexa" de "este é o aparelho de alguém" é pior do que lista nenhuma. A
     * espera de QR se apresenta de outro jeito — desenhada na tela que a criou.
     */
    @Synchronized
    fun pendentes(): List<Pendente> = esperas
        .filter { it.estado == Estado.AGUARDANDO && !it.viaQr }
        .map { Pendente(it.id, it.relato, it.desde) }

    /**
     * Quantas telas estão com um QR em cartaz esperando a câmera — linha do
     * Registro.
     *
     * É o único jeito de o operador distinguir "ninguém abriu o endereço" de "a
     * tela abriu, criou a espera e o QR está lá, e o que não está funcionando é
     * a leitura". As duas coisas são a mesma folha vazia.
     */
    @Synchronized
    fun esperandoQr(): Int = esperas.count { it.viaQr && it.estado == Estado.AGUARDANDO }

    /**
     * O operador aprova. Devolve `null` quando não há espera com esse id, quando
     * ela já foi recusada, ou quando o teto de [MAX_SESSOES] está cheio.
     *
     * É **idempotente**: dois toques no botão devolvem a MESMA sessão, em vez de
     * cunhar um segundo token para a mesma tela e consumir dois dos três slots.
     */
    @Synchronized
    fun aprovar(id: String, agora: Long): Sessao? {
        limpar(agora)
        val e = acharPendencia(id) ?: return null
        return aprovarPendencia(e, agora)
    }

    /**
     * O operador recusa — e se a tela já estava aprovada, a sessão dela cai
     * junto. "Recusar" depois de aprovar é o operador mudando de ideia sobre a
     * TELA, não sobre a fila.
     */
    @Synchronized
    fun recusar(id: String) {
        val e = acharPendencia(id) ?: return
        val s = e.sessao
        if (s != null) vivas.removeAll { igual(s.token, it.token) }
        e.sessao = null
        e.estado = Estado.RECUSADA
    }

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
        for (e in esperas) {
            val s = e.sessao
            if (s != null && igual(token, s.token)) {
                e.sessao = null
                e.estado = Estado.RECUSADA
            }
        }
    }

    /** As sessões vivas, para a folha do Controle e para o Registro. */
    @Synchronized
    fun sessoes(): List<Sessao> = ArrayList(vivas)

    /**
     * Recolhe o que venceu: sessões, esperas e contadores de erro parados.
     *
     * Público porque o servidor a chama de tempos em tempos (um espelho ligado
     * sem cliente nenhum não teria quem passasse por aqui), e chamada no começo
     * de toda porta deste arquivo — assim nenhuma decisão é tomada sobre estado
     * podre, mesmo que ninguém varra nada.
     */
    @Synchronized
    fun limpar(agora: Long) {
        vivas.removeAll { it.expiraEm <= agora }
        esperas.removeAll { agora - it.desde > PRAZO_ESPERA_MS }
        val iter = erros.entries.iterator()
        while (iter.hasNext()) {
            val t = iter.next().value
            if (t.bloqueadoAte <= agora && agora - t.visto > BLOQUEIO_MS) iter.remove()
        }
    }

    // ------------------------------------------------------------ diagnóstico

    /** Quantos PINs foram recusados desde o [ligar] — linha do Registro. */
    @Synchronized
    fun recusas(): Int = recusados

    /** Quantas origens estão de castigo agora — a outra metade da mesma linha. */
    @Synchronized
    fun origensEmBloqueio(agora: Long): Int = erros.values.count { it.bloqueadoAte > agora }

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
     * neste arquivo, porque [tentar] o aplica antes de guardar.
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

    private fun aprovarPendencia(e: Pendencia, agora: Long): Sessao? {
        if (e.estado == Estado.RECUSADA) return null
        e.sessao?.let { return it }
        val s = novaSessao(e.relato, agora) ?: return null
        e.estado = Estado.APROVADA
        e.sessao = s
        return s
    }

    /**
     * Cunha uma sessão, ou `null` quando o teto de [MAX_SESSOES] está cheio **e
     * nenhuma das vagas está ociosa**.
     *
     * O relato já vem saneado de [tentar]/[esperaQr] no caminho da pendência; no
     * caminho da porta aberta ele chega cru, e por isso passa pelo funil aqui.
     * Sanear duas vezes é idempotente — `[\x20-\x7E]` já filtrado continua
     * filtrado —, e a alternativa (confiar em quem chama) é a forma de um
     * caminho novo entrar sem saneamento nenhum.
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

    private fun acharPendencia(id: String): Pendencia? {
        for (e in esperas) if (igual(id, e.id)) return e
        return null
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
     * é igual a vazio aqui: sem essa guarda, um PIN vazio casaria com o
     * [pinAtual] vazio de um espelho desligado — o caso em que o segredo não
     * existe é o caso em que ele não pode valer.
     */
    private fun igual(a: String, b: String): Boolean {
        if (a.isEmpty() || b.isEmpty()) return false
        return MessageDigest.isEqual(a.toByteArray(Charsets.UTF_8), b.toByteArray(Charsets.UTF_8))
    }
}
