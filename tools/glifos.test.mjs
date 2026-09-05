#!/usr/bin/env node
// ============================================================================
// TODO ÍCONE DE FONTE TEM DE EXISTIR NA FONTE
//
// ## Por que ele existe
//
// `shared/fonts/material-symbols.woff2` é um **subset** — 31 codepoints, não a
// família inteira. Um `<span class="msym">&#xNNNN;</span>` cujo codepoint não
// entrou nesse subset **não desenha nada**: sem erro no console, sem requisição
// falhando, sem nada na tela além de um vão do tamanho de um ícone. O botão
// existe, é tocável, faz o que promete — e é invisível.
//
// Não é hipótese. Foi assim que o botão da **playlist automática** saiu ao ar
// com `casino` (e30c), que não está no subset: o operador relatou *"o botão
// dele está sem ícone ou texto"*. Antes dele, `edit`, `folder_open` e
// `create_new_folder` deram o mesmo vão, e a resposta foi desenhá-los à mão
// (ver `pencilIconSvg` e o sprite `#ico*` no `index.html`). O que faltava era
// a pergunta ser feita por uma máquina, uma vez por lote, em vez de por alguém
// que reparou.
//
// ## O que ele varre
//
// Todo `&#xNNNN;` dentro de um `class="msym"` no HTML e todo codepoint da
// tabela `ICON` do `controle.js` — as duas fontes de glifo do bundle. Cada um
// é conferido contra o `cmap` da fonte de verdade, lido aqui.
//
// ## Por que ler o woff2 à mão, e não medir num navegador
//
// Porque isto tem de BARRAR O BUILD. Um ícone invisível chega à frota pelo
// canal OTA e só é descoberto por quem opera; o passo de Chromium é
// `continue-on-error` por política do projeto, e ali a reprovação seria um
// aviso. Node puro entra no passo que barra — e não precisa de navegador para
// responder uma pergunta que é sobre um arquivo.
//
// woff2 = cabeçalho + diretório de tabelas + UM blob brotli com as tabelas em
// sequência. `zlib.brotliDecompressSync` vem no Node; `glyf`/`loca` são
// transformadas e o resto viaja verbatim, então o `cmap` é fatiado direto do
// stream. Zero dependência, que é a regra deste repositório.
//
//   node tools/glifos.test.mjs
// ============================================================================
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { brotliDecompressSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { checar, falhas } from './checar.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = join(raiz, 'app/src/main/assets/web');
const FONTE = join(WEB, 'shared/fonts/material-symbols.woff2');

// ---- O woff2 -------------------------------------------------------------
// A ordem canônica dos 63 tags conhecidos: o diretório referencia um tag por
// ÍNDICE nesta lista (o valor 63 significa "os 4 bytes do tag vêm a seguir").
const TAGS = [
  'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm',
  'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern',
  'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC',
  'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar',
  'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty',
  'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat',
  'Gloc', 'Feat', 'Sill',
];

// UIntBase128: 7 bits por byte, o bit alto marca "continua".
function lerBase128(buf, pos) {
  let v = 0;
  for (let i = 0; i < 5; i++) {
    const b = buf[pos++];
    if (i === 0 && b === 0x80) throw new Error('UIntBase128 com zero à esquerda');
    v = (v << 7) | (b & 0x7f);
    if ((b & 0x80) === 0) return [v >>> 0, pos];
  }
  throw new Error('UIntBase128 longo demais');
}

// Devolve o buffer da tabela pedida, já descomprimida.
function tabelaDoWoff2(buf, alvo) {
  if (buf.toString('latin1', 0, 4) !== 'wOF2') throw new Error('não é woff2');
  const numTables = buf.readUInt16BE(12);
  const totalCompressedSize = buf.readUInt32BE(20);
  let pos = 48;
  const dir = [];
  for (let i = 0; i < numTables; i++) {
    const flags = buf[pos++];
    const idx = flags & 0x3f;
    let tag;
    if (idx === 63) { tag = buf.toString('latin1', pos, pos + 4); pos += 4; }
    else tag = TAGS[idx];
    let origLength; [origLength, pos] = lerBase128(buf, pos);
    // O comprimento NO STREAM é o transformado quando há transformação. Ela só
    // existe para `glyf`/`loca` (versão 0 = transformada) e, para as demais,
    // quando a versão de transformação é diferente de 0.
    const versao = (flags >> 6) & 0x03;
    const transformada = (tag === 'glyf' || tag === 'loca') ? versao === 0 : versao !== 0;
    let noStream = origLength;
    if (transformada) [noStream, pos] = lerBase128(buf, pos);
    dir.push({ tag, noStream });
  }
  const stream = brotliDecompressSync(buf.subarray(pos, pos + totalCompressedSize));
  let off = 0;
  for (const t of dir) {
    if (t.tag === alvo) return stream.subarray(off, off + t.noStream);
    off += t.noStream;
  }
  throw new Error('tabela ' + alvo + ' ausente');
}

// cmap → o conjunto de codepoints COBERTOS (os que mapeiam para um glifo ≠ 0).
function codepointsDoCmap(cmap) {
  const cobertos = new Set();
  const n = cmap.readUInt16BE(2);
  for (let i = 0; i < n; i++) {
    const off = cmap.readUInt32BE(4 + i * 8 + 4);
    const formato = cmap.readUInt16BE(off);
    if (formato === 4) {
      const segX2 = cmap.readUInt16BE(off + 6);
      const seg = segX2 / 2;
      const fim = off + 14;
      const ini = fim + segX2 + 2;
      const delta = ini + segX2;
      const range = delta + segX2;
      for (let s = 0; s < seg; s++) {
        const c0 = cmap.readUInt16BE(ini + s * 2);
        const c1 = cmap.readUInt16BE(fim + s * 2);
        if (c0 === 0xffff) continue;
        const d = cmap.readInt16BE(delta + s * 2);
        const ro = cmap.readUInt16BE(range + s * 2);
        for (let c = c0; c <= c1 && c !== 0x10000; c++) {
          let g;
          if (ro === 0) g = (c + d) & 0xffff;
          else {
            const p = range + s * 2 + ro + (c - c0) * 2;
            if (p + 1 >= cmap.length) continue;
            g = cmap.readUInt16BE(p);
            if (g) g = (g + d) & 0xffff;
          }
          if (g) cobertos.add(c);
        }
      }
    } else if (formato === 12) {
      const grupos = cmap.readUInt32BE(off + 12);
      for (let g = 0; g < grupos; g++) {
        const b = off + 16 + g * 12;
        const c0 = cmap.readUInt32BE(b);
        const c1 = cmap.readUInt32BE(b + 4);
        const gid = cmap.readUInt32BE(b + 8);
        for (let c = c0; c <= c1; c++) if (gid + (c - c0)) cobertos.add(c);
      }
    }
  }
  return cobertos;
}

let cobertos;
try {
  cobertos = codepointsDoCmap(tabelaDoWoff2(readFileSync(FONTE), 'cmap'));
} catch (e) {
  checar(false, 'a fonte de ícones pôde ser lida (' + e.message + ')');
  console.log('\n1 FALHA(S)');
  process.exit(1);
}

// VERDE POR VÁCUO É INDISTINGUÍVEL DE LEITOR QUEBRADO: se o `cmap` deixar de
// ser lido, tudo abaixo aprova por não achar nada em que reprovar.
checar(cobertos.size >= 10,
  'o cmap da fonte foi lido e tem glifos (' + cobertos.size + ')', cobertos.size);
// Duas âncoras que o app usa desde sempre: o ✕ de toda folha e o ▶ do
// transporte. Se estas duas sumirem, o leitor está errado — não a fonte.
checar(cobertos.has(0xe14c) && cobertos.has(0xe037),
  'e ele enxerga os dois glifos que o app usa desde sempre (✕ e ▶)');

// ---- Os codepoints que o bundle PEDE --------------------------------------
// A VARREDURA É DA BASE INTEIRA, não dos dois arquivos que hoje têm glifo. Só o
// Controle usa `.msym` neste momento — o Display é wallpaper e mídia, e diz
// isso num comentário —, mas um oráculo que confia nisso deixa de cobrir o dia
// em que deixar de ser verdade, que é exatamente quando ele faria falta.
function arquivosWeb(dir, out = []) {
  for (const nome of readdirSync(dir)) {
    if (nome === 'vendor') continue;   // código de terceiro, com o próprio LEIA-ME
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) arquivosWeb(p, out);
    else if (/\.(html|js)$/.test(nome)) out.push(p);
  }
  return out;
}
const ARQUIVOS = arquivosWeb(WEB);

