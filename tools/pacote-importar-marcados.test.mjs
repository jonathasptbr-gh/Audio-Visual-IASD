#!/usr/bin/env node
// ============================================================================
// A SELEÇÃO DA JANELA DO TRANSFERIR VALE TAMBÉM PARA IMPORTAR (v1.11.12)
//
// Pedido do operador, verbatim: *"No caso os itens selecionados, são os itens que
// ele de fato vai importar. Por exemplo, mesmo que o pacote recebido tenha a
// biblioteca inteira disponível para importação. Se eu selecionar apenas o
// hinário, ele vai importar apenas o hinário desse pacote e como sempre, vai
// consumir o arquivo. Assim a listagem tem função em ambos os processos"*.
//
// O CENÁRIO É O REAL (como o `pacote-ida-e-volta`): dois CONTEXTOS de navegador, o
// primeiro semeia e exporta, os bytes voltam para o Node e entram nos seguintes.
// O que se afirma é o que o aparelho DE DESTINO tem depois, e cada caso falha CALADO:
//
//  A. SÓ O HINÁRIO MARCADO: chega o hinário (arquivos e catálogo) e MAIS NADA — nem
//     o outro hinário, nem a mídia; os ajustes e catálogos (fixos) chegam, porque
//     são eles que fazem os arquivos aparecerem na Biblioteca. O arquivo é
//     consumido como sempre, e a frase diz o que ficou de fora.
//  B. TUDO MARCADO (o padrão): o pacote inteiro, como antes — sem filtro nenhum.
//  C. SÓ FAVORITOS MARCADO: a mídia vem pelo GRUPO que a contém (a lista do PRÓPRIO
//     pacote), com a miniatura; a que não é favorita e os hinários ficam fora.
//  D. UM APARELHO NOVO TEM O QUE MARCAR: os hinários e as séries aparecem na lista
//     (os hinários com "nada baixado neste aparelho", as séries com "sem vídeo da
//     semana baixado"), senão a seleção não teria função onde a importação mais acontece.
//
// E AS SÉRIES (v1.11.14). Pedido do operador: *"na exportação, em específico do
// informativo e do provai e vede, faça ele exportar apenas o vídeo da semana. E
// verifique que atualmente ele diz 'nada baixado neste aparelho', provavelmente se
// referindo à lista completa, que não vamos usar na exportação"*:
//  E. A LINHA DA SÉRIE É O VÍDEO DA SEMANA: na origem ela diz "vídeo da semana" (ou
//     "último vídeo baixado", quando o retido não é o desta semana) com o peso do
//     EPISÓDIO — nunca "nada baixado neste aparelho", que falava da lista completa.
//  F. SÓ O VÍDEO VIAJA: os dois episódios retidos entram no destino, e o arquivo
//     que sobrou na pasta antiga do álbum (`folders/<série>/`) NÃO — nem os bytes,
//     nem o catálogo dele.
//  G. DESMARCAR A SÉRIE NA EXPORTAÇÃO tira o episódio do pacote — ele não pode cair
//     em "Outros itens", que seguiria marcado e o levaria de qualquer jeito.
//  H. NA IMPORTAÇÃO, o episódio entra pelo grupo da SÉRIE (o pacote o nomeia): só a
//     série marcada traz o vídeo dela, e as outras mídias não vêm.
//  I. SEM EPISÓDIO RETIDO a linha diz "sem vídeo da semana baixado" (sem peso) e o
//     arquivo velho da pasta do álbum não viaja mesmo com tudo marcado.
//
//   node tools/pacote-importar-marcados.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperar, porque, checar, falhas } from './arnes.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..', 'app', 'src', 'main', 'assets', 'web');
// ===== O ARQUIVO ESCOLHIDO É SERVIDO POR JANELA (v1.7.9) =====
//
// No aparelho o `.avpkg` chega como uma `/saf/<token>` e o lado web o lê em
// FATIAS (`?r=<ini>-<fim>`), porque o caminho antigo — `resp.blob()` — não
// existe mais: ele materializava o arquivo inteiro, e quinze gigabytes não
// cabem em lugar nenhum.
//
// A ROTA DAQUI FALA O MESMO CONTRATO do `SafJanela.kt`, e é isso que a torna
// uma prova: um servidor de mentira mais permissivo que o de verdade aprovaria
// um leitor que o aparelho recusa. Um `blob:` — que era o que este oráculo
// entregava — não tem query nenhuma, e por ele o leitor novo nem sairia do
// lugar.
// O `AVPacote.ASSINATURA_BYTES`, repetido aqui porque o bloco 5-B monta um
// pacote SINTÉTICO em Node, fora da página que tem o módulo.
const AVPACOTE_ASSINATURA = 8;
let pacoteServido = null;   // Uint8Array — o arquivo que o "aparelho B" escolhe
// O DIÁRIO DA LEITURA. É por ele que o bloco 5 mede o que não tem sintoma:
// quantas janelas foram pedidas, de que tamanho, e se alguém pediu o arquivo
// SEM faixa — que é o `resp.blob()` de volta.
let janelas = [];
let semFaixa = 0;
const zerarDiario = () => { janelas = []; semFaixa = 0; };
const bytesLidos = () => janelas.reduce((t, j) => t + (j.fim - j.ini + 1), 0);
/**
 * A fonte devolve janelas CURTAS nas leituras de CORPO. `false` desliga.
 *
 * O corte é por TAMANHO PEDIDO, e isso é o que isola a guarda que se quer
 * medir: a CONFERÊNCIA lê só cabeçalhos, em janelas de 8 kB (`bytes()`), e ela
 * tem a guarda desde sempre — encurtar tudo faz ela pegar o defeito primeiro e
 * o oráculo passa a medir o percurso errado (MEDIDO: a reversão não reprovava).
 * Os corpos vêm por `blob()`, em pedaços grandes, e é essa a leitura que não
 * conferia nada.
 */
