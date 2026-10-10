#!/usr/bin/env node
// ============================================================================
// O VÍDEO DO MODO FÁCIL EM TELA CHEIA, E A BARRA DE VOLUME DA TELA CHEIA (v1.12.24)
//
// Pedido do operador, verbatim:
//   *"no modo simples, quando tocar um vídeo, como o Provai e Vede, Informativo, vídeo do
//   YouTube, etc., ligue o modo tela cheia, já que não temos o auxiliar de leitura (não tem
//   texto) e não temos o preview no modo simples … Mas no modo simples, remova os botões de
//   corte de imagem, anterior e próximo. Claro, ao final do vídeo, sai automaticamente da tela
//   cheia nesse modo simples"* · *"faça um ajuste para os dois modos: em tela cheia, mostre uma
//   barra momentânea quando o volume for alterado"*.
//
// O que este arquivo trava, e cada uma falha CALADA:
//  A. Modo Fácil + um VÍDEO entrando em cena → a prévia entra em tela cheia, COM CAIXA (a
//     `.preview` mora numa `.bottombar` que o Modo Fácil esconde: sem a regra de CSS o top layer
//     sai 0×0, a tela cheia "funciona" e não mostra nada).
//  B. Nessa tela cheia a cortina e o par ⏮/⏭ NÃO existem; sair e play/pause ficam. No avançado
//     os cinco continuam — e um vídeo no avançado NÃO abre tela cheia sozinho.
//  C. O FIM do vídeo (o `autoAdvance` com a fila vazia, o ponto por onde os dois caminhos de fim
//     passam), o Parar e a troca por mídia que não é vídeo FECHAM a tela cheia.
//  D. Pedido recusado (sem toque recente — o vídeo que baixa antes de tocar): o botão do card do
//     nome aparece e é a porta para a tela cheia.
//  E. A BARRA DE VOLUME: em tela cheia, nos dois modos, uma mudança de volume a mostra com o
//     número e o nível, e ela some sozinha; fora da tela cheia ela não existe.
//
//   node tools/video-tela-cheia.test.mjs
// ============================================================================
import { semRedeExterna } from './sem-rede.mjs';
import {
  servirEstatico, abrirNavegador, esperar, esperarCortina, porque, checar, falhas, comModoAvancado, RAIZ_WEB,
} from './arnes.mjs';

const servidor = servirEstatico(RAIZ_WEB);
await new Promise((r) => servidor.listen(0, r));
const base = `http://localhost:${servidor.address().port}`;
const navegador = await abrirNavegador();
const erros = [];

const plantar = (pg) => pg.evaluate(async () => {
  const v = await AVDB.addMedia(new Blob([new Uint8Array(64)], { type: 'video/mp4' }),
    { name: 'Provai e Vede', type: 'video/mp4', kind: 'video', list: 'imports' });
  const a = await AVDB.addMedia(new Blob([new Uint8Array(64)], { type: 'audio/wav' }),
    { name: 'Louvor de Fundo', type: 'audio/wav', kind: 'audio', list: 'imports' });
  return { video: v.id, audio: a.id };
});
// O ESTADO ASSENTADO, e não o primeiro quadro: o Chromium escreve `document.fullscreenElement`
// ANTES de despachar `fullscreenchange`, e é no evento que o app reage (a barra apaga, a marca
// `fsDoVideo` cai). Ler a propriedade crua mede o meio da troca.
const vigiarTelaCheia = (alvo) => alvo.addInitScript(() => {
  document.addEventListener('fullscreenchange', () => {
    window.__fsAssentado = document.fullscreenElement ? document.fullscreenElement.id : 'fora';
  });
});
const naTelaCheia = () => window.__fsAssentado === 'preview' && document.fullscreenElement === document.getElementById('preview');
const fora = () => window.__fsAssentado === 'fora' && !document.fullscreenElement;
const lerFs = (pg) => pg.evaluate(() => {
  const vis = (id) => getComputedStyle(document.getElementById(id)).display !== 'none';
  const r = document.getElementById('preview').getBoundingClientRect();
  return {
    fs: document.fullscreenElement === document.getElementById('preview'),
    w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth, vh: innerHeight,
    exit: vis('fsExit'), play: vis('fsPlay'), view: vis('fsView'), prev: vis('fsPrev'), next: vis('fsNext'),
  };
});
const lerBarra = (pg) => pg.evaluate(() => {
  const el = document.getElementById('pvVolume');
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return {
    visivel: el.classList.contains('visivel'), display: cs.display, opacidade: parseFloat(cs.opacity),
    num: document.getElementById('pvVolumeNum').textContent,
    nivel: document.getElementById('pvVolumeNivel').style.width, w: Math.round(r.width),
  };
});

