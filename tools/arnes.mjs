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
 *   `true` ela ASSUMIU o pedido e o estático não responde — é assim que os nove
 *   oráculos com fixture própria (o manifesto do OTA, o `.pptx`, o googlevideo
 *   de mentira) continuam donos do que servem.
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
 * O navegador. `PW_CHROMIUM` aponta o binário quando ele não está onde o
 * Playwright o procura (o passo do CI o deixa vazio de propósito).
 *
 * @param {{args?: string[]}} [opts]
 */
export function abrirNavegador(opts = {}) {
  return chromium.launch({
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
    ...(opts.args ? { args: opts.args } : {}),
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
 */
export async function esperarCortina(pg, prazo = 30000) {
  return esperar(pg, () => !document.getElementById('splash'), null, prazo);
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