let curtoNosCorpos = false;

const servidor = servirEstatico(RAIZ, (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname !== '/pacote-de-teste') return false;
  if (!pacoteServido) { res.writeHead(404).end('sem pacote'); return true; }
  const m = /^(\d+)-(\d+)$/.exec(u.searchParams.get('r') || '');
  if (!m) { semFaixa++; res.writeHead(416).end('sem faixa'); return true; }
  const ini = Number(m[1]);
  const fim = Number(m[2]);
  if (fim < ini) { res.writeHead(416).end('faixa invertida'); return true; }
  janelas.push({ ini, fim });
  // A FONTE QUE DEVOLVE MENOS DO QUE SE PEDIU (v1.8.15).
  //
  // Não é um servidor inventado: é o `SafJanela.ler`, que corta no que
  // conseguiu (`buf.copyOf(lidos)`), e o caso que o torna provável é o novo
  // caminho de uso — o arquivo chega por Quick Share e APARECE em Downloads
  // antes de terminar de ser escrito. O `size` já responde o valor final.
  let fatia = pacoteServido.subarray(ini, Math.min(pacoteServido.length, fim + 1));
  if (curtoNosCorpos && fim - ini > 65536 && fatia.length > 1) {
    fatia = fatia.subarray(0, fatia.length - 1);
  }
  res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(Buffer.from(fatia));
  return true;
});

