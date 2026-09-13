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
//    `controle.js` — `norm`/`nomeNorm`/`ehMusica`/`ehHinario`/`faixas`/
//    `letraCasa`/`noAparelho` são SETE ponteiros, e um errado devolve um pool
//    plausível e errado;
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
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import {
  servirEstatico, abrirNavegador, checar, falhas,
  esperar, porque, esperarCortina, lerPng, pixel, luminancia,
} from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');

const servidor = servirEstatico(RAIZ);

await new Promise((r) => servidor.listen(0, r));
const porta = servidor.address().port;
const navegador = await abrirNavegador();
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);
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
  // O SINAL FORTE, e o `<li>` é a parte que importa: `AVDB && AVSorteio &&
  // __avBack` prova que os arquivos foram PARSEADOS, não que o `init()`
  // terminou — e o `init()` começa por `loadCollections()`, que faz
  // `collState = {}`. Este oráculo planta `collState` logo abaixo, então sem o
  // marcador a fixture pode ser apagada depois de montada (o defeito que
  // reprovou o `acervo.test.mjs` no runner, medido a 60× de estrangulamento).
  await pg.waitForFunction(
    () => window.AVDB && window.AVSorteio && typeof window.__avBack === 'function'
      && (!!document.querySelector('#playlist li') || document.getElementById('plBtn').disabled),
    null, { timeout: 30000 },
  );
  // O app abre no simplificado; a folha e a fila do player são do avançado.
  await pg.evaluate(() => setAppMode('full'));

  // ---- O ACERVO DE MENTIRA -------------------------------------------------
  // Um hinário e um álbum "Natal". As duas do hinário e a primeira do álbum já
  // estão no aparelho (registro real no store `files`, com `lyrics` definido);
  // a segunda do álbum não tem arquivo nenhum, para provar a partição.
  await pg.evaluate(async () => {
    const arquivo = async (id, nome, letra) => AVDB.fileAdd({
      id, folder: 'x', name: nome, srcName: nome, type: 'audio/mpeg', kind: 'audio',
      size: 8, lyrics: letra || [], blob: new Blob([new Uint8Array(8)], { type: 'audio/mpeg' }),
    });
    await arquivo('f-h1', 'Noite de Paz (Natal)');
    // O PLAYBACK de h1 também está no aparelho: é ele que torna o percurso do
    // "som de fundo" exercível sem rede.
    await arquivo('p-h1', 'Noite de Paz (Natal) (Playback)');
    // A FAIXA QUE SÓ CASA NA LETRA. "peregrino" não aparece em título nenhum
    // nem no nome de álbum nenhum deste acervo: o único caminho até ela é o
    // índice de letras, e é isso que faz `casou: 'letra'` provar o ponteiro
    // `letraCasa` em vez de provar um casamento por nome que passaria igual.
    // Os slides são a segunda fonte do índice (`stanzasFromSlides`), a que
    // cobre o que está baixado no aparelho.
    await arquivo('f-h2', 'Firme nas Promessas',
      [{ text: 'Sou peregrino nesta terra\nRumo à pátria celestial', auxText: 'Estrofe 1' }]);
    await arquivo('f-a1', 'A Estrela do Oriente');
    await arquivo('f-h3', 'Castelo Forte');
    await arquivo('p-h3', 'Castelo Forte (playback)');
    collState['hymnal-2022'] = { songs: [
      { id_music: 'h1', track: 1, name: 'Noite de Paz (Natal)', duration: '3:00',
        has_instrumental_music: true, fileIdFull: 'f-h1', fileIdPlayback: 'p-h1' },
      { id_music: 'h2', track: 2, name: 'Firme nas Promessas', duration: '3:00',
        has_instrumental_music: false, fileIdFull: 'f-h2', fileIdPlayback: null },
      // O SEGUNDO PLAYBACK BAIXADO (v1.8.56). O pool de playback tinha UM item,
      // e com um item só o sorteio não produz mais um pacote — desde este lote
      // uma música sorteada entra como a LINHA dela, nunca como um pacote de
      // um. Sem este terceiro hino a asserção do "Fundo musical" media o
      // caminho da música solta achando que media o do pacote.
      { id_music: 'h3', track: 3, name: 'Castelo Forte', duration: '3:00',
        has_instrumental_music: true, fileIdFull: 'f-h3', fileIdPlayback: 'p-h3' },
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
    // O ÍNDICE DE LETRAS FAZ PARTE DO ACERVO PLANTADO. Ele é montado sob
    // demanda (a folha o pede em `abrirSorteio`) e `lyricMatch` devolve `null`
    // enquanto ele não existe — conferir `letraCasa` antes disso aprovaria o
    // ponteiro por VÁCUO.
    await ensureLyricIndex();
  });

  // ---- AS CAPACIDADES APONTAM PARA AS FUNÇÕES CERTAS -----------------------
  // SETE ponteiros, e um errado devolve um pool plausível e errado. Este é o
  // único lugar em que eles podem ser conferidos: a regra pura recebe os de
  // mentira do outro oráculo.
  // ===== PEDIR UMA QUANTIDADE, DEPOIS DA v1.8.85 =====
  //
  // `sorteioPrefs.quantos` deixou de ser o estado do lote: quem decide é a
  // MARCA, e a pílula de quantidade é um atalho que semeia as N primeiras. Um
  // bloco que só escreve a preferência herda o lote do bloco ANTERIOR — foi
  // assim que quatro asserções deste arquivo passaram a medir uma fila de três
  // onde pediam uma.
  //
  // O ajudante faz o que o `abrirSorteio` faz: zera a marca e a impressão do
  // pool, para que a passada seguinte semeie por `quantos`. Ele NÃO chama
  // `sorteioSemear` direto de propósito — o baralho pode estar velho (o filtro
  // que o bloco acabou de mexer ainda não foi lido), e semear sobre ele marcaria
  // chaves de um pool que já não existe.
  await pg.evaluate(() => {
    window.__quantas = (q) => {
      sorteioPrefs.quantos = q;
      sorteioMarcadas = new Set();
      sorteioBaralhoChave = '';
    };
  });

  const cap = await pg.evaluate(async () => {
    await ensureLyricIndex();   // ver o comentário do `soLetra`, logo abaixo
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
      // O "está no aparelho?" é por VARIANTE, e a prova é uma faixa com a
      // CANTADA baixada e o PLAYBACK não (a1): é este par que impede a fila de
      // prometer o que não tem. (h1 tem as duas, e serve ao percurso do som de
      // fundo.)
      pbNaoBaixado: !c.noAparelho(alb, collState['album-9'].songs[0], 'playback')
        && !!c.noAparelho(alb, collState['album-9'].songs[0], 'full'),
      // `letraCasa` é o `lyricMatch`, e é o ponteiro que erra mais calado:
      // trocada a ordem dos argumentos ele devolve `null` para tudo, o sorteio
      // para de achar o que casa SÓ na letra e o pool continua plausível. As
      // duas metades são necessárias — a positiva prende o ponteiro, a negativa
      // prova que não é um `true` solto.
      letraCasaNaLetra: !!c.letraCasa(hin, collState['hymnal-2022'].songs[1], 'peregrino'),
      letraCasaSoNela: !c.letraCasa(hin, collState['hymnal-2022'].songs[0], 'peregrino'),
    };
  });
  checar(cap.achouAsDuas, 'o acervo plantado aparece em allCollections()');
  checar(cap.hinarioEhHinario && !cap.albumNaoEhHinario,
    '`ehHinario` distingue o hinário do álbum — é o filtro "Sem hinário"', cap);
  checar(cap.hinarioEhMusica, '`ehMusica` aceita o acervo de música');
  checar(cap.faixas === 3, '`faixas` devolve as faixas da coleção', cap.faixas);
  checar(cap.normSemAcento && cap.nomeNorm,
    'o normalizador injetado é o da Biblioteca (sem acento, minúsculas)');
  checar(cap.baixada && cap.pbNaoBaixado,
    '`noAparelho` responde POR VARIANTE — a cantada baixada não vale pelo playback', cap);
  checar(cap.letraCasaNaLetra && cap.letraCasaSoNela,
    '`letraCasa` é o `lyricMatch` — acha a faixa cujo tema só existe na LETRA, e só ela',
    cap);

  // ---- E O CAMINHO SÓ-PELA-LETRA CHEGA AO POOL -----------------------------
  // O ponteiro conferido acima prova a LIGAÇÃO; esta linha prova o DESFECHO.
  // `ondeCasa` tenta nome, álbum e letra nessa ordem, e o `casou` que sai dali é
  // o que a folha e o Registro mostram ao operador ("casou na letra"). Sem ela,
  // um `letraCasa` certo e um `ondeCasa` que nunca o consultasse passariam
  // iguais.
  //
  // E O ÍNDICE É GARANTIDO AQUI DENTRO, não lá em cima. `syncLyrics` sai da
  // abertura SEM `await` e o `finally` dela chama `invalidateLyricIndex()` — sob
  // carga esse `finally` cai ENTRE o `evaluate` das capacidades e este, e o que
  // sai é um pool VAZIO com `letraCasa` tendo passado dois `checar` antes. Não é
  // defeito do app (invalidar depois de mexer no acervo é o certo) nem prazo a
  // somar: é que quem chama `montarPool` DIRETO pula o `abrirSorteio`, que é o
  // ponto onde a folha de verdade garante o índice. Então este oráculo o
  // garante. MEDIDO: 1 reprovação em 4 rodadas da suíte em paralelo, e nenhuma
  // em 8 execuções isoladas a 4× de carga — a janela é a do agendador, não a da
  // CPU.
  const soLetra = await pg.evaluate(async () => {
    await ensureLyricIndex();
    const pool = AVSorteio.montarPool(allCollections(), { tema: 'peregrino' }, sorteioCap());
    return {
      nomes: pool.itens.map((i) => i.s.name),
      casou: pool.itens.map((i) => i.casou),
      contagem: pool.casaram[AVSorteio.CASOU_LETRA] || 0,
      esperado: AVSorteio.CASOU_LETRA,
    };
  });
  checar(soLetra.nomes.length === 1 && soLetra.nomes[0] === 'Firme nas Promessas'
    && soLetra.casou[0] === soLetra.esperado && soLetra.contagem === 1,
    'a faixa cujo tema só aparece na LETRA entra no pool, e entra como `casou: "letra"`',
    soLetra);

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
    // A BARRA MUDOU DE CASA na v1.5.0 (a `.lib-bar` da caixa de controles), e o
    // ✕ virou um ALTERNADOR — seta quando a Biblioteca está fechada. A ORDEM
    // que este caso mede é a mesma: *sortear* · *procurar* · *sair*.
    const campo = document.querySelector('.lib-bar .lib-search');
    const x = document.getElementById('hymnSearchToggle');
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
  // O relato que abriu o caso (v5.303) foi um ícone ilegível: o botão vivia
  // sobre o CAMPO, branco literal e SEM TEMA, e `--accent` — que é redeclarado
  // por tema — dava 2,06:1 no escuro, abaixo do piso de 3:1 de componente.
  //
  // A v1.5.2 desfez a premissa e manteve a propriedade: o botão deixou de viver
  // sobre um campo branco e passou a vestir `--surface`, o tom dos botões do
  // transporte (*"vamos usar apenas os botões e a caixa de texto do mesmo tom
  // que os botões do controle"*). A superfície voltou a ter tema, e `--accent`
  // voltou a ser o token certo — o que NÃO muda é que o glifo precisa ser
  // legível nos dois.
  //
  // A CONTA COMPÕE O ALFA (v1.5.2), e essa metade é nova: `--surface` é branco
  // (ou preto) COM ALFA, e medir a luminância da cor crua trata rgba(255,255,
  // 255,.12) como branco — o número sai errado nos dois sentidos. A composição é
  // sobre a caixa de controles, que é onde a barra de fato pousa. É a mesma
  // conta do `smoke.mjs`, e continua sendo sobre a cor COMPUTADA: comparar
  // nomes de token deixaria o defeito passar por baixo.
  const contraste = await pg.evaluate(async () => {
    const rgb = (v) => (Array.isArray(v) ? v : (v.match(/[\d.]+/g) || []).map(Number));
    const sobre = (frente, base) => {
      const f = rgb(frente); const b = rgb(base);
      const a = f.length > 3 ? f[3] : 1;
      return [0, 1, 2].map((i) => f[i] * a + b[i] * (1 - a));
    };
    const lum = (cor) => {
      const [r, g, b] = rgb(cor).slice(0, 3).map((c) => c / 255);
      const f = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const medir = () => {
      const cs = getComputedStyle(document.getElementById('sorteioBtn'));
      const caixa = getComputedStyle(document.querySelector('.bottombar')).backgroundColor;
      const fundo = sobre(cs.backgroundColor, caixa);
      const a = lum(sobre(cs.color, fundo)); const f = lum(fundo);
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
    'o ícone tem contraste de COMPONENTE (≥3:1) sobre o fundo dele NOS DOIS '
    + 'TEMAS — a conta compõe o alfa da superfície sobre a caixa de controles, '
    + 'senão ela mede um branco que não existe', contraste);

  await pg.click('#sorteioBtn');
  await assentada('#sorteioPopup');
  // O RESULTADO PASSOU A SER A PÍLULA MAIS A LISTA (v1.8.84). Era um cartão de
  // uma frase, e o operador o tirou: *"repete as informações que já temos nas
  // seleções acima, como os filtros usados, e etc… Uma ação inútil, pois
  // literalmente já há a visão das seleções."* O que este arquivo media naquelas
  // frases eram FATOS sobre o pool — cada filtro encolhe, e eles compõem —, e os
  // fatos continuam: agora se leem no NÚMERO e no comprimento da lista.
  const lerResultado = () => pg.evaluate(() => {
    const pil = document.querySelector('#sorteioList .sorteio-res-cab');
    const res = document.querySelector('#sorteioList .sorteio-res');
    return {
      n: pil ? Number((pil.textContent.match(/\d+/) || [-1])[0]) : -1,
      linhas: document.querySelectorAll('#sorteioList .sorteio-res-btn').length,
      vai: document.querySelectorAll('#sorteioList .sorteio-res-btn.vai').length,
      vazia: !!res && res.classList.contains('vazio'),
      motivo: res ? (res.querySelector('.sorteio-res-vazio') || {}).textContent || '' : '',
    };
  });
  const folha = await pg.evaluate(() => ({
    aberta: document.getElementById('sorteioPopup').classList.contains('open'),
    segmentos: document.querySelectorAll('#sorteioList .fit-seg').length,
    campo: !!document.querySelector('#sorteioList .lib-search'),
    // AS LINHAS SÃO ACHADAS PELA CLASSE, e não pelo RÓTULO (v1.8.96): os dois
    // rótulos ("Filtros", "Quantas") saíram do DOM, e um seletor que procurasse
    // o texto deles devolve ZERO chip com a linha inteira de pé — uma
    // reprovação que descreve o lugar errado. A de quantidade é a `--quantas` e
    // a de filtros é a OUTRA; aquela não tem mais pílula nenhuma (virou a
    // roleta — ver o bloco do fim), e é por isso que contar as duas juntas
    // voltou a ser uma medida só.
    chips: document.querySelectorAll('#sorteioList .misc-chip').length,
    filtros: document.querySelectorAll(
      '#sorteioList .sorteio-linha:not(.sorteio-linha--quantas) .misc-chip').length,
    go: !!document.querySelector('#sorteioPopup .song-menu-go'),
  }));
  const conta0 = await lerResultado();
  checar(folha.aberta, 'o toque no botão ABRE a folha');
  // ---- E ELA DESCE DO TETO (v1.2.3) ----
  // A regra de ORIGEM: a gaveta entra pela borda do botão que a abre, e o dado
  // mora na barra de busca da Biblioteca, que é o primeiro elemento sob o
  // cabeçalho. (A outra folha do teto é Configurações; o `smoke.mjs` mede as
  // duas metades da regra, com uma de baixo ao lado para provar que ela é sobre
  // ORIGEM e não "toda folha nasce no teto".)
  //
  // A espera é pelo FIM DA TRANSIÇÃO, nunca pela posição que se vai afirmar: o
  // `assentada` acima olha a OPACIDADE do backdrop (.25s), e a folha desliza em
  // .3s — medida ali ela responderia o ponto de partida do transform.
  await pg.waitForFunction(() => {
    const el = document.querySelector('#sorteioPopup .popup-sheet');
    return !!el && el.getAnimations().every((a) => a.playState !== 'running');
  }, null, { timeout: 5000 });
  const origem = await pg.$eval('#sorteioPopup .popup-sheet', (el) => {
    const r = el.getBoundingClientRect();
    return { topo: Math.round(r.top), raio: getComputedStyle(el).borderRadius };
  });
  checar(origem.topo === 0 && /^0px 0px \S+ \S+$/.test(origem.raio),
    'e ela ENCOSTA NO TETO, com os cantos arredondados embaixo — o botão dela '
    + 'está no alto da Biblioteca', origem);
  // UM SEGMENTO SÓ desde a v1.8.61: o do MODO ("Tocar uma só" × "Montar
  // playlist") virou o `1` da linha "Quantas", a pedido do operador — *"não
  // coloque mais opção de playlist ou uma música só, integre isso nas opções de
  // quantidade, afinal a única diferença é quantidade"*. Sobra o da VARIANTE
  // (Cantada × Fundo musical), que responde outra pergunta.
  checar(folha.segmentos === 1 && folha.campo && folha.filtros === 3 && folha.go,
    'e ela desenha o segmento da VARIANTE, o campo, os TRÊS filtros e o '
    + 'confirmar — o segmento do MODO virou a linha "Quantas" na v1.8.61', folha);
  checar(folha.chips === 3,
    'e os TRÊS são os únicos chips da folha: a linha da quantidade deixou de ser '
    + 'uma fileira de pílulas na v1.8.96', folha.chips);
  // (Aqui morava a asserção das SEIS pílulas de quantidade — `1·3·5·10·15·20`.
  //  Elas saíram na v1.8.96 e a linha virou uma ROLETA horizontal de 1 ao teto;
  //  quem a mede é o bloco do fim deste arquivo, onde a faixa, o teto, o
  //  assentamento e o recuo das pontas têm cenário próprio.)
  // O FILTRO QUE NASCE LIGADO JÁ AGIU (v1.0.7): `semInfantis` recusa sem que
  // ninguém o tenha tocado, e o pool de saída é o do acervo MENOS os infantis.
  // A pílula conta o pool e a lista mostra um por linha — as duas medidas, e não
  // uma, porque um conserto que quebrasse a lista deixaria a pílula certa.
  checar(conta0.n === 5 && conta0.linhas === 5,
    'de saída, a pílula conta o pool (5) e a lista tem uma linha por música — o '
    + 'filtro que nasce ligado já agiu', conta0);
  checar(conta0.vai === Math.min(5, 3) || conta0.vai >= 1,
    '  ↳ e o LOTE está marcado no topo dela', conta0);

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
  comTema.res = await lerResultado();
  // "natal" casa no NOME de h1 e no ÁLBUM das duas faixas de album-9.
  checar(comTema.res.n === 3 && comTema.res.linhas === 3,
    'a palavra tema filtra: três — o nome de uma e o álbum das outras duas',
    comTema.res);
  checar(comTema.focado && comTema.valor === 'natal',
    'e o campo NÃO perde o foco a cada tecla — a conta muda sem remontar a folha', comTema);

  // ---- OS FILTROS ----------------------------------------------------------
  await pg.evaluate(() => { sorteioPrefs.semHinario = true; renderSorteio(); });
  const semHinario = await lerResultado();
  checar(semHinario.n === 2 && semHinario.linhas === 2,
    '"Sem hinário" tira as faixas do hinário do pool', semHinario);

  // A DISPONIBILIDADE É POR VARIANTE, e ela se lê na LINHA: em Playback só a que
  // TEM o instrumental no aparelho diz "no aparelho". Ela saiu da frase e foi
  // para o subtítulo de cada música, que é onde ela é acionável — dá para
  // desmarcar a que vai baixar.
  const soPlayback = await pg.evaluate(() => {
    sorteioPrefs.semHinario = false;
    sorteioPrefs.variante = AVSorteio.VARIANTE_PLAYBACK;
    renderSorteio();
    const subs = [...document.querySelectorAll('#sorteioList .sorteio-res-btn .song-menu-sub')]
      .map((x) => x.textContent);
    return { subs, locais: subs.filter((t) => /no aparelho/.test(t)).length };
  });
  checar(soPlayback.locais === 1,
    'em Playback só a que TEM o instrumental no aparelho se anuncia como local — '
    + 'o "está baixada?" é por variante', soPlayback);

  await pg.evaluate(() => {
    sorteioPrefs.variante = AVSorteio.VARIANTE_CANTADA;
    sorteioPrefs.soNoAparelho = true;
    renderSorteio();
  });
  const soLocal = await pg.evaluate(() => {
    const r = {
      n: Number((document.querySelector('#sorteioList .sorteio-res-cab').textContent.match(/\d+/) || [0])[0]),
      forasteiros: [...document.querySelectorAll('#sorteioList .sorteio-res-btn .song-menu-sub')]
        .filter((x) => /vai baixar/.test(x.textContent)).length,
    };
    sorteioPrefs.soNoAparelho = false;
    return r;
  });
  checar(soLocal.n === 2 && soLocal.forasteiros === 0,
    '"Só no aparelho" deixa só o que não precisa de download — e nenhuma linha '
    + 'da lista diz "vai baixar"', soLocal);

  // ---- OS FILTROS COMPÕEM, E CADA UM ENCOLHE O POOL ------------------------
  //
  // Aqui moravam SEIS asserções sobre a FRASE do cartão ("Toda a biblioteca, sem
  // o hinário — N músicas"), e o cartão saiu na v1.8.84 porque ela reescrevia
  // por extenso o que as pílulas logo acima já mostram. **O fato que elas
  // guardavam continua**, e é o que importa: cada filtro de fato encolhe o pool,
  // e dois ligados juntos encolhem juntos. Ele se lê no NÚMERO.
  const escopos = await pg.evaluate(() => {
    // O PRIMEIRO número do cabeçalho é a contagem; o segundo é quantos já
    // estão baixados. Tirar os não-dígitos concatenaria os dois.
    const ler = () => Number((document.querySelector('#sorteioList .sorteio-res-cab')
      .textContent.match(/\d+/) || [0])[0]);
    const antes = { ...sorteioPrefs };
    sorteioPrefs.tema = '';
    const fora = {};
    // "SEM FILTRO NENHUM" EXIGE DESLIGAR TRÊS (v1.0.7): `semInfantis` nasce
    // LIGADO, então o estado sem ressalva nenhuma deixou de ser o padrão do app
    // — e é justamente por isso que ele é a linha de base contra a qual cada
    // filtro se mede.
    sorteioPrefs.semHinario = false; sorteioPrefs.soNoAparelho = false;
    sorteioPrefs.semInfantis = false;
    renderSorteio(); fora.tudo = ler();
    sorteioPrefs.semInfantis = true;
    renderSorteio(); fora.semInfantis = ler();
    sorteioPrefs.semInfantis = false;
    sorteioPrefs.semHinario = true;
    renderSorteio(); fora.semHinario = ler();
    sorteioPrefs.semHinario = false; sorteioPrefs.soNoAparelho = true;
    renderSorteio(); fora.soLocal = ler();
    sorteioPrefs.semHinario = true;
    renderSorteio(); fora.ambos = ler();
    sorteioPrefs.semInfantis = true;
    renderSorteio(); fora.tres = ler();
    Object.assign(sorteioPrefs, antes); renderSorteio();
    return fora;
  });
  // `semInfantis` é `<=` e não `<` porque a fixture não tem faixa infantil: ele
  // é o filtro que nasce ligado, e medi-lo com `<` seria exigir da fixture uma
  // propriedade que ela não tem — a asserção passaria a falar do acervo de
  // mentira em vez da regra. Quem cobre a ação dele é o `sorteio.test.mjs`, com
  // as faixas 508–557 plantadas.
  checar(escopos.semHinario < escopos.tudo && escopos.soLocal < escopos.tudo
    && escopos.semInfantis <= escopos.tudo,
    'cada filtro ENCOLHE o pool contra a linha de base sem filtro nenhum', escopos);
  checar(escopos.ambos <= Math.min(escopos.semHinario, escopos.soLocal)
    && escopos.tres <= escopos.ambos,
    'e eles COMPÕEM: dois ligados nunca devolvem mais que o menor dos dois, e os '
    + 'três nunca mais que os dois', escopos);
  // (E A DICA DO CAMPO DEIXOU DE EXPLICAR O VAZIO na v1.8.96 — *"na dica da
  //  barra de buscas, remova o comentário 'vazio = toda a biblioteca'"*. A
  //  asserção que a cobria morava aqui e foi para o bloco do fim, junto das
  //  outras medidas que este lote mexeu nesta folha.)

  // ---- A CONTA VAZIA DIZ O MOTIVO -----------------------------------------
  // O botão dispara sem mais nenhuma tela: esta linha é a única chance de o
  // operador entender por que nada vai acontecer, e "nada casa" tem cinco
  // causas que pedem ações opostas.
  const vazio = await pg.evaluate(() => {
    sorteioPrefs.tema = 'zzzznadaaqui'; renderSorteio();
    const res = document.querySelector('#sorteioList .sorteio-res');
    const go = document.querySelector('#sorteioPopup .sorteio-acao');
    return {
      texto: res.textContent, marcada: res.classList.contains('vazio'),
      travado: go.disabled, linhas: document.querySelectorAll('.sorteio-res-btn').length,
      pilula: document.querySelector('#sorteioList .sorteio-res-cab').textContent,
    };
  });
  checar(/zzzznadaaqui/.test(vazio.texto) && vazio.marcada && vazio.linhas === 0,
    'sem resultado, a LISTA dá lugar à frase que NOMEIA a palavra que não casou — '
    + 'ela é a única do cartão antigo que não repetia a tela', vazio);
  checar(!/casam|faixas/.test(vazio.texto),
    'e ela não volta ao vocabulário da varredura ("casam", "faixas")', vazio.texto);
  checar(vazio.travado, 'e o confirmar fica desabilitado — o botão nunca dispara para o nada');

  // ---- MODO "UMA SÓ": vai ao telão ----------------------------------------
  const uma = await pg.evaluate(async () => {
    sorteioPrefs.tema = 'natal';
    __quantas(1);
    sorteioPrefs.soNoAparelho = true;   // sem rede neste harness
    renderSorteio();
    await executarSorteio(document.querySelector('#sorteioPopup .song-menu-go'), 'tocar');
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
    __quantas(3);
    sorteioPrefs.tema = '';            // o acervo inteiro: 3 baixadas
    sorteioPrefs.soNoAparelho = true;
    // O SELETOR ARMADO NA FAIXA ANTERIOR (v1.8.77): é assim que ele chega aqui
    // num culto — `one` sobrou do louvor que o operador repetiu, e a playlist
    // recém-sorteada tocaria a primeira em laço.
    await AVDB.setState('repeat', 'one'); repeat = 'one'; renderRepeat();
    await abrirSorteio();
    sorteioPrefs.soNoAparelho = true; renderSorteio();   // ver a nota do pacote
    await executarSorteio(document.querySelector('#sorteioPopup .song-menu-go'), 'tocar');
    await new Promise((r) => setTimeout(r, 600));
    const ids = await AVDB.listIds('playlist');
    return {
      ids, plItems: plItems.length, noAr: currentId, primeiro: ids[0],
      modo: repeat, guardado: (await AVDB.getState('repeat')) || 'off',
    };
  });
  checar(fila.ids.length === 3,
    'a fila do player passa a ter as três sorteadas', fila.ids);
  checar(fila.plItems === 3,
    'e `plItems` foi refeito — sem isso `step`/`autoAdvance` andariam pelo array velho',
    fila.plItems);
  checar(fila.noAr === fila.primeiro,
    'e a PRIMEIRA já está no telão (o caminho do `abrirPacote`)', fila);
  // ===== E A FILA ANDA SOZINHA (v1.8.77) =====
  //
  // Relato do operador: *"é normal o seletor estar desativado, tocar uma
  // playlist automática, mas ele tocar apenas a primeira e parar, pois o
  // usuário esquece de ativar o automático"*. São DUAS metades, e as duas se
  // medem aqui, no caminho por onde ele de fato passa (a folha, o
  // `executarSorteio`, o `montarFilaSorteada`): montar a fila ZERA o seletor —
  // o `one` armado acima é resquício da faixa anterior — e, com ele em `off`, o
  // fim da primeira projeta a SEGUNDA. A regra por partes (as bordas, o limite
  // de quem NÃO zera) mora no `repeticao-e-sequencia.test.mjs`.
  checar(fila.modo === 'off' && fila.guardado === 'off',
    'montar a playlist automática devolve o seletor a `off` — com o `one` de '
    + 'antes ela tocaria a primeira faixa em laço', fila.modo + ' · ' + fila.guardado);
  const andou = await pg.evaluate(async () => {
    autoAdvance();
    await new Promise((r) => setTimeout(r, 600));
    return currentId;
  });
  checar(andou === fila.ids[1],
    'e o fim da primeira projeta a SEGUNDA da fila, sem o operador armar nada',
    andou + ' (esperado: ' + fila.ids[1] + ')');

  // ---- A FAIXA DE FECHO: TOCAR MAIS OS TRÊS DESTINOS (v1.8.56) -----------
  //
  // Ela teve DOIS botões da v5.306 até aqui, e só montando a fila. Pedido do
  // operador: *"deixe o botão tocar agora, e os dois botões de add ao
  // cronograma e add aos favoritos disponíveis… Isso se aplica ao modo de uma
  // música só e ao modo de playlist montar playlist. Na verdade pode até
  // adicionar um terceiro botão, adicionar a playlist"*.
  //
  // A ORDEM É A CANÔNICA (`DESTINOS`), e ela entra na asserção porque foi a
  // outra metade do mesmo pedido: *"a esquerda o cronograma, no meio a playlist
  // e por fim o favoritos"*. Lida do DOM, não da tabela — a tabela é travada no
  // `destinos.test.mjs`, e o que falta provar aqui é que esta folha a segue.
  const faixa = await pg.evaluate(async () => {
    __quantas(3);
    await abrirSorteio();
    const bs = [...document.querySelectorAll('#sorteioPopup .sorteio-acao')];
    // A PEÇA DA PONTA ESQUERDA é o botão de SORTEAR desde a v1.8.88 (a vaga da
    // pílula da conta). Ele é lido pelo NOME e não pelo índice: uma asserção
    // que só deslocasse `bs[0]` para `bs[1]` esconderia quem entrou na faixa.
    const sortear = bs[0] && bs[0].classList.contains('sorteio-sortear');
    const resto = sortear ? bs.slice(1) : bs;
    return {
      total: bs.length,
      sortear,
      primeiro: resto[0].textContent.trim(),
      dest: resto.slice(1).map((b) => b.dataset.dest),
      // SEM RÓTULO, e é isso que faz caber a 320px — o `aria-label` é o que
      // sobra para quem não vê o ícone.
      mudos: resto.slice(1).every((b) => !b.textContent.trim() && !!b.getAttribute('aria-label')),
    };
  });
  // O RÓTULO ENCURTOU NA v1.8.61 ("Tocar agora" → "Tocar", "Sortear e tocar" →
  // "Sortear"), e ele veio junto com a altura única da faixa: sem os 19,2px de
  // recuo vertical o primário só cabe em UMA linha, e MEDIDO o par longo
  // reticenciava em 78 de 432 pontos contra 4 de 56 do curto.
  checar(faixa.sortear === true,
    'a faixa abre pelo botão de SORTEAR (v1.8.88) — a vaga que era da pílula da '
    + 'conta, e a única peça dela que ganhou ação', faixa);
  checar(faixa.total === 5 && /^Tocar/.test(faixa.primeiro)
    && JSON.stringify(faixa.dest) === JSON.stringify(['cronograma', 'playlist', 'favoritos']),
    'montando a fila a faixa de fecho tem CINCO botões: sortear, tocar e os três '
    + 'destinos, na ordem canônica (Cronograma · playlist · favoritos)', faixa);
  checar(faixa.mudos,
    'e os três são MUDOS com `aria-label`: quatro rótulos não cabem a 320px, e '
    + 'um botão sem texto deve a frase inteira a quem o encontra', faixa);

  // E SORTEANDO UMA SÓ SÃO OS MESMOS QUATRO. Esta é a metade que a v5.306
  // recusava, e a razão dela ("guardar uma música é o caminho da gaveta da
  // Biblioteca") valia para uma música ESCOLHIDA: quem sorteia não sabe qual
  // vai sair, e chegar à gaveta dela custa fechar a folha, achar a faixa e
  // abri-la.
  const umaSo = await pg.evaluate(async () => {
    __quantas(1); renderSorteio();
    const bs = [...document.querySelectorAll('#sorteioPopup .sorteio-acao')];
    const r = { total: bs.length, dest: bs.slice(2).map((b) => b.dataset.dest) };
    __quantas(3); renderSorteio();
    return r;
  });
  checar(umaSo.total === 5
    && JSON.stringify(umaSo.dest) === JSON.stringify(['cronograma', 'playlist', 'favoritos']),
    'e sorteando UMA SÓ são os MESMOS cinco — os destinos são o modo que até a '
    + 'v1.8.55 não tinha nenhum', umaSo);

  // E NENHUM DELES NO MODO FÁCIL: ele não tem Cronograma, nem Favoritos, nem
  // fila à vista (`body.mode-simple` esconde o `main` e a barra inteiros), e um
  // botão que promete um destino invisível é pior que um botão a menos.
  const facil = await pg.evaluate(async () => {
    const antes = appMode;
    setAppMode('simple'); renderSorteio();
    const n = document.querySelectorAll('#sorteioPopup .sorteio-dest').length;
    const primario = document.querySelectorAll('#sorteioPopup .song-menu-go').length;
    setAppMode(antes); renderSorteio();
    return { n, primario };
  });
  checar(facil.n === 0 && facil.primario === 1,
    'e no Modo Fácil sobra só o primário: lá não há Cronograma, nem Favoritos, '
    + 'nem fila para onde mandar', facil);

  // O EFEITO do "Ao Cronograma": entra na lista `imports` e NÃO mexe no que
  // está no ar nem na fila do player. É esta a diferença que o botão promete.
  const guardou = await pg.evaluate(async () => {
    const filaAntes = await AVDB.listIds('playlist');
    const noArAntes = currentId;
    __quantas(3); sorteioPrefs.tema = ''; sorteioPrefs.soNoAparelho = true;
    renderSorteio();
    // POR ATRIBUTO desde a v1.8.56: o botão é MUDO, e não há texto por onde
    // achá-lo. `data-dest` é o hook que o `renderSorteio` escreve para isto.
    const btn = document.querySelector('#sorteioPopup .sorteio-dest[data-dest="cronograma"]');
    await executarSorteio(btn, 'cronograma');
    await new Promise((r) => setTimeout(r, 600));
    const itens = await AVDB.listItems('imports');
    const pac = itens.find((r) => r && r.kind === 'cue' && r.cue === 'group');
    return {
      cronograma: itens.length,
      ehPacote: !!pac,
      quantosNoPacote: pac && Array.isArray(pac.data.ids) ? pac.data.ids.length : 0,
      nome: pac ? pac.name : '',
      cortinaGuardada: pac ? pac.data.view : null,
      filaIgual: JSON.stringify(await AVDB.listIds('playlist')) === JSON.stringify(filaAntes),
      noArIgual: currentId === noArAntes,
      aberta: document.getElementById('sorteioPopup').classList.contains('open'),
      fala: (document.querySelector('#sorteioList .sorteio-fala') || {}).textContent,
    };
  });
  checar(guardou.cronograma === 1 && guardou.ehPacote && guardou.quantosNoPacote === 3,
    'as três sorteadas entram como UM PACOTE, não como três linhas soltas', guardou);
  checar(/playlist/i.test(guardou.nome || '') && /3 m[úu]sicas/.test(guardou.nome || ''),
    'e a linha DIZ o que é e quantas tem — é o que o operador lê semanas depois', guardou.nome);
  checar(!/sorteio/i.test(guardou.nome || ''),
    'e NÃO se chama "Sorteio": esse é o nome de outra cena de roteiro (CUES.draw), '
    + 'e duas linhas homônimas fazendo coisas diferentes só aparecem no sábado', guardou.nome);
  checar(guardou.filaIgual && guardou.noArIgual,
    'e ele NÃO mexe na fila do player nem no que está no telão — é a diferença '
    + 'que separa os dois botões', guardou);
  checar(guardou.aberta,
    'a folha FICA ABERTA: guardar não encerra a conversa, e o segundo sorteio é o uso normal');
  checar(/pacote/i.test(guardou.fala || '') && /3 m[úu]sicas/.test(guardou.fala || ''),
    'e a conta empresta a si mesma para dizer que foi UM pacote, e de quantas', guardou.fala);
  checar(guardou.cortinaGuardada === 'visual',
    'o pacote guarda a CORTINA que a escolha pedia — sem ela um "Fundo musical" '
    + 'abriria semanas depois com a letra no telão, desmentindo o próprio nome',
    guardou.cortinaGuardada);

  // ---- E O PACOTE ABRE A FILA INTEIRA, COM A CORTINA QUE ELE PROMETE ------
  //
  // É o ganho do lote inteiro, e é a metade que o `criarCue` não prova: guardar
  // um pacote que não abre é pior que dez linhas soltas, porque as dez ao menos
  // tocam. Medido pelo MESMO caminho da lista (`playCue`).
  //
  // A CORTINA COMEÇA FECHADA de propósito, para o pacote ter de ABRI-LA: é o
  // par exato do caso que importa semanas depois (um "Fundo musical" a fecha,
  // uma "Playlist" a abre), e com três faixas em vez de uma — o pool de
  // playback da fixture tem só uma, e uma fila de um item não prova "inteira".
  const abriu = await pg.evaluate(async () => {
    await AVDB.listSet('imports', []);
    await AVDB.listSet('playlist', []);
    await abrirSorteio();
    __quantas(3); sorteioPrefs.tema = '';
    sorteioPrefs.soNoAparelho = true;
    sorteioPrefs.variante = AVSorteio.VARIANTE_CANTADA;
    renderSorteio();
    // POR ATRIBUTO desde a v1.8.56: o botão é MUDO, e não há texto por onde
    // achá-lo. `data-dest` é o hook que o `renderSorteio` escreve para isto.
    const btn = document.querySelector('#sorteioPopup .sorteio-dest[data-dest="cronograma"]');
    await executarSorteio(btn, 'cronograma');
    await new Promise((r) => setTimeout(r, 600));
    const pac = (await AVDB.listItems('imports'))
      .find((r) => r && r.kind === 'cue' && r.cue === 'group');
    const ids = pac && Array.isArray(pac.data.ids) ? pac.data.ids.length : 0;
    // Guardar NÃO projeta, então a cortina ainda é de quem a deixou assim.
    await setView('wallpaper');
    const antes = view;
    await playCue(pac);
    await new Promise((r) => setTimeout(r, 500));
    return {
      nome: pac ? pac.name : '', ids, antes, depois: view,
      fila: plItems.length,
      naFila: (await AVDB.listIds('playlist')).length,
      primeira: currentId === (pac ? pac.data.ids[0] : null),
    };
  });
  checar(abriu.ids === 3 && abriu.fila === 3 && abriu.naFila === 3 && abriu.primeira,
    'tocar no pacote abre a FILA INTEIRA e manda a primeira ao telão — '
    + 'um pacote que não abre é pior que dez linhas soltas', abriu);
  checar(abriu.antes === 'wallpaper' && abriu.depois === 'visual',
    'e a CORTINA do descritor é aplicada ao abrir — é o que faz um pacote '
    + 'guardado hoje se comportar em setembro como no dia em que foi sorteado', abriu);

  // O PAR DA MESMA REGRA, do outro lado: o pacote de fundo musical GUARDA a
  // cortina fechada. Sem isto o nome dele seria uma promessa que só o dia do
  // sorteio cumpria.
  const fundoPac = await pg.evaluate(async () => {
    await AVDB.listSet('imports', []);
    await abrirSorteio();
    // O FILTRO É DESTE BLOCO, e não herdado: desde a v1.8.97 `abrirSorteio`
    // ZERA os três filtros e a palavra tema, então um bloco que executa um
    // sorteio de verdade tem de declarar o "só no aparelho" DEPOIS de abrir.
    // Sem isto o pool volta a incluir o que precisa baixar, o
    // `ensureDownloadConsent` abre um `appConfirm` que ninguém responde, e o
    // `evaluate` fica PENDURADO — o arquivo inteiro morre por prazo, sem uma
    // linha dizendo onde.
    sorteioPrefs.soNoAparelho = true;
    sorteioPrefs.variante = AVSorteio.VARIANTE_PLAYBACK; sorteioPrefs.tema = '';
    renderSorteio();
    // POR ATRIBUTO desde a v1.8.56: o botão é MUDO, e não há texto por onde
    // achá-lo. `data-dest` é o hook que o `renderSorteio` escreve para isto.
    const btn = document.querySelector('#sorteioPopup .sorteio-dest[data-dest="cronograma"]');
    await executarSorteio(btn, 'cronograma');
    await new Promise((r) => setTimeout(r, 600));
    const pac = (await AVDB.listItems('imports'))
      .find((r) => r && r.kind === 'cue' && r.cue === 'group');
    sorteioPrefs.variante = AVSorteio.VARIANTE_CANTADA;
    return { nome: pac ? pac.name : '', guardada: pac ? pac.data.view : null };
  });
  checar(/^Fundo musical /.test(fundoPac.nome) && fundoPac.guardada === 'wallpaper',
    'o pacote de fundo musical nasce com o nome e a cortina dele', fundoPac);

  // REPETIR O MESMO SORTEIO tem de dizer que elas já estavam lá — senão o
  // operador repete o toque achando que não funcionou.
  const denovo = await pg.evaluate(async () => {
    // POR ATRIBUTO desde a v1.8.56: o botão é MUDO, e não há texto por onde
    // achá-lo. `data-dest` é o hook que o `renderSorteio` escreve para isto.
    const btn = document.querySelector('#sorteioPopup .sorteio-dest[data-dest="cronograma"]');
    await executarSorteio(btn, 'cronograma');
    await new Promise((r) => setTimeout(r, 600));
    const itens = await AVDB.listItems('imports');
    return {
      total: itens.length,
      pacotes: itens.filter((r) => r && r.kind === 'cue' && r.cue === 'group').length,
      fala: (document.querySelector('#sorteioList .sorteio-fala') || {}).textContent,
    };
  });
  // UM SORTEIO NOVO É UM PACOTE NOVO. Antes a dedução era por id e um segundo
  // sorteio só acrescentava o que faltava; com o pacote, cada sorteio é um
  // instantâneo do que ELE tirou — dois lotes no roteiro são dois lotes, e
  // continuam saindo num toque cada.
  checar(denovo.total === 2 && denovo.pacotes === 2,
    'sortear de novo cria um SEGUNDO pacote — cada sorteio é o instantâneo do que ele tirou', denovo);

  // ---- AS TRÊS FORMAS DE POUSAR (v1.8.56) --------------------------------
  //
  // O destino não muda só a LISTA: muda a FORMA com que o sorteio pousa nela, e
  // as três diferenças são decisões, não acaso. Cada uma tem asserção própria
  // porque cada uma falha sozinha.

  // (1) UMA SÓ É UMA MÍDIA, NUNCA UM PACOTE DE UM. Uma linha chamada "Playlist
  //     da biblioteca · 1 música" que precisa de um toque a mais para revelar
  //     o hino que está dentro é pior que a linha do hino — e o `.avpkg` da
  //     fila já recusa guardar menos de duas pela mesma razão (v1.8.53).
  const solta = await pg.evaluate(async () => {
    await AVDB.listSet('imports', []);
    await abrirSorteio();
    __quantas(1);
    sorteioPrefs.tema = ''; sorteioPrefs.soNoAparelho = true;
    renderSorteio();
    const btn = document.querySelector('#sorteioPopup .sorteio-dest[data-dest="cronograma"]');
    await executarSorteio(btn, 'cronograma');
    await new Promise((r) => setTimeout(r, 600));
    const itens = await AVDB.listItems('imports');
    return {
      total: itens.length,
      pacotes: itens.filter((r) => r && r.kind === 'cue' && r.cue === 'group').length,
      nome: itens[0] ? itens[0].name : '',
      aberta: document.getElementById('sorteioPopup').classList.contains('open'),
      fala: (document.querySelector('#sorteioList .sorteio-fala') || {}).textContent,
    };
  });
  checar(solta.total === 1 && solta.pacotes === 0 && !/playlist/i.test(solta.nome),
    'UMA SÓ entra como a LINHA DA MÚSICA, nunca como um pacote de um — a linha '
    + 'diz o nome do hino, e não "Playlist da biblioteca · 1 música"', solta);
  checar(solta.aberta,
    'e a folha FICA ABERTA também aqui: guardar não encerra a conversa', solta);
  // E A CONTA DIZ O NOME. Guardando UMA SÓ, o pulso prova que o toque valeu e
  // não diz QUAL saiu — e a única outra superfície que responderia isso é a
  // lista de destino, atrás desta folha. (No "Tocar agora" a pergunta não
  // existe: a música vai ao telão.) A frase que `adicionarNasListas` monta
  // viaja no terceiro argumento do `responder`, que é DESCARTADO.
  checar(solta.fala && solta.fala.includes(solta.nome)
    && /cronograma/i.test(solta.fala),
    'e a conta DIZ O NOME da que saiu e para onde foi — sortear é justamente '
    + 'não escolher, e o pulso do botão não responde "qual?"', solta);

  // (2) FAVORITOS RECEBE O MESMO PACOTE, na lista dele. O destino era só o
  //     Cronograma até a v1.8.55, e `criarCue` já sabia guardar em `favs` — o
  //     que faltava era o botão.
  const favs = await pg.evaluate(async () => {
    await AVDB.listSet('favs', []);
    await abrirSorteio();
    __quantas(3);
    sorteioPrefs.tema = ''; sorteioPrefs.soNoAparelho = true;
    renderSorteio();
    const noArAntes = currentId;
    const filaAntes = await AVDB.listIds('playlist');
    const btn = document.querySelector('#sorteioPopup .sorteio-dest[data-dest="favoritos"]');
    await executarSorteio(btn, 'favoritos');
    await new Promise((r) => setTimeout(r, 600));
    const itens = await AVDB.listItems('favs');
    const pac = itens.find((r) => r && r.kind === 'cue' && r.cue === 'group');
    return {
      quantos: itens.length, ehPacote: !!pac,
      dentro: pac && Array.isArray(pac.data.ids) ? pac.data.ids.length : 0,
      noArIgual: currentId === noArAntes,
      filaIgual: JSON.stringify(await AVDB.listIds('playlist')) === JSON.stringify(filaAntes),
      fala: (document.querySelector('#sorteioList .sorteio-fala') || {}).textContent,
    };
  });
  checar(favs.quantos === 1 && favs.ehPacote && favs.dentro === 3,
    'FAVORITOS recebe o mesmo pacote, na lista dele', favs);
  checar(favs.noArIgual && favs.filaIgual,
    'e ele também não mexe na fila do player nem no que está no telão', favs);
  checar(/favoritos/i.test(favs.fala || ''),
    'e a conta NOMEIA o destino — "no Cronograma" para um pacote que foi para '
    + 'os Favoritos é o app contando metade da verdade', favs.fala);

  // (3) A PLAYLIST RECEBE AS FAIXAS, NO FIM DA FILA. É a metade literal do
  //     pedido (*"simplesmente joga… no fim da playlist atual"*), e é a única
  //     leitura coerente: a fila é uma fila de MÍDIA, e o toque num pacote a
  //     SUBSTITUI (`abrirPacote`) — guardar um pacote dentro dela seria pôr
  //     nela o botão que a apaga.
  //
  // A ASSERÇÃO É O ANTES E DEPOIS DA FILA, e não só o tamanho: "acrescentou"
  // e "substituiu" dão a mesma contagem quando a fila estava vazia, e é
  // justamente a fila CHEIA que o operador tem no meio do culto.
  const naFila = await pg.evaluate(async () => {
    const semente = (await AVDB.listItems('imports'))
      .filter((r) => r && r.kind !== 'cue').map((r) => r.id).slice(0, 1);
    await AVDB.listSet('playlist', semente);
    plItems = await AVDB.listItems('playlist');
    const antes = await AVDB.listIds('playlist');
    const noArAntes = currentId;
    await abrirSorteio();
    __quantas(3);
    sorteioPrefs.tema = ''; sorteioPrefs.soNoAparelho = true;
    renderSorteio();
    const btn = document.querySelector('#sorteioPopup .sorteio-dest[data-dest="playlist"]');
    await executarSorteio(btn, 'playlist');
    await new Promise((r) => setTimeout(r, 600));
    const depois = await AVDB.listIds('playlist');
    return {
      antes, depois, espelho: plItems.length,
      pacotes: (await AVDB.listItems('playlist'))
        .filter((r) => r && r.kind === 'cue' && r.cue === 'group').length,
      noArIgual: currentId === noArAntes,
      fala: (document.querySelector('#sorteioList .sorteio-fala') || {}).textContent,
    };
  });
  checar(naFila.antes.length === 1 && naFila.depois.length > naFila.antes.length
    && naFila.depois[0] === naFila.antes[0],
    'A PLAYLIST recebe as faixas NO FIM: o que já estava continua NA FRENTE, e '
    + 'a fila não é substituída — acrescentar e substituir dão a mesma contagem '
    + 'com a fila vazia, e é a fila CHEIA que o operador tem no culto', naFila);
  checar(naFila.pacotes === 0,
    'e não entra um PACOTE na fila: tocar num pacote SUBSTITUI a fila, então '
    + 'guardá-lo dentro dela seria pôr nela o botão que a apaga', naFila);
  checar(naFila.espelho === naFila.depois.length,
    'e `plItems` foi refeito — sem isso `step`/`autoAdvance` andariam pelo '
    + 'array velho', naFila);
  checar(naFila.noArIgual,
    'e acrescentar à fila NÃO projeta nada: o "Tocar agora" é o botão ao lado', naFila);

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
      // O RESULTADO da reabertura: a pílula conta o pool sem a palavra de antes.
      const n = Number((document.querySelector('#sorteioList .sorteio-res-cab')
        .textContent.match(/\d+/) || [0])[0]);
      const linhas = document.querySelectorAll('#sorteioList .sorteio-res-btn').length;
      fecharSorteio();
      return { antes, depois, n, linhas };
    }, caminho);
  }
  for (const [caminho, r] of Object.entries(limpou)) {
    checar(r.antes === 'gratidão' && r.depois === '',
      'fechar por "' + caminho + '" limpa a caixa da palavra tema', r);
  }
  // O POOL da reabertura é o do ESCOPO, e não o da palavra que foi limpa —
  // "gratidão" não casa nada nesta fixture, então o resultado dela seria ZERO.
  // A asserção NÃO fixa o número: ele depende dos filtros ligados neste ponto do
  // teste, e o que importa é que a palavra de antes deixou de escopar o sorteio.
  checar(limpou.fecharSorteio.n > 0 && limpou.fecharSorteio.linhas === limpou.fecharSorteio.n,
    'e a folha reabre sorteando pelo ESCOPO, não pelo tema de antes',
    limpou.fecharSorteio.forte);

  // A PALAVRA NÃO ATRAVESSA UMA SESSÃO: as outras cinco escolhas são ajustes e
  // ficam gravadas; ela é uma pergunta feita uma vez.
  const gravado = await pg.evaluate(async () => {
    await abrirSorteio();
    sorteioPrefs.tema = 'cruz'; __quantas(15);
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

  // ---- PLAYBACK SORTEADO É SOM DE FUNDO (v5.311) --------------------------
  //
  // O pedido é "sem aparecer nada na tela", e o mecanismo é a cortina — que
  // cobre a mídia E a letra, porque o `#lyrics` do Display vive no mesmo
  // z-index dos layers de mídia. O teste mede o EFEITO em dois lugares que não
  // podem discordar: o estado `view` do Controle e o `view` que viaja DENTRO do
  // comando `load`. O segundo é o que importa — se ele saísse `visual`, o telão
  // desenharia a letra e a esconderia um quadro depois.
  const cortina = await pg.evaluate(async () => {
    // Espiona o barramento sem tocar no caminho de projeção.
    const vistos = [];
    const orig = AVDB.sendCommand;
    AVDB.sendCommand = (o) => { vistos.push(o); return orig(o); };
    // O SEGUNDO EIXO É `quantos` desde a v1.8.61 (1 = a antiga "uma só"), e ele
    // é escrito UMA vez: a versão anterior punha o modo e logo abaixo um
    // `quantos = 3` fixo, então os dois casos "uma só" rodavam com fila de três
    // e passavam pelo motivo errado.
    const rodar = async (variante, quantos) => {
      vistos.length = 0;
      sorteioPrefs.variante = variante; sorteioPrefs.quantos = quantos;
      sorteioPrefs.tema = ''; sorteioPrefs.soNoAparelho = true;
      await abrirSorteio();
      sorteioPrefs.soNoAparelho = true; renderSorteio();   // ver a nota do pacote
      const btn = document.querySelector('#sorteioPopup .song-menu-go');
      await executarSorteio(btn, 'tocar');
      await new Promise((r) => setTimeout(r, 500));
      const load = vistos.filter((o) => o && o.type === 'load').pop();
      return { view, noLoad: load ? load.view : null };
    };
    const pb1 = await rodar('playback', 1);
    const ct1 = await rodar('full', 1);
    const pbFila = await rodar('playback', 3);
    const ctFila = await rodar('full', 3);
    AVDB.sendCommand = orig;
    return { pb1, ct1, pbFila, ctFila };
  });
  checar(cortina.pb1.view === 'wallpaper' && cortina.pb1.noLoad === 'wallpaper',
    'playback sorteado (uma só) cobre o telão, e a cortina viaja DENTRO do load',
    cortina.pb1);
  checar(cortina.pbFila.view === 'wallpaper' && cortina.pbFila.noLoad === 'wallpaper',
    'a fila de playback também — som de fundo do primeiro item ao último',
    cortina.pbFila);
  // A DECISÃO É NOS DOIS SENTIDOS: sem isto, a cantada sorteada depois de um
  // playback entraria sem imagem e sem letra por causa de uma escolha anterior.
  checar(cortina.ct1.view === 'visual' && cortina.ct1.noLoad === 'visual',
    'e a CANTADA sorteada em seguida REVELA o telão — o sorteio diz o estado, '
    + 'não o herda', cortina.ct1);
  checar(cortina.ctFila.view === 'visual' && cortina.ctFila.noLoad === 'visual',
    'idem para a fila cantada', cortina.ctFila);

  // "AO CRONOGRAMA" NÃO TOCA NO TELÃO. Ele guarda; mexer na cortina ali seria o
  // oposto do que aquele botão promete.
  const guardaNaoCobre = await pg.evaluate(async () => {
    __quantas(3);
    sorteioPrefs.variante = AVSorteio.VARIANTE_CANTADA;
    sorteioPrefs.tema = ''; sorteioPrefs.soNoAparelho = true;
    await abrirSorteio();
    await setView('wallpaper');            // o operador cobriu o telão de propósito
    sorteioPrefs.soNoAparelho = true;      // ver a nota do pacote
    sorteioPrefs.variante = AVSorteio.VARIANTE_PLAYBACK; renderSorteio();
    // POR ATRIBUTO desde a v1.8.56: o botão é MUDO, e não há texto por onde
    // achá-lo. `data-dest` é o hook que o `renderSorteio` escreve para isto.
    const btn = document.querySelector('#sorteioPopup .sorteio-dest[data-dest="cronograma"]');
    await executarSorteio(btn, 'cronograma');
    await new Promise((r) => setTimeout(r, 500));
    const v = view;
    await setView('visual'); fecharSorteio();
    return v;
  });
  checar(guardaNaoCobre === 'wallpaper',
    '"Ao Cronograma" não mexe na cortina — ele guarda, não projeta', guardaNaoCobre);

  // A NOTA SAIU (v1.8.62), e esta metade guarda que ela não volte. Pedido do
  // operador: *"pode remover o comentário sobre a função de cantada e fundo
  // musical… é auto explicativo"*. Ela nasceu na v5.311 explicando o que cada
  // variante faz com o telão, e a v1.8.61 a escreveu nos DOIS estados para
  // fechar um dos quatro motores do pulo da folha — com ela fora, o motor
  // morreu junto.
  //
  // E o RÓTULO do segmento é medido junto (v5.313). Na folha de UMA música
  // "Playback" nomeia o ARQUIVO (a gravação sem voz, ao lado da cantada); aqui
  // a escolha é o PROPÓSITO da fila inteira, e o operador pediu o nome que o
  // descreve. O VALOR guardado continua `'playback'` — renomeá-lo junto com o
  // rótulo trocaria a variante de todo mundo que já escolheu, em silêncio.
  const nota = await pg.evaluate(async () => {
    await abrirSorteio();
    sorteioPrefs.variante = AVSorteio.VARIANTE_CANTADA; renderSorteio();
    const elC = document.querySelector('#sorteioList .sorteio-nota');
    const cantada = elC ? elC.textContent : '';
    sorteioPrefs.variante = AVSorteio.VARIANTE_PLAYBACK; renderSorteio();
    const el = document.querySelector('#sorteioList .sorteio-nota');
    const texto = el ? el.textContent : '';
    const segs = [...document.querySelectorAll('#sorteioList .fit-seg button, #sorteioList .fit-seg .fit-seg-b')]
      .map((b2) => b2.textContent.trim());
    sorteioPrefs.variante = AVSorteio.VARIANTE_CANTADA; fecharSorteio();
    return { cantada, texto, segs, valor: AVSorteio.VARIANTE_PLAYBACK };
  });
  // NENHUM DOS DOIS ESTADOS TEM NOTA (v1.8.62). A asserção é nos DOIS porque a
  // versão anterior a desenhava só num deles — medir um estado só aprovaria
  // metade da remoção, que é exatamente a forma do defeito que ela substitui.
  checar(nota.texto === '' && nota.cantada === '',
    'a folha NÃO explica o segmento: os dois rótulos se bastam, e a nota saiu a '
    + 'pedido do operador', nota);
  checar(nota.segs.some((t) => /^Fundo musical$/i.test(t)) && !nota.segs.some((t) => /playback/i.test(t)),
    'o segmento diz "Fundo musical" — o PROPÓSITO da fila, não o nome do arquivo', nota.segs);
  checar(nota.valor === 'playback',
    'e o VALOR guardado continua `playback`: renomeá-lo trocaria a variante '
    + 'de quem já escolheu, e é ele que `resolveSongMediaId` lê', nota.valor);

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

  // ---- A QUANTIDADE É UMA ROLETA HORIZONTAL (v1.8.96) --------------------
  //
  // Eram SEIS pílulas (`1·3·5·10·15·20`) e viraram uma FAIXA de 1 ao teto, a
  // pedido do operador: *"atualmente ele possui números fixos, mude isso. Faça
  // uma roleta também, mas uma roleta horizontal, que vai de 1 a 50 (ou o
  // número máximo de resultados disponíveis)"*.
  //
  // O que este bloco cobre é o que o `sorteio.test.mjs` NÃO alcança: lá mora a
  // REGRA (o `saneQuantos`, que agora CLAMPA em vez de recusar), e a roleta é
  // toda LIGAÇÃO — e cada metade dela falha calada.
  //
  //  - **o teto**, `min(50, disponíveis)`: errado para cima ela oferece 50
  //    sobre um pool de oito, e o que sai é uma escolha que o aparelho sabe que
  //    não se cumpre; errado para baixo, o operador não alcança o número que o
  //    acervo tem;
  //  - **a posição É o valor**: a célula acesa e o LOTE marcado são o mesmo
  //    fato lido por dois lados, e uma pista fora de fase por UMA casa (o `-1`
  //    do `qhMostrar`) desenha 4 para um lote de 3;
  //  - **o assentamento**, que é o único ponto que GRAVA — sem ele a roleta se
  //    mexe, nada acontece, e o "Sortear" leva o lote de antes;
  //  - **o caminho de volta**: marcar linhas na mão MOVE a roleta, porque quem
  //    responde "quantas" é o lote (a regra da v1.8.85, que ela herda inteira);
  //  - **o recuo MEDIDO das duas pontas** (`--qh-vao`), sem o qual o 1 e o teto
  //    não chegam ao centro — e é ele, não uma marca de seleção, que faz a
  //    primeira e a última célula poderem ser escolhidas.
  //
  // O ACERVO GRANDE É PLANTADO AQUI, e é a única forma de exercitar o outro
  // lado do `min`: a fixture do arquivo tem CINCO resultados, e com ela o teto
  // do recurso nunca é alcançado — a asserção mediria `disponíveis` duas vezes
  // e o `50` ficaria sem oráculo.
  //
  // A MEDIDA É UMA SÓ, instalada na página (a mesma razão do `__quantas`): cada
  // cenário mexe no estado e lê os MESMOS campos, e duas leituras copiadas
  // divergiriam no primeiro ajuste.
  //
  // E O ASSENTAMENTO PENDENTE DO BLOCO ANTERIOR É DRENADO ANTES DE QUALQUER
  // COISA. MEDIDO: o bloco do voltar abre a folha e a fecha no mesmo instante, a
  // roleta se posiciona no caminho, e o `setTimeout` do assentamento dela cai
  // DENTRO deste bloco — sobre um nó que o `abrirSorteio` daqui já trocou. Um nó
  // fora do documento responde `scrollLeft === 0`, então o assentamento lê a
  // PRIMEIRA célula e reescreve o lote em 1: as asserções de baixo mediriam um
  // lote que ninguém pediu, e a primeira delas reprovava com `marcadas: 1`.
  //
  // O DEFEITO É DO APP E NÃO DO ARNÊS, e drenar aqui protege este arquivo sem
  // consertar aquilo: um assentamento que cai sobre nó trocado GRAVA
  // `quantos: 1` (`saveSorteioPrefs`), então a escolha do operador é desfeita em
  // disco. MEDIDO pelo caminho de um culto — arrastar a roleta até 12, esperar
  // o assentamento, e tocar num filtro antes dos 140 ms seguintes: o lote de 12
  // volta a 1, gravado. Está relatado; o `qhAssentou` não pergunta se o nó ainda
  // está no documento.
  await pg.evaluate(() => new Promise((r) => setTimeout(r, QH_ASSENTA_MS * 3)));
  await pg.evaluate(() => {
    window.__medirRoleta = () => {
      const qh = document.getElementById('sorteioQuantidade');
      if (!qh) return { existe: false };
      const cs = getComputedStyle(qh);
      const centro = (el) => { const b = el.getBoundingClientRect(); return b.left + b.width / 2; };
      return {
        existe: true,
        // A LINHA DA QUANTIDADE NÃO TEM MAIS PÍLULA NENHUMA: a roleta ENTROU no
        // lugar delas, e as duas convivendo seria a folha oferecendo o mesmo
        // controle duas vezes.
        pilulas: document.querySelectorAll('#sorteioList .sorteio-linha--quantas .misc-chip').length,
        celulas: qh.children.length,
        textos: [...qh.children].map((c) => c.textContent),
        teto: Number(qh.dataset.teto),
        valor: Number(qh.dataset.valor),
        acesa: (qh.querySelector('.qh-item--sel') || {}).textContent,
        acesas: qh.querySelectorAll('.qh-item--sel').length,
        marcadas: sorteioMarcadas.size,
        quantos: sorteioPrefs.quantos,
        vai: document.querySelectorAll('#sorteioList .sorteio-res-btn.vai').length,
        max: AVSorteio.QUANTIDADE_MAX,
        // A CÉLULA MEDIDA, e não a constante: quem posiciona a pista é o
        // `QH_ITEM` do JS e quem a desenha é o `--qh-item` do CSS — os dois
        // divergindo põem a roleta fora de fase sem que nada reclame.
        celula: Math.round(qh.children[0].getBoundingClientRect().width * 10) / 10,
        passo: QH_ITEM,
        vao: Number(qh.dataset.vao),
        padEsq: cs.paddingLeft,
        padDir: cs.paddingRight,
        janela: qh.clientWidth,
        rola: qh.classList.contains('rola'),
        // A BARRA É LIDA NA PROPRIEDADE, e é o único lugar onde ela se lê aqui:
        // MEDIDO por reversão, o Chromium deste arnês usa barra SOBREPOSTA e
        // `offsetHeight − clientHeight` dá ZERO com e sem o
        // `scrollbar-width: none` — a asserção geométrica seria tautologia. Onde
        // ela importa é o WebView do aparelho, que pinta a barra por cima dos
        // números, e ali quem a tira é esta declaração.
        barra: cs.scrollbarWidth,
        podeRolar: qh.scrollWidth > qh.clientWidth,
        eixo: Math.round(centro(qh) * 10) / 10,
      };
    };
    // A FILEIRA DOS FILTROS, medida nas DUAS células que as asserções usam — e
    // instalada aqui pela mesma razão da outra: a leitura é a MESMA nas duas, e
    // copiá-la as faria divergir no primeiro ajuste.
    window.__medirChips = () => {
      const opts = document.querySelector(
        '#sorteioList .sorteio-linha:not(.sorteio-linha--quantas) .misc-opts');
      const chips = [...opts.querySelectorAll('.misc-chip')];
      const vao = parseFloat(getComputedStyle(opts).columnGap) || 0;
      const soma = chips.reduce((t, c) => t + c.getBoundingClientRect().width, 0)
        + vao * (chips.length - 1);
      // A ALTURA DO TEXTO de cada pílula, por `Range`: é ela que diz QUEM
      // quebrou, e é justamente o que o `stretch` esconde ao igualar as CAIXAS.
      // Sem esta medida não há como saber se a célula escolhida é uma em que a
      // igualdade das caixas prova alguma coisa.
      const texto = chips.map((c) => {
        const rg = document.createRange(); rg.selectNodeContents(c);
        return Math.round(rg.getBoundingClientRect().height * 10) / 10;
      });
      return {
        rotulos: document.querySelectorAll('#sorteioList .sorteio-rotulo').length,
        textoRotulo: /Filtros|Quantas/.test(document.getElementById('sorteioList').textContent),
        quantos: chips.length,
        // DA BORDA À BORDA: a soma das três mais os dois vãos é a fileira
        // inteira. Medida contra a FILEIRA, e não contra a folha — é ela que o
        // `flex: 1` manda preencher.
        fileira: Math.round(opts.getBoundingClientRect().width * 10) / 10,
        soma: Math.round(soma * 10) / 10,
        caixas: [...new Set(chips.map((c) => Math.round(c.getBoundingClientRect().height * 10) / 10))],
        texto,
        // NADA RETICENCIADO E NADA CORTADO, e a medida é no BOTÃO, que é quem
        // recorta: um `<span>` de dentro tem o tamanho do próprio texto e nunca
        // acusa nada (a armadilha da régua, v1.8.65).
        corte: chips.filter((c) => c.scrollWidth > c.clientWidth + 1
          || c.scrollHeight > c.clientHeight + 1).map((c) => c.textContent),
        reticencia: [...new Set(chips.map((c) => getComputedStyle(c).textOverflow))],
      };
    };
  });
  const roleta = {};

  // (A) A ROLETA ESTÁ NO LUGAR DAS PÍLULAS, E O TETO É O QUE EXISTE (CINCO).
  roleta.pequena = await pg.evaluate(async () => {
    sorteioPrefs.tema = ''; sorteioPrefs.semHinario = false;
    sorteioPrefs.soNoAparelho = false; sorteioPrefs.semInfantis = true;
    sorteioPrefs.variante = AVSorteio.VARIANTE_CANTADA;
    await abrirSorteio();
    // O `await` acima já esgotou o re-render do índice de letras (ele sai no
    // `.then` de um `ensureLyricIndex` que aqui já está pronto), então este é o
    // ÚLTIMO desenho da folha — o que importa porque cada `renderSorteio` TROCA
    // o nó da roleta.
    __quantas(3); renderSorteio();
    await new Promise((r) => setTimeout(r, QH_ASSENTA_MS * 3));
    return __medirRoleta();
  });
  checar(roleta.pequena.existe && roleta.pequena.pilulas === 0,
    'a linha da quantidade é a ROLETA, e não sobrou pílula nenhuma nela — as '
    + 'duas juntas seriam o mesmo controle oferecido duas vezes', roleta.pequena);
  checar(roleta.pequena.celulas === 5
    && JSON.stringify(roleta.pequena.textos) === JSON.stringify(['1', '2', '3', '4', '5'])
    && roleta.pequena.teto === 5,
    'e ela tem UMA célula por valor, de 1 ao teto — que sobre cinco resultados é '
    + 'CINCO: é o `min(50, disponíveis)` pelo lado de baixo', roleta.pequena);
  checar(roleta.pequena.celula === roleta.pequena.passo,
    'e a célula DESENHADA mede o `QH_ITEM` com que o JS posiciona a pista: os '
    + 'dois divergindo põem a roleta fora de fase, calada', roleta.pequena);

  // (B) A POSIÇÃO É O VALOR: a acesa é o tamanho do LOTE, e é UMA só.
  checar(roleta.pequena.acesa === String(roleta.pequena.marcadas)
    && roleta.pequena.marcadas === 3,
    'a célula ACESA é o tamanho do lote marcado — a posição não ilustra o valor, '
    + 'ela É o valor', roleta.pequena);
  checar(roleta.pequena.acesas === 1,
    'e é UMA só: duas acesas é a pista fora de fase com o nó que a acende',
    roleta.pequena.acesas);

  // (C) E O TETO É O DO RECURSO QUANDO O ACERVO PASSA DELE (50 de 65).
  roleta.grande = await pg.evaluate(async () => {
    const songs = [];
    for (let i = 0; i < 60; i++) {
      songs.push({ id_music: 'g' + i, name: 'Coral ' + i, duration: '3:00',
        has_instrumental_music: true, fileIdFull: null, fileIdPlayback: null });
    }
    collState['album-10'] = { songs };
    albumCatalog = { categories: [],
      albums: [{ id_album: 9, name: 'Natal — Coral', color: null },
        { id_album: 10, name: 'Coletânea Grande', color: null }] };
    await abrirSorteio();
    __quantas(3); renderSorteio();
    await new Promise((r) => setTimeout(r, QH_ASSENTA_MS * 3));
    const r = __medirRoleta();
    r.pool = sorteioPool().itens.length;
    return r;
  });
  checar(roleta.grande.pool === 65 && roleta.grande.max === 50
    && roleta.grande.celulas === 50 && roleta.grande.teto === 50
    && roleta.grande.textos[roleta.grande.celulas - 1] === '50',
    'com 65 resultados ela PARA no teto do recurso (50) — o outro lado do `min`, '
    + 'que a fixture de cinco não alcança', roleta.grande);

  // (D) ROLAR ATÉ UMA CÉLULA MARCA AQUELE TANTO, E GRAVA.
  //
  // A espera é a CARÊNCIA declarada do app (`QH_ASSENTA_MS`, lida dele mesmo), e
  // ela existe para o dedo não comprometer um número a cada quadro do arremesso.
  // O `scrollLeft` escrito aqui produz o MESMO evento `scroll` que o dedo
  // produz — não há caminho de clique nem de teclado nesta roleta.
  roleta.rolou = await pg.evaluate(async () => {
    const qh = document.getElementById('sorteioQuantidade');
    qh.scrollLeft = 6 * QH_ITEM;                 // a sétima célula
    await new Promise((r) => setTimeout(r, QH_ASSENTA_MS * 3));
    const r = __medirRoleta();
    r.gravado = ((await AVDB.getState('sorteioPrefs')) || {}).quantos;
    r.mesmoNo = document.getElementById('sorteioQuantidade') === qh;
    return r;
  });
  checar(roleta.rolou.marcadas === 7 && roleta.rolou.vai === 7,
    'rolar até a sétima célula MARCA sete linhas da lista — a roleta não é um '
    + 'rótulo, é ela que semeia o lote', roleta.rolou);
  checar(roleta.rolou.quantos === 7 && roleta.rolou.gravado === 7,
    'e o assentamento GRAVA a escolha (`quantos`) — a metade que atravessa o '
    + 'fechamento da folha', roleta.rolou);
  checar(roleta.rolou.mesmoNo && roleta.rolou.acesa === '7',
    'e o nó da roleta SOBREVIVE ao assentamento: ele chama a conta leve, nunca o '
    + '`renderSorteio` — remontá-la no fim de um gesto devolveria a pista ao '
    + 'começo debaixo do dedo', roleta.rolou);

  // (E) E O CAMINHO DE VOLTA: marcar na mão MOVE a roleta.
  //
  // Pelo toque de verdade na linha, que é o que passa pelo
  // `atualizarContaSorteio` — o único caminho que acerta a roleta sem remontar
  // a folha.
  roleta.mao = await pg.evaluate(async () => {
    const antes = sorteioMarcadas.size;
    [...document.querySelectorAll('#sorteioList .sorteio-res-btn:not(.vai)')]
      .slice(0, 2).forEach((b) => b.click());
    await new Promise((r) => setTimeout(r, QH_ASSENTA_MS * 3));
    const r = __medirRoleta();
    r.antes = antes;
    return r;
  });
  checar(roleta.mao.antes === 7 && roleta.mao.marcadas === 9
    && roleta.mao.acesa === '9' && roleta.mao.valor === 9,
    'marcar duas linhas na mão LEVA a roleta ao 9 — o lote é a fonte única, e a '
    + 'roleta o lê pelo mesmo lado que a lista', roleta.mao);

  // (F) O RECUO DAS DUAS PONTAS É MEDIDO, e é ele que deixa o 1 e o teto
  //     chegarem ao centro. Um `padding-inline: 50%` não serve (com
  //     `box-sizing: border-box` a caixa de conteúdo zera e as células saem
  //     transbordando por baixo do recuo), e um número escrito à mão vale para
  //     UMA largura — ver a segunda metade disto no cenário estreito, logo
  //     abaixo.
  roleta.pontas = await pg.evaluate(async () => {
    const qh = document.getElementById('sorteioQuantidade');
    const centro = (el) => { const b = el.getBoundingClientRect(); return b.left + b.width / 2; };
    const guardado = qh.scrollLeft;
    qh.scrollLeft = 0;
    const primeira = Math.round(centro(qh.children[0]) * 10) / 10;
    qh.scrollLeft = qh.scrollWidth;
    const ultima = Math.round(centro(qh.children[qh.children.length - 1]) * 10) / 10;
    // DEVOLVE A PISTA e paga o assentamento: as duas escritas acima disparam
    // `scroll`, e sair daqui com um assentamento em voo comprometeria o TETO
    // como se fosse escolha do operador.
    qh.scrollLeft = guardado;
    await new Promise((r) => setTimeout(r, QH_ASSENTA_MS * 3));
    const r = __medirRoleta();
    r.primeira = primeira; r.ultima = ultima;
    return r;
  });
  checar(roleta.pontas.vao > 0
    && roleta.pontas.vao === Math.round((roleta.pontas.janela - roleta.pontas.passo) / 2)
    && roleta.pontas.padEsq === roleta.pontas.vao + 'px'
    && roleta.pontas.padDir === roleta.pontas.vao + 'px',
    'o recuo das duas pontas é `(janela − célula) / 2`, LIDO da janela e escrito '
    + 'nas duas bordas', roleta.pontas);
  checar(Math.abs(roleta.pontas.primeira - roleta.pontas.eixo) <= 1.5
    && Math.abs(roleta.pontas.ultima - roleta.pontas.eixo) <= 1.5,
    'e com ele a PRIMEIRA e a ÚLTIMA célula chegam ao centro da janela — sem o '
    + 'recuo, o 1 e o teto não podem ser escolhidos', roleta.pontas);

  // (G) ELA NÃO LEVA A MARCA `rola`, E NÃO TEM BARRA.
  //
  // A sombra das bordas diz *"há conteúdo escondido deste lado"*, e aqui o
  // conteúdo escondido É o recurso: a roleta é um SELETOR de valor, não um texto
  // que continua fora da vista. Quem marca a célula escolhida é a máscara mais o
  // preenchimento da centrada.
  checar(roleta.pontas.rola === false,
    'a roleta NÃO leva a marca `rola`: num seletor de valor a sombra das bordas '
    + 'avisaria de um "conteúdo escondido" que é o próprio recurso', roleta.pontas);
  checar(roleta.pontas.podeRolar && roleta.pontas.barra === 'none',
    'e ela é um SCROLLER de verdade (a pista não cabe na janela) sem barra '
    + 'nenhuma — no aparelho a barra sobreposta pintaria por cima dos números',
    roleta.pontas);

  // (H) OS RÓTULOS SUMIRAM E AS TRÊS PÍLULAS OCUPAM A LINHA INTEIRA.
  //
  // *"Remova os títulos 'quantas' e 'filtros', use a largura toda apenas para
  // distribuir os botões seletores e a roleta da quantidade"*.
  //
  // SÃO DUAS CÉLULAS, E A REVERSÃO ESCOLHEU CADA UMA — as duas metades do
  // pedido não se medem no mesmo lugar:
  //
  //  - **DA BORDA À BORDA se mede LARGO (430×1).** MEDIDO: tirando o `flex: 1`
  //    das pílulas, numa tela ESTREITA elas encolhem para caber (o
  //    `flex-shrink` é 1 por padrão) e a soma dá a fileira inteira de novo — a
  //    asserção passa com e sem o conserto. A 430 a largura natural das três
  //    somadas é menor que a fileira, e sem o `flex: 1` o `justify-content:
  //    center` as junta no meio com sobra nas pontas.
  //  - **A ALTURA ÚNICA se mede ESTREITO (320×1).** É a largura em que só o
  //    TERCEIRO rótulo ("Só no aparelho") precisa de duas linhas — medido, o
  //    texto dele mede 30,1px contra 15px dos irmãos —, e é essa desigualdade
  //    que faz a igualdade das CAIXAS provar alguma coisa. A 320×1,25 os TRÊS
  //    quebram (36,9px cada) e as caixas saem iguais sozinhas: ali a asserção
  //    não mede nada.
  //
  // E O `align-items: stretch` DA FILEIRA É INERTE — MEDIDO POR REVERSÃO, e
  // está dito aqui porque o comentário do CSS credita a peça errada: tirar a
  // declaração não move UM pixel, porque `align-items` de um contêiner flex
  // nasce `normal`, e `normal` **é** o esticamento. O que a asserção de baixo
  // guarda é o dia em que alguém escrever `center` ou `flex-start` ali — medido
  // também: com `center` ela reprova, e a pílula que quebrou fica mais alta que
  // as irmãs na mesma faixa.
  const chipsLargo = await pg.evaluate(() => window.__medirChips());
  checar(chipsLargo.rotulos === 0 && chipsLargo.textoRotulo === false,
    'os rótulos "Filtros" e "Quantas" saíram do DOM — a fileira usa a largura '
    + 'toda, e cada pílula já diz por extenso o que ela filtra', chipsLargo);
  checar(chipsLargo.quantos === 3
    && Math.abs(chipsLargo.soma - chipsLargo.fileira) <= 1,
    'e a 430 as TRÊS ocupam a fileira inteira, da borda à borda — a largura '
    + 'natural delas é menor que ela, então quem a preenche é o `flex: 1`',
    chipsLargo);

  // E A FOLHA É REDESENHADA DEPOIS DE ESTREITAR, o que é PRECISÃO da fixture e
  // não conveniência: MEDIDO, um `ResizeObserver` observa o **content box**, e o
  // recuo da roleta é PADDING — estreitada a janela, o recuo de antes (182px de
  // cada lado) já passa da largura nova, o content box fica em ZERO nas duas
  // pontas e o observador CALA com o recuo velho (160px medidos, contra os 127
  // da conta). O aparelho não alcança isto: ele é travado em retrato, e uma
  // troca da fonte do sistema RECRIA a Activity — que recarrega a página. Quem
  // alcança é uma janela de navegador sendo arrastada, e ali o desenho seguinte
  // conserta.
  await pg.setViewportSize({ width: 320, height: 900 });
  await pg.evaluate(async () => {
    // PAGA O ASSENTAMENTO ANTES DE REDESENHAR: estreitar move a pista (o recuo
    // muda), e um `renderSorteio` com um assentamento em voo o deixaria cair
    // sobre um nó já trocado.
    await new Promise((r) => setTimeout(r, QH_ASSENTA_MS * 3));
    renderSorteio();
    await new Promise((r) => setTimeout(r, QH_ASSENTA_MS * 3));
  });
  const chipsEstreito = await pg.evaluate(() => {
    const r = window.__medirChips();
    r.roleta = window.__medirRoleta();
    return r;
  });
  checar(chipsEstreito.texto[2] > chipsEstreito.texto[0] + 4,
    'a 320×1 só o TERCEIRO rótulo precisa de duas linhas — é esta desigualdade '
    + 'que a asserção seguinte mede, e sem ela o `stretch` não tem o que igualar',
    chipsEstreito.texto);
  checar(chipsEstreito.caixas.length === 1,
    'e as três pílulas ficam com UMA altura só, apesar de só uma delas ter '
    + 'quebrado — o esticamento é o padrão do flex, e o que isto guarda é um '
    + '`center` escrito ali um dia', chipsEstreito);
  checar(chipsEstreito.corte.length === 0
    && !chipsEstreito.reticencia.includes('ellipsis'),
    'e nenhuma é RETICENCIADA nem cortada: reticências não dizem QUAL palavra foi '
    + 'cortada, e "Só no aparelho" é a que se perde', chipsEstreito);
  // E O RECUO SEGUE A LARGURA — a outra metade do "medido, não declarado": um
  // número em CSS valeria para uma tela só.
  checar(chipsEstreito.roleta.vao !== roleta.pontas.vao
    && chipsEstreito.roleta.vao
      === Math.round((chipsEstreito.roleta.janela - chipsEstreito.roleta.passo) / 2),
    'e o recuo da roleta ACOMPANHA a janela: 320 e 430 dão recuos diferentes, os '
    + 'dois pela mesma conta',
    { estreito: chipsEstreito.roleta.vao, largo: roleta.pontas.vao });
  await pg.setViewportSize({ width: 430, height: 900 });
  await pg.evaluate(async () => {
    await new Promise((r) => setTimeout(r, QH_ASSENTA_MS * 3));
    renderSorteio();
    await new Promise((r) => setTimeout(r, QH_ASSENTA_MS * 3));
  });

  // (I) A DICA DO CAMPO É SÓ A PERGUNTA.
  const dicaNova = await pg.evaluate(
    () => document.querySelector('#sorteioList .lib-search').placeholder);
  checar(dicaNova === 'Palavra tema',
    'a dica do campo é EXATAMENTE "Palavra tema" — o parêntese que explicava o '
    + 'vazio saiu, e quem responde "e se eu não escrever nada?" é a conta logo '
    + 'abaixo, com um número', dicaNova);

  // (J) E A LINHA DA CONTA É CENTRADA — medida por PIXEL, e não pelo
  //     `text-align` computado: quem vê a linha vê a caixa do TEXTO, e o valor
  //     certo com uma regra posterior o desmentindo dá a mesma leitura.
  const cabeca = await pg.evaluate(() => {
    const cab = document.querySelector('#sorteioList .sorteio-res-cab');
    const cs = getComputedStyle(cab);
    const b = cab.getBoundingClientRect();
    const esq = b.left + parseFloat(cs.paddingLeft);
    const dir = b.right - parseFloat(cs.paddingRight);
    const rg = document.createRange(); rg.selectNodeContents(cab);
    const t = rg.getBoundingClientRect();
    return {
      texto: cab.textContent.slice(0, 44),
      eixoCaixa: Math.round(((esq + dir) / 2) * 10) / 10,
      eixoTexto: Math.round(((t.left + t.right) / 2) * 10) / 10,
      folga: Math.round(((dir - esq) - t.width) * 10) / 10,
    };
  });
  checar(cabeca.folga >= 8,
    'a linha da conta SOBRA na caixa dela — sem essa folga o centrado e o '
    + 'alinhado à esquerda desenham o mesmo pixel, e a asserção seguinte seria '
    + 'tautologia', cabeca);
  checar(Math.abs(cabeca.eixoTexto - cabeca.eixoCaixa) <= 1,
    'e ela é CENTRADA: é a única linha da folha que fala do CONJUNTO, e à '
    + 'esquerda lia como a primeira linha da lista', cabeca);

  // (K) O ASSENTAMENTO NÃO POUSA NUM NÓ TROCADO.
  //
  // Um elemento fora do documento responde `scrollLeft` ZERO, e o assentamento
  // lê zero como *"o operador escolheu 1"* — e GRAVA. MEDIDO por reversão, com
  // a roleta em 12: sem a guarda o lote volta a UMA e `sorteioPrefs.quantos: 1`
  // vai para o IndexedDB, isto é, sobrevive à sessão. Nada erra e nada aparece
  // na tela.
  //
  // A CÉLULA É O MECANISMO NU, e não uma corrida de relógio: o caminho do
  // operador que o alcança (encostar na roleta e tocar num filtro dentro dos
  // 140 ms) depende de um prazo cair entre dois quadros, e uma asserção assim
  // reprova por carga do runner em vez de por defeito. Aqui a troca do nó é
  // EXPLÍCITA e o assentamento é chamado à mão — é a mesma linha de código, sem
  // o relógio no meio.
  const orfao = await pg.evaluate(async () => {
    const w = (ms) => new Promise((f) => setTimeout(f, ms));
    const el = document.getElementById('sorteioQuantidade');
    el.scrollLeft = 11 * el.children[0].getBoundingClientRect().width;
    await w(350);
    const antes = { quantos: sorteioPrefs.quantos, marcadas: sorteioMarcadas.size };
    const velho = el;
    renderSorteio();                    // é o que um toque em qualquer filtro faz
    await w(20);
    qhAssentou(velho);                  // o prazo pendurado, pousando no órfão
    await w(60);
    const g = await AVDB.getState('sorteioPrefs');
    return {
      antes,
      conectado: velho.isConnected,
      lidoNoOrfao: velho.scrollLeft,
      depois: { quantos: sorteioPrefs.quantos, marcadas: sorteioMarcadas.size, gravado: (g || {}).quantos },
    };
  });
  checar(!orfao.conectado && orfao.lidoNoOrfao === 0 && orfao.antes.quantos === 12,
    'a PREMISSA do órfão: o nó saiu do documento e responde `scrollLeft` zero, '
    + 'com a escolha do operador em 12. Sem ela a asserção seguinte não mede '
    + 'nada', JSON.stringify(orfao));
  checar(orfao.depois.quantos === 12 && orfao.depois.marcadas === 12
    && orfao.depois.gravado === 12,
    'e o assentamento num nó TROCADO não faz nada: sem a guarda ele lê o zero do '
    + 'órfão como "escolheu 1", marca UMA e grava — no IndexedDB, sobrevivendo à '
    + 'sessão', JSON.stringify(orfao));

  // ---- O TOQUE, A CONTAGEM FORA DO SCROLLER E OS FILTROS ZERADOS (v1.8.97) ----
  //
  // Quatro pedidos do operador no mesmo lote, e nenhum dos quatro erra alto:
  //
  //  - **O TOQUE NUM NÚMERO À VISTA** — *"está no 1, mas eu vejo o 3. Se eu
  //    tocar no 3 ele vai direto para o 3"*. A roleta só aceitava ARRASTO, e
  //    alcançar o 40 custava atravessar trinta e nove células com o dedo. O
  //    caminho novo é um `click`, e ele nasce com uma dívida: um gesto que ROLOU
  //    termina com o dedo sobre uma célula, e sem guarda o `click` do fim do
  //    arrasto escolheria essa — que quase nunca é a que o operador queria.
  //  - **A CONTAGEM SAIU DE DENTRO DO SCROLLER** — *"ele está com uma sombra em
  //    sua caixa, que parece que deveria ser da caixa do scroll da lista de
  //    resultados, pois ela está sem sombra de corte por rolagem"*. A tira do
  //    `.rola` é `z-index: 5` e mede 22px sobre uma linha de 19,5: com a lista
  //    rolada ela pintava POR CIMA do número, e a fronteira de verdade — a
  //    primeira linha cortada, logo abaixo — ficava sem marca nenhuma.
  //  - **A FALA CALADA NÃO OCUPA NADA** — *"verifique o excesso de margem entre
  //    a linha de botões de play e esse texto de número de resultados"*.
  //  - **REABRIR ZERA OS TRÊS FILTROS E A PALAVRA**, e isto REVOGA *"sem
  //    infantis é o único filtro que nasce ligado"*: o `sanear` continua o
  //    ligando por omissão para quem LÊ um registro gravado, e a folha o apaga
  //    por ESCRITO a cada abertura.
  //
  // A CORTINA É ESPERADA AQUI, e não no topo do arquivo, porque este é o
  // primeiro bloco que usa o MOUSE de verdade — todo o resto chama `.click()` em
  // nó, que não passa por hit-test nenhum. MEDIDO: com o `#splash` de pé o
  // `elementFromPoint` do centro de TODA célula da roleta devolve a cortina, e o
  // `pg.mouse.click` ali não chega a lugar nenhum. Este arquivo só não tropeçou
  // nela porque demora mais que o teto de 12 s do `<head>` — depender disso é
  // medir o relógio, que é a regra que a função existe para fechar.
  await esperarCortina(pg);

  // (L) O TOQUE NUMA CÉLULA À VISTA LEVA A ROLETA ATÉ ELA.
  //
  // A PREMISSA É O GESTO, e sem ela a asserção descreve outra coisa: a célula
  // tem de estar INTEIRA na janela da roleta e ser o que o dedo alcança naquele
  // ponto. Um `click` despachado em nó aprova igual a célula fora da vista, que
  // é um gesto que não existe.
  //
  // A ESCOLHIDA É A ÚLTIMA À VISTA (o 16, com a roleta em 12), e a DISTÂNCIA é
  // parte da régua: na vizinha, "foi para o número tocado" e "andou uma casa no
  // fim do arremesso" desenham o mesmo pixel.
  const tap = await pg.evaluate(() => {
    const qh = document.getElementById('sorteioQuantidade');
    const janela = qh.getBoundingClientRect();
    const vistas = [...qh.children].map((c, i) => ({ c, i, b: c.getBoundingClientRect() }))
      .filter(({ b }) => b.left >= janela.left - 0.5 && b.right <= janela.right + 0.5);
    const alvo = vistas.filter(({ c }) => !c.classList.contains('qh-item--sel')).pop();
    const x = alvo.b.left + alvo.b.width / 2;
    const y = alvo.b.top + alvo.b.height / 2;
    return {
      vistas: vistas.length, pedido: alvo.c.textContent, i: alvo.i,
      x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10,
      alcanca: document.elementFromPoint(x, y) === alvo.c,
      antes: { valor: Number(qh.dataset.valor), marcadas: sorteioMarcadas.size, scroll: qh.scrollLeft },
    };
  });
  checar(tap.vistas >= 5 && tap.alcanca && tap.antes.valor === 12 && tap.pedido === '16'
    && tap.i - (tap.antes.valor - 1) >= 3,
    'L · a PREMISSA do toque: com a roleta em 12, a célula 16 está INTEIRA na '
    + 'janela e É o que o dedo alcança naquele ponto — quatro casas adiante, para '
    + 'que chegar lá não se confunda com o fim de um arremesso', tap);
  await pg.mouse.click(tap.x, tap.y);
  // O ARREDONDAMENTO É O FATO, e o `scrollTo` suave chega em quadros: espera-se
  // a pista PARADA na casa pedida, nunca um prazo.
  const pousou = await esperar(pg, (i) => {
    const qh = document.getElementById('sorteioQuantidade');
    return !!qh && Math.abs(qh.scrollLeft - i * QH_ITEM) < 1;
  }, tap.i, 8000);
  const depoisTap = await pg.evaluate(async () => {
    await new Promise((r) => setTimeout(r, QH_ASSENTA_MS * 3));
    const qh = document.getElementById('sorteioQuantidade');
    const g = await AVDB.getState('sorteioPrefs');
    return { acesa: (qh.querySelector('.qh-item--sel') || {}).textContent,
      acesas: qh.querySelectorAll('.qh-item--sel').length,
      valor: Number(qh.dataset.valor), marcadas: sorteioMarcadas.size,
      quantos: sorteioPrefs.quantos, gravado: (g || {}).quantos,
      vai: document.querySelectorAll('#sorteioList .sorteio-res-btn.vai').length };
  });
  checar(pousou === true && depoisTap.acesa === '16' && depoisTap.acesas === 1
    && depoisTap.valor === 16,
    'L · o toque LEVA a roleta à célula tocada — a acesa passa a ser o 16, e é '
    + 'UMA só', porque(pousou) || JSON.stringify(depoisTap));
  checar(depoisTap.marcadas === 16 && depoisTap.vai === 16
    && depoisTap.quantos === 16 && depoisTap.gravado === 16,
    'L · e o LOTE segue o toque: dezesseis linhas marcadas na lista e o `quantos` '
    + 'gravado em 16 — quem conclui é o assentamento de sempre, não um segundo '
    + 'caminho de escrita', depoisTap);

  // (M) O ARRASTO NÃO É UM TOQUE — e o veículo é conferido antes de valer como
  //     prova.
  //
  // A ARMADILHA AQUI É A TAUTOLOGIA: um `click` sintético que não chegue ao
  // ouvinte (alvo errado, `bubbles` esquecido) faz a asserção do arrasto passar
  // sem que guarda nenhuma exista. Então o MESMO despacho é exercido primeiro
  // SEM rolagem, onde ele tem de selecionar.
  //
  // E ELE MEDE, DE CARONA, QUE O TOQUE NÃO GRAVA: a preferência é lida na LINHA
  // seguinte ao despacho, na mesma tarefa e sem relógio no meio — o `qhTocar`
  // só rola, e quem escreve é o assentamento 140 ms depois. Escrever nos dois
  // lugares é a mesma regra em dois lugares, e elas divergem no primeiro ajuste.
  const arrasto = await pg.evaluate(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    const qh = document.getElementById('sorteioQuantidade');
    const janela = qh.getBoundingClientRect();
    const cabe = (c) => { const b = c.getBoundingClientRect();
      return b.left >= janela.left - 0.5 && b.right <= janela.right + 0.5; };
    // M1 — o veículo, sem rolagem nenhuma entre o `pointerdown` e o `click`.
    const alvo1 = qh.children[Number(qh.dataset.valor) + 1];
    const vis1 = cabe(alvo1);
    const quantosAntes = sorteioPrefs.quantos;
    qh.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    alvo1.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const logo = sorteioPrefs.quantos;   // MESMA tarefa: nada pôde assentar
    await w(QH_ASSENTA_MS * 5);
    const m1 = { vis1, pedido: alvo1.textContent, quantosAntes, logo,
      valor: Number(qh.dataset.valor), marcadas: sorteioMarcadas.size };
    // M2 — `pointerdown`, ROLAGEM, `click`. O `scroll` é esperado de fato: num
    // arrasto de verdade ele chega muito antes do dedo sair, e despachar o
    // `click` antes dele mediria uma ordem que o aparelho não produz.
    qh.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const rolou = new Promise((r) => qh.addEventListener('scroll', r, { once: true }));
    qh.scrollLeft = 3 * QH_ITEM;
    await rolou;
    const alvo2 = qh.children[7];
    const vis2 = cabe(alvo2);
    alvo2.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await w(QH_ASSENTA_MS * 5);
    const g = await AVDB.getState('sorteioPrefs');
    return { m1, vis2, tocado: alvo2.textContent, valor: Number(qh.dataset.valor),
      acesa: (qh.querySelector('.qh-item--sel') || {}).textContent,
      marcadas: sorteioMarcadas.size, gravado: (g || {}).quantos,
      parou: Math.round(qh.scrollLeft) };
  });
  checar(arrasto.m1.vis1 && arrasto.m1.valor === Number(arrasto.m1.pedido)
    && arrasto.m1.marcadas === Number(arrasto.m1.pedido),
    'M · a PREMISSA do arrasto: o MESMO `click` sintético SELECIONA quando nada '
    + 'rolou antes dele (o ' + arrasto.m1.pedido + ') — sem isto a asserção de '
    + 'baixo passaria com um despacho que nunca chegou ao ouvinte', arrasto.m1);
  checar(arrasto.m1.logo === arrasto.m1.quantosAntes,
    'M · e o toque NÃO grava por si: na linha seguinte ao despacho o `quantos` '
    + 'ainda é o de antes — o `qhTocar` só rola, e a escrita é do assentamento',
    arrasto.m1);
  checar(arrasto.vis2 && arrasto.tocado === '8' && arrasto.parou === 3 * 44
    && arrasto.valor === 4 && arrasto.acesa === '4' && arrasto.marcadas === 4
    && arrasto.gravado === 4,
    'M · mas depois de ROLAR o mesmo toque é IGNORADO: o dedo termina sobre o 8, '
    + 'à vista, e o lote fica no 4 em que a rolagem parou — sem a guarda, todo '
    + 'arrasto escolheria a célula onde o dedo largou', arrasto);

  // (N) A CONTAGEM É IRMÃ DA LISTA, NÃO CONTEÚDO DELA.
  //
  // E AS DUAS TROCAM JUNTAS: o `atualizarContaSorteio` é o caminho que roda com
  // o campo de texto em foco (o `debounce` da palavra tema), e desde este lote
  // ele tem DOIS nós a trocar. Trocar só a lista deixaria o número descrevendo o
  // pool de antes — um log que discorda da tela, na tela.
  const conta = await pg.evaluate(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    const ler = () => {
      const cab = document.querySelector('#sorteioList .sorteio-res-cab');
      const res = document.querySelector('#sorteioList .sorteio-res');
      const cs = cab && getComputedStyle(cab);
      return { texto: cab && cab.textContent, tag: cab && cab.tagName,
        pos: cs && cs.position, z: cs && cs.zIndex, fundo: cs && cs.backgroundColor,
        dentro: !!(res && cab && res.contains(cab)),
        irma: !!(cab && cab.nextElementSibling === res),
        pai: cab && cab.parentElement.id,
        quantas: document.querySelectorAll('#sorteioList .sorteio-res-cab').length };
    };
    const antes = ler();
    sorteioPrefs.tema = 'natal';
    atualizarContaSorteio();
    await w(60);
    const depois = ler();
    sorteioPrefs.tema = '';
    renderSorteio();
    await w(QH_ASSENTA_MS * 3);
    return { antes, depois, volta: ler() };
  });
  checar(!conta.antes.dentro && conta.antes.irma && conta.antes.tag === 'LI'
    && conta.antes.pai === 'sorteioList' && conta.antes.quantas === 1,
    'N · a contagem é um `<li>` da FOLHA e a irmã IMEDIATAMENTE anterior ao '
    + 'scroller — fora dele, e uma só', conta.antes);
  checar(conta.antes.pos === 'static' && conta.antes.z === 'auto'
    && /rgba\(0, 0, 0, 0\)/.test(conta.antes.fundo),
    'N · e com ela saíram o `sticky`, o `z-index` e o fundo opaco: os três só '
    + 'existiam para ela sobreviver à lista rolando por baixo', conta.antes);
  checar(/^65 resultados/.test(conta.antes.texto) && /^3 resultados/.test(conta.depois.texto)
    && /^65 resultados/.test(conta.volta.texto) && conta.depois.quantas === 1
    && !conta.depois.dentro && conta.depois.irma,
    'N · e o caminho LEVE troca as DUAS: com a palavra tema o número cai de 65 '
    + 'para 3 e a contagem continua sendo a irmã anterior — trocar só a lista '
    + 'deixaria o número descrevendo o pool de antes', conta);

  // (O) COM A LISTA ROLADA, A SOMBRA NÃO ALCANÇA A CONTAGEM — E ALCANÇA A
  //     FRONTEIRA. Medido por PIXEL, porque `getComputedStyle` não vê "pintado
  //     por cima": as duas caixas continuam onde estão, e o que mudou é quem
  //     pinta em cima de quem.
  //
  // A RÉGUA É A PRÓPRIA TIRA, LIGADA E DESLIGADA. Duas fotos do MESMO layout,
  // com a TINTA dos pseudos anulada na segunda (`background: transparent`, nunca
  // `display: none` — o segundo tira um item do fluxo e move o que está embaixo,
  // e aí a comparação mediria o layout). O que diferir entre as duas é a sombra,
  // e nada mais: MEDIDO, abaixo dos 22px da tira NENHUM pixel muda, que é a
  // prova de que a régua é local.
  const foto = await pg.evaluate(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    const res = document.querySelector('#sorteioList .sorteio-res');
    res.scrollTop = 300;
    await w(300);
    const cab = document.querySelector('#sorteioList .sorteio-res-cab');
    const rc = cab.getBoundingClientRect(); const rr = res.getBoundingClientRect();
    const cs = getComputedStyle(res);
    return {
      cab: { topo: rc.top, base: rc.bottom, esq: rc.left, dir: rc.right },
      res: { topo: rr.top + parseFloat(cs.borderTopWidth), esq: rr.left, dir: rr.right },
      acima: res.classList.contains('tem-acima'), semVeu: res.classList.contains('sem-veu'),
      veuH: parseFloat(getComputedStyle(res, '::before').height) || null,
      transborda: res.scrollHeight - res.clientHeight,
    };
  });
  const comTira = lerPng(await pg.screenshot());
  await pg.evaluate(() => {
    const s = document.createElement('style');
    s.id = 'semTinta';
    s.textContent = '#sorteioList .sorteio-res::before,#sorteioList .sorteio-res::after'
      + '{background:transparent!important;background-image:none!important}';
    document.head.appendChild(s);
  });
  const semTira = lerPng(await pg.screenshot());
  await pg.evaluate(() => { const s = document.getElementById('semTinta'); if (s) s.remove(); });
  // A LINHA VARRIDA de borda a borda, e o veredito por linha: quantos pixels
  // mudaram, e o quanto a tira escureceu o mais escurecido deles (luminância da
  // WCAG, a mesma régua do `sombra-de-rolagem`).
  const varrer = (y, esq, dir) => {
    let mudou = 0, maxd = 0, total = 0;
    for (let x = Math.ceil(esq) + 1; x <= Math.floor(dir) - 1; x++) {
      const a = pixel(comTira, x, y); const b = pixel(semTira, x, y);
      if (!a || !b) continue;
      total++;
      if (a.join() !== b.join()) mudou++;
      const d = luminancia(b) - luminancia(a);
      if (d > maxd) maxd = d;
    }
    return { y, mudou, total, maxd: Math.round(maxd * 10000) / 10000 };
  };
  const naContagem = [];
  for (let y = Math.floor(foto.cab.topo); y <= Math.ceil(foto.cab.base); y++) {
    naContagem.push(varrer(y, foto.cab.esq, foto.cab.dir));
  }
  const naFronteira = [1, 5, 9, 13, 17, 21].map((d) => varrer(Math.round(foto.res.topo) + d,
    foto.res.esq, foto.res.dir));
  const abaixoDaTira = [24, 30].map((d) => varrer(Math.round(foto.res.topo) + d,
    foto.res.esq, foto.res.dir));
  checar(foto.acima && !foto.semVeu && foto.veuH === 22 && foto.transborda > 100
    && foto.cab.base <= foto.res.topo,
    'O · a PREMISSA da medição: a lista está ROLADA (tira de cima ligada, '
    + foto.transborda + 'px escondidos) e a contagem fica ACIMA do scroller — sem '
    + 'a tira no ar, "não pinta na contagem" passaria por vácuo', foto);
  // O ESCURECIMENTO É LIDO NO MÁXIMO DA FAIXA, e não linha a linha: o degradê vai
  // de `rgba(0,0,0,.30)` a transparente, e o que ele muda em LUMINÂNCIA depende
  // do que está embaixo — MEDIDO, a mesma tira dá 0,0376 sobre o texto de uma
  // linha e 0,0022 sobre o vão entre duas. Por LINHA a régua mediria o conteúdo
  // da lista; o que é dela, e vale nas 22, é a COBERTURA de borda a borda.
  const tinge = Math.max(...naFronteira.map((l) => l.maxd));
  checar(naFronteira.every((l) => l.mudou === l.total) && tinge >= 0.02
    && abaixoDaTira.every((l) => l.mudou === 0),
    'O · e a tira PINTA na fronteira do scroller, de borda a borda, nas 22 linhas '
    + 'dela e em nenhum pixel abaixo — é o corte de verdade que ela passou a '
    + 'marcar', JSON.stringify({ tinge, naFronteira, abaixoDaTira }));
  checar(naContagem.every((l) => l.mudou === 0 && l.maxd === 0),
    'O · e NENHUM pixel da faixa da contagem muda com a tira ligada: fora do '
    + 'scroller ela não é mais coberta pela sombra dele — dentro, a tira de '
    + '`z-index: 5` pintava sobre a linha de 19,5px e apagava a única marca que '
    + 'dizia onde a lista foi cortada', JSON.stringify(naContagem));

  // (P) O VÃO ENTRE A BARRA E A CONTAGEM, E A FALA QUE SÓ OCUPA QUANDO FALA.
  //
  // MEDIDO a 430×900: 25,9px entre a barra de ação e a contagem, dos quais 14,7
  // eram a linha do recibo VAZIA mais os vãos da folha. Ela era reservada de
  // propósito (a regra da v1.8.61, contra a folha que pula debaixo do dedo), e o
  // que autoriza a reserva a cair é a POSIÇÃO: o recibo mora abaixo de todo
  // botão, e quem cede quando ele aparece é a lista, que é `flex: 0 1 auto`.
  // É essa segunda metade que a asserção do recibo mede junto — sem ela, o
  // conserto do vão teria comprado um motor de pulo.
  const calada = await pg.evaluate(() => {
    const barra = document.querySelector('#sorteioList .sorteio-barra');
    const fala = document.querySelector('#sorteioList .sorteio-fala');
    const cab = document.querySelector('#sorteioList .sorteio-res-cab');
    return { barra: Math.round(barra.getBoundingClientRect().bottom * 10) / 10,
      existe: !!fala, texto: fala.textContent,
      display: getComputedStyle(fala).display,
      altura: Math.round(fala.getBoundingClientRect().height * 10) / 10,
      vao: Math.round((cab.getBoundingClientRect().top
        - barra.getBoundingClientRect().bottom) * 10) / 10 };
  });
  checar(calada.existe && calada.texto === '' && calada.display === 'none'
    && calada.altura === 0 && calada.vao <= 8,
    'P · calada, a linha do recibo está no DOM e não ocupa um pixel — e o vão '
    + 'entre a barra de ação e a contagem cai a ' + calada.vao + 'px (media 25,9)',
    calada);
  const falando = await pg.evaluate(async () => {
    falarNoSorteio('5 músicas acrescentadas ao fim da playlist');
    await new Promise((r) => setTimeout(r, 60));
    const barra = document.querySelector('#sorteioList .sorteio-barra');
    const fala = document.querySelector('#sorteioList .sorteio-fala');
    const cab = document.querySelector('#sorteioList .sorteio-res-cab');
    return { barra: Math.round(barra.getBoundingClientRect().bottom * 10) / 10,
      texto: fala.textContent.slice(0, 8),
      display: getComputedStyle(fala).display,
      altura: Math.round(fala.getBoundingClientRect().height * 10) / 10,
      vao: Math.round((cab.getBoundingClientRect().top
        - barra.getBoundingClientRect().bottom) * 10) / 10 };
  });
  checar(falando.display !== 'none' && falando.altura >= 10
    && falando.vao > calada.vao && falando.barra === calada.barra,
    'P · e com texto ela VOLTA a ocupar uma linha, sem mexer a barra de ação um '
    + 'pixel: a regra é `:empty`, e o dia em que alguém a tirar do seletor leva '
    + 'o recibo do lote junto — que é a única frase da folha que não repete a tela',
    { calada, falando });

  // (Q) REABRIR ZERA OS TRÊS FILTROS E A PALAVRA.
  //
  // Pelos CHIPS RENDERIZADOS e pelo valor do campo, nunca pelo objeto de
  // preferências: é o que o operador vê, e um `sorteioPrefs` limpo com a folha
  // desenhada por cima do estado velho é o mesmo defeito de sempre — a tela
  // discordando do aparelho.
  //
  // A PALAVRA É PLANTADA DEPOIS DO FECHAMENTO, e isso está dito porque não é
  // óbvio: o `fecharSorteio` já a limpa desde a v5.307, então sem o plantio a
  // linha nova do `abrirSorteio` ficaria sem oráculo — ela é a SEGUNDA guarda, a
  // que cobre uma reabertura que não passe pelo fechamento. Os TRÊS FILTROS não
  // precisam de plantio nenhum: eles são gravados (`saveSorteioPrefs`) e
  // atravessam o fechamento por construção, que é o que tornava o relato
  // possível.
  const reabrir = await pg.evaluate(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    calarSorteio();
    const chips = () => [...document.querySelectorAll('#sorteioList .sorteio-linha .misc-chip')];
    const foto = async () => ({
      acesos: chips().filter((c) => c.classList.contains('active')).map((c) => c.textContent),
      aria: chips().map((c) => c.getAttribute('aria-pressed')),
      campo: document.querySelector('#sorteioList .lib-search').value,
      prefs: [sorteioPrefs.semHinario, sorteioPrefs.semInfantis, sorteioPrefs.soNoAparelho,
        sorteioPrefs.tema],
      gravado: await AVDB.getState('sorteioPrefs'),
    });
    // PELO TOQUE DE VERDADE em cada chip, que é quem grava.
    for (const c of chips()) if (!c.classList.contains('active')) c.click();
    await w(80);
    const campo = document.querySelector('#sorteioList .lib-search');
    campo.value = 'natal';
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    await w(SEARCH_DEBOUNCE_MS + 120);
    const antes = await foto();
    fecharSorteio();
    await w(40);
    const noFechamento = await foto();
    sorteioPrefs.tema = 'natal';
    await abrirSorteio();
    await w(QH_ASSENTA_MS * 3);
    return { antes, noFechamento, depois: await foto() };
  });
  checar(reabrir.antes.acesos.length === 3 && reabrir.antes.campo === 'natal'
    && reabrir.noFechamento.gravado.semHinario === true
    && reabrir.noFechamento.gravado.semInfantis === true
    && reabrir.noFechamento.gravado.soNoAparelho === true,
    'Q · a PREMISSA: os três chips foram ACESOS pelo toque e a palavra escrita no '
    + 'campo, e os três ATRAVESSAM o fechamento no registro gravado — é essa '
    + 'sobrevivência que fazia o filtro esquecido tirar músicas do culto sem que '
    + 'ninguém lembrasse por quê', reabrir);
  checar(reabrir.depois.acesos.length === 0
    && reabrir.depois.aria.join() === 'false,false,false'
    && reabrir.depois.campo === ''
    && JSON.stringify(reabrir.depois.prefs) === JSON.stringify([false, false, false, '']),
    'Q · e a reabertura desenha os TRÊS apagados e o campo vazio — inclusive o '
    + '"Sem infantis", cujo "nasce ligado" o operador revogou por extenso; o '
    + '`sanear` segue o ligando para quem LÊ um registro, e a folha o apaga por '
    + 'escrito a cada abertura', reabrir.depois);

  checar(erros.length === 0, 'nenhum erro de console', erros.slice(0, 3));
} finally {
  await navegador.close();
  servidor.close();
}

console.log('\n' + (falhas.length ? falhas.length + ' FALHA(S)' : 'tudo certo'));
process.exit(falhas.length ? 1 : 0);
