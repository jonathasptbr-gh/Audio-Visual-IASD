package br.org.iasd.av

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.security.SecureRandom

/**
 * O oráculo do [EspelhoPares] — PIN, aprovação, token, prazo e bloqueio.
 *
 * A outra metade da justificativa da QUARTA EXCEÇÃO (o JUnit; ver
 * `app/build.gradle.kts`). Aqui um erro não vira pixel errado: vira uma tela
 * desconhecida projetando o culto, ou o operador trancado para fora do próprio
 * recurso.
 *
 * **Todo relógio entra por parâmetro.** Nenhum caso deste arquivo espera um
 * segundo de verdade — é por isso que dá para testar prazo de seis horas e
 * bloqueio de um minuto no mesmo CI que roda em segundos.
 */
class EspelhoParesTest {

    private val t0 = 1_000_000L
    private val origem = "192.168.0.77"
    private lateinit var pin: String

    /**
     * A FIXTURE FECHA A PORTA, e o modo aberto tem casos próprios.
     *
     * Desde a v5.170 o acesso nasce ABERTO — quem abre o endereço entra, sem
     * PIN. Isso é o produto, e está afirmado em
     * [acessoNasceAbertoEVoltaAoPadraoAoReligar] e
     * [comAcessoAbertoQualquerPinEntra].
     *
     * Mas a maior parte desta suíte existe para provar o CONTROLE DE ACESSO —
     * bloqueio por origem, PIN que não rotaciona, contador de recusas, o
     * segredo que não vaza no `toString`. Com a porta aberta, nada disso chega
     * a ser exercitado: os casos passariam por vacuidade, que é a pior forma de
     * um teste de segurança passar. Fechá-la aqui mantém cada um deles medindo
     * o que sempre mediu.
     */
    @Before
    fun ligar() {
        pin = EspelhoPares.ligar(t0)
        EspelhoPares.definirAutoAprovar(false)
    }

    /**
     * O [EspelhoPares] é um `object` — estado de processo. Desligar depois de
     * cada caso é o que garante que um teste não veja a sessão do anterior (o
     * [ligar] já zeraria, mas depender disso seria depender da ordem).
     */
    @After
    fun desligar() {
        EspelhoPares.desligar()
    }

    private fun relato(ua: String = "Chrome/141") = EspelhoPares.Relato(
        ua = ua,
        w = 1920,
        h = 1080,
        seguro = false,
        mse = true,
        mms = false,
        fetchStream = true,
        videoDecoder = false,
        wakeLock = false,
        telaAcesaMin = 0,
    )

    private fun pinErrado() = if (pin == "000000") "111111" else "000000"

    /** Pareia e aprova, devolvendo a sessão. */
    private fun parear(de: String = origem, agora: Long = t0): EspelhoPares.Sessao {
        val v = EspelhoPares.tentar(pin, de, relato(), agora)
        val id = (v as EspelhoPares.Veredito.Espera).id
        return EspelhoPares.aprovar(id, agora)!!
    }

    // --------------------------------------------------------------------- PIN

    @Test
    fun pinTemSeisDigitos() {
        assertTrue(pin, Regex("^[0-9]{6}$").matches(pin))
        // E os zeros à esquerda sobrevivem — um PIN de 5 dígitos na tela seria
        // impossível de digitar num campo que espera 6.
        val rnd = SecureRandom()
        repeat(500) {
            val p = EspelhoPares.novoPin(rnd)
            assertTrue(p, Regex("^[0-9]{6}$").matches(p))
        }
    }

    /**
     * Invariante 6, a metade que quase ninguém escreve: o PIN **não rotaciona**
     * por tentativa errada. Rotacionar seria negação de serviço contra o
     * pareamento legítimo — o atacante erra de propósito e o visitante que está
     * digitando recebe "PIN inválido" para sempre.
     */
    @Test
    fun pinNaoRotacionaComTentativaErrada() {
        repeat(ERRADAS) { EspelhoPares.tentar(pinErrado(), origem, relato(), t0) }
        assertEquals(pin, EspelhoPares.pin())
    }

