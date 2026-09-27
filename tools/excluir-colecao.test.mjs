#!/usr/bin/env node
// ============================================================================
// EXCLUIR UMA COLEÇÃO DÁ SINAL DE QUE ESTÁ TRABALHANDO, E O CARD SE ATUALIZA
// SOZINHO (v1.10.10)
//
// ## O relato do operador
//
// *"O botão de excluir coleção não tem feedback após a confirmação, nada
// mostrando que está excluindo. E ele nem parece se atualizar automaticamente
// após excluído"*.
//
// ## As duas causas, e por que são independentes
//
//  1. **SEM SINAL DE TRABALHO.** Entre o "sim" da confirmação e o fim de
//     `purgeCatalogRecords` + `AVDB.opfsDeleteDir` (que numa pasta grande
//     custam tempo real), o botão continuava com a cara de sempre — tocável,
//     vermelho, com a lixeira — sem nada dizendo que o toque já tinha sido
//     aceito. `u.delBusy` arma ANTES do primeiro `await` (a regra da v1.4.40:
//     pintar depois do `await` deixaria o botão mudo até a UI thread voltar) e
//     desarma num `finally`, para um erro no meio não deixar o botão preso.
//
//  2. **O CARD NÃO SE REDESENHA SOZINHO.** `deleteCollection` chamava só
//     `load()`, que reidrata o Cronograma e a Biblioteca (`renderLibrary`) —
//     mas quem redesenha os CARDS de coleção da Biblioteca é
//     `renderCollectionsNow()`, uma função **separada**, que nenhum dos dois
//     caminhos chamava. Com a Biblioteca aberta na hora da exclusão (o caso do
//     relato), o card ficava com o peso e o botão antigos até o operador FECHAR
//     e REABRIR a lista.
//
// ## O que este oráculo mede
//
//  1. **ANTES do toque**, o card do Hinário 2022 mostra a lixeira e um peso.
//  2. **DURANTE** (com `AVDB.opfsDeleteDir` deliberadamente SEGURADO por um
//     portão que só este oráculo controla): o botão vira `.busy`, `disabled`,
//     com o aro de espera (`.dl-ring`) no lugar da lixeira (`.msym`) — SEM
//     reabrir a Biblioteca, que continua a mesma instância aberta desde o
//     início.
//  3. **DEPOIS** (o portão liberado e a exclusão terminando): o card se
//     redesenha SOZINHO — o peso antigo desaparece (sem bytes no aparelho, o
//     que sobra é a ESTIMATIVA do que custaria baixar de novo) — sem um único
//     fechar/reabrir da lista.
//
// ## A LISTAGEM NÃO É O QUE FOI BAIXADO (v1.11.4, relato do operador)
//
// *"Ao excluir o hinário ou o que for, ele simplesmente apaga a lista de
// itens na coleção. Não deixe que isso aconteça, pois a listagem é
// independente de ter ou não os itens baixados."*
//
// Até a v1.11.4, o fim da exclusão gravava `{ indexSyncedAt: 0, songs: [] }`
// — o CATÁLOGO (nomes, faixas, durações) ia junto com os bytes, e a lista
// aberta do álbum ficava vazia até o próximo `autoRefreshCollections` buscar
// o índice de novo, com internet. O bloco 4 mede exatamente isso: com o card
// ainda aberto (acordeão), a lista de hinos (`.coll-songs .hymn-result`)
// continua com as MESMAS duas faixas depois da exclusão — só o que ocupava
// espaço saiu, o catálogo fica.
//
// A REVERSÃO (as duas linhas de `renderCollectionCard`/`deleteCollection`
// desfeitas) faz o bloco 2 reprovar (o botão nunca ganha `.busy`), o bloco 3
// reprovar (o peso antigo continua na tela) e o bloco 4 reprovar (a lista
// de hinos e o catálogo em memória somem).
//
//   node tools/excluir-colecao.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperarCortina, esperar, porque, checar, falhas } from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);

await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador();
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true });
await semRedeExterna(ctx);
const pg = await ctx.newPage();

// O ALVO É O HINÁRIO 2022 — uma das DUAS coleções que existem sem rede
// nenhuma (`FIXED_COLLECTIONS`), na raiz da lista: não precisa de catálogo de
// álbum nenhum, nem de abrir grupo algum. `levantarColecao` é PURA sobre
// `collSongs` (nunca consulta o AVDB de verdade), então duas faixas com
// `fileIdFull` já bastam para a coleção se contar como completa e ter peso.
const SEMEAR = `
  const bytes = (n) => new Blob([new Uint8Array(n).fill(3)], { type: 'audio/mp4' });
  await AVDB.opfsWriteFile('folders/hymnal-2022/1.m4a', bytes(64));
  await AVDB.opfsWriteFile('folders/hymnal-2022/2.m4a', bytes(64));
  await AVDB.fileAdd({ id: 'h2022-1', folder: 'hymnal-2022', opfsPath: 'folders/hymnal-2022/1.m4a',
    srcName: '1', name: 'Hino 1', type: 'audio/mp4', kind: 'audio', size: 64,
    thumb: null, blob: null, url: null, addedAt: 1 });
  await AVDB.fileAdd({ id: 'h2022-2', folder: 'hymnal-2022', opfsPath: 'folders/hymnal-2022/2.m4a',
    srcName: '2', name: 'Hino 2', type: 'audio/mp4', kind: 'audio', size: 64,
    thumb: null, blob: null, url: null, addedAt: 1 });
  collState['hymnal-2022'] = {
    indexSyncedAt: Date.now(),
    songs: [
      { id_music: '1', track: 1, name: 'Hino 1', duration: '2:00', fileIdFull: 'h2022-1' },
      { id_music: '2', track: 2, name: 'Hino 2', duration: '2:00', fileIdFull: 'h2022-2' },
    ],
    isHymnal: true,
  };
  ui('hymnal-2022').bytes = 5000000; // 5 MB — só para o peso não sair vazio
`;

