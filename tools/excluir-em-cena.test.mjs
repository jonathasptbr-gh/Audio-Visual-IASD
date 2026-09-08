// EXCLUIR DE UMA LISTA NÃO PODE DERRUBAR A CENA (v1.3.13).
//
// ## O relato
//
// *"Ao apagar um item do cronograma (e provavelmente em outras listas) enquanto
// ele está em execução, o item interrompe sua execução. Verifique, pois onplayer
// também deveria ser um elemento que mantém a existência de um item no
// sistema."*
//
// ## Eram DOIS defeitos, e o segundo é o silencioso
//
//  1. **`retirarDoAr` no caminho de excluir.** Uma linha que PARAVA a projeção
//     antes de mexer na lista. A dica do próprio botão é o contrato, e ela fala
//     de LISTA (*"tirar isto desta lista"*); parar a cena tem botão próprio (o
//     segundo toque na linha) e não podia vir de carona. A FILA já fazia o
//     certo desde a v5.309, com o motivo escrito — este caminho é que destoava.
//
//  2. **O coletor só conhecia LISTAS.** `listRemove` pergunta se algum outro
//     detentor aponta o id e, não achando nenhum, apaga os bytes na MESMA
//     transação. Estar NO AR não era detenção nenhuma. Corrigir só o item 1
//     deixaria a cena tocando com os bytes já apagados por baixo — e isso **não
//     tem sintoma**: o `<video>` já os tem, e a projeção segue. Só uma queda de
//     dongle revelaria (o `resendSceneToDisplay` chama `getMedia`, que não
//     acharia mais nada), no meio do culto, sem nada que ligasse uma coisa à
//     outra.
//
// Daí este arquivo medir as DUAS: que a cena continua ANDANDO (não só "não
// pausou") e que o REGISTRO sobrevive.
//
// ## E a terceira metade, que é a que impede a correção de virar outro defeito
//
// Excluir continua sendo uma DECLARAÇÃO DE INTENÇÃO: um item que NÃO está em
// cena tem de morrer de verdade. Uma "correção" que simplesmente parasse de
// coletar passaria nas duas primeiras e transformaria o aparelho num depósito.
//
//   node tools/excluir-em-cena.test.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, checar, falhas } from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);

// WAV de 20 s pelo motivo de sempre: uma faixa que acabe no meio do teste
// responde `paused:true` por ter TERMINADO, indistinguível de interrompida.
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
  const emCena = await AVDB.addMedia(wav(), { name: 'Louvor Em Cena', type: 'audio/wav', kind: 'audio', list: 'imports' });
  const parado = await AVDB.addMedia(wav(), { name: 'Louvor Parado', type: 'audio/wav', kind: 'audio', list: 'imports' });
