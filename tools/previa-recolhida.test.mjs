// A PRÉVIA RECOLHIDA — a seta no topo da prévia, que a encolhe a uma tira (v1.11.7).
//
// ## O que o recurso é, e onde cada defeito dele falha CALADO
//
// O tile "Imagem da prévia" saiu de Configurações e virou uma SETA DENTRO da
// prévia (`#pvRecolherBtn`), nos dois modos. O toque grava a MARCAÇÃO
// (`economiaPreview`) e a prévia vira uma TIRA: a classe `pv-recolhida` põe os
// botões em fluxo numa grade e a altura passa a ser a do CONTEÚDO — ninguém
// declara 38 ou 72 px em lugar nenhum. Cinco coisas se quebram sem erro:
//
//   · **A altura que sobra.** Uma altura declarada (`height: 72px`) ou um piso
//     esquecido recolhe "para menos", mas não para o MENOR POSSÍVEL, e o
//     operador pediu o menor: a asserção que prova isso é a FOLGA (altura da
//     prévia − o que os botões ocupam), e uma asserção só de "cabe" é
//     tautologia — passa com qualquer altura maior.
//   · **A tela cheia sem TV.** Ali a prévia É a projeção. Uma regra recolhida
//     sem `:not(:fullscreen)` esconde as camadas e a congregação vê o BRANCO,
//     sem erro algum.
//   · **O cartão de espera.** Ele mede 43 a 58 px e não cabe numa tira de 38,
//     e é a ÚNICA porta de cancelar um download e o ÚNICO canal de falha do
//     "tocar": sem `:not(:has(.pv-busy.on))` ele é engolido pelo `overflow`.
//   · **As camadas.** A `visibility: hidden` é o que tira a letra e o texto
//     de uma tira de 12 px de altura (ilegíveis, e pagando decodificação).
//   · **As DUAS réguas.** A GEOMETRIA segue a marcação (também sem TV: a seta
//     tem de fazer algo visível), a DECODIFICAÇÃO segue `economiaAtiva()`
//     (marcação E destino E fora da tela cheia). Ligar a decodificação à
//     marcação pausa o `<video>` que, sem tela, é a fonte do SOM.
//
// ## O que se MEDE, e o que NÃO se escreve aqui
//
// `--hit` é LIDO do estilo (`getComputedStyle`), nunca escrito, e o recuo da
// tira também. O oráculo só afirma relações — "todo botão mede `--hit`",
// "está dentro", "não se sobrepõem", "a folga é no máximo 2,5 px" — e é a
// folga, não o número 38 ou 72, o que prova a altura.
//
// ## O que NÃO cobre — e está dito
//
//   · O `:has()` num WebView antigo (< 105): o Chromium deste runner o
//     entende, e o que acontece sem ele (a regra inteira cai e nada recolhe) é
//     fato do motor, não deste arquivo.
//   · O toque com o DEDO: `click()` aqui é o do Playwright. Que o alvo seja
//     quadrado e de `--hit` é o que sustenta o dedo, e isso é medido.
//   · A decodificação em tela cheia é do `saida-de-audio-e-economia`.
//
// Uso:
//   node tools/previa-recolhida.test.mjs

import path from 'path';
import { fileURLToPath } from 'url';
import { semRedeExterna } from './sem-rede.mjs';
import {
  servirEstatico, abrirNavegador, esperarCortina, esperar, esperarDb, porque, checar, falhas,
} from './arnes.mjs';

// A PONTE DE MENTIRA: lista de telas MUTÁVEL (a do `saida-de-audio-e-economia`).
// O modo nativo exige a ponte, e TODO método que o `native.js` chama por `call()`
// tem de estar na allowlist — o que falta não resolve e o `call()` trava 60 s
// calado, que resolve `null` e passa.
const PONTE = `(() => {
  window.__telas = [];
  window.__espelho = { ligado: false, telas: [] };
  const B = {
    shellVersion: () => 77,
    role: () => 'controle',
    appVersion: () => '1.99-teste',
    takeShare: () => '',
    busPost: () => {},
    otaConfirm: () => {},
    displays: (id) => {
      setTimeout(() => { try { window.__avResolve(id, window.__telas); } catch (_) {} }, 0);
    },
    espelhoEstado: (id) => {
      setTimeout(() => { try { window.__avResolve(id, window.__espelho); } catch (_) {} }, 0);
    },
  };
  const nomes = ['apkInstalar','apkProcurar','bgProgress','captureVolumeKeys','projecaoLocal',
    'castTarget','saidaDeAudioAlvo','cifraDiag','cifraHtml','deckDiscard','deckExportUrl','deckPages',
    'espelhoCertApagar','espelhoCertEstado','espelhoCertImportar','espelhoDesligar','espelhoDiag',
    'espelhoEstado','espelhoLigar','espelhoLigarEm','espelhoDerrubar','farolEstado','keepAlive',
    'listFolder','nowPlaying','openCast','abrirSaidaDeAudio','openExternal','otaApply','otaCheck',
    'otaDiag','otaPending','pacoteDiag','pickDoc','pickFolder','salvarTexto','systemVolume',
    'temaClaro','ytCancel','ytCanalPlaylists','ytDiag','ytDiscard','ytFetch','ytFetchAte',
    'ytFetchAudio','ytPlaylist','ytSearch','ytStream','areaTransferencia','atualizacaoEstado',
    'compartilharTexto','pacoteDescartarPronto','espacoLivre',
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

// Uma faixa de 30 s com `kind: 'video'` (é o KIND que põe a cena na prévia: um
// `audio` sem letra deixa o wallpaper, sem `<video>` a que perguntar).
const SEMEAR = `
  const wav = (secs) => {
    const sr = 8000, n = sr * secs;
    const buf = new ArrayBuffer(44 + n * 2), dv = new DataView(buf);
    const wr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    wr(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); wr(8, 'WAVEfmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true);
    dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
    wr(36, 'data'); dv.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, Math.sin(i / 20) * 3000, true);
    return new Blob([buf], { type: 'audio/wav' });
  };
  const id = 'louvor-recolhida';
  const caminho = 'folders/teste/' + id + '.wav';
  await AVDB.opfsWriteFile(caminho, wav(30));
  await AVDB.fileAdd({
    id, folder: 'teste', opfsPath: caminho, srcName: id,
    name: 'LOUVOR DA PREVIA', type: 'audio/wav', kind: 'video', size: 1, mtime: 1,
    thumb: null, blob: null, url: null, addedAt: 1, lyrics: null,
  });
  await AVDB.listAdd('imports', id);
