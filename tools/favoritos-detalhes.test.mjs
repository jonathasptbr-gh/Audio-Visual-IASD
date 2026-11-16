#!/usr/bin/env node
// ============================================================================
// FAVORITOS: O CARD DE DETALHES, A FAIXA E A DIVISÓRIA (v1.14.45)
//
// Três relatos do operador, 2026-11-16, sobre a tela dos Favoritos:
//
//  1. *"ao abrir as opções de play e depois abrir as opções de modificações do
//     item, uma barra de cor diferente cobre o fundo da seção de opções de
//     edição"* — a `.row-acoes` pintava `--panel` por cima de uma `.row` que,
//     ABERTA, é `--gaveta-bg`: a tampa virava uma barra de outra cor no meio do
//     card escuro. Agora ela veste o tom do card, com os mesmos `:not()` da
//     regra do `.row` (no ar e acesa continuam no preenchimento de estado).
//  2. *"nas opções de play de entrada de importação ou compartilhamento …
//     ficam com a linha de opções de play com poucos itens na esquerda, pois não
//     tem o botão de 'detalhes'. Adicione esse botão, e para cada tipo de item,
//     tente buscar o máximo de informações"* — o segundo botão LARGO da fileira
//     (`destBotaoDetalhesDoItem`), que revela o `.item-detalhe` do item, e o
//     `montarDetalhesDoItem`, que só escreve a linha cujo dado existe.
//  3. *"a linha divisória entre os itens, que fica acima do item aberto, fica
//     marcando a borda desse card escuro … na lista do hinário, a linha não fica
//     sobrepondo"* — a regra "A ESCOLHA NÃO TEM DIVISÓRIA" (v1.13.9) não
//     alcançava a placa dos Favoritos, e os dois traços (o do aberto e o da
//     vizinha de baixo) ficavam a 4px do card. Agora somem, como no hinário.
//
//  A. TODO favorito tem UM botão largo só, e ele PREENCHE a fileira (o item sem
//     letra: 3 quadrados + "Detalhes"). O Pacote 41 tornou os dois largos um OU
//     exclusivo: com letra o largo é "Ver a letra" (o card continua montado, sem
//     botão), sem letra é "Detalhes" — a prova das duas metades é o bloco F.
//  B. O card abre e fecha pelo botão (`vendo-detalhe`, `.on`, `aria-pressed`),
//     com o `.item-detalhe` à vista e as linhas do REGISTRO.
//  C. POR TIPO: o áudio diz o formato ("Áudio MP3"), o PDF diz "PDF" (o
//     subtítulo só sabe "Arquivo"), a imagem traz a dimensão decodificada e o
//     vídeo do YouTube traz o canal. Nenhuma linha escreve "undefined".
//  D. Com a gaveta aberta, a faixa do `⋮` pinta o MESMO tom do card — a régua é
//     o VIZINHO RENDERIZADO, nunca o token lido de volta.
//  E. A divisória do item aberto e a da vizinha de baixo somem; a das outras
//     linhas fechadas fica.
//
//   node tools/favoritos-detalhes.test.mjs
// ============================================================================
import { semRedeExterna } from './sem-rede.mjs';
import {
  servirEstatico, abrirNavegador, esperarCortina, esperar, checar, falhas, RAIZ_WEB, comModoAvancado,
} from './arnes.mjs';

const servidor = servirEstatico(RAIZ_WEB);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador();
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// PNG 1×1 de verdade: é o que faz a linha da dimensão existir.
const PNG_1X1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

