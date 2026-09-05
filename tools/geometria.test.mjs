#!/usr/bin/env node
// ============================================================================
// A GEOMETRIA DO APP CABE — o portão.
//
// ## Por que ele existe
//
// Pedido do operador: *"faça a varredura completa no layout do app para que ele
// se torne responsivo geometricamente. vamos criar um padrão seguro de
// design."*
//
// O app não tem uma media query de largura ou de altura: o que o segura é o
// fluxo do CSS. MEDIDO, ele segura bem — 13 das 16 superfícies saíram limpas
// nas oito combinações de tela × fonte da primeira varredura. O que ele NÃO
// resolve sozinho é a altura, e é sempre a mesma anatomia: **a caixa é da TELA
// e encolhe, o conteúdo é da FONTE e cresce**, e nada apresenta os dois. Foi
// assim que a folha de leitura da Bíblia chegou ao aparelho do operador com
// texto cortado (v1.7.10), e assim que a grade de livros ficou com fileiras de
// **16,4px para uma letra de 20px** e a folha de Ferramentas espremeu o painel
// a **42,9px** para um botão de 51,1px.
//
// **Nada disso lança, nada aparece no console, e na tela em que o desenho foi
// decidido está tudo certo.** É a definição de defeito que só um oráculo pega.
//
// ## O que ele afirma
//
//  · **T1, T2, T3 e T5 são ZERO.** Nada sai da janela, nada se sobrepõe numa
//    linha, nada corta texto sem ter declarado como, nenhuma camada `fixed`
//    fica fora da tela. As quatro são "conteúdo cortado ou inalcançável", que é
//    o pedido do operador ao pé da letra.
//  · **T4 respeita `--hit`**, com as exceções NOMEADAS abaixo — uma a uma, com
//    o seletor exato e o piso que ela ainda tem de cumprir. Exceção por escopo
//    ("dentro da Bíblia pode") é a que mais barato se alarga.
//  · **Toda superfície ABRIU e mostrou nós.** Sem isto o oráculo tem um jeito
//    silencioso de passar: uma superfície que não montou não tem achado nenhum,
//    e um placar limpo sobre uma tela vazia é indistinguível de um app correto.
//  · **E AS SONDAS ESTÃO VIVAS.** A última asserção injeta um defeito de
//    propósito e exige que a sonda o nomeie. Sem ela, um erro no caminho de
//    varredura (um `return` cedo, uma poda larga demais) deixaria as quatro
//    primeiras verdes para sempre — o oráculo aprovando por não estar olhando.
//
// ## O que ele NÃO afirma
//
// Nada de contraste (é do `smoke.mjs`), nada de paisagem (o app é retrato por
// manifesto) e nada que dependa de rede — `semRedeExterna` corta a saída, e o
// cenário é semeado à mão.
//
// **A régua é o `tools/varredura-geometrica.mjs`**, que roda as mesmas sondas
// sobre as oito telas e IMPRIME em vez de reprovar. É com ela que se decide o
// que este arquivo deve dizer; escrever a asserção antes de medir é como o
// desenho da Bíblia nasceu.
//
//   node tools/geometria.test.mjs
// ============================================================================
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperar, esperarCortina, checar, falhas, porque, RAIZ_WEB }
  from './arnes.mjs';
import { SUPERFICIES, SONDA, SEMENTE, ROTULO, PISOS } from './geometria.mjs';

// AS QUATRO TELAS DO PORTÃO, e por que não as oito da régua: cada combinação a
// mais é o app inteiro montado outra vez, e o que se ganha depois destas é
// pouco — elas são os EXTREMOS de cada eixo mais o caso comum. A régua continua
// varrendo as oito, e é lá que se procura quando esta reprova.
const TELAS = [
  { w: 360, h: 640, nome: '360×640' },                        // a menor do parque
  { w: 430, h: 900, nome: '430×900' },                        // a de referência do projeto
  { w: 393, h: 786, fonte: 1.15, nome: '393×786 · 1,15×' },   // a comum, com a fonte maior
  { w: 360, h: 640, fonte: 1.30, nome: '360×640 · 1,3×' },    // o pior caso comum
  // A ESCALA 1,5× — o "Ampliar" do Android, e ela está aqui por uma razão
  // MEDIDA, não por completude: sem ela a correção que faz a letra do livro
  // seguir a célula (`min(--fs-4xl, 76cqh)`) NÃO É COBRADA por oráculo nenhum.
  // A conta: a fileira do piso tem 26px de caixa de conteúdo e `--fs-4xl` são
  // 20px × a escala, então o corte começa em 1,3× e um pouco — a 1,3× a letra
  // cabe por ZERO, e "cabe por zero" não é uma correção, é sorte.
  { w: 360, h: 740, fonte: 1.50, nome: '360×740 · 1,5×' },
];

