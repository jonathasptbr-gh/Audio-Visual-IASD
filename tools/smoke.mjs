// Fumaça do Controle: abre a base web num Chromium de verdade, deixa o app
// inicializar, entra em Configurações e usa o botão de copiar o Registro.
//
// ## Por que ele existe
//
// O CI já roda `node --check` em todo o bundle, e isso NÃO É SUFICIENTE: ele
// prova que os arquivos são parseáveis, não que o app funciona. A v5.121 saiu
// com o botão de copiar chamando `copiarTexto`, uma função que uma limpeza
// tinha apagado junto com o bloco em que ela morava — sintaxe perfeita, botão
// morto, e o operador descobriu no aparelho.
//
// Este teste pega exatamente essa classe: referência a coisa que não existe,
// erro na inicialização, handler que estoura ao ser tocado. Ele falha se
// QUALQUER erro de console ou exceção de página aparecer no caminho.
//
// ## O que ele não é
//
// Não é teste de comportamento do culto. Sem `__AVBridge` a base roda em modo
// navegador — sem Presentation, sem ponte, sem YouTube nativo. É de propósito:
// o que se verifica aqui é o que vale nos dois contextos, e é justamente onde
// um erro derruba o app inteiro antes de qualquer recurso nativo entrar.
//
//   node tools/smoke.mjs
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
  // Não servir nada fora da base web, mesmo num teste local.
  if (!arquivo.startsWith(RAIZ) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
    res.writeHead(404); res.end('nao'); return;
  }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream' });
  fs.createReadStream(arquivo).pipe(res);
});

const falhas = [];
// O TERCEIRO ARGUMENTO É IMPRESSO, como nos outros treze oráculos.
//
// Ele era DESCARTADO aqui: as chamadas já passavam o que viram (qual ponto do
// hit-test caiu fora, quantos botões sobraram na linha), a medição custava a
// mesma corrida, e a assinatura de dois parâmetros jogava tudo fora. O efeito
// aparece no lugar onde mais dói: no CI, onde ninguém pode abrir o navegador —
// a reprovação chegava como uma frase e nada mais, e diagnosticá-la exigia
// adivinhar ou publicar um lote só para instrumentar.
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
// `PW_CHROMIUM` aponta o binário quando ele não está onde o Playwright o
// procura (é o caso do ambiente de desenvolvimento deste projeto). Vazio ou
// ausente, vale o download que o próprio Playwright gerencia — que é o caso do
// runner do CI.
const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
// `hasTouch`: sem ele o contexto do Playwright não emula toque, e um
// `Input.dispatchTouchEvent` do CDP é entregue sem disparar
// `touchstart`/`touchmove` — o carrossel de abas (o único gesto de toque que
// este arquivo exercita) não teria como reagir, e o caso "passaria" por não
// medir nada. É o aparelho que este teste imita; o padrão de mesa não é.
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true });
await semRedeExterna(ctx);
// ---------- O TECLADO VIRTUAL, DE MENTIRA ----------
// Não há como abrir um teclado de sistema num Chromium headless, e o que
// interessa medir não é o teclado: é O QUE O NAVEGADOR REPORTA quando ele está
// aberto. São dois mundos, e o app precisa acertar nos dois:
//
//   · o hint `interactive-widget=resizes-content` HONRADO → a viewport de
//     LAYOUT encolhe, `window.innerHeight` diminui, e `visualViewport` a
//     acompanha. É o `setViewportSize` do Playwright, e nada a simular.
//   · o hint IGNORADO → a viewport de layout NÃO muda e só a visual encolhe (e
//     pode ser rolada para revelar o campo em foco). É o caso do WebView em
//     edge-to-edge do Android 15+, onde o `adjustResize` do manifest deixa de
//     valer — isto é, o caso do aparelho do operador. É este que se simula.
//
// A troca é do OBJETO que o navegador expõe, não de um atalho no app: o
// `keyboardShift` do `controle.js` lê `window.visualViewport` como leria no
// aparelho. Sem `__teclado` chamado, o falso espelha a viewport de verdade —
// então ele é inerte para todos os outros casos deste arquivo.
await ctx.addInitScript(() => {
  const alvo = new EventTarget();
  const falso = {
    height: 0, width: 0, offsetTop: 0, offsetLeft: 0, pageTop: 0, pageLeft: 0, scale: 1,
    addEventListener: (...a) => alvo.addEventListener(...a),
    removeEventListener: (...a) => alvo.removeEventListener(...a),
  };
  const espelhar = () => {
    if (window.__kbAberto) return;
    falso.height = window.innerHeight; falso.width = window.innerWidth; falso.offsetTop = 0;
  };
  window.addEventListener('resize', () => { espelhar(); alvo.dispatchEvent(new Event('resize')); });
  Object.defineProperty(window, 'visualViewport', { get: () => { espelhar(); return falso; }, configurable: true });
  window.__teclado = (px, rolagem) => {
    window.__kbAberto = px > 0;
    falso.width = window.innerWidth;
    falso.height = window.innerHeight - px;
    falso.offsetTop = rolagem || 0;
    alvo.dispatchEvent(new Event('resize'));
    alvo.dispatchEvent(new Event('scroll'));
  };
});
// `localhost` já é contexto seguro, então a Clipboard API está disponível — é o
// mesmo caminho que o app usa no aparelho (`https://appassets.…`).
try { await ctx.grantPermissions(['clipboard-read', 'clipboard-write']); } catch (_) {}
const pg = await ctx.newPage();
const base = `http://localhost:${porta}`;

const erros = [];
// SÓ os erros que são NOSSOS. Um runner sem saída para a internet (e este
// ambiente é um) derruba a IFrame API do YouTube e o acervo LouvorJA, e isso
// não diz nada sobre o bundle — o app é feito para funcionar sem rede durante
// o culto. Requisições ao próprio servidor de teste, essas, contam.
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY/;
pg.on('response', (r) => {
  if (r.status() >= 400 && r.url().startsWith(base)) erros.push('HTTP ' + r.status() + ' ' + r.url());
});
pg.on('console', (m) => {
  if (m.type() !== 'error') return;
  const t = m.text();
  if (EXTERNO.test(t)) return;
  // "Failed to load resource" sem URL: só conta se alguma resposta nossa falhou
  // (o `response` acima já a registra com o endereço).
  if (/Failed to load resource/.test(t)) return;
  erros.push(t);
});
pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));

try {
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });

  // O MESMO MARCADOR que o watchdog do OTA usa para dizer "o app está de pé"
  // (ver `otaAppIsUp` em shared/native.js): um `<li>` dentro de `#playlist` só
  // existe depois que o `init()` assíncrono terminou. Reaproveitá-lo evita
  // inventar um segundo sinal que envelheceria à parte do primeiro.
  //
  // O `<li>` ESTAVA NO COMENTÁRIO E NÃO NA CONDIÇÃO — o texto prometia o
  // marcador e o código esperava só `AVDB && createStage && __avBack`, que
  // prova PARSE e não inicialização. A diferença morde quem planta fixture:
  // o `init()` começa por `loadCollections()`, que faz `collState = {}` e
  // apaga o que o oráculo acabou de plantar. Foi assim que o
  // `acervo.test.mjs` reprovou no runner e passou em toda máquina rápida.
  await pg.waitForFunction(
    () => window.AVDB && window.createStage && typeof window.__avBack === 'function'
      && !!document.querySelector('#playlist li'),
    null, { timeout: 30000 },
  );
  checar(true, 'a base web inicializa (AVDB + createStage + __avBack + a playlist renderizada)');

  // `.click()` do DOM, não o do Playwright: o alvo do teste é o Registro, não a
  // geometria do cabeçalho. O handler executado é o mesmo.
  await pg.evaluate(() => document.getElementById('settingsBtn').click());
  await pg.waitForSelector('#fadePopup.open', { timeout: 5000 });
  checar(true, 'Configurações abre');

  // ==========================================================================
  // A GAVETA ENTRA PELA BORDA DO BOTÃO QUE A ABRE (v1.2.3)
  //
  // Pedido do operador: as duas folhas cujo botão está no ALTO — Configurações
  // (a engrenagem foi para o cabeçalho na v1.2.0) e a playlist automática (o
  // dado, na barra de busca da Biblioteca) — passam a descer do teto em vez de
  // subir da base.
  //
  // MEDIDO NO RENDERIZADO, e não pela classe: a mudança são TRÊS declarações
  // que precisam concordar (de onde ela entra, onde ela encosta e de que lado
  // ficam os cantos), e uma classe presente com uma delas faltando dá uma folha
  // colada no teto com o raio embaixo — um cartão fora de lugar, que nenhuma
  // asserção sobre `classList` pegaria.
  //
  // E AS DE BAIXO ENTRAM NA MESMA MEDIÇÃO. Sem elas isto não seria uma regra de
  // ORIGEM, seria "toda folha nasce no teto" — e a metade que prova a regra é
  // justamente a que NÃO mudou.
  // A MEDIDA ESPERA A TRANSIÇÃO TERMINAR, e espera pelo FATO (nenhuma animação
  // correndo), nunca pelo valor que ela vai afirmar — esperar pela posição zero
  // para depois afirmar que ela é zero é escrever uma tautologia. A folha entra
  // deslizando em 0,3 s; medida no meio do caminho ela responde o ponto de
  // partida (MEDIDO: -537px de 900), que é o transform, não o layout.
  const gaveta = async (sel) => {
    await pg.waitForFunction((s2) => {
      const el = document.querySelector(s2 + ' .popup-sheet');
      return !!el && el.getAnimations().every((a) => a.playState !== 'running');
    }, sel, { timeout: 5000 });
    return pg.$eval(sel + ' .popup-sheet', (el) => {
      const r = el.getBoundingClientRect();
      return {
        topo: Math.round(r.top),
        base: Math.round(window.innerHeight - r.bottom),
        raio: getComputedStyle(el).borderRadius,
      };
    });
  };
  const cfg = await gaveta('#fadePopup');
  checar(cfg.topo === 0 && cfg.base > 0,
    'Configurações ENCOSTA NO TETO — o botão dela está no topo da tela', cfg);
  checar(/^0px 0px \S+ \S+$/.test(cfg.raio),
    'e os cantos arredondados são os DE BAIXO: é o raio que diz por onde ela sai',
    cfg.raio);

  // O REGISTRO NÃO TEM MAIS VISOR (v5.207): a caixa `<pre>` gastava 240px de
  // espaço sempre visível em Configurações para exibir, em fonte de 0,68rem, um
  // log cujo consumidor é um humano A DISTÂNCIA — ele é copiado, não lido aqui.
  // Então o que se afirma passou a ser o que de fato importa: **o texto existe
  // e é o que o botão entrega**.
  const temRegistro = await pg.evaluate(() => typeof diagTexto === 'string' && diagTexto.length > 0);
  checar(temRegistro, 'o Registro é montado (o texto que o botão copia existe)');

  checar(await pg.$('#diagBox') === null,
    'e não há mais visor ocupando espaço sempre visível na folha');

  // E A FOLHA CABE NA TELA. Era esta a queixa do operador — as linhas que ele de
  // fato ajusta (tema, preenchimento, wallpaper) ficavam abaixo da dobra por
  // causa da caixa de log. Medir a rolagem é medir a queixa.
  const precisaRolar = await pg.$eval('#fadePopup .popup-sheet',
    (el) => el.scrollHeight > el.clientHeight + 1);
  checar(!precisaRolar, 'Configurações cabe sem rolar');

  // ---- E O CORPO TAMBÉM NÃO ROLA (v1.4.38) ----
  // A asserção acima mede a FOLHA, e a folha nunca rolou: quem tem
  // `overflow-y: auto` é o `.fade-opts`, e é ele que crescia por baixo. Era
  // isso que o operador via — *"uma disposição de grade, para que tenha mais
  // opções e não precise de scroll"* —, e o oráculo antigo aprovava as duas
  // versões. MEDIDO nesta viewport (430×900), com a grade: o corpo cabe.
  //
  // O TILE DA MEDIÇÃO fica de fora desta conta por construção (ele é `hidden`
  // no navegador), e é o único — a folha do aparelho tem uma opção a mais, na
  // mesma fileira que já existe.
  const corpo = await pg.$eval('#fadePopup .fade-opts', (el) => ({
    rola: el.scrollHeight > el.clientHeight + 1,
    alto: Math.round(el.scrollHeight),
    cabe: Math.round(el.clientHeight),
  }));
  checar(!corpo.rola,
    'e o CORPO dela também cabe — quem rola é o `.fade-opts`, não a folha',
    JSON.stringify(corpo));

  // ---- A GRADE É UMA GRADE, e os tiles alternam ----
  // A GEOMETRIA (três colunas — uma grade de uma coluna é a pilha de faixas de
  // volta, com outro nome e o mesmo scroll) e o ESTADO ESCRITO (`data-estado`,
  // que é o que a pintura promete e o que os outros oráculos leem).
  const grade = await pg.evaluate(async () => {
    const g = document.querySelector('.qs-grade');
    const cols = g ? getComputedStyle(g).gridTemplateColumns.trim().split(/\s+/).length : 0;
    const tile = document.getElementById('fitTile');
    const sonda = () => ({
      estado: tile.dataset.estado,
      aceso: tile.classList.contains('qs-on'),
      alt: tile.classList.contains('qs-alt'),
      cor: getComputedStyle(tile).backgroundColor,
    });
    // SEM PRAZO NENHUM, e isso é a regra ("um oráculo não pode medir o runner"):
    // `pintarTile` roda SÍNCRONO dentro do ouvinte, antes do primeiro `await` do
    // `applyFit` — a gravação no banco vem depois e não é o que se mede aqui.
    // Um `setTimeout` no meio disto seria uma aposta na carga da máquina para
    // observar um efeito que já aconteceu.
    const antes = sonda();
    tile.click();
    const depois = sonda();
    tile.click();
    const volta = sonda();
    // E O QUE FICOU GRAVADO. Duas coisas de uma vez, e a segunda é higiene do
    // próprio oráculo: prova que o tile PERSISTE o que mostra (`applyFit`
    // grava, e uma pintura que não gravasse voltaria ao abrir o app), e ASSENTA
    // as duas transações que os cliques deixaram em voo — esta leitura entra na
    // fila depois delas, então nada deste bloco escorre para as medições
    // seguintes. É um sinal do app, não um prazo.
    const guardado = await AVDB.getState('fit');
    return { cols, tiles: document.querySelectorAll('.qs-tile').length, antes, depois, volta, guardado };
  });
  checar(grade.cols === 3,
    'a grade tem TRÊS colunas — uma coluna só é a pilha de faixas de volta',
    'colunas: ' + grade.cols);
  checar(grade.tiles >= 6,
    'e ela hospeda os tiles do painel (o da medição é `hidden` no navegador)',
    'tiles: ' + grade.tiles);
  checar(grade.antes.estado === 'contain' && grade.depois.estado === 'cover'
    && grade.volta.estado === 'contain',
    'o tile ALTERNA e volta — é um interruptor, não um segmento de um par',
    JSON.stringify([grade.antes.estado, grade.depois.estado, grade.volta.estado]));
  checar(grade.guardado === 'contain',
    'e o que ele mostra é o que fica GRAVADO — uma pintura sem gravação voltaria '
    + 'ao padrão na abertura seguinte',
    'state.fit: ' + JSON.stringify(grade.guardado));

  // ---- QUEM NÃO TEM "DESLIGADO" FICA SEMPRE ACESO (v1.4.39) ----
  // Pedido do operador: *"a maioria dos botões das configurações não tem estado
  // de ativo e inativo… então pode deixar eles no estado azul de 'sempre ativo'
  // o tempo todo"*. Apagado, no vocabulário deste app, quer dizer
  // INDISPONÍVEL — é a queixa da v1.4.25 (*"foi simplesmente ofuscado o botão
  // inteiro"*), e escolher "Ajustar" não desliga coisa nenhuma.
  //
  // DUAS METADES QUE SÓ JUNTAS DIZEM A REGRA, e a segunda é a que impede o
  // conserto preguiçoso (acender TUDO, sempre): o preenchimento fica aceso nos
  // dois estados **e troca de desenho**, e o fundo da letra continua APAGANDO
  // quando a função está desligada. Sem a primeira, o pedido não foi atendido;
  // sem a segunda, o painel perde a única linguagem de ligado/desligado que
  // sobrou.
  checar(grade.antes.aceso && grade.depois.aceso && grade.antes.cor === grade.depois.cor,
    'o PREENCHIMENTO fica aceso nos dois estados — ele não tem "desligado", e '
    + 'apagado ali se lê como indisponível',
    JSON.stringify([grade.antes.cor, grade.depois.cor]));
  checar(!grade.antes.alt && grade.depois.alt,
    'e mesmo aceso o tempo todo ele TROCA DE DESENHO: `qs-alt` responde "qual '
    + 'desenho?" e `qs-on` responde "está ligado?" — enquanto foram a mesma '
    + 'classe, um tile sempre aceso ficava preso no desenho alternativo',
    JSON.stringify([grade.antes.alt, grade.depois.alt]));
  const liga = await pg.evaluate(() => {
    const t = document.getElementById('lyricsBgTile');
    const sonda = () => ({
      estado: t.dataset.estado,
      aceso: t.classList.contains('qs-on'),
      alt: t.classList.contains('qs-alt'),
      cor: getComputedStyle(t).backgroundColor,
    });
    const antes = sonda();
    t.click();
    const depois = sonda();
    t.click();
    return { antes, depois, volta: sonda() };
  });
  checar(liga.antes.estado === 'image' && liga.antes.aceso && !liga.antes.alt
    && liga.depois.estado === 'black' && !liga.depois.aceso && liga.depois.alt,
    'e o FUNDO DA LETRA continua apagando — ele TEM desligado, e o desenho '
    + 'riscado e a luz apagada dizem a mesma coisa',
    JSON.stringify([liga.antes, liga.depois]));
  checar(liga.antes.cor !== liga.depois.cor,
    'na cor RENDERIZADA: a classe sem a regra de CSS passaria num teste de '
    + 'classe e continuaria invisível na tela',
    JSON.stringify([liga.antes.cor, liga.depois.cor]));
  checar(liga.volta.estado === 'image' && liga.volta.aceso,
    'e ele volta com o segundo toque, sem deixar o acervo com a letra sobre preto');

  // ---- E A ORDEM É POR NATUREZA: os sempre-acesos no topo (v1.4.39) ----
  // *"ajuste para que esses itens que não se ativam fiquem no topo da listagem
  // e deixe os outros mais em baixo"*. A asserção é sobre a ORDEM DO DOCUMENTO,
  // que numa grade row-major é a ordem que se lê — e não sobre a posição em
  // pixels, que mediria a largura da tela junto.
  const ordem = await pg.$eval('.qs-grade',
    (g) => [...g.children].map((e) => e.id));
  const fixos = ['temaTile', 'fitTile', 'wallTile', 'histOpenRow'];
  const alterna = ['lyricsBgTile', 'rotBtn', 'farolTile'];
  checar(JSON.stringify(ordem) === JSON.stringify(fixos.concat(alterna)),
    'os tiles SEM "desligado" vêm primeiro e os que ligam e desligam depois',
    JSON.stringify(ordem));

  // O QUE A v5.121 QUEBROU: o clique chamava uma função apagada. Um handler que
  // estoura não muda nada na tela — daí conferir o efeito (o pulso de
  // confirmação), e não só a ausência de erro.
  await pg.evaluate(() => document.getElementById('diagCopy').click());
  await pg.waitForTimeout(300);
  const pulsou = await pg.$eval('#diagCopy', (el) => el.classList.contains('btn-pulso'));
  checar(pulsou, 'o botão de copiar o Registro responde ao toque');

  // ==========================================================================
  // NÃO EXISTE ALERTA FLUTUANTE (v5.207) — e este é o oráculo da regra.
  //
  // O app já removeu um toast uma vez, e no lugar dele nasceu `avisar()`, cujo
  // próprio comentário afirmava "não flutua". O CSS dizia `position: fixed;
  // top: .5rem; z-index: 400`: era um toast com outro nome, e 35 pontos do app
  // respondiam por ele — sempre no topo da tela, para toques dados no rodapé,
  // no meio de uma lista ou dentro de uma folha aberta.
  //
  // Sem um teste, a terceira encarnação nasce na primeira vez que alguém
  // precisar responder a uma ação e não achar onde. A régua aqui é estrutural,
  // não de nome: **nenhum elemento fixo por cima da interface que não seja uma
  // folha/cortina/diálogo** — porque o próximo toast pode se chamar qualquer
  // coisa.
  // ==========================================================================
  await pg.evaluate(() => document.getElementById('fadePopupClose').click());
  await pg.waitForTimeout(250);

  // ---- A OUTRA METADE DA REGRA DE ORIGEM: as de BAIXO continuam subindo ----
  // Sem ela isto deixaria de ser "a gaveta entra pela borda do botão" e viraria
  // "toda folha nasce no teto" — e a metade que PROVA a regra é justamente a
  // que não mudou. Os botões destas duas moram na barra de controles, na base.
  for (const [abrir, sel, nome] of [
    [() => openPlPopup(), '#plPopup', 'a playlist'],
    [() => openHistPopup(), '#histPopup', 'o histórico'],
  ]) {
    await pg.evaluate(abrir);
    const g = await gaveta(sel);
    checar(g.base === 0 && g.topo > 0,
      nome + ' continua SUBINDO da base — o botão dela mora na barra de baixo', g);
    checar(/^\S+ \S+ 0px 0px$/.test(g.raio),
      'e com os cantos arredondados EM CIMA, do lado por onde ela sai', g.raio);
    await pg.evaluate((s2) => document.querySelector(s2).classList.remove('open'), sel);
    await pg.waitForTimeout(250);
  }

  checar(await pg.evaluate(() => typeof avisar === 'undefined'),
    'a função da faixa flutuante não existe mais');
  checar(await pg.$('#saveHint') === null, 'e nem o elemento dela');

  const flutuantes = await pg.evaluate(() => {
    // Os fixos LEGÍTIMOS: as folhas e o diálogo (que tomam o foco e pedem um
    // toque), a cortina do Modo Fácil, o próprio modo, e a barra de baixo.
    // O DIÁLOGO DO APP entra na lista: ele não é uma faixa que passa — toma o
    // foco, escurece o resto e exige um toque. É o canal do único caso sem
    // interface de origem (um compartilhamento que chega de fora e falha
    // inteiro); ver `registrarShareNativo`.
    const OK = ['popup-backdrop', 'popup-sheet', 'simple', 'simple-veil', 'bottombar',
      'appDialog', 'dialog-card', 'tab-ghost', 'selbar'];
    const achados = [];
    document.querySelectorAll('body *').forEach((el) => {
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed') return;
      const z = parseInt(cs.zIndex, 10) || 0;
      if (z < 100) return;                       // não disputa com o conteúdo
      const cls = el.className.toString();
      if (OK.some((k) => cls.includes(k) || (el.id || '').includes(k))) return;
      achados.push((el.id || cls || el.tagName).slice(0, 40));
    });
    return achados;
  });
  checar(flutuantes.length === 0,
    'nenhuma camada flutuante sobrou por cima da interface' + (flutuantes.length ? ' (achei: ' + flutuantes.join(', ') + ')' : ''));

