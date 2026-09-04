#!/usr/bin/env node
// ============================================================================
// A DISSOLUÇÃO DE UMA COLETÂNEA — a regra que decide o que a Biblioteca MOSTRA
//
// ## Por que ele existe
//
// `controle/coletanea.js` lê o catálogo CRU do banco (`pt_categories`) e devolve
// a lista de coletâneas a desenhar, com as que o operador mandou dissolver
// fundidas noutra. Ela decide, a partir de NOMES que o banco renomeia sem
// avisar, o que aparece na tela de abertura da Biblioteca.
//
// **Os dois modos de errar são MUDOS, e são simétricos:**
//
//   · uma fusão que DUPLICA devolve o mesmo card duas vezes, numa lista
//     plausível, na ordem certa — e ninguém conta álbuns;
//   · uma fusão que PERDE devolve a mesma lista plausível com um álbum a menos,
//     e o operador conclui que o acervo encolheu.
//
// E há um terceiro, que é o pior porque parece o desfecho certo: o DESTINO
// deixar de existir no banco e a regra dissolver a origem assim mesmo. Os
// álbuns sairiam da seção que os hospedava e não haveria seção nenhuma para
// recebê-los — eles sumiriam da Biblioteca inteira, com o único caminho de
// download em lote deles junto. Nada erra no console.
//
// As metades, e nenhuma sozinha prova a regra:
//
//  1. **A DISSOLUÇÃO É UMA FUSÃO** — a origem sai da lista E os álbuns dela
//     estão no destino. Afirmar só a primeira aprova um `filter` que descarta.
//  2. **A CONSERVAÇÃO** — o conjunto de `id_album` desenhados é EXATAMENTE o de
//     entrada, cada um uma vez. Conjuntos e não contagem: contar aprova uma
//     troca.
//  3. **DESTINO AUSENTE ⇒ IDENTIDADE PROFUNDA** — a metade que impede o
//     desfecho ruim, e ela é comparada com `JSON.stringify` porque "quase
//     igual" aqui é um álbum perdido.
//  4. **N:N** — o mesmo `id_album` nas duas coletâneas sai UMA vez, com o pivô
//     do destino (a relação é de muitos para muitos por construção; ver
//     `docs/FONTE-DE-DADOS-LOUVORJA.md` §5.5).
//  5. **A GRAFIA, EM PARES** — o que casa e o que NÃO casa. Só a segunda metade
//     impede que a regra se alargue: um `includes` no lugar da igualdade
//     dissolveria "Celebra SP 2" junto, e a lista continuaria plausível.
//  6. **NÃO MUTA A ENTRADA** — o catálogo cru continua no IndexedDB, e um
//     `push` na lista de entrada gravaria a decisão no aparelho pela porta dos
//     fundos, onde nenhum OTA a desfaz.
//  7. **O `normalizar` CONCORDA COM O DO `serie.js`** — os dois arquivos têm a
//     mesma função escrita neles, de propósito (módulo puro não importa módulo
//     puro para ler quatro linhas), e é aqui que a divergência é pega. É a
//     técnica que o `hinario.test.mjs` já usa para os números da faixa infantil.
//
// As entradas são VERBATIM: os cinco nomes de coletânea lidos numa captura de
// aparelho (`site/telas/biblioteca.webp`) e repetidos no fixture do
// `boot-nativo.test.mjs`. Nomenclatura imaginada prova só que o código concorda
// com quem o escreveu.
//
// Node puro, sem rede e sem navegador: entra no `apk.yml` **sem
// `continue-on-error`** — ele decide o que aparece na Biblioteca.
//
//   node tools/coletanea.test.mjs
// ============================================================================
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { checar, falhas } from './checar.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(raiz, 'app/src/main/assets/web/controle/coletanea.js');
const SRC_SERIE = join(raiz, 'app/src/main/assets/web/controle/serie.js');

// A mesma carga dos irmãos puros: a IIFE recebe o global pelo `this` do `.call`.
// Zero navegador — se um dia o arquivo passar a depender de `document`, isto
// falha alto, que é o que se quer.
const janela = {};
new Function(readFileSync(SRC, 'utf8')).call(janela);
const C = janela.AVColetanea;

checar(!!C, 'o módulo publica AVColetanea');
if (!C) { console.log('\n1 FALHA(S)'); process.exit(1); }

