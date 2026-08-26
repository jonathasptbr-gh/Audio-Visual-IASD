// EXCLUIR DE UMA LISTA NÃO PODE DERRUBAR A CENA (v1.3.13).
//
// ## O relato
//
// *"Ao apagar um item do cronograma (e provavelmente em outras listas) enquanto
// ele está em execução, o item interrompe sua execução. Verifique, pois onplayer
// também deveria ser um elemento que mantém a existência de um item no
// sistema."*
//
// ## Eram DOIS defeitos, e o segundo é o silencioso
//
//  1. **`retirarDoAr` no caminho de excluir.** Uma linha que PARAVA a projeção
//     antes de mexer na lista. A dica do próprio botão é o contrato, e ela fala
//     de LISTA (*"tirar isto desta lista"*); parar a cena tem botão próprio (o
//     segundo toque na linha) e não podia vir de carona. A FILA já fazia o
//     certo desde a v5.309, com o motivo escrito — este caminho é que destoava.
//
//  2. **O coletor só conhecia LISTAS.** `listRemove` pergunta se algum outro
//     detentor aponta o id e, não achando nenhum, apaga os bytes na MESMA
//     transação. Estar NO AR não era detenção nenhuma. Corrigir só o item 1
//     deixaria a cena tocando com os bytes já apagados por baixo — e isso **não
//     tem sintoma**: o `<video>` já os tem, e a projeção segue. Só uma queda de
//     dongle revelaria (o `resendSceneToDisplay` chama `getMedia`, que não
//     acharia mais nada), no meio do culto, sem nada que ligasse uma coisa à
//     outra.
//
// Daí este arquivo medir as DUAS: que a cena continua ANDANDO (não só "não
// pausou") e que o REGISTRO sobrevive.
//
// ## E a terceira metade, que é a que impede a correção de virar outro defeito
//
// Excluir continua sendo uma DECLARAÇÃO DE INTENÇÃO: um item que NÃO está em
// cena tem de morrer de verdade. Uma "correção" que simplesmente parasse de
// coletar passaria nas duas primeiras e transformaria o aparelho num depósito.
//
//   node tools/excluir-em-cena.test.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml',
};
const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const arquivo = path.join(RAIZ, p);
  if (!arquivo.startsWith(RAIZ) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
    res.writeHead(404); res.end('nao'); return;
  }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream' });
  fs.createReadStream(arquivo).pipe(res);
});

const falhas = [];
function checar(cond, msg, obtido) {
  if (cond) console.log('ok      ' + msg);
  else {
    console.log('FALHOU  ' + msg + (obtido !== undefined ? '\n        obtido: ' + JSON.stringify(obtido) : ''));
    falhas.push(msg);
  }
}

// WAV de 20 s pelo motivo de sempre: uma faixa que acabe no meio do teste
// responde `paused:true` por ter TERMINADO, indistinguível de interrompida.
const SEMEAR = `
  const sr = 8000, secs = 20, n = sr * secs;
  const wav = () => {
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
  const emCena = await AVDB.addMedia(wav(), { name: 'Louvor Em Cena', type: 'audio/wav', kind: 'audio', list: 'imports' });
  const parado = await AVDB.addMedia(wav(), { name: 'Louvor Parado', type: 'audio/wav', kind: 'audio', list: 'imports' });
`;

