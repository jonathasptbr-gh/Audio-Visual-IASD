// ============================================================================
// O IMPORTAR É O PRIMEIRO BLOCO DA BIBLIOTECA (v1.14.40)
// ============================================================================
//
// Pedido do operador: *"mover a opção de importar arquivo da barra de topo do app
// para dentro da biblioteca. Será o primeiro item da biblioteca … Isso vai valer
// também para o modo simples, mas lá … 'buscar na galeria' ou algo do tipo"*.
//
//  A. AVANÇADO: o `#cronoImportar` não existe; o primeiro filho do acervo é o
//     `li.lib-importar` ("Importar arquivo", a folha com o +), com a ALTURA dos
//     blocos fechados (a tampa); responde por luz; o toque abre o seletor do
//     navegador (múltiplo) SEM fechar a Biblioteca, e o arquivo escolhido entra no
//     Cronograma com a Biblioteca fechada. No app, o seletor do SISTEMA, com PDF.
//  B. MODO FÁCIL: o primeiro filho é "Buscar na galeria" (a foto), e o arquivo
//     escolhido NÃO entra no Cronograma — vai à prateleira avulsa e à cena. É a
//     reversão do defeito da v1.14.30 (o `escolherDestinos` devolve `null` no Modo
//     Fácil e o `importShare` desistia de tudo).
//
// REVERSÕES: tirar o `alvo.appendChild(blocoImportar())` reprova A e B; tirar o
// `!simplificado() &&` do `importShare` reprova B (nada chega à prateleira).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import {
  servirEstatico, abrirNavegador, esperarCortina, esperar, esperarDb, porque, checar, falhas,
} from './arnes.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port + '/controle/index.html';
const navegador = await abrirNavegador();

// Um PNG de 1×1 de verdade: a miniatura é desenhada a partir dele.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

// O mínimo de acervo para haver blocos fechados ao lado (o mesmo de `tour.test.mjs`).
const FIXTURE = `(() => {
  collState['hymnal-2022'] = { indexSyncedAt: Date.now(), songs: [{ track: 533, name: 'Hino de abertura (teste)' }, { track: 572, name: 'Hino do ofertório (teste)' }] };
  albumCatalog = { categories: [{ id_category: 1, name: 'Louvores', order: 1, albums: [{ id_album: 7, subtitle: '', order: 1 }] }], albums: [{ id_album: 7, name: 'Álbum de Teste', color: null }] };
  collState['album-7'] = { indexSyncedAt: 0, songs: [] };
  renderCollectionsNow();
})()`;

async function abrir(modo) {
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 860 }, hasTouch: true });
  await semRedeExterna(ctx);
  // O TOUR JÁ VISTO: o balão automático cobriria o bloco que se vai tocar.
  await ctx.addInitScript(() => localStorage.setItem("av.tour", JSON.stringify({ conexao: 1, simples: 1, tocando: 1, avancado: 1 })));
  const pg = await ctx.newPage();
  const erros = [];
  pg.on('pageerror', (e) => erros.push(String(e.message)));
  await pg.goto(base, { waitUntil: 'load' });
  await esperarCortina(pg);
  // No Modo Fácil, DESTRAVADO (tocar neste celular): sem tela a cortina cobre a Biblioteca.
  await pg.evaluate(async (m) => {
    setAppMode(m);
    if (m === "simple") { setTocarNoCelular(true); renderSimpleGate(); }
    await new Promise((f) => setTimeout(f, 300));
  }, modo);
  await pg.evaluate(FIXTURE);
  return { ctx, pg, erros };
}

const primeiro = (pg) => pg.evaluate(() => {
  const el = document.querySelector('#hymnResults.acervo > :first-child');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const lista = document.getElementById('hymnResults').getBoundingClientRect();
  const fechado = [...document.querySelectorAll('#hymnResults.acervo > .coll-group--drop:not(.aberto), #hymnResults.acervo > .hymnal-card:not(.expanded)')][0];
  const use = el.querySelector('use');
  return {
    classe: el.className, papel: el.getAttribute('role'), rotulo: el.getAttribute('aria-label'),
    nome: (el.querySelector('.coll-bar-name') || {}).textContent || '',
    ico: use ? use.getAttribute('href') : null,
    h: +r.height.toFixed(1), hFechado: fechado ? +fechado.getBoundingClientRect().height.toFixed(1) : null,
    fundo: getComputedStyle(el).backgroundColor,
    fundoFechado: fechado ? getComputedStyle(fechado).backgroundColor : null,
    aVista: r.top >= lista.top - 1 && r.bottom <= lista.bottom + 1,
    barraVelha: !!document.getElementById('cronoImportar') || !!document.querySelector('.list-header .crono-importar'),
  };
});

