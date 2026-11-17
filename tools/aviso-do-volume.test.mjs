#!/usr/bin/env node
// ============================================================================
// O CARTÃO DO VOLUME NA ABERTURA: ELE PERGUNTA, NÃO AGE — E NÃO FECHA SOZINHO
//
// O Pacote 45 mudou o papel desta peça por decisão do operador. Até a v1.14.67 o
// piso da v1.13.65 subia o volume de mídia do aparelho até 60% em SILÊNCIO, e o
// cartão da v1.14.46 só contava o que o app tinha feito. Agora:
//
//   · o app NÃO mexe no volume sozinho;
//   · o cartão nasce na BASE, sobre um véu, com a fonte do app e os botões do
//     app: "Subir até 60%", o volume do aparelho no −/+, o Não perturbe e o OK;
//   · o OK é o ÚNICO controle que fecha (não há ✕ de canto), e ele descarta a
//     mensagem DESTA abertura — a próxima abertura com o volume baixo a traz de
//     novo (não existe "não mostrar mais");
//   · o cartão NÃO fecha sozinho: nada de timer.
//
// O modo de falhar desta peça é o pior: um `systemVolumeDefinir` a mais não
// aparece em erro nenhum (o app "só está sendo prestativo"), um timer de 12 s
// esconde a mensagem antes de o operador ler, e um `setInterruptionFilter` sem
// `ACCESS_NOTIFICATION_POLICY` é um no-op SILENCIOSO. Por isso este arquivo mede
// o que se VÊ e o que a PONTE recebe, com um sistema falso de dez degraus:
//
//  A. o volume abaixo de 60% acende o cartão — na BASE, com título em 20% (o
//     número lido, não um 60% prometido), fonte no degrau do app, o `#icoSom` do
//     sprite, o véu por cima do conteúdo — e NENHUMA escrita no volume;
//  B. só o OK fecha: toque no corpo do cartão e no véu não fecham; o OK fecha;
//  C. "Subir até 60%" chama `systemVolumeDefinir(0.6)` e o cartão se repinta com
//     o número RELIDO (60%), sem fechar;
//  D. o −/+ mexe no volume do APARELHO, um degrau por toque, e o número acompanha;
//  E. o Não perturbe: com autorização chama `naoPerturbeDefinir(true)`; sem ela
//     abre a tela de acesso e NÃO chama o definir;
//  F. com o volume já em 60% o cartão não nasce e o volume não é tocado;
//  G. a REDE DE PROTEÇÃO: se a ponte não responde a leitura (casco < 86 ou
//     recusa), o cartão e o véu NÃO nascem e o app abre normal e usável;
//  H. num casco 88 o cartão nasce (a leitura existe desde o 86) e o botão do
//     Não perturbe fica FORA — degradação declarada;
//  I. o cartão continua de pé depois de 30 s (o timer que voltar reprova aqui) e
//     o tour não abriu enquanto ele estava na tela.
//  J. o OK desta abertura não silencia a próxima: reabrir com o volume baixo
//     traz o cartão de novo.
//
// O QUE ESTE ARQUIVO NÃO PROVA: o Android de verdade. O `setStreamVolume` com
// flags 0, a tela de acesso especial e o filtro `ALARMS` só se conferem no
// aparelho — aqui a ponte é de mentira, e o que se mede é a CONVERSA.
//
//   node tools/aviso-do-volume.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperarCortina, checar, falhas } from './arnes.mjs';

