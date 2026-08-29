#!/usr/bin/env node
// ============================================================================
// A APRESENTAÇÃO QUE VIRA IMAGEM (`controle/deck.js`), num Chromium de verdade.
//
// ## Por que este oráculo existe
//
// A rasterização do `.pptx` é `<foreignObject>`: o slide vai para dentro de um
// SVG que o navegador desenha como imagem. Esse SVG é um DOCUMENTO À PARTE, e
// **tudo que ele não alcança some sem erro nenhum** — sem exceção no console,
// sem requisição falhando, sem página faltando. O que sai é uma apresentação
// completa, com o número de páginas certo, e branca.
//
// Foi o que aconteceu: o material do operador (27 slides, fundo fotográfico em
// TODOS) chegou ao telão com o texto solto sobre papel branco. A causa é medida
// e está no `deck.js`: aquele arquivo não tem **um** `<img>` — todo fundo é
// `background-image: url(blob:…)`, e a versão anterior só convertia `<img>`.
//
// Um teste do DESFECHO não pega nada disso: as duas versões produzem 27
// páginas de 1920×1080, e as duas terminam sem lançar. Por isso este oráculo
// mede **PIXEL**, e cada asserção de conteúdo tem a REVERSÃO ao lado: o mesmo
// fixture rasterizado pelo caminho ingênuo, provando que a pergunta tem dente.
//
// ## O que ele cobre
//
//  1. as três coisas que o `foreignObject` perde (mídia `blob:`, pixels de
//     `<canvas>`, fonte de símbolo) — cada uma com a reversão;
//  2. o FORMATO por página (o PNG da página chapada, o WebP da fotográfica) —
//     a regra que impede a correção de (1) multiplicar por dez o que uma
//     apresentação ocupa no aparelho;
//  3. o PALCO não mexer no layout do documento — a regra que o relato do
//     operador ("a tela piscou e ocultou o cronograma") cobra.
//
//   node tools/apresentacao.test.mjs
// ============================================================================
import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(AQUI, '..', 'app', 'src', 'main', 'assets', 'web');
const DECK = fs.readFileSync(path.join(WEB, 'controle', 'deck.js'), 'utf8');

const falhas = [];
function checar(cond, msg, obtido) {
  if (cond) console.log('ok      ' + msg);
  else {
    console.log('FALHOU  ' + msg
      + (obtido !== undefined ? '\n        obtido: ' + JSON.stringify(obtido) : ''));
    falhas.push(msg);
  }
}

// ---------------------------------------------------------------------------
// PARTE 1 — a tabela de símbolos, PURA (sem navegador)
//
// O marcador de tópico do PowerPoint é uma LETRA numa fonte que só existe no
// Windows. `deck.js` roda aqui com um `document` de mentira: nada desta parte o
// toca.
// ---------------------------------------------------------------------------
const janela = { document: { createElement: () => ({ style: {} }) } };
new Function('return this')();
new Function(DECK).call(janela);
const AVDeck = janela.AVDeck;
checar(!!AVDeck, 'deck.js publica `AVDeck` (é o que o watchdog do OTA exige)');

const wing = AVDeck.tabelaDaFonte('Wingdings');
const sym = AVDeck.tabelaDaFonte('Symbol');
checar(!!wing && !!sym, 'Wingdings e Symbol são reconhecidas como fontes de símbolo');
checar(AVDeck.tabelaDaFonte('Georgia') === null
  && AVDeck.tabelaDaFonte('') === null,
  'uma fonte de TEXTO não entra na tradução (senão a letra vira glifo)');

// Os dois do material do operador, medidos no arquivo dele.
checar(AVDeck.textoDeSimbolo('v ', wing) === '❖ ',
  'Wingdings "v" é o losango ❖ — o marcador do material do operador',
  AVDeck.textoDeSimbolo('v ', wing));
checar(AVDeck.textoDeSimbolo(' ', sym) === '• ',
  'Symbol U+F0B7 (área privativa) é o ponto •',
  AVDeck.textoDeSimbolo(' ', sym));
checar(AVDeck.textoDeSimbolo('§', wing) === '▪',
  'Wingdings "§" é o quadrado ▪ (o marcador de segundo nível mais comum)');

// A REGRA DA ÁREA PRIVATIVA, e a do fora dela: são opostas de propósito.
checar(AVDeck.textoDeSimbolo('', wing) === '•',
  'área privativa sem tradução vira ponto — o retângulo vazio é o único '
  + 'desfecho que não pode chegar ao telão');
