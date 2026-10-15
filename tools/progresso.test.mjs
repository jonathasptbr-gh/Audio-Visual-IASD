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
//  J · o `relatorio()` (o que vai ao Registro) não dizer o que aconteceu;
//  K · (v1.12.38) os QUATRO downloads do Registro do operador, com o aviso de
//      bytes a cada 1 MB do shell: todo download novo saía "retomado" e a rede
//      nunca era aprendida — o 2º ao 4º têm de prever ±20% e tocar com 90+;
//  L · o TAMANHO antes de o shell dizer: duração × bytes por segundo, o típico
//      da mesma chave (vídeo × só áudio), e de onde ele veio no relatório;
//  M · o FREIO do pouso: a inércia de uma barra rápida não a leva ao 99;
//  N · a junção pesa o quanto ela costuma acontecer (o 360p não junta);
//  O · num download de um segundo, o ritmo MEDIDO vale já no segundo aviso;
//  P · (v1.12.39) os CINCO downloads de 720p do Registro de 15/10: uma amostra
//      fora da curva (a gravação de 1,9 s) não vira a previsão do vídeo
//      seguinte, o tamanho de UM vídeo de 3 MB não vira o do seguinte de 13 MB,
//      e — sem a miniatura no caminho — do 2º em diante a mídia fica pronta com
//      85+, sem parar e com o fim segurado em até 500 ms;
//  Q · o FIM SEGURADO: `revelar()` segura proporcional ao que falta (até 500
//      ms), varre até 100 exatamente nesse tempo, e não segura a partir do 95;
//  R · (v1.12.40) os CINCO downloads do Registro de 15/10 12h37, dois deles com a
//      rede desabando no meio dos bytes: a barra PRESA AOS BYTES anda com eles,
//      sem parar 1,5 s, abaixo de 90 nos bytes e dentro da fatia do download no
//      fim deles; os três normais não mudam.
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
  download: certo.latenciaMs + (mb * MB) / certo.bytesPorMs,
  juncao: certo.juncaoFixoMs + mb * certo.juncaoMsPorMB,
  copia: certo.copiaFixoMs + mb * certo.copiaMsPorMB,
  gravacao: certo.gravacaoFixoMs + mb * certo.gravacaoMsPorMB,
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
  // A previsão certa inclui o TAMANHO: o típico aprendido é o deste vídeo.
  const ro = noRelogio(60);
  const r = simular({ modelo: Object.assign({}, certo, { bytesTipicos: 60 * MB }), roteiro: ro });
  // A reta MIRA o pouso antes do fim: a cauda do app (cópia, gravação, abertura)
  // pesa `MIRA_CAUDA` na conta da velocidade (ver `restante(t, mira)`).
  const total = r.tConcluir - r.t0 - (1 - P.MIRA_CAUDA) * (ro.copia + ro.gravacao + ro.abertura);
  const desvio = Math.max(...r.serie.slice(0, r.antes).map(([t, v]) => {
    const ideal = (95 * (t - r.t0)) / total;
    return ideal > 5 && ideal < 90 ? Math.abs(v - ideal) : 0;
  }));
  checar(desvio <= 6, 'D · com a previsão certa o valor acompanha o TEMPO (±6 pontos da reta que pousa em 95 no fim MIRADO)', desvio);
  const fimDoDownload = r.serie.filter((x) => x[2] === 'download').pop()[1];
  checar(fimDoDownload < 92, 'D · e o fim dos bytes NÃO é o fim da barra: a junção, a cópia, a gravação e a abertura têm peso', fimDoDownload);
  checar(aoConcluir(r) >= 93 && aoConcluir(r) <= 97, 'D · e no instante do fim previsto ela está no POUSO (95±2): o salto final é pequeno', aoConcluir(r));
  checar(platoAte(r, 100) <= 1500, 'D · e entre o fim mirado e o real ela anda devagar, sem parar 1,5 s', platoAte(r, 100));
}

