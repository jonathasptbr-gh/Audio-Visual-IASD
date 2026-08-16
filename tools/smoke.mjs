// Fumaça do Controle: abre a base web num Chromium de verdade, deixa o app
// inicializar, entra em Configurações e usa o botão de copiar o Registro.
//
// ## Por que ele existe
//
// O CI já roda `node --check` em todo o bundle, e isso NÃO É SUFICIENTE: ele
// prova que os arquivos são parseáveis, não que o app funciona. A v5.121 saiu
// com o botão de copiar chamando `copiarTexto`, uma função que uma limpeza
// tinha apagado junto com o bloco em que ela morava — sintaxe perfeita, botão
// morto, e o operador descobriu no aparelho.
//
// Este teste pega exatamente essa classe: referência a coisa que não existe,
// erro na inicialização, handler que estoura ao ser tocado. Ele falha se
// QUALQUER erro de console ou exceção de página aparecer no caminho.
//
// ## O que ele não é
//
// Não é teste de comportamento do culto. Sem `__AVBridge` a base roda em modo
// navegador — sem Presentation, sem ponte, sem YouTube nativo. É de propósito:
// o que se verifica aqui é o que vale nos dois contextos, e é justamente onde
// um erro derruba o app inteiro antes de qualquer recurso nativo entrar.
//
//   node tools/smoke.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
};

const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const arquivo = path.join(RAIZ, p);
  // Não servir nada fora da base web, mesmo num teste local.
  if (!arquivo.startsWith(RAIZ) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
    res.writeHead(404); res.end('nao'); return;
  }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream' });
  fs.createReadStream(arquivo).pipe(res);
});

const falhas = [];
function checar(cond, msg) {
  if (cond) console.log('ok      ' + msg);
  else { console.log('FALHOU  ' + msg); falhas.push(msg); }
}

await new Promise((r) => servidor.listen(0, r));
const porta = servidor.address().port;
// `PW_CHROMIUM` aponta o binário quando ele não está onde o Playwright o
// procura (é o caso do ambiente de desenvolvimento deste projeto). Vazio ou
// ausente, vale o download que o próprio Playwright gerencia — que é o caso do
// runner do CI.
const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
// `hasTouch`: sem ele o contexto do Playwright não emula toque, e um
// `Input.dispatchTouchEvent` do CDP é entregue sem disparar
// `touchstart`/`touchmove` — o carrossel de abas (o único gesto de toque que
// este arquivo exercita) não teria como reagir, e o caso "passaria" por não
// medir nada. É o aparelho que este teste imita; o padrão de mesa não é.
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true });
// ---------- O TECLADO VIRTUAL, DE MENTIRA ----------
// Não há como abrir um teclado de sistema num Chromium headless, e o que
// interessa medir não é o teclado: é O QUE O NAVEGADOR REPORTA quando ele está
// aberto. São dois mundos, e o app precisa acertar nos dois:
//
//   · o hint `interactive-widget=resizes-content` HONRADO → a viewport de
//     LAYOUT encolhe, `window.innerHeight` diminui, e `visualViewport` a
//     acompanha. É o `setViewportSize` do Playwright, e nada a simular.
//   · o hint IGNORADO → a viewport de layout NÃO muda e só a visual encolhe (e
//     pode ser rolada para revelar o campo em foco). É o caso do WebView em
//     edge-to-edge do Android 15+, onde o `adjustResize` do manifest deixa de
//     valer — isto é, o caso do aparelho do operador. É este que se simula.
//
// A troca é do OBJETO que o navegador expõe, não de um atalho no app: o
// `keyboardShift` do `controle.js` lê `window.visualViewport` como leria no
// aparelho. Sem `__teclado` chamado, o falso espelha a viewport de verdade —
// então ele é inerte para todos os outros casos deste arquivo.
await ctx.addInitScript(() => {
  const alvo = new EventTarget();
  const falso = {
    height: 0, width: 0, offsetTop: 0, offsetLeft: 0, pageTop: 0, pageLeft: 0, scale: 1,
    addEventListener: (...a) => alvo.addEventListener(...a),
    removeEventListener: (...a) => alvo.removeEventListener(...a),
  };
  const espelhar = () => {
    if (window.__kbAberto) return;
    falso.height = window.innerHeight; falso.width = window.innerWidth; falso.offsetTop = 0;
  };
  window.addEventListener('resize', () => { espelhar(); alvo.dispatchEvent(new Event('resize')); });
  Object.defineProperty(window, 'visualViewport', { get: () => { espelhar(); return falso; }, configurable: true });
  window.__teclado = (px, rolagem) => {
    window.__kbAberto = px > 0;
    falso.width = window.innerWidth;
    falso.height = window.innerHeight - px;
    falso.offsetTop = rolagem || 0;
    alvo.dispatchEvent(new Event('resize'));
    alvo.dispatchEvent(new Event('scroll'));
  };
});
// `localhost` já é contexto seguro, então a Clipboard API está disponível — é o
// mesmo caminho que o app usa no aparelho (`https://appassets.…`).
try { await ctx.grantPermissions(['clipboard-read', 'clipboard-write']); } catch (_) {}
const pg = await ctx.newPage();
const base = `http://localhost:${porta}`;

const erros = [];
// SÓ os erros que são NOSSOS. Um runner sem saída para a internet (e este
// ambiente é um) derruba a IFrame API do YouTube e o acervo LouvorJA, e isso
// não diz nada sobre o bundle — o app é feito para funcionar sem rede durante
// o culto. Requisições ao próprio servidor de teste, essas, contam.
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY/;
pg.on('response', (r) => {
  if (r.status() >= 400 && r.url().startsWith(base)) erros.push('HTTP ' + r.status() + ' ' + r.url());
});
pg.on('console', (m) => {
  if (m.type() !== 'error') return;
  const t = m.text();
  if (EXTERNO.test(t)) return;
  // "Failed to load resource" sem URL: só conta se alguma resposta nossa falhou
  // (o `response` acima já a registra com o endereço).
  if (/Failed to load resource/.test(t)) return;
  erros.push(t);
});
pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));

try {
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });

  // O MESMO MARCADOR que o watchdog do OTA usa para dizer "o app está de pé"
  // (ver `otaAppIsUp` em shared/native.js): um `<li>` dentro de `#playlist` só
  // existe depois que o `init()` assíncrono terminou. Reaproveitá-lo evita
  // inventar um segundo sinal que envelheceria à parte do primeiro.
  await pg.waitForFunction(
    () => window.AVDB && window.createStage && typeof window.__avBack === 'function',
    null, { timeout: 20000 },
  );
  checar(true, 'a base web inicializa (AVDB + createStage + __avBack)');

  // `.click()` do DOM, não o do Playwright: o botão mora na coluna do mixer, que
  // nesta viewport pode estar recolhida — e o alvo do teste é o Registro, não a
  // geometria do mixer. O handler executado é o mesmo.
  await pg.evaluate(() => document.getElementById('settingsBtn').click());
  await pg.waitForSelector('#fadePopup.open', { timeout: 5000 });
  checar(true, 'Configurações abre');

  // O REGISTRO NÃO TEM MAIS VISOR (v5.207): a caixa `<pre>` gastava 240px de
  // espaço sempre visível em Configurações para exibir, em fonte de 0,68rem, um
  // log cujo consumidor é um humano A DISTÂNCIA — ele é copiado, não lido aqui.
  // Então o que se afirma passou a ser o que de fato importa: **o texto existe
  // e é o que o botão entrega**.
  const temRegistro = await pg.evaluate(() => typeof diagTexto === 'string' && diagTexto.length > 0);
  checar(temRegistro, 'o Registro é montado (o texto que o botão copia existe)');

  checar(await pg.$('#diagBox') === null,
    'e não há mais visor ocupando espaço sempre visível na folha');

  // E A FOLHA CABE NA TELA. Era esta a queixa do operador — as linhas que ele de
  // fato ajusta (tema, preenchimento, wallpaper) ficavam abaixo da dobra por
  // causa da caixa de log. Medir a rolagem é medir a queixa.
  const precisaRolar = await pg.$eval('#fadePopup .popup-sheet',
    (el) => el.scrollHeight > el.clientHeight + 1);
  checar(!precisaRolar, 'Configurações cabe sem rolar');

  // O QUE A v5.121 QUEBROU: o clique chamava uma função apagada. Um handler que
  // estoura não muda nada na tela — daí conferir o efeito (o pulso de
  // confirmação), e não só a ausência de erro.
  await pg.evaluate(() => document.getElementById('diagCopy').click());
  await pg.waitForTimeout(300);
  const pulsou = await pg.$eval('#diagCopy', (el) => el.classList.contains('btn-pulso'));
  checar(pulsou, 'o botão de copiar o Registro responde ao toque');

  // ==========================================================================
  // NÃO EXISTE ALERTA FLUTUANTE (v5.207) — e este é o oráculo da regra.
  //
  // O app já removeu um toast uma vez, e no lugar dele nasceu `avisar()`, cujo
  // próprio comentário afirmava "não flutua". O CSS dizia `position: fixed;
  // top: .5rem; z-index: 400`: era um toast com outro nome, e 35 pontos do app
  // respondiam por ele — sempre no topo da tela, para toques dados no rodapé,
  // no meio de uma lista ou dentro de uma folha aberta.
  //
  // Sem um teste, a terceira encarnação nasce na primeira vez que alguém
  // precisar responder a uma ação e não achar onde. A régua aqui é estrutural,
  // não de nome: **nenhum elemento fixo por cima da interface que não seja uma
  // folha/cortina/diálogo** — porque o próximo toast pode se chamar qualquer
  // coisa.
  // ==========================================================================
  await pg.evaluate(() => document.getElementById('fadePopupClose').click());
  await pg.waitForTimeout(250);

  checar(await pg.evaluate(() => typeof avisar === 'undefined'),
    'a função da faixa flutuante não existe mais');
  checar(await pg.$('#saveHint') === null, 'e nem o elemento dela');

  const flutuantes = await pg.evaluate(() => {
    // Os fixos LEGÍTIMOS: as folhas e o diálogo (que tomam o foco e pedem um
    // toque), a cortina do Modo Fácil, o próprio modo, e a barra de baixo.
    // O DIÁLOGO DO APP entra na lista: ele não é uma faixa que passa — toma o
    // foco, escurece o resto e exige um toque. É o canal do único caso sem
    // interface de origem (um compartilhamento que chega de fora e falha
    // inteiro); ver `registrarShareNativo`.
    const OK = ['popup-backdrop', 'popup-sheet', 'simple', 'simple-veil', 'bottombar',
      'appDialog', 'dialog-card', 'tab-ghost', 'selbar'];
    const achados = [];
    document.querySelectorAll('body *').forEach((el) => {
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed') return;
      const z = parseInt(cs.zIndex, 10) || 0;
      if (z < 100) return;                       // não disputa com o conteúdo
      const cls = el.className.toString();
      if (OK.some((k) => cls.includes(k) || (el.id || '').includes(k))) return;
      achados.push((el.id || cls || el.tagName).slice(0, 40));
    });
    return achados;
  });
  checar(flutuantes.length === 0,
    'nenhuma camada flutuante sobrou por cima da interface' + (flutuantes.length ? ' (achei: ' + flutuantes.join(', ') + ')' : ''));

