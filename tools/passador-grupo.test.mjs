#!/usr/bin/env node
// ============================================================================
// O CARTÃO DO PASSADOR DE SLIDES — os dois rótulos, o grupo e a mensagem
//
// ## Por que ele existe
//
// Duas vezes o operador leu esta peça errado, e as duas pelo mesmo motivo:
// **o que se compartilha não estava dito na tela.** Na v1.14.57 os dois botões
// viraram ícones sozinhos (o pedido da época era cortar o segundo endereço), e
// no dia seguinte o relato foi literal: *"nenhum deles deixa claro o que ele
// está compartilhando"* e *"o card desses botões e a parte da mensagem do link
// estão ficando visualmente tratados como não do mesmo grupo ou ação"*.
//
// O modo de falhar desta peça é MUDO: nenhuma das duas coisas quebra o app. Um
// botão só de ícone continua copiando o link certo, e o campo do número continua
// abrindo o WhatsApp — o defeito é o operador NÃO SABER o que o toque faz, e
// isso não aparece em erro, em log nem em layout.
//
// Por isso este oráculo mede o que se VÊ e o que se RECEBE:
//
//  A. **OS DOIS RÓTULOS** — texto visível e nome acessível "Copiar link" e
//     "Enviar no WhatsApp", com o ícone AO LADO do texto (não no lugar dele), e
//     o grupo nomeado ("Passador de slides") para o leitor de tela.
//  B. **O VALOR COPIADO** — a área de transferência recebe o LINK DO SITE (a
//     página pública), e não o endereço do aparelho nem a mensagem inteira. É o
//     contrato da v1.14.59: quem copia leva o endereço que o WhatsApp
//     reconhece.
//  C. **O TEXTO DA MENSAGEM** — o `?text=` do `wa.me` é EXATAMENTE as duas
//     linhas que a folha mostra em `#passadorMsg`, e o `55` entra sozinho no
//     número digitado com DDD. As duas pontas da mesma função: a tela e o
//     WhatsApp não podem divergir.
//  D. **O GRUPO É UM** — os dois botões, a mensagem e a linha do número moram
//     no MESMO cartão (`#passadorGrupo`), com a MESMA superfície e o mesmo raio
//     do cartão do endereço; a linha do número não pinta superfície própria. A
//     prova é estrutural (a árvore e o `getComputedStyle`), não uma opinião.
//  E. **A MENSAGEM CABE** — nenhuma linha cortada (`scrollWidth` ×
//     `clientWidth`), nada estourando o cartão, as duas linhas DESENHADAS (a
//     `pre-line` viva), e o texto SELECIONÁVEL (o reset do app põe
//     `user-select: none !important` em `*`; sem `!important` aqui o bloco fica
//     com o texto na tela e nada para copiar).
//  F. **A GEOMETRIA** — 390×844 e 360×640: a largura de cada botão, o rótulo
//     truncado (`scrollWidth > clientWidth` no `<span>`) e o alvo de toque
//     contra o `--hit` do app, lido do `:root` — nunca digitado.
//
//   node tools/passador-grupo.test.mjs
// ============================================================================
import { servirEstatico, abrirNavegador, checar, falhas, esperar, esperarDb, porque, RAIZ_WEB, comModoAvancado } from './arnes.mjs';
import { semRedeExterna } from './sem-rede.mjs';

const ENDERECO = 'http://192.168.0.14:8787';
const LINK = 'https://audiovisualiasd.com.br/passador?h=192.168.0.14:8787';
const MENSAGEM = LINK + '\nSe o link não abrir, use: 192.168.0.14:8787';

const servidor = servirEstatico(RAIZ_WEB);
await new Promise((r) => servidor.listen(0, r));
// `localhost` é contexto seguro, como o `https://appassets.…` do aparelho: é o
// que deixa a Clipboard API responder — e o `copiarTexto` do app usa ELA.
const BASE = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador();

// O CENÁRIO: a folha de conectar com a transmissão LIGADA. É o único estado em
// que o cartão do passador existe (`#castLive.aberto`), e o endereço entra por
// `mirrorEstado` — a MESMA variável que a enquete do shell escreve no aparelho.
const preparar = async (pg) => {
  await pg.evaluate((end) => {
    setAppMode('full');
    abrirCast();
    mirrorEstado = { ligado: true, endereco: end, via: 'WIFI', telas: [{ rotulo: 'tela A', pronta: true }] };
    renderCast();
  }, ENDERECO);
  const abriu = await esperar(pg, () => document.getElementById('castLive').classList.contains('aberto'));
  if (abriu !== true) return abriu;
  // A ALTURA DA FOLHA ANIMA (`grid-template-rows: 0fr → 1fr`, `--dur-lenta`):
  // medir no meio da subida é medir o desenho por acidente, e a régua da folha
  // sairia 133px num cartão que ocupa 382 — o prazo do `getAnimations` é o sinal
  // do navegador, não um `waitForTimeout`.
  await pg.evaluate(() => Promise.all(
    document.querySelector('#castLive').getAnimations({ subtree: true })
      .map((a) => a.finished.catch(() => {}))));
  return true;
};

