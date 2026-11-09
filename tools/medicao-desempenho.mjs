#!/usr/bin/env node
// ===== A MEDIÇÃO DA REVISÃO X3 — QUANTO CUSTA O QUE O APP FAZ EM CULTO =====
//
// **Isto NÃO é oráculo.** Não afirma comportamento, não reprova nada e por
// isso NÃO entra no `tools/*.test.mjs` nem na suíte de todo push: ele roda no
// `verificar` só quando a mensagem do commit carrega o marcador `[medicao]`
// (ver `.github/workflows/apk.yml`), e o que sai dele é uma LISTA DE NÚMEROS
// para a etapa seguinte escolher onde vale mexer.
//
// ## Por que ele existe
//
// O plano (`docs/REVISAO-PROFUNDA.md`, X3) pede quatro medidas, com uma régua
// só: *tempo de abertura*, *heap depois de uma hora de `display-status` a
// 4 Hz*, *quantos `getComputedStyle` por render* e *o custo da busca da
// Biblioteca com o acervo cheio*. Nenhuma delas é percebida como defeito até
// virar lentidão no aparelho de quem opera — e nesse dia já é tarde para
// descobrir qual das quatro foi.
//
// ## O que é medido, e o que a medida NÃO é
//
// - **Abertura**: cinco cargas FRIAS, cada uma num contexto novo (IndexedDB e
//   OPFS vazios), até `__avPronto` — a última linha do `init()` que muda o que
//   se vê (o gancho do `arnes.mjs`). O piso de 1,8 s da cortina NÃO entra: ele
//   é aplicado depois, pelo `pronto()` do `index.html`, e o que se mede aqui é
//   o `init()` terminando. O TETO de 12 s também é lido: se o app estourar, o
//   `motivo` é reportado e a carga não vira número de abertura.
// - **Heap sob status**: uma mídia em cena (`send`) e um `display-status` de
//   verdade a 4 Hz, entregue pelo MESMO `BroadcastChannel` que o telão usa —
//   de um iframe, porque um canal NÃO entrega a mensagem para o contexto que a
//   postou. O heap é lido com o GC forçado nas duas pontas (`--expose-gc`): o
//   que cresce entre eles é RETIDO; o pico sem GC é reportado ao lado, e é
//   alocação, não vazamento.
// - **`getComputedStyle`**: um contador embrulha o global antes do primeiro
//   script do app. Dá o custo por abertura, por pulsação de status e por
//   desenho da busca — a leitura de estilo força recálculo, e é o tipo de
//   trabalho que aparece só quando o acervo cresce.
// - **Busca com o acervo cheio**: 100 e 800 faixas na MESMA página, três
//   medidas de cada, e a DIFERENÇA entre as duas dá o custo por faixa (o teto
//   de 60 linhas do desenho não esconde o filtro, que varre o acervo inteiro).
//
// ## O que os números NÃO valem
//
// É um Chromium headless de runner (4 vCPU), não o WebView do aparelho. Serve
// para ORDENAR ganhos e para provar tendência (cresce com N? cresce por hora?),
// não para prometer milissegundo no culto. A hora do heap é EXTRAPOLADA de
// 3 minutos de pulsação e isso vem escrito no relatório — o pedido do plano é
// "uma hora", e o CI não fica uma hora só para medir.
//
//   node tools/medicao-desempenho.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperarCortina, esperar, VIEWPORT } from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');

// O TAMANHO DO PULO: 3 min a 4 Hz são 720 `display-status`, e é dessa janela
// que sai a extrapolação por hora. Encurtar aqui encurta a evidência.
const PULSO_MS = 180000;
const PULSO_INTERVALO_MS = 250;
const AMOSTRA_MS = 15000;

const registros = [];
const linha = (texto) => { registros.push(texto); console.log(texto); };

