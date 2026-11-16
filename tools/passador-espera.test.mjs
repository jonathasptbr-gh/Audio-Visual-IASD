#!/usr/bin/env node
// O ESTADO DE ESPERA DESENHADO — os três quadros do passador sem imagem quebrada.
//
// ## O que ele trava
//
// O operador abriu a página no navegador antes de conectar (2026-11-16 20:05) e
// viu o defeito que nenhum oráculo via: um texto enorme de "nenhuma
// apresentação no ar" ocupando a área dos slides E a dos controles, e os três
// quadros pretos com o ícone de imagem quebrada do navegador. A causa era uma
// só, e ela é MUDA: o `[hidden]` das seções perdia para o `display: flex/grid`
// da folha, então as três seções apareciam juntas e o `<img>` sem `src` (o
// `passador-estado` entrega `null` nos lados sem prévia) desenhava o ícone
// quebrado com o `alt` ao lado. Nada no console, nada no CI.
//
// ## Como ele mede
//
// Um SERVIDOR DE VERDADE, com as rotas do celular (`POST /par`, `GET /e` em
// SSE, `POST /r`), serve o bundle como o aparelho serve. O teste empurra o
// `passador-estado` e lê o DOM em cada estado:
//
//   1. SEM APRESENTAÇÃO — os três quadros desenham (símbolo + "Aguardando"),
//      nenhum `<img>` à vista, o aviso é uma faixa (≤ 12% da tela), e os três
//      controles estão no lugar e ALCANÇÁVEIS (`elementFromPoint`);
//   2. COM APRESENTAÇÃO — as três prévias carregam de volta, o aviso some e o
//      contador volta;
//   3. SEM A PRÉVIA DAQUELA PÁGINA (primeira página não tem anterior) — o
//      quadro desenha "Sem prévia" em vez de imagem quebrada;
//   4. PRÉVIA QUE NÃO CARREGA (token vencido, arquivo fora) — o `error` do
//      `<img>` cai no mesmo desenho;
//   5. O TOQUE — no vazio ele responde no topo e NÃO posta (o controle recusa
//      fora do deck); com apresentação ele posta a ação de verdade.
//
// A prova de que nenhuma dessas regressões passa verde é o próprio teste: cada
// asserção vira vermelha se o `sem-previa` sair do HTML, se o `[hidden]` da
// folha sair, ou se o aviso voltar a ser bloco.
//
//   node tools/passador-espera.test.mjs
// ============================================================================
import { servirEstatico, abrirNavegador, checar, falhas, esperar, porque, RAIZ_WEB } from './arnes.mjs';

const IMAGEM = '/shared/wallpaper-padrao.svg';
const posts = [];
const sse = { res: null, enviar(msg) { if (this.res && !this.res.writableEnded) this.res.write('data: ' + JSON.stringify(msg) + '\n\n'); } };

const servidor = servirEstatico(RAIZ_WEB, (req, res) => {
  const u = new URL(req.url, 'http://x').pathname;
  if (u === '/par') {
    req.resume();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ t: 'tok-do-oraculo' }));
    return true;
  }
  if (u === '/e') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
    });
    // O `oi` é a abertura do fio: a página só liga o "Conectado" depois dele.
    res.write('data: ' + JSON.stringify({ type: 'oi' }) + '\n\n');
    sse.res = res;
    req.on('close', () => { if (sse.res === res) sse.res = null; });
    return true;
  }
  if (u === '/r') {
    let corpo = '';
    req.on('data', (c) => { corpo += c; });
    req.on('end', () => {
      posts.push({ corpo, auth: req.headers.authorization });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    });
    return true;
  }
  return false;
});
await new Promise((r) => servidor.listen(0, r));
const BASE = 'http://127.0.0.1:' + servidor.address().port + '/passador-de-slides/';

const navegador = await abrirNavegador();
const pg = await navegador.newPage({ viewport: { width: 390, height: 844 } });
pg.on('pageerror', () => {});

const noEstado = (fn, arg = null) => esperar(pg, fn, arg);
const textoDe = (id) => pg.textContent('#' + id);
const passadorPosts = () => posts.filter((p) => p.corpo.includes('"passador"'));

