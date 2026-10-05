#!/usr/bin/env node
// ============================================================================
// O A+/A− DO MODO FÁCIL: DOIS BOTÕES FLUTUANTES NO CANTO DA LEITURA (v1.11.15)
//
// Pedido do operador, verbatim: *"ajuste os dois botões de aumentar e diminuir letra para que
// sejam colocados como dois botões FAB dentro da caixa do auxiliar de leitura, sendo os dois
// no canto inferior direito, um acima do outro, em uma coluna. Sem molduras, apenas os
// botões"*.
//
// ## O que isto substitui
//
// O par morava PENDURADO na linha do nome (`.simple-np-linha`, `position: absolute`), e
// por isso a linha reservava a altura dele (v1.5.19: *"eles estão colados nos elementos
// abaixo dele"*). Tudo isso saiu com a linha: o nome é o `.simple-np` solto, e o par virou
// uma coluna no canto de baixo da placa da letra. As cinco asserções que guardavam o respiro
// da linha deixaram de ter o que medir; o que ficou delas é o ALVO (`--hit`) e a outra casa do
// par, o cabeçalho do `#lyricsPopup`, que não mudou.
//
// ## Por que isto precisa de oráculo
//
// **Nada disso lança, nada aparece no console e nada quebra um fluxo.** Os botões estão lá,
// desenhados, respondendo — e o que falha é GEOMETRIA e HIT-TEST: um botão fora do canto, um
// par lado a lado, uma moldura que volta, a última estrofe presa SOB a coluna no fim da
// rolagem, ou a placa da letra recebendo o toque que era do botão.
//
// ## As réguas deste arquivo
//
//  1. **NENHUM NÚMERO DE ESPAÇO ESCRITO AQUI.** O recuo é comparado entre os DOIS eixos e o
//     alvo contra o `--hit` resolvido; as medidas são do mesmo desenho dos dois lados.
//  2. **O ALVO É O QUE IMPEDE O REMENDO.** Encolher os botões para caber passa em toda a
//     geometria — por isso o `--hit` tem asserção própria, nas DUAS casas do par.
//  3. **O MODO SE DESTRAVA PELO CAMINHO REAL.** `setTocarNoCelular(true)`, e nunca arrancando
//     `.sem-tela` à mão: isso produz um DOM que o app não gera.
//
//   node tools/modo-facil-fonte.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperarCortina, checar, falhas } from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)),
  '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);

// Espera pelo FATO; o estouro devolve a FRASE, nunca um veredito sobre o app.
// Predicado SÍNCRONO sempre: um `async` devolve uma Promise, que é truthy, e a
// espera passaria no primeiro quadro aprovando o que veio verificar.
async function esperar(pg, fn, msg, arg, ms = 15000) {
  try { await pg.waitForFunction(fn, arg, { timeout: ms }); return true; }
  catch (_) {
    checar(false, msg, 'PRAZO, não veredito: a condição não chegou em ' + ms + 'ms');
    return false;
  }
}

// AS TELAS e OS TEMAS. Duas larguras porque o recuo e a coluna se medem contra a placa da
// letra, que muda de largura; dois temas porque os botões vestem `--surface-porta` e `--accent`,
// e é no claro que a placa é branco PLENO — onde um botão sem preenchimento próprio sumiria.
const TELAS = [{ w: 430, h: 900 }, { w: 360, h: 740 }];
const TEMAS = ['escuro', 'claro'];

