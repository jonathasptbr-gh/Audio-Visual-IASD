#!/usr/bin/env node
// ============================================================================
// A BIBLIOTECA DO MODO FÁCIL É MAIOR, E A ESCOLHA NÃO TEM LINHA (v1.13.9)
//
// Pedido do operador, verbatim: *"Você precisa revisar o tamanho de fontes, e icones da
// visualização da biblioteca no modo simples. Pois agora com mais espaço vertical na biblioteca,
// o sistema tem de aumentar os itens para aproveitar completamente esse vão … fique a vontade
// para aumentar o tamanho dos cards da listagem das coletâneas, álbuns e afins no geral no modo
// simples (mesmo que saia do padrão do resto do app), para aproveitar de verdade e de forma
// responsiva as novas dimensões disponíveis. Os elementos estão muito pequenos, em especial
// também os itens dentro dos álbuns, alguns chegam a estar tão pequenos que fica estranho de
// tocar neles."* — e *"ao tocar em um item de um álbum para tocar, ele colore o card para um feed
// back tatil. Mas parece que fica uma fina linha sem essa cor, logo abaixo da thumbnail/botão de
// play"*.
//
// O mecanismo: no Modo Fácil os tokens de medida da lista (`--hit`, `--thumb`, `--faixa-thumb`,
// `--icon-*`, `--fs-*`) são redeclarados em `#hymnResults`, multiplicados por `--lib-esc` (da
// ALTURA da tela) e `--lib-esc-fs` (o mesmo, limitado pela LARGURA da lista) — escritos por
// `acertarEscalaDaBiblioteca`. O teto da tampa sobe junto, e os blocos de raiz preenchem a lista.
//
// O que este arquivo trava, e cada uma falha CALADA (nada lança, nada aparece no console):
//  A. MAIOR QUE O AVANÇADO, em cada célula: a barra de um bloco de raiz, a seta, a linha de uma
//     faixa, a miniatura e o nome. O avançado é a régua porque ele é o "antes" — o Modo Fácil
//     usava os mesmos tokens até este lote.
//  B. PREENCHE: sem nada no ar, os blocos de raiz vão até a base da lista (ou ela já transborda).
//     Não há "antes" a comparar no avançado — lá a seção dos Favoritos ocupa o vão —; quem prova
//     que o B distingue algo é a REVERSÃO (com o teto do avançado sobram 75px a 390×844).
//  C. O ALVO: dentro de um álbum aberto, toda linha e todo botão têm ≥ 44px nos dois eixos.
//  D. NADA TRANSBORDA na horizontal, em nenhum estado.
//  E. O AVANÇADO NÃO MUDA: os tokens dele são os de sempre, e voltar do Modo Fácil apaga a escala.
//  F. A LINHA DE CONTROLES QUE RECOLHE (v1.13.8) NÃO DÁ UM SEGUNDO PULO: a escala é a mesma antes
//     e depois, e os blocos crescem para a lista nova pela curva, nunca num quadro.
//  H. COM MÍDIA NO AR a Biblioteca aberta sobre a leitura tem a mesma escala, o alvo e nada transborda.
//  G. A ESCOLHA (e o ABERTO do avançado) NÃO TEM DIVISÓRIA: por PIXEL, na faixa de cima da linha
//     marcada e logo abaixo dela, a coluna do texto tem a mesma cor da borda esquerda do card.
//
// As células: 360×640, 390×844 e 430×900, a 1×, 1,25× e 1,3× de fonte (a escala de fonte entra
// pelo `font-size` da raiz ANTES da carga, que é o que o WebView faz com a fonte do sistema).
//
//   node tools/modo-simples-biblioteca-tamanho.test.mjs
// ============================================================================
import { semRedeExterna } from './sem-rede.mjs';
import {
  servirEstatico, abrirNavegador, esperar, esperarCortina, porque, checar, falhas,
  comModoAvancado, lerPng, pixel, RAIZ_WEB,
} from './arnes.mjs';