checar(AVDeck.textoDeSimbolo('z', wing) === 'z',
  'FORA da área privativa, o que a tabela não conhece é DEIXADO como está — '
  + 'traduzir por palpite troca um erro visível por um errado que parece certo');
checar(AVDeck.textoDeSimbolo('Filipenses 4:4-9', null) === 'Filipenses 4:4-9',
  'sem tabela o texto atravessa intacto');

// ---------------------------------------------------------------------------
// PARTE 2 — o navegador
// ---------------------------------------------------------------------------
// Um servidor local é obrigatório: o `deck.js` resolve a biblioteca por
// `import('../vendor/pptx-renderer.js')`, e num script clássico esse caminho
// sai da URL do DOCUMENTO — a página tem de morar em `/controle/`.
const MIME = { '.js': 'text/javascript', '.html': 'text/html' };
const PAGINA = '<!doctype html><meta charset="utf-8"><title>oráculo</title>'
  + '<body style="margin:0"><div id="alvo"></div>'
  + '<script src="deck.js"></script>';
const servidor = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/controle/oraculo.html') {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(PAGINA);
    return;
  }
  const alvo = path.join(WEB, url.pathname);
  if (!alvo.startsWith(WEB)) { res.statusCode = 403; res.end(''); return; }
  fs.readFile(alvo, (e, b) => {
    if (e) { res.statusCode = 404; res.end(''); return; }
    res.setHeader('content-type', MIME[path.extname(alvo)] || 'application/octet-stream');
    res.end(b);
  });
});
await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + servidor.address().port;

const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const ctx = await navegador.newContext();
await semRedeExterna(ctx);
const pg = await ctx.newPage();
pg.on('pageerror', (e) => { falhas.push('pageerror: ' + e.message); });
await pg.goto(base + '/controle/oraculo.html');

// O FIXTURE é a saída do renderizador, escrita à mão: nenhum conteúdo de
// terceiro entra neste repositório (a regra do `cifra.test.mjs`), e o que
// importa aqui não é o `.pptx` — é a FORMA que o renderizador produz, medida no
// material do operador: fundo por `background-image: url(blob:)`, figura por
// `<img src="blob:">`, gráfico por `<canvas>`, marcador por `<span>` numa fonte
// de símbolo.
const CORES = { fundo: [0, 128, 255], figura: [255, 0, 0], grafico: [0, 200, 0] };