// ── AS ENTRADAS VERBATIM ────────────────────────────────────────────────────
// Os cinco nomes na ordem lida na captura. Cada coletânea com dois álbuns, para
// que "entraram no FIM, na ordem que tinham" seja dizível.
const catalogo = () => ([
  { id_category: 1, name: 'CDs oficiais/ano', order: 1, albums: [
    { id_album: 10, subtitle: '2022-2023', order: 1 },
    { id_album: 11, subtitle: '2021', order: 2 }] },
  { id_category: 2, name: 'Adoradores', order: 2, albums: [
    { id_album: 20, subtitle: '', order: 1 }] },
  { id_category: 3, name: 'Cantores', order: 3, albums: [
    { id_album: 30, subtitle: '', order: 1 }] },
  { id_category: 4, name: 'Celebra SP', order: 4, albums: [
    { id_album: 40, subtitle: 'primeiro', order: 1 },
    { id_album: 41, subtitle: 'segundo', order: 2 }] },
  { id_category: 5, name: 'Diversas', order: 5, albums: [
    { id_album: 50, subtitle: '', order: 1 },
    { id_album: 51, subtitle: '', order: 2 }] },
]);
const nomes = (cats) => cats.map((c) => c.name);
const ids = (cats) => cats.flatMap((c) => c.albums.map((a) => a.id_album));

// ── 1. A DISSOLUÇÃO É UMA FUSÃO ─────────────────────────────────────────────
{
  const { categorias, diario } = C.aplicar(catalogo());
  checar(!nomes(categorias).includes('Celebra SP'),
    'a coletânea dissolvida SAI da lista', nomes(categorias));
  const destino = categorias.find((c) => c.name === 'Diversas');
  checar(!!destino && destino.albums.map((a) => a.id_album).join(',') === '50,51,40,41',
    'e os álbuns dela entram no FIM do destino, na ordem que tinham',
    destino && destino.albums.map((a) => a.id_album));
  // O `order` REESCRITO: juntar duas escalas de pivô e reordenar por elas
  // produz um intercalado que não significa nada e continua parecendo ordenado.
  const ordens = destino ? destino.albums.map((a) => a.order) : [];
  checar(ordens.every((o, i) => i === 0 || o > ordens[i - 1]),
    'e o `order` do destino continua estritamente crescente depois da mescla',
    ordens);
  // O SUBTÍTULO é o único texto que o banco escreveu sobre aquele álbum naquela
  // coletânea, e ele viaja com o álbum.
  const movido = destino && destino.albums.find((a) => a.id_album === 40);
  checar(movido && movido.subtitle === 'primeiro',
    'e o subtítulo do pivô viaja junto', movido && movido.subtitle);
  checar(diario.length === 1 && diario[0].motivo === C.MOTIVO_MOVIDA
    && diario[0].movidos.join(',') === '40,41' && diario[0].de === 'Celebra SP'
    && diario[0].para === 'Diversas',
    'e o diário diz o que foi feito, com os nomes CRUS do banco', diario);
}

// ── 2. A CONSERVAÇÃO ────────────────────────────────────────────────────────
{
  const entrada = catalogo();
  const { categorias } = C.aplicar(entrada);
  const antes = ids(entrada).slice().sort();
  const depois = ids(categorias).slice().sort();
  checar(JSON.stringify(antes) === JSON.stringify(depois),
    'nenhum álbum se perde e nenhum se duplica: o conjunto de ids é o MESMO',
    { antes, depois });
}

// ── 3. DESTINO AUSENTE ⇒ IDENTIDADE PROFUNDA ────────────────────────────────
// A metade que impede o desfecho ruim. Sem ela, "dissolver" passa a significar
// "apagar" no dia em que o banco renomear a coletânea de destino.
{
  const semDestino = catalogo().filter((c) => c.name !== 'Diversas');
  const { categorias, diario } = C.aplicar(semDestino);
  checar(JSON.stringify(categorias) === JSON.stringify(semDestino),
    'sem o destino no banco, NADA é feito — a coletânea de origem continua na '
    + 'tela, inteira', nomes(categorias));
  checar(diario.length === 1 && diario[0].motivo === C.MOTIVO_SEM_DESTINO,
    'e o diário DIZ que não fez, para o Registro poder explicar', diario);
}

