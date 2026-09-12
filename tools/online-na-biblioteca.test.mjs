// A COLETÂNEA DE VÍDEOS DO LOUVORJA — a LIGAÇÃO, não a regra.
//
// ## Por que ele existe, tendo o `online.test.mjs`
//
// Aquele prende a REGRA (`AVOnline.lerCatalogo`): dado um payload, que álbuns
// saem e o que é recusado. Ele passa inteiro com o recurso **desligado do
// app** — a regra continua certa e a Biblioteca não desenha nada. É a mesma
// divisão que o repositório já fez entre `coletanea.test.mjs` (a regra) e o
// bloco das coletâneas no `boot-nativo.test.mjs` (o fio até a tela), e ela
// existe porque **os dois lados quebram diferente**: *ler cada lado isolado
// aprova ambos*.
//
// Aqui se mede o FIO: a busca acontece, o catálogo é guardado, a seção nasce no
// lugar certo, o card é do tipo VÍDEO e a coletânea sobrevive a uma abertura
// SEM REDE.
//
// ## A célula que este arquivo existe para medir
//
// Até este lote, `ehLink(coll)` significava "é a série" — a série era a única
// coleção de vídeo. Cinco lugares perguntavam por ele querendo dizer OUTRA
// coisa ("tem calendário semanal"), e com a coletânea nova respondendo `true` a
// `ehLink` cada playlist da curadoria ganharia a caixa *"Manter o … da semana
// baixado"*: um interruptor marcável sobre uma rotina que procura uma data que
// aqueles vídeos não têm.
//
// **A asserção disso é um PAR, e a metade sozinha é tautologia:** afirmar só a
// AUSÊNCIA da caixa no card novo passa igualmente com o recurso apagado da
// SÉRIE. Por isso as duas metades são medidas na mesma passada, na mesma
// Biblioteca.
//
//   node tools/online-na-biblioteca.test.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperarCortina, esperar, esperarDb, porque, checar, falhas } from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);

// ── A FIXTURE ───────────────────────────────────────────────────────────────
// Escrita à mão, com a forma do `CollectionController@online` lida no
// código-fonte do `louvorja/api`: `default_image` é URL absoluta do i.ytimg e
// cai em string VAZIA (o `?? ''` do `OnlineVideos.php`), `default_image_base64`
// é um `data:` URI da mesma imagem, e `sequence` é a ordem da playlist.
//
// DOIS CANAIS de propósito, com o segundo alfabeticamente ANTES do primeiro na
// ordem do payload: é assim que a ordenação por canal fica dizível.
const CANAL_A = 'UCaaaaaaaaaaaaaaaaaaaaaa';
const CANAL_Z = 'UCzzzzzzzzzzzzzzzzzzzzzz';
const PL_A = 'PLaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const PL_Z = 'PLzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz';
const B64 = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const CATALOGO = {
  channels: [
    { channel_id: CANAL_Z, title: 'Zeta Louvores', custom_url: '@zeta', default_image: '', default_image_base64: B64 },
    { channel_id: CANAL_A, title: 'Alfa Adoração', custom_url: '@alfa', default_image: '', default_image_base64: B64 },
  ],
  playlists: [
    { playlist_id: PL_Z, channel_id: CANAL_Z, title: 'Corais da Zeta', default_image: '', default_image_base64: B64 },
    { playlist_id: PL_A, channel_id: CANAL_A, title: 'Louvores 2026', default_image: '', default_image_base64: B64 },
  ],
  videos: [
    // FORA DE ORDEM no payload, para que "a ordem é a do `sequence`" seja uma
    // asserção e não uma coincidência da ordem de entrada.
    { video_id: 'vvvvvvvvvv2', playlist_id: PL_A, title: 'Segundo louvor', sequence: 2, default_image: 'https://i.ytimg.com/vi/vvvvvvvvvv2/default.jpg', default_image_base64: B64 },
    { video_id: 'vvvvvvvvvv1', playlist_id: PL_A, title: 'Primeiro louvor', sequence: 1, default_image: 'https://i.ytimg.com/vi/vvvvvvvvvv1/default.jpg', default_image_base64: B64 },
    { video_id: 'vvvvvvvvvv3', playlist_id: PL_Z, title: 'Coral de abertura', sequence: 1, default_image: '', default_image_base64: B64 },
    // O ÓRFÃO: `playlist_id` que não existe. Ele não pode aparecer em álbum
    // nenhum, e tem de ser CONTADO no Registro.
    { video_id: 'vvvvvvvvvv9', playlist_id: 'PLnaoexiste0000000000000000000000', title: 'Louvores 2026 — extra', sequence: 1 },
  ],
};