// ── NENHUM CONTORNO, MEDIDO NO RENDERIZADO (v5.267) ──────────────────────
// A metade que faltava, e ela é a que o operador encontrou primeiro: *"os
// botões agora estão usando o sistema de sombras nativo padrão do sistema, isso
// está criando um contorno bicolor no geral nos botões que foi removido as
// linha de borda"*.
//
// `tools/tokens.test.mjs` varre a FONTE e prova que nenhuma regra NOSSA desenha
// contorno. Isso não basta, e o primeiro corte da v5.267 provou por quê: **o
// padrão do navegador não é "sem borda"**. A folha do UA dá a todo `<button>`
// um `border: 2px outset` e a todo campo um `2px inset` — e `outset` é um
// bisel, isto é, DUAS cores. Tirar a nossa declaração não removia borda
// nenhuma; deixava passar a dele. Um oráculo de fonte é estruturalmente cego
// para isso, porque o defeito é a AUSÊNCIA de uma declaração.
//
// A varredura é do computado, sobre as telas que o arquivo já abriu, e conta
// só o que DESENHA: largura > 0 com cor não transparente. Os dois desenhos de
// borda do app são pseudo-elementos (`.dl-ring::before`, o ✓ do seletor), e
// `querySelectorAll` não os alcança — eles ficam de fora sem precisar de
// exceção.
try {
  const contornos = await pg.evaluate(async () => {
    const achados = new Set();
    const varrer = () => {
      for (const el of document.querySelectorAll('*')) {
        const c = getComputedStyle(el);
        const w = ['Top', 'Right', 'Bottom', 'Left'].map((s) => parseFloat(c['border' + s + 'Width']) || 0);
        if (!w.some((x) => x > 0)) continue;
        if (/rgba\(0, 0, 0, 0\)/.test(c.borderTopColor)) continue;
        achados.add((el.tagName.toLowerCase() + '.' + [...el.classList].join('.')).slice(0, 48)
          + ' → ' + w[0] + 'px ' + c.borderTopStyle);
      }
    };
    // As telas em que moram os controles — é aqui que a cobertura mora, e é por
    // isso que o caso ABRE cada uma em vez de medir só a inicial: os botões que
    // o operador viu (transporte, mixer) e os que só existem numa aba
    // (segmentados, chips, campos das Ferramentas) nunca estão na mesma tela.
    setAppMode('full'); varrer();
    for (const aba of ['bible', 'misc', 'playlist']) {
      try { switchTab(aba); } catch (e) { /* aba que não existe neste bundle */ }
      await new Promise((r) => setTimeout(r, 60));
      varrer();
    }
    openHymnSearch(); await new Promise((r) => setTimeout(r, 200)); varrer();
    closeHymnSearch(); await new Promise((r) => setTimeout(r, 100));
    openFadePopup(); await new Promise((r) => setTimeout(r, 150)); varrer();
    setAppMode('simple'); await new Promise((r) => setTimeout(r, 100)); varrer();
    setAppMode('full');
    return [...achados];
  });
  checar(contornos.length === 0,
    'e nenhum elemento RENDERIZADO desenha borda — nem a que o navegador põe '
    + 'sozinha em todo <button>',
    contornos.join('\n        '));
} catch (e) {
  checar(false, 'a varredura de contorno terminou sem exceção (' + (e && e.message) + ')');
}

  // E O CONTRÁRIO — os canais in-place existem. Sem esta metade, apagar o
  // feedback inteiro passaria no teste acima.
  const canais = await pg.evaluate(() => ({
    linha: typeof notaNoItem === 'function',
    botao: typeof pulsar === 'function',
    pasta: typeof statusPasta === 'function',
    // `falarNoOta` desde a v5.245: o rótulo de versão deixou de ser o alvo
    // (ele voltou a ser só um indicador) e quem responde é o botão de
    // atualização, no mesmo rodapé. O canal continua sendo o mesmo idioma —
    // a resposta nasce onde o toque nasceu.
    ota: typeof falarNoOta === 'function',
  }));
  checar(canais.linha && canais.botao && canais.pasta && canais.ota,
    'e os canais que responderam no lugar dela estão de pé (linha, botão, pasta, botão de atualização)');

  const copiado = await pg.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  checar(copiado.includes('Linha do tempo'), 'e o texto do Registro foi para a área de transferência');

  // ---- O EMPILHAMENTO DOS POPUPS ANINHADOS -------------------------------
  //
  // Um popup que abre DE DENTRO de outro precisa de um degrau próprio de
  // z-index: com o mesmo valor, quem decide é a ordem do documento, e esse
  // acaso já cobriu um popup por inteiro mais de uma vez neste arquivo. O
  // sintoma nunca é "está por baixo" — é "o toque não faz nada", ou, no caso
  // do leitor de QR, uma câmera acesa e imagem nenhuma na tela.
  //
  // O `controle.css` pedia atenção num comentário, e o comentário não bastou:
  // o leitor de QR nasceu no 200 padrão, um degrau ABAIXO da folha do espelho
  // que o abre. Por isso a regra virou asserção — ela custa três linhas e
  // pega uma classe inteira de defeito que só aparece em aparelho.
  const ANINHADOS = [
    // (Nenhum par hoje. O `songMenuPopup`/`folderPopup` saiu na v5.254 com o
    // seletor de pastas; o `castPopup`/`mirrorPopup` na v5.196, com a folha de
    // "Ajustes avançados"; o `mirrorPopup`/`qrPopup` na v5.185, com o leitor de
    // QR. A lista fica VAZIA de propósito: o próximo popup que abrir de dentro
    // de outro entra aqui numa linha, e é essa linha que impede o defeito de
    // voltar.)
  ];
  // (A regra
  // continua valendo para todo popup aninhado que existir — foi ela que pegou o
  // leitor nascendo um degrau ABAIXO da folha que o abria, com o sintoma sendo
  // uma câmera acesa e imagem nenhuma.)
  const z = await pg.evaluate((pares) => pares.map(([pai, filho]) => {
    const v = (id) => {
      const e = document.getElementById(id);
      return e ? parseInt(getComputedStyle(e).zIndex, 10) || 0 : NaN;
    };
    return { pai, filho, zPai: v(pai), zFilho: v(filho) };
  }), ANINHADOS);
  z.forEach((p) => {
    checar(p.zFilho > p.zPai,
      'o popup `' + p.filho + '` fica ACIMA do `' + p.pai + '`, de onde ele abre'
      + ' (' + p.zFilho + ' > ' + p.zPai + ')');
  });

  // Um `#rrggbb` de token vira o `rgb(...)` que o `getComputedStyle` devolve —
  // as asserções comparam o RENDERIZADO com o token resolvido, nunca com um
  // literal copiado para cá. (Ele mora acima dos dois blocos que o usam: era
  // declarado no segundo, e o primeiro passou a precisar dele na v5.224.)
  const paraRgb = (hex) => {
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    return m ? 'rgb(' + parseInt(m[1], 16) + ', ' + parseInt(m[2], 16) + ', ' + parseInt(m[3], 16) + ')' : hex;
  };

  // ---- A SEÇÃO DE CONEXÃO SEGUE O PADRÃO DO APP (v5.175) -----------------
  //
  // O `tools/tokens.test.mjs` prova que nenhum `var(--x)` aponta para um token
  // inexistente; este prova o efeito RENDERIZADO, que é o que o operador vê.
  // Os dois botões da folha "Conectar uma tela" pediam `var(--radius-md)` — um
  // token que nunca existiu —, e um `var()` inválido sem fallback computa para
  // o valor INICIAL da propriedade: eram os únicos cantos retos de um app
  // inteiro arredondado, na primeira tela do recurso mais novo.
  const padrao = await pg.evaluate(() => {
    const cast = document.getElementById('castPopup');
    if (cast) cast.classList.add('open');
    const raio = (sel) => {
      const el = document.querySelector(sel);
      return el ? parseFloat(getComputedStyle(el).borderTopLeftRadius) : NaN;
    };
    const cor = (sel, prop) => {
      const el = document.querySelector(sel);
      return el ? getComputedStyle(el)[prop] : '';
    };
    // AS DUAS FORMAS DE CONECTAR SÃO BOTÕES IRMÃOS (v5.226) — a segunda era um
    // interruptor. O que se mede aqui é que elas são a MESMA peça desligadas
    // (mesmo raio, mesmo preenchimento) e peças DIFERENTES ligadas, porque o
    // estado é a única coisa que as separa.
    const net = document.getElementById('castNetBtn');
    const fundoNet = () => getComputedStyle(net).backgroundColor;
    const netOff = net ? fundoNet() : '';
    if (net) net.classList.add('ligado');
    const netOn = net ? fundoNet() : '';
    if (net) net.classList.remove('ligado');
    const r = {
      acao: raio('.cast-acao'), interruptor: raio('#castNetBtn'), endereco: raio('.cast-addr'),
      netOff, netOn,
      liveFill: getComputedStyle(document.documentElement).getPropertyValue('--live-fill').trim(),
      acaoFundo: cor('.cast-acao', 'backgroundColor'), acaoTexto: cor('.cast-acao', 'color'),
      // O valor do token, resolvido pelo navegador — a asserção compara o
      // RENDERIZADO com ele, e não com um literal copiado para cá.
      accentFill: getComputedStyle(document.documentElement).getPropertyValue('--accent-fill').trim(),
      onAccent: getComputedStyle(document.documentElement).getPropertyValue('--on-accent').trim(),
    };
    if (cast) cast.classList.remove('open');
    return r;
  });
  checar(padrao.acao > 0 && padrao.interruptor > 0,
    'os dois botões da folha de conectar são arredondados como o resto do app'
    + ' (' + padrao.acao + 'px / ' + padrao.interruptor + 'px)');
  checar(padrao.acao === padrao.interruptor && padrao.netOff === padrao.acaoFundo,
    'e DESLIGADOS eles são a mesma peça — mesmo raio, mesmo preenchimento',
    padrao.netOff + ' × ' + padrao.acaoFundo);
  // v5.267: o contorno vermelho virou PREENCHIMENTO vermelho. O que a asserção
  // afirma não mudou de sentido — ligada, a peça troca de cor e passa a vestir a
  // família do "está no ar" —, e continua sendo lida do token, não de um literal.
  checar(padrao.netOn !== padrao.netOff && padrao.netOn === paraRgb(padrao.liveFill),
    'LIGADA, a transmissão troca o preenchimento pelo VERMELHO de "no ar"'
    + ' (' + padrao.netOn + ')');

  // ---- E A FOLHA CRESCE EM VEZ DE SALTAR (v5.226) ------------------------
  //
  // O bloco do endereço aparece e some com a transmissão. Medido aqui pelo que
  // decide o salto: a ALTURA do bloco com e sem a classe que o abre. Recolhido
  // ele tem de valer zero — se um dia alguém trocar o `grid-template-rows` por
  // um `display: none`, o número continua zero mas a transição morre, e é por
  // isso que a segunda metade da asserção pergunta pela propriedade.
  const cresce = await pg.evaluate(async () => {
    const cast = document.getElementById('castPopup');
    cast.classList.add('open');
    const bloco = document.getElementById('castLive');
    bloco.classList.remove('aberto');
    const fechado = bloco.getBoundingClientRect().height;
    bloco.classList.add('aberto');
    // A ESPERA É A PRÓPRIA AFIRMAÇÃO: medir no mesmo turno devolveria zero
    // justamente PORQUE a altura é animada (a transição começa em 0fr). O
    // primeiro rascunho deste caso reprovou por isso, e a leitura certa é que
    // ele estava medindo o quadro inicial de uma animação que existe.
    await new Promise((r) => setTimeout(r, 420));
    const aberto = bloco.getBoundingClientRect().height;
    bloco.classList.remove('aberto');
    cast.classList.remove('open');
    return { fechado, aberto, transicao: getComputedStyle(bloco).transitionProperty };
  });
  checar(cresce.fechado < 1 && cresce.aberto > 20,
    'o bloco do endereço vale ZERO recolhido e tem altura aberto ('
    + cresce.fechado.toFixed(1) + 'px → ' + cresce.aberto.toFixed(1) + 'px)');
  checar(/grid-template-rows/.test(cresce.transicao),
    'e o que muda entre os dois é uma propriedade ANIMÁVEL — a folha cresce, não salta',
    cresce.transicao);
  checar(padrao.endereco > 0,
    'e o bloco do endereço também (raio ' + padrao.endereco + 'px)');

  // ---- E O ÂMBAR É O DA PALETA, NO PAPEL CERTO (v5.184) -----------------
  //
  // `--accent` e `--accent-fill` têm valores diferentes de propósito: o
  // primeiro é claro (para ser TEXTO sobre fundo escuro) e o segundo é escuro
  // (para RECEBER texto). Trocá-los não quebra nada de forma visível no CI —
  // sai um botão âmbar-claro com texto quase branco por cima, abaixo do piso
  // de contraste, e só um par de olhos no aparelho notaria. Daí a asserção.
  checar(padrao.acaoFundo === paraRgb(padrao.accentFill)
    && padrao.acaoTexto === paraRgb(padrao.onAccent),
    'o botão principal da folha é preenchido em --accent-fill com --on-accent por cima'
    + ' (' + padrao.acaoFundo + ' / ' + padrao.acaoTexto + ')');

  // ---- O ÍCONE DE CONECTAR DIZ "HÁ TELA RECEBENDO" (v5.176) --------------
  //
  // Ele tomou o lugar do cartão do espelho na barra de notificações — aquele
  // não pode ser removido (um serviço em primeiro plano é obrigado a ter uma
  // notificação, e é ele que mantém o espelho no ar com o app minimizado), mas
  // foi para `IMPORTANCE_MIN` e saiu da barra de status. Se o ícone não
  // acender, o operador fica sem NENHUM sinal de que há telas na rede — a troca
  // teria piorado o que veio consertar.
  //
  // Mesma classe do telão (`.connected`), de propósito: uma convenção só para
  // um fato só.
  const cast = await pg.evaluate(() => {
    const btn = document.getElementById('pvCastBtn');
    if (!btn) return { achou: false };
    const antes = mirrorEstado;
    const ler = () => { renderCastBtn(); return btn.classList.contains('connected'); };
    mirrorEstado = null;
    const desligado = ler();
    mirrorEstado = { ligado: true, telas: [] };
    const semTela = ler();
    mirrorEstado = { ligado: true, telas: [{ rotulo: 'A' }, { rotulo: 'B' }] };
    const comTelas = ler();
    const dica = btn.title;
    mirrorEstado = antes;
    renderCastBtn();
    return { achou: true, desligado, semTela, comTelas, dica };
  });
  checar(cast.achou, 'o ícone de conectar existe na preview');
  checar(cast.achou && !cast.desligado,
    'com o espelho desligado ele fica apagado');
  checar(cast.achou && !cast.semTela,
    'ligado e sem ninguém recebendo, também — "no ar" é ter alguém do outro lado');
  checar(cast.achou && cast.comTelas,
    'e com telas da rede recebendo ele acende, como acende com um telão');
  checar(cast.achou && /rede/i.test(cast.dica || ''),
    'e a dica do botão diz quantas são', cast.dica);

  // ---- O ECO DO TRANSPORTE (v5.162) --------------------------------------
  //
  // Quando a projeção são as telas da rede, a resposta de verdade de um botão
  // do transporte está a ~1 s de distância — e um botão que fica um segundo sem
  // responder é lido como botão que não funcionou: o operador toca de novo, e o
  // comando vai duas vezes. O eco é o "recebi" imediato.
  //
  // O caso trava as duas metades da decisão. A primeira é que ele APAREÇA; a
  // segunda, e é a que se perde numa refatoração, é que ele NÃO troque o
  // conteúdo do botão — o `.btn-pulso`, que é o outro sinal do app, esconde o
  // filho para pôr um ✓ no lugar, e fazer isso com o ▶ apagaria justamente o
  // ícone que carrega o estado do transporte.
  const eco = await pg.evaluate(async () => {
    const b = document.getElementById('playpause');
    if (!b) return { achou: false };
    b.click();
    const glifo = b.querySelector('.msym');
    const visivel = glifo ? getComputedStyle(glifo).visibility : 'sem glifo';
    const tem = b.classList.contains('btn-eco');
    // v5.267: o anel virou `box-shadow` — a folha não tem mais uma única
    // declaração de contorno, e ele era a última que sobrava fora de um desenho.
    // O que se mede continua sendo "há um anel desenhado", não como ele é feito.
    const anel = tem ? getComputedStyle(b, '::before').boxShadow : '';
    await new Promise((r) => setTimeout(r, 700));
    return { achou: true, tem, visivel, anel, sumiu: !b.classList.contains('btn-eco') };
  });
  checar(eco.achou && eco.tem, 'um toque no transporte responde na hora (classe `btn-eco`)');
  checar(eco.visivel === 'visible',
    'e o eco NÃO esconde o ícone do botão — ele é anel, não ✓', eco.visivel);
  checar(!!eco.anel && eco.anel !== 'none', 'o anel do eco é de fato desenhado', eco.anel);
  checar(eco.sumiu, 'e ele sai sozinho, sem deixar o botão marcado');

  // ---- O CARROSSEL VALE DENTRO DA NAVEGAÇÃO INTERNA (v5.193) ------------
  //
  // Quarta correção do mesmo mecanismo, e as três anteriores mantinham à mão a
  // lista do que o eixo horizontal não podia atravessar. A guarda mais larga
  // era "qualquer sub-tela" (botão voltar visível): com um capítulo da Bíblia
  // aberto — o estado normal de quem usa a Bíblia num culto — o gesto morria
  // calado, e NADA ali disputa o eixo horizontal (`.bible-half` rola só na
  // vertical, e a própria folha declara `touch-action: pan-y`).
  //
  // O teste é o COMPORTAMENTO, com toque de verdade (CDP): um deslize sobre o
  // conteúdo de uma sub-tela tem de trocar de aba, e um deslize sobre um
  // trilho que ROLA de verdade na horizontal não pode. As duas metades
  // importam — sem a segunda, "libera tudo" passaria no teste.
  const cdp = await ctx.newCDPSession(pg);
  const deslizar = async (x0, y0, dx) => {
    const p = (x, y) => [{ x, y, radiusX: 6, radiusY: 6, force: 1, id: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: p(x0, y0) });
    for (let i = 1; i <= 6; i++) {
      await cdp.send('Input.dispatchTouchEvent',
        { type: 'touchMove', touchPoints: p(x0 + (dx * i) / 6, y0) });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await pg.waitForTimeout(120);
  };

  // O CENÁRIO É MONTADO À MÃO, e de propósito: o runner do CI não tem rede,
  // então não há livro da Bíblia para abrir nem sorteio com histórico. O que
  // mudou na v5.193 é a REGRA — "quem é dono do eixo horizontal?" —, e ela se
  // exercita com um botão voltar visível (o que caracteriza uma sub-tela) e um
  // trilho que de fato rola. Testar a regra é testar o que quebrou.
  const cenario = await pg.evaluate(() => {
    // O MODO AVANÇADO PRIMEIRO: o app abre no Modo Fácil, e ali o `<main>` está
    // atrás da tela simplificada — sem esta linha o gesto cai no vazio e o
    // teste "passa" por não medir nada.
    setAppMode('full');
    // E A FOLHA DE CONFIGURAÇÕES SAI DA FRENTE: ela foi aberta lá em cima e
    // ninguém a fechou. Com ela no ar o toque pousa no popup, o `<main>` nem
    // vê o gesto, e o caso falha por um motivo que não é o que ele mede.
    closeFadePopup();
    switchTab('imports');
    // Sub-tela: era ESTA condição, sozinha, que matava o gesto no conteúdo.
    document.getElementById('backBtn').hidden = false;
    const m = document.querySelector('main');
    const r = m.getBoundingClientRect();
    return { aba: activeTab, x: r.x + r.width / 2, y: r.y + Math.min(r.height / 2, 160) };
  });
  await deslizar(cenario.x + 90, cenario.y, -160);
  const depoisDoDeslize = await pg.evaluate(() => activeTab);
  checar(depoisDoDeslize !== cenario.aba,
    'com uma sub-tela aberta (voltar visível), deslizar no conteúdo TROCA de aba'
    + ' (' + cenario.aba + ' → ' + depoisDoDeslize + ')');

  // E o outro lado, que é o que impede a correção de virar "libera tudo": um
  // elemento que ROLA de verdade na horizontal fica com o gesto.
  const trilho = await pg.evaluate(() => {
    const m = document.querySelector('main');
    const t = document.createElement('div');
    t.id = 'trilhoDeTeste';
    t.style.cssText = 'overflow-x:auto;display:flex;white-space:nowrap;height:80px';
    t.innerHTML = '<div style="min-width:3000px;height:60px"></div>';
    m.insertBefore(t, m.firstChild);
    const r = t.getBoundingClientRect();
    return {
      rola: t.scrollWidth > t.clientWidth + 1,
      x: r.x + r.width / 2, y: r.y + r.height / 2, aba: activeTab,
    };
  });
  checar(trilho.rola, 'o trilho do contra-teste de fato rola na horizontal');
  await deslizar(trilho.x + 60, trilho.y, -160);
  const depoisDoTrilho = await pg.evaluate(() => {
    const t = document.getElementById('trilhoDeTeste');
    const a = activeTab;
    if (t) t.remove();
    document.getElementById('backBtn').hidden = true;
    return a;
  });
  checar(depoisDoTrilho === trilho.aba,
    'e um elemento que ROLA na horizontal fica com o gesto (' + depoisDoTrilho + ')');

  // ---- OS DOIS TEMAS, E O PALCO QUE NÃO SEGUE NENHUM (v5.192) ------------
  //
  // O tema claro é um DELTA sobre o escuro (`:root[data-tema="claro"]` em
  // tokens.css). Três coisas podem quebrar nessa montagem sem que nada
  // reclame, e as três estão travadas aqui:
  //
  // 1. **O PALCO seguir o tema.** `--stage-*`, `--wallpaper` e
  //    `--lyrics-frame-bg` moram num bloco à parte de propósito: o Display não
  //    tem tema (ele nunca escreve o atributo), mas a PREVIEW do Controle roda
  //    no documento que TEM — e ela existe para espelhar o telão. Bastaria
  //    alguém redeclarar `--stage-bg` dentro do bloco claro para a preview
  //    parar de mostrar o que a TV mostra, e nenhum outro teste veria isso.
  // 2. **A superfície não INVERTER dentro do cartão.** A regra ("flutua sobre
  //    a página, afunda dentro do cartão") virou token na v5.192 justamente
  //    para poder mudar de tema; escrita errada, o tema claro herdaria o
  //    recesso de 24% de preto do escuro e todo cartão viraria um bloco cinza.
  // 3. **A escolha não sobreviver à recarga.** Ela é lida do `localStorage`
  //    ANTES do primeiro quadro (mesma razão do modo do app); um erro aí
  //    aparece como um flash escuro a cada abertura, que é exatamente o tipo
  //    de coisa que ninguém reporta e todo mundo aguenta.
  const tema = await pg.evaluate(() => {
    const raiz = document.documentElement;
    const meta = document.getElementById('temaMeta');
    const ler = () => {
      const s = getComputedStyle(raiz);
      const v = (t) => s.getPropertyValue(t).trim();
      // Um cartão de verdade, para ver a superfície AFUNDADA em vigor.
      const cartao = document.querySelector('.fade-row');
      const sc = cartao ? getComputedStyle(cartao) : null;
      // E O PALCO PINTADO, não só os tokens dele (v5.218).
      //
      // A versão anterior comparava QUATRO NOMES de token, e o defeito passou
      // por baixo dela: os tokens do palco estavam certos, e as REGRAS do palco
      // apontavam para tokens de TEMA (`--brand`, `--live-strong`, `--bg`,
      // `--accent-glow`). No tema claro, o título do slide de capa da preview
      // era desenhado em denim escuro sobre o preto — 2,73:1, ilegível, e foi
      // assim que o operador o encontrou.
      //
      // Perguntar pela COR COMPUTADA de cada camada fecha a classe inteira: não
      // importa por qual token ela chegou, ela tem de ser a mesma nos dois
      // temas. As classes são as que o app de fato escreve (`cover`,
      // `mode-chrono chrono-over`, `mode-draw draw-rolling`) e são desfeitas na
      // mesma linha — o que se mede é a folha, não o estado da tela.
      const cor = (sel) => getComputedStyle(document.querySelector(sel)).color;
      const comClasse = (host, classes, sel) => {
        const h = document.querySelector(host);
        h.classList.add(...classes);
        const c = cor(sel);
        h.classList.remove(...classes);
        return c;
      };
      const palcoPintado = [
        comClasse('#pvLyricsContent', ['cover'], '#pvLyricsLine'),
        comClasse('#pvLyricsContent', ['cover'], '#pvLyricsNum'),
        comClasse('#pvLyricsContent', ['cover'], '#pvLyricsAux'),
        cor('#pvLyricsLine'), cor('#pvLyricsAux'),
        cor('#pvTextMain'), cor('#pvTextSub'),
        comClasse('#pvTextContent', ['mode-chrono', 'chrono-over'], '#pvTextMain'),
        comClasse('#pvTextContent', ['mode-draw', 'draw-rolling'], '#pvTextMain'),
        getComputedStyle(document.querySelector('.pv-lyrics-bg')).backgroundColor,
      ].join(' · ');
      return {
        bg: v('--bg'), texto: v('--text'), accent: v('--accent'), fill: v('--accent-fill'),
        palco: v('--stage-bg') + '|' + v('--stage-text') + '|' + v('--wallpaper')
          + '|' + v('--lyrics-frame-bg'),
        palcoPintado,
        superficie: v('--surface'),
        afundada: sc ? sc.getPropertyValue('--surface').trim() : '',
        barra: meta ? meta.getAttribute('content') : '',
      };
    };
    const escuro = ler();
    // O TEMA VIROU UM TILE que ALTERNA (v1.4.38): não há mais dois segmentos
    // para escolher um, há um botão que vai para o outro estado. O toque é o
    // mesmo do operador, e o `data-estado` é o que a pintura escreve.
    document.getElementById('temaTile').click();
    const claro = ler();
    return { escuro, claro, atributo: raiz.dataset.tema, guardado: localStorage.getItem('av.tema') };
  });
  checar(tema.escuro.bg !== tema.claro.bg && tema.escuro.texto !== tema.claro.texto,
    'trocar o tema troca fundo e texto (' + tema.escuro.bg + ' → ' + tema.claro.bg + ')');
  checar(tema.escuro.palco === tema.claro.palco,
    'e NÃO troca uma vírgula do palco — a preview continua espelhando o telão',
    tema.claro.palco);
  checar(tema.escuro.palcoPintado === tema.claro.palcoPintado,
    'nem uma vírgula do que o palco PINTA — nenhuma camada dele lê um token de tema',
    'escuro: ' + tema.escuro.palcoPintado + '\n        claro:  ' + tema.claro.palcoPintado);
  checar(tema.escuro.superficie !== tema.escuro.afundada
    && tema.claro.superficie !== tema.claro.afundada,
    'a superfície afunda dentro do cartão NOS DOIS temas'
    + ' (escuro ' + tema.escuro.superficie + ' → ' + tema.escuro.afundada
    + ' · claro ' + tema.claro.superficie + ' → ' + tema.claro.afundada + ')');
  checar(tema.escuro.accent !== tema.escuro.fill,
    'no escuro o accent de TEXTO e o de PREENCHIMENTO seguem diferentes'
    + ' (' + tema.escuro.accent + ' / ' + tema.escuro.fill + ')');
  checar(tema.escuro.barra !== tema.claro.barra && /^#[0-9a-f]{6}$/i.test(tema.claro.barra),
    'e o `theme-color` acompanha (' + tema.escuro.barra + ' → ' + tema.claro.barra + ')');
  checar(tema.atributo === 'claro' && tema.guardado === 'claro',
    'a escolha vai para o `localStorage`, de onde ela é lida antes do primeiro quadro');

  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => typeof window.__avBack === 'function', null, { timeout: 20000 });
  const depois = await pg.evaluate(() => ({
    atributo: document.documentElement.dataset.tema,
    bg: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
  }));
  checar(depois.atributo === 'claro' && depois.bg === tema.claro.bg,
    'e ela sobrevive à recarga da página (' + depois.atributo + ' · ' + depois.bg + ')');
} catch (e) {
  checar(false, 'o percurso terminou sem exceção (' + (e && e.message) + ')');
}

// ---------------------------------------------------------------------------
// O RESPIRO ENTRE ESTROFES — a leitura da letra, nos DOIS modos (v5.226)
//
// A estrutura de estrofes sempre esteve inteira (o banco entrega uma estrofe por
// entrada de `lyric`, e `lvBuildSong` desenha assim desde a v5.42) — mas o
// ESPAÇAMENTO estava invertido, e é ele que decide se a letra respira: 8,8 px
// (avançado) e 8,0 px (simples) entre estrofes DIFERENTES contra 11,4 px entre
// dois blocos da MESMA. Duas estrofes ficavam mais juntas que o miolo de uma, e
// a hierarquia se lia ao contrário.
//
// A asserção é a REGRA, não o número: uma fronteira de estrofe tem de valer o
// mesmo nos três lugares onde existe (entre slides, dentro de um slide, nos dois
// modos) e tem de ser pelo menos uma LINHA — que é literalmente o que a fonte
// codifica com `<br><br>`. Escrever o pixel aqui faria o oráculo reprovar numa
// mudança legítima de fonte; escrever a razão o mantém verdadeiro.
try {
  const gaps = await pg.evaluate(() => {
    const medir = (cls) => {
      const box = document.createElement('div');
      box.className = cls;
      box.style.cssText = 'position:fixed;left:0;top:0;width:380px;height:700px;';
      const mk = (blocos) => {
        const row = document.createElement('div');
        row.className = 'lv-row';
        for (const b of blocos) {
          const t = document.createElement('div');
          t.className = 'lv-text';
          t.textContent = b;
          row.appendChild(t);
        }
        return row;
      };
      const e1 = mk(['A1\nA2\nA3\nA4']);
      const e2 = mk(['B1\nB2', 'C1\nC2']);   // duas estrofes DENTRO de um slide
      box.appendChild(e1); box.appendChild(e2);
      document.body.appendChild(box);
      const d = e2.querySelectorAll('.lv-text');
      const cs = getComputedStyle(e1);
      const out = {
        entre: e2.getBoundingClientRect().top - e1.getBoundingClientRect().bottom,
        dentro: d[1].getBoundingClientRect().top - d[0].getBoundingClientRect().bottom,
        linha: parseFloat(cs.lineHeight),
        // A ENTRELINHA DA PRÓPRIA ESTROFE: o branco que já separa duas linhas
        // seguidas do mesmo bloco (`line-height` menos o corpo da letra). É
        // contra ELE que a fronteira precisa se destacar — ver a asserção.
        entrelinha: parseFloat(cs.lineHeight) - parseFloat(cs.fontSize),
      };
      box.remove();
      return out;
    };
    return { avancado: medir('lyricsview-body'), simples: medir('simple-lyrics') };
  });
  for (const [modo, g] of Object.entries(gaps)) {
    const detalhe = ' (entre ' + g.entre.toFixed(1) + 'px · dentro ' + g.dentro.toFixed(1)
      + 'px · entrelinha ' + g.entrelinha.toFixed(1) + 'px · linha ' + g.linha.toFixed(1) + 'px)';
    checar(g.entre >= g.dentro - 0.5,
      'no modo ' + modo + ', duas estrofes não ficam mais juntas que o miolo de uma' + detalhe);
    // A REGRA MUDOU DE PISO NA v1.1.5, e o defeito que ela impede é o MESMO.
    //
    // Era "a fronteira vale ao menos uma LINHA em branco", porque é o que a
    // fonte codifica (`<br><br>`). Com a letra em `1.4rem` uma linha em branco
    // custa 2,1rem, e três estrofes empurram a quarta para fora da tela — o
    // operador pediu o respiro menor, e o que ele revoga é o TAMANHO, não a
    // fronteira.
    //
    // O que sobrevive é o piso que sempre importou: a fronteira tem de
    // acrescentar MAIS branco do que a entrelinha que já separa duas linhas
    // seguidas da mesma estrofe. Abaixo disso, uma fronteira de estrofe fica
    // MENOS visível que uma quebra de linha comum — que é a v5.225 outra vez,
    // com outro número. E continua sendo a REGRA, nunca o pixel: escrever o
    // valor aqui faria o oráculo reprovar na próxima mudança de fonte.
    checar(g.entre >= g.entrelinha - 0.5,
      'e ela se destaca da ENTRELINHA da própria estrofe — abaixo disso a '
      + 'fronteira sumiria dentro do texto' + detalhe);
  }
  checar(Math.abs(gaps.avancado.entre - gaps.simples.entre) < 0.5,
    'e o respiro é o MESMO nos dois modos — a mesma letra não muda de ritmo');
} catch (e) {
  checar(false, 'a medição do respiro entre estrofes terminou sem exceção (' + (e && e.message) + ')');
}

// ── A ALTURA DA LINHA DE UMA FAIXA (v5.240) ──────────────────────────────
// Relato do operador: os cards da lista de um álbum estão "muito volumosos
// verticalmente, limitando o número de itens na visualização" e "ficando muito
// diferente do tamanho que já são títulos dos álbuns".
//
// Medido: a barra do álbum tinha 51,6 px e a linha de uma faixa DENTRO dele,
// 66 px — 28% mais alta que o cartão que a contém, com um passo de 71,6 px.
//
// O que este caso trava é a RAZÃO, não o pixel: escrever "51,6" faria ele
// reprovar numa mudança legítima de fonte, e a queixa nunca foi sobre um número
// — foi sobre a linha ser maior que o título. E a outra metade é o piso de
// toque: encolher até o texto trocaria densidade por erro de mira no meio de um
// culto, então o alvo do ▶ não pode cair abaixo de `--hit`.
// ===== UMA SEÇÃO DE COLEÇÃO, para os casos que medem SEÇÃO =====
//
// Até a v1.0 estes casos abriam o grupo "Hinários", que vinha de graça: os dois
// hinários moravam dentro dele. Na v1.0.1 as quatro coleções fixas subiram para
// a RAIZ (um toque a menos até a lista de faixas) e os dois cabeçalhos fixos
// deixaram de existir — sobrou só "Favoritos", que está SEMPRE aberta e que
// todo `:not(.coll-group--fav)` daqui exclui de propósito.
//
// O que estes casos afirmam é COMO UMA SEÇÃO SE DESENHA (um bloco só, a escada
// de tons, o rótulo em caixa alta), não QUAL seção existe. Então a seção passa a
// ser semeada: uma categoria de álbum, criada uma vez e mantida pelo resto do
// arquivo. Ela não é apagada em lugar nenhum — quem a apagasse devolveria as 26
// reprovações que ela existe para evitar.
const SECAO = 'Álbuns de exemplo';
// ELA É REAPLICÁVEL, e desde a v1.1.4 tem de ser: `closeHymnSearch` devolve a
// Biblioteca ao estado padrão (`resetarBiblioteca`), e `setAppMode('full')` —
// que quase todo bloco abaixo chama — passa por ele. O `expanded` do álbum, que
// esta semente escrevia UMA vez para o arquivo inteiro, morria ali; o terceiro
// degrau da escada (o card DENTRO da seção) deixava de existir e as medidas
// viravam `AUSENTE`.
//
// A semente do CATÁLOGO continua valendo para o arquivo todo — o que precisa ser
// reposto é só o estado de ABERTURA, que agora é transiente por decisão do app.
await pg.evaluate((nome) => {
  window.__semearSecao = () => {
    albumCatalog.categories = [{ name: nome,
      albums: [{ id_album: 77, name: 'Álbum de exemplo' }] }];
    albumCatalog.albums = [{ id_album: 77, name: 'Álbum de exemplo' }];
    // COM ESTADO E ABERTO: a escada de tons tem TRÊS degraus (folha → seção →
    // card) e o terceiro só existe se houver um card DENTRO da seção. Um álbum
    // vazio desenharia a seção e mais nada.
    const songs = [];
    for (let i = 1; i <= 4; i++) {
      songs.push({ id_music: 's' + i, name: 'Faixa de exemplo ' + i, track: i,
        has_instrumental_music: false, duration: '3:20' });
    }
    collState['album-77'] = { indexSyncedAt: Date.now(), songs };
    ui('album-77').expanded = true; ui('album-77').shown = 100;
  };
  window.__semearSecao();
}, SECAO);

try {
  const linha = await pg.evaluate(() => {
    setAppMode('full');
    const c = allCollections().find((x) => x.kind === 'hymnal');
    const songs = [];
    for (let i = 1; i <= 4; i++) {
      songs.push({ id_music: 'm' + i, name: 'Hino de exemplo número ' + i, track: i,
        has_instrumental_music: false, duration: '3:47' });
    }
    collState[c.id] = { indexSyncedAt: Date.now(), songs, isHymnal: true };
    window.__semearSecao();   // o `setAppMode` acima passou pelo reset (v1.1.4)
    grupoAberto = 'Álbuns de exemplo';
    ui(c.id).expanded = true; ui(c.id).shown = 100;
    // Uma lista PRÓPRIA e VISÍVEL, com a largura de um celular: dentro do popup
    // fechado toda medida é zero, e zeros comparados com zeros passam sem medir
    // nada (a lição da v5.208).
    const lista = document.createElement('ul');
    lista.className = 'hymnal-list';
    lista.style.width = '390px';
    document.body.appendChild(lista);
    renderCollectionsList(lista, () => {}, { semTotal: true });
    const bar = lista.querySelector('.coll-bar');
    const linhas = [...lista.querySelectorAll('.coll-songs > .hymn-result')];
    const alt = (el) => (el ? el.getBoundingClientRect().height : 0);
    const piso = parseFloat(getComputedStyle(document.documentElement)
      .getPropertyValue('--hit')) || 34;
    const r = {
      barra: alt(bar),
      item: alt(linhas[0]),
      // O ALVO DE TOQUE é a LINHA INTEIRA desde a v5.285 — o ▶ que ficava
      // aqui deixou de ser botão. Medir o quadrado seria medir um indicador; o
      // piso vale para o que de fato recebe o dedo.
      toque: alt(linhas[0]),
      piso,
      // O passo entre duas linhas é o que decide quantas cabem na tela.
      passo: linhas.length > 1
        ? linhas[1].getBoundingClientRect().top - linhas[0].getBoundingClientRect().top : 0,
      // E a fonte: o item não pode ser desenhado maior que o título que o contém.
      fonteItem: parseFloat(getComputedStyle(linhas[0].querySelector('.hymn-name')).fontSize),
      fonteAlbum: parseFloat(getComputedStyle(bar.querySelector('.coll-bar-name')).fontSize),
      // A ESCALA INTEIRA (v5.262). Os três níveis e os dois subtítulos, medidos
      // no mesmo desenho — é a única forma de afirmar uma RELAÇÃO em vez de
      // cinco números soltos, cada um verdadeiro sozinho.
      fonteSecao: parseFloat(getComputedStyle(
        lista.querySelector('.coll-group-name') || document.body).fontSize),
      // Os dois SUBTÍTULOS por um elemento de prova, e não pelo desenho: eles só
      // existem quando há metadado, e um fixture sem subtítulo devolveria o
      // tamanho herdado do `<body>` — 16px nos dois, isto é, uma igualdade que
      // passa sem medir nada (a lição da v5.208).
      subAlbum: (() => {
        const e = document.createElement('span'); e.className = 'coll-bar-sub';
        document.body.appendChild(e);
        const v = parseFloat(getComputedStyle(e).fontSize); e.remove(); return v;
      })(),
      subItem: (() => {
        const e = document.createElement('span'); e.className = 'hymn-sub';
        document.body.appendChild(e);
        const v = parseFloat(getComputedStyle(e).fontSize); e.remove(); return v;
      })(),
    };
    lista.remove();
    delete collState[c.id];
    grupoAberto = ''; favAberto = true;
    return r;
  });
  checar(linha.item > 0 && linha.item <= linha.barra * 1.05,
    'a linha de uma faixa não é mais alta que a barra do álbum que a contém ('
    + Math.round(linha.item) + 'px contra ' + Math.round(linha.barra) + 'px)');
  checar(linha.passo > 0 && linha.passo < 60,
    'e o passo entre faixas cabe numa lista densa — ' + Math.floor(900 / linha.passo)
    + ' itens numa tela de 900px (eram 12)');
  checar(linha.toque >= linha.piso,
    'sem furar o piso de toque do app: a LINHA (que é o alvo desde a v5.285) tem '
    + Math.round(linha.toque) + 'px, e o piso é ' + linha.piso + 'px');
  // ── A ESCALA DE TÍTULOS (v5.262) ────────────────────────────────────────
  // Relato do operador: *"há uma desproporção, onde o título das coleções está
  // pequeno, o dos álbuns maior e o dos items diferente… o texto dos itens
  // precisa dar uma leve reduzida."*
  //
  // O que se afirma são RELAÇÕES, e cada uma responde a um pedaço da frase.
  // Números soltos aqui reprovariam numa mudança legítima de fonte e, pior,
  // seriam verdadeiros um a um enquanto a escala continuasse sem sistema — que
  // era exatamente o estado anterior (11,84 · 15,2 · 15,2).
  checar(linha.fonteItem < linha.fonteAlbum,
    'o nome da faixa é MENOR que o título do álbum que a contém — eles EMPATAVAM,'
    + ' e é o empate que fazia o item não ler nível nenhum ('
    + linha.fonteItem + 'px contra ' + linha.fonteAlbum + 'px)');
  checar(linha.fonteAlbum < 15,
    'e o teto da escala caiu: nada na Biblioteca é desenhado nos 15,2px de antes,'
    + ' que era o que cortava (' + linha.fonteAlbum + 'px)');
  // ESTRITAMENTE decrescente para dentro (v5.263, "pode deixar maior o tamanho
  // dos títulos das coleções"): a v5.262 se contentou com "a seção chega perto
  // do álbum", e perto não é uma escala. Agora os três degraus são ordenados, e
  // o mais externo é o maior — que é a única leitura que uma árvore oferece de
  // graça.
  checar(linha.fonteSecao > linha.fonteAlbum,
    'e a seção é o MAIOR dos três: a escala decresce para dentro, do mais externo'
    + ' ao mais interno (' + linha.fonteSecao + ' > ' + linha.fonteAlbum + ' > '
    + linha.fonteItem + 'px)');
  checar(linha.subAlbum === linha.subItem,
    'e "subtítulo da Biblioteca" é UM valor: o do card e o da faixa deixaram de '
    + 'diferir por meio ponto (' + linha.subItem + 'px)');
} catch (e) {
  checar(false, 'a medição da linha da faixa terminou sem exceção (' + (e && e.message) + ')');
}

