#!/usr/bin/env node
// ============================================================================
// O TRAVAMENTO DA TRANSMISSÃO DIRETA TEM DE APARECER — e ser CONTADO
//
// ## O defeito que ele trava
//
// Relato do operador, sobre um vídeo do YouTube tocado direto do online: *"veio
// som, porém ficou travando e qualidade de vídeo baixa"*. E a leitura possível
// era um palpite — *"deve ser a estabilidade da internet do app com o
// YouTube"* —, porque **um `<video>` sem dados e um app quebrado produzem
// exatamente a mesma tela**: um quadro congelado, sem erro no console, sem nada
// que diga que alguém está esperando.
//
// O giro (`.av-stage-busy`) existia, e só na CARGA: do comando ao primeiro
// quadro. Depois disso a transmissão ficava sem rede de segurança nenhuma —
// justamente ela, a única mídia do app que precisa de JS rodando enquanto toca.
//
// ## As quatro metades, e por que nenhuma sozinha resolve
//
//  1. **APARECE**: um `waiting` que dura acende o giro no meio da reprodução.
//  2. **NÃO PISCA**: um soluço mais curto que `ESPERA_BUFFER_MS` não acende
//     nada. Sem esta metade a correção seria pior que o defeito — um aro
//     piscando a cada seek, na frente da congregação.
//  3. **SÓ NO STREAM**: um arquivo local não fica sem dados, e o `waiting` de
//     um seek em disco não é fome. É a mesma regra que já governa o giro da
//     carga.
//  4. **É CONTADO**: `AVStream.fome` guarda episódios E segundos parados. Dois
//     travamentos de meio segundo é uma rede que oscila; dez de cinco segundos
//     é uma rede que não sustenta a faixa escolhida — e só a segunda tem
//     resposta (baixar em vez de transmitir). Uma contagem sozinha não as
//     distingue, e é por isso que são dois números.
//
// ## E a quinta: as DUAS esperas não podem se apagar uma à outra
//
// `mostrarEspera` é dono só da CARGA. Com um dono único, o `mostrarEspera(false)`
// do fim da carga apagaria um giro aceso por fome — e o `clear` de uma cena
// deixaria girando um aro sobre o wallpaper, que é a tela do repouso.
//
// ## A sexta, e ela foi MEDIDA escrevendo este arquivo
//
// **Um stream dispara `waiting` no instante da carga, sempre** — o
// `MediaSource` nasce vazio e o primeiro fragmento vem da rede. A primeira
// versão do censo contava isso: TODA transmissão registrava um travamento antes
// do primeiro quadro, e o número do Registro passava a dizer "≥1 sempre", que é
// o mesmo que não dizer nada. Daí a vigília só abrir no primeiro `playing` — e
// daí esta asserção existir antes das outras.
//
//   node tools/espera-do-stream.test.mjs
// ============================================================================
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(AQUI, '..', 'app', 'src', 'main', 'assets', 'web');
const STAGE = fs.readFileSync(path.join(WEB, 'shared', 'stage.js'), 'utf8');

const falhas = [];
function checar(cond, msg, obtido) {
  if (cond) console.log('ok      ' + msg);
  else {
    console.log('FALHOU  ' + msg + (obtido !== undefined ? '\n        obtido: ' + JSON.stringify(obtido) : ''));
    falhas.push(msg);
  }
}

const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const ctx = await navegador.newContext();
await semRedeExterna(ctx);
const pg = await ctx.newPage();

