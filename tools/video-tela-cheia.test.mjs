#!/usr/bin/env node
// ============================================================================
// O VÍDEO DO MODO FÁCIL EM TELA CHEIA, E A PÍLULA DE VOLUME (v1.13.57)
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
//  D. Pedido recusado (sem toque recente — o vídeo que baixa antes de tocar): a PORTA manual da
//     tela cheia no Modo Fácil é a TERCEIRA TECLA da linha (`#simpleTela`), e o botão do card do
//     nome, que era essa porta até a v1.13.56, não existe mais.
//  F. (v1.12.26) COM TELA CONECTADA NÃO HÁ TELA CHEIA: o vídeo não a abre, a tecla fica APAGADA
//     com o motivo no rótulo, e uma tela que ENTRA com ela aberta a fecha.
//  G. (v1.13.57) A TECLA é a terceira das três da linha, do mesmo tamanho das outras duas — e o
//     card do nome voltou a ter as duas linhas INTEIRAS (a coluna do botão que existia desde a
//     v1.12.26 saiu).
//  E. (v1.13.57) A PÍLULA DE VOLUME, UMA PEÇA SÓ: em tela cheia ela é MOVIDA para dentro da
//     `.preview` (a classe `na-previa`, `casaDaPilula`), acende com o número (`#volValue`) quando
//     o volume muda — pela tecla física (`peekVolume`) ou pelo fader — e some sozinha em 1,5 s;
//     fora da tela cheia a casa é o `body`. A barra da tela cheia (`#pvVolume`) e o fader vertical
//     do deck saíram neste lote: quem responde pelo volume é ela, nos dois modos e em toda tela.
//  I. (v1.12.42) UM MODELO SÓ PARA OS DOIS MODOS, medido em PAISAGEM (740×360 e 900×420): o
//     play/pause GRANDE no centro (⏮/⏭ ao lado dele, só no avançado), o SAIR no canto inferior
//     direito na linha do tempo, a CORTINA no canto superior direito na faixa do título (só no
//     avançado), e a pílula de volume HORIZONTAL e centrada entre o título e a linha do tempo
//     (v1.13.57; era a barra vertical da borda esquerda) — nada sobre nada. E com os controles
//     APAGADOS um toque no meio da tela só os acende: o play/pause escondido ali não é acionado.
//  H. (v1.12.41) NO MODO FÁCIL o NOME da mídia numa faixa no topo e a LINHA DO TEMPO na base,
//     acendendo e apagando junto com a coluna; arrastar a linha até a metade leva a mídia à
//     metade (um `seek` ao soltar) e segura os controles acesos durante o arraste; sem duração
//     ela some; o volume é a pílula DENTRO da prévia, entre os dois (v1.13.57). No avançado nada
//     disso — fora a pílula, que é a mesma.
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
// A PÍLULA DE VOLUME (v1.13.57) — a barra `#pvVolume` da tela cheia e o fader vertical do deck
// SAÍRAM: quem responde pelo volume é ela, nos dois modos e em toda tela. Em tela cheia ela é
// MOVIDA para dentro da `.preview` (`casaDaPilula`: só o elemento em tela cheia e os filhos dele
// são pintados) e ganha a classe `na-previa`; fora dela a casa é o `body`.
//
// AUSENTE devolve `{ existe: false }` em vez de estourar um TypeError no meio da medição: a
// reprovação tem de chegar com o dado que a explica, e não derrubar as asserções seguintes.
const lerPilula = (pg) => pg.evaluate(() => {
  const el = document.getElementById('volPill');
  const num = document.getElementById('volValue');
  if (!el) {
    return { existe: false,
      barraDaTelaCheia: !!document.getElementById('pvVolume'),
      faderDoDeck: !!document.querySelector('.fader-wrap') };
  }
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  const pai = el.parentNode;
  return {
    existe: true,
    visivel: el.classList.contains('visivel'), naPrevia: el.classList.contains('na-previa'),
    casa: pai === document.getElementById('preview') ? 'previa' : pai === document.body ? 'corpo' : 'outra',
    display: cs.display, opacidade: parseFloat(cs.opacity), visibilidade: cs.visibility,
    num: num ? num.textContent : null, vw: innerWidth,
    w: Math.round(r.width), h: Math.round(r.height), l: Math.round(r.left), r: Math.round(r.right),
    t: Math.round(r.top), b: Math.round(r.bottom),
    // UMA peça só: a barra da tela cheia e o fader do deck não podem existir em lugar nenhum.
    umaSo: document.querySelectorAll('.vol-pill').length === 1,
    barraDaTelaCheia: !!document.getElementById('pvVolume') || !!document.getElementById('pvVolumeNivel')
      || !!document.getElementById('pvVolumeNum'),
    faderDoDeck: !!document.querySelector('.fader-wrap'),
  };
});
// O título e a linha do tempo da tela cheia do Modo Fácil (v1.12.41).
const lerFaixas = (pg) => pg.evaluate(() => {
  const ler = (id) => {
    const el = document.getElementById(id);
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return { visivel: el.classList.contains('visivel'), display: cs.display, op: parseFloat(cs.opacity),
      t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right), h: Math.round(r.height) };
  };
  return { coluna: document.getElementById('pvFsCtl').classList.contains('visivel'),
    topo: ler('pvFsTopo'), nome: ler('pvFsNome'), base: ler('pvFsBase'), hit: ler('pvFsTempoHit'),
    texto: document.getElementById('pvFsNome').textContent, vh: innerHeight };
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
  // SEM tela conectada (v1.12.26: a tela cheia do vídeo só existe sem destino de projeção), e o
  // Modo Fácil destravado pelo "Tocar neste celular".
  await pg.evaluate(() => { setTocarNoCelular(true); });
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

  // E · (v1.13.57) A PÍLULA DE VOLUME EM TELA CHEIA, DENTRO DA PRÉVIA. A barra `#pvVolume` que
  // existia aqui saiu: quem responde pelo volume é a pílula única do documento, e em tela cheia
  // ela é MOVIDA para dentro da `.preview` no momento em que aparece.
  const e0 = await lerPilula(pg);
  checar(e0.existe === true && e0.visivel === false && e0.opacidade === 0 && e0.umaSo === true
    && e0.barraDaTelaCheia === false,
    'E1 · em tela cheia existe UMA pílula de volume, apagada até o volume mudar — e a barra `#pvVolume` saiu',
    JSON.stringify(e0));
  await pg.evaluate(() => { applyVolume(volumeProximo(volume, -1)); });
  const e1 = await lerPilula(pg);
  const esperado = await pg.evaluate(() => String(Math.round(volume * 100)));
  checar(e1.visivel && e1.casa === 'previa' && e1.naPrevia === true && e1.num === esperado
    && e1.w > 0 && e1.l >= 0 && e1.r <= e1.vw,
    'E2 · mudar o volume ACENDE a pílula DENTRO da prévia (`na-previa`), com o número do app',
    JSON.stringify({ e1, esperado }));
  await pg.waitForTimeout(900);   // TEMPO DE PAREDE: o relógio da pílula é de 1,5 s
  const e2 = await lerPilula(pg);
  const apagou = await esperar(pg, () => !document.getElementById('volPill').classList.contains('visivel'), null, 4000);
  const invisivel = await esperar(pg, () => getComputedStyle(document.getElementById('volPill')).visibility === 'hidden', null, 3000);
  checar(e2.visivel === true && apagou === true && invisivel === true,
    'E3 · e ela some sozinha (1,5 s): acesa em 0,9 s, apagada e invisível depois',
    JSON.stringify({ e2, apagou, invisivel }));
  // A tecla que vai ao SISTEMA (teto/zero) não muda o número do app — e ainda assim responde.
  await pg.evaluate(() => { peekVolume(); });
  const e4 = await lerPilula(pg);
  checar(e4.visivel === true && e4.casa === 'previa' && e4.num === esperado,
    'E4 · a tecla física a acende de novo sem mudar o número (`peekVolume`), e a casa é a prévia',
    JSON.stringify(e4));

  // H · (v1.12.41) O TÍTULO NO TOPO, A LINHA DO TEMPO NA BASE, O VOLUME ENTRE OS DOIS.
  // A mídia plantada não tem duração: a premissa a escreve no `#seek`, como o `display-status`.
  await pg.evaluate(() => {
    seekEl.disabled = false; seekEl.max = '120'; seekEl.value = '10'; renderSimpleTime();
    window.__seeks = [];
    const orig = AVDB.sendCommand.bind(AVDB);
    AVDB.sendCommand = (c) => { if (c && c.type === 'seek') window.__seeks.push(c.time); return orig(c); };
  });
  await pg.mouse.click(200, 300);   // acende (ou apaga e…)
  let h0 = await lerFaixas(pg);
  if (!h0.coluna) { await pg.mouse.click(200, 300); h0 = await lerFaixas(pg); }
  checar(h0.coluna && h0.topo.visivel && h0.base.visivel && h0.texto === 'Provai e Vede' && h0.topo.t <= 1 && h0.nome.h > 0,
    'H1 · com os controles acesos, o NOME da mídia aparece numa faixa no TOPO da tela cheia', JSON.stringify(h0));
  checar(h0.base.display === 'flex' && h0.base.b >= h0.vh - 1 && h0.hit.h >= 30,
    'H2 · e a LINHA DO TEMPO numa faixa na BASE, com alvo de toque de 30 px ou mais', JSON.stringify(h0));
  const h3 = await esperar(pg, () => !document.getElementById('pvFsCtl').classList.contains('visivel'), null, 6000);
  const h3b = await lerFaixas(pg);
  checar(h3 === true && !h3b.topo.visivel && !h3b.base.visivel,
    'H3 · e os dois somem JUNTO com a coluna (4 s)', JSON.stringify(h3b));
  // H4 · arrastar a linha do tempo até a METADE procura (um `seek` só, ao soltar) e mantém tudo aceso
  await pg.mouse.click(200, 300);
  const hit = await pg.evaluate(() => {
    seekEl.disabled = false; seekEl.max = '120'; seekEl.value = '10'; renderSimpleTime();
    const r = document.getElementById('pvFsTempoHit').getBoundingClientRect(); return { x: r.left, w: r.width, y: r.top + r.height / 2 }; });
  await pg.mouse.move(hit.x + hit.w * 0.1, hit.y);
  await pg.mouse.down();
  await pg.mouse.move(hit.x + hit.w * 0.3, hit.y, { steps: 4 });
  await pg.mouse.move(hit.x + hit.w * 0.5, hit.y, { steps: 4 });
  await pg.waitForTimeout(4600);   // TEMPO DE PAREDE: o relógio de 4 s tem de NÃO apagar durante o arraste
  const h4a = await lerFaixas(pg);
  const durante = await pg.evaluate(() => ({ seeks: window.__seeks.length, cur: document.getElementById('pvFsTempoCur').textContent }));
  await pg.mouse.up();
  const h4 = await pg.evaluate(() => ({ seeks: window.__seeks.slice(), valor: parseFloat(seekEl.value), seeking }));
  checar(h4a.coluna && h4a.topo.visivel && h4a.base.visivel && durante.seeks === 0 && durante.cur === '1:00',
    'H4 · durante o arraste os controles ficam ACESOS (passados os 4 s) e o tempo mostrado segue o dedo, sem `seek`',
    JSON.stringify({ h4a: { coluna: h4a.coluna, topo: h4a.topo.visivel, base: h4a.base.visivel }, durante }));
  checar(h4.seeks.length === 1 && Math.abs(h4.seeks[0] - 60) <= 3 && Math.abs(h4.valor - 60) <= 3 && h4.seeking === false,
    'H5 · e soltar na metade leva a mídia à METADE da duração (um `seek` só, pelo caminho do card)', JSON.stringify(h4));
  const h6 = await esperar(pg, () => !document.getElementById('pvFsCtl').classList.contains('visivel'), null, 6000);
  checar(h6 === true, 'H6 · e solto o dedo o relógio volta a correr: tudo apaga sozinho', porque(h6));
  // H7 · (v1.13.63) A PÍLULA DENTRO DA PRÉVIA, EM PÉ NA BORDA ESQUERDA, entre o título e a linha
  // do tempo — ela voltou a ser vertical a pedido do operador, e no app ela pousa onde a barra da
  // tela cheia (v1.12.41) sempre morou.
  // A geometria não depende de estar aceso: a premissa da duração é reescrita NO MESMO quadro
  // (sob carga, um status da prévia com a mídia de 64 bytes a zera e a linha do tempo some).
  const [v7, f7] = await pg.evaluate(() => {
    seekEl.disabled = false; seekEl.max = '120'; seekEl.value = '10'; renderSimpleTime();
    applyVolume(volumeProximo(volume, 1));
    const r = (id) => { const x = document.getElementById(id).getBoundingClientRect(); return { t: Math.round(x.top), b: Math.round(x.bottom), l: Math.round(x.left), r: Math.round(x.right), w: Math.round(x.width), h: Math.round(x.height) }; };
    const pil = document.getElementById('volPill');
    const v = pil ? r('volPill') : { t: 0, b: 0, l: 0, r: 0, w: 0, h: 0 };
    return [Object.assign(v, {
      visivel: !!pil && pil.classList.contains('visivel'),
      naPrevia: !!pil && pil.classList.contains('na-previa'),
      casa: pil && pil.parentNode === document.getElementById('preview') ? 'previa' : 'outra',
      vw: innerWidth }), { nome: r('pvFsNome'), hit: r('pvFsTempoHit') }];
  });
  checar(v7.visivel && v7.casa === 'previa' && v7.naPrevia && v7.h > v7.w
    && v7.l <= 8 && v7.t >= f7.nome.b && v7.b <= f7.hit.t,
    'H7 · no Modo Fácil a pílula de volume mora DENTRO da prévia: EM PÉ, na borda esquerda, entre o título e a linha do tempo',
    JSON.stringify({ v7, nome: f7.nome, hit: f7.hit }));
  // H8 · sem duração conhecida, a linha do tempo some
  await pg.evaluate(() => { seekEl.disabled = true; seekEl.max = '0'; renderSimpleTime(); });
  const h8 = await lerFaixas(pg);
  checar(h8.base.display === 'none', 'H8 · sem duração conhecida a linha do tempo da tela cheia NÃO existe', JSON.stringify(h8.base));

  // C · o fim natural do vídeo fecha a tela cheia
  await pg.evaluate(() => { autoAdvance(); });
  const c1 = await esperar(pg, fora, null, 5000);
  checar(c1 === true, 'C1 · o FIM do vídeo (fila vazia) fecha a tela cheia do Modo Fácil', porque(c1));
  // C1b · e fora dela a casa da pílula é o CORPO outra vez (o nó é MOVIDO, e não recriado): uma
  // pílula que ficasse dentro de uma `.preview` que já não está no top layer seria pintada fora
  // da vista.
  await pg.evaluate(() => { peekVolume(); });
  const c1b = await lerPilula(pg);
  checar(c1b.existe === true && c1b.casa === 'corpo' && c1b.naPrevia === false && c1b.visivel === true
    && c1b.umaSo === true && c1b.barraDaTelaCheia === false,
    'C1b · saindo da tela cheia a pílula volta para o CORPO, e a barra `#pvVolume` não existe em lugar nenhum',
    JSON.stringify(c1b));

  // C · a troca por uma mídia que não é vídeo fecha também
  await pg.evaluate((id) => send(id), ids.video);
  const c2a = await esperar(pg, naTelaCheia, null, 5000);
  checar(c2a === true, 'premissa · o vídeo volta a entrar em tela cheia', porque(c2a));
  await pg.evaluate((id) => send(id), ids.audio);
  const c2 = await esperar(pg, fora, null, 5000);
  checar(c2 === true, 'C2 · trocar o vídeo por um ÁUDIO fecha a tela cheia', porque(c2));
  // C2b · (v1.13.57) A porta manual vale para QUALQUER mídia no ar (`haOQueParar`), e não só para
  // o vídeo sem leitura que o automático cobre.
  const c2b = await pg.evaluate(() => {
    const b = document.getElementById('simpleTela');
    return b ? { existe: true, disabled: b.disabled, title: b.title, midiaNoAr } : { existe: false };
  });
  checar(c2b.existe === true && c2b.disabled === false && c2b.midiaNoAr === true,
    'C2b · e com um ÁUDIO no ar a tecla da tela cheia do Modo Fácil está HABILITADA (a porta manual vale para qualquer mídia)',
    JSON.stringify(c2b));

  // C · o Parar fecha também
  await pg.evaluate((id) => send(id), ids.video);
  const c3a = await esperar(pg, naTelaCheia, null, 5000);
  checar(c3a === true, 'premissa · e entra de novo antes do Parar', porque(c3a));
  await pg.evaluate(() => { document.getElementById('simpleStop').click(); });
  const c3 = await esperar(pg, fora, null, 5000);
  checar(c3 === true, 'C3 · o PARAR fecha a tela cheia do vídeo', porque(c3));
  const c3b = await pg.evaluate(() => {
    const b = document.getElementById('simpleTela');
    return b ? { existe: true, disabled: b.disabled, title: b.title, midiaNoAr } : { existe: false };
  });
  checar(c3b.existe === true && c3b.disabled === true && c3b.midiaNoAr === false && c3b.title !== 'Ver em tela cheia',
    'C3b · sem nada no ar a tecla fica APAGADA, com o motivo no rótulo (apagada, nunca inerte)', JSON.stringify(c3b));

  // D · o pedido recusado (sem toque recente) deixa a PORTA da tela cheia à mão — e ela agora é a
  // TERCEIRA TECLA da linha, não um botão no card do nome (v1.13.57).
  await pg.evaluate(() => {
    document.getElementById('preview').requestFullscreen = () => Promise.reject(new TypeError('sem ativação'));
  });
  await pg.evaluate((id) => send(id), ids.video);
  await pg.waitForTimeout(300);   // o pedido recusado é uma AUSÊNCIA: espera-se a rejeição assentar
  const d1 = await pg.evaluate(() => {
    const b = document.getElementById('simpleTela');
    if (!b) return { existe: false, botaoDoCard: !!document.getElementById('simpleFsBtn') };
    const r = b.getBoundingClientRect();
    const alvo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { existe: true, fs: !!document.fullscreenElement, disabled: b.disabled, hidden: b.hidden,
      alcanca: !!alvo && b.contains(alvo), botaoDoCard: !!document.getElementById('simpleFsBtn') };
  });
  checar(d1.existe === true && d1.fs === false && d1.disabled === false && d1.hidden === false
    && d1.alcanca === true && d1.botaoDoCard === false,
    'D1 · recusado o pedido, a tecla da tela cheia fica à vista e tocável — e o botão do card do nome não existe mais',
    JSON.stringify(d1));
  // G · (v1.13.57) A TECLA É A TERCEIRA DA LINHA, e o card voltou a ter as duas linhas inteiras.
  const g = await pg.evaluate(() => {
    const r = (el) => (el ? el.getBoundingClientRect() : null);
    const cx = (x) => (x ? [x.left, x.top, x.width, x.height] : null);
    const card = document.querySelector('.simple-nowplaying');
    const nome = r(document.getElementById('simpleNpName'));
    const c = r(card);
    return { stop: cx(r(document.getElementById('simpleStop'))), play: cx(r(document.getElementById('simplePlay'))),
      tela: cx(r(document.getElementById('simpleTela'))), nomeDir: nome && nome.right, cardDir: c && c.right,
      filhos: Array.from(card.children).map((e) => e.id || e.className),
      botaoDoCard: !!document.getElementById('simpleFsBtn') };
  });
  checar(!!g.tela && !!g.stop && !!g.play
    && g.stop[0] < g.play[0] && g.play[0] < g.tela[0]
    && g.stop[1] === g.play[1] && g.play[1] === g.tela[1]
    && g.stop[3] === g.tela[3] && g.play[3] === g.tela[3]
    && Math.abs(g.stop[2] - g.tela[2]) < 0.5 && Math.abs(g.play[2] - g.tela[2]) < 0.5,
    'G1 · a tecla da tela cheia é a TERCEIRA da linha: mesma altura e mesma largura do Parar e do Play/Pausa',
    JSON.stringify(g));
  checar(!!g.tela && g.botaoDoCard === false && g.cardDir - g.nomeDir <= 16,
    'G2 · e o card do nome voltou a ter as duas linhas INTEIRAS: a coluna do botão de tela cheia não existe mais',
    JSON.stringify(g));
  await pg.evaluate(() => { delete document.getElementById('preview').requestFullscreen; });
  if (d1.alcanca) await pg.click('#simpleTela');
  else await pg.evaluate(() => { const b = document.getElementById('simpleTela'); if (b) b.click(); });
  const d2 = await esperar(pg, naTelaCheia, null, 5000);
  checar(d2 === true, 'D2 · e o toque nela põe o vídeo em tela cheia', porque(d2));
  const d2b = await pg.evaluate(() => window.__fsAssentado);
  await pg.evaluate(() => { autoAdvance(); });
  const d3 = await esperar(pg, fora, null, 5000);
  checar(d2b === 'preview' && d3 === true,
    'D3 · e a tela cheia aberta pela tecla também sai sozinha no fim', JSON.stringify({ d2b, d3 }));

  // F · COM TELA CONECTADA NÃO HÁ TELA CHEIA (v1.12.26): a tela conectada é o visor
  await pg.evaluate(() => { webDisplayWin = { closed: false }; renderSimpleCast(); });
  await pg.evaluate((id) => send(id), ids.video);
  await pg.waitForTimeout(500);   // AUSÊNCIA: nada deve abrir a tela cheia
  const f1 = await pg.evaluate(() => {
    const b = document.getElementById('simpleTela');
    return { fs: !!document.fullscreenElement, existe: !!b, disabled: b ? b.disabled : null,
      title: b ? b.title : null, botaoDoCard: !!document.getElementById('simpleFsBtn'), midia: midiaNoAr };
  });
  checar(f1.midia === true && f1.fs === false && f1.existe === true && f1.disabled === true
    && f1.botaoDoCard === false,
    'F1 · com uma tela conectada o vídeo NÃO abre a tela cheia, e a tecla fica APAGADA (o visor é a TV)',
    JSON.stringify(f1));
  // a tela sai: sem destino, o vídeo seguinte volta a abrir a tela cheia…
  await pg.evaluate(() => { webDisplayWin = null; renderSimpleCast(); setTocarNoCelular(true); });
  await pg.evaluate((id) => send(id), ids.video);
  const f2 = await esperar(pg, naTelaCheia, null, 5000);
  checar(f2 === true, 'F2 · sem tela de novo, o vídeo volta a abrir a tela cheia', porque(f2));
  // …e uma tela que ENTRA com ela aberta a fecha
  await pg.evaluate(() => { webDisplayWin = { closed: false }; renderSimpleCast(); });
  const f3 = await esperar(pg, fora, null, 5000);
  checar(f3 === true, 'F3 · uma tela que ENTRA com a tela cheia do vídeo aberta a FECHA (a tela conectada é o visor)',
    porque(f3));
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

  // H9 · (v1.13.63) O MESMO modelo do Modo Fácil: no avançado, EM TELA CHEIA, a pílula também é
  // MOVIDA para dentro da prévia — é UMA peça, em pé na borda esquerda, e o nome no topo continua
  // onde estava.
  await pa.evaluate(() => { peekVolume(); });
  const h9 = await lerPilula(pa);
  const h9f = await lerFaixas(pa);
  checar(h9.existe === true && h9.visivel === true && h9.casa === 'previa' && h9.naPrevia === true
    // v1.14.7: o recuo esquerdo da pílula subiu para 12px (pedido do operador: a
    // borda azul do tour era cortada pela borda da tela). A régua passa a ser
    // "encostada na borda esquerda, com o piso de 12px", e não mais ≤ 8.
    && h9.h > h9.w && h9.l >= 12 && h9.l <= 16 && h9.umaSo === true && h9.barraDaTelaCheia === false
    && h9f.topo.display !== 'none' && h9f.texto === 'Provai e Vede',
    'H9 · (v1.13.57) no avançado a MESMA pílula é movida para dentro da prévia, e o NOME segue no topo',
    JSON.stringify({ h9, topo: h9f.topo.display, texto: h9f.texto }));
  // O FIM no avançado NÃO fecha a tela cheia que o operador abriu
  await pa.evaluate(() => { autoAdvance(); });
  await pa.waitForTimeout(400);   // AUSÊNCIA
  const b4 = await pa.evaluate(() => document.fullscreenElement === document.getElementById('preview'));
  checar(b4 === true, 'B4 · no avançado o fim da mídia NÃO fecha a tela cheia aberta pelo operador', String(b4));

  // E · (v1.13.57) A PÍLULA NO AVANÇADO, FORA DA PRÉVIA: o fader vertical do deck saiu, e o
  // retorno do volume fora da tela cheia é a MESMA pílula, agora no CORPO — logo acima do deck.
  await pa.evaluate(() => { document.exitFullscreen(); });
  const saiu = await esperar(pa, () => !document.fullscreenElement, null, 4000);
  checar(saiu === true, 'premissa · o ⛶ sai da tela cheia antes da medida da pílula fora dela', porque(saiu));
  await pa.evaluate(() => {
    const s = document.getElementById('volSlider');
    s.value = '35'; s.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const e5 = await lerPilula(pa);
  const deck = await pa.evaluate(() => {
    const r = document.querySelector('.deck').getBoundingClientRect();
    const l = document.getElementById('library').getBoundingClientRect();
    return { topo: Math.round(r.top), base: Math.round(r.bottom),
      corpo: [Math.round(l.top), Math.round(l.bottom)] };
  });
  checar(e5.existe === true && e5.visivel === true && e5.casa === 'corpo' && e5.naPrevia === false
    && e5.num === '35' && e5.h > e5.w && e5.faderDoDeck === false && e5.umaSo === true,
    'E5 · no avançado, fora da tela cheia, mudar o volume acende a pílula NO CORPO (o fader do deck saiu), com o número',
    JSON.stringify(e5));
  const opac = await esperar(pa, () => parseFloat(getComputedStyle(document.getElementById('volPill')).opacity) > 0.9, null, 3000);
  checar(opac === true, 'E6 · e ela é VISTA (opacidade cheia), não só marcada', porque(opac));
  // v1.13.64: a barra não fica mais colada no transporte — o CENTRO dela é o centro do corpo da
  // lista (a `#library`), e a base continua sem tocar no deck.
  checar(e5.b <= deck.topo - 2
    && Math.abs((e5.t + e5.b) / 2 - (deck.corpo[0] + deck.corpo[1]) / 2) <= 2,
    'E7 · com o CENTRO no meio do corpo da lista e sem cobrir o transporte', JSON.stringify({ e5: [e5.t, e5.b], deck }));
  const e8 = await esperar(pa, () => !document.getElementById('volPill').classList.contains('visivel'), null, 4000);
  checar(e8 === true, 'E8 · e some sozinha (1,5 s), como no Modo Fácil', porque(e8));
  await ctx2.close();

  // ======================= I · O MODELO ÚNICO, EM PAISAGEM (v1.12.42) =======================
  // A premissa da duração e o volume são escritos NO MESMO quadro da medida (sob carga um status
  // da prévia, com a mídia de 64 bytes, zera o `#seek` e a linha do tempo some). O volume é
  // acendido por `peekVolume()`, que é o caminho da tecla física — a barra `#pvVolume` da tela
  // cheia saiu na v1.13.57 e quem responde é a pílula única.
  const lerGeo = (pg) => pg.evaluate(() => {
    seekEl.disabled = false; seekEl.max = '120'; seekEl.value = '30'; renderSimpleTime();
    peekVolume();
    const r = (id) => {
      const el = document.getElementById(id);
      if (!el) return null;   // ausente devolve `null`: a reprovação chega com o dado que a explica
      const x = el.getBoundingClientRect();
      return { vis: getComputedStyle(el).display !== 'none', l: x.left, t: x.top, r: x.right, b: x.bottom,
        w: x.width, h: x.height, cx: x.left + x.width / 2, cy: x.top + x.height / 2 };
    };
    const exit = r('fsExit');
    const alvo = document.elementFromPoint(exit.cx, exit.cy);
    const pil = document.getElementById('volPill');
    return { vw: innerWidth, vh: innerHeight, modo: appMode,
      play: r('fsPlay'), prev: r('fsPrev'), next: r('fsNext'), exit, view: r('fsView'),
      nome: r('pvFsNome'), topo: r('pvFsTopo'), base: r('pvFsBase'), hit: r('pvFsTempoHit'),
      dur: r('pvFsTempoDur'), vol: r('volPill'), nomeTxt: document.getElementById('pvFsNome').textContent,
      volCasa: pil && pil.parentNode === document.getElementById('preview') ? 'previa' : 'outra',
      volNaPrevia: !!pil && pil.classList.contains('na-previa'),
      volUmaSo: document.querySelectorAll('.vol-pill').length === 1,
      exitNoTopo: !!alvo && document.getElementById('fsExit').contains(alvo) };
  });
  const sobre = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
  for (const [vw, vh] of [[740, 360], [900, 420]]) {
    for (const modo of ['simple', 'avancado']) {
      const cx = await navegador.newContext({ viewport: { width: vw, height: vh }, hasTouch: true });
      await semRedeExterna(cx);
      await vigiarTelaCheia(cx);
      if (modo === 'avancado') await comModoAvancado(cx);
      const p = await cx.newPage();
      p.on('pageerror', (e) => erros.push(`pageerror (I ${modo} ${vw}×${vh}): ` + e.message));
      await p.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
      await esperarCortina(p);
      const idsI = await plantar(p);
      if (modo === 'simple') {
        await p.evaluate(() => { setTocarNoCelular(true); });
        await p.evaluate((id) => send(id), idsI.video);
      } else {
        await p.evaluate((id) => send(id), idsI.video);
        await p.click('#pvFullBtn');
      }
      const ok = await esperar(p, naTelaCheia, null, 5000);
      const rot = `${modo === 'simple' ? 'Modo Fácil' : 'avançado'} ${vw}×${vh}`;
      checar(ok === true, `premissa · I · tela cheia (${rot})`, porque(ok));
      const g = await lerGeo(p);
      const j = JSON.stringify(g);
      checar(Math.abs(g.play.cx - g.vw / 2) <= 1 && Math.abs(g.play.cy - g.vh / 2) <= 1 && g.play.w >= g.exit.w * 1.4,
        `I1 · ${rot} · o play/pause fica no CENTRO da tela, maior que os outros botões`, j);
      checar(g.exit.vis && g.exit.r >= g.vw - 12 && g.exit.r <= g.vw - 8 && g.exit.b >= g.vh - 12 && g.exit.b <= g.vh - 8,
        `I2 · ${rot} · o SAIR fica no canto INFERIOR DIREITO`, j);
      checar(g.base.vis && g.exit.cy > g.base.t && g.exit.cy < g.base.b && g.hit.r <= g.exit.l && g.dur.r <= g.exit.l && g.exitNoTopo,
        `I3 · ${rot} · na linha do tempo, sem ser coberto por ela e sem cobrir a duração`, j);
      checar(!!g.vol && g.vol.vis && g.volCasa === 'previa' && g.volNaPrevia === true && g.volUmaSo === true
        // v1.14.7: a pílula deixou de nascer a 6px — o piso é 12px (o recorte do
        // tour tem de caber com o halo), e é isso que esta régua passa a exigir.
        && g.vol.h > g.vol.w && g.vol.l >= 12 && g.vol.l <= 16
        && g.vol.t >= g.nome.b && g.vol.b <= g.hit.t
        && g.nomeTxt === 'Provai e Vede' && g.nome.h > 0,
        `I4 · ${rot} · o NOME no topo e a PÍLULA de volume DENTRO da prévia, EM PÉ na borda esquerda, entre o título e a linha do tempo`,
        j);
      const centro = modo === 'simple' ? [g.play] : [g.prev, g.play, g.next];
      checar(!!g.vol && centro.every((c) => !sobre(c, g.vol) && !sobre(c, g.base) && !sobre(c, g.nome) && c.t >= g.nome.b && c.b <= g.hit.t),
        `I5 · ${rot} · o centro não toca a pílula, o título nem a linha do tempo`, j);
      if (modo === 'simple') {
        checar(!g.view.vis && !g.prev.vis && !g.next.vis,
          `I6 · ${rot} · sem cortina e sem ⏮/⏭ no Modo Fácil`, j);
      } else {
        checar(g.prev.vis && g.next.vis && Math.abs(g.prev.cy - g.play.cy) <= 1 && Math.abs(g.next.cy - g.play.cy) <= 1
          && g.prev.r <= g.play.l - 10 && g.next.l >= g.play.r + 10
          && Math.abs((g.play.cx - g.prev.cx) - (g.next.cx - g.play.cx)) <= 1,
          `I6 · ${rot} · ⏮ à ESQUERDA e ⏭ à DIREITA do play/pause, na mesma linha e à mesma distância`, j);
        checar(g.view.vis && g.view.r >= g.vw - 12 && g.view.t <= 12 && g.view.cy > g.topo.t && g.view.cy < g.topo.b
          && g.nome.r <= g.view.l,
          `I7 · ${rot} · a CORTINA no canto SUPERIOR DIREITO, na faixa do título, sem o título por baixo dela`, j);
      }
      // I8 · apagados os controles, um toque no MEIO da tela só os acende — o play/pause
      // escondido ali (o `.pv-fab` declara `pointer-events: auto`) não é acionado.
      await p.evaluate(() => {
        window.__playToques = 0;
        document.getElementById('fsPlay').addEventListener('click', () => { window.__playToques++; });
        document.getElementById('pvFsCtl').classList.remove('visivel');
      });
      await p.mouse.click(Math.round(g.play.cx), Math.round(g.play.cy));
      const i8 = await p.evaluate(() => ({ toques: window.__playToques,
        acesa: document.getElementById('pvFsCtl').classList.contains('visivel') }));
      checar(i8.toques === 0 && i8.acesa,
        `I8 · ${rot} · com os controles apagados, tocar no meio da tela só os ACENDE (o play/pause não é acionado)`,
        JSON.stringify(i8));
      // I9 · e aceso, o mesmo toque aciona o play/pause
      await p.mouse.click(Math.round(g.play.cx), Math.round(g.play.cy));
      const i9 = await p.evaluate(() => ({ toques: window.__playToques,
        acesa: document.getElementById('pvFsCtl').classList.contains('visivel') }));
      checar(i9.toques === 1 && i9.acesa, `I9 · ${rot} · e com eles acesos o mesmo toque aciona o play/pause`,
        JSON.stringify(i9));
      await cx.close();
    }
  }

  checar(erros.length === 0, 'nenhum erro de página', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

falhas.length ? (console.log('\n' + falhas.length + ' falha(s).'), process.exit(1))
  : console.log('\nTodos passaram.');
