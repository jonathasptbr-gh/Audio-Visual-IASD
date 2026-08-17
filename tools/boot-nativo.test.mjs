// O BOOT COMO O APP O FAZ — a base web com a PONTE presente.
//
// ## Por que ele existe
//
// O `smoke.mjs` sobe a base web num Chromium sem `__AVBridge`, e isso é
// deliberado: ali se verifica o que vale nos dois contextos. O preço, que
// ninguém tinha cobrado até a v5.195, é que **todo caminho guardado por
// `window.__NATIVE__` nunca é executado por teste nenhum** — e esses caminhos
// são exatamente os que só rodam no aparelho, onde não há console para olhar.
//
// A v5.195 saiu com um `const` lido na CARGA do módulo e declarado 14 mil
// linhas abaixo. A leitura mora dentro de `if (espelhoDisponivel())`, que é
// FALSO num navegador — então o `smoke.mjs` passou verde, o bundle foi para o
// OTA, e o aparelho abriu em PRETO: `ReferenceError` por zona morta temporal,
// `controle.js` abortado, o watchdog do OTA descartando o bundle no lançamento
// seguinte e o app caindo no embutido do APK. Três sintomas em sequência
// (tela preta → tela pela metade → a versão antiga de volta) para uma causa só,
// e nenhum teste tinha como vê-la.
//
// Este arquivo fecha esse buraco pelo caminho mais barato que existe: injeta um
// `__AVBridge` DE MENTIRA antes de a página carregar e pergunta a mesma coisa
// que o watchdog do OTA pergunta — **o app ficou de pé?** (`otaAppIsUp`, em
// `shared/native.js`). Se ficou, o bundle boota no aparelho; se não, ele
// abriria em preto lá.
//
// ## O que ele NÃO é
//
// Não é teste dos recursos nativos: a ponte responde valores vazios e
// plausíveis, não simula Presentation, download, nem servidor. O que se afirma
// aqui é só o boot — que é precisamente o que o watchdog decide, e o que custa
// um culto quando falha.
//
//   node tools/boot-nativo.test.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const falhas = [];
function checar(cond, msg) {
  if (cond) console.log('ok      ' + msg);
  else { console.log('FALHOU  ' + msg); falhas.push(msg); }
}

// A PONTE DE MENTIRA. A lista de métodos sai de um `grep` em `shared/native.js`
// (todo `B.<nome>(`) — um método novo lá que este arquivo não conheça responde
// `undefined`, que é o mesmo que um shell antigo faria, e o `try` do
// `native.js` já trata. O contrato do lado Kotlin é assíncrono por `callId`:
// quem chama espera `window.__avResolve(id, json)`, então os métodos com
// `callId` resolvem sozinhos no próximo tique.
const ponteCom = (espelho, telas) => `(() => {
  const vazio = { displays: ${JSON.stringify(telas || [])}, listFolder: [], pickDoc: [], ytSearch: [],
    espelhoEstado: ${JSON.stringify(espelho)}, espelhoDiag: {},
    espelhoCertEstado: { temCert: false }, castTarget: { label: 'Tela de teste' } };
  const comCallId = new Set(['displays','listFolder','pickDoc','pickFolder','ytSearch','ytFetch',
    'ytFetchAte','ytFetchAudio','ytStream','deckPages','deckExportUrl','requestMic','castTarget',
    'espelhoEstado','espelhoDiag','espelhoCertEstado','espelhoCertImportar','espelhoCertApagar',
    'apkProcurar','apkInstalar','otaPending','otaApply','otaCheck','otaDiag','ytDiag']);
  const B = {
    shellVersion: () => 41,
    role: () => 'controle',
    appVersion: () => '1.98-teste',
    takeShare: () => '',
    busPost: (t) => { try { (window.__enviados = window.__enviados || []).push(JSON.parse(t)); } catch (_) {} },
    otaConfirm: () => {},
    // AS SÉRIES (shell 41), com resposta POR URL — o genérico abaixo devolve um
    // valor fixo por método, e aqui cada playlist precisa dos itens dela.
    //
    // As strings são VERBATIM do @provaievedeoficial, com as duas armadilhas
    // que o \`serie.js\` documenta: a playlist de agosto SEM o hífen que as
    // outras têm, e o marcador de Libras em duas formas (\`(Libras)\` na
    // playlist, \`- Libras\` no vídeo). Um harness que "limpasse" isso provaria
    // o percurso contra um canal que não existe — a lição da v5.204.
    //
    // E ele responde POR CANAL (v5.244), porque agora há dois. O de baixo é o
    // @daniellocutor, cuja aba Playlists põe a MESMA série em quatro idiomas
    // lado a lado — é essa a armadilha 7, e um stub que devolvesse a mesma
    // lista para os dois canais não teria como exercitá-la.
    ytCanalPlaylists: (id, canal) => {
      const pls = /daniellocutor/.test(String(canal)) ? [
        { name: 'Misiones | 3º Trimestre 2026', url: 'd/es3', count: 6 },
        { name: '【聖工消息】2026 第三季 (3 Quarter 26)', url: 'd/zh3', count: 9 },
        { name: 'Informativo | 4º Trimestre 2026', url: 'd/pt4', count: 1 },
        { name: 'Informativo | 3º Trimestre 2026', url: 'd/pt3', count: 3 },
        { name: 'Mission Stories | 2º Quarter 2026', url: 'd/en2', count: 13 },
      ] : [
        { name: 'Provai e Vede - Agosto 2026 (Libras)', url: 'p/ago-libras', count: 2 },
        // A CONTAGEM DIVERGE DA ENTREGA de propósito: o canal anuncia 4 e a
        // extração traz 3. É o que os dois canais de verdade fazem (39×38 e
        // 51×50 no primeiro registro real) — um vídeo só para membros, um
        // removido —, e é o achado mais silencioso deste caminho: nada erra,
        // nada recusa, e o sábado daquele episódio não existe na lista.
        { name: 'Provai e Vede Agosto 2026', url: 'p/ago', count: 4 },
        { name: 'Provai e Vede - Julho 2026', url: 'p/jul', count: 1 },
        { name: 'Semana de Mordomia Cristã 2026', url: 'p/outra', count: 9 },
        // O ARQUIVO DOS ANOS ANTERIORES. Ele existe aqui porque o canal de
        // verdade tem 94 playlists e a maior parte é isto — listá-las por
        // inteiro afogava as 9 aceitas sob oitenta linhas mortas (v5.252).
        { name: 'Provai e Vede - Dezembro 2025', url: 'p/dez25', count: 4 },
        { name: 'Provai e Vede - Novembro 2025 (Libras)', url: 'p/nov25l', count: 4 },
      ];
      setTimeout(() => { try { window.__avResolve(id, pls); } catch (_) {} }, 0);
    },
    ytPlaylist: (id, url) => {
      // Contador de EXTRAÇÕES: é ele que prova a economia da assinatura — e,
      // do outro lado, que a economia não se transforma em índice preso.
      window.__nPlaylist = (window.__nPlaylist || 0) + 1;
      const porUrl = {
        'p/ago': { name: 'Provai e Vede Agosto 2026', author: 'Provai e Vede | Oficial', items: [
          // A MINIATURA é \`data:\` de propósito: o extrator devolve uma URL do
          // YouTube, e uma imagem remota num teste é uma requisição que sai
          // pela rede do runner — ou ela falha e vira ruído no console, ou ela
          // dá certo e o caso passa a depender de um serviço de fora. O que se
          // afirma aqui é que a gaveta DESENHA a miniatura que o índice
          // guardou, e para isso a origem dos pixels é indiferente.
          { id: 'aaaaaaaaaa1', url: 'y/1', name: 'Match point | Provai e Vede 2026 (01/Ago)', seconds: 319,
            thumb: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' },
          { id: 'aaaaaaaaaa2', url: 'y/2', name: 'Cada centavo conta | Provai e Vede 2026 (08/Ago) - Libras', seconds: 307 },
          { id: 'aaaaaaaaaa3', url: 'y/3', name: 'Cada centavo conta | Provai e Vede 2026 (08/Ago)', seconds: 307 },
        ] },
        'p/jul': { name: 'Provai e Vede - Julho 2026', author: 'Provai e Vede | Oficial', items: [
          { id: 'aaaaaaaaaa4', url: 'y/4', name: 'Chamado em Silêncio | Provai e Vede 2026 (25/Jul)', seconds: 280 },
        ] },
        // O @daniellocutor. O título do vídeo é a SÉRIE + a data, sem nome de
        // episódio — e o vídeo em espanhol começa com a mesma palavra que o em
        // português, que é por que ele está aqui DENTRO da playlist de PT: é o
        // único lugar em que a recusa por idioma pode ser exercitada.
        'd/pt3': { name: 'Informativo | 3º Trimestre 2026', author: 'Daniel Gonçalves', items: [
          { id: 'bbbbbbbbbb1', url: 'd/1', name: 'Informativo Mundial das Missões | 15 AGOSTO 2026', seconds: 155 },
          { id: 'bbbbbbbbbb2', url: 'd/2', name: 'Informativo Mundial de las Misiones | 15 AGOSTO 2026', seconds: 155 },
          { id: 'bbbbbbbbbb3', url: 'd/3', name: 'Informativo Mundial das Missões | 04 JULHO 2026', seconds: 184 },
        ] },
        // AS DATAS DESTE STUB SÃO PASSADAS de propósito: o Informativo esconde o
        // que ainda não saiu (v5.255), e um episódio de outubro seria invisível
        // em agosto — o caso do CORTE tem clock fixo, mais abaixo, e não pode
        // contaminar as asserções de ordem e rótulo daqui. A playlist continua
        // sendo a do 4º trimestre: quem dá o mês do item é a data do TÍTULO.
        'd/pt4': { name: 'Informativo | 4º Trimestre 2026', author: 'Daniel Gonçalves', items: [
          { id: 'bbbbbbbbbb4', url: 'd/4', name: 'Informativo Mundial das Missões | 07 FEVEREIRO 2026', seconds: 170 },
          // SEM DATA no título: ele ENTRA (regra de ouro) e o Registro tem de
          // NOMEÁ-LO — é o achado que a v5.230 custou uma versão para
          // descobrir, e é dele que sai o próximo ajuste da leitura de data.
          { id: 'bbbbbbbbbb5', url: 'd/5', name: 'Informativo Mundial das Missões | especial de encerramento', seconds: 200 },
        ] },
      };
      setTimeout(() => {
        try { window.__avResolve(id, porUrl[url] || null); } catch (_) {}
      }, 0);
    },
  };
  const nomes = ['apkInstalar','apkProcurar','bgProgress','captureVolumeKeys','castTarget',
    'deckDiscard','deckExportUrl','deckPages','displays','espelhoAprovar','espelhoCertApagar',
    'espelhoCertEstado','espelhoCertImportar','espelhoDesligar','espelhoDiag','espelhoEstado',
    'espelhoLigar','keepAlive','listFolder','nowPlaying','openCast','openExternal','otaApply',
    'otaCheck','otaDiag','otaPending','pickDoc','pickFolder','requestMic','systemVolume',
    'temaClaro','ytCancel','ytCanalPlaylists','ytDiag','ytDiscard','ytFetch','ytFetchAte',
    'ytFetchAudio','ytPlaylist','ytSearch','ytStream'];
  for (const n of nomes) {
    if (B[n]) continue;
    B[n] = (...args) => {
      if (!comCallId.has(n)) return undefined;
      // O primeiro argumento é o \`callId\` nas chamadas com Promise.
      const id = args[0];
      if (typeof id === 'string') {
        const v = Object.prototype.hasOwnProperty.call(vazio, n) ? vazio[n] : null;
        setTimeout(() => { try { window.__avResolve(id, v); } catch (_) {} }, 0);
      }
      return undefined;
    };
  }
  // O CANAL DE MÍDIA da tela (o shell o injeta quando a transmissão sobe): é a
  // única condição de que o reenvio de preferências depende de verdade.
  window.__avTelaMidia = { postMessage: () => {} };
  window.__AVBridge = B;
})();`;

// O DESLIGADO é o estado de partida; o segundo cenário é o do OPERADOR.
const PONTE = ponteCom({ ligado: false, telas: [] }, []);

await new Promise((r) => servidor.listen(0, r));
const porta = servidor.address().port;
const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true });
const pg = await ctx.newPage();
const base = `http://localhost:${porta}`;

const erros = [];
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY/;
pg.on('console', (m) => {
  if (m.type() !== 'error') return;
  const t = m.text();
  if (EXTERNO.test(t) || /Failed to load resource/.test(t)) return;
  erros.push(t);
});
pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));

