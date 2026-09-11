// ============================================================================
// O TOQUE NA VERSÃO ABRE O QUE MUDOU (v1.8.65)
// ============================================================================
//
// Pedido do operador, verbatim: *"para o botão de versão, ao tocar, ele mostra
// o popup de atualizações que ocorreram na última atualização (ou um log em
// lista das atualizações que tiveram em cada versão recente)"*.
//
// ---------- OS QUATRO DEFEITOS QUE ESTE ARQUIVO EXISTE PARA IMPEDIR ----------
// Nenhum dos quatro aparece numa captura de tela, e três deles deixam o botão
// TOCÁVEL, o que é a forma cara de quebrar: quem toca conclui que o app travou.
//
//  1. A FONTE ERRADA. Existem DUAS listas de notas no app, e elas respondem a
//     perguntas diferentes: o `otaNotas` é o que vem NA atualização oferecida e
//     fora de uma atualização pendente está VAZIO — que é exatamente o caso
//     normal, e portanto o caso em que este botão é tocado. Ligado nele, o
//     diálogo abre em branco no dia a dia e só funciona na véspera de uma
//     atualização. A fonte certa é o `notas.json` do bundle INSTALADO, que
//     viaja no pacote de propósito.
//  2. O DIÁLOGO VAZIO SEM DIZER POR QUÊ. Sem o arquivo (um bundle antigo, um
//     404), abrir uma lista vazia é indistinguível de um botão quebrado. A
//     mensagem tem de MUDAR.
//  3. O "CANCELAR" QUE NÃO CANCELA NADA. Este diálogo não pergunta: ele conta.
//     Um segundo botão ao lado do "Entendi" oferece uma escolha que não existe.
//  4. O PREFIXO DE VERSÃO. A lista do OTA o OMITE de propósito (lá o título já
//     diz de que versão se fala). Aqui ela é a linha do tempo de VÁRIAS, e sem
//     o prefixo as mudanças de três lotes viram uma lista só, sem fronteira.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import {
  servirEstatico, abrirNavegador, esperarCortina, esperar, porque, checar, falhas,
} from './arnes.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..', 'app', 'src', 'main', 'assets', 'web');

// A ROTA PRÓPRIA: ela serve o `notas.json` de MENTIRA, e é ela que torna as
// asserções determinísticas. Com o arquivo real, o conteúdo muda a cada lote e
// a asserção teria de ser sobre a FORMA — o que aprovaria uma lista de um item
// só, ou o prefixo ausente. `modo` é trocado entre os blocos.
let modo = 'cheio';
const NOTAS = [
  { versao: '9.9.9', itens: ['Mudou o primeiro', 'Mudou o segundo'] },
  { versao: '9.9.8', itens: ['Mudou noutra versão'] },
  { versao: '9.9.7', itens: ['Terceira'] },
  { versao: '9.9.6', itens: ['Quarta'] },
  { versao: '9.9.5', itens: ['Quinta'] },
  { versao: '9.9.4', itens: ['SEXTA — esta fica de fora do teto'] },
];
const servidor = servirEstatico(RAIZ, (req, res) => {
  if (!req.url.startsWith('/notas.json')) return false;
  if (modo === 'ausente') { res.writeHead(404); res.end('nao'); return true; }
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(modo === 'curto' ? NOTAS.slice(0, 2) : NOTAS));
  return true;
});
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port + '/controle/index.html';
const navegador = await abrirNavegador();

async function abrir() {
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 900 }, hasTouch: true });
  await semRedeExterna(ctx);
  const pg = await ctx.newPage();
  await pg.goto(base, { waitUntil: 'load' });
  await esperarCortina(pg);
  await pg.evaluate(async () => {
    const z = (ms) => new Promise((f) => setTimeout(f, ms));
    setAppMode('full'); await z(120);
    openFadePopup(); await z(250);
  });
  return { ctx, pg };
}

// O QUE O DIÁLOGO MOSTRA, depois de o toque resolver. A espera é pelo FATO (o
// backdrop aberto), nunca por relógio.
async function tocar(pg) {
  await pg.evaluate(() => { document.getElementById('versaoBtn').click(); });
  const r = await esperar(pg, () => {
    const bd = document.querySelector('.dialog-backdrop');
    return !!bd && bd.classList.contains('open');
  });
  const d = await pg.evaluate(() => {
    const ul = document.getElementById('appDialogItens');
    const rod = document.getElementById('appDialogRodape');
    return {
      titulo: ((document.getElementById('appDialogTitle') || {}).textContent || '').trim(),
      msg: ((document.getElementById('appDialogMsg') || {}).textContent || '').trim(),
      itens: ul ? [...ul.children].map((li) => (li.textContent || '').trim()) : [],
      listaEscondida: ul ? ul.hidden : null,
      ok: ((document.getElementById('appDialogOk') || {}).textContent || '').trim(),
      cancelEscondido: !!(document.getElementById('appDialogCancel') || {}).hidden,
      rodape: rod && !rod.hidden ? (rod.textContent || '').trim() : '',
      // A LISTA ROLA, e a marca da sombra tem de estar nela: um log de cinco
      // versões passa da altura do cartão, e é a `rola` que diz onde ele acaba.
      rolavel: ul ? getComputedStyle(ul).overflowY : null,
      temMarca: ul ? ul.classList.contains('rola') : null,
    };
  });
  return { d, prazo: r };
}