// ── A ESCADA DE CAMADAS DA BIBLIOTECA (v5.241, refeita na v5.267) ────────
// Relato do operador na v5.241: *"todo o esquema de cores e design está
// inconsistente"*. Medido no escuro, do fundo para dentro: folha 44 → barra de
// seção FECHADA ~69 → a mesma barra ABERTA 44 → card do álbum 59 → faixa 44.
// Subia, descia, subia e descia, em cinco níveis aninhados.
//
// A v5.241 respondeu com DOIS tons alternados, e a v5.267 revoga essa metade
// porque o operador voltou com o mesmo sintoma por outra porta: *"elas funcionam
// em camadas de ramificações que visualmente se parecem muito, dificultando
// discernir se estou em uma camada ou subcamada"*. Alternar dois tons faz um
// AVÔ e um NETO terem a mesma cor — e era literalmente o caso, porque a barra
// da seção e o card do álbum dividiam o `--panel-2` "de contêiner" enquanto o
// corpo da seção ficava com a cor da FOLHA. O card pousava no mesmo fundo em que
// a barra da seção pousa, isto é, lia-se como irmão dela.
//
// A regra nova é uma ESCADA de três degraus, e é ela que este caso trava, nos
// DOIS TEMAS (a causa raiz da v5.241 era justamente uma direção que se invertia
// entre eles):
//
//   folha (tela cheia) → seção → card do álbum, cada um distinto do anterior;
//   a direção é a MESMA nos três degraus (sobe no escuro, desce no claro);
//   a seção não troca de cor com o estado;
//   a faixa dentro do álbum não tem caixa nem filete — o que a separa da vizinha
//   é o espaço, com o tom do álbum aparecendo no meio.
for (const tema of ['escuro', 'claro']) {
  try {
    const t = await pg.evaluate(async (tema) => {
      document.documentElement.setAttribute('data-tema', tema);
      setAppMode('full');
      const c = allCollections().find((x) => x.kind === 'hymnal');
      const songs = [];
      for (let i = 1; i <= 3; i++) {
        songs.push({ id_music: 'n' + i, name: 'Hino ' + i, track: i,
          has_instrumental_music: false, duration: '3:47' });
      }
      collState[c.id] = { indexSyncedAt: Date.now(), songs, isHymnal: true };
      window.__semearSecao();   // o `setAppMode` acima passou pelo reset (v1.1.4)
      grupoAberto = 'Álbuns de exemplo';
      ui(c.id).expanded = true; ui(c.id).shown = 100;
      // A LISTA PRECISA MORAR NA FOLHA DE VERDADE (v5.267): o tom de cada nível
      // é herdado do contêiner (`--camada`), então medir a árvore num `<ul>`
      // solto no `<body>` mediria uma árvore que não existe no app.
      const folha = document.querySelector('#hymnSearchPopup .popup-sheet--full');
      const lista = document.createElement('ul');
      lista.className = 'popup-list';
      lista.style.width = '390px';
      folha.appendChild(lista);
      renderCollectionsList(lista, () => {}, { semTotal: true });
      const bg = (sel) => {
        const el = lista.querySelector(sel);
        return el ? getComputedStyle(el).backgroundColor : 'AUSENTE';
      };
      // A barra FECHADA precisa de um segundo grupo, que este não abriu. A dos
      // FAVORITOS fica de fora porque ela está SEMPRE aberta (v5.276) — ela
      // nunca seria uma barra fechada, e o `:not` só torna isso explícito.
      // (Da v5.273 à v5.281 o motivo era outro, e mais forte: ela tinha tom
      // próprio, então medi-la aqui compararia duas peças diferentes e chamaria
      // isso de "trocou de cor com o estado". O tom saiu na v5.282.)
      const fechada = (() => {
        const g = [...lista.querySelectorAll('.coll-group--drop:not(.aberto):not(.coll-group--fav)')];
        return g.length ? getComputedStyle(g[0]).backgroundColor : null;
      })();
      const dentro = (sel) => lista.querySelector(
        '.coll-group--drop.aberto:not(.coll-group--fav) ' + sel);
      const faixa = dentro('.coll-songs > .hymn-result');
      const r = {
        folha: getComputedStyle(folha).backgroundColor,
        // A seção de COLEÇÃO aberta. A dos Favoritos está sempre aberta (ela é
        // a primeira do documento), e o `:not` é o que garante que esta escada
        // seja medida numa coleção de verdade — desde a v5.282 as duas vestem o
        // mesmo tom, e o caso ao lado é quem afirma isso.
        secao: bg('.coll-group--drop.aberto:not(.coll-group--fav)'),
        secaoFechada: fechada,
        // A barra e o corpo são faixas do bloco da seção, sem fundo próprio.
        barra: bg('.coll-group--drop.aberto:not(.coll-group--fav) > .coll-group-bar'),
        corpo: bg('.coll-group--drop.aberto:not(.coll-group--fav) > .coll-group-corpo'),
        card: bg('.coll-group--drop.aberto:not(.coll-group--fav) .hymnal-card'),
        faixa: faixa ? getComputedStyle(faixa).backgroundColor : 'AUSENTE',
        faixaFilete: faixa ? getComputedStyle(faixa).borderTopWidth : 'AUSENTE',
        // O NOME DA FAIXA e o fundo EFETIVO sob ele (v5.296). A cor da faixa é
        // um OVERLAY (`--surface`), então `backgroundColor` devolve o alfa e
        // não a composição: medir contraste contra ele compararia o texto com
        // um preto a 14%, e diria a mesma coisa com o defeito no lugar. Quem o
        // navegador pinta é a pilha composta até o primeiro fundo opaco.
        nomeCor: faixa && faixa.querySelector('.hymn-name')
          ? getComputedStyle(faixa.querySelector('.hymn-name')).color : 'AUSENTE',
        nomeTam: faixa && faixa.querySelector('.hymn-name')
          ? parseFloat(getComputedStyle(faixa.querySelector('.hymn-name')).fontSize) : 0,
        faixaEfetiva: (() => {
          if (!faixa) return 'AUSENTE';
          const pilha = [];
          for (let n = faixa; n; n = n.parentElement) {
            const m = (getComputedStyle(n).backgroundColor.match(/[\d.]+/g) || []).map(Number);
            if (m.length < 3) continue;
            const a = m.length > 3 ? m[3] : 1;
            if (a === 0) continue;
            pilha.push([m[0], m[1], m[2], a]);
            if (a === 1) break;
          }
          // O branco de partida é o do documento: uma pilha inteiramente
          // translúcida (que aqui não acontece) sairia sobre a página, não
          // sobre preto — que é o erro que a guarda de opacidade abaixo
          // descreve, um nível acima.
          let c = [255, 255, 255];
          for (let k = pilha.length - 1; k >= 0; k--) {
            const [vr, vg, vb, va] = pilha[k];
            c = [vr * va + c[0] * (1 - va), vg * va + c[1] * (1 - va), vb * va + c[2] * (1 - va)];
          }
          return 'rgb(' + c.map(Math.round).join(', ') + ')';
        })(),
        // A METADE NEGATIVA: o RÓTULO da seção continua sendo um RÓTULO — cor
        // `--muted`, caixa alta, espaçamento. Sem ela, apagar a regra do rótulo
        // (em vez de tirá-la do bloco) passaria, e a Biblioteca perderia a
        // distinção entre um cabeçalho e uma linha.
        rotulo: (() => {
          const el = lista.querySelector('.coll-group--drop.aberto:not(.coll-group--fav) '
            + '> .coll-group-bar .coll-group-name');
          if (!el) return null;
          const c = getComputedStyle(el);
          return { cor: c.color, tt: c.textTransform, ls: c.letterSpacing };
        })(),
        // E A TIPOGRAFIA do que a seção CONTÉM (v5.297): o vazamento não era só
        // de cor. `text-transform` e `letter-spacing` também herdam, e ninguém
        // os reescreve lá dentro.
        nomeTipo: (() => {
          const el = faixa && faixa.querySelector('.hymn-name');
          if (!el) return null;
          const c = getComputedStyle(el);
          return { tt: c.textTransform, ls: c.letterSpacing };
        })(),
        tituloTipo: (() => {
          const el = lista.querySelector('.hymnal-card .coll-bar-name');
          if (!el) return null;
          const c = getComputedStyle(el);
          return { tt: c.textTransform, ls: c.letterSpacing };
        })(),
        // A cor do TEXTO da folha, para a regra de direção abaixo. Ela é a
        // pergunta inteira: "de que lado a linha tem de ficar?".
        textoCor: getComputedStyle(folha).color,
        // O espaço entre duas faixas — é ele que substitui o filete.
        faixaGap: (() => {
          const ul = lista.querySelector('.coll-songs');
          return ul ? parseFloat(getComputedStyle(ul).rowGap) : -1;
        })(),
      };
      lista.remove(); delete collState[c.id]; grupoAberto = ''; favAberto = true;
      document.documentElement.setAttribute('data-tema', 'escuro');
      return r;
    }, tema);
    const transparente = (v) => /rgba\(0, 0, 0, 0\)/.test(v) || v === 'transparent';
    // Luminância relativa, para afirmar a DIREÇÃO da escada sem escrever cor
    // nenhuma aqui: um literal copiado para o teste envelhece na primeira troca
    // de paleta, e envelhece parecendo correto.
    const lum = (v) => {
      const m = v.match(/\d+(\.\d+)?/g) || [];
      const c = m.slice(0, 3).map((x) => {
        const n = Number(x) / 255;
        return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const razao = (a, b) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
    checar(t.secaoFechada === null || t.secaoFechada === t.secao,
      '[' + tema + '] a seção tem UM fundo só, aberta ou fechada — a peça não '
      + 'troca de cor com o estado (' + t.secao + ')');
    checar(transparente(t.barra) && transparente(t.corpo),
      '[' + tema + '] e a barra e o corpo dela não têm fundo próprio: a seção é '
      + 'UM bloco, não três peças costuradas (' + t.barra + ' / ' + t.corpo + ')');
    // O piso é o mesmo do projeto para duas superfícies grandes encostadas.
    //
    // A GUARDA DE OPACIDADE NÃO É ZELO: `lum()` lê "rgba(0, 0, 0, 0)" como
    // PRETO, então um nível que não pinta nada entra na conta como o fundo mais
    // escuro possível e produz um degrau enorme. Verificado — sem ela, este caso
    // APROVAVA a folha anterior à v5.267, em que a seção não tinha fundo próprio
    // e o card tinha a cor da barra dela. Um teste que aprova o defeito que ele
    // existe para pegar é pior que teste nenhum.
    const opaco = (v) => !transparente(v) && v !== 'AUSENTE';
    const d1 = razao(t.folha, t.secao), d2 = razao(t.secao, t.card);
    checar(opaco(t.folha) && opaco(t.secao) && opaco(t.card) && d1 >= 1.28 && d2 >= 1.28,
      '[' + tema + '] os três níveis PINTAM, e a escada tem degrau de verdade nos '
      + 'dois: folha → seção → card', d1.toFixed(2) + ':1 e ' + d2.toFixed(2) + ':1');
    // ...e NENHUM par de níveis pode coincidir, adjacente ou não — o "avô com a
    // cor do neto" é o defeito que a alternância de dois tons produzia por
    // construção, e ele reapareceria numa refatoração que voltasse a ela.
    //
    // O piso deste par é 1,05:1 e não os 1,28:1 dos adjacentes, e a razão é
    // aritmética, não preguiça: no tema CLARO a escada NÃO pode ser monotônica.
    // A página é cinza e o nível 1 é branco (a convenção de toda UI clara, e a
    // que a paleta adota desde a v5.192), então o primeiro degrau sobe e os
    // seguintes só podem descer — folha #dfe3e7 → seção #ffffff → card #d4dae2,
    // com folha × card em 1,09:1. Isso não se lê como ambiguidade porque os dois
    // NUNCA se encostam: entre eles há sempre a moldura branca da seção. Exigir
    // monotonia aqui reprovaria um desenho correto (verificado: foi o que a
    // primeira versão deste caso fez).
    const dPula = razao(t.folha, t.card);
    checar(opaco(t.card) && dPula >= 1.05,
      '[' + tema + '] e nenhum par de níveis coincide — nem os que se pulam',
      'folha × card ' + dPula.toFixed(2) + ':1');
    // v5.271: a faixa GANHOU preenchimento. A v5.267 tirou o filete e pôs o
    // espaço no lugar, mas deixou a faixa sem fundo — e um vão da mesma cor dos
    // dois lados não separa nada, que foi o relato do operador ("os itens ficam
    // soltos no mesmo ambiente, dificultando a visualização de sua área de
    // toque"). O que este caso trava agora são as três metades: ela PINTA, ela
    // não desenha filete, e o espaço entre duas continua existindo — sem o
    // último, um bloco colado no outro volta a não ter área de toque legível.
    checar(!transparente(t.faixa) && parseFloat(t.faixaFilete) === 0 && t.faixaGap > 0,
      '[' + tema + '] a faixa dentro do álbum tem PREENCHIMENTO próprio e nenhum '
      + 'filete: o que a separa da vizinha é o espaço entre dois blocos que se '
      + 'veem (' + t.faixa + ', gap ' + t.faixaGap + 'px)');
    // ===== E O TEXTO DELA É LEGÍVEL SOBRE ESSE PREENCHIMENTO (v5.296) =====
    //
    // Relato do operador: *"a cor do texto dos itens dentro do álbum na
    // biblioteca, pois no tema claro, o fundo dos cards está escuro"*. MEDIDO
    // antes de mexer: **3,45:1** no tema claro, a 13,12px — reprova AA.
    //
    // A causa era HERANÇA: `.coll-group` é a regra do RÓTULO da seção (caixa
    // alta, `--muted`) e, desde que a seção virou o BLOCO que contém a barra e
    // o corpo (v5.237), ela é o contêiner de tudo o que a Biblioteca desenha —
    // então o nome de cada faixa saía na cor de um cabeçalho. Nenhum teste
    // olhava para a COR DO TEXTO desta árvore: os casos daqui mediam os FUNDOS,
    // e a escada de tons estava (e continua) correta.
    //
    // O piso é o de AA para texto pequeno, e a asserção é de RAZÃO e nunca de
    // cor: um literal copiado para cá envelhece na primeira troca de paleta, e
    // envelhece parecendo correto.
    const dTexto = t.nomeCor !== 'AUSENTE' && t.faixaEfetiva !== 'AUSENTE'
      ? razao(t.nomeCor, t.faixaEfetiva) : 0;
    checar(dTexto >= 4.5,
      '[' + tema + '] e o NOME dentro dela é legível sobre esse preenchimento: '
      + dTexto.toFixed(2) + ':1 a ' + t.nomeTam + 'px (era 3,45:1 no claro — a '
      + 'linha herdava a cor do RÓTULO da seção)');
    // O outro lado, e ele é o que impede a correção de virar "tudo virou
    // `--text`": o cabeçalho da seção CONTINUA em `--muted`. Cor de rótulo e
    // cor de conteúdo são duas coisas, e o defeito era exatamente uma valendo
    // pela outra.
    checar(!!t.rotulo && t.rotulo.cor !== t.nomeCor,
      '[' + tema + '] mas o RÓTULO da seção continua sendo um rótulo, com cor '
      + 'própria (' + (t.rotulo ? t.rotulo.cor : '?') + ' contra ' + t.nomeCor
      + ' da linha)');
    // ===== A LINHA DE CONTEÚDO SE AFASTA DO TEXTO (v5.297) =====
    //
    // A regra que o relato *"não melhorou a leitura"* obrigou a escrever. A
    // faixa vestia `--surface`, e recesso é uma regra sobre PROFUNDIDADE: no
    // escuro ela afasta do texto claro, no CLARO ela empurra na direção dele —
    // rgb(182,187,194), ~50% de luminância, o meio-tom exato. Ali `--text` dava
    // 4,59:1 (passava AA e não se lia) e branco daria 1,93:1: não havia cor de
    // texto que resolvesse, porque o defeito era a SUPERFÍCIE.
    //
    // A asserção é a REGRA e não um valor, e por isso vale nos dois temas sem
    // um `if` de tema: **a linha que carrega o texto contrasta com ele MAIS que
    // o contêiner dela.** Um recesso de volta a reprova no claro (verificado) e
    // continua passando no escuro, que é exatamente a assimetria do defeito.
    const dLinha = t.textoCor && t.faixaEfetiva !== 'AUSENTE'
      ? razao(t.textoCor, t.faixaEfetiva) : 0;
    const dCartao = t.textoCor && opaco(t.card) ? razao(t.textoCor, t.card) : 0;
    checar(dLinha > dCartao,
      '[' + tema + '] e ela se AFASTA do texto, não do fundo: a linha contrasta '
      + 'mais que o card que a contém (' + dLinha.toFixed(2) + ':1 contra '
      + dCartao.toFixed(2) + ':1)');
    // ===== E O CONTEÚDO NÃO É DESENHADO COMO UM RÓTULO (v5.297) =====
    //
    // A outra metade do mesmo vazamento, e a que o operador de fato via: a
    // Biblioteca INTEIRA saía em MAIÚSCULAS com espaçamento de rótulo, porque
    // `text-transform` e `letter-spacing` herdam e nada lá dentro os reescreve.
    // Caixa alta a 13px é mais lenta de ler e mais larga — era ela que truncava
    // "001. SANTO, SANTO, SANTO! (CANTAD…" numa linha que cabia.
    const normal = (o) => !!o && o.tt === 'none' && o.ls === 'normal';
    checar(normal(t.nomeTipo) && normal(t.tituloTipo),
      '[' + tema + '] e nem o nome da faixa nem o título do álbum são desenhados '
      + 'como RÓTULO — sem caixa alta e sem espaçamento de cabeçalho ('
      + (t.nomeTipo ? t.nomeTipo.tt + '/' + t.nomeTipo.ls : '?') + ')');
    // A metade negativa dela: a barra CONTINUA em caixa alta. Sem esta linha,
    // apagar a regra do rótulo passaria nas duas de cima.
    checar(!!t.rotulo && t.rotulo.tt === 'uppercase' && t.rotulo.ls !== 'normal',
      '[' + tema + '] mas a BARRA da seção continua em caixa alta e espaçada — é '
      + 'ela que o rótulo sempre descreveu (' + (t.rotulo ? t.rotulo.tt + '/'
      + t.rotulo.ls : '?') + ')');
  } catch (e) {
    checar(false, 'a medição da escada de camadas (' + tema + ') terminou sem exceção ('
      + (e && e.message) + ')');
  }
}

// ── OS FAVORITOS OCUPAM O VÃO, E VESTEM O TOM DAS OUTRAS (v5.273 → v5.282) ─
// Pedido do operador: *"a seção dos favoritos ocupa a altura que sobra além do
// espaço das outras seções no formato colapsado (mesmo que não haja nenhum
// favorito), dessa forma a visão comum inicial vai ser as listas de coleções
// empilhadas na base"*, mais *"aumentar ligeiramente o espaço entre as outras
// coleções, elas estão muito coladas entre si"*.
//
// E O TOM PRÓPRIO SAIU (v5.282): *"ajuste as cores dela para que ela fique
// igual as outras coleções"*. A asserção INVERTEU — de "distinto" para
// "idêntico" —, e ela é medida nos DOIS níveis (a seção e a linha dentro dela),
// porque o tom que saiu arrastava um degrau de dentro junto: pintar só o nível
// externo de volta ao padrão deixaria as linhas num tom que não é o das outras,
// e nenhuma medida da seção sozinha pegaria isso.
//
// A medição é na LISTA DE VERDADE (`#hymnResults`, dentro da folha) e com a
// folha em altura FIXA: as três regras deste lote são de layout, e um `<ul>`
// solto no `<body>` não tem vão nenhum a repartir — ele cresce com o conteúdo,
// e "a seção ocupa o que sobra" seria verdade por vacuidade.
for (const tema of ['escuro', 'claro']) {
  try {
    const v = await pg.evaluate(async (tema) => {
      document.documentElement.setAttribute('data-tema', tema);
      setAppMode('full');
      openHymnSearch();
      grupoAberto = ''; favAberto = true;
      // TUDO FECHADO É A PRECONDIÇÃO, e desde a v1.0.1 `grupoAberto = ''` não
      // basta para dizê-la: as coleções fixas moram na RAIZ, então um card que
      // um caso anterior deixou expandido não está mais dentro de uma seção
      // fechada (`display: none`) — ele fica no ar, com a lista de faixas
      // inteira, e a tela deixa de ter o vão que este caso mede.
      allCollections().forEach((c) => { ui(c.id).expanded = false; });
      hymnResultsEl.innerHTML = '';   // `renderCollectionsList` ACRESCENTA (v5.232)
      renderCollectionsList(hymnResultsEl, () => {}, { semTotal: true });
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const secoes = [...hymnResultsEl.querySelectorAll('.coll-group--drop')];
      const fav = secoes.find((s) => s.classList.contains('coll-group--fav'));
      const outras = secoes.filter((s) => !s.classList.contains('coll-group--fav'));
      const cx = (el) => getComputedStyle(el);
      const r = {
        // A seção aberta (a dos favoritos, no estado em que a tela abre) mede
        // muito mais que uma barra fechada: é ela que come o vão.
        altFav: fav ? fav.getBoundingClientRect().height : 0,
        altOutra: outras.length ? outras[0].getBoundingClientRect().height : 0,
        // E as fechadas ficam EMPILHADAS NA BASE: a última delas termina onde a
        // lista termina (descontado o padding de baixo).
        fundoUltima: outras.length
          ? outras[outras.length - 1].getBoundingClientRect().bottom : 0,
        fundoLista: hymnResultsEl.getBoundingClientRect().bottom
          - parseFloat(cx(hymnResultsEl).paddingBottom),
        // O TOM DA SEÇÃO, e o das outras ao lado: desde a v5.282 a afirmação é
        // que os dois são IGUAIS.
        corFav: fav ? cx(fav).backgroundColor : 'AUSENTE',
        corOutra: outras.length ? cx(outras[0]).backgroundColor : 'AUSENTE',
        // (O par "linha dos favoritos × linha de uma coleção" foi medido aqui
        // na v5.282 e saiu na v5.283: a linha de favorito DEIXOU de vestir o
        // tom de card, que era o defeito seguinte. Quem afirma o degrau de
        // dentro agora é o bloco `item`, montado logo abaixo com uma FAIXA de
        // álbum de verdade ao lado.)
        // O ESPAÇO entre seções, contra o das linhas de uma lista comum: a
        // relação é a afirmação (um número aqui envelheceria na primeira troca
        // de medida), e ela é o pedido — uma seção não é uma linha.
        gapSecoes: parseFloat(cx(hymnResultsEl).rowGap),
        // ===== A BARRA E AS LINHAS PREENCHEM A SEÇÃO (v5.273) =====
        // Relato do operador: *"os cards ficaram com seus elementos
        // centralizados de forma incorreta, desalinhando e espremendo
        // cabeçalhos e listas"*. A causa: `.coll-group` é `display: flex;
        // align-items: center`, e o `--drop` a neutralizava com
        // `display: block` — pôr a seção aberta em `display: flex` RESSUSCITOU
        // aquele `align-items`, e a barra passou a encolher ao próprio texto
        // (centrada) enquanto as linhas mais largas vazavam pelos dois lados.
        // A largura é a asserção: um filho que se recusa a esticar mede menos
        // que o contêiner, e um que vaza mede mais.
        larguras: (() => {
          const abertas = secoes.filter((x) => x.classList.contains('aberto'));
          const alvo = abertas[0] || fav;
          if (!alvo) return null;
          const dentro = alvo.getBoundingClientRect().width;
          const barra = alvo.querySelector('.coll-group-bar');
          const corpo = alvo.querySelector('.coll-group-corpo');
          const linha = corpo && corpo.firstElementChild;
          return {
            secao: dentro,
            barra: barra ? barra.getBoundingClientRect().width : 0,
            corpo: corpo ? corpo.getBoundingClientRect().width : 0,
            linha: linha ? linha.getBoundingClientRect().width : 0,
            // E o texto do cabeçalho começa na ESQUERDA, junto da seta.
            esqBarra: barra ? barra.getBoundingClientRect().left : 0,
            esqSecao: alvo.getBoundingClientRect().left,
          };
        })(),
        gapLista: (() => {
          const u = document.createElement('ul');
          u.className = 'popup-list';
          document.body.appendChild(u);
          const g = parseFloat(getComputedStyle(u).rowGap);
          u.remove();
          return g;
        })(),
      };
      // E UMA COLEÇÃO ABERTA MEDE O CONTEÚDO DELA, nada mais (v5.276). A v5.273
      // fazia a seção ABERTA crescer, qualquer que fosse, e o operador achou o
      // preço: *"coleções com menos itens como o hinário… expandem mais do que
      // precisaria em relação à quantidade e altura necessária para os itens"*.
      // O vão é dos Favoritos; uma coleção que o tomasse ficaria com meia tela
      // de fundo vazio embaixo de dois cards.
      window.__semearSecao();   // o `setAppMode` acima passou pelo reset (v1.1.4)
      grupoAberto = 'Álbuns de exemplo';
      hymnResultsEl.innerHTML = '';   // `renderCollectionsList` ACRESCENTA (v5.232)
      renderCollectionsList(hymnResultsEl, () => {}, { semTotal: true });
      await new Promise((f) => requestAnimationFrame(() => requestAnimationFrame(f)));
      const todas = [...hymnResultsEl.querySelectorAll('.coll-group--drop')];
      const colecao = todas.find((x) => x.classList.contains('aberto')
        && !x.classList.contains('coll-group--fav'));
      const favSecao = todas.find((x) => x.classList.contains('coll-group--fav'));
      const sobra = (el) => (el ? el.getBoundingClientRect().height
        - [...el.children].reduce((n, c) => n + c.getBoundingClientRect().height, 0) : -1);
      r.outra = {
        // O VAZIO dentro da coleção aberta: ela não pode absorver nada além do
        // padding próprio.
        sobraColecao: sobra(colecao),
        // E A ALTURA DOS FAVORITOS, para comparar com a de antes: é ela que a
        // v5.277 fixa.
        altFav: favSecao ? favSecao.getBoundingClientRect().height : -1,
      };
      // ===== UM FAVORITO É UM ITEM, NÃO UM ÁLBUM (v5.283) =====
      //
      // Pedido do operador: *"torne os itens na lista de favoritos, com sua cor
      // de card igual as cores dos itens individuais dentro dos álbuns, para
      // diferenciar entre álbum e item"*. Medido antes de mexer, nos dois
      // temas: linha de favorito e card de álbum pintavam **1,00:1** — a mesma
      // cor, literalmente.
      //
      // A COR EFETIVA, e não o `backgroundColor` declarado: os recessos deste
      // app são overlays com ALFA, e `getComputedStyle` devolve o alfa, não a
      // composição — uma asserção sobre o valor declarado compararia
      // `rgba(0,0,0,.24)` com um `#3c4753` opaco e diria que eles "diferem"
      // sem ter medido cor nenhuma. Subir a árvore compondo até o primeiro
      // fundo opaco é exatamente o que o navegador pinta.
      const efetiva = (el) => {
        if (!el) return null;
        const pilha = [];
        for (let n = el; n; n = n.parentElement) {
          const m = getComputedStyle(n).backgroundColor.match(/[\d.]+/g);
          if (!m) continue;
          const a = m.length > 3 ? Number(m[3]) : 1;
          if (a === 0) continue;
          pilha.push([Number(m[0]), Number(m[1]), Number(m[2]), a]);
          if (a === 1) break;
        }
        let c = [0, 0, 0];
        for (let k = pilha.length - 1; k >= 0; k--) {
          const [vr, vg, vb, va] = pilha[k];
          c = [vr * va + c[0] * (1 - va), vg * va + c[1] * (1 - va), vb * va + c[2] * (1 - va)];
        }
        return c.map(Math.round).join(', ');
      };
      // Uma FAIXA de álbum de verdade, no MESMO documento: a comparação inteira
      // é entre dois pontos da árvore real. Montar a marcação à mão mediria a
      // minha marcação; o que se monta aqui é o ESTADO (`expanded`) de que o
      // app precisa para desenhar as faixas ele mesmo.
      //
      // É O ÁLBUM SEMEADO (`album-77`), e não um hinário (v1.0.1): as coleções
      // fixas subiram para a RAIZ, e o par medido aqui — favorito × faixa de
      // álbum — só significa alguma coisa DENTRO da seção aberta, que é onde o
      // operador vê os dois lado a lado. Um hinário expandido desenharia as
      // faixas dele na raiz, fora do escopo que as sondas abaixo pedem.
      ui('album-77').expanded = true; ui('album-77').shown = 100;
      const favRec = await AVDB.addMedia(new Blob(['f'], { type: 'audio/mpeg' }),
        { name: 'Louvor favorito', list: 'favs' });
      // E UMA PASTA SINCRONIZADA na mesma lista (v5.284): ela é o outro lado do
      // par, e sem ela este caso mediria metade da regra. A lista `opfsFolders`
      // é o que `renderFolderList` lê — não há banco a montar.
      opfsFolders.push({ id: 'pasta-smoke', name: 'Vídeos do culto', count: 12 });
      await recarregarFavoritos();
      hymnResultsEl.innerHTML = '';
      renderCollectionsList(hymnResultsEl, () => {}, { semTotal: true });
      await new Promise((f) => requestAnimationFrame(() => requestAnimationFrame(f)));
      const favCorpo = hymnResultsEl.querySelector('[data-fav-corpo]');
      r.item = {
        // A SONDA DO ITEM não cita a placa DE PROPÓSITO: um seletor que só
        // existe na forma nova falha por "não achei" em qualquer forma antiga,
        // e uma asserção que reprova por seletor ausente não mediu cor nenhuma
        // — ela diria a mesma coisa se o item estivesse com a cor certa. Pelo
        // que ele NÃO é (uma pasta), ela mede em qualquer arranjo.
        favLinha: efetiva(favCorpo && favCorpo.querySelector('.lib-item:not(.folder-opfs)')),
        // DENTRO DA SEÇÃO ABERTA, e o escopo é o caso (v1.0.1): as quatro
        // coleções fixas passaram a ser cards da RAIZ, então um seletor solto
        // pega o primeiro delas — que se apoia na FOLHA, não numa seção. As
        // duas cores comparadas aqui só significam alguma coisa no mesmo
        // aninhamento em que o operador as vê.
        faixa: efetiva(hymnResultsEl.querySelector(
          '.coll-group--drop.aberto:not(.coll-group--fav) .coll-songs > .hymn-result')),
        cardAlbum: efetiva(hymnResultsEl.querySelector(
          '.coll-group--drop.aberto:not(.coll-group--fav) .hymnal-card')),
        pasta: efetiva(favCorpo && favCorpo.querySelector('.folder-opfs')),
        // E A ESTRUTURA, dos DOIS lados: o item DENTRO da placa, a pasta IRMÃ
        // dela. É o que dá a cada um a base que o faz aparecer, e sem os dois
        // uma pasta empurrada para dentro da placa passaria na medida de cor no
        // dia em que a placa e o corpo voltassem a ter o mesmo tom.
        itemNaPlaca: !!(favCorpo && favCorpo.querySelector('.fav-itens > .lib-item')),
        pastaSolta: !!(favCorpo && favCorpo.querySelector(':scope > .folder-opfs')),
      };
      opfsFolders.length = 0;
      await AVDB.listRemove('favs', favRec.id);
      await recarregarFavoritos();
      // `album-77` fica ABERTO: é o estado declarado do fixture da seção (ver
      // `SECAO`, no topo), e os casos seguintes contam com ele.
    // ===== A BARRA É O TOPO DA FOLHA (v5.280/v5.281) =====
    // MEDIDA DEPOIS do bloco acima, e de propósito: a rolagem só existe com
    // uma COLEÇÃO ABERTA — com tudo colapsado o vão dos favoritos é
    // justamente o que sobra, a lista cabe inteira e não haveria rolagem a
    // afirmar (a mesma propriedade do desenho que o caso do reset da
    // Biblioteca já tinha encontrado).
    r.barra = (() => {
        const folha = document.querySelector('#hymnSearchPopup .popup-sheet');
        const bar = document.querySelector('#hymnSearchPopup .hymn-search-bar');
        const fechar = document.getElementById('hymnSearchClose');
        const campo = document.getElementById('hymnSearchInput');
        const cx2 = (el) => el.getBoundingClientRect();
        // Uma rolagem de VERDADE na lista, com o conteúdo que este caso já
        // montou (a seção aberta transborda). `scrollTop` aqui é legítimo: o
        // que se mede é se a BARRA acompanha, não se a lista aceita o dedo.
        const barraAntes = cx2(bar).top;
        hymnResultsEl.scrollTop = 200;
        const rolou = hymnResultsEl.scrollTop;
        const barraDepois = cx2(bar).top;
        hymnResultsEl.scrollTop = 0;
        return {
          semCabecalho: !document.querySelector('#hymnSearchPopup .popup-header'),
          semTitulo: !document.getElementById('hymnSearchTitle'),
          primeira: folha.firstElementChild === bar,
          fecharL: cx2(fechar).width, fecharA: cx2(fechar).height,
          campoA: cx2(campo).height,
          barraAntes, barraDepois, rolou,
          overscroll: cx(hymnResultsEl).overscrollBehaviorY,
          overscrollRaiz: cx(document.documentElement).overscrollBehaviorY,
        };
      })();
      grupoAberto = ''; favAberto = true;
      closeHymnSearch();
      document.documentElement.setAttribute('data-tema', 'escuro');
      return r;
    }, tema);
    const lum = (s) => {
      const m = s.match(/[\d.]+/g) || [];
      const c = m.slice(0, 3).map((x) => {
        const n = Number(x) / 255;
        return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const razao = (a, b) => {
      const x = lum(a); const y = lum(b);
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    };
    // ELA OCUPA O VÃO: muitas vezes uma seção fechada, sem nenhum favorito na
    // lista. O "quanto" não pode virar número aqui — depende do acervo do
    // fixture —, e a comparação com a barra fechada é a régua da própria tela.
    checar(v.altFav > v.altOutra * 2,
      '[' + tema + '] a seção dos FAVORITOS ocupa o vão que sobra, mesmo sem '
      + 'nenhum favorito (' + Math.round(v.altFav) + 'px contra '
      + Math.round(v.altOutra) + 'px de uma seção fechada)');
    checar(Math.abs(v.fundoUltima - v.fundoLista) <= 1,
      '[' + tema + '] e as fechadas ficam EMPILHADAS NA BASE — a última termina '
      + 'onde a lista termina (' + Math.round(v.fundoUltima) + ' contra '
      + Math.round(v.fundoLista) + ')');
    // ===== ELA VESTE O TOM DAS OUTRAS (v5.282) =====
    // A afirmação INVERTEU: da v5.273 à v5.281 este par era "distinto", com um
    // piso de 1,15:1. A comparação é de STRING e não de razão de luminância —
    // "igual" é igual, e uma razão com piso baixo aprovaria dois tons
    // ligeiramente diferentes, que é exatamente a queixa ("não ficou bom").
    checar(v.corFav !== 'AUSENTE' && v.corFav === v.corOutra,
      '[' + tema + '] ela veste o MESMO tom das outras seções, sem cor própria ('
      + v.corFav + ' contra ' + v.corOutra + ')');
    // ===== E A LINHA DE FAVORITO É UM ITEM, NÃO UM ÁLBUM (v5.283) =====
    // A primeira metade é o pedido escrito como IGUALDADE de cor efetiva — de
    // string, e não de razão de luminância, porque "igual" é igual. A segunda é
    // o PROPÓSITO dele ("para diferenciar entre álbum e item"), e ela é o que
    // impede a correção de passar sem resolver nada: era exatamente 1,00:1
    // antes, e só a igualdade acima não teria como distinguir "virou faixa" de
    // "continua card" no dia em que a faixa mudar de receita.
    const it = v.item || {};
    checar(!!it.favLinha && it.favLinha === it.faixa,
      '[' + tema + '] a linha de favorito pinta a MESMA cor da faixa dentro de '
      + 'um álbum (' + it.favLinha + ' contra ' + it.faixa + ')');
    const dCard = it.favLinha && it.cardAlbum
      ? razao('rgb(' + it.favLinha + ')', 'rgb(' + it.cardAlbum + ')') : 0;
    checar(dCard >= 1.28,
      '[' + tema + '] e ela se separa do CARD de álbum, que era a queixa: '
      + dCard.toFixed(2) + ':1 (era 1,00:1 — a mesma cor)');
    // ===== MAS A PASTA SINCRONIZADA CONTINUA SENDO UM ÁLBUM (v5.284) =====
    // Pedido do operador: *"mantenha apenas as pastas sincronizadas dos
    // favoritos como cores de álbum"*. Uma pasta guarda muitos arquivos — ela é
    // um contêiner —, e é o "apenas" que faz deste par uma REGRA em vez de duas
    // cores: o item desce, a pasta não.
    checar(!!it.pasta && it.pasta === it.cardAlbum,
      '[' + tema + '] mas a PASTA sincronizada continua com a cor de álbum ('
      + it.pasta + ' contra ' + it.cardAlbum + ')');
    const dPasta = it.pasta && it.favLinha
      ? razao('rgb(' + it.pasta + ')', 'rgb(' + it.favLinha + ')') : 0;
    checar(dPasta >= 1.28 && it.pastaSolta && it.itemNaPlaca,
      '[' + tema + '] e ela se separa do ITEM ao lado — a pasta é IRMÃ da placa '
      + 'e o item mora DENTRO dela (' + dPasta.toFixed(2) + ':1'
      + (it.pastaSolta ? '' : ', mas a pasta está dentro da placa')
      + (it.itemNaPlaca ? '' : ', mas o item está fora dela') + ')');
    const L = v.larguras;
    checar(!!L && Math.abs(L.barra - L.secao) <= 1 && Math.abs(L.corpo - L.secao) <= 1,
      '[' + tema + '] a barra e o corpo PREENCHEM a seção aberta — nada é centrado '
      + 'nem encolhido ao próprio texto (' + (L ? Math.round(L.barra) + '/'
      + Math.round(L.corpo) + ' de ' + Math.round(L.secao) : '?') + 'px)');
    checar(!!L && L.linha > 0 && L.linha <= L.secao + 1 && L.esqBarra >= L.esqSecao - 1,
      '[' + tema + '] e uma linha de dentro não vaza para fora dela ('
      + (L ? Math.round(L.linha) + 'px numa seção de ' + Math.round(L.secao) : '?') + 'px)');
    // ===== O VÃO NÃO É REPARTIDO (v5.277) =====
    // A queixa daquele lote escrita como medida: a altura da seção dos
    // Favoritos é a MESMA com uma coleção aberta e com nenhuma. Com o
    // `flex-grow` de antes ela encolhia para repartir o vão com a coleção —
    // *"ao abrir uma coleção, ele encolhe os favoritos para dar espaço à
    // coleção aberta"*.
    //
    // Ela continua verdadeira depois de o vão virar um PISO (v5.282) porque
    // aqui a lista de favoritos está VAZIA: nada empurra a seção além do
    // mínimo. Quem afirma o outro lado — que ela CRESCE quando a lista pede
    // mais — é o `boot-nativo.test.mjs`, que é o único que sabe pôr favoritos
    // no banco.
    checar(Math.abs(v.outra.altFav - v.altFav) <= 1,
      '[' + tema + '] e essa altura NÃO MUDA quando uma coleção abre: o vão é '
      + 'do vizinho, não repartido (' + Math.round(v.altFav) + 'px → '
      + Math.round(v.outra.altFav) + 'px)');
    // E a coleção aberta mede o CONTEÚDO dela: o vazio dentro dela é só o
    // padding próprio, nunca metade da tela.
    checar(v.outra.sobraColecao >= 0 && v.outra.sobraColecao < v.altOutra,
      '[' + tema + '] e a COLEÇÃO aberta mede o conteúdo dela, sem inchar ('
      + Math.round(v.outra.sobraColecao) + 'px de vazio dentro dela)');
    // O CABEÇALHO SAIU (v5.280): a barra é o primeiro elemento da folha, e é
    // isso — e não um mecanismo de posicionamento — que a mantém no topo.
    checar(v.barra.semCabecalho && v.barra.semTitulo && v.barra.primeira,
      '[' + tema + '] a barra de busca é o TOPO da folha: sem cabeçalho, sem '
      + 'título, nada acima dela');
    // ===== E A LISTA ROLA SEM LEVAR A BARRA JUNTO (v5.281) =====
    // O relato do operador era que a barra não fica fixa durante a rolagem. A
    // estrutura sempre esteve certa — e é isso que a primeira metade mede, com
    // uma rolagem de verdade. A segunda é a causa do que ele viu no APARELHO:
    // sem `overscroll-behavior`, a rolagem que chega ao fim ENCADEIA para a
    // página, e do Android 12 em diante isso é o efeito STRETCH, que desloca a
    // camada inteira — barra fixa incluída. Um navegador de mesa não reproduz o
    // stretch, então o que se afirma aqui é a regra que o desliga.
    checar(v.barra.rolou > 0 && Math.abs(v.barra.barraDepois - v.barra.barraAntes) <= 1,
      '[' + tema + '] e a lista rola SEM levar a barra junto ('
      + Math.round(v.barra.rolou) + 'px de rolagem, a barra parada em '
      + Math.round(v.barra.barraDepois) + ')');
    checar(v.barra.overscroll === 'contain' && v.barra.overscrollRaiz === 'none',
      '[' + tema + '] e a rolagem PARA na lista: sem o encadeamento, o stretch '
      + 'do Android não desloca a camada inteira',
      'lista ' + v.barra.overscroll + ' · raiz ' + v.barra.overscrollRaiz);
    // QUADRADO. `aspect-ratio` não resolve isto dentro de um flex (a largura é
    // resolvida antes de o `stretch` dar altura), e a primeira versão colapsou
    // o botão na largura do glifo — 20px, medidos.
    checar(v.barra.fecharL > 0 && Math.abs(v.barra.fecharL - v.barra.fecharA) <= 1
      && Math.abs(v.barra.fecharA - v.barra.campoA) <= 1,
      '[' + tema + '] o ✕ é QUADRADO e do tamanho do campo ('
      + Math.round(v.barra.fecharL) + '×' + Math.round(v.barra.fecharA)
      + ', campo ' + Math.round(v.barra.campoA) + 'px de altura)');
    checar(v.gapSecoes > v.gapLista,
      '[' + tema + '] e uma SEÇÃO respira mais que uma linha de lista ('
      + v.gapSecoes + 'px contra ' + v.gapLista + 'px)');
  } catch (e) {
    checar(false, 'a medição do vão dos favoritos (' + tema + ') terminou sem exceção ('
      + (e && e.message) + ')');
  }
}

// ── A LINHA INTEIRA É O ALVO (v5.278 → v5.285) ───────────────────────────
// Relato que abriu o caso, na v5.278: *"é extremamente comum tentar clicar em
// adicionar e acabar tocando no corpo do card, abrindo os detalhes da letra"*.
// Aquela versão cresceu o alvo dos DOIS botões por um `::after` até as bordas
// da linha; a v5.285 removeu os botões, a pedido do operador, e com eles a
// classe inteira de erro: não há mais dois desfechos a confundir.
//
// O caso continua medindo o que o DEDO encontra (`elementFromPoint`), e a
// afirmação ficou mais forte: TODO ponto da linha — os quatro cantos, as
// bordas e o meio — leva ao mesmo lugar. Um botão que voltasse a aparecer ali
// reprova aqui, que é exatamente o que este caso existe para impedir.
try {
  const alvo = await pg.evaluate(() => {
    setAppMode('full');
    const c = allCollections().find((x) => x.kind === 'hymnal');
    collState[c.id] = { indexSyncedAt: Date.now(), isHymnal: true,
      songs: [1, 2, 3].map((i) => ({ id_music: 'q' + i, name: 'Hino ' + i, track: i,
        has_instrumental_music: false, duration: '3:47' })) };
    ui(c.id).expanded = true; ui(c.id).shown = 100;
    const lista = document.createElement('ul');
    lista.className = 'hymnal-list';
    lista.style.width = '390px';
    document.body.appendChild(lista);
    window.__semearSecao();   // o `setAppMode` acima passou pelo reset (v1.1.4)
    grupoAberto = 'Álbuns de exemplo';
    renderCollectionsList(lista, () => {}, { semTotal: true });
    const linha = lista.querySelector('.coll-songs > .hymn-result');
    const lb = linha.getBoundingClientRect();
    // O que o toque encontra: a própria linha, ou um alvo CONCORRENTE dentro
    // dela. Qualquer `button` conta como concorrente — o caso não conhece os
    // nomes dos que saíram, e é isso que o faz valer para o próximo que
    // aparecer.
    const quem = (x, y) => {
      const e = document.elementFromPoint(x, y);
      if (!e) return 'nada';
      if (!linha.contains(e)) return 'fora';
      return e.closest('button') ? 'BOTÃO' : 'linha';
    };
    // O CANTO É MEDIDO POR DENTRO DO RAIO, e isto não é afrouxar a asserção.
    // A linha tem `border-radius: var(--radius-btn)` (8px), e um canto
    // arredondado NÃO é da linha: `elementFromPoint` ali devolve o pai, que é o
    // comportamento CERTO do CSS. Cravar 2px no canto geométrico afirmava algo
    // FALSO sobre um retângulo redondo — e a asserção só passava por acidente de
    // layout: no runner do CI ela reprovava desde a v5.314 (medido: mesma caixa
    // 355×48, mesmo `cantoDir: "UL.coll-songs"`), verde na máquina de quem a
    // escreveu. Com `continue-on-error` no passo, o run ficava VERDE com 14/15.
    //
    // O que a asserção quer dizer continua inteiro: a REGIÃO do canto leva à
    // linha, e não a um alvo concorrente. O ponto medido é o mais próximo do
    // canto que a linha de fato PINTA.
    const raio = parseFloat(getComputedStyle(linha).borderTopRightRadius) || 0;
    const pontos = {
      meio: quem(lb.left + lb.width / 2, lb.top + lb.height / 2),
      esquerda: quem(lb.left + 4, lb.top + lb.height / 2),
      direita: quem(lb.right - 2, lb.top + lb.height / 2),
      topo: quem(lb.left + lb.width / 2, lb.top + 2),
      base: quem(lb.left + lb.width / 2, lb.bottom - 2),
      cantoDir: quem(lb.right - raio - 1, lb.top + raio + 1),
      // O quadrado da esquerda é onde o ▶ vivia: é o ponto que mais precisa
      // levar à linha agora, porque é onde o dedo aprendeu a mirar.
      quadrado: quem(lb.left + 20, lb.top + lb.height / 2),
    };
    const r = {
      pontos,
      // A GEOMETRIA VIAJA JUNTO, e não por zelo: esta asserção reprovou no CI e
      // passou em toda máquina de desenvolvimento, e o log dizia só a frase.
      // Sem a caixa e sem o elemento que cada ponto de fato encontrou, o único
      // caminho é adivinhar — ou publicar um lote só para instrumentar.
      caixa: [Math.round(lb.left), Math.round(lb.top), Math.round(lb.width), Math.round(lb.height)],
      raio,
      janela: [window.innerWidth, window.innerHeight],
      achou: Object.fromEntries(Object.entries({
        meio: [lb.left + lb.width / 2, lb.top + lb.height / 2],
        esquerda: [lb.left + 4, lb.top + lb.height / 2],
        direita: [lb.right - 2, lb.top + lb.height / 2],
        topo: [lb.left + lb.width / 2, lb.top + 2],
        base: [lb.left + lb.width / 2, lb.bottom - 2],
        cantoDir: [lb.right - raio - 1, lb.top + raio + 1],
        quadrado: [lb.left + 20, lb.top + lb.height / 2],
      }).map(([k, [x, y]]) => {
        const e = document.elementFromPoint(x, y);
        return [k, e ? e.tagName + '.' + String(e.className || '').split(' ')[0] : 'nada'];
      })),
      botoesNaLinha: linha.querySelectorAll('.row button').length,
      // E a LARGURA do nome, que é o que a remoção devolve: ela não vira número
      // fixo aqui (depende da fonte), mas a fração da linha é a afirmação.
      fracaoDoNome: linha.querySelector('.hymn-name').getBoundingClientRect().width / lb.width,
    };
    lista.remove(); delete collState[c.id]; grupoAberto = '';
    return r;
  });
  checar(alvo.botoesNaLinha === 0,
    'a faixa da Biblioteca não tem BOTÃO nenhum na linha: o ▶ e o + saíram, e o '
    + 'toque é do corpo inteiro (v5.285)',
    alvo.botoesNaLinha + ' botão(ões)');
  const todos = Object.entries(alvo.pontos);
  const errados = todos.filter(([, v]) => v !== 'linha');
  checar(errados.length === 0,
    'e TODO ponto dela leva ao mesmo lugar — cantos, bordas e meio, inclusive o '
    + 'quadrado onde o ▶ vivia: não há dois desfechos a confundir',
    errados.length
      ? JSON.stringify({ errados: Object.fromEntries(errados), achou: alvo.achou,
        caixa: alvo.caixa, janela: alvo.janela })
      : todos.length + ' pontos');
  checar(alvo.fracaoDoNome > 0.6,
    'e o NOME recebeu a largura que os dois botões ocupavam ('
    + Math.round(alvo.fracaoDoNome * 100) + '% da linha)');
} catch (e) {
  checar(false, 'a medição do alvo da faixa terminou sem exceção ('
    + (e && e.message) + ')');
}

// ── A GAVETA DE OPÇÕES DA FAIXA (v5.286) ─────────────────────────────────
// Sete pedidos do operador sobre a gaveta que a v5.285 criou, e dois deles são
// defeitos que ela introduziu — o caso cobre os dois grupos porque eles vivem
// na mesma peça e um conserto pode desfazer o outro.
try {
  const g = await pg.evaluate(async () => {
    setAppMode('full');
    const c = allCollections().find((x) => x.kind === 'hymnal');
    // DUAS músicas, e a segunda não é enfeite: a queixa da v5.287 é que a
    // gaveta se mescla com "a lista dos outros itens abaixo", e sem uma linha
    // VIZINHA não há o que comparar.
    collState[c.id] = { indexSyncedAt: Date.now(), isHymnal: true,
      songs: [
        { id_music: 'g1', name: 'Meu Lugar no Mundo', track: 1,
          has_instrumental_music: true, duration: '3:47' },
        { id_music: 'g2', name: 'Vem, Senhor Jesus', track: 2,
          has_instrumental_music: true, duration: '4:02' },
      ] };
    ui(c.id).expanded = true; ui(c.id).shown = 100;
    const lista = document.createElement('ul');
    lista.className = 'hymnal-list'; lista.style.width = '390px';
    document.body.appendChild(lista);
    window.__semearSecao();   // o `setAppMode` acima passou pelo reset (v1.1.4)
    grupoAberto = 'Álbuns de exemplo';
    renderCollectionsList(lista, () => {}, { semTotal: true });
    // DENTRO DA SEÇÃO ABERTA (v1.0.1): a gaveta é comparada com a FAIXA VIZINHA
    // e com o CARD que a contém, e as três cores só se comparam no mesmo
    // aninhamento. Solto, o seletor passou a pegar as faixas de uma coleção da
    // RAIZ, que se apoia na folha — outro fundo, outra conta.
    const naSecao = '.coll-group--drop.aberto:not(.coll-group--fav) ';
    const linhas = [...lista.querySelectorAll('.coll-songs > .hymn-result')];
    const li = linhas[0];
    li.querySelector('.row').click();
    await new Promise((r) => setTimeout(r, 350));
    const op = li.querySelector('.hymn-opcoes');
    const efetiva = (el) => {
      if (!el) return null;
      const pilha = [];
      for (let n = el; n; n = n.parentElement) {
        const m = getComputedStyle(n).backgroundColor.match(/[\d.]+/g);
        if (!m) continue;
        const a = m.length > 3 ? Number(m[3]) : 1;
        if (a === 0) continue;
        pilha.push([Number(m[0]), Number(m[1]), Number(m[2]), a]);
        if (a === 1) break;
      }
      let c2 = [0, 0, 0];
      for (let k = pilha.length - 1; k >= 0; k--) {
        const [vr, vg, vb, va] = pilha[k];
        c2 = [vr * va + c2[0] * (1 - va), vg * va + c2[1] * (1 - va), vb * va + c2[2] * (1 - va)];
      }
      return c2.map(Math.round).join(', ');
    };
    const rotulos = () => [...op.querySelectorAll('.song-menu-label')].map((e) => e.textContent);
    const r = {
      // 1 · OS MARCADORES DE LISTA (defeito da v5.285): a `<ul>` do corpo não
      // herdava `list-style: none` de ninguém, e o navegador desenhava os
      // quadradinhos que o operador viu à esquerda dos cards.
      marcador: getComputedStyle(op).listStyleType,
      // 2 · O SELETOR tem TRÊS segmentos, e "Letra" é um deles.
      seg: [...op.querySelectorAll('.song-menu-seg .fit-opt')].map((e) => e.textContent),
      // 3 · "Tocar agora" é a PRIMEIRA selecionável, e as linhas "Tocar música
      // cantada"/"Tocar playback" não existem mais: elas repetiam o seletor.
      rotulos: rotulos(),
      // O RÓTULO, e não o `textContent` do botão: ele traz o subtítulo colado
      // (as duas `<span>` não têm quebra entre elas), e a comparação sairia
      // sempre falsa por um motivo que não é o do caso.
      primeiraSel: (() => {
        const b = [...op.querySelectorAll('.song-menu-btn')]
          .find((x) => x.querySelector('.song-menu-check'));
        const t = b && b.querySelector('.song-menu-label');
        return t ? t.textContent.trim() : null;
      })(),
      // 4 · TODA opção tem caixa, e ela se vê SEM estar marcada.
      quantasCaixas: op.querySelectorAll('.song-menu-check').length,
      quantosBotoesSel: [...op.querySelectorAll('.song-menu-btn')]
        .filter((x) => x.querySelector('.song-menu-check')).length,
      // A CAIXA VAZIA, COMPOSTA sobre o botão em que ela mora. `backgroundColor`
      // de um `::before` com alfa devolve o alfa — medir a string crua compararia
      // PRETO com o botão e daria uma razão enorme em qualquer estado, isto é,
      // passaria sem medir nada (a mesma armadilha da v5.283, um nível abaixo).
      caixaVazia: (() => {
        const bruto = getComputedStyle(
          op.querySelector('.song-menu-check'), '::before').backgroundColor;
        const m = (bruto.match(/[\d.]+/g) || []).map(Number);
        if (m.length < 3) return null;
        const a = m.length > 3 ? m[3] : 1;
        const base = (efetiva(op.querySelector('.song-menu-btn')) || '0, 0, 0')
          .split(', ').map(Number);
        return m.slice(0, 3).map((v, k) => Math.round(v * a + base[k] * (1 - a))).join(', ');
      })(),
      fundoBotao: efetiva(op.querySelector('.song-menu-btn')),
      // 5 · O CONTRASTE DA GAVETA (v5.287), nos DOIS TEMAS — e são dois porque
      // o tom dela INVERTE de direção entre eles (poço no escuro, folha no
      // claro; a medição está em `tokens.css`). Medir um só aprovaria metade do
      // desenho, e foi justamente o tema escuro que reprovou no aparelho.
      cores: (() => {
        const antes = document.documentElement.getAttribute('data-tema');
        const out = {};
        for (const tema of ['escuro', 'claro']) {
          document.documentElement.setAttribute('data-tema', tema);
          out[tema] = {
            gaveta: efetiva(li.querySelector('.hymn-gaveta')),
            botao: efetiva(op.querySelector('.song-menu-btn')),
            vizinha: efetiva(linhas[1]),
            card: efetiva(lista.querySelector('.hymnal-card')),
          };
        }
        if (antes) document.documentElement.setAttribute('data-tema', antes);
        else document.documentElement.removeAttribute('data-tema');
        return out;
      })(),
      // 6 · A LETRA está atrás de um botão, LADO A LADO com o confirmar.
      ladoALado: (() => {
        const go = op.querySelector('.song-menu-go');
        const ver = op.querySelector('.song-menu-letra');
        if (!go || !ver) return null;
        return Math.abs(go.getBoundingClientRect().top - ver.getBoundingClientRect().top) <= 2;
      })(),
      // ===== E NUMA MÚSICA ELE ABRE O LEITOR (v1.2.25) =====
      //
      // A metade de baixo da gaveta era uma SEGUNDA leitura da letra, pior que
      // a que o app já tem: sem cifra, sem tom, sem corpo e sem rolagem. Hoje o
      // mesmo botão aponta o leitor do transporte para esta faixa — e a caixa
      // de texto não existe mais, o que esta medição afirma nas duas pontas
      // (o `.hymn-lyrics` ausente E o popup aberto).
      caixaDeLetra: !!li.querySelector('.hymn-lyrics'),
      leitor: await (async () => {
        const ver = op.querySelector('.song-menu-letra');
        if (!ver) return null;
        const rotulo = ver.textContent.trim();
        const largura = Math.round(ver.getBoundingClientRect().width);
        ver.click();   // o ouvinte é `async`: monta o alvo antes de abrir
        for (let i = 0; i < 120 && !lyricsPopupEl.classList.contains('open'); i++) {
          await new Promise((r2) => setTimeout(r2, 25));
        }
        const r2 = {
          rotulo,
          largura,
          aberto: lyricsPopupEl.classList.contains('open'),
          titulo: (document.getElementById('lyricsPopupTitle') || {}).textContent || '',
          // A LARGURA NÃO MUDA (v5.287): aqui ela não pode mudar por
          // construção — há uma frase só —, e é isso que a asserção diz.
          larguraDepois: Math.round(
            op.querySelector('.song-menu-letra').getBoundingClientRect().width),
        };
        // FECHADO antes de sair: a pressão de verdade lá fora mira a gaveta, e
        // um backdrop aberto por cima dela mediria o toque em outra coisa.
        closeLyricsPopup();
        return r2;
      })(),
    };
    // Deixa a lista NO DOCUMENTO para a pressão de verdade lá fora; quem a
    // remove é o segundo `evaluate`.
    window.__gaveta = { lista, li, op };
    return r;
  });
  // ===== O FEEDBACK NÃO ENCOLHE A SEÇÃO INTEIRA (v5.286) =====
  // Relato do operador: *"o feedback de toque está encolhendo toda a seção de
  // opções do item, ao tocar em apenas uma das opções"*. A causa é o `:active`
  // do `.lib-item` sendo satisfeito por um botão DENTRO dele — e o que se mexe
  // é a linha mais a gaveta, meia tela por causa de um toque de 40px.
  //
  // A pressão é de VERDADE (`mouse.down`), porque `:active` não se simula com
  // classe: o que se mede é o `transform` computado da linha ENQUANTO o botão
  // está pressionado, que é exatamente o instante do relato.
  const press = await (async () => {
    const cx = await pg.evaluate(() => {
      const b = window.__gaveta.op.querySelector('.song-menu-btn');
      const r2 = b.getBoundingClientRect();
      return { x: Math.round(r2.left + r2.width / 2), y: Math.round(r2.top + r2.height / 2) };
    });
    await pg.mouse.move(cx.x, cx.y);
    await pg.mouse.down();
    const durante = await pg.evaluate(() => ({
      linha: getComputedStyle(window.__gaveta.li).transform,
      botao: getComputedStyle(
        window.__gaveta.op.querySelector('.song-menu-btn')).transform,
    }));
    await pg.mouse.up();
    return durante;
  })();
  // ===== E UM TOQUE, UM ENCOLHIMENTO SÓ (v1.2.27) =====
  //
  // Relato do operador: *"ao encolher, as bordas do card de título ficam com uma
  // marca de encolhimento nas laterais direita e esquerda"*. `:active` casa
  // também nos ANCESTRAIS, então o toque na linha satisfazia o `.lib-item` E a
  // `.hymn-row` de dentro: dois `--press` sobre o mesmo dedo, e o título ficava
  // 7px mais estreito de cada lado que a gaveta logo abaixo, com o branco do
  // cartão aparecendo nessa fresta.
  //
  // A asserção é a FRESTA, medida em pixels durante uma pressão de verdade:
  // linha e gaveta são o mesmo bloco, então as bordas das duas têm de coincidir.
  // Comparar `transform` não serviria — o `none` da linha seria satisfeito
  // também por um cartão que parasse de encolher, que é outro desenho.
  const pressLinha = await (async () => {
    const cx = await pg.evaluate(() => {
      const r2 = window.__gaveta.li.querySelector('.hymn-row').getBoundingClientRect();
      return { x: Math.round(r2.left + r2.width / 2), y: Math.round(r2.top + r2.height / 2) };
    });
    await pg.mouse.move(cx.x, cx.y);
    await pg.mouse.down();
    const durante = await pg.evaluate(() => {
      const li = window.__gaveta.li;
      const cx2 = (el) => {
        const r2 = el.getBoundingClientRect();
        return { l: Math.round(r2.left), r: Math.round(r2.right), w: Math.round(r2.width) };
      };
      return {
        cartao: cx2(li),
        linha: cx2(li.querySelector('.hymn-row')),
        gaveta: cx2(li.querySelector('.hymn-gaveta')),
        // E O CARTÃO RESPONDE MESMO: sem isto, "nada se mexe" passaria — e o
        // feedback de toque teria sumido em vez de ficar inteiro. Desde a
        // v1.3.14 quem responde num BLOCO é a LUZ (`--press-luz`, um `filter`),
        // não a geometria: um contêiner que hospeda outros controles não se
        // move, e é a luz que diz "recebi". Medir `transform` aqui aprovaria o
        // desenho velho e reprovaria o novo — a asserção é a RESPOSTA, não o
        // mecanismo.
        respondeu: getComputedStyle(li).filter,
        moveu: getComputedStyle(li).transform,
      };
    });
    await pg.mouse.up();
    return durante;
  })();
  checar(pressLinha.linha.l === pressLinha.gaveta.l
    && pressLinha.linha.r === pressLinha.gaveta.r,
    'o toque na LINHA não abre fresta entre o título e a gaveta — eram dois '
    + '`--press` no mesmo dedo (0,96 × 0,96)',
    JSON.stringify(pressLinha));
  checar(pressLinha.respondeu !== 'none' && pressLinha.cartao.w > 0,
    'e o cartão RESPONDE de verdade: a luz do toque ficou, o feedback não sumiu',
    JSON.stringify(pressLinha));
  // ===== E O RECUO É ABSOLUTO, NÃO UMA FRAÇÃO (v1.3.14) =====
  // A outra metade, e ela é a que impede a correção acima de virar o defeito
  // anterior por outro caminho: `scale(.96)` num cartão de 408px recuava 8,2px
  // de cada lado. `translateY(2px)` não mexe na LARGURA — é `matrix(1,0,0,1,0,2)`
  // —, e é por não mexer que a fresta acima não pode voltar.
  checar(/matrix\(1,\s*0,\s*0,\s*1,\s*0,\s*2\)/.test(pressLinha.moveu),
    'e o recuo é ABSOLUTO (2px para baixo), não uma fração da largura: é isso '
    + 'que impede a fresta de voltar em qualquer tamanho de cartão',
    JSON.stringify(pressLinha));
  await pg.evaluate(() => {
    window.__gaveta.lista.remove();
    delete window.__gaveta;
    grupoAberto = ''; songMenuFor = null;
  });
  checar(press.linha === 'none',
    'o toque numa OPÇÃO não encolhe a linha nem a gaveta — o feedback é do botão '
    + 'tocado, não da caixa de meia tela em volta dele',
    'transform da linha: ' + press.linha);
  checar(press.botao !== 'none',
    'e o BOTÃO continua encolhendo: o toque não deixou de responder',
    'transform do botão: ' + press.botao);
  // `razao` mora dentro do laço de temas lá em cima; aqui a medição é de um
  // tema só (o padrão), e o par local basta.
  const lum2 = (str) => {
    const m = (str.match(/[\d.]+/g) || []).slice(0, 3).map((x) => {
      const n = Number(x) / 255;
      return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2];
  };
  const razao2 = (a, b) => {
    const x = lum2(a); const y = lum2(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  checar(g.marcador === 'none',
    'a lista de opções não desenha MARCADOR de lista — os "pontos à esquerda dos '
    + 'cards" eram o `<ul>` do corpo sem `list-style` (defeito da v5.285)',
    'list-style-type: ' + g.marcador);
  checar(g.seg.join(' · ') === 'Cantada · Playback · Letra',
    'o seletor tem as TRÊS variantes — "Apenas a letra" virou uma delas',
    JSON.stringify(g.seg));
  checar(g.primeiraSel === 'Tocar agora'
    && !g.rotulos.some((t) => /Tocar música cantada|Tocar playback/.test(t)),
    'e "Tocar agora" é a PRIMEIRA selecionável, no lugar das duas linhas que '
    + 'repetiam o seletor', JSON.stringify(g.rotulos));
  checar(g.quantasCaixas === g.quantosBotoesSel && g.quantasCaixas === 4,
    'as QUATRO opções são selecionáveis, e cada uma tem a sua caixa',
    g.quantasCaixas + ' caixas para ' + g.quantosBotoesSel + ' opções');
  // A caixa VAZIA precisa se ver contra o botão em que ela mora — era este o
  // pedido ("para entender que não são botões, mas selecionáveis"), e o piso é
  // o mesmo degrau que o app usa para separar duas superfícies.
  const dCaixa = g.caixaVazia
    ? razao2('rgb(' + g.caixaVazia + ')', 'rgb(' + g.fundoBotao + ')') : 0;
  // O PISO É 1,25 e não 1,3, e a diferença tem causa: no tema escuro o recesso
  // pousa sobre um botão JÁ escuro, e a razão WCAG comprime no pé da escala. O
  // que a asserção guarda é a melhora medida — era 1,13:1 com o
  // `--surface-2-sunk` da v5.285, que é o "não dá para ver" do relato.
  checar(dCaixa >= 1.25,
    'e a caixa VAZIA se vê contra o botão, sem estar marcada ('
    + dCaixa.toFixed(2) + ':1 — rgb(' + g.caixaVazia + ') sobre rgb(' + g.fundoBotao + '))');
  // ===== A GAVETA SE SEPARA DA LISTA, E OS BOTÕES DELA (v5.287) =====
  //
  // Relato do operador: *"ainda está pouco o contraste entre os botões e pior,
  // toda a seção das opções de play estão se mesclando com a lista dos outros
  // itens abaixo, dificultando a percepção da seção e a qual item ela
  // pertence"*.
  //
  // MEDIDO com o código anterior, no tema ESCURO: a gaveta ficava a **1,03:1**
  // da faixa de uma linha vizinha (as duas em torno de rgb(45,53,61)) e os
  // botões a 1,18:1 dela. O piso aqui é o mesmo 1,28 que este app usa para
  // separar duas superfícies em qualquer outro lugar.
  //
  // Os TRÊS pares, e nenhum basta sozinho: contra a VIZINHA é a queixa
  // literal; contra o CARD é o que impede a saída fácil no escuro (subir para
  // `--panel-2` daria a cor exata do fundo do álbum, que aparece nos vãos entre
  // as linhas); e o BOTÃO contra a gaveta é a primeira metade do relato.
  for (const tema of ['escuro', 'claro']) {
    const t = g.cores[tema];
    const par = (a, b) => razao2('rgb(' + a + ')', 'rgb(' + b + ')');
    checar(par(t.botao, t.gaveta) >= 1.28,
      '[' + tema + '] os BOTÕES da gaveta se separam do fundo dela ('
      + par(t.botao, t.gaveta).toFixed(2) + ':1)');
    checar(par(t.gaveta, t.vizinha) >= 1.28,
      '[' + tema + '] e a GAVETA se separa da faixa das linhas vizinhas — era o '
      + '"se mesclando com a lista dos outros itens abaixo" ('
      + par(t.gaveta, t.vizinha).toFixed(2) + ':1)', JSON.stringify(t));
    checar(par(t.gaveta, t.card) >= 1.28,
      '[' + tema + '] e do CARD do álbum, que é a cor que aparece nos vãos entre '
      + 'as linhas (' + par(t.gaveta, t.card).toFixed(2) + ':1)');
  }
  checar(g.ladoALado === true && g.caixaDeLetra === false,
    'e a LETRA fica atrás de um botão lado a lado com o confirmar — que numa '
    + 'MÚSICA não revela mais caixa de texto nenhuma aqui dentro',
    JSON.stringify({ ladoALado: g.ladoALado, caixaDeLetra: g.caixaDeLetra }));
  checar(!!g.leitor && g.leitor.aberto && /Ver a letra/.test(g.leitor.rotulo),
    'o toque nele abre o LEITOR — a mesma folha do transporte (letra, cifra, '
    + 'tom, corpo e rolagem), apontada para esta faixa e sem levar nada ao telão',
    JSON.stringify(g.leitor));
  checar(!!g.leitor && g.leitor.largura > 0 && g.leitor.largura === g.leitor.larguraDepois,
    'e ele não muda de largura ao ser tocado: o confirmar ao lado não encolhe '
    + 'debaixo do dedo (o pedido da v5.287 — a versão de duas frases sobrevive '
    + 'no vídeo, medida no `boot-nativo`)', JSON.stringify(g.leitor));
} catch (e) {
  checar(false, 'a medição da gaveta de opções terminou sem exceção ('
    + (e && e.message) + ')');
}

// ── O CARD DO ÁLBUM ABRE POR QUALQUER PIXEL (v5.288) ─────────────────────
//
// Relato do operador: *"nos álbuns há um toque em uma margem à esquerda da seta
// que abre o álbum, que encolhe os itens dentro do card, mas não abre o
// álbum"*.
//
// A causa não é o pixel, é o FEEDBACK: `.coll-bar` está na lista do `:active`,
// cujo `--press` é `scale(.96)` — numa barra de ~395px isso a encolhe ~8px de
// cada lado. O `pointerdown` acerta a barra (e dispara o encolhimento); no
// `pointerup` ela já não está ali, e o `click` é entregue ao ancestral que
// sobrou, o card, que não tinha ouvinte nenhum.
//
// O caso mede o que o operador mediu com o dedo: um CLIQUE DE VERDADE
// (`mouse.click`, porque um `el.click()` sintético não passa por hit-test
// nenhum e aprovaria o defeito inteiro) a 2px da borda do card. E cobra as duas
// metades — com o álbum ABERTO, o mesmo toque na tampa FECHA, e um toque numa
// FAIXA não fecha nada.
try {
  const prep = async (aberto) => pg.evaluate(async (ab) => {
    setAppMode('full');
    if (!hymnSearchPopupEl.classList.contains('open')) openHymnSearch();
    const c = allCollections().find((x) => x.kind === 'hymnal');
    window.__cid = c.id;
    collState[c.id] = { indexSyncedAt: Date.now(), isHymnal: true,
      songs: [1, 2, 3].map((i) => ({ id_music: 'a' + i, name: 'Hino ' + i, track: i,
        has_instrumental_music: false, duration: '3:47' })) };
    window.__semearSecao();   // o `setAppMode` acima passou pelo reset (v1.1.4)
    grupoAberto = 'Álbuns de exemplo'; favAberto = false;
    ui(c.id).expanded = !!ab; ui(c.id).shown = 100;
    redesenharAcervo();
    await new Promise((r) => setTimeout(r, 500));
    const card = document.querySelector('#hymnResults .hymnal-card');
    card.scrollIntoView({ block: 'center' });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const cr = card.getBoundingClientRect();
    const ico = card.querySelector('.coll-bar-icon').getBoundingClientRect();
    const faixa = card.querySelector('.coll-songs > .hymn-result');
    const fr = faixa ? faixa.getBoundingClientRect() : null;
    return {
      borda: { x: Math.round(cr.left + 2), y: Math.round(ico.top + ico.height / 2) },
      faixa: fr ? { x: Math.round(fr.left + fr.width / 2), y: Math.round(fr.top + fr.height / 2) } : null,
      antes: ui(c.id).expanded,
    };
  }, aberto);
  const estado = () => pg.evaluate(() => !!ui(window.__cid).expanded);
  const alvo = () => pg.evaluate(() => {
    const p2 = document.querySelector('#hymnResults .hymnal-card');
    return p2 ? getComputedStyle(p2).paddingLeft : null;
  });
  // 1. FECHADO: 2px da borda abre.
  const a = await prep(false);
  await pg.mouse.click(a.borda.x, a.borda.y);
  await pg.waitForTimeout(400);
  const abriuNaBorda = await estado();
  const padCard = await alvo();
  // 2. ABERTO: a mesma borda (agora a tampa) FECHA.
  const b = await prep(true);
  await pg.mouse.click(b.borda.x, b.borda.y);
  await pg.waitForTimeout(400);
  const fechouNaBorda = !(await estado());
  // 3. ABERTO: um toque numa FAIXA não fecha o álbum.
  const c2 = await prep(true);
  await pg.mouse.click(c2.faixa.x, c2.faixa.y);
  await pg.waitForTimeout(400);
  const faixaNaoFecha = await estado();
  await pg.evaluate(() => {
    ui(window.__cid).expanded = false; grupoAberto = ''; favAberto = true;
    closeHymnSearch();
  });
  checar(abriuNaBorda,
    'O CARD DO ÁLBUM ABRE a 2px da borda (v5.288) — era a "margem à esquerda da '
    + 'seta" que o encolhimento do `:active` deixava sem alvo');
  checar(padCard === '0px',
    'e o card não tem padding próprio: o recuo é de quem PINTA (a barra e o '
    + 'corpo aberto), senão a faixa em volta da barra volta a ser margem morta',
    'padding-left do card: ' + padCard);
  checar(fechouNaBorda,
    'e com o álbum aberto o mesmo ponto FECHA — a tampa responde na borda dela');
  checar(faixaNaoFecha,
    'mas um toque numa FAIXA não fecha o álbum: a guarda é o `.coll-open`, e sem '
    + 'ela subir o ouvinte para o card teria fechado o álbum debaixo do dedo');
  // ===== E NEM UMA CAIXA DE MARCAÇÃO DAS OPÇÕES (v5.288, correção) =====
  //
  // Relato do operador logo depois do lote: tocar numa opção de play fechava o
  // álbum inteiro. A guarda perguntava `e.target.closest('.coll-open')` — uma
  // consulta à árvore VIVA —, e o botão de destino é apagado pelo próprio
  // handler que roda antes: marcar uma opção chama `renderSongMenu`, que faz
  // `alvo.innerHTML = ''`. Quando o evento chega ao card, o `e.target` está
  // DESANEXADO, `closest` devolve `null`, e o álbum fecha.
  //
  // O caso exercita a DETACHMENT de verdade — abrir a gaveta de uma faixa e
  // clicar numa opção marcável —, porque uma guarda escrita com `closest`
  // passaria em qualquer clique que não apagasse o alvo.
  await prep(true);
  const marcou = await pg.evaluate(async () => {
    const li = document.querySelector('#hymnResults .coll-songs > .hymn-result');
    li.querySelector('.row').click();
    await new Promise((r) => setTimeout(r, 450));
    const sels = [...li.querySelectorAll('.hymn-opcoes .song-menu-sel')];
    // A SEGUNDA opção, e não a primeira: desde a v1.1.8 o "Tocar agora" nasce
    // MARCADO, então tocar nele DESMARCA — e o caso mediria a ida ao contrário
    // do que a asserção diz. A segunda é "Adicionar à playlist", que nasce
    // limpa; o caminho de detachment exercitado é o MESMO (marcar chama
    // `renderSongMenu`, que faz `alvo.innerHTML = ''` e apaga o `e.target`).
    const b = sels[1];
    if (!b) return null;
    b.scrollIntoView({ block: 'center' });
    const r2 = b.getBoundingClientRect();
    return {
      x: Math.round(r2.left + r2.width / 2), y: Math.round(r2.top + r2.height / 2),
      // O PADRÃO, lido antes de qualquer toque: quantas caixas já vêm marcadas e
      // qual é o rótulo da que veio.
      jaMarcadas: [...li.querySelectorAll('.hymn-opcoes .song-menu-check.on')].length,
      rotuloMarcado: (sels.find((e) => e.querySelector('.song-menu-check.on'))
        || {}).textContent || '',
      confirmarAtivo: !(li.querySelector('.hymn-opcoes .song-menu-go') || {}).disabled,
    };
  });
  let opcaoNaoFecha = null; let opcaoMarcou = null;
  if (marcou) {
    await pg.mouse.click(marcou.x, marcou.y);
    await pg.waitForTimeout(400);
    const dep = await pg.evaluate(() => ({
      album: !!ui(window.__cid).expanded,
      marcado: [...document.querySelectorAll('#hymnResults .song-menu-check.on')].length === 2,
    }));
    opcaoNaoFecha = dep.album; opcaoMarcou = dep.marcado;
  }
  await pg.evaluate(() => {
    ui(window.__cid).expanded = false; grupoAberto = ''; favAberto = true;
    songMenuFor = null; closeHymnSearch();
  });
  // ===== "TOCAR AGORA" NASCE MARCADO (v1.1.8) =====
  // Pedido do operador: é a opção de mais urgência, e o que ela compra é o caso
  // de DOIS destinos — tocar em "Adicionar ao Cronograma" projeta E guarda no
  // mesmo toque. O confirmar nascer ATIVO é a outra metade: a gaveta abre já
  // respondível, em vez de com um botão morto pedindo uma escolha.
  checar(!!marcou && marcou.jaMarcadas === 1 && /Tocar agora/.test(marcou.rotuloMarcado),
    'a gaveta da Biblioteca abre com "Tocar agora" JÁ MARCADO, e só ele',
    marcou && (marcou.jaMarcadas + ' marcada(s): ' + JSON.stringify(marcou.rotuloMarcado)));
  checar(!!marcou && marcou.confirmarAtivo === true,
    'e o CONFIRMAR nasce ativo — a gaveta abre respondível, sem um toque só para '
    + 'destravar o botão');
  checar(opcaoNaoFecha === true && opcaoMarcou === true,
    'e um toque numa CAIXA DE MARCAÇÃO das opções não fecha o álbum — a guarda '
    + 'pergunta pelo CAMINHO do evento (fixado no disparo) e não pela árvore de '
    + 'agora, que o próprio handler acabou de desmontar',
    JSON.stringify({ album: opcaoNaoFecha, marcado: opcaoMarcou, ponto: marcou }));
} catch (e) {
  checar(false, 'a medição do alvo do card de álbum terminou sem exceção ('
    + (e && e.message) + ')');
}

// ── A COLUNA DA DIREITA NÃO SE MEXE (v5.242) ─────────────────────────────
// Pedido do operador: a seta de fechar o acordeão vai para a THUMB do álbum,
// "não precisando mover os números referentes ao tamanho do álbum que hoje
// ficam ao lado dessa seta que surge".
//
// A seta dividia a coluna da direita com o botão de baixar, e por isso o peso
// saltava ao abrir um álbum COMPLETO — ali aquele canto está vazio, e a seta o
// preenchia. Num álbum incompleto não saltava, o que é pior: o mesmo gesto
// movia ou não movia a tela conforme o estado do download.
//
// O caso mede a DISTÂNCIA do peso até a borda do card nos quatro estados, que é
// a coisa que o operador viu se mexer — e cobra os dois pares, senão reservar o
// lugar num deles e esquecer o outro passaria.
try {
  const col = await pg.evaluate(() => {
    setAppMode('full');
    const c = allCollections().find((x) => x.kind === 'hymnal');
    const medir = (completo, aberto) => {
      const songs = [];
      for (let i = 1; i <= 4; i++) {
        songs.push({ id_music: 'p' + i, name: 'Hino ' + i, track: i,
          has_instrumental_music: false, duration: '3:47',
          fileIdFull: (completo || i < 3) ? 'f' + i : null });
      }
      collState[c.id] = { indexSyncedAt: Date.now(), songs, isHymnal: true };
      window.__semearSecao();   // o `setAppMode` acima passou pelo reset (v1.1.4)
      grupoAberto = 'Álbuns de exemplo';
      ui(c.id).expanded = aberto; ui(c.id).shown = 100;
      const lista = document.createElement('ul');
      lista.className = 'hymnal-list';
      lista.style.width = '390px';
      document.body.appendChild(lista);
      renderCollectionsList(lista, () => {}, { semTotal: true });
      const card = lista.querySelector('.hymnal-card');
      // O TÍTULO é a régua desde a v5.247: o peso saiu da coluna da direita e
      // virou subtítulo, então quem denuncia um deslocamento daquela coluna é a
      // borda direita do nome — que ocupa a linha inteira e existe sempre.
      const alvo = card && card.querySelector('.coll-bar-name');
      const r = {
        borda: (card && alvo)
          ? Math.round(card.getBoundingClientRect().right - alvo.getBoundingClientRect().right) : -1,
        naThumb: !!(card && card.querySelector('.coll-bar-icon.coll-bar-fechar')),
        naDireita: !!(card && card.querySelector('.coll-bar-dl.coll-bar-cfg')),
        // ── A COLUNA DA DIREITA DEPOIS DA v1.1.16 ───────────────────────
        // Dois botões, cada um respondendo a uma pergunta: BAIXAR a "há o que
        // baixar?" (independente de aberto), REMOVER a "o álbum está aberto?".
        // Medidos separadamente porque as duas regras erram de jeitos
        // diferentes — e a segunda erra CARO: uma lixeira num card fechado é
        // destruição a um toque de distância numa lista inteira de cards.
        temDl: !!(card && card.querySelector('.coll-bar .coll-bar-dl:not(.coll-bar-rm)')),
        temRm: !!(card && card.querySelector('.coll-bar .coll-bar-rm')),
        // VISÍVEL de verdade, não só presente: até a v1.1.15 o botão de baixar
        // continuava no DOM com o card aberto e era escondido por
        // `visibility` (`vago`). Uma asserção de presença aprovaria aquilo.
        dlVisivel: (() => {
          const b = card && card.querySelector('.coll-bar .coll-bar-dl:not(.coll-bar-rm)');
          if (!b) return false;
          const cs = getComputedStyle(b);
          return cs.visibility !== 'hidden' && cs.display !== 'none'
            && b.getBoundingClientRect().width > 0;
        })(),
        // Os dois dividem a coluna: centros que discordam num par colado é a
        // coisa que mais parece defeito numa linha.
        parAlinhado: (() => {
          const d = card && card.querySelector('.coll-bar .coll-bar-dl:not(.coll-bar-rm)');
          const m = card && card.querySelector('.coll-bar .coll-bar-rm');
          if (!d || !m) return null;
          const rd = d.getBoundingClientRect(), rm = m.getBoundingClientRect();
          return Math.abs((rd.top + rd.bottom) / 2 - (rm.top + rm.bottom) / 2) <= 1
            && Math.round(rd.width) === Math.round(rm.width)
            && Math.round(rd.height) === Math.round(rm.height);
        })(),
      };
      lista.remove();
      return r;
    };
    const r = {
      completoFechado: medir(true, false), completoAberto: medir(true, true),
      parcialFechado: medir(false, false), parcialAberto: medir(false, true),
    };
    delete collState[c.id]; grupoAberto = ''; favAberto = true;
    return r;
  });
  checar(col.completoAberto.naThumb && !col.completoAberto.naDireita,
    'a seta de fechar o álbum mora na THUMB, não na coluna da direita');
  // ── A SETA É A THUMBNAIL DAS RAÍZES (v5.244) ───────────────────────────
  // Pedido do operador: a seção ganha a mesma thumb do card, e nas duas ela
  // carrega a seta — "nas raízes mais altas o ideal é a seta, pois ela
  // representa que pode abrir mais listagens"; ícone fica na folha.
  //
  // As metades: a seta está lá nos DOIS estados do álbum (era o glifo da
  // coleção com o card fechado), a seção tem a MESMA caixa, e a direção é
  // legível — fechado ela aponta para baixo, aberto para cima.
  checar(col.completoFechado.naThumb,
    'e ela está lá com o álbum FECHADO também — a thumb é a seta, não o glifo '
    + 'da coleção (que era o mesmo em todos os álbuns)');
  try {
    const raiz = await pg.evaluate(() => {
      setAppMode('full');
      const lista = document.createElement('ul');
      lista.className = 'hymnal-list';
      lista.style.width = '390px';
      document.body.appendChild(lista);
      grupoAberto = '';   // nenhuma coleção aberta: é do estado FECHADO que este caso fala
      renderCollectionsList(lista, () => {}, { semTotal: true });
      const cx = (el) => (el ? getComputedStyle(el) : null);
      // Uma seção FECHADA: desde a v5.276 os Favoritos nascem abertos e são a
      // primeira do documento, então o `:not(.aberto)` é o que faz esta medida
      // continuar falando do estado que ela nomeia.
      const secao = lista.querySelector('.coll-group--drop:not(.aberto) > .coll-group-bar > .coll-group-icon');
      const s = cx(secao);
      const r = {
        temSeta: !!secao,
        // A MESMA CAIXA do card: mesmo tamanho e mesmo tom.
        caixa: s ? [s.width, s.height, s.backgroundColor].join(' ') : '',
        // Fechada, ela aponta para BAIXO (girada meia volta).
        girada: !!(s && /matrix\(-1, 0, 0, -1/.test(s.transform)),
        // TODA seção tem a seta, e todas são botões (v5.262). Até aqui os
        // Favoritos eram um `<span class="vago">` — um lugar reservado, sem
        // seta e sem gesto —, e essa exceção saiu com o `fixo`.
        setas: lista.querySelectorAll('.coll-group--drop > .coll-group-bar > button.coll-group-icon').length,
        secoes: lista.querySelectorAll('.coll-group--drop').length,
      };
      lista.remove();
      return r;
    });
    const cardCaixa = await pg.evaluate(() => {
      const el = document.createElement('div');
      el.className = 'coll-bar-icon';
      document.body.appendChild(el);
      const s = getComputedStyle(el);
      const v = [s.width, s.height, s.backgroundColor].join(' ');
      el.remove();
      return v;
    });
    checar(raiz.temSeta && raiz.caixa === cardCaixa,
      'a SEÇÃO tem a mesma thumb do card do álbum — uma caixa só, um tom só ('
      + raiz.caixa + ')');
    checar(raiz.girada,
      'e fechada ela aponta para BAIXO: a seta diz para onde o toque leva');
    checar(raiz.secoes > 1 && raiz.setas === raiz.secoes,
      'e TODA seção tem a dela, botão e não enfeite — não sobrou nenhuma que '
      + 'reserve o lugar sem oferecer o gesto',
      raiz.setas + ' seta(s) em ' + raiz.secoes + ' seção(ões)');
  } catch (e) {
    checar(false, 'a medição da thumb das raízes terminou sem exceção (' + (e && e.message) + ')');
  }
  // ===== A COLUNA DA DIREITA, DEPOIS DA v1.1.16 =====
  //
  // Pedido do operador: *"coloque o botão de excluir na direita no card do
  // título do álbum, ali onde fica o botão de download… deixe o botão de
  // excluir apenas visível quando abrir o álbum"* — e a verificação, que virou
  // automática, levou junto o painel que repetia o "Baixar" dois centímetros
  // abaixo (era ele que obrigava o da barra a se esconder com o card aberto).
  //
  // Os QUATRO estados, e cada um cobra uma metade diferente. O que erra CARO é
  // a lixeira no card FECHADO: o acervo é uma lista de cards fechados, e ali
  // ela seria destruição a um toque de distância, repetida linha a linha.
  checar(!col.completoFechado.temRm && !col.parcialFechado.temRm,
    'FECHADO, nenhum álbum mostra a lixeira — o acervo é uma lista de cards '
    + 'fechados, e destruição não se oferece em série',
    JSON.stringify([col.completoFechado.temRm, col.parcialFechado.temRm]));
  checar(col.completoAberto.temRm && col.parcialAberto.temRm,
    'ABERTO, os dois mostram — o mesmo gesto que revela o conteúdo revela o '
    + 'botão que o apaga');
  checar(!col.completoFechado.temDl && !col.completoAberto.temDl,
    'um álbum COMPLETO não tem botão de baixar em estado nenhum: não há o que baixar');
  checar(col.parcialFechado.dlVisivel && col.parcialAberto.dlVisivel,
    'e o de um álbum INCOMPLETO fica VISÍVEL nos dois estados — o `vago` saiu com '
    + 'o painel que repetia a ação, e a barra é o que gruda no topo enquanto se '
    + 'percorre a lista',
    JSON.stringify([col.parcialFechado.dlVisivel, col.parcialAberto.dlVisivel]));
  checar(col.parcialAberto.parAlinhado === true,
    'e com os dois na coluna eles têm o mesmo tamanho e o mesmo centro',
    JSON.stringify(col.parcialAberto.parAlinhado));
} catch (e) {
  checar(false, 'a medição da coluna da direita terminou sem exceção (' + (e && e.message) + ')');
}

// ── O PESO É SUBTÍTULO, E O CARD NÃO CRESCE (v5.247) ─────────────────────
// Pedido do operador: o peso vira um subtítulo abaixo do título, "pois
// atualmente ele está apertando o espaço disponível para o título dos álbuns.
// Mas garanta que os cards não fiquem mais altos por causa disso."
//
// São duas metades, e a segunda é a que torna a primeira aceitável — por isso
// as duas são medidas aqui. E nenhuma delas fixa um pixel: a altura é travada
// pela THUMB (é ela que manda, e o texto tem de caber nela), e a largura do
// título é comparada ENTRE CARDS — com e sem subtítulo o nome tem de ter a
// mesma linha, que é literalmente "o metadado não aperta mais o título".
try {
  const peso = await pg.evaluate(() => {
    setAppMode('full');
    // OS DOIS CARDS NA MESMA SEÇÃO (v1.0.1): um COM subtítulo e um SEM. Eles
    // eram um álbum e um hinário, em duas passadas — e o hinário subiu para a
    // RAIZ, que é outro contêiner e outra largura útil (a seção recua .4rem de
    // cada lado). A comparação de largura só significa alguma coisa entre
    // irmãos, e "com e sem subtítulo" nunca precisou de dois TIPOS de coleção.
    // O sem-subtítulo ainda diz o peso: um álbum sem índice desenha
    // "não sincron." na mesma coluna (ver `renderCollectionCard`).
    albumCatalog.categories = [{ name: 'CDs do ano', albums: [
      { id_album: 91, name: 'CD Jovem — Ao Vivo', subtitle: 'Coral e orquestra' },
      { id_album: 92, name: 'CD Louvor da Manhã' },
    ] }];
    albumCatalog.albums = [{ id_album: 91, name: 'CD Jovem — Ao Vivo' },
      { id_album: 92, name: 'CD Louvor da Manhã' }];
    const lista = document.createElement('ul');
    lista.className = 'hymnal-list';
    lista.style.width = '390px';
    document.body.appendChild(lista);
    const ler = (card) => {
      const alt = (sel) => {
        const el = card.querySelector(sel);
        return el ? el.getBoundingClientRect().height : 0;
      };
      return {
        // O peso saiu da BARRA (filho direto) e virou filho da coluna de texto.
        naColuna: !!card.querySelector('.coll-bar-info .coll-bar-sync'),
        naBarra: !!card.querySelector('.coll-bar > .coll-bar-sync'),
        larguraNome: card.querySelector('.coll-bar-name').getBoundingClientRect().width,
        alturaTexto: alt('.coll-bar-info'),
        alturaThumb: alt('.coll-bar-icon'),
        // Metadado numa linha só: o subtítulo e o peso são irmãos, não duas
        // linhas empilhadas.
        metaLinhas: card.querySelectorAll('.coll-bar-meta').length,
        temSub: !!card.querySelector('.coll-bar-sub'),
      };
    };
    // UMA PASSADA, e o escopo é a SEÇÃO ABERTA (v1.0.1): as coleções fixas
    // desenham na raiz em qualquer passada, e um seletor solto entregaria o
    // primeiro card DELAS — que se apoia na folha, não na seção.
    grupoAberto = 'CDs do ano';
    lista.innerHTML = '';
    renderCollectionsList(lista, () => {}, { semTotal: true });
    const r = [...lista.querySelectorAll(
      '.coll-group--drop.aberto:not(.coll-group--fav) .hymnal-card')].map(ler);
    lista.remove();
    // DEVOLVE A SEMENTE, não o vazio: os casos abaixo ainda precisam de uma
    // seção de coleção para medir (ver o bloco `SECAO`, no topo).
    albumCatalog.categories = [{ name: 'Álbuns de exemplo',
      albums: [{ id_album: 77, name: 'Álbum de exemplo' }] }];
    albumCatalog.albums = [{ id_album: 77, name: 'Álbum de exemplo' }];
    grupoAberto = ''; favAberto = true;
    return r;
  });
  const comSub = peso.find((c) => c.temSub);
  const semSub = peso.find((c) => !c.temSub);
  // Nem todo card TEM peso a dizer (um hinário sem índice não tem), e desde a
  // v5.247 ele simplesmente não desenha a linha. A regra é sobre ONDE ele fica
  // quando existe — e sobre nunca voltar a ser filho da barra.
  checar(peso.some((c) => c.naColuna) && !peso.some((c) => c.naBarra),
    'o PESO virou subtítulo: ele é filho da coluna de texto, nunca da barra');
  checar(!!comSub && !!semSub && Math.round(comSub.larguraNome) === Math.round(semSub.larguraNome),
    'e o título ocupa a linha inteira — a mesma largura com e sem subtítulo ('
    + (comSub ? Math.round(comSub.larguraNome) : '?') + 'px), que é o aperto que ele causava');
  checar(peso.every((c) => c.alturaTexto <= c.alturaThumb + 1),
    'e O CARD NÃO CRESCE: as duas linhas cabem na altura da THUMB, que continua '
    + 'sendo quem manda ('
    + (peso[0] ? Math.round(peso[0].alturaTexto) + 'px de texto em '
      + Math.round(peso[0].alturaThumb) + 'px de thumb' : '?') + ')');
  checar(!!comSub && comSub.metaLinhas === 1,
    'com o subtítulo do pivô e o peso na MESMA linha — uma linha por peça faria '
    + 'o card crescer conforme o catálogo');
} catch (e) {
  checar(false, 'a medição do peso como subtítulo terminou sem exceção (' + (e && e.message) + ')');
}

// ── A TROCA DE MODO É UMA SÓ, E MORA EM CONFIGURAÇÕES (v5.247 · v5.250) ──
//
// Dois pedidos do operador, em sequência: tirar a troca de modo do cabeçalho do
// avançado ("já temos nas configurações o botão de acesso ao modo simples"), e
// então criar no Modo Fácil "um botão de configurações, que fica onde é hoje o
// botão de modo avançado".
//
// A ORDEM IMPORTAVA: o botão do Modo Fácil não podia sair antes de existir a
// engrenagem, porque daquele modo não havia como chegar a Configurações — a
// outra engrenagem mora na coluna do mixer, dentro da `.bottombar`, que ele
// esconde por inteiro. Tirar os dois de uma vez teria TRANCADO o operador no
// Modo Fácil, e é isso que a asserção do caminho de saída guarda.
//
// A medição achou um efeito que não estava no pedido: com o botão de troca de
// modo fora do cabeçalho, o título da lista passou a ficar de fato CENTRADO —
// ele nunca esteve, vivia 63px à direita. Desde a v5.309 quem o mantém no eixo
// é a grade de três trilhas da faixa, e não a ausência de vizinhos: ver "O NOME
// DA TELA NÃO SE MEXE", que mede o mesmo eixo com o voltar EM CENA.
try {
  const modo = await pg.evaluate(() => {
    setAppMode('full');
    const t = document.getElementById('listTitle');
    const faixa = t.parentElement.getBoundingClientRect();
    const r = t.getBoundingClientRect();
    const seg = document.getElementById('appModeSeg');
    const eng = document.getElementById('simpleSettingsBtn');
    return {
      cabecalho: !document.getElementById('fullSimpleBtn'),
      desvio: Math.abs((r.left + r.width / 2) - (faixa.left + faixa.width / 2)),
      engrenagemNoFacil: !!eng && !!eng.closest('.simple-head'),
      sobrouTrocaDeModo: !!document.querySelector('.mode-switch'),
      opcoes: seg ? [...seg.querySelectorAll('.fit-opt')].map((b) => b.dataset.mode) : [],
    };
  });
  checar(modo.cabecalho,
    'o cabeçalho da lista NÃO tem mais a troca de modo — ela é a mesma decisão de Configurações');
  checar(modo.desvio <= 2,
    'e o TÍTULO fica centrado na faixa (o botão de troca de modo o empurrava '
    + '63px para a direita) — desvio de ' + Math.round(modo.desvio) + 'px');
  checar(!modo.sobrouTrocaDeModo,
    'e não sobrou nenhum `.mode-switch` no app: a troca de modo é UM controle, em Configurações');
  checar(modo.engrenagemNoFacil,
    'o Modo Fácil ganhou a ENGRENAGEM no cabeçalho, onde estava o botão que saiu');
  checar(modo.opcoes.includes('simple') && modo.opcoes.includes('full'),
    'e Configurações oferece os dois modos — o destino que substitui os dois botões');

  // O CAMINHO DE SAÍDA, exercitado: no Modo Fácil, a engrenagem abre a folha e
  // a folha troca o modo. Sem esta metade, apagar o botão passaria nas de cima
  // e trancaria o operador — que é exatamente o risco desta sequência.
  const saida = await pg.evaluate(async () => {
    setAppMode('simple');
    const eng = document.getElementById('simpleSettingsBtn');
    const folha = document.getElementById('fadePopup');
    // Null-safe pela disciplina do `ota.test.mjs`: num bundle sem a engrenagem
    // isto é um RESULTADO, não um acidente — e um `evaluate` que lança aqui
    // levaria junto as asserções seguintes, escondendo o que elas mediriam.
    if (!eng) { setAppMode('full'); return { visivel: false, abriu: false, saiu: false }; }
    // O toque é o do operador: a engrenagem tem de estar VISÍVEL e por cima da
    // tela do Modo Fácil (a folha é z-index 200; o modo, 90).
    const cs = getComputedStyle(eng);
    const visivel = cs.display !== 'none' && cs.visibility !== 'hidden' && eng.offsetParent !== null;
    eng.click();
    await new Promise((r) => setTimeout(r, 60));
    const abriu = folha.classList.contains('open');
    document.querySelector('#appModeSeg .fit-opt[data-mode="full"]').click();
    await new Promise((r) => setTimeout(r, 60));
    const saiu = !document.body.classList.contains('mode-simple')
      && !folha.classList.contains('open');
    setAppMode('full');
    return { visivel, abriu, saiu };
  });
  checar(saida.visivel, 'e ela está à vista no Modo Fácil, não escondida atrás dele');
  checar(saida.abriu, 'o toque nela ABRE Configurações');
  checar(saida.saiu,
    'e de lá o operador SAI do Modo Fácil — o caminho que a engrenagem precisava existir para dar');
} catch (e) {
  checar(false, 'a medição da troca de modo terminou sem exceção (' + (e && e.message) + ')');
}

// ── OS BOTÕES DA LINHA VIRAM UM SÓ (v5.258) ──────────────────────────────
//
// Relato do operador: *"hoje o título disputa com todos os botões de acesso
// rápido, cortando o título e subtítulo. Então use um botão de 3 pontos para
// indicar a abertura das opções."*
//
// As duas metades: a linha PARADA tem um botão só (e o nome cresce), e o toque
// nele REVELA as ações por cima da linha. Sem a segunda, apagar os botões
// passaria na primeira e deixaria o operador sem como favoritar nada.
try {
  const linha = await pg.evaluate(async () => {
    setAppMode('full');
    await AVDB.addMedia(new Blob(['x'], { type: 'audio/mpeg' }),
      { name: '147. Ó Adorai o Senhor em a Beleza da Sua Santidade', list: 'imports' });
    await load();
    const li = document.querySelector('#library .lib-item');
    if (!li) return null;
    const nome = () => Math.round(li.querySelector('.row-name').getBoundingClientRect().width);
    const caixa = li.querySelector('.row-acoes');
    const mais = li.querySelector('.row-mais');
    const vis = (el) => {
      const cs = getComputedStyle(el);
      return cs.visibility !== 'hidden' && cs.opacity !== '0';
    };
    const r = {
      // A linha PARADA: um botão só, direto na `.row`.
      botoesNaLinha: [...li.querySelectorAll('.row > button')].length,
      temMais: !!mais,
      nome: nome(),
      fechadaInvisivel: !!caixa && !vis(caixa),
      // As ações existem, guardadas: estrela e alça continuam lá.
      dentroDoMenu: !!caixa && caixa.querySelectorAll('button').length >= 2,
    };
    // NULL-SAFE de propósito: num bundle sem o `⋮` isto é um RESULTADO, e um
    // `evaluate` que lança aqui abortaria o arquivo inteiro, escondendo tudo o
    // que vem depois (a lição da v5.213).
    if (mais) mais.click();
    return r;
  });
  // A ABERTURA É ANIMADA (.14s de opacidade), então medir no mesmo turno do
  // clique leria o primeiro quadro — zero por definição. É a lição da v5.226:
  // a espera é, ela própria, a afirmação de que a transição existe.
  await pg.waitForTimeout(320);
  const aberta = await pg.evaluate(async () => {
    const li = document.querySelector('#library .lib-item');
    const caixa = li && li.querySelector('.row-acoes');
    const mais = li && li.querySelector('.row-mais');
    if (!li || !caixa || !mais) return {};
    const vis = (el) => {
      const cs = getComputedStyle(el);
      return cs.visibility !== 'hidden' && cs.opacity !== '0';
    };
    const r = {};
    const cr = caixa.getBoundingClientRect();
    const mr = mais.getBoundingClientRect();
    const nr = li.querySelector('.row-name').getBoundingClientRect();
    r.abriu = vis(caixa);
    // "para a sua esquerda sobre o item, cobrindo o título": a caixa termina
    // antes do `⋮` e COBRE o nome.
    r.aEsquerdaDoMais = cr.right <= mr.left + 1;
    r.cobreONome = cr.left <= nr.left + 1 && cr.right >= nr.right - 1;
    // E ela é OPACA: uma faixa translúcida por cima do título seria as duas
    // coisas ilegíveis em vez de uma.
    const bg = getComputedStyle(caixa).backgroundColor;
    r.opaca = !/rgba\(.*,\s*0(\.\d+)?\)$/.test(bg) && bg !== 'transparent';
    // Um toque em qualquer outro lugar fecha. **A ESPERA É OBRIGATÓRIA desde a
    // v5.270**: a gaveta passou a SAIR animada (o `visibility` entrou na
    // transição, e sem ele o fechamento nunca chegava a ser visto), então medir
    // no mesmo turno lê o quadro zero — a caixa ainda opaca e ainda visível.
    // O caso continua afirmando a mesma coisa; o que mudou é quando ele olha.
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await new Promise((f) => setTimeout(f, 320));
    r.fechouForaDela = !vis(caixa);
    return r;
  });
  checar(!!linha, 'a linha do Cronograma foi desenhada para medir');
  checar(!!linha && linha.botoesNaLinha === 1 && linha.temMais,
    'A LINHA TEM UM BOTÃO SÓ, o `⋮` — o resto saiu de cima do título',
    JSON.stringify(linha));
  checar(!!linha && linha.nome > 250,
    'e o NOME ficou com a largura que os botões ocupavam ('
    + (linha ? linha.nome : 0) + 'px, contra 194 antes)');
  checar(!!linha && linha.fechadaInvisivel && linha.dentroDoMenu,
    'as ações continuam existindo, guardadas e fora do toque enquanto o menu está fechado');
  checar(aberta.abriu && aberta.aEsquerdaDoMais && aberta.cobreONome,
    'o toque no `⋮` ABRE as ações à esquerda dele, cobrindo o título — o pedido, literal',
    JSON.stringify(aberta));
  checar(aberta.opaca,
    'e a faixa é OPACA: título e botões na mesma tinta seriam os dois ilegíveis');
  checar(aberta.fechouForaDela,
    'e um toque em qualquer outro lugar fecha o menu');
} catch (e) {
  checar(false, 'a medição do menu da linha terminou sem exceção (' + (e && e.message) + ')');
}

// ── UM REDESENHO NO LUGAR MANTÉM O LUGAR ─────────────────────────────────
//
// A última linha de `load()` restaurava `scrollPos[scrollKey()]` em TODO
// redesenho — e o único produtor daquele mapa é o `rememberScroll()` da troca
// de aba. Isto é: acrescentar um item, favoritar, o progresso de um download
// ou a chegada de um share jogavam a lista de volta para onde o operador
// estava da última vez que TROCOU DE ABA (quase sempre o topo). Ele rolava
// até o meio do Cronograma, mandava um louvor para lá, e a lista voltava
// para o começo.
//
// As duas metades: o redesenho no lugar PRESERVA, e a navegação continua
// RESTAURANDO — sem a segunda, "nunca restaurar" passaria e a volta para uma
// aba perderia a posição.
try {
  const rol = await pg.evaluate(async () => {
    setAppMode('full');
    activeTab = 'imports';
    for (let i = 0; i < 24; i++) {
      await AVDB.addMedia(new Blob(['r' + i], { type: 'audio/mpeg' }),
        { name: 'Louvor de rolagem ' + i, type: 'audio/mpeg', kind: 'audio', list: 'imports' });
    }
    await load({ restaurarScroll: true });
    await new Promise((f) => setTimeout(f, 150));
    const host = libraryEl;
    host.scrollTop = 300;
    const antes = host.scrollTop;
    if (!antes) return { erro: 'a lista não rolou (fixture curto demais)' };
    await load();                       // um redesenho no LUGAR
    await new Promise((f) => setTimeout(f, 150));
    const r = { antes, depoisDoRedesenho: libraryEl.scrollTop };
    // …e a NAVEGAÇÃO continua restaurando a posição daquela aba.
    await switchTab('bible');
    await new Promise((f) => setTimeout(f, 400));
    await switchTab('imports');
    await new Promise((f) => setTimeout(f, 400));
    r.depoisDaVolta = libraryEl.scrollTop;
    return r;
  });
  checar(!rol.erro && rol.depoisDoRedesenho === rol.antes,
    'um redesenho NO LUGAR mantém a rolagem da lista (antes: ' + rol.antes
    + ' → depois: ' + rol.depoisDoRedesenho + ')', JSON.stringify(rol));
  checar(!rol.erro && rol.depoisDaVolta === rol.antes,
    'e a NAVEGAÇÃO continua restaurando a posição guardada daquela aba',
    JSON.stringify(rol));
} catch (e) {
  checar(false, 'a medição da rolagem terminou sem exceção (' + (e && e.message) + ')');
}

// ── O NOME DA TELA NÃO SE MEXE ───────────────────────────────────────────
//
// Pedido do operador (v5.309): *"ajuste o título da aba Bíblia, que está se
// deslocando durante o processo de escolher o capítulo e versículo"*.
//
// O título era centrado no espaço que SOBRAVA de uma faixa flex, e o voltar
// entrava e saía do fluxo conforme a tela da Bíblia — então o único texto que
// responde "onde eu estou" dava um pulo de ~19px toda vez que o operador
// entrava num livro. Hoje a faixa é uma grade de trilhas fixas nos DOIS eixos.
//
// OS DOIS EIXOS, e é por isso que este bloco mede os dois: a v5.309 reservou só
// as COLUNAS e afirmou só o `x`, então o título parou de andar para o lado e
// continuou descendo 9px — com a lista inteira 19px atrás dele. O eixo que o
// oráculo não mede é o eixo em que o defeito volta, e aqui ele voltou na
// primeira tentativa.
//
// A terceira asserção prende a correção que a primeira convida: reservar as
// trilhas e não centrar deixaria o título parado e FORA DO EIXO em toda a
// interface, trocando um deslocamento por um desalinhamento.
try {
  const eixo = await pg.evaluate(async () => {
    // ESPERAR PELA CONDIÇÃO, NUNCA PELO RELÓGIO: um `setTimeout` calibrado
    // nesta máquina vira reprovação intermitente na do CI, e um oráculo que
    // pisca ensina a ignorar vermelho.
    const ate = async (cond, ms) => {
      const fim = Date.now() + (ms || 5000);
      while (Date.now() < fim) {
        if (cond()) return true;
        await new Promise((f) => setTimeout(f, 30));
      }
      return false;
    };
    setAppMode('full');
    // A LISTA entra na medição junto com o título: a altura da faixa era
    // implícita (a do item mais alto), então o voltar não empurrava só o nome
    // da tela — empurrava tudo que vem depois dele, que é o pulo que se vê.
    const onde = () => {
      const t = document.getElementById('listTitle').getBoundingClientRect();
      const h = document.querySelector('.list-header').getBoundingClientRect();
      const l = document.getElementById('library').getBoundingClientRect();
      return {
        x: Math.round(t.x), y: Math.round(t.y),
        meio: Math.round(t.x + t.width / 2), eixo: Math.round(h.x + h.width / 2),
        faixaH: Math.round(h.height), listaY: Math.round(l.y),
      };
    };
    await switchTab('imports');
    if (!await ate(() => document.getElementById('listTitle').textContent === 'Cronograma')) {
      return { erro: 'a aba Cronograma não foi desenhada' };
    }
    const crono = onde();
    await switchTab('bible');
    if (!await ate(() => !!document.querySelector('.bible-grid--books .bible-cell'))) {
      return { erro: 'a grade de livros não foi desenhada' };
    }
    const livros = onde();
    document.querySelector('.bible-grid--books .bible-cell').click();
    if (!await ate(() => !!document.querySelector('.bible-split'))) {
      return { erro: 'a tela de capítulo+versículo não foi desenhada' };
    }
    const capitulos = onde();
    const voltarAparece = !document.getElementById('backBtn').hidden;
    await switchTab('imports');
    await ate(() => document.getElementById('listTitle').textContent === 'Cronograma');
    return { crono, livros, capitulos, voltarAparece };
  });
  const emX = (a) => a.map((t) => t.x);
  const emY = (a) => a.map((t) => t.y);
  const telas = eixo.erro ? [] : [eixo.crono, eixo.livros, eixo.capitulos];
  const igual = (v) => v.every((n) => n === v[0]);
  checar(!eixo.erro && eixo.voltarAparece === true && igual(emX(telas)),
    'o nome da tela não anda PARA O LADO quando o voltar aparece — a coluna '
    + 'dele é reservada mesmo `hidden` (x: ' + emX(telas).join(' · ') + ')',
    JSON.stringify(eixo));
  checar(!eixo.erro && igual(emY(telas)) && igual(telas.map((t) => t.faixaH))
    && igual(telas.map((t) => t.listaY)),
    'e não DESCE tampouco: a linha da grade é declarada, então a altura da faixa '
    + 'não é mais a do item mais alto — sem ela o título caía 9px e a lista '
    + 'inteira 19px atrás dele (y: ' + emY(telas).join(' · ')
    + ' · faixa: ' + telas.map((t) => t.faixaH).join(' · ')
    + ' · lista: ' + telas.map((t) => t.listaY).join(' · ') + ')', JSON.stringify(eixo));
  checar(!eixo.erro && Math.abs(eixo.capitulos.meio - eixo.capitulos.eixo) <= 1,
    'e ele fica no EIXO da faixa, não deslocado para a direita dela — é o que o '
    + 'vão da trilha 3 existe para pagar', JSON.stringify(eixo));
} catch (e) {
  checar(false, 'a medição do eixo do título terminou sem exceção (' + (e && e.message) + ')');
}

// ── A GAVETA DA FILA DA PLAYLIST TAMBÉM ABRE ─────────────────────────────
//
// A faixa de acoes era revelada por `.lib-item.acoes-abertas .row-acoes`, e a
// linha da FILA e `.row-item` — ela nunca recebe `lib-item`. Como a v5.285
// tirou o arrasto e mudou o "Tirar da playlist" e o par ↑↓ para DENTRO dessa
// faixa, a fila do culto ficou sem como ser editada: o `⋮` respondia ao toque
// (a classe entrava no `li`) e nada aparecia.
//
// Medido pelo que o DEDO encontra, e não pela caixa do elemento: `visibility`
// e `opacity` sao o que o seletor errado deixava para tras, e um `getBounding`
// devolveria a mesma largura nos dois casos.
const GLIFO_EXCLUIR = await pg.evaluate(() => ICON.del);
try {
  const fila = await pg.evaluate(async () => {
    setAppMode('full');
    const m = await AVDB.addMedia(new Blob(['q'], { type: 'audio/mpeg' }),
      { name: 'Louvor da fila', type: 'audio/mpeg', kind: 'audio', list: 'playlist' });
    plItems = await AVDB.listItems('playlist');
    renderPlaylist();
    if (typeof openPlPopup === 'function') openPlPopup();
    await new Promise((f) => setTimeout(f, 200));
    const li = document.querySelector('#playlist .row-item');
    if (!li) return { erro: 'a linha da fila não foi desenhada' };
    const mais = li.querySelector('.row-mais');
    if (!mais) return { erro: 'a linha da fila não tem o botão ⋮' };
    mais.click();
    await new Promise((f) => setTimeout(f, 320));
    const caixa = li.querySelector('.row-acoes');
    if (!caixa) return { erro: 'a linha da fila não montou a gaveta' };
    const cs = getComputedStyle(caixa);
    const b = caixa.getBoundingClientRect();
    const alvo = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    const r = {
      visivel: cs.visibility === 'visible' && cs.opacity === '1',
      // e ela RECEBE O TOQUE: `visibility: hidden` tira do hit-test, então esta
      // é a metade que prova que os botões de dentro são alcançáveis.
      recebeToque: !!alvo && !!alvo.closest('.row-acoes'),
      temBotao: caixa.querySelectorAll('button').length >= 1,
    };
    // ---- O TIRAR DA FILA VESTE A LIXEIRA DO APP (v5.301) ----
    // Pedido do operador: *"na playlist, ajuste o botão de excluir para que
    // represente o mesmo ícone de excluir que já usamos no resto do sistema"*.
    // Era `playlist_remove`, o único destrutivo do app com símbolo próprio.
    // Medido pelo CODEPOINT contra o do excluir da linha do Cronograma, e não
    // contra um literal escrito aqui: os dois têm de ser o MESMO, seja ele qual
    // for.
    const rm = li.querySelector('.row-excluir');
    const glifoDaFila = rm && rm.querySelector('.msym')
      ? rm.querySelector('.msym').textContent : '';
    r.glifoDaFila = glifoDaFila;
    // E COM O ÍCONE VEM A CONFIRMAÇÃO: um mesmo desenho com dois alcances
    // conforme a tela (aqui apaga no toque, ali pergunta) é a pior forma de
    // oferecer um destrutivo.
    if (rm) {
      rm.click();
      await new Promise((f) => setTimeout(f, 200));
      r.perguntou = !!li.querySelector('.row-acoes.confirmando > .linha-confirma');
      r.aindaNaFila = await AVDB.listHas('playlist', m.id);
      const dlg = document.getElementById('appDialog');
      r.semModal = !dlg || !dlg.classList.contains('open');
      // E O PAR DIVIDE A FAIXA AO MEIO (v5.309). Ele era do tamanho do próprio
      // rótulo e encostado à direita: "Cancelar" e "Excluir" ficavam colados um
      // ao outro na metade direita de uma faixa vazia, com 8px entre dois alvos
      // de um destrutivo. Medido no RENDERIZADO e em duas metades, porque cada
      // uma cai por um motivo diferente — larguras iguais provam que os dois
      // crescem, e a soma contra a faixa prova que eles crescem até ela.
      const cxFila = li.querySelector('.linha-confirma');
      const parFila = [...cxFila.querySelectorAll('.linha-confirma-btn')]
        .map((b) => b.getBoundingClientRect());
      const faixaFila = li.querySelector('.row-acoes').getBoundingClientRect();
      r.parIgual = Math.abs(parFila[0].width - parFila[1].width) <= 1;
      r.parEnche = parFila[0].width + parFila[1].width >= faixaFila.width - 8;
      r.parLarguras = parFila.map((b) => Math.round(b.width)).join(' + ')
        + ' de ' + Math.round(faixaFila.width);
      li.querySelector('.linha-sim').click();
      await new Promise((f) => setTimeout(f, 400));
      r.saiuDaFila = !(await AVDB.listHas('playlist', m.id));
    }
    await AVDB.listRemove('playlist', m.id);
    plItems = await AVDB.listItems('playlist');
    renderPlaylist();
    if (typeof closePlPopup === 'function') closePlPopup();
    await new Promise((f) => setTimeout(f, 120));
    return r;
  });
  checar(!fila.erro && fila.visivel && fila.temBotao,
    'a gaveta `⋮` da FILA DA PLAYLIST fica visível ao toque — o seletor que a '
    + 'revela é a CLASSE, não a lista em que a linha mora', JSON.stringify(fila));
  checar(!fila.erro && fila.recebeToque,
    'e ela recebe o toque: os botões de tirar da fila e de reordenar são '
    + 'alcançáveis (era o único caminho por item que a fila tem)',
    JSON.stringify(fila));
  checar(!fila.erro && !!fila.glifoDaFila && fila.glifoDaFila === GLIFO_EXCLUIR,
    'e o "tirar da fila" veste a MESMA lixeira do excluir das outras listas '
    + '(v5.301) — era `playlist_remove`, o único destrutivo do app com símbolo '
    + 'próprio', JSON.stringify(fila.glifoDaFila));
  checar(!fila.erro && fila.perguntou === true && fila.aindaNaFila === true
    && fila.semModal === true && fila.saiuDaFila === true,
    'e ele PERGUNTA na própria faixa antes de tirar, como o das outras listas — '
    + 'um mesmo desenho com dois alcances conforme a tela é a pior forma de '
    + 'oferecer um destrutivo', JSON.stringify(fila));
  checar(!fila.erro && fila.parIgual === true && fila.parEnche === true,
    'e o par DIVIDE A FAIXA AO MEIO (v5.309): um na metade esquerda, outro na '
    + 'direita — encostados à direita, os dois alvos de um destrutivo ficavam a '
    + '8px um do outro (' + fila.parLarguras + 'px)', JSON.stringify(fila));
} catch (e) {
  checar(false, 'a medição da gaveta da fila terminou sem exceção (' + (e && e.message) + ')');
}

// ── LIMPAR A FILA INTEIRA ────────────────────────────────────────────────
//
// O botão que a v5.309 acrescentou ao rodapé da folha da playlist, a pedido do
// operador. Ele é o destrutivo de maior ALCANCE do app por toque — os outros
// tiram um item, este tira a fila do culto —, e o que o torna aceitável é a
// pergunta na própria caixa. Cada asserção cai por um motivo próprio: a pergunta
// que não abre devolve o toque direto que ninguém pediu; a que não executa deixa
// o botão morto; e a que sobrevive ao fechamento da folha esvaziaria a fila na
// abertura seguinte, sem ninguém ter tocado nela.
//
// O "Guardar como pacote" precisa CONTINUAR EM CENA: a pergunta troca o
// conteúdo da caixa do botão que a pediu, e só dela — no rodapé inteiro ela
// levaria o vizinho junto, e a folha encolheria sob o dedo no exato instante em
// que o operador mira um destrutivo.
try {
  const limpar = await pg.evaluate(async () => {
    setAppMode('full');
    // Mesma regra do bloco acima: espera-se a CONDIÇÃO, não o relógio.
    const ate = async (cond, ms) => {
      const fim = Date.now() + (ms || 5000);
      while (Date.now() < fim) {
        if (cond()) return true;
        await new Promise((f) => setTimeout(f, 30));
      }
      return false;
    };
    for (const n of ['a', 'b', 'c']) {
      await AVDB.addMedia(new Blob([n], { type: 'audio/mpeg' }),
        { name: 'Faixa ' + n, type: 'audio/mpeg', kind: 'audio', list: 'playlist' });
    }
    await load();
    openPlPopup();
    const faixa = document.getElementById('plClearFaixa');
    const botao = document.getElementById('plClear');
    if (!faixa || !botao) return { erro: 'o rodapé não tem o botão de limpar' };
    if (!await ate(() => faixa.getBoundingClientRect().height > 0)) {
      return { erro: 'a folha da playlist não abriu' };
    }
    const r = { antes: plItems.length, aVista: !faixa.hidden && faixa.getBoundingClientRect().height > 0 };
    const alturaAntes = Math.round(faixa.getBoundingClientRect().height);
    botao.click();
    if (!await ate(() => !!faixa.querySelector('.linha-confirma'))) {
      return Object.assign(r, { erro: 'a pergunta não abriu' });
    }
    const cx = faixa.querySelector('.linha-confirma');
    const par = [...cx.querySelectorAll('.linha-confirma-btn')];
    const cxs = par.map((b) => b.getBoundingClientRect());
    r.rotulos = par.map((b) => b.textContent).join(' · ');
    r.aoMeio = Math.abs(cxs[0].width - cxs[1].width) <= 1
      && cxs[0].width + cxs[1].width >= faixa.getBoundingClientRect().width - 8;
    r.pacoteFica = document.getElementById('plPack').getBoundingClientRect().height > 0;
    r.semPulo = Math.round(faixa.getBoundingClientRect().height) === alturaAntes;
    r.filaIntacta = plItems.length === r.antes;
    // FECHAR A FOLHA CANCELA — a mesma regra da gaveta da linha.
    closePlPopup();
    openPlPopup();
    await ate(() => faixa.getBoundingClientRect().height > 0);
    r.fecharCancelou = !faixa.querySelector('.linha-confirma') && plItems.length === r.antes;
    botao.click();
    if (!await ate(() => !!faixa.querySelector('.linha-sim'))) {
      return Object.assign(r, { erro: 'a pergunta não reabriu' });
    }
    faixa.querySelector('.linha-sim').click();
    await ate(() => plItems.length === 0);
    r.depois = plItems.length;
    r.noBanco = (await AVDB.listIds('playlist')).length;
    r.sumiu = faixa.hidden;
    closePlPopup();
    return r;
  });
  checar(!limpar.erro && limpar.aVista === true && limpar.rotulos === 'Cancelar · Limpar',
    'o rodapé da folha da playlist tem o LIMPAR, e ele pergunta na própria caixa '
    + '(' + limpar.rotulos + ')', JSON.stringify(limpar));
  checar(!limpar.erro && limpar.aoMeio === true && limpar.semPulo === true,
    'o par divide a caixa ao meio e ela NÃO muda de altura ao perguntar — a '
    + 'folha não pode pular sob o dedo que mira um destrutivo', JSON.stringify(limpar));
  checar(!limpar.erro && limpar.pacoteFica === true && limpar.filaIntacta === true,
    'e "Guardar como pacote" continua em cena: a pergunta troca o conteúdo da '
    + 'caixa que a pediu, não o rodapé inteiro', JSON.stringify(limpar));
  checar(!limpar.erro && limpar.fecharCancelou === true,
    'fechar a folha CANCELA a pergunta — herdar um "sim" pendente esvaziaria a '
    + 'fila na abertura seguinte, sem ninguém ter tocado nela', JSON.stringify(limpar));
  checar(!limpar.erro && limpar.depois === 0 && limpar.noBanco === 0 && limpar.sumiu === true,
    'e o CONFIRMAR esvazia a fila de verdade (memória e banco), e o botão some '
    + 'com ela — não há mais o que limpar', JSON.stringify(limpar));
} catch (e) {
  checar(false, 'a medição do limpar a fila terminou sem exceção (' + (e && e.message) + ')');
}

// ── O TOQUE LONGO AINDA ENTRA NA SELEÇÃO MÚLTIPLA ────────────────────────
//
// **Nenhum teste deste repositório tinha tocado numa linha da lista**, e foi
// por aí que passou o defeito que este caso existe para prender: a v5.287 tirou
// o parâmetro `semSelecao` de `attachRowGestures` e deixou o `if (semSelecao)
// return` no corpo. Num script clássico, LER um identificador não declarado
// lança `ReferenceError` — só a atribuição criaria uma global —, então todo
// `pointerdown` numa linha estourava ANTES de armar o `setTimeout`.
//
// O modo de falhar é o pior que esta base sabe produzir: o `pid` já tinha sido
// escrito na linha acima, então o toque CURTO continuava projetando e nada na
// tela mudava. O que sumia era a seleção múltipla inteira — e com ela o
// `deleteSelected`, que é o único excluir em lote do app.
//
// São DUAS metades, e a negativa não é enfeite: sem ela, um toque longo que
// ligasse a seleção em QUALQUER duração passaria — e aí o toque comum de
// projetar teria virado um seletor.
try {
  const sel = await pg.evaluate(async () => {
    setAppMode('full');
    activeTab = 'imports';
    await load();
    const li = document.querySelector('#library .lib-item');
    if (!li) return { erro: 'a linha do Cronograma não foi desenhada' };
    const corpo = li.querySelector('.row-name') || li;
    const bateu = (tipo, extra) => corpo.dispatchEvent(new PointerEvent(tipo,
      Object.assign({ pointerId: 7, clientX: 40, clientY: 40, bubbles: true }, extra || {})));
    const r = {};
    // ---- a metade NEGATIVA primeiro: um toque curto NÃO seleciona ----
    bateu('pointerdown');
    await new Promise((f) => setTimeout(f, 90));
    bateu('pointerup');
    await new Promise((f) => setTimeout(f, 60));
    r.curtoNaoSeleciona = selectionMode === false;
    // ---- e o toque LONGO entra na seleção, com o item marcado ----
    bateu('pointerdown');
    await new Promise((f) => setTimeout(f, 700));
    r.longoSeleciona = selectionMode === true;
    r.itemMarcado = selected instanceof Set ? selected.has(li.dataset.id) : null;
    bateu('pointerup');
    await new Promise((f) => setTimeout(f, 60));
    // E a barra de seleção — a porta do excluir em lote — está na tela.
    const barra = document.getElementById('selbar');
    r.barraVisivel = !!barra && !barra.hidden
      && getComputedStyle(barra).display !== 'none';
    if (selectionMode) exitSelection();
    await new Promise((f) => setTimeout(f, 60));
    return r;
  });
  checar(!sel.erro && sel.curtoNaoSeleciona,
    'um toque CURTO na linha não entra na seleção múltipla', JSON.stringify(sel));
  checar(!sel.erro && sel.longoSeleciona && sel.itemMarcado === true,
    'e o TOQUE LONGO entra, com o item já marcado — o único caminho para o '
    + 'excluir em lote (a v5.287 o tinha derrubado com um `ReferenceError` '
    + 'mudo em todo `pointerdown`)', JSON.stringify(sel));
  checar(!sel.erro && sel.barraVisivel,
    'e a barra de seleção aparece: é ela que hospeda o excluir em lote',
    JSON.stringify(sel));
} catch (e) {
  checar(false, 'a medição do toque longo terminou sem exceção (' + (e && e.message) + ')');
}

// ── A LINHA DEPOIS DO RELATO: uma caixa só, o Parar na capa (v5.259) ──────
//
// Quatro coisas do mesmo relato, e as quatro são medidas em pixel porque as
// quatro FORAM VISTAS em pixel: *"ele deve ocupar apenas a barra do título e
// subtítulo, não cortar a thumbnail"*, *"os botões surgem literalmente sobre o
// título, com ele visível no fundo"*, *"verifique o tamanho e a área de toque…
// a thumbnail e os botões devem ter os mesmos tamanhos"* e o encolhimento que
// *"deixa as margens esquerda e direita estranhas quando está no ar"*.
try {
  const geo = await pg.evaluate(async () => {
    setAppMode('full');
    const li = document.querySelector('#library .lib-item');
    if (!li) return null;
    const cx = (el) => el.getBoundingClientRect();
    const thumb = li.querySelector('.thumb');
    const caixa = li.querySelector('.row-acoes');
    const mais = li.querySelector('.row-mais');
    const r = {};
    // 1. A FAIXA COMEÇA DEPOIS DA CAPA. (Ela partia de `--hit`, 34px, onde quem
    //    ocupa o canto é a miniatura, de 40px: comia 6px dela.)
    r.thumbInteira = Math.round(cx(caixa).left) >= Math.round(cx(thumb).right);
    // 2. TODOS OS QUADRADOS DA LINHA MEDEM O MESMO.
    const alvos = [...li.querySelectorAll('.row-btn, .row-handle, .row-mais')];
    const larguras = alvos.map((b) => Math.round(cx(b).width));
    r.caixaDaThumb = Math.round(cx(thumb).width);
    r.mesmaCaixa = larguras.length > 0 && larguras.every((w) => w === r.caixaDaThumb);
    r.alvo = r.caixaDaThumb;
    r.maisMede = Math.round(cx(mais).width);
    // 3. O PARAR MORA DENTRO DA CAPA e a cobre inteira.
    li.classList.add('no-ar');
    const stop = li.querySelector('.row-stop');
    r.stopNaThumb = !!stop && stop.parentElement === thumb;
    const sr = stop && cx(stop);
    r.stopCobreACapa = !!sr && Math.round(sr.width) === r.caixaDaThumb
      && Math.round(sr.height) === r.caixaDaThumb;
    r.stopVisivel = !!stop && getComputedStyle(stop).display !== 'none';
    // 4. E A FAIXA CONTINUA OPACA COM A LINHA NO AR — era aqui que o título
    //    aparecia atrás dos botões, porque `--live-soft` tem alfa .22.
    const bg = getComputedStyle(caixa).backgroundColor;
    const m = bg.match(/rgba?\(([^)]+)\)/);
    const partes = m ? m[1].split(',').map((x) => parseFloat(x)) : [];
    r.alfaNoAr = partes.length === 4 ? partes[3] : 1;
    r.bgNoAr = bg;
    li.classList.remove('no-ar');
    // 5. E A ESTRELA É UM BOTÃO COMO OS OUTROS (v5.288). Pedido do operador:
    //    *"verifique o design do favoritar no cronograma, para que seja um
    //    botão quadrado igual as outras opções"*. Ela era `background:
    //    transparent` — a única peça da fileira sem caixa —, com um argumento
    //    que valia quando ela morava NA LINHA e expirou quando ela desceu para
    //    a gaveta do `⋮` (v5.258). A régua é a dos VIZINHOS, e não um valor
    //    escrito: um token novo do dia seguinte não pode reprovar isto.
    //
    //    E DESDE A v1.4.25 A MEDIDA SEPARA APAGADO DE LIGADO. Relato do
    //    operador: *"ao invés de modificar o ícone do botão e seus efeitos, foi
    //    simplesmente ofuscado o botão inteiro, o que dá a impressão de que não
    //    está disponível a opção"*. A resposta foi a linguagem de estado que
    //    `tokens.css` já escreve — LIGADO é `--btn-accent`, apagado é o
    //    `.row-btn` de sempre —, e com ela "todos os fundos iguais" deixou de
    //    ser a régua certa: ela reprovaria justamente o desenho pedido.
    //
    //    O que continua sendo régua são DUAS coisas, e as duas caem por motivos
    //    diferentes: nenhum botão da fileira é TRANSPARENTE (o defeito original,
    //    a estrela sem caixa), e os APAGADOS vestem todos a MESMA caixa — um
    //    alternador apagado com tinta própria é o "ofuscado" voltando por outra
    //    porta.
    const daFaixa = [...caixa.querySelectorAll('.row-btn')];
    r.fundosDaFaixa = daFaixa.map((b) => getComputedStyle(b).backgroundColor);
    r.fundosApagados = daFaixa.filter((b) => !b.classList.contains('on'))
      .map((b) => getComputedStyle(b).backgroundColor);
    r.fundosLigados = daFaixa.filter((b) => b.classList.contains('on'))
      .map((b) => getComputedStyle(b).backgroundColor);
    // E A COR DO TRAÇO de um alternador APAGADO é a dos vizinhos, não a de um
    // botão morto: era `--line` (a cor de LINHA, que neste app só o ↑↓ INERTE
    // veste) contra o `--text` de toda a fileira.
    const apagado = daFaixa.find((b) => /fav-btn|row-playlist|row-crono/.test(b.className)
      && !b.classList.contains('on'));
    const vizinho = daFaixa.find((b) => !/fav-btn|row-playlist|row-crono/.test(b.className));
    r.tracoApagado = apagado ? getComputedStyle(apagado).color : null;
    r.tracoVizinho = vizinho ? getComputedStyle(vizinho).color : null;
    r.temEstrela = !!caixa.querySelector('.fav-btn');
    return r;
  });
// ── A GAVETA DA LINHA: o que fecha e o que não fecha (v5.288) ────────────
//
// Dois pedidos do operador: *"no cronograma, favoritar um item faz a gaveta de
// opções fechar, mantenha ela aberta"* e *"coloque o botão de excluir mais à
// esquerda na lista de opções, já que excluir deve ficar o mais longe de um
// acidente de clique de fechar opções"*.
//
// A ESTRELA fechava por DOIS caminhos independentes, e consertar um só teria
// deixado o defeito de pé: o ouvinte de captura da caixa (que fecha em qualquer
// botão) e o `renderLibrary` que `toggleFav` agenda depois do pulso — este
// último reconstrói a linha inteira. Daí a medição ser em dois tempos.
try {
  const gav = await pg.evaluate(async () => {
    setAppMode('full');
    activeTab = 'imports';
    const m = await AVDB.addMedia(new Blob([new Uint8Array(8)], { type: 'audio/mpeg' }),
      { name: 'Item da gaveta', type: 'audio/mpeg', kind: 'audio', list: 'imports' });
    await load();
    const li = document.querySelector('#library .lib-item[data-id="' + m.id + '"]');
    if (!li) return { erro: 'a linha não foi desenhada' };
    li.querySelector('.row-mais').click();
    await new Promise((r) => setTimeout(r, 200));
    const caixa = li.querySelector('.row-acoes');
    // ---- A ORDEM: o excluir é o PRIMEIRO da faixa ----
    const botoes = [...caixa.querySelectorAll('.row-btn')];
    const ordem = botoes.map((b) => b.className.replace('row-btn ', ''));
    const excluiPrimeiro = botoes.length > 1 && botoes[0].classList.contains('row-excluir');
    // E ele é o mais LONGE do `⋮`, que é o alvo que se toca repetidamente.
    const mais = li.querySelector('.row-mais').getBoundingClientRect();
    const dExcluir = Math.abs(mais.left - botoes[0].getBoundingClientRect().right);
    const dUltimo = Math.abs(mais.left
      - botoes[botoes.length - 1].getBoundingClientRect().right);
    // ---- A ESTRELA NÃO FECHA: no ato, e depois do redesenho ----
    const estrela = caixa.querySelector('.fav-btn');
    estrela.click();
    await new Promise((r) => setTimeout(r, 120));
    const logoDepois = !!document.querySelector('#library .lib-item.acoes-abertas');
    // O `renderLibrary` de `toggleFav` é agendado em PULSO_MS (1100ms): é ele
    // que apaga o `li`, e é a segunda metade do defeito.
    await new Promise((r) => setTimeout(r, 1500));
    const alvo2 = document.querySelector('#library .lib-item[data-id="' + m.id + '"]');
    const r = {
      ordem, excluiPrimeiro, dExcluir: Math.round(dExcluir), dUltimo: Math.round(dUltimo),
      logoDepois,
      depoisDoRedesenho: !!(alvo2 && alvo2.classList.contains('acoes-abertas')),
      // E a marca de fato pegou — sem isto, "a gaveta continua aberta" poderia
      // significar apenas que o toque não fez nada.
      favoritou: !!(alvo2 && alvo2.querySelector('.fav-btn.on')),
      // A METADE NEGATIVA — ver abaixo. Sem ela, calar o ouvinte inteiro
      // passaria.
      vazioFecha: null,
      renomearAbreNaFaixa: null,
    };
    const li2 = document.querySelector('#library .lib-item[data-id="' + m.id + '"]');
    if (li2 && !li2.classList.contains('acoes-abertas')) li2.querySelector('.row-mais').click();
    await new Promise((res) => setTimeout(res, 150));
    // ===== O RENOMEAR DEIXOU DE FECHAR (v1.4.25) =====
    // Ele era a metade negativa deste bloco: o botão que TERMINA a conversa,
    // provando que o ouvinte da caixa não tinha sido calado inteiro. Desde a
    // v1.4.25 ele não termina nada — abre o CAMPO dentro da própria faixa, como
    // o excluir abre a pergunta —, e continuar cobrando o fecho seria cobrar o
    // popup que o operador pediu para tirar.
    const lapis = document.querySelector('#library .lib-item.acoes-abertas .row-acoes .row-renomear');
    if (lapis) {
      lapis.click();
      await new Promise((res) => setTimeout(res, 150));
      const abertaAinda = document.querySelector('#library .lib-item.acoes-abertas');
      r.renomearAbreNaFaixa = !!abertaAinda
        && !!abertaAinda.querySelector(
          '.row-acoes.confirmando > .linha-renome > .linha-renome-campo');
      // Esc devolve a fileira — e é ele que devolve a faixa ao estado em que o
      // resto deste bloco a mede.
      const campo = abertaAinda && abertaAinda.querySelector('.linha-renome-campo');
      if (campo) campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await new Promise((res) => setTimeout(res, 120));
    }
    // A METADE NEGATIVA, no que sobrou dela: o VAZIO da caixa fecha. Toda AÇÃO
    // da fileira do Cronograma é hoje uma exceção (as três alternam, as duas
    // que sobram abrem algo dentro da própria faixa), então é ele — o `alvo ===
    // caixa` do mesmo ouvinte — que prova que o ouvinte continua vivo.
    const abertaPraVazio = document.querySelector('#library .lib-item.acoes-abertas');
    if (abertaPraVazio) {
      const cxa = abertaPraVazio.querySelector('.row-acoes');
      cxa.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise((res) => setTimeout(res, 150));
      r.vazioFecha = !document.querySelector('#library .lib-item.acoes-abertas');
    }
    await AVDB.listRemove('favs', m.id);
    await AVDB.listRemove('imports', m.id);
    await load();
    return r;
  });
  checar(!gav.erro && gav.excluiPrimeiro,
    'O EXCLUIR É O PRIMEIRO da faixa de ações (v5.288) — o mais longe do `⋮`, '
    + 'que é o alvo tocado repetidamente e cujo erro caía no destrutivo',
    JSON.stringify(gav.ordem));
  checar(!gav.erro && gav.dExcluir > gav.dUltimo,
    'e a distância confirma: ele é o mais afastado do `⋮` da fileira ('
    + gav.dExcluir + 'px contra ' + gav.dUltimo + 'px do último)');
  checar(!gav.erro && gav.logoDepois && gav.depoisDoRedesenho && gav.favoritou,
    'FAVORITAR NÃO FECHA A GAVETA (v5.288), nem no ato nem depois do redesenho '
    + 'que `toggleFav` agenda — e a estrela de fato acendeu',
    JSON.stringify([gav.logoDepois, gav.depoisDoRedesenho, gav.favoritou]));
  checar(!gav.erro && gav.renomearAbreNaFaixa === true,
    'e o RENOMEAR abre o campo DENTRO da faixa (v1.4.25), em vez de fechar a '
    + 'gaveta e subir um popup de tela cheia — a mesma correção que o excluir '
    + 'recebeu na v5.301', 'campo na faixa: ' + gav.renomearAbreNaFaixa);
  checar(!gav.erro && gav.vazioFecha === true,
    'mas o VAZIO da caixa continua fechando — com toda AÇÃO da fileira virada '
    + 'exceção, é ele que prova que o ouvinte não foi calado inteiro',
    'vazio fechou: ' + gav.vazioFecha);
} catch (e) {
  checar(false, 'a medição da gaveta da linha terminou sem exceção ('
    + (e && e.message) + ')');
}

// ── O `⋮` CEDE A COLUNA AO PROCESSO, E A CAPA SAI JUNTO (v1.4.27) ────────
//
// Pedido do operador: durante o renomear e a confirmação de exclusão o `⋮`
// *"contradiz o fluxo dos botões, pois o processo de exclusão e o de renomear
// já devem ter métodos de retorno/cancelamento"*; a capa sai junto *"para ter
// mais espaço"*; e a coluna do `⋮` vira o *"botão indicativo"* do processo.
//
// TRÊS METADES, e cada uma cai por um motivo próprio:
//  1. as duas colunas SOMEM (um `⋮` aceso ao lado de "Cancelar/Excluir" é uma
//     terceira saída para uma pergunta que já tem duas);
//  2. a faixa de fato GANHA a largura (sem isto o item 1 seria só uma remoção:
//     o operador pediu o espaço, não o sumiço);
//  3. a coluna continua OCUPADA, pelo símbolo do processo — sem ele a linha
//     encolheria e a faixa dançaria de largura no meio de um destrutivo.
//
// Medido no RENDERIZADO (`getClientRects`), e não pela classe: as duas colunas
// somem por uma regra de CSS (`:has(> .row-acoes.confirmando)`), e um teste de
// classe passaria com a regra ausente e a capa desenhada na tela.
try {
  const slot = await pg.evaluate(async () => {
    setAppMode('full');
    activeTab = 'imports';
    const m = await AVDB.addMedia(new Blob([new Uint8Array(8)], { type: 'audio/mpeg' }),
      { name: 'Item do slot', type: 'audio/mpeg', kind: 'audio', list: 'imports' });
    await load();
    const li = document.querySelector('#library .lib-item[data-id="' + m.id + '"]');
    if (!li) return { erro: 'a linha não foi desenhada' };
    li.scrollIntoView({ block: 'center' });
    li.querySelector('.row-mais').click();
    await new Promise((f) => setTimeout(f, 320));
    const vis = (sel) => {
      const el = li.querySelector(sel);
      return !!el && el.getClientRects().length > 0;
    };
    const larguraDaFaixa = () => {
      const c = li.querySelector('.row-acoes');
      return c ? Math.round(c.getBoundingClientRect().width) : 0;
    };
    const r = {
      // O ESTADO DE PARTIDA: com a gaveta comum aberta, as duas colunas ESTÃO
      // na tela. Sem esta metade, um seletor errado nas asserções de baixo
      // passaria por "sumiu".
      capaAntes: vis(':scope > .row > .thumb'),
      maisAntes: vis(':scope > .row > .row-mais'),
      faixaAntes: larguraDaFaixa(),
      // A ALTURA DOS QUADRADOS DA LINHA, medida com a gaveta comum aberta: é
      // contra ela que o par e o campo têm de bater (v1.4.29).
      alturaDoBotao: Math.round(
        li.querySelector('.row-acoes .row-btn').getBoundingClientRect().height),
    };
    // A CAIXA DO `⋮` MEDIDA AGORA, enquanto ele ainda está na tela: durante o
    // processo ele é `display: none` e o `getBoundingClientRect` dele é todo
    // zero — comparar contra um nó escondido aprovaria qualquer coisa.
    const caixaDoMais = li.querySelector(':scope > .row > .row-mais')
      .getBoundingClientRect();
    const mesmaCaixa = (el) => {
      if (!el) return false;
      const b = el.getBoundingClientRect();
      return Math.abs(b.right - caixaDoMais.right) <= 1
        && Math.abs(b.width - caixaDoMais.width) <= 1
        && Math.abs(b.height - caixaDoMais.height) <= 1;
    };
    // ---- a confirmação de exclusão ----
    li.querySelector('.row-excluir').click();
    await new Promise((f) => setTimeout(f, 260));
    r.delCapa = vis(':scope > .row > .thumb');
    r.delMais = vis(':scope > .row > .row-mais');
    r.delSimbolo = vis(':scope > .row > .row-slot--del');
    r.delFaixa = larguraDaFaixa();
    r.alturaPar = [...li.querySelectorAll('.linha-confirma-btn')]
      .map((b) => Math.round(b.getBoundingClientRect().height));
    // E O SÍMBOLO OCUPA A CAIXA QUE ERA DO `⋮`, não um lugar qualquer: a prova
    // é GEOMÉTRICA, porque "existe no DOM" não diz onde ele foi desenhado.
    r.delNaColuna = mesmaCaixa(li.querySelector(':scope > .row > .row-slot--del'));
    // ===== E UM TOQUE NELA NÃO PROJETA =====
    // A coluna fica FORA da faixa, e o que existe por baixo é a `.row`, cujo
    // toque põe o item NO AR. Tirar o símbolo do hit-test não resolveria: o
    // toque cairia na linha do mesmo jeito. Este é o pior desfecho que o
    // desenho da v1.4.27 sabe produzir — projetar a mídia que se está
    // perguntando se apaga —, e ele não deixa rastro nenhum na faixa.
    //
    // O TOQUE É DE PONTEIRO, e não um `click`: quem projeta uma linha do
    // Cronograma é o par `pointerdown`/`pointerup` do `attachRowGestures` (é
    // ele que também hospeda o toque longo), e um `MouseEvent('click')` não o
    // alcança — MEDIDO ao escrever esta asserção, que passava com a guarda
    // REMOVIDA. Um oráculo que não toca no caminho que mede aprova os dois
    // lados da mudança.
    const antesDoAr = currentId;
    const alvoLixo = li.querySelector(':scope > .row > .row-slot--del');
    const caixaLixo = alvoLixo.getBoundingClientRect();
    const ponto = {
      clientX: Math.round(caixaLixo.left + caixaLixo.width / 2),
      clientY: Math.round(caixaLixo.top + caixaLixo.height / 2),
      pointerId: 1, bubbles: true,
    };
    alvoLixo.dispatchEvent(new PointerEvent('pointerdown', ponto));
    await new Promise((f) => setTimeout(f, 60));
    alvoLixo.dispatchEvent(new PointerEvent('pointerup', ponto));
    alvoLixo.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((f) => setTimeout(f, 260));
    r.slotNaoProjeta = currentId === antesDoAr;
    r.perguntaFicou = !!li.querySelector('.row-acoes.confirmando > .linha-confirma');
    fecharConfirmacaoNaLinha();
    await new Promise((f) => setTimeout(f, 120));
    // ---- o renomear ----
    li.querySelector('.row-renomear').click();
    await new Promise((f) => setTimeout(f, 260));
    r.renCapa = vis(':scope > .row > .thumb');
    r.renMais = vis(':scope > .row > .row-mais');
    r.renOk = vis(':scope > .row > .row-slot--ok');
    r.renNaColuna = mesmaCaixa(li.querySelector(':scope > .row > .row-slot--ok'));
    r.renFaixa = larguraDaFaixa();
    r.alturaCampo = Math.round(
      li.querySelector('.linha-renome-campo').getBoundingClientRect().height);
    // O CAMPO É O ÚNICO FILHO DA FAIXA — o ✓ saiu dela para a coluna.
    const caixa = li.querySelector('.row-acoes .linha-renome');
    r.renSoCampo = !!caixa && caixa.children.length === 1
      && caixa.children[0].classList.contains('linha-renome-campo');
    // E O ✓ CONTINUA GRAVANDO de onde está: um botão que muda de casa e perde o
    // ouvinte é o defeito exato que esta mudança pode produzir.
    const campo = li.querySelector('.linha-renome-campo');
    campo.value = 'Nome pelo slot';
    // O ✓ é procurado NA COLUNA, e a ausência dele é um veredito e não uma
    // exceção: com o símbolo caindo no caminho B (o defeito que a asserção de
    // baixo pega) o `click` de um `null` derrubaria o bloco inteiro, e a
    // reprovação sairia como "terminou com exceção" em vez de dizer o que era.
    const okEl = li.querySelector(':scope > .row > .row-slot--ok');
    if (okEl) okEl.click();
    // ===== ESPERAR O FATO, E NÃO O RELÓGIO =====
    // O `click` do ✓ dispara uma continuação ASSÍNCRONA que este bloco não
    // espera: `renameMedia` e, depois dela, o `load()` do `aoGravar`. Com um
    // prazo fixo essa continuação ATRAVESSA a saída do bloco sob carga — e o
    // `load()` dela refaz o `innerHTML` da lista no meio do bloco SEGUINTE,
    // que fica medindo um `li` já destacado do documento: todos os retângulos
    // saem ZERO e a reprovação aparece no oráculo errado.
    //
    // MEDIDO: com o prazo fixo, 1 reprovação em 3 rodadas a 2× de carga, no
    // bloco dos 360px — que não tem nada a ver com esta mudança. É a classe "o
    // oráculo correndo contra o app" do `CLAUDE.md`, e a correção é a de lá:
    // esperar pela INGESTÃO (o nome no banco E na tela), nunca por um relógio.
    const ate = async (cond, ms) => {
      const fim = Date.now() + (ms || 5000);
      while (Date.now() < fim) {
        if (await cond()) return true;
        await new Promise((f) => setTimeout(f, 30));
      }
      return false;
    };
    const linhaNova = () => document
      .querySelector('#library .lib-item[data-id="' + m.id + '"] .row-name');
    r.renGravou = await ate(async () => {
      const rec = await AVDB.getMedia(m.id);
      const linha = linhaNova();
      return !!rec && rec.name === 'Nome pelo slot'
        && !!linha && linha.textContent === 'Nome pelo slot';
    });
    await AVDB.listRemove('imports', m.id);
    await load();
    return r;
  });
  checar(!slot.erro && slot.capaAntes === true && slot.maisAntes === true
    && slot.delCapa === false && slot.delMais === false
    && slot.renCapa === false && slot.renMais === false,
    'A CAPA E O `⋮` SAEM DE CENA durante os dois processos (v1.4.27) — o `⋮` é '
    + 'uma terceira saída para uma pergunta que já tem duas, e a capa já não '
    + 'identificava nada (na exclusão ela virava uma lixeira). Com a gaveta '
    + 'COMUM aberta os dois continuam lá', JSON.stringify(slot));
  checar(!slot.erro && slot.delFaixa > slot.faixaAntes && slot.renFaixa > slot.faixaAntes,
    'e a faixa GANHA a largura das duas colunas (' + slot.faixaAntes + 'px → '
    + slot.delFaixa + 'px) — o operador pediu o espaço, não o sumiço: sem esta '
    + 'metade, esconder as colunas seria só uma remoção', JSON.stringify(slot));
  checar(!slot.erro && slot.delSimbolo === true && slot.renOk === true
    && slot.delNaColuna === true && slot.renNaColuna === true,
    'e a COLUNA continua ocupada pelo símbolo do processo, na caixa exata do '
    + '`⋮` que ele substituiu — sem ocupante a linha encolheria e a faixa '
    + 'dançaria de largura no meio de um destrutivo', JSON.stringify(slot));
  checar(!slot.erro && slot.slotNaoProjeta === true && slot.perguntaFicou === true,
    'e um toque na LIXEIRA da coluna não projeta nada (v1.4.27): ela fica fora '
    + 'da faixa, e por baixo está a `.row`, cujo toque põe o item NO AR — pôr '
    + 'no ar a mídia que se está perguntando se apaga é o pior desfecho deste '
    + 'desenho, e ele não deixa rastro na faixa', JSON.stringify(slot));
  // ===== E A ALTURA DELES É A DOS QUADRADOS DA LINHA (v1.4.29) =====
  // Relato do operador: *"a altura dos botões de cancelar ou confirmar
  // exclusão, como também a altura da caixa de renomear, estão desalinhadas com
  // as alturas dos botões padrões de tudo dentro da gaveta, como o próprio
  // botão de confirmar renomeação"*. MEDIDO: 34px (`--hit`, o piso de toque do
  // app) contra os 40px (`--thumb`) de todo quadrado da linha — e o ✓ do
  // renomear era a régua que denunciava, porque ele é um `.row-slot` e já media
  // 40. Medido como IGUALDADE contra o botão da própria fileira, nunca contra
  // um número escrito aqui: a FILA usa `--hit` nos dois lados e está certa; um
  // piso em pixel reprovaria a lista certa e aprovaria a errada.
  checar(!slot.erro && (slot.alturaPar || []).length === 2
    && slot.alturaPar.every((h) => h === slot.alturaDoBotao)
    && slot.alturaCampo === slot.alturaDoBotao,
    'e o par e o campo têm a ALTURA dos quadrados da linha (v1.4.29): '
    + slot.alturaDoBotao + 'px, a mesma do botão da fileira e do símbolo da '
    + 'coluna — eram 34 contra 40, e o ✓ ao lado denunciava os 6px',
    JSON.stringify([slot.alturaDoBotao, slot.alturaPar, slot.alturaCampo]));
  checar(!slot.erro && slot.renSoCampo === true && slot.renGravou === true,
    'e o campo fica SOZINHO na faixa, com o ✓ gravando da coluna — um botão '
    + 'que muda de casa e perde o ouvinte é o defeito que esta mudança sabe '
    + 'produzir', JSON.stringify(slot));
} catch (e) {
  checar(false, 'a medição do slot do `⋮` terminou sem exceção ('
    + (e && e.message) + ')');
}

// ── O CARTÃO NÃO BALANÇA POR UM TOQUE NA GAVETA (v1.4.25) ────────────────
//
// Relato do operador: *"há um bug de deslocamento, um pequeno movimento
// vertical do card da lista no cronograma ao selecionar a opção de excluir…
// essa movimentação não faz sentido, já que essas opções surgem deslizando
// dentro do próprio card"*.
//
// `:active` casa nos ANCESTRAIS: o `.lib-item` já era poupado por um toque no
// `⋮`, na `.hymn-gaveta` e numa `.lib-item` aninhada — e a `.row-acoes`, que é
// justamente a faixa em que o operador toca, não estava na lista. A gaveta dos
// FAVORITOS mora numa `.hymn-gaveta` e por isso já estava coberta: era só isso
// que fazia o defeito aparecer numa lista e não na outra.
//
// A ASSERÇÃO MEDE O RENDERIZADO, e nas DUAS partes do feedback (v1.3.14):
// suprimir só a geometria deixaria o cartão inteiro ACENDENDO por um toque de
// 40px — o mesmo relato, por outra propriedade. E ela tem a metade que impede
// a correção de virar "o feedback sumiu": o BOTÃO tocado continua respondendo.
try {
  const balanco = await (async () => {
    const pos = await pg.evaluate(async () => {
      setAppMode('full');
      activeTab = 'imports';
      const m = await AVDB.addMedia(new Blob([new Uint8Array(8)], { type: 'audio/mpeg' }),
        { name: 'Item que não balança', type: 'audio/mpeg', kind: 'audio', list: 'imports' });
      await load();
      const li = document.querySelector('#library .lib-item[data-id="' + m.id + '"]');
      if (!li) return { erro: 'a linha não foi desenhada' };
      li.querySelector('.row-mais').click();
      await new Promise((f) => setTimeout(f, 320));
      const b = li.querySelector('.row-acoes .row-excluir');
      if (!b) return { erro: 'a faixa não tem o excluir' };
      window.__balanco = { id: m.id, li };
      // A LINHA PRECISA ESTAR À VISTA: a lista tem o rodapé FIXO do "Importar
      // arquivos" por cima do fim dela, e um `mouse.down` sobre a coordenada de
      // um botão coberto pousa no rodapé — o `:active` nunca chega ao botão e a
      // medição reprova um app que está certo (ver "um oráculo não pode medir o
      // runner"). Confirmado pelo `elementFromPoint`, que é o que separa "o
      // toque não respondeu" de "o toque foi para outro lugar".
      li.scrollIntoView({ block: 'center' });
      await new Promise((f) => setTimeout(f, 120));
      const r = b.getBoundingClientRect();
      const x = Math.round(r.left + r.width / 2);
      const y = Math.round(r.top + r.height / 2);
      const topo = document.elementFromPoint(x, y);
      if (!topo || !topo.closest('.row-excluir')) {
        return { erro: 'o botão está coberto por ' + (topo ? topo.className : 'nada') };
      }
      return { x, y };
    });
    if (pos.erro) return pos;
    await pg.mouse.move(pos.x, pos.y);
    await pg.mouse.down();
    const durante = await pg.evaluate(() => {
      const li = window.__balanco.li;
      const b = li.querySelector('.row-acoes .row-excluir');
      return {
        cartaoMoveu: getComputedStyle(li).transform,
        cartaoAcendeu: getComputedStyle(li).filter,
        botaoMoveu: getComputedStyle(b).transform,
        botaoAcendeu: getComputedStyle(b).filter,
      };
    });
    await pg.mouse.up();
    await pg.evaluate(async () => {
      // O `mouseup` acabou de abrir a pergunta: desfaz e limpa o fixture.
      fecharAcoesDaLinha();
      await AVDB.listRemove('imports', window.__balanco.id);
      delete window.__balanco;
      await load();
    });
    return durante;
  })();
  checar(!balanco.erro && balanco.cartaoMoveu === 'none'
    && balanco.cartaoAcendeu === 'none',
    'O CARTÃO NÃO SE MEXE nem ACENDE por um toque na faixa de ações (v1.4.25): '
    + 'a resposta ali é a faixa trocando de conteúdo, e mover o cartão junto é '
    + 'uma segunda resposta ao mesmo dedo, no quadro em que a primeira entra',
    JSON.stringify(balanco));
  // A METADE QUE IMPEDE A CORREÇÃO DE VIRAR "o feedback sumiu". Ela cobra a LUZ
  // e não a geometria, e isso é MEDIDO, não preferência: dentro da gaveta quem
  // manda no `transform` dos filhos é a animação de entrada da própria faixa
  // (`.acoes-abertas .row-acoes > * { transform: none }`, 0,3,0), que vence o
  // `:active` da lista de controles (0,2,0). Ali o recuo nunca existiu — a
  // resposta do botão sempre foi a luz, como na `.coll-bar` e nos outros
  // BLOCOS. Cobrar `transform` aqui seria reprovar o app que está no ar.
  checar(!balanco.erro && balanco.botaoAcendeu !== 'none',
    'e o BOTÃO tocado continua respondendo (pela LUZ, que é a resposta de quem '
    + 'vive dentro da faixa) — sem esta metade, apagar o feedback inteiro '
    + 'passaria pela asserção de cima', JSON.stringify(balanco));
} catch (e) {
  checar(false, 'a medição do balanço do cartão terminou sem exceção ('
    + (e && e.message) + ')');
}

// ── A FILA GANHOU OS DOIS DESTINOS (v1.4.25) ─────────────────────────────
//
// Pedido do operador: *"na lista da playlist, pode adicionar opções como:
// adicionar aos favoritos e adicionar ao cronograma"*. Ela era a única das três
// listas sem caminho para as outras duas — e é o pior lugar para esse buraco: a
// fila é onde o bloco de louvores é montado.
//
// TRÊS metades, e cada uma cai por um motivo próprio:
//  1. os dois botões EXISTEM na faixa da fila;
//  2. eles ALTERNAM de verdade (o id entra e sai da lista no banco) — sem isso
//     seriam dois desenhos;
//  3. eles NASCEM com o estado certo, que é o que o pedido pede e o que falha
//     calado: um botão que só acende no toque não responde "está lá?" para o
//     item que já estava.
try {
  const dest = await pg.evaluate(async () => {
    setAppMode('full');
    const ate = async (cond, ms) => {
      const fim = Date.now() + (ms || 4000);
      while (Date.now() < fim) {
        if (cond()) return true;
        await new Promise((f) => setTimeout(f, 30));
      }
      return false;
    };
    const m = await AVDB.addMedia(new Blob([new Uint8Array(8)], { type: 'audio/mpeg' }),
      { name: 'Faixa da fila', type: 'audio/mpeg', kind: 'audio', list: 'playlist' });
    await load();
    openPlPopup();
    await new Promise((f) => setTimeout(f, 220));
    const li = document.querySelector('#playlist .row-item[data-id="' + m.id + '"]');
    if (!li) return { erro: 'a linha da fila não foi desenhada' };
    li.querySelector('.row-mais').click();
    await new Promise((f) => setTimeout(f, 320));
    const estrela = li.querySelector('.row-acoes .fav-btn');
    const crono = li.querySelector('.row-acoes .row-crono');
    const r = { temEstrela: !!estrela, temCrono: !!crono };
    if (!estrela || !crono) return r;
    // A ORDEM é a do Cronograma, sem os que não existem nesta lista.
    r.ordem = [...li.querySelectorAll('.row-acoes .row-btn')]
      .map((b) => (b.className.match(/row-(excluir|crono|ordem)|fav-btn/) || [''])[0]);
    // ---- 2. eles ALTERNAM ----
    r.cronoAntes = crono.classList.contains('on');
    crono.click();
    await ate(() => crono.classList.contains('on'));
    r.cronoDepois = crono.classList.contains('on');
    r.noBancoCrono = await AVDB.listHas('imports', m.id);
    estrela.click();
    await ate(() => estrela.classList.contains('on'));
    r.favDepois = estrela.classList.contains('on');
    r.noBancoFav = await AVDB.listHas('favs', m.id);
    // ---- 3. e o estado SOBREVIVE ao redesenho da fila ----
    renderPlaylist();
    await new Promise((f) => setTimeout(f, 120));
    const li2 = document.querySelector('#playlist .row-item[data-id="' + m.id + '"]');
    if (li2 && !li2.classList.contains('acoes-abertas')) li2.querySelector('.row-mais').click();
    await new Promise((f) => setTimeout(f, 320));
    r.nasceLigado = !!li2 && !!li2.querySelector('.row-crono.on')
      && !!li2.querySelector('.fav-btn.on');
    // ---- e o segundo toque DESFAZ (é isso que o torna um estado) ----
    li2.querySelector('.row-crono').click();
    await ate(async () => !(await AVDB.listHas('imports', m.id)));
    r.cronoSaiu = !(await AVDB.listHas('imports', m.id));
    closePlPopup();
    for (const l of ['playlist', 'imports', 'favs']) await AVDB.listRemove(l, m.id);
    await load();
    return r;
  });
  checar(!dest.erro && dest.temEstrela === true && dest.temCrono === true
    && JSON.stringify(dest.ordem.slice(0, 3))
      === JSON.stringify(['row-excluir', 'fav-btn', 'row-crono'])
    && dest.ordem.slice(3).every((c) => c === 'row-ordem'),
    'A FILA DA PLAYLIST GANHOU OS DOIS DESTINOS (v1.4.25), na ordem do '
    + 'Cronograma sem os que não existem nela: tirar da fila · favoritar · ao '
    + 'Cronograma', JSON.stringify(dest.ordem));
  checar(!dest.erro && dest.cronoAntes === false && dest.cronoDepois === true
    && dest.noBancoCrono === true && dest.favDepois === true && dest.noBancoFav === true,
    'e eles ALTERNAM de verdade — o id entra nas listas do BANCO, não só o '
    + 'desenho acende', JSON.stringify(dest));
  checar(!dest.erro && dest.nasceLigado === true && dest.cronoSaiu === true,
    'e o estado NASCE com a linha e o segundo toque DESFAZ: a pergunta que o '
    + 'operador faz montando o culto é "está lá?", não "eu mandei?" — um botão '
    + 'que só acende nunca se apaga', JSON.stringify(dest));
} catch (e) {
  checar(false, 'a medição dos destinos da fila terminou sem exceção ('
    + (e && e.message) + ')');
}

// ── A FILEIRA CABE NA CAIXA, E ISSO SE MEDE NUM APARELHO ESTREITO (v5.301) ─
//
// Os quatro oráculos de Chromium deste projeto medem a 430px, que é o iPhone
// grande. A tela do operador é um Android de **360px**, e a conta é outra: com
// `--thumb` de 40px reservado de cada lado, a caixa do `⋮` mede 222px — e cinco
// botões de 40px com `gap: .35rem` ocupam **222,4px**. Ela estava CHEIA desde a
// v5.288, com zero de folga e nada que dissesse isso.
//
// O "Adicionar à playlist" desta versão é o SEXTO botão. Sem a caixa passar a
// abraçar o conteúdo (ver `controle.css`), o excedente é desenhado POR CIMA DA
// MINIATURA — `.row-btn` é `flex-shrink: 0`, então nada encolhe e nada avisa.
// Este é o defeito que publica VERDE: nenhum teste abria a gaveta num aparelho
// estreito, e o oráculo da geometria mede a 430px, onde cabia.
//
// A asserção é a soma dos botões contra a largura da caixa, e não um número de
// pixel escrito aqui: ela continua valendo no dia em que um botão a mais entrar
// na fileira, que é exatamente quando ela precisa valer.
try {
  await pg.setViewportSize({ width: 360, height: 900 });
  await new Promise((f) => setTimeout(f, 150));
  const estreita = await pg.evaluate(async () => {
    setAppMode('full');
    activeTab = 'imports';
    const ids = [];
    // TRÊS linhas: com uma só, `botoesDeOrdem` devolve [] (total <= 1) e a
    // fileira sai com dois botões a menos que a de um culto de verdade.
    for (let i = 0; i < 3; i++) {
      const m = await AVDB.addMedia(new Blob([new Uint8Array(8)], { type: 'audio/mpeg' }),
        { name: 'Linha estreita ' + i, type: 'audio/mpeg', kind: 'audio', list: 'imports' });
      ids.push(m.id);
    }
    await load();
    const li = document.querySelector('#library .lib-item[data-id="' + ids[1] + '"]');
    if (!li) return { erro: 'a linha não foi desenhada' };
    li.querySelector('.row-mais').click();
    await new Promise((f) => setTimeout(f, 260));
    const caixa = li.querySelector('.row-acoes');
    const botoes = [...caixa.querySelectorAll('.row-btn')];
    const gap = parseFloat(getComputedStyle(caixa).gap) || 0;
    const soma = botoes.reduce((t, b) => t + b.getBoundingClientRect().width, 0)
      + Math.max(0, botoes.length - 1) * gap;
    const cb = caixa.getBoundingClientRect();
    const mais = li.querySelector('.row-mais').getBoundingClientRect();
    const r = {
      n: botoes.length,
      classes: botoes.map((b) => b.className.replace('row-btn ', '')),
      soma: Math.round(soma), caixa: Math.round(cb.width),
      cabe: Math.round(soma) <= Math.round(cb.width),
      // E ela NÃO INVADE a coluna do `⋮`: o excluir é o primeiro justamente
      // para ficar longe dele, e uma caixa que passasse por baixo desfaria isso.
      naoInvadeOMais: Math.round(cb.right) <= Math.round(mais.left),
      // Cada quadrado continua no PISO de toque do app.
      menorAlvo: Math.round(Math.min(...botoes.map((b) => b.getBoundingClientRect().width))),
    };
    for (const id of ids) await AVDB.listRemove('imports', id);
    await load();
    return r;
  });
  await pg.setViewportSize({ width: 430, height: 900 });
  await new Promise((f) => setTimeout(f, 150));
  checar(!estreita.erro && estreita.cabe,
    'A FILEIRA DA GAVETA CABE NA CAIXA num aparelho de 360px (' + (estreita.soma || '?')
    + 'px de botões em ' + (estreita.caixa || '?') + 'px) — com `flex-shrink: 0` o '
    + 'excedente era desenhado por cima da miniatura, sem erro em lugar nenhum',
    JSON.stringify(estreita));
  checar(!estreita.erro && estreita.naoInvadeOMais,
    'e ela não passa por baixo do `⋮`, que é o alvo tocado repetidamente',
    JSON.stringify(estreita));
  checar(!estreita.erro && estreita.menorAlvo >= 34,
    'com todos os quadrados no PISO de toque do app (' + (estreita.menorAlvo || 0)
    + 'px) — encolher para caber é trocar um defeito por outro',
    JSON.stringify(estreita));
} catch (e) {
  checar(false, 'a medição da fileira estreita terminou sem exceção ('
    + (e && e.message) + ')');
  try { await pg.setViewportSize({ width: 430, height: 900 }); } catch (_) {}
}

// ── "ADICIONAR À PLAYLIST" NA GAVETA DO CRONOGRAMA (v5.301) ──────────────
//
// Pedido do operador: *"nas opções dos itens do cronograma, especificamente na
// gaveta de opções, adicione o botão de 'Adicionar a playlist'"*.
//
// Duas metades, e a segunda é a que erra em silêncio: ele ACRESCENTA à fila (o
// toque no corpo da linha SUBSTITUI, e são ações opostas), e a caixa NÃO FECHA
// — a resposta dele é o ✓ de `responder()` no próprio botão, e `pulsar` pinta um
// nó que a caixa fechada (`visibility: hidden`) já tirou da tela.
try {
  const pl = await pg.evaluate(async () => {
    setAppMode('full');
    activeTab = 'imports';
    const a = await AVDB.addMedia(new Blob(['p1'], { type: 'audio/mpeg' }),
      { name: 'Primeiro da fila', type: 'audio/mpeg', kind: 'audio', list: 'playlist' });
    const m = await AVDB.addMedia(new Blob(['p2'], { type: 'audio/mpeg' }),
      { name: 'Louvor do culto', type: 'audio/mpeg', kind: 'audio', list: 'imports' });
    // Uma CENA DE ROTEIRO não recebe o botão: a fila é de reprodução, e o
    // `onTap` já desvia um cue para longe dela (*"um versículo não é uma fila
    // de reprodução"*).
    const cue = await criarCue('message', { msgId: 'zz1', text: 'Aviso' },
      'Aviso do culto', 'imports', null);
    await load();
    const li = document.querySelector('#library .lib-item[data-id="' + m.id + '"]');
    const lic = cue ? document.querySelector('#library .lib-item[data-id="' + cue.id + '"]') : null;
    if (!li) return { erro: 'a linha não foi desenhada' };
    li.querySelector('.row-mais').click();
    await new Promise((f) => setTimeout(f, 240));
    const r = {
      temBotao: !!li.querySelector('.row-acoes .row-playlist'),
      cueSemBotao: lic ? !lic.querySelector('.row-playlist') : null,
      antes: (await AVDB.listIds('playlist')).length,
    };
    li.querySelector('.row-playlist').click();
    await new Promise((f) => setTimeout(f, 400));
    const depois = await AVDB.listIds('playlist');
    r.entrou = depois.includes(m.id);
    // ACRESCENTA: o primeiro da fila continua lá. Um `replacePlaylistWith` aqui
    // apagaria o bloco de louvores que o operador acabou de montar.
    r.naoSubstituiu = depois.includes(a.id) && depois.length === r.antes + 1;
    r.caixaSegueAberta = !!document.querySelector(
      '#library .lib-item[data-id="' + m.id + '"].acoes-abertas');
    // ---- O BOTÃO DIZ O ESTADO, e o segundo toque TIRA (v5.302) ----
    // A parte que erra em silêncio é a última: um alternador que só acende
    // nunca se apaga, e a única forma de desfazer seria abrir a fila e procurar
    // a linha lá dentro.
    const pb = document.querySelector(
      '#library .lib-item[data-id="' + m.id + '"] .row-playlist');
    r.acendeu = !!pb && pb.classList.contains('on');
    r.viroucheck = !!pb && /polyline/.test(pb.innerHTML);
    r.tituloAceso = pb ? pb.title : '';
    // A METADE ACESSÍVEL do "ele diz o estado": cor e símbolo não chegam a quem
    // usa leitor de tela, e `aria-pressed` é o que nomeia um alternador.
    r.pressedAceso = pb ? pb.getAttribute('aria-pressed') : null;
    pb.click();
    await new Promise((f) => setTimeout(f, 400));
    r.saiu = !(await AVDB.listHas('playlist', m.id));
    const pb2 = document.querySelector(
      '#library .lib-item[data-id="' + m.id + '"] .row-playlist');
    r.apagou = !!pb2 && !pb2.classList.contains('on');
    r.voltouAoMais = !!pb2 && !/polyline/.test(pb2.innerHTML);
    r.pressedApagado = pb2 ? pb2.getAttribute('aria-pressed') : null;
    // ---- E O REPINTOR: a fila muda por OUTRA porta e a linha acompanha ----
    // `replacePlaylistWith` é o toque no corpo de uma linha, e ele SUBSTITUI a
    // fila. Sem `marcarNaPlaylist` o botão de toda outra linha ficaria dizendo
    // o que era verdade antes — pior que não dizer nada, porque promete estado.
    await AVDB.listAdd('playlist', m.id);
    plItems = await AVDB.listItems('playlist');
    renderPlaylist();
    await new Promise((f) => setTimeout(f, 120));
    r.repintouPorFora = document.querySelector(
      '#library .lib-item[data-id="' + m.id + '"] .row-playlist').classList.contains('on');
    await replacePlaylistWith({ id: a.id, name: 'Primeiro da fila' });
    await new Promise((f) => setTimeout(f, 120));
    r.substituirApagou = !document.querySelector(
      '#library .lib-item[data-id="' + m.id + '"] .row-playlist').classList.contains('on');
    for (const id of await AVDB.listIds('playlist')) await AVDB.listRemove('playlist', id);
    await AVDB.listRemove('imports', m.id);
    if (cue) await AVDB.listRemove('imports', cue.id);
    plItems = await AVDB.listItems('playlist');
    renderPlaylist();
    await load();
    return r;
  });
  checar(!pl.erro && pl.temBotao && pl.entrou && pl.naoSubstituiu,
    'A GAVETA DO CRONOGRAMA GANHOU "Adicionar à playlist" (v5.301), e ele '
    + 'ACRESCENTA à fila em vez de substituí-la — quem substitui é o toque no '
    + 'corpo da linha', JSON.stringify(pl));
  checar(!pl.erro && pl.cueSemBotao === true,
    'e uma CENA DE ROTEIRO não o recebe: a fila é de reprodução, e o `onTap` já '
    + 'desvia um cue para longe dela', JSON.stringify(pl));
  checar(!pl.erro && pl.caixaSegueAberta === true,
    'a caixa NÃO fecha nele: a resposta é o ✓ no próprio botão, e `pulsar` '
    + 'pintaria um nó que a caixa fechada já tirou da tela', JSON.stringify(pl));
  checar(!pl.erro && pl.acendeu && pl.viroucheck && /Tirar/.test(pl.tituloAceso)
      && pl.pressedAceso === 'true' && pl.pressedApagado === 'false',
    'e ELE DIZ O ESTADO (v5.302): aceso, com `+` virando `✓`, o rótulo virando '
    + '"Tirar da playlist" e o `aria-pressed` acompanhando — a pergunta de quem '
    + 'monta o culto é "está lá?", não "eu mandei?", e cor e símbolo não chegam '
    + 'a quem usa leitor de tela', JSON.stringify(pl));
  checar(!pl.erro && pl.saiu && pl.apagou && pl.voltouAoMais,
    'e o SEGUNDO toque tira da fila: um alternador que só acende nunca se apaga',
    JSON.stringify(pl));
  checar(!pl.erro && pl.repintouPorFora && pl.substituirApagou,
    'e o estado acompanha a fila mudada por OUTRA porta — inclusive o toque no '
    + 'corpo de uma linha, que a SUBSTITUI (`marcarNaPlaylist`)',
    JSON.stringify(pl));

  // ── A ORDEM DA FILEIRA É A QUE O OPERADOR DITOU (v5.302) ──────────────────
  //
  // *"Excluir, renomear, favoritar, adicionar à playlist, subir e descer."*
  // Ela agrupa por natureza — o que mexe no ITEM, o que mexe em ONDE ele está,
  // o que mexe na POSIÇÃO —, e é a mesma nos Favoritos, sem os que não existem
  // naquela lista. Afirmada como SEQUÊNCIA e não por posições soltas: o defeito
  // aqui é um botão que troca de vizinho, e só a lista inteira o pega.
  const ordem = await pg.evaluate(async () => {
    setAppMode('full');
    activeTab = 'imports';
    const ids = [];
    for (let i = 0; i < 3; i++) {
      const m = await AVDB.addMedia(new Blob([new Uint8Array(8)], { type: 'audio/mpeg' }),
        { name: 'Ordem ' + i, type: 'audio/mpeg', kind: 'audio', list: 'imports' });
      ids.push(m.id);
    }
    await load();
    const li = document.querySelector('#library .lib-item[data-id="' + ids[1] + '"]');
    if (!li) return { erro: 'a linha não foi desenhada' };
    li.querySelector('.row-mais').click();
    await new Promise((f) => setTimeout(f, 240));
    const nomes = (raiz) => [...raiz.querySelectorAll('.row-btn')]
      .map((b) => (b.className.match(/row-(excluir|renomear|playlist|ordem)|fav-btn/) || [''])[0]);
    const r = { cronograma: nomes(li.querySelector('.row-acoes')) };
    for (const id of ids) await AVDB.listRemove('imports', id);
    await load();
    return r;
  });
  checar(!ordem.erro && JSON.stringify(ordem.cronograma)
      === JSON.stringify(['row-excluir', 'row-renomear', 'fav-btn', 'row-playlist',
        'row-ordem', 'row-ordem']),
    'A ORDEM DA FILEIRA DO CRONOGRAMA é a ditada (v5.302): excluir · renomear · '
    + 'favoritar · playlist · ↑ · ↓', JSON.stringify(ordem.cronograma));
} catch (e) {
  checar(false, 'a medição do "à playlist" terminou sem exceção ('
    + (e && e.message) + ')');
}

  checar(!!geo && geo.thumbInteira,
    'a faixa de ações começa DEPOIS da miniatura — ela não corta a capa',
    JSON.stringify(geo));
  checar(!!geo && geo.temEstrela && geo.fundosApagados.length > 1
    && new Set(geo.fundosApagados).size === 1
    && !geo.fundosDaFaixa.some((c) => /rgba\([^)]*,\s*0\)/.test(c)),
    'e a ESTRELA é um botão preenchido como os vizinhos dela (v5.288) — chapada '
    + 'ela era a única peça da fileira sem caixa. Os APAGADOS vestem TODOS a '
    + 'mesma caixa (v1.4.25): um alternador apagado com tinta própria é o '
    + '"botão ofuscado" voltando por outra porta',
    JSON.stringify(geo && geo.fundosDaFaixa));
  checar(!!geo && !!geo.tracoApagado && geo.tracoApagado === geo.tracoVizinho,
    'e o TRAÇO de um alternador apagado é o dos vizinhos (v1.4.25) — era '
    + '`--line`, que neste app só o ↑↓ INERTE veste, e o operador lia o botão '
    + 'como indisponível',
    JSON.stringify(geo && [geo.tracoApagado, geo.tracoVizinho]));
  checar(!!geo && geo.fundosLigados.length > 0
    && !geo.fundosApagados.includes(geo.fundosLigados[0]),
    'e um alternador LIGADO tem superfície PRÓPRIA — a linguagem de estado de '
    + '`tokens.css` (`--btn-accent` + `--accent`), que é o que substituiu o '
    + 'botão ofuscado', JSON.stringify(geo && [geo.fundosLigados, geo.fundosApagados[0]]));
  checar(!!geo && geo.mesmaCaixa && geo.alvo >= 40,
    'e a miniatura e TODOS os botões da linha medem o mesmo (' + (geo ? geo.alvo : 0)
    + 'px) — o alvo cresceu junto', JSON.stringify(geo));
  checar(!!geo && geo.stopNaThumb && geo.stopCobreACapa && geo.stopVisivel,
    'o "Tirar do ar" mora DENTRO da miniatura e a cobre inteira — o alvo é a capa',
    JSON.stringify(geo));
  checar(!!geo && geo.alfaNoAr === 1,
    'e com a linha NO AR a faixa continua opaca (era o título aparecendo atrás dos botões)',
    JSON.stringify(geo));
} catch (e) {
  checar(false, 'a medição da linha terminou sem exceção (' + (e && e.message) + ')');
}

// ── O TOQUE ENCOLHE O CARTÃO, NÃO O MIOLO DELE (v5.259) ──────────────────
//
// `:active` não se simula por API, então a asserção é sobre a REGRA: o alvo do
// `transform` tem de ser a peça que carrega a BORDA. Enquanto ela era
// transparente os dois davam no mesmo; com ela visível (no ar, atual,
// selecionada) o miolo se afastava de uma moldura parada e abria uma fresta dos
// dois lados — o relato, literal.
try {
  const press = await pg.evaluate(() => {
    const alvos = [];
    for (const folha of [...document.styleSheets]) {
      let regras = [];
      try { regras = [...folha.cssRules]; } catch { continue; }
      for (const re of regras) {
        if (!re.selectorText || !/:active/.test(re.selectorText)) continue;
        if (!/transform/.test(re.style.cssText || '')) continue;
        alvos.push(re.selectorText);
      }
    }
    const txt = alvos.join(' | ');
    return {
      temCartao: /\.lib-item(?![\w-])(?!\s+\.row)/.test(txt),
      temMiolo: /\.lib-item\s+\.row(?![\w-])/.test(txt),
    };
  });
  checar(press.temCartao && !press.temMiolo,
    'o feedback de toque de uma linha encolhe o CARTÃO (com a borda), não o miolo dentro dela',
    JSON.stringify(press));
} catch (e) {
  checar(false, 'a medição do feedback de toque terminou sem exceção (' + (e && e.message) + ')');
}

// ── O SUBTÍTULO DIZ DE ONDE O ITEM VEIO (v5.258) ─────────────────────────
try {
  const sub = await pg.evaluate(() => ({
    audio: subtituloItem({ kind: 'audio', seconds: 225, hymnAlbum: 'Hinário Adventista 2022' }),
    video: subtituloItem({ kind: 'video', height: 1080, hymnAlbum: 'Provai e Vede 2026' }),
    semAlbum: subtituloItem({ kind: 'audio', seconds: 225 }),
  }));
  checar(/Áudio · Hinário Adventista 2022/.test(sub.audio),
    'o subtítulo de uma música traz o ÁLBUM, logo depois do tipo', sub.audio);
  checar(sub.audio.indexOf('Hinário') < sub.audio.indexOf('3:45'),
    'e ANTES da duração: numa linha que corta, o que sobrevive tem de identificar');
  checar(/Provai e Vede/.test(sub.video),
    'vale para vídeo também — um episódio de série vem de uma coleção do mesmo jeito', sub.video);
  checar(sub.semAlbum === 'Áudio · 3:45',
    'e um item sem coleção nenhuma continua exatamente como era', sub.semAlbum);
} catch (e) {
  checar(false, 'a medição do subtítulo terminou sem exceção (' + (e && e.message) + ')');
}

// ── A BIBLIOTECA: sem "baixar tudo", com a busca no TOPO (v5.258 → v5.275) ──
try {
  const bib = await pg.evaluate(() => {
    const sheet = document.querySelector('#hymnSearchPopup .popup-sheet');
    const barra = sheet.querySelector('.hymn-search-bar');
    const lista = sheet.querySelector('#hymnResults');
    return {
      semTotal: !document.getElementById('hymnSearchTotal'),
      semBotaoNoCabecalho: !sheet.querySelector('.popup-header .coll-group-btn'),
      // A ORDEM da folha (v5.275): cabeçalho, barra, lista. A lista é o último
      // filho e é ela que rola; a barra é a faixa fixa acima dela.
      listaPorUltimo: sheet.lastElementChild === lista,
      acimaDaLista: !!barra && !!lista
        && [...sheet.children].indexOf(barra) < [...sheet.children].indexOf(lista),
      fecharNaBarra: !!barra && !!barra.querySelector('#hymnSearchClose'),
      campoNaBarra: !!barra && !!barra.querySelector('#hymnSearchInput'),
    };
  });
  checar(bib.semTotal && bib.semBotaoNoCabecalho,
    'o "Baixar toda a biblioteca" e o peso total SAÍRAM do cabeçalho', JSON.stringify(bib));
  checar(bib.listaPorUltimo && bib.acimaDaLista,
    'e a barra de busca voltou ao TOPO (v5.275): quem termina a folha é a lista, '
    + 'que rola por baixo dela');
  checar(bib.campoNaBarra && bib.fecharNaBarra,
    'com o campo E o fechar juntos nela, que é o pedido inteiro');
} catch (e) {
  checar(false, 'a medição da Biblioteca terminou sem exceção (' + (e && e.message) + ')');
}

// ---------- A BIBLIOTECA É UMA TELA, E ELA SÓ ESMAECE (v5.263) ----------
// Pedido do operador: *"troque a animação de slide vertical, há muitos
// problemas com ela por causa do teclado, então faça apenas um fade in e out
// para a biblioteca, e faça dela uma tela inteira e não um tipo de pop up."*
//
// São TRÊS metades, e nenhuma basta: não há deslocamento em nenhum dos dois
// estados (tirar só o `translateY(100%)` do fechado deixaria a folha entrar com
// um salto), o que muda entre eles é a OPACIDADE, e a camada não tem scrim —
// que é o último tique de popup que sobrava.
//
// (Ele REVOGA a v5.262, que tinha invertido o sentido do slide. O diagnóstico
// de lá continua correto e é a razão desta: três lotes seguidos corrigindo o
// entorno de uma animação são a animação dizendo que não vale o preço.)
try {
  const tela = await pg.evaluate(async () => {
    const camada = document.getElementById('hymnSearchPopup');
    const folha = camada && camada.querySelector('.popup-sheet');
    if (!folha) return null;
    // `matrix(a,b,c,d,tx,ty)`: qualquer deslocamento aparece em tx/ty.
    const desloc = (el) => {
      const m = /matrix\(([^)]+)\)/.exec(getComputedStyle(el).transform);
      if (!m) return 0;   // 'none'
      const n = m[1].split(',');
      return Math.abs(parseFloat(n[4])) + Math.abs(parseFloat(n[5]));
    };
    closeHymnSearch();
    await new Promise((r) => setTimeout(r, 350));
    const fechada = { desloc: desloc(folha), opacidade: parseFloat(getComputedStyle(camada).opacity) };
    setAppMode('full');
    openHymnSearch();
    await new Promise((r) => setTimeout(r, 350));
    const aberta = { desloc: desloc(folha), opacidade: parseFloat(getComputedStyle(camada).opacity) };
    const scrim = getComputedStyle(camada).backgroundColor;
    closeHymnSearch();
    return { fechada, aberta, scrim };
  });
  checar(!!tela && tela.fechada.desloc === 0 && tela.aberta.desloc === 0,
    'a Biblioteca não DESLIZA em estado nenhum — fechada e aberta ela está no '
    + 'mesmo lugar', tela ? tela.fechada.desloc + ' / ' + tela.aberta.desloc : 'sem folha');
  checar(!!tela && tela.fechada.opacidade === 0 && tela.aberta.opacidade === 1,
    'o que a abre e a fecha é a OPACIDADE, e só ela');
  checar(!!tela && /rgba\(0, 0, 0, 0\)|transparent/.test(tela.scrim),
    'e ela não tem SCRIM: é uma tela, não um popup desenhado por cima de outra '
    + 'escurecida', tela ? tela.scrim : '?');
} catch (e) {
  checar(false, 'a medição da abertura da Biblioteca terminou sem exceção (' + (e && e.message) + ')');
}

// ---------- A TELA VEM NUM TEMPO, O TECLADO NO SEGUINTE (v5.264) ----------
// Pedido do operador: *"coloque um pequeno delay na abertura da biblioteca, em
// um tempo a tela aparece e no segundo tempo o teclado. isso vai fazer a tela
// piscar menos."*
//
// **O que este caso NÃO prova, e é preciso dizer:** que o teclado sobe. Num
// Chromium de mesa não existe teclado virtual, então nenhum teste daqui alcança
// isso — o que se mede é o FOCO, que é o gatilho dele. E a terceira asserção é
// a que mais importa: fechar dentro da janela do adiamento não pode deixar um
// `focus()` órfão, senão o teclado subiria sobre o app com a Biblioteca já fora
// de cena.
try {
  const foco = await pg.evaluate(async () => {
    const campo = document.getElementById('hymnSearchInput');
    setAppMode('full');
    closeHymnSearch();
    await new Promise((r) => setTimeout(r, 60));
    // `blur()` no campo, e não um `focus()` no `<body>`: o body não é focável
    // sem `tabindex`, então aquilo era um no-op e o `activeElement` continuava
    // sendo o campo de um caso anterior — a medição aprovaria os dois desenhos.
    campo.blur();
    openHymnSearch();
    // MESMO TURNO: se o `focus()` tivesse ficado síncrono, ele já teria
    // acontecido aqui — é esta leitura que distingue os dois desenhos.
    const naHora = document.activeElement === campo;
    await new Promise((r) => setTimeout(r, 500));
    const depois = document.activeElement === campo;
    closeHymnSearch();
    // E o cancelamento: abrir e fechar dentro da janela não pode focar nada.
    campo.blur();
    openHymnSearch();
    closeHymnSearch();
    await new Promise((r) => setTimeout(r, 500));
    const orfao = document.activeElement === campo;
    return { naHora, depois, orfao };
  });
  checar(!foco.naHora,
    'a Biblioteca abre SEM tomar o campo no mesmo tempo — a tela vem primeiro');
  checar(foco.depois,
    'e o campo é tomado no tempo seguinte, que é o que faz o teclado subir depois'
    + ' de a tela estar parada');
  checar(!foco.orfao,
    'fechar dentro da janela CANCELA o foco adiado — senão o teclado subiria '
    + 'sobre o app com a Biblioteca já fora de cena');
} catch (e) {
  checar(false, 'a medição do foco adiado terminou sem exceção (' + (e && e.message) + ')');
}

// ---------- A LUPA DENTRO DO CAMPO DE BUSCA (v5.264) ----------
// Pedido do operador: *"adicione um ícone de lupa na barra de pesquisa da
// biblioteca, isso vai indicar melhor o objetivo da barra."*
//
// Duas metades: ela está DENTRO do campo (não é mais um item da linha flex
// disputando largura com o ✕), e o toque nela cai no campo — um ícone que
// engole o toque no canto de um campo de texto é um ponto morto onde o dedo
// mira.
try {
  const lupa = await pg.evaluate(async () => {
    setAppMode('full');
    openHymnSearch();
    await new Promise((r) => setTimeout(r, 400));
    const campo = document.getElementById('hymnSearchInput');
    const ico = document.querySelector('#hymnSearchPopup .lib-search-lupa');
    if (!ico) { closeHymnSearch(); return null; }
    const ri = ico.getBoundingClientRect();
    const rc = campo.getBoundingClientRect();
    const r = {
      // Dentro da caixa do campo, e antes do texto.
      dentro: ri.left >= rc.left - 1 && ri.right <= rc.right + 1
        && ri.top >= rc.top - 1 && ri.bottom <= rc.bottom + 1,
      // O recuo do texto abre lugar para ela: o padding esquerdo passa da
      // borda direita do ícone.
      recuo: parseFloat(getComputedStyle(campo).paddingLeft) >= (ri.right - rc.left) - 1,
      // O TOQUE atravessa: quem responde no centro da lupa é o campo.
      alvo: document.elementFromPoint((ri.left + ri.right) / 2, (ri.top + ri.bottom) / 2) === campo,
      // UM desenho só: ela referencia o mesmo símbolo do botão do YouTube.
      simbolo: (ico.querySelector('use') || {}).getAttribute
        ? ico.querySelector('use').getAttribute('href') : '',
    };
    closeHymnSearch();
    return r;
  });
  checar(!!lupa && lupa.dentro && lupa.recuo,
    'a LUPA fica dentro do campo de busca, com o texto recuado para dar lugar a ela');
  checar(!!lupa && lupa.alvo,
    'e o toque nela cai no CAMPO — decoração não pode virar ponto morto');
  checar(!!lupa && lupa.simbolo === '#icoLupa',
    'ela é o MESMO desenho do botão de pesquisar no YouTube, não uma segunda '
    + 'cópia dele', lupa ? lupa.simbolo : 'sem lupa');
} catch (e) {
  checar(false, 'a medição da lupa terminou sem exceção (' + (e && e.message) + ')');
}

// ---------- A BARRA DE BUSCA SE DESTACA DO CORPO (v5.266) ----------
// Pedido do operador: *"crie um contraste melhor entre a barra de buscas e o
// corpo da tela de biblioteca, pois agora que ela é 'flutuante' ela precisa se
// destacar."* Até aqui ela não tinha fundo nenhum — herdava a cor da folha.
//
// A régua NÃO é um número escrito aqui: é a `.bottombar` da tela principal, que
// é a resposta que este app já deu para "separar duas caixas empilhadas" e cujo
// comentário declara o degrau como o único separador (sem borda, sem sombra).
// Ancorar nela mantém o caso verdadeiro se os tokens mudarem — e é o que
// reprova o caminho errado óbvio, usar `--bar` aqui: no tema CLARO aquele token
// é branco puro, a mesma cor da folha.
//
// NOS DOIS TEMAS, porque é justamente no claro que o atalho falharia.
for (const tema of ['escuro', 'claro']) {
  try {
    const c = await pg.evaluate(async (tema) => {
      document.documentElement.setAttribute('data-tema', tema);
      setAppMode('full');
      openHymnSearch();
      await new Promise((r) => setTimeout(r, 400));
      const fundo = (s) => {
        const e = document.querySelector(s);
        return e ? getComputedStyle(e).backgroundColor : '';
      };
      const barra = document.querySelector('#hymnSearchPopup .hymn-search-bar');
      const r = {
        folha: fundo('#hymnSearchPopup .popup-sheet'),
        barra: fundo('#hymnSearchPopup .hymn-search-bar'),
        campo: getComputedStyle(document.getElementById('hymnSearchInput')).backgroundColor,
        sombra: getComputedStyle(barra).boxShadow,
        // A RÉGUA do próprio app: o degrau da barra de baixo contra o fundo.
        corpoPrincipal: fundo('body'),
        barraPrincipal: fundo('.bottombar'),
        // O que mora DENTRO do campo (v5.267).
        texto: getComputedStyle(document.getElementById('hymnSearchInput')).color,
        ph: getComputedStyle(document.getElementById('hymnSearchInput'), '::placeholder').color,
        lupa: getComputedStyle(document.querySelector('#hymnSearchPopup .lib-search-lupa')).color,
        sombraCampo: getComputedStyle(document.getElementById('hymnSearchInput')).boxShadow,
        // O ✕ da barra (v5.270): altura, fundo e glifo.
        hCampo: document.getElementById('hymnSearchInput').getBoundingClientRect().height,
        hBtn: document.getElementById('hymnSearchClose').getBoundingClientRect().height,
        btn: getComputedStyle(document.getElementById('hymnSearchClose')).backgroundColor,
        glifo: getComputedStyle(document.getElementById('hymnSearchClose')).color,
      };
      closeHymnSearch();
      return r;
    }, tema);
    // Compõe alfa sobre a base (o campo é um overlay) e devolve a razão de
    // contraste — a mesma conta do `display-smoke.mjs`.
    const rgb = (s) => (s.match(/[\d.]+/g) || []).map(Number);
    const sobre = (frente, base) => {
      const f = rgb(frente); const b = rgb(base);
      const a = f.length > 3 ? f[3] : 1;
      return [0, 1, 2].map((i) => f[i] * a + b[i] * (1 - a));
    };
    const lum = (v) => {
      const l = v.map((x) => { const c = x / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
    };
    const razao = (a, b) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
    const folha = rgb(c.folha);
    const barra = sobre(c.barra, c.folha);
    const campo = sobre(c.campo, c.barra.includes('rgba(0, 0, 0, 0)') ? c.folha : c.barra);
    const regua = razao(sobre(c.barraPrincipal, c.corpoPrincipal), rgb(c.corpoPrincipal));
    const passo = razao(barra, folha);
    checar(c.barra !== c.folha && c.barra !== 'rgba(0, 0, 0, 0)',
      '[' + tema + '] a barra de busca tem fundo PRÓPRIO — ela herdava a cor da folha',
      c.barra + ' contra ' + c.folha);
    checar(passo >= regua - 0.05,
      '[' + tema + '] e o degrau é o do próprio app para separar duas caixas: '
      + passo.toFixed(2) + ':1, contra os ' + regua.toFixed(2) + ':1 da barra de baixo');
    // A SOMBRA APONTA PARA BAIXO desde a v5.275, e a direção é a afirmação: ela
    // diz de que lado o conteúdo passa, e com a barra de volta ao topo a lista
    // rola por baixo dela em vez de por cima. Uma sombra que ficasse apontando
    // para cima é a marca de quem moveu a barra e esqueceu o que ela dizia.
    checar(/(^|\s)0px 6px/.test(c.sombra) && c.sombra !== 'none',
      '[' + tema + '] com a sombra para BAIXO, que é o que o tom não diz: a lista '
      + 'passa por baixo dela', c.sombra);
    // E o CAMPO se separa da barra POR TOM (v5.270). Até aqui, no tema claro,
    // ele não se separava de jeito nenhum — barra e campo eram os dois brancos
    // (1,00:1), e a v5.268 sustentou a distinção só pela elevação. O operador
    // pediu o conserto de verdade: a barra escureceu, e o degrau passou a ser a
    // primeira linha de defesa nos DOIS temas.
    checar(razao(campo, barra) > 1.5,
      '[' + tema + '] o campo se separa da barra POR TOM ('
      + razao(campo, barra).toFixed(2) + ':1)');
    // ── O CAMPO É BRANCO NOS DOIS TEMAS (v5.268) ─────────────────────────
    // Pedido do operador. A primeira metade é o fundo; a SEGUNDA é a que não se
    // percebe pedindo "o campo branco" e que reprovaria calada: as três coisas
    // que moram dentro dele (o texto, o placeholder e a lupa) precisam parar de
    // seguir o tema junto com ele — no escuro, `--text` sobre branco dá 1,17:1.
    checar(campo.every((v) => Math.round(v) === 255),
      '[' + tema + '] o CAMPO é branco — o mesmo nos dois temas, como o palco',
      c.campo);
    checar(!!c.sombraCampo && c.sombraCampo !== 'none',
      '[' + tema + '] e a elevação FICA, agora como reforço: ele é uma folha de '
      + 'papel pousada na faixa, não um recorte dela', c.sombraCampo);
    // ── O ✕ TEM A ALTURA DO CAMPO, E É CLARO COMO ELE (v5.270) ───────────
    // As duas metades do pedido. A altura vinha do esqueleto de botão de ícone
    // (`--hit`, 34px) contra os 40 do campo — dois vizinhos na mesma linha com
    // sete pixels de diferença que ninguém decidiu. E a cor: com a barra
    // escurecida, um botão em `--surface-2`/`--muted` daria 2,09:1 no glifo.
    checar(Math.abs(c.hBtn - c.hCampo) <= 1,
      '[' + tema + '] o ✕ tem a MESMA altura do campo (' + Math.round(c.hBtn)
      + 'px contra ' + Math.round(c.hCampo) + 'px)');
    checar(c.btn === c.campo,
      '[' + tema + '] e o mesmo fundo CLARO dele — as duas peças claras sobre a '
      + 'faixa, não um chip translúcido ao lado de uma folha de papel', c.btn);
    checar(razao(sobre(c.glifo, c.btn), sobre(c.btn, c.barra)) >= 4.5,
      '[' + tema + '] com o glifo legível sobre ele ('
      + razao(sobre(c.glifo, c.btn), sobre(c.btn, c.barra)).toFixed(2) + ':1)');
    for (const [nome, cor] of [['texto', c.texto], ['placeholder', c.ph], ['lupa', c.lupa]]) {
      const r = razao(sobre(cor, c.campo), campo);
      checar(r >= 4.5,
        '[' + tema + '] e o ' + nome + ' é legível sobre ele (' + r.toFixed(2) + ':1)');
    }
  } catch (e) {
    checar(false, '[' + tema + '] a medição do contraste da barra terminou sem exceção ('
      + (e && e.message) + ')');
  }
}
await pg.evaluate(() => document.documentElement.setAttribute('data-tema', 'escuro'));

// ---------- O VERDE SAI DOS INDICADORES (v5.263) ----------
// Pedido do operador: *"remova a cor verde dos indicadores de tamanho das
// coleções e também dos itens sobre a conclusão das atualizações completas."*
//
// Medido por ELEMENTO DE PROVA, e não pelo desenho: os três estados só existem
// com uma coleção inteira no aparelho, e um fixture sem isso devolveria a cor
// herdada do `<body>` nos três — uma desigualdade que passa sem medir nada (a
// lição da v5.208).
try {
  const verde = await pg.evaluate(() => {
    const cor = (cls, estilo) => {
      const e = document.createElement('span');
      if (cls) e.className = cls;
      if (estilo) e.style.color = estilo;
      document.body.appendChild(e);
      const c = getComputedStyle(e).color;
      const p = getComputedStyle(e).fontWeight;
      e.remove();
      return { c, p };
    };
    const ok = cor(null, 'var(--ok)').c;
    return {
      ok,
      secao: cor('coll-group-count done').c,
      item: cor('item-detalhe-estado done'),
    };
  });
  checar(verde.secao !== verde.ok && verde.item.c !== verde.ok,
    'nenhum indicador de conclusão da Biblioteca é pintado de VERDE — a fração '
    + 'já diz que está completo, e a cor dizia a mesma coisa outra vez');
  checar(verde.item.p === '600',
    'mas a ÊNFASE fica: "Já no aparelho" continua em negrito, que distingue o '
    + 'estado resolvido do neutro sem gastar a cor', verde.item.p);
} catch (e) {
  checar(false, 'a medição do verde terminou sem exceção (' + (e && e.message) + ')');
}

// ---------- A BUSCA DA BIBLIOTECA E O TECLADO (v5.261, refeito na v5.275) ----------
// Relato do operador na v5.261: a barra não fica "flutuante/fixa na base, logo
// acima do teclado", e a listagem é "deslocada erroneamente na abertura do
// teclado", ficando "oculta por sair no topo da tela". A barra voltou ao TOPO
// na v5.275 e a segunda metade do relato é o que continua valendo aqui: a folha
// tem de ser a faixa visível, senão o cabeçalho e a barra saem pelo topo.
//
// Medido antes de mexer, com o teclado de mentira acima: `body` encolhia de 900
// para 520 px (o `--kb` já existia) e a folha da Biblioteca continuava em 900 —
// ela é `position: fixed`, isto é, está FORA do fluxo do body e nunca viu essa
// conta. 380 px de resultados terminavam atrás do teclado.
//
// As três asserções são a regra, nunca o pixel: um número escrito aqui
// reprovaria numa mudança legítima de fonte ou de área segura, e a queixa nunca
// foi sobre um número.
try {
  const geo = await pg.evaluate(async () => {
    const caixa = (s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; };
    const ler = () => ({
      folha: caixa('#hymnSearchPopup .popup-sheet'),
      barra: caixa('#hymnSearchPopup .hymn-search-bar'),
      lista: caixa('#hymnResults'),
    });
    setAppMode('full');
    openHymnSearch();
    await new Promise((r) => setTimeout(r, 350));
    const sem = ler();
    // O teclado do aparelho, com a viewport de layout INALTERADA — e rolada,
    // que é o mecanismo pelo qual o que é fixo sai pelo topo da tela.
    const ALTURA = 380, ROLAGEM = 140;
    window.__teclado(ALTURA, ROLAGEM);
    await new Promise((r) => setTimeout(r, 120));
    const com = ler();
    const visivelTopo = ROLAGEM;
    const visivelBase = window.innerHeight - (ALTURA - ROLAGEM);
    window.__teclado(0);
    await new Promise((r) => setTimeout(r, 60));
    closeHymnSearch();
    return { sem, com, visivelTopo, visivelBase };
  });
  const perto = (a, b) => Math.abs(a - b) <= 1;
  // A BARRA VOLTOU AO TOPO (v5.275) e, desde a v5.280, ela É o topo: o
  // cabeçalho saiu. As duas primeiras asserções são a ORDEM da folha — barra,
  // lista —; sem elas, uma barra que voltasse para a base passaria pelo resto
  // do caso sem reprovar nada.
  checar(!!geo.sem.barra && !!geo.sem.folha && perto(geo.sem.barra.top, geo.sem.folha.top),
    'sem teclado, a barra de busca É o topo da folha');
  checar(!!geo.sem.lista && perto(geo.sem.lista.top, geo.sem.barra.bottom)
    && geo.sem.lista.bottom > geo.sem.barra.bottom,
    'e a lista começa onde ela termina — a rolagem passa por BAIXO dela');
  // O TECLADO SOBREPÕE E A CAMADA NÃO PERSEGUE NADA (v5.280). A v5.278 fazia a
  // folha descer junto com a viewport visual para a barra não sair pelo topo; o
  // operador recusou o mecanismo e nomeou o certo — quem rola é a LISTA, e a
  // barra está fora dela, então não há scroll de tela a compensar. As duas
  // metades: a folha não se mexe e não encolhe.
  checar(!!geo.com.folha && perto(geo.com.folha.top, geo.sem.folha.top),
    'com o teclado aberto a folha NÃO SE MEXE: ele sobrepõe a tela');
  checar(!!geo.com.folha && perto(geo.com.folha.height, geo.sem.folha.height),
    'e ela NÃO ENCOLHE: o teclado não reflui a lista ('
    + Math.round(geo.sem.folha.height) + 'px → ' + Math.round(geo.com.folha.height) + 'px)');
  checar(!!geo.com.barra && !!geo.com.lista
    && perto(geo.com.barra.top, geo.com.folha.top)
    && perto(geo.com.lista.top, geo.com.barra.bottom),
    'e a ordem de cima continua colada: folha → barra → lista');
} catch (e) {
  checar(false, 'a medição da busca com teclado terminou sem exceção (' + (e && e.message) + ')');
}

// ── O TECLADO SOBREPÕE O RENOMEAR DA LINHA, TAMBÉM (v1.4.29) ─────────────
//
// Relato do operador: *"o teclado está arrastando e encolhendo a tela com o
// controle ao invés de sobrepor o controle/tela como já faz na biblioteca"*.
//
// É a mesma régua do bloco acima, e ela já estava escrita no CSS do
// `.popup-backdrop`: *"O TECLADO SOBREPÕE, NÃO DESLOCA… quem rola é a LISTA"*.
// O campo do renomear vive DENTRO da lista, que rola sozinha — e o que o app
// encolhe para revelá-lo é justamente a PREVIEW e o TRANSPORTE, isto é, a
// projeção e os controles do culto.
//
// O MUNDO MEDIDO É O DO APARELHO DO OPERADOR: o hint
// `interactive-widget=resizes-content` IGNORADO, a viewport de layout intacta e
// só a visual encolhendo — que é o que o `__teclado` deste arquivo simula. Onde
// o hint é honrado quem encolhe é o navegador, e não há daqui como impedir.
//
// DUAS METADES, e a segunda é a que impede a correção de virar um defeito
// maior: o campo MARCADO não encolhe o app, e um campo SEM a marca continua
// encolhendo — o `appPrompt` é um cartão CENTRADO, e ali a metade de baixo é
// exatamente onde o teclado sobe.
try {
  const tec = await pg.evaluate(async () => {
    const alturaDoBody = () => Math.round(document.body.getBoundingClientRect().height);
    const kb = () => getComputedStyle(document.documentElement)
      .getPropertyValue('--kb').trim();
    setAppMode('full');
    activeTab = 'imports';
    const m = await AVDB.addMedia(new Blob([new Uint8Array(8)], { type: 'audio/mpeg' }),
      { name: 'Teclado', type: 'audio/mpeg', kind: 'audio', list: 'imports' });
    await load();
    const li = document.querySelector('#library .lib-item[data-id="' + m.id + '"]');
    if (!li) return { erro: 'a linha não foi desenhada' };
    li.scrollIntoView({ block: 'center' });
    li.querySelector('.row-mais').click();
    await new Promise((f) => setTimeout(f, 320));
    li.querySelector('.row-renomear').click();
    await new Promise((f) => setTimeout(f, 300));
    const r = { semTeclado: alturaDoBody() };
    // O campo do renomear está em foco (`pedirRenomearNaLinha` o foca).
    r.focado = document.activeElement === li.querySelector('.linha-renome-campo');
    window.__teclado(380, 0);
    await new Promise((f) => setTimeout(f, 150));
    r.comTeclado = alturaDoBody();
    r.kbNoRenomear = kb();
    window.__teclado(0);
    fecharConfirmacaoNaLinha();
    fecharAcoesDaLinha();
    await new Promise((f) => setTimeout(f, 200));
    // ---- A METADE DE CONTRASTE: o `appPrompt` continua DESLOCANDO ----
    appPrompt({ title: 'Medição', message: 'campo sem a marca' });
    await new Promise((f) => setTimeout(f, 280));
    document.getElementById('appDialogInput').focus();
    window.__teclado(380, 0);
    await new Promise((f) => setTimeout(f, 150));
    r.comTecladoNoPrompt = alturaDoBody();
    r.kbNoPrompt = kb();
    document.getElementById('appDialogCancel').click();
    window.__teclado(0);
    await new Promise((f) => setTimeout(f, 200));
    await AVDB.listRemove('imports', m.id);
    await load();
    return r;
  });
  checar(!tec.erro && tec.focado === true && tec.comTeclado === tec.semTeclado
    && tec.kbNoRenomear === '0px',
    'O TECLADO SOBREPÕE no renomear da linha (v1.4.29): o app NÃO encolhe ('
    + tec.semTeclado + 'px → ' + tec.comTeclado + 'px) — encolher comprime a '
    + 'preview e o transporte para revelar um campo que já está à vista, dentro '
    + 'de uma lista que rola sozinha', JSON.stringify(tec));
  checar(!tec.erro && tec.comTecladoNoPrompt < tec.semTeclado
    && tec.kbNoPrompt !== '0px',
    'mas um campo SEM a marca continua DESLOCANDO — o `appPrompt` é um cartão '
    + 'CENTRADO, e ali a metade de baixo é onde o teclado sobe ('
    + tec.semTeclado + 'px → ' + tec.comTecladoNoPrompt + 'px). Sem esta '
    + 'metade, desligar o mecanismo inteiro passaria', JSON.stringify(tec));
} catch (e) {
  checar(false, 'a medição do teclado no renomear terminou sem exceção ('
    + (e && e.message) + ')');
}

checar(erros.length === 0, 'nenhum erro de console' + (erros.length ? ':\n        ' + erros.join('\n        ') : ''));

await navegador.close();
servidor.close();
console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
