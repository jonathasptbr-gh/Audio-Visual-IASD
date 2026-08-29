// O CARTÃO DE FALHA DA PREVIEW NÃO PODE PRENDER O TRABALHO SEGUINTE.
//
// Esta foi uma REGRESSÃO introduzida por uma correção desta mesma campanha,
// pega pelo revisor do lote e provada por reversão. Ela não tem sintoma na
// hora: o cartão fica um instante a mais na tela, com a legenda certa, e
// ninguém liga o efeito à causa.
//
// ## O defeito
//
// `falhar()` segura o cartão por `PV_FALHA_MS` para a mensagem ser lida, e faz
// isso retendo o `pvBusyCount`. Se um trabalho NOVO nasce e termina dentro
// dessa janela, o `liberar()` dele encontra o contador ainda em 1 e volta cedo:
// o cartão fica na tela com a legenda do trabalho NOVO, depois de ele ter
// terminado, até o prazo do ANTIGO vencer.
//
// A regra que faltava: quem toma a legenda encerra o prazo de leitura de quem a
// perdeu — a mensagem que aquele prazo protegia já não está na tela. É a mesma
// regra que o `liberar` já aplicava ao botão de cancelar ("sai com o DONO
// dele").
//
// ## O que ficou SEM oráculo, e está dito
//
// A regressão IRMÃ deste lote — a gaveta de uma linha NO AR que não tinha como
// fechar, deixando `.lib-item.expanded` presa e o redesenho do progresso adiado
// pelo resto da sessão — foi corrigida no `onTap` de `linhaDeItem` (o toque que
// tira do ar passou a colapsar também), mas NÃO tem asserção aqui: montar uma
// linha de favorito dentro do `#hymnResults` com a mídia no ar exige um cenário
// que este arnês não sabe montar de forma estável. O `gaveta-no-download`
// cobre a marca `.hymn-result`, que é outra. Quem souber montá-lo, acrescente.
//
//   node tools/gaveta-e-cartao.test.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';

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
function checar(cond, msg, obtido) {
  if (cond) console.log('ok      ' + msg);
  else {
    console.log('FALHOU  ' + msg + (obtido !== undefined ? '\n        obtido: ' + JSON.stringify(obtido) : ''));
    falhas.push(msg);
  }
}

const SEMEAR = `
  const wav = () => {
    const sr = 8000, n = sr * 20;
    const buf = new ArrayBuffer(44 + n * 2), dv = new DataView(buf);
    const wr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    wr(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); wr(8, 'WAVEfmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true);
    dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
    wr(36, 'data'); dv.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, Math.sin(i / 20) * 3000, true);
    return new Blob([buf], { type: 'audio/wav' });
  };
  const a = await AVDB.addMedia(wav(), { name: 'FAVORITO UM', type: 'audio/wav', kind: 'audio', list: 'favs' });
  await load();
`;