// ── NENHUM CONTORNO, MEDIDO NO RENDERIZADO (v5.267) ──────────────────────
// A metade que faltava, e ela é a que o operador encontrou primeiro: *"os
// botões agora estão usando o sistema de sombras nativo padrão do sistema, isso
// está criando um contorno bicolor no geral nos botões que foi removido as
// linha de borda"*.
//
// `tools/tokens.test.mjs` varre a FONTE e prova que nenhuma regra NOSSA desenha
// contorno. Isso não basta, e o primeiro corte da v5.267 provou por quê: **o
// padrão do navegador não é "sem borda"**. A folha do UA dá a todo `<button>`
// um `border: 2px outset` e a todo campo um `2px inset` — e `outset` é um
// bisel, isto é, DUAS cores. Tirar a nossa declaração não removia borda
// nenhuma; deixava passar a dele. Um oráculo de fonte é estruturalmente cego
// para isso, porque o defeito é a AUSÊNCIA de uma declaração.
//
// A varredura é do computado, sobre as telas que o arquivo já abriu, e conta
// só o que DESENHA: largura > 0 com cor não transparente. Os dois desenhos de
// borda do app são pseudo-elementos (`.dl-ring::before`, o ✓ do seletor), e
// `querySelectorAll` não os alcança — eles ficam de fora sem precisar de
// exceção.
try {
  const contornos = await pg.evaluate(async () => {
    const achados = new Set();
    const varrer = () => {
      for (const el of document.querySelectorAll('*')) {
        const c = getComputedStyle(el);
        const w = ['Top', 'Right', 'Bottom', 'Left'].map((s) => parseFloat(c['border' + s + 'Width']) || 0);
        if (!w.some((x) => x > 0)) continue;
        if (/rgba\(0, 0, 0, 0\)/.test(c.borderTopColor)) continue;
        achados.add((el.tagName.toLowerCase() + '.' + [...el.classList].join('.')).slice(0, 48)
          + ' → ' + w[0] + 'px ' + c.borderTopStyle);
      }
    };
    // As telas em que moram os controles — é aqui que a cobertura mora, e é por
    // isso que o caso ABRE cada uma em vez de medir só a inicial: os botões que
    // o operador viu (transporte, mixer) e os que só existem numa aba
    // (segmentados, chips, campos das Ferramentas) nunca estão na mesma tela.
    setAppMode('full'); varrer();
    for (const aba of ['bible', 'misc', 'playlist']) {
      try { switchTab(aba); } catch (e) { /* aba que não existe neste bundle */ }
      await new Promise((r) => setTimeout(r, 60));
      varrer();
    }
    openHymnSearch(); await new Promise((r) => setTimeout(r, 200)); varrer();
    closeHymnSearch(); await new Promise((r) => setTimeout(r, 100));
    openFadePopup(); await new Promise((r) => setTimeout(r, 150)); varrer();
    setAppMode('simple'); await new Promise((r) => setTimeout(r, 100)); varrer();
    setAppMode('full');
    return [...achados];
  });
  checar(contornos.length === 0,
    'e nenhum elemento RENDERIZADO desenha borda — nem a que o navegador põe '
    + 'sozinha em todo <button>',
    contornos.join('\n        '));
} catch (e) {
  checar(false, 'a varredura de contorno terminou sem exceção (' + (e && e.message) + ')');
}

  // E O CONTRÁRIO — os canais in-place existem. Sem esta metade, apagar o
  // feedback inteiro passaria no teste acima.
  const canais = await pg.evaluate(() => ({
    linha: typeof notaNoItem === 'function',
    botao: typeof pulsar === 'function',
    pasta: typeof statusPasta === 'function',
    // `falarNoOta` desde a v5.245: o rótulo de versão deixou de ser o alvo
    // (ele voltou a ser só um indicador) e quem responde é o botão de
    // atualização, no mesmo rodapé. O canal continua sendo o mesmo idioma —
    // a resposta nasce onde o toque nasceu.
    ota: typeof falarNoOta === 'function',
  }));
  checar(canais.linha && canais.botao && canais.pasta && canais.ota,
    'e os canais que responderam no lugar dela estão de pé (linha, botão, pasta, botão de atualização)');

  const copiado = await pg.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  checar(copiado.includes('Linha do tempo'), 'e o texto do Registro foi para a área de transferência');

  // ---- O EMPILHAMENTO DOS POPUPS ANINHADOS -------------------------------
  //
  // Um popup que abre DE DENTRO de outro precisa de um degrau próprio de
  // z-index: com o mesmo valor, quem decide é a ordem do documento, e esse
  // acaso já cobriu um popup por inteiro mais de uma vez neste arquivo. O
  // sintoma nunca é "está por baixo" — é "o toque não faz nada", ou, no caso
  // do leitor de QR, uma câmera acesa e imagem nenhuma na tela.
  //
  // O `controle.css` pedia atenção num comentário, e o comentário não bastou:
  // o leitor de QR nasceu no 200 padrão, um degrau ABAIXO da folha do espelho
  // que o abre. Por isso a regra virou asserção — ela custa três linhas e
  // pega uma classe inteira de defeito que só aparece em aparelho.
  const ANINHADOS = [
    // (Nenhum par hoje. O `songMenuPopup`/`folderPopup` saiu na v5.254 com o
    // seletor de pastas; o `castPopup`/`mirrorPopup` na v5.196, com a folha de
    // "Ajustes avançados"; o `mirrorPopup`/`qrPopup` na v5.185, com o leitor de
    // QR. A lista fica VAZIA de propósito: o próximo popup que abrir de dentro
    // de outro entra aqui numa linha, e é essa linha que impede o defeito de
    // voltar.)
  ];
  // (A regra
  // continua valendo para todo popup aninhado que existir — foi ela que pegou o
  // leitor nascendo um degrau ABAIXO da folha que o abria, com o sintoma sendo
  // uma câmera acesa e imagem nenhuma.)
  const z = await pg.evaluate((pares) => pares.map(([pai, filho]) => {
    const v = (id) => {
      const e = document.getElementById(id);
      return e ? parseInt(getComputedStyle(e).zIndex, 10) || 0 : NaN;
    };
    return { pai, filho, zPai: v(pai), zFilho: v(filho) };
  }), ANINHADOS);
  z.forEach((p) => {
    checar(p.zFilho > p.zPai,
      'o popup `' + p.filho + '` fica ACIMA do `' + p.pai + '`, de onde ele abre'
      + ' (' + p.zFilho + ' > ' + p.zPai + ')');
  });

  // Um `#rrggbb` de token vira o `rgb(...)` que o `getComputedStyle` devolve —
  // as asserções comparam o RENDERIZADO com o token resolvido, nunca com um
  // literal copiado para cá. (Ele mora acima dos dois blocos que o usam: era
  // declarado no segundo, e o primeiro passou a precisar dele na v5.224.)
  const paraRgb = (hex) => {
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    return m ? 'rgb(' + parseInt(m[1], 16) + ', ' + parseInt(m[2], 16) + ', ' + parseInt(m[3], 16) + ')' : hex;
  };

  // ---- A SEÇÃO DE CONEXÃO SEGUE O PADRÃO DO APP (v5.175) -----------------
  //
  // O `tools/tokens.test.mjs` prova que nenhum `var(--x)` aponta para um token
  // inexistente; este prova o efeito RENDERIZADO, que é o que o operador vê.
  // Os dois botões da folha "Conectar uma tela" pediam `var(--radius-md)` — um
  // token que nunca existiu —, e um `var()` inválido sem fallback computa para
  // o valor INICIAL da propriedade: eram os únicos cantos retos de um app
  // inteiro arredondado, na primeira tela do recurso mais novo.
  const padrao = await pg.evaluate(() => {
    const cast = document.getElementById('castPopup');
    if (cast) cast.classList.add('open');
    const raio = (sel) => {
      const el = document.querySelector(sel);
      return el ? parseFloat(getComputedStyle(el).borderTopLeftRadius) : NaN;
    };
    const cor = (sel, prop) => {
      const el = document.querySelector(sel);
      return el ? getComputedStyle(el)[prop] : '';
    };
    // AS DUAS FORMAS DE CONECTAR SÃO BOTÕES IRMÃOS (v5.226) — a segunda era um
    // interruptor. O que se mede aqui é que elas são a MESMA peça desligadas
    // (mesmo raio, mesmo preenchimento) e peças DIFERENTES ligadas, porque o
    // estado é a única coisa que as separa.
    const net = document.getElementById('castNetBtn');
    const fundoNet = () => getComputedStyle(net).backgroundColor;
    const netOff = net ? fundoNet() : '';
    if (net) net.classList.add('ligado');
    const netOn = net ? fundoNet() : '';
    if (net) net.classList.remove('ligado');
    const r = {
      acao: raio('.cast-acao'), interruptor: raio('#castNetBtn'), endereco: raio('.cast-addr'),
      netOff, netOn,
      liveFill: getComputedStyle(document.documentElement).getPropertyValue('--live-fill').trim(),
      acaoFundo: cor('.cast-acao', 'backgroundColor'), acaoTexto: cor('.cast-acao', 'color'),
      // O valor do token, resolvido pelo navegador — a asserção compara o
      // RENDERIZADO com ele, e não com um literal copiado para cá.
      accentFill: getComputedStyle(document.documentElement).getPropertyValue('--accent-fill').trim(),
      onAccent: getComputedStyle(document.documentElement).getPropertyValue('--on-accent').trim(),
    };
    if (cast) cast.classList.remove('open');
    return r;
  });
  checar(padrao.acao > 0 && padrao.interruptor > 0,
    'os dois botões da folha de conectar são arredondados como o resto do app'
    + ' (' + padrao.acao + 'px / ' + padrao.interruptor + 'px)');
  checar(padrao.acao === padrao.interruptor && padrao.netOff === padrao.acaoFundo,
    'e DESLIGADOS eles são a mesma peça — mesmo raio, mesmo preenchimento',
    padrao.netOff + ' × ' + padrao.acaoFundo);
  // v5.267: o contorno vermelho virou PREENCHIMENTO vermelho. O que a asserção
  // afirma não mudou de sentido — ligada, a peça troca de cor e passa a vestir a
  // família do "está no ar" —, e continua sendo lida do token, não de um literal.
  checar(padrao.netOn !== padrao.netOff && padrao.netOn === paraRgb(padrao.liveFill),
    'LIGADA, a transmissão troca o preenchimento pelo VERMELHO de "no ar"'
    + ' (' + padrao.netOn + ')');

  // ---- E A FOLHA CRESCE EM VEZ DE SALTAR (v5.226) ------------------------
  //
  // O bloco do endereço aparece e some com a transmissão. Medido aqui pelo que
  // decide o salto: a ALTURA do bloco com e sem a classe que o abre. Recolhido
  // ele tem de valer zero — se um dia alguém trocar o `grid-template-rows` por
  // um `display: none`, o número continua zero mas a transição morre, e é por
  // isso que a segunda metade da asserção pergunta pela propriedade.
  const cresce = await pg.evaluate(async () => {
    const cast = document.getElementById('castPopup');
    cast.classList.add('open');
    const bloco = document.getElementById('castLive');
    bloco.classList.remove('aberto');
    const fechado = bloco.getBoundingClientRect().height;
    bloco.classList.add('aberto');
    // A ESPERA É A PRÓPRIA AFIRMAÇÃO: medir no mesmo turno devolveria zero
    // justamente PORQUE a altura é animada (a transição começa em 0fr). O
    // primeiro rascunho deste caso reprovou por isso, e a leitura certa é que
    // ele estava medindo o quadro inicial de uma animação que existe.
    await new Promise((r) => setTimeout(r, 420));
    const aberto = bloco.getBoundingClientRect().height;
    bloco.classList.remove('aberto');
    cast.classList.remove('open');
    return { fechado, aberto, transicao: getComputedStyle(bloco).transitionProperty };
  });
  checar(cresce.fechado < 1 && cresce.aberto > 20,
    'o bloco do endereço vale ZERO recolhido e tem altura aberto ('
    + cresce.fechado.toFixed(1) + 'px → ' + cresce.aberto.toFixed(1) + 'px)');
  checar(/grid-template-rows/.test(cresce.transicao),
    'e o que muda entre os dois é uma propriedade ANIMÁVEL — a folha cresce, não salta',
    cresce.transicao);
  checar(padrao.endereco > 0,
    'e o bloco do endereço também (raio ' + padrao.endereco + 'px)');

  // ---- E O ÂMBAR É O DA PALETA, NO PAPEL CERTO (v5.184) -----------------
  //
  // `--accent` e `--accent-fill` têm valores diferentes de propósito: o
  // primeiro é claro (para ser TEXTO sobre fundo escuro) e o segundo é escuro
  // (para RECEBER texto). Trocá-los não quebra nada de forma visível no CI —
  // sai um botão âmbar-claro com texto quase branco por cima, abaixo do piso
  // de contraste, e só um par de olhos no aparelho notaria. Daí a asserção.
  checar(padrao.acaoFundo === paraRgb(padrao.accentFill)
    && padrao.acaoTexto === paraRgb(padrao.onAccent),
    'o botão principal da folha é preenchido em --accent-fill com --on-accent por cima'
    + ' (' + padrao.acaoFundo + ' / ' + padrao.acaoTexto + ')');

  // ---- O ÍCONE DE CONECTAR DIZ "HÁ TELA RECEBENDO" (v5.176) --------------
  //
  // Ele tomou o lugar do cartão do espelho na barra de notificações — aquele
  // não pode ser removido (um serviço em primeiro plano é obrigado a ter uma
  // notificação, e é ele que mantém o espelho no ar com o app minimizado), mas
  // foi para `IMPORTANCE_MIN` e saiu da barra de status. Se o ícone não
  // acender, o operador fica sem NENHUM sinal de que há telas na rede — a troca
  // teria piorado o que veio consertar.
  //
  // Mesma classe do telão (`.connected`), de propósito: uma convenção só para
  // um fato só.
  const cast = await pg.evaluate(() => {
    const btn = document.getElementById('pvCastBtn');
    if (!btn) return { achou: false };
    const antes = mirrorEstado;
    const ler = () => { renderCastBtn(); return btn.classList.contains('connected'); };
    mirrorEstado = null;
    const desligado = ler();
    mirrorEstado = { ligado: true, telas: [] };
    const semTela = ler();
    mirrorEstado = { ligado: true, telas: [{ rotulo: 'A' }, { rotulo: 'B' }] };
    const comTelas = ler();
    const dica = btn.title;
    mirrorEstado = antes;
    renderCastBtn();
    return { achou: true, desligado, semTela, comTelas, dica };
  });
  checar(cast.achou, 'o ícone de conectar existe na preview');
  checar(cast.achou && !cast.desligado,
    'com o espelho desligado ele fica apagado');
  checar(cast.achou && !cast.semTela,
    'ligado e sem ninguém recebendo, também — "no ar" é ter alguém do outro lado');
  checar(cast.achou && cast.comTelas,
    'e com telas da rede recebendo ele acende, como acende com um telão');
  checar(cast.achou && /rede/i.test(cast.dica || ''),
    'e a dica do botão diz quantas são', cast.dica);

  // ---- O ECO DO TRANSPORTE (v5.162) --------------------------------------
  //
  // Quando a projeção são as telas da rede, a resposta de verdade de um botão
  // do transporte está a ~1 s de distância — e um botão que fica um segundo sem
  // responder é lido como botão que não funcionou: o operador toca de novo, e o
  // comando vai duas vezes. O eco é o "recebi" imediato.
  //
  // O caso trava as duas metades da decisão. A primeira é que ele APAREÇA; a
  // segunda, e é a que se perde numa refatoração, é que ele NÃO troque o
  // conteúdo do botão — o `.btn-pulso`, que é o outro sinal do app, esconde o
  // filho para pôr um ✓ no lugar, e fazer isso com o ▶ apagaria justamente o
  // ícone que carrega o estado do transporte.
  const eco = await pg.evaluate(async () => {
    const b = document.getElementById('playpause');
    if (!b) return { achou: false };
    b.click();
    const glifo = b.querySelector('.msym');
    const visivel = glifo ? getComputedStyle(glifo).visibility : 'sem glifo';
    const tem = b.classList.contains('btn-eco');
    // v5.267: o anel virou `box-shadow` — a folha não tem mais uma única
    // declaração de contorno, e ele era a última que sobrava fora de um desenho.
    // O que se mede continua sendo "há um anel desenhado", não como ele é feito.
    const anel = tem ? getComputedStyle(b, '::before').boxShadow : '';
    await new Promise((r) => setTimeout(r, 700));
    return { achou: true, tem, visivel, anel, sumiu: !b.classList.contains('btn-eco') };
  });
  checar(eco.achou && eco.tem, 'um toque no transporte responde na hora (classe `btn-eco`)');
  checar(eco.visivel === 'visible',
    'e o eco NÃO esconde o ícone do botão — ele é anel, não ✓', eco.visivel);
  checar(!!eco.anel && eco.anel !== 'none', 'o anel do eco é de fato desenhado', eco.anel);
  checar(eco.sumiu, 'e ele sai sozinho, sem deixar o botão marcado');

  // ---- O CARROSSEL VALE DENTRO DA NAVEGAÇÃO INTERNA (v5.193) ------------
  //
  // Quarta correção do mesmo mecanismo, e as três anteriores mantinham à mão a
  // lista do que o eixo horizontal não podia atravessar. A guarda mais larga
  // era "qualquer sub-tela" (botão voltar visível): com um capítulo da Bíblia
  // aberto — o estado normal de quem usa a Bíblia num culto — o gesto morria
  // calado, e NADA ali disputa o eixo horizontal (`.bible-half` rola só na
  // vertical, e a própria folha declara `touch-action: pan-y`).
  //
  // O teste é o COMPORTAMENTO, com toque de verdade (CDP): um deslize sobre o
  // conteúdo de uma sub-tela tem de trocar de aba, e um deslize sobre um
  // trilho que ROLA de verdade na horizontal não pode. As duas metades
  // importam — sem a segunda, "libera tudo" passaria no teste.
  const cdp = await ctx.newCDPSession(pg);
  const deslizar = async (x0, y0, dx) => {
    const p = (x, y) => [{ x, y, radiusX: 6, radiusY: 6, force: 1, id: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: p(x0, y0) });
    for (let i = 1; i <= 6; i++) {
      await cdp.send('Input.dispatchTouchEvent',
        { type: 'touchMove', touchPoints: p(x0 + (dx * i) / 6, y0) });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await pg.waitForTimeout(120);
  };

  // O CENÁRIO É MONTADO À MÃO, e de propósito: o runner do CI não tem rede,
  // então não há livro da Bíblia para abrir nem sorteio com histórico. O que
  // mudou na v5.193 é a REGRA — "quem é dono do eixo horizontal?" —, e ela se
  // exercita com um botão voltar visível (o que caracteriza uma sub-tela) e um
  // trilho que de fato rola. Testar a regra é testar o que quebrou.
  const cenario = await pg.evaluate(() => {
    // O MODO AVANÇADO PRIMEIRO: o app abre no Modo Fácil, e ali o `<main>` está
    // atrás da tela simplificada — sem esta linha o gesto cai no vazio e o
    // teste "passa" por não medir nada.
    setAppMode('full');
    // E A FOLHA DE CONFIGURAÇÕES SAI DA FRENTE: ela foi aberta lá em cima e
    // ninguém a fechou. Com ela no ar o toque pousa no popup, o `<main>` nem
    // vê o gesto, e o caso falha por um motivo que não é o que ele mede.
    closeFadePopup();
    switchTab('imports');
    // Sub-tela: era ESTA condição, sozinha, que matava o gesto no conteúdo.
    document.getElementById('backBtn').hidden = false;
    const m = document.querySelector('main');
    const r = m.getBoundingClientRect();
    return { aba: activeTab, x: r.x + r.width / 2, y: r.y + Math.min(r.height / 2, 160) };
  });
  await deslizar(cenario.x + 90, cenario.y, -160);
  const depoisDoDeslize = await pg.evaluate(() => activeTab);
  checar(depoisDoDeslize !== cenario.aba,
    'com uma sub-tela aberta (voltar visível), deslizar no conteúdo TROCA de aba'
    + ' (' + cenario.aba + ' → ' + depoisDoDeslize + ')');

  // E o outro lado, que é o que impede a correção de virar "libera tudo": um
  // elemento que ROLA de verdade na horizontal fica com o gesto.
  const trilho = await pg.evaluate(() => {
    const m = document.querySelector('main');
    const t = document.createElement('div');
    t.id = 'trilhoDeTeste';
    t.style.cssText = 'overflow-x:auto;display:flex;white-space:nowrap;height:80px';
    t.innerHTML = '<div style="min-width:3000px;height:60px"></div>';
    m.insertBefore(t, m.firstChild);
    const r = t.getBoundingClientRect();
    return {
      rola: t.scrollWidth > t.clientWidth + 1,
      x: r.x + r.width / 2, y: r.y + r.height / 2, aba: activeTab,
    };
  });
  checar(trilho.rola, 'o trilho do contra-teste de fato rola na horizontal');
  await deslizar(trilho.x + 60, trilho.y, -160);
  const depoisDoTrilho = await pg.evaluate(() => {
    const t = document.getElementById('trilhoDeTeste');
    const a = activeTab;
    if (t) t.remove();
    document.getElementById('backBtn').hidden = true;
    return a;
  });
  checar(depoisDoTrilho === trilho.aba,
    'e um elemento que ROLA na horizontal fica com o gesto (' + depoisDoTrilho + ')');

  // ---- OS DOIS TEMAS, E O PALCO QUE NÃO SEGUE NENHUM (v5.192) ------------
  //
  // O tema claro é um DELTA sobre o escuro (`:root[data-tema="claro"]` em
  // tokens.css). Três coisas podem quebrar nessa montagem sem que nada
  // reclame, e as três estão travadas aqui:
  //
  // 1. **O PALCO seguir o tema.** `--stage-*`, `--wallpaper` e
  //    `--lyrics-frame-bg` moram num bloco à parte de propósito: o Display não
  //    tem tema (ele nunca escreve o atributo), mas a PREVIEW do Controle roda
  //    no documento que TEM — e ela existe para espelhar o telão. Bastaria
  //    alguém redeclarar `--stage-bg` dentro do bloco claro para a preview
  //    parar de mostrar o que a TV mostra, e nenhum outro teste veria isso.
  // 2. **A superfície não INVERTER dentro do cartão.** A regra ("flutua sobre
  //    a página, afunda dentro do cartão") virou token na v5.192 justamente
  //    para poder mudar de tema; escrita errada, o tema claro herdaria o
  //    recesso de 24% de preto do escuro e todo cartão viraria um bloco cinza.
  // 3. **A escolha não sobreviver à recarga.** Ela é lida do `localStorage`
  //    ANTES do primeiro quadro (mesma razão do modo do app); um erro aí
  //    aparece como um flash escuro a cada abertura, que é exatamente o tipo
  //    de coisa que ninguém reporta e todo mundo aguenta.
  const tema = await pg.evaluate(() => {
    const raiz = document.documentElement;
    const meta = document.getElementById('temaMeta');
    const ler = () => {
      const s = getComputedStyle(raiz);
      const v = (t) => s.getPropertyValue(t).trim();
      // Um cartão de verdade, para ver a superfície AFUNDADA em vigor.
      const cartao = document.querySelector('.fade-row');
      const sc = cartao ? getComputedStyle(cartao) : null;
      // E O PALCO PINTADO, não só os tokens dele (v5.218).
      //
      // A versão anterior comparava QUATRO NOMES de token, e o defeito passou
      // por baixo dela: os tokens do palco estavam certos, e as REGRAS do palco
      // apontavam para tokens de TEMA (`--brand`, `--live-strong`, `--bg`,
      // `--accent-glow`). No tema claro, o título do slide de capa da preview
      // era desenhado em denim escuro sobre o preto — 2,73:1, ilegível, e foi
      // assim que o operador o encontrou.
      //
      // Perguntar pela COR COMPUTADA de cada camada fecha a classe inteira: não
      // importa por qual token ela chegou, ela tem de ser a mesma nos dois
      // temas. As classes são as que o app de fato escreve (`cover`,
      // `mode-chrono chrono-over`, `mode-draw draw-rolling`) e são desfeitas na
      // mesma linha — o que se mede é a folha, não o estado da tela.
      const cor = (sel) => getComputedStyle(document.querySelector(sel)).color;
      const comClasse = (host, classes, sel) => {
        const h = document.querySelector(host);
        h.classList.add(...classes);
        const c = cor(sel);
        h.classList.remove(...classes);
        return c;
      };
      const palcoPintado = [
        comClasse('#pvLyricsContent', ['cover'], '#pvLyricsLine'),
        comClasse('#pvLyricsContent', ['cover'], '#pvLyricsNum'),
        comClasse('#pvLyricsContent', ['cover'], '#pvLyricsAux'),
        cor('#pvLyricsLine'), cor('#pvLyricsAux'),
        cor('#pvTextMain'), cor('#pvTextSub'),
        comClasse('#pvTextContent', ['mode-chrono', 'chrono-over'], '#pvTextMain'),
        comClasse('#pvTextContent', ['mode-draw', 'draw-rolling'], '#pvTextMain'),
        getComputedStyle(document.querySelector('.pv-lyrics-bg')).backgroundColor,
      ].join(' · ');
      return {
        bg: v('--bg'), texto: v('--text'), accent: v('--accent'), fill: v('--accent-fill'),
        palco: v('--stage-bg') + '|' + v('--stage-text') + '|' + v('--wallpaper')
          + '|' + v('--lyrics-frame-bg'),
        palcoPintado,
        superficie: v('--surface'),
        afundada: sc ? sc.getPropertyValue('--surface').trim() : '',
        barra: meta ? meta.getAttribute('content') : '',
      };
    };
    const escuro = ler();
    document.querySelector('#temaSeg .fit-opt[data-tema="claro"]').click();
    const claro = ler();
    return { escuro, claro, atributo: raiz.dataset.tema, guardado: localStorage.getItem('av.tema') };
  });
  checar(tema.escuro.bg !== tema.claro.bg && tema.escuro.texto !== tema.claro.texto,
    'trocar o tema troca fundo e texto (' + tema.escuro.bg + ' → ' + tema.claro.bg + ')');
  checar(tema.escuro.palco === tema.claro.palco,
    'e NÃO troca uma vírgula do palco — a preview continua espelhando o telão',
    tema.claro.palco);
  checar(tema.escuro.palcoPintado === tema.claro.palcoPintado,
    'nem uma vírgula do que o palco PINTA — nenhuma camada dele lê um token de tema',
    'escuro: ' + tema.escuro.palcoPintado + '\n        claro:  ' + tema.claro.palcoPintado);
  checar(tema.escuro.superficie !== tema.escuro.afundada
    && tema.claro.superficie !== tema.claro.afundada,
    'a superfície afunda dentro do cartão NOS DOIS temas'
    + ' (escuro ' + tema.escuro.superficie + ' → ' + tema.escuro.afundada
    + ' · claro ' + tema.claro.superficie + ' → ' + tema.claro.afundada + ')');
  checar(tema.escuro.accent !== tema.escuro.fill,
    'no escuro o accent de TEXTO e o de PREENCHIMENTO seguem diferentes'
    + ' (' + tema.escuro.accent + ' / ' + tema.escuro.fill + ')');
  checar(tema.escuro.barra !== tema.claro.barra && /^#[0-9a-f]{6}$/i.test(tema.claro.barra),
    'e o `theme-color` acompanha (' + tema.escuro.barra + ' → ' + tema.claro.barra + ')');
  checar(tema.atributo === 'claro' && tema.guardado === 'claro',
    'a escolha vai para o `localStorage`, de onde ela é lida antes do primeiro quadro');

  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => typeof window.__avBack === 'function', null, { timeout: 20000 });
  const depois = await pg.evaluate(() => ({
    atributo: document.documentElement.dataset.tema,
    bg: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
  }));
  checar(depois.atributo === 'claro' && depois.bg === tema.claro.bg,
    'e ela sobrevive à recarga da página (' + depois.atributo + ' · ' + depois.bg + ')');
} catch (e) {
  checar(false, 'o percurso terminou sem exceção (' + (e && e.message) + ')');
}

