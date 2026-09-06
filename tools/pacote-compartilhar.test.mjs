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
      setTimeout(() => window.__avResolve(id, window.__semArquivo ? -1 : bytesEscritos()), 0);
    },
    pacoteDescartarPronto: () => { window.__chamadas.push('descartarPronto'); },
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
  const nomes = ['apkInstalar','apkProcurar','captureVolumeKeys','castTarget',
    'deckDiscard','deckExportUrl','deckPages','displays','espelhoCertApagar','espelhoCertEstado',
    'espelhoCertImportar','espelhoDesligar','espelhoDiag','espelhoEstado','espelhoLigar',
    'keepAlive','listFolder','nowPlaying','openCast','openExternal','otaApply','otaCheck',
    'otaDiag','otaPending','pickFolder','requestMic','systemVolume','temaClaro',
    'ytCancel','ytCanalPlaylists','ytDiag','ytDiscard','ytFetch','ytFetchAte','ytFetchAudio',
    'ytPlaylist','ytSearch','ytStream','farolEstado','projecaoLocal','micDiag','cifraHtml',
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
  // A FOLHA DE CONFIGURAÇÕES ABERTA, porque este oráculo TOCA no tile — e um
  // tile de folha fechada está fora da viewport, onde o `click` do Playwright
  // retenta até vencer o prazo. A versão anterior chamava `exportarPacote()`
  // por dentro e nunca precisou dela; o que a v1.8.19 acrescentou acontece no
  // DEDO, e é o dedo que ela mede.
  await pg.evaluate(() => { document.getElementById('simpleSettingsBtn').click(); });
  await esperar(pg, () => {
    const d = document.getElementById('fadePopup');
    return !!d && d.classList.contains('open');
  }, null, 10000);
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
  return {
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
  await a.pg.evaluate(() => { window.__fim = exportarPacote(); });
  const abriu = await abriuFolha(a.pg);
  if (abriu !== true) { await a.ctx.close(); return { erro: porque(abriu) }; }
  await a.pg.click('#songMenuList .song-menu-go');
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
  await cheio.pg.dispatchEvent('#pacoteExportarTile', 'pointerdown');
  // ELE PERGUNTA ANTES (v1.8.20), e essa é a asserção que carrega o bloco.
  // Agindo direto, um toque um pouco mais demorado no botão DESTRUÍA um pacote
  // de minutos e recomeçava a medição — foi o relato do operador —, e num
  // TOQUE não existe abortar: a captura implícita do ponteiro não emite
  // `pointerleave`, então a saída tem de vir DEPOIS do gesto.
  const perguntou = await esperar(cheio.pg, () => {
    const d = document.getElementById('appDialog');
    return !!d && d.classList.contains('open');
  }, null, 20000);
  await cheio.pg.dispatchEvent('#pacoteExportarTile', 'pointerup');
  checar(perguntou === true,
    'A · o toque LONGO PERGUNTA antes de jogar o pronto fora — agir direto '
    + 'destrói minutos de trabalho num gesto que não tem como ser abortado',
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
  // ACEITANDO, ele refaz: sem esta metade, "nunca refazer" passaria na de cima
  // e a armadilha do botão preso no pacote velho voltaria.
  await cheio.pg.dispatchEvent('#pacoteExportarTile', 'pointerdown');
  await esperar(cheio.pg, () => {
    const d = document.getElementById('appDialog');
    return !!d && d.classList.contains('open');
  }, null, 20000);
  await cheio.pg.dispatchEvent('#pacoteExportarTile', 'pointerup');
  await cheio.pg.click('#appDialogOk');
  const refez = await esperar(cheio.pg, () => window.__chamadas.includes('descartarPronto'),
    null, 20000);
  checar(refez === true,
    'A · e aceitando ele joga o pronto fora e começa outro — sem essa porta, '
    + 'quem quisesse exportar de novo na mesma sessão ficaria preso com o '
    + 'arquivo velho', porque(refez));
  const voltou = await abriuFolha(cheio.pg);
  checar(voltou === true,
    'A · e a folha de grupos volta a abrir, que é a exportação recomeçando',
    porque(voltou));
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
  await esperar(pg, () => !document.getElementById('splash'), null, 30000);
  // A EXPORTAÇÃO DE VERDADE, SEGURADA NO PRIMEIRO BLOCO. As bandeiras são de
  // módulo — escrevê-las de fora não existe —, então o estado é montado pelo
  // caminho que o dedo percorre.
  await pg.evaluate(async () => {
    await AVDB.opfsWriteFile('folders/x/a.m4a',
      new Blob([new Uint8Array(400000).fill(7)], { type: 'audio/mp4' }));
    window.__segurar = true;
    window.__fim = exportarPacote();
  });
  await esperar(pg, () => {
    const d = document.getElementById('songMenuPopup');
    return !!d && d.classList.contains('open') && !!d.querySelector('.song-menu-go');
  }, null, 60000);
  await pg.click('#songMenuList .song-menu-go');
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
    return { exp: visto(exp), imp: visto(imp) };
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
  await ctx.close();
}

  checar(erros.length === 0, 'nenhum erro de console', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

falhas.length ? (console.log('\n' + falhas.length + ' falha(s).'), process.exit(1))
  : console.log('\nTodos passaram.');
