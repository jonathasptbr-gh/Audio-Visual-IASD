/* ============================================================================
   A PÁGINA DO PREGADOR — o cliente (Pacote 34)
   ============================================================================

   ## O que esta página é

   Uma página SERVIDA PELO CELULAR DO OPERADOR, aberta no navegador do celular
   de slides, na mesma rede. Ela:

   1. entra pela mesma porta das telas da rede (`POST /par`, sem segredo);
   2. abre o mesmo `/e` (SSE por `fetch`, com `Authorization` — o token nunca
      viaja numa URL);
   3. desenha o que chega no comando de DESCIDA `passador-estado` (ver
      `controle.js`): a página, o total, a cortina e as três imagens;
   4. manda as três ações possíveis (`prox`, `ant`, `cortina`) pelo `POST /r`,
      que o servidor filtra por lista de permissão e o Controle executa.

   ## O que ela NÃO faz, e é decisão do operador

   Nada além de slides. Sem apresentação no ar, ela não mostra prévia nenhuma:
   com uma letra, uma mensagem ou o cronômetro em cena, as imagens não existem
   na tela — os três quadros ficam no DESENHO DE ESPERA (o monitor do app com
   "Aguardando", v1.14.60) — e as ações, se chegassem, seriam recusadas do
   outro lado (`slideTarget() !== 'deck'` no `controle.js`).

   ## O `<img>` SEM `src` É O DEFEITO (v1.14.60)

   O estado de espera antigo escondia as seções com `hidden`, e o `display` da
   folha vencia o `[hidden]` do navegador: os três quadros apareciam pretos com
   o ícone de imagem quebrada, porque o `passador-estado` entrega `null` nos
   lados sem prévia (a primeira página não tem anterior). Agora o `img` só é
   mostrado com `src` E carga confirmada; qualquer outra combinação desenha a
   espera no quadro. É por isso que o `error` de cada imagem entra no mesmo
   caminho de `null`: um token de mídia vencido não pode virar ícone quebrado.

   ## O sinal de vida não é opcional

   O servidor derruba quem passa 150 s sem relatar (`TETO_SEM_RELATO_MS`), e um
   navegador de celular ESTRANGULA timer de aba em segundo plano. Por isso
   `alive` sai do timer E de cada byte que chega no fio — a mesma correção da
   v5.208 no `tela.js`, pela mesma razão: um pregador que apaga a tela do
   celular por um minuto não pode ser "desconectado" pelo servidor.
   ========================================================================== */

'use strict';

// O NOME DA CLASSE `#estado` de erro — ver `passador.css` (`.ruim`).
const MSG_CONECTANDO = 'Conectando…';
const MSG_OK = 'Conectado';
const MSG_CAIU = 'Sem conexão — tentando de novo';
const MSG_LOTADO = 'O limite de telas foi atingido — feche uma das outras';

/**
 * O TEMPO DO `alive`, e ele é MENOR que o teto do servidor de propósito: com
 * 10 s cabem quinze batidas nos 150 s do `TETO_SEM_RELATO_MS`, e um navegador
 * que estrangule o timer para ~1/min ainda entrega duas.
 */
const ALIVE_MS = 10000;
/** Quanto se espera antes de tentar de novo, e o teto da escada. */
const REENTRADA_MS = 1500;
const REENTRADA_MAX_MS = 15000;
/** O prazo de um POST — o mesmo do `tela.js` (`PRAZO_POST_MS`). */
const PRAZO_POST_MS = 15000;

const $ = (id) => document.getElementById(id);
const ui = {
  app: $('app'),
  estado: $('estado'),
  vazio: $('vazio'),
  cartoes: $('cartoes'),
  acoes: $('acoes'),
  cartaoAnt: $('cartaoAnt'),
  cartaoAtual: $('cartaoAtual'),
  cartaoProx: $('cartaoProx'),
  imgAnt: $('imgAnt'),
  imgAtual: $('imgAtual'),
  imgProx: $('imgProx'),
  numPagina: $('numPagina'),
  numTotal: $('numTotal'),
  btnAnt: $('btnAnt'),
  btnProx: $('btnProx'),
  btnCortina: $('btnCortina'),
};

