// O COLETOR DE LIXO do banco (`shared/db.js`), contra um IndexedDB de verdade.
//
// ## Por que este teste existe
//
// Porque é o único código do app que APAGA mídia do operador. Um erro aqui não
// dá tela branca nem erro de console: some com o vídeo do domingo, em silêncio,
// e não há desfazer.
//
// E porque o buraco que ele fecha era real e chegou do aparelho: a busca do
// YouTube mostrava "download pronto" em vídeos que não estavam em seção nenhuma
// do app. A causa era o `listSet` — o outro escritor de listas — gravando a
// lista nova e indo embora, sem coletar o que saiu dela. `listSet('playlist',
// [rec.id])` substitui a playlist INTEIRA: cada item que ela tinha e que não
// estivesse no Cronograma ou nos Favoritos virava um registro que nenhuma lista
// aponta, que a busca ainda encontrava pelo índice `youtubeId`, e que nenhum gc
// alcançava.
//
//   node tools/db-gc.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { abrirNavegador, checar, falhas } from './arnes.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const DB = fs.readFileSync(
  path.join(AQUI, '..', 'app', 'src', 'main', 'assets', 'web', 'shared', 'db.js'), 'utf8',
);

const navegador = await abrirNavegador();
// IndexedDB exige um origin de verdade: `about:blank` não serve. Um servidor
// não é preciso — o `file:` do Playwright basta via `setContent` sobre uma
// página http fictícia interceptada.
const ctx = await navegador.newContext();
await semRedeExterna(ctx);
const pg = await ctx.newPage();
await pg.route('http://av.local/**', (rota) => rota.fulfill({
  status: 200, contentType: 'text/html; charset=utf-8',
  body: '<!doctype html><meta charset="utf-8"><script>' + DB + '</script>',
}));
await pg.goto('http://av.local/', { waitUntil: 'domcontentloaded' });

// Um registro de mídia por lista, com um blob minúsculo.
const semear = (lista, youtubeId) => pg.evaluate(async ([l, yt]) => {
  const rec = await window.AVDB.addMedia(new Blob(['x'], { type: 'video/mp4' }), {
    name: 'v-' + l, kind: 'video', list: l, youtubeId: yt || null,
  });
  return rec.id;
}, [lista, youtubeId]);

const existe = (id) => pg.evaluate(async (i) => !!(await window.AVDB.getMedia(i)), id);

// --- listSet que ESVAZIA uma lista coleta o que saiu ------------------------
const a = await semear('imports');
await pg.evaluate(() => window.AVDB.listSet('imports', []));
checar(!(await existe(a)), 'listSet esvaziando a lista COLETA o registro que ficou sem dono');

// --- ...mas não toca no que outro detentor ainda segura ---------------------
const b = await semear('playlist');
await pg.evaluate((id) => window.AVDB.listAdd('favs', id), b);
await pg.evaluate(() => window.AVDB.listSet('playlist', []));
checar(await existe(b), 'e NÃO apaga o que um Favorito (ou outra lista) ainda segura');

// --- reordenar não é remover ------------------------------------------------
// Na PLAYLIST de propósito: o passo seguinte esvazia o Cronograma para
// reproduzir o defeito, e semear aqui dentro dele faria estes dois virarem
// órfãos legítimos — a primeira versão deste teste caiu exatamente nisso e
// acusou o código por uma armadilha que ela mesma armou.
const c = await semear('playlist');
const d = await semear('playlist');
await pg.evaluate(() => window.AVDB.listSet('playlist', (ids) => ids.slice().reverse()));
checar((await existe(c)) && (await existe(d)),
  'reordenar (mesmo conjunto, outra ordem) não apaga nada');

// --- a FAXINA dos restos que os buracos antigos deixaram --------------------
// `setState` cru é exatamente o que o `listSet` fazia antes: grava a lista e
// vai embora. É assim que se reproduz um resto legítimo, do jeito que ele
// nasceu nos aparelhos.
const orfao = await semear('imports', 'YT-ORFAO');
await pg.evaluate(() => window.AVDB.setState('imports', []));
checar(await existe(orfao), 'um setState cru deixa o registro órfão (o defeito reproduzido)');
checar(!!(await pg.evaluate(() => window.AVDB.mediaByYoutube('YT-ORFAO'))),
  'e a busca do YouTube ainda o encontra — é o "download pronto" fantasma');

const removidos = await pg.evaluate(() => window.AVDB.gcOrfaos());
checar(removidos >= 1, 'a faxina remove o órfão', 'removidos: ' + removidos);
checar(!(await existe(orfao)), 'e ele some do banco');
checar(!(await pg.evaluate(() => window.AVDB.mediaByYoutube('YT-ORFAO'))),
  'e a busca deixa de anunciá-lo como pronto');
checar(await existe(b), 'a faxina PRESERVA o que tem dono (o favoritado continua lá)');
checar((await existe(c)) && (await existe(d)), 'e a playlist continua inteira');

// Rodar de novo não pode ter o que fazer: um gc que "acha" algo toda vez está
// apagando o que tem dono.
const segunda = await pg.evaluate(() => window.AVDB.gcOrfaos());
checar(segunda === 0, 'e a segunda passagem não acha mais nada', 'removidos: ' + segunda);