// ---- E · o aprendizado -----------------------------------------------------------
{
  const vazio = P.modelo(undefined);
  checar(JSON.stringify(vazio) === JSON.stringify(Object.assign({}, P.PADRAO)),
    'E · sem amostra valem os números padrão', vazio);
  let h = null;
  for (const ms of [1000, 9000, 1100, 1000, 1100]) {
    h = P.aprender(h, { preparoMs: ms, downloadMs: 10000, bytes: 50 * MB, juncaoMs: 5000, copiaMs: 500, gravacaoMs: 1000, aberturaMs: 700 });
  }
  const m = P.modelo(h);
  checar(m.preparoMs === 1100, 'E · cada tempo é um QUANTIL das amostras: os 9 s de um culto ruim não arrastam a previsão (a média daria 2,6 s)', m.preparoMs);
  checar(Math.abs(m.bytesPorMs - (50 * MB) / 10000) < 1, 'E · o download vira TAXA (bytes/ms), para valer para outro tamanho', m.bytesPorMs);
  const em50 = (f) => Math.round(m[f + 'FixoMs'] + 50 * m[f + 'MsPorMB']);
  checar(em50('juncao') === 5000 && em50('copia') === 500 && em50('gravacao') === 1000,
    'E · e a junção, a cópia e a gravação viram FIXO + POR MB que devolvem o medido no mesmo tamanho', [em50('juncao'), em50('copia'), em50('gravacao')]);
  // Dois tamanhos separam o fixo do por MB; o ruído que faria a inclinação
  // negativa (um arquivo maior gravando mais rápido) vira inclinação zero.
  const tres = P.modelo([[10, 1200], [50, 2000], [30, 1600]].reduce((hh, [mb, ms]) => P.aprender(hh, { bytes: mb * MB, gravacaoMs: ms }), null));
  checar(Math.round(tres.gravacaoMsPorMB) === 20 && Math.round(tres.gravacaoFixoMs) === 1000,
    'E · com TRÊS tamanhos, o fixo e o por MB saem da reta entre eles (1 s + 20 ms/MB)', [tres.gravacaoFixoMs, tres.gravacaoMsPorMB]);
  const dois = P.modelo(P.aprender(P.aprender(null, { bytes: 3 * MB, gravacaoMs: 200 }), { bytes: 13 * MB, gravacaoMs: 1900 }));
  checar(dois.gravacaoMsPorMB <= P.PADRAO.gravacaoMsPorMB,
    'E · e DOIS só não fazem inclinação: a diferença de uma amostra fora da curva não vira ms por MB (v1.12.39)', dois.gravacaoMsPorMB);
  const neg = P.modelo([[4, 1000], [11, 300], [20, 250]].reduce((hh, [mb, ms]) => P.aprender(hh, { bytes: mb * MB, gravacaoMs: ms }), null));
  checar(neg.gravacaoMsPorMB === 0 && neg.gravacaoFixoMs > 250 && neg.gravacaoFixoMs < 1000,
    'E · e uma inclinação NEGATIVA (ruído) vira zero — o fixo é o quantil das amostras, nunca a mais nova sozinha', [neg.gravacaoFixoMs, neg.gravacaoMsPorMB]);
  checar(P.estimar([100, 900], 0.5) === 500 && P.estimar([100, 100, 900], 0.5) === 100 && P.estimar([NaN, 5]) === 5
    && P.estimar([99999, 1, 1, 1, 1, 1, 1, 1, 1], 0.9) === 1,
    'E · a estimativa é um QUANTIL sem peso de idade: entre duas, o meio; com apoio, a maioria; só as últimas ' + P.JANELA, null);
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
  checar(P.sanear({ v: 1, amostras: [{ preparoMs: 100 }] }).amostras.length === 0 && P.sanear({ v: 2, amostras: [{ preparoMs: 100 }] }).amostras.length === 0,
    'E · e o histórico das VERSÕES anteriores recomeça (a v2 nunca aprendeu a rede)', null);
  const v3 = P.sanear({ v: 3, amostras: [{ preparoMs: 2000, gravacaoMs: 1900, bytes: 13 * MB }] });
  checar(v3.v === P.VERSAO && v3.amostras.length === 1 && v3.amostras[0].preparoMs === 2000 && !('gravacaoMs' in v3.amostras[0]),
    'E · e a v3 (v1.12.38) é LIDA sem a gravação, que incluía a miniatura — o resto do que ela aprendeu fica', v3);
  const lenta = P.modelo(P.aprender(null, { preparoMs: 2500, downloadMs: 120000, bytes: 60 * MB }));
  const em = (mod) => { let t = 0; const b = P.criar({ modelo: mod, agora: () => t, juncao: true, abertura: true });
    let v = 0; for (let i = 0; i < 20; i++) { t += 100; v = b.passo(); } return v; };
  checar(em(lenta) < em(certo), 'E · o que foi aprendido MUDA a previsão: com a rede lenta aprendida, os mesmos 2 s de preparo mostram menos',
    { lenta: em(lenta), padrao: em(certo) });
  const ap = P.apoio(h);
  checar(ap.n === 5 && ap.download === 5 && ap.abertura === 5, 'E · e o `apoio` conta quantas amostras sustentam cada número', ap);
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
    'F · um download RETOMADO (metade já no disco) não ensina a duração dos bytes — o resto ensina', a3);
  const ritmoReal = (10 * MB) / noRelogio(20).download;  // a metade que faltava, no tempo da fase
  checar(a3 && Math.abs(a3.ritmo - ritmoReal) / ritmoReal < 0.1,
    'F · mas ensina o RITMO medido entre avisos, que byte nenhum do disco altera', a3 && a3.ritmo);
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
  // (v1.12.40) Com a rede TRAVADA 12 s a barra é PRESA AOS BYTES: ela anda no
  // máximo a margem além do que chegou e PARA — o número diz o que chegou —, e
  // volta a andar com os bytes. Antes ela seguia o piso até o 99.
  const r2 = simular({ modelo: certo, roteiro: longo, bytes: 40 * MB, ritmo: frac });
  const ini = base.download / 2; const t0s = r2.t0 + longo.preparo;
  const naTrava = r2.serie.filter(([t]) => t > t0s + ini && t <= t0s + ini + 12000).map((x) => x[1]);
  const depois = r2.serie.filter(([t, , f]) => t > t0s + ini + 12500 && f === 'download').map((x) => x[1]);
  // A fatia do download se ESTICA com a trava (o tempo dela cresce contra o das
  // fases seguintes), mas a posição dos bytes é a METADE dela: a barra fica
  // abaixo do meio do caminho entre a entrada nos bytes e o pouso.
  const sD = r2.serie.find(([, , f]) => f === 'download')[1];
  const meio = sD + (P.POUSO - sD) * 0.5 + P.MARGEM_BYTES + 1;
  checar(naoVolta(r2) && Math.max(...naTrava) <= meio,
    'H · e com a rede TRAVADA 12 s na metade dos bytes ela não passa da METADE da fatia (presa aos bytes; antes seguia o piso até o 99)',
    { naTrava: [naTrava[0], naTrava[naTrava.length - 1]], teto: Math.round(meio) });
  checar(depois.length > 2 && depois[depois.length - 1] > naTrava[naTrava.length - 1],
    'H · e volta a andar quando os bytes voltam', [naTrava[naTrava.length - 1], depois[depois.length - 1]]);
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
  // O freio do pouso (20 pontos/s²) é a maior mudança permitida: 2 pontos/s por
  // quadro, e um pouco mais no último quadro dele.
  checar(maxDv <= 3.5, 'H · e a VELOCIDADE muda aos poucos: no máximo 3,5 pontos/s de um quadro de 100 ms para o seguinte (o freio do pouso)', maxDv);
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

