#!/usr/bin/env node
// ============================================================================
// O SOM NÃO VAZA PARA O CELULAR QUANDO A PROJEÇÃO SE PERDE
//
// ## O defeito que ele trava
//
// Relato do operador (v1.8.50): *"Ao pausar ou interromper uma transmissão ou
// espelhamento, pause a mídia se ela estiver apenas no smartphone, para não
// vazar áudio diretamente no smartphone sem a vontade do usuário. Aconteceu de
// estar tocando uma música no telão, e eu desconectei a tela, e a mídia seguiu
// tocando no smartphone, vazando conteúdo que não era intenção de sair o som
// nele"*.
//
// O app cumpria a regra escrita — *"sem tela nenhuma conectada, o som sai DESTE
// aparelho"* —, e era a REGRA que estava errada numa borda: ela vale para quem
// ABRE o app sem tela, e não para quem PERDE a tela com o louvor no ar. O
// estado final é o mesmo nos dois casos; a INTENÇÃO não é.
//
// ## Por que ele mede TRÊS coisas, e nenhuma basta sozinha
//
//  1. **A PERDA PAUSA.** É o relato: TV no ar, louvor tocando, tela removida —
//     e a mídia para em vez de continuar na caixa do celular.
//  2. **A OSCILAÇÃO NÃO PAUSA.** É a REGRESSÃO que a correção introduz se a
//     régua for `algumaTelaConectada()`: essa pergunta lê a `Presentation`, que
//     cai sozinha a cada piscada do Miracast com a TV ainda listada — e a
//     escada de retomada do shell a devolve em 0,4 s a 8 s. Sem esta metade, a
//     correção troca um vazamento de segundos por uma interrupção do culto.
//  3. **QUEM NUNCA CONECTOU NADA NÃO É PAUSADO.** É a régua escrita como ESTADO
//     ("não há tela e há mídia tocando") em vez de como PERDA. Ela passaria na
//     primeira metade e mataria o caso de uso do "Tocar neste celular": ensaiar
//     o louvor antes do culto, sem tela nenhuma.
//
// O cenário é `appMode: 'full'` — no Modo Fácil a saída de som depende também
// do `tocarNoCelular`, e a pergunta aqui é sobre a PERDA, não sobre a escolha.
//
//   node tools/som-nao-vaza-ao-perder-a-tela.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperarCortina, esperar, porque, checar, falhas } from './arnes.mjs';

// A ponte de mentira com a LISTA DE TELAS MUTÁVEL — a mesma do
// `telao-no-chao.test.mjs`: `__avDisplaysChanged` reconsulta a ponte, então
// basta trocar o que ela responde para a TV entrar, o telão cair e a tela sair.
const PONTE = `(() => {
  window.__telas = [];
  window.__espelho = { ligado: false, telas: [] };
  const B = {
    shellVersion: () => 72,
    role: () => 'controle',
    appVersion: () => '1.99-teste',
    takeShare: () => '',
    busPost: () => {},
    otaConfirm: () => {},
    displays: (id) => {
      setTimeout(() => { try { window.__avResolve(id, window.__telas); } catch (_) {} }, 0);
    },
    // O SHELL DE VERDADE SEMPRE RESPONDE UM OBJETO aqui, e o genérico do
    // preenchimento abaixo resolveria null — que o app lê como "NÃO SEI" e não
    // como "não há transmissão" (ver haDestinoDeProjecao). Com null o cenário
    // mediria o desvio de desconhecido, e não a perda.
    espelhoEstado: (id) => {
      setTimeout(() => {
        try { window.__avResolve(id, window.__espelho); } catch (_) {}
      }, 0);
    },
  };
  const nomes = ['apkInstalar','apkProcurar','bgProgress','captureVolumeKeys','projecaoLocal','castTarget',
    'cifraDiag','cifraHtml','deckDiscard','deckExportUrl','deckPages','espelhoCertApagar',
    'espelhoCertEstado','espelhoCertImportar','espelhoDesligar','espelhoDiag','espelhoEstado',
    'espelhoLigar','espelhoLigarEm','espelhoDerrubar','farolEstado','keepAlive',
    'listFolder','micDiag','nowPlaying','openCast','openExternal','otaApply','otaCheck','otaDiag',
    'otaPending','pickDoc','pickFolder','requestMic','salvarTexto','systemVolume','temaClaro','ytCancel',
    'ytCanalPlaylists','ytDiag','ytDiscard','ytFetch','ytFetchAte','ytFetchAudio','ytPlaylist',
    'ytSearch','ytStream','areaTransferencia','atualizacaoEstado','compartilharTexto',
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

// Uma faixa LONGA de propósito (30 s): o cenário liga, desliga e religa a TV
// antes de medir a perda, e uma faixa que acabasse no meio disso pararia
// sozinha — a asserção 4 passaria pelo motivo errado, que é a tautologia que
// este projeto já pagou uma vez (ver `preview-volta-ao-wallpaper`).
//
// `kind: 'video'` com bytes de WAV: é o *kind* que decide a cena, e um `audio`
// sem letra deixaria a preview no wallpaper — sem `<video>` a que perguntar.
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
  const id = 'louvor-longo';
  const caminho = 'folders/teste/' + id + '.wav';
  await AVDB.opfsWriteFile(caminho, wav(30));
  await AVDB.fileAdd({
    id, folder: 'teste', opfsPath: caminho, srcName: id,
    name: 'LOUVOR LONGO', type: 'audio/wav', kind: 'video', size: 1, mtime: 1,
    thumb: null, blob: null, url: null, addedAt: 1, lyrics: null,
  });
  await AVDB.listAdd('imports', id);
`;

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);

