// O HISTÓRICO DO CULTO — o que já foi ao telão nesta sessão (v1.2.0).
//
// ## O que ele trava
//
// Pedido do operador: *"crie um botão de histórico, que lista todos os itens
// que já tocaram naquela sessão. deve ser uma lista tipo a do cronograma, mas
// sem opções de exclusão, mas com opções de enviar para o cronograma. essa
// lista deve ter a hora de cada apresentação de cada item"*.
//
// ## Por que ele precisa de oráculo
//
// É uma lista que se preenche SOZINHA, num ponto quente (`send`, por onde todo
// play passa), e cujos três modos de errar são silenciosos:
//
//  - **não registrar** — a folha abre vazia depois de um culto inteiro, e nada
//    na tela distingue isso de "ainda não toquei nada";
//  - **registrar demais** — `repeat: 'one'` reenvia o mesmo id a cada fim de
//    faixa, e um louvor deixado em laço durante a oração encheria a lista com
//    trinta cópias do mesmo nome, enterrando o que veio antes (que é
//    exatamente o que se foi consultar);
//  - **oferecer o que não existe mais** — a prateleira `avulsos` despeja
//    sozinha e o coletor recolhe os bytes de quem sai da última lista. Um
//    "Adicionar ao Cronograma" sobre um id órfão gravaria na lista uma linha
//    que não abre nada, e o erro só apareceria no sábado.
//
// E as SUBTRAÇÕES fazem parte do pedido tanto quanto a lista: sem excluir e sem
// reordenar. Um destrutivo aqui apagaria o registro sem apagar nada do
// aparelho — e um registro do que já aconteceu não se edita.
//
//   node tools/historico.test.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, checar, falhas } from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');

const servidor = servirEstatico(RAIZ);

// Três imagens de 1×1: elas projetam na hora e sem som, que é tudo o que estas
// asserções precisam da mídia. O SORTEIO de qual é qual é pelo NOME.
const SEMEAR = `
  const png = await (await fetch('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')).blob();
  const mk = (nome, lista) => AVDB.addMedia(png,
    { name: nome, type: 'image/png', kind: 'image', list: lista });
  const um = await mk('Abertura do culto', 'favs');
  const dois = await mk('Aviso da secretaria', 'favs');
  const solto = await mk('Slide avulso', 'avulsos');
`;