// ---- K · os quatro downloads do Registro do operador (v1.12.38) -------------------
// O shell avisa os bytes a cada 1 MB (`ProgressoDePedacos`): o primeiro aviso já
// traz 1 MB e pouco. Uma rede de ~10 MB/s, uma latência antes dos bytes, e as
// fases como o Registro de 15/10/2026 as mediu (MB · preparo · bytes · cópia ·
// gravação · abertura, ms).
const RELATO = [[6, 2100, 1100, 0, 600, 200], [11, 2600, 900, 0, 300, 100], [10, 2400, 1800, 0, 300, 100], [4, 1800, 1100, 0, 1000, 200]];
function simularAvisos(h, [mb, pre, dl, cp, gr, ab], { lat = 350, ja = 0, extraiu = {} } = {}) {
  let t = 1000;
  const B = Math.round(mb * MB * 1.013);
  const b = P.criar({ modelo: P.modelo(h, 'video'), agora: () => t, juncao: true, abertura: true, chave: 'video' });
  const serie = [];
  const andar = (ms, cada) => {
    for (let x = 0; x < ms; x += 100) {
      for (let y = 0; y < Math.min(100, ms - x); y += 10) { t += 10; if (cada) cada(x + y + 10); }
      serie.push([t, b.passo(), b.fase()]);
    }
  };
  andar(pre);
  b.sinal('extraiu', extraiu);
  const base = Math.round(B * ja);
  let prox = base + MB;
  const util = dl - lat - 60;
  andar(dl, (e) => {
    const lidos = e <= lat ? base : Math.min(B, base + Math.round((B - base) * (e - lat) / util));
    while (lidos >= prox && prox < B) { b.bytes(prox + 40000, B); prox += MB; }
    if (lidos >= B && prox !== Infinity) { b.bytes(B, B); prox = Infinity; }
  });
  b.sinal('baixou', { bytes: B, juntar: false });
  b.sinal('copia'); andar(cp);
  b.sinal('gravacao'); andar(gr);
  b.sinal('abertura'); andar(ab);
  const ao = serie[serie.length - 1][1];
  b.concluir();
  return { b, ao, rel: b.relatorio(), real: t - 1000, serie };
}
{
  let h = null; const res = [];
  for (const v of RELATO) {
    const r = simularAvisos(h, v);
    res.push({ mb: v[0], previsto: r.rel.previstoMs, real: r.real, ao: r.ao, caminho: r.rel.caminho, plato: r.rel.platoMs });
    checar(r.serie.every((x, i, a) => i === 0 || x[1] >= a[i - 1][1]), 'K · ' + v[0] + ' MB: nunca volta', null);
    h = P.aprender(h, Object.assign({ origem: 'tocar' }, r.b.amostra()));
  }
  checar(res.every((x) => x.caminho === 'novo'), 'K · nenhum download novo é "retomado" — o primeiro aviso de 1 MB é o primeiro grão, não o disco', res.map((x) => x.caminho));
  const ap = P.apoio(h);
  checar(ap.download === 4 && ap.latencia === 4, 'K · e os quatro ENSINAM a rede (ritmo e latência)', ap);
  const erros = res.slice(1).map((x) => Math.round(100 * (x.previsto - x.real) / x.real));
  checar(erros.every((e) => Math.abs(e) <= 20), 'K · do 2º ao 4º vídeo a previsão inicial erra no máximo 20% (era +55%, +70%, +115%)', erros);
  // (v1.12.39) A gravação deste Registro incluía a miniatura, e a estimativa
  // agora é um quantil sem peso de idade (mais conservadora com uma amostra só):
  // a régua é 85+, e o que falta até 100 o fim segurado varre (bloco Q).
  checar(res.slice(1).every((x) => x.ao >= 85), 'K · e eles TOCAM com a barra em 85+ (eram 58, 68 e 82)', res.map((x) => x.ao));
  checar(res.every((x) => x.plato <= 1500), 'K · e nenhum fica parado 1,5 s', res.map((x) => x.plato));
  const m = P.modelo(h, 'video');
  checar(m.bytesPorMs > 5 * MB / 1000 && m.gravacaoFixoMs >= 300,
    'K · o aprendido é o do aparelho: a rede acima de 5 MB/s e a gravação com um FIXO (a miniatura), não 0,1 s', m);
  // Um RETOMADO de verdade (60% no disco) no mesmo aviso de 1 MB: é retomado, e
  // ensina o ritmo mesmo assim.
  const rr = simularAvisos(h, [20, 2000, 1500, 0, 300, 100], { ja: 0.6 });
  const a = rr.b.amostra();
  checar(rr.rel.caminho === 'retomado' && a.downloadMs === undefined && a.ritmo > 0,
    'K · e um retomado de verdade (60% no disco) continua retomado — sem a duração dos bytes, com o ritmo', { caminho: rr.rel.caminho, a });
  checar(rr.rel.primeiroAviso && rr.rel.primeiroAviso.bytes > 12 * MB && rr.rel.primeiroAviso.esperado < 4 * MB,
    'K · e o relatório diz o que decidiu: o primeiro aviso contra o que o ritmo explica', rr.rel.primeiroAviso);
}