// O acervo: um WAV de 20 s. Ele é longo de propósito — a asserção da linha do
// tempo espera pelo FATO de o `#simpleTime` aparecer, e uma faixa que acabasse
// no meio da bateria o esconderia de novo por ter TERMINADO.
//
// O NOME TEM DE CABER, e isso é requisito da asserção de centralização: com um
// nome que não caiba, o `Range` mede o texto NÃO RECORTADO (o `.simple-np` é
// `nowrap` + `ellipsis`) e o desvio sai em centenas de pixels em TODAS as
// variantes — inclusive nas corretas. Um nome longo faria a asserção aprovar um
// desenho descentrado, que é o oposto do que ela existe para dizer. Por isso a
// premissa é COBRADA (`nomeRecortado`) e não suposta: com o nome recortado o
// desvio cai para 8,12px, pequeno o bastante para uma tolerância frouxa aprovar
// um rótulo descentrado.
//
// E O TEXTO QUE ELA DE FATO MEDE É O PLACEHOLDER, não o nome semeado: a
// asserção roda no PASSE A, onde nada foi projetado e o `#simpleNpName` mostra
// "Nada em exibição". O `SEMEAR` abaixo só entra em cena no passe B, que não
// tem asserção de centralização. **A margem MEDIDA é do placeholder**: 151,86px
// de texto pintado numa caixa de conteúdo de 198px a 360×740 (30,4% de folga),
// e 268px de caixa a 430. Um placeholder mais longo num lote futuro reprova
// AQUI com a frase "e o NOME CONTINUA CENTRADO", que lê como app quebrado —
// provado, trocando-o por "Nada em exibição no telão agora": reprova nas quatro
// configurações. Quem mexer no placeholder mexe nesta margem.
//
// O RISCO DE FONTE está quantificado e é baixo: esta máquina resolve
// `system-ui` para DejaVu Sans, MEDIDA a MAIS LARGA das nove instaladas
// ("Nada em exibição": DejaVu 136,5 · Liberation 121,6 · WenQuanYi 118,3 ·
// FreeSans 117,5). Um runner com outra fonte sai mais ESTREITO, não mais largo.
const SEMEAR = `
  const sr = 8000, secs = 20, n = sr * secs;
  const buf = new ArrayBuffer(44 + n * 2), dv = new DataView(buf);
  const wr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  wr(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); wr(8, 'WAVEfmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true);
  dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  wr(36, 'data'); dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, Math.sin(i / 20) * 3000, true);
  const a = await AVDB.addMedia(new Blob([buf], { type: 'audio/wav' }),
    { name: 'Alvorada', type: 'audio/wav', kind: 'audio', list: 'imports' });
`;

await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
// `--autoplay-policy` porque o app roda num WebView com
// `mediaPlaybackRequiresUserGesture = false`: sem a bandeira o que se mediria
// seria a política do navegador, e não a linha do tempo do app.
const navegador = await abrirNavegador({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await navegador.newContext({ viewport: { width: TELAS[0].w, height: TELAS[0].h } });
await semRedeExterna(ctx);
const pg = await ctx.newPage();

const erros = [];
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY/;
pg.on('console', (m) => {
  if (m.type() !== 'error') return;
  const t = m.text();
  if (EXTERNO.test(t) || /Failed to load resource/.test(t)) return;
  erros.push(t);
});
pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));

