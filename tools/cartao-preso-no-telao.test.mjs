// ============================================================================
// A ESCRITURA NÃO FICA PRESA NO TELÃO (v1.8.83)
//
// Relato do operador: *"Ao tocar uma música, exibir um verso bíblico e tocar em
// 'apenas wallpaper', o preview se comporta corretamente e remove a bíblia da
// tela, mas na exibição do display, a bíblia segue sendo exibida. Isso aconteceu
// algumas vezes, mas não sempre."*
//
// ## O defeito, e por que ele era INTERMITENTE
//
// A cortina do wallpaper é COMPARTILHADA: o stage é dono dela, mas o `showText`
// do Display a move à mão para o cartão aparecer (o fade de entrada é dele). O
// que ele NÃO fazia era declarar a view ao stage — e `setViewFaded` abre com
// `if (v === view) return`.
//
// Daí a condição, que é a intermitência inteira: **só falha quando o telão já
// estava COBERTO antes de o versículo entrar.** Aí o stage guarda 'wallpaper',
// o `showText` descobre a cortina por fora, e o "apenas wallpaper" seguinte
// chega pedindo um valor que o stage acha que já tem — volta mudo. Sem o
// versículo antes, a view do stage é 'visual' e o mesmo toque funciona.
//
// E as duas metades DISCORDAVAM, que é o que o relato descreve: o `setView` do
// `controle.js` move a cortina da PREVIEW por fora (`preview.coverIn`), sem
// passar por `setViewFaded` — então a ilustração obedecia enquanto a projeção
// não. O operador via a Bíblia sair da preview e ficar na frente da congregação.
//
// ## Por que ele precisa de oráculo, e por que a medida é a CORTINA
//
// Não há erro em lugar nenhum: um `return` mudo. E "o cartão está na tela" é
// resposta ERRADA para a pergunta — o cartão CONTINUA no DOM depois de coberto
// (`.wallpaper` é z-index 3, `.text-layer` é 2), e é isso que faz descobrir
// devolvê-lo. O que separa coberto de exibido é o `display` COMPUTADO da
// cortina: `flex` = cobrindo, `none` = à vista.
//
// As quatro asserções, e nenhuma basta sozinha:
//
//   1. o ponto de partida (o versículo À VISTA sobre o louvor coberto) — sem
//      ele, um app que nunca descobrisse a cortina passaria na asserção 2;
//   2. **cobrir COBRE** — o pedido;
//   3. **descobrir DEVOLVE** — senão o conserto poderia ser "nunca descobrir",
//      e o versículo não teria como voltar;
//   4. o caminho que SEMPRE funcionou (sem cobrir antes) continua funcionando —
//      a reversão pelo outro lado.
//
// REVERSÃO MEDIDA (a linha `stage.declararView(textView)` do `showText`
// removida): a asserção 2 reprova com a cortina em `none`; as outras três
// passam. É essa assimetria que prova que ela mede o defeito e não o percurso.
//
//   node tools/cartao-preso-no-telao.test.mjs
// ============================================================================
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, checar, falhas, RAIZ_WEB } from './arnes.mjs';

const servidor = servirEstatico(RAIZ_WEB);

// Um WAV de 30 s: a cena tem de continuar tocando durante todo o percurso. Uma
// faixa que terminasse no meio cobriria a cortina por `ended` — o mesmo
// `display: flex` da asserção 2, pelo motivo errado.
const SEMEAR = `
  const sr = 8000, secs = 30, n = sr * secs;
  const buf = new ArrayBuffer(44 + n * 2), dv = new DataView(buf);
  const wr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  wr(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); wr(8, 'WAVEfmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true);
  dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  wr(36, 'data'); dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, Math.sin(i / 20) * 3000, true);
  const a = await AVDB.addMedia(new Blob([buf], { type: 'audio/wav' }),
    { name: 'Louvor de fundo', type: 'audio/wav', kind: 'audio', list: 'imports' });
`;

await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador({ args: ['--autoplay-policy=no-user-gesture-required'] });
// O palco do TELÃO, não o do celular: é a caixa em que a cortina e o cartão
// dividem o mesmo retângulo.
const ctx = await navegador.newContext({ viewport: { width: 961, height: 540 } });
await semRedeExterna(ctx);

const erros = [];
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY/;

