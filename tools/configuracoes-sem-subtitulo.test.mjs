#!/usr/bin/env node
// ============================================================================
// AS CONFIGURAÇÕES SEM A PALAVRA DO ESTADO (v1.7.2).
//
// ## Por que este oráculo existe
//
// A folha perdeu a segunda linha de cada tile, a pedido do operador: *"remova o
// subtítulo dos botões das configurações, todo tipo de informação além do nome
// deve ser representada pelo ícone"*. A palavra estava lá desde a v1.4.38 com
// uma razão escrita — *"um ícone sozinho responde por CONVENÇÃO, e convenção é
// o que se erra quando o app é aberto três vezes por semana"* —, e tirá-la sem
// mover a informação para o desenho é perder a informação.
//
// As três metades falham CALADAS, e em direções diferentes:
//
//  1. **A PALAVRA SAI E A INFORMAÇÃO FICA.** Um tile cujo estado não vira
//     desenho fica idêntico nos dois estados: o wallpaper "padrão" e o
//     "próprio" seriam o mesmo rolo, e o giro a 0° e a 180° a mesma seta. Nada
//     quebra, nada aparece no console — o botão simplesmente para de responder
//     à pergunta que ele existe para responder.
//  2. **O DESENHO TEM DE MUDAR NO RENDERIZADO.** Uma classe sem a regra de CSS
//     passa num teste de classe e continua invisível na tela. É a lição do
//     `smoke.mjs` sobre o `qs-alt`, aplicada aos dois tiles novos.
//  3. **O RÓTULO DO MODO TEM DE CABER.** "Modo avançado" é quase o dobro de
//     "Avançado", e ele mora numa metade de um trilho. Quebrado em duas linhas
//     ele não erra alto — fica feio e o trilho cresce —, e por isso a medida é
//     em DUAS LARGURAS, com a estreita sendo a que decide.
//
//   node tools/configuracoes-sem-subtitulo.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperar, porque, checar, falhas } from './arnes.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);
await new Promise((r) => servidor.listen(0, r));
const base = `http://localhost:${servidor.address().port}`;
const navegador = await abrirNavegador();
const erros = [];

async function abrirConfig(largura) {
  const ctx = await navegador.newContext({ viewport: { width: largura, height: 900 }, hasTouch: true });
  await semRedeExterna(ctx);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await esperar(pg, () => !document.getElementById('splash'), null, 30000);
  await pg.evaluate(() => { document.getElementById('simpleSettingsBtn').click(); });
  const abriu = await esperar(pg, () => {
    const d = document.getElementById('fadePopup');
    return !!d && d.classList.contains('open');
  }, null, 10000);
  return { ctx, pg, abriu };
}

