#!/usr/bin/env node
// ============================================================================
// O AUXILIAR DE LEITURA OFERECE TUDO O QUE ESTÁ EM EXIBIÇÃO (v1.4.26)
//
// Pedido do operador, verbatim:
//
//   *"o auxiliar de leitura deve deixar disponível os auxiliares de tudo que
//   estiver em exibição, seja uma música de fundo e uma bíblia sobrepondo…
//   devo ter a opção da letra, da cifra e da bíblia, pois todos estes estão em
//   exibição. É claro, o elemento na camada mais a frente de tudo é o que
//   aparece na abertura da seção de auxiliar de leitura. Por exemplo, se houver
//   uma música de fundo e a bíblia por cima, então a bíblia aparece na abertura
//   da seção de auxiliar de leitura como aba principal."*
//
// Ele REVOGA duas exclusividades que este app tinha escrito e defendido: a da
// Bíblia (v1.1.11) e a da apresentação (v1.4.24). As duas acertavam a
// PRECEDÊNCIA e erravam em tirar as outras da mesa — a música de fundo continua
// tocando sob o versículo, e quem opera pode precisar da letra dela no minuto
// seguinte.
//
// ## POR QUE ISTO PRECISA DE ORÁCULO
//
// As duas metades do pedido falham CALADAS, e falham em direções opostas —
// nenhuma das duas produz erro, console sujo ou tela quebrada:
//
//  - **De MENOS** (a exclusividade sobrevivendo em algum caminho): a aba
//    simplesmente não está lá. O operador conclui que o app não tem o recurso.
//  - **De MAIS** (a lista certa e a ABERTURA errada): a folha abre na letra do
//    louvor de fundo com o versículo no telão. Tudo funciona, tudo está
//    disponível, e o que está na tela não é o que está na frente. É o pior dos
//    dois, porque parece certo.
//
// E há uma terceira, que é a razão de a regra ser mais que uma lista: **a
// escolha guardada.** A aba escolhida sobrevive à reabertura desde a v1.2.x (o
// músico que toca o culto inteiro na cifra). Com a pilha, essa memória passa a
// poder CONTRADIZER o pedido: quem tocou "Cifra" com o louvor sozinho no ar não
// pediu cifra para o instante em que o versículo subir por cima dele. A regra é
// *mudou a frente, mudou a pergunta* — e ela só está certa se as DUAS metades
// forem medidas, porque zerar a escolha sempre passa numa e apagar o recurso
// passa na outra.
//
//   node tools/leitor-camadas.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, checar, falhas } from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)),
  '..', 'app', 'src', 'main', 'assets', 'web');

