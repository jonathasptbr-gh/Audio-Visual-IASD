// ============================================================================
// O RODAPÉ DA FOLHA DA PLAYLIST: DOIS BOTÕES, UMA FAIXA (v1.8.53)
// ============================================================================
//
// Pedido do operador, verbatim: *"ajuste os botões de limpar playlist inteira e
// guardar no cronograma, para que sejam botões lado a lado… resuma os textos ou
// remova se achar necessário"* e *"verifique o guardar no cronograma, pois este
// só deve existir se houver ao menos dois itens na Playlist, não faz sentido
// guardar uma playlist de um item só"*.
//
// POR QUE UM ARQUIVO NOVO, e não mais um bloco no `smoke.mjs`: o que este mede é
// GEOMETRIA DE UMA FAIXA em várias larguras E em vários tamanhos de fonte do
// sistema — quatro contextos de navegador por rodada. O `smoke` mede a página
// inteira num contexto só, e o bloco "LIMPAR A FILA INTEIRA" que já mora lá
// continua sendo dele (o caminho da pergunta, de ponta a ponta).
//
// AS QUATRO COISAS QUE ELE TRAVA, e cada uma cai por um motivo próprio:
//
//  1. **Lado a lado, em metades iguais.** É o pedido. A armadilha MEDIDA é
//     `flex: 1`: a base `0%` não conta o padding do botão, e o pacote saía 16px
//     mais largo que a caixa do limpar (152,8 contra 136,8 a 320px). `box-sizing`
//     não resolve — os dois já computam `border-box`. Quem resolve é a base em
//     PORCENTAGEM.
//  2. **O rótulo não é cortado.** `textContent` não denuncia reticências, então
//     a medida é `scrollWidth` contra `clientWidth`. O orçamento MEDIDO é
//     `metade − 44px` (16 de padding + 8 de gap + 20 de ícone) = 100,8px a
//     320px, e é por isso que os rótulos são "Limpar" e "Guardar" (51,2 e
//     60,1px) com o destino no `title`/`aria-label`.
//  3. **O "Guardar" apaga com menos de DUAS MÍDIAS** — e a pergunta é a de quem
//     executa, `!isCue`, não `plItems.length`. O caso que separa as duas é uma
//     fila de UMA mídia mais UMA cena de roteiro: `length` 2, guardáveis 1.
//     Com a pergunta larga o botão acenderia para recusar no toque, que é a
//     troca que a v1.8.50 desfez (explicar depois × não oferecer).
//  4. **Os dois respondem ao toque.** O `.pl-clear` não estava na lista única do
//     `--press` e não recuava; empilhados ninguém via, lado a lado são duas
//     metades da mesma barra com uma afundando e a outra não — num destrutivo,
//     onde o que se faz diante de um botão que "não pegou" é tocar de novo.
//
// O LIMITE CONHECIDO, dito porque não é reprovação: a 320px com a fonte do
// sistema a 1,5× o rótulo "Guardar" reticencia (orçamento ~79px contra ~90px de
// texto). A alternativa seria a faixa quebrar em duas linhas, e ela é pior —
// a altura do rodapé mudaria com a fonte, e a folha empurra o que está acima.
// Até 1,3×, que é o teto que o projeto mede desde a v1.8.51, nada corta.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperarCortina, esperar, porque, checar, falhas } from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port + '/controle/index.html';
const navegador = await abrirNavegador();

// A fila nasce com N mídias. `addMedia` com `list: 'playlist'` é o caminho que
// as outras suítes usam, e ele passa pelo mesmo `load()` do app.
const SEMEAR = `async (n) => {
  setAppMode('full');
  for (let i = 0; i < n; i++) {
    await AVDB.addMedia(new Blob([String(i)], { type: 'audio/mpeg' }),
      { name: 'Faixa ' + i, type: 'audio/mpeg', kind: 'audio', list: 'playlist' });
  }
  await load();
  openPlPopup();
}`;

