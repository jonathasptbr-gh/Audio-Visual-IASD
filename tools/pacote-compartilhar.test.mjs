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
import { servirEstatico, abrirNavegador, esperar, esperarCortina, porque, checar, falhas } from './arnes.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);

// A PONTE. O `__espaco` é o que o shell responderia, e é a única coisa que
// muda entre os dois cenários — o oráculo não toca em mais nada, porque a
// decisão TEM de sair só desse número contra o tamanho medido.
//
// `__chamadas` guarda a ORDEM dos métodos de pacote pedidos. Ela é a régua das
// asserções 1 e 2: qual caminho abriu, e qual fechou.
// `opts` aceita o NÚMERO do espaço livre (a forma antiga, que os blocos A-D
// usam) ou um objeto — hoje só com `prontoNoShell`, o pacote que um aparelho
// com exportação terminada devolveria a uma página recém-carregada.
const ponte = (opts) => `(function () {
  window.__saida = [];
  window.__chamadas = [];
  window.__espaco = ${typeof opts === 'number' ? opts : (opts && opts.espaco) || 0};
  window.__prontoNoShell = ${JSON.stringify((opts && opts.prontoNoShell) || null)};
  const canal = {
    postMessage(m) {
      if (typeof m === 'string') {
        setTimeout(() => canal.onmessage({ data: JSON.stringify({ ok: true }) }), 0);
        return;
      }
      window.__saida.push(new Uint8Array(m));
      let total = 0;
      for (const p of window.__saida) total += p.length;
      // O ACK PODE SER SEGURADO — é o que permite medir a tela COM a exportação
      // em curso. Sem isto o escritor termina antes de qualquer leitura, e o
      // estado que se quer ver não existe em quadro nenhum.
      const responder = () => canal.onmessage({ data: JSON.stringify({ r: total }) });
      if (window.__segurar) { (window.__presos = window.__presos || []).push(responder); return; }
      setTimeout(responder, 0);
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
    'ytDetalhes','areaTransferencia','salvarTexto',
    // Fora da allowlist, um método devolve undefined e prende quem o chamar
    // pelos 60 s do CALL_TIMEOUT_MS, calado. (pacoteDiag já tem
    // implementação própria acima, e é o que o renderDiag() daqui usa.)
    'cifraHtml','apkInstalar','espelhoCertImportar','espelhoCertApagar',
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
      setTimeout(() => window.__avResolve(id, window.__semArquivo ? -1 : bytesEscritos()), 0);
    },
    pacoteDescartarPronto: () => { window.__chamadas.push('descartarPronto'); },
    // O PRONTO QUE O SHELL GUARDA (shell 72). O __prontoNoShell e o que um
    // aparelho com pacote esperando devolveria depois de a pagina recarregar.
    // SEM CRASE NESTE COMENTARIO — ele mora dentro do template literal da
    // ponte, e uma crase aqui o encerra no meio.
    pacoteProntoEstado: (id) => {
      window.__chamadas.push('prontoEstado');
      setTimeout(() => window.__avResolve(id, window.__prontoNoShell || null), 0);
    },
    // O LADO DO SHELL do diário (shell 69). Ele é a metade que o web NÃO tem
    // como saber: o menos-um do envio colapsa três causas, e só o shell as
    // separa. SEM CRASE NESTE COMENTÁRIO — ele mora dentro do template literal
    // da ponte, e uma crase aqui o encerra no meio (o erro sai como
    // "1 is not a function", que não aponta nada).
    pacoteDiag: (id) => {
      window.__chamadas.push('diag');
      setTimeout(() => window.__avResolve(id,
        'pronto: acervo-local.avpkg · no disco: sim · 4096 byte(s)'
        + '\\n  fecho: pronto: 4096 byte(s) em acervo-local.avpkg'
        + '\\n  envio: seletor aberto com 4096 byte(s)'), 0);
    },
    pickDoc: (id) => { setTimeout(() => window.__avResolve(id, []), 0); },
  };
  const nomes = ['apkInstalar','apkProcurar','captureVolumeKeys','castTarget','saidaDeAudioAlvo',
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

async function aparelho(opts) {
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
  await pg.addInitScript(ponte(opts));
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await esperarCortina(pg);
  await pg.evaluate(() => setAppMode('full'));
  // A JANELA DO TRANSFERIR ABERTA, porque este oráculo TOCA nos dois botões — e
  // um botão de janela fechada está fora da viewport, onde o `click` do
  // Playwright retenta até vencer o prazo. Desde a v1.11.7 os dois moram em
  // `#pacotePopup`, que abre de Configurações pelo tile `#pacoteTile`: o
  // caminho é o do DEDO (Configurações → tile → janela), e é o dedo que ela
  // mede. A versão anterior chamava `exportarPacote()` por dentro e nunca
  // precisou dela; o que a v1.8.19 acrescentou acontece no toque.
  await pg.evaluate(() => { document.getElementById('simpleSettingsBtn').click(); });
  await esperar(pg, () => {
    const d = document.getElementById('fadePopup');
    return !!d && d.classList.contains('open');
  }, null, 10000);
  await pg.click('#pacoteTile');
  await esperar(pg, () => {
    const d = document.getElementById('pacotePopup');
    return !!d && d.classList.contains('open');
  }, null, 10000);
  // A TRANSIÇÃO TEM DE TER ASSENTADO: um botão que ainda desliza sob o dedo faz
  // o `click` do Playwright medir "estável" no quadro errado.
  await pg.evaluate(async () => {
    await Promise.all(['#pacotePopup .popup-sheet', '#fadePopup .popup-sheet']
      .flatMap((s) => document.querySelector(s).getAnimations().map((a) => a.finished.catch(() => {}))));
  });
  return { ctx, pg };
}

