#!/usr/bin/env node
// ============================================================================
// A BATERIA DE TESTES DA CIFRA — ela mede a REDE, e nomeia o que falhou
//
// ## Por que ela precisa de oráculo
//
// A bateria é um DIAGNÓSTICO, e um diagnóstico não falha calado: ele falha
// **continuando a responder**, com a frase errada. É a mesma classe do
// Registro, e por isso a mesma exigência.
//
// Três modos de errar, todos mudos, todos travados aqui:
//
//  1. **Ela mede o DISCO em vez da rede.** Sem o `semDisco`, cada hino do
//     hinário volta "✓ guardada no aparelho" — a bateria declara o acervo
//     saudável sem ter feito uma requisição sequer, que é o oposto do que o
//     operador pediu. O caso semeia o disco com uma folha RECONHECÍVEL e
//     exige que o resultado venha do catálogo.
//  2. **A falha não diz onde ela tentou.** É a lista de endereços que
//     transforma um "✗" em conserto: com ela na mão o operador acha a música
//     no site, quase sempre sob outro artista, e fixa o endereço. Sem ela
//     sobra uma reclamação.
//  3. **Ela apaga a radiografia do operador.** Dezenas de procuras seguidas,
//     com `cifraGuardarEstrutura` num slot por endereço: sem o `mudo`, a
//     bateria enterra a página que o operador está diagnosticando — o mesmo
//     defeito que já mordeu este recurso três vezes.
//
//   node tools/cifra-bateria.test.mjs
// ============================================================================
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
};
const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const arquivo = path.join(RAIZ, p);
  if (!arquivo.startsWith(RAIZ) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
    res.writeHead(404); res.end('nao'); return;
  }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream' });
  fs.createReadStream(arquivo).pipe(res);
});

// O SITE DE MENTIRA, por FORMA de endereço — é a cadeia de tentativas que está
// sendo medida, e ela se distingue justamente pelo caminho que monta.
//
//  - `/novo-hinario-adventista/…` responde uma folha  → o degrau do CATÁLOGO
//  - `/marcador-um/…`             responde uma folha  → o degrau do ÁLBUM
//  - `/marcador-tres/…`           responde 200 ILEGÍVEL → o caso da radiografia
//  - o resto                      responde 404          → a falha completa
//
// A folha é SINTÉTICA, como todas as fixtures deste recurso: nenhum conteúdo
// de terceiro entra neste repositório.
const PONTE = `(() => {
  window.__urls = [];
  const FOLHA = '<h1>Musica Marcador</h1><h2>Artista Marcador</h2>'
    + '<span class="cifra_tom"><a>G</a></span>'
    + '<pre><b>G</b>      <b>C</b>\\nlinha de marcador\\n</pre>';
  // A PÁGINA QUE NÃO ABRE: existe, tem título, e nenhuma folha nem marcador de
  // letra — é o "não entendi", e é dela que a radiografia interessa.
  const ILEGIVEL = '<title>Musica Marcador - Cifra Club</title>'
    + '<h1>Musica Marcador</h1><h2>Artista Marcador</h2>'
    + '<div class="folha-nova">sem folha nenhuma aqui</div>';
  // E A PÁGINA DE LETRA: o site tem a música, sem os acordes. Outro desfecho,
  // outra ação — e a radiografia dela NÃO deve ser colhida.
  const SO_LETRA = '<title>Musica Marcador - Artista (letra da música) - Cifra Club</title>'
    + '<h1>Musica Marcador</h1><h2>Artista Marcador</h2>'
    + '<div class="letra"><p>uma linha de marcador</p></div>';
  const B = {
    shellVersion: () => 51,
    role: () => 'controle',
    appVersion: () => '1.98-teste',
    takeShare: () => '',
    busPost: () => {},
    otaConfirm: () => {},
    cifraHtml: (id, url) => {
      window.__urls.push(url);
      let r = { status: 404, html: '' };
      if (/\\/novo-hinario-adventista\\//.test(url) || /\\/marcador-um\\//.test(url)) r = { status: 200, html: FOLHA };
      else if (/\\/marcador-tres\\//.test(url)) r = { status: 200, html: ILEGIVEL };
      else if (/\\/marcador-quatro\\//.test(url)) r = { status: 200, html: SO_LETRA };
      setTimeout(() => { try { window.__avResolve(id, r); } catch (_) {} }, 0);
    },
  };
  const nomes = ['apkInstalar','apkProcurar','bgProgress','captureVolumeKeys','castTarget',
    'cifraDiag','deckDiscard','deckExportUrl','deckPages','displays','espelhoCertApagar',
    'espelhoCertEstado','espelhoCertImportar','espelhoDesligar','espelhoDiag','espelhoEstado',
    'espelhoLigar','keepAlive','listFolder','nowPlaying','openCast','openExternal','otaApply',
    'otaCheck','otaDiag','otaPending','pickDoc','pickFolder','requestMic','systemVolume',
    'temaClaro','ytCancel','ytCanalPlaylists','ytDiag','ytDiscard','ytFetch','ytFetchAte',
    'ytFetchAudio','ytPlaylist','ytSearch','ytStream','areaTransferencia','atualizacaoEstado'];
  for (const n of nomes) {
    if (B[n]) continue;
    B[n] = (...args) => {
      const id = args[0];
      if (typeof id === 'string') setTimeout(() => { try { window.__avResolve(id, null); } catch (_) {} }, 0);
      return undefined;
    };
  }
  window.__AVBridge = B;
})();`;