try {
  const tv = await ctx.newPage();
  tv.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (EXTERNO.test(t) || /Failed to load resource/.test(t)) return;
    erros.push(t);
  });
  tv.on('pageerror', (e) => erros.push('pageerror: ' + e.message));

  await tv.goto(base + '/display/', { waitUntil: 'load' });
  await tv.waitForFunction(() => !!window.AVDB && !!document.getElementById('text'), null, { timeout: 20000 });
  const ids = await tv.evaluate(new Function('return (async () => {' + SEMEAR + 'return { audio: a.id }; })()'));

  // O barramento de verdade: o mesmo canal por onde o Controle fala.
  const mandar = (c) => tv.evaluate((cmd) => {
    const bc = new BroadcastChannel('av-iasd');
    bc.postMessage(cmd); bc.close();
  }, c);

  // `cortina` é o veredito; `cartao` e `tocando` são a prova de que o cenário é
  // o do relato (o cartão montado, o louvor andando) e não um palco vazio, em
  // que a cortina cobre pelos dois valores de view.
  const espiar = () => tv.evaluate(() => {
    const v = document.querySelector('video');
    return {
      cortina: getComputedStyle(document.getElementById('wallpaper')).display,
      cartao: !document.getElementById('text').hidden,
      tocando: !!v && !v.paused,
      tempo: v ? v.currentTime : null,
    };
  });

  // ======================================================================
  // O CENÁRIO DO RELATO — e é o "cobrir ANTES" que o produz
  // ======================================================================
  await mandar({ type: 'load', mediaId: ids.audio, view: 'visual', muted: true, volume: 0 });
  await tv.waitForTimeout(1500);
  await mandar({ type: 'view', view: 'wallpaper' });
  await tv.waitForTimeout(900);
  const a0 = await espiar();
  checar(a0.cortina === 'flex' && !a0.cartao && a0.tocando,
    'ponto de partida: o louvor toca com o telão COBERTO, sem cartão nenhum', a0);

  await mandar({ type: 'text', mode: 'verse', main: 'No princípio criou Deus', sub: 'Gênesis 1:1', view: 'visual' });
  await tv.waitForTimeout(900);
  const a1 = await espiar();
  checar(a1.cortina === 'none' && a1.cartao,
    'a Escritura projetada DESCOBRE a cortina e aparece — mesmo com o telão coberto antes', a1);

  // ---- A ASSERÇÃO CENTRAL: o "apenas wallpaper" do relato -----------------
  await mandar({ type: 'view', view: 'wallpaper' });
  await tv.waitForTimeout(1200);
  const a2 = await espiar();
  checar(a2.cortina === 'flex',
    'e "apenas wallpaper" COBRE a Escritura — ela não fica presa na frente da congregação', a2);
  checar(a2.tocando && a2.tempo > a1.tempo,
    '  ↳ com o louvor de fundo intacto: cobrir é a cortina, não o transporte', { a1, a2 });

  // ---- DESCOBRIR devolve: o conserto não pode ser "nunca descobrir" -------
  await mandar({ type: 'view', view: 'visual' });
  await tv.waitForTimeout(1200);
  const a3 = await espiar();
  checar(a3.cortina === 'none' && a3.cartao,
    'e o toque seguinte devolve a Escritura — o cartão continua montado por baixo '
    + 'da cortina (z-index 3 × 2), então descobrir não precisa reprojetá-lo', a3);

  // ======================================================================
  // A REVERSÃO PELO OUTRO LADO — o caminho que sempre funcionou
  // ======================================================================
  // Sem esta metade, um conserto que trocasse o defeito de lugar (cobrir sempre,
  // por exemplo) passaria em tudo o que está acima.
  await mandar({ type: 'text-hide' });
  await tv.waitForTimeout(800);
  await mandar({ type: 'load', mediaId: ids.audio, view: 'visual', muted: true, volume: 0 });
  await tv.waitForTimeout(1200);
  await mandar({ type: 'text', mode: 'verse', main: 'Eu sou o caminho', sub: 'João 14:6', view: 'visual' });
  await tv.waitForTimeout(900);
  const b1 = await espiar();
  checar(b1.cortina === 'none' && b1.cartao,
    'SEM cobrir antes, a Escritura aparece como sempre', b1);
  await mandar({ type: 'view', view: 'wallpaper' });
  await tv.waitForTimeout(1200);
  const b2 = await espiar();
  checar(b2.cortina === 'flex',
    '  ↳ e o "apenas wallpaper" deste caminho continua cobrindo', b2);

  checar(erros.length === 0, 'nenhum erro de console', erros);
} catch (e) {
  checar(false, 'o percurso terminou sem exceção (' + (e && e.message) + ')');
} finally {
  await navegador.close();
  servidor.close();
}

console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
