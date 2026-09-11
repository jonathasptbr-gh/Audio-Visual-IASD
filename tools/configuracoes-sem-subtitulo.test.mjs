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
  // NOVE desde a v1.8.16: as seis preferências da projeção e as três ações do
  // aparelho, que entraram quando o rótulo "Este aparelho" saiu. Foram ONZE da
  // v1.8.0 até lá, com os dois tiles do clone celular a celular.
  //
  // O NÚMERO É CONTADO DE PROPÓSITO — o que este arquivo mede é que NENHUM tile
  // tem segunda linha, e um tile novo entrando sem passar por aqui é justamente
  // o que devolveria a palavra do estado à tela por uma porta que ninguém
  // olhou. **O preço dessa escolha foi cobrado na v1.8.17**: a v1.8.16 tirou os
  // dois tiles e não passou por aqui, o `verificar` reprovou na `main` e o
  // `web-ota` foi PULADO — o bundle daquele lote não chegou a aparelho nenhum.
  // Mexeu na grade, este número anda junto, no MESMO lote.
  checar(tiles.length === 9,
    'A · a grade tem os NOVE tiles da folha', tiles.length);
  const comSobra = tiles.filter((t) => t.texto !== t.titulo.trim());
  checar(comSobra.length === 0,
    'A · e nenhum tem texto além do TÍTULO — a palavra do estado saiu de todos '
    + 'na v1.7.2, e a exceção que o tile do tema teve na v1.8.63 saiu com o '
    + 'automático que ela indicava (v1.8.64)',
    JSON.stringify(comSobra));
  // A PALAVRA NÃO FOI APAGADA, MUDOU DE CANAL: quem lê a grade por leitor de
  // tela tinha só "Tema", que não responde nada. Sem esta asserção, "remover a
  // segunda linha" e "remover a informação" passam iguais.
  //
  // DOIS VALORES desde a v1.8.64: o "Automático · claro" que esta asserção
  // cobrava por nome saiu com o terceiro estado, e a cena abre no ESCURO porque
  // é ele o padrão de quem nunca escolheu.
  const tema = tiles.find((t) => t.id === 'temaTile');
  checar(!!tema && /^Tema: (Claro|Escuro)$/.test(tema.aria),
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
      // E A COR, nas quatro posições (v1.7.6): ele era o único tile da grade
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
  // ---- E ELE NÃO APAGA A 0° (v1.7.6) ----
  // Pedido do operador: *"o botão do girar no telão está apagado no modo sem
  // giro, mas todos os botões devem ter o mesmo azul de ativo … toda diferença
  // de estado é pelo icone, não pela cor"*. A cor RENDERIZADA nas três leituras
  // que este bloco já tinha na mão — 0° é a que importa, e as outras duas são o
  // que prova que a igualdade não veio de o tile ter apagado em todas.
  checar(giro.zero.cor === giro.noventa.cor && giro.noventa.cor === giro.cento.cor,
    'B · e a COR é a mesma nas três posições — a 0° ele era o único apagado da grade',
    JSON.stringify([giro.zero.cor, giro.noventa.cor, giro.cento.cor]));
  // ---- E O QUE GIRA É UM QUADRO, não uma seta (v1.7.6) ----
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
  const rodape = await a.pg.evaluate(async () => {
    const z = (ms) => new Promise((f) => setTimeout(f, ms));
    // OS DOIS IRMÃOS SÓ EXISTEM NO APP (`hidden` fora dele, e a razão é que
    // gravar arquivo e abrir o WhatsApp são a ponte). Sem revelá-los a faixa
    // teria UM filho, e toda asserção de distribuição abaixo mediria um botão
    // sozinho ocupando a linha — verde, e sobre nada.
    window.__NATIVE__ = true;
    for (const id of ['diagSave', 'contatoBtn']) {
      const e = document.getElementById(id); if (e) e.hidden = false;
    }
    await z(120);
    const v = document.getElementById('appVersion');
    const faixa = document.querySelector('#fadePopup .footer-diag');
    const botoes = faixa ? [...faixa.querySelectorAll('.diag-btn')] : [];
    return {
      texto: (v.textContent || '').trim(),
      // A BADGE DO CABEÇALHO continua sendo UM número: o pedido era sobre o
      // RODAPÉ, e levar o nome para a badge de 40px do topo a estouraria.
      badge: ((document.getElementById('listVersion') || {}).textContent || '').trim(),
      transborda: faixa ? faixa.scrollWidth > faixa.clientWidth + 1 : null,
      // ===== O QUE A v1.8.65 ACRESCENTOU =====
      faixaBg: faixa ? getComputedStyle(faixa).backgroundColor : null,
      n: botoes.length,
      // A VERSÃO É UM BOTÃO, e ela é o PRIMEIRO — a ordem é a do pedido
      // ("a versão, o registro e o pedir ajuda").
      ids: botoes.map((b) => b.id),
      // O ÍCONE À DIREITA DO TEXTO: a ordem dos filhos, e não uma regra de CSS.
      // `row-reverse` daria o mesmo desenho e mentiria para o leitor de tela,
      // que lê a ordem do DOM.
      ordem: botoes.map((b) => [...b.children].map((c) => c.tagName.toLowerCase()).join('+')),
      // OS TRÊS NO MESMO ESTILO: o fundo lido do RENDERIZADO, um valor só.
      fundos: [...new Set(botoes.map((b) => getComputedStyle(b).backgroundColor))],
      larguras: botoes.map((b) => +b.getBoundingClientRect().width.toFixed(1)),
      // UMA LINHA SÓ a 390px na fonte padrão: os centros verticais coincidem.
      linhas: new Set(botoes.map((b) => {
        const r = b.getBoundingClientRect(); return Math.round(r.top + r.height / 2);
      })).size,
      peso: getComputedStyle(v).fontWeight,
      pesoIrmao: getComputedStyle(botoes[1] || v).fontWeight,
      // NENHUM RÓTULO CORTADO: o `min-width: max-content` é o que segura isso,
      // e sem ele a divisão igual espreme a palavra mais longa.
      corta: botoes.map((b) => b.querySelector('span'))
        .filter((e) => e && e.scrollWidth > e.clientWidth + 1).length,
    };
  });
  // O NOME SAIU NA v1.8.51 (*"considere abreviar a versão para dar espaço a um
  // botão mais claro em sua função"*). A v1.7.2 o pusera ali *"para ter um
  // melhor preenchimento do rodapé"* — e é o MOTIVO daquele pedido que caducou:
  // a faixa passou a hospedar dois botões com rótulo, e o que faltava nela
  // deixou de ser enchimento e passou a ser espaço. MEDIDO: o nome custa
  // 153,0px e o número seco 44,6px, e os 108,4px de diferença são exatamente o
  // que "Registro" e "Pedir ajuda" ocupam.
  checar(/^v\d+\.\d+\.\d+$/.test(rodape.texto),
    'D · o rodapé diz a versão, seca — a marca saiu para pagar o rótulo dos '
    + 'botões, e nomear o app dentro dele era a palavra mais dispensável da faixa',
    rodape.texto);
  checar(/^v\d+\.\d+\.\d+$/.test(rodape.badge),
    'D · e a badge do cabeçalho continua sendo um número só', rodape.badge);
  checar(rodape.transborda === false,
    'D · e a faixa não transborda com o nome dentro', rodape.transborda);

  // ===== D2 · OS TRÊS SÃO BOTÕES IGUAIS NUMA FILEIRA SEM FUNDO (v1.8.65) =====
  //
  // Pedido do operador, em quatro metades: *"coloque a versão, o registro e o
  // pedir ajuda... igualmente distribuídos horizontalmente"*, *"faça os três
  // serem três botões separados, no mesmo estilo do botão de 'pedir ajuda'"*,
  // *"remova o fundo cinza desse rodapé"* e *"coloque os ícones... à direita de
  // seus respectivos textos"*. Cada uma tem asserção, porque cada uma quebra
  // sozinha — e três delas quebram SEM SINTOMA numa captura de layout.
  checar(rodape.n === 3 && rodape.ids.join(',') === 'versaoBtn,diagSave,contatoBtn',
    'D2 · a faixa são TRÊS botões, nesta ordem — a versão deixou de ser texto '
    + 'nu e virou o primeiro deles', JSON.stringify(rodape.ids));
  checar(/^rgba\(0, 0, 0, 0\)$|^transparent$/.test(rodape.faixaBg || ''),
    'D2 · e a faixa NÃO pinta nada: o cinza saiu, e com ele a pastilha que '
    + 'cobrava recuo, raio e altura mínima', rodape.faixaBg);
  checar(rodape.fundos.length === 1,
    'D2 · os três vestem o MESMO fundo — a regra da v1.8.51 (*"só um deles o '
    + 'veste"*) foi revogada pelo pedido: numa fileira sem fundo o que está em '
    + 'jogo é cada um se ler como BOTÃO', JSON.stringify(rodape.fundos));
  checar(rodape.ordem.every((o) => o === 'span' || o === 'span+svg'),
    'D2 · e o ícone vem DEPOIS do texto no DOM, não por `row-reverse` — a ordem '
    + 'visual e a que o leitor de tela percorre são a mesma',
    JSON.stringify(rodape.ordem));
  checar(rodape.linhas === 1
    && Math.max(...rodape.larguras) - Math.min(...rodape.larguras) < 1,
    'D2 · a 390px na fonte padrão eles dividem a linha em partes IGUAIS — é o '
    + '`flex: 1 1 0` (base zero), e não `1 1 auto`, que daria a cada um a '
    + 'própria largura mais um pedaço', JSON.stringify(rodape.larguras));
  checar(rodape.peso === '700' && rodape.pesoIrmao !== '700',
    'D2 · o NÚMERO sai em negrito (`--fw-forte`) e os rótulos irmãos não — o '
    + 'destaque é dele, e medi-lo sozinho aprovaria a faixa inteira em negrito',
    rodape.peso + ' vs ' + rodape.pesoIrmao);
  await a.ctx.close();

  // ===== D3 · UMA LINHA SÓ, NA CÉLULA QUE ALCANÇA A DECISÃO (v1.8.65) =====
  //
  // A CÉLULA É 360px × 1,25×, e ela foi ESCOLHIDA por reversão, não por ser
  // pequena. MEDIDO nas seis células do lote: a 430×1× (o viewport dos outros
  // blocos daqui) e a 390×1× os três já cabem folgados, e a asserção passa COM
  // e SEM o conserto — tautologia. É aqui que o recuo decide:
  //
  // | variante | 360×1,25× |
  // |---|---|
  // | publicada (`--sp-3`) | uma linha |
  // | recuo de volta a `--sp-5` | **duas linhas** (160 / 160 / 324) |
  //
  // E ESTE BLOCO TINHA UMA SEGUNDA ASSERÇÃO, que saiu por não poder reprovar:
  // ela dizia que o `min-width: max-content` da faixa segurava o rótulo, e a
  // reversão mostrou que remover a declaração não muda um pixel — o piso real é
  // o `min-width: auto` que todo item flex já tem. A declaração saiu junto com
  // a asserção. O `vaza` fica na medição, como contexto de quem ler uma
  // reprovação, e não como veredito próprio.
  const estreito = await abrirConfig(360);
  const ap = await estreito.pg.evaluate(async () => {
    const z = (ms) => new Promise((f) => setTimeout(f, ms));
    document.documentElement.style.fontSize = '20px';
    window.__NATIVE__ = true;
    for (const id of ['diagSave', 'contatoBtn']) {
      const e = document.getElementById(id); if (e) e.hidden = false;
    }
    await z(150);
    const faixa = document.querySelector('#fadePopup .footer-diag');
    const botoes = [...faixa.querySelectorAll('.diag-btn')];
    return {
      linhas: new Set(botoes.map((b) => {
        const r = b.getBoundingClientRect(); return Math.round(r.top + r.height / 2);
      })).size,
      larguras: botoes.map((b) => +b.getBoundingClientRect().width.toFixed(1)),
      vaza: botoes.map((b) => {
        const cs = getComputedStyle(b), rb = b.getBoundingClientRect();
        const filhos = [...b.children].map((c) => c.getBoundingClientRect());
        return +Math.max(0,
          (rb.left + parseFloat(cs.paddingLeft)) - Math.min(...filhos.map((r) => r.left)),
          Math.max(...filhos.map((r) => r.right)) - (rb.right - parseFloat(cs.paddingRight))).toFixed(1);
      }),
    };
  });
  checar(ap.linhas === 1,
    'D3 · a 360px×1,25× os três cabem numa LINHA só — é o que o recuo a '
    + '`--sp-3` compra; com `--sp-5` a faixa quebra em duas aqui e a 430px×1,5×',
    JSON.stringify(ap));
  await estreito.ctx.close();

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
