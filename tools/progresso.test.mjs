#!/usr/bin/env node
// ============================================================================
// O PROGRESSO DO TOQUE À TELA (v1.12.36) — a regra de `controle/progresso.js`
//
// O percentual do "Tocar agora" mede do toque até a mídia tocar, em fases
// cujo peso é APRENDIDO dos downloads anteriores. Os modos de errar são todos
// calados — a barra continua andando, só que mentindo:
//
//  A · voltar para trás, ou CONGELAR com o trabalho vivo;
//  B · chegar a 100 (ou passar do teto) antes de a mídia estar pronta;
//  C · o `concluir()` demorar — a barra segurando o fim depois de a mídia tocar;
//  D · a previsão certa não dar uma barra LINEAR no tempo;
//  E · o modelo não aprender (mediana, taxas por MB, limites, janela de 12);
//  F · uma amostra de arquivo reaproveitado ensinar algo sobre a rede.
//
// O relógio é de mentira (`agora` injetado) — é isso que torna a fluidez
// afirmável. Node puro, sem `continue-on-error`.
//
//   node tools/progresso.test.mjs
// ============================================================================
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { checar, falhas } from './checar.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const janela = {};
new Function(readFileSync(join(raiz, 'app/src/main/assets/web/controle/progresso.js'), 'utf8')).call(janela);
const P = janela.AVProgresso;
checar(!!P, 'o módulo publica window.AVProgresso (é o que o watchdog do OTA exige)');
if (!P) { console.log('\n1 falha(s).'); process.exit(1); }
const MB = 1024 * 1024;

// Um "download" simulado: o roteiro diz quanto dura cada fase (ms) e o tamanho.
// Devolve a série (t, valor) a cada 100 ms e o instante do concluir.
function simular({ modelo, roteiro, bytes = 60 * MB, juncao = true, abertura = true, passoMs = 100 }) {
  let t = 1000;
  const b = P.criar({ modelo, agora: () => t, juncao, abertura });
  const serie = [];
  const andar = (ms, cada) => {
    for (let x = 0; x < ms; x += passoMs) { t += passoMs; if (cada) cada(x / ms); serie.push([t, b.passo(), b.fase()]); }
  };
  andar(roteiro.preparo);
  b.sinal('extraiu', {});
  andar(roteiro.download, (f) => b.bytes(Math.round(bytes * f), bytes));
  b.bytes(bytes, bytes);
  if (juncao && roteiro.juncao) {
    b.sinal('baixou', { bytes, juntar: true });
    andar(roteiro.juncao, (f) => b.sinal('juntando', { feito: Math.round(bytes * f), total: bytes }));
    b.sinal('juntou', {});
  }
  b.sinal('copia');
  andar(roteiro.copia);
  b.sinal('gravacao');
  andar(roteiro.gravacao);
  if (abertura) { b.sinal('abertura'); andar(roteiro.abertura); }
  const antes = serie.length;
  const tConcluir = t;
  b.concluir();
  let n = 0;
  while (!b.terminou() && n < 100) { t += 50; serie.push([t, b.passo(), b.fase()]); n++; }
  return { b, serie, antes, tConcluir, tFim: t, t0: 1000 };
}

const certo = P.modelo(null);
const noRelogio = (mb) => ({
  preparo: certo.preparoMs,
  download: (mb * MB) / certo.bytesPorMs,
  juncao: mb * certo.juncaoMsPorMB,
  copia: mb * certo.copiaMsPorMB,
  gravacao: mb * certo.gravacaoMsPorMB,
  abertura: certo.aberturaMs,
});

// ---- A · nunca volta, nunca congela -----------------------------------------
{
  const r = simular({ modelo: certo, roteiro: noRelogio(60) });
  const vals = r.serie.map((x) => x[1]);
  checar(vals.every((v, i) => i === 0 || v >= vals[i - 1]), 'A · o valor mostrado NUNCA volta', null);
  // Congelar = 1,5 s seguidos sem mudar, antes do concluir.
  let maxParado = 0; let parado = 0;
  for (let i = 1; i < r.antes; i++) { parado = vals[i] === vals[i - 1] ? parado + 100 : 0; maxParado = Math.max(maxParado, parado); }
  checar(maxParado <= 1500, 'A · e não congela: com a previsão certa nenhum trecho fica parado 1,5 s', maxParado);
  const saltos = vals.slice(1, r.antes).map((v, i) => v - vals[i]);
  checar(Math.max(...saltos) <= 3, 'A · e é FLUIDO: nenhum salto de mais de 3 pontos entre dois quadros de 100 ms', Math.max(...saltos));
}

