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
    () => window.AVDB && typeof window.__avBack === 'function' && !!document.querySelector('#playlist li'),
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
} catch (e) {
  checar(false, 'o percurso terminou sem exceção (' + (e && e.message) + ')');
}

await navegador.close();
servidor.close();
console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
