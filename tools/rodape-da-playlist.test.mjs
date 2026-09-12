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
      const fav = document.getElementById('plPackFav');
      const pk = document.getElementById('plPack');
      const cx = (e) => e.getBoundingClientRect();
      const rot = document.getElementById('plClear').querySelector('.pl-rot');
      const piso = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hit'));
      return {
        mesmaLinha: new Set([fx, fav, pk].map((e) => Math.round(cx(e).top))).size === 1,
        larguras: [fx, fav, pk].map((e) => Math.round(cx(e).width * 10) / 10),
        alturas: [fx, fav, pk].map((e) => Math.round(cx(e).height)),
        quadrados: [fav, pk].every((e) => Math.abs(cx(e).width - cx(e).height) <= 1),
        piso, alcancam: [fav, pk].every((e) => cx(e).width >= piso && cx(e).height >= piso),
        cortouLimpar: rot.scrollWidth > rot.clientWidth + 1,
        rotuloLimpar: rot.textContent,
        // OS DOIS SEM RÓTULO DIZEM O DESTINO onde um botão de símbolo o diz: no
        // `aria-label`, que é o rótulo dele para o leitor de tela.
        destinos: [fav.getAttribute('aria-label') || '', pk.getAttribute('aria-label') || ''],
        desenhos: [fav.querySelector('svg'), pk.querySelector('svg')].map((e) => !!e),
        // A ORDEM NA TELA, lida da esquerda para a direita — e por GEOMETRIA, não
        // pela ordem do documento: é o que se vê que está em questão, e um
        // `flex-direction` ou um `order` faria as duas discordarem.
        ordem: [['limpar', fx], ['favoritos', fav], ['cronograma', pk]]
          .sort((a, b) => cx(a[1]).left - cx(b[1]).left).map((e) => e[0]),
      };
    });
    checar(m.mesmaLinha === true,
      'A · ' + largura + 'px×' + escala + ': os TRÊS botões do rodapé estão na MESMA '
      + 'linha — o "Limpar" com rótulo e os dois destinos como símbolo',
      JSON.stringify(m));
    checar(m.quadrados === true && m.alcancam === true,
      'A · ' + largura + 'px×' + escala + ': os dois de guardar são QUADRADOS e alcançam '
      + 'o piso de toque — `aspect-ratio: 1` não resolve (com `flex: 0 0 auto` as duas '
      + 'dimensões saem do conteúdo, e eles saíam com 20px de largura)',
      JSON.stringify(m));
    checar(m.alturas[0] === m.alturas[1] && m.alturas[1] === m.alturas[2] && m.alturas[0] > 0,
      'A · ' + largura + 'px×' + escala + ': e os três têm a MESMA altura — ela mora na '
      + 'faixa, num número só, e é dele que sai a largura dos quadrados',
      JSON.stringify(m));
    checar(m.cortouLimpar === false && m.rotuloLimpar === 'Limpar',
      'A · ' + largura + 'px×' + escala + ': o rótulo do "Limpar" não é CORTADO — '
      + '`textContent` não denuncia reticências, a medida é `scrollWidth` contra '
      + '`clientWidth`', JSON.stringify(m));
    checar(/favorito/i.test(m.destinos[0]) && /cronograma/i.test(m.destinos[1])
        && m.desenhos[0] === true && m.desenhos[1] === true,
      'A · ' + largura + 'px×' + escala + ': cada um NOMEIA o próprio destino no '
      + '`aria-label` e desenha o ícone da gaveta da linha — sem rótulo, é tudo que '
      + 'um botão de símbolo tem a dizer a quem o encontra', JSON.stringify(m));
    // A ORDEM CANÔNICA DOS DESTINOS (v1.8.56), e ela INVERTEU aqui: este rodapé
    // nasceu na v1.8.54 copiando a gaveta de então, que punha a estrela na
    // frente. Pedido do operador: *"a esquerda o cronograma, no meio a playlist
    // e por fim o favoritos"* — e nesta faixa a playlist não aparece, porque
    // esta FOLHA é a playlist.
    checar(JSON.stringify(m.ordem) === JSON.stringify(['limpar', 'cronograma', 'favoritos']),
      'A · ' + largura + 'px×' + escala + ': e eles estão na ORDEM CANÔNICA dos '
      + 'destinos — Cronograma antes de favoritos, a mesma da gaveta da linha, da '
      + 'folha de destinos e da faixa de fecho do sorteio', JSON.stringify(m.ordem));
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
    const fav = document.getElementById('plPackFav');
    return { fila: plItems.length, disabled: pk.disabled && fav.disabled,
      title: pk.title, tituloFav: fav.title,
      // O `aria-label` ANDA COM O `title`: ele é o rótulo destes botões, e um
      // que ficasse no valor da carga diria "guardar" a quem não pode guardar.
      rotuloFav: fav.getAttribute('aria-label'),
      opacidade: getComputedStyle(pk).opacity };
  });
  checar(com1.fila === 1 && com1.disabled === true,
    'B · com UM item os DOIS de guardar estão APAGADOS — o limiar é do PACOTE, '
    + 'não do destino: o que não faz sentido é empacotar uma mídia só, e isso '
    + 'não muda por ela ir para o Cronograma ou para os Favoritos',
    JSON.stringify(com1));
  checar(com1.rotuloFav === com1.tituloFav && /duas|2/i.test(com1.tituloFav),
    'B · e o `aria-label` acompanha o `title` no apagado — sem rótulo na tela, '
    + 'ele é o que o leitor de tela lê, e "guardar" seria uma promessa falsa',
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
    return { fila: plItems.length,
      disabled: pk.disabled || document.getElementById('plPackFav').disabled };
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
      guardaveis: plItems.filter((m) => !isCue(m)).length,
      disabled: pk.disabled && document.getElementById('plPackFav').disabled };
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
  for (const id of ['plPack', 'plPackFav', 'plClear']) {
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
  const iguais = new Set(['plClear', 'plPack', 'plPackFav'].map((i) => recuo[i].transform));
  checar(['plClear', 'plPack', 'plPackFav'].every((i) => recua(recuo[i])) && iguais.size === 1,
    'C · os TRÊS recuam ao toque, e pelo MESMO valor — o `.pl-clear` ficou fora '
    + 'da lista única do `--press` até a v1.8.53, e numa faixa só um botão que '
    + 'afunda ao lado de um que não afunda lê-se como um botão quebrado',
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
      pacote: ['plPack', 'plPackFav']
        .reduce((a, i) => a + Math.round(document.getElementById(i).getBoundingClientRect().height), 0),
      larguras: par.map((b) => Math.round(b.getBoundingClientRect().width * 10) / 10),
      cortou: par.some((b) => b.scrollWidth > b.clientWidth + 1),
      rotulos: par.map((b) => b.textContent).join(' · '),
    };
  });
  checar(!perg.erro && perg.pacote === 0 && perg.depois === perg.antes,
    'D · 320px: a pergunta OCUPA a faixa — os DOIS de guardar saem (com o irmão '
    + 'ADJACENTE só o primeiro sairia, e sobraria uma estrela solta) e o rodapé fica na '
    + 'MESMA altura. Era o inverso até a v1.8.52, e a razão de então era a '
    + 'altura: empilhados, levar o vizinho tirava uma linha do rodapé',
    JSON.stringify(perg));
  checar(!perg.erro && perg.cortou === false && perg.rotulos === 'Cancelar · Confirmar',
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

  // ── F. OS DOIS DESTINOS GUARDAM, CADA UM NO SEU ─────────────────────────
  //
  // Pedido do operador: *"sejam os mesmos dois botões de salvar no cronograma ou
  // salvar nos favoritos, pois este já é o padrão do resto do sistema"*. O que
  // se mede é o DESFECHO em cada lista, não o clique: um botão ligado ao destino
  // errado passaria por qualquer asserção que só olhasse a tela.
  const ctxF = await navegador.newContext({
    viewport: { width: 390, height: 900 }, hasTouch: true, colorScheme: 'dark',
  });
  await semRedeExterna(ctxF);
  const pgF = await ctxF.newPage();
  await pgF.goto(base, { waitUntil: 'load' });
  await esperarCortina(pgF);
  await pgF.evaluate(eval(SEMEAR), 3);
  const prontoF = await esperar(pgF, () => {
    const p = document.getElementById('plPackFav');
    return !!p && p.getBoundingClientRect().height > 0 && !p.disabled;
  });
  checar(prontoF === true, 'F · a folha abriu com três itens e o guardar aceso', porque(prontoF));

  const guardou = await pgF.evaluate(async () => {
    const salvar = async (id) => {
      openPlPopup();
      await new Promise((f) => setTimeout(f, 250));
      document.getElementById(id).click();
      await new Promise((f) => setTimeout(f, 250));
      // O nome vem do `appPrompt`, e a sugestão dele já é a que serve.
      document.getElementById('appDialogOk').click();
      await new Promise((f) => setTimeout(f, 700));
    };
    const antes = { favs: (await AVDB.listItems('favs')).length,
      crono: (await AVDB.listItems('imports')).length };
    await salvar('plPackFav');
    const favs = await AVDB.listItems('favs');
    await salvar('plPack');
    const crono = await AVDB.listItems('imports');
    const so = (l) => l.map((x) => ({ cue: x.cue, itens: (x.data && x.data.ids || []).length }));
    return { antes, favs: so(favs), crono: so(crono), fila: plItems.length };
  });
  checar(guardou.antes.favs === 0 && guardou.favs.length === 1
      && guardou.favs[0].cue === 'group' && guardou.favs[0].itens === 3,
    'F · a ESTRELA guarda o pacote nos FAVORITOS, com a fila inteira dentro',
    JSON.stringify(guardou));
  checar(guardou.antes.crono === 0 && guardou.crono.length === 1
      && guardou.crono[0].cue === 'group' && guardou.crono[0].itens === 3,
    'F · e o RELÓGIO guarda no CRONOGRAMA — dois botões, dois destinos, e o que '
    + 'se mede é a lista, não o clique', JSON.stringify(guardou));
  checar(guardou.fila === 3,
    'F · e guardar NÃO esvazia a fila: o pacote é uma cópia, e a fila do culto '
    + 'segue no ar', JSON.stringify(guardou));
  await ctxF.close();

  // ── G. A FOLHA FECHA QUANDO A FILA ACABA, PELAS DUAS PORTAS ─────────────
  //
  // Pedido do operador: *"ajuste também após o esvaziamento da playlist, para
  // que a janela dela seja fechada, já que não há mais nada ali"*. E a metade
  // que ele não pediu, mas que vem junto: o CORPO da folha vazia não desenha
  // mais a frase de ensino — ela mora no `title` do botão apagado desde a
  // v1.8.51, e aqui era a segunda cópia.
  const ctxG = await navegador.newContext({
    viewport: { width: 390, height: 900 }, hasTouch: true, colorScheme: 'dark',
  });
  await semRedeExterna(ctxG);
  const pgG = await ctxG.newPage();
  await pgG.goto(base, { waitUntil: 'load' });
  await esperarCortina(pgG);

  const portas = await pgG.evaluate(async () => {
    const aberta = () => document.getElementById('plPopup').classList.contains('open');
    const semear = async (n) => {
      await AVDB.listSet('playlist', () => []);
      for (let i = 0; i < n; i++) {
        await AVDB.addMedia(new Blob(['g' + i], { type: 'audio/mpeg' }),
          { name: 'G' + i, type: 'audio/mpeg', kind: 'audio', list: 'playlist' });
      }
      await load();
      openPlPopup();
      await new Promise((f) => setTimeout(f, 300));
    };
    const r = {};
    // PORTA 1 — o "Limpar" da folha.
    setAppMode('full');
    await semear(2);
    r.abriuA = aberta();
    await limparPlaylist();
    await new Promise((f) => setTimeout(f, 500));
    r.fechouPeloLimpar = !aberta() && plItems.length === 0;
    // PORTA 2 — a lixeira da ÚLTIMA linha.
    await semear(1);
    r.abriuB = aberta();
    const li = document.querySelector('#playlist li');
    li.querySelector('.row-mais').click();
    li.querySelector('.row-excluir').click();
    await new Promise((f) => setTimeout(f, 200));
    li.querySelector('.linha-confirma-btn.linha-sim').click();
    await new Promise((f) => setTimeout(f, 800));
    r.fechouPelaLixeira = !aberta() && plItems.length === 0;
    // E COM ITEM SOBRANDO ELA CONTINUA ABERTA — a régua é "acabou", não "mudou".
    await semear(2);
    const li2 = document.querySelector('#playlist li');
    li2.querySelector('.row-mais').click();
    li2.querySelector('.row-excluir').click();
    await new Promise((f) => setTimeout(f, 200));
    li2.querySelector('.linha-confirma-btn.linha-sim').click();
    await new Promise((f) => setTimeout(f, 800));
    r.ficouAberta = aberta() && plItems.length === 1;
    // O CORPO VAZIO não desenha mais nada.
    await AVDB.listSet('playlist', () => []);
    await load();
    r.corpoVazio = document.getElementById('playlist').innerHTML.trim() === '';
    r.tituloEnsina = /segure/i.test(document.getElementById('plBtn').title || '');
    return r;
  });
  checar(portas.abriuA === true && portas.fechouPeloLimpar === true,
    'G · o "Limpar" esvazia a fila e FECHA a folha — não há mais nada ali',
    JSON.stringify(portas));
  checar(portas.abriuB === true && portas.fechouPelaLixeira === true,
    'G · e a lixeira da ÚLTIMA linha faz o mesmo: o estado é um só, e duas '
    + 'portas para ele não podem ter duas respostas', JSON.stringify(portas));
  checar(portas.ficouAberta === true,
    'G · MAS com item sobrando ela CONTINUA aberta — a régua é "a fila acabou", '
    + 'não "a fila mudou", e fechar no meio de uma reorganização seria tirar a '
    + 'folha da mão de quem está usando', JSON.stringify(portas));
  checar(portas.corpoVazio === true && portas.tituloEnsina === true,
    'G · e o corpo da folha vazia não desenha mais a frase de ensino — ela mora '
    + 'no `title` do botão apagado desde a v1.8.51, e aqui era a segunda cópia',
    JSON.stringify(portas));
  await ctxG.close();

  // ── H. A LINHA DA FILA TEM MINIATURA, E ELA É GEOMETRIA ─────────────────
  //
  // Relato do operador: *"na playlist os itens estão sem thumbnail, fazendo a
  // gaveta de opções ficar faltando cobertura e deixando exposto um pedaço
  // inútil do texto do card abaixo"*.
  //
  // A `.row-acoes` é posicionada CONTRA a miniatura — o KDoc dela diz que a capa
  // *"é a única coisa que fica de fora"* —, e esta lista não tinha nenhuma. O que
  // aparecia naquela fatia era o TÍTULO, recortado no meio. A asserção mede as
  // DUAS pontas: que a capa existe e que ela ocupa EXATAMENTE a fatia que a
  // gaveta deixa de fora — só a primeira passaria com uma capa de outro tamanho,
  // e aí o defeito voltaria com a capa no lugar.
  const ctxH = await navegador.newContext({
    viewport: { width: 390, height: 900 }, hasTouch: true, colorScheme: 'dark',
  });
  await semRedeExterna(ctxH);
  const pgH = await ctxH.newPage();
  await pgH.goto(base, { waitUntil: 'load' });
  await esperarCortina(pgH);
  await pgH.evaluate(eval(SEMEAR), 3);
  const abriuH = await esperar(pgH, () => !!document.querySelector('#playlist li'));
  checar(abriuH === true, 'H · a folha abriu com três linhas', porque(abriuH));

  const linha = await pgH.evaluate(async () => {
    const li = document.querySelector('#playlist li');
    const th = li.querySelector('.thumb');
    if (!th) return { temCapa: false };
    li.querySelector('.row-mais').click();
    await new Promise((f) => setTimeout(f, 400));
    const g = li.querySelector('.row-acoes');
    const rt = th.getBoundingClientRect(), rg = g.getBoundingClientRect();
    const rl = li.getBoundingClientRect();
    // O QUE ESTÁ SOB O TÍTULO com a gaveta aberta: tem de ser a gaveta.
    const nome = li.querySelector('.row-name').getBoundingClientRect();
    const sob = document.elementFromPoint(nome.left + 4, nome.top + nome.height / 2);
    return {
      temCapa: true,
      capa: { w: Math.round(rt.width), h: Math.round(rt.height) },
      quadrada: Math.abs(rt.width - rt.height) <= 1,
      // a fatia que a gaveta deixa à esquerda termina onde a capa termina
      folga: Math.round((rg.left - rt.right) * 10) / 10,
      cobreAltura: Math.abs(rg.height - rl.height) <= 1,
      sobONome: sob ? (sob.className || sob.tagName) : null,
    };
  });
  checar(linha.temCapa === true && linha.quadrada === true,
    'H · a linha da fila tem MINIATURA, quadrada como a das outras listas',
    JSON.stringify(linha));
  checar(linha.folga >= 0 && linha.folga <= 12 && linha.cobreAltura === true,
    'H · e a gaveta começa logo DEPOIS dela: a fatia que ela deixa de fora é a '
    + 'capa, não um pedaço do título — era isso que aparecia recortado',
    JSON.stringify(linha));
  checar(/row-acoes/.test(linha.sobONome || ''),
    'H · com a gaveta aberta, o que está sobre o título é a GAVETA — é a metade '
    + 'que denuncia o defeito de verdade, e ela cai com uma capa de outro tamanho',
    JSON.stringify(linha));

  // ── I. O CONTADOR VESTE A CAIXA DO ✕ ───────────────────────────────────
  //
  // Pedido do operador: *"faça ele ficar em formato de um botão quadrado como o
  // botão de fechar que fica em seu lado"*. Era uma pílula de 22,6×14 ao lado de
  // um quadrado de 34×34. A COR não entra na asserção: o pedido é de formato, e
  // o `--accent-fill` é o que separa a informação da ação ao lado dela.
  const cabecalho = await pgH.evaluate(() => {
    const c = document.getElementById('plPopupCount');
    const x = document.getElementById('plPopupClose');
    const cx = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
      return { w: Math.round(r.width), h: Math.round(r.height), raio: s.borderRadius }; };
    return { conta: cx(c), fechar: cx(x) };
  });
  checar(cabecalho.conta.w === cabecalho.fechar.w && cabecalho.conta.h === cabecalho.fechar.h
      && cabecalho.conta.raio === cabecalho.fechar.raio
      && cabecalho.conta.w === cabecalho.conta.h,
    'I · o contador da folha veste a MESMA caixa do ✕ ao lado — quadrado, mesmo '
    + 'raio, mesmo alvo. Os dois números saem dos mesmos tokens, então mudar o '
    + 'alvo do app move os dois juntos', JSON.stringify(cabecalho));
  await ctxH.close();

  // ── J. O RODAPÉ RESPIRA ACIMA (v1.8.60) ─────────────────────────────────
  //
  // Relato do operador sobre a v1.8.59: *"verifique a margem superior do rodapé
  // da playlist, pois está sem uma margem acima dos botões e antes do corte da
  // fronteira para a caixa do scroll, deixando o corte grudado nos botões, sem
  // margem"*. MEDIDO: **0,00px** entre a base do `#playlist` e o topo do
  // rodapé — a tira de sombra da lista encostava nos botões.
  //
  // SÃO DOIS, e é por isso que o bloco mede os dois: a playlist e o Histórico
  // são os únicos rodapés do app que ficam fora de um `.rola` sem nada entre
  // eles. Os outros quatro já tinham de 9,59 a 12,00px, por três mecanismos
  // diferentes, e não entram nesta varredura.
  //
  // A MARGEM É DO CONTÊINER, e a terceira asserção é o que impede o conserto
  // errado: pô-la na `.pl-limpar-faixa` — tentador, porque ela é o rodapé do
  // Histórico E a caixa do "Limpar" — alonga a linha flex, os dois quadrados
  // esticam para 42,4×52,0 e o rodapé continua começando onde começava. O
  // bloco A já reprova isso; esta linha diz por quê, no mesmo arquivo.
  {
    const ctxJ = await navegador.newContext({
      viewport: { width: 390, height: 900 }, hasTouch: true, colorScheme: 'dark',
    });
    await semRedeExterna(ctxJ);
    const pgJ = await ctxJ.newPage();
    await pgJ.goto(base, { waitUntil: 'load' });
    await esperarCortina(pgJ);
    await pgJ.evaluate(async () => {
      const z = (ms) => new Promise((f) => setTimeout(f, ms));
      setAppMode('full'); await z(150);
      for (let i = 0; i < 30; i++) {
        await AVDB.addMedia(new Blob(['x'], { type: 'audio/mpeg' }),
          { name: 'Louvor ' + i, type: 'audio/mpeg', kind: 'audio', list: 'imports' });
      }
      const ids = await AVDB.listIds('imports');
      for (const id of ids) await AVDB.listAdd('playlist', id);
      plItems = await AVDB.listItems('playlist');
      await load(); await z(300);
      openPlPopup(); await z(400);
    });
    const jPl = await pgJ.evaluate(() => {
      const l = document.getElementById('playlist');
      const r = document.querySelector('.pl-rodape');
      // O TOKEN É RESOLVIDO POR UMA SONDA, nunca por `parseFloat` do valor: ele
      // vale `.6rem`, e `parseFloat('.6rem')` dá **0,6** — um número que a
      // asserção compararia contra 9,59 e reprovaria um app certo.
      const sonda = document.createElement('div');
      sonda.style.cssText = 'position:absolute;visibility:hidden;height:var(--sp-5)';
      document.body.appendChild(sonda);
      const alvo = +sonda.getBoundingClientRect().height.toFixed(2);
      sonda.remove();
      const bs = [...r.querySelectorAll('button')]
        .map((b) => +b.getBoundingClientRect().height.toFixed(1));
      return { vao: +(r.getBoundingClientRect().top - l.getBoundingClientRect().bottom).toFixed(2),
        alvo, transborda: l.scrollHeight - l.clientHeight > 2,
        temTira: getComputedStyle(l, '::after').display, alturas: bs,
        larguras: [...r.querySelectorAll('.pl-pack')]
          .map((b) => +b.getBoundingClientRect().width.toFixed(1)) };
    });
    checar(jPl.transborda && jPl.temTira === 'block',
      'J · a fila TRANSBORDA e a tira de baixo está desenhada — sem ela não há '
      + '"corte grudado nos botões" a medir', JSON.stringify(jPl));
    checar(Math.abs(jPl.vao - jPl.alvo) <= 0.5,
      'J · e o rodapé da playlist respira `--sp-5` (' + jPl.vao + 'px) acima da '
      + 'lista. Era 0,00 — o token é o que a folha nomeia "entre blocos", e o '
      + 'único com precedente medido na relação idêntica (o Cronograma, 9,59px)',
      JSON.stringify(jPl));
    checar(new Set(jPl.alturas).size === 1
      && jPl.larguras.every((w) => Math.abs(w - jPl.alturas[0]) <= 0.5),
      'J · e os três botões continuam da MESMA altura, com os dois de símbolo '
      + 'ainda QUADRADOS — a margem na `.pl-limpar-faixa` os esticaria para '
      + '42,4×52,0, porque os três são irmãos flex com `align-items: stretch`',
      JSON.stringify(jPl));
    // O SEGUNDO DOENTE: o Histórico. Lá a faixa é filha DIRETA da folha, sem
    // `.pl-rodape` por volta — ela não tinha margem NENHUMA, nem nos lados.
    const jHi = await pgJ.evaluate(async () => {
      const z = (ms) => new Promise((f) => setTimeout(f, ms));
      __avBack(); await z(350);
      // Uma SESSÃO por bloco, com itens dentro — é a forma que o
      // `renderHistorico` percorre, e uma lista rasa desenharia zero linhas.
      historico = [{ inicio: Date.now() - 7200000, itens: Array.from({ length: 30 },
        (_, i) => ({ id: 'h' + i, nome: 'Louvor ' + i, t: 'media',
          em: Date.now() - i * 60000 })) }];
      openHistPopup(); await z(500);
      const l = document.getElementById('histList');
      const f = document.getElementById('histClearFaixa');
      if (!l || !f || f.hidden) return { erro: 'folha não abriu', temL: !!l, temF: !!f };
      const c = getComputedStyle(f);
      const folha = f.parentElement.getBoundingClientRect();
      const fr = f.getBoundingClientRect();
      const sonda = document.createElement('div');
      sonda.style.cssText = 'position:absolute;visibility:hidden;height:var(--sp-5)';
      document.body.appendChild(sonda);
      const alvo = +sonda.getBoundingClientRect().height.toFixed(2);
      sonda.remove();
      return { vao: +(fr.top - l.getBoundingClientRect().bottom).toFixed(2),
        alvo,
        esq: +(fr.left - folha.left).toFixed(2), dir: +(folha.right - fr.right).toFixed(2),
        transborda: l.scrollHeight - l.clientHeight > 2,
        temTira: getComputedStyle(l, '::after').display, mt: c.marginTop };
    });
    checar(!jHi.erro && jHi.transborda && jHi.temTira === 'block',
      'J · o Histórico também TRANSBORDA com a tira desenhada — é o segundo da '
      + 'família, e sem ele o conserto sairia pela metade', JSON.stringify(jHi));
    checar(!jHi.erro && Math.abs(jHi.vao - jHi.alvo) <= 0.5
      && jHi.esq > 8 && jHi.dir > 8,
      'J · e o rodapé dele ganhou as QUATRO margens (topo ' + jHi.vao + ', lados '
      + jHi.esq + '/' + jHi.dir + '). Ali a faixa é filha direta da folha, sem '
      + '`.pl-rodape` por volta: ela herdava as margens de ninguém e ficava '
      + 'colada nas duas bordas e na tira', JSON.stringify(jHi));
    await ctxJ.close();
  }

} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) {
  console.log('\n' + falhas.length + ' falha(s).');
  process.exit(1);
}
console.log('\nTodos passaram.');
