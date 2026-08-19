// A PLAYLIST AUTOMÁTICA, DA FOLHA ATÉ A FILA (v5.302).
//
// ## Por que ele existe, tendo o `sorteio.test.mjs` ao lado
//
// Aquele trava a REGRA — o que pode ser sorteado —, e ele é o oráculo que barra
// o build. Este trava a LIGAÇÃO, que é a metade que a regra pura não alcança e
// que falha de outro jeito: a regra continua certa e o recurso não faz nada.
//
//  - o botão da barra abre a folha, e a folha DESENHA (um id trocado no HTML dá
//    `null` num `getElementById` e o toque vira silêncio);
//  - as capacidades injetadas (`sorteioCap`) apontam para as funções certas do
//    `controle.js` — `ehMusica`/`ehHinario`/`faixas`/`noAparelho` são quatro
//    ponteiros, e um errado devolve um pool plausível e errado;
//  - o CONTADOR responde a cada controle, porque ele é a única coisa que o
//    operador lê antes de o botão disparar sem mais nenhuma tela;
//  - o sorteio CHEGA à fila do player e ao telão, nos dois modos.
//
// O acervo é plantado direto em `collState`/`albumCatalog` (a mesma estrutura
// que `fetchCollectionIndex` preenche, o mesmo caminho do `acervo.test.mjs`) e
// as faixas "já baixadas" são registros de verdade no store `files`, com
// `lyrics` DEFINIDO: é assim que `songVariantsNeeded` decide que não há o que
// baixar, e é o que faz o percurso inteiro rodar sem rede.
//
// Chromium de verdade, sobre a base web servida como no aparelho, SEM
// `__AVBridge` — o caminho de navegador.
//
//   node tools/sorteio-tela.test.mjs
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
    console.log('FALHOU  ' + msg + (obtido !== undefined ? '\n        obtido: ' + JSON.stringify(obtido) : ''));
    falhas.push(msg);
  }
}

