#!/usr/bin/env node
// A TROCA DE VERSÍCULO CRUZA DEVAGAR (v1.13.11).
//
// Pedido do operador: *"a alteração entre slides dos textos bíblicos está muito
// instantânea… mais suave… ligeiramente mais devagar"*. O cartão já em cena
// escrevia o texto novo no ato e o fazia surgir em 260 ms: o antigo SUMIA num
// quadro. Agora o antigo esmaece, e o novo entra devagar
// (`createStage.trocarTextoSuave`), no telão e na preview.
//
// O que se mede, no Display de verdade:
//  A. logo depois da troca o texto ANTIGO ainda está lá, esmaecendo — não houve corte;
//  B. ele chega perto de zero ANTES de o novo ser escrito, e o novo termina inteiro;
//  C. a troca toda leva bem mais que os 260 ms de antes;
//  D. numa RAJADA (três versículos seguidos) quem fica é o último;
//  E. o PAR: a MENSAGEM continua trocando na hora — o pedido é da Bíblia.
//
//   node tools/troca-de-versiculo.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, RAIZ_WEB, abrirNavegador, checar, falhas, esperar, porque } from './arnes.mjs';

const ESPIAO = '/__espiao.html';
const srv = servirEstatico(RAIZ_WEB, (req, res) => {
  if (req.url !== ESPIAO) return false;
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<!doctype html><meta charset="utf-8"><title>espiao</title>');
  return true;
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${srv.address().port}`;

const navegador = await abrirNavegador();
const ctx = await navegador.newContext({ viewport: { width: 960, height: 540 } });
await semRedeExterna(ctx);
const espiao = await ctx.newPage();
await espiao.goto(base + ESPIAO);
await espiao.evaluate(() => {
  window.__bc = new BroadcastChannel('av-iasd');
  window.__mandar = (cmd) => window.__bc.postMessage(cmd);
});
const tv = await ctx.newPage();

const verso = (main, sub) => ({ type: 'text', main, sub, view: 'visual' });
const mandar = (cmd) => espiao.evaluate((c) => window.__mandar(c), cmd);
const ler = () => tv.evaluate(() => document.getElementById('textMain').textContent);

try {
  await tv.goto(base + '/display/');
  let r = await esperar(tv, () => !!window.AVDB && !!document.getElementById('textMain'));
  checar(r === true, 'o Display subiu', porque(r));
  await mandar(verso('No princípio era o Verbo', 'João 1:1'));
  r = await esperar(tv, () => document.getElementById('textMain').textContent === 'No princípio era o Verbo');
  checar(r === true, 'premissa: o primeiro versículo entrou', porque(r));
  // A camada termina de entrar antes de a troca ser medida.
  await tv.waitForTimeout(700);

  // A AMOSTRAGEM é por quadro, do lado da página: texto e opacidade juntos.
  await tv.evaluate(() => {
    const el = document.getElementById('textMain');
    window.__am = [];
    const t0 = performance.now();
    const tick = () => {
      window.__am.push({ t: performance.now() - t0, txt: el.textContent, op: +getComputedStyle(el).opacity });
      if (performance.now() - t0 < 2000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await mandar(verso('e o Verbo estava com Deus', 'João 1:1'));
  await tv.waitForTimeout(2100);
  const am = await tv.evaluate(() => window.__am);
  const primeiroNovo = am.findIndex((a) => a.txt === 'e o Verbo estava com Deus');
  const antigos = am.slice(0, primeiroNovo);
  const menorAntigo = Math.min(...antigos.map((a) => a.op));
  checar(primeiroNovo > 0 && antigos.some((a) => a.op < 0.95 && a.op > 0.05),
    'A · o versículo ANTIGO esmaece na tela antes de sair (não há corte)', { primeiroNovo, menorAntigo });
  checar(menorAntigo < 0.15, 'B · ele chega perto de zero ANTES de o novo ser escrito', menorAntigo);
  const fim = am[am.length - 1];
  checar(fim && fim.txt === 'e o Verbo estava com Deus' && fim.op > 0.99,
    'B · e o novo termina inteiro e opaco', fim);
  const cheio = am.find((a, i) => i >= primeiroNovo && a.op > 0.99);
  const tTroca = cheio ? cheio.t - (antigos.find((a) => a.op < 0.99) || am[0]).t : 0;
  checar(tTroca >= 600, 'C · a troca inteira leva mais de 0,6 s (era 0,26 s)', Math.round(tTroca));

  // D. A RAJADA: só a última fica.
  await mandar(verso('Um', 'A 1'));
  await mandar(verso('Dois', 'A 2'));
  await mandar(verso('Três', 'A 3'));
  r = await esperar(tv, () => {
    const el = document.getElementById('textMain');
    return el.textContent === 'Três' && +getComputedStyle(el).opacity > 0.99;
  }, null, 4000);
  checar(r === true, 'D · três versículos seguidos: fica o ÚLTIMO, inteiro', porque(r) || await ler());
  await tv.waitForTimeout(900);
  const sub = await tv.evaluate(() => document.getElementById('textSub').textContent);
  checar(await ler() === 'Três' && sub === 'A 3', 'D · e nenhuma troca atrasada escreve por cima dele', { txt: await ler(), sub });

  // E. O PAR: a mensagem troca na hora, como sempre.
  await mandar({ type: 'text', mode: 'message', main: 'Aviso 1', sub: '', view: 'visual' });
  r = await esperar(tv, () => document.getElementById('textMain').textContent === 'Aviso 1', null, 4000);
  checar(r === true, 'premissa: a mensagem entrou', porque(r));
  await mandar({ type: 'text', mode: 'message', main: 'Aviso 2', sub: '', view: 'visual' });
  r = await esperar(tv, () => document.getElementById('textMain').textContent === 'Aviso 2', null, 150);
  checar(r === true, 'E · a MENSAGEM continua trocando no ato (o pedido é da Bíblia)', porque(r));
} catch (e) {
  checar(false, 'o percurso terminou sem exceção (' + (e && e.message) + ')');
}

// A PREVIEW usa a MESMA função, pela MESMA régua — lida no próprio controle.js.
const JS = fs.readFileSync(path.join(RAIZ_WEB, 'controle', 'controle.js'), 'utf8');
checar(/createStage\.trocarTextoSuave\(\[pvTextMainEl, pvTextSubEl\]/.test(JS)
  && /pvTextModo === 'verse' && modo === 'verse'/.test(JS),
  'a preview troca o versículo pela mesma função e pela mesma régua do telão');

await navegador.close();
srv.close();
if (falhas.length) {
  console.log(`\n${falhas.length} falha(s).`);
  process.exit(1);
}
console.log('\nTodos passaram.');