try {
  await pg.addInitScript(PONTE);
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });

  checar(await pg.evaluate(() => window.__NATIVE__ === true),
    'a base entra em MODO APP (a ponte foi vista)');
  checar(await pg.evaluate(() => (window.__SHELL_VERSION__ | 0) >= 32),
    'e enxerga um shell que tem o espelho — é este ramo que o navegador nunca executa');

  // A MESMA PERGUNTA DO WATCHDOG. `otaAppIsUp` é o que decide, no aparelho, se
  // um bundle baixado é carimbado como bom ou descartado no lançamento
  // seguinte: papel `controle`, os três módulos compartilhados, o `__avBack` do
  // fim do `controle.js` e um `<li>` na playlist (que só existe depois de o
  // `init()` assíncrono terminar). Reusá-la é não inventar um segundo critério
  // que envelheceria à parte do primeiro.
  let deuPe = false;
  try {
    await pg.waitForFunction(
      () => window.AVDB && window.AVStream && window.createStage
        && typeof window.__avBack === 'function'
        && !!document.querySelector('#playlist li'),
      null, { timeout: 25000 },
    );
    deuPe = true;
  } catch (_) { deuPe = false; }
  checar(deuPe, 'O APP FICOU DE PÉ com a ponte presente (o critério do watchdog do OTA)');

  // ── A SÉRIE (v5.228) ───────────────────────────────────────────────────
  // O card só existe com a ponte E com shell >= 41, então este é o ÚNICO teste
  // que pode exercitá-lo — no `smoke.mjs` a série nem chega a ser construída.
  // E o que se afirma aqui é o percurso INTEIRO, do canal até a lista: a regra
  // pura já tem oráculo próprio (`serie.test.mjs`), o que faltava era provar
  // que ela está de fato LIGADA ao provedor de coleção.
  const serie = await pg.evaluate(async () => {
    const c = allCollections().find((x) => x.kind === 'serie');
    if (!c) return { achou: false };
    await fetchCollectionIndex(c);
    const st = collState[c.id];
    return {
      achou: true,
      nome: c.name,
      itens: collSongs(c.id).map((s) => s.name),
      urls: collSongs(c.id).map((s) => s.ytUrl),
      semPlayback: collSongs(c.id).every((s) => s.has_instrumental_music === false),
      assinatura: !!(st && st.serieAssinatura),
    };
  });
  checar(serie.achou, 'com shell 41 o card da SÉRIE existe na Biblioteca');
  checar(serie.nome === 'Provai e Vede 2026', 'e ele se chama "Provai e Vede 2026"', serie.nome);
  checar(serie.itens && serie.itens.length === 3,
    'as 2 playlists em português viram 3 episódios (a de Libras e a outra série ficam fora)',
    JSON.stringify(serie.itens));
  checar(!(serie.itens || []).some((n) => /libras/i.test(n)),
    'NENHUM episódio em Libras entrou — o par dobraria o álbum na projeção');
  checar((serie.itens || []).join(' | ')
      === '25/Jul · Chamado em Silêncio | 01/Ago · Match point | 08/Ago · Cada centavo conta',
    'a lista vem em ordem CRONOLÓGICA e rotulada pela data, que é como se procura o sábado',
    JSON.stringify(serie.itens));
  checar((serie.urls || []).join(',') === 'y/4,y/1,y/3',
    'cada episódio carrega a URL do vídeo — é ela que o download vai buscar', JSON.stringify(serie.urls));
  checar(serie.semPlayback,
    'nenhum episódio pede PLAYBACK: um vídeo não tem, e o álbum nunca ficaria completo');
  checar(serie.assinatura,
    'a assinatura das playlists é guardada — sem ela, toda retomada custa 12 extrações');

  // A ARMADILHA 1 pelo caminho de ponta a ponta: a playlist de agosto do stub
  // é "Provai e Vede Agosto 2026", SEM o hífen que todas as outras têm. Se a
  // regra exigisse o separador, os dois episódios de agosto sumiriam — e a
  // asserção de cima já reprovaria, mas sem dizer POR QUÊ.
  checar((serie.itens || []).filter((n) => /Ago/.test(n)).length === 2,
    'a playlist SEM hífen entrou: os dois episódios de agosto estão na lista',
    JSON.stringify(serie.itens));

  // ── A SEGUNDA SÉRIE (v5.244): o Informativo Mundial das Missões ─────────
  // Ela existe para provar que o catálogo é catálogo — e o que ela de fato
  // prova é que três suposições do Provai e Vede eram suposições: a playlist é
  // do TRIMESTRE, o título não traz nome de episódio, e o canal publica a mesma
  // série em quatro idiomas. A regra pura tem oráculo próprio
  // (`serie.test.mjs`); o que só pode ser afirmado AQUI é que as duas séries
  // convivem no mesmo provedor de coleção — cada uma indo ao SEU canal.
  const info = await pg.evaluate(async () => {
    const c = allCollections().find((x) => x.id === 'serie-informativo-missoes-2026');
    if (!c) return { achou: false };
    await fetchCollectionIndex(c);
    return {
      achou: true,
      nome: c.name,
      itens: collSongs(c.id).map((s) => s.name),
      urls: collSongs(c.id).map((s) => s.ytUrl),
      // As duas séries têm de ter índices INDEPENDENTES: um card sobrescrever o
      // outro no `collState` é o modo de falhar deste lote, e ele seria mudo.
      outra: collSongs('serie-provai-vede-2026').length,
    };
  });
  checar(info.achou, 'o card da SEGUNDA série existe na Biblioteca');
  checar(info.nome === 'Informativo Mundial das Missões 2026',
    'e ele se chama "Informativo Mundial das Missões 2026"', info.nome);
  // v5.271: o rótulo passou a levar a SÉRIE junto da data. Dentro do álbum isso
  // é repetição — e foi por isso que a v5.244 escolheu só a data —, mas o item
  // SAI do álbum: no Cronograma e nos Favoritos ele perde o cabeçalho que dizia
  // qual série é, e "15/Ago · YouTube" não identifica nada. O caso mede a ordem
  // (que não mudou) e a identificação (que é o pedido).
  checar((info.itens || []).slice(0, 3).join(' ~ ')
    === '07/Fev · Informativo Mundial das Missões ~ 04/Jul · Informativo Mundial das Missões'
      + ' ~ 15/Ago · Informativo Mundial das Missões',
    'os episódios vêm em ordem CRONOLÓGICA e cada um DIZ de que série é — a data '
    + 'ordena, a série identifica quando o item sai do álbum', JSON.stringify(info.itens));
  checar((info.itens || [])[3] === 'Informativo Mundial das Missões',
    'o que não declarou data ENTRA, com o nome da série e no fim do trimestre '
    + 'dele — nunca uma linha em branco', JSON.stringify(info.itens));
  checar((info.urls || []).join(',') === 'd/4,d/3,d/1,d/5',
    'cada um carrega a URL do vídeo, que é o que a transmissão vai buscar', JSON.stringify(info.urls));
  checar(!(info.urls || []).includes('d/2'),
    'O VÍDEO EM ESPANHOL NÃO ENTROU — ele estava DENTRO da playlist de português, '
    + 'com o mesmo prefixo no título, e iria ao telão sem nada que o denunciasse');
  checar(info.itens && info.itens.length === 4,
    'as 2 playlists em português dos 5 idiomas do canal viram 4 episódios', JSON.stringify(info.itens));
  checar(info.outra === 3,
    'e o índice da PRIMEIRA série continua de pé: os dois cards não se sobrescrevem', info.outra);

  // ── O REGISTRO DAS SÉRIES (v5.249) ─────────────────────────────────────
  // Pedido do operador: depois de verificar os dois grupos, registrar nomes,
  // achados e dados resultantes — para ele repassar e eu ajustar os filtros.
  //
  // É o único artefato deste recurso cujo consumidor não está no aparelho, e o
  // modo de falhar dele é o do `registro.test.mjs`: ele não quebra, ele
  // CONTINUA RESPONDENDO com uma frase errada — ou muda, que é pior, porque
  // "não achei nada no Registro" se lê como "não há nada de errado". Nenhum
  // teste carregava este texto até aqui.
  const reg = await pg.evaluate(async () => {
    await renderDiag();
    return diagTexto;
  });
  const temLinha = (re) => re.test(reg);
  checar(/Séries do YouTube \(o que a regra achou\)/.test(reg),
    'O REGISTRO GANHOU O BLOCO DAS SÉRIES');
  checar(/Provai e Vede 2026 — https:\/\/www\.youtube\.com\/@provaievedeoficial/.test(reg)
    && /Informativo Mundial das Missões 2026 — https:\/\/www\.youtube\.com\/@daniellocutor/.test(reg),
    'e ele fala dos DOIS grupos, cada um com o canal de onde veio');
  checar(/playlists por mês/.test(reg) && /playlists por trimestre/.test(reg),
    'com os PARÂMETROS de cada série (é neles que o ajuste é feito)');

  // As RECUSAS, com o nome VERBATIM e o motivo. É a metade que responde "por
  // que sumiu o mês de julho?", e sem ela a única pista seria uma lista curta.
  checar(temLinha(/- "Provai e Vede - Agosto 2026 \(Libras\)" → é a versão em Libras/),
    'cada playlist RECUSADA aparece com o nome verbatim e o motivo (Libras)');
  checar(temLinha(/- "Semana de Mordomia Cristã 2026" → não começa com "Provai e Vede"/),
    'e o motivo cita a série: "não começa com X" diz o que fazer, "prefixo" não');
  // AS OUTRAS LÍNGUAS DO @daniellocutor saem recusadas pelo PREFIXO, e não pelo
  // idioma — porque o prefixo é a primeira pergunta, e ela já as elimina. Isso
  // está afirmado de propósito: a ordem das perguntas é o que o Registro
  // mostra, e trocá-la mudaria o texto que eu leio a distância. Aqui ela está
  // certa (o NOME verbatim ao lado já diz "Misiones"), e o motivo por idioma
  // fica para quem passa do prefixo — o vídeo em espanhol, logo abaixo.
  checar(temLinha(/- "Misiones \| 3º Trimestre 2026" → não começa com "Informativo"/)
    && temLinha(/- "【聖工消息】2026 第三季 \(3 Quarter 26\)" → não começa com "Informativo"/),
    'as playlists dos outros idiomas aparecem com o NOME verbatim e o motivo (prefixo)');
  checar(temLinha(/\+ "Informativo \| 3º Trimestre 2026" → mês 7/),
    'e as ACEITAS mostram o mês em que o período começa — é o que ordena a lista');

  // O vídeo em espanhol: a recusa que o prefixo NÃO faz, e a que só o Registro
  // torna visível (ele some da lista sem deixar rastro em lugar nenhum).
  checar(temLinha(/- "Informativo Mundial de las Misiones \| 15 AGOSTO 2026" → está em outro idioma/),
    'O VÍDEO EM ESPANHOL aparece nomeado no registro, com o motivo');
  checar(temLinha(/! 1 entrou\(entraram\) SEM data no título:/)
    && temLinha(/"Informativo Mundial das Missões \| especial de encerramento"/),
    'e o episódio SEM DATA é nomeado como ACHADO — ele entrou, e é dele que sai o próximo ajuste');

  // Os nomes resultantes, que é a outra metade do pedido.
  checar(/nomes \(4\), na ordem em que a lista mostra:/.test(reg)
    && /nomes \(3\), na ordem em que a lista mostra:/.test(reg),
    'os NOMES resultantes entram, com a contagem e na ordem da lista');
  checar(/\n    04\/Jul · Informativo Mundial das Missões\n/.test(reg)
    && /\n    15\/Ago · Informativo Mundial das Missões\n/.test(reg),
    'um por linha: o rótulo tem " · " e o título cru tem " | ", então nenhum separador serviria');
  checar(/aba do canal \(há \d+ s\)/.test(reg) && /vídeos \(varredura há \d+ s\)/.test(reg),
    'as DUAS metades trazem a própria data — a assinatura pula a extração e só uma delas é de agora');
  checar(!/undefined|NaN|\[object Object\]/.test(reg),
    'e nada de "undefined" no meio de um log que vai ser repassado');

  // ── O RECORTE POR ANO (v5.252) ─────────────────────────────────────────
  // O primeiro registro de verdade veio com 94 e 145 playlists: os canais
  // publicam há anos, e o arquivo enterrava as aceitas sob oitenta linhas
  // dizendo "não é de 2026". As duas metades são inseparáveis — o que some é
  // só o que traz OUTRO ano no nome, e um mês do ano corrente renomeado (o
  // defeito que este bloco existe para achar) continua aparecendo.
  checar(!/"Provai e Vede - Dezembro 2025"/.test(reg)
    && !/"Provai e Vede - Novembro 2025 \(Libras\)"/.test(reg),
    'as playlists de OUTROS ANOS saem da lista — elas não mudam e não decidem nada');
  checar(/\(mais 2 de outros anos: /.test(reg),
    'mas são CONTADAS, por motivo: nenhum corte silencioso', (reg.match(/\(mais [^\n]*/) || [])[0]);
  checar(temLinha(/- "Semana de Mordomia Cristã 2026" → não começa com "Provai e Vede"/),
    'e o que é do ANO CORRENTE fica, mesmo recusado — é ali que uma renomeação apareceria');

  // ── O QUE O CANAL ANUNCIA E A EXTRAÇÃO NÃO TRAZ (v5.252) ───────────────
  // No registro real: 39 anunciados × 38 vistos numa série, 51 × 50 na outra.
  // Nada erra, nada recusa — o vídeo não vem, e o sábado dele não existe na
  // lista. É o achado mais silencioso deste caminho, e a soma das contagens da
  // aba do canal é a única referência externa que ele tem.
  checar(/de \d+ anunciados pelo canal/.test(reg),
    'a linha dos vídeos compara o que veio com o que o canal ANUNCIA',
    (reg.match(/vídeos \(varredura[^\n]*/) || [])[0]);
  checar(temLinha(/! \d+ vídeo\(s\) que o canal conta e a extração NÃO trouxe/),
    'e a diferença vira uma linha própria, não uma conta para quem lê fazer');

  // ── O QUE AINDA NÃO SAIU NÃO CHEGA À LISTA (v5.255) ────────────────────
  // Relato do operador: o canal sobe o trimestre inteiro e libera um sábado por
  // vez; os que faltam ficam como "prioridade para membros" — aparecem na
  // playlist e não tocam. A REGRA tem oráculo próprio (`serie.test.mjs`, com
  // datas fixas); o que só pode ser afirmado AQUI é que ela está LIGADA ao
  // provedor de coleção, isto é, que o `fetchSerieIndex` de fato passa o dia.
  //
  // Página à parte, com RELÓGIO FIXO: sem isso a asserção mudaria de resposta
  // conforme o dia em que rodasse — e um teste que muda sozinho é o que ensina
  // a ignorar vermelho (v5.204). O clock fica preso a esta página para não
  // contaminar nada do que já foi medido acima.
  const corte = await (async () => {
    const pgC = await ctx.newPage();
    try {
      // ANTES do sábado de 15/Ago, que é um episódio que o stub JÁ tem — assim
      // o caso não precisa de um episódio futuro no stub, que ficaria no
      // passado com o tempo e mudaria as asserções da página principal.
      await pgC.clock.install({ time: new Date('2026-07-10T12:00:00') });
      await pgC.addInitScript(PONTE);
      await pgC.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
      await pgC.waitForFunction(() => !!window.__avBack, null, { timeout: 25000 });
      // `limpar` só na PRIMEIRA leitura. A segunda roda com o índice de ontem
      // guardado, que é o caminho da ECONOMIA (a assinatura das playlists) — e é
      // ali que o defeito moraria: o canal não muda de um dia para o outro,
      // então sem o DIA dentro da assinatura a economia devolveria a lista de
      // ontem, sem o episódio de hoje, e carimbaria que ela é de hoje. É o
      // sintoma da v5.233 por outra porta, e apagar o índice aqui esconderia
      // exatamente isso.
      const ler = async (limpar) => pgC.evaluate(async (zerar) => {
        const c = allCollections().find((x) => x.id === 'serie-informativo-missoes-2026');
        if (zerar) delete collState[c.id];
        await fetchCollectionIndex(c);
        const d = await AVDB.getState('serieDiag:' + c.id);
        return { itens: collSongs(c.id).map((s) => s.name), futuros: (d && d.futuros || []).length };
      }, limpar);
      const antes = await ler(true);
      // A TERÇA e a QUARTA antes do sábado 15 — a fronteira que o operador
      // pediu, medida no percurso inteiro e não só na regra pura.
      await pgC.clock.setFixedTime(new Date('2026-08-11T12:00:00'));
      const naTerca = await ler(false);
      await pgC.clock.setFixedTime(new Date('2026-08-12T12:00:00'));
      const naQuarta = await ler(false);
      // O PRÓPRIO SÁBADO do episódio: ele passa a existir, sozinho e sem toque
      // nenhum. É o corte INCLUSIVO, que é o que o operador descreveu.
      await pgC.clock.setFixedTime(new Date('2026-08-15T12:00:00'));
      const noDia = await ler(false);
      // SÓ A DATA entra na comparação (v5.271): estes casos falam da JANELA, e
      // comparar o nome inteiro os faria reprovar a cada ajuste de nomenclatura
      // — foi o que aconteceu quando o rótulo passou a levar a série junto.
      const soData = (o) => Object.assign({}, o,
        { itens: (o.itens || []).map((n) => String(n).split(' · ')[0]) });
      return { antes: soData(antes), naTerca: soData(naTerca),
        naQuarta: soData(naQuarta), noDia: soData(noDia) };
    } finally { await pgC.close(); }
  })();
  checar(!(corte.antes.itens || []).includes('15/Ago'),
    'EM 10/JUL o episódio de 15/Ago NÃO chega à lista — ele ainda não foi liberado',
    JSON.stringify(corte.antes.itens));
  checar((corte.antes.itens || []).includes('04/Jul'),
    'e os que já saíram continuam lá — o corte é uma data, não um apagador',
    JSON.stringify(corte.antes.itens));
  checar(corte.antes.futuros > 0,
    'o diário CONTA os que ficaram de fora, para o Registro poder dizê-lo', corte.antes.futuros);
  checar((corte.noDia.itens || []).includes('15/Ago'),
    'E NO PRÓPRIO SÁBADO ele aparece sozinho: o corte é inclusive no dia do culto',
    JSON.stringify(corte.noDia.itens));
  checar((corte.naQuarta.itens || []).includes('15/Ago'),
    'E JÁ NA QUARTA ANTES DELE, que é quando o roteiro do culto é montado',
    JSON.stringify(corte.naQuarta.itens));
  checar(!(corte.naTerca.itens || []).includes('15/Ago'),
    'mas não na TERÇA: a janela é de 3 dias, não "o mês todo"',
    JSON.stringify(corte.naTerca.itens));

  // ── O AVISO QUANDO O DOWNLOAD FALHA NA JANELA (v5.256) ─────────────────
  // O preço da antecedência: nesses três dias o vídeo pode ainda não estar
  // público, e o download não vem. Sem uma frase, essa falha é indistinguível
  // de uma queda de rede — o operador tenta de novo, falha de novo, e conclui
  // que o app quebrou justamente no item que ele acabou de ver aparecer.
  const aviso = await pg.evaluate(() => {
    const c = allCollections().find((x) => x.id === 'serie-informativo-missoes-2026');
    const songs = collSongs(c.id);
    // O de HOJE (uma data que já passou no relógio real deste runner) e um
    // FUTURO montado à mão: é o par que prova que a frase é da janela, e não
    // um recado grudado em toda falha de série.
    const passado = Object.assign({}, songs[0], { serieData: { dia: 1, mes: 1 } });
    const futuro = Object.assign({}, songs[0], { serieData: { dia: 31, mes: 12 } });
    return {
      comFuturo: serieComoYoutube(c, futuro),
      comPassado: serieComoYoutube(c, passado),
      semData: serieComoYoutube(c, Object.assign({}, songs[0], { serieData: null })),
    };
  });
  checar(/ainda não liberado pelo canal/.test(aviso.comFuturo.avisoSeFalhar || ''),
    'um episódio da JANELA carrega a frase que explica a falha', aviso.comFuturo.avisoSeFalhar);
  checar(/31\/Dez/.test(aviso.comFuturo.avisoSeFalhar || ''),
    'e ela diz ATÉ QUANDO esperar, com a data do episódio', aviso.comFuturo.avisoSeFalhar);
  checar(aviso.comFuturo.avisoOnde === 'serie-informativo-missoes-2026',
    'com o card da série como endereço: mandando ao Cronograma, a Biblioteca fica aberta por cima da preview');
  checar(!aviso.comPassado.avisoSeFalhar && !aviso.semData.avisoSeFalhar,
    'e um episódio que JÁ SAIU não a carrega — ali a falha é falha, e a frase seria uma desculpa falsa');

  // O DIÁRIO É O QUE VENCE O ÍNDICE (v5.249). Um aparelho que já tinha a lista
  // antes desta versão a tem "fresca" pelo TTL de 12 h — e passaria essas 12 h
  // com o bloco dizendo "ainda não varrido" justamente enquanto o operador o
  // procura, porque foi a atualização que o fez olhar. As duas metades: sem
  // carimbo a série entra na varredura, e COM carimbo ela para de entrar (senão
  // seriam extrações do YouTube a cada abertura, para sempre).
  const venc = await pg.evaluate(() => {
    // `indiceVencido` é a MESMA função que o `autoRefreshCollections` chama —
    // reescrevê-la aqui provaria só que o teste concorda consigo mesmo.
    const c = allCollections().find((x) => x.kind === 'serie');
    const st = collState[c.id];
    const agora = Date.now();
    st.indexSyncedAt = agora;               // fresco pelo TTL, que é o caso do relato
    const comCarimbo = !!st.serieDiarioEm && !indiceVencido(c, agora);
    delete st.serieDiarioEm;                // como o índice de quem já tinha a lista
    const semCarimbo = indiceVencido(c, agora);
    st.serieDiarioEm = agora;
    return { comCarimbo, semCarimbo, deNovo: indiceVencido(c, agora) };
  });
  checar(venc.comCarimbo, 'a varredura carimba o índice como "já registrado"');
  checar(venc.semCarimbo,
    'um índice ANTERIOR ao diário conta como vencido — senão o bloco ficaria 12 h mudo');
  checar(!venc.deNovo,
    'e com o carimbo ele para de vencer: nada de extrair o canal a cada abertura');

  // ── O CARD, DESENHADO (v5.229) ─────────────────────────────────────────
  // O relato do operador: "não estou achando nada para acessar esse provai e
  // vede". A v5.228 acrescentou a série ao `allCollections()`, que alimenta as
  // CONTAS — e a lista é desenhada em três grupos (fixas, categorias de álbum,
  // álbuns órfãos), nenhum dos quais a alcançava. O card era construído,
  // entrava no `byId`, contava no peso, e **não aparecia em lugar nenhum**.
  //
  // Todas as asserções acima passavam com esse defeito no lugar: elas mediam o
  // ÍNDICE, e o que faltava era o DESENHO. É por isso que este bloco pergunta
  // ao DOM, e não a uma função.
  const naTela = await pg.evaluate(() => {
    const lista = document.getElementById('hymnResults');
    // OS GRUPOS NASCEM FECHADOS (v5.237): o índice é a primeira tela, e o card
    // de qualquer coleção só é CONSTRUÍDO quando o grupo dele abre. Este caso
    // fala do card, então ele abre o grupo primeiro — e o passo é, ele próprio,
    // a afirmação de que o grupo existe com esse nome.
    //
    // UMA PASSADA POR GRUPO desde a v5.273: só uma seção fica aberta por vez,
    // e este caso precisa dos cards de DUAS. Os NOMES dos grupos (e a ordem
    // deles) valem em qualquer passada — a barra é desenhada aberta ou fechada.
    const grupoDoCard = (re) => {
      const card = [...lista.querySelectorAll('.hymnal-card')]
        .find((el) => re.test(el.textContent));
      const g = card && card.closest('.coll-group');
      return g ? (g.querySelector('.coll-group-name') || {}).textContent.trim() : '';
    };
    const guardado = grupoAberto;
    // `renderCollectionsList` ACRESCENTA à lista (a lição da v5.232): sem
    // limpar entre as passadas, a segunda mediria os cards da primeira.
    grupoAberto = 'Arquivos oficiais';
    lista.innerHTML = '';
    renderCollectionsList(lista, () => {}, { semTotal: true });
    const grupos = [...lista.querySelectorAll('.coll-group-name')].map((e) => e.textContent.trim());
    const linhas = [...lista.children].map((li) => (li.className.includes('coll-group')
      ? 'GRUPO: ' + li.textContent.trim().split('\n')[0]
      : 'card: ' + li.textContent.trim().split('\n')[0]));
    const texto = lista.textContent;
    // O grupo em que cada card de fato vive. É a pergunta inteira da v5.260: a
    // separação não é um cabeçalho a mais, é o card mudar de casa.
    const grupoDaSerie = grupoDoCard(/Provai e Vede 2026/);
    const grupoDoInformativo = grupoDoCard(/Informativo Mundial das Missões 2026/);
    grupoAberto = 'Hinários';
    lista.innerHTML = '';
    renderCollectionsList(lista, () => {}, { semTotal: true });
    const grupoDoHinario = grupoDoCard(/Hinário/);
    grupoAberto = guardado;
    return {
      texto, grupos, grupoDaSerie, grupoDoInformativo, grupoDoHinario,
      posSerie: linhas.findIndex((l) => l.includes('Provai e Vede 2026')),
    };
  });
  checar(/Provai e Vede 2026/.test(naTela.texto),
    'O CARD DA SÉRIE APARECE NA BIBLIOTECA — era este o "não estou achando nada"');
  // ── A SEPARAÇÃO DOS DOIS GRUPOS FIXOS (v5.260) ─────────────────────────
  // Pedido do operador: "faça uma separação de coletânea entre os hinários e os
  // Arquivos oficiais (que incluem o provai e vede e informativo mundial das
  // missões)". As três asserções são a mesma pergunta por três lados, e nenhuma
  // basta sozinha: um cabeçalho novo com os cards no lugar antigo passaria na
  // primeira, e mover os cards sem separar os hinários passaria na segunda.
  checar(naTela.grupoDaSerie === 'Arquivos oficiais'
    && naTela.grupoDoInformativo === 'Arquivos oficiais',
    'AS DUAS SÉRIES vivem no grupo "Arquivos oficiais"',
    naTela.grupoDaSerie + ' / ' + naTela.grupoDoInformativo);
  checar(naTela.grupoDoHinario === 'Hinários',
    'e o hinário fica no grupo "Hinários", sozinho', naTela.grupoDoHinario);
  // A ORDEM INVERTEU na v5.262 (pedido do operador: "os arquivos oficiais ficam
  // antes dos hinários"). Ela é medida, e não só o pertencimento: os dois grupos
  // são construídos por chamadas separadas — a dos oficiais pode nem acontecer
  // (shell < 41) —, então "quem vem primeiro" é uma decisão que só existe na
  // ordem das duas linhas e some se alguém as reordenar sem querer.
  checar(naTela.grupos[0] === 'Favoritos' && naTela.grupos[1] === 'Arquivos oficiais'
    && naTela.grupos[2] === 'Hinários',
    'nesta ordem — Favoritos, os OFICIAIS e depois os hinários —, antes de qualquer álbum',
    JSON.stringify(naTela.grupos));

  // ── O ÍNDICE NÃO PODE FICAR PRESO NUMA REGRA VELHA (v5.233) ────────────
  // Relato do operador, depois da v5.230: *"tentei limpar o cache e recarregar,
  // mas a listagem ainda mantém o item do provai e vede que não identificava o
  // 3 de janeiro"*. O índice guarda os nomes JÁ FORMADOS, e a assinatura que
  // pula a atualização fala só do que o CANAL publicou — mudar a regra não
  // mudava a assinatura, e o nome errado ficava para sempre (o índice mora no
  // IndexedDB, que limpar o cache não toca).
  //
  // As DUAS metades, e são inseparáveis: a regra nova refaz o índice, e o que
  // não mudou continua sem custar extração nenhuma. Sem a segunda, "refazer
  // sempre" passaria — e seriam doze idas ao YouTube por retomada do app.
  const preso = await pg.evaluate(async () => {
    const c = allCollections().find((x) => x.kind === 'serie');
    const st = collState[c.id];
    const antes = window.__nPlaylist || 0;
    // COMO O APARELHO DO OPERADOR ESTAVA, e a fidelidade aqui é o teste
    // inteiro: a assinatura guardada é a que a versão ANTERIOR escrevia —
    // só o canal, sem impressão nenhuma da regra —, e o canal não mudou uma
    // vírgula desde então. Escrever aqui uma assinatura inventada ("rVELHA…")
    // faria o caso passar nas DUAS versões, porque qualquer lixo difere do que
    // o código calcula: seria uma medição que não discrimina, e foi a primeira
    // versão deste caso.
    st.serieAssinatura = st.serieAssinatura.replace(/^r[0-9a-z]+\|/, '');
    st.songs[0].name = 'NOME DA REGRA VELHA';
    await AVDB.setState('coll:' + c.id, st);
    await syncCollection(c, { soIndice: true });
    const refeito = window.__nPlaylist || 0;
    const nomeDepois = collSongs(c.id)[0].name;
    // E agora, com tudo em dia: a economia tem de continuar de pé.
    //
    // A PAUSA ANTES DA LINHA DE BASE não é cerimônia: o `autoRefreshCollections`
    // da abertura roda SEM `await` e pode ter uma extração em voo, que cairia no
    // intervalo medido e seria lida como "a economia não valeu" — reprovado uma
    // vez em ~11 execuções, sem nenhuma relação com o que o caso afirma. Com o
    // laço assentado, o contador de partida é o de um sistema parado. E a
    // asserção continua discriminando: uma economia quebrada custaria a dúzia
    // de playlists da série, não uma unidade.
    await new Promise((r) => setTimeout(r, 400));
    const base = window.__nPlaylist || 0;
    await syncCollection(c, { soIndice: true });
    return { antes, refeito, base, deNovo: window.__nPlaylist || 0, nomeDepois };
  });
  checar(preso.refeito > preso.antes && !/REGRA VELHA/.test(preso.nomeDepois),
    'a regra nova REFAZ o índice guardado — era isto que deixava o episódio sem '
    + 'data e fora de ordem ("' + preso.nomeDepois + '")');
  checar(preso.deNovo === preso.base,
    'e com a regra e o canal em dia nada é reextraído: a economia continua de pé',
    preso.base + ' → ' + preso.deNovo);

  // ── O EPISÓDIO É UM VÍDEO DO YOUTUBE (v5.230) ──────────────────────────
  // Pedido do operador: as opções de um item da série devem ser as do YouTube
  // (sem "só áudio"), sem download direto, e com transmissão no "Tocar agora".
  // A v5.228 o tratava como faixa de hinário — o toque BAIXAVA ~300 MB.
  //
  // E DESDE A v5.285 ELA NÃO É MAIS UMA FOLHA: as opções abrem no CORPO da
  // linha. O caso passou a percorrer o caminho de verdade — desenhar a lista,
  // tocar na faixa, ler a gaveta — em vez de chamar a função do menu à mão: é a
  // única forma de continuar provando que um episódio recebe as opções do
  // YouTube, agora que quem decide isso é `montarOpcoes`.
  const folha = await pg.evaluate(async () => {
    const c = allCollections().find((x) => x.kind === 'serie');
    const s = collSongs(c.id)[0];
    // O modo é GLOBAL: deixá-lo trocado quebra os casos seguintes (o do Modo
    // Fácil mede a cortina). Restaurado no fim, como os outros casos fazem.
    const modoAntes = appMode;
    setAppMode('full');
    ui(c.id).expanded = true; ui(c.id).shown = 100;
    const lista = document.createElement('ul');
    lista.className = 'hymnal-list';
    lista.style.width = '390px';
    document.body.appendChild(lista);
    const li = hymnResultRow(c, s, null, true);
    lista.appendChild(li);
    li.querySelector('.row').click();
    await new Promise((r) => setTimeout(r, 400));
    const op = li.querySelector('.hymn-opcoes');
    const linhas = [...op.querySelectorAll('.song-menu-btn')]
      .map((b) => b.textContent.trim().split('\n')[0].trim()).filter(Boolean);
    const r = {
      aberta: li.classList.contains('expanded') && !!op && op.children.length > 0,
      naFolha: document.getElementById('songMenuPopup').classList.contains('open'),
      texto: op.textContent,
      linhas,
    };
    lista.remove(); ui(c.id).expanded = false; songMenuFor = null;
    setAppMode(modoAntes);
    return r;
  });
  checar(folha.aberta && !folha.naFolha,
    'tocar num episódio abre as opções NO CORPO da linha, não numa folha (v5.285)',
    JSON.stringify({ gaveta: folha.aberta, folha: folha.naFolha }));
  checar(/Tocar agora/.test(folha.texto),
    'com "Tocar agora" — é ele que TRANSMITE, sem esperar o download', JSON.stringify(folha.linhas));
  checar(/playlist/i.test(folha.texto) && /Cronograma/.test(folha.texto) && /Favoritar/.test(folha.texto),
    'e os três destinos que GUARDAM, como num vídeo do YouTube', JSON.stringify(folha.linhas));
  checar(!/Só áudio/.test(folha.texto),
    'e SEM o seletor de só-áudio — um testemunho em vídeo não tem versão de áudio',
    JSON.stringify(folha.linhas));
  checar(!/Cantada|Playback/.test(folha.texto),
    'nem o seletor Cantada/Playback do acervo — a folha é a do YouTube, não a das músicas');

  // O download EM LOTE não pode existir para a série: são ~52 vídeos.
  const semLote = await pg.evaluate(() => {
    const lista = document.getElementById('hymnResults');
    const guardado = grupoAberto;
    grupoAberto = 'Arquivos oficiais';  // fechado desde a v5.237, e um por vez desde a v5.273
    renderCollectionsList(lista, () => {}, { semTotal: true });
    const cards = [...lista.querySelectorAll('.hymnal-card')];
    const card = cards.find((el) => /Provai e Vede 2026/.test(el.textContent));
    const r = {
      achou: !!card,
      temBotaoBaixar: !!(card && card.querySelector('.coll-bar-dl')),
    };
    grupoAberto = guardado;
    return r;
  });
  checar(semLote.achou, 'o card da série está na lista para ser medido');
  checar(!semLote.temBotaoBaixar,
    'e ele NÃO tem o botão de baixar a coleção — "não quero um download direto"');

  // ── A GAVETA DA LINHA É DO TIPO DO ITEM (v5.236) ───────────────────────
  // Relato do operador: *"o toque nele na lista abre ainda a opção de ver a
  // letra, mas ele não tem letra por não ser uma música"*.
  //
  // A v5.230 desviou as duas FOLHAS de um episódio para o caminho do YouTube e
  // parou aí — o toque na LINHA continuou abrindo a caixa da letra, que
  // anunciava "Letra ainda não baixada" para algo que nunca vai ter letra. É o
  // defeito da v5.229 outra vez: desviar as portas não desvia o que estava
  // atrás delas.
  //
  // As DUAS metades, e são inseparáveis: o vídeo deixa de prometer letra **e** a
  // música continua tendo a dela. Sem a segunda, apagar a gaveta inteira
  // passaria — a mesma cobrança de duas metades do `registro.test.mjs`.
  const gaveta = await pg.evaluate(async () => {
    // O MODO AVANÇADO, e ele é pré-requisito da medição inteira: no Modo Fácil
    // o toque na linha TOCA (não abre gaveta nenhuma), então o caso mediria um
    // container vazio e concluiria o que quisesse. A primeira versão deste caso
    // rodou assim e reprovou por isso — a lição da v5.208 numa terceira roupa.
    const modoAntes = document.body.classList.contains('mode-simple') ? 'simple' : 'full';
    setAppMode('full');
    const c = allCollections().find((x) => x.kind === 'serie');
    // O EPISÓDIO QUE TEM MINIATURA. A ordem do álbum é cronológica, e o
    // primeiro item é o de julho, que no harness não tem `thumb` — medir nele
    // reprovaria uma gaveta que está certa.
    const s = collSongs(c.id).find((x) => x.id_music === 'aaaaaaaaaa1');
    // Uma lista PRÓPRIA e VISÍVEL: o `#hymnResults` mora dentro do popup de
    // busca, que está fechado, e num elemento escondido a classe `expanded`
    // desenha o mesmo mas toda medida é zero (a lição da v5.208). Aqui não se
    // medem pixels, mas o `.item-detalhe` só existe no DOM com o `display`
    // resolvido — e é ele que a asserção procura.
    const lista = document.createElement('ul');
    lista.className = 'hymnal-list';
    document.body.appendChild(lista);
    const li = hymnResultRow(c, s, null, true);
    lista.appendChild(li);
    li.querySelector('.hymn-row').click();
    // A montagem é assíncrona (o estado no aparelho vem do IndexedDB): dois
    // turnos bastam, e esperar pelo TEXTO em vez de por um prazo fixo é o que
    // impede o caso de virar intermitente num runner lento.
    for (let i = 0; i < 40 && !li.querySelector('.item-detalhe-estado'); i++) {
      await new Promise((r) => setTimeout(r, 25));
    }
    const det = li.querySelector('.item-detalhe');
    const r = {
      temDetalhe: !!det,
      temCaixaDeLetra: !!li.querySelector('.hymn-lyrics'),
      texto: li.textContent,
      temThumb: !!li.querySelector('.item-detalhe-thumb'),
      duracaoGuardada: s.duration || '',
    };
    lista.remove();
    setAppMode(modoAntes);   // o modo é global: deixá-lo trocado quebra os casos seguintes
    return r;
  });
  checar(gaveta.temDetalhe,
    'o toque num EPISÓDIO abre a gaveta de detalhe do vídeo');
  checar(!gaveta.temCaixaDeLetra && !/[Ll]etra/.test(gaveta.texto),
    'e ela NÃO promete letra nenhuma — nem a caixa, nem a palavra',
    JSON.stringify(gaveta.texto.slice(0, 120)));
  checar(gaveta.temThumb,
    'a MINIATURA está lá: num vídeo é ela que responde "é este mesmo?", que é o '
    + 'que a letra responde num hino');
  checar(gaveta.duracaoGuardada && gaveta.texto.includes(gaveta.duracaoGuardada),
    'e a duração também — os dois campos que o extrator entregava e o índice '
    + 'descartava', JSON.stringify(gaveta.duracaoGuardada));
  checar(/Toca sem baixar|Já no aparelho/.test(gaveta.texto),
    'mais o estado no aparelho, que é o que decide: transmitir agora ou ~300 MB',
    JSON.stringify(gaveta.texto.slice(0, 120)));

  // A OUTRA METADE: uma MÚSICA continua abrindo a letra. Sem coleção do
  // LouvorJA neste harness (não há rede), a faixa e a letra são postas à mão —
  // o que se afirma é o desvio de `hymnResultRow`, não o banco de origem.
  const gavetaMusica = await pg.evaluate(async () => {
    const modoAntes = document.body.classList.contains('mode-simple') ? 'simple' : 'full';
    setAppMode('full');
    const c = allCollections().find((x) => x.kind === 'hymnal');
    const estadoAntes = collState[c.id];
    const s = { id_music: 'zz1', name: 'Hino de teste', track: 1, has_instrumental_music: false };
    collState[c.id] = { indexSyncedAt: Date.now(), songs: [s], isHymnal: true };
    lyricStoreFor(c.id)[s.id_music] = [{ a: 'Refrão', l: ['a primeira linha', 'a segunda linha'] }];
    const lista = document.createElement('ul');
    lista.className = 'hymnal-list';
    document.body.appendChild(lista);
    const li = hymnResultRow(c, s, null, true);
    lista.appendChild(li);
    li.querySelector('.hymn-row').click();
    for (let i = 0; i < 40 && !li.querySelector('.hymn-lyrics-line'); i++) {
      await new Promise((r) => setTimeout(r, 25));
    }
    const r = {
      temCaixaDeLetra: !!li.querySelector('.hymn-lyrics'),
      temDetalhe: !!li.querySelector('.item-detalhe'),
      linhas: [...li.querySelectorAll('.hymn-lyrics-line')].map((e) => e.textContent),
    };
    lista.remove();
    setAppMode(modoAntes);
    // E O ACERVO VOLTA COMO ESTAVA: a faixa de mentira existe para UMA medição,
    // e deixá-la no `collState` faria os casos seguintes medirem um hinário que
    // este harness não tem.
    if (estadoAntes) collState[c.id] = estadoAntes; else delete collState[c.id];
    return r;
  });
  checar(gavetaMusica.temCaixaDeLetra && gavetaMusica.linhas.length === 2,
    'e o toque numa MÚSICA continua abrindo a LETRA, com as estrofes',
    JSON.stringify(gavetaMusica.linhas));
  checar(!gavetaMusica.temDetalhe,
    'sem a gaveta do vídeo no meio — cada tipo abre a sua, e só a sua');

  // ── A BIBLIOTECA ABRE COMO ÍNDICE (v5.237) ─────────────────────────────
  // Pedido do operador: *"tornar os agrupamentos de coleções… todas as
  // coleções, em colapsados, assim a listagem das seções fica mais curta e a
  // navegação se torna mais ramificada"* e *"coloque os favoritos dentro da
  // biblioteca… no topo da listagem"*.
  //
  // As DUAS metades, e são inseparáveis: fechado NÃO CONSTRÓI card nenhum (senão
  // "colapsado" seria só um `display: none`, e a tela continuaria pagando o DOM
  // de dezenas de álbuns a cada redesenho) **e** o toque no cabeçalho abre.
  const indice = await pg.evaluate(async () => {
    // O ESTADO PADRÃO, VERBATIM. Ele não é montado aqui de propósito: o que se
    // afirma é o que o app trouxe da carga do módulo — os Favoritos abertos e
    // NENHUMA coleção. Escrevê-lo aqui mediria a suposição do teste, não a
    // decisão do app; e esta leitura ainda serve de guarda de que os casos
    // acima devolveram o que tomaram emprestado.
    const padrao = { fav: favAberto, colecao: grupoAberto };
    const lista = document.createElement('ul');
    lista.className = 'hymnal-list';
    lista.style.width = '390px';
    document.body.appendChild(lista);
    const desenhar = () => {
      lista.innerHTML = '';
      renderCollectionsList(lista, desenhar, { semTotal: true });
    };
    desenhar();
    const grupos = [...lista.querySelectorAll('.coll-group-name')].map((e) => e.textContent.trim());
    // A SEÇÃO DOS FAVORITOS: aberta por padrão, e COLAPSÁVEL como as outras.
    const acharFav = () => [...lista.querySelectorAll('.coll-group')]
      .find((g) => /Favoritos/.test((g.querySelector('.coll-group-name') || {}).textContent || ''));
    const gFav = acharFav();
    const corpoFav = gFav && gFav.querySelector('.coll-group-corpo');
    const fav = {
      padrao,
      // A MESMA seta das outras seções, no mesmo lugar (a thumb da barra).
      temSeta: !!(gFav && gFav.querySelector('.coll-group-bar > button.coll-group-icon')),
      corpoVisivel: !!(corpoFav && corpoFav.getBoundingClientRect().height > 0),
    };
    // ELA RESPONDE AO PRÓPRIO TOQUE, e só a ele (v5.276). A v5.273 a tinha feito
    // um no-op — ela era o piso do rodízio, e fechá-la deixaria a tela sem
    // nenhuma seção aberta. Fora do rodízio, o gesto volta a ser o de qualquer
    // outra: fecha e reabre. A espera é generosa de propósito — o recolhimento é
    // animado (`collapseAccordion`), e ler cedo aprovaria uma seção que fecha
    // meio segundo depois.
    const tocarFav = async () => {
      const seta = (acharFav() || {}).querySelector
        && acharFav().querySelector('.coll-group-bar > button.coll-group-icon');
      if (seta) seta.click();
      await new Promise((r) => setTimeout(r, 400));
    };
    await tocarFav();
    fav.fechaNoProprioToque = !!acharFav()
      && !acharFav().classList.contains('aberto') && favAberto === false;
    await tocarFav();
    fav.reabre = !!acharFav() && acharFav().classList.contains('aberto') && favAberto === true;
    // Daqui para baixo o caso é o do ÍNDICE, que fala dos grupos de coleção. A
    // referência de "fechado" é a tela como ela ABRE: os Favoritos (que não têm
    // card nenhum) e todas as coleções recolhidas.
    desenhar();
    const fechado = {
      grupos,
      cards: lista.querySelectorAll('.hymnal-card').length,
      // A altura do índice inteiro contra a de um grupo aberto: é ela que o
      // pedido chama de "listagem mais curta", e medir o número de nós não
      // diria a mesma coisa.
      altura: lista.getBoundingClientRect().height,
    };
    // O TOQUE no cabeçalho dos Arquivos oficiais. Ele responde a pergunta da
    // v5.237 ("fechado não constrói card, o toque constrói") e, desde a v5.276,
    // a que a substituiu: abrir uma coleção **não** mexe nos Favoritos.
    const tocar = async (re) => {
      const barra = [...lista.querySelectorAll('.coll-group-bar')]
        .find((b) => re.test(b.textContent.trim()));
      if (barra) barra.click();
      await new Promise((r) => setTimeout(r, 400));
    };
    await tocar(/^Arquivos oficiais/);
    const aberto = {
      cards: lista.querySelectorAll('.hymnal-card').length,
      temSerie: /Provai e Vede 2026/.test(lista.textContent),
      altura: lista.getBoundingClientRect().height,
      // O card vive DENTRO do corpo do grupo, não solto na lista: é isso que
      // faz a árvore ser uma árvore.
      dentroDoCorpo: !!lista.querySelector('.coll-group-corpo .hymnal-card'),
      // OS FAVORITOS CONTINUAM ABERTOS (v5.276): eles não estão no rodízio.
      favSegue: !!(acharFav() && acharFav().classList.contains('aberto')),
      abertas: lista.querySelectorAll('.coll-group--drop.aberto').length,
    };
    // E O RODÍZIO VALE ENTRE AS COLEÇÕES: abrir os Hinários fecha os Oficiais,
    // sem tocar nos Favoritos.
    await tocar(/^Hinários/);
    const trocou = {
      abertas: lista.querySelectorAll('.coll-group--drop.aberto').length,
      colecao: grupoAberto,
      favSegue: !!(acharFav() && acharFav().classList.contains('aberto')),
    };
    // E FECHAR A COLEÇÃO ABERTA deixa a tela sem nenhuma — que deixou de ser um
    // estado a evitar: quem fechou o hinário está olhando os favoritos.
    await tocar(/^Hinários/);
    fav.semColecao = grupoAberto === '' && !!acharFav()
      && acharFav().classList.contains('aberto');
    lista.remove();
    // Devolve o estado PADRÃO do app: os casos abaixo desenham a Biblioteca de
    // verdade, e deixá-la noutra seção seria emprestar a este arquivo um
    // comportamento que o app não tem.
    grupoAberto = ''; favAberto = true;
    return { fechado, aberto, trocou, fav };
  });
  checar(indice.fechado.grupos.length >= 2 && indice.fechado.cards === 0,
    'A BIBLIOTECA ABRE COMO ÍNDICE: só os cabeçalhos de seção, nenhum card '
    + 'construído', JSON.stringify(indice.fechado.grupos));
  checar(indice.fechado.grupos[0] === 'Favoritos',
    'e o primeiro deles é FAVORITOS, no topo da listagem',
    JSON.stringify(indice.fechado.grupos));
  // ── AS COLEÇÕES FAZEM RODÍZIO; OS FAVORITOS, NÃO (v5.262 → v5.273 → v5.276) ─
  // Pedido do operador: *"agora não mais são concorrentes com os favoritos… o
  // tamanho da seção de favoritos segue sendo o tamanho que sobra… e ela segue
  // sendo a seção aberta de nascença, mas agora ela não se fecha quando outro
  // se abre; as coleções são concorrentes entre si, mas não com os favoritos"*.
  //
  // São CINCO metades, e nenhuma basta sozinha: o padrão (senão a seção
  // nasceria fechada como qualquer outra), o toque nela própria que a fecha E
  // reabre (senão "colapsável" seria mão única), abrir uma coleção que NÃO a
  // toca, o rodízio valendo entre coleções, e fechar a coleção aberta deixando
  // a tela sem nenhuma — que a v5.273 proibia e agora é o estado normal.
  checar(indice.fav.padrao.fav === true && indice.fav.padrao.colecao === '',
    'o PADRÃO do app são os Favoritos abertos e NENHUMA coleção',
    JSON.stringify(indice.fav.padrao));
  checar(indice.fav.corpoVisivel,
    'e é assim que a Biblioteca abre — os favoritos à vista, o resto fechado');
  checar(indice.fav.temSeta,
    'ela tem a MESMA seta das outras seções, na thumb da barra');
  checar(indice.fav.fechaNoProprioToque && indice.fav.reabre,
    'o toque NELA a recolhe — e reabre, senão "colapsável" seria mão única');
  checar(indice.aberto.favSegue && indice.aberto.abertas === 2,
    'abrir uma COLEÇÃO não a fecha: as duas ficam abertas, porque elas não '
    + 'disputam o mesmo interruptor', indice.aberto.abertas + ' aberta(s)');
  checar(indice.trocou.abertas === 2 && indice.trocou.colecao === 'Hinários'
    && indice.trocou.favSegue,
    'e o rodízio vale ENTRE as coleções: abrir os Hinários fecha os Oficiais e '
    + 'não toca nos Favoritos', JSON.stringify(indice.trocou));
  checar(indice.fav.semColecao,
    'fechar a coleção aberta deixa a tela sem nenhuma — e os favoritos seguem lá');
  checar(indice.aberto.cards > 0 && indice.aberto.temSerie,
    'o toque no cabeçalho abre a seção e os cards aparecem',
    indice.aberto.cards + ' card(s)');
  checar(indice.aberto.dentroDoCorpo,
    'dentro do CORPO do grupo — a lista virou árvore, não uma pilha com títulos');
  checar(indice.aberto.altura > indice.fechado.altura,
    'e fechado ocupa MENOS tela que aberto, que é o pedido inteiro ('
    + Math.round(indice.fechado.altura) + 'px contra ' + Math.round(indice.aberto.altura) + 'px)');

  // ── OS FAVORITOS DENTRO DA BIBLIOTECA (v5.237) ─────────────────────────
  // Uma implementação só, duas casas: o grupo é montado pelo MESMO
  // `renderFolderList` da gaveta. O que se afirma é que ele desenha as linhas
  // de verdade — e que a gaveta continua desenhando as dela, senão apontar o
  // host para o lugar novo teria quebrado o antigo em silêncio.
  const favs = await pg.evaluate(async () => {
    // Um favorito de verdade, para a seção ter o que mostrar.
    const rec = await AVDB.addMedia(new Blob(['x'], { type: 'audio/mpeg' }),
      { name: 'Louvor favorito de teste', list: 'favs' });
    await recarregarFavoritos();
    // Só os Favoritos abertos — o PADRÃO do app (v5.262). Antes a linha era um
    // `clear()` seco, com a nota "a seção é FIXA: não depende disto"; ela passou
    // a depender, e um `clear()` a deixaria fechada e sem corpo para medir.
    grupoAberto = ''; favAberto = true;
    const lista = document.createElement('ul');
    lista.className = 'hymnal-list';
    lista.style.width = '390px';
    document.body.appendChild(lista);
    renderCollectionsList(lista, () => {}, { semTotal: true });
    const grupo = [...lista.querySelectorAll('.coll-group')]
      .find((g) => /Favoritos/.test((g.querySelector('.coll-group-name') || {}).textContent || ''));
    const corpo = grupo && grupo.querySelector('.coll-group-corpo');
    const r = {
      temItem: !!corpo && /Louvor favorito de teste/.test(corpo.textContent),
      temNovaPasta: false, temPastaDoAparelho: false,
      // A LINHA DE USO DO DISCO SAIU (v5.239): `navigator.storage.estimate()`
      // fala do origin inteiro, com padding deliberado, e a cota é o que o
      // navegador ACHA que pode ceder — ela disputava a leitura com os
      // cabeçalhos, que dizem o peso de verdade de cada coleção. A asserção
      // vale para a lista INTEIRA, não só para o corpo da seção: era ali, no
      // rodapé da Biblioteca, que ela morava.
      semLinhaDeDisco: !lista.querySelector('.storage-usage'),
      // O RODAPÉ DA SEÇÃO. `syncDeviceFolder` era o botão do cabeçalho da
      // gaveta, e a gaveta deixou de ter porta própria: sem esta linha a ação
      // ficaria sem lugar nenhum de onde ser alcançada.
      rodape: !corpo ? [] : [...corpo.querySelectorAll('.import-row .import-btn')]
        .map((b) => b.textContent.trim()),
      // O cabeçalho: o que ele mostra em TEXTO (só o nome — o contador saiu) e
      // se o botão de ação está lá.
      cabecalho: !grupo ? '' : (grupo.querySelector('.coll-group-bar') || {}).textContent,
      temAcaoNaBarra: !!(grupo && grupo.querySelector('.coll-group-bar .coll-group-acao')),
      semContagem: !!grupo && !grupo.querySelector('.coll-group-count'),
      // E a GAVETA continua inteira: o host é emprestado, não movido.
      naGaveta: (() => {
        document.getElementById('favList').innerHTML = '';
        renderFolderList();
        return /Louvor favorito de teste/.test(document.getElementById('favList').textContent);
      })(),
    };
    r.semRodape = r.rodape.length === 0;
    // A AÇÃO DA BARRA FAZ A COISA (v5.254). Ela abria uma folha com duas
    // escolhas; a outra — criar um atalho de pasta — deixou de existir, e uma
    // folha com uma opção é um toque cobrado para não escolher nada. O que se
    // mede é o desfecho: nenhuma folha, e o pedido de pasta do aparelho saiu.
    window.__pediuPasta = 0;
    const syncOrig = window.syncDeviceFolder;
    window.syncDeviceFolder = () => { window.__pediuPasta++; };
    grupo.querySelector('.coll-group-acao').click();
    r.acao = {
      abriuFolha: document.getElementById('songMenuPopup').classList.contains('open'),
      pediuPasta: window.__pediuPasta,
      titulo: (grupo.querySelector('.coll-group-bar .coll-group-acao') || {}).title || '',
    };
    window.syncDeviceFolder = syncOrig;
    closeSongMenu();
    // ── A LISTA É ÚNICA, E A ORDEM É DO OPERADOR (v5.254) ────────────────
    // Sem seções por tipo, e com alça de arrastar em cada item — as duas
    // metades do pedido. A ordem medida é a da lista `favs`, que é ordem de
    // chegada; o que a asserção prova é que ela é REORDENÁVEL.
    const rec2 = await AVDB.addMedia(new Blob(['y'], { type: 'video/mp4' }),
      { name: 'Vídeo favorito de teste', list: 'favs' });
    // UMA PASTA SINCRONIZADA, para a ORDEM ter o que provar (v5.285): sem ela
    // "as pastas vêm primeiro" seria verdade por vacuidade.
    opfsFolders.push({ id: 'pasta-ordem', name: 'Vídeos do culto', count: 9 });
    await recarregarFavoritos();
    const lista3 = document.createElement('ul');
    document.body.appendChild(lista3);
    favHost = lista3;
    try { renderFolderList(); } finally { favHost = null; }
    r.lista = {
      secoes: lista3.querySelectorAll('.fav-section').length,
      // AS SONDAS DOS ITENS SÃO ESCOPADAS À PLACA (`.fav-itens`), e não à lista
      // inteira: desde a v5.285 há uma PASTA no topo, que também é um
      // `.lib-item` e não é um favorito — contá-la aqui mediria outra coisa
      // (ela não tem par ↑↓, nem subtítulo, nem estrela).
      // ===== AS PASTAS VÊM PRIMEIRO (v5.285) =====
      // Pedido do operador. A régua é a POSIÇÃO no documento, e não o índice
      // dentro de uma `<ul>`: desde a v5.284 os itens moram numa placa própria
      // (`.fav-itens`) e as pastas são irmãs dela, então "primeiro" é uma
      // relação entre dois nós de níveis diferentes — que é justamente o que
      // uma comparação de índices não veria.
      pastaAntes: (() => {
        const pasta = lista3.querySelector('.folder-opfs');
        const placa = lista3.querySelector('.fav-itens');
        if (!pasta || !placa) return null;
        return !!(pasta.compareDocumentPosition(placa) & Node.DOCUMENT_POSITION_FOLLOWING);
      })(),
      // Tipos diferentes (áudio e vídeo) na MESMA lista, sem nada entre eles.
      nomes: [...lista3.querySelectorAll('.fav-itens .row-name')].map((e) => e.textContent),
      // O PAR ↑↓ tomou o lugar da alça de arrastar (v5.285), e mora no MESMO
      // lugar em que ela morava desde a v5.258: DENTRO do menu `⋮`. Medir só a
      // presença aprovaria os botões soltos em cima do título.
      ordem: [...lista3.querySelectorAll('.fav-itens .row-ordem')]
        .filter((b) => b.closest('.row-acoes')).length,
      // E AS PONTAS SÃO INERTES: o primeiro item não sobe, o último não desce.
      // Sem isto, dois botões mortos ficariam oferecendo o que não fazem.
      pontas: (() => {
        const ls = [...lista3.querySelectorAll('.fav-itens > .lib-item')];
        if (ls.length < 2) return null;
        const ord = (li) => [...li.querySelectorAll('.row-ordem')].map((b) => b.disabled);
        return { primeiro: ord(ls[0]), ultimo: ord(ls[ls.length - 1]) };
      })(),
      soUmBotaoNaLinha: [...lista3.querySelectorAll('.fav-itens > .lib-item')]
        .every((li) => li.querySelectorAll('.row > button').length === 1
          && !!li.querySelector('.row > .row-mais')),
      // O subtítulo voltou: sem cabeçalho de tipo, é ele que distingue.
      subs: [...lista3.querySelectorAll('.fav-itens .row-sub')]
        .map((e) => getComputedStyle(e).display).filter((d) => d !== 'none').length,
      // O PARAR (v5.259). Nesta lista ele simplesmente NÃO EXISTIA: uma linha de
      // favorito no ar mostrava o selo "● No ar" e não oferecia nada que a
      // tirasse de lá — e foi justamente aqui que o operador viu a faixa de
      // ações por cima do título ("ele estava no ar"). Ele mora na CAPA, e a
      // faixa tem de continuar OPACA nesse estado.
      parar: (() => {
        const li = lista3.querySelector('.fav-itens > .lib-item');
        if (!li) return null;
        li.classList.add('no-ar');
        const stop = li.querySelector('.row-stop');
        const caixa = li.querySelector('.row-acoes');
        const bg = caixa ? getComputedStyle(caixa).backgroundColor : '';
        const m = bg.match(/rgba?\(([^)]+)\)/);
        const p = m ? m[1].split(',').map((x) => parseFloat(x)) : [];
        const r = {
          naThumb: !!stop && !!stop.parentElement
            && stop.parentElement.classList.contains('thumb'),
          visivel: !!stop && getComputedStyle(stop).display !== 'none',
          alfa: p.length === 4 ? p[3] : 1,
        };
        li.classList.remove('no-ar');
        return r;
      })(),
    };
    lista3.remove();
    opfsFolders.length = 0;
    // E O REORDENAR de verdade, pelo BOTÃO: o segundo item sobe uma casa.
    await moverNaLista('favs', rec2.id, -1);
    r.lista.ordemDepois = (await AVDB.listIds('favs')).indexOf(rec2.id);
    await AVDB.listRemove('favs', rec2.id);
    await recarregarFavoritos();
    // E O VAZIO: uma frase só. Medido com a lista de favoritos esvaziada.
    const guardados = favItems.slice();
    favItems = [];
    const lista2 = document.createElement('ul');
    document.body.appendChild(lista2);
    favHost = lista2;
    try { renderFolderList(); } finally { favHost = null; }
    const vazio = lista2.querySelector('.empty');
    r.vazioTexto = vazio ? vazio.textContent.trim() : '';
    r.vazioUmaLinha = !!vazio && !vazio.querySelector('br')
      && /^Nenhum favorito ainda\.?$/.test(r.vazioTexto)
      && !lista2.querySelector('.import-row');
    lista2.remove();
    favItems = guardados;
    lista.remove();
    grupoAberto = ''; favAberto = true;
    await AVDB.listRemove('favs', rec.id);
    await recarregarFavoritos();
    return r;
  });
  checar(favs.temItem,
    'OS FAVORITOS SÃO DESENHADOS DENTRO DA BIBLIOTECA, pelo mesmo '
    + '`renderFolderList` da gaveta');
  checar(favs.semLinhaDeDisco,
    'e a Biblioteca não tem mais rodapé de uso do disco — número que a medida '
    + 'não sustenta, disputando com o peso que os cabeçalhos já dizem');
  checar(favs.naGaveta,
    'e a GAVETA continua desenhando a dela — o host é emprestado, não movido');
  // ── UM BOTÃO, DUAS ORIGENS (v5.239) ────────────────────────────────────
  // Pedido do operador: as ações da seção vão para a BARRA dela, só com ícone,
  // e "Adicionar pasta" se unifica com "buscar no sistema" — um toque, e a
  // folha oferece criar uma pasta ou trazer uma do aparelho.
  //
  // As duas metades: o corpo da lista ficou LIMPO (nenhum botão de texto, e o
  // vazio é uma linha só) **e** as duas origens continuam alcançáveis. Sem a
  // segunda, apagar a linha do rodapé teria passado — e levado a sincronização
  // de pastas junto, sem nada na tela que a explicasse.
  checar(favs.semRodape && favs.semContagem,
    'a seção não tem mais rodapé de botões nem contador — o corpo é só a lista',
    JSON.stringify(favs.rodape) + ' · ' + JSON.stringify(favs.cabecalho));
  checar(favs.temAcaoNaBarra,
    'a ação mora na BARRA da seção, só com ícone', JSON.stringify(favs.cabecalho));
  checar(!favs.acao.abriuFolha && favs.acao.pediuPasta === 1,
    'e o toque nela TRAZ UMA PASTA DO APARELHO direto — sem folha, porque a '
    + 'outra origem (o atalho de pasta) deixou de existir', JSON.stringify(favs.acao));
  checar(/pasta do aparelho/i.test(favs.acao.titulo),
    'e o rótulo dela diz o que ela faz', favs.acao.titulo);
  checar(favs.lista.secoes === 0 && favs.lista.nomes.length === 2,
    'A LISTA DE FAVORITOS É ÚNICA: tipos diferentes juntos, sem subdivisão nenhuma',
    JSON.stringify(favs.lista.nomes));
  checar(favs.lista.pastaAntes === true,
    'AS PASTAS SINCRONIZADAS VÊM NO TOPO da lista de favoritos (v5.285) — no fim '
    + 'elas eram empurradas para longe por cada favorito novo',
    'pasta antes da placa: ' + favs.lista.pastaAntes);
  checar(favs.lista.ordem === favs.lista.nomes.length * 2,
    'e cada item tem o PAR ↑↓ de reordenar, DENTRO do menu `⋮` (v5.285)',
    favs.lista.ordem + ' botão(ões) para ' + favs.lista.nomes.length + ' item(ns)');
  checar(!!favs.lista.pontas && favs.lista.pontas.primeiro[0] === true
    && favs.lista.pontas.ultimo[1] === true
    && favs.lista.pontas.primeiro[1] === false && favs.lista.pontas.ultimo[0] === false,
    'e as PONTAS são inertes: o primeiro não sobe, o último não desce — e os '
    + 'outros dois continuam vivos', JSON.stringify(favs.lista.pontas));
  checar(favs.lista.soUmBotaoNaLinha,
    'e a linha ficou com um botão só: o `⋮` — o resto saiu de cima do título');
  checar(favs.lista.subs === favs.lista.nomes.length,
    'e o subtítulo voltou a aparecer: sem cabeçalho de tipo, é ele que distingue');
  checar(favs.lista.ordemDepois === 0,
    'e o botão MOVE de verdade — uma casa, na lista de verdade');
  checar(!!favs.lista.parar && favs.lista.parar.naThumb && favs.lista.parar.visivel,
    'UM FAVORITO NO AR também oferece o "Tirar do ar", na capa (v5.259) — aqui ele '
    + 'nem existia', JSON.stringify(favs.lista.parar));
  checar(!!favs.lista.parar && favs.lista.parar.alfa === 1,
    'e a faixa de ações continua OPACA com a linha no ar — era este o título '
    + 'aparecendo por trás dos botões', JSON.stringify(favs.lista.parar));
  // ── OS FAVORITOS SE ATUALIZAM COM A BIBLIOTECA ABERTA (v5.258) ─────────
  //
  // Relato do operador: *"se estou na biblioteca e adiciono algo aos favoritos,
  // ele só aparece na lista após fechar e abrir novamente."* Ele estava certo, e
  // a causa é que os favoritos têm DUAS casas desde a v5.237: quem redesenhava
  // depois de favoritar era o `renderLibrary` — a lista de baixo —, e a seção
  // dentro da Biblioteca é desenhada por `renderSearchResults`, que ninguém
  // chamava. O estado estava em dia; a tela é que não.
  //
  // O teste usa a tela DE VERDADE (o popup aberto), e não um `<ul>` de mentira:
  // o defeito era exatamente a distância entre o estado e aquela tela.
  const favVivo = await pg.evaluate(async () => {
    // NO MODO AVANÇADO, e isto não é cerimônia: no Modo Fácil sem tela
    // conectada o `renderSimpleGate` FECHA a Biblioteca (a cortina a esconde),
    // e a enquete do espelho o chama sozinha durante a espera do pulso. O caso
    // passava por sorte de relógio — e é a mesma armadilha da v5.236: medir uma
    // tela no modo em que ela não vive.
    const modoAntes = appMode;
    setAppMode('full');
    openHymnSearch();
    await new Promise((r) => setTimeout(r, 250));
    const secao = () => document.querySelector('#hymnResults [data-fav-corpo]');
    const antes = !!secao() && /Favorito ao vivo/.test(secao().textContent);
    const rec = await AVDB.addMedia(new Blob(['z'], { type: 'audio/mpeg' }),
      { name: 'Favorito ao vivo', list: 'avulsos' });
    // Pelo MESMO caminho do operador: a estrela de uma linha.
    await toggleFav(rec.id, 'Favorito ao vivo', null);
    await new Promise((r) => setTimeout(r, 1400));   // o pulso, e o redesenho depois dele
    const depois = !!secao() && /Favorito ao vivo/.test(secao().textContent);
    // A ROLAGEM não pode ter sido zerada: redesenhar a Biblioteca inteira
    // jogaria o operador de volta ao topo, que é pior que o defeito.
    const lista = document.getElementById('hymnResults');
    lista.scrollTop = 40;
    const rolagemAntes = lista.scrollTop;
    await recarregarFavoritos();
    const rolagemDepois = lista.scrollTop;
    await AVDB.listRemove('favs', rec.id);
    await recarregarFavoritos();
    closeHymnSearch();
    setAppMode(modoAntes);   // o modo é global: deixá-lo trocado quebra os casos seguintes
    return { antes, depois, rolagemAntes, rolagemDepois };
  });
  checar(!favVivo.antes && favVivo.depois,
    'FAVORITAR COM A BIBLIOTECA ABERTA já mostra o item na seção — sem fechar e reabrir',
    JSON.stringify(favVivo));
  checar(favVivo.rolagemAntes === 0 || favVivo.rolagemDepois === favVivo.rolagemAntes,
    'e o redesenho é da SEÇÃO, não da Biblioteca inteira: a rolagem não volta ao topo',
    JSON.stringify(favVivo));

  // ── O VÃO É UM PISO, E A SEÇÃO CRESCE ALÉM DELE (v5.273 → v5.282) ──────
  //
  // Pedido do operador: *"não tenha mais o sistema de ver mais. Agora quando
  // aberta ela mostra toda a listagem"* e *"mantenha o tamanho mínimo dela,
  // mesmo vazia, como o tamanho flexível que ocupa o que sobra das outras
  // coleções… mas agora esse é apenas o tamanho mínimo, que cresce conforme a
  // lista dos favoritos requerir mais que esse espaço disponível"*.
  //
  // Isto REVOGA o caso do botão "Ver todos" (v5.273/v5.276), que media a régua
  // do recorte — quantos itens ficavam de fora da caixa. Não há mais recorte, e
  // é isso que as DUAS metades afirmam, porque nenhuma basta sozinha: com a
  // lista vazia a seção ainda RESERVA o vão (senão a Biblioteca abriria com as
  // coleções coladas no topo, que é o desenho que o operador mandou manter), e
  // com a lista cheia ela PASSA dele sem cortar um item.
  //
  // A medição é na Biblioteca DE VERDADE: o vão é uma consequência de a lista
  // ter altura finita, e num `<ul>` solto no `<body>` não há vão nenhum.
  const vao = await pg.evaluate(async () => {
    const modoAntes = appMode;
    setAppMode('full');
    openHymnSearch();
    await new Promise((r) => setTimeout(r, 250));
    // A BIBLIOTECA DO OPERADOR, e a fidelidade aqui é o caso inteiro: são OITO
    // seções nos prints dele, e é isso que torna o vão pequeno o bastante para
    // uma lista de favoritos passar dele. Num fixture com duas seções sobra
    // tela à vontade, a lista nunca alcança o piso, e a metade que importa
    // deste caso seria verdadeira por vacuidade.
    albumCatalog.categories = ['CDs oficiais/ano', 'Adoradores', 'Cantores',
      'Celebra SP', 'Diversas', 'Especiais'].map((nome, i) => ({
      name: nome,
      albums: [{ id_album: 500 + i, name: 'Álbum ' + nome }],
    }));
    albumCatalog.albums = albumCatalog.categories.map((c) => c.albums[0]);
    const corpo = () => document.querySelector('#hymnResults [data-fav-corpo]');
    const secao = () => {
      const c = corpo();
      return c ? c.parentElement : null;
    };
    // O PISO, lido de onde o JS o escreve — a custom property da lista. Comparar
    // a altura contra ele é o que separa "cresceu" de "está grande": um número
    // fixo aqui dependeria da altura da tela do runner.
    const piso = () => parseFloat(
      getComputedStyle(hymnResultsEl).getPropertyValue('--fav-vao')) || 0;
    // ITENS FORA DA CAIXA do corpo. Era a régua do botão; agora é a afirmação
    // de que NADA fica de fora, em nenhum tamanho de lista. `.empty` é a linha
    // de "Nenhum favorito ainda" e não é um item.
    const deFora = () => {
      const c = corpo();
      if (!c) return -1;
      const caixa = c.getBoundingClientRect();
      return [...c.children].filter((el) => {
        if (el.classList.contains('empty')) return false;
        const b = el.getBoundingClientRect();
        return b.bottom > caixa.bottom + 1 || b.top < caixa.top - 1;
      }).length;
    };
    const ler = () => ({
      piso: piso(),
      altura: secao() ? secao().getBoundingClientRect().height : 0,
      deFora: deFora(),
      // O BOTÃO não pode existir em estado nenhum (v5.282).
      temBotao: !!document.querySelector('#hymnResults .coll-group-mais'),
    });
    renderCollectionsList(hymnResultsEl, () => {}, { semTotal: true });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const vazio = {
      ...ler(),
      // Quantas seções a tela tem: é isto que prova que a medição aconteceu na
      // condição do relato, com o vão pequeno.
      secoes: document.querySelectorAll('#hymnResults .coll-group--drop').length,
    };
    // Favoritos que passam de qualquer tela de celular.
    const ids = [];
    for (let i = 1; i <= 30; i++) {
      const r = await AVDB.addMedia(new Blob(['v' + i], { type: 'audio/mpeg' }),
        { name: 'Favorito de lote ' + i, list: 'favs' });
      ids.push(r.id);
    }
    await recarregarFavoritos();
    // A medição do vão é adiada um quadro de propósito (ver
    // `acertarVaoDosFavoritos`), então a leitura espera dois.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const muitos = {
      ...ler(),
      // E a BIBLIOTECA passa a rolar: a seção que cresceu empurra as fechadas
      // para baixo, que é o que qualquer outra seção aberta já faz. Sem isto,
      // uma seção que crescesse para fora da tela sem a lista rolar passaria.
      rola: hymnResultsEl.scrollHeight > hymnResultsEl.clientHeight + 1,
      // O corpo continua sem rolagem PRÓPRIA (o `overflow: hidden` de que a
      // animação de abertura depende). O operador recusou o scroll interno na
      // v5.280, e a régua é o `overflow-y` COMPUTADO: uma caixa `hidden`
      // continua rolando por SCRIPT, então medir `scrollTop` aprovaria os dois
      // estados — quem não rola aqui é o DEDO.
      overflow: corpo() ? getComputedStyle(corpo()).overflowY : 'AUSENTE',
    };
    albumCatalog.categories = []; albumCatalog.albums = [];
    for (const id of ids) await AVDB.listRemove('favs', id);
    await recarregarFavoritos();
    closeHymnSearch();
    setAppMode(modoAntes);
    return { vazio, muitos };
  });
  checar(vao.vazio.secoes >= 8,
    'a Biblioteca do caso tem as OITO seções do relato — é o que torna o vão '
    + 'pequeno e a lista de favoritos capaz de passar dele',
    vao.vazio.secoes + ' seção(ões)');
  // A PRIMEIRA METADE: vazia, ela RESERVA o vão. É o desenho de abertura da
  // Biblioteca — coleções empilhadas na base, o que sobra em cima é dos
  // favoritos — e é o que o operador mandou manter.
  checar(vao.vazio.piso > 0 && Math.abs(vao.vazio.altura - vao.vazio.piso) <= 2,
    'sem favorito NENHUM a seção ainda ocupa o vão que sobra das outras: o piso '
    + 'é o tamanho dela (' + Math.round(vao.vazio.altura) + 'px para um vão de '
    + Math.round(vao.vazio.piso) + 'px)');
  // A SEGUNDA: cheia, ela PASSA do vão. Sem ela, um `height` fixo de volta
  // passaria na de cima.
  checar(vao.muitos.altura > vao.muitos.piso + 2,
    'e com mais favoritos do que cabe nele ela CRESCE além do piso — o vão é um '
    + 'mínimo, não uma altura (' + Math.round(vao.muitos.altura) + 'px para um '
    + 'vão de ' + Math.round(vao.muitos.piso) + 'px)');
  checar(vao.muitos.deFora === 0 && vao.vazio.deFora === 0,
    'e a lista inteira aparece: nenhum item fica cortado fora da caixa, em '
    + 'tamanho de lista nenhum',
    'de fora: ' + vao.vazio.deFora + ' (vazia) / ' + vao.muitos.deFora + ' (cheia)');
  checar(vao.muitos.rola,
    'quem rola é a BIBLIOTECA, como em qualquer outra seção aberta');
  checar(!vao.vazio.temBotao && !vao.muitos.temBotao,
    'e não há mais "Ver todos" em estado nenhum: aberta, a seção mostra toda a '
    + 'listagem');
  checar(vao.muitos.overflow === 'hidden',
    'o corpo continua sem rolagem própria — não há um segundo caminho para o '
    + 'fim da lista',
    'overflow-y ' + vao.muitos.overflow);

  // ── A BIBLIOTECA ABRE COM A LISTA NO TOPO (v5.280) ─────────────────────
  //
  // Decisão do operador: *"ao invés de ter um scroll de tela inteira, deixar
  // apenas os itens abaixo da barra de pesquisa ficarem dentro de um scroll, e
  // apenas rolar esse scroll para o topo quando a biblioteca é aberta"*.
  //
  // A rolagem sempre foi só da lista; o que faltava é o reset. `#hymnResults` é
  // o MESMO nó entre uma abertura e a seguinte, então ele guardava a posição da
  // vez anterior e a Biblioteca reabria no meio de um hinário.
  const noTopo = await pg.evaluate(async () => {
    const modoAntes = appMode;
    setAppMode('full');
    openHymnSearch();
    await new Promise((r) => setTimeout(r, 250));
    // Conteúdo que dê o que rolar, e uma rolagem de verdade.
    albumCatalog.categories = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((n, i) => ({
      name: 'Categoria ' + n,
      albums: [{ id_album: 900 + i, name: 'Álbum ' + n }],
    }));
    albumCatalog.albums = albumCatalog.categories.map((c) => c.albums[0]);
    // E uma COLEÇÃO ABERTA: com tudo colapsado a lista nunca transborda (o vão
    // dos favoritos é justamente o que sobra), então não haveria rolagem a
    // afirmar — é uma propriedade do desenho, não um detalhe do fixture.
    grupoAberto = 'Hinários';
    renderSearchResults('');
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    hymnResultsEl.scrollTop = hymnResultsEl.scrollHeight;
    const rolou = hymnResultsEl.scrollTop;
    closeHymnSearch();
    openHymnSearch();
    await new Promise((r) => setTimeout(r, 250));
    const aoReabrir = hymnResultsEl.scrollTop;
    albumCatalog.categories = []; albumCatalog.albums = [];
    grupoAberto = ''; favAberto = true;
    closeHymnSearch();
    setAppMode(modoAntes);
    return { rolou, aoReabrir };
  });
  checar(noTopo.rolou > 0 && noTopo.aoReabrir === 0,
    'A BIBLIOTECA REABRE COM A LISTA NO TOPO — ela guardava a rolagem da vez '
    + 'anterior e voltava no meio de um hinário',
    'rolou ' + Math.round(noTopo.rolou) + 'px, reabriu em ' + noTopo.aoReabrir);

  // ── A COLEÇÃO ABRE PARA BAIXO, ALINHADA PELO TOPO (v5.277) ─────────────
  //
  // Pedido do operador: *"as coleções estão abrindo estendendo para cima, mas
  // elas devem sempre abrir para baixo e rolar/alinhar a tela sempre com o
  // início da lista da coleção, alinhando com o topo dela"*.
  //
  // São DUAS metades, e a segunda é a que o relato descreve: o topo da seção
  // aberta encosta no topo da área visível (a lista rolou até ele), **e** os
  // favoritos não mudaram de tamanho — era o encolhimento deles que fazia o
  // conteúdo subir e a coleção parecer crescer para cima.
  const alinhado = await pg.evaluate(async () => {
    const modoAntes = appMode;
    setAppMode('full');
    openHymnSearch();
    await new Promise((r) => setTimeout(r, 250));
    // As oito seções do relato outra vez: sem elas a lista cabe inteira na tela
    // e não há rolagem nenhuma a afirmar.
    albumCatalog.categories = ['CDs oficiais/ano', 'Adoradores', 'Cantores',
      'Celebra SP', 'Diversas', 'Especiais'].map((nome, i) => ({
      name: nome,
      albums: [{ id_album: 700 + i, name: 'Álbum ' + nome }],
    }));
    albumCatalog.albums = albumCatalog.categories.map((c) => c.albums[0]);
    grupoAberto = ''; favAberto = true;
    hymnResultsEl.innerHTML = '';   // `renderCollectionsList` ACRESCENTA (v5.232)
    renderCollectionsList(hymnResultsEl, () => renderSearchResults(''), { semTotal: true });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const secao = (nome) => [...hymnResultsEl.children]
      .find((n) => n.dataset && n.dataset.grupo === nome);
    const altFavAntes = secao('Favoritos').getBoundingClientRect().height;
    // A ÚLTIMA seção da lista: é a que mais precisa da rolagem, porque abrir
    // uma coleção lá embaixo cresce para fora da tela.
    const alvo = 'Especiais';
    const barra = secao(alvo).querySelector('.coll-group-bar');
    const desvioAntes = secao(alvo).getBoundingClientRect().top
      - (hymnResultsEl.getBoundingClientRect().top
        + parseFloat(getComputedStyle(hymnResultsEl).paddingTop || 0));
    barra.click();
    // A rolagem é suave: a leitura espera ela assentar.
    await new Promise((r) => setTimeout(r, 700));
    const el = secao(alvo);
    const topoLista = hymnResultsEl.getBoundingClientRect().top
      + parseFloat(getComputedStyle(hymnResultsEl).paddingTop || 0);
    const r = {
      desvio: el.getBoundingClientRect().top - topoLista,
      desvioAntes,
      rolou: hymnResultsEl.scrollTop,
      // O quanto a lista PODE rolar: quando a seção aberta é a última e o que
      // ela abre é curto, não há conteúdo abaixo para levá-la até o topo — e
      // rolar até o fim é o mais perto que existe.
      maximo: hymnResultsEl.scrollHeight - hymnResultsEl.clientHeight,
      altFavAntes,
      altFavDepois: secao('Favoritos').getBoundingClientRect().height,
    };
    albumCatalog.categories = []; albumCatalog.albums = [];
    grupoAberto = ''; favAberto = true;
    closeHymnSearch();
    setAppMode(modoAntes);
    return r;
  });
  // A REGRA tem dois desfechos possíveis, e os dois são o mesmo pedido: o topo
  // da seção encosta no topo da lista, OU a lista rolou até o fim tentando —
  // quando a seção aberta é a última e o que ela abre é curto, não existe
  // conteúdo abaixo que a leve mais para cima. O que não pode acontecer é a
  // lista ficar parada, que era o estado anterior a este lote.
  checar(alinhado.rolou > 0 && alinhado.desvio < alinhado.desvioAntes
    && (Math.abs(alinhado.desvio) <= 2 || alinhado.rolou >= alinhado.maximo - 1),
    'ABRIR UMA COLEÇÃO rola a lista até o topo dela — ela abre para baixo e a '
    + 'tela vai ao início dos itens',
    'rolou ' + Math.round(alinhado.rolou) + 'px de ' + Math.round(alinhado.maximo)
    + ' possíveis; o topo subiu ' + Math.round(alinhado.desvioAntes - alinhado.desvio) + 'px');
  checar(Math.abs(alinhado.altFavDepois - alinhado.altFavAntes) <= 1,
    'e a seção dos Favoritos não muda de tamanho por causa disso — era o '
    + 'encolhimento dela que fazia a coleção parecer crescer para cima',
    Math.round(alinhado.altFavAntes) + 'px → ' + Math.round(alinhado.altFavDepois) + 'px');

  // ── A MIGRAÇÃO DOS ATALHOS DE PASTA (v5.254) ───────────────────────────
  //
  // Esta é a asserção que impede o lote de virar PERDA DE MÍDIA. Um item cujo
  // único detentor era um atalho vira, no instante em que o atalho some, um
  // registro que nenhuma lista aponta — e o coletor de lixo (que existe
  // justamente para isso) o apaga na varredura seguinte. Um vídeo grande
  // sumiria do app e do disco sem nada na tela que o explicasse.
  //
  // O caso reproduz o aparelho do operador: um atalho com um item que NÃO está
  // nos favoritos, e outro que já está (para provar que ele não é duplicado).
  const mig = await pg.evaluate(async () => {
    const so = await AVDB.addMedia(new Blob(['a'], { type: 'audio/mpeg' }),
      { name: 'Só no atalho', list: 'avulsos' });
    const jaFav = await AVDB.addMedia(new Blob(['b'], { type: 'audio/mpeg' }),
      { name: 'No atalho e nos favoritos', list: 'favs' });
    await AVDB.setState('folders', [{ id: 'p1', name: 'Louvores especiais' }]);
    await AVDB.listSet('folder_p1', [so.id, jaFav.id]);
    await migrarPastasParaFavoritos();
    const favsIds = await AVDB.listIds('favs');
    return {
      migrou: favsIds.includes(so.id),
      // O blob SOBREVIVEU: é o que o `folderDrop` teria apagado se a ordem das
      // duas metades estivesse invertida.
      temBytes: !!(await AVDB.getMedia(so.id)),
      // Sem duplicar quem já estava lá.
      vezes: favsIds.filter((x) => x === jaFav.id).length,
      // E o atalho não existe mais, nem o índice dele.
      semPastas: (((await AVDB.getState('folders')) || []).length) === 0,
      semIndice: (await AVDB.listIds('folder_p1')).length === 0,
      // Idempotente: rodar de novo não faz nada e não explode.
      denovo: await (async () => { await migrarPastasParaFavoritos(); return true; })(),
    };
  });
  checar(mig.migrou && mig.temBytes,
    'A MIGRAÇÃO leva o conteúdo do atalho para os favoritos — e a mídia SOBREVIVE '
    + '(sem isso, o gc apagaria o que ficasse sem dono)', JSON.stringify(mig));
  checar(mig.vezes === 1, 'e não duplica o que já estava favoritado');
  checar(mig.semPastas && mig.semIndice, 'e o atalho sai do banco, com o índice dele');
  checar(mig.denovo, 'e rodar de novo é um no-op (ela roda em toda abertura)');

  checar(favs.vazioUmaLinha,
    'e a lista vazia diz uma frase só — "Nenhum favorito ainda"',
    JSON.stringify(favs.vazioTexto));

  // ── "ONLINE": A QUALIDADE QUE NÃO BAIXA (v5.249) ───────────────────────
  // Pedido do operador: uma qualidade "Online" que, mesmo levando ao Cronograma,
  // guarda só o LINK em vez de obrigar o download.
  //
  // As duas metades: ela está no MESMO seletor das resoluções (é a mesma
  // pergunta, com "nada" na ponta da escala) **e** o item que ela guarda é o
  // link — sem bytes, sem download. Sem a segunda, acrescentar o rótulo teria
  // passado.
  const online = await pg.evaluate(async () => {
    // O modo é GLOBAL: deixá-lo trocado quebra os casos seguintes (a lição que
    // este arquivo já aprendeu duas vezes).
    const modoAntes = document.body.classList.contains('mode-simple') ? 'simple' : 'full';
    setAppMode('full');
    const r = { id: 'zzzzzzzzzz9', url: 'https://www.youtube.com/watch?v=zzzzzzzzzz9',
      name: 'Louvor de teste' };
    openYtMenu(r);
    const pop = document.getElementById('songMenuPopup');
    const segs = [...pop.querySelectorAll('.song-menu-seg')].map((s) =>
      [...s.querySelectorAll('button')].map((b) => b.textContent.trim()));
    const qualidade = segs.find((g) => g.some((t) => /1080p/.test(t))) || [];
    // Escolhe "Online" e mede o que a folha passa a dizer.
    const btnOnline = [...pop.querySelectorAll('.song-menu-seg button')]
      .find((b) => /^Online$/.test(b.textContent.trim()));
    btnOnline.click();
    const depois = {
      subs: [...pop.querySelectorAll('.song-menu-sub')].map((e) => e.textContent.trim()),
      // Com Online não há forma a escolher: a faixa Vídeo × Só áudio sai.
      temForma: [...pop.querySelectorAll('.song-menu-seg button')].some((b) => /Só áudio/.test(b.textContent)),
    };
    // E o CRONOGRAMA guarda o link. Desde a v5.252 a linha MARCA e quem executa
    // é o confirmar — a folha virou uma lista de opções com um botão só.
    const linha = [...pop.querySelectorAll('.song-menu-btn')]
      .find((b) => /Adicionar ao Cronograma/.test(b.textContent));
    linha.click();
    pop.querySelector('.song-menu-go').click();
    for (let i = 0; i < 60; i++) {
      const it = await AVDB.listItems('imports');
      const achou = it.find((x) => x.youtubeId === 'zzzzzzzzzz9');
      if (achou) {
        await AVDB.listRemove('imports', achou.id);
        setAppMode(modoAntes);
        return { qualidade, depois,
          guardou: { kind: achou.kind, temBlob: !!achou.blob, url: achou.url } };
      }
      await new Promise((res) => setTimeout(res, 50));
    }
    closeSongMenu();
    setAppMode(modoAntes);
    return { qualidade, depois, guardou: null };
  });
  checar(online.qualidade[0] === 'Online' && online.qualidade.includes('1080p'),
    '"ONLINE" é o primeiro degrau do MESMO seletor de qualidade',
    JSON.stringify(online.qualidade));
  checar(!online.depois.temForma,
    'e com ela escolhida a forma (Vídeo × Só áudio) sai — nada é baixado, então '
    + 'a escolha não mudaria coisa nenhuma');
  checar(online.depois.subs.some((t) => /só o link/i.test(t)),
    'os destinos que GUARDAM dizem o que mudou: "Só o link, sem baixar"',
    JSON.stringify(online.depois.subs));
  checar(!!online.guardou && online.guardou.kind === 'youtube' && !online.guardou.temBlob,
    'e o Cronograma recebe o LINK, sem bytes — era isto que obrigava o download',
    JSON.stringify(online.guardou));

  // ── A FILA DE LETRAS NÃO PERGUNTA POR UM VÍDEO (v5.236) ────────────────
  // `syncLyrics` varria TODA coleção com itens e pedia `music_<id>` ao LouvorJA
  // — e num episódio de série esse id é do YOUTUBE, uma pergunta que aquele
  // banco não tem como responder. Falha de rede não grava `LYRIC_NONE` de
  // propósito, então as ~52 requisições de cada série voltavam a cada abertura
  // do app, para sempre, e ainda entravam no total da notificação "Letras das
  // músicas". Nada disso aparece em lugar nenhum: é um `catch` vazio numa
  // tarefa de segundo plano.
  const letras = await pg.evaluate(async () => {
    const pedidos = [];
    const antes = Louvorja.fetchList;
    Louvorja.fetchList = (nome) => { pedidos.push(nome); return Promise.reject(new Error('sem rede')); };
    // O arranque pode ter deixado uma passada em voo; sem soltar a trava, a
    // chamada abaixo voltaria na hora e o caso mediria zero por não ter rodado.
    lyricSyncRunning = false;
    try { await syncLyrics(); } catch (_) { /* o que interessa é o que ela PEDIU */ }
    Louvorja.fetchList = antes;
    const ids = new Set(collSongs(
      (allCollections().find((x) => x.kind === 'serie') || {}).id).map((s) => s.id_music));
    return { pedidos, deVideo: pedidos.filter((n) => ids.has(String(n).replace(/^music_/, ''))) };
  });
  checar(letras.deVideo.length === 0,
    'a fila de letras NÃO pede letra ao LouvorJA para os vídeos da série',
    JSON.stringify(letras.pedidos.slice(0, 5)));

  // ── AS OPÇÕES DO ÁLBUM SÃO UMA LINHA SÓ (v5.233) ───────────────────────
  // Pedido do operador: o PESO sai (ele já está na barra, antes de abrir) e o
  // resto vira uma linha — a verificação (com progresso e resultado) ou a
  // remoção. O que este caso trava é o par: os chips SUMIRAM **e** o estado que
  // eles carregavam continua na tela. Sem a segunda metade, apagar o painel
  // inteiro passaria — a mesma cobrança de duas metades do `registro.test.mjs`.
  const opcoes = await pg.evaluate(() => {
    const c = allCollections().find((x) => x.kind === 'serie');
    // O MODO AVANÇADO, e ele é pré-requisito da medição inteira: no Modo Fácil
    // o painel de opções é `display: none` por regra (`.mode-simple
    // .coll-opts`), e num elemento escondido TODA medida é zero — larguras,
    // topos, centros. Zeros comparados com zeros passam, e foi assim que a
    // primeira versão deste caso aprovou um layout que ela não tinha medido
    // (a lição da v5.208, aqui de novo).
    const modoAntes = document.body.classList.contains('mode-simple') ? 'simple' : 'full';
    setAppMode('full');
    // ABRE o card: o `openCollectionOptions` marca o estado e manda o acervo se
    // redesenhar, e o acervo de verdade não é o `<ul>` de teste criado abaixo.
    openCollectionOptions(c);
    // UMA LISTA PRÓPRIA E VISÍVEL, e isto é o teste inteiro: o `#hymnResults`
    // mora dentro do popup de busca, que está FECHADO — ali todo
    // `getBoundingClientRect()` devolve zero, e uma medição de larguras e
    // linhas contra zeros PASSA sem medir nada (a lição da v5.208). A largura
    // é a de um celular comum, porque é ela que decide se a linha cabe.
    const lista = document.createElement('ul');
    lista.className = 'hymnal-list';
    lista.style.width = '390px';
    document.body.appendChild(lista);
    grupoAberto = 'Arquivos oficiais';  // fechado desde a v5.237, e um por vez desde a v5.273
    renderCollectionsList(lista, () => {}, { semTotal: true });
    const card = [...lista.querySelectorAll('.hymnal-card')]
      .find((el) => /Provai e Vede 2026/.test(el.textContent));
    const opts = card && card.querySelector('.coll-opts');
    const filhos = opts ? [...opts.children].map((el) => el.className) : [];
    const btns = opts ? [...opts.querySelectorAll('button')] : [];
    // Uma LINHA: todos os controles do painel partilham o mesmo topo.
    const topos = btns.map((b) => Math.round(b.getBoundingClientRect().top));
    const r = {
      achou: !!opts,
      filhos,
      chips: opts ? opts.querySelectorAll('.hymnal-stat, .hymnal-card-stats').length : -1,
      // O peso da BARRA continua onde sempre esteve — é ele que torna o do
      // painel redundante, então a asserção precisa vê-lo para valer.
      pesoNaBarra: !!(card && /\d+(,\d+)?\s?(KB|MB|GB)/.test(
        (card.querySelector('.coll-bar-sync') || {}).textContent || '')),
      pesoNoPainel: opts ? /\d+(,\d+)?\s?(KB|MB|GB)/.test(opts.textContent) : true,
      rotulos: btns.map((b) => b.textContent.trim().replace(/\s+/g, ' ')),
      estado: opts ? [...opts.querySelectorAll('.coll-opt-estado')].map((e) => e.textContent) : [],
      umaLinha: topos.length > 1 && Math.max(...topos) - Math.min(...topos) <= 2,
      // ── A FORMA DA LINHA (v5.235) ──────────────────────────────────────
      // O estado na MESMA linha do rótulo: os dois centros verticais coincidem.
      // Medir a ALTURA do botão não serviria — `align-items: stretch` iguala os
      // dois, então um botão que quebrasse em duas linhas esticaria a lixeira
      // junto e a diferença sumiria.
      estadoNaLinha: (() => {
        const b = opts && opts.querySelector('.coll-opts-acoes .new-folder-btn');
        const e = b && b.querySelector('.coll-opt-estado');
        if (!b || !e) return false;
        const rb = b.getBoundingClientRect(), re = e.getBoundingClientRect();
        return Math.abs((re.top + re.bottom) / 2 - (rb.top + rb.bottom) / 2) <= 3;
      })(),
      // A largura de referência: sem ela, zeros passariam por medidas.
      largLista: lista.getBoundingClientRect().width,
      lixeira: (() => {
        const rm = opts && opts.querySelector('.new-folder-btn.danger');
        const ver = opts && opts.querySelector('.new-folder-btn:not(.danger)');
        if (!rm || !ver) return null;
        return {
          // O RÓTULO são os nós de TEXTO do botão, não o `textContent` — este
          // traz o CODEPOINT do ícone junto (o `.msym` é uma ligadura da fonte,
          // um caractere de uso privado que `trim()` não remove e que
          // `JSON.stringify` imprime sem escapar: a primeira versão desta
          // asserção reprovava contra um "texto vazio" que tinha um caractere.
          texto: [...rm.childNodes].filter((n) => n.nodeType === 3)
            .map((n) => n.textContent).join('').trim(),
          temIcone: !!rm.querySelector('.msym, svg'),
          rotuloAssistivo: rm.getAttribute('aria-label') || rm.title || '',
          larg: rm.getBoundingClientRect().width,
          largVerificar: ver.getBoundingClientRect().width,
        };
      })(),
    };
    lista.remove();
    setAppMode(modoAntes);
    return r;
  });
  checar(opcoes.achou, 'o painel de opções do álbum abre');
  checar(opcoes.chips === 0,
    'e a faixa de CHIPS não existe mais nele', JSON.stringify(opcoes.filhos));
  checar(opcoes.pesoNaBarra && !opcoes.pesoNoPainel,
    'o PESO ficou só na barra do card, antes de abrir — no painel ele era a mesma '
    + 'medida dita duas vezes');
  // UMA linha é literal, e são DUAS medidas: o painel tem um filho só (não
  // sobrou faixa nenhuma acima dos botões) e os botões partilham o mesmo topo.
  // Sem a primeira, a asserção passaria com os chips de volta — eles nunca
  // estiveram na mesma linha dos botões, estavam ACIMA deles.
  checar(opcoes.umaLinha && opcoes.filhos.length === 1,
    'e o que sobrou divide UMA linha: verificação e remoção', JSON.stringify(opcoes.rotulos));
  // A FRAÇÃO LIMPA, E SÓ ELA (v5.241, pedido do operador). O estado é um NÚMERO —
  // a fração num álbum, a contagem numa série — e nunca uma palavra: "✓ completo"
  // trazia um glifo de fora da fonte de ícones e dizia por extenso o que "24/24"
  // já diz, com a cor verde ao lado repetindo pela terceira vez.
  checar(opcoes.estado.length === 1 && /^[\d/]+$/.test(opcoes.estado[0].trim()),
    'o ESTADO não se perdeu, e é só NÚMERO: nem "completo", nem "episódios" ("'
    + (opcoes.estado[0] || '') + '")');
  // E ele fica NA MESMA LINHA do rótulo (v5.235). Uma segunda linha resolvia a
  // largura e desfazia metade do ganho: o painel voltava a ter duas alturas de
  // texto, que é justamente o que condensá-lo veio tirar.
  checar(opcoes.estadoNaLinha,
    'e ele divide a linha com o rótulo, sem quebrar para uma segunda');
  const lx = opcoes.lixeira;
  checar(!!lx && lx.texto === '' && lx.temIcone,
    'a REMOÇÃO é só a lixeira, sem rótulo na tela', lx ? JSON.stringify(lx.texto) : 'sem botão');
  checar(!!lx && /Remover do dispositivo/.test(lx.rotuloAssistivo),
    'com a frase inteira no `aria-label` — quem não vê o ícone continua sabendo o alcance');
  checar(!!lx && lx.larg < lx.largVerificar * 0.6,
    'e ela para no próprio tamanho: o espaço liberado é do botão de atualizar ('
    + (lx ? Math.round(lx.larg) + 'px contra ' + Math.round(lx.largVerificar) + 'px' : '?') + ')');
  await pg.evaluate(() => {
    allCollections().forEach((c) => { ui(c.id).expanded = false; });
    grupoAberto = ''; favAberto = true;
    redesenharAcervo();
  });

  // E o bloco de conexão do Modo Fácil, que é o caminho que a v5.195 quebrou:
  // com shell >= 32 ele mostra as DUAS formas de conectar, não só o espelhar.
  const conn = await pg.evaluate(() => {
    const c = document.getElementById('castConn');
    const rede = document.getElementById('castNetBtn');
    const sm = document.getElementById('simpleMode');
    const busca = document.getElementById('simpleSearchBtn');
    const bb = busca && busca.getBoundingClientRect();
    return {
      achou: !!c,
      pai: c && c.parentElement ? (c.parentElement.id || c.parentElement.className) : '',
      redeVisivel: !!rede && !rede.hidden,
      semTela: sm.classList.contains('sem-tela'),
      // O BLOQUEIO, medido pelo que o operador vê e não por uma classe: a
      // cortina está no ar e cobre a tela inteira, e a busca — que ela esconde —
      // não está desenhada. (A v5.199 afirmava aqui exatamente o contrário; ver
      // o comentário de `renderSimpleGate` sobre por que ela caiu e voltou.)
      cortinaNoAr: (() => {
        const v = document.getElementById('simpleVeil');
        if (!v || v.hidden) return false;
        const r = v.getBoundingClientRect();
        return r.width >= innerWidth - 1 && r.height >= innerHeight - 1;
      })(),
      buscaVisivel: !!bb && bb.width > 2 && bb.height > 2,
    };
  });
  checar(conn.achou && conn.semTela && conn.pai === 'simpleConn',
    'sem tela, o bloco de conexão é o que fica legível (pai: ' + conn.pai + ')');
  checar(conn.redeVisivel,
    'e ele oferece as DUAS formas — espelhar para a TV e transmitir para navegador');
  // E COM A TRANSMISSÃO DESLIGADA o botão dela nomeia o DESTINO (v5.224). O par
  // deste caso está na página de baixo, com a transmissão no ar.
  const redeOff = await pg.evaluate(() => ({
    ligado: document.getElementById('castNetBtn').classList.contains('ligado'),
    rotulo: document.getElementById('castNetLabel').textContent,
  }));
  checar(!redeOff.ligado && /navegador/i.test(redeOff.rotulo),
    'desligada, a transmissão é a chamada preenchida e diz para onde vai ("'
    + redeOff.rotulo + '")');
  // O BLOQUEIO (v5.203, de volta a pedido do operador). Sem tela este modo não
  // projeta nada — nem imagem nem som —, e a cortina é o que diz isso.
  checar(conn.cortinaNoAr && !conn.buscaVisivel,
    'SEM TELA A TELA FICA BLOQUEADA: a cortina cobre tudo e a busca sai de cena');

  // ---- SEM TELA NENHUMA, O SOM SAI DESTE APARELHO (v5.215) --------------
  //
  // A regra vive num ramo que o `smoke.mjs` não alcança: sem ponte não há
  // `lastDisplays` nem transmissão, e é a CONEXÃO que decide. O que se mede é o
  // efeito, não a variável sozinha — `pvVideo.muted` é o que o alto-falante
  // obedece, e é ele que a `setForceMuted` acerta.
  //
  // O segundo caso é o portão de MODO: voltar ao Modo Fácil emudece, porque lá
  // sem tela a cortina já cobre tudo (o caso acima) e som atrás dela seria a
  // única coisa acontecendo. Ele também devolve o `localStorage` ao
  // simplificado — é dele que a página seguinte parte.
  const somSemTela = await pg.evaluate(() => {
    const v = document.getElementById('pvVideo');
    setAppMode('full');
    const avancado = { local: somLocal, mudo: v.muted };
    setAppMode('simple');
    const facil = { local: somLocal, mudo: v.muted };
    return { avancado, facil };
  });
  checar(somSemTela.avancado.local && !somSemTela.avancado.mudo,
    'NO AVANÇADO SEM TELA a preview deixa de ser muda — o som é deste aparelho');
  checar(!somSemTela.facil.local && somSemTela.facil.mudo,
    'e no Modo Fácil ela volta a ser muda (lá a cortina cobre tudo)');

  // ---- E A OUTRA METADE DA REGRA: uma tela ENTRANDO fecha a folha (v5.193) --
  //
  // O par do caso de baixo, e o que impede a correção da v5.217 de virar "a
  // folha nunca mais fecha sozinha": quem acabou de conectar terminou o que
  // veio fazer ali. A tela entra num turno só, com a folha já aberta — é a
  // BORDA que a regra sempre quis descrever.
  const fechaAoEntrar = await pg.evaluate(() => {
    setAppMode('full');
    abrirCast();
    const abriu = document.getElementById('castPopup').classList.contains('open');
    mirrorEstado = { ligado: true, telas: [{ rotulo: 'tela B', pronta: true }] };
    renderSimpleGate();
    const fechou = !document.getElementById('castPopup').classList.contains('open');
    mirrorEstado = null;
    fecharCast();
    setAppMode('simple');   // devolve o `localStorage` — a página seguinte parte daqui
    return { abriu, fechou };
  });
  checar(fechaAoEntrar.abriu && fechaAoEntrar.fechou,
    'uma tela ENTRANDO com a folha aberta continua fechando-a (a borda, não o nível)');

  // ---- O ESTADO EM QUE O OPERADOR DE FATO OPERA -------------------------
  //
  // Transmissão LIGADA, telas na rede recebendo, e NENHUMA TV. É a
  // configuração normal desta igreja desde a v5.187 (sem TV, as telas da rede
  // SÃO a projeção) — e é uma combinação que o primeiro percurso não cobre: lá
  // o espelho nasce desligado, então metade do `renderCast`, o
  // `acertarEnqueteDeFundo` e o caminho DESTRAVADO do Modo Fácil nunca correm.
  //
  // Uma página NOVA, e não um `mirrorEstado = …` na de cima: o que se quer
  // provar é que o bundle SOBE assim, com o estado presente desde o primeiro
  // instante — que é como o aparelho o encontra ao abrir com a transmissão já
  // no ar. Mexer no estado de uma página já de pé provaria outra coisa.
  const pg2 = await ctx.newPage();
  const erros2 = [];
  pg2.on('pageerror', (e) => erros2.push('pageerror: ' + e.message));
  pg2.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (EXTERNO.test(t) || /Failed to load resource/.test(t)) return;
    erros2.push(t);
  });
  await pg2.addInitScript(ponteCom(
    { ligado: true, endereco: 'http://192.168.0.14:8787',
      telas: [{ rotulo: 'tela A', conectadaMs: 90000, pronta: true }] },
    [],
  ));
  await pg2.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  let deuPe2 = false;
  try {
    await pg2.waitForFunction(
      () => window.AVDB && window.AVStream && window.createStage
        && typeof window.__avBack === 'function'
        && !!document.querySelector('#playlist li'),
      null, { timeout: 25000 },
    );
    deuPe2 = true;
  } catch (_) { deuPe2 = false; }
  checar(deuPe2, 'O APP FICA DE PÉ com a transmissão JÁ LIGADA e telas na rede');

  // E a célula da preview tem de ser a PREVIEW, não a conexão: sem TV, as telas
  // da rede são a projeção (v5.193), então há tela e não há o que conectar.
  const comTela = await pg2.evaluate(() => ({
    semTela: document.getElementById('simpleMode').classList.contains('sem-tela'),
    connEscondido: document.getElementById('simpleConn').hidden,
    cortinaNoAr: !document.getElementById('simpleVeil').hidden,
    modo: appMode,
  }));
  checar(!comTela.semTela && comTela.connEscondido && !comTela.cortinaNoAr,
    'e a tela DESTRAVA: sem TV, as telas da rede contam como tela');

  // E O SOM CONTINUA SENDO DAS TELAS (v5.215). É a metade que protege o
  // desfecho que a mesa de som produzia: cada tela da rede toca o próprio
  // arquivo no `<video>` dela, e um celular somando a própria saída seria o
  // mesmo louvor duas vezes na sala — fora do compasso, porque são dois
  // decodificadores. Vale mesmo no modo avançado, que é onde o som local
  // existe.
  const somComTela = await pg2.evaluate(() => {
    const v = document.getElementById('pvVideo');
    setAppMode('full');
    return { local: somLocal, mudo: v.muted, tela: algumaTelaConectada() };
  });
  checar(somComTela.tela && !somComTela.local && somComTela.mudo,
    'COM TELA DA REDE RECEBENDO este aparelho fica mudo, inclusive no avançado');

  // ---- A FOLHA DE CONEXÃO ABRE COM TELA JÁ CONECTADA (v5.217) -----------
  //
  // O relato: com o ícone de cast no estado CONECTADO (vermelho), tocar nele
  // não abria nada. Ele abria — e a folha se fechava sozinha em milissegundos,
  // porque o fecho automático da v5.193 era um teste de NÍVEL ("há tela?") e
  // não de BORDA ("uma tela entrou?"). O próprio `abrirCast` liga a enquete,
  // a enquete chama `renderSimpleGate`, e o nível é verdadeiro o tempo todo
  // enquanto houver tela.
  //
  // A espera é maior que um ciclo da enquete (`MIRROR_POLL_MS` = 2,5 s) de
  // propósito: o defeito precisa de uma leitura do estado para se manifestar,
  // e afirmar "abriu" no instante do clique passaria com ele no lugar.
  // O clique e a leitura no MESMO turno: entre dois `evaluate` cabe o
  // `setTimeout(0)` com que a ponte de mentira resolve o `espelhoEstado`, e a
  // primeira metade do defeito passaria a depender de quem ganha essa corrida.
  const abriuNaHora = await pg2.evaluate(() => {
    document.getElementById('pvCastBtn').click();
    return document.getElementById('castPopup').classList.contains('open');
  });
  await pg2.waitForTimeout(3200);
  const continuaAberta = await pg2.evaluate(() => ({
    aberta: document.getElementById('castPopup').classList.contains('open'),
    conectado: document.getElementById('pvCastBtn').classList.contains('connected'),
  }));
  checar(abriuNaHora, 'o toque no ícone de cast ABRE a folha de conexão');
  checar(continuaAberta.conectado && continuaAberta.aberta,
    'e ela CONTINUA aberta com tela conectada — a enquete não a fecha sozinha');

  // ---- LIGADA, A TRANSMISSÃO É O BOTÃO VERMELHO DE DESLIGAR (v5.224) -----
  //
  // O par do caso da página de cima, e o único lugar em que ele pode ser
  // medido: aqui a ponte responde `ligado: true`, então é o `renderCast` — e
  // não uma classe posta à mão pelo teste — quem pinta o botão e escreve o
  // rótulo. É a regra que o interruptor tinha e que o botão precisa manter:
  // quem diz o estado é a LEITURA do shell, nunca o toque.
  const redeOn = await pg2.evaluate(() => {
    const b = document.getElementById('castNetBtn');
    return {
      ligado: b.classList.contains('ligado'),
      rotulo: document.getElementById('castNetLabel').textContent,
      // Nenhum interruptor sobrou na folha: a decisão inteira é o par de botões.
      semTrilho: !document.querySelector('.cast-sw, .cast-sw-row, #castNetToggle'),
    };
  });
  checar(redeOn.ligado && /deslig/i.test(redeOn.rotulo),
    'LIGADA, o botão da transmissão veste o estado e passa a nomear o desligamento ("'
    + redeOn.rotulo + '")');

  // ---- E ENQUANTO O SHELL RESPONDE, O BOTÃO É O RECADO (v5.227) ----------
  //
  // O "Ligando a transmissão…" saía numa linha de 0,78 rem ABAIXO do botão que
  // o operador acabara de tocar — no menor texto da folha, e no exato momento
  // em que a folha se reorganiza. O rótulo é derivado de `mirrorOcupado` mais o
  // estado, pela mesma leitura que pinta a cor: ocupado com o servidor NO AR é
  // "Desligando…"; ocupado sem ele é "Ligando…".
  const emCurso = await pg2.evaluate(() => {
    const ler = () => document.getElementById('castNetLabel').textContent;
    mirrorOcupado = true;
    renderCast();
    const desligando = ler();
    const estadoAntes = mirrorEstado;
    mirrorEstado = { ligado: false, telas: [] };
    renderCast();
    const ligando = ler();
    mirrorEstado = estadoAntes;
    mirrorOcupado = false;
    renderCast();
    return { desligando, ligando, voltou: ler() };
  });
  checar(/deslig/i.test(emCurso.desligando) && /…$/.test(emCurso.desligando),
    'ocupado com o servidor no ar, o próprio botão diz "' + emCurso.desligando + '"');
  checar(/ligando/i.test(emCurso.ligando) && !/deslig/i.test(emCurso.ligando),
    'e ocupado sem ele, "' + emCurso.ligando + '"');
  checar(/deslig/i.test(emCurso.voltou) && !/…$/.test(emCurso.voltou),
    'terminado, ele volta a nomear a ação (nada de recado grudado)', emCurso.voltou);
  checar(redeOn.semTrilho, 'e não sobrou interruptor nenhum na folha de conexão');

  // ---- LIGAR E DESLIGAR NÃO É UM SALTO (v5.226) --------------------------
  //
  // O relato: "há adição ou subtração de conteúdo nesse popup, isso move os
  // elementos irregularmente... os elementos surgem do nada e as coisas mudam
  // de lugar". Duas metades, e as duas se medem sem olhar para um pixel.
  //
  // 1. O BLOCO DO ENDEREÇO abre por CLASSE e não por `hidden` — é isso que
  //    permite animar a altura. Um `hidden` de volta aqui é o salto de volta.
  // 2. A LISTA REAPROVEITA as linhas. Ela era refeita por inteiro a cada
  //    leitura do estado, e o estado é lido de 2,5 em 2,5 s: qualquer animação
  //    de entrada recomeçaria sozinha para sempre, e o botão "Desconectar" era
  //    recriado debaixo do dedo de quem o estava tocando.
  const anim = await pg2.evaluate(() => {
    const bloco = document.getElementById('castLive');
    const ul = document.getElementById('castTelas');
    const out = { porClasse: bloco.classList.contains('aberto') && !bloco.hidden,
      temCasca: !!bloco.querySelector('.cast-live-in') };
    const primeiro = ul.children[0];
    if (primeiro) primeiro.dataset.marca = 'x';
    renderCastTelas([{ rotulo: 'tela A', conectadaMs: 95000, pronta: true }]);
    out.mesmaLinha = !!ul.children[0] && ul.children[0].dataset.marca === 'x';
    renderCastTelas([{ rotulo: 'tela A' }, { rotulo: 'tela B' }]);
    const nova = Array.from(ul.children).find((li) => li.dataset.chave === 'tela B');
    out.entrou = !!nova && nova.classList.contains('entrando');
    renderCastTelas([{ rotulo: 'tela B' }]);
    const velha = Array.from(ul.children).find((li) => li.dataset.chave === '');
    out.saiu = !!velha && velha.classList.contains('saindo');
    return out;
  });
  checar(anim.porClasse && anim.temCasca,
    'o bloco do endereço abre por CLASSE (é o que dá altura animável), não por `hidden`');
  checar(anim.mesmaLinha,
    'a lista REAPROVEITA a linha que já estava lá — a enquete não a recria a cada 2,5 s');
  checar(anim.entrou, 'uma tela nova entra MARCADA para animar');
  checar(anim.saiu, 'e uma que saiu se recolhe antes de ser removida do documento');
  checar(erros2.length === 0,
    'nenhum erro de console no percurso com a transmissão ligada'
    + (erros2.length ? ':\n        ' + erros2.join('\n        ') : ''));
} catch (e) {
  checar(false, 'o percurso terminou sem exceção (' + (e && e.message) + ')');
}

