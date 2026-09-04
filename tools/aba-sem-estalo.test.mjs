// O ESTALO AO NAVEGAR ENTRE AS ABAS — a rampa que corria sem transição (v1.4.17)
//
// ## O relato
//
// *"verifique uma interferência na saída de áudio quando eu navego na interface
// do app. o áudio demonstra um ruído no exato momento em que eu interajo com as
// abas do cronograma e bíblia, quando navego entre elas."* Registro do campo:
// sem TV conectada — isto é, **a preview É a projeção e o som sai do aparelho**.
//
// ## O defeito, e por que ele não tem sintoma nenhum além do som
//
// `stage.setMute(m)` é uma função de DECLARAR estado. Quem a chama no Controle
// é o `load()`, que reaplica a cena inteira — e o `load()` roda a cada troca de
// aba, a cada redesenho da lista, a cada importação. Ela, porém, se comportava
// como uma função de ANIMAR a mudança: o ramo de desmutar começava com
// `rampVolume(0, volume, …)`, que **zera o volume** antes de subir.
//
// Com o som já ligado — a reafirmação, que é o caso normal — o que sobrava era
// um par no elemento:
//
//     volume 1 → 0
//     volume 0 → 1     (o `setVolume` da linha seguinte cancela a rampa)
//
// Em JS o par é atômico e nada se ouve. No aparelho não é: cada escrita
// atravessa o renderer até o `AudioRendererImpl`, e o retorno de chamada do
// áudio roda a cada ~10 ms. Caindo entre as duas, ele rende UM buffer em
// silêncio — o estalo. E a janela se abre justamente na troca de aba, que é
// quando a thread principal está mais ocupada (a lista nova, o fantasma e as
// duas animações do carrossel).
//
// **É por isso que este oráculo mede as ESCRITAS e não o som.** O artefato é
// uma corrida com a thread de áudio: um teste do desfecho audível seria
// intermitente por construção, e um teste do estado final passa nas duas
// versões (o volume termina em 1 de qualquer jeito). O que é determinístico —
// e o que de fato causa o estalo — é o degrau ter sido escrito.
//
// ## As TRÊS metades
//
//  1. **reafirmar não escreve degrau**: navegar entre as abas com um louvor no
//     ar não pode produzir escrita de volume diferente do alvo;
//  2. **a rampa parte de onde o volume está**: desmutar NO MEIO da rampa de
//     mutar não pode passar por zero — é o mesmo degrau por outra porta, e é o
//     toque duplo no botão de mudo, que é o que se faz ao mutar por engano;
//  3. **a transição continua rampando**: mutar desce em degraus e só então
//     marca `muted`; desmutar sobe em degraus. Sem esta metade, apagar o corpo
//     inteiro do `setMute` passaria nas duas primeiras — e o "pop" que a rampa
//     existe para evitar voltaria em cada toque no botão de mudo.
//
// **As metades 1 e 2 saem de correções que se cobrem:** cada uma sozinha já
// apaga o degrau da troca de aba, então uma reversão parcial passa na metade 1.
// A prova de que este arquivo pega o defeito RELATADO é contra o `stage.js`
// inteiro da versão anterior — e ali ele reprova, com o par `1 → 0 → 1` em cada
// uma das quatro trocas e no `load()` avulso.
//
//   node tools/aba-sem-estalo.test.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, checar, falhas } from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);

// A ESPIÃ. Ela envolve os setters do `HTMLMediaElement` ANTES de o app carregar
// e registra TODA escrita, inclusive as que não mudam nada — é a diferença
// entre elas que carrega a prova, e uma espiã que só visse as mudanças não
// distinguiria "não escreveu" de "escreveu o mesmo valor".
const ESPIA = `
  window.__ev = [];
  const P = HTMLMediaElement.prototype;
  for (const nome of ['volume', 'muted']) {
    const d = Object.getOwnPropertyDescriptor(P, nome);
    Object.defineProperty(P, nome, {
      configurable: true, enumerable: d.enumerable,
      get() { return d.get.call(this); },
      set(v) {
        const antes = d.get.call(this);
        d.set.call(this, v);
        window.__ev.push({ o: nome, de: antes, para: v, mudou: antes !== v });
      },
    });
  }
`;

// Um WAV de 30 s: a asserção compara o `currentTime` em vários instantes, e uma
// faixa que acabasse no meio responderia "parado" por ter TERMINADO.
const SEMEAR = `
  const sr = 8000, secs = 30, n = sr * secs;
  const buf = new ArrayBuffer(44 + n * 2), dv = new DataView(buf);
  const wr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  wr(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); wr(8, 'WAVEfmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true);
  dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  wr(36, 'data'); dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, Math.sin(i / 20) * 3000, true);
  const a = await AVDB.addMedia(new Blob([buf], { type: 'audio/wav' }),
    { name: 'Louvor de fundo', type: 'audio/wav', kind: 'audio', list: 'imports' });
`;

