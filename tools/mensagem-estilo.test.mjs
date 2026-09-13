// ============================================================================
// O ESTILO DE UMA MENSAGEM, NOS DOIS LADOS DO CARTÃO (v1.9.1)
//
// Pedido do operador: *"crie um botão na gaveta de opções da mensagem, que
// permite configurar o tamanho da fonte, a fonte e o alinhamento daquela
// mensagem."*
//
// A REGRA mora em `shared/stage.js` (`createStage.estiloDoCartao`) porque os
// DOIS lados a aplicam: o telão (`display.js` → `aplicarEstiloDoCartao`) e a
// preview do Controle (`showPvText`). Os dois escrevem QUATRO VARIÁVEIS na caixa
// do cartão — `--msg-escala`, `--msg-linhas`, `--msg-fonte`, `--msg-alinha` — e
// quem decide onde cada uma entra é a folha.
//
// ## Por que a régua é o valor COMPUTADO, e nunca a variável
//
// Uma asserção sobre `--msg-alinha` prova que o JS escreveu a propriedade, e é
// exatamente isso que NÃO está em dúvida. O que pode falhar calado está na
// FOLHA, e são três caminhos distintos:
//
//  - a regra do lado que ninguém olhou. As duas metades são escritas em
//    arquivos diferentes (`display.css` e `controle.css`), e a preview existe
//    para ESPELHAR o telão: um `font-family` esquecido de um dos lados dá um
//    cartão que o operador confere centrado e a congregação vê à esquerda.
//  - o `text-align` sem contra o que alinhar. A `.text-box` é `flex-direction:
//    column` com `align-items: center`, então o bloco de texto nasce do tamanho
//    do CONTEÚDO — sem `align-self: stretch` a caixa encosta no texto e
//    "esquerda" desenha exatamente o mesmo pixel que "centro". A propriedade
//    computa certo; o botão parece quebrado.
//  - a família que não chega ao GLIFO. `font-family` computa para a string que
//    se escreveu mesmo quando ela não resolve face nenhuma, então a asserção
//    mede também a LARGURA DA TINTA: três famílias com o mesmo corpo têm
//    avanços diferentes, e é isso que prova que a fonte de fato trocou.
//
// ## O que mais falha calado aqui
//
//  - **uma mensagem SEM `estilo` mudar de aparência.** Toda mensagem gravada
//    antes deste recurso — e a ESTROFE da letra avulsa, que entra pelo mesmo
//    `mode: 'message'` sem estilo nenhum — tem de sair EXATAMENTE como saía. A
//    régua é o próprio fallback da folha: as quatro variáveis REMOVIDAS da caixa
//    são, literalmente, o cartão de antes do recurso.
//  - **a escala sem o recorte.** A caixa do cartão não cresce com a fonte: com o
//    clamp parado em sete, "Enorme" é cortado no MEIO de uma linha pelo
//    `overflow: hidden` — meia linha de altura na frente da congregação. Daí
//    `linhas` sair de uma DIVISÃO, e não de uma constante.
//  - **as variáveis SOBREVIVEREM ao cartão.** Fora do modo mensagem elas são
//    removidas, e não zeradas. Hoje isso não move um pixel (nenhuma regra de
//    versículo as lê) e é justamente por isso que precisa de oráculo: quem
//    escrever a próxima regra que as leia herda o alinhamento do aviso anterior,
//    sem ninguém ter pedido.
//  - **uma regra VIZINHA desaparecer.** Ver o bloco C: uma chave sobrando no fim
//    do bloco novo do `controle.css` ENGOLIU a regra seguinte, e o Chromium não
//    diz nada — a `.pv-text-content.mode-chrono .pv-text-main` deixou de existir,
//    e com ela o `tabular-nums` sem o qual o relógio da preview treme.
//
// REVERSÕES MEDIDAS: ver o relatório do lote. Cada asserção deste arquivo tem um
// alvo próprio, e o par mais importante é o dos DOIS lados: tirar a variável do
// `display.css` reprova o bloco A e deixa o B verde, e vice-versa.
//
//   node tools/mensagem-estilo.test.mjs
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { semRedeExterna } from './sem-rede.mjs';
import {
  servirEstatico, abrirNavegador, checar, falhas, RAIZ_WEB, esperar, porque, esperarCortina,
} from './arnes.mjs';

