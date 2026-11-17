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
//    Tocar edita (sub-aba `#itinEditor`); segurar ARRASTA; sem `⋮`: excluir (a pergunta
//    NA LINHA) e editar sempre à vista, só o ícone — não há par ↑↓.
//  · A ORDEM: a posição da linha é do OPERADOR (organiza as mídias); o TELÃO é
//    ordenado pelo RELÓGIO (`ordenarItin`). Momento novo entra antes do primeiro
//    momento posterior no relógio, senão no fim da lista; lista sem momento: no TOPO.
//  · A FAIXA `#itinBar` (a primeira filha do `.list-body`, no FLUXO: abrir EMPURRA a
//    lista — v1.14.55; a sub-aba, essa sim, é sobreposta): Novo (o `+`, que abre
//    e fecha a sub-aba do momento) · Telão (o monitor) · Momentos na lista · Horários × só
//    títulos · −5 [ajuste] +5. NASCE RECOLHIDA (vazia, `hidden`), abre e fecha pela porta
//    `#itinBarBtn` da barra (que leva o ponto do "no ar"); aberta, fica; abrir não se grava.
//  · O ESTADO `state.itinerario` = `{ v:3, horas, desloc, deslocDia, momentosOcultos }` e
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
//  D. O AJUSTE, pela faixa: os ±5 deslocam os horários JUNTOS (os intervalos ficam),
//     o de agora acompanha, tocar no atraso o ZERA; gravado PELO DIA.
//  E. Horários × só os títulos (`#itinHorasBtn`).
//  F. O TELÃO: a mesma lista pelo DESCRITOR, e o REENVIO na reconexão.
//  G. Antes do primeiro e depois do último, no telão.
//  H. `prefers-reduced-motion`: nada se move.
//  I. Lista sem momentos: o "Telão" é APAGADO e diz por quê; esvaziar no ar tira do telão.
//  J. Com o itinerário no ar o ⏮/⏭ é o AJUSTE de 5 em 5 min, com apagado nos extremos.
//  L. A SUB-ABA de um momento: roletas de hora e minuto, nenhum `<input type="time">`.
//  L′. (v1.14.52) a sub-aba DESLIZA sem mover a lista, por cima dela, logo abaixo da faixa;
//     o `+` é o fechar (a seta sem card); o voltar e a faixa recolhida a fecham; o cinza
//     dos botões da faixa no tema claro é o do `.t-btn`.
//  M. O DESENHO NO TELÃO: wallpaper à vista, bloco escuro centrado, a marca "Agora"
//     à esquerda do horário — medido por pixel sobre um wallpaper branco.
//  N. O TECLADO da sub-aba não mexe na barra de busca da Biblioteca.
//
//  NOVOS (v1.14.32):
//  B′. MOMENTOS NA LISTA, PELA UI REAL: três (e mais um) criados FORA da ordem do
//     relógio pela folha; a lista sai pelo relógio; sem `.thumb`; hora e título à vista;
//     o registro é cue `momento` em `imports`; editar por TOQUE na linha; excluir pelo
//     ícone sempre à vista, com a pergunta na linha; persistência por RECARGA.
//  D′. ARRASTO REAL: uma MÍDIA muda de lugar (e de grupo) sem mexer em horário, e o telão
//     não muda; um MOMENTO leva o grupo e REESCREVE os horários pela grade (o k-ésimo da
//     lista recebe o k-ésimo `min`); nada toca sozinho quando o relógio cruza um horário.
//  S. A MIGRAÇÃO do itinerário da v1.13: os itens do ATIVO viram momentos no TOPO, em
//     ordem de relógio, com `data.legado`; a chave vira `{ v:3 }` sem `itens`,
//     `itinerarios`, `ativo`; os GUARDADOS são descartados; repetir não duplica; o
//     `barraOculta` antigo é ignorado e some na primeira gravação.
//  T. A CENA ANTIGA `itinerario`: tocá-la ACRESCENTA os horários como momentos (sem
//     apagar nada, sem duplicar o que já existe, e tocar de novo não duplica).
//  U. A FAIXA E A PORTA: o app abre com ela recolhida (vazia); a porta `#itinBarBtn` (na
//     barra, sozinha na trilha 1, antes do título) a abre com os sete botões e a fecha, sem gravar nada;
//     aberta antes de recarregar, volta recolhida; em 320, 360 e 430 cabe numa linha.
//  V. SEM FERRAMENTA: `FERRAMENTAS` sem `itinerario`, nenhum id/global removido, e a
//     folha de Ferramentas só tem os seis tiles.
//  W. CRONOGRAMA MÚLTIPLO: cada cronograma tem os SEUS momentos, e com o itinerário no
//     ar o telão acompanha a troca.
//  X. MOMENTOS OCULTOS (`#itinMomentosBtn`): a lista não desenha `li.momento`, o telão não
//     muda, a escolha é gravada e volta da RECARGA; o arrasto de mídia segue o vizinho.
//  Y. A FAIXA NÃO SE FECHA SOZINHA (v1.14.37): aberta, ela fica aberta no relógio falso, e só a
//     porta da barra a recolhe (o fecho de 5 s da v1.14.35 saiu a pedido do operador).
//  G′. O GRUPO DO MOMENTO: as classes `grupo-ini/meio/fim` (nenhuma antes do 1º momento, num
//     momento sem mídia nem com os momentos ocultos), NENHUMA TINTA (o grupo não se pinta desde a
//     v1.14.36: o que o separa é o respiro), TODOS OS MOMENTOS COM A MESMA ALTURA E MAIS
//     COMPACTOS QUE A MÍDIA (v1.14.57: a linha do momento mede menos que a de uma mídia, e o
//     respiro é margem, fora da caixa), a SETA do grupo como BOTÃO à esquerda do lápis, o
//     bloco que só cai numa fronteira de grupo (nunca antes das mídias soltas do topo), a mídia que
//     muda de grupo sem horário, e o GRUPO RECOLHIDO: a seta e o toque escondem/expandem as mídias,
//     e o arrasto leva as escondidas.
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
  // A FAIXA NASCE RECOLHIDA e se recolhe sozinha 5 s depois do último toque nela (Pacote 35):
  // todo uso dela passa por aqui — fechada, a porta `#itinBarBtn` a abre; aberta, um toque nela
  // recomeça a conta, para o passo seguinte não achá-la fechada no meio.
  const portaAberta = () => pg.evaluate(() => document.getElementById('itinBarBtn').getAttribute('aria-expanded') === 'true');
  // DESDE O PACOTE 37 a faixa ABRE DESLIZANDO (a altura medida vai de 0 ao repouso em
  // `--dur-media`), então "os sete botões existem" deixou de ser o mesmo instante que
  // "a faixa está no lugar": quem mede altura, margem ou o topo da lista espera o
  // movimento acabar. `itinFaixaAnimando` é o estado que o `itinFaixaAlternar` mantém.
  const abrirFaixa = async () => {
    if (await portaAberta()) await pg.dispatchEvent('#itinBar', 'click');
    else await pg.click('#itinBarBtn');
    await esperar(pg, () => !!document.getElementById('itinTelaoBtn') && !itinFaixaAnimando);
  };
  const fecharFaixa = async () => {
    if (await portaAberta()) await pg.click('#itinBarBtn');
    await esperar(pg, () => document.getElementById('itinBar').hidden);
  };
  {
    const b0 = await pg.evaluate(() => {
      const b = document.getElementById('itinBar'), p = document.getElementById('itinBarBtn');
      return { hidden: b.hidden, filhos: b.children.length, porta: !p.hidden && p.getClientRects().length > 0, exp: p.getAttribute('aria-expanded') };
    });
    checar(b0.hidden && b0.filhos === 0 && b0.porta && b0.exp === 'false',
      'U · o app ABRE com a faixa recolhida (vazia, `hidden`) e a porta `#itinBarBtn` à vista, `aria-expanded="false"`', b0);
  }

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
  await abrirFaixa();
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

  // O HORÁRIO SE ESCOLHE NAS ROLETAS da sub-aba (v1.13.1): a posição é escrita
  // como o dedo a deixaria — a célula do valor na banda do meio —, e quem lê é o
  // confirmar, pelo `roletaValorDe` de sempre.
  // A SUB-ABA DESLIZA (v1.14.52): "aberta" é sem `hidden`, com as roletas, e PARADA.
  const abrirFolha = () => esperar(pg, () => !document.getElementById('itinEditor').hidden
    && !!document.getElementById('itinRoleta_hora') && !itinEditorAnimando);
  const escolherHora = (hm) => pg.evaluate((v) => {
    const [h, m] = v.split(':').map(Number);
    const rh = document.getElementById('itinRoleta_hora');
    const rm = document.getElementById('itinRoleta_min');
    const it = roletaItem(rh);
    rh.scrollTop = (Number(rh.dataset.base) + pistaDoValor(h, 24, 0)) * it;
    rm.scrollTop = (Number(rm.dataset.base) + pistaDoValor(m, 60, 0)) * it;
  }, hm);
  // O confirmar é ASSÍNCRONO (grava, relê a lista e SÓ ENTÃO fecha): sub-aba fechada
  // (o fim do deslizar: `hidden`) quer dizer lista já redesenhada.
  const fechada = () => esperar(pg, () => document.getElementById('itinEditor').hidden && !itinEditorAnimando);
  const adicionar = async (hora, titulo) => {
    await abrirFaixa();
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
  await abrirFaixa();
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
        titulo: document.getElementById('itinEditorTitulo').textContent,
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
    // hora desce a lista uma célula — e o valor CRESCE PARA BAIXO (v1.14.41, o
    // mesmo sentido das roletas do Timer desde 16/11), então ele sobe de 10 para 11.
    const caixa = await pg.locator('#itinRoleta_hora').boundingBox();
    await pg.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
    await pg.mouse.wheel(0, f.item);
    const rw = await esperar(pg, () => roletaValorDe(document.getElementById('itinRoleta_hora')) === 11, null, 5000);
    checar(rw === true, 'L · a roleta da hora responde ao gesto (10 → 11 com uma célula de rolagem PARA BAIXO)', porque(rw));
  }
  // O FECHAR É O PRÓPRIO `+` (o pedido: *"seu botão de fechar vai ser o que antes foi o seu botão de abrir"*).
  await pg.click('#itinNovoBtn');
  await fechada();
  checar((await lista()).length === 0, 'L · fechar a sub-aba sem confirmar NÃO cria momento nenhum', await lista());

  // ── L′. A SUB-ABA DO MOMENTO (v1.14.52) ──────────────────────────────────
  // Pedido do operador: *"Faça a tela de novo momento ser uma sub-aba que desliza abaixo
  // da aba de configurações do itinerário … vai sobrepor a linha de itens no cronograma,
  // para não precisar deslocar a lista. E seu botão de fechar vai ser o que antes foi o
  // seu botão de abrir"*. A régua: ela DESLIZA (alturas intermediárias), nasce na borda
  // de baixo da faixa, cobre as linhas sem MOVER nenhuma (o topo do `#library` e o da
  // primeira linha parados em todos os quadros), o `+` vira a SETA sem card com
  // `aria-expanded`, o voltar a fecha antes de tudo (a faixa fica), o fecho chega a ZERO
  // antes do `hidden` e fechar a faixa a leva junto.
  await pg.evaluate(async () => { await AVDB.addCue('message', { text: 'x' }, { name: 'Linha de baixo', list: 'imports' }); await load(); });
  await esperar(pg, () => !!document.querySelector('#library > li.lib-item'));
  await abrirFaixa();
  {
    const antes = await pg.evaluate(() => {
      const b = document.getElementById('itinNovoBtn');
      return { exp: b.getAttribute('aria-expanded'), ctl: b.getAttribute('aria-controls'), usos: b.querySelectorAll('use').length,
        pintado: !/,\s*0\)$/.test(getComputedStyle(b).backgroundColor) };
    });
    // A AMOSTRAGEM NÃO DEPENDE DO AGENDADOR: `--dur-media` é esticado para 320ms NESTE
    // trecho (e devolvido no fim) e a janela vai a 650ms — com os 200ms de fábrica e a
    // máquina apertada, um quadro só caía no meio e o `meio >= 2` reprovava por prazo, não
    // por desenho (medido: 1 em 3 rodadas). O que o bloco prova continua o mesmo: a altura
    // passa por valores ENTRE o zero e o alto, e a lista não anda em quadro nenhum.
    const q = await pg.evaluate(() => new Promise((ok) => {
      const ed = document.getElementById('itinEditor'), lib = document.getElementById('library');
      const li = lib.querySelector('li.lib-item');
      const raiz = document.documentElement;
      const antesDur = raiz.style.getPropertyValue('--dur-media');
      raiz.style.setProperty('--dur-media', '320ms');
      const v = [], t0 = performance.now();
      document.getElementById('itinNovoBtn').click();
      const fim = () => {
        if (antesDur) raiz.style.setProperty('--dur-media', antesDur); else raiz.style.removeProperty('--dur-media');
        ok(v);
      };
      const passo = () => {
        v.push([ed.hidden ? -1 : Math.round(ed.getBoundingClientRect().height * 10) / 10,
          Math.round(lib.getBoundingClientRect().top * 10) / 10, Math.round(li.getBoundingClientRect().top * 10) / 10]);
        if (performance.now() - t0 < 650) requestAnimationFrame(passo); else fim();
      };
      requestAnimationFrame(passo);
    }));
    await abrirFolha();
    const alto = q[q.length - 1][0];
    const meio = q.filter((x) => x[0] > 1 && x[0] < alto - 1).length;
    const libTopos = new Set(q.map((x) => x[1])), liTopos = new Set(q.map((x) => x[2]));
    checar(alto > 100 && meio >= 2 && libTopos.size === 1 && liTopos.size === 1,
      'L′ · a sub-aba ABRE DESLIZANDO (a altura passa pelo meio) e a lista NÃO anda: o topo do `#library` e o da '
      + 'primeira linha ficam no mesmo pixel em todos os quadros', { alto, meio, libTopos: [...libTopos], liTopos: [...liTopos] });
    const g = await pg.evaluate(() => {
      const ed = document.getElementById('itinEditor'), r = ed.getBoundingClientRect();
      const bar = document.getElementById('itinBar').getBoundingClientRect();
      const li = document.querySelector('#library > li.lib-item').getBoundingClientRect();
      const b = document.getElementById('itinNovoBtn');
      // O PONTO DA PRIMEIRA LINHA que a sub-aba cobre: quem responde é ela, não a linha.
      const y = Math.max(li.top + 4, r.top + 4);
      const quem = document.elementFromPoint(innerWidth / 2, Math.min(y, r.bottom - 4));
      return {
        topo: +(r.top - bar.bottom).toFixed(1), cobre: li.top < r.bottom, porCima: !!quem && ed.contains(quem),
        fundo: getComputedStyle(ed).backgroundColor, larg: Math.round(r.width), vw: innerWidth,
        l: +r.left.toFixed(1), dir: +r.right.toFixed(1), barW: Math.round(bar.width),
        exp: b.getAttribute('aria-expanded'), usos: [...b.querySelectorAll('use')].map((u) => u.getAttribute('href')),
        pintado: !/,\s*0\)$/.test(getComputedStyle(b).backgroundColor), titulo: b.title,
      };
    });
    checar(Math.abs(g.topo) <= 1 && g.cobre && g.porCima && !/,\s*0\)$/.test(g.fundo)
      && Math.abs(g.larg - g.barW) <= 1 && Math.abs((g.l + g.dir) / 2 - g.vw / 2) <= 1,
      'L′ · a sub-aba nasce na borda de BAIXO da faixa, na LARGURA dela e centrada (v1.14.54: ela desce de uma aba de '
      + '24rem, e um painel mais largo leria como outra peça), OPACA, e fica POR CIMA da primeira linha da lista', g);
    checar(antes.exp === 'false' && antes.ctl === 'itinEditor' && antes.usos === 0 && antes.pintado
      && g.exp === 'true' && g.usos.join() === '#icoExpandir' && !g.pintado && /fechar/i.test(g.titulo),
      'L′ · o `+` é o fechar: aberta a sub-aba ele vira a SETA (`#icoExpandir`, a da porta da faixa), SEM card, '
      + '`aria-expanded="true"` e o título "Fechar"', { antes, g });
    // O VOLTAR DO APARELHO a fecha — e a faixa fica. O fecho é medido pela ORDEM: o último
    // quadro com ela à vista já está perto de 0 (a lição da v1.14.49: o `padding` na conta).
    const v = await pg.evaluate(() => new Promise((ok) => {
      const ed = document.getElementById('itinEditor');
      const qs = [], t0 = performance.now();
      const consumiu = window.__avBack();
      const passo = () => {
        qs.push(ed.hidden ? -1 : Math.round(ed.getBoundingClientRect().height * 10) / 10);
        if (performance.now() - t0 < 500 && !ed.hidden) requestAnimationFrame(passo);
        else ok({ consumiu, qs, faixa: itinFaixaAberta && !document.getElementById('itinBar').hidden });
      };
      requestAnimationFrame(passo);
    }));
    const vis = v.qs.filter((h) => h >= 0);
    checar(v.consumiu === true && v.faixa && v.qs[v.qs.length - 1] === -1 && vis.length >= 3 && vis[vis.length - 1] < 6
      && vis.every((h, i) => i === 0 || h <= vis[i - 1]),
      'L′ · o VOLTAR do aparelho fecha a sub-aba (e só ela: a faixa fica aberta), ENCOLHENDO sem parar até perto de zero '
      + 'antes de sumir — com o `padding` (32 px) fora da conta ela pararia acima disso', v);
    // FECHAR A FAIXA LEVA A SUB-ABA JUNTO: o `+` que a fecha mora nela.
    await pg.click('#itinNovoBtn');
    await abrirFolha();
    await pg.click('#itinBarBtn');
    const junto = await esperar(pg, () => document.getElementById('itinEditor').hidden && document.getElementById('itinBar').hidden
      && !itinEditorAberto());
    checar(junto === true, 'L′ · recolher a faixa pela porta recolhe a sub-aba junto', porque(junto));
  }
  // O CINZA DOS BOTÕES NO TEMA CLARO (v1.14.52): *"os botões de opções do itinerário estão
  // ficando brancos ou transparentes, não ganhando o cinza que deveriam"*. No claro `--bar`
  // é branco e o `--surface` da base é branco com alfa (1,00:1); a faixa AFUNDA como a
  // `.bottombar`. A régua é o `.t-btn` do transporte, no MESMO tema — e o escuro não muda.
  await abrirFaixa();
  {
    const tons = await pg.evaluate(() => {
      const ler = () => ({
        tbtn: getComputedStyle(document.querySelector('.transport .t-btn')).backgroundColor,
        faixa: getComputedStyle(document.getElementById('itinBar')).backgroundColor,
        cinzas: [...document.querySelectorAll('#itinBar .itin-b')]
          .filter((b) => !b.classList.contains('itin-novo') && !(['itinTelaoBtn', 'itinMomentosBtn', 'itinHorasBtn'].includes(b.id) && !b.classList.contains('active')))
          .map((b) => getComputedStyle(b).backgroundColor),
      });
      const escuro = ler();
      setTema('claro');
      const claro = ler();
      setTema('escuro');
      return { escuro, claro };
    });
    const iguais = (t) => t.cinzas.length >= 3 && t.cinzas.every((c) => c === t.tbtn);
    checar(iguais(tons.claro) && iguais(tons.escuro) && tons.claro.tbtn !== tons.escuro.tbtn
      && !/^rgba\(255, 255, 255/.test(tons.claro.cinzas[0]),
      'L′ · no tema CLARO os botões cinzas da faixa pintam o MESMO cinza do `.t-btn` do transporte (e não o branco com '
      + 'alfa sobre a faixa branca); no escuro, idem', tons);
  }
  await pg.evaluate(async () => {
    for (const x of await AVDB.listItems('imports')) if (x.name === 'Linha de baixo') await AVDB.listRemove('imports', x.id);
    await load();
  });
  await fecharFaixa();

  // ── N. O TECLADO DA FOLHA NÃO MEXE NA BARRA DA BIBLIOTECA (v1.13.2) ──────
  // Relato do operador: ao confirmar um horário, a caixa de busca da Biblioteca
  // (a barra que repousa no topo da caixa de controles) subia e descia na tela.
  // O campo do título ENCOLHIA o app com o teclado (`--kb`): a barra subia com
  // ele e descia quando o confirmar tirava o foco do campo.
  {
    const topoDaBarra = () => pg.evaluate(() => Math.round(document.getElementById('libBar').getBoundingClientRect().top * 10) / 10);
    const antes = await topoDaBarra();
    await abrirFaixa();
    await pg.click('#itinNovoBtn');
    await abrirFolha();
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
      fundoDaFolha: Math.round(document.getElementById('itinEditor').getBoundingClientRect().bottom),
      okFundo: Math.round(document.getElementById('itinEditorOk').getBoundingClientRect().bottom),
      limite: innerHeight - 450,
    }));
    checar(rk === true && comTeclado.barra === antes && comTeclado.kb === '0px',
      'N · com o teclado no ar a barra de busca da Biblioteca NÃO sobe — o app por baixo não encolhe',
      { antes, comTeclado, r: porque(rk) });
    checar(comTeclado.fundoDaFolha <= comTeclado.limite + 1 && comTeclado.okFundo <= comTeclado.limite + 1,
      'N · e a sub-aba (com o confirmar), no alto da tela, termina ACIMA de onde o teclado começa', comTeclado);
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
  // A FAIXA ABERTA ANTES DE MEDIR A FILEIRA (v1.14.37): fechada, os comandos do momento não
  // são desenhados — a prova disso é do G′, onde há grupo e seta.
  await abrirFaixa();
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
        mais: !!li.querySelector('.row-mais'),
        acoes: [...li.querySelectorAll('.row > .row-acoes--solta > button')].map((b) => {
          const r = b.getBoundingClientRect();
          return { cls: b.className, vis: vis(b) && dentro(b), lado: Math.min(r.width, r.height), fundo: getComputedStyle(b).backgroundColor, esq: r.left, dir: r.right };
        }),
        hit: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hit')),
        fundoDaLinha: [li, li.querySelector('.row')].map((e) => getComputedStyle(e).backgroundColor),
        ordem: li.querySelectorAll('.row-ordem').length,
        novoFora: !document.getElementById('itinNovoBtn').closest('#library'),
        aoLado: li.parentElement.id === 'library',
      };
    });
    checar(anat.lib && anat.aoLado && anat.semCapa && anat.capasNaLista === 0,
      'B′ · a linha do momento é um item da MESMA lista (`#library > li.lib-item.momento`) e SEM capa (`.thumb`)', anat);
    checar(anat.hora === '09:00' && anat.horaVisivel && anat.nome === 'Recepção' && anat.nomeVisivel && !!anat.sub,
      'B′ · a hora (`.momento-hora`) e o título (`.row-name`) estão à vista, dentro da linha, com um subtítulo', anat);
    const transp = (c) => c === 'rgba(0, 0, 0, 0)' || c === 'transparent';
    checar(!anat.mais && anat.acoes.length === 2 && /itin-editar/.test(anat.acoes[0].cls) && /row-excluir/.test(anat.acoes[1].cls) && anat.acoes[1].esq >= anat.acoes[0].dir - 0.5
      && anat.acoes.every((a) => a.vis && a.lado >= anat.hit - 0.5 && transp(a.fundo)) && anat.ordem === 0 && anat.novoFora,
      'B′ · a linha NÃO tem `⋮`: editar · excluir (o excluir à DIREITA) ficam SEMPRE à vista, só o ícone, sem caixa e com o alvo `--hit` '
      + '(e nenhum par ↑↓); "Novo momento" mora na faixa, fora da lista', anat);
    checar(anat.fundoDaLinha.every(transp), 'B′ · e a linha do momento é SEM CARTÃO: nem o `li` nem a `.row` pintam fundo', anat.fundoDaLinha);
  }
  {
    const regs = await pg.evaluate(async () => (await AVDB.listItems('imports'))
      .map((r) => [r.kind, r.cue, r.name, r.data && r.data.min, ehMomento(r)].join(':')));
    checar(regs.join('|') === 'cue:momento:Recepção:540:true|cue:momento:Louvor:600:true|cue:momento:Sermão:630:true|cue:momento:Bênção:660:true',
      'B′ · cada momento é um registro `{ kind:"cue", cue:"momento", name, data:{ min } }` em `imports`, na ordem da lista', regs);
  }

  // EDITAR: tocar na linha abre a MESMA sub-aba, com o horário e o título dela.
  const idSermao = await idDe('Sermão');
  await pg.click('#library > li.momento[data-id="' + idSermao + '"] .row-name');
  await abrirFolha();
  {
    const e = await pg.evaluate(() => ({
      titulo: document.getElementById('itinEditorTitulo').textContent,
      rotulo: document.querySelector('#itinEditorOk .song-menu-label').textContent,
      campo: document.getElementById('itinCampoTitulo').value,
      valor: roletaValorDe(document.getElementById('itinRoleta_hora')) * 60
        + roletaValorDe(document.getElementById('itinRoleta_min')),
    }));
    checar(e.titulo === 'Editar momento' && e.rotulo === 'Salvar' && e.campo === 'Sermão' && e.valor === 630,
      'B′ · tocar na linha abre a sub-aba de EDIÇÃO ("Editar momento" / "Salvar") com o horário e o título dela', e);
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
  // EXCLUIR pelo ícone à vista (um toque de verdade, sem `⋮`): a pergunta é NA LINHA, sem diálogo.
  await pg.click('#library > li.momento[data-id="' + (await idDe('Bênção')) + '"] .row-excluir');
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

  // ── U. A FAIXA E A PORTA: anatomia, abrir, fechar, nada gravado ─────────
  const faixa = () => pg.evaluate(() => {
    const b = document.getElementById('itinBar');
    // A BARRA DO TOPO é procurada pelo NOME e não por vizinhança: desde a v1.14.54
    // a faixa vive DENTRO do `.list-body`, e o irmão anterior dela não é a barra.
    const topo = document.querySelector('.list-header');
    const porta = document.getElementById('itinBarBtn');
    const p = porta.querySelector('.itin-ponto');
    const nome = (e) => e.id || (e.classList.contains('itin-passo') ? 'passo' + e.textContent.trim() : e.className);
    const pressed = (id) => { const t = document.getElementById(id); return t && t.getAttribute('aria-pressed'); };
    const alt = (e) => Math.round(e.getBoundingClientRect().height * 10) / 10;
    return {
      aberta: !b.hidden && b.getClientRects().length > 0,
      filhos: [...b.querySelectorAll(':scope > .itin-secao > *')].map(nome),
      secoes: [...b.children].map((x) => [x.className, x.getAttribute('role'), x.getAttribute('aria-label'), x.children.length].join('|')),
      h: alt(b), hTopo: topo ? alt(topo) : -1,
      // NO TOPO DO `.list-body` E NO FLUXO (v1.14.55): ela é a primeira filha do
      // corpo, como antes da v1.14.54 era irmã da barra do topo dentro do `<main>`.
      // A GAVETA dos cronogramas é que é `absolute`.
      pai: b.parentElement && b.parentElement.className,
      dentroDoCorpo: !!b.parentElement && b.parentElement.classList.contains('list-body')
        && b.parentElement.contains(document.getElementById('library')),
      porta: {
        visivel: !porta.hidden && porta.getClientRects().length > 0, naBarra: porta.parentElement === topo,
        // A PORTA É A ÚNICA DA TRILHA 1 desde a v1.14.40 (o Importar foi para a
        // Biblioteca): quem vem DEPOIS dela é o título, e é assim que a barra se lê.
        antesDoTitulo: !!porta.nextElementSibling && porta.nextElementSibling.classList.contains('crono-par'),
        expandido: porta.getAttribute('aria-expanded'), controla: porta.getAttribute('aria-controls'),
      },
      ponto: !!p && !p.hidden && getComputedStyle(p).display !== 'none',
      noAr: b.classList.contains('no-ar'),
      telao: (() => { const t = document.getElementById('itinTelaoBtn'); return t && [t.getAttribute('aria-pressed'), t.disabled, t.textContent.trim()]; })(),
      momentos: pressed('itinMomentosBtn'), horas: pressed('itinHorasBtn'),
      ajuste: (() => { const t = document.getElementById('itinAjusteTxt'); return t && [t.disabled, t.classList.contains('deslocado')]; })(),
    };
  });
  // O DESENHO DA PORTA, medido na GEOMETRIA e não no nome do arquivo (v1.14.49,
  // Pacote 40): o operador trocou o relógio pela checklist e o ✕ pela seta, e o
  // card do estado aberto saiu. Um `<circle>` é relógio; um `<use href="#icoExpandir">`
  // é a seta; as marcas de conferido são QUATRO traços. O fundo é comparado pelo
  // ALFA, porque `background: none` computa `rgba(0, 0, 0, 0)` e é a ausência de
  // tinta que o pedido descreve ("apenas o ícone").
  const portaDesenho = () => pg.evaluate(() => {
    const b = document.getElementById('itinBarBtn');
    const ico = b.querySelector('.crono-itin-ico');
    const svg = ico.querySelector('svg');
    const fundo = getComputedStyle(b).backgroundColor;
    return {
      expandido: b.getAttribute('aria-expanded'),
      qual: ico.dataset.ico,
      circulos: svg.querySelectorAll('circle').length,
      usos: [...svg.querySelectorAll('use')].map((u) => u.getAttribute('href')),
      tracos: svg.querySelectorAll('path').length,
      fundo, pintado: !/,\s*0\)$/.test(fundo),
    };
  });
  await fecharFaixa();   // o B′ a abriu pelo "+" (e ela pode já ter se recolhido sozinha)
  const st0 = JSON.stringify(await banco());
  {
    const f = await faixa();
    checar(f.pai === 'list-body' && f.dentroDoCorpo,
      'U · a faixa mora DENTRO do `.list-body`, no TOPO dele e NO FLUXO (v1.14.55) — ela empurra a lista para '
      + 'baixo —, e não mais no fluxo do `<main>`', f);
    checar(!f.aberta && f.filhos.length === 0 && f.porta.visivel && f.porta.naBarra && f.porta.antesDoTitulo
      && f.porta.expandido === 'false' && f.porta.controla === 'itinBar' && !f.ponto,
      'U · RECOLHIDA a faixa não desenha nada (vazia, `hidden`); a porta `#itinBarBtn` mora NA barra, logo ANTES do '
      + 'título (`aria-expanded="false"`, `aria-controls="itinBar"`), sem o ponto (nada no ar)', f);
    const p0 = await portaDesenho();
    checar(p0.qual === 'lista' && p0.circulos === 0 && p0.usos.length === 0 && p0.tracos === 4
      && p0.expandido === 'false' && p0.pintado === false,
      'U · FECHADA a porta desenha a CHECKLIST — quatro traços, nenhum círculo de relógio — sobre o fundo '
      + 'chapado: o desenho é o do recurso, e não o da hora', p0);
  }
  await abrirFaixa();
  {
    const f = await faixa();
    checar(f.aberta && f.porta.expandido === 'true'
      && f.filhos.join(' ') === 'itinNovoBtn itinTelaoBtn itinMomentosBtn itinHorasBtn passo−5 itinAjusteTxt passo+5',
      'U · a porta ABRE a faixa com os sete, na ordem (v1.14.52: o criar no extremo esquerdo): Novo · Telão · Momentos · Horários · −5 · ajuste · +5 '
      + '(sem o ±1 e sem botão de recolher; os "−" são U+2212)', f);
    const p1 = await portaDesenho();
    checar(p1.qual === 'seta' && p1.usos.join() === '#icoExpandir' && p1.tracos === 0
      && p1.expandido === 'true' && p1.pintado === false,
      'U · ABERTA ela vira a SETA para cima (`#icoExpandir`, o chevron de recolher das seções) e NÃO veste '
      + 'card: o estado mora no `aria-expanded`, no desenho e na faixa à vista', p1);

    // ===== TODOS OS ÍCONES DA FAIXA NO MESMO TAMANHO (v1.14.49) =====
    // Relato do operador: *"o tamanho dos icones dos botões de configurações do itinerário
    // estão fora de padrão … Em especial acredito que os botões de atraso estão com icones
    // menores"*. A régua é a dos botões de controle: `--icon-md` (o `.t-btn .msym` do
    // transporte). Os cinco desenhados são SVG; os dois do ±5 são TEXTO e mediam 11,84 px
    // no tamanho de rótulo — é o defeito. O `#itinAjusteTxt` NÃO entra: ele é rótulo
    // ("No horário"), não ícone.
    const icones = await pg.evaluate(() => {
      const md = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--icon-md')) || 22;
      return { md, celulas: [...document.querySelectorAll('#itinBar .itin-b')].map((b) => {
        const svg = b.querySelector('svg');
        return { nome: b.id || (b.classList.contains('itin-passo') ? 'passo' : 'ajuste'),
          svg: svg ? Math.round(parseFloat(getComputedStyle(svg).width) * 10) / 10 : null,
          fonte: Math.round(parseFloat(getComputedStyle(b).fontSize) * 10) / 10 };
      }) };
    });
    const semRegua = icones.celulas.filter((c) => c.nome !== 'itinAjusteTxt'
      && !(c.svg !== null ? Math.abs(c.svg - icones.md) <= 0.5 : Math.abs(c.fonte - icones.md) <= 0.5));
    checar(icones.md > 0 && icones.celulas.length === 7 && semRegua.length === 0,
      'U · todos os ícones da faixa medem `--icon-md` (' + icones.md + 'px), o padrão dos botões de controle — inclusive '
      + 'os dois do ±5, que são TEXTO e mediam o tamanho de rótulo', { semRegua, icones });
    checar(f.secoes.join(' / ') === 'itin-secao itin-secao--criacao|group|Criar|1 / itin-secao itin-secao--estado|group|Estado do itinerário|3 / '
      + 'itin-secao itin-secao--atraso|group|Atraso|3',
      'U · e os sete moram em TRÊS seções (`role="group"`, cada uma com o nome dela): Criar [1] · Estado [3] · Atraso [3]', f.secoes);
    checar(f.telao[0] === 'false' && f.telao[1] === false && f.telao[2] === '' && f.momentos === 'true' && f.horas === 'true'
      && f.ajuste[0] === true && f.ajuste[1] === false,
      'U · estado inicial: o olho do telão (SÓ o ícone) desligado e aceso, os momentos à vista, horários ligados, atraso apagado', f);
    // ===== O PADRÃO DO DECK (Pacote 37) =====
    // Pedido do operador: a faixa tem de ser *"exatamente o mesmo padrão de design dos
    // botões lá da linha de controles do player: fundo da aba com uma cor, botões
    // cinzas, desativados em vermelho... Deixe apenas o botão de criar momento em azul"* —
    // e, na segunda rodada (16/11), *"os botões que devem ficar vermelhos não são os de
    // atraso, mas sim os 3 de estado, que tecnicamente ligam e desligam elementos"*.
    // A régua é o PAR RENDERIZADO do `.bottombar`: a caixa pinta `--bar`, os botões
    // pintam `--surface` (o cartão do `.t-btn`), o LIGADO pinta `--btn-accent` (o par do
    // `#repeat.active`), o DESLIGADO dos três interruptores pinta `--btn-danger` +
    // `--danger-strong` (o par do volume mudo e do wallpaper alternado) e SÓ o `+` pinta
    // `--accent-fill`.
    const coresEm = () => pg.evaluate(() => {
      const lum = (c) => { const v = c.match(/[\d.]+/g).slice(0, 3).map((x) => { const s = Number(x) / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
      const razao = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
      const sonda = (token) => { const p = document.createElement('i'); p.style.background = 'var(' + token + ')';
        document.body.appendChild(p); const c = getComputedStyle(p).backgroundColor; p.remove(); return c; };
      const c = (b) => getComputedStyle(b);
      const novo = document.getElementById('itinNovoBtn'), cs = c(novo);
      return {
        barra: sonda('--bar'), cartao: sonda('--surface'), ligado: sonda('--surface'),
        acento: sonda('--accent-fill'), alerta: sonda('--btn-danger'), alertaCor: sonda('--danger-strong'),
        fundo: c(document.getElementById('itinBar')).backgroundColor,
        botoes: [...document.querySelectorAll('#itinBar .itin-b')].map((b) => ({
          nome: b.id || (b.classList.contains('itin-passo') ? 'passo' : 'ajuste'),
          active: b.classList.contains('active'), novo: b.classList.contains('itin-novo'),
          bg: c(b).backgroundColor, fg: c(b).color, op: +c(b).opacity })),
        novo: [cs.backgroundColor, cs.color], contraste: +razao(cs.backgroundColor, cs.color).toFixed(2),
      };
    });
    const ESTADO = ['itinTelaoBtn', 'itinMomentosBtn', 'itinHorasBtn'];
    const cores = await coresEm();
    const estado = cores.botoes.filter((b) => ESTADO.includes(b.nome));
    const resto = cores.botoes.filter((b) => !ESTADO.includes(b.nome) && !b.novo);
    checar(cores.fundo === cores.barra && cores.botoes.length === 7 && estado.length === 3
      && estado.filter((b) => b.active).length === 2
      && estado.filter((b) => b.active).every((b) => b.bg === cores.ligado)
      && estado.filter((b) => !b.active).every((b) => b.bg === cores.alerta)
      && resto.length === 3 && resto.every((b) => b.bg === cores.cartao && !/rgba\(0, 0, 0, 0\)$/.test(b.bg))
      && cores.novo[0] === cores.acento && !/rgba\(0, 0, 0, 0\)$/.test(cores.novo[0]) && cores.contraste >= 4.5
      && cores.botoes.filter((b) => b.bg === cores.acento).map((b) => b.nome).join() === 'itinNovoBtn',
      'U · o padrão do DECK: a faixa pinta `--bar`; os TRÊS de estado pintam o CINZA `--surface` do `.t-btn` LIGADOS '
      + '(16/11: nada de azul antes do vermelho) e `--btn-danger` DESLIGADOS; o ±5 e o ajuste pintam o CARTÃO `--surface`; e SÓ o "+" é `--accent-fill` '
      + '(texto acima de 4,5:1)', cores);
    // E O DESATIVADO NÃO É VERMELHO: o atraso em "No horário" é uma LEITURA (cartão e
    // tinta `--muted`, 5,5:1), e o ±5 no extremo fica APAGADO pelo véu do deck.
    const apagado = await pg.evaluate(() => {
      const t = document.getElementById('itinAjusteTxt');
      const st = getComputedStyle(t);
      return { off: t.disabled, op: +st.opacity, cor: st.color, fundo: st.backgroundColor };
    });
    checar(apagado.off === true && apagado.op === 1 && !/249, 122, 126/.test(apagado.cor)
      && !/93, 40, 46/.test(apagado.fundo),
      'U · o ajuste em "No horário" é leitura e não ação: cartão `--surface`, tinta `--muted` e opacidade 1 — '
      + 'nada de vermelho', apagado);

    // A FOLGA DE CIMA E DE BAIXO (16/11: *"coloque uma pequena margem entre os botões e a
    // borda da caixa"*): o botão fica a `--deck-gap` das duas bordas da faixa — o mesmo
    // vão que separa dois vizinhos. O teto "mais baixa que a barra do topo" da v1.14.36
    // cedeu a este pedido.
    const folga = await pg.evaluate(() => {
      const b = document.getElementById('itinBar').getBoundingClientRect();
      const t = document.getElementById('itinTelaoBtn').getBoundingClientRect();
      const px = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      return { cima: +(t.top - b.top).toFixed(1), baixo: +(b.bottom - t.bottom).toFixed(1),
        gap: +(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--deck-gap')) * px).toFixed(1) };
    });
    checar(f.h > 0 && folga.gap > 0 && Math.abs(folga.cima - folga.gap) <= 0.6 && Math.abs(folga.baixo - folga.gap) <= 0.6,
      'U · aberta, os botões ficam a `--deck-gap` das bordas de CIMA e de BAIXO da faixa (nada colado na caixa)', folga);
  }
  // A ANIMAÇÃO DE ABERTURA (pedido de 15/11): a faixa desce um degrau e acende. A régua é a
  // ANIMAÇÃO VIVA e os quadros intermediários — e quem pediu menos movimento no sistema não a vê.
  await pg.click('#itinBarBtn');
  await esperar(pg, () => !itinFaixaAberta && !itinFaixaAnimando);
  await pg.click('#itinBarBtn');
  {
    const a = await pg.evaluate(() => {
      const b = document.getElementById('itinBar');
      const an = b.getAnimations().filter((x) => x.animationName === 'itin-abre');
      return { n: an.length, ms: an[0] ? an[0].effect.getTiming().duration : 0, estado: an[0] ? an[0].playState : null };
    });
    checar(a.n === 1 && a.ms >= 120 && a.ms <= 400 && a.estado === 'running',
      'U · a faixa ABRE ANIMANDO: a abertura (`itin-abre`) está viva, com a duração de `--dur-media`', a);
    const quadros = await pg.evaluate(() => new Promise((ok) => {
      const b = document.getElementById('itinBar'), vistos = [], t0 = performance.now();
      const passo = () => {
        vistos.push(+(+getComputedStyle(b).opacity).toFixed(3));
        if (performance.now() - t0 < 320) requestAnimationFrame(passo); else ok(vistos);
      };
      requestAnimationFrame(passo);
    }));
    const meio = quadros.filter((o) => o > 0.02 && o < 0.98);
    checar(meio.length >= 2, 'U · e ela atravessa quadros INTERMEDIÁRIOS (a faixa acende, não aparece de uma vez)',
      { quadros, meio });
    await pg.emulateMedia({ reducedMotion: 'reduce' });
    await pg.click('#itinBarBtn');
    await esperar(pg, () => !itinFaixaAberta && !itinFaixaAnimando);
    await pg.click('#itinBarBtn');
    {
      const r = await pg.evaluate(() => document.getElementById('itinBar').getAnimations()
        .filter((x) => x.animationName === 'itin-abre').length);
      checar(r === 0, 'U · e com `prefers-reduced-motion` a faixa NÃO anima: aparece direto', r);
    }
    await pg.emulateMedia({ reducedMotion: 'no-preference' });
  }
  // ===== O FECHO ENCOLHE ATÉ O FIM ANTES DE SUMIR (v1.14.49) =====
  // Relato do operador: *"aba está abrindo e fechando de forma trancada, como se ela
  // encolhesse menos que o necessário antes de desaparecer derrepente. Parece que ela para
  // de encolher antes, desaparecendo ainda há vista."* O repouso era um prazo fixo
  // (`--dur-media` + 40 ms) e cortava a transição — MEDIDO: o `transitionend` da altura
  // chegava aos 225 ms numa execução e depois dos 240 numa mais lenta, e ali a faixa era
  // escondida com ~11 px de altura. A prova é a ORDEM: o fim da transição tem de ser
  // visto ANTES do `hidden`; com o prazo cortando, a transição é CANCELADA e o
  // `transitionend` nunca chega.
  const fecho = await pg.evaluate(() => new Promise((ok) => {
    const b = document.getElementById('itinBar');
    const marcos = { fim: null, oculto: null, alturas: [], t0: 0 };
    marcos.t0 = performance.now();
    b.addEventListener('transitionend', (e) => {
      if (e.target === b && e.propertyName === 'height' && marcos.fim === null) marcos.fim = Math.round(performance.now() - marcos.t0);
    });
    const mo = new MutationObserver(() => {
      if (!b.hidden) return;
      marcos.oculto = Math.round(performance.now() - marcos.t0);
      mo.disconnect();
      ok(marcos);
    });
    mo.observe(b, { attributes: true, attributeFilter: ['hidden'] });
    document.getElementById('itinBarBtn').click();
    const passo = () => {
      if (b.hidden) return;
      marcos.alturas.push(Math.round(b.getBoundingClientRect().height * 10) / 10);
      requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
    setTimeout(() => { mo.disconnect(); ok(marcos); }, 1500);
  }));
  const ultimaAltura = fecho.alturas.length ? fecho.alturas[fecho.alturas.length - 1] : null;
  checar(fecho.fim !== null && fecho.oculto !== null && fecho.oculto >= fecho.fim && fecho.alturas.length > 2
    && ultimaAltura !== null && ultimaAltura <= 2,
    'U · o FECHO chega ao fim da transição ANTES de a faixa sumir: o `hidden` vem depois do `transitionend` da '
    + 'altura, e o último quadro à vista está em ~0 (o prazo de 240 ms cortava com ~11 px)',
    { fim: fecho.fim, oculto: fecho.oculto, quadros: fecho.alturas.length, ultimaAltura, ultimas: fecho.alturas.slice(-3) });
  await fecharFaixa();
  {
    const f = await faixa();
    const st = await banco();
    checar(!f.aberta && f.filhos.length === 0 && f.porta.expandido === 'false',
      'U · a porta de novo a RECOLHE: vazia e `hidden`, `aria-expanded="false"`', f);
    checar(JSON.stringify(st) === st0 && !('barraOculta' in (st || {})),
      'U · abrir e fechar NÃO grava nada: `state.itinerario` igual ao de antes, e sem `barraOculta`', { antes: st0, depois: st });
  }
  // O VERMELHO SEGUE O INTERRUPTOR (Pacote 37, 2ª rodada). Fica AQUI, e não junto da
  // leitura das cores, porque o toque nos MOMENTOS grava (`saveItin`) — e a régua de
  // "abrir e fechar não grava nada", logo acima, compara o estado guardado.
  await abrirFaixa();
  {
    const ler = () => pg.evaluate(() => {
      const sonda = (t) => { const p = document.createElement('i'); p.style.background = 'var(' + t + ')';
        document.body.appendChild(p); const c = getComputedStyle(p).backgroundColor; p.remove(); return c; };
      const b = (n) => document.getElementById(n);
      return { alerta: sonda('--btn-danger'), ligado: sonda('--surface'),
        telao: getComputedStyle(b('itinTelaoBtn')).backgroundColor,
        momentos: getComputedStyle(b('itinMomentosBtn')).backgroundColor,
        horas: getComputedStyle(b('itinHorasBtn')).backgroundColor };
    });
    const antes = await ler();
    await pg.click('#itinMomentosBtn');
    await esperar(pg, () => !itinTrocando);
    const ocultos = await ler();
    await pg.click('#itinMomentosBtn');
    await esperar(pg, () => !itinTrocando);
    const voltou = await ler();
    checar(antes.momentos === antes.ligado && ocultos.momentos === ocultos.alerta
      && ocultos.telao === ocultos.alerta && ocultos.horas === ocultos.ligado
      && voltou.momentos === voltou.ligado,
      'U · o vermelho SEGUE o interruptor, nos dois sentidos: com os momentos à vista ele é o cinza do deck (ligado); '
      + 'ocultos, vira o vermelho do volume — o do telão continua (fora do ar) e o dos horários fica cinza',
      { antes, ocultos, voltou });
    // OS TRÊS DIZEM "DESLIGADO" DO MESMO JEITO (16/11): o desenho riscado (`…Off`, o risco
    // `M3 3.5 21 20.5`) junto do vermelho — inclusive as HORAS, que eram o relógio sem risco.
    const desenho = () => pg.evaluate(() => ['itinTelaoBtn', 'itinMomentosBtn', 'itinHorasBtn']
      .map((id) => { const u = document.querySelector('#' + id + ' use'); return u ? u.getAttribute('href') : null; }));
    const ligadas = await desenho();
    await pg.evaluate(() => itinSetHoras(false));
    await esperar(pg, () => !!document.querySelector('#itinHorasBtn use[href="#icoHorasOff"]'));
    const semHoras = await pg.evaluate(() => {
      const b = document.getElementById('itinHorasBtn');
      return { href: b.querySelector('use').getAttribute('href'), bg: getComputedStyle(b).backgroundColor,
        risco: !!document.querySelector('#icoHorasOff path[d="M3 3.5 21 20.5"]') };
    });
    await pg.evaluate(() => itinSetHoras(true));
    await esperar(pg, () => !!document.querySelector('#itinHorasBtn use[href="#icoHoras"]'));
    checar(ligadas[2] === '#icoHoras' && semHoras.href === '#icoHorasOff' && semHoras.risco
      && semHoras.bg === voltou.alerta && ligadas[0] === '#icoTelaOff' && ligadas[1] === '#icoMomentos',
      'U · as HORAS no telão seguem o padrão dos outros dois: desligadas, o relógio RISCADO (`icoHorasOff`, o mesmo '
      + 'risco do monitor e da pauta) sobre o vermelho; ligadas, o relógio limpo no cinza', { ligadas, semHoras });
    // O TELÃO É UM MONITOR, RISCADO QUANDO FORA DO AR (v1.14.49, Pacote 40): pedido do operador,
    // *"um icone de monitor, que se altera entre riscado e não riscado. Ele fica mais claro sua
    // função assim"*. O olho saiu do sprite junto (um `<symbol>` sem consumidor viaja no bundle),
    // e o que se afirma é a GEOMETRIA: a caixa do monitor e o risco, um par a mais do app.
    const monitor = await pg.evaluate(() => {
      const b = document.getElementById('itinTelaoBtn');
      const u = b.querySelector('use');
      const href = u ? u.getAttribute('href') : null;
      const sim = href ? document.querySelector(href) : null;
      return { href, caixa: !!sim && sim.querySelectorAll('rect').length === 1,
        risco: !!sim && !!sim.querySelector('path[d="M3 3.5 21 20.5"]'),
        olho: !!document.querySelector('#icoOlho, #icoOlhoOff'),
        pressed: b.getAttribute('aria-pressed'), desabilitado: b.disabled };
    });
    checar(monitor.href === '#icoTelaOff' && monitor.caixa && monitor.risco && monitor.olho === false
      && monitor.pressed === 'false' && monitor.desabilitado === false,
      'U · o TELÃO desenha um MONITOR (a caixa do `icoTela`) com o risco do "desligado", e o par do olho saiu do '
      + 'sprite; o `aria-pressed` e o estado sem momentos continuam os de antes', monitor);
  }
  // A RECARGA: abrir não é escolha guardada — aberta antes de recarregar, ela volta RECOLHIDA.
  await abrirFaixa();
  await recarregar();
  {
    const vis = await esperar(pg, () => !document.getElementById('itinBarBtn').hidden);
    const f = await faixa();
    checar(vis === true && !f.aberta && f.filhos.length === 0 && f.porta.visivel && f.porta.expandido === 'false',
      'U · aberta antes de RECARREGAR, a faixa volta RECOLHIDA (o app abre sempre assim), com a porta à vista', { f, vis: porque(vis) });
    checar((await lista()).join(' · ') === '09:00 Recepção · 10:00 Louvor · 10:40 Pregação',
      'B′ · depois de RECARREGAR, os momentos voltam do banco, na mesma ordem', await lista());
  }
  // NENHUM BOTÃO PASSA DA BORDA: em 320, 360 e 430 de largura, com o atraso mais
  // largo escrito (+45). A escrita (longa ou curta) é escolhida pela
  // consulta de contêiner do CSS: uma das duas, nunca as duas nem nenhuma.
  await abrirFaixa();
  await pg.evaluate(() => itinAjustar(45));
  await esperar(pg, () => document.getElementById('itinAjusteTxt').classList.contains('deslocado'));
  for (const w of [320, 360, 430]) {
    await pg.setViewportSize({ width: w, height: 800 });
    await esperar(pg, (x) => innerWidth === x, w);
    await abrirFaixa();
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
        // O NÚMERO DO ATRASO NA RÉGUA DO ±5 (v1.14.52): mesma fonte e mesma caixa de texto.
        num: (() => {
          const caixa = (el) => { const g = document.createRange(); g.selectNodeContents(el); const r = g.getBoundingClientRect(); return [+r.top.toFixed(1), +r.height.toFixed(1)]; };
          const n = [...b.querySelectorAll('#itinAjusteTxt .itin-num')].find((e) => e.getClientRects().length);
          const p = b.querySelector('.itin-passo');
          return n && { fonte: getComputedStyle(n).fontSize, fonteP: getComputedStyle(p).fontSize, caixa: caixa(n), caixaP: caixa(p),
            texto: n.textContent, corta: n.getBoundingClientRect().right > b.querySelector('#itinAjusteTxt').getBoundingClientRect().right + 0.5 };
        })(),
        // A BARRA DO TOPO pelo NOME: desde a v1.14.54 a faixa é filha do `.list-body` e
        // não tem a `.list-header` como irmã anterior.
        h: Math.round(rb.height * 10) / 10, hTopo: Math.round(document.querySelector('.list-header').getBoundingClientRect().height * 10) / 10,
        // A FILEIRA (Pacote 37): as TRÊS seções continuam no DOM (`role="group"`,
        // `display: contents` — elas não têm caixa), então o que se mede são os SETE
        // botões: uma linha, o MESMO vão entre vizinhos quaisquer (o do `.transport`
        // do deck), as células de ícone do mesmo tamanho e a do atraso mais larga.
        fileira: (() => {
          const els = [...b.querySelectorAll('.itin-b')];
          const r = els.map((e) => e.getBoundingClientRect());
          const px = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
          return {
            n: els.length,
            tops: [...new Set(r.map((x) => Math.round(x.top)))],
            vaos: r.slice(1).map((x, i) => +(x.left - r[i].right).toFixed(1)),
            vao: +(parseFloat(getComputedStyle(b).columnGap) || 0).toFixed(1),
            larguras: r.map((x) => Math.round(x.width * 10) / 10),
            alturas: r.map((x) => Math.round(x.height * 10) / 10),
            piso: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hit')) || 0,
            gapDeck: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--deck-gap')) * px || 0,
            secoesNoDom: b.children.length,
          };
        })(),
      };
    });
    checar(g.n === 7 && g.passaram.length === 0 && g.semLargura.length === 0 && g.rolagem <= 1,
      'U · em ' + w + 'px de largura NENHUM dos sete botões da faixa passa da borda da faixa (e a faixa não rola)', g);
    checar(g.noRecuo.length === 0,
      'U · e em ' + w + 'px nenhum botão invade o recuo da direita (o `padding` da faixa)', g);
    checar(g.longo !== g.curto, 'U · em ' + w + 'px o atraso aparece em UMA escrita só (longa ou curta)', g);
    // A 320px a aba tem a largura da GAVETA (24rem) e a célula do atraso ficou ~6px mais
    // estreita que a da faixa sangrada: a fonte larga do runner CORTARIA o "+45" a 22px, e
    // a regra de contêiner da aba o deixa um degrau menor ali (o ±5 segue a 22). Acima de
    // 300px de aba — de 360 de tela para cima — vale a igualdade estrita.
    const cedido = w <= 320 ? 4 : 0;
    checar(!!g.num && Math.abs(parseFloat(g.num.fonte) - (parseFloat(g.num.fonteP) - cedido)) <= 0.5
      && Math.abs(g.num.caixa[1] - g.num.caixaP[1]) <= (cedido ? 7 : 0.5)
      && Math.abs(g.num.caixa[0] - g.num.caixaP[0]) <= (cedido ? 4 : 1)
      && g.num.texto === '+45' && !g.num.corta,
      'U · em ' + w + 'px o NÚMERO do atraso ("+45") fica na mesma linha e SEM CORTE, com a fonte e a caixa do ±5'
      + (cedido ? ' (a 320px ele cede um degrau: a aba na largura da gaveta é ~6px mais estreita na célula)' : ''),
      g.num);
    // A UMA LINHA VALE DE 360 PARA CIMA. A 320 ela é o que a fonte do SISTEMA decide, e o
    // CI prova isso: com a fonte do runner as três seções não cabem e a faixa quebra — a
    // quebra é a resposta prevista do `flex-wrap` (quem desce é a SEÇÃO inteira). O que se
    // cobra a 320 é o que o desenho garante em qualquer fonte: nenhuma seção PARTIDA entre
    // duas linhas, as seções que dividem a linha com o vão ENTRE maior que o DENTRO, e nada
    // passando da borda (as duas asserções acima).
    // A FILEIRA É UMA SÓ, COMO A DO DECK (Pacote 37). O que se cobra em TODA largura:
    // os sete numa linha, o mesmo vão entre vizinhos (o `--deck-gap` do transporte),
    // as seis células de ícone do mesmo tamanho, nenhuma abaixo do piso de toque e a
    // do atraso mais larga — é ela que carrega texto, não um ícone. A faixa continua
    // mais baixa que a barra do topo, que é o teto de altura da segunda linha.
    const seis = g.fileira.larguras.filter((_, i) => i !== 5);
    checar(g.fileira.n === 7 && g.fileira.tops.length === 1
      && g.fileira.vaos.length === 6 && g.fileira.vaos.every((x) => Math.abs(x - g.fileira.vao) <= 0.5)
      && Math.abs(g.fileira.vao - g.fileira.gapDeck) <= 0.5
      && Math.max(...seis) - Math.min(...seis) <= 0.5
      && Math.min(...g.fileira.larguras) >= g.fileira.piso - 0.5
      && g.fileira.larguras[5] > Math.max(...seis)
      && new Set(g.fileira.alturas).size === 1,
      'U · em ' + w + 'px os SETE ficam numa linha só, com o MESMO vão entre vizinhos (o do deck, ' + g.fileira.vao
      + 'px), as seis células de ícone do mesmo tamanho e a do ATRASO mais larga; todas com a MESMA altura, nenhuma '
      + 'abaixo do piso de toque', { fileira: g.fileira, seis });
    checar(g.h > 0 && g.h < 2 * g.hTopo,
      'U · em ' + w + 'px a faixa cabe numa LINHA (bem menos que duas alturas da barra do topo)', { h: g.h, hTopo: g.hTopo });
  }
  await pg.setViewportSize({ width: 360, height: 800 });
  await esperar(pg, () => innerWidth === 360);
  await pg.evaluate(() => itinAjusteZerar());

  // ── Z. A FAIXA DESLOCA A LISTA, E TEM A LARGURA DA GAVETA (v1.14.55) ────
  //
  // Pedido do operador: *"o design da barra de configurações do itinerário ficou
  // bom, mas infelizmente vamos ter de voltar ao menos com o deslocamento do
  // cronograma para a abertura de espaço para essa barra de opções. Mantenha todo
  // o design e a concorrência com a aba do cronograma, apenas para ela, ela
  // desloca a lista do cronograma para não ficar em cima de nada."*
  //
  // A régua da largura é a GAVETA MEDIDA, não um número escrito; a da posição é
  // o `--sp-3` do CSS; e "desloca" é o topo do `#library` ANDANDO na abertura —
  // a altura da faixa mais a margem de `--sp-3`, com a lista começando na BORDA
  // DE BAIXO dela. A âncora da sub-aba (`--itin-barra-base`) continua sendo a
  // borda de baixo da faixa, e sem ela a sub-aba nasceria em cima da aba.
  {
    await fecharFaixa();
    const antes = await pg.evaluate(() => {
      const gav = (() => {
        abrirCronoGaveta();
        const r = document.getElementById('cronoGaveta').getBoundingClientRect();
        fecharCronoGaveta();
        return r.width;
      })();
      return { lista: document.getElementById('library').getBoundingClientRect().top, gav };
    });
    await abrirFaixa();
    const z = await pg.evaluate(() => {
      const bar = document.getElementById('itinBar').getBoundingClientRect();
      const lib = document.getElementById('library').getBoundingClientRect();
      const corpo = document.querySelector('.list-body').getBoundingClientRect();
      const raiz = getComputedStyle(document.documentElement);
      return {
        bar: { t: bar.top, b: bar.bottom, l: bar.left, r: bar.right, w: bar.width, h: bar.height },
        lista: lib.top, corpoTopo: corpo.top, tela: innerWidth,
        sp3: parseFloat(raiz.getPropertyValue('--sp-3')) * parseFloat(raiz.fontSize),
        base: parseFloat(document.querySelector('.list-body').style.getPropertyValue('--itin-barra-base')),
      };
    });
    const centro = (z.bar.l + z.bar.r) / 2;
    const desceu = z.lista - antes.lista;
    checar(Math.abs(desceu - (z.bar.h + z.sp3)) <= 0.5
      && Math.abs(z.bar.w - antes.gav) <= 1
      && Math.abs(centro - z.tela / 2) <= 1
      && Math.abs((z.bar.t - z.corpoTopo) - z.sp3) <= 0.5
      && Math.abs(z.lista - z.bar.b) <= 0.5
      && Math.abs(z.base - (z.sp3 + z.bar.h)) <= 0.5,
      'Z · a faixa DESLOCA a lista: abrir moveu o topo do `#library` ' + desceu.toFixed(1) + 'px (a altura da faixa + o '
      + '`--sp-3`), e a lista agora começa na BORDA DE BAIXO dela (nada coberto). A largura é a da gaveta dos cronogramas ('
      + z.bar.w.toFixed(1) + 'px), centrada, e a âncora da sub-aba é a borda de baixo da faixa', { antes, z });
  }
  // E AS DUAS ABAS SÃO CONCORRENTES: abrir uma fecha a outra. O caminho da gaveta
  // é o `abrirCronoGaveta`; o da faixa é a porta (que também é a saída das folhas,
  // v1.14.53) — e o toque REAL na porta com a gaveta aberta cai no VÉU dela, que a
  // fecha primeiro: por isso a prova do segundo sentido chama a porta pelo DOM.
  {
    await abrirFaixa();
    const conc = await pg.evaluate(async () => {
      const z = (ms) => new Promise((f) => setTimeout(f, ms));
      abrirCronoGaveta(); await z(320);
      return { gaveta: cronoGavetaAberta(), faixa: itinFaixaAberta, bar: document.getElementById('itinBar').getClientRects().length };
    });
    const conc2 = await pg.evaluate(async () => {
      const z = (ms) => new Promise((f) => setTimeout(f, ms));
      document.getElementById('itinBarBtn').click(); await z(420);
      return { gaveta: cronoGavetaAberta(), faixa: itinFaixaAberta, bar: document.getElementById('itinBar').getClientRects().length };
    });
    checar(conc.gaveta && !conc.faixa && conc.bar === 0 && !conc2.gaveta && conc2.faixa && conc2.bar > 0,
      'Z · as DUAS ABAS SÃO CONCORRENTES: abrir a gaveta dos cronogramas recolhe a faixa, e abrir a faixa fecha a '
      + 'gaveta — nunca as duas abertas', { conc, conc2 });
    await fecharFaixa();
  }

  // ── Y. A FAIXA NÃO SE FECHA SOZINHA (v1.14.37) ──────────────────────────
  // Pedido do operador: *"a aba de configurações de itinerário não se fecha automaticamente"*.
  // O fecho de 5 s da v1.14.35 saiu: aberta, ela FICA aberta até o toque na porta da barra —
  // nem o tempo, nem a sub-aba do momento a fecham. A classe `itin-faixa-aberta` do `<body>` é o que
  // o CSS lê para desenhar (ou não) o lápis e a lixeira do momento.
  await fecharFaixa();
  await ctx.clock.pauseAt(new Date((await pg.evaluate(() => Date.now())) + 1000));
  const faixaAberta = () => pg.evaluate(() => !document.getElementById('itinBar').hidden
    && document.getElementById('itinBarBtn').getAttribute('aria-expanded') === 'true');
  const abrirPelaPorta = () => pg.evaluate(() => document.getElementById('itinBarBtn').click());
  {
    const y = {};
    await abrirPelaPorta();
    y.abriu = await faixaAberta();
    y.classe = await pg.evaluate(() => document.body.classList.contains('itin-faixa-aberta'));
    await ctx.clock.runFor(20000); y.aos20 = await faixaAberta();
    await pg.evaluate(() => document.getElementById('itinNovoBtn').click());
    await ctx.clock.runFor(6000);
    y.folha = await pg.evaluate(() => itinEditorAberto() && !document.getElementById('itinEditor').hidden);
    await pg.evaluate(() => document.getElementById('itinNovoBtn').click());
    await ctx.clock.runFor(1000);
    y.depoisDaFolha = await faixaAberta();
    await abrirPelaPorta();
    y.fechouPelaPorta = await faixaAberta();
    y.classeFinal = await pg.evaluate(() => document.body.classList.contains('itin-faixa-aberta'));
    checar(y.abriu && y.classe && y.aos20 && y.folha && y.depoisDaFolha && !y.fechouPelaPorta && !y.classeFinal,
      'Y · a faixa NÃO se fecha sozinha: 20 s depois ela continua aberta (e a sub-aba do momento não a fecha); '
      + 'só a porta da barra a recolhe, e a classe do `<body>` acompanha', y);
  }
  await ctx.clock.resume();

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
  // O BANCO COM OS HORÁRIOS (`nome@min` nos momentos) e o ARRASTO REAL de uma linha: segura no meio
  // dela, conta o que levantou (o momento leva o grupo) e solta na altura `alvoY` das linhas em repouso.
  const bancoMin = () => pg.evaluate(async () => (await AVDB.listItems('imports'))
    .map((r) => r.name + (ehMomento(r) ? '@' + r.data.min : '')).join());
  const linhasDaTela = () => pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('#library > li.lib-item')]
    .map((li) => { const b = li.getBoundingClientRect();
      return [li.querySelector('.row-name').textContent, { top: b.top, bottom: b.bottom, x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) }]; })));
  const arrastar = async (nome, alvoY) => {
    const g = await linhasDaTela();
    await pg.mouse.move(g[nome].x, g[nome].y);
    await pg.mouse.down();
    const levantou = await esperar(pg, () => !!document.querySelector('#library > .lib-item.arrastando'), null, 4000);
    const levantadas = await pg.evaluate(() => [...document.querySelectorAll('#library > .lib-item.arrastando')]
      .map((li) => li.querySelector('.row-name').textContent).join());
    await pg.mouse.move(g[nome].x, Math.round(alvoY(g)), { steps: 12 });
    await pg.mouse.up();
    await esperar(pg, () => !document.getElementById('library').classList.contains('arrastando-lista')
      && !document.querySelector('#library .arrastando'), null, 5000);
    return { levantou: levantou === true, levantadas };
  };
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
    checar((await bancoMin()) === 'Recepção@540,Aviso 2,Louvor@600,Pregação@640,Aviso 1',
      'D′ · e a MÍDIA mudou de grupo (do de "Pregação" para o de "Recepção") sem mexer em horário nenhum', await bancoMin());
  }
  // UM MOMENTO ARRASTADO LEVA O GRUPO E REESCREVE OS HORÁRIOS PELA GRADE (pedido do operador): a
  // grade são os `min` dos momentos em ordem crescente, e o k-ésimo momento DA LISTA recebe o
  // k-ésimo. "Pregação" (com o "Aviso 1" do grupo dela) por cima de "Louvor" troca de horário com
  // ele; o telão segue o relógio. E de volta, "Louvor" (sozinho) por cima de "Pregação".
  {
    const a = await arrastar('Pregação', (g) => g['Louvor'].top + 3);
    const r = await esperarDb(pg, async (e) => (await AVDB.listItems('imports'))
      .map((x) => x.name + (ehMomento(x) ? '@' + x.data.min : '')).join() === e, 'Recepção@540,Aviso 2,Pregação@600,Aviso 1,Louvor@640', 8000);
    const t = await esperar(pg, () => [...document.querySelectorAll('#library > li.momento')]
      .map((li) => li.querySelector('.momento-hora').textContent + ' ' + li.querySelector('.row-name').textContent).join(' · ')
      === '09:00 Recepção · 10:00 Pregação · 10:40 Louvor');
    const o = await ordemDoTelao();
    checar(a.levantou && a.levantadas === 'Pregação,Aviso 1',
      'D′ · segurar um MOMENTO levanta o GRUPO dele: o momento e a mídia até o próximo ("Pregação" + "Aviso 1")', a);
    checar(r === true && t === true && o.descritor === 'Recepção,Pregação,Louvor',
      'D′ · e a POSIÇÃO REESCREVE O HORÁRIO pela grade: no banco Pregação fica com 600 e Louvor com 640, a tela diz '
      + '10:00 Pregação · 10:40 Louvor, e o telão (pelo relógio) passa a Recepção, Pregação, Louvor',
      { banco: await bancoMin(), lista: await lista(), o });
  }
  {
    const a = await arrastar('Louvor', (g) => g['Pregação'].top + 3);
    const r = await esperarDb(pg, async (e) => (await AVDB.listItems('imports'))
      .map((x) => x.name + (ehMomento(x) ? '@' + x.data.min : '')).join() === e, 'Recepção@540,Aviso 2,Louvor@600,Pregação@640,Aviso 1', 8000);
    await esperar(pg, () => document.querySelectorAll('#library > li.momento')[1].querySelector('.momento-hora').textContent === '10:00');
    checar(a.levantadas === 'Louvor' && r === true && (await lista()).join(' · ') === '09:00 Recepção · 10:00 Louvor · 10:40 Pregação',
      'D′ · um momento SOZINHO levanta só ele, e de volta por cima de "Pregação" a grade devolve 10:00 e 10:40',
      { a, banco: await bancoMin(), lista: await lista() });
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

  // ── X. MOMENTOS OCULTOS NA LISTA (`#itinMomentosBtn`) ────────────────────
  // O interruptor tira da LISTA toda linha de momento; o telão (o descritor) não muda, a
  // escolha é gravada (`momentosOcultos`) e volta da recarga. Com eles ocultos, o arrasto de
  // uma mídia grava pelo VIZINHO visível: o índice da tela deixou de ser o da lista gravada.
  await abrirFaixa();
  await pg.click('#itinMomentosBtn');
  {
    const r = await esperarDb(pg, async () => ((await AVDB.getState('itinerario')) || {}).momentosOcultos === true);
    const x = await pg.evaluate(() => {
      const t = document.getElementById('itinMomentosBtn');
      return {
        linhas: document.querySelectorAll('#library > li.momento').length,
        midias: [...document.querySelectorAll('#library > li.lib-item')].map((li) => li.querySelector('.row-name').textContent).join(),
        bt: t && [t.getAttribute('aria-pressed'), t.classList.contains('active')].join(),
        descritor: itinDescriptor().itens.map((i) => i.titulo).join(),
      };
    });
    checar(r === true && x.linhas === 0 && x.midias === 'Aviso 2,Aviso 1' && x.bt === 'false,false',
      'X · "Momentos" DESLIGADO: a lista não desenha nenhum `li.momento` (as mídias ficam), o botão diz '
      + '`aria-pressed="false"` e a escolha é gravada (`momentosOcultos: true`)', { x, r: porque(r) });
    checar(x.descritor === 'Recepção,Louvor,Pregação',
      'X · e o TELÃO não muda: o descritor continua com os três momentos, pelo relógio', x.descritor);
  }
  await recarregar();
  {
    await esperar(pg, () => document.querySelectorAll('#library > li.lib-item').length > 0);
    const x = await pg.evaluate(() => ({ linhas: document.querySelectorAll('#library > li.momento').length,
      midias: document.querySelectorAll('#library > li.lib-item').length, mem: itin.momentosOcultos }));
    checar(x.linhas === 0 && x.midias === 2 && x.mem === true,
      'X · depois de RECARREGAR os momentos continuam ocultos (a escolha volta do banco)', x);
  }
  {
    const geo = await pg.evaluate(() => {
      const lis = [...document.querySelectorAll('#library > li.lib-item')];
      const r0 = lis[0].getBoundingClientRect(), r1 = lis[1].getBoundingClientRect();
      return { x: Math.round(r1.left + r1.width / 2), y: Math.round(r1.top + r1.height / 2), alvo: Math.round(r0.top + r0.height / 4) };
    });
    await pg.mouse.move(geo.x, geo.y);
    await pg.mouse.down();
    const levantou = await esperar(pg, () => !!document.querySelector('#library > .lib-item.arrastando'), null, 4000);
    await pg.mouse.move(geo.x, geo.alvo, { steps: 12 });
    await pg.mouse.up();
    const esperado = ['Recepção', 'Aviso 1', 'Aviso 2', 'Louvor', 'Pregação'];
    const r = await esperarDb(pg, async (e) => (await AVDB.listItems('imports')).map((x) => x.name).join() === e.join(), esperado, 8000);
    checar(levantou === true && r === true,
      'X · com os momentos ocultos, arrastar "Aviso 1" para cima de "Aviso 2" grava pelo VIZINHO: logo antes de '
      + '"Aviso 2" (e não no índice 0 da lista gravada, acima de "Recepção")', { levantou: porque(levantou), banco: await nomesDoBanco() });
  }
  await abrirFaixa();
  await pg.click('#itinMomentosBtn');
  {
    const r = await esperarDb(pg, async () => ((await AVDB.getState('itinerario')) || {}).momentosOcultos === false);
    const n = await esperar(pg, () => document.querySelectorAll('#library > li.momento').length === 3);
    checar(r === true && n === true, 'X · ligado de novo, os três momentos voltam à lista e a escolha é gravada', { r: porque(r), n: porque(n) });
  }
  // De volta à ordem do D′ (o W confere as mídias de "A" nela), e o vigia do barramento que a recarga levou.
  await pg.evaluate((id) => moverNaListaPara('imports', id, 4), midias.a);
  await esperarDb(pg, async () => (await AVDB.listItems('imports')).map((x) => x.name).join() === 'Recepção,Aviso 2,Louvor,Pregação,Aviso 1');
  await esperar(pg, () => [...document.querySelectorAll('#library > li.lib-item .row-name')].map((e) => e.textContent).join()
    === 'Recepção,Aviso 2,Louvor,Pregação,Aviso 1');
  await pg.evaluate(() => {
    window.__cmds = [];
    const orig = AVDB.sendCommand;
    AVDB.sendCommand = function (c) { window.__cmds.push(c); return orig.apply(this, arguments); };
  });

  // ── C. PROJETAR, E A TROCA QUANDO O RELÓGIO CRUZA ────────────────────────
  // Volta ao começo da manhã (o D′ cruzou as 10:00): a troca sob teste é a do bloco.
  await ctx.clock.setSystemTime(T('09:58'));
  await pg.evaluate(() => { window.__cmds.length = 0; });
  await esperar(pg, () => { const a = document.querySelector('#library > li.momento.agora .row-name'); return !!a && a.textContent === 'Recepção'; });
  await abrirFaixa();
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
    checar(tel.join() === 'true,true,true', 'C · e o olho do telão fica LIGADO (`aria-pressed="true"`, classe `active`)', tel);
    const v = await pv();
    checar(v.linhas[0] === '*09:00 Recepção' && v.linhas.length === 3,
      'C · às 09:58 a preview mostra "Recepção" em destaque e os seguintes abaixo', v);
    checar(v.lista.join() === 'Recepção', 'C · e a LISTA do cronograma marca o mesmo momento (`.agora`)', v.lista);
    checar(v.subs.join(' | ') === 'Agora · 1 h até Louvor | 40 min até Pregação | Último momento',
      'C · o subtítulo da linha diz "Agora" + a duração ATÉ O PRÓXIMO momento, COM O NOME DELE (Pacote 37: o '
      + 'número sozinho não dizia a que se referia), e o último diz "Último momento"', v.subs);
  }
  // LIGAR E DESLIGAR: o botão tira o itinerário do telão sem apagar nada, e a marca da lista continua.
  await abrirFaixa();
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
  await abrirFaixa();
  await pg.click('#itinTelaoBtn');
  await esperar(pg, () => itinProjecting() && !!document.querySelector('#pvTextItin .itin-linha'));
  await pg.evaluate(() => { window.__cmds.length = 0; });
  await ctx.clock.pauseAt(T('09:59', 57));
  await ctx.clock.runFor(5000);   // cruza 10:00:00 com o laço de um segundo
  {
    const v = await pv();
    checar(v.linhas.join() === '09:00 Recepção,*10:00 Louvor,10:40 Pregação',
      'C · ao cruzar 10:00 o destaque passa para "Louvor" e a LISTA FICA INTEIRA no telão (três momentos cabem na '
      + 'janela — v1.14.36: só uma lista maior que seis linhas rola a partir do momento de agora)', v);
    checar(v.lista.join() === 'Louvor' && v.subs.join(' | ') === '1 h até Louvor | Agora · 40 min até Pregação | Último momento',
      'C · a lista do cronograma acompanha o relógio (a marca e o subtítulo passam para "Louvor")', { lista: v.lista, subs: v.subs });
    checar(!/^0s/.test(await pg.evaluate(() => getComputedStyle(document.querySelector('#pvTextItin .itin-linha')).transitionDuration)),
      'C · e a troca do destaque é animada pela TRANSIÇÃO da linha (a lista fica inteira: nenhuma linha entra ou sai)', v);
    const novos = await pg.evaluate(() => window.__cmds.length);
    checar(novos === 0, 'C · sem comando nenhum no barramento: cada tela segue o próprio relógio', novos);
  }
  await ctx.clock.resume();

  // ── D. O AJUSTE, PELA FAIXA ──────────────────────────────────────────────
  const horasPv = async () => (await pv()).linhas.map((t) => t.replace('*', '').slice(0, 5));
  const mins = (hs) => hs.map((h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3)));
  const ajusteTxt = async () => (await abrirFaixa(), pg.evaluate(() => {
    const b = document.getElementById('itinAjusteTxt');
    return { longo: b.querySelector('.itin-txt-longo').textContent, curto: b.querySelector('.itin-txt-curto').textContent,
      off: b.disabled, deslocado: b.classList.contains('deslocado') };
  }));
  await abrirFaixa();
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
      && Object.keys(b).sort().join() === 'desloc,deslocDia,horas,momentosOcultos,v',
      'D · o ajuste é guardado PELO DIA, e a chave tem só `{ v:3, horas, desloc, deslocDia, momentosOcultos }`', b);
    checar(a.longo === 'Atrasado 5 min' && a.curto === '+5' && !a.off && a.deslocado,
      'D · o atraso diz "Atrasado 5 min" (curto: "+5", só o número, como o ±5), fica aceso e destacado (`deslocado`)', a);
  }
  // SEM O ±1 (Pacote 35): o ajuste anda de 5 em 5 também pela faixa, e dois −5 passam do zero.
  await abrirFaixa();
  await pg.click('#itinBar .itin-passo[aria-label="Adiantar 5 min"]');
  await esperar(pg, () => itin.desloc === 0);
  await abrirFaixa();
  await pg.click('#itinBar .itin-passo[aria-label="Adiantar 5 min"]');
  await esperar(pg, () => itin.desloc === -5);
  {
    const v = await pv();
    const hl = await pg.evaluate(() => [...document.querySelectorAll('#library > li.momento .momento-hora')].map((e) => e.textContent));
    const m = mins(hl);
    checar(hl.join() === '08:55,09:55,10:35' && m[1] - m[0] === 60 && m[2] - m[1] === 40
        && v.linhas.length === 3 && v.linhas[1] === '*09:55 Louvor',
      'D · −5 recua todos juntos (os INTERVALOS ficam: 60 e 40 min), e o de agora acompanha (Louvor 09:55)', { hl, pv: v.linhas });
    const a = await ajusteTxt();
    checar(a.longo === 'Adiantado 5 min' && a.curto === '−5',
      'D · passando de zero o atraso vira "Adiantado 5 min" (curto: "−5", com o U+2212)', a);
    const passos = await pg.evaluate(() => [...document.querySelectorAll('#itinBar .itin-passo')].map((b) => b.getAttribute('aria-label')));
    checar(passos.join() === 'Adiantar 5 min,Atrasar 5 min', 'D · a faixa só tem os passos de 5 min (o ±1 saiu)', passos);
  }
  await abrirFaixa();
  await pg.click('#itinAjusteTxt');
  await esperar(pg, () => itin.desloc === 0);
  {
    const v = await pv();
    const a = await ajusteTxt();
    const b = await banco();
    checar(v.linhas.length === 3 && v.linhas[1] === '*10:00 Louvor' && a.off && !a.deslocado && a.longo === 'No horário' && a.curto === '0',
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
  await abrirFaixa();
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
    checar(lim.faixaNoTeto.join(' ') === '−5 +5:off',
      'J · e na faixa, em +12 h, só o passo para a frente apaga (+5)', lim.faixaNoTeto);
  }

  // ── E. HORÁRIOS × SÓ OS TÍTULOS, PELA FAIXA ──────────────────────────────
  await abrirFaixa();
  await pg.click('#itinHorasBtn');
  await esperar(pg, () => document.getElementById('pvTextItin').classList.contains('sem-horas'));
  {
    const v = await pv();
    const b = await banco();
    const bt = await pg.evaluate(() => { const t = document.getElementById('itinHorasBtn'); return [t.getAttribute('aria-pressed'), t.classList.contains('active')]; });
    checar(v.semHoras && v.horaVisivel === 'none' && b.horas === false && bt.join() === 'false,false',
      'E · "só os títulos": a hora some da lista projetada, o botão desliga (`aria-pressed="false"`) e a escolha é guardada', { v, horas: b.horas, bt });
    checar(v.linhas.length === 3 && v.linhas.some((x) => x.startsWith('*')),
      'E · e o item de agora CONTINUA marcado (a lista fica inteira)', v.linhas);
  }
  await abrirFaixa();
  await pg.click('#itinHorasBtn');
  await esperar(pg, () => !document.getElementById('pvTextItin').classList.contains('sem-horas'));
  await abrirFaixa();
  checar((await faixa()).horas === 'true', 'E · e o botão volta a "horários" (`aria-pressed="true"`)', await faixa());

  // ── U (no ar). RECOLHIDA, A PORTA DIZ QUE ESTÁ NO AR ─────────────────────
  await fecharFaixa();
  {
    const f = await faixa();
    checar(!f.aberta && f.filhos.length === 0 && f.ponto && f.noAr,
      'U · recolhida com o itinerário NO AR, a PORTA da barra mostra o ponto aceso (`#itinBarBtn .itin-ponto`) — a única pista que sobra', f);
  }
  await abrirFaixa();
  {
    const f = await faixa();
    checar(f.aberta && f.telao.join() === 'true,false,' && f.ponto, 'U · abrir de novo devolve o olho do telão LIGADO (e o ponto segue na porta)', f);
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
    checar(rTv === true && t.modo && t.cartao && t.linhas.length === 3 && t.linhas[1] === '*10:00 Louvor [Agora]'
      && t.linhas[2] === '10:40 Pregação',
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
    checar(t.linhas.length === 3 && t.linhas[2] === '*10:40 Pregação [Agora]',
      'G · depois do último horário o último fica no ar, e a LISTA continua à vista (era uma linha só até a v1.14.36)',
      t.linhas);
    checar(!/^0s/.test(await tv.evaluate(() => getComputedStyle(document.querySelector('#textItin .itin-linha')).transitionDuration)),
      'F · e no telão o destaque troca por TRANSIÇÃO (a lista fica inteira: nenhuma linha entra ou sai)', t);
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
    checar(t.linhas.join() === '10:00 Louvor,*10:20 Fim [Agora]' && animou === 0 && /^0s/.test(trans),
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
    await abrirFaixa();
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
  await abrirFaixa();
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
  await abrirFaixa();
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
    checar(e.noAr && r3 === true && (await tvTitulos()) === 'Recepção,Louvor,Pregação' && !/Ensaio|Coral/.test(await tvTitulos()),
      'W · com o itinerário NO AR, o telão acompanhou a troca: agora mostra a lista de "A" INTEIRA (Recepção, Louvor, Pregação)',
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
  await abrirFaixa();
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
    v: 2, horas: false, desloc: 7, deslocDia: hojeDia, ativo: 'a', barraOculta: true,
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
    checar(e.v === 3 && e.horas === false && e.desloc === 7 && e.deslocDia === hoje && e.momentosOcultos === false
      && Object.keys(e).sort().join() === 'desloc,deslocDia,horas,momentosOcultos,v',
      'S · a chave vira `{ v:3, horas, desloc, deslocDia, momentosOcultos }` — sem `itens`, `itinerarios`, `ativo` nem o `barraOculta` '
      + 'que a chave velha trazia — mantendo `horas` e o ajuste do dia', e);
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
    checar(m.ordem === 'M:Recepção,M:Louvor,M:Sermão,x:Aviso B' && m.estado.v === 3 && !('itens' in m.estado) && !('barraOculta' in m.estado),
      'S · rodar a migração de novo sobre a chave antiga (um corte no meio) não duplica: o `legado` reconhece os já criados', m);
  }

  // O CAMPO ANTIGO `barraOculta` (até a v1.14.34): a leitura o IGNORA — um `false` gravado não
  // abre a faixa — e a próxima gravação o APAGA (o `saveItin` mescla: o apagar é explícito).
  await pg.evaluate(async () => {
    const st = await AVDB.getState('itinerario');
    await AVDB.setState('itinerario', Object.assign({}, st, { barraOculta: false }));
  });
  await recarregar();
  {
    const vis = await esperar(pg, () => !document.getElementById('itinBarBtn').hidden);
    const e = await pg.evaluate(async () => ({ st: await AVDB.getState('itinerario'), oculta: document.getElementById('itinBar').hidden,
      exp: document.getElementById('itinBarBtn').getAttribute('aria-expanded') }));
    checar(vis === true && e.st.barraOculta === false && e.oculta && e.exp === 'false',
      'S · um `barraOculta: false` legado NÃO abre a faixa: depois da recarga ela nasce recolhida', e);
  }
  await abrirFaixa();
  await pg.click('#itinHorasBtn');
  {
    const r = await esperarDb(pg, async () => { const s = await AVDB.getState('itinerario'); return !!s && s.horas === true; });
    const st = await banco();
    checar(r === true && !('barraOculta' in st) && Object.keys(st).sort().join() === 'desloc,deslocDia,horas,momentosOcultos,v',
      'S · e a primeira gravação (aqui, os horários) APAGA o `barraOculta`', st || porque(r));
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

  // ── G′. O GRUPO DO MOMENTO: a tinta e o arrasto do bloco ─────────────────
  // Um cronograma de culto (o medido pelo implementador, mais um momento sozinho no fim): a mídia
  // solta do topo não tem grupo; cada momento abre o dele até o próximo. Segurar um momento leva
  // o bloco, que só cai numa FRONTEIRA de grupo; uma mídia sozinha muda de grupo sem mexer em horário.
  await pg.setViewportSize({ width: 360, height: 1400 });   // as nove linhas à vista, sem rolar a lista
  await esperar(pg, () => innerHeight === 1400);
  // A FAIXA FECHADA ANTES DE MEDIR: aberta, ela empurra a lista ~40px para baixo e o prazo
  // de fecho sozinho pode vencê-la no MEIO de um arrasto, mudando a geometria debaixo do dedo.
  await fecharFaixa();
  await pg.evaluate(async () => {
    itinAjusteZerar();
    for (const x of await AVDB.listItems('imports')) await AVDB.listRemove('imports', x.id);
    const msg = (n) => AVDB.addCue('message', { text: n }, { name: n, list: 'imports' });
    const mom = (n, min) => AVDB.addCue('momento', { min }, { name: n, list: 'imports' });
    await msg('Aviso solto'); await mom('Recepção', 540); await msg('Boas-vindas'); await mom('Louvor', 600);
    await msg('Hino 1'); await msg('Hino 2'); await mom('Pregação', 630); await msg('Apelo'); await mom('Bênção', 700);
    await load();
  });
  const grupos = () => pg.evaluate(() => [...document.querySelectorAll('#library > li.lib-item')]
    .map((li) => li.querySelector('.row-name').textContent + ':'
      + ['grupo-ini', 'grupo-meio', 'grupo-fim'].filter((c) => li.classList.contains(c)).map((c) => c.slice(6)).join('+')).join(' '));
  await esperar(pg, () => document.querySelectorAll('#library > li.lib-item').length === 9);
  // AS AÇÕES DO MOMENTO SÓ COM A FAIXA ABERTA (v1.14.37): fechada, sobra a SETA do grupo.
  {
    const ler = () => pg.evaluate(() => {
      const li = document.querySelector('#library > li.momento.grupo-ini');
      const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).display !== 'none'; };
      return [...li.querySelectorAll('.row-acoes--solta > button')].filter(vis).map((x) => (x.classList.contains('itin-seta') ? 'seta'
        : x.classList.contains('itin-editar') ? 'editar' : 'excluir'));
    });
    const fechada = await ler();
    await abrirFaixa();
    const aberta = await ler();
    await fecharFaixa();
    checar(fechada.join() === 'seta' && aberta.join() === 'seta,editar,excluir',
      'G′ · com a FAIXA FECHADA a linha do momento mostra SÓ a seta do grupo; aberta, a fileira inteira '
      + '(seta · editar · excluir — a seta à ESQUERDA do lápis, devolvida em 16/11)',
      { fechada, aberta });
  }
  {
    const b = await bancoMin();
    const gr = await grupos();
    checar(b === 'Aviso solto,Recepção@540,Boas-vindas,Louvor@600,Hino 1,Hino 2,Pregação@630,Apelo,Bênção@700',
      'G′ · ponto de partida: uma mídia solta, três momentos com as mídias deles e um momento sozinho no fim', b);
    checar(gr === 'Aviso solto: Recepção:ini Boas-vindas:meio+fim Louvor:ini Hino 1:meio Hino 2:meio+fim Pregação:ini Apelo:meio+fim Bênção:',
      'G′ · as classes do grupo: a mídia antes do 1º momento sem nenhuma; o momento `grupo-ini`, as mídias `grupo-meio` (a '
      + 'última também `grupo-fim`); o momento sozinho no fim NÃO leva classe nenhuma (nem tinta)', gr);
    const m = await pg.evaluate(() => {
      // O GRUPO NÃO SE PINTA (v1.14.36, pedido do operador: *"se não dá pra ter moldura, então não
      // precisa ter nada"*): as classes FICARAM (o arrasto em bloco depende delas), e o que separa
      // dois grupos é só o respiro. O momento tem a linha TRANSPARENTE e as mídias têm o fundo da
      // linha neutra — nenhuma das cinco linhas veste uma cor de grupo, e ninguém desenha `::after`.
      const neutra = (() => { const p = document.createElement('i'); p.style.background = 'var(--camada)';
        document.body.appendChild(p); const c = getComputedStyle(p).backgroundColor; p.remove(); return c; })();
      const token = getComputedStyle(document.documentElement).getPropertyValue('--grupo-fill').trim();
      const li = (n) => [...document.querySelectorAll('#library > li.lib-item')].find((x) => x.querySelector('.row-name').textContent === n);
      const um = (n) => { const el = li(n); return { fundo: getComputedStyle(el.querySelector('.row')).backgroundColor,
        doLi: getComputedStyle(el).backgroundColor, desenho: getComputedStyle(el, '::after').content }; };
      return { neutra, token, ini: um('Louvor'), meio: um('Hino 1'), fim: um('Hino 2'), so: um('Bênção'), solto: um('Aviso solto') };
    });
    const transp = (c) => c === 'rgba(0, 0, 0, 0)' || c === 'transparent';
    const momentoLimpo = (x) => transp(x.fundo) && transp(x.doLi) && x.desenho === 'none';
    const midiaLimpa = (x) => x.fundo === m.neutra && x.desenho === 'none';
    checar(m.token === '' && momentoLimpo(m.ini) && midiaLimpa(m.meio) && midiaLimpa(m.fim)
      && momentoLimpo(m.so) && midiaLimpa(m.solto),
      'G′ · o GRUPO NÃO TEM TINTA NENHUMA: o momento é transparente, as mídias vestem a linha neutra, e nem o token '
      + '`--grupo-fill` existe mais (nenhuma linha desenha contorno) — o que separa dois grupos é só o respiro', m);
    // TODOS OS MOMENTOS COM A MESMA ALTURA, E MAIS COMPACTOS QUE A MÍDIA (v1.14.57).
    // Dois pedidos, e o segundo corrige a leitura do primeiro: *"momento do itinerário
    // que contém midias e forma um grupo, tem sua altura de item mais alta que os
    // normais… todos os momentos devem ter uma altura de 'card'/corpo iguais"*, e
    // *"os momentos ficam mais baixos, mas não diminua suas fontes, ou tamanho de
    // botões, apenas ocupe menos espaço vertical de corpo"*. A régua é QUÁDRUPLA: a
    // `.row` do momento mede o MESMO que as outras caixas de momento, MEDE MENOS que
    // a de uma mídia (que carrega a miniatura), o respiro do grupo é margem — fora da
    // caixa — e continua lá (≥ `--sp-4`). Fechada a faixa os botões do momento somem,
    // e é aí que a igualdade se prova de verdade: quem a sustenta é o `min-height` da
    // CAIXA DE AÇÕES, não os botões desenhados.
    {
      const alturas = await pg.evaluate(() => {
        const lis = [...document.querySelectorAll('#library > li.lib-item')];
        const alt = (el) => +el.getBoundingClientRect().height.toFixed(1);
        const media = lis.filter((li) => !li.classList.contains('momento'));
        const mom = lis.filter((li) => li.classList.contains('momento'));
        const respiros = [];
        for (let i = 1; i < lis.length; i++) {
          if (!lis[i].classList.contains('grupo-ini')) continue;
          respiros.push(+(lis[i].querySelector('.row').getBoundingClientRect().top
            - lis[i - 1].querySelector('.row').getBoundingClientRect().bottom).toFixed(1));
        }
        return {
          midia: media.map((li) => alt(li.querySelector('.row'))),
          momento: mom.map((li) => alt(li.querySelector('.row'))),
          caixaMomentos: mom.map(alt), respiros,
        };
      });
      const iguais = (v) => v.length > 0 && v.every((x) => Math.abs(x - v[0]) <= 0.5);
      checar(iguais(alturas.midia) && iguais(alturas.momento) && iguais(alturas.caixaMomentos)
        && alturas.momento[0] <= alturas.midia[0] - 4
        && alturas.respiros.length >= 2 && alturas.respiros.every((r) => r >= 8),
        'G′ · TODOS OS MOMENTOS TÊM A MESMA ALTURA, E MAIS COMPACTOS QUE A MÍDIA: a linha do momento mede '
        + alturas.momento[0] + 'px contra ' + alturas.midia[0] + 'px de uma mídia (ela carrega a miniatura), todas as '
        + 'caixas de momento medem igual e o respiro entre grupos é MARGEM, fora da caixa ('
        + alturas.respiros.join(' · ') + 'px livres)', alturas);
    }
    // O DEMARCADOR DO GRUPO (v1.14.54): cada momento tem uma COR de IDENTIDADE, a hora
    // a carrega e a MESMA cor vira a linha de 3px na borda esquerda da miniatura das
    // mídias do grupo. O que se prova: cores DIFERENTES entre os momentos, a linha nas
    // mídias do grupo CERTO (e nenhuma na mídia de fora), a cor igual nos dois pontos,
    // e o contraste nos DOIS temas — a hora é texto (AA) e a linha é objeto (3:1).
    const cores = await pg.evaluate(async () => {
      const z = (ms) => new Promise((f) => setTimeout(f, ms));
      const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
      const lum = (rgb) => { const m = rgb.match(/\d+/g).map(Number); return 0.2126 * lin(m[0]) + 0.7152 * lin(m[1]) + 0.0722 * lin(m[2]); };
      const ctr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      const li = (n) => [...document.querySelectorAll('#library > li.lib-item')].find((x) => x.querySelector('.row-name').textContent === n);
      const cor = (n) => getComputedStyle(li(n).querySelector('.momento-hora')).color;
      const linha = (n) => { const c = getComputedStyle(li(n).querySelector('.thumb'), '::after'); return { desenho: c.content, cor: c.backgroundColor, larg: c.width }; };
      const ler = () => ({
        bg: getComputedStyle(document.body).backgroundColor,
        thumb: getComputedStyle(li('Boas-vindas').querySelector('.thumb')).backgroundColor,
        hora: { recepcao: cor('Recepção'), louvor: cor('Louvor'), pregacao: cor('Pregação'), bencao: cor('Bênção') },
        linha: { boas: linha('Boas-vindas'), hino1: linha('Hino 1'), hino2: linha('Hino 2'), apelo: linha('Apelo'), fora: linha('Aviso solto') },
      });
      const escuro = ler();
      setTema('claro'); await z(150);
      const claro = ler();
      setTema('escuro');
      const horas = Object.values(escuro.hora);
      const linhas = [escuro.linha.boas, escuro.linha.hino1, escuro.linha.hino2, escuro.linha.apelo];
      const linhasClaro = [claro.linha.boas, claro.linha.hino1, claro.linha.hino2, claro.linha.apelo];
      return {
        minHoraEscuro: Math.min(...horas.map((c) => ctr(c, escuro.bg))),
        minHoraClaro: Math.min(...Object.values(claro.hora).map((c) => ctr(c, claro.bg))),
        minLinhaEscuro: Math.min(...linhas.map((x) => ctr(x.cor, escuro.thumb))),
        minLinhaClaro: Math.min(...linhasClaro.map((x) => ctr(x.cor, claro.thumb))),
        coresDistintas: new Set(horas).size === horas.length,
        horaNasLinhas: escuro.linha.boas.cor === escuro.hora.recepcao && escuro.linha.hino1.cor === escuro.hora.louvor
          && escuro.linha.hino2.cor === escuro.hora.louvor && escuro.linha.apelo.cor === escuro.hora.pregacao,
        larg: linhas.map((x) => x.larg),
        fora: escuro.linha.fora,
        mudaNoTema: claro.hora.recepcao !== escuro.hora.recepcao,
        amostra: { escuro: escuro.hora, claro: claro.hora },
      };
    });
    checar(cores.coresDistintas && cores.horaNasLinhas && cores.larg.every((w) => w === '3px')
      && cores.fora.desenho === 'none'
      && cores.minHoraEscuro >= 4.5 && cores.minHoraClaro >= 4.5
      && cores.minLinhaEscuro >= 3 && cores.minLinhaClaro >= 3 && cores.mudaNoTema,
      'G′ · o DEMARCADOR do grupo (v1.14.54): cada momento tem uma cor de identidade (a hora a carrega), a MESMA cor '
      + 'pinta a linha de 3px na borda esquerda das miniaturas do grupo certo — e a mídia de fora não pinta nada. '
      + 'Contraste medido nos dois temas: hora ≥ ' + cores.minHoraEscuro.toFixed(2) + ':1 / ' + cores.minHoraClaro.toFixed(2)
      + ':1 e linha ≥ ' + cores.minLinhaEscuro.toFixed(2) + ':1 / ' + cores.minLinhaClaro.toFixed(2) + ':1', cores);
    const vao = await pg.evaluate(() => {
      const lis = [...document.querySelectorAll('#library > li.lib-item')], pares = [];
      for (let i = 1; i < lis.length; i++) {
        const a = lis[i - 1], b = lis[i];
        if (!a.classList.contains('grupo-fim') || !b.classList.contains('grupo-ini')) continue;
        // a base do CARTÃO do grupo de cima e o topo do CARTÃO do de baixo (o `li` do
        // momento carrega o respiro em `padding-top`, e medir o `li` o comeria)
        const baixo = a.querySelector('.row').getBoundingClientRect().bottom;
        const cima = b.querySelector('.row').getBoundingClientRect().top;
        pares.push(a.querySelector('.row-name').textContent + '→' + b.querySelector('.row-name').textContent + '=' + +(cima - baixo).toFixed(1));
      }
      return pares;
    });
    // DOIS vãos: o grupo de "Bênção" não existe (momento sem mídia não é grupo), então as
    // fronteiras são Boas-vindas→Louvor e Hino 2→Pregação.
    checar(vao.length === 2 && vao.every((p) => Number(p.split('=').pop()) >= 8),
      'G′ · ENTRE dois grupos os blocos respiram: da base de um grupo ao topo do seguinte há 8px ou mais livres', vao);
  }
  // O BLOCO: "Pregação" (com "Apelo") por cima de "Louvor" — a medida do implementador.
  {
    const a = await arrastar('Pregação', (g) => g['Louvor'].top + 3);
    const r = await esperarDb(pg, async (e) => (await AVDB.listItems('imports'))
      .map((x) => x.name + (ehMomento(x) ? '@' + x.data.min : '')).join() === e,
    'Aviso solto,Recepção@540,Boas-vindas,Pregação@600,Apelo,Louvor@630,Hino 1,Hino 2,Bênção@700', 8000);
    // O DESCRITOR SÓ DEPOIS DO `load()` DA GRADE: o `esperarDb` acima vê a GRAVAÇÃO, e o
    // app ainda está gravando os `min` e recarregando a lista (`grava.then(reassenta)` em
    // `terminarArrasto`); lido antes disso, o descritor é o da ordem nova com os horários
    // velhos. Aqui o oráculo espera o estado FRESCO, como os outros casos do arquivo.
    const fresco = await esperar(pg, () => itinDescriptor().itens.map((x) => x.titulo).join() === 'Recepção,Pregação,Louvor,Bênção');
    const o = await ordemDoTelao();
    checar(a.levantou && a.levantadas === 'Pregação,Apelo',
      'G′ · segurar "Pregação" levanta as DUAS linhas do grupo (todas com `.arrastando`)', a);
    checar(r === true && fresco === true && o.descritor === 'Recepção,Pregação,Louvor,Bênção',
      'G′ · e o bloco cai INTEIRO antes de "Louvor", a grade troca os horários (Pregação 600, Louvor 630) e o telão segue o relógio',
      { banco: await bancoMin(), fresco, o });
    const gr = await esperar(pg, (e) => [...document.querySelectorAll('#library > li.lib-item')].map((li) => li.querySelector('.row-name').textContent
      + ':' + ['grupo-ini', 'grupo-meio', 'grupo-fim'].filter((c) => li.classList.contains(c)).map((c) => c.slice(6)).join('+')).join(' ') === e,
    'Aviso solto: Recepção:ini Boas-vindas:meio+fim Pregação:ini Apelo:meio+fim Louvor:ini Hino 1:meio Hino 2:meio+fim Bênção:');
    checar(gr === true, 'G′ · e as classes acompanham o bloco no lugar novo', await grupos());
  }
  // NÃO CAI NO MEIO DE OUTRO GRUPO: "Bênção" solta entre "Louvor" e "Hino 1" (onde uma mídia cairia)
  // vai para ANTES de "Louvor" — e a grade a leva às 10:30.
  {
    const a = await arrastar('Bênção', (g) => (g['Louvor'].bottom + g['Hino 1'].top) / 2);
    const r = await esperarDb(pg, async (e) => (await AVDB.listItems('imports'))
      .map((x) => x.name + (ehMomento(x) ? '@' + x.data.min : '')).join() === e,
    'Aviso solto,Recepção@540,Boas-vindas,Pregação@600,Apelo,Bênção@630,Louvor@700,Hino 1,Hino 2', 8000);
    // O MESMO CUIDADO DO BLOCO ANTERIOR: o `esperarDb` vê a gravação, e o `load()` dos `min`
    // ainda pode estar trocando os nós da lista — o arrasto seguinte morreria com a linha
    // redesenhada debaixo do dedo. Espera a TELA assentar (as horas efetivas novas).
    const t = await esperar(pg, () => [...document.querySelectorAll('#library > li.momento')]
      .map((li) => li.querySelector('.momento-hora').textContent + ' ' + li.querySelector('.row-name').textContent).join(' · ')
      === '09:00 Recepção · 10:00 Pregação · 10:30 Bênção · 11:40 Louvor');
    checar(a.levantadas === 'Bênção' && r === true && t === true,
      'G′ · um momento solto no MEIO do grupo de outro não o parte: cai na fronteira (antes de "Louvor"), e a grade dá 630 a Bênção e 700 a Louvor',
      { a, banco: await bancoMin(), t });
  }
  // NEM ANTES DAS MÍDIAS SOLTAS DO TOPO: o grupo de "Recepção" levado acima de "Aviso solto" fica onde está.
  {
    const antes = await bancoMin();
    const a = await arrastar('Recepção', (g) => g['Aviso solto'].top + 2);
    await pg.waitForTimeout(400);
    const depois = await bancoMin();
    checar(a.levantou && a.levantadas === 'Recepção,Boas-vindas' && depois === antes && depois.startsWith('Aviso solto,'),
      'G′ · e o grupo não cai ANTES da mídia solta do topo: levado acima dela, "Recepção" + "Boas-vindas" ficam depois dela', { a, antes, depois });
  }
  // A MÍDIA SOZINHA MUDA DE GRUPO, e nenhum horário muda: "Hino 2" para entre "Recepção" e "Boas-vindas".
  {
    const a = await arrastar('Hino 2', (g) => (g['Recepção'].bottom + g['Boas-vindas'].top) / 2);
    const r = await esperarDb(pg, async (e) => (await AVDB.listItems('imports'))
      .map((x) => x.name + (ehMomento(x) ? '@' + x.data.min : '')).join() === e,
    'Aviso solto,Recepção@540,Hino 2,Boas-vindas,Pregação@600,Apelo,Bênção@630,Louvor@700,Hino 1', 8000);
    const gr = await esperar(pg, () => document.querySelector('#library > li.lib-item:nth-child(3)').classList.contains('grupo-meio'));
    checar(a.levantadas === 'Hino 2' && r === true && gr === true,
      'G′ · uma MÍDIA arrastada sozinha muda de grupo (de "Louvor" para "Recepção", agora `grupo-meio`) sem mexer em horário nenhum',
      { a, banco: await bancoMin(), grupos: await grupos() });
  }
  // COM OS MOMENTOS OCULTOS não há grupo nenhum.
  {
    const antes = await pg.evaluate(() => document.querySelectorAll('#library > :is(.grupo-ini, .grupo-meio, .grupo-fim)').length);
    await abrirFaixa();
    await pg.click('#itinMomentosBtn');
    await esperar(pg, () => !document.querySelector('#library > li.momento'));
    const ocultos = await pg.evaluate(() => document.querySelectorAll('#library > :is(.grupo-ini, .grupo-meio, .grupo-fim)').length);
    checar(antes > 0 && ocultos === 0, 'G′ · com os momentos OCULTOS nenhuma linha leva classe de grupo (nem tinta)', { antes, ocultos });
    await abrirFaixa();
    await pg.click('#itinMomentosBtn');
    await esperar(pg, () => !!document.querySelector('#library > li.momento'));
  }

  // ── G′. O GRUPO RECOLHIDO: tocar o momento com mídia esconde as mídias dele ──
  // Do lote de hoje: tocar a `.row` do momento recolhe o grupo (só em memória), tocar de
  // novo expande; um momento SEM mídia não recolhe (o toque abre a sub-aba `#itinEditor`); o grupo
  // recolhido leva as mídias escondidas no arrasto (ordem gravada + horários pela grade);
  // e com os momentos ocultos nada fica recolhido. Recomeça a lista do zero para medir o
  // ponto de partida conhecido (o mesmo do começo do G′).
  {
    await pg.evaluate(async () => {
      itinAjusteZerar();
      for (const x of await AVDB.listItems('imports')) await AVDB.listRemove('imports', x.id);
      const msg = (n) => AVDB.addCue('message', { text: n }, { name: n, list: 'imports' });
      const mom = (n, min) => AVDB.addCue('momento', { min }, { name: n, list: 'imports' });
      await msg('Aviso solto'); await mom('Recepção', 540); await msg('Boas-vindas'); await mom('Louvor', 600);
      await msg('Hino 1'); await msg('Hino 2'); await mom('Pregação', 630); await msg('Apelo'); await mom('Bênção', 700);
      await load();
    });
    await esperar(pg, () => document.querySelectorAll('#library > li.lib-item').length === 9);
    // A FAIXA HERDADA DA SEÇÃO ANTERIOR pode fechar sozinha no meio do arrasto e puxar a
    // lista 40px: fechada agora, a geometria do gesto não muda debaixo do dedo.
    await fecharFaixa();
    const nomesNaTela2 = () => pg.evaluate(() => [...document.querySelectorAll('#library > li.lib-item .row-name')].map((x) => x.textContent).join());
    const base2 = await nomesNaTela2();
    const idDe = (n) => pg.evaluate((nome) => [...document.querySelectorAll('#library > li.lib-item')]
      .find((li) => li.querySelector('.row-name').textContent === nome).dataset.id, n);
    const tocar = async (n) => { await pg.click('#library > li.lib-item[data-id="' + (await idDe(n)) + '"] .row-name'); };
    const estadoDo = (n) => pg.evaluate((nome) => {
      const li = [...document.querySelectorAll('#library > li.lib-item')].find((x) => x.querySelector('.row-name').textContent === nome);
      const cs = getComputedStyle(li, '::after');
      // A SETA É UM BOTÃO na `.row-acoes--solta`, à ESQUERDA do lápis (devolvida lá em 16/11,
      // depois de uma volta pela ponta direita na v1.14.38): a ordem é [seta · editar · excluir],
      // e ela leva o estado do grupo no `aria-expanded`.
      const botoes = [...li.querySelectorAll('.row > .row-acoes--solta > button')];
      const seta = botoes.find((b) => b.classList.contains('itin-seta'));
      return { recolhido: li.classList.contains('recolhido'), exp: li.getAttribute('aria-expanded'),
        ocultas: li.dataset.ocultas == null ? null : li.dataset.ocultas,
        seta: !!seta, setaExp: seta ? seta.getAttribute('aria-expanded') : null,
        fileira: botoes.map((b) => (b.classList.contains('itin-seta') ? 'seta'
          : b.classList.contains('itin-editar') ? 'editar' : 'excluir')).join(),
        sub: li.querySelector('.momento-sub-txt').textContent,
        classes: ['grupo-ini', 'grupo-meio', 'grupo-fim'].filter((c) => li.classList.contains(c)).join('+'),
        fundo: getComputedStyle(li.querySelector('.row')).backgroundColor, desenho: cs.content };
    }, n);
    const nomeDa = (n) => nomesNaTela2().then((s) => s.split(','));
    // (1) TOCAR RECOLHE: "Pregação" tem uma mídia ("Apelo").
    await tocar('Pregação');
    const fechou = await esperar(pg, () => {
      const li = [...document.querySelectorAll('#library > li.lib-item')].find((x) => x.querySelector('.row-name').textContent === 'Pregação');
      return !!li && li.classList.contains('recolhido') && /1 item/.test(li.querySelector('.momento-sub-txt').textContent);
    });
    const e1 = await estadoDo('Pregação');
    const desenho1 = await nomeDa();
    checar(fechou === true && e1.recolhido && e1.exp === 'false' && e1.ocultas === '1'
      && e1.seta && e1.setaExp === 'false' && e1.fileira === 'seta,editar,excluir'
      && !desenho1.includes('Apelo') && e1.sub.includes('1 item') && e1.classes === 'grupo-ini+grupo-fim'
      && e1.fundo === 'rgba(0, 0, 0, 0)' && e1.desenho === 'none',
      'G′ · tocar a `.row` do momento com grupo RECOLHE as mídias dele: `li.recolhido`, `aria-expanded="false"`, '
      + '`dataset.ocultas` = 1, o subtítulo "1 item" — e o grupo recolhido continua `grupo-ini` + `grupo-fim`, '
      + 'SEM tinta e sem contorno, com a SETA como botão à esquerda do lápis (a fileira é seta · editar · excluir, '
      + 'e o `aria-expanded` dela é o do grupo)', { e1, desenho1 });
    // (2) DE NOVO EXPANDE: as mídias voltam na ordem de antes.
    await tocar('Pregação');
    const abriu = await esperar(pg, () => {
      const li = [...document.querySelectorAll('#library > li.lib-item')].find((x) => x.querySelector('.row-name').textContent === 'Pregação');
      return !!li && !li.classList.contains('recolhido')
        && [...document.querySelectorAll('#library > li.lib-item .row-name')].some((x) => x.textContent === 'Apelo');
    });
    const desenho2 = await nomeDa();
    checar(abriu === true && desenho2.join() === base2,
      'G′ · tocar de novo EXPANDE o grupo: as mídias voltam desenhadas e na ordem de antes', { abriu, desenho2 });
    // (2b) O PLURAL do subtítulo: "Louvor" esconde DUAS mídias ("Hino 1" e "Hino 2").
    await tocar('Louvor');
    const dois = await esperar(pg, () => {
      const li = [...document.querySelectorAll('#library > li.lib-item')].find((x) => x.querySelector('.row-name').textContent === 'Louvor');
      return !!li && li.classList.contains('recolhido') && li.dataset.ocultas === '2'
        && /2 itens/.test(li.querySelector('.momento-sub-txt').textContent);
    });
    await tocar('Louvor');
    const voltaram = await esperar(pg, (b) => [...document.querySelectorAll('#library > li.lib-item .row-name')]
      .map((x) => x.textContent).join() === b, base2);
    checar(dois === true && voltaram === true,
      'G′ · o subtítulo do recolhido conta o que está escondido ("2 itens"), e reabrir devolve as duas mídias na ordem',
      { dois, voltaram });
    // (3) MOMENTO SEM MÍDIA NÃO RECOLHE: o toque abre a sub-aba de edição ("Bênção" é o último).
    // E COM A FAIXA RECOLHIDA (v1.14.52) a faixa abre JUNTO: o fechar da sub-aba é o `+` dela.
    const faixaAntes = await portaAberta();
    await fecharFaixa();
    await tocar('Bênção');
    const folha = await esperar(pg, () => !document.getElementById('itinEditor').hidden && !itinEditorAnimando && !itinFaixaAnimando);
    const eB = await estadoDo('Bênção');
    const nenhumRecolhido = await pg.evaluate(() => document.querySelectorAll('#library > li.recolhido').length);
    const junto = await pg.evaluate(() => ({
      faixa: !document.getElementById('itinBar').hidden && itinFaixaAberta,
      titulo: document.getElementById('itinEditorTitulo').textContent,
      campo: document.getElementById('itinCampoTitulo').value,
      mais: document.getElementById('itinNovoBtn').getAttribute('aria-expanded'),
    }));
    await pg.click('#itinNovoBtn');
    await esperar(pg, () => document.getElementById('itinEditor').hidden && !itinEditorAnimando);
    const depois = await portaAberta();
    if (!faixaAntes) await fecharFaixa();
    checar(folha === true && !eB.recolhido && eB.exp === null && nenhumRecolhido === 0,
      'G′ · um momento SEM mídia não recolhe: o toque abre a sub-aba `#itinEditor`, e a linha não ganha `recolhido` nem `aria-expanded`',
      { folha, eB, nenhumRecolhido });
    checar(junto.faixa && junto.titulo === 'Editar momento' && junto.campo === 'Bênção' && junto.mais === 'true' && depois === true,
      'G′ · com a faixa RECOLHIDA, tocar no momento abre a faixa JUNTO com a sub-aba de edição (o `+` dela vira o fechar, '
      + '`aria-expanded="true"`); fechar a sub-aba deixa a faixa aberta', { junto, depois });
    // (4) ARRASTAR O GRUPO RECOLHIDO leva as mídias escondidas: ordem gravada e grade.
    await tocar('Pregação');
    await esperar(pg, () => {
      const li = [...document.querySelectorAll('#library > li.lib-item')].find((x) => x.querySelector('.row-name').textContent === 'Pregação');
      return !!li && li.classList.contains('recolhido');
    });
    const a = await arrastar('Pregação', (g) => g['Louvor'].top + 3);
    const r = await esperarDb(pg, async (e) => (await AVDB.listItems('imports'))
      .map((x) => x.name + (ehMomento(x) ? '@' + x.data.min : '')).join() === e,
    'Aviso solto,Recepção@540,Boas-vindas,Pregação@600,Apelo,Louvor@630,Hino 1,Hino 2,Bênção@700', 8000);
    const fresco = await esperar(pg, () => itinDescriptor().itens.map((x) => x.titulo).join() === 'Recepção,Pregação,Louvor,Bênção');
    const e2 = await estadoDo('Pregação');
    const desenho3 = await nomeDa();
    checar(a.levantou && a.levantadas === 'Pregação' && r === true && fresco === true
      && !desenho3.includes('Apelo') && e2.recolhido && e2.ocultas === '1',
      'G′ · arrastar o grupo RECOLHIDO leva as mídias escondidas: a ordem gravada leva "Apelo" junto, a grade troca '
      + 'os horários (Pregação 600, Louvor 630), o telão segue o relógio e o grupo continua recolhido',
      { a, banco: await bancoMin(), fresco, desenho3 });
    // (5) COM OS MOMENTOS OCULTOS nada fica recolhido; de volta, a lista volta inteira.
    await abrirFaixa();
    await pg.click('#itinMomentosBtn');
    await esperar(pg, () => !document.querySelector('#library > li.momento'));
    const ocultos = await pg.evaluate(() => ({
      recolhidos: document.querySelectorAll('#library > li.recolhido').length,
      grupos: document.querySelectorAll('#library > :is(.grupo-ini, .grupo-meio, .grupo-fim)').length,
      apelo: [...document.querySelectorAll('#library > li.lib-item .row-name')].some((x) => x.textContent === 'Apelo'),
    }));
    await abrirFaixa();
    await pg.click('#itinMomentosBtn');
    await esperar(pg, () => document.querySelectorAll('#library > li.lib-item').length === 9);
    const devolta = await pg.evaluate(() => ({
      recolhidos: document.querySelectorAll('#library > li.recolhido').length,
      ocultas: document.querySelectorAll('#library > [data-ocultas]').length,
    }));
    checar(ocultos.recolhidos === 0 && ocultos.grupos === 0 && ocultos.apelo === true
      && devolta.recolhidos === 0 && devolta.ocultas === 0,
      'G′ · com os momentos OCULTOS nada fica recolhido; de volta, a lista volta inteira (sem `recolhido` nem `data-ocultas`)',
      { ocultos, devolta });
  }

  // ── Z. AS ANIMAÇÕES DO PACOTE 37 ─────────────────────────────────────────
  // A régua é o QUADRO INTERMEDIÁRIO, nunca o estado final: "animado" aqui quer dizer
  // que a altura da faixa, o topo da lista e a altura das linhas que saem passam por
  // valores ENTRE o antes e o depois. Quem pediu menos movimento no sistema não vê
  // nenhuma das três, e a troca é seca — mas correta.
  {
    await pg.evaluate(async () => {
      itinAjusteZerar();
      for (const x of await AVDB.listItems('imports')) await AVDB.listRemove('imports', x.id);
      const msg = (n) => AVDB.addCue('message', { text: n }, { name: n, list: 'imports' });
      const mom = (n, min) => AVDB.addCue('momento', { min }, { name: n, list: 'imports' });
      await msg('Aviso solto'); await mom('Recepção', 540); await msg('Boas-vindas'); await mom('Louvor', 600);
      await msg('Hino 1'); await mom('Pregação', 630); await load();
    });
    await esperar(pg, () => document.querySelectorAll('#library > li.lib-item').length === 6);
    await fecharFaixa();
    // (1) A FAIXA: a altura e o topo da lista atravessam o meio.
    const faixaQ = await pg.evaluate(() => new Promise((ok) => {
      const b = document.getElementById('itinBar'), l = document.getElementById('library');
      const v = [], t0 = performance.now();
      itinFaixaAlternar(true);
      const passo = () => {
        v.push([Math.round(b.getBoundingClientRect().height * 10) / 10, Math.round(l.getBoundingClientRect().top * 10) / 10]);
        if (performance.now() - t0 < 340) requestAnimationFrame(passo); else ok(v);
      };
      requestAnimationFrame(passo);
    }));
    const alturas = faixaQ.map((q) => q[0]), topos = faixaQ.map((q) => q[1]);
    const alto = alturas[alturas.length - 1];
    const meioAlt = alturas.filter((h) => h > 1 && h < alto - 1).length;
    const meioTopo = topos.filter((t) => t > topos[0] + 1 && t < topos[topos.length - 1] - 1).length;
    // O +5 NO EXTREMO NÃO É VERMELHO: o vermelho é dos três de ESTADO (pedido de
    // 16/11). No extremo do atraso o passo fica DESATIVADO pelo véu do deck — cartão
    // `--surface` e opacidade apagada —, não pelo par do volume.
    await pg.evaluate(() => itinAjustar(720));
    const limite = await pg.evaluate(() => {
      const b = [...document.querySelectorAll('#itinBar .itin-passo')].find((x) => x.textContent.trim() === '+5');
      const st = getComputedStyle(b);
      return { dis: b.disabled, op: +st.opacity, fundo: st.backgroundColor };
    });
    await pg.evaluate(() => itinAjusteZerar());
    checar(limite.dis === true && limite.op < 0.5 && !/93, 40, 46/.test(limite.fundo),
      'Z · o +5 no extremo do atraso fica DESATIVADO pelo véu do deck (cartão `--surface`, opacidade apagada) — '
      + 'o vermelho do volume NÃO é dele', limite);
    checar(alto > 30 && meioAlt >= 2 && meioTopo >= 2,
      'Z · a faixa ABRE DESLIZANDO: a altura dela E o topo do `#library` passam por valores intermediários — desde a '
      + 'v1.14.55 ela está no FLUXO, então quem empurra a lista é a mesma animação de altura e margem', { alto, meioAlt, meioTopo, topos: [...new Set(topos)] });
    // (2) OS MOMENTOS NA LISTA: as linhas do momento encolhem antes de sumir.
    const ocultaQ = await pg.evaluate(() => new Promise((ok) => {
      const v = [], t0 = performance.now();
      itinMomentosOcultar(true);
      const passo = () => {
        v.push({ n: document.querySelectorAll('#library > li.lib-item').length,
          saindo: document.querySelectorAll('#library > .saindo').length,
          alt: [...document.querySelectorAll('#library > li.momento')].map((l) => Math.round(l.getBoundingClientRect().height)) });
        if (performance.now() - t0 < 460) requestAnimationFrame(passo); else ok(v);
      };
      requestAnimationFrame(passo);
    }));
    const h0 = (ocultaQ[0].alt || [0])[0];
    const comSaindo = ocultaQ.filter((q) => q.saindo > 0);
    const encolhendo = comSaindo.some((q) => q.alt.some((h) => h > 0 && h < h0 - 1));
    checar(comSaindo.length >= 2 && encolhendo && ocultaQ[0].n === 6 && ocultaQ[ocultaQ.length - 1].n === 3,
      'Z · OCULTAR os momentos não é um corte: as linhas do momento vestem a saída (`.saindo`) e ENCOLHEM de uma '
      + 'altura medida até zero antes de o desenho seguinte tirá-las da lista', { quadros: comSaindo.length, encolhendo, h0 });
    // (3) E ELAS VOLTAM ENTRANDO: a classe `linha-entra` é o lado CSS da entrada.
    const entrada = await pg.evaluate(() => {
      itinMomentosOcultar(false);
      const els = [...document.querySelectorAll('#library > .linha-entra')];
      return { n: els.length, anim: els.map((l) => l.getAnimations().map((a) => a.animationName + ':' + Math.round(a.effect.getTiming().duration)).join()) };
    });
    checar(entrada.n === 3 && entrada.anim.every((a) => /^linha-entra:200$/.test(a)),
      'Z · MOSTRAR de volta traz as TRÊS linhas de momento com a entrada viva (`linha-entra`, a duração de '
      + '`--dur-media`)', entrada);
    // (4) O GRUPO: recolher um momento encolhe as mídias dele, e o colegas de baixo sobem.
    const grupoQ = await pg.evaluate(() => new Promise((ok) => {
      const v = [], t0 = performance.now();
      const li = [...document.querySelectorAll('#library > li.lib-item.momento')]
        .find((l) => l.querySelector('.row-name').textContent === 'Louvor');
      itinAlternarGrupo(li.dataset.id, 1);
      const passo = () => {
        v.push({ saindo: document.querySelectorAll('#library > .saindo').length,
          alt: [...document.querySelectorAll('#library > .saindo')].map((l) => Math.round(l.getBoundingClientRect().height)) });
        if (performance.now() - t0 < 420) requestAnimationFrame(passo); else ok(v);
      };
      requestAnimationFrame(passo);
    }));
    const gSaindo = grupoQ.filter((q) => q.saindo > 0);
    const gMeio = gSaindo.some((q) => q.alt.some((h) => h > 0 && h < 50));
    const recolhido = await pg.evaluate(() => [...document.querySelectorAll('#library > li.recolhido')]
      .map((l) => l.querySelector('.row-name').textContent).join());
    checar(gSaindo.length >= 2 && gMeio && recolhido === 'Louvor',
      'Z · RECOLHER O GRUPO também anima: a mídia do momento veste a saída e encolhe até zero, e o momento só então '
      + 'ganha `.recolhido`', { quadros: gSaindo.length, gMeio, recolhido });
    // (5) `prefers-reduced-motion`: nenhuma das três acontece.
    await pg.emulateMedia({ reducedMotion: 'reduce' });
    const seco = await pg.evaluate(() => new Promise((ok) => {
      itinMomentosOcultar(true);
      setTimeout(() => ok({ saindo: document.querySelectorAll('#library > .saindo').length,
        n: document.querySelectorAll('#library > li.lib-item').length }), 80);
    }));
    await pg.evaluate(() => itinMomentosOcultar(false));
    await esperar(pg, () => document.querySelectorAll('#library > li.lib-item').length === 6);
    await pg.emulateMedia({ reducedMotion: 'no-preference' });
    checar(seco.saindo === 0 && seco.n === 3,
      'Z · e com `prefers-reduced-motion` a troca é SECA: nenhuma linha veste `saindo` e a lista já está no estado '
      + 'final', seco);
  }

  // ── G″. O CORPO DO CARD DO MOMENTO SAIU (v1.14.62) ───────────────────────
  // O pedido do Pacote 42: *"considere remover o 'card' em que eles estão, pois
  // tecnicamente esse card é transparente, seu corpo não existe para os momentos do
  // itinerario, a ideia dos momentos é ser mais apenas uma lista de tópicos"*. Até a
  // v1.14.57 o corpo era o `padding` vertical do `.row` (5,6 em cima e embaixo): ele
  // não pintava nada, só ocupava altura. Aqui se mede DE NOVO, e não se herda: (1) o
  // corpo sumiu — `li` e `.row` transparentes, ZERO de padding vertical, sem borda
  // nem sombra; (2) a LINHA mede o próprio conteúdo, o piso de toque `--hit`; (3) a
  // DISTÂNCIA entre dois momentos consecutivos é a altura da linha mais o `gap` da
  // lista (`--sp-3`), o respiro de uma linha de tópico; (4) o ALVO de cada momento é
  // a linha inteira e `elementFromPoint` no centro acha um elemento de dentro dela;
  // (5) o EIXO do nome não mudou com a remoção (o `padding-left` de .5rem e o `gap`
  // de `--sp-4` continuam os mesmos). O respiro do GRUPO (a margem de `--sp-4`) NÃO
  // é tocado: é outra caixa, e o Pacote 42 a deixa fora.
  {
    await pg.evaluate(async () => {
      itinAjusteZerar();
      for (const x of await AVDB.listItems('imports')) await AVDB.listRemove('imports', x.id);
      const nomes = ['Recepção', 'Aviso', 'Louvor', 'Oração', 'Hino', 'Pregação', 'Apelo', 'Bênção',
        'Encerramento', 'Saída', 'Coral', 'Mensagem', 'Oferta', 'Leitura', 'Testemunho', 'Vigília'];
      for (let i = 0; i < nomes.length; i++) {
        await AVDB.addCue('momento', { min: 540 + i * 15 }, { name: nomes[i], list: 'imports' });
      }
      await load();
    });
    const dezesseis = await esperar(pg, () => document.querySelectorAll('#library > li.momento').length === 16);
    await fecharFaixa();
    const medirLinhas = () => pg.evaluate(() => {
      const lib = document.getElementById('library');
      const lr = lib.getBoundingClientRect(), csLib = getComputedStyle(lib);
      const lis = [...document.querySelectorAll('#library > li.momento')];
      const dados = lis.map((li) => {
        const row = li.querySelector('.row');
        const r = row.getBoundingClientRect(), l = li.getBoundingClientRect();
        const cs = getComputedStyle(row), ls = getComputedStyle(li);
        const hora = li.querySelector('.momento-hora').getBoundingClientRect();
        const nome = li.querySelector('.row-name').getBoundingClientRect();
        const alvo = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
        return {
          titulo: li.querySelector('.row-name').textContent,
          linha: +l.height.toFixed(2), caixa: +r.height.toFixed(2), topo: +r.top.toFixed(2),
          fundo: [cs.backgroundColor, ls.backgroundColor],
          padV: [cs.paddingTop, cs.paddingBottom], padL: parseFloat(cs.paddingLeft),
          bordaV: [cs.borderTopWidth, cs.borderBottomWidth], sombra: cs.boxShadow,
          eixo: +(nome.left - hora.right).toFixed(2), gapDoTexto: parseFloat(cs.columnGap),
          // A ALTURA DO TEXTO é o outro lado da régua: a linha mede o MAIOR entre ele e o
          // piso `--hit` — com a fonte do sistema maior, é o texto que manda (a regra é a
          // mesma de toda linha da lista), e o oráculo não pode apostar num número de hoje.
          textoH: +li.querySelector('.row-text').getBoundingClientRect().height.toFixed(2),
          dentro: !!(alvo && li.contains(alvo)),
          botoes: [...li.querySelectorAll('.row > .row-acoes--solta > button')]
            .filter((b) => b.getClientRects().length)
            .map((b) => +Math.min(b.getBoundingClientRect().width, b.getBoundingClientRect().height).toFixed(2)),
        };
      });
      return {
        hit: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hit')),
        gap: parseFloat(csLib.rowGap), libH: +lr.height.toFixed(2),
        padTopo: parseFloat(csLib.paddingTop),
        passo: dados.length > 1 ? +(dados[1].topo - dados[0].topo).toFixed(2) : null,
        cabem: dados.filter((x) => x.topo >= lr.top - 0.5 && x.topo + x.caixa <= lr.bottom + 0.5).length,
        dados,
      };
    });
    const semFaixa = await medirLinhas();
    const d = semFaixa.dados[0];
    const transp = (c) => c === 'rgba(0, 0, 0, 0)' || c === 'transparent';
    checar(dezesseis === true && semFaixa.dados.length === 16,
      'G″ · ponto de partida: 16 momentos consecutivos (só momentos, nenhuma mídia entre eles) desenhados na lista', porque(dezesseis));
    checar(d.fundo.every(transp) && d.padV.every((v) => v === '0px')
      && d.bordaV.every((v) => v === '0px') && d.sombra === 'none',
      'G″ · o CORPO do card do momento SAIU: o `li` e a `.row` não pintam fundo, o `padding` vertical da `.row` é ZERO, '
      + 'sem borda e sem sombra — a linha foi reduzida ao próprio conteúdo', d);
    checar(Math.abs(d.caixa - Math.max(semFaixa.hit, d.textoH)) <= 0.5 && Math.abs(d.linha - d.caixa) <= 0.5,
      'G″ · e a LINHA mede o MAIOR entre o conteúdo e o piso de toque: ' + d.caixa + 'px = max(`--hit` ' + semFaixa.hit
      + ', texto ' + d.textoH + ') — o texto e os botões cabem dentro, e nenhum padding de card a infla',
      { caixa: d.caixa, linha: d.linha, hit: semFaixa.hit, textoH: d.textoH });
    checar(semFaixa.dados.every((x) => Math.abs(x.caixa - Math.max(semFaixa.hit, x.textoH)) <= 0.5),
      'G″ · TODOS os 16 momentos têm a MESMA altura (' + d.caixa + 'px): a mesma régua, sem nenhum estado inflando um '
      + 'deles', semFaixa.dados.map((x) => x.caixa));
    checar(Math.abs(semFaixa.passo - (d.caixa + semFaixa.gap)) <= 0.5 && semFaixa.passo <= semFaixa.hit + semFaixa.gap + 0.5,
      'G″ · e a DISTÂNCIA entre dois momentos consecutivos é a linha mais o `gap` da lista (`--sp-3`): '
      + semFaixa.passo + 'px (' + d.caixa + ' + ' + semFaixa.gap + ') — o respiro de uma linha de tópico, '
      + 'não o passo de um card', { passo: semFaixa.passo, caixa: d.caixa, gap: semFaixa.gap });
    checar(semFaixa.dados.every((x) => x.caixa >= semFaixa.hit - 0.5 && x.dentro),
      'G″ · o ALVO de cada momento é a própria linha: ' + semFaixa.hit + 'px ou mais de `getBoundingClientRect`, e '
      + '`elementFromPoint` no centro dela devolve um elemento de dentro do `li`', semFaixa.dados.slice(0, 3));
    checar(d.padL === 8 && Math.abs(d.eixo - d.gapDoTexto) <= 0.5,
      'G″ · o EIXO do nome não mudou ao remover o corpo: o horário começa a ' + d.padL + 'px da borda da linha (o '
      + '`padding-left` de .5rem) e o nome a ' + d.eixo + 'px do horário (o `gap` de `--sp-4`, ' + d.gapDoTexto + 'px)', d);
    // COM A FAIXA ABERTA os comandos voltam ao desenho (lápis e lixeira); a linha
    // continua nos 34px e os botões continuam com o alvo `--hit`.
    await abrirFaixa();
    const aberta = await medirLinhas();
    const da = aberta.dados[0];
    checar(aberta.dados.every((x) => Math.abs(x.caixa - Math.max(aberta.hit, x.textoH)) <= 0.5
      && x.botoes.length === 2 && x.botoes.every((b) => b >= aberta.hit - 0.5) && x.dentro),
      'G″ · e com a faixa ABERTA (lápis e lixeira no desenho) a linha continua em ' + da.caixa + 'px por momento, '
      + 'com os dois botões no alvo `--hit` e o centro ainda dentro do `li`', { caixa: da.caixa, botoes: da.botoes, hit: aberta.hit });
    await fecharFaixa();
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
