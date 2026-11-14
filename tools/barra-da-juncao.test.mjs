#!/usr/bin/env node
// ============================================================================
// A LEGENDA DA JUNÇÃO (v1.14.14) — o número que não anda enquanto o arquivo é
// montado.
//
// RELATO DO OPERADOR (2026-11-14): *"quando baixei manualmente, ficou muito
// tempo travado em 99%"* — e o texto dizia "Juntando vídeo e som". A fase é
// real e anda (o `MuxMp4` copia amostra por amostra), mas o INTEIRO do toque
// já chegou ao teto (99) quando ela começa; sem outro sinal, um trabalho vivo
// é indistinguível de um travado.
//
// O sinal existe e é do shell: `__avYtFase('juntando', {feito, total})`, a cada
// ~1 MB. O que este oráculo trava são as duas metades que o fazem chegar à
// tela:
//
//  A · o TIQUE avisa quando a FRAÇÃO muda, e não só quando o inteiro muda —
//      na junção o inteiro fica parado, e sem isto a legenda congela junto;
//  B · a LEGENDA troca o número do toque pela fração da junção nessa fase, e
//      volta ao número do toque quando ela acaba.
//
//   node tools/barra-da-juncao.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, checar, falhas } from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');

const servidor = servirEstatico(RAIZ);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador();
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);
const pg = await ctx.newPage();

try {
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(
    () => typeof novaBarraYt === 'function' && typeof legendaDoProgresso === 'function',
    null, { timeout: 20000 },
  );

  const r = await pg.evaluate(async () => {
    const b = novaBarraYt({ juncao: true });
    const vistos = [];
    b.ouvir((pct, fase, f) => vistos.push([pct, fase, f]));
    // Os bytes e a entrada na junção: o INTEIRO pode andar um pouco, e o que
    // interessa é o que acontece quando ele para e a fração continua.
    b.sinal('baixou', { bytes: 100 * 1048576, juntar: true });
    b.sinal('juntando', { feito: 10 * 1048576, total: 100 * 1048576 });
    await new Promise((ok) => setTimeout(ok, 150));
    const antes = vistos.length;
    b.sinal('juntando', { feito: 43 * 1048576, total: 100 * 1048576 });
    await new Promise((ok) => setTimeout(ok, 150));
    const depois = vistos.slice(antes);
    const comFracao = legendaDoProgresso('juncao', 99, false, 43);
    const semFracao = legendaDoProgresso('juncao', 99, false, null);
    const copia = legendaDoProgresso('copia', 99, false, null);
    b.abandonar();
    return { depois, comFracao, semFracao, copia };
  });

  checar(r.depois.length > 0 && r.depois.some((v) => v[2] === 43),
    'A · o TIQUE avisa quando a FRAÇÃO da junção muda, mesmo com o inteiro do toque '
    + 'parado no teto — é o único sinal de vida desta fase', JSON.stringify(r.depois));
  checar(/43% da junção/.test(r.comFracao),
    'B1 · e a legenda mostra a fração real ("43% da junção") em vez do 99 do toque, '
    + 'que já não quer dizer nada ali', r.comFracao);
  checar(/99%/.test(r.semFracao) && !/junção/.test(r.semFracao),
    'B2 · sem fração (o shell não mandou `juntando`), a legenda volta ao número do '
    + 'toque — o estado de antes não piora', r.semFracao);
  checar(/Guardando no aparelho · 99%/.test(r.copia),
    'B3 · e nas fases seguintes o número do toque volta: a troca de régua é só da junção', r.copia);
} finally {
  await navegador.close();
  await new Promise((r) => servidor.close(r));
}

console.log(falhas.length ? '\n' + falhas.length + ' falha(s)' : '\ntudo certo');
process.exit(falhas.length ? 1 : 0);
