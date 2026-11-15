// ============================================================================
// O ITINERÁRIO É UMA OPÇÃO DO CRONOGRAMA (v1.14.32) — a programação do evento
// mora NA LISTA, e o telão a segue pelo relógio.
//
// Pedido do operador: *"agregar o itinerário ao cronograma, como uma opção do
// cronograma … os títulos do itinerário vão ficar na mesma lista, com uma
// formatação diferente … por estar listado no cronograma, se consegue arrastar a
// ordem das mídias … as mídias não vão tocar automaticamente com o tempo do
// itinerário"* — e, sobre as opções: *"uma segunda linha mais estreita logo abaixo
// da linha de topo do cronograma. Pode ser uma linha ocultável"*.
//
// ## O MODELO (o que este oráculo trava)
//
//  · MOMENTO = registro de cena de roteiro `{ kind:'cue', cue:'momento', name:<título>,
//    data:{ min } }` em `imports` (a lista do cronograma ATIVO), como qualquer item:
//    linha `li.lib-item.momento` SEM capa, com `.momento-hora`, `.row-name` e
//    `.row-sub` ('Agora' / 'A seguir' / 'previsto HH:MM' / duração / 'Último momento').
//    Tocar edita (folha `#itinPopup`); segurar ARRASTA; o `⋮` tem excluir (a pergunta
//    NA LINHA) e editar — não há par ↑↓.
//  · A ORDEM: a posição da linha é do OPERADOR (organiza as mídias); o TELÃO é
//    ordenado pelo RELÓGIO (`ordenarItin`). Momento novo entra antes do primeiro
//    momento posterior no relógio, senão no fim da lista; lista sem momento: no TOPO.
//  · A FAIXA `#itinBar` (irmã da barra do topo, dentro do `<main>`): Telão · Horários
//    × só títulos · −5 −1 [ajuste] +1 +5 · Novo · Recolher; recolhida, um botão só
//    (`#itinBarAbrir`). A escolha de recolher persiste em `state.itinerario.barraOculta`.
//  · O ESTADO `state.itinerario` = `{ v:3, horas, desloc, deslocDia, barraOculta }` e
//    só isso (a lista saiu dela); o ajuste é do dia e é GLOBAL.
//  · O ITINERÁRIO NÃO TOCA MÍDIA: o relógio cruzando um horário muda a marca de
//    "agora" na lista e no telão, e mais nada.
//
// ## O que falha calado aqui, e por isso cada bloco existe
//
//  MANTIDOS (a montagem trocou o painel de Ferramentas pela faixa e pelas linhas):
//  A. A LEITURA PURA (`createStage.itinerarioLeitura`): antes do primeiro, ninguém;
//     depois do último, o último; fora de ordem, ordenado; o FUSO é o do celular.
//  C. A TROCA QUANDO O RELÓGIO CRUZA o horário — na preview e na lista, sem comando
//     nenhum trafegando —, e ANIMADA.
//  D. O AJUSTE, pela faixa: ±1/±5 deslocam os horários JUNTOS (os intervalos ficam),
//     o de agora acompanha, tocar no atraso o ZERA; gravado PELO DIA.
//  E. Horários × só os títulos (`#itinHorasBtn`).
//  F. O TELÃO: a mesma lista pelo DESCRITOR, e o REENVIO na reconexão.
//  G. Antes do primeiro e depois do último, no telão.
//  H. `prefers-reduced-motion`: nada se move.
//  I. Lista sem momentos: o "Telão" é APAGADO e diz por quê; esvaziar no ar tira do telão.
//  J. Com o itinerário no ar o ⏮/⏭ é o AJUSTE de 5 em 5 min, com apagado nos extremos.
//  L. A FOLHA de um momento: roletas de hora e minuto, nenhum `<input type="time">`.
//  M. O DESENHO NO TELÃO: wallpaper à vista, bloco escuro centrado, a marca "Agora"
//     à esquerda do horário — medido por pixel sobre um wallpaper branco.
//  N. O TECLADO da folha não mexe na barra de busca da Biblioteca.
//
//  NOVOS (v1.14.32):
//  B′. MOMENTOS NA LISTA, PELA UI REAL: três (e mais um) criados FORA da ordem do
//     relógio pela folha; a lista sai pelo relógio; sem `.thumb`; hora e título à vista;
//     o registro é cue `momento` em `imports`; editar por TOQUE na linha; excluir pela
//     faixa do `⋮` com a pergunta na linha; persistência por RECARGA.
//  D′. ARRASTO REAL DE UMA MÍDIA para entre dois momentos: a ordem do banco muda, a do
//     telão (descritor) NÃO, e nada toca sozinho quando o relógio cruza um horário.
//  S. A MIGRAÇÃO do itinerário da v1.13: os itens do ATIVO viram momentos no TOPO, em
//     ordem de relógio, com `data.legado`; a chave vira `{ v:3 }` sem `itens`,
//     `itinerarios`, `ativo`; os GUARDADOS são descartados; repetir não duplica.
//  T. A CENA ANTIGA `itinerario`: tocá-la ACRESCENTA os horários como momentos (sem
//     apagar nada, sem duplicar o que já existe, e tocar de novo não duplica).
//  U. A FAIXA RECOLHÍVEL: recolher, recarregar, persistir, abrir; mais baixa que a barra
//     do topo; em 320, 360 e 430 nenhum botão passa da borda direita da faixa.
//  V. SEM FERRAMENTA: `FERRAMENTAS` sem `itinerario`, nenhum id/global removido, e a
//     folha de Ferramentas só tem os seis tiles.
//  W. CRONOGRAMA MÚLTIPLO: cada cronograma tem os SEUS momentos, e com o itinerário no
//     ar o telão acompanha a troca.
//
//  SAÍRAM com a ferramenta (o app os removeu): o painel de Ferramentas e a vista do Tempo
//  (B antigo), guardar a programação a partir da ferramenta (K), o par ↑↓ (O), os
//  itinerários múltiplos e a gaveta (P), a migração da v1 e a mescla do `.avpkg` (Q).
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