const medido = await pg.evaluate(async (CORES) => {
  // Um PNG de 1×1 de cor sólida, como Blob → `blob:` URL, que é exatamente o
  // que o renderizador entrega para toda mídia do `.pptx`.
  async function blobDeCor(rgb) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 8;
    const c = cv.getContext('2d');
    c.fillStyle = 'rgb(' + rgb.join(',') + ')';
    c.fillRect(0, 0, 8, 8);
    return await new Promise((r) => cv.toBlob(r, 'image/png'));
  }
  const urlFundo = URL.createObjectURL(await blobDeCor(CORES.fundo));
  const urlFigura = URL.createObjectURL(await blobDeCor(CORES.figura));

  const cela = document.createElement('div');
  cela.style.cssText = 'width:400px;height:200px;overflow:hidden;position:relative;background:#fff;';
  const fundo = document.createElement('div');
  fundo.style.cssText = 'position:absolute;inset:0;background-image:url("' + urlFundo
    + '");background-size:100% 100%;background-repeat:no-repeat;';
  const figura = document.createElement('img');
  figura.src = urlFigura;
  figura.style.cssText = 'position:absolute;left:0;top:0;width:100px;height:200px;';
  const grafico = document.createElement('canvas');
  grafico.width = 40; grafico.height = 40;
  grafico.style.cssText = 'position:absolute;left:200px;top:0;width:100px;height:200px;';
  const gc = grafico.getContext('2d');
  gc.fillStyle = 'rgb(' + CORES.grafico.join(',') + ')';
  gc.fillRect(0, 0, 40, 40);
  const marcador = document.createElement('span');
  marcador.style.cssText = 'font-family: Wingdings; font-size: 20px;';
  marcador.textContent = 'v ';
  cela.append(fundo, figura, grafico, marcador);
  document.getElementById('alvo').appendChild(cela);
  await figura.decode();

  // ---- a leitura de pixel ----
  async function pixels(blob) {
    const bm = await createImageBitmap(blob);
    const cv = document.createElement('canvas');
    cv.width = bm.width; cv.height = bm.height;
    const c = cv.getContext('2d');
    c.drawImage(bm, 0, 0);
    const em = (x, y) => [...c.getImageData(x, y, 1, 1).data].slice(0, 3);
    return {
      w: bm.width, h: bm.height,
      fundo: em(Math.round(bm.width * 0.9), Math.round(bm.height * 0.8)),
      figura: em(Math.round(bm.width * 0.1), Math.round(bm.height * 0.5)),
      grafico: em(Math.round(bm.width * 0.6), Math.round(bm.height * 0.1)),
    };
  }

  // A REVERSÃO: o caminho ingênuo — clonar e serializar, sem embutir nada. É o
  // que havia antes, e é ele que prova que as asserções acima têm dente.
  async function ingenuo(el, w, h) {
    const clone = el.cloneNode(true);
    const html = new XMLSerializer().serializeToString(clone);
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '">'
      + '<foreignObject width="100%" height="100%">'
      + '<div xmlns="http://www.w3.org/1999/xhtml">' + html + '</div>'
      + '</foreignObject></svg>');
    try { await img.decode(); } catch (_) { return null; }
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const c = cv.getContext('2d');
    c.fillStyle = '#fff'; c.fillRect(0, 0, w, h);
    c.drawImage(img, 0, 0, w, h);
    return await new Promise((r) => cv.toBlob(r, 'image/png'));
  }

  const bom = await AVDeck.elementoParaImagem(cela, 400, 200, AVDeck.cacheDeRecursos());
  const velho = await ingenuo(cela, 400, 200);

  // ---- o marcador, no clone ----
  const cloneMarc = cela.cloneNode(true);
  AVDeck.trocarSimbolos(cloneMarc);
  const spanMarc = cloneMarc.querySelector('span');

  // ---- o FORMATO, por página ----
  function telaChapada() {
    const cv = document.createElement('canvas');
    cv.width = 1920; cv.height = 1080;
    const c = cv.getContext('2d');
    c.fillStyle = '#fff'; c.fillRect(0, 0, 1920, 1080);
    c.fillStyle = '#a22f10'; c.font = 'bold 120px serif';
    c.fillText('Escolha Bons Pensamentos', 120, 540);
    return cv;
  }
  function telaFotografica() {
    const cv = document.createElement('canvas');
    cv.width = 1920; cv.height = 1080;
    const c = cv.getContext('2d');
    const dados = c.createImageData(1920, 1080);
    for (let i = 0; i < dados.data.length; i += 4) {
      dados.data[i] = (Math.random() * 256) | 0;
      dados.data[i + 1] = (Math.random() * 256) | 0;
      dados.data[i + 2] = (Math.random() * 256) | 0;
      dados.data[i + 3] = 255;
    }
    c.putImageData(dados, 0, 0);
    return cv;
  }
  const chapada = await AVDeck.escolherFormato(telaChapada());
  const foto = await AVDeck.escolherFormato(telaFotografica());

  // ---- o PALCO não pode mexer no layout ----
  const antes = {
    largura: document.documentElement.scrollWidth,
    altura: document.documentElement.scrollHeight,
    corpo: Math.round(document.body.getBoundingClientRect().height),
    janela: Math.round(window.innerHeight - (window.visualViewport
      ? window.visualViewport.height : window.innerHeight)),
  };
  const palco = AVDeck.criarPalco();
  const gigante = document.createElement('div');
  // A apresentação inteira como a versão anterior a montava: 27 páginas de
  // 1920×1080 com o respiro entre elas.
  gigante.style.cssText = 'width:1920px;height:29700px;background:red;';
  palco.mesa.appendChild(gigante);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const durante = {
    largura: document.documentElement.scrollWidth,
    altura: document.documentElement.scrollHeight,
    corpo: Math.round(document.body.getBoundingClientRect().height),
    janela: Math.round(window.innerHeight - (window.visualViewport
      ? window.visualViewport.height : window.innerHeight)),
    // Sem LAYOUT não há o que rasterizar — é por isso que o palco não pode ser
    // `display: none`, e é isso que esta medida guarda.
    temLayout: gigante.getBoundingClientRect().width,
  };
  palco.fechar();

  return {
    bom: bom ? { tipo: bom.tipo, tamanho: bom.blob.size, ...(await pixels(bom.blob)) } : null,
    velho: velho ? await pixels(velho) : null,
    marcador: spanMarc ? { texto: spanMarc.textContent, familia: spanMarc.style.fontFamily } : null,
    chapada: { tipo: chapada.tipo, tamanho: chapada.blob.size },
    foto: { tipo: foto.tipo, tamanho: foto.blob.size },
    antes, durante,
  };
}, CORES);