// ---------------------------------------------------------------------------
// A PONTE, com o CANAL DE BYTES de mentira
//
// Ele é o `PacoteCanal.kt` reduzido ao que o lado web enxerga: recebe
// `ArrayBuffer`, acumula, e responde `{r: total}` — que é o ACK que libera o
// bloco seguinte. Sem responder, o empurrão para no primeiro bloco e o oráculo
// mediria o próprio arnês.
// ---------------------------------------------------------------------------
const PONTE = `(function () {
  window.__progresso = [];
  window.__saida = [];
  const canal = {
    postMessage(m) {
      if (typeof m === 'string') {
        setTimeout(() => canal.onmessage({ data: JSON.stringify({ ok: true }) }), 0);
        return;
      }
      window.__saida.push(new Uint8Array(m));
      let total = 0;
      for (const p of window.__saida) total += p.length;
      setTimeout(() => canal.onmessage({ data: JSON.stringify({ r: total }) }), 0);
    },
    onmessage: null,
  };
  window.__avPacote = canal;

  const vazio = { displays: [], listFolder: [], otaPending: '', otaDiag: '',
    espelhoEstado: { ligado: false, telas: [], redes: [] }, espelhoDiag: {},
    castTarget: { label: '' }, apkProcurar: {}, ytDiag: '', cifraDiag: '',
    farolEstado: { conta: true, ultimo: 0, diag: 'de teste' } };
  const comCallId = new Set(['displays','listFolder','pickDoc','pickFolder','ytSearch','ytFetch',
    'ytFetchAte','ytFetchAudio','ytStream','deckPages','deckExportUrl','castTarget','saidaDeAudioAlvo',
    'espelhoEstado','espelhoDiag','espelhoCertEstado','apkProcurar','otaPending','otaApply',
    'otaCheck','otaDiag','ytDiag','cifraDiag','farolEstado','ytCanalPlaylists','ytPlaylist',
    'ytDetalhes','areaTransferencia','salvarTexto','pacoteConsumirOrigem',
    // Os cinco de baixo NÃO são tocados por este oráculo, e é justamente por
    // isso que entram: fora da allowlist, um undefined prende quem os chamar
    // pelos 60 s do CALL_TIMEOUT_MS — sem erro, sem log, só lentidão. Foi o
    // que custou 60,0 s ao abertura-e-transferencia (ver o CLAUDE.md).
    'pacoteDiag','cifraHtml','apkInstalar','espelhoCertImportar','espelhoCertApagar',
    ]);
  const B = {
    shellVersion: () => 63,
    role: () => 'controle',
    appVersion: () => '9.99-teste',
    takeShare: () => '',
    busPost: () => {},
    // O QUE A NOTIFICAÇÃO DO SISTEMA RECEBEU — a mesma sonda do
    // pacote-por-grupos. É por ela que o bloco 13 lê a ETAPA e a LISTA.
    //
    // SEM CRASE EM COMENTÁRIO NENHUM DAQUI PARA BAIXO: esta ponte inteira é um
    // template literal, e uma crase dentro dele o TERMINA — o que sai é um
    // SyntaxError a dezenas de linhas de distância.
    bgProgress: (s) => {
      try {
        const p = JSON.parse(s);
        window.__progresso.push(p);
        // E TAMBÉM NO sessionStorage, porque a importação termina num
        // location.reload() — que é parte do recurso — e leva a variável de
        // módulo junto. Ler antes da recarga seria uma corrida contra ela.
        const k = 'progresso-do-teste';
        const a = JSON.parse(sessionStorage.getItem(k) || '[]');
        a.push({ label: p.label || '', item: (p.items || [])[0] || '',
          done: p.done || 0, total: p.total || 0 });
        sessionStorage.setItem(k, JSON.stringify(a));
      } catch (e) {}
    },
    otaConfirm: () => {},
    compartilharTexto: () => {},
    pacoteCancelar: () => { window.__cancelado = (window.__cancelado || 0) + 1; },
    // O CONSUMO DO ARQUIVO IMPORTADO (v1.8.28). Ele guarda a URL pedida, e o
    // desfecho vem do teste: \`window.__consumoErro\` vazio = apagou.
    pacoteConsumirOrigem: (id, url) => {
      window.__consumiu = (window.__consumiu || []);
      window.__consumiu.push(url);
      setTimeout(() => window.__avResolve(id, window.__consumoErro || ''), 0);
    },
    pacoteCriar: (id) => {
      setTimeout(() => window.__avResolve(id, 'acervo-de-teste.avpkg'), 0);
    },
    pacoteFechar: (id) => {
      let total = 0;
      for (const p of (window.__saida || [])) total += p.length;
      // O SINAL DE QUE A ESCRITA ACABOU (v1.8.19). O desfecho da exportação
      // deixou de ser um diálogo, e é por este ponto — a última chamada de
      // ponte do percurso — que o oráculo sabe que pode medir o botão.
      window.__fechou = true;
      setTimeout(() => window.__avResolve(id, total), 0);
    },
    // O ARQUIVO ESCOLHIDO na importação. No aparelho ele é uma
    // \`/saf/<token>\` que o shell serve POR JANELA; aqui é a rota do próprio
    // servidor do oráculo, que fala o mesmo contrato.
    //
    // O \`size\` ENTROU NO SHELL 64 e é obrigatório: sem ele o leitor não sabe
    // onde o arquivo acaba. \`-1\` é "o provedor não disse", e o app para com
    // frase própria — é o que o bloco 5 mede.
    pickDoc: (id) => {
      const tam = window.__tamEntrada;
      const achou = typeof tam === 'number';
      setTimeout(() => window.__avResolve(id, achou
        ? [{ url: '/pacote-de-teste', name: 'acervo-de-teste.avpkg', type: '', size: tam }]
        : []), 0);
    },
  };
  const nomes = ['apkInstalar','apkProcurar','bgProgress','captureVolumeKeys','castTarget','saidaDeAudioAlvo',
    'deckDiscard','deckExportUrl','deckPages','displays','espelhoCertApagar','espelhoCertEstado',
    'espelhoCertImportar','espelhoDesligar','espelhoDiag','espelhoEstado','espelhoLigar',
    'keepAlive','listFolder','nowPlaying','openCast','abrirSaidaDeAudio','openExternal','otaApply','otaCheck',
    'otaDiag','otaPending','pickFolder','systemVolume','temaClaro',
    'ytCancel','ytCanalPlaylists','ytDiag','ytDiscard','ytFetch','ytFetchAte','ytFetchAudio',
    'ytPlaylist','ytSearch','ytStream','farolEstado','projecaoLocal','cifraHtml',
    'cifraDiag','areaTransferencia','salvarTexto','pacoteDiag','ytDetalhes',
  ];
  for (const n of nomes) {
    if (B[n]) continue;
    B[n] = (...args) => {
      if (!comCallId.has(n)) return undefined;
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
const base = `http://localhost:${porta}`;
const navegador = await abrirNavegador();

const erros = [];
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY|ERR_FAILED/;
async function aparelho(entrada) {
  const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true });
  await semRedeExterna(ctx);
  const pg = await ctx.newPage();
  pg.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (EXTERNO.test(t) || /Failed to load resource/.test(t)) return;
    erros.push(t);
  });
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await pg.addInitScript(PONTE);
  if (entrada) {
    pacoteServido = Uint8Array.from(entrada);
    await pg.addInitScript(`window.__tamEntrada = ${entrada.length};`);
  }
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await esperar(pg, () => !document.getElementById('splash'), null, 30000);
  return { ctx, pg };
}

