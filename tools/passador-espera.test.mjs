#!/usr/bin/env node
// O ESTADO DO PASSADOR MORA NO QUADRO CENTRAL — e em nenhum outro lugar.
//
// ## O que ele trava
//
// O Pacote 43 (v1.14.60) pôs o estado do passador em QUATRO lugares: a pílula
// `#vazio` do topo, o status vermelho `#estado` do cabeçalho e o mesmo
// "Aguardando" com o mesmo ícone nos três quadros. O operador viu no aparelho
// (2026-11-16 21:05) e pediu uma casa só: *"pode centralizar todas as
// informações de conexão e estado no slide central, não precisamos de pílulas e
// legendas fora do foco e diversas vezes"* (Pacote 46, v1.14.61).
//
// A regra nova, em três frases:
//
//   1. o TOPO tem só o título — nenhum texto de estado/conexão fora do quadro
//      central (é a varredura do DOM, e ela LISTA o que sobra);
//   2. os quadros LATERAIS não repetem legenda: sem prévia, desenham só o
//      ícone; o RÓTULO do desenho e a CONDIÇÃO DE CONEXÃO vivem no quadro do
//      MEIO, a condição numa linha dentro do cartão — nunca por cima do slide;
//   3. conectado e saudável é SILÊNCIO: o quadro do meio mostra o slide e o
//      contador, e nada mais.
//
// ## Como ele mede
//
// Um SERVIDOR DE VERDADE, com as rotas do celular (`POST /par`, `GET /e` em
// SSE, `POST /r`), serve o bundle como o aparelho serve. O teste empurra o
// `passador-estado` e lê o DOM em cada estado:
//
//   1. SEM APRESENTAÇÃO — o estado está no quadro central ("Aguardando a
//      apresentação"), os três quadros desenham, nenhum `<img>` à vista, os
//      três controles ALCANÇÁVEIS (`elementFromPoint`) e a varredura não acha
//      estado fora do central;
//   2. O TOQUE NO VAZIO — responde DENTRO do central ("A apresentação ainda não
//      começou", sem alerta) e NÃO posta;
//   3. COM APRESENTAÇÃO — as prévias carregam, o contador volta e não há status
//      nenhum: nem fora, nem dentro, nem por cima do slide;
//   4. SEM A PRÉVIA DAQUELA PÁGINA (primeira página não tem anterior) — o
//      lateral desenha SEM legenda; no meio, a prévia que falha diz "Sem prévia"
//      DENTRO do quadro;
//   5. O FIO CAI (o caminho do `error`: o servidor para de aceitar `/e`) — "Sem
//      conexão — tentando de novo" aparece DENTRO do quadro central, em alerta,
//      abaixo do slide; e quando o fio volta, a linha some (silêncio).
//
// A prova de que nenhuma dessas regressões passa verde é o próprio teste: cada
// asserção vira vermelha se a pílula do topo voltar, se o status do cabeçalho
// voltar, se a legenda voltar aos laterais ou se o "Conectado" reaparecer.
//
//   node tools/passador-espera.test.mjs
// ============================================================================
import { servirEstatico, abrirNavegador, checar, falhas, esperar, porque, RAIZ_WEB } from './arnes.mjs';

const IMAGEM = '/shared/wallpaper-padrao.svg';
const posts = [];
/** O FIO PODE SER DERRUBADO DE PROPÓSITO — é o caminho do `error`. */
const sse = {
  res: null,
  enviar(msg) { if (this.res && !this.res.writableEnded) this.res.write('data: ' + JSON.stringify(msg) + '\n\n'); },
  fechar() { if (this.res) { try { this.res.end(); } catch (_) { /* já caiu */ } this.res = null; } },
};
/** `false` = o servidor RECUSA `/e`, como uma rede caída. */
let redeBoa = true;

