// A PONTE DO COMPUTADOR — a folha que a casca injeta em cada janela.
//
// No Android a ponte é `addJavascriptInterface`: o JavaScript chama um método
// Kotlin direto. No WebView2 esse atalho não existe, e o que existe é o
// servidor de loopback que o programa já sobe para servir a própria base. A
// ponte então vira duas rotas — `POST /ponte/call` para ir, um fio SSE para
// voltar — e esta folha é o que faz a diferença sumir.
//
// **O `shared/native.js` não muda uma linha por causa disto**, e essa é a
// medida do desenho: ele fala com `window.__AVBridge`, e o que este arquivo
// entrega é um `__AVBridge` com a mesma superfície e as mesmas convenções —
// método assíncrono recebe o `id` da chamada e responde por
// `window.__avResolve(id, valor)`; método de efeito não devolve nada.
//
// ## O que a casca injeta ANTES desta folha
//
//   window.__AV_CASCA__ = { base, papel, sessao, shell, nome };
//
// `papel` é `'controle'` ou `'display'` — e ele é SELADO PELA CASCA, que é
// quem cria a janela. É a invariante 9 com um degrau a mais que no Android:
// além de a folha não oferecer a superfície privilegiada, **o núcleo a recusa
// no servidor** para uma sessão que não seja a do Controle.
//
// ## Ordem de injeção
//
// Ela é `AddScriptToExecuteOnDocumentCreated`, que roda ANTES de qualquer
// script da página — o análogo exato do `addJavascriptInterface`, e é por isso
// que o `native.js` encontra `__AVBridge` já de pé quando é carregado.