// O SISTEMA FALSO: dez degraus, e o `cur` é o que o app encontra na abertura.
// `acesso` é a autorização de Não perturbe; `semPonte` simula um casco 88, em
// que o Não perturbe não existe; `semLeitura` simula o casco antigo (< 86) ou a
// ponte que NÃO responde a leitura — o caminho da rede de proteção.
const PONTE = (opts) => `(() => {
  const o = ${JSON.stringify(opts)};
  window.__sis = { cur: o.cur, max: 10 };
  window.__acesso = o.acesso !== false;
  window.__dndLigado = o.dnd === true;
  window.__chamadas = { definir: [], dnd: [], acesso: 0 };
  const B = {
    shellVersion: () => ${opts.semPonte ? 88 : 89},
    role: () => 'controle',
    appVersion: () => '1.98-teste',
    takeShare: (id) => { setTimeout(() => { try { window.__avResolve(id, ''); } catch (_) {} }, 0); },
    busPost: () => {}, otaConfirm: () => {},
  };
  if (o.semLeitura) {
    // SEM a leitura: o cartão não tem como saber o volume, e a abertura não pode
    // depender dele. O método some da ponte, como num casco < 86.
  } else {
    B.systemVolumeAtual = (id) => setTimeout(() => {
      try { window.__avResolve(id, { atual: window.__sis.cur, max: window.__sis.max }); } catch (_) {}
    }, 0);
    B.systemVolumeDefinir = (f) => {
      window.__chamadas.definir.push(f);
      window.__sis.cur = Math.round(window.__sis.max * f);
    };
  }
  if (!o.semPonte) {
    B.naoPerturbe = (id) => setTimeout(() => {
      try { window.__avResolve(id, { acesso: window.__acesso, ligado: window.__dndLigado, filtro: 0 }); } catch (_) {}
    }, 0);
    B.naoPerturbeDefinir = (on, id) => {
      window.__chamadas.dnd.push(!!on);
      window.__dndLigado = !!on;
      setTimeout(() => { try { window.__avResolve(id, { ok: true }); } catch (_) {} }, 0);
    };
    B.abrirAcessoNaoPerturbe = () => { window.__chamadas.acesso++; };
  }
  const nomes = ['apkInstalar','apkProcurar','bgProgress','captureVolumeKeys','projecaoLocal','castTarget','saidaDeAudioAlvo',
    'cifraDiag','cifraHtml','deckDiscard','deckExportUrl','deckPages','displays',
    'espelhoCertApagar','espelhoCertEstado','espelhoCertImportar','espelhoDerrubar',
    'espelhoDesligar','espelhoDiag','espelhoLigar','keepAlive','listFolder',
    'nowPlaying','openCast','abrirSaidaDeAudio','openExternal','otaApply','otaCheck','otaDiag',
    'otaPending','pickDoc','pickFolder','salvarTexto','temaClaro',
    'ytCancel','ytCanalPlaylists','ytDiag','ytDiscard','ytFetch','ytFetchAte','ytFetchAudio',
    'ytPlaylist','ytSearch','ytStream','areaTransferencia','atualizacaoEstado',
  ];
  for (const n of nomes) {
    if (B[n]) continue;
    B[n] = (...args) => {
      const id = args[0];
      if (typeof id === 'string') setTimeout(() => { try { window.__avResolve(id, null); } catch (_) {} }, 0);
      return undefined;
    };
  }
  window.__AVBridge = B;
})();`;

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);
await new Promise((r) => servidor.listen(0, r));
const navegador = await abrirNavegador();
const erros = [];