try {
  // =========================================================================
  // A · AVANÇADO: "Importar arquivo", primeiro bloco, abre o seletor
  // =========================================================================
  {
    const a = await abrir('full');
    await a.pg.evaluate(() => openHymnSearch(false));
    const pronto = await esperar(a.pg, () => document.getElementById('hymnSearchPopup').classList.contains('open')
      && !!document.querySelector('#hymnResults.acervo > .lib-importar')
      && !!document.querySelector('#hymnResults.acervo > .coll-group--drop:not(.aberto)'), null, 5000);
    await a.pg.waitForTimeout(500);   // a tampa assenta
    const r = await primeiro(a.pg);
    checar(pronto === true && !!r && r.barraVelha === false,
      'A · o IMPORTAR saiu da barra do topo (nenhum `#cronoImportar`)', porque(pronto) + ' ' + JSON.stringify(r));
    checar(!!r && /\blib-importar\b/.test(r.classe) && r.nome === 'Importar arquivo' && r.ico === '#icoArquivoMais'
      && r.papel === 'button' && r.rotulo === 'Importar arquivo',
      'A · o PRIMEIRO bloco da Biblioteca é "Importar arquivo", com a folha com o + e papel de botão', JSON.stringify(r));
    checar(!!r && r.hFechado !== null && Math.abs(r.h - r.hFechado) <= 1 && r.fundo === r.fundoFechado,
      'A · e ele tem a ALTURA e o FUNDO de um bloco fechado da raiz (a tampa e o poço)', JSON.stringify(r));
    const luz = await a.pg.evaluate(() => {
      const el = document.querySelector('#hymnResults > .lib-importar');
      for (const folha of document.styleSheets) {
        let regras; try { regras = folha.cssRules; } catch (_) { continue; }
        for (const reg of regras) {
          if (!reg.selectorText || !/:active/.test(reg.selectorText) || !/--press-luz/.test(reg.style.filter || '')) continue;
          try { if (el.matches(reg.selectorText.replace(/:active/g, ''))) return true; } catch (_) {}
        }
      }
      return false;
    });
    checar(luz === true, 'A · e ele responde ao toque por LUZ (`--press-luz` no `:active`), como o card', String(luz));

    const [escolha] = await Promise.all([
      a.pg.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null),
      a.pg.click('#hymnResults > .lib-importar'),
    ]);
    const abertaAinda = await a.pg.evaluate(() => document.getElementById('hymnSearchPopup').classList.contains('open'));
    checar(!!escolha && escolha.isMultiple() && abertaAinda,
      'A · o toque abre o seletor do navegador (vários de uma vez), e a Biblioteca fica aberta enquanto se escolhe',
      JSON.stringify({ escolha: !!escolha, abertaAinda }));
    if (escolha) await escolha.setFiles({ name: 'Foto do culto.png', mimeType: 'image/png', buffer: PNG });
    const entrou = await esperarDb(a.pg, async () => (await AVDB.listIds('imports')).length === 1
      && !document.getElementById('hymnSearchPopup').classList.contains('open'), null, 8000);
    checar(entrou === true,
      'A · o arquivo escolhido entra no Cronograma, e a Biblioteca sai da frente para mostrá-lo', porque(entrou));

    const nativo = await a.pg.evaluate(async () => {
      openHymnSearch(false);
      await new Promise((f) => setTimeout(f, 400));
      const antes = [window.__NATIVE__, window.AVNative];
      let pediu = null;
      window.__NATIVE__ = true;
      window.AVNative = { pickDoc: async (mimes) => { pediu = mimes; return []; } };
      try { document.querySelector('#hymnResults > .lib-importar').click(); await new Promise((f) => setTimeout(f, 50)); }
      finally { [window.__NATIVE__, window.AVNative] = antes; }
      return pediu;
    });
    checar(typeof nativo === 'string' && /application\/pdf/.test(nativo),
      'A · no app, o toque abre o seletor do SISTEMA (`AVNative.pickDoc`), o único que serve ao PDF', String(nativo));
    checar(a.erros.length === 0, 'A · nenhum erro de página', a.erros.join(' | '));
    await a.ctx.close();
  }

  // =========================================================================
  // B · MODO FÁCIL: "Buscar na galeria", e o arquivo vai à cena
  // =========================================================================
  {
    const a = await abrir('simple');
    const pronto = await esperar(a.pg, () => !!document.querySelector('#hymnResults.acervo > .lib-importar'), null, 5000);
    await a.pg.waitForTimeout(500);
    const r = await primeiro(a.pg);
    checar(pronto === true && !!r && /\blib-importar\b/.test(r.classe) && r.nome === 'Buscar na galeria'
      && r.ico === '#icoGaleria' && r.aVista,
      'B · no Modo Fácil o PRIMEIRO bloco da Biblioteca é "Buscar na galeria", com a foto, à vista sem rolar',
      porque(pronto) + ' ' + JSON.stringify(r));
    const [escolha] = await Promise.all([
      a.pg.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null),
      a.pg.click('#hymnResults > .lib-importar'),
    ]);
    checar(!!escolha, 'B · o toque abre o seletor de arquivos', String(!!escolha));
    if (escolha) await escolha.setFiles({ name: 'Foto da galeria.png', mimeType: 'image/png', buffer: PNG });
    // A prateleira é gravada ANTES da cena (`fixarAvulso`, depois `focarImportado`): espera-se pelas duas.
    const chegou = await esperarDb(a.pg, async () => (await AVDB.listIds('avulsos')).length === 1
      && typeof currentId !== 'undefined' && !!currentId, null, 8000);
    const listas = await a.pg.evaluate(async () => ({
      imports: (await AVDB.listIds('imports')).length,
      avulsos: await AVDB.listIds('avulsos'),
      cena: typeof currentId === 'undefined' ? null : currentId,
    }));
    checar(chegou === true && listas.imports === 0,
      'B · o arquivo NÃO entra no Cronograma: vai à prateleira avulsa (a reversão do defeito da v1.14.30, em que '
      + 'o Modo Fácil não importava nada)', porque(chegou) + ' ' + JSON.stringify(listas));
    checar(!!listas.cena && listas.avulsos.includes(listas.cena),
      'B · e é ELE que vai à cena — o Modo Fácil importa para mostrar', JSON.stringify(listas));
    checar(a.erros.length === 0, 'B · nenhum erro de página', a.erros.join(' | '));
    await a.ctx.close();
  }
} finally {
  await navegador.close();
  servidor.close();
}

console.log(falhas.length ? '\n' + falhas.length + ' falha(s).' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
