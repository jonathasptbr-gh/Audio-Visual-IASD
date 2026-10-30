#!/usr/bin/env node
// AS LISTAS DE PROTEÇÃO SEGURAM O ITEM E O ARQUIVO (v1.13.12).
//
// Regra do operador: *"elementos e seus arquivos não podem ser excluídos sem
// que sejam removidos de todas as listas em que estão… a menos que eu remova o
// item do favorito, diretamente através dele, outra lista como a coletânea
// hinário não deve afetar aquele item… mantenha o arquivo junto, para que não
// precise rebaixar nada"*.
//
// O percurso é o do "Excluir" de uma coleção (`purgeCatalogRecords` + a pasta
// apagada em bloco), com uma faixa nos Favoritos, outra no Cronograma, outra só
// no catálogo:
//  A. a dos Favoritos e a do Cronograma CONTINUAM nas listas, abrem, e os bytes
//     (e a imagem de fundo da letra) estão fora da pasta apagada;
//  B. a que nenhuma lista segurava SAI, como sempre;
//  C. tirar o favorito pela lista o leva embora (o coletor de sempre);
//  D. o diário de saídas dos Favoritos anota a saída.
//
//   node tools/listas-de-protecao.test.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import {
  servirEstatico, abrirNavegador, esperarCortina, checar, falhas, comModoAvancado,
} from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);
await new Promise((r) => servidor.listen(0, r));
const base = `http://localhost:${servidor.address().port}`;
const navegador = await abrirNavegador();
const erros = [];

try {
  const ctx = await navegador.newContext();
  await semRedeExterna(ctx);
  await comModoAvancado(ctx);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await esperarCortina(pg);

  const r = await pg.evaluate(async () => {
    const pasta = 'folders/colTeste/';
    await AVDB.opfsWriteFile(pasta + 'fav.mp3', new Blob(['BYTES-DO-FAVORITO'], { type: 'audio/mpeg' }));
    await AVDB.opfsWriteFile(pasta + 'crono.mp3', new Blob(['BYTES-DO-CRONOGRAMA'], { type: 'audio/mpeg' }));
    await AVDB.opfsWriteFile(pasta + 'solta.mp3', new Blob(['BYTES-SOLTOS'], { type: 'audio/mpeg' }));
    await AVDB.opfsWriteFile(pasta + 'fundo.jpg', new Blob(['IMAGEM'], { type: 'image/jpeg' }));
    const reg = (id, arq, extra) => AVDB.fileAdd(Object.assign({
      id, folder: 'colTeste', opfsPath: pasta + arq, name: id, type: 'audio/mpeg', kind: 'audio',
      size: 10, addedAt: Date.now(), blob: null, url: null,
    }, extra || {}));
    await reg('faixaFav', 'fav.mp3', { lyrics: [{ text: 'estrofe', auxText: '', imageOpfsPath: pasta + 'fundo.jpg' }] });
    await reg('faixaCrono', 'crono.mp3');
    await reg('faixaSolta', 'solta.mp3');
    await AVDB.listAdd('favs', 'faixaFav');
    await AVDB.listAdd('imports', 'faixaCrono');

    // O "Excluir" de uma coleção, como `deleteCollection` o faz.
    await purgeCatalogRecords(await AVDB.filesByFolder('colTeste'));
    await AVDB.opfsDeleteDir('folders/colTeste');

    const ler = async (f) => { try { return f ? await f.text() : null; } catch (_) { return null; } };
    const fav = await AVDB.getMedia('faixaFav');
    const crono = await AVDB.getMedia('faixaCrono');
    const solta = await AVDB.getMedia('faixaSolta');
    const out = {
      favNaLista: (await AVDB.listIds('favs')).includes('faixaFav'),
      cronoNaLista: (await AVDB.listIds('imports')).includes('faixaCrono'),
      favCaminho: fav && fav.opfsPath,
      favBytes: fav ? await ler(await AVDB.opfsGetFile(fav.opfsPath)) : null,
      favImagem: fav && fav.lyrics && fav.lyrics[0] && fav.lyrics[0].imageOpfsPath,
      cronoBytes: crono ? await ler(await AVDB.opfsGetFile(crono.opfsPath)) : null,
      favCatalogo: !!(await AVDB.fileGet('faixaFav')),
      solta: !!solta,
    };
    out.imagemBytes = out.favImagem ? await ler(await AVDB.opfsGetFile(out.favImagem)) : null;
    // C. Tirar pela lista: o coletor de sempre leva o registro.
    await AVDB.listRemove('favs', 'faixaFav');
    out.depoisDeTirar = !!(await AVDB.getMedia('faixaFav'));
    out.saidas = (await AVDB.getState('favsSaidas')) || [];
    return out;
  });

  checar(r.favNaLista && r.cronoNaLista,
    'A · excluir a coleção NÃO tira a faixa dos Favoritos nem do Cronograma', r);
  checar(r.favBytes === 'BYTES-DO-FAVORITO' && r.cronoBytes === 'BYTES-DO-CRONOGRAMA',
    'A · e as duas continuam abrindo, com os MESMOS bytes — a pasta apagada não os levou', r);
  checar(typeof r.favCaminho === 'string' && r.favCaminho.indexOf('folders/') !== 0 && !r.favCatalogo,
    'A · os bytes moram fora da pasta da coleção, e o registro saiu do catálogo dela', r.favCaminho);
  checar(r.imagemBytes === 'IMAGEM',
    'A · e a imagem de fundo da letra foi junto (a estrofe continua com a foto)', r.favImagem);
  checar(!r.solta, 'B · a faixa que nenhuma lista segurava SAI, como sempre', r.solta);
  checar(!r.depoisDeTirar, 'C · tirar o favorito pela lista o leva embora — o coletor de sempre', r.depoisDeTirar);
  checar(Array.isArray(r.saidas) && r.saidas.some((x) => x && x.id === 'faixaFav' && x.em > 0),
    'D · o diário de saídas dos Favoritos anota a saída', r.saidas);
} catch (e) {
  checar(false, 'o percurso terminou sem exceção (' + (e && e.message) + ')');
}
checar(!erros.length, 'nenhum erro de página', erros);

await navegador.close();
servidor.close();
if (falhas.length) {
  console.log('\n' + falhas.length + ' falha(s).');
  process.exit(1);
}
console.log('\nTodos passaram.');
