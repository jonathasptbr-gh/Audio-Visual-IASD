// AS FERRAMENTAS SÃO UMA FOLHA DO CRONOGRAMA (v1.3.10).
//
// Mensagens, Tempo, Sorteio e o microfone ao vivo eram uma ABA, ao lado do
// Cronograma e da Bíblia. A faixa passou a ter só os dois LUGARES do culto — o
// roteiro e a Bíblia — mais a porta da Biblioteca, e as ferramentas viraram uma
// folha que sobe de dentro do Cronograma.
//
// A mudança não é de navegação, é de PARENTESCO: toda ferramenta daqui produz
// uma CENA que entra no roteiro (a mensagem vira cue, o cronômetro e o sorteio
// são projetados no meio da ordem do culto). A aba escondia essa relação atrás
// de um passo lateral.
//
// ## O que falha calado aqui
//
//  - **a folha cobrindo a tela toda.** É o pedido literal ("não na tela toda"),
//    e não é gosto: quem projeta um cronômetro precisa do TRANSPORTE e da
//    PREVIEW na frente enquanto o ajusta. Uma folha de corpo inteiro continua
//    funcionando, continua bonita, e cobra do operador um fechar-e-abrir por
//    ajuste. Por isso a asserção é GEOMÉTRICA: a folha não pode invadir o
//    cabeçalho nem a caixa de controles.
//  - **`activeTab` sair de `'imports'`.** Se a folha trocasse a aba, o rodapé
//    do Cronograma (onde mora a porta dela) deixaria de ser desenhado, o
//    carrossel perderia o destino e o voltar não teria para onde voltar. Nada
//    disso dá erro: dá uma tela que responde estranho.
//  - **a folha sobreviver à troca de aba.** Ela é uma extensão do CRONOGRAMA;
//    de pé sobre a Bíblia seria a folha de uma tela flutuando sobre outra.
//  - **o voltar do Android pulá-la.** Sem o degrau, o gesto que todo mundo usa
//    para "fechar isto" minimiza o app no meio do culto.
//
//   node tools/ferramentas-folha.test.mjs
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
  '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml',
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

await new Promise((r) => servidor.listen(0, r));
const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const ctx = await navegador.newContext({ viewport: { width: 412, height: 892 } });
await semRedeExterna(ctx);
const pg = await ctx.newPage();
const erros = [];
pg.on('pageerror', (e) => erros.push(e.message));

