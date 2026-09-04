#!/usr/bin/env node
// ============================================================================
// A TRANSMISSÃO FAMINTA TEM DE DESISTIR — o watchdog de fome (v1.4.19)
//
// ## O defeito que ele trava
//
// Este era o único caminho do app capaz de produzir **a projeção congelada sem
// nada acontecer**: nem erro, nem queda para o download, nem uma linha no
// console. O CDN aceita a conexão e passa a gotejar; o `fetch` do `mse.js` não
// tinha prazo, o `readTimeout` do `StreamProxy` é POR LEITURA e nunca dispara
// nisso, e o buffer drenava até o quadro parar. O cartão "Preparando…" acendia
// e ficava. Para sempre.
//
// `AVStream.fome` já SABIA — era o único lugar do app que sabia — e só escrevia
// no Registro. Nada agia.
//
// ## Por que ele é a ÚLTIMA linha, e não a primeira
//
// O prazo de parede do `mse.js` (`prazoDoPedido`, com oráculo próprio em
// `degrau-e-prazo.test.mjs`) transforma a maior parte das paradas em erro
// retentável, e a queda para o download vem por ali. Este teto cobre o que
// sobrar, venha de onde vier: um `SourceBuffer` que parou de aceitar, o
// decodificador travado, uma volta do segundo plano que não reengata. A
// pergunta aqui não é *"de quem é a culpa?"* — é *"faz quanto tempo que a
// congregação está olhando um quadro congelado?"*.
//
// ## As cinco metades, e por que cada uma decide alguma coisa
//
//  1. **ARQUIVO LOCAL NÃO DISPARA.** Um `<video>` lendo do disco não fica sem
//     dados, e o `waiting` de um seek não é fome. Sem esta metade o watchdog
//     derrubaria a cena mais comum do culto por um soluço de leitura.
//  2. **O STREAM FAMINTO DISPARA**, com o registro certo — a linha de base.
//  3. **UMA VEZ POR CENA.** A queda para o download leva segundos, e um segundo
//     aviso no meio dela derrubaria a própria recuperação.
//  4. **RECUPERAR ANTES DO TETO NÃO DISPARA.** Uma rede que oscila e volta é o
//     caso NORMAL de uma igreja; um watchdog que a punisse trocaria uma pausa
//     de três segundos por um download de centenas de MB.
//  5. **TROCAR DE CENA CANCELA.** O teto é maior que uma cena inteira: sem esta
//     metade, o aviso da mídia que SAIU chegaria em cima da que ENTROU, e o
//     dono derrubaria a cena errada. É a mesma armadilha do `loadSeq`, um nível
//     abaixo.
//
// ## O RELÓGIO É MOCKADO, e isso é a regra "um oráculo não pode medir o runner"
//
// O teto são 25 s. Esperá-los de verdade quatro vezes daria um oráculo de dois
// minutos cuja reprovação sob carga não distinguiria defeito de agendador. Com
// `page.clock` o tempo é AVANÇADO, e o que se mede é a decisão — determinística
// por construção.
//
//   node tools/fome-que-desiste.test.mjs
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { abrirNavegador, checar, falhas } from './arnes.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(AQUI, '..', 'app', 'src', 'main', 'assets', 'web');
const STAGE = fs.readFileSync(path.join(WEB, 'shared', 'stage.js'), 'utf8');

const navegador = await abrirNavegador();
const ctx = await navegador.newContext();
await semRedeExterna(ctx);
const pg = await ctx.newPage();

