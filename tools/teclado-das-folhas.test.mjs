// ============================================================================
// O TECLADO DE UMA FOLHA NÃO MEXE NA BARRA DA BIBLIOTECA (v1.13.3).
//
// A v1.13.2 achou a causa no `#itinPopup`: um campo de texto dentro de uma folha
// que NÃO declara `data-teclado="sobrepoe"` faz o `keyboardShift` escrever o
// teclado em `--kb`, que encolhe o `<body>` — e a caixa de controles, com a barra
// de busca da Biblioteca repousando nela, SOBE com o teclado e DESCE quando o
// campo perde o foco (o relato do operador: *"a caixa de busca da Biblioteca se
// move para cima e para baixo na tela"*). O conserto separa as duas medidas: o
// campo sobrepõe (`--kb` fica 0) e a folha desconta o teclado inteiro
// (`--kb-folha`), para o que mora nela não ficar atrás dele.
//
// Aquela versão consertou UMA folha e deixou a mesma forma dita em outra. Este
// oráculo cobre as que a varredura da v1.13.3 achou, cada uma com o mesmo par de
// réguas do bloco N do `itinerario.test.mjs`:
//
//  A. a PLAYLIST AUTOMÁTICA (`#sorteioPopup`): o campo da palavra tema;
//  B. CONFIGURAÇÕES (`#fadePopup`), seção Editar mídia: a busca do seletor;
//  C. a folha de FERRAMENTAS, Sorteio com "Números": os campos De/Até (eles
//     moram no corpo da lista, não numa folha do teto — o que se mede é só a
//     barra parada).
//
// As réguas: (1) com o teclado no ar a barra de busca da Biblioteca fica no MESMO
// pixel e `--kb` é 0 — o app por baixo não encolheu; (2) a folha termina onde o
// teclado começa (A e B); (3) ao tirar o foco e o teclado descer, a barra não se
// move em quadro nenhum.
//
// O teclado é SIMULADO como o WebView em edge-to-edge o produz: só a viewport
// VISUAL encolhe (`__teclado(px)`), a de layout fica — o mundo em que o `--kb`
// existe (ver `keyboardShift`).
//
//   node tools/teclado-das-folhas.test.mjs
import { semRedeExterna } from './sem-rede.mjs';
import {
  servirEstatico, abrirNavegador, checar, falhas, RAIZ_WEB, esperar, porque,
  esperarCortina, comModoAvancado,
} from './arnes.mjs';

const servidor = servirEstatico(RAIZ_WEB);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador();
const ctx = await navegador.newContext({ viewport: { width: 360, height: 800 }, locale: 'pt-BR' });
await semRedeExterna(ctx);
await comModoAvancado(ctx);
await ctx.addInitScript(() => {
  const vv = window.visualViewport;
  if (!vv) return;
  let kb = 0;
  Object.defineProperty(vv, 'height', { configurable: true, get: () => window.innerHeight - kb });
  window.__teclado = (px) => { kb = px; vv.dispatchEvent(new Event('resize')); };
});

const TECLADO = 450;
const erros = [];
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY|Failed to load resource/;