try {
  // =========================================================================
  // A · NENHUM TILE TEM SEGUNDA LINHA
  // =========================================================================
  const a = await abrirConfig(430);
  checar(a.abriu === true, 'A · a folha de Configurações abre', porque(a.abriu));

  const tiles = await a.pg.evaluate(() => [...document.querySelectorAll('.qs-grade .qs-tile')]
    .map((t) => ({
      id: t.id,
      // O TEXTO INTEIRO do tile, e não a ausência de uma classe: `.qs-estado`
      // podia ter sido renomeada em vez de removida, e o defeito é a SEGUNDA
      // LINHA existir, não a classe.
      texto: (t.textContent || '').replace(/\s+/g, ' ').trim(),
      titulo: (t.querySelector('.qs-titulo') || {}).textContent || '',
      // O estado continua existindo — fora da tela.
      aria: t.getAttribute('aria-label') || '',
    })));
  checar(tiles.length === 9,
    'A · a grade tem os NOVE tiles: as três ações deste aparelho entraram nela '
    + 'quando o rótulo "Este aparelho" saiu', tiles.length);
  const comSobra = tiles.filter((t) => t.texto !== t.titulo.trim());
  checar(comSobra.length === 0,
    'A · e nenhum tem texto além do TÍTULO — a palavra do estado saiu de todos',
    JSON.stringify(comSobra));
  // A PALAVRA NÃO FOI APAGADA, MUDOU DE CANAL: quem lê a grade por leitor de
  // tela tinha só "Tema", que não responde nada. Sem esta asserção, "remover a
  // segunda linha" e "remover a informação" passam iguais.
  const tema = tiles.find((t) => t.id === 'temaTile');
  checar(!!tema && /Tema:\s*\S/.test(tema.aria),
    'A · e o estado continua dito no `aria-label`, que é onde ele não ocupa linha',
    tema && tema.aria);

  // =========================================================================
  // B · O GIRO GIRA O PRÓPRIO ÍCONE (no RENDERIZADO)
  // =========================================================================
  const giro = await a.pg.evaluate(async () => {
    const b = document.getElementById('rotBtn');
    const svg = b.querySelector('svg');
    // ASSENTAR É `getAnimations()` + `finished`, e não um prazo: o ícone GIRA
    // (é esse movimento que diz o que o toque fez), então uma leitura por
    // relógio mede a transição no meio — MEDIDO, `matrix(0.80, 0.59, …)` a 60ms,
    // que não é ângulo nenhum. É a mesma regra que o `smoke.mjs` já segue para
    // a folha que desliza.
    const assentar = async () => {
      await Promise.all(svg.getAnimations().map((x) => x.finished.catch(() => {})));
    };
    const ler = () => ({
      estado: b.dataset.estado,
      // A matriz COMPUTADA, não a classe nem o atributo: uma regra de CSS
      // ausente deixaria o `data-estado` certo e o desenho parado.
      t: getComputedStyle(svg).transform,
      // E A COR, nas quatro posições (v1.7.5): ele era o único tile da grade
      // que apagava a 0°.
      cor: getComputedStyle(b).backgroundColor,
      simbolo: (b.querySelector('use') || {}).getAttribute
        ? b.querySelector('use').getAttribute('href')
        : null,
    });
    await assentar();
    const zero = ler();
    b.click();
    await assentar();
    const noventa = ler();
    b.click();
    await assentar();
    const cento = ler();
    return { zero, noventa, cento };
  });
  checar(giro.zero.estado === '0' && (giro.zero.t === 'none' || /matrix\(1, 0, 0, 1/.test(giro.zero.t)),
    'B · a 0° o ícone está de pé', JSON.stringify(giro.zero));
  checar(giro.noventa.estado === '90' && /matrix\(0, 1, -1, 0/.test(giro.noventa.t),
    'B · a 90° ele está DEITADO no renderizado — o ângulo era a palavra do '
    + 'estado, e sem ele o tile ficaria igual nas quatro posições',
    JSON.stringify(giro.noventa));
  checar(giro.cento.estado === '180' && /matrix\(-1, 0, 0, -1/.test(giro.cento.t),
    'B · e a 180° ele está de cabeça para baixo', JSON.stringify(giro.cento));
  // ---- E ELE NÃO APAGA A 0° (v1.7.5) ----
  // Pedido do operador: *"o botão do girar no telão está apagado no modo sem
  // giro, mas todos os botões devem ter o mesmo azul de ativo … toda diferença
  // de estado é pelo icone, não pela cor"*. A cor RENDERIZADA nas três leituras
  // que este bloco já tinha na mão — 0° é a que importa, e as outras duas são o
  // que prova que a igualdade não veio de o tile ter apagado em todas.
  checar(giro.zero.cor === giro.noventa.cor && giro.noventa.cor === giro.cento.cor,
    'B · e a COR é a mesma nas três posições — a 0° ele era o único apagado da grade',
    JSON.stringify([giro.zero.cor, giro.noventa.cor, giro.cento.cor]));
  // ---- E O QUE GIRA É UM QUADRO, não uma seta (v1.7.5) ----
  // *"use um icone de picture, paisagem. O próprio quadro vai girar e vai ser
  // mais intuitivo que um seta circular rodando, pois vai literalmente
  // representar em qual posição está a paisagem"*. Uma seta girada é a AÇÃO
  // desenhada duas vezes; um quadro girado é o ESTADO — e a asserção da matriz
  // acima passa com qualquer desenho, inclusive a seta que saiu.
  checar(giro.zero.simbolo === '#icoPaisagem',
    'B · e o desenho que gira é o QUADRO — a matriz sozinha aprovaria a seta',
    giro.zero.simbolo);

  // =========================================================================
  // C · O WALLPAPER TEM O PAR DE DESENHOS
  // =========================================================================
  //
  // Ele era o único tile de dois estados sem par — a razão estava escrita e era
  // real (um desenho de "foto" viraria o `icoImagem` de outro tile da mesma
  // grade), e o par que nasceu não sai daí: é o mesmo rolo, vazio contra cheio.
  const wall = await a.pg.evaluate(async () => {
    const el = document.getElementById('wallTile');
    const qual = () => {
      const base = el.querySelector('.ico-base');
      const alt = el.querySelector('.ico-alt');
      const vis = (n) => n && getComputedStyle(n).display !== 'none';
      return {
        estado: el.dataset.estado,
        // QUAL SÍMBOLO está no ar, medido pelo `display` computado: os dois
        // `<use>` existem sempre na árvore, e quem os troca é a folha.
        base: vis(base) ? base.getAttribute('href') : null,
        alt: vis(alt) ? alt.getAttribute('href') : null,
      };
    };
    const padrao = qual();
    // Pelo caminho REAL: é o `renderWallTile` que decide, e ele lê a variável
    // que o wallpaper próprio grava.
    customWallpaper = new Blob([new Uint8Array(4)], { type: 'image/png' });
    renderWallTile();
    const propria = qual();
    customWallpaper = null;
    renderWallTile();
    return { padrao, propria, volta: qual() };
  });
  checar(wall.padrao.estado === 'padrao' && wall.padrao.base === '#icoWallpaper' && !wall.padrao.alt,
    'C · no padrão o tile mostra o rolo VAZIO', JSON.stringify(wall.padrao));
  checar(wall.propria.estado === 'propria' && wall.propria.alt === '#icoWallpaperProprio'
    && !wall.propria.base,
    'C · com imagem própria ele mostra o rolo CHEIO — sem o par, os dois estados '
    + 'ficariam idênticos quando a palavra saiu', JSON.stringify(wall.propria));
  checar(wall.volta.base === '#icoWallpaper',
    'C · e ele volta ao vazio', JSON.stringify(wall.volta));
  // A LUZ NÃO CARREGA ESTE ESTADO, e a asserção existe para o próximo leitor não
  // "consertar" o par apagando o tile: apagado, neste app, quer dizer
  // INDISPONÍVEL — há wallpaper no telão nos dois estados.
  const aceso = await a.pg.evaluate(() => {
    const el = document.getElementById('wallTile');
    const antes = el.classList.contains('qs-on');
    customWallpaper = new Blob([new Uint8Array(4)], { type: 'image/png' });
    renderWallTile();
    const depois = el.classList.contains('qs-on');
    customWallpaper = null;
    renderWallTile();
    return { antes, depois };
  });
  checar(aceso.antes === true && aceso.depois === true,
    'C · e ele fica ACESO nos dois estados: apagado diria INDISPONÍVEL',
    JSON.stringify(aceso));

  // =========================================================================
  // D · O RODAPÉ LEVA O NOME DO APP
  // =========================================================================
  const rodape = await a.pg.evaluate(() => {
    const v = document.getElementById('appVersion');
    const faixa = document.querySelector('#fadePopup .footer-diag');
    return {
      texto: (v.textContent || '').trim(),
      // A BADGE DO CABEÇALHO continua sendo UM número: o pedido era sobre o
      // RODAPÉ, e levar o nome para a badge de 40px do topo a estouraria.
      badge: ((document.getElementById('listVersion') || {}).textContent || '').trim(),
      transborda: faixa ? faixa.scrollWidth > faixa.clientWidth + 1 : null,
    };
  });
  checar(/^Áudio Visual IASD v\d+\.\d+\.\d+$/.test(rodape.texto),
    'D · o rodapé diz o NOME do app e a versão', rodape.texto);
  checar(/^v\d+\.\d+\.\d+$/.test(rodape.badge),
    'D · e a badge do cabeçalho continua sendo um número só', rodape.badge);
  checar(rodape.transborda === false,
    'D · e a faixa não transborda com o nome dentro', rodape.transborda);
  await a.ctx.close();

  // =========================================================================
  // E · O RÓTULO DO MODO CABE — nas DUAS larguras
  // =========================================================================
  //
  // A estreita é a que decide: a 430 sobra espaço nas duas versões, e uma
  // medição só ali aprovaria um rótulo que quebra no aparelho de 360.
  for (const largura of [360, 430]) {
    const c = await abrirConfig(largura);
    const modo = await c.pg.evaluate(() => {
      const seg = document.getElementById('appModeSeg');
      return [...seg.querySelectorAll('.fit-opt span')].map((s) => ({
        t: (s.textContent || '').trim(),
        // UMA LINHA SÓ: um `<span>` quebrado tem DOIS retângulos de cliente, e
        // essa é a medida exata — `scrollWidth` de um inline que quebra é igual
        // ao `clientWidth`, e um teste dele aprovaria a quebra.
        linhas: s.getClientRects().length,
      }));
    });
    checar(JSON.stringify(modo.map((m) => m.t)) === JSON.stringify(['Modo simples', 'Modo avançado']),
      'E · a ' + largura + 'px as duas metades dizem a palavra', JSON.stringify(modo));
    checar(modo.every((m) => m.linhas === 1),
      'E · e a ' + largura + 'px nenhuma quebra em duas linhas', JSON.stringify(modo));
    await c.ctx.close();
  }

  checar(erros.length === 0, 'nenhum erro de página', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

falhas.length ? (console.log('\n' + falhas.length + ' falha(s).'), process.exit(1))
  : console.log('\nTodos passaram.');