// ── 3-bis. ORIGEM AUSENTE ⇒ IDENTIDADE ──────────────────────────────────────
{
  const semOrigem = catalogo().filter((c) => c.name !== 'Celebra SP');
  const { categorias, diario } = C.aplicar(semOrigem);
  checar(JSON.stringify(categorias) === JSON.stringify(semOrigem),
    'sem a origem no banco, nada a dissolver (o banco pode ter renomeado)',
    nomes(categorias));
  checar(diario.length === 1 && diario[0].motivo === C.MOTIVO_SEM_ORIGEM,
    'e o diário distingue isso de "não encontrei o destino" — os dois pedem '
    + 'ações opostas', diario);
}

// ── 4. N:N — O MESMO ÁLBUM NAS DUAS ─────────────────────────────────────────
// A relação categoria↔álbum é de muitos para muitos, e `categoryCards` não
// deduplica: um `concat` cru sairia com o card repetido dentro do destino.
{
  const cats = catalogo();
  cats.find((c) => c.name === 'Diversas').albums.push(
    { id_album: 40, subtitle: 'o do destino', order: 3 });
  const { categorias, diario } = C.aplicar(cats);
  const destino = categorias.find((c) => c.name === 'Diversas');
  const quantos = destino.albums.filter((a) => a.id_album === 40).length;
  checar(quantos === 1, 'um álbum que JÁ estava no destino aparece UMA vez', quantos);
  checar(destino.albums.find((a) => a.id_album === 40).subtitle === 'o do destino',
    'e com o pivô do DESTINO, que é o que descreve o álbum naquele contexto');
  checar(diario[0].jaEstavam.join(',') === '40' && diario[0].movidos.join(',') === '41',
    'e o diário separa o que foi MOVIDO do que já estava lá', diario[0]);
}

// ── 4-bis. UM ÁLBUM REPETIDO DENTRO DA PRÓPRIA ORIGEM NÃO É "N:N" ──────────
// Dois casos com consertos opostos e uma frase só no Registro: o banco listar o
// álbum nas DUAS coletâneas (o caso real, `jaEstavam`) e listá-lo duas vezes
// DENTRO da origem (`repetidosNaOrigem`). Sem a distinção, o Registro manda
// procurar o álbum na coletânea de destino, onde ele não está.
{
  const cats = catalogo();
  cats.find((c) => c.name === 'Celebra SP').albums.push(
    { id_album: 40, subtitle: 'a repetição', order: 3 });
  const { categorias, diario } = C.aplicar(cats);
  const destino = categorias.find((c) => c.name === 'Diversas');
  checar(destino.albums.filter((a) => a.id_album === 40).length === 1,
    'um álbum repetido DENTRO da origem entra uma vez só no destino');
  checar(diario[0].jaEstavam.length === 0 && diario[0].repetidosNaOrigem.join(',') === '40',
    'e o diário o chama de repetição na ORIGEM, não de "já estava no destino"',
    diario[0]);
}

// ── 4-ter. A LINHA DEGENERADA (`de` === `para`) NÃO APAGA A COLETÂNEA ────────
// Hoje inalcançável — nenhuma grafia de "Celebra SP" normaliza para "Diversas"
// —, e a tabela convida a crescer ("uma linha a mais dissolve outra coletânea
// sem código novo"). É a única porta que o `sem-destino` não cobre, e ela leva
// ao pior desfecho do arquivo: os álbuns somem da Biblioteca.
{
  const antes = JSON.stringify(C.DISSOLVER);
  C.DISSOLVER.push({ de: ['Diversas'], para: ['Diversas'] });
  try {
    const { categorias, diario } = C.aplicar(catalogo());
    checar(!!categorias.find((c) => c.name === 'Diversas'),
      'uma linha em que `de` e `para` resolvem para a MESMA coletânea não a apaga',
      nomes(categorias));
    const d = diario.find((x) => x.de === 'Diversas' && x.para === 'Diversas');
    checar(!!d && d.motivo === C.MOTIVO_SEM_DESTINO,
      'e o diário a trata como "sem destino" — nada foi feito', d);
  } finally {
    C.DISSOLVER.length = 0;
    JSON.parse(antes).forEach((r) => C.DISSOLVER.push(r));
  }
}