`;

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador({ args: ['--autoplay-policy=no-user-gesture-required'] });
const erros = [];

const TV = [{ id: 7, name: 'TV do templo', w: 1920, h: 1080, density: 320, telao: true }];
const trocarTelas = async (pg, telas) => {
  await pg.evaluate((t) => { window.__telas = t; window.__avDisplaysChanged(); }, telas);
  await pg.waitForFunction(
    (t) => Array.isArray(lastDisplays) && lastDisplays.length === t.n,
    { n: telas.length }, { timeout: 5000 },
  );
};

// A MEDIDA DA PRÉVIA, numa leitura SÍNCRONA (layout é lido na hora: nenhuma
// espera entre escrever o estado e medir). `--hit` e o recuo saem do ESTILO —
// o oráculo não conhece 34 nem 2. "Visível" é o que o operador alcança: sem
// `display: none`, sem `visibility: hidden` e com caixa.
const MEDIR = (tirarFallback) => {
  const r = (el) => { const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, w: b.width, h: b.height }; };
  const pv = document.getElementById('preview');
  // `tirarFallback`: mede COMO SERIA com a linha única à força (a classe é devolvida ao fim da
  // própria leitura, antes de qualquer quadro) — é o que prova que o fallback só liga quando precisa.
  const tinhaFallback = pv.classList.contains('pv-extras-baixo');
  if (tirarFallback) pv.classList.remove('pv-extras-baixo');
  const cs = getComputedStyle(pv);
  const hit = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hit'));
  const vis = (e) => {
    const s = getComputedStyle(e);
    const b = e.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && b.width > 0 && b.height > 0;
  };
  const P = r(pv);
  const fabs = [...pv.querySelectorAll('.pv-fab')].filter(vis).map((e) => {
    const svg = e.querySelector('svg');
    return { id: e.id || e.className, ...r(e), svg: svg ? r(svg) : null };
  });
  const seta = fabs.find((f) => f.id === 'pvRecolherBtn') || null;
  const cx = seta ? (seta.l + seta.w / 2) - (P.l + P.w / 2) : null;
  const fora = fabs.filter((f) => f.l < P.l - 0.5 || f.t < P.t - 0.5
    || f.l + f.w > P.l + P.w + 0.5 || f.t + f.h > P.t + P.h + 0.5).map((f) => f.id);
  const sobre = [];
  for (let i = 0; i < fabs.length; i++) {
    for (let j = i + 1; j < fabs.length; j++) {
      const a = fabs[i], b = fabs[j];
      if (a.l < b.l + b.w - 0.5 && b.l < a.l + a.w - 0.5 && a.t < b.t + b.h - 0.5 && b.t < a.t + a.h - 0.5) {
        sobre.push(a.id + ' x ' + b.id);
      }
    }
  }
  // O GIRO traz o ângulo escrito ("270°") e por isso é mais LARGO que `--hit`:
  // para ele a régua é a ALTURA (e a largura nunca menor que `--hit`); para os
  // demais, o QUADRADO.
  const comRotulo = ['pvGiroBtn'];
  const diferentes = fabs.filter((f) => Math.abs(f.h - hit) > 0.5
    || (comRotulo.includes(f.id) ? f.w < hit - 0.5 : Math.abs(f.w - hit) > 0.5))
    .map((f) => f.id + ':' + f.w.toFixed(1) + 'x' + f.h.toFixed(1));
  // A FOLGA: o que a prévia tem a mais do que os botões ocupam. Recuo lido do
  // estilo da própria prévia (a tira recuada em cima e embaixo).
  let folga = null;
  if (fabs.length) {
    const topo = Math.min(...fabs.map((f) => f.t));
    const base = Math.max(...fabs.map((f) => f.t + f.h));
    folga = P.h - (base - topo) - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  }
  const linhas = new Set(fabs.map((f) => Math.round(f.t / 4))).size;
  if (tirarFallback) pv.classList.toggle('pv-extras-baixo', tinhaFallback);
  return {
    hit, P, cls: pv.className, fabs, ids: fabs.map((f) => f.id).join(','), seta, cx,
    fora, sobre, diferentes, folga, linhas,
    ladoDoIcone: seta && seta.svg ? [seta.svg.w, seta.svg.h] : null,
    esquerdaDaSeta: seta ? seta.l - P.l : null,
    cast: fabs.find((f) => f.id === 'pvCastBtn') || null,
  };
};

async function abrir(largura = 430, altura = 900) {
  const ctx = await navegador.newContext({ viewport: { width: largura, height: altura }, reducedMotion: 'reduce' });
  await semRedeExterna(ctx);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await pg.addInitScript(PONTE);
  await pg.goto(base + '/controle/', { waitUntil: 'load' });
  await pg.waitForFunction(
    () => window.__NATIVE__ === true && window.AVDB && typeof window.__avBack === 'function',
    null, { timeout: 30000 },
  );
  await esperarCortina(pg);
  return { ctx, pg };
}

try {
  const { ctx, pg } = await abrir();
  await trocarTelas(pg, TV);

  // =========================================================================
  // A · A SETA, QUADRADA E NO LUGAR CERTO (só no avançado: o Modo Fácil não tem prévia, v1.11.11)
  // B · RECOLHER: A ALTURA É A MENOR POSSÍVEL (a folga), SEM BOTÃO APERTADO
  // H · COM SELO E GIRO À VISTA: LINHA ÚNICA, OU DUAS SE NÃO CABE (v1.11.17), SEM SOBREPOSIÇÃO
  // =========================================================================
  // Uma varredura só: 3 larguras x 2 proporções, e em cada célula três
  // estados (expandida, recolhida e recolhida com o giro à vista). A largura
  // mexe no que CABE na linha, e a proporção na altura natural da prévia — e é
  // só a 320 px que selo e giro deixam de caber ao lado da seta.
    for (const modo of ['full']) {
    await pg.evaluate((m) => setAppMode(m), modo);
    const modoOk = await esperar(pg, (m) => appMode === m, modo, 5000);
    checar(modoOk === true, 'A0 · PREMISSA: o modo ' + modo + ' está de pé', porque(modoOk));
    for (const largura of [320, 360, 430]) {
      await pg.setViewportSize({ width: largura, height: 900 });
      await esperar(pg, (w) => window.innerWidth === w, largura, 5000);
      for (const ar of ['1.2', '2.4']) {
        const tag = modo + '/' + largura + 'px/ar ' + ar;
        // Sem giro, expandida: o estado de partida.
        const exp = await pg.evaluate(async (v) => {
          document.documentElement.style.setProperty('--pv-ar', v);
          mediaRot = 0; renderRotBtn();
          await setEconomiaPreview(false);
          return null;
        }, ar).then(() => pg.evaluate(MEDIR));

        // ---- A: a seta, expandida ----
        checar(exp.seta !== null, 'A1 · a seta existe e está à vista [' + tag + ']', exp.ids);
        if (exp.seta) {
          checar(Math.abs(exp.seta.w - exp.hit) <= 0.5 && Math.abs(exp.seta.h - exp.hit) <= 0.5,
            'A2 · e é QUADRADA com o lado de `--hit` (lido do estilo) [' + tag + ']',
            exp.seta.w.toFixed(1) + 'x' + exp.seta.h.toFixed(1) + ' contra --hit ' + exp.hit);
          checar(exp.ladoDoIcone && exp.ladoDoIcone.every((x) => Math.abs(x - 24) <= 0.5),
            'A3 · o ícone mede 24 px (a escala dos `.pv-fab`) [' + tag + ']', exp.ladoDoIcone);
          checar(!exp.fora.includes('pvRecolherBtn'),
            'A4 · e está DENTRO da prévia [' + tag + ']', exp.fora);
          if (modo === 'full') {
            checar(Math.abs(exp.cx) < 1,
              'A5 · no avançado ela é CENTRADA no topo [' + tag + ']', 'cx ' + exp.cx.toFixed(2));
          } else {
            // No Modo Fácil ela mora no canto superior esquerdo e o cast à
            // direita: a mesma posição recolhida ou não (quem toca duas vezes a
            // procuraria no mesmo lugar).
            checar(exp.esquerdaDaSeta >= 0 && exp.esquerdaDaSeta <= 4 && exp.cx < 0,
              'A5 · no Modo Fácil ela é o CANTO SUPERIOR ESQUERDO [' + tag + ']',
              'a ' + (exp.esquerdaDaSeta == null ? '?' : exp.esquerdaDaSeta.toFixed(1)) + 'px da borda, cx ' + exp.cx);
            checar(exp.cast && exp.cast.l > exp.seta.l,
              'A5b · e o cast fica à DIREITA dela [' + tag + ']', exp.ids);
          }
        }
        checar(exp.sobre.length === 0,
          'A6 · nenhum `.pv-fab` se sobrepõe a outro (expandida) [' + tag + ']', exp.sobre);

        // ---- B: recolhida ----
        await pg.evaluate(() => setEconomiaPreview(true));
        const rec = await pg.evaluate(MEDIR);
        checar(/\bpv-recolhida\b/.test(rec.cls),
          'B0 · PREMISSA: o toque na marcação põe `pv-recolhida` na prévia [' + tag + ']', rec.cls);
        checar(rec.P.h < exp.P.h - 20,
          'B1 · recolher ENCOLHE de fato a prévia [' + tag + ']',
          'expandida ' + exp.P.h.toFixed(1) + ', recolhida ' + rec.P.h.toFixed(1));
        checar(rec.diferentes.length === 0,
          'B2 · TODO botão visível mede `--hit` recolhida — nada é apertado para caber [' + tag + ']',
          rec.diferentes);
        checar(rec.fora.length === 0, 'B3 · e nenhum fica fora da prévia [' + tag + ']', rec.fora);
        checar(rec.sobre.length === 0, 'B4 · e nenhum se sobrepõe a outro [' + tag + ']', rec.sobre);
        checar(rec.folga !== null && rec.folga <= 2.5,
          'B5 · A FOLGA é de no máximo 2,5 px: a altura é a MENOR POSSÍVEL — a que sobra seria '
          + 'altura declarada ou piso, e uma asserção só de "cabe" passaria com qualquer uma [' + tag + ']',
          'folga ' + (rec.folga == null ? '?' : rec.folga.toFixed(1)) + 'px, altura ' + rec.P.h.toFixed(1));
        if (rec.seta && modo === 'full') {
          checar(Math.abs(rec.cx) < 1, 'B6 · a seta continua CENTRADA recolhida [' + tag + ']',
            'cx ' + rec.cx.toFixed(2));
        }

        // ---- H: com o giro à vista (o selo da camada mora na mesma linha) ----
        // O GIRO ENTRA NA LINHA ÚNICA OU, SE NÃO CABE, DESCE COM O SELO (v1.11.17): quem decide é o
        // `ResizeObserver` do `acertarExtrasDaPrevia`, que roda ANTES da pintura mas depois do
        // layout — duas rodadas de quadro bastam para o veredito assentar.
        await pg.evaluate(() => { mediaRot = 270; renderRotBtn(); });
        await pg.evaluate(() => new Promise((f) => requestAnimationFrame(() => requestAnimationFrame(f))));
        const gir = await pg.evaluate(MEDIR);
        checar(/pvGiroBtn/.test(gir.ids),
          'H0 · PREMISSA: o giro está à vista (`mediaRot` 270) [' + tag + ']', gir.ids);
        checar(gir.diferentes.length === 0 && gir.fora.length === 0 && gir.sobre.length === 0,
          'H1 · com o giro à vista: todo botão é `--hit`, dentro e SEM sobreposição [' + tag + ']',
          { diferentes: gir.diferentes, fora: gir.fora, sobre: gir.sobre });
        checar(gir.folga !== null && gir.folga <= 2.5,
          'H2 · e a altura segue a MENOR POSSÍVEL (folga <= 2,5 px) [' + tag + ']',
          'folga ' + (gir.folga == null ? '?' : gir.folga.toFixed(1)) + 'px, altura ' + gir.P.h.toFixed(1));
        const desceu = /\bpv-extras-baixo\b/.test(gir.cls);
        // H4 · O FALLBACK SÓ LIGA QUANDO A LINHA ÚNICA NÃO CABERIA: com a classe tirada na hora,
        // a mesma prévia tem de estourar (fora ou sobreposição). Sem esta asserção um
        // `pv-extras-baixo` sempre ligado passaria em tudo acima, e a linha única — o pedido —
        // nunca existiria.
        const forcada = await pg.evaluate(MEDIR, true);
        if (desceu) {
          checar(forcada.fora.length > 0 || forcada.sobre.length > 0,
            'H4 · o fallback só liga quando a linha única NÃO caberia: com a classe tirada na hora a prévia estoura '
            + '(fora ou sobreposição) [' + tag + ']', { fora: forcada.fora, sobre: forcada.sobre });
        } else {
          checar(forcada.fora.length === 0 && forcada.sobre.length === 0 && forcada.linhas === 1,
            'H4 · e, sem o fallback, a linha única é uma linha só e cabe inteira [' + tag + ']',
            { linhas: forcada.linhas, fora: forcada.fora, sobre: forcada.sobre });
        }
        if (modo === 'full' && largura === 320) {
          checar(desceu && gir.linhas === 2 && gir.P.h > rec.P.h + gir.hit - 2,
            'H3 · a 320 px o giro NÃO cabe ao lado da seta: a linha DESCE (`pv-extras-baixo`) e a prévia ganha a segunda [' + tag + ']',
            { desceu, linhas: gir.linhas, sem: rec.P.h.toFixed(1), com: gir.P.h.toFixed(1) });
        }
        if (modo === 'full' && largura === 430) {
          checar(!desceu && gir.linhas === 1 && Math.abs(gir.P.h - rec.P.h) <= 0.5,
            'H3b · a 430 px tudo cabe NUMA linha: selo, seta e giro lado a lado, e a prévia NÃO ganha altura nenhuma [' + tag + ']',
            { desceu, linhas: gir.linhas, sem: rec.P.h.toFixed(1), com: gir.P.h.toFixed(1) });
        }
        await pg.evaluate(() => { mediaRot = 0; renderRotBtn(); });
      }
    }
  }
  await pg.evaluate(() => { document.documentElement.style.removeProperty('--pv-ar'); });

  // =========================================================================
  // C · AS CAMADAS ESCONDEM E A DECODIFICAÇÃO SÓ PARA COM DESTINO
  // =========================================================================
  await pg.setViewportSize({ width: 430, height: 900 });
  await pg.evaluate(new Function('return (async () => { setAppMode("full");' + SEMEAR + 'await load(); })()'));
  await esperar(pg, () => appMode === 'full', null, 5000);
  await trocarTelas(pg, []);
  await pg.evaluate(() => setEconomiaPreview(false));
  await pg.evaluate(() => send('louvor-recolhida'));
  const tocou = await esperar(pg, () => {
    const v = document.getElementById('pvVideo');
    return !v.paused && v.currentTime > 0.15;
  }, null, 8000);
  checar(tocou === true, 'C0 · PREMISSA: a faixa está em cena e a prévia toca', porque(tocou));

  const camadas = () => pg.evaluate(() => {
    const ids = ['#pvImg', '#pvVideo', '#pvLyrics', '#pvText', '.pv-wall'];
    const o = {};
    for (const s of ids) {
      const e = document.querySelector('#preview ' + s);
      o[s] = e ? getComputedStyle(e).visibility : 'ausente';
    }
    const v = document.getElementById('pvVideo');
    return { vis: o, pausado: !!v.paused, vigor: !!economiaAtiva(), marcacao: !!economiaPreview,
      classe: document.getElementById('preview').classList.contains('pv-economia') };
  });
  const aberta = await camadas();
  checar(Object.values(aberta.vis).every((x) => x === 'visible'),
    'C1 · expandida, as cinco camadas estão visíveis (a linha de base)', aberta.vis);

  // SEM destino: a geometria obedece à marcação e o decodificador NÃO para —
  // sem tela, o `<video>` da prévia é a fonte do SOM.
  await pg.evaluate(() => setEconomiaPreview(true));
  const semTv = await camadas();
  checar(Object.values(semTv.vis).every((x) => x === 'hidden'),
    'C2 · recolhida, as cinco camadas ficam `visibility: hidden` — uma letra numa tira de 12 px '
    + 'não se lê', semTv.vis);
  checar(semTv.vigor === false && semTv.classe === false,
    'C3 · SEM TV a economia NÃO está em vigor: a recolhida é geometria, e a marcação sozinha '
    + 'não suspende nada', semTv);
  const seguiu = await esperar(pg, () => {
    const v = document.getElementById('pvVideo');
    window.__t0 = window.__t0 === undefined ? v.currentTime : window.__t0;
    return !v.paused && v.currentTime > window.__t0 + 0.3;
  }, null, 8000);
  checar(seguiu === true,
    'C4 · e o `<video>` da prévia SEGUE TOCANDO recolhida e sem TV — pausá-lo calaria o '
    + 'único som do aparelho', porque(seguiu));

  // COM destino: a marcação passa a valer na decodificação.
  await trocarTelas(pg, TV);
  const vigorou = await esperar(pg, () => economiaAtiva() === true, null, 5000);
  checar(vigorou === true, 'C5 · com a TV conectada a economia entra em vigor', porque(vigorou));
  const comTv = await camadas();
  checar(comTv.pausado === true && comTv.classe === true,
    'C6 · e o decodificador PARA (`setSuspenso`) — a única metade que devolve processamento',
    comTv);
  await trocarTelas(pg, []);
  const soltou = await esperar(pg, () => economiaAtiva() === false, null, 5000);
  const semTv2 = await camadas();
  checar(soltou === true && semTv2.vis['#pvVideo'] === 'hidden',
    'C7 · a TV saindo tira a economia de vigor mas a GEOMETRIA fica — a seta recolheu', semTv2);

  // =========================================================================
  // D · A CAIXA DE CONTROLES ACOMPANHA A ALTURA DA PRÉVIA
  // =========================================================================
  await trocarTelas(pg, TV);
  const lerCaixa = () => pg.evaluate(() => ({
    var: parseFloat(document.documentElement.style.getPropertyValue('--lib-caixa-h')),
    real: document.querySelector('.bottombar').offsetHeight,
  }));
  await pg.evaluate(() => setEconomiaPreview(false));
  await esperar(pg, () => {
    const b = document.querySelector('.bottombar').offsetHeight;
    return Math.round(b) === parseFloat(document.documentElement.style.getPropertyValue('--lib-caixa-h'));
  }, null, 5000);
  const caixaExp = await lerCaixa();
  await pg.evaluate(() => setEconomiaPreview(true));
  const acompanhou = await esperar(pg, () => {
    const b = document.querySelector('.bottombar').offsetHeight;
    return Math.round(b) === parseFloat(document.documentElement.style.getPropertyValue('--lib-caixa-h'));
  }, null, 5000);
  const caixaRec = await lerCaixa();
  checar(caixaRec.real < caixaExp.real - 30,
    'D1 · PREMISSA: recolher a prévia ENCOLHE a caixa de controles (a Biblioteca ganha a altura)',
    { expandida: caixaExp.real, recolhida: caixaRec.real });
  checar(acompanhou === true && caixaRec.var === Math.round(caixaRec.real),
    'D2 · `--lib-caixa-h` ACOMPANHA a altura da caixa depois de RECOLHER — de onde a janela da '
    + 'Biblioteca deduz o próprio topo', { ...caixaRec, prazo: porque(acompanhou) });
  await pg.evaluate(() => setEconomiaPreview(false));
  const voltouCaixa = await esperar(pg, (alvo) => {
    return parseFloat(document.documentElement.style.getPropertyValue('--lib-caixa-h')) === alvo;
  }, Math.round(caixaExp.real), 5000);
  const caixaDep = await lerCaixa();
  checar(voltouCaixa === true && caixaDep.var === Math.round(caixaDep.real),
    'D3 · e acompanha de volta ao EXPANDIR', { ...caixaDep, prazo: porque(voltouCaixa) });

  // =========================================================================
  // E · O CARTÃO DE ESPERA DEVOLVE A ALTURA E FICA INTEIRO
  // =========================================================================
  const lerCartao = () => pg.evaluate(() => {
    const pv = document.getElementById('preview');
    const P = pv.getBoundingClientRect();
    const card = document.querySelector('#pvBusy .pv-busy-card').getBoundingClientRect();
    const canc = document.getElementById('pvBusyCancel');
    const cb = canc.getBoundingClientRect();
    const visCancel = !canc.hidden && getComputedStyle(canc).display !== 'none' && cb.width > 0;
    const no = visCancel ? document.elementFromPoint(cb.left + cb.width / 2, cb.top + cb.height / 2) : null;
    return {
      h: P.height, recolhida: pv.classList.contains('pv-recolhida'),
      cartaoDentro: card.width > 0 && card.left >= P.left - 0.5 && card.right <= P.right + 0.5
        && card.top >= P.top - 0.5 && card.bottom <= P.bottom + 0.5,
      cartao: { t: card.top - P.top, b: P.bottom - card.bottom, h: card.height },
      cancelVisivel: visCancel,
      cancelAlcancavel: !!(no && (no === canc || canc.contains(no))),
      cancelDentro: visCancel && cb.left >= P.left - 0.5 && cb.right <= P.right + 0.5
        && cb.top >= P.top - 0.5 && cb.bottom <= P.bottom + 0.5,
    };
  });
  await pg.evaluate(() => setEconomiaPreview(true));
  const tira = await lerCartao();
  checar(tira.recolhida === true,
    'E0 · PREMISSA: a prévia está recolhida antes do cartão', tira);
  // O cartão de VERDADE, pela API do app (`previewBusy`): ele acende depois de
  // 180 ms e carrega o botão de cancelar do dono dele.
  await pg.evaluate(() => { window.__busy = previewBusy('Baixando vídeo', 'LOUVOR LONGO DEMAIS PARA CABER NUMA TIRA', () => {}); });
  // ASSENTADO: o `.pv-busy` entra por uma transição de opacidade/visibilidade, e
  // no primeiro quadro depois da classe ele ainda está `visibility: hidden` — o
  // toque, e o `elementFromPoint`, atravessam. O fato é a opacidade chegar a 1.
  const acendeu = await esperar(pg, () => {
    const b = document.getElementById('pvBusy');
    return b.classList.contains('on') && getComputedStyle(b).opacity === '1';
  }, null, 5000);
  checar(acendeu === true, 'E1 · PREMISSA: o cartão de espera acende', porque(acendeu));
  const comCartao = await lerCartao();
  const naturalAgora = await pg.evaluate(() => {
    const pv = document.getElementById('preview');
    const antes = pv.className;
    pv.classList.remove('pv-recolhida');
    const h = pv.getBoundingClientRect().height;
    pv.className = antes;
    return h;
  });
  checar(Math.abs(comCartao.h - naturalAgora) <= 1,
    'E2 · COM O CARTÃO NO AR a prévia volta à altura NATURAL (a de expandida, medida tirando a '
    + 'classe): ele mede 43 a 58 px e numa tira de 38 seria cortado pelo `overflow`',
    { comCartao: comCartao.h, natural: naturalAgora });
  checar(comCartao.cartaoDentro === true,
    'E3 · e o cartão fica INTEIRO dentro da prévia', comCartao);
  checar(comCartao.cancelVisivel && comCartao.cancelDentro && comCartao.cancelAlcancavel,
    'E4 · e o botão de CANCELAR — a única porta de parar um download — está à vista, dentro e '
    + 'ALCANÇÁVEL (`elementFromPoint` acha o botão, não um `.pv-fab`)', comCartao);
  // A SETA SAI DA FRENTE DO CARTÃO no avançado: ela é um quarto controle no
  // centro do topo, e o cartão centrado a cobria (MEDIDO a 360 px, 3 a 26 px).
  // A asserção é o FATO — `visibility` e `pointer-events`, que tiram a seta da
  // vista e do toque — e a ausência de interseção entre o que se VÊ e o cartão.
  const setaComCartao = await pg.evaluate(() => {
    const seta = document.getElementById('pvRecolherBtn');
    const cs = getComputedStyle(seta.closest('.pv-fabs'));
    const S = seta.getBoundingClientRect();
    const C = document.querySelector('#pvBusy .pv-busy-card').getBoundingClientRect();
    const cruza = S.left < C.right && S.right > C.left && S.top < C.bottom && S.bottom > C.top;
    return { visibility: cs.visibility, pe: cs.pointerEvents, cruza };
  });
  checar(setaComCartao.visibility === 'hidden' && setaComCartao.pe === 'none',
    'E4b · COM O CARTÃO NO AR a seta sai da frente dele (avançado): `visibility: hidden` e fora do '
    + 'toque — ela cobria o texto do download em 3 a 26 px, conforme a proporção da TV', setaComCartao);
  // O CARTÃO SAI NO ATO: a grade é desfeita no instante em que o `.on` cai, e com
  // o fade de 200 ms o cartão (52 px) ainda aparecia cortado numa tira de 38 px.
  // A leitura é feita DENTRO da mutação da classe — um `esperar` que a leia depois
  // mede o quadro seguinte, e o fade já teria andado.
  const saida = await pg.evaluate(() => new Promise((resolve) => {
    const b = document.getElementById('pvBusy');
    const pv = document.getElementById('preview');
    const mo = new MutationObserver(() => {
      if (b.classList.contains('on')) return;
      mo.disconnect();
      resolve({
        opacidade: parseFloat(getComputedStyle(b).opacity),
        recolhida: pv.classList.contains('pv-recolhida'),
        h: pv.getBoundingClientRect().height,
      });
    });
    mo.observe(b, { attributes: true, attributeFilter: ['class'] });
    window.__busy.soltar();
  }));
  checar(saida.recolhida === true && saida.opacidade < 0.05,
    'E4c · e quando o cartão SAI com a prévia recolhida ele some NO ATO (opacidade ~0 na própria '
    + 'mutação da classe): com o fade de 200 ms ele aparecia espremido numa tira de 38 px',
    saida);
  const saiu = await esperar(pg, () => !document.getElementById('pvBusy').classList.contains('on'), null, 5000);
  const depoisDoCartao = await lerCartao();
  checar(saiu === true && depoisDoCartao.recolhida && depoisDoCartao.h < comCartao.h - 20,
    'E5 · e o cartão saindo RECOLHE a prévia de novo, sem toque algum', { ...depoisDoCartao, prazo: porque(saiu) });

  // A FALHA também é um cartão, e é o ÚNICO canal do "não deu" no ato do toque.
  await pg.evaluate(() => { window.__busy = previewBusy('Baixando vídeo', 'LOUVOR', () => {}); window.__busy.falhar('Sem internet para baixar este vídeo agora.'); });
  const falhou = await esperar(pg, () => {
    const b = document.getElementById('pvBusy');
    return b.classList.contains('falhou') && getComputedStyle(b).opacity === '1';
  }, null, 5000);
  const cartaoFalha = await lerCartao();
  checar(falhou === true && cartaoFalha.cartaoDentro === true && Math.abs(cartaoFalha.h - naturalAgora) <= 1,
    'E6 · o cartão de FALHA também devolve a altura e cabe inteiro: sem isso o motivo do "não deu" '
    + 'não é lido por ninguém', { ...cartaoFalha, prazo: porque(falhou) });
  await esperar(pg, () => !document.getElementById('pvBusy').classList.contains('on'), null, 12000);

  // NO MODO FÁCIL o cartão mora no `#simpleBusySlot` (v1.11.11): não há prévia
  // para devolver altura, e o que importa é que ele caiba e o cancelar alcance.
  await pg.evaluate(() => setAppMode('simple'));
  await esperar(pg, () => appMode === 'simple', null, 5000);
  await pg.evaluate(() => { window.__busy = previewBusy('Baixando vídeo', 'LOUVOR LONGO DEMAIS PARA CABER NUMA TIRA', () => {}); });
  const acendeuFacil = await esperar(pg, () => {
    const b = document.getElementById('pvBusy');
    return b.classList.contains('on') && getComputedStyle(b).opacity === '1';
  }, null, 5000);
  const cartaoFacil = await pg.evaluate(() => {
    const slot = document.getElementById('simpleBusySlot');
    const S = slot.getBoundingClientRect();
    const k = document.querySelector('#pvBusy .pv-busy-card').getBoundingClientRect();
    const b = document.getElementById('pvBusyCancel').getBoundingClientRect();
    const topo = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return {
      moraNoSlot: document.getElementById('pvBusy').parentElement === slot,
      dentro: k.left >= S.left - 0.5 && k.right <= S.right + 0.5 && k.top >= S.top - 0.5 && k.bottom <= S.bottom + 0.5,
      cancelaAlcanca: !!(topo && topo.closest('#pvBusyCancel')),
    };
  });
  checar(acendeuFacil === true && cartaoFacil.moraNoSlot && cartaoFacil.dentro && cartaoFacil.cancelaAlcanca,
    'E7 · no MODO FÁCIL o cartão mora no `#simpleBusySlot`, cabe inteiro e o cancelar é alcançável',
    { ...cartaoFacil, prazo: porque(acendeuFacil) });
  await pg.evaluate(() => { window.__busy.soltar(); });
  await esperar(pg, () => !document.getElementById('pvBusy').classList.contains('on'), null, 5000);
  await pg.evaluate(() => setAppMode('full'));
  await esperar(pg, () => appMode === 'full', null, 5000);

  // =========================================================================
  // F · TELA CHEIA COM A MARCAÇÃO LIGADA: A PRÉVIA É A PROJEÇÃO
  // =========================================================================
  await trocarTelas(pg, []);
  await pg.evaluate(() => setEconomiaPreview(true));
  const marcacaoAntes = await pg.evaluate(() => !!economiaPreview);
  // O gesto é um CLIQUE de verdade (`requestFullscreen` exige ativação), e a
  // PREMISSA é uma asserção própria: sem ela um runner que recuse a tela cheia
  // mediria o estado de antes e passaria calado.
  await pg.click('#pvFullBtn');
  const entrou = await esperar(pg, () => document.fullscreenElement === document.getElementById('preview'), null, 5000);
  checar(entrou === true, 'F0 · PREMISSA: a prévia entra em tela cheia de verdade neste runner', porque(entrou));
  if (entrou === true) {
    // O estado ASSENTADO: `fullscreenElement` é escrito antes do
    // `fullscreenchange`, e o tamanho só vale depois do reflow.
    const cheiaOk = await esperar(pg, () => {
      const b = document.getElementById('preview').getBoundingClientRect();
      return Math.abs(b.width - window.innerWidth) <= 1 && Math.abs(b.height - window.innerHeight) <= 1;
    }, null, 5000);
    const cheia = await pg.evaluate(() => {
      const pv = document.getElementById('preview');
      const b = pv.getBoundingClientRect();
      const v = document.getElementById('pvVideo');
      return {
        w: b.width, h: b.height, iw: window.innerWidth, ih: window.innerHeight,
        marcacao: !!economiaPreview,
        recolhidaClasse: pv.classList.contains('pv-recolhida'),
        video: getComputedStyle(v).visibility,
        fabs: [...pv.querySelectorAll('.pv-fabs')].map((g) => getComputedStyle(g).display),
        wall: getComputedStyle(pv.querySelector('.pv-wall')).visibility,
      };
    });
    checar(cheiaOk === true,
      'F1 · em tela cheia a prévia OCUPA a viewport inteira — não a tira de 38 px', { ...cheia, prazo: porque(cheiaOk) });
    checar(cheia.marcacao === true && cheia.recolhidaClasse === true,
      'F2 · a MARCAÇÃO atravessa (a classe segue ligada; quem a cala é o CSS, sem o atraso de um '
      + 'quadro do `fullscreenchange`)', cheia);
    checar(cheia.video === 'visible' && cheia.wall === 'visible',
      'F3 · o `<video>` e o wallpaper ficam VISÍVEIS: sem TV é isto que a congregação vê, e uma '
      + 'regra recolhida sem escopo a deixaria em BRANCO, sem erro algum', cheia);
    checar(cheia.fabs.every((d) => d === 'none'),
      'F4 · e os grupos de botões saem de cena (iriam junto para o telão)', cheia.fabs);

    await pg.evaluate(() => { if (document.exitFullscreen) document.exitFullscreen(); });
    const saiuCheia = await esperar(pg, () => !document.fullscreenElement, null, 5000);
    const depois = await pg.evaluate(() => {
      const pv = document.getElementById('preview');
      return { h: pv.getBoundingClientRect().height, marcacao: !!economiaPreview,
        classe: pv.classList.contains('pv-recolhida') };
    });
    checar(saiuCheia === true && depois.classe === true && depois.marcacao === marcacaoAntes
      && depois.h < 100,
      'F5 · sair da tela cheia VOLTA recolhida, sem alternar a marcação (`economiaPreview` igual '
      + 'ao de antes)', { ...depois, antes: marcacaoAntes, prazo: porque(saiuCheia) });
  }

  // =========================================================================
  // G · A RECARGA MANTÉM, ATRÁS DA CORTINA
  // =========================================================================
  // O MESMO CONTEXTO: o IndexedDB é por origin, e um contexto novo abriria um
  // banco vazio. O app abre sempre no Modo Fácil — a classe nasce nos dois.
  await trocarTelas(pg, TV);
  await pg.evaluate(() => setEconomiaPreview(true));
  await esperarDb(pg, async () => (await AVDB.getState('economiaPreview')) === true, null, 5000);
  await pg.reload({ waitUntil: 'load' });
  await pg.waitForFunction(() => window.__NATIVE__ === true && window.AVDB, null, { timeout: 30000 });
  // O INSTANTE EM QUE O `init()` TERMINA (o `pronto()` que levanta a cortina):
  // a classe tem de estar lá NESTE instante, e não depois — senão a prévia
  // nasceria expandida e encolheria na frente do operador.
  const pronto = await esperar(pg, () => window.__avPronto === true, null, 30000);
  const naCarga = await pg.evaluate(() => ({
    classe: document.getElementById('preview').classList.contains('pv-recolhida'),
    marcacao: !!economiaPreview,
    cortina: !!document.getElementById('splash'),
    seta: document.getElementById('pvRecolherBtn').getAttribute('aria-expanded'),
  }));
  checar(pronto === true && naCarga.classe === true && naCarga.marcacao === true,
    'G1 · depois da RECARGA a prévia já nasce recolhida no instante em que a cortina levanta — a '
    + 'marcação vem do BANCO e a geometria é aplicada antes de o operador ver o app',
    { ...naCarga, prazo: porque(pronto) });
  checar(naCarga.seta === 'false',
    'G2 · e a seta diz `aria-expanded="false"` na carga (o desenho segue a marcação)', naCarga);
  await esperarCortina(pg);
  await pg.evaluate(() => setEconomiaPreview(false));

  checar(erros.length === 0, 'Z · nenhum erro de página em todo o percurso', erros.join(' | '));
  await ctx.close();
} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) {
  console.error('\nFALHOU:\n' + falhas.map((f) => ' - ' + f).join('\n'));
  process.exit(1);
}
console.log('\nTodos passaram.');