await new Promise((r) => servidor.listen(0, r));
const porta = servidor.address().port;
const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
const pg = await ctx.newPage();

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
  await pg.goto(`http://localhost:${porta}/controle/`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(
    () => window.AVDB && window.AVSorteio && typeof window.__avBack === 'function',
    null, { timeout: 20000 },
  );
  // O app abre no simplificado; a folha e a fila do player são do avançado.
  await pg.evaluate(() => setAppMode('full'));

  // ---- O ACERVO DE MENTIRA -------------------------------------------------
  // Um hinário e um álbum "Natal". As duas do hinário e a primeira do álbum já
  // estão no aparelho (registro real no store `files`, com `lyrics` definido);
  // a segunda do álbum não tem arquivo nenhum, para provar a partição.
  await pg.evaluate(async () => {
    const arquivo = async (id, nome) => AVDB.fileAdd({
      id, folder: 'x', name: nome, srcName: nome, type: 'audio/mpeg', kind: 'audio',
      size: 8, lyrics: [], blob: new Blob([new Uint8Array(8)], { type: 'audio/mpeg' }),
    });
    await arquivo('f-h1', 'Noite de Paz (Natal)');
    await arquivo('f-h2', 'Firme nas Promessas');
    await arquivo('f-a1', 'A Estrela do Oriente');
    collState['hymnal-2022'] = { songs: [
      { id_music: 'h1', track: 1, name: 'Noite de Paz (Natal)', duration: '3:00',
        has_instrumental_music: true, fileIdFull: 'f-h1', fileIdPlayback: null },
      { id_music: 'h2', track: 2, name: 'Firme nas Promessas', duration: '3:00',
        has_instrumental_music: false, fileIdFull: 'f-h2', fileIdPlayback: null },
    ] };
    collState['album-9'] = { songs: [
      { id_music: 'a1', name: 'A Estrela do Oriente', duration: '3:00',
        has_instrumental_music: true, fileIdFull: 'f-a1', fileIdPlayback: null },
      { id_music: 'a2', name: 'Anjos Cantam', duration: '3:00',
        has_instrumental_music: true, fileIdFull: null, fileIdPlayback: null },
    ] };
    // `allCollections()` monta os cards de álbum a partir DAQUI — sem esta
    // linha o `album-9` existe no índice e não existe na varredura.
    albumCatalog = { categories: [], albums: [{ id_album: 9, name: 'Natal — Coral', color: null }] };
  });

  // ---- AS CAPACIDADES APONTAM PARA AS FUNÇÕES CERTAS -----------------------
  // Quatro ponteiros, e um errado devolve um pool plausível e errado. Este é o
  // único lugar em que eles podem ser conferidos: a regra pura recebe os de
  // mentira do outro oráculo.
  const cap = await pg.evaluate(() => {
    const c = sorteioCap();
    const hin = allCollections().find((x) => x.id === 'hymnal-2022');
    const alb = allCollections().find((x) => x.id === 'album-9');
    return {
      achouAsDuas: !!hin && !!alb,
      hinarioEhHinario: !!c.ehHinario(hin), albumNaoEhHinario: !!c.ehHinario(alb),
      hinarioEhMusica: !!c.ehMusica(hin),
      faixas: c.faixas(hin).length,
      normSemAcento: c.norm('Gratidão') === c.norm('gratidao'),
      nomeNorm: c.nomeNorm({ name: 'Noite de Paz (Natal)' }).includes('natal'),
      baixada: !!c.noAparelho(hin, collState['hymnal-2022'].songs[0], 'full'),
      // O "está no aparelho?" é por VARIANTE: a cantada baixada não vale pelo
      // playback, e é este par que impede a fila de prometer o que não tem.
      pbNaoBaixado: !c.noAparelho(hin, collState['hymnal-2022'].songs[0], 'playback'),
    };
  });
  checar(cap.achouAsDuas, 'o acervo plantado aparece em allCollections()');
  checar(cap.hinarioEhHinario && !cap.albumNaoEhHinario,
    '`ehHinario` distingue o hinário do álbum — é o filtro "Sem hinário"', cap);
  checar(cap.hinarioEhMusica, '`ehMusica` aceita o acervo de música');
  checar(cap.faixas === 2, '`faixas` devolve as faixas da coleção', cap.faixas);
  checar(cap.normSemAcento && cap.nomeNorm,
    'o normalizador injetado é o da Biblioteca (sem acento, minúsculas)');
  checar(cap.baixada && cap.pbNaoBaixado,
    '`noAparelho` responde POR VARIANTE — a cantada baixada não vale pelo playback', cap);

  // ---- O BOTÃO ABRE A FOLHA, E ELA DESENHA ---------------------------------
  // ESPERA A CONDIÇÃO, NÃO UM PRAZO: o `.popup-backdrop` só recebe o toque
  // depois do fade de 250 ms (`pointer-events` só vale com `.open`), e um
  // `waitForTimeout` menor que ele faz o clique cair no `<main>` de trás — um
  // oráculo que reprova por relógio, não por defeito.
  const assentada = (sel) => pg.waitForFunction((s) => {
    const el = document.querySelector(s);
    if (!el) return false;
    const cs = getComputedStyle(el);
    return cs.pointerEvents !== 'none' && parseFloat(cs.opacity) > 0.99;
  }, sel, { timeout: 10000 });
  await pg.evaluate(() => openHymnSearch());
  await assentada('#hymnSearchPopup');
  const barra = await pg.evaluate(() => {
    const b = document.getElementById('sorteioBtn');
    const x = document.getElementById('hymnSearchClose');
    if (!b || !x) return { erro: 'botão ausente da barra' };
    // O ✕ é o FIM da linha em toda folha deste app: o botão novo vem ANTES.
    return { antesDoX: !!(b.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING) };
  });
  checar(!barra.erro && barra.antesDoX,
    'o botão está na barra da Biblioteca, ANTES do ✕', barra);

  await pg.click('#sorteioBtn');
  await assentada('#sorteioPopup');
  const folha = await pg.evaluate(() => ({
    aberta: document.getElementById('sorteioPopup').classList.contains('open'),
    segmentos: document.querySelectorAll('#sorteioList .fit-seg').length,
    campo: !!document.querySelector('#sorteioList .lib-search'),
    chips: document.querySelectorAll('#sorteioList .misc-chip').length,
    conta: (document.querySelector('#sorteioList .sorteio-conta') || {}).textContent,
    go: !!document.querySelector('#sorteioList .song-menu-go'),
  }));
  checar(folha.aberta, 'o toque no botão ABRE a folha');
  checar(folha.segmentos === 2 && folha.campo && folha.chips === 2 && folha.go,
    'e ela desenha os dois segmentos, o campo, os dois filtros e o confirmar', folha);
  checar(/4 faixas casam/.test(folha.conta) && /3 já no aparelho/.test(folha.conta),
    'a conta diz as DUAS metades — é o que separa "toca agora" de "espera a rede"',
    folha.conta);

  // ---- A PALAVRA TEMA FILTRA, SEM REMONTAR A FOLHA -------------------------
  // O campo é o único controle que pode estar EM FOCO enquanto a conta muda:
  // remontar a lista ali apagaria o foco no meio da palavra.
  await pg.focus('#sorteioList .lib-search');
  await pg.type('#sorteioList .lib-search', 'natal');
  // Além do `SEARCH_DEBOUNCE_MS` (130 ms): a conta é adiada pelo mesmo prazo da
  // busca da Biblioteca, porque recontar varre o acervo inteiro.
  await pg.waitForTimeout(350);
  const comTema = await pg.evaluate(() => ({
    conta: document.querySelector('#sorteioList .sorteio-conta').textContent,
    focado: document.activeElement === document.querySelector('#sorteioList .lib-search'),
    valor: document.querySelector('#sorteioList .lib-search').value,
  }));
  // "natal" casa no NOME de h1 e no ÁLBUM das duas faixas de album-9.
  checar(/3 faixas casam/.test(comTema.conta),
    'a palavra tema filtra: o nome de uma e o ÁLBUM das outras duas', comTema.conta);
  checar(comTema.focado && comTema.valor === 'natal',
    'e o campo NÃO perde o foco a cada tecla — a conta muda sem remontar a folha', comTema);

  // ---- OS FILTROS ----------------------------------------------------------
  const semHinario = await pg.evaluate(async () => {
    sorteioPrefs.semHinario = true; renderSorteio();
    return document.querySelector('#sorteioList .sorteio-conta').textContent;
  });
  checar(/2 faixas casam/.test(semHinario),
    '"Sem hinário" tira as faixas do hinário do pool', semHinario);

  const soPlayback = await pg.evaluate(async () => {
    sorteioPrefs.semHinario = false;
    sorteioPrefs.variante = AVSorteio.VARIANTE_PLAYBACK;
    renderSorteio();
    return document.querySelector('#sorteioList .sorteio-conta').textContent;
  });
  checar(/0 já no aparelho/.test(soPlayback),
    'em Playback nenhuma delas está no aparelho — o "está baixada?" é por variante',
    soPlayback);

  const soLocal = await pg.evaluate(async () => {
    sorteioPrefs.variante = AVSorteio.VARIANTE_CANTADA;
    sorteioPrefs.soNoAparelho = true;
    renderSorteio();
    const conta = document.querySelector('#sorteioList .sorteio-conta').textContent;
    sorteioPrefs.soNoAparelho = false;
    return conta;
  });
  checar(/2 faixas casam · 2 já no aparelho/.test(soLocal),
    '"Só no aparelho" deixa só o que não precisa de download', soLocal);

  // ---- A CONTA VAZIA DIZ O MOTIVO -----------------------------------------
  // O botão dispara sem mais nenhuma tela: esta linha é a única chance de o
  // operador entender por que nada vai acontecer, e "nada casa" tem cinco
  // causas que pedem ações opostas.
  const vazio = await pg.evaluate(() => {
    sorteioPrefs.tema = 'zzzznadaaqui'; renderSorteio();
    const li = document.querySelector('#sorteioList .sorteio-conta');
    const go = document.querySelector('#sorteioList .song-menu-go');
    return { texto: li.textContent, marcada: li.classList.contains('vazio'), travado: go.disabled };
  });
  checar(/zzzznadaaqui/.test(vazio.texto) && vazio.marcada,
    'sem resultado, a conta NOMEIA a palavra que não casou', vazio.texto);
  checar(vazio.travado, 'e o confirmar fica desabilitado — o botão nunca dispara para o nada');

  // ---- MODO "UMA SÓ": vai ao telão ----------------------------------------
  const uma = await pg.evaluate(async () => {
    sorteioPrefs.tema = 'natal';
    sorteioPrefs.modo = AVSorteio.MODO_UMA;
    sorteioPrefs.soNoAparelho = true;   // sem rede neste harness
    renderSorteio();
    await executarSorteio(document.querySelector('#sorteioList .song-menu-go'));
    await new Promise((r) => setTimeout(r, 400));
    return {
      fechou: !document.getElementById('sorteioPopup').classList.contains('open'),
      fila: (await AVDB.listIds('playlist')).length,
      noAr: currentId,
      diario: sorteioDiario && sorteioDiario.escolhidos.length,
    };
  });
  checar(uma.fechou, 'sortear FECHA a folha — a resposta aparece numa tela livre');
  checar(uma.fila === 1 && !!uma.noAr,
    '"uma só" substitui a fila por ELA e a manda ao telão', uma);
  checar(uma.diario === 1, 'e o Registro guarda o veredito da passada que decidiu', uma.diario);

  // ---- MODO "PLAYLIST": monta a fila e toca a primeira --------------------
  const fila = await pg.evaluate(async () => {
    sorteioPrefs.modo = AVSorteio.MODO_PLAYLIST;
    sorteioPrefs.quantos = 3;
    sorteioPrefs.tema = '';            // o acervo inteiro: 3 baixadas
    sorteioPrefs.soNoAparelho = true;
    await abrirSorteio();
    await executarSorteio(document.querySelector('#sorteioList .song-menu-go'));
    await new Promise((r) => setTimeout(r, 600));
    const ids = await AVDB.listIds('playlist');
    return { ids, plItems: plItems.length, noAr: currentId, primeiro: ids[0] };
  });
  checar(fila.ids.length === 3,
    'a fila do player passa a ter as três sorteadas', fila.ids);
  checar(fila.plItems === 3,
    'e `plItems` foi refeito — sem isso `step`/`autoAdvance` andariam pelo array velho',
    fila.plItems);
  checar(fila.noAr === fila.primeiro,
    'e a PRIMEIRA já está no telão (o caminho do `abrirPacote`)', fila);

  // ---- O REGISTRO ---------------------------------------------------------
  const registro = await pg.evaluate(() => blocoSorteio());
  checar(/Playlist automática/.test(registro), 'o Registro ganha o bloco do sorteio');
  checar(/faixas: \d+ vistas/.test(registro) && /sorteado \(3, nesta ordem\)/.test(registro),
    'com a varredura e os nomes escolhidos na ordem em que foram para a fila', registro);
  checar(!/\bundefined\b/.test(registro) && !/\bNaN\b/.test(registro),
    'e nenhum "undefined"/"NaN" — toda linha do bloco é opcional');

  // ---- O VOLTAR DO APARELHO FECHA A FOLHA ---------------------------------
  // Sem a linha em POPUPS o voltar MINIMIZA o app no meio do culto, e o ✕ e o
  // toque no fundo também deixam de fechar: a tabela é a lista única dos três
  // caminhos.
  const voltar = await pg.evaluate(async () => {
    await abrirSorteio();
    const tratou = __avBack();
    return { tratou, aberta: document.getElementById('sorteioPopup').classList.contains('open') };
  });
  checar(voltar.tratou && !voltar.aberta,
    'o voltar do aparelho FECHA a folha em vez de minimizar o app', voltar);

  checar(erros.length === 0, 'nenhum erro de console', erros.slice(0, 3));
} finally {
  await navegador.close();
  servidor.close();
}

console.log('\n' + (falhas.length ? falhas.length + ' FALHA(S)' : 'tudo certo'));
process.exit(falhas.length ? 1 : 0);
