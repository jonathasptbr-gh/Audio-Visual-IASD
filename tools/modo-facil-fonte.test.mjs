#!/usr/bin/env node
// ============================================================================
// O A+/A− DO MODO FÁCIL: A LINHA RESERVA A ALTURA DO PAR (v1.5.19)
//
// Relato do operador: *"ajuste a margem dos botões de aumentar e diminuir a
// fonte no modo simples, eles estão colados nos elementos abaixo dele"*.
//
// ## O que estava acontecendo, e por que "colados" era otimista
//
// `.lv-fonte-ctl` é `position: absolute` dentro da `.simple-np-linha` — é assim
// que o nome continua CENTRADO com um par de botões pendurado à direita. A
// outra metade do `absolute` é que uma caixa fora de fluxo **não conta para a
// altura do pai**: quem dava altura àquela linha era o `.simple-np` sozinho
// (`--fs-xl`, 18px), e o botão mede `--hit` (34px). A linha continha 34 dentro
// de 18, e o par transbordava 8px para cada lado. Os `gap` que a folha declara
// (`--sp-3` embaixo, `--sp-5` em cima) são medidos a partir da LINHA, não do
// botão: o respiro real virava **−2,40px** embaixo.
//
// Respiro NEGATIVO não é aperto, é SOBREPOSIÇÃO — e ela decide o hit-test
// contra o botão: `.simple-lyrics` é `position: relative` (o offsetParent do
// `lvScroll`) e vem DEPOIS no documento, então a placa pinta e RECEBE o toque
// nos 2,4px de baixo do par. Com a linha do tempo à vista o vizinho é pior: o
// `#simpleTimeHit`, o scrubber que salta o louvor no ar, perdia 27% da margem
// de toque dele para um botão de tamanho de fonte.
//
// ## Por que isto precisa de oráculo
//
// **Nada disso lança, nada aparece no console e nada quebra um fluxo.** O que
// sai é uma tela que continua funcionando: os botões estão lá, desenhados,
// respondendo na maior parte da área. O único sinal é geométrico, e ele mora em
// duas propriedades (`position` e `min-height`) que qualquer lote futuro pode
// mexer por outro motivo.
//
// ## As três réguas deste arquivo
//
//  1. **NENHUM NÚMERO DE ESPAÇO ESCRITO AQUI.** O respiro é comparado contra o
//     `row-gap` COMPUTADO do próprio contêiner, e a altura do botão contra o
//     `--hit` resolvido. Escrever `5,60` mediria o `font-size` da raiz do
//     runner pela porta dos fundos — e os dois lados de cada comparação são
//     medidas do MESMO desenho.
//  2. **O ALVO É O QUE IMPEDE O REMENDO.** As asserções de espaço PASSAM com o
//     botão encolhido a 18px — que é o conserto barato, e o que a folha proíbe
//     por escrito (*"encolher o alvo junto seria trocar discrição por erro de
//     toque"*). Por isso o `--hit` tem asserção própria, e nas DUAS casas do
//     par (o Modo Fácil e o `#lyricsPopup`).
//  3. **O MODO SE DESTRAVA PELO CAMINHO REAL.** `setTocarNoCelular(true)`, e
//     nunca arrancando `.sem-tela` e escondendo o `#simpleVeil` à mão: isso
//     produz um DOM que o app não gera (o `renderSimpleGate` não roda, o cartão
//     de conexão fica parado na faixa de ações e a zona sai ~170px menor). É a
//     classe "o oráculo correndo contra o app".
//
//   node tools/modo-facil-fonte.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, checar, falhas } from './arnes.mjs';

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

// AS TELAS e OS TEMAS. Duas larguras porque a `.simple-np-linha` é a única
// linha deste modo cuja altura NÃO depende da largura — se ela dependesse, uma
// tela só provaria uma coluna. Dois temas porque a folha do Modo Fácil tem
// regras próprias no claro e o par vive sobre a placa da letra, que é branco
// PLENO ali: é onde a sobreposição literalmente APAGA o botão.
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

// A tolerância de meio pixel. Ela não é folga preguiçosa: a linha inteira acima
// do par tem altura de TEXTO, então o topo dela cai em coordenada fracionária e
// o arredondamento de layout do Chromium anda até ~0,4px. Os desvios que este
// arquivo procura são de 8px para cima.
const PERTO = 0.5;
const perto = (a, b) => Math.abs(a - b) <= PERTO;
const n2 = (v) => Number(v.toFixed(2));

