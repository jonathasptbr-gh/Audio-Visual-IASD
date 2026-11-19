// ============================================================================
// OS MODELOS DE CULTO (Pacote 16, P5)
// ============================================================================
//
// "Modelos" (dito "Novo a partir de um modelo"), ao lado do "Novo cronograma", na gaveta: Sábado de manhã ·
// Domingo à noite · Quarta à noite (`MODELOS_DE_FABRICA`). Aplicar cria um
// cronograma NOVO com os momentos do modelo e o deixa EM USO; o de antes fica na
// gaveta, intacto (decisão do operador, 19/11). Os defeitos que este arquivo
// impede:
//
//  A. A LISTA QUE NÃO SE VÊ: os modelos abrem dentro da gaveta, e a 360 o botão
//     não pode transbordar nem a lista nascer aberta.
//  B. O MODELO QUE ENGOLE O CULTO: aplicar NÃO mexe no cronograma que estava em
//     uso — os itens dele continuam nele, guardados, e nada é coletado.
//  C. O MODELO PELA METADE: os momentos nascem na MESMA transação do
//     cronograma (`AVDB.cronoCriar(modelo)`), com horário e título certos, e um
//     momento inválido é pulado em vez de gravado.
//  D. O NOME QUE COLIDE: aplicar duas vezes dá "… (2)", com momentos próprios.
//  E. SALVAR COMO MODELO (16.e), pelo ⋮ da linha: guarda SÓ os momentos (as mídias ficam), do
//     ativo e de um guardado; o nome que colide com um de fábrica ganha " (2)"; o salvo aparece
//     em "Meus modelos" na hora, aplica como os de fábrica e se exclui pela própria linha.
//  F. O CRONOGRAMA SEM MOMENTO: o toque explica e nada é salvo.
//  G. ABRIR A LISTA ROLA SÓ A GAVETA: a barra do topo não sai da tela.
//
//   node tools/cronograma-modelos.test.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import {
  servirEstatico, abrirNavegador, esperarCortina, esperar, porque, checar, falhas, comModoAvancado,
} from './arnes.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port + '/controle/index.html';
const navegador = await abrirNavegador();

const ctx = await navegador.newContext({ viewport: { width: 360, height: 800 }, hasTouch: true });
await semRedeExterna(ctx);
await comModoAvancado(ctx);
const pg = await ctx.newPage();
const erros = [];
pg.on('pageerror', (e) => erros.push(String(e.message)));
const z = (ms) => pg.waitForTimeout(ms);

async function abrirGaveta() {
  if (await pg.evaluate(() => document.getElementById('cronoGaveta').classList.contains('aberta'))) return true;
  await pg.click('#cronoTitulo');
  const ok = await esperar(pg, () => document.getElementById('cronoGaveta').classList.contains('aberta'));
  await z(350);
  return ok;
}
const opcoes = () => pg.evaluate(() => [...document.querySelectorAll('#cronoLista .crono-modelo-opcao')]
  .map((li) => li.querySelector('.crono-trocar').textContent.trim()));
async function aplicar(nome) {
  await abrirGaveta();
  if (!(await opcoes()).length) await pg.click('#cronoModelo');
  await pg.evaluate((n) => {
    const li = [...document.querySelectorAll('#cronoLista .crono-modelo-opcao')]
      .find((x) => x.querySelector('.crono-item-nome').textContent === n);
    li.querySelector('.crono-trocar').click();
  }, nome);
  await esperar(pg, (n) => document.getElementById('listTitle').textContent.startsWith(n), nome);
  await z(400);
}
const momentosDoAtivo = () => pg.evaluate(async () => (await AVDB.listItems('imports'))
  .map((r) => ({ id: r.id, momento: r.kind === 'cue' && r.cue === 'momento', min: r.data && r.data.min, nome: r.name })));

