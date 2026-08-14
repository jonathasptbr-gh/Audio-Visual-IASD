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

  const temRegistro = await pg.$eval('#diagBox', (el) => (el.textContent || '').length > 0);
  checar(temRegistro, 'o Registro tem conteúdo');

  const rolaHorizontal = await pg.$eval('#diagBox', (el) => el.scrollWidth > el.clientWidth + 1);
  checar(!rolaHorizontal, 'o Registro não rola na horizontal');

  // O QUE A v5.121 QUEBROU: o clique chamava uma função apagada. Um handler que
  // estoura não muda nada na tela — daí conferir o efeito (o pulso de
  // confirmação), e não só a ausência de erro.
  await pg.evaluate(() => document.getElementById('diagCopy').click());
  await pg.waitForTimeout(300);
  const pulsou = await pg.$eval('#diagCopy', (el) => el.classList.contains('btn-pulso'));
  checar(pulsou, 'o botão de copiar o Registro responde ao toque');

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
    ['songMenuPopup', 'folderPopup'], // o seletor de pastas abre da folha da música
  ];
  // (O par `castPopup`/`mirrorPopup` saiu na v5.196 com a folha de "Ajustes
  // avançados"; o par `mirrorPopup`/`qrPopup` saíra na v5.185 com o leitor de
  // QR. A regra
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
    const sw = document.getElementById('castNetToggle');
    const trilho = document.querySelector('.cast-sw');
    const fundoDoTrilho = () => getComputedStyle(trilho).backgroundColor;
    const antes = sw ? sw.checked : false;
    if (sw) sw.checked = false;
    const trilhoOff = trilho ? fundoDoTrilho() : '';
    if (sw) sw.checked = true;
    const trilhoOn = trilho ? fundoDoTrilho() : '';
    if (sw) sw.checked = antes;
    const r = {
      acao: raio('.cast-acao'), interruptor: raio('.cast-sw-row'), endereco: raio('.cast-addr'),
      acaoFundo: cor('.cast-acao', 'backgroundColor'), acaoTexto: cor('.cast-acao', 'color'),
      trilhoOff, trilhoOn,
      // O valor do token, resolvido pelo navegador — a asserção compara o
      // RENDERIZADO com ele, e não com um literal copiado para cá.
      accentFill: getComputedStyle(document.documentElement).getPropertyValue('--accent-fill').trim(),
      onAccent: getComputedStyle(document.documentElement).getPropertyValue('--on-accent').trim(),
    };
    if (cast) cast.classList.remove('open');
    return r;
  });
  checar(padrao.acao > 0 && padrao.interruptor > 0,
    'o botão e o interruptor da folha de conectar são arredondados como o resto do app'
    + ' (' + padrao.acao + 'px / ' + padrao.interruptor + 'px)');
  checar(padrao.endereco > 0,
    'e o bloco do endereço também (raio ' + padrao.endereco + 'px)');

  // ---- E O ÂMBAR É O DA PALETA, NO PAPEL CERTO (v5.184) -----------------
  //
  // `--accent` e `--accent-fill` têm valores diferentes de propósito: o
  // primeiro é claro (para ser TEXTO sobre fundo escuro) e o segundo é escuro
  // (para RECEBER texto). Trocá-los não quebra nada de forma visível no CI —
  // sai um botão âmbar-claro com texto quase branco por cima, abaixo do piso
  // de contraste, e só um par de olhos no aparelho notaria. Daí a asserção.
  const paraRgb = (hex) => {
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    return m ? 'rgb(' + parseInt(m[1], 16) + ', ' + parseInt(m[2], 16) + ', ' + parseInt(m[3], 16) + ')' : hex;
  };
  checar(padrao.acaoFundo === paraRgb(padrao.accentFill)
    && padrao.acaoTexto === paraRgb(padrao.onAccent),
    'o botão principal da folha é preenchido em --accent-fill com --on-accent por cima'
    + ' (' + padrao.acaoFundo + ' / ' + padrao.acaoTexto + ')');
  checar(padrao.trilhoOn === paraRgb(padrao.accentFill) && padrao.trilhoOff !== padrao.trilhoOn,
    'e o interruptor LIGADO veste o mesmo denim preenchido, desligado não'
    + ' (' + padrao.trilhoOff + ' → ' + padrao.trilhoOn + ')');

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
    const anel = tem ? getComputedStyle(b, '::before').borderTopWidth : '';
    await new Promise((r) => setTimeout(r, 700));
    return { achou: true, tem, visivel, anel, sumiu: !b.classList.contains('btn-eco') };
  });
  checar(eco.achou && eco.tem, 'um toque no transporte responde na hora (classe `btn-eco`)');
  checar(eco.visivel === 'visible',
    'e o eco NÃO esconde o ícone do botão — ele é anel, não ✓', eco.visivel);
  checar(!!eco.anel && eco.anel !== '0px', 'o anel do eco é de fato desenhado', eco.anel);
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
      return {
        bg: v('--bg'), texto: v('--text'), accent: v('--accent'), fill: v('--accent-fill'),
        palco: v('--stage-bg') + '|' + v('--stage-text') + '|' + v('--wallpaper')
          + '|' + v('--lyrics-frame-bg'),
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

checar(erros.length === 0, 'nenhum erro de console' + (erros.length ? ':\n        ' + erros.join('\n        ') : ''));

await navegador.close();
servidor.close();
console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