// ===== O INSTRUMENTO, DENTRO DA PÁGINA =====
//
// Roda como `addInitScript`, ANTES do `<script>` do app: é a única posição em
// que dá para datar o `__avPronto` (o gancho do arnês escreve a propriedade) e
// para embrulhar o `getComputedStyle` sem perder as chamadas da abertura.
function INSTRUMENTO() {
  window.__t0 = performance.now();
  window.__tPronto = null;
  let pronto = false;
  try {
    Object.defineProperty(window, '__avPronto', {
      configurable: true,
      get() { return pronto; },
      set(v) { pronto = v; if (v && window.__tPronto === null) window.__tPronto = performance.now(); },
    });
  } catch (_) { /* sem o gancho, a abertura é lida pelo relógio da navegação */ }
  window.__gcs = 0;
  try {
    const original = window.getComputedStyle.bind(window);
    window.getComputedStyle = function (...args) { window.__gcs++; return original(...args); };
  } catch (_) { /* não deve acontecer; se acontecer, o contador fica em zero */ }
  window.__longas = [];
  try {
    new PerformanceObserver((lista) => {
      for (const e of lista.getEntries()) window.__longas.push(e.duration);
    }).observe({ type: 'longtask', buffered: true });
  } catch (_) { /* sem longtask o relatório diz zero — e zero aqui é ausência de dado */ }
}

// O PULSO. A mídia, o relógio e o canal nascem DENTRO do iframe: um
// `BroadcastChannel` não entrega ao contexto que postou, e postar do lado do
// Node perderia o caminho de recepção que se quer medir.
function PULSO() {
  window.__pulsar = (mediaId, durSegundos, totalMs, intervaloMs) => {
    const f = document.createElement('iframe');
    f.style.display = 'none';
    document.body.appendChild(f);
    const w = f.contentWindow;
    const canal = new w.BroadcastChannel('av-iasd');
    const t0 = w.performance.now();
    return new w.Promise((fim) => {
      const timer = w.setInterval(() => {
        const decorrido = w.performance.now() - t0;
        const t = decorrido / 1000;
        canal.postMessage({
          type: 'display-status', mediaId, playing: true,
          currentTime: t % durSegundos, duration: durSegundos,
        });
        if (decorrido >= totalMs) { w.clearInterval(timer); fim(true); }
      }, intervaloMs);
    });
  };
}

const mediana = (ns) => {
  const s = [...ns].sort((a, b) => a - b);
  if (!s.length) return null;
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const arred = (n, casas = 0) => (n === null || n === undefined ? null : +n.toFixed(casas));

const servidor = servirEstatico(RAIZ);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador({
  args: [
    '--enable-precise-memory-info',
    '--js-flags=--expose-gc',
    '--autoplay-policy=no-user-gesture-required',
  ],
});

const abrirContexto = async () => {
  const ctx = await navegador.newContext({ viewport: VIEWPORT, hasTouch: true });
  await semRedeExterna(ctx);
  await ctx.addInitScript(INSTRUMENTO);
  await ctx.addInitScript(PULSO);
  return ctx;
};

const subirApp = async (pg) => {
  await pg.goto(base + '/controle/', { waitUntil: 'load' });
  const de_pe = await esperar(pg, () => window.AVDB && typeof window.__avBack === 'function', null, 30000);
  if (de_pe !== true) return de_pe;
  return esperarCortina(pg);
};

// ===== A · ABERTURA =====
async function medirAbertura() {
  const cargas = [];
  for (let i = 0; i < 5; i++) {
    const ctx = await abrirContexto();
    const pg = await ctx.newPage();
    const erros = [];
    pg.on('pageerror', (e) => erros.push(e.message));
    await pg.goto(base + '/controle/', { waitUntil: 'load' });
    await esperar(pg, () => window.__avPronto === true || window.__tPronto !== null, null, 30000);
    const m = await pg.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] || {};
      const fcp = performance.getEntriesByName('first-contentful-paint')[0] || {};
      return {
        pronto: window.__tPronto,
        dcl: nav.domContentLoadedEventEnd || null,
        carga: nav.loadEventEnd || null,
        fcp: fcp.startTime || null,
        gcs: window.__gcs,
        longas: window.__longas.length,
        longasMs: window.__longas.reduce((a, b) => a + b, 0),
      };
    });
    // O ERRO DE PÁGINA É LIDO AQUI, no lado do Node: dentro do `evaluate` não
    // existe variável do Node, e a leitura de lá derrubava a medida inteira.
    m.erro = erros[0] || null;
    cargas.push(m);
    await ctx.close();
  }
  const validas = cargas.filter((c) => c.pronto !== null && !c.erro);
  linha('MEDICAO abertura: ' + JSON.stringify(cargas));
  linha('MEDICAO abertura mediana: pronta=' + arred(mediana(validas.map((c) => c.pronto)))
    + 'ms fcp=' + arred(mediana(validas.map((c) => c.fcp)))
    + 'ms carga=' + arred(mediana(validas.map((c) => c.carga))) + 'ms'
    + ' | getComputedStyle=' + mediana(validas.map((c) => c.gcs))
    + ' | longas=' + mediana(validas.map((c) => c.longas))
    + ' (' + arred(mediana(validas.map((c) => c.longasMs))) + 'ms)'
    + ' | validas=' + validas.length + '/' + cargas.length);
}

