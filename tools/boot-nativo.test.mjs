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
        { name: 'Provai e Vede Agosto 2026', url: 'p/ago', count: 2 },
        { name: 'Provai e Vede - Julho 2026', url: 'p/jul', count: 1 },
        { name: 'Semana de Mordomia Cristã 2026', url: 'p/outra', count: 9 },
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
        'd/pt4': { name: 'Informativo | 4º Trimestre 2026', author: 'Daniel Gonçalves', items: [
          { id: 'bbbbbbbbbb4', url: 'd/4', name: 'Informativo Mundial das Missões | 03 OUTUBRO 2026', seconds: 170 },
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
  checar((info.itens || []).slice(0, 3).join(' ~ ') === '04/Jul ~ 15/Ago ~ 03/Out',
    'os episódios vêm em ordem CRONOLÓGICA e rotulados só pela DATA — o resto do '
    + 'título é igual nos 52 e não distingue nada', JSON.stringify(info.itens));
  checar((info.itens || [])[3] === 'Informativo Mundial das Missões | especial de encerramento',
    'o que não declarou data ENTRA, com o título CRU e no fim do trimestre dele — '
    + 'nunca uma linha em branco', JSON.stringify(info.itens));
  checar((info.urls || []).join(',') === 'd/3,d/1,d/4,d/5',
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
  checar(/\n    04\/Jul\n/.test(reg) && /\n    15\/Ago\n/.test(reg),
    'um por linha: o rótulo tem " · " e o título cru tem " | ", então nenhum separador serviria');
  checar(/aba do canal \(há \d+ s\)/.test(reg) && /vídeos \(varredura há \d+ s\)/.test(reg),
    'as DUAS metades trazem a própria data — a assinatura pula a extração e só uma delas é de agora');
  checar(!/undefined|NaN|\[object Object\]/.test(reg),
    'e nada de "undefined" no meio de um log que vai ser repassado');

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
    gruposAbertos.add('Hinários e séries');
    renderCollectionsList(lista, () => {}, { semTotal: true });
    const grupos = [...lista.querySelectorAll('.coll-group-name')].map((e) => e.textContent.trim());
    const linhas = [...lista.children].map((li) => (li.className.includes('coll-group')
      ? 'GRUPO: ' + li.textContent.trim().split('\n')[0]
      : 'card: ' + li.textContent.trim().split('\n')[0]));
    gruposAbertos.delete('Hinários e séries');
    return {
      texto: lista.textContent,
      grupos,
      // O grupo em que o card da série de fato vive.
      grupoDaSerie: (() => {
        const card = [...lista.querySelectorAll('.hymnal-card')]
          .find((el) => /Provai e Vede 2026/.test(el.textContent));
        const g = card && card.closest('.coll-group');
        return g ? (g.querySelector('.coll-group-name') || {}).textContent : '';
      })(),
      posSerie: linhas.findIndex((l) => l.includes('Provai e Vede 2026')),
    };
  });
  checar(/Provai e Vede 2026/.test(naTela.texto),
    'O CARD DA SÉRIE APARECE NA BIBLIOTECA — era este o "não estou achando nada"');
  checar(/Hinários e séries/.test(naTela.grupoDaSerie || ''),
    'e ele fica no grupo das FIXAS, junto dos hinários', naTela.grupoDaSerie);
  checar(naTela.grupos[0] === 'Favoritos' && naTela.grupos[1] === 'Hinários e séries',
    'que vem logo abaixo dos Favoritos, antes de qualquer álbum — o topo é o topo',
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
    await syncCollection(c, { soIndice: true });
    return { antes, refeito, deNovo: window.__nPlaylist || 0, nomeDepois };
  });
  checar(preso.refeito > preso.antes && !/REGRA VELHA/.test(preso.nomeDepois),
    'a regra nova REFAZ o índice guardado — era isto que deixava o episódio sem '
    + 'data e fora de ordem ("' + preso.nomeDepois + '")');
  checar(preso.deNovo === preso.refeito,
    'e com a regra e o canal em dia nada é reextraído: a economia continua de pé');

  // ── O EPISÓDIO É UM VÍDEO DO YOUTUBE (v5.230) ──────────────────────────
  // Pedido do operador: as opções de um item da série devem ser as do YouTube
  // (sem "só áudio"), sem download direto, e com transmissão no "Tocar agora".
  // A v5.228 o tratava como faixa de hinário — o toque BAIXAVA ~300 MB.
  const folha = await pg.evaluate(async () => {
    const c = allCollections().find((x) => x.kind === 'serie');
    const s = collSongs(c.id)[0];
    openSongMenu(c, s, 'play');
    const pop = document.getElementById('songMenuPopup');
    const linhas = [...pop.querySelectorAll('.song-menu-item, .song-menu-list button')]
      .map((b) => b.textContent.trim().split('\n')[0].trim()).filter(Boolean);
    const r = {
      aberta: pop.classList.contains('open'),
      titulo: (document.getElementById('songMenuTitle') || {}).textContent || '',
      texto: pop.textContent,
      linhas,
    };
    closeSongMenu();
    return r;
  });
  checar(folha.aberta, 'tocar num episódio abre a folha de destinos');
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
    gruposAbertos.add('Hinários e séries');   // fechados por padrão desde a v5.237
    renderCollectionsList(lista, () => {}, { semTotal: true });
    const cards = [...lista.querySelectorAll('.hymnal-card')];
    const card = cards.find((el) => /Provai e Vede 2026/.test(el.textContent));
    const r = {
      achou: !!card,
      temBotaoBaixar: !!(card && card.querySelector('.coll-bar-dl')),
    };
    gruposAbertos.delete('Hinários e séries');
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
    gruposAbertos.clear();
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
    // A SEÇÃO FIXA, medida com todo o resto fechado.
    const gFav = [...lista.querySelectorAll('.coll-group')]
      .find((g) => /Favoritos/.test((g.querySelector('.coll-group-name') || {}).textContent || ''));
    const barraFav = gFav && gFav.querySelector('.coll-group-bar');
    const corpoFav = gFav && gFav.querySelector('.coll-group-corpo');
    if (barraFav) barraFav.click();   // não pode fechar nada
    const fixo = {
      temSeta: !!(gFav && gFav.querySelector('.coll-group-seta')),
      corpoVisivel: !!(corpoFav && corpoFav.getBoundingClientRect().height > 0),
      cliqueNaoFecha: !!(gFav && gFav.classList.contains('aberto')),
    };
    const fechado = {
      grupos,
      cards: lista.querySelectorAll('.hymnal-card').length,
      // A altura do índice inteiro contra a de um grupo aberto: é ela que o
      // pedido chama de "listagem mais curta", e medir o número de nós não
      // diria a mesma coisa.
      altura: lista.getBoundingClientRect().height,
    };
    // O TOQUE no cabeçalho do grupo das fixas.
    const barra = [...lista.querySelectorAll('.coll-group-bar')]
      .find((b) => /Hinários/.test(b.textContent));
    barra.click();
    await new Promise((r) => setTimeout(r, 50));
    const aberto = {
      cards: lista.querySelectorAll('.hymnal-card').length,
      temSerie: /Provai e Vede 2026/.test(lista.textContent),
      altura: lista.getBoundingClientRect().height,
      // O card vive DENTRO do corpo do grupo, não solto na lista: é isso que
      // faz a árvore ser uma árvore.
      dentroDoCorpo: !!lista.querySelector('.coll-group-corpo .hymnal-card'),
    };
    lista.remove();
    gruposAbertos.clear();
    return { fechado, aberto, fixo };
  });
  checar(indice.fechado.grupos.length >= 2 && indice.fechado.cards === 0,
    'A BIBLIOTECA ABRE COMO ÍNDICE: só os cabeçalhos de seção, nenhum card '
    + 'construído', JSON.stringify(indice.fechado.grupos));
  checar(indice.fechado.grupos[0] === 'Favoritos',
    'e o primeiro deles é FAVORITOS, no topo da listagem',
    JSON.stringify(indice.fechado.grupos));
  // ── E OS FAVORITOS NÃO COLAPSAM (v5.238) ───────────────────────────────
  // Pedido do operador: *"mantenha os favoritos como uma seção sempre aberta."*
  // Eles são o atalho de quem já procurou antes, e um atalho atrás de um toque
  // a mais deixa de ser atalho. As duas metades: o corpo está lá com todos os
  // outros grupos fechados, **e** não há como fechá-lo por engano.
  checar(indice.fixo.corpoVisivel,
    'e a seção de FAVORITOS já vem aberta, com os outros grupos todos fechados');
  checar(!indice.fixo.temSeta && indice.fixo.cliqueNaoFecha,
    'sempre aberta: sem seta e sem alternar no toque — um cabeçalho que parece '
    + 'tocável e não faz nada é pior que um rótulo');
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
    gruposAbertos.clear();   // a seção de Favoritos é FIXA: não depende disto
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
    // A FOLHA que o botão abre.
    grupo.querySelector('.coll-group-acao').click();
    const pop = document.getElementById('songMenuPopup');
    const linhas = [...pop.querySelectorAll('.song-menu-label')].map((e) => e.textContent.trim());
    r.folha = {
      linhas,
      criar: linhas.some((t) => /Criar uma pasta/i.test(t)),
      doAparelho: linhas.some((t) => /pasta do aparelho/i.test(t)),
    };
    closeSongMenu();
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
    gruposAbertos.clear();
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
  checar(favs.folha.criar && favs.folha.doAparelho,
    'e o toque nela abre a folha com as DUAS origens: criar uma pasta ou trazer '
    + 'uma do aparelho', JSON.stringify(favs.folha.linhas));
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
    gruposAbertos.add('Hinários e séries');   // fechados por padrão desde a v5.237
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
    gruposAbertos.delete('Hinários e séries');
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
  checar(await pg4.evaluate(() => bibleVersionId) === OUTRA,
    'a versão ESCOLHIDA pelo operador é outra (a seleção dele foi respeitada)');
  checar(veio2 > 0 && pedidos.every((p) => p.versao === ARA),
    'e mesmo assim quem baixa sozinha é a base — nenhum capítulo da escolhida sem abrir a aba');
  await pg4.close();
} catch (e) {
  checar(false, 'o percurso da Bíblia base terminou sem exceção (' + (e && e.message) + ')');
}

checar(erros.length === 0, 'nenhum erro de console' + (erros.length ? ':\n        ' + erros.join('\n        ') : ''));

await navegador.close();
servidor.close();
console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