// O diálogo do fim é MODAL e a Promise dele só resolve num toque. Quem opera
// aperta "Entendi"; aqui o oráculo faz o mesmo, pelo botão de verdade.
// O FIM DA EXPORTAÇÃO, e ele deixou de ser um DIÁLOGO (v1.8.19). O popup
// "Acervo exportado" saiu a pedido do operador, e quem responde agora é o
// próprio botão: no caminho do SAF — que é o destes cenários, porque a ponte
// de mentira não tem `pacoteEspaco` e a conta cai no zero — ele empresta o
// título para o TAMANHO gravado e volta.
//
// Esperar pela PROMESSA da exportação seria frágil pelo motivo do irmão
// `pacote-compartilhar`: um desfecho que abrisse diálogo nunca a resolveria, e
// o que sairia seria prazo, não veredito. Espera-se pelo `fechar`.
async function fimDaExportacao(pg) {
  const fechou = await esperar(pg, () => window.__chamadas
    ? window.__chamadas.includes('fechar')
    : window.__fechou === true, null, 60000);
  if (fechou !== true) return porque(fechou);
  await pg.evaluate(() => new Promise((r) => setTimeout(r, 60)));
  return pg.evaluate(() => {
    const t = document.querySelector('#pacoteExportarTile .qs-titulo');
    const d = document.getElementById('appDialog');
    return { titulo: (t || {}).textContent || '',
      dialogo: !!d && d.classList.contains('open') };
  });
}

// O FIM DA IMPORTAÇÃO. Ela deixou de terminar em `location.reload()` (v1.8.28),
// e o que se espera é a Promise que o `importarPacote` devolve — ela só resolve
// depois da REHIDRATAÇÃO (`loadCollections` + `load`).
//
// O `catch` NÃO é frouxidão: é o que faz a REVERSÃO ser limpa. Com o
// `location.reload()` de volta, a página navega no meio deste `evaluate` e o
// Playwright lança — sem o catch o oráculo MORRE aqui, num bloco que não é o
// dele, e quem lê o log vê um `ReferenceError` em vez da asserção que reprovou.
// Engolindo a navegação, o percurso segue e quem acusa é o bloco 16, que é de
// quem essa regra é.
async function fimDaImportacao(pg) {
  try {
    await pg.evaluate(() => window.__fim);
  } catch (_) {
    // NAVEGOU — é a REVERSÃO (o `location.reload()` de volta). Espera-se o
    // documento novo assentar, senão o `evaluate` seguinte cai no vão entre as
    // duas páginas e o oráculo morre num bloco que não é o dele.
    await pg.waitForLoadState('domcontentloaded').catch(() => {});
  }
  // O APP DE PÉ, e não só o DOM: a régua é o `AVDB`, que é o que os blocos
  // consultam. Sem ela a espera passa no vão em que o documento existe e o
  // script ainda não rodou.
  await esperar(pg, () => !document.getElementById('splash') && !!window.AVDB,
    null, 30000);
}

async function responderDialogo(pg) {
  const abriu = await esperar(pg, () => {
    const d = document.getElementById('appDialog');
    return !!d && d.classList.contains('open');
  }, null, 60000);
  if (abriu !== true) return abriu;
  const texto = await pg.evaluate(() => document.getElementById('appDialogMsg').textContent);
  await pg.click('#appDialogOk');
  return texto;
}

// A LISTA DA JANELA (v1.11.9) já está à vista quando ela abre, e o toque em
// Exportar é a confirmação: o oráculo abre a janela e aperta o botão de VERDADE,
// que é o que quem opera faz — e assim o caminho da lista entra na cobertura
// deste percurso de graça.
async function confirmarGrupos(pg) {
  await pg.evaluate(() => openPacotePopup());
  const abriu = await esperar(pg, () => {
    const d = document.getElementById('pacotePopup');
    return !!d && d.classList.contains('open') && !!document.querySelector('#pacoteLista li');
  }, null, 60000);
  if (abriu !== true) return abriu;
  const linhas = await pg.evaluate(() => [...document.querySelectorAll('#pacoteLista li')]
    .map((li) => (li.textContent || '').replace(/\s+/g, ' ').trim()));
  await pg.click('#pacoteExportarTile');
  return linhas;
}


// Marca/desmarca a linha pelo NOME, tocando no botão de verdade (o que o operador faz).
async function tocarLinha(pg, nome) {
  const ok = await pg.evaluate((n) => {
    const li = [...document.querySelectorAll('#pacoteLista li')]
      .find((x) => ((x.querySelector('.song-menu-label') || {}).textContent || '') === n);
    const b = li && li.querySelector('button');
    if (!b) return false;
    b.click();
    return true;
  }, nome);
  await pg.evaluate(() => new Promise((r) => setTimeout(r, 40)));
  return ok;
}
const marcadas = (pg) => pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('#pacoteLista li')]
  .map((li) => [((li.querySelector('.song-menu-label') || {}).textContent || ''),
    !!li.querySelector('.song-menu-check.on')])));

