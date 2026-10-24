// ============================================================================
// O ITINERÁRIO (v1.13.0) — a programação do evento, no Tempo e no telão.
//
// Pedido do operador: uma lista de HORÁRIO + TÍTULO, editável, que vai ao telão
// seguindo o relógio — o item de AGORA em destaque, os seguintes abaixo —, com
// a opção de mostrar só os títulos e um AJUSTE que desloca a lista inteira.
//
// ## O que falha calado aqui, e por isso cada bloco existe
//
//  A. A LEITURA PURA (`createStage.itinerarioLeitura`) — quem está no ar a cada
//     hora. Antes do primeiro: ninguém. Depois do último: o último. Fora de
//     ordem: ordenado. O FUSO é o do celular, não o da tela que desenha.
//  B. EDITAR E PERSISTIR — pela UI de verdade (campos e botões), com o banco
//     conferido e uma RECARGA no fim: uma lista que só vive na memória some no
//     primeiro OTA aplicado no meio do culto.
//  C. A TROCA QUANDO O RELÓGIO CRUZA o horário, na preview e no painel — sem
//     comando nenhum trafegando —, e ANIMADA (as linhas têm animação viva).
//  D. O AJUSTE: ±1/±5 deslocam todos os horários JUNTOS (os intervalos ficam),
//     o item de agora acompanha, e o ↺ volta ao previsto.
//  E. Horários × só os títulos.
//  F. O TELÃO: a mesma lista pelo DESCRITOR, e o REENVIO na reconexão (o
//     `display-ready` de um telão que recarrega traz a lista de volta).
//  G. Antes do primeiro e depois do último, no telão.
//  H. `prefers-reduced-motion`: nada se move.
//  I. Lista vazia: o projetar é APAGADO e diz por quê; esvaziar no ar tira do telão
//     — e os dois destinos ficam apagados, não somem.
//
//  E A v1.13.1 (os pedidos do operador sobre a v1.13.0):
//  J. Com o itinerário no ar o ⏮/⏭ é o AJUSTE de 5 em 5 min ("−5"/"+5"), com a
//     folha fechada, pela coluna da tela cheia, e apagado nos extremos.
//  K. Os DESTINOS: Cronograma e Favoritos guardam a programação (sem o ajuste do
//     dia), o `.avpkg` a leva, e tocar na cena projeta mantendo o ajuste.
//  L. A FOLHA de um horário: roletas de hora e minuto, nenhum `<input
//     type="time">` (o diálogo do sistema que não abria no aparelho).
//  M. O DESENHO NO TELÃO: wallpaper à vista, bloco escuro semitransparente à
//     esquerda, a marca "Agora" à esquerda do horário — medido por pixel sobre um
//     wallpaper branco.
//  (B mede também a ANATOMIA da linha: a lista do app, com capa, subtítulo e `⋮`.)
//
//  E A v1.13.2 (os pedidos do operador sobre a v1.13.1):
//  N. O TECLADO da folha não mexe na barra de busca da Biblioteca: ela não sobe
//     com o teclado nem desce no confirmar (o campo do título SOBREPÕE), e a
//     folha continua terminando onde o teclado começa (`--kb-folha`).
//  M. (refeito) o bloco no telão é CENTRADO na tela, estreito como era, com o
//     texto de dentro ainda à esquerda.
//  O. O par ↑↓ na faixa do `⋮`, como no Cronograma: mover TROCA o evento com o
//     vizinho e os horários ficam no lugar; pontas apagadas; o telão acompanha.
//  P. OS ITINERÁRIOS MÚLTIPLOS: o nome do ativo abre a gaveta (renomear · nome ·
//     excluir, "Novo itinerário" por último); trocar é uma escrita só; tocar uma
//     cena guardada a torna o ativo SEM apagar o que o painel tinha, e tocá-la de
//     novo não duplica; o voltar fecha a gaveta antes da folha.
//  Q. A MIGRAÇÃO da chave da v1 (um itinerário só) e a mescla do `.avpkg`
//     (`itinMesclarPacote`).
//
// O RELÓGIO É O DO PLAYWRIGHT (`ctx.clock`), num fuso declarado
// (`America/Sao_Paulo`): é ele que faz "10:00" ser 10:00 em qualquer runner.
//
//   node tools/itinerario.test.mjs
// ============================================================================
import { semRedeExterna } from './sem-rede.mjs';
import {
  servirEstatico, abrirNavegador, checar, falhas, RAIZ_WEB, esperar, porque,
  esperarCortina, comModoAvancado, esperarDb, lerPng, pixel,
} from './arnes.mjs';

const servidor = servirEstatico(RAIZ_WEB);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador();
const ctx = await navegador.newContext({
  viewport: { width: 360, height: 800 }, timezoneId: 'America/Sao_Paulo', locale: 'pt-BR',
});
await semRedeExterna(ctx);
await comModoAvancado(ctx);
// O TECLADO SIMULADO (bloco N): o Chromium de mesa não tem teclado virtual, e o
// que o app lê é a viewport VISUAL encolhendo. `__teclado(px)` faz isso — a
// mesma conta do WebView em edge-to-edge, onde só a viewport visual diminui.
await ctx.addInitScript(() => {
  const vv = window.visualViewport;
  if (!vv) return;
  let kb = 0;
  Object.defineProperty(vv, 'height', { configurable: true, get: () => window.innerHeight - kb });
  window.__teclado = (px) => { kb = px; vv.dispatchEvent(new Event('resize')); };
});
// Sábado, 24/10/2026, 09:58 em Brasília (UTC−3).
const T = (hm, s = 0) => new Date('2026-10-24T' + hm + ':' + String(s).padStart(2, '0') + '-03:00');
await ctx.clock.install({ time: T('09:58') });

const erros = [];
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY|Failed to load resource/;
const vigiar = (p) => {
  p.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !EXTERNO.test(m.text())) erros.push(m.text()); });
};

