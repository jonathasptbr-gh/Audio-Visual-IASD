#!/usr/bin/env node
// ============================================================================
// A TELA CONECTADA COM O TELÃO NO CHÃO — o silêncio dos dois lados
//
// ## O defeito que ele trava
//
// Relato do operador: *"ao tentar conectar com uma smart TV, o volume ficou
// travando, às vezes vinha e às vezes não vinha"*.
//
// "HÁ TELA" NUNCA FOI "HÁ TELÃO". `AVNative.displays()` responde pelo
// `DisplayManager`; quem projeta é a `Presentation` — e as duas divergem
// exatamente durante uma negociação de Miracast, que é quando o operador está
// conectando:
//
//   · `p.show()` LANÇA com o dongle instável (o próprio `syncPresentation` já
//     tratava a exceção), e a tela continua listada;
//   · o sistema derruba a janela SOZINHO numa oscilação, e o
//     `setOnDismissListener` zera a `Presentation` — a tela continua listada.
//
// Enquanto o lado web perguntou `lastDisplays.length > 0`, esse estado calava a
// preview (havia "para onde mandar o som") sem ninguém tocando do outro lado.
// **Silêncio nos dois lados**, sem erro no console, sem nada na tela, e com o
// Registro afirmando "conectado" — a frase que manda investigar o app quando o
// que falhou foi a janela.
//
// E ele não passava sozinho: `syncPresentation` só volta a rodar por um evento
// do `DisplayManager` — que numa tela que CONTINUA listada não vem — ou por um
// `onResume`, que exige o operador sair do app e voltar. Num culto o celular
// fica no suporte.
//
// ## O que este oráculo mede, e por que nenhuma metade basta
//
//  1. **TELÃO NO CHÃO** (`telao: false`): o som fica NESTE aparelho
//     (`somLocalDeveEstar`), o microfone NÃO é oferecido (quem capta é o
//     `/display/` dentro da `Presentation`) e o Modo Fácil não destrava.
//  2. **O ESTADO É DIZÍVEL**: o Registro e a folha de conexão separam "não há
//     TV" de "a TV está aí e o telão não subiu". Sem esta metade, a correção
//     poderia ser um filtro que simplesmente esconde a TV — e aí o operador lê
//     "nenhuma TV" com o cabo na mão.
//  3. **A RECUPERAÇÃO** (`telao` vira true): som, microfone e Modo Fácil voltam
//     SEM o operador trocar de aba. É a metade que a escada de retomada do
//     shell existe para alcançar, e sem ela a correção seria só um jeito novo
//     de ficar parado.
//
// O CENÁRIO É `appMode: 'full'` de propósito: no Modo Fácil `somLocalDeveEstar`
// depende também do `tocarNoCelular`, e a pergunta aqui é sobre a DERIVAÇÃO da
// conexão, não sobre a escolha do operador.
//
//   node tools/telao-no-chao.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, checar, falhas } from './arnes.mjs';

// A ponte de mentira, com a LISTA DE TELAS MUTÁVEL: `__avDisplaysChanged` do
// `native.js` reconsulta a ponte, então basta trocar o que ela responde para a
// TV entrar, o telão cair e o telão voltar dentro do mesmo teste.
const PONTE = `(() => {
  window.__telas = [];
  const B = {
    shellVersion: () => 59,
    role: () => 'controle',
    appVersion: () => '1.99-teste',
    takeShare: () => '',
    busPost: () => {},
    otaConfirm: () => {},
    displays: (id) => {
      setTimeout(() => { try { window.__avResolve(id, window.__telas); } catch (_) {} }, 0);
    },
    requestMic: (id) => {
      setTimeout(() => { try { window.__avResolve(id, true); } catch (_) {} }, 0);
    },
  };
  const nomes = ['apkInstalar','apkProcurar','bgProgress','captureVolumeKeys','projecaoLocal','castTarget',
    'cifraDiag','cifraHtml','deckDiscard','deckExportUrl','deckPages','espelhoCertApagar',
    'espelhoCertEstado','espelhoCertImportar','espelhoDesligar','espelhoDiag','espelhoEstado',
    'espelhoLigar','espelhoLigarEm','espelhoDerrubar','farolEstado','keepAlive',
    'listFolder','micDiag','nowPlaying','openCast','openExternal','otaApply','otaCheck','otaDiag',
    'otaPending','pickDoc','pickFolder','salvarTexto','systemVolume','temaClaro','ytCancel',
    'ytCanalPlaylists','ytDiag','ytDiscard','ytFetch','ytFetchAte','ytFetchAudio','ytPlaylist',
    'ytSearch','ytStream','areaTransferencia','atualizacaoEstado',
    // OS OITO DO CLONE (shell 65). Eles entram aqui porque o cloneRetomar
    // roda na abertura de TODO oráculo que sobe o Controle com a ponte: sem o
    // nome, a chamada lança dentro do native.js. Uma ponte de mentira que não
    // conhece um método que o app chama é a divergência que este repositório já
    // pagou uma vez.
    'acervoCeder','acervoPararCessao','acervoPublicar','acervoResponder',
    'acervoProcurar','acervoParear','acervoSoltar','acervoEstado',
  ];
  for (const n of nomes) {
    if (B[n]) continue;
    B[n] = (...args) => {
      const id = args[0];
      if (typeof id === 'string') setTimeout(() => { try { window.__avResolve(id, null); } catch (_) {} }, 0);
      return undefined;
    };
  }
  window.__AVBridge = B;
})();`;

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);

