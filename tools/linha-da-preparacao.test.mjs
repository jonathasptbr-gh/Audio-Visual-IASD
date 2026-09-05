#!/usr/bin/env node
// ============================================================================
// A LINHA DO CRONOGRAMA DURANTE UMA PREPARAÇÃO — a faixa de progresso e a seta.
//
// ## Os dois defeitos, e por que os dois são MUDOS
//
// Pedido do operador, sobre a preparação de uma apresentação: *"ajuste a
// ilustração da representação do progresso no item do cronograma, atualmente
// ele só tem a porcentagem, mas gostaria que usasse a posição do texto
// secundário para uma barra de progresso, e a fração das páginas já
// preparadas"* · *"toque o ícone da thumbnail que ainda fica um ícone de seta de
// download. Use outra coisa … ou deixe sem ícone, só o spinner"*.
//
//  1. **A LEGENDA QUE ERA JOGADA FORA.** `libBusy.atualizar` recebia os três
//     argumentos e usava um: `atualizar(_acao, _nome, pct)`. A fração já
//     viajava — "Preparando página 12 de 40…" — e morria ali, e o que sobrava
//     na linha era um percentual solto. Nada erra, nada aparece no console: a
//     apresentação é importada e fica correta no fim.
//  2. **A SETA QUE MENTIA.** O `.dl-ring` são dois desenhos, e a seta afirma
//     "bytes chegando". A regra que a torna condicional existe desde a v1.4.19
//     — e valia só no CARTÃO da preview. Na miniatura da LINHA a seta era
//     desenhada em toda espera, inclusive numa preparação, que não baixa byte
//     nenhum.
//
// ## E o que a v1.7.2 acrescentou
//
//  3. **A BARRA SAIU** — *"O subtitulo com as informações ficou muito bom, mas
//     a barra de progresso ficou ruim, tire ela."* A asserção passou a ser
//     NEGATIVA e vale para a linha inteira: nenhum trilho, nenhum
//     preenchimento, nenhum percentual solto. Ela é o par exato da que o lote
//     anterior escreveu, e as duas juntas dizem a regra — a legenda FICA, o
//     desenho do número SAI.
//  4. **O `⋮` CEDE A COLUNA AO TRABALHO.** *"esse botão só tem uma função
//     durante um preparo ou download. Esse botão cancela o processo e apaga o
//     item."* Três metades, e nenhuma basta: o cancelar está NA COLUNA (mesma
//     caixa do `⋮`, medida no renderizado — um botão com outra caixa é o
//     defeito que a v5.259 já tirou desta lista), a fileira de opções NÃO está
//     lá (era o pedido: uma função só), e ele CANCELA de verdade.
//  5. **E A PREPARAÇÃO PASSOU A SABER PARAR.** Sem isto o botão existiria e não
//     teria o que fazer no caso mais longo que este app tem — dezenas de
//     páginas rasterizadas uma a uma. A asserção é o desfecho que o operador
//     vê: a linha sai da lista, e nenhum item nasce.
//
// Um teste do DESFECHO passa nas duas versões (o item nasce igual), e um teste
// de CLASSE passaria com a regra de CSS ausente. Por isso as asserções daqui
// medem o RENDERIZADO (a caixa do botão em pixels) e a ÁRVORE (a posição da
// legenda dentro da coluna de texto, o `<svg>` dentro do aro).
//
//   node tools/linha-da-preparacao.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperar, checar, falhas, porque } from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)),
  '..', 'app', 'src', 'main', 'assets', 'web');

/** Páginas da apresentação de mentira, e o espaço entre uma e a seguinte. O
 *  passo é folgado de propósito: o que se mede é a barra ANDANDO, e para isso
 *  o oráculo precisa de dois instantes distinguíveis no meio do trabalho. */
const PAGINAS = 8;
const PASSO_MS = 220;