// O estado do aparelho de destino: o que de fato chegou.
const lerDestino = (pg) => pg.evaluate(async () => {
  const tem = async (c) => { try { await AVDB.opfsGetFile(c); return true; } catch (_) { return false; } };
  const h22 = HYMNAL_2022_ID;
  return {
    h22Arquivo: await tem('folders/' + h22 + '/001.m4a'),
    h96Arquivo: await tem('folders/hymnal-1996/001.m4a'),
    h22Catalogo: !!(await AVDB.fileGet('arq-22')),
    h96Catalogo: !!(await AVDB.fileGet('arq-96')),
    antigoArquivo: await tem('folders/serie-provai-vede-2026/antigo.mp4'),
    antigoCatalogo: !!(await AVDB.fileGet('arq-antigo')),
    midia: (await AVDB.mediaResumo()).map((m) => m.id).sort(),
    miniatura: await (async () => { try { const r = await AVDB.getMedia('fav-item'); return !!(r && r.thumb); } catch (_) { return false; } })(),
    bibleVersion: await AVDB.getState('bibleVersion'),
    consumiu: (window.__consumiu || []).length,
  };
});

// Importa pela janela: abre, aplica as marcas, aperta Importar de verdade.
async function importarPelaJanela(pg, aoMarcar) {
  await pg.evaluate(() => openPacotePopup());
  const abriu = await esperar(pg, () => {
    const d = document.getElementById('pacotePopup');
    return !!d && d.classList.contains('open') && !!document.querySelector('#pacoteLista li');
  }, null, 60000);
  if (abriu !== true) return { erro: porque(abriu) };
  if (aoMarcar) await aoMarcar();
  const antes = await marcadas(pg);
  await pg.evaluate(() => { window.__fim = null; });
  await pg.click('#pacoteImportarTile');
  const texto = await responderDialogo(pg);
  await pg.evaluate(() => window.__fim);
  return { antes, texto };
}

// A lista como TEXTO, linha a linha — o que o operador lê.
const textosDaLista = (pg) => pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('#pacoteLista li')]
  .filter((li) => li.querySelector('.song-menu-label') && !li.querySelector('.song-menu-grupo'))
  .map((li) => [li.querySelector('.song-menu-label').textContent,
    ((li.querySelector('.song-menu-sub') || {}).textContent || '').replace(/\s+/g, ' ').trim()])));
const saidaDe = (pg) => pg.evaluate(() => {
  let n = 0; for (const p of window.__saida) n += p.length;
  const u8 = new Uint8Array(n); let o = 0;
  for (const p of window.__saida) { u8.set(p, o); o += p.length; }
  return Array.from(u8);
});
// Exporta DESMARCANDO linhas pelo nome — o toque de verdade em cada uma, e depois em Exportar.
async function exportarSem(pg, nomes) {
  await pg.evaluate(() => openPacotePopup());
  const abriu = await esperar(pg, () => !!document.querySelector('#pacoteLista li'), null, 60000);
  if (abriu !== true) return { erro: porque(abriu) };
  for (const n of nomes) await tocarLinha(pg, n);
  const antes = await marcadas(pg);
  await pg.click('#pacoteExportarTile');
  return { antes, fim: await fimDaExportacao(pg) };
}