try {
  // ======================= MODO FÁCIL =======================
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true });
  await semRedeExterna(ctx);
  await vigiarTelaCheia(ctx);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await esperarCortina(pg);
  // Uma tela "conectada" (a janela do Display no navegador): o Modo Fácil sai do bloqueio.
  await pg.evaluate(() => { webDisplayWin = { closed: false }; renderSimpleCast(); });
  const ids = await plantar(pg);
  const premissa = await pg.evaluate(() => appMode);
  checar(premissa === 'simple', 'premissa · o app abre no Modo Fácil', premissa);

  // A · o vídeo entra em tela cheia (o `evaluate` do Playwright carrega ativação de usuário,
  // como o toque que escolheu o vídeo)
  await pg.evaluate((id) => send(id), ids.video);
  const a0 = await esperar(pg, naTelaCheia, null, 5000);
  checar(a0 === true, 'A1 · um VÍDEO entrando em cena no Modo Fácil põe a prévia em tela cheia', porque(a0));
  const a = await lerFs(pg);
  checar(a.fs && a.w === a.vw && a.h === a.vh,
    'A2 · e a tela cheia TEM CAIXA: a prévia ocupa a tela inteira (sem a regra do `.bottombar` ela sai 0×0)',
    JSON.stringify(a));

  // B · a coluna do Modo Fácil: sair e play/pause, sem cortina e sem ⏮/⏭
  checar(a.exit && a.play && !a.view && !a.prev && !a.next,
    'B1 · no Modo Fácil a coluna da tela cheia tem SAIR e PLAY/PAUSE; a cortina, ⏮ e ⏭ não existem',
    JSON.stringify(a));

  // E · a barra de volume no Modo Fácil (o ± da tela)
  const e0 = await lerBarra(pg);
  checar(e0.display !== 'none' && e0.visivel === false,
    'E1 · em tela cheia a barra existe, apagada até o volume mudar', JSON.stringify(e0));
  await pg.evaluate(() => { simpleVolStep(-1); });
  const e1 = await lerBarra(pg);
  const esperado = await pg.evaluate(() => String(Math.round(volume * 100)));
  checar(e1.visivel && e1.num === esperado && e1.nivel === esperado + '%' && e1.w > 0,
    'E2 · mudar o volume ACENDE a barra com o número e o nível do app', JSON.stringify({ e1, esperado }));
  const apagou = await esperar(pg, () => !document.getElementById('pvVolume').classList.contains('visivel'), null, 5000);
  checar(apagou === true, 'E3 · e ela some sozinha (2 s)', porque(apagou));
  // A tecla que vai ao SISTEMA (teto/zero) não muda o número do app — e ainda assim responde.
  await pg.evaluate(() => { peekVolume(); });
  const e4 = await lerBarra(pg);
  checar(e4.visivel === true, 'E4 · a tecla física acende a barra mesmo sem mudar o número (`peekVolume`)', JSON.stringify(e4));

  // C · o fim natural do vídeo fecha a tela cheia
  await pg.evaluate(() => { autoAdvance(); });
  const c1 = await esperar(pg, fora, null, 5000);
  checar(c1 === true, 'C1 · o FIM do vídeo (fila vazia) fecha a tela cheia do Modo Fácil', porque(c1));
  const c1b = await lerBarra(pg);
  checar(c1b.display === 'none' && c1b.visivel === false, 'C1b · e fora dela a barra de volume não existe', JSON.stringify(c1b));

  // C · a troca por uma mídia que não é vídeo fecha também
  await pg.evaluate((id) => send(id), ids.video);
  const c2a = await esperar(pg, naTelaCheia, null, 5000);
  checar(c2a === true, 'premissa · o vídeo volta a entrar em tela cheia', porque(c2a));
  await pg.evaluate((id) => send(id), ids.audio);
  const c2 = await esperar(pg, fora, null, 5000);
  checar(c2 === true, 'C2 · trocar o vídeo por um ÁUDIO fecha a tela cheia', porque(c2));
  const c2b = await pg.evaluate(() => document.getElementById('simpleFsBtn').hidden);
  checar(c2b === true, 'C2b · e com um áudio no ar o botão de tela cheia do card não existe', String(c2b));

  // C · o Parar fecha também
  await pg.evaluate((id) => send(id), ids.video);
  const c3a = await esperar(pg, naTelaCheia, null, 5000);
  checar(c3a === true, 'premissa · e entra de novo antes do Parar', porque(c3a));
  await pg.evaluate(() => { document.getElementById('simpleStop').click(); });
  const c3 = await esperar(pg, fora, null, 5000);
  checar(c3 === true, 'C3 · o PARAR fecha a tela cheia do vídeo', porque(c3));

  // D · o pedido recusado (sem toque recente) deixa a PORTA no card do nome
  await pg.evaluate(() => {
    document.getElementById('preview').requestFullscreen = () => Promise.reject(new TypeError('sem ativação'));
  });
  await pg.evaluate((id) => send(id), ids.video);
  await pg.waitForTimeout(300);   // o pedido recusado é uma AUSÊNCIA: espera-se a rejeição assentar
  const d1 = await pg.evaluate(() => {
    const b = document.getElementById('simpleFsBtn');
    const r = b.getBoundingClientRect();
    const alvo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { fs: !!document.fullscreenElement, hidden: b.hidden, alcanca: !!alvo && b.contains(alvo) };
  });
  checar(d1.fs === false && d1.hidden === false && d1.alcanca === true,
    'D1 · recusado o pedido, o card do nome ganha o botão de tela cheia, à vista e tocável', JSON.stringify(d1));
  await pg.evaluate(() => { delete document.getElementById('preview').requestFullscreen; });
  if (d1.alcanca) await pg.click('#simpleFsBtn');
  else await pg.evaluate(() => document.getElementById('simpleFsBtn').click());
  const d2 = await esperar(pg, naTelaCheia, null, 5000);
  checar(d2 === true, 'D2 · e o toque nele põe o vídeo em tela cheia', porque(d2));
  await pg.evaluate(() => { autoAdvance(); });
  const d3 = await esperar(pg, fora, null, 5000);
  checar(d3 === true, 'D3 · e a tela cheia aberta pelo botão também sai sozinha no fim', porque(d3));
  await ctx.close();

  // ======================= AVANÇADO =======================
  const ctx2 = await navegador.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true });
  await semRedeExterna(ctx2);
  await vigiarTelaCheia(ctx2);
  await comModoAvancado(ctx2);
  const pa = await ctx2.newPage();
  pa.on('pageerror', (e) => erros.push('pageerror (avançado): ' + e.message));
  await pa.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await esperarCortina(pa);
  const premissa2 = await pa.evaluate(() => appMode);
  checar(premissa2 !== 'simple', 'premissa · o segundo contexto parte do modo avançado', premissa2);
  const ids2 = await plantar(pa);
  await pa.evaluate((id) => send(id), ids2.video);
  await pa.waitForTimeout(500);   // AUSÊNCIA: nada deve abrir a tela cheia sozinho
  const b2 = await pa.evaluate(() => !!document.fullscreenElement);
  checar(b2 === false, 'B2 · no avançado um vídeo NÃO abre a tela cheia sozinho', String(b2));
  await pa.click('#pvFullBtn');
  const b3a = await esperar(pa, naTelaCheia, null, 5000);
  checar(b3a === true, 'premissa · o ⛶ da prévia abre a tela cheia no avançado', porque(b3a));
  const b3 = await lerFs(pa);
  checar(b3.exit && b3.play && b3.view && b3.prev && b3.next,
    'B3 · no avançado a coluna continua com os CINCO botões', JSON.stringify(b3));

  // E · a barra no avançado (o fader)
  await pa.evaluate(() => {
    const s = document.getElementById('volSlider') || document.querySelector('input[type=range].vol-slider');
    s.value = '35'; s.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const e5 = await lerBarra(pa);
  checar(e5.visivel && e5.num === '35' && e5.nivel === '35%',
    'E5 · no avançado a mudança de volume em tela cheia também acende a barra', JSON.stringify(e5));
  const opac = await esperar(pa, () => parseFloat(getComputedStyle(document.getElementById('pvVolume')).opacity) > 0.9, null, 3000);
  checar(opac === true, 'E6 · e ela é VISTA (opacidade cheia), não só marcada', porque(opac));
  // O FIM no avançado NÃO fecha a tela cheia que o operador abriu
  await pa.evaluate(() => { autoAdvance(); });
  await pa.waitForTimeout(400);   // AUSÊNCIA
  const b4 = await pa.evaluate(() => document.fullscreenElement === document.getElementById('preview'));
  checar(b4 === true, 'B4 · no avançado o fim da mídia NÃO fecha a tela cheia aberta pelo operador', String(b4));
  await pa.evaluate(() => document.exitFullscreen());
  await ctx2.close();

  checar(erros.length === 0, 'nenhum erro de página', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

falhas.length ? (console.log('\n' + falhas.length + ' falha(s).'), process.exit(1))
  : console.log('\nTodos passaram.');
