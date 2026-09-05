#!/usr/bin/env node
// ============================================================================
// O VÍDEO QUE ESTAVA DENTRO DA APRESENTAÇÃO (v1.6.2)
//
// Pedido do operador, verbatim: *"Pode fazer o anexado a página, mas faça as
// interações de forma automática, como iniciar e voltar para a apresentação
// prosseguindo para o próximo slide e etc..."*
//
// ## Por que este oráculo existe
//
// O `pptxzip.test.mjs` prende a REGRA — que o vídeo sai do zip e cai na página
// certa. Este prende a LIGAÇÃO, que falha de outro jeito: a regra continua
// certa e o recurso não faz nada. As quatro metades erram TODAS em silêncio, e
// todas no sábado de manhã:
//
//  1. **Chegar na página não toca o vídeo.** O operador aperta ⏭, o slide troca
//     e o vídeo do sermão simplesmente não entra. Nada no console.
//  2. **O fim do vídeo não devolve a apresentação.** Pior que a anterior: o
//     `autoAdvance` de sempre assume e projeta o PRÓXIMO ITEM DA FILA — o
//     louvor do pós-sermão, no meio do sermão. Com `repeat: 'one'` o vídeo
//     entra em laço para sempre.
//  3. **A volta não avança.** A apresentação reaparece no slide do vídeo, e o
//     próximo ⏭ toca o vídeo outra vez: o operador fica preso num laço que só
//     um Parar quebra.
//  4. **O coletor leva os vídeos embora.** Eles não estão em lista nenhuma de
//     propósito; sem a apresentação contar como DETENTORA, a faxina da abertura
//     seguinte os recolhe. A apresentação continua na lista, as páginas
//     continuam desenhando, e o vídeo não toca mais — descoberto no culto.
//
// Cada asserção vem com a REVERSÃO ao lado: uma página SEM vídeo não pode
// disparar nada, e o `send` de qualquer outra coisa tem de DESARMAR a volta —
// sem essas duas, "tocar sempre" e "voltar sempre" passariam em tudo o mais.
//
//   node tools/pptx-video-na-pagina.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, checar, falhas, esperar, porque } from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);

const PAGINAS = 4;

// O acervo: uma apresentação de 4 páginas com um vídeo preso à PÁGINA 1 (a
// segunda). O "vídeo" é um WAV com `kind: 'video'` — o que se mede aqui é o
// COMANDO e o BANCO, nunca a decodificação, e um mp4 de verdade não entra num
// repositório que recusa binário de terceiro.
const SEMEAR = `
  const sr = 8000, secs = 3, n = sr * secs;
  const buf = new ArrayBuffer(44 + n * 2), dv = new DataView(buf);
  const wr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  wr(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); wr(8, 'WAVEfmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true);
  dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  wr(36, 'data'); dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, Math.sin(i / 20) * 3000, true);

  const vid = await AVDB.addMedia(new Blob([buf], { type: 'audio/wav' }), {
    name: 'Apresentacao · pagina 2', type: 'audio/wav', kind: 'video', list: 'avulsos',
  });
  const pages = [];
  for (let i = 0; i < ${PAGINAS}; i++) {
    const cv = document.createElement('canvas');
    cv.width = 32; cv.height = 18;
    const c = cv.getContext('2d');
    c.fillStyle = 'hsl(' + (i * 61) + ',70%,50%)';
    c.fillRect(0, 0, 32, 18);
    pages.push(await new Promise((r) => cv.toBlob(r, 'image/png')));
  }
  const d = await AVDB.addDeck(pages, {
    name: 'Sermao com video', list: 'imports', videos: { 1: vid.id },
  });
  await AVDB.listRemove('avulsos', vid.id);
  // Um segundo item na fila: e ele que o autoAdvance projetaria se a volta da
  // apresentacao nao existisse — a metade 2 acima.
  const outro = await AVDB.addMedia(new Blob([buf], { type: 'audio/wav' }), {
    name: 'Louvor do pos-sermao', type: 'audio/wav', kind: 'audio', list: 'imports',
  });
`;

