#!/usr/bin/env node
// ============================================================================
// AS ÂNCORAS DO MAPA DO MIOLO — o único número escrito à mão no `miolo.mjs`
//
// ## Por que ele existe
//
// `tools/miolo.mjs` não guarda linha nenhuma: cada fatia começa numa FUNÇÃO
// nomeada, e a linha sai do `controle.js` a cada execução. É o que faz o mapa
// sobreviver a um lote que insere 300 linhas em qualquer lugar — e é também o
// único ponto que pode APODRECER: um lote renomeia `playSongVariant` e o mapa
// passa a apontar para o nada (ou, pior, a recusar-se a abrir).
//
// O custo é pequeno e o defeito é mudo: quem abre o mapa no dia seguinte não
// sabe se a fatia "downloads" acabou no lugar certo ou se a âncora sumiu e o
// comando só não rodou. Este oráculo fecha as duas pontas — a âncora existe no
// controle.js, está no topo do arquivo (coluna 0), e as nove fatias continuam
// na ORDEM do arquivo, que é a premissa de todo o desenho.
//
// ## Por que ele NÃO executa o `miolo.mjs`
//
// O comando importa `acorn`. Os oráculos de Node puro rodam antes do `npm ci`,
// e lá não há `node_modules` — ver o cabeçalho de `checar.mjs`, que existe
// exatamente por causa dessa ordem. Um oráculo que importasse o comando
// passaria nesta máquina e reprovaria só no CI.
//
// ## A terceira pergunta: o mapa está DOCUMENTADO?
//
// Ninguém usa o que não sabe que existe. `docs/arquitetura/MIOLO.md` é a porta
// de entrada, e ela precisa citar o comando e os sete subcomandos — senão o
// mapa vira um arquivo solto em `tools/` que só quem escreveu lembra.
//
//   node tools/miolo.test.mjs
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checar, falhas } from './checar.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FERRAMENTA = path.join(RAIZ, 'tools/miolo.mjs');
const MIOLO = path.join(RAIZ, 'app/src/main/assets/web/controle/controle.js');
const DOC = path.join(RAIZ, 'docs/arquitetura/MIOLO.md');

const ferramenta = fs.readFileSync(FERRAMENTA, 'utf8');
const miolo = fs.readFileSync(MIOLO, 'utf8');
const linhas = miolo.split('\n');

// ---------------------------------------------------------------------------
// 1. As fatias declaradas × as âncoras que elas apontam
// ---------------------------------------------------------------------------
const fatias = [...ferramenta.matchAll(/\{\s*nome:\s*'([^']+)',\s*ancora:\s*(null|'([^']+)')\s*\}/g)]
  .map((m) => ({ nome: m[1], ancora: m[3] ?? null }));

checar(fatias.length === 9, 'premissa: as nove fatias foram lidas do `miolo.mjs`', fatias.map((f) => f.nome).join(' | '));
checar(fatias[0]?.ancora === null && fatias.slice(1).every((f) => typeof f.ancora === 'string'),
  'a primeira fatia começa no arquivo (sem âncora) e as outras oito apontam para uma função', JSON.stringify(fatias.map((f) => f.ancora)));

const ancoras = fatias.slice(1).map((f) => f.ancora);
const repetidas = ancoras.filter((a, i) => ancoras.indexOf(a) !== i);
checar(repetidas.length === 0, 'nenhuma âncora se repete', repetidas.join(', '));

// ---------------------------------------------------------------------------
// 2. Cada âncora existe como função de TOPO no controle.js
//
// Coluna 0 é o que separa a função de topo de qualquer função interna — e é
// também o que garante que o corte cai num lugar onde dá para cortar: não há
// como começar uma fatia no meio do corpo de outra função.
// ---------------------------------------------------------------------------
const ondeEstao = [];
for (const nome of ancoras) {
  const re = new RegExp('^(?:async\\s+)?function\\s+' + nome.replace(/\$/g, '\\$') + '\\s*\\(', 'm');
  const m = re.exec(miolo);
  if (!m) continue;
  const linha = miolo.slice(0, m.index).split('\n').length;
  ondeEstao.push({ nome, linha });
}
const faltando = ancoras.filter((a) => !ondeEstao.some((o) => o.nome === a));
checar(faltando.length === 0,
  'toda âncora é uma `function` de coluna 0 no controle.js — âncora renomeada é mapa apontando para o nada',
  faltando.join(', '));

// ---------------------------------------------------------------------------
// 3. Elas estão na ORDEM do arquivo
//
// A fatia N-1 termina onde a N começa. Fora de ordem, o mapa desenha faixas
// com começo depois do fim, e o `fatias` imprime umas sobre as outras sem
// reclamar — defeito de leitura, não de sintaxe.
// ---------------------------------------------------------------------------
const foraDeOrdem = ondeEstao.filter((o, i) => i > 0 && o.linha <= ondeEstao[i - 1].linha);
checar(foraDeOrdem.length === 0 && ondeEstao.length === ancoras.length,
  'as âncoras aparecem no arquivo na ordem em que as fatias são carregadas',
  ondeEstao.map((o) => `${o.nome}@${o.linha}`).join(' '));

// ---------------------------------------------------------------------------
// 4. O documento existe e ensina os sete comandos
// ---------------------------------------------------------------------------
const docTexto = fs.existsSync(DOC) ? fs.readFileSync(DOC, 'utf8') : '';
checar(docTexto.length > 0, 'a porta de entrada existe: docs/arquitetura/MIOLO.md');

const implementados = [...ferramenta.matchAll(/^ {2}([a-z]+)\((?:args)?\) \{/gm)].map((m) => m[1]);
checar(implementados.length >= 7, 'premissa: os subcomandos foram lidos do `miolo.mjs`', implementados.join(', '));

const naoDocumentados = implementados.filter((c) => !docTexto.includes(`miolo.mjs ${c}`));
checar(naoDocumentados.length === 0,
  'todo subcomando está escrito no documento, com a linha de uso inteira',
  naoDocumentados.join(', '));

checar(linhas.length > 30000,
  'premissa: o controle.js continua sendo o arquivo grande que justifica o mapa',
  String(linhas.length));

if (falhas.length) { console.log(`\n${falhas.length} falha(s)`); process.exit(1); }
console.log('\nmiolo: OK — ' + ancoras.length + ' âncoras, ' + implementados.length + ' subcomandos');