const pedidos = new Map();   // codepoint → [onde…]
const anotar = (cp, onde) => {
  if (!pedidos.has(cp)) pedidos.set(cp, []);
  pedidos.get(cp).push(onde);
};

// 1. O HTML: `<span class="msym" …>&#xNNNN;</span>`. A classe é exigida — um
//    `&#x…;` solto no meio de um comentário ou de um texto não é ícone.
const reMsym = /class="[^"]*\bmsym\b[^"]*"[^>]*>\s*&#x([0-9a-fA-F]{4,6});/g;
for (const arq of ARQUIVOS.filter((a) => a.endsWith('.html'))) {
  const txt = readFileSync(arq, 'utf8');
  const curto = arq.slice(WEB.length + 1);
  for (let m; (m = reMsym.exec(txt));) {
    anotar(parseInt(m[1], 16), curto + ':' + (txt.slice(0, m.index).split('\n').length));
  }
}
const js = readFileSync(join(WEB, 'controle/controle.js'), 'utf8');

// 2. A tabela `ICON` do `controle.js`, que é de onde sai todo `msym(ICON.x)`.
//    Ali os glifos são o CARACTERE literal, não uma entidade.
const bloco = js.match(/const ICON = \{[\s\S]*?\n\};/);
if (bloco) {
  const reIcon = /^\s*(\w+):\s*'([^']+)'/gm;
  for (let m; (m = reIcon.exec(bloco[0]));) {
    anotar(m[2].codePointAt(0), 'controle.js ICON.' + m[1]);
  }
}