try {
  await pg.goto(base, { waitUntil: 'load' });
  await esperarCortina(pg);
  const idsAntes = await pg.evaluate(async () => {
    const ids = [];
    for (let i = 0; i < 2; i++) {
      const r = await AVDB.addMedia(new Blob(['x' + i], { type: 'audio/mpeg' }),
        { name: 'Louvor ' + i, type: 'audio/mpeg', kind: 'audio', list: 'imports' });
      ids.push(r.id);
    }
    await load();
    return ids;
  });

  // A · o botão e a lista na gaveta
  {
    const ab = await abrirGaveta();
    const g = await pg.evaluate(() => {
      const b = document.getElementById('cronoModelo');
      const l = document.getElementById('cronoLista').getBoundingClientRect();
      const r = b.getBoundingClientRect();
      return {
        texto: b.textContent.trim(), rotulo: b.getAttribute('aria-label'), exp: b.getAttribute('aria-expanded'),
        // LADO A LADO com o "+ Novo" (19/11): a mesma faixa e a mesma largura, o "Novo" à esquerda.
        lado: (() => {
          const n = document.getElementById('cronoNovo').getBoundingClientRect();
          return Math.abs(n.top - r.top) < 1 && Math.abs(n.height - r.height) < 1 && n.right <= r.left
            && Math.abs(n.width - r.width) < 1;   // e da MESMA largura (19/11)
        })(),
        cabe: b.scrollWidth <= b.clientWidth + 1 && r.right <= l.right + 0.5,
        opcoes: document.querySelectorAll('#cronoLista .crono-modelo-opcao').length,
      };
    });
    checar(ab === true && g.texto === 'Modelos' && g.rotulo === 'Novo a partir de um modelo' && g.exp === 'false' && g.opcoes === 0 && g.cabe && g.lado,
      'A · a gaveta tem "Modelos" (dito "Novo a partir de um modelo"), FECHADO, ao lado do "+ Novo" e da mesma largura, e o botão cabe a 360', porque(ab) || JSON.stringify(g));
    await pg.click('#cronoModelo');
    await z(200);
    const o = await opcoes();
    const vis = await pg.evaluate(() => {
      const l = document.getElementById('cronoLista').getBoundingClientRect();
      const u = document.querySelector('#cronoLista > li:last-child').getBoundingClientRect();
      return { exp: document.getElementById('cronoModelo').getAttribute('aria-expanded'), dentro: u.bottom <= l.bottom + 1 && u.top >= l.top - 1, alt: u.height };
    });
    checar(o.join(' | ') === 'Sábado de manhã15 momentos · 09:00 às 12:05 | Domingo à noite8 momentos · 19:00 às 20:10 | '
      + 'Quarta à noite5 momentos · 19:30 às 20:18' && vis.exp === 'true' && vis.dentro && vis.alt >= 50,
    'A · o toque abre os TRÊS modelos, com a conta e o horário, e o último fica à vista na gaveta',
    JSON.stringify({ o, vis }));
    await pg.evaluate(() => fecharCronoGaveta());
    await esperar(pg, () => document.getElementById('cronoGaveta').hidden);
    await abrirGaveta();
    checar((await opcoes()).length === 0, 'A · e a gaveta reaberta nasce com a lista dos modelos FECHADA');
  }

  // B + C · aplicar o Sábado: um cronograma novo em uso, o de antes intacto
  {
    // OS MOMENTOS OCULTOS ANTES (19/11): aplicar um modelo força os momentos À VISTA — com o
    // interruptor desligado, o modelo abria numa lista vazia.
    await pg.evaluate(() => itinMomentosOcultar(true));
    const oculto = await esperar(pg, () => itin.momentosOcultos === true);
    await aplicar('Sábado de manhã');
    const vis = await pg.evaluate(async () => ({ mem: itin.momentosOcultos, gravado: (await AVDB.getState('itinerario') || {}).momentosOcultos }));
    checar(oculto === true && vis.mem === false && vis.gravado === false,
      'C · com os momentos OCULTOS, aplicar um modelo os põe À VISTA (na memória e gravado)', JSON.stringify({ oculto: porque(oculto) || oculto, vis }));
    const st = await pg.evaluate(async () => ({
      titulo: document.getElementById('listTitle').textContent,
      cronos: await AVDB.cronoLer(),
      guardados: await AVDB.cronoIdsGuardados(),
      linhas: document.querySelectorAll('#library li.momento').length,
    }));
    const ms = await momentosDoAtivo();
    const antigo = st.cronos.itens.find((x) => x.nome === 'Cronograma');
    checar(st.titulo === 'Sábado de manhã' && st.cronos.itens.length === 2 && antigo && antigo.qtd === 2
      && idsAntes.every((x) => st.guardados.includes(x)),
    'B · aplicar cria "Sábado de manhã" e o deixa EM USO; o cronograma de antes fica na gaveta com os itens dele',
    JSON.stringify(st));
    const vivos = await pg.evaluate(async (ids) => (await Promise.all(ids.map((x) => AVDB.getMedia(x)))).filter(Boolean).length, idsAntes);
    checar(vivos === 2, 'B · e nenhuma mídia do cronograma de antes é apagada', String(vivos));
    checar(ms.length === 15 && ms.every((x) => x.momento) && ms[0].min === 540 && ms[0].nome === 'Prelúdio e boas-vindas'
      && ms[3].nome === 'Estudo da lição' && ms[12].min === 675 && ms[12].nome === 'Sermão'
      && ms[14].min === 725 && ms[14].nome === 'Bênção e poslúdio' && st.linhas === 15,
    'C · o novo nasce com os 15 MOMENTOS do modelo, na ordem, com horário e título, e a lista os mostra',
    JSON.stringify({ n: ms.length, primeiro: ms[0], ultimo: ms[14], linhas: st.linhas }));

    await aplicar('Sábado de manhã');
    const st2 = await pg.evaluate(async () => ({ titulo: document.getElementById('listTitle').textContent, n: (await AVDB.cronoLer()).itens.length }));
    const ms2 = await momentosDoAtivo();
    checar(st2.titulo === 'Sábado de manhã (2)' && st2.n === 3 && ms2.length === 15 && !ms2.some((x) => ms.some((y) => y.id === x.id)),
      'D · aplicar de novo dá "Sábado de manhã (2)", com momentos PRÓPRIOS', JSON.stringify(st2));

    const inval = await pg.evaluate(async () => {
      const r = await AVDB.cronoCriar({ nome: '  Teste  ', momentos: [{ min: 600, titulo: '' }, { min: 2000, titulo: 'Fora' }, { min: 'x' }, null] });
      const itens = await AVDB.listItems('imports');
      return { nome: r.nome, itens: itens.map((x) => [x.data.min, x.name]) };
    });
    checar(inval.nome === 'Teste' && JSON.stringify(inval.itens) === '[[600,"Momento"]]',
      'C · horário inválido é PULADO e título vazio vira "Momento"', JSON.stringify(inval));
  }

  // E · salvar como modelo, pelo ⋮ da linha
  const opcaoDaLinha = async (nome, sel) => {
    await abrirGaveta();
    await pg.evaluate(([n, q]) => {
      const li = [...document.querySelectorAll('#cronoLista .crono-item:not(.crono-modelo-opcao)')]
        .find((x) => x.querySelector('.crono-item-nome').textContent === n);
      li.querySelector(':scope > .row-mais').click();
      li.querySelector(q).click();
    }, [nome, sel]);
    await esperar(pg, () => document.getElementById('appDialog').classList.contains('open'));
  };
  const dialogo = () => pg.evaluate(() => ({
    titulo: document.getElementById('appDialogTitle').textContent,
    msg: document.getElementById('appDialogMsg').textContent,
    valor: document.getElementById('appDialogInput').hidden ? null : document.getElementById('appDialogInput').value,
    cancelar: !document.getElementById('appDialogCancel').hidden,
  }));
  {
    await pg.evaluate(async () => {
      await AVDB.addMedia(new Blob(['m'], { type: 'audio/mpeg' }), { name: 'Hino', type: 'audio/mpeg', kind: 'audio', list: 'imports' });
      await load();
    });
    await opcaoDaLinha('Teste', '.crono-salvar-modelo');
    const d = await dialogo();
    await pg.fill('#appDialogInput', 'Meu culto');
    await pg.click('#appDialogOk');
    await esperar(pg, () => document.querySelectorAll('#cronoLista .crono-modelo-opcao.meu').length > 0);
    await z(300);
    const st = await pg.evaluate(async () => ({
      modelos: await AVDB.modelosLer(),
      rotulo: (document.querySelector('#cronoLista .crono-modelos-rotulo') || {}).textContent || '',
      meus: [...document.querySelectorAll('#cronoLista .crono-modelo-opcao.meu .crono-trocar')].map((x) => x.textContent.trim()),
      ultimoVisivel: (() => {
        const l = document.getElementById('cronoLista').getBoundingClientRect();
        const u = document.querySelector('#cronoLista > li:last-child').getBoundingClientRect();
        return u.bottom <= l.bottom + 1;
      })(),
      topo: document.querySelector('.list-header').getBoundingClientRect().top, rolagem: scrollY,
    }));
    checar(d.valor === 'Teste' && /guarda o momento/.test(d.msg) && /sem as mídias/.test(d.msg),
      'E · o ⋮ → "Salvar como modelo" pergunta o nome (sugere o do cronograma) e diz que guarda o momento, sem as mídias',
      JSON.stringify(d));
    checar(st.modelos.length === 1 && st.modelos[0].nome === 'Meu culto'
      && JSON.stringify(st.modelos[0].momentos) === '[{"min":600,"titulo":"Momento"}]',
    'E · o modelo guarda SÓ os momentos (o hino do cronograma não entra)', JSON.stringify(st.modelos));
    checar(st.rotulo === 'Meus modelos' && st.meus.join('|') === 'Meu culto1 momento · 10:00' && st.ultimoVisivel,
      'E · e ele aparece na hora em "Meus modelos", à vista na gaveta', JSON.stringify(st));
    checar(st.topo >= 0 && st.rolagem === 0, 'G · abrir a lista dos modelos rola SÓ a gaveta: a barra do topo fica na tela',
      JSON.stringify({ topo: st.topo, rolagem: st.rolagem }));

    // de um GUARDADO, com o nome de um de fábrica
    await opcaoDaLinha('Sábado de manhã', '.crono-salvar-modelo');
    const d2 = await dialogo();
    await pg.click('#appDialogOk');
    await z(500);
    const m2 = await pg.evaluate(async () => (await AVDB.modelosLer()).map((m) => [m.nome, m.momentos.length]));
    checar(d2.valor === 'Sábado de manhã' && JSON.stringify(m2) === '[["Meu culto",1],["Sábado de manhã (2)",15]]',
      'E · de um cronograma GUARDADO também; o nome igual ao de fábrica ganha " (2)"', JSON.stringify({ d2, m2 }));

    // aplicar o modelo do operador
    await aplicar('Meu culto');
    const ms = await momentosDoAtivo();
    checar(JSON.stringify(ms.map((x) => [x.momento, x.min, x.nome])) === '[[true,600,"Momento"]]',
      'E · aplicar "Meu culto" cria o cronograma com o momento dele, e só ele', JSON.stringify(ms));

    // F · sem momento
    await opcaoDaLinha('Cronograma', '.crono-salvar-modelo');
    const d3 = await dialogo();
    await pg.click('#appDialogOk');
    await z(400);
    const n3 = await pg.evaluate(async () => (await AVDB.modelosLer()).length);
    checar(d3.valor === null && !d3.cancelar && /não tem momentos/.test(d3.msg) && n3 === 2,
      'F · um cronograma sem momento: o toque EXPLICA e nada é salvo', JSON.stringify({ d3, n3 }));

    // excluir "Meu culto" pela linha dele
    await abrirGaveta();
    if (!(await opcoes()).length) await pg.click('#cronoModelo');
    await pg.evaluate(() => {
      const li = [...document.querySelectorAll('#cronoLista .crono-modelo-opcao.meu')]
        .find((x) => x.querySelector('.crono-item-nome').textContent === 'Meu culto');
      li.querySelector('.crono-excluir').click();
    });
    await esperar(pg, () => document.getElementById('appDialog').classList.contains('open'));
    await pg.click('#appDialogOk');
    await z(500);
    const fim = await pg.evaluate(async () => ({
      m: (await AVDB.modelosLer()).map((m) => m.nome),
      meus: [...document.querySelectorAll('#cronoLista .crono-modelo-opcao.meu .crono-item-nome')].map((x) => x.textContent),
      ativo: document.getElementById('listTitle').textContent,
    }));
    checar(JSON.stringify(fim.m) === '["Sábado de manhã (2)"]' && fim.meus.join() === 'Sábado de manhã (2)' && fim.ativo === 'Meu culto',
      'E · excluir o modelo pela linha dele (com pergunta) o tira da lista — e o cronograma criado com ele fica',
      JSON.stringify(fim));
  }

  checar(erros.length === 0, 'nenhum erro de página', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

console.log(falhas.length ? '\n' + falhas.length + ' falha(s).' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