try {
  // =========================================================================
  // A · O TOQUE ABRE A LINHA DO TEMPO, COM O PREFIXO DE VERSÃO
  // =========================================================================
  {
    modo = 'cheio';
    const a = await abrir();
    const { d, prazo } = await tocar(a.pg);
    checar(prazo === true && d.titulo === 'O que mudou' && d.listaEscondida === false,
      'A · tocar na versão abre o diálogo "O que mudou", com a lista à vista',
      porque(prazo) || JSON.stringify({ titulo: d.titulo, escondida: d.listaEscondida }));
    // O TETO É DE VERSÕES, não de linhas: a fixture tem SEIS blocos e o teto é
    // cinco, então a asserção separa "cortou" de "mostrou tudo". Sem o sexto
    // bloco na fixture, um teto quebrado passaria.
    checar(d.itens.length === 6 && !d.itens.some((t) => /SEXTA/.test(t)),
      'A · e ela leva as CINCO versões mais recentes, não todas — a sexta da '
      + 'fixture fica de fora', JSON.stringify({ n: d.itens.length, itens: d.itens }));
    checar(d.itens.every((t) => /^v\d+\.\d+\.\d+ · /.test(t)),
      'A · e TODA linha diz de que versão ela é. A lista do OTA omite o prefixo '
      + 'de propósito (lá o título já diz a versão); aqui são várias, e sem ele '
      + 'as mudanças de três lotes viram uma lista só', JSON.stringify(d.itens));
    checar(d.itens[0] === 'v9.9.9 · Mudou o primeiro'
      && d.itens[d.itens.length - 1] === 'v9.9.5 · Quinta',
      'A · e a ordem é a do arquivo: da mais NOVA para a mais velha',
      JSON.stringify([d.itens[0], d.itens[d.itens.length - 1]]));
    checar(d.cancelEscondido === true && d.ok === 'Entendi',
      'A · ele CONTA, não pergunta: um "Cancelar" ao lado do "Entendi" '
      + 'ofereceria uma escolha que não existe',
      JSON.stringify({ ok: d.ok, cancel: d.cancelEscondido }));
    checar(d.rolavel === 'auto' && d.temMarca === true,
      'A · e a lista ROLA com a marca da sombra: cinco versões passam da altura '
      + 'do cartão, e é a tira que diz onde o texto acaba',
      JSON.stringify({ rolavel: d.rolavel, marca: d.temMarca }));
    await a.ctx.close();
  }

  // =========================================================================
  // B · O RODAPÉ SÓ APARECE QUANDO HÁ CORTE
  // =========================================================================
  //
  // Ele diz "As 5 versões mais recentes" — e anunciá-lo com QUATRO guardadas
  // descreveria um corte que não houve. As duas metades, porque uma linha
  // sempre presente e uma sempre ausente passam em metades opostas.
  {
    modo = 'curto';
    const a = await abrir();
    const { d } = await tocar(a.pg);
    checar(d.itens.length === 3 && d.rodape === '',
      'B · com MENOS versões que o teto não há rodapé: ele descreve um corte, e '
      + 'sem corte ele afirmaria o que não é',
      JSON.stringify({ n: d.itens.length, rodape: d.rodape }));
    await a.ctx.close();
  }
  {
    modo = 'cheio';
    const a = await abrir();
    const { d } = await tocar(a.pg);
    checar(/5 vers/.test(d.rodape),
      'B · e com MAIS que o teto ele diz o recorte — a lista truncada sem aviso '
      + 'afirma ser tudo', d.rodape);
    await a.ctx.close();
  }

  // =========================================================================
  // C · SEM O ARQUIVO, A MENSAGEM MUDA — E ELA É O ÚNICO SINAL
  // =========================================================================
  //
  // Um diálogo vazio é indistinguível de um botão quebrado. Esta é a asserção
  // que separa as duas coisas, e ela mede a MENSAGEM porque a lista some
  // (`hidden` com zero itens) e não tem como dizer nada.
  {
    modo = 'ausente';
    const a = await abrir();
    const { d, prazo } = await tocar(a.pg);
    checar(prazo === true && d.itens.length === 0 && d.listaEscondida === true,
      'C · sem o `notas.json` o diálogo AINDA ABRE, e a lista some',
      porque(prazo) || JSON.stringify({ n: d.itens.length, escondida: d.listaEscondida }));
    checar(/não veio neste pacote/.test(d.msg) && /Registro/.test(d.msg),
      'C · e a MENSAGEM diz por quê, apontando o Registro ao lado — falhar vazio '
      + 'aqui é indistinguível de um botão quebrado', d.msg);
    await a.ctx.close();
  }

  // =========================================================================
  // D · A FONTE É O BUNDLE, E NÃO O `otaNotas`
  // =========================================================================
  //
  // Esta é a asserção que a leitura de código não dá: as duas variáveis têm a
  // mesma FORMA (`[{versao, itens}]`), então trocar uma pela outra compila,
  // renderiza e só falha no caso normal — com o `otaNotas` vazio, que é o
  // estado de todo dia em que ninguém está atualizando nada.
  {
    modo = 'cheio';
    const a = await abrir();
    await a.pg.evaluate(() => { otaNotas = [{ versao: '0.0.1', itens: ['VEIO DO OTA'] }]; });
    const { d } = await tocar(a.pg);
    checar(!d.itens.some((t) => /VEIO DO OTA/.test(t)) && d.itens.some((t) => /Mudou o primeiro/.test(t)),
      'D · a lista sai do `notas.json` do bundle INSTALADO, nunca do `otaNotas` '
      + '— aquele é o que vem NA atualização oferecida, e fora de uma '
      + 'atualização pendente ele está vazio', JSON.stringify(d.itens.slice(0, 2)));
    await a.ctx.close();
  }
} finally {
  await navegador.close();
  servidor.close();
}

console.log(falhas.length ? '\n' + falhas.length + ' falha(s).' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