try {
  // O palco mínimo, como no `stage-fade`: as três camadas que o `createStage`
  // recebe, sem uma linha do CSS do app. O que se mede é o `hidden` que o
  // próprio stage escreve no `.av-stage-busy`.
  await pg.setContent(`<!doctype html><meta charset="utf-8">
    <div id="w"></div><img id="i" hidden><video id="v" playsinline muted hidden></video>
    <script>${STAGE}</script>`);

  await pg.evaluate(() => {
    // O MOTOR DE STREAM DE MENTIRA. Ele não decodifica nada: o que o stage
    // precisa dele é ser CRIÁVEL — é a presença de `stream` que separa "esta
    // cena é uma transmissão" de "é um arquivo", e é essa a guarda que o
    // indicador de fome consulta. `fome` é o balcão de verdade (mora no
    // `mse.js`), reproduzido aqui com a mesma forma.
    window.AVStream = {
      suportado: () => true,
      criar: () => ({ destruir() {} }),
      ultimoErro: '',
      fome: { quantas: 0, segundos: 0 },
    };
    window.AVDB = {
      getMedia: async (id) => (id === 'st'
        // TRANSMISSÃO: sem blob, sem opfsPath, sem url — só o descritor. É
        // exatamente a forma que o `tentarTransmitir` grava.
        ? { id: 'st', kind: 'video', name: 'Louvor transmitido', stream: { video: {}, audio: {} } }
        // ARQUIVO LOCAL: uma `url` basta para o stage não entrar no ramo do
        // stream. O blob vazio é o mesmo truque do `stage-fade` — sem um fMP4
        // de verdade não há primeiro quadro, e é o caso PIOR que interessa.
        : { id: 'arq', kind: 'video', name: 'Louvor baixado', url: 'data:video/mp4,' }),
      opfsGetFile: async () => null,
    };
    window.palco = createStage({
      wallpaper: document.getElementById('w'),
      img: document.getElementById('i'),
      video: document.getElementById('v'),
      // `espera: true` é o que a PREVIEW do Controle passa (v1.4.7). O aro é
      // maquinaria, e maquinaria é assunto de quem opera: o telão não a mostra.
      // Sem esta linha este arquivo inteiro mediria o palco da PROJEÇÃO, onde a
      // resposta certa é justamente não haver aro nenhum — ver a última metade.
      espera: true,
    });
    // OS FADES NASCEM DESLIGADOS no `createStage` e o app os LIGA (`FADE`, via
    // `setFade`) — e é só com eles ligados que o giro da CARGA existe: ele mora
    // dentro do `if (fadeIn && alvo)`. Um palco de mentira sem esta linha mede
    // uma configuração que nenhum dos dois donos reais usa.
    palco.setFade({ fadeIn: true, fadeOut: true, time: 0.3 });
  });

  const giro = () => pg.evaluate(() => {
    const el = document.querySelector('.av-stage-busy');
    return { existe: !!el, visivel: !!el && !el.hidden };
  });
  const censo = () => pg.evaluate(() => Object.assign({}, window.AVStream.fome));
  // O `<video>` deste palco nunca chega a tocar de verdade (não há fMP4), então
  // `paused` é true e a guarda de "parada COMANDADA" recusaria o giro com toda
  // a razão. Aqui se força o fato que o navegador não pode produzir: a mídia
  // ESTÁ tocando. É o mesmo espírito do blob vazio — encenar o que o Chromium
  // não entrega, nunca a decisão que se quer medir.
  const fingirTocando = () => pg.evaluate(() => {
    const v = document.getElementById('v');
    if (!Object.getOwnPropertyDescriptor(v, 'paused')) {
      Object.defineProperty(v, 'paused', { get: () => false, configurable: true });
      Object.defineProperty(v, 'ended', { get: () => false, configurable: true });
    }
  });

  // ── 1. A CARGA de um stream acende o giro ───────────────────────────────
  // A linha de base, e ela também prova que o palco de mentira chegou ao ramo
  // certo: sem `stream` não-nulo nada abaixo mediria coisa nenhuma.
  await pg.evaluate(() => { palco.handle({ type: 'load', mediaId: 'st', view: 'visual' }); });
  await pg.waitForFunction(() => {
    const el = document.querySelector('.av-stage-busy');
    return !!el && !el.hidden;
  }, null, { timeout: 5000 });
  checar(true, 'a CARGA de um stream acende o giro — a linha de base do recurso');

  // O fim da carga apaga. Esperado pelo FATO (o giro sumindo), nunca por um
  // prazo: `PRONTO_STREAM_MS` são 15 s e quem responde é o `mediaReady`.
  await pg.waitForFunction(() => {
    const el = document.querySelector('.av-stage-busy');
    return !!el && el.hidden;
  }, null, { timeout: 25000 });
  await fingirTocando();
  checar((await censo()).quantas === 0,
    'e a CARGA não entra no censo de fome — MEDIDO: um `MediaSource` nasce vazio '
    + 'e dispara `waiting` em toda transmissão, então contá-la faria o número do '
    + 'Registro dizer "≥1 sempre"', await censo());

  // A VIGÍLIA ABRE AQUI. Antes do primeiro `playing` a mídia ainda não começou,
  // e o que houver de espera é carga — que já tem dono e nome próprio.
  await pg.evaluate(() => { document.getElementById('v').dispatchEvent(new Event('playing')); });

  // ── 2. NÃO PISCA: um soluço curto não acende nada ───────────────────────
  await pg.evaluate(() => {
    const v = document.getElementById('v');
    v.dispatchEvent(new Event('waiting'));
    setTimeout(() => v.dispatchEvent(new Event('playing')), 120);
  });
  await pg.waitForTimeout(900);
  checar((await giro()).visivel === false,
    'um soluço mais curto que `ESPERA_BUFFER_MS` NÃO acende o giro — um aro '
    + 'piscando a cada seek é pior que aro nenhum, e aparece na projeção',
    await giro());
  checar((await censo()).quantas === 0,
    'e não conta episódio: o que não foi travamento não vira número no Registro',
    await censo());

  // ── 3. APARECE: um `waiting` que dura acende ────────────────────────────
  await pg.evaluate(() => {
    document.getElementById('v').dispatchEvent(new Event('waiting'));
  });
  await pg.waitForFunction(() => {
    const el = document.querySelector('.av-stage-busy');
    return !!el && !el.hidden;
  }, null, { timeout: 5000 });
  checar(true,
    'um `waiting` QUE DURA acende o giro no meio da reprodução — era este o '
    + 'quadro congelado sem explicação nenhuma');

  // ── 4. É CONTADO, nos DOIS números ──────────────────────────────────────
  await pg.waitForTimeout(700);
  await pg.evaluate(() => { document.getElementById('v').dispatchEvent(new Event('playing')); });
  const depois = await censo();
  checar((await giro()).visivel === false, 'e `playing` o apaga', await giro());
  checar(depois.quantas === 1 && depois.segundos > 0,
    'o episódio entra no censo COM O TEMPO PARADO: dois travamentos de meio '
    + 'segundo e dez de cinco segundos pedem respostas opostas, e uma contagem '
    + 'sozinha não os distingue', depois);

  // ── 5. O `clear` não deixa o aro girando sobre o wallpaper ──────────────
  // Esta metade é de DESFECHO, não de mecanismo, e isso está dito porque a
  // diferença importa para quem editar depois: MEDIDO, quem apaga o giro no
  // `clear` é hoje o `emptied` do `removeAttribute('src')`, e removendo as duas
  // linhas do `resetMediaDom` o oráculo continua verde. O que ele garante é que
  // o aro NÃO sobrevive à cena — por qualquer dos dois caminhos.
  await pg.evaluate(() => {
    document.getElementById('v').dispatchEvent(new Event('waiting'));
  });
  await pg.waitForFunction(() => {
    const el = document.querySelector('.av-stage-busy');
    return !!el && !el.hidden;
  }, null, { timeout: 5000 });
  await pg.evaluate(() => { palco.handle({ type: 'clear' }); });
  await pg.waitForTimeout(300);
  checar((await giro()).visivel === false,
    'o `clear` não deixa o giro da FOME de pé — um aro girando sobre o wallpaper '
    + 'é o telão dizendo que trabalha quando não há cena nenhuma', await giro());

  // ── 6. SÓ NO STREAM ─────────────────────────────────────────────────────
  // Um arquivo local não fica sem dados. Sem esta metade a correção acenderia o
  // aro no `waiting` de todo seek em disco — a mesma regra que já governa o
  // giro da carga, e a que impede este recurso de virar ruído.
  await pg.evaluate(() => { palco.handle({ type: 'load', mediaId: 'arq', view: 'visual' }); });
  await pg.waitForTimeout(600);
  await fingirTocando();
  await pg.evaluate(() => { document.getElementById('v').dispatchEvent(new Event('waiting')); });
  await pg.waitForTimeout(1200);
  checar((await giro()).visivel === false,
    'num ARQUIVO LOCAL o `waiting` não acende nada — ali não há fome de rede, e '
    + 'um seek em disco viraria um aro piscando na projeção', await giro());
  checar((await censo()).quantas === 2,
    'e o censo continua contando só a transmissão — os dois episódios são os do '
    + 'stream (o `clear` do passo anterior FECHA a fome que interrompeu, e conta: '
    + 'a projeção esteve parada até ele)', await censo());
  // ── 7. NA PROJEÇÃO NÃO HÁ ARO NENHUM ────────────────────────────────────
  // Pedido do operador: *"para o telão, literalmente só apareça quando o vídeo
  // estiver realmente sendo reproduzido"*. O mesmo `stage.js` roda no telão e
  // nas telas da rede; o que os separa da preview é ESTA opção. Sem esta
  // metade, o aro voltaria à projeção no dia em que alguém desse um `true` de
  // conveniência ao criar um palco novo.
  const semAro = await pg.evaluate(async () => {
    // NUMA CAIXA PRÓPRIA, e isso não é arrumação: o `.av-stage-busy` é criado
    // como IRMÃO do `<video>`, e com os dois palcos soltos no `body` o irmão do
    // segundo seria o aro do PRIMEIRO — o oráculo reprovaria um app correto.
    document.body.insertAdjacentHTML('beforeend',
      '<div id="caixa2"><div id="w2"></div><img id="i2" hidden>'
      + '<video id="v2" playsinline muted hidden></video></div>');
    const p2 = createStage({
      wallpaper: document.getElementById('w2'),
      img: document.getElementById('i2'),
      video: document.getElementById('v2'),
    });
    p2.setFade({ fadeIn: true, fadeOut: true, time: 0.3 });
    p2.handle({ type: 'load', mediaId: 'st', view: 'visual' });
    await new Promise((f) => setTimeout(f, 800));
    const v2 = document.getElementById('v2');
    // O `.av-stage-busy` é criado como IRMÃO do `<video>`: procurá-lo no
    // documento inteiro acharia o da preview, que está aceso com toda a razão.
    return !!(v2.parentElement && v2.parentElement.querySelector('.av-stage-busy'));
  });
  checar(semAro === false,
    'um palco SEM `espera` (o telão e as telas da rede) não desenha aro nenhum — '
    + 'a maquinaria de carregamento é assunto de quem opera, e na projeção ela é '
    + 'o app contando como funciona a quem não perguntou', semAro);
} finally {
  await navegador.close();
}

console.log(falhas.length ? '\n' + falhas.length + ' falha(s)' : '\ntudo certo');
process.exit(falhas.length ? 1 : 0);