// --- a CENA É DETENTORA (v5.315) -------------------------------------------
// O caso que chegou do aparelho: um vídeo baixado direto para a playlist tem UM
// único detentor. Tirar da fila enquanto ele TOCA destruía o registro debaixo
// da projeção — o telão seguia com os bytes e nada avisava; o estrago aparecia
// só na reconexão do dongle (ou depois de um OTA), quando o reenvio de cena
// pede um `getMedia` que não existe mais. Longe da causa e no meio do culto.
//
// A bandeira é `noAr`, e não o `mediaId` sozinho: a SELEÇÃO sobrevive ao fim da
// mídia (é ela que o ▶ repete), então prender por ela deixaria o último item
// tocado indestrutível — o fantasma da v5.87, com os bytes no aparelho e sem
// lugar visível onde removê-los.
const emCena = await semear('playlist');
await pg.evaluate((id) => window.AVDB.setState('current', { mediaId: id, noAr: true }), emCena);
await pg.evaluate((id) => window.AVDB.listRemove('playlist', id), emCena);
checar(await existe(emCena), 'tirar da ÚNICA lista NÃO apaga o que está em cena');
checar(!(await pg.evaluate((id) => window.AVDB.listHas('playlist', id), emCena)),
  'e a remoção acontece de verdade — o que fica é só o blob');
checar((await pg.evaluate(() => window.AVDB.gcOrfaos())) === 0,
  'a faxina também o preserva enquanto ele estiver no ar');
checar(await existe(emCena), 'e ele continua no banco depois dela');

// A OUTRA METADE, sem a qual a de cima seria VAZAMENTO — e ela tem dois
// caminhos, porque no app são dois gestos diferentes.
//
// (1) A MÍDIA SAIU DO AR sem trocar de seleção: é o que `pararMidia` e o
// `resetAfterEnd` fazem, e os dois chamam `persistCurrent()` logo depois de
// zerar `midiaNoAr`. O `mediaId` continua lá (o ▶ repete), mas o detentor
// caiu — senão excluir o que acabou de tocar não liberaria byte nenhum.
await pg.evaluate((id) => window.AVDB.setState('current', { mediaId: id, noAr: false }), emCena);
checar((await pg.evaluate(() => window.AVDB.gcOrfaos())) === 1,
  'saindo do ar (mesma seleção, `noAr:false`), a faxina o recolhe');
checar(!(await existe(emCena)), 'e o registro some — a seleção sozinha não segura nada');

// (2) TROCADA A CENA: o caminho de sempre. No app quem zera a chave na abertura
// é o `clearCurrentSelection`, ANTES do `varrerRestos` da mesma passagem.
const outroEmCena = await semear('playlist');
await pg.evaluate((id) => window.AVDB.setState('current', { mediaId: id, noAr: true }), outroEmCena);
await pg.evaluate((id) => window.AVDB.listRemove('playlist', id), outroEmCena);
checar(await existe(outroEmCena), 'um segundo item em cena também é preservado');
const cenaNova = await semear('playlist');
await pg.evaluate((id) => window.AVDB.setState('current', { mediaId: id, noAr: true }), cenaNova);
checar((await pg.evaluate(() => window.AVDB.gcOrfaos())) === 1,
  'trocada a cena, a faxina seguinte recolhe o anterior');
checar(!(await existe(outroEmCena)), 'e o registro que ficou para trás some');
checar(await existe(cenaNova), 'enquanto a cena nova continua inteira');

// --- O PACOTE É DETENTOR DOS IDS QUE CARREGA -------------------------------
// O cue `group` (o "Guardar pacote" da fila, e o pacote do sorteio) guarda uma
// FILA inteira em `data.ids` — ids de mídia que podem não estar em lista
// nenhuma. Sem descer neles, salvar a fila no Cronograma e depois trocar a fila
// apaga as mídias e deixa o pacote de pé apontando para bytes que não existem:
// `abrirPacote` só descobre em "as mídias saíram do aparelho", no sábado.
//
// A isenção escrita no histórico vale só para o pacote do SORTEIO, cujos ids
// vivem no store `files` (que o coletor não toca). O da fila aceita importados e
// downloads do YouTube, que vivem em `media`.
const pa = await semear('playlist');
const pb = await semear('playlist');
const pacote = await pg.evaluate(async ([x, y]) => (await window.AVDB.addCue(
  'group', { ids: [x, y] }, { name: 'Pacote', list: 'imports' },
)).id, [pa, pb]);
await pg.evaluate(() => window.AVDB.listSet('playlist', []));
checar((await existe(pa)) && (await existe(pb)),
  'trocar a fila NÃO apaga a mídia que um pacote guardado ainda aponta');
checar(await existe(pacote), 'e o pacote continua no Cronograma');
checar((await pg.evaluate(() => window.AVDB.gcOrfaos())) === 0,
  'a faxina também as preserva — o pacote é detentor como uma lista');
checar((await existe(pa)) && (await existe(pb)), 'e elas continuam no banco depois dela');

// A OUTRA METADE, sem a qual a de cima seria VAZAMENTO: morto o pacote, os ids
// dele voltam a ser órfãos comuns.
await pg.evaluate((id) => window.AVDB.listRemove('imports', id), pacote);
checar(!(await existe(pacote)), 'excluir o pacote do Cronograma o apaga');
checar((await pg.evaluate(() => window.AVDB.gcOrfaos())) === 2,
  'e a faxina seguinte recolhe as mídias que só ele segurava');
checar(!(await existe(pa)) && !(await existe(pb)), 'que somem do banco');

await navegador.close();
console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
