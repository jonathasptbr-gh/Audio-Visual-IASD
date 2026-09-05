#!/usr/bin/env node
// ============================================================================
// A ROLAGEM `AUTO` PRECISA DE UM RELÓGIO QUE ESTEJA ANDANDO
//
// ## O defeito que ele trava
//
// Relato do operador (v1.2.3): *"o modo automático não está se movendo quando
// usado apenas a letra da música"*.
//
// No modo `auto` a posição da folha é uma FUNÇÃO da posição da música. Sem
// música há o modo LIVRE (px/s constante), e a escolha entre os dois saía de
// `cifraDuracaoNoAr()` — que perguntava à BARRA DE PROGRESSO.
//
// **A barra responde outra pergunta:** `renderNowPlaying` termina em
// `seekEl.disabled = !isTimed`, com `isTimed` saindo do `kind` do item ATUAL. E
// `currentItem` sobrevive de propósito ao Parar, ao fim da faixa e a uma letra
// avulsa — então a barra ficava habilitada, com o `max` da faixa, sobre um telão
// vazio. Com duração, o `auto` ancora a folha em `fracaoDaRolagem(0, dur)` e ela
// não sai mais do lugar: o modo livre, que deveria ter assumido, nunca chega.
//
// O desfecho não é um erro — é uma folha parada. Nada no console, nada na tela.
//
// ## As DUAS metades, e por que nenhuma basta
//
//  - **sem mídia no ar** a folha tem de ANDAR (o modo livre assumiu);
//  - **com mídia no ar** ela NÃO pode andar sozinha — ali quem manda é o
//    relógio, e a abertura da janela segura o começo parado de propósito.
//
// Sem a segunda, "sempre livre" passaria — e isso apagaria o recurso inteiro,
// que é a folha andar no tempo da gravação.
//
// ## E o cenário é o do app, não um nó solto
//
// Ponte injetada, popup ABERTO, fonte ativa `cifra`, folha desenhada pelo mesmo
// caminho que o operador percorre — a lição do `cifra-teclado.test.mjs`, que
// passava com a guarda REMOVIDA enquanto montava a tela à mão.
//
// ## A RAMPA DE ARRANQUE (v1.6.2) muda O RELÓGIO, não a REGRA
//
// **Ela REVOGA a espera parada da v1.5.20**, que este arquivo travava até a
// v1.6.1. Pedido do operador: *"ao invés de ficar parado esperando para se
// mover, faça com que haja nesse início, uma velocidade extremamente lenta por
// um tempo, mas ainda perceptível, para que o usuário entenda que começou, mas
// que no fim das contas, o texto inicial onde fica a introdução da música,
// fique realmente visível por um bom tempo."*
//
// Ligar a rolagem move a folha DESDE O PRIMEIRO QUADRO, num arranque de 4 px/s
// que acelera até o `pxPorS` de sempre. A ÁLGEBRA disso é do `cifra.test.mjs`
// (`rampaInicialDaRolagem`, `ritmoDaRampa` — as duas puras); o que este arquivo
// mede é a LIGAÇÃO, que falha de outro jeito: a regra continua certa e a folha
// não anda, ou anda no compasso errado.
//
// ### E ELA MUDOU O QUE É "JÁ PODE MEDIR?"
//
// A espera parada era um INSTANTE (passados N ms, a folha começa), e por isso
// cada bloco que media movimento dormia `esperaMs` e media. A rampa é um
// TRECHO: durante ela a folha anda, e anda no compasso ERRADO de propósito.
// Medir o RITMO ali reprova um app que está certo — MEDIDO na fixture, um
// `(t1 − t0)/1,5` que atravesse a rampa sai ~67 px/s acima do ritmo, contra uma
// tolerância de 56.
//
// Daí a divisão que este lote impôs, e ela é a regra da casa aplicada duas
// vezes:
//
//  - **quem mede o COMEÇO** (a rampa em si) dorme uma fração da duração que a
//    FUNÇÃO PURA devolve — o número nunca é escrito à mão aqui;
//  - **quem mede o RITMO** espera pelo ESTADO DO APP (`cifraRampando === false`,
//    o quadro em que o compasso cheio chega), com predicado SÍNCRONO, e só
//    então tira o marco de onde a medição parte.
//
// Os blocos que NÃO medem movimento (a ausência de comando no barramento)
// ficam como estavam — a rampa não muda o que eles afirmam.
//
// ## A ESCADA MUDOU DE NOME NA v1.6.1 — E SÓ DE NOME
//
// O degrau base deixou de se chamar `Auto` e passou a se chamar `1×`; o `1`
// numérico saiu (o rótulo o duplicava) e o `3` saiu a pedido. A CONTA não foi
// tocada, e o operador disse isso por extenso: *"não mude o comportamento da
// escala, o comportamento estava correto, o nome auto que não representava uma
// comparação de velocidade"*. Daí as duas metades novas:
//
//  - **METADE 0** lê os RÓTULOS do botão de verdade, percorrendo o ciclo com
//    `click()`, e afirma que a palavra `Auto` sumiu da tela inteira — texto,
//    `title` e `aria-label`;
//  - **METADE 2-B** mede DESLOCAMENTO com um degrau NUMÉRICO e a duração no ar:
//    ele anda no FIXO vezes o fator, nunca no ritmo do relógio. É ela que
//    reprova quem "consertar" a conta transformando os degraus em
//    multiplicadores do `1×` — a leitura que o rótulo convida e que o operador
//    recusou.
//
// E A NOTA DA BARRA SOBREVIVEU À RAMPA, trocando de FATO. O anel `.dl-ring`
// saiu na v1.6.1 e no lugar dele entrou uma NOTA (*"coloque uma mensagem de
// confirmação… na própria ui e não em pop up"*), que então explicava uma
// IMOBILIDADE. Não há mais imobilidade — e ela fica porque o trabalho não sumiu,
// mudou: a pergunta era *"por que está parada?"* e passou a ser *"por que está
// tão devagar?"*. Continua respondendo a DUAS perguntas em janelas diferentes —
// antes do toque ANUNCIA o que o play vai fazer, durante a RAMPA é a razão da
// lentidão —, e a asserção que carrega o lote é a terceira: ela SOME quando o
// RITMO CHEIO chega, senão uma nota permanente passaria nas duas.
//
// O PREDICADO DELA MUDOU JUNTO, e o detalhe importa: antes ela sumia no
// primeiro quadro de MOVIMENTO, o que com a rampa a apagaria em UM quadro — a
// janela do meio, que é a única em que ela responde alguma coisa, deixaria de
// existir.
//
// ## O BOTÃO DE VELOCIDADE FICOU QUADRADO (v1.6.2)
//
// Pedido do operador: *"diminua a fonte do botão de 1x para que ele seja um
// botão exatamente do mesmo tamanho e quadrado como os seus vizinhos"*. A
// METADE 0 já percorria a escada inteira com `click()` para ler os rótulos —
// é o único lugar da suíte que faz isso —, então é ali que a caixa é medida a
// cada degrau. Ver o bloco para as três metades e a reversão nomeada.
//
//   node tools/cifra-rolagem.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, checar, falhas, esperar, porque } from './arnes.mjs';