try {
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  pg.on('console', (m) => { if (m.type() === 'error' && !EXTERNO.test(m.text())) erros.push(m.text()); });
  await pg.goto(base + '/controle/');
  await pg.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function', null, { timeout: 30000 });
  await esperarCortina(pg);

  const topoDaBarra = () => pg.evaluate(() => Math.round(document.getElementById('libBar').getBoundingClientRect().top * 10) / 10);

  /**
   * O PERCURSO DE UM CAMPO: focar, subir o teclado, digitar, medir; depois tirar o
   * foco e baixar o teclado amostrando a barra quadro a quadro.
   * `campo` é o seletor do campo; `folha`, o da `.popup-sheet` que tem de terminar
   * acima do teclado (ou `null`).
   */
  const percurso = async (rotulo, campo, folha) => {
    const antes = await topoDaBarra();
    await pg.click(campo);
    await pg.evaluate((px) => window.__teclado(px), TECLADO);
    const rk = await esperar(pg, (px) => getComputedStyle(document.documentElement).getPropertyValue('--kb-folha').trim() === px + 'px', TECLADO);
    await pg.keyboard.type('12');
    // O tempo de a barra deslizar, se ela fosse deslizar (`--lib-anim`).
    await pg.waitForTimeout(600);
    const com = await pg.evaluate(([f, c]) => ({
      foco: document.activeElement === document.querySelector(c),
      sobrepoe: document.querySelector(c).dataset.teclado,
      barra: Math.round(document.getElementById('libBar').getBoundingClientRect().top * 10) / 10,
      kb: getComputedStyle(document.documentElement).getPropertyValue('--kb').trim(),
      fundo: f ? Math.round(document.querySelector(f).getBoundingClientRect().bottom) : null,
      limite: innerHeight,
    }), [folha, campo]);
    com.limite -= TECLADO;
    checar(rk === true && com.foco && com.barra === antes && com.kb === '0px',
      rotulo + ' · com o teclado no ar a barra de busca da Biblioteca NÃO sobe — o campo sobrepõe e o app por baixo não encolhe',
      { antes, com, r: porque(rk) });
    if (folha) {
      checar(com.fundo <= com.limite + 1,
        rotulo + ' · e a folha termina onde o teclado começa (`--kb-folha`): nada dela fica atrás dele', com);
    }
    await pg.evaluate(() => {
      window.__barra = [];
      const f = () => {
        window.__barra.push(Math.round(document.getElementById('libBar').getBoundingClientRect().top * 10) / 10);
        if (window.__barra.length < 60) requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    });
    await pg.evaluate(() => { document.activeElement.blur(); window.__teclado(0); });
    await esperar(pg, () => window.__barra.length >= 60, null, 5000);
    const amostras = await pg.evaluate(() => window.__barra);
    const fora = amostras.filter((y) => Math.abs(y - antes) > 0.5);
    checar(fora.length === 0 && (await topoDaBarra()) === antes,
      rotulo + ' · e ao sair do campo ela não desce nem sobe: parada no mesmo pixel em todos os quadros',
      { antes, fora: fora.slice(0, 8) });
  };

  // ── A. A PLAYLIST AUTOMÁTICA: a palavra tema ─────────────────────────────
  await pg.evaluate(() => abrirSorteio());
  await esperar(pg, () => document.getElementById('sorteioPopup').classList.contains('open')
    && !!document.querySelector('#sorteioPopup .sorteio-campo input'));
  await esperar(pg, () => document.querySelector('#sorteioPopup .popup-sheet').getBoundingClientRect().top >= -0.5);
  await percurso('A', '#sorteioPopup .sorteio-campo input', '#sorteioPopup .popup-sheet');
  await pg.evaluate(() => fecharSorteio());
  await esperar(pg, () => !document.getElementById('sorteioPopup').classList.contains('open'));

  // ── B. CONFIGURAÇÕES, EDITAR MÍDIA: a busca do seletor ───────────────────
  await pg.evaluate(() => abrirSecao('edicao', { animar: false }));
  await esperar(pg, () => document.getElementById('fadePopup').classList.contains('open')
    && !!document.getElementById('edicaoBusca') && document.getElementById('edicaoBusca').offsetParent !== null);
  await esperar(pg, () => document.querySelector('#fadePopup .popup-sheet').getBoundingClientRect().top >= -0.5);
  await percurso('B', '#edicaoBusca', '#fadePopup .popup-sheet');
  await pg.evaluate(() => closeFadePopup());
  await esperar(pg, () => !document.getElementById('fadePopup').classList.contains('open'));

  // ── C. FERRAMENTAS, SORTEIO COM "NÚMEROS": os campos De/Até ──────────────
  await pg.evaluate(() => {
    draw.kind = 'number'; draw.min = 1; draw.max = 50;
    abrirFerramenta('draw');
  });
  await esperar(pg, () => document.querySelectorAll('.draw-range input').length === 2);
  await percurso('C', '.draw-range-field:first-child input', null);
  await pg.evaluate(() => fecharFerramentas());

  checar(erros.length === 0, 'nenhum erro de console', erros);
} catch (e) {
  checar(false, 'o oráculo rodou até o fim', e && e.stack || String(e));
} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) { console.log('\n' + falhas.length + ' falha(s).'); process.exit(1); }
console.log('\nTodos passaram.');