const servidor = servirEstatico(RAIZ_WEB);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;

const navegador = await abrirNavegador();
// O viewport é o do CELULAR porque é a página do Controle que manda; a do telão
// ganha o retângulo dele logo abaixo, com `setViewportSize`. As duas no MESMO
// contexto de propósito: é o que faz o `BroadcastChannel` ligar uma à outra,
// como os dois WebViews do mesmo processo no aparelho.
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);

const erros = [];
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY|ERR_ABORTED/;
const ouvir = (pg, quem) => {
  pg.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (EXTERNO.test(t) || /Failed to load resource/.test(t)) return;
    erros.push(quem + ': ' + t);
  });
  pg.on('pageerror', (e) => erros.push(quem + ' pageerror: ' + e.message));
};

// O QUE SE MEDE, e é o mesmo nos dois lados — só os seletores mudam. `tinta` é a
// caixa do TEXTO (um `Range` sobre o conteúdo), não a do elemento: com
// `align-self: stretch` o bloco tem a largura da caixa inteira em todos os
// casos, e é a tinta que responde "a fonte trocou?" e "o alinhamento moveu?".
function SONDA(selConteudo, selMain) {
  const cx = document.querySelector(selConteudo);
  const el = document.querySelector(selMain);
  if (!cx || !el) return { faltando: !cx ? selConteudo : selMain };
  const cs = getComputedStyle(el);
  const caixa = el.parentElement.getBoundingClientRect();
  const r = document.createRange();
  r.selectNodeContents(el);
  const t = r.getBoundingClientRect();
  const rEl = el.getBoundingClientRect();
  const vars = getComputedStyle(cx);
  return {
    corpo: Math.round(parseFloat(cs.fontSize) * 100) / 100,
    linhas: cs.webkitLineClamp || cs.getPropertyValue('-webkit-line-clamp'),
    familia: cs.fontFamily,
    alinha: cs.textAlign,
    // A LARGURA DA TINTA, arredondada ao pixel: ela é o que muda quando a
    // família de fato troca, e o que não muda quando só a propriedade trocou.
    tinta: Math.round(t.width),
    // ONDE a tinta pousa dentro da caixa — as duas folgas. Centrado elas são
    // iguais; à esquerda a da esquerda é ~0.
    folgaEsq: Math.round(t.left - rEl.left),
    folgaDir: Math.round(rEl.right - t.right),
    // A CAIXA ESTICOU? Sem `align-self: stretch` ela encosta no texto, e aí
    // "esquerda" e "centro" desenham o mesmo pixel.
    esticou: Math.round(rEl.width) >= Math.round(caixa.width) - 1,
    // As quatro variáveis, só para o bloco da HERANÇA — ali a ausência É o fato.
    escalaVar: vars.getPropertyValue('--msg-escala').trim(),
    linhasVar: vars.getPropertyValue('--msg-linhas').trim(),
    fonteVar: vars.getPropertyValue('--msg-fonte').trim(),
    alinhaVar: vars.getPropertyValue('--msg-alinha').trim(),
  };
}

// O CARTÃO DE ANTES DO RECURSO, medido no próprio app: as quatro variáveis
// REMOVIDAS da caixa deixam a folha cair nos `var(…, padrão)`, que é o que uma
// base web nova rodando contra um comando sem `estilo` tem de produzir. Medir
// assim, em vez de digitar "7.4cqmin de 540px", é o que impede a asserção de
// virar uma segunda cópia da folha.
function BASELINE(selConteudo, selMain, sonda) {
  const cx = document.querySelector(selConteudo);
  const guardadas = ['--msg-escala', '--msg-linhas', '--msg-fonte', '--msg-alinha']
    .map((n) => [n, cx.style.getPropertyValue(n)]);
  guardadas.forEach(([n]) => cx.style.removeProperty(n));
  const r = eval('(' + sonda + ')')(selConteudo, selMain);
  guardadas.forEach(([n, v]) => { if (v) cx.style.setProperty(n, v); });
  return r;
}

