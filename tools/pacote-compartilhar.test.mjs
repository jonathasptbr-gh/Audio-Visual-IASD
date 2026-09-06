#!/usr/bin/env node
// ============================================================================
// EXPORTAR DIRETO PARA O COMPARTILHAR — e o caminho do SAF que sobrevive a ele.
//
// ## Por que este oráculo existe
//
// Pedido do operador: *"Ajuste para que o processo de exportar e importar seja
// o mais automático possível: como esportar direto para o compartilhar."* O
// pacote existe para atravessar de um celular para o outro, e quem o atravessa
// é o Quick Share; pelo seletor de arquivos isso são QUATRO passos.
//
// As três coisas que o lote acrescentou falham CALADAS, e cada uma por um
// motivo diferente:
//
//  1. **A ESCOLHA DO DESTINO.** Ela é uma conta — espaço livre contra o
//     tamanho medido —, e um erro nela não produz erro nenhum: se ela cair
//     sempre no SAF, o recurso simplesmente não existe e ninguém sabe por quê;
//     se cair sempre no local, o app tenta escrever quinze gigabytes num
//     aparelho que não os tem, e o Android não devolve uma falha clara — ele
//     quebra o IndexedDB, o WebView e a projeção, cada um do seu jeito.
//  2. **O FECHO CERTO PARA CADA CAMINHO.** `pacoteFechar` e
//     `pacoteCompartilhar` devolvem o mesmo número, então trocar um pelo outro
//     produz o MESMO desfecho visível — e o arquivo local nunca chega ao
//     seletor. É a metade que um teste de "exportou?" aprova nas duas versões.
//  3. **A FRASE.** As duas pontas pedem ações opostas: no compartilhar o
//     seletor JÁ ESTÁ na frente do operador e o que falta é o que fazer do
//     outro lado; no SAF o que falta é ACHAR o arquivo, e aí o nome dele é o
//     que importa. Uma frase só serve mal aos dois.
//
// E a quarta, que é a reversão que fecha o lote: **o SAF continua de pé**.
// Sem ela, apagar o caminho antigo passaria em tudo o mais — e o aparelho com
// o acervo grande, que é justamente o que exporta, ficaria sem saída.
//
//   node tools/pacote-compartilhar.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperar, porque, checar, falhas } from './arnes.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);

// A PONTE. O `__espaco` é o que o shell responderia, e é a única coisa que
// muda entre os dois cenários — o oráculo não toca em mais nada, porque a
// decisão TEM de sair só desse número contra o tamanho medido.
//
// `__chamadas` guarda a ORDEM dos métodos de pacote pedidos. Ela é a régua das
// asserções 1 e 2: qual caminho abriu, e qual fechou.
const ponte = (espaco) => `(function () {
  window.__saida = [];
  window.__chamadas = [];
  window.__espaco = ${espaco};
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
    'ytFetchAte','ytFetchAudio','ytStream','deckPages','deckExportUrl','requestMic','castTarget',
    'espelhoEstado','espelhoDiag','espelhoCertEstado','apkProcurar','otaPending','otaApply',
    'otaCheck','otaDiag','ytDiag','cifraDiag','farolEstado','ytCanalPlaylists','ytPlaylist',
    'ytDetalhes','micDiag','areaTransferencia','salvarTexto',
    ]);
  const bytesEscritos = () => {
    let t = 0;
    for (const p of (window.__saida || [])) t += p.length;
    return t;
  };
  const B = {
    shellVersion: () => 67,
    role: () => 'controle',
    appVersion: () => '9.99-teste',
    takeShare: () => '',
    busPost: () => {},
    otaConfirm: () => {},
    compartilharTexto: () => {},
    bgProgress: () => {},
    pacoteCancelar: () => { window.__chamadas.push('cancelar'); },
    pacoteEspaco: (id) => {
      window.__chamadas.push('espaco');
      setTimeout(() => window.__avResolve(id, window.__espaco), 0);
    },
    pacoteCriar: (id) => {
      window.__chamadas.push('criar');
      setTimeout(() => window.__avResolve(id, 'acervo-pelo-saf.avpkg'), 0);
    },
    pacoteCriarLocal: (id) => {
      window.__chamadas.push('criarLocal');
      setTimeout(() => window.__avResolve(id, 'acervo-local.avpkg'), 0);
    },
    pacoteFechar: (id) => {
      window.__chamadas.push('fechar');
      setTimeout(() => window.__avResolve(id, bytesEscritos()), 0);
    },
    pacoteCompartilhar: (id) => {
      window.__chamadas.push('compartilhar');
      setTimeout(() => window.__avResolve(id, bytesEscritos()), 0);
    },
    pickDoc: (id) => { setTimeout(() => window.__avResolve(id, []), 0); },
  };
  const nomes = ['apkInstalar','apkProcurar','captureVolumeKeys','castTarget',
    'deckDiscard','deckExportUrl','deckPages','displays','espelhoCertApagar','espelhoCertEstado',
    'espelhoCertImportar','espelhoDesligar','espelhoDiag','espelhoEstado','espelhoLigar',
    'keepAlive','listFolder','nowPlaying','openCast','openExternal','otaApply','otaCheck',
    'otaDiag','otaPending','pickFolder','requestMic','systemVolume','temaClaro',
    'ytCancel','ytCanalPlaylists','ytDiag','ytDiscard','ytFetch','ytFetchAte','ytFetchAudio',
    'ytPlaylist','ytSearch','ytStream','farolEstado','projecaoLocal','micDiag','cifraHtml',
    'cifraDiag','areaTransferencia','salvarTexto','ytDetalhes',
  ];
  for (const n of nomes) {
    if (B[n]) continue;
    B[n] = (...args) => {
      if (!comCallId.has(n)) return undefined;
      const id = args[0];
      setTimeout(() => window.__avResolve(id, (n in vazio) ? vazio[n] : null), 0);
      return undefined;
    };
  }
  window.__AVBridge = B;
})();`;