// ---- L · o tamanho antes de o shell dizer ------------------------------------------
{
  let h = null;
  for (let i = 0; i < P.APOIO_TAMANHO; i++) {
    h = P.aprender(h, { bytes: 8 * MB, segundos: 240, chave: 'video', downloadMs: 1000, preparoMs: 2000 });
    h = P.aprender(h, { bytes: 3 * MB, segundos: 240, chave: 'audio', downloadMs: 500, preparoMs: 2000 });
  }
  const mv = P.modelo(h, 'video'); const ma = P.modelo(h, 'audio');
  checar(mv.bytesTipicos === 8 * MB && ma.bytesTipicos === 3 * MB,
    'L · o tamanho típico é o da MESMA chave: um só áudio não diz quanto pesa um vídeo', [mv.bytesTipicos, ma.bytesTipicos]);
  checar(Math.round(mv.bytesPorSegundo) === Math.round(8 * MB / 240), 'L · e os bytes por segundo de vídeo são aprendidos', mv.bytesPorSegundo);
  // (v1.12.39) Com MENOS de `APOIO_TAMANHO` amostras o típico é misturado ao
  // padrão, e os bytes por segundo não valem: um vídeo de 3 MB fazia o seguinte,
  // de 13 MB, ser previsto com 3,4 MB.
  const um = P.modelo(P.aprender(null, { bytes: 3 * MB, segundos: 200, chave: 'video', downloadMs: 300 }), 'video');
  checar(um.bytesTipicos > 3 * MB + 0.5 * (P.PADRAO.bytesTipicos - 3 * MB) && um.bytesTipicos < P.PADRAO.bytesTipicos && um.bytesPorSegundo === 0,
    'L · com UMA amostra, o típico fica mais perto do padrão que dela, e a duração não é usada', [um.bytesTipicos / MB, um.bytesPorSegundo]);
  let t = 0;
  const b = P.criar({ modelo: mv, agora: () => t, juncao: false, abertura: false, chave: 'video' });
  const antes = b.restante();
  checar(b.relatorio().tamanhoFonte === 'historico' && b.relatorio().tamanhoPrevisto === 8 * MB,
    'L · antes da extração vale o típico aprendido, e o relatório diz que veio do histórico', b.relatorio());
  t += 2000; b.sinal('extraiu', { seconds: 600 });
  checar(b.restante() > antes, 'L · e a DURAÇÃO que chega com a extração (10 min contra 4) aumenta o que falta', [antes, b.restante()]);
  const b2 = P.criar({ modelo: P.modelo(null), agora: () => 0, chave: 'video' });
  checar(b2.relatorio().tamanhoFonte === 'padrao', 'L · e sem histórico o relatório diz "padrão"', b2.relatorio().tamanhoFonte);
}

