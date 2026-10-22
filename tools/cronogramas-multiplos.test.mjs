// ============================================================================
// OS CRONOGRAMAS MÚLTIPLOS (v1.12.54)
// ============================================================================
//
// Pedido do operador: *"o sistema de múltiplos cronogramas na verdade vai
// funcionar apenas como um 'atalho para alterar todo o cronograma de uma vez',
// ao invés de criar cronogramas concorrentes ao mesmo tempo"*.
//
// O DESENHO: o ativo continua sendo `imports`, e os outros são conjuntos
// guardados na chave `cronogramas` (ver `cronoLerEm` em `db.js`). Os defeitos
// que este arquivo existe para impedir, e nenhum aparece numa captura:
//
//  1. PERDER MÍDIA (bloco I). Um item que só está num cronograma INATIVO não
//     está em `imports` — sem os guardados em `lerDetentores`, a faxina da
//     abertura seguinte (`gcOrfaos`) o apaga, e o operador descobre no sábado
//     que o cronograma do culto voltou com linhas a menos.
//  2. O LIMPAR VAZANDO (bloco E). Limpar é do ATIVO; um que esvaziasse a chave
//     inteira apagaria os outros cronogramas de uma vez.
//  3. O APP SEM CRONOGRAMA (bloco F). Excluir o último deixaria a tela sem lista
//     nenhuma para os destinos — por isso o Excluir é APAGADO quando ele é o único.
//  4. A MIGRAÇÃO QUE ESCREVE (bloco A). Um aparelho de antes tem um cronograma só,
//     e abrir o app novo não pode mudar nada nele — nem escrever a chave.
//  5. O TOQUE DE FORA QUE TOCA (bloco J). Fechar a gaveta tocando fora não pode
//     PROJETAR a linha de baixo.
//
//   node tools/cronogramas-multiplos.test.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import {
  servirEstatico, abrirNavegador, esperarCortina, esperar, esperarDb, porque, checar, falhas,
  comModoAvancado,
} from './arnes.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port + '/controle/index.html';
const navegador = await abrirNavegador();

const ctx = await navegador.newContext({ viewport: { width: 390, height: 900 }, hasTouch: true });
await semRedeExterna(ctx);
await comModoAvancado(ctx);
const pg = await ctx.newPage();
const erros = [];
pg.on('pageerror', (e) => erros.push(String(e.message)));

const z = (ms) => pg.waitForTimeout(ms);
// O ESTADO, lido do banco e da tela no mesmo instante.
const estado = () => pg.evaluate(async () => ({
  titulo: document.getElementById('listTitle').textContent,
  linhas: document.querySelectorAll('#library .lib-item').length,
  imports: (await AVDB.listIds('imports')).length,
  cronos: await AVDB.cronoLer(),
  chave: await AVDB.getState('cronogramas'),
}));
const qtdDe = (st, nome) => { const c = st.cronos.itens.find((x) => x.nome === nome); return c ? c.qtd : null; };
// A gaveta, aberta pelo TOQUE no título, e o toque numa linha dela.
async function abrirGaveta() {
  await pg.click('#cronoTitulo');
  return esperar(pg, () => document.getElementById('cronoGaveta').classList.contains('aberta'));
}
async function tocarNaGaveta(nome) {
  await abrirGaveta();
  await pg.evaluate((n) => {
    const b = [...document.querySelectorAll('#cronoLista .crono-item')]
      .find((x) => (x.querySelector('.crono-item-nome') || {}).textContent === n);
    b.click();
  }, nome);
  await esperar(pg, (n) => document.getElementById('listTitle').textContent === n
    || n === 'Novo cronograma', nome);
  await z(300);
}
async function menu(id) {
  await pg.click('#cronoMenuBtn');
  await esperar(pg, () => document.getElementById('cronoMenu').classList.contains('aberta'));
  await pg.click('#' + id);
}
async function responder(valor) {
  await esperar(pg, () => document.getElementById('appDialog').classList.contains('open'));
  if (valor === false) { await pg.click('#appDialogCancel'); }
  else {
    if (typeof valor === 'string') await pg.fill('#appDialogInput', valor);
    await pg.click('#appDialogOk');
  }
  await z(500);
}
const semear = (n, prefixo) => pg.evaluate(async ([qtd, p]) => {
  const ids = [];
  for (let i = 0; i < qtd; i++) {
    const r = await AVDB.addMedia(new Blob(['x' + i], { type: 'audio/mpeg' }),
      { name: p + ' ' + i, type: 'audio/mpeg', kind: 'audio', list: 'imports' });
    ids.push(r.id);
  }
  await load();
  return ids;
}, [n, prefixo]);

