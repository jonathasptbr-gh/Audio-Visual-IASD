// ============================================================================
// O TECLADO SOBREPÕE EM TODO CAMPO DE TEXTO DO APP (v1.13.7; folha a folha desde
// a v1.13.3).
//
// A v1.13.2 achou a causa no `#itinPopup`: um campo de texto que NÃO declarava
// `data-teclado="sobrepoe"` fazia o `keyboardShift` escrever o teclado em `--kb`,
// que encolhe o `<body>` — e a caixa de controles, com a barra de busca da
// Biblioteca repousando nela, SUBIA com o teclado e DESCIA quando o campo perdia o
// foco. A v1.13.3 consertou mais quatro campos, um a um, e o operador voltou com o
// resto: *"o problema da caixa de texto da biblioteca subindo e descendo em todas
// as interações de texto do app persiste… edição do nome cronograma… edição de
// nome dos itens no cronograma"*.
//
// A v1.13.7 INVERTEU A REGRA: sobrepor é o padrão, e quem desloca o DECLARA
// (`data-teclado="desloca"`). Este oráculo deixou de ser uma lista de folhas e
// passou a ser uma VARREDURA:
//
//  R. a REGRA no código: nenhum `sobrepoe` sobrou (a marca morta é o convite a
//     reintroduzir o padrão antigo), e `desloca` só existe nas EXCEÇÕES NOMEADAS;
//  A–I. cada SUPERFÍCIE que hospeda campo é aberta, e TODO campo editável à
//     vista nela — ENUMERADO DO DOM, não escrito aqui — faz o percurso:
//       (1) com o teclado no ar a barra de busca da Biblioteca fica no MESMO pixel
//           e `--kb` é 0 — o app por baixo não encolheu;
//       (2) o CAMPO não fica atrás do teclado (folha do teto: `--kb-folha`;
//           diálogo: centrado acima dele; lista: `revelarCampo` rola);
//       (3) a FOLHA/cartão que o hospeda termina onde o teclado começa;
//       (4) ao tirar o foco e o teclado descer, a barra não se move em quadro
//           nenhum, e a folga provisória do `revelarCampo` foi desfeita;
//  X. a EXCEÇÃO, o campo da Biblioteca: ali `--kb` é o teclado e a janela para
//     onde ele começa — o oposto, e de propósito.
//
// O teclado é SIMULADO como o WebView em edge-to-edge o produz: só a viewport
// VISUAL encolhe (`__teclado(px)`), a de layout fica — o mundo em que o `--kb`
// existe (ver `keyboardShift`). A rolagem que o NAVEGADOR faria da viewport
// visual para revelar um campo coberto (`vv.offsetTop`) NÃO é simulada; a régua
// (2) é exatamente o que a torna desnecessária, e o aparelho é quem confirma.
//
//   node tools/teclado-das-folhas.test.mjs
import { readFileSync } from 'node:fs';
import { semRedeExterna } from './sem-rede.mjs';
import {
  servirEstatico, abrirNavegador, checar, falhas, RAIZ_WEB, esperar, porque,
  esperarCortina, comModoAvancado,
} from './arnes.mjs';

// AS EXCEÇÕES NOMEADAS: o campo que DESLOCA o app, cada um com a razão.
//  · `hymnSearchInput` — a cabeça da Biblioteca, uma janela de tela cheia cuja
//    LISTA termina onde o teclado começa (`body.lib-aberta.teclado`; no Modo
//    Fácil, "DURANTE UMA BUSCA AS TECLAS SAEM"). A barra SOBE porque ela É o campo.
const EXCECOES = ['hymnSearchInput'];