try {
  await pg.goto('http://localhost:' + servidor.address().port + '/controle/', { waitUntil: 'load' });
  await pg.waitForFunction(
    () => window.AVDB && typeof window.__avBack === 'function' && !!document.querySelector('#playlist li'),
    null, { timeout: 25000 },
  );
  await pg.evaluate(() => setAppMode('full'));
  await pg.waitForTimeout(200);

  // ── 1. A FAIXA TEM SÓ OS DOIS LUGARES, MAIS A BUSCA ─────────────────────
  const faixa = await pg.evaluate(() => ({
    abas: [...document.querySelectorAll('.tabs .tab')].map((b) => b.dataset.tab),
    busca: !!document.getElementById('hymnSearchBtn'),
    // A ordem interna tem de acompanhar: uma aba fora da faixa que continuasse
    // no carrossel deixaria o operador numa tela sem indicação de onde está.
    ordem: typeof TAB_ORDER !== 'undefined' ? TAB_ORDER : null,
    deslize: typeof SWIPE_TABS !== 'undefined' ? SWIPE_TABS : null,
  }));
  checar(faixa.abas.length === 2 && faixa.abas[0] === 'imports' && faixa.abas[1] === 'bible',
    'a faixa tem só Cronograma e Bíblia', faixa);
  checar(faixa.busca, 'e a porta da Biblioteca continua ali', faixa);
  checar(!faixa.ordem.includes('mic') && !faixa.deslize.includes('mic'),
    'o carrossel e a ordem interna também perderam o destino que saiu da faixa', faixa);

  // ── 2. A PORTA É NO CRONOGRAMA, À DIREITA DA IMPORTAÇÃO ─────────────────
  const porta = await pg.evaluate(() => {
    const b = document.getElementById('toolsBtn');
    const imp = document.querySelector('.import-row .import-btn');
    if (!b || !imp) return { faltando: !b ? 'toolsBtn' : 'import-btn' };
    const rb = b.getBoundingClientRect();
    const ri = imp.getBoundingClientRect();
    return {
      naMesmaLinha: b.parentElement === imp.parentElement,
      aDireita: rb.left >= ri.right - 1,
      // A altura é a da LINHA: um botão mais baixo que o irmão lê como um
      // acessório dele, e não como a segunda porta da mesma faixa.
      mesmaAltura: Math.abs(rb.height - ri.height) < 2,
    };
  });
  checar(porta.naMesmaLinha && porta.aDireita,
    'a porta das Ferramentas está NA LINHA da importação, à DIREITA dela', porta);
  checar(porta.mesmaAltura, 'e com a mesma caixa do irmão', porta);

  // ── 3. A FOLHA SOBE DENTRO DO CRONOGRAMA, NÃO SOBRE A TELA ──────────────
  await pg.click('#toolsBtn');
  await pg.waitForTimeout(400);   // a entrada é uma animação de 220 ms
  const dentro = await pg.evaluate(() => {
    const f = document.getElementById('toolsSheet');
    const cab = document.querySelector('.list-header').getBoundingClientRect();
    const barra = document.querySelector('.bottombar').getBoundingClientRect();
    const r = f.getBoundingClientRect();
    return {
      aberta: !f.hidden,
      // NADA de `elementFromPoint` no cabeçalho: o que se mede é a CAIXA, que
      // é o que o desenho promete.
      invadeCabecalho: r.top < cab.bottom - 1,
      invadeControles: r.bottom > barra.top + 1,
      // E ela ocupa a lista de fato — uma folha de 20px de altura passaria nas
      // duas de cima sem servir para nada.
      cobreALista: (() => {
        const l = document.getElementById('library').getBoundingClientRect();
        return r.top <= l.top + 1 && r.bottom >= l.bottom - 1;
      })(),
      aba: activeTab,
      ferramentas: !!document.querySelector('.misc-switch'),
    };
  });
  checar(dentro.aberta && dentro.ferramentas,
    'o toque na porta abre a folha com o seletor de ferramentas dentro', dentro);
  checar(!dentro.invadeCabecalho && !dentro.invadeControles,
    'ela NÃO cobre o cabeçalho nem a caixa de controles — quem projeta um '
    + 'cronômetro precisa do transporte e da preview na frente', dentro);
  checar(dentro.cobreALista, 'e cobre a lista inteira, que é o território dela', dentro);
  checar(dentro.aba === 'imports',
    'o operador continua NO CRONOGRAMA: a folha é uma camada dele, não outra tela', dentro);

  // ── 4. O VOLTAR DO ANDROID A FECHA ──────────────────────────────────────
  const voltou = await pg.evaluate(() => {
    const consumiu = window.__avBack();
    // O `.saindo` é o que separa "fechou" de "não fez nada": a folha leva os
    // 220 ms da animação para deixar a árvore, e ler o `hidden` no ato mediria
    // a animação, não o degrau.
    return {
      consumiu,
      saindo: document.getElementById('toolsSheet').classList.contains('saindo'),
      aba: activeTab,
    };
  });
  checar(voltou.consumiu === true && voltou.saindo,
    'o voltar do aparelho FECHA a folha e consome o toque — sem o degrau ele '
    + 'minimizaria o app no meio do culto', voltou);
  checar(voltou.aba === 'imports', 'e deixa o operador onde ele estava', voltou);
  await pg.waitForFunction(
    () => document.getElementById('toolsSheet').hidden, null, { timeout: 4000 },
  ).catch(() => {});

  // ── 5. TROCAR DE ABA A FECHA ────────────────────────────────────────────
  await pg.click('#toolsBtn');
  await pg.waitForTimeout(200);
  const trocou = await pg.evaluate(async () => {
    await switchTab('bible');
    // MEDIDO NO ATO: a folha COMEÇA a sair no mesmo turno. Ela leva os 220 ms da
    // animação para deixar a árvore (ver `TOOLS_ANIM_MS`), e afirmar só o fim
    // não separaria "fechou" de "nunca fechou" — os dois acabam iguais depois
    // de um prazo generoso.
    return { saindo: document.getElementById('toolsSheet').classList.contains('saindo'), aba: activeTab };
  });
  checar(trocou.saindo && trocou.aba === 'bible',
    'ir para a Bíblia fecha a folha — ela é uma extensão do CRONOGRAMA', trocou);

  // E ELA DE FATO SAI DA ÁRVORE. O `hidden` é o estado; a animação é só o
  // caminho até ele. Uma folha "fora" por estar transladada continuaria
  // capturando toque sobre a lista.
  const saiu = await pg.waitForFunction(
    () => document.getElementById('toolsSheet').hidden, null, { timeout: 4000 },
  ).then(() => true).catch(() => false);
  const depoisDeSair = await pg.evaluate(() => ({
    hidden: document.getElementById('toolsSheet').hidden,
    saindo: document.getElementById('toolsSheet').classList.contains('saindo'),
    // O corpo é esvaziado junto: os laços dos painéis (cronômetro, sorteio)
    // morrem com ele, e nós órfãos sendo reescritos a 5 Hz é o vazamento
    // clássico desta família.
    corpoVazio: document.getElementById('toolsBody').children.length === 0,
  }));
  checar(saiu && !depoisDeSair.saindo,
    'e ela sai da árvore no fim da animação, sem deixar a classe da saída para trás',
    depoisDeSair);
  checar(depoisDeSair.corpoVazio,
    'e o corpo dela é esvaziado, para os laços dos painéis não sobrarem', depoisDeSair);

  // ── 5-A. O FANTASMA DA TROCA DE ABA CONTINUA SOBRE A LISTA ──────────────
  //
  // `.list-body` nasceu POSICIONADO (para a folha ancorar nele), e com isso ele
  // virou o offsetParent da `#library`. O fantasma do carrossel se posiciona por
  // `offsetTop`/`offsetLeft` — coordenadas desse pai —, então pendurá-lo no
  // `<main>`, como antes, o sobe a altura inteira do cabeçalho: o deslize passa
  // por cima do nome da tela e da engrenagem, por 220 ms, sem erro nenhum.
  //
  // É um transiente de um quinto de segundo, e por isso ele é medido no
  // instante em que nasce: `switchTab` monta o fantasma de forma SÍNCRONA,
  // antes do `await load()`.
  const fantasma = await pg.evaluate(() => {
    switchTab('imports');                       // de propósito NÃO aguardado
    const g = document.querySelector('.lib-ghost');
    if (!g) return { erro: 'nenhum fantasma foi criado' };
    const r = g.getBoundingClientRect();
    const cab = document.querySelector('.list-header').getBoundingClientRect();
    return { invadeCabecalho: r.top < cab.bottom - 1, topo: Math.round(r.top), cab: Math.round(cab.bottom) };
  });
  checar(fantasma.erro === undefined && fantasma.invadeCabecalho === false,
    'o fantasma do carrossel fica sobre a LISTA, não sobre o cabeçalho', fantasma);
  await pg.waitForTimeout(400);

  // ── 5-B. A SAÍDA TEM PAR (v1.3.13) ──────────────────────────────────────
  //
  // Pedido do operador: *"verifique o fechamento da seção de ferramentas, para
  // fechar com animação igual é feito na abertura"*. Ela subia deslizando e
  // sumia no talo — duas coisas diferentes para o olho, e a segunda lendo como
  // um erro justamente porque a primeira já ensinou a esperar o contrário.
  //
  // O que se afirma é o PAR e a MESMA duração, não a curva desenhada: quem
  // desenha é o CSS, e medir pixels de uma animação seria medir o compositor.
  await pg.evaluate(async () => { await switchTab('imports'); });
  await pg.waitForSelector('#toolsBtn', { timeout: 8000 });
  const par = await pg.evaluate(async () => {
    const f = document.getElementById('toolsSheet');
    document.getElementById('toolsBtn').click();
    const entrando = getComputedStyle(f).animationName;
    const dEntra = getComputedStyle(f).animationDuration;
    fecharFerramentas();
    const saindo = getComputedStyle(f).animationName;
    const dSai = getComputedStyle(f).animationDuration;
    await new Promise((r) => setTimeout(r, 400));
    return { entrando, saindo, dEntra, dSai };
  });
  checar(par.entrando === 'tools-sobe' && par.saindo === 'tools-desce',
    'a folha DESCE por onde subiu — a saída tem par, e não é o mesmo desenho', par);
  checar(par.dEntra === par.dSai,
    'e com a mesma duração: dois tempos divergiriam no primeiro ajuste', par);

  // ── 6. A PORTA NÃO EXISTE FORA DO CRONOGRAMA ────────────────────────────
  const foraDoCrono = await pg.evaluate(async () => {
    await switchTab('bible');
    return !document.getElementById('toolsBtn');
  });
  checar(foraDoCrono,
    'e a porta some junto: ela é o rodapé do Cronograma, não um controle global');

  checar(erros.length === 0, 'nenhum erro de página', erros);
} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) {
  console.log('\n' + falhas.length + ' falha(s).');
  process.exit(1);
}
console.log('\nTodos passaram.');