const servidor = servirEstatico(RAIZ_WEB);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador();
const erros = [];

// O ACERVO: as duas séries, os dois hinários e três seções de coletâneas — 7 blocos de raiz no
// avançado e 6 no Modo Fácil (lá as duas séries são UM bloco, "Este sábado", desde a v1.13.15),
// o suficiente para a lista preencher sem transbordar a 390×844 (é onde o F mede o crescimento).
const SEMEAR = ({ modo, series = true }) => {
  if (series) window.serieDisponivel = () => true;
  if (series) for (const s of AVSerie.SERIES) collState[s.id] = { indexSyncedAt: Date.now(), serieDiarioEm: Date.now(), songs: [] };
  const nomes = ['Cristo vem breve, glória a Deus', 'Faixa', 'Santo, santo, santo'];
  const faixas = (n, pre) => Array.from({ length: n }, (_, i) => ({ id_music: pre + (i + 1), track: i + 1,
    name: nomes[i % 3] + ' ' + (i + 1), duration: '3:00', has_instrumental_music: false }));
  collState['hymnal-2022'] = { indexSyncedAt: Date.now(), isHymnal: true, songs: faixas(12, 'h') };
  collState['hymnal-1996'] = { indexSyncedAt: Date.now(), isHymnal: true, songs: faixas(12, 'g') };
  albumCatalog.categories = [
    { name: 'CDs Jovem', albums: [{ id_album: 77, name: 'Álbum de teste' }, { id_album: 78, name: 'Outro álbum' }] },
    { name: 'Infantis', albums: [{ id_album: 79, name: 'Cantando para Jesus' }] },
    { name: 'Datas especiais', albums: [{ id_album: 80, name: 'Natal em família' }] },
  ];
  albumCatalog.albums = [77, 78, 79, 80].map((id) => ({ id_album: id, name: 'Álbum ' + id }));
  for (const id of [77, 78, 79, 80]) collState['album-' + id] = { indexSyncedAt: Date.now(), songs: faixas(6, 'a' + id + '-') };
  if (modo === 'simple') { webDisplayWin = { closed: false }; renderSimpleCast(); } else openHymnSearch(false);
  renderSearchResults('');
};

async function abrir(W, H, E, modo) {
  const ctx = await navegador.newContext({ viewport: { width: W, height: H }, hasTouch: true });
  await semRedeExterna(ctx);
  if (modo === 'full') await comModoAvancado(ctx);
  if (E !== 1) {
    await ctx.addInitScript((e) => {
      const f = () => { document.documentElement.style.fontSize = (16 * e) + 'px'; };
      if (document.documentElement) f();
      document.addEventListener('DOMContentLoaded', f);
    }, E);
  }
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await esperarCortina(pg);
  const pronto = await esperar(pg, () => window.AVDB && window.AVSerie && !!document.querySelector('.lib-bar'), null, 30000);
  if (pronto !== true) throw new Error('o app não subiu: ' + pronto);
  await pg.evaluate(SEMEAR, { modo });
  await assentar(pg);
  return { ctx, pg };
}

// A janela parada E a tampa medida — o FATO que as medidas esperam, nunca um prazo.
const assentar = (pg) => esperar(pg, () => {
  const j = document.getElementById('hymnSearchPopup');
  const l = document.getElementById('hymnResults');
  return j.classList.contains('open') && !j.getAnimations().some((a) => a.playState === 'running')
    && !l.getAnimations({ subtree: true }).some((a) => a.playState === 'running')
    && !!l.style.getPropertyValue('--tampa-h') && l.children.length >= 6;
}, null, 10000);

