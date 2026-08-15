// A CENA: o que o telão mostra, o que o operador ajusta nela e o que ele LÊ
// sobre ela (v5.142 — o lote de relatos de 08/08).
//
// ## Por que ele existe
//
// A reconexão do dongle é o caminho menos testável do app à mão: exige uma TV,
// um dongle e o timing de derrubá-lo no momento certo. E é um caminho que roda
// na frente da congregação, sozinho, sem ninguém pedindo — o que ele fizer de
// errado aparece projetado.
//
// A regra que este teste trava é a que faltava: **`currentId` não é "está em
// cena"**. Ele sobrevive de propósito ao stop e ao fim natural (é o que permite
// repetir a faixa com o ▶), então reenviar a cena por ele fazia o telão acordar
// tocando o que o operador tinha parado, ou ressuscitar a música que acabou —
// os dois relatos de 08/08. Quem responde a pergunta certa é `midiaNoAr`.
//
// O mesmo estado corrige o ▶ depois do stop: ele decidia por
// `preview.getCurrent()`, que só fica nulo no FIM do fade de saída — o `play`
// dado antes disso era apagado pelo `clear` que terminava atrás, e o operador
// aprendeu a tocar em stop duas vezes para "destravar".
//
//   node tools/reconexao.test.mjs
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