    @Test
    fun trocarPinEAcaoDoOperadorENaoDerrubaSessao() {
        val s = parear()
        // Três trocas: um PIN sorteado pode repetir o anterior (1 em 1 milhão), e
        // um teste que reprova por azar é pior que teste nenhum. Quatro valores
        // todos iguais é 1 em 1e18 — isso não acontece.
        val vistos = (1..3).map { EspelhoPares.trocarPin() }.toSet() + pin
        assertTrue(vistos.size > 1)
        for (p in vistos) assertTrue(p, Regex("^[0-9]{6}$").matches(p))
        // E trocar o PIN não derruba quem já entrou — é isso que o separa de
        // desligar.
        assertNotNull(EspelhoPares.validar("Bearer ${s.token}", t0))
    }

    // -------------------------------------------------------------- pareamento

    /** Acertar o PIN dá vaga na fila do operador, não acesso (invariante 5). */
    @Test
    fun pinCertoEntraNaFilaDoOperador() {
        val v = EspelhoPares.tentar(pin, origem, relato(), t0)
        assertTrue(v is EspelhoPares.Veredito.Espera)
        val id = (v as EspelhoPares.Veredito.Espera).id
        assertSame(EspelhoPares.Veredito.Pendente, EspelhoPares.consultar(id, t0))
        assertEquals(1, EspelhoPares.pendentes().size)
        assertEquals(id, EspelhoPares.pendentes()[0].id)
    }

    @Test
    fun aprovarEntregaOTokenAoDonoDaEspera() {
        val v = EspelhoPares.tentar(pin, origem, relato(), t0)
        val id = (v as EspelhoPares.Veredito.Espera).id
        val s = EspelhoPares.aprovar(id, t0)
        assertNotNull(s)
        val consulta = EspelhoPares.consultar(id, t0)
        assertTrue(consulta is EspelhoPares.Veredito.Aprovada)
        assertEquals(s, (consulta as EspelhoPares.Veredito.Aprovada).sessao)
        // Aprovada, some da fila do operador.
        assertEquals(0, EspelhoPares.pendentes().size)
    }

    /** Dois toques no botão não podem cunhar dois tokens (e consumir dois slots). */
    @Test
    fun aprovarDuasVezesDevolveAMesmaSessao() {
        val v = EspelhoPares.tentar(pin, origem, relato(), t0)
        val id = (v as EspelhoPares.Veredito.Espera).id
        val a = EspelhoPares.aprovar(id, t0)!!
        val b = EspelhoPares.aprovar(id, t0)!!
        assertEquals(a.token, b.token)
        assertEquals(1, EspelhoPares.sessoes().size)
    }

    @Test
    fun recusarDerrubaAEsperaEASessao() {
        val v = EspelhoPares.tentar(pin, origem, relato(), t0)
        val id = (v as EspelhoPares.Veredito.Espera).id
        val s = EspelhoPares.aprovar(id, t0)!!
        EspelhoPares.recusar(id)
        assertSame(EspelhoPares.Veredito.Recusada, EspelhoPares.consultar(id, t0))
        assertNull(EspelhoPares.validar("Bearer ${s.token}", t0))
    }

    @Test
    fun esperaExpiraEViraDesconhecida() {
        val v = EspelhoPares.tentar(pin, origem, relato(), t0)
        val id = (v as EspelhoPares.Veredito.Espera).id
        val depois = t0 + EspelhoPares.PRAZO_ESPERA_MS + 1
        assertSame(EspelhoPares.Veredito.Desconhecida, EspelhoPares.consultar(id, depois))
        assertNull(EspelhoPares.aprovar(id, depois))
    }

    @Test
    fun idDeEsperaDesconhecidoNaoVazaNada() {
        assertSame(EspelhoPares.Veredito.Desconhecida, EspelhoPares.consultar("nao-existe", t0))
        assertNull(EspelhoPares.aprovar("nao-existe", t0))
    }

    @Test
    fun aprovarAutomaticamenteEntregaSemOperador() {
        EspelhoPares.definirAutoAprovar(true)
        val v = EspelhoPares.tentar(pin, origem, relato(), t0)
        val id = (v as EspelhoPares.Veredito.Espera).id
        assertTrue(EspelhoPares.consultar(id, t0) is EspelhoPares.Veredito.Aprovada)
    }