try {
  await pg.clock.install();
  await pg.setContent(`<!doctype html><meta charset="utf-8">
    <div id="w"></div><img id="i" hidden><video id="v" playsinline muted hidden></video>
    <script>${STAGE}</script>`);

  await pg.evaluate(() => {
    window.AVStream = {
      suportado: () => true,
      criar: () => ({ destruir() {} }),
      ultimoErro: '',
      fome: { quantas: 0, segundos: 0 },
    };
    window.AVDB = {
      getMedia: async (id) => (id === 'st'
        ? { id: 'st', kind: 'video', name: 'Louvor transmitido', stream: { video: {}, audio: {} } }
        : { id: 'arq', kind: 'video', name: 'Louvor baixado', url: 'data:video/mp4,' }),
      opfsGetFile: async () => null,
    };
    // O QUE O DONO RECEBE. `onStreamErro` é o mesmo canal por onde a URL
    // expirada já chega ao `recuperarStream` — o watchdog não inventa caminho
    // novo, ele usa o que já sabe cair no download.
    window.avisos = [];
    window.palco = createStage({
      wallpaper: document.getElementById('w'),
      img: document.getElementById('i'),
      video: document.getElementById('v'),
      onEspera: () => {},
      onStreamErro: (rec, porque) => { window.avisos.push({ id: rec && rec.id, porque }); },
    });
    palco.setFade({ fadeIn: true, fadeOut: true, time: 0.3 });
    // O `<video>` de mentira nunca toca de verdade (não há fMP4), e a guarda de
    // "parada COMANDADA" recusaria tudo com toda a razão. Encena-se o FATO que o
    // Chromium não entrega — nunca a decisão que se quer medir.
    const v = document.getElementById('v');
    Object.defineProperty(v, 'paused', { get: () => false, configurable: true });
    Object.defineProperty(v, 'ended', { get: () => false, configurable: true });
  });

  const avisos = () => pg.evaluate(() => window.avisos.slice());
  const evento = (nome) => pg.evaluate(
    (n) => document.getElementById('v').dispatchEvent(new Event(n)), nome,
  );
  // ===== O TEMPO AVANÇA EM FATIAS, e isto foi MEDIDO escrevendo o arquivo =====
  //
  // Um `fastForward(40000)` de uma vez dispara o temporizador de 600 ms do
  // anúncio de espera, mas **não reprocessa o de 25 s que aquele callback
  // agenda no meio do salto** — ele fica marcado para depois do salto inteiro.
  // O sintoma foi o aviso do caso 2 aparecendo dentro da janela do caso 3, com
  // os dois lendo como "o app está errado".
  //
  // Em fatias de um segundo cada nível de agendamento tem sua vez, que é o que
  // um relógio de verdade faria. `runFor` e não `fastForward`: aquele SALTA, e
  // saltar é justamente o que perde o temporizador aninhado.
  const passar = async (ms) => {
    for (let i = 0; i < ms; i += 1000) await pg.clock.runFor(1000);
  };

  // Entrar em cena e chegar ao ponto em que a vigília existe: o `load` é
  // assíncrono e o stream espera `PRONTO_STREAM_MS`. `playing` é o que ABRE a
  // vigília — antes dele o que houver de espera é CARGA, que tem dona própria.
  const entrarEmCena = async (id) => {
    await pg.evaluate((x) => { palco.handle({ type: 'load', mediaId: x, view: 'visual' }); }, id);
    await passar(20000);
    await evento('playing');
  };
  // ── 1. ARQUIVO LOCAL NÃO DISPARA ────────────────────────────────────────
  await entrarEmCena('arq');
  await evento('waiting');
  await passar(40000);
  checar((await avisos()).length === 0,
    'ARQUIVO LOCAL não dispara o watchdog: um `<video>` lendo do disco não fica '
    + 'sem dados, e o `waiting` de um seek não é fome',
    await avisos());

  // ── 2. O STREAM FAMINTO DISPARA ─────────────────────────────────────────
  await entrarEmCena('st');
  await evento('waiting');
  await passar(40000);
  const dep2 = await avisos();
  checar(dep2.length === 1 && dep2[0].id === 'st' && /sem dados/.test(dep2[0].porque || ''),
    'a TRANSMISSÃO faminta avisa o dono — com o registro certo e um motivo que '
    + 'o Registro sabe imprimir',
    dep2);

  // ── 3. UMA VEZ POR CENA ─────────────────────────────────────────────────
  await evento('waiting');
  await passar(40000);
  checar((await avisos()).length === 1,
    'e avisa UMA vez por cena: a queda para o download leva segundos, e um '
    + 'segundo aviso no meio dela derrubaria a própria recuperação',
    await avisos());

  // ── 4. RECUPERAR ANTES DO TETO NÃO DISPARA ──────────────────────────────
  await entrarEmCena('st');
  await evento('waiting');
  await passar(5000);
  await evento('playing');
  await passar(40000);
  checar((await avisos()).length === 1,
    'uma fome que PASSA antes do teto não avisa ninguém: uma rede que oscila e '
    + 'volta é o caso normal de uma igreja, e puni-la trocaria uma pausa de '
    + 'segundos por um download de centenas de MB',
    await avisos());

  // ── 5. TROCAR DE CENA CANCELA ───────────────────────────────────────────
  await entrarEmCena('st');
  await evento('waiting');
  await passar(5000);
  await pg.evaluate(() => { palco.handle({ type: 'load', mediaId: 'arq', view: 'visual' }); });
  await passar(40000);
  checar((await avisos()).length === 1,
    'trocar de cena CANCELA a vigília: o teto é maior que uma cena inteira, e o '
    + 'aviso da mídia que SAIU chegaria em cima da que ENTROU — a armadilha do '
    + '`loadSeq`, um nível abaixo',
    await avisos());
} finally {
  await navegador.close();
}

console.log(falhas.length ? '\n' + falhas.length + ' falha(s)' : '\ntudo certo');
process.exit(falhas.length ? 1 : 0);