const SEMENTE = async (pg) => {
  await pg.evaluate(async () => {
    const bytes = (n, v) => new Blob([new Uint8Array(n).fill(v)], { type: 'audio/mp4' });
    const mini = (v) => new Blob([new Uint8Array(30).fill(v)], { type: 'image/jpeg' });
    await AVDB.mediaAdd({ id: 'fav-item', name: 'Favorito', kind: 'audio', type: 'audio/mp4',
      blob: bytes(2000, 7), thumb: mini(9), url: null, pages: null, videos: null, cue: null, data: null,
      youtubeId: null, height: null, seconds: 12, canal: null, stream: null, lyrics: null, createdAt: 1 });
    await AVDB.mediaAdd({ id: 'solto-item', name: 'Solto', kind: 'audio', type: 'audio/mp4',
      blob: bytes(1500, 8), thumb: mini(5), url: null, pages: null, videos: null, cue: null, data: null,
      youtubeId: null, height: null, seconds: 9, canal: null, stream: null, lyrics: null, createdAt: 2 });
    await AVDB.setState('favs', ['fav-item']);
    await AVDB.setState('bibleVersion', 'versao-de-teste');
    // AS SÉRIES (v1.11.14): cada uma retém UM episódio na lista `serie`. O do Provai e Vede é o
    // desta semana; o do Informativo é de uma semana que já passou (o da semana ainda não veio).
    const video = (id, nome, yt, n, v) => AVDB.mediaAdd({ id, name: nome, kind: 'video', type: 'video/mp4',
      blob: new Blob([new Uint8Array(n).fill(v)], { type: 'video/mp4' }), thumb: mini(v), url: null,
      pages: null, videos: null, cue: null, data: null, youtubeId: yt, height: 720, seconds: 300,
      canal: 'Canal', stream: null, lyrics: null, createdAt: 4 });
    await video('epi-pv', 'Provai e Vede — desta semana', 'yt-semana', 3000, 6);
    await video('epi-inf', 'Informativo — semana passada', 'yt-velho', 2500, 2);
    await AVDB.setState('serie', ['epi-pv', 'epi-inf']);
    const sab = AVSerie.sabadoDaSemana();
    const pv = allCollections().find((c) => c.id === 'serie-provai-vede-2026');
    const inf = allCollections().find((c) => c.id === 'serie-informativo-missoes-2026');
    const quando = (c, n) => { const d = new Date(c.serie.ano, sab.mes - 1, sab.dia + n); return { mes: d.getMonth() + 1, dia: d.getDate() }; };
    const faixa = (id, quandoDe) => ({ id_music: id, name: id, ytUrl: 'y/' + id, seconds: 300, canal: 'Canal', serieData: quandoDe });
    collState[pv.id] = { indexSyncedAt: Date.now(), serieDiarioEm: Date.now(), songs: [faixa('yt-semana', quando(pv, 0))] };
    collState[inf.id] = { indexSyncedAt: Date.now(), serieDiarioEm: Date.now(),
      songs: [faixa('yt-velho', quando(inf, -7)), faixa('yt-novo', quando(inf, 0))] };
    // O ARQUIVO QUE SOBROU NA PASTA ANTIGA DO ÁLBUM: não é o vídeo da semana e não viaja.
    await AVDB.opfsWriteFile('folders/serie-provai-vede-2026/antigo.mp4', bytes(1800, 9));
    await AVDB.fileAdd({ id: 'arq-antigo', folder: 'serie-provai-vede-2026', opfsPath: 'folders/serie-provai-vede-2026/antigo.mp4',
      srcName: 'antigo', name: 'Episódio antigo', type: 'video/mp4', kind: 'video', size: 1800, thumb: mini(9), blob: null, url: null, addedAt: 1 });
    for (const [pasta, id, v] of [[HYMNAL_2022_ID, 'arq-22', 3], ['hymnal-1996', 'arq-96', 4]]) {
      await AVDB.opfsWriteFile('folders/' + pasta + '/001.m4a', bytes(1200, v));
      await AVDB.fileAdd({ id, folder: pasta, opfsPath: 'folders/' + pasta + '/001.m4a', srcName: '001',
        name: '001 — Faixa', type: 'audio/mp4', kind: 'audio', size: 1200, thumb: mini(v), blob: null, url: null, addedAt: 1 });
    }
  });
};