// ---- B · nada de 100 antes do fim, mesmo com tudo atrasado --------------------
{
  const atrasado = Object.assign(noRelogio(60), { copia: noRelogio(60).copia * 12, abertura: 30000 });
  const r = simular({ modelo: certo, roteiro: atrasado });
  const antes = r.serie.slice(0, r.antes).map((x) => x[1]);
  checar(Math.max(...antes) <= 97, 'B · antes do concluir o valor fica em 97 ou abaixo — 100 é só a mídia pronta', Math.max(...antes));
  // E com a fase ATRASADA ele continua andando: na cópia 12× mais lenta, a cada 2 s sobe algo.
  const naCopia = r.serie.filter((x) => x[2] === 'copia');
  let subiu = true;
  for (let i = 20; i < naCopia.length; i += 20) if (!(naCopia[i][1] > naCopia[i - 20][1]) && naCopia[i - 20][1] < 95) subiu = false;
  checar(subiu, 'B · e uma fase ATRASADA desacelera sem parar: a cada 2 s o valor ainda sobe (até a faixa final, 95+, onde ele só encosta no teto)',
    naCopia.filter((_, i) => i % 20 === 0).map((x) => x[1]));
  checar(naCopia.length && naCopia[naCopia.length - 1][1] >= 85,
    'B · e a desaceleração é assintótica: no fim de uma fase muito atrasada a barra está perto do teto, não parada no meio',
    naCopia.length && naCopia[naCopia.length - 1][1]);
}

// ---- C · o concluir fecha em fração de segundo --------------------------------
{
  const r = simular({ modelo: certo, roteiro: noRelogio(60) });
  const fim = r.serie[r.serie.length - 1];
  checar(fim[1] === 100 && r.b.terminou(), 'C · depois do concluir o valor chega a 100', fim);
  checar(r.tFim - r.tConcluir <= 600, 'C · e chega em menos de 0,6 s — a barra nunca segura a mídia', r.tFim - r.tConcluir);
  const depois = r.serie.slice(r.antes).map((x) => x[1]);
  checar(depois.some((v) => v > 97 && v < 100) || depois.length === 1,
    'C · e o trecho final ANDA (passa pelos 98/99), em vez de pular do teto para 100', depois);
}

// ---- D · previsão certa = barra linear no tempo --------------------------------
{
  const r = simular({ modelo: certo, roteiro: noRelogio(60) });
  const total = r.tConcluir - r.t0;
  const desvio = Math.max(...r.serie.slice(0, r.antes).map(([t, v]) => {
    const ideal = (100 * (t - r.t0)) / total;
    return ideal > 5 && ideal < 90 ? Math.abs(v - ideal) : 0;
  }));
  checar(desvio <= 8, 'D · com a previsão certa o valor acompanha o TEMPO (±8 pontos da reta, de 5% a 90%) — nada de "só o último 1%"', desvio);
  const fimDoDownload = r.serie.filter((x) => x[2] === 'download').pop()[1];
  checar(fimDoDownload < 92, 'D · e o fim dos bytes NÃO é o fim da barra: a junção, a cópia, a gravação e a abertura têm peso', fimDoDownload);
}

// ---- Sem junção prevista e pulada: não volta ------------------------------------
{
  let t = 0;
  const b = P.criar({ modelo: certo, agora: () => t, juncao: true, abertura: false });
  const vals = [];
  for (let i = 0; i < 30; i++) { t += 100; vals.push(b.passo()); }
  b.bytes(10 * MB, 10 * MB);
  b.sinal('baixou', { bytes: 10 * MB, juntar: false });
  b.sinal('copia');
  for (let i = 0; i < 20; i++) { t += 100; vals.push(b.passo()); }
  checar(vals.every((v, i) => i === 0 || v >= vals[i - 1]) && b.fase() === 'copia',
    'A · uma fase PULADA (o vídeo que veio sem junção) encurta a previsão e o valor só avança', vals);
  b.sinal('download');
  checar(b.fase() === 'copia', 'A · e um sinal de fase ANTERIOR é ignorado: a barra não volta de fase', b.fase());
}