try {
  const ctx = await navegador.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true });
  await semRedeExterna(ctx);
  await comModoAvancado(ctx);
  const pg = await ctx.newPage();
  const erros = [];
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded', timeout: 120000 });
  const cortina = await esperarCortina(pg, 150000);
  if (cortina !== true) throw new Error('o app não terminou de abrir: ' + cortina);
  await pg.waitForFunction(() => !window.__avSplash || window.__avSplash.terminou === true,
    null, { timeout: 150000 });
  await pg.waitForFunction(() => window.AVDB && !!document.querySelector('.lib-bar'), null, { timeout: 30000 });

  // ── O CENÁRIO: quatro favoritos, um de cada tipo que o card tem de cobrir ──
  await pg.evaluate(async (png) => {
    setAppMode('full');
    const bytes = Uint8Array.from(atob(png), (c) => c.charCodeAt(0));
    await AVDB.addMedia(new Blob([new Uint8Array(8)], { type: 'audio/mpeg' }),
      { name: 'Áudio com letra', kind: 'audio', list: 'favs' });
    await AVDB.addMedia(new Blob([new Uint8Array(8)], { type: 'application/pdf' }),
      { name: 'Programa do culto.pdf', kind: 'other', list: 'favs' });
    await AVDB.addMedia(new Blob([bytes], { type: 'image/png' }),
      { name: 'Foto do telão', kind: 'image', list: 'favs' });
    await AVDB.addMedia(new Blob([new Uint8Array(8)], { type: 'video/mp4' }),
      { name: 'Vídeo do YouTube', kind: 'video', height: 1080, seconds: 312, canal: 'Canal do culto', youtubeId: 'abc123', list: 'favs' });
    await recarregarFavoritos();
    if (!hymnSearchPopupEl.classList.contains('open')) openHymnSearch(false);
    favAberto = true;
    renderSearchResults('');
  }, PNG_1X1);
  const linhas = '#hymnResults [data-fav-corpo] .fav-itens > .lib-item';
  if (!await esperar(pg, (s) => document.querySelectorAll(s).length === 4, linhas, 15000)) {
    throw new Error('sem 4 favoritos');
  }
  await espera(1500);

  const abrirGaveta = async (i) => {
    await pg.locator(linhas).nth(i).locator('.row-text').click();
    await esperar(pg, ({ s, i: n }) => {
      const li = document.querySelectorAll(s)[n];
      return !!li && li.classList.contains('expanded');
    }, { s: linhas, i }, 8000);
    await espera(400);
  };
  // Fechar por DOM: em 360px a lista rola por baixo da barra GRUDADA do grupo, e
  // um toque por coordenada acerta a barra. O `click()` dispara o MESMO ouvinte
  // da `.row` — o que se está provando aqui é o estado, não a hit-test.
  const fechar = async (i) => {
    await pg.evaluate(({ s, i: n }) => {
      const li = document.querySelectorAll(s)[n];
      const mais = li.querySelector(':scope > .row > .row-mais');
      if (li.classList.contains('acoes-abertas') && mais) mais.click();
      const row = li.querySelector(':scope > .row');
      if (row) row.click();
    }, { s: linhas, i });
    await espera(450);
  };
  const abrirCard = async (i) => {
    const b = pg.locator(linhas).nth(i).locator('.dest-botoes > [data-dest="detalhes"]');
    await b.click();
    await espera(500);
    return b;
  };

  // ── A. O BOTÃO EXISTE EM TODOS, E É LARGO ────────────────────────────────
  const a = [];
  for (let i = 0; i < 4; i++) {
    await abrirGaveta(i);
    a.push(await pg.evaluate(({ linhas, i }) => {
      const li = document.querySelectorAll(linhas)[i];
      const det = li.querySelector('.dest-botoes > [data-dest="detalhes"]');
      const quad = li.querySelector('.dest-botoes > .dest-btn');
      const largos = [...li.querySelectorAll('.dest-botoes > .dest-largo')].map((b) => b.textContent.trim());
      return {
        nome: li.querySelector('.row-name').textContent,
        existe: !!det,
        texto: det ? det.textContent.trim() : null,
        largo: !!det && det.classList.contains('dest-largo'),
        maiorQueOQuadrado: !!det && !!quad && det.getBoundingClientRect().width > quad.getBoundingClientRect().width,
        largos,
      };
    }, { linhas, i }));
    // Fecha a gaveta antes do próximo (o acordeão é um por vez).
    await fechar(i);
  }
  checar(a.every((r) => r.existe && r.texto === 'Detalhes' && r.largo && r.maiorQueOQuadrado),
    'A · todo favorito SEM letra tem o "Detalhes" LARGO na gaveta, e ele cresce no resto da fileira', a);
  checar(a.every((r) => r.largos.join('|') === 'Detalhes'),
    'A · e UM largo só por fileira: os dois ao mesmo tempo (v1.14.45) saíram — o de uma música é o "Ver a letra"',
    a.map((r) => [r.nome, r.largos]));

  // ── B. O CARD ABRE E FECHA PELO BOTÃO ────────────────────────────────────
  await abrirGaveta(0);
  const b0 = await pg.evaluate((linhas) => {
    const li = document.querySelectorAll(linhas)[0];
    const card = li.querySelector(':scope > .hymn-gaveta > .item-detalhe');
    return { aberto: li.classList.contains('vendo-detalhe'), display: card ? getComputedStyle(card).display : null };
  }, linhas);
  await abrirCard(0);
  const b1 = await pg.evaluate((linhas) => {
    const li = document.querySelectorAll(linhas)[0];
    const card = li.querySelector(':scope > .hymn-gaveta > .item-detalhe');
    const btn = li.querySelector('.dest-botoes > [data-dest="detalhes"]');
    return {
      aberto: li.classList.contains('vendo-detalhe'),
      display: card ? getComputedStyle(card).display : null,
      ligado: btn.classList.contains('on') && btn.getAttribute('aria-pressed') === 'true',
      linhas: card ? [...card.querySelectorAll('.item-detalhe-linha')].filter((e) => !e.hidden).map((e) => e.textContent) : [],
    };
  }, linhas);
  await abrirCard(0);
  const b2 = await pg.evaluate((linhas) => {
    const li = document.querySelectorAll(linhas)[0];
    const card = li.querySelector(':scope > .hymn-gaveta > .item-detalhe');
    return { aberto: li.classList.contains('vendo-detalhe'), display: card ? getComputedStyle(card).display : null };
  }, linhas);
  checar(!b0.aberto && b0.display === 'none' && b1.aberto && b1.display === 'flex' && b1.ligado
    && !b2.aberto && b2.display === 'none',
    'B · o "Detalhes" abre o card (`vendo-detalhe` + `.on` + `aria-pressed`) e o fecha no segundo toque', { b0, b1, b2 });
  checar(b1.linhas.includes('Áudio MP3') && b1.linhas.some((l) => /^Criado em \d\d\/\d\d\/\d{4}$/.test(l)),
    'B · o card de um áudio diz o formato, o tamanho, a origem e a data', b1.linhas);

  // ── C. POR TIPO ──────────────────────────────────────────────────────────
  // O PDF: o subtítulo da linha diz "Arquivo", e o card diz o que ele é.
  await fechar(0);
  await abrirGaveta(1);
  await abrirCard(1);
  const c = await pg.evaluate((linhas) => {
    const li = document.querySelectorAll(linhas)[1];
    const card = li.querySelector(':scope > .hymn-gaveta > .item-detalhe');
    return {
      sub: li.querySelector('.row-sub').textContent,
      linhas: [...card.querySelectorAll('.item-detalhe-linha')].filter((e) => !e.hidden).map((e) => e.textContent),
    };
  }, linhas);
  checar(c.sub.startsWith('Arquivo') && c.linhas.includes('PDF'),
    'C · o PDF importado: a linha diz "Arquivo" e o card diz "PDF"', c);

  // A IMAGEM: a dimensão vem de uma decodificação sob demanda.
  await fechar(1);
  await abrirGaveta(2);
  await abrirCard(2);
  const temDim = await esperar(pg, (s) => [...document.querySelectorAll(s)]
    .some((e) => / px$/.test(e.textContent)), linhas + ':nth-child(3) .item-detalhe-linha', 4000);
  const ci = await pg.evaluate((linhas) => {
    const li = document.querySelectorAll(linhas)[2];
    const card = li.querySelector(':scope > .hymn-gaveta > .item-detalhe');
    return [...card.querySelectorAll('.item-detalhe-linha')].filter((e) => !e.hidden).map((e) => e.textContent);
  }, linhas);
  checar(ci.includes('Imagem PNG') && ci.includes('1 × 1 px'),
    'C · a imagem traz o formato e a dimensão decodificada do próprio blob', { ci, temDim });
  checar(!ci.some((l) => /undefined|null|NaN/.test(l)), 'C · nenhuma linha do card escreve "undefined"', ci);

  // O VÍDEO do YouTube: o canal, e a origem.
  await fechar(2);
  await abrirGaveta(3);
  await abrirCard(3);
  const cv = await pg.evaluate((linhas) => {
    const li = document.querySelectorAll(linhas)[3];
    const card = li.querySelector(':scope > .hymn-gaveta > .item-detalhe');
    return [...card.querySelectorAll('.item-detalhe-linha')].filter((e) => !e.hidden).map((e) => e.textContent);
  }, linhas);
  checar(cv.includes('Canal do culto') && cv.includes('Baixado do YouTube'),
    'C · o vídeo do YouTube traz o canal e a origem', cv);

  // ── D. A FAIXA COM A GAVETA ABERTA VESTE O TOM DO CARD ───────────────────
  // A gaveta do vídeo está aberta (o item 4). Abre a faixa do `⋮` dele.
  await pg.locator(linhas).nth(3).locator(':scope > .row > .row-mais').click();
  await esperar(pg, (s) => document.querySelectorAll(s)[0] && document.querySelectorAll(s)[0].classList.contains('acoes-abertas'),
    linhas + '.acoes-abertas', 4000).catch(() => {});
  await espera(400);
  const d = await pg.evaluate((linhas) => {
    const li = document.querySelectorAll(linhas)[3];
    const faixa = li.querySelector(':scope > .row > .row-acoes');
    const gav = li.querySelector(':scope > .hymn-gaveta');
    const row = li.querySelector(':scope > .row');
    const cs = faixa && getComputedStyle(faixa);
    return {
      acoes: li.classList.contains('acoes-abertas'),
      visivel: !!faixa && getComputedStyle(faixa).visibility === 'visible' && Number(getComputedStyle(faixa).opacity) > 0.9,
      faixaCor: cs && cs.backgroundColor,
      faixaImg: cs && cs.backgroundImage,
      gavetaBg: gav && getComputedStyle(gav).backgroundColor,
      rowBg: row && getComputedStyle(row).backgroundColor,
    };
  }, linhas);
  // A régua é o VIZINHO: a faixa tem de pintar o que o card aberto pinta.
  checar(d.acoes && d.visivel && d.faixaCor === d.gavetaBg && d.faixaCor === d.rowBg && d.faixaImg === 'none',
    'D · com a gaveta aberta, a faixa do `⋮` pinta o MESMO tom da `.row` e do card — sem barra de outra cor', d);

  // ── E. A DIVISÓRIA DO ABERTO E DA VIZINHA DE BAIXO ───────────────────────
  // O item 2 (o PDF) é o do meio: tem vizinha em CIMA (o item 1) e embaixo
  // (o item 3), e é o que prova os dois lados da regra.
  await fechar(3);   // fecha o vídeo (e a faixa, se estiver aberta)
  await abrirGaveta(1);
  const e = await pg.evaluate((linhas) => {
    const lis = [...document.querySelectorAll(linhas)];
    const antes = (el) => {
      const c = getComputedStyle(el, '::before');
      return c.content === 'none' ? 'none' : c.display;
    };
    return {
      aberto: lis[1].classList.contains('expanded'),
      propria: antes(lis[1]),          // o traço ACIMA do aberto
      vizinhaDeBaixo: antes(lis[2]),   // o traço abaixo dele
      terceiraFechada: antes(lis[3]),  // um traço que NÃO é vizinho do aberto
    };
  }, linhas);
  checar(e.aberto && e.propria === 'none' && e.vizinhaDeBaixo === 'none' && e.terceiraFechada !== 'none',
    'E · a divisória do favorito aberto e a da vizinha de baixo somem; a de uma linha fechada distante fica', e);

  // ── F. O BOTÃO LARGO ALTERNA: LETRA OU DETALHES, NUNCA OS DOIS (Pacote 41) ──
  // Pedido do operador, 2026-11-16 12h: *"para músicas da biblioteca, nos
  // favoritos, não deixe os detalhes, deixe apenas o ver letra. Basicamente esse
  // botão maior se altera entre 'Ver letra' e 'Detalhes'. Como músicas da
  // biblioteca tem letra, então o botão será ver letra. Quando não há letra, e
  // for uma mídia genérica, então 'Detalhes'."* A letra entra AQUI, depois de o
  // B e o C abrirem o card do MESMO item sem ela — é o que prova o alternar.
  await pg.evaluate(() => {
    const com = favItems.find((m) => m.name === 'Áudio com letra');
    if (com) com.lyrics = [{ time: 0, text: 'Primeira estrofe' }];
    songMenuFor = null;
    renderSearchResults('');
  });
  await esperar(pg, (s) => document.querySelectorAll(s).length === 4, linhas, 15000);
  await espera(600);
  await abrirGaveta(0);
  const f = await pg.evaluate((linhas) => {
    const li = document.querySelectorAll(linhas)[0];
    return {
      largos: [...li.querySelectorAll('.dest-botoes > .dest-largo')].map((b) => [b.dataset.dest, b.textContent.trim()]),
      detalhes: !!li.querySelector('.dest-botoes > [data-dest="detalhes"]'),
      leitura: !!li.querySelector('.dest-botoes > [data-dest="leitura"]'),
      cardMontado: !!li.querySelector(':scope > .hymn-gaveta > .item-detalhe'),
    };
  }, linhas);
  checar(f.leitura && f.detalhes === false && f.largos.length === 1
    && f.largos[0][0] === 'leitura' && f.largos[0][1] === 'Ver a letra',
    'F · com letra, o ÚNICO botão largo é o "Ver a letra" — o "Detalhes" sai da fileira', f);
  checar(f.cardMontado,
    'F · e o card de detalhes continua montado na gaveta: o que saiu foi o BOTÃO, não o card', f.cardMontado);

  checar(erros.length === 0, 'nenhum erro de página', erros);
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