// ---- M · o freio do pouso ------------------------------------------------------------
{
  // Uma barra RÁPIDA (o download acaba bem antes do previsto e a velocidade sobe)
  // e uma gravação que atrasa 1,5 s: ela freia no pouso em vez de ser carregada
  // pela inércia até o 99 e esperar lá.
  const mod = Object.assign({}, certo, { bytesTipicos: 8 * MB, gravacaoFixoMs: 400, gravacaoMsPorMB: 0, aberturaMs: 200, preparoMs: 2000, copiaFixoMs: 0, copiaMsPorMB: 0 });
  const rr = { preparo: 2000, download: 600, juncao: 0, copia: 0, gravacao: 1900, abertura: 200 };
  const r = simular({ modelo: mod, roteiro: rr, bytes: 8 * MB, juncao: false });
  const ate = r.serie.filter((x) => x[2] === 'gravacao').map((x) => x[1]);
  checar(Math.max(...ate) <= 97, 'M · uma barra rápida que chega ao pouso com a gravação atrasada FREIA: não passa de 97 na gravação', ate);
  checar(platoAte(r, 100) <= 1500, 'M · e não para lá: segue andando devagar', platoAte(r, 100));
}

// ---- N · a junção pesa o quanto ela costuma acontecer ----------------------------
{
  let h = null;
  for (let i = 0; i < 3; i++) h = P.aprender(h, { bytes: 6 * MB, chave: 'video', juntou: 0, copiaMs: 10 });
  checar(P.modelo(h).juncaoChance === 0, 'N · três vídeos que NÃO juntaram (360p progressivo): a junção não pesa', P.modelo(h).juncaoChance);
  h = P.aprender(h, { bytes: 60 * MB, chave: 'video', juntou: 1, juncaoMs: 2000 });
  const c = P.modelo(h).juncaoChance;
  checar(c > 0.3 && c < 1, 'N · e um que juntou volta a dar peso a ela, pela recência', c);
  const r = simular({ modelo: certo, roteiro: noRelogio(20), bytes: 20 * MB });
  checar(r.b.amostra().juntou === 1, 'N · e a amostra diz se juntou', r.b.amostra());
}

// ---- O · o ritmo medido vale já no segundo aviso -----------------------------------
{
  // O aprendido diz 2 MB/s; a rede entrega 10 MB/s. Um arquivo de 8 MB: o download
  // inteiro dura ~0,8 s, e esperar 2 s de medição seria nunca usá-la.
  const mod = Object.assign({}, certo, { bytesPorMs: 2 * MB / 1000, latenciaMs: 0 });
  let t = 0;
  const b = P.criar({ modelo: mod, agora: () => t, juncao: false, abertura: false, chave: 'video' });
  b.sinal('extraiu', {});
  const ms = (mb) => (mb * 1000) / 10;  // 10 MB/s
  for (const mb of [1, 2, 3]) { t = ms(mb); b.bytes(mb * MB + 40000, 8 * MB); }
  t += 20;
  const falta = b.restante() - (P.modelo(null).copiaFixoMs + 8 * P.modelo(null).copiaMsPorMB + P.modelo(null).gravacaoFixoMs + 8 * P.modelo(null).gravacaoMsPorMB);
  const real = ms(5);   // 5 MB a 10 MB/s
  checar(falta < 1.5 * real, 'O · no TERCEIRO aviso (0,3 s de bytes) o que falta do download já segue o ritmo medido, não o aprendido 5× mais lento',
    { estimado: Math.round(falta), real });
}

// ---- P · os cinco downloads de 720p do Registro de 15/10/2026 (v1.12.39) -----------
// MB · preparo · bytes · junção · cópia · gravação · abertura (ms), como o bloco
// "Barra do YouTube" os mediu. A gravação de 1,9 s e a de 1,5 s eram a MINIATURA
// (ela saiu do caminho: `miniaturaDepois` no `controle.js`).
const RELATO_720 = [[3.3, 1700, 600, 700, 30, 200, 200], [13, 3100, 700, 2000, 100, 1900, 200],
  [12, 2700, 700, 900, 100, 200, 100], [12, 2400, 1000, 1000, 30, 300, 100], [14, 3600, 600, 1400, 100, 1500, 100]];
