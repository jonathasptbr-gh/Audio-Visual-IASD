// ============================================================================
// OS MODELOS DE CULTO (Pacote 16, P5)
// ============================================================================
//
// "Novo a partir de um modelo", na gaveta dos cronogramas: Sábado de manhã ·
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
        texto: b.textContent.trim(), exp: b.getAttribute('aria-expanded'),
        cabe: b.scrollWidth <= b.clientWidth + 1 && r.right <= l.right + 0.5,
        opcoes: document.querySelectorAll('#cronoLista .crono-modelo-opcao').length,
      };
    });
    checar(ab === true && g.texto === 'Novo a partir de um modelo' && g.exp === 'false' && g.opcoes === 0 && g.cabe,
      'A · a gaveta tem "Novo a partir de um modelo", FECHADO, e o botão cabe a 360', porque(ab) || JSON.stringify(g));
    await pg.click('#cronoModelo');
    await z(200);
    const o = await opcoes();
    const vis = await pg.evaluate(() => {
      const l = document.getElementById('cronoLista').getBoundingClientRect();
      const u = document.querySelector('#cronoLista > li:last-child').getBoundingClientRect();
      return { exp: document.getElementById('cronoModelo').getAttribute('aria-expanded'), dentro: u.bottom <= l.bottom + 1 && u.top >= l.top - 1, alt: u.height };
    });
    checar(o.join(' | ') === 'Sábado de manhã15 momentos · 09:00 às 12:10 | Domingo à noite8 momentos · 19:00 às 20:10 | '
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
    await aplicar('Sábado de manhã');
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
    checar(ms.length === 15 && ms.every((x) => x.momento) && ms[0].min === 540 && ms[0].nome === 'Prelúdio'
      && ms[14].min === 730 && ms[14].nome === 'Bênção e poslúdio' && st.linhas === 15,
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

  checar(erros.length === 0, 'nenhum erro de página', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

console.log(falhas.length ? '\n' + falhas.length + ' falha(s).' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