// O que uma tela diz: os blocos de raiz, a barra, a seta, e — com um álbum aberto — as faixas e os
// botões da barra dele. Tudo do RENDERIZADO.
const medir = (pg) => pg.evaluate(() => {
  const r = (el) => el.getBoundingClientRect();
  const lista = document.getElementById('hymnResults');
  const rl = r(lista);
  const cs = getComputedStyle(lista);
  const blocos = [...lista.children].filter((n) => n.nodeType === 1);
  const vis = (el) => { const b = r(el); const c = getComputedStyle(el); return b.width > 0 && b.height > 0 && c.visibility !== 'hidden'; };
  // A BARRA COMPARÁVEL nos dois modos é a do Hinário 2022 (o primeiro bloco do avançado é a seção
  // dos Favoritos, que o Modo Fácil não tem).
  const hino = blocos.find((b) => /Hinário Adventista 2022/.test(b.textContent)) || blocos[0];
  const barra = hino.querySelector('.coll-bar, .coll-group-bar');
  const seta = barra.querySelector('.coll-bar-fechar, .coll-group-icon, .coll-bar-icon');
  const nomeBarra = barra.querySelector('.coll-bar-name, .coll-group-name');
  // As FAIXAS DE UM ÁLBUM — as linhas do bloco "Este sábado" (`.semana-raiz-item`, v1.13.15) também
  // são `.coll-songs > .hymn-result`, e ficam fora: o que se mede aqui é o álbum aberto.
  const faixas = [...lista.querySelectorAll('.coll-songs > .hymn-result:not(.semana-raiz-item)')].filter(vis);
  const album = faixas.length ? faixas[0].closest('.hymnal-card') : null;
  const botoes = album ? [...album.querySelector('.coll-bar').querySelectorAll('button, [role="button"]')].filter(vis) : [];
  const fora = [...lista.querySelectorAll('*')].filter((el) => {
    if (!vis(el)) return false;
    const b = r(el);
    return b.right > rl.right + 0.5 || b.left < rl.left - 0.5;
  }).map((el) => el.className && el.className.baseVal === undefined ? String(el.className).slice(0, 40) : el.tagName);
  const ultimo = blocos[blocos.length - 1];
  return {
    esc: lista.style.getPropertyValue('--lib-esc'),
    escFs: lista.style.getPropertyValue('--lib-esc-fs'),
    teto: parseFloat(getComputedStyle(lista).getPropertyValue('--lib-teto-px')) || 0,
    tampa: parseFloat(lista.style.getPropertyValue('--tampa-h')) || 0,
    n: blocos.length,
    alturas: blocos.map((b) => +r(b).height.toFixed(2)),
    barra: +r(barra).height.toFixed(2),
    seta: [+r(seta).width.toFixed(2), +r(seta).height.toFixed(2)],
    setaSvg: +r(seta.querySelector('svg')).width.toFixed(2),
    nomeBarraFs: parseFloat(getComputedStyle(nomeBarra).fontSize),
    // A sobra abaixo do último bloco, dentro da lista (o padding de baixo é da lista, não sobra).
    sobra: +(rl.bottom - (parseFloat(cs.paddingBottom) || 0) - r(ultimo).bottom).toFixed(2),
    rola: lista.scrollHeight > lista.clientHeight + 1,
    faixa: faixas.length ? +r(faixas[0]).height.toFixed(2) : 0,
    faixaRow: faixas.length ? +r(faixas[0].querySelector('.row')).height.toFixed(2) : 0,
    thumb: faixas.length ? +r(faixas[0].querySelector('.hymn-play-thumb')).width.toFixed(2) : 0,
    nomeFaixaFs: faixas.length ? parseFloat(getComputedStyle(faixas[0].querySelector('.hymn-name')).fontSize) : 0,
    faixasBaixas: faixas.filter((f) => r(f.querySelector('.row')).height < 44).length,
    botoes: botoes.map((b) => [+r(b).width.toFixed(1), +r(b).height.toFixed(1)]),
    // OS NOMES CORTADOS (elipse de uma linha ou o "…" das duas linhas do Modo Fácil), pelo texto.
    cortados: [...lista.querySelectorAll('.coll-bar-name, .coll-group-name, .hymn-name')].filter((el) => vis(el)
      && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)).map((el) => el.textContent.trim()),
    larguraDoc: document.documentElement.scrollWidth,
    larguraJanela: window.innerWidth,
    listaRolaX: lista.scrollWidth > lista.clientWidth + 0.5,
    fora,
  };
});