// ── A PONTE DE MENTIRA ──────────────────────────────────────────────────────
// Mínima: o que este arquivo precisa é que `window.__NATIVE__` seja verdadeiro
// (é o que faz `onlineDisponivel()` e `serieDisponivel()` responderem `true`) e
// que nenhuma chamada da ponte fique PENDURADA — uma promessa que não resolve
// trava 60 s no `CALL_TIMEOUT_MS` do `native.js` e o arquivo só demora, sem
// reprovar nada. É a armadilha declarada no CLAUDE.md, e a allowlist abaixo é o
// que a fecha.
const PONTE = `(() => {
  const B = { shellVersion: () => 72, role: () => 'controle', appVersion: () => 'v1.8.97',
    busPost: () => {}, otaConfirm: () => {}, takeShare: () => null };
  const vazio = {
    displays: [], listFolder: [], ytCanalPlaylists: [], ytPlaylist: null, ytSearch: [],
    espelhoEstado: { ligado: false, telas: [] }, otaPending: null, otaCheck: null,
    espelhoDiag: {}, ytDiag: {}, otaDiag: {}, pacoteDiag: {}, micDiag: {},
    castTarget: '', temaClaro: null, systemVolume: null, farolEstado: {},
    espelhoCertEstado: {}, deckPages: null, pickDoc: null, pickFolder: null,
  };
  const nomes = ['apkInstalar','apkProcurar','bgProgress','captureVolumeKeys','castTarget',
    'deckDiscard','deckExportUrl','deckPages','displays','espelhoCertApagar','espelhoCertEstado',
    'espelhoCertImportar','espelhoDesligar','espelhoDiag','espelhoEstado','espelhoLigar',
    'keepAlive','listFolder','nowPlaying','openCast','openExternal','otaApply','otaCheck',
    'otaDiag','otaPending','pacoteDiag','pickDoc','pickFolder','systemVolume','temaClaro',
    'ytCancel','ytCanalPlaylists','ytDetalhes','ytDiag','ytDiscard','ytFetch','ytFetchAte',
    'ytFetchAudio','ytPlaylist','ytSearch','ytStream','farolEstado','projecaoLocal',
    'compartilharTexto','pacoteAbrir','pacoteFechar','cifraHtml','espelhoDerrubar',
    'espelhoAprovar','espelhoLigarEm','micDiag','requestMic','rotate','salvarTexto','copiarTexto'];
  for (const n of nomes) {
    if (B[n]) continue;
    B[n] = (...args) => {
      const id = args[0];
      if (typeof id === 'string') {
        const v = Object.prototype.hasOwnProperty.call(vazio, n) ? vazio[n] : null;
        setTimeout(() => { try { window.__avResolve(id, v); } catch (_) {} }, 0);
      }
      return undefined;
    };
  }
  window.__AVBridge = B;
})();`;

await new Promise((r) => servidor.listen(0, r));
const porta = servidor.address().port;
const navegador = await abrirNavegador();
const base = `http://localhost:${porta}`;

// Quantas vezes a rota do catálogo foi pedida — é a asserção do "uma
// requisição, o acervo inteiro" e do "não varre card a card".
let pedidos = 0;