await new Promise((r) => servidor.listen(0, r));
const base = `http://localhost:${servidor.address().port}`;
const navegador = await abrirNavegador();

const erros = [];
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY|ERR_FAILED/;

async function aparelho(espaco) {
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
  await pg.addInitScript(ponte(espaco));
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await esperar(pg, () => !document.getElementById('splash'), null, 30000);
  await pg.evaluate(() => setAppMode('full'));
  return { ctx, pg };
}

const abriuFolha = (pg) => esperar(pg, () => {
  const d = document.getElementById('songMenuPopup');
  return !!d && d.classList.contains('open') && !!d.querySelector('.song-menu-go');
}, null, 60000);

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

// Uma exportação inteira, do toque ao diálogo. O acervo é pequeno de propósito
// — o que se mede aqui é a ESCOLHA, não a escrita, e a escrita já tem dois
// oráculos próprios.
async function exportar(espaco) {
  const a = await aparelho(espaco);
  await a.pg.evaluate(async () => {
    for (let i = 0; i < 8; i++) await AVDB.setState('bible:tst_gn_' + i, [{ v: 1, t: 'x' }]);
  });
  await a.pg.evaluate(() => { window.__fim = exportarPacote(); });
  const abriu = await abriuFolha(a.pg);
  if (abriu !== true) { await a.ctx.close(); return { erro: porque(abriu) }; }
  await a.pg.click('#songMenuList .song-menu-go');
  const frase = await responderDialogo(a.pg);
  const chamadas = await a.pg.evaluate(() => window.__chamadas.slice());
  await a.ctx.close();
  return { frase, chamadas };
}

