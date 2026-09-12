#!/usr/bin/env node
// ============================================================================
// UM BOTÃO SEM FUNÇÃO FICA APAGADO — e o eixo de slide exige CENA
//
// ## Os dois relatos que ele trava
//
//  1. *"enquanto uma música está em stop, os botões de anterior e próximo slide
//     ficam ativos (isso está errado), e interagir com eles faz com que a
//     próxima música pule slides já na sua abertura como se os toques anteriores
//     fossem para ela"*.
//  2. *"verifique botões que deveriam ter sua função inativa ao toque em
//     situações em que ele não deveria ser usado. Como é o caso de uma playlist
//     vazia… o botão de stop se não tem nada em play e etc… Isso evita bugs por
//     tentar fazer algo que não seria possível"*.
//
// ## O defeito do primeiro, e por que ele é sutil
//
// `slideTarget()` decidia o eixo por `currentItem` — e o `currentItem`
// **sobrevive ao stop de propósito**: é ele que faz o ▶ repetir a faixa. Parado,
// o item continuava sendo o último tocado, o par de botões continuava aceso, e
// cada toque emitia um `seek` para um palco VAZIO. A pergunta certa já existe no
// app e é `midiaNoAr` — a bandeira que o `send` acende e o stop apaga.
//
// O SINTOMA que o operador viu é a JUSANTE disso (a estrofe da faixa seguinte
// abrindo adiantada, pelos `seek` acumulados); este oráculo corta na NASCENTE,
// que é o único ponto em que a correção pode ser afirmada sem depender de
// quantos toques houve nem de qual faixa entrou depois.
//
// ## O que ele mede, e por que a terceira metade existe
//
//  1. **APAGADO SEM FILA E SEM CENA.** ⏮/⏭ do transporte com a playlist vazia,
//     ⏹ sem nada no ar — os três já eram INERTES, e inerte não é apagado: um
//     botão aceso que não faz nada é indistinguível de um quebrado.
//  2. **SEM CENA NÃO HÁ EIXO.** Parado, `slideTarget()` é `null`, os dois botões
//     de slide ficam `disabled`, e `stepSlide()` não emite comando NENHUM.
//  3. **PAUSADO CONTINUA VALENDO.** É a REGRESSÃO que a régua errada produz:
//     escrita como `playing`, ela mataria o caso mais comum do culto — o louvor
//     PAUSADO para a oração, com a letra na tela e o operador passando estrofe.
//  4. **O ▶ E O PARAR NÃO SÃO APAGADOS JUNTO.** O ▶ fica aceso com a mídia
//     parada (é `currentId` que faz ele repetir a faixa), e o ⏹ volta a acender
//     assim que há cena. Sem esta metade, "apagar o que não faz nada" levaria
//     dois recursos junto.
//  5. **SEM FILA, SÓ O ⏮ SOBRA — e ele RECOMEÇA** (v1.8.51). Relato do
//     operador: *"o botão de proxima midia quando não há uma lista na
//     playlist… nesse caso apenas o botão de midia anterior fica ativo, pois
//     ele volta ao início da midia atual"*. A régua é o `transportePode`, lido
//     pelos DOIS lados (o que apaga e o que executa), e o recomeço é um `seek`
//     e não um `send` — aquele reabriria a cena e, num item de LINK do YouTube,
//     dispararia a resolução de novo.
//  6. **COM FILA, NADA MUDA — nem com UM item.** É a REGRESSÃO que a régua
//     larga produz: apagar o par com um item só tiraria o único caminho de
//     INICIAR uma fila pelo transporte (o `idx === -1` do `step` cai no
//     primeiro). O pedido fala da fila VAZIA, e é só ela que muda.
//  8. **A REPETIÇÃO APAGA SEM FILA E SEM MÍDIA ESCOLHIDA** (v1.8.87), o que
//     REVOGA a outra exceção da v1.8.50 (*"ela é um modo, e escolher o modo
//     antes de montar a fila é o caminho normal"*). Relato do operador: *"ele
//     não está sendo desativado quando não há nada selecionado"*. A régua é
//     `plItems.length || currentId`, e a segunda metade é a que carrega o
//     bloco: escrita como `midiaNoAr`, ela apagaria o botão sobre a faixa
//     PARADA — e armar `repeat: one` ali, para o próximo ▶ repeti-la, é uso
//     legítimo.
//  7. **O BOTÃO DA FILA APAGA COM ELA VAZIA** (v1.8.51), o que REVOGA a exceção
//     escrita no item 4 da v1.8.50. Ele apaga só com ZERO: com um item a folha
//     ainda é a única porta para remover, favoritar, mandar ao Cronograma,
//     limpar e empacotar — e um item é o estado que todo toque numa mídia
//     produz. O limiar NÃO é o da badge (que some com `> 1`), e as duas
//     perguntas ficam separadas de propósito.
//
//   node tools/transporte-sem-cena.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperarCortina, esperar, porque, checar, falhas } from './arnes.mjs';