try {
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  const dePe = await esperar(pg,
    () => window.AVDB && typeof window.__avBack === 'function'
      && !!document.querySelector('#playlist li'),
    'o app fica de pé', null, 30000);
  if (!dePe) throw new Error('o app não subiu');

  const idAudio = await pg.evaluate(new Function(
    'return (async () => { setAppMode("full");' + SEMEAR + 'await load(); return a.id; })()'));

  // ---- A MEDIÇÃO DA CASA 1: a linha do nome do Modo Fácil ----------------
  // Tudo o que ela devolve é uma medida do desenho ou um token resolvido: não
  // há número de espaço escrito no oráculo, e por isso um ajuste legítimo de
  // `--sp-3`/`--sp-5`/`--hit` não a reprova.
  const medirFacil = () => pg.evaluate(() => {
    const linha = document.querySelector('.simple-np-linha');
    const nome = document.getElementById('simpleNpName');
    const [menos, mais] = [...linha.querySelectorAll('.lv-fonte-btn')];
    const lyrics = document.getElementById('simpleLyrics');
    const head = document.querySelector('.simple-head');
    const song = document.querySelector('.simple-song');
    const simple = document.getElementById('simpleMode');
    const tempoHit = document.getElementById('simpleTimeHit');
    const tempo = document.getElementById('simpleTime');
    const cx = (e) => { const b = e.getBoundingClientRect(); return b.left + b.width / 2; };
    const r = (e) => {
      const b = e.getBoundingClientRect();
      return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, h: b.height, w: b.width };
    };
    // O NOME PINTADO, e não a caixa dele: a caixa é `flex: 1` e ocupa a linha
    // inteira nas duas versões, então medi-la aprovaria um rótulo colado numa
    // das bordas. O `Range` mede o texto.
    const rng = document.createRange();
    rng.selectNodeContents(nome);
    const t = rng.getBoundingClientRect();
    // O hit-test devolve um NOME estável: `elementFromPoint` responde com o
    // elemento, e o que interessa é se ele é o próprio botão ou a placa.
    const quem = (x, y) => {
      const el = document.elementFromPoint(x, y);
      if (!el) return null;
      if (el === mais || el === menos) return 'lv-fonte-btn';
      return el.id || (typeof el.className === 'string' ? el.className : '') || el.tagName;
    };
    const rm = r(mais);
    return {
      linha: r(linha), mais: rm, menos: r(menos), lyrics: r(lyrics), head: r(head),
      tempoHit: tempoHit ? r(tempoHit) : null,
      tempoAVista: !!(tempo && !tempo.hidden),
      gapSong: parseFloat(getComputedStyle(song).rowGap) || 0,
      gapSimple: parseFloat(getComputedStyle(simple).rowGap) || 0,
      hitToken: parseFloat(getComputedStyle(document.documentElement)
        .getPropertyValue('--hit')) || 0,
      alvos: [1, 2, 3].map((d) => quem(cx(mais), rm.bottom - d)),
      noCentro: quem(cx(mais), rm.top + rm.h / 2),
      nomeTexto: nome.textContent,
      // A PREMISSA da asserção de centralização, medida e não suposta: o
      // `.simple-np` é `nowrap` + `ellipsis`, e um nome que não caiba faz o
      // `Range` medir o texto INTEIRO, fora da caixa.
      nomeRecortado: nome.scrollWidth > nome.clientWidth + 1,
      nomeCentro: (t.left + t.right) / 2,
      linhaCentro: r(linha).left + r(linha).w / 2,
      semTela: document.getElementById('simpleMode').classList.contains('sem-tela'),
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

      const m = await medirFacil();

      // ── 1. A LINHA RESERVA A ALTURA DO PAR ──────────────────────────────
      // REVERSÃO PROVADA: `.simple-np-linha { min-height: 0 }` — a linha volta
      // a medir o `.simple-np` sozinho (18,00) contra os 34,00 do botão. É a
      // reversão das asserções 1 a 4 e 6: elas são as cinco faces do MESMO
      // defeito, e uma reversão que derrubasse só uma delas estaria descrevendo
      // outra coisa.
      checar(m.linha.h + 0.01 >= m.mais.h,
        'A LINHA DO NOME RESERVA A ALTURA DO PAR: uma caixa `absolute` não conta '
        + 'para a altura do pai, e sem a reserva a linha contém 34 dentro de 18 '
        + '[' + cfg + ']',
        { linha: n2(m.linha.h), botao: n2(m.mais.h) });

      // ── 2. O RESPIRO ABAIXO É O `gap` DECLARADO ─────────────────────────
      // A régua é o `row-gap` COMPUTADO do `.simple-song`, nunca o número: o
      // defeito é o par transbordar para FORA do vão, e a folha continua
      // declarando o mesmo vão nas duas versões.
      // REVERSÃO PROVADA: `.simple-np-linha { min-height: 0 }` → −2,41px, isto
      // é, o botão POR BAIXO da placa da letra.
      const abaixo = m.lyrics.top - m.mais.bottom;
      checar(perto(abaixo, m.gapSong),
        'e o RESPIRO ABAIXO do par vale o `gap` que a folha declara — respiro '
        + 'NEGATIVO não é aperto, é a placa da letra pintando por cima do botão '
        + '[' + cfg + ']',
        { respiro: n2(abaixo), gapDoSong: n2(m.gapSong) });

      // ── 3. O RESPIRO ACIMA IDEM, E CONTRA O `.simple-head` ──────────────
      // A régua é o CABEÇALHO, e não a engrenagem que mora nele: os dois
      // coincidem hoje só porque o `.settings-btn` é a coisa mais alta daquela
      // linha, e a asserção é sobre o LAYOUT — medir a engrenagem passaria a
      // responder por um botão no dia em que outra coisa crescer ali.
      // REVERSÃO PROVADA: `.simple-np-linha { min-height: 0 }` → +1,59px (o par
      // comendo 8,00 dos 9,60 do vão).
      const acima = m.mais.top - m.head.bottom;
      checar(perto(acima, m.gapSimple),
        'e o RESPIRO ACIMA vale o `gap` do `.simple`, medido do `.simple-head` '
        + '[' + cfg + ']',
        { respiro: n2(acima), gapDoSimple: n2(m.gapSimple) });

      // ── 4. O BOTÃO RESPONDE AO DEDO NA BASE DELE ────────────────────────
      // A metade que a geometria sozinha não diz: `.lv-fonte-ctl` e
      // `.simple-lyrics` são as DUAS posicionadas, e a placa vem depois no
      // documento — ela ganha o hit-test onde encosta. Um teste de `top`/
      // `bottom` aprova um desenho em que o botão está lá e não é tocável.
      // REVERSÃO PROVADA: `.simple-np-linha { min-height: 0 }` → os três pontos
      // devolvem `simpleLyrics`.
      checar(m.alvos.every((a) => a === 'lv-fonte-btn'),
        'e o BOTÃO RESPONDE AO DEDO na base dele: a `.simple-lyrics` é a outra '
        + 'posicionada da zona e vem depois no documento — onde ela encosta, é '
        + 'ela que recebe o toque [' + cfg + ']',
        { em1e2e3: m.alvos });

      // ── 5. O ALVO CONTINUA `--hit` (a casa do Modo Fácil) ───────────────
      // ESTA É A ASSERÇÃO QUE IMPEDE O REMENDO. As quatro de cima PASSAM com o
      // botão encolhido a 18px, e a folha proíbe isso por escrito: *"encolher o
      // alvo junto seria trocar discrição por erro de toque"*.
      // REVERSÃO PROVADA (o remendo): `.simple-np-linha { min-height: 0 }` mais
      // `.simple-np-linha .lv-fonte-btn { width: 18px; height: 18px }` — as
      // asserções 1 a 4, 6, 7 e 9 continuam TODAS verdes e só esta reprova
      // (18,00 contra o `--hit` de 34,00). Escrito sem o escopo, o remendo
      // alcança a regra COMPARTILHADA e derruba junto as duas asserções do
      // `#lyricsPopup` — o que é o argumento delas, não um efeito colateral.
      checar(perto(m.mais.h, m.hitToken) && perto(m.menos.h, m.hitToken),
        'e o ALVO CONTINUA `--hit` no Modo Fácil — as quatro asserções acima '
        + 'passam com o botão encolhido, que é o conserto barato que a folha '
        + 'proíbe [' + cfg + ']',
        { aMais: n2(m.mais.h), aMenos: n2(m.menos.h), hit: m.hitToken });

      // ── 7. A CENTRALIZAÇÃO DO NOME NÃO MUDOU ────────────────────────────
      // O `absolute` FICA — ele é o que mantém o nome no centro com o par
      // pendurado à direita —, e a reserva de altura não podia custar isso.
      // Ela mede o texto PINTADO (`Range`), e por isso EXIGE nome curto: com um
      // nome que não caiba, o `Range` mede o texto não recortado e o desvio sai
      // em centenas de pixels em TODAS as variantes, inclusive nas corretas —
      // a asserção passaria a aprovar um rótulo descentrado. A premissa é
      // COBRADA (`nomeRecortado`), e não suposta: assim um rótulo que cresça
      // num lote futuro reprova aqui em vez de calar a asserção.
      // REVERSÃO PROVADA: `.simple-np-linha > .simple-np { padding: 0 0 0
      // calc(var(--hit) * 2 + 2px) }` (a folga reservada só de um lado) → o
      // texto anda 34,99px para a direita, e só esta reprova.
      const desvio = m.nomeCentro - m.linhaCentro;
      checar(!m.nomeRecortado && Math.abs(desvio) <= 1,
        'e o NOME CONTINUA CENTRADO: a folga é reservada dos DOIS lados, e é '
        + 'isso que o `absolute` do par existe para preservar [' + cfg + ']',
        { desvio: n2(desvio), nome: m.nomeTexto, recortado: m.nomeRecortado });

      // ── 9. E NO ESTADO PADRÃO O PAR É INTOCÁVEL ─────────────────────────
      // Sem TV o `#simpleVeil` (`inset: 0; z-index: 1`) cobre a zona e só o
      // `.simple-head` é içado — o par não é alcançável ali, com ou sem a
      // reserva de altura. Ela existe porque é o próximo relato provável, e
      // porque é ela que obriga o hit-test da asserção 4 a rodar no estado
      // DESTRAVADO: medi-lo aqui responderia sempre `simpleVeil`, aprovando as
      // duas versões.
      // REVERSÃO PROVADA: `.simple.sem-tela .simple-song { position: relative;
      // z-index: 2 }` — içar a zona da letra junto com o cabeçalho, que é o
      // engano plausível — e o hit-test passa a devolver o BOTÃO. (Mexer no
      // `z-index` da própria cortina NÃO serve de reversão: ela é posicionada e
      // vem depois no documento, então continua pintando por cima da zona.)
      await pg.evaluate(() => { setTocarNoCelular(false); });
      const travou = await esperar(pg,
        () => document.getElementById('simpleMode').classList.contains('sem-tela')
          && !document.getElementById('simpleVeil').hidden,
        'o Modo Fácil volta a travar [' + cfg + ']');
      if (travou) {
        const t = await medirFacil();
        checar(t.noCentro === 'simpleVeil',
          'e NO ESTADO PADRÃO (sem TV) o par é INTOCÁVEL: a cortina cobre a zona '
          + 'e só o cabeçalho é içado — é por isso que o hit-test acima roda '
          + 'DESTRAVADO [' + cfg + ']',
          { noCentroDoBotao: t.noCentro });
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
  // PASSE B — COM MÍDIA NO AR, O VIZINHO DE BAIXO É UM CONTROLE
  //
  // A metade FUNCIONAL do relato. Com a linha do tempo à vista o par encosta no
  // `#simpleTimeHit` — o scrubber que salta o louvor no ar, cujo alvo tem
  // `padding: .55rem` de propósito (*"4px é metade do que um dedo acerta"*). O
  // par sobrepunha 35,44 × 2,41px dele, e ali o `absolute` inverte quem ganha o
  // hit-test: o botão de tamanho de fonte rouba alvo do seek.
  // ═══════════════════════════════════════════════════════════════════════
  await pg.evaluate((id) => { setAppMode('simple'); setTocarNoCelular(true); send(id); }, idAudio);
  for (const tela of TELAS) {
    await pg.setViewportSize({ width: tela.w, height: tela.h });
    for (const tema of TEMAS) {
      const cfg = tela.w + '×' + tela.h + ' ' + tema;
      await pg.evaluate((t) => { setTema(t); setAppMode('simple'); setTocarNoCelular(true); }, tema);
      // A MEDIDA É TIRADA DENTRO DA PRÓPRIA ESPERA, e não depois dela: o
      // `renderSimpleTime` esconde a faixa em todo quadro em que a preview
      // ainda não tem duração, e medir "logo após" a espera é uma aposta na
      // máquina — MEDIDO, uma das quatro configurações leu o `#simpleTimeHit`
      // já escondido de novo e reprovou com 88px de sobreposição inventada.
      const emCena = await esperar(pg, () => {
        const t = document.getElementById('simpleTime');
        const hit = document.getElementById('simpleTimeHit');
        const linha = document.querySelector('.simple-np-linha');
        const menos = linha && linha.querySelector('.lv-fonte-btn');
        if (!t || t.hidden || !hit || !menos) return false;
        const rh = hit.getBoundingClientRect();
        if (!(rh.height > 0)) return false;
        const rb = menos.getBoundingClientRect();
        window.__folga = {
          folga: rh.top - rb.bottom,
          gapDoSong: parseFloat(getComputedStyle(
            document.querySelector('.simple-song')).rowGap) || 0,
        };
        return true;
      }, 'a linha do tempo entra em cena com a mídia no ar [' + cfg + ']');
      if (!emCena) continue;
      const f = await pg.evaluate(() => window.__folga);
      // ── 6. O PAR NÃO INVADE O SCRUBBER ─────────────────────────────────
      // REVERSÃO PROVADA: `.simple-np-linha { min-height: 0 }` → −2,41px, e a
      // sobreposição de 35,44 × 2,41px sobre o alvo do seek.
      checar(f.folga >= -0.01,
        'COM MÍDIA NO AR o par NÃO INVADE o `#simpleTimeHit`: o scrubber que '
        + 'salta o louvor perdia 27% da margem de toque dele para um botão de '
        + 'tamanho de fonte [' + cfg + ']',
        { folga: n2(f.folga), gapDoSong: n2(f.gapDoSong) });
    }
  }

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