// A PONTE DE MENTIRA. `cifraHtml` devolve uma folha LONGA de propósito: sem
// conteúdo que estoure a caixa não há `scrollHeight - clientHeight`, e as duas
// metades mediriam zero contra zero — um oráculo que aprova qualquer coisa.
const PONTE = `(() => {
  const LINHAS = [];
  for (let i = 0; i < 220; i++) {
    LINHAS.push('<b>C</b>      <b>G</b>');
    LINHAS.push('linha de marcador numero ' + i);
  }
  const FOLHA = '<pre>' + LINHAS.join('\\n') + '</pre>';
  const B = {
    shellVersion: () => 50,
    role: () => 'controle',
    appVersion: () => '1.98-teste',
    takeShare: () => '',
    busPost: () => {},
    otaConfirm: () => {},
    cifraHtml: (id, url) => {
      setTimeout(() => {
        try { window.__avResolve(id, { status: 200, html: FOLHA }); } catch (_) {}
      }, 0);
    },
  };
  const nomes = ['apkInstalar','apkProcurar','bgProgress','captureVolumeKeys','projecaoLocal','castTarget',
    'cifraDiag','deckDiscard','deckExportUrl','deckPages','displays','espelhoCertApagar',
    'espelhoCertEstado','espelhoCertImportar','espelhoDesligar','espelhoDiag','espelhoEstado',
    'espelhoLigar','keepAlive','listFolder','nowPlaying','openCast','openExternal','otaApply',
    'otaCheck','otaDiag','otaPending','pickDoc','pickFolder','requestMic','systemVolume',
    'temaClaro','ytCancel','ytCanalPlaylists','ytDiag','ytDiscard','ytFetch','ytFetchAte',
    'ytFetchAudio','ytPlaylist','ytSearch','ytStream','areaTransferencia','atualizacaoEstado'];
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

// AS DUAS ESPERAS DESTE ARQUIVO, e elas respondem a perguntas diferentes.
//
// `dormir` é um `setTimeout` puro, e ele serve ao único caso em que a DURAÇÃO
// EM SI é o fato: medir a folha DENTRO da rampa exige parar num ponto do
// caminho, e esse ponto é uma fração da duração que a função pura devolve
// (`AVCifra.rampaInicialDaRolagem`) — nunca um número escrito à mão aqui.
//
// `esperar` (do arnês) é para o resto: o FIM da rampa é um ESTADO do app
// (`cifraRampando`), e é por ele que se espera antes de medir qualquer RITMO.
// Dormir a duração inteira e medir seria a mesma aposta na máquina que a
// campanha da v5.316 teve de desfazer cinco vezes — e aqui ela reprovaria um
// app certo, porque a distância percorrida DURANTE a rampa não é o compasso
// pedido.
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

await new Promise((r) => servidor.listen(0, r));
const navegador = await abrirNavegador();
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);
const pg = await ctx.newPage();
const base = 'http://localhost:' + servidor.address().port;

try {
  await pg.addInitScript(PONTE);
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  // O critério do watchdog do OTA: o `init()` é assíncrono e termina DEPOIS do
  // `load`. Plantar `currentItem` antes disso é correr contra a inicialização,
  // que o zera com toda a razão — e o cenário evapora sem erro nenhum.
  await pg.waitForFunction(
    () => window.__NATIVE__ === true && window.AVDB && typeof window.__avBack === 'function'
      && !!document.querySelector('#playlist li'),
    null, { timeout: 30000 },
  );

  // SEM `window.`: `currentItem` e `lvSource` são `let` no topo de um script
  // clássico — vínculo léxico, não propriedade de `window`.
  const pronto = await pg.evaluate(() => {
    currentItem = {
      id: 'marcador', name: 'Musica De Marcador', kind: 'audio', seconds: 200,
      lyrics: [{ text: 'linha de marcador' }],
    };
    if (!cifraCabe(currentItem)) return 'cifraCabe recusou o item';
    lvSource = 'cifra';
    openLyricsPopup();
    return lvActiveSource();
  });
  checar(pronto === 'cifra', 'a aba de CIFRA é a fonte ativa (o cenário do app)', pronto);
  await pg.waitForSelector('.lv-cifra-acordes', { timeout: 15000 });

  // A NOTA DA BARRA, medida no RENDERIZADO (v1.6.1). Ela substituiu o anel
  // `.dl-ring` que ficava sobre o ícone de pause, e a régua não pode ser a
  // PRESENÇA do nó: uma regra de CSS que não pinte passa num teste de presença
  // e continua invisível na tela. Instalada como função da página porque cinco
  // blocos a leem, cada um dentro do `evaluate` que também mexe no estado.
  //
  // Ela carrega junto a AUSÊNCIA do anel: as duas afirmações são do mesmo lote e
  // separá-las deixaria passar a versão que desenha os DOIS.
  // O CABEÇALHO DA OBRA, medido no RENDERIZADO (v1.6.3). Ele substituiu a nota
  // da barra — e não é um rótulo a mais: ele é a MARGEM NATURAL que impede a
  // rolagem de cortar a intro logo no começo. A régua não pode ser a PRESENÇA do
  // nó: uma regra de CSS que não pinte passa num teste de presença e continua
  // invisível na tela.
  await pg.evaluate(() => {
    window.__cab = () => {
      const c = lyricsViewBodyEl.querySelector('.lv-cifra-cab');
      if (!c) return { existe: false };
      const r = c.getBoundingClientRect();
      const caixa = lyricsViewBodyEl.getBoundingClientRect();
      const t = c.querySelector('.lv-cifra-cab-titulo');
      const k = c.querySelector('.lv-cifra-cab-tom');
      return {
        existe: true,
        titulo: t ? t.textContent.trim() : '',
        tom: k ? k.textContent.trim() : '',
        // "à vista" é geometria, não `hidden`: o bloco ROLA JUNTO, e some por
        // sair da caixa — que é justamente o que se quer provar.
        aVista: r.bottom > caixa.top && r.top < caixa.bottom,
        // A MARGEM é o que separa o topo do conteúdo da PRIMEIRA LINHA DE
        // ACORDE, e ela NÃO cabe no retângulo do bloco: `margin-bottom` fica
        // fora do `getBoundingClientRect`. Medir o bloco mediria o rótulo;
        // quem responde "a intro deixou de estar colada no topo?" é o
        // `offsetTop` da folha.
        margem: (() => {
          const f = lyricsViewBodyEl.querySelector('.lv-cifra-folha');
          return f ? f.offsetTop - c.offsetTop : -1;
        })(),
        // E a pergunta do operador, medida: a primeira linha de acorde ainda
        // está INTEIRA dentro da caixa?
        introInteira: (() => {
          const l = lyricsViewBodyEl.querySelector('.lv-cifra-linha');
          if (!l) return false;
          return l.getBoundingClientRect().top >= caixa.top - 0.5;
        })(),
        // O bloco é IRMÃO da folha e vem ANTES dela.
        antesDaFolha: !!(c.nextElementSibling
          && c.nextElementSibling.classList.contains('lv-cifra-folha')),
        // E não há mais nota nem anel em lugar nenhum da folha.
        nota: !!lyricsPopupEl.querySelector('.lv-cifra-nota'),
        anel: !!lyricsPopupEl.querySelector('.dl-ring'),
      };
    };
  });

  const rolavel = await pg.evaluate(
    () => lyricsViewBodyEl.scrollHeight - lyricsViewBodyEl.clientHeight,
  );
  checar(rolavel > 200,
    'a folha é MAIOR que a caixa — sem isso as duas metades mediriam zero contra '
    + 'zero, e o oráculo aprovaria qualquer coisa', rolavel);

  // ======================================================================
  // METADE 0 — A ESCADA SE CHAMA 0,5× · 0,75× · 1× · 1,5× · 2× (v1.6.1)
  // ======================================================================
  //
  // Pedido do operador: *"ao invés de usar o botão com nome 'auto', use apenas
  // 0,5x, 1x, 1,5x... no caso o 'auto' seria o 1x, pois ele usa o tempo base
  // como padrão de comparação"* — mais a correção que ele mandou por extenso:
  // *"não mude o comportamento da escala, o comportamento estava correto, o
  // nome auto que não representava uma comparação de velocidade"*.
  //
  // O rótulo sai do BOTÃO DE VERDADE, e a escada é lida NA GAVETA que o toque
  // abre: ler `CIFRA_VELOCIDADES` provaria que a constante concorda consigo
  // mesma, e o que o operador lê é o `textContent` de quem está na tela.
  //
  // ===== A GAVETA SUBSTITUIU O CARROSSEL (v1.7.3) =====
  //
  // Pedido do operador: *"faça com que o botão de velocidade abra uma gaveta,
  // substituindo seus botões vizinhos, pela lista de botões com as variações de
  // velocidade, dessa forma, permitindo escolher as velocidades sem passar por
  // cada uma delas em carrocel"*.
  //
  // O que este bloco media era o CICLO fechando em cinco toques; o que ele mede
  // agora é a LISTA — e as promessas que sobrevivem à troca de mecanismo são as
  // mesmas, porque nenhuma delas era sobre o ciclo:
  //  - o SENTINELA se chama `1×`;
  //  - a escada é a mesma, na mesma ordem monótona, com CINCO degraus à vista de
  //    uma vez (um degrau inalcançável não aparece em nenhum outro lugar);
  //  - NÃO HÁ RÓTULO REPETIDO — é ela que reprova a volta do `1` numérico, que
  //    daria DOIS botões escritos "1×" na mesma lista;
  //  - a palavra `Auto` sumiu da TELA, e não só do botão: um `title` ou um
  //    `aria-label` sobrevivente a devolve sem nada acusar.
  //
  // E DUAS QUE SÓ EXISTEM COM A GAVETA, e são o pedido:
  //  - abrir SUBSTITUI os vizinhos (o ⛶ é a exceção nomeada — *a fila da cifra
  //    sempre tem a saída*);
  //  - escolher um degrau LEVA A ELE DIRETO, sem passar pelos do meio. A prova é
  //    o degrau que fica DEPOIS de UM toque: no carrossel, ir do `1×` ao `0,5×`
  //    custava dois, e os do meio ACONTECIAM — a folha mudava de ritmo com a
  //    música no ar.
  //
  // REVERSÃO: devolver `'auto'` ao `cifraVelRotulo` reprova a primeira e a
  // quarta; devolver o `1` numérico à escada reprova a segunda e a terceira;
  // devolver o ciclo ao botão reprova as duas últimas.
  const escada = await pg.evaluate(() => {
    cifraAdotarVelocidade('auto');
    cifraPintarRolar();
    const btn = cifraVelBtnEl;
    const base = btn.textContent.trim();
    const ctlEl = lyricsPopupEl.querySelector('.lv-cifra-ctl');
    const aVista = (el) => !!el && el.getClientRects().length > 0;
    // ---- A GAVETA ABRE, e o que ela mostra é a escada inteira ----
    btn.click();
    const ops = [...ctlEl.querySelectorAll('.lv-cifra-vel-op')];
    const ciclo = ops.map((b) => b.textContent.trim());
    const abriu = {
      // O que SOME: os quatro botões da fila, o de velocidade entre eles.
      rolarSumiu: !aVista(cifraRolarBtnEl),
      velSumiu: !aVista(btn),
      // A TRANSPOSIÇÃO pela ÁRVORE, e não por classe: os dois `±½` não têm nome
      // próprio — o que os identifica é serem filhos DIRETOS da fila. É a mesma
      // pergunta que a regra de CSS faz (`.escolhendo > .lv-fonte-btn`), e é ela
      // que garante que a gaveta (filha do invólucro) não se esconda junto.
      transporSumiu: [...ctlEl.children]
        .filter((e) => e.classList.contains('lv-fonte-btn'))
        .every((e) => !aVista(e)),
      // O que FICA: a saída da tela cheia.
      saidaFicou: aVista(lyricsPopupEl.querySelector('.lv-cheia-btn')),
      // Todos os degraus À VISTA de uma vez — a promessa inteira do pedido.
      opsAVista: ops.filter(aVista).length,
      // E o degrau em cena vem MARCADO: sem isso a lista não diz onde se está.
      marcado: (ops.find((b) => b.classList.contains('escolhido')) || {}).textContent,
    };
    // ---- ESCOLHER LEVA DIRETO ----
    // Do `1×` (índice 2) ao `0,5×` (índice 0): um toque, e os dois degraus do
    // meio NÃO acontecem. `cifraVelEscolher` é `async` e pinta ANTES do `await`
    // do banco — o rótulo já está na tela quando o `click()` volta.
    ops[0].click();
    const direto = {
      rotulo: btn.textContent.trim(),
      fechou: !ctlEl.classList.contains('escolhendo'),
      velVoltou: aVista(btn),
    };
    // E o `1×` de volta, para o resto do arquivo continuar de onde partiu.
    btn.click();
    [...ctlEl.querySelectorAll('.lv-cifra-vel-op')][2].click();
    const textos = [lyricsPopupEl.innerText];
    lyricsPopupEl.querySelectorAll('[title], [aria-label]').forEach((el) => {
      textos.push(el.getAttribute('title') || '', el.getAttribute('aria-label') || '');
    });
    // ===== A CAIXA, MEDIDA A CADA DEGRAU (v1.6.2) =====
    //
    // Uma SEGUNDA volta pelo botão, agora medindo. Ela é separada da primeira
    // porque o que se afirma é outro: lá o RÓTULO, aqui a GEOMETRIA — e a
    // geometria só se prova percorrendo o ciclo, porque era o ciclo que a movia.
    //
    // `scrollWidth` × `clientWidth` e não a largura do texto por `Range`: com
    // `width` fixo, um rótulo que não coubesse NÃO mudaria a caixa (ele
    // transbordaria por fora, calado), e é exatamente esse desfecho que a
    // medição precisa alcançar.
    const hit = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--hit'));
    const irmao = lyricsPopupEl.querySelector('.lv-fonte-mais').getBoundingClientRect();
    const ctl = () => +lyricsPopupEl.querySelector('.lv-cifra-ctl')
      .getBoundingClientRect().width.toFixed(2);
    const ctlAntes = ctl();
    // A CAIXA, degrau a degrau. A escada é percorrida pela GAVETA agora (v1.7.3)
    // — abrir, escolher, medir o botão fechado —, e é a mesma pergunta de antes:
    // a largura do botão não pode depender do rótulo em cena.
    const caixas = [];
    for (let i = 0; i < CIFRA_VELOCIDADES.length; i++) {
      btn.click();
      [...ctlEl.querySelectorAll('.lv-cifra-vel-op')][i].click();
      const b = btn.getBoundingClientRect();
      caixas.push({
        rotulo: btn.textContent.trim(),
        w: +b.width.toFixed(2), h: +b.height.toFixed(2),
        sw: btn.scrollWidth, cw: btn.clientWidth,
      });
    }
    // E OS BOTÕES DA GAVETA MEDEM O MESMO: eles ocupam a fila no lugar dos
    // quatro, e uma fila que muda de largura ao abrir é a caixa dançando sob o
    // dedo — o defeito que o `min-width` da v1.6.2 existia para impedir, um
    // nível acima.
    btn.click();
    const caixasOps = [...ctlEl.querySelectorAll('.lv-cifra-vel-op')].map((b) => {
      const r = b.getBoundingClientRect();
      return {
        rotulo: b.textContent.trim(),
        w: +r.width.toFixed(2), h: +r.height.toFixed(2),
        sw: b.scrollWidth, cw: b.clientWidth,
      };
    });
    const ctlAberta = ctl();
    [...ctlEl.querySelectorAll('.lv-cifra-vel-op')][2].click();
    return {
      base,
      ciclo,
      abriu,
      direto,
      caixasOps,
      ctlAberta,
      distintos: new Set(ciclo).size,
      hit,
      irmao: { w: +irmao.width.toFixed(2), h: +irmao.height.toFixed(2) },
      caixas,
      ctlAntes,
      ctlDepois: ctl(),
      // `\b...\b` e não `/auto/` solto: "automática" é outra palavra e continua
      // legítima em qualquer frase da folha.
      comAuto: textos.filter((t) => /\bauto\b/i.test(t)),
    };
  });
  checar(escada.base === '1×',
    'o degrau BASE se chama `1×` — o sentinela `auto` continua sendo o valor '
    + 'interno, e o que mudou é o RÓTULO', escada.base);
  checar(escada.ciclo.join(' · ') === '0,5× · 0,75× · 1× · 1,5× · 2×',
    'e a GAVETA mostra 0,5× · 0,75× · 1× · 1,5× · 2×, nessa ordem e de uma vez '
    + '(o 3× saiu a pedido, e o 1 numérico saiu porque o rótulo o duplicava)',
    escada.ciclo);
  // CONTRA O COMPRIMENTO DA LISTA, nunca contra o número 5: com o `1` numérico
  // de volta ela tem SEIS rótulos e cinco distintos, e um `=== 5` escrito à mão
  // aprovaria exatamente a escada que esta asserção existe para recusar.
  checar(escada.distintos === escada.ciclo.length,
    'e nenhum rótulo se repete: dois botões escritos "1×" seriam a escolha do '
    + 'operador dizendo duas coisas', escada);
  // ===== O PEDIDO DA v1.7.3, nas duas metades =====
  checar(escada.abriu.rolarSumiu && escada.abriu.velSumiu && escada.abriu.transporSumiu
    && escada.abriu.saidaFicou
    && escada.abriu.opsAVista === escada.ciclo.length,
    'ABRIR a gaveta SUBSTITUI os vizinhos pela escada inteira — e o ⛶ FICA, '
    + 'porque *a fila da cifra sempre tem a saída*: escondê-lo deixaria uma '
    + 'paisagem deitada sem nenhuma saída à vista', escada.abriu);
  checar(escada.abriu.marcado === '1×',
    'e o degrau em cena vem MARCADO na lista — sem isso ela oferece cinco '
    + 'opções e não diz em qual delas se está', escada.abriu);
  checar(escada.direto.rotulo === '0,5×' && escada.direto.fechou && escada.direto.velVoltou,
    'e ESCOLHER leva DIRETO ao degrau, fechando a gaveta: no carrossel, ir do '
    + '1× ao 0,5× custava dois toques e os degraus do meio ACONTECIAM — a folha '
    + 'mudava de ritmo com a música no ar', escada.direto);
  checar(escada.comAuto.length === 0,
    'e a palavra `Auto` não está mais em lugar nenhum da folha — nem no texto, '
    + 'nem num `title`, nem num `aria-label`', escada.comAuto);

  // ======================================================================
  // METADE 0-B — O BOTÃO DE VELOCIDADE É QUADRADO, EM TODO DEGRAU (v1.6.2)
  // ======================================================================
  //
  // Pedido do operador: *"diminua a fonte do botão de 1x para que ele seja um
  // botão exatamente do mesmo tamanho e quadrado como os seus vizinhos"*.
  //
  // Ele era o único da família com `width: auto` mais um `min-width` — um PISO,
  // não uma largura: a caixa crescia quando o rótulo passava dele, e era por
  // isso que o ciclo podia empurrar os vizinhos. Hoje a largura é `--hit` e o
  // que faz o rótulo caber é o CORPO (`--fs-2xs`).
  //
  // QUATRO asserções, e nenhuma basta sozinha:
  //
  //  1. **a caixa é QUADRADA e do tamanho de `--hit`** — o pedido ao pé da
  //     letra, e a única régua que não depende da máquina: é o que o DESENHO
  //     reserva;
  //  2. **ela é a mesma do IRMÃO** — sem isto, encolher os cinco botões juntos
  //     passaria na primeira e o operador continuaria vendo uma fila desigual;
  //  3. **a FILA não muda de largura** ao percorrer a escada inteira (a
  //     `.lv-cifra-ctl` medida ANTES e DEPOIS da volta). Era o defeito que o
  //     `min-width` existia para impedir — *"um botão que se desloca sob o dedo
  //     é um botão que erra o alvo na segunda batida"* —, e este lote troca o
  //     mecanismo que o impede, não a promessa;
  //  4. **o rótulo CABE dentro dela** (`scrollWidth <= clientWidth`), em todo
  //     degrau. É a única que lê a fonte instalada, e por isso é a que precisa
  //     de margem: MEDIDO neste runner, `0,75×` (o pior caso, cinco caracteres)
  //     pede 24,28px numa caixa de 34 — e 31,72px na família MAIS LARGA que a
  //     base pode chegar a pedir (`system-ui` → DejaVu Sans), ainda com 2,28px
  //     de folga. Uma volta ao corpo dos vizinhos (`--fs-md`) pede 43,34px e
  //     reprova aqui.
  //
  // REVERSÃO NOMEADA, e ela mostra por que as quatro são separadas: devolver
  // `width: auto; min-width: calc(var(--hit) + 1.2rem)` ao `.lv-cifra-vel`
  // reprova a PRIMEIRA em todos os degraus (a caixa vai a 53,19px) e SÓ ela —
  // o irmão não se mexeu, a fila não anda (naquele piso cabem os cinco rótulos
  // nesta fonte) e o rótulo sobra numa caixa maior. As outras três existem para
  // os outros três consertos errados: encolher os cinco juntos, deixar a caixa
  // voltar a crescer com o rótulo, e encolhê-la até o rótulo transbordar.
  const fora = escada.caixas.filter(
    (c) => Math.abs(c.w - escada.hit) > 0.5 || Math.abs(c.h - escada.hit) > 0.5);
  checar(escada.hit > 0 && fora.length === 0,
    'o botão de velocidade é QUADRADO e mede `--hit` em TODO degrau da escada — '
    + 'a largura deixou de depender do rótulo em cena', { hit: escada.hit, fora });
  checar(Math.abs(escada.irmao.w - escada.hit) < 0.5
    && Math.abs(escada.irmao.h - escada.hit) < 0.5,
    'e é a MESMA caixa dos vizinhos: sem isto, encolher os cinco juntos passaria '
    + 'na asserção de cima e a fila continuaria desigual',
    { irmao: escada.irmao, hit: escada.hit });
  checar(escada.ctlAntes > 0 && Math.abs(escada.ctlAntes - escada.ctlDepois) < 0.5,
    'e a fila de controles não muda de largura ao percorrer a escada inteira: um '
    + 'botão que se desloca sob o dedo erra o alvo na segunda batida',
    { antes: escada.ctlAntes, depois: escada.ctlDepois });
  // ===== E A GAVETA ABERTA CABE NA MESMA FILA (v1.7.3) =====
  //
  // Ela troca quatro botões por cinco, e o ⛶ fica: a fila é UM botão mais larga
  // com a gaveta aberta. O que não pode acontecer é os botões dela mudarem de
  // CAIXA — é a mesma promessa da asserção de cima, um nível acima: a fila é a
  // mesma fila, e o dedo mira nela.
  const opsFora = escada.caixasOps.filter(
    (c) => Math.abs(c.w - escada.hit) > 0.5 || Math.abs(c.h - escada.hit) > 0.5);
  checar(escada.caixasOps.length === escada.ciclo.length && opsFora.length === 0,
    'e os botões da GAVETA medem a mesma caixa dos que eles substituem — uma '
    + 'fila que troca de altura ao abrir é a caixa dançando sob o dedo',
    { hit: escada.hit, fora: opsFora });
  const opsEstourando = escada.caixasOps.filter((c) => c.sw > c.cw);
  checar(opsEstourando.length === 0,
    'e o rótulo cabe em cada um deles: com largura fixa, um rótulo grande demais '
    + 'transborda por fora, calado', opsEstourando);
  const estourando = escada.caixas.filter((c) => c.sw > c.cw);
  checar(estourando.length === 0,
    'e o rótulo CABE na caixa em todo degrau — com largura fixa, um rótulo '
    + 'grande demais não a empurraria: ele transbordaria por fora, calado',
    estourando.length ? estourando : escada.caixas.map((c) => c.rotulo + ' ' + c.sw + '/' + c.cw).join(' · '));

  // A velocidade tem de ser `auto`: é dela que este caso fala. O degrau é
  // persistido, então não se pode supor o que veio do banco. (O ciclo acima
  // deu a volta inteira e já voltou para ele; esta linha é a que NÃO depende
  // disso.)
  await pg.evaluate(() => cifraAdotarVelocidade('auto'));

  // ======================================================================
  // METADE 1 — SEM MÍDIA NO AR: o modo LIVRE assume, e a folha ANDA
  // ======================================================================
  //
  // O ESTADO É O DO RELATO, montado à mão: a barra HABILITADA com a duração da
  // faixa (é o que `renderNowPlaying` deixa depois do Parar, do fim natural e
  // de uma letra avulsa) e NADA no telão. É exatamente aqui que o `auto` ancorava
  // a folha e ela parava para sempre.
  const semArInicio = await pg.evaluate(() => {
    midiaNoAr = false;
    seekEl.disabled = false;
    seekEl.max = '200';
    const dur = cifraDuracaoNoAr();
    const el = lyricsViewBodyEl;
    el.scrollTop = 0;
    // O MESMO cálculo que `cifraRolarQuadro` vai fazer no primeiro quadro —
    // é dele que sai o `pxPorS` que a espera pura recebe.
    const rolavel = el.scrollHeight - el.clientHeight;
    const ehAuto = CIFRA_VELOCIDADES[cifraVelIdx] === 'auto';
    const ritmo = ehAuto ? cifraRitmoDoRelogio(rolavel) : 0;
    const pxPorS = ritmo > 0
      ? ritmo
      : CIFRA_PX_POR_S * (ehAuto ? 1 : CIFRA_VELOCIDADES[cifraVelIdx]);
    const rampaMs = AVCifra.rampaInicialDaRolagem(el.clientHeight, pxPorS);
    // A NOTA ANTES DO TOQUE — a promessa que o anel nunca teve: o pedido está
    // escrito no FUTURO (*"ao dar play, ele VAI ficar…"*), e uma frase que só
    // nasce depois do play descreve como porvir uma coisa já em curso.
    const antesDoToque = window.__cab();
    cifraRolarAlternar();
    // O RELÓGIO DE PAREDE parte do TOQUE, e é contra ele que a medição de baixo
    // compara: o quanto a folha JÁ andou só quer dizer alguma coisa ao lado do
    // quanto ela ANDARIA no compasso cheio no mesmo tempo. Ele fica NA PÁGINA
    // porque quem o lê é o `evaluate` seguinte — atravessar a ponte com o
    // instante e subtraí-lo do lado do Node mediria o `evaluate`, não a folha.
    window.__desde = performance.now();
    return {
      dur, rampaMs, pxPorS, caixa: el.clientHeight,
      t0: el.scrollTop, antesDoToque,
    };
  });
  checar(semArInicio.dur === 0,
    'sem mídia no ar não há duração a seguir — a barra habilitada não é "no ar"',
    semArInicio);

  // ======================================================================
  // METADE 1-A — A RAMPA: LOGO NO COMEÇO A FOLHA JÁ ANDOU, E ANDOU POUCO
  // ======================================================================
  //
  // **É AQUI QUE O PEDIDO DA v1.6.2 VIVE**, e ele é uma CONJUNÇÃO — as duas
  // metades se contradizem, e é por isso que só as duas juntas dizem alguma
  // coisa. Verbatim: *"ao invés de ficar parado esperando para se mover, faça
  // com que haja nesse início, uma velocidade extremamente lenta por um tempo,
  // mas ainda perceptível, para que o usuário entenda que começou, mas que no
  // fim das contas, o texto inicial onde fica a introdução da música, fique
  // realmente visível por um bom tempo."*
  //
  // O ponto de medição é uma FRAÇÃO da duração que a função pura devolveu —
  // nunca um número escrito aqui. Metade da rampa é o único lugar em que as
  // duas metades do pedido são exigidas ao mesmo tempo: no primeiro quadro
  // "andou pouco" é trivial, e no fim dela "andou" também é.
  //
  // A RÉGUA DO "POUCO" É O RITMO CHEIO NO MESMO TEMPO DE PAREDE, e não um número
  // de pixels: o `pxPorS` sai da folha da fixture, que não tem tamanho fixo.
  // Pela álgebra da rampa cúbica, na metade dela a folha percorreu 20,7% do que
  // o compasso cheio teria percorrido — a margem até os 50% da asserção é o que
  // sobra para um runner com quadros perdidos, e ela é SEGURA por construção:
  // sob carga, `cifraRampaMs` acumula `dt` com o teto de `CIFRA_DT_MAX`, então a
  // rampa fica mais LENTA em tempo de parede, nunca mais rápida. CONFERIDO: o
  // arquivo inteiro passou quatro rodadas com a máquina a 4× de carga.
  //
  // E O PISO DO "ANDOU" É ABSOLUTO pelo mesmo motivo invertido: o arranque são
  // 4 px/s fixos, independentes do degrau, então mesmo um décimo dos quadros do
  // intervalo já move muito mais que os 2px pedidos aqui. Pela álgebra da rampa
  // cúbica, com a caixa de 533px e o `1×` livre (22 px/s, T = 13,04 s): 29,7px
  // na metade dela, e 5,2px se a página receber só 10% do tempo.
  //
  // REVERSÕES NOMEADAS, uma por metade: devolver a espera parada da v1.5.20
  // (`return` enquanto `t < fim`) reprova a primeira; apagar a rampa (o quadro
  // usando `pxPorS` direto, como antes da v1.5.20) reprova a segunda e a
  // terceira.
  await dormir(Math.max(200, semArInicio.rampaMs / 2));
  const semArDurante = await pg.evaluate(() => ({
    scrollTop: lyricsViewBodyEl.scrollTop,
    decorridoMs: performance.now() - window.__desde,
    rampando: cifraRampando,
    cab: window.__cab(),
  }));
  const andouNaRampa = semArDurante.scrollTop - semArInicio.t0;
  const cheioTeria = (semArInicio.pxPorS * semArDurante.decorridoMs) / 1000;
  checar(andouNaRampa > 2,
    'LOGO NO COMEÇO a folha JÁ ANDOU — o movimento é o que diz "começou", e é '
    + 'ele que o operador não teve com a espera parada',
    { andou: +andouNaRampa.toFixed(2), decorridoMs: Math.round(semArDurante.decorridoMs) });
  checar(andouNaRampa < cheioTeria * 0.5,
    'e ANDOU POUCO: menos da metade do que o compasso cheio teria andado no '
    + 'mesmo tempo de parede — é a rampa, não o ritmo pedido',
    { andou: +andouNaRampa.toFixed(2), cheioTeria: +cheioTeria.toFixed(2) });
  checar(andouNaRampa < semArInicio.caixa / 4,
    'e por isso o TEXTO INICIAL continua na tela: a folha não gastou nem um '
    + 'quarto da caixa enquanto a rampa corria',
    { andou: +andouNaRampa.toFixed(2), caixa: semArInicio.caixa });
  checar(semArDurante.rampando === true,
    'e o app SABE que está na rampa — é este estado que a nota lê, e é por ele '
    + 'que as medições de RITMO abaixo esperam', semArDurante.rampando);
  checar(semArInicio.antesDoToque.existe
    && semArInicio.antesDoToque.antesDaFolha
    && semArInicio.antesDoToque.margem > 40,
    'o CABEÇALHO DA OBRA está na caixa ANTES do toque, e ANTES da folha (v1.6.3) '
    + '— é ele a "margem natural" que o operador pediu, não um rótulo a mais',
    semArInicio.antesDoToque);
  checar(semArDurante.cab.introInteira,
    'e no meio da rampa a PRIMEIRA LINHA DE ACORDE ainda está inteira na caixa: '
    + 'é isso que a margem compra — *"pelo fato da intro estar colada no topo, '
    + 'ele acaba sempre cortando ela no início"*',
    { scrollTop: semArDurante.scrollTop, margem: semArDurante.cab.margem });
  checar(!semArDurante.cab.nota && !semArDurante.cab.anel,
    'e NÃO há nota nem anel em lugar nenhum da folha: os dois saíram, e a '
    + 'resposta ao toque é a própria folha andando', semArDurante);
  // A FRASE SÓ PROMETE A MÚSICA ONDE ISSO É VERDADE (v1.6.1).
  //
  // O operador pediu a frase inteira — *"depois irá seguir a rolagem no ritmo da
  // música"* —, e ela é verdadeira só no degrau BASE com duração no ar: fora daí
  // o compasso é o ritmo fixo vezes o fator, e prometer a música ali é a nota
  // mentindo na tela. Este bloco é o lado SEM duração; o par dele, com duração,
  // vem na metade seguinte. As duas juntas são a regra — sozinha, a primeira
  // passaria com a frase curta escrita à mão para sempre, e a segunda passaria
  // com a frase longa dita em toda situação.
  //
  // O TÍTULO É O DA OBRA, e ele saiu do cabeçalho do popup para cá. O TOM desta
  // fixture não existe (a página de mentira não traz tom), e o bloco responde a
  // isso NÃO DESENHANDO a linha — um "Tom: " vazio seria uma linha em branco
  // prometendo um dado que a página não trouxe. O par com tom está no
  // `cifra-tela-cheia.test.mjs`, onde a fixture tem um.
  // REVERSÃO: desenhar a linha do tom sempre faz `tom` deixar de ser vazio aqui.
  checar(semArDurante.cab.titulo === 'Musica De Marcador' && semArDurante.cab.tom === '',
    'e o cabeçalho traz o TÍTULO DA OBRA — e omite a linha do tom quando a '
    + 'página não trouxe um, em vez de desenhar um rótulo vazio',
    { titulo: semArDurante.cab.titulo, tom: semArDurante.cab.tom });

  // O FIM DA RAMPA É UM ESTADO DO APP, e é por ele que se espera — nunca pelo
  // resto do relógio. Predicado SÍNCRONO: `waitForFunction` não aguarda a
  // Promise de um `async`, e um predicado assim passaria no primeiro quadro
  // aprovando exatamente o que veio verificar.
  const chegouAoCheio = await esperar(
    pg, () => cifraRampando === false, null, 40000);
  checar(chegouAoCheio === true,
    'e a rampa TERMINA sozinha: passada ela, o compasso é o `pxPorS` de sempre '
    + '— ela é o COMEÇO, não um modo novo', porque(chegouAoCheio));
  await dormir(1500);
  const semAr = await pg.evaluate(() => {
    const t1 = lyricsViewBodyEl.scrollTop;
    const titulo = cifraVelBtnEl ? cifraVelBtnEl.title : '';
    const cab = window.__cab();
    cifraRolarParar();
    return { t1, titulo, cab };
  });
  checar(semAr.t1 > semArInicio.t0 + 5,
    'e a folha ANDA depois da rampa: o modo LIVRE assumiu, que é o que o '
    + '`auto` sem relógio promete', { t0: semArInicio.t0, t1: semAr.t1 });
  checar(/ritmo fixo/.test(semAr.titulo),
    'e o botão DIZ isso — o rótulo mostra a escolha, a frase mostra o que está '
    + 'acontecendo', semAr.titulo);
  // ← A QUE CARREGA A MARGEM: o cabeçalho ROLA JUNTO, então passado o arranque
  // ele sai de cena sozinho. Fixo, ele cobraria altura da folha para sempre e
  // não teria empurrado a intro coisa nenhuma.
  checar(!semAr.cab.aVista,
    'e o cabeçalho SAI de cena quando a folha andou — ele rola junto, que é o '
    + 'que faz dele uma margem e não um rótulo permanente', semAr);

  // ======================================================================
  // METADE 2 — COM MÍDIA NO AR: o `auto` tira da música o RITMO, não a POSIÇÃO
  // ======================================================================
  //
  // Sem ela, "cair sempre no livre" passaria na metade de cima e apagaria o
  // recurso: a folha andaria no px/s de leitura por cima de uma música de
  // duração conhecida, que é a coisa que o `auto` existe para não fazer.
  //
  // **A RÉGUA MUDOU NA v1.5.6** e a mudança é a doutrina inteira. Até a v1.5.5 a
  // folha era uma FUNÇÃO da posição da música, e este caso media a ABERTURA
  // daquela função: com a música no segundo zero, a folha NÃO andava. Relato do
  // operador: *"se a música não está tocando, ele não anda. Ou se eu quiser tocar
  // de um ponto específico em diante, ele fica voltando para onde a mídia
  // estaria"*. Hoje o `auto` é um RITMO integrado do ponto em que a folha está —
  // a música PARADA no zero e a folha ANDANDO é o recurso funcionando.
  //
  // A prova é o ritmo estar CERTO, e é ela que separa "andou" de "andou no
  // compasso de outra coisa": com 200 s de música o rolável é percorrido em
  // `t1 - t0` da janela (176 s aqui), o que dá um px/s cinco vezes menor que os
  // 22 do modo livre. Um caso que só perguntasse "andou?" aprovaria o livre
  // assumindo — que é exatamente a metade de cima deste arquivo.
  const comArInicio = await pg.evaluate(() => {
    midiaNoAr = true;
    seekEl.disabled = false;
    seekEl.max = '200';
    const dur = cifraDuracaoNoAr();
    const el = lyricsViewBodyEl;
    const rolavel = el.scrollHeight - el.clientHeight;
    // A MÚSICA FICA NO SEGUNDO ZERO E PARADA: é o cenário do relato.
    el.scrollTop = 0;
    const ritmo = cifraRitmoDoRelogio(rolavel);
    const rampaMs = AVCifra.rampaInicialDaRolagem(el.clientHeight, ritmo);
    cifraRolarAlternar();
    const cab = window.__cab();
    return { dur, t0: el.scrollTop, rolavel, ritmo, rampaMs, cab };
  });
  checar(comArInicio.dur === 200,
    'com mídia no ar a duração da barra vale — é dela que o `auto` tira o ritmo',
    comArInicio);
  checar(comArInicio.cab.aVista && comArInicio.cab.antesDaFolha,
    'o cabeçalho da obra também está na caixa aqui, com música no ar — a margem '
    + 'não depende de haver relógio', comArInicio);

  // ===== O MARCO SAI DO ESTADO DO APP, NUNCA DO RELÓGIO (v1.6.2) =====
  //
  // Aqui está o defeito que a rampa introduziria num oráculo escrito como o de
  // ontem, e ele reprovaria o APP CERTO: `t0` é lido antes do toque, e medir
  // `(t1 − t0) / 1,5` faz a distância percorrida DURANTE a rampa entrar na
  // conta do ritmo. MEDIDO na fixture: ~67 px/s acima do ritmo real, contra uma
  // tolerância de 56 — vermelho, e quem lesse o log concluiria que o app
  // quebrou.
  //
  // A resposta é a regra da casa: **quem responde "já pode?" é a função do
  // APP**. `cifraRampando` cai no quadro em que o compasso cheio chega, e é
  // desse instante que sai o `marco` de onde a medição parte.
  const chegouComAr = await esperar(pg, () => cifraRampando === false, null, 40000);
  checar(chegouComAr === true,
    'com mídia no ar a rampa também TERMINA sozinha — daqui em diante o compasso '
    + 'é o do relógio da música', porque(chegouComAr));
  const marcoComAr = await pg.evaluate(() => ({
    scrollTop: lyricsViewBodyEl.scrollTop, cab: window.__cab(),
  }));
  checar(!marcoComAr.cab.aVista,
    'e o cabeçalho já saiu de cena quando o ritmo cheio chega — a margem é do '
    + 'ARRANQUE, e o arranque acabou', marcoComAr);
  await dormir(1500);
  const comAr = await pg.evaluate(() => {
    const t1 = lyricsViewBodyEl.scrollTop;
    const titulo = cifraVelBtnEl ? cifraVelBtnEl.title : '';
    const cab = window.__cab();
    cifraRolarParar();
    midiaNoAr = false;
    return { t1, titulo, cab };
  });
  checar(comAr.t1 > comArInicio.t0,
    'e a folha ANDA com a música PARADA no segundo zero (v1.5.6): o `auto` '
    + 'integra o relógio de parede a partir de onde a folha está, e não persegue '
    + 'a posição da mídia', { t0: comArInicio.t0, t1: comAr.t1 });
  // O RITMO, e não só o movimento — medido A PARTIR DO MARCO, isto é, depois de
  // a rampa acabar. Tolerância larga de propósito: o que se afirma é de QUAL
  // fonte o px/s saiu, não a precisão do agendador de quadros.
  checar(comArInicio.ritmo > 0
    && Math.abs((comAr.t1 - marcoComAr.scrollTop) / 1.5 - comArInicio.ritmo)
      < Math.max(2, comArInicio.ritmo * 0.6),
    'e no RITMO da música, não no fixo do modo livre — o percurso inteiro cabe '
    + 'na janela da duração',
    { andou: comAr.t1 - marcoComAr.scrollTop, ritmo: comArInicio.ritmo });
  checar(/ritmo da música/.test(comAr.titulo),
    'e o botão diz que está seguindo a música', comAr.titulo);
  checar(!comAr.cab.aVista,
    'e o cabeçalho CONTINUA fora da tela com o compasso cheio no ar — sai uma '
    + 'vez, e não volta', comAr);

  // ======================================================================
  // METADE 2-B — UM DEGRAU NUMÉRICO IGNORA O RELÓGIO (v1.6.1)
  // ======================================================================
  //
  // ESTA É A ASSERÇÃO QUE GUARDA O PEDIDO, e o pedido aqui é uma AUSÊNCIA de
  // mudança. O operador renomeou o `Auto` para `1×` e corrigiu, por extenso, o
  // que isso NÃO era: *"não mude o comportamento da escala, o comportamento
  // estava correto, o nome auto que não representava uma comparação de
  // velocidade… as variações 1,5x ou 0,5x representam mais rápido ou mais
  // devagar em comparação com o 1x"*.
  //
  // O rótulo `1,5×` CONVIDA a "consertar" a conta — a ler o degrau como um
  // multiplicador do `1×`, isto é, do RELÓGIO. Não é isso que o app faz e não é
  // isso que foi pedido: com duração no ar o degrau base segue o relógio (a
  // metade acima) e um degrau numérico segue o FIXO vezes o fator, sempre
  // (`cifraRolarQuadro`: `ritmo = ehAuto ? cifraRitmoDoRelogio(...) : 0`).
  //
  // A PROVA É DESLOCAMENTO MEDIDO, não leitura de variável: quem trocasse a
  // conta por `relógio × fator` deixaria `CIFRA_VELOCIDADES` idêntica, e uma
  // asserção sobre a constante aprovaria a troca.
  //
  // O `2×` é o degrau escolhido porque é o que mais AFASTA as duas hipóteses:
  // com 200 s de música o relógio pede ~96 px/s e o fixo pede 44 — e a leitura
  // errada (relógio × 2) daria ~192, longe dos dois. Num `0,5×` as duas
  // hipóteses quase se encostam, e a medição não decidiria nada.
  //
  // REVERSÃO: fazer o ramo numérico multiplicar `cifraRitmoDoRelogio(rolavel)`
  // reprova a segunda asserção (a folha andaria ~4× mais que o fixo).
  const fixoInicio = await pg.evaluate(() => {
    cifraAdotarVelocidade(2);
    midiaNoAr = true;
    seekEl.disabled = false;
    seekEl.max = '200';
    const el = lyricsViewBodyEl;
    el.scrollTop = 0;
    const rolavel = el.scrollHeight - el.clientHeight;
    const doRelogio = cifraRitmoDoRelogio(rolavel);
    const pxPorS = CIFRA_PX_POR_S * CIFRA_VELOCIDADES[cifraVelIdx];
    const rampaMs = AVCifra.rampaInicialDaRolagem(el.clientHeight, pxPorS);
    cifraRolarAlternar();
    return {
      rotulo: cifraVelBtnEl.textContent.trim(),
      doRelogio, pxPorS, rampaMs, t0: el.scrollTop,
    };
  });
  checar(fixoInicio.rotulo === '2×' && fixoInicio.doRelogio > fixoInicio.pxPorS * 1.5,
    'o degrau `2×` está no ar e o relógio desta música pede um ritmo BEM outro '
    + '— sem essa distância a medição abaixo não decidiria nada', fixoInicio);
  // O MESMO MARCO da metade acima, e pelo mesmo motivo: a distância percorrida
  // durante a rampa não é o compasso deste degrau, e sem descontá-la a asserção
  // abaixo reprovaria o app certo.
  const chegouFixo = await esperar(pg, () => cifraRampando === false, null, 40000);
  checar(chegouFixo === true,
    'num degrau NUMÉRICO a rampa também termina sozinha', porque(chegouFixo));
  const marcoFixo = await pg.evaluate(() => lyricsViewBodyEl.scrollTop);
  await dormir(1500);
  const fixo = await pg.evaluate(() => {
    const t1 = lyricsViewBodyEl.scrollTop;
    const titulo = cifraVelBtnEl.title;
    cifraRolarParar();
    midiaNoAr = false;
    cifraAdotarVelocidade('auto');
    cifraPintarRolar();
    return { t1, titulo };
  });
  const andouFixo = (fixo.t1 - marcoFixo) / 1.5;
  checar(Math.abs(andouFixo - fixoInicio.pxPorS) < Math.max(2, fixoInicio.pxPorS * 0.6)
    && andouFixo < fixoInicio.doRelogio * 0.75,
    'e COM duração no ar ele anda no ritmo FIXO vezes o fator, nunca no do '
    + 'relógio: o rótulo é um indicador RELATIVO, não um multiplicador do `1×`',
    { andou: andouFixo, fixoEsperado: fixoInicio.pxPorS, doRelogio: fixoInicio.doRelogio });
  checar(/ritmo fixo/i.test(fixo.titulo) && /1×/.test(fixo.titulo),
    'e a frase do botão diz as duas coisas que o rótulo sozinho deixou de dizer: '
    + 'que o ritmo é FIXO, e contra qual base ele se compara', fixo.titulo);

  // ======================================================================
  // METADE 4 — O DEDO MANDA, E A MÚSICA NÃO O DESFAZ
  // ======================================================================
  //
  // *"se eu rolar para baixo manualmente (mesmo durante o auto scroll), siga o
  // tempo correto a partir de onde deixei o scroll. Vale tanto para volta como
  // para avanços."*
  //
  // Era o defeito central do desenho antigo, e ele era MUDO: o alvo absoluto
  // puxava a folha de volta ao ponto da música no status seguinte (~4 Hz), então
  // um arrasto durava um quarto de segundo. O `cifraDesvio` existia para dar ao
  // dedo um lugar naquela briga; hoje não há briga, e a asserção é a AUSÊNCIA de
  // retorno: solto o dedo, a folha continua DAQUI.
  //
  // Nos DOIS sentidos, porque eles falham por caminhos diferentes: um salto para
  // trás e um para frente eram, no alvo absoluto, um desvio negativo e um
  // positivo.
  for (const [nome, destino] of [['para FRENTE', 400], ['para TRÁS', 60]]) {
    const dedo = await pg.evaluate(async (dest) => {
      midiaNoAr = true;
      seekEl.disabled = false;
      seekEl.max = '200';
      const el = lyricsViewBodyEl;
      el.scrollTop = 0;
      const rolavel = el.scrollHeight - el.clientHeight;
      const ritmo = AVCifra.ritmoDaRolagem(rolavel, 200);
      const rampaMs = AVCifra.rampaInicialDaRolagem(el.clientHeight, ritmo);
      cifraRolarAlternar();
      // Espera a folha estar no COMPASSO CHEIO antes de arrastar — arrastar
      // durante a rampa não provaria nada sobre o dedo brigando com o
      // autoscroll, que é o que este caso existe para verificar: ali a folha
      // anda devagar de propósito, e a tolerância de baixo (que é o `ritmo`)
      // ficaria larga demais para decidir.
      await new Promise((r) => setTimeout(r, rampaMs + 300));
      // O ARRASTO: o elemento é escrito por fora, como um dedo escreveria.
      el.scrollTop = dest;
      const largou = el.scrollTop;
      await new Promise((r) => setTimeout(r, 900));
      const depois = el.scrollTop;
      cifraRolarParar();
      midiaNoAr = false;
      return { largou, depois, ritmo };
    }, destino);
    // A TOLERÂNCIA É O RITMO, nunca um número de pixels: a folha do fixture não
    // tem tamanho fixo, e o px/s do `auto` sai dele. O que se afirma é *continuou
    // daqui, no ritmo* — a folha do desenho antigo teria voltado para o ponto da
    // MÚSICA, que com ela no segundo zero é o topo.
    checar(dedo.depois >= dedo.largou && dedo.depois - dedo.largou < dedo.ritmo * 1.5 + 10,
      'arrastando a folha ' + nome + ', a rolagem CONTINUA dali — não volta '
      + 'para onde a mídia estaria (v1.5.6)', dedo);
  }

  // ======================================================================
  // METADE 5 — A FOLHA NUNCA MEXE NO TEMPO DA MÍDIA
  // ======================================================================
  //
  // *"E esse scroll das cifras não altera o tempo, seja parado ou tocando, da
  // mídia em exibição."*
  //
  // Sempre foi verdade e nunca teve oráculo — e é uma AUSÊNCIA, que não tem
  // sintoma nenhum enquanto vale. O dia em que alguém ligar os dois eixos "para
  // sincronizar", a folha passa a comandar a projeção no meio do culto: um
  // arrasto para reler uma estrofe volta o louvor na frente da congregação.
  //
  // A prova é o BARRAMENTO, não o `<video>`: quem projeta é o telão, e o que
  // chega lá é comando. Zero comandos é a afirmação inteira.
  const semSeek = await pg.evaluate(async () => {
    midiaNoAr = true;
    seekEl.disabled = false;
    seekEl.max = '200';
    const vistos = [];
    const espiao = AVDB.sendCommand;
    AVDB.sendCommand = (c) => { vistos.push(c && c.type); return espiao.call(AVDB, c); };
    lyricsViewBodyEl.scrollTop = 0;
    cifraRolarAlternar();
    await new Promise((r) => setTimeout(r, 500));
    lyricsViewBodyEl.scrollTop = 300;   // o dedo, no meio da rolagem
    await new Promise((r) => setTimeout(r, 500));
    cifraRolarParar();
    AVDB.sendCommand = espiao;
    midiaNoAr = false;
    return vistos;
  });
  checar(semSeek.length === 0,
    'e a rolagem não manda comando NENHUM ao barramento: a folha não altera o '
    + 'tempo da mídia, parada ou tocando', semSeek.join(', ') || '(nenhum)');

  // ======================================================================
  // METADE 3 — A FOLHA DA BIBLIOTECA: a rolagem tem de SOBREVIVER ao redesenho
  // ======================================================================
  //
  // Desde a v1.2.14 a folha não é mais de quem está no ar: `lvAlvo` a aponta
  // para uma música da Biblioteca, e o `lvBuildCifra` para a rolagem quando a
  // folha troca de música (`cifraRolandoChave !== cifraChave(lvItem())`). A
  // chave era gravada de `currentItem` — a música da CENA —, então com um alvo
  // as duas nunca batiam: a rolagem morria no PRIMEIRO redesenho da folha, que
  // é o que transpor meio tom, tocar em A+/A− e girar o aparelho fazem.
  //
  // O desfecho não é um erro: o ▶ volta sozinho e a folha para. E ele aparece
  // exatamente no ENSAIO — ler a cifra sem projetar nada —, que é o caso para o
  // qual a folha sem telão foi feita.
  //
  // AS DUAS ASSERÇÕES SÃO NECESSÁRIAS: `cifraRolando` continuar `true` sem a
  // folha andar seria um botão mentindo, e a folha andar num quadro solto sem
  // o estado de pé não é rolagem. E a guarda que este caso exercita é REAL —
  // trocar de música com a rolagem ligada tem de parar —, então a última
  // asserção prova que ela não foi simplesmente apagada.
  const alvo = await pg.evaluate(async () => {
    // A cena continua a mesma; a FOLHA passa a ser de outra música.
    const outra = {
      id: 'alvo-da-biblioteca', name: 'Musica Do Ensaio', hymnName: 'Musica Do Ensaio',
      kind: 'audio', seconds: 200, lyrics: [{ text: 'linha do ensaio' }],
    };
    openLyricsPopup(outra);
    lvSource = 'cifra';
    renderLyricsView();
    return { fonte: lvActiveSource(), naCena: lvNaCena() };
  });
  checar(alvo.fonte === 'cifra' && alvo.naCena === false,
    'a folha aponta para uma música da BIBLIOTECA, na aba de cifra (o cenário '
    + 'do ensaio)', alvo);
  await pg.waitForSelector('.lv-cifra-acordes', { timeout: 15000 });

  const ensaioInicio = await pg.evaluate(() => {
    // Ritmo FIXO: esta metade fala da chave, não do relógio. O degrau mais
    // RÁPIDO da escada (2× desde a v1.6.1 — o 3× saiu a pedido do operador) só
    // para encurtar a espera do teste; a regra que este caso prova (a chave
    // sobrevive ao redesenho) não depende dele.
    //
    // E O NÚMERO IMPORTA: um degrau FORA da escada cai no `CIFRA_VEL_PADRAO`
    // pelo `indexOf` de `cifraAdotarVelocidade`, que é o sentinela `'auto'` —
    // e a linha abaixo calcularia `CIFRA_PX_POR_S * 'auto'`, isto é `NaN`.
    // `rampaInicialDaRolagem` devolve 0 diante de `NaN` e o oráculo mediria a
    // folha no arranque, reprovando um app certo.
    cifraAdotarVelocidade(2);
    midiaNoAr = false;
    const el = lyricsViewBodyEl;
    el.scrollTop = 0;
    const pxPorS = CIFRA_PX_POR_S * CIFRA_VELOCIDADES[cifraVelIdx];
    const rampaMs = AVCifra.rampaInicialDaRolagem(el.clientHeight, pxPorS);
    cifraRolarAlternar();
    return { rampaMs };
  });
  // Supera a rampa pelo ESTADO DO APP, e não pelo relógio: o que vem abaixo
  // precisa medir a folha no COMPASSO CHEIO, e num runner carregado a rampa
  // dura mais tempo de PAREDE do que a duração que a função pura devolveu (o
  // `dt` acumulado tem o teto de `CIFRA_DT_MAX`).
  const chegouEnsaio = await esperar(pg, () => cifraRampando === false, null, 40000);
  checar(chegouEnsaio === true,
    'a rampa da folha da BIBLIOTECA também termina sozinha — daqui em diante a '
    + 'folha anda no compasso do degrau escolhido', porque(chegouEnsaio));
  const ensaio = await pg.evaluate(async () => {
    const el = lyricsViewBodyEl;
    // ===== A POSIÇÃO DE PARTIDA É ESCRITA, NÃO ESPERADA =====
    //
    // Ela precisa ser LONGE do topo para o bloco abaixo decidir alguma coisa, e
    // "longe" não pode depender de quantos quadros o runner deu — foi assim que
    // a versão anterior deste caso passou sem medir o que dizia medir.
    // Escrever o `scrollTop` é o gesto do DEDO, o mesmo da METADE 4: o quadro
    // seguinte vê `scrollTop !== cifraEscrito`, conclui que outro mexeu na folha
    // e adota o valor — que é a linha que atende o "vale tanto para volta como
    // para avanços".
    el.scrollTop = 400;
    await new Promise((r) => setTimeout(r, 120));
    const antes = el.scrollTop;
    // O QUE O OPERADOR FAZ NO ENSAIO: sobe meio tom, aumenta a fonte, gira o
    // aparelho. Os três chegam aqui — `renderLyricsView` refaz a folha inteira.
    renderLyricsView();
    // ===== TRÊS PONTOS, E NÃO DOIS (v1.6.2) =====
    //
    // A versão anterior lia `t0` ANTES do redesenho e afirmava `t1 > t0 + 2`.
    // Ela passava por ACIDENTE: com a espera parada da v1.5.20 a folha só tinha
    // 500 ms de movimento quando o redesenho chegava (o resto era imobilidade),
    // isto é ~22px no degrau `2×` deste caso, e o movimento dos 800 ms seguintes
    // COBRIA o recuo — ninguém o via. Com a rampa a folha está em ~145px na mesma
    // altura do arquivo (MEDIDO), e `t1` saía MENOR que `t0`: o oráculo vermelho
    // apontando para um defeito que sempre esteve ali.
    //
    // O que a asserção sempre quis dizer é *"a folha continua ANDANDO depois do
    // redesenho"*, e isso se mede de onde ela FICOU — daí o ponto do meio. Ver o
    // ACHADO logo abaixo para o que o ponto de antes agora denuncia.
    await new Promise((r) => setTimeout(r, 60));
    const logoDepois = el.scrollTop;
    await new Promise((r) => setTimeout(r, 800));
    const t1 = el.scrollTop;
    const rolando = cifraRolando;
    // E A GUARDA CONTINUA VALENDO: a cena vira a folha, e a rolagem é da outra.
    lvAlvo = null;
    renderLyricsView();
    const depoisDeTrocar = cifraRolando;
    cifraRolarParar();
    return { antes, logoDepois, t1, rolando, depoisDeTrocar };
  });
  checar(ensaio.rolando === true,
    'a rolagem SOBREVIVE ao redesenho da folha da Biblioteca — a chave gravada '
    + 'é a do ALVO, não a da cena', ensaio);
  checar(ensaio.t1 > ensaio.logoDepois + 2,
    'e a folha continua ANDANDO depois dele (estado de pé sem movimento seria '
    + 'um botão mentindo)', { logoDepois: ensaio.logoDepois, t1: ensaio.t1 });
  // ===== ACHADO: O REDESENHO JOGA A FOLHA PARA O TOPO =====
  //
  // Esta asserção afirma o que o app FAZ, não o que ele deveria fazer — o mesmo
  // partido do `no-ar` que nunca chega à faixa de um álbum
  // (`lista-da-biblioteca.test.mjs`), e pelo mesmo motivo: um oráculo que
  // afirmasse a promessa ficaria vermelho gatekeepando o canal OTA, e um que
  // calasse deixaria o defeito sem sinal nenhum.
  //
  // MEDIDO pelo caminho REAL (o botão `+½` da barra, não este `renderLyricsView`
  // solto): com a rolagem no ar e a folha em 260px, transpor meio tom a devolve
  // a 3px — `scrollHeight` IDÊNTICO dos dois lados (16277), então não é
  // remedição, é o corpo reconstruído. `cifraTranspor` chama `renderLyricsView()`
  // DIRETO, e a preservação em fração do conteúdo mora dentro de `cifraRemedir`,
  // que aquele caminho não atravessa. O A+/A− passa por lá e PRESERVA (MEDIDO:
  // a fração do conteúdo sobrevive à mudança de comprimento da folha) — o mesmo
  // gesto na mesma barra, dois desfechos.
  //
  // Para quem opera: sobe meio tom no meio do louvor e a cifra volta ao começo
  // da música, com o instrumento na mão. **Isto é ANTERIOR a este lote** — a
  // rampa só o tornou visível, porque antes a folha ainda não tinha saído do
  // topo quando o redesenho chegava.
  //
  // QUANDO FOR CORRIGIDO esta linha reprova, e é para isso que ela existe: quem
  // consertar troca o `<` por um `≈` e fecha o achado no mesmo lote.
  checar(ensaio.logoDepois < ensaio.antes * 0.5,
    'ACHADO EM ABERTO: o redesenho da folha PERDE a posição de leitura (o corpo '
    + 'é reconstruído e `cifraRemedir`, que preserva a fração, não está neste '
    + 'caminho) — pelo botão de transposição, a cifra volta ao começo da música',
    { antes: ensaio.antes, logoDepois: ensaio.logoDepois });
  checar(ensaio.depoisDeTrocar === false,
    'e trocar a música DA FOLHA continua parando a rolagem — a guarda não foi '
    + 'apagada para o caso acima passar', ensaio);
} finally {
  await navegador.close();
  servidor.close();
}

console.log('\n' + (falhas.length ? falhas.length + ' FALHA(S)' : 'tudo certo'));
process.exit(falhas.length ? 1 : 0);
