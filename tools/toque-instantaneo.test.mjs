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

// A ponte de mentira, com o DOWNLOAD SEGURO: `ytFetch`/`ytFetchAte`/
// `ytFetchAudio` só resolvem quando o oráculo escreve `window.__soltarBaixa`. É
// o que cria a janela que este arquivo mede — sem ela, o fluxo resolveria no
// mesmo tique e não haveria "antes".
//
// ERA O `ytStream` ATÉ A v1.7.2, e a troca é o recurso mudando de meio, não o
// oráculo mudando de assunto: a transmissão direta saiu do app, e o passo lento
// entre o toque e a cena passou a ser o download. A pergunta deste arquivo — *o
// toque responde no instante do toque?* — vale MAIS agora, porque a espera
// deixou de ser de segundos e passou a ser de minutos.
const PONTE = `(() => {
  window.__baixaPedida = 0;
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
  };
  // OS TRES DESTINOS DO DOWNLOAD sao o mesmo passo lento, e o app escolhe entre
  // eles pelo teto e pela forma: ytFetchAte num teto MENOR que 1080p (o padrao
  // desde a v1.7.6 e 720p, entao e este o caminho normal), ytFetch sem teto e
  // ytFetchAudio no "So audio". Segurar um so deixaria o caso passar reto pelos
  // outros dois.
  for (const n of ['ytFetch', 'ytFetchAte', 'ytFetchAudio']) {
    B[n] = (id) => {
      window.__baixaPedida++;
      const espera = () => {
        if (window.__soltarBaixa) {
          // window.__arquivo e opcional e existe para UM caso: o do NOME.
          try { window.__avResolve(id, window.__arquivo || null); } catch (_) {}
          return;
        }
        setTimeout(espera, 20);
      };
      espera();
    };
  }
  const nomes = ['apkInstalar','apkProcurar','bgProgress','captureVolumeKeys','projecaoLocal','castTarget',
    'cifraDiag','cifraHtml','deckDiscard','deckExportUrl','deckPages','displays','espelhoCertApagar',
    'espelhoCertEstado','espelhoCertImportar','espelhoDesligar','espelhoDiag','espelhoEstado',
    'espelhoLigar','espelhoLigarEm','espelhoDerrubar','farolEstado','keepAlive',
    'listFolder','micDiag','nowPlaying','openCast','openExternal','otaApply','otaCheck','otaDiag',
    'otaPending','pickDoc','pickFolder','requestMic','salvarTexto','systemVolume','temaClaro',
    'ytCancel','ytCanalPlaylists','ytDiscard','ytStream',
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
  const antes = await pg.evaluate(() => ({ midia: midiaNoAr, pedidos: window.__baixaPedida }));
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
    soltou: !!window.__soltarBaixa,
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
  await pg.evaluate(() => { window.__soltarBaixa = true; });
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
    window.__soltarBaixa = true;
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
    window.__soltarBaixa = false;
    const link = await AVDB.addUrlMedia('https://www.youtube.com/watch?v=vidL', {
      kind: 'youtube', type: 'video/youtube', name: 'Link Guardado', youtubeId: 'vidL',
    });
    await AVDB.listAdd('imports', link.id);
    await load();
    window.__linkAcao = send(link.id);
  });
  await pg.waitForFunction(() => midiaNoAr === false, null, { timeout: 5000 });
  const doLink = await pg.evaluate(() => ({ midia: midiaNoAr, soltou: !!window.__soltarBaixa }));
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
  await pg.evaluate(() => { window.__soltarBaixa = true; });
  await pg.evaluate(() => window.__linkAcao.catch(() => {}));
  await pg.waitForFunction(() => {
    const el = document.getElementById('pvBusy');
    return !!el && !el.classList.contains('on');
  }, null, { timeout: 15000 });
  checar(true, 'e ele sai no fim — o `finally` do `resolverLinkYoutube` cobre os quatro `return`');

  // (6. O SUBTEXTO do "Tocar agora" com "Online" — removido na v1.7.6.)
  //
  // Ele media a frase que aquele degrau punha na linha: *"toca direto da
  // internet — a qualidade varia bastante conforme a conexão"*. O degrau saiu
  // junto com a transmissão direta que ele alimentava, e com ele a frase: hoje
  // toda qualidade BAIXA, e o subtexto do "Tocar agora" é o de sempre ("sem
  // entrar em lista nenhuma"). O contrato do seletor que sobrou — três degraus,
  // 720p de padrão, a escolha grudando — é medido no `boot-nativo.test.mjs`.

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
    window.__soltarBaixa = false;
    window.__arquivo = {
      name: 'TITULO CRU DO YOUTUBE',
      // 1080p de propósito: com o teto padrão ele NÃO dispara o aviso de
      // resolução limitada (metade 9), e assim as duas metades não interferem
      // uma na outra — um aviso abriria um `previewBusy` com outra legenda, e a
      // asserção de NOME leria isso como a troca que ela existe para proibir.
      seconds: 100, height: 1080, size: 10, type: 'video/mp4',
      // OS BYTES VÊM DE UMA `data:` URL porque o `ytBaixarNativo` faz
      // `fetch(r.url)` no que o shell devolve — no aparelho é uma
      // `/saf/<token>`. O conteúdo não importa (nada o decodifica neste caso);
      // o que importa é ele não ser VAZIO, que é a única coisa que aquele
      // caminho confere antes de registrar.
      url: 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDE=',
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
    // O ESPIÃO DO REGISTRO É O DO DOWNLOAD (v1.7.6): era o `addStreamMedia`, e
    // a transmissão que o chamava saiu do app. A regra medida não mudou — o
    // nome que o app já tem VENCE o título que o shell extraiu —, mudou o
    // ponto em que ela é aplicada.
    const batizados = [];
    const origAdd = AVDB.addMedia;
    AVDB.addMedia = (blob, meta) => { batizados.push(meta && meta.name); return origAdd(blob, meta); };
    const link = await AVDB.addUrlMedia('https://www.youtube.com/watch?v=vidN', {
      kind: 'youtube', type: 'video/youtube', name: 'O NOME QUE O OPERADOR DEU', youtubeId: 'vidN',
    });
    await AVDB.listAdd('imports', link.id);
    await load();
    const acao = send(link.id);
    await new Promise((r) => setTimeout(r, 300));   // a extração ainda pendente
    window.__soltarBaixa = true;
    await acao.catch(() => {});
    window.previewBusy = orig;
    AVDB.addMedia = origAdd;
    window.__arquivo = null;
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
  // ── 10. O CENSO DA SESSÃO (v1.4.13, encolhido na v1.7.3) ───────────────
  //
  // O Registro guardava a ÚLTIMA extração e só ela, e a pergunta de uma falha
  // INTERMITENTE é outra — MEDIDO em campo: três Registros, três respostas
  // diferentes, nenhuma contando.
  //
  // DUAS DAS QUATRO CONTAGENS SAÍRAM com a transmissão direta: `pedidos` e
  // `transmitiu` respondiam *"com que frequência a projeção cai no download?"*,
  // e hoje ela cai SEMPRE — a pergunta deixou de existir. O que fica é a
  // qualidade LIMITADA, que nunca foi sobre transmitir: um download entrega
  // abaixo do pedido do mesmo jeito, e é ele que hoje entrega tudo.
  //
  // E ELA SAIU DE TRÁS DO `motivoStream` no mesmo lote. Era esse gate que a
  // fazia sumir do Registro — a contagem continuava certa e ninguém a lia.
  //
  // Medido por DELTA, e não em absoluto: as metades acima já rodaram fluxos que
  // mexem no mesmo contador, e uma asserção sobre o total amarraria esta metade
  // à ordem do arquivo.
  const censo = await pg.evaluate(async () => {
    const ler = () => Object.assign({}, ytCenso);
    const antes = ler();
    avisarResolucaoLimitada(360, 0);
    avisarResolucaoLimitada(480, 0);
    const depois = ler();
    // E O BLOCO DO REGISTRO, que é o consumidor: sem ele a contagem é um número
    // que ninguém lê — que foi exatamente o estado dela até este lote.
    //
    // `renderDiag()` MONTA e escreve em `diagTexto`, que é o que o botão de
    // copiar leva. Ler a variável é ler o artefato que chega a quem diagnostica
    // a distância — que é o único consumidor que este bloco tem.
    await renderDiag();
    return { antes, depois, texto: String(diagTexto || '') };
  });
  checar((censo.depois.limitadas - censo.antes.limitadas) === 2,
    'a qualidade limitada é contada: um download entrega abaixo do pedido do '
    + 'mesmo jeito, e ele é hoje o único caminho que entrega',
    JSON.stringify({ antes: censo.antes, depois: censo.depois }));
  checar(censo.depois.menor === 360,
    'e o MENOR valor é guardado, não o último: é ele que diz se foi um degrau '
    + 'ou o fundo do poço', censo.depois.menor);
  checar(/Qualidade do YouTube/.test(censo.texto)
    && /qualidade limitada/i.test(censo.texto) && /360p/.test(censo.texto),
    'e o REGISTRO a IMPRIME, com o menor valor junto — ela morava atrás do '
    + '`motivoStream`, que a transmissão escrevia, e sumiria do diagnóstico '
    + 'justamente agora que todo "Tocar agora" baixa',
    censo.texto.split('\n').filter((l) => /Qualidade|limitada/i.test(l)).join(' | '));
  checar(!/Transmiss..o direta/i.test(censo.texto),
    'e o bloco da TRANSMISSÃO DIRETA não aparece mais — um Registro que fala de '
    + 'um recurso removido é o log que discorda do aparelho',
    censo.texto.split('\n').filter((l) => /ransmiss/i.test(l)).join(' | '));

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
    window.__soltarBaixa = true;
    window.__arquivo = null;
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