// A tolerância de meio pixel: o layout do Chromium anda até ~0,4px em coordenada fracionária, e
// os desvios que este arquivo procura são de vários pixels.
const PERTO = 0.5;
const perto = (a, b) => Math.abs(a - b) <= PERTO;
const n2 = (v) => Number(v.toFixed(2));
// Luminância relativa e razão de contraste (WCAG) sobre `rgb(a, b, c)` RENDERIZADO.
const lum = (c) => {
  const [r, g, b] = (c.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map(Number).map((v) => {
    v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const razao = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

try {
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  // A CORTINA cobre a tela por 1,8 s (v1.7.2) e ela é o topo da pilha: sem esta
  // espera, todo hit-test e toda captura deste arquivo medem o `#splash`.
  await esperarCortina(pg);
  const dePe = await esperar(pg,
    () => window.AVDB && typeof window.__avBack === 'function'
      && (!!document.querySelector('#playlist li') || document.getElementById('plBtn').disabled),
    'o app fica de pé', null, 30000);
  if (!dePe) throw new Error('o app não subiu');

  const idAudio = await pg.evaluate(new Function(
    'return (async () => { setAppMode("full");' + SEMEAR + 'await load(); return a.id; })()'));

  // ---- A MEDIÇÃO DA CASA 1: os dois botões da zona de leitura do Modo Fácil -----------
  const medirFacil = () => pg.evaluate(() => {
    const song = document.querySelector('.simple-song');
    const grupo = song.querySelector('.simple-fabs');
    const [mais, menos] = [...grupo.querySelectorAll('.lv-fonte-btn')];
    const lyrics = document.getElementById('simpleLyrics');
    const nome = document.getElementById('simpleNpName');
    const r = (e) => {
      const b = e.getBoundingClientRect();
      return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, h: b.height, w: b.width };
    };
    const cx = (e) => { const b = e.getBoundingClientRect(); return b.left + b.width / 2; };
    const cy = (e) => { const b = e.getBoundingClientRect(); return b.top + b.height / 2; };
    const quem = (e) => {
      const el = document.elementFromPoint(cx(e), cy(e));
      if (!el) return null;
      if (el === mais || el === menos || mais.contains(el) || menos.contains(el)) return 'lv-fonte-btn';
      return el.id || (typeof el.className === 'string' ? el.className : '') || el.tagName;
    };
    const csG = getComputedStyle(grupo);
    const csM = getComputedStyle(mais);
    // O NOME PINTADO (o `Range` mede o texto, não a caixa `flex: 1`).
    const rng = document.createRange();
    rng.selectNodeContents(nome);
    const t = rng.getBoundingClientRect();
    return {
      mais: r(mais), menos: r(menos), lyrics: r(lyrics), song: r(song), grupo: r(grupo),
      doMesmoPai: mais.parentElement === menos.parentElement && grupo.parentElement === song,
      ordem: [...grupo.children].map((b) => b.classList.contains('lv-fonte-mais') ? '+' : '−').join(''),
      centroXMais: cx(mais), centroXMenos: cx(menos),
      semMoldura: {
        fundo: csG.backgroundColor, borda: csG.borderTopWidth + '/' + csG.borderLeftWidth,
        sombra: csG.boxShadow, padding: csG.padding,
      },
      botao: {
        raio: csM.borderTopLeftRadius, w: mais.getBoundingClientRect().width,
        sombra: csM.boxShadow, fundo: csM.backgroundColor, traco: csM.color,
      },
      alvos: [quem(mais), quem(menos)],
      hitToken: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hit')) || 0,
      semLinhaDoNome: document.querySelector('.simple-np-linha') === null,
      nomeAltura: r(nome).h,
      nomeTexto: nome.textContent,
      nomeRecortado: nome.scrollWidth > nome.clientWidth + 1,
      nomeCentro: (t.left + t.right) / 2,
      songCentro: r(song).left + r(song).w / 2,
    };
  });

  // ---- A MEDIÇÃO DA CASA 2: o cabeçalho do `#lyricsPopup` ----------------
  // Lá o `.lv-fonte-ctl` é `position: static` — ele CONTA para a altura da
  // linha —, e o respiro abaixo do par é, por construção, o `padding-bottom` do
  // cabeçalho. É esse "por construção" que a asserção prende.
  const medirPopup = () => pg.evaluate(() => {
    const header = document.querySelector('#lyricsPopup .popup-header');
    const [, mais] = [...header.querySelectorAll('.lv-fonte-btn')];
    const visivel = (e) => e && getComputedStyle(e).display !== 'none';
    const abaixo = [...header.parentElement.children]
      .slice([...header.parentElement.children].indexOf(header) + 1)
      .find(visivel);
    const r = (e) => {
      const b = e.getBoundingClientRect();
      return { top: b.top, bottom: b.bottom, h: b.height };
    };
    return {
      posicao: getComputedStyle(header.querySelector('.lv-fonte-ctl')).position,
      mais: r(mais), header: r(header),
      abaixo: abaixo ? r(abaixo) : null,
      abaixoQuem: abaixo ? (abaixo.id || abaixo.className) : null,
      recuo: parseFloat(getComputedStyle(header).paddingBottom) || 0,
      hitToken: parseFloat(getComputedStyle(document.documentElement)
        .getPropertyValue('--hit')) || 0,
      aberto: document.getElementById('lyricsPopup').classList.contains('open'),
    };
  });

  // ═══════════════════════════════════════════════════════════════════════
  // PASSE A — A ZONA EM REPOUSO (sem mídia), nas duas telas e nos dois temas
  //
  // Os dois passes são SEPARADOS por uma razão do app, não de arrumação: o
  // Parar não esconde a linha do tempo (`currentItem` sobrevive ao stop de
  // propósito, para o ▶ repetir a faixa), então uma bateria que projetasse no
  // meio nunca voltaria ao estado em que o vizinho de baixo do par é a PLACA DA
  // LETRA — e é esse vizinho que a asserção 2 mede.
  // ═══════════════════════════════════════════════════════════════════════
  for (const tela of TELAS) {
    await pg.setViewportSize({ width: tela.w, height: tela.h });
    for (const tema of TEMAS) {
      const cfg = tela.w + '×' + tela.h + ' ' + tema;
      await pg.evaluate((t) => { setTema(t); }, tema);

      // O caminho REAL: `setAppMode` zera a escolha em toda troca de modo, e é
      // `setTocarNoCelular(true)` — o "Tocar neste celular" da folha de conexão
      // — que derruba a cortina. Arrancar `.sem-tela` à mão daria um DOM que o
      // app nunca produz (o `renderSimpleGate` não roda, o cartão de conexão
      // fica parado na faixa de ações e a zona sai ~170px menor).
      await pg.evaluate(() => { setAppMode('simple'); setTocarNoCelular(true); });
      const destravou = await esperar(pg,
        () => !document.getElementById('simpleMode').classList.contains('sem-tela')
          && document.getElementById('simpleVeil').hidden
          && document.getElementById('simpleTime').hidden,
        'o Modo Fácil destrava pelo caminho real, em repouso [' + cfg + ']');
      if (!destravou) continue;
      // COM MÍDIA NO AR (v1.11.11): sem ela a Biblioteca ENCAIXADA é o corpo e
      // cobre a zona de leitura — onde moram os botões A−/A+ —, e é com a
      // leitura à vista que o par é usado de verdade.
      await pg.evaluate(() => { midiaNoAr = true; renderTransporteHabilitado(); });
      await esperar(pg,
        () => !document.body.classList.contains('simples-principal')
          && getComputedStyle(document.querySelector('.simple-song')).visibility !== 'hidden'
          // A LEITURA ENTRA ANIMADA (v1.11.12): medir geometria no meio do deslize leria um
          // deslocamento que não é do layout.
          && !document.querySelector('.simple-song.entrando'),
        'a leitura é a tela (mídia no ar) [' + cfg + ']');
      await pg.evaluate(async () => {
        const f = document.querySelector('#hymnSearchPopup .popup-sheet');
        await Promise.all(f.getAnimations().map((a) => a.finished.catch(() => {})));
      });

      const m = await medirFacil();

      // ── 1. DENTRO DA CAIXA DA LETRA, NO CANTO INFERIOR DIREITO ───────────
      // O recuo é o MESMO nos dois eixos: o botão assenta no canto, não flutua perto dele. A
      // régua é a PLACA (`#simpleLyrics`), e não a zona: é "dentro da caixa do auxiliar de
      // leitura" que o pedido diz.
      const dentro = (b) => b.left >= m.lyrics.left - 0.01 && b.right <= m.lyrics.right + 0.01
        && b.top >= m.lyrics.top - 0.01 && b.bottom <= m.lyrics.bottom + 0.01;
      const recuoD = m.lyrics.right - m.mais.right;
      const recuoB = m.lyrics.bottom - m.menos.bottom;
      checar(m.doMesmoPai && dentro(m.mais) && dentro(m.menos),
        'OS DOIS BOTÕES ESTÃO DENTRO DA CAIXA DA LETRA, e são irmãos na mesma coluna — pendurados na '
        + 'linha do nome eles já não estão [' + cfg + ']',
        { mais: m.mais, menos: m.menos, placa: m.lyrics });
      checar(recuoD > 0 && recuoB > 0 && perto(recuoD, recuoB) && recuoD < m.mais.w,
        'e no CANTO INFERIOR DIREITO: o recuo até a borda de baixo e o até a da direita são o mesmo '
        + '(o botão assenta no canto) e menores que o próprio botão [' + cfg + ']',
        { direita: n2(recuoD), baixo: n2(recuoB), botao: n2(m.mais.w) });

      // ── 2. UM ACIMA DO OUTRO, EM COLUNA, A+ EM CIMA ──────────────────────
      const vao = m.menos.top - m.mais.bottom;
      checar(perto(m.centroXMais, m.centroXMenos) && vao > 0 && vao < m.mais.h && m.ordem === '+−',
        'UM ACIMA DO OUTRO, em coluna: o mesmo eixo vertical, o A+ em cima do A−, com um vão entre eles '
        + '(e a ordem do DOM é a da tela) [' + cfg + ']',
        { xMais: n2(m.centroXMais), xMenos: n2(m.centroXMenos), vao: n2(vao), ordem: m.ordem });

      // ── 3. SEM MOLDURA ───────────────────────────────────────────────────
      // O grupo não pinta nada (fundo transparente, sem borda, sem sombra, sem recuo); cada botão
      // é a própria superfície, com a sombra dele.
      checar(m.semMoldura.fundo === 'rgba(0, 0, 0, 0)' && /^0px\/0px$/.test(m.semMoldura.borda)
          && m.semMoldura.sombra === 'none' && /^0px/.test(m.semMoldura.padding)
          && m.botao.sombra !== 'none',
        'SEM MOLDURAS, apenas os botões: o grupo não tem fundo, borda, sombra nem recuo, e cada botão é a '
        + 'sua superfície (com a sombra dele) [' + cfg + ']',
        m.semMoldura);

      // ── 4. REDONDOS, E O ALVO CONTINUA `--hit` ───────────────────────────
      // ESTA É A ASSERÇÃO QUE IMPEDE O REMENDO: tudo acima passa com o botão encolhido, e a folha
      // proíbe isso por escrito (*"encolher o alvo seria trocar discrição por erro de toque"*).
      const redondo = /%$/.test(m.botao.raio) ? parseFloat(m.botao.raio) >= 50 : parseFloat(m.botao.raio) >= m.botao.w / 2 - 0.01;
      checar(redondo && m.mais.w + 0.01 >= m.hitToken && m.mais.h + 0.01 >= m.hitToken
          && m.menos.w + 0.01 >= m.hitToken && m.menos.h + 0.01 >= m.hitToken,
        'REDONDOS (FAB) e com o ALVO no mínimo `--hit`: um botão flutuante que encolhe para caber '
        + 'vira erro de toque [' + cfg + ']',
        { raio: m.botao.raio, mais: [n2(m.mais.w), n2(m.mais.h)], menos: [n2(m.menos.w), n2(m.menos.h)], hit: m.hitToken });

      // ── 5. RESPONDEM AO DEDO ─────────────────────────────────────────────
      // O hit-test no CENTRO de cada um: a placa da letra é `position: relative` e vem antes no
      // documento, e um botão que ela cobrisse estaria lá, desenhado e intocável.
      checar(m.alvos.every((a) => a === 'lv-fonte-btn'),
        'e RESPONDEM AO DEDO: no centro de cada um quem recebe o toque é o botão, não a placa da '
        + 'letra [' + cfg + ']', { aMais: m.alvos[0], aMenos: m.alvos[1] });

      // ── 6. LEGÍVEIS: O TRAÇO SOBRE O PREENCHIMENTO DELES ─────────────────
      // O par `--accent` sobre `--surface-porta` é o declarado do azul de "ativado" (5,37:1 no
      // escuro, 6,37:1 no claro); o piso aqui é o AA de texto.
      const rz = razao(m.botao.traco, m.botao.fundo);
      checar(rz >= 4.5,
        'LEGÍVEIS: o traço do A+/A− sobre o preenchimento do botão passa de 4,5:1 nos dois temas [' + cfg + ']',
        { traco: m.botao.traco, fundo: m.botao.fundo, razao: n2(rz) });

      // ── 7. O NOME É O NOME: SEM LINHA, SEM RESERVA, CENTRADO ─────────────
      // A linha `.simple-np-linha` e a folga que ela guardava dos dois lados saíram: o nome ocupa a
      // largura inteira, centrado, e a altura dele é a do TEXTO (menor que o alvo `--hit` que a
      // linha reservava).
      // O nome pintado é o do PLACEHOLDER, e a premissa é cobrada (`nomeRecortado`), não suposta.
      const desvio = m.nomeCentro - m.songCentro;
      checar(m.semLinhaDoNome && !m.nomeRecortado && Math.abs(desvio) <= 1 && m.nomeAltura < m.hitToken,
        'O NOME É O NOME: sem a linha que reservava a altura do par, centrado na zona, e mais baixo que o '
        + 'alvo `--hit` que a linha guardava [' + cfg + ']',
        { semLinha: m.semLinhaDoNome, desvio: n2(desvio), alturaDoNome: n2(m.nomeAltura), nome: m.nomeTexto, recortado: m.nomeRecortado });

      // ── 9. E NO ESTADO PADRÃO OS BOTÕES SÃO INTOCÁVEIS ───────────────────
      // Sem TV o `#simpleVeil` (`inset: 0; z-index: 1`) cobre a zona e só o `.simple-head` é içado.
      // Ela obriga o hit-test da asserção 5 a rodar no estado DESTRAVADO: medi-lo aqui responderia
      // sempre `simpleVeil`.
      await pg.evaluate(() => { setTocarNoCelular(false); });
      const travou = await esperar(pg,
        () => document.getElementById('simpleMode').classList.contains('sem-tela')
          && !document.getElementById('simpleVeil').hidden,
        'o Modo Fácil volta a travar [' + cfg + ']');
      if (travou) {
        await pg.evaluate(async () => {
          const f = document.querySelector('#hymnSearchPopup .popup-sheet');
          await Promise.all(f.getAnimations().map((a) => a.finished.catch(() => {})));
        });
        const t = await medirFacil();
        checar(t.alvos[0] === 'simpleVeil',
          'e NO ESTADO PADRÃO (sem TV) os botões são INTOCÁVEIS: a cortina cobre a zona e só o cabeçalho é '
          + 'içado — é por isso que o hit-test acima roda DESTRAVADO [' + cfg + ']',
          { noCentroDoBotao: t.alvos[0] });
      }

      // ── A OUTRA CASA: o cabeçalho do `#lyricsPopup` ─────────────────────
      // A mesma marcação, o outro habitat: lá o `.lv-fonte-ctl` é
      // `position: static` e o respiro abaixo do par é o `padding-bottom` do
      // cabeçalho, por construção. O alvo entra pela porta da Biblioteca
      // (`openLyricsPopup(item)`), que não toca na cena.
      await pg.evaluate(() => {
        setAppMode('full');
        openLyricsPopup({
          id: 'alvo-da-folha', name: 'Alvorada', kind: 'audio',
          lyrics: [{ text: 'primeira estrofe' }, { text: 'segunda estrofe' }],
        });
      });
      const abriu = await esperar(pg,
        () => document.getElementById('lyricsPopup').classList.contains('open')
          && !!document.querySelector('#lyricsViewBody .lv-row'),
        'a folha de leitura abre [' + cfg + ']');
      if (abriu) {
        const p = await medirPopup();
        // ── 5b. O ALVO CONTINUA `--hit` NA OUTRA CASA ────────────────────
        // REVERSÃO PROVADA (o remendo da 5 escrito SEM escopo):
        // `.lv-fonte-btn { width: 18px; height: 18px }` — a regra do botão é
        // COMPARTILHADA, e encolher o alvo para caber numa casa o encolhe nas
        // duas (18,00 contra 34,00 aqui também).
        checar(perto(p.mais.h, p.hitToken),
          'e o ALVO CONTINUA `--hit` no `#lyricsPopup` também: a regra do botão '
          + 'é UMA, e o remendo de uma casa encolhe o alvo das duas '
          + '[' + cfg + ']',
          { botao: n2(p.mais.h), hit: p.hitToken });
        // ── 8. A OUTRA CASA NÃO SE MEXEU ─────────────────────────────────
        // A afirmação é ESTRUTURAL, e por isso a régua é o `padding-bottom`
        // computado do próprio cabeçalho: mudar o recuo não a reprova (o
        // desenho continua coerente), mas tirar o par do fluxo — que é como
        // alguém "generalizaria" o conserto do Modo Fácil para a regra
        // compartilhada — reprova.
        // REVERSÃO PROVADA: `position: absolute; right: 0; top: 50%;
        // transform: translateY(-50%)` na regra COMPARTILHADA `.lv-fonte-ctl`
        // → o par sai do fluxo, cai para o meio da FOLHA e o respiro vira
        // −49,63px; só esta reprova.
        const respiro = p.abaixo ? p.abaixo.top - p.mais.bottom : null;
        checar(p.posicao === 'static' && respiro !== null && perto(respiro, p.recuo),
          'A OUTRA CASA NÃO SE MEXEU: no `#lyricsPopup` o par é `static` — ele '
          + 'CONTA para a altura da linha —, e o respiro abaixo dele é o '
          + '`padding-bottom` do cabeçalho [' + cfg + ']',
          { posicao: p.posicao, respiro: respiro === null ? null : n2(respiro),
            recuoDoCabecalho: n2(p.recuo), abaixo: p.abaixoQuem });
      }
      await pg.evaluate(() => closeLyricsPopup());
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PASSE B — COM MÍDIA NO AR: A LETRA ROLA PARA CIMA DOS BOTÕES, E O SCRUBBER FICA LIVRE
  //
  // A metade FUNCIONAL. Os botões flutuam sobre a placa, então no fim da rolagem a última
  // estrofe tem de poder subir ACIMA da coluna (a folga é a margem do último item) — sem ela
  // ela ficaria presa embaixo deles, ilegível. E com a linha do tempo à vista os botões não
  // chegam ao `#simpleTimeHit`, o scrubber que salta o louvor no ar.
  // ═══════════════════════════════════════════════════════════════════════
  await pg.evaluate((id) => { setAppMode('simple'); setTocarNoCelular(true); send(id); }, idAudio);
  for (const tela of TELAS) {
    await pg.setViewportSize({ width: tela.w, height: tela.h });
    for (const tema of TEMAS) {
      const cfg = tela.w + '×' + tela.h + ' ' + tema;
      await pg.evaluate((t) => { setTema(t); setAppMode('simple'); setTocarNoCelular(true); }, tema);
      // A MEDIDA É TIRADA DENTRO DA PRÓPRIA ESPERA: o `renderSimpleTime` esconde a faixa em todo
      // quadro em que a preview ainda não tem duração.
      const emCena = await esperar(pg, () => {
        const t = document.getElementById('simpleTime');
        const hit = document.getElementById('simpleTimeHit');
        const mais = document.querySelector('.simple-fabs .lv-fonte-mais');
        if (!t || t.hidden || !hit || !mais) return false;
        const rh = hit.getBoundingClientRect();
        if (!(rh.height > 0)) return false;
        window.__folga = mais.getBoundingClientRect().top - rh.bottom;
        return true;
      }, 'a linha do tempo entra em cena com a mídia no ar [' + cfg + ']');
      if (!emCena) continue;
      const folga = await pg.evaluate(() => window.__folga);
      checar(folga > 0,
        'COM MÍDIA NO AR os botões ficam ABAIXO do `#simpleTimeHit`: o scrubber que salta o louvor no ar '
        + 'não perde alvo para um botão de tamanho de fonte [' + cfg + ']',
        { folga: n2(folga) });

      // A LETRA LONGA: rola até o fim e a última linha tem de ficar ACIMA do botão de cima.
      const rolagem = await pg.evaluate(async () => {
        currentItem.lyrics = [{ cover: true }, ...Array.from({ length: 40 }, (_, i) =>
          ({ time: i * 2, text: 'Estrofe ' + (i + 1) + ' do louvor para a congregação cantar junto' }))];
        refreshSimpleLyrics();
        await new Promise((r) => setTimeout(r, 200));
        const z = document.getElementById('simpleLyrics');
        z.scrollTop = z.scrollHeight;
        await new Promise((r) => setTimeout(r, 200));
        const linhas = [...z.querySelectorAll('.lv-row')];
        const ultima = linhas[linhas.length - 1].getBoundingClientRect();
        const mais = document.querySelector('.simple-fabs .lv-fonte-mais').getBoundingClientRect();
        return { linhas: linhas.length, rola: z.scrollHeight > z.clientHeight + 1,
          ultimaBase: ultima.bottom, topoDoBotao: mais.top };
      });
      // REVERSÃO PROVADA: sem a margem do último item (`.simple-lyrics > :last-child`) a base da última
      // linha passa do topo do botão de cima — a estrofe fica sob a coluna.
      checar(rolagem.rola && rolagem.linhas > 20 && rolagem.ultimaBase <= rolagem.topoDoBotao + 0.5,
        'NO FIM DA ROLAGEM a última estrofe fica ACIMA da coluna de botões: a folga é a margem do último '
        + 'item, e sem ela a letra ficaria presa sob eles [' + cfg + ']',
        rolagem);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PASSE C — O TOQUE FUNCIONA: A+ AUMENTA, A− DIMINUI
  // ═══════════════════════════════════════════════════════════════════════
  await pg.setViewportSize({ width: TELAS[0].w, height: TELAS[0].h });
  await pg.evaluate(() => { setTema('escuro'); setAppMode('simple'); setTocarNoCelular(true); });
  await esperar(pg, () => !!document.querySelector('.simple-fabs .lv-fonte-mais')
    && getComputedStyle(document.querySelector('.simple-song')).visibility !== 'hidden'
    && !document.querySelector('.simple-song.entrando'), 'a leitura está à vista para o toque');
  const lerFonte = () => pg.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--lv-fonte')));
  const f0 = await lerFonte();
  await pg.click('.simple-fabs .lv-fonte-mais');
  const f1 = await lerFonte();
  await pg.click('.simple-fabs .lv-fonte-menos');
  await pg.click('.simple-fabs .lv-fonte-menos');
  const f2 = await lerFonte();
  checar(f1 > f0 && f2 < f1,
    'o TOQUE funciona: A+ aumenta a letra e A− diminui — a mesma escada das duas casas do par',
    { inicial: f0, depoisDoMais: f1, depoisDeDoisMenos: f2 });

  checar(erros.length === 0, 'nenhum erro de console durante a bateria', erros.slice(0, 4));
} finally {
  await ctx.close();
  await navegador.close();
  servidor.close();
}

if (falhas.length) {
  console.error('\n' + falhas.length + ' asserção(ões) reprovada(s).');
  process.exit(1);
}
console.log('\ntudo certo.');
