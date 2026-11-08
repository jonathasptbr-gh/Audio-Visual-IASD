// A HIDRATAÇÃO EM VOO PERDE A VEZ PARA O TOQUE.
//
// ## Por que este teste existe
//
// `load()` é a hidratação do Controle: ela lê uma dezena de chaves do IndexedDB
// e SÓ DEPOIS escreve as variáveis do módulo. Ninguém a chama com `await` — todo
// `db-change` dispara uma —, então ela corre sozinha por milissegundos enquanto
// o operador toca na tela. `send()` escreve `currentId`/`currentItem` de forma
// SÍNCRONA, na frente; o rabo da hidratação os sobrescrevia com o que o banco
// dizia ANTES do toque. É um *lost update* clássico, e é a QUARTA vez que esta
// base encontra a classe (`loadSeq`, `lyricLoadSeq`, `projecaoSeq`).
//
// O estado que sobrava — MEDIDO em arnês antes da correção — é
// `currentId: null` com `midiaNoAr: true`: o app PROJETANDO um vídeo e dizendo
// que não há item selecionado. Daí saem os três sintomas, e nenhum deles aponta
// para cá:
//
//  - o item deixa de estar SELECIONADO, e repetir a faixa com o ▶ morre;
//  - o ▶ cai em `send(undefined)` → `getMedia(undefined)` → `DataError`, uma
//    exceção no meio do transporte;
//  - `resendSceneToDisplay` pergunta `midiaNoAr && currentId`: um telão que
//    reconectasse nesse estado voltaria VAZIO, com a mídia tocando.
//
// Ele é intermitente por natureza — depende de a máquina ser lenta o bastante
// para a hidratação ainda estar em voo quando o dedo chega. Foi assim que ele
// derrubou o `cena.test.mjs` no runner (55/56, com o `web-ota` pulado) passando
// 7/7 na máquina de quem escreve. Por isso o hazard aqui é montado À MÃO, e não
// esperado de um percurso: um oráculo que depende da carga da máquina não pode
// guardar um portão.
//
// ## As quatro metades, e nenhuma basta sozinha
//
//  1. O HAZARD, na forma antiga (`db-estado.test.mjs` faz o mesmo): ler o banco
//     e aplicar sem senha nenhuma PERDE. Sem esta, a metade 2 provaria só que
//     uma função concorda consigo mesma.
//  2. Com o `load()` de verdade em voo, o TOQUE VENCE.
//  3. Sem toque nenhum, a hidratação CONTINUA restaurando a cena — senão "não
//     aplicar nunca" passaria na 2.
//
// (O bloco 6 é a mesma classe na ESCRITA: a limpeza da seleção da abertura,
// `clearCurrentSelection`, contra um `persistCurrent` que corre junto. O 7 é o
// GIRO e o PREENCHER tocados com um `load()` em voo — `fitSeq`/`rotSeq`. O 8 é
// o ↑↓ de uma linha, `moverNaLista`, contra um `listAdd` que corre junto. O 9
// é o botão do Cronograma e o da playlist tocados com um `load()` em voo —
// `listasSeq` —, o 10 o "Tocar agora" (`replacePlaylistWith`), na mesma senha, e o
// 11 a cena de letra (`addLyricCue`) mandada à playlist e aos Favoritos, e o 12
// a playlist automática (`guardarSorteadas`/`montarFilaSorteada`). O 13 é o
// resgate dos downloads da abertura contra um `lembrarIntencao` do vão. O 14 é
// a GAVETA (`adicionarNasListas`) e o 15 o PACOTE (`abrirPacote`) — os dois
// chamadores da lista que ficaram sem a senha até a revisão X2.)
//
// E a quarta, que separa CENA de CONFIGURAÇÃO: durante a corrida a hidratação
// pula a SELEÇÃO e aplica o resto. Sem ela, o conserto barato (um `return` no
// topo da FASE 2) passa nas três acima e deixa o app com o tema, o corpo da
// letra e a velocidade da rolagem da sessão anterior.
//
//   node tools/hidratacao-perde-a-vez.test.mjs
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
  // Esperar pelo FATO (o app de pé), nunca por um prazo: é a mesma condição que
  // o watchdog de boot do OTA pergunta.
  await pg.waitForFunction(
    () => window.AVDB && typeof window.__avBack === 'function' && (!!document.querySelector('#playlist li') || document.getElementById('plBtn').disabled),
    null, { timeout: 30000 },
  );
  await pg.evaluate(() => setAppMode('full'));

  // Duas mídias no Cronograma. DUAS porque a corrida precisa de um "antes" e um
  // "depois" distinguíveis: com uma só, "o toque venceu" e "a hidratação
  // sobrescreveu" produzem o mesmo `currentId`.
  const ids = await pg.evaluate(async () => {
    const cria = (nome) => AVDB.addMedia(new Blob([new Uint8Array(64)], { type: 'video/mp4' }),
      { name: nome, type: 'video/mp4', kind: 'video', list: 'imports' });
    const a = await cria('Louvor A');
    const b = await cria('Louvor B');
    await load();
    return { a: a.id, b: b.id };
  });

  // ── 1. O HAZARD, ESCRITO À MÃO ────────────────────────────────────────────
  // A FORMA ANTIGA da FASE 2, reescrita aqui: ler `current` e aplicar depois
  // dos `await`s, sem perguntar a ninguém se ainda é a vez de quem leu. É o que
  // `load()` fazia, e o que qualquer hidratação futura vai voltar a fazer se
  // ninguém lembrar.
  checar(await pg.evaluate(async ({ a, b }) => {
    await send(a);                       // a cena é A
    const hidratarSemSenha = async () => {
      const cur = await AVDB.getState('current');        // FASE 1
      await AVDB.getState('repeat');                     // ... os outros await
      currentId = cur && cur.mediaId ? cur.mediaId : null; // FASE 2, sem senha
    };
    const emVoo = hidratarSemSenha();    // a hidratação parte
    await send(b);                       // e o operador toca em B na frente dela
    await emVoo;                         // ela termina DEPOIS
    return currentId === a;              // voltou para A: o toque foi perdido
  }, ids), 'aplicar a leitura sem senha PERDE o toque que chegou no meio (o defeito)',
  await pg.evaluate(() => currentId));

  // ── 2. O `load()` DE VERDADE: O TOQUE VENCE ───────────────────────────────
  // Determinístico por construção, e não por velocidade: `send()` acha o
  // registro nas listas já carregadas e escreve `currentId` SEM `await` nenhum,
  // então ele chega sempre na frente; e `await emVoo` garante que a FASE 2 da
  // hidratação já rodou quando medimos.
  const corrida = await pg.evaluate(async ({ a, b }) => {
    await send(a);
    await AVDB.setState('repeat', 'one');   // uma CONFIGURAÇÃO nova, para a metade 4
    repeat = 'off';
    const emVoo = load();                   // como todo `db-change` a dispara
    await send(b);                          // o operador toca enquanto ela lê
    await emVoo;
    return {
      id: currentId,
      nome: currentItem && currentItem.name,
      noAr: midiaNoAr,
      repeat,
    };
  }, ids);
  checar(corrida.id === ids.b,
    'com um load() em voo, o toque VENCE: `currentId` continua sendo o do toque', corrida.id);
  checar(corrida.nome === 'Louvor B',
    'e `currentItem` vai junto — senão o transporte e a notificação descrevem a mídia anterior',
    corrida.nome);
  checar(corrida.noAr === true && !!corrida.id,
    'nunca sobra "há mídia no ar" com seleção nenhuma — era esse estado que apagava o reenvio de cena',
    corrida);

  // ── 2b. A MESMA CORRIDA NA ABERTURA, que é a forma que derrubou o CI ──────
  // Ali o banco diz `mediaId: null` — `clearCurrentSelection` zera a seleção a
  // cada sessão nova —, então o que a hidratação sobrescrevia não era um id
  // velho: era NADA. É a diferença entre "voltou para a música anterior" e o
  // estado impossível `currentId: null` com `midiaNoAr: true`, de onde sai a
  // exceção. O `db-change` do `addMedia` é o que dispara a hidratação em voo no
  // app de verdade; aqui ela é chamada à mão para o oráculo não depender de
  // quanto a máquina demora.
  const abertura = await pg.evaluate(async ({ b }) => {
    await AVDB.setState('current', { mediaId: null, noAr: false, view: 'visual', muted: false, volume: 1 });
    currentId = null; currentItem = null; midiaNoAr = false;
    const emVoo = load();
    await send(b);
    await emVoo;
    return { id: currentId, noAr: midiaNoAr };
  }, ids);
  checar(abertura.id === ids.b && abertura.noAr === true,
    'e na ABERTURA (banco sem seleção) o toque também vence — era daqui que saía `currentId: null` com mídia no ar',
    abertura);

  // O ▶ DEPOIS DELA. É a exceção que derrubou o CI, exercitada pelo caminho
  // real: `send(currentId)` com `currentId` nulo vira `getMedia(undefined)` →
  // `DataError`.
  let excecao = '';
  try {
    await pg.evaluate(async () => { await send(currentId); });
  } catch (e) { excecao = (e && e.message) || String(e); }
  checar(!excecao, 'e o ▶ seguinte não lança (era o DataError de `getMedia(undefined)`)', excecao);

  // ── 3. SEM TOQUE, A HIDRATAÇÃO CONTINUA RESTAURANDO A CENA ────────────────
  // A metade que impede o conserto por amputação. O caso é real e não é o da
  // abertura (ali `clearCurrentSelection` já zerou a seleção): é a página NOVA
  // depois de o renderer morrer ou de o OTA ser aplicado, em que a memória está
  // vazia e o banco é a única fonte do que estava em cena.
  const hidratou = await pg.evaluate(async ({ a }) => {
    await send(a);
    currentId = null; currentItem = null;   // a memória de uma página recém-carregada
    await load();                           // e nenhum toque concorrente
    return { id: currentId, nome: currentItem && currentItem.name };
  }, ids);
  checar(hidratou.id === ids.a && hidratou.nome === 'Louvor A',
    'sem toque nenhum, a hidratação RESTAURA a cena que estava no banco', hidratou);

  // ── 4. A CENA É PULADA; A CONFIGURAÇÃO, NUNCA ─────────────────────────────
  // A régua do lote: `currentId`/`currentItem` são a SELEÇÃO, que o toque
  // decide; tema, corpo da letra, velocidade da rolagem e o resto são
  // configuração, e ninguém compete por eles. Um `return` no topo da FASE 2
  // passa nas três metades acima e reprova aqui.
  checar(corrida.repeat === 'one',
    'e durante a MESMA corrida a configuração foi aplicada (a senha vale só para a seleção)',
    corrida.repeat);
  // ── 5. O TERCEIRO PAR: load × recarregarFavoritos (v1.8.0) ────────────────
  //
  // `recarregarFavoritos` e a UNICA funcao fora do `load()` que escreve
  // `favSet` e `favItems`, e escrevia-os sem senha nenhuma. O `loadSeqCtl` nao
  // a alcanca — ele resolve load x load, e ninguem a incrementava —, entao um
  // `load()` que leu os favoritos ANTES de um `listRemove` voltava e aplicava a
  // lista velha: o favorito excluido VOLTA para a tela, e fica, porque so quem
  // mexe nos favoritos redesenha aquela secao.
  //
  // MEDIDO no `boot-nativo.test.mjs` sob carga, antes da correcao:
  // `nosFavs: false` com `naLista: true` oito segundos depois da exclusao.
  //
  // A ORDEM E FORCADA A MAO, e nao esperada da maquina: o oraculo espera o
  // `load()` PASSAR pela leitura dos favoritos e so entao exclui. Sem isso o
  // percurso as vezes le depois da exclusao, acerta por acaso, e a reversao nao
  // reprova — que e a definicao de um oraculo que mede o runner.
  const semear = async () => pg.evaluate(async ({ a, b }) => {
    for (const id of [a, b]) {
      if (!(await AVDB.listIds('favs')).includes(id)) await AVDB.listAdd('favs', id);
    }
    await recarregarFavoritos();
  }, ids);

  // 5a. O HAZARD: a forma SEM senha perde a exclusao que chegou no meio.
  await semear();
  checar(await pg.evaluate(async ({ a }) => {
    // A forma ANTIGA de `recarregarFavoritos`/da FASE 2: ler e aplicar sem
    // perguntar se ainda e a vez de quem leu.
    // OS DOIS PORTOES SAO O QUE TORNA O HAZARD DETERMINISTICO. Sem eles a
    // ordem de conclusao decide, e MEDIDO ela cai quase sempre do lado bom: a
    // hidratacao aplica ANTES do `recarregarFavoritos`, o certo escreve por
    // ultimo, e o defeito nao aparece. O que se quer medir e a ordem RUIM —
    // ler antes da exclusao e aplicar depois dela —, que e a que a maquina
    // lenta produz sozinha.
    let leu; let liberar;
    const jaLeu = new Promise((pronto) => { leu = pronto; });
    const portao = new Promise((pronto) => { liberar = pronto; });
    const hidratarSemSenha = async () => {
      const idsV = await AVDB.listIds('favs');
      const itensV = await AVDB.listItems('favs');
      leu();                               // leu com o item AINDA nos favoritos
      await portao;                        // e so aplica depois da exclusao
      favSet = new Set(idsV);
      favItems = itensV;
    };
    const emVoo = hidratarSemSenha();
    await jaLeu;
    await AVDB.listRemove('favs', a);      // o operador exclui na frente dela
    await recarregarFavoritos();
    liberar();
    await emVoo;                           // e ela termina DEPOIS
    return favSet.has(a);                  // o excluido VOLTOU: o defeito
  }, ids), 'aplicar os favoritos sem senha faz o item EXCLUIDO voltar (o defeito)',
  String(await pg.evaluate(() => favItems.length)));

  // 5b. O `load()` DE VERDADE, com a leitura dos favoritos ja passada.
  await semear();
  const favCorrida = await pg.evaluate(async ({ a }) => {
    // O SINAL: `load()` avisa quando terminou de ler os favoritos, e o metodo
    // volta ao original no mesmo instante — `recarregarFavoritos` logo abaixo
    // chama o mesmo `listItems` e nao pode cair no espiao.
    const orig = AVDB.listItems.bind(AVDB);
    const passou = new Promise((pronto) => {
      AVDB.listItems = async (lista) => {
        const saida = await orig(lista);
        if (lista === 'favs') { AVDB.listItems = orig; pronto(); }
        return saida;
      };
    });
    const emVoo = load();
    await passou;                          // o load() JA leu os favoritos
    await AVDB.listRemove('favs', a);      // e so entao a exclusao acontece
    await recarregarFavoritos();
    await emVoo;
    return { noSet: favSet.has(a), naLista: favItems.some((m) => m.id === a) };
  }, ids);
  checar(favCorrida.noSet === false && favCorrida.naLista === false,
    'com um load() em voo, a EXCLUSAO vence: o favorito nao volta para `favSet` nem para `favItems`',
    JSON.stringify(favCorrida));

  // 5c. E SEM exclusao concorrente a hidratacao CONTINUA trazendo os favoritos
  //     — senao "nunca aplicar" passaria na metade acima.
  await semear();
  const favSozinho = await pg.evaluate(async ({ b }) => {
    favSet = new Set(); favItems = [];     // a memoria de uma pagina recem-carregada
    await load();
    return { noSet: favSet.has(b), naLista: favItems.some((m) => m.id === b) };
  }, ids);
  checar(favSozinho.noSet === true && favSozinho.naLista === true,
    'e sem exclusao nenhuma o load() RESTAURA os favoritos do banco', JSON.stringify(favSozinho));

  // ── 6. A LIMPEZA DA SELEÇÃO NA ABERTURA NÃO DESFAZ UM `persistCurrent` ────
  // `clearCurrentSelection` zera o `mediaId` de `current`, a chave que o
  // `persistCurrent` grava inteira (volume, mudo, cortina). Feita como
  // `getState` + `setState`, um `persistCurrent` que entrasse no vão era
  // desfeito: a releitura da limpeza era ANTERIOR a ele. A ordem é
  // determinística — a leitura da limpeza abre a transação primeiro, e a
  // escrita dela sai depois da do `persistCurrent`.
  const cena6 = await pg.evaluate(async ({ a, b }) => {
    await AVDB.setState('current', { mediaId: a, noAr: false, view: 'visual', muted: false, volume: 1, at: 1 });
    const antes = { volume, currentId };
    volume = 0.3; currentId = b;
    const limpeza = clearCurrentSelection();   // a limpeza da abertura parte
    const gravou = persistCurrent();           // e um persistCurrent corre junto
    await Promise.all([limpeza, gravou]);
    volume = antes.volume; currentId = antes.currentId;
    return AVDB.getState('current');
  }, ids);
  checar(!!cena6 && cena6.volume === 0.3 && cena6.mediaId === ids.b,
    'a limpeza da seleção corre junto de um persistCurrent sem desfazê-lo (volume e seleção dele ficam)',
    JSON.stringify(cena6));
  // E SOZINHA ela continua limpando — senão "nunca escrever" passaria acima.
  const so6 = await pg.evaluate(async ({ a }) => {
    await AVDB.setState('current', { mediaId: a, noAr: false, view: 'visual', muted: false, volume: 0.7, at: 1 });
    await clearCurrentSelection();
    return AVDB.getState('current');
  }, ids);
  checar(!!so6 && so6.mediaId === null && so6.volume === 0.7,
    'e sozinha ela zera só a seleção: o volume da mesa fica', JSON.stringify(so6));

  // ── 7. GIRAR E PREENCHER DURANTE UM `load()` EM VOO ───────────────────────
  // A FASE 1 lê `fit` e `rotate`; um toque no vão grava o valor novo e o manda
  // ao telão, e a FASE 2 aplicava o lido — o tile e a preview voltavam ao valor
  // velho com o telão girado. A ordem é forçada: o espião avisa quando o
  // `load()` JÁ leu `rotate` (a segunda das duas), e só então o operador toca.
  const ajuste7 = await pg.evaluate(async () => {
    await applyFit('contain'); await applyRotate(0);
    const orig = AVDB.getState.bind(AVDB);
    const passou = new Promise((pronto) => {
      AVDB.getState = async (k) => {
        const v = await orig(k);
        if (k === 'rotate') { AVDB.getState = orig; pronto(); }
        return v;
      };
    });
    const emVoo = load();
    await passou;                                  // o load() JÁ leu fit e rotate
    const toques = Promise.all([applyFit('cover'), applyRotate(90)]);
    await emVoo;
    await toques;
    return {
      rot: mediaRot, fit: mediaFit,
      tileRot: rotBtnEl.dataset.estado, tileFit: fitTileEl.dataset.estado,
      pvRot: preview.getRotate(), pvFit: pvVideoEl.style.objectFit,
    };
  });
  checar(ajuste7.rot === 90 && ajuste7.tileRot === '90' && ajuste7.pvRot === 90,
    'GIRAR com um load() em voo: o giro FICA (variável, tile e preview com 90°)', JSON.stringify(ajuste7));
  checar(ajuste7.fit === 'cover' && ajuste7.tileFit === 'cover' && ajuste7.pvFit === 'cover',
    'PREENCHER com um load() em voo: o preenchimento FICA (variável, tile e preview em cover)', JSON.stringify(ajuste7));
  // E SEM toque nenhum a hidratação CONTINUA trazendo os dois do banco — senão
  // "nunca aplicar" passaria acima.
  const so7 = await pg.evaluate(async () => {
    await AVDB.setState('fit', 'cover'); await AVDB.setState('rotate', 180);
    mediaFit = 'contain'; mediaRot = 0;            // a memória de uma página recém-carregada
    await load();
    const r = { rot: mediaRot, fit: mediaFit, pvRot: preview.getRotate() };
    await applyFit('contain'); await applyRotate(0);
    return r;
  });
  checar(so7.rot === 180 && so7.fit === 'cover' && so7.pvRot === 180,
    'e sem toque nenhum o load() RESTAURA o giro e o preenchimento do banco', JSON.stringify(so7));

  // ── 8. MOVER UMA CASA NÃO DESFAZ UM `listAdd` DO VÃO ──────────────────────
  // O ↑↓ de uma linha (`moverNaLista`) lia a lista e gravava o array depois: o
  // download que termina por `addMediaToList` no meio sumia da lista, e o
  // coletor do `listSet` apagava o registro. O espião põe o `listAdd` no vão
  // da forma antiga (se ela ler a lista), e um segundo corre junto na nova.
  const mover8 = await pg.evaluate(async ({ a, b }) => {
    await AVDB.listSet('imports', [a, b]);
    const c = await AVDB.addMedia(new Blob([new Uint8Array(64)], { type: 'video/mp4' }),
      { name: 'Baixado no vão', type: 'video/mp4', kind: 'video', list: 'avulsos' });
    const orig = AVDB.listIds;
    AVDB.listIds = async (n) => {
      AVDB.listIds = orig;
      const r = await orig(n);
      await AVDB.listAdd(n, c.id);   // o download termina enquanto o mover pensa
      return r;
    };
    try {
      const mover = moverNaLista('imports', a, 1);
      const junto = AVDB.listAdd('imports', c.id);
      await Promise.all([mover, junto]);
    } finally { AVDB.listIds = orig; }
    await AVDB.listRemove('avulsos', c.id);
    const r = { ids: await AVDB.listIds('imports'), c: c.id, existe: !!(await AVDB.getMedia(c.id)) };
    // E SOZINHO ele continua movendo — senão "nunca gravar" passaria acima.
    await moverNaLista('imports', a, -1);
    r.depois = await AVDB.listIds('imports');
    return r;
  }, ids);
  checar(mover8.ids.includes(mover8.c) && mover8.existe,
    'mover uma linha com um listAdd no vão: o item que chegou FICA na lista e no banco', JSON.stringify(mover8));
  checar(mover8.ids.indexOf(ids.a) === mover8.ids.indexOf(ids.b) + 1,
    'e o mover andou uma casa (A depois de B)', JSON.stringify(mover8.ids));
  checar(mover8.depois[0] === ids.a && mover8.depois[1] === ids.b,
    'e sozinho o mover devolve A ao topo', JSON.stringify(mover8.depois));

  // ── 9. O BOTÃO DO CRONOGRAMA E O DA PLAYLIST COM UM `load()` EM VOO ───────
  // `toggleCronograma`/`togglePlaylist` gravam e releem a lista; um `load()` que
  // já a leu ANTES do toque aplicava a cópia velha DEPOIS dele — o item ficava
  // no banco e fora de `cronoSet`/`libItems`/`plItems` (fora da lista na tela e
  // da fila do ⏭) até o próximo `load()`. A ordem é forçada: o espião segura o
  // `load()` logo depois da leitura da lista, o toque acontece inteiro, e só
  // então a hidratação continua.
  const toque9 = await pg.evaluate(async ({ a, b }) => {
    await AVDB.listSet('imports', [a]);
    await AVDB.listSet('playlist', []);
    await load();
    const recB = await AVDB.getMedia(b);
    const segurarDepoisDe = (lista) => {
      const orig = AVDB.listItems;
      let liberar;
      const portao = new Promise((p) => { liberar = p; });
      const leu = new Promise((pronto) => {
        AVDB.listItems = async (n) => {
          const r = await orig(n);
          if (n === lista) { AVDB.listItems = orig; pronto(); await portao; }
          return r;
        };
      });
      return { leu, liberar, restaurar: () => { AVDB.listItems = orig; } };
    };
    const botao = () => document.createElement('button');
    const r = {};
    // O Cronograma: `listItems('imports')` é a ÚLTIMA leitura de lista do `load()`.
    let g = segurarDepoisDe('imports');
    try {
      const emVoo = load();
      await g.leu;
      await toggleCronograma(recB, botao());
      g.liberar();
      await emVoo;
    } finally { g.restaurar(); }
    r.cronoSet = cronoSet.has(b);
    r.libItems = libItems.some((m) => m.id === b);
    r.cronoBanco = (await AVDB.listIds('imports')).includes(b);
    // A playlist: `listItems('playlist')` é a PRIMEIRA.
    g = segurarDepoisDe('playlist');
    try {
      const emVoo = load();
      await g.leu;
      await togglePlaylist(recB, botao());
      g.liberar();
      await emVoo;
    } finally { g.restaurar(); }
    r.plItems = plItems.some((m) => m.id === b);
    r.plBanco = (await AVDB.listIds('playlist')).includes(b);
    // E SEM toque nenhum o `load()` CONTINUA trazendo as duas do banco — senão
    // "nunca aplicar" passaria acima.
    cronoSet = new Set(); libItems = []; plItems = [];
    await load();
    r.soCrono = cronoSet.has(b) && libItems.some((m) => m.id === b);
    r.soPl = plItems.some((m) => m.id === b);
    await AVDB.listSet('playlist', []);
    await AVDB.listSet('imports', [a, b]);
    await load();
    return r;
  }, ids);
  checar(toque9.cronoBanco && toque9.cronoSet && toque9.libItems,
    'pôr no Cronograma com um load() em voo: o item FICA em cronoSet e libItems', JSON.stringify(toque9));
  checar(toque9.plBanco && toque9.plItems,
    'pôr na playlist com um load() em voo: o item FICA em plItems', JSON.stringify(toque9));
  checar(toque9.soCrono && toque9.soPl,
    'e sem toque nenhum o load() RESTAURA o Cronograma e a playlist do banco', JSON.stringify(toque9));

  // ── 10. O "TOCAR AGORA" (`replacePlaylistWith`) COM UM `load()` EM VOO ────
  // A fila vira SÓ o item tocado; um `load()` que leu a fila ANTES aplicava a
  // cópia velha DEPOIS — o banco com [B] e `plItems` com [A], e o ⏭/fim da faixa
  // seguindo a fila que o toque acabou de trocar. Mesma ordem forçada do 9.
  const toque10 = await pg.evaluate(async ({ a, b }) => {
    await AVDB.listSet('playlist', [a]);
    await load();
    const recB = await AVDB.getMedia(b);
    const orig = AVDB.listItems;
    let liberar;
    const portao = new Promise((p) => { liberar = p; });
    const leu = new Promise((pronto) => {
      AVDB.listItems = async (n) => {
        const r = await orig(n);
        if (n === 'playlist') { AVDB.listItems = orig; pronto(); await portao; }
        return r;
      };
    });
    const r = {};
    try {
      const emVoo = load();
      await leu;
      await replacePlaylistWith(recB);
      liberar();
      await emVoo;
    } finally { AVDB.listItems = orig; }
    r.plItems = plItems.map((m) => m.id);
    r.banco = await AVDB.listIds('playlist');
    await AVDB.listSet('playlist', []);
    await load();
    return r;
  }, ids);
  checar(toque10.banco.length === 1 && toque10.banco[0] === ids.b
      && toque10.plItems.length === 1 && toque10.plItems[0] === ids.b,
    'Tocar agora com um load() em voo: plItems FICA só com o item tocado', JSON.stringify(toque10));

  // ── 11. A CENA DE LETRA (`addLyricCue`) NA PLAYLIST E NOS FAVORITOS ───────
  // A variante "Letra" mandada à playlist entrava no banco e não em `plItems`
  // (nem na tela, nem na fila do ⏭) até o próximo `load()`; mandada ao
  // Cronograma + Favoritos, não entrava em `favItems`. A playlist é testada com
  // um `load()` em voo segurado depois da leitura dela — a ordem forçada do 9.
  const toque11 = await pg.evaluate(async () => {
    await AVDB.listSet('playlist', []);
    await load();
    const coll = { id: 'album-oraculo', name: 'Álbum do oráculo', kind: 'album' };
    const orig = AVDB.listItems;
    let liberar;
    const portao = new Promise((p) => { liberar = p; });
    const leu = new Promise((pronto) => {
      AVDB.listItems = async (n) => {
        const r = await orig(n);
        if (n === 'playlist') { AVDB.listItems = orig; pronto(); await portao; }
        return r;
      };
    });
    const r = {};
    try {
      const emVoo = load();
      await leu;
      await addLyricCue(coll, { id_music: 9101, name: 'Letra na fila', track: 1 }, null, ['playlist']);
      liberar();
      await emVoo;
    } finally { AVDB.listItems = orig; }
    r.plItems = plItems.map((m) => m.name);
    r.plBanco = (await AVDB.listItems('playlist')).map((m) => m.name);
    await addLyricCue(coll, { id_music: 9102, name: 'Letra favorita', track: 2 }, null, ['imports', 'favs']);
    r.favItems = favItems.map((m) => m.name);
    r.favBanco = (await AVDB.listItems('favs')).map((m) => m.name);
    await AVDB.listSet('playlist', []);
    await load();
    return r;
  });
  checar(toque11.plBanco.includes('Letra na fila') && toque11.plItems.includes('Letra na fila'),
    'a letra mandada à playlist (com um load() em voo) ENTRA em plItems', JSON.stringify(toque11));
  checar(toque11.favBanco.includes('Letra favorita') && toque11.favItems.includes('Letra favorita'),
    'a letra mandada ao Cronograma + Favoritos ENTRA em favItems', JSON.stringify(toque11));

  // ── 12. A PLAYLIST AUTOMÁTICA COM UM `load()` EM VOO ──────────────────────
  // `guardarSorteadas` (o sorteio guardado no fim da playlist) e
  // `montarFilaSorteada` (o sorteio que vira a fila) gravam e releem `plItems`
  // SEM `load()` depois: um `load()` que leu a fila ANTES aplicava a cópia velha
  // DEPOIS, e o ⏭/fim da faixa seguia a fila de antes do sorteio. O download é
  // trocado por um mapa (o caminho dele não é o que se mede); a ordem forçada é
  // a do 9.
  const toque12 = await pg.evaluate(async ({ a, b }) => {
    await AVDB.listSet('playlist', [a]);
    await load();
    const origResolver = window.resolveSongMediaId;
    window.resolveSongMediaId = async (_c, s) => (s.id_music === 1 ? a : b);
    const coll = { id: 'album-oraculo', name: 'Álbum do oráculo', kind: 'album' };
    const escolha = (n) => ({ coll, s: { id_music: n, name: 'Faixa ' + n, track: n }, variante: 'full', noAparelho: true });
    const emVooDepoisDaFila = async (toque) => {
      const orig = AVDB.listItems;
      let liberar;
      const portao = new Promise((p) => { liberar = p; });
      const leu = new Promise((pronto) => {
        AVDB.listItems = async (n) => {
          const r = await orig(n);
          if (n === 'playlist') { AVDB.listItems = orig; pronto(); await portao; }
          return r;
        };
      });
      try {
        const emVoo = load();
        await leu;
        await toque();
        liberar();
        await emVoo;
      } finally { AVDB.listItems = orig; }
    };
    const r = {};
    try {
      await emVooDepoisDaFila(() => guardarSorteadas([escolha(1), escolha(2)], document.createElement('button'), {}, 'playlist'));
      r.guardar = plItems.map((m) => m.id);
      r.guardarBanco = await AVDB.listIds('playlist');
      await emVooDepoisDaFila(() => montarFilaSorteada([escolha(2)]));
      r.montar = plItems.map((m) => m.id);
      r.montarBanco = await AVDB.listIds('playlist');
    } finally { window.resolveSongMediaId = origResolver; }
    await AVDB.listSet('playlist', []);
    await load();
    return r;
  }, ids);
  checar(toque12.guardarBanco.length === 2 && toque12.guardar.join() === toque12.guardarBanco.join(),
    'o sorteio guardado no fim da playlist (com um load() em voo) ENTRA em plItems', JSON.stringify(toque12));
  checar(toque12.montarBanco.length === 1 && toque12.montarBanco[0] === ids.b
      && toque12.montar.join() === toque12.montarBanco.join(),
    'o sorteio que vira a fila (com um load() em voo): plItems FICA com a fila sorteada', JSON.stringify(toque12));

  // ── 13. O RESGATE DOS DOWNLOADS NÃO APAGA UMA INTENÇÃO DO VÃO ─────────────
  // `resgatarDownloads` (abertura, só no app) lê `ytIntencoes` e a limpa antes
  // de tentar. Feito como `getState` + `setState`, um `lembrarIntencao` entre
  // os dois era apagado sem ter sido lido: o download novo perdia o registro
  // que o faria ser reclamado se o renderer morresse. O gancho põe a intenção
  // nova logo DEPOIS da leitura do resgate (na forma atômica, depois da
  // transação inteira); a velha vence o prazo e sai pelo caminho de sempre.
  const r13 = await pg.evaluate(async () => {
    const velha = { link: 'https://youtu.be/oraculo-velha', quando: 0, lista: 'imports' };
    const nova = { link: 'https://youtu.be/oraculo-nova', quando: Date.now(), lista: 'imports' };
    await AVDB.setState('ytIntencoes', [velha]);
    const origGet = AVDB.getState;
    const origUpd = AVDB.updateState;
    const depois = (orig) => async (...a) => {
      const r = await orig(...a);
      if (a[0] === 'ytIntencoes') {
        AVDB.getState = origGet; AVDB.updateState = origUpd;
        await lembrarIntencao(nova);
      }
      return r;
    };
    AVDB.getState = depois(origGet);
    AVDB.updateState = depois(origUpd);
    const nativo = window.__NATIVE__;
    window.__NATIVE__ = true;
    try { await resgatarDownloads(); } finally {
      window.__NATIVE__ = nativo;
      AVDB.getState = origGet; AVDB.updateState = origUpd;
    }
    const fim = ((await AVDB.getState('ytIntencoes')) || []).map((i) => i.link);
    await AVDB.setState('ytIntencoes', []);
    return fim;
  });
  checar(r13.length === 1 && r13[0] === 'https://youtu.be/oraculo-nova',
    'o resgate da abertura limpa a intenção velha sem apagar a que entrou no vão', JSON.stringify(r13));
  // ── 14. A GAVETA DE UM ITEM (`adicionarNasListas`) COM UM `load()` EM VOO ──
  // A gaveta da Biblioteca grava em mais de uma lista e relê `plItems` — e era
  // um dos dois chamadores que faltavam da senha do bloco 9: um `load()` que leu
  // a playlist ANTES do toque aplicava a cópia velha DEPOIS, e o item ficava no
  // banco e fora de `plItems` (fora da lista e da fila do ⏭) até o próximo
  // desenho por outro motivo. A ordem é a forçada do 9.
  //
  // SÓ A PLAYLIST, e o motivo é de MÉTODO: o destino Cronograma faz a gaveta
  // terminar num `load()` próprio, que sobe o `loadSeqCtl` e faz o `load()` de
  // fora se descartar sozinho — a asserção passaria com e sem o conserto
  // (tautologia). A metade do Cronograma é o bloco 2, com a outra senha.
  const toque14 = await pg.evaluate(async ({ a, b }) => {
    await AVDB.listSet('playlist', [a]);
    await AVDB.listSet('favs', []);
    await load();
    const orig = AVDB.listItems;
    let liberar;
    const portao = new Promise((p) => { liberar = p; });
    const leu = new Promise((pronto) => {
      AVDB.listItems = async (n) => {
        const r = await orig(n);
        if (n === 'playlist') { AVDB.listItems = orig; pronto(); await portao; }
        return r;
      };
    });
    const r = {};
    try {
      const emVoo = load();
      await leu;
      await adicionarNasListas(['playlist'], b, document.createElement('button'));
      liberar();
      await emVoo;
    } finally { AVDB.listItems = orig; }
    r.plItems = plItems.map((m) => m.id);
    r.banco = await AVDB.listIds('playlist');
    await AVDB.listSet('playlist', []);
    await load();
    return r;
  }, ids);
  checar(toque14.banco.includes(ids.b) && toque14.plItems.includes(ids.b),
    'a gaveta põe na playlist (com um load() em voo): o item FICA em plItems', JSON.stringify(toque14));

  // ── 15. O PACOTE (`abrirPacote`) COM UM `load()` EM VOO ────────────────────
  // O pacote troca a fila inteira por `trocarFila`, que NÃO sobe a senha (não é
  // um toque de lista). Sem a senha no `abrirPacote`, um `load()` em voo
  // aplicava a fila de ANTES por cima do pacote: `plItems` com a fila velha, o
  // ⏭ seguindo a errada, e o bloco de louvores da abertura indo ao telão fora
  // de ordem depois da primeira faixa.
  const toque15 = await pg.evaluate(async ({ a, b }) => {
    await AVDB.listSet('playlist', [a]);
    await load();
    const orig = AVDB.listItems;
    let liberar;
    const portao = new Promise((p) => { liberar = p; });
    const leu = new Promise((pronto) => {
      AVDB.listItems = async (n) => {
        const r = await orig(n);
        if (n === 'playlist') { AVDB.listItems = orig; pronto(); await portao; }
        return r;
      };
    });
    const r = {};
    try {
      const emVoo = load();
      await leu;
      await abrirPacote({ ids: [b] }, null);
      liberar();
      await emVoo;
    } finally { AVDB.listItems = orig; }
    r.plItems = plItems.map((m) => m.id);
    r.banco = await AVDB.listIds('playlist');
    await AVDB.listSet('playlist', []);
    await load();
    return r;
  }, ids);
  checar(toque15.banco.length === 1 && toque15.banco[0] === ids.b
      && toque15.plItems.length === 1 && toque15.plItems[0] === ids.b,
    'abrir um pacote com um load() em voo: plItems FICA só com a fila do pacote', JSON.stringify(toque15));
} catch (e) {
  checar(false, 'o percurso terminou sem exceção (' + (e && e.message) + ')');
}

await navegador.close();
servidor.close();
console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
