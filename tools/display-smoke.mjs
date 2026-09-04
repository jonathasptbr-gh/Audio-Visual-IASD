// Fumaça do DISPLAY: abre `/web/display/` num Chromium de verdade, deixa o
// telão se anunciar e conversa com ele pelo barramento de comandos.
//
// ## Por que ele existe
//
// Até agora NENHUM arquivo de `tools/` carregava `/display/`. A fumaça
// (`smoke.mjs`) abre o Controle; `stage-fade` monta o palco à mão a partir de
// `shared/stage.js`; os demais carregam módulos isolados. Ou seja: a metade do
// sistema que roda NA FRENTE DA CONGREGAÇÃO era a metade que a CI nunca
// executou — e é a que menos rede de segurança tem, porque o watchdog do OTA
// também não a valida (quem confirma o bundle é o Controle, por decisão
// documentada). Um erro de inicialização no `display.js` passava por
// `node --check`, passava pela fumaça do Controle, e aparecia no telão.
//
// ## E ele trava o ENDEREÇAMENTO do reenvio de cena
//
// O barramento é broadcast. Até a v5.139 o `display-ready` não tinha remetente
// e o Controle respondia `resendSceneToDisplay()` para todo mundo: qualquer
// segunda instância de `/display/` que abrisse — uma aba de depuração, uma
// restaurada pelo navegador — fazia a TV rodar um `load` inteiro (fade de
// saída, releitura da mídia, re-seek, fade de entrada) na frente da
// congregação, por um evento que não era dela. Agora o telão assina o pedido
// (`__de`) e ignora comando endereçado a outro (`__para`).
//
// As três asserções abaixo são exatamente as três metades dessa regra: o
// pedido é assinado, o que é dos outros não entra, e o que não tem endereço
// continua valendo para todos (é assim que todo comando de operação viaja, e é
// o que mantém um Controle com bundle antigo funcionando).
//
// ## E ele prova a DECISÃO DE DENSIDADE do espelho de pixels, sem aparelho
//
// Ver docs/ESPELHO-DE-PIXELS.md §3.2. O espelho renderiza este mesmo
// `/display/` num `VirtualDisplay` de 1280×720, e o que a congregação compara
// não é resolução: é o VIEWPORT CSS, que é `pixels / (densityDpi / 160)`.
//
// Uma TV Miracast NÃO reporta 160 dpi. O AOSP calcula
// `densityDpi = min(w,h) × DENSITY_XHIGH / 1080` para display externo
// (`DisplayDeviceInfo.setAssumedDensityForExternalDisplay`), logo uma TV 1080p
// reporta 320 dpi e o telão que a congregação vê HOJE é desenhado em
// **960×540 CSS** — não em 1920×1080. Se o espelho nascesse a 160 dpi ele
// desenharia em 1280×720 CSS: outra quebra de estrofe, outro tamanho relativo
// de letra, outro enquadramento. Deixaria de ser espelho, e ninguém veria a
// diferença olhando o celular.
//
// Daí a densidade DERIVADA do alvo: `dpi = 1280 × 160 / 960 = 213`, e o
// viewport que sai dela é `1280 × 160 / 213 = 961,5` px CSS. Não é identidade
// de pixel — 213,33 não é inteiro e nunca vai ser —, é o mesmo viewport com
// meio ponto percentual de folga.
//
// Este arquivo rodava no default do Playwright (1280×720) POR ACIDENTE, por um
// `newContext()` sem viewport: um upgrade da biblioteca apagaria a garantia em
// silêncio. Fixado em 961×540, ele passa a MEDIR a decisão — e a última
// asserção compara com uma segunda janela em 960×540, que é o telão de
// verdade. É o único item das seções técnicas daquele documento que se prova
// sem aparelho nenhum.
//
//   node tools/display-smoke.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { TIPOS, servirEstatico, abrirNavegador, checar, falhas } from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');

// O ESPIÃO é uma página vazia servida pelo próprio teste, no MESMO origin do
// bundle — é o que dá a ele um BroadcastChannel que o telão enxerga. Ele faz o
// papel do Controle sem carregar o Controle: o que se testa aqui é o Display.
const ESPIAO = '/__espiao.html';

// Os dois viewports, EXPLÍCITOS (ver o cabeçalho). Nunca deixar o Playwright
// escolher: o default dele é 1280×720, que é justamente o valor errado — o
// viewport que o espelho teria se alguém fixasse a densidade em 160 dpi.
const VP_ESPELHO = { width: 961, height: 540 }; // 1280 px a 213 dpi
const VP_TELAO = { width: 960, height: 540 };   // 1920 px a 320 dpi (a TV real)

// Piso de legibilidade do texto projetado. `.text-content.mode-message
// .text-main` é `7.4cqmin`, e o container de tamanho é a camada de texto
// inteira: a 540 px CSS de altura isso dá ~40 px. O piso é folgado de
// propósito — ele não existe para carimbar 40 px, e sim para pegar o dia em
// que a máquina de Container Queries parar de resolver (uma `container-type`
// perdida num refactor derruba a fonte para o default de 16 px) ou o viewport
// colapsar. Uma mensagem a menos de 5% da altura da tela não se lê do fundo do
// salão, que é o único consumidor deste número.
const PISO_FONTE_PX = 28;

const servidor = servirEstatico(RAIZ, (req, res) => {
  if (new URL(req.url, 'http://x').pathname !== ESPIAO) return false;
  res.writeHead(200, { 'Content-Type': TIPOS['.html'] });
  res.end('<!doctype html><meta charset="utf-8"><title>espião</title>');
  return true;
});