    /**
     * O ACESSO NASCE ABERTO (v5.170) — e volta a nascer aberto depois de o
     * operador o ter fechado e o espelho ter sido religado.
     *
     * O sentido é o oposto do que este caso afirmava até aqui, e a inversão é
     * deliberada: o espelho transmite a imagem do que está sendo projetado
     * PARA A CONGREGAÇÃO, isto é, conteúdo público — e três degraus de tela
     * mais seis dígitos em cartaz durante o culto custavam mais do que rendiam.
     * O que sustenta a decisão continua no lugar: o microfone nunca sai na
     * rede, o token nunca viaja numa URL, a allowlist de `Host` segue exata e o
     * teto de três sessões segue valendo.
     *
     * O que se AFIRMA aqui, e é o que uma refatoração poderia perder sem que
     * nada mais reclamasse: `ligar` devolve o PADRÃO, e não o último valor que
     * o operador escolheu. Fechar a porta é decisão de uma sessão.
     */
    /** Folga suficiente para estourar a fila em qualquer configuração. */
    private val MAX_SESSOES_FOLGA = 6

    @Test
    fun acessoNasceAbertoEVoltaAoPadraoAoReligar() {
        // A fixture fechou a porta de propósito (ver [ligar]); aqui o assunto é
        // justamente o PADRÃO, então religar é parte do caso.
        EspelhoPares.desligar()
        EspelhoPares.ligar(t0)
        assertTrue(EspelhoPares.autoAprovando())
        EspelhoPares.definirAutoAprovar(false)
        assertFalse(EspelhoPares.autoAprovando())
        EspelhoPares.desligar()
        EspelhoPares.ligar(t0)
        assertTrue(EspelhoPares.autoAprovando())
    }

    /** Com o acesso aberto, o PIN não é perguntado — entrar é abrir o endereço. */
    @Test
    fun comAcessoAbertoQualquerPinEntra() {
        EspelhoPares.definirAutoAprovar(true)
        val v = EspelhoPares.tentar("", origem, relato(), t0)
        assertTrue(v is EspelhoPares.Veredito.Espera)
        val id = (v as EspelhoPares.Veredito.Espera).id
        assertTrue(EspelhoPares.consultar(id, t0) is EspelhoPares.Veredito.Aprovada)
    }

    /**
     * E A FILA CONTINUA TENDO TETO com a porta aberta.
     *
     * Abrir o acesso não abre a torneira: a aprovação automática só sai
     * enquanto houver vaga, e o excesso vira [Veredito.Lotada] — que é uma
     * frase para o visitante, não um travamento. Sem esta afirmação, uma
     * refatoração poderia deixar o "aberto" passar por cima do teto de sessões,
     * que é o dano REAL de um curioso na rede (ele toma a vaga da TV do
     * templo), e não o sigilo.
     */
    @Test
    fun oTetoContinuaValendoComAcessoAberto() {
        EspelhoPares.definirAutoAprovar(true)
        var lotou = false
        repeat(EspelhoPares.MAX_ESPERAS + MAX_SESSOES_FOLGA) {
            val v = EspelhoPares.tentar("", origem + it, relato(), t0)
            if (v is EspelhoPares.Veredito.Lotada) lotou = true
        }
        assertTrue("a fila precisa recusar em algum ponto", lotou)
    }

    @Test
    fun filaDoOperadorTemTeto() {
        repeat(EspelhoPares.MAX_ESPERAS) {
            assertTrue(EspelhoPares.tentar(pin, origem, relato(), t0) is EspelhoPares.Veredito.Espera)
        }
        assertSame(
            EspelhoPares.Veredito.Lotada,
            EspelhoPares.tentar(pin, origem, relato(), t0),
        )
    }

    // ------------------------------------------------------------ o QR (5b)
    //
    // A espera de QR é o caminho em que ninguém prova nada — e ela é mais forte
    // que o PIN justamente por isso: o que autoriza não é um segredo digitado, é
    // o operador ter apontado a câmera para AQUELA tela. Os casos abaixo travam
    // as três regras que sustentam a afirmação.