// ===== B · HEAP SOB STATUS A 4 Hz (e C, por carona) =====
async function medirStatus() {
  const ctx = await abrirContexto();
  const pg = await ctx.newPage();
  const erros = [];
  pg.on('pageerror', (e) => erros.push(e.message));
  const subiu = await subirApp(pg);
  if (subiu !== true) { linha('MEDICAO status: NÃO SUBIU (' + subiu + ')'); await ctx.close(); return; }

  const semente = await pg.evaluate(async () => {
    // WAV de gelatina: o `<video>`/`<audio>` da preview toca e reporta
    // `duration` sem precisar de decodificador de verdade (a mesma fixtura dos
    // oráculos de cena), e um arquivo de 300 s cobre a janela toda (180 s) sem acabar.
    const wav = (secs) => {
      const sr = 8000, n = sr * secs;
      const buf = new ArrayBuffer(44 + n * 2), dv = new DataView(buf);
      const wr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
      wr(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); wr(8, 'WAVEfmt ');
      dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
      dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true);
      dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
      wr(36, 'data'); dv.setUint32(40, n * 2, true);
      return new Blob([buf], { type: 'audio/wav' });
    };
    const id = 'medicao-faixa';
    await AVDB.opfsWriteFile('folders/medicao/faixa.wav', wav(300));
    await AVDB.fileAdd({ id, folder: 'medicao', opfsPath: 'folders/medicao/faixa.wav',
      srcName: 'faixa', name: 'FAIXA DA MEDIÇÃO', type: 'audio/wav', kind: 'video',
      size: 1, mtime: 1, thumb: null, blob: null, url: null, addedAt: 1, lyrics: null });
    await AVDB.listAdd('imports', id);
    await load();
    await send(id);
    return { id, atual: currentId, noAr: midiaNoAr };
  });
  // O `send` põe a preview tocando; a espera é pelo FATO de ela ter duração.
  const tocando = await esperar(pg, () => {
    const v = document.getElementById('pvVideo');
    return !!v && v.duration > 0;
  }, null, 15000);
  linha('MEDICAO status: semente=' + JSON.stringify(semente) + ' tocando=' + tocando);
  if (!semente || !semente.noAr) { linha('MEDICAO status: a mídia não entrou no ar — sem pulso'); await ctx.close(); return; }

  // Aquecimento: o primeiro punhado de mensagens paga JIT e aloca o laço.
  await pg.evaluate(async (id) => {
    await window.__pulsar(id, 300, 8000, 250);
  }, semente.id);

  const ler = () => pg.evaluate(() => {
    if (typeof window.gc === 'function') window.gc();
    const m = performance.memory || {};
    return { heap: m.usedJSHeapSize || null, total: m.totalJSHeapSize || null,
      gcs: window.__gcs, longas: window.__longas.length,
      longasMs: window.__longas.reduce((a, b) => a + b, 0) };
  });

  const inicio = await ler();
  const gcsAntes = inicio.gcs;
  const amostras = [];
  const promessa = pg.evaluate((id) => window.__pulsar(id, 300, 180000, 250), semente.id);
  const fim = Date.now() + PULSO_MS - 5000;
  while (Date.now() < fim) {
    await new Promise((r) => setTimeout(r, AMOSTRA_MS));
    amostras.push(await pg.evaluate(() => (performance.memory || {}).usedJSHeapSize || null));
  }
  await promessa;
  const final = await ler();
  const delta = (final.heap && inicio.heap) ? final.heap - inicio.heap : null;
  const pico = Math.max(...amostras.filter((n) => typeof n === 'number'), 0);
  linha('MEDICAO status: msgs=720 intervalo=250ms janela=' + (PULSO_MS / 1000) + 's'
    + ' heapInicio=' + inicio.heap + ' heapFim=' + final.heap + ' deltaRetido=' + delta
    + ' picoSemGC=' + pico
    + ' | por_hora_extrapolado=' + (delta === null ? null : delta * (3600 / (PULSO_MS / 1000)))
    + ' | gcsPorStatus=' + arred((final.gcs - gcsAntes) / 720, 2)
    + ' | longasDelta=' + (final.longas - inicio.longas)
    + ' (' + arred(final.longasMs - inicio.longasMs) + 'ms)'
    + ' | amostras=' + JSON.stringify(amostras.map((n) => (n ? Math.round(n / 1024) : null))));
  if (erros.length) linha('MEDICAO status: erros de página=' + JSON.stringify(erros.slice(0, 3)));
  await ctx.close();
}

