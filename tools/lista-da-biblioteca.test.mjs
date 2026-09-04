#!/usr/bin/env node
// ============================================================================
// A LISTA DA BIBLIOTECA: A DIVISÓRIA, O ESTADO E O VÉU DAS BORDAS (v1.5.16)
//
// Três pedidos do operador chegaram no mesmo lote, e os três terminam na MESMA
// caixa que rola (`#hymnResults`):
//
//  · *"um efeito de blur na borda interna superior ou inferior, quando algum
//    elemento da tela ir para debaixo dessa borda"* — o VÉU;
//  · *"um elemento de linha divisória (não borda inteira), na listagem do itens
//    propriamente dos álbuns"* — a DIVISÓRIA;
//  · e, ao desenhar a segunda, um defeito de CASCATA que ninguém tinha visto:
//    dentro da Biblioteca a faixa NO TELÃO não pintava nada.
//
// ## Por que eles falham CALADOS, um a um
//
// Nenhum dos três lança, nenhum aparece no console e nenhum quebra um fluxo. O
// que cada um produz quando erra é uma tela que CONTINUA FUNCIONANDO:
//
//  · a divisória desenhada em toda faixa (e não só entre irmãs) vira uma lista
//    riscada em cima do cabeçalho de seção e por baixo da última linha — ainda
//    legível, só errada;
//  · o traço fora da coluna do nome fica dois pixels adiante em TODA a
//    Biblioteca, e não há número na tela para conferir;
//  · o estado que não pinta é o pior: uma lista BEM DIVIDIDA em que a faixa no
//    ar não salta parece uma lista certa;
//  · e o véu, se cobrir a tampa grudada ou comer o toque dos 22px de cima e de
//    baixo, tira do operador exatamente a linha que ele estava mirando —
//    também sem erro nenhum.
//
// ## As três réguas deste arquivo
//
//  1. **O PIXEL, onde a pergunta é "o que apareceu na tela?"** Um traço tem
//     1px de altura e o que o cobre é a `.row` de uma faixa com estado: as duas
//     metades são de PINTURA, e um teste de regra de CSS aprova as duas
//     versões.
//  2. **NENHUM NÚMERO ESCRITO AQUI.** O recuo da divisória sai de um `calc()`
//     em `rem`; escrever `54px` mede o `font-size` da raiz do runner pela porta
//     dos fundos. Os dois lados de cada comparação são medidas do MESMO
//     desenho — o traço contra o `.hymn-name`, a tira contra a borda do
//     scroller, a faixa no ar contra a MESMA `.lib-item.no-ar` de outra lista.
//  3. **A REVERSÃO ao lado de cada afirmação.** "Desenhar em toda faixa"
//     passaria na contagem; "pintar tudo" passaria no estado; `mask-image` no
//     scroller passaria no véu. É o outro lado que separa o desenho pedido do
//     conserto preguiçoso que se parece com ele.
//
// A PRIMEIRA TEM UMA EXCEÇÃO, e ela é do caso F (a tampa da v1.5.19): ali a
// pergunta é GEOMETRIA, e a `box-shadow` da tampa grudada escurece justamente o
// vão que se quer medir — uma sonda de tela não separa "a placa começa aqui" de
// "a sombra da barra chega até aqui". Onde a tinta é um degradê a régua é a
// CAIXA, e a exceção está escrita no bloco em vez de deixada por conta.
//
//   node tools/lista-da-biblioteca.test.mjs
// ============================================================================
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, checar, falhas } from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);

// Espera pelo FATO; o estouro devolve a FRASE, nunca um veredito sobre o app.
async function esperar(pg, fn, msg, arg, ms = 15000) {
  try { await pg.waitForFunction(fn, arg, { timeout: ms }); checar(true, msg); return true; }
  catch (_) { checar(false, msg, 'PRAZO, não veredito: a condição não chegou em ' + ms + 'ms'); return false; }
}

// ---- O PIXEL --------------------------------------------------------------
// Decodificador PNG mínimo (8 bits, RGB/RGBA, sem entrelaçamento) — o formato
// que o Chromium devolve. Ele existe porque as duas perguntas centrais deste
// arquivo ("o traço apareceu?", "onde a tira pousou?") só têm resposta no que
// foi PINTADO, e um `getComputedStyle` de pseudo-elemento responde pela caixa
// declarada, não pela tinta.
function lerPng(buf) {
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
        const pp = a + b - c; const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      dst[i] = v & 255;
    }
  }
  return {
    w, h,
    em(x, y) {
      if (x < 0 || y < 0 || x >= w || y >= h) return [-1, -1, -1];
      const i = y * passo + x * canais; return [out[i], out[i + 1], out[i + 2]];
    },
  };
}
const dif = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
// AS DUAS SONDAS DE UMA FAIXA, e onde elas caem é medição, não gosto.
//
// A comparação é sempre "à esquerda da coluna do nome" contra "dentro dela": o
// traço só existe do `--faixa-coluna-texto` para a direita, então a mesma linha
// de pixel responde as duas coisas e nenhuma tinta de referência é escrita aqui.
//
// A DA ESQUERDA É O MEIO DO CAMINHO, nunca a borda: a faixa tem
// `border-radius` (MEDIDO, 8px) com `overflow: hidden`, e uma sonda a 6px da
// borda cai DENTRO DA CURVA — no topo da faixa aquele ponto está FORA da caixa
// e lê a placa. Com estado no ar isso rendia 5 níveis de diferença onde a
// resposta certa é ZERO, e o oráculo reprovava a cobertura por causa do canto.
const sondas = (l) => ({
  fora: Math.round(l.esq + (l.nome - l.esq) / 2),
  dentro: Math.round(l.nome) + 20,
});
// A BANDA DE TRÊS LINHAS, e ela não é folga preguiçosa: o topo de uma faixa cai
// em coordenada FRACIONÁRIA (a lista inteira acima dela tem altura de texto), e
// um traço de 1px pode ser composto entre duas linhas de pixel. O que se
// procura é o MAIOR contraste dentro da banda — presente ele é dezenas de
// níveis, ausente ele é zero. Três linhas e não cinco: a QUARTA já alcança a
// primeira letra do nome, e texto é contraste que não é o traço.
function tracoNaBanda(img, y, l) {
  const { fora, dentro } = sondas(l);
  let m = 0;
  for (let dy = -1; dy <= 1; dy++) m = Math.max(m, dif(img.em(fora, y + dy), img.em(dentro, y + dy)));
  return m;
}
const HA_TRACO = 12;    // MEDIDO: 44 níveis, no tema escuro
const SEM_TRACO = 4;    // MEDIDO: 0 — as duas sondas leem o mesmo pixel

// ---- O acervo semeado -----------------------------------------------------
// O Hinário 2022 com 30 faixas CRUZA dois limites de seção (15 e 23, pela
// tabela do `hinario.js`): é a única lista do app em que um `<li>` que não é
// faixa mora no meio das faixas, e é ela que prova a terceira ausência.
// O álbum tem 5, que é o mínimo para haver uma primeira, uma última e três
// pares no meio.
const FAIXAS_HINARIO = 30;
const FAIXAS_ALBUM = 5;
const SECAO = 'Álbuns de teste';