await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);

const erros = [];
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY/;

console.log('::group::pptx-video-na-pagina');
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
    + 'await load(); return { vid: vid.id, deck: d.id, outro: outro.id }; })()'));

  // O BARRAMENTO, gravado. É o que prova a automação: um teste da tela não
  // distingue "projetou o vídeo" de "ficou no slide e por acaso pintou preto".
  await pg.evaluate(() => {
    window.__cmds = [];
    const real = AVDB.sendCommand.bind(AVDB);
    AVDB.sendCommand = (o) => { window.__cmds.push(o); return real(o); };
  });

  const loads = () => pg.evaluate(() => window.__cmds.filter((c) => c.type === 'load').map((c) => c.mediaId));
  const zerar = () => pg.evaluate(() => { window.__cmds = []; });
  const estado = () => pg.evaluate(() => ({
    atual: currentId, pagina: deckPagina,
    armado: !!deckVideoVolta,
  }));

  // ======================================================================
  // 1. ABRIR a apresentação NÃO toca o vídeo — a decisão escrita no código
  // ======================================================================
  await pg.evaluate((id) => send(id), ids.deck);
  let r = await esperar(pg, (id) => currentId === id, ids.deck, 10000);
  checar(r === true, 'a apresentação entra em cena', porque(r));
  let st = await estado();
  checar(st.pagina === 0, 'a apresentação abre na página 0', st.pagina);
  checar(st.armado === false, 'e abrir NÃO arma a volta (o vídeo não é da página 0)', st.armado);

  // ======================================================================
  // 2. CHEGAR na página com vídeo projeta o vídeo — a metade 1
  // ======================================================================
  await zerar();
  await pg.evaluate(() => deckStep(1));
  r = await esperar(pg, (id) => currentId === id, ids.vid, 10000);
  checar(r === true, 'o vídeo da página entra em cena', porque(r));
  const l1 = await loads();
  checar(l1.indexOf(ids.vid) >= 0, 'chegar na página 1 projeta o vídeo daquela página', l1.join(','));
  st = await estado();
  checar(st.armado === true, 'e a volta fica armada', st.armado);

  // ======================================================================
  // 3. O FIM do vídeo devolve a apresentação, NA PÁGINA SEGUINTE
  //    — as metades 2 e 3, pelo caminho REAL (`autoAdvance`, o ponto único
  //    por onde o `media-ended` do telão e o `onEnded` da preview passam).
  // ======================================================================
  await zerar();
  await pg.evaluate(() => autoAdvance());
  r = await esperar(pg, (id) => currentId === id, ids.deck, 10000);
  checar(r === true, 'a apresentação volta ao fim do vídeo', porque(r));
  const l2 = await loads();
  checar(l2.indexOf(ids.deck) >= 0, 'o fim do vídeo devolve a apresentação', l2.join(','));
  checar(l2.indexOf(ids.outro) < 0,
    'REVERSÃO: e NÃO projeta o próximo item da fila', l2.join(','));
  r = await esperar(pg, () => deckPagina === 2, null, 10000);
  st = await estado();
  checar(st.pagina === 2, 'e a apresentação volta na página SEGUINTE, não na do vídeo', st.pagina);
  checar(st.armado === false, 'a volta se desarma sozinha', st.armado);

  // ======================================================================
  // 4. REVERSÃO: uma página SEM vídeo não dispara nada
  // ======================================================================
  await zerar();
  await pg.evaluate(() => deckStep(1));
  st = await estado();
  checar(st.pagina === 3, 'o ⏭ numa página sem vídeo só passa a página', st.pagina);
  checar(st.atual === ids.deck, 'a apresentação continua sendo a cena', st.atual === ids.deck);
  const l3 = await loads();
  checar(l3.length === 0, 'e nenhum load sai do barramento', l3.join(','));

  // ======================================================================
  // 5. REVERSÃO: projetar outra coisa DESARMA a volta
  //    Sem isto, o operador que interrompe o vídeo para projetar um louvor vê
  //    a apresentação voltar por cima dele quando o louvor acaba.
  // ======================================================================
  await pg.evaluate(() => deckIr(1));
  r = await esperar(pg, (id) => currentId === id, ids.vid, 10000);
  checar(r === true, 'o vídeo volta ao ar pelo deckIr', porque(r));
  checar((await estado()).armado === true, 'armada de novo na página do vídeo', true);
  await pg.evaluate((id) => send(id), ids.outro);
  r = await esperar(pg, (id) => currentId === id, ids.outro, 10000);
  checar(r === true, 'o louvor do pós-sermão entra em cena', porque(r));
  checar((await estado()).armado === false,
    'projetar outra coisa desarma a volta', (await estado()).armado);

  // ======================================================================
  // 6. O COLETOR — a metade 4, e a única que só aparece na abertura SEGUINTE
  //
  // A PRATELEIRA `avulsos` ENTRA NO MEIO, e é preciso dizer o que ela é para a
  // asserção medir a regra certa: `send` põe TODO item projetado nela
  // (`fixarAvulso`, teto de 3 e FIFO), e isso vale para o vídeo de slide como
  // vale para um louvor — é ela que impede a cena no ar de ser coletada. Ela é
  // INVISÍVEL e é LIMITADA, então não é ela que responde "o vídeo sobrevive à
  // apresentação?". Quem responde é a apresentação ser DETENTORA dele, e para
  // medir isso a prateleira é esvaziada antes: com ela cheia, a asserção
  // passaria mesmo com o `lerDetentores` sem a regra nova.
  // ======================================================================
  const visivel = await pg.evaluate(async (id) => {
    for (const l of ['imports', 'playlist', 'favs']) {
      if ((await AVDB.listIds(l)).indexOf(id) >= 0) return l;
    }
    return '';
  }, ids.vid);
  checar(visivel === '', 'o vídeo não está em lista VISÍVEL — não é item do Cronograma', visivel);

  await pg.evaluate(async () => {
    for (const id of await AVDB.listIds('avulsos')) await AVDB.listRemove('avulsos', id);
  });
  const naPrateleira = await pg.evaluate(() => AVDB.listIds('avulsos'));
  checar(naPrateleira.length === 0, 'a prateleira foi esvaziada para a medição', naPrateleira.join(','));

  await pg.evaluate(() => AVDB.gcOrfaos());
  const sobreviveu = await pg.evaluate((id) => AVDB.getMedia(id).then((r) => !!r), ids.vid);
  checar(sobreviveu === true,
    'a faxina de órfãos NÃO leva o vídeo: a apresentação é detentora dele', sobreviveu);

  // E SAIR DA ÚLTIMA LISTA MATA A APRESENTAÇÃO NA HORA, E O VÍDEO NA FAXINA
  // SEGUINTE — que é exatamente o que acontece com os ids de um `cue`, pelo
  // mesmo mecanismo: `listRemove` coleta o id que saiu, e só ele. O vídeo fica
  // órfão até o `gcOrfaos` da abertura seguinte, e a asserção afirma esse
  // percurso, não um cascateamento que o `db.js` não faz.
  await pg.evaluate((id) => AVDB.listRemove('imports', id), ids.deck);
  const deckMorto = await pg.evaluate((id) => AVDB.getMedia(id).then((r) => !!r), ids.deck);
  checar(deckMorto === false, 'tirar a apresentação da última lista a coleta', deckMorto);

  await pg.evaluate(() => AVDB.gcOrfaos());
  const vidMorto = await pg.evaluate((id) => AVDB.getMedia(id).then((r) => !!r), ids.vid);
  checar(vidMorto === false,
    'e a faxina seguinte leva o vídeo dela — sem bookkeeping paralelo', vidMorto);

  checar(erros.length === 0, 'nenhum erro de console no percurso', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}
console.log('::endgroup::');
process.exit(falhas.length ? 1 : 0);