function simular720(h, [mb, pre, dl, ju, cp, gr, ab]) {
  let t = 1000;
  const B = Math.round(mb * MB);
  const b = P.criar({ modelo: P.modelo(h, 'video'), agora: () => t, juncao: true, abertura: true, chave: 'video' });
  const serie = [];
  const andar = (ms, cada) => {
    for (let x = 0; x < ms; x += 10) { t += 10; if (cada) cada(x + 10); if (x % 100 === 90) serie.push([t, b.passo(), b.fase()]); }
  };
  andar(pre);
  b.sinal('extraiu', { seconds: Math.round(mb * 15) });
  let prox = MB;
  andar(dl, (e) => {
    const l = e <= 200 ? 0 : Math.min(B, Math.round(B * (e - 200) / (dl - 220)));
    while (l >= prox && prox < B) { b.bytes(prox + 40000, B); prox += MB; }
    if (l >= B && prox !== Infinity) { b.bytes(B, B); prox = Infinity; }
  });
  b.sinal('baixou', { bytes: B, juntar: true });
  andar(ju, (e) => b.sinal('juntando', { feito: Math.round(B * e / ju), total: B }));
  b.sinal('juntou', {});
  b.sinal('copia'); andar(cp);
  b.sinal('gravacao'); andar(gr);
  b.sinal('abertura');
  const pronto = b.valor();
  const segura = b.revelar();
  andar(Math.max(ab, segura));
  b.concluir();
  return { b, pronto, segura, serie, rel: b.relatorio(), real: t - 1000 };
}
{
  // P1 · UMA amostra fora da curva não vira a previsão seguinte.
  let h = null;
  for (const v of RELATO_720.slice(0, 2)) h = P.aprender(h, simular720(h, v).b.amostra());
  const m = P.modelo(h, 'video');
  const gravacao12 = m.gravacaoFixoMs + 12 * m.gravacaoMsPorMB;
  checar(gravacao12 < 1500, 'P · depois de uma gravação de 1,9 s (a outra de 0,2 s), a do vídeo seguinte NÃO é prevista em 1,9 s', Math.round(gravacao12));
  // P2 · o tamanho de UM vídeo pequeno não vira o do seguinte.
  const um = P.aprender(null, simular720(null, RELATO_720[0]).b.amostra());
  const b2 = P.criar({ modelo: P.modelo(um, 'video'), agora: () => 0, chave: 'video', juncao: true, abertura: true });
  checar(b2.relatorio().tamanhoPrevisto > 6 * MB, 'P · depois de UM vídeo de 3,3 MB, o seguinte não é previsto com 3,4 MB (era o defeito)',
    Math.round(b2.relatorio().tamanhoPrevisto / MB * 10) / 10);
  // P3 · o mesmo Registro SEM a miniatura no caminho (a gravação vira só o addMedia).
  let h2 = null; const res = [];
  for (const v of RELATO_720) {
    const r = simular720(h2, v.map((x, i) => (i === 5 ? Math.min(x, 250) : x)));
    const vals = r.serie.map((x) => x[1]);
    let plato = 0; let desde = r.serie[0][0];
    for (let i = 1; i < r.serie.length; i++) { if (vals[i] !== vals[i - 1]) desde = r.serie[i][0]; else if (vals[i] < 100) plato = Math.max(plato, r.serie[i][0] - desde); }
    res.push({ pronto: r.pronto, segura: r.segura, plato, volta: !vals.every((x, i) => i === 0 || x >= vals[i - 1]),
      erro: Math.round(100 * (r.rel.previstoMs - r.real) / r.real), fim: vals[vals.length - 1] });
    h2 = P.aprender(h2, r.b.amostra());
  }
  checar(res.every((x) => !x.volta), 'P · os cinco: nunca volta', null);
  checar(res.slice(1).every((x) => x.pronto >= 85), 'P · do 2º em diante a mídia fica pronta com a barra em 85+ (eram 96, 73, 92, 96 com paradas)', res.map((x) => x.pronto));
  checar(res.every((x) => x.plato <= 1500), 'P · e nenhum para 1,5 s (eram 1,8 s e 1,1 s)', res.map((x) => x.plato));
  checar(res.every((x) => x.segura <= P.SEGURA_MAX && (x.pronto >= P.POUSO) === (x.segura === 0)),
    'P · e o fim segura só abaixo do 95, nunca mais de ' + P.SEGURA_MAX + ' ms', res.map((x) => x.segura));
  checar(res.slice(1).every((x) => Math.abs(x.erro) <= 30), 'P · e do 2º em diante a previsão inicial erra no máximo 30% (o 2º era −57%)', res.map((x) => x.erro));
}