await new Promise((r) => servidor.listen(0, r));
const porta = servidor.address().port;
const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
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
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(
    () => window.AVDB && window.createStage && typeof window.__avBack === 'function',
    null, { timeout: 20000 },
  );
  await pg.evaluate(() => setAppMode('full'));

  // O barramento é o único observador honesto: é por ele que o telão recebe a
  // cena, e é exatamente o que um telão que reconecta veria.
  await pg.evaluate(() => {
    window.__espiao = [];
    const original = AVDB.sendCommand;
    AVDB.sendCommand = (m) => { window.__espiao.push(m); return original(m); };
  });

  // A espera existe porque nem toda ação do app é síncrona: o `▶` cai em
  // `send()`, que lê o registro do IndexedDB ANTES de mandar o `load`. Ler o
  // espião no retorno do clique pegaria a lista vazia — e o teste passaria a
  // afirmar o contrário do que quer verificar.
  const cena = async (fn) => pg.evaluate(async (corpo) => {
    window.__espiao.length = 0;
    // eslint-disable-next-line no-new-func
    await new Function('return (' + corpo + ')()')();
    await new Promise((r) => setTimeout(r, 200));
    return window.__espiao.map((m) => m.type);
  }, fn.toString());

  // ---- Uma mídia de verdade em cena ----
  const id = await pg.evaluate(async () => {
    const rec = await AVDB.addMedia(new Blob([new Uint8Array(64)], { type: 'video/mp4' }), {
      name: 'Louvor de teste', type: 'video/mp4', kind: 'video', list: 'imports',
    });
    await load();
    await send(rec.id);
    return rec.id;
  });
  checar(await pg.evaluate(() => midiaNoAr), 'projetar uma mídia marca que há cena no telão');

  let tipos = await cena(async () => { resendSceneToDisplay('telao-1'); });
  checar(tipos.includes('load'), 'e um telão que reconecta agora RECEBE a cena de volta');

  // ---- STOP: o telão está vazio, e a reconexão não pode ressuscitar nada ----
  await pg.evaluate(() => stopClear());
  checar(!(await pg.evaluate(() => midiaNoAr)), 'o stop marca o telão como vazio NA HORA (não no fim do fade)');
  checar(await pg.evaluate(() => currentId) === id,
    'e o item continua SELECIONADO — é o que permite repetir com o ▶');
  tipos = await cena(async () => { resendSceneToDisplay('telao-2'); });
  checar(!tipos.includes('load'),
    'reconectar depois do stop NÃO reenvia a mídia (era o "vídeo engatilhado" no telão)');

  // ---- O ▶ logo depois do stop, com o fade ainda correndo ----
  // É o defeito dos "dois toques no stop": `preview.getCurrent()` ainda devolve
  // o registro durante todo o esmaecimento do `clearFaded`.
  const aindaTemPreview = await pg.evaluate(() => !!preview.getCurrent());
  const acao = await cena(async () => { playPauseEl.click(); });
  checar(acao.includes('load'),
    'o ▶ logo depois do stop RECARREGA (um só toque), mesmo com o fade em curso'
    + (aindaTemPreview ? '' : ' [preview já limpa neste ambiente]'));
  checar(!acao.includes('play'),
    'e não manda um "play" que o clear em curso apagaria — era isso que parecia botão morto');

  // ---- FIM NATURAL: mesma regra ----
  await pg.evaluate(async () => { await send(currentId); });
  checar(await pg.evaluate(() => midiaNoAr), 'tocar de novo recoloca a cena no ar');
  await pg.evaluate(() => { repeat = 'off'; resetAfterEnd(); });
  checar(!(await pg.evaluate(() => midiaNoAr)),
    'a música que ACABA também deixa o telão vazio (o wallpaper é o repouso)');
  tipos = await cena(async () => { resendSceneToDisplay('telao-3'); });
  checar(!tipos.includes('load'),
    'e reconectar depois do fim não traz a faixa de volta (a "primeira tela/thumbnail" do relato)');

  // ---- O SEGUNDO TOQUE, COM ÁUDIO DE FUNDO (v5.173) ----
  //
  // A v5.165 fez "tocar de novo no que está no ar = tirar do ar" e perguntava
  // `item.id === currentId`. Só que uma cena de roteiro convive com uma mídia
  // por baixo — é para isso que a independência áudio × texto existe —, e
  // `currentId` é o ÚLTIMO item enviado: no instante em que o louvor de fundo
  // entra, ele deixa de ser o versículo. O segundo toque parava de funcionar
  // EXATAMENTE no caso que justificava o recurso, e a única saída voltava a ser
  // o Parar, que leva a música junto. Foi o relato do operador.
  //
  // Este bloco é o cenário dele, inteiro: cena projetada, música por baixo, e o
  // toque que tira só a cena.
  const cenaId = await pg.evaluate(async () => {
    const rec = await AVDB.addCue('message', { text: 'Aviso do teste' }, { name: 'Aviso', list: 'imports' });
    await load();
    return rec.id;
  });
  const audioId = await pg.evaluate(async () => {
    const rec = await AVDB.addMedia(new Blob([new Uint8Array(64)], { type: 'audio/mp4' }), {
      name: 'Fundo de teste', type: 'audio/mp4', kind: 'audio', list: 'imports',
    });
    await load();
    return rec.id;
  });

  await pg.evaluate(async (id) => { await send(id); }, cenaId);
  checar(await pg.evaluate(() => cenaDeRoteiroNoAr()), 'a cena de roteiro entra no ar');
  checar(await pg.evaluate((id) => noArAgora({ id, kind: 'cue', cue: 'message' }), cenaId),
    'e o segundo toque nela é reconhecido como "tirar do ar"');

  // A MÚSICA POR BAIXO — o passo que quebrava tudo.
  await pg.evaluate(async (id) => { await send(id); }, audioId);
  checar(await pg.evaluate(() => cenaDeRoteiroNoAr()),
    'o áudio de fundo NÃO derruba a cena (independência áudio × texto)');
  checar(await pg.evaluate(() => currentId) === audioId,
    'e `currentId` passa a ser a MÚSICA — era isto que escondia a cena do segundo toque');
  checar(await pg.evaluate((id) => noArAgora({ id, kind: 'cue', cue: 'message' }), cenaId),
    'e a cena CONTINUA reconhecida como no ar — a régua agora é `cueNoArId`, não `currentId`');
  checar(await pg.evaluate((id) => linhaAtiva(id), cenaId),
    'a linha dela segue realçada: duas camadas no ar, dois realces');
  checar(await pg.evaluate((id) => linhaAtiva(id), audioId),
    'e a da música também');

  // E O TOQUE TIRA SÓ A CENA. `clear` aqui seria o Parar — e levaria o louvor.
  const soACena = await pg.evaluate(async (id) => {
    window.__espiao.length = 0;
    await onTap({ id, kind: 'cue', cue: 'message' });
    await new Promise((r) => setTimeout(r, 200));
    return window.__espiao.map((m) => m.type);
  }, cenaId);
  checar(!(await pg.evaluate(() => cenaDeRoteiroNoAr())), 'o segundo toque tira a cena do ar');
  checar(await pg.evaluate(() => midiaNoAr),
    'e a MÚSICA DE FUNDO continua no ar — era este o risco de usar o Parar');
  // E O COMANDO CERTO SAI. `clearManualText` é bookkeeping — ele zera a sessão
  // e não manda nada ao telão. Sem o `text-hide`, o segundo toque apagava o
  // estado do Controle e deixava o versículo PROJETADO: é literalmente o "tocar
  // novamente não remove no player" do relato.
  checar(soACena.includes('text-hide'),
    'e o `text-hide` SAI — é ele que tira da tela, não o `clearManualText`',
    JSON.stringify(soACena));
  checar(!soACena.includes('clear'),
    'nenhum `clear` é enviado: o desligamento é POR CAMADA', JSON.stringify(soACena));
  checar(!(await pg.evaluate((id) => linhaAtiva(id), cenaId)),
    'e o realce da cena sai, enquanto o da música fica');

  // ---- E O SIMÉTRICO: TIRAR A MÚSICA E DEIXAR A CENA (v5.178) ----
  //
  // Era a metade que faltava, e a mais cara das duas: até aqui o segundo toque
  // numa MÍDIA chamava `stopClear()`, que é o Parar do transporte — ele encerra
  // a CENA INTEIRA. Com um louvor de fundo sob a contagem regressiva de
  // abertura (o uso normal, e o que a independência áudio × texto existe para
  // permitir), tirar a música levava o cronômetro junto, e a única saída era
  // parar tudo e reprojetar na frente da congregação.
  await pg.evaluate(async (ids) => { await send(ids[0]); await send(ids[1]); },
    [cenaId, audioId]);
  checar(await pg.evaluate(() => cenaDeRoteiroNoAr()) && await pg.evaluate(() => midiaNoAr),
    'com as duas camadas no ar de novo');

  const soAMidia = await pg.evaluate(async (id) => {
    window.__espiao.length = 0;
    await onTap({ id, kind: 'audio' });
    await new Promise((r) => setTimeout(r, 200));
    return window.__espiao.map((m) => m.type);
  }, audioId);
  checar(!(await pg.evaluate(() => midiaNoAr)), 'o segundo toque na música tira a MÚSICA do ar');
  checar(await pg.evaluate(() => cenaDeRoteiroNoAr()),
    'e a CENA DE ROTEIRO continua no ar — era este o risco de usar o Parar');
  // O comando é `media-clear`, e o `clear` NÃO pode sair: é ele que chama
  // `hideText` no Display. Um `clear` aqui apagaria o cronômetro sem que nada
  // no Controle o dissesse — o mesmo modo de falhar do `text-hide` que faltava.
  checar(soAMidia.includes('media-clear'),
    'e o comando é o `media-clear` — o desligamento por camada, do outro lado',
    JSON.stringify(soAMidia));
  checar(!soAMidia.includes('clear'),
    'nenhum `clear` é enviado: ele encerraria a Camada de Texto junto',
    JSON.stringify(soAMidia));
  checar(!(await pg.evaluate((id) => linhaNoAr(id), audioId)),
    'a linha da música deixa de dizer "No ar"');
  checar(await pg.evaluate((id) => linhaNoAr(id), cenaId),
    'e a da cena continua dizendo — cada linha fala da SUA camada');
  // E o Parar de verdade continua sendo o Parar: ele leva as duas.
  await pg.evaluate(() => stopClear());
  checar(!(await pg.evaluate(() => cenaDeRoteiroNoAr())) && !(await pg.evaluate(() => midiaNoAr)),
    'e o Parar do transporte segue encerrando a CENA INTEIRA — ele não virou por camada');

  // ---- O SELO "● No ar" (v5.174) ----
  //
  // "Atual" e "no ar" eram a MESMA marca — um contorno em accent —, e depois de
  // um Parar o item continuava marcado sem estar no telão. Sem separar os dois,
  // a linha em que o segundo toque tem efeito não é reconhecível, e o recurso
  // depende de o operador lembrar em que estado ele deixou a tela.
  const selo = async (id) => pg.evaluate((x) => {
    const el = document.querySelector('.lib-item[data-id="' + x + '"]');
    if (!el) return null;
    return {
      noAr: el.classList.contains('no-ar'),
      ativo: el.classList.contains('active'),
      texto: (el.querySelector('.row-live') || {}).textContent || '',
    };
  }, id);

  await pg.evaluate(async (ids) => { await send(ids[0]); await send(ids[1]); },
    [cenaId, audioId]);
  const daCena = await selo(cenaId);
  const daMusica = await selo(audioId);
  checar(!!daCena && daCena.noAr && /No ar/.test(daCena.texto),
    'a cena no ar mostra o selo "● No ar" na própria linha', JSON.stringify(daCena));
  checar(!!daMusica && daMusica.noAr && /No ar/.test(daMusica.texto),
    'e a música de fundo TAMBÉM — as duas camadas estão no telão', JSON.stringify(daMusica));

  // ---- O PARAR MORA NA GAVETA DE AÇÕES, COM OS OUTROS (v5.177 → v5.257) ----
  //
  // A v5.177 tinha feito o botão de parar TOMAR O LUGAR da estrela e do
  // arrastar na linha no ar — a direita oferecia, a milímetros do gesto mirado,
  // as duas coisas que ninguém quer fazer com o item que está na frente da
  // congregação. A v5.257 resolve isso de uma vez e para TODA linha: a direita
  // passou a ter um botão só (o ⋮) e os quatro moram numa gaveta que abre por
  // cima do título. Não há mais troca a medir — há uma gaveta FECHADA, que é o
  // que devolve ao título a largura que ele disputava.
  //
  // O caso continua medindo o RENDERIZADO, e agora ele PRECISA disso: a gaveta
  // é escondida por `opacity`/`visibility` (para poder animar), então os botões
  // seguem no DOM e com caixa de layout — `offsetParent` sozinho diria que
  // estão todos à vista, o tempo todo.
  const botoes = async (id) => pg.evaluate((x) => {
    const el = document.querySelector('.lib-item[data-id="' + x + '"]');
    if (!el) return null;
    const vis = (s) => {
      const b = el.querySelector(s);
      if (!b || b.offsetParent === null) return false;
      for (let n = b; n && n !== document.body; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.visibility === 'hidden' || parseFloat(cs.opacity) < .5) return false;
      }
      return true;
    };
    return {
      mais: vis('.row-mais'), stop: vis('.row-stop'),
      estrela: vis('.fav-btn'), arrasta: vis('.row-handle'),
    };
  }, id);
  const abrirGaveta = async (id) => {
    // `?.` de propósito: sem o `⋮` isto é um resultado a reportar, não uma
    // exceção que leva o arquivo inteiro junto (a lição da v5.213).
    await pg.evaluate((x) => document.querySelector('.lib-item[data-id="' + x + '"] .row-mais')?.click(), id);
    await pg.waitForTimeout(320); // a gaveta ABRE animada — medir no mesmo turno lê o quadro zero
  };

  const fechada = await botoes(audioId);
  checar(!!fechada && fechada.mais && !fechada.stop && !fechada.estrela && !fechada.arrasta,
    'na linha no ar a direita tem UM botão só (o ⋮) — nada disputa o título',
    JSON.stringify(fechada));
  await abrirGaveta(audioId);
  const aberta = await botoes(audioId);
  checar(!!aberta && aberta.stop, 'e a gaveta aberta traz o PARAR', JSON.stringify(aberta));
  checar(!!aberta && aberta.estrela && aberta.arrasta,
    'ao LADO da estrela e do arrastar — a gaveta não troca botão, ela os reúne',
    JSON.stringify(aberta));
  // E o botão faz o que diz: é o mesmo `retirarDoAr` do segundo toque.
  await pg.evaluate((x) => document.querySelector('.lib-item[data-id="' + x + '"] .row-stop').click(), audioId);
  await pg.waitForFunction(() => !midiaNoAr, null, { timeout: 3000 })
    .then(() => checar(true, 'e tocá-lo tira do ar'))
    .catch(() => checar(false, 'e tocá-lo tira do ar'));
  const foraFechada = await botoes(audioId);
  checar(!!foraFechada && !foraFechada.stop && !foraFechada.estrela,
    'e escolher uma opção FECHA a gaveta — ela não fica cobrindo o nome depois de agir',
    JSON.stringify(foraFechada));
  await abrirGaveta(audioId);
  const fora = await botoes(audioId);
  checar(!!fora && !fora.stop && fora.estrela,
    'fora do ar o PARAR não existe mais na gaveta, e a estrela continua lá',
    JSON.stringify(fora));
  await pg.evaluate(() => { if (typeof fecharAcoesDaLinha === 'function') fecharAcoesDaLinha(); });

  // O PARAR limpa as duas, e o "atual" SOBREVIVE — é ele que o ▶ repete.
  await pg.evaluate(async (ids) => { await send(ids[0]); await send(ids[1]); },
    [cenaId, audioId]);
  await pg.evaluate(() => stopClear());
  const depoisDoStop = await selo(audioId);
  checar(!!depoisDoStop && !depoisDoStop.noAr && !depoisDoStop.texto,
    'depois do Parar nenhuma linha diz "No ar" — o telão está vazio',
    JSON.stringify(depoisDoStop));
  checar(!!depoisDoStop && depoisDoStop.ativo,
    'mas o item continua ATUAL (contorno em accent), que é o que o ▶ repete',
    JSON.stringify(depoisDoStop));
  await pg.evaluate(() => stopClear());
  await pg.evaluate(async (id) => { await send(id); }, id);

  // ---- O PARAR EXIGIA DOIS TOQUES, E A CULPA ERA DO ECO (v5.179) ----
  //
  // Relato do operador: "no primeiro toque ele para a mídia, mas a barra de
  // progresso ainda fica a meio caminho e o botão de play ainda não é visível".
  // A hipótese natural — e errada — é um sistema de camadas em que o Parar
  // derruba a de cima primeiro. Não é: `stopClear` derruba as duas de uma vez,
  // e o teste acima já trava isso.
  //
  // O que acontece é que o `clear` ESMAECE antes de sair de cena (~0,6 s) e o
  // `<video>` do telão continua tocando durante a rampa — ela é de volume, não
  // de pausa. Cada `display-status` desse intervalo chegava com `playing: true`
  // e o tempo antigo, e repintava, a ~4 Hz, exatamente a UI que `pararMidia`
  // acabara de zerar. O segundo toque só "funcionava" porque a essa altura a
  // mídia já saíra e ninguém mais reportava aquele `mediaId`.
  //
  // O eco vem de um IFRAME `about:blank` (que herda o origin do pai): o
  // BroadcastChannel não entrega ao próprio contexto que postou, e é exatamente
  // por esse caminho que o telão fala.
  await pg.evaluate(() => {
    const f = document.createElement('iframe');
    f.style.display = 'none';
    document.body.appendChild(f);
    window.__telao = (m) => f.contentWindow.eval(
      'new BroadcastChannel("av-iasd").postMessage(' + JSON.stringify(m) + ')');
  });
  const ecoar = async (extra) => pg.evaluate(async (m) => {
    window.__telao(m);
    await new Promise((r) => setTimeout(r, 150));
    return {
      seek: parseFloat(seekEl.value) || 0,
      travada: seekEl.disabled,
      icone: playPauseEl.querySelector('.msym').textContent,
      playing,
    };
  }, Object.assign({ type: 'display-status', mediaId: id, playing: true, currentTime: 120, duration: 240 }, extra));

  const tocando = await ecoar({});
  checar(tocando.seek === 120 && !tocando.travada && tocando.playing,
    'o telão tocando dirige o transporte: barra no meio, ícone de pausa',
    JSON.stringify(tocando));

  await pg.evaluate(() => stopClear());
  const zerado = await pg.evaluate(() => ({
    seek: parseFloat(seekEl.value) || 0,
    travada: seekEl.disabled,
    icone: playPauseEl.querySelector('.msym').textContent,
  }));
  checar(zerado.seek === 0 && zerado.travada,
    'o PRIMEIRO toque no Parar zera a barra e a desabilita', JSON.stringify(zerado));

  const eco = await ecoar({ currentTime: 122 });
  checar(eco.seek === 0 && eco.travada && !eco.playing,
    'e o status ATRASADO do fade não a traz de volta — era este o "segundo toque"',
    JSON.stringify(eco));
  checar(eco.icone === zerado.icone,
    'o ícone continua sendo o ▶ que o Parar aplicou (era ele que sumia)',
    JSON.stringify(eco));

  // E a guarda é sobre estar EM CENA, não um desligar: tocar de novo devolve a
  // palavra ao telão no mesmo instante.
  await pg.evaluate(async (x) => { await send(x); }, id);
  const devolta = await ecoar({ currentTime: 30 });
  checar(devolta.seek === 30 && devolta.playing,
    'e tocar de novo devolve a direção ao telão na hora', JSON.stringify(devolta));
  await pg.evaluate(() => stopClear());
  await pg.evaluate(async (x) => { await send(x); }, id);

  // ---- O COMANDO ATRASADO LEVA O ITEM DE QUANDO ELE SAIU (v5.180) ----
  //
  // A fila da preview (v5.162) atrasa a CÓPIA em até 2,5 s para ela não
  // responder antes das telas da rede. Só que `aplicarNaPreview` lia
  // `currentItem` no instante do DRENO: dois toques dentro dessa janela — trocar
  // de música, ou errar a linha e corrigir — faziam o `load` de A ser aplicado
  // com o item B na mão. A mídia certa entrava (ela vem pelo `mediaId`), e
  // LETRA, YouTube e "mantém o texto?" eram decididos pelo item errado.
  //
  // Um comando da fila é do passado por construção; o estado que ele carrega tem
  // de ser o daquele passado também.
  {
    const idA = await pg.evaluate(async () => {
      const rec = await AVDB.addMedia(new Blob([new Uint8Array(64)], { type: 'audio/mp4' }), {
        name: 'Atrasado A', type: 'audio/mp4', kind: 'audio', list: 'imports',
      });
      await load();
      return rec.id;
    });
    const idB = await pg.evaluate(async () => {
      const rec = await AVDB.addMedia(new Blob([new Uint8Array(64)], { type: 'video/mp4' }), {
        name: 'Atrasado B', type: 'video/mp4', kind: 'video', list: 'imports',
      });
      await load();
      return rec.id;
    });
    const levados = await pg.evaluate(async (ids) => {
      const vistos = [];
      const orig = aplicarNaPreview;
      window.aplicarNaPreview = (obj, item) => {
        if (obj && obj.type === 'load') {
          vistos.push({ load: obj.mediaId, levou: (item && item.id) || '', global: currentId });
        }
        return orig(obj, item);
      };
      const antes = prevAtrasoMs;
      prevAtrasoMs = 700;               // a folga típica de uma tela da rede
      try {
        await send(ids[0]);
        await send(ids[1]);             // dentro da janela: a fila ainda tem o load de A
        await new Promise((r) => setTimeout(r, 1600));
      } finally {
        prevAtrasoMs = antes;
        window.aplicarNaPreview = orig;
      }
      return vistos;
    }, [idA, idB]);

    const deA = levados.find((x) => x.load === idA);
    checar(!!deA && deA.global === idB,
      'o `load` de A é drenado depois de o item ATUAL já ser B (é a janela do atraso)',
      JSON.stringify(levados));
    checar(!!deA && deA.levou === idA,
      'e mesmo assim ele leva o item A consigo — o comando é do passado, o estado dele também',
      JSON.stringify(levados));
    const deB = levados.find((x) => x.load === idB);
    checar(!!deB && deB.levou === idB, 'e o de B leva B, como sempre', JSON.stringify(levados));
    await pg.evaluate(() => stopClear());
    await pg.evaluate(async (x) => { await send(x); }, id);
  }

  // ---- A PREVIEW ESCONDIDA NÃO É TOCADA (v5.177) ----
  //
  // Este caso nasceu de um Registro de aparelho. Com o app minimizado, a linha
  // do tempo trazia pares `play [oculto]` / `PAUSA ESPONTÂNEA [oculto]` a ~4 Hz:
  // a v5.173 passou a escutar o `espelho-status` (que é o certo — sem TV o
  // espelho É a projeção), e com isso `resyncPreviewToDisplay` começou a chamar
  // `preview.play()` numa página oculta. O Chromium pausa um `<video>` de
  // página escondida, o status seguinte chega 250 ms depois e recomeça.
  //
  // O estrago não fica na preview: os três WebViews dividem UM processo, e essa
  // rotatividade de decodificador rouba o fio que alimenta o `AudioWorklet` do
  // espelho — do lado da tela da rede isso aparece como "o som parou de chegar"
  // com a imagem seguindo, que foi a queixa que abriu a rodada.
  //
  // Um `play()` que o navegador desfaz no quadro seguinte não é sincronização,
  // é ruído. Quem realinha é a retomada, e ela é EXATA.
  {
    const espiar = async (visivel, playing) => pg.evaluate((arg) => {
      Object.defineProperty(document, 'visibilityState',
        { configurable: true, get: () => (arg.visivel ? 'visible' : 'hidden') });
      const conta = { play: 0, pause: 0, seek: 0 };
      const oPlay = preview.play, oPause = preview.pause, oSeek = preview.seek;
      const oTimed = preview.isTimed, oPlaying = preview.isPlaying, oTime = preview.getTime;
      preview.play = () => { conta.play++; };
      preview.pause = () => { conta.pause++; };
      preview.seek = () => { conta.seek++; };
      preview.isTimed = () => true;
      preview.isPlaying = () => false;
      preview.getTime = () => 0;
      try { resyncPreviewToDisplay(arg.playing, 120, 0.15); } finally {
        preview.play = oPlay; preview.pause = oPause; preview.seek = oSeek;
        preview.isTimed = oTimed; preview.isPlaying = oPlaying; preview.getTime = oTime;
        Object.defineProperty(document, 'visibilityState',
          { configurable: true, get: () => 'visible' });
      }
      return conta;
    }, { visivel, playing });

    const oculta = await espiar(false, true);
    checar(oculta.play === 0 && oculta.pause === 0 && oculta.seek === 0,
      'com a página ESCONDIDA o resync não toca no transporte da preview',
      JSON.stringify(oculta));
    const visivel = await espiar(true, true);
    checar(visivel.play === 1 && visivel.seek === 1,
      'e com ela visível ele age normalmente — a guarda é de visibilidade, não um desligar',
      JSON.stringify(visivel));
  }

  // ---- GIRAR ----
  // O giro é preferência de EXIBIÇÃO: ele precisa chegar ao telão que reconecta
  // antes do conteúdo, senão a mídia aparece deitada e endireita na frente de
  // todos.
  await pg.evaluate(async () => { await send(currentId); await applyRotate(90); });
  checar(await pg.evaluate(() => mediaRot) === 90, 'girar guarda o ângulo');
  checar(await pg.evaluate(() => preview.getRotate()) === 90, 'e a preview gira junto com o telão');
  tipos = await cena(async () => { resendSceneToDisplay('telao-4'); });
  checar(tipos.indexOf('rotate') === 0 && tipos.indexOf('rotate') < tipos.indexOf('load'),
    'e a reconexão manda o giro ANTES da mídia');
  const voltas = await pg.evaluate(async () => {
    const out = [];
    for (let i = 0; i < 4; i++) { await applyRotate(mediaRot + 90); out.push(mediaRot); }
    return out;
  });
  checar(JSON.stringify(voltas) === JSON.stringify([180, 270, 0, 90]),
    'o botão avança 90° por toque e dá a volta (ninguém pensa em "270°")');
  await pg.evaluate(() => applyRotate(0));

  // ---- "ESTICAR" saiu, e o valor guardado é migrado ----
  const fitDepois = await pg.evaluate(() => [...document.querySelectorAll('#fitSeg .fit-opt')].map((b) => b.dataset.fit));
  checar(JSON.stringify(fitDepois) === JSON.stringify(['contain', 'cover']),
    'o seletor de preenchimento ficou com duas opções — "Esticar" distorcia a proporção');
  const migrou = await pg.evaluate(async () => {
    await AVDB.setState('fit', 'fill');
    await load();
    return { atual: mediaFit, guardado: await AVDB.getState('fit') };
  });
  checar(migrou.atual === 'contain' && migrou.guardado === 'contain',
    'e quem já tinha "Esticar" guardado é migrado — senão a mídia ficaria distorcida sem controle na tela');

  // ---- A barra de tempo do simplificado ----
  const barra = await pg.evaluate(() => {
    const hit = document.getElementById('simpleTimeHit');
    return { existe: !!hit, papel: hit && hit.getAttribute('role') };
  });
  checar(barra.existe && barra.papel === 'slider',
    'a linha do tempo do modo fácil virou um controle, não um indicador');

  // E ela SALTA de verdade. O toque no meio de uma faixa de 200 s tem de mandar
  // um `seek` para perto de 100 s — o `pointerup` é quem comanda, porque um
  // `seek` por quadro de movimento faria a mídia engasgar durante todo o gesto.
  const saltou = await pg.evaluate(async () => {
    setAppMode('simple');
    seekEl.max = '200'; seekEl.value = '10'; seekEl.disabled = false;
    renderSimpleTime();
    const hit = document.getElementById('simpleTimeHit');
    const r = hit.getBoundingClientRect();
    const meio = r.left + r.width / 2;
    const ev = (t, x) => hit.dispatchEvent(new PointerEvent(t, {
      bubbles: true, pointerId: 1, clientX: x, clientY: r.top + r.height / 2,
    }));
    window.__espiao.length = 0;
    ev('pointerdown', meio);
    const durante = window.__espiao.map((m) => m.type);
    ev('pointermove', meio);
    ev('pointerup', meio);
    await new Promise((res) => setTimeout(res, 50));
    const seeks = window.__espiao.filter((m) => m.type === 'seek');
    setAppMode('full');
    return { durante, tempo: seeks.length ? seeks[seeks.length - 1].time : null, quantos: seeks.length };
  });
  checar(!saltou.durante.includes('seek'), 'arrastar não manda um seek por quadro (a mídia não engasga)');
  checar(saltou.quantos === 1 && Math.abs(saltou.tempo - 100) < 12,
    'e soltar no meio da barra salta para o meio da faixa (um seek, no ponto certo)');

  // ---- A DIVISÃO DAS ESTROFES no visualizador de letra ----
  //
  // Um slide da API pode trazer mais de uma estrofe separadas por LINHA EM
  // BRANCO, e o `white-space: pre-line` do CSS COLAPSA `\n\n` numa quebra só:
  // as duas encostavam e a letra parecia um bloco indivisível. É por isso que
  // cada bloco precisa ser um nó próprio — e é isso que se verifica aqui, não a
  // aparência.
  const estrofes = await pg.evaluate(() => {
    const alvo = document.createElement('div');
    const salvo = currentItem;
    currentItem = {
      lyrics: [
        { cover: true },
        { text: 'Primeira estrofe linha um\nlinha dois\n\nSegunda estrofe linha um\nlinha dois', auxText: 'Estrofe' },
        { text: 'Bloco único, sem divisão' },
      ],
    };
    lvBuildSong(alvo, 1);
    currentItem = salvo;
    const linhas = [...alvo.querySelectorAll('.lv-row')];
    return {
      linhas: linhas.length,
      blocosNaPrimeira: linhas[1].querySelectorAll('.lv-text').length,
      blocosNaSegunda: linhas[2].querySelectorAll('.lv-text').length,
      destaque: linhas[1].classList.contains('current'),
      textos: [...linhas[1].querySelectorAll('.lv-text')].map((n) => n.textContent),
    };
  });
  checar(estrofes.linhas === 3, 'o visualizador mantém UMA linha por slide (a posição no tempo não muda)');
  checar(estrofes.blocosNaPrimeira === 2,
    'e um slide com duas estrofes separadas por linha em branco vira DOIS parágrafos');
  checar(estrofes.blocosNaSegunda === 1, 'um slide de estrofe única continua sendo um parágrafo só');
  checar(estrofes.destaque, 'e o destaque da estrofe no ar continua na LINHA, não no parágrafo');
  checar(estrofes.textos[0].includes('\n') && !estrofes.textos[0].includes('Segunda'),
    'as quebras DENTRO da estrofe continuam intactas — só a divisão entre elas foi separada');
} catch (e) {
  checar(false, 'o percurso terminou sem exceção (' + (e && e.message) + ')');
}

checar(erros.length === 0, 'nenhum erro de console' + (erros.length ? ':\n        ' + erros.join('\n        ') : ''));

await navegador.close();
servidor.close();
console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