// ── R. A REGRA NO CÓDIGO ────────────────────────────────────────────────────
{
  // O CÓDIGO, sem comentário: a regra se escreve em prosa ao lado dela, e é a
  // DECLARAÇÃO que conta, não a menção.
  const js = readFileSync(RAIZ_WEB + '/controle/controle.js', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const html = readFileSync(RAIZ_WEB + '/controle/index.html', 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const mortos = (js.match(/teclado\s*=(?!=)\s*['"]sobrepoe['"]|['"]data-teclado['"]\s*,\s*['"]sobrepoe/g) || []).length
    + (html.match(/data-teclado="sobrepoe"/g) || []).length;
  checar(mortos === 0,
    'R · nenhum campo declara mais `sobrepoe`: desde a v1.13.7 é o PADRÃO, e a marca sem efeito é o '
    + 'convite a reintroduzir a regra antiga', { mortos });
  const deslocaJs = (js.match(/teclado\s*=(?!=)\s*['"]desloca['"]|['"]data-teclado['"]\s*,\s*['"]desloca/g) || []).length;
  const deslocaHtml = [...html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*data-teclado="desloca"|<[^>]*data-teclado="desloca"[^>]*\bid="([^"]+)"/g)]
    .map((m) => m[1] || m[2]);
  const todosHtml = (html.match(/data-teclado="desloca"/g) || []).length;
  checar(deslocaJs === 0 && todosHtml === deslocaHtml.length
      && deslocaHtml.every((id) => EXCECOES.includes(id)) && EXCECOES.every((id) => deslocaHtml.includes(id)),
    'R · e `desloca` existe SÓ nas exceções nomeadas (' + EXCECOES.join(', ') + '), no HTML, '
    + 'com id — um campo criado em JS não pode ganhá-la sem entrar nesta lista',
    { deslocaJs, deslocaHtml, todosHtml });
  const leitor = /dataset\.teclado\s*===\s*'desloca'/.test(js) && /campoDesloca\(\)\s*\?\s*teclado\s*:\s*0/.test(js);
  checar(leitor,
    'R · e o `keyboardShift` lê a exceção (`campoDesloca() ? teclado : 0`) — o padrão é zero', { leitor });
}

const servidor = servirEstatico(RAIZ_WEB);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador();
const ctx = await navegador.newContext({ viewport: { width: 360, height: 800 }, locale: 'pt-BR' });
await semRedeExterna(ctx);
await comModoAvancado(ctx);
await ctx.addInitScript(() => {
  const vv = window.visualViewport;
  if (!vv) return;
  let kb = 0;
  Object.defineProperty(vv, 'height', { configurable: true, get: () => window.innerHeight - kb });
  window.__teclado = (px) => { kb = px; vv.dispatchEvent(new Event('resize')); };
  // Um WAV de 6 s, para o Editar mídia ter o que abrir no formulário.
  window.__wav = () => {
    const n = 8000 * 6;
    const b = new Uint8Array(44 + n).fill(128);
    const dv = new DataView(b.buffer);
    const s = (o, t) => { for (let i = 0; i < t.length; i++) b[o + i] = t.charCodeAt(i); };
    s(0, 'RIFF'); dv.setUint32(4, 36 + n, true); s(8, 'WAVE'); s(12, 'fmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, 8000, true); dv.setUint32(28, 8000, true); dv.setUint16(32, 1, true);
    dv.setUint16(34, 8, true); s(36, 'data'); dv.setUint32(40, n, true);
    return new Blob([b], { type: 'audio/wav' });
  };
});

const TECLADO = 450;
const erros = [];
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY|Failed to load resource/;
const percorridos = [];

try {
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  pg.on('console', (m) => { if (m.type() === 'error' && !EXTERNO.test(m.text())) erros.push(m.text()); });
  await pg.goto(base + '/controle/');
  await pg.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function', null, { timeout: 30000 });
  await esperarCortina(pg);

  // 14 itens no Cronograma: o renomear da ÚLTIMA linha mora sob o teclado, e a
  // lista não tem curso para revelá-la — é a célula que pede a folga provisória.
  await pg.evaluate(async () => {
    for (let i = 1; i <= 14; i++) {
      await AVDB.addMedia(window.__wav(), { name: 'Louvor ' + i, kind: 'audio', list: 'imports', seconds: 6 });
    }
    await load();
  });
  await esperar(pg, () => document.querySelectorAll('#library .lib-item').length >= 14);

  const topoDaBarra = () => pg.evaluate(() => Math.round(document.getElementById('libBar').getBoundingClientRect().top * 10) / 10);

  /** OS CAMPOS À VISTA: todo editável de texto no DOM, menos as exceções. */
  const enumerar = () => pg.evaluate((exc) => {
    const NAO_TEXTO = new Set(['checkbox', 'radio', 'range', 'file', 'button', 'submit', 'reset', 'color', 'hidden', 'image']);
    const todos = [...document.querySelectorAll('input, textarea, [contenteditable=""], [contenteditable="true"]')]
      .filter((e) => !(e.tagName === 'INPUT' && NAO_TEXTO.has((e.type || '').toLowerCase())))
      .filter((e) => !exc.includes(e.id))
      // À VISTA de verdade: com caixa, dentro da tela e sem ancestral apagado — uma
      // folha FECHADA continua no DOM, com `opacity: 0` e transladada para fora.
      .filter((e) => {
        if (!e.getClientRects().length || getComputedStyle(e).visibility === 'hidden') return false;
        const r = e.getBoundingClientRect();
        if (r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) return false;
        for (let p = e; p; p = p.parentElement) if (parseFloat(getComputedStyle(p).opacity) === 0) return false;
        return true;
      });
    window.__campoSeq = window.__campoSeq || 0;
    const vistos = {};
    return todos.map((e) => {
      if (!e.dataset.oraculoCampo) e.dataset.oraculoCampo = String(++window.__campoSeq);
      const nome = e.id ? '#' + e.id : (e.tagName.toLowerCase() + '.' + [...e.classList].join('.'));
      vistos[nome] = (vistos[nome] || 0) + 1;
      return {
        sel: '[data-oraculo-campo="' + e.dataset.oraculoCampo + '"]',
        nome: vistos[nome] > 1 ? nome + ' (' + vistos[nome] + 'º)' : nome,
      };
    });
  }, EXCECOES);

  /**
   * O PERCURSO DE UM CAMPO: focar, subir o teclado, digitar, medir; depois tirar o
   * foco e baixar o teclado amostrando a barra quadro a quadro.
   * `casca` é o seletor da folha/cartão que tem de terminar acima do teclado (ou `null`).
   */
  const percurso = async (rotulo, campo, casca) => {
    const antes = await topoDaBarra();
    await pg.focus(campo.sel);
    await pg.evaluate((px) => window.__teclado(px), TECLADO);
    const rk = await esperar(pg, (px) => getComputedStyle(document.documentElement).getPropertyValue('--kb-folha').trim() === px + 'px', TECLADO);
    await pg.keyboard.type('12');
    // O tempo de a barra deslizar, se ela fosse deslizar (`--lib-anim`).
    await pg.waitForTimeout(600);
    const com = await pg.evaluate(([f, c]) => {
      const el = document.querySelector(c);
      const sc = (() => {
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const oy = getComputedStyle(p).overflowY;
          if (oy === 'auto' || oy === 'scroll') return p;
        }
        return null;
      })();
      window.__scrollerDoCampo = sc;
      window.__padAntes = sc ? sc.style.paddingBottom : null;
      return {
        foco: document.activeElement === el,
        barra: Math.round(document.getElementById('libBar').getBoundingClientRect().top * 10) / 10,
        kb: getComputedStyle(document.documentElement).getPropertyValue('--kb').trim(),
        corpo: Math.round(document.body.getBoundingClientRect().height),
        campo: Math.round(el.getBoundingClientRect().bottom * 10) / 10,
        fundo: f ? Math.round(document.querySelector(f).getBoundingClientRect().bottom) : null,
        folga: sc ? sc.style.paddingBottom : '',
        limite: innerHeight,
        tela: innerHeight,
      };
    }, [casca, campo.sel]);
    com.limite -= TECLADO;
    percorridos.push(rotulo + ' ' + campo.nome);
    checar(rk === true && com.foco && com.barra === antes && com.kb === '0px' && com.corpo === com.tela,
      rotulo + ' · ' + campo.nome + ' · com o teclado no ar a barra de busca da Biblioteca NÃO sobe — o campo '
      + 'sobrepõe e o app por baixo não encolhe', { antes, com, r: porque(rk) });
    checar(com.campo <= com.limite + 1,
      rotulo + ' · ' + campo.nome + ' · e o CAMPO fica acima do teclado: o navegador não tem o que revelar '
      + 'rolando a tela inteira', com);
    if (casca) {
      checar(com.fundo <= com.limite + 1,
        rotulo + ' · ' + campo.nome + ' · e a folha termina onde o teclado começa (`--kb-folha`): nada dela '
        + 'fica atrás dele', com);
    }
    await pg.evaluate(() => {
      window.__barra = [];
      const f = () => {
        window.__barra.push(Math.round(document.getElementById('libBar').getBoundingClientRect().top * 10) / 10);
        if (window.__barra.length < 60) requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    });
    await pg.evaluate(() => { document.activeElement.blur(); window.__teclado(0); });
    await esperar(pg, () => window.__barra.length >= 60, null, 5000);
    const depois = await pg.evaluate(() => ({
      amostras: window.__barra,
      folga: window.__scrollerDoCampo ? window.__scrollerDoCampo.style.paddingBottom : '',
    }));
    const fora = depois.amostras.filter((y) => Math.abs(y - antes) > 0.5);
    checar(fora.length === 0 && (await topoDaBarra()) === antes && !/calc/.test(depois.folga),
      rotulo + ' · ' + campo.nome + ' · e ao sair do campo ela não desce nem sobe (parada no mesmo pixel em '
      + 'todos os quadros), e a folga provisória da lista foi desfeita',
      { antes, fora: fora.slice(0, 8), folga: depois.folga });
    return com;
  };

  /**
   * Todo campo à vista na superfície faz o percurso. Devolve quantos. A lista é
   * RELIDA depois de cada um: digitar num campo pode redesenhar o painel (o De do
   * sorteio redesenha o Até), e o nó marcado deixa de existir.
   */
  const varrer = async (rotulo, casca) => {
    const feitos = new Set();
    for (let volta = 0; volta < 20; volta++) {
      const c = (await enumerar()).find((x) => !feitos.has(x.nome));
      if (!c) break;
      feitos.add(c.nome);
      await percurso(rotulo, c, casca);
    }
    return feitos.size;
  };
  const algum = (rotulo, n, minimo = 1) => checar(n >= minimo,
    rotulo + ' · a superfície abriu com ' + minimo + '+ campo(s) à vista (senão o percurso não mediu nada)', { n });

  // ── A. A PLAYLIST AUTOMÁTICA: a palavra tema ─────────────────────────────
  await pg.evaluate(() => abrirSorteio());
  await esperar(pg, () => document.getElementById('sorteioPopup').classList.contains('open')
    && !!document.querySelector('#sorteioPopup .sorteio-campo input'));
  await esperar(pg, () => document.querySelector('#sorteioPopup .popup-sheet').getBoundingClientRect().top >= -0.5);
  algum('A', await varrer('A', '#sorteioPopup .popup-sheet'));
  await pg.evaluate(() => fecharSorteio());
  await esperar(pg, () => !document.getElementById('sorteioPopup').classList.contains('open'));

  // ── B. CONFIGURAÇÕES, EDITAR MÍDIA: a busca do seletor e o NOME do item ───
  await pg.evaluate(() => abrirSecao('edicao', { animar: false }));
  await esperar(pg, () => document.getElementById('fadePopup').classList.contains('open')
    && !!document.getElementById('edicaoBusca') && document.getElementById('edicaoBusca').offsetParent !== null);
  await esperar(pg, () => document.querySelector('#fadePopup .popup-sheet').getBoundingClientRect().top >= -0.5);
  algum('B', await varrer('B', '#fadePopup .popup-sheet'));
  // O formulário: o campo do NOME do item, que nunca teve asserção própria.
  const rForm = await pg.evaluate(async () => {
    const id = (await AVDB.listIds('imports'))[0];
    await edicaoEscolherItem({ id, nome: 'Louvor 1', kind: 'audio', seconds: 6, editado: false });
    return true;
  });
  const temNome = await esperar(pg, () => !!document.querySelector('#edicaoLista .edicao-nome input'), null, 10000);
  checar(rForm && temNome === true, 'B · o formulário do Editar mídia abriu com o campo do nome', porque(temNome));
  await pg.waitForTimeout(500);
  algum('B', await varrer('B-form', '#fadePopup .popup-sheet'));
  await pg.evaluate(() => closeFadePopup());
  await esperar(pg, () => !document.getElementById('fadePopup').classList.contains('open'));

  // ── C. FERRAMENTAS: as legendas do Tempo e os campos do Sorteio ──────────
  for (const [rot, prep] of [
    ['C-relogio', () => abrirFerramenta('clock')],
    ['C-cronometro', () => abrirFerramenta('stopwatch')],
    ['C-timer', () => abrirFerramenta('timer')],
    ['C-sorteio-numeros', () => { draw.kind = 'number'; draw.min = 1; draw.max = 50; abrirFerramenta('draw'); }],
    ['C-sorteio-lista', () => { draw.kind = 'text'; abrirFerramenta('draw'); }],
  ]) {
    await pg.evaluate(() => { abrirFerramentas(); });
    await pg.waitForTimeout(150);
    await pg.evaluate(prep);
    await esperar(pg, () => !!document.querySelector('#toolsBody .misc-panel'));
    await pg.waitForTimeout(400);
    algum(rot, await varrer(rot, null));
    await pg.evaluate(() => fecharFerramentas());
    await pg.waitForTimeout(400);
  }

  // ── D. O ITINERÁRIO: o título de um horário (`#itinPopup`) ───────────────
  await pg.evaluate(() => { abrirFerramentas(); });
  await pg.waitForTimeout(150);
  await pg.evaluate(() => { abrirFerramenta('itinerario'); abrirItinEditor(null); });
  await esperar(pg, () => document.getElementById('itinPopup').classList.contains('open') && !!document.getElementById('itinCampoTitulo'));
  await esperar(pg, () => document.querySelector('#itinPopup .popup-sheet').getBoundingClientRect().top >= -0.5);
  algum('D', await varrer('D', '#itinPopup .popup-sheet'));
  await pg.evaluate(() => window.__avBack());
  await esperar(pg, () => !document.getElementById('itinPopup').classList.contains('open'));
  await pg.evaluate(() => fecharFerramentas());
  await pg.waitForTimeout(400);

  // ── E. O DIÁLOGO CENTRADO (`appPrompt`): renomear o CRONOGRAMA, pelo lápis da
  //    gaveta, e a nova MENSAGEM — o MESMO campo, por duas portas ──────────
  const pelaPorta = async (rotulo, abrir) => {
    await pg.evaluate(abrir);
    await esperar(pg, () => document.getElementById('appDialog').classList.contains('open')
      && !document.getElementById('appDialogInput').hidden, null, 5000);
    await pg.waitForTimeout(150);
    algum(rotulo, await varrer(rotulo, '#appDialog .dialog-card'));
    await pg.evaluate(() => closeAppDialog(null));
    await esperar(pg, () => !document.getElementById('appDialog').classList.contains('open'));
  };
  await pelaPorta('E-cronograma', async () => {
    abrirCronoGaveta();
    await new Promise((r) => setTimeout(r, 300));
    document.querySelector('#cronoLista .crono-renomear').click();
  });
  await pg.evaluate(() => { if (typeof fecharCronoGaveta === 'function') fecharCronoGaveta(); });
  await pg.waitForTimeout(300);
  await pelaPorta('E-mensagem', () => { addMessage(); });
  // E o cartão fica CENTRADO no que sobra acima do teclado, não na tela inteira.
  {
    await pg.evaluate(() => { addMessage(); });
    await esperar(pg, () => document.getElementById('appDialog').classList.contains('open'));
    await pg.focus('#appDialogInput');
    await pg.evaluate((px) => window.__teclado(px), TECLADO);
    await esperar(pg, (px) => getComputedStyle(document.documentElement).getPropertyValue('--kb-folha').trim() === px + 'px', TECLADO);
    await pg.waitForTimeout(400);
    const c = await pg.evaluate((px) => {
      const r = document.querySelector('#appDialog .dialog-card').getBoundingClientRect();
      return { centro: Math.round((r.top + r.bottom) / 2), alvo: Math.round((innerHeight - px) / 2) };
    }, TECLADO);
    checar(Math.abs(c.centro - c.alvo) <= 2,
      'E · o cartão do `appPrompt` centra no que sobra ACIMA do teclado (`--kb-folha`), sem o app encolher', c);
    await pg.evaluate(() => { document.activeElement.blur(); window.__teclado(0); closeAppDialog(null); });
    await esperar(pg, () => !document.getElementById('appDialog').classList.contains('open'));
  }

  // ── F. O RENOMEAR NA LINHA do Cronograma, na ÚLTIMA linha ────────────────
  //    A lista rolada até o fim: a linha mora sob o teclado e não há curso para
  //    revelá-la — é o `revelarCampo` com a folga provisória.
  await pg.evaluate(async () => {
    const lib = document.getElementById('library');
    lib.scrollTop = lib.scrollHeight;
    await new Promise((r) => setTimeout(r, 100));
    const li = [...lib.querySelectorAll('.lib-item')].pop();
    li.querySelector('.row-mais').click();
    await new Promise((r) => setTimeout(r, 250));
    lib.scrollTop = lib.scrollHeight;
    li.querySelector('.row-renomear').click();
    await new Promise((r) => setTimeout(r, 250));
  });
  const vistoF = await pg.evaluate((px) => {
    const c = document.querySelector('#library .linha-renome-campo');
    return c ? { abaixo: c.getBoundingClientRect().bottom > innerHeight - px } : null;
  }, TECLADO);
  checar(!!vistoF && vistoF.abaixo,
    'F · PREMISSA: o campo do renomear da última linha nasce SOB a faixa do teclado (senão a célula não '
    + 'mede o `revelarCampo`)', vistoF);
  const nF = await varrer('F', null);
  algum('F', nF);
  await pg.evaluate(() => { const c = document.querySelector('#library .linha-renome-campo');
    if (c) c.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
  await pg.waitForTimeout(300);

  // ── G. O RENOMEAR NA FAIXA de um FAVORITO, dentro da Biblioteca aberta ──
  //    O último dos 14 favoritos: a faixa dele mora sob o teclado, e quem o
  //    revela é a lista da Biblioteca (`#hymnResults`), não o app encolhendo.
  {
    await pg.evaluate(async () => {
      for (const id of await AVDB.listIds('imports')) await AVDB.listAdd('favs', id);
      await load();
      openHymnSearch(false);
      const folha = hymnSearchPopupEl.querySelector('.popup-sheet');
      for (let volta = 0; volta < 8 && folha; volta++) {
        const anims = folha.getAnimations ? folha.getAnimations() : [];
        if (!anims.length) break;
        await Promise.all(anims.map((x) => x.finished.catch(() => {})));
        await new Promise((r) => requestAnimationFrame(() => r()));
      }
      favAberto = true;
      renderSearchResults('');
    });
    const temFav = await esperar(pg, () => document.querySelectorAll('[data-fav-corpo] .lib-item').length >= 14, null, 10000);
    checar(temFav === true, 'G · PREMISSA: os 14 favoritos estão na Biblioteca aberta', porque(temFav));
    await pg.waitForTimeout(400);
    const barraAberta = await topoDaBarra();
    await pg.evaluate(async () => {
      const res = document.getElementById('hymnResults');
      const li = [...document.querySelectorAll('[data-fav-corpo] .lib-item')].pop();
      li.scrollIntoView({ block: 'end' });
      res.scrollTop = res.scrollHeight;
      if (!li.classList.contains('expanded')) { li.querySelector('.row').click(); await new Promise((f) => setTimeout(f, 300)); }
      res.scrollTop = res.scrollHeight;
      li.querySelector('.hymn-gaveta .fav-acoes .row-renomear').click();
      await new Promise((f) => setTimeout(f, 250));
      res.scrollTop = res.scrollHeight;
      await new Promise((f) => setTimeout(f, 100));
    });
    const vistoG = await pg.evaluate((px) => {
      const c = document.querySelector('[data-fav-corpo] .linha-renome-campo');
      return c ? { abaixo: c.getBoundingClientRect().bottom > innerHeight - px } : null;
    }, TECLADO);
    checar(!!vistoG && vistoG.abaixo,
      'G · PREMISSA: o campo do renomear do último favorito nasce SOB a faixa do teclado', vistoG);
    // A régua (1) aqui é a barra NO TOPO da Biblioteca aberta, que é onde ela está.
    const antesG = barraAberta;
    algum('G', await varrer('G', null));
    checar((await topoDaBarra()) === antesG, 'G · e a barra da Biblioteca aberta segue no topo, no mesmo pixel',
      { antesG, agora: await topoDaBarra() });
    await pg.evaluate(() => { const c = document.querySelector('[data-fav-corpo] .linha-renome-campo');
      if (c) c.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    await pg.evaluate(() => closeHymnSearch());
    await esperar(pg, () => !document.getElementById('hymnSearchPopup').classList.contains('open'));
    await pg.waitForTimeout(500);
  }

  // ── X. A EXCEÇÃO: o campo da Biblioteca DESLOCA ─────────────────────────
  {
    await pg.evaluate(() => openHymnSearch(false));
    await esperar(pg, () => document.getElementById('hymnSearchPopup').classList.contains('open'));
    await pg.waitForTimeout(500);
    await pg.focus('#hymnSearchInput');
    await pg.evaluate((px) => window.__teclado(px), TECLADO);
    await esperar(pg, (px) => getComputedStyle(document.documentElement).getPropertyValue('--kb').trim() === px + 'px', TECLADO);
    await pg.waitForTimeout(600);
    const x = await pg.evaluate((px) => ({
      kb: getComputedStyle(document.documentElement).getPropertyValue('--kb').trim(),
      teclado: document.body.classList.contains('teclado'),
      campo: Math.round(document.getElementById('hymnSearchInput').getBoundingClientRect().bottom),
      janela: Math.round(document.querySelector('#hymnSearchPopup').getBoundingClientRect().bottom),
      limite: innerHeight - px,
    }), TECLADO);
    checar(x.kb === TECLADO + 'px' && x.teclado && x.campo <= x.limite && x.janela <= x.limite + 1,
      'X · a EXCEÇÃO nomeada: com o campo da Biblioteca em foco `--kb` é o teclado, `body.teclado` liga e a '
      + 'janela termina onde ele começa — a lista da busca não fica atrás dele', x);
    await pg.evaluate(() => { document.activeElement.blur(); window.__teclado(0); closeHymnSearch(); });
  }

  // ── S. O MODO FÁCIL: o mesmo Editar mídia, com a barra da Biblioteca na
  //    casa dela de lá (o espaço `#simpleBarra`, entre o cabeçalho e a leitura).
  {
    await pg.evaluate(() => { setAppMode('simple'); });
    await pg.waitForTimeout(600);
    await pg.evaluate(() => abrirSecao('edicao', { animar: false }));
    await esperar(pg, () => document.getElementById('fadePopup').classList.contains('open')
      && document.querySelector('#fadePopup .popup-sheet').getBoundingClientRect().top >= -0.5);
    await pg.waitForTimeout(500);
    algum('S', await varrer('S', '#fadePopup .popup-sheet'));
    await pg.evaluate(() => closeFadePopup());
    await esperar(pg, () => !document.getElementById('fadePopup').classList.contains('open'));
  }

  console.log('\nCampos percorridos (' + percorridos.length + '):\n  ' + percorridos.join('\n  '));
  checar(erros.length === 0, 'nenhum erro de console', erros);
} catch (e) {
  checar(false, 'o oráculo rodou até o fim', e && e.stack || String(e));
} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) { console.log('\n' + falhas.length + ' falha(s).'); process.exit(1); }
console.log('\nTodos passaram.');