// ---------------------------------------------------------------------------
// A METADE CONSUMIDORA DO `__tela` (v5.223)
//
// Uma tela da rede não tem o IndexedDB do celular: wallpaper, fundo da letra e
// preenchimento têm de ser REENVIADOS a ela quando conecta, e quem faz isso é
// `telaReenviarPreferencias`, disparado por `if (msg.__tela)` no
// `display-ready`. O produtor do campo é o `tela.js` e está travado no
// `tela-rede.test.mjs`; esta é a outra ponta.
//
// As duas existem porque foi a DIVERGÊNCIA entre elas que passou despercebida
// desde a v5.188: o consumidor exigia o campo, o produtor nunca o mandava, e
// não havia erro em lugar nenhum — só três preferências que não chegavam.
// Travar um lado só deixaria o par livre para divergir de novo.
try {
  const pg3 = await ctx.newPage();
  await pg3.addInitScript(ponteCom(
    { ligado: true, endereco: 'http://192.168.0.9:8787', erro: '',
      telas: [{ rotulo: 'A', comando: true, conectadaMs: 5000, telaAcesaMin: 0,
                aviso: '', eventos: 2, pronta: true, fila: 0 }] }, []));
  await pg3.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await pg3.waitForFunction(() => !!window.__avBack, null, { timeout: 20000 });
  // O operador tem "imagens" ligado, persistido de um culto anterior.
  await pg3.evaluate(() => window.AVDB.setState('lyricsBg', 'image'));
  await pg3.reload({ waitUntil: 'domcontentloaded' });
  await pg3.waitForFunction(() => !!window.__avBack, null, { timeout: 20000 });
  await pg3.waitForTimeout(600);

  // Uma tela da rede se anuncia — exatamente como o `tela.js` a anuncia.
  await pg3.evaluate(() => {
    window.__enviados = [];
    new BroadcastChannel('av-iasd').postMessage(
      { type: 'display-ready', __de: 'tela-1', __tela: 'tela-1', __mid: 'bn:1' });
  });
  await pg3.waitForTimeout(1200);
  const mandados = await pg3.evaluate(() => (window.__enviados || []).map((m) => m.type));
  checar(mandados.includes('lyricsbg'),
    'o display-ready com __tela faz o Controle reenviar o fundo da letra',
    'emitiu: ' + JSON.stringify(mandados));

  // E o CONTRÁRIO: o telão de verdade (sem `__tela`) não recebe esse reenvio —
  // ele lê tudo do IndexedDB sozinho, e mandar de novo seria ruído na conexão.
  await pg3.evaluate(() => {
    window.__enviados = [];
    new BroadcastChannel('av-iasd').postMessage(
      { type: 'display-ready', __de: 'telao-1', __mid: 'bn:2' });
  });
  await pg3.waitForTimeout(1000);
  const semTela = await pg3.evaluate(() => (window.__enviados || []).map((m) => m.type));
  checar(!semTela.includes('lyricsbg'),
    'e o display-ready SEM __tela (o telão de verdade) não dispara o reenvio',
    'emitiu: ' + JSON.stringify(semTela));
  await pg3.close();
} catch (e) {
  checar(false, 'o percurso do __tela terminou sem exceção (' + (e && e.message) + ')');
}

