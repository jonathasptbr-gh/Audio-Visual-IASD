package br.org.iasd.av

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * A MÁQUINA DE ESTADOS DO PAREAMENTO DO CLONE.
 *
 * Ela decide quem pode copiar o acervo INTEIRO deste aparelho — todo arquivo
 * importado, o Cronograma, as preferências —, e por isso não podia nascer sem
 * oráculo: é o mesmo argumento que criou o `EspelhoParesTest`, e ele foi
 * escrito num repositório que recusa o RFC 6455 **por falta de oráculo**.
 *
 * O `AcervoCessao` foi mantido SEM Android no caminho que este arquivo percorre
 * (o relógio é injetado, o token é base64 escrito à mão, o parse do índice mora
 * na ponte) — a mesma disciplina do `EspelhoPares` e do `EspelhoHttp`.
 *
 * Os quatro desfechos que ele guarda erram calados de jeitos diferentes:
 *
 *  · **cessão desligada respondendo** — a rota deixaria de ser invisível para
 *    quem varre a rede;
 *  · **um segundo pedinte entrando** — dois celulares copiando ao mesmo tempo,
 *    com o operador tendo autorizado UM;
 *  · **a recusa esquecida** — quem foi recusado insiste e a pergunta reaparece,
 *    até alguém tocar em Permitir por cansaço;
 *  · **o token valendo antes da autorização** — o pior de todos: um
 *    `Authorization` ausente lido como credencial.
 */
class AcervoCessaoTest {

    @Before
    fun limpar() {
        AcervoCessao.desligar()
    }

    // ---------------------------------------------------------------- a porta

    @Test
    fun `cessao desligada nao responde nada`() {
        val v = AcervoCessao.parear("192.168.0.5", "Celular B", 1_000)
        assertEquals("uma cessão desligada responde 404 — a rota tem de ser invisível", 404, v.status)
    }

    @Test
    fun `token vazio nunca autoriza`() {
        AcervoCessao.ligar("Celular A")
        // O CASO QUE MAIS DÓI: sem esta guarda, um `Authorization` ausente e um
        // token vazio se encontram e viram acesso total ao acervo.
        assertFalse("sem par aprovado, nada autoriza", AcervoCessao.autorizado(null))
        assertFalse(AcervoCessao.autorizado(""))
        assertFalse(AcervoCessao.autorizado("qualquer-coisa"))
    }

    // ------------------------------------------------------------ o pareamento

    @Test
    fun `o primeiro pedido fica aguardando e o segundo do mesmo aparelho tambem`() {
        AcervoCessao.ligar("Celular A")
        val a = AcervoCessao.parear("192.168.0.5", "Celular B", 1_000)
        assertEquals(202, a.status)
        assertEquals("aguardando", a.estado)
        // O DESTINO INSISTE enquanto espera o dedo do outro lado, e a insistência
        // não pode virar uma segunda pergunta na tela de quem cede.
        val b = AcervoCessao.parear("192.168.0.5", "Celular B", 2_000)
        assertEquals(202, b.status)
        assertEquals("aguardando", b.estado)
    }

    @Test
    fun `permitir entrega o token so para quem pediu`() {
        AcervoCessao.ligar("Celular A")
        AcervoCessao.parear("192.168.0.5", "Celular B", 1_000)
        AcervoCessao.responder(true)
        val v = AcervoCessao.parear("192.168.0.5", "Celular B", 2_000)
        assertEquals(200, v.status)
        assertEquals("pareado", v.estado)
        assertTrue("o token sai não-vazio", v.token.isNotEmpty())
        assertTrue("e ele autoriza", AcervoCessao.autorizado(v.token))
        // O `Bearer ` é retirado pelo `EspelhoServidor.bearerDe`, e não aqui: são
        // duas credenciais diferentes no mesmo servidor (a das telas e a do
        // acervo), e uma leitura de cabeçalho compartilhada faria o token de uma
        // tela da rede valer no acervo.
        assertFalse("o cabeçalho CRU não passa — quem o abre é a rota",
            AcervoCessao.autorizado("Bearer " + v.token))
        // OUTRO ENDEREÇO NÃO HERDA A AUTORIZAÇÃO. O operador autorizou UM
        // aparelho, e é o endereço que o identifica.
        val outro = AcervoCessao.parear("192.168.0.9", "Celular C", 3_000)
        assertEquals(409, outro.status)
        assertEquals("ocupado", outro.estado)
        assertTrue("e a recusa DIZ com quem — sem isso o operador não tem como "
            + "saber o que derrubar", outro.com.isNotEmpty())
    }

    @Test
    fun `recusar guarda a origem e a insistencia nao reabre a pergunta`() {
        AcervoCessao.ligar("Celular A")
        AcervoCessao.parear("192.168.0.5", "Celular B", 1_000)
        AcervoCessao.responder(false)
        val v = AcervoCessao.parear("192.168.0.5", "Celular B", 2_000)
        assertEquals(403, v.status)
        assertEquals("recusado", v.estado)
        // E A RECUSA É DAQUELE APARELHO, não da cessão: outro celular da mesma
        // igreja continua podendo pedir.
        val c = AcervoCessao.parear("192.168.0.9", "Celular C", 3_000)
        assertEquals(202, c.status)
    }