async function novaPagina({ comCatalogo = true, estado = null } = {}) {
  const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true });
  await semRedeExterna(ctx);
  // DEPOIS do `semRedeExterna`, que é como o arnês manda: o Playwright resolve
  // as rotas da mais recente para a mais antiga, então esta ganha dela.
  await ctx.route(/collections\/online/, (rota) => {
    pedidos++;
    if (!comCatalogo) return rota.abort();
    return rota.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CATALOGO) });
  });
  const pg = await ctx.newPage();
  await pg.addInitScript(PONTE);
  if (estado) await pg.addInitScript(estado);
  return { ctx, pg };
}

// A Biblioteca, aberta e desenhada — e com a seção pedida ABERTA, porque uma
// seção fechada NÃO CONSTRÓI o corpo (`grupo()` devolve null) e um `querySelector`
// nos cards dela voltaria vazio por desenho, não por defeito.
const abrirSecao = (pg, nome) => pg.evaluate((n) => {
  if (!hymnSearchPopupEl.classList.contains('open')) openHymnSearch(false);
  grupoAberto = n;
  renderSearchResults('');
}, nome);

const erros = [];
let pg0 = null;
try {
  const a = await novaPagina();
  pg0 = a.pg;
  pg0.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await pg0.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  checar(await esperarCortina(pg0) === true, 'a cortina levantou (o app ficou tocável)');

  // ── 1. A BUSCA ACONTECEU, e o catálogo virou coleções ────────────────────
  const r1 = await esperar(pg0, () => typeof onlineCollections === 'function'
    && onlineCollections().length === 2, null, 20000);
  checar(r1 === true, 'a abertura busca o catálogo e ele vira DUAS coleções', porque(r1));

  checar(pedidos === 1,
    'e custa UMA requisição — o acervo inteiro numa resposta, não uma por card'
    + ' (varrer card a card repetiria a MESMA resposta, com cache de 10 min no servidor)',
    pedidos);

  // ── 2. A SEÇÃO EXISTE E ESTÁ NO LUGAR ────────────────────────────────────
  //
  // Por ÍNDICE ENTRE IRMÃOS, nunca por existência: a posição é a decisão (depois
  // das coletâneas do banco, antes dos órfãos), e uma asserção de existência
  // passa com a seção em qualquer lugar da lista.
  await abrirSecao(pg0, 'Vídeos do YouTube');
  const pos = await pg0.evaluate(() => {
    const grupos = [...document.querySelectorAll('#hymnResults > li.coll-group')];
    return { nomes: grupos.map((g) => g.dataset.grupo), total: grupos.length };
  });
  checar(pos.nomes.indexOf('Vídeos do YouTube') >= 0,
    'a seção "Vídeos do YouTube" está na Biblioteca', pos.nomes);
  const iOnline = pos.nomes.indexOf('Vídeos do YouTube');
  const iOutros = pos.nomes.indexOf('Outros álbuns');
  checar(iOutros < 0 || iOnline < iOutros,
    'e ela vem ANTES de "Outros álbuns" — sobra não separa duas seções de conteúdo',
    pos.nomes);

  // ── 3. UM CARD POR PLAYLIST, com o CANAL no subtítulo ────────────────────
  const cards = await pg0.evaluate(() => {
    const sec = [...document.querySelectorAll('#hymnResults > li.coll-group')]
      .find((g) => g.dataset.grupo === 'Vídeos do YouTube');
    if (!sec) return null;
    return [...sec.querySelectorAll('li.hymnal-card')].map((li) => ({
      nome: (li.querySelector('.coll-bar-name') || {}).textContent || '',
      sub: (li.querySelector('.coll-bar-sub') || {}).textContent || '',
    }));
  });
  checar(!!cards && cards.length === 2, 'a seção tem UM card por playlist', cards);
  if (cards && cards.length === 2) {
    checar(cards.map((c) => c.nome).join('|') === 'Louvores 2026|Corais da Zeta',
      'e eles saem agrupados por CANAL (Alfa antes de Zeta), não pelo nome da playlist'
      + ' — que os intercalaria e deixaria o subtítulo como única coisa distinguindo vizinhos',
      cards.map((c) => c.nome));
    checar(cards[0].sub.indexOf('Alfa Adoração') >= 0 && cards[1].sub.indexOf('Zeta Louvores') >= 0,
      'e o SUBTÍTULO de cada card é o canal (o mesmo `ctx.subtitle` do pivô categoria↔álbum)',
      cards.map((c) => c.sub));
  }

  // ── 4. O ÓRFÃO NÃO ENTROU EM ÁLBUM NENHUM ────────────────────────────────
  //
  // A regra de ouro, medida na TELA e não no módulo: o vídeo tem o título da
  // playlist no nome e um `playlist_id` que não existe.
  const faixas = await pg0.evaluate(() => onlineCollections()
    .flatMap((c) => collSongs(c.id).map((s) => ({ coll: c.name, id: s.id_music, nome: s.name }))));
  checar(!faixas.some((f) => f.id === 'vvvvvvvvvv9'),
    'REGRA DE OURO até a tela: o vídeo com `playlist_id` desconhecido não entra em álbum nenhum,'
    + ' mesmo com o título da playlist no nome', faixas.map((f) => f.id));
  checar(faixas.filter((f) => f.coll === 'Louvores 2026').map((f) => f.nome).join('|')
      === 'Primeiro louvor|Segundo louvor',
    'e as faixas saem na ordem do `sequence`, não na do payload (que as trouxe invertidas)',
    faixas.filter((f) => f.coll === 'Louvores 2026').map((f) => f.nome));

  // ── 5. O PAR DO `temCalendario` — a célula deste arquivo ─────────────────
  //
  // As duas metades na MESMA passada. Só a ausência é tautologia: ela passa
  // igualmente com a caixa apagada da série.
  const caixas = await pg0.evaluate(() => {
    const online = onlineCollections()[0];
    const serie = allCollections().find((c) => c.kind === 'serie');
    const temLinha = (coll) => !!(coll && serieAutoLinha(coll));
    return {
      online: online ? temLinha(online) : null,
      serie: serie ? temLinha(serie) : null,
      ehLinkOnline: online ? ehLink(online) : null,
      ehLinkSerie: serie ? ehLink(serie) : null,
    };
  });
  checar(caixas.ehLinkOnline === true && caixas.ehLinkSerie === true,
    'as DUAS famílias são LINK (é o que faz a folha do YouTube e o download item a item valerem'
    + ' para as duas)', caixas);
  checar(caixas.serie === true,
    'a caixa "Manter o … da semana baixado" CONTINUA na série (a metade que impede a tautologia)',
    caixas);
  checar(caixas.online === false,
    'e NÃO aparece na coletânea do LouvorJA — ela é do CALENDÁRIO (`coll.serie`), não do LINK:'
    + ' ali seria um interruptor marcável sobre uma rotina que procura uma data que aqueles'
    + ' vídeos não têm', caixas);

  // ── 6. O CARD É DE VÍDEO, não de música ──────────────────────────────────
  const tipo = await pg0.evaluate(() => {
    const c = onlineCollections()[0];
    return { temLetra: temLetra(c), video: ehColecaoDeVideo(c.id), tipo: tipoDaColecao(c) };
  });
  checar(tipo.temLetra === false,
    'a coletânea NÃO tem letra — sem isto a fila de `syncLyrics` pediria `music_<id>` ao LouvorJA'
    + ' com um id do YouTube que aquele banco nunca reconhece, a cada abertura, para sempre', tipo);
  checar(tipo.video === true,
    'e ela conta como coleção de VÍDEO (`ehColecaoDeVideo`) — fora disso a estimativa de peso'
    + ' herdaria a média do acervo de ÁUDIO e erraria por duas ordens de grandeza, para MENOS',
    tipo);

  // ── 7. O BLOCO DO REGISTRO diz o que veio e o que foi recusado ───────────
  const bloco = await pg0.evaluate(() => blocoOnline());
  checar(/2 canal\(is\).*2 playlist\(s\).*4 v[íi]deo\(s\)/.test(bloco || ''),
    'o Registro diz o que o PAYLOAD anunciou — é a única referência externa, e sem ela'
    + ' "2 álbuns" não separa "o LouvorJA não publicou" de "o app recusou"', bloco);
  checar(/não está em playlist nenhuma/.test(bloco || ''),
    'e nomeia a recusa do órfão, com a frase do motivo', bloco);

  // ── 8. A COLETÂNEA SOBREVIVE A UMA ABERTURA SEM REDE ─────────────────────
  //
  // É a razão inteira de guardar o catálogo: sem rede a busca falha, e sem a
  // semente do IndexedDB a seção só existiria no dia em que houvesse Wi-Fi —
  // que é o oposto do que uma igreja precisa no sábado de manhã.
  const antes = pedidos;
  await pg0.reload({ waitUntil: 'domcontentloaded' });
  await esperarCortina(pg0);
  // A rota passa a ABORTAR nesta mesma página: é o "sem rede" de verdade.
  await pg0.context().route(/collections\/online/, (rota) => { pedidos++; return rota.abort(); });
  await pg0.reload({ waitUntil: 'domcontentloaded' });
  checar(await esperarCortina(pg0) === true, 'a cortina levantou na abertura SEM rede');
  const r8 = await esperar(pg0, () => typeof onlineCollections === 'function'
    && onlineCollections().length === 2, null, 20000);
  checar(r8 === true,
    'SEM REDE a coletânea continua na Biblioteca, vinda do IndexedDB — é a razão inteira de'
    + ' guardar o catálogo lido', porque(r8));
  checar(pedidos > antes, 'e a busca chegou a ser TENTADA (a semente não substitui a busca)', { antes, pedidos });

  // A FALHA VIRA LINHA DO REGISTRO, e não silêncio. Sem isto o bloco escreve
  // "ainda não buscado neste aparelho" — a frase do caso NORMAL — sobre um
  // aparelho com Wi-Fi cuja rota está recusando.
  //
  // **`esperarDb` E NÃO `esperar`**, e a diferença é a armadilha declarada no
  // arnês: `waitForFunction` NÃO aguarda a Promise de um predicado `async` — a
  // Promise é *truthy*, a espera passa no primeiro quadro e a asserção aprova o
  // que veio verificar. Escrito com `esperar`, este bloco passou COM e SEM o
  // conserto (medido na reversão), que é a definição de tautologia.
  const r9 = await esperarDb(pg0, async () => {
    const d = await AVDB.getState('onlineDiag');
    return !!(d && d.erro);
  }, null, 20000);
  checar(r9 === true,
    'a busca que falha é GRAVADA no diário — senão o Registro diz "ainda não buscado" para sempre,'
    + ' que é a frase de um app que acabou de abrir', porque(r9));
  // E O REGISTRO DIZ, que é o desfecho que alguém lê a distância. A asserção é
  // sobre o TEXTO porque é o texto que é copiado e mandado.
  const blocoFalha = await pg0.evaluate(() => blocoOnline());
  checar(/ÚLTIMA BUSCA FALHOU/.test(blocoFalha || ''),
    'e o bloco do Registro NOMEIA a falha, em vez de repetir a frase do caso normal',
    blocoFalha);

  checar(erros.length === 0, 'nenhum erro de página no percurso inteiro', erros.slice(0, 4));
} finally {
  await navegador.close().catch(() => {});
  servidor.close();
}

console.log('');
if (falhas.length) {
  console.log(falhas.length + ' FALHA(S)');
  process.exit(1);
}
console.log('Todos passaram.');