// ── A BÍBLIA BASE, SEM NINGUÉM ABRIR A ABA (v5.242) ──────────────────────
//
// O download da versão INTEIRA sempre existiu — e só era disparado por alguém
// ENTRAR na aba Bíblia. Quem nunca entrou ficava com o caminho sob demanda:
// um capítulo por vez, conforme o uso, com a rede da igreja no meio do culto
// como única rede disponível.
//
// O que se afirma aqui são as DUAS metades, e a segunda é o que impede a
// correção de virar outra coisa: (1) a varredura começa sozinha, sem toque
// nenhum na aba; (2) ela vai para a versão que o app GARANTE (a Almeida
// Revista e Atualizada), não para a que o operador escolheu — quem escolheu
// outra continua com a dele pelo caminho de sempre, e a base não vira refém
// dessa escolha.
//
// O banco é de mentira e as versões vêm com a ARA em SEGUNDO lugar de
// propósito: `pickDefaultBibleVersion` cai na primeira disponível quando não
// acha a ARA, e uma lista com ela na frente aprovaria os dois comportamentos.
try {
  const pg4 = await ctx.newPage();
  const ARA = 9, OUTRA = 7;
  const pedidos = [];
  const responder = (route, corpo) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(corpo),
  }).catch(() => {});
  await pg4.route('**/json_db/pt_bible_version*', (r) => responder(r, [
    { id_bible_version: OUTRA, name: 'Nova Versão Internacional' },
    { id_bible_version: ARA, name: 'Almeida Revista e Atualizada' },
  ]));
  await pg4.route('**/json_db/pt_bible_book*', (r) => responder(r,
    Array.from({ length: 66 }, (_, i) => ({ id_bible_book: i + 1, name: 'Livro ' + (i + 1) }))));
  await pg4.route('**/json_db/bible_*', (r) => {
    const m = /bible_(\d+)_(\d+)_(\d+)/.exec(r.request().url());
    if (m) pedidos.push({ versao: +m[1], livro: +m[2], cap: +m[3] });
    responder(r, { 1: 'No princípio criou Deus os céus e a terra.' });
  });
  // Esperar em Node (o contador é daqui), não na página: uma dúzia de
  // capítulos já prova que a varredura em massa está correndo — completar os
  // 1189 seria pagar meio minuto de roteamento por nada.
  const esperarCapitulos = async (quantos, ms) => {
    const ate = Date.now() + ms;
    while (pedidos.length < quantos && Date.now() < ate) await pg4.waitForTimeout(150);
    return pedidos.length;
  };

  await pg4.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await pg4.waitForFunction(() => !!window.__avBack, null, { timeout: 20000 });
  const veio = await esperarCapitulos(30, 25000);
  checar(veio >= 30,
    'A BÍBLIA BAIXA SOZINHA NA ABERTURA — sem ninguém abrir a aba (' + veio + ' capítulo(s))');
  checar(pedidos.length > 0 && pedidos.every((p) => p.versao === ARA),
    'e ela é a versão que o app garante (Almeida Revista e Atualizada), não a primeira da lista');
  // A aba nunca foi tocada: é isso que separa este caminho do `enterBibleTab`.
  checar(await pg4.evaluate(() => activeTab !== 'bible'),
    'e nada disso passou pela aba Bíblia — ela continua fechada');

  // A ESCOLHA DO OPERADOR NÃO É A BASE. Ele troca de versão; a base continua
  // sendo garantida, e a dele só desce quando ele abrir a aba.
  await pg4.evaluate((v) => window.AVDB.setState('bibleVersion', v), OUTRA);
  pedidos.length = 0;
  await pg4.reload({ waitUntil: 'domcontentloaded' });
  await pg4.waitForFunction(() => !!window.__avBack, null, { timeout: 20000 });
  const veio2 = await esperarCapitulos(12, 25000);
  // ESPERA A LEITURA DO ESTADO, e isto é um conserto de INSTABILIDADE (v5.252):
  // este caso reprovava em ~1 de cada 6 execuções. `bibleVersionId` é escrito
  // durante o `init()`, que lê o IndexedDB; os capítulos começam a descer no
  // mesmo `init()`, então esperar por eles NÃO garante que a leitura da
  // preferência já tenha acontecido — são duas coisas que correm juntas, e o
  // teste apostava numa ordem entre elas. Um teste que reprova sozinho de vez
  // em quando é pior que teste nenhum: ele ensina a ignorar vermelho, que é a
  // lição da v5.204.
  //
  // A espera falha em silêncio de propósito: se a preferência de fato não for
  // respeitada, quem reprova é a asserção abaixo — com o valor real na mão.
  try {
    await pg4.waitForFunction((v) => bibleVersionId === v, OUTRA, { timeout: 8000 });
  } catch (_) { /* a asserção abaixo dá o veredito */ }
  checar(await pg4.evaluate(() => bibleVersionId) === OUTRA,
    'a versão ESCOLHIDA pelo operador é outra (a seleção dele foi respeitada)');
  checar(veio2 > 0 && pedidos.every((p) => p.versao === ARA),
    'e mesmo assim quem baixa sozinha é a base — nenhum capítulo da escolhida sem abrir a aba');
  await pg4.close();
} catch (e) {
  checar(false, 'o percurso da Bíblia base terminou sem exceção (' + (e && e.message) + ')');
}