await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await chromium.launch({
  ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);

const erros = [];
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY/;

try {
  const pg = await ctx.newPage();
  pg.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (EXTERNO.test(t) || /Failed to load resource/.test(t)) return;
    erros.push(t);
  });
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));

  await pg.goto(base + '/controle/', { waitUntil: 'load' });
  await pg.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function', null, { timeout: 20000 });
  await pg.evaluate(new Function('return (async () => { setAppMode("full");' + SEMEAR + '})()'));

  // ---- O CARTÃO DE FALHA NÃO PRENDE O TRABALHO SEGUINTE -------------------
  // W1 falha (segura o cartão pelo prazo de leitura) → W2 nasce e termina
  // DENTRO da janela. O cartão tem de sair com o fim de W2, não esperar o prazo
  // de W1: a mensagem de W1 já foi sobrescrita pela legenda de W2.
  //
  // ESPERA PELO FATO, não por um instante (v1.4.8). A saída do cartão passou a
  // ter uma carência (`PV_BUSY_SAIDA_MS`, a passagem de bastão), e uma leitura
  // num instante fixo mediria essa constante em vez da propriedade. O que se
  // afirma é a DISTÂNCIA entre as duas: o cartão sai MUITO antes do prazo de
  // leitura de W1, e o teto abaixo é a metade de `PV_FALHA_MS` — com o defeito
  // de volta ele não sairia dentro dele.
  const cartao = await pg.evaluate(async () => {
    const w1 = previewBusy('Baixando', 'MUSICA 1');
    w1.falhar('sem internet para baixar');
    w1.soltar();                                   // o `finally` do chamador
    await new Promise((r) => setTimeout(r, 300));
    const w2 = previewBusy('Baixando', 'MUSICA 2');
    await new Promise((r) => setTimeout(r, 100));
    const legenda = document.getElementById('pvBusyLabel').textContent;
    w2.soltar();
    const el = document.getElementById('pvBusy');
    const teto = Date.now() + PV_FALHA_MS / 2;
    while (el.classList.contains('on') && Date.now() < teto) {
      await new Promise((r) => setTimeout(r, 50));
    }
    return { on: el.classList.contains('on'), legenda, contador: pvBusyCount };
  });
  checar(!cartao.on && cartao.contador === 0,
    'o cartao sai quando o trabalho NOVO termina, sem esperar o prazo do que falhou',
    cartao);

  // ---- A PASSAGEM DE BASTÃO NÃO PISCA (v1.4.8) ---------------------------
  // Uma espera de transmissão tem DOIS donos em sequência — o toque
  // (`cederOPalco`) e a carga do stream (o `onEspera` do palco) —, e entre eles
  // o contador passa por ZERO. Sem a carência da saída o cartão sumia e voltava
  // no meio da MESMA espera: o "dois modelos de carregamento" que a v1.4.8
  // existe para acabar, com outra roupa.
  //
  // A asserção é a CONTINUIDADE, amostrada a cada quadro: um teste do estado
  // final passa nas duas versões, porque no fim o cartão está de pé de qualquer
  // jeito. O vão encenado (250 ms) é menor que o pior caso real, que é o
  // `FADE.time` de 0,6 s.
  const passagem = await pg.evaluate(async () => {
    const a1 = previewBusy('Preparando', 'O VIDEO');
    await new Promise((r) => setTimeout(r, 300));   // passa o PV_BUSY_DELAY_MS
    const el = document.getElementById('pvBusy');
    if (!el.classList.contains('on')) return { erro: 'o cartao nem chegou a abrir' };
    let apagou = false;
    const olho = setInterval(() => {
      if (!el.classList.contains('on')) apagou = true;
    }, 16);
    a1.soltar();                                   // o `finally` do chamador
    await new Promise((r) => setTimeout(r, 250));   // o vão entre os dois donos
    const a2 = previewBusy('Preparando', 'O VIDEO');
    await new Promise((r) => setTimeout(r, 200));
    clearInterval(olho);
    const fim = { apagou, on: el.classList.contains('on') };
    a2.soltar();
    return fim;
  });
  checar(passagem.apagou === false && passagem.on === true,
    'a PASSAGEM DE BASTÃO entre os dois donos da mesma espera não pisca — o '
    + 'cartão do toque e o da carga do stream são o mesmo cartão, e o contador '
    + 'passando por zero entre eles não pode aparecer na tela', passagem);

  // A OUTRA METADE, sem a qual a de cima seria a volta do defeito que o prazo
  // existe para impedir: falhando SOZINHO, o cartao FICA para ser lido.
  const sozinho = await pg.evaluate(async () => {
    const w = previewBusy('Baixando', 'MUSICA 3');
    w.falhar('esta musica nao tem letra');
    w.soltar();
    await new Promise((r) => setTimeout(r, 400));
    const el = document.getElementById('pvBusy');
    return {
      on: el.classList.contains('on'),
      falhou: el.classList.contains('falhou'),
      legenda: document.getElementById('pvBusyLabel').textContent,
    };
  });
  checar(sozinho.on && sozinho.falhou && /nao tem letra/.test(sozinho.legenda),
    'e uma falha SOZINHA continua no ar pelo prazo de leitura',
    sozinho);

  // ======================================================================
  // O ÍCONE DO CARTÃO SEGUE A LEGENDA (v1.4.19)
  // ======================================================================
  //
  // Pedido do operador, sobre o cartão de um link do YouTube: *"seu ícone segue
  // sendo um ícone de download, enquanto que deveria ser só o spinner, sem um
  // ícone de download nesse tipo de preparação, já que não está realmente
  // baixando algo, para diferenciar do download em si"*.
  //
  // O `.dl-ring` são DOIS desenhos: o aro que gira e a SETA parada. O aro diz
  // "espere"; a seta diz "bytes chegando" — e só uma delas era verdade numa
  // PREPARAÇÃO.
  //
  // A asserção mede o RENDERIZADO (`getClientRects`), não a classe: a classe
  // sem a regra de CSS passaria num teste de classe e continuaria desenhando a
  // seta na tela do operador, que é exatamente o que ele relatou.
  const iconeDo = (acao, depois) => pg.evaluate(([a, d]) => {
    const c = previewBusy(a, 'Um nome qualquer');
    if (d) c.atualizar(d);
    const el = document.getElementById('pvBusy');
    el.classList.add('on');   // o cartão só acende depois do respiro de entrada
    const svg = el.querySelector('.dl-ring svg');
    const aro = el.querySelector('.dl-ring');
    const r = {
      cap: document.getElementById('pvBusyCap').textContent,
      seta: !!(svg && svg.getClientRects().length),
      aro: !!(aro && aro.getClientRects().length),
    };
    c.soltar();
    el.classList.remove('on');
    return r;
  }, [acao, depois || null]);

  // AS PREPARAÇÕES: a extração de um link, a montagem de uma playlist, e a
  // própria fase pré-bytes de um download (que nasce em "Preparando vídeo").
  const semSeta = [];
  for (const [acao, depois] of [['Preparando', null], ['Preparando vídeo', null],
    ['Preparando apresentação', null], ['Montando', null]]) {
    semSeta.push(await iconeDo(acao, depois));
  }
  checar(semSeta.every((r) => !r.seta),
    '[relato] numa PREPARAÇÃO o cartão não desenha a seta de download',
    semSeta.map((r) => r.cap + (r.seta ? ' ← SETA' : '')));
  checar(semSeta.every((r) => r.aro),
    'e o aro FICA: a espera continua sendo verdade, e sem ele o cartão vira '
    + 'texto parado', semSeta.map((r) => r.cap + (r.aro ? '' : ' ← SEM ARO')));

  // OS DOWNLOADS DE VERDADE, incluindo o que COMEÇA como preparação e vira
  // download no primeiro progresso — sem esta metade, apagar a seta de todo
  // cartão passaria na primeira e o desenho perderia a distinção que o pedido
  // existe para criar.
  const comSeta = [];
  for (const [acao, depois] of [['Baixando', null], ['Baixando a letra', null],
    ['Preparando vídeo', 'Baixando vídeo · 37%']]) {
    comSeta.push(await iconeDo(acao, depois));
  }
  checar(comSeta.every((r) => r.seta),
    'e num DOWNLOAD ela aparece — inclusive no que começa como "Preparando '
    + 'vídeo" e vira "Baixando vídeo · N%" no primeiro progresso',
    comSeta.map((r) => r.cap + (r.seta ? '' : ' ← SEM SETA')));

  checar(erros.length === 0, 'nenhum erro de console/pagina', erros);
} finally {
  await navegador.close();
  servidor.close();
}

console.log('');
if (falhas.length) {
  console.log('REPROVOU: ' + falhas.length + ' assercao(oes).');
  process.exit(1);
}
console.log('Todos passaram.');
