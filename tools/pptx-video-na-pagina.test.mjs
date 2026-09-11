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
import { servirEstatico, abrirNavegador, checar, falhas, esperar, esperarDb, porque } from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);

// CINCO páginas, com vídeo na 1 e na 4 (a última). A 3 fica LIVRE de propósito:
// é nela que o bloco 4 prova que uma página sem vídeo não dispara nada, e com
// quatro páginas ela seria a última — que tem vídeo.
const PAGINAS = 5;

// O acervo: uma apresentação de 4 páginas com um vídeo preso à PÁGINA 1 (a
// segunda). O "vídeo" é um WAV com `kind: 'video'` — o que se mede aqui é o
// COMANDO e o BANCO, nunca a decodificação, e um mp4 de verdade não entra num
// repositório que recusa binário de terceiro.
const SEMEAR = `
  // TRINTA SEGUNDOS, longo de propósito: com um "vídeo" curto ele ACABA sozinho
  // no meio das asserções, a automação dispara por conta própria e o oráculo
  // passa a medir uma CORRIDA — foi assim que a reversão do pulo pelo botão
  // deixou de reprovar. Aqui o fim só acontece quando o teste o pede.
  const sr = 8000, secs = 30, n = sr * secs;
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
  // O SEGUNDO video mora na ULTIMA pagina: e o caso do LACO. A volta e limitada
  // ao fim da apresentacao, pousa na MESMA pagina, e sem a supressao a chegada
  // redispara o video para sempre.
  const vidFim = await AVDB.addMedia(new Blob([buf], { type: 'audio/wav' }), {
    name: 'Apresentacao · ultima pagina', type: 'audio/wav', kind: 'video', list: 'avulsos',
  });
  const d = await AVDB.addDeck(pages, {
    name: 'Sermao com video', list: 'imports',
    videos: { 1: vid.id, [${PAGINAS} - 1]: vidFim.id },
  });
  await AVDB.listRemove('avulsos', vid.id);
  await AVDB.listRemove('avulsos', vidFim.id);
  // Um segundo item na fila: e ele que o autoAdvance projetaria se a volta da
  // apresentacao nao existisse — a metade 2 acima.
  const outro = await AVDB.addMedia(new Blob([buf], { type: 'audio/wav' }), {
    name: 'Louvor do pos-sermao', type: 'audio/wav', kind: 'audio', list: 'imports',
  });
  // UM SEGUNDO DECK, com video na PRIMEIRA pagina: e o autoplay ao ABRIR, e ele
  // mora a parte de proposito — po-lo na capa do deck principal mudaria o que
  // todos os blocos anteriores medem.
  const vidCapa = await AVDB.addMedia(new Blob([buf], { type: 'audio/wav' }), {
    name: 'Capa · pagina 1', type: 'audio/wav', kind: 'video', list: 'avulsos',
  });
  const dCapa = await AVDB.addDeck(pages.slice(0, 2), {
    name: 'Abre com video', list: 'imports', videos: { 0: vidCapa.id },
  });
  await AVDB.listRemove('avulsos', vidCapa.id);

  // E A FILA DE VERDADE, com a apresentacao em PRIMEIRO: e essa a forma do
  // relato. O plItems sai da lista 'playlist', e com ela vazia o step() retorna
  // na primeira linha — um oraculo sobre o proximo de MIDIA mediria nada.
  await AVDB.listAdd('playlist', d.id);
  await AVDB.listAdd('playlist', outro.id);
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
    + 'await load(); return { vid: vid.id, vidFim: vidFim.id, vidCapa: vidCapa.id, deck: d.id, deckCapa: dCapa.id, outro: outro.id }; })()'));

  // O BARRAMENTO, gravado. É o que prova a automação: um teste da tela não
  // distingue "projetou o vídeo" de "ficou no slide e por acaso pintou preto".
  await pg.evaluate(() => {
    window.__cmds = [];
    const real = AVDB.sendCommand.bind(AVDB);
    AVDB.sendCommand = (o) => { window.__cmds.push(o); return real(o); };
  });

  const loads = () => pg.evaluate(() => window.__cmds.filter((c) => c.type === 'load').map((c) => c.mediaId));
  const zerar = () => pg.evaluate(() => { window.__cmds = []; });

  // ===== A CENA NO AR, E POR QUE `currentId` NÃO BASTA =====
  //
  // `send()` escreve `currentId` LOGO NO COMEÇO — antes do `getMedia`, do
  // `persistCurrent` e da resolução do registro — e só no FIM emite o `load` e
  // assenta o que a cena deixa atrás de si: o `deckVideoVolta`, o eixo do
  // ⏮/⏭, a página que o comando leva. Esperar pelo `currentId` é esperar pela
  // INTENÇÃO, não pelo FATO, e entre os dois há turnos de microtarefa.
  //
  // MEDIDO: com o oráculo perguntando pelo `currentId`, 2 reprovações em 8
  // rodadas a 3× de carga — sempre nas asserções que leem o que vem DEPOIS
  // dele (a página dentro do `load` da volta, o `slideTarget()` com o vídeo no
  // ar), e nunca nas que leem o próprio `currentId`. É a classe que o
  // `CLAUDE.md` nomeia: *esperar pela INGESTÃO (o dado entrando), nunca pela
  // resposta DERIVADA.*
  //
  // Aqui a espera é pelo ÚLTIMO comando de cena ser o `load` daquele id — o
  // último passo do `send`. **Não é tautologia**: o que as asserções afirmam é
  // o CONTEÚDO daquele comando (a página que ele leva) e o ESTADO que ele
  // deixou (o eixo dos botões, a volta armada), nunca que ele existe.
  const noAr = (id) => esperar(pg, (alvo) => {
    if (typeof currentId === 'undefined' || currentId !== alvo) return false;
    const cena = window.__cmds.filter(
      (c) => c.type === 'load' || c.type === 'clear' || c.type === 'media-clear',
    );
    const ultimo = cena[cena.length - 1];
    return !!ultimo && ultimo.type === 'load' && ultimo.mediaId === alvo;
  }, id, 10000);
  const estado = () => pg.evaluate(() => ({
    atual: currentId, pagina: deckPagina,
    armado: !!deckVideoVolta,
  }));

  // ======================================================================
  // 1. ABRIR a apresentação NÃO toca o vídeo — a decisão escrita no código
  // ======================================================================
  await pg.evaluate((id) => send(id), ids.deck);
  let r = await noAr(ids.deck);
  checar(r === true, 'a apresentação entra em cena', porque(r));
  let st = await estado();
  checar(st.pagina === 0, 'a apresentação abre na página 0', st.pagina);
  checar(st.armado === false,
    'e sem vídeo na capa a abertura não arma nada', st.armado);

  // ======================================================================
  // 2. CHEGAR na página com vídeo projeta o vídeo — a metade 1
  // ======================================================================
  await zerar();
  await pg.evaluate(() => deckStep(1));
  r = await noAr(ids.vid);
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
  r = await noAr(ids.deck);
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
  r = await noAr(ids.vid);
  checar(r === true, 'o vídeo volta ao ar pelo deckIr', porque(r));
  checar((await estado()).armado === true, 'armada de novo na página do vídeo', true);
  await pg.evaluate((id) => send(id), ids.outro);
  r = await noAr(ids.outro);
  checar(r === true, 'o louvor do pós-sermão entra em cena', porque(r));
  checar((await estado()).armado === false,
    'projetar outra coisa desarma a volta', (await estado()).armado);

  // ======================================================================
  // 5-B. OS TRÊS DEFEITOS DO RELATO (v1.6.5)
  //
  //   *"o botão de próximo slide não reconhece o vídeo como uma página, logo
  //   ele não fica ativo para toque. segundo que qualquer tipo de tocar
  //   seguinte, faz com que a apresentação volte para o início"*
  //
  // Os dois são o MESMO defeito visto de dois lugares: com o vídeo em cena
  // `currentItem` é o VÍDEO, então o app perdeu a noção de que a apresentação é
  // que está no ar. O terceiro não foi relatado e é pior que os dois — o LAÇO
  // da última página, que só um Parar quebraria.
  // ======================================================================
  // A CENA ENTRA LIMPA, e isto não é preparo: com um ÁUDIO no ar o `send` de uma
  // apresentação a SOBREPÕE em vez de substituir (v1.4.28), a automação não arma
  // (ela é só para o deck como MÍDIA) e o oráculo mediria o caso errado —
  // aprovando por outro caminho. Foi o que a primeira escrita deste bloco fez.
  await pg.evaluate(() => stopClear());
  await pg.evaluate((id) => send(id), ids.deck);
  r = await noAr(ids.deck);
  checar(r === true, 'a apresentação entra como MÍDIA, não como camada', porque(r));
  checar((await pg.evaluate(() => deckSobreProjetando())) === false,
    'e não está sobreposta — a automação só vale para o deck como mídia', true);
  await pg.evaluate(() => deckIr(1));
  r = await noAr(ids.vid);
  checar(r === true, 'e o vídeo da página 1 entra', porque(r));

  // 5-B.1 — O PAR DE BOTÕES RECONHECE O VÍDEO COMO PÁGINA
  const eixo = await pg.evaluate(() => ({
    alvo: slideTarget(),
    prev: document.getElementById('slidePrevBtn').disabled,
    next: document.getElementById('slideNextBtn').disabled,
  }));
  checar(eixo.alvo === 'deck', 'com o vídeo no ar o eixo do ⏮/⏭ é a APRESENTAÇÃO', eixo.alvo);
  checar(eixo.next === false, 'e o "próximo slide" fica TOCÁVEL', eixo.next);
  checar(eixo.prev === false, 'e o "slide anterior" também', eixo.prev);

  // 5-B.2 — O ⏭ DE SLIDE PULA O VÍDEO, e vai para a página seguinte
  await zerar();
  await pg.evaluate(() => stepSlide(1));
  r = await noAr(ids.deck);
  checar(r === true, 'o ⏭ de slide devolve a apresentação', porque(r));
  r = await esperar(pg, () => deckPagina === 2, null, 10000);
  checar(r === true, 'e pula o vídeo, indo para a página SEGUINTE', porque(r));

  // 5-B.3 — O ⏭ DE MÍDIA NÃO VOLTA A APRESENTAÇÃO PARA O INÍCIO
  //
  // A apresentação é o PRIMEIRO item da fila, que é o caso do relato: com a
  // âncora errada o `idx === -1` caía no índice 0 — nela mesma, na página 0.
  await pg.evaluate(() => deckIr(1));
  r = await noAr(ids.vid);
  checar(r === true, 'o vídeo volta ao ar para a metade 3', porque(r));
  await zerar();
  await pg.evaluate(() => step(1));
  r = await noAr(ids.outro);
  checar(r === true,
    'o ⏭ de MÍDIA vai para o item SEGUINTE da fila, não para o começo dela', porque(r));

  // 5-B.4 — O LAÇO DA ÚLTIMA PÁGINA
  //
  // Não foi relatado porque o operador não chegou lá: `deckIr(pagina + 1)` é
  // limitado ao fim, a volta pousa na MESMA página e a chegada redispara o
  // vídeo. A prova é o vídeo NÃO voltar ao ar depois de acabar.
  await pg.evaluate(() => stopClear());
  await pg.evaluate((id) => send(id), ids.deck);
  r = await noAr(ids.deck);
  checar(r === true, 'a apresentação volta ao ar para a metade 4', porque(r));
  await pg.evaluate((n) => deckIr(n), PAGINAS - 1);
  r = await noAr(ids.vidFim);
  checar(r === true, 'o vídeo da ÚLTIMA página entra', porque(r));
  await pg.evaluate(() => autoAdvance());
  r = await noAr(ids.deck);
  checar(r === true, 'o fim dele devolve a apresentação', porque(r));
  // A janela tem de ser maior que o caminho do redisparo (um `send` inteiro).
  await pg.waitForTimeout(1200);
  const depois = await estado();
  checar(depois.atual === ids.deck,
    'e ela FICA: o vídeo da última página não redispara em laço', depois.atual === ids.vidFim ? 'o vídeo voltou (LAÇO)' : depois.atual);
  checar(depois.pagina === PAGINAS - 1,
    'a apresentação para na última página, sem avançar para o nada', depois.pagina);
  checar(depois.armado === false, 'e a volta fica desarmada', depois.armado);

  // 5-B.5 — REVERSÃO: sem vídeo no ar o ⏭ de mídia continua o de sempre
  await pg.evaluate(() => stopClear());
  await pg.evaluate((id) => send(id), ids.deck);
  r = await noAr(ids.deck);
  checar(r === true, 'a apresentação no ar, sem vídeo', porque(r));
  await pg.evaluate(() => step(1));
  r = await noAr(ids.outro);
  checar(r === true, 'REVERSÃO: o ⏭ de mídia sem vídeo de slide segue a fila', porque(r));

  // ======================================================================
  // 5-C. O QUE O OPERADOR PEDIU DEPOIS (v1.6.6)
  //
  //   *"ao voltar de um vídeo, estou vendo o mesmo slide inicial da
  //   apresentação"* · *"no caso do primeiro slide ser um vídeo, pode fazer um
  //   autoplay para ele"*
  // ======================================================================

  // 5-C.1 — A VOLTA NÃO PISCA A CAPA
  //
  // Ela ia ao ar por DOIS comandos: um `load` com `page: 0` (a regra do `send`)
  // e um `page` logo depois. Nada saía de ordem — o que havia era a CAPA pintada
  // entre os dois, na frente da congregação. A prova é o `page` que viaja DENTRO
  // do `load`: um teste do estado final passa nas duas versões.
  await pg.evaluate(() => stopClear());
  await pg.evaluate((id) => send(id), ids.deck);
  r = await noAr(ids.deck);
  checar(r === true, 'a apresentação no ar para o bloco 5-C', porque(r));
  await pg.evaluate(() => deckIr(1));
  r = await noAr(ids.vid);
  checar(r === true, 'o vídeo da página 1 entra', porque(r));
  await zerar();
  await pg.evaluate(() => autoAdvance());
  r = await noAr(ids.deck);
  checar(r === true, 'e o fim dele devolve a apresentação', porque(r));

  const cmds = await pg.evaluate(() => window.__cmds.map((c) => ({ t: c.type, p: c.page })));
  const loadDaVolta = cmds.find((c) => c.t === 'load');
  checar(loadDaVolta && loadDaVolta.p === 2,
    'o `load` da volta JÁ leva a página certa — a capa não é pintada',
    loadDaVolta ? loadDaVolta.p : '(nenhum load)');
  checar(!cmds.some((c) => c.t === 'load' && c.p === 0),
    'REVERSÃO: nenhum load com a página 0 sai na volta',
    JSON.stringify(cmds.filter((c) => c.t === 'load')));
  checar(cmds.filter((c) => c.t === 'page').length === 0,
    'e nenhum comando `page` é preciso depois dele', cmds.filter((c) => c.t === 'page').length);

  // 5-C.2 — O VÍDEO DA PRIMEIRA PÁGINA TOCA AO ABRIR
  //
  // Isto REVOGA a decisão da v1.6.4 (abrir não contava como chegar na página).
  await pg.evaluate(() => stopClear());
  await zerar();
  await pg.evaluate((id) => send(id), ids.deckCapa);
  r = await noAr(ids.vidCapa);
  checar(r === true, 'abrir uma apresentação que começa com vídeo já o projeta', porque(r));
  checar((await estado()).armado === true, 'e a volta fica armada', true);

  // E a volta dele anda: página 0 → 1.
  await pg.evaluate(() => autoAdvance());
  r = await noAr(ids.deckCapa);
  checar(r === true, 'o fim dele devolve a apresentação', porque(r));
  r = await esperar(pg, () => deckPagina === 1, null, 10000);
  checar(r === true, 'na página SEGUINTE, e sem repetir o vídeo da capa', porque(r));

  // ======================================================================
  // 5-D. A CORRIDA: a volta REARMADA por uma cena que já morreu
  //
  // `deckVideoTalvezTocar` arma a volta no `.then` do `send`, e tem de ser
  // depois dele — o `send` a LIMPA na entrada, de propósito, para que um toque
  // do operador desarme a automação. Mas entre o disparo e a resolução há dois
  // `await`: o `getMedia` do vídeo (que não está em lista nenhuma, então a
  // leitura do blob inteiro acontece SEMPRE) e o `persistCurrent`. Nesse vão
  // cabe o toque: o `send` dele zera a volta e o `.then` atrasado a REARMA,
  // com o deck que já saiu de cena.
  //
  // O estrago é do sábado de manhã, e são dois pelo mesmo campo: o fim natural
  // da mídia que o operador escolheu cai em `autoAdvance`, cuja primeira linha
  // é `if (deckVideoVolta) { deckVideoVoltar(); return; }` — a fila NÃO avança
  // e a apresentação antiga volta ao telão sozinha; e `slideTarget()` devolve
  // 'deck', então o ⏭ passa a mexer no deck morto em vez de andar na cena.
  //
  // A CORRIDA É ENCENADA, nunca esperada: o `getMedia` do vídeo fica preso numa
  // trava que este bloco solta quando quer. Sem ela o oráculo mediria qual das
  // duas leituras de IndexedDB ganhou naquela rodada — e o defeito é justamente
  // o desfecho que depende disso.
  // ======================================================================
  await pg.evaluate(() => stopClear());
  await zerar();
  await pg.evaluate((id) => send(id), ids.deck);
  r = await noAr(ids.deck);
  checar(r === true, 'a apresentação no ar para o bloco 5-D', porque(r));

  // A trava pega SÓ o vídeo e SÓ uma vez: `__soltar` fica preenchido depois do
  // primeiro, e as leituras seguintes (as do `outro`, as do coletor) passam
  // direto. `__realGetMedia` é guardado para o bloco 6 receber a função de
  // verdade de volta.
  await pg.evaluate((vid) => {
    const real = AVDB.getMedia.bind(AVDB);
    window.__realGetMedia = real;
    window.__soltar = null;
    AVDB.getMedia = async (id) => {
      const r = await real(id);
      if (id === vid && !window.__soltar) await new Promise((f) => { window.__soltar = f; });
      return r;
    };
  }, ids.vid);

  // Sem `return`: o `send` do vídeo fica pendurado na trava, e devolvê-lo ao
  // Playwright penduraria o `evaluate` junto.
  await pg.evaluate(() => { deckIr(1); });
  r = await esperar(pg, () => !!window.__soltar, null, 10000);
  checar(r === true, 'o `send` do vídeo está preso na leitura do blob', porque(r));

  // O TOQUE DO OPERADOR, no meio da espera.
  await pg.evaluate((id) => send(id), ids.outro);
  r = await noAr(ids.outro);
  checar(r === true, 'o operador projeta outra mídia enquanto o vídeo espera', porque(r));
  const naEntrada = await estado();
  checar(naEntrada.armado === false, 'e o `send` dele desarma a volta', naEntrada.armado);

  await pg.evaluate(() => window.__soltar());
  // O FATO QUE FECHA A JANELA, e não um prazo: o `load` do vídeo é o último
  // passo do `send` (depois dele só há linhas síncronas), e um turno de
  // macrotarefa depois dele o `.then` já rodou — microtarefa drena antes de
  // qualquer `setTimeout`.
  r = await esperar(pg, (vid) => window.__cmds.some((c) => c.type === 'load' && c.mediaId === vid), ids.vid, 10000);
  checar(r === true, 'o `send` atrasado do vídeo chega ao fim', porque(r));
  await pg.evaluate(() => new Promise((f) => setTimeout(f, 0)));

  const tarde = await pg.evaluate(() => ({ armado: !!deckVideoVolta, eixo: slideTarget() }));
  checar(tarde.armado === false,
    'a volta NÃO é rearmada pelo `send` que perdeu a vez', tarde.armado);
  checar(tarde.eixo !== 'deck',
    'e o ⏮/⏭ continua na cena do operador, não no deck morto', tarde.eixo);

  // E A REVERSÃO DA TRAVA: sem toque no meio, a MESMA espera arma a volta. Sem
  // esta metade, um `deckVideoVolta = null` a mais em qualquer lugar passaria
  // pelas duas asserções acima.
  await pg.evaluate(() => stopClear());
  await zerar();
  await pg.evaluate((id) => send(id), ids.deck);
  r = await noAr(ids.deck);
  checar(r === true, 'a apresentação no ar para a reversão do 5-D', porque(r));
  await pg.evaluate((vid) => {
    const real = window.__realGetMedia;
    window.__soltar = null;
    AVDB.getMedia = async (id) => {
      const r = await real(id);
      if (id === vid && !window.__soltar) await new Promise((f) => { window.__soltar = f; });
      return r;
    };
  }, ids.vid);
  await pg.evaluate(() => { deckIr(1); });
  r = await esperar(pg, () => !!window.__soltar, null, 10000);
  checar(r === true, 'o `send` do vídeo está preso outra vez', porque(r));
  await pg.evaluate(() => window.__soltar());
  r = await noAr(ids.vid);
  checar(r === true, 'REVERSÃO: sem toque no meio, o vídeo entra em cena', porque(r));
  r = await esperar(pg, () => !!deckVideoVolta, null, 10000);
  checar(r === true, 'REVERSÃO: e a espera atrasada ARMA a volta', porque(r));

  // O bloco 6 mede o coletor; ele não pode herdar um `getMedia` embrulhado.
  await pg.evaluate(() => { AVDB.getMedia = window.__realGetMedia; });

  // E A CENA SAI DE CIMA DO VÍDEO, porque o bloco 6 mede QUEM O DETÉM. A cena
  // no ar é detentora (`state.current.mediaId`, em `lerDetentores`), então
  // terminar aqui com o vídeo projetado o faria sobreviver à faxina por um
  // motivo que não é o da asserção — MEDIDO, era a única do coletor que
  // reprovava com este bloco na frente.
  await pg.evaluate((id) => send(id), ids.outro);
  r = await noAr(ids.outro);
  checar(r === true, 'a cena volta a ser uma mídia comum, para o bloco 6 medir o detentor certo', porque(r));

  // E O `fixarAvulso` DE CADA `send` É FIRE-AND-FORGET: sem esperá-los pousar,
  // um deles devolve o vídeo à prateleira DEPOIS de o bloco 6 esvaziá-la.
  // `esperarDb`, e não `esperar`: a leitura mora atrás de um `await`, e
  // `waitForFunction` não espera a Promise de um predicado `async`.
  r = await esperarDb(pg, (p) => AVDB.listIds('avulsos').then(
    (l) => l.indexOf(p.vid) >= 0 && l.indexOf(p.outro) >= 0), { vid: ids.vid, outro: ids.outro });
  checar(r === true, 'a prateleira recebeu os dois últimos `send`', porque(r));

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
  await pg.evaluate(async (id) => {
    await AVDB.listRemove('playlist', id);
    await AVDB.listRemove('imports', id);
  }, ids.deck);
  const deckMorto = await pg.evaluate((id) => AVDB.getMedia(id).then((r) => !!r), ids.deck);
  checar(deckMorto === false, 'tirar a apresentação da última lista a coleta', deckMorto);

  await pg.evaluate(() => AVDB.gcOrfaos());
  const vidMorto = await pg.evaluate((id) => AVDB.getMedia(id).then((r) => !!r), ids.vid);
  checar(vidMorto === false,
    'e a faxina seguinte leva o vídeo dela — sem bookkeeping paralelo', vidMorto);

  // ======================================================================
  // 7. O DECK NA MESMA LISTA DOS VÍDEOS — o caso do MODO FÁCIL (v1.8.42)
  //
  // Os blocos acima montam o deck em `imports`, isto é, numa lista DIFERENTE
  // da prateleira de onde os vídeos são removidos — e é por isso que nenhum
  // deles alcançava o defeito. No Modo Fácil `destinoDoShare()` devolve
  // `avulsos`, a MESMA prateleira: o `lerDetentores` pulava a lista inteira de
  // quem estava removendo, o deck não entrava no instantâneo `donos`, e o laço
  // que desce em `rec.videos` nunca o lia. O vídeo era apagado NO INSTANTE em
  // que a apresentação nascia — a página não tocava nada, sem erro, e o
  // operador descobria no culto.
  //
  // A asserção reproduz o percurso do `pptxImportar` verbatim: vídeo em
  // `avulsos`, deck na lista do destino, `listRemove('avulsos', …)`. A
  // REVERSÃO (devolver o `exceptList` ao `lerDetentores`) faz o par abaixo
  // divergir — `avulsos` reprova e `imports` continua passando, que é a
  // assimetria que escondeu o defeito.
  // ======================================================================
  const naLista = async (lista) => pg.evaluate(async (l) => {
    const buf = new ArrayBuffer(64);
    const v = await AVDB.addMedia(new Blob([buf], { type: 'audio/wav' }), {
      name: 'video do bloco 7', type: 'audio/wav', kind: 'video', list: 'avulsos',
    });
    const cv = document.createElement('canvas'); cv.width = 8; cv.height = 8;
    const pag = await new Promise((r) => cv.toBlob(r, 'image/png'));
    await AVDB.addDeck([pag, pag], { name: 'deck do bloco 7', list: l, videos: { 1: v.id } });
    await AVDB.listRemove('avulsos', v.id);   // a linha do `pptxImportar`
    return !!(await AVDB.getMedia(v.id));
  }, lista);

  const vivoFacil = await naLista('avulsos');
  checar(vivoFacil === true,
    'deck na MESMA lista dos vídeos (Modo Fácil): o vídeo sobrevive', vivoFacil);
  const vivoAvancado = await naLista('imports');
  checar(vivoAvancado === true,
    'e na lista de sempre (modo avançado) também — o caminho que já funcionava',
    vivoAvancado);

  // ======================================================================
  // 8. A IMPORTAÇÃO × A PRATELEIRA ROTATIVA — o vídeo apagado ANTES de existir
  //    apresentação que o segurasse
  //
  // O `pptxImportar` estaciona cada vídeo embutido em `avulsos` e só os tira de
  // lá DEPOIS do `addDeck`, e o comentário ao lado promete que a prateleira os
  // PROTEGE nesse vão. Ela não protege: `avulsos` é RODÍZIO de três
  // (`AVULSO_MAX`), e todo `send` passa pelo `fixarAvulso`, que despeja os mais
  // antigos. Os vídeos recém-estacionados são justamente os mais antigos da
  // lista, e ninguém mais os aponta — o `listRemove` do `db.js` apaga o blob
  // quando `isReferenced` não acha outro dono, e o deck que seria esse dono
  // ainda não existe.
  //
  // O desfecho é o da metade 4 por outro caminho: o `addDeck` nasce com
  // `videos[pagina]` apontando para ids que já não existem. Chegar naquela
  // página não projeta nada, sem erro no console — descoberto no culto.
  //
  // A JANELA É ENCENADA pelo `addDeck`, não esperada: o laço de `addMedia`
  // grava dezenas de MB por vídeo, então no aparelho ela dura SEGUNDOS, mas
  // aqui os blobs são de 64 bytes. A trava põe o oráculo exatamente onde o
  // operador estaria.
  //
  // E O `paginasDoPptx` É DUBLADO, não alimentado com um `.pptx` de verdade:
  // este repositório não aceita binário de terceiro, e o que se mede aqui é o
  // ESTACIONAMENTO — quem desenha as páginas tem oráculo próprio
  // (`apresentacao.test.mjs`, `pptxzip.test.mjs`).
  // ======================================================================
  await pg.evaluate(() => stopClear());
  await zerar();

  const importado = await pg.evaluate(async (outroId) => {
    const cv = document.createElement('canvas'); cv.width = 8; cv.height = 8;
    const pag = await new Promise((r) => cv.toBlob(r, 'image/png'));
    const vid = () => new Blob([new ArrayBuffer(64)], { type: 'video/mp4' });

    // TRÊS vídeos é o mínimo que alcança o defeito, e o número sai da conta do
    // `fixarAvulso`: com `lote.length = 1`, `cabem = 2`, e o excedente é tudo o
    // que passa disso — a partir do terceiro estacionado, o primeiro sai.
    const paginas = [pag, pag, pag, pag];
    const videos = [{ pagina: 1, blob: vid() }, { pagina: 2, blob: vid() }, { pagina: 3, blob: vid() }];
    window.AVDeck.paginasDoPptx = async () => ({ pages: paginas, videos, truncado: false });

    // E TRÊS AVULSOS DE ANTES, que é o que faz a segunda metade medir alguma
    // coisa: sem eles a prateleira nem chega ao teto, e "o rodízio continua
    // funcionando" passaria com o rodízio desligado.
    const antigos = [];
    for (let i = 0; i < 3; i++) {
      const r = await AVDB.addMedia(new Blob([new ArrayBuffer(32)], { type: 'audio/wav' }),
        { name: 'avulso antigo ' + i, type: 'audio/wav', kind: 'audio', list: 'avulsos' });
      antigos.push(r.id);
    }

    // A TRAVA, no `addDeck`: os vídeos já estão estacionados e a apresentação
    // ainda não existe — o instante exato do defeito.
    const realDeck = AVDB.addDeck.bind(AVDB);
    window.__soltarDeck = null;
    AVDB.addDeck = async (p, m) => {
      await new Promise((f) => { window.__soltarDeck = f; });
      AVDB.addDeck = realDeck;
      return realDeck(p, m);
    };
    window.__importando = pptxImportar(new Blob(['x']), 'Sermao com tres videos', {});
    return { antigos };
  }, ids.outro);

  r = await esperar(pg, () => !!window.__soltarDeck, null, 20000);
  checar(r === true, 'os três vídeos estão estacionados e a apresentação ainda não existe', porque(r));

  // O TOQUE DO OPERADOR no meio da importação — qualquer mídia serve; o que
  // conta é o `fixarAvulso` que todo `send` faz.
  await pg.evaluate((id) => send(id), ids.outro);
  r = await noAr(ids.outro);
  checar(r === true, 'o operador projeta uma mídia no meio da importação', porque(r));

  // E A ROTAÇÃO PRECISA TER TERMINADO ANTES DE A APRESENTAÇÃO NASCER, senão o
  // oráculo mede qual das duas corridas ganhou — e MEDIDO ele mediu a errada:
  // `send` dispara `fixarAvulso(id)` SEM `await` (a cena não pode esperar por
  // cinco transações de IndexedDB, e o comentário lá diz isso), então soltando
  // a trava logo depois do `noAr` o `addDeck` pousava primeiro, os vídeos já
  // tinham dono e os três sobreviviam — com o defeito inteiro de pé.
  //
  // A chamada direta é a MESMA função que o `send` acima acabou de disparar,
  // agora aguardada: se aquela já terminou, esta é no-op (o `outro` já está na
  // lista e o excedente já saiu); se não, esta a conclui. O percurso do
  // operador continua sendo o `send` — isto é só a barreira.
  await pg.evaluate((id) => fixarAvulso(id), ids.outro);

  const deckNovo = await pg.evaluate(async () => {
    window.__soltarDeck();
    const rec = await window.__importando;
    if (!rec) return null;
    const d = await AVDB.getMedia(rec.id);
    const ids = Object.values((d && d.videos) || {});
    const vivos = [];
    for (const v of ids) if (await AVDB.getMedia(v)) vivos.push(v);
    return { total: ids.length, vivos: vivos.length, avulsos: await AVDB.listIds('avulsos') };
  });
  checar(deckNovo !== null, 'a importação devolveu a apresentação', deckNovo);
  checar(deckNovo && deckNovo.total === 3, 'ela nasce com os três vídeos ligados às páginas',
    deckNovo && deckNovo.total);
  checar(deckNovo && deckNovo.vivos === 3,
    'e os três blobs SOBREVIVEM ao rodízio da prateleira durante a importação',
    deckNovo && deckNovo.vivos + ' de ' + (deckNovo && deckNovo.total));

  // REVERSÃO: o rodízio não pode ter sido DESLIGADO para isso. Três avulsos
  // antigos mais o que o `send` fixou passam do teto, e o mais antigo tem de
  // ter saído — senão a proteção acima seria "nunca despejar nada", e a
  // prateleira viraria a pilha de centenas de MB que o `AVULSO_MAX` existe
  // para não ser.
  const antigoMorto = await pg.evaluate((a) => AVDB.listIds('avulsos').then((l) => !l.includes(a)),
    importado.antigos[0]);
  checar(antigoMorto === true,
    'REVERSÃO: o rodízio continua despejando o avulso mais antigo', antigoMorto);
  checar(deckNovo && deckNovo.avulsos.length <= 3,
    'e a prateleira volta ao teto de três depois da importação',
    deckNovo && deckNovo.avulsos.length);

  checar(erros.length === 0, 'nenhum erro de console no percurso', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}
console.log('::endgroup::');
process.exit(falhas.length ? 1 : 0);