await new Promise((r) => servidor.listen(0, r));
const base = 'http://127.0.0.1:' + servidor.address().port;

// `PW_CHROMIUM` aponta o binário quando ele não está onde o Playwright o
// procura (é o caso do ambiente de desenvolvimento deste projeto).
const navegador = await abrirNavegador();
// UM contexto para as duas páginas: BroadcastChannel só atravessa páginas do
// mesmo origin no mesmo perfil — que é exatamente a premissa da arquitetura de
// dois WebViews, e por isso a montagem do teste espelha a do app.
//
// E com VIEWPORT EXPLÍCITO — ver o cabeçalho. O `newContext()` pelado herdava
// 1280×720 do Playwright, que é o valor que a decisão de densidade do espelho
// existe para EVITAR.
const ctx = await navegador.newContext({ viewport: VP_ESPELHO });
await semRedeExterna(ctx);

const erros = [];
const telao = await ctx.newPage();
// Erro de rede de TERCEIRO não conta, e isto não é indulgência: no modo
// navegador o Display PREFETCHA a IFrame API do YouTube de propósito
// (`if (!window.__NATIVE__) loadYtApi()`), então um runner sem internet — ou
// atrás de um proxy — sempre produziria um "Failed to load resource" que não
// diz nada sobre o bundle. Contar isso faria o teste falhar por infraestrutura,
// que é o modo mais rápido de um teste virar ruído e ser ignorado. O que conta
// é o que vem do NOSSO servidor: erro de script, de CSS, de asset do bundle.
telao.on('console', (m) => {
  if (m.type() !== 'error') return;
  const url = (m.location() && m.location().url) || '';
  if (url && !url.startsWith(base)) return;
  erros.push('console: ' + m.text());
});
// Exceção de página não tem essa ressalva: ela é sempre código nosso.
telao.on('pageerror', (e) => erros.push('exceção: ' + e.message));

const espiao = await ctx.newPage();
// O espião entra ANTES do telão e já fica ouvindo: o `display-ready` é enviado
// no fim do `init()`, e quem chegar depois dele perde o único anúncio que o
// telão faz.
await espiao.goto(base + ESPIAO);
await espiao.evaluate(() => {
  window.__vistos = [];
  window.__bc = new BroadcastChannel('av-iasd');
  window.__bc.addEventListener('message', (e) => window.__vistos.push(e.data));
  window.__mandar = (cmd) => window.__bc.postMessage(cmd);
});

await telao.goto(base + '/display/');

// 1. O TELÃO SOBE. Sem isto nada mais faz sentido — e é a asserção que
//    nenhum teste do repositório fazia.
await telao.waitForFunction(() => !!window.AVDB && !!document.getElementById('textMain'), null, { timeout: 15000 })
  .catch(() => {});
const subiu = await telao.evaluate(() => !!window.AVDB && !!window.createStage);
checar(subiu, 'o Display carrega e publica AVDB + createStage');

// A COBERTURA é medida AQUI, no boot, e conferida lá embaixo (§7): neste
// instante a cortina é o que está em cena, e o primeiro comando de texto a
// abre. Depois dele o `#wallpaper` some e não haveria mais o que medir.
//
// O `#video` é o caso oposto — ele nasce `hidden` e só aparece com mídia
// carregada, o que exigiria semear o IndexedDB. Então a medição o revela por
// um instante e devolve o estado: o que se pergunta é da FOLHA DE ESTILO
// ("quando esta camada aparecer, ela cobre a tela?"), não do `stage.js`.
const cobertura = await telao.evaluate(() => {
  const caixa = (el) => { const r = el.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; };
  const video = document.getElementById('video');
  const antes = video.hidden;
  video.hidden = false;
  const vid = caixa(video);
  video.hidden = antes;
  return { vw: innerWidth, vh: innerHeight, wallpaper: caixa(document.getElementById('wallpaper')), video: vid };
});

// 2. O PEDIDO É ASSINADO.
await espiao.waitForFunction(
  () => window.__vistos.some((c) => c && c.type === 'display-ready'),
  null, { timeout: 15000 },
).catch(() => {});
const pronto = await espiao.evaluate(() => window.__vistos.find((c) => c && c.type === 'display-ready') || null);
checar(!!pronto, 'o Display anuncia display-ready no barramento');
checar(!!pronto && typeof pronto.__de === 'string' && pronto.__de.length > 1,
  'e o anúncio vem ASSINADO (__de) — é o que permite endereçar o reenvio da cena',
  JSON.stringify(pronto));

const id = (pronto && pronto.__de) || 'sem-id';

// 3. O QUE É DOS OUTROS NÃO ENTRA. Esta é a asserção que trava a correção: sem
//    a guarda do `__para`, o texto de outra instância aparece no telão — que é
//    o defeito, com o sinal trocado (lá o telão obedecia um `load` que não era
//    dele).
await espiao.evaluate(() => window.__mandar({
  type: 'text', mode: 'message', main: 'CENA DE OUTRA TELA', sub: '', view: 'visual', __para: 'outra-instancia',
}));
await telao.waitForTimeout(400);
const alheio = await telao.evaluate(() => document.getElementById('textMain').textContent);
checar(alheio !== 'CENA DE OUTRA TELA',
  'comando endereçado a OUTRA instância é ignorado', JSON.stringify(alheio));

