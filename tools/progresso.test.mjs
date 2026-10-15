#!/usr/bin/env node
// ============================================================================
// O PROGRESSO DO TOQUE À TELA (v1.12.36; exibição refeita na v1.12.37) — a
// regra de `controle/progresso.js`
//
// O percentual do "Tocar agora" mede do toque até a mídia tocar, em fases
// cujo peso é APRENDIDO dos downloads anteriores. A régua da v1.12.37 é a do
// operador num aparelho de verdade: velocidade ESTÁVEL, sem paradas e sem
// saltos — parar em 97 e abrir o vídeo com a barra em 75 tornam o número inútil.
//
//  A · voltar para trás, ou PARAR com o trabalho vivo (platô > 3,5 s abaixo de 98);
//  B · chegar a 100 antes de a mídia estar pronta; a CAUDA LENTA que para no teto;
//  C · o `concluir()` demorar, ou pular em vez de VARRER;
//  D · a previsão certa não dar uma barra LINEAR no tempo;
//  E · o modelo não aprender (mediana, taxas por MB, limites, janela, versão);
//  F · uma amostra ensinar o que não é comparável (reaproveitado, retomado,
//      app minimizado, play não visto);
//  G · o aprendizado não CONVERGIR em vídeos de tamanhos diferentes;
//  H · a rede de ritmo VARIÁVEL (e a que trava no meio) fazer a barra pular ou parar;
//  I · o arquivo que já estava no aparelho não fechar numa varredura curta;
//  J · o `relatorio()` (o que vai ao Registro) não dizer o que aconteceu.
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
function simular({ modelo, roteiro, bytes = 60 * MB, juncao = true, abertura = true, passoMs = 100, ritmo = null, ja = 0, aoAndar = null }) {
  let t = 1000;
  const b = P.criar({ modelo, agora: () => t, juncao, abertura });
  const serie = [];
  const andar = (ms, cada) => {
    for (let x = 0; x < ms; x += passoMs) { t += passoMs; if (cada) cada((x + passoMs) / ms); if (aoAndar) aoAndar(b, t); serie.push([t, b.passo(), b.fase()]); }
  };
  andar(roteiro.preparo);
  b.sinal('extraiu', {});
  // `ritmo(f)`: a fração de BYTES em função da fração de TEMPO da fase; `ja`: o
  // que já estava no disco (o download retomado).
  andar(roteiro.download, (f) => b.bytes(Math.round(bytes * ja + bytes * (1 - ja) * (ritmo ? ritmo(f) : f)), bytes));
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

// O maior trecho PARADO (ms) antes do concluir, só enquanto o valor está abaixo de `ate`.
function platoAte(r, ate = 98) {
  let max = 0; let desde = null;
  for (let i = 0; i < r.antes; i++) {
    const [t, v] = r.serie[i];
    if (v >= ate) break;
    if (i === 0 || v !== r.serie[i - 1][1]) desde = t;
    else max = Math.max(max, t - desde);
  }
  return max;
}
const maxSalto = (r) => Math.max(0, ...r.serie.slice(1, r.antes).map((x, i) => x[1] - r.serie[i][1]));
const valores = (r) => r.serie.map((x) => x[1]);
const naoVolta = (r) => valores(r).every((v, i, a) => i === 0 || v >= a[i - 1]);
const aoConcluir = (r) => r.serie[r.antes - 1][1];
const PLATO_MAX = 3500;

// ---- A · nunca volta, nunca para ----------------------------------------------
{
  const r = simular({ modelo: certo, roteiro: noRelogio(60) });
  checar(naoVolta(r), 'A · o valor mostrado NUNCA volta', null);
  checar(platoAte(r) <= 1500, 'A · e não para: com a previsão certa nenhum trecho fica parado 1,5 s', platoAte(r));
  checar(maxSalto(r) <= 2, 'A · e é FLUIDO: nenhum salto de mais de 2 pontos entre dois quadros de 100 ms', maxSalto(r));
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

// ---- B · nada de 100 antes do fim; a cauda lenta não para ------------------------
{
  // O caso do relato ("parou em 97"): cópia 5×, gravação 3× e abertura 5× mais
  // lentas que o previsto — a barra chega ao ponto de pouso cedo demais.
  const base = noRelogio(40);
  const lenta = Object.assign({}, base, { copia: base.copia * 5, gravacao: base.gravacao * 3, abertura: base.abertura * 5 });
  const r = simular({ modelo: certo, roteiro: lenta, bytes: 40 * MB });
  const antes = r.serie.slice(0, r.antes).map((x) => x[1]);
  checar(Math.max(...antes) <= 99, 'B · antes do concluir o valor fica em 99 ou abaixo — 100 é só a mídia pronta', Math.max(...antes));
  checar(platoAte(r) <= PLATO_MAX, 'B · e a CAUDA LENTA não para: nenhum platô de mais de 3,5 s abaixo de 98', platoAte(r));
  // E nenhum platô em LUGAR NENHUM da corrida: era o "97 parado" — a fase nova e
  // curta que vem depois do pouso fazia a barra correr até o teto e esperar lá.
  let platoTotal = 0; let desde = r.serie[0][0];
  for (let i = 1; i < r.antes; i++) { if (r.serie[i][1] !== r.serie[i - 1][1]) desde = r.serie[i][0]; else platoTotal = Math.max(platoTotal, r.serie[i][0] - desde); }
  checar(platoTotal <= PLATO_MAX, 'B · e nem acima de 98: depois do ponto de pouso uma fase curta NÃO faz a barra correr ao teto e parar lá', platoTotal);
  checar(aoConcluir(r) >= 95, 'B · e ela segue SUBINDO até o fim atrasado, em vez de chegar ao teto e esperar lá', aoConcluir(r));
  // Uma cauda MUITO lenta (30 s a mais) também anda até a faixa final.
  const muito = Object.assign({}, base, { abertura: 30000 });
  const r2 = simular({ modelo: certo, roteiro: muito, bytes: 40 * MB });
  checar(platoAte(r2) <= PLATO_MAX && Math.max(...r2.serie.slice(0, r2.antes).map((x) => x[1])) <= 99,
    'B · e 30 s de atraso continuam andando (sem platô de 3,5 s abaixo de 98) sem nunca chegar a 100', { plato: platoAte(r2), fim: aoConcluir(r2) });
}

// ---- C · o concluir fecha numa VARREDURA curta ------------------------------------
{
  const r = simular({ modelo: certo, roteiro: noRelogio(60) });
  const fim = r.serie[r.serie.length - 1];
  checar(fim[1] === 100 && r.b.terminou(), 'C · depois do concluir o valor chega a 100', fim);
  checar(r.tFim - r.tConcluir <= 500, 'C · e chega em até meio segundo — a barra nunca segura a mídia', r.tFim - r.tConcluir);
  // O fim CEDO (a previsão da cauda o dobro do real): o salto é varrido, não pulado.
  const base = noRelogio(40);
  const cedo = Object.assign({}, base, { juncao: base.juncao / 3, copia: base.copia / 3, gravacao: base.gravacao / 3, abertura: base.abertura / 3 });
  const r2 = simular({ modelo: certo, roteiro: cedo, bytes: 40 * MB });
  const depois = r2.serie.slice(r2.antes).map((x) => x[1]);
  checar(depois.length >= 4 && depois.slice(0, -1).every((v) => v < 100),
    'C · e um fim CEDO é uma varredura de vários quadros, nunca um pulo para 100', depois);
  checar(r2.tFim - r2.tConcluir <= 500, 'C · e a varredura não passa de meio segundo', r2.tFim - r2.tConcluir);
}

// ---- D · previsão certa = barra linear no tempo --------------------------------
{
  const r = simular({ modelo: certo, roteiro: noRelogio(60) });
  const total = r.tConcluir - r.t0;
  const desvio = Math.max(...r.serie.slice(0, r.antes).map(([t, v]) => {
    const ideal = (95 * (t - r.t0)) / total;
    return ideal > 5 && ideal < 90 ? Math.abs(v - ideal) : 0;
  }));
  checar(desvio <= 6, 'D · com a previsão certa o valor acompanha o TEMPO (±6 pontos da reta que pousa em 95 no fim)', desvio);
  const fimDoDownload = r.serie.filter((x) => x[2] === 'download').pop()[1];
  checar(fimDoDownload < 92, 'D · e o fim dos bytes NÃO é o fim da barra: a junção, a cópia, a gravação e a abertura têm peso', fimDoDownload);
  checar(aoConcluir(r) >= 93 && aoConcluir(r) <= 97, 'D · e no instante do fim previsto ela está no POUSO (95±2): o salto final é pequeno', aoConcluir(r));
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
  checar(P.sanear({ amostras: 'x' }).amostras.length === 0 && P.sanear(42).v === P.VERSAO,
    'E · um histórico gravado corrompido vira vazio, nunca exceção', null);
  checar(P.sanear({ v: 1, amostras: [{ preparoMs: 100 }] }).amostras.length === 0,
    'E · e o histórico da VERSÃO anterior recomeça (misturava amostras que esta recusa)', null);
  const lenta = P.modelo(P.aprender(null, { preparoMs: 2500, downloadMs: 120000, bytes: 60 * MB }));
  const em = (mod) => { let t = 0; const b = P.criar({ modelo: mod, agora: () => t, juncao: true, abertura: true });
    let v = 0; for (let i = 0; i < 20; i++) { t += 100; v = b.passo(); } return v; };
  checar(em(lenta) < em(certo), 'E · o que foi aprendido MUDA a previsão: com a rede lenta aprendida, os mesmos 2 s de preparo mostram menos',
    { lenta: em(lenta), padrao: em(certo) });
  const ap = P.apoio(h);
  checar(ap.n === 3 && ap.download === 3 && ap.abertura === 3, 'E · e o `apoio` conta quantas amostras sustentam cada número', ap);
}

// ---- F · a amostra só ensina o que é comparável -----------------------------------
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
  const r3 = simular({ modelo: certo, roteiro: noRelogio(20), bytes: 20 * MB, ja: 0.5 });
  const a3 = r3.b.amostra();
  checar(a3 && a3.downloadMs === undefined && a3.juncaoMs > 0 && r3.b.relatorio().caminho === 'retomado',
    'F · um download RETOMADO (metade já no disco) não ensina o ritmo da rede — o resto ensina', a3);
  const r4 = simular({ modelo: certo, roteiro: noRelogio(20), bytes: 20 * MB,
    aoAndar: (bb) => { if (bb.fase() === 'copia') bb.oculta(true); } });
  const a4 = r4.b.amostra();
  checar(a4 && a4.copiaMs === undefined && a4.gravacaoMs === undefined && a4.aberturaMs === undefined && a4.downloadMs > 0,
    'F · com o app MINIMIZADO numa fase do app (WebView estrangulado), cópia, gravação e abertura não ensinam', a4);
  let t5 = 0;
  const b5 = P.criar({ modelo: certo, agora: () => t5, juncao: false, abertura: true });
  b5.sinal('abertura'); t5 += 5000; b5.passo(); b5.concluir({ tocou: false });
  checar(b5.amostra() === null, 'F · e a abertura que venceu o prazo sem ver o play não ensina nada', b5.amostra());
}

// ---- G · o aprendizado CONVERGE com tamanhos diferentes ---------------------------
{
  // Um aparelho rápido de verdade (15 MB/s, ms por MB bem menores que o padrão):
  // o primeiro vídeo erra (padrão), os seguintes — de OUTROS tamanhos — acertam.
  const real = (mb) => ({ preparo: 1500, download: (mb * MB) / 15000, juncao: mb * 10, copia: mb * 12, gravacao: mb * 22, abertura: 450 });
  let h = null; const fins = []; const platos = [];
  for (const mb of [30, 70, 45, 20, 55]) {
    const r = simular({ modelo: P.modelo(h), roteiro: real(mb), bytes: mb * MB });
    fins.push(aoConcluir(r)); platos.push(platoAte(r));
    checar(naoVolta(r), 'G · ' + mb + ' MB: nunca volta', null);
    h = P.aprender(h, Object.assign({ origem: 'tocar' }, r.b.amostra()));
  }
  checar(fins.slice(1).every((v) => v >= 90), 'G · depois do PRIMEIRO download, vídeos de outros tamanhos terminam com a barra em 90+ (salto final pequeno)', fins);
  checar(platos.every((p) => p <= 1500), 'G · e nenhum deles para', platos);
}

// ---- H · rede de ritmo variável; rede que trava no meio ---------------------------
{
  const base = noRelogio(40);
  // Metade do tempo a 1/3 do ritmo, a outra metade correndo.
  const r = simular({ modelo: certo, roteiro: base, bytes: 40 * MB, ritmo: (f) => (f < 0.5 ? f * 0.5 : 0.25 + (f - 0.5) * 1.5) });
  checar(naoVolta(r) && maxSalto(r) <= 3 && platoAte(r) <= 1500,
    'H · com o ritmo da rede MUDANDO no meio, a barra muda de velocidade aos poucos: sem salto de 3+ e sem parada', { salto: maxSalto(r), plato: platoAte(r) });
  // A rede trava 12 s no meio do download.
  const longo = Object.assign({}, base, { download: base.download + 12000 });
  const frac = (f) => { const tt = f * longo.download; const ini = base.download / 2; if (tt < ini) return tt / base.download; if (tt < ini + 12000) return 0.5; return (tt - 12000) / base.download; };
  const r2 = simular({ modelo: certo, roteiro: longo, bytes: 40 * MB, ritmo: frac });
  checar(naoVolta(r2) && platoAte(r2) <= PLATO_MAX, 'H · e com a rede TRAVADA 12 s ela desacelera e segue andando (sem platô de 3,5 s)', platoAte(r2));
}

{
  // A rede 5× mais rápida que o aprendido, num vídeo grande, e quase nada depois
  // dos bytes: só o ritmo MEDIDO faz a barra acompanhar — sem ele o fim chega com
  // ela no meio e o "vídeo abre com a barra em 60".
  const mod = Object.assign({}, certo, { juncaoMsPorMB: 1, copiaMsPorMB: 1, gravacaoMsPorMB: 1, aberturaMs: 100, preparoMs: 500 });
  const rr = { preparo: 500, download: (100 * MB) / certo.bytesPorMs / 5, juncao: 0, copia: 100, gravacao: 100, abertura: 100 };
  const r = simular({ modelo: mod, roteiro: rr, bytes: 100 * MB, juncao: false });
  checar(aoConcluir(r) >= 85, 'H · com a rede 5× mais rápida que o aprendido, o ritmo MEDIDO leva a barra junto: no fim ela está em 85+', aoConcluir(r));
}
{
  // A VELOCIDADE muda aos poucos: o download que termina 4× antes do previsto, e
  // as fases que se seguem em rajada, não mudam a velocidade de um quadro para o
  // outro (a inércia, `TAU_V`).
  let t = 1000;
  const b = P.criar({ modelo: certo, agora: () => t, juncao: true, abertura: true });
  let antes = null; let maxDv = 0;
  const passo = () => { t += 100; b.passo(); const v = b.bruto().v; if (antes != null) maxDv = Math.max(maxDv, Math.abs(v - antes)); antes = v; };
  for (let i = 0; i < 10; i++) passo();
  b.sinal('extraiu');
  for (let i = 1; i <= 50; i++) { b.bytes(Math.round(40 * MB * Math.min(1, i / 50)), 40 * MB); passo(); }
  b.sinal('baixou', { bytes: 40 * MB, juntar: true }); b.sinal('juntou'); b.sinal('copia');
  for (let i = 0; i < 5; i++) passo();
  b.sinal('gravacao');
  for (let i = 0; i < 30; i++) passo();
  checar(maxDv <= 1.5, 'H · e a VELOCIDADE muda aos poucos: no máximo 1,5 ponto/s de um quadro de 100 ms para o seguinte', maxDv);
}

// ---- I · o arquivo que já estava no aparelho: uma varredura curta -----------------
{
  let t = 0;
  const b = P.criar({ modelo: certo, agora: () => t, juncao: true, abertura: true });
  const vals = [];
  for (let i = 0; i < 3; i++) { t += 100; vals.push(b.passo()); }
  b.sinal('abertura');
  for (let i = 0; i < 4; i++) { t += 100; vals.push(b.passo()); }
  const tc = t; b.concluir();
  while (!b.terminou() && t - tc < 2000) { t += 50; vals.push(b.passo()); }
  checar(b.terminou() && t <= 1300 && vals.every((v, i) => i === 0 || v >= vals[i - 1]) && vals.slice(0, -1).every((v) => v < 100),
    'I · do toque ao 100 em pouco mais de um segundo, subindo sem pular', vals);
  checar(b.relatorio().caminho === 'no-aparelho', 'I · e o relatório diz que o arquivo já estava no aparelho', b.relatorio().caminho);
}

// ---- J · o relatório --------------------------------------------------------------
{
  const base = noRelogio(40);
  const r = simular({ modelo: certo, roteiro: Object.assign({}, base, { copia: base.copia * 4 }), bytes: 40 * MB });
  const rel = r.b.relatorio();
  checar(rel.caminho === 'novo' && rel.bytes === 40 * MB && rel.realMs === r.tConcluir - r.t0 && rel.previstoMs > 0,
    'J · o relatório traz o caminho, o tamanho, o previsto e o real', rel);
  checar(rel.fases.copia && rel.fases.copia.realMs === Math.ceil(base.copia * 4 / 100) * 100 && rel.fases.copia.previstoMs === Math.round(base.copia)
    && typeof rel.fases.download.mostrado === 'number',
    'J · e cada fase com o real, o previsto e o número que a tela mostrava no fim dela', rel.fases);
  checar(rel.aoConcluir === aoConcluir(r) && rel.saltoFinal === 100 - aoConcluir(r) && rel.platoMs >= 0,
    'J · e o número no fim, o salto final e a maior parada', rel);
}

if (falhas.length) { console.log('\n' + falhas.length + ' falha(s).'); process.exit(1); }
console.log('\nTodos passaram.');