await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador({ args: ['--autoplay-policy=no-user-gesture-required'] });
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

  // ESPERAR PELO FATO, com um predicado que pode ser ASSÍNCRONO. `waitForFunction`
  // do Playwright NÃO espera a promise devolvida pelo predicado: um `async` ali
  // devolve um objeto Promise, que é TRUTHY, e a espera passa no primeiro quadro
  // — aprovando o que ela veio verificar. Medido escrevendo este arquivo. Quem
  // pergunta ao IndexedDB precisa deste laço, do lado do Node.
  const esperar = async (fn, ms = 20000) => {
    const fim = Date.now() + ms;
    while (Date.now() < fim) {
      if (await pg.evaluate(fn)) return true;
      await pg.waitForTimeout(100);
    }
    return false;
  };

  await pg.goto(base + '/controle/', { waitUntil: 'load' });
  await pg.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function', null, { timeout: 20000 });

  const ids = await pg.evaluate(new Function('return (async () => {'
    + 'setAppMode("full");' + SEMEAR
    + 'await load(); return { um: um.id, dois: dois.id, solto: solto.id }; })()'));

  // ── A FOLHA NASCE VAZIA, E DIZ ISSO ──────────────────────────────────────
  // Uma lista vazia sem frase é indistinguível de uma lista que não carregou —
  // e esta é a tela que o operador abre justamente quando quer saber se o app
  // está guardando alguma coisa.
  const vazia = await pg.evaluate(() => {
    openHistPopup();
    const t = document.getElementById('histList').textContent;
    closeHistPopup();
    return t;
  });
  checar(/Nada projetado ainda/.test(vazia),
    'a folha começa vazia e EXPLICA — não é uma lista que não carregou', vazia);

  // ── O QUE VAI AO TELÃO ENTRA NA LISTA, DO MAIS RECENTE PARA O MAIS ANTIGO ──
  await pg.evaluate((i) => send(i.um), ids);
  await pg.waitForTimeout(400);
  await pg.evaluate((i) => send(i.dois), ids);
  await pg.waitForTimeout(400);

  // OS CABEÇALHOS DE SESSÃO SÃO `<li>` DA MESMA LISTA (v1.4.31) — a folha rola
  // inteira, e um cabeçalho fora do `<ul>` ficaria parado sobre o conteúdo
  // errado. Aqui eles saem da contagem: o que estas asserções medem são as
  // LINHAS.
  const lido = () => pg.evaluate(() => {
    openHistPopup();
    const linhas = [...document.querySelectorAll('#histList li:not(.hist-sessao)')].map((li) => ({
      hora: (li.querySelector('.hist-hora') || {}).textContent || '',
      nome: (li.querySelector('.row-name') || {}).textContent || '',
      sub: (li.querySelector('.row-sub') || {}).textContent || '',
      botoes: [...li.querySelectorAll('button')].map((b) => b.title),
      sumiu: li.classList.contains('hist-sumiu'),
    }));
    closeHistPopup();
    return linhas;
  });

  const l1 = await lido();
  checar(l1.length === 2 && l1[0].nome === 'Aviso da secretaria' && l1[1].nome === 'Abertura do culto',
    'os dois itens projetados entram, do MAIS RECENTE para o mais antigo — '
    + 'uma lista de culto se lê para trás', l1.map((x) => x.nome));
  checar(l1.every((x) => /^\d{2}:\d{2}$/.test(x.hora)),
    'e cada linha carrega a HORA da apresentação (HH:MM)', l1.map((x) => x.hora));
  checar(l1.every((x) => x.botoes.length === 1 && /Cronograma/.test(x.botoes[0])),
    'a linha tem UM botão, e é o "Adicionar ao Cronograma" — sem excluir e sem '
    + 'reordenar: um registro do que já aconteceu não se edita', l1[0].botoes);

  // ── REPETIR A MESMA FAIXA NÃO ENCHE A LISTA ──────────────────────────────
  // `repeat: 'one'` reenvia o mesmo id a cada fim de faixa. Sem o colapso, um
  // louvor deixado em laço durante a oração enterraria o culto inteiro.
  await pg.evaluate((i) => send(i.dois), ids);
  await pg.evaluate((i) => send(i.dois), ids);
  await pg.waitForTimeout(400);
  const l2 = await lido();
  checar(l2.length === 2,
    'reprojetar o MESMO item não cria linha nova — a repetição consecutiva colapsa',
    l2.map((x) => x.nome));
  checar(/×3/.test(l2[0].sub),
    'e o subtítulo diz quantas vezes, que é o que o colapso não pode apagar', l2[0].sub);
  // E ALTERNAR VOLTA A ABRIR LINHA: o colapso é da repetição CONSECUTIVA, não
  // do item. Sem esta metade, um colapso por id daria uma lista que perde a
  // ordem do culto — o louvor de abertura sumiria ao ser repetido no fim.
  await pg.evaluate((i) => send(i.um), ids);
  await pg.waitForTimeout(300);
  await pg.evaluate((i) => send(i.dois), ids);
  await pg.waitForTimeout(300);
  const l3 = await lido();
  checar(l3.length === 4 && l3[0].nome === 'Aviso da secretaria' && l3[1].nome === 'Abertura do culto',
    'alternar entre dois itens ABRE linha nova — o colapso é da repetição '
    + 'CONSECUTIVA, não do item', l3.map((x) => x.nome));

  // ── "AO CRONOGRAMA" DE VERDADE ───────────────────────────────────────────
  await pg.evaluate((i) => send(i.solto), ids);
  await pg.waitForTimeout(400);
  const foi = await pg.evaluate(async (i) => {
    openHistPopup();
    const li = [...document.querySelectorAll('#histList li')]
      .find((el) => /Slide avulso/.test(el.textContent));
    li.querySelector('button').click();
    await new Promise((r) => setTimeout(r, 500));
    const dentro = await AVDB.listHas('imports', i.solto);
    closeHistPopup();
    return dentro;
  }, ids);
  checar(foi === true,
    'o botão da linha põe o item NO CRONOGRAMA de verdade — não é só um pulso', foi);

  // ── O TOQUE NA LINHA PROJETA (v1.2.3) ────────────────────────────────────
  // Pedido do operador: *"pode fazer o item do histórico ser executável
  // diretamente no toque"*. É a razão de o histórico existir — repetir um
  // louvor que entrou de improviso e não ficou guardado em lista nenhuma —, e
  // até aqui isso custava passar pelo Cronograma.
  //
  // A prova é o `currentId`, não o clique ter acontecido: um `send` que
  // estourasse deixaria o toque sem efeito e sem erro na tela.
  const tocou = await pg.evaluate(async (i) => {
    await send(i.um);                 // outra coisa em cena, para haver o que trocar
    await new Promise((r) => setTimeout(r, 300));
    const antes = currentId;
    openHistPopup();
    const li = [...document.querySelectorAll('#histList li')]
      .find((el) => /Aviso da secretaria/.test(el.textContent));
    li.querySelector('.row').click();
    await new Promise((r) => setTimeout(r, 600));
    return {
      antes,
      depois: currentId,
      alvo: i.dois,
      // A FOLHA FECHA: ela cobre a preview e o transporte, que é onde a
      // resposta ao toque aparece.
      fechou: !document.getElementById('histPopup').classList.contains('open'),
    };
  }, ids);
  checar(tocou.antes !== tocou.alvo,
    'o cenário está montado: em cena estava OUTRO item', tocou);
  checar(tocou.depois === tocou.alvo,
    'o toque na linha PROJETA aquele item — é para isto que se abre o histórico',
    tocou);
  checar(tocou.fechou,
    'e a folha fecha, senão a projeção aconteceria atrás dela', tocou);

  // O BOTÃO NÃO PROJETA: ele tem `stopPropagation`, e sem isso "mandar ao
  // Cronograma" mandaria ao TELÃO junto — uma ação a mais que ninguém pediu, na
  // frente da congregação.
  const soBotao = await pg.evaluate(async (i) => {
    await send(i.um);
    await new Promise((r) => setTimeout(r, 300));
    openHistPopup();
    const li = [...document.querySelectorAll('#histList li')]
      .find((el) => /Aviso da secretaria/.test(el.textContent));
    li.querySelector('.row-btn').click();
    await new Promise((r) => setTimeout(r, 500));
    const r2 = { emCena: currentId, alvo: i.um,
      aberta: document.getElementById('histPopup').classList.contains('open') };
    closeHistPopup();
    return r2;
  }, ids);
  checar(soBotao.emCena === soBotao.alvo,
    'o botão "Ao Cronograma" NÃO projeta — a cena continua a mesma', soBotao);
  checar(soBotao.aberta,
    'e a folha continua aberta: guardar um item não é sair da lista', soBotao);

  // ── O ITEM QUE SAIU DO APARELHO PERDE A AÇÃO, E A LINHA FICA ─────────────
  // O histórico responde o que ACONTECEU: apagar a linha apagaria o fato. O que
  // sai é o botão, porque não há mais nada a mandar adiante.
  const sumido = await pg.evaluate(async (i) => {
    // TIRAR DE CENA ANTES: a cena projetada é um DETENTOR (ver `persistCurrent`),
    // e o coletor não recolhe o que está no telão — com razão. Sem esta linha o
    // cenário não chega a se montar, e as três asserções abaixo mediriam um
    // item que continua existindo.
    await stopClear();
    // Tirar das DUAS listas é o que faz o coletor recolher os bytes (ver
    // `LISTS` em db.js): sair de uma só deixaria o registro vivo, e o teste
    // mediria o oposto do que veio medir.
    await AVDB.listRemove('imports', i.solto);
    await AVDB.listRemove('avulsos', i.solto);
    const aindaTem = !!(await AVDB.getMedia(i.solto));
    openHistPopup();
    await new Promise((r) => setTimeout(r, 400));
    const li = [...document.querySelectorAll('#histList li')]
      .find((el) => /Slide avulso/.test(el.textContent));
    const r = {
      aindaTem,
      existe: !!li,
      marcada: !!(li && li.classList.contains('hist-sumiu')),
      botoes: li ? li.querySelectorAll('button').length : -1,
      sub: li ? (li.querySelector('.row-sub') || {}).textContent : '',
    };
    closeHistPopup();
    return r;
  }, ids);
  checar(!sumido.aindaTem, 'o cenário está montado: o item saiu do banco', sumido);
  checar(sumido.existe && sumido.marcada,
    'a linha FICA e é marcada — o histórico responde o que aconteceu, e o fato '
    + 'não deixou de ser verdade', sumido);
  checar(sumido.botoes === 0 && /não está mais no aparelho/i.test(sumido.sub),
    'mas ela perde a ação e diz por quê — um "Adicionar ao Cronograma" sobre um '
    + 'id órfão gravaria uma linha que não abre nada', sumido);

  // ══════════════════════════════════════════════════════════════════════════
  // AS SESSÕES (v1.4.31)
  // ══════════════════════════════════════════════════════════════════════════
  //
  // Pedido do operador: *"armazene os dados entre sessões, separando as
  // sessões. mantenha os itens usáveis apenas na categoria da sessão atual.
  // para as sessões antigas, deixe usáveis apenas itens padrões do sistema,
  // como músicas, textos, links e etc... que não dependem de um arquivo que
  // pode já ter sido excluído"*.
  //
  // As três metades falham CALADAS, e em direções diferentes:
  //
  //  - **não persistir** — o app abre no sábado seguinte com a folha vazia, e
  //    isso é exatamente o que ela mostrava ANTES do lote: ninguém distingue
  //    "não guardou" de "não toquei nada ainda";
  //  - **não separar** — o culto de hoje e o de sábado passado viram uma
  //    corrida de horas que se repetem, e "09:12" não diz de que dia é;
  //  - **oferecer o que depende de um arquivo** — a linha antiga responde ao
  //    toque, o arquivo não está lá, e o operador descobre isso no minuto em
  //    que precisa dele. É a razão inteira da regra: o histórico não pode
  //    obrigar o aparelho a guardar nada.
  const cabs = () => pg.evaluate(() => {
    openHistPopup();
    const r = [...document.querySelectorAll('#histList .hist-sessao')].map((li) => ({
      tit: (li.querySelector('.hist-sessao-tit') || {}).textContent || '',
      sub: (li.querySelector('.hist-sessao-sub') || {}).textContent || '',
      botoes: [...li.querySelectorAll('button')].map((b) => b.title),
    }));
    closeHistPopup();
    return r;
  });
  const c1 = await cabs();
  checar(c1.length === 1 && /Esta sessão/.test(c1[0].tit),
    'a sessão em curso tem cabeçalho próprio e se chama pelo que ela é', c1);
  checar(/\d+ ite(m|ns) · \d{2}:\d{2}/.test(c1[0].sub),
    'e ele diz quantos itens e a janela de horas — é isso que separa o culto da '
    + 'manhã do ensaio da noite quando o rótulo do dia for o mesmo', c1[0].sub);
  checar(c1[0].botoes.length === 1 && /Limpar esta sessão/.test(c1[0].botoes[0]),
    'o cabeçalho carrega a saída DELA: limpar por sessão, a metade do pedido que '
    + 'o "limpar tudo" do rodapé não cobre', c1[0].botoes);

  // ── ELE SOBREVIVE À CARGA DA PÁGINA ─────────────────────────────────────
  // Esperar pelo FATO (a chave gravada), nunca por um prazo: a gravação é
  // COALESCIDA (`HIST_GRAVA_MS`) de propósito — ela sai do caminho quente do
  // `send` —, e um `waitForTimeout` aqui mediria o agendador da máquina.
  checar(await esperar(async () => {
    const h = await AVDB.getState('historico');
    return Array.isArray(h) && h.length === 1 && h[0].itens.length >= 4;
  }), 'a sessão em curso chega ao DISCO sozinha, sem ninguém mandar — a gravação '
    + 'é coalescida (sai do caminho quente do `send`), não inexistente',
    'PRAZO, não veredito: a chave `historico` não apareceu em 20 s');

  // E UMA SESSÃO ANTIGA PLANTADA, com as três naturezas lado a lado. Ela é
  // plantada e não tocada porque o que se mede aqui é a REGRA (`histAcionavel`
  // e `histResolver`), não o caminho de gravação — esse os blocos acima já
  // cobrem. Plantar DEPOIS do boot e ler na carga seguinte é o que evita a
  // corrida contra o `histCarregar()` da abertura, que consome a chave com
  // toda a razão (a mesma armadilha do `ota-intencao`).
  await pg.evaluate((i) => window.AVDB.updateState('historico', (atual) => {
    const ontem = Date.now() - 26 * 3600 * 1000;
    return [...(atual || []), { inicio: ontem, itens: [
      { id: 'sumido-1', nome: 'Vídeo importado', sub: 'Vídeo', hora: ontem, vezes: 1, rec: null },
      { id: 'sumido-2', nome: 'Louvor de abertura', sub: 'Áudio', hora: ontem + 1000, vezes: 1,
        rec: { t: 'cena', c: 'message', d: { text: 'Bem-vindos ao culto' } } },
      { id: 'sumido-3', nome: 'Testemunho da semana', sub: 'YouTube', hora: ontem + 2000, vezes: 1,
        rec: { t: 'link', u: 'https://www.youtube.com/watch?v=abcdefghijk', y: 'abcdefghijk' } },
      // O ITEM DE ACERVO, com o id de um registro que NÃO EXISTE mais: é o hino
      // apagado e rebaixado, que ganha id novo. Quem o acha é o par
      // `folder`/`srcName`, e o que ele prova é a outra metade do `histResolver`
      // — ACHAR não é CRIAR, e um achado ainda precisa ENTRAR na lista.
      { id: 'sumido-4', nome: 'Hino do acervo', sub: 'Áudio', hora: ontem + 3000, vezes: 1,
        rec: { t: 'acervo', f: 'hinario-teste', s: '042-cantada' } },
    ] }];
  }), ids);
  const idAcervo = await pg.evaluate(async () => {
    const rec = { id: 'rebaixado-agora', folder: 'hinario-teste', srcName: '042-cantada',
      opfsPath: 'folders/hinario-teste/042.mp3', name: 'Hino do acervo', kind: 'audio',
      type: 'audio/mpeg', size: 1, mtime: Date.now(), blob: null, url: null, addedAt: Date.now() };
    await AVDB.fileAdd(rec);
    return rec.id;
  });

  await pg.goto(base + '/controle/', { waitUntil: 'load' });
  await pg.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function', null, { timeout: 20000 });
  // A LISTA JÁ LIDA, e é por ela que se espera — não pelo `load()`: `histCarregar`
  // roda antes dele, e afirmar a coisa que se vai medir seria a tautologia que o
  // CLAUDE.md nomeia.
  checar(await esperar(() => Array.isArray(historico) && historico.length === 2),
    'e o `histCarregar()` da abertura o traz de volta antes de qualquer projeção',
    'PRAZO, não veredito: `historico` não chegou a duas sessões em 20 s');

  const depois = await pg.evaluate(() => {
    setAppMode('full');
    openHistPopup();
    const nos = [...document.querySelectorAll('#histList > li')];
    const blocos = [];
    for (const li of nos) {
      if (li.classList.contains('hist-sessao')) {
        blocos.push({ tit: (li.querySelector('.hist-sessao-tit') || {}).textContent, linhas: [] });
      } else if (blocos.length) {
        blocos[blocos.length - 1].linhas.push({
          nome: (li.querySelector('.row-name') || {}).textContent || '',
          sub: (li.querySelector('.row-sub') || {}).textContent || '',
          botoes: li.querySelectorAll('button').length,
          arquivada: li.classList.contains('hist-arquivada'),
        });
      }
    }
    closeHistPopup();
    return blocos;
  });
  checar(depois.length === 2 && depois.every((b) => b.linhas.length),
    'o histórico ATRAVESSOU a carga da página: as duas sessões voltaram, com '
    + 'as linhas delas', depois.map((b) => [b.tit, b.linhas.length]));
  checar(depois.every((b) => !/Esta sessão/.test(b.tit)),
    'e NENHUMA é "esta sessão": a carga nova ainda não projetou nada, então ela '
    + 'não existe — uma sessão vazia no topo seria um cabeçalho sobre nada',
    depois.map((b) => b.tit));

  const antiga = depois[1];
  const semRec = antiga.linhas.find((l) => /Vídeo importado/.test(l.nome));
  const comCena = antiga.linhas.find((l) => /Louvor de abertura/.test(l.nome));
  const comLink = antiga.linhas.find((l) => /Testemunho/.test(l.nome));
  checar(!!semRec && semRec.botoes === 0 && semRec.arquivada && /só registro/.test(semRec.sub),
    'numa sessão ANTIGA o que dependia de um ARQUIVO fica só como registro — e '
    + 'a linha DIZ isso: uma linha inerte que não explica é indistinguível de um '
    + 'app quebrado', semRec);
  checar(!!comCena && comCena.botoes === 1 && !comCena.arquivada,
    'e o TEXTO continua usável: ele não depende de arquivo nenhum, que é '
    + 'exatamente a régua do pedido', comCena);
  checar(!!comLink && comLink.botoes === 1 && !comLink.arquivada,
    'o LINK também: o endereço é tudo o que ele sempre foi', comLink);

  // ── E O REAPROVEITAMENTO É DE VERDADE, não um botão que pulsa ────────────
  // O id gravado NÃO EXISTE mais no banco (a sessão foi plantada com ids
  // inventados, que é o caso real de um item recolhido pelo coletor). O que
  // faz a linha funcionar é a RECEITA remontar o item — e a prova é o
  // Cronograma ter ganhado uma cena com aquele texto, não o clique ter
  // acontecido.
  const remontou = await pg.evaluate(async () => {
    openHistPopup();
    const li = [...document.querySelectorAll('#histList li:not(.hist-sessao)')]
      .find((el) => /Louvor de abertura/.test(el.textContent));
    li.querySelector('.row-btn').click();
    await new Promise((r) => setTimeout(r, 700));
    const itens = await AVDB.listItems('imports');
    closeHistPopup();
    return {
      orfao: !(await AVDB.getMedia('sumido-2')),
      achou: itens.some((r) => r.kind === 'cue' && r.data && r.data.text === 'Bem-vindos ao culto'),
    };
  });
  checar(remontou.orfao,
    'o cenário está montado: o id daquela linha não existe mais no banco', remontou);
  checar(remontou.achou,
    'e mandá-la ao Cronograma REMONTA o item pela receita — é isto que permite o '
    + 'aparelho ter apagado o arquivo sem o histórico virar enfeite', remontou);

  // ── E ACHAR NÃO É CRIAR ────────────────────────────────────────────────
  // A outra metade do `histResolver`, e a que falha da forma mais cara: um item
  // de ACERVO é ACHADO (pelo par `folder`/`srcName`, porque o id do registro
  // rebaixado é outro) e continua precisando ENTRAR na lista. Tratá-lo como
  // criado responde "adicionado ao Cronograma" sem adicionar nada — e isso é
  // indistinguível do certo até o sábado seguinte.
  const achado = await pg.evaluate(async (idNovo) => {
    openHistPopup();
    const li = [...document.querySelectorAll('#histList li:not(.hist-sessao)')]
      .find((el) => /Hino do acervo/.test(el.textContent));
    li.querySelector('.row-btn').click();
    await new Promise((r) => setTimeout(r, 700));
    const r = {
      idVelhoMorto: !(await AVDB.getMedia('sumido-4')),
      entrou: await AVDB.listHas('imports', idNovo),
    };
    closeHistPopup();
    return r;
  }, idAcervo);
  checar(achado.idVelhoMorto,
    'o cenário está montado: o id gravado no histórico não existe mais', achado);
  checar(achado.entrou,
    'e o item de ACERVO entra no Cronograma pelo id ATUAL — ele foi ACHADO pelo '
    + 'par folder/srcName, não criado, e um achado ainda precisa entrar na lista',
    achado);

  // ── PROJETAR ABRE A SESSÃO DE HOJE, e ela nasce no TOPO ──────────────────
  const nova = await pg.evaluate(async (i) => {
    await send(i.um);
    await new Promise((r) => setTimeout(r, 400));
    openHistPopup();
    const primeiro = document.querySelector('#histList > li');
    const r = {
      cabs: [...document.querySelectorAll('#histList .hist-sessao-tit')].map((e) => e.textContent),
      primeiroEhCabecalho: !!primeiro && primeiro.classList.contains('hist-sessao'),
    };
    closeHistPopup();
    return r;
  }, ids);
  checar(nova.primeiroEhCabecalho && nova.cabs.length === 3 && /Esta sessão/.test(nova.cabs[0]),
    'a primeira projeção desta carga abre a sessão de HOJE, no topo — a lista '
    + 'inteira se lê do mais recente para o mais antigo, sessões inclusive', nova);

  // ── LIMPAR: por sessão, e tudo ──────────────────────────────────────────
  const limpou = await pg.evaluate(async () => {
    openHistPopup();
    const cab = [...document.querySelectorAll('#histList .hist-sessao')][1];
    const alturaCab = Math.round(cab.getBoundingClientRect().height);
    const alturaLixo = Math.round(cab.querySelector('.row-btn').getBoundingClientRect().height);
    cab.querySelector('button').click();
    await new Promise((r) => setTimeout(r, 200));
    // A pergunta mora na FAIXA do próprio botão, como todo destrutivo desta
    // base — e é o "sim" dela que executa.
    const perguntou = !!cab.querySelector('.linha-sim');
    // E AS ALTURAS BATEM com a do botão que o par substitui (v1.4.29 pagou esta
    // conta uma vez, num caminho que nasceu depois da regra): o `.row-btn` da
    // lixeira mede `--hit`, e o par tem de medir o mesmo. Aqui o TÍTULO fica à
    // vista de propósito — a pergunta é "limpar ESTA sessão", e o nome dela é o
    // que a identifica; na linha de um item quem identifica é a capa, e por isso
    // lá a faixa cobre o nome.
    const alturas = {
      lixo: alturaLixo,
      par: [...cab.querySelectorAll('.linha-confirma-btn')].map((b) => Math.round(b.getBoundingClientRect().height)),
      cabecalhoAntes: alturaCab,
      cabecalhoDurante: Math.round(cab.getBoundingClientRect().height),
      tituloAVista: !!cab.querySelector('.hist-sessao-tit').getClientRects().length,
    };
    cab.querySelector('.linha-sim').click();
    await new Promise((r) => setTimeout(r, 600));
    const r = {
      perguntou,
      alturas,
      restaram: [...document.querySelectorAll('#histList .hist-sessao-tit')].map((e) => e.textContent),
      noDisco: (await AVDB.getState('historico') || []).length,
    };
    closeHistPopup();
    return r;
  });
  checar(limpou.alturas.par.length === 2
    && limpou.alturas.par.every((h) => h === limpou.alturas.lixo)
    && limpou.alturas.cabecalhoDurante === limpou.alturas.cabecalhoAntes
    && limpou.alturas.tituloAVista,
    'o par de confirmação mede o MESMO que o botão que ele substitui, o cabeçalho '
    + 'não muda de altura sob o dedo, e o nome da sessão fica à vista — é dela '
    + 'que a pergunta fala', limpou.alturas);
  checar(limpou.perguntou,
    'limpar uma sessão PERGUNTA antes, na faixa do próprio botão', limpou);
  checar(limpou.restaram.length === 2 && limpou.noDisco === 2,
    'e some só ELA — as outras ficam, na tela e no disco', limpou);

  const limpouTudo = await pg.evaluate(async () => {
    openHistPopup();
    const btn = document.getElementById('histClear');
    const visivel = !document.getElementById('histClearFaixa').hidden;
    btn.click();
    await new Promise((r) => setTimeout(r, 200));
    document.querySelector('#histClearFaixa .linha-sim').click();
    await new Promise((r) => setTimeout(r, 600));
    const r = {
      visivel,
      cabs: document.querySelectorAll('#histList .hist-sessao').length,
      texto: document.getElementById('histList').textContent,
      faixaSumiu: document.getElementById('histClearFaixa').hidden,
      noDisco: (await AVDB.getState('historico') || []).length,
    };
    closeHistPopup();
    return r;
  });
  checar(limpouTudo.visivel && limpouTudo.cabs === 0 && limpouTudo.noDisco === 0,
    'e o "limpar todo o histórico" leva as sessões todas, na tela e no disco',
    limpouTudo);
  checar(/Nada projetado ainda/.test(limpouTudo.texto) && limpouTudo.faixaSumiu,
    'a folha volta a EXPLICAR que está vazia, e a faixa do limpar some com a '
    + 'lista — um destrutivo sobre nada é um alvo que só pode errar', limpouTudo);

  checar(erros.length === 0, 'nenhum erro de console', erros);
} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) {
  console.log('\n' + falhas.length + ' falha(s).');
  process.exit(1);
}
console.log('\nTodos passaram.');
