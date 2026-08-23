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
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
};

const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const arquivo = path.join(RAIZ, p);
  if (!arquivo.startsWith(RAIZ) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
    res.writeHead(404); res.end('nao'); return;
  }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream' });
  fs.createReadStream(arquivo).pipe(res);
});

const falhas = [];
function checar(cond, msg, obtido) {
  if (cond) console.log('ok      ' + msg);
  else {
    console.log('FALHOU  ' + msg + (obtido !== undefined ? '\n        obtido: ' + JSON.stringify(obtido) : ''));
    falhas.push(msg);
  }
}

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
const navegador = await chromium.launch({
  ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  args: ['--autoplay-policy=no-user-gesture-required'],
});
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

  const lido = () => pg.evaluate(() => {
    openHistPopup();
    const linhas = [...document.querySelectorAll('#histList li')].map((li) => ({
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