const inicio = Date.now();
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
  const aguardarApp = () => pg.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function', null, { timeout: 30000 });
  await pg.goto(base + '/controle/');
  await aguardarApp();
  await esperarCortina(pg);
  const recarregar = async () => { await pg.reload(); await aguardarApp(); await esperarCortina(pg); };

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

  // ── V. O ITINERÁRIO NÃO É MAIS UMA FERRAMENTA ────────────────────────────
  // Ele virou uma opção do Cronograma: a folha de Ferramentas voltou a ter SEIS
  // tiles, e o que só existia para a ferramenta (o painel, a gaveta de itinerários,
  // as funções de lista e de mescla do pacote) saiu junto.
  await pg.evaluate(() => {
    if (!ferramentasAbertas()) abrirFerramentas();
    if (!document.getElementById('ferrGrade')) voltarAGradeDeFerramentas();
  });
  await esperar(pg, () => !!document.getElementById('ferrGrade'));
  {
    const v = await pg.evaluate(() => ({
      ids: FERRAMENTAS.map((f) => f.id),
      tiles: [...document.querySelectorAll('#ferrGrade .ferr-tile')].map((b) => b.dataset.ferr),
      filhos: document.getElementById('ferrGrade').children.length,
      noDom: ['ferrTile_itinerario', 'itinTitulo', 'itinNome', 'itinGaveta', 'itinVeu', 'itinLista', 'itinNovoItin']
        .filter((id) => document.getElementById(id)),
      globais: {
        tempoVista: typeof tempoVista, renderItinerario: typeof renderItinerario, itinMover: typeof itinMover,
        itinEntradas: typeof itinEntradas, itinLista: typeof itinLista, itinMesclarPacote: typeof itinMesclarPacote,
        itinCueData: typeof itinCueData,
      },
    }));
    checar(!v.ids.includes('itinerario') && v.ids.join() === 'clock,stopwatch,timer,msg,draw,edicao',
      'V · `FERRAMENTAS` não tem o `itinerario`: restam clock, stopwatch, timer, msg, draw, edicao', v.ids);
    checar(v.noDom.length === 0,
      'V · nenhum dos ids removidos existe no DOM (`ferrTile_itinerario`, `itinTitulo`, `itinNome`, `itinGaveta`, `itinVeu`, `itinLista`)', v.noDom);
    checar(Object.values(v.globais).every((t) => t === 'undefined'),
      'V · e as funções que só serviam à ferramenta sumiram (`tempoVista`, `renderItinerario`, `itinMover`, `itinEntradas`, '
      + '`itinLista`, `itinMesclarPacote`, `itinCueData`)', v.globais);
    checar(v.tiles.join() === 'clock,stopwatch,timer,msg,draw,edicao' && v.filhos === 6,
      'V · ao abrir as Ferramentas só há os 6 tiles: clock, stopwatch, timer, msg, draw, edicao', v);
  }
  await pg.evaluate(() => fecharFerramentas());
  // A FOLHA DESCE ANIMADA, e só some no fim.
  await esperar(pg, () => toolsSheetEl.hidden);

  // ── I. LISTA SEM MOMENTOS: o "Telão" da faixa é APAGADO e diz por quê ─────
  {
    const e = await pg.evaluate(() => {
      const tel = document.getElementById('itinTelaoBtn');
      return {
        off: !!tel && tel.disabled, titulo: tel && tel.title, pressed: tel && tel.getAttribute('aria-pressed'),
        momentos: document.querySelectorAll('#library > li.momento').length, itens: itinItens().length,
      };
    });
    checar(e.off && /adicione/i.test(e.titulo || '') && e.pressed === 'false' && e.momentos === 0 && e.itens === 0,
      'I · lista SEM momentos: o "Telão" da faixa é APAGADO e diz por quê (o `title` manda adicionar um momento)', e);
  }

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
  // O confirmar é ASSÍNCRONO (grava, relê a lista e SÓ ENTÃO fecha): folha fechada
  // quer dizer lista já redesenhada.
  const fechada = () => esperar(pg, () => !document.getElementById('itinPopup').classList.contains('open'));
  const adicionar = async (hora, titulo) => {
    await pg.click('#itinNovoBtn');
    await abrirFolha();
    await escolherHora(hora);
    await pg.fill('#itinCampoTitulo', titulo);
    await pg.click('#itinEditorOk');
    await fechada();
  };
  // A LISTA DO CRONOGRAMA, só os momentos, na ordem em que a tela os desenha.
  const lista = () => pg.evaluate(() => [...document.querySelectorAll('#library > li.momento')]
    .map((li) => li.querySelector('.momento-hora').textContent + ' ' + li.querySelector('.row-name').textContent));
  const banco = () => pg.evaluate(() => AVDB.getState('itinerario'));
  const idDe = (titulo) => pg.evaluate((t) => {
    const li = [...document.querySelectorAll('#library > li.momento')].find((x) => x.querySelector('.row-name').textContent === t);
    return li ? li.dataset.id : null;
  }, titulo);

  // ── L. A FOLHA DE UM MOMENTO: roletas, nenhum campo do sistema ───────────
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
        titulo: document.getElementById('itinPopupTitulo').textContent,
        rotulo: ok.querySelector('.song-menu-label').textContent,
        // A SUGESTÃO para uma lista vazia: o próximo múltiplo de cinco depois
        // de agora (09:58 → 10:00).
        valor: roletaValorDe(rh) * 60 + roletaValorDe(document.getElementById('itinRoleta_min')),
      };
    });
    checar(f.times === 0 && f.roletas === 2 && f.rola === 0 && f.item >= 22,
      'L · o horário se escolhe em DUAS roletas (hora e minuto), sem `<input type="time">` em lugar nenhum', f);
    checar(f.titulo === 'Novo momento' && f.rotulo === 'Adicionar ao cronograma',
      'L · a folha nova diz "Novo momento" e o confirmar "Adicionar ao cronograma"', f);
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
  checar((await lista()).length === 0, 'L · fechar a folha sem confirmar NÃO cria momento nenhum', await lista());

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

  // ── B′. MOMENTOS NA LISTA DO CRONOGRAMA, PELA UI REAL ────────────────────
  // O "10:00 Louvor" entrou pelo bloco N, com a lista SEM momento nenhum (vai ao
  // TOPO). Os demais entram fora da ordem do relógio, e a posição de cada um
  // (antes do primeiro posterior no relógio; senão no fim) é o que ordena a lista.
  checar((await lista()).join(' · ') === '10:00 Louvor',
    'B′ · o primeiro momento (criado pela folha, no bloco N) é uma LINHA do Cronograma', await lista());
  await adicionar('09:00', 'Recepção');
  await adicionar('10:30', 'Sermão');
  await adicionar('11:00', 'Bênção');
  checar((await lista()).join(' · ') === '09:00 Recepção · 10:00 Louvor · 10:30 Sermão · 11:00 Bênção',
    'B′ · criados FORA da ordem do relógio (10:00, 09:00, 10:30, 11:00), cada um entra antes do primeiro posterior '
    + 'no relógio — a lista do cronograma sai pelo relógio', await lista());
  {
    const anat = await pg.evaluate(() => {
      const li = document.querySelector('#library > li.momento');
      const vis = (el) => {
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0;
      };
      const hora = li.querySelector('.row > .momento-hora'), nome = li.querySelector('.row-text > .row-name');
      const sub = li.querySelector('.row-text > .row-sub');
      const linha = li.getBoundingClientRect();
      const dentro = (el) => { const r = el.getBoundingClientRect(); return r.left >= linha.left - 0.5 && r.right <= linha.right + 0.5; };
      return {
        lib: li.classList.contains('lib-item'),
        semCapa: !li.querySelector('.thumb'), capasNaLista: document.querySelectorAll('#library > li.momento .thumb').length,
        hora: hora && hora.textContent, horaVisivel: !!hora && vis(hora) && dentro(hora),
        nome: nome && nome.textContent, nomeVisivel: !!nome && vis(nome) && dentro(nome),
        sub: sub ? sub.textContent : null,
        mais: !!li.querySelector('.row > .row-mais'),
        acoes: [...li.querySelectorAll('.row-acoes > button')].map((b) => b.className),
        ordem: li.querySelectorAll('.row-ordem').length,
        novoFora: !document.getElementById('itinNovoBtn').closest('#library'),
        aoLado: li.parentElement.id === 'library',
      };
    });
    checar(anat.lib && anat.aoLado && anat.semCapa && anat.capasNaLista === 0,
      'B′ · a linha do momento é um item da MESMA lista (`#library > li.lib-item.momento`) e SEM capa (`.thumb`)', anat);
    checar(anat.hora === '09:00' && anat.horaVisivel && anat.nome === 'Recepção' && anat.nomeVisivel && !!anat.sub,
      'B′ · a hora (`.momento-hora`) e o título (`.row-name`) estão à vista, dentro da linha, com um subtítulo', anat);
    checar(anat.mais && anat.acoes.length === 2 && /row-excluir/.test(anat.acoes[0]) && /itin-editar/.test(anat.acoes[1])
      && anat.ordem === 0 && anat.novoFora,
      'B′ · o `⋮` da linha tem excluir · editar (e NENHUM par ↑↓); "Novo momento" mora na faixa, fora da lista', anat);
  }
  {
    const regs = await pg.evaluate(async () => (await AVDB.listItems('imports'))
      .map((r) => [r.kind, r.cue, r.name, r.data && r.data.min, ehMomento(r)].join(':')));
    checar(regs.join('|') === 'cue:momento:Recepção:540:true|cue:momento:Louvor:600:true|cue:momento:Sermão:630:true|cue:momento:Bênção:660:true',
      'B′ · cada momento é um registro `{ kind:"cue", cue:"momento", name, data:{ min } }` em `imports`, na ordem da lista', regs);
  }

  // EDITAR: tocar na linha abre a MESMA folha, com o horário e o título dela.
  const idSermao = await idDe('Sermão');
  await pg.click('#library > li.momento[data-id="' + idSermao + '"] .row-name');
  await abrirFolha();
  {
    const e = await pg.evaluate(() => ({
      titulo: document.getElementById('itinPopupTitulo').textContent,
      rotulo: document.querySelector('#itinEditorOk .song-menu-label').textContent,
      campo: document.getElementById('itinCampoTitulo').value,
      valor: roletaValorDe(document.getElementById('itinRoleta_hora')) * 60
        + roletaValorDe(document.getElementById('itinRoleta_min')),
    }));
    checar(e.titulo === 'Editar momento' && e.rotulo === 'Salvar' && e.campo === 'Sermão' && e.valor === 630,
      'B′ · tocar na linha abre a folha de EDIÇÃO ("Editar momento" / "Salvar") com o horário e o título dela', e);
  }
  await escolherHora('10:40');
  await pg.fill('#itinCampoTitulo', 'Pregação');
  await pg.click('#itinEditorOk');
  await fechada();
  {
    const l = await lista();
    const r = await pg.evaluate(async (id) => {
      const rec = (await AVDB.listItems('imports')).find((x) => x.id === id);
      return rec && { name: rec.name, min: rec.data.min, cue: rec.cue };
    }, idSermao);
    checar(l.includes('10:40 Pregação') && !l.some((x) => /Sermão/.test(x)) && (await idDe('Pregação')) === idSermao
      && r && r.name === 'Pregação' && r.min === 640 && r.cue === 'momento',
      'B′ · editar por toque troca HORÁRIO e TÍTULO do MESMO registro (mesmo id, nome e `data.min` novos)', { l, r });
  }
  // EXCLUIR pela faixa do `⋮`: a pergunta é NA LINHA, sem diálogo.
  await pg.evaluate(() => [...document.querySelectorAll('#library > li.momento')]
    .find((li) => /Bênção/.test(li.textContent)).querySelector('.row-mais').click());
  await pg.evaluate(() => [...document.querySelectorAll('#library > li.momento')]
    .find((li) => /Bênção/.test(li.textContent)).querySelector('.row-excluir').click());
  {
    const r = await esperar(pg, () => !!document.querySelector('#library .linha-sim'));
    checar(r === true && (await pg.evaluate(() => document.getElementById('appDialog').classList.contains('open'))) === false,
      'B′ · excluir pergunta NA LINHA (`.linha-sim`), sem diálogo', porque(r));
  }
  await pg.click('#library .linha-sim');
  await esperar(pg, () => ![...document.querySelectorAll('#library > li.momento')].some((b) => /Bênção/.test(b.textContent)));
  checar((await lista()).join(' · ') === '09:00 Recepção · 10:00 Louvor · 10:40 Pregação',
    'B′ · e o "Excluir" tira a linha', await lista());
  {
    const regs = await pg.evaluate(async () => (await AVDB.listItems('imports')).filter(ehMomento).map((r) => r.name + ':' + r.data.min));
    checar(regs.join('|') === 'Recepção:540|Louvor:600|Pregação:640',
      'B′ · e o banco acompanha a edição e a exclusão (3 registros `momento`)', regs);
  }

  // ── U. A FAIXA DE OPÇÕES: anatomia, recolher, persistir, abrir ───────────
  const faixa = () => pg.evaluate(() => {
    const b = document.getElementById('itinBar');
    const topo = b.previousElementSibling;
    const nome = (e) => e.id || (e.classList.contains('itin-passo') ? 'passo' + e.textContent.trim() : e.className);
    const abrir = document.getElementById('itinBarAbrir');
    const fechar = document.getElementById('itinBarFechar');
    return {
      recolhida: b.classList.contains('recolhida'),
      filhos: [...b.children].map(nome),
      h: Math.round(b.getBoundingClientRect().height * 10) / 10,
      hTopo: topo ? Math.round(topo.getBoundingClientRect().height * 10) / 10 : -1,
      irmaDoTopo: !!topo && topo.classList.contains('list-header'),
      corpo: !!b.nextElementSibling && b.nextElementSibling.contains(document.getElementById('library')),
      pai: b.parentElement && b.parentElement.tagName,
      ponto: !!b.querySelector('.itin-ponto'),
      expandidoAbrir: abrir && abrir.getAttribute('aria-expanded'),
      expandidoFechar: fechar && fechar.getAttribute('aria-expanded'),
      telao: (() => { const t = document.getElementById('itinTelaoBtn'); return t && [t.getAttribute('aria-pressed'), t.disabled]; })(),
      horas: (() => { const t = document.getElementById('itinHorasBtn'); return t && t.getAttribute('aria-pressed'); })(),
      ajuste: (() => { const t = document.getElementById('itinAjusteTxt'); return t && [t.disabled, t.classList.contains('deslocado')]; })(),
    };
  });
  {
    const f = await faixa();
    checar(f.pai === 'MAIN' && f.irmaDoTopo && f.corpo && !f.recolhida,
      'U · a faixa é IRMÃ da barra do topo (`.list-header`), dentro do `<main>`, antes do corpo da lista — e começa aberta', f);
    checar(f.filhos.join(' ') === 'itinTelaoBtn itinHorasBtn passo−5 passo−1 itinAjusteTxt passo+1 passo+5 itinNovoBtn itinBarFechar',
      'U · os botões, na ordem: Telão · Horários · −5 −1 · ajuste · +1 +5 · Novo · Recolher (os "−" são U+2212)', f.filhos);
    checar(f.telao[0] === 'false' && f.telao[1] === false && f.horas === 'true' && f.ajuste[0] === true && f.ajuste[1] === false
      && f.expandidoFechar === 'true',
      'U · estado inicial: telão apagado→aceso (com momentos), horários ligados, atraso apagado e sem `deslocado`', f);
  }
  await pg.click('#itinBarFechar');
  {
    const r = await esperarDb(pg, async () => ((await AVDB.getState('itinerario')) || {}).barraOculta === true);
    const f = await faixa();
    const b = await banco();
    checar(f.recolhida && f.filhos.join() === 'itinBarAbrir' && f.expandidoAbrir === 'false' && !f.ponto,
      'U · RECOLHER deixa UM botão só (`#itinBarAbrir`, `aria-expanded="false"`), sem o ponto (o itinerário não está no ar)', f);
    checar(r === true && b.barraOculta === true && b.v === 3,
      'U · e a escolha de recolher é gravada em `state.itinerario.barraOculta`', b || porque(r));
    checar(f.h < f.hTopo && f.h > 0,
      'U · recolhida, a faixa é MAIS BAIXA que a barra do topo (`.list-header`)', { faixa: f.h, topo: f.hTopo });
  }
  // A RECARGA: a escolha de recolher volta do banco, junto com a lista de momentos.
  await recarregar();
  {
    const f = await faixa();
    checar(f.recolhida && f.filhos.join() === 'itinBarAbrir',
      'U · depois de RECARREGAR a faixa continua RECOLHIDA (a escolha é do aparelho, guardada)', f);
    checar((await lista()).join(' · ') === '09:00 Recepção · 10:00 Louvor · 10:40 Pregação',
      'B′ · depois de RECARREGAR, os momentos voltam do banco, na mesma ordem', await lista());
  }
  await pg.click('#itinBarAbrir');
  {
    const r = await esperarDb(pg, async () => ((await AVDB.getState('itinerario')) || {}).barraOculta === false);
    const f = await faixa();
    checar(r === true && !f.recolhida && f.filhos.length === 9 && f.expandidoFechar === 'true',
      'U · o botão de abrir devolve a faixa inteira (9 botões) e grava `barraOculta: false`', { f, r: porque(r) });
    checar(f.h < f.hTopo && f.h > 0, 'U · aberta, a faixa continua MAIS BAIXA que a barra do topo', { faixa: f.h, topo: f.hTopo });
  }
  // NENHUM BOTÃO PASSA DA BORDA: em 320, 360 e 430 de largura, com o atraso mais
  // largo escrito ("Atrasado 45 min"). A escrita (longa ou curta) é escolhida pela
  // consulta de contêiner do CSS: uma das duas, nunca as duas nem nenhuma.
  await pg.evaluate(() => itinAjustar(45));
  await esperar(pg, () => document.getElementById('itinAjusteTxt').classList.contains('deslocado'));
  for (const w of [320, 360, 430]) {
    await pg.setViewportSize({ width: w, height: 800 });
    await esperar(pg, (x) => innerWidth === x, w);
    await pg.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const g = await pg.evaluate(() => {
      const b = document.getElementById('itinBar');
      const rb = b.getBoundingClientRect();
      const padD = parseFloat(getComputedStyle(b).paddingRight) || 0;
      const bts = [...b.querySelectorAll('.itin-b')].map((e) => {
        const r = e.getBoundingClientRect();
        return { id: e.id || e.textContent.trim(), esq: Math.round(r.left * 10) / 10, dir: Math.round(r.right * 10) / 10, larg: r.width };
      });
      const exibe = (sel) => getComputedStyle(b.querySelector(sel)).display !== 'none';
      return {
        w: innerWidth, n: bts.length, faixaDir: Math.round(rb.right * 10) / 10, rolagem: b.scrollWidth - b.clientWidth,
        passaram: bts.filter((x) => x.dir > rb.right + 0.5 || x.esq < rb.left - 0.5).map((x) => x.id + '→' + x.dir),
        noRecuo: bts.filter((x) => x.dir > rb.right - padD + 0.5).map((x) => x.id + '→' + x.dir),
        semLargura: bts.filter((x) => x.larg < 1).map((x) => x.id),
        longo: exibe('.itin-txt-longo'), curto: exibe('.itin-txt-curto'),
        telaoTxt: exibe('.itin-telao-txt'),
        h: Math.round(rb.height * 10) / 10, hTopo: Math.round(b.previousElementSibling.getBoundingClientRect().height * 10) / 10,
      };
    });
    checar(g.n === 9 && g.passaram.length === 0 && g.semLargura.length === 0 && g.rolagem <= 1,
      'U · em ' + w + 'px de largura NENHUM botão da faixa passa da borda da faixa (e a faixa não rola)', g);
    checar(g.noRecuo.length === 0,
      'U · e em ' + w + 'px nenhum botão invade o recuo da direita (o `padding` da faixa)', g);
    checar(g.longo !== g.curto, 'U · em ' + w + 'px o atraso aparece em UMA escrita só (longa ou curta)', g);
    checar(g.h < g.hTopo, 'U · em ' + w + 'px a faixa é mais baixa que a barra do topo', g);
  }
  await pg.setViewportSize({ width: 360, height: 800 });
  await esperar(pg, () => innerWidth === 360);
  await pg.evaluate(() => itinAjusteZerar());

  // ── D′. ARRASTAR UMA MÍDIA PARA ENTRE DOIS MOMENTOS ─────────────────────
  // A lista é do operador: ele a organiza segurando e arrastando (a mesma máquina
  // do `cronograma-pronto`, B1/B2). O TELÃO continua ordenado pelo RELÓGIO, e
  // NADA toca sozinho quando um horário passa: o itinerário só marca a lista.
  await ctx.clock.setSystemTime(T('09:58'));
  const midias = await pg.evaluate(async () => {
    const a = await AVDB.addCue('message', { text: 'Bom dia' }, { name: 'Aviso 1', list: 'imports' });
    const b = await AVDB.addCue('message', { text: 'Desliguem os celulares' }, { name: 'Aviso 2', list: 'imports' });
    await load();
    return { a: a.id, b: b.id };
  });
  const nomesDoBanco = () => pg.evaluate(async () => (await AVDB.listItems('imports')).map((r) => r.name));
  const nomesNaTela = () => pg.evaluate(() => [...document.querySelectorAll('#library > li.lib-item')]
    .map((li) => li.querySelector('.row-name').textContent));
  const ordemDoTelao = () => pg.evaluate(() => ({
    descritor: itinDescriptor().itens.map((x) => x.titulo).join(),
    leitura: itinItens().map((x) => x.titulo).join(),
  }));
  checar((await nomesDoBanco()).join() === 'Recepção,Louvor,Pregação,Aviso 1,Aviso 2' && (await nomesNaTela()).join() === (await nomesDoBanco()).join(),
    'D′ · ponto de partida: três momentos e duas mídias (`message`), a tela igual ao banco', await nomesDoBanco());
  {
    const geo = await pg.evaluate((id) => {
      const lis = [...document.querySelectorAll('#library > li.lib-item')];
      const r = (el) => el.getBoundingClientRect();
      const li = lis.find((x) => x.dataset.id === id);
      const rl = r(li);
      return {
        x: Math.round(rl.left + rl.width / 2), y: Math.round(rl.top + rl.height / 2),
        // O PONTO ENTRE A 1ª E A 2ª LINHA (os momentos são mais baixos que as mídias:
        // a conta sai das caixas reais, não de uma altura única).
        alvo: Math.round((r(lis[0]).bottom + r(lis[1]).top) / 2),
      };
    }, midias.b);
    await pg.mouse.move(geo.x, geo.y);
    await pg.mouse.down();
    const levantou = await esperar(pg, () => !!document.querySelector('#library > .lib-item.arrastando'), null, 4000);
    checar(levantou === true, 'D′ · segurar a MÍDIA a levanta (estado de arrasto, não modo de seleção)', porque(levantou));
    await pg.mouse.move(geo.x, geo.alvo, { steps: 12 });
    await pg.mouse.up();
  }
  {
    const esperado = ['Recepção', 'Aviso 2', 'Louvor', 'Pregação', 'Aviso 1'];
    const r = await esperarDb(pg, async (e) => (await AVDB.listItems('imports')).map((x) => x.name).join() === e.join(), esperado, 8000);
    const solto = await esperar(pg, () => !document.getElementById('library').classList.contains('arrastando-lista')
      && !document.querySelector('#library .arrastando'), null, 5000);
    checar(r === true, 'D′ · soltar GRAVA a ordem: a mídia foi para ENTRE "Recepção" e "Louvor", no banco', await nomesDoBanco());
    checar(solto === true && (await nomesNaTela()).join() === esperado.join(),
      'D′ · e a tela mostra a ordem nova, sem rastro do gesto (sem `.arrastando` nem `arrastando-lista`)', { r: porque(solto), tela: await nomesNaTela() });
    const o = await ordemDoTelao();
    checar(o.descritor === 'Recepção,Louvor,Pregação' && o.leitura === o.descritor,
      'D′ · a ordem do TELÃO (o descritor) NÃO mudou: segue o relógio, e a mídia no meio da lista não entra nele', o);
  }
  // E A POSIÇÃO DE UM MOMENTO NÃO ORDENA O TELÃO: o último do relógio vai ao topo da lista.
  {
    const idPre = await idDe('Pregação');
    await pg.evaluate((id) => moverNaListaPara('imports', id, 0), idPre);
    await esperar(pg, () => document.querySelector('#library > li.lib-item .row-name').textContent === 'Pregação');
    const o = await ordemDoTelao();
    checar(o.descritor === 'Recepção,Louvor,Pregação' && (await lista())[0] === '10:40 Pregação',
      'D′ · um MOMENTO arrastado ao topo da lista muda a lista, e o telão continua pelo relógio (Recepção, Louvor, Pregação)',
      { o, lista: await lista() });
    await pg.evaluate((id) => moverNaListaPara('imports', id, 3), idPre);
    await esperar(pg, () => document.querySelector('#library > li.lib-item .row-name').textContent === 'Recepção');
  }
  // NADA TOCA SOZINHO quando o relógio cruza um horário.
  await pg.evaluate(() => {
    window.__cmds = [];
    const orig = AVDB.sendCommand;
    AVDB.sendCommand = function (c) { window.__cmds.push(c); return orig.apply(this, arguments); };
  });
  await ctx.clock.pauseAt(T('09:59', 57));
  await ctx.clock.runFor(5000);   // cruza 10:00:00 com o laço de um segundo
  {
    const c = await pg.evaluate(() => ({
      hora: new Date().getHours() * 60 + new Date().getMinutes(),
      noAr: itinProjecting(), linhasNoAr: document.querySelectorAll('#library .lib-item.no-ar').length,
      cmds: window.__cmds.map((x) => x.type), tocando: typeof midiaNoAr === 'function' ? !!midiaNoAr() : null,
      agora: [...document.querySelectorAll('#library > li.momento.agora .row-name')].map((e) => e.textContent).join(),
      marcaNaMidia: document.querySelectorAll('#library > li:not(.momento).agora, #library > li:not(.momento).seguir').length,
    }));
    checar(c.hora >= 600, 'D′ · o relógio CRUZOU as 10:00 (a prova de que o horário passou)', c);
    checar(c.agora === 'Louvor' && c.marcaNaMidia === 0,
      'D′ · a LISTA acompanhou o relógio: "Louvor" passou a ser o de agora (e nenhuma mídia ganhou a marca)', c);
    checar(!c.noAr && c.linhasNoAr === 0 && c.cmds.length === 0 && c.tocando !== true,
      'D′ · e NADA tocou: `itinProjecting()` falso, nenhuma linha NO AR, nenhum comando no barramento', c);
  }
  await ctx.clock.resume();

  // ── C. PROJETAR, E A TROCA QUANDO O RELÓGIO CRUZA ────────────────────────
  // Volta ao começo da manhã (o D′ cruzou as 10:00): a troca sob teste é a do bloco.
  await ctx.clock.setSystemTime(T('09:58'));
  await pg.evaluate(() => { window.__cmds.length = 0; });
  await esperar(pg, () => { const a = document.querySelector('#library > li.momento.agora .row-name'); return !!a && a.textContent === 'Recepção'; });
  await pg.click('#itinTelaoBtn');
  await esperar(pg, () => !!document.querySelector('#pvTextItin .itin-linha'));
  const pv = () => pg.evaluate(() => ({
    linhas: [...document.querySelectorAll('#pvTextItin .itin-linha:not(.itin-saindo)')].map((l) =>
      (l.classList.contains('agora') ? '*' : '') + l.querySelector('.itin-hora').textContent + ' '
      + l.querySelector('.itin-titulo').textContent),
    lista: [...document.querySelectorAll('#library > li.momento.agora .row-name')].map((e) => e.textContent),
    subs: [...document.querySelectorAll('#library > li.momento .row-sub')].map((e) => e.textContent),
    anima: [...document.querySelectorAll('#pvTextItin .itin-linha')]
      .reduce((n, l) => n + l.getAnimations().filter((a) => a.playState === 'running').length, 0),
    semHoras: document.getElementById('pvTextItin').classList.contains('sem-horas'),
    horaVisivel: (() => { const h = document.querySelector('#pvTextItin .itin-hora'); return h ? getComputedStyle(h).display : null; })(),
  }));
  const cmdItin = await pg.evaluate(() => window.__cmds.filter((c) => c.type === 'text' && c.mode === 'itinerario'));
  checar(cmdItin.length === 1 && Array.isArray(cmdItin[0].itinerario.itens) && cmdItin[0].itinerario.itens.length === 3
    && Number.isFinite(cmdItin[0].itinerario.fuso)
    && cmdItin[0].itinerario.itens.map((x) => x.titulo).join() === 'Recepção,Louvor,Pregação',
    'C · o Telão da faixa manda UM descritor (a lista pelo RELÓGIO, o ajuste, o fuso) — não o estado calculado', cmdItin);
  {
    const tel = await pg.evaluate(() => { const t = document.getElementById('itinTelaoBtn'); return [t.getAttribute('aria-pressed'), t.classList.contains('active'), itinProjecting()]; });
    checar(tel.join() === 'true,true,true', 'C · e o botão "Telão" fica LIGADO (`aria-pressed="true"`, classe `active`)', tel);
    const v = await pv();
    checar(v.linhas[0] === '*09:00 Recepção' && v.linhas.length === 3,
      'C · às 09:58 a preview mostra "Recepção" em destaque e os seguintes abaixo', v);
    checar(v.lista.join() === 'Recepção', 'C · e a LISTA do cronograma marca o mesmo momento (`.agora`)', v.lista);
    checar(v.subs.join(' | ') === 'Agora · 1 h | 40 min | Último momento',
      'C · o subtítulo da linha diz "Agora" + a duração até o seguinte, e o último diz "Último momento"', v.subs);
  }
  // LIGAR E DESLIGAR: o botão tira o itinerário do telão sem apagar nada, e a marca da lista continua.
  await pg.click('#itinTelaoBtn');
  {
    const r = await esperar(pg, () => !itinProjecting());
    const e = await pg.evaluate(() => {
      const t = document.getElementById('itinTelaoBtn');
      return { pressed: t.getAttribute('aria-pressed'), ativo: t.classList.contains('active'), momentos: itinItens().length,
        marca: document.querySelectorAll('#library > li.momento.agora').length };
    });
    checar(r === true && e.pressed === 'false' && !e.ativo && e.momentos === 3 && e.marca === 1,
      'C · tocar de novo em "Telão" DESLIGA (a lista e a marca de agora ficam)', { r: porque(r), e });
  }
  await pg.evaluate(() => { window.__cmds.length = 0; });
  await pg.click('#itinTelaoBtn');
  await esperar(pg, () => itinProjecting() && !!document.querySelector('#pvTextItin .itin-linha'));
  await pg.evaluate(() => { window.__cmds.length = 0; });
  await ctx.clock.pauseAt(T('09:59', 57));
  await ctx.clock.runFor(5000);   // cruza 10:00:00 com o laço de um segundo
  {
    const v = await pv();
    checar(v.linhas[0] === '*10:00 Louvor' && v.linhas.length === 2,
      'C · ao cruzar 10:00 o destaque passa para "Louvor", e "Recepção" sai da lista do telão', v);
    checar(v.lista.join() === 'Louvor' && v.subs.join(' | ') === '1 h | Agora · 40 min | Último momento',
      'C · a lista do cronograma acompanha o relógio (a marca e o subtítulo passam para "Louvor")', { lista: v.lista, subs: v.subs });
    checar(v.anima > 0, 'C · e a troca é ANIMADA (as linhas têm animação viva)', v);
    const novos = await pg.evaluate(() => window.__cmds.length);
    checar(novos === 0, 'C · sem comando nenhum no barramento: cada tela segue o próprio relógio', novos);
  }
  await ctx.clock.resume();

  // ── D. O AJUSTE, PELA FAIXA ──────────────────────────────────────────────
  const horasPv = async () => (await pv()).linhas.map((t) => t.replace('*', '').slice(0, 5));
  const mins = (hs) => hs.map((h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3)));
  const ajusteTxt = () => pg.evaluate(() => {
    const b = document.getElementById('itinAjusteTxt');
    return { longo: b.querySelector('.itin-txt-longo').textContent, curto: b.querySelector('.itin-txt-curto').textContent,
      off: b.disabled, deslocado: b.classList.contains('deslocado') };
  });
  await pg.click('#itinBar .itin-passo[aria-label="Atrasar 5 min"]');
  await esperar(pg, () => itin.desloc === 5);
  {
    const v = await pv();
    const b = await banco();
    const a = await ajusteTxt();
    const horasLista = await pg.evaluate(() => [...document.querySelectorAll('#library > li.momento .momento-hora')].map((e) => e.textContent));
    // Com +5, às ~10:00:05 o "Louvor" (10:05) ainda não começou: volta a ser a Recepção.
    checar(v.linhas[0] === '*09:05 Recepção' && v.linhas.join('|').includes('10:05 Louvor')
      && v.linhas.join('|').includes('10:45 Pregação'),
      'D · +5 desloca TODOS os horários e o de agora acompanha (Louvor passa a 10:05)', v.linhas);
    checar(horasLista.join() === '09:05,10:05,10:45' && v.lista.join() === 'Recepção' && /previsto 09:00/.test(v.subs[0]),
      'D · e a LISTA mostra a hora efetiva (09:05 · 10:05 · 10:45), marca "Recepção" e o subtítulo diz "previsto 09:00"',
      { horasLista, lista: v.lista, subs: v.subs });
    checar(b && b.v === 3 && b.desloc === 5 && /^\d{4}-\d{2}-\d{2}$/.test(b.deslocDia || '')
      && Object.keys(b).sort().join() === 'barraOculta,desloc,deslocDia,horas,v',
      'D · o ajuste é guardado PELO DIA, e a chave tem só `{ v:3, horas, desloc, deslocDia, barraOculta }`', b);
    checar(a.longo === 'Atrasado 5 min' && a.curto === '+5 min' && !a.off && a.deslocado,
      'D · o atraso diz "Atrasado 5 min" (curto: "+5 min"), fica aceso e destacado (`deslocado`)', a);
  }
  await pg.click('#itinBar .itin-passo[aria-label="Adiantar 1 min"]');
  await esperar(pg, () => itin.desloc === 4);
  {
    const h = await horasPv();
    const m = mins(h);
    checar(h[0] === '09:04' && m[1] - m[0] === 60 && m[2] - m[1] === 40,
      'D · −1 recua todos juntos, e os INTERVALOS ficam (60 e 40 min)', h);
    checar((await ajusteTxt()).longo === 'Atrasado 4 min', 'D · e o atraso acompanha ("Atrasado 4 min")', await ajusteTxt());
  }
  await pg.click('#itinBar .itin-passo[aria-label="Adiantar 5 min"]');
  await esperar(pg, () => itin.desloc === -1);
  checar((await ajusteTxt()).longo === 'Adiantado 1 min' && (await ajusteTxt()).curto === '−1 min',
    'D · passando de zero o atraso vira "Adiantado 1 min" (curto: "−1 min", com o U+2212)', await ajusteTxt());
  await pg.click('#itinAjusteTxt');
  await esperar(pg, () => itin.desloc === 0);
  {
    const v = await pv();
    const a = await ajusteTxt();
    const b = await banco();
    checar(v.linhas[0] === '*10:00 Louvor' && a.off && !a.deslocado && a.longo === 'No horário' && a.curto === '0 min',
      'D · tocar no atraso ZERA o ajuste (volta ao previsto), e no previsto ele fica APAGADO ("No horário")', { v: v.linhas, a });
    checar(b.desloc === 0 && b.deslocDia === '', 'D · e o zero é guardado (`desloc: 0`, `deslocDia` vazio)', b);
  }

  // ── J. O PAR AO LADO DA PREVIEW É O AJUSTE, DE 5 EM 5 MIN ──────────────
  // Pedido do operador (v1.13.1): com o itinerário no ar, ⏮ adianta 5 min e ⏭
  // atrasa 5 min — a ordem do −5 … +5 da faixa.
  {
    const par = await pg.evaluate(() => ({
      alvo: slideTarget(), fora: eixoForaDoPainel(),
      prev: [slidePrevBtnEl.disabled, slidePrevBtnEl.title, slidePrevBtnEl.textContent.trim()],
      next: [slideNextBtnEl.disabled, slideNextBtnEl.title, slideNextBtnEl.textContent.trim()],
    }));
    checar(par.alvo === 'itinerario' && !par.prev[0] && !par.next[0]
      && par.prev[2] === '−5' && par.next[2] === '+5'
      && /Adiantar 5 min/.test(par.prev[1]) && /Atrasar 5 min/.test(par.next[1]),
      'J · com o itinerário no ar o par diz "−5"/"+5" e está aceso', par);
    checar(par.fora === 'itinerario',
      'J · e ele vale na TELA CHEIA (não é eixo só do painel); a NOTIFICAÇÃO perdeu o atalho '
      + 'na v1.14.23 (Pacote 31): os ⏮/⏭ dela são do player', par);
  }
  // COM A FOLHA DE FERRAMENTAS FECHADA: o par não depende de painel nenhum.
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
    checar((await ajusteTxt()).longo === 'Atrasado 5 min', 'J · e a faixa mostra o mesmo atraso ("Atrasado 5 min")', await ajusteTxt());
  }
  // A COLUNA DA TELA CHEIA roteia pelo mesmo par (`attachTransportStep`).
  await pg.evaluate(() => document.getElementById('fsPrev').click());
  {
    const r = await esperar(pg, () => itin.desloc === 0);
    checar(r === true, 'J · o ⏮ da coluna da tela cheia adianta 5 min pelo mesmo caminho', porque(r));
  }
  // NOS EXTREMOS o passo apaga — a mesma régua dos −5/+5 da faixa.
  {
    const lim = await pg.evaluate(() => {
      itin.desloc = ITIN_DESLOC_MAX - 5; itinAjustar(5);
      const noTeto = [slidePrevBtnEl.disabled, slideNextBtnEl.disabled];
      const faixaNoTeto = [...document.querySelectorAll('#itinBar .itin-passo')].map((b) => b.textContent + (b.disabled ? ':off' : ''));
      itinAjusteZerar();
      const zerado = [slidePrevBtnEl.disabled, slideNextBtnEl.disabled];
      return { noTeto, faixaNoTeto, zerado, desloc: itin.desloc, apagado: [itinPassoApagado(-1), itinPassoApagado(1)] };
    });
    checar(lim.noTeto[0] === false && lim.noTeto[1] === true && lim.zerado.join() === 'false,false' && lim.desloc === 0,
      'J · em +12 h o ⏭ APAGA (e o ⏮ não); zerado, os dois voltam', lim);
    checar(lim.faixaNoTeto.join(' ') === '−5 −1 +1:off +5:off',
      'J · e na faixa, em +12 h, só os passos para a frente apagam (+1 e +5)', lim.faixaNoTeto);
  }

  // ── E. HORÁRIOS × SÓ OS TÍTULOS, PELA FAIXA ──────────────────────────────
  await pg.click('#itinHorasBtn');
  await esperar(pg, () => document.getElementById('pvTextItin').classList.contains('sem-horas'));
  {
    const v = await pv();
    const b = await banco();
    const bt = await pg.evaluate(() => { const t = document.getElementById('itinHorasBtn'); return [t.getAttribute('aria-pressed'), t.classList.contains('active')]; });
    checar(v.semHoras && v.horaVisivel === 'none' && b.horas === false && bt.join() === 'false,false',
      'E · "só os títulos": a hora some da lista projetada, o botão desliga (`aria-pressed="false"`) e a escolha é guardada', { v, horas: b.horas, bt });
    checar(v.linhas[0].startsWith('*'), 'E · e o item de agora CONTINUA marcado', v.linhas);
  }
  await pg.click('#itinHorasBtn');
  await esperar(pg, () => !document.getElementById('pvTextItin').classList.contains('sem-horas'));
  checar((await faixa()).horas === 'true', 'E · e o botão volta a "horários" (`aria-pressed="true"`)', await faixa());

  // ── U (no ar). RECOLHIDA, A FAIXA CONTINUA DIZENDO QUE ESTÁ NO AR ─────────
  await pg.click('#itinBarFechar');
  {
    const f = await faixa();
    const cls = await pg.evaluate(() => document.getElementById('itinBar').classList.contains('no-ar'));
    checar(f.recolhida && f.ponto && cls,
      'U · recolhida com o itinerário NO AR, a faixa mostra o ponto aceso (`.itin-ponto`) — a única pista que sobra', { f, cls });
  }
  await pg.click('#itinBarAbrir');
  {
    const f = await faixa();
    checar(!f.recolhida && f.telao.join() === 'true,false', 'U · abrir de novo devolve o "Telão" ligado', f);
  }

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
    // A PREVIEW É O TELÃO EM MINIATURA, NÃO UM LAYOUT PRÓPRIO (v1.13.11). Numa
    // caixa de ~400px a marca media 2,6cqmin ≈ 5,6px, e o WebView engorda toda
    // fonte abaixo de 8px (`WebSettings.minimumFontSize`) sem engordar a coluna
    // dela: "A seguir" vazava pela ESQUERDA do bloco. Desenhada numa caixa
    // quatro vezes maior e reduzida, nenhuma fonte cai abaixo do piso e a
    // proporção é a do telão. As duas réguas: a fonte de LAYOUT da marca, e a
    // PROPORÇÃO entre a marca e o bloco nas duas telas.
    const prop = async (p, olId) => p.evaluate((id) => {
      const ol = document.getElementById(id);
      const li = ol.querySelector('.itin-linha.agora') || ol.querySelector('.itin-linha');
      const tag = li.querySelector('.itin-tag');
      // A RÉGUA É A ALTURA DA LINHA (9,6cqmin), não a largura do bloco: a largura
      // depende da proporção da tela, e telão e preview não têm a mesma.
      const h = li.getBoundingClientRect().height, l = li.getBoundingClientRect(), t = tag.getBoundingClientRect();
      return { fs: parseFloat(getComputedStyle(tag).fontSize), tagLarg: t.width / h, tagEsq: (t.left - l.left) / h };
    }, olId);
    const pvP = await prop(pg, 'pvTextItin'), tvP = await prop(tv, 'textItin');
    checar(pvP.fs >= 8,
      'M · na preview a marca é desenhada com fonte ≥ 8px (o piso do WebView não a deforma)', pvP);
    checar(Math.abs(pvP.tagLarg - tvP.tagLarg) < 0.03 && Math.abs(pvP.tagEsq - tvP.tagEsq) < 0.03,
      'M · e a marca tem na preview a MESMA proporção que no telão, medida pela altura da linha (enquadramento igual)', { pvP, tvP });
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

  // O telão segue o PRÓPRIO relógio: cruzar 10:40 troca o destaque lá também.
  await ctx.clock.pauseAt(T('10:39', 58));
  await ctx.clock.runFor(4000);
  {
    const t = await telao();
    const marca = await pg.evaluate(() => [...document.querySelectorAll('#library > li.momento.agora .row-name')].map((e) => e.textContent).join());
    checar(t.linhas.length === 1 && t.linhas[0] === '*10:40 Pregação [Agora]',
      'G · depois do último horário o último fica no ar, sozinho', t.linhas);
    checar(t.anima > 0, 'F · e no telão a troca também é animada', t);
    checar(marca === 'Pregação', 'G · e a lista do cronograma marca o mesmo último momento', marca);
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

  // ── W. CRONOGRAMA MÚLTIPLO: cada cronograma tem os SEUS momentos ─────────
  // O itinerário segue o cronograma ATIVO: trocar de cronograma troca a lista, e
  // com ele no ar o telão acompanha (o reenvio sai da releitura da lista). Aqui o
  // "A" é o que os blocos acima montaram; o "B" nasce vazio pela gaveta do título.
  const abrirGavetaCrono = async () => {
    await pg.click('#cronoTitulo');
    return esperar(pg, () => {
      const g = document.getElementById('cronoGaveta');
      return !g.hidden && g.classList.contains('aberta') && g.getAnimations().every((a) => a.playState !== 'running');
    });
  };
  // A troca terminou quando a lista de momentos lida e a desenhada concordam com o
  // esperado (a `load()` redesenha a lista por último).
  const assentou = (titulos) => esperar(pg, (e) => itinItens().map((x) => x.titulo).join() === e
    && document.querySelectorAll('#library > li.momento').length === itinItens().length
    && document.getElementById('cronoGaveta').hidden, titulos);
  const nomeDoCrono = () => pg.evaluate(() => document.getElementById('listTitle').textContent);
  const nomeA = await nomeDoCrono();
  const tvTitulos = () => tv.evaluate(() => [...document.querySelectorAll('#textItin .itin-linha:not(.itin-saindo) .itin-titulo')]
    .map((e) => e.textContent).join());
  checar(await pg.evaluate(() => itinProjecting()) === true,
    'W · ponto de partida: o itinerário do cronograma "A" está no ar', await pg.evaluate(() => itinProjecting()));
  {
    const r1 = await abrirGavetaCrono();
    await pg.click('#cronoNovo');
    const r2 = await assentou('');
    const e = await pg.evaluate(() => {
      const t = document.getElementById('itinTelaoBtn');
      return { momentos: document.querySelectorAll('#library > li.momento').length, noAr: itinProjecting(),
        off: t.disabled, titulo: t.title, pressed: t.getAttribute('aria-pressed'), nome: document.getElementById('listTitle').textContent };
    });
    const r3 = await esperar(tv, () => document.getElementById('text').hidden === true);
    checar(r1 === true && r2 === true && e.nome !== nomeA && e.momentos === 0,
      'W · um cronograma NOVO nasce SEM momentos: os de "' + nomeA + '" são do outro cronograma', { e, r1: porque(r1), r2: porque(r2) });
    checar(!e.noAr && e.off && /adicione/i.test(e.titulo) && e.pressed === 'false' && r3 === true,
      'W · e trocar para um cronograma sem momentos TIRA o itinerário do telão (e apaga o "Telão", dizendo por quê)', { e, r3: porque(r3) });
  }
  const nomeB = await nomeDoCrono();
  // B: uma mídia primeiro, depois os momentos — o primeiro vai ao TOPO (nenhum momento
  // na lista), o segundo ao FIM (nenhum momento depois dele no relógio).
  await pg.evaluate(async () => {
    await AVDB.addCue('message', { text: 'Aviso do ensaio' }, { name: 'Aviso B', list: 'imports' });
    await load();
  });
  await adicionar('19:00', 'Ensaio');
  checar((await nomesNaTela()).join() === 'Ensaio,Aviso B',
    'W · lista SEM momento: o primeiro momento entra no TOPO, acima da mídia que já estava lá', await nomesNaTela());
  await adicionar('19:30', 'Coral');
  checar((await nomesNaTela()).join() === 'Ensaio,Aviso B,Coral',
    'W · e um momento sem nenhum posterior no relógio entra no FIM da lista (depois da mídia)', await nomesNaTela());
  {
    const e = await pg.evaluate(() => {
      const t = document.getElementById('itinTelaoBtn');
      const seguir = document.querySelector('#library > li.momento.seguir');
      return { off: t.disabled, titulo: t.title,
        seguir: seguir ? seguir.querySelector('.row-name').textContent + ' · ' + seguir.querySelector('.row-sub').textContent : null,
        agora: document.querySelectorAll('#library > li.momento.agora').length };
    });
    checar(!e.off && e.agora === 0 && /^Ensaio · A seguir/.test(e.seguir || ''),
      'W · com momentos de novo o "Telão" acende, e antes do primeiro horário a linha diz "A seguir" (nenhum de agora)', e);
  }
  await pg.click('#itinTelaoBtn');
  await esperar(pg, () => itinProjecting());
  {
    const r = await esperar(tv, () => /Ensaio/.test(document.getElementById('textItin').textContent));
    const t = await telao();
    checar(r === true && t.linhas[0] === '>19:00 Ensaio [A seguir]' && t.linhas[1] === '19:30 Coral' && (await tvTitulos()) === 'Ensaio,Coral',
      'W · no ar, o telão mostra a lista do cronograma "B" (Ensaio, Coral) — pelo relógio', { r: porque(r), t });
  }
  // EDITAR COM O ITINERÁRIO NO AR: o reenvio sai da releitura da lista, e o operador
  // não toca em "Telão" para o telão saber.
  {
    const idCoral = await idDe('Coral');
    await pg.evaluate((id) => itinSalvar(id, 1185, 'Coral e Oração'), idCoral);
    const r = await esperar(tv, () => /Coral e Oração/.test(document.getElementById('textItin').textContent), null, 8000);
    const t = await telao();
    checar(r === true && t.linhas[0] === '>19:00 Ensaio [A seguir]' && t.linhas[1] === '19:45 Coral e Oração',
      'F · com o itinerário no ar, EDITAR um momento (horário e título) atualiza o telão — o reenvio sai da releitura da lista',
      { r: porque(r), t: t.linhas });
    await pg.evaluate((id) => itinSalvar(id, 1170, 'Coral'), idCoral);
    const r2 = await esperar(tv, () => /19:30/.test(document.getElementById('textItin').textContent)
      && !/Coral e Oração/.test(document.getElementById('textItin').textContent), null, 8000);
    checar(r2 === true, 'F · e desfazer a edição leva o telão de volta ao que era (19:30 Coral)', porque(r2));
  }
  // TROCA, COM O ITINERÁRIO NO AR: o telão acompanha, sem ninguém tocar em "Telão".
  {
    const r1 = await abrirGavetaCrono();
    await pg.click('#cronoGaveta .crono-item:not(.ativo) .crono-trocar');
    const r2 = await assentou('Recepção,Louvor,Pregação');
    const r3 = await esperar(tv, () => document.querySelector('#textItin .itin-linha.agora .itin-titulo')
      && document.querySelector('#textItin .itin-linha.agora .itin-titulo').textContent === 'Pregação');
    const e = await pg.evaluate(() => ({
      nome: document.getElementById('listTitle').textContent, noAr: itinProjecting(),
      nomes: [...document.querySelectorAll('#library > li.lib-item .row-name')].map((x) => x.textContent).join(),
      marca: [...document.querySelectorAll('#library > li.momento.agora .row-name')].map((x) => x.textContent).join(),
    }));
    checar(r1 === true && r2 === true && e.nome === nomeA && e.nomes === 'Recepção,Aviso 2,Louvor,Pregação,Aviso 1' && e.marca === 'Pregação',
      'W · voltar ao cronograma "A" devolve os momentos DELE (e as mídias dele), e só deles', { e, r1: porque(r1), r2: porque(r2) });
    checar(e.noAr && r3 === true && (await tvTitulos()) === 'Pregação' && !/Ensaio|Coral/.test(await tvTitulos()),
      'W · com o itinerário NO AR, o telão acompanhou a troca: agora mostra a lista de "A" (o último, "Pregação")',
      { e, tv: await tvTitulos(), r3: porque(r3) });
  }
  {
    const r1 = await abrirGavetaCrono();
    await pg.click('#cronoGaveta .crono-item:not(.ativo) .crono-trocar');
    const r2 = await assentou('Ensaio,Coral');
    const r3 = await esperar(tv, () => /Ensaio/.test(document.getElementById('textItin').textContent)
      && !/Pregação/.test(document.getElementById('textItin').textContent));
    const e = await pg.evaluate(() => ({ nome: document.getElementById('listTitle').textContent, noAr: itinProjecting() }));
    checar(r1 === true && r2 === true && e.nome === nomeB && e.noAr && r3 === true,
      'W · e a volta para "B" leva o telão de volta à lista dele (Ensaio, Coral)', { e, tv: await tvTitulos(), r3: porque(r3) });
  }

  // ── I. ESVAZIAR NO AR TIRA DO TELÃO ──────────────────────────────────────
  await pg.evaluate(async () => { for (const x of itinItens()) await AVDB.listRemove('imports', x.id); await load(); });
  await esperar(pg, () => !itinProjecting());
  {
    const r = await pg.evaluate(() => {
      const t = document.getElementById('itinTelaoBtn');
      return { noAr: itinProjecting(), off: t.disabled, titulo: t.title, pressed: t.getAttribute('aria-pressed'),
        momentos: document.querySelectorAll('#library > li.momento').length,
        midia: [...document.querySelectorAll('#library > li.lib-item .row-name')].map((x) => x.textContent).join() };
    });
    const r3 = await esperar(tv, () => document.getElementById('text').hidden === true);
    checar(!r.noAr && r.off && /adicione/i.test(r.titulo) && r.pressed === 'false' && r.momentos === 0,
      'I · a lista que esvazia no ar sai do telão, e o "Telão" volta apagado dizendo por quê', r);
    checar(r3 === true && r.midia === 'Aviso B',
      'I · o telão (a tela) escondeu o cartão, e a mídia do cronograma ficou intacta', { r3: porque(r3), midia: r.midia });
  }

  // ── S. A MIGRAÇÃO DO ITINERÁRIO DA v1.13 (os itens do ATIVO viram momentos) ──
  // O cronograma "B" está sem momentos e com UMA mídia ("Aviso B"): os migrados têm
  // de entrar ACIMA dela, em ordem de relógio, e só o itinerário ATIVO vem.
  const hoje = await pg.evaluate(() => hojeLocal());
  const velho = (hojeDia) => ({
    v: 2, horas: false, desloc: 7, deslocDia: hojeDia, ativo: 'a',
    itens: [{ id: 's3', min: 660, titulo: 'Sermão' }, { id: 's1', min: 540, titulo: 'Recepção' }, { id: 's2', min: 600, titulo: 'Louvor' }],
    itinerarios: [
      { id: 'a', nome: 'Culto', itens: [], horas: false },
      { id: 'b', nome: 'Ensaio guardado', itens: [{ id: 'g1', min: 1140, titulo: 'Coral guardado' }], horas: true },
    ],
  });
  await pg.evaluate(async (est) => {
    for (const x of itinItens()) await AVDB.listRemove('imports', x.id);
    await AVDB.setState('itinerario', est);
    itinLegadoFeito = false;
    await load();
  }, velho(hoje));
  const migrado = () => pg.evaluate(async () => {
    const regs = await AVDB.listItems('imports');
    return {
      ordem: regs.map((r) => (ehMomento(r) ? 'M:' : 'x:') + r.name).join(','),
      legado: regs.filter(ehMomento).map((r) => r.data.legado).join(','),
      horas: regs.filter(ehMomento).map((r) => r.data.min).join(','),
      estado: await AVDB.getState('itinerario'),
      noTela: [...document.querySelectorAll('#library > li.lib-item')].map((li) => li.querySelector('.row-name').textContent).join(','),
      mem: { horas: itin.horas, desloc: itin.desloc, feito: itinLegadoFeito },
      horasNaLista: [...document.querySelectorAll('#library > li.momento .momento-hora')].map((e) => e.textContent).join(),
    };
  });
  {
    const m = await migrado();
    checar(m.ordem === 'M:Recepção,M:Louvor,M:Sermão,x:Aviso B' && m.legado === 's1,s2,s3' && m.horas === '540,600,660',
      'S · os itens do ATIVO viram momentos no TOPO de `imports`, em ordem de RELÓGIO, com `data.legado` = o id antigo '
      + '(a mídia que já estava lá desce)', m);
    checar(!m.ordem.includes('Coral guardado') && !m.noTela.includes('Coral'),
      'S · os itinerários GUARDADOS (os não ativos) são DESCARTADOS: nenhum "Coral guardado" no cronograma', m.ordem);
    const e = m.estado || {};
    checar(e.v === 3 && e.horas === false && e.desloc === 7 && e.deslocDia === hoje && e.barraOculta === false
      && Object.keys(e).sort().join() === 'barraOculta,desloc,deslocDia,horas,v',
      'S · a chave vira `{ v:3, horas, desloc, deslocDia, barraOculta }` — sem `itens`, `itinerarios`, `ativo` — mantendo `horas` e o ajuste do dia', e);
    checar(m.mem.horas === false && m.mem.desloc === 7 && m.mem.feito === true && m.horasNaLista === '09:07,10:07,11:07',
      'S · e o app já lê a chave nova: horários desligados no telão, ajuste de +7 min aplicado às horas da lista', m.mem);
  }
  await pg.evaluate(() => load());
  checar((await migrado()).ordem === 'M:Recepção,M:Louvor,M:Sermão,x:Aviso B',
    'S · um segundo `load()` NÃO duplica nada', (await migrado()).ordem);
  // UM CORTE NO MEIO: a chave antiga volta (os momentos já estavam gravados) e a migração roda de novo.
  await pg.evaluate(async (est) => { await AVDB.setState('itinerario', est); itinLegadoFeito = false; await load(); }, velho(hoje));
  {
    const m = await migrado();
    checar(m.ordem === 'M:Recepção,M:Louvor,M:Sermão,x:Aviso B' && m.estado.v === 3 && !('itens' in m.estado),
      'S · rodar a migração de novo sobre a chave antiga (um corte no meio) não duplica: o `legado` reconhece os já criados', m);
  }

  // ── T. A CENA ANTIGA `itinerario`: tocá-la ACRESCENTA os horários ────────
  // "Louvor 10:00" já existe (mesmo horário e título): não entra de novo. "Avisos" e
  // "Bênção" entram, no FIM da lista (nenhum momento depois deles no relógio).
  const antigaCena = await pg.evaluate(async () => {
    const rec = await AVDB.addCue('itinerario',
      { itens: [{ min: 600, titulo: 'Louvor' }, { min: 690, titulo: 'Avisos' }, { min: 720, titulo: 'Bênção' }], horas: true },
      { name: 'Itinerário 10:00–12:00', list: 'imports' });
    await load();
    return rec.id;
  });
  const estadoDaLista = () => pg.evaluate(async () => {
    const regs = await AVDB.listItems('imports');
    return { ids: regs.map((r) => r.id), momentos: itinItens().map((x) => x.min + ' ' + x.titulo).join('|'),
      ordem: regs.map((r) => r.name).join(','), cena: regs.filter((r) => r.cue === 'itinerario').length };
  });
  const antesT = await estadoDaLista();
  await pg.evaluate((id) => AVDB.listItems('imports').then((rs) => playCue(rs.find((r) => r.id === id))), antigaCena);
  const depoisT = await estadoDaLista();
  checar(depoisT.momentos === '540 Recepção|600 Louvor|660 Sermão|690 Avisos|720 Bênção',
    'T · tocar a cena antiga ACRESCENTA os horários como momentos, e o "Louvor 10:00" que já existia NÃO duplica', { antesT, depoisT });
  checar(antesT.ids.every((id) => depoisT.ids.includes(id)) && depoisT.cena === 1,
    'T · e nada foi apagado: todos os itens de antes continuam na lista (a própria cena inclusive)', { antesT: antesT.ordem, depoisT: depoisT.ordem });
  checar(depoisT.ordem.endsWith('Itinerário 10:00–12:00,Avisos,Bênção'),
    'T · os acrescentados entram no FIM da lista (nenhum momento depois deles no relógio)', depoisT.ordem);
  await pg.evaluate((id) => AVDB.listItems('imports').then((rs) => playCue(rs.find((r) => r.id === id))), antigaCena);
  {
    const d2 = await estadoDaLista();
    const nota = await esperar(pg, (id) => {
      const li = document.querySelector('#library > li.lib-item[data-id="' + id + '"]');
      return !!li && /já estão no cronograma/.test(li.textContent);
    }, antigaCena, 3000);
    checar(d2.ordem === depoisT.ordem && d2.momentos === depoisT.momentos,
      'T · tocar a cena DE NOVO não duplica nada', { depoisT: depoisT.ordem, d2: d2.ordem });
    checar(nota === true, 'T · e a linha da cena diz por quê: "estes momentos já estão no cronograma"', porque(nota));
  }

  checar(erros.length === 0, 'nenhum erro de console', erros);
} catch (e) {
  checar(false, 'o oráculo rodou até o fim', e && e.stack || String(e));
} finally {
  await navegador.close();
  servidor.close();
}

console.log('\n(' + Math.round((Date.now() - inicio) / 1000) + ' s)');
if (falhas.length) { console.log('\n' + falhas.length + ' falha(s).'); process.exit(1); }
console.log('\nTodos passaram.');
