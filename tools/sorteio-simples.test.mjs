#!/usr/bin/env node
// ============================================================================
// O SORTEIO DO MODO FÁCIL (v1.12.53)
//
// Pedido do operador: *"Adicionar o botão de sorteio no modo simples, mas bem
// simplificado, no caso ele vai sortear apenas músicas do hinário 2022, sem
// infantis e sem opções, apenas tocar o botão de sorteio escolhe uma música dessa
// categoria, sempre cantada."*
//
// O que este arquivo trava, e cada uma falha CALADA:
//  A. o botão existe SÓ no Modo Fácil, no quadrado da esquerda da barra (onde o
//     avançado tem a playlist automática, que continua escondida aqui);
//  B. sem o Hinário 2022 carregado ele fica APAGADO com o motivo no `title`;
//  C. sem nenhum hino baixado e SEM INTERNET, apagado com o motivo — nunca inerte;
//  D. o toque sorteia SÓ do Hinário 2022, NUNCA um infantil (508–557, as duas
//     pontas incluídas), NUNCA uma faixa sem a cantada, e passa pelo MESMO
//     caminho de uma escolha da Biblioteca (`simplePlaySong`), com a escolha em voo
//     marcada para a coreografia (`simpleSel`);
//  E. o sorteio é UNIFORME com rede: não fica preso no que já está baixado;
//  F. sem rede, só o que está no aparelho.
//
//   node tools/sorteio-simples.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperarCortina, checar, falhas } from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port + '/controle/index.html';
const navegador = await abrirNavegador();
const erros = [];
try {
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 860 }, hasTouch: true });
  await semRedeExterna(ctx);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await pg.goto(base, { waitUntil: 'load' });
  await esperarCortina(pg);

  // A REDE É DO ORÁCULO: `navigator.onLine` é lido pelo app a cada pergunta.
  const rede = (on) => pg.evaluate((v) => {
    Object.defineProperty(navigator, 'onLine', { value: v, configurable: true });
  }, on);
  await rede(true);
  // O SERVIDOR DA LOUVORJA é do ORÁCULO também: sem rede externa o veredito real
  // sairia "sem internet" sozinho. `fonteBloqueada` é a pergunta que o app faz.
  await pg.evaluate(() => { window.__fonteFora = false; window.fonteBloqueada = () => window.__fonteFora; });

  // ── A · SÓ NO MODO FÁCIL, NO QUADRADO DA ESQUERDA ────────────────────────
  const lugar = () => pg.evaluate(() => {
    const b = document.getElementById('sorteioSimplesBtn');
    const campo = document.querySelector('#libBar .lib-search-campo');
    return {
      modo: appMode,
      visivel: getComputedStyle(b).display !== 'none',
      avancadoVisivel: getComputedStyle(document.getElementById('sorteioBtn')).display !== 'none',
      aEsquerda: b.getBoundingClientRect().right <= campo.getBoundingClientRect().left + 0.5,
      naBarra: b.parentElement && b.parentElement.id === 'libBar',
    };
  });
  const simples = await lugar();
  checar(simples.modo === 'simple' && simples.visivel && !simples.avancadoVisivel && simples.aEsquerda && simples.naBarra,
    'A · no Modo Fácil o sorteio simples está na barra, à esquerda do campo — e a playlist '
    + 'automática do avançado continua escondida', JSON.stringify(simples));
  await pg.evaluate(() => setAppMode('full'));
  const avancado = await lugar();
  checar(!avancado.visivel && avancado.avancadoVisivel,
    'A · e no avançado ele NÃO existe — lá a porta é a playlist automática', JSON.stringify(avancado));
  await pg.evaluate(() => setAppMode('simple'));

  // ── B · SEM O HINÁRIO CARREGADO, APAGADO ─────────────────────────────────
  const estado = () => pg.evaluate(() => {
    renderSorteioSimples();
    const b = document.getElementById('sorteioSimplesBtn');
    return { desligado: b.disabled, title: b.title };
  });
  await pg.evaluate(() => { collState['hymnal-2022'] = { songs: [] }; });
  const semIndice = await estado();
  checar(semIndice.desligado && /ainda não foi carregado/.test(semIndice.title),
    'B · sem o Hinário 2022 carregado o botão fica APAGADO, com o motivo no `title`', JSON.stringify(semIndice));

  // O ACERVO: a faixa infantil inteira (508–557) cercada pelos vizinhos, uma
  // faixa sem a cantada e um hino do de 1996 de mesmo número. Nenhuma baixada.
  await pg.evaluate(() => {
    const hino = (n, extra) => Object.assign({ id_music: 'n' + n, track: n, name: 'Hino ' + n,
      duration: '3:00', has_instrumental_music: false, fileIdFull: null, fileIdPlayback: null }, extra || {});
    const songs = [hino(506), hino(507)];
    for (let n = 508; n <= 557; n++) songs.push(hino(n));
    songs.push(hino(558), hino(559), hino(600, { semAudio: true }));
    collState['hymnal-2022'] = { songs };
    collState['hymnal-1996'] = { songs: [hino(10, { id_music: 'v10' })] };
  });

  // ── C · NADA BAIXADO E SEM INTERNET: APAGADO ─────────────────────────────
  await rede(false);
  const offline = await estado();
  checar(offline.desligado && /sem internet/.test(offline.title),
    'C · sem hino baixado e SEM INTERNET o botão fica APAGADO e diz por quê — nunca aceso e inerte',
    JSON.stringify(offline));
  await rede(true);
  await pg.evaluate(() => { window.__fonteFora = true; });
  const fonteFora = await estado();
  checar(fonteFora.desligado && fonteFora.title.length > 0,
    'C · com internet mas o SERVIDOR da biblioteca fora, também apagado e com o motivo', JSON.stringify(fonteFora));
  await pg.evaluate(() => { window.__fonteFora = false; });
  const online = await estado();
  checar(!online.desligado,
    'C · e com internet ele acende: o hino sorteado é baixado como numa escolha da Biblioteca', JSON.stringify(online));

  // ── D · O TOQUE: SÓ HINÁRIO 2022, NUNCA INFANTIL, NUNCA SEM A CANTADA ────
  // `simplePlaySong` é ESPIADO — o caminho de download e projeção tem oráculos
  // próprios; aqui o que se afirma é QUAL hino ele recebe, e que a escolha passa
  // por ele. A espia segura a promessa para a coreografia poder ser lida em voo.
  const sorteios = await pg.evaluate(async () => {
    const vistos = [];
    let soltar = null;
    window.simplePlaySong = (coll, s) => {
      vistos.push(coll.id + ':' + s.track);
      return new Promise((ok) => { soltar = ok; });
    };
    document.getElementById('sorteioSimplesBtn').click();
    const emVoo = { voando: simpleSel.emVoo, marcada: !!simpleSel.em, chave: simpleSel.chave };
    soltar();
    await new Promise((r) => setTimeout(r, 0));
    for (let i = 0; i < 400; i++) { sortearSimples(); soltar(); }
    return { vistos, emVoo };
  });
  const nums = sorteios.vistos.map((v) => Number(v.split(':')[1]));
  checar(sorteios.vistos.length === 401 && sorteios.vistos.every((v) => v.startsWith('hymnal-2022:')),
    'D · o TOQUE sorteia e toca pelo caminho da Biblioteca (`simplePlaySong`), sempre do Hinário 2022',
    sorteios.vistos.slice(0, 5));
  checar(!nums.some((n) => n >= 508 && n <= 557),
    'D · NENHUM infantil (508–557) em 401 sorteios — as duas pontas incluídas',
    [...new Set(nums)].sort((a, b) => a - b));
  checar(!nums.includes(600),
    'D · nem a faixa SEM a cantada na origem — o sorteio simples é sempre cantado', [...new Set(nums)]);
  checar(sorteios.emVoo.voando && sorteios.emVoo.marcada && /^sorteio:/.test(sorteios.emVoo.chave),
    'D · e a escolha fica MARCADA em voo, como a de uma linha tocada — é o que segura a '
    + 'Biblioteca até a mídia entrar', JSON.stringify(sorteios.emVoo));

  // ── E · UNIFORME COM REDE ────────────────────────────────────────────────
  // Com UM hino baixado, a preferência absoluta da folha sortearia sempre ele.
  const uniforme = await pg.evaluate(() => {
    collState['hymnal-2022'].songs.find((s) => s.track === 506).fileIdFull = 'f-506';
    const vistos = [];
    window.simplePlaySong = (coll, s) => { vistos.push(s.track); return Promise.resolve(); };
    for (let i = 0; i < 300; i++) sortearSimples();
    return [...new Set(vistos)].sort((a, b) => a - b);
  });
  checar(uniforme.length === 4 && uniforme.includes(506) && uniforme.includes(559),
    'E · com rede o sorteio é UNIFORME entre os hinos que podem tocar — um hino baixado não '
    + 'vira o único que sai', JSON.stringify(uniforme));

  // ── F · SEM REDE, SÓ O QUE ESTÁ NO APARELHO ──────────────────────────────
  await rede(false);
  const semRede = await pg.evaluate(() => {
    renderSorteioSimples();
    const vistos = [];
    window.simplePlaySong = (coll, s) => { vistos.push(s.track); return Promise.resolve(); };
    for (let i = 0; i < 100; i++) sortearSimples();
    return { ligado: !document.getElementById('sorteioSimplesBtn').disabled, vistos: [...new Set(vistos)] };
  });
  checar(semRede.ligado && JSON.stringify(semRede.vistos) === '[506]',
    'F · sem rede, com um hino baixado, o botão fica aceso e sorteia SÓ o que está no aparelho',
    JSON.stringify(semRede));
  await rede(true);

  checar(erros.length === 0, 'nenhum erro de página', erros.slice(0, 3));
} finally {
  await navegador.close();
  await new Promise((r) => servidor.close(r));
}

console.log('\n' + (falhas.length ? falhas.length + ' FALHA(S)' : 'tudo certo'));
process.exit(falhas.length ? 1 : 0);