// ---------------------------------------------------------------------------
// O RESPIRO ENTRE ESTROFES — a leitura da letra, nos DOIS modos (v5.226)
//
// A estrutura de estrofes sempre esteve inteira (o banco entrega uma estrofe por
// entrada de `lyric`, e `lvBuildSong` desenha assim desde a v5.42) — mas o
// ESPAÇAMENTO estava invertido, e é ele que decide se a letra respira: 8,8 px
// (avançado) e 8,0 px (simples) entre estrofes DIFERENTES contra 11,4 px entre
// dois blocos da MESMA. Duas estrofes ficavam mais juntas que o miolo de uma, e
// a hierarquia se lia ao contrário.
//
// A asserção é a REGRA, não o número: uma fronteira de estrofe tem de valer o
// mesmo nos três lugares onde existe (entre slides, dentro de um slide, nos dois
// modos) e tem de ser pelo menos uma LINHA — que é literalmente o que a fonte
// codifica com `<br><br>`. Escrever o pixel aqui faria o oráculo reprovar numa
// mudança legítima de fonte; escrever a razão o mantém verdadeiro.
try {
  const gaps = await pg.evaluate(() => {
    const medir = (cls) => {
      const box = document.createElement('div');
      box.className = cls;
      box.style.cssText = 'position:fixed;left:0;top:0;width:380px;height:700px;';
      const mk = (blocos) => {
        const row = document.createElement('div');
        row.className = 'lv-row';
        for (const b of blocos) {
          const t = document.createElement('div');
          t.className = 'lv-text';
          t.textContent = b;
          row.appendChild(t);
        }
        return row;
      };
      const e1 = mk(['A1\nA2\nA3\nA4']);
      const e2 = mk(['B1\nB2', 'C1\nC2']);   // duas estrofes DENTRO de um slide
      box.appendChild(e1); box.appendChild(e2);
      document.body.appendChild(box);
      const d = e2.querySelectorAll('.lv-text');
      const out = {
        entre: e2.getBoundingClientRect().top - e1.getBoundingClientRect().bottom,
        dentro: d[1].getBoundingClientRect().top - d[0].getBoundingClientRect().bottom,
        linha: parseFloat(getComputedStyle(e1).lineHeight),
      };
      box.remove();
      return out;
    };
    return { avancado: medir('lyricsview-body'), simples: medir('simple-lyrics') };
  });
  for (const [modo, g] of Object.entries(gaps)) {
    const detalhe = ' (entre ' + g.entre.toFixed(1) + 'px · dentro ' + g.dentro.toFixed(1)
      + 'px · linha ' + g.linha.toFixed(1) + 'px)';
    checar(g.entre >= g.dentro - 0.5,
      'no modo ' + modo + ', duas estrofes não ficam mais juntas que o miolo de uma' + detalhe);
    checar(g.entre >= g.linha - 0.5,
      'e a fronteira entre elas vale ao menos uma LINHA — a que a fonte codifica' + detalhe);
  }
  checar(Math.abs(gaps.avancado.entre - gaps.simples.entre) < 0.5,
    'e o respiro é o MESMO nos dois modos — a mesma letra não muda de ritmo');
} catch (e) {
  checar(false, 'a medição do respiro entre estrofes terminou sem exceção (' + (e && e.message) + ')');
}