const servidor = servirEstatico(RAIZ_WEB);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador();

/** Quantos nós cada superfície mostrou, por tela — a guarda anti-cego. */
const nosVistos = new Map();
/** Os achados, agregados por (sonda, superfície, caminho). */
const achados = new Map();
const naoAbriu = [];
const erros = [];

for (const t of TELAS) {
  const ctx = await navegador.newContext({ viewport: { width: t.w, height: t.h } });
  await semRedeExterna(ctx);
  await ctx.addInitScript(() => {
    try { localStorage.setItem('av.appMode', 'full'); } catch (_) { /* storage bloqueado */ }
  });
  if (t.fonte) {
    await ctx.addInitScript((f) => {
      addEventListener('DOMContentLoaded', () => {
        document.documentElement.style.fontSize = (16 * f) + 'px';
      });
    }, t.fonte);
  }
  // UMA PÁGINA POR TELA, e não uma por superfície: montar o app inteiro custa
  // ~10s (a cortina tem piso de 1,8s), e 16 superfícies × 4 telas seriam 11
  // minutos de portão. O reset entre uma e outra é o `__avBack()` do PRÓPRIO
  // app — a mesma fila que o botão voltar do Android percorre —, e não uma
  // lista de closers escrita aqui, que envelheceria à parte.
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push(t.nome + ': ' + e.message));
  await pg.goto(base + '/controle/', { waitUntil: 'load' });
  await esperarCortina(pg);
  const subiu = await esperar(pg, () => window.AVDB && typeof window.__avBack === 'function',
    null, 30000);
  if (subiu !== true) { checar(false, 'o app sobe em ' + t.nome, porque(subiu)); continue; }
  await pg.evaluate(SEMENTE);

  for (const s of SUPERFICIES) {
    // FECHA O QUE ESTIVER ABERTO, pela fila do voltar. O teto de 8 é a fila
    // inteira mais folga: sem ele um degrau que se recuse a fechar viraria um
    // laço infinito no CI.
    //
    // E ESVAZIA A LISTA DA BIBLIOTECA, que é o preço do reuso e precisa estar
    // dito. A janela dela é a ÚNICA camada que existe SEMPRE (a barra de busca
    // mora nela), então fechada ela continua no documento — com o acervo
    // inteiro renderizado dentro e recortado, que é o que "fechada" quer dizer.
    // Numa página nova aquela lista nem chegou a ser montada, e foi por isso
    // que a régua nunca viu isto. **Não é um defeito do app**: uma gaveta
    // fechada recorta o que guardou. O reset devolve a página ao estado que uma
    // recém-carregada tem — se não fizesse isso, toda superfície aberta DEPOIS
    // da Biblioteca herdaria um "corte" que é dela.
    await pg.evaluate(() => {
      for (let i = 0; i < 8 && window.__avBack(); i++) { /* fecha */ }
      const lista = document.getElementById('hymnResults');
      if (lista) lista.innerHTML = '';
    });
    await pg.evaluate(s.abrir).catch((e) => { naoAbriu.push(s.nome + ' @ ' + t.nome + ': ' + e.message); });
    // ASSENTAR É `getAnimations()`, nunca um relógio: uma folha medida no meio
    // do movimento devolve uma caixa que não existe (a regra do `smoke.mjs`).
    const pronto = await esperar(pg, (sel) => {
      if (!document.querySelector(sel)) return false;
      return ![...document.querySelectorAll('*')]
        .some((n) => n.getAnimations().some((a) => a.playState === 'running'));
    }, s.alvo, 12000);
    if (pronto !== true) { naoAbriu.push(s.nome + ' @ ' + t.nome + ' (' + s.alvo + ')'); continue; }

    const r = await pg.evaluate(SONDA, { pisos: PISOS });
    nosVistos.set(s.nome, Math.max(nosVistos.get(s.nome) || 0, r.nos));
    for (const a of r.achados) {
      const k = a.t + '|' + s.nome + '|' + a.onde + '|' + (a.txt || '');
      const v = achados.get(k) || { ...a, sup: s.nome, telas: [], pior: 0, piorTela: '' };
      v.telas.push(t.nome);
      if (a.px > v.pior) { v.pior = a.px; v.piorTela = t.nome; }
      achados.set(k, v);
    }
  }
  await ctx.close();
}