const MSG = 'AVISO DA SECRETARIA\nA reunião de pais fica para sábado, às 15h.';

try {
  // ======================================================================
  // A · O TELÃO
  // ======================================================================
  const tv = await ctx.newPage();
  ouvir(tv, 'telao');
  await tv.setViewportSize({ width: 961, height: 540 });
  await tv.goto(base + '/display/', { waitUntil: 'load' });
  {
    const r = await esperar(tv, () => !!window.AVDB && !!document.getElementById('textMain'), null, 20000);
    checar(r === true, 'A · o telão subiu com o cartão no DOM', porque(r));
  }

  // O barramento de verdade — o mesmo canal por onde o Controle fala. O objeto
  // que POSTA não recebe a própria mensagem; o do `db.js` recebe.
  const mandar = (c) => tv.evaluate((o) => {
    const bc = new BroadcastChannel('av-iasd');
    bc.postMessage(o); bc.close();
  }, c);

  // O SINAL DE CHEGADA É A VARIÁVEL; O VEREDITO É O VALOR COMPUTADO — e os dois
  // são coisas diferentes de propósito. O comando atravessa o
  // `BroadcastChannel`, que é assíncrono: sem esperar por NADA, a sonda mede o
  // cartão ANTERIOR e a suíte fica atrasada de um comando (MEDIDO na primeira
  // escrita deste arquivo: "Enorme" lia o corpo do médio, "Pequeno" lia o do
  // enorme, e as três famílias saíam uma casa deslocadas). Esperar pelo valor
  // que se vai afirmar seria a tautologia; esperar pela variável não é — o que
  // este arquivo afirma é o que a FOLHA faz com ela.
  const verTv = (estilo, texto = MSG) => tv.evaluate(async (a) => {
    const alvo = createStage.estiloDoCartao(a.estilo);
    const bc = new BroadcastChannel('av-iasd');
    bc.postMessage({ type: 'text', mode: 'message', main: a.texto, sub: '', estilo: a.estilo, view: 'visual' });
    bc.close();
    const cx = document.querySelector('.text-content');
    const chegou = () => {
      const cs = getComputedStyle(cx);
      return document.getElementById('textMain').textContent === a.texto
        && cs.getPropertyValue('--msg-escala').trim() === String(alvo.escala)
        && cs.getPropertyValue('--msg-fonte').trim() === alvo.fonte
        && cs.getPropertyValue('--msg-alinha').trim() === alvo.alinha;
    };
    for (let i = 0; i < 120 && !chegou(); i++) await new Promise((f) => requestAnimationFrame(f));
    return Object.assign({ chegou: chegou() },
      eval('(' + a.sonda + ')')('.text-content', '.text-main'));
  }, { texto, estilo, sonda: SONDA.toString() });

  const semEstilo = await verTv(null);
  const antes = await tv.evaluate((a) => eval('(' + a.bl + ')')('.text-content', '.text-main', a.sonda),
    { bl: BASELINE.toString(), sonda: SONDA.toString() });

  // ── A1 · UMA MENSAGEM SEM ESTILO SAI COMO SAÍA ──────────────────────────
  checar(semEstilo.corpo > 0 && antes.corpo > 0
    && Math.abs(semEstilo.corpo - antes.corpo) < 0.5
    && semEstilo.linhas === antes.linhas
    && semEstilo.alinha === antes.alinha,
    'A1 · o PADRÃO é o cartão de antes do recurso: um comando sem `estilo` desenha '
    + 'o MESMO corpo, o mesmo recorte de linhas e o mesmo alinhamento que a folha '
    + 'entrega com as quatro variáveis AUSENTES — o `var(…, padrão)` medido pelo '
    + 'próprio app, e não um número digitado aqui',
    JSON.stringify({ semEstilo, antes }));
  checar(semEstilo.linhas === '7' && semEstilo.alinha === 'center',
    'A1 · e esse padrão é NOMEADO (sete linhas, centrado): sem esta metade, mudar '
    + 'o `CARTAO_PADRAO` para "Enorme" passaria — as duas medidas andariam juntas',
    JSON.stringify([semEstilo.linhas, semEstilo.alinha]));

  // ── A2 · TAMANHO: O CORPO CRESCE E O RECORTE ENCOLHE ────────────────────
  const enorme = await verTv({ tamanho: 'enorme' });
  const pequeno = await verTv({ tamanho: 'pequeno' });
  checar(Math.abs(enorme.corpo - semEstilo.corpo * 1.6) < 0.6
    && Math.abs(pequeno.corpo - semEstilo.corpo * 0.75) < 0.6,
    'A2 · "Enorme" e "Pequeno" mudam o CORPO RENDERIZADO na razão da tabela do '
    + 'palco (1,6 e 0,75 do médio) — medido em px computado, não na variável',
    JSON.stringify({ medio: semEstilo.corpo, enorme: enorme.corpo, pequeno: pequeno.corpo }));
  checar(Number(enorme.linhas) === 4 && Number(pequeno.linhas) === 9,
    'A2 · e A ESCALA GOVERNA O RECORTE: a caixa não cresce com a fonte, então o '
    + 'clamp DIVIDE (7/1,6 → 4; 7/0,75 → 9). Parado em sete, "Enorme" é cortado '
    + 'no meio de uma linha pelo `overflow: hidden` da caixa',
    JSON.stringify([enorme.linhas, pequeno.linhas]));

  // ── A3 · FONTE: A FAMÍLIA CHEGA AO GLIFO ────────────────────────────────
  const serifa = await verTv({ fonte: 'serifa' });
  const maquina = await verTv({ fonte: 'maquina' });
  checar(/Georgia/.test(serifa.familia) && /monospace/.test(maquina.familia)
    && serifa.familia !== semEstilo.familia,
    'A3 · a FAMÍLIA computada é a da tabela do palco, e não a herdada',
    JSON.stringify([semEstilo.familia, serifa.familia, maquina.familia]));
  checar(serifa.corpo === semEstilo.corpo && maquina.corpo === semEstilo.corpo
    && serifa.tinta !== semEstilo.tinta && maquina.tinta !== serifa.tinta,
    'A3 · e ELA CHEGA AO GLIFO: com o MESMO corpo, a largura da TINTA muda entre '
    + 'as três famílias. `font-family` computa para a string que se escreveu mesmo '
    + 'quando ela não resolve face nenhuma — é o avanço do texto que prova a troca',
    JSON.stringify({ padrao: semEstilo.tinta, serifa: serifa.tinta, maquina: maquina.tinta }));

  // ── A4 · ALINHAMENTO: E A CAIXA QUE O TORNA VISÍVEL ─────────────────────
  // O TEXTO É CURTO AQUI, e a escolha é a régua: um parágrafo que QUEBRA enche a
  // linha mais larga de ponta a ponta, e aí a tinta centrada tem folga ZERO —
  // "centro" e "esquerda" medem o mesmo, e a asserção passa a aprovar os dois.
  // MEDIDO na primeira escrita: na preview (uma caixa de ~138px) o parágrafo de
  // duas linhas dava folga 0 nos DOIS lados.
  const CURTO = 'AVISO';
  const centroCurto = await verTv({ alinha: 'centro' }, CURTO);
  const esquerda = await verTv({ alinha: 'esquerda' }, CURTO);
  const direita = await verTv({ alinha: 'direita' }, CURTO);
  checar(esquerda.alinha === 'left' && direita.alinha === 'right'
    && centroCurto.alinha === 'center',
    'A4 · o ALINHAMENTO computado segue os três chips', JSON.stringify(
      [centroCurto.alinha, esquerda.alinha, direita.alinha]));
  checar(esquerda.esticou && direita.esticou && centroCurto.esticou,
    'A4 · e a caixa do texto ESTICA (`align-self: stretch`): a `.text-box` é uma '
    + 'coluna com `align-items: center`, então sem isso o bloco nasce do tamanho do '
    + 'CONTEÚDO e não há contra o que alinhar — a propriedade computa certo e o '
    + 'desenho não muda um pixel', JSON.stringify(
      [centroCurto.esticou, esquerda.esticou, direita.esticou]));
  checar(esquerda.folgaEsq <= 1 && direita.folgaDir <= 1
    && centroCurto.folgaEsq > 1 && Math.abs(centroCurto.folgaEsq - centroCurto.folgaDir) <= 1,
    'A4 · e A TINTA DE FATO SE MOVE: à esquerda ela encosta na borda esquerda da '
    + 'caixa, à direita na direita, e no centro as duas folgas são iguais. É esta '
    + 'metade — e não o `text-align` computado — que reprova o `stretch` removido',
    JSON.stringify({ centro: [centroCurto.folgaEsq, centroCurto.folgaDir],
      esq: [esquerda.folgaEsq, esquerda.folgaDir],
      dir: [direita.folgaEsq, direita.folgaDir] }));

  // TODAS AS MEDIDAS SÃO DE UM CARTÃO QUE CHEGOU. Sem esta linha, um comando
  // que nunca pousasse deixaria a sonda lendo o cartão ANTERIOR — e as razões
  // acima passariam a comparar duas medidas do MESMO estado, calando.
  checar([semEstilo, enorme, pequeno, serifa, maquina, centroCurto, esquerda, direita]
    .every((m) => m.chegou),
    'A · e cada medida é de um cartão que de fato POUSOU (o comando atravessa o '
    + 'BroadcastChannel, que é assíncrono): sem esperar, a sonda lê o cartão '
    + 'anterior e a suíte inteira fica atrasada de um comando',
    JSON.stringify([semEstilo, enorme, pequeno, serifa, maquina, centroCurto, esquerda, direita]
      .map((m) => m.chegou)));

  // ── A5 · UM VERSÍCULO NÃO HERDA O ESTILO DO AVISO ───────────────────────
  //
  // A régua aqui é a PROPRIEDADE, e não um pixel, porque hoje não há pixel: o
  // versículo tem regra própria (`6.4cqmin`, clamp 8) e nenhuma delas lê as
  // quatro. É exatamente por isso que ela precisa de oráculo — a decisão
  // ESCRITA é "removidas, não zeradas", e quem escrever a próxima regra que as
  // leia herdaria o alinhamento do aviso anterior sem ninguém ter pedido.
  await verTv({ tamanho: 'enorme', fonte: 'serifa', alinha: 'esquerda' });
  await mandar({ type: 'text', main: 'Porque Deus amou o mundo…', sub: 'João 3:16', view: 'visual' });
  const versiculo = await esperar(tv,
    () => !document.querySelector('.text-content').classList.contains('mode-message'), null, 5000);
  checar(versiculo === true, 'A5 · o versículo entrou (o cartão saiu do modo mensagem)', porque(versiculo));
  const vs = await tv.evaluate((s) => eval('(' + s + ')')('.text-content', '.text-main'), SONDA.toString());
  checar(!vs.escalaVar && !vs.linhasVar && !vs.fonteVar && !vs.alinhaVar,
    'A5 · e as quatro variáveis são REMOVIDAS da caixa, não zeradas: um versículo '
    + 'não herda o tamanho, a fonte nem o alinhamento do aviso que estava no ar '
    + 'antes dele', JSON.stringify(vs));
  checar(Number(vs.linhas) === 8 && vs.corpo < enorme.corpo,
    'A5 · e ele sai com os números DELE (clamp 8), que é a prova de que o cartão '
    + 'trocou de modo de verdade e a asserção acima não mediu um cartão vazio',
    JSON.stringify([vs.linhas, vs.corpo, enorme.corpo]));

  // ======================================================================
  // B · A PREVIEW DO CONTROLE — o mesmo cartão, pelo caminho do OPERADOR
  // ======================================================================
  // Um gesto só: tocar na linha da mensagem. Daí saem as DUAS metades — a
  // preview (`showPvText`, mesmo documento) e o telão (o `estilo` VIAJANDO no
  // comando, que é a única forma de a outra ponta saber dele).
  const pg = await ctx.newPage();
  ouvir(pg, 'controle');
  await pg.goto(base + '/controle/', { waitUntil: 'load' });
  {
    const r = await esperar(pg, () => window.AVDB && typeof window.__avBack === 'function'
      && (!!document.querySelector('#playlist li') || document.getElementById('plBtn').disabled),
    null, 25000);
    checar(r === true, 'B · o Controle subiu', porque(r));
  }
  await esperarCortina(pg);

  await pg.evaluate(() => { setAppMode('full'); document.getElementById('toolsBtn').click(); });
  {
    const r = await esperar(pg, () => !!document.querySelector('.misc-panel .msg-list'),
      null, 10000);
    checar(r === true, 'B · a folha de Ferramentas abriu na aba Mensagens', porque(r));
  }

  const abrir = (estilo, texto = MSG) => pg.evaluate(async (a) => {
    const alvo = createStage.estiloDoCartao(a.estilo);
    // TIRAR DO AR ANTES: o toque na linha é um ALTERNADOR (v5.104) — com a
    // mensagem já projetada ele TIRA em vez de projetar, e a sonda mediria o
    // cartão que acabou de sair. Foi assim que a primeira escrita deste arquivo
    // leu o padrão no lugar do estilo em três asserções seguidas.
    if (msgProjecting()) hideMessage();
    clearMsgSession();
    messages.length = 0;
    messages.push({ id: 'or1', text: a.texto, estilo: a.estilo });
    await saveMessages();
    refreshDiversos();
    await new Promise((f) => setTimeout(f, 60));
    // O TOQUE É NO `.msg-text`: é ele que carrega o ouvinte que projeta (v5.104).
    document.querySelector('.msg-item .msg-text').click();
    const cx = document.querySelector('.pv-text-content');
    // A CAMADA TEM DE ESTAR À VISTA, e isto é uma armadilha MEDIDA, não zelo:
    // `#pvText` nasce `hidden`, e num contêiner `display: none` as unidades de
    // consulta caem no VIEWPORT PEQUENO — `7.4cqmin` lia 31,82px (7,4% de 430)
    // no lugar dos 10,24px da caixa de verdade. A sonda devolvia um número
    // plausível, de outro retângulo.
    const aVista = () => cx.getBoundingClientRect().height > 40;
    const chegou = () => {
      const cs = getComputedStyle(cx);
      return aVista()
        && document.getElementById('pvTextMain').textContent === a.texto
        && cs.getPropertyValue('--msg-escala').trim() === String(alvo.escala)
        && cs.getPropertyValue('--msg-fonte').trim() === alvo.fonte
        && cs.getPropertyValue('--msg-alinha').trim() === alvo.alinha;
    };
    for (let i = 0; i < 120 && !chegou(); i++) await new Promise((f) => requestAnimationFrame(f));
    return Object.assign({ chegou: chegou() },
      eval('(' + a.sonda + ')')('.pv-text-content', '.pv-text-main'));
  }, { texto, estilo, sonda: SONDA.toString() });

  const pvPadrao = await abrir(null);
  const pvAntes = await pg.evaluate((a) => eval('(' + a.bl + ')')('.pv-text-content', '.pv-text-main', a.sonda),
    { bl: BASELINE.toString(), sonda: SONDA.toString() });
  checar(pvPadrao.corpo > 0 && Math.abs(pvPadrao.corpo - pvAntes.corpo) < 0.5
    && pvPadrao.linhas === pvAntes.linhas && pvPadrao.alinha === pvAntes.alinha,
    'B1 · na PREVIEW uma mensagem sem `estilo` também sai como saía — o mesmo '
    + 'fallback medido no próprio documento', JSON.stringify({ pvPadrao, pvAntes }));
  checar(pvPadrao.chegou === true, 'B1 · (e o cartão pousou antes de ser medido)',
    JSON.stringify(pvPadrao));

  const pvEstilo = await abrir({ tamanho: 'enorme', fonte: 'serifa', alinha: 'esquerda' });
  checar(Math.abs(pvEstilo.corpo - pvPadrao.corpo * 1.6) < 0.6
    && /Georgia/.test(pvEstilo.familia) && pvEstilo.alinha === 'left'
    && Number(pvEstilo.linhas) === 4,
    'B2 · e A PREVIEW ESPELHA O TELÃO nos três eixos: ela roda em OUTRO arquivo de '
    + 'folha (`controle.css`), e um eixo esquecido ali dá um cartão que o operador '
    + 'confere centrado e a congregação vê à esquerda',
    JSON.stringify(pvEstilo));
  checar(pvEstilo.chegou === true, 'B2 · (e o cartão pousou antes de ser medido)',
    JSON.stringify(pvEstilo));

  // ── B3 · O ESTILO VIAJA NO COMANDO ──────────────────────────────────────
  // O telão é a OUTRA página: ele não tem o registro da mensagem e não pode
  // perguntar "qual é o estilo desta?". Se o `estilo` não sair dentro do `text`,
  // esta asserção reprova enquanto a B2 fica verde — e é esse par que separa
  // "a folha está certa" de "a informação chegou".
  const naTv = await tv.evaluate((s) => eval('(' + s + ')')('.text-content', '.text-main'), SONDA.toString());
  checar(/Georgia/.test(naTv.familia) && naTv.alinha === 'left'
    && Math.abs(naTv.corpo - semEstilo.corpo * 1.6) < 0.6,
    'B3 · e o MESMO toque leva o estilo ao TELÃO: o `estilo` viaja DENTRO do '
    + 'comando `text`, como o `time`/`playing` do `load` — a outra ponta não tem o '
    + 'registro na mão', JSON.stringify(naTv));

  // ── B4 · COM A MENSAGEM NO AR, A GAVETA MUDA O QUE ESTÁ PROJETADO ───────
  const depois = await pg.evaluate(async (a) => {
    // Abre a gaveta desta linha e toca no chip "Pequeno" do eixo Tamanho.
    document.querySelector('.msg-estilo-btn').click();
    await new Promise((f) => setTimeout(f, 80));
    const linha = [...document.querySelectorAll('.msg-estilo-linha')]
      .find((l) => l.textContent.trim().startsWith('Tamanho'));
    [...linha.querySelectorAll('.misc-chip')].find((b) => b.textContent === 'Pequeno').click();
    await new Promise((f) => setTimeout(f, 250));
    return {
      pv: eval('(' + a.sonda + ')')('.pv-text-content', '.pv-text-main'),
      gravado: (await AVDB.getState('messages'))[0].estilo,
      noAr: msgProjecting(),
    };
  }, { sonda: SONDA.toString() });
  checar(depois.noAr === true && depois.gravado && depois.gravado.tamanho === 'pequeno'
    && depois.gravado.fonte === 'serifa',
    'B4 · escolher com a mensagem NO AR grava o eixo tocado e PRESERVA os outros — '
    + 'o registro é mesclado sobre o padrão, nunca substituído',
    JSON.stringify(depois.gravado));
  checar(Math.abs(depois.pv.corpo - pvPadrao.corpo * 0.75) < 0.6,
    'B4 · e a PREVIEW muda na hora: quem leva a mudança é uma REPROJEÇÃO, porque o '
    + 'estilo viaja no comando e não há um segundo caminho para "só o estilo"',
    JSON.stringify([pvPadrao.corpo, depois.pv.corpo]));
  const tvDepois = await esperar(tv,
    (alvo) => Math.abs(parseFloat(getComputedStyle(document.querySelector('.text-main')).fontSize) - alvo) < 0.6,
    semEstilo.corpo * 0.75, 5000);
  checar(tvDepois === true,
    'B4 · e o TELÃO também — é a reprojeção que o alcança, pelo mesmo trilho que as '
    + 'telas da rede já usam', porque(tvDepois));

  // ── B5 · O ALINHAMENTO SE VÊ NA PREVIEW ─────────────────────────────────
  // POR ÚLTIMO, e a ordem é a régua: cada `abrir` REPROJETA, então medir o telão
  // (B3) ou o registro gravado (B4) DEPOIS destas duas leria o estilo destas —
  // foi assim que a segunda escrita deste arquivo reprovou por si mesma.
  // AQUI TAMBÉM O TEXTO É CURTO (ver a razão no A4): a caixa da preview mede
  // ~138px, e um parágrafo que quebra enche a linha inteira — centrado ou não.
  const pvCentro = await abrir({ alinha: 'centro' }, 'AVISO');
  const pvEsq = await abrir({ alinha: 'esquerda' }, 'AVISO');
  checar(pvEsq.esticou && pvCentro.esticou
    && pvEsq.folgaEsq <= 1 && pvCentro.folgaEsq > 1,
    'B5 · inclusive o `align-self: stretch`, sem o qual "esquerda" desenha o mesmo '
    + 'pixel que "centro" — a tinta de fato encosta na borda esquerda da caixa',
    JSON.stringify({ centro: [pvCentro.folgaEsq, pvCentro.folgaDir],
      esq: [pvEsq.folgaEsq, pvEsq.folgaDir], esticou: [pvCentro.esticou, pvEsq.esticou] }));

  // ======================================================================
  // C · A FOLHA DO CONTROLE CONTINUA PARSEÁVEL (a chave sobrando)
  // ======================================================================
  // O bloco novo do `controle.css` saiu deste lote com uma chave a mais no fim
  // (`}}`), e no topo de uma folha um `}` sobrando não é ignorado: o Chromium o
  // RECONSOME como começo de uma regra qualificada, engole o prelúdio da
  // SEGUINTE e descarta as duas. MEDIDO: a `.pv-text-content.mode-chrono
  // .pv-text-main` desapareceu do CSSOM, e com ela o `tabular-nums` sem o qual o
  // relógio da preview treme a cada segundo, o `nowrap` que impede "12:34:56 PM"
  // de quebrar em duas linhas, e o tamanho que o faz ser lido do fundo do salão.
  //
  // Nada disso dá erro em lugar nenhum — não há requisição falhando, não há
  // console, e o número continua na tela. Por isso a régua é a LISTA: todo
  // seletor do cartão escrito no arquivo tem de estar VIVO no CSSOM.
  const fonteCss = fs.readFileSync(path.join(RAIZ_WEB, 'controle', 'controle.css'), 'utf8');
  const declarados = [...new Set((fonteCss.match(/\.pv-text-content[^{,\n]*/g) || [])
    .map((s) => s.trim()).filter((s) => s.includes('.pv-text-')))];
  checar(declarados.length >= 4,
    'C · o arquivo declara as regras do cartão da preview (a leitura do fonte '
    + 'aconteceu — sem esta metade, uma expressão que não casa nada aprovaria '
    + 'qualquer folha)', JSON.stringify(declarados));
  const vivos = await pg.evaluate(() => {
    const out = [];
    for (const ss of document.styleSheets) {
      let rs; try { rs = ss.cssRules; } catch (_) { continue; }
      for (const r of rs) if (r.selectorText) out.push(r.selectorText);
    }
    return out;
  });
  const normal = (s) => s.replace(/\s+/g, ' ').trim();
  const mortos = declarados.filter((d) => !vivos.some((v) => normal(v) === normal(d)));
  checar(mortos.length === 0,
    'C · e NENHUMA delas desapareceu do CSSOM: uma chave sobrando engole a regra '
    + 'seguinte em silêncio, e a vítima aqui foi o `tabular-nums` do relógio da '
    + 'preview — o número continua na tela, tremendo', JSON.stringify(mortos));

  checar(erros.length === 0, 'nenhum erro de página nas duas metades', erros.slice(0, 4));
} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) {
  console.log('\n' + falhas.length + ' falha(s).');
  process.exit(1);
}
console.log('\nTodos passaram.');
