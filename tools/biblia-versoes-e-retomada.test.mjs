// ============================================================================
// A BÍBLIA: A VERSÃO BAIXADA, O EXCLUIR, E A JANELA QUE VOLTA ONDE PAROU (v1.8.83)
//
// Três pedidos do operador, na mesma mensagem, todos sobre a folha da Bíblia:
//
//   *"faça a janela da bíblia lembrar de onde estava na próxima abertura durante
//   uma mesma seção. Ao invés de voltar sempre para o seletor do livro"*
//
//   *"Para as versões da bíblia, ao invés de baixar ao usar, ajuste o método
//   para baixar a bíblia inteira ao escolher aquela versão. É claro, faça uma
//   opção para excluir uma determinada versão que já esteja baixada"*
//
//   *"Aproveite para verificar o design do 'check' usado nessa área de versões
//   da bíblia, ele parece em um design fora do padrão estabelecido no app de um
//   check reto e pouco estilizado"*
//
// ## O que cada bloco trava, e por que a medida é a que é
//
// **A · A JANELA VOLTA ONDE PAROU.** A regra revogada é da v1.5.0 (`bibleScreen
// = 'books'` em toda abertura), e o modo de falhar do conserto é o oposto dela:
// restaurar uma tela cujo ESTADO já não existe. `reading` sem `bibleSession`
// desenha a folha de leitura de sessão nenhuma, e `chapters` sem livro escolhido
// abre a grade de capítulos de um `bookIdx: -1`. As três asserções são a
// lembrança e as DUAS quedas — sem elas, "lembra sempre" passa e quebra num
// culto.
//
// **B · ESCOLHER É BAIXAR.** Metade disto o app já fazia desde a v5.242
// (`changeBibleVersion` chama `ensureBibleVersionDownloaded`) — o que o operador
// leu foi a linha de estado dizendo **"Baixa ao usar"**, que contradizia o
// próprio app. A asserção é sobre a FRASE, porque era ela o defeito, mais o
// caminho que de fato não existia: tocar na versão JÁ ESCOLHIDA (a que uma
// varredura interrompida deixa pela metade) não disparava nada.
//
// **C · O EXCLUIR.** Ele apaga as chaves `bible:<v>_*` E a bandeira
// `bibleComplete:<v>` — as duas, porque são o mesmo fato em dois lugares e uma
// sozinha deixa a lista mentindo nos dois sentidos. E ele é APAGADO, nunca
// ausente, na versão EM USO: a régua da v1.8.50.
//
// **D · O CHECK.** A régua não pode ser "existe um ✓": o caractere `✓` existia e
// era desenhado pela FONTE DO SISTEMA. O que separa um do outro é o NÓ — um
// `<svg>` com a `polyline` do `checkIconSvg`, que é o traço reto do resto do app.
//
// REVERSÃO MEDIDA, e ela reprova 9 das 22. Desfeitos os cinco pontos do lote —
// o `bibleScreen = 'books'` no `abrirBiblia`, a frase "Baixa ao usar", a
// varredura no toque, o `apagarVersaoBiblia` no botão e o `chk.textContent =
// '✓'` —, reprovam A(1), B(3), C(2) e D(3).
//
// E MAIS DUAS, uma por peça da v1.8.84, medidas à parte:
//  · o excluir de volta a EXISTIR apagado onde não há nada baixado → 2, as duas
//    de ausência (a versão nunca baixada e a linha logo depois do apagar). As
//    outras quatro de C passam: elas medem o botão que continua existindo, e é
//    essa assimetria que separa "some" de "não responde".
//  · o ✓ da escolha de volta na linha → 1, a de D — e as duas vizinhas passam,
//    porque o fill e o ✓ do "Completa offline" são outros dois fatos.
//
// AS DUAS ASSIMETRIAS estão aqui porque são elas que provam que as asserções
// medem coisas diferentes, e não o percurso:
//  · as duas QUEDAS de A passam sob a reversão (uma tela que nunca é lembrada
//    também nunca é lembrada errado) — só a primeira reprova;
//  · `C · ele apaga as chaves` passa sob a reversão, porque ela chama a função
//    DIRETO. É por isso que existe a asserção da FIAÇÃO logo antes dela: sem a
//    segunda, um ouvinte vazio passaria no bloco inteiro.
//
//   node tools/biblia-versoes-e-retomada.test.mjs
// ============================================================================
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperarCortina, esperarDb, checar, falhas, porque, RAIZ_WEB } from './arnes.mjs';

const servidor = servirEstatico(RAIZ_WEB);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador();
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);

const erros = [];
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY/;

