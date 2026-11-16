// ============================================================================
// O IMPORTAR É UM BOTÃO NO FIM DA BIBLIOTECA, E A FOLHA DELE É A DO LINK (v1.14.40 → v1.14.42)
// ============================================================================
//
// Pedidos do operador: *"mover a opção de importar arquivo da barra de topo do app para dentro da
// biblioteca … também para o modo simples … 'buscar na galeria'"* (v1.14.40); e *"uma cor e design
// de botão e não de uma coleção"*, *"que ele fique no fim da lista"*, e a folha do importar igual à
// do que se recebe por compartilhamento, *"com thumbnail, título, duração ou tipo de arquivo. E as
// opções de play … completas"* (v1.14.42).
//
//  A. AVANÇADO: nenhum `#cronoImportar`; o ÚLTIMO filho do acervo é `li.lib-importar.bloco-fixo`
//     com um `<button>` "Importar arquivo" (`#icoArquivoMais`) no par de ação (`--btn-accent`) e
//     no `--press`; o toque abre o seletor do navegador (múltiplo) com a Biblioteca aberta. Escolhido
//     o arquivo, abre a folha "Importar" com a OFERTA (capa = a própria foto, o nome, "Foto · …") e a
//     fileira Tocar agora · Cronograma · Playlist · Favoritos; Cronograma o põe na lista; numa segunda
//     vez, Tocar agora o leva à prateleira avulsa e à CENA, sem tocar no Cronograma. No app, o
//     seletor do SISTEMA, com PDF.
//  B. MODO FÁCIL: o último filho é "Buscar na galeria" (`#icoGaleria`); o arquivo NÃO entra no
//     Cronograma e não há folha — vai à prateleira avulsa e à cena (a reversão do defeito da
//     v1.14.30).
//
// REVERSÕES: tirar o `alvo.appendChild(blocoImportar())` reprova A e B; tirar o
// `!simplificado() &&` do `importShare` reprova B; voltar ao `escolherDestinos` reprova a oferta.
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
  await semTour(pg);
  await pg.evaluate(FIXTURE);
  return { ctx, pg, erros };
}

// O TOUR DA BIBLIOTECA abre sozinho e o balão dele intercepta o toque no botão (medido: `#tour`
// `data-tour="s.biblioteca"`). Desarmar pelo próprio `AVTour` é o que o operador faria com "Pular".
const semTour = (pg) => pg.evaluate(() => {
  window.AVTour.armar = () => {};
  window.AVTour.abrir = () => false;
  if (window.AVTour.aberto && AVTour.aberto()) AVTour.fechar();
});
const ultimo = (pg) => pg.evaluate(() => {
  const el = document.querySelector('#hymnResults.acervo > :last-child');
  if (!el) return null;
  const b = el.querySelector('button.lib-importar-btn');
  const use = b && b.querySelector('use');
  const sonda = document.createElement('span');
  sonda.style.background = 'var(--btn-accent)'; sonda.style.color = 'var(--accent)';
  document.body.appendChild(sonda);
  const par = [getComputedStyle(sonda).backgroundColor, getComputedStyle(sonda).color];
  sonda.remove();
  const lista = document.getElementById('hymnResults');
  lista.scrollTop = lista.scrollHeight;
  const r = b ? b.getBoundingClientRect() : null;
  const lr = lista.getBoundingClientRect();
  return {
    classe: el.className, nome: b ? b.textContent.trim() : '', ico: use ? use.getAttribute('href') : null,
    cor: b ? [getComputedStyle(b).backgroundColor, getComputedStyle(b).color] : null, par,
    aVista: !!r && r.top >= lr.top - 1 && r.bottom <= lr.bottom + 1,
    barraVelha: !!document.getElementById('cronoImportar') || !!document.querySelector('.list-header .crono-importar'),
  };
});
const folha = (pg) => pg.evaluate(() => {
  const o = document.querySelector('#songMenuList .import-oferta');
  return {
    aberta: document.getElementById('songMenuPopup').classList.contains('open'),
    titulo: document.getElementById('songMenuTitle').textContent,
    capa: o ? o.querySelector('.yt-oferta-thumb').tagName : null,
    capaSrc: o && o.querySelector('img.yt-oferta-thumb') ? o.querySelector('img.yt-oferta-thumb').src.slice(0, 5) : null,
    nome: o ? o.querySelector('.yt-oferta-titulo').textContent : null,
    meta: o ? o.querySelector('.yt-oferta-meta').textContent : null,
    botoes: [...document.querySelectorAll('#songMenuList button')].map((b) => b.title || b.getAttribute('aria-label') || ''),
  };
});
const tocarNaFolha = (pg, re) => pg.evaluate((src) => {
  const b = [...document.querySelectorAll('#songMenuList button')]
    .find((x) => new RegExp(src).test(x.title + ' ' + (x.getAttribute('aria-label') || '')));
  if (b) b.click();
  return !!b;
}, re.source);
async function escolherArquivo(pg, nome) {
  await semTour(pg);
  const [escolha] = await Promise.all([
    pg.waitForEvent('filechooser', { timeout: 12000 }).catch(() => null),
    pg.click('#hymnResults .lib-importar-btn'),
  ]);
  if (escolha) await escolha.setFiles({ name: nome, mimeType: 'image/png', buffer: PNG });
  return escolha;
}

