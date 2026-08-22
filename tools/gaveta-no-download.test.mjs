// O PROGRESSO DE UM DOWNLOAD NÃO PODE FECHAR A GAVETA DA LINHA (v1.1.2).
//
// ## Por que ele existe
//
// Relato do operador: *"enquanto está baixando as coletâneas, eu não consigo
// abrir os itens nos álbuns para ver e interagir com o que já está baixado,
// como se a atualização da tela por causa dos downloads estivesse fechando a
// seção de opções de play"*.
//
// Era exatamente isso. Enquanto um download corre, `refreshCollectionsIfVisible`
// redesenha o acervo a cada `COLL_REFRESH_MS` (400 ms), e o redesenho em modo
// folhear é `hymnResultsEl.innerHTML = ''` seguido da remontagem dos cards. O
// que ABRE uma linha vive no `li` que ele acabou de jogar fora: a classe
// `expanded`, a closure `gavetaMontada`, os destinos marcados e a letra já lida.
//
// **O defeito é MUDO nos dois tempos**, e é por isso que ele precisa de oráculo:
//
//  - com a gaveta já aberta, ela some — sem erro de console, sem nada na tela
//    que diga que houve um redesenho;
//  - e no caso do relato ela nem chega a abrir: entre o toque e o `expanded` há
//    um `await` (a letra sai do IndexedDB), o redesenho alcança a lista no meio
//    da montagem, o `li` do toque vira ÓRFÃO e as últimas linhas do handler
//    escrevem num nó fora do documento. O toque não faz nada e nada explica por
//    quê — indistinguível de "o app travou".
//
// As QUATRO metades, e nenhuma sozinha prova o recurso:
//
//  1. o hazard EXISTE (um redesenho não guardado fecha a gaveta) — sem isto o
//     resto provaria que uma função concorda consigo mesma;
//  2. a marca de abertura é SÍNCRONA (o caso do relato, medido no turno do
//     clique, antes do primeiro `await`);
//  3. o caminho de verdade SEGURA — o mesmo `setCollStatus` que o laço de
//     download chama, e a MESMA linha continua no documento;
//  4. e a espera TERMINA: fechada a gaveta, o redesenho adiado sai sozinho e o
//     card mostra o estado em dia. Sem esta, "nunca redesenhar" passaria.
//
// Roda em Chromium de verdade, sobre a base web servida como no aparelho e SEM
// `__AVBridge` (é o caminho de navegador — nada aqui depende do shell).
//
//   node tools/gaveta-no-download.test.mjs
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

// Espera pelo FATO, e o estouro devolve a FRASE — um prazo vencido não é um
// veredito sobre o app (ver "Um oráculo não pode medir o runner").
async function esperar(pg, fn, msg, arg, ms = 15000) {
  try { await pg.waitForFunction(fn, arg, { timeout: ms }); checar(true, msg); return true; }
  catch (_) { checar(false, msg, 'PRAZO, não veredito: a condição não chegou em ' + ms + 'ms'); return false; }
}

await new Promise((r) => servidor.listen(0, r));
const porta = servidor.address().port;
const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);
// O MODO AVANÇADO É SEMEADO ANTES DA PRIMEIRA LINHA DO APP, e isto não é
// conveniência: o app nasce no simplificado, `init()` chama `setAppMode(appMode)`
// depois do `load()` — e `setAppMode`, em avançado, chama `closeHymnSearch()`.
// Ligar o modo por `evaluate` depois da carga é uma CORRIDA contra essa chamada:
// vencendo, a Biblioteca que este oráculo acabou de abrir fecha sozinha, e o que
// o log mostra são asserções sobre uma tela que não está mais lá. MEDIDO — foi o
// que aconteceu com a máquina sob carga. Semeado, o app já boota em avançado e
// aquele `setAppMode` não muda nada.
await ctx.addInitScript(() => {
  try { localStorage.setItem('av.appMode', 'full'); } catch (_) { /* storage bloqueado */ }
});
const pg = await ctx.newPage();
const base = `http://localhost:${porta}`;

const erros = [];
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY/;
pg.on('console', (m) => {
  if (m.type() !== 'error') return;
  const t = m.text();
  if (EXTERNO.test(t) || /Failed to load resource/.test(t)) return;
  erros.push(t);
});
pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));

