#!/usr/bin/env node
// ============================================================================
// O STREAM QUE NÃO TEM IMAGEM — o aviso e a rampa que faltavam (v1.4.19)
//
// ## O defeito
//
// `semVisual()` é verdadeiro para um `kind: 'audio'` sem letra — que é
// exatamente o que o **"Tocar agora · Só áudio"** de um link do YouTube produz.
// E com ele verdadeiro o `load` não entrava em NENHUM dos dois ramos que
// acendem o aviso de espera e disparam a rampa de entrada de um stream: o da
// cortina pede `!semVisual()`, e `entrada` também.
//
// A rampa comum, mais acima no mesmo arquivo, exclui streams pelo `!ehStream` —
// de propósito, porque ela foi MOVIDA para dentro daqueles dois ramos quando a
// transmissão direta ganhou o aro de espera. O áudio ficou fora dos dois.
//
// O desfecho eram os dois defeitos que os lotes v1.4.6 e v1.4.8 corrigiram para
// o vídeo, ainda de pé para o áudio: a tela não dizia mais nada por vários
// segundos (a rede inteira entre o comando e o primeiro byte), e então o som
// entrava **no talo**.
//
// ## As três metades
//
//  1. **ANUNCIA.** Sem isto o operador toca e nada muda na tela — a diferença
//     entre "está carregando" e "o app travou" não existe.
//  2. **ENTRA COM RAMPA.** A prova é a ESCRITA de um volume abaixo do alvo
//     antes de o alvo ser escrito: um teste do valor FINAL passa nas duas
//     versões, porque nos dois casos o volume termina em 1.
//  3. **O ARQUIVO LOCAL sem imagem continua como era.** Ele nunca esteve
//     quebrado (a rampa comum o cobre), e a correção não pode tê-lo levado a
//     um segundo caminho — dois donos para a mesma rampa é o defeito que a
//     v1.4.17 pagou por outro ângulo.
//
//   node tools/stream-so-audio.test.mjs
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { abrirNavegador, checar, falhas } from './arnes.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(AQUI, '..', 'app', 'src', 'main', 'assets', 'web');
const STAGE = fs.readFileSync(path.join(WEB, 'shared', 'stage.js'), 'utf8');

// A espiã dos setters, do `aba-sem-estalo`: toda escrita de volume, inclusive
// as que não mudam nada. É a SEQUÊNCIA que carrega a prova de uma rampa.
const ESPIA = `
  window.__vol = [];
  const P = HTMLMediaElement.prototype;
  const d = Object.getOwnPropertyDescriptor(P, 'volume');
  Object.defineProperty(P, 'volume', {
    configurable: true, enumerable: d.enumerable,
    get() { return d.get.call(this); },
    set(v) { d.set.call(this, v); window.__vol.push(Math.round(v * 1000) / 1000); },
  });
`;

// PRAZO NÃO É VEREDITO (a regra do `ota.test.mjs`). Um `waitForFunction` que
// estoura e sobe como TimeoutError faz o log falar do relógio quando o que
// falhou foi o app — e ao contrário, sob carga, faz o log culpar o app por um
// runner ocupado. Aqui o estouro vira uma frase e a asserção segue sendo do
// FATO.
async function esperar(pg, fn, msg, ms = 20000) {
  try {
    await pg.waitForFunction(fn, null, { timeout: ms });
    return true;
  } catch (_) {
    console.log('FALHOU  ' + msg + '\n        (o fato não aconteceu em '
      + (ms / 1000) + ' s — PRAZO, não veredito)');
    falhas.push(msg);
    return false;
  }
}

const navegador = await abrirNavegador();
const ctx = await navegador.newContext();
await semRedeExterna(ctx);
await ctx.addInitScript(ESPIA);
const pg = await ctx.newPage();

