#!/usr/bin/env node
// ============================================================================
// A ENGRENAGEM DO ITEM GUARDADO (Pacote 21, v1.14.25) — o item virou editável
//
// Pedido do operador (09:55): *"Para esses itens que são configuraveis e podem
// ir para o cronograma, e que ao executar não abrem suas respectivas abas, ou
// afins, crie um botão nas opções seja no cronograma ou favoritos (um botão de
// engrenagem que abre a aba da ferramenta com os dados da ferramenta para serem
// editados ou administrados)."*
//
// ## O que falha calado aqui, e por isso cada metade existe
//
//  A. A ENGRENAGEM SÓ EXISTE ONDE TEM O QUE ADMINISTRAR — nos cues de
//     ferramenta (`message`, `draw`, `chrono`, `itinerario`), tanto no
//     Cronograma quanto nos Favoritos, e NUNCA numa mídia. Um botão que abre
//     uma ferramenta vazia, ou que aparece em toda linha, é a classe que este
//     projeto já recusou (o `⋮` sem função, a caixa de marcação que não marca).
//  B. A IDA: o painel abre com o CONTEÚDO DO ITEM, e não com o último estado da
//     ferramenta — cada modo do Tempo no modo certo, o Sorteio com a lista de
//     opções dele, o Itinerário com a programação dele, a Mensagem no editor.
//  C. A VOLTA: o que se edita no painel volta para O MESMO item quando ele
//     fecha. Sem isto a engrenagem editaria uma cópia descartável, e o item
//     seguiria apontando para o que já foi — o defeito que ela existe para
//     corrigir.
//
//   node tools/engrenagem-do-item.test.mjs
// ============================================================================
import { semRedeExterna } from './sem-rede.mjs';
import {
  servirEstatico, abrirNavegador, esperarCortina, esperar, checar, falhas, RAIZ_WEB, comModoAvancado,
} from './arnes.mjs';

const servidor = servirEstatico(RAIZ_WEB);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador();
const ctx = await navegador.newContext({ viewport: { width: 360, height: 800 }, hasTouch: true });
await semRedeExterna(ctx);
await comModoAvancado(ctx);
const pg = await ctx.newPage();
const erros = [];
pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));

const linhas = '#library .lib-item';
const abrir = (id) => pg.evaluate((i) => {
  const b = document.querySelector('#library .lib-item[data-id="' + i + '"] .row-engrenagem');
  if (b) b.click();
  return !!b;
}, id);