try {
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  // ESPERA O APP ESTAR DE PÉ, e é a MESMA pergunta do watchdog de boot do OTA
  // (os módulos, `__avBack`, e um `<li>` dentro de `#playlist` — a prova de que
  // o `init()` assíncrono terminou), mais uma: o `--tab-w` que só o
  // `moveTabIndicator` do `setAppMode` da inicialização escreve. Sem esta
  // última, o oráculo entraria na Biblioteca antes daquela chamada e ela
  // fecharia a folha por baixo dele.
  //
  // O modo avançado é pré-requisito da medição inteira: no Modo Fácil o toque na
  // linha TOCA a música e não abre gaveta nenhuma — o oráculo mediria um
  // container vazio e concluiria o que quisesse.
  await pg.waitForFunction(() => (
    window.AVDB && window.AVStream && window.createStage
      && window.Louvorja && window.Bible && window.AVSerie && window.AVSorteio
      && typeof window.__avBack === 'function'
      && !!document.querySelector('#playlist li')
      && !!document.querySelector('.tabs')
      && document.querySelector('.tabs').style.getPropertyValue('--tab-w') !== ''
  ), null, { timeout: 30000 });

  // ---- O acervo plantado -------------------------------------------------
  // O hinário é uma coleção FIXA: ela desenha na RAIZ da Biblioteca, sem
  // depender de abrir grupo nenhum. A faixa vem com LETRA porque é ela que põe
  // o `await` no caminho do toque — que é justamente a janela do relato.
  await pg.evaluate(async () => {
    await AVDB.fileAdd({
      id: 'f-h1', folder: 'x', name: 'Noite de Paz', srcName: 'Noite de Paz',
      type: 'audio/mpeg', kind: 'audio', size: 8,
      lyrics: [{ text: 'Noite de paz, noite de amor', auxText: 'Estrofe 1' }],
      blob: new Blob([new Uint8Array(8)], { type: 'audio/mpeg' }),
    });
    collState['hymnal-2022'] = { songs: [
      { id_music: 'h1', track: 1, name: 'Noite de Paz', duration: '3:00',
        has_instrumental_music: false, fileIdFull: 'f-h1', fileIdPlayback: null },
      { id_music: 'h2', track: 2, name: 'Firme nas Promessas', duration: '3:00',
        has_instrumental_music: false, fileIdFull: null, fileIdPlayback: null },
    ] };
  });

  // ---- A Biblioteca aberta, folheando, com o álbum aberto ----------------
  await pg.evaluate(() => { openHymnSearch(); });
  if (!await esperar(pg, () => !!document.querySelector('#hymnResults .hymnal-card'),
    'a Biblioteca desenha o card do hinário plantado')) throw new Error('sem card');
  checar(await pg.evaluate(() => acervoAVista()),
    'e `acervoAVista()` concorda — é a mesma pergunta que segura o redesenho');

  await pg.evaluate(() => {
    const card = [...document.querySelectorAll('#hymnResults .hymnal-card')]
      .find((el) => /Hinário/i.test(el.textContent));
    card.querySelector('.coll-bar').click();   // o acordeão de verdade, não `ui().expanded`
  });
  if (!await esperar(pg, () => !!document.querySelector('#hymnResults .coll-songs .hymn-result'),
    'o álbum abre e lista as faixas')) throw new Error('sem faixas');

  // Abre a gaveta da primeira faixa e CARIMBA o nó. O carimbo é o que separa
  // "a gaveta está aberta" de "a gaveta foi remontada e reaberta": só o nó
  // ORIGINAL o carrega, e é nele que moram a letra lida e os destinos marcados.
  const abrirGaveta = () => pg.evaluate(async () => {
    const li = document.querySelector('#hymnResults .coll-songs .hymn-result');
    li.dataset.carimbo = 'oraculo';
    li.querySelector('.hymn-row').click();
  });
  const estado = () => pg.evaluate(() => {
    const li = document.querySelector('#hymnResults .coll-songs .hymn-result');
    return {
      aberta: !!(li && li.classList.contains('expanded')),
      mesmoNo: !!(li && li.dataset.carimbo === 'oraculo'),
      temOpcoes: !!(li && li.querySelector('.hymn-opcoes .song-menu-btn')),
    };
  });

  await abrirGaveta();
  if (!await esperar(pg, () => {
    const li = document.querySelector('#hymnResults .coll-songs .hymn-result');
    return !!li && li.classList.contains('expanded');
  }, 'a gaveta da faixa abre ao toque na linha')) throw new Error('gaveta não abriu');
  let e = await estado();
  checar(e.aberta && e.temOpcoes, 'e ela vem montada, com as opções dentro', e);

  // ---- 1. O HAZARD EXISTE ------------------------------------------------
  // `renderCollectionsNow()` é o que o tique fazia INCONDICIONALMENTE até a
  // v1.1.2. Chamá-lo direto é reproduzir o defeito — sem esta metade, as
  // seguintes provariam que uma função concorda consigo mesma.
  await pg.evaluate(() => renderCollectionsNow());
  e = await estado();
  checar(!e.aberta && !e.mesmoNo,
    'HAZARD: um redesenho não guardado joga fora o `li` e a gaveta volta fechada', e);

  // ---- 2. A MARCA DE ABERTURA É SÍNCRONA ---------------------------------
  // O caso do relato, medido onde ele acontece: no turno do clique, o handler
  // já parou no primeiro `await` e o `expanded` ainda não foi escrito. Se a
  // linha não estiver marcada AQUI, o tique de 400 ms que caia nesta janela
  // remonta a lista e o toque não abre nada.
  const janela = await pg.evaluate(() => {
    const li = document.querySelector('#hymnResults .coll-songs .hymn-result');
    li.dataset.carimbo = 'oraculo';
    li.querySelector('.hymn-row').click();   // o handler é async: para no `await`
    return {
      aindaNaoExpandiu: !li.classList.contains('expanded'),
      jaContaComoAberta: interacaoAbertaNoAcervo(),
    };
  });
  checar(janela.aindaNaoExpandiu,
    'no turno do clique a linha AINDA não está `expanded` — a montagem espera o IndexedDB',
    janela);
  checar(janela.jaContaComoAberta,
    'e mesmo assim `interacaoAbertaNoAcervo()` já a vê: é a marca `abrindo`, escrita antes do primeiro `await`',
    janela);

  if (!await esperar(pg, () => {
    const li = document.querySelector('#hymnResults .coll-songs .hymn-result');
    return !!li && li.classList.contains('expanded');
  }, 'e a gaveta termina de abrir')) throw new Error('gaveta não abriu (2)');

  // ---- 3. O CAMINHO DE VERDADE SEGURA ------------------------------------
  // `setCollStatus` é o que o laço de download chama a cada arquivo — o mesmo
  // ponto, não uma imitação dele. Três tiques de 400 ms cabem no prazo abaixo.
  //
  // E A ESPERA É PELO FATO, não por relógio: um `waitForTimeout` aqui seria uma
  // aposta na máquina (o runner do GitHub é 4 vCPU). O espião conta as
  // CONSULTAS que o próprio tique faz ao guarda — três delas provam que o
  // maquinário rodou três vezes e escolheu adiar, em qualquer velocidade de
  // máquina. Ele é instalado sobre a global (o `controle.js` é script clássico,
  // então a chamada sem qualificador resolve pela mesma propriedade).
  await pg.evaluate(() => {
    const orig = window.interacaoAbertaNoAcervo;
    window.__consultasAoGuarda = 0;
    window.interacaoAbertaNoAcervo = function () {
      window.__consultasAoGuarda++;
      return orig.apply(this, arguments);
    };
    ui('hymnal-2022').syncBusy = true;
    setCollStatus('hymnal-2022', 'Baixando 1 de 2…');
    setCollStatus('hymnal-2022', 'Baixando 2 de 2…');
  });
  await esperar(pg, () => window.__consultasAoGuarda >= 3,
    'o tique do progresso roda e CONSULTA o guarda — três vezes, com a gaveta aberta');
  e = await estado();
  checar(e.aberta && e.mesmoNo && e.temOpcoes,
    'com um download correndo, a gaveta continua aberta — e é o MESMO `li`, não um remontado', e);

  // ---- 4. E A ESPERA TERMINA ---------------------------------------------
  // Sem esta metade, "nunca redesenhar" passaria no caso 3. Fechada a gaveta, o
  // tique seguinte tem de sair com o estado em dia — o card mostra o texto que
  // o download escreveu enquanto ela estava aberta.
  const antesDeFechar = await pg.evaluate(() => {
    const card = [...document.querySelectorAll('#hymnResults .hymnal-card')]
      .find((el) => /Hinário/i.test(el.textContent));
    return /Baixando 2 de 2/.test(card.textContent);
  });
  checar(!antesDeFechar,
    'e o card ainda NÃO mostra o último estado — é o redesenho adiado, não um que passou batido');

  await pg.evaluate(() => {
    document.querySelector('#hymnResults .coll-songs .hymn-result .hymn-row').click();
  });
  await esperar(pg, () => {
    const card = [...document.querySelectorAll('#hymnResults .hymnal-card')]
      .find((el) => /Hinário/i.test(el.textContent));
    return !!card && /Baixando 2 de 2/.test(card.textContent);
  }, 'fechada a gaveta, o redesenho adiado sai sozinho e o card mostra o estado em dia', null, 6000);

  checar(erros.length === 0, 'nenhum erro de console', erros.join(' | '));
} catch (err) {
  checar(false, 'o oráculo rodou até o fim', String(err && err.message ? err.message : err));
} finally {
  await navegador.close();
  servidor.close();
}

console.log('');
if (falhas.length) {
  console.log('FALHARAM ' + falhas.length + ':');
  falhas.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
console.log('Todos passaram.');
