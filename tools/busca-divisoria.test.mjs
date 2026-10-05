#!/usr/bin/env node
// ============================================================================
// A DIVISÓRIA ENTRE OS RESULTADOS DA BUSCA DA BIBLIOTECA (v1.11.16)
//
// Pedido do operador, verbatim: *"durante a pesquisa na biblioteca, a listagem de itens de
// resultados não possui uma linha divisória entre os resultados. Adicione essa linha
// divisória para melhorar a interpretação da lista"*.
//
// Com o campo preenchido, as linhas (`<li class="lib-item hymn-result">`, e os vídeos do
// YouTube, que são `hymn-result yt-result`) são FILHAS DIRETAS de `#hymnResults` e pintam a
// cor da própria placa: o vão entre duas lê 1,00:1 contra os dois lados. A divisória é a
// MESMA receita das faixas de um álbum (`--divisoria`, 1px, só entre irmãs, no MEIO do vão),
// agora também nesta lista.
//
// O que este arquivo trava, e cada uma falha CALADA (a lista continua funcionando):
//  A1 · a divisória é uma por PAR de irmãs: nada acima da primeira de cada corrida e nada
//       entre o `.yt-head` / o botão do YouTube e o primeiro vídeo.
//  A2 · ela é o MEIO do vão: a distância da `.row` de cima até o traço é igual à do traço até
//       a `.row` de baixo. Sem a metade do vão dentro da caixa o traço cola no texto de baixo
//       — e é o defeito que a v1.5.17 já corrigiu nas faixas de álbum.
//  A3 · ela SOMA ao vão e não o consome: o espaço entre duas `.row` continua sendo o `gap`
//       da lista, isto é, nada do conteúdo andou para fazer o traço caber.
//  A4 · ela APARECE na tinta (um pseudo-elemento contado no DOM não prova pixel), e a primeira
//       linha não tem nenhuma.
//  A5 · ela começa na COLUNA DO TEXTO da linha — e a do vídeo (miniatura de 16:9) não é a da
//       música (quadrado de 38px).
//  A6 · as duas linhas de uma lista de resultados andam juntas nos dois temas e nos dois modos.
//
//   node tools/busca-divisoria.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import {
  servirEstatico, abrirNavegador, esperar, esperarCortina, porque, checar, falhas,
  lerPng, pixel, comTema, comModoAvancado,
} from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);
await new Promise((r) => servidor.listen(0, r));
const base = `http://localhost:${servidor.address().port}`;
const navegador = await abrirNavegador();
const erros = [];

const dif = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
const HA_TRACO = 12;     // MEDIDO: 44 níveis no escuro e ~70 no claro
const SEM_TRACO = 4;     // MEDIDO: 0 — as duas sondas leem o mesmo pixel

const N_HINARIO = 8;
const N_ALBUM = 3;
const TERMO = 'faixa de teste';

