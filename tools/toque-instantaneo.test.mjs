#!/usr/bin/env node
// ============================================================================
// O "TOCAR AGORA" DE UM VÍDEO RESPONDE NO INSTANTE DO TOQUE
//
// ## O defeito que ele trava
//
// Relato do operador: *"após a seleção, ele leva algum tempo para reagir e
// sequer aparecer o spinner do carregamento do vídeo… nem que tenha mais tempo
// de carregamento, mas o feedback deve ser instantâneo. Por exemplo, a mídia
// atual deve ser instantaneamente interrompida para indicar que há outra mídia
// sendo colocada no ar, independente dela estar carregando"*.
//
// A janela era real e longa: `tentarTransmitir` começa por um `ytStream`, que é
// uma EXTRAÇÃO DE REDE de segundos, e só depois dela vem o `send` que muda
// alguma coisa na tela. No meio-tempo o único sinal era o `setYtEstado`, que
// acende uma LINHA da Biblioteca — a mesma que o `closeHymnSearch` acabou de
// fechar. E o caminho do DOWNLOAD já tinha o cartão de espera sobre a preview;
// o da TRANSMISSÃO nunca teve.
//
// ## Por que ele mede o MEIO, e não o desfecho
//
// É a lição do `aviso-de-importacao`: **um teste do desfecho passa nas duas
// versões.** Com a correção ou sem ela, o vídeo entra em cena quando os bytes
// chegam — o que muda é o que acontece ANTES disso, e por isso a ponte de
// mentira SEGURA o `ytStream` até o oráculo mandar soltar. É essa janela, e
// só ela, que é o recurso.
//
// ## As quatro metades
//
//  1. **A cena atual SAI**, e sai antes de o manifesto existir. É o
//     reconhecimento do toque.
//  2. **O comando chega ao BARRAMENTO** (`clear`), e não só à preview: o telão
//     e as telas da rede são quem a congregação vê.
//  3. **O cartão de espera aparece** — a metade que diz o que está havendo, no
//     lugar em que a mídia vai aparecer.
//  4. **Guardar numa lista NÃO interrompe nada.** Sem esta metade, a correção
//     viraria um defeito maior que o que ela conserta: mandar um vídeo para o
//     Cronograma derrubaria o louvor no ar.
//  5. **O ITEM DE LINK JÁ GUARDADO responde igual** (v1.4.7). A v1.4.6 pôs o
//     reconhecimento na folha da BUSCA e deixou de fora a outra porta do mesmo
//     trabalho — relato do operador: *"o tocar agora tem o sistema de reação
//     instantânea, mas o resto não… tocar em um item de link que esteja no
//     cronograma ou dos favoritos"*. É a MESMA espera (a mesma extração de
//     rede), por um caminho diferente.
//
//   node tools/toque-instantaneo.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, checar, falhas } from './arnes.mjs';