// ── O PROGRESSO DESENHADO NO BOTÃO DE CANCELAR (v5.232) ───────────────────
// FORMA, e por isso mora aqui: o `boot-nativo` mede o ESTADO (o painel tem uma
// linha só, com o resultado dentro do botão) e este mede o que a tela PINTA
// enquanto o download roda. Ele existe porque a barra do card, dois centímetros
// acima, já escreve "Baixando 2 de 4…" — repetir a frase aqui seria o defeito
// que a v5.73 tirou deste painel, então o que o botão acrescenta não pode ser
// texto. Um preenchimento invisível (a mesma tinta do fundo, ou atrás dele)
// seria a promessa sem a entrega, e é isso que a medição cobra.
try {
  const barra = await pg.evaluate(() => {
    const box = document.createElement('div');
    box.className = 'coll-opts coll-opts--inline';
    const linha = document.createElement('div'); linha.className = 'coll-opts-acoes';
    const b = document.createElement('button');
    b.className = 'new-folder-btn cancel';
    b.style.setProperty('--p', '40%');
    b.appendChild(document.createTextNode('Cancelar'));
    linha.appendChild(b); box.appendChild(linha); document.body.appendChild(box);
    const cs = getComputedStyle(b, '::before');
    const larg = b.getBoundingClientRect().width;
    const out = {
      largura: parseFloat(cs.width),
      caixa: larg,
      // Atrás do texto, nunca por cima: o rótulo é um NÓ DE TEXTO e não tem
      // como ser levantado, então quem desce é a barra.
      z: cs.zIndex,
      pinta: cs.backgroundColor,
      fundoBotao: getComputedStyle(b).backgroundColor,
    };
    box.remove();
    return out;
  });
  const prop = barra.caixa ? barra.largura / barra.caixa : 0;
  checar(Math.abs(prop - 0.4) < 0.05,
    'o botão de cancelar se preenche na PROPORÇÃO do download ('
    + Math.round(prop * 100) + '% para --p: 40%)');
  checar(barra.z === '-1',
    'e o preenchimento fica ATRÁS do rótulo — texto solto não recebe z-index', barra.z);
  checar(barra.pinta !== barra.fundoBotao && !/rgba\(0, 0, 0, 0\)/.test(barra.pinta),
    'e ele é VISÍVEL: a tinta do progresso não é a mesma do fundo do botão ('
    + barra.pinta + ' sobre ' + barra.fundoBotao + ')');
} catch (e) {
  checar(false, 'a medição do progresso no botão terminou sem exceção (' + (e && e.message) + ')');
}

// ── A ALTURA DA LINHA DE UMA FAIXA (v5.240) ──────────────────────────────
// Relato do operador: os cards da lista de um álbum estão "muito volumosos
// verticalmente, limitando o número de itens na visualização" e "ficando muito
// diferente do tamanho que já são títulos dos álbuns".
//
// Medido: a barra do álbum tinha 51,6 px e a linha de uma faixa DENTRO dele,
// 66 px — 28% mais alta que o cartão que a contém, com um passo de 71,6 px.
//
// O que este caso trava é a RAZÃO, não o pixel: escrever "51,6" faria ele
// reprovar numa mudança legítima de fonte, e a queixa nunca foi sobre um número
// — foi sobre a linha ser maior que o título. E a outra metade é o piso de
// toque: encolher até o texto trocaria densidade por erro de mira no meio de um
// culto, então o alvo do ▶ não pode cair abaixo de `--hit`.
try {
  const linha = await pg.evaluate(() => {
    setAppMode('full');
    const c = allCollections().find((x) => x.kind === 'hymnal');
    const songs = [];
    for (let i = 1; i <= 4; i++) {
      songs.push({ id_music: 'm' + i, name: 'Hino de exemplo número ' + i, track: i,
        has_instrumental_music: false, duration: '3:47' });
    }
    collState[c.id] = { indexSyncedAt: Date.now(), songs, isHymnal: true };
    gruposAbertos.add('Hinários'); gruposAbertos.add('Arquivos oficiais');
    ui(c.id).expanded = true; ui(c.id).shown = 100;
    // Uma lista PRÓPRIA e VISÍVEL, com a largura de um celular: dentro do popup
    // fechado toda medida é zero, e zeros comparados com zeros passam sem medir
    // nada (a lição da v5.208).
    const lista = document.createElement('ul');
    lista.className = 'hymnal-list';
    lista.style.width = '390px';
    document.body.appendChild(lista);
    renderCollectionsList(lista, () => {}, { semTotal: true });
    const bar = lista.querySelector('.coll-bar');
    const linhas = [...lista.querySelectorAll('.coll-songs > .hymn-result')];
    const alt = (el) => (el ? el.getBoundingClientRect().height : 0);
    const piso = parseFloat(getComputedStyle(document.documentElement)
      .getPropertyValue('--hit')) || 34;
    const r = {
      barra: alt(bar),
      item: alt(linhas[0]),
      toque: alt(linhas[0] && linhas[0].querySelector('.hymn-play-thumb')),
      piso,
      // O passo entre duas linhas é o que decide quantas cabem na tela.
      passo: linhas.length > 1
        ? linhas[1].getBoundingClientRect().top - linhas[0].getBoundingClientRect().top : 0,
      // E a fonte: o item não pode ser desenhado maior que o título que o contém.
      fonteItem: parseFloat(getComputedStyle(linhas[0].querySelector('.hymn-name')).fontSize),
      fonteAlbum: parseFloat(getComputedStyle(bar.querySelector('.coll-bar-name')).fontSize),
      // A ESCALA INTEIRA (v5.262). Os três níveis e os dois subtítulos, medidos
      // no mesmo desenho — é a única forma de afirmar uma RELAÇÃO em vez de
      // cinco números soltos, cada um verdadeiro sozinho.
      fonteSecao: parseFloat(getComputedStyle(
        lista.querySelector('.coll-group-name') || document.body).fontSize),
      // Os dois SUBTÍTULOS por um elemento de prova, e não pelo desenho: eles só
      // existem quando há metadado, e um fixture sem subtítulo devolveria o
      // tamanho herdado do `<body>` — 16px nos dois, isto é, uma igualdade que
      // passa sem medir nada (a lição da v5.208).
      subAlbum: (() => {
        const e = document.createElement('span'); e.className = 'coll-bar-sub';
        document.body.appendChild(e);
        const v = parseFloat(getComputedStyle(e).fontSize); e.remove(); return v;
      })(),
      subItem: (() => {
        const e = document.createElement('span'); e.className = 'hymn-sub';
        document.body.appendChild(e);
        const v = parseFloat(getComputedStyle(e).fontSize); e.remove(); return v;
      })(),
    };
    lista.remove();
    delete collState[c.id];
    gruposAbertos.clear();
    return r;
  });
  checar(linha.item > 0 && linha.item <= linha.barra * 1.05,
    'a linha de uma faixa não é mais alta que a barra do álbum que a contém ('
    + Math.round(linha.item) + 'px contra ' + Math.round(linha.barra) + 'px)');
  checar(linha.passo > 0 && linha.passo < 60,
    'e o passo entre faixas cabe numa lista densa — ' + Math.floor(900 / linha.passo)
    + ' itens numa tela de 900px (eram 12)');
  checar(linha.toque >= linha.piso,
    'sem furar o piso de toque do app: o ▶ tem ' + Math.round(linha.toque)
    + 'px, e o piso é ' + linha.piso + 'px');
  // ── A ESCALA DE TÍTULOS (v5.262) ────────────────────────────────────────
  // Relato do operador: *"há uma desproporção, onde o título das coleções está
  // pequeno, o dos álbuns maior e o dos items diferente… o texto dos itens
  // precisa dar uma leve reduzida."*
  //
  // O que se afirma são RELAÇÕES, e cada uma responde a um pedaço da frase.
  // Números soltos aqui reprovariam numa mudança legítima de fonte e, pior,
  // seriam verdadeiros um a um enquanto a escala continuasse sem sistema — que
  // era exatamente o estado anterior (11,84 · 15,2 · 15,2).
  checar(linha.fonteItem < linha.fonteAlbum,
    'o nome da faixa é MENOR que o título do álbum que a contém — eles EMPATAVAM,'
    + ' e é o empate que fazia o item não ler nível nenhum ('
    + linha.fonteItem + 'px contra ' + linha.fonteAlbum + 'px)');
  checar(linha.fonteAlbum < 15,
    'e o teto da escala caiu: nada na Biblioteca é desenhado nos 15,2px de antes,'
    + ' que era o que cortava (' + linha.fonteAlbum + 'px)');
  // ESTRITAMENTE decrescente para dentro (v5.263, "pode deixar maior o tamanho
  // dos títulos das coleções"): a v5.262 se contentou com "a seção chega perto
  // do álbum", e perto não é uma escala. Agora os três degraus são ordenados, e
  // o mais externo é o maior — que é a única leitura que uma árvore oferece de
  // graça.
  checar(linha.fonteSecao > linha.fonteAlbum,
    'e a seção é o MAIOR dos três: a escala decresce para dentro, do mais externo'
    + ' ao mais interno (' + linha.fonteSecao + ' > ' + linha.fonteAlbum + ' > '
    + linha.fonteItem + 'px)');
  checar(linha.subAlbum === linha.subItem,
    'e "subtítulo da Biblioteca" é UM valor: o do card e o da faixa deixaram de '
    + 'diferir por meio ponto (' + linha.subItem + 'px)');
} catch (e) {
  checar(false, 'a medição da linha da faixa terminou sem exceção (' + (e && e.message) + ')');
}