// A RÉGUA DE UMA CAIXA. O `truncado` é medido no nó que ROLA (aqui o `<span>`
// do rótulo, não o botão, que pode recortar sem dizer): `scrollWidth >
// clientWidth` é o único jeito de provar "o texto não cabe" — o defeito que num
// aparelho de 360 px aparece como "Enviar no WhatsA…".
const CAIXA = `(el) => {
  if (!el) return null;
  const b = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return {
    x: Math.round(b.x * 10) / 10, y: Math.round(b.y * 10) / 10,
    w: Math.round(b.width * 10) / 10, h: Math.round(b.height * 10) / 10,
    clientW: el.clientWidth, scrollW: el.scrollWidth,
    truncado: el.scrollWidth > el.clientWidth + 1,
    texto: (el.textContent || '').replace(/\\s+/g, ' ').trim(),
    fundo: cs.backgroundColor, raio: cs.borderRadius,
    select: cs.userSelect || cs.webkitUserSelect,
  };
}`;

const medir = (pg) => pg.evaluate(`(() => {
  const caixa = ${CAIXA};
  const grupo = document.getElementById('passadorGrupo');
  const folha = document.querySelector('#castPopup .popup-sheet');
  const endereco = document.querySelector('.cast-addr');
  const zap = document.getElementById('castZap');
  const msg = document.getElementById('passadorMsg');
  const hit = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hit'));
  const botoes = ['passadorCopyBtn', 'passadorZapBtn'].map((id) => {
    const b = document.getElementById(id);
    const rotulo = b && b.querySelector('span');
    const ico = b && b.querySelector('svg');
    const rb = rotulo && rotulo.getBoundingClientRect();
    const ri = ico && ico.getBoundingClientRect();
    return Object.assign(caixa(b), {
      nome: b ? (b.getAttribute('aria-label') || (b.textContent || '').replace(/\\s+/g, ' ').trim()) : '',
      ariaLabel: b ? b.getAttribute('aria-label') : null,
      rotulo: caixa(rotulo),
      // O ÍCONE É DO LADO DO TEXTO, não no lugar dele: à esquerda e na mesma
      // linha de centro (2 px de folga para o arredondamento do layout).
      iconeAntes: !!(rb && ri && ri.right <= rb.left + 1
        && Math.abs((ri.top + ri.height / 2) - (rb.top + rb.height / 2)) <= 2),
    });
  });
  const paiDosBotoes = document.getElementById('passadorCopyBtn')
    ? document.getElementById('passadorCopyBtn').parentElement : null;
  const rotuloDoGrupo = grupo && grupo.getAttribute('aria-labelledby')
    ? document.getElementById(grupo.getAttribute('aria-labelledby')) : null;
  return {
    hit,
    grupo: caixa(grupo),
    folha: caixa(folha),
    endereco: caixa(endereco),
    msg: caixa(msg),
    msgLinhas: msg ? msg.textContent.split('\\n').length : 0,
    msgAlturaLinha: msg ? parseFloat(getComputedStyle(msg).lineHeight) : 0,
    zap: caixa(zap),
    zapAberto: zap ? !zap.hidden : false,
    papel: grupo ? grupo.getAttribute('role') : null,
    nomeDoGrupo: rotuloDoGrupo ? rotuloDoGrupo.textContent.trim() : '',
    dentroDoGrupo: grupo ? ['passadorCopyBtn', 'passadorZapBtn', 'passadorMsg', 'castZap']
      .every((id) => grupo.contains(document.getElementById(id))) : false,
    paiDosBotoes: paiDosBotoes ? paiDosBotoes.className : '',
    // A ORDEM É A DA DECISÃO: ações, depois o que vai, depois para quem.
    ordem: grupo ? ['passadorCopyBtn', 'passadorMsg', 'castZap'].map((id) => {
      const r = document.getElementById(id).getBoundingClientRect();
      return Math.round(r.top * 10) / 10;
    }) : [],
    sobrouExtras: !!document.querySelector('.cast-extras'),
    botoes,
  };
})()`);

const TELAS = [
  { nome: '390x844', width: 390, height: 844 },
  { nome: '360x640', width: 360, height: 640 },
];

