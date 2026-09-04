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
// ## A ESPERA INICIAL (v1.5.20) muda O RELÓGIO, não a REGRA
//
// Pedido do operador: *"o sistema deve esperar o usuário 'ler até chegar no
// ponto médio' antes de se preocupar em mover automaticamente"*. Ligar a
// rolagem não move a folha mais NA HORA: primeiro há uma pausa (piso 2 s, teto
// 8 s) do tamanho do que se leva para ler da primeira linha ao meio da caixa,
// no MESMO ritmo que a folha vai seguir — `AVCifra.esperaInicialDaRolagem`.
//
// Cada bloco abaixo que MEDE MOVIMENTO logo após `cifraRolarAlternar()` chama
// essa função pura, pela PONTE (`pg.evaluate`), para saber quanto esperar antes
// de medir — a mesma regra do resto deste projeto: **quem responde "já pode?"
// é a função do APP**, nunca um número escrito à mão no oráculo (ver "Um
// oráculo não pode medir o runner" no CLAUDE.md). Os blocos que NÃO medem
// movimento (a ausência de comando no barramento) ficam como estavam — a
// espera não muda o que eles afirmam.
//
//   node tools/cifra-rolagem.test.mjs
// ============================================================================
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';

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
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
};
const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const arquivo = path.join(RAIZ, p);
  if (!arquivo.startsWith(RAIZ) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
    res.writeHead(404); res.end('nao'); return;
  }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream' });
  fs.createReadStream(arquivo).pipe(res);
});

const falhas = [];
function checar(cond, msg, obtido) {
  if (cond) console.log('ok      ' + msg);
  else {
    console.log('FALHOU  ' + msg + (obtido !== undefined ? '\n        obtido: ' + JSON.stringify(obtido) : ''));
    falhas.push(msg);
  }
}

// Um `setTimeout` puro, não o `esperar()` de polling que outros oráculos usam
// (`ota.test.mjs`, `historico.test.mjs`): ali a pergunta é "já aconteceu o
// FATO?"; aqui a duração em si É o fato — a espera inicial da cifra é uma
// pausa de relógio de parede, e o número que a define vem sempre da MESMA
// função pura que o app usa (`AVCifra.esperaInicialDaRolagem`), nunca
// adivinhado aqui.
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