try {
  // =========================================================================
  // A · AVANÇADO: o botão no fim, e a folha da oferta
  // =========================================================================
  {
    const a = await abrir('full');
    await a.pg.evaluate(() => openHymnSearch(false));
    await semTour(a.pg);
    const pronto = await esperar(a.pg, () => document.getElementById('hymnSearchPopup').classList.contains('open')
      && !!document.querySelector('#hymnResults.acervo > .lib-importar'), null, 12000);
    await a.pg.waitForTimeout(700);
    const r = await ultimo(a.pg);
    checar(pronto === true && !!r && r.barraVelha === false,
      'A · o IMPORTAR saiu da barra do topo (nenhum `#cronoImportar`)', porque(pronto) + ' ' + JSON.stringify(r));
    checar(!!r && /\blib-importar\b/.test(r.classe) && /\bbloco-fixo\b/.test(r.classe)
      && r.nome === 'Importar arquivo' && r.ico === '#icoArquivoMais' && r.aVista,
      'A · o ÚLTIMO item da Biblioteca é o botão "Importar arquivo", com a folha com o +, alcançável rolando', JSON.stringify(r));
    checar(!!r && !!r.cor && r.cor[0] === r.par[0] && r.cor[1] === r.par[1],
      'A · e ele tem COR DE BOTÃO — o par de ação `--btn-accent`/`--accent` —, e não o poço de uma coleção', JSON.stringify(r));
    const press = await a.pg.evaluate(() => {
      const el = document.querySelector('#hymnResults .lib-importar-btn');
      for (const f of document.styleSheets) {
        let regras; try { regras = f.cssRules; } catch (_) { continue; }
        for (const reg of regras) {
          if (!reg.selectorText || !/:active/.test(reg.selectorText) || !/var\(--press\)/.test(reg.style.transform || '')) continue;
          try { if (el.matches(reg.selectorText.replace(/:active/g, ''))) return true; } catch (_) {}
        }
      }
      return false;
    });
    checar(press === true, 'A · e ele afunda ao toque como os botões (`--press`)', String(press));

    const escolha = await escolherArquivo(a.pg, 'Foto do culto.png');
    const abriu = await esperar(a.pg, () => document.getElementById('songMenuPopup').classList.contains('open')
      && !!document.querySelector('#songMenuList .import-oferta'), null, 12000);
    const f = await folha(a.pg);
    checar(!!escolha && escolha.isMultiple() && abriu === true && f.titulo === 'Importar',
      'A · escolhido o arquivo (o seletor aceita vários), abre a folha "Importar"', porque(abriu) + ' ' + JSON.stringify(f));
    checar(f.capa === 'IMG' && f.capaSrc === 'blob:' && f.nome === 'Foto do culto' && /^Foto · /.test(f.meta || ''),
      'A · com a OFERTA do arquivo, como a do link: a capa é a própria foto, o nome sem extensão e "Foto · tamanho"', JSON.stringify(f));
    checar([/Tocar agora/, /Cronograma/, /playlist/i, /Favorit/].every((t) => f.botoes.some((b) => t.test(b))),
      'A · e as opções COMPLETAS da fileira: Tocar agora, Cronograma, Playlist e Favoritos', JSON.stringify(f.botoes));
    await tocarNaFolha(a.pg, /Cronograma/);
    const entrou = await esperarDb(a.pg, async () => (await AVDB.listIds('imports')).length === 1
      && !document.getElementById('songMenuPopup').classList.contains('open'), null, 15000);
    checar(entrou === true, 'A · "Cronograma" o põe no Cronograma', porque(entrou));

    await a.pg.evaluate(() => openHymnSearch(false));
    await semTour(a.pg);
    await esperar(a.pg, () => !!document.querySelector('#hymnResults .lib-importar-btn'), null, 12000);
    await a.pg.waitForTimeout(400);
    await escolherArquivo(a.pg, 'Aviso.png');
    await esperar(a.pg, () => !!document.querySelector('#songMenuList .import-oferta'), null, 12000);
    await tocarNaFolha(a.pg, /Tocar agora/);
    const tocou = await esperarDb(a.pg, async () => (await AVDB.listIds('avulsos')).length === 1
      && typeof currentId !== 'undefined' && !!currentId, null, 15000);
    const pos = await a.pg.evaluate(async () => ({ imports: (await AVDB.listIds('imports')).length,
      avulsos: await AVDB.listIds('avulsos'), cena: currentId }));
    checar(tocou === true && pos.imports === 1 && pos.avulsos.includes(pos.cena),
      'A · "Tocar agora" leva o arquivo à CENA pela prateleira avulsa, sem entrar no Cronograma', porque(tocou) + ' ' + JSON.stringify(pos));

    const nativo = await a.pg.evaluate(async () => {
      openHymnSearch(false);
      await new Promise((ok) => setTimeout(ok, 700));
      const antes = [window.__NATIVE__, window.AVNative];
      let pediu = null;
      window.__NATIVE__ = true;
      window.AVNative = { pickDoc: async (mimes) => { pediu = mimes; return []; } };
      try { document.querySelector('#hymnResults .lib-importar-btn').click(); await new Promise((ok) => setTimeout(ok, 50)); }
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
    const pronto = await esperar(a.pg, () => !!document.querySelector('#hymnResults.acervo > .lib-importar'), null, 12000);
    await a.pg.waitForTimeout(500);
    const r = await ultimo(a.pg);
    checar(pronto === true && !!r && /\blib-importar\b/.test(r.classe) && r.nome === 'Buscar na galeria'
      && r.ico === '#icoGaleria' && r.aVista,
      'B · no Modo Fácil o ÚLTIMO item da Biblioteca é o botão "Buscar na galeria", com a foto',
      porque(pronto) + ' ' + JSON.stringify(r));
    const escolha = await escolherArquivo(a.pg, 'Foto da galeria.png');
    checar(!!escolha, 'B · o toque abre o seletor de arquivos', String(!!escolha));
    // A prateleira é gravada ANTES da cena (`fixarAvulso`, depois `focarImportado`): espera-se pelas duas.
    const chegou = await esperarDb(a.pg, async () => (await AVDB.listIds('avulsos')).length === 1
      && typeof currentId !== 'undefined' && !!currentId, null, 15000);
    const listas = await a.pg.evaluate(async () => ({
      imports: (await AVDB.listIds('imports')).length,
      avulsos: await AVDB.listIds('avulsos'),
      cena: typeof currentId === 'undefined' ? null : currentId,
      folha: document.getElementById('songMenuPopup').classList.contains('open'),
    }));
    checar(chegou === true && listas.imports === 0 && !listas.folha,
      'B · o arquivo NÃO entra no Cronograma e não há folha: vai à prateleira avulsa (a reversão do defeito da '
      + 'v1.14.30, em que o Modo Fácil não importava nada)', porque(chegou) + ' ' + JSON.stringify(listas));
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