await new Promise((r) => servidor.listen(0, r));
const porta = servidor.address().port;
const navegador = await abrirNavegador();
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);
// O modo avançado SEMEADO antes da primeira linha do app: ligá-lo por
// `evaluate` depois da carga é uma corrida contra o `setAppMode(appMode)` do
// `init()`, que chama `closeHymnSearch()`.
await ctx.addInitScript(() => {
  try { localStorage.setItem('av.appMode', 'full'); } catch (_) { /* storage bloqueado */ }
});
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
  await pg.waitForFunction(() => (
    window.AVDB && window.AVStream && window.createStage && window.AVHinario
      && typeof window.__avBack === 'function'
      && !!document.querySelector('#playlist li')
      && !!document.querySelector('.lib-bar')
  ), null, { timeout: 30000 });

  // ---- A JANELA ASSENTA ANTES DE QUALQUER MEDIDA -------------------------
  // Ela SOBE ao abrir, e este arquivo mede PIXEL: no meio da subida a lista
  // está com o fundo fora da viewport (MEDIDO: base em 1223 de 900) e toda
  // sonda de tela responde sobre um retângulo que não existe. O que se espera é
  // o FATO — a folha inteira dentro da tela, sem animação correndo —, nunca um
  // prazo: `getAnimations()` é quem sabe quando o movimento acabou.
  await pg.evaluate(() => { setAppMode('full'); openHymnSearch(false); });
  if (!await esperar(pg, () => {
    const s = document.querySelector('.popup-sheet--lib');
    if (!s) return false;
    if (s.getAnimations().some((a) => a.playState === 'running')) return false;
    return s.getBoundingClientRect().bottom <= window.innerHeight + 1;
  }, 'a janela da Biblioteca sobe e ASSENTA dentro da tela', null, 10000)) {
    throw new Error('a Biblioteca não assentou');
  }

  const montado = await pg.evaluate(async ({ nH, nA, secao }) => {
    const faixas = (n, pre) => Array.from({ length: n }, (_, i) => ({
      id_music: pre + (i + 1), track: i + 1, name: 'Faixa ' + (i + 1),
      duration: '3:00', has_instrumental_music: false,
    }));
    collState['hymnal-2022'] = { indexSyncedAt: Date.now(), isHymnal: true, songs: faixas(nH, 'h') };
    albumCatalog.categories = [{ name: secao, albums: [{ id_album: 77, name: 'Álbum de teste' }] }];
    albumCatalog.albums = [{ id_album: 77, name: 'Álbum de teste' }];
    collState['album-77'] = { indexSyncedAt: Date.now(), songs: faixas(nA, 'a') };
    // UM FAVORITO DE VERDADE: é o irmão do defeito de cascata, e o único dos
    // dois que o app de fato marca sozinho (`marcarNoAr` lê `dataset.id`).
    const fav = await AVDB.addMedia(new Blob(['x'], { type: 'audio/mpeg' }),
      { name: 'Favorito de teste', list: 'favs' });
    window.__favId = fav.id;
    // UM SEGUNDO FAVORITO: a divisória pertence ao PAR, e com um item só a
    // lista não tem par nenhum (v1.5.18).
    await AVDB.addMedia(new Blob(['y'], { type: 'audio/mpeg' }),
      { name: 'Favorito vizinho', list: 'favs' });
    await recarregarFavoritos();
    grupoAberto = secao; favAberto = true;
    ui('album-77').expanded = true; ui('album-77').shown = 1000;
    ui('hymnal-2022').expanded = true; ui('hymnal-2022').shown = 1000;
    hymnResultsEl.innerHTML = '';   // `renderCollectionsList` ACRESCENTA (v5.232)
    renderCollectionsList(hymnResultsEl, () => {}, { semTotal: true });
    await new Promise((f) => requestAnimationFrame(() => requestAnimationFrame(f)));
    const listas = [...document.querySelectorAll('#hymnResults .coll-songs')];
    return {
      album: listas.some((u) => u.querySelectorAll('.hymn-result').length === nA),
      hinario: listas.some((u) => u.querySelector('.hino-secao')),
      fav: !!document.querySelector('#hymnResults > .coll-group--fav.aberto .fav-itens > .lib-item'),
      acervo: hymnResultsEl.classList.contains('acervo'),
    };
  }, { nH: FAIXAS_HINARIO, nA: FAIXAS_ALBUM, secao: SECAO });
  checar(montado.album && montado.hinario && montado.fav && montado.acervo,
    'o cenário está de pé: um álbum dentro de uma seção, o Hinário 2022 com '
    + 'cabeçalhos de seção, e um favorito na placa', montado);
  if (!montado.album || !montado.hinario) throw new Error('cenário incompleto');

  // ======================================================================
  // A0 · O RESPIRO ANTES DO PRIMEIRO CARD, NO `#hymnResults` DE VERDADE (v1.5.20)
  // ======================================================================
  //
  // Relato do operador: *"a margem do card da coleção favoritos, na
  // biblioteca e a barra de buscas no topo, está desproporcional aos
  // espaçamentos que já temos entre as coleções. Fazendo a coleção colar no
  // topo, e errando o design correto"*.
  //
  // O `smoke.mjs` já cobre a REGRA (o respiro bate com `--sp-5`) numa
  // `<ul class="popup-list">` avulsa, sem o id — este caso é o PAR na lista
  // REAL, onde o `gap` entre coleções de raiz é o `#hymnResults { gap:
  // var(--sp-5) }`, e é justamente essa comparação que o relato pede: o
  // respiro antes do primeiro card tem de valer o MESMO que o respiro entre
  // duas coleções, não um número à parte.
  const a0 = await pg.evaluate(() => {
    const bar = document.getElementById('libBar');
    const lista = document.getElementById('hymnResults');
    const blocos = [...lista.children].filter((n) => n.nodeType === 1);
    return {
      buscaAoPrimeiro: +(blocos[0].getBoundingClientRect().top
        - bar.getBoundingClientRect().bottom).toFixed(2),
      entreDoisDeRaiz: blocos[1] ? +(blocos[1].getBoundingClientRect().top
        - blocos[0].getBoundingClientRect().bottom).toFixed(2) : null,
      paddingTopoScroller: parseFloat(getComputedStyle(lista).paddingTop) || 0,
    };
  });
  checar(a0.paddingTopoScroller === 0,
    'A0a · o SCROLLER (`#hymnResults`) continua sem `padding-top` — o respiro '
    + 'não voltou pelo caminho que causava o vazamento acima de uma tampa '
    + 'colada (v1.5.15)', a0);
  checar(a0.buscaAoPrimeiro > 0.6 && a0.entreDoisDeRaiz !== null
    && Math.abs(a0.buscaAoPrimeiro - a0.entreDoisDeRaiz) <= 0.6,
    'A0b · o primeiro card (Favoritos) respira da barra de busca o MESMO que '
    + 'duas coleções de raiz respiram entre si — nem colado (o defeito '
    + 'relatado), nem um respiro à parte',
    a0.buscaAoPrimeiro + 'px contra ' + a0.entreDoisDeRaiz + 'px entre coleções');

  // ======================================================================
  // A · A DIVISÓRIA ENTRE FAIXAS IRMÃS
  // ======================================================================
  //
  // A regra é `.acervo .coll-songs > .hymn-result + .hymn-result::before`, e o
  // `+` é o desenho inteiro: a divisória pertence ao PAR, não à faixa.
  const divis = await pg.evaluate(({ nA }) => {
    const pintado = (el) => {
      const c = getComputedStyle(el, '::before');
      const m = (c.backgroundColor.match(/[\d.]+/g) || []).map(Number);
      return c.content !== 'none' && c.display !== 'none'
        && parseFloat(c.height) > 0 && (m.length < 4 || m[3] > 0);
    };
    const listas = [...document.querySelectorAll('#hymnResults .coll-songs')];
    const alb = listas.find((u) => u.querySelectorAll('.hymn-result').length === nA);
    const hin = listas.find((u) => u.querySelector('.hino-secao'));
    const lis = [...alb.querySelectorAll('.hymn-result')];
    // A LISTA DO HINÁRIO EM FORMA: `S` é um cabeçalho de seção, `T` uma faixa
    // com traço, `-` uma faixa sem. O que se afirma é que todo `S` é seguido de
    // `-`, que é a terceira ausência.
    const forma = [...hin.children]
      .filter((e) => e.classList.contains('hymn-result') || e.classList.contains('hino-secao'))
      .map((e) => (e.classList.contains('hino-secao') ? 'S' : (pintado(e) ? 'T' : '-'))).join('');
    return {
      quantos: lis.filter(pintado).length,
      total: lis.length,
      primeira: pintado(lis[0]),
      // A ÚLTIMA não pode ter nada ABAIXO: a regra só cria `::before`, e um
      // `::after` que aparecesse desenharia sob a última linha da lista.
      depoisDaUltima: getComputedStyle(lis[lis.length - 1], '::after').content !== 'none',
      forma,
      secoes: (forma.match(/S/g) || []).length,
      seguidaDeTraco: /S[T]/.test(forma),
      gap: parseFloat(getComputedStyle(alb).rowGap),
      // O RECUO, pelos dois lados do MESMO desenho: a posição resolvida do
      // pseudo (o `calc()` em `rem` já computado) e a caixa do `.hymn-name` tal
      // como o layout a colocou.
      recuo: (() => {
        const li = lis[1];
        const esq = li.getBoundingClientRect().left + parseFloat(getComputedStyle(li, '::before').left);
        return { traco: esq, nome: li.querySelector('.hymn-name').getBoundingClientRect().left };
      })(),
    };
  }, { nA: FAIXAS_ALBUM });

  checar(divis.quantos === divis.total - 1 && divis.total === FAIXAS_ALBUM,
    'A1 · numa lista de ' + FAIXAS_ALBUM + ' faixas há exatamente ' + (FAIXAS_ALBUM - 1)
    + ' divisórias PINTADAS — uma por PAR, e não uma por faixa', divis);
  checar(!divis.primeira,
    'A3a · nada acima da PRIMEIRA faixa: o `+` não casa quem não tem irmã antes', divis);
  checar(!divis.depoisDaUltima,
    'A3b · nada abaixo da ÚLTIMA: a regra desenha no topo da faixa DE BAIXO, '
    + 'então a lista nunca termina num traço solto', divis);
  checar(divis.secoes >= 2 && !divis.seguidaDeTraco,
    'A3c · nada entre um `.hino-secao` e a faixa que ele encabeça — o cabeçalho '
    + 'é um `<li>` irmão na MESMA `<ul>`, e `+` não casa através dele', divis);
  checar(divis.gap > 0,
    'A4 · e ela SOMA ao espaço em vez de substituí-lo: o `gap` da `.coll-songs` '
    + 'continua maior que zero (' + divis.gap + 'px)', divis);
  checar(Math.abs(divis.recuo.traco - divis.recuo.nome) <= 1,
    'A2 · o traço começa na COLUNA DO NOME (±1px): a borda esquerda dele e a do '
    + '`.hymn-name` são o mesmo x — as duas medidas saem do desenho, nenhuma é '
    + 'um número escrito no oráculo', divis.recuo);

  // ---- A2/A1 no PIXEL, e A5 -------------------------------------------
  // O traço é UMA linha de 1px: contar pseudo-elementos prova que a caixa
  // existe, não que ela apareceu. Aqui a lista é trazida para dentro da vista e
  // o que responde é a tinta.
  const posto = async () => {
    const alvo = await pg.evaluate(({ nA }) => {
      const alb = [...document.querySelectorAll('#hymnResults .coll-songs')]
        .find((u) => u.querySelectorAll('.hymn-result').length === nA);
      const lis = [...alb.querySelectorAll('.hymn-result')];
      const topo = lis[0].getBoundingClientRect().top - hymnResultsEl.getBoundingClientRect().top;
      // 120px de folga: acima das faixas ficam DUAS tampas grudadas (a da seção
      // e a do álbum) e elas somam ~90px. Menos que isso mediria pixel de barra.
      hymnResultsEl.scrollTop = Math.round(hymnResultsEl.scrollTop + topo - 120);
      // O NÚMERO QUE A CAIXA ASSUMIU, nunca o pedido: `scrollTop` é CLAMPADO
      // pelo conteúdo, e esperar pelo pedido é esperar por um valor que a caixa
      // nunca vai ter — um prazo estourado que se leria como defeito do app.
      return hymnResultsEl.scrollTop;
    }, { nA: FAIXAS_ALBUM });
    await pg.waitForFunction((t) => Math.abs(document.getElementById('hymnResults').scrollTop - t) <= 1,
      alvo, { timeout: 5000 });
    await pg.evaluate(() => new Promise((f) => requestAnimationFrame(() => requestAnimationFrame(f))));
  };
  const caixas = async () => pg.evaluate(({ nA }) => {
    const alb = [...document.querySelectorAll('#hymnResults .coll-songs')]
      .find((u) => u.querySelectorAll('.hymn-result').length === nA);
    return [...alb.querySelectorAll('.hymn-result')].map((li) => {
      const r = li.getBoundingClientRect();
      const n = li.querySelector('.hymn-name').getBoundingClientRect();
      return { topo: r.top, base: r.bottom, esq: r.left, nome: n.left };
    });
  }, { nA: FAIXAS_ALBUM });

  await posto();
  const lis = await caixas();
  let img = lerPng(await pg.screenshot());
  {
    const forcas = lis.map((l, i) => ({ i, f: tracoNaBanda(img, Math.round(l.topo), l) }));
    checar(forcas[0].f <= SEM_TRACO && forcas.slice(1).every((v) => v.f >= HA_TRACO),
      'A1-pixel · e o traço APARECE: na tinta, as ' + (FAIXAS_ALBUM - 1) + ' faixas '
      + 'com irmã acima têm contraste no topo e a primeira não tem nenhum', forcas);
    // NADA ABAIXO DA ÚLTIMA, no pixel: a banda logo abaixo do fim da última
    // faixa (dentro do vão da lista) tem de ler a placa dos dois lados.
    const ul = lis[lis.length - 1];
    const abaixo = tracoNaBanda(img, Math.round(ul.base) + 2, ul);
    checar(abaixo <= SEM_TRACO,
      'A3b-pixel · e o vão logo abaixo da última faixa continua liso', { abaixo });
    // O RECUO no pixel: varrendo da borda esquerda da faixa até achar o
    // primeiro x com contraste, o traço começa onde o nome começa.
    const l = lis[1]; const y = Math.round(l.topo); const ref = sondas(l).fora;
    let primeiro = -1;
    for (let px = ref; px < ref + 140; px++) {
      let m = 0;
      for (let dy = -1; dy <= 1; dy++) m = Math.max(m, dif(img.em(ref, y + dy), img.em(px, y + dy)));
      if (m >= 20) { primeiro = px; break; }   // 20 pula o pixel de borda composto
    }
    checar(primeiro >= 0 && Math.abs(primeiro - l.nome) <= 1.5,
      'A2-pixel · e a tinta confirma a coluna: o primeiro pixel do traço cai '
      + 'sobre a borda esquerda do `.hymn-name`', { primeiro, nome: l.nome });
  }

  // ---- A5 · A FAIXA DE UM ÁLBUM NÃO RECEBE ESTADO ----------------------
  // A regra do traço não tem `z-index`, e a `.row` (z-index 1) o cobriria se
  // pintasse um `--linha` OPACO. Dentro de um álbum isso não acontece — e a
  // razão é anterior à cor: a faixa NUNCA é marcada. Quem escreve `.no-ar` /
  // `.active` é o `marcarNoAr`, que varre `.lib-item,.row-item` e lê
  // `el.dataset.id`; o `hymnResultRow` escreve `dataset.song` e nunca
  // `dataset.id`.
  //
  // O QUE SE AFIRMA É A AUSÊNCIA, pelo caminho REAL, e ela é o par da B0 logo
  // abaixo (onde o FAVORITO, que escreve `dataset.id`, É marcado no mesmo
  // passe). As duas juntas dizem por que o conserto tem duas metades — ver
  // `docs/ACHADOS-EM-ABERTO.md`. Escrever aqui "a faixa no ar pinta" seria
  // afirmar um estado que o app não produz, e o oráculo passaria a bloquear o
  // conserto em vez de guardá-lo.
  {
    const marcacao = await pg.evaluate(({ nA }) => {
      const alb = [...document.querySelectorAll('#hymnResults .coll-songs')]
        .find((u) => u.querySelectorAll('.hymn-result').length === nA);
      const faixa = alb.querySelectorAll('.hymn-result')[2];
      const fav = document.querySelector('.coll-group--fav .fav-itens > .lib-item');
      // O caminho REAL: pôr a mídia no ar com o id do FAVORITO e mandar o app
      // marcar. Um `classList.add` à mão mediria o oráculo, não o app.
      const antesM = window.midiaNoAr; const antesI = window.midiaNoArId;
      midiaNoAr = true; midiaNoArId = fav ? fav.dataset.id : null;
      marcarNoAr();
      const r = {
        favTemId: !!(fav && fav.dataset.id),
        favMarcado: !!(fav && fav.classList.contains('no-ar')),
        faixaTemId: !!faixa.dataset.id,
        faixaMarcada: faixa.classList.contains('no-ar')
          || faixa.classList.contains('active') || faixa.classList.contains('selected'),
      };
      midiaNoAr = antesM; midiaNoArId = antesI; marcarNoAr();
      return r;
    }, { nA: FAIXAS_ALBUM });
    checar(marcacao.favTemId && marcacao.favMarcado,
      'A5a · o FAVORITO no ar é marcado pelo caminho REAL (`marcarNoAr`) — ele '
      + 'escreve `dataset.id`, e é essa metade que o lote consertou',
      marcacao);
    checar(!marcacao.faixaTemId && !marcacao.faixaMarcada,
      'A5b · e a faixa de um ÁLBUM não é marcada: `hymnResultRow` não escreve '
      + '`dataset.id`. É a AUSÊNCIA que está registrada em ACHADOS-EM-ABERTO, e '
      + 'ela é o par da de cima — não uma promessa que o app não cumpre',
      marcacao);
  }

  // ======================================================================
  // B · O ESTADO DENTRO DA BIBLIOTECA
  // ======================================================================
  //
  // `.acervo .coll-songs > .hymn-result` é (0,3,0) e `.lib-item.no-ar` é
  // (0,2,0): sem o `:not()` da v1.5.16 o estado resolvia `transparent` e a
  // linha no telão não pintava nada. Sobravam a cor do nome e o selo.
  //
  // A RÉGUA NÃO É CONTRASTE, e isso é medição, não gosto: `--live-fill` é um
  // vermelho de luminância quase igual à do painel (MEDIDO, 1,12:1 no escuro).
  // Uma razão de luminância reprovaria o desenho CERTO. O que se afirma é que a
  // faixa resolve a MESMA tinta que a mesma `.lib-item.no-ar` de outra lista do
  // app — e é por ser a mesma que ela é comparável sem número nenhum.
  //
  // A COR EFETIVA é COMPOSTA (a técnica do `smoke.mjs`): `getComputedStyle`
  // devolve o alfa declarado, não o que se vê, e `--item-fill` no tema claro é
  // branco a 80% sobre branco — indistinguível de "não pintou".
  const COMPOR = `
    const efetiva = (el) => {
      if (!el) return 'AUSENTE';
      const pilha = [];
      for (let n = el; n; n = n.parentElement) {
        const m = (getComputedStyle(n).backgroundColor.match(/[\\d.]+/g) || []).map(Number);
        if (m.length < 3) continue;
        const a = m.length > 3 ? m[3] : 1;
        if (a === 0) continue;
        pilha.push([m[0], m[1], m[2], a]);
        if (a === 1) break;
      }
      let c = [0, 0, 0];
      for (let k = pilha.length - 1; k >= 0; k--) {
        const [vr, vg, vb, va] = pilha[k];
        c = [vr * va + c[0] * (1 - va), vg * va + c[1] * (1 - va), vb * va + c[2] * (1 - va)];
      }
      return 'rgb(' + c.map(Math.round).join(', ') + ')';
    };`;
  const distancia = (a, b) => {
    if (a === 'AUSENTE' || b === 'AUSENTE') return -1;
    const p = (s) => s.match(/\d+/g).map(Number);
    const [x, y] = [p(a), p(b)];
    return Math.max(Math.abs(x[0] - y[0]), Math.abs(x[1] - y[1]), Math.abs(x[2] - y[2]));
  };

  for (const tema of ['escuro', 'claro']) {
    const e = await pg.evaluate(new Function('arg', COMPOR + `
      const { tema, nA } = arg;
      document.documentElement.setAttribute('data-tema', tema);
      const alb = [...document.querySelectorAll('#hymnResults .coll-songs')]
        .find((u) => u.querySelectorAll('.hymn-result').length === nA);
      const lis = [...alb.querySelectorAll('.hymn-result')];
      lis.forEach((l) => l.classList.remove('no-ar', 'active', 'selected'));
      const neutra = efetiva(lis[0]);
      const placa = efetiva(alb);
      lis[1].classList.add('no-ar');
      const noAr = efetiva(lis[1]);
      lis[2].classList.add('selected');
      const selecionada = efetiva(lis[2]);
      // O IRMÃO DOS FAVORITOS, e ele vai pelo CAMINHO REAL: quem marca é o
      // \`marcarNoAr\`, a mesma função que roda a cada \`display-status\`. É essa
      // linha que dá a tinta CANÔNICA do estado neste documento e neste tema.
      const favLi = document.querySelector('#hymnResults > .coll-group--fav.aberto .fav-itens > .lib-item');
      const favNeutro = efetiva(favLi);
      midiaNoAr = true; midiaNoArId = window.__favId; marcarNoAr();
      const favMarcado = favLi.classList.contains('no-ar');
      const favNoAr = efetiva(favLi);
      midiaNoAr = false; midiaNoArId = null; marcarNoAr();
      // \`marcarNoAr\` varre TODA \`.lib-item\` e tira a classe de quem não tem
      // \`dataset.id\` — as faixas do acervo entre elas. Repostas para a medida
      // seguinte não medir uma tela já limpa.
      lis[1].classList.add('no-ar'); lis[2].classList.add('selected');
      const noAr2 = efetiva(lis[1]);
      lis.forEach((l) => l.classList.remove('no-ar', 'active', 'selected'));
      return { neutra, placa, noAr, noAr2, selecionada, favNeutro, favNoAr, favMarcado };
    `), { tema, nA: FAIXAS_ALBUM });

    checar(e.favMarcado,
      '[' + tema + '] B0 · o favorito no ar é marcado pelo caminho REAL '
      + '(`marcarNoAr`), que é de onde sai a tinta canônica do estado', e);
    checar(distancia(e.neutra, e.placa) === 0,
      '[' + tema + '] B4 · REVERSÃO: a faixa NEUTRA continua SEM preenchimento — '
      + 'ela lê a placa por baixo, que é a regra da v1.5.14. Sem esta metade, '
      + '"pintar tudo" passaria', e);
    // (B1/B2/B3 — a faixa de ÁLBUM no ar — saíram na revisão deste lote: elas
    // afirmavam um estado que o app não produz. Ver A5b e ACHADOS-EM-ABERTO.)
    checar(distancia(e.favNoAr, e.favNeutro) >= 8,
      '[' + tema + '] B5 · o FAVORITO no ar PINTA, e a cor difere da linha neutra '
      + 'ao lado — é o conserto de cascata deste lote: `#hymnResults > '
      + '.coll-group--fav.aberto .fav-itens > .lib-item` é (1,4,0) e perdia pelo '
      + 'mesmo motivo', e);
  }
  await pg.evaluate(() => document.documentElement.setAttribute('data-tema', 'escuro'));

  // ======================================================================
  // C · O VÉU DAS BORDAS DO SCROLLER
  // ======================================================================
  //
  // Duas tiras `sticky` de 22px em `z-index: 2`, com `backdrop-filter`, ligadas
  // por `tem-acima`/`tem-abaixo`. Elas ficam ACIMA do conteúdo e ABAIXO das
  // tampas grudadas (z 3 e 4) — e é esse degrau que faz o véu calar-se
  // exatamente onde já há uma tampa respondendo.
  const rolarPara = async (quanto) => {
    const alvo = await pg.evaluate((q) => {
      const el = document.getElementById('hymnResults');
      el.scrollTop = q === 'fim' ? el.scrollHeight : q;
      return el.scrollTop;
    }, quanto);
    await pg.waitForFunction((t) => Math.abs(document.getElementById('hymnResults').scrollTop - t) <= 1,
      alvo, { timeout: 5000 });
    // O ouvinte de `scroll` é COALESCIDO por quadro (`pedirVeuDaLista`), então
    // o efeito chega no quadro SEGUINTE ao evento. Espera-se pelo fato — a
    // classe que o JS escreve —, e o estouro devolve a frase, não um veredito.
    return alvo;
  };
  const esperarVeu = (acima, abaixo, msg) => esperar(pg, ({ a, b }) => {
    const el = document.getElementById('hymnResults');
    return el.classList.contains('tem-acima') === a && el.classList.contains('tem-abaixo') === b;
  }, msg, { a: acima, b: abaixo }, 5000);

  // ---- C4 · NOS EXTREMOS ELE NÃO EXISTE --------------------------------
  await rolarPara(0);
  await esperarVeu(false, true, 'C4a · no TOPO o JS diz que não há nada acima');
  let veu = await pg.evaluate(() => ({
    antes: getComputedStyle(document.getElementById('hymnResults'), '::before').display,
    depois: getComputedStyle(document.getElementById('hymnResults'), '::after').display,
  }));
  checar(veu.antes === 'none' && veu.depois === 'block',
    'C4a · e no RENDERIZADO a tira de cima não é GERADA (`display: none`, não '
    + '`opacity: 0` — com opacidade zero ela continuaria compondo)', veu);

  await rolarPara(400);
  await esperarVeu(true, true, 'C4b · no MEIO da lista há conteúdo dos dois lados');
  veu = await pg.evaluate(() => ({
    antes: getComputedStyle(document.getElementById('hymnResults'), '::before').display,
    depois: getComputedStyle(document.getElementById('hymnResults'), '::after').display,
  }));
  checar(veu.antes === 'block' && veu.depois === 'block',
    'C4b · e as duas tiras aparecem', veu);

  await rolarPara('fim');
  await esperarVeu(true, false, 'C4c · no FIM não há nada abaixo');
  veu = await pg.evaluate(() => ({
    antes: getComputedStyle(document.getElementById('hymnResults'), '::before').display,
    depois: getComputedStyle(document.getElementById('hymnResults'), '::after').display,
  }));
  checar(veu.antes === 'block' && veu.depois === 'none',
    'C4c · e a tira de baixo some — um borrão sobre a última linha seria o app '
    + 'dizendo que há mais quando não há', veu);

  // ---- C3 · ELE NÃO CUSTA LAYOUT ---------------------------------------
  // As margens negativas cancelam a altura da tira E o `gap` da lista. Se
  // sobrar um pixel, a lista inteira anda a cada vez que o véu liga.
  const custo = await pg.evaluate(() => {
    const el = document.getElementById('hymnResults');
    const medir = () => {
      const r = el.getBoundingClientRect();
      const p = el.firstElementChild.getBoundingClientRect();
      return { alto: el.scrollHeight, primeiro: +(p.top - r.top + el.scrollTop).toFixed(2) };
    };
    el.scrollTop = 0;
    el.classList.remove('tem-acima', 'tem-abaixo');
    const sem = medir();
    el.classList.add('tem-acima', 'tem-abaixo');
    const com = medir();
    return { sem, com };
  });
  checar(custo.sem.alto === custo.com.alto && custo.sem.primeiro === custo.com.primeiro,
    'C3 · ligar o véu NÃO custa layout: nem a altura rolável nem o topo do '
    + 'primeiro bloco se mexem', custo);

  // ---- C1 · O DEDO ATRAVESSA -------------------------------------------
  // 22px mortos no topo e na base seriam exatamente onde a tampa grudada vive e
  // onde a última linha repousa. A régua é O ELEMENTO ENCONTRADO: ler
  // `pointer-events` de volta prova só que a folha declara o que declara.
  await rolarPara(600);
  await esperarVeu(true, true, 'C1 · a lista está rolada, com véu dos dois lados');
  const toque = await pg.evaluate(() => {
    const el = document.getElementById('hymnResults');
    const r = el.getBoundingClientRect();
    const h = parseFloat(getComputedStyle(el, '::before').height);
    const x = r.left + r.width / 2;
    const naLinha = (y) => {
      const alvo = document.elementFromPoint(x, y);
      if (!alvo || alvo === el) return { y, quem: alvo ? alvo.className : 'nada', ok: false };
      // O nó tem de pertencer a um BLOCO da lista — um ancestral (ou ele mesmo)
      // que seja filho DIRETO de `#hymnResults`.
      let n = alvo;
      while (n && n.parentElement !== el) n = n.parentElement;
      return { y: +y.toFixed(1), quem: alvo.className, ok: !!n };
    };
    const pontos = [];
    for (const d of [1, h / 2, h - 1]) pontos.push(naLinha(r.top + d));
    for (const d of [1, h / 2, h - 1]) pontos.push(naLinha(r.bottom - d));
    return { h, pontos };
  });
  checar(toque.pontos.length === 6 && toque.pontos.every((p) => p.ok),
    'C1 · o dedo ATRAVESSA as duas tiras: em três alturas de cada uma, o '
    + 'hit-test devolve um nó de dentro de uma LINHA da lista, nunca o próprio '
    + '`#hymnResults`', toque);

  // ---- C2 · A TAMPA GRUDADA FICA INTACTA -------------------------------
  // É a asserção que separa este desenho do óbvio (`mask-image` no scroller): a
  // máscara não quebra o `sticky` e não cria bloco contêiner, mas APAGA a tampa
  // junto — e a tampa é justamente o objeto que já responde à pergunta do
  // pedido. A prova é a captura do `.coll-bar` colado no topo.
  //
  // O RECORTE PULA OS CANTOS ARREDONDADOS, e isso é medição: a tampa tem
  // `border-radius` no topo, então os ~10px de cada canto são TRANSPARENTES e o
  // borrão de trás aparece por eles. MEDIDO, é o que sobra da diferença: 60
  // pixels de 18.360, delta máximo de 7 níveis, decaindo linha a linha com a
  // curva (20, 12, 8, 6, 4, 4, 2, 2, 2). Isso não é o véu cobrindo a tampa — é
  // a curva dela deixando passar o que está atrás, como qualquer canto
  // arredondado deixa. Medir o CORPO OPACO é a pergunta certa, e o recuo sai do
  // raio RENDERIZADO, nunca de um número escrito aqui.
  const tampa = await pg.evaluate(() => {
    const el = document.getElementById('hymnResults');
    const r = el.getBoundingClientRect();
    const bar = [...el.querySelectorAll('.coll-bar, .coll-group-bar')]
      .find((b) => Math.abs(b.getBoundingClientRect().top - r.top) <= 1);
    if (!bar) return null;
    const b = bar.getBoundingClientRect();
    const raio = Math.ceil(parseFloat(getComputedStyle(bar).borderTopLeftRadius) || 0) + 1;
    return { clip: { x: Math.round(b.left) + raio, y: Math.round(b.top),
      width: Math.round(b.width) - 2 * raio, height: Math.round(b.height) },
      quem: bar.className, z: getComputedStyle(bar).zIndex, raio };
  });
  checar(!!tampa && Number(tampa.z) > 2,
    'C2 · há uma tampa GRUDADA no topo da lista, e ela pinta ACIMA do véu '
    + '(z-index maior que os 2 da tira)', tampa);
  if (tampa) {
    const foto = async () => {
      await pg.evaluate(() => new Promise((f) => requestAnimationFrame(() => requestAnimationFrame(f))));
      return pg.screenshot({ clip: tampa.clip });
    };
    const comVeu = await foto();
    await pg.addStyleTag({ content: '.popup-backdrop--lib.open #hymnResults::before,'
      + '.popup-backdrop--lib.open #hymnResults::after{display:none!important}' });
    const semVeu = await foto();
    await pg.evaluate(() => document.head.lastElementChild.remove());
    // A REVERSÃO: `mask-image` no próprio scroller, que é o caminho de UMA
    // declaração que este desenho recusou.
    await pg.addStyleTag({ content: '.popup-backdrop--lib.open #hymnResults{'
      + '-webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 22px)!important;'
      + 'mask-image:linear-gradient(to bottom,transparent 0,#000 22px)!important}' });
    const comMascara = await foto();
    await pg.evaluate(() => document.head.lastElementChild.remove());
    checar(Buffer.compare(comVeu, semVeu) === 0,
      'C2a · o CORPO OPACO da tampa grudada sai BYTE A BYTE idêntico com e sem '
      + 'o véu — a tira de cima fica calada onde já há uma tampa respondendo',
      { bytes: comVeu.length + ' × ' + semVeu.length, raio: tampa.raio });
    checar(Buffer.compare(comVeu, comMascara) !== 0,
      'C2b · REVERSÃO: a mesma tampa MUDA sob um `mask-image` no scroller — é '
      + 'esse apagamento que a solução de uma declaração custaria', 
      { bytes: comVeu.length + ' × ' + comMascara.length });
  }

  // ---- C6 · A TIRA DE BAIXO POUSA RENTE À BORDA ------------------------
  // O bloco contêiner de um item flex é o CONTENT box, e o `padding-bottom` do
  // scroller fica FORA dele: com `bottom: 0` a tira pararia ~13px acima da
  // borda. A régua é a GEOMETRIA PINTADA — com `calc()` não resolvido, a string
  // do `bottom` aprova qualquer leitura que se queira fazer dela.
  //
  // O marcador troca só a TINTA da tira (fundo opaco, sem máscara e sem
  // desfoque): nenhuma dessas propriedades move a caixa, e é a caixa que se
  // mede.
  await rolarPara(600);
  await esperarVeu(true, true, 'C6 · a lista está rolada, com a tira de baixo no ar');
  const caixaLista = await pg.evaluate(async () => {
    const s = document.createElement('style'); s.id = '__marca';
    s.textContent = '.popup-backdrop--lib.open #hymnResults::after{background:#ff00ff!important;'
      + '-webkit-backdrop-filter:none!important;backdrop-filter:none!important;'
      + '-webkit-mask-image:none!important;mask-image:none!important}';
    document.head.appendChild(s);
    await new Promise((f) => requestAnimationFrame(() => requestAnimationFrame(f)));
    const el = document.getElementById('hymnResults');
    const r = el.getBoundingClientRect();
    return { topo: r.top, base: r.bottom, meio: r.left + r.width / 2,
      recuo: parseFloat(getComputedStyle(el).paddingBottom),
      altura: parseFloat(getComputedStyle(el, '::after').height) };
  });
  img = lerPng(await pg.screenshot());
  {
    const x = Math.round(caixaLista.meio);
    let topo = -1, base = -1;
    for (let y = Math.floor(caixaLista.topo); y < Math.ceil(caixaLista.base) + 4 && y < img.h; y++) {
      const [r, g, b] = img.em(x, y);
      if (r > 200 && b > 200 && g < 80) { if (topo < 0) topo = y; base = y; }
    }
    const fim = base + 1;   // a borda inferior do último pixel pintado
    checar(base >= 0 && Math.abs(fim - caixaLista.base) <= 1,
      'C6a · a tira de baixo pousa RENTE à borda do scroller: o último pixel '
      + 'pintado dela termina na base da caixa', { fim, base: caixaLista.base, topo });
    checar(base >= 0 && caixaLista.recuo > 1 && fim - (caixaLista.base - caixaLista.recuo) > 1,
      'C6b · e ela cobre o RECUO de baixo da lista (' + caixaLista.recuo + 'px) — '
      + 'com `bottom: 0` ela pararia na borda do CONTENT box, que é onde o '
      + 'padding começa', { fim, conteudo: caixaLista.base - caixaLista.recuo });
    checar(base >= 0 && Math.abs((base - topo + 1) - caixaLista.altura) <= 1,
      'C6c · e a faixa pintada tem a altura declarada da tira ('
      + caixaLista.altura + 'px), sem sobrar nem faltar', { pintado: base - topo + 1 });
  }
  await pg.evaluate(() => document.getElementById('__marca').remove());

  // ---- C5 · ELE SOBREVIVE AO `innerHTML = ''` --------------------------
  // `renderSearchResults` esvazia a lista, e a busca é o estado em que a tira é
  // 100% visível: não há tampa nenhuma numa lista PLANA. Um `<li>` de véu
  // morreria ali — é por isso que ele é pseudo-elemento.
  const busca = await pg.evaluate(async () => {
    const el = document.getElementById('hymnResults');
    const campo = document.getElementById('hymnSearchInput');
    campo.value = 'Faixa';
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((f) => setTimeout(f, 400));   // a busca é debounced
    await new Promise((f) => requestAnimationFrame(() => requestAnimationFrame(f)));
    el.scrollTop = Math.round(el.scrollHeight / 2);
    return { linhas: el.querySelectorAll('.hymn-result').length, alto: el.scrollHeight, alvo: el.scrollTop };
  });
  checar(busca.linhas > 0 && busca.alto > 0,
    'C5 · a busca refez a lista do zero (`innerHTML = \'\'`) e ela rola', busca);
  await esperarVeu(true, true, 'C5 · e o JS reconhece os dois lados na lista NOVA');
  const depoisDaBusca = await pg.evaluate(() => {
    const el = document.getElementById('hymnResults');
    return {
      antes: getComputedStyle(el, '::before').display,
      depois: getComputedStyle(el, '::after').display,
      primeiro: el.firstElementChild ? el.firstElementChild.className : 'nada',
    };
  });
  checar(depoisDaBusca.antes === 'block' && depoisDaBusca.depois === 'block',
    'C5 · e as DUAS tiras continuam de pé depois de a lista ser esvaziada e '
    + 'remontada — um `<li>` teria morrido no `innerHTML`', depoisDaBusca);
  checar(!/lib-fade|veu/.test(depoisDaBusca.primeiro),
    'C5 · e o primeiro filho da lista continua sendo um RESULTADO: o véu não '
    + 'entra na árvore, então ele não desloca o `:first-child` de que a folha '
    + 'depende', depoisDaBusca);

  // ======================================================================
  // D · O QUE A v1.5.17 CORRIGIU NESTA MESMA LISTA
  // ======================================================================
  //
  // Quatro relatos do operador, todos sobre a Biblioteca, todos com o mesmo
  // formato de falha: nada quebra, nada aparece no console, e o que sai é uma
  // tela que PARECE certa a quem não a desenhou. Um teste de comportamento
  // aprova as quatro versões defeituosas.
  //
  // A lista volta ao estado do cenário antes de medir: o caso C5 acima deixou
  // uma BUSCA no campo, e a busca desmonta as coleções.
  await pg.evaluate(async ({ secao }) => {
    const campo = document.getElementById('hymnSearchInput');
    campo.value = '';
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((f) => setTimeout(f, 400));
    grupoAberto = secao; favAberto = true;
    ui('album-77').expanded = true; ui('album-77').shown = 1000;
    ui('hymnal-2022').expanded = true; ui('hymnal-2022').shown = 1000;
    hymnResultsEl.innerHTML = '';
    renderCollectionsList(hymnResultsEl, () => {}, { semTotal: true });
    hymnResultsEl.scrollTop = 0;
    await new Promise((f) => requestAnimationFrame(() => requestAnimationFrame(f)));
  }, { secao: SECAO });

  // ---- D1 · A DIVISÓRIA NO MEIO DO VÃO --------------------------------
  //
  // Relato: *"o alinhamento vertical das linhas de divisão … estão ligeiramente
  // descentralizadas para baixo em relação aos itens e o vão entre eles"*. Com o
  // vão INTEIRO fora da caixa, o traço (que mora em `top: 0` da faixa de baixo,
  // porque `overflow: hidden` recorta qualquer coisa no gap) pousava no limite
  // INFERIOR: MEDIDO, 6,42px de branco acima e 1,37px abaixo.
  //
  // A correção não move o traço, move a CAIXA — metade do `gap` entra como
  // `padding-top` e o `margin-top` negativo devolve o conteúdo ao lugar. A
  // asserção é sobre a GEOMETRIA e não sobre o valor: o traço tem de ficar no
  // meio do vão de CONTEÚDO, seja qual for o `gap`. REVERSÃO: apagando as duas
  // declarações, o desvio vai a metade do gap (2px) e este caso reprova.
  const centro = await pg.evaluate(({ nA }) => {
    const listas = [...document.querySelectorAll('#hymnResults .coll-songs')];
    const alb = listas.find((u) => u.querySelectorAll('.hymn-result').length === nA);
    const lis = [...alb.querySelectorAll('.hymn-result')];
    const cs = (el) => getComputedStyle(el);
    const pares = [];
    for (let i = 1; i < lis.length; i++) {
      const a = lis[i - 1].getBoundingClientRect();
      const b = lis[i].getBoundingClientRect();
      // O CONTEÚDO, e não a caixa: é o padding de cima que mudou.
      const fimDeCima = a.bottom - parseFloat(cs(lis[i - 1]).paddingBottom);
      const iniDeBaixo = b.top + parseFloat(cs(lis[i]).paddingTop);
      const traco = b.top + parseFloat(cs(lis[i], '::before').top);
      pares.push(+(traco - (fimDeCima + iniDeBaixo) / 2).toFixed(2));
    }
    const barra = document.querySelector('#hymnResults .hymnal-card.expanded > .coll-bar')
      || document.querySelector('#hymnResults .coll-bar');
    return {
      desvios: pares,
      gapConteudo: +(lis[1].getBoundingClientRect().top
        + parseFloat(cs(lis[1]).paddingTop)
        - (lis[0].getBoundingClientRect().bottom - parseFloat(cs(lis[0]).paddingBottom))).toFixed(2),
      caixa: +lis[0].getBoundingClientRect().height.toFixed(2),
      barra: barra ? +barra.getBoundingClientRect().height.toFixed(2) : null,
    };
  }, { nA: FAIXAS_ALBUM });
  checar(centro.desvios.length === FAIXAS_ALBUM - 1
    && centro.desvios.every((d) => Math.abs(d) <= 0.6),
    'D1 · a divisória fica no MEIO do vão de conteúdo entre duas faixas (±0,6px '
    + 'em todos os pares) — com o vão inteiro fora da caixa ela pousava no '
    + 'limite de baixo, que foi o relato', centro);
  checar(centro.gapConteudo > 1,
    'D1b · e o vão de CONTEÚDO continua existindo: a correção reparte o espaço, '
    + 'não o consome', centro);
  checar(centro.barra !== null && centro.caixa < centro.barra,
    'D1c · a faixa cresceu 2px e CONTINUA mais baixa que a barra do álbum que a '
    + 'contém — o mesmo par que o `smoke.mjs` cobra', centro);

  // ---- D2 · O RECUO DE CIMA DA PLACA NÃO ESCAPA -----------------------
  //
  // Relato: *"os cards que ficam no topo das listas … sem margem no topo"*. O
  // `.coll-open` não tem `padding-top` nem borda, então a `margin-top` do
  // primeiro filho COLAPSAVA para fora dele — invisível enquanto a placa era
  // transparente, e visível desde a v1.5.15, que lhe deu fundo e raio. MEDIDO:
  // o primeiro filho começava a 0,00px do topo da placa. REVERSÃO: tirando o
  // `display: flow-root` o inset volta a zero e este caso reprova.
  //
  // A régua é a placa IRMÃ (`.fav-itens`), e não um número escrito aqui: as
  // duas fazem o mesmo trabalho um nível abaixo de blocos diferentes, e uma
  // mudança de escala tem de mover as duas juntas.
  const inset = await pg.evaluate(() => {
    // O CONTEÚDO do primeiro filho, e não a caixa dele: desde a v1.5.17 (e nos
    // favoritos desde a v1.5.18) metade do vão entre irmãs mora DENTRO da
    // caixa, então a borda dela sangra meio vão para cima da placa — de
    // propósito, e sem pintar nada enquanto a linha não tem estado. O inset que
    // o relato do operador nomeia é o do que se VÊ.
    const um = (placa) => {
      if (!placa) return null;
      const f = [...placa.children].find((n) => n.nodeType === 1);
      if (!f) return null;
      return +(f.getBoundingClientRect().top + parseFloat(getComputedStyle(f).paddingTop)
        - placa.getBoundingClientRect().top).toFixed(2);
    };
    const placas = [...document.querySelectorAll('#hymnResults .coll-open')];
    return {
      abertas: placas.map(um).filter((v) => v !== null),
      fav: um(document.querySelector('#hymnResults .coll-group--fav.aberto .fav-itens')),
    };
  });
  checar(inset.abertas.length >= 2 && inset.abertas.every((v) => v > 2),
    'D2 · o primeiro filho de uma placa aberta começa DENTRO dela — o colapso '
    + 'de margem levava o recuo para fora e o primeiro card cobria os cantos '
    + 'arredondados da placa', inset);
  checar(inset.fav !== null && inset.abertas.every((v) => Math.abs(v - inset.fav) <= 1),
    'D2b · e o inset é o MESMO da placa irmã dos Favoritos (±1px): a régua é o '
    + 'desenho que já existe, não um número escrito no oráculo', inset);

  // ---- D3 · UM ITEM ABERTO É UMA SUPERFÍCIE SÓ ------------------------
  //
  // Relato: *"a zona do título e thumbnail está ficando diferente da cor do
  // corpo desse item ao abrir as opções"*. O overlay da v5.271
  // (`.lib-item.expanded { background-image: … --surface-sunk }`) supunha a
  // faixa fechada JÁ recuada; a v1.5.14 tirou o preenchimento do nível 3 e ele
  // virou o único tom da faixa aberta — um 4º tom que a alternância não tem.
  //
  // A asserção é sobre a COR RENDERIZADA da `.row` contra o papel em que a
  // gaveta pousa os blocos dela, e a metade que a torna honesta é a SEGUNDA: a
  // gaveta continua sendo um POÇO, isto é, o item aberto não virou uma mancha
  // só. REVERSÃO: devolvendo o overlay, a primeira reprova.
  const aberta = await pg.evaluate(async ({ nA }) => {
    const listas = [...document.querySelectorAll('#hymnResults .coll-songs')];
    const alb = listas.find((u) => u.querySelectorAll('.hymn-result').length === nA);
    const li = alb.querySelector('.hymn-result');
    li.querySelector('.row').click();
    await new Promise((f) => setTimeout(f, 600));
    const row = li.querySelector('.row');
    const gav = li.querySelector('.hymn-gaveta');
    const cor = (el) => getComputedStyle(el).backgroundColor;
    return {
      overlay: getComputedStyle(li).backgroundImage,
      row: cor(row),
      item: cor(li),
      gaveta: gav ? cor(gav) : null,
      botao: (() => {
        const b = gav && gav.querySelector('.song-menu-btn:not(.song-menu-go):not(.song-menu-sel)')
          || (gav && gav.querySelector('.hymn-opcoes .song-menu-btn:not(.song-menu-go)'));
        return b ? cor(b) : null;
      })(),
      // O papel em que a gaveta pousa os blocos dela.
      papel: getComputedStyle(document.documentElement).getPropertyValue('--gaveta-btn').trim(),
      alturaBotao: (() => {
        const b = gav && gav.querySelector('.song-menu-btn:not(.song-menu-go)');
        return b ? +b.getBoundingClientRect().height.toFixed(2) : null;
      })(),
      // A RÉGUA É UMA IRMÃ FECHADA, nunca o `<li>` aberto: aberto ele mede a
      // gaveta inteira (325px), e a asserção passaria a comparar a linha com a
      // caixa que a contém.
      alturaFaixa: (() => {
        const irma = [...alb.querySelectorAll('.hymn-result')]
          .find((n) => n !== li && !n.classList.contains('expanded'));
        return irma ? +irma.getBoundingClientRect().height.toFixed(2) : null;
      })(),
    };
  }, { nA: FAIXAS_ALBUM });
  checar(aberta.overlay === 'none',
    'D3 · a faixa ABERTA não pinta overlay nenhum: ela volta ao papel em que a '
    + 'gaveta pousa os blocos dela, que é o que a lista de BUSCA já fazia',
    aberta);
  // A RÉGUA MUDOU NA v1.5.18, e o motivo é o relato do operador: a TAMPA passou
  // a vestir o poço (*"o card titular do item não ganhou a cor … do corpo da
  // caixa de opções"*), então comparar a tampa com o poço deixou de dizer
  // alguma coisa — os dois são a mesma superfície de propósito. O que continua
  // tendo de ser verdade é que a gaveta é um POÇO com BLOCOS dentro: se ela
  // virasse uma mancha só, não haveria onde pousar os botões.
  checar(!!aberta.gaveta && !!aberta.botao && aberta.gaveta !== aberta.botao,
    'D3b · e a gaveta CONTINUA sendo um poço COM BLOCOS: os botões dela pousam '
    + 'num papel que não é o do poço — sem esta metade, pintar tudo de uma cor '
    + 'só passaria na de cima', aberta);

  // ---- D4 · A DENSIDADE DA GAVETA É A DA LISTA ------------------------
  //
  // Relato: *"essa seção de opções manteve a altura dos elementos muito grande,
  // pois ainda fazia referência a padrões antigos"*. MEDIDO: a linha de destino
  // media 53,19px contra os 42,78px de uma faixa da lista logo acima (1,243).
  // A régua é a FAIXA VIZINHA e não um número: as duas têm de andar juntas.
  checar(aberta.alturaBotao !== null
    && Math.abs(aberta.alturaBotao - aberta.alturaFaixa) <= 6,
    'D4 · uma linha de destino da gaveta tem a altura de uma faixa da lista em '
    + 'que ela vive (±6px) — era 1,24× mais alta, com literais anteriores às '
    + 'escalas da v1.5.14', aberta);
  checar(aberta.alturaBotao >= 34,
    'D4b · e ela não desce abaixo do piso de toque `--hit`: o que encolheu foi '
    + 'o RECUO, nunca o alvo', aberta);

  // ---- D5 · O BLOCO DE RAIZ CRESCE PARA PREENCHER A TELA --------------
  //
  // Relato: *"o aproveitamento da altura não está correto, está sobrando. É
  // claro que pode haver telas menores, por isso o tamanho deve ser ajustável
  // para se encaixar a altura da tela"*.
  //
  // ESTE CASO PRECISA DE DUAS TELAS, e é essa a razão de ele abrir contextos
  // próprios em vez de reusar o de cima: numa tela só, "preenche" e "tem uma
  // altura fixa maior" são indistinguíveis, e o oráculo aprovaria o segundo —
  // que destruiria justamente o aparelho pequeno, onde não há sobra a repartir.
  // A técnica das telas é a do `barra-em-qualquer-tela.test.mjs`, com o entalhe
  // fingido pelo token `--sa-topo` (um valor que só o aparelho conhece é um
  // valor que nenhum oráculo alcança).
  const TELAS_D5 = [
    { nome: '430×900 sem entalhe (sobra a repartir)', vp: { width: 430, height: 900 }, cabe: true },
    { nome: '360×740 com 24px de entalhe (transborda)', vp: { width: 360, height: 740 }, sa: '24px', cabe: false },
  ];
  for (const tela of TELAS_D5) {
    const c2 = await navegador.newContext({ viewport: tela.vp, hasTouch: true });
    await semRedeExterna(c2);
    await c2.addInitScript(() => {
      try { localStorage.setItem('av.appMode', 'full'); } catch (_) { /* storage bloqueado */ }
    });
    const p2 = await c2.newPage();
    await p2.goto(`http://localhost:${porta}/controle/`, { waitUntil: 'domcontentloaded' });
    await p2.waitForFunction(
      () => window.AVDB && typeof window.__avBack === 'function'
        && !!document.querySelector('#playlist li'), null, { timeout: 30000 },
    );
    const m = await p2.evaluate(async (tela) => {
      if (tela.sa) document.documentElement.style.setProperty('--sa-topo', tela.sa);
      setAppMode('full');
      // NOVE blocos: o acervo real do operador depois da dissolução da v1.5.16.
      const nomes = ['Coletânea A', 'Coletânea B', 'Coletânea C', 'Coletânea D',
        'Coletânea E', 'Coletânea F'];
      albumCatalog.categories = nomes.map((n, i) => ({
        name: n, albums: [{ id_album: 800 + i, name: 'Álbum ' + n }],
      }));
      albumCatalog.albums = albumCatalog.categories.map((c) => c.albums[0]);
      openHymnSearch(false);
      await new Promise((f) => setTimeout(f, 400));
      const el = document.getElementById('hymnResults');
      const cs = getComputedStyle(el);
      const blocos = [...el.children].filter((n) => n.nodeType === 1);
      const ultimo = blocos[blocos.length - 1].getBoundingClientRect();
      const cx = el.getBoundingClientRect();
      const barra = blocos[1].querySelector('.coll-group-bar, .coll-bar');
      const bb = barra && barra.getBoundingClientRect();
      const cb = blocos[1].getBoundingClientRect();
      return {
        blocos: blocos.length,
        alturas: blocos.map((b) => +b.getBoundingClientRect().height.toFixed(2)),
        sobra: +(cx.bottom - parseFloat(cs.paddingBottom || 0) - ultimo.bottom).toFixed(2),
        rola: el.scrollHeight - el.clientHeight > 1,
        alturaBarra: bb ? +bb.height.toFixed(2) : null,
        // O rótulo continua no meio do bloco esticado?
        desvioRotulo: bb ? +(((bb.top + bb.bottom) / 2) - ((cb.top + cb.bottom) / 2)).toFixed(2) : null,
      };
    }, tela);
    await c2.close();

    if (tela.cabe) {
      checar(!m.rola && Math.abs(m.sobra) <= 1.5,
        'D5 · ' + tela.nome + ': os blocos colapsados PREENCHEM a caixa — a base '
        + 'do último fica a ≤1,5px da base útil. REVERSÃO: sem `flex-grow` são '
        + '85,6px de faixa vazia, que foi o relato', m);
      checar(m.alturas.every((h) => h > 46),
        'D5b · e todos cresceram: nenhum ficou na altura NUA da barra', m);
      checar(m.desvioRotulo !== null && Math.abs(m.desvioRotulo) <= 1,
        'D5c · o rótulo fica no MEIO do bloco esticado (±1px) — sem '
        + '`justify-content: center` ele encosta no topo', m);
      checar(m.alturaBarra !== null && m.alturaBarra < 46,
        'D5d · e a BARRA não cresceu junto: é ela que `medirVaoDosFavoritos` '
        + 'soma, e uma barra que cresce realimenta a conta até o vão deixar de '
        + 'ser dos Favoritos (o `smoke.mjs` reprova essa variante)', m);
    } else {
      checar(m.rola && m.alturas.every((h) => h < 46),
        'D5e · ' + tela.nome + ': o crescimento é INERTE quando a lista '
        + 'transborda — toda altura volta à barra nua. Sem esta metade, uma '
        + 'altura fixa maior passaria no caso de cima e estragaria o aparelho '
        + 'pequeno', m);
    }
  }

  // ---- D6 · O BLOCO CRESCIDO NÃO TEM MARGEM MORTA ---------------------
  //
  // O bloco cresce e a barra não, então em volta dela sobra uma faixa de ~4,8px
  // de cada lado. Ela falhava de DOIS jeitos diferentes, e é isso que exige as
  // duas metades abaixo: numa SEÇÃO o ouvinte morava na barra e o toque ali não
  // fazia NADA; num `.hymnal-card` o ouvinte já é do `li`, então o toque ABRIA e
  // nada respondia — quem estava na lista do `--press` era a barra.
  //
  // A régua é a doutrina da própria folha (v5.288): *"o recuo é da barra … é o
  // que faz a faixa em volta dela ser ALVO em vez de margem morta"*.
  //
  // REVERSÃO: devolvendo o ouvinte da seção à barra, D6a reprova; tirando as
  // regras de `--press` do bloco, D6b reprova.
  // O cenário deste arquivo tem uma seção e dois cards ABERTOS (é o que os
  // casos A e B precisam). A faixa em volta da barra só existe num bloco
  // COLAPSADO — que é o estado em que a Biblioteca abre —, então este caso
  // fecha tudo antes de medir. Fechar é o estado NORMAL, não uma conveniência:
  // `resetarBiblioteca` o restaura a cada abertura (v1.1.4).
  await pg.evaluate(async () => {
    grupoAberto = ''; favAberto = false;
    ui('album-77').expanded = false;
    ui('hymnal-2022').expanded = false;
    hymnResultsEl.innerHTML = '';
    renderCollectionsList(hymnResultsEl, () => {}, { semTotal: true });
    await new Promise((f) => requestAnimationFrame(() => requestAnimationFrame(f)));
  });
  const morta = await pg.evaluate(async () => {
    const el = document.getElementById('hymnResults');
    const blocos = [...el.children].filter((n) => n.nodeType === 1);
    const sec = blocos.find((b) => b.classList.contains('coll-group--drop')
      && !b.classList.contains('coll-group--fav') && !b.classList.contains('aberto'));
    const card = blocos.find((b) => b.classList.contains('hymnal-card')
      && !b.classList.contains('expanded'));
    const noTopo = (bloco) => {
      const r = bloco.getBoundingClientRect();
      return document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + 1));
    };
    const out = { temSecao: !!sec, temCard: !!card };
    if (!sec) return out;
    const alvo = noTopo(sec);
    out.foraDaBarra = !(alvo && alvo.closest('.coll-group-bar'));
    out.alvoClasse = alvo ? (alvo.className || alvo.tagName) : 'nada';
    out.alvoEhOli = alvo === sec;
    out.alturaBloco = +sec.getBoundingClientRect().height.toFixed(2);
    out.nome = (sec.querySelector('.coll-group-name') || {}).textContent || '';
    // A RÉGUA É O ESTADO, e não a classe no DOM: este cenário monta a lista com
    // um `redesenhar` de mentira (`() => {}`), então o toque muda `grupoAberto`
    // e o nó não é refeito. O que se afirma aqui é que o toque CHEGA ao
    // alternador — que é a propriedade —, não que o acordeão animou.
    const antes = grupoAberto;
    alvo.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((f) => setTimeout(f, 300));
    out.antes = antes;
    out.depois = grupoAberto;
    out.alternou = grupoAberto !== antes;
    grupoAberto = antes;
    return out;
  });
  checar(morta.temSecao && morta.foraDaBarra && morta.alternou,
    'D6a · o toque na faixa que sobra em volta da barra de uma SEÇÃO alterna o '
    + 'bloco — ela cresceu e o alvo cresceu com ela, em vez de virar margem '
    + 'morta (9,5px por seção, o oposto do que o recuo da barra existe para '
    + 'produzir)', morta);

  // A METADE DO CARD: aqui o toque sempre chegou; o que faltava era RESPOSTA.
  const cardBox = await pg.locator('#hymnResults > .hymnal-card').first().boundingBox();
  await pg.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
  await pg.mouse.down();
  const resp = await pg.evaluate(() => {
    const b = document.querySelector('#hymnResults > .hymnal-card');
    const barra = b.querySelector('.coll-bar');
    return {
      bloco: getComputedStyle(b).transform, blocoLuz: getComputedStyle(b).filter,
      barra: getComputedStyle(barra).transform, barraLuz: getComputedStyle(barra).filter,
    };
  });
  await pg.mouse.up();
  checar(resp.bloco !== 'none' && resp.blocoLuz !== 'none',
    'D6b · e o `--press` é do BLOCO crescido: a pastilha inteira afunda e '
    + 'acende, em vez de uma menor e descentrada dentro dela', resp);
  checar(resp.barra === 'none' && resp.barraLuz === 'none',
    'D6c · com a BARRA calada dentro dele — uma resposta por dedo, que é a '
    + 'regra escrita na lista do `--press`', resp);

  // ======================================================================
  // E · OS TRÊS RELATOS DA v1.5.18
  // ======================================================================
  //
  // Os três chegaram DEPOIS de o crescimento estar no aparelho, e é isso que os
  // torna diferentes dos anteriores: nenhum deles é o recurso não funcionando —
  // são o resto que o recurso passou a deixar à mostra.

  // ---- E1 · O RECUO DE BAIXO É O MESMO VÃO DAS COLEÇÕES ---------------
  //
  // Relato: *"há uma margem maior na parte de baixo … o ajuste ainda não ficou
  // correto"*. Com os blocos preenchendo o resto, o único espaço que sobra é o
  // `padding-bottom` do scroller — e ele era `.8rem` MAIS a área segura, que
  // desde a v1.5.4 reserva lugar para uma barra de gestos que não é vizinha da
  // janela. A régua é o `gap` das coleções, e não um número: o último bloco tem
  // de ficar da borda à mesma distância que dois vizinhos ficam um do outro.
  // REVERSÃO: com `.8rem` no lugar, o par deixa de bater e este caso reprova.
  await pg.evaluate(async ({ secao }) => {
    grupoAberto = ''; favAberto = false;
    ui('album-77').expanded = false; ui('hymnal-2022').expanded = false;
    hymnResultsEl.innerHTML = '';
    renderCollectionsList(hymnResultsEl, () => {}, { semTotal: true });
    hymnResultsEl.scrollTop = 0;
    await new Promise((f) => requestAnimationFrame(() => requestAnimationFrame(f)));
  }, { secao: SECAO });
  const base = await pg.evaluate(() => {
    const el = document.getElementById('hymnResults');
    const cs = getComputedStyle(el);
    return {
      padBase: Math.round(parseFloat(cs.paddingBottom) * 100) / 100,
      gap: Math.round(parseFloat(cs.rowGap) * 100) / 100,
    };
  });
  checar(Math.abs(base.padBase - base.gap) <= 0.5,
    'E1 · o recuo de baixo da lista vale o MESMO vão que separa dois blocos de '
    + 'raiz — com o crescimento preenchendo o resto, qualquer outro número faz o '
    + 'último bloco ficar a uma distância da borda que nenhum par de vizinhos '
    + 'tem, que foi o relato', base);

  // ---- E2 · A DIVISÓRIA TAMBÉM NOS FAVORITOS --------------------------
  //
  // Relato: *"nessa lista de favoritos também não há a linha divisória que
  // temos nas outras listas na biblioteca"*. A v1.5.16 desenhou o traço para a
  // faixa de um ÁLBUM, e os favoritos são outra `<ul>` — com outra miniatura
  // (`--thumb`, 40px, contra os 38 da `.hymn-play-thumb`) e outro `gap`
  // (`--sp-3` contra `--sp-2`). Copiar os números do álbum descentraria o traço
  // e o poria fora da coluna do nome; por isso os dois entram por TOKEN.
  const favTraco = await pg.evaluate(async () => {
    favAberto = true; grupoAberto = '';
    hymnResultsEl.innerHTML = '';
    renderCollectionsList(hymnResultsEl, () => {}, { semTotal: true });
    await new Promise((f) => requestAnimationFrame(() => requestAnimationFrame(f)));
    const itens = [...document.querySelectorAll(
      '#hymnResults > .coll-group--fav.aberto .fav-itens > .lib-item')];
    if (itens.length < 2) return { itens: itens.length };
    const cs = getComputedStyle(itens[1], '::before');
    const a = itens[0].getBoundingClientRect();
    const b = itens[1].getBoundingClientRect();
    const fimDeCima = a.bottom - parseFloat(getComputedStyle(itens[0]).paddingBottom);
    const iniDeBaixo = b.top + parseFloat(getComputedStyle(itens[1]).paddingTop);
    const m = (cs.backgroundColor.match(/[\d.]+/g) || []).map(Number);
    return {
      itens: itens.length,
      pintado: cs.content !== 'none' && parseFloat(cs.height) > 0 && (m.length < 4 || m[3] > 0),
      primeira: getComputedStyle(itens[0], '::before').content !== 'none',
      // A coluna do NOME, pelos dois lados do mesmo desenho.
      traco: Math.round((b.left + parseFloat(cs.left)) * 100) / 100,
      nome: Math.round(itens[1].querySelector('.row-name').getBoundingClientRect().left * 100) / 100,
      desvio: Math.round(((b.top + parseFloat(cs.top)) - (fimDeCima + iniDeBaixo) / 2) * 100) / 100,
    };
  });
  checar(favTraco.itens >= 2 && favTraco.pintado,
    'E2 · a linha de um FAVORITO tem divisória, como a faixa de um álbum — a '
    + 'v1.5.16 desenhou o traço para uma `<ul>` só', favTraco);
  checar(!favTraco.primeira,
    'E2a · e nada acima da PRIMEIRA: o `+` vale aqui pelo mesmo motivo', favTraco);
  checar(Math.abs(favTraco.traco - favTraco.nome) <= 1,
    'E2b · e ele começa na COLUNA DO NOME desta lista (±1px), que não é a do '
    + 'álbum: a miniatura aqui é `--thumb` (40px) e lá é 38 — o número entra por '
    + 'TOKEN sobrescrito, nunca copiado', favTraco);
  checar(Math.abs(favTraco.desvio) <= 0.6,
    'E2c · e no MEIO do vão desta lista, cujo `gap` também é outro (`--sp-3` '
    + 'contra `--sp-2`)', favTraco);

  // ---- E3 · A TAMPA DO ITEM ABERTO VESTE O POÇO DA GAVETA -------------
  //
  // Relato: *"as opções de play não estão colorindo o card dono daquelas opções
  // … o card titular do item não ganhou a cor de seleção/cor do corpo da caixa
  // de opções"*. A v1.5.17 tirou o tom da tampa (ela media 1,00:1 contra os
  // BOTÕES da gaveta na lista de busca, e o app tinha duas leituras); o operador
  // escolheu a outra — o corpo do item é o POÇO, e tampa e corpo são uma
  // superfície só. REVERSÃO: sem a regra, a tampa volta ao papel e este caso
  // reprova.
  const tampaAberta = await pg.evaluate(async () => {
    const li = document.querySelector(
      '#hymnResults > .coll-group--fav.aberto .fav-itens > .lib-item');
    li.querySelector('.row').click();
    await new Promise((f) => setTimeout(f, 600));
    const aberta = document.querySelector('#hymnResults .fav-itens > .lib-item.expanded');
    if (!aberta) return { abriu: false };
    const gav = aberta.querySelector('.hymn-gaveta');
    return {
      abriu: true,
      tampaAberta: getComputedStyle(aberta.querySelector('.row')).backgroundColor,
      poco: gav ? getComputedStyle(gav).backgroundColor : null,
      // A régua da METADE que impede o conserto largo: uma irmã FECHADA não
      // pode ter ganho tom nenhum.
      fechada: (() => {
        const f = [...document.querySelectorAll(
          '#hymnResults > .coll-group--fav.aberto .fav-itens > .lib-item')]
          .find((n) => !n.classList.contains('expanded'));
        return f ? getComputedStyle(f.querySelector('.row')).backgroundColor : null;
      })(),
    };
  });
  checar(tampaAberta.abriu && !!tampaAberta.poco && tampaAberta.tampaAberta === tampaAberta.poco,
    'E3 · a tampa de um item ABERTO é a MESMA superfície do corpo da gaveta — '
    + 'tampa e poço num bloco só, que é o que o operador pediu ao ver o card '
    + 'titular sem cor', tampaAberta);
  checar(tampaAberta.fechada !== tampaAberta.tampaAberta,
    'E3a · e uma irmã FECHADA continua sem tom: o preenchimento diz "esta é a '
    + 'aberta", e sem esta metade pintar tudo passaria na de cima', tampaAberta);

  // ======================================================================
  // F · A TAMPA DE UM BLOCO DE RAIZ NÃO MUDA DE ALTURA AO ABRIR (v1.5.19)
  // ======================================================================
  //
  // Relato: *"o card do titulo … está encolhendo ou modificando seu tamanho ao
  // abrir sua listagem"*. É o crescimento do D5 visto pelo outro lado: colapsado
  // o bloco casa `:not(.expanded)` e cresce até a altura de encaixe; ao ABRIR
  // ele sai da regra, perde a repartição, e a tampa cai para a barra nua. MEDIDO
  // na captura do operador: 51,00 → 45,01 px CSS, −11,2%, em DOIS quadros —
  // enquanto o corpo desliza por 220 ms, a pílula do título PULA.
  //
  // ELE FALHA CALADO, e no pior formato: nada lança, o card abre, a lista fica
  // certa. O que se vê é a caixa que o dedo acabou de tocar mudando de tamanho
  // debaixo dele, e não há número na tela para conferir.
  //
  // ## A RÉGUA, e por que ela NÃO é o pixel
  //
  // A tampa vai do topo do bloco até o topo da PRIMEIRA SUPERFÍCIE PINTADA DE
  // OUTRO TOM — a placa (`.coll-open`) num card, o primeiro `.hymnal-card`
  // numa seção. Ela NÃO é `getBoundingClientRect()` do `<li>`: aberto, o `<li>`
  // contém o corpo inteiro (MEDIDO, 624px), e medi-lo responde outra pergunta.
  //
  // E não é o PIXEL, ao contrário do resto deste arquivo, porque a
  // `box-shadow: 0 6px 12px -8px` da tampa grudada escurece justamente o vão
  // logo abaixo da barra: uma sonda de tela não separa *"a placa começa aqui"*
  // de *"a sombra da barra chega até aqui"*. Onde a pergunta é GEOMETRIA e a
  // tinta é um degradê, a régua é a caixa.
  //
  // O que mora DENTRO DA BARRA é descartado: os botões dela são mobília da
  // tampa, não a superfície debaixo dela. E a cor é resolvida por CANVAS, nunca
  // por regex — `color-mix` computa como `color(srgb …)` e uma regex de números
  // leria (1, 1, 1).
  //
  // ## Por que DOIS tipos de bloco e DUAS telas
  //
  // O CARD e a SEÇÃO falham diferente: a sombra existe na `.coll-bar` de um card
  // aberto e NÃO na `.coll-group-bar`. É dessa assimetria que sai o RESÍDUO
  // DECLARADO — onde a lista JÁ TRANSBORDA (`--tampa-h` no piso), abrir uma
  // SEÇÃO ainda AUMENTA a tampa em 5,59px. É o número da própria linha de base,
  // não regressão deste lote, e por isso o F1b só afirma a seção onde a lista
  // cabe. Quem cobre a outra tela é o F1c, que é o relato ao pé da letra:
  // a tampa não ENCOLHE.
  //
  // As telas são as do D5, e pela mesma razão: numa tela só, *"a tampa não
  // muda"* e *"a tampa está sempre no piso"* são indistinguíveis.
  const REGUA_TAMPA = () => {
    const cv = document.createElement('canvas');
    cv.width = 1; cv.height = 1;
    const cx2 = cv.getContext('2d', { willReadFrequently: true });
    const tinta = (cor) => {
      cx2.clearRect(0, 0, 1, 1);
      cx2.fillStyle = cor;
      cx2.fillRect(0, 0, 1, 1);
      return [...cx2.getImageData(0, 0, 1, 1).data];
    };
    const outroTom = (a, b) => a[3] > 0 && (Math.abs(a[3] - b[3]) > 2
      || Math.abs(a[0] - b[0]) > 1 || Math.abs(a[1] - b[1]) > 1 || Math.abs(a[2] - b[2]) > 1);
    window.__tampa = (b) => {
      if (!b) return null;
      const cx = b.getBoundingClientRect();
      const meu = tinta(getComputedStyle(b).backgroundColor);
      const barra = b.querySelector(':scope > .coll-group-bar, :scope > .coll-bar');
      for (const n of b.querySelectorAll('*')) {
        if (barra && (n === barra || barra.contains(n))) continue;
        const r = n.getBoundingClientRect();
        if (!r.width && !r.height) continue;
        if (!outroTom(tinta(getComputedStyle(n).backgroundColor), meu)) continue;
        return Math.round((r.top - cx.top) * 100) / 100;
      }
      // FECHADO não há superfície nenhuma lá dentro: o bloco INTEIRO é a tampa,
      // que é exatamente o que o `height: var(--tampa-h)` faz dele.
      return Math.round(cx.height * 100) / 100;
    };
  };

  const TELAS_F = [
    { nome: '430×900 (a lista CABE: há folga a repartir)', vp: { width: 430, height: 900 }, cabe: true },
    { nome: '360×740 com 24px de entalhe (a lista JÁ TRANSBORDA)', vp: { width: 360, height: 740 }, sa: '24px', cabe: false },
  ];
  for (const tela of TELAS_F) {
    const cF = await navegador.newContext({ viewport: tela.vp, hasTouch: true });
    await semRedeExterna(cF);
    await cF.addInitScript(() => {
      try { localStorage.setItem('av.appMode', 'full'); } catch (_) { /* storage bloqueado */ }
    });
    await cF.addInitScript(REGUA_TAMPA);
    const pF = await cF.newPage();
    // Espera pelo FATO; estourando, devolve a FRASE e nunca um veredito sobre a
    // tampa. Estas esperas são de MONTAGEM (o bloco abriu, a rolagem assentou),
    // então só falam quando reprovam.
    const ate = async (fn, oque, ms = 12000) => {
      try { await pF.waitForFunction(fn, null, { timeout: ms }); return true; }
      catch (_) {
        checar(false, 'F · ' + tela.nome + ' — ' + oque,
          'PRAZO, não veredito: a condição não chegou em ' + ms + 'ms');
        return false;
      }
    };
    const quadro = () => pF.evaluate(
      () => new Promise((f) => requestAnimationFrame(() => requestAnimationFrame(f))),
    );
    await pF.goto(`http://localhost:${porta}/controle/`, { waitUntil: 'domcontentloaded' });
    await pF.waitForFunction(
      () => window.AVDB && typeof window.__avBack === 'function'
        && !!document.querySelector('#playlist li'), null, { timeout: 30000 },
    );
    await pF.evaluate(async (tela) => {
      if (tela.sa) document.documentElement.style.setProperty('--sa-topo', tela.sa);
      setAppMode('full');
      // NOVE blocos: o acervo real do operador depois da dissolução da v1.5.16.
      const nomes = ['Coletânea A', 'Coletânea B', 'Coletânea C', 'Coletânea D',
        'Coletânea E', 'Coletânea F'];
      albumCatalog.categories = nomes.map((n, i) => ({
        name: n, albums: [{ id_album: 800 + i, name: 'Álbum ' + n }],
      }));
      albumCatalog.albums = albumCatalog.categories.map((c) => c.albums[0]);
      const faixas = (n, pre) => Array.from({ length: n }, (_, i) => ({
        id_music: pre + (i + 1), track: i + 1, name: 'Faixa ' + (i + 1), duration: '3:00',
      }));
      for (const c of albumCatalog.categories) {
        collState['album-' + c.albums[0].id_album] = { indexSyncedAt: Date.now(), songs: faixas(4, 'a') };
      }
      // OS DOIS HINÁRIOS semeados: o card medido é o PRIMEIRO `.hymnal-card` da
      // raiz, e um card sem índice abriria numa placa vazia — o que se quer
      // medir é a tampa de um bloco com corpo de verdade.
      collState['hymnal-2022'] = { indexSyncedAt: Date.now(), isHymnal: true, songs: faixas(30, 'h') };
      collState['hymnal-1996'] = { indexSyncedAt: Date.now(), isHymnal: true, songs: faixas(30, 'g') };
      // UM favorito só, e o número é MEDIÇÃO: a seção dos Favoritos ABERTA come
      // a folga por conta própria (`min-height: var(--fav-vao)`), e a partir de
      // DOIS itens o conteúdo dela passa desse vão — MEDIDO, 178,72px para um
      // vão de 134. A lista passaria a rolar pelo conteúdo DELA, e o F2 estaria
      // medindo outra coisa.
      await AVDB.addMedia(new Blob(['x'], { type: 'audio/mpeg' }),
        { name: 'Favorito de teste', list: 'favs' });
      await recarregarFavoritos();
      // O ALINHAMENTO de uma seção sai de um `setTimeout(ACC_MS + 30)` e rola com
      // `behavior: smooth`. É isso que PROÍBE medir a rolagem por estabilidade:
      // entre o clique e o disparo o `scrollTop` fica parado, e "duas amostras
      // iguais" aprovaria o quadro ANTERIOR ao movimento. Envolvemos a função do
      // APP para saber que ela já RODOU, e só então esperamos o alvo dela.
      const orig = window.alinharGrupoNoTopo;
      window.__alinhou = false;
      window.alinharGrupoNoTopo = function (...a) { orig.apply(this, a); window.__alinhou = true; };
      openHymnSearch(false);
    }, tela);
    if (!await ate(() => {
      const s = document.querySelector('.popup-sheet--lib');
      const el = document.getElementById('hymnResults');
      if (!s || !el) return false;
      if (s.getAnimations().some((a) => a.playState === 'running')) return false;
      if (s.getBoundingClientRect().bottom > window.innerHeight + 1) return false;
      // O FATO que interessa: a lista está COMPLETA e o `medirTampa` já escreveu.
      return [...el.children].filter((n) => n.nodeType === 1).length === 9
        && !!getComputedStyle(el).getPropertyValue('--tampa-h').trim();
    }, 'a Biblioteca assenta com os nove blocos e a tampa MEDIDA')) {
      await cF.close();
      continue;
    }

    const olhar = () => pF.evaluate(() => {
      const el = document.getElementById('hymnResults');
      const bl = [...el.children].filter((n) => n.nodeType === 1);
      const card = bl.find((b) => b.classList.contains('hymnal-card'));
      const sec = bl.find((b) => b.classList.contains('coll-group--drop')
        && !b.classList.contains('coll-group--fav'));
      const cs = getComputedStyle(el);
      const ult = bl[bl.length - 1].getBoundingClientRect();
      const cx = el.getBoundingClientRect();
      return {
        blocos: bl.length,
        tampaH: Math.round((parseFloat(cs.getPropertyValue('--tampa-h')) || 0) * 100) / 100,
        card: window.__tampa(card), sec: window.__tampa(sec),
        rola: el.scrollHeight - el.clientHeight > 1,
        transbordo: Math.round((el.scrollHeight - el.clientHeight) * 100) / 100,
        sobra: Math.round((cx.bottom - parseFloat(cs.paddingBottom || 0) - ult.bottom) * 100) / 100,
      };
    });
    const tocarBloco = (qual) => pF.evaluate((qual) => {
      const el = document.getElementById('hymnResults');
      const bl = [...el.children].filter((n) => n.nodeType === 1);
      const alvo = qual === 'card'
        ? bl.find((b) => b.classList.contains('hymnal-card'))
        : (qual === 'fav'
          ? bl.find((b) => b.classList.contains('coll-group--fav'))
          : bl.find((b) => b.classList.contains('coll-group--drop')
            && !b.classList.contains('coll-group--fav')));
      window.__alinhou = false;
      // O CAMINHO REAL: o toque na barra do bloco, nunca a classe escrita à mão.
      alvo.querySelector('.coll-group-bar, .coll-bar').click();
    }, qual);

    const fechado = await olhar();

    // ---- F1a · O CARD ---------------------------------------------------
    await tocarBloco('card');
    const abriuCard = await ate(() => {
      const el = document.getElementById('hymnResults');
      const c = [...el.children].find((b) => b.classList && b.classList.contains('hymnal-card'));
      return !!c && c.classList.contains('expanded')
        && !el.getAnimations({ subtree: true }).some((a) => a.playState === 'running');
    }, 'o card abre pelo toque na barra e o acordeão TERMINA');
    const cardAberto = abriuCard ? await olhar() : null;
    const dCard = cardAberto ? Math.round((cardAberto.card - fechado.card) * 100) / 100 : null;

    // ---- F3 · A CLÁUSULA É SÓ A DOS FAVORITOS ---------------------------
    //
    // Descontar TODO bloco aberto da divisão é a variante ÓBVIA — e é ela que
    // devolve o defeito original: um bloco aberto tem o corpo inteiro dentro, a
    // sobra some, e `--tampa-h` desaba para o piso assim que alguém abre um
    // hinário. O que a regra diz é o contrário: um bloco que o operador abriu
    // continua contando como FECHADO, porque é a hipótese "tudo fechado" que dá
    // a altura que a tampa dele tem de MANTER.
    //
    // SÓ NA TELA QUE CABE: no piso as duas contas devolvem o mesmo número, e a
    // asserção não separaria nada.
    //
    // E ELE PEDE UM REDESENHO, que é o do APP: `renderSearchResults` é o que
    // roda a cada 400 ms durante um download, e é ele que reagenda o
    // `medirTampa`. Sem ele a única medida de pé é a do instante do toque,
    // tirada com o acordeão ainda em ZERO: ali o corpo aberto quase não ocupa
    // nada, a variante ERRADA devolveria o mesmo número que a certa POR
    // ACIDENTE, e a reversão não reprovaria. No código certo a medida é
    // independente da animação por construção — `medirTampa` soma BARRAS, e a
    // `.coll-bar` de um card aberto continua medindo o mesmo em qualquer fase.
    // REVERSÃO: descontar todo bloco aberto no `medirTampa` leva `--tampa-h` ao
    // piso (45,19) e a tampa volta a encolher.
    if (tela.cabe && abriuCard) {
      const comCard = await pF.evaluate(async () => {
        // A EXPRESSÃO É A DO APP, verbatim, e não um `renderCollectionsList`
        // com um callback de mentira: o segundo argumento dele vira o
        // `redesenharAcervo`, e um `() => {}` ali deixa o card sem quem o
        // redesenhe — ele não fecha mais, e o oráculo passa a medir a própria
        // montagem.
        renderSearchResults(hymnSearchInputEl.value);
        await new Promise((f) => requestAnimationFrame(() => requestAnimationFrame(f)));
        const el = document.getElementById('hymnResults');
        const bl = [...el.children].filter((n) => n.nodeType === 1);
        // A IRMÃ É UM `.hymnal-card`, e não "o primeiro bloco fechado". MEDIDO
        // instrumentando esta asserção: o primeiro é a seção dos FAVORITOS —
        // a ÚNICA peça da lista com regra de altura própria
        // (`min-height: var(--fav-vao)`) e justamente a que a cláusula do
        // `medirTampa` trata à parte. Hoje ela veste o mesmo `--tampa-h` e o
        // número bate; no dia em que alguém lhe der altura própria colapsada —
        // o tipo de coisa que esta área atrai — a asserção passaria a responder
        // por ela sem dizer nada, e o segundo card, que é a irmã de verdade,
        // ficaria sem oráculo.
        const fechada = bl.find((b) => b.classList.contains('hymnal-card')
          && !b.classList.contains('expanded'));
        return {
          tampaH: Math.round((parseFloat(getComputedStyle(el).getPropertyValue('--tampa-h')) || 0) * 100) / 100,
          irma: window.__tampa(fechada),
        };
      });
      checar(Math.abs(comCard.tampaH - fechado.tampaH) <= 0.05,
        'F3 · com um CARD aberto, `--tampa-h` continua valendo o mesmo que valia '
        + 'com tudo fechado (' + fechado.tampaH + 'px) — a cláusula do '
        + '`medirTampa` é SÓ a dos Favoritos, e um bloco que o operador abriu '
        + 'continua contando como fechado', comCard);
      checar(comCard.irma !== null && Math.abs(comCard.irma - fechado.card) <= 0.5,
        'F3a · e as IRMÃS colapsadas não encolheram — é isto que o operador vê, e '
        + 'sem esta metade a asserção de cima seria sobre um token que ninguém lê',
        { irma: comCard.irma, fechada: fechado.card });
    }

    // ---- F1b/F1c · A SEÇÃO ----------------------------------------------
    if (abriuCard) {
      await tocarBloco('card');
      await ate(() => {
        const el = document.getElementById('hymnResults');
        const c = [...el.children].find((b) => b.classList && b.classList.contains('hymnal-card'));
        return !!c && !c.classList.contains('expanded')
          && !el.getAnimations({ subtree: true }).some((a) => a.playState === 'running');
      }, 'o card fecha de volta antes de a seção ser medida');
    }
    await tocarBloco('secao');
    const abriuSec = await ate(() => {
      const el = document.getElementById('hymnResults');
      const s = [...el.children].find((b) => b.classList
        && b.classList.contains('coll-group--drop') && !b.classList.contains('coll-group--fav'));
      if (!s || !s.classList.contains('aberto') || !window.__alinhou) return false;
      if (el.getAnimations({ subtree: true }).some((a) => a.playState === 'running')) return false;
      // A ROLAGEM ASSENTOU: ou o bloco chegou ao topo da lista (o alvo do
      // `alinharGrupoNoTopo`), ou a lista chegou ao fim do que dá para rolar.
      // Os dois são FATOS do app; o `scrollTop` parado, não.
      const topo = el.getBoundingClientRect().top + parseFloat(getComputedStyle(el).paddingTop || 0);
      const dy = s.getBoundingClientRect().top - topo;
      const max = el.scrollHeight - el.clientHeight;
      return Math.abs(dy) <= 1 || el.scrollTop >= max - 1 || el.scrollTop <= 1;
    }, 'a seção abre pelo toque na barra, o acordeão termina e a ROLAGEM assenta');
    const secAberta = abriuSec ? await olhar() : null;
    const dSec = secAberta ? Math.round((secAberta.sec - fechado.sec) * 100) / 100 : null;

    // A REVERSÃO DAS TRÊS, e ela é o mecanismo inteiro da v1.5.19 desfeito: o
    // `height: var(--tampa-h)` do bloco colapsado de volta a `flex-grow: 1;
    // height: auto` E os dois `padding-top` do estado aberto removidos — as duas
    // metades são a MESMA regra (o número que sai da altura é o que volta como
    // recuo), e desfazer só uma deixa a tampa constante por outro caminho.
    // MEDIDO com ela: Δ −9,86 no card e −4,27 na seção a 430×900, que é o pulo
    // do relato (a captura do operador dá −5,71 CSS num acervo de nove blocos a
    // 411×856; o número muda com a tela, o SINAL não).
    const medida = { tela: tela.nome, fechado, dCard, dSec, tampaH: fechado.tampaH };
    checar(dCard !== null && Math.abs(dCard) <= 0.5,
      'F1a · ' + tela.nome + ': a tampa de um CARD mede o mesmo fechada e aberta '
      + '(Δ ' + dCard + 'px)', medida);
    if (tela.cabe) {
      checar(dSec !== null && Math.abs(dSec) <= 0.5,
        'F1b · ' + tela.nome + ': e a tampa de uma SEÇÃO também (Δ ' + dSec + 'px) '
        + '— os dois tipos falham diferente, porque a `box-shadow` existe na '
        + '`.coll-bar` de um card aberto e NÃO na `.coll-group-bar`', medida);
    }
    checar(dCard !== null && dSec !== null && dCard >= -0.5 && dSec >= -0.5,
      'F1c · ' + tela.nome + ': e em nenhum dos dois a tampa ENCOLHE ao abrir — é '
      + 'o relato ao pé da letra, e é a metade que cobre a tela em que a lista JÁ '
      + 'transborda, onde o RESÍDUO DECLARADO da base ainda faz a SEÇÃO CRESCER '
      + '5,59px (Δ card ' + dCard + ' · Δ seção ' + dSec + ')', medida);

    // ---- F2 · A LISTA COLAPSADA CABE COM OS FAVORITOS ABERTOS -----------
    //
    // É a metade que derrubaria a Release, e o D5 não a alcança: ele mede a
    // lista com os Favoritos FECHADOS. A seção dos Favoritos ABERTA nunca veste
    // `--tampa-h` — ela tem `min-height: var(--fav-vao)` e come a folga por
    // conta própria (v5.273) —, então contá-la na divisão dá a cada irmã uma
    // fatia da folga que ela JÁ gastou.
    //
    // E O F1 NÃO PEGARIA ISTO: ele mede a TAMPA, e o que quebra aqui é a LISTA
    // COLAPSADA. MEDIDO sem a cláusula: 79px de transbordo a 430×900 com nove
    // blocos, e o `smoke.mjs` reprova em *"as fechadas ficam EMPILHADAS NA
    // BASE"* — como o `verificar` é `needs` do `web-ota`, é o bundle não
    // chegando à frota.
    // REVERSÃO: contar a seção dos Favoritos na divisão do `medirTampa`.
    if (tela.cabe) {
      if (abriuSec) {
        await tocarBloco('secao');
        await ate(() => {
          const el = document.getElementById('hymnResults');
          const s = [...el.children].find((b) => b.classList
            && b.classList.contains('coll-group--drop') && !b.classList.contains('coll-group--fav'));
          return !!s && !s.classList.contains('aberto')
            && !el.getAnimations({ subtree: true }).some((a) => a.playState === 'running');
        }, 'a seção fecha de volta antes dos Favoritos');
      }
      await tocarBloco('fav');
      const abriuFav = await ate(() => {
        const el = document.getElementById('hymnResults');
        const f = [...el.children].find((b) => b.classList && b.classList.contains('coll-group--fav'));
        return !!f && f.classList.contains('aberto')
          && !!f.querySelector('.fav-itens > .lib-item')
          && !el.getAnimations({ subtree: true }).some((a) => a.playState === 'running');
      }, 'a seção dos Favoritos abre pelo toque na barra e o acordeão termina');
      await quadro();
      const comFav = abriuFav ? await olhar() : null;
      checar(comFav !== null && !comFav.rola && comFav.transbordo <= 1,
        'F2 · com os Favoritos ABERTOS a lista colapsada CONTINUA CABENDO '
        + '(transbordo ' + (comFav && comFav.transbordo) + 'px) — a seção que come '
        + 'a folga por conta própria sai da divisão do `medirTampa`. É o par do '
        + 'D5, que mede a mesma lista com os Favoritos FECHADOS', comFav);
    }
    await cF.close();
  }

  checar(erros.length === 0, 'nenhum erro de console', erros.slice(0, 5));
} catch (e) {
  checar(false, 'o oráculo rodou até o fim', String(e && e.stack ? e.stack : e));
} finally {
  await navegador.close();
  servidor.close();
}

console.log('');
if (falhas.length) {
  console.log('FALHOU (' + falhas.length + '):');
  falhas.forEach((f) => console.log(' - ' + f));
  process.exit(1);
}
console.log('Todos passaram.');
