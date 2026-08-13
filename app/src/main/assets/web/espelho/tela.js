// ============================================================================
// O PAPEL `tela` — a casca que faz o /display/ rodar num navegador da LAN.
// (TELÃO POR COMANDOS, E3 — docs/TELAO-POR-COMANDOS.md §3.4)
//
// UMA PÁGINA SÓ, e isso não é preferência: `requestFullscreen()` e sair do
// `muted` exigem ativação transitória do usuário, o gesto vale segundos e NÃO
// SOBREVIVE A UMA NAVEGAÇÃO. Uma página de entrada que navegasse ao display
// perderia o gesto, e a tela entraria muda e em janela — exatamente o que a
// v5.186 existe para impedir. Então a entrada é um OVERLAY por cima do display
// ainda vazio, e o botão de conectar gasta o único gesto do visitante fazendo
// as três coisas: entra (POST /par), liga o som e vai a tela cheia.
//
// ## A ordem de carga é o contrato
//
// Este arquivo entra em display/index.html DEPOIS de native.js (que numa
// página sem __AVBridge retorna na primeira linha) e ANTES de db.js — porque
// db.js captura `global.__AVBus` e o construtor do BroadcastChannel NA CARGA
// (db.js:800-801), e as duas coisas precisam existir/estar neutralizadas antes
// disso. É a mesma janela que o native.js usa para o papel espelho.
//
// ## O dreno de SUBIDA é lista de PERMISSÃO
//
// Cada /display/ emite display-status a ~4 Hz, media-ended, mic-status e
// diag-dump — e N telas emitindo isso de volta ao celular é exatamente o
// problema que o dreno do papel espelho resolvia na direção oposta:
// media-ended dobrado dá um segundo load em repeat-one; mic-status
// 'unsupported' (não há getUserMedia em http) apagaria o estado do microfone
// VERDADEIRO; diag-dump duplo faz o Registro mostrar o diário de um sem dizer
// qual. Sobem exatamente DUAS coisas: `display-ready` (é o que faz o Controle
// reenviar a cena — v5.140) e `display-status` RENOMEADO `tela-status`, com o
// id desta tela. Tipo novo nasce mudo por construção.
//
// ## O que este arquivo NÃO faz
//
// Não renderiza nada (o display.js é o motor — invariante 5 aplicada ao
// próprio lado web), não decide cena, não toca em mídia (E4: o `__rec` chega
// no próprio load). Fora do papel `tela` (`?tela=1` na query), é um no-op de
// uma guarda — no telão de verdade, no espelho e no navegador de
// desenvolvimento ele não existe.
// ============================================================================
(function (global) {
  'use strict';
  var doc = global.document;
  // A GUARDA: papel explícito por query, nunca adivinhação de origem — o
  // fluxo de desenvolvimento no navegador precisa continuar funcionando.
  if (!/[?&]tela=1(?:&|$)/.test(global.location.search)) return;

  global.__AV_ROLE__ = 'tela';

  // O BroadcastChannel é NEUTRALIZADO NO ENVIO, nunca apagado — a mesma regra
  // do papel espelho (native.js): apagar deixaria db.js sem canal de recepção
  // e mudaria o caminho de escolha dele. Duas abas no mesmo PC não podem se
  // contaminar (uma da sala, outra esquecida num navegador).
  if (typeof global.BroadcastChannel === 'function') {
    var CanalReal = global.BroadcastChannel;
    global.BroadcastChannel = /** @type {any} */ (class extends CanalReal {
      postMessage() {}
    });
  }

  // --------------------------------------------------------------------------
  // Constantes — as lições pagas pelo cliente do espelho, herdadas uma a uma
  // --------------------------------------------------------------------------
  var RECONEXAO = [500, 1000, 2000, 4000, 8000];
  // O ping do servidor bate a cada 15 s; dois perdidos + folga = fio mudo. É o
  // detector de TCP meio-aberto deste lado (§10-A.10 do espelho, de graça).
  var PING_SUMIDO_MS = 35000;
  var ALIVE_MS = 10000;
  var PRAZO_POST_MS = 15000;
  // Amostras do relógio guardadas para a mediana — poucas, porque o desvio de
  // relógio muda devagar e a mediana só precisa expulsar o outlier de rede.
  var RELOGIO_AMOSTRAS = 5;

  // --------------------------------------------------------------------------
  // Estado
  // --------------------------------------------------------------------------
  var token = '';
  var vivo = false;
  var abortar = null;
  var tentativa = 0;
  var ultimoByteMs = 0;
  var fioMudo = false;
  var listeners = [];
  var conectada = false;
  // O último display-ready que o display emitiu — guardado SEMPRE, mesmo antes
  // de haver token: o init() do display corre em paralelo com a digitação do
  // código, e é este cache que permite reanunciar a tela em TODA conexão (o
  // Controle responde com a cena endereçada; sem o reanúncio, uma reconexão
  // ficaria no wallpaper até o operador tocar em algo).
  var prontoUltimo = null;
  var telaId = '';
  // O desvio de relógio (tela − celular), pela mediana das amostras do ping.
  // Cronômetro e sorteio viajam por DESCRITOR ancorado em Date.now() do
  // celular (startAt, rollUntil), e uma Smart TV com o relógio minutos fora
  // contaria errado na frente de todo mundo. A correção soma o desvio aos
  // campos de época dos comandos que chegam — no lado web, por campo
  // conhecido: o Kotlin segue sem interpretar nada (invariante 5).
  var offsets = [];
  var offsetMs = 0;
  var temOffset = false;
  // Freio do tela-status: 4 Hz de POST (cada um é uma conexão nova — o
  // servidor é Connection: close) disputariam as 6 conexões do Chromium com o
  // SSE e a mídia. Sobe a 1 Hz, e NA HORA quando o estado troca de verdade.
  var stUltimoMs = 0;
  var stUltimaChave = '';
  var abertaEm = Date.now();
  var el = {};

  // --------------------------------------------------------------------------
  // O BUS — definido ANTES de db.js capturá-lo
  // --------------------------------------------------------------------------
  global.__AVBus = {
    post: function (msg) { drenar(msg); },
    recv: function (fn) { listeners.push(fn); },
  };

  function drenar(msg) {
    if (!msg || !msg.type) return;
    if (msg.type === 'display-ready') {
      prontoUltimo = msg;
      telaId = msg.__de || '';
      subir(msg);
      return;
    }
    if (msg.type === 'display-status') {
      var chave = String(msg.playing) + '|' + String(msg.mediaId) + '|' + String(msg.view);
      var agora = Date.now();
      if (chave === stUltimaChave && agora - stUltimoMs < 1000) return;
      stUltimaChave = chave;
      stUltimoMs = agora;
      subir(Object.assign({}, msg, { type: 'tela-status', __tela: telaId }));
    }
    // Lista de PERMISSÃO: todo o resto morre mudo (ver o cabeçalho).
  }

  function subir(msg) {
    if (!token) return;
    postar({ do: 'st', st: msg });
  }

  function entregar(msg) {
    var fns = listeners.slice();
    for (var i = 0; i < fns.length; i++) {
      try { fns[i](msg); } catch (e) { /* um handler não cala os demais */ }
    }
  }

  // --------------------------------------------------------------------------
  // A correção de relógio
  // --------------------------------------------------------------------------
  function amostraRelogio(msDoCelular) {
    var amostra = Date.now() - msDoCelular;
    offsets.push(amostra);
    if (offsets.length > RELOGIO_AMOSTRAS) offsets.shift();
    var ordenado = offsets.slice().sort(function (a, b) { return a - b; });
    offsetMs = ordenado[ordenado.length >> 1];
    temOffset = true;
  }

  function corrigirRelogio(msg) {
    if (!temOffset || !msg || msg.type !== 'text') return msg;
    var m = msg;
    if (m.chrono && typeof m.chrono.startAt === 'number' && m.chrono.startAt > 0) {
      m = Object.assign({}, m, {
        chrono: Object.assign({}, m.chrono, { startAt: m.chrono.startAt + offsetMs }),
      });
    }
    if (m.draw && typeof m.draw.rollUntil === 'number' && m.draw.rollUntil > 0) {
      m = Object.assign({}, m, {
        draw: Object.assign({}, m.draw, { rollUntil: m.draw.rollUntil + offsetMs }),
      });
    }
    return m;
  }

  // --------------------------------------------------------------------------
  // Transporte: SSE por fetch+ReadableStream — o MESMO transporte do GET /v de
  // sempre (Authorization no header; EventSource não manda header, e o token
  // nunca viaja numa URL), com o AbortController e o vigia de fio herdados.
  // --------------------------------------------------------------------------
  async function conectar() {
    var ac = new AbortController();
    abortar = ac;
    fioMudo = false;
    var resp;
    try {
      resp = await fetch('/e', {
        headers: { Authorization: 'Bearer ' + token },
        cache: 'no-store',
        signal: ac.signal,
      });
    } catch (e) {
      return fioMudo ? 'fio mudo' : 'rede';
    }
    // 404 uniforme = token inválido (o código rotacionou, a sessão venceu, o
    // operador religou): derruba o token e volta ao pareamento — a regra de
    // sempre, mantida no endpoint novo para uma rota errada nunca apagar
    // tokens válidos em silêncio.
    if (resp.status === 404 || resp.status === 403) return 'token';
    if (!resp.ok || !resp.body) return 'rede';
    aoConectar();
    var leitor = resp.body.getReader();
    var dec = new TextDecoder();
    var buf = '';
    ultimoByteMs = Date.now();
    while (true) {
      var r;
      try {
        r = await leitor.read();
      } catch (e) {
        return fioMudo ? 'fio mudo' : 'rede';
      }
      if (r.done) return 'fim do fluxo';
      ultimoByteMs = Date.now();
      buf += dec.decode(r.value, { stream: true });
      var corte;
      while ((corte = buf.indexOf('\n\n')) >= 0) {
        var bruto = buf.slice(0, corte);
        buf = buf.slice(corte + 2);
        var fim = tratarEvento(bruto);
        if (fim) return fim;
      }
      // Teto de sanidade: um evento sem terminador não pode crescer sem fim.
      if (buf.length > 65536) buf = '';
    }
  }

  /** @return uma razão de término, ou '' para seguir. */
  function tratarEvento(bruto) {
    if (!bruto) return '';
    if (bruto.charCodeAt(0) === 0x3A) {
      // Comentário SSE — o ping ': ping <epoch-ms>' com o relógio do celular.
      var ms = parseInt(bruto.slice(7), 10);
      if (isFinite(ms) && ms > 0) amostraRelogio(ms);
      return '';
    }
    if (bruto.slice(0, 6) !== 'data: ') return '';
    var msg = null;
    try { msg = JSON.parse(bruto.slice(6)); } catch (e) { return ''; }
    if (!msg) return '';
    if (msg.m === 'oi') {
      if (typeof msg.ms === 'number') amostraRelogio(msg.ms);
      return '';
    }
    if (msg.m === 'adeus') return 'adeus';
    entregar(corrigirRelogio(msg));
    return '';
  }

  function aoConectar() {
    conectada = true;
    tentativa = 0;
    frase('');
    esconderEntrada();
    // O REANÚNCIO: toda conexão (primeira ou reconexão) se apresenta e recebe
    // a cena endereçada de volta — o caminho do dongle que reconecta.
    if (prontoUltimo) subir(prontoUltimo);
  }

  async function laco() {
    vivo = true;
    while (vivo) {
      var fim = await conectar();
      conectada = false;
      abortar = null;
      if (!vivo) break;
      if (fim === 'token') { cairToken('A transmissão foi reiniciada — digite o código novo.'); break; }
      if (fim === 'adeus') { aoAdeus(); break; }
      var degrau = Math.min(tentativa, RECONEXAO.length - 1);
      tentativa++;
      frase('Sem sinal (' + fim + ') — tentando de novo…');
      await pausa(RECONEXAO[degrau]);
    }
  }

  function pausa(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // O compasso: vigia de fio + alive. Um só timer, como no cliente antigo.
  setInterval(function () {
    if (conectada && ultimoByteMs && Date.now() - ultimoByteMs > PING_SUMIDO_MS) {
      // O fio emudeceu com a conexão "aberta": TCP meio-aberto. Abortar é o
      // que devolve o laço à escada de reconexão.
      fioMudo = true;
      if (abortar) try { abortar.abort(); } catch (e) { /* já caiu */ }
    }
  }, 1000);
  setInterval(function () {
    if (!token || !conectada) return;
    postar({
      do: 'alive',
      telaAcesaMin: Math.floor((Date.now() - abertaEm) / 60000),
      aviso: semAcento('[tela de comandos] ' + (prontoUltimo ? 'pronta' : 'esperando o display')),
    });
  }, ALIVE_MS);

  async function postar(corpo) {
    if (!token) return;
    var ac = new AbortController();
    var t = setTimeout(function () { ac.abort(); }, PRAZO_POST_MS);
    try {
      var r = await fetch('/r', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
        cache: 'no-store',
        signal: ac.signal,
      });
      if (r.status === 404) cairToken('A sessão venceu — digite o código de novo.');
    } catch (e) {
      // Relato perdido não é evento: o próximo compasso tenta de novo.
    } finally {
      clearTimeout(t);
    }
  }

  // O que o cliente manda ao Kotlin vai em ASCII — o saneamento do Registro
  // apaga em vez de transliterar, e a lição da v5.155 é do lado que ESCREVE.
  function semAcento(s) {
    var mapa = { 'á': 'a', 'à': 'a', 'ã': 'a', 'â': 'a', 'é': 'e', 'ê': 'e', 'í': 'i', 'ó': 'o', 'õ': 'o', 'ô': 'o', 'ú': 'u', 'ç': 'c', '—': '-', '…': '...' };
    var fora = '';
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (c >= ' ' && c <= '~') { fora += c; continue; }
      fora += mapa[c] || mapa[c.toLowerCase()] || '';
    }
    return fora;
  }

  // --------------------------------------------------------------------------
  // Token: sessionStorage com degradação a memória (modo privado/quiosque
  // lança — a lição do guardado() do cliente antigo, herdada tal qual).
  // --------------------------------------------------------------------------
  function guardar(t) {
    token = t;
    try { global.sessionStorage.setItem('av-tela', t); } catch (e) { /* memória */ }
  }
  function guardado() {
    try { return global.sessionStorage.getItem('av-tela') || ''; } catch (e) { return ''; }
  }
  function cairToken(motivo) {
    token = '';
    try { global.sessionStorage.removeItem('av-tela'); } catch (e) { /* nada */ }
    conectada = false;
    vivo = false;
    if (abortar) try { abortar.abort(); } catch (e) { /* já caiu */ }
    mostrarEntrada(motivo || '');
  }

  function aoAdeus() {
    // Despedida do operador ≠ queda de rede: nada de martelar a porta. O
    // código nasce a cada ligar, então a volta é pelo overlay, com o código
    // novo que a folha do operador mostra.
    cairToken('O operador desligou a transmissão.');
  }

  // --------------------------------------------------------------------------
  // A ENTRADA — o overlay do código, e o botão que gasta o gesto
  // --------------------------------------------------------------------------
  /**
   * Dois modos, um overlay: `codigo` (a entrada de sempre) e `gesto` (recarga
   * com sessão viva — só o toque que devolve som e tela cheia, porque o gesto
   * não sobrevive à recarga da página).
   */
  function montarEntrada(modo) {
    if (el.entrada) el.entrada.remove();
    var raiz = doc.createElement('div');
    raiz.id = 'telaEntrada';
    raiz.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:var(--bg,#000);color:var(--text,#f2efe9);font-family:system-ui,sans-serif;';
    var deCodigo = modo !== 'gesto';
    raiz.innerHTML =
      '<div style="text-align:center;max-width:22rem;padding:1rem">' +
      (deCodigo
        ? '<div style="font-size:1.1rem;margin-bottom:.75rem">Digite o código que aparece no celular</div>' +
          '<input id="telaCod" inputmode="numeric" autocomplete="one-time-code" maxlength="3" ' +
          'style="width:9rem;font-size:2.2rem;text-align:center;letter-spacing:.4rem;padding:.35rem;' +
          'background:transparent;color:inherit;border:1px solid var(--muted,#777);border-radius:var(--radius-pill,999px)">'
        : '') +
      '<div style="margin-top:.9rem">' +
      '<button id="telaEntrar" style="font-size:1.05rem;padding:.55rem 1.6rem;border:none;' +
      'border-radius:var(--radius-pill,999px);background:var(--accent-fill,#8a6d1d);color:var(--on-accent,#111)">' +
      (deCodigo ? 'Conectar — com som e tela cheia' : 'Tocar para ouvir e ir a tela cheia') +
      '</button></div>' +
      '<div id="telaMsg" style="margin-top:.8rem;min-height:1.2rem;color:var(--muted,#aaa)"></div>' +
      '</div>';
    doc.body.appendChild(raiz);
    el.entrada = raiz;
    el.cod = doc.getElementById('telaCod');
    el.msg = doc.getElementById('telaMsg');
    var btn = doc.getElementById('telaEntrar');
    if (deCodigo) {
      btn.addEventListener('click', entrarClique);
      el.cod.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') entrarClique();
      });
    } else {
      btn.addEventListener('click', function () {
        gastarGesto();
        esconderEntrada();
      }, { once: true });
    }
    // O overlay "Ligar Sistema" do display cobre a tela no navegador; aqui o
    // gesto é o NOSSO botão, e dois overlays de gesto é um a mais.
    var start = doc.getElementById('startBtn');
    if (start) start.hidden = true;
  }

  function mostrarEntrada(motivo) {
    montarEntrada('codigo');
    el.entrada.style.display = 'flex';
    frase(motivo || '');
  }
  function esconderEntrada() {
    if (el.entrada) el.entrada.style.display = 'none';
  }
  function frase(s) {
    if (el.msg) el.msg.textContent = s;
  }

  async function entrarClique() {
    var codigo = String((el.cod && el.cod.value) || '').replace(/[^0-9]/g, '');
    if (codigo.length !== 3) { frase('São três dígitos.'); return; }
    // O GESTO É GASTO AQUI, ANTES da rede responder — é a restrição de
    // plataforma que desenhou a v5.186 inteira: a ativação transitória não
    // espera um POST dar a volta.
    gastarGesto();
    frase('Conectando…');
    var resp = null;
    try {
      var r = await fetch('/par', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: codigo,
          ua: semAcento(String(global.navigator.userAgent || '').slice(0, 88)),
          w: global.innerWidth | 0,
          h: global.innerHeight | 0,
        }),
        cache: 'no-store',
      });
      resp = { status: r.status, corpo: await r.json().catch(function () { return {}; }) };
    } catch (e) {
      frase('Não foi possível falar com o celular. Ele está nesta rede?');
      return;
    }
    if (resp.status === 200 && resp.corpo && resp.corpo.t) {
      guardar(resp.corpo.t);
      laco();
      return;
    }
    if (resp.corpo && resp.corpo.estado === 'lotado') {
      frase('O limite de telas foi atingido — feche uma das outras.');
      return;
    }
    frase('Código não confere — olhe o número no celular.');
  }

  function gastarGesto() {
    // Tela cheia: no documento inteiro — o display É a página.
    try {
      var raiz = doc.documentElement;
      var f = raiz.requestFullscreen || raiz.webkitRequestFullscreen;
      if (f) { var p = f.call(raiz); if (p && p.catch) p.catch(function () {}); }
    } catch (e) { /* alguns navegadores recusam: a tela funciona em janela */ }
    // Som: o display nasce com forceMuted no papel tela; o gancho o solta.
    // O som continua OPT-IN por tela (invariante 10) — este É o opt-in.
    try { if (global.__telaSom) global.__telaSom(true); } catch (e) { /* mudo */ }
    vigilia();
  }

  // --------------------------------------------------------------------------
  // A VIGÍLIA — a tela não pode apagar no meio do sermão.
  //
  // O espelho de pixels mantinha a TV acesa porque um <video> tocava sempre;
  // numa cena de TEXTO por comandos não há vídeo nenhum, e
  // `navigator.wakeLock` não existe em http (contexto seguro). O truque
  // honesto: um <video> de 2×2 alimentado por canvas.captureStream (que NÃO é
  // [SecureContext]) tocando mudo em loop — vídeo tocando inibe o descanso de
  // tela na prática dos navegadores. O limite fica dito: navegador que o
  // ignore vai apagar a tela, e a saída é desligar a economia de tela do
  // aparelho.
  // --------------------------------------------------------------------------
  var vigiliaLigada = false;
  function vigilia() {
    if (vigiliaLigada) return;
    vigiliaLigada = true;
    try {
      var c = doc.createElement('canvas');
      c.width = 2; c.height = 2;
      var ctx = c.getContext('2d');
      var v = doc.createElement('video');
      v.muted = true;
      v.setAttribute('playsinline', '');
      v.style.cssText = 'position:fixed;left:-4px;top:-4px;width:2px;height:2px;opacity:.01;pointer-events:none;';
      v.srcObject = c.captureStream(1);
      doc.body.appendChild(v);
      var claro = false;
      setInterval(function () {
        claro = !claro;
        ctx.fillStyle = claro ? '#000000' : '#010101';
        ctx.fillRect(0, 0, 2, 2);
      }, 1000);
      var p = v.play();
      if (p && p.catch) p.catch(function () { /* sem vigília */ });
    } catch (e) { /* sem vigília: a folha do operador avisa o limite */ }
  }

  // --------------------------------------------------------------------------
  // Boot
  // --------------------------------------------------------------------------
  function iniciar() {
    var t = guardado();
    if (t) {
      // Recarga com sessão viva: reconecta sem pedir código. O gesto se
      // perdeu com a página — o som volta forçado-mudo e a tela em janela; o
      // overlay oferece o toque que destrava os dois de novo.
      token = t;
      montarEntrada('gesto');
      frase('Reconectando…');
      laco();
      return;
    }
    mostrarEntrada('');
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})(window);
