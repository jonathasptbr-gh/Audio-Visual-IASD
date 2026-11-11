#!/usr/bin/env node
// ============================================================================
// FAVORITOS: O `⋮` MORA NA LINHA, E REORDENAR É SEGURAR E ARRASTAR (v1.13.68)
//
// Pedido do operador (item 11.1): *"o botão de opções, que fica na mesma linha
// do nome do item dos favoritos, e fica sempre visível, sem precisar abrir as
// opções de play para ter acesso a ele. Semelhante ao que já é no cronograma. Se
// quiser, atualize o sistema de reordenação da lista dos favoritos para que use o
// mesmo sistema de arrastar e soltar do cronograma."*
//
// Até a v1.13.67 o `⋮` e a faixa (excluir · renomear · ↑↓) eram criados pelo
// `renderItemMenu`, DENTRO da gaveta de play: um toque na linha para abri-la e
// outro no `⋮`. Agora é a anatomia da linha do Cronograma (`montarAcoesDaLinha`).
//
//  A. A GAVETA FECHADA, o `⋮` (`.row-mais`) está na MESMA LINHA do nome, à direita,
//     quadrado, dentro da tela a 360px×1,25× — e não há `⋮`/faixa duplicado na gaveta.
//  B. TOCAR NO `⋮` ABRE A FAIXA (excluir · renomear, sem ↑↓) POR CIMA DA LINHA, sem
//     abrir a gaveta; a faixa aberta SEGURA o redesenho do acervo
//     (`interacaoAbertaNoAcervo`); outro `⋮` fecha o primeiro; o toque na linha
//     (a gaveta) continua abrindo a gaveta.
//  C. AS AÇÕES FUNCIONAM: "Ver a letra" (só no registro com letra), renomear, excluir
//     (com a confirmação na faixa; cancelar não exclui).
//  D. REORDENAR É SEGURAR E ARRASTAR (o gesto do Cronograma): muda a ordem, PERSISTE
//     (banco e depois de recarregar), a pasta do aparelho continua no topo e fora do
//     arrasto, soltar não abre a gaveta e um toque longo sem mover não muda nada.
//  E. O ORÁCULO REPROVA o desenho antigo: a mesma medida, aplicada a uma linha com o
//     `⋮` só dentro da gaveta, dá falso.
//
//   node tools/favoritos-menu-na-linha.test.mjs
// ============================================================================
import { semRedeExterna } from './sem-rede.mjs';
import {
  servirEstatico, abrirNavegador, esperarCortina, esperar, porque, checar, falhas, RAIZ_WEB, comModoAvancado,
} from './arnes.mjs';