try {
  // ── A. LADO A LADO, METADES IGUAIS, MESMA ALTURA ────────────────────────
  for (const [largura, escala] of [[320, 1], [360, 1], [390, 1], [430, 1], [320, 1.3], [360, 1.3]]) {
    const ctx = await navegador.newContext({
      viewport: { width: largura, height: 900 }, hasTouch: true, colorScheme: 'dark',
    });
    await semRedeExterna(ctx);
    const pg = await ctx.newPage();
    await pg.goto(base, { waitUntil: 'load' });
    await esperarCortina(pg);
    if (escala !== 1) await pg.evaluate((e) => { document.documentElement.style.fontSize = (16 * e) + 'px'; }, escala);
    await pg.evaluate(eval(SEMEAR), 3);
    const pronto = await esperar(pg, () => {
      const f = document.getElementById('plClearFaixa');
      return !!f && f.getBoundingClientRect().height > 0;
    });
    checar(pronto === true, 'A · ' + largura + 'px×' + escala + ': a folha da playlist abriu', porque(pronto));

    const m = await pg.evaluate(() => {
      const fx = document.getElementById('plClearFaixa');
      const pk = document.getElementById('plPack');
      const r1 = fx.getBoundingClientRect(), r2 = pk.getBoundingClientRect();
      const rot = (el) => el.querySelector('.pl-rot');
      const corta = (el) => rot(el).scrollWidth > rot(el).clientWidth + 1;
      return {
        mesmaLinha: Math.abs(r1.top - r2.top) < 2,
        larguras: [Math.round(r1.width * 10) / 10, Math.round(r2.width * 10) / 10],
        alturas: [Math.round(r1.height), Math.round(r2.height)],
        cortou: { limpar: corta(document.getElementById('plClear')), guardar: corta(pk) },
        rotulos: [rot(document.getElementById('plClear')).textContent, rot(pk).textContent],
        // O DESTINO NÃO SE PERDE: ele sai da tela e entra onde o leitor de tela
        // o encontra — o desenho do `#contatoBtn` da v1.8.51.
        destino: pk.getAttribute('aria-label') || '',
      };
    });
    checar(m.mesmaLinha === true && Math.abs(m.larguras[0] - m.larguras[1]) <= 1,
      'A · ' + largura + 'px×' + escala + ': os dois botões do rodapé estão na MESMA '
      + 'linha e em metades IGUAIS — `flex: 1` sozinho dá 16px a mais ao pacote, '
      + 'porque a base `0%` não conta o padding dele', JSON.stringify(m));
    checar(m.alturas[0] === m.alturas[1] && m.alturas[0] > 0,
      'A · ' + largura + 'px×' + escala + ': e a MESMA altura — o pacote veste a caixa '
      + 'da faixa por `align-items: stretch`, e o número existe uma vez só',
      JSON.stringify(m));
    checar(m.cortou.limpar === false && m.cortou.guardar === false,
      'A · ' + largura + 'px×' + escala + ': e nenhum rótulo é CORTADO — `textContent` '
      + 'não denuncia reticências, a medida é `scrollWidth` contra `clientWidth`',
      JSON.stringify(m));
    checar(/cronograma/i.test(m.destino),
      'A · ' + largura + 'px×' + escala + ': e o DESTINO não se perde com o rótulo curto — '
      + 'ele mora no `aria-label`, que é onde o leitor de tela o encontra',
      JSON.stringify(m));
    await ctx.close();
  }

  // ── B. O "GUARDAR" APAGA COM MENOS DE DUAS MÍDIAS ───────────────────────
  //
  // As três metades, e a terceira é a que separa esta regra da preguiçosa.
  const ctx = await navegador.newContext({
    viewport: { width: 390, height: 900 }, hasTouch: true, colorScheme: 'dark',
  });
  await semRedeExterna(ctx);
  const pg = await ctx.newPage();
  await pg.goto(base, { waitUntil: 'load' });
  await esperarCortina(pg);
  await pg.evaluate(eval(SEMEAR), 1);
  const abriu = await esperar(pg, () => {
    const f = document.getElementById('plClearFaixa');
    return !!f && f.getBoundingClientRect().height > 0;
  });
  checar(abriu === true, 'B · a folha abriu com um item', porque(abriu));

  const com1 = await pg.evaluate(() => {
    const pk = document.getElementById('plPack');
    return { fila: plItems.length, disabled: pk.disabled, title: pk.title,
      opacidade: getComputedStyle(pk).opacity };
  });
  checar(com1.fila === 1 && com1.disabled === true,
    'B · com UM item o "Guardar" está APAGADO — a recusa existia no toque, e a '
    + 'v1.8.50 já decidiu que explicar depois é pior que não oferecer',
    JSON.stringify(com1));
  checar(/duas|2/i.test(com1.title) && parseFloat(com1.opacidade) < 1,
    'B · e ele DIZ POR QUÊ no `title`, apagado de verdade (`--op-inativo`) — um '
    + 'botão inerte com cara de vivo é o que se toca duas vezes',
    JSON.stringify(com1));

  const com2 = await pg.evaluate(async () => {
    await AVDB.addMedia(new Blob(['z'], { type: 'audio/mpeg' }),
      { name: 'Faixa z', type: 'audio/mpeg', kind: 'audio', list: 'playlist' });
    await load();
    const pk = document.getElementById('plPack');
    return { fila: plItems.length, disabled: pk.disabled };
  });
  checar(com2.fila === 2 && com2.disabled === false,
    'B · com DUAS ele acende — o limiar é o do executor, não um número novo',
    JSON.stringify(com2));

  // A METADE QUE SEPARA AS DUAS PERGUNTAS. `guardarPacote` filtra as cenas de
  // roteiro (um pacote é uma FILA DE REPRODUÇÃO, e um pacote dentro de outro
  // faria `abrirPacote` chamar `send` em laço). Uma fila de uma mídia mais um
  // cue tem `length` 2 e UM item guardável: com `plItems.length` o botão
  // acenderia para recusar no toque.
  const comCue = await pg.evaluate(async () => {
    await AVDB.listSet('playlist', (ids) => ids.slice(0, 1));
    await load();
    const cue = await criarCue('message', { msgId: 'zz1', text: 'Aviso' }, 'Aviso', 'playlist');
    await load();
    const pk = document.getElementById('plPack');
    return { criou: !!cue, fila: plItems.length,
      guardaveis: plItems.filter((m) => !isCue(m)).length, disabled: pk.disabled };
  });
  checar(comCue.criou === true && comCue.fila === 2 && comCue.guardaveis === 1
      && comCue.disabled === true,
    'B · UMA MÍDIA + UMA CENA DE ROTEIRO: a fila tem DOIS itens e o "Guardar" '
    + 'continua apagado — a pergunta é a de quem executa (`!isCue`), e duas '
    + 'perguntas sobre a mesma coisa divergem no primeiro ajuste',
    JSON.stringify(comCue));

  // ── C. OS DOIS RESPONDEM AO TOQUE ───────────────────────────────────────
  const toque = await pg.evaluate(async () => {
    await AVDB.listSet('playlist', () => []);
    await load();
    for (let i = 0; i < 3; i++) {
      await AVDB.addMedia(new Blob(['t' + i], { type: 'audio/mpeg' }),
        { name: 'T' + i, type: 'audio/mpeg', kind: 'audio', list: 'playlist' });
    }
    await load();
    return { fila: plItems.length };
  });
  checar(toque.fila === 3, 'C · a fila foi remontada com três itens', JSON.stringify(toque));

  // A ORDEM IMPORTA, e ela é um efeito do lote: soltar o dedo sobre o "Limpar"
  // é um CLIQUE, o clique abre a pergunta, e a pergunta agora esconde o
  // "Guardar" — medi-lo depois seria medir um elemento de caixa zero. O pacote
  // vem primeiro; o limpar fica por último, e o que ele deixa aberto morre com
  // o contexto.
  const recuo = {};
  // A ESPERA É PELO HIT-TEST, e não por `height > 0` (MEDIDO na escrita: a
  // folha FECHADA é uma `.popup-sheet` com `translateY(100%)`, que mantém a
  // altura da caixa e sai da tela — o `esperar` por altura passava, o
  // `mouse.down` caía no vazio, e o recuo lido era `none` nos DOIS botões, isto
  // é, a asserção reprovaria o app por um erro do arnês).
  for (const id of ['plPack', 'plClear']) {
    // A FOLHA É REABERTA A CADA UM: a leitura anterior soltou o dedo fora do
    // botão para não disparar a ação, e soltar fora ACERTA o fundo, que fecha a
    // folha. Fechada ela continua com altura e sai da tela — o hit-test é o que
    // denuncia, e é por ele que se espera.
    await pg.evaluate(() => { openPlPopup(); });
    const naTela = await esperar(pg, (alvo) => {
      const p = document.getElementById(alvo);
      if (!p) return false;
      const r = p.getBoundingClientRect();
      const sob = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return !!sob && (sob === p || p.contains(sob));
    }, id);
    checar(naTela === true, 'C · o #' + id + ' está alcançável pelo toque', porque(naTela));
    const cx = await pg.locator('#' + id).boundingBox();
    await pg.mouse.move(cx.x + cx.width / 2, cx.y + cx.height / 2);
    await pg.mouse.down();
    recuo[id] = await pg.evaluate((i) => {
      const el = document.getElementById(i);
      const c = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const sob = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { transform: c.transform, filtro: c.filter, ativo: el.matches(':active'),
        sob: sob ? (sob.id || sob.className || sob.tagName) : null };
    }, id);
    // SOLTAR FORA CANCELA O CLIQUE, e sem isso a medição dispara a AÇÃO: soltar
    // sobre o "Guardar" abre o diálogo do nome do pacote (que então cobre o
    // vizinho e faz a segunda leitura medir um elemento tapado), e soltar sobre
    // o "Limpar" abre a pergunta. O que se quer aqui é o estado `:active`, não o
    // desfecho do toque.
    await pg.mouse.move(4, 4);
    await pg.mouse.up();
  }
  const recua = (r) => r.transform !== 'none' && r.transform !== '';
  checar(recua(recuo.plClear) && recua(recuo.plPack)
      && recuo.plClear.transform === recuo.plPack.transform,
    'C · os DOIS recuam ao toque, e pelo MESMO valor — o `.pl-clear` ficou fora '
    + 'da lista única do `--press` até a v1.8.53, e lado a lado uma metade que '
    + 'afunda ao lado de uma que não afunda lê-se como um botão quebrado',
    JSON.stringify(recuo));
  await ctx.close();

  // ── D. A PERGUNTA OCUPA A FAIXA, E A LARGURA QUE MANDA É A DE 320px ─────
  //
  // O `smoke.mjs` já mede este caminho de ponta a ponta, mas a 430px — e a
  // 430px o par CABE mesmo em meia faixa, então lá a asserção do corte não
  // reprova o defeito que nomeia. É aqui que ela discrimina: MEDIDO a 320px, com
  // o pacote de pé o par fica com 69,6px por botão e "Cancelar" (60,2px de texto
  // mais 16px de padding) sai truncado. Com o pacote fora, 146px por botão.
  const ctx320 = await navegador.newContext({
    viewport: { width: 320, height: 900 }, hasTouch: true, colorScheme: 'dark',
  });
  await semRedeExterna(ctx320);
  const pg320 = await ctx320.newPage();
  await pg320.goto(base, { waitUntil: 'load' });
  await esperarCortina(pg320);
  await pg320.evaluate(eval(SEMEAR), 3);
  const abriu320 = await esperar(pg320, () => {
    const f = document.getElementById('plClearFaixa');
    return !!f && f.getBoundingClientRect().height > 0;
  });
  checar(abriu320 === true, 'D · 320px: a folha abriu', porque(abriu320));

  const perg = await pg320.evaluate(async () => {
    const rod = document.querySelector('.pl-rodape');
    const antes = Math.round(rod.getBoundingClientRect().height);
    document.getElementById('plClear').click();
    await new Promise((f) => setTimeout(f, 250));
    const cx = document.getElementById('plClearFaixa').querySelector('.linha-confirma');
    if (!cx) return { erro: 'a pergunta não abriu' };
    const par = [...cx.querySelectorAll('.linha-confirma-btn')];
    return {
      antes, depois: Math.round(rod.getBoundingClientRect().height),
      pacote: Math.round(document.getElementById('plPack').getBoundingClientRect().height),
      larguras: par.map((b) => Math.round(b.getBoundingClientRect().width * 10) / 10),
      cortou: par.some((b) => b.scrollWidth > b.clientWidth + 1),
      rotulos: par.map((b) => b.textContent).join(' · '),
    };
  });
  checar(!perg.erro && perg.pacote === 0 && perg.depois === perg.antes,
    'D · 320px: a pergunta OCUPA a faixa — o "Guardar" sai e o rodapé fica na '
    + 'MESMA altura. Era o inverso até a v1.8.52, e a razão de então era a '
    + 'altura: empilhados, levar o vizinho tirava uma linha do rodapé',
    JSON.stringify(perg));
  checar(!perg.erro && perg.cortou === false && perg.rotulos === 'Cancelar · Limpar',
    'D · 320px: e o par do destrutivo não é CORTADO — em meia faixa são 69,6px '
    + 'por botão e "Cancelar" vira "Cancela…", que `textContent` não denuncia',
    JSON.stringify(perg));
  await ctx320.close();

  // ── E. A ALTURA NÃO PODE DEPENDER DO VIZINHO ────────────────────────────
  //
  // Com a fila VAZIA a caixa do limpar some (ela leva a margem do rodapé
  // junto), e o pacote — que herda a altura por `align-items: stretch` — ficava
  // com a do próprio conteúdo: MEDIDO pelo portão de geometria, 23px a 360×740
  // com a fonte do sistema a 1,5×, contra um piso de toque de 34px. Foi uma
  // regressão DESTE lote (antes o pacote tinha a altura no padding próprio), e
  // ela só aparece no estado em que o vizinho não está lá.
  const ctxVazio = await navegador.newContext({
    viewport: { width: 360, height: 740 }, hasTouch: true, colorScheme: 'dark',
  });
  await semRedeExterna(ctxVazio);
  const pgV = await ctxVazio.newPage();
  await pgV.goto(base, { waitUntil: 'load' });
  await esperarCortina(pgV);
  await pgV.evaluate(() => { document.documentElement.style.fontSize = '24px'; });
  await pgV.evaluate(() => { setAppMode('full'); openPlPopup(); });
  const vazio = await esperar(pgV, () => {
    const p = document.getElementById('plPack');
    return !!p && p.getBoundingClientRect().height > 0;
  });
  checar(vazio === true, 'E · a folha abriu com a fila vazia', porque(vazio));
  const alt = await pgV.evaluate(() => {
    const p = document.getElementById('plPack');
    const f = document.getElementById('plClearFaixa');
    return { fila: plItems.length, faixaEscondida: !!f.hidden,
      pacote: Math.round(p.getBoundingClientRect().height),
      piso: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hit')) };
  });
  checar(alt.fila === 0 && alt.faixaEscondida === true && alt.pacote >= alt.piso,
    'E · com a fila VAZIA o "Guardar" mantém o piso de toque — a altura mora na '
    + 'FAIXA, não no vizinho que some com ela', JSON.stringify(alt));
  await ctxVazio.close();

} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) {
  console.log('\n' + falhas.length + ' falha(s).');
  process.exit(1);
}
console.log('\nTodos passaram.');
