// A REPETIÇÃO DIZ O QUE ACONTECE NO FIM DA FILA — E A FILA ANDA SEM ELA (v1.8.77).
//
// ## O relato
//
// *"Quando tocamos uma playlist automática, ajuste o sistema de repetição para
// que ele toque a playlist em sequência, caso o seletor não esteja ativado…
// Hoje é normal o seletor estar desativado, tocar uma playlist automática, mas
// ele tocar apenas a primeira e parar, pois o usuário esquece de ativar o
// automático."* · *"Da mesma forma, ao se tocar um item, seja do cronograma ou
// o que for, resete o estado do seletor de repetição, para ele não repetir uma
// mídia que não era intenção repetir e nem tocar a próxima mídia automática."*
//
// ## São DOIS defeitos, e eles são um o avesso do outro
//
//  1. **`off` PARAVA A FILA.** Ele era o primeiro `return` do `autoAdvance`, e
//     com isso a única forma de ouvir uma sequência era armar `all` — que é
//     outra coisa, porque aquele RECOMEÇA no fim. Quem monta uma playlist já
//     disse o que quer ao montá-la.
//  2. **E O MODO VAZAVA DE UMA MÍDIA PARA A SEGUINTE.** `replacePlaylistWith`
//     derrubava só o `repeat='one'`, sob o argumento de que `all`/`shuffle`
//     "são comportamentos da FILA". MEDIDO, o argumento não se sustenta no caso
//     dominante: aquela função deixa a fila com UM item, e sobre uma fila de um
//     os dois VIRAM `one` — `all` faz `(0 + 1) % 1 === 0` e o `shuffle` tem o
//     ramo `length === 1`. A mídia recém-escolhida tocava em laço, que é
//     literalmente o defeito que a queda do `one` existia para evitar.
//
// ## O que este arquivo mede que os irmãos não medem
//
// O `sorteio-tela.test.mjs` mede o mesmo par pelo caminho do OPERADOR (a folha
// da playlist automática, com acervo semeado). Aqui as regras são medidas uma a
// uma sobre o `autoAdvance` — o ponto único por onde o `media-ended` do telão e
// o `onEnded` da preview passam —, inclusive as duas que só aparecem nas
// BORDAS: o fim da fila (que PARA, e não recomeça) e a cena que veio de fora
// dela (que não tem "próximo", e por isso também para).
//
// E a última metade é a que impede o conserto largo demais: tocar numa linha da
// FILA não redefine sequência nenhuma, e ali o modo TEM de sobreviver.
//
//   node tools/repeticao-e-sequencia.test.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperar, esperarCortina, porque, checar, falhas } from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);

// WAV de 20 s: uma faixa que acabe sozinha no meio do arquivo dispararia o
// `onEnded` da preview e avançaria a fila por baixo das asserções — que é
// justamente o que se está medindo, e mediria o relógio do runner.
const SEMEAR = `
  const sr = 8000, secs = 20, n = sr * secs;
  const wav = () => {
    const buf = new ArrayBuffer(44 + n * 2), dv = new DataView(buf);
    const wr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    wr(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); wr(8, 'WAVEfmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true);
    dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
    wr(36, 'data'); dv.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, Math.sin(i / 20) * 3000, true);
    return new Blob([buf], { type: 'audio/wav' });
  };
  const um = await AVDB.addMedia(wav(), { name: 'Louvor UM', type: 'audio/wav', kind: 'audio', list: 'imports' });
  const dois = await AVDB.addMedia(wav(), { name: 'Louvor DOIS', type: 'audio/wav', kind: 'audio', list: 'imports' });
  const tres = await AVDB.addMedia(wav(), { name: 'Louvor TRES', type: 'audio/wav', kind: 'audio', list: 'imports' });
  const fora = await AVDB.addMedia(wav(), { name: 'Louvor DE FORA', type: 'audio/wav', kind: 'audio', list: 'imports' });
`;

await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await navegador.newContext();
await semRedeExterna(ctx);
const pg = await ctx.newPage();
const erros = [];
pg.on('pageerror', (e) => erros.push(e.message));