try {
  await pg.goto(base, { waitUntil: 'load' });
  await esperarCortina(pg);
  const idsA = await semear(3, 'Louvor');

  // =========================================================================
  // A · O APARELHO DE ANTES: um cronograma só, chamado "Cronograma"
  // =========================================================================
  {
    const st = await estado();
    checar(st.titulo === 'Cronograma' && st.linhas === 3 && st.chave === undefined,
      'A · um aparelho que nunca trocou de cronograma abre com UM, chamado '
      + '"Cronograma", com a lista de sempre — e a chave nova NÃO é escrita',
      JSON.stringify({ titulo: st.titulo, linhas: st.linhas, chave: st.chave }));
    const geo = await pg.evaluate(() => {
      const t = document.getElementById('listTitle').getBoundingClientRect();
      const s = document.querySelector('#cronoTitulo .crono-seta').getBoundingClientRect();
      const h = document.querySelector('.list-header').getBoundingClientRect();
      return { seta: s.left - t.right, sw: s.width, eixo: Math.abs((t.left + t.right) / 2 - (h.left + h.right) / 2) };
    });
    checar(geo.seta >= 0 && geo.seta < 8 && geo.sw > 0 && geo.eixo <= 1,
      'A · a SETA mora à DIREITA do título, colada nele, e o NOME continua no eixo '
      + 'da faixa', JSON.stringify(geo));
    const ab = await abrirGaveta();
    await z(350);   // a medida é do quadro ASSENTADO: durante a entrada ela ainda desliza
    const g = await pg.evaluate(() => {
      const gv = document.getElementById('cronoGaveta');
      const h = document.querySelector('.list-header').getBoundingClientRect();
      const r = gv.getBoundingClientRect();
      const itens = [...document.querySelectorAll('#cronoLista .crono-item')];
      const ativo = document.querySelector('#cronoLista .crono-item.ativo');
      const sel = getComputedStyle(document.documentElement).getPropertyValue('--sel-fill').trim();
      const sonda = document.createElement('div');
      sonda.style.background = sel; document.body.appendChild(sonda);
      const selRgb = getComputedStyle(sonda).backgroundColor; sonda.remove();
      return {
        abaixo: +(r.top - h.bottom).toFixed(1),
        n: itens.length,
        ultimo: (itens[itens.length - 1].textContent || '').trim(),
        ativo: ativo && ativo.textContent.trim(),
        fundo: ativo && getComputedStyle(ativo).backgroundColor,
        selRgb,
        expandido: document.getElementById('cronoTitulo').getAttribute('aria-expanded'),
        transicao: parseFloat(getComputedStyle(gv).transitionDuration) || 0,
      };
    });
    checar(ab === true && g.abaixo >= 0 && g.abaixo < 12,
      'A · tocar no título abre a GAVETA logo abaixo da barra do topo', porque(ab) || JSON.stringify(g));
    checar(g.n === 2 && /^Cronograma\s*3 itens$/.test(g.ativo) && g.ultimo === 'Novo cronograma',
      'A · e ela lista o cronograma com a CONTA de itens, e a última linha é "Novo cronograma"',
      JSON.stringify(g));
    checar(g.fundo === g.selRgb && g.expandido === 'true',
      'A · e o ATIVO é marcado com `--sel-fill`, a linguagem de SELECIONADO numa lista',
      JSON.stringify({ fundo: g.fundo, sel: g.selRgb }));
    checar(g.transicao > 0,
      'A · e ela ANIMA — a gaveta tem transição declarada', g.transicao);
    const st2 = await estado();
    checar(st2.chave === undefined, 'A · e ABRIR a gaveta também não escreve nada', st2.chave);
  }

  // =========================================================================
  // B · NOVO CRONOGRAMA: "Cronograma 2", vazio, e ele vira o ativo
  // =========================================================================
  {
    await pg.evaluate(() => document.getElementById('cronoNovo').click());
    await esperar(pg, () => document.getElementById('listTitle').textContent === 'Cronograma 2');
    await z(300);
    const st = await estado();
    checar(st.titulo === 'Cronograma 2' && st.imports === 0 && st.linhas === 0,
      'B · "Novo cronograma" cria um VAZIO chamado "Cronograma 2" e troca para ele',
      JSON.stringify({ titulo: st.titulo, imports: st.imports }));
    checar(qtdDe(st, 'Cronograma') === 3 && st.cronos.itens.length === 2,
      'B · e o de antes fica GUARDADO com os três itens', JSON.stringify(st.cronos));
    const fechou = await esperar(pg, () => document.getElementById('cronoGaveta').hidden
      && document.getElementById('cronoVeu').hidden);
    checar(fechou === true, 'B · e a gaveta fecha (com o véu) depois da escolha', porque(fechou));
    await tocarNaGaveta('Novo cronograma');
    const st3 = await estado();
    checar(st3.titulo === 'Cronograma 3' && st3.cronos.itens.length === 3,
      'B · e o seguinte é "Cronograma 3" — o primeiro número livre', st3.titulo);
  }

  // =========================================================================
  // C · TROCAR: o toque numa linha traz a lista inteira dela
  // =========================================================================
  {
    await tocarNaGaveta('Cronograma');
    const st = await estado();
    checar(st.titulo === 'Cronograma' && st.imports === 3 && st.linhas === 3,
      'C · tocar num cronograma da gaveta troca a lista INTEIRA de uma vez',
      JSON.stringify({ titulo: st.titulo, imports: st.imports, linhas: st.linhas }));
    checar(qtdDe(st, 'Cronograma 3') === 0 && qtdDe(st, 'Cronograma 2') === 0,
      'C · e os outros continuam guardados, vazios como estavam', JSON.stringify(st.cronos));
  }

  // =========================================================================
  // D · RENOMEAR: aparado, vazio recusado, colisão com sufixo
  // =========================================================================
  {
    await menu('cronoRenomear');
    const val = await pg.evaluate(() => document.getElementById('appDialogInput').value);
    await responder('   Culto jovem   ');
    let st = await estado();
    checar(val === 'Cronograma' && st.titulo === 'Culto jovem',
      'D · Renomear abre o diálogo com o nome atual e grava o novo, APARADO',
      JSON.stringify({ val, titulo: st.titulo }));
    await menu('cronoRenomear');
    await responder('    ');
    st = await estado();
    checar(st.titulo === 'Culto jovem',
      'D · e um nome VAZIO é recusado: o antigo fica', st.titulo);
    await tocarNaGaveta('Cronograma 2');
    await menu('cronoRenomear');
    await responder('culto JOVEM');
    st = await estado();
    checar(st.titulo === 'culto JOVEM (2)',
      'D · e um nome que COLIDE com outro cronograma ganha " (2)" — duas linhas iguais '
      + 'na gaveta seriam indistinguíveis ao toque', st.titulo);
  }

  // =========================================================================
  // E · LIMPAR É SÓ DO ATIVO
  // =========================================================================
  {
    await tocarNaGaveta('Cronograma 3');
    await semear(2, 'Hino');
    await menu('cronoLimpar');
    await responder(true);
    const st = await estado();
    checar(st.imports === 0 && st.titulo === 'Cronograma 3',
      'E · Limpar esvazia o cronograma ATIVO', JSON.stringify({ imports: st.imports }));
    checar(qtdDe(st, 'Culto jovem') === 3,
      'E · e só ele: o "Culto jovem" guardado continua com os três', JSON.stringify(st.cronos));
    const dis = await pg.evaluate(() => {
      document.getElementById('cronoMenuBtn').click();
      const b = document.getElementById('cronoLimpar');
      const r = { dis: b.disabled, title: b.title };
      fecharCronoCamadas();
      return r;
    });
    checar(dis.dis === true && /vazio/i.test(dis.title),
      'E · e com o cronograma vazio o Limpar é APAGADO, dizendo por quê', JSON.stringify(dis));
  }

  // =========================================================================
  // F · EXCLUIR: cai no usado mais recentemente; o último não se exclui
  // =========================================================================
  {
    // O que o cronograma excluído segura SOZINHO é coletado; o que outra lista
    // também segura, não.
    await tocarNaGaveta('culto JOVEM (2)');
    const [so, junto] = await semear(2, 'Excluível');
    await pg.evaluate((id) => AVDB.listAdd('favs', id), junto);
    await tocarNaGaveta('Cronograma 3');
    // O usado mais recentemente, ao sair do 3, é o "culto JOVEM (2)".
    await menu('cronoExcluir');
    await esperar(pg, () => document.getElementById('appDialog').classList.contains('open'));
    const msg = await pg.evaluate(() => document.getElementById('appDialogMsg').textContent);
    await responder(true);
    let st = await estado();
    checar(st.titulo === 'culto JOVEM (2)' && st.cronos.itens.length === 2
      && !st.cronos.itens.some((c) => c.nome === 'Cronograma 3'),
      'F · Excluir tira o cronograma ativo e cai no USADO MAIS RECENTEMENTE',
      JSON.stringify({ titulo: st.titulo, msg, itens: st.cronos.itens.map((c) => c.nome) }));
    checar(/Cronograma 3/.test(msg),
      'F · e a pergunta nomeia o cronograma que sai', msg);
    await tocarNaGaveta('Culto jovem');
    await tocarNaGaveta('culto JOVEM (2)');
    await menu('cronoExcluir');
    await responder(true);
    st = await estado();
    const sobra = await pg.evaluate(async ([a, b]) => ({
      so: !!(await AVDB.getMedia(a)), junto: !!(await AVDB.getMedia(b)),
    }), [so, junto]);
    checar(st.titulo === 'Culto jovem' && sobra.so === false && sobra.junto === true,
      'F · e o que SÓ ele segurava é coletado, enquanto o que outra lista segura fica',
      JSON.stringify({ titulo: st.titulo, sobra }));
    // Sobrou UM: o "Culto jovem".
    const dis = await pg.evaluate(() => {
      document.getElementById('cronoMenuBtn').click();
      const b = document.getElementById('cronoExcluir');
      const r = { dis: b.disabled, title: b.title, aria: b.getAttribute('aria-label') };
      fecharCronoCamadas();
      return r;
    });
    checar(st.cronos.itens.length === 1 && dis.dis === true && /único/.test(dis.title) && dis.aria === dis.title,
      'F · com UM cronograma só, o Excluir é APAGADO e o `title` diz por quê — o app '
      + 'nunca fica sem cronograma', JSON.stringify({ n: st.cronos.itens.length, dis }));
    const ainda = await pg.evaluate(async () => {
      await excluirCronograma();
      return (await AVDB.cronoLer()).itens.length;
    });
    checar(ainda === 1, 'F · e nem o caminho direto exclui o último', ainda);
  }

  // =========================================================================
  // H · O DESTINO "CRONOGRAMA" É O ATIVO
  // =========================================================================
  let idGuardado;
  {
    await tocarNaGaveta('Novo cronograma');          // "Cronograma 2", ativo
    const [m] = await pg.evaluate(async () => {
      const r = await AVDB.addMedia(new Blob(['d'], { type: 'audio/mpeg' }),
        { name: 'Do destino', type: 'audio/mpeg', kind: 'audio', list: 'avulsos' });
      await adicionarNasListas(['imports'], r.id, 'Do destino', null);
      return [r.id];
    });
    idGuardado = m;
    const st = await estado();
    const ativoTem = await pg.evaluate((id) => AVDB.listHas('imports', id), m);
    checar(ativoTem && qtdDe(st, 'Cronograma 2') === 1 && qtdDe(st, 'Culto jovem') === 3,
      'H · o destino "Cronograma" das folhas acrescenta ao cronograma ATIVO, e só nele',
      JSON.stringify(st.cronos));
  }

  // =========================================================================
  // I · O QUE SÓ UM CRONOGRAMA INATIVO SEGURA SOBREVIVE AO COLETOR
  // =========================================================================
  {
    await pg.evaluate((id) => AVDB.listRemove('avulsos', id), idGuardado);
    await tocarNaGaveta('Culto jovem');
    const r = await pg.evaluate(async (id) => {
      const naLista = (await AVDB.listIds('imports')).includes(id);
      const apagados = await AVDB.gcOrfaos();
      return { naLista, apagados, vive: !!(await AVDB.getMedia(id)) };
    }, idGuardado);
    checar(r.naLista === false && r.vive === true,
      'I · uma mídia que SÓ está num cronograma inativo sobrevive à faxina (`gcOrfaos`) — '
      + 'os guardados são detentores, como o ativo', JSON.stringify(r));
    await tocarNaGaveta('Cronograma 2');
    const volta = await pg.evaluate((id) => AVDB.listHas('imports', id), idGuardado);
    checar(volta === true, 'I · e ela volta à lista quando o cronograma volta a ser o ativo', volta);
  }

  // =========================================================================
  // G · PERSISTE ENTRE ABERTURAS
  // =========================================================================
  {
    await tocarNaGaveta('Culto jovem');
    await pg.reload({ waitUntil: 'load' });
    await esperarCortina(pg);
    await esperar(pg, () => document.getElementById('listTitle').textContent === 'Culto jovem');
    const st = await estado();
    checar(st.titulo === 'Culto jovem' && st.imports === 3 && qtdDe(st, 'Cronograma 2') === 1,
      'G · depois de reabrir, o ATIVO, o nome e os guardados continuam como estavam',
      JSON.stringify({ titulo: st.titulo, imports: st.imports, itens: st.cronos.itens }));
  }

  // =========================================================================
  // J · O VOLTAR E O TOQUE DE FORA FECHAM A GAVETA E O MENU
  // =========================================================================
  {
    await abrirGaveta();
    const v1 = await pg.evaluate(() => window.__avBack());
    const g1 = await esperar(pg, () => document.getElementById('cronoGaveta').hidden, null, 3000);
    // Sem o degrau a gaveta fica aberta, e o véu engoliria o toque seguinte: o
    // oráculo a fecha à mão para o veredito sair na asserção, não num prazo.
    if (g1 !== true) await pg.evaluate(() => fecharCronoCamadas());
    await z(300);
    await pg.click('#cronoMenuBtn');
    await esperar(pg, () => document.getElementById('cronoMenu').classList.contains('aberta'));
    const v2 = await pg.evaluate(() => window.__avBack());
    const m2 = await esperar(pg, () => document.getElementById('cronoMenu').hidden, null, 3000);
    if (m2 !== true) { await pg.evaluate(() => fecharCronoCamadas()); await z(300); }
    checar(v1 === true && g1 === true && v2 === true && m2 === true,
      'J · o VOLTAR do Android fecha a gaveta e o menu (e consome o toque)',
      JSON.stringify({ v1, g1: porque(g1) || g1, v2, m2: porque(m2) || m2 }));
    // O TOQUE FORA, em cima de uma linha do Cronograma: fecha, e NÃO projeta.
    await abrirGaveta();
    const alvo = await pg.evaluate(() => {
      const li = [...document.querySelectorAll('#library .lib-item')].pop();
      const r = li.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await pg.mouse.click(alvo.x, alvo.y);
    await z(500);
    const r = await pg.evaluate(() => ({
      fechou: document.getElementById('cronoGaveta').hidden,
      noAr: typeof midiaNoAr !== 'undefined' ? midiaNoAr : null,
      cur: typeof currentId !== 'undefined' ? currentId : null,
    }));
    checar(r.fechou === true && !r.noAr && !r.cur,
      'J · e o toque FORA fecha a gaveta sem tocar na linha que estava por baixo — '
      + 'uma linha do Cronograma tocada PROJETA', JSON.stringify(r));
  }

  // =========================================================================
  // K · A IMPORTAÇÃO DE UM PACOTE SÓ ACRESCENTA
  // =========================================================================
  {
    const r = await pg.evaluate(async () => {
      const vindo = { ativo: 'de-la-ativo', itens: [
        { id: 'de-la-ativo', nome: 'Ativo de lá', ids: [] },
        { id: 'de-la-1', nome: 'Culto jovem', ids: ['nao-admitido', 'admitido'] },
      ] };
      const n1 = await AVDB.cronoImportar(vindo, new Set(['admitido']));
      const depois1 = (await AVDB.cronoLer()).itens.map((c) => c.nome + ':' + c.qtd);
      const n2 = await AVDB.cronoImportar(vindo, new Set(['admitido']));
      const depois2 = (await AVDB.cronoLer()).itens.map((c) => c.nome + ':' + c.qtd);
      return { n1, n2, depois1, depois2 };
    });
    checar(r.depois1.includes('Culto jovem (2):1') && r.depois1.includes('Culto jovem:3')
      && !r.depois1.some((x) => /Ativo de lá/.test(x)),
      'K · um cronograma guardado do pacote entra como NOVO, com sufixo no nome que colide, '
      + 'só com os itens admitidos — e nunca substitui o daqui', JSON.stringify(r));
    checar(r.n2 === 0 && JSON.stringify(r.depois2) === JSON.stringify(r.depois1),
      'K · e importar DE NOVO não muda nada — o mesmo id é o mesmo cronograma', JSON.stringify(r));
  }

  // =========================================================================
  // L · UM NOME LONGO VIRA RETICÊNCIAS, NÃO EMPURRA A FAIXA
  // =========================================================================
  {
    await menu('cronoRenomear');
    await responder('Culto de sábado de manhã com a escola sabatina e o sermão');
    const r = await pg.evaluate(() => {
      const t = document.getElementById('cronoTitulo').getBoundingClientRect();
      const m = document.getElementById('cronoMenuBtn').getBoundingClientRect();
      const g = document.getElementById('settingsBtn').getBoundingClientRect();
      return { esq: t.left - m.right, dir: g.left - t.right, larg: document.documentElement.scrollWidth - innerWidth,
        gear: g.right <= innerWidth };
    });
    checar(r.esq >= 0 && r.dir >= 0 && r.larg <= 0 && r.gear,
      'L · um nome longo cabe entre o ⋮ e a engrenagem, sem empurrar ninguém para fora',
      JSON.stringify(r));
  }

  checar(erros.length === 0, 'nenhum erro de página', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

console.log(falhas.length ? '\n' + falhas.length + ' falha(s).' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