try {
  const pg = await ctx.newPage();
  pg.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (EXTERNO.test(t) || /Failed to load resource/.test(t)) return;
    erros.push(t);
  });
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));

  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => window.AVDB && window.Bible && typeof window.__avBack === 'function',
    null, { timeout: 30000 });
  await esperarCortina(pg);

  // ---- O ACERVO DE MENTIRA: duas versões, uma delas com capítulos no banco ---
  // As chaves são as REAIS (`bible:<v>_<livro>_<cap>`), porque é sobre elas que
  // o `stateApagarPrefixo` e a recontagem trabalham — plantar um formato
  // próprio provaria o oráculo contra ele mesmo.
  await pg.evaluate(async () => {
    setAppMode('full');
    // TRÊS versões, e a terceira é a que faz a asserção da frase valer: com só
    // duas (uma completa e uma parcial) o ramo do "nunca baixada" nunca é
    // desenhado, e uma asserção sobre uma frase que não aparece passa sozinha.
    // MEDIDO por reversão: com duas, devolver "Baixa ao usar" ao código não
    // reprovava nada.
    bibleVersions = [
      { id: 'ara', name: 'Almeida Revista e Atualizada (ARA)' },
      { id: 'nvi', name: 'Nova Versão Internacional (NVI)' },
      { id: 'acf', name: 'Almeida Corrigida Fiel (ACF)' },
    ];
    bibleVersionId = 'ara';
    const vs = [{ n: 1, text: 'No princípio criou Deus os céus e a terra.' }];
    // Três capítulos da NVI no aparelho — a versão que se pode excluir.
    for (const c of [1, 2, 3]) {
      await AVDB.setState('bible:nvi_' + bibleBookId(0) + '_' + c, { verses: vs, syncedAt: Date.now() });
    }
    await AVDB.setState('bibleComplete:nvi', true);
    bibleCompleteVersions.add('nvi');
    // E um capítulo de Gênesis da ARA, que é a que fica em uso.
    await AVDB.setState('bible:ara_' + bibleBookId(0) + '_1', { verses: vs, syncedAt: Date.now() });
  });

  // =======================================================================
  // A · A JANELA DA BÍBLIA VOLTA ONDE PAROU
  // =======================================================================
  const telaAgora = () => pg.evaluate(() => bibleScreen);

  await pg.evaluate(() => {
    abrirBiblia();
    bibleSel = { bookIdx: 0, chapter: 1 };
    gotoBibleScreen('chapters');
    fecharBiblia();
  });
  await pg.waitForTimeout(400);
  await pg.evaluate(() => abrirBiblia());
  await pg.waitForTimeout(120);
  checar(await telaAgora() === 'chapters',
    'A · fechada na grade de CAPÍTULOS, a Bíblia reabre nela — não mais no '
    + 'seletor de livro (a v1.5.0 zerava a tela em toda abertura, e cada '
    + 'retomada custava livro → capítulo → versículo com o pregador falando)',
    await telaAgora());

  // ---- A PRIMEIRA QUEDA: `reading` sem sessão ----
  await pg.evaluate(() => {
    bibleChapterData = { verses: [{ n: 1, text: 'No princípio criou Deus os céus e a terra.' }] };
    startBibleReading(0);
    fecharBiblia();
    // O que um `load` de mídia comum faz no meio do culto.
    clearBibleSession();
  });
  await pg.waitForTimeout(400);
  await pg.evaluate(() => abrirBiblia());
  await pg.waitForTimeout(120);
  const semSessao = await telaAgora();
  checar(semSessao !== 'reading',
    'A · mas a tela lembrada é CONFERIDA: sem `bibleSession` ela não volta para '
    + 'a leitura — restaurá-la desenharia a folha de sessão nenhuma', semSessao);

  // ---- A SEGUNDA QUEDA: `chapters` sem livro escolhido ----
  await pg.evaluate(() => {
    fecharBiblia();
    bibleScreen = 'chapters';
    bibleSel = { bookIdx: -1, chapter: 0 };   // o valor com que ele NASCE
  });
  await pg.waitForTimeout(400);
  await pg.evaluate(() => abrirBiblia());
  await pg.waitForTimeout(120);
  checar(await telaAgora() === 'books',
    'A · e sem livro escolhido ela cai para os LIVROS — a grade de capítulos de '
    + 'um `bookIdx: -1` é a tela que a lembrança às cegas produziria',
    await telaAgora());

  // =======================================================================
  // B, C, D · A FOLHA DE VERSÕES
  // =======================================================================
  await pg.evaluate(() => { openBibleVerPopup(); });
  // A recontagem é assíncrona (uma varredura de chaves), e é ela que decide o
  // estado do EXCLUIR — medir antes dela é medir a primeira pintura.
  // A ESPERA É PELO EXCLUIR DA NVI, e ela precisa ser NULA-SEGURA: desde a
  // v1.8.84 o botão não existe onde não há o que excluir, e a PRIMEIRA pintura
  // da folha é justamente essa — o `recontarBibliaNoAparelho` é assíncrono e o
  // popup abre antes dele responder. Um `.disabled` direto lança ali, e o
  // percurso morre com um `TypeError` que não descreve nada.
  const contou = await esperarDb(pg, async () => {
    const l = document.querySelectorAll('#bibleVerList .bible-ver-row');
    const del = l.length === 3 && l[1].querySelector('.bible-ver-del');
    return !!del && !del.disabled;
  });
  checar(contou === true,
    'a folha de versões desenhou as três linhas, com a contagem do banco já na mão',
    porque(contou));

  const folha = await pg.evaluate(() => {
    const rows = [...document.querySelectorAll('#bibleVerList .bible-ver-row')];
    return rows.map((r) => {
      const st = r.querySelector('.bible-ver-status');
      const del = r.querySelector('.bible-ver-del');
      const cs = getComputedStyle(r);
      return {
        nome: r.querySelector('.row-name').textContent,
        estado: (st.textContent || '').trim(),
        // A MARCA DA ESCOLHA é o FILL da linha, e a régua é o computado: a
        // regra pinta `--linha`, e ler a variável provaria a declaração, não o
        // desenho.
        selecionada: r.classList.contains('selected'),
        fundo: cs.backgroundColor,
        // O CHECK QUE SAIU (v1.8.84) — asserção NEGATIVA, e ela mede o NÓ mais
        // o caractere: as duas formas que ele já teve.
        temCheck: !!r.querySelector('.bible-ver-check'),
        temCharCheck: /✓/.test(r.textContent || ''),
        // E o ✓ do estado "Completa offline" FICA, porque responde outra
        // pergunta — é o mesmo desenho do resto do app.
        estadoSvg: !!st.querySelector('svg polyline'),
        delExiste: !!del,
        delTravado: !!(del && del.disabled),
        delTitulo: del ? del.title : '',
      };
    });
  });
  const ara = folha[0], nvi = folha[1], acf = folha[2];

  // ---- B · o estado diz o que o app FAZ ----
  checar(!folha.some((r) => /baixa ao usar/i.test(r.estado)),
    'B · nenhuma linha promete "Baixa ao usar" — a frase contradizia o app desde '
    + 'a v5.242 (escolher uma versão JÁ dispara a varredura inteira), e foi ela '
    + 'que o operador leu para pedir o comportamento que o app tinha',
    folha.map((r) => r.estado));
  checar(/completa offline/i.test(nvi.estado),
    'B · a versão inteira no aparelho se anuncia COMPLETA', nvi.estado);
  checar(/parcial/i.test(ara.estado) && /\b1\b/.test(ara.estado),
    'B · e a que está pela METADE diz quantos capítulos tem — esse estado '
    + 'existia (a varredura desiste depois de 25 falhas seguidas, que é a rede '
    + 'da igreja fora) e se lia igual a uma versão nunca tocada', ara.estado);
  checar(/não baixada/i.test(acf.estado),
    'B · e a que não tem NADA no aparelho diz isso — é ela que desenha o ramo em '
    + 'que morava a frase falsa', acf.estado);
  checar(!acf.delExiste,
    'C · e o excluir dela NÃO EXISTE (v1.8.84, revogando o apagado da v1.8.83): '
    + 'a regra do inerte vale para quem tem função a recuperar — a versão em uso '
    + 'a recupera com um toque noutra linha —, e excluir o que nunca foi baixado '
    + 'não é uma ação adiada, é uma ação que não existe', acf);

  // ESCOLHER É BAIXAR, inclusive a versão JÁ escolhida: é o único caminho que
  // de fato não existia, e é justamente o que se faz diante de uma parcial.
  const disparou = await pg.evaluate(() => {
    const chamadas = [];
    const antes = window.ensureBibleVersionDownloaded;
    window.ensureBibleVersionDownloaded = (id) => { chamadas.push(id); return Promise.resolve(); };
    document.querySelectorAll('#bibleVerList .bible-ver-row')[0].click();
    window.ensureBibleVersionDownloaded = antes;
    return chamadas;
  });
  checar(disparou.includes('ara'),
    'B · e tocar na versão JÁ ESCOLHIDA dispara a varredura mesmo assim — '
    + '`changeBibleVersion` devolve cedo quando o id não muda, e era esse o '
    + 'único toque desta folha que não fazia nada', disparou);

  // ---- D · a marca da escolha, e o ✓ que sobrou ----
  //
  // A v1.8.83 trocou o caractere `✓` pelo desenho do app e a v1.8.84 tirou o
  // sinal inteiro: *"já temos a coloração azul da linha como marcação, não
  // precisamos do check disputando espaço com a lixeira"*. As duas asserções
  // abaixo são o par que impede as duas regressões opostas — o ✓ voltar, e a
  // marca sumir junto com ele.
  checar(!folha.some((r) => r.temCheck || r.temCharCheck),
    'D · nenhuma linha tem o ✓ da ESCOLHA, em nó nem em caractere — a marca é o '
    + 'fill da linha, e um segundo sinal da mesma coisa custava a largura do '
    + 'nome da versão', folha.map((r) => r.nome + ':' + r.temCheck + '/' + r.temCharCheck));
  checar(ara.selecionada && !nvi.selecionada && ara.fundo !== nvi.fundo,
    'D · …e a linha escolhida CONTINUA marcada: o `--sel-fill` pinta um fundo '
    + 'diferente do das outras (medido no computado — ler o token provaria a '
    + 'declaração, não o desenho)', { ara, nvi });
  checar(nvi.estadoSvg,
    'D · e o ✓ do "Completa offline" FICA, com o desenho do app: ele responde '
    + '"está no aparelho?", que é outra pergunta que a do fill', nvi);

  // ---- C · o excluir ----
  checar(ara.delExiste && ara.delTravado && /em uso/i.test(ara.delTitulo),
    'C · o EXCLUIR da versão em uso é APAGADO, não ausente — e o `title` diz por '
    + 'quê (a regra da v1.8.50: um botão que aparece e some move os vizinhos '
    + 'debaixo do dedo)', ara);
  checar(nvi.delExiste && !nvi.delTravado,
    'C · e o da versão baixada que NÃO está em uso responde ao toque', nvi);

  // O BOTÃO ESTÁ LIGADO NA FUNÇÃO. Medir só a função deixa a fiação de fora —
  // um ouvinte vazio passa em tudo o que vem abaixo, porque o que vem abaixo
  // chama `apagarVersaoBiblia` direto.
  const ligado = await pg.evaluate(() => {
    const chamadas = [];
    const antes = window.apagarVersaoBiblia;
    window.apagarVersaoBiblia = (v) => { chamadas.push(v && v.id); return Promise.resolve(); };
    document.querySelectorAll('#bibleVerList .bible-ver-row')[1]
      .querySelector('.bible-ver-del').click();
    window.apagarVersaoBiblia = antes;
    return chamadas;
  });
  checar(ligado.includes('nvi'),
    'C · e o BOTÃO chama o apagar da versão da própria linha', ligado);

  // O APAGAR DE VERDADE, contra o banco — e as DUAS coisas que saem.
  const apagou = await pg.evaluate(async () => {
    // O diálogo de confirmação é uma PESSOA; aqui ele é respondido na hora.
    const antes = window.appConfirm;
    window.appConfirm = () => Promise.resolve(true);
    await apagarVersaoBiblia({ id: 'nvi', name: 'Nova Versão Internacional (NVI)' });
    window.appConfirm = antes;
    return {
      chaves: (await AVDB.stateKeys('bible:nvi_')).length,
      bandeira: !!(await AVDB.getState('bibleComplete:nvi')),
      noSet: bibleCompleteVersions.has('nvi'),
      // E a OUTRA versão não foi levada junto — o prefixo é `bible:nvi_`, e sem
      // o `_` ele pegaria qualquer versão cujo id comece por "nvi".
      outra: (await AVDB.stateKeys('bible:ara_')).length,
    };
  });
  checar(apagou.chaves === 0,
    'C · e ele apaga as chaves do TEXTO daquela versão', apagou);
  checar(apagou.bandeira === false && apagou.noSet === false,
    'C · …E a bandeira de completude junto, no banco E no cache em memória: são o '
    + 'mesmo fato em dois lugares, e uma sozinha deixa a lista mentindo — a '
    + 'bandeira de pé diria "completa" sobre um banco vazio', apagou);
  checar(apagou.outra === 1,
    'C · e a outra versão fica intacta — o prefixo carrega o `_`, senão ele '
    + 'alcançaria toda versão cujo id comece pelo mesmo texto', apagou);

  const depois = await pg.evaluate(() => {
    const r = document.querySelectorAll('#bibleVerList .bible-ver-row')[1];
    return {
      estado: r.querySelector('.bible-ver-status').textContent.trim(),
      temDel: !!r.querySelector('.bible-ver-del'),
    };
  });
  checar(/não baixada/i.test(depois.estado) && depois.temDel === false,
    'C · e a linha se redesenha: a versão passa a "Não baixada" e o excluir SOME '
    + '— não há o que excluir duas vezes, e desde a v1.8.84 isso é ausência e '
    + 'não um botão apagado', depois);

  checar(erros.length === 0, 'nenhum erro de console', erros);
} catch (e) {
  checar(false, 'o percurso terminou sem exceção (' + (e && e.message) + ')');
} finally {
  await navegador.close();
  servidor.close();
}

console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