// A ponte de mentira, com o `ytStream` SEGURO: ele só resolve quando o oráculo
// escreve `window.__soltarStream`. É o que cria a janela que este arquivo mede
// — sem ela, a extração resolveria no mesmo tique e não haveria "antes".
const PONTE = `(() => {
  window.__streamPedido = 0;
  const B = {
    shellVersion: () => 60,
    role: () => 'controle',
    appVersion: () => '1.99-teste',
    takeShare: () => '',
    busPost: () => {},
    otaConfirm: () => {},
    // O DIAGNOSTICO DO SHELL, controlavel: e dele que sai a causa nomeada
    // (ContentNotAvailableException). Vazio por padrao — o caminho generico.
    ytDiag: (id) => {
      setTimeout(() => { try { window.__avResolve(id, window.__ytDiag || ''); } catch (_) {} }, 0);
    },
    ytStream: (id) => {
      window.__streamPedido++;
      const espera = () => {
        if (window.__soltarStream) {
          // window.__manifesto e opcional e existe para UM caso: o do NOME.
          // Sem ele o ytStream devolve null e o fluxo cai no download, que e o
          // que as outras metades deste arquivo medem.
          try { window.__avResolve(id, window.__manifesto || null); } catch (_) {}
          return;
        }
        setTimeout(espera, 20);
      };
      espera();
    },
  };
  const nomes = ['apkInstalar','apkProcurar','bgProgress','captureVolumeKeys','projecaoLocal','castTarget',
    'cifraDiag','cifraHtml','deckDiscard','deckExportUrl','deckPages','displays','espelhoCertApagar',
    'espelhoCertEstado','espelhoCertImportar','espelhoDesligar','espelhoDiag','espelhoEstado',
    'espelhoLigar','espelhoLigarEm','espelhoDerrubar','farolEstado','keepAlive',
    'listFolder','micDiag','nowPlaying','openCast','openExternal','otaApply','otaCheck','otaDiag',
    'otaPending','pickDoc','pickFolder','requestMic','salvarTexto','systemVolume','temaClaro',
    'ytCancel','ytCanalPlaylists','ytDiscard','ytFetch','ytFetchAte','ytFetchAudio',
    'ytPlaylist','ytSearch','areaTransferencia','atualizacaoEstado'];
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

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);

// WAV de 20 s: uma faixa que acabe no meio do teste responderia "parada" por ter
// TERMINADO — indistinguível de interrompida, que é justamente o que se mede.
const SEMEAR = `
  const sr = 8000, n = sr * 20;
  const buf = new ArrayBuffer(44 + n * 2), dv = new DataView(buf);
  const wr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  wr(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); wr(8, 'WAVEfmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true);
  dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  wr(36, 'data'); dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, Math.sin(i / 20) * 3000, true);
  const emCena = await AVDB.addMedia(new Blob([buf], { type: 'audio/wav' }),
    { name: 'Louvor Em Cena', type: 'audio/wav', kind: 'audio', list: 'imports' });