const servidor = servirEstatico(RAIZ_WEB, (req, res) => {
  const u = new URL(req.url, 'http://x').pathname;
  if (u === '/par') {
    req.resume();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ t: 'tok-do-oraculo' }));
    return true;
  }
  if (u === '/e') {
    if (!redeBoa) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('sem rede');
      return true;
    }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
    });
    // O `oi` é a abertura do fio (a mesma das telas).
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
const passadorPosts = () => posts.filter((p) => p.corpo.includes('"passador"'));
const fioAbriu = () => posts.some((p) => /"do":"alive"/.test(p.corpo));

/**
 * A VARREDURA — o coração deste oráculo. Ela anda nos NÓS DE TEXTO visíveis do
 * `#app` e devolve cada um com o dono (`#id` mais próximo), o escopo dentro do
 * quadro central e se ele está POR CIMA da imagem do slide.
 */
const varrer = () => pg.evaluate(() => {
  const visivel = (el) => {
    if (!el) return false;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    const b = el.getBoundingClientRect();
    return b.width > 0 && b.height > 0;
  };
  const retangulo = (el) => {
    const b = el.getBoundingClientRect();
    return { x: b.x, y: b.y, right: b.right, bottom: b.bottom, w: b.width, h: b.height };
  };
  const central = document.getElementById('cartaoAtual');
  const img = document.getElementById('imgAtual');
  const imgVisivel = visivel(img) && !!img.getAttribute('src');
  const imgRect = imgVisivel ? retangulo(img) : null;
  const cruza = (a, b) => !!a && !!b
    && !(a.right <= b.x || a.x >= b.right || a.bottom <= b.y || a.y >= b.bottom);

  const textos = [];
  const w = document.createTreeWalker(document.getElementById('app'), NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    const texto = n.nodeValue.replace(/\s+/g, ' ').trim();
    if (!texto) continue;
    const el = n.parentElement;
    if (!el || !visivel(el)) continue;
    const noCentral = central.contains(el);
    const escopo = el.closest('.estado-central') ? 'condicao'
      : el.closest('.contador') ? 'contador'
        : el.closest('.espera') ? 'espera'
          : el.closest('#topo') ? 'titulo'
            : el.closest('#acoes') ? 'controle' : 'outro';
    const rect = retangulo(el);
    textos.push({
      texto,
      em: (el.closest('[id]') || el).id || el.tagName.toLowerCase(),
      noCentral,
      escopo,
      sobreOSlide: noCentral && cruza(rect, imgRect),
      rect,
    });
  }

  const alcancavel = (id) => {
    const b = document.getElementById(id).getBoundingClientRect();
    const alvo = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
    return !!alvo && !!alvo.closest('button') && alvo.closest('button').id === id;
  };
  const e = document.getElementById('estadoCentral');
  return {
    janela: window.innerHeight,
    doc: document.documentElement.scrollHeight,
    corpo: document.body.scrollHeight,
    foraDoCentral: textos.filter((t) => !t.noCentral).map((t) => ({ texto: t.texto, em: t.em })),
    dentroDoCentral: textos.filter((t) => t.noCentral)
      .map((t) => ({ texto: t.texto, escopo: t.escopo, sobreOSlide: t.sobreOSlide })),
    sobreOSlide: textos.filter((t) => t.sobreOSlide).map((t) => ({ texto: t.texto, em: t.em })),
    pilula: !!document.getElementById('vazio'),
    statusDoTopo: !!document.getElementById('estado'),
    // O `#estadoCentral` some (hidden) quando não há nada a dizer.
    condicao: {
      existe: !!e,
      visivel: !!e && visivel(e),
      texto: e ? e.textContent.replace(/\s+/g, ' ').trim() : '',
      alerta: !!e && e.classList.contains('ruim'),
      noCentral: !!e && central.contains(e),
      sobreOSlide: !!e && visivel(e) && cruza(retangulo(e), imgRect),
    },
    central: {
      // O `textContent` inclui o rótulo do desenho mesmo escondido (o `.espera`
      // tem `display:none` quando há imagem); o que se mede é o texto VISÍVEL.
      texto: central.textContent.replace(/\s+/g, ' ').trim(),
      textoVisivel: textos.filter((t) => t.noCentral).map((t) => t.texto).join(' '),
      rotulo: (document.getElementById('esperaAtual') || {}).textContent || '',
      desenho: central.querySelectorAll('.moldura.sem-previa').length,
    },
    laterais: ['cartaoAnt', 'cartaoProx'].map((id) => {
      const c = document.getElementById(id);
      return {
        id,
        texto: c.textContent.replace(/\s+/g, ' ').trim(),
        rotulos: c.querySelectorAll('.espera-txt').length,
        desenho: c.querySelectorAll('.moldura.sem-previa').length,
        icone: [...c.querySelectorAll('.espera svg')].filter(visivel).length,
      };
    }),
    desenhoGeral: [...document.querySelectorAll('.moldura.sem-previa')].length,
    imgsVisiveis: [...document.querySelectorAll('.cartao img')].filter(visivel).length,
    imgsQuebradas: [...document.querySelectorAll('.cartao img')]
      .filter((i) => visivel(i) && !(i.complete && i.naturalWidth > 0)).length,
    contador: document.getElementById('numPagina').textContent + '/'
      + document.getElementById('numTotal').textContent,
    contadorVisivel: visivel(document.querySelector('#cartaoAtual .contador')),
    botoes: ['btnAnt', 'btnProx', 'btnCortina'].map(alcancavel),
  };
});

