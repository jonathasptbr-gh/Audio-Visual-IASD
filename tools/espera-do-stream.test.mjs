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
// O aviso existia, e só na CARGA: do comando ao primeiro quadro. Depois disso a
// transmissão ficava sem rede de segurança nenhuma — justamente ela, a única
// mídia do app que precisa de JS rodando enquanto toca.
//
// ## O QUE ELE MEDE, e por que mudou na v1.4.8
//
// O palco DESENHAVA a espera (um aro, `.av-stage-busy`), e havia dois
// indicadores para o mesmo fato: aquele aro e o cartão "Preparando…" sobre a
// preview. O operador pediu um só — *"vamos abandonar o spinner no telão… e nos
// controles já temos a mensagem de preparando"*. Hoje o palco **anuncia**
// (`opts.onEspera(ligado)`) e quem desenha é o dono; a asserção passou a ser o
// ANÚNCIO, que é o contrato de verdade. Medir o DOM aqui seria medir a UI do
// Controle a partir do motor.
//
// ## As quatro metades, e por que nenhuma sozinha resolve
//
//  1. **APARECE**: um `waiting` que dura anuncia espera no meio da reprodução.
//  2. **NÃO PISCA**: um soluço mais curto que `ESPERA_BUFFER_MS` não anuncia
//     nada. Sem esta metade a correção seria pior que o defeito — um cartão
//     piscando a cada seek.
//  3. **SÓ NO STREAM**: um arquivo local não fica sem dados, e o `waiting` de
//     um seek em disco não é fome. É a mesma regra que já governa a carga.
//  4. **É CONTADO**: `AVStream.fome` guarda episódios E segundos parados. Dois
//     travamentos de meio segundo é uma rede que oscila; dez de cinco segundos
//     é uma rede que não sustenta a faixa escolhida — e só a segunda tem
//     resposta (baixar em vez de transmitir). Uma contagem sozinha não as
//     distingue, e é por isso que são dois números.
//
// ## E a quinta: as DUAS razões não podem se apagar uma à outra
//
// `mostrarEspera` é dona só da CARGA. Com uma dona única, o `mostrarEspera(false)`
// do fim da carga desligaria um anúncio aceso por fome — e o `clear` de uma cena
// deixaria o Controle dizendo "Preparando" sobre o wallpaper, que é o repouso.
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
// ## A sétima: O PALCO NÃO DESENHA NADA (v1.4.8)
//
// *"enquanto não houver imagem e/ou som propriamente do vídeo, então não mostre
// nada além do wallpaper… no telão não vai mensagens de preparação"*. O telão
// não passa `onEspera` — e é preciso provar que a ausência dele não é uma
// exceção engolida nem um elemento que voltou por conveniência: um palco sem a
// opção fica com dois estados e nenhum intermediário.
//
//   node tools/espera-do-stream.test.mjs
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
  // O palco mínimo, como no `stage-fade`: as três camadas que o `createStage`
  // recebe, sem uma linha do CSS do app. O que se mede é o `onEspera` que o
  // próprio stage chama.
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
    // O ESTADO ANUNCIADO, e o número de BORDAS. O primeiro é o que o Controle
    // desenha; o segundo é o que impede a correção de virar um cartão piscando
    // — um anúncio repetido do mesmo valor não pode sair daqui, porque do outro
    // lado ele abriria um dono a mais no `previewBusy`.
    window.espera = { ligado: false, bordas: 0 };
    window.palco = createStage({
      wallpaper: document.getElementById('w'),
      img: document.getElementById('i'),
      video: document.getElementById('v'),
      // O QUE A PREVIEW DO CONTROLE PASSA (v1.4.8). O telão NÃO passa — e é só
      // isso que os separa. Sem esta linha este arquivo inteiro mediria o palco
      // da PROJEÇÃO, onde a resposta certa é justamente não haver anúncio
      // nenhum — ver a última metade.
      onEspera: (on) => { window.espera.ligado = !!on; window.espera.bordas++; },
    });
    // OS FADES NASCEM DESLIGADOS no `createStage` e o app os LIGA (`FADE`, via
    // `setFade`) — e é só com eles ligados que o anúncio da CARGA existe: ele
    // mora dentro do `if (fadeIn && alvo)`. Um palco de mentira sem esta linha
    // mede uma configuração que nenhum dos dois donos reais usa.
    palco.setFade({ fadeIn: true, fadeOut: true, time: 0.3 });
  });

  const aviso = () => pg.evaluate(() => Object.assign({}, window.espera));
  const censo = () => pg.evaluate(() => Object.assign({}, window.AVStream.fome));
  // O `<video>` deste palco nunca chega a tocar de verdade (não há fMP4), então
  // `paused` é true e a guarda de "parada COMANDADA" recusaria o aviso com toda
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

  // ── 1. A CARGA de um stream anuncia espera ──────────────────────────────
  // A linha de base, e ela também prova que o palco de mentira chegou ao ramo
  // certo: sem `stream` não-nulo nada abaixo mediria coisa nenhuma.
  await pg.evaluate(() => { palco.handle({ type: 'load', mediaId: 'st', view: 'visual' }); });
  await pg.waitForFunction(() => window.espera.ligado === true, null, { timeout: 5000 });
  checar(true, 'a CARGA de um stream ANUNCIA espera — a linha de base do recurso');

  // O fim da carga desliga. Esperado pelo FATO (o anúncio caindo), nunca por um
  // prazo: `PRONTO_STREAM_MS` são 15 s e quem responde é o `mediaReady`.
  await pg.waitForFunction(() => window.espera.ligado === false, null, { timeout: 25000 });
  await fingirTocando();
  checar((await censo()).quantas === 0,
    'e a CARGA não entra no censo de fome — MEDIDO: um `MediaSource` nasce vazio '
    + 'e dispara `waiting` em toda transmissão, então contá-la faria o número do '
    + 'Registro dizer "≥1 sempre"', await censo());

  // A VIGÍLIA ABRE AQUI. Antes do primeiro `playing` a mídia ainda não começou,
  // e o que houver de espera é carga — que já tem dona e nome próprio.
  await pg.evaluate(() => { document.getElementById('v').dispatchEvent(new Event('playing')); });

  // ── 2. NÃO PISCA: um soluço curto não anuncia nada ──────────────────────
  const bordasAntes = (await aviso()).bordas;
  await pg.evaluate(() => {
    const v = document.getElementById('v');
    v.dispatchEvent(new Event('waiting'));
    setTimeout(() => v.dispatchEvent(new Event('playing')), 120);
  });
  await pg.waitForTimeout(900);
  checar((await aviso()).ligado === false && (await aviso()).bordas === bordasAntes,
    'um soluço mais curto que `ESPERA_BUFFER_MS` NÃO anuncia espera — e não emite '
    + 'borda nenhuma: um cartão piscando a cada seek é pior que cartão nenhum',
    await aviso());
  checar((await censo()).quantas === 0,
    'e não conta episódio: o que não foi travamento não vira número no Registro',
    await censo());

  // ── 3. APARECE: um `waiting` que dura anuncia ───────────────────────────
  await pg.evaluate(() => {
    document.getElementById('v').dispatchEvent(new Event('waiting'));
  });
  await pg.waitForFunction(() => window.espera.ligado === true, null, { timeout: 5000 });
  checar(true,
    'um `waiting` QUE DURA anuncia espera no meio da reprodução — era este o '
    + 'quadro congelado sem explicação nenhuma');

  // ── 4. É CONTADO, nos DOIS números ──────────────────────────────────────
  await pg.waitForTimeout(700);
  await pg.evaluate(() => { document.getElementById('v').dispatchEvent(new Event('playing')); });
  const depois = await censo();
  checar((await aviso()).ligado === false, 'e `playing` o desliga', await aviso());
  checar(depois.quantas === 1 && depois.segundos > 0,
    'o episódio entra no censo COM O TEMPO PARADO: dois travamentos de meio '
    + 'segundo e dez de cinco segundos pedem respostas opostas, e uma contagem '
    + 'sozinha não os distingue', depois);

  // ── 5. O `clear` não deixa o aviso de pé sobre o wallpaper ──────────────
  // Esta metade é de DESFECHO, não de mecanismo, e isso está dito porque a
  // diferença importa para quem editar depois: MEDIDO, quem desliga o anúncio no
  // `clear` é hoje o `emptied` do `removeAttribute('src')`, e removendo as duas
  // linhas do `resetMediaDom` o oráculo continua verde. O que ele garante é que
  // o aviso NÃO sobrevive à cena — por qualquer dos dois caminhos.
  await pg.evaluate(() => {
    document.getElementById('v').dispatchEvent(new Event('waiting'));
  });
  await pg.waitForFunction(() => window.espera.ligado === true, null, { timeout: 5000 });
  await pg.evaluate(() => { palco.handle({ type: 'clear' }); });
  // ESPERAR PELO FATO, NÃO POR UM PRAZO. Quem desliga o anúncio aqui é um evento
  // ASSÍNCRONO do próprio `<video>` (o `emptied` que o `removeAttribute('src')`
  // dispara), e um `waitForTimeout` fixo é uma aposta na máquina: sob carga o
  // evento chega depois do prazo, o oráculo reprova um app que está CERTO, e
  // quem lê o log conclui que a projeção ficou com o cartão de pé.
  // MEDIDO: foi assim que a v1.4.30 reprovou no runner (48/49) e não publicou
  // o bundle — o portão do `web-ota` fecha com o `verificar`.
  const apagou = await pg.waitForFunction(() => window.espera.ligado === false,
    null, { timeout: 5000 }).then(() => true).catch(() => false);
  checar(apagou,
    'o `clear` não deixa o aviso da FOME de pé — o Controle dizendo "Preparando" '
    + 'sobre o wallpaper é o app afirmando que trabalha sem cena nenhuma',
    apagou ? undefined : 'PRAZO, não veredito: o aviso continuava ligado 5 s depois do `clear`');

  // ── 6. SÓ NO STREAM ─────────────────────────────────────────────────────
  // Um arquivo local não fica sem dados. Sem esta metade a correção anunciaria
  // espera no `waiting` de todo seek em disco — a mesma regra que já governa a
  // carga, e a que impede este recurso de virar ruído.
  await pg.evaluate(() => { palco.handle({ type: 'load', mediaId: 'arq', view: 'visual' }); });
  await pg.waitForTimeout(600);
  await fingirTocando();
  await pg.evaluate(() => { document.getElementById('v').dispatchEvent(new Event('waiting')); });
  await pg.waitForTimeout(1200);
  checar((await aviso()).ligado === false,
    'num ARQUIVO LOCAL o `waiting` não anuncia nada — ali não há fome de rede, e '
    + 'um seek em disco viraria um cartão piscando', await aviso());
  checar((await censo()).quantas === 2,
    'e o censo continua contando só a transmissão — os dois episódios são os do '
    + 'stream (o `clear` do passo anterior FECHA a fome que interrompeu, e conta: '
    + 'a projeção esteve parada até ele)', await censo());

  // ── 7. NA PROJEÇÃO NÃO HÁ NADA ──────────────────────────────────────────
  // Pedido do operador: *"no telão não vai mensagens de preparação… enquanto não
  // houver imagem e/ou som propriamente do vídeo, então não mostre nada além do
  // wallpaper"*. O mesmo `stage.js` roda no telão e nas telas da rede; o que os
  // separa da preview é ESTA opção. Duas coisas se medem, e são diferentes: o
  // palco sem `onEspera` não pode LANÇAR (uma exceção ali derrubaria o `load` no
  // meio do culto) e não pode DESENHAR — nenhum elemento novo dentro da caixa
  // dele além das três camadas que ele recebeu.
  const projecao = await pg.evaluate(async () => {
    // NUMA CAIXA PRÓPRIA, e isso não é arrumação: qualquer elemento que o palco
    // criasse nasceria IRMÃO do `<video>`, e com os dois palcos soltos no `body`
    // o irmão do segundo seria o do PRIMEIRO — o oráculo reprovaria um app
    // correto.
    document.body.insertAdjacentHTML('beforeend',
      '<div id="caixa2"><div id="w2"></div><img id="i2" hidden>'
      + '<video id="v2" playsinline muted hidden></video></div>');
    const caixa = document.getElementById('caixa2');
    const antes = caixa.children.length;
    let erro = '';
    try {
      const p2 = createStage({
        wallpaper: document.getElementById('w2'),
        img: document.getElementById('i2'),
        video: document.getElementById('v2'),
      });
      p2.setFade({ fadeIn: true, fadeOut: true, time: 0.3 });
      p2.handle({ type: 'load', mediaId: 'st', view: 'visual' });
      await new Promise((f) => setTimeout(f, 800));
    } catch (e) { erro = String((e && e.message) || e); }
    return { erro, antes, depois: caixa.children.length };
  });
  checar(projecao.erro === '' && projecao.depois === projecao.antes,
    'um palco SEM `onEspera` (o telão e as telas da rede) não desenha nada e não '
    + 'lança — a projeção tem dois estados e nenhum intermediário: o wallpaper '
    + 'em repouso, ou o conteúdo no ar', projecao);
} finally {
  await navegador.close();
}

console.log(falhas.length ? '\n' + falhas.length + ' falha(s)' : '\ntudo certo');
process.exit(falhas.length ? 1 : 0);