// O PORTÃO: `AVDB.opfsDeleteDir` real fica PENDURADO até este oráculo mandar
// seguir. É a técnica que dá uma janela DETERMINÍSTICA para medir o estado
// "trabalhando" — sem ela a exclusão de duas faixas de 64 bytes terminaria
// rápido demais para qualquer sondagem confiar em pegá-la no meio.
const armarPortao = () => pg.evaluate(() => {
  window.__opfsDeleteDirReal = AVDB.opfsDeleteDir.bind(AVDB);
  window.__portaoResolve = null;
  const portao = new Promise((r) => { window.__portaoResolve = r; });
  AVDB.opfsDeleteDir = async (p) => { await portao; return window.__opfsDeleteDirReal(p); };
});
const abrirPortao = () => pg.evaluate(() => { window.__portaoResolve(); });

// O CARD do Hinário 2022, medido pelo NOME (nunca por índice — a lista tem a
// ordem que o app decidir, e "Hinário Adventista 2022" é o rótulo do relato).
const medirCard = () => pg.evaluate(() => {
  const cards = [...document.querySelectorAll('#hymnResults .hymnal-card')];
  const card = cards.find((el) => /Hinário Adventista 2022/.test(el.textContent));
  if (!card) return null;
  const rm = card.querySelector('.coll-bar .coll-bar-rm');
  return {
    achou: true,
    temLixeira: !!rm,
    busy: !!(rm && rm.classList.contains('busy')),
    disabled: !!(rm && rm.disabled),
    temAnel: !!(rm && rm.querySelector('.dl-ring')),
    temIconeLixeira: !!(rm && rm.querySelector('.msym')),
    titulo: rm ? (rm.title || '') : '',
    peso: (card.querySelector('.coll-bar-sync') || {}).textContent || '',
  };
});

