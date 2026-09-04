// A HIDRATAÇÃO EM VOO PERDE A VEZ PARA O TOQUE.
//
// ## Por que este teste existe
//
// `load()` é a hidratação do Controle: ela lê uma dezena de chaves do IndexedDB
// e SÓ DEPOIS escreve as variáveis do módulo. Ninguém a chama com `await` — todo
// `db-change` dispara uma —, então ela corre sozinha por milissegundos enquanto
// o operador toca na tela. `send()` escreve `currentId`/`currentItem` de forma
// SÍNCRONA, na frente; o rabo da hidratação os sobrescrevia com o que o banco
// dizia ANTES do toque. É um *lost update* clássico, e é a QUARTA vez que esta
// base encontra a classe (`loadSeq`, `lyricLoadSeq`, `projecaoSeq`).
//
// O estado que sobrava — MEDIDO em arnês antes da correção — é
// `currentId: null` com `midiaNoAr: true`: o app PROJETANDO um vídeo e dizendo
// que não há item selecionado. Daí saem os três sintomas, e nenhum deles aponta
// para cá:
//
//  - o item deixa de estar SELECIONADO, e repetir a faixa com o ▶ morre;
//  - o ▶ cai em `send(undefined)` → `getMedia(undefined)` → `DataError`, uma
//    exceção no meio do transporte;
//  - `resendSceneToDisplay` pergunta `midiaNoAr && currentId`: um telão que
//    reconectasse nesse estado voltaria VAZIO, com a mídia tocando.
//
// Ele é intermitente por natureza — depende de a máquina ser lenta o bastante
// para a hidratação ainda estar em voo quando o dedo chega. Foi assim que ele
// derrubou o `cena.test.mjs` no runner (55/56, com o `web-ota` pulado) passando
// 7/7 na máquina de quem escreve. Por isso o hazard aqui é montado À MÃO, e não
// esperado de um percurso: um oráculo que depende da carga da máquina não pode
// guardar um portão.
//
// ## As quatro metades, e nenhuma basta sozinha
//
//  1. O HAZARD, na forma antiga (`db-estado.test.mjs` faz o mesmo): ler o banco
//     e aplicar sem senha nenhuma PERDE. Sem esta, a metade 2 provaria só que
//     uma função concorda consigo mesma.
//  2. Com o `load()` de verdade em voo, o TOQUE VENCE.
//  3. Sem toque nenhum, a hidratação CONTINUA restaurando a cena — senão "não
//     aplicar nunca" passaria na 2.
//
// E a quarta, que separa CENA de CONFIGURAÇÃO: durante a corrida a hidratação
// pula a SELEÇÃO e aplica o resto. Sem ela, o conserto barato (um `return` no
// topo da FASE 2) passa nas três acima e deixa o app com o tema, o corpo da
// letra e a velocidade da rolagem da sessão anterior.
//
//   node tools/hidratacao-perde-a-vez.test.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';

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
  if (!arquivo.startsWith(RAIZ) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
    res.writeHead(404); res.end('nao'); return;
  }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream' });
  fs.createReadStream(arquivo).pipe(res);
});

const falhas = [];
function checar(cond, msg, obtido) {
  if (cond) console.log('ok      ' + msg);
  else {
    console.log('FALHOU  ' + msg
      + (obtido !== undefined ? '\n        obtido: '
        + (typeof obtido === 'string' ? obtido : JSON.stringify(obtido)) : ''));
    falhas.push(msg);
  }
}

await new Promise((r) => servidor.listen(0, r));
const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);
const pg = await ctx.newPage();