checar(pedidos.size >= 15,
  'a varredura achou os codepoints do bundle (' + pedidos.size + ')', pedidos.size);
checar([...pedidos.keys()].includes(0xe14c),
  'e ela enxerga o ✕ das folhas — a prova de que o padrão do HTML casa');
checar(ARQUIVOS.length >= 6,
  'e a varredura alcança a base inteira, não só o Controle (' + ARQUIVOS.length + ' arquivo(s))',
  ARQUIVOS.length);
checar(!!bloco && [...pedidos.values()].some((v) => v.some((o) => o.startsWith('controle.js'))),
  'e a tabela ICON do controle.js também foi lida');

// ============================================================================
// A OUTRA FONTE DE ÍCONE DO BUNDLE: O SPRITE (v1.7.6)
//
// O `.msym` é metade do desenho deste app; a outra é o sprite `<symbol id="ico…">`
// do `controle/index.html`, consumido por `<use href="#ico…">`. **O modo de
// falhar é o MESMO deste arquivo, palavra por palavra**: um `<use>` que aponta
// para um símbolo inexistente não desenha NADA — sem erro no console, sem
// requisição falhando —, e o botão continua existindo, tocável, fazendo o que
// promete e invisível.
//
// A operação que o produz é a RENOMEAÇÃO, e ela acabou de acontecer: a v1.7.6
// trocou o `#icoGirar` do tile do giro pelo `#icoPaisagem`. Um `<use>` esquecido
// ali sai no bundle do OTA e chega à frota.
//
// E O CONTRÁRIO TAMBÉM É VARRIDO: um `<symbol>` sem consumidor não erra alto —
// ele só viaja em todo aparelho sem desenhar nada em lugar nenhum —, e a regra
// deste repositório é apagar o desenho junto com o recurso (foi assim que os
// `icoMedicao*` saíram na v1.4.42). Sem oráculo, "renomeei o consumidor" e
// "renomeei os dois" passam iguais.
//
// SÃO DUAS ENTRADAS, e as duas são literais: o `<use href="#…">` do HTML e as
// chamadas de `pacoteIconeSvg('ico…')` do `controle.js`, que montam o mesmo
// `<use>` por string.
// ============================================================================
const html = readFileSync(join(WEB, 'controle/index.html'), 'utf8');

