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
//  I. Lista vazia: o projetar é APAGADO e diz por quê; esvaziar no ar tira do telão.
//
// O RELÓGIO É O DO PLAYWRIGHT (`ctx.clock`), num fuso declarado
// (`America/Sao_Paulo`): é ele que faz "10:00" ser 10:00 em qualquer runner.
//
//   node tools/itinerario.test.mjs
// ============================================================================
import { semRedeExterna } from './sem-rede.mjs';
import {
  servirEstatico, abrirNavegador, checar, falhas, RAIZ_WEB, esperar, porque,
  esperarCortina, comModoAvancado,
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

  const adicionar = async (hora, titulo) => {
    await pg.fill('.itin-novo .itin-campo-hora', hora);
    await pg.fill('.itin-novo .itin-campo-titulo', titulo);
    await pg.click('.itin-novo .itin-add');
  };
  // FORA DE ORDEM de propósito.
  await adicionar('10:00', 'Louvor');
  await adicionar('09:00', 'Recepção');
  await adicionar('10:30', 'Sermão');
  await adicionar('11:00', 'Bênção');
  const lista = () => pg.evaluate(() => [...document.querySelectorAll('#itinLista .itin-item')]
    .map((b) => b.querySelector('.itin-item-hora').textContent + ' ' + b.querySelector('.itin-item-titulo').textContent));
  checar((await lista()).join(' · ') === '09:00 Recepção · 10:00 Louvor · 10:30 Sermão · 11:00 Bênção',
    'B · adicionados fora de ordem, a lista do painel sai pelo horário', await lista());
  const banco = () => pg.evaluate(() => AVDB.getState('itinerario'));
  {
    const b = await banco();
    checar(b && Array.isArray(b.itens) && b.itens.map((x) => x.titulo).join('|') === 'Recepção|Louvor|Sermão|Bênção',
      'B · e ela está no banco (`state.itinerario`), na mesma ordem', b);
  }

  // EDITAR: o "Sermão" vira "Pregação" às 10:40.
  await pg.evaluate(() => [...document.querySelectorAll('#itinLista .itin-item')]
    .find((b) => /Sermão/.test(b.textContent)).click());
  await pg.fill('.itin-editor .itin-campo-hora', '10:40');
  await pg.fill('.itin-editor .itin-campo-titulo', 'Pregação');
  await pg.click('.itin-editor .itin-salvar');
  checar((await lista()).includes('10:40 Pregação'), 'B · editar uma linha troca horário e título', await lista());
  // EXCLUIR pergunta (o diálogo do app) e só então apaga.
  await pg.evaluate(() => [...document.querySelectorAll('#itinLista .itin-item')]
    .find((b) => /Bênção/.test(b.textContent)).click());
  await pg.click('.itin-editor .itin-del');
  await esperar(pg, () => !document.getElementById('appDialog').hidden);
  await pg.click('#appDialogOk');
  await esperar(pg, () => ![...document.querySelectorAll('.itin-item')].some((b) => /Bênção/.test(b.textContent)));
  checar((await lista()).join(' · ') === '09:00 Recepção · 10:00 Louvor · 10:40 Pregação',
    'B · excluir (com a pergunta) tira a linha', await lista());
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
    painel: [...document.querySelectorAll('#itinLista .itin-item.agora .itin-item-titulo')].map((e) => e.textContent),
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

  // ── I. ESVAZIAR NO AR TIRA DO TELÃO ──────────────────────────────────────
  await pg.evaluate(() => { [...itin.itens].forEach((x) => itinExcluir(x.id)); });
  await esperar(pg, () => document.getElementById('pvText').hidden || !itinProjecting());
  {
    const r = await pg.evaluate(() => ({
      noAr: itinProjecting(),
      btn: document.getElementById('miscProjectBtn') && document.getElementById('miscProjectBtn').disabled,
    }));
    checar(!r.noAr && r.btn, 'I · a lista que esvazia no ar sai do telão, e o projetar volta apagado', r);
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
