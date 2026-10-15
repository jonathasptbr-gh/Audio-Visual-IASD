// ============================================================================
// O PROGRESSO DO TOQUE À TELA — a regra do percentual do YouTube
// (v1.12.36; a camada de exibição refeita na v1.12.37)
//
// Pedido do operador: o percentual de um "Tocar agora" mede o caminho INTEIRO,
// do toque até a mídia estar tocando — não os bytes do arquivo. E a régua da
// v1.12.37, depois de quatro vídeos num aparelho de verdade: *velocidade
// visualmente estável, sem paradas e sem inconsistência* — parar em 97 e abrir
// o vídeo com a barra em 75 tornam o número inútil.
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
// ## A ESTIMATIVA do que falta (`restante`)
//
// - preparo e abertura: tempo FIXO aprendido (ms);
// - download: bytes que faltam ÷ o ritmo MEDIDO nos últimos segundos, misturado
//   ao ritmo aprendido enquanto a medição é curta;
// - junção, cópia, gravação: ms POR MB aprendidos × o tamanho (a junção usa a
//   fração do `MuxMp4` quando ela chega).
// Uma fase que passa da previsão não "acaba": o que falta dela CRESCE com o
// atraso, e a barra desacelera em vez de bater num teto.
//
// ## A EXIBIÇÃO é um controle de VELOCIDADE, não de posição
//
// A velocidade-alvo é a que leva o valor mostrado a `POUSO` (95) no instante
// previsto do fim; a velocidade real persegue essa alvo com inércia (`TAU_V`),
// então muda AOS POUCOS, e tem um PISO que nunca a deixa parar (ele decai só
// perto do `CAP`, que nunca é alcançado: o inteiro máximo antes do fim é 99).
// Passado o ponto de pouso (o fim atrasou), a meta vira "metade do que resta até
// o CAP no tempo que ainda se estima" — anda devagar, mas anda. O `concluir()`
// fecha com uma VARREDURA de poucas centenas de ms (`VARREDURA_*`) — nunca um
// salto, e nunca segurando a mídia: ela já está tocando quando ele é chamado.
//
// ## O que se APRENDE
//
// Cada trabalho que termina deixa uma amostra (`amostra()`), e o modelo é a
// MEDIANA das últimas `AMOSTRAS`. Só entra o que é COMPARÁVEL: um arquivo que já
// estava no aparelho só ensina a abertura; um download RETOMADO (parte dos bytes
// já estava no disco) não ensina o ritmo da rede; uma fase do lado WEB (cópia,
// gravação, abertura) vivida com o app minimizado — o WebView estrangulado — não
// ensina nada; e a abertura que venceu o prazo sem ver o play também não.
//
// `relatorio()` devolve o diagnóstico do trabalho (fase a fase: o previsto, o
// real e o número mostrado no fim de cada uma; o maior platô; o salto final),
// que o `controle.js` leva ao Registro.
//
// PURO: não toca em DOM, rede nem banco; o relógio chega injetado (`agora`).
// Oráculo: `tools/progresso.test.mjs` (Node puro, sem `continue-on-error`).
// ============================================================================
(function (global) {
  'use strict';

  const FASES = ['preparo', 'download', 'juncao', 'copia', 'gravacao', 'abertura'];
  const FASES_WEB = ['copia', 'gravacao', 'abertura'];
  const MB = 1024 * 1024;
  // Os números da primeira vez, antes de haver amostra: uma rede de igreja
  // razoável (2 MB/s) e um aparelho médio.
  const PADRAO = Object.freeze({
    preparoMs: 2500,
    bytesPorMs: 2000,
    juncaoMsPorMB: 40,
    copiaMsPorMB: 25,
    gravacaoMsPorMB: 40,
    aberturaMs: 1200,
    bytesTipicos: 40 * MB,
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
  // A versão do HISTÓRICO gravado. A v1 (v1.12.36) misturava amostras que a v2
  // recusa (cópia e gravação com o app minimizado, downloads retomados, a
  // abertura que venceu o prazo) — e não há como separá-las depois: ela recomeça.
  const VERSAO = 2;

  // A exibição. Unidades: valor em pontos (0–100), velocidade em pontos por ms.
  const POUSO = 95;          // onde o valor deve estar no instante previsto do fim
  const CAP = 99.6;          // nunca alcançado antes do `concluir()`
  const PISO_V = 0.30 / 1000;  // 0,3 ponto/s: um inteiro novo a cada ~3,3 s, no pior caso
  const PISO_DESDE = 98;     // acima disto o piso decai junto com o que resta até o CAP
  const V_MAX = 60 / 1000;   // 60 pontos/s: nem o caminho instantâneo vira um salto
  const TAU_V = 800;         // ms — a inércia da velocidade
  const RESTANTE_MIN = 150;  // ms — o que falta nunca é zero antes do fim
  const VARREDURA_MIN = 150; // ms — a varredura final, entre estes dois
  const VARREDURA_MAX = 450;
  const JANELA_RITMO = 3000; // ms — o ritmo medido do download olha para trás isto

  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : NaN);
  const entre = (v, [a, b]) => Math.min(b, Math.max(a, v));

  function mediana(xs) {
    const v = xs.filter((x) => isFinite(x)).sort((a, b) => a - b);
    if (!v.length) return NaN;
    const m = v.length >> 1;
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  }

  /** O histórico gravado, saneado: sempre `{ v: VERSAO, amostras: [] }`. Outra versão recomeça. */
  function sanear(hist) {
    const lista = hist && hist.v === VERSAO && Array.isArray(hist.amostras) ? hist.amostras : [];
    return { v: VERSAO, amostras: lista.filter((a) => a && typeof a === 'object').slice(-AMOSTRAS) };
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
    if (!Object.keys(limpa).length) return h;
    if (amostra.origem) limpa.origem = String(amostra.origem).slice(0, 16);
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

  /** Quantas amostras sustentam cada número do modelo (para o Registro). */
  function apoio(hist) {
    const am = sanear(hist).amostras;
    const conta = (c) => am.filter((a) => num(a[c]) >= 0).length;
    return { n: am.length, preparo: conta('preparoMs'), download: am.filter((a) => a.bytes > 0 && a.downloadMs >= 200).length,
      juncao: conta('juncaoMs'), copia: conta('copiaMs'), gravacao: conta('gravacaoMs'), abertura: conta('aberturaMs') };
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
    const previsto = {};      // a duração prevista de cada fase, no instante em que ela começou
    const mostradoNoFim = {}; // o número mostrado quando cada fase acabou
    let atual = 'preparo';
    const previstas = FASES.filter((f) => (f !== 'juncao' || o.juncao) && (f !== 'abertura' || o.abertura));
    let total = 0;
    let lidos = 0;
    let primeiroLido = -1;   // o primeiro `lidos` visto: grande = download RETOMADO
    let tPrimeiroByte = 0;
    let tCheio = 0;          // quando a fração da fase atual chegou a 1 sem a fase acabar
    const ritmo = [];        // [t, lidos] da janela do ritmo medido
    let muxFeito = 0;
    let muxTotal = 0;
    let s = 0;               // o valor exibido, contínuo
    let v = -1;              // a velocidade exibida (pontos/ms); -1 = ainda não começou
    let ultimo = t0;
    let ultimoInteiro = 0;
    let tUltimaMudanca = t0;
    let plato = 0;
    let previstoInicial = 0;
    let concluido = false;
    let tConcluir = 0;
    let sConcluir = 0;
    let varredura = 0;
    let tocou = true;
    let escondida = !!o.oculta; // a página está oculta agora
    let oculto = false;      // a página esteve oculta durante alguma fase web

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

    // O que falta de uma fase SEM fração conhecida: a previsão enquanto ela vale;
    // passada (3/4 dela), o que falta CRESCE com o atraso — contínuo em 3/4.
    function peloRelogio(D, e) {
      return Math.max(D - e, 0.25 * D + 0.3 * (e - 0.75 * D));
    }

    function ritmoMedido(t) {
      while (ritmo.length > 2 && t - ritmo[1][0] >= JANELA_RITMO) ritmo.shift();
      if (ritmo.length < 2) return NaN;
      const [ta, la] = ritmo[0];
      const [tb, lb] = ritmo[ritmo.length - 1];
      const dt = Math.max(t, tb) - ta;
      return dt >= 400 ? (lb - la) / dt : NaN;
    }

    function restanteDaAtual(t) {
      const D = Math.max(1, duracao(atual));
      const e = Math.max(0, t - inicio[atual]);
      if (atual === 'download') {
        if (!(total > 0) || primeiroLido < 0) return peloRelogio(D, e);
        const falta = Math.max(0, total - lidos);
        if (falta <= 0) return RESTANTE_MIN + 0.3 * Math.max(0, t - tCheio);
        const medido = ritmoMedido(t);
        const conf = isFinite(medido) && medido > 0 ? Math.min(1, (t - tPrimeiroByte) / 2000) : 0;
        const r = conf * (isFinite(medido) ? medido : 0) + (1 - conf) * m.bytesPorMs;
        return falta / Math.max(1e-3, r);
      }
      if (atual === 'juncao' && muxTotal > 0) {
        const f = Math.min(1, muxFeito / muxTotal);
        if (f >= 1) return RESTANTE_MIN + 0.3 * Math.max(0, t - tCheio);
        const pelaPrevisao = D * (1 - f);
        if (f > 0.05 && e > 300) {
          const medido = (e * (1 - f)) / f;
          const w = Math.min(1, f / 0.3);
          return w * medido + (1 - w) * pelaPrevisao;
        }
        return Math.max(pelaPrevisao, peloRelogio(D, e) * (1 - f));
      }
      return peloRelogio(D, e);
    }

    function restante(t) {
      let r = restanteDaAtual(t);
      for (const f of previstas) if (idx(f) > idx(atual)) r += Math.max(0, duracao(f));
      return Math.max(RESTANTE_MIN, r);
    }

    function entrar(nome, t) {
      if (concluido || idx(nome) < 0 || idx(nome) <= idx(atual)) return;
      const quando = t == null ? agora() : t;
      fim[atual] = quando;
      mostradoNoFim[atual] = Math.floor(s);
      for (let i = previstas.length - 1; i >= 0; i--) {
        const f = previstas[i];
        if (idx(f) > idx(atual) && idx(f) < idx(nome)) previstas.splice(i, 1);
      }
      atual = nome;
      inicio[nome] = quando;
      tCheio = 0;
      previsto[nome] = Math.round(duracao(nome));
      if (escondida && FASES_WEB.includes(nome)) oculto = true;
    }

    function valor() {
      if (concluido) return s >= 100 ? 100 : Math.max(0, Math.floor(s));
      return Math.max(0, Math.min(99, Math.floor(s)));
    }

    // Antes do pouso: chegar a `POUSO` no fim previsto. Depois dele (o fim
    // atrasou): um terço do que resta até o CAP no tempo que ainda se estima MAIS
    // o atraso já vivido — uma fase nova e curta não pode fazer a barra correr de
    // novo para o CAP e parar lá (era o "97 parado" da v1.12.36).
    let tPouso = 0;
    function velocidadeAlvo(t) {
      const r = restante(t);
      let vMeta;
      if (s < POUSO) vMeta = (POUSO - s) / r;
      else {
        if (!tPouso) tPouso = t;
        vMeta = ((CAP - s) / 3) / (r + (t - tPouso) + 1000);
      }
      const piso = PISO_V * Math.min(1, Math.max(0, CAP - s) / (CAP - PISO_DESDE));
      return Math.min(V_MAX, Math.max(vMeta, piso));
    }

    previsto.preparo = Math.round(duracao('preparo'));
    previstoInicial = Math.round(restante(t0));

    return {
      /** Avança a exibição até `agora()` e devolve o inteiro a mostrar. */
      passo() {
        const t = agora();
        const dt = Math.max(0, Math.min(2000, t - ultimo));
        ultimo = t;
        if (concluido) {
          const u = Math.min(1, (t - tConcluir) / varredura);
          s = u >= 1 ? 100 : sConcluir + (100 - sConcluir) * (1 - (1 - u) * (1 - u));
          return valor();
        }
        const alvo = velocidadeAlvo(t);
        if (v < 0) v = alvo;
        else v += (alvo - v) * (1 - Math.exp(-dt / TAU_V));
        s = Math.min(CAP - 1e-6, s + v * dt);
        const inteiro = valor();
        if (inteiro !== ultimoInteiro) { ultimoInteiro = inteiro; tUltimaMudanca = t; }
        else plato = Math.max(plato, t - tUltimaMudanca);
        return inteiro;
      },
      valor,
      /** O valor CONTÍNUO e a velocidade (pontos/s) — para o oráculo medir a suavidade. */
      bruto: () => ({ s, v: Math.max(0, v) * 1000 }),
      fase: () => atual,
      terminou: () => concluido && s >= 100,
      trocarModelo(novo) {
        if (!novo) return;
        m = Object.assign({}, PADRAO, novo);
        if (!fim[atual]) previsto[atual] = Math.round(duracao(atual));
        if (atual === 'preparo') previstoInicial = Math.round(restante(agora()));
      },
      /** A página ficou oculta (ou voltou): as fases web vividas oculta não ensinam nada. */
      oculta(sim) {
        escondida = !!sim;
        if (escondida && FASES_WEB.includes(atual)) oculto = true;
      },
      /** Um sinal do shell (`extraiu`, `baixou`, `juntando`, `juntou`) ou do web. */
      sinal(nome, info) {
        const i = info || {};
        const t = agora();
        if (nome === 'extraiu') entrar('download');
        else if (nome === 'baixou') {
          if (num(i.bytes) > 0) { total = Math.max(total, i.bytes); lidos = total; }
          if (i.juntar) entrar('juncao');
        } else if (nome === 'juntando') {
          entrar('juncao');
          if (num(i.total) > 0) {
            muxTotal = i.total; muxFeito = Math.max(muxFeito, num(i.feito) || 0);
            if (muxFeito >= muxTotal && !tCheio) tCheio = t;
          }
        } else if (nome === 'juntou') {
          if (muxTotal > 0) { muxFeito = muxTotal; if (!tCheio) tCheio = t; }
        } else if (FASES.includes(nome)) entrar(nome);
      },
      /** Os bytes do download (o `onProgresso` do `ytFetch`). */
      bytes(l, tot) {
        if (idx(atual) < idx('download')) entrar('download');
        if (atual !== 'download') return;
        const t = agora();
        if (num(tot) > 0) {
          const antes = total;
          total = tot;
          // O total MUDOU (a previsão do vídeo virou o tamanho de verdade): a
          // previsão desta fase é refeita com o tamanho que vale.
          if (antes > 0 && Math.abs(tot - antes) > 0.02 * antes) previsto.download = Math.round(tot / m.bytesPorMs);
          else if (!(antes > 0)) previsto.download = Math.round(tot / m.bytesPorMs);
        }
        const lv = num(l);
        if (!(lv >= 0)) return;
        if (primeiroLido < 0) { primeiroLido = lv; tPrimeiroByte = t; }
        if (lv > lidos) lidos = lv;
        ritmo.push([t, lidos]);
        if (total > 0 && lidos >= total && !tCheio) tCheio = t;
      },
      /**
       * A mídia está pronta. `opcoes.tocou === false`: a abertura venceu o prazo
       * sem ver o play — o fim vale, a amostra da abertura não.
       */
      concluir(opcoes) {
        if (concluido) return;
        const t = agora();
        if (opcoes && opcoes.tocou === false) tocou = false;
        fim[atual] = t;
        mostradoNoFim[atual] = Math.floor(s);
        concluido = true;
        tConcluir = t;
        sConcluir = s;
        varredura = Math.min(VARREDURA_MAX, Math.max(VARREDURA_MIN, 120 + 8 * (100 - s)));
      },
      /**
       * O que este trabalho ensina — só o COMPARÁVEL (ver o cabeçalho).
       */
      amostra() {
        if (!concluido) return null;
        const d = (f) => (inicio[f] != null && fim[f] != null ? fim[f] - inicio[f] : undefined);
        const a = {};
        if (d('download') != null && total > 0) {
          a.bytes = total;
          a.preparoMs = d('preparo');
          if (!retomado()) a.downloadMs = d('download');
          if (d('juncao') != null) a.juncaoMs = d('juncao');
          if (!oculto) {
            if (d('copia') != null) a.copiaMs = d('copia');
            if (d('gravacao') != null) a.gravacaoMs = d('gravacao');
          }
        }
        if (d('abertura') != null && tocou && !oculto) a.aberturaMs = d('abertura');
        return Object.keys(a).length ? a : null;
      },
      /** O diagnóstico deste trabalho (para o Registro). */
      relatorio() {
        const fases = {};
        for (const f of FASES) {
          if (inicio[f] == null) continue;
          fases[f] = { previstoMs: previsto[f] != null ? previsto[f] : null,
            realMs: fim[f] != null ? fim[f] - inicio[f] : null,
            mostrado: mostradoNoFim[f] != null ? mostradoNoFim[f] : null };
        }
        return {
          caminho: inicio.download == null ? 'no-aparelho' : retomado() ? 'retomado' : 'novo',
          bytes: total > 0 ? total : 0,
          fases,
          previstoMs: previstoInicial,
          realMs: concluido ? tConcluir - t0 : null,
          aoConcluir: concluido ? Math.floor(sConcluir) : null,
          saltoFinal: concluido ? Math.max(0, 100 - Math.floor(sConcluir)) : null,
          platoMs: Math.round(plato),
          tocou,
          oculto,
        };
      },
    };

    // RETOMADO: o primeiro número já trazia parte do arquivo (o shell conta os
    // bytes ABSOLUTOS, e uma retomada começa pelo que já estava no disco). Um
    // download novo começa com um bloco de leitura (dezenas de kB).
    function retomado() { return total > 0 && primeiroLido > Math.max(0.05 * total, MB); }
  }

  global.AVProgresso = {
    FASES, PADRAO, LIMITES, AMOSTRAS, VERSAO, POUSO, CAP, PISO_V, V_MAX,
    sanear, aprender, modelo, apoio, criar, mediana,
  };
})(this);