await new Promise((r) => servidor.listen(0, r));
const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
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

  const rolavel = await pg.evaluate(
    () => lyricsViewBodyEl.scrollHeight - lyricsViewBodyEl.clientHeight,
  );
  checar(rolavel > 200,
    'a folha é MAIOR que a caixa — sem isso as duas metades mediriam zero contra '
    + 'zero, e o oráculo aprovaria qualquer coisa', rolavel);

  // A velocidade tem de ser `auto`: é dela que este caso fala. O degrau é
  // persistido, então não se pode supor o que veio do banco.
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
    const esperaMs = AVCifra.esperaInicialDaRolagem(el.clientHeight, pxPorS);
    cifraRolarAlternar();
    return { dur, esperaMs, t0: el.scrollTop };
  });
  checar(semArInicio.dur === 0,
    'sem mídia no ar não há duração a seguir — a barra habilitada não é "no ar"',
    semArInicio);

  // ===== A ESPERA INICIAL, medida NO MEIO DO CAMINHO =====
  //
  // Ligar a rolagem não move a folha na hora: há uma pausa para ler antes.
  // Medir exatamente na METADE da espera (não no fim, nem no dobro dela) é o
  // que separa "ainda não andou porque está esperando" de "nunca vai andar" —
  // esperar de mais aprovaria também um botão simplesmente quebrado.
  await dormir(Math.max(200, semArInicio.esperaMs / 2));
  const semArDurante = await pg.evaluate(() => ({
    scrollTop: lyricsViewBodyEl.scrollTop,
    ring: !!(cifraRolarBtnEl && cifraRolarBtnEl.querySelector('.dl-ring')),
  }));
  checar(semArDurante.scrollTop === semArInicio.t0,
    'no MEIO da espera inicial a folha ainda NÃO se moveu — é hora de ler, não '
    + 'de rolar', semArDurante);
  checar(semArDurante.ring,
    'e o indicador de "em andamento" (o anel) está no botão durante a espera — '
    + 'para não parecer travado', semArDurante);

  // Supera o resto da espera e dá tempo de o movimento ficar mensurável — o
  // mesmo intervalo de 1500 ms que a versão anterior deste caso usava, só que
  // contado a partir de quando o movimento de fato pode começar.
  await dormir(semArInicio.esperaMs / 2 + 1500);
  const semAr = await pg.evaluate(() => {
    const t1 = lyricsViewBodyEl.scrollTop;
    const titulo = cifraVelBtnEl ? cifraVelBtnEl.title : '';
    const ring = !!(cifraRolarBtnEl && cifraRolarBtnEl.querySelector('.dl-ring'));
    cifraRolarParar();
    return { t1, titulo, ring };
  });
  checar(semAr.t1 > semArInicio.t0 + 5,
    'e a folha ANDA depois da espera: o modo LIVRE assumiu, que é o que o '
    + '`auto` sem relógio promete', { t0: semArInicio.t0, t1: semAr.t1 });
  checar(/ritmo fixo/.test(semAr.titulo),
    'e o botão DIZ isso — o rótulo mostra a escolha, a frase mostra o que está '
    + 'acontecendo', semAr.titulo);
  checar(!semAr.ring,
    'e o indicador de espera SOME assim que o movimento de fato começa — a '
    + 'própria folha andando já basta para dizer "está funcionando"', semAr);

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
    const esperaMs = AVCifra.esperaInicialDaRolagem(el.clientHeight, ritmo);
    cifraRolarAlternar();
    const ring = !!(cifraRolarBtnEl && cifraRolarBtnEl.querySelector('.dl-ring'));
    return { dur, t0: el.scrollTop, rolavel, ritmo, esperaMs, ring };
  });
  checar(comArInicio.dur === 200,
    'com mídia no ar a duração da barra vale — é dela que o `auto` tira o ritmo',
    comArInicio);
  checar(comArInicio.ring,
    'e o indicador de espera também acende aqui, com música no ar', comArInicio);

  // Supera a espera inicial e dá 1,5 s de movimento para medir — a MESMA
  // janela de medição do caso de cima, só que começando quando o movimento de
  // fato pode começar.
  await dormir(comArInicio.esperaMs + 1500);
  const comAr = await pg.evaluate(() => {
    const t1 = lyricsViewBodyEl.scrollTop;
    const titulo = cifraVelBtnEl ? cifraVelBtnEl.title : '';
    const ring = !!(cifraRolarBtnEl && cifraRolarBtnEl.querySelector('.dl-ring'));
    cifraRolarParar();
    midiaNoAr = false;
    return { t1, titulo, ring };
  });
  checar(comAr.t1 > comArInicio.t0,
    'e a folha ANDA com a música PARADA no segundo zero (v1.5.6): o `auto` '
    + 'integra o relógio de parede a partir de onde a folha está, e não persegue '
    + 'a posição da mídia', { t0: comArInicio.t0, t1: comAr.t1 });
  // O RITMO, e não só o movimento. Tolerância larga de propósito: o que se
  // afirma é de QUAL fonte o px/s saiu, não a precisão do agendador de quadros.
  checar(comArInicio.ritmo > 0 && Math.abs((comAr.t1 - comArInicio.t0) / 1.5 - comArInicio.ritmo)
    < Math.max(2, comArInicio.ritmo * 0.6),
    'e no RITMO da música, não no fixo do modo livre — o percurso inteiro cabe '
    + 'na janela da duração', { andou: comAr.t1 - comArInicio.t0, ritmo: comArInicio.ritmo });
  checar(/ritmo da música/.test(comAr.titulo),
    'e o botão diz que está seguindo a música', comAr.titulo);
  checar(!comAr.ring,
    'e o indicador some quando o movimento de fato começa, também com música '
    + 'no ar', comAr);

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
      const esperaMs = AVCifra.esperaInicialDaRolagem(el.clientHeight, ritmo);
      cifraRolarAlternar();
      // Espera a folha estar DE FATO em movimento antes de arrastar — arrastar
      // durante a leitura inicial não provaria nada sobre o dedo brigando com
      // o autoscroll, que é o que este caso existe para verificar.
      await new Promise((r) => setTimeout(r, esperaMs + 300));
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
    // RÁPIDO da escada (3×) só para encurtar a espera do teste — a regra que
    // este caso prova (a chave sobrevive ao redesenho) não depende dele.
    cifraAdotarVelocidade(3);
    midiaNoAr = false;
    const el = lyricsViewBodyEl;
    el.scrollTop = 0;
    const pxPorS = CIFRA_PX_POR_S * CIFRA_VELOCIDADES[cifraVelIdx];
    const esperaMs = AVCifra.esperaInicialDaRolagem(el.clientHeight, pxPorS);
    cifraRolarAlternar();
    return { esperaMs };
  });
  // Supera a espera: o `t0` daqui em diante precisa estar num trecho em que a
  // folha JÁ anda, senão um redesenho no meio da leitura inicial não prova
  // nada sobre sobreviver ao redesenho — só sobre sobreviver a não fazer nada.
  await dormir(ensaioInicio.esperaMs + 500);
  const ensaio = await pg.evaluate(async () => {
    const t0 = lyricsViewBodyEl.scrollTop;
    // O QUE O OPERADOR FAZ NO ENSAIO: sobe meio tom, aumenta a fonte, gira o
    // aparelho. Os três chegam aqui — `renderLyricsView` refaz a folha inteira.
    renderLyricsView();
    await new Promise((r) => setTimeout(r, 800));
    const t1 = lyricsViewBodyEl.scrollTop;
    const rolando = cifraRolando;
    // E A GUARDA CONTINUA VALENDO: a cena vira a folha, e a rolagem é da outra.
    lvAlvo = null;
    renderLyricsView();
    const depoisDeTrocar = cifraRolando;
    cifraRolarParar();
    return { t0, t1, rolando, depoisDeTrocar };
  });
  checar(ensaio.rolando === true,
    'a rolagem SOBREVIVE ao redesenho da folha da Biblioteca — a chave gravada '
    + 'é a do ALVO, não a da cena', ensaio);
  checar(ensaio.t1 > ensaio.t0 + 2,
    'e a folha continua ANDANDO depois dele (estado de pé sem movimento seria '
    + 'um botão mentindo)', { t0: ensaio.t0, t1: ensaio.t1 });
  checar(ensaio.depoisDeTrocar === false,
    'e trocar a música DA FOLHA continua parando a rolagem — a guarda não foi '
    + 'apagada para o caso acima passar', ensaio);
} finally {
  await navegador.close();
  servidor.close();
}

console.log('\n' + (falhas.length ? falhas.length + ' FALHA(S)' : 'tudo certo'));
process.exit(falhas.length ? 1 : 0);