// ==========================================================================
// A · TODA SUPERFÍCIE ABRIU, E MOSTROU NÓS
// ==========================================================================
checar(naoAbriu.length === 0,
  'as ' + SUPERFICIES.length + ' superfícies abrem e assentam nas ' + TELAS.length + ' telas',
  naoAbriu.slice(0, 6).join(' · '));
const vazias = SUPERFICIES.filter((s) => !(nosVistos.get(s.nome) > 20)).map((s) => s.nome);
checar(vazias.length === 0,
  'nenhuma superfície foi medida VAZIA — um placar limpo sobre uma tela que não '
  + 'montou é indistinguível de um app correto',
  vazias.join(', '));
checar(erros.length === 0, 'nenhum erro de página durante a varredura', erros.slice(0, 4).join(' · '));

// ==========================================================================
// B · AS QUATRO SONDAS DE CONTEÚDO CORTADO SÃO ZERO
// ==========================================================================
const frase = (v) => '[' + v.t + '] ' + v.sup + ' · ' + v.onde + ' · ' + v.pior + 'px ('
  + v.piorTela + ')' + (v.txt ? ' “' + v.txt + '”' : '') + (v.extra ? ' · ' + v.extra : '');

for (const t of ['T1', 'T2', 'T3', 'T5']) {
  const lista = [...achados.values()].filter((v) => v.t === t);
  checar(lista.length === 0, 'nada em ' + ROTULO[t] + ' (' + t + ')',
    lista.slice(0, 5).map(frase).join('\n        '));
}

// ==========================================================================
// C · O PISO DE TOQUE, COM AS EXCEÇÕES NOMEADAS
// ==========================================================================
const t4 = [...achados.values()].filter((v) => v.t === 'T4');
checar(t4.length === 0,
  'todo controle cumpre o piso de toque (as exceções são as ' + PISOS.length
  + ' nomeadas em `PISOS`, e elas TROCAM de piso, não o dispensam)',
  t4.slice(0, 6).map((v) => frase(v) + ' · piso ' + v.piso).join('\n        '));

// ==========================================================================
// D · AS SONDAS ESTÃO VIVAS
// ==========================================================================
//
// Sem esta, um erro no caminho de varredura — um `return` cedo, uma poda larga
// demais, um seletor que parou de casar — deixaria B e C verdes PARA SEMPRE, e
// o oráculo passaria por não estar olhando. É a mesma razão pela qual as cinco
// sondas foram vistas disparando antes de a régua valer (ver `geometria.mjs`);
// esta é a metade que continua sendo verificada a cada execução.
{
  const ctx = await navegador.newContext({ viewport: { width: 360, height: 640 } });
  const pg = await ctx.newPage();
  await pg.setContent(`<style>
    :root{--hit:34px}
    #linha{display:flex;flex-direction:row;width:200px}
    #linha>div{height:40px;background:#ccc}
    #b{width:150px;margin-left:-90px}
    #a{width:150px}
    #corte{width:120px;height:20px;overflow:hidden;line-height:16px}
    #fora{position:absolute;left:340px;width:120px;height:30px;background:#ddd}
    #fixa{position:fixed;left:0;top:520px;width:200px;height:200px;background:#eee}
    #alvo{width:20px;height:20px}
  </style>
  <div id="linha"><div id="a">esquerda</div><div id="b">direita</div></div>
  <div id="corte">uma linha, outra linha, e mais uma que não cabe de jeito nenhum</div>
  <div id="fora">passa da borda</div>
  <div id="fixa">camada fixa que passa da base</div>
  <button id="alvo">x</button>`);
  const r = await pg.evaluate(SONDA, { pisos: [] });
  const viu = new Set(r.achados.map((a) => a.t));
  for (const t of ['T1', 'T2', 'T3', 'T4', 'T5']) {
    checar(viu.has(t), 'a sonda ' + t + ' (' + ROTULO[t] + ') DISPARA diante do defeito dela',
      [...viu].join(','));
  }
  await ctx.close();
}

await navegador.close();
servidor.close();

if (falhas.length) { console.error('\n' + falhas.length + ' REPROVADA(S)'); process.exit(1); }
console.log('\ntudo certo');