// Duas faixas de 20 s COM LETRA: a fila precisa ter dois itens para os ⏮/⏭
// valerem, e a letra é o que dá eixo de slide ao par ao lado da preview.
const SEMEAR = `
  const wav = (secs) => {
    const sr = 8000, n = sr * secs;
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
  const letra = [{ time: 0, cover: true }, { time: 4, text: 'primeira' },
    { time: 9, text: 'segunda' }, { time: 14, text: 'terceira' }];
  for (const id of ['hino-um', 'hino-dois']) {
    const caminho = 'folders/teste/' + id + '.wav';
    await AVDB.opfsWriteFile(caminho, wav(20));
    await AVDB.fileAdd({
      id, folder: 'teste', opfsPath: caminho, srcName: id,
      name: id.toUpperCase(), type: 'audio/wav', kind: 'audio', size: 1, mtime: 1,
      thumb: null, blob: null, url: null, addedAt: 1, lyrics: letra,
    });
  }
`;

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);

await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);
const pg = await ctx.newPage();

// O ESTADO DOS BOTÕES é lido do DOM, não da regra: `disabled` é o que o
// navegador usa para engolir o toque, e `.t-btn:disabled` é o que o operador vê.
const botoes = () => pg.evaluate(() => {
  const q = (id) => document.getElementById(id);
  const ler = (id) => ({ off: !!q(id).disabled, title: q(id).title });
  return {
    prev: ler('prev'), next: ler('next'), stop: ler('stop'), play: ler('playpause'),
    slidePrev: ler('slidePrevBtn'), slideNext: ler('slideNextBtn'),
    pl: ler('plBtn'), plBadge: (document.getElementById('plCount').textContent || ''),
    rep: ler('repeat'), modo: repeat,
    fila: plItems.length,
    alvo: slideTarget(), midia: !!midiaNoAr, id: currentId || '',
  };
});

// O QUE SAI NO BARRAMENTO quando o par de slide é acionado. `stepSlide` é o
// handler dos dois botões — chamá-lo direto prova a guarda mesmo para quem
// chegar por outra porta (a notificação de mídia aciona os botões por `.click()`).
const oQueSai = (delta) => pg.evaluate((d) => {
  const vistos = [];
  const original = window.cmd;
  window.cmd = (c) => { vistos.push(c.type); };
  try { stepSlide(d); } finally { window.cmd = original; }
  return vistos;
}, delta);

