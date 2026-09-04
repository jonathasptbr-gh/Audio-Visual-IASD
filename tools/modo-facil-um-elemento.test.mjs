#!/usr/bin/env node
// ============================================================================
// NO MODO FÁCIL SÓ HÁ UM ELEMENTO NO AR (v1.4.32)
//
// Pedido do operador: *"no modo simples, coloque a limitação de apenas um
// elemento ativo na mídia, assim no modo simples não há sobreposição e nem
// necessidade de multicontroles"*.
//
// A sobreposição (v5.312 para a imagem, v1.4.28 para a apresentação) é uma CENA
// COMPOSTA: duas coisas no ar ao mesmo tempo. Operá-la exige saber qual das duas
// cada controle governa — o ▶ é do áudio de baixo, o ⏭ é da apresentação de
// cima, o Parar tira uma só. Esse é o vocabulário do modo AVANÇADO, e é
// exatamente o que o Modo Fácil existe para não pedir de quem opera: ali o toque
// tem UM significado — *isto vai para o telão* —, e o que estava vai embora.
//
// ## O que este oráculo prende, e por que cada metade
//
//  - **O Modo Fácil SUBSTITUI.** Nas DUAS portas do cartão visual (a imagem e a
//    apresentação), porque a guarda é uma só e uma regra que valesse para metade
//    delas seria a divergência de sempre.
//  - **O AVANÇADO CONTINUA SOBREPONDO.** É a reversão que fecha o lote: sem ela,
//    apagar a sobreposição do app inteiro passaria em tudo acima — e o recurso
//    que o operador pediu na v1.4.28 (música atrás dos slides) morreria em
//    silêncio, num modo que ele nem nomeou neste pedido.
//  - **A LIMITAÇÃO É DO MODO, não da conexão.** A guarda pergunta `appMode`, e
//    é isso que a faz valer também com o Modo Fácil desbloqueado por
//    "Tocar neste celular" — o estado em que ele mais parece o avançado.
//  - **O COMPARTILHAMENTO PASSA PELA MESMA PORTA.** No Modo Fácil um arquivo
//    compartilhado projeta na hora, sem perguntar nada: é o caminho por onde uma
//    apresentação de fato entra ali, e é o que uma guarda escrita nas telas (em
//    vez de no `send`) deixaria de fora.
//
//   node tools/modo-facil-um-elemento.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, checar, falhas } from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)),
  '..', 'app', 'src', 'main', 'assets', 'web');

const servidor = servirEstatico(RAIZ);

await new Promise((r) => servidor.listen(0, r));
const navegador = await abrirNavegador();
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);
const pg = await ctx.newPage();
const base = 'http://localhost:' + servidor.address().port;