    @Test
    fun qrDaUmIdSemPinENaoLiberaNada() {
        val v = EspelhoPares.esperaQr(origem, relato(), t0)
        assertTrue(v is EspelhoPares.Veredito.Espera)
        val id = (v as EspelhoPares.Veredito.Espera).id
        assertTrue(id.length >= 16)
        // Sem a aprovação, o poll continua respondendo "pendente" para sempre —
        // ter o id não é ter acesso.
        assertSame(EspelhoPares.Veredito.Pendente, EspelhoPares.consultar(id, t0))
        assertTrue(EspelhoPares.sessoes().isEmpty())
    }

    @Test
    fun qrSoEntraQuandoOOperadorAprovaAquelaEspera() {
        val id = (EspelhoPares.esperaQr(origem, relato(), t0) as EspelhoPares.Veredito.Espera).id
        assertNotNull(EspelhoPares.aprovar(id, t0))
        val v = EspelhoPares.consultar(id, t0)
        assertTrue(v is EspelhoPares.Veredito.Aprovada)
        assertEquals(1, EspelhoPares.sessoes().size)
    }

    /**
     * **A regra que impede a folha do operador de virar lixo**: a espera de QR
     * não aparece na lista. Ele não teria como distinguir "a TV da sala anexa"
     * de "o aparelho de alguém", e aprovar às cegas é o oposto da invariante 5.
     */
    @Test
    fun esperaDeQrNaoApareceNaFolhaDoOperador() {
        EspelhoPares.esperaQr(origem, relato(), t0)
        EspelhoPares.esperaQr(origem, relato(), t0)
        assertTrue(EspelhoPares.pendentes().isEmpty())
        assertEquals(2, EspelhoPares.esperandoQr())
        // E a do PIN continua aparecendo — o par negativo, sem o qual este caso
        // passaria com `pendentes()` devolvendo sempre vazio.
        EspelhoPares.tentar(pin, origem, relato(), t0)
        assertEquals(1, EspelhoPares.pendentes().size)
    }

    /**
     * **"Aprovar automaticamente" nunca significou "qualquer aparelho da rede
     * entra sozinho".** Ele existe para poupar o toque de quem ACERTOU O PIN.
     */
    @Test
    fun aprovacaoAutomaticaNaoAlcancaOQr() {
        EspelhoPares.definirAutoAprovar(true)
        val id = (EspelhoPares.esperaQr(origem, relato(), t0) as EspelhoPares.Veredito.Espera).id
        assertSame(EspelhoPares.Veredito.Pendente, EspelhoPares.consultar(id, t0))
        assertTrue(EspelhoPares.sessoes().isEmpty())
        // Enquanto pelo PIN ela sai na hora, como sempre.
        val v = EspelhoPares.tentar(pin, origem, relato(), t0)
        assertTrue(EspelhoPares.consultar((v as EspelhoPares.Veredito.Espera).id, t0)
            is EspelhoPares.Veredito.Aprovada)
    }

    /**
     * O teto por ORIGEM despeja a mais velha DAQUELA origem — uma tela que
     * recarrega a página não pode acumular esperas para sempre, e não pode
     * empurrar a de outra tela para fora.
     */
    @Test
    fun tetoDeQrPorOrigemDespejaAMaisVelhaDaMesmaOrigem() {
        val a = (EspelhoPares.esperaQr(origem, relato(), t0) as EspelhoPares.Veredito.Espera).id
        val b = (EspelhoPares.esperaQr(origem, relato(), t0) as EspelhoPares.Veredito.Espera).id
        val outra = (EspelhoPares.esperaQr("192.168.0.90", relato(), t0) as EspelhoPares.Veredito.Espera).id
        val c = (EspelhoPares.esperaQr(origem, relato(), t0) as EspelhoPares.Veredito.Espera).id
        assertSame(EspelhoPares.Veredito.Desconhecida, EspelhoPares.consultar(a, t0))
        assertSame(EspelhoPares.Veredito.Pendente, EspelhoPares.consultar(b, t0))
        assertSame(EspelhoPares.Veredito.Pendente, EspelhoPares.consultar(c, t0))
        // A de outro endereço fica INTACTA: o teto é por origem, não global.
        assertSame(EspelhoPares.Veredito.Pendente, EspelhoPares.consultar(outra, t0))
    }

