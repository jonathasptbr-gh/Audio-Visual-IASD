// A FAXINA DA COLETÂNEA REMOVIDA — o que sai do aparelho, e o que NÃO pode sair.
//
// ## Por que ele existe
//
// A v1.8.97 acrescentou uma coletânea de vídeos do LouvorJA e a v1.8.98 a
// removeu a pedido do operador. Tirar o código não tira o que ele já guardou:
// MEDIDO no Registro dele, eram **1150 faixas em 16 chaves `coll:online-*`**,
// mais o catálogo e o diário. Sem `onlineCollections()` nada mais alcança
// aquelas chaves — elas ficariam no IndexedDB para sempre, onde limpar o cache
// do app não chega.
//
// ## Os dois modos de errar, e eles são OPOSTOS
//
//   · **apagar de MENOS** — a faxina não roda, ou roda com o prefixo errado, e
//     o lixo fica. Não há sintoma nenhum: o app funciona, e o espaço some;
//   · **apagar de MAIS** — e este é o caro. Um prefixo genérico (`'online'`) ou
//     uma varredura de mídia levaria junto o que o operador BAIXOU daquela
//     coletânea, que virou item comum do acervo e pode estar no Cronograma. O
//     apagador varre por FAIXA (`IDBKeyRange.bound`), então um prefixo curto
//     alcança muito mais do que parece.
//
// E há o terceiro, que é de custo e não de dado: rodar em TODA abertura. A
// varredura acharia zero para sempre, duas transações por carga.
//
// Este oráculo é de Node puro: ele exercita o `stateApagarPrefixo` do `db.js`
// contra um IndexedDB de mentira, que é o que permite afirmar o ALCANCE do
// prefixo sem subir navegador.
//
//   node tools/faxina-online.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { checar, falhas } from './checar.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DB = join(raiz, 'app/src/main/assets/web/shared/db.js');
const SRC_CTRL = join(raiz, 'app/src/main/assets/web/controle/controle.js');

// ── O IndexedDB DE MENTIRA ──────────────────────────────────────────────────
// Só o que o `stateApagarPrefixo` toca: um cursor sobre uma faixa de chaves. As
// chaves são ordenadas como o IndexedDB as ordena (lexicográfica por código de
// unidade), que é o que dá sentido ao `bound`.
function bancoFalso(chaves) {
  const dados = new Map(chaves.map((k) => [k, 1]));
  const store = {
    openCursor(range) {
      const req = { onsuccess: null, onerror: null, result: null };
      const alvos = [...dados.keys()].filter((k) => range.contem(k)).sort();
      let i = 0;
      const passo = () => {
        if (i >= alvos.length) { req.result = null; if (req.onsuccess) req.onsuccess(); return; }
        const k = alvos[i++];
        req.result = {
          delete: () => dados.delete(k),
          continue: () => setTimeout(passo, 0),
        };
        if (req.onsuccess) req.onsuccess();
      };
      setTimeout(passo, 0);
      return req;
    },
  };
  return { dados, store };
}

// O `IDBKeyRange.bound` do navegador, na parte que importa: os dois extremos
// inclusivos, comparação de string.
const IDBKeyRange = {
  bound: (lo, hi, exLo, exHi) => ({
    contem: (k) => (exLo ? k > lo : k >= lo) && (exHi ? k < hi : k <= hi),
  }),
};

// ── O `stateApagarPrefixo` DE VERDADE, extraído do `db.js` ──────────────────
// Recortado do arquivo real e não reescrito aqui: uma segunda escrita da mesma
// função provaria que o oráculo concorda consigo mesmo.
const fonteDb = readFileSync(SRC_DB, 'utf8');
const ini = fonteDb.indexOf('async function stateApagarPrefixo(prefix)');
const fim = fonteDb.indexOf('\n  }\n', ini) + 4;
checar(ini > 0 && fim > ini, 'o `stateApagarPrefixo` foi encontrado no db.js');
if (ini < 0) { console.log('\n1 FALHA(S)'); process.exit(1); }

let banco = null;
const apagar = new Function('IDBKeyRange', 'storeTx', 'STORE_STATE', 'txDone', `
  ${fonteDb.slice(ini, fim)}
  return stateApagarPrefixo;
`)(IDBKeyRange, async () => [banco.store, {}], 'state', async () => {});