let token = null;
let vivo = false;
let esperaMs = REENTRADA_MS;
let ultimoByteMs = 0;
let ultimoAliveMs = 0;
let abortar = null;
let conectado = false;
/** Há apresentação no ar? É o que separa o desenho de espera das prévias. */
let temApresentacao = false;

/** O rótulo do desenho, por motivo — o mesmo quadro serve a dois casos. */
const ESPERA = 'Aguardando';
const SEM_PREVIA = 'Sem prévia';

// ---------------------------------------------------------------------------
// O desenho
// ---------------------------------------------------------------------------

function frase(texto, ruim) {
  ui.estado.textContent = texto;
  ui.estado.classList.toggle('ruim', !!ruim);
}

/**
 * O INATIVO É UM ESTADO, e não um erro: a página continua conectada e os três
 * quadros DESENHAM a espera — nunca o ícone de imagem quebrada. O aviso do topo
 * é uma faixa discreta; os quadros e os controles continuam no lugar, que é a
 * tela que o irmão vê antes de o operador projetar. Quem reconecta é o laço,
 * e ele não depende disto.
 */
function mostrarInativo() {
  temApresentacao = false;
  ui.app.classList.add('esperando');
  ui.vazio.hidden = false;
  ui.cartoes.hidden = false;
  ui.acoes.hidden = false;

  // NENHUMA PRÉVIA SOBREVIVE AO INATIVO (decisão do operador): o desenho de
  // espera é o que fica nos três quadros, e os controles voltam acesos para o
  // estado em que o irmão ainda não tem o que passar.
  for (const img of [ui.imgAnt, ui.imgAtual, ui.imgProx]) trocarImagem(img, '', ESPERA);
  ui.btnAnt.disabled = false;
  ui.cartaoAnt.disabled = false;
  ui.btnProx.disabled = false;
  ui.cartaoProx.disabled = false;
  ui.btnCortina.classList.remove('ativa');
  ui.btnCortina.textContent = 'Cortina';
}

function mostrarAtivo(est) {
  temApresentacao = true;
  ui.app.classList.remove('esperando');
  ui.vazio.hidden = true;
  ui.cartoes.hidden = false;
  ui.acoes.hidden = false;

  const total = Number(est.total) || 0;
  const pagina = Number(est.pagina) || 0;
  ui.numPagina.textContent = String(pagina + 1);
  ui.numTotal.textContent = String(total);

  // AS IMAGENS SÓ TROCAM DE `src` QUANDO MUDA, e o motivo é o mesmo do cartão
  // fixo no CSS: reescrever o mesmo `src` re-baixa o arquivo em alguns
  // navegadores e o cartão pisca a cada tique do estado. A URL ausente NÃO
  // vira `<img>` vazio: ela desenha "Sem prévia" (é o caso da primeira página,
  // que não tem anterior).
  trocarImagem(ui.imgAnt, est.ant, SEM_PREVIA);
  trocarImagem(ui.imgAtual, est.atual, SEM_PREVIA);
  trocarImagem(ui.imgProx, est.prox, SEM_PREVIA);

  // O FIM DA APRESENTAÇÃO APAGA A SETA — e apagada ela também não toca (o
  // `disabled` do `<button>` engole o toque, sem `pointer-events` nosso).
  ui.btnAnt.disabled = pagina <= 0;
  ui.cartaoAnt.disabled = pagina <= 0;
  ui.btnProx.disabled = pagina >= total - 1;
  ui.cartaoProx.disabled = pagina >= total - 1;

  // O BOTÃO DIZ O ESTADO DA CORTINA, não a ação (ver `passador.css`).
  ui.btnCortina.classList.toggle('ativa', !!est.cortina);
  ui.btnCortina.textContent = est.cortina ? 'Cortina ligada' : 'Cortina';
}

/**
 * TROCA (OU TIRA) A PRÉVIA DE UM QUADRO — e o vazio é um DESENHO, não um
 * `<img>` sem `src`. O Chromium desenha o ícone de imagem quebrada com o `alt`
 * ao lado quando o endereço falta ou não carrega; a moldura com `sem-previa`
 * esconde a imagem e mostra o monitor com o rótulo. O `src` igual não é
 * reescrito (ver `mostrarAtivo`), mas um `src` que FALHOU é reescrito: o
 * `error` tira o endereço, e o próximo estado pode ter a mídia de novo.
 */