try {
  await pg.goto(base + '/controle/', { waitUntil: 'load' });
  await pg.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function', null, { timeout: 30000 });
  await esperarCortina(pg);
  await pg.evaluate(new Function('return (async () => {'
    + ' setAppMode("full"); await load();' + SEMEAR
    + ' const c = allCollections().find((x) => x.id === "hymnal-2022"); ui(c.id).expanded = true;'
    + ' openHymnSearch(); renderCollectionsNow();'
    + ' })()'));

  const pronta = await esperar(pg, () => {
    const l = document.getElementById('hymnResults');
    return !!l && /Hinário Adventista 2022/.test(l.textContent);
  }, null, 10000);
  checar(pronta === true, 'a Biblioteca abre com o card do Hinário 2022 à vista', porque(pronta));

  // ── 0. ANTES: a lixeira está ali, com peso, botão comum ─────────────────
  const antes = await medirCard();
  checar(!!antes && antes.temLixeira && !antes.busy && !antes.disabled && antes.temIconeLixeira,
    'ANTES do toque: a lixeira existe, comum — não ocupada, não desabilitada',
    JSON.stringify(antes));
  checar(!!antes && /\d/.test(antes.peso) && !/não sincron/.test(antes.peso),
    'e o card mostra um PESO (a coleção está indexada e tem bytes no aparelho)',
    JSON.stringify(antes && antes.peso));

  // ── 1. Arma o portão e dispara a exclusão pelo TOQUE de verdade ─────────
  await armarPortao();
  await pg.evaluate(() => {
    const cards = [...document.querySelectorAll('#hymnResults .hymnal-card')];
    const card = cards.find((el) => /Hinário Adventista 2022/.test(el.textContent));
    card.querySelector('.coll-bar .coll-bar-rm').click();
  });
  const dialogoAbriu = await esperar(pg, () => appDialogEl.classList.contains('open'), null, 5000);
  checar(dialogoAbriu === true, 'o toque abre a confirmação — "Excluir" não é feito sem perguntar',
    porque(dialogoAbriu));
  await pg.evaluate(() => appDialogOkEl.click());

  // ── 2. DURANTE: o botão vira "trabalhando", sem fechar/reabrir nada ─────
  const durante = await esperar(pg, () => {
    const cards = [...document.querySelectorAll('#hymnResults .hymnal-card')];
    const card = cards.find((el) => /Hinário Adventista 2022/.test(el.textContent));
    const rm = card && card.querySelector('.coll-bar .coll-bar-rm');
    return !!(rm && rm.classList.contains('busy'));
  }, null, 5000);
  checar(durante === true,
    'DURANTE a exclusão (segurada pelo portão): o botão avisa que está '
    + 'trabalhando — é o sinal que o relato dizia não existir', porque(durante));
  const meio = await medirCard();
  checar(!!meio && meio.busy && meio.disabled,
    'a classe `.busy` chega com `disabled` — o toque duplo não reinicia a exclusão',
    JSON.stringify(meio));
  checar(!!meio && meio.temAnel && !meio.temIconeLixeira,
    'o DESENHO troca: o aro de espera no lugar da lixeira, nunca os dois juntos',
    JSON.stringify(meio));
  checar(!!meio && /Excluindo/.test(meio.titulo),
    'e o título muda para "Excluindo…" — quem não vê o ícone lê a mesma coisa',
    meio && meio.titulo);

  // ── 3. Libera o portão: a exclusão termina de verdade ───────────────────
  await abrirPortao();
  const terminou = await esperar(pg, () => {
    const cards = [...document.querySelectorAll('#hymnResults .hymnal-card')];
    const card = cards.find((el) => /Hinário Adventista 2022/.test(el.textContent));
    const rm = card && card.querySelector('.coll-bar .coll-bar-rm');
    return !(rm && rm.classList.contains('busy'));
  }, null, 8000);
  checar(terminou === true, 'e o "trabalhando" se desfaz sozinho ao terminar', porque(terminou));

  // ── 4. DEPOIS: o card se atualiza SOZINHO, sem fechar/reabrir a lista ───
  const depois = await medirCard();
  // A lixeira SEGUE ali — o card continua com um catálogo (`total > 0`), e
  // essa condição não muda com o download; ela responde "há o que oferecer
  // baixar de novo?", não "há algo para remover agora?".
  checar(!!depois && depois.temLixeira,
    'DEPOIS: a lixeira continua na barra — o álbum tem catálogo conhecido, e '
    + 'a ação "remover do dispositivo" segue oferecida (mesmo sem nada '
    + 'baixado no momento, o operador pode repetir o toque sem susto)',
    JSON.stringify(depois));
  checar(!!depois && depois.peso !== '',
    'e o peso deixa de mostrar o número ANTIGO, mas não fica em branco: o '
    + 'card volta a estimar o custo de baixar de novo — o catálogo continua '
    + 'sabendo QUANTAS faixas e QUANTO elas pesam',
    JSON.stringify(depois && depois.peso));

  // ===== A LISTAGEM NÃO É O QUE FOI BAIXADO (v1.11.4, relato do operador) ===
  //
  // "Ao excluir o hinário ou o que for, ele simplesmente apaga a lista de
  // itens na coleção. Não deixe que isso aconteça, pois a listagem é
  // independente de ter ou não os itens baixados." — a prova é o CATÁLOGO em
  // memória (`collSongs`) e a LISTA DE VERDADE, ainda na tela, com o card
  // continuando aberto desde o início do oráculo (nenhum fechar/reabrir).
  const catalogoENoLista = await pg.evaluate(() => {
    const songs = collSongs('hymnal-2022');
    const linhas = document.querySelectorAll(
      '#hymnResults .hymnal-card .coll-open .coll-songs .hymn-result');
    return {
      songsNoCatalogo: songs.length,
      fileIdFull: songs.map((s) => s.fileIdFull),
      linhasNaTela: linhas.length,
    };
  });
  checar(catalogoENoLista.songsNoCatalogo === 2,
    'e o CATÁLOGO continua com as duas faixas — excluir é esvaziar o '
    + 'aparelho, nunca a listagem', JSON.stringify(catalogoENoLista));
  checar(catalogoENoLista.fileIdFull.every((v) => v === null),
    'e cada faixa perde o PONTEIRO para o arquivo apagado (`fileIdFull: '
    + 'null`) — sem isso a tela contaria como baixada uma música cujo '
    + 'registro `purgeCatalogRecords` acabou de remover', JSON.stringify(catalogoENoLista.fileIdFull));
  checar(catalogoENoLista.linhasNaTela === 2,
    'e a LISTA ABERTA na tela continua mostrando as duas faixas — é a "lista '
    + 'de itens na coleção" do relato, e ela não pode sumir só porque o '
    + 'áudio baixado saiu', JSON.stringify(catalogoENoLista));

  // A promessa do recurso continua de pé: excluir é ESVAZIAR o aparelho, não
  // o catálogo — a coleção segue existindo, pronta para sincronizar de novo.
  const catalogo = await pg.evaluate(() =>
    allCollections().some((c) => c.id === 'hymnal-2022'));
  checar(catalogo === true,
    'e a coleção CONTINUA no acervo — "remover do dispositivo" nunca apaga o '
    + 'catálogo, só o que ocupava espaço');
} finally {
  await navegador.close();
  await new Promise((r) => servidor.close(r));
}

console.log(falhas.length ? '\n' + falhas.length + ' falha(s)' : '\ntudo certo');
process.exit(falhas.length ? 1 : 0);
