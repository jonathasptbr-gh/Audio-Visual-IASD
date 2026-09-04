// ============================================================================
// O ENQUADRAMENTO VALE PARA A MÍDIA NOS DOIS CAMINHOS (v1.4.41)
//
// Pergunta do operador: *"faça uma verificação sobre os itens de preenchimento
// e girar. eles atualmente só servem para fotos? veja se consegue aplicar eles
// a todos os tipos de mídias na tela"*.
//
// ## O que a medição achou
//
// Não era "só fotos" — era "só quando a mídia É a cena". MEDIDO no `/display/`
// com o operador tendo escolhido `cover` e 90°:
//
//   #img        (imagem e apresentação COMO CENA)     → cover · girado
//   #video      (vídeo, transmissão direta)           → cover · girado
//   #textImg    (imagem e apresentação COMO CAMADA)   → contain · SEM GIRO
//   #lyricsImg  (fundo da estrofe)                    → cover · sem giro
//
// A MESMA foto e a MESMA página de apresentação chegam ao telão por dois
// caminhos — como cena, e como CAMADA por cima de um louvor de fundo (v5.312
// para a imagem, v1.4.28 para a apresentação). O segundo é desenhado pelo dono
// do palco, num `<img>` dele, e ficava preso no `object-fit: contain` da folha.
//
// **É o pior formato de defeito que aquele painel pode ter:** o mesmo controle,
// o mesmo conteúdo, e funciona ou não conforme haja uma música tocando por
// baixo — que é a última coisa que alguém relacionaria com "preenchimento".
//
// ## O que este arquivo trava, e por que cada metade
//
//  1. **A CAMADA segue o preenchimento e o giro**, nas DUAS pontas que pintam.
//     Uma só não basta, e é a armadilha que o `fundo-da-letra` já pagou aqui:
//     *ler cada lado isolado aprova os dois*. Sem TV a preview É a projeção.
//  2. **A CENA continua seguindo** — a reversão. Sem ela, um conserto que
//     movesse a regra para a camada e a perdesse no `img` passaria inteiro.
//  3. **O FUNDO DA ESTROFE fica de fora**, e esta é a metade que impede o
//     conserto largo demais ("aplicar a tudo que é `<img>`"). Ele não é a
//     mídia: é o fundo ATRÁS da letra, e `cover` ali não é uma escolha de
//     enquadramento — uma letra sobre barras pretas é um defeito. Girá-lo
//     deitaria a imagem por trás de um texto que continua de pé.
//  4. **O GIRO É REPOSTO AO REVELAR A CAMADA.** É o caso que um conserto
//     ingênuo (mexer só no `setRotate`) não cobre: `aplicarGiro` desiste quando
//     não consegue medir a caixa, e um elemento `hidden` não tem caixa. Girar
//     com o telão no wallpaper e só então projetar entregava a mídia sem giro —
//     o mesmo defeito que o `applyMedia` já resolvia para o `img`/`video`.
//
//     **E a reposição é PEDIDA nos dois lados mesmo o telão passando sem ela**
//     (MEDIDO por reversão: sem as chamadas, só a PREVIEW reprova). Ali o
//     `showText` mexe na cortina, o `applyMedia` roda por tabela e repõe o giro
//     de carona — um acidente de ordem, não um contrato. Quem apagar a chamada
//     do `display.js` por "estar sobrando" descobre isso no primeiro lote que
//     mexer no caminho da cortina, e descobre no telão.
//
// A medida é a CAIXA RENDERIZADA e o `object-fit` COMPUTADO, não a classe nem o
// estilo inline: o giro troca o eixo da caixa antes de girar (é o que faz o
// `object-fit` medir o retângulo em que a mídia vai de fato aparecer), então
// num palco 961×540 uma camada girada mede 540×961. Uma asserção sobre o
// atributo `style` aprovaria um giro que o CSS de baixo tivesse sobrescrito.
//
//   node tools/enquadramento-da-camada.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, checar, falhas } from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');

const servidor = servirEstatico(RAIZ);

// O WAV é longo de propósito: a camada só existe COM um louvor por baixo, e uma
// faixa que acabasse no meio derrubaria o cenário em vez de o teste.
const SEMEAR = `
  const sr = 8000, secs = 30, n = sr * secs;
  const buf = new ArrayBuffer(44 + n * 2), dv = new DataView(buf);
  const wr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  wr(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); wr(8, 'WAVEfmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true);
  dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  wr(36, 'data'); dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, Math.sin(i / 20) * 3000, true);
  const png = await (await fetch('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')).blob();
  const a = await AVDB.addMedia(new Blob([buf], { type: 'audio/wav' }),
    { name: 'Louvor de fundo', type: 'audio/wav', kind: 'audio', list: 'imports' });
  const i = await AVDB.addMedia(png,
    { name: 'Aviso da secretaria', type: 'image/png', kind: 'image', list: 'imports' });
`;