// O que NÃO é erro nosso no console: a base web fala com a LouvorJA na carga, e
// neste ambiente (e no `semRedeExterna`) esses pedidos morrem. Ver `sem-rede.mjs`.
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY|ERR_FAILED|ERR_ABORTED/;

const vistas = {};
try {
  for (const tela of TELAS) {
    const ctx = await navegador.newContext({ viewport: { width: tela.width, height: tela.height }, deviceScaleFactor: 1 });
    await semRedeExterna(ctx);
    await comModoAvancado(ctx);
    try { await ctx.grantPermissions(['clipboard-read', 'clipboard-write']); } catch (_) { /* sem permissão a leitura falha abaixo, com frase */ }
    const pg = await ctx.newPage();
    const erros = [];
    pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
    pg.on('console', (m) => {
      if (m.type() !== 'error') return;
      const t = m.text();
      if (EXTERNO.test(t) || /Failed to load resource/.test(t)) return;
      erros.push(t);
    });
    await pg.goto(BASE + '/controle/', { waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(
      () => window.AVDB && typeof abrirCast === 'function' && typeof renderCast === 'function',
      null, { timeout: 40000 },
    );
    const cenario = await preparar(pg);
    checar(cenario === true,
      `a folha de conectar abre com a transmissão LIGADA a ${tela.nome}`, porque(cenario));

    const m = await medir(pg);

    // ---- A. OS DOIS RÓTULOS ------------------------------------------------
    const [copiar, zap] = m.botoes;
    checar(copiar && zap && copiar.texto === 'Copiar link' && zap.texto === 'Enviar no WhatsApp',
      'os dois botões dizem o que fazem, com texto visível',
      `${copiar && copiar.texto} | ${zap && zap.texto}`);
    checar(copiar.nome === 'Copiar link' && zap.nome === 'Enviar no WhatsApp',
      'e o NOME ACESSÍVEL é o mesmo texto — um leitor de tela lê a ação',
      `${copiar.nome} | ${zap.nome}`);
    checar(copiar.ariaLabel === null && zap.ariaLabel === null,
      'sem `aria-label` divergindo do rótulo (o nome sai do conteúdo, como no resto do app)');
    checar(copiar.iconeAntes && zap.iconeAntes,
      'o ícone fica AO LADO do texto (à esquerda, mesma linha de centro)',
      `${copiar.iconeAntes} | ${zap.iconeAntes}`);
    checar(m.papel === 'group' && m.nomeDoGrupo === 'Passador de slides',
      'o cartão é um GRUPO nomeado — "Passador de slides" diz o que se compartilha',
      `${m.papel} · ${m.nomeDoGrupo}`);

    // ---- B. O VALOR COPIADO ------------------------------------------------
    await pg.click('#passadorCopyBtn');
    const copiou = await esperarDb(pg,
      (esperado) => navigator.clipboard.readText().then((t) => t === esperado), LINK, 8000);
    checar(copiou === true, 'o "Copiar link" põe o LINK DO SITE na área de transferência', porque(copiou));
    const copiado = await pg.evaluate(() => navigator.clipboard.readText().catch(() => ''));
    checar(copiado === LINK,
      'e o valor é exatamente a página pública — nem o endereço do aparelho, nem a mensagem',
      JSON.stringify(copiado));

    // ---- D. O GRUPO É UM ---------------------------------------------------
    checar(m.dentroDoGrupo && !m.sobrouExtras,
      'os dois botões, a mensagem e a linha do número estão no MESMO cartão',
      `${m.dentroDoGrupo} · sobrou .cast-extras: ${m.sobrouExtras}`);
    checar(m.grupo.fundo === m.endereco.fundo && m.grupo.raio === m.endereco.raio,
      'e o cartão tem a MESMA superfície e o mesmo raio do cartão do endereço (o vocabulário do app)',
      `${m.grupo.fundo} / ${m.grupo.raio} contra ${m.endereco.fundo} / ${m.endereco.raio}`);
    checar(m.zap.fundo === 'rgba(0, 0, 0, 0)',
      'a linha do número NÃO pinta superfície própria — seria o "segundo cartão" de novo', m.zap.fundo);
    checar(m.ordem[0] < m.ordem[1],
      'e os botões vêm ACIMA da mensagem que eles movem',
      m.ordem.slice(0, 2).join(' < '));

    // ---- E. A MENSAGEM CABE -------------------------------------------------
    checar(m.msg.texto === MENSAGEM.replace('\n', ' '),
      'a mensagem na tela é a que viaja, com as duas linhas da v1.14.59',
      JSON.stringify(m.msg.texto));
    checar(m.msgLinhas === 2 && m.msg.h >= m.msgAlturaLinha * 2 - 1,
      'as duas linhas estão DESENHADAS (a `pre-line` viva, nada colapsado)',
      `${m.msgLinhas} linha(s), ${m.msg.h}px para entrelinha de ${m.msgAlturaLinha}px`);
    checar(!m.msg.truncado && m.msg.x >= m.grupo.x - 0.5 && m.msg.x + m.msg.w <= m.grupo.x + m.grupo.w + 0.5,
      'e nada é cortado nem estoura para o lado do cartão',
      `${m.msg.w}px de caixa, ${m.msg.scrollW}px de conteúdo`);
    checar(m.msg.select === 'text',
      'o texto é SELECIONÁVEL (o reset do app põe `user-select: none !important` em `*`)', m.msg.select);

    // ---- F. A GEOMETRIA -----------------------------------------------------
    checar(copiar.h >= m.hit && zap.h >= m.hit,
      `os dois alvos cumprem o --hit (${m.hit}px)`, `${copiar.h}px · ${zap.h}px`);
    for (const b of m.botoes) {
      checar(!b.truncado && b.rotulo && !b.rotulo.truncado,
        `o rótulo "${b.rotulo && b.rotulo.texto}" cabe inteiro em ${b.w}px`,
        b.rotulo ? `${b.rotulo.scrollW}/${b.rotulo.clientW}` : 'sem rótulo');
    }
    checar(m.grupo.x >= m.folha.x - 0.5 && m.grupo.x + m.grupo.w <= m.folha.x + m.folha.w + 0.5,
      'o grupo cabe na largura da folha', `${m.grupo.w}px de ${m.folha.w}px`);

    // ---- C. O TEXTO DA MENSAGEM --------------------------------------------
    await pg.evaluate(() => {
      window.__zap = null;
      window.open = (u) => { window.__zap = u; return null; };
      document.getElementById('passadorZapBtn').click();
    });
    await esperar(pg, () => !document.getElementById('castZap').hidden, null, 5000);
    const aberto = await medir(pg);
    checar(aberto.zapAberto && aberto.botoes[1].texto === 'Enviar no WhatsApp',
      'o MESMO botão abre a linha do número, e continua dizendo o que faz');
    checar(aberto.ordem[0] < aberto.ordem[1] && aberto.ordem[1] < aberto.ordem[2],
      'e a ordem é a da decisão: ações, a mensagem que viaja, a linha do número',
      aberto.ordem.join(' < '));
    checar(aberto.botoes[1].fundo !== m.botoes[1].fundo,
      'e a linha aberta muda o estado do PRÓPRIO botão (nada de um "cartão de zona" novo)',
      `${aberto.botoes[1].fundo} contra ${m.botoes[1].fundo}`);

    await pg.fill('#passadorZapNum', '51 99999-9999');
    await pg.click('#passadorZapAbrir');
    const saiu = await esperar(pg, () => window.__zap !== null, null, 5000);
    const enviado = await pg.evaluate(() => window.__zap);
    let texto = '';
    try { texto = decodeURIComponent(String(enviado).split('?text=')[1] || ''); } catch (_) { texto = ''; }
    checar(saiu === true && String(enviado).startsWith('https://wa.me/5551999999999?text='),
      'o "Abrir" leva ao wa.me com o 55 no número digitado com DDD', enviado || porque(saiu));
    checar(texto === MENSAGEM,
      'e o `?text=` é exatamente a MESMA mensagem que a folha mostra, nas duas linhas',
      JSON.stringify(texto));

    checar(erros.length === 0, 'nenhum erro de página na folha do passador', erros.slice(0, 3).join(' | '));

    vistas[tela.nome] = m;
    await ctx.close();
  }
} finally {
  await navegador.close();
  await new Promise((r) => servidor.close(r));
}

// A GEOMETRIA IMPRESSA: o número que o relatório do lote cita sai daqui, da
// mesma execução que reprova — número medido à parte envelhece em um lote.
for (const [nome, m] of Object.entries(vistas)) {
  console.log(`  ${nome}: botões ${m.botoes.map((b) => b.w + 'x' + b.h).join(' · ')} px`
    + ` · rótulos ${m.botoes.map((b) => (b.rotulo ? b.rotulo.scrollW + '/' + b.rotulo.clientW : '?')).join(' · ')}`
    + ` · mensagem ${m.msg.w}x${m.msg.h} px · grupo ${m.grupo.w}px · folha ${m.folha.h}px`);
}

console.log('');
if (falhas.length) {
  console.log(`${falhas.length} FALHA(S) — o cartão do passador não diz o que compartilha, ou não é um grupo.`);
  process.exit(1);
}
console.log('O passador de slides é um cartão só: dois rótulos com nome acessível, o link copiado, a mensagem na tela e no WhatsApp, e nada cortado.');