const perto = (a, b) => Array.isArray(a) && a.every((v, i) => Math.abs(v - b[i]) <= 24);

// ---- 1. as três coisas que o `foreignObject` perde ----
checar(!!medido.bom && medido.bom.w === 400 && medido.bom.h === 200,
  'a página sai no tamanho pedido', medido.bom && [medido.bom.w, medido.bom.h]);

checar(medido.bom && perto(medido.bom.fundo, CORES.fundo),
  'O FUNDO DO SLIDE (background-image: url(blob:)) CHEGA À PÁGINA — '
  + 'é a metade que faltava, e a que apagou 27 slides do operador',
  medido.bom && medido.bom.fundo);
checar(medido.velho && !perto(medido.velho.fundo, CORES.fundo),
  '  ↳ e a REVERSÃO reprova: pelo caminho ingênuo o fundo NÃO chega '
  + '(sem isto a asserção acima aprovaria as duas versões)',
  medido.velho && medido.velho.fundo);

checar(medido.bom && perto(medido.bom.figura, CORES.figura),
  'a figura (<img src="blob:">) chega à página', medido.bom && medido.bom.figura);
checar(medido.velho && !perto(medido.velho.figura, CORES.figura),
  '  ↳ e a REVERSÃO reprova', medido.velho && medido.velho.figura);

checar(medido.bom && perto(medido.bom.grafico, CORES.grafico),
  'os PIXELS de um <canvas> chegam à página — `cloneNode` copia o elemento e '
  + 'não o bitmap, e um gráfico do PowerPoint sairia em branco',
  medido.bom && medido.bom.grafico);
checar(medido.velho && !perto(medido.velho.grafico, CORES.grafico),
  '  ↳ e a REVERSÃO reprova', medido.velho && medido.velho.grafico);

checar(medido.marcador && medido.marcador.texto === '❖ ',
  'o marcador em Wingdings vira ❖ no clone', medido.marcador);
checar(medido.marcador && !medido.marcador.familia,
  '  ↳ e a FAMÍLIA sai junto: escrito o ❖, continuar pedindo Wingdings manda o '
  + 'navegador procurar uma fonte que o aparelho não tem',
  medido.marcador && medido.marcador.familia);

// ---- 2. o formato por página ----
checar(medido.chapada.tipo === 'image/png',
  'a página CHAPADA fica em PNG — é onde a borda da letra importa, e ela '
  + 'comprime pequena sem perda', medido.chapada);
checar(medido.foto.tipo === 'image/webp',
  'a página FOTOGRÁFICA vai para o WebP — sem isto o conserto das imagens '
  + 'multiplicaria por dez o que uma apresentação ocupa no aparelho',
  medido.foto);
checar(medido.foto.tamanho < medido.chapada.tamanho * 40,
  '  ↳ e o WebP é MENOR de fato (a escolha compara tamanho, e um navegador '
  + 'sem WebP devolve o próprio PNG deste `toBlob`)',
  { foto: medido.foto.tamanho, chapada: medido.chapada.tamanho });

// ---- 3. o palco não mexe no layout ----
checar(medido.durante.largura === medido.antes.largura
  && medido.durante.altura === medido.antes.altura,
  'O PALCO NÃO ACRESCENTA TRANSBORDO AO DOCUMENTO com a apresentação inteira '
  + 'dentro — a versão anterior pendurava 1920×29700 no <body>, e o relato do '
  + 'operador é o app encolhendo durante a importação',
  { antes: medido.antes, durante: medido.durante });
checar(medido.durante.corpo === medido.antes.corpo,
  '  ↳ e o <body> não muda de altura (é dela que `main` tira a dele)',
  { antes: medido.antes.corpo, durante: medido.durante.corpo });
checar(medido.durante.janela === medido.antes.janela,
  '  ↳ e a viewport VISUAL não encolhe — é a conta do `--kb`, que desconta '
  + 'altura do app inteiro', { antes: medido.antes.janela, durante: medido.durante.janela });
checar(medido.durante.temLayout === 1920,
  '  ↳ mas o conteúdo do palco TEM LAYOUT: sem ele não há o que rasterizar, e '
  + 'é por isso que a caixa é 0×0 com overflow:hidden e não `display: none`',
  medido.durante.temLayout);

await navegador.close();
servidor.close();

if (falhas.length) {
  console.error('\n' + falhas.length + ' asserção(ões) reprovada(s).');
  process.exit(1);
}
console.log('\ntudo certo.');