try {
  await pg.setContent(`<!doctype html><meta charset="utf-8">
    <div id="w"></div><img id="i" hidden><video id="v" playsinline hidden></video>
    <script>${STAGE}</script>`);

  await pg.evaluate(() => {
    window.AVStream = {
      suportado: () => true,
      criar: () => ({ destruir() {} }),
      ultimoErro: '',
      fome: { quantas: 0, segundos: 0 },
    };
    window.AVDB = {
      getMedia: async (id) => ({
        // O SÓ-ÁUDIO TRANSMITIDO: `kind:'audio'`, sem `lyrics` — é o registro
        // que o `tentarTransmitir` grava para um "Tocar agora · Só áudio".
        st: { id: 'st', kind: 'audio', name: 'Louvor transmitido', stream: { audio: {} } },
        // O mesmo kind, mas ARQUIVO: a metade que não podia regredir.
        arq: { id: 'arq', kind: 'audio', name: 'Louvor baixado', url: 'data:audio/mp4,' },
      }[id]),
      opfsGetFile: async () => null,
    };
    window.espera = { ligado: false, bordas: 0 };
    window.palco = createStage({
      wallpaper: document.getElementById('w'),
      img: document.getElementById('i'),
      video: document.getElementById('v'),
      onEspera: (on) => { window.espera.ligado = !!on; window.espera.bordas++; },
    });
    palco.setFade({ fadeIn: true, fadeOut: true, time: 0.3 });
  });

  const zerarVol = () => pg.evaluate(() => { window.__vol.length = 0; });
  const vols = () => pg.evaluate(() => window.__vol.slice());

  // ── 1. ANUNCIA a espera ─────────────────────────────────────────────────
  await zerarVol();
  await pg.evaluate(() => {
    palco.handle({ type: 'load', mediaId: 'st', view: 'visual', volume: 1 });
  });
  const anunciou = await esperar(pg, () => window.espera.ligado === true,
    'o stream SÓ-ÁUDIO anuncia espera — antes disto ele era o único tipo de '
    + 'mídia que o operador tocava e que não mudava nada na tela', 8000);
  if (anunciou) {
    console.log('ok      o stream SÓ-ÁUDIO anuncia espera — antes disto ele era '
      + 'o único tipo de mídia que o operador tocava e que não mudava nada na tela');
  }

  // O PRIMEIRO DADO CHEGANDO. O palco de mentira não decodifica nada, então o
  // `loadeddata` que a rede produziria não vem sozinho — encena-se o FATO, como
  // o `fingirTocando` do `fome-que-desiste`, nunca a decisão que se quer medir.
  //
  // E ele importa: a rampa é condicionada a HAVER o que ouvir (`soou`). Sem
  // dado, `mediaReady` vence o prazo e devolver som no alvo seria subir o
  // volume de um silêncio.
  await pg.evaluate(() => {
    document.getElementById('v').dispatchEvent(new Event('loadeddata'));
  });
  // O fim da espera é o FATO (o `mediaReady` resolvendo), nunca um relógio
  // nosso: `PRONTO_STREAM_MS` são 15 s e o que se espera é a resolução.
  await esperar(pg, () => window.espera.ligado === false,
    'a espera do stream só-áudio TERMINA quando o primeiro dado chega');
  await pg.waitForTimeout(400);

  // ── 2. ENTRA COM RAMPA ──────────────────────────────────────────────────
  // A prova é uma escrita ESTRITAMENTE entre 0 e o alvo. Sem a correção o
  // volume só é escrito no alvo (pelo `applyMedia`), e a lista não tem nenhuma.
  const seq = await vols();
  const meio = seq.filter((v) => v > 0 && v < 1);
  checar(meio.length > 0,
    'e ENTRA COM RAMPA: há escrita de volume entre 0 e o alvo. Um teste do '
    + 'valor FINAL passaria nas duas versões — nos dois casos ele termina em 1',
    { escritas: seq.slice(0, 12), intermediarias: meio.length });

  // ── 3. O ARQUIVO LOCAL sem imagem continua como era ─────────────────────
  await pg.waitForTimeout(600);
  await zerarVol();
  await pg.evaluate(() => {
    palco.handle({ type: 'load', mediaId: 'arq', view: 'visual', volume: 1 });
  });
  await pg.waitForTimeout(1200);
  const seqArq = await vols();
  checar(seqArq.filter((v) => v > 0 && v < 1).length > 0,
    'o ARQUIVO local sem imagem continua rampando pelo caminho de sempre — a '
    + 'correção acrescentou um ramo, não desviou o que já funcionava',
    { escritas: seqArq.slice(0, 12) });
  checar((await pg.evaluate(() => window.espera.ligado)) === false,
    'e não anuncia espera: um arquivo local vira som em milissegundos, e um '
    + 'aviso que pisca é pior que aviso nenhum');
} finally {
  await navegador.close();
}

console.log(falhas.length ? '\n' + falhas.length + ' falha(s)' : '\ntudo certo');
process.exit(falhas.length ? 1 : 0);