// Uma abertura = um contexto NOVO: a conferência do volume roda UMA vez por
// carga, e reaproveitar a página mediria a abertura anterior.
async function abrir(opts) {
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 } });
  await semRedeExterna(ctx);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await pg.addInitScript(PONTE(opts));
  await pg.goto('http://localhost:' + servidor.address().port + '/controle/', { waitUntil: 'domcontentloaded' });
  await esperarCortina(pg);
  await pg.waitForFunction(
    () => window.__NATIVE__ === true && window.AVDB && typeof window.__avBack === 'function',
    null, { timeout: 30000 },
  );
  return { ctx, pg };
}
const cartao = (pg) => pg.evaluate(() => {
  const el = document.getElementById('volAvisoPop');
  const veu = document.getElementById('volAvisoVeu');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const titulo = document.getElementById('volAvisoPopTitulo');
  const texto = document.getElementById('volAvisoPopTexto');
  const root = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const fs = (n) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(n)) * root;
  return {
    hidden: el.hidden,
    texto: el.textContent.replace(/\s+/g, ' ').trim(),
    titulo: titulo.textContent.trim(),
    corpo: texto.textContent.trim(),
    nivel: document.getElementById('volAvisoPopNivel').textContent.trim(),
    topo: +r.top.toFixed(1), base: +r.bottom.toFixed(1), esq: +r.left.toFixed(1), dir: +r.right.toFixed(1),
    z: +(cs.zIndex || 0), veuZ: +(getComputedStyle(veu).zIndex || 0),
    veuHidden: veu.hidden, veuFundo: getComputedStyle(veu).backgroundColor,
    fsTitulo: +parseFloat(getComputedStyle(titulo).fontSize).toFixed(2),
    fsCorpo: +parseFloat(getComputedStyle(texto).fontSize).toFixed(2),
    fsLg: +fs('--fs-lg').toFixed(2), fsMd: +fs('--fs-md').toFixed(2), fsSm: +fs('--fs-sm').toFixed(2), fsXs: +fs('--fs-xs').toFixed(2),
    icone: (() => {
      const u = document.querySelector('#volAvisoPop .vol-aviso-ico use');
      return u ? (u.getAttribute('href') || u.getAttribute('xlink:href')) : null;
    })(),
    dnd: document.getElementById('volAvisoPopDnd').hidden,
    fecharRotulo: document.getElementById('volAvisoPopFechar').textContent.trim(),
    fecharTemX: !!document.querySelector('#volAvisoPop [aria-label*="Fechar"], #volAvisoPop .vol-aviso-fechar svg'),
    altura: innerHeight,
    chamadas: JSON.parse(JSON.stringify(window.__chamadas)),
    tour: window.AVTour && AVTour.estado(),
    dialogo: document.getElementById('appDialog').classList.contains('open'),
  };
});
const chamadas = (pg) => pg.evaluate(() => JSON.parse(JSON.stringify(window.__chamadas)));
// O APP DE PÉ E ALCANÇÁVEL: sem tela conectada o app abre na cortina de
// conexão do Modo Fácil (`#simpleConn`), e é ela que a prova de "abriu normal"
// procura no `elementFromPoint` — um véu que tivesse ficado na tela devolveria
// ele mesmo, e o toque não chegaria à porta.
const appUsavel = (pg) => pg.evaluate(() => {
  const b = document.getElementById('simpleConn');
  if (!b) return { ok: false, motivo: 'sem a porta de conexão' };
  const r = b.getBoundingClientRect();
  const alvo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return {
    ok: !!alvo && b.contains(alvo) && r.width > 1 && r.height > 1,
    splash: !!document.getElementById('splash'),
    avisoNaTela: !document.getElementById('volAvisoPop').hidden,
    veuNaTela: !document.getElementById('volAvisoVeu').hidden,
    db: !!window.AVDB, alvo: alvo ? (alvo.id || alvo.tagName) : null,
  };
});