    /**
     * E uma espera de QR **já aprovada nunca é despejada**. Despejá-la devolveria
     * `Desconhecida` à tela que o operador acabou de liberar — ela voltaria ao
     * pareamento com um dos três slots de sessão consumido.
     */
    @Test
    fun qrAprovadoNaoEDespejadoPeloTeto() {
        val vivo = (EspelhoPares.esperaQr(origem, relato(), t0) as EspelhoPares.Veredito.Espera).id
        EspelhoPares.aprovar(vivo, t0)
        repeat(4) { EspelhoPares.esperaQr(origem, relato(), t0) }
        assertTrue(EspelhoPares.consultar(vivo, t0) is EspelhoPares.Veredito.Aprovada)
    }

    /**
     * As duas filas são SEPARADAS, e é isso que impede que encher o balde do QR
     * (que qualquer um na rede pode fazer) negue o pareamento por PIN — o
     * caminho que ainda funciona quando não há câmera.
     */
    @Test
    fun qrLotadoNaoTrancaOPin() {
        repeat(EspelhoPares.MAX_ESPERAS_QR + 4) { EspelhoPares.esperaQr("10.0.0.$it", relato(), t0) }
        assertTrue(EspelhoPares.tentar(pin, origem, relato(), t0) is EspelhoPares.Veredito.Espera)
    }

    /** E o bloqueio por origem da invariante 6 vale para o QR também. */
    @Test
    fun origemBloqueadaNaoGanhaQr() {
        repeat(ERRADAS) { EspelhoPares.tentar(pinErrado(), origem, relato(), t0) }
        assertTrue(EspelhoPares.esperaQr(origem, relato(), t0) is EspelhoPares.Veredito.Bloqueada)
        // Outra origem segue livre — o castigo é do endereço, não do recurso.
        assertTrue(EspelhoPares.esperaQr("192.168.0.90", relato(), t0) is EspelhoPares.Veredito.Espera)
    }

    @Test
    fun qrComEspelhoDesligadoNaoDaId() {
        EspelhoPares.desligar()
        assertSame(EspelhoPares.Veredito.Desligado, EspelhoPares.esperaQr(origem, relato(), t0))
    }

    // -------------------------------------------------- bloqueio por origem

    /**
     * Invariante 6: cinco erros da MESMA origem e o sexto não é nem lido — nem
     * quando ele traz o PIN certo. Um atacante que acertasse na sexta continua
     * de fora.
     */
    @Test
    fun cincoPinsErradosBloqueiamOSexto() {
        repeat(ERRADAS) {
            assertSame(
                EspelhoPares.Veredito.Recusada,
                EspelhoPares.tentar(pinErrado(), origem, relato(), t0),
            )
        }
        val sexto = EspelhoPares.tentar(pin, origem, relato(), t0)
        assertTrue("o 6º com o PIN CERTO ainda tem de ser bloqueado", sexto is EspelhoPares.Veredito.Bloqueada)
        assertEquals(EspelhoPares.BLOQUEIO_MS, (sexto as EspelhoPares.Veredito.Bloqueada).restaMs)
    }

    /** O bloqueio é da ORIGEM: o vizinho continua conseguindo parear. */
    @Test
    fun bloqueioNaoAtingeOutraOrigem() {
        repeat(ERRADAS) { EspelhoPares.tentar(pinErrado(), origem, relato(), t0) }
        assertTrue(
            EspelhoPares.tentar(pin, "192.168.0.90", relato(), t0) is EspelhoPares.Veredito.Espera
        )
    }

    @Test
    fun bloqueioVenceEACotaVolta() {
        repeat(ERRADAS) { EspelhoPares.tentar(pinErrado(), origem, relato(), t0) }
        val depois = t0 + EspelhoPares.BLOQUEIO_MS + 1
        assertTrue(EspelhoPares.tentar(pin, origem, relato(), depois) is EspelhoPares.Veredito.Espera)
    }

    @Test
    fun contadorDeRecusasAlimentaORegistro() {
        repeat(3) { EspelhoPares.tentar(pinErrado(), origem, relato(), t0) }
        assertEquals(3, EspelhoPares.recusas())
        assertEquals(0, EspelhoPares.origensEmBloqueio(t0))
        repeat(2) { EspelhoPares.tentar(pinErrado(), origem, relato(), t0) }
        assertEquals(1, EspelhoPares.origensEmBloqueio(t0))
    }