await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await chromium.launch({
  ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const ctx = await navegador.newContext({ viewport: { width: 412, height: 892 } });
await semRedeExterna(ctx);
const pg = await ctx.newPage();
const erros = [];
pg.on('pageerror', (e) => erros.push(e.message));

// O EXCLUIR PELO CAMINHO DO OPERADOR, e ele tem TRÊS toques: o `⋮` que abre a
// gaveta da linha, a lixeira lá dentro, e o "Excluir" da confirmação que ela
// abre NA PRÓPRIA FAIXA (v5.301). Chamar `aoConfirmar` por dentro pularia
// justamente a confirmação, que é onde a ação mora.
const excluirPelaLinha = async (nome) => pg.evaluate((n) => {
  const li = [...document.querySelectorAll('.lib-item')]
    .find((e) => (e.textContent || '').includes(n));
  if (!li) return 'linha não encontrada';
  const mais = li.querySelector('.row-mais');
  if (!mais) return 'o `⋮` da linha não existe';
  mais.click();                                   // 1. abre a gaveta
  const lixo = li.querySelector('.row-excluir');
  if (!lixo) return 'a lixeira não está na gaveta';
  lixo.click();                                   // 2. pede a exclusão
  const sim = li.querySelector('.linha-confirma-btn.linha-sim');
  if (!sim) return 'a confirmação não apareceu na faixa';
  sim.click();                                    // 3. confirma
  return '';
}, nome);

try {
  await pg.goto(base + '/controle/', { waitUntil: 'load' });
  await pg.waitForFunction(
    () => window.AVDB && typeof window.__avBack === 'function' && !!document.querySelector('#playlist li'),
    null, { timeout: 25000 },
  );
  const ids = await pg.evaluate(new Function('return (async () => {'
    + 'setAppMode("full");' + SEMEAR + 'await load(); return { emCena: emCena.id, parado: parado.id }; })()'));

  // ── O PONTO DE PARTIDA: uma coisa tocando de verdade ────────────────────
  //
  // O "Louvor Parado" é TOCADO PRIMEIRO, de propósito: é ele que exercita o
  // risco que esta correção introduz. Com o player virando detentor, todo item
  // que entrou em cena passa a estar na prateleira `avulsos` — e um item que
  // JÁ TOCOU e foi excluído depois precisa morrer do mesmo jeito. Sem esta
  // passagem, a metade 3 mediria um item que nunca esteve na prateleira, e
  // aprovaria uma correção que simplesmente parasse de coletar.
  await pg.evaluate((id) => send(id), ids.parado);
  await pg.waitForTimeout(250);
  await pg.evaluate((id) => send(id), ids.emCena);
  await pg.waitForFunction(() => {
    const v = document.querySelector('#preview video') || document.querySelector('video');
    return !!v && !v.paused && v.currentTime > 0.2;
  }, null, { timeout: 15000 }).catch(() => {});
  const espiar = () => pg.evaluate(() => {
    const v = document.querySelector('#preview video') || document.querySelector('video');
    return { pausado: v ? v.paused : null, tempo: v ? v.currentTime : null, atual: currentId };
  });
  const a = await espiar();
  checar(!a.pausado && a.tempo > 0 && a.atual === ids.emCena,
    'o louvor está tocando (ponto de partida)', a);

  // ── 1. EXCLUIR DO CRONOGRAMA NÃO INTERROMPE A CENA ──────────────────────
  const erro1 = await excluirPelaLinha('Louvor Em Cena');
  checar(erro1 === '', 'o caminho do operador existe: `⋮` → lixeira → Excluir', erro1);
  await pg.waitForTimeout(400);
  const b1 = await espiar();
  await pg.waitForTimeout(900);
  const b2 = await espiar();
  checar(!b2.pausado && b2.tempo > b1.tempo + 0.4,
    'depois de excluir, o louvor NÃO PAROU e CONTINUA ANDANDO — "não pausou" '
    + 'sozinho é fraco; andar prova que é a mesma faixa', { b1: b1.tempo, b2: b2.tempo });
  const saiuDaLista = await pg.evaluate(
    () => ![...document.querySelectorAll('.lib-item')].some((e) => (e.textContent || '').includes('Louvor Em Cena')),
  );
  checar(saiuDaLista, 'e ele SAIU da lista — o que se pediu de fato aconteceu');

  // ── 2. E OS BYTES SOBREVIVEM (a metade sem sintoma) ─────────────────────
  //
  // É o que uma queda de dongle precisaria: `resendSceneToDisplay` chama
  // `getMedia`, e sem detentor o registro já teria sido coletado na mesma
  // transação do `listRemove`.
  const rec = await pg.evaluate(async (id) => {
    const r = await AVDB.getMedia(id);
    return { existe: !!r, temBytes: !!(r && (r.blob || r.opfsPath || r.url)) };
  }, ids.emCena);
  checar(rec.existe && rec.temBytes,
    'o REGISTRO sobrevive: estar no ar segura o item, como uma lista segura', rec);
  const naPrateleira = await pg.evaluate(async (id) => (await AVDB.listIds('avulsos')).includes(id), ids.emCena);
  checar(naPrateleira,
    'e quem o segura é a prateleira `avulsos` — a mesma que o "Tocar agora" usa', naPrateleira);

  // ── 3. O QUE NÃO ESTÁ EM CENA MORRE DE VERDADE ─────────────────────────
  //
  // A metade que impede a correção de virar outro defeito: parar de coletar
  // passaria nas duas de cima e transformaria o aparelho num depósito.
  const erro3 = await excluirPelaLinha('Louvor Parado');
  checar(erro3 === '', 'a linha do item parado percorre o mesmo caminho', erro3);
  await pg.waitForTimeout(500);
  const morto = await pg.evaluate(async (id) => ({
    registro: !(await AVDB.getMedia(id)),
    prateleira: !(await AVDB.listIds('avulsos')).includes(id),
  }), ids.parado);
  checar(morto.registro && morto.prateleira,
    'um item que JÁ TOCOU e não está mais em cena é coletado — excluir continua '
    + 'sendo uma declaração de intenção, e ela vale para a prateleira também', morto);

  checar(erros.length === 0, 'nenhum erro de página', erros);
} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) {
  console.log('\n' + falhas.length + ' falha(s).');
  process.exit(1);
}
console.log('\nTodos passaram.');