/** O que PODE sobrar fora do quadro central: o título da página e os rótulos
 *  dos controles. Qualquer outra coisa é estado vazando — e é reprovação. */
const FORA_DO_CENTRAL_PERMITIDO = ['Passador', '◀', '▶', 'Cortina', 'Cortina ligada'];
/** O vocabulário do estado/conexão: não pode aparecer fora do quadro central. */
const VOCABULARIO_DE_ESTADO = /aguardando|conect|conex|apresenta|prévia|tentando|limite de telas|recusou|começou/i;

try {
  await pg.goto(BASE, { waitUntil: 'domcontentloaded' });
  // O FIO ABRIU SEM ESCREVER NADA NA TELA (v1.14.61): a prova de que a página
  // entrou é o primeiro `POST /r` do sinal de vida — o mesmo batimento que o
  // servidor cobra —, e não uma frase no cabeçalho. Antes desta versão o
  // oráculo esperava o texto "Conectado", que agora NÃO PODE existir.
  let entrou = false;
  for (let i = 0; i < 150 && !entrou; i++) {
    entrou = fioAbriu();
    if (!entrou) await pg.waitForTimeout(50);
  }
  checar(entrou === true, 'a página entra e o fio abre — sem escrever "Conectado" na tela', entrou);

  // ── 1. SEM APRESENTAÇÃO: o estado mora no quadro central ────────────────
  {
    const m = await varrer();
    // A VARREDURA, e ela LISTA o que sobrou fora do central.
    console.log('        fora do quadro central: ' + JSON.stringify(m.foraDoCentral));
    checar(!m.pilula, 'a pílula do topo (`#vazio`) NÃO existe no DOM');
    checar(!m.statusDoTopo, 'o status do cabeçalho (`#estado`) NÃO existe no DOM');
    checar(m.foraDoCentral.length > 0, 'a varredura achou o que sobra fora do central (o título)',
      m.foraDoCentral);
    const vazando = m.foraDoCentral.filter((t) => VOCABULARIO_DE_ESTADO.test(t.texto));
    checar(vazando.length === 0,
      'NENHUM texto de estado ou conexão fora do quadro central', vazando);
    const foraDoVocabulario = m.foraDoCentral
      .filter((t) => !FORA_DO_CENTRAL_PERMITIDO.includes(t.texto));
    checar(foraDoVocabulario.length === 0,
      'e o que sobra fora do central é só o título e os rótulos dos controles',
      foraDoVocabulario);

    checar(/Aguardando a apresentação/.test(m.central.rotulo),
      'o quadro central diz o estado: o rótulo do desenho é "Aguardando a apresentação"',
      m.central.rotulo);
    checar(m.central.desenho === 1, 'o desenho de espera está no quadro do meio', m.central);
    checar(m.desenhoGeral === 3, 'e os três quadros desenham', `${m.desenhoGeral} de 3`);
    checar(m.laterais.every((l) => l.texto === '' && l.rotulos === 0),
      'os quadros LATERAIS não repetem legenda nenhuma (só o ícone)', m.laterais);
    checar(m.laterais.every((l) => l.icone === 1),
      'e o desenho deles é o ícone, sem texto', m.laterais);
    checar(!m.condicao.visivel && m.condicao.noCentral,
      'a linha da condição existe DENTRO do central e está calada (silêncio saudável)',
      m.condicao);
    checar(m.imgsVisiveis === 0 && m.imgsQuebradas === 0,
      'nenhum `<img>` à vista no vazio — logo, nenhum ícone de imagem quebrada',
      { visiveis: m.imgsVisiveis, quebradas: m.imgsQuebradas });
    checar(m.dentroDoCentral.every((t) => t.escopo !== 'outro'),
      'todo texto dentro do central é estado, rótulo ou contador', m.dentroDoCentral);
    checar(m.botoes.every(Boolean),
      'os três controles estão ALCANÇÁVEIS no vazio (legíveis e tocáveis)', m.botoes);
    checar(!m.contadorVisivel,
      'sem apresentação não há contagem inventada ("1/1" não aparece)');
    checar(m.doc <= m.janela + 1 && m.corpo <= m.janela + 1,
      'e nada rola: quadros + controles cabem na tela',
      { doc: m.doc, corpo: m.corpo, janela: m.janela });

    // A foto é OPCIONAL e só existe para o operador olhar em `~/tmp`: o CI não
    // escreve arquivo nenhum.
    if (process.env.PASSADOR_FOTO) {
      await pg.screenshot({ path: process.env.PASSADOR_FOTO + '-vazio.png' });
    }

    // ── 2. O TOQUE NO VAZIO RESPONDE NO CENTRAL E NÃO POSTA ───────────────
    const antes = passadorPosts().length;
    await pg.click('#btnCortina');
    const respondeu = await noEstado(() => {
      const e = document.getElementById('estadoCentral');
      return !e.hidden && /ainda não começou/.test(e.textContent);
    });
    checar(respondeu === true, 'tocar no vazio responde DENTRO do quadro central',
      porque(respondeu));
    const t = await varrer();
    checar(t.condicao.noCentral && !t.condicao.alerta && !t.condicao.sobreOSlide,
      'a resposta é do quadro central, não acende alerta e não cobre o slide', t.condicao);
    checar(t.foraDoCentral.filter((x) => VOCABULARIO_DE_ESTADO.test(x.texto)).length === 0,
      'e ela não vaza para fora do central', t.foraDoCentral);
    checar(passadorPosts().length === antes,
      'e não sobe ação nenhuma: fora do deck o controle a recusaria em silêncio',
      passadorPosts().map((p) => p.corpo));
  }

  // ── 3. COM APRESENTAÇÃO: as prévias voltam, e o silêncio é o estado ─────
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
    const m = await varrer();
    console.log('        no conectado, dentro do central: ' + JSON.stringify(m.dentroDoCentral));
    checar(m.desenhoGeral === 0, 'e o desenho de espera dá lugar às imagens', m.desenhoGeral);
    checar(m.contador === '2/3' && m.contadorVisivel,
      'o contador diz a página e o total', m.contador);
    checar(!m.condicao.visivel,
      'CONECTADO E SAUDÁVEL É SILÊNCIO: a linha da condição está apagada', m.condicao);
    // O TEXTO VISÍVEL DO CENTRAL É SÓ A CONTAGEM: o contador é `<span>` dentro
    // de `<span>`, então os nós de texto são "2", "/" e "3" — a régua é o
    // vocabulário ("nada além de número e barra"), não a string montada.
    checar(/^[0-9\s/]+$/.test(m.central.textoVisivel) && m.central.textoVisivel.replace(/\s/g, '') === '2/3',
      'o quadro central mostra o slide e o contador, e nada mais',
      { visivel: m.central.textoVisivel, cru: m.central.texto });
    checar(!VOCABULARIO_DE_ESTADO.test(m.central.textoVisivel),
      'nem dentro do central há status sobre o slide', m.central.textoVisivel);
    checar(m.sobreOSlide.length === 0,
      'nenhum texto cobre o slide do quadro central', m.sobreOSlide);
    checar(m.foraDoCentral.filter((x) => VOCABULARIO_DE_ESTADO.test(x.texto)).length === 0,
      'e nada de estado vaza para fora do central', m.foraDoCentral);
    if (process.env.PASSADOR_FOTO) {
      await pg.screenshot({ path: process.env.PASSADOR_FOTO + '-conectado.png' });
    }
  }

  // ── 4. A PRÉVIA QUE NÃO EXISTE: lateral sem legenda, meio com o estado ──
  {
    sse.enviar({
      type: 'passador-estado', ativo: true, pagina: 0, total: 3,
      ant: null, atual: IMAGEM, prox: IMAGEM, cortina: false,
    });
    const desenhou = await noEstado(() => document.querySelector('#cartaoAnt .moldura')
      .classList.contains('sem-previa'));
    checar(desenhou === true, 'sem slide anterior, o quadro lateral desenha a espera', porque(desenhou));
    const m = await varrer();
    const ant = m.laterais[0];
    checar(ant.texto === '' && ant.rotulos === 0 && ant.icone === 1,
      'e desenha SEM legenda: no lateral, o ícone basta', ant);
    const semSrc = await pg.evaluate(() => {
      const img = document.getElementById('imgAnt');
      return {
        semSrc: !img.getAttribute('src'),
        visivel: getComputedStyle(img).display !== 'none',
        botaoDesligado: document.getElementById('btnAnt').disabled,
      };
    });
    checar(semSrc.semSrc && !semSrc.visivel,
      'o `<img>` sem endereço não é mostrado, e não há imagem quebrada', semSrc);
    checar(semSrc.botaoDesligado,
      'e a seta daquele lado fica desligada (o fim da apresentação apaga a seta)');
  }

  // ── 5. A PRÉVIA DO MEIO QUE NÃO CARREGA: "Sem prévia" DENTRO do quadro ──
  {
    sse.enviar({
      type: 'passador-estado', ativo: true, pagina: 1, total: 3,
      ant: IMAGEM, atual: '/m/nao-existe.png', prox: IMAGEM, cortina: false,
    });
    const falhou = await noEstado(() => {
      const md = document.querySelector('#cartaoAtual .moldura');
      return md.classList.contains('sem-previa')
        && document.getElementById('esperaAtual').textContent === 'Sem prévia';
    });
    checar(falhou === true,
      'prévia que não carrega vira desenho — e o motivo é DITO no quadro central', porque(falhou));
    const m = await varrer();
    checar(m.imgsQuebradas === 0, 'e nenhum `<img>` quebrado sobra à vista', m.imgsQuebradas);
    checar(m.laterais.every((l) => l.texto === ''),
      'os laterais continuam calados no mesmo estado', m.laterais);
    checar(m.foraDoCentral.filter((x) => VOCABULARIO_DE_ESTADO.test(x.texto)).length === 0,
      'e o "Sem prévia" não vaza para fora do quadro central', m.foraDoCentral);
  }

  // ── 6. O FIO CAI: "Sem conexão" DENTRO do central, abaixo do slide ──────
  {
    // De volta a uma prévia do MEIO que carrega, para a queda acontecer com o
    // slide à vista — é assim que se prova que o aviso não cobre o conteúdo.
    sse.enviar({
      type: 'passador-estado', ativo: true, pagina: 1, total: 3,
      ant: IMAGEM, atual: IMAGEM, prox: IMAGEM, cortina: false,
    });
    const carregou = await noEstado(() => {
      const i = document.getElementById('imgAtual');
      return i.complete && i.naturalWidth > 0 && !document.getElementById('cartaoAtual')
        .querySelector('.moldura').classList.contains('sem-previa');
    });
    checar(carregou === true, 'o slide do meio volta a carregar antes da queda', porque(carregou));

    // O CAMINHO DO `error`: o fio morre e o servidor para de aceitar `/e`.
    redeBoa = false;
    sse.fechar();
    const caiu = await noEstado(() => {
      const e = document.getElementById('estadoCentral');
      return !e.hidden && /Sem conexão/.test(e.textContent);
    });
    checar(caiu === true, 'a queda do fio é DITA dentro do quadro central', porque(caiu));
    const m = await varrer();
    console.log('        na queda, dentro do central: ' + JSON.stringify(m.dentroDoCentral));
    checar(m.condicao.noCentral && m.condicao.alerta,
      'a linha da queda está no quadro central e acende o alerta', m.condicao);
    checar(/tentando de novo/.test(m.condicao.texto),
      'e a frase é a da reconexão', m.condicao.texto);
    checar(!m.condicao.sobreOSlide && m.sobreOSlide.length === 0,
      'o aviso NÃO se sobrepõe ao slide — ele fica abaixo da moldura',
      { condicao: m.condicao, sobreOSlide: m.sobreOSlide });
    checar(!m.pilula && !m.statusDoTopo,
      'e nem por isso a pílula ou o status do topo voltam');
    checar(m.foraDoCentral.filter((x) => VOCABULARIO_DE_ESTADO.test(x.texto)).length === 0,
      'nada de estado fora do central na queda', m.foraDoCentral);
    if (process.env.PASSADOR_FOTO) {
      await pg.screenshot({ path: process.env.PASSADOR_FOTO + '-erro.png' });
    }
  }

  // ── 7. O FIO VOLTA: a linha some (silêncio de novo) ─────────────────────
  {
    redeBoa = true;
    const abriu = await noEstado(() => {
      const e = document.getElementById('estadoCentral');
      return !!e && e.hidden;
    }, null, 20000);
    checar(abriu === true, 'quando o fio volta, a linha da condição SOME (silêncio)', porque(abriu));
    sse.enviar({
      type: 'passador-estado', ativo: true, pagina: 1, total: 3,
      ant: IMAGEM, atual: IMAGEM, prox: IMAGEM, cortina: false,
    });
    const voltou = await noEstado(() => document.getElementById('imgAtual').complete);
    checar(voltou === true, 'e as prévias continuam desenhando depois da reconexão', porque(voltou));
    const m = await varrer();
    checar(!m.condicao.visivel && m.central.textoVisivel.replace(/\s/g, '') === '2/3'
      && !VOCABULARIO_DE_ESTADO.test(m.central.textoVisivel),
      'o estado saudável é o silêncio: só o slide e o contador', m.central);

    // ── 8. O TOQUE COM APRESENTAÇÃO POSTA A AÇÃO DE VERDADE ───────────────
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
  console.log(`${falhas.length} FALHA(S) — o estado do passador não está centralizado no quadro do meio.`);
  process.exit(1);
}
console.log('O estado do passador mora no quadro central: nada fora dele fala de conexão, e o conectado é silêncio.');