try {
  pg.on('pageerror', (e) => falhas.push('pageerror: ' + e.message));
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(
    () => window.AVDB && typeof window.__avBack === 'function'
      && !!document.querySelector('#playlist li'),
    null, { timeout: 30000 },
  );

  const ids = await pg.evaluate(async () => {
    const pages = [];
    for (let i = 0; i < 4; i++) {
      const cv = document.createElement('canvas');
      cv.width = 32; cv.height = 18;
      cv.getContext('2d').fillRect(0, 0, 32, 18);
      pages.push(await new Promise((r) => cv.toBlob(r, 'image/png')));
    }
    const d = await AVDB.addDeck(pages, { name: 'Semana da Familia', list: 'imports' });
    const a = await AVDB.addMedia(new Blob(['x'], { type: 'audio/wav' }),
      { name: 'Louvor de Fundo', type: 'audio/wav', kind: 'audio', list: 'imports' });
    const i = await AVDB.addMedia(pages[0],
      { name: 'Aviso da Secretaria', type: 'image/png', kind: 'image', list: 'imports' });
    return { deck: d.id, audio: a.id, imagem: i.id };
  });

  // O que se mede depois de cada toque. `camada` é o campo que carrega a regra;
  // `emCena` diz QUEM ficou no slot da mídia.
  const projetar = (modo, primeiro, segundo) => pg.evaluate(async (o) => {
    setAppMode(o.modo);
    await send(o.primeiro);
    await new Promise((r) => setTimeout(r, 150));
    window.__cmds = [];
    if (!window.__tap) {
      window.__tap = true;
      const real = AVDB.sendCommand.bind(AVDB);
      AVDB.sendCommand = (c) => { window.__cmds.push(c); return real(c); };
    }
    window.__cmds = [];
    await send(o.segundo);
    await new Promise((r) => setTimeout(r, 200));
    return {
      camada: visualSobreProjetando(),
      emCena: currentId,
      tipos: window.__cmds.map((c) => c.type),
    };
  }, { modo, primeiro, segundo });

  // ── 1. MODO FÁCIL: a apresentação SUBSTITUI o louvor ──────────────────────
  const facilDeck = await projetar('simple', ids.audio, ids.deck);
  checar(!facilDeck.camada && facilDeck.emCena === ids.deck,
    'NO MODO FÁCIL a apresentação SUBSTITUI o louvor: um elemento no ar, e o '
    + 'toque com UM significado — isto vai para o telão', facilDeck);
  checar(facilDeck.tipos.includes('load'),
    '  ↳ e o que sai é um `load`, o caminho de sempre da mídia — não o `text` '
    + 'da Camada de Texto', facilDeck.tipos);

  // ── 2. MODO FÁCIL: a IMAGEM também ────────────────────────────────────────
  // A guarda é UMA para os dois conteúdos do cartão. Uma regra que valesse para
  // metade das portas é a divergência que este arquivo recusa em toda parte.
  const facilImg = await projetar('simple', ids.audio, ids.imagem);
  checar(!facilImg.camada && facilImg.emCena === ids.imagem,
    'e a IMAGEM segue a mesma regra — a guarda é UMA para os dois conteúdos do '
    + 'cartão visual', facilImg);

  // ── 3. O AVANÇADO CONTINUA SOBREPONDO — a reversão que fecha o lote ───────
  const avancadoDeck = await projetar('full', ids.audio, ids.deck);
  checar(avancadoDeck.camada && avancadoDeck.emCena === ids.audio,
    'O MODO AVANÇADO CONTINUA SOBREPONDO: a música atrás dos slides (v1.4.28) '
    + 'é de LÁ. Sem esta metade, apagar a sobreposição do app inteiro passaria '
    + 'nas duas asserções acima e o recurso morreria em silêncio', avancadoDeck);
  const avancadoImg = await projetar('full', ids.audio, ids.imagem);
  checar(avancadoImg.camada && avancadoImg.emCena === ids.audio,
    '  ↳ e a imagem sobre o áudio (v5.312) também', avancadoImg);

  // ── 4. A LIMITAÇÃO É DO MODO, NÃO DA CONEXÃO ──────────────────────────────
  // `tocarNoCelular` é o estado em que o Modo Fácil mais se parece com o
  // avançado: destravado, com o som saindo deste aparelho. A guarda pergunta
  // `appMode`, então ela continua valendo — e é isso que a torna uma regra sobre
  // o VOCABULÁRIO do modo, e não sobre o estado da tela.
  const destravado = await pg.evaluate(async (o) => {
    setAppMode('simple');
    setTocarNoCelular(true);
    await send(o.audio);
    await new Promise((r) => setTimeout(r, 150));
    await send(o.deck);
    await new Promise((r) => setTimeout(r, 200));
    return { camada: visualSobreProjetando(), emCena: currentId, tocando: tocarNoCelular };
  }, ids);
  checar(destravado.tocando && !destravado.camada && destravado.emCena === ids.deck,
    'e a limitação é do MODO, não da conexão: com "Tocar neste celular" ligado '
    + '— o estado em que o Modo Fácil mais parece o avançado — ele continua '
    + 'substituindo', destravado);

  // ── 5. O COMPARTILHAMENTO PASSA PELA MESMA PORTA ──────────────────────────
  // No Modo Fácil um arquivo compartilhado projeta na hora, sem perguntar nada.
  // É por aí que uma apresentação de fato entra ali, e é o caminho que uma
  // guarda escrita nas TELAS (em vez de no `send`) deixaria de fora.
  const compartilhado = await pg.evaluate(async (o) => {
    setAppMode('simple');
    await send(o.audio);
    await new Promise((r) => setTimeout(r, 150));
    // `focarImportado` é o que o share chama depois de gravar o registro; no
    // Modo Fácil ele projeta na hora.
    await focarImportado(o.deck);
    await new Promise((r) => setTimeout(r, 250));
    return { camada: visualSobreProjetando(), emCena: currentId };
  }, ids);
  checar(!compartilhado.camada && compartilhado.emCena === ids.deck,
    'O COMPARTILHAMENTO passa pela MESMA porta: a guarda mora no `send`, que é '
    + 'por onde TODOS os caminhos passam — uma lista de telas envelheceria no '
    + 'primeiro caminho novo', compartilhado);
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
