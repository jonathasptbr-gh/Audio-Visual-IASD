#!/usr/bin/env node
// ============================================================================
// MANTER O EPISÓDIO DA SEMANA BAIXADO (v1.8.87; sem seletor desde a v1.11.10)
//
// Pedido do operador (v1.8.87, a caixa que saiu na v1.11.10): *"faça uma opção de marcar nas coleções de provai e vede e
// do informativo mundial das missões. Essa opção fica no topo e nela diz, manter
// o provai e vede da semana baixado e atualizado na biblioteca… O sistema
// automaticamente verifica se o arquivo já existe e limpa os arquivos de semanas
// passadas e baixa se necessário apenas a mídia da semana."*
//
// ## O que ele trava, e por que cada metade existe
//
//  A. **SEM SELETOR (v1.11.10).** O operador pediu: *"Remova o seletor e faça
//     com que seja o padrão do app sempre baixar os vídeos da semana."* O card
//     não tem mais a linha "Manter o … da semana baixado" (nem classe, nem
//     caixa), e as peças do alternador saíram do código.
//  B. **SEM MARCAR NADA, BAIXA O DA SEMANA E SÓ ELE** — mesmo com a chave
//     antiga `serieAuto` gravada como DESMARCADA num aparelho que a tinha
//     usado: o padrão é ligado, e uma chave velha não pode desligá-lo calada.
//     Na qualidade padrão do operador (`ytAlturaPadrao`), pela lista de
//     retenção (`serie`). A metade "e só ele" é a que separa isto do download
//     em lote que a v1.1.21 recusou: o episódio da semana PASSADA e o da
//     SEGUINTE estão na mesma lista e não podem entrar.
//  D. **A LIMPEZA TIRA AS SEMANAS PASSADAS**, e o blob morre com o último
//     detentor — é o `listSet` do `db.js` fazendo o trabalho, não uma varredura
//     nossa.
//  E. **MAS ELA NÃO APAGA O QUE OUTRA LISTA SEGURA.** Um episódio que o
//     operador mandou ao Cronograma continua inteiro depois da limpeza. Sem
//     esta metade, "limpar as semanas passadas" apagaria o vídeo que ele
//     escolheu para o culto.
//  F. **A ORDEM É BAIXAR E DEPOIS LIMPAR.** Invertida, um download que falha
//     (rede, vídeo ainda não liberado pelo canal) deixaria o operador sem
//     NENHUM dos dois episódios. Medida com o download FALHANDO.
//  G. **SEM WI-FI CONFIRMADO NÃO BAIXA, E A LINHA DIZ ISSO.** A guarda é
//     `redeLiberadaParaBaixar` e não "não é celular" como o `syncLyrics`: aqui
//     são ~300 MB que ninguém pediu agora. O preço é que `connection.type`
//     devolve `'unknown'` em boa parte dos aparelhos e nesses a rotina nunca
//     roda sem os "Dados móveis" ligados — a FRASE é o que impede isso de ser um no-op
//     silencioso. **E "DADOS MÓVEIS" LIGADO NAS CONFIGURAÇÕES LIBERA** (v1.11.0,
//     bloco G2) — pedido do operador, perguntado se o interruptor novo
//     deveria alcançar este automático: *"Sim, incluir os dois"*.
//  H. **DESMARCAR SOLTA O ARQUIVO**, pela mesma rotina (o `listSet` recalcula a
//     lista a partir de quem está marcado) e não por um caminho próprio.
//  I. **A FOLHA DE UM EPISÓDIO JÁ BAIXADO OMITE A QUALIDADE** — *"não precisa
//     mais dessa ação"* —, e a de um episódio AUSENTE continua com ela. As duas
//     metades, porque uma sozinha aprova o seletor sumindo de todo vídeo.
//
//   node tools/serie-mantem-a-semana.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperarCortina, esperar, porque, checar, falhas } from './arnes.mjs';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');