try {
  // ---- a ORIGEM: um aparelho com tudo, exportado inteiro --------------------
  const a = await aparelho(null);
  await SEMENTE(a.pg);
  // E · a lista da ORIGEM, lida antes de exportar: o que o operador vê em cada série
  await a.pg.evaluate(() => openPacotePopup());
  await esperar(a.pg, () => !!document.querySelector('#pacoteLista li'), null, 60000);
  const textosA = await textosDaLista(a.pg);
  const linhaPV = textosA['Provai e Vede 2026'] || '';
  const linhaINF = textosA['Informativo Mundial das Missões 2026'] || '';
  checar(/^vídeo da semana · até /.test(linhaPV) && !/nada baixado/.test(linhaPV),
    'E · a linha do Provai e Vede é o VÍDEO DA SEMANA, com o peso do episódio — não "nada baixado neste '
    + 'aparelho", que falava da lista completa', JSON.stringify(textosA));
  checar(/^último vídeo baixado · até /.test(linhaINF) && !/nada baixado/.test(linhaINF),
    'E · e a do Informativo, que retém um episódio que NÃO é o desta semana, diz "último vídeo baixado" — '
    + 'chamá-lo "da semana" seria a linha mentindo antes de o operador mandar', JSON.stringify(textosA));
  const linhasA = await confirmarGrupos(a.pg);
  checar(Array.isArray(linhasA) && linhasA.length >= 4,
    'PREMISSA: a origem tem a lista com os grupos (hinários, favoritos, outros)', JSON.stringify(linhasA));
  const fim = await fimDaExportacao(a.pg);
  checar(fim && fim.dialogo === false, 'PREMISSA: a exportação inteira termina', JSON.stringify(fim));
  const saida = await saidaDe(a.pg);
  await a.ctx.close();

  // ---- D · UM APARELHO NOVO TEM O QUE MARCAR ---------------------------------
  const novo = await aparelho(saida);
  await novo.pg.evaluate(() => openPacotePopup());
  await esperar(novo.pg, () => !!document.querySelector('#pacoteLista li'), null, 30000);
  const textosNovo = await textosDaLista(novo.pg);
  checar(/sem vídeo da semana baixado/.test(textosNovo['Provai e Vede 2026'] || '')
      && /sem vídeo da semana baixado/.test(textosNovo['Informativo Mundial das Missões 2026'] || '')
      && /nada baixado neste aparelho/.test(textosNovo['Hinário Adventista 2022'] || ''),
    'D · e no aparelho novo as SÉRIES dizem "sem vídeo da semana baixado" e os hinários "nada baixado '
    + 'neste aparelho" — cada linha fala do que ela de fato leva', JSON.stringify(textosNovo));
  const listaNovo = await marcadas(novo.pg);
  checar(['Hinário Adventista 2022', 'Hinário Adventista 1996'].every((n) => n in listaNovo)
      && Object.values(listaNovo).every(Boolean),
    'D · um aparelho NOVO mostra os hinários (e as séries) na lista, TODOS marcados, mesmo sem nada '
    + 'baixado: a seleção vale para IMPORTAR e não haveria o que marcar', JSON.stringify(listaNovo));

  // ---- A · SÓ O HINÁRIO 2022 MARCADO -----------------------------------------
  const rA = await importarPelaJanela(novo.pg, async () => {
    for (const n of Object.keys(await marcadas(novo.pg))) {
      if (n !== 'Hinário Adventista 2022') await tocarLinha(novo.pg, n);
    }
  });
  const dA = await lerDestino(novo.pg);
  checar(rA.antes && rA.antes['Hinário Adventista 2022'] === true
      && Object.entries(rA.antes).filter(([, v]) => v).length === 1,
    'A · PREMISSA: só o Hinário 2022 está marcado na hora do Importar', JSON.stringify(rA.antes));
  checar(dA.h22Arquivo && dA.h22Catalogo,
    'A · o hinário MARCADO chega, com os arquivos e o catálogo dele', JSON.stringify(dA));
  checar(!dA.h96Arquivo && !dA.h96Catalogo,
    'A · o OUTRO hinário, que estava no pacote e não estava marcado, NÃO entra — nem arquivo nem catálogo',
    JSON.stringify(dA));
  checar(dA.midia.length === 0,
    'A · e a mídia (favorito e solto) não entra: o grupo dela não estava marcado', JSON.stringify(dA.midia));
  checar(dA.bibleVersion === 'versao-de-teste',
    'A · os ajustes e catálogos (fixos) chegam sempre: são eles que fazem os arquivos aparecerem na Biblioteca',
    JSON.stringify(dA.bibleVersion));
  checar(dA.consumiu === 1 && /apagado — com o que não estava marcado/.test(rA.texto || ''),
    'A · o arquivo é CONSUMIDO como sempre, e a frase diz que o que não estava marcado se foi com ele',
    JSON.stringify({ consumiu: dA.consumiu, texto: rA.texto }));
  checar(/ficaram de fora/.test(rA.texto || ''),
    'A · e o relatório conta o que ficou de fora', JSON.stringify(rA.texto));
  await novo.ctx.close();

  // ---- B · TUDO MARCADO: o pacote inteiro, como antes ------------------------
  const todo = await aparelho(saida);
  const rB = await importarPelaJanela(todo.pg, null);
  const dB = await lerDestino(todo.pg);
  checar(dB.h22Arquivo && dB.h96Arquivo && dB.h22Catalogo && dB.h96Catalogo
      && dB.midia.join() === 'epi-inf,epi-pv,fav-item,solto-item',
    'B · com TUDO marcado (o padrão) entra o pacote inteiro, como sempre — sem filtro nenhum — e os '
    + 'dois episódios retidos das séries vêm junto', JSON.stringify(dB));
  checar(!dB.antigoArquivo && !dB.antigoCatalogo,
    'F · o arquivo que sobrou na pasta antiga do ÁLBUM da série NÃO viaja — nem os bytes nem o catálogo: '
    + 'a série leva só o vídeo da semana', JSON.stringify(dB));
  checar(!/ficaram de fora/.test(rB.texto || '') && /acervo agora está na biblioteca/.test(rB.texto || ''),
    'B · e o relatório não fala de nada de fora', JSON.stringify(rB.texto));
  await todo.ctx.close();

  // ---- C · SÓ OS FAVORITOS: a mídia vem pelo grupo que a contém --------------
  const fav = await aparelho(saida);
  // O destino JÁ tem um favorito seu: é isso que faz a linha "Favoritos" existir na lista.
  await fav.pg.evaluate(async () => {
    await AVDB.mediaAdd({ id: 'meu-fav', name: 'Meu', kind: 'audio', type: 'audio/mp4',
      blob: new Blob([new Uint8Array(500).fill(1)], { type: 'audio/mp4' }), thumb: null, url: null,
      pages: null, videos: null, cue: null, data: null, youtubeId: null, height: null, seconds: 5,
      canal: null, stream: null, lyrics: null, createdAt: 3 });
    await AVDB.setState('favs', ['meu-fav']);
  });
  const rC = await importarPelaJanela(fav.pg, async () => {
    await fav.pg.evaluate(() => openPacotePopup());
    await esperar(fav.pg, () => !!document.querySelector('#pacoteLista li'), null, 30000);
    for (const n of Object.keys(await marcadas(fav.pg))) {
      if (n !== 'Favoritos') await tocarLinha(fav.pg, n);
    }
  });
  const dC = await lerDestino(fav.pg);
  checar(rC.antes && rC.antes['Favoritos'] === true,
    'C · PREMISSA: a lista do destino tem a linha Favoritos, marcada', JSON.stringify(rC.antes));
  checar(dC.midia.join() === 'fav-item,meu-fav' && dC.miniatura,
    'C · o favorito do PACOTE entra pela lista que o contém (e leva a miniatura); o item solto não',
    JSON.stringify(dC));
  checar(!dC.h22Arquivo && !dC.h96Arquivo && !dC.h22Catalogo && !dC.h96Catalogo,
    'C · e nenhum hinário entra: não estavam marcados', JSON.stringify(dC));
  await fav.ctx.close();

  // ---- G · DESMARCAR A SÉRIE NA EXPORTAÇÃO TIRA O EPISÓDIO DO PACOTE ----------
  const o2 = await aparelho(null);
  await SEMENTE(o2.pg);
  const ex2 = await exportarSem(o2.pg, ['Provai e Vede 2026']);
  checar(ex2.antes && ex2.antes['Provai e Vede 2026'] === false && ex2.antes['Informativo Mundial das Missões 2026'] === true,
    'G · PREMISSA: o Provai e Vede foi desmarcado e o Informativo continua marcado na hora de exportar',
    JSON.stringify(ex2.antes));
  const saida2 = await saidaDe(o2.pg);
  await o2.ctx.close();
  const d2 = await aparelho(saida2);
  await importarPelaJanela(d2.pg, null);
  const dG = await lerDestino(d2.pg);
  checar(dG.midia.join() === 'epi-inf,fav-item,solto-item',
    'G · o episódio do Provai e Vede, desmarcado, NÃO está no pacote — e não caiu em "Outros itens", que '
    + 'seguia marcado e o levaria de qualquer jeito. O resto da mídia (e o episódio do Informativo) vem',
    JSON.stringify(dG.midia));
  await d2.ctx.close();

  // ---- H · NA IMPORTAÇÃO, O EPISÓDIO ENTRA PELO GRUPO DA SÉRIE -----------------
  const so = await aparelho(saida);
  const rH = await importarPelaJanela(so.pg, async () => {
    for (const n of Object.keys(await marcadas(so.pg))) {
      if (n !== 'Provai e Vede 2026') await tocarLinha(so.pg, n);
    }
  });
  const dH = await lerDestino(so.pg);
  checar(rH.antes && rH.antes['Provai e Vede 2026'] === true
      && Object.entries(rH.antes).filter(([, v]) => v).length === 1,
    'H · PREMISSA: só o Provai e Vede está marcado na hora do Importar', JSON.stringify(rH.antes));
  checar(dH.midia.join() === 'epi-pv',
    'H · com só a série marcada chega o episódio DELA (o pacote o nomeia no grupo da série) e nenhuma '
    + 'outra mídia: nem o do Informativo, nem o favorito, nem o solto', JSON.stringify(dH.midia));
  await so.ctx.close();

  // ---- I · SEM EPISÓDIO RETIDO, A LINHA DIZ ISSO — E A PASTA ANTIGA NÃO VIAJA --
  // O caso do relato: a série não tem vídeo e a pasta do álbum tem um arquivo velho. Antes a linha
  // media a PASTA; agora ela mede o vídeo da semana, que não há.
  const o3 = await aparelho(null);
  await SEMENTE(o3.pg);
  await o3.pg.evaluate(async () => { await AVDB.setState('serie', []); });
  await o3.pg.evaluate(() => openPacotePopup());
  await esperar(o3.pg, () => !!document.querySelector('#pacoteLista li'), null, 60000);
  const textosI = await textosDaLista(o3.pg);
  checar(textosI['Provai e Vede 2026'] === 'sem vídeo da semana baixado',
    'I · sem episódio retido a linha diz "sem vídeo da semana baixado", SEM peso — o arquivo velho da pasta '
    + 'do álbum não conta', JSON.stringify(textosI));
  await o3.pg.click('#pacoteExportarTile');
  await fimDaExportacao(o3.pg);
  const saida3 = await saidaDe(o3.pg);
  await o3.ctx.close();
  const d3 = await aparelho(saida3);
  await importarPelaJanela(d3.pg, null);
  const dI = await lerDestino(d3.pg);
  checar(!dI.antigoArquivo && !dI.antigoCatalogo,
    'I · e o arquivo velho da pasta do álbum não viaja mesmo com TUDO marcado e a série SEM vídeo — a série '
    + 'leva só o vídeo da semana, e quando não há, não leva nada', JSON.stringify(dI));
  await d3.ctx.close();

  checar(erros.length === 0, 'nenhum erro de página', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

falhas.length ? (console.log('\n' + falhas.length + ' falha(s).'), process.exit(1))
  : console.log('\nTodos passaram.');