try {
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await esperarCortina(pg, 150000);
  await pg.waitForFunction(() => window.AVDB && typeof window.load === 'function'
    && typeof window.abrirFerramentaComCue === 'function', null, { timeout: 30000 });

  // ── O CENÁRIO: um item de cada ferramenta + uma mídia ─────────────────────
  const ids = await pg.evaluate(async () => {
    setAppMode('full');
    activeTab = 'imports';
    const crono = await AVDB.addCue('chrono', {
      mode: 'timer', durationMs: 300000, label: 'Abertura', secs: false, h12: false,
    }, { name: 'Timer da abertura', list: 'imports' });
    const desenho = await AVDB.addCue('draw', {
      kind: 'text', min: 1, max: 100, pool: ['Ana', 'Bia', 'Caio'], label: 'Nomes',
    }, { name: 'Sorteio de nomes', list: 'imports' });
    const itin = await AVDB.addCue('itinerario', {
      itens: [{ min: 540, titulo: 'Escola sabatina' }, { min: 600, titulo: 'Culto' }], horas: true,
    }, { name: 'Itinerário da manhã', list: 'imports' });
    messages.push({ id: 'msg-teste', text: 'Bem-vindos ao culto' });
    await saveMessages();
    const mensagem = await AVDB.addCue('message', { msgId: 'msg-teste', text: 'Bem-vindos ao culto' },
      { name: 'Bem-vindos ao culto', list: 'imports' });
    const midia = await AVDB.addMedia(new Blob([new Uint8Array(8)], { type: 'audio/mpeg' }),
      { name: 'Louvor', type: 'audio/mpeg', kind: 'audio', list: 'imports' });
    await load();
    return { crono: crono.id, desenho: desenho.id, itin: itin.id, mensagem: mensagem.id, midia: midia.id };
  });
  // ── A. ONDE ELA EXISTE ────────────────────────────────────────────────────
  const presenca = await pg.evaluate((i) => {
    const li = (id) => document.querySelector('#library .lib-item[data-id="' + id + '"]');
    const g = (id) => li(id) && li(id).querySelector('.row-engrenagem');
    return {
      crono: !!g(i.crono), desenho: !!g(i.desenho), itin: !!g(i.itin), mensagem: !!g(i.mensagem),
      midia: !g(i.midia),
      titulo: g(i.crono) && g(i.crono).title,
      etiqueta: g(i.crono) && g(i.crono).getAttribute('aria-label'),
    };
  }, ids);
  checar(presenca.crono && presenca.desenho && presenca.itin && presenca.mensagem,
    'A · os quatro cues de ferramenta têm a engrenagem na faixa de ações do Cronograma', presenca);
  checar(presenca.midia, 'A · e uma MÍDIA não tem: não há ferramenta a administrar nela', presenca);
  checar(presenca.titulo === 'Administrar este item' && presenca.etiqueta === 'Administrar este item',
    'A · o botão diz o que faz, no `title` e no nome acessível', presenca);
  // ── B. A IDA: o painel nasce com o conteúdo do item ───────────────────────
  const idaCrono = await pg.evaluate(async (i) => {
    document.querySelector('#library .lib-item[data-id="' + i.crono + '"] .row-engrenagem').click();
    await new Promise((r) => setTimeout(r, 350));
    return {
      aberta: ferramentasAbertas(), tool: miscTool, vista: tempoVista,
      modo: chrono.mode, dur: chrono.durationMs, rotulo: chrono.label,
    };
  }, ids);
  checar(idaCrono.aberta && idaCrono.tool === 'chrono' && idaCrono.vista === 'chrono'
    && idaCrono.modo === 'timer' && idaCrono.dur === 300000 && idaCrono.rotulo === 'Abertura',
    'B · o Tempo abre no MODO e com a DURAÇÃO e a legenda do item, e não no último estado da ferramenta', idaCrono);

  // ── C. A VOLTA: o que se edita volta para O MESMO item ────────────────────
  const voltaCrono = await pg.evaluate(async (i) => {
    chronoSetDuration(600000);           // a roleta chama esta mesma função
    chrono.label = 'Abertura 10 min';
    saveChronoPrefs();
    fecharFerramentas();
    let rec = null;
    for (let k = 0; k < 100; k++) {
      rec = await AVDB.getMedia(i.crono);
      if (rec && rec.data && rec.data.durationMs === 600000) break;
      await new Promise((r) => setTimeout(r, 30));
    }
    return { data: rec && rec.data, nome: rec && rec.name, itens: 1 };
  }, ids);
  checar(voltaCrono.data && voltaCrono.data.durationMs === 600000
    && voltaCrono.data.label === 'Abertura 10 min' && voltaCrono.nome === 'Timer da abertura',
    'C · o painel editado grava no PRÓPRIO item (e o nome do item não é reescrito)', voltaCrono);

  // ── O SORTEIO: a lista de opções dele, não a última do painel ─────────────
  const idaDraw = await pg.evaluate(async (i) => {
    document.querySelector('#library .lib-item[data-id="' + i.desenho + '"] .row-engrenagem').click();
    await new Promise((r) => setTimeout(r, 350));
    const out = { tool: miscTool, kind: draw.kind, pool: draw.pool.slice(), label: draw.label };
    fecharFerramentas();
    return out;
  }, ids);
  checar(idaDraw.tool === 'draw' && idaDraw.kind === 'text'
    && idaDraw.pool.join(',') === 'Ana,Bia,Caio' && idaDraw.label === 'Nomes',
    'B · o Sorteio abre com as OPÇÕES e a legenda do item', idaDraw);

  // ── O ITINERÁRIO: a programação dele, e o painel passa a editar ele ───────
  const idaItin = await pg.evaluate(async (i) => {
    document.querySelector('#library .lib-item[data-id="' + i.itin + '"] .row-engrenagem').click();
    await new Promise((r) => setTimeout(r, 350));
    const out = {
      tool: miscTool, vista: tempoVista,
      itens: itin.itens.map((x) => x.min + ' ' + x.titulo),
      horas: itin.horas,
    };
    fecharFerramentas();
    return out;
  }, ids);
  checar(idaItin.tool === 'chrono' && idaItin.vista === 'itinerario'
    && idaItin.itens.join('|') === '540 Escola sabatina|600 Culto' && idaItin.horas === true,
    'B · o Itinerário abre com a PROGRAMAÇÃO do item no painel', idaItin);

  // ── A MENSAGEM: abre no editor do texto dela ──────────────────────────────
  const idaMsg = await pg.evaluate(async (i) => {
    document.querySelector('#library .lib-item[data-id="' + i.mensagem + '"] .row-engrenagem').click();
    await new Promise((r) => setTimeout(r, 350));
    return {
      tool: miscTool,
      dialogo: appDialogEl.classList.contains('open'),
      titulo: appDialogTitleEl.textContent,
      texto: appDialogInputEl.value,
    };
  }, ids);
  checar(idaMsg.tool === 'msg' && idaMsg.dialogo && idaMsg.titulo === 'Editar a mensagem'
    && idaMsg.texto === 'Bem-vindos ao culto',
    'B · a Mensagem abre no EDITOR com o texto dela — é a edição que faltava para o item ser administrável', idaMsg);

  // ── A EDIÇÃO DO TEXTO, de verdade: salva e o item projeta o novo ──────────
  const edicao = await pg.evaluate(async () => {
    appDialogInputEl.value = 'Bem-vindos à casa do Senhor';
    appDialogOkEl.click();
    for (let k = 0; k < 100; k++) {
      const m = messages.find((x) => x.id === 'msg-teste');
      if (m && m.text === 'Bem-vindos à casa do Senhor') {
        fecharFerramentas();
        return { text: m.text };
      }
      await new Promise((r) => setTimeout(r, 30));
    }
    fecharFerramentas();
    return { text: (messages.find((x) => x.id === 'msg-teste') || {}).text };
  });
  checar(edicao.text === 'Bem-vindos à casa do Senhor',
    'B · e o editor SALVA: o texto da mensagem muda (o item projeta pelo id vivo, então a cena acompanha)', edicao);

  // ── A. ONDE ELA EXISTE (2): NA LINHA DOS FAVORITOS ────────────────────────
  // A Biblioteca é aberta no fim porque é ela que fecha o Cronograma — a mesma
  // seção que o oráculo dos Favoritos abre (e pelo mesmo caminho).
  const fav = await pg.evaluate(async () => {
    const c = await AVDB.addCue('draw', { kind: 'number', min: 1, max: 10, pool: [], label: '' },
      { name: 'Sorteio de números', list: 'favs' });
    await recarregarFavoritos();
    if (!hymnSearchPopupEl.classList.contains('open')) openHymnSearch(false);
    favAberto = true;
    renderSearchResults('');
    await new Promise((r) => setTimeout(r, 400));
    const b = document.querySelector('#hymnResults [data-fav-corpo] .fav-itens > .lib-item[data-id="' + c.id + '"]');
    return { tem: !!(b && b.querySelector('.row-engrenagem')), id: c.id };
  });
  checar(fav.tem, 'A · e a mesma engrenagem aparece na linha dos Favoritos — a faixa é a mesma função', fav);

  checar(erros.length === 0, 'nenhum erro de página durante o percurso', erros);
} finally {
  await navegador.close();
  await new Promise((r) => servidor.close(r));
}

console.log(falhas.length ? '\n' + falhas.length + ' falha(s)' : '\ntudo certo');
process.exit(falhas.length ? 1 : 0);