try {
  await pg.goto(base + '/controle/', { waitUntil: 'load' });
  await pg.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function', null, { timeout: 30000 });
  await esperarCortina(pg);
  await pg.evaluate(new Function('return (async () => { setAppMode("full");' + SEMEAR + 'await load(); })()'));

  // ── 1. NADA NA FILA, NADA NO AR ─────────────────────────────────────────
  const frio = await botoes();
  checar(frio.prev.off === true && frio.next.off === true,
    'PLAYLIST VAZIA apaga os ⏮/⏭ do transporte — eles já voltavam na primeira '
    + 'linha do `step()`, e inerte não é a mesma coisa que apagado', frio);
  checar(/fila est[áa] vazia/i.test(frio.next.title),
    'e o `title` diz POR QUÊ: é o que um botão apagado deve a quem o encontra',
    frio.next.title);
  checar(frio.stop.off === true && /nada no ar/i.test(frio.stop.title),
    'e o PARAR sem nada no ar também', frio.stop);
  // A REPETIÇÃO (v1.8.87): este é o instante EXATO do relato — nada na fila,
  // nada escolhido, e o botão ciclando quatro degraus sem efeito nenhum.
  checar(frio.rep.off === true && /nada para repetir|n[ãa]o h[áa] o que repetir/i.test(frio.rep.title),
    'SEM FILA E SEM MÍDIA ESCOLHIDA a repetição apaga, e o `title` diz por quê '
    + '— o modo governa o `autoAdvance`, e sem nada que ACABE ele não roda',
    frio.rep);
  checar(frio.slidePrev.off === true && frio.slideNext.off === true && frio.alvo === null,
    'sem cena não há eixo de slide, e o par ao lado da preview nasce apagado', frio);

  // ── 2. O LOUVOR ENTRA ───────────────────────────────────────────────────
  await pg.evaluate(async () => {
    await AVDB.listAdd('playlist', 'hino-um');
    await AVDB.listAdd('playlist', 'hino-dois');
    await load();
    await send('hino-um');
  });
  const tocando = await esperar(pg, () => !!midiaNoAr && !document.getElementById('pvVideo').paused,
    null, 8000);
  checar(tocando === true, 'o louvor entra em cena e toca', porque(tocando));

  const noAr = await botoes();
  checar(noAr.prev.off === false && noAr.next.off === false && noAr.stop.off === false,
    'COM FILA E COM CENA os três acendem — o apagado é estado, não decoração', noAr);
  checar(noAr.alvo === 'lyrics' && noAr.slideNext.off === false,
    'e o eixo de slide é a LETRA, com para onde ir', noAr);
  const saiuTocando = await oQueSai(1);
  checar(saiuTocando.includes('seek'),
    'passar estrofe com a mídia no ar emite o `seek` de sempre', saiuTocando);

  // ── 3. PAUSADO CONTINUA VALENDO ─────────────────────────────────────────
  // A régua escrita como `playing` mataria o caso mais comum do culto: o louvor
  // pausado para a oração segue EM CENA, com a letra na tela.
  await pg.evaluate(() => { cmd({ type: 'pause' }); renderSlideNav(); });
  const pausado = await botoes();
  checar(pausado.midia === true && pausado.alvo === 'lyrics' && pausado.slideNext.off === false,
    'PAUSADO NÃO É PARADO: `midiaNoAr` é "carregada", não "tocando" — a letra '
    + 'continua na tela e passar estrofe ali é o que o operador faz', pausado);
  const saiuPausado = await oQueSai(1);
  checar(saiuPausado.includes('seek'),
    'e o comando sai igual com a mídia pausada', saiuPausado);

  // ── 4. O STOP TIRA O EIXO ───────────────────────────────────────────────
  await pg.evaluate(() => stopClear());
  await esperar(pg, () => midiaNoAr === false, null, 5000);
  const parado = await botoes();
  checar(parado.midia === false && parado.id === 'hino-um',
    'o stop apaga `midiaNoAr` e MANTÉM o `currentId` — é esse par que o defeito '
    + 'confundia', parado);
  checar(parado.alvo === null && parado.slidePrev.off === true && parado.slideNext.off === true,
    'PARADO NÃO TEM EIXO: os dois botões de slide ficam apagados, em vez de '
    + 'aceitarem toques para um palco vazio', parado);
  const saiuParado = await oQueSai(1);
  checar(saiuParado.length === 0,
    'e NENHUM comando sai por eles — é aqui que os `seek` se acumulavam e '
    + 'reapareciam na abertura da faixa seguinte', saiuParado);

  // ── 5. O QUE NÃO FOI APAGADO JUNTO ──────────────────────────────────────
  checar(parado.play.off === false,
    'o ▶ FICA ACESO com a mídia parada: `currentId` sobrevive ao stop de '
    + 'propósito, e é ele que faz o ▶ repetir a faixa — apagá-lo tiraria um '
    + 'recurso', parado.play);
  checar(parado.prev.off === false && parado.next.off === false,
    'e os ⏮/⏭ do transporte também: a fila continua cheia, e trocar de mídia '
    + 'com o palco vazio é o caminho normal', parado);
  // A REPETIÇÃO com a mídia parada. **ESTA CÉLULA NÃO ALCANÇA A RÉGUA**, e está
  // dito porque parece que sim: aqui a FILA tem dois itens, e ela sozinha já
  // acende o botão — MEDIDO na reversão, escrever a régua como `midiaNoAr` em
  // vez de `currentId` passa por esta linha sem reprovar. Quem a alcança é o
  // bloco 7, onde a fila está VAZIA e a faixa parada é a única coisa que sobra.
  checar(parado.rep.off === false,
    'e a REPETIÇÃO fica acesa com a mídia PARADA (aqui pela FILA — ver o '
    + 'bloco 7 para a metade que a régua de fato decide)',
    { rep: parado.rep, midia: parado.midia, id: parado.id, fila: parado.fila });
  checar(parado.stop.off === true,
    'o PARAR volta a apagar — e a pergunta é `cenaDeRoteiroNoAr()`, não '
    + '`cenaNoAr()`: esta começa por `!!currentId`, que sobrevive ao stop, e '
    + 'deixaria o botão aceso para sempre depois da primeira mídia do dia',
    parado.stop);

  // ── 6. SEM FILA, SÓ O ⏮ SOBRA — E ELE RECOMEÇA (v1.8.51) ────────────────
  // Relato do operador: *"o botão de proxima midia quando não há uma lista na
  // playlist… nesse caso apenas o botão de midia anterior fica ativo, pois ele
  // volta ao início da midia atual"*.
  await pg.evaluate(async () => {
    await AVDB.listSet('playlist', []);
    await load();
    await send('hino-um');
  });
  await esperar(pg, () => plItems.length === 0 && !!midiaNoAr, null, 8000);
  const semFila = await botoes();
  checar(semFila.fila === 0 && semFila.midia === true,
    'o cenário: a fila esvaziou e a mídia continua no ar', semFila);
  checar(semFila.next.off === true && /pr[óo]xima m[íi]dia/i.test(semFila.next.title),
    'SEM FILA o ⏭ APAGA: não há para onde ir, e o `title` diz isso', semFila.next);
  checar(semFila.prev.off === false && /recome[çc]ar/i.test(semFila.prev.title),
    'e o ⏮ FICA ACESO, prometendo o que ele de fato faz ali: RECOMEÇAR — é a '
    + 'única coisa que "mídia anterior" pode significar sem anterior nenhuma',
    semFila.prev);
  // O QUE SAI NO BARRAMENTO: um `seek` e nada mais. Um `send` reabriria a cena
  // e, num item de LINK do YouTube, dispararia a resolução de novo.
  const doRecomeco = await pg.evaluate(() => {
    const vistos = [];
    const original = window.cmd;
    window.cmd = (c) => { vistos.push(c); };
    try { step(-1); } finally { window.cmd = original; }
    return vistos;
  });
  checar(doRecomeco.length === 1 && doRecomeco[0].type === 'seek' && doRecomeco[0].time === 0,
    'e o recomeço é um `seek` para 0 — não um `send`, que reabriria a cena '
    + 'inteira e resolveria um link do YouTube de novo', JSON.stringify(doRecomeco));
  const doNext = await pg.evaluate(() => {
    const vistos = [];
    const original = window.cmd;
    window.cmd = (c) => { vistos.push(c.type); };
    try { step(1); } finally { window.cmd = original; }
    return vistos;
  });
  checar(doNext.length === 0,
    'e o ⏭ não emite NADA nem chamado por outra porta: a régua que apaga é a '
    + 'MESMA que o `step` executa', JSON.stringify(doNext));

  // ── 7. SEM FILA E SEM CENA, OS DOIS APAGAM ──────────────────────────────
  await pg.evaluate(() => stopClear());
  await esperar(pg, () => midiaNoAr === false, null, 5000);
  const nada = await botoes();
  checar(nada.prev.off === true && nada.next.off === true,
    'sem fila E sem cena os DOIS apagam — não há mídia para recomeçar', nada);
  // ===== A CÉLULA QUE DECIDE A RÉGUA DA REPETIÇÃO (v1.8.87) =====
  //
  // Fila VAZIA, `midiaNoAr` FALSO, `currentId` de pé: é o único ponto do
  // arquivo em que as duas escritas possíveis divergem. Escrita como
  // `midiaNoAr`, a régua apagaria o botão aqui — e armar `repeat: one` sobre a
  // faixa parada, para que o próximo ▶ a repita em laço, é uso legítimo (é o
  // mesmo `currentId` que mantém o ▶ aceso, duas linhas acima).
  //
  // MEDIDO por reversão: a asserção do bloco 4 passa nas duas escritas, porque
  // lá a fila tem dois itens e ela sozinha acende o botão.
  checar(nada.fila === 0 && nada.midia === false && nada.id !== '',
    'A PREMISSA da célula: fila vazia, nada no ar, e a faixa parada ainda '
    + 'escolhida', nada);
  checar(nada.rep.off === false,
    'e a REPETIÇÃO fica ACESA aí: a régua é `currentId`, não `midiaNoAr` — '
    + 'armar o modo sobre a faixa parada é o que faz o próximo ▶ repeti-la',
    nada.rep);

  // ── 8. COM UM ITEM, NADA MUDA ───────────────────────────────────────────
  // É a REGRESSÃO que a régua larga produz: apagar o par com um item só tiraria
  // o único caminho de INICIAR a fila pelo transporte (o `idx === -1` do `step`
  // cai no primeiro item). O pedido fala da fila VAZIA.
  await pg.evaluate(async () => {
    await AVDB.listSet('playlist', ['hino-um']);
    await load();
    renderSlideNav();
  });
  const umSo = await botoes();
  checar(umSo.rep.off === false,
    'e a REPETIÇÃO acende pela FILA sozinha — a outra metade da régua', umSo.rep);
  checar(umSo.fila === 1 && umSo.prev.off === false && umSo.next.off === false,
    'COM UM ITEM os dois seguem ACESOS: com a fila parada eles a INICIAM, e '
    + 'apagá-los tiraria o único caminho de começar uma fila pelo transporte',
    umSo);

  // ── 9. O BOTÃO DA FILA APAGA SÓ COM ELA VAZIA (v1.8.51) ─────────────────
  // Relato do operador: *"o botão de playlist segue ativo nos controles, mesmo
  // quando não há nenhum item na playlist"*. Revoga a exceção da v1.8.50.
  checar(umSo.pl.off === false,
    'COM UM ITEM o botão da fila fica ACESO: a folha ainda é a única porta para '
    + 'remover, favoritar, mandar ao Cronograma, limpar e empacotar — e um item '
    + 'é o estado que todo toque numa mídia produz', umSo.pl);
  await pg.evaluate(async () => { await AVDB.listSet('playlist', []); await load(); });
  await esperar(pg, () => plItems.length === 0, null, 5000);
  const semNada = await botoes();
  checar(semNada.pl.off === true && /vazia/i.test(semNada.pl.title),
    'e com ela VAZIA ele apaga, com o `title` dizendo como se monta uma fila — '
    + 'a frase de ensino morava na folha, e ninguém mais a abriria para lê-la',
    semNada.pl);
  // O LIMIAR DO BOTÃO NÃO É O DA BADGE, e a separação é deliberada: ela some
  // com `> 1` (um item não merece contagem), ele apaga com `=== 0`.
  checar(semNada.plBadge === '' && umSo.plBadge === '',
    'e a badge segue muda nos dois estados — o limiar dela (`> 1`) é OUTRO, e '
    + 'amarrá-los faria uma pergunta responder pela outra',
    JSON.stringify({ zero: semNada.plBadge, um: umSo.plBadge }));
  // ===== E COM DOIS ITENS ELA DIZ **2** (v1.8.80) =====
  //
  // Revogação do operador: *"o número no botão da playlist está indicando '1'
  // quando há duas mídias na playlist. Isso foi uma decisão antiga, estou
  // revogando ela, esse número deve representar o número total de itens"*.
  //
  // A régua antiga contava os itens ALÉM do primeiro (`count - 1`), e o selo
  // discordava do contador da própria folha, que sempre disse o total. A
  // asserção é sobre DOIS porque é ali que as duas contas se separam por um — e
  // é o caso que o operador relatou.
  const dois = await pg.evaluate(async () => {
    await AVDB.listSet('playlist', ['hino-um', 'hino-dois']);
    await load();
    return {
      badge: document.getElementById('plCount').textContent || '',
      folha: document.getElementById('plPopupCount').textContent || '',
      fila: plItems.length,
    };
  });
  checar(dois.fila === 2 && dois.badge === '2',
    'com DOIS itens na fila o selo do botão diz "2" — o TOTAL, e não os itens '
    + 'além do primeiro', JSON.stringify(dois));
  checar(dois.badge === dois.folha,
    'e ele concorda com o contador da folha, que sempre disse o total: duas '
    + 'contagens da mesma lista na mesma tela é o app se contradizendo',
    JSON.stringify(dois));
  await pg.evaluate(async () => { await AVDB.listSet('playlist', []); await load(); });

  // ── 10. A FILA MUDA PELA PORTA DE VERDADE (v1.8.70) ─────────────────────
  // OS NOVE BLOCOS ACIMA MONTAM A FILA PELO BANCO e chamam `load()` na
  // sequência — e é `load()` quem chega a `renderSlideNav()`, o ÚNICO chamador
  // de `renderTransporteHabilitado()`. Por isso todos eles APROVAVAM o defeito:
  // nenhum muda a fila pela porta que o operador usa. Aqui a fila muda por
  // `togglePlaylist` e NADA mais é chamado — nem `load()`, nem `renderSlideNav()`.
  await pg.evaluate(async () => {
    await AVDB.listSet('playlist', []);
    stop();
    await load();
  });
  await esperar(pg, () => plItems.length === 0 && !midiaNoAr, null, 8000);
  const antesDaPorta = await botoes();
  checar(antesDaPorta.fila === 0 && antesDaPorta.midia === false
      && antesDaPorta.prev.off === true && antesDaPorta.next.off === true,
    'A PREMISSA: fila vazia, nada no ar, os dois apagados. Sem esta asserção o '
    + 'bloco passaria a medir um par que já estava aceso',
    antesDaPorta);

  // A PORTA: o botão de playlist de uma linha. `togglePlaylist` é o handler
  // dele, e é o mesmo caminho da folha de destinos com só "playlist" marcada.
  await pg.evaluate(async () => {
    const b = document.createElement('button');
    b.className = 'row-playlist';
    document.body.appendChild(b);
    window.__btnDaPorta = b;
    await togglePlaylist({ id: 'hino-um' }, b);
  });
  await esperar(pg, () => plItems.length === 1, null, 8000);
  const pelaPorta = await botoes();
  checar(pelaPorta.fila === 1,
    'a fila de fato ganhou o item pela porta de verdade', pelaPorta);
  checar(pelaPorta.next.off === false && /pr[óo]xima m[íi]dia/i.test(pelaPorta.next.title),
    'E O ⏭ ACENDE NO ATO: `transportePode(+1)` já responde `true` com a fila '
    + 'em 1, e quem monta a fila pelo botão da linha não passa por `load()`. '
    + 'Apagado, ele engole o toque — inclusive o da notificação e o da tela de '
    + 'bloqueio, que agem por `.click()` — e o único caminho de COMEÇAR uma '
    + 'fila pelo transporte morre sem nada na tela dizendo por quê',
    pelaPorta.next);
  checar(pelaPorta.prev.off === false,
    'e o ⏮ junto, pela mesma régua', pelaPorta.prev);

  // E A VOLTA, que é o que decide ONDE o repintor mora: `renderPlaylist` VOLTA
  // CEDO quando a fila fica vazia (o `if (count === 0) return`), então um
  // repintor no FIM dela não rodaria justamente no caso em que os dois botões
  // precisam APAGAR. É a mesma armadilha que o KDoc de `marcarNaPlaylist` nomeia.
  await pg.evaluate(async () => {
    await togglePlaylist({ id: 'hino-um' }, window.__btnDaPorta);
  });
  await esperar(pg, () => plItems.length === 0, null, 8000);
  const deVolta = await botoes();
  checar(deVolta.fila === 0 && deVolta.next.off === true
      && /fila est[áa] vazia/i.test(deVolta.next.title),
    'e ESVAZIAR pela mesma porta APAGA os dois de volta — a metade que reprova '
    + 'quem puser o repintor no fim de `renderPlaylist`, depois do retorno '
    + 'antecipado do `count === 0`',
    deVolta);

  // ── 11. A REPETIÇÃO APAGADA NÃO CICLA NEM POR FORA (v1.8.87) ────────────
  // O botão chega por `.click()` de três superfícies — a notificação de mídia
  // entre elas —, e `disabled` no DOM só engole o toque de QUEM TOCA A TELA.
  // A guarda que fecha as outras é a primeira linha do `cycleRepeat`, e é ela
  // que esta metade mede: sem ela, o modo mudaria por baixo de um botão
  // apagado e o operador voltaria a um degrau que ele não escolheu.
  // O CAMINHO DE VERDADE é `encerrarCenaDaFila` — esvaziar a fila POR CIMA da
  // cena. Ele é o único que zera o `currentId` (o `stopClear` o preserva de
  // propósito, e o `clearCurrentSelection` só grava o banco), e é o estado que
  // a v1.8.52 criou e que já apaga o ▶. Fora dele, o outro instante de "nada
  // selecionado" é a abertura fria, medida no bloco 1.
  await pg.evaluate(async () => {
    await AVDB.listSet('playlist', ['hino-um']);
    await load();
    await AVDB.listSet('playlist', []);
    await load();
    await encerrarCenaDaFila();
  });
  await esperar(pg, () => plItems.length === 0 && !currentId, null, 8000);
  const semRepetir = await botoes();
  checar(semRepetir.fila === 0 && semRepetir.id === '' && semRepetir.rep.off === true,
    'A PREMISSA: fila vazia, nada escolhido, a repetição apagada. Sem ela o '
    + 'bloco mediria um `cycleRepeat` que não tinha por que agir',
    semRepetir);
  const depoisDoCiclo = await pg.evaluate(async () => {
    const antes = repeat;
    await cycleRepeat();
    return { antes, depois: repeat };
  });
  checar(depoisDoCiclo.antes === depoisDoCiclo.depois,
    'e `cycleRepeat()` chamado DIRETO não muda o degrau: a régua que apaga é a '
    + 'MESMA que o handler executa, como no `transportePode`',
    depoisDoCiclo);

  // E ELA VOLTA. Sem esta metade, "apagar o que não faz nada" poderia deixar o
  // botão morto para sempre depois do primeiro stop do culto.
  await pg.evaluate(async () => {
    await AVDB.listSet('playlist', ['hino-um']);
    await load();
    renderSlideNav();
  });
  await esperar(pg, () => plItems.length === 1, null, 8000);
  const voltou = await botoes();
  checar(voltou.rep.off === false && !/n[ãa]o h[áa] o que repetir/i.test(voltou.rep.title),
    'e a fila voltando, a repetição ACENDE de novo e o `title` larga a frase do '
    + 'apagado — o apagado é um estado, não um caminho sem volta', voltou.rep);
  const ciclou = await pg.evaluate(async () => {
    const antes = repeat;
    await cycleRepeat();
    return { antes, depois: repeat };
  });
  checar(ciclou.antes !== ciclou.depois,
    'e o ciclo volta a andar', ciclou);

} finally {
  await navegador.close();
  await new Promise((r) => servidor.close(r));
}

console.log(falhas.length ? '\n' + falhas.length + ' falha(s)' : '\ntudo certo');
process.exit(falhas.length ? 1 : 0);