// ---- Q · o fim segurado ------------------------------------------------------------
{
  // Um modelo em que tudo é curto, menos a abertura: a barra pousa no fim dela.
  const curto = Object.assign({}, certo, { preparoMs: 300, latenciaMs: 0, bytesTipicos: MB, bytesPorMs: 1e5,
    copiaFixoMs: 0, copiaMsPorMB: 0, gravacaoFixoMs: 0, gravacaoMsPorMB: 0, aberturaMs: 2000 });
  const caso = (preparoMs, modelo = certo) => {
    let t = 0;
    const b = P.criar({ modelo, agora: () => t, juncao: false, abertura: true });
    for (let x = 0; x < preparoMs; x += 50) { t += 50; b.passo(); }
    b.sinal('abertura');
    const antes = b.valor();
    const ms = b.revelar();
    const vals = [];
    for (let x = 0; x < ms; x += 25) { t += 25; vals.push([x + 25, b.passo()]); }
    return { b, antes, ms, vals, t: () => t, andar: (d) => { t += d; return b.passo(); } };
  };
  const longe = caso(1000);
  checar(longe.antes < 60 && longe.ms === P.SEGURA_MAX, 'Q · longe do fim, a revelação espera o teto (' + P.SEGURA_MAX + ' ms)', [longe.antes, longe.ms]);
  checar(longe.vals.every(([x, v]) => (x < longe.ms ? v < 100 : v === 100)) && longe.vals.every((x, i, a) => i === 0 || x[1] >= a[i - 1][1]),
    'Q · e a barra VARRE até 100 exatamente nesse tempo: abaixo antes, 100 no fim, sem voltar', longe.vals.map((x) => x[1]));
  checar(longe.b.revelar() === 0, 'Q · e um segundo `revelar()` não segura de novo', null);
  longe.b.concluir();
  const fim = longe.andar(500);
  const rel = longe.b.relatorio();
  checar(fim === 100 && longe.b.terminou() && rel.segurouMs === P.SEGURA_MAX && rel.aoConcluir === longe.antes,
    'Q · o concluir depois dela fica em 100, e o relatório diz quanto segurou e o número na hora de abrir', rel);
  const perto = caso(4000, curto);
  checar(perto.antes >= P.POUSO && perto.ms === 0 && perto.b.valor() < 100,
    'Q · com a barra no 95 ou acima não segura nada, e ela continua abaixo de 100 até o concluir', [perto.antes, perto.ms, perto.b.valor()]);
  // Proporcional: entre os dois, cresce com o que falta.
  const meio = caso(1400, curto);
  checar(meio.ms > 0 && meio.ms < P.SEGURA_MAX && meio.antes > longe.antes && meio.antes < P.POUSO,
    'Q · e no meio a espera é proporcional ao que falta', [meio.antes, meio.ms]);
}

// ---- R · a rede que DESABA no meio dos bytes: o Registro de 15/10, 12h37 (v1.12.40) --
// MB · preparo · 1º aviso · bytes · junção · cópia · gravação · abertura (ms), como o
// bloco "Barra do YouTube" os mediu. O 2º e o 4º: o primeiro MB em 0,2 e 0,7 s e
// o resto a 0,3–0,4 MB/s, contra ~20 MB/s aprendidos — a barra chegava ao 99
// DURANTE os bytes e ficava lá 5,1 e 9,2 s. O histórico de partida é o "Aprendido"
// daquele Registro (10 amostras: rede 19,8 MB/s + 0,2 s, preparo 3,0 s, junção
// 0,4 s + 80 ms/MB, abertura 0,1 s, vídeo típico ~11 MB).
const RELATO_REDE = [[3, 2500, 200, 300, 700, 0, 0, 500], [7, 2800, 200, 19400, 800, 0, 0, 100],
  [10, 3500, 400, 700, 1400, 0, 100, 100], [12, 2400, 700, 25100, 1300, 100, 100, 100], [8, 3400, 400, 2000, 1600, 0, 100, 100]];