await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);
const pg = await ctx.newPage();

// Troca a lista de telas e ESPERA a ingestão — nunca um prazo fixo. Quem
// responde "já chegou?" é o próprio app (`lastDisplays`/`telaoNoAr`), e não uma
// segunda leitura da regra dentro do oráculo.
const trocarTelas = async (telas) => {
  await pg.evaluate((t) => { window.__telas = t; window.__avDisplaysChanged(); }, telas);
  await pg.waitForFunction(
    (t) => Array.isArray(lastDisplays) && lastDisplays.length === t.n && !!telaoNoAr() === t.ar,
    { n: telas.length, ar: telas.some((d) => d.telao) }, { timeout: 5000 },
  );
};

// O QUE O OPERADOR OUVE, e não o que a regra pensa: `pvVideo.paused` é o
// desfecho. `somLocal` vem junto porque é ele que transforma "tocando" em
// "tocando NA CAIXA DESTE APARELHO" — é o par que descreve o vazamento.
const ler = () => pg.evaluate(() => {
  const v = document.getElementById('pvVideo');
  return {
    pausado: !!v.paused,
    tempo: +(v.currentTime || 0).toFixed(2),
    somLocal: somLocalDeveEstar(),
    mudo: !!v.muted,
    playing: !!playing,
  };
});