// A ponte de mentira existe por DUAS razões aqui, e a segunda entrou na
// v1.8.28. A primeira: `cifraCabe` exige `window.__NATIVE__`, e sem ela a cifra
// nunca entra na lista — o oráculo aprovaria uma regra que esqueceu a metade
// que o operador nomeou primeiro. A segunda: a aba passou a depender de haver
// FOLHA, e não só de caber uma. Enquanto o `cifraHtml` caiu no coringa que
// resolve `null`, TODA música deste oráculo era uma música sem cifra — a
// disponibilidade que ele mede seria a de um cenário que o app já não produz.
//
// O NOME DA MÚSICA DECIDE, e é isso que dá ao arquivo os dois cenários no mesmo
// lugar: a URL carrega o slug (`AVCifra.urlDoHino`), então uma música cujo nome
// normalizado contenha `sem-cifra` recebe 404 em todo endereço tentado, e
// qualquer outra recebe a folha.
const PONTE = `(() => {
  const FOLHA = '<pre><b>C</b>      <b>G</b>\\nprimeira linha da cifra\\n'
    + '<b>Am</b>     <b>F</b>\\nsegunda linha da cifra</pre>';
  const B = {
    shellVersion: () => 60, role: () => 'controle', appVersion: () => '1.99-teste',
    takeShare: () => '', busPost: () => {}, otaConfirm: () => {},
    cifraHtml: (id, url) => {
      const nada = String(url || '').includes('sem-cifra');
      setTimeout(() => {
        try {
          window.__avResolve(id, nada ? { status: 404, html: '' }
            : { status: 200, html: FOLHA });
        } catch (_) {}
      }, 0);
    },
  };
  const nomes = ['apkInstalar','apkProcurar','bgProgress','captureVolumeKeys','projecaoLocal',
    'castTarget','cifraDiag','deckDiscard','deckExportUrl','deckPages','displays',
    'espelhoCertApagar','espelhoCertEstado','espelhoCertImportar','espelhoDesligar','espelhoDiag',
    'espelhoEstado','espelhoLigar','espelhoLigarEm','espelhoDerrubar','farolEstado',
    'keepAlive','listFolder','micDiag','nowPlaying','openCast','openExternal','otaApply','otaCheck',
    'otaDiag','otaPending','pickDoc','pickFolder','requestMic','salvarTexto','systemVolume',
    'temaClaro','ytCancel','ytCanalPlaylists','ytDiscard','ytFetch','ytFetchAte','ytFetchAudio',
    'ytStream','ytPlaylist','ytSearch','ytDiag','areaTransferencia','atualizacaoEstado',
  ];
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
const navegador = await abrirNavegador();
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);
const pg = await ctx.newPage();
const base = 'http://localhost:' + servidor.address().port;

try {
  pg.on('pageerror', (e) => falhas.push('pageerror: ' + e.message));
  await pg.addInitScript(PONTE);
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(
    () => window.__NATIVE__ === true && window.AVDB && typeof window.__avBack === 'function'
      && (!!document.querySelector('#playlist li') || document.getElementById('plBtn').disabled),
    null, { timeout: 30000 },
  );

  // As cenas são montadas por funções na PÁGINA, e não por um objeto que o
  // oráculo passe: `bibleSession` e `currentItem` são o estado de que a regra
  // vive, e escrevê-los aqui é montar a cena que o operador vê.
  await pg.evaluate(async () => {
    setAppMode('full');
    window.__musica = () => ({
      id: 'cena', name: 'Louvor de Fundo', kind: 'audio', seconds: 200,
      lyrics: [{ cover: true }, { text: 'primeira estrofe' }, { text: 'segunda estrofe' }],
    });
    const pages = [];
    for (let i = 0; i < 4; i++) {
      const cv = document.createElement('canvas');
      cv.width = 160; cv.height = 90;
      const c = cv.getContext('2d');
      c.fillStyle = 'hsl(' + (i * 51) + ',60%,60%)';
      c.fillRect(0, 0, 160, 90);
      pages.push(await new Promise((r) => cv.toBlob(r, 'image/png')));
    }
    window.__deck = () => ({ id: 'ap', name: 'Semana da Familia', kind: 'deck', pages });
    // A Bíblia como o `startBibleReading` a deixa: `projecting` é o campo que
    // separa "capítulo aberto" de "versículo no ar", e é sobre ele que a regra
    // decide.
    window.__biblia = (projecting) => ({
      versionId: 'nvi', bookIdx: 18, bookId: 'sal', bookName: 'Salmos', chapter: 23,
      verses: [
        { n: 1, text: 'O Senhor é o meu pastor; nada me faltará.' },
        { n: 2, text: 'Deitar-me faz em verdes pastos.' },
        { n: 3, text: 'Refrigera a minha alma.' },
      ],
      idx: 1, projecting,
    });
    window.__cena = (item, biblia) => {
      closeLyricsPopup();
      currentItem = item;
      currentId = item ? item.id : null;
      bibleSession = biblia;
      deckPagina = 0;
      renderSlideNav();
    };
  });

  // ===== A PROCURA DA CIFRA É ASSÍNCRONA, E A ABA ESPERA POR ELA (v1.8.28) ==
  //
  // A aba só entra na lista quando há folha, e a folha chega por uma Promise —
  // ler as fontes no mesmo `evaluate` da abertura mede o app um quadro ANTES da
  // resposta, e reprovaria um app correto. A espera é pelo FATO (o desfecho no
  // cache), nunca por um prazo, e o predicado é SÍNCRONO: um `async` aqui
  // devolve uma Promise, que é *truthy*, e a espera passaria no primeiro quadro
  // aprovando justamente o que veio verificar.
  const assentarCifra = () => pg.waitForFunction(
    () => !cifraCabe(lvItem())
      || (cifraEstado(lvItem()) || {}).estado !== 'buscando',
    null, { timeout: 15000 },
  );

  const abrir = async () => {
    await pg.evaluate(() => { openLyricsPopup(); });
    await assentarCifra();
    return pg.evaluate(() => {
      const seg = document.getElementById('lyricsViewSeg');
      return {
        fontes: lyricsViewSources(),
        ativa: lvActiveSource(),
        linhas: document.querySelectorAll('#lyricsViewBody .lv-row').length,
        // NA ORDEM DO DOM, que é a que o operador vê. A lista de fontes já
        // estava certa quando a tela estava errada — é por isso que ela não
        // prova nada sobre a ordem, e que este campo existe separado dela.
        botoes: [...seg.querySelectorAll('.fit-opt')].filter((b) => !b.hidden)
          .map((b) => b.dataset.lvsrc),
        segEscondido: seg.hidden,
        cifra: (cifraEstado(lvItem()) || {}).estado || 'novo',
      };
    });
  };

  // ── 1. A MÚSICA SOZINHA — o ponto de partida, e o que não pode regredir ────
  await pg.evaluate(() => window.__cena(window.__musica(), null));
  const so = await abrir();
  checar(so.fontes.join(',') === 'lyrics,cifra' && so.ativa === 'lyrics',
    'uma MÚSICA sozinha no ar oferece letra e cifra, e abre na letra', so);

  // ── 1-B. SEM CIFRA DE VERDADE, SEM ABA (v1.8.28) ──────────────────────────
  //
  // Pedido do operador: *"que ele não apresente o botão da aba de cifra se não
  // houver uma cifra de verdade para ser apresentada. não quero acesso a essa
  // seção se não tem esse conteúdo."*
  //
  // Enquanto a aba saiu de `cifraCabe` sozinho, ela aparecia para TODA faixa de
  // áudio do acervo — e MEDIDO, cerca de dois terços dos álbuns não estão sob
  // endereço deduzível nenhum: o que o toque abria era a frase de "não
  // encontrei". As duas metades falham caladas e em direções opostas, e por
  // isso são medidas em PAR, na mesma cena e com a mesma montagem:
  //
  //  - **de MAIS** (a aba de sempre): a regra não pegou, e nada na tela diz
  //    isso — a aba abre e explica que não achou, que é o estado de antes;
  //  - **de MENOS** (a aba nunca): o conserto barato é apagar a cifra da lista,
  //    e ele passa na primeira metade sozinha. É a mesma armadilha do
  //    `--press`: uma asserção negativa aprova quem removeu o recurso.
  //
  // A BADGE entra junto porque ela sai da MESMA lista (`renderLeitorBadge`), e
  // é a que ninguém confere: uma faixa de áudio SEM LETRA tem a cifra como
  // única fonte possível, e sem a regra o botão do transporte fica aceso sobre
  // uma folha que só sabe dizer que não achou.
  //
  // REVERSÃO: devolver `if (cifraCabe(alvo)) list.push('cifra')` a
  // `lyricsViewSources` reprova as duas primeiras asserções abaixo.
  await pg.evaluate(() => window.__cena({
    id: 'nada', name: 'Louvor Sem Cifra', kind: 'audio', seconds: 200,
    lyrics: [{ text: 'primeira estrofe' }],
  }, null));
  const semCifra = await abrir();
  // O ESTADO VIAJA JUNTO em toda asserção deste bloco: sem ele, "a aba não
  // está lá" passa também no mundo em que a PROCURA nunca aconteceu — que é o
  // defeito de MENOS por outro caminho, e o mais fácil de introduzir sem
  // querer (a v1.8.28 teve de acrescentar o gatilho da abertura por causa
  // dele).
  checar(semCifra.cifra === 'falha' && semCifra.fontes.join(',') === 'lyrics'
      && semCifra.ativa === 'lyrics',
    'uma música cuja cifra NÃO existe não oferece a aba: "não quero acesso a '
    + 'essa seção se não tem esse conteúdo"', semCifra);
  checar(semCifra.botoes.join(',') === 'lyrics' && semCifra.segEscondido,
    '  ↳ e o botão não é DESENHADO — com uma fonte só o seletor inteiro sai, '
    + 'que é a regra de sempre', semCifra);
  // Uma faixa de ÁUDIO SEM LETRA: a cifra é a única fonte que ela poderia ter,
  // então a badge responde por ela sozinha. A folha é ABERTA e fechada porque é
  // a abertura que dispara a procura de um item que não passou pelo `send`.
  await pg.evaluate(() => {
    closeLyricsPopup();
    window.__cena({ id: 'nada2', name: 'Playback Sem Cifra', kind: 'audio', seconds: 200 }, null);
    openLyricsPopup();
  });
  await assentarCifra();
  const badgeSemCifra = await pg.evaluate(() => {
    closeLyricsPopup();
    return {
      fontes: lyricsViewSources(),
      badge: !document.getElementById('lvBadge').hidden,
      cifra: (cifraEstado(currentItem) || {}).estado || 'novo',
    };
  });
  checar(badgeSemCifra.cifra === 'falha' && !badgeSemCifra.fontes.length
      && !badgeSemCifra.badge,
    '  ↳ e a BADGE do transporte apaga junto: ela sai da mesma lista, e um '
    + 'áudio sem letra não tem outra fonte para acendê-la', badgeSemCifra);
  // A METADE QUE IMPEDE O CONSERTO LARGO DEMAIS: a mesma montagem, com a cifra
  // existindo, continua oferecendo as duas.
  await pg.evaluate(() => { closeLyricsPopup(); window.__cena(window.__musica(), null); });
  const comCifra = await abrir();
  checar(comCifra.fontes.join(',') === 'lyrics,cifra',
    '  ↳ e a música QUE TEM cifra continua oferecendo as duas — sem esta, '
    + 'apagar a cifra da lista passaria nas asserções acima', comCifra);

  // ── 2. O PEDIDO, AO PÉ DA LETRA ───────────────────────────────────────────
  // "se houver uma música de fundo e a bíblia por cima, então a bíblia aparece
  //  na abertura como aba principal"
  await pg.evaluate(() => window.__cena(window.__musica(), window.__biblia(true)));
  const sobreposta = await abrir();
  checar(sobreposta.fontes.join(',') === 'bible,lyrics,cifra',
    'MÚSICA DE FUNDO COM A BÍBLIA POR CIMA: as TRÊS ficam disponíveis — "devo '
    + 'ter a opção da letra, da cifra e da bíblia, pois todos estes estão em '
    + 'exibição"', sobreposta.fontes);
  checar(sobreposta.ativa === 'bible',
    '  ↳ e a folha ABRE na Bíblia: a camada mais à frente é a aba principal. É '
    + 'a metade que falha calada — a lista certa com a abertura errada mostra a '
    + 'letra do louvor de fundo com o versículo no telão', sobreposta.ativa);
  checar(!sobreposta.segEscondido && sobreposta.botoes.length === 3,
    '  ↳ e o SELETOR aparece com as três: sem ele a disponibilidade existe só '
    + 'para quem lê o código', sobreposta.botoes);
  // ===== A ORDEM DAS ABAS NA TELA (v1.4.28) =====
  //
  // Pedido do operador: *"a aba da bíblia está entre a letra e a cifra, coloque
  // ela à esquerda, pois letra e cifra são irmãs, sempre juntas quando ambas
  // existem"*. A ordem certa JÁ EXISTIA — é a pilha, medida acima. O que havia
  // era uma SEGUNDA ordem, a do HTML estático ("Letra, Bíblia, Cifra"), que
  // divergiu em silêncio: a folha continuava funcionando, com a Bíblia
  // separando duas abas que são irmãs.
  //
  // Por isso a asserção é sobre o DOM e não sobre a lista: a lista passava.
  checar(sobreposta.botoes.join(',') === 'bible,lyrics,cifra',
    '  ↳ A BÍBLIA FICA À ESQUERDA e LETRA E CIFRA ficam JUNTAS: a ordem NA TELA '
    + 'é a da pilha. No HTML estático ela é "Letra, Bíblia, Cifra" — a segunda '
    + 'lista, e a que o pedido nomeia', sobreposta.botoes);
  checar(sobreposta.linhas === 3,
    '  ↳ e o corpo é o do versículo, não o da letra', sobreposta.linhas);

  // ── 3. A ORDEM É A DO TELÃO, NÃO A DA CHEGADA ─────────────────────────────
  // A mesma cena montada na ordem inversa (a Bíblia primeiro, a música depois)
  // tem de dar a MESMA pilha: quem decide a frente é o empilhamento do telão,
  // e não quem entrou por último.
  await pg.evaluate(() => {
    window.__cena(null, window.__biblia(true));
    currentItem = window.__musica();
    currentId = currentItem.id;
  });
  const invertida = await abrir();
  checar(invertida.fontes.join(',') === 'bible,lyrics,cifra' && invertida.ativa === 'bible',
    'e a ORDEM é a do empilhamento do telão, não a da chegada: a mesma cena '
    + 'montada ao contrário devolve a mesma pilha', invertida);

  // ── 4. UMA APRESENTAÇÃO COM A BÍBLIA POR CIMA ─────────────────────────────
  // "isso vale para todas as variações" — e esta é a que a v1.4.24 teria
  // respondido com `['deck']` sozinho, calando o versículo que está NA FRENTE.
  await pg.evaluate(() => window.__cena(window.__deck(), window.__biblia(true)));
  const deckComBiblia = await abrir();
  checar(deckComBiblia.fontes.join(',') === 'bible,deck' && deckComBiblia.ativa === 'bible',
    'APRESENTAÇÃO COM A BÍBLIA POR CIMA: as duas disponíveis, e abre na Bíblia '
    + '— a exclusividade da apresentação (v1.4.24) valia como PRECEDÊNCIA, '
    + 'nunca como silêncio', deckComBiblia);

  // ── 5. A APRESENTAÇÃO SOZINHA CONTINUA SOZINHA ────────────────────────────
  // E ela continua sozinha por CONSTRUÇÃO, não por regra: um deck não tem letra
  // nem acorde. É o que mantém o pedido da v1.4.24 de pé sem uma linha que o
  // imponha — "durante uma apresentação, não quero botões de letra, ou de
  // cifras nessa tela".
  await pg.evaluate(() => window.__cena(window.__deck(), null));
  const soDeck = await abrir();
  checar(soDeck.fontes.join(',') === 'deck' && soDeck.ativa === 'deck' && soDeck.segEscondido,
    'a APRESENTAÇÃO SOZINHA continua sem letra e sem cifra — e agora por '
    + 'construção (um deck não tem nem uma nem outra), não por uma regra que '
    + 'cale as outras', soDeck);

  // ── 6. A RESERVA NÃO VAZA PARA A FRENTE ───────────────────────────────────
  // Um capítulo ABERTO e fora do ar não está em exibição. Ele é a última linha
  // do `lyricsViewSources`, e só existe quando não há mais nada — se vazasse
  // para a frente, abrir a Bíblia para consultar durante um louvor trocaria a
  // aba de quem está lendo a letra.
  await pg.evaluate(() => window.__cena(window.__musica(), window.__biblia(false)));
  const naoProjetando = await abrir();
  checar(naoProjetando.fontes.join(',') === 'lyrics,cifra' && naoProjetando.ativa === 'lyrics',
    'um capítulo ABERTO E FORA DO AR não é camada nenhuma: com a música no ar a '
    + 'folha continua sendo a da letra — é PROJEÇÃO que põe alguém na pilha, '
    + 'nunca a existência da sessão', naoProjetando);

  await pg.evaluate(() => window.__cena(null, window.__biblia(false)));
  const reserva = await abrir();
  checar(reserva.fontes.join(',') === 'bible' && reserva.ativa === 'bible',
    '  ↳ mas SEM NADA no ar ele é o que o operador foi buscar: a RESERVA '
    + 'sobrevive à revogação porque responde a outra pergunta', reserva);

  // ── 7. UM ALVO DA BIBLIOTECA NÃO HERDA A CENA ─────────────────────────────
  // "nada aqui projeta" tem um irmão: nada da cena entra aqui. Quem abriu a
  // folha de uma música pediu AQUELA música — o versículo no telão roubando a
  // aba de um ensaio é o mesmo defeito do relógio da cena governando a rolagem
  // de outra música.
  await pg.evaluate(() => {
    window.__cena(window.__musica(), window.__biblia(true));
    closeLyricsPopup();
    openLyricsPopup({
      id: 'outra', name: 'Outro Louvor', kind: 'audio',
      lyrics: [{ text: 'estrofe do ensaio' }],
    });
  });
  // O ALVO É UMA MÚSICA NOVA, e a procura dela só começa NA ABERTURA (v1.8.28):
  // ele nunca passa pelo `send`, que é o gatilho da cena.
  await assentarCifra();
  const comAlvo = await pg.evaluate(
    () => ({ fontes: lyricsViewSources(), ativa: lvActiveSource() }));
  checar(comAlvo.fontes.join(',') === 'lyrics,cifra' && comAlvo.ativa === 'lyrics',
    'com um ALVO da Biblioteca a cena não entra: a Bíblia no ar não rouba a '
    + 'folha de um ensaio', comAlvo);

  // ── 8. A ESCOLHA GUARDADA — as duas metades ───────────────────────────────
  // 8a. DENTRO da mesma frente ela SOBREVIVE (v1.2.x, o músico que toca o culto
  //     inteiro na cifra). Sem esta metade, zerar a escolha sempre passaria em
  //     8b e o recurso desapareceria em silêncio.
  const mesmaFrente = await pg.evaluate(() => {
    window.__cena(window.__musica(), null);
    openLyricsPopup();
    lvSource = 'cifra';           // o toque do operador no seletor
    closeLyricsPopup();
    openLyricsPopup();            // reabre na MESMA cena
    return { ativa: lvActiveSource() };
  });
  checar(mesmaFrente.ativa === 'cifra',
    'a ABA ESCOLHIDA sobrevive à reabertura dentro da MESMA frente — é a '
    + 'preferência de quem toca o culto inteiro', mesmaFrente);

  // 8b. MUDOU A FRENTE, MUDOU A PERGUNTA. Quem escolheu "Cifra" com o louvor
  //     sozinho no ar não pediu cifra para o instante em que o versículo subir.
  const trocouFrente = await pg.evaluate(() => {
    closeLyricsPopup();
    bibleSession = window.__biblia(true);   // o versículo sobe POR CIMA do louvor
    renderSlideNav();
    openLyricsPopup();
    return { fontes: lyricsViewSources(), ativa: lvActiveSource() };
  });
  checar(trocouFrente.fontes.join(',') === 'bible,lyrics,cifra'
      && trocouFrente.ativa === 'bible',
    '  ↳ e ela NÃO sobrevive à troca da FRENTE: com o versículo subindo por '
    + 'cima, a folha abre na Bíblia mesmo com "cifra" guardada — a escolha de '
    + 'uma cena não responde pela seguinte', trocouFrente);

  // 8c. E a cifra CONTINUA na lista: o que a frente vence é a ABERTURA, não a
  //     disponibilidade. Sem esta terceira, "apagar a cifra" passaria em 8b.
  const aindaTem = await pg.evaluate(() => {
    lvSource = 'cifra';
    return { ativa: lvActiveSource(), fontes: lyricsViewSources() };
  });
  checar(aindaTem.ativa === 'cifra',
    '  ↳ e um toque no seletor volta para ela na hora: o que a frente vence é a '
    + 'ABERTURA, não a disponibilidade', aindaTem);

  // 8d. O SENTINELA DIZ "NENHUMA FRENTE VISTA AINDA", NUNCA "A FRENTE MUDOU".
  //     Na PRIMEIRA abertura da sessão não houve cena anterior, logo não há
  //     escolha de antes a invalidar — e uma fonte pedida antes dela é um
  //     PEDIDO, não uma sobra. Ler o `null` como troca a derruba, e é a
  //     regressão que este lote de fato produziu: quem a pegou foi o
  //     `cifra-rolagem.test.mjs`, cujo cenário é exatamente este.
  const primeiraAbertura = await pg.evaluate(() => {
    closeLyricsPopup();
    window.__cena(window.__musica(), null);
    lvFrenteVista = null;         // a sessão recém-aberta, antes de qualquer folha
    lvSource = 'cifra';
    openLyricsPopup();
    return { ativa: lvActiveSource() };
  });
  checar(primeiraAbertura.ativa === 'cifra',
    'e o SENTINELA da frente diz "nenhuma vista ainda", nunca "mudou": uma fonte '
    + 'pedida antes da PRIMEIRA abertura sobrevive a ela — não houve cena '
    + 'anterior, logo não há escolha de antes a invalidar', primeiraAbertura);

  // ── 9. A FRENTE NÃO TROCA A ABA COM A FOLHA ABERTA ────────────────────────
  // Trocar a aba embaixo do dedo de quem está lendo é pior que uma aba
  // desatualizada — e o seletor está a um toque dali. A regra mora na ABERTURA,
  // e é isso que esta asserção prende.
  const abertaFica = await pg.evaluate(() => {
    closeLyricsPopup();
    window.__cena(window.__musica(), null);
    openLyricsPopup();
    lvSource = 'cifra';
    bibleSession = window.__biblia(true);   // a frente muda COM a folha aberta
    renderLyricsView();
    return { ativa: lvActiveSource(), fontes: lyricsViewSources() };
  });
  checar(abertaFica.ativa === 'cifra' && abertaFica.fontes[0] === 'bible',
    'com a folha ABERTA a frente que muda NÃO troca a aba embaixo do dedo de '
    + 'quem está lendo — a Bíblia entra na lista e espera o toque', abertaFica);

  // ── 12. A GEOMETRIA DO CABEÇALHO NÃO MUDA COM A ABA (v1.6.4) ──────────────
  //
  // Relatos do operador: o seletor de fontes *"está sem margem"* contra a caixa
  // de texto, tinha *"margem em excesso acima… me parece uma margem duplicada"*,
  // e o A+/A− com o ✕ *"ficaram puxados para a esquerda, colados nos outros
  // botões, se movendo de sua posição original correta"*.
  //
  // Os três são de LAYOUT e falham CALADOS: nada lança, nada some, e um teste de
  // comportamento passa em cima deles. O terceiro é o mais insidioso porque não
  // tem valor absoluto CERTO — o que existe é uma posição que as quatro abas
  // compartilham, e a régua é a COMPARAÇÃO entre elas.
  await pg.evaluate(() => window.__cena(window.__musica(), null));
  await abrir();
  // A FOLHA ENTRA POR `transform`, e medir no meio da animação mede o agendador
  // e não o layout — foi o que aconteceu na primeira escrita deste bloco. Quem
  // responde "já assentou?" é a própria animação, nunca um prazo.
  const assentar = () => pg.evaluate(() => Promise.all(
    lyricsPopupEl.querySelector('.popup-sheet').getAnimations()
      .map((a) => a.finished.catch(() => {})),
  ));
  const geo = async () => { await assentar(); return pg.evaluate(() => {
    const h = lyricsPopupEl.querySelector('.popup-header');
    const seg = lyricsPopupEl.querySelector('.lyricsview-seg');
    const px = (e, p) => parseFloat(getComputedStyle(e)[p]);
    return {
      fonte: lvActiveSource(),
      // O vão é a SOMA dos recuos que se encostam — as caixas ficam coladas, e
      // medir a distância entre elas daria zero nas duas versões.
      acima: +(px(h, 'paddingBottom') + px(seg, 'paddingTop')).toFixed(1),
      abaixo: +(lyricsViewBodyEl.getBoundingClientRect().top
        - seg.getBoundingClientRect().bottom + px(seg, 'paddingBottom')).toFixed(1),
      altura: +lyricsPopupEl.querySelector('.popup-sheet')
        .getBoundingClientRect().height.toFixed(1),
      segY: +seg.getBoundingClientRect().top.toFixed(1),
      fecharX: +lyricsPopupEl.querySelector('.popup-close')
        .getBoundingClientRect().left.toFixed(1),
      fonteX: +lyricsPopupEl.querySelector('.lv-fonte-ctl')
        .getBoundingClientRect().left.toFixed(1),
    };
  }); };
  // A FONTE É POSTA À MÃO: os blocos acima deixam a folha onde a cena os levou,
  // e comparar "a letra" com "a cifra" exige que a primeira SEJA a letra.
  await pg.evaluate(() => { lvSource = 'lyrics'; renderLyricsView(); });
  const naLetra = await geo();
  await pg.evaluate(() => { lvSource = 'cifra'; renderLyricsView(); });
  // Espera pelo FATO de que a geometria depende — a fila revelada no cabeçalho
  // —, nunca por um prazo. Ela é montada ANTES dos retornos cedo do
  // `lvBuildCifra` (a invariante da saída), então este seletor responde tanto
  // para a folha desenhada quanto para a espera.
  await pg.waitForSelector('#lyricsCifraCtl:not([hidden])', { timeout: 15000 });
  const naCifra = await geo();

  // REVERSÃO: devolver `padding-top: .6rem` ao `.lyricsview-seg` reprova aqui.
  checar(naLetra.acima < 14 && naCifra.acima < 14,
    'o seletor de fontes NÃO acumula o recuo do cabeçalho com o próprio: quem '
    + 'separa é um só, e 20,8px entre duas fileiras de controles era a margem '
    + 'duplicada que o operador viu', { naLetra, naCifra });
  // REVERSÃO: devolver `padding-bottom: .2rem` reprova aqui — era o que sobrou
  // quando a barra da cifra saiu e levou junto o vão que ela dava.
  checar(naLetra.abaixo >= 8 && naCifra.abaixo >= 8,
    'e ele RESPIRA da caixa de texto logo abaixo: sem isso o seletor fica '
    + 'encostado nela, que foi o relato', { naLetra, naCifra });
  // ← A QUE CARREGA O TERCEIRO RELATO, e ela é uma COMPARAÇÃO de propósito: não
  // há x absoluto certo, há o lugar que as abas compartilham. REVERSÃO: tirar o
  // `margin-right: auto` da `.lv-cifra-ctl` puxa os dois para a esquerda na
  // cifra e só nela — exatamente o que o operador descreveu.
  checar(naCifra.fecharX === naLetra.fecharX && naCifra.fonteX === naLetra.fonteX,
    'e o ✕ e o A+/A− ficam no MESMO lugar na cifra e na letra — o título era o '
    + 'espaçador da linha, e escondê-lo na cifra não pode mover o que mora à '
    + 'direita dele', { naLetra, naCifra });

  // ── 13. A JANELA NÃO ENCOLHE QUANDO NÃO HÁ CIFRA (v1.6.4) ────────────────
  //
  // Relato do operador: *"a janela do auxiliar de leitura é encolhida quando não
  // há cifra, isso muda a posição do botão de navegação dessa janela"*.
  //
  // A ponte de mentira DESTE oráculo não serve cifra — a aba cai em erro, com
  // uma frase por conteúdo —, e é exatamente o cenário do relato. A folha era
  // dimensionada pelo conteúdo até `80vh`, então ela encolhia e levava o seletor
  // junto: MEDIDO na reversão, 720px viram 178,9 e o seletor salta 541px, do
  // y=238 para o y=779. O alvo se move debaixo do dedo de quem ia tocar em
  // "Letra" para sair dali.
  //
  // A régua é a COMPARAÇÃO com a aba que TEM conteúdo, não um número: `80vh`
  // depende da tela, e escrevê-lo aqui seria guardar a altura de um viewport.
  //
  // REVERSÃO: trocar o `height: 80vh` de `#lyricsPopup .popup-sheet` de volta
  // por nada (o `max-height` herdado) reprova as duas.
  checar(naCifra.altura === naLetra.altura,
    'a janela do auxiliar mantém a MESMA altura sem cifra e com letra — ela '
    + 'deixou de ser dimensionada pelo que coube dentro', { naLetra, naCifra });
  checar(naCifra.segY === naLetra.segY,
    'e por isso o seletor de fontes não muda de lugar ao trocar de aba: o botão '
    + 'que se usa para SAIR da cifra não pode fugir do dedo', { naLetra, naCifra });
} finally {
  await ctx.close();
  await navegador.close();
  servidor.close();
}

if (falhas.length) {
  console.error('\n' + falhas.length + ' asserção(ões) reprovada(s).');
  process.exit(1);
}
console.log('\ntudo certo.');
