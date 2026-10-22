// ============================================================================
// OS CRONOGRAMAS MÚLTIPLOS (v1.12.54; a gaveta refeita na v1.12.55)
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
//  6. A LINHA QUE SE ATROPELA (bloco M, v1.12.55). Cada cronograma é uma linha
//     renomear · nome · excluir, e o nome tem de ficar no EIXO entre os dois
//     quadrados em toda largura e escala de fonte — medido, nunca de olho.
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
  // JÁ ABERTA (renomear e excluir a deixam aberta), o título está sob o véu:
  // tocá-lo seria um toque de fora, que FECHA.
  if (await pg.evaluate(() => document.getElementById('cronoGaveta').classList.contains('aberta'))) return true;
  await pg.click('#cronoTitulo');
  return esperar(pg, () => document.getElementById('cronoGaveta').classList.contains('aberta'));
}
async function tocarNaGaveta(nome) {
  await abrirGaveta();
  await pg.evaluate((n) => {
    if (n === 'Novo cronograma') { document.getElementById('cronoNovo').click(); return; }
    const li = [...document.querySelectorAll('#cronoLista .crono-item')]
      .find((x) => (x.querySelector('.crono-item-nome') || {}).textContent === n);
    li.querySelector('.crono-trocar').click();
  }, nome);
  await esperar(pg, (n) => document.getElementById('listTitle').textContent === n
    || n === 'Novo cronograma', nome);
  await z(300);
}
// Um dos dois quadrados da LINHA de um cronograma na gaveta: `renomear` ou `excluir`.
async function naLinha(nome, qual) {
  await abrirGaveta();
  await pg.evaluate(([n, q]) => {
    const li = [...document.querySelectorAll('#cronoLista .crono-item')]
      .find((x) => (x.querySelector('.crono-item-nome') || {}).textContent === n);
    li.querySelector('.crono-' + q).click();
  }, [nome, qual]);
}
async function fecharGaveta() {
  await pg.evaluate(() => fecharCronoGaveta());
  await esperar(pg, () => document.getElementById('cronoGaveta').hidden);
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
        ultimo: (document.querySelector('#cronoLista > li:last-child').textContent || '').trim(),
        ativo: ativo && ativo.querySelector('.crono-trocar').textContent.trim(),
        fundo: ativo && getComputedStyle(ativo).backgroundColor,
        selRgb,
        expandido: document.getElementById('cronoTitulo').getAttribute('aria-expanded'),
        transicao: parseFloat(getComputedStyle(gv).transitionDuration) || 0,
      };
    });
    checar(ab === true && g.abaixo >= 0 && g.abaixo < 12,
      'A · tocar no título abre a GAVETA logo abaixo da barra do topo', porque(ab) || JSON.stringify(g));
    checar(g.n === 1 && /^Cronograma\s*3 itens$/.test(g.ativo) && g.ultimo === 'Novo cronograma',
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
    await naLinha('Cronograma', 'renomear');
    const val = await pg.evaluate(() => document.getElementById('appDialogInput').value);
    await responder('   Culto jovem   ');
    let st = await estado();
    const naGaveta = await pg.evaluate(() => ({
      aberta: !document.getElementById('cronoGaveta').hidden,
      nomes: [...document.querySelectorAll('#cronoLista .crono-item-nome')].map((x) => x.textContent),
    }));
    checar(val === 'Cronograma' && st.titulo === 'Culto jovem',
      'D · o RENOMEAR da linha abre o diálogo com o nome atual e grava o novo, APARADO',
      JSON.stringify({ val, titulo: st.titulo }));
    checar(naGaveta.aberta && naGaveta.nomes.includes('Culto jovem'),
      'D · e a gaveta FICA ABERTA, com o nome novo na linha — o diálogo por cima dela '
      + 'não é um "toque de fora"', JSON.stringify(naGaveta));
    await fecharGaveta();
    await naLinha('Culto jovem', 'renomear');
    await responder('    ');
    st = await estado();
    checar(st.titulo === 'Culto jovem',
      'D · e um nome VAZIO é recusado: o antigo fica', st.titulo);
    // RENOMEAR UM QUE NÃO É O ATIVO: a linha age sobre o cronograma DELA.
    await naLinha('Cronograma 2', 'renomear');
    await responder('culto JOVEM');
    st = await estado();
    checar(st.titulo === 'Culto jovem' && st.cronos.itens.some((c) => c.nome === 'culto JOVEM (2)'),
      'D · renomear pela linha de um cronograma GUARDADO renomeia ESSE, e não o ativo — '
      + 'e um nome que COLIDE com outro ganha " (2)": duas linhas iguais na gaveta '
      + 'seriam indistinguíveis ao toque', JSON.stringify({ titulo: st.titulo, itens: st.cronos.itens.map((c) => c.nome) }));
    await fecharGaveta();
  }

  // =========================================================================
  // E · LIMPAR É SÓ DO ATIVO
  // =========================================================================
  {
    await tocarNaGaveta('Cronograma 3');
    await semear(2, 'Hino');
    await pg.click('#cronoLimpar');
    await responder(true);
    const st = await estado();
    checar(st.imports === 0 && st.titulo === 'Cronograma 3',
      'E · Limpar esvazia o cronograma ATIVO', JSON.stringify({ imports: st.imports }));
    checar(qtdDe(st, 'Culto jovem') === 3,
      'E · e só ele: o "Culto jovem" guardado continua com os três', JSON.stringify(st.cronos));
    const dis = await pg.evaluate(() => {
      const b = document.getElementById('cronoLimpar');
      const h = document.querySelector('.list-header').getBoundingClientRect();
      const r = b.getBoundingClientRect();
      const t = document.getElementById('cronoTitulo').getBoundingClientRect();
      return { dis: b.disabled, title: b.title, esq: r.left - h.left, antes: r.right <= t.left };
    });
    checar(dis.dis === true && /vazio/i.test(dis.title),
      'E · e com o cronograma vazio o Limpar é APAGADO, dizendo por quê', JSON.stringify(dis));
    checar(dis.esq < 24 && dis.antes,
      'E · e o Limpar mora NA BARRA, encostado à ESQUERDA, antes do título (v1.12.55)',
      JSON.stringify(dis));
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
    await naLinha('Cronograma 3', 'excluir');
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
    await fecharGaveta();
    // EXCLUIR UM QUE NÃO É O ATIVO: a linha age sobre o cronograma DELA, e o ativo
    // não muda. É o caminho que o menu ⋮ não tinha.
    await tocarNaGaveta('Culto jovem');
    await naLinha('culto JOVEM (2)', 'excluir');
    await responder(true);
    st = await estado();
    const sobra = await pg.evaluate(async ([a, b]) => ({
      so: !!(await AVDB.getMedia(a)), junto: !!(await AVDB.getMedia(b)),
    }), [so, junto]);
    checar(st.titulo === 'Culto jovem' && st.imports === 3 && sobra.so === false && sobra.junto === true,
      'F · excluir pela linha de um GUARDADO o tira sem mexer no ativo, e o que SÓ ele '
      + 'segurava é coletado, enquanto o que outra lista segura fica',
      JSON.stringify({ titulo: st.titulo, imports: st.imports, sobra }));
    // Sobrou UM: o "Culto jovem".
    const dis = await pg.evaluate(() => {
      const b = document.querySelector('#cronoLista .crono-item .crono-excluir');
      return { dis: b.disabled, title: b.title, aria: b.getAttribute('aria-label') };
    });
    await fecharGaveta();
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
    if (g1 !== true) { await pg.evaluate(() => fecharCronoGaveta()); await z(300); }
    checar(v1 === true && g1 === true,
      'J · o VOLTAR do Android fecha a gaveta (e consome o toque)',
      JSON.stringify({ v1, g1: porque(g1) || g1 }));
    const semMenu = await pg.evaluate(() => ({
      btn: !!document.getElementById('cronoMenuBtn'), menu: !!document.getElementById('cronoMenu'),
      fn: typeof window.fecharCronoCamadas,
    }));
    checar(!semMenu.btn && !semMenu.menu && semMenu.fn === 'undefined',
      'J · e o menu ⋮ SAIU inteiro (v1.12.55): nem o botão, nem a folha, nem o código',
      JSON.stringify(semMenu));
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
    await naLinha('Culto jovem', 'renomear');
    await responder('Culto de sábado de manhã com a escola sabatina e o sermão');
    await fecharGaveta();
    const r = await pg.evaluate(() => {
      const t = document.getElementById('cronoTitulo').getBoundingClientRect();
      const m = document.getElementById('cronoLimpar').getBoundingClientRect();
      const g = document.getElementById('settingsBtn').getBoundingClientRect();
      return { esq: t.left - m.right, dir: g.left - t.right, larg: document.documentElement.scrollWidth - innerWidth,
        gear: g.right <= innerWidth };
    });
    checar(r.esq >= 0 && r.dir >= 0 && r.larg <= 0 && r.gear,
      'L · um nome longo cabe entre o Limpar e a engrenagem, sem empurrar ninguém para fora',
      JSON.stringify(r));
  }

  // =========================================================================
  // M · A LINHA: renomear · nome NO EIXO · excluir, em toda largura e escala
  // =========================================================================
  // Pedido do operador (v1.12.55): *"o botão de novo cronograma fique
  // centralizado horizontalmente. E o mesmo para os nomes dos cronogramas,
  // deixando o botão de excluir em um dos lados e o de renomear no outro
  // extremo"*. Os cronogramas que os blocos anteriores deixaram (cinco): curtos, o longo do bloco L e um vazio.
  {
    await tocarNaGaveta('Novo cronograma');
    const celulas = [];
    for (const w of [320, 360, 430]) {
      for (const f of [1, 1.25]) {
        await pg.setViewportSize({ width: w, height: 900 });
        await pg.evaluate((e) => { document.documentElement.style.fontSize = (16 * e) + 'px'; }, f);
        await abrirGaveta();
        await z(350);
        const r = await pg.evaluate(() => {
          const cx = (b) => (b.left + b.right) / 2;
          const linhas = [...document.querySelectorAll('#cronoLista .crono-item')].map((li) => {
            const L = li.getBoundingClientRect();
            const ren = li.querySelector('.crono-renomear').getBoundingClientRect();
            const tro = li.querySelector('.crono-trocar').getBoundingClientRect();
            const exc = li.querySelector('.crono-excluir').getBoundingClientRect();
            const nm = li.querySelector('.crono-item-nome');
            const n = nm.getBoundingClientRect();
            const q = li.querySelector('.crono-item-qtd').getBoundingClientRect();
            return {
              // Os dois quadrados nas DUAS PONTAS da linha, quadrados e iguais.
              pontas: ren.left - L.left < 12 && L.right - exc.right < 12,
              quadrados: Math.abs(ren.width - ren.height) < 0.5 && Math.abs(exc.width - ren.width) < 0.5,
              // Nada se sobrepõe: o miolo fica ENTRE os dois.
              semToque: ren.right <= tro.left + 0.5 && tro.right <= exc.left + 0.5,
              // O NOME e a CONTA no eixo entre os dois quadrados.
              eixoNome: +Math.abs(cx(n) - (ren.right + exc.left) / 2).toFixed(2),
              eixoQtd: +Math.abs(cx(q) - (ren.right + exc.left) / 2).toFixed(2),
              // Um nome longo vira reticências DENTRO do miolo.
              cabe: n.left >= tro.left - 0.5 && n.right <= tro.right + 0.5,
              cortado: nm.scrollWidth > nm.clientWidth + 1,
            };
          });
          const novo = document.getElementById('cronoNovo');
          const nb = novo.getBoundingClientRect();
          const ico = novo.querySelector('svg').getBoundingClientRect();
          const rot = novo.querySelector('span').getBoundingClientRect();
          const gv = document.getElementById('cronoGaveta').getBoundingClientRect();
          return {
            linhas,
            novoEixo: +Math.abs((ico.left + rot.right) / 2 - cx(nb)).toFixed(2),
            novoCheio: Math.abs(nb.width - (gv.width - 2 * 12.8)) < 4 || nb.width > gv.width * 0.8,
            dentro: gv.left >= 0 && gv.right <= innerWidth,
            larg: document.documentElement.scrollWidth - innerWidth,
          };
        });
        celulas.push({ w, f, ...r });
        await fecharGaveta();
      }
    }
    await pg.evaluate(() => { document.documentElement.style.fontSize = ''; });
    await pg.setViewportSize({ width: 390, height: 900 });
    const ruins = (pred) => celulas.filter((c) => !pred(c)).map((c) => ({ w: c.w, f: c.f, l: c.linhas, novo: c.novoEixo }));
    checar(celulas.every((c) => c.linhas.length >= 3 && c.linhas.every((l) => l.pontas && l.quadrados && l.semToque)),
      'M · em 320/360/430 px e fonte 1×/1,25×, cada linha tem RENOMEAR numa ponta e EXCLUIR '
      + 'na outra, quadrados iguais, e o miolo ENTRE eles sem sobrepor nenhum',
      JSON.stringify(ruins((c) => c.linhas.length >= 3 && c.linhas.every((l) => l.pontas && l.quadrados && l.semToque))));
    checar(celulas.every((c) => c.linhas.every((l) => l.eixoNome <= 1 && l.eixoQtd <= 1 && l.cabe)),
      'M · e o NOME e a CONTA ficam no EIXO entre os dois botões (≤ 1px), dentro do miolo',
      JSON.stringify(ruins((c) => c.linhas.every((l) => l.eixoNome <= 1 && l.eixoQtd <= 1 && l.cabe))));
    checar(celulas.every((c) => c.linhas.some((l) => l.cortado)),
      'M · PREMISSA: o nome longo do bloco L está de fato cortado em reticências — sem '
      + 'ele o eixo acima seria medido só sobre nomes curtos', JSON.stringify(celulas.map((c) => c.linhas.map((l) => l.cortado))));
    checar(celulas.every((c) => c.novoEixo <= 1 && c.dentro && c.larg <= 0),
      'M · e o "Novo cronograma" tem ícone + rótulo CENTRADOS na linha (≤ 1px), e a gaveta '
      + 'não passa da tela', JSON.stringify(celulas.map((c) => ({ w: c.w, f: c.f, novo: c.novoEixo, dentro: c.dentro, larg: c.larg }))));
  }

  // =========================================================================
  // N · O TOQUE NO MIOLO TROCA; OS QUADRADOS NÃO TROCAM
  // =========================================================================
  {
    const antes = (await estado()).titulo;
    await naLinha('Cronograma 2', 'renomear');
    await responder(false);
    const depoisRen = (await estado()).titulo;
    const r = await pg.evaluate(() => {
      const li = document.querySelector('#cronoLista .crono-item.ativo');
      const b = li.querySelector('.crono-trocar');
      return { cur: b.getAttribute('aria-current'), resp: getComputedStyle(li).getPropertyValue('filter') };
    });
    await fecharGaveta();
    checar(depoisRen === antes && r.cur === 'true',
      'N · tocar no RENOMEAR de outra linha (e cancelar) NÃO troca de cronograma — o '
      + 'quadrado não é o miolo', JSON.stringify({ antes, depoisRen, r }));
    await tocarNaGaveta('Cronograma 2');
    const st = await estado();
    checar(st.titulo === 'Cronograma 2' && st.imports === 1,
      'N · e tocar no MIOLO da linha troca para ele', JSON.stringify({ titulo: st.titulo, imports: st.imports }));
  }

  checar(erros.length === 0, 'nenhum erro de página', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

console.log(falhas.length ? '\n' + falhas.length + ' falha(s).' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
