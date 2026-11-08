// O ACK ATRASADO DO CANAL DE MÍDIA NÃO RESOLVE O BLOCO SEGUINTE.
//
// ## Por que este teste existe
//
// O empurrão da mídia para as telas da rede é serializado: um bloco por vez, e
// cada bloco só termina quando o shell responde `{r: total}` — o total
// CUMULATIVO de bytes daquele token, não "recebi o seu". O `telaPedir` solta a
// promessa depois de 15 s (`resolve(null)`) mas NÃO cancela a resposta, e a
// resposta de um bloco vencido chegava depois, encontrava o pedido SEGUINTE
// pendente e o resolvia com o total de ANTES.
//
// O estrago, medido no código: `pos = r.r` voltava, o bloco já gravado era
// reenviado, e o `EspelhoMidiaCache.escrever` (que posiciona em `recebido` e
// ANEXA) punha os mesmos bytes no FIM do arquivo. O item ia ao telão MAIOR que
// a fonte e o `fim` ainda o marcava completo. Não é hipótese: é o que o
// comentário antigo do `telaRespostaCombina` chamava de "cobertura parcial".
//
// ## O que este oráculo mede
//
// O `telaPedir` aceita um predicado de conteúdo (`aceita`), e o `bloco` o usa
// para conferir `r === pos + bytes`. As três metades, e nenhuma basta sozinha:
//
//  1. O DEFEITO, na forma antiga: sem predicado, o ACK atrasado RESOLVE o
//     pedido — é o que prova que a asserção 2 não é tautologia.
//  2. Com o predicado, o mesmo ACK atrasado é DESCARTADO e o verdadeiro vence.
//  3. A recusa (`{r:-1}`) e o erro de fila cheia (que não têm `r`) continuam
//     resolvendo — senão o conserto travaria o empurrão de verdade.
//
//   node tools/tela-ack-cumulativo.test.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, checar, falhas } from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);

await new Promise((r) => servidor.listen(0, r));
const navegador = await abrirNavegador();
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);
const pg = await ctx.newPage();

try {
  await pg.goto('http://localhost:' + servidor.address().port + '/controle/', { waitUntil: 'domcontentloaded' });
  // Esperar pelo FATO (o app de pé), nunca por um prazo — a mesma condição do
  // watchdog de boot do OTA.
  await pg.waitForFunction(
    () => window.AVDB && typeof window.__avBack === 'function' && (!!document.querySelector('#playlist li') || document.getElementById('plBtn').disabled),
    null, { timeout: 30000 },
  );

  // ── 1 e 2. O ACK ATRASADO, SEM E COM O PREDICADO ──────────────────────────
  const ack = await pg.evaluate(async () => {
    const PASSO = 512 * 1024;
    const bloco = new Uint8Array(PASSO).buffer;
    // Uma ponta faz de SHELL: ao receber o bloco, responde primeiro o total de
    // ANTES (o ACK do bloco vencido) e depois o total deste.
    const canal = () => {
      const { port1, port2 } = new MessageChannel();
      let total = 0;
      port2.onmessage = () => {
        total += PASSO;
        port2.postMessage(JSON.stringify({ r: total - PASSO }));   // o atrasado
        port2.postMessage(JSON.stringify({ r: total }));           // o verdadeiro
      };
      telaOuvirCanal(port1);
      return port1;
    };
    // A FORMA ANTIGA: sem predicado, quem resolve é a PRIMEIRA resposta que
    // casar por forma — e a atrasada casa.
    const semPredicado = await telaPedir(canal(), bloco, 'bloco');
    // A FORMA NOVA, com a conferência do cumulativo que o chamador monta.
    const esperado = PASSO;
    const comPredicado = await telaPedir(canal(), bloco, 'bloco',
      (x) => typeof x.r !== 'number' || x.r < 0 || x.r === esperado);
    return { semPredicado: semPredicado && semPredicado.r, comPredicado: comPredicado && comPredicado.r, esperado };
  });
  checar(ack.semPredicado === 0,
    'sem o predicado, o ACK do bloco vencido RESOLVE o seguinte (o defeito)', JSON.stringify(ack));
  checar(ack.comPredicado === ack.esperado,
    'com o predicado, o mesmo ACK atrasado é descartado e o verdadeiro vence', JSON.stringify(ack));

  // ── 3. A RECUSA E A FILA CHEIA CONTINUAM RESOLVENDO ───────────────────────
  // Sem estas, o conserto poderia "passar" acima e travar o empurrão real: os
  // dois desfechos legítimos do shell não carregam um total.
  const erros = await pg.evaluate(async () => {
    const PASSO = 512 * 1024;
    const bloco = new Uint8Array(PASSO).buffer;
    const esperado = PASSO;
    const aceita = (x) => typeof x.r !== 'number' || x.r < 0 || x.r === esperado;
    const comResposta = (json) => {
      const { port1, port2 } = new MessageChannel();
      port2.onmessage = () => { port2.postMessage(JSON.stringify(json)); };
      telaOuvirCanal(port1);
      return port1;
    };
    const recusa = await telaPedir(comResposta({ r: -1 }), bloco, 'bloco', aceita);
    const cheia = await telaPedir(comResposta({ ok: false, erro: 'fila cheia' }), bloco, 'bloco', aceita);
    return { recusa: recusa && recusa.r, cheia: cheia && cheia.erro };
  });
  checar(erros.recusa === -1, 'a recusa do shell ({r:-1}) continua resolvendo o pedido', JSON.stringify(erros));
  checar(erros.cheia === 'fila cheia', 'o erro de fila cheia continua resolvendo o pedido', JSON.stringify(erros));
} catch (e) {
  checar(false, 'o percurso terminou sem exceção (' + (e && e.message) + ')');
}

await navegador.close();
servidor.close();
console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
