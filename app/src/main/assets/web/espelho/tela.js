// ============================================================================
// O PAPEL `tela` — a casca que faz o /display/ rodar num navegador da LAN.
// (TELÃO POR COMANDOS, E3 — docs/TELAO-POR-COMANDOS.md §3.4)
//
// UMA PÁGINA SÓ, e isso não é preferência: `requestFullscreen()` e sair do
// `muted` exigem ativação transitória do usuário, que vale segundos e **NÃO
// SOBREVIVE A UMA NAVEGAÇÃO** — uma página de entrada que navegasse ao display
// perderia o gesto, e a tela entraria muda e em janela. A entrada é um OVERLAY
// sobre o display ainda vazio, e o botão gasta o único gesto do visitante nas
// três coisas de uma vez: entra (POST /par), liga o som e vai a tela cheia.
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
// diag-dump, e N telas mandando isso de volta ao celular quebra a suposição de
// que há UM telão: media-ended dobrado dá um segundo load em repeat-one;
// mic-status 'unsupported' (não há getUserMedia em http) apagaria o estado do
// microfone VERDADEIRO; diag-dump duplo faz o Registro mostrar o diário de um
// sem dizer qual. Sobem DUAS coisas: `display-ready` (o que faz o Controle
// reenviar a cena) e `display-status` RENOMEADO `tela-status`, com o id desta
// tela. Tipo novo nasce mudo por construção.
//
// ## O que este arquivo NÃO faz
//
// Não renderiza nada (o display.js é o motor — invariante 5 aplicada ao
// próprio lado web), não decide cena, não toca em mídia (E4: o `__rec` chega
// no próprio load). Fora do papel `tela`, é um no-op de uma guarda — no telão
// de verdade e no navegador de desenvolvimento ele não existe.
//
// O papel é marcado pela `<meta name="av-tela">` que o SERVIDOR injeta em toda
// página que entrega, com `?tela=1` como recuo para shell antigo — **nesta
// ordem**: a query chega por um 302 que um navegador de TV pode não preservar,
// e enquanto ela foi o marcador ÚNICO a tela abria como um /display/ comum.
// ============================================================================
(function (global) {
  'use strict';
  var doc = global.document;
  // A GUARDA: papel EXPLÍCITO, nunca adivinhação de origem — o fluxo de
  // desenvolvimento no navegador (`window.open('../display/')`) precisa
  // continuar caindo fora daqui, e ele chega pelo mesmo protocolo e por um
  // endereço parecido.
  //
  // SÃO DOIS SINAIS, e o segundo existe porque o primeiro é uma corrente de
  // elos frágeis. `?tela=1` chega por um 302 da rota `/`, e basta um elo ceder
  // — um navegador de TV que não preserva a query no redirecionamento, o
  // endereço guardado nos favoritos sem ela, alguém digitando `/display/`
  // direto — para a página abrir como um `/display/` comum: mostra o wallpaper,
  // não desenha a entrada, não pede token e nunca conecta. Os dois sintomas que
  // o operador relatou juntos ("pula a tela de ativar" + "não conecta na rede")
  // são esse único desfecho.
  //
  // A `<meta name="av-tela">` é injetada pelo SERVIDOR em toda página que ele
  // entrega (`EspelhoServidor.comMarcaDeTela`), e ele só entrega o display —
  // `web/controle/` nunca entra na allowlist de prefixos. Quem serve a página
  // sabe o que ela é; a URL é só o transporte. É `<meta>` e não `<script>`
  // porque a CSP daquela resposta não permite script embutido.
  //
  // Degrada nos dois sentidos: num shell antigo a marca não vem e a query
  // resolve; num bundle antigo a marca é ignorada e a query resolve.
  var marcada = !!(doc && doc.querySelector('meta[name="av-tela"]'));
  if (!marcada && !/[?&]tela=1(?:&|$)/.test(global.location.search)) return;

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
      // O `__tela` NÃO É ENFEITE: é a única coisa que distingue, do lado do
      // Controle, o anúncio de uma TELA DA REDE do anúncio do telão de verdade
      // — e é por ele que o `onCommand` decide chamar
      // `telaReenviarPreferencias` (`if (msg.__tela)`), que é quem manda o
      // wallpaper, o fundo da letra (`lyricsbg`) e o preenchimento (`fit`).
      //
      // Ele FALTAVA aqui desde a v5.188, a versão que criou aquele reenvio: o
      // `tela-status` logo abaixo sempre o anexou, este nunca. O efeito não era
      // um erro em lugar nenhum — era a função inteira NUNCA RODAR para uma tela
      // de verdade, e as três preferências simplesmente não existirem nela. O
      // relato que fechou o caso foi o fundo dos slides ficando preto com a
      // opção ligada; o wallpaper e o preenchimento estavam quebrados do mesmo
      // jeito, calados, porque o padrão deles é aceitável e ninguém reparou.
      //
      // E O CARIMBO TEM UM DONO SÓ (`anuncio`), que é a outra metade da lição.
      // Há DOIS pontos que anunciam esta tela — este dreno e o `aoConectar` do
      // reanúncio —, e o que de fato entrega é quase sempre o SEGUNDO: o
      // `display-ready` do display.js nasce na carga da página, quando ainda não
      // há token, e `subir` devolve cedo. Carimbar aqui, no ponto que não é
      // exercitado, é escrever uma correção que nunca roda — foi exatamente o
      // que aconteceu na primeira tentativa deste conserto.
      subir(anuncio());
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
    if (!token || !msg) return;
    postar({ do: 'st', st: msg });
  }

  /**
   * O ANÚNCIO DESTA TELA, sempre com a marca do papel — o único lugar que o
   * monta. Cópia, nunca mutação: `prontoUltimo` é reanunciado a cada reconexão,
   * e carimbar o objeto guardado misturaria o estado de uma conexão com o da
   * seguinte. O fallback do `__de` existe para um display de bundle antigo não
   * devolver `''` e desligar as preferências em silêncio.
   */
  function anuncio() {
    if (!prontoUltimo) return null;
    return Object.assign({}, prontoUltimo, { __tela: telaId || '1' });
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

  // O RELÓGIO DO CELULAR, PUBLICADO (v5.210).
  //
  // `corrigirRelogio`, abaixo, conserta o que vem DENTRO da mensagem —
  // `chrono.startAt` e `draw.rollUntil`, que são épocas do celular. Mas o modo
  // RELÓGIO da ferramenta de Tempo não tem época nenhuma na mensagem: ele
  // desenha a hora corrente, e o `display.js` a lia de `Date.now()` — isto é,
  // do relógio DA TELA. Uma Smart TV com o relógio adiantado projetava a hora
  // errada na frente da congregação, e não havia campo a corrigir.
  //
  // Então a casca publica o relógio da ORIGEM. `offsetMs` é (tela − celular),
  // medido pela mediana das amostras do ping; subtraí-lo devolve o instante do
  // celular. Nos outros dois papéis esta função não existe e o `display.js` cai
  // no `Date.now()` de sempre — que ali JÁ É o celular, porque é o mesmo
  // aparelho.
  global.__avAgora = function () {
    return temOffset ? Date.now() - offsetMs : Date.now();
  };

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
      // O SINAL DE VIDA PEGA CARONA NO FIO (v5.208), e e esta a correcao.
      //
      // O `alive` morava so num `setInterval` de 10 s -- e um navegador de TV
      // ESTRANGULA timer de aba em segundo plano para ~1 por minuto (ou o
      // suspende enquanto a tela dorme). Com o teto do servidor em exatamente
      // 60 s, seis batidas viravam uma, e a sessao era executada na fronteira:
      // o Registro do operador mostrou uma tela morrendo em 60 s CRAVADOS, e o
      // mesmo navegador reentrando como tela A, B, C, D...
      //
      // Byte que CHEGA nao e timer: este `read()` resolve porque o servidor
      // escreveu, e o ping dele e de 15 s. Reportar daqui torna o sinal de vida
      // dirigido por EVENTO -- imune ao estrangulamento que matava a sessao. O
      // timer fica como piso, para o fio em silencio legitimo.
      if (Date.now() - ultimoAliveMs >= ALIVE_MS) enviarAlive();
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
    subir(anuncio());
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
  // O SINAL DE VIDA, num lugar so. Ele tem DOIS acionadores de proposito:
  // o fio (byte que chega -- ver o laco de leitura) e este timer, que e o
  // piso para quando o servidor esta em silencio legitimo. `ultimoAliveMs`
  // e o que impede os dois de dobrarem o trafego.
  var ultimoAliveMs = 0;
  function enviarAlive() {
    if (!token || !conectada) return;
    ultimoAliveMs = Date.now();
    postar({
      do: 'alive',
      telaAcesaMin: Math.floor((Date.now() - abertaEm) / 60000),
      aviso: semAcento('[tela de comandos] ' + (prontoUltimo ? 'pronta' : 'esperando o display')),
    });
  }
  setInterval(enviarAlive, ALIVE_MS);
  // E A VOLTA DA ABA e um sinal de vida na hora: um navegador que estrangulou
  // os timers volta a atender aqui primeiro, e este e o instante em que o
  // servidor mais precisa saber que a tela nunca foi embora.
  doc.addEventListener('visibilitychange', function () {
    if (!doc.hidden) enviarAlive();
  });

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
      // MUDO de propósito: não há código a digitar desde a v5.189 (a porta é o
      // ENDEREÇO), a reentrada é sozinha, e o KDoc do `cairToken` diz que isto
      // NÃO desenha nada por cima da mídia. Uma frase aqui vira um balão sobre
      // a projeção pedindo uma ação que não existe.
      if (r.status === 404) cairToken('');
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
  // Não há código a digitar: a porta é o ENDEREÇO deste celular nesta rede (ver
  // a invariante 5 do `EspelhoPares`). Sobra a única coisa que o navegador não
  // deixa o app fazer sozinho — `requestFullscreen()` e sair do `muted` exigem
  // ativação transitória do usuário. O toque não é senha, é o gesto.
  //
  // Duas formas, e a diferença é se há mídia no ar:
  //
  // • **Nada tocando** (primeira carga): o overlay CHEIO, porque não há nada por
  //   baixo para ele cobrir.
  // • **Sessão viva no `sessionStorage`** (recarga no meio do culto): o fluxo
  //   recomeça NA HORA, por trás, e o toque é oferecido por um botão discreto de
  //   canto — cobrir a projeção com um cartaz seria trocar um problema por outro.
  //
  // Uma queda de conexão não desenha nada: reentra sozinha (não há segredo a
  // pedir) e a mídia que estiver tocando continua até o fim.
  //
  // O DESENHO É O DO APP (v5.193). Esta é a PRIMEIRA coisa que alguém vê num
  // televisor da igreja, e mostrava um botão solto num retângulo escuro, sem
  // dizer de que sistema era. Hoje ela veste o wallpaper do telão (fonte única
  // em `shared/wallpaper-padrao.svg`), diz o nome do sistema e o que o toque
  // faz, e usa a anatomia dos botões principais: pílula em `--accent-fill` com
  // `--on-accent` e o mesmo `--press` do resto.
  //
  // AS REGRAS DA ENTRADA NÃO MORAM AQUI: são `espelho/tela.css`, carregada pelo
  // `display/index.html` (v5.205). Até a v5.204 este bloco montava um `<style>`
  // em runtime, com o argumento de que "uma folha a mais pesaria nos TRÊS papéis
  // para servir a um". **O argumento era plausível e estava errado**, e o preço
  // foi a tela da rede não conectar: a página servida pelo celular leva
  // `default-src 'self'` sem `style-src` (`EspelhoHttp.CABECALHOS_PAGINA`), e um
  // `<style>` de runtime exige `'unsafe-inline'`. O navegador ANEXA o elemento e
  // não aplica nada — o `#telaEntrada` virava um bloco sem posição no fim do
  // `<body>`, debaixo da camada fixa do wallpaper: invisível e inclicável, sem
  // um erro sequer. O custo real da folha, medido, é uma requisição de 3 kB ao
  // MESMO origin, inerte nos outros dois papéis (todo seletor está sob
  // `#telaEntrada`).
  //
  // **A REGRA QUE FICA, e vale para o papel `tela` inteiro: nas telas da rede
  // não existe estilo embutido.** `element.style.x = y` (CSSOM) continua valendo
  // — a CSP não o barra —, mas `<style>` criado em runtime e atributo `style=`
  // dentro de HTML injetado, não. O irmão deste defeito era o indicador de
  // espera do `shared/stage.js`, corrigido na mesma varredura.


  function montarEntrada() {
    if (el.entrada) el.entrada.remove();
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
    // O "Ligar Sistema" do display NÃO é escondido aqui (v5.216). Ele era, e o
    // buraco estava justamente nisto: `montarEntrada()` só roda na PRIMEIRA
    // carga — a recarga com sessão viva reconecta por trás, sem desenhar
    // overlay nenhum —, então um F5 na tela da rede trazia o botão antigo de
    // volta por cima da projeção, e o toque do visitante ia para ele em vez de
    // ir para o nosso. Quem o esconde agora é o próprio `display.js`, que é o
    // documento que o declara, e o faz pelo PAPEL — em toda carga.
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
      // A recusa é engolida de propósito: alguns navegadores negam e a tela
      // continua funcionando em janela. O que NÃO se faz é ler
      // `document.fullscreenElement` no mesmo turno para decidir alguma coisa —
      // o pedido é assíncrono, e essa leitura responderia o passado (v5.214).
      if (f) { var p = f.call(raiz); if (p && p.catch) p.catch(function () {}); }
    } catch (e) { /* alguns navegadores recusam: a tela funciona em janela */ }
  }

  // --------------------------------------------------------------------------
  // OS DOIS ATALHOS DE TELA CHEIA (v5.218)
  //
  // Sair da tela cheia é UM toque na tecla errada de um controle remoto, e a
  // tela precisa de um caminho de volta que NÃO derrube a projeção. São dois, e
  // os dois já existem na cabeça de quem está ali: o TOQUE DUPLO (o que se tenta
  // primeiro num vídeo) e o F11 (num navegador de computador — e este recurso
  // roda, quase sempre, num PC ligado ao projetor).
  //
  // O QUE SAIU DAQUI: até a v5.216 havia um botão discreto de canto que aparecia
  // quando faltava som ou tela cheia. Ele existia para devolver o gesto perdido
  // numa RECARGA — e a recarga passou a voltar para a entrada oficial (ver
  // `iniciar`), que é o mesmo botão do primeiro acesso. Saíram com ele o
  // `oQueFalta`/`oferecerGesto` (a pergunta que ninguém mais faz) e o
  // `assentando` da v5.214, que era só o guarda daquela pergunta — a regra que
  // ele protegia continua escrita no `telaCheia` acima.
  //
  // `preventDefault` no F11 é deliberado: sem ele o navegador entra na tela
  // cheia DELE ao mesmo tempo em que pedimos a da API, e sair passa a exigir
  // dois comandos. Um dono só para o estado.
  // --------------------------------------------------------------------------
  function ligarGestosDeTela() {
    doc.addEventListener('dblclick', function () { gastarGesto(); });
    doc.addEventListener('keydown', function (ev) {
      if (ev.key === 'F11') { ev.preventDefault(); gastarGesto(); }
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
  var travaTela = null;
  // A TRAVA DE VERDADE, quando ela existe (v5.208). `navigator.wakeLock` é
  // [SecureContext] e NÃO existe no http em que esta tela costuma rodar — mas
  // existe quando o operador configurou o certificado, e existe em `localhost`.
  // Onde ela existe, ela é o mecanismo correto; o `<video>` de 2x2 abaixo
  // continua como o piso para o caso normal.
  //
  // A guarda é `isSecureContext`, e ela é obrigatória: `tools/contexto-seguro.
  // test.mjs` reprova qualquer uso de `wakeLock` fora dela, justamente porque
  // aqui o padrão é http e um `undefined` viraria exceção no meio do culto.
  async function travar() {
    // A GUARDA COMO BLOCO, e não como retorno antecipado: é a forma que a
    // doutrina do projeto prescreve (`if (isSecureContext && 'X' in Y) { melhor }`)
    // e a que `tools/contexto-seguro.test.mjs` sabe ler — ele conta chaves, e um
    // `if (...) return;` deixaria a chamada fora de qualquer bloco guardado.
    // O oráculo reprovou a primeira versão disto, que é exatamente o trabalho
    // dele: no http em que esta tela roda, `wakeLock` vem `undefined`.
    if (global.isSecureContext && global.navigator && global.navigator.wakeLock) {
      try {
        travaTela = await global.navigator.wakeLock.request('screen');
      } catch (e) {
        travaTela = null;   // negada (bateria fraca, política do aparelho): fica o piso
      }
    }
  }
  function vigilia() {
    if (vigiliaLigada) return;
    vigiliaLigada = true;
    travar();
    // A TRAVA MORRE QUANDO A ABA SAI DE FOCO, por contrato da API — e voltar
    // sem re-pedir deixaria a tela apagando no meio do sermão depois do
    // primeiro piscar. Este é o mesmo evento que reenvia o sinal de vida.
    doc.addEventListener('visibilitychange', function () {
      if (!doc.hidden && !travaTela) travar();
    });
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
  // TODA CARGA COMEÇA NA ENTRADA OFICIAL (v5.218) — decisão do operador, e ela
  // REVOGA a metade da v5.189 que mandava a recarga reconectar por trás.
  //
  // A distinção é entre perder o FIO e perder a PÁGINA. Numa QUEDA DE FIO a
  // mídia continua tocando (é local, `/m/`, e a letra anda pelo `timeupdate` do
  // próprio `<video>`), então cobrir a projeção apagaria uma cena que o problema
  // não atingiu — `cairToken`/`reentrarSozinho` seguem silenciosos.
  //
  // Uma RECARGA já derrubou tudo: o documento, o `<video>`, a cena, e o GESTO
  // junto, porque ativação transitória não sobrevive a uma navegação. A tela
  // volta muda e em janela de qualquer jeito, então não há projeção a preservar.
  // O certo é o botão que o visitante já conhece — o MESMO do primeiro acesso —
  // e não um segundo controle, de canto, com outro nome.
  //
  // O TOKEN É CARREGADO ADIANTE, e isso não contradiz "a recarga desconecta": o
  // fio só abre quando o visitante toca. O que ele evita é o teto de três telas
  // — `telasSse` é indexado pelo TOKEN, então pedir pareamento novo a cada F5
  // deixaria a sessão anterior ocupando vaga até o vigia notá-la, e a terceira
  // recarga seguida receberia "lotado". Com o token reaproveitado o servidor
  // reconhece a volta e a vaga é a mesma; se ele tiver morrido, o `laco()`
  // recebe 404 e a reentrada silenciosa pede outro.
  function iniciar() {
    // O AVDB já existe (db.js carrega antes do DOM pronto) — o embrulho do
    // acervo entra aqui, uma vez.
    embrulharAcervo();
    ligarGestosDeTela();
    token = guardado();
    mostrarEntrada('');
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})(window);