async function passe(rotulo, { tema, avancado }) {
  const ctx = await navegador.newContext({ viewport: { width: 430, height: 1000 }, hasTouch: true });
  try {
    await semRedeExterna(ctx);
    await comTema(ctx, tema);
    if (avancado) await comModoAvancado(ctx);
    const pg = await ctx.newPage();
    pg.on('pageerror', (e) => erros.push(rotulo + ' · pageerror: ' + e.message));
    await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
    await esperarCortina(pg);
    // Modo Fácil sem tela é o modo BLOQUEADO; com a tela de mentira a Biblioteca é a principal.
    if (!avancado) await pg.evaluate(() => { webDisplayWin = { closed: false }; renderSimpleCast(); });
    await pg.evaluate(({ nH, nA }) => {
      const faixas = (n, pre) => Array.from({ length: n }, (_, i) => ({
        id_music: pre + (i + 1), track: i + 1, name: 'Faixa de teste ' + (i + 1),
        duration: '3:00', has_instrumental_music: false,
      }));
      collState['hymnal-2022'] = { indexSyncedAt: Date.now(), isHymnal: true, songs: faixas(nH, 'h') };
      albumCatalog.categories = [{ name: 'Álbuns de teste', albums: [{ id_album: 77, name: 'Álbum de teste' }] }];
      albumCatalog.albums = [{ id_album: 77, name: 'Álbum de teste' }];
      collState['album-77'] = { indexSyncedAt: Date.now(), songs: faixas(nA, 'a') };
    }, { nH: N_HINARIO, nA: N_ALBUM });
    await pg.evaluate(() => openHymnSearch(false));
    const abriu = await esperar(pg, () => document.getElementById('hymnSearchPopup').classList.contains('open'), null, 15000);
    checar(abriu === true, rotulo + ' · PREMISSA: a Biblioteca abre', porque(abriu));
    await pg.evaluate(async () => {
      await Promise.all(document.querySelector('#hymnSearchPopup .popup-sheet').getAnimations().map((a) => a.finished.catch(() => {})));
    });
    await pg.fill('#hymnSearchInput', TERMO);
    const montou = await esperar(pg, (n) => document.querySelectorAll('#hymnResults > .hymn-result').length >= n,
      N_HINARIO + N_ALBUM, 15000);
    checar(montou === true, rotulo + ' · PREMISSA: a busca devolve as ' + (N_HINARIO + N_ALBUM) + ' músicas', porque(montou));
    // DOIS VÍDEOS DO YOUTUBE na mesma lista (o navegador não pesquisa de dentro, então o
    // resultado entra pelo estado que o `buscarNoYoutube` escreveria).
    await pg.evaluate(({ termo }) => {
      ytBuscaTermo = termo;
      ytBuscaItens = [
        { id: 'yt-1', name: 'Vídeo de teste um', thumb: '', author: 'Canal', seconds: 120 },
        { id: 'yt-2', name: 'Vídeo de teste dois', thumb: '', author: 'Canal', seconds: 90 },
      ];
      renderSearchResults(termo);
    }, { termo: TERMO });
    const comVideos = await esperar(pg, () => document.querySelectorAll('#hymnResults > .yt-result').length === 2, null, 10000);
    checar(comVideos === true, rotulo + ' · PREMISSA: dois vídeos do YouTube entram na lista', porque(comVideos));
    await pg.evaluate(() => new Promise((f) => requestAnimationFrame(() => requestAnimationFrame(f))));

    const ler = () => pg.evaluate(() => {
      const ul = document.getElementById('hymnResults');
      const pintado = (el) => {
        const c = getComputedStyle(el, '::before');
        const m = (c.backgroundColor.match(/[\d.]+/g) || []).map(Number);
        return c.content !== 'none' && c.display !== 'none' && parseFloat(c.height) > 0 && (m.length < 4 || m[3] > 0);
      };
      const gap = parseFloat(getComputedStyle(ul).rowGap);
      const lis = [...ul.children].filter((e) => e.classList.contains('hymn-result'));
      return {
        gap,
        modo: document.body.classList.contains('mode-simple') ? 'facil' : 'avancado',
        linhas: lis.map((li) => {
          const r = li.getBoundingClientRect();
          const row = li.querySelector('.row').getBoundingClientRect();
          const prev = li.previousElementSibling;
          const par = !!prev && prev.classList.contains('hymn-result');
          const nome = li.querySelector('.hymn-name, .row-name').getBoundingClientRect().left;
          const b = getComputedStyle(li, '::before');
          return {
            yt: li.classList.contains('yt-result'),
            topo: r.top, base: r.bottom, esq: r.left,
            rowTopo: row.top, rowBase: row.bottom,
            par, pintado: pintado(li),
            prevRowBase: par ? prev.querySelector('.row').getBoundingClientRect().bottom : null,
            prevBase: par ? prev.getBoundingClientRect().bottom : null,
            nome,
            tracoEsq: r.left + (parseFloat(b.left) || 0),
            depois: getComputedStyle(li, '::after').content !== 'none',
          };
        }),
      };
    });

    const d = await ler();
    const musicas = d.linhas.filter((l) => !l.yt);
    const videos = d.linhas.filter((l) => l.yt);
    checar(d.modo === (avancado ? 'avancado' : 'facil'), rotulo + ' · PREMISSA: o modo é o pedido', d.modo);

    // ---- A1 · UMA POR PAR -------------------------------------------------
    const pares = d.linhas.filter((l) => l.par);
    checar(d.linhas.length === N_HINARIO + N_ALBUM + 2, rotulo + ' · PREMISSA: ' + (N_HINARIO + N_ALBUM + 2) + ' linhas de resultado', d.linhas.length);
    checar(d.linhas.every((l) => l.pintado === l.par),
      'A1 · ' + rotulo + ' · a divisória existe EXATAMENTE nas linhas que têm irmã-resultado logo acima '
      + '(`+`): nada acima da primeira música, nada acima do primeiro vídeo — antes dele vem o botão/'
      + 'cabeçalho do YouTube, que não é resultado', JSON.stringify(d.linhas.map((l) => [l.yt ? 'v' : 'm', l.par, l.pintado])));
    checar(pares.length === (musicas.length - 1) + (videos.length - 1),
      'A1 · ' + rotulo + ' · e são duas CORRIDAS (músicas, vídeos), logo N − 2 divisórias', pares.length);
    checar(d.linhas.every((l) => !l.depois),
      'A1 · ' + rotulo + ' · nada abaixo de nenhuma linha: a regra só cria o traço no topo da linha de baixo', null);

    // ---- A2 · O MEIO DO VÃO · A3 · O VÃO NÃO ENCOLHEU ----------------------
    const centradas = pares.map((l) => +((l.rowTopo - l.topo) - (l.topo - l.prevBase)).toFixed(2));
    checar(centradas.every((x) => Math.abs(x) <= 0.6),
      'A2 · ' + rotulo + ' · o traço fica no MEIO do vão: o espaço dele até a `.row` de baixo é igual ao '
      + 'do fim da caixa de cima até ele (±0,6px)', JSON.stringify(centradas));
    const vaos = pares.map((l) => +(l.rowTopo - l.prevRowBase).toFixed(2));
    checar(vaos.every((v) => Math.abs(v - d.gap) <= 0.6),
      'A3 · ' + rotulo + ' · o conteúdo NÃO andou: o espaço entre duas `.row` continua sendo o `gap` '
      + 'da lista (' + d.gap + 'px) — metade do vão entrou na caixa, a lista não cresceu', JSON.stringify({ vaos, gap: d.gap }));

    // ---- A5 · A COLUNA DO TEXTO, DE CADA TIPO -----------------------------
    const recuos = pares.map((l) => +(l.tracoEsq - l.nome).toFixed(2));
    checar(recuos.every((x) => Math.abs(x) <= 1),
      'A5 · ' + rotulo + ' · o traço começa onde o NOME da linha começa (±1px), na música E no vídeo — '
      + 'as duas colunas saem do desenho, nenhuma é um número escrito aqui', JSON.stringify(recuos));
    const colunas = new Set([musicas, videos].map((g) => +(g[1].nome - g[1].esq).toFixed(1)));
    checar(colunas.size === 2,
      'A5 · ' + rotulo + ' · PREMISSA: a coluna do texto do vídeo NÃO é a da música (senão o recuo '
      + 'por tipo não provaria nada)', JSON.stringify([...colunas]));

    // ---- A4 · NA TINTA ----------------------------------------------------
    // A linha é trazida ao meio da lista (longe das tiras de sombra das bordas) e a sonda lê a
    // banda de três linhas em torno do topo da caixa, à esquerda e à direita da coluna do texto.
    const foto = async (idx) => {
      await pg.evaluate((i) => {
        const li = [...document.querySelectorAll('#hymnResults > .hymn-result')][i];
        const ul = document.getElementById('hymnResults');
        const alvo = li.getBoundingClientRect().top - ul.getBoundingClientRect().top - ul.clientHeight / 2;
        ul.scrollTop = Math.round(ul.scrollTop + alvo);
      }, idx);
      await pg.evaluate(() => new Promise((f) => requestAnimationFrame(() => requestAnimationFrame(f))));
      const l = (await ler()).linhas[idx];
      return { l, img: lerPng(await pg.screenshot()) };
    };
    const forca = (img, y, l) => {
      const fora = Math.round(l.esq + (l.nome - l.esq) / 2);
      const dentro = Math.round(l.nome) + 20;
      let m = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const a = pixel(img, fora, y + dy), c = pixel(img, dentro, y + dy);
        if (a && c) m = Math.max(m, dif(a, c));
      }
      return m;
    };
    const iMusica = 4;                                   // uma música do meio da corrida
    const iVideo = d.linhas.findIndex((l) => l.yt && l.par);
    const fm = await foto(iMusica);
    const fv = await foto(iVideo);
    const forcaM = forca(fm.img, Math.round(fm.l.topo), fm.l);
    const forcaV = forca(fv.img, Math.round(fv.l.topo), fv.l);
    checar(forcaM >= HA_TRACO && forcaV >= HA_TRACO,
      'A4 · ' + rotulo + ' · o traço APARECE na tinta, entre duas músicas e entre dois vídeos '
      + '(contraste da banda, esquerda × direita da coluna do texto)', JSON.stringify({ forcaM, forcaV }));
    // A PRIMEIRA música: nada acima. Ela é trazida à vista com o topo da lista.
    await pg.evaluate(() => { document.getElementById('hymnResults').scrollTop = 0; });
    await pg.evaluate(() => new Promise((f) => requestAnimationFrame(() => requestAnimationFrame(f))));
    const l0 = (await ler()).linhas[0];
    const img0 = lerPng(await pg.screenshot());
    // O topo da caixa da primeira cai 1 meio-vão ACIMA do scroller (recortado); o que se lê é a
    // banda onde um traço estaria, logo acima da `.row`.
    const y0 = Math.round(l0.rowTopo - (l0.rowTopo - l0.topo));
    const forca0 = forca(img0, Math.max(y0, 0), l0);
    checar(forca0 <= SEM_TRACO,
      'A4 · ' + rotulo + ' · e a PRIMEIRA música não tem nada acima dela, na tinta', forca0);
    return d;
  } finally {
    await ctx.close();
  }
}

try {
  await passe('Fácil · escuro', { tema: 'escuro', avancado: false });
  await passe('Fácil · claro', { tema: 'claro', avancado: false });
  await passe('Avançado · escuro', { tema: 'escuro', avancado: true });
  checar(erros.length === 0, 'nenhum erro de página', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

falhas.length ? (console.log('\n' + falhas.length + ' falha(s).'), process.exit(1))
  : console.log('\nTodos passaram.');