await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await navegador.newContext({ viewport: { width: 961, height: 540 } });
await semRedeExterna(ctx);

const erros = [];
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY/;
function ouvir(pg, rotulo) {
  pg.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (EXTERNO.test(t) || /Failed to load resource/.test(t)) return;
    erros.push(rotulo + ': ' + t);
  });
  pg.on('pageerror', (e) => erros.push(rotulo + ' pageerror: ' + e.message));
}

// A sonda: o que o navegador de fato desenhou.
//
// `girado` é a TROCA DE EIXO da caixa — o mecanismo do giro deste palco, e o
// que separa um giro DE VERDADE de um `transform` solto (ver o KDoc de
// `aplicarGiro`: sem trocar o eixo, o `object-fit` encaixa a mídia no retângulo
// errado e um vídeo retrato girado sai minúsculo).
//
// A MEDIDA É `offsetWidth`/`offsetHeight`, NUNCA `getBoundingClientRect` —
// MEDIDO escrevendo este arquivo, e é uma armadilha que aprova o defeito: o
// rect é a caixa ALINHADA AOS EIXOS do elemento já transformado, então um
// elemento de 540×961 girado 90° devolve 961×540, exatamente o mesmo número de
// um elemento que não girou nada. As duas versões dão a mesma resposta.
//
// E O ALVO É O PALCO DAQUELE ELEMENTO, não um número fixo: o telão mede a
// janela e a preview mede a caixinha dela. Um `540×961` escrito aqui provaria a
// regra no telão e reprovaria a preview com o app certo — que é o oráculo
// medindo a viewport em vez do código.
const SONDA = `(ids) => {
  const medir = (id) => {
    const el = document.getElementById(id);
    if (!el) return { ausente: true };
    const s = getComputedStyle(el);
    // O EIXO É COMPARADO COM O PRÓPRIO PALCO DAQUELE ELEMENTO, e nunca com um
    // número escrito aqui: o telão mede a janela inteira e a preview mede a
    // caixinha dela — dois tamanhos, a MESMA regra. O aplicarGiro do stage.js
    // lê o pai, e a sonda lê o mesmo pai. (Sem crase nenhuma neste bloco: ele
    // vive dentro de um template literal.)
    const pai = el.parentElement;
    const pw = pai ? pai.clientWidth : 0;
    const ph = pai ? pai.clientHeight : 0;
    return {
      fit: s.objectFit,
      girado: !!pw && !!ph && el.offsetWidth === ph && el.offsetHeight === pw
        && s.transform !== 'none',
      caixa: el.offsetWidth + 'x' + el.offsetHeight + ' (palco ' + pw + 'x' + ph + ')',
      visivel: !el.hidden && !!el.getAttribute('src'),
    };
  };
  const fora = {};
  ids.forEach((id) => { fora[id] = medir(id); });
  return fora;
}`;