// A PONTE DE MENTIRA, MÍNIMA. Este oráculo não exercita a extração do canal: ele
// PLANTA a lista de episódios, porque o que ele mede são as datas em volta do
// sábado corrente — e uma fixture de canal fixa envelheceria a cada semana. O
// percurso canal → lista tem oráculo próprio (`boot-nativo`), e a regra pura
// tem o `serie.test.mjs`.
//
// `ytFetch` e os outros de download NÃO são stubados aqui: quem é interceptado é
// o `ytArquivo` do app (ver `armarDownload`). A razão é a mesma que faz o
// `transporte-sem-cena` interceptar o `cmd` — o que se afirma é a DECISÃO da
// rotina, e um download de mentira atravessando o `ytBaixarNativo` inteiro
// provaria o arnês.
const PONTE = `(() => {
  const comCallId = new Set(['displays','listFolder','pickDoc','pickFolder','ytSearch','ytFetch',
    'ytFetchAte','ytFetchAudio','ytStream','deckPages','deckExportUrl','castTarget','saidaDeAudioAlvo',
    'espelhoEstado','espelhoDiag','espelhoCertEstado','apkProcurar','otaPending','otaApply',
    'otaCheck','otaDiag','ytDiag','farolEstado','ytCanalPlaylists','ytPlaylist','ytDetalhes',
    'areaTransferencia','pacoteDiag','cifraHtml','espelhoRedes']);
  const vazio = { displays: [], listFolder: [], pickDoc: [], ytSearch: [],
    espelhoEstado: { ligado: false, telas: [] }, espelhoDiag: {},
    espelhoCertEstado: { temCert: false }, castTarget: { label: 'Tela de teste' },
    farolEstado: { conta: true, ultimo: 0, diag: 'de teste' } };
  const B = {
    shellVersion: () => 72,
    role: () => 'controle',
    appVersion: () => '1.98-teste',
    takeShare: () => '',
    busPost: () => {},
    otaConfirm: () => {},
  };
  const nomes = Object.keys(vazio).concat([...comCallId], ['apkInstalar','bgProgress',
    'bgConcluido','captureVolumeKeys','deckDiscard','espelhoDesligar','espelhoLigar','keepAlive',
    'nowPlaying','openCast','abrirSaidaDeAudio','openExternal','systemVolume','temaClaro','ytCancel','ytDiscard',
    'projecaoLocal','compartilharTexto','salvarTexto','copiarTexto']);
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

const servidor = servirEstatico(raiz);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador();
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true });
await semRedeExterna(ctx);
const pg = await ctx.newPage();

// A SÉRIE MEDIDA é a primeira do catálogo (o Provai e Vede), e a segunda entra
// no bloco B para provar que a marca é POR COLEÇÃO — marcar uma não liga a
// outra.
const SERIE = 'serie-provai-vede-2026';
const OUTRA = 'serie-informativo-missoes-2026';

// OS TRÊS EPISÓDIOS, DATADOS EM VOLTA DO SÁBADO CORRENTE. As datas saem de
// `AVSerie.sabadoDaSemana()` DENTRO da página — a mesma função que o app usa —,
// e não de um calendário escrito aqui: a semana adventista vai de domingo a
// sábado, e uma conta própria no oráculo divergiria da do app exatamente nos
// três dias em que a v1.2.19 já divergiu.
const plantar = () => pg.evaluate((ids) => {
  // `serieData` é `{ mes, dia }` — o ANO vem do catálogo (`serie.ano`), e é por
  // isso que ele não aparece aqui: escrevê-lo faria o oráculo afirmar um
  // formato que o `serie.js` não usa.
  const coll = allCollections().find((c) => c.id === ids.serie);
  const sab = AVSerie.sabadoDaSemana();
  const desloca = (n) => {
    const d = new Date(coll.serie.ano, sab.mes - 1, sab.dia + n);
    return { mes: d.getMonth() + 1, dia: d.getDate() };
  };
  const faixa = (nome, quando) => ({
    id_music: nome, name: nome, ytUrl: 'y/' + nome, seconds: 300,
    canal: 'Provai e Vede | Oficial', serieData: quando,
  });
  collState[ids.serie] = {
    indexSyncedAt: Date.now(), serieDiarioEm: Date.now(),
    songs: [faixa('passada', desloca(-7)), faixa('semana', desloca(0)),
      faixa('seguinte', desloca(7))],
  };
  collState[ids.outra] = { indexSyncedAt: Date.now(), songs: [] };
  // O VEREDITO DO APP sobre cada uma das três, e não uma conta nossa: é ele que
  // a premissa afirma.
  return {
    sabado: sab,
    daSemana: collState[ids.serie].songs
      .filter((s) => AVSerie.ehDoSabadoAtual(s.serieData, coll.serie))
      .map((s) => s.id_music),
  };
}, { serie: SERIE, outra: OUTRA });

// O DOWNLOAD, INTERCEPTADO. `armarDownload(true)` devolve um registro novo (e o
// grava no banco, na lista que a rotina pediu — é isso que o `ytArquivo` de
// verdade faz); `armarDownload(false)` falha, que é o caso do bloco F.
const armarDownload = (ok) => pg.evaluate((deuCerto) => {
  window.__baixados = [];
  // `addMedia(blob, meta)` — o blob primeiro, e o `id` é DELE, não nosso: é a
  // mesma assinatura que o `ytBaixarNativo` chama, e escrever um id à mão aqui
  // faria a fixture divergir do caminho que ela imita.
  window.__plantarMidia = (yid, nome, lista) => AVDB.addMedia(
    new Blob([new Uint8Array(8)], { type: 'video/mp4' }),
    { name: nome, kind: 'video', type: 'video/mp4', youtubeId: yid, list: lista },
  );
  window.ytArquivo = async (alvo, opts) => {
    window.__baixados.push({ id: alvo && alvo.id, altura: (opts && opts.altura) | 0,
      lista: opts && opts.lista, aviso: opts && opts.aviso });
    if (!deuCerto) return null;
    return await window.__plantarMidia(alvo.id, alvo.name, (opts && opts.lista) || 'imports');
  };
}, ok);

const ler = () => pg.evaluate(async (ids) => {
  const lista = await AVDB.listIds('serie');
  const existe = async (yid) => {
    const r = await AVDB.mediaByYoutube(yid, 'video');
    return !!(r && r.blob);
  };
  return {
    baixados: (window.__baixados || []).slice(),
    retidos: lista.slice(),
    passada: await existe('passada'),
    semana: await existe('semana'),
    seguinte: await existe('seguinte'),
  };
}, { serie: SERIE, outra: OUTRA });

// O CARD ABERTO da série — a linha da opção e o destaque, na ORDEM do DOM.
//
// Ele é construído pela PRÓPRIA `renderCollectionCard`, e não procurado numa
// lista já desenhada: os cards não carregam o id da coleção em atributo nenhum,
// e um `nth-child` amarraria o oráculo à ordem do acervo. É a técnica que o
// `boot-nativo` usa para a LINHA (`hymnResultRow`), um nível acima.
const cartao = () => pg.evaluate((id) => {
  const coll = allCollections().find((c) => c.id === id);
  ui(id).expanded = true; ui(id).shown = 100;
  const li = renderCollectionCard(coll);
  const aberto = li.querySelector('.coll-open');
  if (!aberto) return null;
  const dest = aberto.querySelector('.serie-destaque');
  return {
    // SEM A CAIXA (v1.11.10): nem a classe da linha, nem uma caixa de marcação
    // no topo do card — o seletor saiu a pedido do operador.
    temAuto: !!aberto.querySelector('.serie-auto'),
    temCaixa: !!aberto.querySelector('[role="checkbox"], .song-menu-check'),
    temDestaque: !!dest,
    primeiro: aberto.firstElementChild ? aberto.firstElementChild.className : '',
  };
}, SERIE);

try {
  await pg.addInitScript(PONTE);
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(
    () => window.__NATIVE__ === true && window.AVDB && window.AVSerie
      && typeof window.__avBack === 'function',
    null, { timeout: 30000 },
  );
  await esperarCortina(pg);
  await pg.evaluate(() => setAppMode('full'));

  // A REDE. `isConfirmedWifi` lê `navigator.connection.type`, e o Chromium não o
  // expõe: sem esta definição a guarda responde `'unknown'` e o bloco C mediria
  // a ausência do recurso em vez do recurso.
  const rede = (tipo) => pg.evaluate((t) => {
    Object.defineProperty(navigator, 'connection', { value: { type: t }, configurable: true });
  }, tipo);
  await rede('wifi');

  const datas = await plantar();
  checar(datas.daSemana.length === 1 && datas.daSemana[0] === 'semana',
    'A PREMISSA: três episódios plantados, e o PRÓPRIO APP diz que só o do meio '
    + 'é o desta semana — as datas saem do `AVSerie.sabadoDaSemana()` e o '
    + 'veredito do `ehDoSabadoAtual`, nunca de um calendário escrito aqui',
    datas);

  // ── A. SEM SELETOR (v1.11.10) ───────────────────────────────────────────
  // *"Remova o seletor e faça com que seja o padrão do app sempre baixar os
  // vídeos da semana."* A linha de opção que ocupava o topo do card saiu inteira.
  const cx = await cartao();
  checar(cx && cx.temAuto === false && cx.temCaixa === false,
    'A · o card aberto da série NÃO tem mais a linha "Manter o … da semana '
    + 'baixado" — nem a classe dela, nem uma caixa de marcação', cx);
  checar(cx.temDestaque && cx.primeiro === 'serie-destaque',
    'e o destaque do sábado passou a ser o PRIMEIRO filho do card', cx);
  const semFuncoes = await pg.evaluate(() => ({
    linha: typeof serieAutoLinha, alterna: typeof alternarSerieAuto, conjunto: typeof serieAuto,
  }));
  checar(semFuncoes.linha === 'undefined' && semFuncoes.alterna === 'undefined'
      && semFuncoes.conjunto === 'undefined',
    'e as peças da caixa saíram do código (`serieAutoLinha`, `alternarSerieAuto` '
    + 'e o Set `serieAuto`): um alternador que ninguém desenha é código morto que '
    + 'convida o próximo lote a religá-lo', semFuncoes);

  // ── B. SEM MARCAR NADA, BAIXA O DA SEMANA E SÓ ELE ──────────────────────
  // A chave ANTIGA, de um aparelho em que o operador tinha DESMARCADO a opção, é
  // ignorada: o padrão é ligado, e uma chave velha não pode desligá-lo calada.
  await pg.evaluate((id) => AVDB.setState('serieAuto', { [id]: false }), SERIE);
  await armarDownload(true);
  await pg.evaluate(() => manterSeriesDaSemana());
  await esperar(pg, () => !serieAutoRodando && (window.__baixados || []).length > 0, null, 10000);
  const quente = await ler();
  checar(quente.baixados.length === 1 && quente.baixados[0].id === 'semana',
    'B · SEM NENHUMA MARCA — e com a chave antiga `serieAuto` gravada como '
    + 'DESMARCADA — a rotina baixa O EPISÓDIO DESTA SEMANA, um só: a semana '
    + 'PASSADA e a SEGUINTE estão na mesma lista e não entram. É o que separa isto '
    + 'do download em lote que a v1.1.21 recusou', quente.baixados);
  const teto = await pg.evaluate(() => ytAlturaPadrao());
  checar(quente.baixados[0].altura === teto,
    'na QUALIDADE PADRÃO do operador (`ytAlturaPadrao`), e não num teto próprio '
    + 'desta rotina — *"ele baixa na qualidade padrão que o usuário tem em '
    + 'seleção"*', { pediu: quente.baixados[0].altura, padrao: teto });
  checar(quente.baixados[0].lista === 'serie' && quente.baixados[0].aviso === 'nenhum',
    'pela lista de RETENÇÃO (`serie`, do `db.js`) e sem cartão na tela: nenhuma '
    + 'superfície está esperando por este download', quente.baixados[0]);
  checar(quente.retidos.length === 1 && quente.semana === true,
    'e o arquivo fica RETIDO na lista', quente);

  // ===== E A RETENÇÃO É DETENTOR DE VERDADE (o `LISTS` do `db.js`) =====
  //
  // **Escrever na lista não é reter.** Ela é uma chave de `state` como qualquer
  // outra; o que a torna um DETENTOR DE REFERÊNCIA é estar em `LISTS`, que é o
  // que o `lerDetentores` varre. Fora dela, o arquivo é órfão e o `gcOrfaos` da
  // abertura seguinte o apaga — a lista continuaria cheia, apontando para bytes
  // que não existem, e o app rebaixaria os mesmos ~300 MB toda semana.
  //
  // MEDIDO por reversão: sem esta metade, tirar `'serie'` do `LISTS` passa por
  // TODO o resto deste arquivo. É o `gcOrfaos` que separa as duas escritas, e é
  // ele que roda na abertura de verdade.
  const sobreviveu = await pg.evaluate(async () => {
    const apagados = await AVDB.gcOrfaos();
    const r = await AVDB.mediaByYoutube('semana', 'video');
    return { apagados, vivo: !!(r && r.blob), retidos: (await AVDB.listIds('serie')).length };
  });
  checar(sobreviveu.vivo && sobreviveu.retidos === 1,
    'e o `gcOrfaos` NÃO o apaga: a lista `serie` está em `LISTS` (`db.js`), '
    + 'logo ela SEGURA o blob. Escrever na lista sem isso seria um índice '
    + 'apontando para bytes que o coletor da abertura já levou',
    sobreviveu);

  // ── C2. JÁ BAIXADO, NÃO BAIXA DE NOVO ───────────────────────────────────
  // *"o sistema automaticamente verifica se o arquivo já existe"*. Sem esta
  // metade a rotina rebaixaria o mesmo episódio a cada `visibilitychange`.
  await armarDownload(true);
  await pg.evaluate(() => manterSeriesDaSemana());
  const denovo = await ler();
  checar(denovo.baixados.length === 0 && denovo.semana === true,
    'com o arquivo JÁ NO APARELHO a rotina não baixa nada — ela é chamada em '
    + 'todo `visibilitychange`, e sem a verificação seriam 300 MB por volta ao '
    + 'app', denovo);

  // ── D. A LIMPEZA DAS SEMANAS PASSADAS ───────────────────────────────────
  // O cenário é o do sábado seguinte: o episódio da semana PASSADA está no
  // aparelho e retido, como a rotina o deixou sete dias antes.
  await pg.evaluate(() => window.__plantarMidia('passada', 'passada', 'serie'));
  const antesDaLimpeza = await ler();
  checar(antesDaLimpeza.passada === true && antesDaLimpeza.retidos.length === 2,
    'A PREMISSA: os DOIS episódios estão retidos, como no sábado seguinte',
    antesDaLimpeza);
  await armarDownload(true);
  await pg.evaluate(() => manterSeriesDaSemana());
  const limpo = await ler();
  checar(limpo.retidos.length === 1 && limpo.semana === true,
    'a rotina RETÉM só o da semana corrente — *"limpa os arquivos de semanas '
    + 'passadas"*', limpo);
  checar(limpo.passada === false,
    'e o blob da semana passada MORREU com o último detentor: é o `listSet` do '
    + '`db.js` coletando na mesma transação, não uma varredura nossa', limpo);

  // ── E. MAS NÃO O QUE OUTRA LISTA SEGURA ─────────────────────────────────
  const doCronograma = await pg.evaluate(async () => {
    const rec = await window.__plantarMidia('seguinte', 'seguinte', 'serie');
    await AVDB.listAdd('imports', rec.id);
    return rec.id;
  });
  await armarDownload(true);
  await pg.evaluate(() => manterSeriesDaSemana());
  const comDono = await ler();
  checar(comDono.seguinte === true && !comDono.retidos.includes(doCronograma),
    'a limpeza SOLTA o episódio que outra lista segura, e o blob FICA: um vídeo '
    + 'que o operador mandou ao Cronograma não pode ser apagado por uma rotina '
    + 'de manutenção', comDono);

  // ── F. A ORDEM: BAIXAR E DEPOIS LIMPAR ──────────────────────────────────
  // Medida com o download FALHANDO — é o caso que a ordem existe para cobrir (o
  // vídeo ainda não liberado pelo canal, a rede que caiu).
  // O CENÁRIO É LIMPO PELO `listSet`, que é o coletor de verdade: `listSet(…, [])`
  // solta tudo e o que não tiver outro detentor morre na mesma transação. Não há
  // `mediaDelete` no `AVDB` de propósito — quem apaga um blob é sempre o coletor.
  await pg.evaluate(async () => {
    await AVDB.listSet('serie', []);
    await window.__plantarMidia('passada', 'passada', 'serie');
  });
  const antesDaFalha = await ler();
  checar(antesDaFalha.passada === true && antesDaFalha.semana === false,
    'A PREMISSA da ordem: só a semana passada está no aparelho', antesDaFalha);
  await armarDownload(false);
  await pg.evaluate(() => manterSeriesDaSemana());
  const falhou = await ler();
  checar(falhou.baixados.length === 1 && falhou.semana === false,
    'o download foi TENTADO e falhou', falhou);
  checar(falhou.passada === true && falhou.retidos.length === 1,
    'e a semana PASSADA continua RETIDA e no aparelho: a lista só encolhe com o '
    + 'SUBSTITUTO na mão. MEDIDO — a ordem "baixar, depois limpar" não bastava: '
    + 'com o download falhando a lista recalculada saía vazia e o `listSet` '
    + 'matava o episódio da semana passada de qualquer jeito, que é o caso '
    + 'NORMAL de segunda a sexta (o canal ainda não liberou o vídeo)', falhou);

  // ── G. SEM WI-FI CONFIRMADO NÃO BAIXA, E A LINHA DIZ ISSO ───────────────
  await rede('cellular');
  await armarDownload(true);
  await pg.evaluate(() => manterSeriesDaSemana());
  const movel = await ler();
  checar(movel.baixados.length === 0,
    'EM REDE MÓVEL a rotina não baixa: são ~300 MB que ninguém pediu agora, e '
    + 'gastar o plano de dados de quem não olhou a tela é o pior desfecho deste '
    + 'recurso', movel);
  // A FRASE DO WI-FI MUDOU DE CASA (v1.8.88): saiu do subtítulo e virou a linha
  // de STATUS do card, que é onde os outros estados dele já moram. Ela é a
  // única das antigas que sobrevive, e por um motivo que não é decoração —
  // sem ela o recurso é uma marca acesa com nada acontecendo, para sempre.
  const statusMovel = await pg.evaluate(async (id) => {
    // O caminho de verdade: o aviso do card é o que dispara a leitura do disco
    // e, com ela, o impedimento.
    serieAutoAviso(allCollections().find((c) => c.id === id));
    await new Promise((f) => setTimeout(f, 200));
    // `ui(id).status` é onde o `setCollStatus` grava — a MESMA fonte que o card
    // desenha, e não uma segunda leitura da tela.
    return String(ui(id).status || '');
  }, SERIE);
  checar(/Wi-Fi/i.test(statusMovel),
    'e o CARD DIZ ISSO na linha de status — `connection.type` responde '
    + '`unknown` em boa parte dos aparelhos, e sem a frase o download '
    + 'automático seria um recurso que nunca roda, sem nada na tela', statusMovel);

  // ── G2. "DADOS MÓVEIS" LIGADO NAS CONFIGURAÇÕES LIBERA O DOWNLOAD (v1.11.0) ──
  //
  // Pedido do operador, perguntado se o interruptor novo (*"permitir ou não o
  // uso de dados móveis para as funções do app"*) deveria alcançar este
  // automático também: *"Sim, incluir os dois"*. A REDE continua 'cellular' —
  // a premissa do bloco G não muda, e é o que prova que quem libera aqui é a
  // OPÇÃO, não a rede — só `permitirDadosMoveis` liga.
  await pg.evaluate(() => setPermitirDadosMoveis(true));
  await armarDownload(true);
  await pg.evaluate(() => manterSeriesDaSemana());
  await esperar(pg, () => !serieAutoRodando && (window.__baixados || []).length > 0, null, 10000);
  const comDadosMoveis = await ler();
  checar(comDadosMoveis.baixados.length === 1 && comDadosMoveis.semana === true,
    'G2 · com "Dados móveis" ligado, a rotina BAIXA mesmo em rede móvel — a '
    + 'opção nova cobre este automático, por pedido explícito do operador',
    comDadosMoveis);
  await pg.evaluate(() => setPermitirDadosMoveis(false));
  await rede('wifi');

  // ── I. A FOLHA DE UM EPISÓDIO BAIXADO OMITE A QUALIDADE ─────────────────
  // As DUAS metades: sem arquivo a escada continua na folha. Uma sozinha
  // aprovaria o seletor sumindo de todo vídeo do app.
  const folha = () => pg.evaluate(async (id) => {
    const coll = allCollections().find((c) => c.id === id);
    const alvo = document.createElement('div');
    document.body.appendChild(alvo);
    const abrir = async (s) => {
      songMenuFor = null;
      const r = serieComoYoutube(coll, s);
      r.semQualidade = !!(await serieArquivoDoEpisodio(s));
      limparFolha(alvo);
      openYtMenu(r, alvo);
      // Os degraus da escada de qualidade, pelo texto dos chips.
      return [...alvo.querySelectorAll('.misc-chip, .seg-btn, button')]
        .map((b) => (b.textContent || '').trim()).filter((t) => /^\d{3,4}p$/.test(t));
    };
    const semana = collSongs(id).find((s) => s.id_music === 'semana');
    const seguinte = collSongs(id).find((s) => s.id_music === 'seguinte');
    const r = { baixado: await abrir(semana), ausente: await abrir(seguinte) };
    alvo.remove();
    songMenuFor = null;
    return r;
  }, SERIE);
  await pg.evaluate(async (idDoCronograma) => {
    await window.__plantarMidia('semana', 'semana', 'serie');
    // O episódio SEGUINTE tem de sair do aparelho: é ele que mede a metade
    // "ausente" da escada, e o bloco E o deixou no Cronograma.
    await AVDB.listRemove('imports', idDoCronograma);
    await AVDB.listSet('serie', (await AVDB.listIds('serie')).filter((x) => x !== idDoCronograma));
  }, doCronograma);
  const escada = await folha();
  checar(escada.ausente.length > 1,
    'A PREMISSA: num episódio AUSENTE a escada de qualidade está na folha — é '
    + 'ela que decide o download', escada.ausente);
  checar(escada.baixado.length === 0,
    'e num episódio JÁ BAIXADO ela SOME: *"omite a questão da qualidade, pois '
    + 'não precisa mais dessa ação"*. Com bytes no aparelho o `ytArquivo` '
    + 'reaproveita o registro e o teto não é consultado — deixá-la ali '
    + 'prometeria que tocar em "480p" traria o vídeo menor, e o que ela faria '
    + 'de fato é gravar um padrão novo para o PRÓXIMO vídeo, calado',
    escada.baixado);

  // ── J. NO MODO FÁCIL A SÉRIE MOSTRA SÓ A SEMANA (v1.11.11) ──────────────
  // *"exiba apenas a seção do vídeo da semana, e não a lista completa"*. As DUAS
  // metades, porque uma sozinha aprovaria o card sem lista em TODO modo: o
  // avançado segue com a lista inteira (menos o episódio em destaque, que sai
  // dela), e o Modo Fácil fica só com o destaque.
  const cartaoDoModo = (modo) => pg.evaluate((a) => {
    setAppMode(a.modo);
    const coll = allCollections().find((c) => c.id === a.id);
    ui(a.id).expanded = true; ui(a.id).shown = 100;
    const aberto = renderCollectionCard(coll).querySelector('.coll-open');
    return {
      destaque: !!aberto.querySelector('.serie-destaque'),
      lista: aberto.querySelectorAll(':scope > ul.coll-songs > li').length,
      semana: aberto.querySelectorAll('.serie-destaque .lib-item, .serie-destaque li').length,
    };
  }, { modo, id: SERIE });
  const noAvancado = await cartaoDoModo('full');
  const noFacil = await cartaoDoModo('simple');
  await pg.evaluate(() => setAppMode('full'));
  checar(noAvancado.destaque && noAvancado.semana >= 1 && noAvancado.lista >= 2,
    'J · no AVANÇADO o card tem o destaque E a lista dos outros episódios — a '
    + 'restrição é só do Modo Fácil, e sem esta metade "sem lista em todo modo" passaria',
    noAvancado);
  checar(noFacil.destaque && noFacil.semana >= 1 && noFacil.lista === 0,
    'J · no MODO FÁCIL o card tem SÓ o destaque da semana: nenhuma linha da lista '
    + 'completa (a semana passada e a seguinte, que estão no índice, não aparecem)',
    noFacil);

} finally {
  await navegador.close();
  await new Promise((r) => servidor.close(r));
}

console.log(falhas.length ? '\n' + falhas.length + ' falha(s)' : '\ntudo certo');
process.exit(falhas.length ? 1 : 0);
