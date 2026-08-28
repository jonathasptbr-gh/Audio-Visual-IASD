#!/usr/bin/env node
// A RECUSA DA TRANSMISSÃO DIZ O QUE FAZER — e só quando é de REDE.
//
// ## Por que ele existe
//
// A folha de conexão sempre mostrou o VEREDITO do shell, verbatim, e isso está
// certo: a frase é de quem decidiu. O que faltava era a INSTRUÇÃO. O operador
// lia *"sem rede para transmitir"*, que é verdade e não diz o próximo
// movimento — e o movimento que a frase antiga (*"o espelho só liga em Wi-Fi"*)
// sugeria era procurar uma Wi-Fi, exatamente o que a igreja sem rede não tem.
//
// As duas metades falham CALADAS, e em direções opostas:
//
//  - **ensino de menos** — a recusa aparece sozinha e o operador não sabe que
//    ligar o ponto de acesso do próprio celular resolve. Nada quebra; ele
//    desiste do recurso.
//  - **ensino de mais** — "ensinar sempre" passaria num teste que só
//    verificasse a primeira metade. E aí a recusa de PORTA OCUPADA (a única
//    deste caminho com conserto diferente: a rede está certa, o que falta é
//    fechar quem tomou a porta) viria acompanhada de uma instrução que manda
//    mexer na rede — mandando o operador consertar o que não está quebrado.
//
// Por isso o teste é em PARES, e tem uma TERCEIRA metade: o ensino não pode
// ficar de pé depois que a transmissão sobe.
//
// ## E a metade que lê o Kotlin
//
// A decisão "isto é uma recusa de rede" é um teste por PALAVRA sobre uma frase
// que o Kotlin escolhe (`CAST_RECUSA_DE_REDE`, no `controle.js`). São duas
// listas em dois arquivos, e a técnica é a do `tipos-que-sobem.test.mjs`, pelo
// mesmo motivo: duas listas sem oráculo divergem no primeiro esquecimento, e
// aqui a divergência é MUDA — alguém reescreve uma `Recusa` no Kotlin, a
// palavra sai da frase, e o ensino simplesmente para de aparecer.
//
//   node tools/recusa-transmissao.test.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(RAIZ, 'app/src/main/assets/web');
const JS = fs.readFileSync(path.join(WEB, 'controle/controle.js'), 'utf8');
const KT_SRV = fs.readFileSync(path.join(RAIZ, 'app/src/main/java/br/org/iasd/av/EspelhoServidor.kt'), 'utf8');
const KT_ACT = fs.readFileSync(path.join(RAIZ, 'app/src/main/java/br/org/iasd/av/MainActivity.kt'), 'utf8');

const falhas = [];
function checar(cond, msg, obtido) {
  if (cond) console.log('ok      ' + msg);
  else { console.log('FALHOU  ' + msg + (obtido !== undefined ? '\n        obtido: ' + obtido : '')); falhas.push(msg); }
}

// ---------------------------------------------------------------------------
// METADE 1 — o PAR de listas: as recusas de REDE contêm a palavra, a de PORTA não
// ---------------------------------------------------------------------------
//
// A regra é lida do próprio `controle.js` (e não redigitada aqui): copiá-la
// faria este oráculo aprovar a si mesmo no dia em que ela mudasse.
const mRegra = JS.match(/const CAST_RECUSA_DE_REDE = (\/[^\n]+\/[a-z]*);/);
if (!mRegra) {
  checar(false, 'achei a `CAST_RECUSA_DE_REDE` no controle.js',
    'sem ela este oráculo não mede nada — não deixe passar por ausência');
} else {
  // eslint-disable-next-line no-eval
  const regra = eval(mRegra[1]);
  checar(true, 'a regra do ensino foi lida do controle.js: ' + mRegra[1]);

  // As frases de RECUSA DE REDE, verbatim dos dois arquivos Kotlin que as
  // escrevem. Cada uma tem de casar — senão o ensino não aparece justamente
  // no caso para o qual ele foi escrito.
  const deRede = [
    ...KT_SRV.matchAll(/Recusa\("([^"]*(?:Wi-Fi|rede)[^"]*)"\)/g),
  ].map((m) => m[1]);
  const genericas = [
    ...KT_SRV.matchAll(/return "(sem rede para transmitir[^"]*)"/g),
  ].map((m) => m[1]);
  // A continuação da frase montada em duas partes no `motivoSemRede`.
  const alvos = [...deRede, ...genericas];
  checar(alvos.length >= 3,
    'achei as frases de recusa de REDE no Kotlin (' + alvos.length + ')',
    JSON.stringify(alvos));
  alvos.forEach((f) => {
    checar(regra.test(f), 'recusa de rede casa com a regra do ensino: "' + f + '"');
  });

  // O PAR: a recusa de PORTA OCUPADA não pode casar. Ela é a única deste
  // caminho cujo conserto NÃO é mexer na rede.
  const mPorta = KT_SRV.match(/Recusa\("(nao foi possivel abrir a porta[^"]*)"/);
  checar(!!mPorta, 'achei a recusa de PORTA no EspelhoServidor.kt');
  if (mPorta) {
    const frase = mPorta[1].replace('$porta', '8787').replace('${e.message}', 'Address already in use');
    checar(!regra.test(frase),
      'e a recusa de PORTA **não** casa — "ensinar sempre" passaria sem esta metade',
      frase);
  }

  // E a recusa da rede ESCOLHIDA que sumiu também não ensina: ali o operador
  // já tem a lista na tela e o movimento é escolher de novo, não ligar nada.
  const mEscolhida = KT_ACT.match(/"(a rede escolhida nao esta mais disponivel)"/);
  checar(!!mEscolhida, 'achei a recusa da rede escolhida na MainActivity.kt');
}