const PONTE = `(() => {
  const B = {
    shellVersion: () => 63,
    role: () => 'controle',
    appVersion: () => '1.99-teste',
    takeShare: () => '',
    busPost: () => {},
    otaConfirm: () => {},
    bgProgress: () => {},
  };
  const nomes = ['apkInstalar','apkProcurar','captureVolumeKeys','projecaoLocal','castTarget',
    'cifraDiag','cifraHtml','deckDiscard','deckExportUrl','deckPages','displays',
    'espelhoCertApagar','espelhoCertEstado','espelhoCertImportar','espelhoDesligar',
    'espelhoDiag','espelhoEstado','espelhoLigar','farolEstado','keepAlive','listFolder',
    'micDiag','nowPlaying','openCast','openExternal','otaApply','otaCheck','otaDiag',
    'otaPending','pickDoc','pickFolder','requestMic','salvarTexto','systemVolume','temaClaro',
    'ytCancel','ytCanalPlaylists','ytDiscard','ytFetch','ytFetchAte','ytFetchAudio','ytStream',
    'ytPlaylist','ytSearch','ytDiag','areaTransferencia','atualizacaoEstado','pacoteCriar',
    'pacoteFechar','compartilharTexto','pacoteCancelar'];
  for (const n of nomes) {
    if (B[n]) continue;
    B[n] = (...a) => {
      const id = a[0];
      if (typeof id === 'string') setTimeout(() => { try { window.__avResolve(id, null); } catch (_) {} }, 0);
      return undefined;
    };
  }
  window.__AVBridge = B;
})();`;

const servidor = servirEstatico(RAIZ);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador();
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);