// ===== D · BUSCA COM O ACERVO CHEIO =====
async function medirBusca() {
  const ctx = await abrirContexto();
  const pg = await ctx.newPage();
  const subiu = await subirApp(pg);
  if (subiu !== true) { linha('MEDICAO busca: NÃO SUBIU (' + subiu + ')'); await ctx.close(); return; }
  // ABRE UMA VEZ, e depois espera o fato: a chamada dentro do predicado do
  // `esperar` reabriria a folha a cada 100 ms que ela levasse para assentar.
  await pg.evaluate(() => openHymnSearch(false));
  const abriu = await esperar(pg,
    () => document.getElementById('hymnSearchPopup').classList.contains('open'), null, 20000);
  linha('MEDICAO busca: a Biblioteca abriu=' + abriu);
  if (abriu !== true) { await ctx.close(); return; }

  const r = await pg.evaluate(() => {
    const medir = (fn) => {
      const t = [];
      for (let i = 0; i < 5; i++) { const a = performance.now(); fn(); t.push(performance.now() - a); }
      return t;
    };
    const semear = (n) => {
      const songs = [];
      for (let i = 1; i <= n; i++) {
        songs.push({ id_music: 'h' + i, track: i, name: 'Hino ' + i + ' — Louvor e Adoração',
          duration: '3:' + String(i % 60).padStart(2, '0'), fileIdFull: 'h2022-' + i });
      }
      collState['hymnal-2022'] = { indexSyncedAt: Date.now(), isHymnal: true, songs };
    };
    const campo = document.getElementById('hymnSearchInput');
    const gcs = () => window.__gcs;
    const uma = (n, termo) => {
      semear(n);
      campo.value = termo;
      const antes = gcs();
      const tempos = medir(() => renderSearchResults(termo));
      return { n, termo, tempos, gcs: (gcs() - antes) / tempos.length,
        linhas: document.querySelectorAll('#hymnResults li').length };
    };
    return {
      cem: uma(100, 'hino'),
      oitocentas: uma(800, 'hino'),
      // A busca VAZIA desenha o acervo inteiro (é o modo "navegar"), e é o
      // pior caso de abertura da Biblioteca.
      vaziaOitocentas: uma(800, ''),
      mil: uma(1000, 'hino'),
    };
  });
  const c = r.cem, o = r.oitocentas, v = r.vaziaOitocentas, m = r.mil;
  const med = (x) => mediana(x.tempos);
  linha('MEDICAO busca: 100=' + arred(med(c), 1) + 'ms 800=' + arred(med(o), 1)
    + 'ms 1000=' + arred(med(m), 1)
    + 'ms | por_faixa=' + arred(((med(o) - med(c)) / 700), 3)
    + 'ms | vazia800=' + arred(med(v), 1)
    + 'ms | gcs/desenho=' + arred(o.gcs, 1)
    + ' | linhas=' + o.linhas);
  await ctx.close();
}

// UMA MEDIDA QUE FALHA NÃO CALA AS OUTRAS: o relatório sai parcial e diz qual
// bloco morreu — silêncio aqui viraria "não há o que medir", que é falso.
for (const [nome, fn] of [['abertura', medirAbertura], ['status', medirStatus], ['busca', medirBusca]]) {
  try {
    await fn();
  } catch (e) {
    linha('MEDICAO ' + nome + ' ERRO: '
      + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e));
  }
}
await navegador.close().catch(() => {});
servidor.close();
linha('MEDICAO FIM (' + registros.length + ' linhas)');
