#!/usr/bin/env node
// ============================================================================
// O CARTÃO DO PASSADOR DE SLIDES — o título, a caixa do número, o botão-ícone
// e o "Copiar link"
//
// ## Por que ele existe
//
// Duas vezes o operador leu esta peça errado, e as duas pelo mesmo motivo:
// **o que se compartilha não estava dito na tela.** Na v1.14.57 os dois botões
// viraram ícones sozinhos, e o relato foi literal: *"nenhum deles deixa claro o
// que ele está compartilhando"*. Na v1.14.64 o cartão virou uma ação só, com os
// dois rótulos e a mensagem que viaja escrita nele — e em 17/11 o operador
// decidiu que o texto complementar sai: sobra o título, a caixa do número, o
// botão-ícone e o "Copiar link".
//
// O modo de falhar desta peça é MUDO: nada aqui quebra o app. Um botão sem
// nome acessível continua enviando, uma máscara que pula o cursor continua
// deixando digitar (mal), e o `?text=` com o endereço cru continua enviando
// duas linhas — o defeito não aparece em erro, em log nem em layout. Por isso
// este oráculo mede o que se VÊ, o que se RECEBE e o que se DIGITA:
//
//  A. **O CARTÃO TEM QUATRO COISAS, E SÓ ELAS** — o título, o input, o
//     botão-ícone e o "Copiar link". Nenhum texto complementar: nem
//     `#passadorMsg`, nem a linha "se o link não abrir…", nem a zona `#castZap`
//     com o segundo botão "Abrir".
//  B. **O NOME ACESSÍVEL** — o botão-ícone não tem texto visível, e tem
//     `aria-label`/`title` = "Enviar no WhatsApp": o pedido era "sem texto na
//     TELA", não "sem nome". O "Copiar link" continua dizendo que copia o link.
//  C. **O VALOR COPIADO** — a área de transferência recebe o LINK DO SITE.
//  D. **O QUE VIAJA** — o `?text=` do `wa.me` é EXATAMENTE o link, uma linha
//     só, com o `55` automático no número. Nada de endereço cru: a decisão do
//     operador (17/11) é que não há plano B escrito se a página não abrir.
//  E. **A MÁSCARA** — 1 a 11 dígitos em `(xx) x xxxx-xxxx`, a colagem com e
//     sem máscara e com `+55`, o fixo de 10 dígitos em `(xx) xxxx-xxxx`, a
//     edição no MEIO com o cursor preservado (a posição é recolocada por
//     DÍGITO, não por caractere) e o backspace sobre o separador apagando o
//     dígito anterior. O valor guardado são só dígitos.
//  F. **O FOCO** — o anel nativo do WebView (o amarelo que o operador viu) é o
//     `outline: auto`; aqui ele é zerado e substituído pelo anel de `--accent`
//     por `box-shadow`, que é o vocabulário do app. Quem navega por teclado
//     continua vendo onde está.
//  G. **A GEOMETRIA** — 390×844 e 360×640: nada truncado
//     (`scrollWidth <= clientWidth + 1`) no rótulo do "Copiar link", na caixa
//     do número COM os 11 dígitos mascarados e no botão-ícone, a linha única na
//     ordem `[Copiar link] [caixa] [ícone]`, a soma das três peças dentro da
//     largura útil do cartão e todo alvo ≥ o `--hit` lido do `:root`.
//
//   node tools/passador-grupo.test.mjs
// ============================================================================
import { servirEstatico, abrirNavegador, checar, falhas, esperar, esperarDb, porque, RAIZ_WEB, comModoAvancado } from './arnes.mjs';
import { semRedeExterna } from './sem-rede.mjs';

