// O AVISO DE QUE UM ARQUIVO ESTÁ ENTRANDO (v1.3.12).
//
// ## O defeito
//
// Importar um vídeo do armazenamento leva SEGUNDOS até virar linha: o `fetch`
// do `/saf/` copia o arquivo inteiro, o `prepararMidia` decodifica um quadro
// para a miniatura e mede a duração, e o `addMedia` grava tudo no IndexedDB.
// Nada disso aparecia — a folha de destinos já tinha fechado, a lista
// continuava igual, e do lado de quem opera é indistinguível de o app ter
// travado. Nas palavras do operador: *"eu não soube se ele travou ou se estava
// importando, pois já havia fechado a tela de importação e não houve nenhuma
// mudança"*.
//
// A importação de APRESENTAÇÃO já fazia o certo (ver `deckImportar`); o ramo da
// mídia comum é que tinha ficado sem. O par é o mesmo: linha provisória no
// avançado, cartão sobre a preview no Modo Fácil.
//
// ## Por que ele precisa de um oráculo
//
// A ausência de um aviso NÃO É UM ERRO: nada quebra, nada aparece no console, e
// o item chega ao fim — só chega em silêncio. Um teste que medisse só o
// desfecho ("o item entrou na lista") passa nas duas versões. **O que se mede
// aqui é o MEIO**: enquanto o arquivo ainda está sendo lido, existe uma linha
// com o nome dele na lista.
//
// Daí o arquivo do cenário ser servido AOS PEDAÇOS, com um atraso deliberado:
// sem isso a janela que se quer medir dura menos que uma volta do laço de
// eventos, e o oráculo mediria a máquina em vez do app.
//
//   node tools/aviso-de-importacao.test.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { abrirNavegador, checar, falhas } from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml',
};

// O ARQUIVO LENTO: 12 pedaços com 120 ms entre eles (~1,4 s no total). É a
// janela que o oráculo mede, e ela precisa durar mais que o tempo de uma volta
// do laço de eventos para a medição falar do APP.
const PEDACOS = 12;
const ENTRE_MS = 120;
// O VÍDEO DE VERDADE: o único jeito de medir miniatura/altura/duração é o
// decode acontecer. O `.webm` de 20 s dos fixtures é o mesmo que a busca usa.
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const VIDEO = path.join(AQUI, 'fixtures', 'video-20s.webm');

const servidor = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  // O MIME DO PROVEDOR: `application/octet-stream` é o que um `/saf/` de
  // terceiro devolve com frequência, e é justamente o que o `importShare` tem
  // de superar com o `type` declarado.
  if (u.pathname === '/sem-extensao') {
    res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
    fs.createReadStream(VIDEO).pipe(res);
    return;
  }
  if (u.pathname === '/lento.bin') {
    res.writeHead(200, { 'Content-Type': 'video/mp4' });
    let n = 0;
    const passo = () => {
      if (n >= PEDACOS) { res.end(); return; }
      n++;
      res.write(Buffer.alloc(8 * 1024, n));
      setTimeout(passo, ENTRE_MS);
    };
    passo();
    return;
  }
  let p = decodeURIComponent(u.pathname);
  if (p.endsWith('/')) p += 'index.html';
  const arquivo = path.join(RAIZ, p);
  if (!arquivo.startsWith(RAIZ) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
    res.writeHead(404); res.end('nao'); return;
  }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream' });
  fs.createReadStream(arquivo).pipe(res);
});

await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador();
const ctx = await navegador.newContext({ viewport: { width: 412, height: 892 } });
await semRedeExterna(ctx);
const pg = await ctx.newPage();
const erros = [];
pg.on('pageerror', (e) => erros.push(e.message));