await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
// `--autoplay-policy` porque o app roda num WebView com
// `mediaPlaybackRequiresUserGesture = false`: sem a bandeira o que se mediria
// seria a política do navegador de teste.
const navegador = await abrirNavegador({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);

const erros = [];
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY/;

try {
  const pg = await ctx.newPage();
  pg.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (EXTERNO.test(t) || /Failed to load resource/.test(t)) return;
    erros.push(t);
  });
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await pg.addInitScript(ESPIA);
  await pg.goto(base + '/controle/', { waitUntil: 'load' });
  await pg.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function', null, { timeout: 20000 });

  const ids = await pg.evaluate(new Function('return (async () => {'
    + 'setAppMode("full");' + SEMEAR + 'await load(); return { audio: a.id }; })()'));

  const estado = () => pg.evaluate(() => {
    const v = document.querySelector('#preview video') || document.querySelector('video');
    return { tocando: !!v && !v.paused, tempo: v ? +v.currentTime.toFixed(2) : null,
      vol: v ? v.volume : null, mudo: v ? v.muted : null };
  });
  const zerar = () => pg.evaluate(() => { window.__ev.length = 0; });
  const colher = () => pg.evaluate(() => window.__ev.slice());

  await pg.evaluate((id) => send(id), ids.audio);
  await pg.waitForTimeout(1500);
  const inicio = await estado();
  checar(inicio.tocando && inicio.tempo > 0 && inicio.vol === 1 && !inicio.mudo,
    'o louvor está tocando na preview, com som (ponto de partida)', inicio);

  // ======================================================================
  // METADE 1 — NAVEGAR ENTRE AS ABAS NÃO ESCREVE DEGRAU DE VOLUME
  // ======================================================================
  //
  // A ida E a volta, porque são dois `load()` diferentes (listas diferentes) e
  // o defeito estava no caminho comum: um só mediria metade da navegação.
  // (A NAVEGAÇÃO ENTRE ABAS SAIU na v1.5.0: o Cronograma é a tela única e a
  //  Bíblia virou uma FOLHA. O caminho que este caso mede continua o mesmo — o
  //  `load()` que reaplica o mudo —, e quem o dispara agora é abrir e fechar a
  //  folha, que é a navegação que sobrou.)
  const passos = [];
  for (const onde of ['bible', 'imports', 'bible', 'imports']) {
    await zerar();
    await pg.evaluate((t) => { if (t === 'bible') abrirBiblia(); else fecharBiblia(); }, onde);
    await pg.waitForTimeout(700);
    passos.push({ aba: onde, ev: await colher(), estado: await estado() });
  }

  // O DEGRAU é uma escrita de `volume` para um valor DIFERENTE do alvo com a
  // mídia tocando e sem mudo. Escrever o mesmo valor é inofensivo (o Chromium
  // devolve cedo), e é por isso que a asserção não é "não escreveu nada".
  const degraus = passos.flatMap((p) => p.ev
    .filter((e) => e.o === 'volume' && e.mudou)
    .map((e) => ({ aba: p.aba, de: e.de, para: e.para })));
  checar(degraus.length === 0,
    '[relato] navegar entre as abas com um louvor no ar NÃO mexe no volume do '
    + '<video> — nenhum degrau, nenhum estalo', degraus);

  const mudos = passos.flatMap((p) => p.ev.filter((e) => e.o === 'muted' && e.mudou));
  checar(mudos.length === 0,
    'e não muta nem desmuta o elemento no caminho', mudos);

  checar(passos.every((p) => p.estado.tocando && !p.estado.mudo && p.estado.vol === 1),
    'e o som continua ligado, no volume cheio, depois de cada troca',
    passos.map((p) => p.estado));
  const andou = passos[passos.length - 1].estado.tempo - inicio.tempo;
  checar(andou > 1,
    'e o louvor ANDOU o tempo todo — "não pausou" é fraco, "andou" prova que é o mesmo áudio',
    { de: inicio.tempo, ate: passos[passos.length - 1].estado.tempo });

  // O `load()` DIRETO é a forma geral do defeito: a troca de aba é só o
  // caminho pelo qual o operador o encontrou. Um redesenho da lista (uma
  // importação que termina, um favorito marcado) chama o mesmo `load()`.
  await zerar();
  await pg.evaluate(() => load());
  await pg.waitForTimeout(400);
  const evLoad = (await colher()).filter((e) => e.mudou);
  checar(evLoad.length === 0,
    'e um `load()` avulso — o redesenho da lista — também não mexe no áudio',
    evLoad);

  // ======================================================================
  // METADE 2 — DE ONDE A RAMPA PARTE
  // ======================================================================
  //
  // A guarda acima cobre a REAFIRMAÇÃO. Esta metade cobre a outra escrita de
  // zero que havia no mesmo ramo: `rampVolume(0, …)` partia SEMPRE do silêncio,
  // e saindo do mudo isso é certo (não há o que preservar). Desmutando NO MEIO
  // da rampa de mutar, não: o volume está a meio caminho, e partir de zero é o
  // mesmo degrau por outra porta — o toque duplo no botão de mudo, que é
  // exatamente o que se faz quando se muta por engano.
  //
  // Ela tem asserção PRÓPRIA porque as duas correções se cobrem: cada uma
  // sozinha já apaga o degrau da troca de aba, então reverter só uma passa na
  // metade 1. Quem for podar uma delas tem de ver esta reprovar.
  //
  // O CENÁRIO É MONTADO, e não cronometrado. A alternativa era mutar e
  // desmutar 110 ms depois, no meio dos 250 ms da rampa — um prazo contra a
  // cadência do app, que sob carga vira outra coisa (passada a rampa o
  // elemento está MUDO, `de` vale 0 com toda a razão, e a asserção passaria
  // vazia). O estado do meio é conhecido e MEDIDO: a rampa de mutar escreve
  // 0.8 · 0.6 · 0.4 · 0.2 · 0 e só então marca `muted`. Reproduzi-lo é
  // escrever 0.6 no elemento com ele ainda desmutado.
  const meio = await pg.evaluate(() => {
    const v = document.querySelector('#preview video') || document.querySelector('video');
    v.muted = false; v.volume = 0.6;
    window.__ev.length = 0;
    preview.setMute(false);
    return window.__ev.slice();
  });
  await pg.waitForTimeout(500);
  const passosMeio = meio.filter((e) => e.o === 'volume' && e.mudou);
  const quedas = passosMeio.filter((e) => e.para < e.de);
  checar(quedas.length === 0,
    'desmutando do MEIO da rampa, a subida NÃO passa por zero — ela parte de onde '
    + 'o volume está', { quedas, escritas: meio });
  const voltou = await estado();
  checar(!voltou.mudo && voltou.vol === 1 && voltou.tocando,
    'e o volume chega inteiro no alvo, com a faixa correndo', voltou);

  // ======================================================================
  // METADE 3 — A TRANSIÇÃO DE VERDADE CONTINUA RAMPANDO
  // ======================================================================
  //
  // Sem ela, esvaziar o `setMute` passaria na metade 1 — e o corte no talo que
  // a rampa existe para evitar voltaria em cada toque no botão de mudo.
  await zerar();
  await pg.evaluate(() => toggleMute());
  await pg.waitForTimeout(700);
  const aoMutar = await colher();
  const descidas = aoMutar.filter((e) => e.o === 'volume' && e.mudou).map((e) => e.para);
  const mudouParaMudo = aoMutar.some((e) => e.o === 'muted' && e.mudou && e.para === true);
  checar(descidas.length >= 3 && descidas[descidas.length - 1] === 0,
    'MUTAR desce o volume em degraus até zero — a rampa que evita o "pop"', descidas);
  checar(mudouParaMudo, 'e só então marca o elemento como mudo', aoMutar);
  const depoisDeMutar = await estado();
  checar(depoisDeMutar.mudo && depoisDeMutar.tocando,
    'o elemento fica mudo e a faixa continua correndo', depoisDeMutar);

  await zerar();
  await pg.evaluate(() => toggleMute());
  await pg.waitForTimeout(700);
  const aoDesmutar = await colher();
  const subidas = aoDesmutar.filter((e) => e.o === 'volume' && e.mudou).map((e) => e.para);
  checar(aoDesmutar.some((e) => e.o === 'muted' && e.mudou && e.para === false),
    'DESMUTAR tira o mudo primeiro — com `muted` de pé, volume nenhum é ouvido', aoDesmutar);
  checar(subidas.length >= 3 && subidas[subidas.length - 1] === 1,
    'e sobe o volume em degraus até o alvo', subidas);
  const fim = await estado();
  checar(!fim.mudo && fim.vol === 1 && fim.tocando,
    'e a cena termina como começou: com som, no volume cheio, tocando', fim);

  checar(erros.length === 0,
    'nenhum erro de console no percurso' + (erros.length ? ':\n        ' + erros.join('\n        ') : ''));
} catch (e) {
  checar(false, 'o percurso terminou sem exceção (' + (e && e.message) + ')');
} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) { console.log('\n' + falhas.length + ' FALHA(S)'); process.exit(1); }
console.log('\nTodos passaram.');
