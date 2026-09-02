// ===== A JANELA DA BIBLIOTECA: O QUE ELA COBRE, O QUE A COBRE, E QUANTO ELA MEDE =====
//
// Cinco relatos do operador, e os cinco são a mesma peça vista de ângulos
// diferentes — a camada da Biblioteca é a ÚNICA deste app que existe SEMPRE (a
// barra de busca vive nela, à vista o culto inteiro), e cada regra escrita para
// as camadas que vão e vêm precisa ser reexaminada para ela.
//
//   · *"a barra de buscas está se sobrepondo a diversos elementos, como as
//     configurações, aba da playlist e etc… Muito inconsistente"*
//   · *"em aberto a aba da biblioteca, quando toco em abrir a aba da playlist a
//     playlist tocando fica por baixo"*
//   · *"ajuste também para que a zona dos controles seja ocultada quando a
//     biblioteca estiver aberta e o teclado também estiver visível"*
//   · *"no modo simples, a aba de buscas pode usar a tela inteira, pois agora ela
//     está cortando aleatoriamente em algum pedaço da tela"*
//   · *"ajuste a caixa de buscas para que ela resete seu texto quando for
//     fechada"*
//
// **POR QUE UM ARQUIVO NOVO.** O `barra-em-qualquer-tela` mede a barra em várias
// TELAS; o `smoke` mede o tom e a estrutura dela. O que falta é a pergunta de
// PILHA — quem fica na frente de quem —, e ela só existe com DUAS camadas
// abertas ao mesmo tempo, que é um cenário que nenhum dos dois monta.
//
// **A PROVA É HIT-TEST, nunca `z-index` computado.** Um número lido de volta
// prova que a folha declara o que declara; quem decide entre dois empatados é a
// ORDEM DO DOCUMENTO, e foi exatamente esse acaso que produziu os dois primeiros
// relatos. `elementFromPoint` responde a pergunta que o operador fez: *o que o
// dedo encontra aqui?*
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
    console.log('FALHOU  ' + msg
      + (obtido !== undefined ? '\n        obtido: '
        + (typeof obtido === 'string' ? obtido : JSON.stringify(obtido)) : ''));
    falhas.push(msg);
  }
}

await new Promise((r) => servidor.listen(0, r));
const porta = servidor.address().port;
const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const erros = [];
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY/;

