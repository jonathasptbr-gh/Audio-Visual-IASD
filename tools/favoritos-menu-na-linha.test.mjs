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
// ESPERA A TELA ASSENTAR POR FATO (v1.13.69), não por tempo: o acervo se redesenha sozinho depois
// de aberto, e em máquina lenta isso cai no meio dos gestos. Quieta = `#hymnResults` sem mutação
// por 1,2 s de relógio do PRÓPRIO app (a máquina lenta alonga o relógio inteiro).
const aquietar = (pg) => pg.evaluate(() => new Promise((ok) => {
  let t = setTimeout(fim, 1200);
  const mo = new MutationObserver(() => { clearTimeout(t); t = setTimeout(fim, 1200); });
  mo.observe(document.getElementById('hymnResults'), { childList: true, subtree: true, attributes: true });
  const teto = setTimeout(fim, 90000);
  function fim() { mo.disconnect(); clearTimeout(t); clearTimeout(teto); ok(true); }
}));
const COLL_ESPERA = 1200;   // > COLL_REFRESH_MS (400) com folga: o tique pendente já caiu

try {
  const ctx = await navegador.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true });
  await semRedeExterna(ctx);
  await comModoAvancado(ctx);
  const pg = await ctx.newPage();
  const erros = [];
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  // O BOOT TERMINA QUANDO A CORTINA CAI (v1.13.69): `init()` ainda roda `setAppMode` e `load()`
  // até lá, e abrir a Biblioteca antes disso a fazia ser FECHADA debaixo do teste — foi a
  // reprovação do CI (run 43106210937): `esperarCortina` devolve a FRASE do prazo (30 s) e o
  // oráculo a ignorava. Aqui o prazo é folgado e o estouro é erro, não silêncio.
  const aguardarBoot = async () => {
    const r = await esperarCortina(pg, 150000);
    if (r !== true) throw new Error('o app não terminou de abrir: ' + r);
    // A cortina também cai pelo prazo de segurança (12 s) com o `init()` ainda no meio: o fato
    // que vale é o `terminou` que ele mesmo grava na última linha (`__avSplash.pronto()`).
    await pg.waitForFunction(() => !window.__avSplash || window.__avSplash.terminou === true,
      null, { timeout: 150000 });
    await pg.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function'
      && !!document.querySelector('.lib-bar'), null, { timeout: 30000 });
  };
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await aguardarBoot();

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
  await aquietar(pg);

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

  // ── F. O `init()` TARDIO NÃO FECHA A BIBLIOTECA ABERTA (v1.13.69) ────────
  // Em aparelho lento o `init()` chega ao `setAppMode(appMode)` segundos depois de o operador
  // (ou do teste) abrir a Biblioteca. Reafirmar o modo em que já se está não pode fechá-la nem
  // zerar os Favoritos abertos (`resetarBiblioteca`). Reproduz-se aqui o que o `init()` faz.
  const f = await pg.evaluate(() => {
    setAppMode(appMode);
    return {
      aberta: hymnSearchPopupEl.classList.contains('open'),
      favAberto,
      linhas: document.querySelectorAll('#hymnResults [data-fav-corpo] .fav-itens > .lib-item').length,
    };
  });
  checar(f.aberta && f.favAberto && f.linhas === 4,
    'F · reafirmar o modo atual (o `init()` tardio) NÃO fecha a Biblioteca nem os Favoritos abertos', f);
  await espera(300);

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
  const estadoBruto = (i) => pg.evaluate(({ linhas, i }) => {
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
  // O estado ASSENTADO (v1.13.69): a faixa entra com um fade, e em máquina lenta ele passa dos
  // 260 ms do toque. Lê até duas leituras seguidas iguais (200 ms), com teto de 10 s.
  const estado = async (i) => {
    let ant = JSON.stringify(await estadoBruto(i));
    for (let k = 0; k < 50; k++) {
      await espera(200);
      const agora = JSON.stringify(await estadoBruto(i));
      if (agora === ant) break;
      ant = agora;
    }
    return JSON.parse(ant);
  };
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
  // A gaveta abre depois de um `await` (a letra sai do IndexedDB): em máquina lenta o
  // toque passa antes dela. Espera o FATO (a linha `expanded`), não um tempo (v1.13.69).
  await esperar(pg, (s) => !!document.querySelector(s + '.expanded .hymn-gaveta .dest-botoes'), linhas);
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
  // O RASTRO (v1.13.69): o bloco D reprovou DUAS vezes no CI com a lista sumindo (`tela: []`) e
  // nunca aqui, nem com a CPU 10× mais lenta. Sem reprodução local, o oráculo carrega a própria
  // prova: quem fechou, limpou ou redesenhou a Biblioteca, e onde caiu cada toque — impresso só
  // quando o bloco D reprova.
  await pg.evaluate(() => {
    window.__rastro = [];
    const t0 = performance.now();
    const anota = (txt) => { if (window.__rastro.length < 120) window.__rastro.push(Math.round(performance.now() - t0) + 'ms ' + txt); };
    const pilha = () => (new Error().stack || '').split('\n').slice(3, 7)
      .map((l) => l.trim().replace(/^at /, '').replace(/\(?https?:\/\/[^)\s]*\/([\w.-]+\.js):(\d+):\d+\)?/, '$1:$2')).join(' ← ');
    for (const nome of ['closeHymnSearch', 'resetarBiblioteca', 'redesenharFavoritosNaBiblioteca',
      'renderSearchResults', 'renderCollectionsNow', 'load']) {
      const f = window[nome];
      if (typeof f !== 'function') continue;
      window[nome] = function (...a) { anota(nome + ' ← ' + pilha()); return f.apply(this, a); };
    }
    const quem = (el) => (el && el.closest ? (el.closest('[class]') || el) : el);
    const rot = (el) => (el ? (el.tagName + '.' + String(el.className || '').trim().split(/\s+/).slice(0, 3).join('.')).slice(0, 70) : '—');
    for (const tipo of ['pointerdown', 'pointerup', 'click']) {
      document.addEventListener(tipo, (e) => anota(tipo + ' em ' + rot(quem(e.target)) + ' @' + Math.round(e.clientX) + ',' + Math.round(e.clientY)), true);
    }
    new MutationObserver(() => anota('popup ' + (hymnSearchPopupEl.classList.contains('open') ? 'aberto' : 'FECHADO')))
      .observe(hymnSearchPopupEl, { attributes: true, attributeFilter: ['class'] });
  });
  const despejarRastro = async (por) => {
    const r = await pg.evaluate((s) => {
      const fav = document.querySelector('#hymnResults .coll-group--fav');
      return { popup: hymnSearchPopupEl.classList.contains('open'), favGrupo: fav ? fav.className : null,
        linhas: document.querySelectorAll(s).length, scrollTop: hymnResultsEl.scrollTop,
        filhos: [...hymnResultsEl.children].map((c) => String(c.className).split(' ')[0]).slice(0, 8),
        rastro: window.__rastro || [] };
    }, linhas);
    console.log('RASTRO (' + por + '): ' + JSON.stringify({ ...r, rastro: undefined }));
    for (const l of r.rastro) console.log('  · ' + l);
  };
  // As linhas PARADAS: a mesma posição em três quadros seguidos (uma exclusão anterior anima a
  // placa, e uma medida no meio dela apertaria a linha errada — ou o cabeçalho do grupo).
  const linhasParadas = () => pg.evaluate((s) => new Promise((ok) => {
    let ant = ''; let iguais = 0; let n = 0;
    const passo = () => {
      const r = [...document.querySelectorAll(s)].map((li) => {
        const b = li.getBoundingClientRect(); return Math.round(b.top) + ':' + Math.round(b.height);
      }).join(',');
      if (r === ant) iguais++; else { iguais = 0; ant = r; }
      if (iguais >= 3 || ++n > 600) ok(); else requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  }), linhas);
  const arrastar = async (de, para, abaixo) => {
    // Rola UMA vez, para o item do MEIO ficar no centro: as coordenadas dos dois
    // extremos são lidas depois, na mesma rolagem — e só com a lista quieta e parada.
    await aquietar(pg);
    await pg.locator(linhas + ' >> .row-text').nth(1).evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await linhasParadas();
    const o = await centro(de);
    const d = await centro(para);
    // O PONTO DO APERTAR CAI NA LINHA CERTA? Se não, é o arnês que erra — e o rastro diz onde.
    const alvo = await pg.evaluate(([x, y, s, i]) => {
      const el = document.elementFromPoint(x, y);
      const li = el && el.closest('.lib-item');
      return { ok: !!li && [...document.querySelectorAll(s)].indexOf(li) === i,
        el: el ? (el.tagName + '.' + String(el.className || '')).slice(0, 80) : null };
    }, [o.x, o.y, linhas, de]);
    if (!alvo.ok) console.log('ARNÊS: o ponto do apertar não cai na linha ' + de + ' — ' + JSON.stringify({ o, alvo }));
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
  if (!emArrasto) await despejarRastro('o primeiro arrasto não levantou');
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

  // O MESMO, COM O TIMER ATRASADO (v1.13.69). Com a CPU apertada, o soltar pode ser tratado ANTES
  // do timer do toque longo — medido com o estrangulamento 10×: a gaveta abria. Reproduz-se sem
  // depender da sorte: o relógio do app anda 700 ms entre o apertar e o soltar, sem dar a vez a
  // timer nenhum, e o `click` vem logo atrás. Um toque longo nunca pode virar toque.
  await pg.evaluate((s) => {
    const alvo = document.querySelectorAll(s)[1].querySelector('.row-text');
    const b = alvo.getBoundingClientRect();
    const opt = { bubbles: true, cancelable: true, composed: true, pointerId: 78, pointerType: 'touch',
      isPrimary: true, button: 0, clientX: b.x + b.width / 2, clientY: b.y + b.height / 2 };
    const agora = Date.now;
    const t0 = agora();
    try {
      alvo.dispatchEvent(new PointerEvent('pointerdown', opt));
      Date.now = () => t0 + 700;
      alvo.dispatchEvent(new PointerEvent('pointerup', opt));
      alvo.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: opt.clientX, clientY: opt.clientY }));
    } finally { Date.now = agora; }
  }, linhas);
  await espera(600);   // a gaveta abre depois de um `await` — dá tempo a ela, se fosse abrir
  const atrasado = await pg.evaluate(() => document.querySelectorAll('#hymnResults .lib-item.expanded:not(.folder-opfs)').length);
  checar(atrasado === 0, 'D · toque longo com o timer atrasado (CPU lenta) também não abre a gaveta', atrasado);

  // O REDESENHO DO ACERVO NO MEIO DO SEGURAR (v1.13.69): os tiques pendentes (`setCollStatus`,
  // `refreshCollectionsIfVisible`, a reconciliação por partes, a busca) caem enquanto o dedo está
  // na linha. A lista e o arrasto sobrevivem, e o soltar ainda grava a ordem.
  {
    const antes = await ordemDb();
    const pr = await centro(0);
    await pg.mouse.move(pr.x, pr.y); await pg.mouse.down();
    await esperar(pg, () => !!document.querySelector('.fav-itens > .lib-item.arrastando'));
    await pg.evaluate(() => {
      refreshCollectionsIfVisible({ partes: true });
      refreshCollectionsIfVisible();
      renderBuscaQuandoPuder(false);
      renderCollectionsNow();                 // direto, como o `syncCollection` de um grupo que baixa
      redesenharFavoritosNaBiblioteca();      // direto, como o `load()` de uma gravação
    });
    await espera(COLL_ESPERA);
    const meio = await pg.evaluate(() => ({
      marca: document.querySelectorAll('.fav-itens > .lib-item.arrastando').length,
      linhas: document.querySelectorAll('#hymnResults [data-fav-corpo] .fav-itens > .lib-item').length,
      aberta: hymnSearchPopupEl.classList.contains('open'),
    }));
    await pg.mouse.up();
    await espera(400);
    checar(meio.marca === 1 && meio.linhas === 3 && meio.aberta && (await ordemDb()).join('|') === antes.join('|'),
      'D · um redesenho do acervo NO MEIO do segurar não derruba a linha levantada nem a lista', meio);
    const depois = await pg.evaluate((s) => ({ n: document.querySelectorAll(s).length, marcas: document.querySelectorAll('.fav-itens.arrastando-lista, .fav-itens > .lib-item.arrastando').length }), linhas);
    checar(depois.n === 3 && depois.marcas === 0, 'D · e depois do soltar a lista está inteira e sem marca', depois);
  }

  // O ARRASTO ÓRFÃO NÃO FICA PRESO (v1.13.69). Se a linha levantada sai do documento por um
  // redesenho que ninguém guardou, o `pointerup` cai na linha NOVA e `terminarArrasto` nunca
  // roda: `arrasto` ficava não-nulo para sempre (rolagem por toque cancelada, nenhum arrasto
  // novo). Simula-se o remonte sem guarda (o corpo de `redesenharFavoritosNaBiblioteca`).
  {
    const pr = await centro(1);
    await pg.mouse.move(pr.x, pr.y); await pg.mouse.down();
    await esperar(pg, () => !!document.querySelector('.fav-itens > .lib-item.arrastando'));
    await pg.evaluate(() => {
      const corpo = document.querySelector('[data-fav-corpo]');
      corpo.innerHTML = '';
      favHost = corpo;
      try { comBaldeDeMiniaturas('fav-biblioteca', renderFolderList); } finally { favHost = null; }
    });
    await pg.mouse.up();
    await espera(300);
    const g = await pg.evaluate(() => {
      const ev = new Event('touchmove', { bubbles: true, cancelable: true });
      document.body.dispatchEvent(ev);
      return {
        arrastoNulo: arrasto === null,
        rolagemLivre: ev.defaultPrevented === false,
        marcas: document.querySelectorAll('.arrastando, .arrastando-lista, .segurando').length,
        gavetas: document.querySelectorAll('#hymnResults .lib-item.expanded:not(.folder-opfs)').length,
      };
    });
    checar(g.arrastoNulo && g.rolagemLivre && g.marcas === 0 && g.gavetas === 0,
      'D · a linha levantada que SAI do documento no meio do gesto não deixa o arrasto preso (rolagem livre, sem marca)', g);
    await esperar(pg, (s) => document.querySelectorAll(s).length === 3, linhas);
    const antesNovo = await ordemDb();
    await arrastar(0, 2, true);
    const gravou = await esperar(pg, (a) => favItems.map((m) => m.name).join('|') !== a, antesNovo.join('|'));
    checar(gravou === true, 'D · e um arrasto NOVO depois do órfão funciona e grava a ordem', porque(gravou) || await ordemDb());
    await espera(400);
  }

  // O SOLTAR FORA DA LINHA (v1.13.69, `largarPonteiro`). O mouse aperta numa linha e SAI dela
  // de um salto, antes do primeiro `pointermove` dela (sem captura antes do toque longo, o
  // resto do gesto vai para outro elemento), e solta lá fora. Sem a rede, a marca `segurando`
  // ficava presa — segurando o redesenho do acervo para sempre — e o toque longo pendente
  // levantava o item com o botão já solto, num `arrasto` que nunca termina.
  {
    const antesFora = await ordemDb();
    // Eventos SINTÉTICOS, e de propósito: o Chromium do Playwright entrega o soltar real à linha
    // mesmo fora dela, e o caso não se reproduziria. Despachados à mão, o apertar vai à linha e o
    // soltar ao `body` — exatamente o "soltar sem dono" que a rede tem de pegar.
    await pg.evaluate((s) => {
      const alvo = document.querySelector(s + ' .row-text');
      const b = alvo.getBoundingClientRect();
      const opt = { bubbles: true, cancelable: true, composed: true, pointerId: 77, pointerType: 'touch',
        isPrimary: true, button: 0, clientX: b.x + b.width / 2, clientY: b.y + b.height / 2 };
      alvo.dispatchEvent(new PointerEvent('pointerdown', opt));
      document.body.dispatchEvent(new PointerEvent('pointerup', { ...opt, clientY: 4 }));
    }, linhas);
    await espera(800);                              // além do toque longo (450 ms)
    const f = await pg.evaluate(() => ({
      arrastoNulo: arrasto === null,
      segurando: document.querySelectorAll('.segurando, .arrastando, .arrastando-lista').length,
      guarda: interacaoAbertaNoAcervo(),
    }));
    checar(f.arrastoNulo && f.segurando === 0 && !f.guarda && (await ordemDb()).join('|') === antesFora.join('|'),
      'D · soltar FORA da linha não deixa marca presa, nem arrasto tardio, nem o guarda do acervo ligado', f);
  }

  // Um arrasto do MEIO para o fim e a PERSISTÊNCIA depois de recarregar a página.
  const ordemAntesDoFim = await ordemDb();   // (o arrasto órfão acima mexeu na ordem de partida)
  const esperada = [ordemAntesDoFim[0], ordemAntesDoFim[2], ordemAntesDoFim[1]].join('|');
  await arrastar(1, 2, true);
  await esperar(pg, (e) => favItems.map((m) => m.name).join('|') === e, esperada);
  await espera(300);
  const ordemFinal = await ordemDb();
  await pg.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  await aguardarBoot();
  await abrirSecao();
  await esperar(pg, (s) => document.querySelectorAll(s).length === 3, linhas);
  await aquietar(pg);
  const depoisReload = await ordemTela();
  checar(ordemFinal.join('|') === esperada && depoisReload.join('|') === ordemFinal.join('|'),
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
