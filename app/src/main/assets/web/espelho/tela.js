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
  // A escada da REENTRADA (pedir um token novo depois de perdê-lo) é mais
  // lenta no fim: aqui não há nada a recuperar com pressa — a mídia local
  // segue tocando — e o celular pode estar com a transmissão desligada.
  var REENTRADA = [1000, 3000, 8000, 15000, 30000];
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
  // O gesto do visitante já foi gasto NESTA página? É ele que separa "ainda
  // não ativaram esta tela" (o overlay cheio é legítimo, não há nada por
  // baixo) de "está no ar" (nada pode cobrir a projeção — ver `cairToken`).
  var gestoGasto = false;
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
    // O REGISTRO ENRIQUECIDO (E4): uma tela sem o IndexedDB do celular não
    // resolve mediaId em nada — o `__rec` que o Controle anexa ao load é o
    // registro inteiro, com a mídia apontando para a URL /m/ servida pelo
    // celular. Cacheado ANTES da entrega, porque o display o pede DUAS vezes
    // (display.js e stage.js) pelo mesmo AVDB.getMedia embrulhado abaixo.
    if (msg.type === 'load' && msg.__rec && msg.__rec.id) {
      recCache[msg.__rec.id] = msg.__rec;
    }
    if (msg.type === 'tela-aviso') {
      avisoCena(String(msg.texto || 'Esta cena não aparece nas telas da rede.'));
      return '';
    }
    entregar(corrigirRelogio(msg));
    return '';
  }

  // ---- o acervo da tela: os __rec que já passaram por aqui ----
  var recCache = {};
  function embrulharAcervo() {
    var db = global.AVDB;
    if (!db || db.__telaEmbrulhado) return;
    db.__telaEmbrulhado = true;
    var original = db.getMedia;
    db.getMedia = function (id) {
      if (recCache[id]) return Promise.resolve(recCache[id]);
      return original.call(db, id);
    };
  }

  // ---- o aviso de cena que não vai para a rede ----
  var avisoEl = null;
  var avisoTimer = null;
  function avisoCena(texto) {
    if (!avisoEl) {
      avisoEl = doc.createElement('div');
      avisoEl.id = 'telaAviso';
      avisoEl.style.cssText = 'position:fixed;left:50%;bottom:8%;transform:translateX(-50%);' +
        'z-index:9998;padding:.6rem 1.2rem;border-radius:var(--radius-pill,999px);' +
        'background:rgba(0,0,0,.75);color:var(--text,#f2efe9);font-family:system-ui,sans-serif;' +
        'font-size:1rem;transition:opacity .3s;pointer-events:none;';
      doc.body.appendChild(avisoEl);
    }
    avisoEl.textContent = texto;
    avisoEl.style.opacity = '1';
    if (avisoTimer) clearTimeout(avisoTimer);
    avisoTimer = setTimeout(function () { avisoEl.style.opacity = '0'; }, 6000);
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
      if (fim === 'token') { cairToken('A transmissão foi reiniciada — reconectando.'); break; }
      if (fim === 'adeus') { aoAdeus(); break; }
      var degrau = Math.min(tentativa, RECONEXAO.length - 1);
      tentativa++;
      // A frase só existe enquanto o overlay existe (a primeira ativação). Com
      // a tela no ar ela não é desenhada em lugar nenhum, de propósito: a
      // reconexão é do FIO, e a mídia local não parou para esperá-la.
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
  /**
   * O token morreu (404/403, ou o operador religou a transmissão).
   *
   * **Isto NÃO desenha nada por cima da mídia** (v5.189). Até aqui a resposta
   * era o overlay de entrada, e ele aparecia por cima do louvor que continuava
   * tocando — porque a mídia é LOCAL na tela (o `<video>` toca o arquivo do
   * `/m/`, e a letra sincronizada anda pelo `timeupdate` dele): a queda leva o
   * fio de comandos, nunca o que já está no ar. Cobrir isso com um cartaz era
   * apagar a projeção por causa de um problema que não a atingia.
   *
   * Sem código a digitar, a reentrada não precisa de gente: ela é um `POST`
   * que se repete numa escada. O gesto (som e tela cheia) já foi gasto nesta
   * página e sobrevive a tudo isto.
   */
  function cairToken(motivo) {
    token = '';
    try { global.sessionStorage.removeItem('av-tela'); } catch (e) { /* nada */ }
    conectada = false;
    vivo = false;
    if (abortar) try { abortar.abort(); } catch (e) { /* já caiu */ }
    if (gestoGasto) reentrarSozinho(motivo);
    else mostrarEntrada(motivo || '');
  }

  function aoAdeus() {
    // Despedida do operador ≠ queda de rede: nada de martelar a porta. Mas
    // também não é o fim da tela — o operador que desliga a transmissão para
    // religá-la dois minutos depois não pode precisar de alguém atravessando o
    // salão. A escada de reentrada cuida disso: ela vai a 30 s entre pedidos, e
    // o servidor desligado simplesmente recusa a conexão até voltar.
    cairToken('');
  }

  /**
   * A REENTRADA SILENCIOSA: pede um token novo até conseguir, sem cobrir nada.
   *
   * A escada é a mesma ideia da reconexão do fluxo (500 ms → 8 s), só que mais
   * lenta no fim (30 s): aqui não há nada a recuperar com pressa — a mídia
   * segue tocando —, e um `POST` a cada 30 s contra um celular que pode estar
   * com a transmissão desligada é ruído que não custa nada a ninguém.
   */
  var reentrando = false;
  async function reentrarSozinho(motivo) {
    if (reentrando) return;
    reentrando = true;
    if (motivo) avisoCena(motivo);
    var i = 0;
    while (!token) {
      await pausa(REENTRADA[Math.min(i, REENTRADA.length - 1)]);
      i++;
      var erro = await pedirEntrada();
      if (!erro) break;
    }
    reentrando = false;
    if (token && !vivo) laco();
  }

  // --------------------------------------------------------------------------
  // A ENTRADA — UM BOTÃO, e o gesto que ele gasta (v5.189)
  //
  // Não há mais código a digitar: a porta é o ENDEREÇO deste celular nesta
  // rede (ver a invariante 5 do `EspelhoPares`). Sobra a única coisa que o
  // navegador não deixa o app fazer sozinho — `requestFullscreen()` e sair do
  // `muted` exigem ativação transitória do usuário —, e é por isso que ainda
  // existe um toque: ele não é uma senha, é o gesto.
  //
  // ## Duas formas, e a diferença é se há mídia no ar
  //
  // • **Nada tocando** (a primeira carga da página): o overlay CHEIO, porque
  //   não há nada por baixo para ele cobrir.
  // • **Sessão viva no `sessionStorage`** (recarga no meio do culto): o
  //   fluxo recomeça NA HORA, por trás, e o toque é oferecido por um botão
  //   discreto de canto — cobrir a projeção com um cartaz seria trocar um
  //   problema por outro.
  //
  // E uma queda de conexão não desenha nada: ela reentra sozinha (não há
  // segredo a pedir), e a mídia que estiver tocando continua até o fim.
  // --------------------------------------------------------------------------
  // O DESENHO É O DO APP (v5.193), e ele não era.
  //
  // A entrada nasceu na v5.189 como um botão de estilo inline com valores de
  // emergência escritos à mão — inclusive um `var(--accent-fill, #8a6d1d)` cujo
  // fallback é o ÂMBAR que a v5.192 aposentou. Como o `tokens.css` é servido
  // junto (esta casca roda dentro do próprio `display/index.html`), o token
  // resolvia e o âmbar nunca aparecia: um valor errado invisível, esperando o
  // dia em que a folha não carregasse.
  //
  // Mas o problema maior não era a cor de emergência, e sim o que a tela É: ela
  // é a PRIMEIRA coisa que alguém vê num televisor da igreja, e mostrava um
  // botão solto no meio de um retângulo escuro, sem dizer de que sistema ele
  // era nem o que ia acontecer. Agora ela veste o mesmo wallpaper do telão (o
  // símbolo oficial da IASD, fonte única em `shared/wallpaper-padrao.svg`), diz
  // o nome do sistema, o que o toque faz, e usa a anatomia dos botões
  // principais do app: pílula preenchida em `--accent-fill` com `--on-accent`
  // por cima, e o mesmo recuo de toque (`--press`) do resto.
  //
  // Continua sendo CSS injetado por JS, e não uma folha à parte, por um motivo
  // que não mudou: `tela.js` é a casca de um papel que o `display/index.html`
  // carrega para TODO mundo (telão de verdade incluído), e uma folha a mais no
  // `<head>` pesaria nos três papéis para servir a um. Aqui ela nasce só quando
  // a entrada é montada.
  var ESTILO_ENTRADA = [
    '#telaEntrada{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;',
    'justify-content:center;background:var(--wallpaper) center/cover no-repeat;',
    "background-image:url('../shared/wallpaper-padrao.svg');",
    'color:var(--stage-text);font-family:system-ui,-apple-system,sans-serif;text-align:center}',
    '#telaEntrada .te-caixa{max-width:26rem;padding:2rem 1.25rem;',
    'background:var(--scrim);border-radius:var(--radius-card, 10px)}',
    '#telaEntrada .te-marca{font-size:.78rem;letter-spacing:.18em;text-transform:uppercase;',
    'color:var(--stage-text-dim);margin-bottom:.5rem}',
    '#telaEntrada h1{font-size:1.5rem;line-height:1.25;margin:0 0 .35rem;font-weight:700}',
    '#telaEntrada .te-sub{font-size:.95rem;color:var(--stage-text-soft);margin:0 0 1.4rem}',
    '#telaEntrar{font-size:1.1rem;font-weight:700;padding:.8rem 2.2rem;border:none;cursor:pointer;',
    'font-family:inherit;border-radius:var(--radius-pill, 999px);',
    'background:var(--accent-fill);color:var(--on-accent);',
    'transition:transform .12s ease}',
    '#telaEntrar:active{transform:var(--press, scale(.96))}',
    '#telaMsg{margin-top:1rem;min-height:1.2rem;font-size:.9rem;color:var(--stage-text-dim)}',
  ].join('');

  function montarEntrada() {
    if (el.entrada) el.entrada.remove();
    if (!doc.getElementById('telaEntradaCss')) {
      var css = doc.createElement('style');
      css.id = 'telaEntradaCss';
      css.textContent = ESTILO_ENTRADA;
      doc.head.appendChild(css);
    }
    var raiz = doc.createElement('div');
    raiz.id = 'telaEntrada';
    raiz.innerHTML =
      '<div class="te-caixa">' +
      '<div class="te-marca">Audio Visual IASD</div>' +
      '<h1>Esta tela vai mostrar a projeção</h1>' +
      '<p class="te-sub">Toque para ativar: a tela entra em modo cheio e passa a ' +
      'receber o que o operador projetar.</p>' +
      '<button id="telaEntrar">Ativar esta tela</button>' +
      '<div id="telaMsg"></div>' +
      '</div>';
    doc.body.appendChild(raiz);
    el.entrada = raiz;
    el.msg = doc.getElementById('telaMsg');
    doc.getElementById('telaEntrar').addEventListener('click', ativar);
    // O overlay "Ligar Sistema" do display cobre a tela no navegador; aqui o
    // gesto é o NOSSO botão, e dois overlays de gesto é um a mais.
    var start = doc.getElementById('startBtn');
    if (start) start.hidden = true;
  }

  function mostrarEntrada(motivo) {
    montarEntrada();
    el.entrada.style.display = 'flex';
    frase(motivo || '');
  }
  function esconderEntrada() {
    if (el.entrada) el.entrada.style.display = 'none';
  }
  function frase(s) {
    if (el.msg) el.msg.textContent = s;
  }

  /**
   * O toque do visitante: gasta o gesto ANTES da rede (a ativação transitória
   * não espera um POST dar a volta) e só então trata da sessão.
   */
  async function ativar() {
    gastarGesto();
    esconderEntrada();
    esconderCanto();
    if (token) { if (!vivo) laco(); return; }
    frase('Conectando…');
    var erro = await pedirEntrada();
    if (erro) { mostrarEntrada(erro); return; }
    laco();
  }

  /**
   * `POST /par` sem segredo nenhum — o corpo é o RELATO da tela e mais nada.
   * Devolve '' quando entrou, ou a FRASE do que impediu.
   */
  async function pedirEntrada() {
    var resp = null;
    try {
      var r = await fetch('/par', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ua: semAcento(String(global.navigator.userAgent || '').slice(0, 88)),
          w: global.innerWidth | 0,
          h: global.innerHeight | 0,
        }),
        cache: 'no-store',
      });
      resp = { status: r.status, corpo: await r.json().catch(function () { return {}; }) };
    } catch (e) {
      return 'Não foi possível falar com o celular. Ele está nesta rede?';
    }
    if (resp.status === 200 && resp.corpo && resp.corpo.t) {
      guardar(resp.corpo.t);
      return '';
    }
    if (resp.corpo && resp.corpo.estado === 'lotado') {
      return 'O limite de telas foi atingido — feche uma das outras.';
    }
    return 'O celular recusou esta tela. O operador pode tê-la desconectado.';
  }

  function gastarGesto() {
    gestoGasto = true;
    // Tela cheia: no documento inteiro — o display É a página.
    telaCheia();
    // Som: o display nasce com forceMuted no papel tela; o gancho o solta.
    // O som continua OPT-IN por tela (invariante 10) — este É o opt-in.
    try { if (global.__telaSom) global.__telaSom(true); } catch (e) { /* mudo */ }
    vigilia();
  }

  function telaCheia() {
    try {
      var raiz = doc.documentElement;
      var f = raiz.requestFullscreen || raiz.webkitRequestFullscreen;
      if (f) { var p = f.call(raiz); if (p && p.catch) p.catch(function () {}); }
    } catch (e) { /* alguns navegadores recusam: a tela funciona em janela */ }
  }

  function emTelaCheia() {
    return !!(doc.fullscreenElement || doc.webkitFullscreenElement);
  }

  // --------------------------------------------------------------------------
  // O BOTÃO DE CANTO — o caminho de volta à tela cheia (v5.189)
  //
  // Sair da tela cheia é UM toque na tecla errada de um controle remoto, e até
  // aqui a única forma de voltar era recarregar a página: o gesto de entrada
  // era o único ponto do sistema que chamava `requestFullscreen`. Ele
  // aparece só quando FALTA tela cheia (ou som), se recolhe sozinho em 5 s e
  // volta com qualquer toque — o player de sempre. E um TOQUE DUPLO em
  // qualquer lugar da página faz a mesma coisa, que é o gesto que todo mundo
  // já tenta primeiro num vídeo.
  // --------------------------------------------------------------------------
  var cantoTimer = null;
  function mostrarCanto(rotulo) {
    if (!el.canto) {
      var b = doc.createElement('button');
      b.id = 'telaCanto';
      b.style.cssText = 'position:fixed;right:1.2rem;bottom:1.2rem;z-index:9998;' +
        'font-size:.95rem;padding:.5rem 1.1rem;border:none;opacity:0;transition:opacity .25s;' +
        'border-radius:var(--radius-pill,999px);background:rgba(0,0,0,.66);color:var(--text,#f2efe9);' +
        'font-family:system-ui,sans-serif';
      b.addEventListener('click', function (ev) {
        ev.stopPropagation();
        gastarGesto();
        esconderCanto();
      });
      doc.body.appendChild(b);
      el.canto = b;
    }
    el.canto.textContent = rotulo;
    el.canto.style.display = '';
    // Um quadro depois, para a transição de opacidade acontecer.
    setTimeout(function () { if (el.canto) el.canto.style.opacity = '1'; }, 16);
    if (cantoTimer) clearTimeout(cantoTimer);
    cantoTimer = setTimeout(esconderCanto, 5000);
  }
  function esconderCanto() {
    if (cantoTimer) { clearTimeout(cantoTimer); cantoTimer = null; }
    if (!el.canto) return;
    el.canto.style.opacity = '0';
    setTimeout(function () { if (el.canto && el.canto.style.opacity === '0') el.canto.style.display = 'none'; }, 260);
  }
  /** O que falta nesta tela, como frase de botão — ou '' quando nada falta. */
  function oQueFalta() {
    var semSom = !gestoGasto;
    if (!emTelaCheia() && semSom) return 'Ativar som e tela cheia';
    if (!emTelaCheia()) return 'Voltar à tela cheia';
    if (semSom) return 'Ativar o som';
    return '';
  }
  function oferecerGesto() {
    var falta = oQueFalta();
    if (falta) mostrarCanto(falta);
  }

  function ligarGestosDeTela() {
    // Toque/clique: mostra o botão quando há o que oferecer. O duplo faz na
    // hora, sem passar pelo botão.
    doc.addEventListener('click', function () { oferecerGesto(); });
    doc.addEventListener('dblclick', function () {
      if (oQueFalta()) { gastarGesto(); esconderCanto(); } else { telaCheia(); }
    });
    // Sair da tela cheia (o ESC, o botão do controle remoto) OFERECE a volta na
    // hora: é o instante em que o operador percebe o problema.
    doc.addEventListener('fullscreenchange', function () {
      if (!emTelaCheia()) oferecerGesto(); else esconderCanto();
    });
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
    // O AVDB já existe (db.js carrega antes do DOM pronto) — o embrulho do
    // acervo entra aqui, uma vez.
    embrulharAcervo();
    ligarGestosDeTela();
    var t = guardado();
    if (t) {
      // RECARGA COM SESSÃO VIVA (o culto está no ar). O fluxo recomeça na
      // hora, e o overlay NÃO é desenhado: cobrir a projeção com um cartaz
      // por causa de um F5 seria o mesmo defeito que a v5.189 tirou do
      // caminho da queda de conexão. O que se perdeu com a página foi o
      // gesto — o som volta forçado-mudo e a tela em janela —, e ele é
      // oferecido pelo botão de canto, que se recolhe sozinho.
      token = t;
      laco();
      oferecerGesto();
      return;
    }
    // PRIMEIRA CARGA: não há nada por baixo, e o overlay cheio é a forma certa
    // de dizer "esta tela ainda não foi ativada".
    mostrarEntrada('');
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})(window);
