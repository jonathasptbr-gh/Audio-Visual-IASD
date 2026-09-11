// O ARNÊS DOS ORÁCULOS — o preâmbulo que estava copiado em 45 arquivos.
//
// ## O que ele fecha
//
// O preâmbulo (servidor estático + `TIPOS` + `checar` + o `chromium.launch` com
// o `PW_CHROMIUM`) era copiado inteiro a cada oráculo novo: 3.225 linhas em 45
// arquivos, e uma cópia é uma chance de divergir. Divergiu em três lugares, e
// nenhum dos três tinha como acusar:
//
// - **`checar` em SETE variantes.** Uma delas (`registro.test.mjs`) declarava
//   dois parâmetros e recebia três em três chamadas — o `obtido` era descartado
//   em silêncio, e a reprovação saía sem o dado que a explicaria. Um oráculo
//   que reprova sem dizer o valor é um oráculo pela metade, e este projeto lê
//   os dele A DISTÂNCIA.
// - **`TIPOS` em cinco variantes**, umas sem `.png`/`.woff2` — quem faltasse
//   caía em `application/octet-stream`, que muda o `type` de um `Blob`.
// - **Viewport e `args` por cópia**, não por decisão: quatro oráculos herdaram
//   `412×892` do irmão de quem foram copiados, e um deles tem asserção
//   GEOMÉTRICA. Aqui os dois são PARÂMETRO — quem quer outro valor o escreve, e
//   quem lê vê que foi escolhido.
//
// ## O que ele NÃO faz
//
// Não toca no FIM de cada oráculo (o `falhas.length ? … : …` mais o
// `process.exit`): eles variam, o ganho seria estético e mexer no código de
// saída de 45 arquivos é risco sem contrapartida. `falhas` é exportada daqui e
// a linha final de cada um continua lendo a MESMA array.
//
// Não impõe viewport nem `args`: `abrirNavegador` tem o padrão do projeto
// (430×900, que é o que 37 oráculos usam) e aceita o resto.
import zlib from 'node:zlib';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

/** A UNIÃO das cinco variantes que existiam. Um tipo a mais nunca piora: o que
 *  falta cai em `application/octet-stream`, e foi assim que oráculos serviram
 *  `.png` como binário genérico sem ninguém escolher isso. */
export const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

