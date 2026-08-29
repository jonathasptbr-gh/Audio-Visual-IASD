#!/usr/bin/env node
// PARES (bloco de comentário → símbolo que ele encabeça).
//
// POR QUE ISTO EXISTE. A regra da poda era "remova os comentários dos dois
// lados, normalize o espaço e compare com `git show <ref>:<arquivo>`". Ela
// prova que nenhuma linha de CÓDIGO mudou — e é CEGA à troca de lugar: uma
// rotação completa dos blocos passa por ela sem um sinal. Foi o que aconteceu
// na v5.300 (commits 4ed5061 e da615b8): oito blocos do `display.js` andaram
// uma casa, e cada um passou a explicar a função errada. O bloco do relógio da
// origem foi parar dentro do `telaAplicarWallpaper`, e o da pré-carga do
// wallpaper, sobre o `agoraDaOrigem`.
//
// Um comentário no lugar errado é pior que um comentário removido: ele
// responde, e responde errado.
//
// USO
//   node tools/pares-de-comentario.mjs <arquivo>          # lista os pares
//   node tools/pares-de-comentario.mjs <arquivo> <ref>    # compara com o ref
//
// Na comparação, casa os blocos pelo CABEÇALHO (a primeira linha com conteúdo)
// e reprova quando o mesmo cabeçalho passou a encabeçar outro símbolo. Blocos
// condensados/removidos não acusam: só a MUDANÇA DE ALVO acusa.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const ehComentario = (l) => /^\s*(\/\/|\/\*|\*|#)/.test(l);
const ehVazia = (l) => /^\s*$/.test(l);

export function paresDe(texto) {
  const L = texto.split('\n');
  const out = [];
  let i = 0;
  while (i < L.length) {
    if (!ehComentario(L[i])) { i++; continue; }
    const ini = i;
    while (i < L.length && (ehComentario(L[i]) || ehVazia(L[i]))) {
      if (ehVazia(L[i]) && !(i + 1 < L.length && ehComentario(L[i + 1]))) break;
      i++;
    }
    let j = i;
    while (j < L.length && ehVazia(L[j])) j++;
    const alvo = j < L.length ? L[j].trim() : '(fim do arquivo)';
    const cab = (L.slice(ini, i)
      .map((l) => l.replace(/^\s*(\/\/|\/\*|\*|#)\s?/, '').trim())
      .find(Boolean)) || '';
    if (cab) out.push({ linha: ini + 1, cab, alvo });
  }
  return out;
}

const [arquivo, ref] = process.argv.slice(2);
if (!arquivo) {
  console.error('uso: node tools/pares-de-comentario.mjs <arquivo> [ref-git]');
  process.exit(2);
}
const agora = paresDe(fs.readFileSync(arquivo, 'utf8'));

if (!ref) {
  for (const p of agora) {
    console.log(`${String(p.linha).padStart(5)}  ${p.cab.slice(0, 68).padEnd(68)} -> ${p.alvo.slice(0, 70)}`);
  }
  console.log(`\n${agora.length} bloco(s).`);
  process.exit(0);
}

// `maxBuffer` explícito: o padrão do Node (1 MB) é MENOR que o `controle.js`, e
// o que sai é um `ENOBUFS` — a prova simplesmente não roda no maior arquivo do
// repositório, que é justamente onde ela mais importa.
const antes = paresDe(execFileSync('git', ['show', `${ref}:${arquivo}`],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
const porCab = new Map();
for (const p of antes) {
  const k = p.cab.slice(0, 46);
  if (!porCab.has(k)) porCab.set(k, []);
  porCab.get(k).push(p.alvo);
}
const trocados = [];
for (const p of agora) {
  const k = p.cab.slice(0, 46);
  const alvos = porCab.get(k);
  if (!alvos) continue;                                  // bloco novo: não é rotação
  if (alvos.some((a) => a.slice(0, 34) === p.alvo.slice(0, 34))) continue;
  trocados.push({ ...p, antes: alvos[0] });
}
for (const t of trocados) {
  console.log(`REPROVOU  ${arquivo}:${t.linha}`);
  console.log(`  bloco : ${t.cab.slice(0, 72)}`);
  console.log(`  antes → ${t.antes.slice(0, 72)}`);
  console.log(`  hoje  → ${t.alvo.slice(0, 72)}\n`);
}
if (trocados.length) {
  console.log(`${trocados.length} bloco(s) mudaram de ALVO — um comentário no lugar errado responde, e responde errado.`);
  process.exit(1);
}
console.log(`ok\t${arquivo}: ${agora.length} bloco(s), nenhum mudou de alvo em relação a ${ref}.`);
