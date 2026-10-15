// ============================================================================
// O PROGRESSO DO TOQUE À TELA (v1.12.36) — a regra do percentual do YouTube
//
// Pedido do operador: o percentual de um "Tocar agora" mede o caminho INTEIRO,
// do toque até a mídia estar tocando — não os bytes do arquivo. Contínuo,
// fluido, que nunca volta e nunca congela, e que só chega a 100 quando a mídia
// está de fato pronta.
//
// ## As fases
//
//   preparo   do toque ao primeiro byte (a extração no shell, ~2 s)
//   download  os bytes (o `__avYtProgress` do shell)
//   juncao    o `MuxMp4` juntando vídeo e som (o `__avYtFase` 'juntando')
//   copia     o `fetch` + `blob` do arquivo do shell para o lado web
//   gravacao  a miniatura e o `addMedia` (IndexedDB/OPFS)
//   abertura  o `send` até a mídia tocar (só no "Tocar agora")
//
// ## O peso de cada fase é APRENDIDO
//
// Cada download que termina deixa uma AMOSTRA (a duração de cada fase que ele
// viu) e o modelo é a MEDIANA das últimas. Duração de fase que depende do
// tamanho (bytes, junção, cópia, gravação) é guardada como TAXA, para valer
// para um vídeo de outro tamanho. Sem amostra, valem os `PADRAO`.
//
// ## A CAMADA DE EXIBIÇÃO
//
// O alvo é `decorrido / (decorrido + restante previsto)` — linear no tempo
// quando a previsão acerta. O que se MOSTRA persegue o alvo (alcança um pouco
// quando a fase adianta) e, quando ela atrasa, desacelera ASSINTOTICAMENTE
// rumo ao `TETO` — anda sempre, nunca o passa antes do `concluir()`, e o
// `concluir()` fecha o trecho final em fração de segundo, sem esperar nada.
//
// PURO: não toca em DOM, rede nem banco; o relógio chega injetado (`agora`).
// Oráculo: `tools/progresso.test.mjs` (Node puro, sem `continue-on-error`).
// ============================================================================
(function (global) {
  'use strict';

  const FASES = ['preparo', 'download', 'juncao', 'copia', 'gravacao', 'abertura'];
  const MB = 1024 * 1024;
  // Os números da primeira vez, antes de haver amostra: uma rede de igreja
  // razoável (2 MB/s) e um aparelho médio.
  const PADRAO = Object.freeze({
    preparoMs: 2500,
    bytesPorMs: 2000,
    juncaoMsPorMB: 60,
    copiaMsPorMB: 15,
    gravacaoMsPorMB: 25,
    aberturaMs: 900,
    bytesTipicos: 60 * MB,
  });
  // O que uma amostra pode ensinar, com o intervalo são de cada número: um
  // valor fora dele é medição quebrada (relógio, aba suspensa), não aprendizado.
  const LIMITES = Object.freeze({
    preparoMs: [200, 30000],
    bytesPorMs: [20, 200000],
    juncaoMsPorMB: [1, 2000],
    copiaMsPorMB: [1, 2000],
    gravacaoMsPorMB: [1, 2000],
    aberturaMs: [100, 10000],
    bytesTipicos: [MB, 4096 * MB],
  });
  const AMOSTRAS = 12;
  // O que se mostra antes do fim fica ABAIXO disto (o inteiro máximo é 97).
  const TETO = 98;
  const TAU_ALCANCE = 700;     // ms — quão rápido alcança o alvo quando adianta
  const TAU_FIM = 90;          // ms — o trecho final depois do `concluir()`
  const TAU_LENTO_MIN = 6000;  // ms — a deriva mínima, que impede o congelamento

  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : NaN);
  const entre = (v, [a, b]) => Math.min(b, Math.max(a, v));

  function mediana(xs) {
    const v = xs.filter((x) => isFinite(x)).sort((a, b) => a - b);
    if (!v.length) return NaN;
    const m = v.length >> 1;
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  }

  /** O histórico gravado, saneado: sempre `{ v: 1, amostras: [] }`. */
  function sanear(hist) {
    const lista = hist && Array.isArray(hist.amostras) ? hist.amostras : [];
    return { v: 1, amostras: lista.filter((a) => a && typeof a === 'object').slice(-AMOSTRAS) };
  }

  const CAMPOS = ['preparoMs', 'downloadMs', 'bytes', 'juncaoMs', 'copiaMs', 'gravacaoMs', 'aberturaMs'];

  /** Uma amostra nova no fim, as velhas saindo pelo começo. PURA e síncrona. */
  function aprender(hist, amostra) {
    const h = sanear(hist);
    if (!amostra || typeof amostra !== 'object') return h;
    const limpa = {};
    for (const c of CAMPOS) {
      const v = num(amostra[c]);
      if (v >= 0) limpa[c] = Math.round(v);
    }
    if (amostra.origem) limpa.origem = String(amostra.origem).slice(0, 16);
    if (!Object.keys(limpa).some((c) => c !== 'origem')) return h;
    h.amostras = h.amostras.concat([limpa]).slice(-AMOSTRAS);
    return h;
  }

  /** Os parâmetros que valem agora: a mediana das amostras, ou o padrão. */
  function modelo(hist) {
    const am = sanear(hist).amostras;
    const porMB = (campo) => mediana(am
      .filter((a) => a[campo] > 0 && a.bytes > 0)
      .map((a) => a[campo] / (a.bytes / MB)));
    const cru = {
      preparoMs: mediana(am.map((a) => num(a.preparoMs))),
      bytesPorMs: mediana(am
        .filter((a) => a.bytes > 0 && a.downloadMs >= 200)
        .map((a) => a.bytes / a.downloadMs)),
      juncaoMsPorMB: porMB('juncaoMs'),
      copiaMsPorMB: porMB('copiaMs'),
      gravacaoMsPorMB: porMB('gravacaoMs'),
      aberturaMs: mediana(am.map((a) => num(a.aberturaMs))),
      bytesTipicos: mediana(am.map((a) => num(a.bytes)).filter((b) => b > 0)),
    };
    const m = {};
    for (const k of Object.keys(PADRAO)) {
      m[k] = isFinite(cru[k]) ? entre(cru[k], LIMITES[k]) : PADRAO[k];
    }
    return m;
  }

  /**
   * Uma barra para UM trabalho. `juncao`: espera-se a montagem de vídeo + som;
   * `abertura`: o trabalho termina com a mídia tocando.
   */
  function criar(opts) {
    const o = opts || {};
    const agora = typeof o.agora === 'function' ? o.agora : () => Date.now();
    let m = Object.assign({}, PADRAO, o.modelo || {});
    const t0 = agora();
    const inicio = { preparo: t0 };
    const fim = {};
    let atual = 'preparo';
    // As fases que ainda podem acontecer. Pular uma (o vídeo sem junção) a
    // tira daqui, e a previsão encurta.
    const previstas = FASES.filter((f) => (f !== 'juncao' || o.juncao) && (f !== 'abertura' || o.abertura));
    let total = 0;
    let lidos = 0;
    let muxFeito = 0;
    let muxTotal = 0;
    let s = 0;
    let ultimo = t0;
    let concluido = false;

    const idx = (f) => FASES.indexOf(f);
    const tamanho = () => (total > 0 ? total : m.bytesTipicos);

    function duracao(f) {
      const mb = tamanho() / MB;
      switch (f) {
        case 'preparo': return m.preparoMs;
        case 'download': return tamanho() / m.bytesPorMs;
        case 'juncao': return mb * m.juncaoMsPorMB;
        case 'copia': return mb * m.copiaMsPorMB;
        case 'gravacao': return mb * m.gravacaoMsPorMB;
        case 'abertura': return m.aberturaMs;
        default: return 0;
      }
    }

    function fracao() {
      if (atual === 'download') return total > 0 ? Math.min(1, lidos / total) : -1;
      if (atual === 'juncao') return muxTotal > 0 ? Math.min(1, muxFeito / muxTotal) : -1;
      return -1;
    }

    function restanteDaAtual(t) {
      const D = Math.max(1, duracao(atual));
      const e = Math.max(0, t - inicio[atual]);
      // Sem fração conhecida: o relógio da previsão e, passada ela, uma cauda
      // que encolhe sem nunca chegar a zero (contínua em 0,8·D).
      const peloRelogio = e < 0.8 * D ? D - e : 0.2 * D * Math.exp(-(e - 0.8 * D) / D);
      const f = fracao();
      if (f > 0.02 && e > 250) {
        const medido = e * (1 - f) / f;
        const w = Math.min(1, f / 0.15);
        return w * medido + (1 - w) * D * (1 - f);
      }
      return peloRelogio;
    }

    function restante(t) {
      let r = restanteDaAtual(t);
      for (const f of previstas) if (idx(f) > idx(atual)) r += Math.max(0, duracao(f));
      return r;
    }

    function alvo(t) {
      const e = Math.max(0, t - t0);
      const r = restante(t);
      return e + r > 0 ? (100 * e) / (e + r) : 0;
    }

    function entrar(nome, t) {
      if (concluido || idx(nome) < 0 || idx(nome) <= idx(atual)) return;
      const quando = t == null ? agora() : t;
      fim[atual] = quando;
      for (let i = previstas.length - 1; i >= 0; i--) {
        const f = previstas[i];
        if (idx(f) > idx(atual) && idx(f) < idx(nome)) previstas.splice(i, 1);
      }
      atual = nome;
      inicio[nome] = quando;
    }

    function valor() {
      if (concluido) return s >= 100 ? 100 : Math.max(0, Math.floor(s));
      return Math.max(0, Math.min(TETO - 1, Math.floor(s)));
    }

    return {
      /** Avança a exibição até `agora()` e devolve o inteiro a mostrar. */
      passo() {
        const t = agora();
        const dt = Math.max(0, Math.min(2000, t - ultimo));
        ultimo = t;
        if (concluido) {
          s += (100 - s) * (1 - Math.exp(-dt / TAU_FIM));
          if (100 - s < 0.5) s = 100;
          return valor();
        }
        const a = Math.min(alvo(t), TETO);
        const alcance = a > s ? (a - s) * (1 - Math.exp(-dt / TAU_ALCANCE)) : 0;
        const lento = Math.max(TAU_LENTO_MIN, 2 * restante(t));
        const deriva = (TETO - s) * (1 - Math.exp(-dt / lento));
        s = Math.min(TETO - 1e-6, s + Math.max(alcance, deriva));
        return valor();
      },
      valor,
      fase: () => atual,
      terminou: () => concluido && s >= 100,
      trocarModelo(novo) { if (novo) m = Object.assign({}, PADRAO, novo); },
      /** Um sinal do shell (`extraiu`, `baixou`, `juntando`, `juntou`) ou do web. */
      sinal(nome, info) {
        const i = info || {};
        if (nome === 'extraiu') entrar('download');
        else if (nome === 'baixou') {
          if (num(i.bytes) > 0) { total = Math.max(total, i.bytes); lidos = total; }
          if (i.juntar) entrar('juncao');
        } else if (nome === 'juntando') {
          entrar('juncao');
          if (num(i.total) > 0) { muxTotal = i.total; muxFeito = Math.max(muxFeito, num(i.feito) || 0); }
        } else if (nome === 'juntou') {
          if (muxTotal > 0) muxFeito = muxTotal;
        } else if (FASES.includes(nome)) entrar(nome);
      },
      /** Os bytes do download (o `onProgresso` do `ytFetch`). */
      bytes(l, tot) {
        if (idx(atual) < idx('download')) entrar('download');
        if (atual !== 'download') return;
        if (num(tot) > 0) total = tot;
        if (num(l) > lidos) lidos = l;
      },
      concluir() {
        if (concluido) return;
        fim[atual] = agora();
        concluido = true;
      },
      /**
       * O que este trabalho ensina. As fases do download só contam se ele de
       * fato aconteceu (um arquivo reaproveitado não diz nada sobre a rede); a
       * abertura conta sempre que foi vista inteira.
       */
      amostra() {
        if (!concluido) return null;
        const d = (f) => (inicio[f] != null && fim[f] != null ? fim[f] - inicio[f] : undefined);
        const a = {};
        if (d('download') != null && total > 0) {
          a.bytes = total;
          a.preparoMs = d('preparo');
          a.downloadMs = d('download');
          if (d('juncao') != null) a.juncaoMs = d('juncao');
          if (d('copia') != null) a.copiaMs = d('copia');
          if (d('gravacao') != null) a.gravacaoMs = d('gravacao');
        }
        if (d('abertura') != null) a.aberturaMs = d('abertura');
        return Object.keys(a).length ? a : null;
      },
    };
  }

  global.AVProgresso = {
    FASES, PADRAO, LIMITES, AMOSTRAS, TETO,
    sanear, aprender, modelo, criar, mediana,
  };
})(this);