// ---- E · o aprendizado -----------------------------------------------------------
{
  const vazio = P.modelo(undefined);
  checar(JSON.stringify(vazio) === JSON.stringify(Object.assign({}, P.PADRAO)),
    'E · sem amostra valem os números padrão', vazio);
  let h = null;
  for (const ms of [3000, 1000, 1100]) {
    h = P.aprender(h, { preparoMs: ms, downloadMs: 10000, bytes: 50 * MB, juncaoMs: 5000, copiaMs: 500, gravacaoMs: 1000, aberturaMs: 700 });
  }
  const m = P.modelo(h);
  checar(m.preparoMs === 1100, 'E · cada número é a MEDIANA das amostras (não a média, que um culto ruim arrastaria)', m.preparoMs);
  checar(Math.abs(m.bytesPorMs - (50 * MB) / 10000) < 1, 'E · o download vira TAXA (bytes/ms), para valer para outro tamanho', m.bytesPorMs);
  checar(m.juncaoMsPorMB === 100 && m.copiaMsPorMB === 10 && m.gravacaoMsPorMB === 20,
    'E · e a junção, a cópia e a gravação viram ms POR MB', [m.juncaoMsPorMB, m.copiaMsPorMB, m.gravacaoMsPorMB]);
  const louco = P.modelo(P.aprender(null, { preparoMs: 99999999, aberturaMs: 1 }));
  checar(louco.preparoMs === P.LIMITES.preparoMs[1] && louco.aberturaMs === P.LIMITES.aberturaMs[0],
    'E · e um número fora do intervalo são é PRESO a ele (relógio quebrado, aba suspensa)', louco);
  let longa = null;
  for (let i = 0; i < 30; i++) longa = P.aprender(longa, { aberturaMs: 100 + i });
  checar(longa.amostras.length === P.AMOSTRAS && longa.amostras[0].aberturaMs === 100 + 30 - P.AMOSTRAS,
    'E · a janela guarda só as últimas ' + P.AMOSTRAS + ' amostras', longa.amostras.length);
  checar(P.aprender(h, { lixo: 1 }).amostras.length === h.amostras.length && P.aprender(h, null).amostras.length === h.amostras.length,
    'E · e uma amostra sem nenhum campo conhecido não entra', null);
  checar(P.sanear({ amostras: 'x' }).amostras.length === 0 && P.sanear(42).v === 1,
    'E · um histórico gravado corrompido vira vazio, nunca exceção', null);
  // Uma rede LENTA aprendida faz a mesma espera mostrar MENOS.
  const lenta = P.modelo(P.aprender(null, { preparoMs: 2500, downloadMs: 120000, bytes: 60 * MB }));
  // Antes do primeiro byte: ali só o aprendido responde (depois dele manda o ritmo MEDIDO).
  const em = (mod) => { let t = 0; const b = P.criar({ modelo: mod, agora: () => t, juncao: true, abertura: true });
    let v = 0; for (let i = 0; i < 20; i++) { t += 100; v = b.passo(); } return v; };
  checar(em(lenta) < em(certo), 'E · o que foi aprendido MUDA a previsão: com a rede lenta aprendida, os mesmos 2 s de preparo mostram menos',
    { lenta: em(lenta), padrao: em(certo) });
}

// ---- F · a amostra só ensina o que aconteceu --------------------------------------
{
  let t = 0;
  const b = P.criar({ modelo: certo, agora: () => t, juncao: true, abertura: true });
  t += 50; b.passo();
  b.sinal('abertura');   // o arquivo já estava no aparelho: do preparo direto à abertura
  t += 800; b.passo();
  checar(b.amostra() === null, 'F · antes do concluir não há amostra', b.amostra());
  b.concluir();
  const a = b.amostra();
  checar(a && a.aberturaMs === 800 && a.downloadMs === undefined && a.preparoMs === undefined,
    'F · um arquivo REAPROVEITADO ensina só a abertura — nada sobre a rede nem o preparo', a);
  const r = simular({ modelo: certo, roteiro: noRelogio(20), bytes: 20 * MB, abertura: false });
  const a2 = r.b.amostra();
  checar(a2 && a2.bytes === 20 * MB && a2.downloadMs > 0 && a2.juncaoMs > 0 && a2.gravacaoMs > 0 && a2.aberturaMs === undefined,
    'F · um download SEM tocar (a rotina das séries, guardar numa lista) ensina as fases dele e nenhuma abertura', a2);
}

if (falhas.length) { console.log('\n' + falhas.length + ' falha(s).'); process.exit(1); }
console.log('\nTodos passaram.');