// ── 4-quater. UM PIVÔ QUEBRADO NÃO DERRUBA O REGISTRO ───────────────────────
// `blocoColetaneas` chama esta mesma função para montar o bloco do Registro, e
// `renderDiag()` é chamado sem `.catch` — uma exceção aqui derruba o Registro
// INTEIRO, e o operador copia o texto anterior sem nada na tela dizendo que ele
// é velho.
{
  const cats = catalogo();
  cats.find((c) => c.name === 'Celebra SP').albums.push(null);
  cats.find((c) => c.name === 'Cantores').albums.push({ subtitle: 'sem id' });
  let erro = null;
  let r = null;
  try { r = C.aplicar(cats); } catch (e) { erro = e; }
  checar(!erro, 'um pivô nulo ou sem `id_album` não faz a regra LANÇAR',
    erro && erro.message);
  checar(!!r && !ids(r.categorias).some((x) => x == null),
    'e ele é descartado, não copiado — o mesmo filtro do `fetchAlbumCatalog`');
}

// ── 5. A GRAFIA, EM PARES ───────────────────────────────────────────────────
// A metade das RECUSAS é a que impede a regra de se alargar. Sem ela, trocar a
// igualdade por um `includes` passaria — e dissolveria "Celebra SP 2" junto.
{
  const casaCom = (nome) => {
    const cats = catalogo();
    cats.find((c) => c.name === 'Celebra SP').name = nome;
    return !nomes(C.aplicar(cats).categorias).includes(nome);
  };
  for (const bom of ['Celebra SP', 'celebra sp', 'CELEBRA SP', '  Celebra  SP ', 'Célebra SP']) {
    checar(casaCom(bom), 'casa com a grafia "' + bom + '"');
  }
  for (const mau of ['Celebra SP 2', 'Celebrar SP', 'Celebra', 'SP Celebra', '']) {
    checar(!casaCom(mau), 'NÃO casa com "' + mau + '" — a igualdade é do nome '
      + 'INTEIRO, nunca prefixo nem conteúdo');
  }
  // O apelido do destino: o operador escreveu "diversos" e a seção se chama
  // "Diversas". Nenhuma normalização liga uma à outra — é o feminino, não um
  // acento —, e por isso as duas grafias estão na tabela.
  const cats = catalogo();
  cats.find((c) => c.name === 'Diversas').name = 'Diversos';
  const r = C.aplicar(cats);
  checar(!nomes(r.categorias).includes('Celebra SP')
    && r.categorias.find((c) => c.name === 'Diversos').albums.length === 4,
    'e o destino é aceito nas DUAS grafias ("Diversas" do banco, "Diversos" do '
    + 'pedido) — normalizar não liga uma à outra', nomes(r.categorias));
}

// ── 6. NÃO MUTA A ENTRADA ───────────────────────────────────────────────────
{
  const entrada = catalogo();
  const copia = JSON.parse(JSON.stringify(entrada));
  C.aplicar(entrada);
  checar(JSON.stringify(entrada) === JSON.stringify(copia),
    'a regra NÃO muta a entrada: o catálogo cru continua cru (é ele que está '
    + 'gravado no aparelho, e é por isso que um ajuste chega por OTA)');
  // E IDEMPOTENTE: a regra roda a cada desenho da Biblioteca, e um redesenho
  // durante um download acontece a cada 400 ms.
  const uma = C.aplicar(catalogo()).categorias;
  const duas = C.aplicar(uma).categorias;
  checar(JSON.stringify(uma) === JSON.stringify(duas),
    'e ela é IDEMPOTENTE — a Biblioteca a reaplica a cada redesenho');
}

// ── 7. O `normalizar` CONCORDA COM O DO `serie.js` ──────────────────────────
// Os dois arquivos têm a mesma função escrita neles de propósito. Quem impede a
// divergência é esta comparação de FONTES — a técnica do `hinario.test.mjs`.
{
  const corpo = (src) => {
    const s = readFileSync(src, 'utf8');
    const i = s.indexOf('function normalizar(s) {');
    if (i < 0) return null;
    return s.slice(i, s.indexOf('\n  }', i) + 4).replace(/\s+/g, ' ');
  };
  const a = corpo(SRC);
  const b = corpo(SRC_SERIE);
  checar(!!a && !!b,
    'os dois arquivos continuam declarando `normalizar` — se um parar, esta '
    + 'comparação vira um no-op silencioso e é ESTE checar que avisa');
  checar(a === b, 'e as duas cópias de `normalizar` são idênticas (a duplicação '
    + 'é deliberada; a divergência é o que não pode passar)', { coletanea: a, serie: b });
}

console.log('');
if (falhas.length) {
  console.log(falhas.length + ' FALHA(S)');
  process.exit(1);
}
console.log('Todos passaram.');
