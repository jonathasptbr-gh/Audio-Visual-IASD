// `AVDB.updateState` — a leitura e a escrita de uma chave de `state` na MESMA
// transação.
//
// ## Por que este teste existe
//
// Porque o defeito que ele trava não tem sintoma no lugar em que acontece. O
// par `getState` + calcular + `setState` são DUAS transações com um vão entre
// elas: quem lê primeiro grava por último e apaga o que o outro acabou de
// escrever — sem exceção, sem log e sem nada na tela. O que aparece é longe
// dali, e parece outra coisa:
//
//  - o DIÁRIO da varredura das séries (`serieDiag:<id>`) é gravado em DUAS
//    metades — a do canal e a dos vídeos — e duas varreduras da mesma série
//    correm juntas com facilidade (a abertura dispara
//    `autoRefreshCollections()` sem `await`, e "Atualizar a lista" é um toque
//    por cima disso). Perdida a metade dos vídeos, o Registro passa a responder
//    como se a varredura nunca tivesse acontecido — e ele é lido A DISTÂNCIA,
//    por quem não tem como conferir;
//  - `ytIntencoes` é uma LISTA que ganha item no começo de cada download e
//    perde item no `finally` de cada um. O item perdido é justamente o que
//    faria o download ser reclamado depois de o renderer morrer: o vídeo
//    simplesmente não volta.
//
// O teste tem DUAS metades de propósito. A primeira escreve o hazard à mão —
// ler, ler, gravar, gravar — e prova que ele PERDE; sem ela, a segunda provaria
// só que uma função concorda consigo mesma. A segunda roda a concorrência de
// verdade (dois `updateState` sem `await` entre eles) e prova que nada se
// perde, o que só é verdade porque duas transações `readwrite` de mesmo escopo
// não se intercalam no IDB.
//
//   node tools/db-estado.test.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const DB = fs.readFileSync(
  path.join(AQUI, '..', 'app', 'src', 'main', 'assets', 'web', 'shared', 'db.js'), 'utf8',
);

const falhas = [];
function checar(cond, msg, obtido) {
  if (cond) console.log('ok      ' + msg);
  else {
    console.log('FALHOU  ' + msg
      + (obtido !== undefined ? '\n        obtido: '
        + (typeof obtido === 'string' ? obtido : JSON.stringify(obtido)) : ''));
    falhas.push(msg);
  }
}

const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const ctx = await navegador.newContext();
await semRedeExterna(ctx);
const pg = await ctx.newPage();
await pg.route('http://av.local/**', (rota) => rota.fulfill({
  status: 200, contentType: 'text/html; charset=utf-8',
  body: '<!doctype html><meta charset="utf-8"><script>' + DB + '</script>',
}));
await pg.goto('http://av.local/', { waitUntil: 'domcontentloaded' });

const ler = (k) => pg.evaluate((c) => window.AVDB.getState(c), k);

// ── 1. O HAZARD, ESCRITO À MÃO ──────────────────────────────────────────────
// Ler as duas pontas ANTES de gravar qualquer uma é exatamente o que duas
// transações separadas permitem, e é o que o par `getState` + `setState` fazia.
// A ordem aqui é explícita para o teste ser determinístico: um `Promise.all`
// sobre o par antigo perderia "quase sempre", e "quase sempre" num portão é
// vermelho intermitente.
checar(await pg.evaluate(async () => {
  const K = 'hazard';
  await window.AVDB.setState(K, {});
  const a = (await window.AVDB.getState(K)) || {};   // varredura A lê
  const b = (await window.AVDB.getState(K)) || {};   // varredura B lê
  await window.AVDB.setState(K, Object.assign(a, { canal: 'A' }));   // A grava
  await window.AVDB.setState(K, Object.assign(b, { videos: 'B' }));  // B grava
  const fim = (await window.AVDB.getState(K)) || {};
  return !fim.canal && fim.videos === 'B';
}), 'o par getState+setState PERDE a metade de quem gravou primeiro (o defeito)',
  await ler('hazard'));

// ── 2. E `updateState` NÃO PERDE, com a concorrência de verdade ─────────────
// Sem `await` entre os dois: as duas transações são criadas quase juntas, e é o
// IDB que as ordena. Se a atomicidade não estivesse lá, este é o caso que a
// perderia.
await pg.evaluate(async () => {
  await window.AVDB.setState('diario', {});
  await Promise.all([
    window.AVDB.updateState('diario', (o) => Object.assign(o || {}, { canal: 'A' })),
    window.AVDB.updateState('diario', (o) => Object.assign(o || {}, { videos: 'B' })),
  ]);
});
const diario = await ler('diario');
checar(!!diario && diario.canal === 'A' && diario.videos === 'B',
  'updateState preserva AS DUAS metades do diário gravadas em paralelo', diario);

// ── 3. E VALE PARA LISTA, que é a forma das intenções de download ───────────
// Vinte pares `lembrar`/`esquecer` disparados juntos: com duas transações o
// resultado dependeria de quem chegou por último; com uma, cada item entra e o
// que foi esquecido sai, sem levar vizinho nenhum junto.
await pg.evaluate(async () => {
  await window.AVDB.setState('intencoes', []);
  const lembrar = (n) => window.AVDB.updateState('intencoes',
    (a) => (a || []).filter((i) => i.link !== n).concat([{ link: n }]));
  const esquecer = (n) => window.AVDB.updateState('intencoes',
    (a) => (a || []).filter((i) => i.link !== n));
  const tudo = [];
  for (let n = 0; n < 20; n++) tudo.push(lembrar('v' + n));
  for (let n = 0; n < 20; n += 2) tudo.push(esquecer('v' + n));
  await Promise.all(tudo);
});
const restam = await ler('intencoes');
const links = (restam || []).map((i) => i.link).sort();
const esperados = Array.from({ length: 10 }, (_, k) => 'v' + (k * 2 + 1)).sort();
checar(links.length === 10 && links.join(',') === esperados.join(','),
  'e numa LISTA nenhum item some por causa de um vizinho (20 lembrar × 10 esquecer)',
  links.join(','));

// ── 4. O VALOR LIDO PELA `fn` É O DE DENTRO DA TRANSAÇÃO ────────────────────
// É o que separa `updateState` de "um `setState` com açúcar": a `fn` recebe o
// que está no banco NAQUELE instante, e o que ela devolve é o que fica.
checar(await pg.evaluate(async () => {
  await window.AVDB.setState('semente', { n: 1 });
  const visto = [];
  await window.AVDB.updateState('semente', (o) => { visto.push(o && o.n); return { n: (o.n || 0) + 1 }; });
  const fim = await window.AVDB.getState('semente');
  return visto.length === 1 && visto[0] === 1 && fim.n === 2;
}), 'a `fn` recebe o valor gravado e o retorno dela é o que fica');

// ── 5. CHAVE INEXISTENTE CHEGA COMO `undefined`, não como erro ──────────────
// Todo consumidor escreve `o || {}` / `o || []`, e é por isto: a primeira
// gravação de uma chave nova é o caso normal, não a exceção.
checar(await pg.evaluate(async () => {
  let recebido = 'nao chamou';
  const r = await window.AVDB.updateState('nunca-existiu', (o) => { recebido = typeof o; return { ok: 1 }; });
  const fim = await window.AVDB.getState('nunca-existiu');
  return recebido === 'undefined' && r.ok === 1 && fim.ok === 1;
}), 'chave que nunca existiu chega como `undefined` e a gravação vale');

await navegador.close();
console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
