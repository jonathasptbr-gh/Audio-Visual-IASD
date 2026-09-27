// O BUCKET DE FOTOS NÃO MANDA CORS — o desvio pelo shell, e só para ele.
//
// ## Por que ele existe
//
// Depois do conserto do piso da varredura dos fundos (v1.11.1) e da checagem
// dedicada de host na Verificação (v1.11.2), um Registro de operador mostrou
// que o problema não era passageiro: o bucket R2 das fotos do Hinário 2022
// (pinado desde a v1.10.9) respondia SEM RESPOSTA (`TypeError`) num `fetch()`
// isolado, minutos depois da abertura, com tudo mais na origem respondendo
// bem no mesmo instante. O operador confirmou, a pedido, que a MESMA URL abre
// normalmente colada na barra de endereços de um navegador comum — no MESMO
// aparelho, na MESMA rede.
//
// A explicação: aquele bucket não manda `Access-Control-Allow-Origin`. Uma
// navegação de topo nunca passa pela checagem de CORS (ela existe só para
// decidir se o CORPO de uma resposta a um `fetch()`/XHR cross-origin pode ser
// exposto ao script que o pediu) — então o link "simplesmente funciona" ali,
// e falha SEMPRE dentro do WebView, com ou sem cabeçalhos extras no pedido.
//
// CORS é regra do NAVEGADOR: não existe em requisições HTTP feitas por código
// nativo Android. `StreamProxy.kt` já resolveu a MESMA classe de defeito para
// o googlevideo (que também não manda CORS) com um proxy nativo servindo pelo
// próprio origin do app. Este lote aplica a mesma receita: o shell busca a
// imagem (`R2ImagemFonte`, sem CORS) e devolve uma URL SERVÍVEL do próprio
// origin (`/r2img/<token>`) — nunca bytes brutos pela ponte.
//
// ## O que ele trava
//
// SÓ o host pinado passa pelo desvio (a origem principal já manda CORS de
// verdade, e não precisa dele); o desvio não existe fora do app (o navegador
// não tem "cliente HTTP sem CORS", e o `fetch()` direto ali falha do mesmo
// jeito de sempre — sem regressão, porque nunca funcionou); e as DUAS causas
// de falha do shell (sem resposta × HTTP de erro) chegam distinguíveis a quem
// chama, do mesmo jeito que o caminho direto já distingue.
//
//   node tools/desvio-cors-fotos.test.mjs
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, checar, falhas, RAIZ_WEB, VIEWPORT } from './arnes.mjs';

const FIXTURE_BYTES = Buffer.from('fingiu-ser-uma-foto-de-fundo');
const servidor = servirEstatico(RAIZ_WEB, (req, res) => {
  if (req.url.startsWith('/fixture-r2img.jpg')) {
    res.writeHead(200, { 'Content-Type': 'image/jpeg' });
    res.end(FIXTURE_BYTES);
    return true;
  }
  return false;
});
await new Promise((r) => servidor.listen(0, r));
const porta = servidor.address().port;
const CDN_URL = 'https://pub-8c0e123c55a14cdfa0c52fa182688782.r2.dev/images/hasd_x.jpg';
const AUDIO_URL = 'https://api.louvorja.com.br/file/musics/x.mp3';

const navegador = await abrirNavegador();