// ── A ESCADA DE CAMADAS DA BIBLIOTECA (v5.241, refeita na v5.267) ────────
// Relato do operador na v5.241: *"todo o esquema de cores e design está
// inconsistente"*. Medido no escuro, do fundo para dentro: folha 44 → barra de
// seção FECHADA ~69 → a mesma barra ABERTA 44 → card do álbum 59 → faixa 44.
// Subia, descia, subia e descia, em cinco níveis aninhados.
//
// A v5.241 respondeu com DOIS tons alternados, e a v5.267 revoga essa metade
// porque o operador voltou com o mesmo sintoma por outra porta: *"elas funcionam
// em camadas de ramificações que visualmente se parecem muito, dificultando
// discernir se estou em uma camada ou subcamada"*. Alternar dois tons faz um
// AVÔ e um NETO terem a mesma cor — e era literalmente o caso, porque a barra
// da seção e o card do álbum dividiam o `--panel-2` "de contêiner" enquanto o
// corpo da seção ficava com a cor da FOLHA. O card pousava no mesmo fundo em que
// a barra da seção pousa, isto é, lia-se como irmão dela.
//
// A regra nova é uma ESCADA de três degraus, e é ela que este caso trava, nos
// DOIS TEMAS (a causa raiz da v5.241 era justamente uma direção que se invertia
// entre eles):
//
//   folha (tela cheia) → seção → card do álbum, cada um distinto do anterior;
//   a direção é a MESMA nos três degraus (sobe no escuro, desce no claro);
//   a seção não troca de cor com o estado;
//   a faixa dentro do álbum não tem caixa nem filete — o que a separa da vizinha
//   é o espaço, com o tom do álbum aparecendo no meio.
for (const tema of ['escuro', 'claro']) {
  try {
    const t = await pg.evaluate(async (tema) => {
      document.documentElement.setAttribute('data-tema', tema);
      setAppMode('full');
      const c = allCollections().find((x) => x.kind === 'hymnal');
      const songs = [];
      for (let i = 1; i <= 3; i++) {
        songs.push({ id_music: 'n' + i, name: 'Hino ' + i, track: i,
          has_instrumental_music: false, duration: '3:47' });
      }
      collState[c.id] = { indexSyncedAt: Date.now(), songs, isHymnal: true };
      gruposAbertos.clear(); gruposAbertos.add('Hinários'); gruposAbertos.add('Arquivos oficiais');
      ui(c.id).expanded = true; ui(c.id).shown = 100;
      // A LISTA PRECISA MORAR NA FOLHA DE VERDADE (v5.267): o tom de cada nível
      // é herdado do contêiner (`--camada`), então medir a árvore num `<ul>`
      // solto no `<body>` mediria uma árvore que não existe no app.
      const folha = document.querySelector('#hymnSearchPopup .popup-sheet--full');
      const lista = document.createElement('ul');
      lista.className = 'popup-list';
      lista.style.width = '390px';
      folha.appendChild(lista);
      renderCollectionsList(lista, () => {}, { semTotal: true });
      const bg = (sel) => {
        const el = lista.querySelector(sel);
        return el ? getComputedStyle(el).backgroundColor : 'AUSENTE';
      };
      // A barra FECHADA precisa de um segundo grupo, que este não abriu.
      const fechada = (() => {
        const g = [...lista.querySelectorAll('.coll-group--drop:not(.aberto)')];
        return g.length ? getComputedStyle(g[0]).backgroundColor : null;
      })();
      const faixa = lista.querySelector('.coll-songs > .hymn-result');
      const r = {
        folha: getComputedStyle(folha).backgroundColor,
        secao: bg('.coll-group--drop.aberto'),
        secaoFechada: fechada,
        // A barra e o corpo são faixas do bloco da seção, sem fundo próprio.
        barra: bg('.coll-group--drop.aberto > .coll-group-bar'),
        corpo: bg('.coll-group--drop.aberto > .coll-group-corpo'),
        card: bg('.hymnal-card'),
        faixa: faixa ? getComputedStyle(faixa).backgroundColor : 'AUSENTE',
        faixaFilete: faixa ? getComputedStyle(faixa).borderTopWidth : 'AUSENTE',
        // O espaço entre duas faixas — é ele que substitui o filete.
        faixaGap: (() => {
          const ul = lista.querySelector('.coll-songs');
          return ul ? parseFloat(getComputedStyle(ul).rowGap) : -1;
        })(),
      };
      lista.remove(); delete collState[c.id]; gruposAbertos.clear();
      document.documentElement.setAttribute('data-tema', 'escuro');
      return r;
    }, tema);
    const transparente = (v) => /rgba\(0, 0, 0, 0\)/.test(v) || v === 'transparent';
    // Luminância relativa, para afirmar a DIREÇÃO da escada sem escrever cor
    // nenhuma aqui: um literal copiado para o teste envelhece na primeira troca
    // de paleta, e envelhece parecendo correto.
    const lum = (v) => {
      const m = v.match(/\d+(\.\d+)?/g) || [];
      const c = m.slice(0, 3).map((x) => {
        const n = Number(x) / 255;
        return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const razao = (a, b) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
    checar(t.secaoFechada === null || t.secaoFechada === t.secao,
      '[' + tema + '] a seção tem UM fundo só, aberta ou fechada — a peça não '
      + 'troca de cor com o estado (' + t.secao + ')');
    checar(transparente(t.barra) && transparente(t.corpo),
      '[' + tema + '] e a barra e o corpo dela não têm fundo próprio: a seção é '
      + 'UM bloco, não três peças costuradas (' + t.barra + ' / ' + t.corpo + ')');
    // O piso é o mesmo do projeto para duas superfícies grandes encostadas.
    //
    // A GUARDA DE OPACIDADE NÃO É ZELO: `lum()` lê "rgba(0, 0, 0, 0)" como
    // PRETO, então um nível que não pinta nada entra na conta como o fundo mais
    // escuro possível e produz um degrau enorme. Verificado — sem ela, este caso
    // APROVAVA a folha anterior à v5.267, em que a seção não tinha fundo próprio
    // e o card tinha a cor da barra dela. Um teste que aprova o defeito que ele
    // existe para pegar é pior que teste nenhum.
    const opaco = (v) => !transparente(v) && v !== 'AUSENTE';
    const d1 = razao(t.folha, t.secao), d2 = razao(t.secao, t.card);
    checar(opaco(t.folha) && opaco(t.secao) && opaco(t.card) && d1 >= 1.28 && d2 >= 1.28,
      '[' + tema + '] os três níveis PINTAM, e a escada tem degrau de verdade nos '
      + 'dois: folha → seção → card', d1.toFixed(2) + ':1 e ' + d2.toFixed(2) + ':1');
    // ...e NENHUM par de níveis pode coincidir, adjacente ou não — o "avô com a
    // cor do neto" é o defeito que a alternância de dois tons produzia por
    // construção, e ele reapareceria numa refatoração que voltasse a ela.
    //
    // O piso deste par é 1,05:1 e não os 1,28:1 dos adjacentes, e a razão é
    // aritmética, não preguiça: no tema CLARO a escada NÃO pode ser monotônica.
    // A página é cinza e o nível 1 é branco (a convenção de toda UI clara, e a
    // que a paleta adota desde a v5.192), então o primeiro degrau sobe e os
    // seguintes só podem descer — folha #dfe3e7 → seção #ffffff → card #d4dae2,
    // com folha × card em 1,09:1. Isso não se lê como ambiguidade porque os dois
    // NUNCA se encostam: entre eles há sempre a moldura branca da seção. Exigir
    // monotonia aqui reprovaria um desenho correto (verificado: foi o que a
    // primeira versão deste caso fez).
    const dPula = razao(t.folha, t.card);
    checar(opaco(t.card) && dPula >= 1.05,
      '[' + tema + '] e nenhum par de níveis coincide — nem os que se pulam',
      'folha × card ' + dPula.toFixed(2) + ':1');
    // v5.271: a faixa GANHOU preenchimento. A v5.267 tirou o filete e pôs o
    // espaço no lugar, mas deixou a faixa sem fundo — e um vão da mesma cor dos
    // dois lados não separa nada, que foi o relato do operador ("os itens ficam
    // soltos no mesmo ambiente, dificultando a visualização de sua área de
    // toque"). O que este caso trava agora são as três metades: ela PINTA, ela
    // não desenha filete, e o espaço entre duas continua existindo — sem o
    // último, um bloco colado no outro volta a não ter área de toque legível.
    checar(!transparente(t.faixa) && parseFloat(t.faixaFilete) === 0 && t.faixaGap > 0,
      '[' + tema + '] a faixa dentro do álbum tem PREENCHIMENTO próprio e nenhum '
      + 'filete: o que a separa da vizinha é o espaço entre dois blocos que se '
      + 'veem (' + t.faixa + ', gap ' + t.faixaGap + 'px)');
  } catch (e) {
    checar(false, 'a medição da escada de camadas (' + tema + ') terminou sem exceção ('
      + (e && e.message) + ')');
  }
}

// ── A COLUNA DA DIREITA NÃO SE MEXE (v5.242) ─────────────────────────────
// Pedido do operador: a seta de fechar o acordeão vai para a THUMB do álbum,
// "não precisando mover os números referentes ao tamanho do álbum que hoje
// ficam ao lado dessa seta que surge".
//
// A seta dividia a coluna da direita com o botão de baixar, e por isso o peso
// saltava ao abrir um álbum COMPLETO — ali aquele canto está vazio, e a seta o
// preenchia. Num álbum incompleto não saltava, o que é pior: o mesmo gesto
// movia ou não movia a tela conforme o estado do download.
//
// O caso mede a DISTÂNCIA do peso até a borda do card nos quatro estados, que é
// a coisa que o operador viu se mexer — e cobra os dois pares, senão reservar o
// lugar num deles e esquecer o outro passaria.
try {
  const col = await pg.evaluate(() => {
    setAppMode('full');
    const c = allCollections().find((x) => x.kind === 'hymnal');
    const medir = (completo, aberto) => {
      const songs = [];
      for (let i = 1; i <= 4; i++) {
        songs.push({ id_music: 'p' + i, name: 'Hino ' + i, track: i,
          has_instrumental_music: false, duration: '3:47',
          fileIdFull: (completo || i < 3) ? 'f' + i : null });
      }
      collState[c.id] = { indexSyncedAt: Date.now(), songs, isHymnal: true };
      gruposAbertos.clear(); gruposAbertos.add('Hinários'); gruposAbertos.add('Arquivos oficiais');
      ui(c.id).expanded = aberto; ui(c.id).shown = 100;
      const lista = document.createElement('ul');
      lista.className = 'hymnal-list';
      lista.style.width = '390px';
      document.body.appendChild(lista);
      renderCollectionsList(lista, () => {}, { semTotal: true });
      const card = lista.querySelector('.hymnal-card');
      // O TÍTULO é a régua desde a v5.247: o peso saiu da coluna da direita e
      // virou subtítulo, então quem denuncia um deslocamento daquela coluna é a
      // borda direita do nome — que ocupa a linha inteira e existe sempre.
      const alvo = card && card.querySelector('.coll-bar-name');
      const r = {
        borda: (card && alvo)
          ? Math.round(card.getBoundingClientRect().right - alvo.getBoundingClientRect().right) : -1,
        naThumb: !!(card && card.querySelector('.coll-bar-icon.coll-bar-fechar')),
        naDireita: !!(card && card.querySelector('.coll-bar-dl.coll-bar-cfg')),
      };
      lista.remove();
      return r;
    };
    const r = {
      completoFechado: medir(true, false), completoAberto: medir(true, true),
      parcialFechado: medir(false, false), parcialAberto: medir(false, true),
    };
    delete collState[c.id]; gruposAbertos.clear();
    return r;
  });
  checar(col.completoAberto.naThumb && !col.completoAberto.naDireita,
    'a seta de fechar o álbum mora na THUMB, não na coluna da direita');
  // ── A SETA É A THUMBNAIL DAS RAÍZES (v5.244) ───────────────────────────
  // Pedido do operador: a seção ganha a mesma thumb do card, e nas duas ela
  // carrega a seta — "nas raízes mais altas o ideal é a seta, pois ela
  // representa que pode abrir mais listagens"; ícone fica na folha.
  //
  // As metades: a seta está lá nos DOIS estados do álbum (era o glifo da
  // coleção com o card fechado), a seção tem a MESMA caixa, e a direção é
  // legível — fechado ela aponta para baixo, aberto para cima.
  checar(col.completoFechado.naThumb,
    'e ela está lá com o álbum FECHADO também — a thumb é a seta, não o glifo '
    + 'da coleção (que era o mesmo em todos os álbuns)');
  try {
    const raiz = await pg.evaluate(() => {
      setAppMode('full');
      const lista = document.createElement('ul');
      lista.className = 'hymnal-list';
      lista.style.width = '390px';
      document.body.appendChild(lista);
      gruposAbertos.clear();
      renderCollectionsList(lista, () => {}, { semTotal: true });
      const cx = (el) => (el ? getComputedStyle(el) : null);
      const secao = lista.querySelector('.coll-group--drop > .coll-group-bar > .coll-group-icon');
      const s = cx(secao);
      const r = {
        temSeta: !!secao,
        // A MESMA CAIXA do card: mesmo tamanho e mesmo tom.
        caixa: s ? [s.width, s.height, s.backgroundColor].join(' ') : '',
        // Fechada, ela aponta para BAIXO (girada meia volta).
        girada: !!(s && /matrix\(-1, 0, 0, -1/.test(s.transform)),
        // TODA seção tem a seta, e todas são botões (v5.262). Até aqui os
        // Favoritos eram um `<span class="vago">` — um lugar reservado, sem
        // seta e sem gesto —, e essa exceção saiu com o `fixo`.
        setas: lista.querySelectorAll('.coll-group--drop > .coll-group-bar > button.coll-group-icon').length,
        secoes: lista.querySelectorAll('.coll-group--drop').length,
      };
      lista.remove();
      return r;
    });
    const cardCaixa = await pg.evaluate(() => {
      const el = document.createElement('div');
      el.className = 'coll-bar-icon';
      document.body.appendChild(el);
      const s = getComputedStyle(el);
      const v = [s.width, s.height, s.backgroundColor].join(' ');
      el.remove();
      return v;
    });
    checar(raiz.temSeta && raiz.caixa === cardCaixa,
      'a SEÇÃO tem a mesma thumb do card do álbum — uma caixa só, um tom só ('
      + raiz.caixa + ')');
    checar(raiz.girada,
      'e fechada ela aponta para BAIXO: a seta diz para onde o toque leva');
    checar(raiz.secoes > 1 && raiz.setas === raiz.secoes,
      'e TODA seção tem a dela, botão e não enfeite — não sobrou nenhuma que '
      + 'reserve o lugar sem oferecer o gesto',
      raiz.setas + ' seta(s) em ' + raiz.secoes + ' seção(ões)');
  } catch (e) {
    checar(false, 'a medição da thumb das raízes terminou sem exceção (' + (e && e.message) + ')');
  }
  checar(col.completoFechado.borda > 0 && col.completoFechado.borda === col.completoAberto.borda,
    'e a coluna da direita de um álbum completo não se mexe ao abrir ('
    + col.completoFechado.borda + 'px da borda, aberto e fechado)');
  checar(col.parcialFechado.borda > 0 && col.parcialFechado.borda === col.parcialAberto.borda,
    'nem a de um álbum incompleto, cujo lugar do botão fica RESERVADO ('
    + col.parcialFechado.borda + 'px da borda, aberto e fechado)');
} catch (e) {
  checar(false, 'a medição da coluna da direita terminou sem exceção (' + (e && e.message) + ')');
}

// ── O PESO É SUBTÍTULO, E O CARD NÃO CRESCE (v5.247) ─────────────────────
// Pedido do operador: o peso vira um subtítulo abaixo do título, "pois
// atualmente ele está apertando o espaço disponível para o título dos álbuns.
// Mas garanta que os cards não fiquem mais altos por causa disso."
//
// São duas metades, e a segunda é a que torna a primeira aceitável — por isso
// as duas são medidas aqui. E nenhuma delas fixa um pixel: a altura é travada
// pela THUMB (é ela que manda, e o texto tem de caber nela), e a largura do
// título é comparada ENTRE CARDS — com e sem subtítulo o nome tem de ter a
// mesma linha, que é literalmente "o metadado não aperta mais o título".
try {
  const peso = await pg.evaluate(() => {
    setAppMode('full');
    albumCatalog.categories = [{ name: 'CDs do ano',
      albums: [{ id_album: 91, name: 'CD Jovem — Ao Vivo', subtitle: 'Coral e orquestra' }] }];
    albumCatalog.albums = [{ id_album: 91, name: 'CD Jovem — Ao Vivo' }];
    const c = allCollections().find((x) => x.kind === 'hymnal');
    const songs = [];
    for (let i = 1; i <= 4; i++) {
      songs.push({ id_music: 'w' + i, name: 'Hino ' + i, track: i,
        has_instrumental_music: false, duration: '3:47', fileIdFull: i < 3 ? 'f' + i : null });
    }
    collState[c.id] = { indexSyncedAt: Date.now(), songs, isHymnal: true };
    gruposAbertos.clear();
    gruposAbertos.add('Hinários'); gruposAbertos.add('Arquivos oficiais');
    gruposAbertos.add('CDs do ano');
    const lista = document.createElement('ul');
    lista.className = 'hymnal-list';
    lista.style.width = '390px';
    document.body.appendChild(lista);
    renderCollectionsList(lista, () => {}, { semTotal: true });
    const cards = [...lista.querySelectorAll('.hymnal-card')];
    const ler = (card) => {
      const alt = (sel) => {
        const el = card.querySelector(sel);
        return el ? el.getBoundingClientRect().height : 0;
      };
      return {
        // O peso saiu da BARRA (filho direto) e virou filho da coluna de texto.
        naColuna: !!card.querySelector('.coll-bar-info .coll-bar-sync'),
        naBarra: !!card.querySelector('.coll-bar > .coll-bar-sync'),
        larguraNome: card.querySelector('.coll-bar-name').getBoundingClientRect().width,
        alturaTexto: alt('.coll-bar-info'),
        alturaThumb: alt('.coll-bar-icon'),
        // Metadado numa linha só: o subtítulo e o peso são irmãos, não duas
        // linhas empilhadas.
        metaLinhas: card.querySelectorAll('.coll-bar-meta').length,
        temSub: !!card.querySelector('.coll-bar-sub'),
      };
    };
    const r = cards.map(ler);
    lista.remove();
    delete collState[c.id];
    albumCatalog.categories = []; albumCatalog.albums = [];
    gruposAbertos.clear();
    return r;
  });
  const comSub = peso.find((c) => c.temSub);
  const semSub = peso.find((c) => !c.temSub);
  // Nem todo card TEM peso a dizer (um hinário sem índice não tem), e desde a
  // v5.247 ele simplesmente não desenha a linha. A regra é sobre ONDE ele fica
  // quando existe — e sobre nunca voltar a ser filho da barra.
  checar(peso.some((c) => c.naColuna) && !peso.some((c) => c.naBarra),
    'o PESO virou subtítulo: ele é filho da coluna de texto, nunca da barra');
  checar(!!comSub && !!semSub && Math.round(comSub.larguraNome) === Math.round(semSub.larguraNome),
    'e o título ocupa a linha inteira — a mesma largura com e sem subtítulo ('
    + (comSub ? Math.round(comSub.larguraNome) : '?') + 'px), que é o aperto que ele causava');
  checar(peso.every((c) => c.alturaTexto <= c.alturaThumb + 1),
    'e O CARD NÃO CRESCE: as duas linhas cabem na altura da THUMB, que continua '
    + 'sendo quem manda ('
    + (peso[0] ? Math.round(peso[0].alturaTexto) + 'px de texto em '
      + Math.round(peso[0].alturaThumb) + 'px de thumb' : '?') + ')');
  checar(!!comSub && comSub.metaLinhas === 1,
    'com o subtítulo do pivô e o peso na MESMA linha — uma linha por peça faria '
    + 'o card crescer conforme o catálogo');
} catch (e) {
  checar(false, 'a medição do peso como subtítulo terminou sem exceção (' + (e && e.message) + ')');
}

// ── A TROCA DE MODO É UMA SÓ, E MORA EM CONFIGURAÇÕES (v5.247 · v5.250) ──
//
// Dois pedidos do operador, em sequência: tirar a troca de modo do cabeçalho do
// avançado ("já temos nas configurações o botão de acesso ao modo simples"), e
// então criar no Modo Fácil "um botão de configurações, que fica onde é hoje o
// botão de modo avançado".
//
// A ORDEM IMPORTAVA: o botão do Modo Fácil não podia sair antes de existir a
// engrenagem, porque daquele modo não havia como chegar a Configurações — a
// outra engrenagem mora na coluna do mixer, dentro da `.bottombar`, que ele
// esconde por inteiro. Tirar os dois de uma vez teria TRANCADO o operador no
// Modo Fácil, e é isso que a asserção do caminho de saída guarda.
//
// A medição achou um efeito que não estava no pedido: sem a caixa reservada do
// botão (que existia para o título não saltar entre abas), o título do
// cabeçalho da lista passou a ficar de fato CENTRADO — ele nunca esteve, vivia
// 63px à direita.
try {
  const modo = await pg.evaluate(() => {
    setAppMode('full');
    const t = document.getElementById('listTitle');
    const faixa = t.parentElement.getBoundingClientRect();
    const r = t.getBoundingClientRect();
    const seg = document.getElementById('appModeSeg');
    const eng = document.getElementById('simpleSettingsBtn');
    return {
      cabecalho: !document.getElementById('fullSimpleBtn'),
      desvio: Math.abs((r.left + r.width / 2) - (faixa.left + faixa.width / 2)),
      engrenagemNoFacil: !!eng && !!eng.closest('.simple-head'),
      sobrouTrocaDeModo: !!document.querySelector('.mode-switch'),
      opcoes: seg ? [...seg.querySelectorAll('.fit-opt')].map((b) => b.dataset.mode) : [],
    };
  });
  checar(modo.cabecalho,
    'o cabeçalho da lista NÃO tem mais a troca de modo — ela é a mesma decisão de Configurações');
  checar(modo.desvio <= 2,
    'e o TÍTULO passou a ficar centrado na faixa (a caixa reservada do botão o '
    + 'empurrava 63px para a direita) — desvio de ' + Math.round(modo.desvio) + 'px');
  checar(!modo.sobrouTrocaDeModo,
    'e não sobrou nenhum `.mode-switch` no app: a troca de modo é UM controle, em Configurações');
  checar(modo.engrenagemNoFacil,
    'o Modo Fácil ganhou a ENGRENAGEM no cabeçalho, onde estava o botão que saiu');
  checar(modo.opcoes.includes('simple') && modo.opcoes.includes('full'),
    'e Configurações oferece os dois modos — o destino que substitui os dois botões');

  // O CAMINHO DE SAÍDA, exercitado: no Modo Fácil, a engrenagem abre a folha e
  // a folha troca o modo. Sem esta metade, apagar o botão passaria nas de cima
  // e trancaria o operador — que é exatamente o risco desta sequência.
  const saida = await pg.evaluate(async () => {
    setAppMode('simple');
    const eng = document.getElementById('simpleSettingsBtn');
    const folha = document.getElementById('fadePopup');
    // Null-safe pela disciplina do `ota.test.mjs`: num bundle sem a engrenagem
    // isto é um RESULTADO, não um acidente — e um `evaluate` que lança aqui
    // levaria junto as asserções seguintes, escondendo o que elas mediriam.
    if (!eng) { setAppMode('full'); return { visivel: false, abriu: false, saiu: false }; }
    // O toque é o do operador: a engrenagem tem de estar VISÍVEL e por cima da
    // tela do Modo Fácil (a folha é z-index 200; o modo, 90).
    const cs = getComputedStyle(eng);
    const visivel = cs.display !== 'none' && cs.visibility !== 'hidden' && eng.offsetParent !== null;
    eng.click();
    await new Promise((r) => setTimeout(r, 60));
    const abriu = folha.classList.contains('open');
    document.querySelector('#appModeSeg .fit-opt[data-mode="full"]').click();
    await new Promise((r) => setTimeout(r, 60));
    const saiu = !document.body.classList.contains('mode-simple')
      && !folha.classList.contains('open');
    setAppMode('full');
    return { visivel, abriu, saiu };
  });
  checar(saida.visivel, 'e ela está à vista no Modo Fácil, não escondida atrás dele');
  checar(saida.abriu, 'o toque nela ABRE Configurações');
  checar(saida.saiu,
    'e de lá o operador SAI do Modo Fácil — o caminho que a engrenagem precisava existir para dar');
} catch (e) {
  checar(false, 'a medição da troca de modo terminou sem exceção (' + (e && e.message) + ')');
}

// ── OS BOTÕES DA LINHA VIRAM UM SÓ (v5.258) ──────────────────────────────
//
// Relato do operador: *"hoje o título disputa com todos os botões de acesso
// rápido, cortando o título e subtítulo. Então use um botão de 3 pontos para
// indicar a abertura das opções."*
//
// As duas metades: a linha PARADA tem um botão só (e o nome cresce), e o toque
// nele REVELA as ações por cima da linha. Sem a segunda, apagar os botões
// passaria na primeira e deixaria o operador sem como favoritar nada.
try {
  const linha = await pg.evaluate(async () => {
    setAppMode('full');
    await AVDB.addMedia(new Blob(['x'], { type: 'audio/mpeg' }),
      { name: '147. Ó Adorai o Senhor em a Beleza da Sua Santidade', list: 'imports' });
    await load();
    const li = document.querySelector('#library .lib-item');
    if (!li) return null;
    const nome = () => Math.round(li.querySelector('.row-name').getBoundingClientRect().width);
    const caixa = li.querySelector('.row-acoes');
    const mais = li.querySelector('.row-mais');
    const vis = (el) => {
      const cs = getComputedStyle(el);
      return cs.visibility !== 'hidden' && cs.opacity !== '0';
    };
    const r = {
      // A linha PARADA: um botão só, direto na `.row`.
      botoesNaLinha: [...li.querySelectorAll('.row > button')].length,
      temMais: !!mais,
      nome: nome(),
      fechadaInvisivel: !!caixa && !vis(caixa),
      // As ações existem, guardadas: estrela e alça continuam lá.
      dentroDoMenu: !!caixa && caixa.querySelectorAll('button').length >= 2,
    };
    // NULL-SAFE de propósito: num bundle sem o `⋮` isto é um RESULTADO, e um
    // `evaluate` que lança aqui abortaria o arquivo inteiro, escondendo tudo o
    // que vem depois (a lição da v5.213).
    if (mais) mais.click();
    return r;
  });
  // A ABERTURA É ANIMADA (.14s de opacidade), então medir no mesmo turno do
  // clique leria o primeiro quadro — zero por definição. É a lição da v5.226:
  // a espera é, ela própria, a afirmação de que a transição existe.
  await pg.waitForTimeout(320);
  const aberta = await pg.evaluate(async () => {
    const li = document.querySelector('#library .lib-item');
    const caixa = li && li.querySelector('.row-acoes');
    const mais = li && li.querySelector('.row-mais');
    if (!li || !caixa || !mais) return {};
    const vis = (el) => {
      const cs = getComputedStyle(el);
      return cs.visibility !== 'hidden' && cs.opacity !== '0';
    };
    const r = {};
    const cr = caixa.getBoundingClientRect();
    const mr = mais.getBoundingClientRect();
    const nr = li.querySelector('.row-name').getBoundingClientRect();
    r.abriu = vis(caixa);
    // "para a sua esquerda sobre o item, cobrindo o título": a caixa termina
    // antes do `⋮` e COBRE o nome.
    r.aEsquerdaDoMais = cr.right <= mr.left + 1;
    r.cobreONome = cr.left <= nr.left + 1 && cr.right >= nr.right - 1;
    // E ela é OPACA: uma faixa translúcida por cima do título seria as duas
    // coisas ilegíveis em vez de uma.
    const bg = getComputedStyle(caixa).backgroundColor;
    r.opaca = !/rgba\(.*,\s*0(\.\d+)?\)$/.test(bg) && bg !== 'transparent';
    // Um toque em qualquer outro lugar fecha. **A ESPERA É OBRIGATÓRIA desde a
    // v5.270**: a gaveta passou a SAIR animada (o `visibility` entrou na
    // transição, e sem ele o fechamento nunca chegava a ser visto), então medir
    // no mesmo turno lê o quadro zero — a caixa ainda opaca e ainda visível.
    // O caso continua afirmando a mesma coisa; o que mudou é quando ele olha.
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await new Promise((f) => setTimeout(f, 320));
    r.fechouForaDela = !vis(caixa);
    return r;
  });
  checar(!!linha, 'a linha do Cronograma foi desenhada para medir');
  checar(!!linha && linha.botoesNaLinha === 1 && linha.temMais,
    'A LINHA TEM UM BOTÃO SÓ, o `⋮` — o resto saiu de cima do título',
    JSON.stringify(linha));
  checar(!!linha && linha.nome > 250,
    'e o NOME ficou com a largura que os botões ocupavam ('
    + (linha ? linha.nome : 0) + 'px, contra 194 antes)');
  checar(!!linha && linha.fechadaInvisivel && linha.dentroDoMenu,
    'as ações continuam existindo, guardadas e fora do toque enquanto o menu está fechado');
  checar(aberta.abriu && aberta.aEsquerdaDoMais && aberta.cobreONome,
    'o toque no `⋮` ABRE as ações à esquerda dele, cobrindo o título — o pedido, literal',
    JSON.stringify(aberta));
  checar(aberta.opaca,
    'e a faixa é OPACA: título e botões na mesma tinta seriam os dois ilegíveis');
  checar(aberta.fechouForaDela,
    'e um toque em qualquer outro lugar fecha o menu');
} catch (e) {
  checar(false, 'a medição do menu da linha terminou sem exceção (' + (e && e.message) + ')');
}

// ── A LINHA DEPOIS DO RELATO: uma caixa só, o Parar na capa (v5.259) ──────
//
// Quatro coisas do mesmo relato, e as quatro são medidas em pixel porque as
// quatro FORAM VISTAS em pixel: *"ele deve ocupar apenas a barra do título e
// subtítulo, não cortar a thumbnail"*, *"os botões surgem literalmente sobre o
// título, com ele visível no fundo"*, *"verifique o tamanho e a área de toque…
// a thumbnail e os botões devem ter os mesmos tamanhos"* e o encolhimento que
// *"deixa as margens esquerda e direita estranhas quando está no ar"*.
try {
  const geo = await pg.evaluate(async () => {
    setAppMode('full');
    const li = document.querySelector('#library .lib-item');
    if (!li) return null;
    const cx = (el) => el.getBoundingClientRect();
    const thumb = li.querySelector('.thumb');
    const caixa = li.querySelector('.row-acoes');
    const mais = li.querySelector('.row-mais');
    const r = {};
    // 1. A FAIXA COMEÇA DEPOIS DA CAPA. (Ela partia de `--hit`, 34px, onde quem
    //    ocupa o canto é a miniatura, de 40px: comia 6px dela.)
    r.thumbInteira = Math.round(cx(caixa).left) >= Math.round(cx(thumb).right);
    // 2. TODOS OS QUADRADOS DA LINHA MEDEM O MESMO.
    const alvos = [...li.querySelectorAll('.row-btn, .row-handle, .row-mais')];
    const larguras = alvos.map((b) => Math.round(cx(b).width));
    r.caixaDaThumb = Math.round(cx(thumb).width);
    r.mesmaCaixa = larguras.length > 0 && larguras.every((w) => w === r.caixaDaThumb);
    r.alvo = r.caixaDaThumb;
    r.maisMede = Math.round(cx(mais).width);
    // 3. O PARAR MORA DENTRO DA CAPA e a cobre inteira.
    li.classList.add('no-ar');
    const stop = li.querySelector('.row-stop');
    r.stopNaThumb = !!stop && stop.parentElement === thumb;
    const sr = stop && cx(stop);
    r.stopCobreACapa = !!sr && Math.round(sr.width) === r.caixaDaThumb
      && Math.round(sr.height) === r.caixaDaThumb;
    r.stopVisivel = !!stop && getComputedStyle(stop).display !== 'none';
    // 4. E A FAIXA CONTINUA OPACA COM A LINHA NO AR — era aqui que o título
    //    aparecia atrás dos botões, porque `--live-soft` tem alfa .22.
    const bg = getComputedStyle(caixa).backgroundColor;
    const m = bg.match(/rgba?\(([^)]+)\)/);
    const partes = m ? m[1].split(',').map((x) => parseFloat(x)) : [];
    r.alfaNoAr = partes.length === 4 ? partes[3] : 1;
    r.bgNoAr = bg;
    li.classList.remove('no-ar');
    return r;
  });
  checar(!!geo && geo.thumbInteira,
    'a faixa de ações começa DEPOIS da miniatura — ela não corta a capa',
    JSON.stringify(geo));
  checar(!!geo && geo.mesmaCaixa && geo.alvo >= 40,
    'e a miniatura e TODOS os botões da linha medem o mesmo (' + (geo ? geo.alvo : 0)
    + 'px) — o alvo cresceu junto', JSON.stringify(geo));
  checar(!!geo && geo.stopNaThumb && geo.stopCobreACapa && geo.stopVisivel,
    'o "Tirar do ar" mora DENTRO da miniatura e a cobre inteira — o alvo é a capa',
    JSON.stringify(geo));
  checar(!!geo && geo.alfaNoAr === 1,
    'e com a linha NO AR a faixa continua opaca (era o título aparecendo atrás dos botões)',
    JSON.stringify(geo));
} catch (e) {
  checar(false, 'a medição da linha terminou sem exceção (' + (e && e.message) + ')');
}

// ── O TOQUE ENCOLHE O CARTÃO, NÃO O MIOLO DELE (v5.259) ──────────────────
//
// `:active` não se simula por API, então a asserção é sobre a REGRA: o alvo do
// `transform` tem de ser a peça que carrega a BORDA. Enquanto ela era
// transparente os dois davam no mesmo; com ela visível (no ar, atual,
// selecionada) o miolo se afastava de uma moldura parada e abria uma fresta dos
// dois lados — o relato, literal.
try {
  const press = await pg.evaluate(() => {
    const alvos = [];
    for (const folha of [...document.styleSheets]) {
      let regras = [];
      try { regras = [...folha.cssRules]; } catch { continue; }
      for (const re of regras) {
        if (!re.selectorText || !/:active/.test(re.selectorText)) continue;
        if (!/transform/.test(re.style.cssText || '')) continue;
        alvos.push(re.selectorText);
      }
    }
    const txt = alvos.join(' | ');
    return {
      temCartao: /\.lib-item(?![\w-])(?!\s+\.row)/.test(txt),
      temMiolo: /\.lib-item\s+\.row(?![\w-])/.test(txt),
    };
  });
  checar(press.temCartao && !press.temMiolo,
    'o feedback de toque de uma linha encolhe o CARTÃO (com a borda), não o miolo dentro dela',
    JSON.stringify(press));
} catch (e) {
  checar(false, 'a medição do feedback de toque terminou sem exceção (' + (e && e.message) + ')');
}

// ── O SUBTÍTULO DIZ DE ONDE O ITEM VEIO (v5.258) ─────────────────────────
try {
  const sub = await pg.evaluate(() => ({
    audio: subtituloItem({ kind: 'audio', seconds: 225, hymnAlbum: 'Hinário Adventista 2022' }),
    video: subtituloItem({ kind: 'video', height: 1080, hymnAlbum: 'Provai e Vede 2026' }),
    semAlbum: subtituloItem({ kind: 'audio', seconds: 225 }),
  }));
  checar(/Áudio · Hinário Adventista 2022/.test(sub.audio),
    'o subtítulo de uma música traz o ÁLBUM, logo depois do tipo', sub.audio);
  checar(sub.audio.indexOf('Hinário') < sub.audio.indexOf('3:45'),
    'e ANTES da duração: numa linha que corta, o que sobrevive tem de identificar');
  checar(/Provai e Vede/.test(sub.video),
    'vale para vídeo também — um episódio de série vem de uma coleção do mesmo jeito', sub.video);
  checar(sub.semAlbum === 'Áudio · 3:45',
    'e um item sem coleção nenhuma continua exatamente como era', sub.semAlbum);
} catch (e) {
  checar(false, 'a medição do subtítulo terminou sem exceção (' + (e && e.message) + ')');
}

// ── A BIBLIOTECA: sem "baixar tudo", com a busca na BASE (v5.258) ────────
try {
  const bib = await pg.evaluate(() => {
    const sheet = document.querySelector('#hymnSearchPopup .popup-sheet');
    const barra = sheet.querySelector('.hymn-search-bar');
    const lista = sheet.querySelector('#hymnResults');
    return {
      semTotal: !document.getElementById('hymnSearchTotal'),
      semBotaoNoCabecalho: !sheet.querySelector('.popup-header .coll-group-btn'),
      // A barra é o ÚLTIMO filho: é isso que a põe encostada na borda de baixo
      // da folha. Encostá-la no TECLADO é outra conta, e ela é da folha, não
      // desta ordem — ver o caso da faixa visível, logo abaixo.
      barraPorUltimo: sheet.lastElementChild === barra,
      abaixoDaLista: !!barra && !!lista
        && [...sheet.children].indexOf(barra) > [...sheet.children].indexOf(lista),
      fecharNaBarra: !!barra && !!barra.querySelector('#hymnSearchClose'),
      campoNaBarra: !!barra && !!barra.querySelector('#hymnSearchInput'),
    };
  });
  checar(bib.semTotal && bib.semBotaoNoCabecalho,
    'o "Baixar toda a biblioteca" e o peso total SAÍRAM do cabeçalho', JSON.stringify(bib));
  checar(bib.barraPorUltimo && bib.abaixoDaLista,
    'e a barra de busca é o último elemento do sheet — na base, onde o teclado sobe');
  checar(bib.campoNaBarra && bib.fecharNaBarra,
    'com o campo E o fechar juntos nela, que é o pedido inteiro');
} catch (e) {
  checar(false, 'a medição da Biblioteca terminou sem exceção (' + (e && e.message) + ')');
}

// ---------- A BIBLIOTECA É UMA TELA, E ELA SÓ ESMAECE (v5.263) ----------
// Pedido do operador: *"troque a animação de slide vertical, há muitos
// problemas com ela por causa do teclado, então faça apenas um fade in e out
// para a biblioteca, e faça dela uma tela inteira e não um tipo de pop up."*
//
// São TRÊS metades, e nenhuma basta: não há deslocamento em nenhum dos dois
// estados (tirar só o `translateY(100%)` do fechado deixaria a folha entrar com
// um salto), o que muda entre eles é a OPACIDADE, e a camada não tem scrim —
// que é o último tique de popup que sobrava.
//
// (Ele REVOGA a v5.262, que tinha invertido o sentido do slide. O diagnóstico
// de lá continua correto e é a razão desta: três lotes seguidos corrigindo o
// entorno de uma animação são a animação dizendo que não vale o preço.)
try {
  const tela = await pg.evaluate(async () => {
    const camada = document.getElementById('hymnSearchPopup');
    const folha = camada && camada.querySelector('.popup-sheet');
    if (!folha) return null;
    // `matrix(a,b,c,d,tx,ty)`: qualquer deslocamento aparece em tx/ty.
    const desloc = (el) => {
      const m = /matrix\(([^)]+)\)/.exec(getComputedStyle(el).transform);
      if (!m) return 0;   // 'none'
      const n = m[1].split(',');
      return Math.abs(parseFloat(n[4])) + Math.abs(parseFloat(n[5]));
    };
    closeHymnSearch();
    await new Promise((r) => setTimeout(r, 350));
    const fechada = { desloc: desloc(folha), opacidade: parseFloat(getComputedStyle(camada).opacity) };
    setAppMode('full');
    openHymnSearch();
    await new Promise((r) => setTimeout(r, 350));
    const aberta = { desloc: desloc(folha), opacidade: parseFloat(getComputedStyle(camada).opacity) };
    const scrim = getComputedStyle(camada).backgroundColor;
    closeHymnSearch();
    return { fechada, aberta, scrim };
  });
  checar(!!tela && tela.fechada.desloc === 0 && tela.aberta.desloc === 0,
    'a Biblioteca não DESLIZA em estado nenhum — fechada e aberta ela está no '
    + 'mesmo lugar', tela ? tela.fechada.desloc + ' / ' + tela.aberta.desloc : 'sem folha');
  checar(!!tela && tela.fechada.opacidade === 0 && tela.aberta.opacidade === 1,
    'o que a abre e a fecha é a OPACIDADE, e só ela');
  checar(!!tela && /rgba\(0, 0, 0, 0\)|transparent/.test(tela.scrim),
    'e ela não tem SCRIM: é uma tela, não um popup desenhado por cima de outra '
    + 'escurecida', tela ? tela.scrim : '?');
} catch (e) {
  checar(false, 'a medição da abertura da Biblioteca terminou sem exceção (' + (e && e.message) + ')');
}

// ---------- A TELA VEM NUM TEMPO, O TECLADO NO SEGUINTE (v5.264) ----------
// Pedido do operador: *"coloque um pequeno delay na abertura da biblioteca, em
// um tempo a tela aparece e no segundo tempo o teclado. isso vai fazer a tela
// piscar menos."*
//
// **O que este caso NÃO prova, e é preciso dizer:** que o teclado sobe. Num
// Chromium de mesa não existe teclado virtual, então nenhum teste daqui alcança
// isso — o que se mede é o FOCO, que é o gatilho dele. E a terceira asserção é
// a que mais importa: fechar dentro da janela do adiamento não pode deixar um
// `focus()` órfão, senão o teclado subiria sobre o app com a Biblioteca já fora
// de cena.
try {
  const foco = await pg.evaluate(async () => {
    const campo = document.getElementById('hymnSearchInput');
    setAppMode('full');
    closeHymnSearch();
    await new Promise((r) => setTimeout(r, 60));
    // `blur()` no campo, e não um `focus()` no `<body>`: o body não é focável
    // sem `tabindex`, então aquilo era um no-op e o `activeElement` continuava
    // sendo o campo de um caso anterior — a medição aprovaria os dois desenhos.
    campo.blur();
    openHymnSearch();
    // MESMO TURNO: se o `focus()` tivesse ficado síncrono, ele já teria
    // acontecido aqui — é esta leitura que distingue os dois desenhos.
    const naHora = document.activeElement === campo;
    await new Promise((r) => setTimeout(r, 500));
    const depois = document.activeElement === campo;
    closeHymnSearch();
    // E o cancelamento: abrir e fechar dentro da janela não pode focar nada.
    campo.blur();
    openHymnSearch();
    closeHymnSearch();
    await new Promise((r) => setTimeout(r, 500));
    const orfao = document.activeElement === campo;
    return { naHora, depois, orfao };
  });
  checar(!foco.naHora,
    'a Biblioteca abre SEM tomar o campo no mesmo tempo — a tela vem primeiro');
  checar(foco.depois,
    'e o campo é tomado no tempo seguinte, que é o que faz o teclado subir depois'
    + ' de a tela estar parada');
  checar(!foco.orfao,
    'fechar dentro da janela CANCELA o foco adiado — senão o teclado subiria '
    + 'sobre o app com a Biblioteca já fora de cena');
} catch (e) {
  checar(false, 'a medição do foco adiado terminou sem exceção (' + (e && e.message) + ')');
}

// ---------- A LUPA DENTRO DO CAMPO DE BUSCA (v5.264) ----------
// Pedido do operador: *"adicione um ícone de lupa na barra de pesquisa da
// biblioteca, isso vai indicar melhor o objetivo da barra."*
//
// Duas metades: ela está DENTRO do campo (não é mais um item da linha flex
// disputando largura com o ✕), e o toque nela cai no campo — um ícone que
// engole o toque no canto de um campo de texto é um ponto morto onde o dedo
// mira.
try {
  const lupa = await pg.evaluate(async () => {
    setAppMode('full');
    openHymnSearch();
    await new Promise((r) => setTimeout(r, 400));
    const campo = document.getElementById('hymnSearchInput');
    const ico = document.querySelector('#hymnSearchPopup .lib-search-lupa');
    if (!ico) { closeHymnSearch(); return null; }
    const ri = ico.getBoundingClientRect();
    const rc = campo.getBoundingClientRect();
    const r = {
      // Dentro da caixa do campo, e antes do texto.
      dentro: ri.left >= rc.left - 1 && ri.right <= rc.right + 1
        && ri.top >= rc.top - 1 && ri.bottom <= rc.bottom + 1,
      // O recuo do texto abre lugar para ela: o padding esquerdo passa da
      // borda direita do ícone.
      recuo: parseFloat(getComputedStyle(campo).paddingLeft) >= (ri.right - rc.left) - 1,
      // O TOQUE atravessa: quem responde no centro da lupa é o campo.
      alvo: document.elementFromPoint((ri.left + ri.right) / 2, (ri.top + ri.bottom) / 2) === campo,
      // UM desenho só: ela referencia o mesmo símbolo do botão do YouTube.
      simbolo: (ico.querySelector('use') || {}).getAttribute
        ? ico.querySelector('use').getAttribute('href') : '',
    };
    closeHymnSearch();
    return r;
  });
  checar(!!lupa && lupa.dentro && lupa.recuo,
    'a LUPA fica dentro do campo de busca, com o texto recuado para dar lugar a ela');
  checar(!!lupa && lupa.alvo,
    'e o toque nela cai no CAMPO — decoração não pode virar ponto morto');
  checar(!!lupa && lupa.simbolo === '#icoLupa',
    'ela é o MESMO desenho do botão de pesquisar no YouTube, não uma segunda '
    + 'cópia dele', lupa ? lupa.simbolo : 'sem lupa');
} catch (e) {
  checar(false, 'a medição da lupa terminou sem exceção (' + (e && e.message) + ')');
}

// ---------- A BARRA DE BUSCA SE DESTACA DO CORPO (v5.266) ----------
// Pedido do operador: *"crie um contraste melhor entre a barra de buscas e o
// corpo da tela de biblioteca, pois agora que ela é 'flutuante' ela precisa se
// destacar."* Até aqui ela não tinha fundo nenhum — herdava a cor da folha.
//
// A régua NÃO é um número escrito aqui: é a `.bottombar` da tela principal, que
// é a resposta que este app já deu para "separar duas caixas empilhadas" e cujo
// comentário declara o degrau como o único separador (sem borda, sem sombra).
// Ancorar nela mantém o caso verdadeiro se os tokens mudarem — e é o que
// reprova o caminho errado óbvio, usar `--bar` aqui: no tema CLARO aquele token
// é branco puro, a mesma cor da folha.
//
// NOS DOIS TEMAS, porque é justamente no claro que o atalho falharia.
for (const tema of ['escuro', 'claro']) {
  try {
    const c = await pg.evaluate(async (tema) => {
      document.documentElement.setAttribute('data-tema', tema);
      setAppMode('full');
      openHymnSearch();
      await new Promise((r) => setTimeout(r, 400));
      const fundo = (s) => {
        const e = document.querySelector(s);
        return e ? getComputedStyle(e).backgroundColor : '';
      };
      const barra = document.querySelector('#hymnSearchPopup .hymn-search-bar');
      const r = {
        folha: fundo('#hymnSearchPopup .popup-sheet'),
        barra: fundo('#hymnSearchPopup .hymn-search-bar'),
        campo: getComputedStyle(document.getElementById('hymnSearchInput')).backgroundColor,
        sombra: getComputedStyle(barra).boxShadow,
        // A RÉGUA do próprio app: o degrau da barra de baixo contra o fundo.
        corpoPrincipal: fundo('body'),
        barraPrincipal: fundo('.bottombar'),
        // O que mora DENTRO do campo (v5.267).
        texto: getComputedStyle(document.getElementById('hymnSearchInput')).color,
        ph: getComputedStyle(document.getElementById('hymnSearchInput'), '::placeholder').color,
        lupa: getComputedStyle(document.querySelector('#hymnSearchPopup .lib-search-lupa')).color,
        sombraCampo: getComputedStyle(document.getElementById('hymnSearchInput')).boxShadow,
        // O ✕ da barra (v5.270): altura, fundo e glifo.
        hCampo: document.getElementById('hymnSearchInput').getBoundingClientRect().height,
        hBtn: document.getElementById('hymnSearchClose').getBoundingClientRect().height,
        btn: getComputedStyle(document.getElementById('hymnSearchClose')).backgroundColor,
        glifo: getComputedStyle(document.getElementById('hymnSearchClose')).color,
      };
      closeHymnSearch();
      return r;
    }, tema);
    // Compõe alfa sobre a base (o campo é um overlay) e devolve a razão de
    // contraste — a mesma conta do `display-smoke.mjs`.
    const rgb = (s) => (s.match(/[\d.]+/g) || []).map(Number);
    const sobre = (frente, base) => {
      const f = rgb(frente); const b = rgb(base);
      const a = f.length > 3 ? f[3] : 1;
      return [0, 1, 2].map((i) => f[i] * a + b[i] * (1 - a));
    };
    const lum = (v) => {
      const l = v.map((x) => { const c = x / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
    };
    const razao = (a, b) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
    const folha = rgb(c.folha);
    const barra = sobre(c.barra, c.folha);
    const campo = sobre(c.campo, c.barra.includes('rgba(0, 0, 0, 0)') ? c.folha : c.barra);
    const regua = razao(sobre(c.barraPrincipal, c.corpoPrincipal), rgb(c.corpoPrincipal));
    const passo = razao(barra, folha);
    checar(c.barra !== c.folha && c.barra !== 'rgba(0, 0, 0, 0)',
      '[' + tema + '] a barra de busca tem fundo PRÓPRIO — ela herdava a cor da folha',
      c.barra + ' contra ' + c.folha);
    checar(passo >= regua - 0.05,
      '[' + tema + '] e o degrau é o do próprio app para separar duas caixas: '
      + passo.toFixed(2) + ':1, contra os ' + regua.toFixed(2) + ':1 da barra de baixo');
    checar(/-\d+px/.test(c.sombra) && c.sombra !== 'none',
      '[' + tema + '] com a sombra para CIMA, que é o que o tom não diz: a lista '
      + 'passa por baixo dela', c.sombra);
    // E o CAMPO se separa da barra POR TOM (v5.270). Até aqui, no tema claro,
    // ele não se separava de jeito nenhum — barra e campo eram os dois brancos
    // (1,00:1), e a v5.268 sustentou a distinção só pela elevação. O operador
    // pediu o conserto de verdade: a barra escureceu, e o degrau passou a ser a
    // primeira linha de defesa nos DOIS temas.
    checar(razao(campo, barra) > 1.5,
      '[' + tema + '] o campo se separa da barra POR TOM ('
      + razao(campo, barra).toFixed(2) + ':1)');
    // ── O CAMPO É BRANCO NOS DOIS TEMAS (v5.268) ─────────────────────────
    // Pedido do operador. A primeira metade é o fundo; a SEGUNDA é a que não se
    // percebe pedindo "o campo branco" e que reprovaria calada: as três coisas
    // que moram dentro dele (o texto, o placeholder e a lupa) precisam parar de
    // seguir o tema junto com ele — no escuro, `--text` sobre branco dá 1,17:1.
    checar(campo.every((v) => Math.round(v) === 255),
      '[' + tema + '] o CAMPO é branco — o mesmo nos dois temas, como o palco',
      c.campo);
    checar(!!c.sombraCampo && c.sombraCampo !== 'none',
      '[' + tema + '] e a elevação FICA, agora como reforço: ele é uma folha de '
      + 'papel pousada na faixa, não um recorte dela', c.sombraCampo);
    // ── O ✕ TEM A ALTURA DO CAMPO, E É CLARO COMO ELE (v5.270) ───────────
    // As duas metades do pedido. A altura vinha do esqueleto de botão de ícone
    // (`--hit`, 34px) contra os 40 do campo — dois vizinhos na mesma linha com
    // sete pixels de diferença que ninguém decidiu. E a cor: com a barra
    // escurecida, um botão em `--surface-2`/`--muted` daria 2,09:1 no glifo.
    checar(Math.abs(c.hBtn - c.hCampo) <= 1,
      '[' + tema + '] o ✕ tem a MESMA altura do campo (' + Math.round(c.hBtn)
      + 'px contra ' + Math.round(c.hCampo) + 'px)');
    checar(c.btn === c.campo,
      '[' + tema + '] e o mesmo fundo CLARO dele — as duas peças claras sobre a '
      + 'faixa, não um chip translúcido ao lado de uma folha de papel', c.btn);
    checar(razao(sobre(c.glifo, c.btn), sobre(c.btn, c.barra)) >= 4.5,
      '[' + tema + '] com o glifo legível sobre ele ('
      + razao(sobre(c.glifo, c.btn), sobre(c.btn, c.barra)).toFixed(2) + ':1)');
    for (const [nome, cor] of [['texto', c.texto], ['placeholder', c.ph], ['lupa', c.lupa]]) {
      const r = razao(sobre(cor, c.campo), campo);
      checar(r >= 4.5,
        '[' + tema + '] e o ' + nome + ' é legível sobre ele (' + r.toFixed(2) + ':1)');
    }
  } catch (e) {
    checar(false, '[' + tema + '] a medição do contraste da barra terminou sem exceção ('
      + (e && e.message) + ')');
  }
}
await pg.evaluate(() => document.documentElement.setAttribute('data-tema', 'escuro'));

// ---------- O VERDE SAI DOS INDICADORES (v5.263) ----------
// Pedido do operador: *"remova a cor verde dos indicadores de tamanho das
// coleções e também dos itens sobre a conclusão das atualizações completas."*
//
// Medido por ELEMENTO DE PROVA, e não pelo desenho: os três estados só existem
// com uma coleção inteira no aparelho, e um fixture sem isso devolveria a cor
// herdada do `<body>` nos três — uma desigualdade que passa sem medir nada (a
// lição da v5.208).
try {
  const verde = await pg.evaluate(() => {
    const cor = (cls, estilo) => {
      const e = document.createElement('span');
      if (cls) e.className = cls;
      if (estilo) e.style.color = estilo;
      document.body.appendChild(e);
      const c = getComputedStyle(e).color;
      const p = getComputedStyle(e).fontWeight;
      e.remove();
      return { c, p };
    };
    const ok = cor(null, 'var(--ok)').c;
    return {
      ok,
      secao: cor('coll-group-count done').c,
      album: cor('coll-opt-estado done').c,
      item: cor('item-detalhe-estado done'),
    };
  });
  checar(verde.secao !== verde.ok && verde.album !== verde.ok && verde.item.c !== verde.ok,
    'nenhum indicador de conclusão da Biblioteca é pintado de VERDE — a fração '
    + 'já diz que está completo, e a cor dizia a mesma coisa outra vez');
  checar(verde.item.p === '600',
    'mas a ÊNFASE fica: "Já no aparelho" continua em negrito, que distingue o '
    + 'estado resolvido do neutro sem gastar a cor', verde.item.p);
} catch (e) {
  checar(false, 'a medição do verde terminou sem exceção (' + (e && e.message) + ')');
}

// ---------- A BUSCA DA BIBLIOTECA E O TECLADO (v5.261) ----------
// Relato do operador: a barra não fica "flutuante/fixa na base, logo acima do
// teclado", e a listagem é "deslocada erroneamente na abertura do teclado",
// ficando "oculta por sair no topo da tela".
//
// Medido antes de mexer, com o teclado de mentira acima: `body` encolhia de 900
// para 520 px (o `--kb` já existia) e a folha da Biblioteca continuava em 900 —
// ela é `position: fixed`, isto é, está FORA do fluxo do body e nunca viu essa
// conta. 380 px de resultados terminavam atrás do teclado.
//
// As três asserções são a regra, nunca o pixel: um número escrito aqui
// reprovaria numa mudança legítima de fonte ou de área segura, e a queixa nunca
// foi sobre um número.
try {
  const geo = await pg.evaluate(async () => {
    const caixa = (s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; };
    const ler = () => ({
      folha: caixa('#hymnSearchPopup .popup-sheet'),
      barra: caixa('#hymnSearchPopup .hymn-search-bar'),
      lista: caixa('#hymnResults'),
      cabec: caixa('#hymnSearchPopup .popup-header'),
    });
    setAppMode('full');
    openHymnSearch();
    await new Promise((r) => setTimeout(r, 350));
    const sem = ler();
    // O teclado do aparelho, com a viewport de layout INALTERADA — e rolada,
    // que é o mecanismo pelo qual o que é fixo sai pelo topo da tela.
    const ALTURA = 380, ROLAGEM = 140;
    window.__teclado(ALTURA, ROLAGEM);
    await new Promise((r) => setTimeout(r, 120));
    const com = ler();
    const visivelTopo = ROLAGEM;
    const visivelBase = window.innerHeight - (ALTURA - ROLAGEM);
    window.__teclado(0);
    await new Promise((r) => setTimeout(r, 60));
    closeHymnSearch();
    return { sem, com, visivelTopo, visivelBase };
  });
  const perto = (a, b) => Math.abs(a - b) <= 1;
  checar(!!geo.sem.barra && !!geo.sem.lista && perto(geo.sem.barra.top, geo.sem.lista.bottom),
    'sem teclado, a barra de busca é o RODAPÉ da folha: ela começa onde a lista termina');
  checar(!!geo.sem.folha && perto(geo.sem.barra.bottom, geo.sem.folha.bottom),
    'e ela encosta na base da folha — nada por baixo dela');
  checar(!!geo.com.folha && perto(geo.com.folha.top, geo.visivelTopo)
    && perto(geo.com.folha.bottom, geo.visivelBase),
    'com o teclado aberto, a folha é a FAIXA VISÍVEL, não a tela inteira');
  checar(!!geo.com.barra && perto(geo.com.barra.bottom, geo.visivelBase),
    'a barra continua na base — agora encostada no teclado, e não atrás dele');
  checar(!!geo.com.cabec && !!geo.com.lista
    && perto(geo.com.cabec.top, geo.visivelTopo) && perto(geo.com.lista.top, geo.com.cabec.bottom),
    'e a listagem NÃO é deslocada: ela começa logo abaixo do cabeçalho, que está no topo do que se vê');
} catch (e) {
  checar(false, 'a medição da busca com teclado terminou sem exceção (' + (e && e.message) + ')');
}

checar(erros.length === 0, 'nenhum erro de console' + (erros.length ? ':\n        ' + erros.join('\n        ') : ''));

await navegador.close();
servidor.close();
console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