    // ------------------------------------------------------------------ token

    @Test
    fun tokenValidaComOCabecalhoCruOuComOTokenSozinho() {
        val s = parear()
        assertEquals(s, EspelhoPares.validar("Bearer ${s.token}", t0))
        // O esquema é insensível a caixa (RFC 7235); o token, não — base64url
        // distingue caixa, e "quase igual" aqui é igual a errado.
        assertEquals(s, EspelhoPares.validar("bearer ${s.token}", t0))
        assertNull(EspelhoPares.validar("Bearer ${s.token.uppercase()}x", t0))
        // O vigia das conexões só guardou o token, sem cabeçalho nenhum.
        assertEquals(s, EspelhoPares.validar(s.token, t0))
        // E tolerar as duas formas não abre nada: um token não tem espaço, então
        // nenhum outro esquema casa.
        assertNull(EspelhoPares.validar("Basic ${s.token}", t0))
        assertNull(EspelhoPares.validar("Bearer ", t0))
        assertNull(EspelhoPares.validar("", t0))
        assertNull(EspelhoPares.validar(null, t0))
    }

    @Test
    fun tokenInventadoNaoVale() {
        parear()
        assertNull(EspelhoPares.validar("Bearer AAAAAAAAAAAAAAAAAAAAAA", t0))
        assertNull(EspelhoPares.validar("Bearer ", t0))
    }

    @Test
    fun tokenExpiraNoPrazo() {
        val s = parear()
        assertNotNull(EspelhoPares.validar("Bearer ${s.token}", t0 + EspelhoPares.PRAZO_SESSAO_MS - 1))
        assertNull(EspelhoPares.validar("Bearer ${s.token}", t0 + EspelhoPares.PRAZO_SESSAO_MS))
        assertEquals(0, EspelhoPares.sessoes().size)
    }

    /**
     * O prazo NÃO desliza com o uso: uma janela que se renova sozinha nunca
     * expira enquanto alguém a estiver usando — que é exatamente a situação do
     * token vazado sendo usado por outro.
     */
    @Test
    fun usarOTokenNaoEstendeOPrazo() {
        val s = parear()
        EspelhoPares.validar("Bearer ${s.token}", t0 + EspelhoPares.PRAZO_SESSAO_MS - 10)
        assertNull(EspelhoPares.validar("Bearer ${s.token}", t0 + EspelhoPares.PRAZO_SESSAO_MS))
    }

    @Test
    fun doisPareamentosDaoTokensDiferentes() {
        val a = parear("192.168.0.10")
        val b = parear("192.168.0.11")
        assertNotEquals(a.token, b.token)
        assertEquals(22, a.token.length) // 128 bits em base64url, sem padding
        assertFalse(a.token.contains('='))
        assertFalse(a.token.contains('/'))
        assertFalse(a.token.contains('+'))
    }

    @Test
    fun tetoDeTresSessoes() {
        val ids = (1..4).map {
            (EspelhoPares.tentar(pin, "192.168.0.$it", relato(), t0) as EspelhoPares.Veredito.Espera).id
        }
        val primeira = EspelhoPares.aprovar(ids[0], t0)!!
        EspelhoPares.aprovar(ids[1], t0)!!
        EspelhoPares.aprovar(ids[2], t0)!!
        assertNull("a quarta tela não entra sem o operador liberar uma", EspelhoPares.aprovar(ids[3], t0))
        EspelhoPares.encerrar(primeira.token)
        assertNotNull(EspelhoPares.aprovar(ids[3], t0))
        assertEquals(EspelhoPares.MAX_SESSOES, EspelhoPares.sessoes().size)
    }

    @Test
    fun encerrarTiraATelaDoAr() {
        val s = parear()
        EspelhoPares.encerrar(s.token)
        assertNull(EspelhoPares.validar("Bearer ${s.token}", t0))
    }

    /** Não há token que sobreviva ao culto (invariante 3). */
    @Test
    fun desligarZeraTudo() {
        val s = parear()
        EspelhoPares.desligar()
        assertNull(EspelhoPares.validar("Bearer ${s.token}", t0))
        assertEquals(0, EspelhoPares.sessoes().size)
        assertEquals(0, EspelhoPares.pendentes().size)
        assertEquals("", EspelhoPares.pin())
        assertFalse(EspelhoPares.estaLigado())
        assertSame(
            EspelhoPares.Veredito.Desligado,
            EspelhoPares.tentar("000000", origem, relato(), t0),
        )
    }