// A lista é a JANELA do Transferir (v1.11.9), já aberta pelo `aparelho()`: o que
// se espera é ela ter desenhado as linhas (ou a frase de aparelho vazio).
const abriuFolha = (pg) => esperar(pg, () => {
  const d = document.getElementById('pacotePopup');
  return !!d && d.classList.contains('open') && !!document.querySelector('#pacoteLista li');
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

// O ESTADO DO TILE como a tela o mostra. O `use` é lido pelo `display`
// COMPUTADO, e não pela classe: uma classe sem a regra de CSS do par passa num
// teste de classe e continua desenhando o ícone antigo (a armadilha do `<use>`
// que o `controles-layout` já pagou).
const lerTile = (pg) => pg.evaluate(() => {
  const el = document.getElementById('pacoteExportarTile');
  const visivel = [...el.querySelectorAll('use')]
    .filter((u) => getComputedStyle(u).display !== 'none')
    .map((u) => u.getAttribute('href'));
  const d = document.getElementById('appDialog');
  // O TILE DA GRADE (`#pacoteTile`) é o SINAL do que os dois botões da janela
  // dizem — ver `pacoteSinal` —, e é o único que se vê com a janela fechada.
  const g = document.getElementById('pacoteTile');
  const grade = {
    estado: g.dataset.estado || '',
    alt: g.classList.contains('qs-alt'),
    aro: g.classList.contains('qs-trabalhando'),
    desenho: [...g.querySelectorAll('use')]
      .filter((u) => getComputedStyle(u).display !== 'none')
      .map((u) => u.getAttribute('href')),
  };
  return {
    grade,
    titulo: (el.querySelector('.qs-titulo') || {}).textContent || '',
    alt: el.classList.contains('qs-alt'),
    aceso: el.classList.contains('qs-on'),
    travado: !!el.disabled,
    desenho: visivel,
    aria: el.getAttribute('aria-label') || '',
    dialogoAberto: !!d && d.classList.contains('open'),
  };
});

// Uma exportação inteira, do toque ao fim da escrita. A página FICA ABERTA: o
// que este arquivo mede acontece DEPOIS do fim, e é justamente o que a v1.8.19
// acrescentou.
//
// O acervo é pequeno de propósito — o que se mede aqui é a ESCOLHA e o
// desfecho, não a escrita, e a escrita já tem dois oráculos próprios.
async function exportar(espaco) {
  const a = await aparelho(espaco);
  await a.pg.evaluate(async () => {
    for (let i = 0; i < 8; i++) await AVDB.setState('bible:tst_gn_' + i, [{ v: 1, t: 'x' }]);
  });
  const abriu = await abriuFolha(a.pg);
  if (abriu !== true) { await a.ctx.close(); return { erro: porque(abriu) }; }
  await a.pg.click('#pacoteExportarTile');
  // ESPERA PELO FECHO, e não pela promessa da exportação — e a diferença é a
  // asserção do diálogo lá embaixo. Com um `openAppDialog` de volta no fim do
  // caminho a promessa NUNCA resolve (ela espera um toque), e um
  // `await window.__fim` transformaria essa reversão num PRAZO ESTOURADO em vez
  // de uma reprovação. Prazo não é veredito, e uma reversão que TRAVA não prova
  // o que veio provar — foi assim que ela apareceu, medida.
  const fechou = await esperar(a.pg, () => window.__chamadas.includes('fechar'), null, 60000);
  if (fechou !== true) { await a.ctx.close(); return { erro: porque(fechou) }; }
  // E UM RESPIRO, para o desfecho ter acontecido: o `fechar` é a última chamada
  // de ponte do percurso, e o que vem depois dele (o tile pronto, ou o diálogo)
  // é a continuação de uma promessa.
  await a.pg.evaluate(() => new Promise((r) => setTimeout(r, 60)));
  const chamadas = await a.pg.evaluate(() => window.__chamadas.slice());
  return { pg: a.pg, ctx: a.ctx, chamadas, tile: await lerTile(a.pg) };
}

try {
  // =========================================================================
  // A · COM ESPAÇO, O PACOTE É PREPARADO E FICA PRONTO — SEM ENVIAR NADA
  // =========================================================================
  //
  // O acervo semeado tem alguns kB e o espaço declarado são 4 GB: a conta
  // (`espaco - bytes > PACOTE_FOLGA_BYTES`) só pode dar o caminho local.
  const cheio = await exportar(4 * 1024 * 1024 * 1024);
  checar(!cheio.erro, 'A · a exportação com espaço termina', cheio.erro);
  checar(cheio.chamadas.includes('espaco'),
    'A · o app PERGUNTA o espaço livre antes de escolher — sem isso a decisão '
    + 'não é uma conta, é um chute', JSON.stringify(cheio.chamadas));
  checar(cheio.chamadas.includes('criarLocal') && !cheio.chamadas.includes('criar'),
    'A · e abre o arquivo LOCAL, nunca o seletor do sistema — o seletor é o '
    + 'caminho de quatro passos que o pedido veio encurtar', JSON.stringify(cheio.chamadas));
  // FECHAR NÃO É ENVIAR (v1.8.19). Enquanto os dois foram o mesmo instante, o
  // envio acontecia sozinho no fim da escrita e valia UMA vez. Esta asserção é
  // o par exato da que o lote anterior escreveu, invertida.
  checar(cheio.chamadas.includes('fechar') && !cheio.chamadas.includes('compartilhar'),
    'A · e FECHA sem enviar: quem decide quando o pacote sai é o operador, no '
    + 'toque seguinte', JSON.stringify(cheio.chamadas));
  checar(cheio.tile.dialogoAberto === false,
    'A · e NENHUM diálogo aparece — o "Acervo exportado" era um passo a mais no '
    + 'meio de uma ação que já tinha acabado', JSON.stringify(cheio.tile));

  // ---- O BOTÃO PARA EM 100% E VIRA O ENVIAR ----
  //
  // As três metades falham por motivos diferentes: o TÍTULO parado em 100% é o
  // que diz que acabou (era a barra que o operador estava lendo); o DESENHO é
  // onde o estado mora neste app desde a v1.7.6, e sem ele o botão fica
  // idêntico ao de antes com um significado novo; e ACESO E TOCÁVEL, porque
  // apagado aqui quer dizer INDISPONÍVEL.
  checar(cheio.tile.titulo === '100%',
    'A · o botão para em 100%, que é onde a barra da exportação parou',
    cheio.tile.titulo);
  checar(cheio.tile.desenho.length === 1 && cheio.tile.desenho[0] === '#icoCompartilhar',
    'A · e o DESENHO vira o de compartilhar — medido no `display` computado, '
    + 'porque a folha do documento não atravessa a árvore-sombra de um `<use>` '
    + 'e os dois empilhados passariam num teste de classe',
    JSON.stringify(cheio.tile.desenho));
  checar(cheio.tile.aceso === true && cheio.tile.travado === false,
    'A · e ele fica ACESO e tocável: apagado, neste app, quer dizer '
    + 'INDISPONÍVEL', JSON.stringify(cheio.tile));
  checar(/toque para enviar/i.test(cheio.tile.aria) && /\d/.test(cheio.tile.aria),
    'A · e o `aria-label` diz o tamanho e o que o toque faz — a informação que '
    + 'saiu do diálogo não saiu do app', cheio.tile.aria);
  // O SINAL NA GRADE (v1.11.7): os dois botões moram numa janela que pode estar
  // fechada, e o tile de Configurações é o que continua à vista. Pronto = o
  // desenho de COMPARTILHAR e `data-estado` "pronto-para-enviar", SEM aro. Sem
  // `pacoteSinal()` em `pacoteRenderTiles()` o tile fica em "ocioso" com
  // gigabytes prontos no disco.
  checar(cheio.tile.grade.estado === 'pronto-para-enviar' && cheio.tile.grade.alt === true
      && cheio.tile.grade.aro === false
      && cheio.tile.grade.desenho.length === 1 && cheio.tile.grade.desenho[0] === '#icoCompartilhar',
    'A · e o TILE DA GRADE diz o mesmo com a janela fechada: "pronto-para-enviar", '
    + 'desenho de compartilhar, sem aro', JSON.stringify(cheio.tile.grade));

  // ---- E O MESMO ARQUIVO SAI QUANTAS VEZES O OPERADOR PEDIR ----
  //
  // É O PEDIDO INTEIRO, e um teste de "enviou?" com um toque só passa nas duas
  // versões: o que distingue é o botão CONTINUAR pronto depois do envio.
  await cheio.pg.click('#pacoteExportarTile');
  await esperar(cheio.pg, () => window.__chamadas.includes('compartilhar'), null, 20000);
  const depoisDoPrimeiro = await lerTile(cheio.pg);
  checar(depoisDoPrimeiro.titulo === '100%' && depoisDoPrimeiro.desenho[0] === '#icoCompartilhar',
    'A · depois de enviar, o botão CONTINUA pronto — mandar de novo é tocar de '
    + 'novo, sem refazer um pacote de gigabytes', JSON.stringify(depoisDoPrimeiro));
  await cheio.pg.click('#pacoteExportarTile');
  const duas = await esperar(cheio.pg,
    () => window.__chamadas.filter((c) => c === 'compartilhar').length >= 2, null, 20000);
  checar(duas === true,
    'A · e o SEGUNDO toque manda o MESMO arquivo: dois `compartilhar` e nenhum '
    + '`criarLocal` a mais', porque(duas));
  const semRefazer = await cheio.pg.evaluate(
    () => window.__chamadas.filter((c) => c === 'criarLocal').length);
  checar(semRefazer === 1,
    'A · e o pacote foi preparado UMA vez só — sem esta metade, "reexportar a '
    + 'cada envio" passaria na de cima', semRefazer);

  // ---- O TOQUE LONGO REFAZ, E É A SAÍDA QUE IMPEDE A ARMADILHA ----
  //
  // Sem ela o botão fica preso no pacote velho: com um pronto na mão, o toque
  // curto envia, e não haveria gesto nenhum para pedir outro na mesma sessão.
  await cheio.pg.evaluate(() => { window.__chamadas.length = 0; });

  // ===== COM UM PRONTO NA MÃO, O IRMÃO É O DESCARTAR (v1.8.28) =====
  //
  // Relato do operador: *"verifique o botão de importar quando um arquivo de
  // exportação está pronto, ele tem nome de cancelar, mas está agindo como
  // importador normal"*. As duas metades eram verdade e nenhuma sozinha é o
  // defeito: o rótulo emprestado com prazo `0` ficava até alguém o calar (e só
  // o tile de EXPORTAR era calado), enquanto o `onclick` voltava a `null`,
  // isto é, ao importador de sempre.
  //
  // ISTO APOSENTOU O TOQUE LONGO, que era a única porta do "quero fazer outro"
  // desde a v1.8.20. A asserção que carrega o bloco continua sendo a PERGUNTA
  // — ela é o que protege minutos de trabalho, e não o tempo do dedo.
  const rotuloIrmao = await cheio.pg.evaluate(() => {
    const t = document.querySelector('#pacoteImportarTile .qs-titulo');
    return t ? t.textContent.trim() : '';
  });
  checar(rotuloIrmao === 'Descartar',
    'A · com um pacote pronto o tile de IMPORTAR diz "Descartar" — um botão '
    + 'que anuncia uma coisa e faz outra é pior que qualquer uma das duas',
    rotuloIrmao);

  await cheio.pg.click('#pacoteImportarTile');
  const perguntou = await esperar(cheio.pg, () => {
    const d = document.getElementById('appDialog');
    return !!d && d.classList.contains('open');
  }, null, 20000);
  checar(perguntou === true,
    'A · e ele PERGUNTA antes de jogar o pronto fora — destruir o resultado de '
    + 'minutos é a mesma classe de decisão que excluir uma pasta',
    porque(perguntou));
  // E O CANCELAR NÃO DESTRÓI NADA: é a metade que separa "pergunta" de
  // "pergunta e faz assim mesmo".
  await cheio.pg.click('#appDialogCancel');
  const intacto = await lerTile(cheio.pg);
  const semDescarte = await cheio.pg.evaluate(
    () => window.__chamadas.includes('descartarPronto'));
  checar(intacto.titulo === '100%' && semDescarte === false,
    'A · e recusar deixa o pacote INTACTO — nenhum `descartarPronto` foi pedido',
    JSON.stringify([intacto.titulo, semDescarte]));
  // ACEITANDO, ele descarta — e SÓ descarta. Encadear a exportação nova no
  // mesmo toque (o que o toque longo fazia) tira do operador a folha de
  // escolha, que é onde ele decide O QUE levar.
  await cheio.pg.click('#pacoteImportarTile');
  await esperar(cheio.pg, () => {
    const d = document.getElementById('appDialog');
    return !!d && d.classList.contains('open');
  }, null, 20000);
  await cheio.pg.click('#appDialogOk');
  const descartou = await esperar(cheio.pg,
    () => window.__chamadas.includes('descartarPronto'), null, 20000);
  checar(descartou === true,
    'A · e aceitando ele joga o pronto fora — sem essa porta, quem quisesse '
    + 'exportar de novo na mesma sessão ficaria preso com o arquivo velho',
    porque(descartou));
  const voltouAoRepouso = await esperar(cheio.pg, () => {
    const t = document.querySelector('#pacoteExportarTile .qs-titulo');
    const i = document.querySelector('#pacoteImportarTile .qs-titulo');
    return !!t && t.textContent.trim() !== '100%'
      && !!i && i.textContent.trim() !== 'Descartar';
  }, null, 20000);
  const graDescartado = await esperar(cheio.pg, () => {
    const g = document.getElementById('pacoteTile');
    return g.dataset.estado === 'ocioso' && !g.classList.contains('qs-alt');
  }, null, 20000);
  checar(graDescartado === true,
    'A · e o TILE DA GRADE volta a "ocioso", sem o desenho de compartilhar — o '
    + 'sinal acompanha o descarte, e não só o envio', porque(graDescartado));
  // E A LISTA DESTRAVA (v1.11.9): travada com o pacote pronto, ela devolve a
  // escolha ao operador no mesmo instante em que o pronto é descartado.
  const destravou = await esperar(cheio.pg,
    () => !document.getElementById('pacoteLista').classList.contains('travada'), null, 20000);
  checar(destravou === true,
    'A · e a LISTA da janela destrava junto: descartar devolve ao operador a '
    + 'escolha do que levar', porque(destravou));
  checar(voltouAoRepouso === true,
    'A · e o PAR volta ao repouso: o exportar deixa de dizer 100% e o importar '
    + 'volta a ser o importar — sem esta metade o botão continuaria oferecendo '
    + 'o descarte de um pacote que já não existe',
    porque(voltouAoRepouso));
  // E A FOLHA DE GRUPOS **NÃO** ABRE: descartar não é reexportar. Sem esta
  // asserção, encadear as duas coisas passaria em tudo o mais.
  const naoRecomecou = await cheio.pg.evaluate(
    () => !document.querySelector('#songMenuPopup.open'));
  checar(naoRecomecou === true,
    'A · e ele NÃO recomeça a exportação sozinho — quem escolhe o que levar é '
    + 'a lista, e ela é do próximo toque em Exportar',
    String(naoRecomecou));

  // ---- E O REGISTRO SABE O QUE ACONTECEU (v1.8.20) ----
  //
  // Este caminho já produziu DUAS falhas cujo relato era indistinguível a
  // distância — "o arquivo tem 0kb" e "tocar nele não faz nada" —, e a pergunta
  // que resolveria as duas (*o toque chegou a pedir o envio, e o que o shell
  // respondeu?*) não tinha resposta em lugar nenhum.
  const reg = await cheio.pg.evaluate(async () => {
    await renderDiag();
    return diagTexto;
  });
  const cheioChamou = await cheio.pg.evaluate(() => window.__chamadas.slice());
  checar(/Pacote de transferência/.test(reg) && /envio:/.test(reg)
    && /seletor aberto/.test(reg),
    'A · e o Registro conta a preparação E o envio — a metade que faltava '
    + 'quando o relato foi "não faz nada"',
    (reg.match(/Pacote de transferência[\s\S]{0,240}/) || [''])[0]);
  // E O LADO DO SHELL (v1.8.21), que é a metade que o web NÃO tem como saber:
  // o `-1` do envio colapsa TRÊS causas — não há pronto, o arquivo sumiu, o
  // seletor recusou — e três rodadas de campo se gastaram nessa distinção,
  // feita por dedução sobre o código em vez de leitura do aparelho.
  checar(cheioChamou.includes('diag'),
    'A · o Registro PERGUNTA ao shell — sem isso ele conta o que o web pediu, '
    + 'não o que o aparelho respondeu', JSON.stringify(cheioChamou));
  checar(/shell:/.test(reg) && /no disco: sim/.test(reg),
    'A · e a resposta do shell entra no bloco, com o arquivo no disco',
    (reg.match(/shell:[\s\S]{0,200}/) || [''])[0]);
  await cheio.ctx.close();

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
  // E ALI NÃO HÁ O QUE ENVIAR: o arquivo já é do operador, na pasta que ELE
  // escolheu. Um botão de enviar sobre ele ofereceria um arquivo que este app
  // não tem mais na mão.
  checar(semEspaco.tile.desenho[0] === '#icoExportar' && semEspaco.tile.titulo !== '100%',
    'B · e o botão VOLTA a ser o de exportar — o pronto é só do caminho local',
    JSON.stringify(semEspaco.tile));
  checar(semEspaco.tile.grade.estado === 'ocioso' && semEspaco.tile.grade.alt === false
      && semEspaco.tile.grade.aro === false,
    'B · e o TILE DA GRADE também fica OCIOSO — o pronto é só do caminho local, e '
    + 'um sinal de "pronto para enviar" sobre um arquivo que já é do operador '
    + 'ofereceria o que o app não tem mais na mão', JSON.stringify(semEspaco.tile.grade));
  await semEspaco.ctx.close();

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
  await apertado.ctx.close();

  // =========================================================================
  // D · O ARQUIVO QUE SUMIU DEVOLVE O BOTÃO À VERDADE
  // =========================================================================
  //
  // O pronto vive em MEMÓRIA e o arquivo vive no DISCO, e as duas coisas podem
  // discordar: a faxina de um lançamento, o operador limpando o armazenamento
  // do app. O shell confere o `length()` e devolve `-1`; sem esta metade, o
  // botão continuaria oferecendo o envio de um arquivo que não existe, e o
  // toque não faria nada — a falha muda que este repositório recusa.
  const sumiu = await exportar(4 * 1024 * 1024 * 1024);
  checar(!sumiu.erro, 'D · a exportação termina', sumiu.erro);
  await sumiu.pg.evaluate(() => { window.__semArquivo = true; });
  await sumiu.pg.click('#pacoteExportarTile');
  const desistiu = await esperar(sumiu.pg, () => {
    const el = document.getElementById('pacoteExportarTile');
    return [...el.querySelectorAll('use')]
      .filter((u) => getComputedStyle(u).display !== 'none')
      .some((u) => u.getAttribute('href') === '#icoExportar');
  }, null, 20000);
  checar(desistiu === true,
    'D · o `-1` devolve o botão a "Exportar" — o pronto sumiu do disco, e '
    + 'continuar oferecendo o envio seria um toque que não faz nada',
    porque(desistiu));
  const gradeSumiu = await esperar(sumiu.pg, () => {
    const g = document.getElementById('pacoteTile');
    return g.dataset.estado === 'ocioso' && !g.classList.contains('qs-alt');
  }, null, 20000);
  checar(gradeSumiu === true,
    'D · e o TILE DA GRADE desiste junto: "ocioso", sem o desenho de compartilhar',
    porque(gradeSumiu));
  await sumiu.ctx.close();

// ===========================================================================
// E · O TILE OCIOSO É O CANCELAR DO IRMÃO (v1.8.27)
// ===========================================================================
//
// Relato do operador: *"quando exportando, o botão de importação fica com um
// spinner, o que está certo no conceito de deixar ele inutilizado, mas errado
// no visual, pois ele indica um trabalho, trabalho esse que não é
// importação … talvez se transforme em um botão auxiliar de 'cancelar' … dessa
// forma os dois botões são irmãos e se completam nas ações"*.
//
// O ARO É O DESENHO DO TRABALHO, e pintá-lo num botão parado é a tela
// afirmando o que não é. A régua é o RENDERIZADO: uma troca de classe passa num
// teste de classe e continua com o aro girando na tela.
{
  const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true });
  await semRedeExterna(ctx);
  const pg = await ctx.newPage();
  await pg.addInitScript(ponte(50 * 1024 * 1024 * 1024));
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await esperarCortina(pg);
  // A EXPORTAÇÃO DE VERDADE, SEGURADA NO PRIMEIRO BLOCO. As bandeiras são de
  // módulo — escrevê-las de fora não existe —, então o estado é montado pelo
  // caminho que o dedo percorre.
  await pg.evaluate(async () => {
    await AVDB.opfsWriteFile('folders/x/a.m4a',
      new Blob([new Uint8Array(400000).fill(7)], { type: 'audio/mp4' }));
    window.__segurar = true;
    // Direto, sem a janela: sem lista aberta a função marca TUDO (o padrão).
    window.__fim = exportarPacote();
  });
  await esperar(pg, () => (window.__presos || []).length > 0, null, 30000);

  const r = await pg.evaluate(() => {
    const exp = document.getElementById('pacoteExportarTile');
    const imp = document.getElementById('pacoteImportarTile');
    const visto = (el) => {
      const svgs = [...el.querySelectorAll('use')]
        .filter((u) => getComputedStyle(u).display !== 'none')
        .map((u) => u.getAttribute('href'));
      return {
        estado: el.dataset.estado || '',
        titulo: (el.querySelector('.qs-titulo') || {}).textContent || '',
        aro: getComputedStyle(el, '::after').content,
        simbolos: svgs,
        travado: !!el.disabled,
      };
    };
    const g = document.getElementById('pacoteTile');
    return { exp: visto(exp), imp: visto(imp),
      grade: { estado: g.dataset.estado || '', aro: g.classList.contains('qs-trabalhando'),
        alt: g.classList.contains('qs-alt'), aroPintado: getComputedStyle(g, '::after').content } };
  });
  checar(r.imp.estado === 'cancelar',
    'E · com a exportação em curso, o tile ocioso vira o CANCELAR', JSON.stringify(r.imp));
  checar(r.imp.simbolos.length === 1 && /icoCancelar/.test(r.imp.simbolos[0] || ''),
    'E · e o desenho dele é o ✕, no lugar do ícone da função — o estado mora no '
    + 'DESENHO', JSON.stringify(r.imp.simbolos));
  checar(/Cancelar/.test(r.imp.titulo),
    'E · com o rótulo dizendo o que o toque faz', r.imp.titulo);
  // A ASSERÇÃO QUE CARREGA O BLOCO: o aro NÃO é dele. Sem ela, trocar só o
  // ícone deixaria o spinner girando por baixo — que é o relato.
  checar(r.imp.aro === 'none' || r.imp.aro === 'normal',
    'E · e o ARO do trabalho não é dele — era ele que dizia que o botão estava '
    + 'trabalhando', r.imp.aro);
  checar(!r.imp.travado,
    'E · e ele é TOCÁVEL: um cancelar que não responde é pior que um botão cinza',
    r.imp.travado);
  // O IRMÃO QUE TRABALHA CONTINUA MOSTRANDO O ARO — sem esta, apagar o aro dos
  // dois passaria em tudo o mais.
  checar(r.exp.estado === 'ocupado',
    'E · enquanto o que TRABALHA continua sendo o que trabalha', JSON.stringify(r.exp));
  // O TILE DA GRADE É O SINAL DO TRABALHO: com a janela fechada (aqui ela nunca
  // abriu) o aro e o data-estado "ocupado" são a única coisa que diz que há
  // exportação andando. O `pacoteSinal()` que `pacoteRenderTiles()` chama é o
  // que os escreve.
  checar(r.grade.estado === 'ocupado' && r.grade.aro === true && r.grade.alt === false
      && r.grade.aroPintado !== 'none' && r.grade.aroPintado !== 'normal',
    'E · e o TILE DA GRADE mostra o trabalho: "ocupado" e o aro PINTADO — sem '
    + 'isso uma exportação de minutos corre sem sinal nenhum à vista',
    JSON.stringify(r.grade));
  // O TOQUE NELE PARA DE VERDADE — sem esta, o botão é um desenho.
  const parou = await pg.evaluate(async () => {
    document.getElementById('pacoteImportarTile').click();
    window.__segurar = false;
    for (const f of (window.__presos || [])) f();
    window.__presos = [];
    try { await window.__fim; } catch (_) {}
    return (document.getElementById('pacoteExportarTile').dataset.estado || '');
  });
  checar(parou !== 'cancelar' && parou !== 'ocupado',
    'E · e o toque nele PARA a exportação', parou);
  const gradeParou = await esperar(pg, () => {
    const g = document.getElementById('pacoteTile');
    return g.dataset.estado !== 'ocupado' && !g.classList.contains('qs-trabalhando');
  }, null, 20000);
  checar(gradeParou === true,
    'E · e o TILE DA GRADE apaga o aro junto — um aro girando sobre um trabalho '
    + 'que parou é a tela afirmando o que não é', porque(gradeParou));
  await ctx.close();
}

  // =========================================================================
  // E · O PRONTO SOBREVIVE A UMA RECARGA DA PÁGINA (shell 72, v1.8.45)
  // =========================================================================
  //
  // O `pacotePronto` do companion do `MainActivity` sempre sobreviveu; o do
  // lado WEB é um `let` de PÁGINA, e quem decide o que o tile oferece é ele. Um
  // OTA aplicado (`otaApply` recarrega as duas páginas), a morte do renderer ou
  // uma recriação de Activity faziam a página renascer com `null`: o tile
  // voltava a dizer "Exportar" com gigabytes prontos em `files/pacote/`, e
  // tocar nele refazia minutos de trabalho. Era o `ACHADOS-EM-ABERTO.md` §0.
  //
  // Três metades. A do defeito (com pronto no shell, a página nova o encontra),
  // a que impede o conserto largo demais (SEM pronto no shell o tile continua
  // oferecendo "Exportar" — senão bastaria fingir que sempre há um), e a que
  // guarda a razão de o método existir: quem responde é o SHELL, então a
  // chamada tem de acontecer.
  {
    const p = await aparelho({ prontoNoShell: { nome: 'acervo-de-antes.avpkg', bytes: 4096 } });
    await esperar(p.pg, () => window.pacotePronto !== null, null, 15000);
    const comPronto = await p.pg.evaluate(() => ({
      nome: pacotePronto && pacotePronto.nome,
      bytes: pacotePronto && pacotePronto.bytes,
      perguntou: window.__chamadas.indexOf('prontoEstado') >= 0,
      rotulo: (document.querySelector('#pacoteExportarTile .qs-titulo') || {}).textContent || '',
      grade: (document.getElementById('pacoteTile') || {}).dataset.estado,
    }));
    checar(comPronto.nome === 'acervo-de-antes.avpkg' && comPronto.bytes === 4096,
      'E · a página nova reencontra o pacote pronto que o shell guardou',
      JSON.stringify(comPronto));
    checar(comPronto.perguntou === true,
      'E · e quem respondeu foi o SHELL — a página não teria como saber sozinha',
      JSON.stringify(comPronto));
    checar(comPronto.grade === 'pronto-para-enviar',
      'E · e o TILE DA GRADE também reencontra o pronto, depois da recarga — o '
      + '`lerPacotePronto` do `init()` termina em `pacoteRenderTiles()`, que é o '
      + 'que chama o sinal', String(comPronto.grade));
    await p.ctx.close();

    const q = await aparelho();
    await q.pg.evaluate(() => new Promise((r) => setTimeout(r, 400)));
    const semPronto = await q.pg.evaluate(() => ({
      grade: document.getElementById('pacoteTile').dataset.estado,
      pronto: pacotePronto,
      perguntou: window.__chamadas.indexOf('prontoEstado') >= 0,
    }));
    checar(semPronto.grade === 'ocioso',
      'E · e sem pronto o tile da grade está OCIOSO', String(semPronto.grade));
    checar(semPronto.pronto === null && semPronto.perguntou === true,
      'E · e sem pronto no shell ela não inventa um: perguntou e o tile segue '
      + 'oferecendo "Exportar"', JSON.stringify(semPronto));
    await q.ctx.close();
  }

  checar(erros.length === 0, 'nenhum erro de console', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

falhas.length ? (console.log('\n' + falhas.length + ' falha(s).'), process.exit(1))
  : console.log('\nTodos passaram.');