function historicoDoRegistro() {
  let h = null;
  const rede = 19.8 * MB / 1000;
  for (let i = 0; i < 10; i++) {
    const mb = 9 + (i % 4);
    h = P.aprender(h, { chave: 'video', bytes: mb * MB, ritmo: rede, downloadMs: 200 + (mb * MB) / rede, preparoMs: 3000,
      juntou: 1, juncaoMs: 400 + 80 * mb, copiaMs: 3 * mb, gravacaoMs: 7 * mb, aberturaMs: 100 });
  }
  return h;
}
function simularRede(h, [mb, pre, prim, dl, ju, cp, gr, ab]) {
  let t = 1000;
  const B = Math.round(mb * MB);
  const b = P.criar({ modelo: P.modelo(h, 'video'), agora: () => t, juncao: true, abertura: true, chave: 'video' });
  const serie = [];
  const andar = (ms, cada) => {
    for (let x = 0; x < ms; x += 10) { t += 10; if (cada) cada(x + 10); if (x % 100 === 90) serie.push([t, b.passo(), b.fase()]); }
  };
  andar(pre);
  b.sinal('extraiu', {});
  let prox = MB;
  let restante2s = null;
  andar(dl, (e) => {
    if (e === prim + 2000) restante2s = b.restante();
    const l = e < prim ? 0 : Math.min(B, MB + 40000 + Math.round((B - MB - 40000) * (e - prim) / Math.max(1, dl - prim - 10)));
    while (l >= prox && prox < B) { b.bytes(prox + 40000, B); prox += MB; }
    if (l >= B && prox !== Infinity) { b.bytes(B, B); prox = Infinity; }
  });
  b.sinal('baixou', { bytes: B, juntar: true });
  andar(ju, (e) => b.sinal('juntando', { feito: Math.round(B * e / ju), total: B }));
  b.sinal('juntou', {});
  b.sinal('copia'); andar(cp);
  b.sinal('gravacao'); andar(gr);
  b.sinal('abertura');
  const pronto = b.valor();
  const segura = b.revelar();
  andar(Math.max(ab, segura));
  b.concluir();
  const rel = b.relatorio();
  const vals = serie.map((x) => x[1]);
  let plato = 0; let desde = serie[0][0];
  for (let i = 1; i < serie.length; i++) { if (vals[i] !== vals[i - 1]) desde = serie[i][0]; else if (vals[i] < 100) plato = Math.max(plato, serie[i][0] - desde); }
  const nosBytes = serie.filter((x) => x[2] === 'download').map((x) => x[1]);
  return { b, rel, pronto, segura, plato, restante2s, volta: !vals.every((x, i) => i === 0 || x >= vals[i - 1]),
    maxBytes: Math.max(...nosBytes), fimBytes: rel.fases.download ? rel.fases.download.mostrado : null };
}
const resRede = (() => {
  let h = historicoDoRegistro(); const res = [];
  for (const v of RELATO_REDE) { const r = simularRede(h, v); res.push(r); h = P.aprender(h, Object.assign({ origem: 'tocar' }, r.b.amostra())); }
  return res;
})();
if (process.env.REPLAY) console.log(JSON.stringify(resRede.map((r) => ({ pronto: r.pronto, segura: r.segura, plato: r.plato, maxBytes: r.maxBytes, fimBytes: r.fimBytes, fatia: r.rel.fatiaDownload }))));
{
  const lentos = [resRede[1], resRede[3]];
  checar(resRede.every((r) => !r.volta), 'R · os cinco: nunca volta', null);
  checar(lentos.every((r) => r.plato <= 1500), 'R · nos dois downloads LENTOS (7 e 12 MB a 0,3–0,4 MB/s) a barra não para 1,5 s (eram 5,1 e 9,2 s no 99)', lentos.map((r) => r.plato));
  checar(lentos.every((r) => r.maxBytes <= P.POUSO - 2), 'R · e durante os bytes ela não corre ao 99: fica abaixo do pouso, com lugar para o que vem depois', lentos.map((r) => r.maxBytes));
  checar(lentos.every((r) => r.rel.fatiaDownload && r.rel.fatiaDownload.fim != null && r.fimBytes <= r.rel.fatiaDownload.fim && r.fimBytes <= P.POUSO - 2),
    'R · e no fim dos bytes o valor está DENTRO da fatia do download — as fases seguintes guardam o lugar delas',
    lentos.map((r) => [r.fimBytes, r.rel.fatiaDownload]));
  checar(lentos.every((r) => r.rel.avisosMaiorVaoMs >= 2000 && r.rel.piorJanelaBytesPorMs < 0.6 * MB / 1000),
    'R · e o relatório diz o maior vão entre avisos e o ritmo da pior janela de 2 s', lentos.map((r) => [r.rel.avisosMaiorVaoMs, r.rel.piorJanelaBytesPorMs]));
  // O que falta, 2 s depois do primeiro MB, sem aviso novo: o silêncio limita o
  // ritmo (menos de 1 MB em 2 s), e a previsão cresce — antes ela seguia o
  // aprendido (20 MB/s) e dizia ~1 s até o aviso seguinte.
  checar(lentos.every((r) => r.restante2s > 6000), 'R · e 2 s de silêncio depois do 1º MB já fazem o que falta passar de 6 s (o ritmo vivo, não o aprendido)',
    lentos.map((r) => Math.round(r.restante2s)));
  const normais = [resRede[0], resRede[2], resRede[4]];
  checar(normais.every((r) => r.plato <= 1500), 'R · os três normais continuam sem parar 1,5 s', normais.map((r) => r.plato));
  checar([resRede[2], resRede[4]].every((r) => r.pronto >= 85), 'R · e o 3º e o 5º ficam prontos com 85+ (eram 95 e 95)', normais.map((r) => r.pronto));
}

if (falhas.length) { console.log('\n' + falhas.length + ' falha(s).'); process.exit(1); }
console.log('\nTodos passaram.');