function trocarImagem(img, url, rotulo) {
  const novo = url || '';
  const moldura = img.parentElement;
  if (!novo) {
    if (img.getAttribute('src')) img.removeAttribute('src');
    moldura.classList.add('sem-previa');
    const txt = moldura.querySelector('.espera-txt');
    if (txt) txt.textContent = rotulo || ESPERA;
    return;
  }
  if (img.getAttribute('src') === novo) return;
  moldura.classList.remove('sem-previa');
  img.setAttribute('src', novo);
}

// A PRÉVIA QUE NÃO CARREGA É O MESMO CASO DO ENDEREÇO AUSENTE: token de mídia
// vencido, arquivo fora do ar, apresentação fechada no meio da carga. O
// `<img>` sai de cena e o quadro desenha — nenhum estado desta página mostra o
// ícone de imagem quebrada do navegador.
for (const img of [ui.imgAnt, ui.imgAtual, ui.imgProx]) {
  img.addEventListener('error', () => {
    if (img.getAttribute('src')) img.removeAttribute('src');
    const moldura = img.parentElement;
    moldura.classList.add('sem-previa');
    const txt = moldura.querySelector('.espera-txt');
    if (txt) txt.textContent = SEM_PREVIA;
  });
}

// ---------------------------------------------------------------------------
// A sessão: entrar, abrir o fio, manter-se vivo
// ---------------------------------------------------------------------------

async function pedirEntrada() {
  let resp;
  try {
    resp = await fetch('/par', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // O MESMO RELATO DAS TELAS: ua/tamanho. Não há código a digitar — a
      // decisão do operador é que a porta é a rede (§8 do TELAO-POR-COMANDOS).
      body: JSON.stringify({
        ua: String(navigator.userAgent || '').slice(0, 88),
        w: window.innerWidth | 0,
        h: window.innerHeight | 0,
      }),
      cache: 'no-store',
    });
  } catch (e) {
    return { erro: MSG_CAIU };
  }
  const corpo = await resp.json().catch(() => ({}));
  if (resp.status === 200 && corpo && corpo.t) {
    token = corpo.t;
    return { erro: '' };
  }
  if (corpo && corpo.estado === 'lotado') return { erro: MSG_LOTADO };
  return { erro: 'O celular recusou esta página' };
}

async function postar(corpo) {
  if (!token) return false;
  const ac = new AbortController();
  const t = setTimeout(() => { try { ac.abort(); } catch (e) { /* já caiu */ } }, PRAZO_POST_MS);
  try {
    const r = await fetch('/r', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
      cache: 'no-store',
      signal: ac.signal,
    });
    // 404 UNIFORME = a sessão venceu (o operador religou, a vaga foi tomada).
    // Não há nada a digitar: o laço reentra sozinho.
    if (r.status === 404 || r.status === 403) { token = null; return false; }
    return r.ok;
  } catch (e) {
    return false;
  } finally {
    clearTimeout(t);
  }
}

function enviarAlive() {
  if (!token) return;
  ultimoAliveMs = Date.now();
  postar({
    do: 'alive',
    telaAcesaMin: 0,
    // Vai para o Registro do operador, que SANEIA: o texto sai sem acento de
    // propósito (a lição da v5.155 é de quem escreve).
    aviso: '[passador de slides] ' + (conectado ? 'conectado' : 'reconectando'),
  });
}

async function conectar() {
  const ac = new AbortController();
  abortar = ac;
  let resp;
  try {
    resp = await fetch('/e', {
      headers: { Authorization: 'Bearer ' + token },
      cache: 'no-store',
      signal: ac.signal,
    });
  } catch (e) {
    return;
  }
  if (resp.status === 404 || resp.status === 403) { token = null; return; }
  if (!resp.ok || !resp.body) return;

  conectado = true;
  esperaMs = REENTRADA_MS;
  frase(MSG_OK, false);

  const leitor = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  ultimoByteMs = Date.now();
  while (true) {
    let r;
    try {
      r = await leitor.read();
    } catch (e) {
      break;
    }
    if (r.done) break;
    ultimoByteMs = Date.now();
    // O SINAL DE VIDA PEGA CARONA NO FIO: byte que chega não é timer, e é a
    // correção que a v5.208 trouxe para a tela da rede.
    if (Date.now() - ultimoAliveMs >= ALIVE_MS) enviarAlive();
    buf += dec.decode(r.value, { stream: true });
    let corte;
    while ((corte = buf.indexOf('\n\n')) >= 0) {
      const bruto = buf.slice(0, corte);
      buf = buf.slice(corte + 2);
      tratarEvento(bruto);
    }
    // Teto de sanidade: evento sem terminador não cresce sem fim.
    if (buf.length > 65536) buf = '';
  }
  conectado = false;
}