async function faxinar(chaves, prefixos) {
  banco = bancoFalso(chaves);
  for (const p of prefixos) await apagar(p);
  return [...banco.dados.keys()].sort();
}

// ── AS CHAVES DE UM APARELHO DE VERDADE ─────────────────────────────────────
// As três que a faxina tira, e as que NÃO podem sair junto. Entre as últimas
// estão duas armadilhas de PREFIXO: `coll:online-…` sai, mas `coll:album-…` e
// `coll:hymnal-2022` ficam; e `onlineCatalog`/`onlineDiag` saem sem levar um
// `onlineOutraCoisa` que alguém venha a criar.
const CHAVES = [
  'coll:online-PLaaa', 'coll:online-PLbbb', 'onlineCatalog', 'onlineDiag',
  'coll:album-12', 'coll:hymnal-2022', 'coll:hymnal-1996', 'coll:serie-provai-vede-2026',
  'albumCatalog', 'serieAuto', 'serieDiag:serie-provai-vede-2026',
  'bibleVersions', 'ytAltura', 'favoritos', 'cronograma', 'av.tema',
];
// ===== OS PREFIXOS SÃO LIDOS DO CÓDIGO, e é isso que torna a asserção real =====
//
// A primeira escrita deste oráculo declarava a lista aqui E a usava para
// apagar: trocar os três prefixos do `controle.js` por um `'online'` genérico
// passava VERDE, porque o oráculo estava medindo a própria lista. É a
// tautologia que a reversão existe para achar — e achou.
//
// Agora são DUAS listas: a ESPERADA (o contrato, aqui) e a DO CÓDIGO (extraída
// do `faxinaDaColetaneaOnline`). A comparação entre elas é a primeira asserção,
// e a faxina roda com a do CÓDIGO.
const PREFIXOS_ESPERADOS = ['coll:online-', 'onlineCatalog', 'onlineDiag'];

