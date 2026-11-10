#!/usr/bin/env node
// =============================================================================
// O MAPA DO MIOLO — perguntar antes de abrir
//
// O `controle/controle.js` tem ~46 mil linhas e 2,3 MB: NENHUMA sessão o lê
// inteiro, e procurar nele com `grep` devolve a linha mas não o que aquela
// linha é, nem quem depende dela. O custo de uma alteração nunca foi o tamanho
// do arquivo — é a LEITURA EM VOLTA: descobrir em que seção o nome mora, se ele
// é função ou estado, quem o chama e o que ele chama.
//
// Este comando responde a essas perguntas sem abrir o arquivo. A regra de uso:
// **pergunte aqui primeiro, e leia só a faixa que a resposta apontou.**
//
//   node tools/miolo.mjs fatias                as 9 fatias do arquivo
//   node tools/miolo.mjs secoes [--fatia N]    as seções, na ordem
//   node tools/miolo.mjs buscar <termo>        procura em nomes e títulos
//   node tools/miolo.mjs simbolo <nome>        onde o nome é declarado
//   node tools/miolo.mjs usa <nome>            quem referencia o nome
//   node tools/miolo.mjs estado [termo]        o estado de topo do módulo
//   node tools/miolo.mjs cortes                o que cada corte proposto cruza
//
// Nada aqui é escrito à mão além das ÂNCORAS: cada fatia começa numa FUNÇÃO
// nomeada, e a linha sai do próprio arquivo a cada execução. Se um lote
// renomear a função de âncora, o comando RECUSA e diz qual — é a única coisa
// que envelhece neste mapa, e ela falha alto em vez de apontar para o lugar
// errado. O oráculo `tools/miolo.test.mjs` cobra as âncoras no CI.
//
// O `acorn` já está no `package.json` do arnês e este comando é o primeiro a
// usá-lo; nada disto viaja no APK (`tools/` não entra no bundle).
//
// **E por isso o ORÁCULO dele não o executa.** Os oráculos de Node puro rodam
// no passo "Sanidade da base web", que vem ANTES do `npm ci` — ali `acorn`
// não existe (a razão inteira mora no cabeçalho de `checar.mjs`, e um import
// daqui reprovaria só no CI, que é o pior lugar). O `miolo.test.mjs` cobra as
// ÂNCORAS por texto: o que envelhece neste mapa é a âncora, e é ela que o CI
// precisa vigiar. O resto das perguntas o acorn responde na hora, aqui.
// =============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ALVO = path.join(RAIZ, 'app/src/main/assets/web/controle/controle.js');

// AS ÂNCORAS. Cada fatia começa na função nomeada; a primeira começa no arquivo.
// Os nomes vêm do corte proposto em `docs/revisao/PARTIR-O-MIOLO.md` e são
// funções que JÁ existiam na fronteira de cada capítulo da revisão de 2026-11.
const FATIAS = [
  { nome: 'abertura, preview, áudio', ancora: null },
  { nome: 'cena, fila, Bíblia, destinos', ancora: 'prepararMidia' },
  { nome: 'Ferramentas', ancora: 'chronoSetDuration' },
  { nome: 'Cronograma, Biblioteca, séries, favoritos', ancora: 'abrirNaFaixaDaLinha' },
  { nome: 'cifra, leitura, Modo Fácil, seleção', ancora: 'cifraNoDiscoVale' },
  { nome: 'acervo, busca, YouTube', ancora: 'ehSemana' },
  { nome: 'downloads, playlist automática, Registro', ancora: 'playSongVariant' },
  { nome: 'Transferir, share, via nativa, wallpaper', ancora: 'pacoteFonteDaUrl' },
  { nome: 'Configurações, modos, volume, telão', ancora: 'testeAlvo' },
];

// ---------------------------------------------------------------------------
// a leitura do arquivo, uma vez por execução
// ---------------------------------------------------------------------------
const FONTE = fs.readFileSync(ALVO, 'utf8');
const LINHAS = FONTE.split('\n');
const AST = parse(FONTE, {
  ecmaVersion: 'latest',
  locations: true,
  allowReturnOutsideFunction: true,
  allowAwaitOutsideFunction: true,
});

const ehFuncao = (n) => n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression';
const IGNORAR = new Set(['type', 'start', 'end', 'loc', 'raw', 'value', 'regex', 'bigint', 'sourceType', 'operator']);

