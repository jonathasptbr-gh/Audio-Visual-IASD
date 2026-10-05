#!/usr/bin/env node
// ============================================================================
// MODO FÁCIL: A BIBLIOTECA É A TELA PRINCIPAL, E A PRÉVIA NÃO EXISTE (v1.11.11)
//
// Pedido do operador, verbatim: *"vamos remover a visualização da preview no
// modo simples, para um usuário simples, a própria tela conectada já será o
// visor … vamos remover o botão 'buscar música', ao invés dele, vamos manter
// diretamente exposto a barra de busca no topo e a biblioteca no corpo onde é
// hoje o corpo do campo de leitura … sem mídia tocando, a biblioteca é a tela
// principal, com mídia tocando, o auxiliar de leitura é a tela principal"*.
//
// O que este arquivo trava, e cada uma falha CALADA:
//  A. SEM TELA a cortina manda: a Biblioteca não abre por trás dela.
//  B. COM TELA e nada no ar, a Biblioteca está ENCAIXADA na caixa da zona de
//     leitura (as quatro bordas), sem seta e sem foco, com a zona de leitura
//     escondida por baixo — e a prévia, o "Buscar música" e a faixa que os
//     hospedava não existem.
//  C. COM MÍDIA NO AR a leitura volta a ser a tela, e a Biblioteca sai — pela
//     MESMA pergunta do Parar (`haOQueParar`): pausar não troca de tela.
//  D. O que é CENA DE ROTEIRO (letra avulsa, texto) também conta como "no ar".
//  E. PARAR devolve a Biblioteca, e o campo de busca volta limpo.
//  F. O voltar do Android NÃO fecha a Biblioteca encaixada (ela é a tela).
//  G. Sair do Modo Fácil desencaixa; voltar encaixa de novo.
//  H. A caixa ACOMPANHA o layout (o encaixe é medido, não escrito).
//  I. O ícone de cast do cabeçalho existe com tela, some sem ela e abre a folha
//     de conexão — é a casa nova da porta que a prévia levava.
//
//   node tools/modo-simples-corpo.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import {
  servirEstatico, abrirNavegador, esperar, esperarCortina, porque, checar, falhas,
} from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);
await new Promise((r) => servidor.listen(0, r));
const base = `http://localhost:${servidor.address().port}`;
const navegador = await abrirNavegador();
const erros = [];