    /**
     * Com o espelho desligado o PIN guardado é vazio — e um PIN vazio vindo da
     * rede não pode casar com ele. É a guarda de string vazia da comparação em
     * tempo constante.
     */
    @Test
    fun pinVazioNaoCasaComEspelhoDesligado() {
        // Ligado, o PIN vazio é só um PIN errado.
        assertSame(EspelhoPares.Veredito.Recusada, EspelhoPares.tentar("", origem, relato(), t0))
        // Desligado, o PIN guardado É vazio — e é aí que a guarda de string vazia
        // da comparação em tempo constante impede o casamento de dois nadas.
        EspelhoPares.desligar()
        assertSame(EspelhoPares.Veredito.Desligado, EspelhoPares.tentar("", origem, relato(), t0))
    }

    // -------------------------------------------------------------- saneamento

    /**
     * Invariante 9. O `ua` vai para o **Registro**, que tem botão de copiar e
     * existe para ser repassado: um `\n` ali injeta uma linha inteira de
     * diagnóstico falso, e um diagnóstico que mente é pior que diagnóstico
     * nenhum.
     */
    @Test
    fun saneamentoTiraQuebraDeLinhaEAspas() {
        val sujo = "Mozilla/5.0\r\nservidor: ligado em 10.0.0.1:8787\ttab\u0000nul \"aspas\" \\barra"
        val limpo = EspelhoPares.sanear(sujo)
        assertFalse(limpo.contains('\n'))
        assertFalse(limpo.contains('\r'))
        assertFalse(limpo.contains('\t'))
        assertFalse(limpo.contains('\u0000'))
        assertFalse(limpo.contains('"'))
        assertFalse(limpo.contains('\\'))
        assertTrue(limpo.startsWith("Mozilla/5.0servidor: ligado"))
    }

    @Test
    fun saneamentoCortaNoTeto() {
        val limpo = EspelhoPares.sanear("z".repeat(1000))
        assertEquals(EspelhoPares.TETO_TEXTO, limpo.length)
    }

    @Test
    fun saneamentoDerrubaAcentoEEmoji() {
        // Fora de [\x20-\x7E] não entra nada — inclusive o que é inofensivo. O
        // "ã" cai junto com o emoji (que são dois surrogates, os dois fora da
        // faixa), e sobram só os ASCII: "N", "o" e o espaço.
        assertEquals("No ", EspelhoPares.sanear("Não 🙂"))
    }

    /**
     * O relato guardado já vem saneado — **não é o JS que limpa, e não é o
     * servidor**.
     *
     * Este caso é o contrato com o `EspelhoServidor`: ele monta o [EspelhoPares.Relato]
     * CRU a partir do JSON (só ele pode, porque `org.json` é da plataforma e não
     * existe num teste de JVM) e entrega aqui; o saneamento acontece num ponto
     * só, do lado que tem teste. Se alguém um dia sanear lá também, esta é a
     * asserção que continua valendo — e a de lá é que vira a segunda cópia de uma
     * regra de segurança.
     */
    @Test
    fun oRelatoGuardadoJaVemSaneado() {
        val v = EspelhoPares.tentar(
            pin,
            origem,
            relato("Firefox\r\ntelas: 99 conectadas \"x\"").copy(w = -5, h = 999_999, telaAcesaMin = -1),
            t0,
        )
        val id = (v as EspelhoPares.Veredito.Espera).id
        val s = EspelhoPares.aprovar(id, t0)!!
        assertFalse(s.relato.ua.contains('\n'))
        assertFalse(s.relato.ua.contains('\r'))
        assertFalse(s.relato.ua.contains('"'))
        assertTrue(s.relato.ua.length <= EspelhoPares.TETO_TEXTO)
        assertEquals(0, s.relato.w)
        assertEquals(20_000, s.relato.h)
        assertEquals(0, s.relato.telaAcesaMin)
    }