// 4. O QUE É DELE ENTRA.
await espiao.evaluate((para) => window.__mandar({
  type: 'text', mode: 'message', main: 'ESTA CENA E MINHA', sub: '', view: 'visual', __para: para,
}), id);
await telao.waitForFunction(
  () => document.getElementById('textMain').textContent === 'ESTA CENA E MINHA',
  null, { timeout: 4000 },
).catch(() => {});
const meu = await telao.evaluate(() => document.getElementById('textMain').textContent);
checar(meu === 'ESTA CENA E MINHA', 'comando endereçado a ELE é aplicado', JSON.stringify(meu));

// 5. E O SEM ENDEREÇO CONTINUA VALENDO PARA TODOS — todo comando de operação
//    viaja assim, e é o que mantém um Controle de bundle antigo funcionando.
await espiao.evaluate(() => window.__mandar({
  type: 'text', mode: 'message', main: 'PARA TODOS', sub: '', view: 'visual',
}));
await telao.waitForFunction(
  () => document.getElementById('textMain').textContent === 'PARA TODOS',
  null, { timeout: 4000 },
).catch(() => {});
const todos = await telao.evaluate(() => document.getElementById('textMain').textContent);
checar(todos === 'PARA TODOS', 'comando SEM endereço vale para todos (é o caso de sempre)', JSON.stringify(todos));

// 5-A. O `media-clear` NÃO DERRUBA A CAMADA DE TEXTO (v5.178).
//
//    É o lado do TELÃO da mesma regra que o `cena.test.mjs` afirma do lado do
//    Controle, e ele precisa de um caso próprio porque a decisão mora AQUI: o
//    Display é quem sabe se há texto ativo, e o ramo do comando tem de vir antes
//    do bloco de `textActive` — lá dentro, `clear` é justamente o que chama
//    `hideText`. Cair no fluxo comum não daria erro nenhum: o comando
//    atravessaria até um `stage.handle` que não o conhece, e o cronômetro sairia
//    do ar sem uma linha em lugar nenhum que o explicasse.
//
//    A mensagem "PARA TODOS" do passo anterior continua em cena.
await espiao.evaluate(() => window.__mandar({ type: 'media-clear' }));
await telao.waitForTimeout(500);
const textoDepois = await telao.evaluate(() => ({
  txt: document.getElementById('textMain').textContent,
  visivel: !document.getElementById('text').hidden,
}));
checar(textoDepois.txt === 'PARA TODOS' && textoDepois.visivel,
  'o `media-clear` tira a mídia e DEIXA a Camada de Texto no ar',
  JSON.stringify(textoDepois));

//    E o `clear` continua sendo o ponto final: ele leva as duas.
await espiao.evaluate(() => window.__mandar({ type: 'clear' }));
await telao.waitForFunction(
  () => document.getElementById('text').hidden, null, { timeout: 4000 },
).catch(() => {});
const depoisDoClear = await telao.evaluate(() => document.getElementById('text').hidden);
checar(depoisDoClear, 'e o `clear` segue encerrando a CENA INTEIRA — ele não virou por camada');

// 5-B. E O TELÃO VAZIO DIZ QUE ESTÁ VAZIO (v5.179).
//
//    O `clear` esmaece por ~0,6 s antes de sair de cena, e durante a rampa o
//    `<video>` CONTINUA tocando (ela é de volume, não de pausa): cada
//    `display-status` do fade contava, com `playing: true` e o tempo antigo, uma
//    cena que o operador acabara de encerrar. No Controle isso repintava a barra
//    e o ícone que o Parar tinha acabado de zerar — o "o Parar só funciona no
//    segundo toque" —, e na NOTIFICAÇÃO era pior, porque ali não há segundo
//    toque: o `snoopDisplayStatus` do Kotlin lê este mesmo status de passagem.
//
//    A guarda cala o fade e emite UM status final com o stage já limpo. É esse
//    último que este caso mede: sem ele, o derradeiro a viajar seria o do começo
//    do fade, dizendo "tocando".
//    A janela do fade não é observável daqui — sem mídia de verdade em cena o
//    `clear` resolve num piscar, e com mídia seria preciso um vídeo tocando num
//    Chromium de CI. Então o caso exercita o MECANISMO, com uma promise que ele
//    controla: enquanto ela não resolver, o telão está saindo de cena, e um
//    `sendStatus()` (que é literalmente o que o `onTime` do stage chama a cada
//    quadro) não pode produzir mensagem nenhuma.
//    O CASO É MEDIDO EM DUAS METADES SEPARADAS, e não numa contagem no fim. A
//    primeira versão dele armava a guarda, resolvia, e afirmava "viajou UM
//    status" — o que supõe que nada mais estivesse em voo. Mas o `clear` do
//    passo anterior tem um fade de ~0,6 s e um `aoSairDeCena` próprio, cujo
//    `then` emite o status final DEPOIS de o caso ter zerado o espião: chegavam
//    dois, os dois corretos (palco vazio, `playing: false`), e o teste reprovava
//    um app que estava certo. Medir cada metade no seu instante diz também QUAL
//    delas quebrou, que uma contagem no fim nunca diz.
//
//    A espera por `saindoDeCena === 0` é a outra metade da correção: sem ela o
//    caso começaria a contar com o fade anterior ainda aberto.
await telao.waitForFunction(() => saindoDeCena === 0, null, { timeout: 4000 }).catch(() => {});
await espiao.evaluate(() => { window.__vistos.length = 0; });
const mecanismo = await telao.evaluate(() => {
  if (typeof aoSairDeCena !== 'function') return 'sem a guarda';
  window.__soltarFade = null;
  aoSairDeCena(new Promise((r) => { window.__soltarFade = r; }));
  sendStatus();                       // o quadro do meio do fade
  return 'ok';
});
await new Promise((r) => setTimeout(r, 200));
const durante = await espiao.evaluate(
  () => window.__vistos.filter((c) => c && c.type === 'display-status'),
);
await telao.evaluate(() => window.__soltarFade());   // o fade acabou: o palco está limpo
await new Promise((r) => setTimeout(r, 200));
const doFade = await espiao.evaluate(
  () => window.__vistos.filter((c) => c && c.type === 'display-status'),
);
checar(mecanismo === 'ok', 'o telão sabe dizer que está SAINDO de cena (`aoSairDeCena`)', mecanismo);
checar(durante.length === 0,
  'o `sendStatus` do meio do fade NÃO VIAJA — era ele que dizia "tocando" sobre '
  + 'uma cena que o operador acabara de encerrar', JSON.stringify(durante));