function tratarEvento(bruto) {
  // O ping é um comentário (`: ping <epoch-ms>`) — ignorado, mas ele já contou
  // como byte no laço acima, que é o que importa.
  const linhas = bruto.split('\n');
  let dados = '';
  for (const l of linhas) {
    if (l.startsWith('data:')) dados += l.slice(5).trim();
  }
  if (!dados) return;
  let msg;
  try { msg = JSON.parse(dados); } catch (e) { return; }
  if (!msg) return;

  // `oi` é a abertura do fio (a mesma das telas) — não diz nada sobre slide.
  if (msg.type !== 'passador-estado') return;

  if (!msg.ativo) { mostrarInativo(); return; }
  mostrarAtivo(msg);
}

/**
 * O LAÇO. Uma sessão que morreu (404) pede token novo; uma rede que caiu espera
 * e volta. O TETO da escada existe para o culto: de 1,5 s dobrando até 15 s, o
 * celular do pregador volta sozinho quando o operador religa a transmissão, sem
 * ninguém tocar em nada.
 */
async function laco() {
  if (vivo) return;
  vivo = true;
  while (vivo) {
    if (!token) {
      const r = await pedirEntrada();
      if (r.erro) {
        frase(r.erro, true);
        await esperar(esperaMs);
        esperaMs = Math.min(esperaMs * 2, REENTRADA_MAX_MS);
        continue;
      }
    }
    try {
      await conectar();
    } catch (e) {
      /* o laço reentra */
    }
    if (!vivo) break;
    // O FIO CAIU COM TOKEN VÁLIDO: espera curta e volta. Com token morto,
    // `conectar` o zerou, e a volta passa pelo `POST /par` acima.
    frase(token ? MSG_CAIU : MSG_CONECTANDO, true);
    await esperar(token ? 800 : esperaMs);
  }
}

function esperar(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Os botões
// ---------------------------------------------------------------------------

function acao(a) {
  // SEM APRESENTAÇÃO, O TOQUE RESPONDE E NÃO POSTA: o controle do outro lado
  // desiste fora do deck (`slideTarget() !== 'deck'`), então o POST morreria em
  // silêncio e o botão pareceria quebrado. A frase do topo diz por que nada
  // mudou no telão.
  if (!temApresentacao) { frase('A apresentação ainda não começou', false); return; }
  // Sem sessão, o toque não some calado: a frase do topo é o retorno, e o laço
  // continua de pé.
  if (!token) { frase(MSG_CAIU, true); return; }
  postar({ do: 'passador', acao: a });
}

ui.btnAnt.addEventListener('click', () => acao('ant'));
ui.btnProx.addEventListener('click', () => acao('prox'));
ui.cartaoAnt.addEventListener('click', () => acao('ant'));
ui.cartaoProx.addEventListener('click', () => acao('prox'));
ui.btnCortina.addEventListener('click', () => acao('cortina'));

// ---------------------------------------------------------------------------
// A tela do celular do pregador não pode apagar no meio do sermão
// ---------------------------------------------------------------------------

let trava = null;

async function vigiar() {
  if (!('wakeLock' in navigator)) return;
  try {
    trava = await navigator.wakeLock.request('screen');
  } catch (e) {
    // Recusa é engolida: a página continua funcionando; o celular tem a
    // própria economia de tela, e ela é decisão de quem segura o aparelho.
  }
}

document.addEventListener('visibilitychange', () => {
  // A VOLTA DA ABA É SINAL DE VIDA NA HORA — e a trava morre quando a aba sai
  // de foco, então ela é re-pedida aqui.
  if (document.hidden) return;
  enviarAlive();
  vigiar();
});

setInterval(() => {
  if (document.hidden) return;
  enviarAlive();
}, ALIVE_MS);

frase(MSG_CONECTANDO, false);
mostrarInativo();
vigiar();
laco();