(function (global) {
  'use strict';

  const CFG = global.__AV_CASCA__;
  if (!CFG) return; // navegador comum, ou uma tela da rede: nada a fazer

  // ---------------------------------------------------------------- envelope
  //
  // O FORMATO ESTÁ DESCRITO NO `NucleoPonte.kt`, e o contrato entre as duas
  // escritas dele mora em `tools/fixtures/ponte-envelope.json`. Este lado é
  // cobrado pelo `tools/ponte-envelope.test.mjs`; o outro, pelo
  // `NucleoPonteTest`. Ler um lado isolado aprova os dois — foi assim que o
  // `__tela` do `display-ready` passou dezenas de versões documentado e não
  // cumprido.
  const MARCA = 'AV1';
  const cod = new global.TextEncoder();

  function montar(id, metodo, args) {
    const pedacos = [cod.encode(MARCA + '\n' + id + '\n' + metodo + '\n' + args.length + '\n')];
    for (const a of args) {
      const b = cod.encode(a);
      // O comprimento é em BYTES, não em caracteres: 'Ó' são dois. Escrever
      // `a.length` funciona em todo hino sem acento e erra em quase todos os
      // outros — e erra DESLOCANDO o argumento seguinte, não estourando.
      pedacos.push(cod.encode(b.length + '\n'));
      pedacos.push(b);
      // A quebra de conferência. Ver o KDoc do `NucleoPonte`: sem ela um
      // comprimento errado por um byte continua parseando, com o texto trocado
      // de lugar.
      pedacos.push(cod.encode('\n'));
    }
    let total = 0;
    for (const p of pedacos) total += p.length;
    const fora = new Uint8Array(total);
    let i = 0;
    for (const p of pedacos) { fora.set(p, i); i += p.length; }
    return fora;
  }

  global.__AVEnvelope = { MARCA: MARCA, montar: montar };

  // ------------------------------------------------------------------- ida
  //
  // `keepalive` NÃO é usado: ele tem teto de 64 kB no Chromium, e o
  // `salvarTexto` carrega o Registro inteiro. O que se ganharia com ele — a
  // chamada sobreviver ao fechamento da página — não vale um teto silencioso
  // em cima do único método que de fato manda muitos bytes.
  const ALVO = CFG.base + '/ponte/call?s=' + encodeURIComponent(CFG.sessao);

  function enviar(id, metodo, args) {
    const corpo = montar(id, metodo, args.map(paraTexto));
    global.fetch(ALVO, { method: 'POST', body: corpo, cache: 'no-store' }).catch(function () {
      // Falha de transporte no LOOPBACK é o núcleo morto — não há rede para
      // oscilar. Não há retentativa: quem espera é o prazo de 60 s do
      // `native.js`, que já resolve `null`, e insistir contra um núcleo morto
      // só empilharia promessas.
    });
  }

  // Tudo vira TEXTO, e o Kotlin lê de volta com `toBooleanStrict`/`toLong`. É
  // a mesma redução que o `@JavascriptInterface` faz no Android, onde os tipos
  // que atravessam são os primitivos e a String — e é o que mantém o envelope
  // sem parser de tipos.
  function paraTexto(v) {
    if (v === null || v === undefined) return '';
    if (v === true) return 'true';
    if (v === false) return 'false';
    return String(v);
  }

  // ----------------------------------------------------------------- volta
  //
  // `EventSource` e não `fetch` com leitor de fluxo: aqui não há cabeçalho de
  // autorização a mandar — que é a razão pela qual as TELAS DA REDE não podem
  // usá-lo (`docs/TELAO-POR-COMANDOS.md`) —, e em troca ele reconecta sozinho.
  // O fio é o mesmo em que a resposta de uma chamada volta, então perdê-lo em
  // silêncio seria perder a ponte inteira.
  let fio = null;

  function abrirFio() {
    fio = new global.EventSource(CFG.base + '/ponte/e?s=' + encodeURIComponent(CFG.sessao));
    fio.onmessage = function (e) {
      let q;
      try { q = JSON.parse(e.data); } catch (_) { return; }
      if (!q || !q.t) return;
      if (q.t === 'r') {
        // A resposta de uma chamada. `__avResolve` já existe no `native.js`,
        // já descarta id desconhecido (a página recarregou) e já limpa o
        // prazo — nada aqui reimplementa isso.
        if (global.__avResolve) global.__avResolve(q.id, q.v);
      } else if (q.t === 'p') {
        const r = q.c === 'deck' ? global.__avDeckProgress : global.__avYtProgress;
        if (r) r(q.id, q.a, q.b);
      } else if (q.t === 'b') {
        // Um comando do barramento vindo da OUTRA janela.
        //
        // **A ENTREGA É PELO `__avBusDeliver`, e a folha NÃO define `__AVBus`.**
        // Quem o define é o `native.js`, que carrega DEPOIS desta folha e
        // sobrescreveria qualquer coisa que ela pusesse ali — o `db.js`
        // assinaria o objeto do `native.js` e o quadro cairia num ouvinte que
        // ninguém registrou. **O relay ficaria mudo na RECEPÇÃO**, e em
        // silêncio: o `BroadcastChannel` continua entregando, então nada
        // quebra na tela; o que se perde é a redundância que este projeto
        // construiu de propósito para o caso de ele falhar.
        //
        // `__avBusDeliver` é o mesmo nome que o `MessageBus.kt` do Android
        // chama — é contrato que já existe, não marcador inventado aqui.
        if (global.__avBusDeliver) {
          try { global.__avBusDeliver(q.m); } catch (_) { /* handler da página */ }
        }
      }
    };
    // Sem `onerror`: o `EventSource` reconecta sozinho, e um `close()` aqui
    // desligaria a ponte no primeiro soluço.
  }

  // O `__AVBus` NÃO é definido aqui — ver o quadro `b` acima. O lado do ENVIO
  // já funciona pelo caminho normal: o `native.js` monta o `__AVBus.post` dele
  // sobre `busPost`, que é um método desta folha como qualquer outro.

  // ------------------------------------------------------------- a superfície
  //
  // As listas são a superfície INTEIRA da ponte, e estão escritas por extenso
  // de propósito: um método que o `native.js` chame e que não esteja aqui vira
  // `TypeError` na hora, no `catch` do `native.js`, e o botão fica mudo. Com a
  // lista à vista, acrescentar um método à ponte é acrescentar uma palavra —
  // e esquecê-la é uma linha faltando num diff, não um mistério em culto.

  // Recebem o `id` da chamada e respondem por `__avResolve`.
  const ASSINCRONOS = [
    'apkInstalar', 'apkProcurar', 'areaTransferencia', 'atualizacaoEstado',
    'castTarget', 'cifraDiag', 'cifraHtml', 'deckPages', 'displays',
    'espelhoCertApagar', 'espelhoCertEstado', 'espelhoCertImportar',
    'espelhoDerrubar', 'espelhoDiag', 'espelhoEstado', 'espelhoLigar',
    'espelhoLigarEm', 'farolEstado', 'listFolder', 'micDiag', 'otaApply',
    'otaDiag', 'otaPending', 'pickDoc', 'pickFolder', 'requestMic',
    'salvarTexto', 'takeShare', 'ytCanalPlaylists', 'ytDiag', 'ytFetch',
    'ytFetchAte', 'ytFetchAudio', 'ytPlaylist', 'ytSearch', 'ytStream',
  ];

  // Efeito e mais nada. O id `-` é a convenção de "não espere resposta": o
  // núcleo não empurra `resolve` nenhum para ele.
  const DE_EFEITO = [
    'bgProgress', 'busPost', 'captureVolumeKeys', 'deckDiscard',
    'espelhoDesligar', 'farolContar', 'keepAlive', 'nowPlaying', 'openCast',
    'openExternal', 'otaCheck', 'otaConfirm', 'projecaoLocal', 'systemVolume',
    'temaClaro', 'ytCancel', 'ytDiscard',
  ];

  const B = {};
  for (const m of ASSINCRONOS) {
    B[m] = (function (nome) {
      return function (id) {
        enviar(id, nome, Array.prototype.slice.call(arguments, 1));
      };
    })(m);
  }
  for (const m of DE_EFEITO) {
    B[m] = (function (nome) {
      return function () { enviar('-', nome, Array.prototype.slice.call(arguments)); };
    })(m);
  }

  // OS QUATRO SÍNCRONOS. O `native.js` os lê na CARGA, antes de qualquer
  // Promise poder ter resolvido — `__SHELL_VERSION__`, `__AV_ROLE__` e
  // `__SHELL_NAME__` saem daqui. A casca os injeta como literais, o que é mais
  // forte que no Android: lá o papel vem de um campo do objeto Kotlin; aqui
  // ele é selado na janela por quem a criou.
  B.shellVersion = function () { return CFG.shell | 0; };
  B.role = function () { return String(CFG.papel || ''); };
  B.appVersion = function () { return String(CFG.nome || ''); };

  // O QUINTO SÍNCRONO, e o único que precisa de uma resposta do núcleo.
  //
  // `deckExportUrl` transforma um link do Google Apresentações no endereço de
  // exportação em PDF — REGRA, e portanto Kotlin (invariante 5). Reescrevê-la
  // aqui seria regra na casca; devolvê-la por Promise mudaria a forma de um
  // método publicado, e forma de método é degrau de `SHELL_VERSION` **nas duas
  // cascas**, com a Android pagando por uma mudança que não é dela.
  //
  // Sobra a requisição SÍNCRONA. Ela é o que o navegador desaconselha — e o
  // que ele desaconselha é bloquear a interface esperando a REDE. Aqui não há
  // rede: é o mesmo processo, no mesmo computador, respondendo em
  // microssegundos, uma vez, quando o operador importa uma apresentação do
  // Google. O motivo do aviso não se aplica ao caso.
  B.deckExportUrl = function (link) {
    try {
      const x = new global.XMLHttpRequest();
      x.open('POST', ALVO, false);
      x.send(montar('=', 'deckExportUrl', [String(link)]));
      const q = JSON.parse(x.responseText);
      return (q && typeof q.v === 'string') ? q.v : '';
    } catch (_) { return ''; }
  };

  global.__AVBridge = B;
  abrirFio();
})(window);