checar(doFade.length === 1 && !doFade[0].mediaId && !doFade[0].playing,
  'e no fim sai UM status, o do palco VAZIO',
  JSON.stringify(doFade));

// 5-C. O CARTÃO DE CAPA DO LOUVOR (v5.218) — e a cor dele, MEDIDA.
//
//    A capa era uma linha só ("147. NOME DO HINO") pintada com `--brand`, um
//    token de TEMA. No telão isso dava um azul claro; na preview do Controle
//    com o tema claro ligado, o MESMO seletor dava o denim escuro sobre o preto
//    do palco — 2,73:1, o relato do operador ("os títulos estão em azul,
//    ilegíveis no fundo escuro").
//
//    São duas perguntas, e as duas precisam de oráculo porque nenhuma se vê
//    lendo o código: **o cartão tem as três peças?** e **o texto se lê contra o
//    preto?** A segunda é a primeira medição de contraste do repositório — o
//    `CLAUDE.md` diz, desde a v5.47, que não havia nenhuma. Ela cabe aqui e não
//    no app inteiro: no palco o piso não é "acessibilidade de tela a 30 cm", é
//    um projetor visto do fundo de um salão.
//
//    `showLyrics` é chamada direto, como o `sendStatus` acima: montar um `load`
//    de verdade exigiria mídia no IndexedDB, e o que se quer provar é o
//    DESENHO da capa, não o caminho do comando (esse o `cena.test.mjs` cobre).
// O ALFA É COMPOSTO SOBRE O PRETO DO PALCO, nunca ignorado: `--stage-text-dim`
// é branco a 72%, e lê-lo como branco opaco daria 21:1 para uma cor que na tela
// rende 13:1. Uma medição que arredonda a favor do código não é medição.
const lum = (c) => {
  const n = c.match(/[\d.]+/g).map(Number);
  const a = n.length > 3 ? n[3] : 1;
  const [r, g, b] = n.slice(0, 3).map((x) => {
    const v = (x * a) / 255;          // sobre #000: a composição é o próprio alfa
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const capa = await telao.evaluate(() => {
  showLyrics({
    hymnName: 'Ó Adorai o Senhor', hymnTrack: 147, hymnAlbum: 'Hinário Adventista',
    lyrics: [{ time: 0, cover: true }, { time: 5, text: 'Primeira estrofe', auxText: 'Refrão' }],
  });
  const el = (id) => document.getElementById(id);
  const ler = () => ({
    num: el('lyricsNum').textContent, numOculto: el('lyricsNum').hidden,
    titulo: el('lyricsLine').textContent,
    aux: el('lyricsAux').textContent, auxOculto: el('lyricsAux').hidden,
    corTitulo: getComputedStyle(el('lyricsLine')).color,
    corNum: getComputedStyle(el('lyricsNum')).color,
    corAux: getComputedStyle(el('lyricsAux')).color,
    fundo: getComputedStyle(document.documentElement).getPropertyValue('--stage-bg').trim(),
  });
  const naCapa = ler();
  renderLyricSlide(1);              // a estrofe seguinte
  const naEstrofe = ler();
  hideLyrics(false);                // não deixa a camada em cena para as medidas abaixo
  return { naCapa, naEstrofe };
});
checar(capa.naCapa.num === '147' && !capa.naCapa.numOculto,
  'a capa mostra o NÚMERO do hino como peça própria', JSON.stringify(capa.naCapa));
checar(capa.naCapa.titulo === 'Ó Adorai o Senhor',
  'e o título fica sozinho na linha dele — sem o "147. " colado na frente',
  capa.naCapa.titulo);
checar(capa.naCapa.aux === 'Hinário Adventista' && !capa.naCapa.auxOculto,
  'e a linha de baixo diz de onde a música veio (o álbum)', capa.naCapa.aux);
checar(capa.naEstrofe.numOculto && capa.naEstrofe.titulo === 'Primeira estrofe'
  && capa.naEstrofe.aux === 'Refrão',
  'na estrofe seguinte o número sai de cena e a linha auxiliar volta a ser a seção',
  JSON.stringify(capa.naEstrofe));
// O piso é ALTO de propósito: isto é texto branco sobre preto (21:1) e o que se
// quer travar é a REGRESSÃO — qualquer cor de UI que volte para cá reprova bem
// antes de chegar aos 2,73:1 que o defeito produzia.
const cTitulo = contraste(capa.naCapa.corTitulo, 'rgb(0,0,0)');
const cNum = contraste(capa.naCapa.corNum, 'rgb(0,0,0)');
const cAux = contraste(capa.naCapa.corAux, 'rgb(0,0,0)');
checar(cTitulo >= 15, 'o TÍTULO da capa é o branco da projeção, não uma cor de UI ('
  + cTitulo.toFixed(2) + ':1 contra o preto)');
// O NÚMERO É BRANCO COMO O TÍTULO (v5.221). Ele nasceu no acento — 9,75:1, que
// passa em qualquer régua de contraste — e o operador o leu como "muito
// discreto no fundo escuro": num telão o que decide é cor MAIS corpo, e ele
// tinha o menor corpo da capa somado à única cor não-branca da tela. O piso
// alto é o que impede uma cor de identidade de voltar para cá.
checar(cNum >= 15 && capa.naCapa.corNum === capa.naCapa.corTitulo,
  'o NÚMERO do hino é o mesmo branco do título — num hinário é ele que se procura ('
  + cNum.toFixed(2) + ':1)');
checar(cAux >= 7,
  'e o álbum se lê do fundo do salão (' + cAux.toFixed(2) + ':1)');
// A base das três medições acima é o preto do palco. Afirmá-la em vez de
// supô-la: o dia em que `--stage-bg` deixar de ser #000, os números mudam e
// esta linha é que diz por quê.
checar(capa.naCapa.fundo === '#000',
  'e a base da medição é o preto do palco (--stage-bg: ' + capa.naCapa.fundo + ')');

//    A mensagem volta para os passos de medida abaixo (é a única forma de o
//    `#textMain` ter tamanho).
await espiao.evaluate(() => window.__mandar({
  type: 'text', mode: 'message', main: 'PARA TODOS', sub: '', view: 'visual',
}));
await telao.waitForFunction(
  () => document.getElementById('textMain').textContent === 'PARA TODOS'
    && !document.getElementById('text').hidden,
  null, { timeout: 4000 },
).catch(() => {});

// 6. O VIEWPORT DO ESPELHO — a decisão de densidade, medida.
//
//    Com a mensagem de cima ainda em cena (é a única forma de o `#textMain`
//    ter tamanho), as quatro perguntas do §7.1 da spec: a janela é a que se
//    pediu, as camadas cobrem a tela, nada estoura, e a letra não encolheu.
checar(cobertura.vw === VP_ESPELHO.width && cobertura.vh === VP_ESPELHO.height,
  'a janela é a do ESPELHO (961×540 CSS) — explícita, não o default do Playwright',
  cobertura.vw + '×' + cobertura.vh);

const cobre = (c) => c[0] === 0 && c[1] === 0 && c[2] === cobertura.vw && c[3] === cobertura.vh;
checar(cobre(cobertura.wallpaper),
  'a cortina (#wallpaper) cobre a tela inteira — é ela que o espelho transmite entre as cenas',
  JSON.stringify(cobertura.wallpaper));
checar(cobre(cobertura.video),
  'e a camada de vídeo (#video) também — sem isso o espelho serviria uma tarja preta em volta',
  JSON.stringify(cobertura.video));

// NADA ESTOURA. As camadas são `position: fixed` e o `<body>` é
// `overflow: hidden`, então `scrollWidth` mentiria "cabe" para qualquer coisa:
// a pergunta tem de ser feita elemento a elemento, pelo retângulo de cada um.
// Quem estoura num viewport 25% mais estreito que o default é justamente o que
// foi desenhado em px fixo sem ninguém perceber.
const estouraram = await telao.evaluate(() => {
  const fora = [];
  for (const el of document.body.querySelectorAll('*')) {
    const b = el.getBoundingClientRect();
    if (b.width === 0 && b.height === 0) continue; // camada oculta: nada a medir
    // Meio pixel de folga: subpixel de layout, não estouro.
    if (b.right > innerWidth + 0.5 || b.bottom > innerHeight + 0.5 || b.left < -0.5 || b.top < -0.5) {
      fora.push((el.id || el.className || el.tagName) + ' [' +
        [b.left, b.top, b.right, b.bottom].map((n) => Math.round(n)).join(',') + ']');
    }
  }
  return fora;
});
checar(estouraram.length === 0,
  'nenhum elemento estoura o viewport do espelho', estouraram.join(' · '));

const fonteEspelho = await telao.evaluate(
  () => parseFloat(getComputedStyle(document.getElementById('textMain')).fontSize),
);
checar(fonteEspelho >= PISO_FONTE_PX,
  'a mensagem projetada continua acima do piso de legibilidade (' + PISO_FONTE_PX + ' px)',
  fonteEspelho + 'px');

// 7. E A PROVA propriamente dita: o MESMO layout no viewport do TELÃO DE
//    VERDADE (960×540 CSS, que é o que uma TV 1080p a 320 dpi entrega). Se os
//    dois números baterem, o espelho não é uma segunda diagramação — é o
//    telão. É esta linha que dispensa o aparelho.
//
//    Contexto SEPARADO de propósito: viewport é propriedade do contexto, e um
//    perfil próprio ainda isola o BroadcastChannel desta página do espião lá
//    de cima (ela manda o comando para si mesma).
const ctxTv = await navegador.newContext({ viewport: VP_TELAO });
await semRedeExterna(ctxTv);
const tv = await ctxTv.newPage();
await tv.goto(base + '/display/');
await tv.waitForFunction(() => !!window.AVDB, null, { timeout: 15000 }).catch(() => {});
await tv.evaluate(() => new BroadcastChannel('av-iasd').postMessage({
  type: 'text', mode: 'message', main: 'PARA TODOS', sub: '', view: 'visual',
}));
await tv.waitForFunction(
  () => document.getElementById('textMain').textContent === 'PARA TODOS',
  null, { timeout: 4000 },
).catch(() => {});
const fonteTelao = await tv.evaluate(
  () => parseFloat(getComputedStyle(document.getElementById('textMain')).fontSize),
);
checar(fonteTelao > 0 && fonteEspelho === fonteTelao,
  'a letra do espelho (961×540) tem EXATAMENTE o tamanho da do telão (960×540) — a densidade 213 dpi está certa',
  fonteEspelho + 'px vs ' + fonteTelao + 'px');

// 7-A-bis. O FIM NATURAL NÃO É UMA "PAUSA ESPONTÂNEA".
//
//    O Registro do telão tem UMA linha reservada ao caso grave — "alguém tirou
//    a projeção do ar sem pedir" — e ela é lida A DISTÂNCIA, por quem não tem
//    como conferir no aparelho. O fim de cada faixa a produzia: a especificação
//    manda o elemento levantar `ended` e disparar `pause` ANTES de `ended`, e
//    `pausaComandada` não é armado por fim natural porque não houve comando.
//    Um louvor por culto bastava para afogar o sinal no ruído.
//
//    AS DUAS METADES, e a primeira é o HAZARD: sem a bandeira de fim a MESMA
//    pausa tem de sair como espontânea. Sem ela, a segunda provaria apenas que
//    a função concorda consigo mesma.
//
//    O diário é lido pelo contrato que já existe (`diag-ask` → `diag-dump`),
//    nunca por um global de teste, e a espera é pela CHEGADA da resposta — não
//    por um prazo, que mediria o runner.
try {
  const carimbos = await telao.evaluate(async () => {
    const bc = new BroadcastChannel('av-iasd');
    const pedirDiario = () => new Promise((resolve) => {
      const ouvir = (ev) => {
        const m = ev && ev.data;
        if (!m || m.type !== 'diag-dump') return;
        bc.removeEventListener('message', ouvir);
        resolve(Array.isArray(m.linhas) ? m.linhas : []);
      };
      bc.addEventListener('message', ouvir);
      bc.postMessage({ type: 'diag-ask' });
    });
    const v = document.querySelector('video');
    // `ended` é getter do protótipo; defini-lo na INSTÂNCIA o sombreia, que é
    // a única forma de forjar um fim de faixa sem tocar 3 minutos de áudio.
    const forjar = (fim) => {
      Object.defineProperty(v, 'ended', { get: () => fim, configurable: true });
      v.dispatchEvent(new Event('pause'));
    };
    forjar(false);
    const semFim = await pedirDiario();
    forjar(true);
    const comFim = await pedirDiario();
    bc.close();
    const ultimo = (ls) => (ls.length ? String(ls[ls.length - 1].ev || '') : '(vazio)');
    return { semFim: ultimo(semFim), comFim: ultimo(comFim) };
  });
  checar(carimbos.semFim === 'PAUSA ESPONTÂNEA',
    'uma pausa que NÃO é fim de faixa continua sendo carimbada espontânea (o hazard)',
    JSON.stringify(carimbos));
  checar(carimbos.comFim === 'fim natural',
    'e o FIM NATURAL deixa de gastar a linha reservada ao caso grave',
    JSON.stringify(carimbos));
} catch (e) {
  checar(false, 'o carimbo do fim natural pôde ser medido', String(e && e.message));
}

// 7-A-ter. A RETOMADA DEPOIS DE UM ROUBO DE FOCO DE ÁUDIO.
//
//    MEDIDO EM APARELHO: tocar outra mídia no celular PAUSA a do telão, e na
//    perda permanente o Chromium abandona o foco e não volta sozinho — o louvor
//    fica parado até alguém tocar ▶. A retomada automatiza o `play()` que o
//    operador daria à mão.
//
//    O QUE ESTE ORÁCULO TRAVA são as GUARDAS, não o `play()`. Elas são a
//    entrega: uma retomada sem elas religa a faixa que acabou (o `pause` do fim
//    natural chega antes do `ended`) ENQUANTO a playlist avança por baixo —
//    dois itens no ar, na frente da congregação. E desfaz o ⏸ do operador 1,5 s
//    depois, por um timer que ninguém vê.
//
//    A linha "retomada 1/3" é escrita no AGENDAMENTO, não no disparo: dá para
//    afirmar o fato sem esperar a cadência de 1,5 s do app.
try {
  const ret = await telao.evaluate(async () => {
    const bc = new BroadcastChannel('av-iasd');
    const pedirDiario = () => new Promise((resolve) => {
      const ouvir = (ev) => {
        const m = ev && ev.data;
        if (!m || m.type !== 'diag-dump') return;
        bc.removeEventListener('message', ouvir);
        resolve(m);
      };
      bc.addEventListener('message', ouvir);
      bc.postMessage({ type: 'diag-ask' });
    });
    const linhasRet = (d) => (d.linhas || []).filter((l) => /^retomada em /.test(String(l.ev || '')));
    const quantas = (d) => linhasRet(d).length;
    const ultimaRet = (d) => { const ls = linhasRet(d); return ls.length ? String(ls[ls.length - 1].ev) : ''; };
    const contadores = (d) => (d.retomada || { espontaneas: 0, recuperadas: 0, desistidas: 0 });
    const v = document.querySelector('video');
    // `ended` e `paused` são getters do PROTÓTIPO; defini-los na INSTÂNCIA os
    // sombreia, e é a única forma de forjar um fim de faixa ou um "voltou a
    // tocar" sem áudio de verdade. As duas são `configurable`, e o bloco as
    // devolve ao protótipo no fim — deixá-las cravadas envenena os blocos
    // seguintes, e foi assim que o 7-A-bis deixou `ended` preso em TRUE.
    const forjar = (fim) => {
      Object.defineProperty(v, 'ended', { get: () => fim, configurable: true });
      v.dispatchEvent(new Event('pause'));
    };
    const esperar = (ms) => new Promise((f) => setTimeout(f, ms));
    // O contador de `play()` é instalado UMA vez e medido por DELTA.
    window.__plays = 0;
    const origPlay = v.play.bind(v);
    v.play = function () { window.__plays++; try { return origPlay(); } catch (e) { return undefined; } };
    const cena = async () => {
      bc.postMessage({ type: 'load', mediaId: m.id, view: 'visual', muted: true, volume: 0 });
      // A ESPERA TEM DE PASSAR DA JANELA DO `pausaComandada` (fade de 600 ms +
      // 400), senão a pausa forjada sai carimbada "comando" e o oráculo mede a
      // própria montagem em vez do app.
      await esperar(1400);
      v.dispatchEvent(new Event('play'));        // marca `jaTocou`
    };

    const m = await AVDB.addMedia(new Blob([new Uint8Array(64)], { type: 'audio/mpeg' }),
      { name: 'Louvor', type: 'audio/mpeg', kind: 'audio' });
    const r = {};

    // (a) CENA TOCANDO + pausa que ninguém pediu => agenda, e CHEGA A TOCAR.
    await cena();
    const d0 = await pedirDiario();
    const base = quantas(d0);
    const c0 = contadores(d0);
    const p0 = window.__plays;
    forjar(false);
    r.aposEspontanea = quantas(await pedirDiario()) - base;
    await esperar(2400);                        // além de RETOM_ESPERAS[0]
    r.plays = window.__plays - p0;
    // O CENSO É POR EPISÓDIO: uma pausa forjada tem de somar exatamente 1.
    r.censoDelta = contadores(await pedirDiario()).espontaneas - c0.espontaneas;

    // (b) O FIM NATURAL não retoma — a guarda que impede religar a faixa que
    //     acabou com a playlist avançando por baixo.
    await cena();
    const base2 = quantas(await pedirDiario());
    forjar(true);
    r.aposFimNatural = quantas(await pedirDiario()) - base2;

    // (c) O ⏸ DO OPERADOR VENCE UM TIMER JÁ AGENDADO.
    await cena();
    const base3 = quantas(await pedirDiario());
    forjar(false);
    r.agendouAntesDoComando = quantas(await pedirDiario()) - base3;
    const p3 = window.__plays;
    bc.postMessage({ type: 'pause' });
    await esperar(2400);
    r.playsAposComando = window.__plays - p3;

    // (e) O CRÉDITO VOLTA quando o Chromium recupera o foco SOZINHO.
    //
    //     É o único ramo de recusa TARDIA (na hora do disparo, não do
    //     agendamento) e a única linha do arquivo capaz de devolver crédito.
    //     Sem ele, uma perda transitória curta gastava uma tentativa e o roubo
    //     seguinte começava com 4 s de silêncio em vez de 1,5 s.
    await cena();
    forjar(false);                              // agenda com 1,5 s
    Object.defineProperty(v, 'paused', { get: () => false, configurable: true });
    await esperar(2400);                        // o timer dispara e RECUSA
    delete v.paused;                            // devolve o getter do protótipo
    const dq = await pedirDiario();
    r.dispensou = (dq.linhas || []).some((l) => /^retomada dispensada: já voltou a tocar/.test(String(l.ev || '')));
    forjar(false);                              // o roubo seguinte
    r.esperaDepoisDoCredito = ultimaRet(await pedirDiario());

    // (d) O TETO, O FREIO E O SILÊNCIO DEFINITIVO — o recurso que o lote chama
    //     de "O TETO É O RECURSO", e que até aqui nenhuma máquina executava.
    //     SEM `load` no meio: ele zera o crédito e o teto nunca seria alcançado.
    await cena();
    const cD = contadores(await pedirDiario());
    const pD = window.__plays;
    forjar(false); await esperar(2400);         // tentativa 1 (1,5 s)
    forjar(false); await esperar(4900);         // tentativa 2 (4 s)
    forjar(false); await esperar(10900);        // tentativa 3 (10 s)
    r.playsNoTeto = window.__plays - pD;        // exatamente 3
    forjar(false);                              // a quarta: DESISTE
    // O SILÊNCIO É DEFINITIVO: mais uma pausa não produz `play()` nenhum. É
    // isto que separa um TETO de um simples atraso.
    const pFim = window.__plays;
    forjar(false);
    await esperar(2400);
    r.playsDepoisDeDesistir = window.__plays - pFim;

    const fimD = await pedirDiario();
    r.contadores = contadores(fimD);
    // MEDIDO NO FIM, depois da pausa extra: `retomDesistiu` é o que impede a
    // desistência de ser contada DUAS vezes — o teto sozinho já barra o
    // `play()`, então medir antes da pausa extra não exercitava aquela guarda.
    r.desistiuDelta = contadores(fimD).desistidas - cD.desistidas;
    // Devolve o elemento ao estado do protótipo — um bloco que envenena o
    // seguinte é a mesma família da tautologia que este arquivo já corrigiu.
    delete v.ended;
    delete v.play;
    bc.close();
    return r;
  });
  checar(ret.aposEspontanea === 1,
    'uma pausa que ninguém pediu AGENDA a retomada', JSON.stringify(ret));
  checar(ret.plays >= 1,
    'e ela CHEGA A TOCAR — o par do zero que a tela da rede afirma (tela-rede.test)',
    JSON.stringify(ret));
  checar(ret.aposFimNatural === 0,
    'o FIM NATURAL não retoma — senão o telão religaria a faixa que acabou, com '
    + 'a playlist avançando por baixo', JSON.stringify(ret));
  checar(ret.agendouAntesDoComando === 1,
    'a montagem do caso do ⏸ funcionou: havia mesmo um timer agendado para cancelar',
    JSON.stringify(ret));
  checar(ret.playsAposComando === 0,
    'e o ⏸ do OPERADOR vence um timer JÁ AGENDADO — não é desfeito 1,5 s depois',
    JSON.stringify(ret));
  checar(ret.censoDelta === 1,
    'o CENSO conta EPISÓDIOS: uma pausa forjada soma exatamente 1 (antes cada `play()` '
    + 'negado somava outro, e um roubo virava quatro)', JSON.stringify(ret));
  checar(ret.dispensou === true,
    'o Chromium recuperando o foco SOZINHO é dispensa, não "a cena mudou"', JSON.stringify(ret));
  checar(/^retomada em 1\.5s/.test(ret.esperaDepoisDoCredito || ''),
    'e o CRÉDITO VOLTA nesse ramo: o roubo seguinte começa com 1,5 s, não com 4 s',
    JSON.stringify(ret.esperaDepoisDoCredito));
  checar(ret.playsNoTeto === 3,
    'O TETO É O RECURSO: três tentativas e nem uma a mais', JSON.stringify(ret));
  checar(ret.desistiuDelta === 1,
    'e a desistência é um DESFECHO contado, não um silêncio sem explicação',
    JSON.stringify(ret));
  checar(ret.playsDepoisDeDesistir === 0,
    'o silêncio é DEFINITIVO até um comando humano — é o que separa um teto de um atraso',
    JSON.stringify(ret));
} catch (e) {
  checar(false, 'a retomada pôde ser medida', String(e && e.message));
}

// 7-B. A CORTINA NÃO ENGOLE A CAMADA DE TEXTO.
//
//    O stage decide a cortina sozinho em três pontos que não sabiam do cartão
//    de texto — o fim natural da mídia, o `play()` e o fim de um `load` —, e o
//    wallpaper (z-index 3) fica ACIMA do cartão (z-index 2). O caso é o que a
//    independência áudio × texto existe para permitir: um louvor de fundo com
//    a contagem regressiva de abertura projetada por cima. A música acaba
//    sozinha, o `ended` do stage roda, e 400 ms depois a cortina cobria o
//    cronômetro — com `textActive` ainda true, o `display-status` ainda
//    dizendo `view: 'visual'` e a lista do Controle ainda desenhando "● No ar".
//    Nenhum sinal, em lugar nenhum, de que a projeção tinha mudado.
//
//    A mídia é um ÁUDIO SEM LETRA de propósito: é o caso em que `semVisual()`
//    responde true, isto é, aquele em que a cortina fecharia mesmo sem o fim
//    natural. Sem essa escolha o caso passaria pelo motivo errado.
try {
  const cortina = await telao.evaluate(async () => {
    const m = await AVDB.addMedia(new Blob([new Uint8Array(64)], { type: 'audio/mpeg' }),
      { name: 'Louvor de fundo', type: 'audio/mpeg', kind: 'audio' });
    const bc = new BroadcastChannel('av-iasd');
    bc.postMessage({ type: 'load', mediaId: m.id, view: 'visual', muted: true, volume: 0 });
    await new Promise((f) => setTimeout(f, 900));
    bc.postMessage({ type: 'text', mode: 'message', main: 'CONTAGEM REGRESSIVA', sub: '', view: 'visual' });
    await new Promise((f) => setTimeout(f, 700));
    const wp = () => getComputedStyle(document.querySelector('.wallpaper')).display;
    const r = { comTexto: wp() };
    // O FIM NATURAL da música, pelo evento de verdade que o stage escuta.
    const v = document.querySelector('video');
    if (v) v.dispatchEvent(new Event('ended'));
    await new Promise((f) => setTimeout(f, 1400));
    r.depoisDoFim = wp();
    r.textoNaTela = document.getElementById('textMain').textContent;
    bc.postMessage({ type: 'text-hide' });
    await new Promise((f) => setTimeout(f, 900));
    // E SAINDO O TEXTO a cortina VOLTA: sem esta metade, "nunca cobrir" passaria.
    r.depoisDeTirarOTexto = wp();
    bc.close();
    return r;
  });
  checar(cortina.comTexto === 'none',
    'com a Camada de Texto em cena (view visual) a cortina fica ABERTA',
    JSON.stringify(cortina));
  checar(cortina.depoisDoFim === 'none' && cortina.textoNaTela === 'CONTAGEM REGRESSIVA',
    'e o FIM NATURAL do louvor de fundo não fecha a cortina por cima dela — o '
    + 'stage sabe que há um cartão acima dele', JSON.stringify(cortina));
  checar(cortina.depoisDeTirarOTexto === 'flex',
    'e tirando o texto do ar a cortina volta: o overlay é declarado e retirado, '
    + 'não é um "nunca cobrir"', JSON.stringify(cortina));
} catch (e) {
  checar(false, 'a medição da cortina x Camada de Texto terminou sem exceção (' + (e && e.message) + ')');
}

// 8. E nada disso pode ter custado um erro de console — a mesma régua da
//    fumaça do Controle.
checar(erros.length === 0, 'nenhum erro de console no telão', erros.join(' · '));

await navegador.close();
servidor.close();
console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