try {
  await pg.goto('http://localhost:' + servidor.address().port + '/controle/', { waitUntil: 'domcontentloaded' });
  // Esperar pelo FATO (o app de pé), nunca por um prazo: é a mesma condição que
  // o watchdog de boot do OTA pergunta.
  await pg.waitForFunction(
    () => window.AVDB && typeof window.__avBack === 'function' && !!document.querySelector('#playlist li'),
    null, { timeout: 30000 },
  );
  await pg.evaluate(() => setAppMode('full'));

  // Duas mídias no Cronograma. DUAS porque a corrida precisa de um "antes" e um
  // "depois" distinguíveis: com uma só, "o toque venceu" e "a hidratação
  // sobrescreveu" produzem o mesmo `currentId`.
  const ids = await pg.evaluate(async () => {
    const cria = (nome) => AVDB.addMedia(new Blob([new Uint8Array(64)], { type: 'video/mp4' }),
      { name: nome, type: 'video/mp4', kind: 'video', list: 'imports' });
    const a = await cria('Louvor A');
    const b = await cria('Louvor B');
    await load();
    return { a: a.id, b: b.id };
  });

  // ── 1. O HAZARD, ESCRITO À MÃO ────────────────────────────────────────────
  // A FORMA ANTIGA da FASE 2, reescrita aqui: ler `current` e aplicar depois
  // dos `await`s, sem perguntar a ninguém se ainda é a vez de quem leu. É o que
  // `load()` fazia, e o que qualquer hidratação futura vai voltar a fazer se
  // ninguém lembrar.
  checar(await pg.evaluate(async ({ a, b }) => {
    await send(a);                       // a cena é A
    const hidratarSemSenha = async () => {
      const cur = await AVDB.getState('current');        // FASE 1
      await AVDB.getState('repeat');                     // ... os outros await
      currentId = cur && cur.mediaId ? cur.mediaId : null; // FASE 2, sem senha
    };
    const emVoo = hidratarSemSenha();    // a hidratação parte
    await send(b);                       // e o operador toca em B na frente dela
    await emVoo;                         // ela termina DEPOIS
    return currentId === a;              // voltou para A: o toque foi perdido
  }, ids), 'aplicar a leitura sem senha PERDE o toque que chegou no meio (o defeito)',
  await pg.evaluate(() => currentId));

  // ── 2. O `load()` DE VERDADE: O TOQUE VENCE ───────────────────────────────
  // Determinístico por construção, e não por velocidade: `send()` acha o
  // registro nas listas já carregadas e escreve `currentId` SEM `await` nenhum,
  // então ele chega sempre na frente; e `await emVoo` garante que a FASE 2 da
  // hidratação já rodou quando medimos.
  const corrida = await pg.evaluate(async ({ a, b }) => {
    await send(a);
    await AVDB.setState('repeat', 'one');   // uma CONFIGURAÇÃO nova, para a metade 4
    repeat = 'off';
    const emVoo = load();                   // como todo `db-change` a dispara
    await send(b);                          // o operador toca enquanto ela lê
    await emVoo;
    return {
      id: currentId,
      nome: currentItem && currentItem.name,
      noAr: midiaNoAr,
      repeat,
    };
  }, ids);
  checar(corrida.id === ids.b,
    'com um load() em voo, o toque VENCE: `currentId` continua sendo o do toque', corrida.id);
  checar(corrida.nome === 'Louvor B',
    'e `currentItem` vai junto — senão o transporte e a notificação descrevem a mídia anterior',
    corrida.nome);
  checar(corrida.noAr === true && !!corrida.id,
    'nunca sobra "há mídia no ar" com seleção nenhuma — era esse estado que apagava o reenvio de cena',
    corrida);

  // ── 2b. A MESMA CORRIDA NA ABERTURA, que é a forma que derrubou o CI ──────
  // Ali o banco diz `mediaId: null` — `clearCurrentSelection` zera a seleção a
  // cada sessão nova —, então o que a hidratação sobrescrevia não era um id
  // velho: era NADA. É a diferença entre "voltou para a música anterior" e o
  // estado impossível `currentId: null` com `midiaNoAr: true`, de onde sai a
  // exceção. O `db-change` do `addMedia` é o que dispara a hidratação em voo no
  // app de verdade; aqui ela é chamada à mão para o oráculo não depender de
  // quanto a máquina demora.
  const abertura = await pg.evaluate(async ({ b }) => {
    await AVDB.setState('current', { mediaId: null, noAr: false, view: 'visual', muted: false, volume: 1 });
    currentId = null; currentItem = null; midiaNoAr = false;
    const emVoo = load();
    await send(b);
    await emVoo;
    return { id: currentId, noAr: midiaNoAr };
  }, ids);
  checar(abertura.id === ids.b && abertura.noAr === true,
    'e na ABERTURA (banco sem seleção) o toque também vence — era daqui que saía `currentId: null` com mídia no ar',
    abertura);

  // O ▶ DEPOIS DELA. É a exceção que derrubou o CI, exercitada pelo caminho
  // real: `send(currentId)` com `currentId` nulo vira `getMedia(undefined)` →
  // `DataError`.
  let excecao = '';
  try {
    await pg.evaluate(async () => { await send(currentId); });
  } catch (e) { excecao = (e && e.message) || String(e); }
  checar(!excecao, 'e o ▶ seguinte não lança (era o DataError de `getMedia(undefined)`)', excecao);

  // ── 3. SEM TOQUE, A HIDRATAÇÃO CONTINUA RESTAURANDO A CENA ────────────────
  // A metade que impede o conserto por amputação. O caso é real e não é o da
  // abertura (ali `clearCurrentSelection` já zerou a seleção): é a página NOVA
  // depois de o renderer morrer ou de o OTA ser aplicado, em que a memória está
  // vazia e o banco é a única fonte do que estava em cena.
  const hidratou = await pg.evaluate(async ({ a }) => {
    await send(a);
    currentId = null; currentItem = null;   // a memória de uma página recém-carregada
    await load();                           // e nenhum toque concorrente
    return { id: currentId, nome: currentItem && currentItem.name };
  }, ids);
  checar(hidratou.id === ids.a && hidratou.nome === 'Louvor A',
    'sem toque nenhum, a hidratação RESTAURA a cena que estava no banco', hidratou);

  // ── 4. A CENA É PULADA; A CONFIGURAÇÃO, NUNCA ─────────────────────────────
  // A régua do lote: `currentId`/`currentItem` são a SELEÇÃO, que o toque
  // decide; tema, corpo da letra, velocidade da rolagem e o resto são
  // configuração, e ninguém compete por eles. Um `return` no topo da FASE 2
  // passa nas três metades acima e reprova aqui.
  checar(corrida.repeat === 'one',
    'e durante a MESMA corrida a configuração foi aplicada (a senha vale só para a seleção)',
    corrida.repeat);
} catch (e) {
  checar(false, 'o percurso terminou sem exceção (' + (e && e.message) + ')');
}

await navegador.close();
servidor.close();
console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