`;

await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await navegador.newContext({ viewport: { width: 412, height: 892 } });
await semRedeExterna(ctx);
const pg = await ctx.newPage();
const erros = [];
pg.on('pageerror', (e) => erros.push(e.message));

// O EXCLUIR PELO CAMINHO DO OPERADOR, e ele tem TRÊS toques: o `⋮` que abre a
// gaveta da linha, a lixeira lá dentro, e o "Excluir" da confirmação que ela
// abre NA PRÓPRIA FAIXA (v5.301). Chamar `aoConfirmar` por dentro pularia
// justamente a confirmação, que é onde a ação mora.
const excluirPelaLinha = async (nome) => pg.evaluate((n) => {
  const li = [...document.querySelectorAll('.lib-item')]
    .find((e) => (e.textContent || '').includes(n));
  if (!li) return 'linha não encontrada';
  const mais = li.querySelector('.row-mais');
  if (!mais) return 'o `⋮` da linha não existe';
  mais.click();                                   // 1. abre a gaveta
  const lixo = li.querySelector('.row-excluir');
  if (!lixo) return 'a lixeira não está na gaveta';
  lixo.click();                                   // 2. pede a exclusão
  const sim = li.querySelector('.linha-confirma-btn.linha-sim');
  if (!sim) return 'a confirmação não apareceu na faixa';
  sim.click();                                    // 3. confirma
  return '';
}, nome);

try {
  await pg.goto(base + '/controle/', { waitUntil: 'load' });
  await pg.waitForFunction(
    () => window.AVDB && typeof window.__avBack === 'function' && !!document.querySelector('#playlist li'),
    null, { timeout: 25000 },
  );
  const ids = await pg.evaluate(new Function('return (async () => {'
    + 'setAppMode("full");' + SEMEAR + 'await load(); return { emCena: emCena.id, parado: parado.id }; })()'));

  // ── O PONTO DE PARTIDA: uma coisa tocando de verdade ────────────────────
  //
  // O "Louvor Parado" é TOCADO PRIMEIRO, de propósito: é ele que exercita o
  // risco que esta correção introduz. Com o player virando detentor, todo item
  // que entrou em cena passa a estar na prateleira `avulsos` — e um item que
  // JÁ TOCOU e foi excluído depois precisa morrer do mesmo jeito. Sem esta
  // passagem, a metade 3 mediria um item que nunca esteve na prateleira, e
  // aprovaria uma correção que simplesmente parasse de coletar.
  await pg.evaluate((id) => send(id), ids.parado);
  await pg.waitForTimeout(250);
  await pg.evaluate((id) => send(id), ids.emCena);
  await pg.waitForFunction(() => {
    const v = document.querySelector('#preview video') || document.querySelector('video');
    return !!v && !v.paused && v.currentTime > 0.2;
  }, null, { timeout: 15000 }).catch(() => {});
  const espiar = () => pg.evaluate(() => {
    const v = document.querySelector('#preview video') || document.querySelector('video');
    return { pausado: v ? v.paused : null, tempo: v ? v.currentTime : null, atual: currentId };
  });
  const a = await espiar();
  checar(!a.pausado && a.tempo > 0 && a.atual === ids.emCena,
    'o louvor está tocando (ponto de partida)', a);

  // ── 0b. A LIXEIRA É O SÍMBOLO DA PERGUNTA, NÃO A RESPOSTA (v1.8.50) ─────
  //
  // Relato do operador: *"verifique a coloração do ícone de lixeira durante as
  // confirmações de exclusão no cronograma, favoritos, playlist e etc… Ele está
  // um ícone vermelho, ao lado de um botão de 'excluir' também vermelho. Deixe
  // esse ícone de lixeira na coloração natural dos botões que já ocupavam a
  // posição dele antes do momento de confirmar exclusão."*
  //
  // O par de tokens é `--btn-danger`/`--danger-strong` nos DOIS, então a
  // asserção tem de ser a COR RENDERIZADA — comparar nomes de token aprovaria
  // um `--surface` que por acaso fosse vermelho, e não veria a regressão de
  // alguém "uniformizar" a faixa de volta.
  //
  // AS DUAS METADES: a lixeira veste o MESMO que o `.row-btn` que ocupava aquele
  // lugar um instante antes, E o `.linha-sim` ao lado continua vermelho. Sem a
  // segunda, apagar o vermelho de tudo passaria — e o botão que apaga bytes
  // ficaria indistinguível do que cancela.
  const tintas = await pg.evaluate(() => {
    const li = [...document.querySelectorAll('.lib-item')]
      .find((e) => (e.textContent || '').includes('Louvor Parado'));
    li.querySelector('.row-mais').click();
    const antesDoPedido = getComputedStyle(li.querySelector('.row-excluir')).backgroundColor;
    li.querySelector('.row-excluir').click();
    const lixo = li.querySelector('.row-slot--del');
    const sim = li.querySelector('.linha-confirma-btn.linha-sim');
    const nao = li.querySelector('.linha-confirma-btn.linha-nao');
    const r = {
      antesDoPedido,
      lixo: lixo ? getComputedStyle(lixo).backgroundColor : null,
      lixoTexto: lixo ? getComputedStyle(lixo).color : null,
      sim: sim ? getComputedStyle(sim).backgroundColor : null,
      rotulo: sim ? (sim.textContent || '').trim() : null,
    };
    if (nao) nao.click();   // a faixa volta ao `⋮`, para os blocos seguintes
    return r;
  });
  checar(tintas.lixo === tintas.antesDoPedido,
    'A LIXEIRA DA CONFIRMAÇÃO veste a MESMA tinta do botão que ocupava aquele '
    + 'lugar um instante antes: a faixa troca de conteúdo sem trocar de cor',
    tintas);
  checar(tintas.sim !== tintas.lixo,
    'e o botão que APAGA continua sendo o único vermelho da cena — a linguagem '
    + 'do perigo é para o ALVO da ação, não para o cartaz ao lado dele', tintas);

  // ── 0c. UM VERBO SÓ PARA O MESMO GESTO ──────────────────────────────────
  // Relato do operador: *"verifique o nome do botão de confirmar exclusão do
  // item da playlist, pois ele está 'tirar', use 'remover'"*. "Tirar" era a
  // única palavra própria daquela fila, e um verbo por lista faz reler o botão
  // antes de tocar num alvo que apaga bytes.
  const naFila = await pg.evaluate(async () => {
    // UMA FAIXA SÓ PARA A FILA, e ela não entra em `imports`: os blocos 1 a 3
    // medem quem SEGURA um item contra o coletor, e um terceiro nome nas listas
    // deles mudaria o que eles verificam.
    const sr = 8000, n = sr * 2;
    const buf = new ArrayBuffer(44 + n * 2), dv = new DataView(buf);
    const wr = (o, t) => { for (let i = 0; i < t.length; i++) dv.setUint8(o + i, t.charCodeAt(i)); };
    wr(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); wr(8, 'WAVEfmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true);
    dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
    wr(36, 'data'); dv.setUint32(40, n * 2, true);
    await AVDB.addMedia(new Blob([buf], { type: 'audio/wav' }),
      { name: 'Só Na Fila', type: 'audio/wav', kind: 'audio', list: 'playlist' });
    await load();
    const li = [...document.querySelectorAll('#playlist li')]
      .find((e) => (e.textContent || '').includes('Só Na Fila'));
    if (!li) return { erro: 'a fila está vazia' };
    const mais = li.querySelector('.row-mais');
    if (mais) mais.click();
    const rm = li.querySelector('.row-excluir');
    if (!rm) return { erro: 'a linha da fila não tem lixeira' };
    const dica = rm.title;
    rm.click();
    const sim = li.querySelector('.linha-confirma-btn.linha-sim');
    const rotulo = sim ? (sim.textContent || '').trim() : null;
    const nao = li.querySelector('.linha-confirma-btn.linha-nao');
    if (nao) nao.click();
    return { dica, rotulo };
  });
  checar(naFila.rotulo === 'Remover' && /^Remover da playlist$/.test(naFila.dica || ''),
    'e a confirmação da FILA diz "Remover", como as outras listas — nunca '
    + '"Tirar"', naFila);
  checar(tintas.rotulo === 'Excluir',
    'enquanto o Cronograma continua dizendo "Excluir": os dois gestos são '
    + 'diferentes (um tira da fila, o outro apaga da lista), e o que se '
    + 'uniformizou foi a palavra da REMOÇÃO, não as duas ações', tintas.rotulo);

  // ── 1. EXCLUIR DO CRONOGRAMA NÃO INTERROMPE A CENA ──────────────────────
  const erro1 = await excluirPelaLinha('Louvor Em Cena');
  checar(erro1 === '', 'o caminho do operador existe: `⋮` → lixeira → Excluir', erro1);
  await pg.waitForTimeout(400);
  const b1 = await espiar();
  await pg.waitForTimeout(900);
  const b2 = await espiar();
  checar(!b2.pausado && b2.tempo > b1.tempo + 0.4,
    'depois de excluir, o louvor NÃO PAROU e CONTINUA ANDANDO — "não pausou" '
    + 'sozinho é fraco; andar prova que é a mesma faixa', { b1: b1.tempo, b2: b2.tempo });
  const saiuDaLista = await pg.evaluate(
    () => ![...document.querySelectorAll('.lib-item')].some((e) => (e.textContent || '').includes('Louvor Em Cena')),
  );
  checar(saiuDaLista, 'e ele SAIU da lista — o que se pediu de fato aconteceu');

  // ── 2. E OS BYTES SOBREVIVEM (a metade sem sintoma) ─────────────────────
  //
  // É o que uma queda de dongle precisaria: `resendSceneToDisplay` chama
  // `getMedia`, e sem detentor o registro já teria sido coletado na mesma
  // transação do `listRemove`.
  const rec = await pg.evaluate(async (id) => {
    const r = await AVDB.getMedia(id);
    return { existe: !!r, temBytes: !!(r && (r.blob || r.opfsPath || r.url)) };
  }, ids.emCena);
  checar(rec.existe && rec.temBytes,
    'o REGISTRO sobrevive: estar no ar segura o item, como uma lista segura', rec);
  const naPrateleira = await pg.evaluate(async (id) => (await AVDB.listIds('avulsos')).includes(id), ids.emCena);
  checar(naPrateleira,
    'e quem o segura é a prateleira `avulsos` — a mesma que o "Tocar agora" usa', naPrateleira);

  // ── 3. O QUE NÃO ESTÁ EM CENA MORRE DE VERDADE ─────────────────────────
  //
  // A metade que impede a correção de virar outro defeito: parar de coletar
  // passaria nas duas de cima e transformaria o aparelho num depósito.
  const erro3 = await excluirPelaLinha('Louvor Parado');
  checar(erro3 === '', 'a linha do item parado percorre o mesmo caminho', erro3);
  await pg.waitForTimeout(500);
  const morto = await pg.evaluate(async (id) => ({
    registro: !(await AVDB.getMedia(id)),
    prateleira: !(await AVDB.listIds('avulsos')).includes(id),
  }), ids.parado);
  checar(morto.registro && morto.prateleira,
    'um item que JÁ TOCOU e não está mais em cena é coletado — excluir continua '
    + 'sendo uma declaração de intenção, e ela vale para a prateleira também', morto);

  checar(erros.length === 0, 'nenhum erro de página', erros);
  // ── 4. A FILA ACABOU COM A CENA DENTRO: A CENA ACABA JUNTO (v1.8.52) ────
  //
  // Pedido do operador: *"verifique se a mídia ativa nos controles é removida
  // para o estado de 'nada em exibição' quando eu excluo o único item da
  // playlist… sendo assim o método de limpar de verdade o controle atual"*.
  //
  // ELE MORA NESTE ARQUIVO DE PROPÓSITO. As duas regras parecem se contradizer
  // e não se contradizem, e é aqui — ao lado das três asserções da v1.3.13 —
  // que a distinção fica legível: excluir do ACERVO não derruba a cena; esvaziar
  // a FILA por cima dela, sim. A natureza da lista é a régua, não a contagem de
  // detentores: a fila é a única que o TRANSPORTE percorre.
  const filaCena = await pg.evaluate(async () => {
    const sr = 8000, n = sr * 20;
    const buf = new ArrayBuffer(44 + n * 2), dv = new DataView(buf);
    const wr = (o, t) => { for (let i = 0; i < t.length; i++) dv.setUint8(o + i, t.charCodeAt(i)); };
    wr(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); wr(8, 'WAVEfmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true);
    dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
    wr(36, 'data'); dv.setUint32(40, n * 2, true);
    const wav = () => new Blob([buf], { type: 'audio/wav' });
    await AVDB.listSet('playlist', () => []);
    const a = await AVDB.addMedia(wav(), { name: 'So Na Fila A', type: 'audio/wav', kind: 'audio', list: 'playlist' });
    const b = await AVDB.addMedia(wav(), { name: 'So Na Fila B', type: 'audio/wav', kind: 'audio', list: 'playlist' });
    await load();
    return { a: a.id, b: b.id };
  });
  const remover = (nome) => pg.evaluate((n) => {
    const li = [...document.querySelectorAll('#playlist li')].find((e) => (e.textContent || '').includes(n));
    if (!li) return 'sem linha';
    const m = li.querySelector('.row-mais'); if (m) m.click();
    const rm = li.querySelector('.row-excluir'); if (!rm) return 'sem lixeira';
    rm.click();
    const sim = li.querySelector('.linha-confirma-btn.linha-sim'); if (!sim) return 'sem confirmar';
    sim.click(); return '';
  }, nome);
  const olhar = (id) => pg.evaluate(async (id) => {
    const v = document.querySelector('#preview video') || document.querySelector('video');
    let rec = null; try { rec = await AVDB.getMedia(id); } catch (_) {}
    const avulsos = await AVDB.listItems('avulsos');
    return {
      fila: plItems.length, currentId: currentId || '', midiaNoAr: !!midiaNoAr,
      tocando: !!v && !v.paused,
      rotulo: (document.getElementById('npNameInner') || document.getElementById('npName') || {}).textContent || '',
      play: !!document.getElementById('playpause').disabled,
      stop: !!document.getElementById('stop').disabled,
      registro: !!rec, emAvulsos: avulsos.some((x) => x.id === id),
    };
  }, id);

  // 4a · COM FILA SOBRANDO, NADA MUDA — é a v1.3.13 pelo outro lado.
  await pg.evaluate((id) => send(id), filaCena.a);
  await pg.waitForFunction(() => !!midiaNoAr, null, { timeout: 10000 }).catch(() => {});
  await pg.waitForTimeout(400);
  checar(await remover('So Na Fila A') === '', 'a linha da fila tem o caminho `⋮` → lixeira → Remover');
  await pg.waitForTimeout(900);
  const sobrando = await olhar(filaCena.a);
  checar(sobrando.fila === 1 && sobrando.midiaNoAr === true && sobrando.tocando === true,
    '4a · REMOVER O ITEM NO AR COM FILA SOBRANDO não muda nada: a sequência não '
    + 'acabou, só saiu um item dela — pausar o louvor porque o operador '
    + 'reorganizou a fila seria interrupção de culto', JSON.stringify(sobrando));

  // 4b · A FILA ACABA COM A CENA DENTRO.
  await pg.evaluate(async (id) => { await AVDB.listSet('playlist', [id]); await load(); await send(id); }, filaCena.b);
  await pg.waitForFunction(() => !!midiaNoAr && plItems.length === 1, null, { timeout: 10000 }).catch(() => {});
  await pg.waitForTimeout(400);
  checar(await remover('So Na Fila B') === '', 'e o mesmo caminho na última linha da fila');
  await pg.waitForTimeout(1200);
  const acabou = await olhar(filaCena.b);
  checar(acabou.fila === 0 && acabou.midiaNoAr === false && acabou.tocando === false,
    '4b · ESVAZIAR A FILA POR CIMA DA CENA ENCERRA A CENA: a fila é a única '
    + 'lista que o TRANSPORTE percorre, e tirar dela o que está no ar sem sobrar '
    + 'nada não é "guardei noutro lugar", é ACABOU', JSON.stringify(acabou));
  checar(acabou.currentId === '' && /nada em exibi/i.test(acabou.rotulo),
    '4b · e "nada em exibição" DE VERDADE — a frase só é alcançável com o '
    + '`currentId` nulo, e ele precisa ser PERSISTIDO: `load()` o re-hidrata de '
    + '`state.current.mediaId` a cada `db-change`', JSON.stringify(acabou));
  checar(acabou.play === true && acabou.stop === true,
    '4b · e o ▶ apaga junto: sem `currentId` o handler não tem ramo que aja, e '
    + 'um botão aceso e inerte é o que a v1.8.50 existe para não deixar nascer',
    JSON.stringify(acabou));
  checar(acabou.registro === true && acabou.emAvulsos === true,
    '4b · e NADA É APAGADO: o item sobrevive na prateleira `avulsos` com os '
    + 'bytes intactos — o que acabou foi a CENA, não o item, e ele volta pelo '
    + 'Histórico', JSON.stringify(acabou));

  // ── 4c · FILA VAZIA COM `repeat` LIGADO TAMBÉM É FIM DE CENA (v1.8.52) ──
  //
  // O IRMÃO DO 4b, e ele não veio de relato nenhum: apareceu ao ler o caminho
  // que o 4b abre. Com a fila vazia, uma mídia em cena vem da PRATELEIRA — e no
  // fim dela o `autoAdvance` tinha um `return` seco para `plItems.length === 0`,
  // que só é o certo com `repeat: 'off'` (ali quem já respondeu foi o
  // `resetAfterEnd` da primeira linha).
  //
  // O ESTRAGO ERA PERMANENTE E MUDO: `midiaNoAr` ficava `true` pelo resto da
  // sessão. Daí `rotinaDeAcervoPodeCorrer()` respondia `false` para sempre — as
  // rotinas de acervo nunca mais cediam a vez de volta — e, o caro,
  // `resendSceneToDisplay` pergunta `midiaNoAr`: uma queda de dongle devolvia ao
  // telão a faixa que JÁ TINHA ACABADO, na frente da congregação.
  //
  // O `media-ended` é o caminho EXATO (o telão diz o que terminou), e é por ele
  // que o oráculo entra — esperar 20 s de wav seria medir o relógio.
  const semFila = await pg.evaluate(async () => {
    await AVDB.listSet('playlist', () => []);
    await AVDB.setState('repeat', 'all');
    repeat = 'all';
    await load();
    return { fila: plItems.length, repeat };
  });
  checar(semFila.fila === 0 && semFila.repeat === 'all',
    '4c · o cenário está armado: fila vazia e `repeat` LIGADO — com `off` quem '
    + 'responde é a primeira linha do `autoAdvance`, e o bloco mediria outra coisa',
    JSON.stringify(semFila));
  await pg.evaluate((id) => send(id), filaCena.b);
  await pg.waitForFunction(() => !!midiaNoAr, null, { timeout: 10000 }).catch(() => {});
  await pg.waitForTimeout(400);
  // O TELÃO DE MENTIRA fala pelo MESMO barramento que o de verdade — um
  // `BroadcastChannel` de outra janela (o iframe), como no
  // `preview-volta-ao-wallpaper`. Chamar o handler daqui pularia a recepção.
  await pg.evaluate((id) => {
    const f = document.createElement('iframe');
    f.style.display = 'none';
    document.body.appendChild(f);
    f.contentWindow.eval('new BroadcastChannel("av-iasd").postMessage('
      + JSON.stringify({ type: 'media-ended', mediaId: id }) + ')');
  }, filaCena.b);
  await pg.waitForFunction(() => !midiaNoAr, null, { timeout: 4000 }).catch(() => {});
  const fimSemFila = await olhar(filaCena.b);
  checar(fimSemFila.midiaNoAr === false,
    '4c · A FAIXA QUE ACABA SEM FILA BAIXA A BANDEIRA: com o `return` seco, '
    + '`midiaNoAr` ficava `true` para o resto da sessão — as rotinas de acervo '
    + 'nunca mais corriam, e uma queda de dongle reprojetava o que já acabou',
    JSON.stringify(fimSemFila));

  // ── 4d · A SEGUNDA PORTA PARA O MESMO ESTADO: O BOTÃO "LIMPAR" ──────────
  //
  // Esvaziar a fila pela lixeira da última linha e esvaziá-la pelo "Limpar" da
  // folha produzem o MESMO estado, e duas respostas para ele fariam o app se
  // contradizer conforme a porta. O `limparPlaylist` não tinha oráculo nenhum.
  const limpou = await pg.evaluate(async (id) => {
    await AVDB.listSet('playlist', [id]);
    await load();
    await send(id);
    await new Promise((f) => setTimeout(f, 600));
    const antes = { fila: plItems.length, midiaNoAr: !!midiaNoAr };
    await limparPlaylist();
    await new Promise((f) => setTimeout(f, 600));
    return { antes, fila: plItems.length, midiaNoAr: !!midiaNoAr, currentId: currentId || '' };
  }, filaCena.b);
  checar(limpou.antes.midiaNoAr === true && limpou.fila === 0
      && limpou.midiaNoAr === false && limpou.currentId === '',
    '4d · o "Limpar" da folha responde COMO A LIXEIRA: o mesmo estado por duas '
    + 'portas não pode ter duas respostas — e a `dica` do botão, que dizia "o '
    + 'que está no ar segue no ar", é texto que o operador LÊ antes de confirmar',
    JSON.stringify(limpou));

} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) {
  console.log('\n' + falhas.length + ' falha(s).');
  process.exit(1);
}
console.log('\nTodos passaram.');