try {
  await pg.addInitScript(PONTE);
  await pg.goto(base + '/controle/', { waitUntil: 'load' });
  await pg.waitForFunction(
    () => window.__NATIVE__ === true && window.AVDB && typeof window.__avBack === 'function',
    null, { timeout: 30000 },
  );
  await esperarCortina(pg);
  await pg.evaluate(new Function('return (async () => { setAppMode("full");' + SEMEAR + 'await load(); })()'));

  // ── 0. O LOUVOR NO AR, SEM TELA ─────────────────────────────────────────
  await pg.evaluate(() => send('louvor-longo'));
  const tocou = await esperar(pg, () => {
    const v = document.getElementById('pvVideo');
    return !v.paused && v.currentTime > 0.15;
  }, null, 8000);
  checar(tocou === true, 'a faixa entra em cena e toca', porque(tocou));

  const semTela = await ler();
  checar(semTela.pausado === false && semTela.somLocal === true,
    'SEM TELA a projeção é a preview e o som é DESTE aparelho — a linha de base',
    semTela);

  // ── 1. QUEM NUNCA CONECTOU NADA NÃO É PAUSADO ───────────────────────────
  // A régua escrita como ESTADO ("não há tela e há mídia tocando") passaria na
  // asserção 4 e mataria isto: o ensaio do louvor antes do culto, que é o caso
  // de uso do "Tocar neste celular".
  await pg.evaluate(() => { acertarSaidaDeAudio(); acertarSaidaDeAudio(); });
  const ensaio = await ler();
  checar(ensaio.pausado === false,
    'e reavaliar a saída de áudio SEM PERDA NENHUMA não pausa nada: a régua é a '
    + 'PERDA de um destino, não a ausência dele', ensaio);

  // ── 2. A TV ENTRA: este aparelho cala, a preview vira ilustração ─────────
  await trocarTelas([{ id: 7, name: 'TV do templo', w: 1920, h: 1080, density: 320, telao: true }]);
  const comTv = await ler();
  checar(comTv.somLocal === false && comTv.pausado === false,
    'A TV ENTRANDO cala este aparelho e a mídia CONTINUA — é o telão que toca, e a '
    + 'preview segue como ilustração muda', comTv);

  // ── 3. A OSCILAÇÃO DO DONGLE NÃO PAUSA ──────────────────────────────────
  // A `Presentation` cai sozinha e a TELA CONTINUA LISTADA. A escada de retomada
  // do shell a devolve em 0,4 s a 8 s; pausar aqui trocaria um vazamento de
  // segundos por uma interrupção do culto a cada piscada do Miracast.
  await trocarTelas([{ id: 7, name: 'TV do templo', w: 1920, h: 1080, density: 320, telao: false }]);
  const piscou = await ler();
  checar(piscou.somLocal === true && piscou.pausado === false,
    'O TELÃO CAINDO com a TELA AINDA LISTADA devolve o som a este aparelho e NÃO '
    + 'pausa: é um intervalo, não uma perda — a régua é o DESTINO '
    + '(`haDestinoDeProjecao`), não a projeção (`algumaTelaConectada`)', piscou);

  // O telão volta, como a escada de retomada faz — e o cenário volta a ser o do
  // relato: o louvor no telão, com este aparelho mudo.
  await trocarTelas([{ id: 7, name: 'TV do templo', w: 1920, h: 1080, density: 320, telao: true }]);
  const voltou = await ler();
  checar(voltou.somLocal === false && voltou.pausado === false,
    'e o telão voltando retoma o regime de antes, sem o operador tocar em nada',
    voltou);

  // ── 4. A PERDA PAUSA — o relato ─────────────────────────────────────────
  await trocarTelas([]);
  const perdeu = await esperar(pg, () => document.getElementById('pvVideo').paused === true, null, 5000);
  const fim = await ler();
  checar(perdeu === true && fim.pausado === true,
    'A TELA DESCONECTADA COM O LOUVOR NO AR PAUSA A MÍDIA — sem isso ela seguiria '
    + 'tocando na caixa deste aparelho, que é o vazamento do relato',
    { perdeu: porque(perdeu), fim });
  checar(fim.somLocal === true,
    'e o som JÁ ESTÁ deste aparelho quando isso acontece: é por isso que a pausa '
    + 'não pode depender do mudo ter mudado', fim);

  // ── 5. UMA LEITURA FALHADA NÃO É UMA PERDA ──────────────────────────────
  //
  // `lerEspelho` guarda `mirrorEstado = null` quando a chamada da ponte falha ou
  // vence o prazo — e lido como "não há sessão", esse `null` inventa uma perda
  // de destino. O preço é o pior deste lote: pausar o louvor no meio do culto,
  // na configuração em que este app mais roda (sem TV, com as telas da rede
  // sendo a projeção). A defesa é guardar a ÚLTIMA contagem que a ponte de fato
  // respondeu.
  await pg.evaluate(() => {
    window.__espelho = { ligado: true, telas: [{ rotulo: 'Tela do salão', pronta: true }] };
  });
  await esperar(pg, async () => {
    await window.lerEspelho();
    return somLocalDeveEstar() === false;
  }, null, 8000);
  // A faixa volta ao ar sob a tela da rede, como num culto sem TV.
  await pg.evaluate(() => send('louvor-longo'));
  const comRede = await esperar(pg, () => !document.getElementById('pvVideo').paused, null, 8000);
  checar(comRede === true, 'a transmissão entra e o louvor volta ao ar', porque(comRede));
  // AGORA A PONTE FALHA: `espelhoEstado` resolve `null`, exatamente como um
  // prazo vencido, e o `lerEspelho` guarda `mirrorEstado = null`.
  const apesarDaFalha = await pg.evaluate(async () => {
    window.__espelho = null;
    await window.lerEspelho();
    await window.lerEspelho();
    const v = document.getElementById('pvVideo');
    return { mirror: mirrorEstado, pausado: !!v.paused };
  });
  checar(apesarDaFalha.mirror === null && apesarDaFalha.pausado === false,
    'UMA LEITURA FALHADA DA PONTE NÃO PAUSA NADA: `mirrorEstado` volta a `null` '
    + 'e a última contagem conhecida segura o destino — lê-lo como "não há '
    + 'sessão" inventaria uma perda e interromperia o culto', apesarDaFalha);

  // ── 6. A LINHA DO TEMPO ─────────────────────────────────────────────────
  // O Registro é o artefato que responde A DISTÂNCIA. Uma mídia que pausa
  // sozinha, sem linha, chega ao operador como "o app parou o louvor no culto".
  const linhas = await pg.evaluate(() => diarioC.map((l) => l.ev).join('\n'));
  checar(/proje[çc][ãa]o PERDIDA com m[íi]dia no ar/.test(linhas),
    'e a linha do tempo DIZ que foi o app quem pausou, e por quê', linhas.slice(-400));
} finally {
  await navegador.close();
  await new Promise((r) => servidor.close(r));
}

console.log(falhas.length ? '\n' + falhas.length + ' falha(s)' : '\ntudo certo');
process.exit(falhas.length ? 1 : 0);