const abrirAlbum = (pg) => pg.evaluate(() => {
  grupoAberto = 'CDs Jovem'; ui('album-77').expanded = true; ui('album-77').shown = 1000;
  renderSearchResults('');
});
const esperarFaixas = (pg) => esperar(pg, () => {
  const l = document.getElementById('hymnResults');
  return l.querySelectorAll('.coll-songs > .hymn-result').length >= 6
    && !l.getAnimations({ subtree: true }).some((a) => a.playState === 'running');
}, null, 10000);

const CELULAS = [
  [360, 640, 1], [360, 640, 1.3], [390, 844, 1], [390, 844, 1.25], [430, 900, 1], [430, 900, 1.3],
];

try {
  for (const [W, H, E] of CELULAS) {
    const cel = `${W}×${H}·${E}×`;
    const s = await abrir(W, H, E, 'simple');
    const a = await abrir(W, H, E, 'full');
    const sRaiz = await medir(s.pg);
    const aRaiz = await medir(a.pg);
    await abrirAlbum(s.pg); await abrirAlbum(a.pg);
    const fs1 = await esperarFaixas(s.pg); const fa1 = await esperarFaixas(a.pg);
    checar(fs1 === true && fa1 === true, `${cel} · o álbum abre nos dois modos`, porque(fs1 === true ? fa1 : fs1));
    const sAlb = await medir(s.pg);
    const aAlb = await medir(a.pg);

    // ── A · MAIOR QUE O AVANÇADO ──
    const fator = (x, y) => +(x / y).toFixed(3);
    // A BARRA é texto em rem + alvo em px: com a fonte do sistema a 1,25–1,3× a parte em rem já é
    // grande nos dois modos e o ganho dela é menor (≥ 8%); a SETA e o ícone são px e crescem ≥ 25%.
    checar(fator(sRaiz.barra, aRaiz.barra) >= 1.08 && fator(sRaiz.seta[0], aRaiz.seta[0]) >= 1.25
      && fator(sRaiz.setaSvg, aRaiz.setaSvg) >= 1.25,
      `A1 · ${cel} · a barra de um bloco de raiz, a seta e o ícone dela são maiores que no avançado`,
      { barra: [sRaiz.barra, aRaiz.barra], seta: [sRaiz.seta, aRaiz.seta], svg: [sRaiz.setaSvg, aRaiz.setaSvg] });
    checar(fator(sAlb.faixaRow, aAlb.faixaRow) >= 1.25 && fator(sAlb.thumb, aAlb.thumb) >= 1.25,
      `A2 · ${cel} · a linha de uma faixa e a miniatura dela são maiores que no avançado`,
      { linha: [sAlb.faixaRow, aAlb.faixaRow], thumb: [sAlb.thumb, aAlb.thumb] });
    // A letra cresce com a LARGURA da lista em rem: na mais estreita ela fica no tamanho de hoje
    // (nunca menor); na de 390 e 430 a 1× ela tem de crescer de fato.
    const largaDeVerdade = E === 1 && W >= 390;
    checar(sAlb.nomeFaixaFs >= aAlb.nomeFaixaFs && sRaiz.nomeBarraFs >= aRaiz.nomeBarraFs
      && (!largaDeVerdade || (sAlb.nomeFaixaFs > aAlb.nomeFaixaFs * 1.1 && sRaiz.nomeBarraFs > aRaiz.nomeBarraFs * 1.1)),
      `A3 · ${cel} · a letra nunca é menor que no avançado${largaDeVerdade ? ', e aqui é ≥ 10% maior' : ''}`,
      { faixa: [sAlb.nomeFaixaFs, aAlb.nomeFaixaFs], barra: [sRaiz.nomeBarraFs, aRaiz.nomeBarraFs], escFs: sRaiz.escFs });

    // ── B · PREENCHE ──
    // Com SEIS blocos: ou eles chegam à base da lista, ou a lista já transborda (360×640). O teto
    // da raiz do avançado (`--hit` + 2rem) deixava 75px de lista vazia a 390×844 — MEDIDO por reversão.
    checar(sRaiz.esc !== '' && sRaiz.teto > 66 && (Math.abs(sRaiz.sobra) <= 2 || sRaiz.rola),
      `B · ${cel} · sem nada no ar os blocos de raiz vão até a base da lista`,
      { sobra: sRaiz.sobra, alturas: sRaiz.alturas, teto: sRaiz.teto, tampa: sRaiz.tampa, rola: sRaiz.rola });

    // ── C · O ALVO ──
    checar(sAlb.faixasBaixas === 0 && sAlb.faixaRow >= 44 && sAlb.botoes.length >= 2
      && sAlb.botoes.every(([w, h]) => w >= 44 && h >= 44),
      `C · ${cel} · num álbum aberto toda faixa e todo botão da barra têm ≥ 44px nos dois eixos`,
      { faixa: sAlb.faixaRow, botoes: sAlb.botoes });

    // ── D · NADA TRANSBORDA ──
    for (const [nome, m] of [['raiz', sRaiz], ['álbum aberto', sAlb]]) {
      checar(m.larguraDoc <= m.larguraJanela && !m.listaRolaX && m.fora.length === 0,
        `D · ${cel} · ${nome}: nada passa da largura da lista nem da tela`,
        { doc: m.larguraDoc, janela: m.larguraJanela, rolaX: m.listaRolaX, fora: m.fora.slice(0, 6) });
    }

    // ── D2 · NENHUM NOME A MAIS É CORTADO ──
    // A régua é o AVANÇADO na mesma célula (o "antes"): o que já saía com "…" ali pode sair aqui; o
    // que cabia ali tem de caber aqui — é por isso que o nome do Modo Fácil quebra em duas linhas.
    for (const [nome, ms, ma] of [['raiz', sRaiz, aRaiz], ['álbum aberto', sAlb, aAlb]]) {
      const novos = ms.cortados.filter((t) => !ma.cortados.includes(t));
      checar(novos.length === 0, `D2 · ${cel} · ${nome}: nenhum nome que cabia no avançado sai cortado no Modo Fácil`,
        { novos, simples: ms.cortados, avancado: ma.cortados });
    }

    // ── E · O AVANÇADO NÃO MUDA ──
    const tokensAv = await a.pg.evaluate(() => {
      const l = document.getElementById('hymnResults');
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const f = l.querySelector('.coll-songs > .hymn-result');
      return {
        esc: l.style.getPropertyValue('--lib-esc'), teto: getComputedStyle(l).getPropertyValue('--lib-teto-px').trim(),
        thumb: f.querySelector('.hymn-play-thumb').getBoundingClientRect().width,
        nome: parseFloat(getComputedStyle(f.querySelector('.hymn-name')).fontSize) / rem,
      };
    });
    checar(tokensAv.esc === '' && tokensAv.teto === '0px' && Math.abs(tokensAv.thumb - 38) < 0.01
      && Math.abs(tokensAv.nome - 0.82) < 0.001 && Math.abs(aRaiz.seta[0] - 34) < 0.01,
      `E1 · ${cel} · no avançado nada é escalado: sem fator, miniatura 38px, nome a .82rem, seta de 34px`, tokensAv);

    await s.ctx.close(); await a.ctx.close();
  }

  // ── E2 · VOLTAR AO AVANÇADO APAGA A ESCALA (a mesma página) ──
  {
    const { ctx, pg } = await abrir(390, 844, 1, 'simple');
    await pg.evaluate(() => { setAppMode('full'); openHymnSearch(false); grupoAberto = 'CDs Jovem';
      ui('album-77').expanded = true; ui('album-77').shown = 1000; renderSearchResults(''); });
    await esperarFaixas(pg);
    const e2 = await pg.evaluate(() => {
      const l = document.getElementById('hymnResults');
      return { esc: l.style.getPropertyValue('--lib-esc'), fs: l.style.getPropertyValue('--lib-esc-fs'),
        thumb: l.querySelector('.hymn-play-thumb').getBoundingClientRect().width };
    });
    checar(e2.esc === '' && e2.fs === '' && Math.abs(e2.thumb - 38) < 0.01,
      'E2 · sair do Modo Fácil apaga a escala da lista: a miniatura volta aos 38px do avançado', e2);
    await ctx.close();
  }

  // ── F · A LINHA DE CONTROLES QUE RECOLHE NÃO DÁ UM SEGUNDO PULO ──
  {
    const { ctx, pg } = await abrir(390, 844, 1, 'simple');
    const id = await pg.evaluate(async () => (await AVDB.addMedia(new Blob(['x'], { type: 'audio/wav' }),
      { name: 'Louvor de Fundo', type: 'audio/wav', kind: 'audio', list: 'imports' })).id);
    await pg.evaluate(async (i) => {
      await send(i);
      currentItem.lyrics = [{ cover: true }, { time: 0, text: 'primeira' }, { time: 5, text: 'segunda' }];
      renderSlideNav();
    }, id);
    await esperar(pg, () => !document.getElementById('hymnSearchPopup').classList.contains('open')
      && !document.querySelector('.simple-remote').classList.contains('recolhida'), null, 10000);
    // O PARAR, e daí em diante uma amostra por quadro: a escala, a altura do primeiro bloco e o
    // instante em que a linha sai do layout.
    const f = await pg.evaluate(async () => {
      const lista = document.getElementById('hymnResults');
      const remote = document.querySelector('.simple-remote');
      const amostras = [];
      let recolheuEm = null;
      document.getElementById('simpleStop').click();
      const t0 = performance.now();
      await new Promise((fim) => {
        const passo = () => {
          const t = performance.now() - t0;
          // O primeiro bloco que REPARTE a tampa: o "Este sábado" tem a altura do conteúdo (v1.13.15).
          const b = [...lista.children].find((n) => !n.classList.contains('bloco-fixo'));
          if (recolheuEm === null && remote.classList.contains('recolhida')) recolheuEm = t;
          amostras.push([Math.round(t), lista.style.getPropertyValue('--lib-esc'), b ? +b.getBoundingClientRect().height.toFixed(2) : 0]);
          if (recolheuEm !== null && t - recolheuEm > 1200) return fim();
          if (t > 8000) return fim();
          requestAnimationFrame(passo);
        };
        requestAnimationFrame(passo);
      });
      return { amostras, recolheuEm };
    });
    checar(f.recolheuEm !== null, 'F0 · (premissa) depois do Parar a linha de controles recolhe', { recolheuEm: f.recolheuEm });
    const depoisDaAbertura = f.amostras.filter(([t]) => f.recolheuEm !== null && t >= f.recolheuEm - 300 && t < f.recolheuEm);
    const fim = f.amostras.filter(([t]) => t >= f.recolheuEm);
    const escalas = new Set(f.amostras.filter(([, e]) => e !== '').map(([, e]) => e));
    checar(escalas.size === 1,
      'F1 · a escala da Biblioteca é a MESMA antes e depois de a linha recolher (sem segundo pulo de tamanho)',
      [...escalas]);
    const hAntes = depoisDaAbertura.length ? depoisDaAbertura[depoisDaAbertura.length - 1][2] : 0;
    const hDepois = fim.length ? fim[fim.length - 1][2] : 0;
    let salto = 0;
    for (let i = 1; i < fim.length; i++) salto = Math.max(salto, Math.abs(fim[i][2] - fim[i - 1][2]));
    const total = hDepois - hAntes;
    checar(total > 2,
      'F2 · e os blocos de raiz CRESCEM para a lista nova — a sobra que a linha deixou é usada',
      { antes: hAntes, depois: hDepois });
    checar(total > 2 && salto <= total * 0.6,
      'F3 · pela curva, e não num quadro: o maior passo entre dois quadros é uma fração do crescimento',
      { total: +total.toFixed(2), maiorPasso: +salto.toFixed(2) });
    await ctx.close();
  }

  // ── H · COM MÍDIA NO AR: a Biblioteca aberta sobre a leitura tem a MESMA escala, o alvo e
  // nenhum transbordo (o que muda é só a altura que ela ocupa) ──
  for (const [W, H, E] of [[390, 844, 1], [360, 640, 1.3]]) {
    const cel = `${W}×${H}·${E}×`;
    const { ctx, pg } = await abrir(W, H, E, 'simple');
    const escSemNada = await pg.evaluate(() => document.getElementById('hymnResults').style.getPropertyValue('--lib-esc'));
    const id = await pg.evaluate(async () => (await AVDB.addMedia(new Blob(['x'], { type: 'audio/wav' }),
      { name: 'Louvor de Fundo', type: 'audio/wav', kind: 'audio', list: 'imports' })).id);
    await pg.evaluate(async (i) => {
      await send(i);
      currentItem.lyrics = [{ cover: true }, { time: 0, text: 'primeira' }, { time: 5, text: 'segunda' }];
      renderSlideNav();
    }, id);
    await esperar(pg, () => !document.getElementById('hymnSearchPopup').classList.contains('open'), null, 10000);
    await pg.evaluate(() => { openHymnSearch(false); });
    await assentar(pg);
    await abrirAlbum(pg);
    await esperarFaixas(pg);
    const h = await medir(pg);
    const noAr = await pg.evaluate(() => haOQueParar());
    checar(noAr && h.esc === escSemNada,
      `H1 · ${cel} · com mídia no ar a Biblioteca aberta tem a mesma escala de quando nada toca`, { noAr, esc: h.esc, escSemNada });
    checar(h.faixasBaixas === 0 && h.botoes.every(([w, hh]) => w >= 44 && hh >= 44)
      && h.larguraDoc <= h.larguraJanela && !h.listaRolaX && h.fora.length === 0,
      `H2 · ${cel} · e nela o alvo continua ≥ 44px e nada transborda`, { faixa: h.faixaRow, botoes: h.botoes, fora: h.fora.slice(0, 4) });
    await ctx.close();
  }

  // ── G · A ESCOLHA NÃO TEM DIVISÓRIA (por pixel) ──
  // A linha marcada pelo caminho do app (`simpleMarcarEscolha`, que escreve `.selecionando`; sem a
  // escolha registrada, uma marca escrita à mão é apagada pelo próximo `simpleLimparSelecao`)
  // e o ABERTO do avançado (o toque de verdade na linha). Em cada uma: a faixa de cima da linha (o
  // `padding-top` onde o traço pousa) e os 2px logo abaixo dela, comparando a coluna do TEXTO com a
  // coluna da MINIATURA — as duas são a mesma superfície se não houver traço.
  for (const modo of ['simple', 'full']) {
    const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 2 });
    await semRedeExterna(ctx);
    if (modo === 'full') await comModoAvancado(ctx);
    const pg = await ctx.newPage();
    pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
    await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
    await esperarCortina(pg);
    await esperar(pg, () => window.AVDB && window.AVSerie && !!document.querySelector('.lib-bar'), null, 30000);
    await pg.evaluate(SEMEAR, { modo, series: false });
    await esperar(pg, () => document.getElementById('hymnSearchPopup').classList.contains('open')
      && !!document.getElementById('hymnResults').style.getPropertyValue('--tampa-h'), null, 10000);
    await abrirAlbum(pg);
    await esperarFaixas(pg);
    await pg.evaluate((m) => {
      const li = document.querySelectorAll('#hymnResults .coll-songs > .hymn-result')[2];
      if (m === 'simple') simpleMarcarEscolha(li.dataset.song, li);
      else li.querySelector('.row').click();
    }, modo);
    // A cor e o recuo do toque assentam (as transições de .14 e .2 s) e, no avançado, a gaveta abre
    // e a lista alinha.
    await esperar(pg, () => {
      const li = document.querySelector('#hymnResults .coll-songs > .hymn-result.selecionando, #hymnResults .coll-songs > .hymn-result.expanded');
      return !!li && !document.getElementById('hymnResults').getAnimations({ subtree: true }).some((a) => a.playState === 'running');
    }, null, 10000);
    // A transição de cor da linha (`background-color .2s`) não é animação de WAAPI; 300 ms a
    // cobrem e ficam dentro dos `SIMPLE_FEEDBACK_MS` (420) em que a escolha segura a marca.
    await pg.waitForTimeout(300);
    const g = await pg.evaluate(() => {
      const li = document.querySelector('#hymnResults .coll-songs > .hymn-result.selecionando, #hymnResults .coll-songs > .hymn-result.expanded');
      const row = li.querySelector('.row').getBoundingClientRect();
      const nome = li.querySelector('.hymn-name').getBoundingClientRect();
      const b = li.getBoundingClientRect();
      const t = li.querySelector('.hymn-play-thumb').getBoundingClientRect();
      // A coluna da MINIATURA (o centro dela) está dentro do card e longe do arco do canto; acima e
      // abaixo da miniatura ela é a mesma superfície que a coluna do texto, salvo um traço.
      return { topo: b.top, rowTopo: row.top, rowBase: row.bottom, esq: t.left + t.width / 2, texto: nome.left + 12, prox: !!li.nextElementSibling };
    });
    const img = lerPng(await pg.screenshot());
    const DPR = 2;
    const cor = (x, y) => pixel(img, Math.round(x * DPR), Math.floor(y * DPR));
    const dist = (p, q) => Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1]), Math.abs(p[2] - q[2]));
    let pior = { d: 0 };
    // a faixa de cima: do topo do card até o topo da `.row`
    for (let y = g.topo + 0.25; y < g.rowTopo; y += 0.5) {
      const d = dist(cor(g.esq, y), cor(g.texto, y));
      if (d > pior.d) pior = { d, y: +y.toFixed(2), onde: 'topo', esq: cor(g.esq, y).slice(0, 3), texto: cor(g.texto, y).slice(0, 3) };
    }
    const nome = modo === 'simple' ? 'G1 · Modo Fácil, a linha ESCOLHIDA' : 'G2 · avançado, a linha ABERTA';
    checar(pior.d <= 6, nome + ': sem traço na faixa de cima — a coluna do texto tem a cor da coluna da miniatura', pior);
    if (modo === 'simple' && g.prox) {
      // logo ABAIXO da linha (os 2 px de vão): nem preenchimento nem traço — a coluna do texto é
      // igual à da miniatura (que tem o fundo da lista ali).
      let pb = { d: 0 };
      for (let y = g.rowBase + 0.25; y < g.rowBase + 2; y += 0.5) {
        const d = dist(cor(g.esq, y), cor(g.texto, y));
        if (d > pb.d) pb = { d, y: +y.toFixed(2), esq: cor(g.esq, y).slice(0, 3), texto: cor(g.texto, y).slice(0, 3) };
      }
      checar(pb.d <= 6, 'G3 · Modo Fácil: logo abaixo da linha escolhida não há traço só sob o texto', pb);
    }
    await ctx.close();
  }
} finally {
  await navegador.close();
  await new Promise((r) => servidor.close(r));
}

checar(erros.length === 0, 'nenhum erro de página', erros.slice(0, 5));
console.log(falhas.length ? '\n' + falhas.length + ' falha(s)' : '\ntudo certo');
process.exit(falhas.length ? 1 : 0);
