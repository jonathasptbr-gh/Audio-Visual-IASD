#!/usr/bin/env node
// ============================================================================
// MODO FÁCIL: BARRA DA BIBLIOTECA SEMPRE À VISTA, BIBLIOTECA COMO TELA PRINCIPAL
// SEM MÍDIA, E A ESCOLHA COM CALMA (v1.11.11 → v1.11.12)
//
// Pedidos do operador, verbatim:
//  · (v1.11.11) *"vamos remover a visualização da preview no modo simples … remover o
//    botão 'buscar música', ao invés dele, vamos manter diretamente exposto a barra
//    de busca no topo e a biblioteca no corpo … sem mídia tocando, a biblioteca é a
//    tela principal, com mídia tocando, o auxiliar de leitura é a tela principal"*;
//  · (v1.11.12) *"mantenha a barra de buscas da biblioteca sempre visível no modo
//    simples. Isso vai permitir que mesmo se houver algo tocando, seja possível
//    pesquisar e selecionar uma outra música. Quando o foco for para a caixa de
//    buscas, a tela principal muda do auxiliar de leitura … para a biblioteca"*;
//  · (v1.11.12) *"melhore o feedback visual ao selecionar uma música … faça o
//    feedback do toque, com calma, depois a animação de fechamento da tela da
//    biblioteca e a animação de entrada do auxiliar de leitura. Atualmente a tela
//    está simplesmente piscando"*.
//
// O que este arquivo trava, e cada uma falha CALADA:
//  A. SEM TELA a cortina manda: nem a barra nem a Biblioteca existem por trás dela.
//  B. COM TELA e nada no ar a Biblioteca é a TELA PRINCIPAL: encaixada nas bordas do
//     espaço da barra + zona de leitura, sem seta e sem foco, e a prévia, o
//     "Buscar música" e a faixa que os hospedava não existem.
//  C. COM MÍDIA NO AR a leitura é a tela — pela MESMA pergunta do Parar, então pausar
//     não troca — e a BARRA continua à vista, alcançável, acima da leitura.
//  D. O CAMPO É O GATILHO: o foco abre a Biblioteca SOBRE a leitura; ✕ e o voltar a
//     fecham; como principal o voltar NÃO a fecha.
//  E. PARAR devolve a Biblioteca com o campo limpo; cena de roteiro conta como "no ar".
//  F. A ESCOLHA TEM COREOGRAFIA: a linha tocada fica marcada e a Biblioteca NÃO sai na
//     hora (nem como principal, com a mídia entrando rápido, nem sobre a leitura);
//     depois ela recolhe, a leitura ENTRA, e só então o campo é limpo. Se a escolha não
//     dá em mídia, o vigia desfaz a marca e reinicia a Biblioteca.
//  G. Sair do Modo Fácil desencaixa; a caixa acompanha o layout; o ícone de cast do
//     cabeçalho existe com tela, some sem ela e chama `abrirCast`.
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

  // Espera as animações da janela terminarem (a camada anima só o `bottom`).
  const quadros = () => pg.evaluate(async () => {
    await new Promise((r) => setTimeout(r, 450));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  const ler = () => pg.evaluate(() => {
    const caixa = (el) => { const r = el.getBoundingClientRect(); return [r.top, r.left, r.right, r.bottom].map((n) => Math.round(n)); };
    const campo = document.getElementById('hymnSearchInput');
    const rc = campo.getBoundingClientRect();
    const alvo = document.elementFromPoint(rc.left + rc.width / 2, rc.top + rc.height / 2);
    const cast = document.getElementById('simpleCastBtn');
    const song = document.querySelector('.simple-song');
    const vis = (el) => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
      return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
    return {
      barraCls: document.body.classList.contains('simples-barra'),
      principal: document.body.classList.contains('simples-principal'),
      semTela: document.getElementById('simpleMode').classList.contains('sem-tela'),
      aberta: document.getElementById('hymnSearchPopup').classList.contains('open'),
      camada: caixa(document.getElementById('hymnSearchPopup')),
      espaco: caixa(document.getElementById('simpleBarra')),
      song: caixa(song),
      songVisivel: getComputedStyle(song).visibility !== 'hidden',
      campoAlcanca: !!alvo && (alvo === campo || campo.contains(alvo) || alvo.closest('.lib-search-campo') !== null),
      campoVisivel: vis(campo) && rc.top >= 0 && rc.bottom <= window.innerHeight,
      foco: document.activeElement && document.activeElement.id,
      toggle: vis(document.getElementById('hymnSearchToggle')),
      previa: document.getElementById('preview').getBoundingClientRect().height,
      semBuscar: document.getElementById('simpleSearchBtn') === null,
      semFaixa: document.getElementById('simpleStage') === null,
      castVisivel: vis(cast), castConectado: cast.classList.contains('connected'),
    };
  });
  const igual = (a, b, t) => a.every((n, i) => Math.abs(n - b[i]) <= t);
  // A caixa da Biblioteca ABERTA = o espaço da barra + a zona de leitura.
  const caixaCheia = (l) => [l.espaco[0], l.song[1], l.song[2], l.song[3]];
  // A caixa FECHADA = só o espaço da barra.
  const caixaBarra = (l) => l.espaco;

  // A · SEM TELA
  await pg.evaluate(() => { renderSimpleCast(); });
  await quadros();
  const a = await ler();
  checar(a.semTela === true && a.aberta === false && a.barraCls === false && a.campoVisivel === false,
    'A · sem tela conectada a cortina cobre o modo: a Biblioteca não abre e a BARRA também não '
    + 'existe por trás dela', JSON.stringify(a));
  checar(a.castVisivel === false,
    'A2 · e o ícone de cast do cabeçalho some sem tela: a seção de conexão já é a tela inteira', JSON.stringify(a));

  // B · COM TELA e nada no ar: a Biblioteca é a tela principal
  await pg.evaluate(() => { webDisplayWin = { closed: false }; renderSimpleCast(); });
  await quadros();
  const b = await ler();
  checar(b.semTela === false && b.barraCls && b.principal && b.aberta,
    'B1 · com tela e nada no ar a Biblioteca ABRE sozinha como tela principal', JSON.stringify(b));
  checar(igual(b.camada, caixaCheia(b), 2),
    'B2 · e está ENCAIXADA: a camada cobre o espaço da barra MAIS a zona de leitura (as quatro bordas)',
    'camada ' + b.camada + ' contra ' + caixaCheia(b));
  checar(b.songVisivel === false,
    'B3 · a zona de leitura fica ESCONDIDA por baixo', JSON.stringify(b));
  checar(b.campoAlcanca === true && b.campoVisivel,
    'B5 · o campo está à vista e recebe o toque (nada por cima)', JSON.stringify(b));
  checar(b.foco !== 'hymnSearchInput',
    'B6 · abre SEM foco: é a tela, não uma busca começada — o teclado não sobe sozinho', b.foco);
  checar(b.toggle === false,
    'B7 · sem a seta/✕: como tela principal ela não é uma janela que se fecha', JSON.stringify(b));
  checar(b.previa === 0 && b.semBuscar && b.semFaixa,
    'B8 · a prévia não ocupa lugar, e o "Buscar música" e a faixa que os hospedava não existem',
    JSON.stringify({ previa: b.previa, semBuscar: b.semBuscar, semFaixa: b.semFaixa }));
  checar(b.castVisivel === true && b.castConectado === true,
    'B9 · o ícone de cast do cabeçalho está à vista e VERDE (há tela recebendo)', JSON.stringify(b));
  const abriuCast = await pg.evaluate(() => {
    let chamou = 0; const orig = window.abrirCast; window.abrirCast = () => { chamou++; };
    document.getElementById('simpleCastBtn').click();
    window.abrirCast = orig;
    return chamou;
  });
  checar(abriuCast === 1,
    'G1 · tocar o ícone de cast do cabeçalho chama o `abrirCast` (trocar de tela ou desconectar)', String(abriuCast));

  await pg.fill('#hymnSearchInput', 'zzzzqq');
  await esperar(pg, () => !document.getElementById('hymnSearchLimpar').hidden, null, 10000);
  const nasBuscas = await esperar(pg, () => !document.querySelector('#hymnResults .hymnal-card, #hymnResults .coll-group'), null, 10000);
  checar(nasBuscas === true, 'B10b · PREMISSA: com o termo digitado a lista saiu do acervo', porque(nasBuscas));
  const comTexto = await ler();
  checar(comTexto.aberta === true && comTexto.principal === true,
    'B10 · digitar no campo mantém a Biblioteca como tela principal (o ✕ de limpar aparece junto)', JSON.stringify(comTexto));
  // B11 · FECHAR com a Biblioteca como PRINCIPAL é REINICIAR (o corpo não pode ficar vazio).
  const reinicio = await pg.evaluate(async () => {
    closeHymnSearch();
    // NO MESMO TURNO: um redesenho vindo de outro caminho esconderia a falta do
    // `renderSearchResults('')`.
    const acervo = !!document.querySelector('#hymnResults .hymnal-card, #hymnResults .coll-group');
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return {
      aberta: document.getElementById('hymnSearchPopup').classList.contains('open'),
      principal: document.body.classList.contains('simples-principal'),
      campo: document.getElementById('hymnSearchInput').value,
      limpar: document.getElementById('hymnSearchLimpar').hidden,
      acervo,
    };
  });
  checar(reinicio.aberta === true && reinicio.principal === true && reinicio.campo === '' && reinicio.limpar === true,
    'B11 · `closeHymnSearch` com a Biblioteca PRINCIPAL a reinicia em vez de fechá-la: o corpo não pode '
    + 'ficar vazio durante um download que ainda não pôs a mídia no ar', JSON.stringify(reinicio));
  checar(reinicio.acervo === true,
    'B12 · e o acervo volta ao estado padrão — não fica nos resultados de um termo que o campo já não tem',
    JSON.stringify(reinicio));

  // C · mídia no ar: a leitura é a tela, e a BARRA continua à vista
  await pg.evaluate(() => { midiaNoAr = true; renderTransporteHabilitado(); });
  await quadros();
  const c = await ler();
  checar(c.principal === false && c.aberta === false && c.songVisivel === true,
    'C1 · com mídia no ar a Biblioteca sai e a zona de leitura volta a ser a tela principal', JSON.stringify(c));
  checar(c.barraCls && c.campoVisivel && c.campoAlcanca && igual(c.camada, caixaBarra(c), 2),
    'C3 · e a BARRA de busca continua à vista no topo: a camada fechada tem a altura do espaço da barra, '
    + 'pousa sobre ele e o campo recebe o toque', JSON.stringify({ camada: c.camada, espaco: c.espaco, campoAlcanca: c.campoAlcanca }));
  checar(c.song[0] >= c.espaco[3] - 1,
    'C4 · e a leitura fica ABAIXO da barra, sem ser coberta por ela', JSON.stringify({ song: c.song, espaco: c.espaco }));
  checar(c.toggle === false,
    'C5 · fechada, a seta não aparece: o campo é o gatilho', JSON.stringify(c));
  await pg.evaluate(() => { setPlaying(false); renderTransporteHabilitado(); });
  await quadros();
  const cp = await ler();
  checar(cp.principal === false && cp.songVisivel === true,
    'C2 · pausar NÃO traz a Biblioteca de volta: a mídia continua no ar (a pergunta é a do Parar)', JSON.stringify(cp));

  // D · O CAMPO É O GATILHO
  await pg.click('#hymnSearchInput');
  await esperar(pg, () => document.getElementById('hymnSearchPopup').classList.contains('open'), null, 10000);
  await quadros();
  const d = await ler();
  checar(d.aberta && d.principal === false && igual(d.camada, caixaCheia(d), 2),
    'D1 · tocar no campo, com mídia no ar, abre a Biblioteca SOBRE a leitura: a camada cresce da barra até a '
    + 'base da zona de leitura', JSON.stringify({ camada: d.camada, esperado: caixaCheia(d) }));
  checar(d.toggle === true,
    'D2 · e o ✕ aparece: aberta sobre a leitura há o que fechar', JSON.stringify(d));
  await pg.click('#hymnSearchToggle');
  await esperar(pg, () => !document.getElementById('hymnSearchPopup').classList.contains('open'), null, 10000);
  await quadros();
  const d3 = await ler();
  checar(!d3.aberta && igual(d3.camada, caixaBarra(d3), 2) && d3.songVisivel,
    'D3 · o ✕ recolhe a Biblioteca de volta para a barra e a leitura reaparece', JSON.stringify(d3));
  await pg.click('#hymnSearchInput');
  await esperar(pg, () => document.getElementById('hymnSearchPopup').classList.contains('open'), null, 10000);
  const voltar = await pg.evaluate(() => ({ r: window.__avBack(), aberta: document.getElementById('hymnSearchPopup').classList.contains('open') }));
  checar(voltar.r === true && voltar.aberta === false,
    'D4 · o voltar do Android fecha a Biblioteca aberta SOBRE a leitura', JSON.stringify(voltar));
  await quadros();

  // E · parar devolve a Biblioteca, com o campo limpo
  await pg.evaluate(() => { midiaNoAr = false; renderTransporteHabilitado(); });
  await quadros();
  const e = await ler();
  const campoLimpo = await pg.evaluate(() => document.getElementById('hymnSearchInput').value);
  checar(e.principal === true && e.aberta === true && e.songVisivel === false && igual(e.camada, caixaCheia(e), 2),
    'E1 · parar devolve a Biblioteca como tela principal, encaixada de novo', JSON.stringify(e));
  checar(campoLimpo === '',
    'E2 · e o campo de busca está LIMPO — fechar a Biblioteca (o ✕ e o voltar de D) apagou a palavra, que '
    + 'descreveria uma tela que já saiu', JSON.stringify(campoLimpo));
  const voltarP = await pg.evaluate(() => ({ r: window.__avBack(), aberta: document.getElementById('hymnSearchPopup').classList.contains('open') }));
  checar(voltarP.r === false && voltarP.aberta === true,
    'E3 · como tela PRINCIPAL o voltar NÃO fecha a Biblioteca e segue para minimizar', JSON.stringify(voltarP));
  await pg.evaluate(() => { textoAvulsoNoAr = true; renderTransporteHabilitado(); });
  await quadros();
  const e4 = await ler();
  checar(e4.principal === false && e4.songVisivel === true,
    'E4 · uma cena de roteiro no ar (texto avulso) também troca a tela: é a MESMA pergunta do Parar', JSON.stringify(e4));
  await pg.evaluate(() => { textoAvulsoNoAr = false; renderTransporteHabilitado(); });
  await quadros();

  // F · A ESCOLHA TEM COREOGRAFIA
  // Linha de mentira no acervo: o que se mede é a coreografia, não o download.
  const plantar = () => pg.evaluate(() => {
    const li = document.createElement('li'); li.className = 'lib-item hymn-result'; li.dataset.song = 'x:1';
    li.innerHTML = '<div class="row hymn-row"><div class="hymn-info"><span class="row-name hymn-name">001 — Louvor</span></div></div>';
    document.getElementById('hymnResults').prepend(li);
    window.__li = li;
  });
  const estado = () => pg.evaluate(() => ({
    sel: !!window.__li && window.__li.classList.contains('selecionando'),
    aberta: document.getElementById('hymnSearchPopup').classList.contains('open'),
    entrando: document.querySelector('.simple-song').classList.contains('entrando'),
    campo: document.getElementById('hymnSearchInput').value,
  }));
  // F1 · como PRINCIPAL, com a mídia entrando NA HORA (já baixada)
  await quadros();
  await plantar();
  await pg.evaluate(() => { document.getElementById('hymnSearchInput').value = 'amor'; });
  await pg.evaluate(() => { simpleSelecionarLinha(window.__li); closeHymnSearch(); midiaNoAr = true; renderTransporteHabilitado(); });
  await pg.evaluate(() => new Promise((r) => setTimeout(r, 120)));
  const f1 = await estado();
  checar(f1.sel && f1.aberta && !f1.entrando && f1.campo === 'amor',
    'F1 · 120 ms depois do toque, mesmo com a mídia JÁ no ar, a linha está MARCADA e a Biblioteca NÃO saiu — '
    + 'o feedback tem tempo de ser percebido, e nada piscou', JSON.stringify(f1));
  const saiu = await esperar(pg, () => !document.getElementById('hymnSearchPopup').classList.contains('open'), null, 10000);
  checar(saiu === true, 'F2 · depois do feedback a Biblioteca RECOLHE', porque(saiu));
  const f2 = await estado();
  checar(f2.entrando === true,
    'F3 · e a leitura ENTRA (animação), no mesmo movimento em que a Biblioteca recolhe', JSON.stringify(f2));
  checar(f2.campo === 'amor',
    'F3b · enquanto a Biblioteca RECOLHE o campo ainda tem a palavra: apagá-la agora seria a lista saltando '
    + 'para o estado padrão na frente de quem a tocou', JSON.stringify(f2));
  const limpou = await esperar(pg, () => document.getElementById('hymnSearchInput').value === ''
    && !document.querySelector('.hymn-result.selecionando'), null, 10000);
  checar(limpou === true,
    'F4 · só DEPOIS de recolher o campo é limpo e a marca da linha sai — a lista não salta para o estado '
    + 'padrão na frente de quem a tocou', porque(limpou));
  await quadros();

  // F5 · SOBRE A LEITURA (mídia já no ar): escolher outra música também espera e anima
  await pg.click('#hymnSearchInput');
  await esperar(pg, () => document.getElementById('hymnSearchPopup').classList.contains('open'), null, 10000);
  await plantar();
  await pg.evaluate(() => { simpleSelecionarLinha(window.__li); closeHymnSearch(); });
  await pg.evaluate(() => new Promise((r) => setTimeout(r, 120)));
  const f5 = await estado();
  checar(f5.sel && f5.aberta,
    'F5 · aberta SOBRE a leitura, escolher outra música marca a linha e NÃO fecha a Biblioteca na hora',
    JSON.stringify(f5));
  const saiu5 = await esperar(pg, () => !document.getElementById('hymnSearchPopup').classList.contains('open'), null, 10000);
  checar(saiu5 === true, 'F6 · e depois do feedback ela recolhe para a barra', porque(saiu5));
  const f6 = await estado();
  checar(f6.entrando === true, 'F7 · e a leitura entra', JSON.stringify(f6));
  await esperar(pg, () => !document.querySelector('.hymn-result.selecionando'), null, 10000);
  await quadros();

  // F8 · a escolha que NÃO vira mídia: o vigia desfaz a marca e reinicia
  await pg.evaluate(() => { midiaNoAr = false; renderTransporteHabilitado(); });
  await quadros();
  await plantar();
  await pg.evaluate(() => { document.getElementById('hymnSearchInput').value = 'amor'; });
  await pg.evaluate(() => { simpleSelecionarLinha(window.__li); closeHymnSearch(); simpleSel.em -= 6000; });
  const desfez = await esperar(pg, () => !document.querySelector('.hymn-result.selecionando')
    && document.getElementById('hymnSearchInput').value === '', null, 15000);
  checar(desfez === true,
    'F8 · se a escolha NÃO vira mídia (falhou, ou o cartão de espera foi cancelado) o vigia desfaz a marca e '
    + 'reinicia a Biblioteca — a linha não fica marcada para sempre', porque(desfez));
  const f8 = await ler();
  checar(f8.principal && f8.aberta, 'F9 · e a Biblioteca segue como tela principal', JSON.stringify(f8));

  // G · avançado desencaixa; a caixa acompanha o layout; a tela cai
  await pg.setViewportSize({ width: 360, height: 640 });
  await esperar(pg, () => window.innerHeight === 640, null, 5000);
  await quadros();
  const h = await ler();
  checar(igual(h.camada, caixaCheia(h), 2),
    'G2 · com a tela menor a Biblioteca continua encaixada — as medidas saem do layout, não do CSS',
    'camada ' + h.camada + ' contra ' + caixaCheia(h));
  await pg.setViewportSize({ width: 390, height: 780 });
  await esperar(pg, () => window.innerHeight === 780, null, 5000);
  await quadros();
  await pg.evaluate(() => { setAppMode('full'); });
  await quadros();
  const g1 = await ler();
  checar(g1.barraCls === false && g1.principal === false && g1.aberta === false,
    'G3 · no modo avançado a Biblioteca volta a ser uma janela fechada (desencaixa)', JSON.stringify(g1));
  await pg.evaluate(() => { setAppMode('simple'); });
  await quadros();
  const g2 = await ler();
  checar(g2.principal === true && g2.aberta === true && igual(g2.camada, caixaCheia(g2), 2),
    'G4 · e voltar ao Modo Fácil encaixa de novo', JSON.stringify(g2));
  await pg.evaluate(() => { webDisplayWin = null; renderSimpleCast(); });
  await quadros();
  const i2 = await ler();
  checar(i2.semTela === true && i2.aberta === false && i2.castVisivel === false && i2.barraCls === false,
    'G5 · se a tela cai, a cortina volta, a Biblioteca e a barra saem e o ícone de cast some', JSON.stringify(i2));

  checar(erros.length === 0, 'nenhum erro de página', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

falhas.length ? (console.log('\n' + falhas.length + ' falha(s).'), process.exit(1))
  : console.log('\nTodos passaram.');