await new Promise((r) => servidor.listen(0, r));
const navegador = await abrirNavegador();
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);
const pg = await ctx.newPage();
const base = 'http://localhost:' + servidor.address().port;

// Troca a lista de telas e ESPERA a ingestão — nunca um prazo fixo. Quem
// responde "já chegou?" é o próprio app (`lastDisplays`), e não uma segunda
// leitura da regra dentro do oráculo.
const trocarTelas = async (telas) => {
  await pg.evaluate((t) => { window.__telas = t; window.__avDisplaysChanged(); }, telas);
  await pg.waitForFunction(
    (n) => Array.isArray(lastDisplays) && lastDisplays.length === n,
    telas.length, { timeout: 5000 },
  );
};

const ler = () => pg.evaluate(() => ({
  telao: !!telaoNoAr(),
  noChao: telaoNoChao(),
  conectado: telaoConectado(),
  somLocal: somLocalDeveEstar(),
  mic: haOndeReproduzirMic(),
  simple: !!simpleDisplay(),
  botaoMic: !!document.getElementById('micBtn'),
  registro: descreverTelao(),
}));

// O RÓTULO DA FOLHA SÓ EXISTE COM A FOLHA ABERTA: `renderCast()` abre com
// `if (!castConnVisivel()) return`, e o `renderSimpleGate` FECHA a folha quando
// uma tela entra. Ler o `textContent` de uma folha fechada mediria o desenho
// anterior — e o oráculo aprovaria a frase de outro estado.
const rotulo = () => pg.evaluate(() => {
  abrirCast();
  const t = castMirrorLabelEl.textContent;
  fecharCast();
  return t;
});