try {
  await pg.goto(base + '/controle/', { waitUntil: 'load' });
  await pg.waitForFunction(
    () => window.AVDB && typeof window.__avBack === 'function' && (!!document.querySelector('#playlist li') || document.getElementById('plBtn').disabled),
    null, { timeout: 25000 },
  );
  await pg.evaluate(() => setAppMode('full'));
  await pg.waitForTimeout(150);

  // ── 1. O AVISO EXISTE ENQUANTO O ARQUIVO É LIDO ─────────────────────────
  //
  // A folha de destinos é respondida como o operador a responde — por um dos
  // botões de destino, que agora executa no toque (v1.15.0) —, e não desviada: é ela que fecha antes do trabalho começar, e é
  // justamente esse fechamento que deixava a tela sem sinal nenhum.
  await pg.evaluate((url) => {
    window.__imp = importShare({ files: [{ url, name: 'Video Pesado.mp4', type: 'video/mp4' }] });
  }, base + '/lento.bin');
  // A PERGUNTA DE DESTINO é a fileira compacta (v1.15.0): o toque no quadrado
  // do Cronograma responde a folha na hora, sem Confirmar.
  await pg.waitForSelector('#songMenuPopup .dest-botoes [data-dest="cronograma"]', { timeout: 10000 });
  await pg.evaluate(() => document.querySelector(
    '#songMenuPopup .dest-botoes [data-dest="cronograma"]').click());

  // Espera pelo FATO (a linha provisória), não por um prazo.
  const apareceu = await pg.waitForFunction(() => {
    const li = document.querySelector('.lib-item.baixando');
    return li ? li.textContent : null;
  }, null, { timeout: 8000 }).then((h) => h.jsonValue()).catch(() => null);

  checar(!!apareceu, 'enquanto o arquivo é lido existe uma linha provisória na lista', apareceu);
  checar(!!apareceu && apareceu.includes('Video Pesado'),
    'e ela diz QUAL arquivo — um aro anônimo não responde "o que está entrando?"', apareceu);

  // O ARO GIRA, e é ele que separa "está trabalhando" de "travou". Sem
  // percentual de propósito: `fetch().blob()` não reporta progresso, e um
  // número parado em 0% mente mais do que o aro.
  const anatomia = await pg.evaluate(() => {
    const li = document.querySelector('.lib-item.baixando');
    if (!li) return null;
    return { aro: !!li.querySelector('.dl-ring'), pct: (li.querySelector('.dl-pct') || {}).textContent };
  });
  checar(anatomia && anatomia.aro === true,
    'a linha traz o aro que gira, no lugar da miniatura que ela ainda não tem', anatomia);

  // ── 2. E ELE SAI QUANDO O ITEM CHEGA ────────────────────────────────────
  await pg.evaluate(() => window.__imp);
  await pg.waitForTimeout(300);
  const depois = await pg.evaluate(() => ({
    provisorias: document.querySelectorAll('.lib-item.baixando').length,
    itens: [...document.querySelectorAll('.lib-item:not(.baixando) .row-name')].map((e) => e.textContent),
  }));
  checar(depois.provisorias === 0,
    'terminada a importação, a linha provisória sai — um aro que fica é um item fantasma', depois);
  checar(depois.itens.some((n) => n.includes('Video Pesado')),
    'e o item de verdade ocupa o lugar dela', depois);

  // ── 3. O ARQUIVO QUE NÃO ABRE TAMBÉM SOLTA A LINHA ──────────────────────
  //
  // O laço sai por `continue` quando o `fetch` falha, e é por isso que o
  // `soltar()` mora num `finally`: sem ele, um arquivo ilegível deixaria o aro
  // girando na lista para sempre, sem nada que o removesse.
  await pg.evaluate((url) => {
    window.__imp2 = importShare({ files: [{ url, name: 'Nao Existe.mp4', type: 'video/mp4' }] });
  }, base + '/nao-existe.bin');
  // A PERGUNTA DE DESTINO é a fileira compacta (v1.15.0): o toque no quadrado
  // do Cronograma responde a folha na hora, sem Confirmar.
  await pg.waitForSelector('#songMenuPopup .dest-botoes [data-dest="cronograma"]', { timeout: 10000 });
  await pg.evaluate(() => document.querySelector(
    '#songMenuPopup .dest-botoes [data-dest="cronograma"]').click());
  await pg.evaluate(() => window.__imp2);
  await pg.waitForTimeout(300);
  const orfa = await pg.evaluate(() => document.querySelectorAll('.lib-item.baixando').length);
  checar(orfa === 0,
    'um arquivo que não abre também solta a linha — o `soltar()` mora num `finally`', orfa);

  // ── 4. UM LINK COMPARTILHADO ENTRA NA LISTA NA HORA ─────────────────────
  //
  // Um link que não é do YouTube nem de apresentação vira item por
  // `addUrlMedia`, que não abre linha provisória — e era a linha provisória
  // (o `load()` do `soltar()`) que redesenhava a lista nos outros ramos. Sem
  // um `load()` no fim do `importShare`, o item ficava no banco e fora do
  // Cronograma até a próxima releitura (revisão C8).
  await pg.evaluate((url) => {
    window.__imp3 = importShare({ url, title: 'Link Compartilhado' });
  }, base + '/shared/wallpaper-padrao.svg');
  // A PERGUNTA DE DESTINO é a fileira compacta (v1.15.0): o toque no quadrado
  // do Cronograma responde a folha na hora, sem Confirmar.
  await pg.waitForSelector('#songMenuPopup .dest-botoes [data-dest="cronograma"]', { timeout: 10000 });
  await pg.evaluate(() => document.querySelector(
    '#songMenuPopup .dest-botoes [data-dest="cronograma"]').click());
  await pg.evaluate(() => window.__imp3);
  const link = await pg.evaluate(async () => ({
    banco: (await AVDB.listItems('imports')).some((m) => m.name === 'Link Compartilhado'),
    tela: [...document.querySelectorAll('.lib-item:not(.baixando) .row-name')].some((e) => e.textContent.includes('Link Compartilhado')),
  }));
  checar(link.banco && link.tela,
    'um link compartilhado ao Cronograma aparece na lista assim que o import termina', link);

  // ── 5. O ARQUIVO QUE O SHELL NÃO CONSEGUIU NEM DESCREVER AVISA ──────────
  //
  // O `describe` do `ShareIntake` devolve `null` quando o provedor recusa a
  // consulta (nuvem sem permissão, provedor que morreu), e o arquivo saía do
  // lote em SILÊNCIO: o operador tinha escolhido um arquivo, o app fingia não
  // ter visto, e não havia nem diálogo nem linha no Registro (revisão X2). O
  // shell passou a mandar `ignorados: ["nome"]` e o `importShare` a dizer o
  // nome — é a única coisa que o operador tem para agir.
  await pg.evaluate(() => {
    window.__imp4 = importShare({ files: [], ignorados: ['foto-do-drive.jpg'] });
  });
  const aviso = await pg.waitForFunction(() => {
    const d = document.getElementById('appDialog');
    if (!d || !d.classList.contains('open')) return null;
    return {
      titulo: document.getElementById('appDialogTitle').textContent,
      msg: document.getElementById('appDialogMsg').textContent,
    };
  }, null, { timeout: 8000 }).then((h) => h.jsonValue()).catch(() => null);
  checar(!!aviso && aviso.msg.includes('foto-do-drive.jpg'),
    'o arquivo que o app não conseguiu ler aparece NOMEADO num aviso — antes o share inteiro sumia calado',
    aviso);
  await pg.evaluate(() => { const b = document.getElementById('appDialogOk'); if (b) b.click(); });
  await pg.evaluate(() => window.__imp4);

  // ── 6. O NOME SEM EXTENSÃO NÃO PERDE TIPO, QUALIDADE NEM MINIATURA ──────
  //
  // O relato do operador (22/11): *"Tipo de arquivo, qualidade, thumbnail.
  // Botão de detalhes… Nada disso está vindo com a mídia compartilhada"*.
  // A causa medida: `guessMediaType` devolve `'application/octet-stream'` para
  // extensão desconhecida — TRUTHY — e o `|| blob.type` do `importShare` nunca
  // era alcançado. Um `name` sem extensão (o `DISPLAY_NAME` cru do provedor)
  // entrava como `kind:'other'`, sem `height`, sem `seconds` e sem `thumb`.
  //
  // O arquivo é servido como `application/octet-stream` de propósito: só o
  // `type` declarado pelo shell (aqui `video/webm`) pode salvá-lo. O que se mede
  // é o FIM — registro e linha — e a OFERTA, que é onde o operador vê o card
  // antes de escolher o destino.
  await pg.evaluate(({ url, size }) => {
    // A FORMA DO SHELL: `ShareIntake.describe` manda `{ name, type, size, url }`
    // — e é o `size` dele que a oferta mostra antes de qualquer cópia.
    window.__imp5 = importShare({ files: [{ url, name: 'Video Sem Extensao', type: 'video/webm', size }] });
  }, { url: base + '/sem-extensao', size: fs.statSync(VIDEO).size });
  await pg.waitForSelector('#songMenuPopup .yt-oferta', { timeout: 10000 });
  // A OFERTA mede a duração no `<video>` que ela mesma monta: espera pelo FATO
  // (a linha com qualidade e duração), não por um prazo.
  await pg.waitForFunction(() => {
    const m = document.querySelector('#songMenuPopup .yt-oferta-meta');
    return !!m && /\d+p · \d+:\d\d/.test(m.textContent);
  }, null, { timeout: 15000 }).catch(() => {});
  const oferta = await pg.evaluate(() => {
    const cx = document.querySelector('#songMenuPopup .yt-oferta');
    const meta = cx && cx.querySelector('.yt-oferta-meta');
    const capa = cx && cx.querySelector('.yt-oferta-thumb');
    return {
      meta: meta ? meta.textContent : '',
      capa: capa ? capa.tagName : '',
      src: capa ? String(capa.currentSrc || capa.src || '') : '',
    };
  });
  await pg.evaluate(() => document.querySelector(
    '#songMenuPopup .dest-botoes [data-dest="cronograma"]').click());
  await pg.evaluate(() => window.__imp5);
  await pg.waitForTimeout(500);
  const semExt = await pg.evaluate(async () => {
    const rec = (await AVDB.listItems('imports')).find((m) => m.name === 'Video Sem Extensao');
    if (!rec) return null;
    const li = [...document.querySelectorAll('.lib-item')]
      .find((e) => (e.querySelector('.row-name') || {}).textContent === 'Video Sem Extensao');
    const alvo = document.createElement('div');
    alvo.className = 'item-detalhe';
    document.body.appendChild(alvo);
    montarDetalhesDoItem(rec, alvo);
    const card = {
      linhas: [...alvo.querySelectorAll('.item-detalhe-linha')].filter((e) => !e.hidden).map((e) => e.textContent),
      thumb: !!alvo.querySelector('.item-detalhe-thumb'),
      src: String((alvo.querySelector('.item-detalhe-thumb') || {}).src || ''),
    };
    alvo.remove();
    return {
      type: rec.type, kind: rec.kind, height: rec.height, seconds: rec.seconds,
      thumb: rec.thumb instanceof Blob ? rec.thumb.size : 0,
      blobType: rec.blob && rec.blob.type,
      esperado: ['Vídeo', rec.height ? rec.height + 'p' : '',
        rec.seconds ? fmtTime(rec.seconds) : '',
        rec.blob && rec.blob.size ? fmtBytes(rec.blob.size) : ''].filter(Boolean).join(' · '),
      sub: li && li.querySelector('.row-sub') ? li.querySelector('.row-sub').textContent : '',
      thumbLista: !!li && !!li.querySelector('.thumb img'),
      card,
    };
  });
  checar(semExt && semExt.type === 'video/webm' && semExt.kind === 'video',
    '6 · um arquivo SEM EXTENSÃO entra com o MIME que o shell mandou, e não como "other"', semExt);
  checar(semExt && semExt.height > 0 && semExt.seconds >= 19 && semExt.thumb > 0,
    '6 · e a importação lê altura, duração e miniatura do decode — os três que o "other" não tinha', semExt);
  checar(semExt && semExt.blobType === 'video/webm',
    '6 · o blob gravado carrega o MIME resolvido: é ele que o `<video>` da miniatura consulta', semExt);
  checar(semExt && oferta.meta === semExt.esperado && oferta.capa === 'VIDEO',
    '6 · a oferta mostra o quadro e "Vídeo · Np · 0:20 · tamanho" antes de escolher o destino',
    { oferta, esperado: semExt && semExt.esperado });
  checar(semExt && semExt.sub.startsWith('Vídeo · ') && /\d+p · \d+:\d\d/.test(semExt.sub),
    '6 · a linha na lista diz o tipo, a qualidade e a duração', semExt && semExt.sub);
  checar(semExt && semExt.thumbLista,
    '6 · e a linha mostra a miniatura que a importação decodificou', semExt && semExt.thumbLista);
  checar(semExt && semExt.card.linhas.some((l) => /^\d+p$/.test(l))
    && semExt.card.linhas.includes('0:20') && semExt.card.thumb
    && semExt.card.src.startsWith('blob:'),
  '6 · e o card de Detalhes mostra o tipo, a qualidade, a duração e a miniatura',
  semExt && semExt.card);

  checar(erros.length === 0, 'nenhum erro de página', erros);
} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) {
  console.log('\n' + falhas.length + ' falha(s).');
  process.exit(1);
}
console.log('\nTodos passaram.');