try {
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true });
  await semRedeExterna(ctx);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await esperarCortina(pg);

  const quadros = () => pg.evaluate(async () => {
    const folha = document.querySelector('#hymnSearchPopup .popup-sheet');
    await Promise.all(folha.getAnimations().map((a) => a.finished.catch(() => {})));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  const ler = () => pg.evaluate(() => {
    const caixa = (el) => { const r = el.getBoundingClientRect(); return [r.top, r.left, r.right, r.bottom].map((n) => Math.round(n)); };
    const campo = document.getElementById('hymnSearchInput');
    const rc = campo.getBoundingClientRect();
    const alvo = document.elementFromPoint(rc.left + rc.width / 2, rc.top + rc.height / 2);
    const setaLib = document.getElementById('hymnSearchToggle');
    const cast = document.getElementById('simpleCastBtn');
    const song = document.querySelector('.simple-song');
    const vis = (el) => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
      return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
    return {
      corpo: document.body.classList.contains('simples-biblioteca'),
      semTela: document.getElementById('simpleMode').classList.contains('sem-tela'),
      aberta: document.getElementById('hymnSearchPopup').classList.contains('open'),
      popup: caixa(document.getElementById('hymnSearchPopup')),
      song: caixa(song),
      songVisivel: getComputedStyle(song).visibility !== 'hidden',
      barraTopo: Math.round(document.querySelector('.lib-bar').getBoundingClientRect().top),
      campoAlcanca: !!alvo && (alvo === campo || campo.contains(alvo) || alvo.closest('.lib-search-campo') !== null),
      foco: document.activeElement && document.activeElement.id,
      setaDaLib: vis(setaLib),
      previa: document.getElementById('preview').getBoundingClientRect().height,
      semBuscar: document.getElementById('simpleSearchBtn') === null,
      semFaixa: document.getElementById('simpleStage') === null,
      castVisivel: vis(cast), castConectado: cast.classList.contains('connected'),
      castTitulo: cast.title,
    };
  });
  const igual = (a, b, t) => a.every((n, i) => Math.abs(n - b[i]) <= t);

  // A · SEM TELA a cortina manda
  await pg.evaluate(() => { renderSimpleCast(); });
  await quadros();
  const a = await ler();
  checar(a.semTela === true && a.aberta === false && a.corpo === false,
    'A · PREMISSA e A1: sem tela conectada a cortina cobre o modo e a Biblioteca NÃO abre por trás dela',
    JSON.stringify(a));
  checar(a.castVisivel === false,
    'A2 · e o ícone de cast do cabeçalho some sem tela: a seção de conexão já é a tela inteira', JSON.stringify(a));

  // B · COM TELA e nada no ar: a Biblioteca é o corpo
  await pg.evaluate(() => { webDisplayWin = { closed: false }; renderSimpleCast(); });
  await quadros();
  const b = await ler();
  checar(b.semTela === false && b.corpo === true && b.aberta === true,
    'B1 · com tela e nada no ar a Biblioteca ABRE sozinha como tela principal', JSON.stringify(b));
  checar(igual(b.popup, b.song, 2),
    'B2 · e está ENCAIXADA na caixa da zona de leitura: as quatro bordas coincidem (topo, esquerda, direita, base)',
    'popup ' + b.popup + ' contra leitura ' + b.song);
  checar(b.songVisivel === false,
    'B3 · a zona de leitura fica ESCONDIDA por baixo (o controle remoto não sobe)', JSON.stringify(b));
  checar(b.barraTopo - b.popup[0] <= 12,
    'B4 · a barra de busca está no TOPO do corpo', 'barra ' + b.barraTopo + ' contra topo ' + b.popup[0]);
  checar(b.campoAlcanca === true,
    'B5 · e o campo recebe o toque (nada por cima)', JSON.stringify(b));
  checar(b.foco !== 'hymnSearchInput',
    'B6 · abre SEM foco: é a tela, não uma busca começada — o teclado não sobe sozinho', b.foco);
  checar(b.setaDaLib === false,
    'B7 · sem a seta de abrir/fechar: a Biblioteca não é mais uma janela que se fecha', JSON.stringify(b));
  checar(b.previa === 0 && b.semBuscar && b.semFaixa,
    'B8 · a prévia não ocupa lugar, e o "Buscar música" e a faixa que os hospedava não existem',
    JSON.stringify({ previa: b.previa, semBuscar: b.semBuscar, semFaixa: b.semFaixa }));
  checar(b.castVisivel === true && b.castConectado === true,
    'B9 · o ícone de cast do cabeçalho está à vista e VERDE (há tela recebendo)', JSON.stringify(b));

  // I · o ícone abre a folha de conexão
  const abriuCast = await pg.evaluate(() => {
    let chamou = 0; const orig = window.abrirCast; window.abrirCast = () => { chamou++; };
    document.getElementById('simpleCastBtn').click();
    window.abrirCast = orig;
    return chamou;
  });
  checar(abriuCast === 1,
    'I · tocar o ícone de cast do cabeçalho chama o `abrirCast` (trocar de tela ou desconectar)', String(abriuCast));

  // busca de verdade funciona no corpo encaixado
  await pg.fill('#hymnSearchInput', 'zzzzqq');
  await esperar(pg, () => !document.getElementById('hymnSearchLimpar').hidden, null, 10000);
  const comTexto = await ler();
  checar(comTexto.aberta === true && comTexto.corpo === true,
    'B10 · digitar no campo mantém a Biblioteca encaixada (o ✕ de limpar aparece junto)', JSON.stringify(comTexto));

  // B11 · FECHAR com a Biblioteca encaixada é REINICIAR: quem toca numa música
  // chama `closeHymnSearch` antes de a mídia existir (`playSongVariant`, `ytAcao`…),
  // e fechar de verdade deixaria o corpo VAZIO durante o download — e para sempre
  // se ele falhasse. A janela fica, o campo volta limpo e o acervo no estado padrão.
  const reinicio = await pg.evaluate(async () => {
    closeHymnSearch();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return {
      aberta: document.getElementById('hymnSearchPopup').classList.contains('open'),
      corpo: document.body.classList.contains('simples-biblioteca'),
      campo: document.getElementById('hymnSearchInput').value,
      limpar: document.getElementById('hymnSearchLimpar').hidden,
      acervo: !!document.querySelector('#hymnResults .coll-group, #hymnResults .lib-item, #hymnResults .hymnal-card, #hymnResults .coll-card'),
    };
  });
  checar(reinicio.aberta === true && reinicio.corpo === true && reinicio.campo === '' && reinicio.limpar === true,
    'B11 · `closeHymnSearch` com a Biblioteca ENCAIXADA a reinicia em vez de fechá-la: o corpo '
    + 'não pode ficar vazio durante um download que ainda não pôs a mídia no ar', JSON.stringify(reinicio));
  checar(reinicio.acervo === true,
    'B12 · e o acervo volta ao estado padrão — não fica nos resultados de um termo que o campo já não tem',
    JSON.stringify(reinicio));

  // C · mídia no ar: a leitura é a tela
  await pg.evaluate(() => { midiaNoAr = true; renderTransporteHabilitado(); });
  await quadros();
  const c = await ler();
  checar(c.corpo === false && c.aberta === false && c.songVisivel === true,
    'C1 · com mídia no ar a Biblioteca sai e a zona de leitura volta a ser a tela principal', JSON.stringify(c));
  // PAUSAR não é parar: `midiaNoAr` segue verdadeiro, e o estado de play é outro assunto.
  await pg.evaluate(() => { setPlaying(false); renderTransporteHabilitado(); });
  await quadros();
  const cp = await ler();
  checar(cp.corpo === false && cp.songVisivel === true,
    'C2 · pausar NÃO traz a Biblioteca de volta: a mídia continua no ar (a pergunta é a do Parar)', JSON.stringify(cp));

  // E · parar devolve a Biblioteca, com o campo limpo
  await pg.evaluate(() => { midiaNoAr = false; renderTransporteHabilitado(); });
  await quadros();
  const e = await ler();
  const campoLimpo = await pg.evaluate(() => document.getElementById('hymnSearchInput').value);
  checar(e.corpo === true && e.aberta === true && e.songVisivel === false && igual(e.popup, e.song, 2),
    'E1 · parar devolve a Biblioteca ao corpo, encaixada de novo', JSON.stringify(e));
  checar(campoLimpo === '',
    'E2 · e o campo de busca volta LIMPO — a palavra de antes descreve uma tela que já saiu', JSON.stringify(campoLimpo));

  // D · cena de roteiro também é "no ar"
  await pg.evaluate(() => { textoAvulsoNoAr = true; renderTransporteHabilitado(); });
  await quadros();
  const d = await ler();
  checar(d.corpo === false && d.songVisivel === true,
    'D · uma cena de roteiro no ar (texto avulso) também troca a tela: é a MESMA pergunta do Parar', JSON.stringify(d));
  await pg.evaluate(() => { textoAvulsoNoAr = false; renderTransporteHabilitado(); });
  await quadros();

  // F · o voltar não fecha a Biblioteca encaixada
  const voltar = await pg.evaluate(() => ({ r: window.__avBack(), aberta: document.getElementById('hymnSearchPopup').classList.contains('open') }));
  checar(voltar.r === false && voltar.aberta === true,
    'F · o voltar do Android NÃO fecha a Biblioteca encaixada (ela é a tela) e segue para minimizar', JSON.stringify(voltar));

  // H · a caixa acompanha o layout
  await pg.setViewportSize({ width: 360, height: 640 });
  await esperar(pg, () => window.innerHeight === 640, null, 5000);
  await quadros();
  const h = await ler();
  checar(igual(h.popup, h.song, 2),
    'H · com a tela menor a Biblioteca continua encaixada na zona de leitura — as medidas saem do layout, não do CSS',
    'popup ' + h.popup + ' contra leitura ' + h.song);
  await pg.setViewportSize({ width: 390, height: 780 });
  await esperar(pg, () => window.innerHeight === 780, null, 5000);
  await quadros();

  // G · avançado desencaixa; voltar ao Modo Fácil encaixa
  await pg.evaluate(() => { setAppMode('full'); });
  await quadros();
  const g1 = await ler();
  checar(g1.corpo === false && g1.aberta === false,
    'G1 · no modo avançado a Biblioteca volta a ser uma janela fechada (desencaixa)', JSON.stringify(g1));
  await pg.evaluate(() => { setAppMode('simple'); });
  await quadros();
  const g2 = await ler();
  checar(g2.corpo === true && g2.aberta === true && igual(g2.popup, g2.song, 2),
    'G2 · e voltar ao Modo Fácil encaixa de novo', JSON.stringify(g2));

  // I2 · tela some de novo: a cortina volta e a Biblioteca sai
  await pg.evaluate(() => { webDisplayWin = null; renderSimpleCast(); });
  await quadros();
  const i2 = await ler();
  checar(i2.semTela === true && i2.aberta === false && i2.castVisivel === false,
    'I2 · se a tela cai, a cortina volta, a Biblioteca sai e o ícone de cast some', JSON.stringify(i2));

  checar(erros.length === 0, 'nenhum erro de página', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

falhas.length ? (console.log('\n' + falhas.length + ' falha(s).'), process.exit(1))
  : console.log('\nTodos passaram.');
