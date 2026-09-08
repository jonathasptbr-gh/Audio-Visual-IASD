#!/usr/bin/env node
// ============================================================================
// O TÍTULO DE UMA COLEÇÃO NÃO SE MEXE AO ABRIR A LISTA
//
// ## O defeito que ele trava
//
// Relato do operador (v1.8.50): *"na biblioteca, o título das coleções se move
// ao abrir a lista de álbuns e itens. Como se o tamanho do card da coleção faz
// ele ser redimensionado, alterando sua posição vertical em relação ao card do
// corpo… verifique o sistema para que uma vez medido, os itens fiquem alinhados
// durante as interações."*
//
// MEDIDO a 430×900 com 6 coleções: abrindo uma delas, o título DELA saltava de
// 24,0px para 34,4px do topo do próprio card — 10,4px, no instante do toque e
// no único elemento que o olho estava seguindo.
//
// ## A causa: metade de um vão
//
//   · FECHADO, o bloco tem `height: var(--tampa-h)` (a altura de encaixe que o
//     `medirTampa` calcula) e CENTRA a barra dentro dela — o respiro acima é
//     `(tampa − barra) / 2`;
//   · ABERTO, a folha compensava com o vão INTEIRO (`--tampa-h − --bar-secao-h`)
//     num respiro só, em cima. A barra descia a diferença toda, e o título com
//     ela.
//
// **E O VÃO INTEIRO NÃO ERA GRATUITO**, o que é a parte que faz este oráculo
// não bastar sozinho: era ele que mantinha a OUTRA invariante, a da v1.5.19 —
// a TAMPA de um bloco (do topo dele até onde o corpo começa) medindo o mesmo
// fechada e aberta, que o `lista-da-biblioteca.test.mjs` cobra. Mover metade do
// vão para cima sem pôr a outra metade embaixo faz a tampa ENCOLHER 4,74px, que
// é o defeito exato daquela versão. **As duas só se resolvem juntas**, e a
// solução é o bloco aberto REPRODUZIR a caixa fechada: metade do vão acima da
// barra, metade abaixo. Os dois oráculos são as duas metades da mesma regra, e
// mexer aqui pede rodar aquele — e o `smoke.mjs` junto, que foi quem reprovou a
// tentativa de estender a regra à SEÇÃO (lá o corpo traz `.35rem` de vão por
// dentro, e forçar a mesma conta pede margem negativa: −5px de vão dentro da
// coleção, o corpo subindo por cima da própria barra). A seção fica com a
// compensação de sempre, e o relato é quem decide: o título dela andava 0,86px,
// o de um card andava 10,4.
//
// ## O que ele mede, e por que a segunda metade existe
//
//  1. **O TÍTULO DO BLOCO ABERTO NÃO ANDA** — é o relato, no elemento que o
//     operador nomeia.
//  2. **OS TÍTULOS DOS IRMÃOS TAMBÉM NÃO** — abrir um bloco muda `--tampa-h`
//     para a lista inteira, e um conserto que só olhasse o aberto empurraria as
//     outras coleções em troca.
//  3. **FECHAR DEVOLVE TUDO AO LUGAR** — o respiro é RECOMPOSTO a cada render,
//     e não uma coordenada guardada. Sem esta metade, um conserto de mão única
//     (escrever o respiro e nunca revisá-lo) passaria nas duas primeiras e
//     deixaria o vão pendurado sobre uma barra que já voltou ao tamanho natural
//     — que é a classe de defeito que o `--tampa-h` teve na v1.5.3.
//
//   node tools/titulo-da-colecao-nao-anda.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperarCortina, esperar, porque, checar, falhas } from './arnes.mjs';

// SEIS PASTAS, que a leitura editorial das coletâneas junta em DOIS álbuns —
// mais a seção dos Favoritos, que é o terceiro bloco de raiz. É o suficiente:
// o defeito é a diferença entre a tampa medida e a barra nua, e com `--tampa-h`
// no teto (66px contra os 45,2 da barra) ele aparece inteiro. MEDIDO neste
// mesmo cenário, o título saltava 24,0 → 34,4.
const SEMEAR = `
  const bytes = (n) => new Blob([new Uint8Array(n).fill(7)], { type: 'audio/mp4' });
  for (let c = 1; c <= 6; c++) {
    for (let i = 1; i <= 3; i++) {
      const cam = 'folders/col' + c + '/' + i + '.m4a';
      await AVDB.opfsWriteFile(cam, bytes(64));
      await AVDB.fileAdd({
        id: 'c' + c + 'i' + i, folder: 'col' + c, opfsPath: cam, srcName: String(i),
        name: 'Faixa ' + i, type: 'audio/mp4', kind: 'audio', size: 64,
        thumb: null, blob: null, url: null, addedAt: 1,
      });
    }
  }
`;

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);

await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador();
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true });
await semRedeExterna(ctx);
const pg = await ctx.newPage();

// A DISTÂNCIA DO TÍTULO AO TOPO DO PRÓPRIO CARD — é o que o olho segue, e é o
// que o relato descreve. Medir a posição na TELA misturaria o deslize das
// vizinhas; o que o operador vê é o título andando DENTRO da caixa dele.
const medir = () => pg.evaluate(() => [...document.querySelectorAll('#hymnResults > li')]
  .map((li, i) => {
    // O NOME de um álbum, ou a barra da seção dos Favoritos — os dois são o
    // "título da coleção" do relato, e o índice é do DOM para as duas leituras
    // casarem bloco a bloco.
    const nome = li.querySelector('.coll-bar-name, .coll-bar b, .coll-group-bar');
    const rl = li.getBoundingClientRect();
    const rn = nome ? nome.getBoundingClientRect() : null;
    return {
      i,
      t: (nome && nome.textContent || '').trim().slice(0, 14),
      aberto: li.classList.contains('expanded') || li.classList.contains('aberto'),
      dentro: rn ? +(rn.top - rl.top).toFixed(1) : null,
    };
  }));