try {
  await pg.addInitScript(PONTE);
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  // O critério do watchdog do OTA: o `init()` é assíncrono e termina DEPOIS do
  // `load`. Medir antes disso é correr contra a inicialização.
  await pg.waitForFunction(
    () => window.__NATIVE__ === true && window.AVDB && typeof window.__avBack === 'function'
      && !!document.querySelector('#playlist li'),
    null, { timeout: 30000 },
  );
  // O AVANÇADO, e a aba Ferramentas ABERTA: é lá que o botão de microfone mora,
  // e é o `refreshDiversos()` da transição que precisa desenhá-lo sem ninguém
  // trocar de aba. Sem abrir a folha, `botaoMic` seria falso nos três estados e
  // a asserção 3 aprovaria a ausência do recurso.
  await pg.evaluate(async () => {
    setAppMode('full');
    await new Promise((f) => setTimeout(f, 120));
    document.getElementById('toolsBtn').click();
    await new Promise((f) => setTimeout(f, 300));
  });

  // ── 1. SEM TELA: a linha de base ────────────────────────────────────────
  const semTv = await ler();
  checar(semTv.telao === false && semTv.somLocal === true && semTv.botaoMic === false,
    'sem tela nenhuma o som é DESTE aparelho e não há microfone a oferecer', semTv);
  checar(semTv.noChao === false && semTv.registro === 'nenhum conectado',
    'e "não há TV" NÃO é "o telão não subiu" — o Registro diz a primeira', semTv);

  // ── 2. A TELA ENTRA COM O TELÃO NO CHÃO ─────────────────────────────────
  // É o `show()` que lançou, ou a janela que o sistema derrubou sozinho: a tela
  // está listada e a `Presentation` não está no ar.
  await trocarTelas([{ id: 7, name: 'TV do templo', w: 1920, h: 1080, density: 320, telao: false }]);
  const chao = await ler();
  checar(chao.somLocal === true,
    'TELA CONECTADA E TELÃO NO CHÃO: o som CONTINUA neste aparelho — era aqui que a '
    + 'preview era calada por haver "para onde mandar o som" e ninguém tocava do outro lado',
    chao);
  checar(chao.conectado === false && chao.simple === false,
    'e nada trata isso como projeção: sem `Presentation` não há para onde projetar', chao);
  checar(chao.mic === false && chao.botaoMic === false,
    'o microfone NÃO é oferecido — quem capta é o `/display/`, que só existe dentro '
    + 'da `Presentation`', chao);
  checar(chao.noChao === true && chao.registro.includes('SEM TELÃO NO AR'),
    'e o estado é DIZÍVEL: o Registro separa "a TV está aí e o telão não subiu" de '
    + '"não há TV" — um filtro que escondesse a tela diria a segunda, que é falsa',
    chao.registro);
  const rotuloChao = await rotulo();
  checar(/n[aã]o subiu/i.test(rotuloChao),
    'a folha de conexão diz o mesmo, onde o operador vai procurar: o rótulo verde '
    + '"Conectado" sobre uma TV que não mostra nada é a frase que ele lê primeiro',
    rotuloChao);

  // ── 3. O TELÃO SOBE ─────────────────────────────────────────────────────
  // A escada de retomada do shell (`syncPresentation`) alcança este estado; aqui
  // se prova que o lado web o ABSORVE — senão a correção do Kotlin seria só um
  // jeito novo de ficar parado.
  await pg.evaluate(() => {
    window.__telas = [{ id: 7, name: 'TV do templo', w: 1920, h: 1080, density: 320, telao: true }];
    window.__avDisplaysChanged();
  });
  await pg.waitForFunction(() => !!telaoNoAr(), null, { timeout: 5000 });
  const subiu = await ler();
  checar(subiu.somLocal === false && subiu.conectado === true && subiu.simple === true,
    'O TELÃO SUBINDO cala este aparelho e volta a ser a projeção — sem passar por '
    + 'uma desconexão, que é o que a escada de retomada produz', subiu);
  checar(subiu.botaoMic === true,
    'e o botão de microfone APARECE sem trocar de aba: a transição que dispara o '
    + '`refreshDiversos` é a do TELÃO, não a da tela', subiu);
  const rotuloSubiu = await rotulo();
  checar(subiu.noChao === false && !subiu.registro.includes('SEM TELÃO')
    && /^Conectado: /.test(rotuloSubiu),
    'e as duas frases voltam a dizer "conectado", sem ressalva',
    { registro: subiu.registro, rotulo: rotuloSubiu });

  // ── 4. O TELÃO CAI COM A TELA DE PÉ ─────────────────────────────────────
  // A simetria não é elegância: é a oscilação de Miracast no meio do culto, e é
  // o instante exato em que o som precisa voltar para cá em vez de sumir.
  await pg.evaluate(() => {
    window.__telas = [{ id: 7, name: 'TV do templo', w: 1920, h: 1080, density: 320, telao: false }];
    window.__avDisplaysChanged();
  });
  await pg.waitForFunction(() => !telaoNoAr(), null, { timeout: 5000 });
  const caiu = await ler();
  checar(caiu.somLocal === true && caiu.botaoMic === false && caiu.noChao === true,
    'O TELÃO CAINDO com a tela ainda listada devolve o som a este aparelho — no '
    + 'espelhamento ele continua chegando à TV, porque o `REMOTE_SUBMIX` leva a '
    + 'mistura do aparelho inteiro', caiu);

  // ── 5. A LINHA DO TEMPO ─────────────────────────────────────────────────
  // O Registro é o artefato que responde A DISTÂNCIA, e este é o único estado do
  // caminho que não tem sintoma de tela. Sem a linha, "conectei e não veio nada"
  // chega sem nada que o separe de uma queda de rede.
  const linhas = await pg.evaluate(() => diarioC.map((l) => l.ev).join('\n'));
  checar(/TEL[ÃA]O N[ÃA]O SUBIU/.test(linhas),
    'a linha do tempo registra "TV conectada, mas o TELÃO NÃO SUBIU"', linhas.slice(-400));
  checar(/tel[ãa]o SUBIU \(a TV j[áa] estava conectada\)/.test(linhas),
    'e registra a RECUPERAÇÃO — é ela que distingue uma escada que funcionou de '
    + 'uma tela que nunca projetou', linhas.slice(-400));
} finally {
  await navegador.close();
  await new Promise((r) => servidor.close(r));
}

console.log(falhas.length ? '\n' + falhas.length + ' falha(s)' : '\ntudo certo');
process.exit(falhas.length ? 1 : 0);