/** A raiz da base web (`assets/web`), que é o que 40 dos 45 servem. */
export const RAIZ_WEB = path.join(
  path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');

/** A raiz da PÁGINA (`site/`) — os dois oráculos que medem o que quem ainda não
 *  instalou enxerga. */
export const RAIZ_SITE = path.join(
  path.dirname(fileURLToPath(import.meta.url)), '..', 'site');

/**
 * O servidor estático da base. NÃO chama `listen` — quem o faz é o oráculo, com
 * `listen(0)` (porta efêmera), que é o que permite rodá-los em paralelo.
 *
 * @param {string} raiz
 * @param {(req, res) => boolean} [antes] rota própria do oráculo. Devolvendo
 *   `true` ela ASSUMIU o pedido e o estático não responde — é assim que os dez
 *   oráculos com fixture própria (o manifesto do OTA, o `.pptx`, o googlevideo
 *   de mentira, o `notas.json` do "O que mudou") continuam donos do que servem.
 */
export function servirEstatico(raiz, antes) {
  return http.createServer((req, res) => {
    if (antes && antes(req, res)) return;
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const arquivo = path.join(raiz, p);
    if (!arquivo.startsWith(raiz) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
      res.writeHead(404); res.end('nao'); return;
    }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream' });
    fs.createReadStream(arquivo).pipe(res);
  });
}

// A ASSERÇÃO VEM DO `checar.mjs`, e a separação não é organização: os oráculos
// de NODE PURO rodam antes do `npm ci` do CI, e um deles importando ESTE
// arquivo (que importa o Playwright) quebraria só no runner. Reexportado aqui
// para quem já usa o arnês não precisar de dois imports.
export { checar, falhas } from './checar.mjs';

/**
 * O GANCHO DA CORTINA — ele OBSERVA, e não mexe em nada.
 *
 * Roda como `addInitScript`, isto é, ANTES do `<script>` inline do
 * `controle/index.html`. Ele embrulha o `window.__avSplash` que aquele script
 * publica para que a chamada de `pronto()` — a última linha do `init()` que
 * muda o que se vê — deixe um fato observável para o `esperarCortina`.
 *
 * **O piso de 1,8 s continua inteiro**: o `pronto()` de verdade é chamado logo
 * em seguida e a cortina sai pelo caminho do app. Este gancho não a levanta, não
 * a esconde e não muda um byte do que é servido — quem age é o `esperarCortina`,
 * e só quem o chama. É por isso que o `abertura-e-transferencia` (o oráculo que
 * AFIRMA o piso e o teto, com o relógio mockado) convive com ele sem opt-out:
 * ele não chama o `esperarCortina`.
 *
 * `configurable: true` nas duas pontas porque o acessador se autodestrói na
 * primeira escrita — o que fica na página é uma propriedade de dado comum, como
 * seria sem o gancho.
 */
const GANCHO_DA_CORTINA = () => {
  try {
    Object.defineProperty(window, '__avSplash', {
      configurable: true,
      get() { return undefined; },
      set(v) {
        delete window.__avSplash;
        window.__avSplash = (v && typeof v.pronto === 'function')
          ? { pronto() { window.__avPronto = true; return v.pronto(); } }
          : v;
      },
    });
  } catch (_) { /* sem gancho o `esperarCortina` cai no fato, que é o de sempre */ }
};

/**
 * O navegador. `PW_CHROMIUM` aponta o binário quando ele não está onde o
 * Playwright o procura (o passo do CI o deixa vazio de propósito).
 *
 * ## `comBarraDeRolagem` — e por que ele precisou existir (v1.8.60)
 *
 * **O Playwright passa `--hide-scrollbars` em headless**, e o arnês não tinha
 * como desligá-lo: TODO oráculo deste repositório roda com as barras de
 * rolagem APAGADAS, e nenhuma delas reserva um pixel. Uma asserção sobre barra
 * escrita com o arnês cru lê "não há barra" em toda parte e PASSA, calada —
 * que é a forma mais cara de oráculo que este projeto conhece.
 *
 * MEDIDO no Chromium 141 do repositório, `offsetWidth − clientWidth`:
 *
 * | caixa | como está | com `comBarraDeRolagem` |
 * |---|---|---|
 * | `scrollbar-width: thin` | 0 | **10** |
 * | padrão (`auto`) | 0 | **15** |
 *
 * Quem o liga está medindo a CALHA, e a ressalva vale: a barra que aparece é a
 * CLÁSSICA de mesa (o Chromium desktop até desenha setas nas pontas), não a
 * sobreposta do WebView do aparelho. Ela serve para provar que a tira de sombra
 * atravessa a calha QUANDO existe uma; que exista é fato do motor, não deste
 * app.
 *
 * @param {{args?: string[], comBarraDeRolagem?: boolean, semGancho?: boolean}} [opts]
 *
 * ===== E TODO CONTEXTO NASCIDO DAQUI CARREGA O GANCHO DA CORTINA =====
 *
 * O `newContext` é embrulhado AQUI, e não deixado a cargo de cada oráculo,
 * pela razão de sempre neste arnês: uma linha que 45 arquivos precisam
 * lembrar de escrever é uma linha que 45 arquivos podem esquecer — e o
 * esquecimento não teria sintoma, só 1,8 s a mais por boot. Quem quiser o
 * contexto cru passa `semGancho: true`.
 */
export function abrirNavegador(opts = {}) {
  return chromium.launch({
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
    ...(opts.args ? { args: opts.args } : {}),
    ...(opts.comBarraDeRolagem ? { ignoreDefaultArgs: ['--hide-scrollbars'] } : {}),
  }).then((nav) => {
    if (opts.semGancho) return nav;
    const cru = nav.newContext.bind(nav);
    nav.newContext = async (o) => {
      const ctx = await cru(o);
      await ctx.addInitScript(GANCHO_DA_CORTINA);
      return ctx;
    };
    return nav;
  });
}

/** O viewport de referência do projeto — o que 37 dos 45 oráculos usam. Quem
 *  precisa de outro o passa, e aí está escrito que foi escolha. */
export const VIEWPORT = { width: 430, height: 900 };

/**
 * ESPERAR PELO FATO, e nunca pelo relógio.
 *
 * Um `waitForTimeout` no meio de um oráculo é uma aposta na máquina: curto
 * demais ele reprova um app que está certo, longo demais ele cobra o pior caso
 * de TODA execução verde. MEDIDO no `stage-fade.test.mjs`: o estilo do fade é
 * limpo em 3,1 s e o oráculo esperava 18,2 s — 15 s de sono por rodada, para
 * afirmar o mesmo.
 *
 * O estouro NÃO é veredito: ele volta como FRASE, e quem a recebe a imprime no
 * lugar do `obtido`. Sem isso, uma reprovação por carga do runner chega
 * indistinguível de um defeito do app — que é a primeira das cinco classes que
 * a campanha da v5.316 teve de reproduzir e corrigir uma a uma.
 *
 * @returns {true|string} `true`, ou a frase do prazo estourado.
 */
export async function esperar(pg, fn, arg = null, prazo = 15000) {
  try {
    await pg.waitForFunction(fn, arg, { timeout: prazo });
    return true;
  } catch (_) {
    return 'o fato não foi observado em ' + Math.round(prazo / 1000) + 's (PRAZO, não veredito)';
  }
}

/** O motivo, para o terceiro argumento do `checar`: `undefined` quando o fato
 *  aconteceu (e aí o `checar` não imprime nada), a frase quando foi prazo. */
export const porque = (r) => (r === true ? undefined : r);

/**
 * A CORTINA DE ABERTURA LEVANTOU? — e por que TODO oráculo que TOCA na tela
 * precisa esperar por ela (v1.7.2).
 *
 * O `#splash` é opaco, cobre a tela inteira e é o topo da pilha. Até a v1.7.2
 * ele levantava no instante em que o `init()` terminava, e por isso quase todo
 * oráculo passava sem saber que ele existia: quando a montagem do cenário
 * acabava, a cortina já tinha saído. Ela ganhou um PISO de 1,8 s — a pedido do
 * operador, porque no aparelho ela era um lampejo — e o vão passou a ser real.
 *
 * O QUE FALHA NELE NÃO É ÓBVIO, e foi assim que ele apareceu: `pg.click()` do
 * Playwright ESPERA a actionability e retenta sozinho, então um oráculo que
 * clica não vê nada. Quem vê é quem mede — `elementFromPoint`, uma captura de
 * pixel, uma leitura de `getBoundingClientRect` de algo que ainda não assentou.
 * MEDIDO neste lote: 6 dos 63 oráculos reprovaram, e os 6 por hit-test.
 *
 * A ESPERA É PELO FATO (o nó fora do documento), nunca por um prazo: a cortina
 * sai por remoção do nó, e é isso que os oráculos da abertura já afirmam.
 *
 * ===== MAS ELA NÃO PAGA O PISO, E ISSO É O QUE ELA PASSOU A FAZER =====
 *
 * O piso de 1,8 s é do OPERADOR, não do oráculo: ele existe para a abertura não
 * ser um lampejo no aparelho. Quem o AFIRMA é o `abertura-e-transferencia`, com
 * o relógio mockado e nas duas pontas — e ele não passa por aqui. Os outros ~70
 * pontos que chamam esta função não estão medindo a cortina: estão esperando o
 * app ficar TOCÁVEL, e pagavam o piso de carona. MEDIDO: 1,8 s × ~70, ~126 s de
 * sono por rodada em SÉRIE, num passo cujo total era 1.022 s.
 *
 * Então ela espera pelo fato que os oráculos de fato precisam — **o `init()`
 * terminou** — e tira o nó, que é exatamente o que o `sair()` do app faria 1,8 s
 * depois. O estado final é o mesmo em que os oráculos já mediam: nada opaco no
 * caminho do dedo, nada por cima do `elementFromPoint`.
 *
 * O SINAL É DO PRÓPRIO APP, e não um palpite de tempo: `__avPronto` é escrito
 * pelo gancho de `abrirNavegador` no instante em que o `controle.js` chama
 * `__avSplash.pronto()` — a ÚLTIMA linha do `init()` que muda o que se vê. A
 * garantia que esta função dava continua inteira; o que saiu foi a espera
 * cosmética.
 *
 * O `|| !document.getElementById('splash')` é a PRIMEIRA metade de propósito:
 * o `/display/` não tem cortina nenhuma, e o caminho catastrófico (o teto de
 * 12 s, que chama `sair` sem passar pelo `pronto`) continua atendido pelo fato.
 */
export async function esperarCortina(pg, prazo = 30000) {
  const r = await esperar(
    pg, () => !document.getElementById('splash') || window.__avPronto === true, null, prazo);
  if (r !== true) return r;
  await pg.evaluate(() => {
    const c = document.getElementById('splash');
    if (c && c.parentNode) c.parentNode.removeChild(c);
  });
  return true;
}

/**
 * A IRMÃ DO `esperar` PARA FATOS QUE MORAM ATRÁS DE UM `await` — o IndexedDB,
 * quase sempre.
 *
 * `waitForFunction` **não espera a Promise de um predicado `async`**: ela é
 * *truthy*, a espera passa no PRIMEIRO quadro e aprova o que veio verificar
 * (MEDIDO: um predicado que só deveria passar depois de 1 s retornou em 32 ms).
 * É uma das cinco classes de "oráculo medindo o runner" que a campanha da
 * v5.316 teve de reproduzir. Aqui o laço é do lado do NODE, que de fato aguarda.
 *
 * @returns {true|string} `true`, ou a frase do prazo estourado.
 */
export async function esperarDb(pg, fn, arg = null, prazo = 15000) {
  const fim = Date.now() + prazo;
  while (Date.now() < fim) {
    if (await pg.evaluate(fn, arg)) return true;
    await pg.waitForTimeout(100);
  }
  return 'o fato não foi observado em ' + Math.round(prazo / 1000) + 's (PRAZO, não veredito)';
}

// ===== O PIXEL: DECODIFICAR UM PNG SEM DEPENDÊNCIA =====
//
// Ele morava dentro do `lista-da-biblioteca.test.mjs`, e ganhou um SEGUNDO
// consumidor na v1.8.59 (`sombra-de-rolagem.test.mjs`, que passou a medir ONDE
// a tira pousa). Segundo consumidor é a hora de subir para cá: é exatamente a
// divergência que este arquivo existe para fechar — o `checar` chegou a ter
// sete variantes por ter sido copiado, e uma delas descartava o `obtido` em
// silêncio.
//
// Ele lê só o que o `page.screenshot()` do Playwright produz: profundidade 8,
// cor 2 (RGB) ou 6 (RGBA). Qualquer outra coisa LANÇA — um decodificador que
// adivinha devolve pixels plausíveis, e uma asserção de cor sobre pixel
// plausível é pior que asserção nenhuma.
export function lerPng(buf) {
  let p = 8, w = 0, h = 0, cor = 0, prof = 0; const idat = [];
  while (p < buf.length) {
    const n = buf.readUInt32BE(p); const tipo = buf.toString('ascii', p + 4, p + 8);
    const dados = buf.subarray(p + 8, p + 8 + n);
    if (tipo === 'IHDR') { w = dados.readUInt32BE(0); h = dados.readUInt32BE(4); prof = dados[8]; cor = dados[9]; }
    else if (tipo === 'IDAT') idat.push(dados);
    else if (tipo === 'IEND') break;
    p += 12 + n;
  }
  if (prof !== 8 || (cor !== 2 && cor !== 6)) throw new Error('PNG inesperado: prof=' + prof + ' cor=' + cor);
  const canais = cor === 6 ? 4 : 3;
  const cru = zlib.inflateSync(Buffer.concat(idat));
  const passo = w * canais; const out = Buffer.alloc(h * passo);
  let q = 0;
  for (let y = 0; y < h; y++) {
    const f = cru[q++]; const src = cru.subarray(q, q + passo); q += passo;
    const dst = out.subarray(y * passo, y * passo + passo);
    const ant = y ? out.subarray((y - 1) * passo, y * passo) : null;
    for (let i = 0; i < passo; i++) {
      const a = i >= canais ? dst[i - canais] : 0;
      const b = ant ? ant[i] : 0;
      const c = ant && i >= canais ? ant[i - canais] : 0;
      let v = src[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      dst[i] = v & 255;
    }
  }
  return { w, h, canais, px: out };
}
// O pixel (x, y) como [r, g, b]. Fora da imagem devolve `null` — e isso é
// decisão: um índice negativo entra na linha ANTERIOR do buffer e devolve uma
// cor de outro lugar da tela, que é uma medição errada sem erro nenhum.
export function pixel(img, x, y) {
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return null;
  const i = (y * img.w + x) * img.canais;
  return [img.px[i], img.px[i + 1], img.px[i + 2]];
}
// A luminância relativa da WCAG, para razões de contraste e de escurecimento.
export function luminancia(c) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
}

/**
 * ESCREVE O TEMA NA CHAVE DO APP, e não só no `colorScheme` do aparelho.
 *
 * O `colorScheme` do Playwright é `prefers-color-scheme`, e o app só o LIA
 * enquanto existiu o terceiro estado do tile (o automático, v1.8.49–v1.8.63).
 * Removido ele, a metade `'light'` de todo laço `['dark', 'light']` passa a
 * medir o ESCURO — e passa CALADA: a asserção continua verde, comparando o
 * tema padrão consigo mesmo. MEDIDO na entrada da v1.8.64: as duas metades do
 * bloco T saíram no mesmo PNG, pixel a pixel.
 *
 * É o espelho da armadilha que o `smoke.mjs` já declarava pelo outro lado — *o
 * Chromium responde CLARO por padrão* —, e a resposta é a mesma: um oráculo de
 * cor DECLARA de que tema partiu. Vale escrever os dois valores, e não só o
 * claro: `'escuro'` é a ausência de escolha hoje, mas a chave dita é o que
 * sobrevive à próxima mudança do padrão.
 */
export function comTema(ctx, tema) {
  return ctx.addInitScript((t) => {
    try { localStorage.setItem('av.tema', t); } catch (_) { /* armazenamento bloqueado */ }
  }, (tema === 'light' || tema === 'claro') ? 'claro' : 'escuro');
}