try {
  await pg.goto(base + '/controle/', { waitUntil: 'load' });
  await pg.waitForFunction(
    () => window.AVDB && typeof window.__avBack === 'function'
      && (!!document.querySelector('#playlist li') || document.getElementById('plBtn').disabled),
    null, { timeout: 25000 },
  );
  await esperarCortina(pg);
  const ids = await pg.evaluate(new Function('return (async () => {'
    + 'setAppMode("full");' + SEMEAR
    + 'await load(); return { um: um.id, dois: dois.id, tres: tres.id, fora: fora.id }; })()'));

  // A fila do player: as TRÊS, nesta ordem. O "DE FORA" fica só no Cronograma —
  // é ele que exercita a borda do `idx === -1`.
  const armar = async (modo) => pg.evaluate(async ([lista, m]) => {
    stopClear();
    await AVDB.setState('repeat', m);
    repeat = m; renderRepeat();
    await AVDB.listSet('playlist', lista);
    plItems = await AVDB.listItems('playlist');
    renderPlaylist();
  }, [[ids.um, ids.dois, ids.tres], modo]);

  const projetar = async (id) => {
    await pg.evaluate((i) => send(i), id);
    await esperar(pg, (i) => currentId === i && midiaNoAr, id, 10000);
  };
  const estado = () => pg.evaluate(async () => ({
    atual: currentId, noAr: !!midiaNoAr, modo: repeat,
    guardado: (await AVDB.getState('repeat')) || 'off',
    fila: plItems.map((m) => m.id),
  }));

  // ══════════════════════════════════════════════════════════════════════
  // 1 · COM O SELETOR EM `off`, A FILA ANDA
  //
  // É o relato inteiro numa asserção. A REVERSÃO reprova aqui: com o `return`
  // seco de antes, o fim da primeira faixa era fim de cena e `currentId` ficava
  // no "UM" — o culto parando na primeira música.
  // ══════════════════════════════════════════════════════════════════════
  await armar('off');
  await projetar(ids.um);
  await pg.evaluate(() => autoAdvance());
  let r = await esperar(pg, (i) => currentId === i, ids.dois, 10000);
  let e = await estado();
  checar(e.atual === ids.dois,
    '1 · com o seletor em `off`, o fim de uma faixa projeta a SEGUINTE da fila — '
    + 'era aqui que o culto parava, porque o operador esquecia de armar o `all`',
    porque(r) || e.atual);

  // ══════════════════════════════════════════════════════════════════════
  // 2 · E O FIM DA FILA PARA — é a diferença INTEIRA para o `all`
  //
  // Sem esta asserção, "arme `all` sozinho quando a fila for montada" passaria
  // no bloco 1 e devolveria à congregação o primeiro louvor tocando de novo
  // depois do último, que ninguém pediu.
  // ══════════════════════════════════════════════════════════════════════
  await projetar(ids.tres);
  await pg.evaluate(() => autoAdvance());
  r = await esperar(pg, () => !midiaNoAr, null, 10000);
  e = await estado();
  checar(e.atual === ids.tres && e.noAr === false,
    '2 · a última da fila ACABA a cena, e não recomeça pelo primeiro item — '
    + '`off` avança, `all` é que dá a volta', porque(r) || JSON.stringify(e));

  // ══════════════════════════════════════════════════════════════════════
  // 3 · UMA CENA DE FORA DA FILA NÃO PUXA A FILA
  //
  // O `all` começa do topo quando não acha o item (`idx === -1`); o `off` não
  // pode, e a diferença é o que a congregação vê: um share projetado na hora ou
  // um item da prateleira `avulsos` terminaria abrindo um bloco de louvores que
  // ninguém mandou tocar.
  // ══════════════════════════════════════════════════════════════════════
  await projetar(ids.fora);
  await pg.evaluate(() => autoAdvance());
  r = await esperar(pg, () => !midiaNoAr, null, 10000);
  e = await estado();
  checar(e.atual === ids.fora && e.noAr === false,
    '3 · uma cena que não está na fila não tem "próximo": ela acaba ali, sem '
    + 'abrir a fila pelo primeiro item', porque(r) || JSON.stringify(e));

  // ══════════════════════════════════════════════════════════════════════
  // 4 · TOCAR UM ITEM ZERA O SELETOR — e o cenário é `shuffle`, de propósito
  //
  // Com `one` a asserção seria TAUTOLOGIA: aquele já caía desde a v5.x. Quem
  // reprova a versão anterior é `all`/`shuffle`, que ficavam — e que sobre a
  // fila de UM item que esta porta acabou de criar são o `one` por outro nome.
  // ══════════════════════════════════════════════════════════════════════
  await armar('shuffle');
  await pg.evaluate(async (id) => {
    const rec = await AVDB.getMedia(id);
    await onTap(rec);
  }, ids.um);
  r = await esperar(pg, (i) => currentId === i && midiaNoAr, ids.um, 10000);
  e = await estado();
  checar(e.modo === 'off' && e.guardado === 'off',
    '4 · tocar um item do Cronograma devolve o seletor a `off` — o modo é uma '
    + 'escolha sobre a mídia ANTERIOR, e herdá-lo é o resquício do relato',
    porque(r) || JSON.stringify(e));
  checar(e.fila.length === 1 && e.fila[0] === ids.um,
    '4 · (premissa) e a fila passou a ser SÓ ele — é sobre essa fila de um que '
    + '`all` e `shuffle` viravam `one`', JSON.stringify(e.fila));
  // E A CONSEQUÊNCIA, que é o que o operador vê: o fim dele NÃO o repõe no ar.
  await pg.evaluate(() => autoAdvance());
  r = await esperar(pg, () => !midiaNoAr, null, 10000);
  e = await estado();
  checar(e.atual === ids.um && e.noAr === false,
    '4 · e o fim dele encerra a cena em vez de repeti-lo em laço', porque(r) || JSON.stringify(e));

  // ══════════════════════════════════════════════════════════════════════
  // 5 · MAS TOCAR NUMA LINHA DA FILA **NÃO** ZERA — o limite da regra
  //
  // Escolher por onde começar não desfaz a sequência: aquele toque não passa
  // por `trocarFila` (a linha da fila chama `send` direto), e uma "correção"
  // que zerasse ali tiraria do operador a única forma de armar `all`/`shuffle`
  // e depois escolher a faixa de entrada.
  // ══════════════════════════════════════════════════════════════════════
  await armar('all');
  await projetar(ids.um);
  const clicou = await pg.evaluate((id) => {
    openPlPopup();
    const li = document.querySelector('#playlist li[data-id="' + id + '"]');
    if (!li) return 'a linha da fila não foi desenhada';
    li.querySelector('.row').click();
    return '';
  }, ids.dois);
  checar(clicou === '', '5 · (premissa) a linha da fila é alcançável pelo toque', clicou);
  r = await esperar(pg, (i) => currentId === i, ids.dois, 10000);
  e = await estado();
  checar(e.atual === ids.dois && e.modo === 'all' && e.fila.length === 3,
    '5 · tocar numa linha da FILA mantém o modo e a sequência — só REDEFINIR a '
    + 'fila é que zera', porque(r) || JSON.stringify(e));
  await pg.evaluate(() => closePlPopup());

  // ══════════════════════════════════════════════════════════════════════
  // 6 · O MODO FÁCIL É O CASO EXTREMO: lá não há transporte na tela
  //
  // O share projeta SEM redefinir a fila (`focarImportado`), e `body.mode-simple`
  // esconde a caixa de controles inteira: um `one` herdado do modo avançado
  // prenderia o que acabou de chegar em laço sem nenhuma superfície por onde
  // desfazê-lo.
  // ══════════════════════════════════════════════════════════════════════
  await armar('one');
  await pg.evaluate(async (id) => {
    setAppMode('simple');
    await focarImportado(id);
  }, ids.fora);
  r = await esperar(pg, (i) => currentId === i, ids.fora, 10000);
  e = await estado();
  checar(e.modo === 'off' && e.guardado === 'off' && e.atual === ids.fora,
    '6 · o compartilhamento no Modo Fácil projeta com o seletor zerado',
    porque(r) || JSON.stringify(e));
  const escondido = await pg.evaluate(() =>
    getComputedStyle(document.querySelector('.bottombar')).display);
  checar(escondido === 'none',
    '6 · (premissa) e é por isso que ele importa: no Modo Fácil a caixa de '
    + 'controles — onde o seletor mora — não é desenhada', escondido);
  await pg.evaluate(() => setAppMode('full'));

  // ══════════════════════════════════════════════════════════════════════
  // 7 · A ORDEM DO CICLO E O DESENHO DE CADA DEGRAU (v1.8.80)
  //
  // Pedido do operador: *"ajuste a ordem das opções do botão de repetir mídia,
  // para que ele mostre primeiro repetir a midia atual e depois o repetir a
  // playlist inteira. Inclusive, altere o icone dessas funções. O icone de
  // repetir a midia atual deve ser o icone de repetir comum, sem adições. O
  // icone de repetir a playlist, deve ter o mesmo design de repetir, mas deve
  // ter algo que ilustre o objeto 'lista' de sua função"*.
  //
  // O CICLO É PERCORRIDO PELO TOQUE, nunca lendo `REPEATS`: a constante
  // concordar consigo mesma não prova nada — o que o operador percorre é o
  // botão. E o DESENHO é lido do `<use>`, que é o que o `renderRepeat` escreve;
  // o `glifos.test.mjs` é quem garante, do outro lado, que cada nome desses tem
  // um `<symbol>` no sprite (sem ele o botão fica tocável e VAZIO).
  // ══════════════════════════════════════════════════════════════════════
  await pg.evaluate(async () => { await AVDB.setState('repeat', 'off'); repeat = 'off'; renderRepeat(); });
  const ciclo = await pg.evaluate(() => {
    const b = document.getElementById('repeat');
    const passo = () => ({
      modo: repeat,
      ico: (b.querySelector('use') || {}).getAttribute
        ? b.querySelector('use').getAttribute('href') : '',
      aceso: b.classList.contains('active'),
      titulo: b.title,
      svg: (() => { const r = b.querySelector('svg').getBoundingClientRect(); return { w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; })(),
    });
    const voltas = [passo()];
    for (let i = 0; i < 4; i++) { b.click(); voltas.push(passo()); }
    return voltas;
  });
  const ordem = ciclo.map((p) => p.modo).join(' → ');
  checar(ordem === 'off → one → all → shuffle → off',
    '7 · o ciclo do botão é off → REPETIR ESTA MÍDIA → repetir a playlist → '
    + 'aleatório: o degrau mais pedido vem primeiro, e os dois primeiros toques '
    + 'vão do mais restrito ao mais amplo', ordem);
  const desenhos = ciclo.slice(0, 4).map((p) => p.modo + '=' + p.ico).join(' · ');
  checar(ciclo[1].ico === '#icoRepetir' && ciclo[2].ico === '#icoRepetirLista'
    && ciclo[3].ico === '#icoAleatorio',
    '7 · "repetir esta mídia" usa o laço PURO e "repetir a playlist" usa o mesmo '
    + 'laço COM a lista — a diferença é a adição, que é o que o pedido descreve',
    desenhos);
  checar(ciclo[0].ico === ciclo[1].ico && ciclo[0].aceso === false && ciclo[1].aceso === true,
    '7 · `off` divide o desenho com `one`, e o que os separa é a SUPERFÍCIE — '
    + 'sem o aceso, "repetir esta mídia" seria indistinguível de "sem repetição"',
    JSON.stringify({ off: ciclo[0], one: ciclo[1] }));
  const semCaixa = ciclo.filter((p) => p.svg.w < 10 || p.svg.h < 10);
  checar(semCaixa.length === 0,
    '7 · e o desenho tem caixa em todo degrau: um `<svg>` sem regra de escala '
    + 'nasce em 300×150 ou em nada, e nos dois casos o botão mente', semCaixa);
  const semTitulo = ciclo.filter((p) => !p.titulo || /repetir 1/i.test(p.titulo));
  checar(semTitulo.length === 0,
    '7 · e o rótulo de cada degrau usa as palavras do operador — "Repetir 1" era '
    + 'a abreviação do glifo `repeat_one`, e o glifo saiu',
    semTitulo.map((p) => p.modo + ': ' + p.titulo));
  await pg.evaluate(async () => { await AVDB.setState('repeat', 'off'); repeat = 'off'; renderRepeat(); });

  checar(erros.length === 0, 'nenhum erro de página durante o percurso', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) {
  console.log('\n' + falhas.length + ' falha(s).');
  process.exit(1);
}
console.log('\nTodos passaram.');