try {
  // ==== A: NO APP (com ponte), o host pinado passa pelo shell ==============
  const ctxNativo = await navegador.newContext({ viewport: VIEWPORT });
  await semRedeExterna(ctxNativo);
  const pgNativo = await ctxNativo.newPage();
  await pgNativo.addInitScript(() => {
    window.__r2Pedidos = [];
  });
  await pgNativo.addInitScript((fixtureUrl) => {
    window.__AVBridge = {
      shellVersion: () => 77,
      role: () => 'controle',
      appVersion: () => 'v1.9.99',
      otaConfirm: () => {},
      r2Imagem: (id, url) => {
        window.__r2Pedidos.push(url);
        window.__avResolve(id, { status: 200, url: fixtureUrl });
      },
    };
  }, `http://localhost:${porta}/fixture-r2img.jpg`);
  await pgNativo.goto(`http://localhost:${porta}/controle/`, { waitUntil: 'domcontentloaded' });
  await pgNativo.waitForFunction(
    () => window.AVDB && typeof window.__avBack === 'function' && typeof fetchImagemDaOrigem === 'function',
    null, { timeout: 30000 },
  );

  const nativoOk = await pgNativo.evaluate(async (cdnUrl) => {
    window.__r2Pedidos.length = 0;
    const res = await fetchImagemDaOrigem(cdnUrl);
    const texto = await res.text();
    return { pedidos: window.__r2Pedidos.slice(), ok: res.ok, texto };
  }, CDN_URL);
  checar(nativoOk.pedidos.length === 1 && nativoOk.pedidos[0] === CDN_URL,
    'A · no app, o host PINADO vai para `AVNative.r2Imagem` — nunca um `fetch()` cross-origin direto',
    JSON.stringify(nativoOk.pedidos));
  checar(nativoOk.ok === true && nativoOk.texto === FIXTURE_BYTES.toString(),
    'e o `fetch()` local (mesmo origin, `/r2img/`-equivalente da fixture) devolve os bytes de verdade '
    + '— a mesma coisa que `downloadCollectionImage` grava no OPFS',
    JSON.stringify(nativoOk));

  // ==== B: o host da ÁUDIO/origem principal NÃO passa pelo desvio ==========
  const nativoAudio = await pgNativo.evaluate(async (audioUrl) => {
    window.__r2Pedidos.length = 0;
    let falhou = null;
    try { await fetchImagemDaOrigem(audioUrl); } catch (e) { falhou = String(e); }
    return { pedidos: window.__r2Pedidos.slice(), falhou };
  }, AUDIO_URL);
  checar(nativoAudio.pedidos.length === 0,
    'B · a origem principal (que já manda CORS de verdade) NÃO chama o shell — só o bucket pinado precisa '
    + 'do desvio', JSON.stringify(nativoAudio));

  // ==== C: a fonte SEM RESPOSTA (status 0) lança um TypeError de verdade ===
  const semResposta = await pgNativo.evaluate(async (cdnUrl) => {
    const real = window.__AVBridge.r2Imagem;
    window.__AVBridge.r2Imagem = (id) => { window.__avResolve(id, { status: 0, url: null }); };
    let tipo = null;
    try { await fetchImagemDaOrigem(cdnUrl); } catch (e) { tipo = e instanceof TypeError; }
    window.__AVBridge.r2Imagem = real;
    return tipo;
  }, CDN_URL);
  checar(semResposta === true,
    'C · sem resposta do shell (status 0), `fetchImagemDaOrigem` lança um `TypeError` de verdade — é o '
    + 'que faz a Verificação (e qualquer outro `catch`) classificar como "sem resposta", nunca "falhou"',
    semResposta);

  // ==== D: a fonte respondendo HTTP de erro carrega o número ===============
  const httpErro = await pgNativo.evaluate(async (cdnUrl) => {
    const real = window.__AVBridge.r2Imagem;
    window.__AVBridge.r2Imagem = (id) => { window.__avResolve(id, { status: 404, url: null }); };
    let status = null;
    try { await fetchImagemDaOrigem(cdnUrl); } catch (e) { status = e.httpStatus; }
    window.__AVBridge.r2Imagem = real;
    return status;
  }, CDN_URL);
  checar(httpErro === 404,
    'D · uma resposta HTTP de erro do shell chega como uma exceção com `.httpStatus` — o mesmo desfecho '
    + 'que um `!res.ok` já produz no caminho direto, sem um segundo canal para o chamador conferir',
    httpErro);

  // ==== E: downloadCollectionImage GRAVA os bytes vindos pelo desvio =======
  //
  // Não basta o helper funcionar isolado: é `downloadCollectionImage` quem
  // decide se USA o desvio, e é ele quem grava no OPFS de verdade.
  const gravou = await pgNativo.evaluate(async (cdnUrl) => {
    window.__r2Pedidos.length = 0;
    const marca = {};
    const r = await downloadCollectionImage('fx-folder', cdnUrl, 999001, 0, false, marca);
    const arq = r ? await AVDB.opfsGetFile(r.opfsPath).catch(() => null) : null;
    return {
      pedidos: window.__r2Pedidos.slice(),
      opfsPath: r && r.opfsPath,
      bytes: arq ? new TextDecoder().decode(await arq.arrayBuffer()) : null,
      marca,
    };
  }, CDN_URL);
  checar(gravou.pedidos.length === 1 && gravou.pedidos[0] === CDN_URL,
    'E · `downloadCollectionImage` passa pelo MESMO desvio para o host pinado — não é só o helper isolado',
    JSON.stringify(gravou.pedidos));
  checar(!!gravou.opfsPath && gravou.bytes === FIXTURE_BYTES.toString(),
    'e os bytes gravados no OPFS são os que vieram pelo desvio — o fundo do slide vai ser a foto de '
    + 'verdade, não um arquivo vazio ou cortado',
    JSON.stringify({ opfsPath: gravou.opfsPath, bytes: gravou.bytes }));
  checar(!gravou.marca.fotoCausa,
    'e a MARCA não carrega causa nenhuma — sucesso não é um tipo de falha',
    JSON.stringify(gravou.marca));

  // E a FALHA do desvio dentro de `downloadCollectionImage` continua marcando
  // a MESMA causa que o caminho direto já marcava (v1.10.8) — o conserto do
  // transporte não pode apagar o diagnóstico que já existia.
  const falhouViaDesvio = await pgNativo.evaluate(async (cdnUrl) => {
    const real = window.__AVBridge.r2Imagem;
    window.__AVBridge.r2Imagem = (id) => { window.__avResolve(id, { status: 0, url: null }); };
    const marca = {};
    const r = await downloadCollectionImage('fx-folder', cdnUrl, 999002, 0, false, marca);
    window.__AVBridge.r2Imagem = real;
    return { r, marca };
  }, CDN_URL);
  checar(falhouViaDesvio.r === null && falhouViaDesvio.marca.fotoCausa === 'sem-resposta',
    'e uma falha do shell (sem resposta) marca `fotoCausa: "sem-resposta"` — a MESMA causa que o '
    + 'caminho direto já marcava, agora atravessando o desvio',
    JSON.stringify(falhouViaDesvio));

  const falhouHttpViaDesvio = await pgNativo.evaluate(async (cdnUrl) => {
    const real = window.__AVBridge.r2Imagem;
    window.__AVBridge.r2Imagem = (id) => { window.__avResolve(id, { status: 403, url: null }); };
    const marca = {};
    const r = await downloadCollectionImage('fx-folder', cdnUrl, 999003, 0, false, marca);
    window.__AVBridge.r2Imagem = real;
    return { r, marca };
  }, CDN_URL);
  checar(falhouHttpViaDesvio.r === null && falhouHttpViaDesvio.marca.fotoCausa === 'http'
    && falhouHttpViaDesvio.marca.fotoStatus === 403,
    'e uma recusa HTTP do shell (403) marca `fotoCausa: "http"` com o status — não "sem-resposta", que '
    + 'mandaria procurar a rede em vez de uma origem bloqueando de propósito',
    JSON.stringify(falhouHttpViaDesvio));

  await ctxNativo.close();

  // ==== F: sem ponte (navegador comum), nada disso existe — SEM REGRESSÃO ===
  //
  // A Web Platform não tem "cliente HTTP sem CORS": o `fetch()` direto
  // continua sendo o único caminho, e continua falhando do jeito que já
  // falhava — não há conserto possível ali, e não pode haver um NOVO jeito de
  // falhar (uma exceção não tratada, por exemplo) só porque este lote existe.
  const ctxBrowser = await navegador.newContext({ viewport: VIEWPORT });
  await semRedeExterna(ctxBrowser);
  const pgBrowser = await ctxBrowser.newPage();
  await pgBrowser.goto(`http://localhost:${porta}/controle/`, { waitUntil: 'domcontentloaded' });
  await pgBrowser.waitForFunction(
    () => window.AVDB && typeof window.__avBack === 'function' && typeof fetchImagemDaOrigem === 'function',
    null, { timeout: 30000 },
  );
  const semPonte = await pgBrowser.evaluate(async (cdnUrl) => {
    let tipo = null;
    try { await fetchImagemDaOrigem(cdnUrl); } catch (e) { tipo = e instanceof TypeError; }
    return { nativo: !!window.__NATIVE__, tipo };
  }, CDN_URL);
  checar(semPonte.nativo === false && semPonte.tipo === true,
    'F · sem ponte, o mesmo host pinado cai direto no `fetch()` de sempre (bloqueado pela rede da '
    + 'fixture) — o navegador continua sem o desvio, exatamente como antes deste lote',
    JSON.stringify(semPonte));
  await ctxBrowser.close();
} finally {
  servidor.close();
  await navegador.close();
}

if (falhas.length) {
  console.log(`\n${falhas.length} falha(s).`);
  process.exit(1);
} else {
  console.log('\nTodos passaram.');
}
