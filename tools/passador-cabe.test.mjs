#!/usr/bin/env node
// A PÁGINA DO PASSADOR CABE NA TELA — slides e controles, sem rolar.
//
// O pedido do operador (2026-11-16) é literal: *"a altura máxima de slides +
// controles deve ser a altura disponível na tela… tudo visível sem ter de rolar
// a tela para nada"*. Ele abre a página no NAVEGADOR do celular, e a barra do
// navegador come altura — a conta é sempre com `innerHeight`, nunca com uma
// medida em `vh` escrita à mão.
//
// O MODO DE FALHAR É MUDO: nada quebra quando a coluna cresce 40 px; o
// resultado é o pregador rolando a tela no meio do sermão, e o defeito só
// aparece no aparelho dele. É por isso que ele vira oráculo, e é por isso que
// ele mede a ÁRVORE (as três seções abertas, o pé dos botões dentro da janela),
// e não um retângulo qualquer.
//
// DESDE A v1.14.61 (Pacote 46) O ESTADO MORA NO QUADRO CENTRAL: a pílula
// `#vazio` e o status `#estado` do topo não existem mais. O que este oráculo
// mede no estado vazio é a LINHA DO ESTADO dentro do cartão do meio — e a régua
// nova: ela não é dona da tela (≤ 12% da altura da janela), o título é o único
// texto fora do central, e a moldura do meio continua com a maior parte do
// cartão (o slide não é espremido pelo recado). Os três quadros e os três
// controles continuam montados.
//
// A página é servida de `file://`: o CSS é relativo e o que se mede é layout.
// O `passador.js` roda e falha ao parear (não há servidor aqui) — isso é
// esperado e não entra no veredito; é o que faz a linha da condição aparecer,
// que é justamente o pior caso de altura do estado vazio.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { checar, falhas } from './checar.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGINA = 'file://' + join(RAIZ, 'app/src/main/assets/web/passador-de-slides/index.html');

// As telas que um celular de operador tem HOJE, com a barra do navegador já
// descontada pelo `dvh`: a mais baixa é a que aperta (320×568 = iPhone SE).
const TELAS = [[320, 568], [360, 540], [360, 640], [390, 844], [412, 915]];