const PREFIXOS = (() => {
  const src = readFileSync(SRC_CTRL, 'utf8');
  const i = src.indexOf('async function faxinaDaColetaneaOnline()');
  const corpo = i < 0 ? '' : src.slice(i, src.indexOf('\n}\n', i));
  return [...corpo.matchAll(/stateApagarPrefixo\('([^']*)'\)/g)].map((m) => m[1]);
})();

checar(PREFIXOS.join('|') === PREFIXOS_ESPERADOS.join('|'),
  'o código apaga EXATAMENTE os três prefixos do contrato, nesta ordem — um a menos deixa'
  + ' lixo para sempre, um mais curto alcança o que não é dele',
  { codigo: PREFIXOS, esperado: PREFIXOS_ESPERADOS });

const sobrou = await faxinar(CHAVES, PREFIXOS);

checar(!sobrou.some((k) => k.startsWith('coll:online-')),
  'as chaves `coll:online-*` saem — eram 16 delas no aparelho do operador, com 1150 faixas',
  sobrou);
checar(sobrou.indexOf('onlineCatalog') < 0 && sobrou.indexOf('onlineDiag') < 0,
  'o catálogo e o diário saem', sobrou);

// A METADE QUE IMPORTA MAIS, e sem ela a de cima aprova um `clear()` do banco.
const DEVEM_FICAR = CHAVES.filter((k) => PREFIXOS_ESPERADOS.every((p) => !k.startsWith(p)));
checar(sobrou.join('|') === DEVEM_FICAR.sort().join('|'),
  'e NADA MAIS sai: os outros álbuns, os dois hinários, a série, o Cronograma, os'
  + ' Favoritos e o tema continuam lá (sem esta metade, um `clear()` do banco passaria)',
  { sobrou, esperado: DEVEM_FICAR });

// ── O ALCANCE DO PREFIXO, que é onde "apagar de mais" nasce ─────────────────
{
  const comIrmaos = ['onlineCatalog', 'onlineDiag', 'onlineOutraCoisa', 'coll:online-PLa', 'coll:onlineX'];
  const r = await faxinar(comIrmaos, PREFIXOS);
  checar(r.indexOf('onlineOutraCoisa') >= 0,
    'um prefixo EXATO não alcança uma chave futura que só COMECE com a mesma palavra'
    + ' — é por isso que são três prefixos e não um `\'online\'`', r);
  // `coll:onlineX` NÃO começa com `coll:online-` (falta o hífen), e é essa a
  // diferença entre o prefixo certo e o quase-certo.
  checar(r.indexOf('coll:onlineX') >= 0,
    'e o hífen do `coll:online-` faz parte do prefixo: `coll:onlineX` não é alcançado', r);
}
{
  const r = await faxinar(CHAVES, ['online']);
  checar(r.indexOf('onlineCatalog') < 0 && r.indexOf('coll:album-12') >= 0,
    'o prefixo genérico `\'online\'` alcançaria as duas chaves da coletânea — a asserção'
    + ' existe para que "por que três prefixos?" tenha resposta MEDIDA, não uma opinião', r);
}

// ── UMA VEZ POR APARELHO ────────────────────────────────────────────────────
//
// A marca é o que separa uma faxina de uma varredura eterna. Ela é conferida no
// CÓDIGO e não simulada: o que se afirma é que a guarda existe e vem ANTES do
// apagador, que é a ordem que impede a segunda abertura de varrer de novo.
{
  const src = readFileSync(SRC_CTRL, 'utf8');
  const i = src.indexOf('async function faxinaDaColetaneaOnline()');
  checar(i > 0, 'a faxina existe no controle.js');
  const corpo = src.slice(i, src.indexOf('\n}\n', i));
  const iGuarda = corpo.indexOf('ONLINE_FAXINA_KEY');
  const iApaga = corpo.indexOf('stateApagarPrefixo');
  checar(iGuarda > 0 && iApaga > 0 && iGuarda < iApaga,
    'e a MARCA é lida ANTES de apagar — invertido, a varredura roda em toda abertura'
    + ' para sempre, achando zero, com duas transações por carga',
    { guarda: iGuarda, apaga: iApaga });
  checar(/return;/.test(corpo.slice(iGuarda, iApaga)),
    'e a leitura da marca SAI da função (um `if` sem `return` não guarda nada)');
  checar(/catch/.test(corpo),
    'a faxina inteira é embrulhada: ela não pode impedir o app de abrir');
  // O QUE ELA NÃO PODE TOCAR. `fileDel`/`opfs*`/`mediaDel` apagariam o que o
  // operador BAIXOU — um vídeo daquela coletânea virou item comum do acervo e
  // pode estar no Cronograma.
  checar(!/fileDel|opfsDelete|opfsRemove|mediaDel|listRemove/.test(corpo),
    'e ela NÃO toca em mídia: só cache de índice sai, nunca um arquivo baixado'
    + ' (que pode estar no Cronograma ou nos Favoritos)', corpo);
  // ===== ELA NÃO PODE ATRASAR A ABERTURA — e esta é a asserção que o CI comprou =====
  //
  // A primeira escrita a chamava com `await` no COMEÇO do `loadCollections`, por
  // uma precaução contra um caminho que não existe (ver o KDoc dela). MEDIDO sob
  // carga 3×, o mesmo regime do CI: **2 reprovações em 6 no `boot-nativo` com o
  // `await`, 0 em 6 sem ele** — quatro transações de IndexedDB antes do primeiro
  // desenho da Biblioteca empurram o render para fora da janela de prazo FIXO
  // que aquele oráculo usa. O CI reprovou por isso, e a causa era esta.
  const iChamada = src.indexOf('  faxinaDaColetaneaOnline();');
  const iLoad = src.indexOf('async function loadCollections()');
  checar(iChamada > iLoad, 'a faxina é CHAMADA dentro do `loadCollections`',
    { chamada: iChamada, load: iLoad });
  checar(src.indexOf('await faxinaDaColetaneaOnline()') < 0,
    'e NUNCA com `await`: ela é fire-and-forget, como as outras rotinas de acervo —'
    + ' nada na tela espera por ela, e no caminho crítico ela atrasa o primeiro desenho'
    + ' da Biblioteca (MEDIDO: 2 reprovações em 6 no boot-nativo sob carga 3×)');
  // E ela é a ÚLTIMA linha: antes do `loadLyricStore` ela voltaria ao caminho
  // que a abertura espera.
  const iLyric = src.indexOf('await loadLyricStore();');
  checar(iChamada > iLyric,
    'e ela vem DEPOIS de tudo o que a abertura precisa — no meio, o `await` do que vem'
    + ' a seguir a traria de volta para o caminho crítico',
    { chamada: iChamada, lyric: iLyric });
}

console.log('');
if (falhas.length) {
  console.log(falhas.length + ' FALHA(S)');
  process.exit(1);
}
console.log('Todos passaram.');