`;

await new Promise((r) => servidor.listen(0, r));
const navegador = await abrirNavegador({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await navegador.newContext({ viewport: { width: 412, height: 892 } });
await semRedeExterna(ctx);
const pg = await ctx.newPage();
const base = 'http://localhost:' + servidor.address().port;

// Põe um louvor no ar e devolve quando ele está DE FATO tocando — não quando o
// `send` retorna: a cena que este oráculo interrompe precisa existir primeiro.
async function porNoAr() {
  // O `new Function` montado AQUI e passado ao `evaluate` é o padrão do
  // `excluir-em-cena`: o corpo semeado é uma string, e embuti-la numa arrow
  // faria o `await` de dentro dela rodar noutro escopo.
  const id = await pg.evaluate(new Function('return (async () => {'
    + 'setAppMode("full");' + SEMEAR + 'await load(); await send(emCena.id);'
    + 'return emCena.id; })()'));
  await pg.waitForFunction(() => midiaNoAr === true, null, { timeout: 10000 });
  return id;
}

try {
  await pg.addInitScript(PONTE);
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(
    () => window.__NATIVE__ === true && window.AVDB && typeof window.__avBack === 'function'
      && !!document.querySelector('#playlist li'),
    null, { timeout: 30000 },
  );

  // ── 1 a 3. O TOQUE, e o que acontece ANTES de o manifesto existir ────────
  await porNoAr();
  const antes = await pg.evaluate(() => ({ midia: midiaNoAr, pedidos: window.__streamPedido }));
  checar(antes.midia === true && antes.pedidos === 0,
    'o cenário começa com um louvor NO AR e nenhuma extração pedida', antes);

  // O barramento é escutado a partir daqui: o que interessa é o comando que sai
  // NESTA janela, e não os do `send` que montou a cena.
  await pg.evaluate(() => {
    window.__cmds = [];
    // ESPIA O `sendCommand`, e não o `onCommand`: o barramento não devolve ao
    // Controle o que ele mesmo emite (não há eco, por construção), então um
    // ouvinte aqui nunca veria o comando que este oráculo existe para afirmar.
    const orig = AVDB.sendCommand.bind(AVDB);
    AVDB.sendCommand = (m) => { if (m && m.type) window.__cmds.push(m.type); return orig(m); };
    // O toque, sem `await`: é justamente a janela ANTES de ele resolver que se
    // mede, e esperar aqui seria esperar o desfecho.
    window.__acao = ytAcao({ id: 'vid1', url: 'https://www.youtube.com/watch?v=vid1', name: 'Louvor Novo' },
      ['tocar'], null, false, -1);
  });
  // Espera pelo FATO (a cena saindo), nunca por um prazo: um `waitForTimeout`
  // aqui mediria a máquina, e o que se afirma é que isto acontece SEM esperar a
  // rede — o que o `__streamPedido` logo abaixo prova.
  await pg.waitForFunction(() => midiaNoAr === false, null, { timeout: 5000 });

  const meio = await pg.evaluate(() => ({
    midia: midiaNoAr,
    cmds: window.__cmds.slice(),
    cartao: !!document.getElementById('pvBusy'),
    // O `ytStream` continua PENDENTE: é isso que prova que a interrupção não
    // esperou a rede.
    soltou: !!window.__soltarStream,
  }));
  checar(meio.midia === false,
    'a CENA ATUAL SAI no instante do toque — a interrupção é o reconhecimento do '
    + 'comando, e ela acontece com a extração ainda pendente', meio);
  checar(meio.soltou === false,
    'e a extração de rede AINDA NÃO RESOLVEU: é a janela inteira do defeito, e é '
    + 'nela que o oráculo mede', meio.soltou);
  checar(meio.cmds.some((t) => t === 'clear' || t === 'media-clear'),
    'o comando sai no BARRAMENTO (`clear`), e não só na preview — quem precisa '
    + 'reagir é o telão e as telas da rede, que é o que a congregação vê',
    meio.cmds);

  await pg.waitForFunction(() => {
    const el = document.getElementById('pvBusy');
    return !!el && el.classList.contains('on');
  }, null, { timeout: 5000 });
  const cartao = await pg.evaluate(() => ({
    cap: (document.getElementById('pvBusyCap') || {}).textContent || '',
    nome: (document.getElementById('pvBusyLabel') || {}).textContent || '',
  }));
  checar(/Preparando/i.test(cartao.cap) && /Louvor Novo/.test(cartao.nome),
    'e o CARTÃO DE ESPERA aparece sobre a preview, com o nome do que está vindo — '
    + 'o caminho do download já tinha isto, o da transmissão não tinha', cartao);

  // Solta a extração e deixa o fluxo terminar: o cartão tem de SAIR, senão a
  // correção troca um silêncio por um cartaz preso.
  await pg.evaluate(() => { window.__soltarStream = true; });
  await pg.evaluate(() => window.__acao.catch(() => {}));
  await pg.waitForFunction(() => {
    const el = document.getElementById('pvBusy');
    return !!el && !el.classList.contains('on');
  }, null, { timeout: 15000 });
  checar(true,
    'e ele SAI quando o fluxo termina — o `finally` do invólucro cobre as meia '
    + 'dúzia de saídas do `ytAcao`, e uma sem ele prenderia o cartão para sempre');

  // ── 4. GUARDAR numa lista NÃO interrompe ────────────────────────────────
  // Sem esta metade a correção viraria um defeito maior que o que conserta.
  await porNoAr();
  await pg.evaluate(() => {
    window.__soltarStream = true;
    window.__acao2 = ytAcao({ id: 'vid2', url: 'https://www.youtube.com/watch?v=vid2', name: 'Outro' },
      ['cronograma'], null, false, -1);
  });
  await pg.waitForTimeout(400);
  const guardando = await pg.evaluate(() => midiaNoAr);
  checar(guardando === true,
    'mandar um vídeo para o CRONOGRAMA não derruba o louvor no ar: a interrupção '
    + 'é do "Tocar agora", e só dele', guardando);
  await pg.evaluate(() => window.__acao2.catch(() => {}));

  // ── 5. O ITEM DE LINK JÁ GUARDADO responde igual ────────────────────────
  // A outra porta do mesmo trabalho: um `kind: 'youtube'` numa lista. Ele passa
  // por `send` → `resolverLinkYoutube`, e não pelo `ytAcao` — por isso a guarda
  // mora lá dentro, e não no invólucro da folha de busca.
  await porNoAr();
  await pg.evaluate(async () => {
    window.__soltarStream = false;
    const link = await AVDB.addUrlMedia('https://www.youtube.com/watch?v=vidL', {
      kind: 'youtube', type: 'video/youtube', name: 'Link Guardado', youtubeId: 'vidL',
    });
    await AVDB.listAdd('imports', link.id);
    await load();
    window.__linkAcao = send(link.id);
  });
  await pg.waitForFunction(() => midiaNoAr === false, null, { timeout: 5000 });
  const doLink = await pg.evaluate(() => ({ midia: midiaNoAr, soltou: !!window.__soltarStream }));
  checar(doLink.midia === false && doLink.soltou === false,
    'tocar num ITEM DE LINK do Cronograma interrompe a cena no ato, com a extração '
    + 'ainda pendente — a mesma reação da folha de busca, por um caminho que a '
    + 'v1.4.6 tinha deixado de fora', doLink);
  await pg.waitForFunction(() => {
    const el = document.getElementById('pvBusy');
    return !!el && el.classList.contains('on');
  }, null, { timeout: 5000 });
  checar(/Link Guardado/.test(await pg.evaluate(() =>
    (document.getElementById('pvBusyLabel') || {}).textContent || '')),
    'e o cartão traz o nome do item da LISTA, não o de um resultado de busca');
  await pg.evaluate(() => { window.__soltarStream = true; });
  await pg.evaluate(() => window.__linkAcao.catch(() => {}));
  await pg.waitForFunction(() => {
    const el = document.getElementById('pvBusy');
    return !!el && !el.classList.contains('on');
  }, null, { timeout: 15000 });
  checar(true, 'e ele sai no fim — o `finally` do `resolverLinkYoutube` cobre os quatro `return`');

  // ── 6. O SUBTEXTO do "Tocar agora" com "Online" ─────────────────────────
  const subs = await pg.evaluate(() => {
    const ler = () => {
      const it = [...songMenuListEl.querySelectorAll('.song-menu-btn')]
        .find((b) => /Tocar agora/.test(b.textContent));
      return it ? (it.querySelector('.song-menu-sub') || {}).textContent || '' : null;
    };
    const r = { id: 'vidX', url: 'https://www.youtube.com/watch?v=vidX', name: 'Louvor' };
    openYtMenu(r);
    songMenuFor.alt = -1;            // Online
    openYtMenu(r);
    const online = ler();
    songMenuFor.alt = 1080;
    openYtMenu(r);
    const mil = ler();
    closeSongMenu();
    return { online, mil };
  });
  checar(/qualidade varia/i.test(subs.online) && /conex/i.test(subs.online),
    'com "Online" o "Tocar agora" DIZ que toca direto da internet e que a '
    + 'qualidade varia conforme a conexão', subs.online);
  checar(subs.mil !== subs.online && !!subs.mil,
    'e nos tetos fixos ele volta a dizer o que aquela linha não guarda — a frase '
    + 'é da situação, não do botão', subs);
  // ── 7. O CONFIRMAR É SEMPRE O ÚLTIMO DA FAIXA ───────────────────────────
  // Relato do operador: *"nos favoritos o botão de confirmar play está na
  // direita, mas no resto da biblioteca está na esquerda; pode padronizar na
  // direita?"*. O lado era escolha de quem fornecia o irmão (`data-antes`), e
  // quem não a fizesse caía do outro lado — a divergência era o padrão do
  // esquecimento. A asserção é sobre a POSIÇÃO na faixa, não sobre o
  // mecanismo: é ela que sobrevive a uma reescrita do `destConfirmRow`.
  //
  // Ele mede o `destConfirmRow` DIRETO, com um irmão de mentira, porque é ali
  // que a decisão morava — montar as duas listas de verdade (uma música com
  // letra na Biblioteca, um Favorito com faixa de ações) para comparar duas
  // posições seria medir dois renderizadores para afirmar uma coisa de um.
  const ordem = await pg.evaluate(() => {
    // `destExecutor` precisa existir: sem ele `destConfirmRow` devolve null.
    openYtMenu({ id: 'vidY', url: 'https://www.youtube.com/watch?v=vidY', name: 'Louvor' });
    const posicao = (irmao) => {
      const li = destConfirmRow(() => irmao);
      const filhos = [...li.children];
      return {
        total: filhos.length,
        iConfirmar: filhos.findIndex((e) => e.classList.contains('song-menu-go')),
      };
    };
    const nu = () => { const b = document.createElement('button'); return b; };
    const comMarca = () => { const b = nu(); b.dataset.antes = '1'; return b; };
    const r = { simples: posicao(nu()), marcado: posicao(comMarca()) };
    closeSongMenu();
    return r;
  });
  checar(ordem.simples.total === 2 && ordem.simples.iConfirmar === 1,
    'com um IRMÃO na faixa, o CONFIRMAR é o ÚLTIMO — era este o caso que divergia: '
    + 'o "Ver a letra" da Biblioteca não pedia lado e caía à esquerda do botão',
    ordem.simples);
  checar(ordem.marcado.total === 2 && ordem.marcado.iConfirmar === 1,
    'e o antigo `data-antes` não muda mais nada: a escolha por chamador SAIU, que '
    + 'é o que impede a divergência de voltar por esquecimento', ordem.marcado);

  // ── 8. O NOME NÃO TROCA NO MEIO DA ESPERA (v1.4.10) ─────────────────────
  //
  // Relato do operador: *"o nome no card de preparação está se alterando na
  // segunda metade do processo… deixe apenas o primeiro nome, que ao que parece
  // é o nome do item ou renomeação que temos já no app"*.
  //
  // A espera tem dois donos em sequência e cada um escreve a legenda: o toque
  // (`cederOPalco`, com o nome do ITEM) e a carga do stream (o `onEspera`, com o
  // nome do REGISTRO recém-criado). O registro nascia com `man.name || r.name`
  // — o título que o shell extraiu do YouTube VENCENDO o nome que o app já
  // tinha —, então na segunda metade a legenda trocava sozinha. No caminho que
  // mais importa, um item de link do Cronograma, o que era apagado é o nome que
  // o OPERADOR deu.
  //
  // A MEDIDA É A SEQUÊNCIA DE NOMES, não o estado final. Um teste do fim passa
  // nas duas versões enquanto o segundo dono não tiver escrito ainda, e passa
  // "por acidente" quando os dois nomes coincidem; o que o operador viu foi a
  // TROCA. Espionar o `previewBusy` colhe todo nome que chega ao cartão, venha
  // de que dono vier — inclusive de um terceiro que alguém acrescente depois.
  const nomeDoCartao = await pg.evaluate(async () => {
    window.__soltarStream = false;
    window.__manifesto = {
      name: 'TITULO CRU DO YOUTUBE',
      // 1080p de propósito: com o teto padrão ele NÃO dispara o aviso de
      // resolução limitada (metade 9), e assim as duas metades não interferem
      // uma na outra — um aviso abriria um `previewBusy` com outra legenda, e a
      // asserção de NOME leria isso como a troca que ela existe para proibir.
      seconds: 100, height: 1080,
      video: { url: 'https://x/v', mime: 'video/webm; codecs="vp9"', size: 10 },
      videos: [], audio: { url: 'https://x/a', mime: 'audio/webm; codecs="opus"', size: 10 },
    };
    // O ESPIÃO: `previewBusy` é uma declaração de topo, logo uma propriedade do
    // objeto global — e é por ela que `cederOPalco` e o `onEspera` resolvem a
    // chamada. Trocá-la aqui alcança os dois sem tocar no código deles.
    const vistos = [];
    const orig = window.previewBusy;
    window.previewBusy = (acao, nome, cancelar) => { vistos.push(nome); return orig(acao, nome, cancelar); };
    // O NOME DO REGISTRO é colhido NO PONTO DA DECISÃO, e não relido do banco
    // depois: o `recuperarStream` troca o registro quando as URLs de mentira
    // falham, e o coletor apaga o que ficou sem lista. Procurá-lo no fim mede o
    // desfecho do arnês, não a regra.
    const batizados = [];
    const origAdd = AVDB.addStreamMedia;
    AVDB.addStreamMedia = (man, meta) => { batizados.push(meta && meta.name); return origAdd(man, meta); };
    const link = await AVDB.addUrlMedia('https://www.youtube.com/watch?v=vidN', {
      kind: 'youtube', type: 'video/youtube', name: 'O NOME QUE O OPERADOR DEU', youtubeId: 'vidN',
    });
    await AVDB.listAdd('imports', link.id);
    await load();
    const acao = send(link.id);
    await new Promise((r) => setTimeout(r, 300));   // a extração ainda pendente
    window.__soltarStream = true;
    await acao.catch(() => {});
    window.previewBusy = orig;
    AVDB.addStreamMedia = origAdd;
    window.__manifesto = null;
    return { vistos, batizados };
  });
  const distintos = [...new Set(nomeDoCartao.vistos)];
  checar(nomeDoCartao.vistos.length > 0 && distintos.length === 1
    && distintos[0] === 'O NOME QUE O OPERADOR DEU',
    'o cartão de espera mostra UM nome do começo ao fim, e é o que o app já tinha '
    + '— o título extraído do YouTube chega segundos depois e trocava a legenda '
    + 'debaixo do operador', nomeDoCartao);
  checar(nomeDoCartao.batizados.length === 1
    && nomeDoCartao.batizados[0] === 'O NOME QUE O OPERADOR DEU',
    'e o REGISTRO nasce com o mesmo nome, mesmo com o manifesto trazendo outro: '
    + 'com a legenda certa e o registro errado a troca só muda de lugar — vai '
    + 'para a barra do que está tocando, a notificação de mídia e a linha da '
    + 'lista', nomeDoCartao);
  // ── 9. O AVISO DE RESOLUÇÃO LIMITADA (v1.4.11) ──────────────────────────
  //
  // Pedido do operador, depois de projetar 360p numa TV 4K sem nada na tela
  // dizendo isso: *"coloque o aviso sobre a resolução estar limitada"*.
  //
  // A regra é DUAS condições (abaixo do pedido E abaixo de um piso visível), e
  // as duas metades de errar são silenciosas em direções opostas: de MENOS, o
  // operador projeta 360p achando que o app quebrou; de MAIS, escolher 480p de
  // propósito rende um aviso a cada toque dizendo o que ele acabou de pedir.
  //
  // Medido na REGRA e não no percurso: `avisarResolucaoLimitada` é uma função
  // de duas entradas, e encenar quatro extrações de rede para exercitar quatro
  // comparações seria medir o arnês. O percurso tem oráculo próprio nas metades
  // acima — o que aqui se prova é que a regra decide certo e que o cartão de
  // fato fala.
  const aviso = await pg.evaluate(async () => {
    const ler = () => ({
      on: pvBusyEl.classList.contains('on'),
      avisou: pvBusyEl.classList.contains('avisou'),
      falhou: pvBusyEl.classList.contains('falhou'),
      cap: pvBusyCapEl.textContent,
      texto: pvBusyLabelEl.textContent,
    });
    const limpar = () => {
      pvBusyEl.classList.remove('on', 'avisou', 'falhou');
      pvBusyCapEl.textContent = ''; pvBusyLabelEl.textContent = '';
    };
    const caso = (entregue, teto) => {
      limpar();
      avisarResolucaoLimitada(entregue, teto);
      const r = ler();
      limpar();
      return r;
    };
    return {
      // 1080 pedido (o padrão), 360 entregue: é a queixa que originou o lote.
      baixo: caso(360, 0),
      // O operador ESCOLHEU 480p e recebeu 480p: não há o que avisar.
      escolhido: caso(480, 480),
      // Pediu 1080 e veio 720: abaixo do pedido, mas acima do piso — num telão
      // de salão 720p se sustenta, e o Registro continua contando a diferença.
      seteVinte: caso(720, 0),
      // Altura desconhecida (shell antigo, ou caminho que não a reporta):
      // inventar "qualidade limitada" sem número seria trocar uma ausência de
      // informação por uma afirmação que ninguém pode conferir.
      semAltura: caso(0, 0),
      // Um teto BAIXO escolhido à mão e uma entrega ainda menor: as duas
      // condições valem, e este é o caso que a regra de uma condição só
      // ("abaixo do piso") deixaria passar em silêncio.
      abaixoDoTetoBaixo: caso(360, 480),
    };
  });
  checar(aviso.baixo.on && aviso.baixo.avisou && !aviso.baixo.falhou
    && /360p/.test(aviso.baixo.texto),
    'entregar 360p contra o teto padrão AVISA, com o número na frase — era esta '
    + 'a projeção que saía numa TV 4K sem nada na tela dizendo por quê',
    aviso.baixo);
  checar(aviso.baixo.avisou && !aviso.baixo.falhou,
    'e ele NÃO é uma falha: a mídia entrou em cena, e chamar isso de "Não deu" '
    + 'mandaria investigar o que funcionou', aviso.baixo);
  checar(aviso.escolhido.on === false,
    'escolher 480p e receber 480p NÃO avisa — um aviso a cada toque dizendo ao '
    + 'operador o que ele acabou de pedir é a metade de errar que ninguém relata',
    aviso.escolhido);
  checar(aviso.seteVinte.on === false,
    'e 720p contra o teto padrão também não: abaixo do pedido, acima do piso em '
    + 'que a diferença aparece num telão de salão', aviso.seteVinte);
  checar(aviso.semAltura.on === false,
    'altura DESCONHECIDA não vira aviso: sem número, "qualidade limitada" é uma '
    + 'afirmação que ninguém pode conferir', aviso.semAltura);
  checar(aviso.abaixoDoTetoBaixo.on && aviso.abaixoDoTetoBaixo.avisou,
    'e um teto BAIXO com entrega ainda menor avisa — é o caso que uma regra de '
    + 'uma condição só ("abaixo do piso") deixaria passar calada',
    aviso.abaixoDoTetoBaixo);
  // ── 10. O CENSO DA SESSÃO (v1.4.13) ─────────────────────────────────────
  //
  // O Registro guardava a ÚLTIMA extração e só ela, e a pergunta de uma falha
  // INTERMITENTE é outra — MEDIDO em campo: três Registros, três respostas
  // diferentes, nenhuma contando. A leitura que saiu disso ("é sempre") foi uma
  // generalização de duas amostras, e estava errada.
  //
  // Medido por DELTA, e não em absoluto: as metades acima já rodaram fluxos que
  // mexem nos mesmos contadores, e uma asserção sobre o total amarraria esta
  // metade à ordem do arquivo — que é exatamente o tipo de acoplamento que faz
  // um oráculo reprovar por um motivo que não é o dele.
  const censo = await pg.evaluate(async () => {
    const ler = () => Object.assign({}, ytCenso);
    const antes = ler();
    // 1) um pedido que TRANSMITE.
    window.__soltarStream = true;
    window.__manifesto = {
      name: 'Com manifesto', seconds: 100, height: 1080,
      video: { url: 'https://x/v', mime: 'video/webm; codecs="vp9"', size: 10 },
      videos: [], audio: { url: 'https://x/a', mime: 'audio/webm; codecs="opus"', size: 10 },
    };
    await tentarTransmitir({ id: 'cen1', url: 'https://www.youtube.com/watch?v=cen1', name: 'Um' }, 0, false);
    const comManifesto = ler();
    // 2) um pedido que NÃO transmite: o shell não monta o manifesto, e o fluxo
    //    real cairia no download.
    window.__manifesto = null;
    await tentarTransmitir({ id: 'cen2', url: 'https://www.youtube.com/watch?v=cen2', name: 'Dois' }, 0, false);
    const semManifesto = ler();
    // 3) uma recusa que acontece ANTES de perguntar ao shell (aqui, um alvo sem
    //    URL). Ela não é extração nenhuma, e contá-la inflaria o denominador —
    //    a proporção passaria a incluir o que nunca chegou a ser tentado.
    await tentarTransmitir({ id: 'cen3', name: 'Sem URL' }, 0, false);
    const semUrl = ler();
    // 4) a qualidade limitada é OUTRA pergunta: um pedido pode transmitir e
    //    ainda assim sair abaixo do pedido.
    avisarResolucaoLimitada(360, 0);
    avisarResolucaoLimitada(480, 0);
    const comLimitadas = ler();
    return { antes, comManifesto, semManifesto, semUrl, comLimitadas };
  });
  const d = (a, b) => ({
    pedidos: b.pedidos - a.pedidos,
    transmitiu: b.transmitiu - a.transmitiu,
    limitadas: b.limitadas - a.limitadas,
  });
  const t = d(censo.antes, censo.comManifesto);
  checar(t.pedidos === 1 && t.transmitiu === 1,
    'um pedido que TRANSMITE conta nos dois: pedido e transmissão', t);
  const f = d(censo.comManifesto, censo.semManifesto);
  checar(f.pedidos === 1 && f.transmitiu === 0,
    'e um que NÃO monta o manifesto conta só como pedido — é a diferença entre '
    + 'os dois que responde "com que frequência a projeção cai no download?"', f);
  const g = d(censo.semManifesto, censo.semUrl);
  checar(g.pedidos === 0 && g.transmitiu === 0,
    'uma recusa ANTERIOR à pergunta ao shell (alvo sem URL) NÃO conta como '
    + 'pedido — contá-la inflaria o denominador com o que nunca foi tentado, e '
    + 'a proporção deixaria de responder o que ela promete', g);
  const l = d(censo.semUrl, censo.comLimitadas);
  checar(l.limitadas === 2 && l.pedidos === 0,
    'a qualidade limitada é contada À PARTE: um pedido pode transmitir e ainda '
    + 'assim sair abaixo do pedido, então somá-la aos outros dois responderia '
    + 'uma pergunta que ninguém fez', l);
  checar(censo.comLimitadas.menor === 360,
    'e o MENOR valor é guardado, não o último: é ele que diz se foi um degrau '
    + 'ou o fundo do poço', censo.comLimitadas.menor);
  // ── 11. A RECUSA DE UM ITEM DE LINK FALA (v1.4.14) ──────────────────────
  //
  // Relato do operador: *"ele carrega um tempo, mas ele não toca nada e nem dá
  // nenhuma mensagem de erro nem nada"*. REPRODUZIDO: o caminho da BUSCA falava
  // pelo cartão e o do ITEM DE LINK não — a única saída era o `notaNoItem`, na
  // LINHA do item. E a linha some justamente aqui: um episódio de série mora no
  // álbum, e o "Tocar agora" fecha a Biblioteca antes de começar.
  //
  // Mede o CARTÃO, que é o que sobrevive ao fechamento da lista. A nota
  // continua sendo escrita — ela é o certo quando a linha está à vista —, e as
  // duas asserções abaixo são as duas metades: fala, e diz a CAUSA quando o
  // shell a nomeia.
  const recusa = await pg.evaluate(async () => {
    window.__soltarStream = true;
    window.__manifesto = null;
    const rodar = async (diag, nome, id) => {
      window.__ytDiag = diag;
      pvBusyEl.classList.remove('on', 'falhou', 'avisou');
      const link = await AVDB.addUrlMedia('https://www.youtube.com/watch?v=' + id, {
        kind: 'youtube', type: 'video/youtube', name: nome, youtubeId: id });
      await AVDB.listAdd('imports', link.id);
      await load();
      await send(link.id).catch(() => {});
      return {
        falou: pvBusyEl.classList.contains('on') && pvBusyEl.classList.contains('falhou'),
        cap: pvBusyCapEl.textContent, texto: pvBusyLabelEl.textContent,
      };
    };
    const generico = await rodar('', 'Sem causa', 'recA');
    const nomeada = await rodar(
      'transmissão: extração falhou: ContentNotAvailableException · https://x',
      'Com causa', 'recB');
    window.__ytDiag = '';
    return { generico, nomeada };
  });
  checar(recusa.generico.falou && /Não deu/i.test(recusa.generico.cap),
    'um item de link que NÃO resolve fala pelo cartão da preview — a nota vai '
    + 'para a linha, e a linha some justamente neste caso (o "Tocar agora" de um '
    + 'episódio fecha a Biblioteca antes de começar)', recusa.generico);
  checar(/não foi possível/i.test(recusa.generico.texto),
    'e sem causa nomeada pelo shell a frase genérica continua valendo',
    recusa.generico);
  checar(/não está disponível/i.test(recusa.nomeada.texto),
    'com o shell nomeando a causa, o cartão diz que o VÍDEO não está disponível '
    + '— "não deu, tente de novo" e "escolha outro" mandam fazer coisas opostas',
    recusa.nomeada);
} finally {
  await navegador.close();
  await new Promise((r) => servidor.close(r));
}

console.log(falhas.length ? '\n' + falhas.length + ' falha(s)' : '\ntudo certo');
process.exit(falhas.length ? 1 : 0);
