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
// Um teste do DESFECHO passa nas duas versões (o item nasce igual), e um teste
// de CLASSE passaria com a regra de CSS ausente. Por isso as asserções daqui
// medem o RENDERIZADO (a largura do preenchimento em pixels) e a ÁRVORE (a
// posição da faixa dentro da coluna de texto, o `<svg>` dentro do aro).
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
    const trilho = li.querySelector('.dl-prog-trilho');
    const fill = li.querySelector('.dl-prog-fill');
    const anel = li.querySelector('.thumb .dl-ring');
    const texto = li.querySelector('.row-text');
    return {
      nome: (li.querySelector('.row-name') || {}).textContent || '',
      // A FAIXA ESTÁ NA POSIÇÃO DO SUBTÍTULO? A pergunta é de ÁRVORE: dentro da
      // coluna de texto e DEPOIS do nome — que é onde mora o `.row-sub` de uma
      // linha normal. Um `.dl-prog` solto na `.row` passaria num teste de
      // presença e apareceria noutro lugar da linha.
      naColuna: !!(prog && texto && prog.parentElement === texto
        && texto.children[0] && texto.children[0].classList.contains('row-name')
        && texto.children[1] === prog),
      legenda: prog ? (prog.querySelector('.dl-prog-txt') || {}).textContent || '' : '',
      trilhoVisivel: !!(trilho && !trilho.hidden),
      // A LARGURA RENDERIZADA, não o `style.width`: uma regra de CSS ausente
      // deixaria o inline style de pé e o elemento sem caixa nenhuma.
      fill: fill ? Math.round(fill.getBoundingClientRect().width * 100) / 100 : -1,
      trilho: trilho ? Math.round(trilho.getBoundingClientRect().width * 100) / 100 : -1,
      // A SETA é um `<svg>` DENTRO do aro; o aro é o `::before`, que não é nó.
      temAro: !!anel,
      temSeta: !!(anel && anel.querySelector('svg')),
      // O percentual solto, que saiu daqui na v1.7.1.
      temPct: !!li.querySelector('.dl-pct'),
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
  checar(antes && antes.trilhoVisivel === false,
    'A1 · e ainda NÃO há trilho: sem total não há proporção, e uma barra em zero '
    + 'se lê como travada', antes && antes.trilhoVisivel);

  // ── A2. A SETA NÃO É DESENHADA ──────────────────────────────────────────
  checar(antes && antes.temAro && !antes.temSeta,
    'A2 · a miniatura tem o ARO e NÃO tem a seta — preparar não baixa byte nenhum, '
    + 'e era essa seta que o operador viu prometer o que não estava acontecendo',
    antes && { aro: antes.temAro, seta: antes.temSeta });

  // ── A3. A BARRA ANDA, E A FRAÇÃO APARECE ────────────────────────────────
  const comBarra = await esperar(pg, () => {
    const t = document.querySelector('.lib-item.baixando .dl-prog-trilho');
    return !!t && !t.hidden;
  }, null, 15000);
  checar(comBarra === true, 'A3 · o trilho aparece no primeiro progresso', porque(comBarra));

  const a = await linha();
  checar(/^Preparando página \d+ de 8…$/.test(a.legenda),
    'A3 · e a legenda passa a trazer a FRAÇÃO das páginas já preparadas — ela vem '
    + 'de quem TEM os números, sem o oráculo (nem a linha) parsear frase nenhuma',
    a.legenda);
  checar(a.trilho > 40, 'A3 · o trilho tem caixa de verdade no renderizado', a.trilho);

  // ANDAR é a asserção: uma barra que aparece e fica parada é o defeito que
  // esta faixa existe para não ser. Espera pelo FATO (a largura crescer), com
  // prazo que cobre duas páginas.
  const largura0 = a.fill;
  const andou = await esperar(pg, (w) => {
    const f = document.querySelector('.lib-item.baixando .dl-prog-fill');
    return !!f && f.getBoundingClientRect().width > w + 0.5;
  }, largura0, 15000);
  checar(andou === true,
    'A3 · e o PREENCHIMENTO cresce — medido em pixels renderizados, não no `style`: '
    + 'sem a regra de CSS o inline ficaria de pé sobre um elemento sem caixa',
    porque(andou));

  // ── A4. O PERCENTUAL SOLTO SAIU ─────────────────────────────────────────
  //
  // A barra diz o número e a legenda o repete por extenso; um terceiro lugar
  // dizendo o mesmo é o que este app tira de cena em toda passada.
  checar(a.temPct === false,
    'A4 · e não há mais o percentual solto na linha: a barra e a fração já o dizem',
    a.temPct);

  await importar;

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
    window.__bgTeste = libBusy('Preparando vídeo', 'O Louvor', null, null);
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
  checar(b1 && b1.legenda === 'Baixando vídeo · 12%' && b1.fill > 0,
    'B · com a mesma faixa dizendo o resto', b1 && { legenda: b1.legenda, fill: b1.fill });

  // E ELA APAGA DE VOLTA, que é a outra metade da condicional: uma legenda que
  // deixa de prometer bytes não pode manter a promessa desenhada.
  await pg.evaluate(() => window.__bgTeste.atualizar('Guardando as páginas…', null, -1));
  const b2 = await linha('O Louvor');
  checar(b2 && !b2.temSeta && b2.trilhoVisivel === false,
    'B · e APAGA quando a legenda deixa de prometer bytes, junto com o trilho',
    b2 && { seta: b2.temSeta, trilho: b2.trilhoVisivel });
  await pg.evaluate(() => window.__bgTeste.soltar());

  checar(erros.length === 0, 'nenhum erro de página', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

falhas.length ? (console.log('\n' + falhas.length + ' falha(s).'), process.exit(1))
  : console.log('\nTodos passaram.');
