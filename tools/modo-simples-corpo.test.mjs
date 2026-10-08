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
//  J. A MÍDIA QUE NÃO USA O AUXILIAR DE LEITURA (v1.11.21): sem letra e sem páginas (vídeo,
//     imagem, áudio sem letra) a Biblioteca ocupa o lugar da placa vazia — a mesma tela principal
//     de quando nada toca —, com o card do nome à vista ABAIXO dela; o card não existe sem mídia.
//  I. O CABEÇALHO É CAST · NOME · ENGRENAGEM (v1.11.15): o nome do app no centro da barra
//     de topo, com ou sem TV, sem a badge de versão; e SEM o botão de playlist automática
//     (só no Modo Fácil — no avançado ele continua).
//
//   node tools/modo-simples-corpo.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import {
  servirEstatico, abrirNavegador, esperar, esperarCortina, porque, checar, falhas, lerPng, pixel,
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
      card: caixa(document.querySelector('.simple-nowplaying')),
      cardVisivel: vis(document.querySelector('.simple-nowplaying')),
      cardNome: document.getElementById('simpleNpName').textContent,
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

  // C · mídia no ar COM LETRA: a leitura é a tela, e a BARRA continua à vista
  // (Sem letra e sem páginas a mídia não usa o auxiliar, e a Biblioteca fica — ver o bloco J.)
  const LETRA = { id: 'm-letra', name: 'Louvor de Fundo', kind: 'audio',
    lyrics: [{ cover: true }, { time: 0, text: 'primeira' }, { time: 5, text: 'segunda' }] };
  // O NOME vem do `.nowplaying` do avançado, que o Modo Fácil espelha em `renderSimple`.
  const noAr = (item) => pg.evaluate((it) => {
    currentItem = it; midiaNoAr = true; npNameInnerEl.textContent = it.name;
    renderSimple(); renderTransporteHabilitado();
  }, item);
  await noAr(LETRA);
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
  checar(c.cardVisivel === true && c.card[0] >= c.song[3] - 1 && c.cardNome === 'Louvor de Fundo',
    'C6 · o card do NOME e da barra mora ABAIXO da zona de leitura (v1.11.21), e não mais acima da placa',
    JSON.stringify({ card: c.card, song: c.song, nome: c.cardNome }));
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
  await pg.evaluate(() => { simpleSelecionarLinha(window.__li); closeHymnSearch(); });
  await noAr(LETRA);
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

  // H · O PARAR DEVOLVE A BIBLIOTECA NO TAMANHO CERTO (v1.11.13)
  // Relato do operador: *"quando dou stop em uma música … a biblioteca volta … mais encolhida
  // verticalmente do que deveria, deixando espaço sobrando abaixo. Mas ao interagir … ela se
  // atualiza e ocupa o tamanho correto"*. A caixa tem de terminar onde a zona de leitura termina,
  // SEM interação nenhuma — o que se mede é a camada contra a leitura, depois do Parar.
  const idMidia = await pg.evaluate(async () => (await AVDB.addMedia(new Blob(['x'], { type: 'audio/wav' }),
    { name: 'Louvor de Fundo', type: 'audio/wav', kind: 'audio', list: 'imports' })).id);
  const subirMidia = () => pg.evaluate(async (id) => {
    await send(id);
    currentItem.lyrics = [{ cover: true }, { time: 0, text: 'primeira' }, { time: 5, text: 'segunda' }];
    renderSlideNav();
  }, idMidia);
  const parar = () => pg.evaluate(() => { document.getElementById('simpleStop').click(); });
  const fimDaCaixa = (l) => [l.camada[3], l.song[3]];

  // H1 · o Parar DENTRO da animação de entrada da leitura (a medida tirada com a leitura 14 px
  // abaixo do lugar dela ficava para sempre: o `ResizeObserver` vê tamanho, não transformação)
  await subirMidia();
  await pg.waitForTimeout(40);
  const h1pre = await pg.evaluate(() => ({ entrando: document.querySelector('.simple-song').classList.contains('entrando'),
    midia: midiaNoAr === true }));
  checar(h1pre.entrando === true && h1pre.midia === true,
    'H1.0 · premissa: a mídia está no ar e a leitura ainda está ENTRANDO (animação de 14 px)', JSON.stringify(h1pre));
  await parar();
  await quadros();
  const h1 = await ler();
  checar(h1.principal === true && h1.aberta === true && Math.abs(h1.camada[3] - h1.song[3]) <= 2,
    'H1 · Parar com a leitura ainda entrando: a Biblioteca termina onde a zona de leitura termina '
    + '(a medida não leva a animação junto)', 'camada ' + fimDaCaixa(h1)[0] + ' contra leitura ' + fimDaCaixa(h1)[1]);

  // H2 · `--kb` ALTO SEM TECLADO (um evento de viewport perdido) não sobrevive à volta da tela
  // principal: `bottom` é `max(base, kb)`, e o excesso é o "espaço sobrando abaixo"
  await subirMidia();
  await quadros();
  await pg.evaluate(() => { document.documentElement.style.setProperty('--kb', '280px'); });
  await parar();
  await quadros();
  const h2 = await ler();
  const h2kb = await pg.evaluate(() => document.documentElement.style.getPropertyValue('--kb'));
  checar(h2.principal === true && Math.abs(h2.camada[3] - h2.song[3]) <= 2 && parseFloat(h2kb) === 0,
    'H2 · um `--kb` que ficou alto sem teclado é reconferido na volta da tela principal: a caixa ocupa a '
    + 'altura toda, sem 280 px de sobra', 'camada ' + fimDaCaixa(h2) + ' --kb ' + h2kb);

  // H3 · a medida é comparada com o que está ESCRITO na raiz, não com um cache em JS
  await pg.evaluate(() => { document.documentElement.style.removeProperty('--simple-corpo-base'); });
  const h3pre = await pg.evaluate(() => document.documentElement.style.getPropertyValue('--simple-corpo-base'));
  await pg.evaluate(() => { medirCorpoSimples(); });
  const h3 = await pg.evaluate(() => document.documentElement.style.getPropertyValue('--simple-corpo-base'));
  checar(h3pre === '' && /^\d+px$/.test(h3),
    'H3 · se a medida some da raiz, a remedição a ESCREVE de volta — um cache que discorda do documento '
    + 'seria uma medida que ninguém reescreve', JSON.stringify({ antes: h3pre, depois: h3 }));

  // H4 · e se a caixa AINDA assim sair do lugar, o Registro diz os números (e só quando muda)
  const linhasDaCaixa = () => pg.evaluate(() => diarioC.filter((x) => String(x.ev).includes('a caixa termina')).length);
  checar(await linhasDaCaixa() === 0,
    'H4.0 · os caminhos normais acima (parar, entrar, teclado perdido) NÃO produzem a linha de caixa fora do lugar',
    String(await linhasDaCaixa()));
  await pg.evaluate(() => { document.getElementById('hymnSearchPopup').style.bottom = '260px'; });
  await quadros();
  await pg.evaluate(() => { conferirCaixaDaBiblioteca(); conferirCaixaDaBiblioteca(); });
  const h4 = await pg.evaluate(() => diarioC.filter((x) => String(x.ev).includes('a caixa termina')).map((x) => x.ev));
  checar(h4.length === 1 && /base da leitura \d+, teclado \d+, altura da tela \d+/.test(h4[0]),
    'H4 · com a caixa fora do lugar o Registro ganha UMA linha com os números (base, teclado, altura da tela)',
    JSON.stringify(h4));
  await pg.evaluate(() => { document.getElementById('hymnSearchPopup').style.bottom = ''; });
  await quadros();

  // K · O TÍTULO DENTRO DA CAIXA DA LETRA, NO MODO FÁCIL TAMBÉM (v1.11.22)
  // Pedido do operador: *"o auxiliar de leitura no modo simples … não ganhou o título dentro da caixa da
  // letra. … deixe duas linhas de espaço entre o título e o resto da letra … remover a palavra 'início' …
  // transfira a formatação atual dessa palavra para o título"*.
  await noAr({ id: 'm-k', name: 'Firme nas promessas', hymnTrack: 12, hymnName: 'Firme nas promessas', kind: 'audio',
    lyrics: [{ cover: true }, { time: 0, text: 'primeira estrofe' }, { time: 5, text: 'segunda estrofe' }] });
  // A assinatura da zona é por `currentId`: sem trocá-lo a placa da mídia anterior seria reaproveitada.
  await pg.evaluate(() => { currentId = 'm-k'; refreshSimpleLyrics(); });
  await quadros();
  const k = await pg.evaluate(() => {
    const z = document.getElementById('simpleLyrics');
    const capa = z.querySelector('.lv-row--cover');
    const prox = capa && capa.nextElementSibling;
    const cs = capa && getComputedStyle(capa);
    const linha = parseFloat(getComputedStyle(z.querySelector('.lv-row--letra:not(.lv-row--cover)')).lineHeight);
    const fonte = parseFloat(getComputedStyle(z.querySelector('.lv-row--letra:not(.lv-row--cover)')).fontSize);
    return {
      primeiraEhCapa: z.firstElementChild === capa,
      texto: capa && capa.textContent,
      semInicio: !/in[ií]cio/i.test(z.textContent),
      caixa: !!capa && z.contains(capa),
      maiusculas: cs && cs.textTransform, cor: cs && cs.color,
      vao: prox ? prox.getBoundingClientRect().top - capa.getBoundingClientRect().bottom : null,
      umaLinha: linha, fonte,
    };
  });
  checar(k.caixa && k.primeiraEhCapa && k.texto === '12. Firme nas promessas' && k.semInicio,
    'K1 · no Modo Fácil o TÍTULO é a primeira linha DENTRO da caixa da letra (a linha de capa) e a palavra '
    + '"Início" não existe', JSON.stringify(k));
  checar(k.maiusculas === 'uppercase',
    'K2 · e ele ganhou a formatação que era da palavra "Início" (a da linha de capa)', JSON.stringify(k));
  checar(k.vao !== null && Math.abs(k.vao - k.umaLinha) <= 1.5,
    'K3 · e há UMA LINHA da letra de espaço entre o título e o resto (' + (k.vao && k.vao.toFixed(1)) + 'px contra '
    + k.umaLinha.toFixed(1) + '; eram duas até a v1.12.10)', JSON.stringify(k));
  // L · O TÍTULO ACOMPANHA O A+/A− (v1.11.23)
  // Pedido do operador: *"o título dentro do auxiliar de leitura não aumenta proporcionalmente quando
  // se aumenta a fonte do texto da letra"*. O corpo do título era `--fs-3xl` fixo; agora é um fator do
  // `--lv-fonte`, o mesmo token que o A+/A− escreve — e é SEMPRE maior que o corpo da letra, na proporção 1,2 (v1.12.4: a v1.12.3 o escalava mas o deixava MENOR).
  const fontesL = () => pg.evaluate(() => {
    const z = document.getElementById('simpleLyrics');
    const t = parseFloat(getComputedStyle(z.querySelector('.lv-row--cover')).fontSize);
    const c = parseFloat(getComputedStyle(z.querySelector('.lv-row--letra:not(.lv-row--cover)')).fontSize);
    return { titulo: t, corpo: c };
  });
  const l0 = await fontesL();
  await pg.evaluate(() => { document.documentElement.style.setProperty('--lv-fonte', '2.1rem'); });
  await quadros();
  const l1 = await fontesL();
  await pg.evaluate(() => { document.documentElement.style.setProperty('--lv-fonte', '1.4rem'); });
  checar(l0.titulo > l0.corpo * 1.1 && Math.abs(l0.titulo / l0.corpo - 1.2) < 0.02,
    'L1 · no degrau BASE o título é MAIOR que a letra (razão 1,2): era 18,4px contra 22,4px da letra',
    JSON.stringify(l0));
  checar(l1.titulo > l0.titulo * 1.4 && l1.titulo > l1.corpo * 1.1 && Math.abs(l1.titulo / l1.corpo - l0.titulo / l0.corpo) < 0.02,
    'L2 · e ele CRESCE junto com a letra quando o A+ sobe o `--lv-fonte`, seguindo MAIOR que ela (a razão título/corpo se mantém)',
    JSON.stringify({ base: l0, grande: l1 }));

  // M · A SOMBRA DA PLACA FICA POR BAIXO DO BLOQUEIO "SEM TELA" (v1.11.23)
  // Pedido do operador: *"no modo simples durante o bloqueio de tela inicial, a sombra inferior do
  // auxiliar de leitura fica sobre o blur do desfoque, aparecendo perdida na tela"*. A tira de sombra
  // (`.rola::after`, z-index 5) escapava da zona de leitura e vencia o véu (z 1). A prova é de PIXEL
  // e não de ordem: com o véu OPACO nada que esteja sob ele pode aparecer, então a base da placa tem
  // de ler exatamente a cor do véu — a tira, se escapasse, escureceria aquelas linhas.
  await pg.evaluate(() => {
    const linhas = [{ cover: true }];
    for (let i = 0; i < 40; i++) linhas.push({ time: i * 4, text: 'estrofe número ' + i + ' da letra em teste' });
    currentItem = Object.assign({}, currentItem, { lyrics: linhas });
    webDisplayWin = null; renderSimpleCast(); refreshSimpleLyrics();
  });
  await quadros();
  await pg.addStyleTag({ content: '.simple-veil{background:#ff00ff!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}' });
  const m = await pg.evaluate(() => {
    const z = document.getElementById('simpleLyrics');
    const r = z.getBoundingClientRect();
    return { semTela: document.getElementById('simpleMode').classList.contains('sem-tela'),
      temAbaixo: z.classList.contains('tem-abaixo'), esq: r.left, base: r.bottom, topo: r.top, larg: r.width };
  });
  const png = lerPng(await pg.screenshot());
  const amostras = [6, 12, 18].map((d) => pixel(png, Math.round(m.esq + m.larg / 2), Math.round(m.base - d)));
  const magenta = (c) => c[0] > 240 && c[1] < 15 && c[2] > 240;
  checar(m.semTela && m.temAbaixo && amostras.every(magenta),
    'M1 · sem tela, com o véu opaco a BASE da placa lê só a cor do véu: a sombra de baixo da leitura fica POR BAIXO '
    + 'dele (`.simple-song` isola o `z-index` da tira)', JSON.stringify({ m, amostras }));
  await pg.evaluate(() => { webDisplayWin = { closed: false }; renderSimpleCast(); });
  await pg.evaluate(() => { currentItem = Object.assign({}, currentItem, { lyrics: [{ cover: true }, { time: 0, text: 'primeira estrofe' }, { time: 5, text: 'segunda estrofe' }] }); refreshSimpleLyrics(); });
  await quadros();
  await pg.evaluate(() => { midiaNoAr = false; renderSimple(); renderTransporteHabilitado(); });
  await quadros();

  // N · O CARD DO NOME NÃO SE MEXE (v1.12.11)
  // Pedido do operador: *"verifique no modo simples um deslocamento vertical não intencional no card
  // de mídia atual … devido aos ajustes de altura da caixa do auxiliar de leitura e da biblioteca"*.
  // O card tem UMA altura enquanto há mídia no ar: a linha do tempo some da vista (carregando a
  // duração, mídia sem duração) mas continua OCUPANDO o lugar, e um nome ainda vazio mantém a linha.
  // Antes ele encolhia 25,6 px sem barra (e 18 px sem nome): o topo dele andava, a zona de leitura
  // crescia e encolhia, e com ela a caixa da Biblioteca.
  await noAr(LETRA);
  await pg.evaluate(() => { seekEl.disabled = false; seekEl.max = '120'; renderSimpleTime(); });
  await quadros();
  const medirN = () => pg.evaluate(() => {
    const c = document.querySelector('.simple-nowplaying').getBoundingClientRect();
    const sg = document.querySelector('.simple-song').getBoundingClientRect();
    const bar = document.getElementById('simpleTime');
    const cs = getComputedStyle(bar);
    return { cardTop: +c.top.toFixed(1), cardH: +c.height.toFixed(1), songH: +sg.height.toFixed(1),
      barraOcupa: bar.getBoundingClientRect().height > 0, barraVisivel: cs.visibility !== 'hidden' };
  });
  const n0 = await medirN();
  await pg.evaluate(() => { seekEl.disabled = true; renderSimpleTime(); });
  await quadros();
  const n1 = await medirN();
  checar(n0.barraVisivel && n0.cardH > 50 && n1.barraVisivel === false && n1.barraOcupa === true,
    'N0 · PREMISSA: com duração a barra está à vista; sem ela some da vista e continua OCUPANDO o lugar',
    JSON.stringify({ n0, n1 }));
  checar(Math.abs(n1.cardTop - n0.cardTop) <= .5 && Math.abs(n1.cardH - n0.cardH) <= .5 && Math.abs(n1.songH - n0.songH) <= .5,
    'N1 · a linha do tempo ir e vir NÃO move o card nem muda a zona de leitura (topo, altura do card e '
    + 'altura da leitura iguais)', JSON.stringify({ n0, n1 }));
  await pg.evaluate(() => { document.getElementById('simpleNpName').textContent = ''; });
  await quadros();
  const n2 = await medirN();
  checar(Math.abs(n2.cardTop - n0.cardTop) <= .5 && Math.abs(n2.cardH - n0.cardH) <= .5,
    'N2 · e o nome ainda vazio (a troca de mídia escreve depois) mantém a linha: o card não encolhe',
    JSON.stringify({ n0, n2 }));
  await pg.evaluate(() => { seekEl.disabled = false; seekEl.max = '120'; renderSimpleTime(); document.getElementById('simpleNpName').textContent = 'Louvor de Fundo'; });
  await quadros();
  const n3 = await medirN();
  // A caixa da Biblioteca aberta sobre a leitura mede a MESMA zona antes e depois.
  await pg.evaluate(() => { document.getElementById('hymnSearchInput').focus(); });
  await quadros();
  const n4 = await medirN();
  await pg.evaluate(() => { closeHymnSearch(); document.activeElement && document.activeElement.blur(); });
  await quadros();
  const n5 = await medirN();
  checar([n3, n4, n5].every((n) => Math.abs(n.cardTop - n0.cardTop) <= .5),
    'N3 · abrir e fechar a Biblioteca sobre a leitura não mexe no card (topo igual nos três estados)',
    JSON.stringify({ n0, n3, n4, n5 }));

  // O · A TROCA ENTRE A LEITURA E A BIBLIOTECA ANIMA, NÃO PISCA (v1.12.12)
  // Pedido do operador: *"melhore as animações de alternância entre o auxiliar de leitura no modo
  // simples e a biblioteca, está sem animação, apenas pisca a troca de telas"*. A medida da base da
  // leitura mudava no mesmo pulso da troca (o card do nome aparece/some) e desligava a transição da
  // janela: ela PULAVA num quadro. E a leitura sumia no ato, antes de a janela descer sobre ela.
  // A prova é de TRAJETÓRIA: a base da janela por quadro tem de passar por posições intermediárias.
  const trajeto = async (acao) => {
    await pg.evaluate(() => {
      const pop = document.getElementById('hymnSearchPopup'); const song = document.querySelector('.simple-song');
      window.__traj = { amostras: [], fim: false };
      const laco = () => { window.__traj.amostras.push({ b: Math.round(pop.getBoundingClientRect().bottom), v: getComputedStyle(song).visibility });
        if (!window.__traj.fim) requestAnimationFrame(laco); };
      laco();
    });
    await acao();
    await pg.waitForTimeout(900);
    return pg.evaluate(() => {
      window.__traj.fim = true;
      const am = window.__traj.amostras; const bs = am.map((x) => x.b);
      const ini = bs[0], fi = bs[bs.length - 1];
      const lo = Math.min(ini, fi), hi = Math.max(ini, fi);
      return { ini, fi, intermediarias: new Set(bs.filter((b) => b > lo + 20 && b < hi - 20)).size,
        escondeuCedo: fi > ini && am.some((x) => x.v === 'hidden' && x.b < fi - 20) };
    });
  };
  await subirMidia();
  await quadros();
  const o1 = await trajeto(parar);
  checar(o1.fi - o1.ini > 300 && o1.intermediarias >= 5,
    'O1 · Parar: a Biblioteca DESCE passando por posições intermediárias (não pula num quadro)', JSON.stringify(o1));
  checar(o1.escondeuCedo === false,
    'O2 · e a leitura só é escondida quando a janela já a cobriu (não some antes dela chegar)', JSON.stringify(o1));
  const o3 = await trajeto(subirMidia);
  checar(o3.ini - o3.fi > 300 && o3.intermediarias >= 5,
    'O3 · a mídia que entra: a Biblioteca SOBE recolhendo para a barra, também passando por posições intermediárias',
    JSON.stringify(o3));

  // P · A CAIXA SE CURA SOZINHA DEPOIS DE ASSENTAR (v1.12.13)
  // Relato do operador: *"verifique o ajuste de altura disponível para a biblioteca no modo simples,
  // após o stop, pois ela está ficando encurtada, ao que parece, no mesmo tamanho de quando há
  // teclado aberto"*. Não reproduzido em mesa (o Parar sai certo, com e sem teclado simulado); o
  // que sustenta o lote é a conferência que roda DEPOIS da animação: ela reconfere o teclado e, se
  // a medida da raiz ficou para trás, a REFAZ — antes só anotava no Registro, e a caixa ficava
  // curta até uma interação qualquer. A prova injeta as duas causas, sem foco e sem interação.
  await pg.evaluate(() => { currentItem = null; midiaNoAr = false; renderSimple(); renderTransporteHabilitado(); });
  await quadros();
  const p0 = await ler();
  checar(p0.principal === true && Math.abs(p0.camada[3] - p0.song[3]) <= 2,
    'P0 · PREMISSA: a Biblioteca está como tela principal, com a base na base da leitura', JSON.stringify(p0));
  await pg.evaluate(() => {
    document.documentElement.style.setProperty('--simple-corpo-base', '300px');
    document.documentElement.style.setProperty('--kb', '280px');
    hymnSearchPopupEl.dispatchEvent(new TransitionEvent('transitionend', { propertyName: 'bottom' }));
  });
  await quadros();
  const p1 = await ler();
  checar(Math.abs(p1.camada[3] - p1.song[3]) <= 2,
    'P1 · a medida velha da raiz E um `--kb` alto sem teclado são refeitos quando a janela assenta: a caixa '
    + 'volta a ir até a base da leitura, sem interação nenhuma', 'camada ' + p1.camada + ' contra ' + p1.song);

  // J · A MÍDIA QUE NÃO USA O AUXILIAR DE LEITURA (v1.11.21)
  // Pedido do operador: *"vamos aproveitar para aprimorar a experiência durante a exibição de um
  // vídeo ou mídia que não usa o auxiliar de leitura. Nesses casos, a área do auxiliar de leitura
  // pode ser substituída pela exibição aberta da biblioteca, para não manter uma seção sem
  // conteúdo visível para o usuário"* — e *"essa seção de mídia em exibição, vamos colocar ela
  // abaixo do auxiliar de leitura"*.
  // Sem letra e sem páginas (um vídeo, uma imagem, um áudio sem letra) a placa ficaria vazia; a
  // Biblioteca ocupa o lugar dela — a MESMA tela principal de quando nada toca — e o card do nome
  // fica à vista logo abaixo. É a pergunta do Parar MAIS a pergunta da zona de leitura.
  const VIDEO = { id: 'v-sem-letra', name: 'Vídeo do Culto', kind: 'video' };
  await pg.evaluate(() => { document.getElementById('simpleStop').click(); });
  await quadros();
  const j0 = await ler();
  checar(j0.cardVisivel === false,
    'J0 · sem mídia no ar o card do nome NÃO existe: "Nada tocando" sob a Biblioteca seria só ruído',
    JSON.stringify(j0));
  await noAr(VIDEO);
  await quadros();
  const j1 = await ler();
  checar(j1.principal === true && j1.aberta === true && j1.songVisivel === false && igual(j1.camada, caixaCheia(j1), 2),
    'J1 · com um vídeo (sem letra e sem páginas) no ar a Biblioteca OCUPA a zona de leitura: aberta, '
    + 'encaixada nas quatro bordas e com a placa vazia escondida por baixo', JSON.stringify(j1));
  checar(j1.cardVisivel === true && j1.cardNome === 'Vídeo do Culto' && j1.card[0] >= j1.song[3] - 1
      && j1.card[0] >= j1.camada[3] - 1,
    'J2 · e o card do NOME fica à vista ABAIXO dela — fora da medida da Biblioteca, que não o cobre',
    JSON.stringify({ card: j1.card, camada: j1.camada, song: j1.song, nome: j1.cardNome }));
  checar(j1.toggle === false && j1.foco !== 'hymnSearchInput',
    'J3 · como tela principal ela abre SEM foco e sem a seta/✕ — não é uma janela que se fecha', JSON.stringify(j1));
  const voltarJ = await pg.evaluate(() => ({ r: window.__avBack(), aberta: document.getElementById('hymnSearchPopup').classList.contains('open') }));
  checar(voltarJ.r === false && voltarJ.aberta === true,
    'J4 · o voltar do Android NÃO a fecha: fechada, o corpo ficaria vazio', JSON.stringify(voltarJ));
  // Letra chega à mídia: a leitura volta a ser a tela, a Biblioteca recolhe para a barra
  await pg.evaluate(() => { currentItem = Object.assign({}, currentItem, { lyrics: [{ cover: true }, { time: 0, text: 'x' }] }); renderSlideNav(); });
  await quadros();
  const j5 = await ler();
  checar(j5.principal === false && j5.aberta === false && j5.songVisivel === true && igual(j5.camada, caixaBarra(j5), 2),
    'J5 · se a mídia passa a ter letra a Biblioteca sai e a leitura volta a ser a tela, com a barra à vista',
    JSON.stringify(j5));
  checar(j5.cardVisivel === true && j5.card[0] >= j5.song[3] - 1,
    'J6 · e o card segue ABAIXO da leitura nos dois estados', JSON.stringify({ card: j5.card, song: j5.song }));
  await pg.evaluate(() => { currentItem = Object.assign({}, currentItem, { lyrics: undefined }); renderSlideNav(); });
  await quadros();
  const j7 = await ler();
  checar(j7.principal === true && j7.aberta === true && igual(j7.camada, caixaCheia(j7), 2),
    'J7 · e sem letra de novo a Biblioteca volta a ocupar o lugar da placa (ida e volta, sem estado preso)',
    JSON.stringify(j7));
  // J8 · escolher OUTRA mídia sem letra, estando numa: a Biblioteca segue a tela, e o vigia desfaz a marca
  await plantar();
  await pg.evaluate(() => { document.getElementById('hymnSearchInput').value = 'amor'; });
  await pg.evaluate(() => { simpleSelecionarLinha(window.__li); closeHymnSearch(); simpleSel.em -= 6000; });
  const desfezJ = await esperar(pg, () => !document.querySelector('.hymn-result.selecionando')
    && document.getElementById('hymnSearchInput').value === '', null, 15000);
  checar(desfezJ === true,
    'J8 · escolher outra mídia sem letra com uma já no ar: a Biblioteca CONTINUA a tela e o vigia a '
    + 'reinicia — a linha não fica marcada para sempre sobre uma tela que nunca vai sair', porque(desfezJ));
  const j8 = await ler();
  checar(j8.principal && j8.aberta, 'J9 · e ela segue como tela principal', JSON.stringify(j8));
  await pg.evaluate(() => { midiaNoAr = false; renderSimple(); renderTransporteHabilitado(); });
  await quadros();

  // I · O CABEÇALHO: CAST À ESQUERDA, NOME NO CENTRO, ENGRENAGEM À DIREITA (v1.11.15)
  // Pedido do operador: *"coloque o nome do app na tela do modo simples, centralizado na barra de
  // topo, e pode remover o número da versão dessa tela … o botão de espelhamento/cast no topo
  // esquerdo … cast à esquerda, nome centralizado e botão de configurações na direita"* · *"aproveite
  // para remover o botão de playlist automática no modo simples"*.
  const lerCab = () => pg.evaluate(() => {
    const r = (el) => { const b = el.getBoundingClientRect(); return { l: b.left, r: b.right, w: b.width }; };
    const cast = document.getElementById('simpleCastBtn');
    const marca = document.querySelector('.simple-brand');
    const eng = document.getElementById('simpleSettingsBtn');
    const rng = document.createRange(); rng.selectNodeContents(marca);
    const t = rng.getBoundingClientRect();
    return {
      cast: r(cast), marca: r(marca), eng: r(eng),
      castVisivel: getComputedStyle(cast).display !== 'none',
      textoCentro: (t.left + t.right) / 2, vw: document.documentElement.clientWidth,
      texto: marca.textContent.replace(/\s+/g, ' ').trim(),
      semBadge: document.getElementById('simpleVersion') === null && document.querySelector('.ver-badge') === null,
      sorteio: getComputedStyle(document.getElementById('sorteioBtn')).display,
    };
  });
  const cab1 = await lerCab();
  checar(cab1.castVisivel && cab1.cast.r <= cab1.marca.l + 0.5 && cab1.marca.r <= cab1.eng.l + 0.5,
    'I1 · o topo é CAST à esquerda, NOME no meio e ENGRENAGEM à direita, nessa ordem', JSON.stringify(cab1));
  checar(Math.abs(cab1.textoCentro - cab1.vw / 2) <= 1 && cab1.texto === 'Audio Visual IASD',
    'I2 · o NOME do app está CENTRALIZADO na barra de topo (o centro do texto é o centro da tela)', JSON.stringify(cab1));
  checar(cab1.semBadge,
    'I3 · e a badge de versão não existe mais nesta tela — o número mora só no rodapé de Configurações',
    JSON.stringify(cab1));
  checar(cab1.sorteio === 'none',
    'I4 · o botão de PLAYLIST AUTOMÁTICA não é desenhado no Modo Fácil — a barra fica com o campo',
    cab1.sorteio);

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
  const sorteioAvancado = await pg.evaluate(() => getComputedStyle(document.getElementById('sorteioBtn')).display);
  checar(sorteioAvancado !== 'none',
    'G3b · e no avançado o botão de playlist automática CONTINUA: a regra é só do Modo Fácil', sorteioAvancado);
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
  const cab2 = await lerCab();
  checar(cab2.castVisivel === false && Math.abs(cab2.textoCentro - cab2.vw / 2) <= 1,
    'G5b · SEM TV o cast some e o NOME continua no centro: cada peça do topo tem a coluna dela', JSON.stringify(cab2));

  checar(erros.length === 0, 'nenhum erro de página', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

falhas.length ? (console.log('\n' + falhas.length + ' falha(s).'), process.exit(1))
  : console.log('\nTodos passaram.');