const servidor = servirEstatico(RAIZ_WEB);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador();
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  const ctx = await navegador.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true });
  await semRedeExterna(ctx);
  await comModoAvancado(ctx);
  const pg = await ctx.newPage();
  const erros = [];
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await esperarCortina(pg);
  await pg.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function'
    && !!document.querySelector('.lib-bar'), null, { timeout: 30000 });

  // ── O CENÁRIO: quatro favoritos (o primeiro com letra) e uma pasta do aparelho ─
  const NOMES = ['Louvor com letra', 'Segundo', 'Terceiro', 'Quarto'];
  const abrirSecao = () => pg.evaluate(async () => {
    setAppMode('full');
    document.documentElement.style.fontSize = '20px';   // 360px × 1,25×
    // A pasta mora NO BANCO (`opfs-folders`): só em memória o `load()` do soltar a apagaria.
    await AVDB.setState('opfs-folders', [{ id: 'pasta-fav', name: 'Vídeos do culto', count: 2 }]);
    opfsFolders = [{ id: 'pasta-fav', name: 'Vídeos do culto', count: 2 }];
    await recarregarFavoritos();
    // A letra mora no REGISTRO: é o que o `renderItemMenu` lê.
    const com = favItems.find((m) => m.name === 'Louvor com letra');
    if (com) com.lyrics = [{ time: 0, text: 'Primeira estrofe' }];
    if (!hymnSearchPopupEl.classList.contains('open')) openHymnSearch(false);
    const folha = hymnSearchPopupEl.querySelector('.popup-sheet');
    for (let v = 0; v < 8 && folha; v++) {
      const anims = folha.getAnimations ? folha.getAnimations() : [];
      if (!anims.length) break;
      await Promise.all(anims.map((a) => a.finished.catch(() => {})));
    }
    favAberto = true;
    renderSearchResults('');
  });
  await pg.evaluate(async (nomes) => {
    for (const n of nomes) {
      await AVDB.addMedia(new Blob([new Uint8Array(8)], { type: 'audio/mpeg' }), { name: n, kind: 'audio', list: 'favs' });
    }
  }, NOMES);
  await abrirSecao();
  const linhas = '#hymnResults [data-fav-corpo] .fav-itens > .lib-item';
  if (!await esperar(pg, (s) => document.querySelectorAll(s).length === 4, linhas)) throw new Error('sem 4 favoritos');
  // O acervo se redesenha sozinho logo depois de aberto (varredura de coleções): espera
  // a seção ASSENTAR, senão o primeiro toque acerta um nó que já saiu do documento.
  await espera(1800);

  // A medida que o oráculo usa em A e em E: o `⋮` está na LINHA (filho da `.row`, não da
  // gaveta), à vista, na altura do nome e à direita dele, dentro da tela.
  const MEDIR_MAIS = `(li) => {
    const row = li.querySelector(':scope > .row');
    const mais = row && row.querySelector(':scope > .row-mais');
    const nome = row && row.querySelector('.row-name');
    if (!mais || !nome) return { naLinha: false };
    const m = mais.getBoundingClientRect(); const n = nome.getBoundingClientRect(); const r = row.getBoundingClientRect();
    return {
      naLinha: true,
      visivel: m.width > 0 && m.height > 0 && getComputedStyle(mais).visibility === 'visible',
      mesmaLinha: Math.abs((m.top + m.height / 2) - (n.top + n.height / 2)) <= r.height / 2,
      aDireitaDoNome: m.left >= n.right - 0.5,
      quadrado: Math.abs(m.width - m.height) <= 0.5 && m.width >= 34,
      naTela: m.right <= innerWidth + 0.5 && m.left >= 0,
    };
  }`;

  // ── A. O `⋮` NA LINHA, COM A GAVETA FECHADA ──────────────────────────────
  const a = await pg.evaluate(({ linhas, MEDIR_MAIS }) => {
    const medir = eval(MEDIR_MAIS);
    const lis = [...document.querySelectorAll(linhas)];
    return {
      total: lis.length,
      medidas: lis.map((li) => medir(li)),
      algumaGavetaAberta: lis.some((li) => li.classList.contains('expanded')),
      duplicado: document.querySelectorAll('#hymnResults .dest-opcoes, #hymnResults .fav-acoes').length,
      maisPorLinha: lis.map((li) => li.querySelectorAll('.row-mais').length),
    };
  }, { linhas, MEDIR_MAIS });
  checar(a.total === 4 && a.medidas.every((m) => m.naLinha && m.visivel && m.mesmaLinha && m.aDireitaDoNome && m.quadrado && m.naTela),
    'A · 360×1,25× · com a gaveta FECHADA cada favorito tem o `⋮` quadrado, à vista, na altura do nome e à direita dele', a.medidas);
  checar(!a.algumaGavetaAberta && a.duplicado === 0 && a.maisPorLinha.every((n) => n === 1),
    'A · e há UM `⋮` por linha — nenhum `.dest-opcoes`/`.fav-acoes` sobrou na gaveta', a);

  // ── B. TOCAR NO `⋮` ABRE A FAIXA, SEM ABRIR A GAVETA ─────────────────────
  const tocar = async (seletor, nth = 0) => {
    const loc = pg.locator(seletor).nth(nth);
    // No MEIO da janela: o cabeçalho da seção é `sticky` e cobre o topo da rolagem.
    await loc.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await espera(60);
    const b = await loc.boundingBox();
    await pg.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    await espera(260);
  };
  const estado = (i) => pg.evaluate(({ linhas, i }) => {
    const li = document.querySelectorAll(linhas)[i];
    const faixa = li.querySelector(':scope > .row > .row-acoes');
    const cs = faixa && getComputedStyle(faixa);
    const gaveta = li.querySelector(':scope > .hymn-gaveta');
    return {
      acoesAbertas: li.classList.contains('acoes-abertas'),
      gavetaAberta: li.classList.contains('expanded'),
      gavetaAltura: gaveta ? Math.round(gaveta.getBoundingClientRect().height) : -1,
      faixaVisivel: !!faixa && faixa.offsetWidth > 0 && cs.visibility === 'visible' && Number(cs.opacity) > 0.9,
      botoes: faixa ? [...faixa.querySelectorAll('.row-btn')].map((b) => (b.className.match(/row-(excluir|renomear|ordem)/) || [''])[0]) : [],
      seguraRedesenho: interacaoAbertaNoAcervo(),
      // A faixa tem de ser OPACA: o nome não pode aparecer por trás dos botões.
      faixaOpaca: !!faixa && /rgb\(|rgba\((?!.*, ?0\))/.test(cs.backgroundColor + cs.backgroundImage),
      maisLigado: !!li.querySelector(':scope > .row > .row-mais') && li.classList.contains('acoes-abertas'),
    };
  }, { linhas, i });
  await tocar(linhas + ' >> .row-mais', 1);
  const b1 = await estado(1);
  checar(b1.acoesAbertas && !b1.gavetaAberta && b1.gavetaAltura === 0 && b1.faixaVisivel
    && b1.botoes.join(',') === 'row-excluir,row-renomear',
    'B · tocar no `⋮` abre a faixa (excluir · renomear, sem ↑↓) por cima da linha, SEM abrir a gaveta', b1);
  checar(b1.seguraRedesenho,
    'B · e a faixa aberta SEGURA o redesenho do acervo (`interacaoAbertaNoAcervo`)', b1);
  checar(b1.faixaOpaca,
    'B · e a faixa é opaca (o nome não aparece atrás dos botões)', b1);
  await tocar(linhas + ' >> .row-mais', 2);
  const b2 = [await estado(1), await estado(2)];
  checar(!b2[0].acoesAbertas && b2[1].acoesAbertas && !b2[1].gavetaAberta,
    'B · o `⋮` de outra linha fecha a faixa da primeira (uma por vez)', b2);
  await tocar(linhas + ' >> .row-mais', 2);
  const b3 = await estado(2);
  checar(!b3.acoesAbertas && !b3.seguraRedesenho,
    'B · o `⋮` aceso fecha a faixa — e o acervo volta a poder redesenhar', b3);
  await tocar(linhas + ' >> .row-text', 3);
  const b4 = await estado(3);
  checar(b4.gavetaAberta && !b4.acoesAbertas && b4.gavetaAltura > 0,
    'B · tocar no corpo da linha continua abrindo a gaveta de play', b4);
  const b5 = await pg.evaluate(({ linhas }) => {
    const li = document.querySelectorAll(linhas)[3];
    return [...li.querySelectorAll('.dest-botoes > *')].filter((b) => b.offsetWidth > 0).length;
  }, { linhas });
  await tocar(linhas + ' >> .row-mais', 3);
  const b6 = await estado(3);
  checar(b6.gavetaAberta && b6.acoesAbertas && b6.faixaVisivel,
    'B · com a gaveta ABERTA o `⋮` da linha abre a faixa por cima, e a gaveta fica', b6);
  const b7 = await pg.evaluate(({ linhas }) => {
    const li = document.querySelectorAll(linhas)[3];
    return [...li.querySelectorAll('.dest-botoes > *')].filter((b) => b.offsetWidth > 0).length;
  }, { linhas });
  checar(b5 > 0 && b7 === b5, 'B · e os destinos da gaveta continuam à vista com a faixa aberta', { b5, b7 });
  await tocar(linhas + ' >> .row-mais', 3);

  // ── C. AS AÇÕES ─────────────────────────────────────────────────────────
  // C1. "Ver a letra" — só no registro com letra, e abre a leitura.
  await tocar(linhas + ' >> .row-text', 0);
  const c1 = await pg.evaluate(({ linhas }) => {
    const lis = [...document.querySelectorAll(linhas)];
    const tem = (li) => !!li.querySelector('.hymn-gaveta .dest-largo');
    return { comLetra: tem(lis[0]), semLetra: tem(lis[1]) };
  }, { linhas });
  checar(c1.comLetra && !c1.semLetra,
    'C · "Ver a letra" só existe no registro com letra', c1);
  await pg.locator(linhas + ' >> nth=0 >> .dest-largo').tap();
  const abriuLetra = await esperar(pg, () => document.getElementById('lyricsPopup').classList.contains('open'));
  checar(abriuLetra === true, 'C · e "Ver a letra" abre a leitura do item', porque(abriuLetra));
  await pg.evaluate(() => { document.getElementById('lyricsPopup').classList.remove('open'); });
  await tocar(linhas + ' >> .row-text', 0);   // fecha a gaveta

  // C2. Excluir: a pergunta nasce na faixa; Cancelar não exclui.
  await tocar(linhas + ' >> .row-mais', 3);
  await pg.locator(linhas + ' >> nth=3 >> .row-excluir').tap();
  await espera(250);
  const c2 = await pg.evaluate(({ linhas }) => {
    const li = document.querySelectorAll(linhas)[3];
    const par = [...li.querySelectorAll(':scope > .row > .row-acoes .linha-confirma-btn')];
    return { par: par.map((b) => b.textContent.trim()), visiveis: par.every((b) => b.offsetWidth > 0),
      lixeira: !!li.querySelector(':scope > .row > .row-slot--del'), gaveta: li.classList.contains('expanded') };
  }, { linhas });
  checar(c2.par.join(',') === 'Cancelar,Excluir' && c2.visiveis && !c2.gaveta,
    'C · excluir pergunta NA FAIXA da linha (Cancelar · Excluir), sem gaveta', c2);
  await pg.locator(linhas + ' >> nth=3 >> .linha-nao').tap();
  await espera(250);
  const c3 = await pg.evaluate(async () => ({ ids: (await AVDB.listItems('favs')).map((m) => m.name) }));
  checar(c3.ids.length === 4, 'C · Cancelar não exclui nada', c3);

  // C3. Renomear (a faixa da linha 1 abre pelo `⋮` dela; a da linha 3 fecha sozinha).
  await tocar(linhas + ' >> .row-mais', 1);
  await pg.locator(linhas + ' >> nth=1 >> .row-renomear').tap();
  await espera(250);
  const campo = pg.locator(linhas + ' >> nth=1 >> .linha-renome-campo');
  checar(await campo.count() === 1, 'C · renomear abre o campo NA FAIXA da linha');
  await campo.fill('Segundo renomeado');
  await pg.locator(linhas + ' >> nth=1 >> .row-slot--ok').tap();
  const renomeou = await esperar(pg, () => favItems.some((m) => m.name === 'Segundo renomeado'));
  checar(renomeou === true, 'C · e o nome novo é gravado e aparece na lista de favoritos', porque(renomeou));
  await pg.evaluate(() => fecharAcoesDaLinha());

  // C4. Excluir de verdade.
  await tocar(linhas + ' >> .row-mais', 3);
  await pg.locator(linhas + ' >> nth=3 >> .row-excluir').tap();
  await espera(250);
  await pg.locator(linhas + ' >> nth=3 >> .linha-sim').tap();
  const excluiu = await esperar(pg, (s) => document.querySelectorAll(s).length === 3, linhas);
  const c4 = await pg.evaluate(async () => (await AVDB.listItems('favs')).map((m) => m.name));
  checar(excluiu === true && !c4.includes('Quarto') && c4.length === 3,
    'C · Excluir tira o item dos favoritos (e a lista se redesenha)', { c4, p: porque(excluiu) });

  // ── D. REORDENAR: SEGURAR E ARRASTAR ─────────────────────────────────────
  // Três favoritos: [Louvor com letra, Segundo renomeado, Terceiro].
  const ordemDb = () => pg.evaluate(async () => (await AVDB.listItems('favs')).map((m) => m.name));
  const ordemTela = () => pg.evaluate((s) => [...document.querySelectorAll(s)].map((li) => li.querySelector('.row-name').textContent), linhas);
  const centro = async (nth) => {
    const loc = pg.locator(linhas + ' >> .row-text').nth(nth);
    const b = await loc.boundingBox();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  const arrastar = async (de, para, abaixo) => {
    // Rola UMA vez, para o item do MEIO ficar no centro: as coordenadas dos dois
    // extremos são lidas depois, na mesma rolagem.
    await pg.locator(linhas + ' >> .row-text').nth(1).evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await espera(80);
    const o = await centro(de);
    const d = await centro(para);
    await pg.mouse.move(o.x, o.y);
    await pg.mouse.down();
    await espera(650);                                  // bem além do LONGPRESS (450 ms)
    const alvoY = d.y + (abaixo ? 30 : -30);
    const passos = 12;
    for (let i = 1; i <= passos; i++) {
      await pg.mouse.move(o.x, o.y + ((alvoY - o.y) * i) / passos);
      await espera(16);
    }
    const emArrasto = await pg.evaluate(() => !!document.querySelector('.fav-itens > .lib-item.arrastando'));
    await pg.mouse.up();
    return emArrasto;
  };
  const emArrasto = await arrastar(0, 2, true);
  checar(emArrasto, 'D · segurar a linha de um favorito LEVANTA o item (a marca `.arrastando`)');
  const mudou = await esperar(pg, () => favItems.map((m) => m.name).join('|') === 'Segundo renomeado|Terceiro|Louvor com letra');
  checar(mudou === true, 'D · soltar no fim muda a ordem gravada (Louvor com letra vai para o fim)',
    porque(mudou) || await ordemDb());
  await espera(400);
  const d1 = { db: await ordemDb(), tela: await ordemTela() };
  checar(d1.db.join('|') === d1.tela.join('|') && d1.tela[2] === 'Louvor com letra',
    'D · e a tela redesenhada bate com o banco', d1);
  const d2 = await pg.evaluate(() => ({
    gavetas: document.querySelectorAll('#hymnResults .lib-item.expanded:not(.folder-opfs)').length,
    levantado: document.querySelectorAll('.fav-itens > .lib-item.arrastando').length,
    pasta: (() => {
      const p = document.querySelector('#hymnResults [data-fav-corpo] > .folder-opfs');
      const pl = document.querySelector('#hymnResults [data-fav-corpo] > .fav-itens');
      return !!p && !!pl && !!(p.compareDocumentPosition(pl) & Node.DOCUMENT_POSITION_FOLLOWING);
    })(),
    transformsPresos: [...document.querySelectorAll('.fav-itens > .lib-item')].filter((l) => l.style.transform).length,
    listaMarcada: !!document.querySelector('.fav-itens.arrastando-lista'),
  }));
  checar(d2.gavetas === 0 && d2.levantado === 0 && d2.transformsPresos === 0 && !d2.listaMarcada,
    'D · soltar NÃO abre a gaveta do item e não deixa marca nem deslocamento para trás', d2);
  checar(d2.pasta, 'D · a pasta do aparelho continua ANTES da placa dos favoritos (fora do arrasto)', d2);

  // Para CIMA: o último (Louvor com letra) vai ao topo.
  await arrastar(2, 0, false);
  const subiu = await esperar(pg, () => favItems.map((m) => m.name).join('|') === 'Louvor com letra|Segundo renomeado|Terceiro');
  checar(subiu === true, 'D · arrastar para CIMA também reordena', porque(subiu) || await ordemDb());
  await espera(400);

  // Toque longo SEM mover: nada muda e a gaveta não abre.
  const antesLongo = await ordemDb();
  const p = await centro(1);
  await pg.mouse.move(p.x, p.y); await pg.mouse.down(); await espera(700); await pg.mouse.up();
  await espera(400);
  const longo = { ordem: await ordemDb(), gavetas: await pg.evaluate(() => document.querySelectorAll('#hymnResults .lib-item.expanded:not(.folder-opfs)').length) };
  checar(longo.ordem.join('|') === antesLongo.join('|') && longo.gavetas === 0,
    'D · segurar sem mover não muda a ordem nem abre a gaveta', longo);

  // Um arrasto do MEIO para o fim e a PERSISTÊNCIA depois de recarregar a página.
  await arrastar(1, 2, true);
  await esperar(pg, () => favItems.map((m) => m.name).join('|') === 'Louvor com letra|Terceiro|Segundo renomeado');
  await espera(300);
  const ordemFinal = await ordemDb();
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await esperarCortina(pg);
  await pg.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function' && !!document.querySelector('.lib-bar'), null, { timeout: 30000 });
  await abrirSecao();
  await esperar(pg, (s) => document.querySelectorAll(s).length === 3, linhas);
  await espera(1800);
  const depoisReload = await ordemTela();
  checar(ordemFinal.join('|') === 'Louvor com letra|Terceiro|Segundo renomeado' && depoisReload.join('|') === ordemFinal.join('|'),
    'D · a ordem PERSISTE: recarregada a página, a lista volta na ordem arrastada', { ordemFinal, depoisReload });

  // ── E. O ORÁCULO REPROVA O DESENHO ANTIGO ────────────────────────────────
  // Uma linha montada como a de antes (o `⋮` só dentro da gaveta, ligado a ela) tem de dar
  // FALSO na medida de A — senão a medida não distingue nada.
  const e = await pg.evaluate(({ MEDIR_MAIS }) => {
    const medir = eval(MEDIR_MAIS);
    const li = document.createElement('li');
    li.className = 'lib-item';
    li.innerHTML = '<div class="row"><div class="thumb"></div><div class="row-text"><span class="row-name">Antigo</span></div></div>'
      + '<div class="hymn-gaveta"><ul class="hymn-opcoes"><div class="dest-botoes"><button class="dest-btn dest-opcoes">⋮</button></div></ul></div>';
    document.getElementById('hymnResults').appendChild(li);
    const r = medir(li);
    li.remove();
    return r;
  }, { MEDIR_MAIS });
  checar(e.naLinha === false, 'E · a medida do oráculo reprova uma linha cujo `⋮` só existe na gaveta', e);

  checar(erros.length === 0, 'nenhum erro de página durante o percurso', erros);
  await ctx.close();
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