try {
  await pg.goto(base + '/controle/', { waitUntil: 'load' });
  await pg.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function', null, { timeout: 30000 });
  await esperarCortina(pg);
  await pg.evaluate(new Function('return (async () => { setAppMode("full");' + SEMEAR + 'await load(); openHymnSearch(); })()'));

  // A LISTA MEDIDA é o FATO que a medição espera — `medirTampa` roda num
  // `requestAnimationFrame` depois da montagem, e ler antes dele leria a lista
  // sem tampa nenhuma.
  const pronta = await esperar(pg, () => {
    const l = document.getElementById('hymnResults');
    return !!l && l.children.length >= 3 && !!l.style.getPropertyValue('--tampa-h');
  }, null, 10000);
  checar(pronta === true, 'a Biblioteca abre com os blocos de raiz MEDIDOS', porque(pronta));

  const antes = await medir();
  checar(antes.length >= 3 && antes.every((r) => !r.aberto && r.dentro !== null),
    'e todos nascem FECHADOS, com um título a medir — a linha de base',
    antes.map((r) => r.t + ':' + r.dentro));

  // ── 1. O TÍTULO DO BLOCO ABERTO ─────────────────────────────────────────
  await pg.evaluate(() => document.querySelectorAll('#hymnResults > li')[1].click());
  const abriu = await esperar(pg, () => {
    const li = document.querySelectorAll('#hymnResults > li')[1];
    return li.classList.contains('expanded') || li.classList.contains('aberto');
  }, null, 5000);
  checar(abriu === true, 'a segunda coleção abre ao toque', porque(abriu));
  // A ANIMAÇÃO DO CORPO leva 220 ms; a tampa mudava em DOIS quadros. Espera-se
  // o FATO (a altura parar de mudar), nunca um prazo.
  const assentou = await esperar(pg, () => {
    const li = document.querySelectorAll('#hymnResults > li')[1];
    const h = li.getBoundingClientRect().height;
    const igual = window.__ultimaAltura === h;
    window.__ultimaAltura = h;
    return igual;
  }, null, 6000);
  checar(assentou === true, 'e o corpo dela termina de deslizar', porque(assentou));

  const depois = await medir();
  const alvoAntes = antes[1].dentro;
  const alvoDepois = depois[1].dentro;
  checar(Math.abs(alvoDepois - alvoAntes) <= 1,
    'O TÍTULO DA COLEÇÃO ABERTA NÃO SE MEXE: era o salto que o relato descreve, '
    + 'e ele acontecia no único elemento que o olho estava seguindo',
    { antes: alvoAntes, depois: alvoDepois });

  // ── 2. E OS IRMÃOS TAMBÉM NÃO ───────────────────────────────────────────
  // Abrir um bloco reescreve `--tampa-h` para a LISTA INTEIRA: um conserto que
  // só olhasse o aberto empurraria as outras cinco em troca.
  const irmaos = depois.map((r, i) => ({ i, t: r.t, de: antes[i].dentro, para: r.dentro }))
    .filter((r) => r.i !== 1);
  const andou = irmaos.filter((r) => Math.abs(r.para - r.de) > 1);
  checar(andou.length === 0,
    'e os títulos das coleções VIZINHAS ficam onde estavam — a tampa é uma '
    + 'medida da lista, não do bloco que foi tocado', andou);

  // ── 3. FECHAR DEVOLVE TUDO AO LUGAR ─────────────────────────────────────
  // O respiro é RECOMPOSTO a cada render, e não uma coordenada guardada. Um
  // conserto de mão única — escrevê-lo ao abrir e nunca revisá-lo — passaria nas
  // duas metades acima e deixaria o vão pendurado sobre uma barra que já voltou
  // ao tamanho natural.
  await pg.evaluate(() => document.querySelectorAll('#hymnResults > li')[1].click());
  const fechou = await esperar(pg, () => {
    const li = document.querySelectorAll('#hymnResults > li')[1];
    return !li.classList.contains('expanded') && !li.classList.contains('aberto');
  }, null, 5000);
  checar(fechou === true, 'a coleção fecha ao segundo toque', porque(fechou));
  await pg.evaluate(() => { window.__ultimaAltura = -1; });
  await esperar(pg, () => {
    const h = document.querySelectorAll('#hymnResults > li')[1].getBoundingClientRect().height;
    const igual = window.__ultimaAltura === h;
    window.__ultimaAltura = h;
    return igual;
  }, null, 6000);
  const volta = await medir();
  const desalinhados = volta.map((r, i) => ({ t: r.t, de: antes[i].dentro, para: r.dentro }))
    .filter((r) => Math.abs(r.para - r.de) > 1);
  checar(desalinhados.length === 0,
    'e TODOS os títulos voltam ao ponto de partida — o respiro é recomposto a '
    + 'cada render, nunca uma coordenada guardada', desalinhados);
} finally {
  await navegador.close();
  await new Promise((r) => servidor.close(r));
}

console.log(falhas.length ? '\n' + falhas.length + ' falha(s)' : '\ntudo certo');
process.exit(falhas.length ? 1 : 0);