// ── O LINK DO YOUTUBE ENTRA NO AR COMO QUALQUER OUTRO ITEM (v5.269) ──────
// Relato do operador: *"um arquivo do tipo YouTube, que seria apenas um link,
// quando está no cronograma ou favoritos, pode ser tocado diretamente online no
// player, mas o respectivo elemento da lista não entra no modo 'no ar'."*
//
// A causa é uma assimetria entre os dois caminhos de `resolverLinkYoutube`
// (v5.212). Pelo DOWNLOAD o arquivo toma o lugar do link EM POSIÇÃO, então a
// linha passa a ter o id da mídia e o `midiaNoArId` de sempre a alcança. Pela
// TRANSMISSÃO DIRETA, não: a mídia é um avulso com id próprio, o link continua
// na lista com o id dele, e nada ligava os dois.
//
// E não era só o realce: `noArAgora` responde pela MESMA pergunta, então o
// SEGUNDO TOQUE (que retira do ar) também não alcançava aquela linha — ela
// reprojetava em vez de retirar, que é o defeito que a v5.165 existiu para
// consertar, reaberto por outra porta. Por isso as duas metades são medidas.
//
// Este caso mora AQUI, e não no `cena.test.mjs`, por uma razão dura:
// `resolverLinkYoutube` devolve na primeira linha quando não há ponte
// (`window.__NATIVE__`), e o `cena` sobe a base sem ela.
//
// O `tentarTransmitir` é SUBSTITUÍDO por um que faz o que o de verdade faz no
// fim — `send(<id do avulso>)` —, porque é justamente essa chamada que zera a
// origem: um teste que pulasse o `send` aprovaria uma ordem de atribuição
// errada, que é o único jeito de errar isto.
try {
  const pg5 = await ctx.newPage();
  await pg5.addInitScript(PONTE);
  await pg5.goto(`http://127.0.0.1:${porta}/controle/`, { waitUntil: 'load' });
  await pg5.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function',
    null, { timeout: 20000 });
  await pg5.evaluate(() => setAppMode('full'));

  const r = await pg5.evaluate(async () => {
    // O AVULSO que a transmissão criaria, e o LINK que fica na lista.
    const avulso = await AVDB.addMedia(new Blob([new Uint8Array(8)], { type: 'video/mp4' }),
      { name: 'Vídeo transmitido', type: 'video/mp4', kind: 'video', list: 'avulsos' });
    // O link é criado como o app o cria (`addUrlMedia`, ver `ytAcao` com
    // `YT_ONLINE`): um registro SEM bytes. Foi essa a primeira versão errada
    // deste caso — `addMedia(null, …)` lê `blob.type` e estoura.
    const link = await AVDB.addUrlMedia('https://www.youtube.com/watch?v=abc12345678', {
      kind: 'youtube', type: 'video/youtube', name: 'Link do YouTube',
      youtubeId: 'abc12345678', list: 'imports',
    });
    await load();
    // eslint-disable-next-line no-func-assign
    window.tentarTransmitir = async () => { await send(avulso.id); return true; };
    const rec = await AVDB.getMedia(link.id);
    await resolverLinkYoutube(rec);
    await new Promise((x) => setTimeout(x, 250));
    const li = document.querySelector('.lib-item[data-id="' + link.id + '"]');
    return {
      linkId: link.id, avulsoId: avulso.id,
      // A mídia no ar é o AVULSO — a origem não pode ter trocado isso.
      noArId: midiaNoArId,
      realce: linhaNoAr(link.id),
      // O segundo toque: ele decide entre projetar e retirar.
      segundoToque: noArAgora(rec),
      classe: !!li && li.classList.contains('no-ar'),
      selo: !!li && !!li.querySelector('.row-live'),
      // E o AVULSO continua sendo o que está no ar de fato.
      avulsoTambem: linhaNoAr(avulso.id),
    };
  });
  checar(r.noArId === r.avulsoId,
    'a mídia no ar continua sendo o AVULSO da transmissão — a origem não troca '
    + 'quem está no telão', r.noArId);
  checar(r.realce && r.classe,
    'e a LINHA DO LINK entra em "no ar", como qualquer outro item que foi ao '
    + 'telão', JSON.stringify({ realce: r.realce, classe: r.classe }));
  checar(r.selo,
    'com o selo "● No ar" junto — o estado que se LÊ, não só a cor');
  checar(r.segundoToque,
    'e o SEGUNDO TOQUE nela retira do ar em vez de reprojetar — sem esta metade '
    + 'o realce diria uma coisa e o gesto faria outra');

  // ---- E A ORIGEM CAI COM A MÍDIA -------------------------------------
  // Sem isto a linha do link ficaria marcada para sempre: `midiaNoArOrigem` só
  // é escrita neste caminho, e quem a limparia é justamente quem tira do ar.
  const depois = await pg5.evaluate(async (x) => {
    await pararMidia('media-clear');
    marcarNoAr();
    const li = document.querySelector('.lib-item[data-id="' + x + '"]');
    return { realce: linhaNoAr(x), classe: !!li && li.classList.contains('no-ar') };
  }, r.linkId);
  checar(!depois.realce && !depois.classe,
    'e ela SAI do ar quando a mídia sai — a marca não sobrevive ao Parar',
    JSON.stringify(depois));

  // ---- E UM PLAY NORMAL NÃO A HERDA -----------------------------------
  // `send` zera a origem, e é ele que todo play atravessa. Sem essa linha, uma
  // música tocada depois deixaria a linha do link marcada como "no ar".
  const outro = await pg5.evaluate(async (x) => {
    const m = await AVDB.addMedia(new Blob([new Uint8Array(8)], { type: 'audio/mpeg' }),
      { name: 'Outra música', type: 'audio/mpeg', kind: 'audio', list: 'imports' });
    await load();
    await send(m.id);
    await new Promise((r2) => setTimeout(r2, 150));
    return { link: linhaNoAr(x), nova: linhaNoAr(m.id) };
  }, r.linkId);
  checar(!outro.link && outro.nova,
    'e um play NORMAL depois dela não herda a origem — quem está no ar é a '
    + 'mídia nova', JSON.stringify(outro));
  await pg5.close();
} catch (e) {
  checar(false, 'o percurso do link do YouTube terminou sem exceção (' + (e && e.message) + ')');
}