const ENDERECO = 'http://192.168.0.14:8787';
const LINK = 'https://audiovisualiasd.com.br/passador?h=192.168.0.14:8787';
// O MESMO IP DE EXEMPLO DOS OUTROS ORÁCULOS do passador.
const NUMERO = '51 99999-9999';
const NUMERO_MASCARADO = '(51) 9 9999-9999';
const NUMERO_DIGITOS = '51999999999';

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
  // medir no meio da subida é medir o desenho por acidente. O prazo do
  // `getAnimations` é o sinal do navegador, não um `waitForTimeout`.
  await pg.evaluate(() => Promise.all(
    document.querySelector('#castLive').getAnimations({ subtree: true })
      .map((a) => a.finished.catch(() => {}))));
  return true;
};

// A RÉGUA DE UMA CAIXA. O `truncado` é medido no nó que ROLA (o `<span>` do
// rótulo e o `<input>` do número): `scrollWidth > clientWidth` é o único jeito
// de provar "o texto não cabe" — o `ellipsis` da v1.14.64 e o número cortado.
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
    outline: cs.outline, outlineStyle: cs.outlineStyle, outlineWidth: cs.outlineWidth,
    boxShadow: cs.boxShadow,
  };
}`;

const medir = (pg) => pg.evaluate(`(() => {
  const caixa = ${CAIXA};
  const grupo = document.getElementById('passadorGrupo');
  const folha = document.querySelector('#castPopup .popup-sheet');
  const endereco = document.querySelector('.cast-addr');
  const copiar = document.getElementById('passadorCopyBtn');
  const zap = document.getElementById('passadorZapBtn');
  const num = document.getElementById('passadorZapNum');
  const linha = num ? num.parentElement : null;
  const rotuloCopiar = copiar && copiar.querySelector('span');
  const use = zap && zap.querySelector('use');
  const hit = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hit'));
  const gap = linha ? (parseFloat(getComputedStyle(linha).columnGap) || 0) : 0;
  const rCopiar = copiar && copiar.getBoundingClientRect();
  const rNum = num && num.getBoundingClientRect();
  const rZap = zap && zap.getBoundingClientRect();
  return {
    hit,
    gap,
    // A SOMA DAS TRÊS PEÇAS + OS DOIS VÃOS contra a largura útil da linha.
    soma: rCopiar && rNum && rZap ? Math.round((rCopiar.width + rNum.width + rZap.width + 2 * gap) * 10) / 10 : null,
    larguraDaLinha: linha ? Math.round(linha.clientWidth * 10) / 10 : null,
    // A ORDEM: [Copiar link] → [caixa] → [ícone], sem sobreposição.
    ordem: !!(rCopiar && rNum && rZap
      && rCopiar.right <= rNum.left + 0.5 && rNum.right <= rZap.left + 0.5),
    grupo: caixa(grupo),
    folha: caixa(folha),
    endereco: caixa(endereco),
    copiar: caixa(copiar),
    zap: caixa(zap),
    num: caixa(num),
    linha: caixa(linha),
    rotuloCopiar: caixa(rotuloCopiar),
    zapNome: zap ? zap.getAttribute('aria-label') : null,
    zapTitle: zap ? zap.getAttribute('title') : null,
    zapTexto: zap ? (zap.textContent || '').replace(/\\s+/g, ' ').trim() : null,
    zapIcone: use ? (use.getAttribute('href') || use.getAttribute('xlink:href')) : null,
    copiarNome: copiar ? (copiar.getAttribute('aria-label')
      || (copiar.textContent || '').replace(/\\s+/g, ' ').trim()) : null,
    papel: grupo ? grupo.getAttribute('role') : null,
    nomeDoGrupo: (() => {
      const id = grupo && grupo.getAttribute('aria-labelledby');
      const rot = id ? document.getElementById(id) : null;
      return rot ? rot.textContent.trim() : '';
    })(),
    // O TEXTO VISÍVEL do cartão, sem o valor do input (que não é textContent).
    textoDoCartao: (grupo ? grupo.innerText : '').replace(/\\s+/g, ' ').trim(),
    temMsg: !!document.getElementById('passadorMsg'),
    temZona: !!document.getElementById('castZap'),
    temAbrir: !!document.getElementById('passadorZapAbrir'),
    // OS TRÊS DIVIDEM A LINHA: mesmo topo. Desde a v1.14.67 o "Copiar link"
    // entra à ESQUERDA da caixa, na mesma linha — os três no mesmo topo, e a
    // ordem (copiar → caixa → ícone) é medida pelo campo ordem.
    mesmaLinha: !!(num && zap && copiar
      && Math.abs(num.getBoundingClientRect().top - zap.getBoundingClientRect().top) <= 1
      && Math.abs(copiar.getBoundingClientRect().top - num.getBoundingClientRect().top) <= 1),
    dentroDoGrupo: !!grupo && [copiar, num, zap].every((el) => !!el && grupo.contains(el)),
  };
})()`);

// A MÁSCARA, no navegador de verdade: o valor, o cursor e os dígitos.
const digitar = async (pg, texto) => {
  await pg.evaluate(() => { document.getElementById('passadorZapNum').value = ''; });
  await pg.focus('#passadorZapNum');
  await pg.keyboard.type(texto);
};
const estadoDoCampo = (pg) => pg.evaluate(() => {
  const c = document.getElementById('passadorZapNum');
  return {
    valor: c.value, caret: c.selectionStart,
    digitos: c.value.replace(/\D/g, ''),
    soDigitosNaTela: !/[^\d()\s-]/.test(c.value),
  };
});
const colarNumero = (pg, texto) => pg.evaluate((t) => {
  const c = document.getElementById('passadorZapNum');
  c.focus();
  c.value = t;
  c.dispatchEvent(new Event('input', { bubbles: true }));
}, texto);

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

    // ---- A. O CARTÃO TEM QUATRO COISAS, E SÓ ELAS -------------------------
    checar(m.dentroDoGrupo && !m.temMsg && !m.temZona && !m.temAbrir,
      'o cartão tem o título, o input, o botão-ícone e o "Copiar link" — e não sobrou prévia, zona nem segundo botão',
      `dentro: ${m.dentroDoGrupo} · msg: ${m.temMsg} · zona: ${m.temZona} · abrir: ${m.temAbrir}`);
    checar(m.textoDoCartao === 'PASSADOR DE SLIDES Copiar link',
      'e o texto visível do cartão é SÓ o título e o "Copiar link" (o número mora no campo)',
      JSON.stringify(m.textoDoCartao));
    checar(!/se o link n[ãa]o abrir/i.test(m.textoDoCartao)
      && !/endere[çc]o cru/i.test(m.textoDoCartao),
      'nenhuma ocorrência de "se o link não abrir" nem do endereço cru no cartão', m.textoDoCartao);
    checar(m.papel === 'group' && m.nomeDoGrupo === 'Passador de slides',
      'o cartão é um GRUPO nomeado — "Passador de slides" diz o que se compartilha',
      `${m.papel} · ${m.nomeDoGrupo}`);

    // ---- B. O NOME ACESSÍVEL ---------------------------------------------
    checar(m.copiarNome === 'Copiar link' && m.rotuloCopiar && m.rotuloCopiar.texto === 'Copiar link',
      'o "Copiar link" diz que copia O LINK, com texto visível e nome acessível', m.copiarNome);
    checar(m.zapNome === 'Enviar no WhatsApp' && m.zapTitle === 'Enviar no WhatsApp',
      'o botão-ícone NÃO tem texto visível, mas TEM nome acessível ("Enviar no WhatsApp")',
      `${JSON.stringify(m.zapNome)} · ${JSON.stringify(m.zapTitle)}`);
    checar(m.zapTexto === '' && m.zapIcone === '#icoCompartilhar',
      'e o corpo dele é o ícone de COMPARTILHAR do sprite — nada de texto nem de SVG novo',
      `${JSON.stringify(m.zapTexto)} · ${m.zapIcone}`);

    // ---- C. O VALOR COPIADO ------------------------------------------------
    await pg.click('#passadorCopyBtn');
    const copiou = await esperarDb(pg,
      (esperado) => navigator.clipboard.readText().then((t) => t === esperado), LINK, 8000);
    checar(copiou === true, 'o "Copiar link" põe o LINK DO SITE na área de transferência', porque(copiou));
    const copiado = await pg.evaluate(() => navigator.clipboard.readText().catch(() => ''));
    checar(copiado === LINK,
      'e o valor é exatamente a página pública — nem o endereço do aparelho, nem a mensagem',
      JSON.stringify(copiado));

    // ---- D. O QUE VIAJA ----------------------------------------------------
    await pg.evaluate(() => { window.__zap = null; window.open = (u) => { window.__zap = u; return null; }; });
    await colarNumero(pg, NUMERO);
    const noCampo = await estadoDoCampo(pg);
    await pg.click('#passadorZapBtn');
    const saiu = await esperar(pg, () => window.__zap !== null, null, 5000);
    const enviado = await pg.evaluate(() => window.__zap);
    let texto = '';
    try { texto = decodeURIComponent(String(enviado).split('?text=')[1] || ''); } catch (_) { texto = ''; }
    checar(noCampo.valor === NUMERO_MASCARADO,
      'o número digitado com DDD aparece na máscara do celular', JSON.stringify(noCampo.valor));
    checar(saiu === true && String(enviado).startsWith('https://wa.me/55' + NUMERO_DIGITOS + '?text='),
      'o botão-ícone leva ao wa.me com o 55 automático no número digitado', enviado || porque(saiu));
    checar(texto === LINK,
      'e o `?text=` é SÓ o link — uma linha, sem a segunda linha do endereço cru',
      JSON.stringify(texto));
    checar(!/se o link n[ãa]o abrir/i.test(texto) && texto.split('\n').length === 1,
      'a mensagem enviada não tem endereço cru nem segunda linha', texto);
    const guardado = await pg.evaluate(() => localStorage.getItem('av.passadorZap'));
    checar(guardado === NUMERO_DIGITOS,
      'o último número fica guardado em DÍGITOS (a máscara é da tela)', JSON.stringify(guardado));

    // ---- E. A MÁSCARA ------------------------------------------------------
    // 1 a 11 dígitos, um toque por vez: `(xx) x xxxx-xxxx`.
    await digitar(pg, '11912345678');
    const digitado = await pg.evaluate(() => {
      const c = document.getElementById('passadorZapNum');
      return { valor: c.value, caret: c.selectionStart };
    });
    checar(digitado.valor === '(11) 9 1234-5678',
      'digitar os 11 dígitos de um celular formata (xx) x xxxx-xxxx', JSON.stringify(digitado.valor));
    checar(digitado.caret === digitado.valor.length,
      'e o cursor fica no fim do que acabou de ser digitado', String(digitado.caret));

    const progressivo = [];
    await pg.evaluate(() => { document.getElementById('passadorZapNum').value = ''; });
    await pg.focus('#passadorZapNum');
    for (let i = 0; i < 11; i++) {
      await pg.keyboard.type('1');
      progressivo.push((await estadoDoCampo(pg)).valor);
    }
    checar(progressivo[0] === '(1' && progressivo[1] === '(11' && progressivo[2] === '(11) 1'
      && progressivo[9] === '(11) 1111-1111' && progressivo[10] === '(11) 1 1111-1111',
      'e a máscara cresce por dígito, sem esperar o 11º para aparecer',
      progressivo.join(' · '));

    await colarNumero(pg, '11912345678');
    const colouNumeros = (await estadoDoCampo(pg)).valor;
    await colarNumero(pg, '+55 11 91234-5678');
    const colouComPais = (await estadoDoCampo(pg)).valor;
    checar(colouNumeros === '(11) 9 1234-5678' && colouComPais === '(11) 9 1234-5678',
      'colar com ou sem máscara e com +55 chega ao mesmo número',
      `${JSON.stringify(colouNumeros)} · ${JSON.stringify(colouComPais)}`);

    await colarNumero(pg, '11 3265-4321');
    const fixo = await estadoDoCampo(pg);
    checar(fixo.valor === '(11) 3265-4321',
      '10 dígitos (fixo) formatam coerente em (xx) xxxx-xxxx', JSON.stringify(fixo.valor));

    // A EDIÇÃO NO MEIO: 11 dígitos, cursor depois de "(11) 9 1234", digita 0.
    await colarNumero(pg, '11912345678');
    await pg.evaluate(() => {
      const c = document.getElementById('passadorZapNum');
      const pos = c.value.indexOf('1234') + 4;
      c.setSelectionRange(pos, pos);
    });
    await pg.keyboard.type('0');
    const noMeio = await estadoDoCampo(pg);
    checar(noMeio.valor === '(11) 9 1234-0567' && noMeio.caret === 13,
      'editar NO MEIO insere no lugar e o cursor NÃO pula (o defeito clássico da máscara)',
      `${JSON.stringify(noMeio.valor)} caret=${noMeio.caret}`);
    await pg.keyboard.press('Backspace');
    const apagouNoMeio = await estadoDoCampo(pg);
    checar(apagouNoMeio.valor === '(11) 9 1234-567' && apagouNoMeio.caret === 11,
      'e apagar no meio apaga o dígito anterior, com o cursor no lugar',
      `${JSON.stringify(apagouNoMeio.valor)} caret=${apagouNoMeio.caret}`);

    // O BACKSPACE SOBRE O SEPARADOR: cursor logo depois do "-".
    await colarNumero(pg, '11912345678');
    await pg.evaluate(() => {
      const c = document.getElementById('passadorZapNum');
      const pos = c.value.indexOf('-') + 1;
      c.setSelectionRange(pos, pos);
    });
    await pg.keyboard.press('Backspace');
    const sobreSeparador = await estadoDoCampo(pg);
    checar(sobreSeparador.valor === '(11) 9 1235-678',
      'apagar sobre o separador apaga o DÍGITO anterior — não trava no hífen',
      JSON.stringify(sobreSeparador.valor));

    await colarNumero(pg, '51abc 99999-9999');
    const soDigitos = await estadoDoCampo(pg);
    checar(soDigitos.valor === NUMERO_MASCARADO && soDigitos.soDigitosNaTela,
      'só dígitos entram: letra na colagem não vira nada na tela',
      JSON.stringify(soDigitos.valor));

    // ---- F. O FOCO ---------------------------------------------------------
    await colarNumero(pg, '');
    await pg.focus('#passadorZapNum');
    const foco = await pg.evaluate(() => {
      const c = document.getElementById('passadorZapNum');
      const cs = getComputedStyle(c);
      return {
        ativo: document.activeElement === c,
        outline: cs.outline, outlineStyle: cs.outlineStyle, outlineWidth: cs.outlineWidth,
        boxShadow: cs.boxShadow,
      };
    });
    checar(foco.ativo && foco.outlineStyle === 'none' && foco.outlineWidth === '0px',
      'o campo focado NÃO desenha o anel nativo do WebView (o amarelo)',
      foco.outline);
    checar(/0px 0px 0px 2px/.test(foco.boxShadow) && foco.boxShadow !== 'none',
      'quem navega por teclado VÊ o foco: o anel de 2px do app, por `box-shadow`', foco.boxShadow);

    // ---- G. A GEOMETRIA ----------------------------------------------------
    // O PIOR CASO DA CAIXA: 11 dígitos mascarados (`(11) 9 1234-5678`). Medir
    // com o campo vazio leria o `placeholder`, que não é o que o operador vê
    // quando digita. O rótulo e o ícone são medidos no mesmo estado.
    await colarNumero(pg, '11912345678');
    const mG = await medir(pg);
    await pg.focus('#passadorZapNum');
    checar(mG.num && (await estadoDoCampo(pg)).valor === '(11) 9 1234-5678',
      'o pior caso está na caixa: 11 dígitos mascarados, com o campo focado',
      (await estadoDoCampo(pg)).valor);
    checar(mG.mesmaLinha,
      'o "Copiar link", a caixa do número e o botão-ícone dividem a MESMA linha',
      `topos: copiar ${mG.copiar.y} · número ${mG.num.y} · ícone ${mG.zap.y}`);
    checar(mG.ordem,
      'e a ordem é [Copiar link] → [caixa do número] → [ícone], da esquerda para a direita',
      `${mG.copiar.x}+${mG.copiar.w} · ${mG.num.x}+${mG.num.w} · ${mG.zap.x}+${mG.zap.w}`);
    checar(mG.soma !== null && mG.soma <= mG.larguraDaLinha + 1,
      `as três peças + os dois vãos cabem na largura útil da linha (${mG.larguraDaLinha}px)`,
      `${mG.soma}px de ${mG.larguraDaLinha}px`);
    checar(mG.copiar.h >= mG.hit && mG.zap.h >= mG.hit && mG.num.h >= mG.hit,
      `os três alvos cumprem o --hit (${mG.hit}px)`,
      `${mG.copiar.h}px · ${mG.zap.h}px · ${mG.num.h}px`);
    for (const [nome, c] of [['o rótulo do "Copiar link"', mG.rotuloCopiar],
      ['a caixa do número', mG.num], ['o botão-ícone', mG.zap]]) {
      checar(c && !c.truncado && c.scrollW <= c.clientW + 1,
        `${nome} não é truncado a ${tela.nome}`, c ? `${c.scrollW}/${c.clientW} px` : 'sem a peça');
    }
    checar(mG.grupo.x >= mG.folha.x - 0.5 && mG.grupo.x + mG.grupo.w <= mG.folha.x + mG.folha.w + 0.5,
      'o cartão cabe na largura da folha', `${mG.grupo.w}px de ${mG.folha.w}px`);
    checar(mG.grupo.fundo === mG.endereco.fundo && mG.grupo.raio === mG.endereco.raio,
      'e o cartão tem a MESMA superfície e o mesmo raio do cartão do endereço (o vocabulário do app)',
      `${mG.grupo.fundo} / ${mG.grupo.raio} contra ${mG.endereco.fundo} / ${mG.endereco.raio}`);

    checar(erros.length === 0, 'nenhum erro de página na folha do passador', erros.slice(0, 3).join(' | '));

    vistas[tela.nome] = mG;
    await ctx.close();
  }
} finally {
  await navegador.close();
  await new Promise((r) => servidor.close(r));
}

// A GEOMETRIA IMPRESSA: o número que o relatório do lote cita sai daqui, da
// mesma execução que reprova — número medido à parte envelhece em um lote.
for (const [nome, m] of Object.entries(vistas)) {
  console.log(`  ${nome}: cartão ${m.grupo.w}x${m.grupo.h} px · linha útil ${m.larguraDaLinha}px`
    + ` (soma ${m.soma}px, folga ${Math.round((m.larguraDaLinha - m.soma) * 10) / 10}px · ordem ${m.ordem})`
    + ` · "Copiar link" ${m.copiar.w}x${m.copiar.h} px (rótulo ${m.rotuloCopiar.scrollW}/${m.rotuloCopiar.clientW})`
    + ` · caixa ${m.num.w}x${m.num.h} px (${m.num.scrollW}/${m.num.clientW})`
    + ` · ícone ${m.zap.w}x${m.zap.h} px (${m.zap.scrollW}/${m.zap.clientW})`
    + ` · folha ${m.folha.h}px`);
}

console.log('');
if (falhas.length) {
  console.log(`${falhas.length} FALHA(S) — o cartão do passador não é o desenho de 4 coisas, ou a máscara/o envio/o foco não obedecem.`);
  process.exit(1);
}
console.log('O cartão do passador: quatro coisas, o ícone com nome, o link copiado e enviado sozinho, a máscara que não pula o cursor e o foco do app.');