const definidos = new Map();
{
  const re = /<symbol id="(ico[A-Za-z0-9_]*)"/g;
  for (let m; (m = re.exec(html));) {
    definidos.set(m[1], html.slice(0, m.index).split('\n').length);
  }
}

const usados = new Map();
const anotarUso = (nome, onde) => {
  if (!usados.has(nome)) usados.set(nome, []);
  usados.get(nome).push(onde);
};
{
  const re = /href="#(ico[A-Za-z0-9_]*)"/g;
  for (let m; (m = re.exec(html));) {
    anotarUso(m[1], 'controle/index.html:' + html.slice(0, m.index).split('\n').length);
  }
  // O `<use>` montado por string no JS — mesma árvore, mesmo modo de falhar.
  const re2 = /(?:href="#|pacoteIconeSvg\(')(ico[A-Za-z0-9_]*)/g;
  for (let m; (m = re2.exec(js));) {
    anotarUso(m[1], 'controle.js:' + js.slice(0, m.index).split('\n').length);
  }
}

checar(definidos.size >= 20,
  'o sprite foi lido (' + definidos.size + ' símbolo(s))', definidos.size);
checar(usados.size >= 20,
  'e os consumidores também (' + usados.size + ' nome(s) pedidos)', usados.size);
// A PROVA DE QUE AS DUAS ENTRADAS FORAM LIDAS, e não só a do HTML: sem ela um
// regex quebrado do lado do JS deixaria a varredura passar medindo metade.
checar([...usados.values()].some((v) => v.some((o) => o.startsWith('controle.js'))),
  'e o `<use>` que o `controle.js` monta por string entrou na conta');

const semSimbolo = [...usados.entries()].filter(([n]) => !definidos.has(n));
for (const [nome, onde] of semSimbolo) {
  console.log('FALHOU  <use href="#' + nome + '"> não tem `<symbol>` no sprite'
    + ' — sai como um VÃO, sem erro nenhum'
    + '\n        pedido em: ' + [...new Set(onde)].join(', ')
    + '\n        conserto: desenhe o `<symbol id="' + nome + '">` no'
    + ' index.html, ou aponte o `<use>` para o nome que existe');
  falhas.push('#' + nome + ' sem símbolo');
}
const semUso = [...definidos.keys()].filter((n) => !usados.has(n));
for (const nome of semUso) {
  console.log('FALHOU  <symbol id="' + nome + '"> não tem consumidor'
    + ' — ele viaja no bundle do OTA em todo aparelho sem desenhar nada'
    + '\n        conserto: apague o desenho junto com o recurso que o usava');
  falhas.push('#' + nome + ' órfão');
}
if (!semSimbolo.length && !semUso.length) {
  console.log('ok      os ' + definidos.size + ' símbolos do sprite e os '
    + usados.size + ' nomes pedidos batem, nos dois sentidos');
}

// ---- O VEREDITO -----------------------------------------------------------
const ausentes = [...pedidos.entries()].filter(([cp]) => !cobertos.has(cp));
for (const [cp, onde] of ausentes) {
  console.log('FALHOU  U+' + cp.toString(16).toUpperCase()
    + ' não está no subset da fonte — sai como um VÃO, sem erro nenhum'
    + '\n        pedido em: ' + [...new Set(onde)].join(', ')
    + '\n        conserto: desenhe-o (um `<symbol id="ico…">` no sprite do'
    + ' index.html, como o `#icoSorteio`) em vez de acrescentá-lo à fonte');
  falhas.push('U+' + cp.toString(16).toUpperCase() + ' fora do subset');
}
if (!ausentes.length) {
  console.log('ok      todos os ' + pedidos.size
    + ' codepoints pedidos pelo bundle existem no subset da fonte');
}

console.log('\n' + (falhas.length ? falhas.length + ' FALHA(S)' : 'tudo certo'));
process.exit(falhas.length ? 1 : 0);