try {
  const pg = await ctx.newPage();
  vigiar(pg);
  await pg.goto(base + '/controle/');
  await pg.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function', null, { timeout: 30000 });
  await esperarCortina(pg);

  // ── A. A LEITURA PURA ─────────────────────────────────────────────────────
  const leitura = await pg.evaluate(() => {
    const d = { itens: [
      { k: 'c', min: 630, titulo: 'Sermão' },
      { k: 'a', min: 540, titulo: 'Recepção' },
      { k: 'b', min: 600, titulo: 'Louvor' },
    ], desloc: 0, horas: true, fuso: 180 };
    const em = (iso, dd) => {
      const l = createStage.itinerarioLeitura(dd || d, new Date(iso).getTime());
      return { ordem: l.itens.map((x) => x.k).join(''), ativo: l.ativo >= 0 ? l.itens[l.ativo].k : '-' };
    };
    return {
      antes: em('2026-10-24T08:59:59-03:00'),
      noPrimeiro: em('2026-10-24T09:00:00-03:00'),
      meio: em('2026-10-24T09:59:59-03:00'),
      cruzou: em('2026-10-24T10:00:00-03:00'),
      depois: em('2026-10-24T23:00:00-03:00'),
      deslocado: em('2026-10-24T10:04:00-03:00', Object.assign({}, d, { desloc: 5 })),
      // O FUSO VEM DO DESCRITOR: a mesma época, lida por uma tela em UTC, tem
      // de dar o item do celular em UTC−3.
      fusoZero: em('2026-10-24T10:00:00-03:00', Object.assign({}, d, { fuso: 0 })),
      hora: [createStage.itinHora(-5), createStage.itinHora(1445), createStage.itinHora(605)],
    };
  });
  checar(leitura.antes.ordem === 'abc', 'A · fora de ordem, a lista sai ORDENADA pelo horário', leitura.antes);
  checar(leitura.antes.ativo === '-', 'A · antes do primeiro horário, nada está no ar', leitura.antes);
  checar(leitura.noPrimeiro.ativo === 'a' && leitura.meio.ativo === 'a',
    'A · no minuto do primeiro e até o seguinte, ele é o de agora', [leitura.noPrimeiro, leitura.meio]);
  checar(leitura.cruzou.ativo === 'b', 'A · ao cruzar 10:00 o de agora passa a ser o seguinte', leitura.cruzou);
  checar(leitura.depois.ativo === 'c', 'A · depois do último ele CONTINUA no ar (o encerramento não tem fim)', leitura.depois);
  checar(leitura.deslocado.ativo === 'a',
    'A · com +5 min, às 10:04 o "Louvor" (10:05 efetivo) ainda não começou', leitura.deslocado);
  checar(leitura.fusoZero.ativo === 'c',
    'A · o fuso é o do DESCRITOR: o mesmo instante, em UTC, é 13:00 — o último item', leitura.fusoZero);
  checar(leitura.hora.join(' ') === '23:55 00:05 10:05',
    'A · a hora mostrada dá a volta na meia-noite (a comparação não — fora de escopo)', leitura.hora);

  // ── B. EDITAR E PERSISTIR, PELA UI ───────────────────────────────────────
  const abrirItinerario = () => pg.evaluate(async () => {
    if (!ferramentasAbertas()) abrirFerramentas();
    [...document.querySelectorAll('.misc-tab')].find((b) => b.textContent.trim() === 'Tempo').click();
    const seg = [...document.querySelectorAll('.misc-seg')].find((b) => b.textContent === 'Itinerário');
    if (seg && !seg.classList.contains('active')) seg.click();
  });
  await abrirItinerario();
  await esperar(pg, () => !!document.getElementById('itinLista'));

  const vazio = await pg.evaluate(() => {
    const p = document.getElementById('miscProjectBtn');
    const segs = [...document.querySelectorAll('#chronoWrap .misc-seg')];
    return {
      off: p && p.disabled, titulo: p && p.title,
      segs: segs.map((b) => b.textContent),
      // OS QUATRO CABEM a 360px: nenhum rótulo cortado pela própria caixa.
      cortados: segs.filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.textContent),
    };
  });
  checar(vazio.segs.join('|') === 'Relógio|Cronômetro|Timer|Itinerário',
    'B · o Itinerário é o QUARTO segmento do Tempo', vazio.segs);
  checar(vazio.cortados.length === 0, 'B · e os quatro rótulos cabem a 360px', vazio.cortados);
  checar(vazio.off && /adicione/i.test(vazio.titulo || ''),
    'I · lista vazia: o "Projetar no telão" é APAGADO e diz por quê', vazio);

  // O HORÁRIO SE ESCOLHE NAS ROLETAS da folha (v1.13.1): a posição é escrita
  // como o dedo a deixaria — a célula do valor na banda do meio —, e quem lê é o
  // confirmar, pelo `roletaValorDe` de sempre.
  const abrirFolha = () => esperar(pg, () => document.getElementById('itinPopup').classList.contains('open')
    && !!document.getElementById('itinRoleta_hora'));
  const escolherHora = (hm) => pg.evaluate((v) => {
    const [h, m] = v.split(':').map(Number);
    const rh = document.getElementById('itinRoleta_hora');
    const rm = document.getElementById('itinRoleta_min');
    const it = roletaItem(rh);
    rh.scrollTop = (Number(rh.dataset.base) + pistaDoValor(h, 24, 0)) * it;
    rm.scrollTop = (Number(rm.dataset.base) + pistaDoValor(m, 60, 0)) * it;
  }, hm);
  const fechada = () => esperar(pg, () => !document.getElementById('itinPopup').classList.contains('open'));
  const adicionar = async (hora, titulo) => {
    await pg.click('#itinNovoBtn');
    await abrirFolha();
    await escolherHora(hora);
    await pg.fill('#itinCampoTitulo', titulo);
    await pg.click('#itinEditorOk');
    await fechada();
  };
  // ── L. A FOLHA DE UM HORÁRIO: roletas, nenhum campo do sistema ────────────
  await pg.click('#itinNovoBtn');
  await abrirFolha();
  {
    const f = await pg.evaluate(() => {
      const ok = document.getElementById('itinEditorOk');
      const cx = document.getElementById('itinRoletas');
      const rh = document.getElementById('itinRoleta_hora');
      const r = rh.getBoundingClientRect();
      return {
        times: document.querySelectorAll('input[type="time"]').length,
        roletas: cx.querySelectorAll('.roleta').length,
        rola: cx.querySelectorAll('.rola').length,
        item: roletaItem(cx), alto: Math.round(r.height),
        okOff: ok.disabled, okTitulo: ok.title,
        // A SUGESTÃO para uma lista vazia: o próximo múltiplo de cinco depois
        // de agora (09:58 → 10:00).
        valor: roletaValorDe(rh) * 60 + roletaValorDe(document.getElementById('itinRoleta_min')),
      };
    });
    checar(f.times === 0 && f.roletas === 2 && f.rola === 0 && f.item >= 22,
      'L · o horário se escolhe em DUAS roletas (hora e minuto), sem `<input type="time">` em lugar nenhum', f);
    checar(f.valor === 600, 'L · a folha nova abre no horário sugerido (10:00 às 09:58)', f);
    checar(f.okOff && /título/i.test(f.okTitulo), 'L · sem título o confirmar é APAGADO e diz por quê', f);
    // A RODA RESPONDE AO GESTO: uma volta da roda do mouse para baixo sobre a
    // hora desce a lista uma célula — e o valor CRESCE PARA CIMA (o idioma das
    // roletas do Timer), então ele cai de 10 para 9.
    // A FOLHA DESCE ANIMADA: o gesto espera ela assentar no teto.
    await esperar(pg, () => document.querySelector('#itinPopup .popup-sheet').getBoundingClientRect().top >= -0.5);
    const caixa = await pg.locator('#itinRoleta_hora').boundingBox();
    await pg.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
    await pg.mouse.wheel(0, f.item);
    const rw = await esperar(pg, () => roletaValorDe(document.getElementById('itinRoleta_hora')) === 9, null, 5000);
    checar(rw === true, 'L · a roleta da hora responde ao gesto (10 → 9 com uma célula de rolagem)', porque(rw));
  }
  await pg.click('#itinPopupClose');
  await fechada();
  // ── N. O TECLADO DA FOLHA NÃO MEXE NA BARRA DA BIBLIOTECA (v1.13.2) ──────
  // Relato do operador: ao confirmar um horário, a caixa de busca da Biblioteca
  // (a barra que repousa no topo da caixa de controles) subia e descia na tela.
  // O campo do título ENCOLHIA o app com o teclado (`--kb`): a barra subia com
  // ele e descia quando o confirmar tirava o foco do campo.
  {
    const topoDaBarra = () => pg.evaluate(() => Math.round(document.getElementById('libBar').getBoundingClientRect().top * 10) / 10);
    const antes = await topoDaBarra();
    await pg.click('#itinNovoBtn');
    await abrirFolha();
    await esperar(pg, () => document.querySelector('#itinPopup .popup-sheet').getBoundingClientRect().top >= -0.5);
    await escolherHora('10:00');
    await pg.click('#itinCampoTitulo');
    await pg.evaluate(() => window.__teclado(450));
    const rk = await esperar(pg, () => getComputedStyle(document.documentElement).getPropertyValue('--kb-folha').trim() === '450px');
    await pg.keyboard.type('Louvor');
    // O tempo de a barra deslizar, se ela fosse deslizar (`--lib-anim`).
    await pg.waitForTimeout(600);
    const comTeclado = await pg.evaluate(() => ({
      barra: Math.round(document.getElementById('libBar').getBoundingClientRect().top * 10) / 10,
      kb: getComputedStyle(document.documentElement).getPropertyValue('--kb').trim(),
      fundoDaFolha: Math.round(document.querySelector('#itinPopup .popup-sheet').getBoundingClientRect().bottom),
      okFundo: Math.round(document.getElementById('itinEditorOk').getBoundingClientRect().bottom),
      limite: innerHeight - 450,
    }));
    checar(rk === true && comTeclado.barra === antes && comTeclado.kb === '0px',
      'N · com o teclado no ar a barra de busca da Biblioteca NÃO sobe — o app por baixo não encolhe',
      { antes, comTeclado, r: porque(rk) });
    checar(comTeclado.fundoDaFolha <= comTeclado.limite + 1 && comTeclado.okFundo <= comTeclado.limite + 1,
      'N · e a folha (com o confirmar) continua terminando onde o teclado começa', comTeclado);
    // O CONFIRMAR, amostrado quadro a quadro: o foco sai do campo e o teclado
    // desce logo depois — nada pode mexer na barra no caminho.
    await pg.evaluate(() => {
      window.__barra = [];
      const f = () => {
        window.__barra.push(Math.round(document.getElementById('libBar').getBoundingClientRect().top * 10) / 10);
        if (window.__barra.length < 60) requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    });
    await pg.click('#itinEditorOk');
    await pg.evaluate(() => window.__teclado(0));
    await fechada();
    await esperar(pg, () => window.__barra.length >= 60, null, 5000);
    const amostras = await pg.evaluate(() => window.__barra);
    const fora = amostras.filter((y) => Math.abs(y - antes) > 0.5);
    checar(fora.length === 0 && (await topoDaBarra()) === antes,
      'N · e no CONFIRMAR ela não desce nem sobe: parada no mesmo pixel em todos os quadros', { antes, fora: fora.slice(0, 8) });
  }
  // FORA DE ORDEM de propósito (a primeira, "10:00 Louvor", entrou pelo bloco N).
  await adicionar('09:00', 'Recepção');
  await adicionar('10:30', 'Sermão');
  await adicionar('11:00', 'Bênção');
  const lista = () => pg.evaluate(() => [...document.querySelectorAll('#itinLista .itin-li')]
    .map((li) => li.querySelector('.itin-thumb-hora').textContent + ' ' + li.querySelector('.row-name').textContent));
  checar((await lista()).join(' · ') === '09:00 Recepção · 10:00 Louvor · 10:30 Sermão · 11:00 Bênção',
    'B · adicionados fora de ordem, a lista do painel sai pelo horário', await lista());
  {
    const anat = await pg.evaluate(() => {
      const li = document.querySelector('#itinLista .itin-li');
      return {
        lib: li.classList.contains('lib-item'),
        capa: !!li.querySelector('.row > .thumb .itin-thumb-hora'),
        sub: !!li.querySelector('.row-text > .row-sub'),
        mais: !!li.querySelector('.row > .row-mais'),
        acoes: [...li.querySelectorAll('.row-acoes > button')].map((b) => b.className),
        novoFora: !document.getElementById('itinNovoBtn').closest('#itinLista'),
      };
    });
    checar(anat.lib && anat.capa && anat.sub && anat.mais && anat.acoes.length === 4
      && /row-excluir/.test(anat.acoes[0]) && /itin-editar/.test(anat.acoes[1])
      && /row-ordem/.test(anat.acoes[2]) && /row-ordem/.test(anat.acoes[3]) && anat.novoFora,
      'B · a linha é a LISTA do app: a hora na capa, nome e subtítulo, e o `⋮` com excluir · editar · ↑ · ↓ '
      + '(o par por último, como no Cronograma); "Adicionar horário" fora do scroller', anat);
  }
  const banco = () => pg.evaluate(() => AVDB.getState('itinerario'));
  {
    const b = await banco();
    checar(b && Array.isArray(b.itens) && b.itens.map((x) => x.titulo).join('|') === 'Recepção|Louvor|Sermão|Bênção',
      'B · e ela está no banco (`state.itinerario`), na mesma ordem', b);
  }

  // EDITAR: tocar na linha abre a MESMA folha, com o horário e o título dela.
  await pg.evaluate(() => [...document.querySelectorAll('#itinLista .itin-li')]
    .find((li) => /Sermão/.test(li.textContent)).querySelector('.row-name').click());
  await abrirFolha();
  {
    const e = await pg.evaluate(() => ({
      titulo: document.getElementById('itinPopupTitulo').textContent,
      campo: document.getElementById('itinCampoTitulo').value,
      valor: roletaValorDe(document.getElementById('itinRoleta_hora')) * 60
        + roletaValorDe(document.getElementById('itinRoleta_min')),
    }));
    checar(e.titulo === 'Editar horário' && e.campo === 'Sermão' && e.valor === 630,
      'B · tocar na linha abre a folha de EDIÇÃO com o horário e o título dela', e);
  }
  await escolherHora('10:40');
  await pg.fill('#itinCampoTitulo', 'Pregação');
  await pg.click('#itinEditorOk');
  await fechada();
  checar((await lista()).includes('10:40 Pregação'), 'B · editar troca horário e título', await lista());
  // EXCLUIR pergunta NA LINHA (o `⋮`, a lixeira, o "Excluir" da faixa).
  await pg.evaluate(() => [...document.querySelectorAll('#itinLista .itin-li')]
    .find((li) => /Bênção/.test(li.textContent)).querySelector('.row-mais').click());
  await pg.evaluate(() => [...document.querySelectorAll('#itinLista .itin-li')]
    .find((li) => /Bênção/.test(li.textContent)).querySelector('.row-excluir').click());
  {
    const r = await esperar(pg, () => !!document.querySelector('#itinLista .linha-sim'));
    checar(r === true && (await pg.evaluate(() => document.getElementById('appDialog').classList.contains('open'))) === false,
      'B · excluir pergunta NA LINHA, sem diálogo', porque(r));
  }
  await pg.click('#itinLista .linha-sim');
  await esperar(pg, () => ![...document.querySelectorAll('.itin-li')].some((b) => /Bênção/.test(b.textContent)));
  checar((await lista()).join(' · ') === '09:00 Recepção · 10:00 Louvor · 10:40 Pregação',
    'B · e o "Excluir" tira a linha', await lista());
  {
    const r = await esperar(pg, () => true);
    const b = await banco();
    checar(b && b.itens.length === 3 && b.itens[2].titulo === 'Pregação' && b.itens[2].min === 640,
      'B · e o banco acompanha a edição e a exclusão', b || porque(r));
  }

  // A RECARGA: a lista e a vista do Tempo voltam do banco.
  await pg.reload();
  await pg.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function', null, { timeout: 30000 });
  await esperarCortina(pg);
  await pg.evaluate(() => {
    abrirFerramentas();
    [...document.querySelectorAll('.misc-tab')].find((b) => b.textContent.trim() === 'Tempo').click();
  });
  await esperar(pg, () => !!document.getElementById('itinLista'));
  checar((await lista()).join(' · ') === '09:00 Recepção · 10:00 Louvor · 10:40 Pregação',
    'B · depois de RECARREGAR, a lista volta do banco — e o Tempo reabre no Itinerário', await lista());

  // ── C. PROJETAR, E A TROCA QUANDO O RELÓGIO CRUZA ────────────────────────
  // Espia o barramento: a troca de item NÃO pode custar comando nenhum.
  await pg.evaluate(() => {
    window.__cmds = [];
    const orig = AVDB.sendCommand;
    AVDB.sendCommand = function (c) { window.__cmds.push(c); return orig.apply(this, arguments); };
  });
  await pg.click('#miscProjectBtn');
  await esperar(pg, () => !!document.querySelector('#pvTextItin .itin-linha'));
  const pv = () => pg.evaluate(() => ({
    linhas: [...document.querySelectorAll('#pvTextItin .itin-linha:not(.itin-saindo)')].map((l) =>
      (l.classList.contains('agora') ? '*' : '') + l.querySelector('.itin-hora').textContent + ' '
      + l.querySelector('.itin-titulo').textContent),
    painel: [...document.querySelectorAll('#itinLista .itin-li.active .row-name')].map((e) => e.textContent),
    anima: [...document.querySelectorAll('#pvTextItin .itin-linha')]
      .reduce((n, l) => n + l.getAnimations().filter((a) => a.playState === 'running').length, 0),
    semHoras: document.getElementById('pvTextItin').classList.contains('sem-horas'),
    horaVisivel: (() => { const h = document.querySelector('#pvTextItin .itin-hora'); return h ? getComputedStyle(h).display : null; })(),
  }));
  const cmdItin = await pg.evaluate(() => window.__cmds.filter((c) => c.type === 'text' && c.mode === 'itinerario'));
  checar(cmdItin.length === 1 && Array.isArray(cmdItin[0].itinerario.itens) && cmdItin[0].itinerario.itens.length === 3
    && Number.isFinite(cmdItin[0].itinerario.fuso),
    'C · projetar manda UM descritor (a lista, o ajuste, o fuso) — não o estado calculado', cmdItin);
  {
    const v = await pv();
    checar(v.linhas[0] === '*09:00 Recepção' && v.linhas.length === 3,
      'C · às 09:58 a preview mostra "Recepção" em destaque e os seguintes abaixo', v);
    checar(v.painel.join() === 'Recepção', 'C · e o painel marca o mesmo item', v.painel);
  }
  await pg.evaluate(() => { window.__cmds.length = 0; });
  await ctx.clock.pauseAt(T('09:59', 57));
  await ctx.clock.runFor(5000);   // cruza 10:00:00 com o laço de um segundo
  {
    const v = await pv();
    checar(v.linhas[0] === '*10:00 Louvor' && v.linhas.length === 2,
      'C · ao cruzar 10:00 o destaque passa para "Louvor", e "Recepção" sai da lista', v);
    checar(v.painel.join() === 'Louvor', 'C · o painel acompanha o relógio', v.painel);
    checar(v.anima > 0, 'C · e a troca é ANIMADA (as linhas têm animação viva)', v);
    const novos = await pg.evaluate(() => window.__cmds.length);
    checar(novos === 0, 'C · sem comando nenhum no barramento: cada tela segue o próprio relógio', novos);
  }
  await ctx.clock.resume();

  // ── D. O AJUSTE ──────────────────────────────────────────────────────────
  const horasPv = async () => (await pv()).linhas.map((t) => t.replace('*', '').slice(0, 5));
  const mins = (hs) => hs.map((h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3)));
  await pg.click('.itin-ajuste .itin-passo[aria-label="Atrasar 5 min"]');
  await esperar(pg, () => document.getElementById('itinAjusteTxt').textContent.includes('5'));
  {
    const v = await pv();
    const b = await banco();
    // Com +5, às ~10:00:05 o "Louvor" (10:05) ainda não começou: volta a ser a Recepção.
    checar(v.linhas[0] === '*09:05 Recepção' && v.linhas.join('|').includes('10:05 Louvor')
      && v.linhas.join('|').includes('10:45 Pregação'),
      'D · +5 desloca TODOS os horários e o de agora acompanha (Louvor passa a 10:05)', v.linhas);
    checar(b && b.desloc === 5 && /^\d{4}-\d{2}-\d{2}$/.test(b.deslocDia || ''),
      'D · e o ajuste é guardado PELO DIA', b);
  }
  await pg.click('.itin-ajuste .itin-passo[aria-label="Adiantar 1 min"]');
  await esperar(pg, () => document.getElementById('itinAjusteTxt').textContent.includes('4'));
  {
    const h = await horasPv();
    const m = mins(h);
    checar(h[0] === '09:04' && m[1] - m[0] === 60 && m[2] - m[1] === 40,
      'D · −1 recua todos juntos, e os INTERVALOS ficam (60 e 40 min)', h);
  }
  await pg.click('.itin-ajuste .itin-zerar');
  await esperar(pg, () => document.getElementById('itinAjusteTxt').textContent === 'No horário');
  {
    const v = await pv();
    const zerar = await pg.evaluate(() => document.querySelector('.itin-ajuste .itin-zerar').disabled);
    checar(v.linhas[0] === '*10:00 Louvor' && zerar,
      'D · o ↺ volta ao previsto, e no previsto ele fica APAGADO', { v, zerar });
  }

  // ── J. O PAR AO LADO DA PREVIEW É O AJUSTE, DE 5 EM 5 MIN ──────────────
  // Pedido do operador (v1.13.1): com o itinerário no ar, ⏮ adianta 5 min e ⏭
  // atrasa 5 min — a ordem do −5 … +5 do painel. Revoga a v1.13.0 (par apagado).
  {
    const par = await pg.evaluate(() => ({
      alvo: slideTarget(), fora: eixoForaDoPainel(),
      prev: [slidePrevBtnEl.disabled, slidePrevBtnEl.title, slidePrevBtnEl.textContent.trim()],
      next: [slideNextBtnEl.disabled, slideNextBtnEl.title, slideNextBtnEl.textContent.trim()],
      nome: SLIDE_AXIS_NAME.itinerario,
    }));
    checar(par.alvo === 'itinerario' && !par.prev[0] && !par.next[0]
      && par.prev[2] === '−5' && par.next[2] === '+5'
      && /Adiantar 5 min/.test(par.prev[1]) && /Atrasar 5 min/.test(par.next[1]),
      'J · com o itinerário no ar o par diz "−5"/"+5" e está aceso', par);
    checar(par.fora === 'itinerario' && /5 min/.test(par.nome),
      'J · e ele vale também na tela cheia e na notificação (não é eixo só do painel), com o rótulo "±5 min"', par);
  }
  // COM A FOLHA FECHADA: o par não depende do painel.
  await pg.evaluate(() => fecharFerramentas());
  // A FOLHA DESCE ANIMADA, e só some no fim: reabri-la antes disso é a corrida
  // que o `abrirFerramentas` não cobre (ele volta cedo com ela ainda à vista).
  await esperar(pg, () => toolsSheetEl.hidden);
  await pg.click('#slideNextBtn');
  await pg.click('#slideNextBtn');
  await pg.click('#slidePrevBtn');
  {
    const r = await esperar(pg, () => itin.desloc === 5);
    const b = await banco();
    const h = await horasPv();
    checar(r === true && b.desloc === 5 && h.includes('10:05'),
      'J · ⏭ ⏭ ⏮ = +5 min: o ajuste anda de 5 em 5, é guardado e o telão acompanha (Louvor 10:05)',
      { r: porque(r), desloc: b && b.desloc, h });
  }
  // A COLUNA DA TELA CHEIA roteia pelo mesmo par (`attachTransportStep`).
  await pg.evaluate(() => document.getElementById('fsPrev').click());
  {
    const r = await esperar(pg, () => itin.desloc === 0);
    checar(r === true, 'J · o ⏮ da coluna da tela cheia adianta 5 min pelo mesmo caminho', porque(r));
  }
  // NOS EXTREMOS o passo apaga — a mesma régua dos −5/+5 do painel.
  {
    const lim = await pg.evaluate(() => {
      itin.desloc = ITIN_DESLOC_MAX - 5; itinAjustar(5);
      const noTeto = [slidePrevBtnEl.disabled, slideNextBtnEl.disabled];
      itinAjusteZerar();
      const zerado = [slidePrevBtnEl.disabled, slideNextBtnEl.disabled];
      return { noTeto, zerado, desloc: itin.desloc };
    });
    checar(lim.noTeto[0] === false && lim.noTeto[1] === true && lim.zerado.join() === 'false,false' && lim.desloc === 0,
      'J · em +12 h o ⏭ APAGA (e o ⏮ não); zerado, os dois voltam', lim);
  }
  await pg.evaluate(() => {
    abrirFerramentas();
    [...document.querySelectorAll('.misc-tab')].find((b) => b.textContent.trim() === 'Tempo').click();
  });
  await esperar(pg, () => !!document.getElementById('itinLista'));

  // ── E. HORÁRIOS × SÓ OS TÍTULOS ──────────────────────────────────────────
  await pg.click('#itinHorasBtn');
  await esperar(pg, () => document.getElementById('pvTextItin').classList.contains('sem-horas'));
  {
    const v = await pv();
    const b = await banco();
    checar(v.semHoras && v.horaVisivel === 'none' && b.horas === false,
      'E · "só os títulos": a hora some da lista projetada, e a escolha é guardada', { v, horas: b.horas });
    checar(v.linhas[0].startsWith('*'), 'E · e o item de agora CONTINUA marcado', v.linhas);
  }
  await pg.click('#itinHorasBtn');
  await esperar(pg, () => !document.getElementById('pvTextItin').classList.contains('sem-horas'));

  // ── F. O TELÃO — e o REENVIO quando ele se reapresenta ───────────────────
  const tv = await ctx.newPage();
  vigiar(tv);
  await tv.setViewportSize({ width: 960, height: 540 });
  await tv.goto(base + '/display/');
  await tv.waitForFunction(() => window.AVDB && !!document.getElementById('textItin'), null, { timeout: 20000 });
  // Quem traz a lista é o Controle, respondendo ao `display-ready` desta carga.
  const rTv = await esperar(tv, () => !!document.querySelector('#textItin .itin-linha.agora'), null, 10000);
  const telao = () => tv.evaluate(() => ({
    modo: document.getElementById('textContent').classList.contains('mode-itinerario'),
    linhas: [...document.querySelectorAll('#textItin .itin-linha:not(.itin-saindo)')].map((l) =>
      (l.classList.contains('agora') ? '*' : l.classList.contains('seguir') ? '>' : '')
      + l.querySelector('.itin-hora').textContent + ' ' + l.querySelector('.itin-titulo').textContent
      + (l.querySelector('.itin-tag').textContent ? ' [' + l.querySelector('.itin-tag').textContent + ']' : '')),
    anima: [...document.querySelectorAll('#textItin .itin-linha')]
      .reduce((n, l) => n + l.getAnimations().filter((a) => a.playState === 'running').length, 0),
    cartao: !document.getElementById('text').hidden,
  }));
  {
    const t = await telao();
    checar(rTv === true && t.modo && t.cartao && t.linhas[0] === '*10:00 Louvor [Agora]'
      && t.linhas[1] === '10:40 Pregação',
      'F · um telão que (re)carrega recebe a lista pelo REENVIO de cena, no item certo', porque(rTv) || t);
  }

  // ── M. O DESENHO NO TELÃO (v1.13.1) ──────────────────────────────────────
  // Pedido do operador: o wallpaper continua à vista; só um bloco escuro e
  // semitransparente atrás do texto, alinhado à esquerda e sem ocupar a largura
  // toda; a marca "Agora" à ESQUERDA do texto, colada nele.
  {
    const g = await tv.evaluate(() => {
      const camada = document.getElementById('text');
      const ol = document.getElementById('textItin');
      const r = ol.getBoundingClientRect();
      const li = ol.querySelector('.itin-linha.agora');
      const tag = li.querySelector('.itin-tag').getBoundingClientRect();
      const hora = li.querySelector('.itin-hora').getBoundingClientRect();
      return {
        fundo: getComputedStyle(camada).backgroundImage,
        painel: getComputedStyle(ol).backgroundColor,
        esq: r.left / innerWidth, dir: r.right / innerWidth,
        primeiro: li.firstElementChild.className, alinha: getComputedStyle(ol).textAlign,
        vao: (hora.left - tag.right) / innerWidth, ordem: tag.right <= hora.left + 1,
        pv: (() => {
          const p = document.getElementById('pvText');
          return p ? getComputedStyle(p).backgroundImage : null;
        })(),
      };
    });
    checar(/wallpaper-padrao\.svg/.test(g.fundo), 'M · por trás da lista, o WALLPAPER (o desenho padrão), não o preto', g);
    checar(g.painel === 'rgba(0, 0, 0, 0.72)', 'M · o bloco é a camada escura SEMITRANSPARENTE do palco (`--stage-painel`)', g);
    checar(Math.abs((g.esq + g.dir) / 2 - 0.5) < 0.01 && g.dir - g.esq <= 0.62 && g.alinha === 'left',
      'M · o bloco é uma coluna CENTRADA na tela, estreita (sem ocupar a largura toda), e o texto de dentro '
      + 'continua alinhado à esquerda (v1.13.2)', g);
    checar(g.primeiro === 'itin-tag' && g.ordem && g.vao >= 0 && g.vao < 0.04,
      'M · a marca "Agora" é a primeira coisa da linha, à esquerda do horário e colada nele', g);
    const pvFundo = await pg.evaluate(() => getComputedStyle(document.getElementById('pvText')).backgroundImage);
    checar(/wallpaper-padrao\.svg/.test(pvFundo), 'M · e a preview mostra o MESMO fundo (o wallpaper)', pvFundo);
    const pvCentro = await pg.evaluate(() => {
      const c = document.getElementById('pvText').getBoundingClientRect();
      const r = document.getElementById('pvTextItin').getBoundingClientRect();
      return { meio: ((r.left + r.right) / 2 - c.left) / c.width, larg: r.width / c.width };
    });
    checar(Math.abs(pvCentro.meio - 0.5) < 0.02 && pvCentro.larg < 0.9,
      'M · e na preview o bloco também é CENTRADO (a gêmea do `display.css`)', pvCentro);
    // NUM WALLPAPER BRANCO o wallpaper continua à vista em volta, e o bloco
    // escurece o que está atrás DELE — medido por pixel.
    await tv.evaluate(() => {
      document.getElementById('wallpaper').style.backgroundImage = 'url("data:image/svg+xml,'
        + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#fff"/></svg>') + '")';
      pintarFundoDoCartao();
      // O "Ligar Sistema" do navegador cobre a tela inteira até o primeiro
      // gesto (no app ele nem existe): fora da medida.
      const b = document.getElementById('startBtn'); if (b) b.style.display = 'none';
    });
    // A CORTINA ainda pode estar terminando de abrir (o fade do cartão): mede-se
    // com ela fora de vista, senão o branco dela clareia o bloco.
    await esperar(tv, () => Number(getComputedStyle(document.getElementById('wallpaper')).opacity) === 0
      || getComputedStyle(document.getElementById('wallpaper')).display === 'none');
    await tv.waitForTimeout(100);
    const img = lerPng(await tv.screenshot());
    const geo = await tv.evaluate(() => {
      const r = document.getElementById('textItin').getBoundingClientRect();
      // Longe do arco do canto (ali o anti-serrilhado mistura o branco): a
      // faixa de baixo do bloco, que a reserva da lista cheia deixa vazia.
      return { x: Math.round(r.left + 40), yVazio: Math.round(r.bottom - 20), fora: Math.round(innerWidth - 20) };
    });
    const dentro = pixel(img, geo.x, geo.yVazio);
    const fora = pixel(img, geo.fora, 20);
    checar(fora[0] > 240 && fora[1] > 240 && dentro[0] > 55 && dentro[0] < 90,
      'M · sobre um wallpaper branco: fora do bloco ele fica BRANCO, e dentro do bloco cinza-escuro (~#474747)',
      { dentro, fora, geo });
    await tv.evaluate(() => { document.getElementById('wallpaper').style.backgroundImage = ''; pintarFundoDoCartao(); });
  }
  // ── O. O PAR ↑↓, COMO NO CRONOGRAMA (v1.13.2) ──────────────────────────
  // Mover TROCA o evento com o vizinho e os horários ficam no lugar: "Louvor"
  // desce e leva o 10:40, "Pregação" sobe para o 10:00 — a grade não muda.
  {
    const abrirMais = (titulo) => pg.evaluate((t) => [...document.querySelectorAll('#itinLista .itin-li')]
      .find((li) => li.querySelector('.row-name').textContent === t).querySelector('.row-mais').click(), titulo);
    const ordem = (titulo) => pg.evaluate((t) => {
      const li = [...document.querySelectorAll('#itinLista .itin-li')].find((x) => x.querySelector('.row-name').textContent === t);
      return [...li.querySelectorAll('.row-acoes > .row-ordem')].map((b) => [b.getAttribute('aria-label'), b.disabled]);
    }, titulo);
    const pontas = { primeiro: await ordem('Recepção'), ultimo: await ordem('Pregação') };
    checar(pontas.primeiro.join() === 'Mover para cima,true,Mover para baixo,false'
      && pontas.ultimo.join() === 'Mover para cima,false,Mover para baixo,true',
      'O · as PONTAS apagam: o primeiro não sobe, o último não desce', pontas);
    await abrirMais('Louvor');
    await pg.evaluate(() => [...document.querySelectorAll('#itinLista .itin-li')]
      .find((li) => li.querySelector('.row-name').textContent === 'Louvor')
      .querySelector('.row-ordem[aria-label="Mover para baixo"]').click());
    await esperar(pg, () => [...document.querySelectorAll('#itinLista .itin-li')].map((li) => li.querySelector('.row-name').textContent).join() === 'Recepção,Pregação,Louvor');
    const depois = await pg.evaluate(() => ({
      lista: [...document.querySelectorAll('#itinLista .itin-li')].map((li) => li.querySelector('.itin-thumb-hora').textContent + ' ' + li.querySelector('.row-name').textContent),
      aberta: (document.querySelector('#itinLista .itin-li.acoes-abertas .row-name') || {}).textContent || '',
    }));
    checar(depois.lista.join(' · ') === '09:00 Recepção · 10:00 Pregação · 10:40 Louvor',
      'O · ↓ em "Louvor": ele TROCA de lugar com o vizinho e os HORÁRIOS ficam onde estavam', depois.lista);
    checar(depois.aberta === 'Louvor', 'O · e a faixa REABRE na linha que andou — o segundo toque cai no mesmo lugar', depois);
    const b = await banco();
    checar(b.itens.map((x) => x.min + ' ' + x.titulo).join('|') === '540 Recepção|600 Pregação|640 Louvor',
      'O · e a troca é gravada (`state.itinerario`)', b.itens);
    const rt = await esperar(tv, () => {
      const l = document.querySelector('#textItin .itin-linha.agora .itin-titulo');
      return !!l && l.textContent === 'Pregação';
    });
    const t = await telao();
    checar(rt === true && t.linhas[0] === '*10:00 Pregação [Agora]' && t.linhas[1] === '10:40 Louvor' && t.anima > 0,
      'O · o telão acompanha, ANIMADO: "Pregação" passa a ser o de agora (10:00) e "Louvor" vai a 10:40', { t, r: porque(rt) });
    // E DE VOLTA: ↑ em "Louvor" (a faixa continua aberta nele).
    await pg.evaluate(() => document.querySelector('#itinLista .itin-li.acoes-abertas .row-ordem[aria-label="Mover para cima"]').click());
    await esperar(pg, () => [...document.querySelectorAll('#itinLista .itin-li')].map((li) => li.querySelector('.row-name').textContent).join() === 'Recepção,Louvor,Pregação');
    checar((await lista()).join(' · ') === '09:00 Recepção · 10:00 Louvor · 10:40 Pregação',
      'O · ↑ desfaz: a mesma troca, no sentido oposto', await lista());
    await pg.evaluate(() => fecharAcoesDaLinha());
    await esperar(tv, () => {
      const l = document.querySelector('#textItin .itin-linha.agora .itin-titulo');
      return !!l && l.textContent === 'Louvor';
    });
  }

  // O telão segue o PRÓPRIO relógio: cruzar 10:40 troca o destaque lá também.
  await ctx.clock.pauseAt(T('10:39', 58));
  await ctx.clock.runFor(4000);
  {
    const t = await telao();
    checar(t.linhas.length === 1 && t.linhas[0] === '*10:40 Pregação [Agora]',
      'G · depois do último horário o último fica no ar, sozinho', t.linhas);
    checar(t.anima > 0, 'F · e no telão a troca também é animada', t);
  }
  await ctx.clock.resume();

  // ANTES DO PRIMEIRO, pelo barramento cru (um descritor de amanhã cedo).
  const mandar = (c) => tv.evaluate((cmd) => { const bc = new BroadcastChannel('av-iasd'); bc.postMessage(cmd); bc.close(); }, c);
  const fuso = await tv.evaluate(() => new Date().getTimezoneOffset());
  await mandar({ type: 'text', mode: 'itinerario', view: 'visual', __mid: 'it:1',
    itinerario: { itens: [{ k: 'x', min: 1380, titulo: 'Vigília' }, { k: 'y', min: 1410, titulo: 'Oração' }], desloc: 0, horas: true, fuso } });
  await esperar(tv, () => !!document.querySelector('#textItin .itin-linha.seguir'));
  {
    const t = await telao();
    checar(t.linhas[0] === '>23:00 Vigília [A seguir]' && !t.linhas.some((l) => l.startsWith('*')),
      'G · antes do primeiro horário NADA está em destaque, e o primeiro diz "A seguir"', t.linhas);
  }

  // ── H. MOVIMENTO REDUZIDO ────────────────────────────────────────────────
  await tv.emulateMedia({ reducedMotion: 'reduce' });
  await mandar({ type: 'text', mode: 'itinerario', view: 'visual', __mid: 'it:2',
    itinerario: { itens: [{ k: 'a', min: 600, titulo: 'Louvor' }, { k: 'b', min: 1380, titulo: 'Fim' }], desloc: 0, horas: true, fuso } });
  await esperar(tv, () => /Louvor/.test(document.getElementById('textItin').textContent));
  // CONTA AS CHAMADAS de `animate`, e não as animações vivas: o deslize dura
  // 700 ms de relógio REAL, e a espera pelo fato (que corre sobre o relógio
  // falso) pode chegar depois dele — MEDIDO, com o filtro do movimento
  // reduzido removido a contagem de vivas dava 0 do mesmo jeito.
  await tv.evaluate(() => {
    window.__animou = 0;
    const orig = Element.prototype.animate;
    Element.prototype.animate = function () { window.__animou++; return orig.apply(this, arguments); };
  });
  await mandar({ type: 'text', mode: 'itinerario', view: 'visual', __mid: 'it:3',
    itinerario: { itens: [{ k: 'a', min: 600, titulo: 'Louvor' }, { k: 'b', min: 620, titulo: 'Fim' }], desloc: 0, horas: true, fuso } });
  await esperar(tv, () => !!document.querySelector('#textItin .itin-linha.agora .itin-titulo')
    && document.querySelector('#textItin .itin-linha.agora .itin-titulo').textContent === 'Fim');
  {
    const t = await telao();
    const trans = await tv.evaluate(() => getComputedStyle(document.querySelector('#textItin .itin-linha')).transitionDuration);
    const animou = await tv.evaluate(() => window.__animou);
    checar(t.linhas.join() === '*10:20 Fim [Agora]' && animou === 0 && /^0s/.test(trans),
      'H · com `prefers-reduced-motion` a troca acontece SEM movimento (nem deslize, nem transição)',
      { linhas: t.linhas, animou, trans });
  }

  // ── K. OS DESTINOS: Cronograma e Favoritos, como as abas irmãs ─────────
  // Pedido do operador (v1.13.1). O que se guarda é a PROGRAMAÇÃO (itens e
  // horários × títulos), e não o ajuste, que é do dia.
  await pg.evaluate(() => { itinAjustar(5); });
  {
    const foot = await pg.evaluate(() => [...document.querySelectorAll('#toolsFoot .cue-save-btn')]
      .map((b) => [b.getAttribute('aria-label'), b.disabled]));
    checar(foot.length === 2 && foot[0][0] === 'Adicionar ao Cronograma' && foot[1][0] === 'Favoritar'
      && !foot[0][1] && !foot[1][1],
      'K · o rodapé do itinerário tem os DOIS destinos, na ordem Cronograma · favoritos', foot);
  }
  await pg.click('#toolsFoot .cue-save-btn[aria-label="Adicionar ao Cronograma"]');
  await pg.click('#toolsFoot .cue-save-btn[aria-label="Favoritar"]');
  const achaCue = (lista) => pg.evaluate(async (l) => (await AVDB.listItems(l))
    .filter((r) => r.kind === 'cue' && r.cue === 'itinerario'), lista);
  {
    const r = await esperarDb(pg, async () => (await AVDB.listItems('favs')).some((x) => x.cue === 'itinerario'));
    const crono = await achaCue('imports');
    const favs = await achaCue('favs');
    const d = crono[0] && crono[0].data;
    checar(r === true && crono.length === 1 && favs.length === 1 && d
      && d.itens.map((x) => x.min + ' ' + x.titulo).join('|') === '540 Recepção|600 Louvor|640 Pregação'
      && d.horas === true && !('desloc' in d) && /^Itinerário 09:00–10:40$/.test(crono[0].name),
      'K · a cena guarda a programação (sem o ajuste do dia) no Cronograma e nos Favoritos', { crono, favs });
    // O PACOTE leva a cena como qualquer registro: o descritor atravessa inteiro.
    const san = await pg.evaluate((rec) => AVPacote.sanearMedia(rec), crono[0]);
    checar(san && san.kind === 'cue' && san.cue === 'itinerario' && JSON.stringify(san.data) === JSON.stringify(d),
      'K · e o `.avpkg` a leva com o descritor inteiro (`sanearMedia`)', san);
    const sub = await pg.evaluate(() => {
      const li = [...document.querySelectorAll('#library .lib-item')].find((x) => /Itinerário 09:00/.test(x.textContent));
      return li ? li.querySelector('.row-sub').textContent : null;
    });
    checar(sub === 'Itinerário', 'K · e a linha do Cronograma diz o tipo: "Itinerário"', sub);
  }
  // TOCAR NA CENA projeta a programação guardada: ela vira a do painel, e o
  // ajuste do dia FICA (+5).
  await pg.evaluate(() => { hideItin(); itin.itens = [{ id: 'z', min: 700, titulo: 'Outra coisa' }]; itinMudou(); });
  await pg.evaluate(async () => {
    const rec = (await AVDB.listItems('imports')).find((r) => r.cue === 'itinerario');
    await send(rec.id);
  });
  {
    const r = await esperar(pg, () => itinProjecting());
    const st = await pg.evaluate(() => ({
      titulos: itin.itens.map((x) => x.titulo).join('|'), desloc: itin.desloc,
      noAr: !!document.querySelector('#library .lib-item.no-ar'),
    }));
    checar(r === true && st.titulos === 'Recepção|Louvor|Pregação' && st.desloc === 5 && st.noAr,
      'K · tocar na cena do Cronograma projeta a programação guardada, mantém o ajuste do dia e a linha fica NO AR',
      { r: porque(r), st });
  }

  // ── P. OS ITINERÁRIOS MÚLTIPLOS (v1.13.2) ────────────────────────────────
  // A cena acima caiu sobre um ativo que NÃO era ela ("Outra coisa"): virou um
  // itinerário NOVO, e o de antes ficou na lista, intocado.
  const gaveta = () => pg.evaluate(() => itinEntradas().map((x) => x.nome + ':' + x.qtd + (x.ativo ? '*' : '')).join(' · '));
  const tocarCena = () => pg.evaluate(async () => {
    const rec = (await AVDB.listItems('imports')).find((r) => r.cue === 'itinerario');
    await send(rec.id);
  });
  const abrirGavetaItin = async () => {
    await pg.click('#itinTitulo');
    // A GAVETA ANIMA (opacidade e 6px): mede-se depois de ela assentar.
    return esperar(pg, () => {
      const g = document.getElementById('itinGaveta');
      return g.classList.contains('aberta') && g.getAnimations().every((a) => a.playState !== 'running');
    });
  };
  const naGaveta = (nome, qual) => pg.evaluate(([n, q]) => {
    const li = [...document.querySelectorAll('#itinGavetaLista .crono-item')]
      .find((x) => x.querySelector('.crono-item-nome').textContent === n);
    li.querySelector('.crono-' + q).click();
  }, [nome, qual]);
  const responder = async (valor) => {
    await esperar(pg, () => document.getElementById('appDialog').classList.contains('open'));
    if (typeof valor === 'string') await pg.fill('#appDialogInput', valor);
    await pg.click('#appDialogOk');
    await esperar(pg, () => !document.getElementById('appDialog').classList.contains('open'));
  };
  checar((await gaveta()) === 'Itinerário:1 · Itinerário 09:00–10:40:3*',
    'P · a cena tocada sobre outro itinerário virou um itinerário NOVO (o nome da cena), e o de antes FICOU na lista',
    await gaveta());
  {
    const r = await abrirGavetaItin();
    const g = await pg.evaluate(() => {
      const itens = [...document.querySelectorAll('#itinGavetaLista .crono-item')];
      const ativo = itens.find((li) => li.classList.contains('ativo'));
      const geo = ativo && (() => {
        const row = ativo.getBoundingClientRect();
        const ren = ativo.querySelector('.crono-renomear').getBoundingClientRect();
        const exc = ativo.querySelector('.crono-excluir').getBoundingClientRect();
        const nm = ativo.querySelector('.crono-item-nome').getBoundingClientRect();
        return { renEsq: ren.left - row.left < 12, excDir: row.right - exc.right < 12,
          centro: Math.abs((nm.left + nm.right) / 2 - (row.left + row.right) / 2) };
      })();
      const tit = document.getElementById('itinTitulo').getBoundingClientRect();
      const gav = document.getElementById('itinGaveta').getBoundingClientRect();
      return {
        titulo: document.getElementById('itinNome').textContent,
        expandido: document.getElementById('itinTitulo').getAttribute('aria-expanded'),
        nomes: itens.map((li) => li.querySelector('.crono-item-nome').textContent + ':' + li.querySelector('.crono-item-qtd').textContent),
        ativo: ativo && ativo.querySelector('.crono-item-nome').textContent,
        excluirAceso: itens.every((li) => !li.querySelector('.crono-excluir').disabled),
        ultimo: (document.querySelector('#itinGavetaLista > li:last-child').textContent || '').trim(),
        geo, abaixo: gav.top >= tit.bottom - 1 && gav.top - tit.bottom < 24
      };
    });
    checar(r === true && g.titulo === 'Itinerário 09:00–10:40' && g.expandido === 'true'
      && g.nomes.join(' · ') === 'Itinerário:1 horário · Itinerário 09:00–10:40:3 horários'
      && g.ativo === 'Itinerário 09:00–10:40' && g.excluirAceso && g.ultimo === 'Novo itinerário' && g.abaixo,
      'P · o NOME do ativo é o título do painel e abre a GAVETA logo abaixo: uma linha por itinerário (o ativo '
      + 'marcado, a conta de horários) e "Novo itinerário" por último', g);
    checar(g.geo && g.geo.renEsq && g.geo.excDir && g.geo.centro < 2,
      'P · a linha é a dos cronogramas: renomear à ESQUERDA, excluir à DIREITA, o nome no CENTRO', g.geo);
  }
  // O VOLTAR fecha a gaveta ANTES da folha (degrau 1.8 do `__avBack`).
  {
    // A FOLHA "aberta" é à vista E sem a saída em curso: `ferramentasAbertas()`
    // continua verdadeiro enquanto ela desce.
    const v = await pg.evaluate(() => ({ r: window.__avBack(), gaveta: itinGavetaAberta(),
      folha: ferramentasAbertas() && !toolsSheetEl.classList.contains('saindo') }));
    checar(v.r === true && !v.gaveta && v.folha, 'P · o VOLTAR fecha a gaveta e deixa a folha de Ferramentas aberta', v);
  }
  // TOCAR A MESMA CENA DE NOVO não duplica: ela já é o ativo.
  await tocarCena();
  await esperar(pg, () => itinProjecting());
  checar((await gaveta()) === 'Itinerário:1 · Itinerário 09:00–10:40:3*',
    'P · tocar a MESMA cena de novo não cria outro itinerário', await gaveta());
  // TROCAR pela gaveta: o ativo passa a ser o outro, numa escrita só, e o telão
  // (no ar) acompanha — a projeção segue o ativo.
  await abrirGavetaItin();
  await naGaveta('Itinerário', 'trocar');
  {
    const r = await esperar(tv, () => /Outra coisa/.test(document.getElementById('textItin').textContent));
    const st = await banco();
    const fechou = await pg.evaluate(() => !itinGavetaAberta());
    const guardado = st && Array.isArray(st.itinerarios) && st.itinerarios.find((x) => x.id !== st.ativo);
    checar(r === true && fechou && st.v === 2 && st.itens.map((x) => x.titulo).join() === 'Outra coisa'
      && st.itinerarios.length === 2 && guardado && guardado.itens.length === 3
      && (await pg.evaluate(() => document.getElementById('itinNome').textContent)) === 'Itinerário',
      'P · TROCAR pela gaveta: o outro vira o ativo (painel e telão), e o de antes fica GUARDADO com os 3 horários — uma chave, uma escrita',
      { r: porque(r), st, fechou });
  }
  // A CENA GUARDADA DE NOVO, com o outro ativo: ela VOLTA a ser o ativo — o
  // conteúdo acha o lugar dela na lista, e nada é duplicado nem apagado.
  await tocarCena();
  await esperar(pg, () => itin.nome === 'Itinerário 09:00–10:40');
  checar((await gaveta()) === 'Itinerário:1 · Itinerário 09:00–10:40:3*',
    'P · tocar a cena com OUTRO ativo troca para o itinerário dela — sem criar outro e sem apagar "Outra coisa"', await gaveta());
  // E COM O ATIVO EDITADO DEPOIS: a cena não apaga a edição — vira um novo.
  await pg.evaluate(() => itinAdicionar(700, 'Avisos'));
  await tocarCena();
  await esperar(pg, () => itin.nome === 'Itinerário 09:00–10:40 (2)');
  checar((await gaveta()) === 'Itinerário:1 · Itinerário 09:00–10:40:4 · Itinerário 09:00–10:40 (2):3*',
    'P · com o ativo EDITADO depois de guardado, a cena vira um itinerário NOVO (" (2)") — a edição fica intacta',
    await gaveta());
  // RENOMEAR (qualquer um, a gaveta fica aberta) e o nome guardado.
  await abrirGavetaItin();
  await naGaveta('Itinerário', 'renomear');
  await responder('Culto de sábado');
  await esperar(pg, () => itinEntradas().some((x) => x.nome === 'Culto de sábado'));
  {
    const st = await banco();
    checar(await pg.evaluate(() => itinGavetaAberta()) && st.itinerarios.some((x) => x.nome === 'Culto de sábado')
      && (await gaveta()).startsWith('Culto de sábado:1'),
      'P · RENOMEAR um guardado: o nome novo é gravado e a gaveta continua aberta', await gaveta());
  }
  // RENOMEAR COM UM NOME QUE JÁ EXISTE ganha " (2)".
  await naGaveta('Itinerário 09:00–10:40', 'renomear');
  await responder('Culto de sábado');
  await esperar(pg, () => itinEntradas().some((x) => x.nome === 'Culto de sábado (2)'));
  checar((await gaveta()).includes('Culto de sábado (2):4'), 'P · e um nome que colide ganha " (2)"', await gaveta());
  // EXCLUIR O ATIVO: pergunta, e cai no USADO MAIS RECENTEMENTE dos outros.
  await naGaveta('Itinerário 09:00–10:40 (2)', 'excluir');
  {
    const msg = await pg.evaluate(async () => {
      await new Promise((r) => setTimeout(r, 50));
      return document.getElementById('appDialogMsg').textContent;
    });
    await responder();
    await esperar(pg, () => itinEntradas().length === 2);
    const g = await gaveta();
    checar(/Excluir “Itinerário 09:00–10:40 \(2\)” e os 3 horários dele/.test(msg) && g === 'Culto de sábado:1 · Culto de sábado (2):4*',
      'P · EXCLUIR o ativo pergunta (nomeando-o) e cai no usado mais recentemente', { msg, g });
  }
  // EXCLUIR UM GUARDADO: o ativo não muda. E no ÚNICO o excluir é APAGADO.
  await naGaveta('Culto de sábado', 'excluir');
  await responder();
  await esperar(pg, () => itinEntradas().length === 1);
  {
    const u = await pg.evaluate(() => {
      const b = document.querySelector('#itinGavetaLista .crono-item .crono-excluir');
      return { g: itinEntradas().map((x) => x.nome).join(), off: b.disabled, title: b.title };
    });
    checar(u.g === 'Culto de sábado (2)' && u.off && /único/.test(u.title),
      'P · excluir um GUARDADO não toca o ativo, e no ÚNICO o excluir é APAGADO e diz por quê', u);
  }
  // NOVO: um vazio "Itinerário 2", já ativo — e o telão, no ar, sai (lista vazia).
  await pg.evaluate(() => document.getElementById('itinNovoItin').click());
  await esperar(pg, () => itin.nome === 'Itinerário 2');
  {
    const n = await pg.evaluate(() => ({ g: itinEntradas().map((x) => x.nome + ':' + x.qtd + (x.ativo ? '*' : '')).join(' · '),
      vazio: !!document.querySelector('#itinLista > .empty'), noAr: itinProjecting() }));
    checar(n.g === 'Culto de sábado (2):4 · Itinerário 2:0*' && n.vazio && !n.noAr,
      'P · NOVO cria um vazio ("Itinerário 2"), ativo; a lista do painel vem vazia e o telão sai (a projeção segue o ativo)', n);
  }
  // FORA DA GAVETA o toque a fecha: o véu (dentro da folha) e fora da folha.
  {
    await abrirGavetaItin();
    const ponto = await pg.evaluate(() => {
      const g = document.getElementById('itinGaveta').getBoundingClientRect();
      const f = document.getElementById('toolsSheet').getBoundingClientRect();
      return { x: Math.round(f.left + 30), y: Math.round(Math.min(f.bottom - 20, g.bottom + 30)) };
    });
    await pg.mouse.click(ponto.x, ponto.y);
    const r1 = await esperar(pg, () => !itinGavetaAberta());
    await abrirGavetaItin();
    await pg.mouse.click(20, 860 - 100);
    const r2 = await esperar(pg, () => !itinGavetaAberta());
    checar(r1 === true && r2 === true, 'P · o toque fora fecha a gaveta — no véu da folha e fora da folha', { r1: porque(r1), r2: porque(r2) });
  }
  // A RECARGA traz a lista e o ativo de volta do banco.
  await pg.evaluate(() => trocarItinerario(itinEntradas()[0].id));
  await esperar(pg, () => itin.nome === 'Culto de sábado (2)');
  await esperarDb(pg, async () => (await AVDB.getState('itinerario')).ativo === itin.id);
  await pg.reload();
  await pg.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function', null, { timeout: 30000 });
  await esperarCortina(pg);
  {
    const g = await pg.evaluate(() => itinEntradas().map((x) => x.nome + ':' + x.qtd + (x.ativo ? '*' : '')).join(' · '));
    checar(g === 'Culto de sábado (2):4* · Itinerário 2:0', 'P · depois de RECARREGAR, os itinerários e o ativo voltam do banco', g);
  }
  await pg.evaluate(() => {
    abrirFerramentas();
    [...document.querySelectorAll('.misc-tab')].find((b) => b.textContent.trim() === 'Tempo').click();
  });
  await esperar(pg, () => !!document.getElementById('itinLista'));
  await pg.evaluate(() => projectItin());
  await esperar(pg, () => itinProjecting());

  // ── I. ESVAZIAR NO AR TIRA DO TELÃO ──────────────────────────────────────
  await pg.evaluate(() => { [...itin.itens].forEach((x) => itinExcluir(x.id)); });
  await esperar(pg, () => document.getElementById('pvText').hidden || !itinProjecting());
  {
    const r = await pg.evaluate(() => ({
      noAr: itinProjecting(),
      btn: document.getElementById('miscProjectBtn') && document.getElementById('miscProjectBtn').disabled,
    }));
    checar(!r.noAr && r.btn, 'I · a lista que esvazia no ar sai do telão, e o projetar volta apagado', r);
    const dest = await pg.evaluate(() => [...document.querySelectorAll('#toolsFoot .cue-save-btn')]
      .map((b) => b.disabled && /Adicione/.test(b.title)));
    checar(dest.length === 2 && dest.every(Boolean),
      'I · e os dois destinos ficam APAGADOS (não somem), dizendo por quê', dest);
  }

  // ── Q. A MIGRAÇÃO DA v1 E A MESCLA DO PACOTE (v1.13.2) ───────────────────
  // A chave da v1 é UM itinerário: ele vira "Itinerário", com a lista inteira, e
  // nada é escrito até a primeira mudança.
  await pg.evaluate(() => AVDB.setState('itinerario', {
    v: 1, horas: false, desloc: 0, deslocDia: '',
    itens: [{ id: 'a', min: 600, titulo: 'Louvor' }, { id: 'b', min: 660, titulo: 'Sermão' }],
  }));
  await pg.reload();
  await pg.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function', null, { timeout: 30000 });
  await esperarCortina(pg);
  await pg.evaluate(() => {
    abrirFerramentas();
    [...document.querySelectorAll('.misc-tab')].find((b) => b.textContent.trim() === 'Tempo').click();
  });
  await esperar(pg, () => !!document.getElementById('itinLista'));
  {
    const m = await pg.evaluate(async () => ({
      titulo: document.getElementById('itinNome').textContent,
      g: itinEntradas().map((x) => x.nome + ':' + x.qtd + (x.ativo ? '*' : '')).join(' · '),
      lista: [...document.querySelectorAll('#itinLista .itin-li .row-name')].map((e) => e.textContent).join('|'),
      horas: itin.horas, cru: (await AVDB.getState('itinerario')).v,
    }));
    checar(m.titulo === 'Itinerário' && m.g === 'Itinerário:2*' && m.lista === 'Louvor|Sermão' && m.horas === false && m.cru === 1,
      'Q · a chave da v1 vira UM itinerário, "Itinerário", com a lista e o "só títulos" — sem escrever nada ao abrir', m);
  }
  await pg.evaluate(() => itinSetHoras(true));
  {
    const r = await esperarDb(pg, async () => (await AVDB.getState('itinerario')).v === 2);
    const st = await banco();
    const id = await pg.evaluate(() => itin.id);
    checar(r === true && st.ativo === id && st.itinerarios.length === 1 && st.itinerarios[0].nome === 'Itinerário'
      && st.itens.map((x) => x.id + x.titulo).join() === 'aLouvor,bSermão',
      'Q · e a primeira mudança grava a forma nova: o mesmo itinerário, com os mesmos ids de horário', st);
  }
  {
    const q = await pg.evaluate(() => {
      const h = (id, min, titulo) => ({ id, min, titulo });
      const local = { v: 2, ativo: 'L1', horas: true, desloc: 3, deslocDia: hojeLocal(),
        itens: [h('x', 600, 'Louvor')],
        itinerarios: [{ id: 'L1', nome: 'Culto', itens: [], horas: true }, { id: 'L2', nome: 'Ensaio', itens: [h('y', 1140, 'Coral')], horas: true }] };
      const vindo = { v: 2, ativo: 'V1', horas: true, desloc: 40, deslocDia: hojeLocal(),
        itens: [h('v', 480, 'Café')],
        itinerarios: [{ id: 'V1', nome: 'Culto', itens: [], horas: true }, { id: 'L2', nome: 'Outro nome', itens: [h('y', 1140, 'Coral'), h('z', 1200, 'Oração')], horas: true }] };
      const m = itinMesclarPacote(local, vindo);
      const ler = (st) => itinLerEstado(st, 'p').lista.map((x) => x.nome + '=' + x.itens.map((i) => i.titulo).join('+')).join(' · ');
      const de2 = itinMesclarPacote(m, vindo);
      const v1 = { v: 1, horas: true, itens: [h('q', 480, 'Café')] };
      const virgem = itinMesclarPacote(undefined, vindo);
      return {
        mesclado: ler(m), ativo: m.ativo, desloc: m.desloc,
        deNovo: de2 === m,
        v1: itinMesclarPacote(m, v1) === m,
        virgem: ler(virgem), virgemAtivo: virgem.ativo, virgemDesloc: virgem.desloc,
      };
    });
    checar(q.mesclado === 'Culto=Louvor · Ensaio=Coral+Oração · Culto (2)=Café' && q.ativo === 'L1' && q.desloc === 3,
      'Q · o pacote SÓ ACRESCENTA: o mesmo id une os horários (o nome daqui fica), o ativo de lá entra GUARDADO '
      + '(com " (2)"), o ativo daqui não muda e o ajuste do dia não viaja', q);
    checar(q.deNovo && q.v1, 'Q · e importar de novo não muda nada — nem o pacote da v1 (sem id) de conteúdo igual', q);
    checar(q.virgem === 'Culto=Café · Outro nome=Coral+Oração' && q.virgemAtivo === 'V1' && q.virgemDesloc === 0,
      'Q · num aparelho VIRGEM a lista de lá entra inteira, com o ativo de lá', q);
  }

  checar(erros.length === 0, 'nenhum erro de console', erros);
} catch (e) {
  checar(false, 'o oráculo rodou até o fim', e && e.stack || String(e));
} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) { console.log('\n' + falhas.length + ' falha(s).'); process.exit(1); }
console.log('\nTodos passaram.');