const navegador = await chromium.launch();
for (const [w, h] of TELAS) {
  const pg = await navegador.newPage({ viewport: { width: w, height: h } });
  // O `passador.js` tenta `fetch`/SSE e enche o console de erro de rede: o
  // ruído é do teste, não da página.
  pg.on('pageerror', () => {});
  await pg.goto(PAGINA, { waitUntil: 'domcontentloaded' });
  // A LINHA DO ESTADO DO CENTRAL APARECE MESMO (a falha do pareamento em
  // `file://` a liga): é o pior caso de altura, e é ele que tem de caber.
  await pg.waitForFunction(() => {
    const e = document.getElementById('estadoCentral');
    return !!e && !e.hidden;
  }, null, { timeout: 5000 }).catch(() => {});

  const m = await pg.evaluate(() => {
    // O estado "NO AR", que é o que tem os três cartões e os botões. O caminho
    // normal de quem chega sem apresentação é o inativo — que também tem de
    // caber, e por isso ele é medido antes de ser escondido.
    //
    // DESDE A v1.14.60 o inativo NÃO esconde mais os quadros nem os controles:
    // ele desenha a espera nos três e deixa os botões no lugar. As medidas
    // abaixo são as do estado que o irmão vê antes de o operador projetar.
    const janela = window.innerHeight;
    const r = (id) => document.getElementById(id).getBoundingClientRect();
    const cabeInativo = document.body.scrollHeight <= janela + 1;
    const visivel = (el) => !!el && getComputedStyle(el).display !== 'none';
    const estado = document.getElementById('estadoCentral');
    const esperas = [...document.querySelectorAll('.moldura .espera')]
      .filter((e) => visivel(e) && e.getBoundingClientRect().height > 0).length;
    // NENHUM `<img>` SEM CARGA À VISTA: é o ícone de imagem quebrada que o
    // operador viu nos três quadros.
    const quebradas = [...document.querySelectorAll('.cartao img')]
      .filter((i) => visivel(i) && !(i.complete && i.naturalWidth > 0)).length;
    const semSrcVisivel = [...document.querySelectorAll('.cartao img')]
      .filter((i) => visivel(i) && !i.getAttribute('src')).length;
    // O TEXTO FORA DO QUADRO CENTRAL: só o título. A varredura é a mesma do
    // `passador-espera`, reduzida ao que este oráculo precisa (estar no lugar).
    const central = document.getElementById('cartaoAtual');
    const fora = [];
    const caminhante = document.createTreeWalker(document.getElementById('app'), NodeFilter.SHOW_TEXT);
    let n;
    while ((n = caminhante.nextNode())) {
      const t = n.nodeValue.replace(/\s+/g, ' ').trim();
      if (!t || !visivel(n.parentElement)) continue;
      if (central.contains(n.parentElement)) continue;
      fora.push(t);
    }
    const molduraCentral = central.querySelector('.moldura').getBoundingClientRect();
    const leitura = {
      janela,
      doc: document.documentElement.scrollHeight,
      corpo: document.body.scrollHeight,
      inativoCabe: cabeInativo && r('acoes').bottom <= janela + 1,
      topoTexto: fora,
      estadoTexto: estado.textContent.replace(/\s+/g, ' ').trim(),
      estadoDentroDoCentral: central.contains(estado),
      estadoAltura: Math.round(estado.getBoundingClientRect().height),
      estadoFracao: +(estado.getBoundingClientRect().height / janela).toFixed(3),
      cartoesAbertos: !document.getElementById('cartoes').hidden,
      acoesAbertas: !document.getElementById('acoes').hidden,
      acoesFim: Math.round(r('acoes').bottom),
      acoesAltura: Math.round(r('acoes').height),
      esperas,
      quebradas,
      semSrcVisivel,
      molduraDoMeio: Math.round(molduraCentral.height),
    };
    document.getElementById('cartoes').hidden = false;
    document.getElementById('acoes').hidden = false;
    return Object.assign(leitura, {
      meio: Math.round(r('cartaoAtual').height),
      ant: Math.round(r('cartaoAnt').height),
      prox: Math.round(r('cartaoProx').height),
      cartoes: Math.round(r('cartoes').height),
    });
  });
  const tela = `${w}×${h}`;
  checar(m.inativoCabe, `${tela}: o estado inativo (sem apresentação) cabe sem rolar`,
    `corpo ${m.corpo} > janela ${m.janela}`);
  // O ESTADO É UMA LINHA, DENTRO DO QUADRO CENTRAL (v1.14.61): nem pílula no
  // topo, nem status no cabeçalho. A régua de 12% da tela continua: o recado
  // não é dono da tela.
  checar(m.estadoDentroDoCentral && m.estadoTexto.length > 0,
    `${tela}: a condição de conexão está DENTRO do quadro central`,
    { dentro: m.estadoDentroDoCentral, texto: m.estadoTexto });
  checar(m.estadoFracao <= 0.12,
    `${tela}: a linha do estado é uma linha, não um bloco (≤ 12% da tela)`,
    `${m.estadoAltura} px de ${m.janela} = ${(m.estadoFracao * 100).toFixed(1)}%`);
  // FORA DO CENTRAL SÓ O TÍTULO E OS RÓTULOS DOS CONTROLES (v1.14.61): o
  // estado não mora mais aqui. O título é RÓTULO da página, e ◀ ▶ Cortina são
  // AÇÃO — nenhum dos dois é estado, e os três controles são obrigatórios.
  const doControle = ['◀', '▶', 'Cortina', 'Cortina ligada'];
  // EM TELA CURTA O TÍTULO SAI (a `@media (max-height: 620px)` da folha); o que
  // NUNCA sai são os rótulos dos controles.
  checar(m.topoTexto.length > 0
    && m.topoTexto.every((t) => t === 'Passador' || doControle.includes(t)),
    `${tela}: fora do quadro central só o título e os rótulos dos controles`,
    m.topoTexto);
  checar(m.molduraDoMeio >= m.meio * 0.55,
    `${tela}: o recado não espreme o slide — a moldura do meio fica com a maior parte do cartão`,
    `moldura ${m.molduraDoMeio} de ${m.meio}`);
  checar(m.cartoesAbertos && m.acoesAbertas,
    `${tela}: no vazio, os três quadros E os controles continuam montados`,
    { cartoes: m.cartoesAbertos, acoes: m.acoesAbertas });
  checar(m.esperas === 3, `${tela}: os três quadros DESENHAM a espera`,
    `${m.esperas} de 3`);
  // O defeito que o operador viu: quadro preto com o ícone de imagem quebrada.
  checar(m.quebradas === 0 && m.semSrcVisivel === 0,
    `${tela}: nenhuma prévia quebrada e nenhum \`img\` sem \`src\` à vista`,
    { quebradas: m.quebradas, semSrcVisivel: m.semSrcVisivel });
  checar(m.doc <= m.janela + 1 && m.corpo <= m.janela + 1 && m.acoesFim <= m.janela + 1,
    `${tela}: slides + controles cabem na janela, sem barra de rolagem`,
    `doc ${m.doc} · corpo ${m.corpo} · fim dos botões ${m.acoesFim} · janela ${m.janela}`);
  checar(m.meio > m.ant && m.meio > m.prox,
    `${tela}: o cartão do meio é o MAIOR (o que está no telão)`,
    `meio ${m.meio} · anterior ${m.ant} · próximo ${m.prox}`);
  // O rodapé não pode virar o dono da tela: os três cartões precisam dela.
  checar(m.acoesAltura <= m.janela * 0.3,
    `${tela}: os botões são um rodapé, não a maior parte da tela`,
    `rodapé ${m.acoesAltura} de ${m.janela}`);
  await pg.close();
}
await navegador.close();

console.log('');
if (falhas.length) {
  console.log(`${falhas.length} FALHA(S) — a página do passador não cabe na tela.`);
  process.exit(1);
}
console.log('A página do passador cabe na tela em todas as medidas, sem rolar.');