// ---------------------------------------------------------------------------
// METADE 2 — o COMPORTAMENTO: o veredito sai verbatim, o ensino só na rede
// ---------------------------------------------------------------------------
const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const ctx = await navegador.newContext();
await semRedeExterna(ctx);
const pg = await ctx.newPage();

try {
  // Este oráculo NÃO sobe o Controle inteiro: o que ele mede são três funções
  // (`limparCastMsg`, a regra, e o ramo de erro do `ligarEspelho`) sobre dois
  // nós do documento. Subir a tela toda traria o acervo, o hinário e a
  // inicialização assíncrona para dentro de um teste que fala de duas frases.
  const trecho = JS.match(/const CAST_RECUSA_DE_REDE[\s\S]*?^}/m);
  checar(!!trecho, 'consegui isolar o bloco do ensino do controle.js');

  await pg.setContent(`<!doctype html><html><body>
    <p id="castMsg"></p><p id="castEnsino" hidden></p>
  </body></html>`);

  const r = await pg.evaluate(({ fonte }) => {
    // O ambiente mínimo que aquele bloco supõe.
    const castMsgEl = document.getElementById('castMsg');
    const castEnsinoEl = document.getElementById('castEnsino');
    const texto2 = (el, t) => { if (el) el.textContent = t; };
    // eslint-disable-next-line no-new-func
    const montar = new Function('castMsgEl', 'castEnsinoEl', 'texto2', `
      ${fonte}
      return { limparCastMsg, CAST_RECUSA_DE_REDE, CAST_ENSINO };
    `);
    const api = montar(castMsgEl, castEnsinoEl, texto2);

    // O ramo de erro do `ligarEspelho`, na forma exata em que ele roda.
    const recusar = (erro) => {
      api.limparCastMsg();
      texto2(castMsgEl, erro);
      if (castEnsinoEl && api.CAST_RECUSA_DE_REDE.test(erro)) {
        texto2(castEnsinoEl, api.CAST_ENSINO);
        castEnsinoEl.hidden = false;
      }
    };
    const ler = () => ({
      msg: castMsgEl.textContent,
      ensino: castEnsinoEl.hidden ? '' : castEnsinoEl.textContent,
    });

    const saida = {};
    recusar('sem rede para transmitir — ligue o ponto de acesso deste celular, ou entre numa Wi-Fi (nao precisa de internet)');
    saida.rede = ler();
    recusar('nao foi possivel abrir a porta 8787: Address already in use');
    saida.porta = ler();
    // O SUCESSO: o `ligarEspelho` chama `limparCastMsg()` no caminho feliz.
    api.limparCastMsg();
    saida.sucesso = ler();
    return saida;
  }, { fonte: trecho ? trecho[0] : '' });

  checar(r.rede.msg.startsWith('sem rede para transmitir'),
    'recusa de REDE: o veredito do shell sai VERBATIM', r.rede.msg);
  checar(r.rede.ensino.includes('ponto de acesso') && r.rede.ensino.includes('não precisa de internet'),
    'recusa de REDE: e o ensino aparece, nomeando as duas saídas', r.rede.ensino);

  checar(r.porta.msg.startsWith('nao foi possivel abrir a porta'),
    'recusa de PORTA: o veredito também sai verbatim', r.porta.msg);
  checar(r.porta.ensino === '',
    'recusa de PORTA: e o ensino NÃO aparece — a rede está certa, o conserto é outro',
    r.porta.ensino);

  checar(r.sucesso.msg === '' && r.sucesso.ensino === '',
    'no sucesso nada fica de pé — um ensino sob um endereço que já serve é pior que ensino nenhum',
    JSON.stringify(r.sucesso));
} catch (e) {
  checar(false, 'o percurso terminou sem exceção (' + (e && e.message) + ')');
}

await navegador.close();

if (falhas.length) {
  console.log('\n' + falhas.length + ' falha(s).');
  process.exit(1);
}
console.log('\nTodos passaram.');