try {
  await pg.goto(BASE, { waitUntil: 'domcontentloaded' });
  const conectou = await noEstado(() => document.getElementById('estado').textContent === 'Conectado');
  checar(conectou === true, 'a página entra e o fio abre (o servidor de teste respondeu)',
    porque(conectou));

  // ── 1. SEM APRESENTAÇÃO: o desenho, a faixa e os controles ───────────────
  {
    const m = await pg.evaluate(() => {
      const r = (el) => el.getBoundingClientRect();
      const visivel = (el) => !!el && getComputedStyle(el).display !== 'none' && r(el).height > 0;
      const janela = window.innerHeight;
      const vazio = document.getElementById('vazio');
      const molduras = [...document.querySelectorAll('.moldura')];
      const imgs = [...document.querySelectorAll('.cartao img')];
      const alcancavel = (id) => {
        const b = r(document.getElementById(id));
        const alvo = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
        return !!alvo && !!alvo.closest('button') && alvo.closest('button').id === id;
      };
      return {
        janela,
        vazioVisivel: visivel(vazio),
        vazioTexto: vazio.textContent.trim(),
        vazioAltura: Math.round(r(vazio).height),
        vazioFracao: +(r(vazio).height / janela).toFixed(3),
        cartoesAbertos: !document.getElementById('cartoes').hidden,
        acoesAbertas: !document.getElementById('acoes').hidden,
        desenho: molduras.filter((m) => m.classList.contains('sem-previa')).length,
        rotulos: [...document.querySelectorAll('.espera-txt')].map((e) => e.textContent),
        imgsVisiveis: imgs.filter((i) => visivel(i)).length,
        imgsQuebradas: imgs.filter((i) => visivel(i) && !(i.complete && i.naturalWidth > 0)).length,
        botoes: ['btnAnt', 'btnProx', 'btnCortina'].map((id) => alcancavel(id)),
        doc: document.documentElement.scrollHeight,
        corpo: document.body.scrollHeight,
      };
    });
    checar(m.vazioVisivel, 'no vazio, o aviso está VISÍVEL (o irmão sabe por que não há slides)');
    checar(m.vazioFracao <= 0.12, 'o aviso é uma faixa discreta, não um bloco',
      `${m.vazioAltura} px de ${m.janela} = ${(m.vazioFracao * 100).toFixed(1)}%`);
    checar(/Nenhuma apresentação no ar/.test(m.vazioTexto),
      'o aviso diz que nenhuma apresentação está no ar', m.vazioTexto);
    checar(m.cartoesAbertos && m.acoesAbertas,
      'os quadros e os controles continuam montados no vazio',
      { cartoes: m.cartoesAbertos, acoes: m.acoesAbertas });
    checar(m.desenho === 3 && m.rotulos.every((t) => t === 'Aguardando'),
      'os três quadros DESENHAM a espera com o rótulo "Aguardando"',
      { desenho: m.desenho, rotulos: m.rotulos });
    checar(m.imgsVisiveis === 0 && m.imgsQuebradas === 0,
      'nenhum `<img>` à vista no vazio — logo, nenhum ícone de imagem quebrada',
      { visiveis: m.imgsVisiveis, quebradas: m.imgsQuebradas });
    checar(m.botoes.every(Boolean),
      'os três controles estão ALCANÇÁVEIS no vazio (legíveis e tocáveis)',
      m.botoes);
    checar(m.doc <= m.janela + 1 && m.corpo <= m.janela + 1,
      'e nada rola: quadros + controles cabem na tela',
      { doc: m.doc, corpo: m.corpo, janela: m.janela });
    // A foto é OPCIONAL e só existe para o operador olhar em `~/tmp`: o CI não
    // escreve arquivo nenhum.
    if (process.env.PASSADOR_FOTO) {
      await pg.screenshot({ path: process.env.PASSADOR_FOTO + '-espera.png' });
    }

    // O TOQUE NO VAZIO RESPONDE E NÃO POSTA.
    const antes = passadorPosts().length;
    await pg.click('#btnCortina');
    const respondeu = await noEstado(() => /ainda não começou/.test(document.getElementById('estado').textContent));
    checar(respondeu === true, 'tocar no vazio responde na linha de estado (o botão não parece morto)',
      porque(respondeu) || await textoDe('estado'));
    checar(passadorPosts().length === antes,
      'e não sobe ação nenhuma: fora do deck o controle a recusaria em silêncio',
      passadorPosts().map((p) => p.corpo));
  }

  // ── 2. COM APRESENTAÇÃO: as três prévias voltam ──────────────────────────
  {
    sse.enviar({
      type: 'passador-estado', ativo: true, pagina: 1, total: 3,
      ant: IMAGEM, atual: IMAGEM, prox: IMAGEM, cortina: false,
    });
    const carregou = await noEstado(() => {
      const imgs = [...document.querySelectorAll('.cartao img')];
      return imgs.length === 3 && imgs.every((i) => i.complete && i.naturalWidth > 0);
    });
    checar(carregou === true, 'com a apresentação no ar, as três prévias carregam', porque(carregou));
    const m = await pg.evaluate(() => ({
      vazioOculto: document.getElementById('vazio').hidden,
      desenho: [...document.querySelectorAll('.moldura.sem-previa')].length,
      contador: document.getElementById('numPagina').textContent + '/'
        + document.getElementById('numTotal').textContent,
      estado: document.getElementById('estado').textContent,
    }));
    checar(m.vazioOculto, 'o aviso do vazio sai de cena com apresentação no ar');
    checar(m.desenho === 0, 'e o desenho de espera dá lugar às imagens', m.desenho);
    checar(m.contador === '2/3', 'o contador diz a página e o total', m.contador);
    if (process.env.PASSADOR_FOTO) {
      await pg.screenshot({ path: process.env.PASSADOR_FOTO + '-conectado.png' });
    }
  }

  // ── 3. A PRÉVIA QUE NÃO EXISTE (primeira página não tem anterior) ────────
  {
    sse.enviar({
      type: 'passador-estado', ativo: true, pagina: 0, total: 3,
      ant: null, atual: IMAGEM, prox: IMAGEM, cortina: false,
    });
    const desenhou = await noEstado(() => {
      const md = document.querySelector('#cartaoAnt .moldura');
      return md.classList.contains('sem-previa')
        && document.querySelector('#cartaoAnt .espera-txt').textContent === 'Sem prévia';
    });
    checar(desenhou === true, 'sem slide anterior, o quadro desenha "Sem prévia" em vez de imagem quebrada',
      porque(desenhou));
    const m = await pg.evaluate(() => {
      const img = document.getElementById('imgAnt');
      const visivel = getComputedStyle(img).display !== 'none';
      return {
        semSrc: !img.getAttribute('src'),
        visivel,
        quebrada: visivel && !(img.complete && img.naturalWidth > 0),
        botaoDesligado: document.getElementById('btnAnt').disabled,
      };
    });
    checar(m.semSrc && !m.visivel && !m.quebrada,
      'o `<img>` sem endereço não é mostrado, e não há imagem quebrada', m);
    checar(m.botaoDesligado, 'e a seta daquele lado fica desligada (o fim da apresentação apaga a seta)');
  }

  // ── 4. A PRÉVIA QUE NÃO CARREGA: o `error` cai no mesmo desenho ──────────
  {
    sse.enviar({
      type: 'passador-estado', ativo: true, pagina: 1, total: 3,
      ant: IMAGEM, atual: '/m/nao-existe.png', prox: IMAGEM, cortina: false,
    });
    const falhou = await noEstado(() => {
      const md = document.querySelector('#cartaoAtual .moldura');
      return md.classList.contains('sem-previa')
        && document.querySelector('#cartaoAtual .espera-txt').textContent === 'Sem prévia';
    });
    checar(falhou === true, 'prévia que não carrega vira desenho — nunca o ícone quebrado', porque(falhou));
    const m = await pg.evaluate(() => {
      const imgs = [...document.querySelectorAll('.cartao img')];
      return {
        visiveis: imgs.filter((i) => getComputedStyle(i).display !== 'none').length,
        quebradas: imgs.filter((i) => getComputedStyle(i).display !== 'none'
          && !(i.complete && i.naturalWidth > 0)).length,
      };
    });
    checar(m.quebradas === 0, 'e nenhum `<img>` quebrado sobra à vista', m);
  }

  // ── 5. DE VOLTA AO INATIVO, O TOQUE COM APRESENTAÇÃO POSTA ───────────────
  {
    sse.enviar({
      type: 'passador-estado', ativo: true, pagina: 0, total: 3,
      ant: null, atual: IMAGEM, prox: IMAGEM, cortina: false,
    });
    await noEstado(() => document.getElementById('vazio').hidden);
    const antes = passadorPosts().length;
    await pg.click('#btnProx');
    const subiu = await (async () => {
      for (let i = 0; i < 40; i++) {
        if (passadorPosts().length > antes) return true;
        await pg.waitForTimeout(50);
      }
      return false;
    })();
    checar(subiu, 'com apresentação, o toque POSTA a ação no servidor de verdade',
      passadorPosts().slice(antes).map((p) => p.corpo));
    const ultimo = passadorPosts()[passadorPosts().length - 1];
    checar(ultimo && /"do":"passador"/.test(ultimo.corpo) && /"acao":"prox"/.test(ultimo.corpo)
      && ultimo.auth === 'Bearer tok-do-oraculo',
      'o corpo é `{do:"passador",acao:"prox"}` e leva o token da sessão', ultimo && ultimo.corpo);
  }
} finally {
  await navegador.close();
  await new Promise((r) => servidor.close(r));
}

console.log('');
if (falhas.length) {
  console.log(`${falhas.length} FALHA(S) — o estado de espera do passador não está garantido.`);
  process.exit(1);
}
console.log('O passador desenha a espera, não mostra imagem quebrada e devolve as prévias quando há apresentação.');
