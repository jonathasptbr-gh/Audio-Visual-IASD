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
 * O oráculo do [EspelhoPares] — o CÓDIGO, o token, o prazo e o bloqueio.
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
    private lateinit var codigo: String

    @Before
    fun ligar() {
        codigo = EspelhoPares.ligar(t0)
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

    private fun codigoErrado() = if (codigo == "000") "111" else "000"

    /** Entra com o código certo, devolvendo a sessão. */
    private fun parear(de: String = origem, agora: Long = t0): EspelhoPares.Sessao =
        (EspelhoPares.tentar(codigo, de, relato(), agora) as EspelhoPares.Veredito.Aprovada).sessao

    // ------------------------------------------------------------------ CÓDIGO

    @Test
    fun codigoTemTresDigitos() {
        assertTrue(codigo, Regex("^[0-9]{3}$").matches(codigo))
        assertEquals(EspelhoPares.DIGITOS_CODIGO, codigo.length)
    }

    /**
     * OS ZEROS À ESQUERDA SOBREVIVEM, e este caso é o que impede a regressão
     * mais provável deste arquivo: alguém trocar a `String` por um `Int` em
     * qualquer ponto do caminho. Um em cada dez códigos começa com zero, e "007"
     * virando "7" faz a folha do operador mostrar dois dígitos e a tela recusar
     * os três que ele ditou — sem nada quebrar em lugar nenhum.
     */
    @Test
    fun zeroAEsquerdaSobrevive() {
        val fixa = object : SecureRandom() {
            override fun nextInt(bound: Int) = 7
        }
        assertEquals("007", EspelhoPares.novoCodigo(fixa))
    }

    /** Invariante 6: errar não troca o segredo — isso seria DoS contra quem digita. */
    @Test
    fun codigoNaoRotacionaComTentativaErrada() {
        EspelhoPares.tentar(codigoErrado(), origem, relato(), t0)
        assertEquals(codigo, EspelhoPares.codigo())
    }

    /**
     * Trocar o código é ação do operador, e ela NÃO derruba quem já está vendo:
     * é isso que separa "trocar o código" de "desligar".
     */
    @Test
    fun trocarCodigoEAcaoDoOperadorENaoDerrubaSessao() {
        val s = parear()
        val novo = EspelhoPares.trocarCodigo()
        assertNotEquals(codigo, novo)
        assertEquals(novo, EspelhoPares.codigo())
        assertNotNull("quem já entrou continua vendo", EspelhoPares.validar(s.token, t0))
        // E o código VELHO deixa de valer no mesmo instante.
        assertSame(
            EspelhoPares.Veredito.Recusada,
            EspelhoPares.tentar(codigo, "192.168.0.90", relato(), t0),
        )
    }

    @Test
    fun trocarComEspelhoDesligadoNaoInventaCodigo() {
        EspelhoPares.desligar()
        assertEquals("", EspelhoPares.trocarCodigo())
    }

    // ------------------------------------------------------------- a ENTRADA

    /**
     * O CONTRATO INTEIRO DESDE A v5.185: código certo ⇒ token, na MESMA chamada.
     *
     * Não há 202, não há espera, não há poll. É o que permite ao botão
     * "Conectar" da página do cliente carregar o gesto que libera o som e a tela
     * cheia — uma aprovação que chegasse depois encontraria o gesto já gasto.
     */
    @Test
    fun codigoCertoEntraNaHora() {
        val v = EspelhoPares.tentar(codigo, origem, relato(), t0)
        assertTrue(v is EspelhoPares.Veredito.Aprovada)
        val s = (v as EspelhoPares.Veredito.Aprovada).sessao
        assertNotNull(EspelhoPares.validar(s.token, t0))
        assertEquals(1, EspelhoPares.sessoes().size)
    }

    @Test
    fun codigoErradoNaoEntra() {
        assertSame(
            EspelhoPares.Veredito.Recusada,
            EspelhoPares.tentar(codigoErrado(), origem, relato(), t0),
        )
        assertEquals(0, EspelhoPares.sessoes().size)
    }

    /** Com o espelho desligado nada entra — nem com o código de antes. */
    @Test
    fun espelhoDesligadoNaoAceitaNinguem() {
        EspelhoPares.desligar()
        assertSame(
            EspelhoPares.Veredito.Desligado,
            EspelhoPares.tentar(codigo, origem, relato(), t0),
        )
    }

    /**
     * RELIGAR TROCA O CÓDIGO, e isso é o produto: ele nasce no `ligar`, que é o
     * instante em que o operador ativa a transmissão. O código do culto passado
     * não abre o culto de hoje.
     */
    @Test
    fun religarTrocaOCodigoEDerrubaTudo() {
        val s = parear()
        val velho = codigo
        val novo = EspelhoPares.ligar(t0 + 1000)
        assertNull("nenhum token sobrevive ao religar", EspelhoPares.validar(s.token, t0 + 1000))
        assertSame(
            EspelhoPares.Veredito.Recusada,
            EspelhoPares.tentar(velho, origem, relato(), t0 + 1000),
        )
        assertTrue(
            EspelhoPares.tentar(novo, origem, relato(), t0 + 1000) is EspelhoPares.Veredito.Aprovada,
        )
    }

    /**
     * LOTADO NÃO É CÓDIGO ERRADO, e a distinção não é cosmética: as duas têm
     * saídas opostas (fechar uma tela × conferir o número), e o cliente escolhe
     * a frase pelo corpo da resposta.
     *
     * **E lotado não gasta cota**: o segredo estava certo, faltou vaga. Contá-lo
     * faria a quarta tela bloquear a própria origem tentando de novo, sem nunca
     * ter errado nada.
     */
    @Test
    fun lotadoEDiferenteDeRecusadoENaoContaErro() {
        repeat(EspelhoPares.MAX_SESSOES) { i ->
            assertTrue(
                EspelhoPares.tentar(codigo, "10.0.0.$i", relato(), t0) is EspelhoPares.Veredito.Aprovada,
            )
        }
        val quarta = "10.0.0.99"
        repeat(EspelhoPares.ERROS_ATE_BLOQUEIO + 2) {
            assertSame(
                EspelhoPares.Veredito.Lotada,
                EspelhoPares.tentar(codigo, quarta, relato(), t0),
            )
        }
        assertEquals("lotado não é recusa", 0, EspelhoPares.recusas())
        assertEquals("e não põe ninguém de castigo", 0, EspelhoPares.origensEmBloqueio(t0))
    }

    // ------------------------------------------- a VAGA que ninguém está usando

    /**
     * TRÊS RECOMEÇOS NÃO PODEM TRANCAR O ESPELHO PELO RESTO DO CULTO.
     *
     * Uma sessão só saía de `vivas` por [EspelhoPares.encerrar], por
     * [EspelhoPares.derrubar] ou pelas SEIS HORAS do prazo. Uma tela que recomeça
     * numa aba nova (a TV desligada e religada, o navegador que perdeu o
     * `sessionStorage`) pede um token novo e deixa o antigo ocupando vaga — e com
     * a porta aberta isso deixou de ser hipótese.
     */
    @Test
    fun vagaOciosaEAproveitadaPorUmaTelaNova() {
        repeat(EspelhoPares.MAX_SESSOES) {
            assertTrue(EspelhoPares.tentar(codigo, "10.0.0.$it", relato(), t0) is EspelhoPares.Veredito.Aprovada)
        }
        // No mesmo instante ninguém está ocioso: o teto vale, e é isso que
        // impede a vaga de virar torneira.
        assertSame(
            EspelhoPares.Veredito.Lotada,
            EspelhoPares.tentar(codigo, "10.0.0.99", relato(), t0),
        )
        // Passado o prazo de ociosidade sem NENHUMA delas ter sido usada, a
        // quarta entra — tomando a vaga de quem já foi embora.
        val depois = t0 + EspelhoPares.PRAZO_OCIOSA_MS + 1
        assertTrue(
            EspelhoPares.tentar(codigo, "10.0.0.99", relato(), depois) is EspelhoPares.Veredito.Aprovada,
        )
        assertEquals(EspelhoPares.MAX_SESSOES, EspelhoPares.sessoes().size)
    }

    /**
     * A VAGA DE UMA TELA QUE O SERVIDOR JÁ SABE TER MORRIDO ABRE ANTES (v5.183).
     *
     * `ultimoUsoMs` é renovado a cada volta do vigia enquanto a conexão existir,
     * então uma TV desligada na tomada às 10h00 e fechada pelo
     * `TETO_SEM_RELATO_MS` às 10h01 fica com carimbo de "1 min atrás" — e o
     * critério de ociosidade só a soltaria às ~10h05. Nesse intervalo a tela do
     * saguão que alguém acabou de ligar recebe "lotado" **com a folha do
     * operador listando duas telas**, e não há em quem tocar em "Desconectar".
     *
     * É a §10-A.10 item 2 corrigida pela metade: ela falhava justamente no
     * exemplo que o doc nomeia — a TV que foi desligada e religada.
     */
    @Test
    fun aVagaDeUmaTelaQueCaiuAbreAntesDaOciosidade() {
        val caiu = (EspelhoPares.tentar(codigo, "10.0.0.1", relato(), t0) as EspelhoPares.Veredito.Aprovada).sessao
        repeat(EspelhoPares.MAX_SESSOES - 1) {
            assertTrue(EspelhoPares.tentar(codigo, "10.0.0.5$it", relato(), t0) is EspelhoPares.Veredito.Aprovada)
        }
        // O vigia conclui que a primeira foi embora e fecha a conexão dela. As
        // três continuam falando pelo canal de relato — isto é, `ultimoUsoMs`
        // continua fresco para TODAS, que é o que travava a vaga.
        val fechou = t0 + 60_000
        assertTrue(EspelhoPares.marcarSemConexao(caiu.token, fechou))
        val agora = fechou + EspelhoPares.PRAZO_SEM_CONEXAO_MS + 1
        for (s in EspelhoPares.sessoes()) assertNotNull(EspelhoPares.validar(s.token, agora - 1))

        // Bem antes do prazo de ociosidade, a vaga da que caiu já abre.
        assertTrue(
            "a vaga da tela que caiu tem de abrir sem esperar a ociosidade",
            agora - t0 < EspelhoPares.PRAZO_OCIOSA_MS,
        )
        assertTrue(
            EspelhoPares.tentar(codigo, "10.0.0.99", relato(), agora) is EspelhoPares.Veredito.Aprovada,
        )
        assertNull("a vaga tomada é a da tela que caiu", EspelhoPares.validar(caiu.token, agora))
    }

    /**
     * E ELA NÃO ABRE CEDO DEMAIS. Uma tela em recuperação normal fica sem
     * conexão por uma volta inteira (o vigia de fio do cliente aborta aos 20 s,
     * mais a escada de até 8 s): tomar a vaga dela no meio disso trocaria um
     * fantasma por uma tela VIVA expulsa — o defeito oposto, e pior, porque
     * atinge quem estava funcionando.
     */
    @Test
    fun aVagaNaoAbreEnquantoATelaAindaPodeVoltar() {
        val caiu = (EspelhoPares.tentar(codigo, "10.0.0.1", relato(), t0) as EspelhoPares.Veredito.Aprovada).sessao
        repeat(EspelhoPares.MAX_SESSOES - 1) {
            assertTrue(EspelhoPares.tentar(codigo, "10.0.0.5$it", relato(), t0) is EspelhoPares.Veredito.Aprovada)
        }
        assertTrue(EspelhoPares.marcarSemConexao(caiu.token, t0))
        assertSame(
            "dentro da janela de recuperação a vaga é dela",
            EspelhoPares.Veredito.Lotada,
            EspelhoPares.tentar(codigo, "10.0.0.99", relato(), t0 + EspelhoPares.PRAZO_SEM_CONEXAO_MS - 1),
        )
    }

    /**
     * E A TELA QUE RECONECTOU DEIXA DE SER FANTASMA. Sem isto ela seguiria
     * marcada pelo resto da sessão, e a vaga dela seria tomada 45 s depois —
     * com ela projetando.
     */
    @Test
    fun reconectarDesmarcaOFantasma() {
        val volta = (EspelhoPares.tentar(codigo, "10.0.0.1", relato(), t0) as EspelhoPares.Veredito.Aprovada).sessao
        repeat(EspelhoPares.MAX_SESSOES - 1) {
            assertTrue(EspelhoPares.tentar(codigo, "10.0.0.5$it", relato(), t0) is EspelhoPares.Veredito.Aprovada)
        }
        assertTrue(EspelhoPares.marcarSemConexao(volta.token, t0))
        assertTrue(EspelhoPares.marcarComConexao(volta.token))
        assertSame(
            EspelhoPares.Veredito.Lotada,
            EspelhoPares.tentar(codigo, "10.0.0.99", relato(), t0 + EspelhoPares.PRAZO_SEM_CONEXAO_MS + 1),
        )
        assertNotNull(EspelhoPares.validar(volta.token, t0 + EspelhoPares.PRAZO_SEM_CONEXAO_MS + 1))
    }

    /** Marcar um token que não é de sessão viva é no-op, e não erro. */
    @Test
    fun marcarUmTokenDesconhecidoNaoQuebra() {
        assertFalse(EspelhoPares.marcarSemConexao("nao-existe", t0))
        assertFalse(EspelhoPares.marcarComConexao("nao-existe"))
    }

    /** E a vaga tomada é a de quem está PARADO, nunca a da tela que está no ar. */
    @Test
    fun aVagaTomadaEADeQuemNaoEstaUsando() {
        val viva = (EspelhoPares.tentar(codigo, "10.0.0.1", relato(), t0) as EspelhoPares.Veredito.Aprovada).sessao
        val morta = (EspelhoPares.tentar(codigo, "10.0.0.2", relato(), t0) as EspelhoPares.Veredito.Aprovada).sessao
        val outra = (EspelhoPares.tentar(codigo, "10.0.0.3", relato(), t0) as EspelhoPares.Veredito.Aprovada).sessao
        val depois = t0 + EspelhoPares.PRAZO_OCIOSA_MS + 1
        // A primeira e a terceira continuam falando; a segunda emudeceu.
        assertNotNull(EspelhoPares.validar(viva.token, depois - 1))
        assertNotNull(EspelhoPares.validar(outra.token, depois - 1))
        assertTrue(
            EspelhoPares.tentar(codigo, "10.0.0.4", relato(), depois) is EspelhoPares.Veredito.Aprovada,
        )
        assertNotNull("a tela no ar não pode perder a vaga", EspelhoPares.validar(viva.token, depois))
        assertNotNull(EspelhoPares.validar(outra.token, depois))
        assertNull("a vaga tomada é a de quem parou", EspelhoPares.validar(morta.token, depois))
    }

    /**
     * O carimbo de uso **não** é uma janela deslizante disfarçada: ele só faz
     * uma sessão morrer mais cedo, e nunca estende o prazo absoluto.
     */
    @Test
    fun oCarimboDeUsoNaoEstendeOPrazoAbsoluto() {
        val s = parear()
        // Usada de minuto em minuto até quase o fim do prazo...
        var t = t0
        while (t < t0 + EspelhoPares.PRAZO_SESSAO_MS - 60_000) {
            t += 60_000
            assertNotNull(EspelhoPares.validar(s.token, t))
        }
        // ...e ainda assim ela morre na hora marcada.
        assertNull(EspelhoPares.validar(s.token, t0 + EspelhoPares.PRAZO_SESSAO_MS))
    }

    // ------------------------------------------------ o operador DERRUBA

    /**
     * "Desconectar" precisa DURAR alguma coisa.
     *
     * Encerrar a sessão sozinha não basta: a tela derrubada perde o token, volta
     * à entrada e — com o código ainda em cartaz na folha em que o operador
     * acabou de tocar — entra de novo em dois segundos. O botão reportaria
     * sucesso e não faria nada visível. O castigo por origem é o que dá sentido
     * ao ato, e ele é CURTO de propósito: derrubar a tela errada é um toque, e
     * ficar sem poder readmiti-la seria o preço errado.
     */
    @Test
    fun derrubarTiraATelaDoArEASeguraPorUmTempo() {
        val s = parear()
        EspelhoPares.derrubar(s.token, origem, t0)
        assertNull(EspelhoPares.validar(s.token, t0))
        assertTrue(
            "derrubada, ela não pode voltar no segundo seguinte",
            EspelhoPares.tentar(codigo, origem, relato(), t0 + 1) is EspelhoPares.Veredito.Bloqueada,
        )
        // E o castigo é de quem foi derrubado, não da rede inteira.
        assertTrue(
            EspelhoPares.tentar(codigo, "192.168.0.90", relato(), t0 + 1)
                is EspelhoPares.Veredito.Aprovada,
        )
        // Vencido o prazo, ela volta a ser bem-vinda.
        val depois = t0 + EspelhoPares.BLOQUEIO_DERRUBADA_MS + 1
        assertTrue(
            EspelhoPares.tentar(codigo, origem, relato(), depois) is EspelhoPares.Veredito.Aprovada,
        )
    }

    // -------------------------------------------------- bloqueio por origem

    /**
     * Invariante 6: cinco erros da MESMA origem e o sexto não é nem lido — nem
     * quando ele traz o código certo. Um atacante que acertasse na sexta
     * continua de fora.
     */
    @Test
    fun cincoCodigosErradosBloqueiamOSexto() {
        repeat(ERRADAS) {
            assertSame(
                EspelhoPares.Veredito.Recusada,
                EspelhoPares.tentar(codigoErrado(), origem, relato(), t0),
            )
        }
        val sexto = EspelhoPares.tentar(codigo, origem, relato(), t0)
        assertTrue("o 6º com o código CERTO ainda tem de ser bloqueado", sexto is EspelhoPares.Veredito.Bloqueada)
        assertEquals(EspelhoPares.BLOQUEIO_MS, (sexto as EspelhoPares.Veredito.Bloqueada).restaMs)
    }

    /** O bloqueio é da ORIGEM: o vizinho continua conseguindo entrar. */
    @Test
    fun bloqueioNaoAtingeOutraOrigem() {
        repeat(ERRADAS) { EspelhoPares.tentar(codigoErrado(), origem, relato(), t0) }
        assertTrue(
            EspelhoPares.tentar(codigo, "192.168.0.90", relato(), t0) is EspelhoPares.Veredito.Aprovada,
        )
    }

    @Test
    fun bloqueioVenceEACotaVolta() {
        repeat(ERRADAS) { EspelhoPares.tentar(codigoErrado(), origem, relato(), t0) }
        val depois = t0 + EspelhoPares.BLOQUEIO_MS + 1
        assertTrue(EspelhoPares.tentar(codigo, origem, relato(), depois) is EspelhoPares.Veredito.Aprovada)
    }

    /**
     * O BLOQUEIO CRESCE, e é ELE que sustenta um código de três dígitos.
     *
     * Com um minuto fixo, mil combinações saem numa tarde de martelada paciente
     * (cinco por minuto). Dobrando a cada rodada, a sétima já custa mais que o
     * culto inteiro — e é por isso que o `bloqueios` NÃO zera quando o bloqueio
     * VENCE: quem esperou e voltou a errar é exatamente quem a rodada seguinte
     * precisa segurar por mais tempo.
     */
    @Test
    fun bloqueiosSeguidosDobramAEspera() {
        var agora = t0
        val esperado = longArrayOf(
            EspelhoPares.BLOQUEIO_MS,
            EspelhoPares.BLOQUEIO_MS * 2,
            EspelhoPares.BLOQUEIO_MS * 4,
        )
        esperado.forEachIndexed { i, quanto ->
            repeat(ERRADAS) { EspelhoPares.tentar(codigoErrado(), origem, relato(), agora) }
            val v = EspelhoPares.tentar(codigoErrado(), origem, relato(), agora)
            assertTrue("rodada $i devia bloquear", v is EspelhoPares.Veredito.Bloqueada)
            assertEquals(
                "rodada $i",
                quanto,
                (v as EspelhoPares.Veredito.Bloqueada).restaMs,
            )
            agora += quanto + 1
        }
    }

    /**
     * E O CRESCIMENTO TEM TETO. Sem ele, uma TV atrás de um NAT compartilhado
     * com quem estiver errando ao lado ficaria de fora pelo resto do dia — e
     * ninguém teria como desfazer.
     *
     * O caso também trava a armadilha do `shl`: em Kotlin/JVM ele usa só os 6
     * bits baixos do deslocamento (`1L shl 64` é `1L`), então sem o
     * `coerceAtMost` a 65ª rodada devolveria UM MINUTO — o oposto exato do que
     * o crescimento existe para fazer, e sem nada que o denunciasse.
     */
    @Test
    fun oCrescimentoTemTeto() {
        assertEquals(EspelhoPares.BLOQUEIO_MS, EspelhoPares.esperaDoBloqueio(1))
        assertEquals(EspelhoPares.BLOQUEIO_MS * 2, EspelhoPares.esperaDoBloqueio(2))
        assertEquals(EspelhoPares.BLOQUEIO_MAX_MS, EspelhoPares.esperaDoBloqueio(30))
        assertEquals(EspelhoPares.BLOQUEIO_MAX_MS, EspelhoPares.esperaDoBloqueio(64))
        assertEquals(EspelhoPares.BLOQUEIO_MAX_MS, EspelhoPares.esperaDoBloqueio(65))
        assertEquals(EspelhoPares.BLOQUEIO_MAX_MS, EspelhoPares.esperaDoBloqueio(1000))
        // E nunca menos que o piso, seja qual for a entrada.
        assertEquals(EspelhoPares.BLOQUEIO_MS, EspelhoPares.esperaDoBloqueio(0))
        assertEquals(EspelhoPares.BLOQUEIO_MS, EspelhoPares.esperaDoBloqueio(-3))
    }

    /**
     * ACERTAR LIMPA TUDO, inclusive o expoente. Quem acertou não é quem estava
     * martelando — e carregar o contador adiante puniria a TV que errou o número
     * duas vezes antes de acertar.
     */
    @Test
    fun acertarZeraOExpoente() {
        repeat(ERRADAS) { EspelhoPares.tentar(codigoErrado(), origem, relato(), t0) }
        val depois = t0 + EspelhoPares.BLOQUEIO_MS + 1
        assertTrue(EspelhoPares.tentar(codigo, origem, relato(), depois) is EspelhoPares.Veredito.Aprovada)
        // A rodada seguinte de erros volta ao PRIMEIRO degrau.
        repeat(ERRADAS) { EspelhoPares.tentar(codigoErrado(), origem, relato(), depois) }
        val v = EspelhoPares.tentar(codigoErrado(), origem, relato(), depois)
        assertEquals(
            EspelhoPares.BLOQUEIO_MS,
            (v as EspelhoPares.Veredito.Bloqueada).restaMs,
        )
    }

    @Test
    fun contadorDeRecusasAlimentaORegistro() {
        repeat(3) { EspelhoPares.tentar(codigoErrado(), origem, relato(), t0) }
        assertEquals(3, EspelhoPares.recusas())
        assertEquals(0, EspelhoPares.origensEmBloqueio(t0))
        repeat(2) { EspelhoPares.tentar(codigoErrado(), origem, relato(), t0) }
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
        val primeira = parear("192.168.0.1")
        parear("192.168.0.2")
        parear("192.168.0.3")
        assertSame(
            "a quarta tela não entra sem o operador derrubar uma",
            EspelhoPares.Veredito.Lotada,
            EspelhoPares.tentar(codigo, "192.168.0.4", relato(), t0),
        )
        EspelhoPares.encerrar(primeira.token)
        assertTrue(
            EspelhoPares.tentar(codigo, "192.168.0.4", relato(), t0) is EspelhoPares.Veredito.Aprovada,
        )
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
        assertEquals("", EspelhoPares.codigo())
        assertFalse(EspelhoPares.estaLigado())
        assertSame(
            EspelhoPares.Veredito.Desligado,
            EspelhoPares.tentar("000", origem, relato(), t0),
        )
    }

    /**
     * Com o espelho desligado o código guardado é vazio — e um código vazio
     * vindo da rede não pode casar com ele. É a guarda de string vazia da
     * comparação em tempo constante.
     */
    @Test
    fun codigoVazioNaoCasaComEspelhoDesligado() {
        // Ligado, o código vazio é só um código errado.
        assertSame(EspelhoPares.Veredito.Recusada, EspelhoPares.tentar("", origem, relato(), t0))
        // Desligado, o código guardado É vazio — e é aí que a guarda de string
        // vazia da comparação em tempo constante impede o casamento de dois nadas.
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
            codigo,
            origem,
            relato("Firefox\r\ntelas: 99 conectadas \"x\"").copy(w = -5, h = 999_999, telaAcesaMin = -1),
            t0,
        )
        val s = (v as EspelhoPares.Veredito.Aprovada).sessao
        assertFalse(s.relato.ua.contains('\n'))
        assertFalse(s.relato.ua.contains('\r'))
        assertFalse(s.relato.ua.contains('"'))
        assertTrue(s.relato.ua.length <= EspelhoPares.TETO_TEXTO)
        assertEquals(0, s.relato.w)
        assertEquals(20_000, s.relato.h)
        assertEquals(0, s.relato.telaAcesaMin)
    }

    /**
     * O `token` é PORTADOR: quem o tem entra. Ele não pode sair numa
     * interpolação distraída — e o Registro é copiado e repassado.
     */
    @Test
    fun oSegredoNaoApareceNoToString() {
        val s = parear()
        assertFalse(s.toString().contains(s.token))
        // E o CÓDIGO também não: ele é curto, e é justamente por ser curto que
        // uma linha de log com ele vale por uma chave inteira.
        assertFalse(s.toString().contains(codigo))
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
