// A PLAYLIST AUTOMÁTICA, DA FOLHA ATÉ A FILA (v5.303).
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
  // A ORDEM DA BARRA é `sortear · procurar · sair`, e ela é medida pela POSIÇÃO
  // NA TELA, não pela ordem no documento: é o que o operador vê, e um `order`
  // de flex acrescentado por engano divorciaria as duas sem que nada reclamasse.
  const barra = await pg.evaluate(() => {
    const b = document.getElementById('sorteioBtn');
    const campo = document.querySelector('.hymn-search-bar .lib-search');
    const x = document.getElementById('hymnSearchClose');
    if (!b || !campo || !x) return { erro: 'a barra não tem as três peças' };
    const esq = (el) => Math.round(el.getBoundingClientRect().left);
    return { sorteio: esq(b), campo: esq(campo), fechar: esq(x) };
  });
  checar(!barra.erro && barra.sorteio < barra.campo,
    'o botão ABRE a barra da Biblioteca — à ESQUERDA do campo de busca', barra);
  checar(!barra.erro && barra.campo < barra.fechar,
    'e o ✕ continua fechando a linha: o fim é a SAÍDA, em toda folha deste app', barra);

  // ---- E ELE TEM DESENHO ---------------------------------------------------
  // O botão saiu ao ar MUDO: o glifo `casino` não está no subset da fonte, e um
  // codepoint ausente não desenha nada — sem erro, sem requisição falhando, só
  // um vão do tamanho de um ícone. Quem impede a reincidência por CODEPOINT é
  // o `tools/glifos.test.mjs`; esta linha cobre a outra metade, que ele não
  // alcança: um `<use href="#icoX">` apontando para um símbolo que não existe
  // no sprite dá exatamente o mesmo vão, e o href é uma string.
  const desenho = await pg.evaluate(() => {
    const b = document.getElementById('sorteioBtn');
    const uso = b && b.querySelector('svg use');
    const alvo = uso && document.querySelector(uso.getAttribute('href'));
    const r = uso ? uso.getBoundingClientRect() : null;
    return {
      temSvg: !!uso,
      href: uso ? uso.getAttribute('href') : '',
      simboloExiste: !!alvo,
      // O símbolo precisa ter GEOMETRIA: um `<symbol>` vazio resolve o href e
      // continua não desenhando nada.
      formas: alvo ? alvo.children.length : 0,
      largura: r ? Math.round(r.width) : 0,
    };
  });
  checar(desenho.temSvg && desenho.simboloExiste,
    'o botão desenha um SVG e o `<use>` aponta para um símbolo QUE EXISTE no sprite',
    desenho);
  checar(desenho.formas >= 2 && desenho.largura >= 12,
    'e o símbolo tem geometria e é pintado com tamanho de ícone', desenho);

  // ---- E ELE TEM CONTRASTE, NOS DOIS TEMAS ---------------------------------
  // O botão vive sobre o CAMPO, que é branco literal e SEM TEMA. Pintá-lo com
  // um token redeclarado por tema (`--accent`) dava 2,06:1 no escuro — abaixo
  // do piso de 3:1 de componente, e o relato do operador foi exatamente esse.
  // A conta é feita sobre a cor COMPUTADA, não sobre o nome do token: comparar
  // nomes deixaria o defeito passar por baixo (a lição do `smoke.mjs`).
  const contraste = await pg.evaluate(async () => {
    const lum = (cor) => {
      const [r, g, b] = cor.match(/[\d.]+/g).slice(0, 3).map(Number).map((c) => c / 255);
      const f = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const medir = () => {
      const b = document.getElementById('sorteioBtn');
      const cs = getComputedStyle(b);
      const a = lum(cs.color); const f = lum(cs.backgroundColor);
      return Math.round(((Math.max(a, f) + 0.05) / (Math.min(a, f) + 0.05)) * 100) / 100;
    };
    const fora = {};
    for (const tema of ['escuro', 'claro']) {
      setTema(tema); await new Promise((r) => setTimeout(r, 60));
      fora[tema] = medir();
    }
    setTema('escuro');
    return fora;
  });
  checar(contraste.escuro >= 3 && contraste.claro >= 3,
    'o ícone tem contraste de COMPONENTE (≥3:1) sobre o campo NOS DOIS TEMAS — '
    + 'o campo é branco literal e não segue o tema, então um token que siga o '
    + 'tema erra num deles', contraste);

  await pg.click('#sorteioBtn');
  await assentada('#sorteioPopup');
  // A conta é DUAS linhas (forte + fraca): ler o `textContent` do `<li>` as cola
  // sem separador e faz um `/x · y/` casar por acidente. O oráculo lê os dois
  // spans, que é a estrutura que ele existe para travar.
  const lerConta = () => pg.evaluate(() => {
    const li = document.querySelector('#sorteioList .sorteio-conta');
    const f = li && li.querySelector('.sorteio-conta-forte');
    const w = li && li.querySelector('.sorteio-conta-fraca');
    return { forte: f ? f.textContent : '', fraca: w ? w.textContent : '',
      vazia: !!li && li.classList.contains('vazio') };
  });
  const folha = await pg.evaluate(() => ({
    aberta: document.getElementById('sorteioPopup').classList.contains('open'),
    segmentos: document.querySelectorAll('#sorteioList .fit-seg').length,
    campo: !!document.querySelector('#sorteioList .lib-search'),
    chips: document.querySelectorAll('#sorteioList .misc-chip').length,
    go: !!document.querySelector('#sorteioList .song-menu-go'),
  }));
  const conta0 = await lerConta();
  checar(folha.aberta, 'o toque no botão ABRE a folha');
  checar(folha.segmentos === 2 && folha.campo && folha.chips === 2 && folha.go,
    'e ela desenha os dois segmentos, o campo, os dois filtros e o confirmar', folha);
  checar(/^Toda a biblioteca — 4 músicas$/.test(conta0.forte) && /3 já baixadas/.test(conta0.fraca),
    'sem palavra, a conta LIDERA COM O ESCOPO: o acervo inteiro entra no sorteio',
    conta0);

  // ---- A PALAVRA TEMA FILTRA, SEM REMONTAR A FOLHA -------------------------
  // O campo é o único controle que pode estar EM FOCO enquanto a conta muda:
  // remontar a lista ali apagaria o foco no meio da palavra.
  await pg.focus('#sorteioList .lib-search');
  await pg.type('#sorteioList .lib-search', 'natal');
  // Além do `SEARCH_DEBOUNCE_MS` (130 ms): a conta é adiada pelo mesmo prazo da
  // busca da Biblioteca, porque recontar varre o acervo inteiro.
  await pg.waitForTimeout(350);
  const comTema = await pg.evaluate(() => ({
    focado: document.activeElement === document.querySelector('#sorteioList .lib-search'),
    valor: document.querySelector('#sorteioList .lib-search').value,
  }));
  comTema.conta = (await lerConta()).forte;
  // "natal" casa no NOME de h1 e no ÁLBUM das duas faixas de album-9.
  checar(/3 músicas relacionadas a “natal”/.test(comTema.conta),
    'a palavra tema filtra, e a frase a NOMEIA: o nome de uma e o álbum das outras duas',
    comTema.conta);
  checar(comTema.focado && comTema.valor === 'natal',
    'e o campo NÃO perde o foco a cada tecla — a conta muda sem remontar a folha', comTema);

  // ---- OS FILTROS ----------------------------------------------------------
  const semHinario = await pg.evaluate(async () => {
    sorteioPrefs.semHinario = true; renderSorteio();
    return document.querySelector('#sorteioList .sorteio-conta-forte').textContent;
  });
  checar(/2 músicas relacionadas/.test(semHinario),
    '"Sem hinário" tira as faixas do hinário do pool', semHinario);

  const soPlayback = await pg.evaluate(async () => {
    sorteioPrefs.semHinario = false;
    sorteioPrefs.variante = AVSorteio.VARIANTE_PLAYBACK;
    renderSorteio();
    return document.querySelector('#sorteioList .sorteio-conta-fraca').textContent;
  });
  checar(/nenhuma baixada ainda/.test(soPlayback),
    'em Playback nenhuma delas está no aparelho — o "está baixada?" é por variante',
    soPlayback);

  const soLocal = await pg.evaluate(async () => {
    sorteioPrefs.variante = AVSorteio.VARIANTE_CANTADA;
    sorteioPrefs.soNoAparelho = true;
    renderSorteio();
    const li = document.querySelector('#sorteioList .sorteio-conta');
    const conta = li.querySelector('.sorteio-conta-forte').textContent
      + ' | ' + li.querySelector('.sorteio-conta-fraca').textContent;
    sorteioPrefs.soNoAparelho = false;
    return conta;
  });
  checar(/2 músicas relacionadas/.test(soLocal) && /todas já baixadas/.test(soLocal),
    '"Só no aparelho" deixa só o que não precisa de download', soLocal);

  // ---- SEM PALAVRA, A FRASE É HONESTA SOBRE OS FILTROS ---------------------
  // Dizer "toda a biblioteca" com o hinário fora seria uma frase ERRADA, e uma
  // frase errada é pior que nenhuma: ela produz a decisão errada.
  const escopos = await pg.evaluate(() => {
    const ler = () => document.querySelector('#sorteioList .sorteio-conta-forte').textContent;
    const antes = { ...sorteioPrefs };
    sorteioPrefs.tema = '';
    const fora = {};
    sorteioPrefs.semHinario = false; sorteioPrefs.soNoAparelho = false;
    renderSorteio(); fora.tudo = ler();
    sorteioPrefs.semHinario = true;
    renderSorteio(); fora.semHinario = ler();
    sorteioPrefs.semHinario = false; sorteioPrefs.soNoAparelho = true;
    renderSorteio(); fora.soLocal = ler();
    sorteioPrefs.semHinario = true;
    renderSorteio(); fora.ambos = ler();
    Object.assign(sorteioPrefs, antes); renderSorteio();
    return fora;
  });
  checar(/^Toda a biblioteca — \d+ músicas?$/.test(escopos.tudo),
    'sem filtro nenhum ela diz “toda a biblioteca”, sem ressalva', escopos.tudo);
  checar(/Toda a biblioteca, sem o hinário/.test(escopos.semHinario),
    'com o hinário fora ela RESSALVA — "toda" seria uma frase errada', escopos.semHinario);
  checar(/^Só o que já está no aparelho — /.test(escopos.soLocal),
    'com "Só no aparelho" o escopo deixa de ser a biblioteca e ela o diz', escopos.soLocal);
  checar(/^Só o que já está no aparelho, sem o hinário — /.test(escopos.ambos),
    'e os dois filtros juntos aparecem juntos', escopos.ambos);
  const dica = await pg.evaluate(() => document.querySelector('#sorteioList .lib-search').placeholder);
  checar(/vazio/i.test(dica) && /biblioteca/i.test(dica),
    'e o próprio campo diz o que o vazio significa — a pergunta nasce ali', dica);

  // ---- A CONTA VAZIA DIZ O MOTIVO -----------------------------------------
  // O botão dispara sem mais nenhuma tela: esta linha é a única chance de o
  // operador entender por que nada vai acontecer, e "nada casa" tem cinco
  // causas que pedem ações opostas.
  const vazio = await pg.evaluate(() => {
    sorteioPrefs.tema = 'zzzznadaaqui'; renderSorteio();
    const li = document.querySelector('#sorteioList .sorteio-conta');
    const go = document.querySelector('#sorteioList .sorteio-acao');
    return { texto: li.textContent, marcada: li.classList.contains('vazio'), travado: go.disabled };
  });
  checar(/zzzznadaaqui/.test(vazio.texto) && vazio.marcada,
    'sem resultado, a conta NOMEIA a palavra que não casou', vazio.texto);
  checar(!/casam|no aparelho|faixas/.test(vazio.texto),
    'e ela não volta ao vocabulário da varredura ("casam", "faixas", "no aparelho")',
    vazio.texto);
  checar(vazio.travado, 'e o confirmar fica desabilitado — o botão nunca dispara para o nada');

  // ---- MODO "UMA SÓ": vai ao telão ----------------------------------------
  const uma = await pg.evaluate(async () => {
    sorteioPrefs.tema = 'natal';
    sorteioPrefs.modo = AVSorteio.MODO_UMA;
    sorteioPrefs.soNoAparelho = true;   // sem rede neste harness
    renderSorteio();
    await executarSorteio(document.querySelector('#sorteioList .song-menu-go'), 'tocar');
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
    await executarSorteio(document.querySelector('#sorteioList .song-menu-go'), 'tocar');
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

  // ---- MONTANDO A FILA HÁ DOIS DESFECHOS (v5.306) -------------------------
  // Eles não são duas versões da mesma ação: um TOCA (substitui a fila do player
  // e projeta) e o outro GUARDA (acrescenta ao Cronograma sem tocar no que está
  // no ar). O teste separa os dois pelo EFEITO, que é o único jeito de provar
  // que o segundo botão não é o primeiro com outro rótulo.
  const faixa = await pg.evaluate(async () => {
    sorteioPrefs.modo = AVSorteio.MODO_PLAYLIST;
    await abrirSorteio();
    const bs = [...document.querySelectorAll('#sorteioList .sorteio-acao')];
    return bs.map((b) => b.textContent.trim());
  });
  checar(faixa.length === 2 && /Tocar agora/.test(faixa[0]) && /Cronograma/.test(faixa[1]),
    'montando a fila a faixa de fecho tem DOIS botões: tocar e guardar', faixa);

  const umaSo = await pg.evaluate(async () => {
    sorteioPrefs.modo = AVSorteio.MODO_UMA; renderSorteio();
    const n = document.querySelectorAll('#sorteioList .sorteio-acao').length;
    sorteioPrefs.modo = AVSorteio.MODO_PLAYLIST; renderSorteio();
    return n;
  });
  checar(umaSo === 1,
    'e sorteando UMA SÓ continua sendo um: guardar uma música é o caminho da '
    + 'gaveta da Biblioteca, com ela à vista', umaSo);

  // O EFEITO do "Ao Cronograma": entra na lista `imports` e NÃO mexe no que
  // está no ar nem na fila do player. É esta a diferença que o botão promete.
  const guardou = await pg.evaluate(async () => {
    const filaAntes = await AVDB.listIds('playlist');
    const noArAntes = currentId;
    sorteioPrefs.quantos = 3; sorteioPrefs.tema = ''; sorteioPrefs.soNoAparelho = true;
    renderSorteio();
    const btn = [...document.querySelectorAll('#sorteioList .sorteio-acao')]
      .find((b) => /Cronograma/.test(b.textContent));
    await executarSorteio(btn, 'cronograma');
    await new Promise((r) => setTimeout(r, 600));
    return {
      cronograma: (await AVDB.listIds('imports')).length,
      filaIgual: JSON.stringify(await AVDB.listIds('playlist')) === JSON.stringify(filaAntes),
      noArIgual: currentId === noArAntes,
      aberta: document.getElementById('sorteioPopup').classList.contains('open'),
      fala: (document.querySelector('#sorteioList .sorteio-conta-forte') || {}).textContent,
    };
  });
  checar(guardou.cronograma === 3, 'as três sorteadas entram no Cronograma', guardou);
  checar(guardou.filaIgual && guardou.noArIgual,
    'e ele NÃO mexe na fila do player nem no que está no telão — é a diferença '
    + 'que separa os dois botões', guardou);
  checar(guardou.aberta,
    'a folha FICA ABERTA: guardar não encerra a conversa, e o segundo sorteio é o uso normal');
  checar(/adicionad/i.test(guardou.fala || ''),
    'e a conta empresta a si mesma para dizer quantas entraram', guardou.fala);

  // REPETIR O MESMO SORTEIO tem de dizer que elas já estavam lá — senão o
  // operador repete o toque achando que não funcionou.
  const denovo = await pg.evaluate(async () => {
    const btn = [...document.querySelectorAll('#sorteioList .sorteio-acao')]
      .find((b) => /Cronograma/.test(b.textContent));
    await executarSorteio(btn, 'cronograma');
    await new Promise((r) => setTimeout(r, 600));
    return {
      total: (await AVDB.listIds('imports')).length,
      fala: (document.querySelector('#sorteioList .sorteio-conta-forte') || {}).textContent,
    };
  });
  checar(denovo.total === 3, 'sortear de novo não duplica o que já está no Cronograma', denovo);
  checar(/j[áa] estav|j[áa] est[áa]/i.test(denovo.fala || ''),
    'e a frase o DIZ, em vez de parecer que o toque não fez nada', denovo.fala);

  // ---- FECHAR LIMPA A CAIXA DA PALAVRA (v5.307) ---------------------------
  // Medido pelos TRÊS caminhos de fechamento, porque a tabela `POPUPS` liga os
  // três à mesma função e um deles poderia ter sido esquecido. A folha é
  // reaberta noutro momento do culto, para outra coisa: o campo preenchido a
  // espera com um filtro que ela não pediu.
  const limpou = {};
  for (const caminho of ['fecharSorteio', 'voltar', 'fundo']) {
    limpou[caminho] = await pg.evaluate(async (via) => {
      await abrirSorteio();
      sorteioPrefs.tema = 'gratidão'; renderSorteio();
      const antes = document.querySelector('#sorteioList .lib-search').value;
      if (via === 'fecharSorteio') fecharSorteio();
      else if (via === 'voltar') __avBack();
      else document.getElementById('sorteioPopup').click();
      await new Promise((r) => setTimeout(r, 80));
      await abrirSorteio();
      const depois = document.querySelector('#sorteioList .lib-search').value;
      const forte = document.querySelector('#sorteioList .sorteio-conta-forte').textContent;
      fecharSorteio();
      return { antes, depois, forte };
    }, caminho);
  }
  for (const [caminho, r] of Object.entries(limpou)) {
    checar(r.antes === 'gratidão' && r.depois === '',
      'fechar por "' + caminho + '" limpa a caixa da palavra tema', r);
  }
  // A frase é a do ESCOPO e não a do tema — sem citar "gratidão" nem "relacionadas
  // a". O prefixo dela depende dos filtros que estiverem ligados neste ponto do
  // teste, e é justamente isso que a asserção NÃO deve fixar: o que importa é
  // que a palavra de antes não escopa mais o sorteio.
  checar(!/gratidão|relacionadas a/.test(limpou.fecharSorteio.forte)
    && / — \d+ músicas?$/.test(limpou.fecharSorteio.forte),
    'e a folha reabre sorteando pelo ESCOPO, não pelo tema de antes',
    limpou.fecharSorteio.forte);

  // A PALAVRA NÃO ATRAVESSA UMA SESSÃO: as outras cinco escolhas são ajustes e
  // ficam gravadas; ela é uma pergunta feita uma vez.
  const gravado = await pg.evaluate(async () => {
    await abrirSorteio();
    sorteioPrefs.tema = 'cruz'; sorteioPrefs.quantos = 15;
    saveSorteioPrefs(); fecharSorteio();
    return await AVDB.getState('sorteioPrefs');
  });
  checar(gravado && gravado.tema === undefined && gravado.quantos === 15,
    'a palavra não é gravada; a quantidade é — ajuste fica, pergunta não', gravado);

  // ---- A PALAVRA VALE NO MESMO TOQUE --------------------------------------
  // O `debounce` cobria a ATRIBUIÇÃO também: digitar e tocar no botão dentro dos
  // 130 ms sorteava com a palavra ANTERIOR, sem erro e sem sinal.
  await pg.evaluate(async () => { await abrirSorteio(); });
  await pg.focus('#sorteioList .lib-search');
  await pg.type('#sorteioList .lib-search', 'natal');
  const naHora = await pg.evaluate(() => sorteioPrefs.tema);
  checar(naHora === 'natal',
    'a palavra digitada vale NO MESMO INSTANTE — só a recontagem é adiada', naHora);
  await pg.evaluate(() => { sorteioPrefs.tema = ''; fecharSorteio(); });

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