// ── OS FAVORITOS: EXCLUIR NA LINHA, GUIA NO LUGAR, SEM MULTISSELEÇÃO ─────
// Três relatos do operador, e os três moram nesta lista:
//
//   · *"adicione a opção de excluir nas opções nos itens individuais das listas
//     de cronograma e favoritos"*;
//   · *"as linhas de guia para a posição final dos itens está completamente
//     fora de sincronia e posição com a lista"*;
//   · *"ao segurar em um item da lista de favoritos, ele entra no modo de
//     multiseleção, mas as opções aparecem na tela do cronograma"*.
//
// O caso mora aqui porque a lista dos Favoritos é desenhada DENTRO da
// Biblioteca (v5.237), e a Biblioteca é a tela que só existe com a ponte.
try {
  const pg6 = await ctx.newPage();
  await pg6.addInitScript(PONTE);
  await pg6.goto(`http://127.0.0.1:${porta}/controle/`, { waitUntil: 'load' });
  await pg6.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function',
    null, { timeout: 20000 });

  const fav = await pg6.evaluate(async () => {
    setAppMode('full');
    const ids = [];
    for (let i = 1; i <= 4; i++) {
      const m = await AVDB.addMedia(new Blob([new Uint8Array(8)], { type: 'audio/mpeg' }),
        { name: 'Favorito ' + i, type: 'audio/mpeg', kind: 'audio', list: 'imports' });
      await AVDB.listAdd('favs', m.id);
      ids.push(m.id);
    }
    await load();
    openHymnSearch();
    await new Promise((r) => setTimeout(r, 400));
    const corpo = document.querySelector('[data-fav-corpo]');
    const li = corpo && corpo.querySelector('.lib-item[data-id="' + ids[0] + '"]');
    const ul = li && li.parentElement;
    if (!ul) return { erro: 'a lista dos favoritos não foi desenhada' };

    // ---- O PAR ↑↓ MOVE, E A ORDEM É A DA LISTA (v5.285) ----
    // O caso da LINHA-GUIA do arrasto (v5.272) morava aqui e saiu com ele: não
    // há mais posicionamento absoluto a conferir. O que ficou é a pergunta que
    // importa e que sobrevive à troca de gesto — o item foi para onde o botão
    // prometeu —, medida na lista de VERDADE e pelo botão de verdade.
    const descer = () => {
      const alvo2 = corpo.querySelector('.lib-item[data-id="' + ids[0] + '"]');
      const bs = alvo2.querySelectorAll('.row-ordem');
      bs[1].click();
    };
    descer();
    await new Promise((r) => setTimeout(r, 300));
    const ordemDepois = (await AVDB.listIds('favs')).indexOf(ids[0]);
    // E A GAVETA REABRE no item que se moveu, com o ↓ de novo sob o dedo — sem
    // isto cada casa custaria reabrir o menu à mão, que é o que tornaria uma
    // sequência de toques insuportável. Medido aqui, e não no caso da lista
    // solta: `redesenharFavoritosNaBiblioteca` desiste com a Biblioteca fechada,
    // e é só aqui que ela está aberta de verdade.
    const reaberta = document.querySelector('[data-fav-corpo] .lib-item.acoes-abertas');
    const reabriu = !!reaberta && reaberta.dataset.id === ids[0];

    // ---- O TOQUE LONGO não liga modo nenhum ----
    const row = li.querySelector('.row');
    const ev = (t) => row.dispatchEvent(new PointerEvent(t,
      { bubbles: true, clientX: 10, clientY: 10, pointerId: 1 }));
    ev('pointerdown');
    await new Promise((r) => setTimeout(r, 900));   // bem além do LONGPRESS
    const modo = selectionMode;
    ev('pointercancel');

    return {
      ordemDepois, reabriu,
      modo,
      temExcluir: !!li.querySelector('.row-excluir'),
      ids,
    };
  });
  checar(!fav.erro, 'a lista dos Favoritos foi desenhada na Biblioteca', fav.erro);
  checar(fav.ordemDepois === 1,
    'o ↓ da gaveta MOVE o item uma casa na lista de verdade (v5.285)',
    'o primeiro foi para o índice ' + fav.ordemDepois);
  checar(fav.reabriu,
    'e a gaveta REABRE no item que se moveu: o botão continua sob o mesmo dedo '
    + 'para a casa seguinte');
  checar(fav.modo === false,
    'e o toque longo NÃO liga a seleção múltipla aqui: ela nunca se desenhou '
    + 'nesta lista, e a barra dela ia parar na tela do Cronograma');
  checar(fav.temExcluir,
    'o que aquele modo daria — excluir sem sair da lista — está no `⋮`, um toque');

  // ---- E O EXCLUIR TIRA DA LISTA, sem levar o que está em outra ----
  const saiu = await pg6.evaluate(async (ids) => {
    // O primeiro está SÓ nos favoritos; o segundo está também no Cronograma.
    const alvo = ids[0];
    const corpo = document.querySelector('[data-fav-corpo]');
    const li = corpo.querySelector('.lib-item[data-id="' + alvo + '"]');
    li.querySelector('.row-mais').click();
    await new Promise((r) => setTimeout(r, 250));
    li.querySelector('.row-excluir').click();
    await new Promise((r) => setTimeout(r, 200));
    document.getElementById('appDialogOk').click();
    await new Promise((r) => setTimeout(r, 400));
    return {
      naLista: !!document.querySelector('[data-fav-corpo] .lib-item[data-id="' + alvo + '"]'),
      nosFavs: (await AVDB.listIds('favs')).includes(alvo),
      // Ele estava no Cronograma também (`imports`), e de lá NÃO sai: excluir é
      // desta lista, e o gc só apaga o que não está em mais nenhuma.
      noCronograma: (await AVDB.listIds('imports')).includes(alvo),
    };
  }, fav.ids);
  checar(!saiu.naLista && !saiu.nosFavs,
    'o excluir do `⋮` tira o item DESTA lista', JSON.stringify(saiu));
  checar(saiu.noCronograma,
    'e NÃO o tira das outras — "excluir" aqui é sair da lista, não apagar os '
    + 'bytes de quem ainda os segura', JSON.stringify(saiu));
  await pg6.close();
} catch (e) {
  checar(false, 'o percurso dos Favoritos terminou sem exceção (' + (e && e.message) + ')');
}

checar(erros.length === 0, 'nenhum erro de console' + (erros.length ? ':\n        ' + erros.join('\n        ') : ''));

await navegador.close();
servidor.close();
console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