const erros = [];
try {
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await pg.addInitScript(PONTE);
  await pg.goto(base + '/controle/', { waitUntil: 'load' });
  await esperar(pg, () => !document.getElementById('splash'), null, 30000);
  await pg.evaluate(() => setAppMode('full'));

  // A rasterização de mentira — o mesmo contrato do `AVDeck`, sem um arquivo de
  // terceiro no repositório. O que se mede é a LINHA, e ela não depende do que
  // há dentro do zip.
  await pg.evaluate(({ passo, paginas }) => {
    window.AVDeck.paginasDoPptx = async (file, onProgresso) => {
      const pages = [];
      for (let i = 1; i <= paginas; i++) {
        await new Promise((r) => setTimeout(r, passo));
        const cv = document.createElement('canvas');
        cv.width = cv.height = 4;
        const c = cv.getContext('2d');
        c.fillStyle = '#fff'; c.fillRect(0, 0, 4, 4);
        pages.push(await new Promise((r) => cv.toBlob(r, 'image/png')));
        onProgresso(i, paginas);
      }
      return { pages, truncado: false };
    };
  }, { passo: PASSO_MS, paginas: PAGINAS });

  // O que a linha provisória mostra AGORA, medido no renderizado.
  // A LINHA É ENDEREÇADA PELO NOME, e isso não é preciosismo: as duas metades
  // deste oráculo montam uma linha cada, e a de cima só sai do DOM quando o
  // redesenho seguinte roda. MEDIDO (1 reprovação em 8 rodadas a 3× de carga):
  // sob carga o `querySelector` do bloco B pegava a linha do bloco A e media a
  // seta da IMPORTAÇÃO — três asserções vermelhas descrevendo um app correto.
  const linha = (nome) => pg.evaluate((alvo) => {
    const busy = [...document.querySelectorAll('.lib-item.baixando')];
    const li = alvo
      ? busy.find((x) => ((x.querySelector('.row-name') || {}).textContent || '') === alvo)
      : busy[0];
    if (!li) return null;
    const prog = li.querySelector('.dl-prog');
    const anel = li.querySelector('.thumb .dl-ring');
    const texto = li.querySelector('.row-text');
    const cancelar = li.querySelector('.row-cancel');
    const caixa = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100 };
    };
    return {
      nome: (li.querySelector('.row-name') || {}).textContent || '',
      // A LEGENDA ESTÁ NA POSIÇÃO DO SUBTÍTULO? A pergunta é de ÁRVORE: dentro
      // da coluna de texto e DEPOIS do nome — que é onde mora o `.row-sub` de
      // uma linha normal. Um `.dl-prog` solto na `.row` passaria num teste de
      // presença e apareceria noutro lugar da linha.
      naColuna: !!(prog && texto && prog.parentElement === texto
        && texto.children[0] && texto.children[0].classList.contains('row-name')
        && texto.children[1] === prog),
      legenda: prog ? prog.textContent || '' : '',
      // A SETA é um `<svg>` DENTRO do aro; o aro é o `::before`, que não é nó.
      temAro: !!anel,
      temSeta: !!(anel && anel.querySelector('svg')),
      // O DESENHO DO NÚMERO, nas três formas que a linha já teve: o percentual
      // solto (até a v1.7.1) e o par trilho/preenchimento (só a v1.7.1).
      temPct: !!li.querySelector('.dl-pct'),
      temTrilho: !!li.querySelector('.dl-prog-trilho, .dl-prog-fill'),
      // O CANCELAR e a caixa dele, para a comparação com a do `⋮` de uma linha
      // sem trabalho nenhum.
      temCancelar: !!cancelar,
      cancelar: caixa(cancelar),
      // A FILEIRA DE OPÇÕES não pode estar no ar junto: o pedido é *"esse botão
      // só tem uma função"*.
      temMais: !!li.querySelector('.row-mais'),
      temAcoes: !!li.querySelector('.row-acoes'),
    };
  }, nome || null);

  // =========================================================================
  // A · A PREPARAÇÃO DE UMA APRESENTAÇÃO
  // =========================================================================
  const importar = pg.evaluate(() => pptxImportar(
    new Blob([new Uint8Array([1, 2, 3])], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }),
    'Semana da Familia'));

  // ── A1. ANTES DO PRIMEIRO PROGRESSO: legenda sem barra ──────────────────
  //
  // Uma barra parada em zero durante a fase que ainda não sabe o total se lê
  // como TRAVADA — quem diz "espere" ali é o aro da miniatura, que é a peça
  // feita para isso. Por isso o trilho só nasce com número.
  const r0 = await esperar(pg, () => !!document.querySelector('.lib-item.baixando'), null, 15000);
  checar(r0 === true, 'A1 · a linha provisória nasce no Cronograma', porque(r0));
  const antes = await linha();
  checar(antes && antes.nome === 'Semana da Familia',
    'A1 · com o NOME da apresentação', antes && antes.nome);
  checar(antes && antes.naColuna,
    'A1 · e a faixa de progresso ocupa a POSIÇÃO DO SUBTÍTULO — dentro da coluna '
    + 'de texto, logo depois do nome, que é onde mora o `.row-sub` de uma linha normal',
    antes);
  checar(antes && antes.legenda === 'Preparando apresentação',
    'A1 · a legenda de abertura é a MESMA do cartão da preview', antes && antes.legenda);

  // ── A2. A SETA NÃO É DESENHADA ──────────────────────────────────────────
  checar(antes && antes.temAro && !antes.temSeta,
    'A2 · a miniatura tem o ARO e NÃO tem a seta — preparar não baixa byte nenhum, '
    + 'e era essa seta que o operador viu prometer o que não estava acontecendo',
    antes && { aro: antes.temAro, seta: antes.temSeta });

  // ── A3. A FRAÇÃO APARECE, E ELA É TODO O PROGRESSO QUE A LINHA MOSTRA ───
  const comFracao = await esperar(pg, () => {
    const t = document.querySelector('.lib-item.baixando .dl-prog');
    return !!t && /de 8/.test(t.textContent || '');
  }, null, 15000);
  checar(comFracao === true, 'A3 · a fração chega no primeiro progresso', porque(comFracao));

  const a = await linha();
  checar(/^Preparando página \d+ de 8…$/.test(a.legenda),
    'A3 · e a legenda traz a FRAÇÃO das páginas já preparadas — ela vem de quem '
    + 'TEM os números, sem o oráculo (nem a linha) parsear frase nenhuma',
    a.legenda);

  // A legenda ANDA: uma frase que aparece e congela é o defeito que ela existe
  // para não ser. Espera pelo FATO (o texto mudar), com prazo para duas páginas.
  const primeira = a.legenda;
  const andou = await esperar(pg, (txt) => {
    const t = document.querySelector('.lib-item.baixando .dl-prog');
    return !!t && (t.textContent || '') !== txt && /de 8/.test(t.textContent || '');
  }, primeira, 15000);
  checar(andou === true, 'A3 · e ela ANDA, página a página', porque(andou));

  // ── A4. NENHUM DESENHO DO NÚMERO NA LINHA (v1.7.2) ──────────────────────
  //
  // Relato do operador: *"O subtitulo com as informações ficou muito bom, mas a
  // barra de progresso ficou ruim, tire ela."* A asserção é NEGATIVA e cobre as
  // DUAS formas que a linha já teve — o percentual solto (até a v1.7.1) e o par
  // trilho/preenchimento (só a v1.7.1) —, porque as duas dizem o mesmo número
  // que a legenda acabou de dizer por extenso.
  checar(a.temPct === false && a.temTrilho === false,
    'A4 · e a linha NÃO desenha o número: nem percentual solto, nem barra — a '
    + 'legenda já o diz, e três formas do mesmo fato na mesma linha é o que este '
    + 'app tira de cena em toda passada',
    { pct: a.temPct, trilho: a.temTrilho });

  // ── A5. O `⋮` CEDEU A COLUNA (v1.7.2) ───────────────────────────────────
  //
  // A caixa é comparada com a do `⋮` de uma linha SEM trabalho — não com um
  // número escrito aqui: o `.row-btn` mede `--thumb` no Cronograma e `--hit` na
  // fila, e um literal aprovaria a lista errada.
  checar(a.temCancelar && !a.temMais && !a.temAcoes,
    'A5 · a coluna do `⋮` é do CANCELAR enquanto o trabalho corre, e a fileira de '
    + 'opções não está no ar: o pedido é uma função só',
    { cancelar: a.temCancelar, mais: a.temMais, acoes: a.temAcoes });

  // ── A6. E O CANCELAR PARA A PREPARAÇÃO ──────────────────────────────────
  //
  // O desfecho que o operador vê: a linha sai da lista, e nenhum item nasce.
  // Sem a alça de cancelamento no `pptxImportar` este toque seria um no-op —
  // um botão à vista que não faz nada é o defeito que ele existe para não ser.
  await pg.evaluate(() => {
    const li = [...document.querySelectorAll('.lib-item.baixando')]
      .find((x) => ((x.querySelector('.row-name') || {}).textContent || '') === 'Semana da Familia');
    li.querySelector('.row-cancel').click();
  });
  const sumiu = await esperar(pg, () => !document.querySelector('.lib-item.baixando'), null, 10000);
  checar(sumiu === true, 'A6 · o toque no cancelar tira a linha da lista NA HORA', porque(sumiu));
  const criado = await importar;
  checar(criado === null,
    'A6 · e nenhuma apresentação nasce: o laço de páginas lê a desistência e sai',
    criado);
  const noBanco = await pg.evaluate(async () => (await AVDB.listItems('imports'))
    .filter((r) => r.name === 'Semana da Familia').length);
  checar(noBanco === 0, 'A6 · nem no Cronograma', noBanco);

  // =========================================================================
  // B · A REVERSÃO — num DOWNLOAD a seta continua, e ela acende NA HORA CERTA
  // =========================================================================
  //
  // Sem esta metade, apagar a seta do app inteiro passaria em tudo acima — e o
  // que se perderia é a distinção que o pedido da v1.4.19 criou: o cartão (e
  // agora a linha) diz "bytes chegando" só quando há bytes chegando.
  //
  // A REGRA É MEDIDA NO PONTO EM QUE ELA MORA (a legenda governa o desenho), e
  // por isso o cenário é o `libBusy` direto: o caminho de download de verdade
  // depende do shell, e o que se afirma aqui não é o download — é a regra.
  await pg.evaluate(() => {
    window.__cancelou = 0;
    // COM alça de cancelamento: sem ela não há botão, e é do botão que o bloco
    // B2 tira a caixa. (A ausência tem asserção própria — ver B3.)
    window.__bgTeste = libBusy('Preparando vídeo', 'O Louvor', null,
      () => { window.__cancelou++; });
  });
  const nasceu = await esperar(pg, () => [...document.querySelectorAll('.lib-item.baixando')]
    .some((x) => ((x.querySelector('.row-name') || {}).textContent || '') === 'O Louvor'),
  null, 10000);
  checar(nasceu === true, 'B · a linha de um download nasce', porque(nasceu));
  const b0 = await linha('O Louvor');
  checar(b0 && !b0.temSeta,
    'B · e ANTES do primeiro byte ela também não tem seta: "Preparando vídeo" é a '
    + 'fase pré-bytes de um download, e prometer ali é chegar cedo demais',
    b0 && b0.temSeta);

  await pg.evaluate(() => window.__bgTeste.atualizar('Baixando vídeo · 12%', null, 12));
  const b1 = await linha('O Louvor');
  checar(b1 && b1.temSeta,
    'B · e ela ACENDE no primeiro progresso, quando a legenda passa a dizer '
    + '"Baixando" — o ícone segue a LEGENDA, e os dois nunca discordam',
    b1 && b1.temSeta);
  checar(b1 && b1.legenda === 'Baixando vídeo · 12%',
    'B · com a mesma legenda dizendo o resto', b1 && b1.legenda);

  // E ELA APAGA DE VOLTA, que é a outra metade da condicional: uma legenda que
  // deixa de prometer bytes não pode manter a promessa desenhada.
  await pg.evaluate(() => window.__bgTeste.atualizar('Guardando as páginas…', null, -1));
  const b2 = await linha('O Louvor');
  checar(b2 && !b2.temSeta,
    'B · e APAGA quando a legenda deixa de prometer bytes',
    b2 && b2.temSeta);

  // ── B2. A CAIXA DO CANCELAR É A DO `⋮` ──────────────────────────────────
  //
  // A régua é o VIZINHO, nunca um literal: o `.row-btn` mede `--thumb` no
  // Cronograma e `--hit` na fila, e um número escrito aqui aprovaria a lista
  // errada. Um item de verdade é semeado ao lado, sem trabalho nenhum, só para
  // emprestar a caixa do `⋮` dele.
  const caixas = await (async () => {
    await pg.evaluate(async () => {
      const b = new Blob([new Uint8Array([0, 1, 2, 3])], { type: 'audio/mp4' });
      await AVDB.addMedia(b, { name: 'Régua', kind: 'audio', type: 'audio/mp4', list: 'imports' });
      await load();
    });
    return pg.evaluate(() => {
      const cx = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100 };
      };
      const comum = [...document.querySelectorAll('.lib-item:not(.baixando)')]
        .find((x) => ((x.querySelector('.row-name') || {}).textContent || '') === 'Régua');
      const trabalho = [...document.querySelectorAll('.lib-item.baixando')]
        .find((x) => ((x.querySelector('.row-name') || {}).textContent || '') === 'O Louvor');
      return {
        mais: cx(comum && comum.querySelector('.row-mais')),
        cancelar: cx(trabalho && trabalho.querySelector('.row-cancel')),
      };
    });
  })();
  checar(!!caixas.mais && !!caixas.cancelar
    && caixas.mais.w === caixas.cancelar.w && caixas.mais.h === caixas.cancelar.h
    && caixas.mais.w > 0,
    'B2 · o cancelar mede EXATAMENTE o `⋮` da linha vizinha — ele é um `.row-btn`, '
    + 'e a caixa vem da mesma regra em vez de um número repetido',
    JSON.stringify(caixas));

  // ── B3. SEM ALÇA NÃO HÁ BOTÃO ──────────────────────────────────────────
  //
  // A outra metade de B2, e ela é o que impede o conserto largo demais: um
  // cancelar desenhado sempre seria um botão morto nas esperas que não sabem
  // parar. (Hoje as três que desenham a linha sabem — ver `alcaDeCancelamento`
  // —, e é justamente por isso que a regra precisa de asserção: um caminho novo
  // sem alça tem de nascer sem botão, não com um inerte.)
  await pg.evaluate(() => {
    window.__semAlca = libBusy('Preparando vídeo', 'Sem alça', null, null);
  });
  const nasceuSemAlca = await esperar(pg, () => [...document.querySelectorAll('.lib-item.baixando')]
    .some((x) => ((x.querySelector('.row-name') || {}).textContent || '') === 'Sem alça'),
  null, 10000);
  checar(nasceuSemAlca === true, 'B3 · a linha sem alça nasce', porque(nasceuSemAlca));
  const semAlca = await linha('Sem alça');
  checar(semAlca && !semAlca.temCancelar,
    'B3 · e ela NÃO desenha o cancelar: um botão que não tem o que fazer é pior '
    + 'que botão nenhum', semAlca && semAlca.temCancelar);
  await pg.evaluate(() => window.__semAlca.soltar());

  await pg.evaluate(() => window.__bgTeste.soltar());

  checar(erros.length === 0, 'nenhum erro de página', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

falhas.length ? (console.log('\n' + falhas.length + ' falha(s).'), process.exit(1))
  : console.log('\nTodos passaram.');