try {
  // ======================================================================
  // METADE 1 — A PREVIEW do Controle (sem TV, ela É a projeção)
  // ======================================================================
  const pg = await ctx.newPage();
  ouvir(pg, 'controle');
  await pg.goto(base + '/controle/', { waitUntil: 'load' });
  await pg.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function', null, { timeout: 20000 });

  const ids = await pg.evaluate(new Function('return (async () => {'
    + 'setAppMode("full");' + SEMEAR + 'await load(); return { audio: a.id, imagem: i.id }; })()'));

  // O OPERADOR ESCOLHE ANTES DE PROJETAR, e essa ordem é o cenário 4: com o
  // palco no wallpaper a camada ainda não existe, então o giro não tem caixa
  // para medir — quem o repõe é a revelação.
  await pg.evaluate(async () => { await applyFit('cover'); await applyRotate(90); });
  await pg.evaluate((id) => send(id), ids.audio);
  await pg.waitForTimeout(1200);
  await pg.evaluate((id) => send(id), ids.imagem);
  await pg.waitForTimeout(1200);

  const pv = await pg.evaluate(new Function('return (' + SONDA + ')(["pvTextImg", "pvImg"])'));
  const audioAndando = await pg.evaluate(() => {
    const v = document.querySelector('#preview video');
    return { pausado: v ? v.paused : null, tempo: v ? v.currentTime : null };
  });
  checar(pv.pvTextImg.visivel && !audioAndando.pausado,
    'ponto de partida: a imagem está sobreposta ao louvor na PREVIEW', { pv: pv.pvTextImg, audioAndando });
  checar(pv.pvTextImg.fit === 'cover',
    'a CAMADA da preview segue o PREENCHIMENTO — ela ficava presa no `contain` '
    + 'da folha, com o mesmo controle valendo para a mesma foto projetada como cena',
    pv.pvTextImg);
  checar(pv.pvTextImg.girado,
    '  ↳ e segue o GIRO, com a troca de eixo da caixa (o mecanismo deste palco), '
    + 'reposta no instante em que a camada deixou de estar escondida',
    pv.pvTextImg);

  // ---- O FUNDO DA ESTROFE FICA DE FORA (o conserto largo demais) ----------
  const letra = await pg.evaluate(new Function('return (' + SONDA + ')(["pvLyricsBgImg"])'));
  const bgPreview = await pg.$eval('.pv-lyrics-bg img', (el) => {
    const s = getComputedStyle(el);
    return { fit: s.objectFit, girado: s.transform !== 'none' };
  }).catch(() => null);
  checar(bgPreview && bgPreview.fit === 'cover' && !bgPreview.girado,
    'o FUNDO DA ESTROFE não entra: ele não é a mídia, é o fundo ATRÁS da letra '
    + '— `cover` ali não é escolha de enquadramento, e girá-lo deitaria a imagem '
    + 'sob um texto que continua de pé', { bgPreview, letra });

  // ======================================================================
  // METADE 2 — O TELÃO, que é quem a congregação vê
  // ======================================================================
  const tv = await ctx.newPage();
  ouvir(tv, 'display');
  await tv.goto(base + '/display/', { waitUntil: 'load' });
  await tv.waitForFunction(() => !!window.AVDB && !!document.getElementById('textImg'), null, { timeout: 20000 });

  const idsTv = await tv.evaluate(new Function('return (async () => {' + SEMEAR
    + 'return { audio: a.id, imagem: i.id }; })()'));

  const mandar = (c) => tv.evaluate((cmd) => {
    const bc = new BroadcastChannel('av-iasd');
    bc.postMessage(cmd); bc.close();
  }, c);

  // MESMA ORDEM da preview: escolher com o palco vazio, projetar depois.
  await mandar({ type: 'fit', fit: 'cover' });
  await mandar({ type: 'rotate', rotate: 90 });
  await mandar({ type: 'load', mediaId: idsTv.audio, view: 'visual', muted: true, volume: 0 });
  await tv.waitForTimeout(1400);
  await mandar({ type: 'text', mode: 'image', mediaId: idsTv.imagem, sub: '', view: 'visual' });
  await tv.waitForTimeout(1200);

  const t = await tv.evaluate(new Function('return (' + SONDA + ')(["textImg", "img", "lyricsImg"])'));
  checar(t.textImg.visivel,
    'ponto de partida: o TELÃO desenha a imagem sobreposta ao louvor', t.textImg);
  checar(t.textImg.fit === 'cover',
    'a CAMADA do TELÃO segue o PREENCHIMENTO', t.textImg);
  checar(t.textImg.girado,
    '  ↳ e segue o GIRO — a metade que roda na frente da congregação, e a que '
    + 'menos rede de segurança tem (o watchdog do OTA não a valida)', t.textImg);
  checar(t.lyricsImg.fit === 'cover' && !t.lyricsImg.girado,
    'e o fundo da estrofe do TELÃO também fica de fora', t.lyricsImg);

  // ---- A REVERSÃO: a CENA continua seguindo os dois -----------------------
  // Sem esta metade, um conserto que MOVESSE a regra para a camada e a
  // perdesse no `img` passaria em tudo o que está acima.
  await mandar({ type: 'text-hide' });
  await tv.waitForTimeout(500);
  await mandar({ type: 'load', mediaId: idsTv.imagem, view: 'visual', muted: true, volume: 0 });
  await tv.waitForTimeout(1200);
  const cena = await tv.evaluate(new Function('return (' + SONDA + ')(["img"])'));
  checar(cena.img.visivel && cena.img.fit === 'cover' && cena.img.girado,
    'e a MESMA imagem projetada como CENA continua seguindo os dois — a reversão, '
    + 'sem a qual um conserto que trocasse um caminho pelo outro passaria inteiro',
    cena.img);

  checar(erros.length === 0, 'nenhum erro de console', erros);
} catch (e) {
  checar(false, 'o percurso terminou sem exceção (' + (e && e.message) + ')');
} finally {
  await navegador.close();
  servidor.close();
}

console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
