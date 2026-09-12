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
//     (`somLocalDeveEstar`) e o Modo Fácil não destrava. (A terceira
//     consequência era o microfone não ser oferecido; ela saiu na v1.8.89 com o
//     recurso, e com ela as três asserções que a mediam.)
//  2. **O ESTADO É DIZÍVEL**: o Registro e a folha de conexão separam "não há
//     TV" de "a TV está aí e o telão não subiu". Sem esta metade, a correção
//     poderia ser um filtro que simplesmente esconde a TV — e aí o operador lê
//     "nenhuma TV" com o cabo na mão.
//  3. **A RECUPERAÇÃO** (`telao` vira true): som e Modo Fácil voltam SEM o
//     operador trocar de aba. É a metade que a escada de retomada do shell
//     existe para alcançar, e sem ela a correção seria só um jeito novo de
//     ficar parado.
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
  };
  const nomes = ['apkInstalar','apkProcurar','bgProgress','captureVolumeKeys','projecaoLocal','castTarget',
    'cifraDiag','cifraHtml','deckDiscard','deckExportUrl','deckPages','espelhoCertApagar',
    'espelhoCertEstado','espelhoCertImportar','espelhoDesligar','espelhoDiag','espelhoEstado',
    'espelhoLigar','espelhoLigarEm','espelhoDerrubar','farolEstado','keepAlive',
    'listFolder','nowPlaying','openCast','openExternal','otaApply','otaCheck','otaDiag',
    'otaPending','pickDoc','pickFolder','salvarTexto','systemVolume','temaClaro','ytCancel',
    'ytCanalPlaylists','ytDiag','ytDiscard','ytFetch','ytFetchAte','ytFetchAudio','ytPlaylist',
    'ytSearch','ytStream','areaTransferencia','atualizacaoEstado',
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
  simple: !!simpleDisplay(),
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

// O `?` DO AVISO DO SOM (v1.8.87), lido pela mesma porta e pelo mesmo motivo.
// Ele acompanha a TELA LISTADA, não o telão: o que vaza é o `REMOTE_SUBMIX` do
// espelhamento, que existe desde que a TV está conectada — com o telão no chão
// o som deste aparelho já está saindo nas caixas, e é aí que o aviso mais vale.
const ajudaDoSom = () => pg.evaluate(() => {
  abrirCast();
  const b = document.getElementById('castSomAjuda');
  // O TOQUE NO `?` NÃO PODE ABRIR O SELETOR DE ESPELHAMENTO. É a razão de ele
  // ser irmão e não filho — e medir o ANINHAMENTO no DOM não serve: o parser
  // do HTML FECHA um `<button>` antes de abrir outro, então a marcação
  // aninhada nunca chega a existir e a asserção passaria sempre (MEDIDO por
  // reversão). O que se mede é o desfecho: o `openCast` da ponte não é
  // chamado, e nenhum ancestral do `?` é o botão de conectar.
  const cx = b ? b.getBoundingClientRect() : null;
  const r = {
    existe: !!b,
    visivel: !!b && !b.hidden,
    dentroDoBotao: !!(b && b.closest('#castMirrorBtn')),
    // A frase NÃO pode estar exposta na folha: é o pedido inteiro.
    textoNaFolha: (document.getElementById('castConn').textContent || '').replace(/\s+/g, ' ').trim(),
    caixa: cx ? { l: +cx.width.toFixed(2), a: +cx.height.toFixed(2) } : null,
    // DENTRO DO CORPO do botão de conectar (v1.8.89): a superfície é a
    // `.cast-acao-linha`, e o `?` é a fatia direita dela.
    dentro: (() => {
      const linha = document.querySelector('.cast-acao-linha');
      const conectar = document.getElementById('castMirrorBtn');
      if (!linha || !b || !conectar) return null;
      const rl = linha.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const rc = conectar.getBoundingClientRect();
      return {
        // o `?` cabe INTEIRO na caixa que o operador lê como "o botão"
        contido: rb.left >= rl.left - 1 && rb.right <= rl.right + 1
          && rb.top >= rl.top - 1 && rb.bottom <= rl.bottom + 1,
        naDireita: Math.abs(rb.right - rl.right) <= 1,
        // e o de conectar PARA antes dele: os dois alvos não se sobrepõem
        semSobrepor: rc.right <= rb.left + 1,
        alturaCheia: Math.abs(rb.height - rl.height) <= 1,
        // a `.cast-acao-linha` é que PINTA agora — sem fundo próprio ela seria
        // um invólucro invisível e o `?` flutuaria fora de qualquer corpo
        pinta: getComputedStyle(linha).backgroundColor,
      };
    })(),
  };
  fecharCast();
  return r;
});

try {
  await pg.addInitScript(PONTE);
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  // O critério do watchdog do OTA: o `init()` é assíncrono e termina DEPOIS do
  // `load`. Medir antes disso é correr contra a inicialização.
  await pg.waitForFunction(
    () => window.__NATIVE__ === true && window.AVDB && typeof window.__avBack === 'function'
      && (!!document.querySelector('#playlist li') || document.getElementById('plBtn').disabled),
    null, { timeout: 30000 },
  );
  // O AVANÇADO. (A folha de Ferramentas era ABERTA aqui, porque o botão de
  // microfone morava nela e era o `refreshDiversos()` da transição que precisava
  // desenhá-lo sem ninguém trocar de aba. As duas coisas saíram na v1.8.89 —
  // nada mais naquela folha depende de haver projeção —, e abri-la agora
  // custaria um passo que não mede nada.)
  await pg.evaluate(async () => {
    setAppMode('full');
    await new Promise((f) => setTimeout(f, 120));
  });

  // ── 1. SEM TELA: a linha de base ────────────────────────────────────────
  const semTv = await ler();
  checar(semTv.telao === false && semTv.somLocal === true,
    'sem tela nenhuma o som é DESTE aparelho', semTv);
  checar(semTv.noChao === false && semTv.registro === 'nenhum conectado',
    'e "não há TV" NÃO é "o telão não subiu" — o Registro diz a primeira', semTv);
  const ajudaFria = await ajudaDoSom();
  checar(ajudaFria.existe && ajudaFria.visivel === false,
    'SEM TV o `?` do som não é oferecido: não há para onde vazar, e um aviso '
    + 'sobre uma consequência que ainda não aconteceu é ruído na folha em que '
    + 'se DECIDE conectar', ajudaFria);

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
  checar(chao.noChao === true && chao.registro.includes('SEM TELÃO NO AR'),
    'e o estado é DIZÍVEL: o Registro separa "a TV está aí e o telão não subiu" de '
    + '"não há TV" — um filtro que escondesse a tela diria a segunda, que é falsa',
    chao.registro);
  // ===== O AVISO DO SOM ATRÁS DO `?` (v1.8.87) =====
  //
  // Pedido do operador: *"deixe essa mensagem em um botão/ícone de '?', ao
  // invés de deixar totalmente exposto"*. São TRÊS metades, e a segunda é a
  // que reprova a volta: a frase não pode estar no texto da folha.
  const ajudaChao = await ajudaDoSom();
  checar(ajudaChao.visivel === true,
    'COM A TV LISTADA o `?` do som aparece — e ele acompanha a TELA, não o '
    + 'telão: o `REMOTE_SUBMIX` do espelhamento já está levando o som deste '
    + 'aparelho para as caixas', ajudaChao);
  checar(!/som deste celular|som do aparelho|vai junto|nas caixas/i.test(ajudaChao.textoNaFolha),
    'e a FRASE não está exposta em lugar nenhum da folha: é o pedido inteiro — '
    + 'ela mora atrás do `?`',
    ajudaChao.textoNaFolha);
  // ===== ELE MORA DENTRO DO CORPO DO BOTÃO (v1.8.89) =====
  // Pedido do operador: *"pode colocar ele dentro do corpo do botão inteiro da
  // conexão da tv… ainda na direita, mas dentro"*. **ISTO REVOGA O QUADRADO da
  // v1.8.88**: enquanto ele era uma peça AO LADO, `align-self: center` o
  // mantinha quadrado (a regra da v1.8.57); dentro do corpo ele é a fatia
  // direita dele, e a altura é a do cartão.
  //
  // As quatro metades, e nenhuma basta: contido na caixa, encostado na borda
  // direita, sem sobrepor o alvo de conectar, e o invólucro PINTANDO — sem a
  // última ele estaria "dentro" de uma caixa que ninguém vê.
  const d = ajudaChao.dentro;
  checar(!!d && d.contido && d.naDireita,
    'o `?` fica DENTRO do corpo do botão de conexão, encostado na borda '
    + 'direita', d);
  checar(!!d && d.semSobrepor,
    'e o alvo de CONECTAR para antes dele: um `<button>` não aninha outro, '
    + 'então os dois são irmãos e o que os une é a superfície do invólucro', d);
  checar(!!d && d.alturaCheia,
    'e ele tem a ALTURA do corpo, não a de um quadrado solto — dentro do botão '
    + 'ele é a fatia direita dele', d);
  checar(!!d && !/rgba\(0, 0, 0, 0\)|transparent/.test(d.pinta),
    'e quem PINTA é o invólucro: sem fundo próprio ele seria uma caixa '
    + 'invisível, e o `?` voltaria a flutuar fora de qualquer corpo', d);
  const semSeletor = await pg.evaluate(async () => {
    abrirCast();
    let chamou = 0;
    const orig = AVNative.openCast;
    AVNative.openCast = () => { chamou++; };
    try {
      document.getElementById('castSomAjuda').click();
      await new Promise((f) => setTimeout(f, 80));
    } finally { AVNative.openCast = orig; }
    document.getElementById('appDialogOk').click();
    await new Promise((f) => setTimeout(f, 80));
    fecharCast();
    return chamou;
  });
  checar(ajudaChao.dentroDoBotao === false && semSeletor === 0,
    'e tocar o `?` NÃO abre o seletor de espelhamento do Android: ele é irmão '
    + 'do botão de conectar, e o toque dele não escapa para lá',
    { dentroDoBotao: ajudaChao.dentroDoBotao, openCast: semSeletor });

  // E O TOQUE ABRE A FRASE. Sem esta metade, um `?` que não responde nada
  // passaria — que é o botão inerte que este app recusa em toda parte.
  const dito = await pg.evaluate(async () => {
    abrirCast();
    document.getElementById('castSomAjuda').click();
    await new Promise((f) => setTimeout(f, 80));
    const cx = document.getElementById('appDialog');
    const txt = (cx.textContent || '').replace(/\s+/g, ' ').trim();
    const aberto = cx.classList.contains('open');
    document.getElementById('appDialogOk').click();
    await new Promise((f) => setTimeout(f, 80));
    fecharCast();
    return { aberto, txt };
  });
  checar(dito.aberto && /notifica[çc][õo]es/i.test(dito.txt) && /som deste aparelho/i.test(dito.txt),
    'o toque no `?` abre a frase do operador — *"exceto as notificações, todo '
    + 'o som deste aparelho é tocado na tela"*', dito);
  checar(/mensagens/i.test(dito.txt) && /outros aplicativos|outros apps/i.test(dito.txt),
    'com a segunda metade dela, que é a que diz o que FAZER: cuidado com '
    + 'áudios de mensagens e mídia de outros aplicativos', dito.txt);

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
  checar(caiu.somLocal === true && caiu.noChao === true,
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