function nomesDePadrao(p, out = []) {
  if (!p) return out;
  switch (p.type) {
    case 'Identifier': out.push(p.name); break;
    case 'ObjectPattern': for (const x of p.properties) nomesDePadrao(x.type === 'RestElement' ? x.argument : x.value, out); break;
    case 'ArrayPattern': for (const e of p.elements) nomesDePadrao(e, out); break;
    case 'AssignmentPattern': nomesDePadrao(p.left, out); break;
    case 'RestElement': nomesDePadrao(p.argument, out); break;
    default: break;
  }
  return out;
}

// Os nomes que uma função declara (parâmetros e tudo o que nasce dentro dela).
// É aproximação de propósito: erra só para baixo, e para baixo o mapa continua
// respondendo "aqui dentro é local" — que é o que se quer saber.
function declaradosDentro(fn) {
  const nomes = new Set();
  for (const p of fn.params) for (const x of nomesDePadrao(p, [])) nomes.add(x);
  const pilha = [fn.body];
  while (pilha.length) {
    const n = pilha.pop();
    if (!n || typeof n !== 'object') continue;
    if (n !== fn.body && ehFuncao(n)) { if (n.id) nomes.add(n.id.name); continue; }
    if ((n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') && n.id) nomes.add(n.id.name);
    if (n.type === 'VariableDeclaration') for (const d of n.declarations) for (const x of nomesDePadrao(d.id, [])) nomes.add(x);
    for (const k in n) { if (IGNORAR.has(k)) continue; const v = n[k]; if (v && typeof v === 'object') pilha.push(v); }
  }
  return nomes;
}

function identificadores(n, out = []) {
  if (!n || typeof n !== 'object') return out;
  if (Array.isArray(n)) { for (const c of n) identificadores(c, out); return out; }
  if (n.type === 'Identifier') out.push({ nome: n.name, linha: n.loc.start.line });
  for (const k in n) {
    if (IGNORAR.has(k)) continue;
    const v = n[k];
    if (v && typeof v === 'object') identificadores(v, out);
  }
  return out;
}

// ---------------------------------------------------------------------------
// o índice: o que nasce no topo do arquivo
// ---------------------------------------------------------------------------
const NOMES = new Map(); // nome -> { linha, fim, tipo, fatia }
const UNIDADES = []; // cada função ou bloco executado no carregamento

function fatiaDaLinha(linha) {
  for (let i = FATIAS.length - 1; i >= 0; i--) if (linha >= FATIAS[i].de) return i + 1;
  return 1;
}

const SECOES = [];
for (let i = 0; i < LINHAS.length; i++) {
  if (/^\/\/ ={3,}/.test(LINHAS[i])) {
    SECOES.push({
      linha: i + 1,
      titulo: LINHAS[i].replace(/^\/\/\s*=+\s*/, '').replace(/\s*=+\s*$/, '').trim(),
    });
  }
}

// as âncoras viram linhas AQUI, e é o único ponto que pode envelhecer
for (let i = 1; i < FATIAS.length; i++) {
  const f = FATIAS[i];
  const decl = AST.body.find((n) => n.type === 'FunctionDeclaration' && n.id && n.id.name === f.ancora);
  if (!decl) {
    console.error(`miolo: a âncora "${f.ancora}" (fatia ${i + 1}) não existe mais no controle.js.`);
    console.error('       Um lote renomeou ou apagou a função. Atualize as ÂNCORAS em tools/miolo.mjs');
    console.error('       (a função seguinte à fronteira serve) — e o mapa volta a apontar certo.');
    process.exit(2);
  }
  // a fatia começa no COMENTÁRIO da função, não na função: o bloco de razão que
  // explica o código pertence ao código, e um corte no meio dele perderia o porquê
  let inicio = decl.loc.start.line;
  while (inicio > 1) {
    const anterior = LINHAS[inicio - 2].trim();
    if (anterior === '' || anterior.startsWith('//')) inicio--;
    else break;
  }
  f.de = inicio;
}
FATIAS[0].de = 1;
for (const f of FATIAS) f.ate = Number.POSITIVE_INFINITY;
for (let i = 0; i < FATIAS.length - 1; i++) FATIAS[i].ate = FATIAS[i + 1].de - 1;
FATIAS[FATIAS.length - 1].ate = LINHAS.length;

function secoesEntre(de, ate) {
  return SECOES.filter((s) => s.linha >= de && s.linha <= ate);
}
function secaoDaLinha(linha) {
  let achada = null;
  for (const s of SECOES) { if (s.linha <= linha) achada = s; else break; }
  return achada;
}

for (const n of AST.body) {
  if (n.type === 'FunctionDeclaration' && n.id) {
    NOMES.set(n.id.name, { linha: n.loc.start.line, fim: n.loc.end.line, tipo: 'função' });
  } else if (n.type === 'VariableDeclaration') {
    for (const d of n.declarations) {
      const tipo = d.init && ehFuncao(d.init) ? 'função' : 'estado';
      for (const nome of nomesDePadrao(d.id, [])) {
        NOMES.set(nome, { linha: n.loc.start.line, fim: n.loc.end.line, tipo });
      }
    }
  } else if (n.type === 'ClassDeclaration' && n.id) {
    NOMES.set(n.id.name, { linha: n.loc.start.line, fim: n.loc.end.line, tipo: 'classe' });
  }
}
for (const [nome, d] of NOMES) d.fatia = fatiaDaLinha(d.linha);

// as unidades e as referências: quem lê quem
for (const n of AST.body) {
  if (n.type === 'FunctionDeclaration' && n.id) {
    const locais = declaradosDentro(n);
    const refs = identificadores(n.body)
      .filter((r) => NOMES.has(r.nome) && !locais.has(r.nome) && r.nome !== n.id.name);
    UNIDADES.push({ tipo: 'função', nome: n.id.name, de: n.loc.start.line, ate: n.loc.end.line, refs });
  } else if (!['VariableDeclaration', 'ClassDeclaration', 'EmptyStatement'].includes(n.type)) {
    // o que roda no carregamento: interessa saber o que ele chama, porque é ali
    // que a ORDEM dos arquivos deixa de ser cosmética e vira defeito
    const refs = identificadores(n).filter((r) => NOMES.has(r.nome));
    UNIDADES.push({ tipo: 'arranque', nome: `${n.type} na linha ${n.loc.start.line}`, de: n.loc.start.line, ate: n.loc.end.line, refs });
  }
}

// o índice reverso: nome -> quem o referencia
const USOS = new Map();
for (const u of UNIDADES) {
  const vistos = new Set();
  for (const r of u.refs) {
    if (vistos.has(r.nome)) continue;
    vistos.add(r.nome);
    if (!USOS.has(r.nome)) USOS.set(r.nome, []);
    USOS.get(r.nome).push({ linha: r.linha, de: u });
  }
}

// ---------------------------------------------------------------------------
// a saída
// ---------------------------------------------------------------------------
const semAcento = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const achar = (termo) => {
  const alvo = semAcento(termo);
  const nomes = [...NOMES.entries()].filter(([n]) => semAcento(n).includes(alvo));
  const secoes = SECOES.filter((s) => semAcento(s.titulo).includes(alvo));
  return { nomes, secoes };
};

const comandos = {
  fatias() {
    console.log(`controle.js · ${LINHAS.length} linhas · ${NOMES.size} nomes de topo · ${SECOES.length} seções\n`);
    for (const [i, f] of FATIAS.entries()) {
      const funs = [...NOMES.values()].filter((d) => d.linha >= f.de && d.linha <= f.ate && d.tipo === 'função').length;
      const linhas = f.ate - f.de + 1;
      console.log(`  ${i + 1}. ${f.nome}`);
      console.log(`     linhas ${f.de}–${f.ate} (${linhas}) · ${funs} funções · ${secoesEntre(f.de, f.ate).length} seções`);
      if (f.ancora) console.log(`     começa em ${f.ancora}()`);
      console.log('');
    }
  },

  secoes(args) {
    const pedido = args.indexOf('--fatia');
    const qual = pedido >= 0 ? Number(args[pedido + 1]) : null;
    const lista = SECOES.filter((s) => {
      if (!qual) return true;
      const f = FATIAS[qual - 1];
      if (!f) { console.error(`não existe fatia ${qual} (1..${FATIAS.length})`); process.exit(2); }
      return s.linha >= f.de && s.linha <= f.ate;
    });
    for (const s of lista) {
      const d = qual ? '' : `  [fatia ${fatiaDaLinha(s.linha)}]`;
      console.log(`${String(s.linha).padStart(6)}  ${s.titulo || '(sem título)'}${d}`);
    }
    console.log(`\n${lista.length} seção(ões).`);
  },

  buscar(args) {
    const termo = args.filter((a) => !a.startsWith('--')).join(' ');
    if (!termo) { console.error('uso: miolo.mjs buscar <termo>'); process.exit(2); }
    const { nomes, secoes } = achar(termo);
    if (secoes.length) {
      console.log(`-- SEÇÕES (${secoes.length}) --`);
      for (const s of secoes) console.log(`${String(s.linha).padStart(6)}  ${s.titulo}  [fatia ${fatiaDaLinha(s.linha)}]`);
      console.log('');
    }
    if (nomes.length) {
      console.log(`-- NOMES (${nomes.length}) --`);
      for (const [n, d] of nomes) {
        const usos = (USOS.get(n) ?? []).length;
        console.log(`${String(d.linha).padStart(6)}  ${n}  (${d.tipo}, até ${d.fim}, ${usos} uso(s), fatia ${d.fatia})`);
      }
    }
    if (!secoes.length && !nomes.length) console.log(`nada com "${termo}".`);
  },

  simbolo(args) {
    const nome = args[0];
    if (!nome) { console.error('uso: miolo.mjs simbolo <nome>'); process.exit(2); }
    const d = NOMES.get(nome);
    if (!d) {
      const { nomes } = achar(nome);
      console.log(`"${nome}" não é nome de topo. Parecidos:`);
      for (const [n, x] of nomes.slice(0, 12)) console.log(`  ${String(x.linha).padStart(6)}  ${n} (${x.tipo})`);
      process.exit(1);
    }
    const secao = secaoDaLinha(d.linha);
    const usos = USOS.get(nome) ?? [];
    console.log(`${nome} — ${d.tipo}`);
    console.log(`  linhas ${d.linha}–${d.fim} (${d.fim - d.linha + 1}) · fatia ${d.fatia}: ${FATIAS[d.fatia - 1].nome}`);
    if (secao) console.log(`  seção: ${secao.titulo || '(sem título)'}`);
    console.log(`  usado em ${usos.length} lugar(es)`);
    for (const u of usos.slice(0, 20)) console.log(`    ${String(u.linha).padStart(6)}  em ${u.de.nome}`);
    if (usos.length > 20) console.log(`    … e mais ${usos.length - 20}`);
    const unidade = UNIDADES.find((u) => u.tipo === 'função' && u.nome === nome);
    if (unidade) {
      const chama = [...new Set(unidade.refs.filter((r) => NOMES.get(r.nome).tipo === 'função').map((r) => r.nome))];
      console.log(`  chama ${chama.length} função(ões) do topo${chama.length ? ': ' + chama.slice(0, 12).join(', ') + (chama.length > 12 ? '…' : '') : ''}`);
    }
  },

  usa(args) {
    const nome = args[0];
    if (!nome) { console.error('uso: miolo.mjs usa <nome>'); process.exit(2); }
    const usos = USOS.get(nome);
    if (!usos) { console.log(`ninguém referencia "${nome}".`); return; }
    console.log(`${nome}: ${usos.length} referência(s)\n`);
    for (const u of usos) {
      const s = secaoDaLinha(u.linha);
      console.log(`${String(u.linha).padStart(6)}  ${u.de.nome}  [fatia ${fatiaDaLinha(u.linha)}]${s ? ' · ' + (s.titulo || '(sem título)') : ''}`);
    }
  },

  estado(args) {
    const termo = args.filter((a) => !a.startsWith('--')).join(' ');
    const alvo = termo ? semAcento(termo) : null;
    const lista = [...NOMES.entries()].filter(([n, d]) => d.tipo === 'estado' && (!alvo || semAcento(n).includes(alvo)));
    const porFatia = new Map();
    for (const [n, d] of lista) {
      if (!porFatia.has(d.fatia)) porFatia.set(d.fatia, []);
      porFatia.get(d.fatia).push([n, d]);
    }
    console.log(`${lista.length} nome(s) de estado de topo.\n`);
    for (const [f, itens] of [...porFatia].sort((a, b) => a[0] - b[0])) {
      console.log(`fatia ${f} — ${FATIAS[f - 1].nome} (${itens.length})`);
      for (const [n, d] of itens) console.log(`  ${String(d.linha).padStart(6)}  ${n}`);
      console.log('');
    }
  },

  cortes() {
    // o que cada fronteira cruza hoje: quantos nomes um lado usa do outro
    const emFatia = (d) => d.fatia;
    console.log('fronteira            nomes que atravessam (ida + volta)');
    for (let i = 0; i < FATIAS.length - 1; i++) {
      const a = i + 1, b = i + 2;
      let ida = 0, volta = 0;
      for (const u of UNIDADES) {
        const de = fatiaDaLinha(u.de);
        for (const r of new Set(u.refs.map((r) => r.nome))) {
          const para = emFatia(NOMES.get(r));
          if (de === a && para === b) ida++;
          if (de === b && para === a) volta++;
        }
      }
      console.log(`  ${String(a).padStart(2)} | ${String(b).padStart(2)}  ${String(a)}→${b}: ${String(ida).padStart(4)}   ${b}→${a}: ${String(volta).padStart(4)}   (${ida + volta})`);
    }
  },
};

const [comando, ...resto] = process.argv.slice(2);
if (!comando || !comandos[comando]) {
  console.error('uso: node tools/miolo.mjs <fatias|secoes|buscar|simbolo|usa|estado|cortes> [args]');
  process.exit(2);
}
comandos[comando](resto);