    @Test
    fun `um segundo pedinte espera a vez do primeiro`() {
        AcervoCessao.ligar("Celular A")
        AcervoCessao.parear("192.168.0.5", "Celular B", 1_000)
        val c = AcervoCessao.parear("192.168.0.9", "Celular C", 1_500)
        assertEquals("com uma pergunta na tela, a segunda não entra", 409, c.status)
        assertEquals("ocupado", c.estado)
        assertEquals("e a resposta diz de quem é a pergunta que está aberta",
            "Celular B", c.com)
    }

    @Test
    fun `um pedido vencido libera a vez, e vencer nao e recusar`() {
        AcervoCessao.ligar("Celular A")
        AcervoCessao.parear("192.168.0.5", "Celular B", 1_000)
        // 90 s depois: o operador não viu a tela. Vencido, o pedido seguinte
        // reabre a pergunta — inclusive para OUTRO aparelho.
        val c = AcervoCessao.parear("192.168.0.9", "Celular C", 1_000 + 90_001)
        assertEquals(202, c.status)
        AcervoCessao.responder(true)
        val v = AcervoCessao.parear("192.168.0.9", "Celular C", 200_000)
        assertEquals("quem estava na vez é quem recebe o token", 200, v.status)
        val b = AcervoCessao.parear("192.168.0.5", "Celular B", 200_000)
        assertEquals("e o pedinte vencido não herda nada", 409, b.status)
    }

    @Test
    fun `desligar mata o token`() {
        AcervoCessao.ligar("Celular A")
        AcervoCessao.parear("192.168.0.5", "Celular B", 1_000)
        AcervoCessao.responder(true)
        val t = AcervoCessao.parear("192.168.0.5", "Celular B", 2_000).token
        assertTrue(AcervoCessao.autorizado(t))
        AcervoCessao.desligar()
        assertFalse("nenhum pareamento sobrevive ao toque de desligar — nem a um "
            + "culto anterior", AcervoCessao.autorizado(t))
    }

    @Test
    fun `soltar o par mantem a cessao no ar`() {
        AcervoCessao.ligar("Celular A")
        AcervoCessao.parear("192.168.0.5", "Celular B", 1_000)
        AcervoCessao.responder(true)
        val t = AcervoCessao.parear("192.168.0.5", "Celular B", 2_000).token
        AcervoCessao.soltarPar()
        assertFalse("o token morre", AcervoCessao.autorizado(t))
        assertTrue("mas a cessão continua", AcervoCessao.cedendo)
        assertEquals("e outro aparelho pode entrar", 202,
            AcervoCessao.parear("192.168.0.9", "Celular C", 3_000).status)
    }

    @Test
    fun `dois tokens seguidos nunca sao iguais`() {
        AcervoCessao.ligar("Celular A")
        AcervoCessao.parear("1.1.1.1", "B", 1)
        AcervoCessao.responder(true)
        val t1 = AcervoCessao.parear("1.1.1.1", "B", 2).token
        AcervoCessao.desligar()
        AcervoCessao.ligar("Celular A")
        AcervoCessao.parear("1.1.1.1", "B", 3)
        AcervoCessao.responder(true)
        val t2 = AcervoCessao.parear("1.1.1.1", "B", 4).token
        assertNotEquals("um token previsível é um token que não protege nada", t1, t2)
        assertTrue("e ele cabe na forma que a rota aceita",
            Regex("^[A-Za-z0-9_-]{16,64}$").matches(t1))
    }

    // ----------------------------------------------------------------- o índice

    @Test
    fun `o item so responde pela sessao publicada`() {
        AcervoCessao.ligar("Celular A")
        assertTrue(AcervoCessao.publicar("sessaoabcd12", "{}", 3, 999))
        assertEquals("a posição vira o token do cache", "sessaoabcd12n0",
            AcervoCessao.tokenDoItem("sessaoabcd12", 0))
        // A SESSÃO É O QUE IMPEDE A CORRUPÇÃO SILENCIOSA: a página do Controle
        // pode recarregar no meio e montar OUTRA lista, e a posição 2 da nova
        // não é a mesma coisa que a posição 2 da velha.
        assertNull("outra sessão não responde", AcervoCessao.tokenDoItem("sessaowxyz99", 0))
        assertNull("nem uma posição fora da lista", AcervoCessao.tokenDoItem("sessaoabcd12", 3))
        assertNull(AcervoCessao.tokenDoItem("sessaoabcd12", -1))
    }

    @Test
    fun `uma sessao malformada nao e publicada`() {
        AcervoCessao.ligar("Celular A")
        assertFalse("ela entra numa ROTA — a forma é validada nos dois lados",
            AcervoCessao.publicar("curta", "{}", 1, 0))
        assertFalse(AcervoCessao.publicar("com/barra/dentro", "{}", 1, 0))
        assertFalse("e um índice que a ponte não conseguiu ler é recusado",
            AcervoCessao.publicar("sessaoabcd12", "isto não é json", -1, 0))
    }

    @Test
    fun `publicar sem ceder nao faz nada`() {
        assertFalse(AcervoCessao.publicar("sessaoabcd12", "{}", 1, 0))
        assertNull(AcervoCessao.tokenDoItem("sessaoabcd12", 0))
    }
}