try {
  const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true });
  await semRedeExterna(ctx);
  await ctx.addInitScript(() => {
    try { localStorage.setItem('av.appMode', 'full'); } catch (_) { /* storage bloqueado */ }
  });
  const pg = await ctx.newPage();
  pg.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (EXTERNO.test(t) || /Failed to load resource/.test(t)) return;
    erros.push(t);
  });
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await pg.goto(`http://localhost:${porta}/controle/`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(
    () => window.AVDB && typeof window.__avBack === 'function'
      && !!document.querySelector('#playlist li') && !!document.querySelector('.lib-bar'),
    null, { timeout: 30000 },
  );

  // Assentar pelo FATO: a coluna transiciona, e medir no meio dela responde
  // sobre o ponto de partida.
  const assentar = () => pg.evaluate(async () => {
    const folha = document.querySelector('.popup-sheet--lib');
    for (let i = 0; i < 90; i++) {
      const a = folha.getAnimations ? folha.getAnimations() : [];
      if (!a.some((x) => x.playState === 'running')) break;
      await new Promise((r) => requestAnimationFrame(r));
    }
    await new Promise((r) => requestAnimationFrame(r));
  });
  await assentar();

  // ======================================================================
  // 1 · FECHADA, A BARRA NÃO PINTA SOBRE FOLHA NENHUMA
  // ======================================================================
  //
  // O primeiro relato. A camada está em `z-index: 200` como toda `.popup-backdrop`
  // e é declarada DEPOIS do `#plPopup`, do `#fadePopup` e do `#castPopup` — com o
  // empate, quem ganhava era a ordem do documento, e a faixa da barra aparecia
  // por cima de folhas que o operador acabara de abrir.
  //
  // A pergunta é feita NO LUGAR DA BARRA, que é o único ponto em que a camada
  // pinta com a Biblioteca fechada.
  for (const [nome, abrir] of [
    ['a folha de Configurações', 'openFadePopup()'],
    ['a folha da playlist', 'openPlPopup()'],
  ]) {
    const r = await pg.evaluate(async (cmd) => {
      // eslint-disable-next-line no-eval
      eval(cmd);
      await new Promise((res) => setTimeout(res, 400));
      const b = document.querySelector('.lib-bar').getBoundingClientRect();
      const alvo = document.elementFromPoint(
        Math.round(b.left + b.width / 2), Math.round(b.top + b.height / 2));
      const camada = document.getElementById('hymnSearchPopup');
      const daBiblioteca = !!alvo && camada.contains(alvo);
      __avBack();
      await new Promise((res) => setTimeout(res, 400));
      return { daBiblioteca, achado: alvo ? (alvo.id || alvo.tagName + '.' + [...alvo.classList].join('.')) : 'nada' };
    }, abrir);
    checar(!r.daBiblioteca,
      'com ' + nome + ' aberta, o lugar da barra NÃO responde pela Biblioteca — '
      + 'a camada dela é o CHÃO da pilha, e não o teto (v1.5.6)', r);
  }

  // ======================================================================
  // 2 · ABERTA, O QUE SE ABRE DOS CONTROLES FICA POR CIMA
  // ======================================================================
  //
  // O segundo relato, e ele só existe desde a v1.5.4: foi ela que deixou o
  // transporte ALCANÇÁVEL com a Biblioteca aberta. O botão está lá, o toque
  // funciona, e a folha subia ATRÁS da janela — o operador toca, alguma coisa
  // acontece, e a tela não muda.
  //
  // A prova é no CENTRO da folha da playlist, não numa borda: a Biblioteca
  // ocupa a tela quase inteira, então qualquer ponto que a playlist não cubra
  // responderia por ela com toda a razão.
  const pilha = await pg.evaluate(async () => {
    openHymnSearch(false);
    await new Promise((r) => setTimeout(r, 400));
    openPlPopup();
    await new Promise((r) => setTimeout(r, 400));
    const s = document.querySelector('#plPopup .popup-sheet').getBoundingClientRect();
    const alvo = document.elementFromPoint(
      Math.round(s.left + s.width / 2), Math.round(s.top + s.height / 2));
    const daPlaylist = !!alvo && document.getElementById('plPopup').contains(alvo);
    // E O VOLTAR FECHA A DE CIMA. A tabela `POPUPS` é percorrida de trás para a
    // frente, e a Biblioteca virou a PRIMEIRA linha — as duas coisas dizem a
    // mesma ordem, e mudar uma sem a outra é o acaso que este caso mede.
    __avBack();
    await new Promise((r) => setTimeout(r, 400));
    const plFechou = !document.getElementById('plPopup').classList.contains('open');
    const libFicou = document.getElementById('hymnSearchPopup').classList.contains('open');
    closeHymnSearch();
    await new Promise((r) => setTimeout(r, 400));
    return { daPlaylist, plFechou, libFicou };
  });
  checar(pilha.daPlaylist,
    'com a Biblioteca ABERTA, a folha da playlist abre POR CIMA dela — era o '
    + 'toque que "não fazia nada" (v1.5.6)', pilha);
  checar(pilha.plFechou && pilha.libFicou,
    'e o voltar fecha a de CIMA: a playlist sai e a Biblioteca fica, que é a '
    + 'ordem que a tabela `POPUPS` diz', pilha);

  // ======================================================================
  // 3 · SEM CAIXA DE CONTROLES NA TELA, A JANELA VAI ATÉ A BASE
  // ======================================================================
  //
  // Dois relatos, uma regra. A camada termina na LINHA DA BARRA (v1.5.4) para os
  // controles ficarem à vista; quando não há controles na tela, esse recorte não
  // protege nada — e no Modo Fácil ele fazia pior, porque a `.bottombar` é
  // `display: none` lá e `--lib-caixa-h` guarda a última medida boa do modo
  // AVANÇADO. Era o *"cortando aleatoriamente"*: o número não é aleatório, é de
  // outro modo.
  //
  // **O QUE ESTE CASO NÃO ALCANÇA, dito:** não há teclado virtual num Chromium
  // de mesa, então a classe `teclado` é posta à mão. O que se prova é a metade
  // CSS — a classe produz a geometria. A metade JS é uma linha só, escrita no
  // MESMO `apply()` e no mesmo quadro que `--kb` (ver `controle.js`), de
  // propósito: um segundo dono seria um segundo instante.
  const semCaixa = await pg.evaluate(async () => {
    const medir = () => {
      const c = document.getElementById('hymnSearchPopup').getBoundingClientRect();
      const cx = document.querySelector('.bottombar');
      return {
        base: Math.round(c.bottom),
        tela: window.innerHeight,
        caixaNaTela: cx.offsetHeight > 0,
      };
    };
    openHymnSearch(false);
    await new Promise((r) => setTimeout(r, 400));
    const normal = medir();
    // ---- O TECLADO ----
    document.documentElement.style.setProperty('--kb', '300px');
    document.body.classList.add('teclado');
    await new Promise((r) => requestAnimationFrame(r));
    const comTeclado = medir();
    document.body.classList.remove('teclado');
    document.documentElement.style.setProperty('--kb', '0px');
    closeHymnSearch();
    await new Promise((r) => setTimeout(r, 400));
    // ---- O MODO FÁCIL ----
    setAppMode('simple');
    await new Promise((r) => setTimeout(r, 300));
    openHymnSearch(false);
    await new Promise((r) => setTimeout(r, 400));
    const facil = medir();
    closeHymnSearch();
    setAppMode('full');
    await new Promise((r) => setTimeout(r, 300));
    return { normal, comTeclado, facil };
  });
  checar(semCaixa.normal.base < semCaixa.normal.tela - 40 && semCaixa.normal.caixaNaTela,
    'no modo avançado sem teclado a janela PARA na linha da barra — os controles '
    + 'continuam à vista (a regra da v1.5.4 segue de pé)', semCaixa.normal);
  checar(!semCaixa.comTeclado.caixaNaTela
    && semCaixa.comTeclado.base >= semCaixa.comTeclado.tela - 300 - 2
    && semCaixa.comTeclado.base <= semCaixa.comTeclado.tela - 300 + 2,
    'com o teclado no ar a caixa de controles SAI e a janela vai até onde o '
    + 'teclado começa — a lista deixa de dividir a tela com os dois',
    semCaixa.comTeclado);
  checar(semCaixa.facil.base >= semCaixa.facil.tela - 1,
    'e no MODO FÁCIL ela usa a tela INTEIRA: sem caixa de controles, o recorte '
    + 'cortava numa altura medida no outro modo', semCaixa.facil);

  // ======================================================================
  // 4 · O CAMPO SE LIMPA AO FECHAR
  // ======================================================================
  //
  // *"ela está mantendo a palavra de filtro após ser fechada e limpando apenas
  // quando aberta"*. A limpeza na abertura era certa enquanto o campo vivia
  // DENTRO da Biblioteca; hoje a barra fica à vista o culto inteiro, e o filtro
  // da busca anterior descreve uma tela que não está mais lá.
  //
  // As DUAS metades: o campo vazio DEPOIS de fechar (o relato) e a lista de volta
  // ao acervo. Sem a segunda, limpar só o texto deixaria a Biblioteca reabrindo
  // nos resultados de uma busca cujo termo já não está escrito em lugar nenhum.
  const campo = await pg.evaluate(async () => {
    openHymnSearch(false);
    await new Promise((r) => setTimeout(r, 300));
    hymnSearchInputEl.value = 'santo';
    hymnSearchInputEl.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 300));
    const digitado = hymnSearchInputEl.value;
    closeHymnSearch();
    await new Promise((r) => setTimeout(r, 400));
    const depoisDeFechar = hymnSearchInputEl.value;
    openHymnSearch(false);
    await new Promise((r) => setTimeout(r, 400));
    const aoReabrir = hymnSearchInputEl.value;
    const acervo = !!document.querySelector('#hymnResults .coll-group, #hymnResults .lib-item');
    closeHymnSearch();
    await new Promise((r) => setTimeout(r, 300));
    return { digitado, depoisDeFechar, aoReabrir, acervo };
  });
  checar(campo.digitado === 'santo' && campo.depoisDeFechar === '',
    'o campo se limpa AO FECHAR, e não na abertura: a barra fica à vista, e o '
    + 'filtro de uma busca encerrada descreve uma tela que já não existe', campo);
  checar(campo.aoReabrir === '' && campo.acervo,
    'e a Biblioteca reabre no ACERVO — limpar só o texto deixaria os resultados '
    + 'de um termo que já não está escrito em lugar nenhum', campo);

  // ======================================================================
  // 5 · ELA PARECE UMA JANELA, E NÃO ENCOSTA NOS CONTROLES (v1.5.7)
  // ======================================================================
  //
  // *"ajuste o design da janela da biblioteca para que ela se assemelhe ao
  // design das janelas de bíblia e ferramentas. bordas curvas e tom branco como
  // base"* · *"ajustando também para que haja uma pequena margem em relação aos
  // controles quando no modo aberta, pois hoje ela fica com a base 'fundida'
  // dificultando a percepção de até onde vai a lista da biblioteca"*.
  //
  // A RÉGUA É A `.tools-sheet`, não um número: o pedido nomeia uma peça do app,
  // e um literal copiado para cá envelheceria na primeira troca de paleta —
  // envelhecendo parecendo certo.
  //
  // **E o raio só vale ABERTA.** Fechada, o que fica à vista é a BARRA, que é
  // uma linha da caixa de controles; um cartão em volta dela é o "zoneamento"
  // que a v1.5.2 veio tirar. Sem esta segunda metade, arredondar a folha nos
  // dois estados passaria na primeira e devolveria aquele defeito.
  const janela = await pg.evaluate(async () => {
    const folha = document.querySelector('.popup-sheet--lib');
    const ler = () => {
      const cs = getComputedStyle(folha);
      return { fundo: cs.backgroundColor, raio: parseFloat(cs.borderTopLeftRadius) };
    };
    closeHymnSearch();
    await new Promise((r) => setTimeout(r, 400));
    const fechada = ler();
    openHymnSearch(false);
    await new Promise((r) => setTimeout(r, 500));
    const aberta = ler();
    // A FRESTA É CONTRA A BASE DA CAMADA, e não contra a caixa de controles —
    // essa foi a primeira escrita, e ela APROVAVA a versão sem fresta: a
    // `.bottombar` reserva a altura da barra mais um respiro no `padding-top`,
    // então sobrava sempre um vão positivo que não era o que se queria medir. A
    // camada termina exatamente na linha em que a barra repousa, que é até onde
    // a janela PODERIA ir; a fresta é o que ela deixa de usar.
    const b = folha.getBoundingClientRect();
    const c = document.getElementById('hymnSearchPopup').getBoundingClientRect();
    const molde = getComputedStyle(document.getElementById('toolsSheet'));
    const r = {
      fechada, aberta, fresta: Math.round(c.bottom - b.bottom),
      moldeFundo: molde.backgroundColor, moldeRaio: parseFloat(molde.borderTopLeftRadius),
    };
    closeHymnSearch();
    await new Promise((res) => setTimeout(res, 400));
    return r;
  });
  checar(janela.aberta.fundo === janela.moldeFundo
    && janela.aberta.raio === janela.moldeRaio && janela.aberta.raio > 0,
    'ABERTA, a janela veste o MESMO tom e o MESMO raio da folha de Ferramentas '
    + '— a régua é a peça que o pedido nomeia, não um número escrito aqui',
    JSON.stringify(janela));
  checar(janela.fechada.raio === 0,
    'e FECHADA ela não tem raio: o que fica à vista é a barra, e um cartão em '
    + 'volta dela é o "zoneamento" que a v1.5.2 tirou', JSON.stringify(janela.fechada));
  checar(janela.fresta > 0 && janela.fresta < 24,
    'e há uma FRESTA entre a base dela e o fim da camada: sem ela a lista se '
    + 'funde com o transporte e não se vê onde a Biblioteca acaba',
    janela.fresta + 'px');

  // ======================================================================
  // 6 · A BORDA DO CAMPO ENGROSSOU SEM CRESCER A CAIXA (v1.5.7)
  // ======================================================================
  //
  // *"engrosse a borda da caixa de texto da busca, para ficar mais encorpado
  // (não aumente as dimensões da caixa, só a área da borda internamente)"*.
  //
  // As DUAS metades, e a segunda é o pedido literal: um traço mais grosso sem
  // `box-sizing: border-box` empurra a caixa para fora e a linha inteira cresce
  // com ela — o campo fica mais alto que os quadrados ao lado, que continuam
  // vestindo a medida crua.
  const borda = await pg.evaluate(() => {
    const c = document.getElementById('hymnSearchInput');
    const cs = getComputedStyle(c);
    return {
      largura: parseFloat(cs.borderTopWidth),
      caixa: cs.boxSizing,
      alt: Math.round(c.getBoundingClientRect().height),
      altBotao: Math.round(document.getElementById('hymnSearchToggle').getBoundingClientRect().height),
    };
  });
  checar(borda.largura >= 2,
    'a borda do campo tem corpo (' + borda.largura + 'px)', JSON.stringify(borda));
  checar(borda.caixa === 'border-box' && Math.abs(borda.alt - borda.altBotao) <= 1,
    'e ela cresceu PARA DENTRO: a caixa continua com a altura dos quadrados ao '
    + 'lado', JSON.stringify(borda));

  await ctx.close();
  checar(erros.length === 0, 'nenhum erro de console', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) {
  console.log('\n' + falhas.length + ' FALHA(S)');
  process.exit(1);
}
console.log('\nTodos passaram.');