try {
  // ── A · O VOLUME BAIXO ACENDE O CARTÃO, SEM TOCAR NO VOLUME ──────────────
  {
    const { ctx, pg } = await abrir({ cur: 2 });   // 20% do sistema, abaixo do piso
    await pg.waitForSelector('#volAvisoPop:not([hidden])', { timeout: 10000 });
    const c = await cartao(pg);
    checar(c.chamadas.definir.length === 0,
      'A · o app NÃO sobe o volume sozinho (nenhum `systemVolumeDefinir` na abertura)', JSON.stringify(c.chamadas));
    checar(!c.hidden && /20\s*%/.test(c.titulo),
      'A · e o cartão diz o volume REAL do aparelho (20%), não um 60% prometido', c.titulo);
    checar(c.topo > c.altura / 2 && c.base >= c.altura - 40,
      'A · ele nasce na BASE da tela, não no topo', `topo ${c.topo} · base ${c.base} de ${c.altura}`);
    checar(!c.veuHidden && c.veuZ > 220 && c.veuZ < 600 && c.z > c.veuZ,
      'A · o véu escurece o que está atrás e fica abaixo do cartão, abaixo do tour (600)', `véu ${c.veuZ} · cartão ${c.z}`);
    checar(c.fsTitulo === c.fsLg && c.fsCorpo === c.fsMd && c.fsLg > c.fsSm && c.fsMd > c.fsXs,
      'A · a fonte é a do app um degrau acima da antiga: título em `--fs-lg`, corpo em `--fs-md`',
      `título ${c.fsTitulo} (fs-lg ${c.fsLg}, fs-sm ${c.fsSm}) · corpo ${c.fsCorpo} (fs-md ${c.fsMd}, fs-xs ${c.fsXs})`);
    checar(c.icone === '#icoSom', 'A · o ícone é o do sprite do app (`#icoSom`), não um desenho de popup de sistema', c.icone);
    checar(c.fecharRotulo === 'OK' && !c.fecharTemX,
      'A · o ÚNICO controle de fechar é o OK — e não há ✕ de canto', JSON.stringify({ rotulo: c.fecharRotulo, x: c.fecharTemX }));
    checar(c.tour === null, 'A · e o tour não abriu por cima do cartão', JSON.stringify(c.tour));
    await ctx.close();
  }

  // ── B · SÓ O OK FECHA ────────────────────────────────────────────────────
  {
    const { ctx, pg } = await abrir({ cur: 2 });
    await pg.waitForSelector('#volAvisoPop:not([hidden])', { timeout: 10000 });
    // Um toque no corpo do cartão (o texto) não fecha.
    const alvoTexto = await pg.evaluate(() => {
      const r = document.getElementById('volAvisoPopTexto').getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await pg.mouse.click(alvoTexto.x, alvoTexto.y);
    await pg.waitForTimeout(300);
    checar(await pg.evaluate(() => !document.getElementById('volAvisoPop').hidden),
      'B · um toque no corpo do cartão NÃO o fecha (não é um backdrop)');
    // Um toque no véu, fora do cartão, também não.
    const alvoVeu = await pg.evaluate(() => ({ x: innerWidth / 2, y: 40 }));
    await pg.mouse.click(alvoVeu.x, alvoVeu.y);
    await pg.waitForTimeout(300);
    checar(await pg.evaluate(() => !document.getElementById('volAvisoPop').hidden),
      'B · e um toque no véu também não: o único controle que fecha é o OK');
    await pg.click('#volAvisoPopFechar');
    await pg.waitForFunction(() => document.getElementById('volAvisoPop').hidden, null, { timeout: 3000 });
    checar(await pg.evaluate(() => document.getElementById('volAvisoVeu').hidden),
      'B · o OK fecha o cartão e o véu JUNTOS (não sobra camada bloqueando a tela)');
    await ctx.close();
  }

  // ── C · "SUBIR ATÉ 60%" É UM ATO DO OPERADOR ─────────────────────────────
  {
    const { ctx, pg } = await abrir({ cur: 2 });
    await pg.waitForSelector('#volAvisoPop:not([hidden])', { timeout: 10000 });
    await pg.click('#volAvisoPopSubir');
    await pg.waitForFunction(() => window.__chamadas.definir.length === 1, null, { timeout: 5000 });
    const c = await cartao(pg);
    checar(c.chamadas.definir.length === 1 && Math.abs(c.chamadas.definir[0] - 0.6) < 1e-9,
      'C · o botão "Subir até 60%" chama `systemVolumeDefinir(0.6)`', JSON.stringify(c.chamadas.definir));
    await pg.waitForFunction(() => /60\s*%/.test(document.getElementById('volAvisoPopNivel').textContent), null, { timeout: 3000 });
    const d = await cartao(pg);
    checar(!d.hidden && /60\s*%/.test(d.titulo) && /60\s*%/.test(d.nivel),
      'C · e o cartão se repinta com o número RELIDO (60%) — não fecha sozinho depois de agir',
      JSON.stringify({ titulo: d.titulo, nivel: d.nivel, hidden: d.hidden }));
    await ctx.close();
  }

  // ── D · O −/+ MEXE NO VOLUME DO APARELHO ─────────────────────────────────
  {
    const { ctx, pg } = await abrir({ cur: 2 });
    await pg.waitForSelector('#volAvisoPop:not([hidden])', { timeout: 10000 });
    await pg.click('#volAvisoPopMais');
    await pg.waitForFunction(() => window.__sis.cur === 3, null, { timeout: 5000 });
    const mais = await cartao(pg);
    checar(mais.chamadas.definir.length === 1 && Math.abs(mais.chamadas.definir[0] - 0.3) < 1e-9 && /30\s*%/.test(mais.nivel),
      'D · o + sobe UM degrau do volume do APARELHO e o número acompanha (30%)',
      JSON.stringify({ definir: mais.chamadas.definir, nivel: mais.nivel }));
    await pg.click('#volAvisoPopMenos');
    await pg.waitForFunction(() => window.__sis.cur === 2, null, { timeout: 5000 });
    const menos = await cartao(pg);
    checar(/20\s*%/.test(menos.nivel) && Math.abs(menos.chamadas.definir[1] - 0.2) < 1e-9,
      'D · e o − desce o mesmo degrau (20%)', JSON.stringify({ definir: menos.chamadas.definir, nivel: menos.nivel }));
    await ctx.close();
  }

  // ── E · O NÃO PERTURBE, COM E SEM AUTORIZAÇÃO ────────────────────────────
  {
    const { ctx, pg } = await abrir({ cur: 2 });
    await pg.waitForSelector('#volAvisoPop:not([hidden])', { timeout: 10000 });
    await pg.waitForFunction(() => !document.getElementById('volAvisoPopDnd').hidden, null, { timeout: 5000 });
    await pg.click('#volAvisoPopDnd');
    await pg.waitForFunction(() => window.__chamadas.dnd.length === 1, null, { timeout: 5000 });
    const ch = await chamadas(pg);
    checar(ch.dnd.length === 1 && ch.dnd[0] === true && ch.acesso === 0,
      'E · com "Acesso a Não perturbe" autorizado, o botão liga o filtro e NÃO abre a tela de acesso', ch);
    await ctx.close();
  }
  {
    const { ctx, pg } = await abrir({ cur: 2, acesso: false });
    await pg.waitForSelector('#volAvisoPop:not([hidden])', { timeout: 10000 });
    await pg.waitForFunction(() => !document.getElementById('volAvisoPopDnd').hidden, null, { timeout: 5000 });
    await pg.click('#volAvisoPopDnd');
    await pg.waitForFunction(() => window.__chamadas.acesso === 1, null, { timeout: 5000 });
    const ch = await chamadas(pg);
    checar(ch.acesso === 1 && ch.dnd.length === 0,
      'E · sem a autorização, o toque abre a tela de acesso e NÃO chama o definir (o no-op silencioso é o defeito que se evita)', ch);
    const c = await cartao(pg);
    checar(!c.hidden && /Autorize/i.test(c.texto),
      'E · o cartão não some: ele diz o que fazer para o botão passar a valer', c.corpo);
    await ctx.close();
  }

  // ── F · O VOLUME JÁ ESTÁ NO PISO: NENHUM CARTÃO, NENHUMA ESCRITA ─────────
  {
    const { ctx, pg } = await abrir({ cur: 6 });   // 60%: já está no piso
    await pg.waitForTimeout(1500);
    const c = await cartao(pg);
    const ch = await chamadas(pg);
    checar(ch.definir.length === 0,
      'F · com o sistema já em 60%, o app NÃO mexe no volume', ch.definir);
    checar(c.hidden && c.veuHidden,
      'F · e o cartão não aparece — a condição é o volume BAIXO, não a abertura', JSON.stringify({ hidden: c.hidden, veu: c.veuHidden }));
    await ctx.close();
  }

  // ── G · A REDE DE PROTEÇÃO: SEM A LEITURA, O APP ABRE SEM O CARTÃO ───────
  {
    const { ctx, pg } = await abrir({ cur: 2, semLeitura: true });
    await pg.waitForTimeout(1500);
    const c = await cartao(pg);
    const u = await appUsavel(pg);
    checar(c.hidden && c.veuHidden,
      'G · sem a leitura do volume (casco antigo/ponte muda), o cartão e o véu NÃO nascem',
      JSON.stringify({ cartao: c.hidden, veu: c.veuHidden }));
    checar(u.ok && !u.splash && u.db,
      'G · e o app abre NORMAL e alcançável: a porta de conexão recebe o dedo (nada preso numa abertura sem saída)', u);
    const falhasJs = erros.filter((e) => /volAviso|conferirVolume/i.test(e));
    checar(falhasJs.length === 0, 'G · a falha da leitura não vira erro de página', falhasJs.join(' | '));
    await ctx.close();
  }

  // ── H · CASCO 88: O CARTÃO NASCE, O NÃO PERTURBE FICA FORA ───────────────
  {
    const { ctx, pg } = await abrir({ cur: 2, semPonte: true });
    await pg.waitForSelector('#volAvisoPop:not([hidden])', { timeout: 10000 });
    const c = await cartao(pg);
    checar(c.dnd === true && c.chamadas.dnd.length === 0,
      'H · num casco 88 o cartão nasce (a leitura é do 86) e o Não perturbe NÃO aparece — degradação declarada, não botão de enfeite',
      JSON.stringify({ dnd: c.dnd, chamadas: c.chamadas }));
    await ctx.close();
  }

  // ── I · O CARTÃO CONTINUA DE PÉ DEPOIS DE 30 s, E O TOUR ESPERA ─────────
  {
    const { ctx, pg } = await abrir({ cur: 2 });   // contexto comum: o tour está marcado como visto pelo arnês
    await pg.waitForSelector('#volAvisoPop:not([hidden])', { timeout: 10000 });
    await pg.waitForTimeout(30000);
    const c = await cartao(pg);
    checar(!c.hidden,
      'I · depois de 30 s o cartão CONTINUA na tela — não há timer (o de 12 s da v1.14.46 reprova aqui)', c.hidden);
    checar(c.chamadas.definir.length === 0,
      'I · e nesses 30 s o volume do aparelho não mudou sozinho', JSON.stringify(c.chamadas.definir));
    checar(!c.dialogo, 'I · e nenhum diálogo se abriu por cima dele', c.dialogo);
    await ctx.close();
  }

  // ── J · O OK DESCARTA ESTA ABERTURA; A PRÓXIMA TRAZ DE VOLTA ────────────
  {
    const primeira = await abrir({ cur: 2 });
    await primeira.pg.waitForSelector('#volAvisoPop:not([hidden])', { timeout: 10000 });
    await primeira.pg.click('#volAvisoPopFechar');
    await primeira.pg.waitForFunction(() => document.getElementById('volAvisoPop').hidden, null, { timeout: 3000 });
    await primeira.ctx.close();
    // A SEGUNDA ABERTURA, mesmo aparelho e mesmo volume baixo: outra carga, e o
    // cartão volta — não existe "não mostrar mais".
    const segunda = await abrir({ cur: 2 });
    await segunda.pg.waitForSelector('#volAvisoPop:not([hidden])', { timeout: 10000 });
    checar(true, 'J · o OK não silencia a próxima abertura: com o volume ainda baixo, o cartão volta');
    await segunda.ctx.close();
  }

  checar(erros.length === 0, 'nenhum erro de página', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) { console.log('\n' + falhas.length + ' FALHA(S)'); process.exit(1); }
console.log('\nTodos passaram.');
process.exit(0);