try {
  // =========================================================================
  // A · COM ESPAÇO, O PACOTE VAI DIRETO PARA O COMPARTILHAR
  // =========================================================================
  //
  // O acervo semeado tem alguns kB e o espaço declarado são 4 GB: a conta
  // (`espaco - bytes > PACOTE_FOLGA_BYTES`) só pode dar o caminho local. A
  // asserção é a SEQUÊNCIA de métodos, e não o desfecho — os dois caminhos
  // terminam num diálogo de sucesso com o mesmo número.
  const cheio = await exportar(4 * 1024 * 1024 * 1024);
  checar(!cheio.erro, 'A · a exportação com espaço termina', cheio.erro);
  checar(cheio.chamadas.includes('espaco'),
    'A · o app PERGUNTA o espaço livre antes de escolher — sem isso a decisão '
    + 'não é uma conta, é um chute', JSON.stringify(cheio.chamadas));
  checar(cheio.chamadas.includes('criarLocal') && !cheio.chamadas.includes('criar'),
    'A · e abre o arquivo LOCAL, nunca o seletor do sistema — o seletor é o '
    + 'caminho de quatro passos que o pedido veio encurtar', JSON.stringify(cheio.chamadas));
  // A METADE QUE UM TESTE DE "EXPORTOU?" NÃO PEGA. `pacoteFechar` e
  // `pacoteCompartilhar` devolvem o MESMO número, então fechar pelo método
  // errado produz o mesmo diálogo, o mesmo tamanho e o mesmo tile — e o
  // arquivo local nunca chega ao seletor. Só a chamada distingue.
  checar(cheio.chamadas.includes('compartilhar') && !cheio.chamadas.includes('fechar'),
    'A · e FECHA pelo compartilhar: é ele que abre o seletor, e o outro '
    + 'devolveria o mesmo número sem oferecer o arquivo a ninguém',
    JSON.stringify(cheio.chamadas));
  checar(/Quick Share|enviá-la|Escolha por onde/i.test(cheio.frase || ''),
    'A · e a frase diz o que fazer com o seletor que já está na frente do '
    + 'operador, não onde achar um arquivo', cheio.frase);

  // =========================================================================
  // B · SEM ESPAÇO, O SELETOR DE ARQUIVOS CONTINUA DE PÉ
  // =========================================================================
  //
  // ESTA É A REVERSÃO QUE FECHA O LOTE. Sem ela, apagar o caminho do SAF
  // passaria em tudo o mais — e o aparelho que MAIS precisa exportar (o do
  // acervo grande) é exatamente o que não tem espaço para a segunda cópia.
  //
  // Zero é o que o shell responde quando não conseguiu medir, e é o pior caso
  // dos dois: ele tem de cair no caminho que ainda funciona.
  const semEspaco = await exportar(0);
  checar(!semEspaco.erro, 'B · a exportação sem espaço termina', semEspaco.erro);
  checar(semEspaco.chamadas.includes('criar') && !semEspaco.chamadas.includes('criarLocal'),
    'B · sem espaço medido o app volta ao SELETOR DE ARQUIVOS — é lá que o '
    + 'operador escolhe o cartão, e é o único caminho para um acervo que não '
    + 'cabe no armazenamento próprio', JSON.stringify(semEspaco.chamadas));
  checar(semEspaco.chamadas.includes('fechar') && !semEspaco.chamadas.includes('compartilhar'),
    'B · e fecha pelo `pacoteFechar`, que é o par do seletor',
    JSON.stringify(semEspaco.chamadas));
  checar(/acervo-pelo-saf\.avpkg/.test(semEspaco.frase || ''),
    'B · e a frase traz o NOME do arquivo, que é o que falta saber quando ele '
    + 'foi parar numa pasta de Downloads com meia dúzia de outros',
    semEspaco.frase);

  // =========================================================================
  // C · A FOLGA É DO APARELHO, e não uma margem simbólica
  // =========================================================================
  //
  // Com o espaço EXATAMENTE do tamanho do pacote a conta tem de recusar o
  // caminho local: compartilhar escreve uma SEGUNDA cópia, e um Android sem
  // espaço não devolve um erro claro — ele quebra o IndexedDB, o WebView e a
  // projeção, cada um do seu jeito.
  //
  // 64 MB é menos que a folga (512 MB) e muito mais que o acervo semeado, o
  // que separa esta asserção da de cima: aqui o pacote CABERIA, e mesmo assim
  // a resposta é o SAF.
  const apertado = await exportar(64 * 1024 * 1024);
  checar(!apertado.erro, 'C · a exportação apertada termina', apertado.erro);
  checar(apertado.chamadas.includes('criar') && !apertado.chamadas.includes('criarLocal'),
    'C · com espaço que só dá para o pacote, o caminho continua sendo o SAF — '
    + 'a folga existe para o app não encher o aparelho ao exportar',
    JSON.stringify(apertado.chamadas));

  checar(erros.length === 0, 'nenhum erro de console', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

falhas.length ? (console.log('\n' + falhas.length + ' falha(s).'), process.exit(1))
  : console.log('\nTodos passaram.');