const collSongsNome = 'Um Numero 1';
const falhas = [];
function checar(cond, msg, obtido) {
  if (cond) console.log('ok      ' + msg);
  else {
    console.log('FALHOU  ' + msg + (obtido !== undefined ? '\n        obtido: ' + JSON.stringify(obtido) : ''));
    falhas.push(msg);
  }
}

await new Promise((r) => servidor.listen(0, r));
const porta = servidor.address().port;
const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);
const pg = await ctx.newPage();
const base = `http://localhost:${porta}`;

try {
  await pg.addInitScript(PONTE);
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  // A MESMA espera do watchdog de boot: plantar cenário antes do fim do
  // `init()` é correr contra a inicialização, que o zera com razão.
  await pg.waitForFunction(
    () => window.__NATIVE__ === true && window.AVDB && typeof window.__avBack === 'function'
      && !!document.querySelector('#playlist li'),
    null, { timeout: 30000 },
  );

  // ---- O ACERVO PLANTADO -------------------------------------------------
  // Um hinário (endereço deduzível pelo catálogo) e três álbuns, um por
  // desfecho. Três faixas em cada, para o teto de duas por álbum ter o que
  // recusar.
  await pg.evaluate(() => {
    const faixas = (p) => Array.from({ length: 3 }, (_, i) => ({
      id_music: p + i, track: i + 1, name: p + ' Numero ' + (i + 1),
      duration: '3:00', has_instrumental_music: false, fileIdFull: null, fileIdPlayback: null,
    }));
    albumCatalog.albums = [
      { id_album: 'a1', name: 'Marcador Um' },
      { id_album: 'a2', name: 'Marcador Dois' },
      { id_album: 'a3', name: 'Marcador Tres' },
      { id_album: 'a4', name: 'Marcador Quatro' },
    ];
    collState['hymnal-2022'] = { songs: faixas('Hino') };
    collState['album-a1'] = { songs: faixas('Um') };
    collState['album-a2'] = { songs: faixas('Dois') };
    collState['album-a3'] = { songs: faixas('Tres') };
    collState['album-a4'] = { songs: faixas('Quatro') };
    // Os OUTROS acervos ficam de fora: um álbum sem faixa não entra na bateria,
    // e o hinário de 1996 sem faixas plantadas também não.
    delete collState['hymnal-1996'];
  });

  const albuns = await pg.evaluate(() => cifraAlbunsDaBateria().map((c) => c.name));
  checar(albuns.length === 5, 'a bateria vê os cinco acervos com faixa', albuns);

  // O TETO POR ÁLBUM. Três faixas plantadas, duas sorteadas — e SEM REPETIR,
  // que é o que um sorteio com reposição erraria calado (o mesmo hino medido
  // duas vezes e o terceiro nunca).
  const amostra = await pg.evaluate(() => {
    const c = allCollections().find((x) => x.id === 'album-a1');
    const n = cifraAmostraDoAlbum(c).map((s) => s.name);
    return { n, unicos: new Set(n).size };
  });
  checar(amostra.n.length === 2, 'sorteia no máximo duas faixas por álbum', amostra.n);
  checar(amostra.unicos === 2, 'e não repete a mesma faixa', amostra);

  // ---- O DISCO SEMEADO, com uma folha RECONHECÍVEL -----------------------
  // Se a bateria ler o disco, o tom volta "Z" e a via volta `aparelho`. É a
  // armadilha do caso 1, e ela tem de ficar intocada.
  await pg.evaluate(async () => {
    const disco = {};
    for (const s of collSongs('hymnal-2022')) {
      disco[cifraChaveNoDisco(s.name)] = {
        url: 'https://www.cifraclub.com.br/DO-DISCO/', em: 1,
        pagina: { titulo: s.name, artista: '', tom: 'Z', linhas: [{ tipo: 'letra', texto: 'do disco' }] },
      };
    }
    await AVDB.setState('cifras:hymnal-2022', disco);
    cifraDiscoColl = ''; cifraDisco = null;
  });

  // ---- A BATERIA ---------------------------------------------------------
  await pg.evaluate(() => { cifraEstruturas = []; window.__urls = []; return cifraRodarBateria(); });
  const r = await pg.evaluate(() => ({
    total: cifraBateria.total,
    albuns: cifraBateria.albuns,
    pronto: !!cifraBateria.pronto,
    itens: cifraBateria.itens.map((i) => ({
      album: i.album, nome: i.nome, ok: i.ok, via: i.via, motivo: i.motivo,
      url: i.url, tentativas: i.tentativas, radiografia: i.radiografia,
    })),
    ilegiveis: cifraBateria.ilegiveis,
    estruturas: cifraEstruturas.length,
    urls: window.__urls,
    texto: cifraBateriaTexto(),
    guardada: null,
  }));
  checar(r.pronto && r.total === 10 && r.itens.length === 10,
    'dez músicas medidas — duas de cada um dos cinco acervos', { total: r.total, n: r.itens.length });

  const hino = r.itens.filter((i) => i.album.includes('inário') || i.album.includes('inario'));
  const um = r.itens.filter((i) => i.album === 'Marcador Um');
  const dois = r.itens.filter((i) => i.album === 'Marcador Dois');
  const tres = r.itens.filter((i) => i.album === 'Marcador Tres');
  const quatro = r.itens.filter((i) => i.album === 'Marcador Quatro');
  checar(hino.length === 2 && um.length === 2 && dois.length === 2 && tres.length === 2
    && quatro.length === 2, 'e cada acervo aparece com as suas duas',
    { hino: hino.length, um: um.length, dois: dois.length, tres: tres.length, quatro: quatro.length });

  // 1. ELA MEDE A REDE, NÃO O DISCO.
  checar(hino.every((i) => i.ok && i.via === 'catalogo'),
    'o hino volta pelo CATÁLOGO, com o disco semeado por baixo — a bateria mede a rede',
    hino.map((i) => i.via));
  checar(r.urls.some((u) => /novo-hinario-adventista/.test(u)),
    'e a requisição do catálogo de fato saiu', r.urls.filter((u) => /hinario/.test(u)).slice(0, 2));
  checar(!r.itens.some((i) => i.via === 'aparelho'),
    'nenhum resultado veio do aparelho — `semDisco` é o que faz a medição valer',
    r.itens.map((i) => i.via));

  // O DEGRAU DO ÁLBUM, que é o achado que a v1.2.5 comprou: o nome do álbum do
  // acervo É o artista do site.
  checar(um.every((i) => i.ok && i.via === 'album'),
    'o álbum-como-artista aparece nomeado no resultado', um.map((i) => i.via));

  // 2. A FALHA DIZ ONDE TENTOU — é isto que transforma um "✗" em conserto.
  checar(dois.every((i) => !i.ok), 'o álbum que não existe no site falha', dois.map((i) => i.ok));
  checar(dois.every((i) => (i.tentativas || []).length >= 2),
    'e a falha carrega TODOS os endereços tentados', dois.map((i) => (i.tentativas || []).length));
  checar(dois.every((i) => i.tentativas.some((t) => /marcador-dois/.test(t))
    && i.tentativas.some((t) => /ministerio-jovem/.test(t))),
    'o álbum E os artistas padrão estão na lista, com o desfecho de cada um',
    dois[0] && dois[0].tentativas);
  checar(um.every((i) => !(i.tentativas || []).length),
    'o SUCESSO não carrega a cadeia — ali o que interessa é o degrau que venceu',
    um.map((i) => (i.tentativas || []).length));

  // 3. A RADIOGRAFIA DO OPERADOR FICA INTACTA. O terceiro álbum responde 200
  // ilegível, que é o ÚNICO desfecho que grava estrutura.
  checar(tres.every((i) => !i.ok && i.motivo === 'ilegivel'),
    'o terceiro álbum abre a página e o parser não a entende', tres.map((i) => i.motivo));
  checar(r.estruturas === 0,
    'e a bateria NÃO escreve radiografia — sem `mudo` ela enterra o diagnóstico do operador',
    r.estruturas);

  // 3b. MAS ELA TRAZ A FORMA DAS PÁGINAS QUE NÃO ENTENDEU, no resultado DELA.
  // Sem isto a pergunta que a bateria existe para responder — "o site mudou de
  // marcação, ou aquelas músicas não têm cifra?" — fica sem resposta.
  const comRadio = r.itens.filter((i) => i.radiografia);
  checar(comRadio.length > 0,
    'a bateria traz a radiografia das páginas ilegíveis, no resultado dela',
    comRadio.length);
  checar(comRadio.every((i) => /<pre>/.test(i.radiografia) && /caractere/.test(i.radiografia)),
    'e ela é a FORMA da página: contagens e tamanhos', comRadio[0] && comRadio[0].radiografia);
  checar(comRadio.every((i) => !/sem folha nenhuma aqui/.test(i.radiografia)),
    'sem um pedaço do conteúdo — o Registro sai do aparelho, o conteúdo de terceiro não');
  checar(r.ilegiveis >= comRadio.length,
    'e o TOTAL de ilegíveis é contado, mesmo além do teto de radiografias',
    { ilegiveis: r.ilegiveis, comRadio: comRadio.length });

  // 4. O SITE SÓ TEM A LETRA — outro desfecho, outra ação. Achatá-lo em
  // `ilegivel` manda investigar um parser certo e faz o download do hinário
  // rebater a mesma música toda sessão, para sempre.
  checar(quatro.every((i) => !i.ok && i.motivo === 'sem-cifra'),
    'o quarto álbum responde uma página de LETRA, e o motivo diz isso',
    quatro.map((i) => i.motivo));
  // A RADIOGRAFIA VALE PARA O "SÓ LETRA" TAMBÉM (v1.2.16). Ela era poupada ali
  // porque "já se sabia o que a página era" — e essa certeza caiu: o operador
  // conferiu à mão que o Hinário 2022 tem 100% das cifras no site, e ~309 hinos
  // voltaram como `so-letra`. Ou o endereço não leva à página que pensamos, ou
  // a marcação não significa o que supusemos, e as duas só se distinguem
  // VENDO A FORMA da página.
  checar(quatro.some((i) => i.radiografia),
    'a página de "só letra" também gasta radiografia — o veredito virou suspeito',
    quatro.map((i) => !!i.radiografia));

  // ---- O BLOCO DO REGISTRO ----------------------------------------------
  checar(/\d+ ✓ \/ \d+ ✗/.test(r.texto), 'o bloco abre com o placar', r.texto.split('\n')[0]);
  checar(r.texto.includes('Marcador Dois') && r.texto.includes('marcador-dois'),
    'o álbum que falhou aparece com os endereços tentados, e é por eles que o operador acha a música à mão');
  checar(r.texto.includes('catálogo do hinário') && r.texto.includes('álbum como artista'),
    'e os degraus vencedores saem por extenso, não pela chave', r.texto.slice(0, 400));
  // NADA DE CONTEÚDO. O Registro existe para ser COPIADO para fora, e o
  // contrato deste recurso é LER cifra de terceiro no aparelho, nunca
  // distribuí-la. Uma linha da folha aqui furaria isso em silêncio.
  checar(!r.texto.includes('linha de marcador'),
    'e nenhum pedaço de folha entra no Registro', r.texto.slice(0, 200));

  // O QUE SOBREVIVE AO APP FECHADO — o valor da bateria é ser lida DEPOIS.
  const guardado = await pg.evaluate(async () => {
    const v = await AVDB.getState('cifraBateria');
    return v && Array.isArray(v.itens) ? v.itens.length : -1;
  });
  checar(guardado === 10, 'o resultado fica guardado no banco, não só em memória', guardado);

  // O BOTÃO diz o placar: o resultado mora no Registro, que não tem visor —
  // sem ele, tocar e não ver nada é indistinguível de o botão não fazer nada.
  const rotulo = await pg.evaluate(() => {
    const el = document.getElementById('cifraBateriaRow');
    return { texto: el ? el.textContent : '', escondido: el ? el.hidden : true };
  });
  checar(!rotulo.escondido && /✓/.test(rotulo.texto) && /✗/.test(rotulo.texto),
    'e o botão mostra o placar da última bateria', rotulo);
  // ---- O LEITOR DA BIBLIOTECA: A MESMA FOLHA, SEM TELÃO (v1.2.14) --------
  //
  // A folha nasceu presa ao `currentItem`, então ler uma música exigia
  // PROJETÁ-LA. O músico quer o contrário: abrir a cifra no ensaio sem que a
  // congregação veja nada.
  //
  // Três coisas podem falhar aqui, e as três calam:
  //  1. a folha mostrar a música ERRADA (a da cena, não a que se pediu);
  //  2. alguma coisa ir ao TELÃO — o defeito que o recurso existe para não ter;
  //  3. o relógio da cena governar a rolagem de OUTRA música, o que não erra
  //     alto: a folha anda, só que no compasso errado.
  const leitor = await pg.evaluate(async () => {
    const enviados = [];
    const orig = AVDB.sendCommand;
    AVDB.sendCommand = (c) => { enviados.push(c && c.type); return orig.call(AVDB, c); };
    // A CENA: outra música, com duração, para o relógio existir de verdade.
    currentItem = {
      id: 'da-cena', name: 'Musica Da Cena', kind: 'audio', seconds: 200,
      lyrics: [{ text: 'linha da cena' }],
    };
    // O RELÓGIO DA CENA, DE VERDADE: sem isto o `cifraDuracaoNoAr` devolveria 0
    // por outro motivo (barra desabilitada) e a guarda que este caso mede nunca
    // seria exercitada — o oráculo aprovaria a remoção dela.
    midiaNoAr = true;
    seekEl.disabled = false;
    seekEl.max = '200';
    const coll = allCollections().find((c) => c.id === 'album-a1');
    const faixa = collSongs('album-a1')[0];
    const alvo = await lvItemDaBiblioteca(coll, faixa);
    openLyricsPopup(alvo, 'cifra');
    const r = {
      titulo: lyricsPopupTitleEl.textContent,
      fonte: lvActiveSource(),
      naCena: lvNaCena(),
      nome: cifraNomeDoItem(lvItem()),
      colecao: (cifraColecaoDoItem(lvItem()) || {}).id || '',
      relogio: cifraDuracaoNoAr(),
      indice: lvCurrentIndex('lyrics'),
      enviados: enviados.slice(),
    };
    // E a CENA continua com relógio — a prova de que o 0 acima veio da guarda,
    // não de a barra estar desabilitada.
    closeLyricsPopup();
    r.relogioDaCena = cifraDuracaoNoAr();
    r.depoisDeFechar = lvNaCena();
    midiaNoAr = false; seekEl.disabled = true;
    AVDB.sendCommand = orig;
    return r;
  });
  checar(leitor.nome === collSongsNome, 'a folha abre para a faixa da BIBLIOTECA, não para a da cena',
    { nome: leitor.nome, titulo: leitor.titulo });
  checar(leitor.colecao === 'album-a1',
    'e ela reencontra a coleção — é dela que saem o catálogo e o arquivo no aparelho',
    leitor.colecao);
  checar(leitor.fonte === 'cifra', 'abre na CIFRA, que é o que o músico foi buscar', leitor.fonte);
  checar(leitor.naCena === false, 'e a folha sabe que NÃO é a cena', leitor.naCena);
  // 2. NADA VAI AO TELÃO. É a promessa inteira do recurso, e a única que falha
  // sem deixar rastro na tela de quem abriu a folha.
  checar(leitor.enviados.length === 0,
    'NENHUM comando foi ao telão — ler não é projetar', leitor.enviados);
  // 3. E O RELÓGIO DA CENA NÃO GOVERNA ESTA FOLHA. Com duração, o modo `auto`
  // vira uma função de `authoritativeTime()` — que aqui é o tempo de OUTRA
  // música. Sem relógio ele cai no livre, que é o que um ensaio quer.
  checar(leitor.relogio === 0,
    'a rolagem automática não segue o relógio de outra música', leitor.relogio);
  checar(leitor.relogioDaCena === 200,
    'e o relógio EXISTIA — o zero acima é a guarda, não uma barra desabilitada',
    leitor.relogioDaCena);
  checar(leitor.indice === -1,
    'e nenhuma estrofe é destacada: sem cena não há posição', leitor.indice);
  checar(leitor.depoisDeFechar === true,
    'fechar a folha devolve o leitor à cena — o alvo é o desvio de UMA leitura',
    leitor.depoisDeFechar);

} finally {
  await navegador.close();
  servidor.close();
}

console.log('\n' + (falhas.length ? falhas.length + ' FALHA(S)' : 'tudo certo'));
process.exit(falhas.length ? 1 : 0);
