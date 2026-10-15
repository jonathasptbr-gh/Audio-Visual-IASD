// ============================================================================
// O PROGRESSO DO TOQUE À TELA — a regra do percentual do YouTube
// (v1.12.36; a exibição refeita na v1.12.37; o aprendizado na v1.12.38; a
// estimativa estável e o fim segurado na v1.12.39)
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
//   gravacao  o `addMedia` (IndexedDB/OPFS) — a miniatura saiu do caminho na
//             v1.12.39 (`miniaturaDepois` no `controle.js`)
//   abertura  o `send` até a mídia tocar (só no "Tocar agora")
//
// ## A ESTIMATIVA do que falta (`restante`)
//
// - preparo e abertura: tempo FIXO aprendido (ms);
// - download: uma LATÊNCIA fixa + os bytes ÷ o ritmo da rede. Durante os bytes,
//   o ritmo é o MEDIDO neste download desde o primeiro aviso, misturado ao
//   aprendido só até o segundo aviso;
// - junção, cópia, gravação: um tempo FIXO + ms POR MB (a junção usa a fração do
//   `MuxMp4` quando ela chega). Num arquivo de 4 MB a gravação é quase só o fixo
//   (a miniatura), e um modelo só por MB a previa em 0,1 s contra 1,0 s real.
// - o TAMANHO antes de o shell dizer o de verdade: a duração do vídeo (que chega
//   no `extraiu`) × os bytes por segundo de vídeo aprendidos; sem ela, o tamanho
//   típico aprendido (de vídeo ou de só áudio, `chave`).
// Uma fase que passa da previsão não "acaba": o que falta dela CRESCE com o
// atraso, e a barra desacelera em vez de bater num teto.
//
// ## A EXIBIÇÃO é um controle de VELOCIDADE, não de posição
//
// A velocidade-alvo é a que leva o valor mostrado a `POUSO` (95) no instante
// previsto do fim; a velocidade real persegue essa alvo com inércia (`TAU_V`),
// então muda AOS POUCOS, e tem um PISO que nunca a deixa parar (ele decai só
// perto do `CAP`, que nunca é alcançado: o inteiro máximo antes do fim é 99).
// Passado o ponto de pouso (o fim atrasou), a meta vira "um terço do que resta
// até o CAP no tempo que ainda se estima" — anda devagar, mas anda. O
// `concluir()` fecha com uma VARREDURA de poucas centenas de ms — nunca um
// salto.
//
// O FIM SEGURADO (v1.12.39, aprovado pelo operador): no "Tocar agora" a mídia
// APARECE no começo da abertura, e ali o `revelar()` varre a barra até 100 e
// devolve quanto a revelação espera — 0 a partir do `POUSO`, senão
// `SEGURA_MIN + SEGURA_POR_PONTO × (100 − valor)`, até `SEGURA_MAX` (500 ms).
//
// ## O que se APRENDE
//
// Cada trabalho que termina deixa uma amostra (`amostra()`), e cada tempo do
// modelo é um QUANTIL (`QUANTIL`, 0,6) das últimas `JANELA` amostras, sem peso
// de idade (`estimar`); o ritmo da rede e o tamanho, a mediana. A v1.12.38
// pesava a mais nova (a mediana ponderada), e UMA amostra fora da curva movia o
// vídeo seguinte inteiro. Os pares fixo + por MB saem de um ajuste ROBUSTO (a
// mediana das inclinações entre amostras de tamanhos diferentes, nunca
// negativa). O tamanho típico só vale sozinho com `APOIO_TAMANHO` amostras —
// antes disso ele é misturado ao padrão —, e os bytes por segundo de vídeo
// também só valem com elas.
//
// Só entra o que é COMPARÁVEL: um arquivo que já estava no aparelho só ensina a
// abertura; uma fase do lado WEB vivida com o app minimizado não ensina nada; a
// abertura que venceu o prazo sem ver o play também não. E o RETOMADO: o ritmo da
// rede é medido ENTRE AVISOS (`(últimos − primeiros) / (tÚltimo − tPrimeiro)`),
// que nenhum byte que já estava no disco altera — só a latência deixa de ser
// ensinada. A v1.12.37 jogava fora o ritmo de todo download "retomado", e o
// critério dela (o primeiro aviso acima de 1 MB) acertava TODO download novo: o
// shell avisa a cada 1 MB, então o primeiro aviso já traz um pouco mais que isso,
// e a rede nunca era aprendida. Hoje retomado é o primeiro aviso trazer muito
// mais do que o ritmo medido explica no tempo que passou (`retomado()`).
//
// `relatorio()` devolve o diagnóstico do trabalho (fase a fase: o previsto, o
// real e o número mostrado no fim de cada uma; o maior platô; o salto final; o
// que classificou o caminho; o tamanho previsto e de onde ele veio), que o
// `controle.js` leva ao Registro.
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
  // razoável e um aparelho médio.
  const PADRAO = Object.freeze({
    preparoMs: 2500,
    latenciaMs: 500,
    bytesPorMs: 4000,
    juncaoFixoMs: 300,
    juncaoMsPorMB: 30,
    juncaoChance: 1,      // a fração dos downloads de vídeo que JUNTAM (o 360p progressivo não junta)
    copiaFixoMs: 50,
    copiaMsPorMB: 15,
    gravacaoFixoMs: 400,
    gravacaoMsPorMB: 20,
    aberturaMs: 800,
    bytesTipicos: 12 * MB,  // v1.12.39: os vídeos de hino do operador, 720p, ficam entre 3 e 14 MB
    bytesPorSegundo: 0,   // 0 = não aprendido: o tamanho sai do típico
  });
  // O intervalo são de cada número: fora dele é medição quebrada (relógio, aba
  // suspensa), não aprendizado.
  const LIMITES = Object.freeze({
    preparoMs: [200, 30000],
    latenciaMs: [0, 10000],
    bytesPorMs: [20, 200000],
    juncaoFixoMs: [0, 20000],
    juncaoMsPorMB: [0, 2000],
    juncaoChance: [0, 1],
    copiaFixoMs: [0, 20000],
    copiaMsPorMB: [0, 2000],
    gravacaoFixoMs: [0, 20000],
    gravacaoMsPorMB: [0, 2000],
    aberturaMs: [100, 10000],
    bytesTipicos: [MB, 4096 * MB],
    bytesPorSegundo: [0, 50 * MB],
  });
  const AMOSTRAS = 12;
  // A ESTIMATIVA ESTÁVEL (v1.12.39): cada tempo é um QUANTIL das últimas
  // `JANELA` amostras, sem peso de idade — com a mediana ponderada da v1.12.38
  // (a mais nova valendo mais) UMA gravação de 1,9 s fazia o vídeo seguinte ser
  // previsto com 1,9 s (o real foi 0,2) e a barra abria em 73. `QUANTIL` acima
  // da mediana mira o típico-para-pessimista: errar para o lado longo custa uma
  // varredura curta no fim (ver `revelar`), errar para o curto custa a barra
  // parada perto do 95.
  const JANELA = 8;
  const QUANTIL = 0.6;
  const PESO_IDADE = 0.8;  // só a FRAÇÃO de vídeos que juntam ainda pesa a recência
  // O tamanho do HISTÓRICO só vale sozinho com `APOIO_TAMANHO` amostras da mesma
  // chave; com menos ele é misturado ao padrão (um vídeo de 3 MB fazia o seguinte,
  // de 13 MB, ser previsto com 3,4 MB). Os bytes por segundo de vídeo, sem padrão,
  // só valem com essas amostras.
  const APOIO_TAMANHO = 3;
  // A versão do HISTÓRICO gravado. A v2 (v1.12.37) não aprendeu a rede em
  // download nenhum (o "retomado" falso) e media cópia/gravação só por MB — e não
  // há como separar isso depois: ela recomeça.
  // A v3 (v1.12.38) é LIDA sem a gravação: ela incluía a miniatura.
  const VERSAO = 4;
  // O shell avisa os bytes a cada 1 MB (`ProgressoDePedacos`, `baixarUmaVez`).
  const GRAO = MB;

  // A exibição. Unidades: valor em pontos (0–100), velocidade em pontos por ms.
  const POUSO = 95;          // onde o valor deve estar no instante previsto do fim
  const CAP = 99.6;          // nunca alcançado antes do `concluir()`
  const PISO_V = 0.30 / 1000;  // 0,3 ponto/s: um inteiro novo a cada ~3,3 s, no pior caso
  const PISO_DESDE = 98;     // acima disto o piso decai junto com o que resta até o CAP
  const V_MAX = 60 / 1000;   // 60 pontos/s: nem o caminho instantâneo vira um salto
  const TAU_V = 800;         // ms — a inércia da velocidade
  const FREIO = 20 / 1e6;    // pontos/ms² (20 pontos/s²) — a desaceleração do freio do pouso
  const RESTANTE_MIN = 150;  // ms — o que falta nunca é zero antes do fim
  const VARREDURA_MIN = 150; // ms — a varredura final, entre estes dois
  const VARREDURA_MAX = 450;
  const MIRA_CAUDA = 0.6;   // ver `restante(t, mira)`
  // O FIM SEGURADO (v1.12.39, aprovado pelo operador): pronta a mídia com a
  // barra atrás, ela VARRE até 100 antes de o vídeo aparecer, e a revelação
  // espera essa varredura — no máximo `SEGURA_MAX`, proporcional ao que falta, e
  // nada a partir do `POUSO`.
  const SEGURA_MIN = 120;
  const SEGURA_POR_PONTO = 9;
  const SEGURA_MAX = 500;
  const JANELA_RITMO = 3000; // ms — num download longo, o ritmo medido olha para trás isto

  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : NaN);
  const entre = (v, [a, b]) => Math.min(b, Math.max(a, v));

  function mediana(xs) {
    const v = xs.filter((x) => isFinite(x)).sort((a, b) => a - b);
    if (!v.length) return NaN;
    const m = v.length >> 1;
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  }

  /**
   * O QUANTIL `q` das últimas `JANELA` amostras (`xs` em ordem cronológica; NaN =
   * a amostra não tem esse número), interpolado entre as vizinhas: com duas
   * amostras sai um valor ENTRE elas, nunca a mais nova; um valor fora da curva
   * move a estimativa só até a vizinha dele.
   */
  function estimar(xs, q) {
    const v = xs.slice(-JANELA).filter((x) => isFinite(x)).sort((a, b) => a - b);
    if (!v.length) return NaN;
    const p = (v.length - 1) * (q == null ? 0.5 : q);
    const i = Math.floor(p);
    return i + 1 < v.length ? v[i] + (v[i + 1] - v[i]) * (p - i) : v[i];
  }

  /** A média ponderada pela idade — só para a fração 0/1 de vídeos que juntam. */
  function mediaRecente(xs) {
    const n = xs.length;
    let soma = 0; let peso = 0;
    xs.forEach((x, i) => { if (isFinite(x)) { const w = Math.pow(PESO_IDADE, n - 1 - i); soma += w * x; peso += w; } });
    return peso > 0 ? soma / peso : NaN;
  }

  /** O histórico gravado, saneado: sempre `{ v: VERSAO, amostras: [] }`. Outra versão recomeça. */
  function sanear(hist) {
    const v3 = hist && hist.v === 3 && Array.isArray(hist.amostras);
    const lista = v3 || (hist && hist.v === VERSAO && Array.isArray(hist.amostras)) ? hist.amostras : [];
    let am = lista.filter((a) => a && typeof a === 'object').slice(-AMOSTRAS);
    // A v3 media a gravação COM a miniatura (que saiu do caminho na v1.12.39):
    // as amostras ficam, sem esse número.
    if (v3) am = am.map((a) => { const c = Object.assign({}, a); delete c.gravacaoMs; return c; });
    return { v: VERSAO, amostras: am };
  }

  const CAMPOS = ['preparoMs', 'downloadMs', 'bytes', 'ritmo', 'segundos', 'juntou', 'juncaoMs', 'copiaMs', 'gravacaoMs', 'aberturaMs'];

  /** Uma amostra nova no fim, as velhas saindo pelo começo. PURA e síncrona. */
  function aprender(hist, amostra) {
    const h = sanear(hist);
    if (!amostra || typeof amostra !== 'object') return h;
    const limpa = {};
    for (const c of CAMPOS) {
      const v = num(amostra[c]);
      if (v >= 0) limpa[c] = c === 'ritmo' ? Math.round(v * 10) / 10 : Math.round(v);
    }
    if (!Object.keys(limpa).length) return h;
    if (amostra.origem) limpa.origem = String(amostra.origem).slice(0, 16);
    if (amostra.chave) limpa.chave = String(amostra.chave).slice(0, 16);
    h.amostras = h.amostras.concat([limpa]).slice(-AMOSTRAS);
    return h;
  }

  // O ritmo de uma amostra (bytes/ms): o MEDIDO entre avisos; sem ele (um aviso
  // só), o da fase inteira — que já embute a latência, então ela entra como 0.
  function ritmoDa(a) {
    if (a.ritmo > 0) return a.ritmo;
    return a.bytes > 0 && a.downloadMs >= 200 ? a.bytes / a.downloadMs : NaN;
  }
  function latenciaDa(a) {
    if (!(a.downloadMs >= 0) || !(a.bytes > 0)) return NaN;
    if (a.ritmo > 0) return Math.max(0, a.downloadMs - a.bytes / a.ritmo);
    return a.downloadMs >= 200 ? 0 : NaN;
  }

  /**
   * Um tempo que é FIXO + POR MB: a inclinação é a mediana das inclinações entre
   * pares de amostras de tamanhos bem diferentes (nunca negativa — um arquivo
   * maior não grava mais rápido; a diferença é ruído); sem par, a do padrão (ou
   * menos, se a amostra mesma não comporta). O fixo é o que
   * sobra, no `QUANTIL`.
   */
  function ajustar(am, campo) {
    const pts = am.map((a) => (num(a[campo]) >= 0 && a.bytes > 0 ? [a.bytes / MB, a[campo]] : null));
    const val = pts.filter(Boolean);
    if (!val.length) return null;
    const maior = Math.max(...val.map((p) => p[0]));
    const inclin = [];
    for (let i = 0; i < val.length; i++) {
      for (let j = i + 1; j < val.length; j++) {
        const dx = val[j][0] - val[i][0];
        if (Math.abs(dx) >= Math.max(2, 0.25 * maior)) inclin.push((val[j][1] - val[i][1]) / dx);
      }
    }
    const padrao = PADRAO[campo.replace('Ms', 'MsPorMB')];
    // UM par só não basta (v1.12.39): com dois tamanhos, a diferença de UMA
    // gravação fora da curva virava inclinação (175 ms/MB, e um vídeo de 12 MB
    // previsto em 2,1 s). A inclinação pede dois pares — três amostras.
    const porMB = inclin.length >= 2 ? Math.max(0, mediana(inclin))
      : Math.min(padrao, mediana(val.map((p) => p[1] / p[0])));
    const fixo = estimar(pts.map((p) => (p ? Math.max(0, p[1] - porMB * p[0]) : NaN)), QUANTIL);
    return { fixo, porMB };
  }

  /**
   * Os parâmetros que valem agora: o aprendido, ou o padrão. `chave` ('video' ou
   * 'audio') escolhe de que amostras sai o TAMANHO — um só áudio não diz quanto
   * pesa um vídeo; sem amostra daquela chave, valem todas.
   */
  function modelo(hist, chave) {
    const am = sanear(hist).amostras;
    const daChave = chave ? am.filter((a) => a.chave === chave) : [];
    const doTamanho = daChave.some((a) => a.bytes > 0) ? daChave : am;
    const tamanhos = doTamanho.map((a) => (a.bytes > 0 ? a.bytes : NaN));
    const nTam = tamanhos.slice(-JANELA).filter((x) => isFinite(x)).length;
    const bps = doTamanho.map((a) => (a.bytes > 0 && a.segundos > 0 ? a.bytes / a.segundos : NaN));
    const nBps = bps.slice(-JANELA).filter((x) => isFinite(x)).length;
    // Com menos de `APOIO_TAMANHO` amostras, o típico é a mistura com o padrão.
    const confTam = Math.min(1, nTam / APOIO_TAMANHO);
    const cru = {
      preparoMs: estimar(am.map((a) => num(a.preparoMs)), QUANTIL),
      latenciaMs: estimar(am.map(latenciaDa), QUANTIL),
      bytesPorMs: estimar(am.map(ritmoDa), 0.5),
      aberturaMs: estimar(am.map((a) => num(a.aberturaMs)), QUANTIL),
      bytesTipicos: nTam ? confTam * estimar(tamanhos, 0.5) + (1 - confTam) * PADRAO.bytesTipicos : NaN,
      bytesPorSegundo: nBps >= APOIO_TAMANHO ? estimar(bps, 0.5) : NaN,
      juncaoChance: mediaRecente(am.map((a) => (a.juntou === 0 || a.juntou === 1 ? a.juntou : NaN))),
    };
    for (const f of ['juncao', 'copia', 'gravacao']) {
      const aj = ajustar(am, f + 'Ms');
      if (aj) { cru[f + 'FixoMs'] = aj.fixo; cru[f + 'MsPorMB'] = aj.porMB; }
    }
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
    return { n: am.length, preparo: conta('preparoMs'), download: am.filter((a) => isFinite(ritmoDa(a))).length,
      latencia: am.filter((a) => isFinite(latenciaDa(a))).length, tamanho: am.filter((a) => a.bytes > 0).length,
      juncao: conta('juncaoMs'), copia: conta('copiaMs'), gravacao: conta('gravacaoMs'), abertura: conta('aberturaMs') };
  }

  /**
   * Uma barra para UM trabalho. `juncao`: espera-se a montagem de vídeo + som;
   * `abertura`: o trabalho termina com a mídia tocando; `chave`: 'video' ou
   * 'audio' (de onde sai o tamanho previsto).
   */
  function criar(opts) {
    const o = opts || {};
    const agora = typeof o.agora === 'function' ? o.agora : () => Date.now();
    let m = Object.assign({}, PADRAO, o.modelo || {});
    const chave = o.chave ? String(o.chave) : '';
    const t0 = agora();
    const inicio = { preparo: t0 };
    const fim = {};
    const previsto = {};      // a duração prevista de cada fase, no instante em que ela começou
    const mostradoNoFim = {}; // o número mostrado quando cada fase acabou
    let atual = 'preparo';
    const previstas = FASES.filter((f) => (f !== 'juncao' || o.juncao) && (f !== 'abertura' || o.abertura));
    let total = 0;
    let lidos = 0;
    let segundos = 0;         // a duração do vídeo (o `extraiu`)
    let primeiroLido = -1;    // o primeiro aviso de bytes
    let tPrimeiroByte = 0;
    let ultimoLido = -1;      // o último aviso, e quando
    let tUltimoByte = 0;
    let avisos = 0;
    let tCheio = 0;           // quando a fração da fase atual chegou a 1 sem a fase acabar
    const ritmo = [];         // [t, lidos] dos avisos (a janela do ritmo medido)
    let muxFeito = 0;
    let muxTotal = 0;
    let s = 0;                // o valor exibido, contínuo
    let v = -1;               // a velocidade exibida (pontos/ms); -1 = ainda não começou
    let ultimo = t0;
    let ultimoInteiro = 0;
    let tUltimaMudanca = t0;
    let plato = 0;
    let previstoInicial = 0;
    let tamanhoInicial = 0;
    let fonteInicial = '';
    let concluido = false;
    let tConcluir = 0;
    let sConcluir = 0;
    let varredura = 0;
    let tRevelar = 0;         // o `revelar()`: quando, de onde e por quanto tempo a varredura do fim segurado
    let sRevelar = -1;
    let segurou = 0;
    let tocou = true;
    let escondida = !!o.oculta; // a página está oculta agora
    let oculto = false;       // a página esteve oculta durante alguma fase web

    const idx = (f) => FASES.indexOf(f);
    function fonteDoTamanho() {
      if (total > 0) return 'real';
      if (segundos > 0 && m.bytesPorSegundo > 0) return 'duracao';
      return m.bytesTipicos === PADRAO.bytesTipicos ? 'padrao' : 'historico';
    }
    function tamanho() {
      if (total > 0) return total;
      if (segundos > 0 && m.bytesPorSegundo > 0) return entre(segundos * m.bytesPorSegundo, LIMITES.bytesTipicos);
      return m.bytesTipicos;
    }

    function duracao(f) {
      const mb = tamanho() / MB;
      switch (f) {
        case 'preparo': return m.preparoMs;
        case 'download': return m.latenciaMs + tamanho() / m.bytesPorMs;
        // Enquanto não se sabe se este download vai juntar, a junção pesa o
        // quanto ela costuma acontecer; entrada nela, ela pesa inteira.
        case 'juncao': return (atual === 'juncao' ? 1 : m.juncaoChance) * (m.juncaoFixoMs + mb * m.juncaoMsPorMB);
        case 'copia': return m.copiaFixoMs + mb * m.copiaMsPorMB;
        case 'gravacao': return m.gravacaoFixoMs + mb * m.gravacaoMsPorMB;
        case 'abertura': return m.aberturaMs;
        default: return 0;
      }
    }

    // O que falta de uma fase SEM fração conhecida: a previsão enquanto ela vale;
    // passada (3/4 dela), o que falta CRESCE com o atraso — contínuo em 3/4.
    function peloRelogio(D, e) {
      return Math.max(D - e, 0.1 * D + 0.3 * (e - 0.9 * D));
    }

    // O ritmo DESTE download, entre avisos (bytes/ms), na janela; um silêncio
    // maior que o intervalo médio dos avisos o faz cair (a rede que trava).
    function ritmoMedido(t) {
      while (ritmo.length > 2 && t - ritmo[1][0] >= JANELA_RITMO) ritmo.shift();
      if (ritmo.length < 2) return NaN;
      const [ta, la] = ritmo[0];
      const [tb, lb] = ritmo[ritmo.length - 1];
      if (lb <= la) return NaN;
      const intervalo = (tb - ta) / (ritmo.length - 1);
      const dt = Math.max(tb - ta, t - ta - intervalo, 50);
      return (lb - la) / dt;
    }

    // O ritmo do download INTEIRO entre o primeiro e o último aviso — o que vai à
    // amostra. Nenhum byte que já estava no disco entra nesta conta.
    function ritmoDoDownload() {
      if (avisos < 2) return NaN;
      const db = ultimoLido - primeiroLido;
      const dt = tUltimoByte - tPrimeiroByte;
      return db >= GRAO && dt >= 100 ? db / dt : NaN;
    }

    function restanteDaAtual(t) {
      const D = Math.max(1, duracao(atual));
      const e = Math.max(0, t - inicio[atual]);
      if (atual === 'download') {
        if (!(total > 0) || primeiroLido < 0) return peloRelogio(D, e);
        const falta = Math.max(0, total - lidos);
        if (falta <= 0) return RESTANTE_MIN + 0.3 * Math.max(0, t - tCheio);
        const medido = ritmoMedido(t);
        // A confiança no medido: meia no primeiro intervalo entre avisos, inteira
        // no segundo — um download de um segundo não tem tempo para mais.
        const conf = isFinite(medido) && medido > 0
          ? Math.min(1, Math.max((ritmo[ritmo.length - 1][1] - ritmo[0][1]) / (2 * GRAO), (t - tPrimeiroByte) / 1500)) : 0;
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

    // `mira`: a conta da VELOCIDADE, em que a cauda do app (cópia, gravação,
    // abertura — fases curtas, sem fração e de duração que varia muito de um
    // vídeo para o outro) pesa `MIRA_CAUDA` do previsto. Errar para o lado curto
    // custa a barra andar devagar uns décimos depois do pouso; errar para o lado
    // longo custa o vídeo abrir com a barra no meio — o que o operador relata.
    // A ABERTURA continua na mira, mesmo com a mídia aparecendo no começo dela
    // (o `revelar()`): fora dela, uma gravação que atrasa deixava o que falta no
    // piso (`RESTANTE_MIN`) e a barra corria ao pouso para frear em cima dele —
    // a varredura curta do fim segurado custa menos que essa freada.
    function restante(t, mira) {
      const k = (f) => (mira && FASES_WEB.includes(f) ? MIRA_CAUDA : 1);
      let r = restanteDaAtual(t) * k(atual);
      for (const f of previstas) if (idx(f) > idx(atual)) r += Math.max(0, duracao(f)) * k(f);
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
      if (concluido || segurou) return s >= 100 ? 100 : Math.max(0, Math.floor(s));
      return Math.max(0, Math.min(99, Math.floor(s)));
    }

    // Antes do pouso: chegar a `POUSO` no fim previsto. Depois dele (o fim
    // atrasou): um terço do que resta até o CAP no tempo que ainda se estima MAIS
    // o atraso já vivido — uma fase nova e curta não pode fazer a barra correr de
    // novo para o CAP e parar lá (era o "97 parado" da v1.12.36).
    let tPouso = 0;
    function velocidadeAlvo(t) {
      const r = restante(t, true);
      let vMeta;
      if (s < POUSO) vMeta = (POUSO - s) / r;
      else {
        if (!tPouso) tPouso = t;
        vMeta = ((CAP - s) / 3) / (r + (t - tPouso) + 1000);
      }
      const piso = PISO_V * Math.min(1, Math.max(0, CAP - s) / (CAP - PISO_DESDE));
      return Math.min(V_MAX, Math.max(vMeta, piso));
    }

    function semear() {
      previsto.preparo = Math.round(duracao('preparo'));
      previstoInicial = Math.round(restante(agora()));
      tamanhoInicial = Math.round(tamanho());
      fonteInicial = fonteDoTamanho();
    }
    semear();

    // RETOMADO: o primeiro aviso trouxe muito mais do que o ritmo medido explica
    // no tempo que passou desde o começo dos bytes — o shell conta os bytes
    // ABSOLUTOS, e uma retomada começa pelo que já estava no disco. Um download
    // novo começa no primeiro GRÃO (1 MB e pouco). Sem ritmo medido (um aviso
    // só), só um primeiro aviso grande demais para ser o primeiro grão.
    function esperadoNoPrimeiro() {
      const r = ritmoDoDownload();
      if (!isFinite(r) || inicio.download == null) return NaN;
      return r * Math.max(0, tPrimeiroByte - inicio.download);
    }
    function retomado() {
      if (!(total > 0) || primeiroLido < 0) return false;
      const esp = esperadoNoPrimeiro();
      if (isFinite(esp)) return primeiroLido > 2 * esp + 1.5 * GRAO;
      return primeiroLido > Math.max(0.25 * total, 3 * GRAO);
    }

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
        if (segurou) {
          const u = Math.min(1, (t - tRevelar) / segurou);
          s = u >= 1 ? 100 : sRevelar + (100 - sRevelar) * (1 - (1 - u) * (1 - u));
          return valor();
        }
        const alvo = velocidadeAlvo(t);
        const vAntes = v;
        if (v < 0) v = alvo;
        else v += (alvo - v) * (1 - Math.exp(-dt / TAU_V));
        // O FREIO: a inércia não pode levar a barra além do pouso. Rápida, ela
        // chegava ao 95 a 40+ pontos/s e a velocidade, que só cai aos poucos, a
        // carregava até o CAP — "99 parado" num vídeo que atrasou meio segundo.
        // Desaceleração CONSTANTE (`FREIO`): a velocidade que ainda para no pouso
        // é √(2·FREIO·distância), e ela cai no máximo FREIO·dt por quadro. Só
        // pega quando a inércia passa da velocidade-alvo — no plano ela não age.
        if (vAntes >= 0) v = Math.min(v, Math.max(alvo, Math.sqrt(2 * FREIO * Math.max(0, POUSO - s))));
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
      /** O tempo que falta, estimado agora (ms) — para o oráculo. */
      restante: () => restante(agora()),
      trocarModelo(novo) {
        if (!novo) return;
        m = Object.assign({}, PADRAO, novo);
        if (!fim[atual]) previsto[atual] = Math.round(duracao(atual));
        if (atual === 'preparo') semear();
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
        if (nome === 'extraiu') {
          if (num(i.seconds) > 0) segundos = i.seconds;
          entrar('download');
        } else if (nome === 'baixou') {
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
          if (!(antes > 0) || Math.abs(tot - antes) > 0.02 * antes) previsto.download = Math.round(duracao('download'));
        }
        const lv = num(l);
        if (!(lv >= 0)) return;
        if (primeiroLido < 0) { primeiroLido = lv; tPrimeiroByte = t; }
        if (lv > lidos) lidos = lv;
        if (lv > ultimoLido) { ultimoLido = lv; tUltimoByte = t; avisos++; }
        ritmo.push([t, lidos]);
        if (total > 0 && lidos >= total && !tCheio) tCheio = t;
      },
      /**
       * A mídia PRONTA PARA APARECER (o começo da abertura do "Tocar agora"):
       * devolve quantos ms a revelação deve esperar — 0 com a barra no `POUSO`
       * ou acima; senão `SEGURA_MIN + SEGURA_POR_PONTO × (100 − valor)`, até
       * `SEGURA_MAX` — e a barra VARRE até 100 nesse tempo. As fases continuam
       * sendo medidas; `concluir()` segue sendo o fim do trabalho.
       */
      revelar() {
        if (concluido || sRevelar >= 0) return 0;
        sRevelar = s;
        tRevelar = agora();
        if (s >= POUSO) return 0;
        segurou = Math.round(Math.min(SEGURA_MAX, SEGURA_MIN + SEGURA_POR_PONTO * (100 - s)));
        return segurou;
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
        if (segurou && s < 100) s = Math.max(s, sRevelar + (100 - sRevelar) * Math.min(1, (t - tRevelar) / segurou));
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
          if (chave) a.chave = chave;
          if (segundos > 0) a.segundos = segundos;
          a.preparoMs = d('preparo');
          const r = ritmoDoDownload();
          if (isFinite(r)) a.ritmo = r;
          if (!retomado()) a.downloadMs = d('download');
          if (d('juncao') != null) a.juncaoMs = d('juncao');
          if (o.juncao && inicio.copia != null) a.juntou = inicio.juncao != null ? 1 : 0;
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
        const r = ritmoDoDownload();
        const esp = esperadoNoPrimeiro();
        return {
          caminho: inicio.download == null ? 'no-aparelho' : retomado() ? 'retomado' : 'novo',
          // O que decidiu o caminho: o primeiro aviso (bytes e ms depois do
          // começo dos bytes) contra o que o ritmo medido explica nesse tempo.
          primeiroAviso: primeiroLido >= 0 ? { bytes: primeiroLido, ms: Math.max(0, tPrimeiroByte - (inicio.download || tPrimeiroByte)),
            esperado: isFinite(esp) ? Math.round(esp) : null, avisos } : null,
          ritmoBytesPorMs: isFinite(r) ? Math.round(r) : null,
          bytes: total > 0 ? total : 0,
          tamanhoPrevisto: tamanhoInicial,
          tamanhoFonte: fonteInicial,
          fases,
          previstoMs: previstoInicial,
          realMs: concluido ? tConcluir - t0 : null,
          // O número quando a mídia ficou PRONTA: no `revelar()`, se houve um;
          // senão no `concluir()`. É o que o operador via antes do fim.
          aoConcluir: sRevelar >= 0 ? Math.floor(sRevelar) : concluido ? Math.floor(sConcluir) : null,
          saltoFinal: sRevelar >= 0 ? Math.max(0, 100 - Math.floor(sRevelar))
            : concluido ? Math.max(0, 100 - Math.floor(sConcluir)) : null,
          segurouMs: segurou,
          platoMs: Math.round(plato),
          tocou,
          oculto,
        };
      },
    };
  }

  global.AVProgresso = {
    FASES, PADRAO, LIMITES, AMOSTRAS, VERSAO, POUSO, CAP, PISO_V, V_MAX, PESO_IDADE, MIRA_CAUDA,
    JANELA, QUANTIL, APOIO_TAMANHO, SEGURA_MAX,
    sanear, aprender, modelo, apoio, criar, mediana, estimar,
  };
})(this);