    /**
     * O `token` e o `id` são PORTADORES: quem os tem entra. Eles não podem sair
     * numa interpolação distraída — e o Registro é copiado e repassado.
     */
    @Test
    fun oSegredoNaoApareceNoToString() {
        val v = EspelhoPares.tentar(pin, origem, relato(), t0)
        val id = (v as EspelhoPares.Veredito.Espera).id
        val pendente = EspelhoPares.pendentes()[0]
        assertFalse(pendente.toString().contains(id))
        val s = EspelhoPares.aprovar(id, t0)!!
        assertFalse(s.toString().contains(s.token))
    }

    private companion object {
        /** Legibilidade: o número que a invariante 6 fixa. */
        const val ERRADAS = EspelhoPares.ERROS_ATE_BLOQUEIO
    }
}

/**
 * O ORÁCULO DO NOME DO CERTIFICADO — as duas funções PURAS do [EspelhoCert].
 *
 * Elas decidem o que entra na allowlist de `Host` do servidor, e é aí que um
 * erro custa caro: um nome errado (ou um wildcard aceito por engano) faz o
 * `EspelhoHttp` devolver o 404 IDÊNTICO a toda requisição, e o sintoma no
 * aparelho é "com certificado o espelho para de funcionar" — sem nada no
 * Registro que o explique, porque o 404 é idêntico de propósito.
 *
 * Ficam neste arquivo, e não num terceiro, porque são da mesma família: o
 * controle de acesso do espelho, escrito sem Android e testado sem aparelho.
 */
class EspelhoCertNomeTest {

    @Test
    fun cnSimples() {
        assertEquals("telao.igreja.org.br", EspelhoCert.cnDe("CN=telao.igreja.org.br,O=Igreja,C=BR"))
    }

    @Test
    fun cnNoMeioEComEspacos() {
        assertEquals("telao.igreja.org.br", EspelhoCert.cnDe("O=Igreja, CN=telao.igreja.org.br, C=BR"))
    }

    @Test
    fun cnEmMinusculas() {
        assertEquals("x.igreja.org.br", EspelhoCert.cnDe("cn=x.igreja.org.br"))
    }

    /**
     * A vírgula ESCAPADA faz parte do valor. Dividir sem olhar o escape cortaria
     * um CN legítimo ao meio — raro, e silencioso quando acontece.
     */
    @Test
    fun cnComVirgulaEscapada() {
        assertEquals("Igreja, Central", EspelhoCert.cnDe("CN=Igreja\\, Central,O=X"))
    }

    @Test
    fun dnSemCnDaVazio() {
        assertEquals("", EspelhoCert.cnDe("O=Igreja,C=BR"))
        assertEquals("", EspelhoCert.cnDe(""))
    }

    /** "CNPJ=" começa com CN e NÃO é um CN. */
    @Test
    fun cnNaoCasaComPrefixoParecido() {
        assertEquals("", EspelhoCert.cnDe("CNPJ=123,O=X"))
    }

    @Test
    fun nomeUtilAceitaUmNomeDeVerdade() {
        assertTrue(EspelhoCert.nomeUtil("telao.igreja.org.br"))
        assertTrue(EspelhoCert.nomeUtil("a-b.c.d"))
    }

    /**
     * **O WILDCARD É RECUSADO**, e não é detalhe: a allowlist de `Host` é EXATA
     * por invariante, e um `*.lan.igreja.org.br` guardado ali não casaria com
     * `Host` nenhum — o servidor ficaria esperando uma conexão que nunca chega.
     */
    @Test
    fun nomeUtilRecusaWildcard() {
        assertFalse(EspelhoCert.nomeUtil("*.lan.igreja.org.br"))
    }

    /** Sem ponto é rótulo de rede local, não um nome que o roteador resolve. */
    @Test
    fun nomeUtilRecusaRotuloSemPonto() {
        assertFalse(EspelhoCert.nomeUtil("telao"))
    }

    @Test
    fun nomeUtilRecusaLixo() {
        assertFalse(EspelhoCert.nomeUtil(""))
        assertFalse(EspelhoCert.nomeUtil("com espaço.br"))
        assertFalse(EspelhoCert.nomeUtil("http://x.br"))
        assertFalse(EspelhoCert.nomeUtil("x.br:8787"))
        assertFalse(EspelhoCert.nomeUtil("a".repeat(254) + ".br"))
    }
}
