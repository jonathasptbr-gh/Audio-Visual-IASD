// ============================================================================
// O CLIENTE DO ESPELHO DE PIXELS (P6 do `docs/ESPELHO-DE-PIXELS.md`)
//
// Roda no navegador de QUEM ESTÁ NA REDE DA IGREJA — um tablet no fundo do
// salão, um notebook na sala anexa, a smart TV da recepção. Ele não é parte do
// app: é uma página servida por `http://<ip do celular>:8787/`, e tudo o que ela
// faz é (1) provar quem é, uma vez, e (2) transformar um fluxo binário infinito
// num `<video>`.
//
// ## As três coisas que este arquivo é, e as três que ele NÃO é
//
// É: o transporte (§5), a fila de `appendBuffer` serializada, e o estado
// desenhado em português na própria tela.
//
// NÃO é: um segundo telão. Ele não sabe o que é uma estrofe, uma cortina, um
// versículo ou um fade — nem tem como saber, porque o que atravessa a rede são
// PIXELS. É essa ignorância que faz o espelho não ter como ser parcial, e é ela
// que mantém a invariante 5 do `CLAUDE.md` intacta com um recurso inteiro a
// mais. NÃO é dono de relógio: o eixo de tempo é o `presentationTimeUs` do
// `MediaCodec` do celular, ele viaja em todo quadro e ninguém aqui o
// reconcilia com nada (§2.2). E NÃO tem canal de volta para o barramento de
// comandos: o upstream inteiro são três palavras — `key`, `alive`, `audio`.
// O cliente é somente-leitura de pixels (§3.6, invariante 8).
//
// ## O piso é `http://`, e isso governa cada linha
//
// A rede da igreja pode não ter internet num domingo, e certificado público
// para IP privado não existe (§2.4). Logo TUDO que a IDL marca
// `[SecureContext]` vem `undefined` aqui: `crypto.randomUUID`, `crypto.subtle`,
// `navigator.wakeLock`, `VideoDecoder`, `AudioWorklet`. A disciplina é a mesma
// do `if (!window.__NATIVE__)` do resto do projeto — o piso é o caminho
// principal, o melhor entra guardado por `isSecureContext`. Quem varre isto é
// `tools/contexto-seguro.test.mjs`.
//
// E a consequência boa, que é o motivo de o decodificador ser `MediaSource` e
// não WebCodecs: **um `<video>` tocando segura a tela acesa sem pedir permissão
// nenhuma** — o wake lock de vídeo do Chromium exige um `HTMLMediaElement` com
// vídeo, cobrindo a tela, e não pede contexto seguro. Um `<canvas>` não segura.
// É por isso que no MODO IMAGEM esta página avisa, por escrito, que a tela do
// aparelho pode apagar sozinha (§3.10, P25).
// ============================================================================
(function (global) {
  'use strict';

  const doc = global.document;

  // --------------------------------------------------------------------------
  // O PROTOCOLO (§5.2). Dezesseis bytes de cabeçalho, e o comprimento é NOSSO:
  // os limites de chunk do HTTP não coincidem com os limites de mensagem para
  // quem lê de um `ReadableStream`, então o prefixo é obrigatório.
  // --------------------------------------------------------------------------
  const CAB = 16;
  const T_CSD_VIDEO = 0x01;
  const T_VIDEO = 0x02;
  const T_CSD_AUDIO = 0x10;
  const T_AUDIO = 0x11;
  const T_CONTROLE = 0x30;
  const F_CHAVE = 1;

  // Teto de sanidade para o campo de tamanho. Um IDR de 720p passa longe disto;
  // o que ele impede é um comprimento corrompido (ou um servidor que não é o
  // nosso) fazer o cliente acumular memória para sempre esperando bytes que
  // nunca vêm — falha silenciosa que terminaria em aba morta, sem mensagem.
  const CARGA_MAX = 8 * 1024 * 1024;

  // O token vive em `sessionStorage` e NUNCA numa URL (§3.5, invariante 2).
  // `sessionStorage` e não `localStorage` de propósito: o token tem prazo e
  // morre com a sessão do espelho — guardá-lo além da aba seria prometer uma
  // permanência que o servidor não dá.
  const CHAVE = 'av-espelho';

  const POLL_MS = 1200;                   // compasso do "já aprovaram?"
  const POLL_LIMITE = 5 * 60 * 1000;      // e o prazo para desistir de esperar

  // Espera crescente entre reconexões. Curta no começo porque a causa mais
  // comum é o servidor tendo reiniciado o encoder (segundos), longa no fim
  // porque a segunda causa mais comum é o operador ter desligado o espelho — e
  // martelar uma porta fechada gasta rádio de um AP de igreja.
  const RECONEXAO = [500, 1000, 2000, 4000, 8000];

  // A JANELA VIVA (§2.2). Cinco segundos de passado: o bastante para o
  // navegador ter margem de decodificação e pouco o suficiente para a cota do
  // MSE nunca ser o assunto. Na cota apertada (`QuotaExceededError`) a poda é
  // mais agressiva — dois segundos.
  // A JANELA PRECISA CABER UM GOP INTEIRO, e isto é uma correção, não folga.
  //
  // `SourceBuffer.remove(a, b)` da MSE não apaga só o que foi pedido: depois de
  // remover as amostras do intervalo, o algoritmo de remoção de quadros
  // codificados **continua apagando até o PRÓXIMO ponto de acesso aleatório** —
  // senão sobrariam quadros delta sem a chave de que dependem. Com uma janela
  // menor que o GOP, `remove(0, currentTime - JANELA_S)` come para a frente e
  // pode levar o PRESENTE junto: o cursor fica fora do buffer, a imagem congela
  // sem erro nenhum, e a única saída era o salto de `SALTO_S`.
  //
  // E o GOP aqui é LONGO. `KEY_I_FRAME_INTERVAL` do `EspelhoCodec` é convertido
  // pelo framework em CONTAGEM DE QUADROS (5 s × `KEY_FRAME_RATE` 30 = 150
  // quadros); numa cena de letra o produtor entrega ~8 quadros por segundo, e
  // 150 quadros viram ~19 SEGUNDOS de parede. Cinco segundos de janela contra um
  // GOP de dezenove é a bomba armada.
  //
  // Duas defesas, porque uma só não basta: a janela cresce, e a poda passa a
  // cortar SÓ em cima de um quadro-chave que ela viu passar (ver `podar`).
  const JANELA_S = 12;
  const GUARDA_S = 6;

  // A PERSEGUIÇÃO DA BORDA, por `playbackRate` e nunca por `currentTime`
  // (§3.11, invariante 6): escrever `currentTime` estala, e um estalo por
  // compasso durante duas horas é pior que meio segundo de atraso.
  // O ALVO ERA 0,6 s, e ele era o orçamento inteiro da tela contra qualquer
  // soluço do celular. Numa cena parada o único produtor de quadros é um timer
  // na main thread do Blink, COMPARTILHADA com o documento do Controle e com o
  // do telão (invariante 3): um bloqueio de 600 ms lá — o operador rolando uma
  // lista — esvaziava a TV daqui. A rede de segurança do MediaCodec
  // (`REPETIR_APOS_US`, 500 ms) só arma DEPOIS que o orçamento acabou.
  //
  // 1,5 s é atraso invisível numa projeção (ninguém interage com o telão) e é o
  // dobro do pior bloqueio plausível. `TOL_S` NÃO acompanha: alargá-la para 0,5
  // poria o cursor a 100 ms de uma borda que o próprio encoder deixa 150 ms sem
  // andar, reabrindo o engasgo que a v5.155 fechou.
  // ...E ELE ENCOLHE SOZINHO, porque 1,5 s é o preço de uma tela que ainda não
  // provou nada.
  //
  // A folga é seguro contra soluço do produtor, e seguro custa ATRASO: o
  // operador toca um botão e a projeção responde `ALVO_S` depois — mais o
  // desvio A/V, porque a borda ao vivo é a da faixa mais atrasada e o som sai
  // ~500 ms atrás da imagem (ver `bordaViva`). Em aparelho isso deu os 2 s que
  // o operador mediu no dedo: `folga do cursor: video +2092 ms` no Registro é
  // literalmente esse atraso, e é assim que ele se mede daqui em diante.
  //
  // Um valor fixo obriga a escolher entre travar e demorar. Um valor que
  // ENCOLHE em silêncio a cada trecho limpo e VOLTA AO TETO no primeiro
  // incidente não obriga: a tela converge para o menor atraso que ELA aguenta,
  // e uma rede ruim recebe automaticamente a folga que uma rede boa não paga.
  // A assimetria (desce um degrau por vez, sobe de uma vez) é a mesma da
  // suavização da ETA do download — subir devagar depois de um travamento seria
  // travar de novo.
  const ALVO_MAX = 1.5;
  const ALVO_MIN = 0.7;
  const ALVO_PASSO = 0.1;
  const ALVO_CALMA_MS = 8000;
  let alvoS = ALVO_MAX;
  let calmaDesde = 0;
  let travouVisto = 0;

  const TOL_S = 0.25;
  const RAPIDO = 1.08;                    // acima disto o áudio ficaria audivelmente rápido
  const LENTO = 0.97;
  const BORDA_MS = 500;

  // ...E A EXCEÇÃO, que é outra coisa e por isso tem outro nome. Quando o
  // atraso passa de oito segundos não há perseguição possível: a 1,08× seriam
  // minutos para alcançar. Isso acontece depois de a aba ter ficado congelada,
  // ou de uma reconexão longa — casos em que o quadro retido pelo muxer vira
  // uma amostra de vários segundos para NÃO abrir buraco no `buffered` (ver o
  // cabeçalho de `fmp4.js`). Fechar o buraco é o certo; a contrapartida é este
  // salto único, aqui, uma vez. Ele não é a perseguição — é a recuperação dela.
  //
  // ERA OITO, E OITO ERA O PERÍODO DO DEFEITO. Enquanto o cursor encalhado só
  // fosse detectado por ESTE limiar, o tempo de tela congelada era exatamente o
  // tempo de a borda ao vivo abrir 8 s sobre um cursor parado — 7,1 a 7,6 s
  // partindo da folga de regime. É o número que o operador cronometrou
  // ("trava a cada 7 segundos"): ele nunca foi a causa, era o RELÓGIO DA
  // RECUPERAÇÃO. Com o encalhe detectado no instante (ver `borda`), este limiar
  // volta a ser o que ele diz ser — a aba que ficou congelada — e cabe em 4 s.
  const SALTO_S = 4;

  // Quanto tempo o cursor precisa ficar PARADO antes de o encalhe valer socorro.
  // Um pouco abaixo do compasso, para que dois giros seguidos sem andar já
  // contem — teto de ~1 s de tela congelada, contra os ~7 s do `SALTO_S`.
  const ENCALHE_MS = 400;

  // O PEDIDO DE CHAVE QUANDO A PODA ESTÁ FAMINTA. Freio próprio, e MUITO longo.
  //
  // Um IDR de 720p custa dezenas de kB (ver a armadilha 4 do `EspelhoCodec.kt`),
  // mas o custo que decidiu este número não é banda: é que o freio de IDR do
  // servidor é COMPARTILHADO (1 por tela a cada 2 s e um piso global de 1 s), e
  // ele não sabe distinguir um pedido de FAXINA de um pedido de ESTREIA. Em
  // aparelho o Registro mostrou `17 pedido(s) · 8 atendido(s) · 9 engolido(s)`,
  // e um engolido na hora errada é uma tela nova esperando a próxima chave para
  // ver a primeira imagem.
  //
  // Desde que o GOP passou a caber na janela (v5.159), a poda praticamente não
  // precisa pedir nada: o caso que resta é o transitório logo depois de um
  // recomeço. Trinta segundos cobrem isso e devolvem o freio a quem precisa
  // dele.
  const CHAVE_PODA_MS = 30000;

  // Fila de append longa demais = este aparelho não dá conta do fluxo. Ver
  // `recomecar()`: a resposta NÃO é descartar fragmentos (isso abriria buraco,
  // que é exatamente o que o muxer trabalha para evitar), é recomeçar limpo.
  const FILA_MAX = 60;

  // O BATIMENTO DO RELATO: 10 s, e não os 5 min de antes.
  //
  // Ele nasceu como sinal de vida ("esta tela ainda está aí"), e para isso 5
  // min bastavam. Ele deixou de ser isso: desde que o `POST /r` carrega as
  // MEDIDAS da tela (ver `medidasDaTela`), este é o único canal por onde o
  // operador enxerga se a imagem está andando — e um número de cinco minutos
  // atrás responde a pergunta errada, porque quem está olhando o Registro está
  // olhando para o travamento que acontece AGORA.
  //
  // O custo é desprezível e vale escrito, para ninguém "otimizar" isto de
  // volta: ~600 B de corpo mais cabeçalhos, seis vezes por minuto, por tela —
  // uns 6 kB/min contra os 3 Mbps do vídeo, isto é, três centésimos de por
  // cento. O `relatar` continua deduplicando por ESTADO, então uma mudança de
  // frase não espera este relógio.
  const ALIVE_MS = 10 * 1000;
  const CHAVE_MS = 2000;                  // freio do pedido de IDR (§3.6, invariante 9)

  // ---- O SOM (§3.9). Três números, e cada um existe por um modo de falhar ----
  //
  // 1. O quanto se SEGURA o `csd` de vídeo esperando o de áudio numa conexão em
  //    que esta tela já pediu som. Ele cobre a ida e a volta do `POST /r` que
  //    liga o áudio no servidor, e é o preço de as duas `SourceBuffer` terem de
  //    nascer JUNTAS (ver `abrirMidia`).
  const ESPERA_CSD_AUDIO_MS = 2500;
  // 2. Faixa de som aberta e NENHUM quadro AAC chegando por este tempo: o grafo
  //    do celular caiu. Sem soltar a faixa, o `<video>` PARA — a MSE só toca
  //    quando TODAS as faixas têm dado no instante atual, e a imagem morreria
  //    por causa do som. É a falha segura do §3.9 lida do lado do cliente.
  const AUDIO_MUDO_MS = 3000;
  // 3. E o mesmo, medido de outro jeito: a borda do som ficando este tanto
  //    atrás da borda da imagem.
  const ATRASO_AUDIO_S = 3;
  // Quantas vezes se aceita remontar a `MediaSource` para ligar o som numa
  // sessão. O gesto é UM, então uma remontagem basta; o teto existe para o dia
  // em que algo insista, porque um laço de remontagem seria a projeção piscando
  // sem parar por causa do recurso auxiliar.
  const REBUILDS_AUDIO = 3;
  // ...E ELE SE RENOVA depois deste tanto de som chegando sem falha. Ver
  // `vigiarAudio`: o teto é para um EPISÓDIO, não para o culto inteiro.
  const AUDIO_SAUDAVEL_MS = 45000;

  // O relato cabe no corpo de 256 B que o `POST /par` aceita (§5.1), e a conta
  // é apertada de propósito — passar do teto não dá erro de validação, dá um
  // `close` seco do servidor, que na tela vira "não foi possível falar com o
  // celular". A conta, no pior caso: os campos fixos somam 141 caracteres
  // (booleanos todos `false`, tela de quatro dígitos), mais 15 do `pin` OU 10
  // do `qr`, mais até 3 de um `telaAcesaMin` de quatro dígitos. Sobram 97 para
  // o `ua`.
  //
  // 88, e não 97, porque a margem paga o escape de JSON (um `"` ou `\` no
  // User-Agent vira dois caracteres) e um campo futuro. O que se perde são os
  // últimos oito caracteres de um User-Agent — o motor e a versão, que é o que
  // interessa no Registro, vêm no COMEÇO em todo navegador atual.
  const UA_MAX = 88;

  // --------------------------------------------------------------------------
  // Elementos e estado
  // --------------------------------------------------------------------------
  const el = {};
  let token = '';
  let vivo = false;                       // o laço de conexão deve continuar?
  let abortar = null;                     // AbortController da conexão em curso
  let tentativa = 0;

  let muxer = null;
  let ms = null;
  let sbV = null;                         // a faixa de imagem
  let sbA = null;                         // a de som, quando esta tela pediu
  let mime = '';
  let mimeA = '';
  const fila = [];                        // itens `{ b: bytes, a: éÁudio }`
  let emVoo = null;                       // { tipo:'append'|'remove', a } | null
  let podaPedida = false;
  let cotaSeguidas = 0;
  let posicionado = false;
  let esperandoChave = true;
  let compasso = null;

  // O gesto do visitante pediu som? É a única coisa que faz esta tela receber
  // AAC — nada aqui liga o grafo de áudio do celular, que sobe sozinho com o
  // espelho (§3.9); o que o `POST /r {"do":"audio"}` liga é a ENTREGA para
  // ESTA tela (§3.6, invariante 10).
  let audioQuerido = false;
  let initVideoRetido = null;             // o `csd` de vídeo à espera do de áudio
  let esperaAudio = null;
  // O PRAZO ABSOLUTO do `csd` de áudio (ms de época), que ATRAVESSA reconexões.
  // Zero = não estamos esperando. Ver a retenção em `receber`: é ele que impede
  // uma tela que reconecta a cada dois segundos de esperar para sempre por um
  // `csd` que nunca vem — o defeito que deixou o Registro dizendo
  // `som: pedido, esperando o csd` indefinidamente, com a tela sem projetar.
  let esperaAudioAte = 0;
  let audioDesde = 0;                     // quando a faixa de som abriu (vigia do mudo)
  let audioUltimoMs = 0;                  // e quando chegou o último quadro AAC
  let rebuilds = 0;
  // Desde quando o som chega sem interrupção — a âncora do teto acima.
  let audioSaudavelDesde = 0;

  // POR QUE ESTA TELA ESTÁ MUDA — o ramo exato, em texto curto, e sempre.
  //
  // `som: PEDIDO e a faixa não nasceu` responde ONDE o defeito está (deste
  // lado), e não QUAL é: entre o pedido e a faixa há sete desfechos possíveis —
  // o `csd` de áudio não chegou, chegou ilegível, chegou tarde demais (com a
  // `MediaSource` já aberta sem som), o navegador não decodifica aquele codec,
  // o `addSourceBuffer` foi recusado, o vigia soltou a faixa, ou a tela
  // reconectou reusando uma `MediaSource` muda. Cada um tem uma correção
  // diferente, e adivinhar entre eles a partir de um `false` custou três
  // rodadas.
  //
  // Ele viaja no MESMO campo `aviso` do relato (não num campo novo): o Kotlin
  // já o sanea e já o mostra como `diz:`, então isto chega por OTA, sem APK. E
  // ele é enviado SEMPRE, mesmo quando não há frase na tela — assim `diz:`
  // deixa de ser opcional, e a AUSÊNCIA dele passa a significar "o canal de
  // relato está quebrado", que é uma leitura que hoje não existe.
  let porqueSemSom = 'não pedido';

  let ultimaChave = 0;
  let gestoFeito = false;

  // O PIOR CASO, e não o instantâneo — porque o relato chega DEPOIS do defeito.
  //
  // As medidas da v5.156 são uma FOTOGRAFIA do instante em que o relato saiu, e
  // isso não responde a pergunta que o operador fez: "trava a cada 7 segundos".
  // Um travamento de dois segundos não deixa rastro nenhum numa amostra tirada
  // meio minuto depois — as bordas já se recompuseram, `rate` voltou a 100, a
  // fila esvaziou. Foi exatamente o que aconteceu com o log do primeiro culto:
  // ele é um cliente SAUDÁVEL, e não podia ser outra coisa, porque quem o
  // enviou não estava travando naquele milissegundo.
  //
  // Os cinco números abaixo acumulam entre relatos e sobrevivem à leitura: eles
  // transformam "trava" em "doze paradas, a pior de 2,4 s".
  const PARADA_MS = 1000;                 // o que já se lê como travamento
  let piorQuadro = -1;                    // maior intervalo entre quadros APRESENTADOS
  let parouQuadro = 0;                    // quantos passaram de PARADA_MS
  let piorCursor = 0;                     // maior intervalo com `currentTime` parado
  // A MENOR FOLGA JÁ VISTA é da SESSÃO, e só `comecar()` a zera.
  //
  // Ela vivia junto com o resto do pior caso, zerada em cada descontinuidade —
  // e a descontinuidade principal é o SALTO, que é exatamente a consequência do
  // que ela existe para mostrar. Em aparelho isso deu `11 salto(s)` ao lado de
  // `menor folga: +1614 ms`: um número tranquilizador medido só na janela
  // DEPOIS do último salto, sobre uma sessão que saltou onze vezes.
  let piorVfim = 99999;                   // menor folga vista até o fim do vídeo
  let piorAfim = 99999;                   // idem, do som
  let ultimoQuadroMs = 0;                 // quando o último quadro foi apresentado
  let abertoContado = false;              // a parada EM CURSO já entrou em `parouQuadro`?
  let houveQuadro = false;                // algum quadro já foi APRESENTADO nesta mídia?
  let ultimoCT = -1;
  let ultimoCTem = 0;
  let vfcArmado = false;
  let geracaoVfc = 0;

  // O TOTAL DA SESSÃO, que é o que responde "trava a cada 7 segundos".
  //
  // `piorQuadro`/`piorCursor` são o pior caso desde a última descontinuidade —
  // e a descontinuidade que mais interessa é justamente a que ENCERRA um
  // travamento (o salto). Sem um acumulador, todo travamento resolvido pelo
  // salto contribuía ZERO para a estatística. Estes quatro só zeram em
  // `comecar()`, e transformam "trava" em "23 paradas, 51 s no total".
  let travouMs = 0;
  let travouN = 0;
  let saltos = 0;                         // recuperações por SALTO_S (a borda abriu)
  let encalhes = 0;                       // recuperações por cursor FORA do buffer
  let encalhesSeguidos = 0;
  let podaSemChave = 0;                   // podas recusadas por falta de quadro-chave

  // A FOLGA DE UM `TimeRanges` COM BURACO — e é aqui que a v5.157 mentiu.
  //
  // Toda folga era medida contra `b.end(b.length - 1)`: o fim do ÚLTIMO
  // intervalo, que com um buraco é a borda de um bloco em que o cursor NEM
  // ESTÁ. O log de aparelho trouxe a contradição em estado puro — `readyState`
  // 2 ("sem dado adiante") convivendo com `vfim` de +3893 ms, que num buffer
  // contíguo é impossível. E `pv`/`pa` ("nunca ficou negativa") eram tautologia:
  // medidas contra o fim do último bloco, elas NÃO PODEM ser negativas enquanto
  // existir qualquer bloco à frente.
  const TOCA_S = 0.05;

  /**
   * Em qual intervalo do `buffered` o cursor está — ou `-1` se ele estiver num
   * buraco, antes do começo, ou depois do fim.
   *
   * Pura e exposta em `__espelho` pela mesma razão de `bordaViva`: provar isto
   * com um buraco de verdade exigiria uma sequência de fragmentos que o
   * Chromium do CI não monta, e a regra é aritmética.
   */
  function indiceNoCursor(b, t) {
    if (!b || !b.length) return -1;
    for (let i = 0; i < b.length; i++) {
      if (t >= b.start(i) - TOCA_S && t <= b.end(i) + TOCA_S) return i;
    }
    return -1;
  }

  /**
   * A folga HONESTA: quanto dado existe adiante do cursor NO BLOCO EM QUE ELE
   * ESTÁ. `null` = não há faixa nenhuma.
   *
   * Fora de qualquer bloco o número é NEGATIVO, que é o que o campo sempre
   * prometeu significar (ver o KDoc de `medidasDe` no Kotlin) e o que a
   * geometria anterior nunca produzia:
   *  - num buraco, é menos a distância até o dado voltar;
   *  - passado o fim de tudo, é a própria distância, já negativa.
   */
  function folgaDoCursor(b, t) {
    if (!b || !b.length) return null;
    const i = indiceNoCursor(b, t);
    if (i >= 0) return b.end(i) - t;
    for (let k = 0; k < b.length; k++) if (b.start(k) > t) return -(b.start(k) - t);
    return b.end(b.length - 1) - t;
  }

  // ZERAR É PARTE DA MEDIDA. Toda descontinuidade abaixo é NOSSA — o salto de
  // recuperação, a remontagem, a reconexão —, e contá-la como travamento faria
  // o número dizer "a tela parou 8 s" toda vez que ela se recuperou depressa.
  // O que sobra depois disso é só o que o operador de fato viu.
  function zerarPiores() {
    // FECHAR A MEDIDA ANTES DE APAGÁ-LA. Este ponto é chamado justamente pelo
    // salto que ENCERRA um travamento — e, até a v5.157, ele escrevia
    // `ultimoQuadroMs = Date.now()` antes de o quadro que fecharia o intervalo
    // chegar. Todo travamento resolvido pelo salto contribuía zero para `pq`, e
    // por isso a primeira linha que o operador lê dizia "maior parada: 0,3 s"
    // sobre uma tela que ele viu congelar por segundos.
    dobrarAberto();
    piorQuadro = -1;
    parouQuadro = 0;
    piorCursor = 0;
    // `piorVfim`/`piorAfim` NÃO entram aqui — ver a declaração deles. O evento
    // que zera o resto é o salto, e o salto é a consequência do que a folga
    // mínima existe para mostrar.
    ultimoQuadroMs = Date.now();
    abertoContado = false;
    ultimoCT = -1;
    ultimoCTem = Date.now();
  }

  /**
   * O intervalo EM ABERTO — o travamento que está acontecendo agora — entra na
   * medida sem esperar o quadro que o encerra.
   *
   * Sob guarda de `vfcArmado`, e a guarda não é detalhe: sem ela, uma TV que não
   * traga `requestVideoFrameCallback` deixaria de reportar `pq = -1` ("não
   * medida") e passaria a reportar "tempo desde que liguei" — trocar um
   * sentinela honesto por um número falso é pior que não medir.
   */
  function dobrarAberto() {
    if (!vfcArmado) return;
    // A ESPERA PELO PRIMEIRO QUADRO NÃO É UMA PARADA. Entre `comecar()` e o
    // primeiro quadro apresentado correm a conexão, o segmento de
    // inicialização e o primeiro fragmento — segundos, legitimamente. Contá-los
    // fazia toda sessão saudável nascer com "1 parada, 1,5 s", e, pior, o
    // incidente falso devolvia a folga adaptativa ao teto logo na partida.
    // Parada é intervalo ENTRE quadros; sem o primeiro não há intervalo.
    if (!houveQuadro) return;
    const aberto = Date.now() - ultimoQuadroMs;
    if (aberto > piorQuadro) piorQuadro = aberto;
    if (aberto > PARADA_MS && !abertoContado) {
      abertoContado = true;
      parouQuadro++;
      travouN++;
      travouMs += aberto;
    }
  }

  // O QUE MEDE O CONGELAMENTO É O QUADRO APRESENTADO, não o `currentTime`.
  //
  // `requestVideoFrameCallback` dispara uma vez por quadro que o compositor de
  // fato pintou: é a única medida que corresponde ao que a congregação vê. O
  // `currentTime` mente nos dois sentidos — ele anda com o elemento decodificando
  // e não apresentando, e para durante um seek que ninguém percebeu.
  //
  // Ele não existe em todo navegador (uma smart TV velha é o caso normal aqui),
  // e por isso `pq` vai `-1` em vez de zero: ausência de medida e medida zero
  // são leituras opostas. O `pc`, amostrado no compasso de 500 ms, continua
  // valendo nesse caso — mais grosso, e melhor que nada.
  // A GERAÇÃO existe pelo mesmo motivo da época das Promises da ponte: um
  // `requestVideoFrameCallback` pendente NÃO é cancelável de fato quando não
  // chegam quadros (é justamente o caso do congelamento), então um `parar()`
  // seguido de `comecar()` deixaria a corrente velha viva ao lado da nova —
  // duas correntes contando o mesmo intervalo duas vezes, e `nq` dobrado.
  function armarQuadros() {
    if (vfcArmado || !el.v || typeof el.v.requestVideoFrameCallback !== 'function') return;
    vfcArmado = true;
    geracaoVfc++;
    const minha = geracaoVfc;
    ultimoQuadroMs = Date.now();
    const passo = function () {
      if (minha !== geracaoVfc) return;
      const agora = Date.now();
      const gap = agora - ultimoQuadroMs;
      ultimoQuadroMs = agora;
      if (gap > piorQuadro) piorQuadro = gap;
      // A parada pode já ter sido contada com o intervalo em aberto (ver
      // `dobrarAberto`); contá-la de novo aqui dobraria `nq` e `tt`.
      if (houveQuadro && gap > PARADA_MS && !abertoContado) {
        parouQuadro++; travouN++; travouMs += gap;
      }
      houveQuadro = true;
      abertoContado = false;
      if (!vivo) { vfcArmado = false; return; }
      try { el.v.requestVideoFrameCallback(passo); } catch (_) { vfcArmado = false; }
    };
    try { el.v.requestVideoFrameCallback(passo); } catch (_) { vfcArmado = false; }
  }

  function amostrarPiores(vfimMs, afimMs) {
    // O intervalo EM ABERTO entra a cada compasso: um travamento em curso é
    // visível ANTES de o quadro que o encerra chegar.
    dobrarAberto();
    if (vfimMs !== null && vfimMs < piorVfim) piorVfim = vfimMs;
    if (afimMs !== null && afimMs < piorAfim) piorAfim = afimMs;
    // O CURSOR PARADO só conta com o elemento TOCANDO: pausado (antes do
    // posicionamento, ou com o gesto pendente) ele fica parado de direito, e
    // contá-lo aqui encheria a medida de travamentos que ninguém viu.
    const agora = Date.now();
    const t = el.v.currentTime;
    if (el.v.paused || !posicionado) { ultimoCT = t; ultimoCTem = agora; return; }
    if (t !== ultimoCT) { ultimoCT = t; ultimoCTem = agora; return; }
    const parado = agora - ultimoCTem;
    if (parado > piorCursor) piorCursor = parado;
  }

  /**
   * Há quanto tempo o `currentTime` não anda — 0 quando ele acabou de andar.
   *
   * Lida DEPOIS de `amostrarPiores` no mesmo giro, ela é a diferença entre "o
   * cursor está fora do buffer" e "o cursor está PARADO fora do buffer", e essa
   * diferença é o que a v5.158 não fez: o Chromium pula buraco pequeno sozinho
   * (é o `gap jumping` dele), e um cursor que atravessa um buraco de 100 ms
   * ANDANDO não precisa de socorro nenhum. Socorrê-lo custa um `currentTime`
   * escrito — que estala, esvazia o decodificador e conta quadro descartado. Em
   * aparelho isso deu dez saltos por minuto e 13,7% de quadros perdidos, onde a
   * v5.157 tinha 1,6%.
   */
  /**
   * O incidente devolve a folga ao teto, de uma vez.
   *
   * Assimétrico de propósito: descer é um degrau de 100 ms a cada trecho limpo
   * de oito segundos, subir é imediato. Subir devagar depois de um travamento
   * seria travar de novo enquanto a folga se reconstrói — a mesma razão pela
   * qual a ETA do download cai rápido e sobe devagar, com o sinal invertido
   * porque aqui o número que dói é o outro.
   */
  function recuarAlvo() {
    alvoS = ALVO_MAX;
    calmaDesde = Date.now();
  }

  function cursorParadoMs() {
    if (!posicionado || el.v.paused) return 0;
    return el.v.currentTime === ultimoCT ? Date.now() - ultimoCTem : 0;
  }

  const conta = { quadros: 0, bytes: 0, recomecos: 0, reconexoes: 0, quadrosAudio: 0 };
  let acesaDesde = Date.now();
  let acesaMs = 0;

  // --------------------------------------------------------------------------
  // Utilidades
  // --------------------------------------------------------------------------

  function dormir(ms2) { return new Promise((r) => setTimeout(r, ms2)); }

  function texto(id, s, ruim) {
    const e = el[id];
    if (!e) return;
    e.textContent = s || '';
    e.classList.toggle('ruim', !!ruim);
  }

  // O ESTADO DESENHADO. Com o celular do outro lado do salão, esta linha é a
  // única resposta possível para "por que a tela está preta?" — e por isso ela
  // diz a CAUSA, não "erro".
  function avisar(s, ruim) {
    texto('aviso', s, ruim);
    if (el.aviso) el.aviso.classList.toggle('some', !ruim && !s);
    // A frase que apareceu aqui vale mais no Registro do operador do que nesta
    // tela: quem está com o celular na mão é quem pode agir. `relatar` só
    // envia quando ela de fato muda.
    try { relatar(); } catch (_) { /* antes do token não há para onde mandar */ }
  }

  // A FRASE DO SOM É PEGAJOSA, e as outras não. Toda conexão bem-sucedida
  // limpa o aviso (`avisar('')`), porque o que ele carregava era "sem sinal" —
  // um evento. "Esta tela está sem som" é um ESTADO: some junto no primeiro
  // reconecte e o visitante nunca fica sabendo por que não ouve nada. Guardá-la
  // aqui é o que faz ela voltar depois de cada limpeza.
  let avisoSom = '';

  function semSom(frase) {
    avisoSom = frase || '';
    avisar(avisoSom);
  }

  // O "limpar a tela" de sempre, que agora repõe o estado do som por baixo.
  function limparAviso() {
    avisar(avisoSom);
  }

  // `sessionStorage` pode LANÇAR (modo privado de alguns navegadores, cota
  // zerada por política corporativa). Um espelho que não abre porque o
  // armazenamento é hostil seria um defeito gratuito: sem ele o token vive só
  // na memória desta aba, que é quase a mesma coisa.
  function guardado(v) {
    try {
      if (v === undefined) return global.sessionStorage.getItem(CHAVE) || '';
      if (v) global.sessionStorage.setItem(CHAVE, v);
      else global.sessionStorage.removeItem(CHAVE);
    } catch (_) { /* memória só */ }
    return v || '';
  }

  function minutosAcesa() {
    const agora = doc.visibilityState === 'visible' ? Date.now() - acesaDesde : 0;
    return Math.round((acesaMs + agora) / 60000);
  }

  function temMediaSource() {
    return typeof (global.ManagedMediaSource || global.MediaSource) === 'function';
  }

  function suporta(m) {
    const MS = global.ManagedMediaSource || global.MediaSource;
    try { return !!MS && MS.isTypeSupported(m); } catch (_) { return false; }
  }

  // Fluxos de `fetch`. Numa TV velha isto é `false`, e aí NADA funciona — nem o
  // modo imagem, que usa o MESMO transporte (§3.11, invariante 12). O cliente
  // se relata assim mesmo, porque é esse relato que responde, no Registro do
  // operador e sem ninguém abrir console numa TV, qual navegador aquela TV tem.
  function temFluxo() {
    try {
      return typeof global.ReadableStream === 'function'
        && !!global.Response && 'body' in global.Response.prototype;
    } catch (_) { return false; }
  }

  // §5.5 — uma vez no pareamento, e depois a cada 5 min como `alive`.
  function relato() {
    return {
      ua: (global.navigator.userAgent || '').slice(0, UA_MAX),
      w: (global.screen && global.screen.width) | 0,
      h: (global.screen && global.screen.height) | 0,
      seguro: !!global.isSecureContext,
      mse: temMediaSource(),
      mms: typeof global.ManagedMediaSource === 'function',
      fetchStream: temFluxo(),
      // As duas linhas abaixo NOMEIAM APIs de contexto seguro sem chamá-las: em
      // `http://` as duas vêm `undefined` e o relato registra `false`, que é
      // exatamente o dado que o operador precisa ver. A guarda está na mesma
      // linha de propósito — ela é o que diz que isto é detecção, não uso.
      videoDecoder: !!global.isSecureContext && typeof global.VideoDecoder === 'function',
      wakeLock: !!global.isSecureContext && !!(global.navigator.wakeLock),
      telaAcesaMin: minutosAcesa(),
    };
  }

  async function postar(rota, corpo, comToken) {
    const cab = { 'Content-Type': 'application/json' };
    if (comToken && token) cab.Authorization = 'Bearer ' + token;
    const r = await fetch(rota, {
      method: 'POST', headers: cab, cache: 'no-store', body: JSON.stringify(corpo),
    });
    let json = null;
    try { json = await r.json(); } catch (_) { json = null; }
    return { status: r.status, corpo: json };
  }

  // --------------------------------------------------------------------------
  // PAREAMENTO (§5.4) — o operador fica no laço, e é ele quem aprova
  // --------------------------------------------------------------------------

  // ---- O QR: quem MOSTRA é esta tela, e quem LÊ é o celular ----------------
  //
  // A inversão é o recurso inteiro. No PIN, o celular exibia um segredo curto
  // durante todo o culto e alguém o digitava aqui — num teclado de controle
  // remoto, do outro lado do salão. Aqui esta página pede um `id` de espera,
  // desenha, e espera a câmera do operador. O `id` NÃO é segredo (o servidor o
  // devolve a quem pedir): o que autoriza é o operador ter apontado a câmera
  // para ESTA tela, que é a mesma decisão que ele já tomava na folha.
  //
  // O prefixo `AVE1:` existe para o app poder RECUSAR um QR qualquer — um
  // cartaz, uma nota fiscal, o Wi-Fi da igreja — em vez de mandar um texto
  // aleatório como id de aprovação.
  const QR_PREFIXO = 'AVE1:';
  // A espera do servidor vence em 5 min; o desenho é refeito antes disso para
  // nunca haver um QR em cartaz que já não vale. Um código que "não funciona"
  // sem dizer por quê é o pior desfecho possível para este recurso.
  const QR_RENOVA_MS = 4 * 60 * 1000;
  // E a espera entre tentativas quando o pedido falha (espelho ainda subindo,
  // rede associando). Curta: é a primeira coisa que acontece na tela.
  const QR_RETENTA_MS = 4000;

  let qrVivo = false;
  let qrId = '';

  function mostrarQr(id) {
    qrId = id || '';
    if (!el.qrBox || !el.qr) return;
    if (!qrId || !global.AVQr) { el.qrBox.hidden = true; return; }
    try {
      // As cores do QR são as do PALCO (preto sobre branco), e não as da
      // paleta: contraste máximo é requisito de leitura, não escolha de estilo.
      // É a mesma exceção que `--stage-text: #fff` já declara.
      global.AVQr.pintar(el.qr, QR_PREFIXO + qrId, '#000000', '#ffffff');
      el.qrBox.hidden = false;
    } catch (_) {
      el.qrBox.hidden = true;
    }
  }

  /**
   * O laço do QR: pede uma espera, desenha, enquete a aprovação, e renova antes
   * de a espera vencer. Roda até alguém entrar (por aqui ou pelo PIN).
   *
   * Ele NÃO desabilita o campo do PIN nem compete com ele: os dois caminhos
   * criam esperas independentes, e a primeira que for aprovada ganha. Quem
   * cancela o outro é o `qrVivo`, conferido depois de cada `await`.
   */
  async function cicloQr() {
    if (qrVivo || !el.qrBox) return;
    qrVivo = true;
    while (qrVivo) {
      let r;
      try {
        const corpo = relato();
        corpo.qr = true;
        r = await postar('/par', corpo, false);
      } catch (_) { r = { status: 0 }; }
      if (!qrVivo) return;

      if (!(r.status === 202 && r.corpo && r.corpo.espera)) {
        // Sem QR, a tela ainda tem o PIN — e precisa DIZER isso, porque um
        // espaço vazio onde deveria haver um código não explica nada.
        mostrarQr('');
        if (el.pinBox) el.pinBox.open = true;
        texto('parMsg', 'O código não pôde ser gerado agora. Use os seis dígitos abaixo.');
        await dormir(QR_RETENTA_MS);
        continue;
      }

      const id = String(r.corpo.espera);
      mostrarQr(id);
      texto('parMsg', 'Esperando a leitura no celular…');
      const ate = Date.now() + QR_RENOVA_MS;
      let entrou = false;
      while (qrVivo && Date.now() < ate) {
        await dormir(POLL_MS);
        if (!qrVivo) return;
        let p;
        try { p = await postar('/par', { espera: id }, false); } catch (_) { p = { status: 0 }; }
        if (p.status === 200 && p.corpo && p.corpo.t) {
          token = String(p.corpo.t);
          guardado(token);
          entrou = true;
          break;
        }
        // 403 aqui é o operador tendo RECUSADO esta tela, ou a espera vencida.
        // Nos dois casos a resposta certa é pedir um código novo, não desistir:
        // esta página é uma TV que ninguém vai atender, e ela precisa continuar
        // oferecendo uma forma de entrar.
        if (p.status === 403) break;
      }
      if (entrou) { pararQr(); aoPlayer(); return; }
    }
  }

  function pararQr() {
    qrVivo = false;
    qrId = '';
    if (el.qrBox) el.qrBox.hidden = true;
  }

  async function parear() {
    const pin = (el.pin.value || '').replace(/[^0-9]/g, '');
    if (pin.length !== 6) { texto('parMsg', 'São seis dígitos.', true); return; }
    el.parBtn.disabled = true;
    texto('parMsg', 'Enviando…');
    let r;
    try {
      const corpo = relato();
      corpo.pin = pin;
      r = await postar('/par', corpo, false);
    } catch (_) {
      // A causa quase sempre é a rede, não o código. Dizer isso poupa o
      // visitante de digitar o PIN mais três vezes.
      texto('parMsg', 'Não foi possível falar com o celular. Confira a rede e tente de novo.', true);
      el.parBtn.disabled = false;
      return;
    }
    if (r.status === 202 && r.corpo && r.corpo.espera) {
      await aguardar(String(r.corpo.espera));
      return;
    }
    // O servidor responde 403 tanto para PIN errado quanto para origem
    // bloqueada por tentativas (§3.5, invariante 6). A mensagem cobre os dois
    // sem afirmar qual é — e é o servidor que decide se ainda aceita.
    texto('parMsg', 'Código não confere. Confira o número na tela do celular.', true);
    el.parBtn.disabled = false;
  }

  async function aguardar(id) {
    texto('parMsg', 'Aguardando a aprovação no celular…');
    const ate = Date.now() + POLL_LIMITE;
    for (;;) {
      await dormir(POLL_MS);
      let r;
      try { r = await postar('/par', { espera: id }, false); } catch (_) { r = { status: 0 }; }
      if (r.status === 200 && r.corpo && r.corpo.t) {
        token = String(r.corpo.t);
        guardado(token);
        pararQr();
        aoPlayer();
        return;
      }
      if (r.status === 403) {
        texto('parMsg', 'A tela não foi liberada.', true);
        el.parBtn.disabled = false;
        return;
      }
      if (Date.now() > ate) {
        texto('parMsg', 'Ninguém respondeu no celular. Tente de novo.', true);
        el.parBtn.disabled = false;
        return;
      }
    }
  }

  function aoPareamento(motivo) {
    parar();
    el.play.hidden = true;
    el.par.hidden = false;
    doc.body.classList.remove('projetando');
    el.parBtn.disabled = false;
    el.pin.value = '';
    if (motivo) texto('parMsg', motivo, true);
    // O QR volta ao ar SEM esperar toque: uma tela que caiu (sessão vencida,
    // espelho desligado e religado) é justamente a que ninguém está olhando —
    // e a que o operador vai querer readmitir apontando a câmera de novo.
    pararQr();
    cicloQr();
  }

  function aoPlayer() {
    el.par.hidden = true;
    el.play.hidden = false;
    avisar('Conectando…');
    comecar();
  }

  // --------------------------------------------------------------------------
  // A MÍDIA — `MediaSource`, fila de append serializada, poda, borda
  //
  // ## AS DUAS `SourceBuffer` NASCEM JUNTAS, E ISSO GOVERNA O RESTO
  //
  // Não é escolha de estilo: **o Chromium recusa `addSourceBuffer` depois que a
  // `MediaSource` inicializou** (o `ChunkDemuxer` só aceita ids novos enquanto
  // está esperando os segmentos de inicialização; depois disso vem
  // `QuotaExceededError`). É por isso que hls.js e o Shaka criam todas as
  // faixas de uma vez. Daí as três consequências que o código abaixo carrega:
  //
  //  1. quando esta tela ainda não pediu som, a `MediaSource` nasce **só com
  //     vídeo** — e é o caso da maioria das telas, que ficam mudas por decisão
  //     (§3.11, invariante 10);
  //  2. o gesto que liga o som **remonta** a `MediaSource` uma vez. Pisca, e
  //     pisca no instante exato em que o visitante tocou na tela esperando algo
  //     acontecer;
  //  3. numa conexão em que o som JÁ é querido, o `csd` de vídeo fica RETIDO
  //     por até `ESPERA_CSD_AUDIO_MS` esperando o de áudio, porque os dois
  //     precisam estar em mãos antes do primeiro `appendBuffer`.
  //
  // E o outro lado da mesma moeda, que é o que mantém a falha segura do §3.9:
  // a MSE só toca quando **todas** as faixas têm dado no instante atual, então
  // uma faixa de som que pare de receber **para a imagem**. Quem impede isso é
  // o vigia de [soltarAudio] — sem som é ruim, sem imagem é o culto.

  // A `MediaSource` SOBREVIVE ÀS RECONEXÕES, e isso não é economia: o carimbo
  // de tempo do fio é absoluto (base do PROCESSO do celular, §5.2), então
  // depois de uma queda o fluxo continua na MESMA linha do tempo. Recriá-la a
  // cada reconexão jogaria fora o passado e piscaria a tela à toa; mantendo-a,
  // o quadro que o muxer reteve antes da queda é fechado com a duração real do
  // buraco e o `buffered` continua sendo um intervalo só.
  //
  // [infoA] é o descritor da faixa de som, ou `null` — e `null` é o caminho
  // normal: quem não pediu som não ganha faixa de som.
  function abrirMidia(infoV, infoA) {
    if (ms) {
      // Reconexão: o `csd` chega de novo em toda conexão (§5.3). Reenviar o
      // segmento de inicialização é legal em MSE e é o que mantém a
      // `SourceBuffer` viva do outro lado de uma troca de encoder.
      if (infoV.mime === mime) {
        // MAS UMA TELA QUE PEDIU SOM E NÃO TEM FAIXA NÃO PODE SEGUIR ASSIM.
        // Reusar a `MediaSource` muda é condená-la a ficar muda pelo resto da
        // sessão — o Chromium recusa `addSourceBuffer` depois da
        // inicialização, então a faixa não pode ser acrescentada depois. E o
        // pior: em silêncio. Foi este o caminho que produziu
        // `som torneira:sim faixa:nao` em aparelho, com o servidor entregando
        // AAC e a tela sem por onde recebê-lo.
        //
        // O teto de [REBUILDS_AUDIO] é o mesmo do gesto, e pelo mesmo motivo:
        // a projeção nunca pisca mais que isso por causa do som.
        if (audioQuerido && !sbA) {
          if (rebuilds < REBUILDS_AUDIO) {
            rebuilds++;
            // PRAZO NOVO PARA UMA TENTATIVA NOVA — ver `tentarSom`.
            esperaAudioAte = 0;
            porqueSemSom = 'remontando na reconexão (' + rebuilds + '/' + REBUILDS_AUDIO + ')';
            recomecar('Ligando o som', true);
            return;
          }
          // Teto batido: a tela segue muda, e agora DIZ isso. Um silêncio que
          // se explica é um estado; um silêncio mudo é um defeito escondido.
          porqueSemSom = 'teto de remontagens batido — segue muda';
          semSom('Esta tela ficou sem som e não vai voltar nesta sessão.');
        }
        enfileirar(infoV.bytes, false);
        return;
      }
      // Mime diferente é resolução/perfil trocados — proibido durante a sessão
      // (§3.2, invariante 3). Se acontecer, recomeçar é a única saída honesta.
      recomecar('o formato do vídeo mudou');
      return;
    }
    if (!temMediaSource()) {
      avisar('Este navegador não sabe receber vídeo ao vivo. Peça o modo imagem.', true);
      return;
    }
    if (!suporta(infoV.mime)) {
      // Acontece de verdade: o Chromium de código aberto (o do CI, e o de
      // algumas TVs) não traz H.264. Dizer QUAL é o formato é o que transforma
      // "não funciona" num pedido concreto.
      avisar('Este navegador não decodifica ' + infoV.codec + '. Peça o modo imagem.', true);
      return;
    }
    // UM NAVEGADOR PODE TER O VÍDEO E NÃO O ÁUDIO. Nesse caso o som cai fora
    // AQUI, antes de existir faixa nenhuma — nunca depois, que é quando ele
    // levaria a imagem junto.
    let som = infoA;
    if (som && !suporta(som.mime)) {
      porqueSemSom = 'o navegador não decodifica ' + som.codec;
      semSom('Esta tela fica sem som: o navegador não decodifica ' + som.codec + '.');
      som = null;
    }
    mime = infoV.mime;
    mimeA = som ? som.mime : '';
    const MS = global.ManagedMediaSource || global.MediaSource;
    ms = new MS();
    // `disableRemotePlayback` e os dois eventos abaixo são o que o
    // `ManagedMediaSource` do iOS 17+ exige para sequer começar — e no resto
    // dos navegadores não custam nada (§3.11, invariante 7).
    try { el.v.disableRemotePlayback = true; } catch (_) {}
    ms.addEventListener('startstreaming', () => { aplicar(); });
    ms.addEventListener('endstreaming', () => {});
    ms.addEventListener('sourceopen', function () {
      try {
        sbV = prepararBuffer(mime, false);
      } catch (e) {
        avisar('Não deu para preparar o vídeo (' + ((e && e.message) || '?') + ').', true);
        return;
      }
      if (som) {
        try {
          sbA = prepararBuffer(som.mime, true);
          audioDesde = Date.now();
          audioUltimoMs = 0;
          porqueSemSom = 'faixa aberta, esperando o primeiro AAC';
          esperaAudioAte = 0;
        } catch (e) {
          // O SOM CAI SOZINHO, e a imagem segue. É a falha segura inteira numa
          // linha: nada aqui derruba a `MediaSource` que já tem vídeo.
          sbA = null;
          mimeA = '';
          som = null;
          porqueSemSom = 'o navegador recusou a faixa (' + ((e && e.name) || '?') + ')';
          semSom('Esta tela ficou sem som (' + ((e && e.name) || '?') + ').');
        }
      }
      // OS DOIS `appendBuffer` SÓ AGORA: enquanto os dois ids não tiverem
      // recebido o segmento de inicialização, a `MediaSource` não inicializa —
      // e enfileirar o vídeo antes de o `addSourceBuffer` do som ter acontecido
      // seria correr contra isso à toa.
      enfileirar(infoV.bytes, false);
      if (som) enfileirar(som.bytes, true);
      aplicar();
    }, { once: true });
    el.v.src = URL.createObjectURL(ms);
  }

  // O `error` de um `SourceBuffer` é um evento NU: por especificação ele não
  // carrega motivo nenhum, e "o decodificador recusou os dados" é uma
  // CATEGORIA, não um diagnóstico — ela não distingue um fragmento malformado
  // de um perfil de H.264 que aquele aparelho não decodifica, e as duas têm
  // correções opostas.
  //
  // Quem carrega o motivo é o `MediaError` do `<video>`: o Chromium preenche o
  // `message` dele com a frase do demuxer ("Append: stream parsing failed",
  // "Unsupported...", o offset onde o parse morreu). Ela nunca era lida porque
  // ninguém abre console numa TV — e agora ela viaja até o Registro do
  // operador junto com o resto do relato da tela.
  // E a ORDEM não é garantida: o `error` do `SourceBuffer` pode chegar ANTES de
  // o `<video>` ter o `MediaError` preenchido. Por isso o motivo é lembrado —
  // e o `error` do próprio elemento, que é onde ele de fato mora, completa a
  // frase depois, quando ela tiver saído sem detalhe.
  let ultimoErroMidia = '';

  function porqueDaMidia() {
    const e = el.v && el.v.error;
    if (e) {
      const detalhe = (e.message || '').slice(0, 70);
      ultimoErroMidia = ' [' + (e.code || '?') + (detalhe ? ': ' + detalhe : '') + ']';
    }
    return ultimoErroMidia;
  }

  // Recusas SEGUIDAS do decodificador, sem um trecho longo entre elas. Ver
  // `laco`: é este contador que transforma um martelo de três em três segundos
  // numa escada que diz o que está acontecendo.
  //
  // O martelo é o defeito, não o sintoma: um `recomecar` por recusa zera a
  // espera de reconexão (`tentativa = 0`) de propósito, porque uma recusa
  // isolada merece voltar rápido. Só que uma recusa que se REPETE não é
  // isolada — e voltar rápido dezenas de vezes seguidas martela o AP da igreja,
  // enche o Registro e não conserta nada, enquanto a tela pisca a cada três
  // segundos na frente de quem está assistindo.
  let recusasSeguidas = 0;
  let quadrosDesdeRecusa = 0;
  // Como terminou a ÚLTIMA conexão. Vai no relato junto com o ramo do som: as
  // duas perguntas do espelho hoje são "por que esta tela está muda?" e "por
  // que ela reconecta?", e a segunda não tinha resposta nenhuma.
  let ultimoFim = '';
  // ~13 s a 9 fps. É "esta tela está de fato projetando", não "chegou um
  // quadro".
  const QUADROS_SAUDAVEL = 120;
  // A partir daqui a espera curta acaba e a frase passa a nomear o estado.
  const RECUSAS_ATE_ESCADA = 3;

  function prepararBuffer(tipo, ehAudio) {
    const b = ms.addSourceBuffer(tipo);
    // `segments`, NUNCA `sequence`: nossos fragmentos carregam o `tfdt`
    // absoluto do relógio mestre, e `sequence` mandaria o navegador
    // inventar os tempos — destruindo de graça a sincronia que a
    // `MediaSource` existe para dar.
    b.mode = 'segments';
    b.addEventListener('updateend', aoTerminar);
    b.addEventListener('error', function () {
      // Um erro NA FAIXA DE SOM não pode derrubar a projeção — solta-se o som.
      // Na de imagem não há o que salvar, e recomeçar limpo é a saída.
      if (ehAudio) { soltarAudio('o decodificador recusou o som' + porqueDaMidia()); return; }
      recusasSeguidas++;
      recomecar('o decodificador recusou os dados' + porqueDaMidia());
    });
    return b;
  }

  function enfileirar(bytes, ehAudio) {
    fila.push({ b: bytes, a: !!ehAudio });
    if (fila.length > FILA_MAX) { recomecar('esta tela não está dando conta do fluxo'); return; }
    aplicar();
  }

  // A FILA SERIALIZADA. `appendBuffer` com `updating === true` lança
  // `InvalidStateError` (spec MSE) — e `remove()` disputa o mesmo estado. O
  // idioma já existe na casa (`shared/mse.js`, `f.ocupada` + `aplicar()`); o
  // que muda aqui é que a poda entra na MESMA fila, senão ela e o append se
  // atropelam no primeiro `QuotaExceededError`.
  //
  // Com duas faixas a fila continua sendo UMA, e uma operação em voo por vez —
  // não duas em paralelo, uma por buffer. Cada item sabe o próprio destino, a
  // ordem de chegada é preservada, e o `updateend` de qualquer um dos dois cai
  // no mesmo lugar sem ambiguidade sobre o que acabou.
  function aplicar() {
    if (!sbV || emVoo || !ms || ms.readyState !== 'open') return;
    if (podaPedida) {
      podaPedida = false;
      if (podar(cotaSeguidas > 0)) return;
    }
    while (fila.length) {
      const it = fila[0];
      const alvo = it.a ? sbA : sbV;
      // O destino sumiu (a faixa de som foi solta): o item vai fora. Segurá-lo
      // travaria a fila inteira, e com ela a imagem.
      if (!alvo) { fila.shift(); continue; }
      if (alvo.updating) return;
      emVoo = { tipo: 'append', a: it.a };
      try {
        alvo.appendBuffer(it.b);
      } catch (e) {
        emVoo = null;
        // `QuotaExceededError` é ESPERADO, não é falha: o MSE tem cota e um
        // fluxo infinito a atinge por construção. A resposta é podar o passado
        // e tentar o MESMO buffer de novo — ele continua na cabeça da fila.
        if (e && e.name === 'QuotaExceededError') {
          cotaSeguidas++;
          podaPedida = true;
          // Poda que não libera nada três vezes seguidas significa que não há
          // passado a podar (o cursor ainda está no começo). Insistir seria um
          // laço quente; recomeçar limpo é a saída.
          if (cotaSeguidas > 3) { recomecar('a memória de vídeo deste navegador encheu'); return; }
          aplicar();
          return;
        }
        recomecar('o navegador recusou os dados (' + ((e && e.name) || '?') + ')');
      }
      return;
    }
  }

  function aoTerminar() {
    const era = emVoo;
    emVoo = null;
    if (era && era.tipo === 'append') { fila.shift(); cotaSeguidas = 0; }
    posicionar();
    aplicar();
  }

  function faixaDe(alvo) {
    if (!alvo) return null;
    try {
      const b = alvo.buffered;
      return b && b.length ? b : null;
    } catch (_) { return null; }
  }

  // O ANEL DOS QUADROS-CHAVE — o que a poda precisa saber e não sabia.
  //
  // `remove(a, b)` da MSE apaga o intervalo pedido E CONTINUA até o próximo
  // ponto de acesso aleatório (senão sobrariam deltas sem a chave de que
  // dependem). Cortar num ponto qualquer é, portanto, pedir ao navegador que
  // decida sozinho até onde ir — e num GOP de ~19 s (ver `JANELA_S`) esse
  // "sozinho" pode passar por cima do PRESENTE.
  //
  // O cliente não precisa supor onde estão as chaves: ele as VÊ passar no fio
  // (`q.chave`, §5.3). Guardar os últimos carimbos custa um anel de 64 números
  // e transforma a poda numa operação com destino conhecido.
  const CHAVES_MAX = 64;
  const chaves = [];

  let ultimaChavePoda = 0;

  /** O começo da janela viva do vídeo — quanto PASSADO está guardado. */
  function faixaInicio() {
    const b = faixaDe(sbV);
    return b ? b.start(0) : el.v.currentTime;
  }

  function anotarChave(ptsUs) {
    chaves.push(ptsUs / 1e6);
    if (chaves.length > CHAVES_MAX) chaves.shift();
  }

  /** O maior carimbo de quadro-chave em `chaves` que seja ≤ [t]; `null` se não
   *  houver nenhum — e aí a poda DESISTE, em vez de cortar no escuro. */
  function chaveAte(t) {
    let melhor = null;
    for (let i = 0; i < chaves.length; i++) {
      if (chaves[i] <= t && (melhor === null || chaves[i] > melhor)) melhor = chaves[i];
    }
    return melhor;
  }

  // Uma poda por giro, na faixa que precisar — as duas entram na mesma fila
  // serializada, e o compasso de meio segundo dá conta das duas de sobra.
  function podar(agressiva) {
    const pedido = el.v.currentTime - (agressiva ? GUARDA_S : JANELA_S);
    // O CORTE CAI NUMA CHAVE, sempre — assim o "próximo ponto de acesso
    // aleatório" que o algoritmo da MSE persegue é exatamente o ponto onde
    // paramos, e a remoção não avança um quadro além do pedido.
    //
    // Um FIO antes dela, não em cima. O algoritmo da MSE
    // procura o primeiro ponto de acesso aleatório ≥ `end`: mirando o carimbo
    // exato, qualquer arredondamento para cima faria a busca pular para a chave
    // SEGUINTE — e voltaríamos a apagar o presente, só que mais raramente, que
    // é o pior tipo de defeito. O timescale do vídeo aqui é 1 µs (o carimbo
    // entra verbatim, ver `fmp4.js`), então 50 ms é folga de sobra.
    const chave = chaveAte(pedido);
    const limite = chave === null ? null : chave - TOCA_S;
    if (limite === null) {
      // Sem chave conhecida antes do ponto pedido, não há corte seguro. A
      // janela cresce por mais um giro — memória é barata, projeção não é.
      podaSemChave++;
      // E SE ELA CONTINUAR CRESCENDO, PEÇA UMA CHAVE. Em aparelho a janela
      // chegou a 25,6 s com 65 podas recusadas seguidas, porque o GOP real
      // numa cena parada é maior que a janela: `KEY_I_FRAME_INTERVAL` vira
      // CONTAGEM DE QUADROS (5 s × `KEY_FRAME_RATE` 30 = 150) e o produtor
      // entrega ~9 quadros por segundo — uma chave a cada ~16 s.
      //
      // O cliente não precisa esperar: o caminho de pedir IDR já existe e já é
      // usado a cada conexão (`POST /r {do:'key'}`). Pedir aqui fecha o laço
      // pelo lado que chega por OTA, e sozinho basta — a correção do intervalo
      // no encoder é o conserto estrutural, mas ela exige instalar o APK.
      const agoraMs = Date.now();
      if (el.v.currentTime - faixaInicio() > JANELA_S * 1.5
          && agoraMs - ultimaChavePoda > CHAVE_PODA_MS) {
        ultimaChavePoda = agoraMs;
        pedirChave();
      }
      return false;
    }
    const alvos = [sbV, sbA];
    for (let i = 0; i < alvos.length; i++) {
      const alvo = alvos[i];
      if (!alvo || alvo.updating) continue;
      const b = faixaDe(alvo);
      if (!b) continue;
      if (!(limite > b.start(0) + 0.05)) continue;
      try {
        emVoo = { tipo: 'remove', a: alvo === sbA };
        alvo.remove(0, limite);
        // SEGUIDAS, e não acumuladas. Um cliente que acabou de nascer (ou de
        // recomeçar) passa ~17 s sem chave conhecida antes do ponto de corte,
        // e a ~2 podas por segundo isso sozinho marcava 46 no Registro de uma
        // sessão inteiramente saudável — um número grande que não queria dizer
        // nada. Zerado no primeiro corte bem-sucedido, ele volta a significar
        // "a poda está ENCALHADA agora".
        podaSemChave = 0;
        return true;
      } catch (_) { emVoo = null; }
    }
    return false;
  }

  // O POSICIONAMENTO INICIAL — e ele NÃO é a perseguição da borda.
  //
  // O `tfdt` do fio é absoluto: uma tela que entra 40 minutos depois de o
  // espelho ligar recebe fragmentos que começam em t = 2400 s. O elemento nasce
  // em `currentTime = 0`, que não está em intervalo bufferizado nenhum — e um
  // `<video>` fora do buffer não toca, não erra e não avisa. Um posicionamento,
  // uma vez, é a única forma de entrar na linha do tempo. Rebasear o carimbo no
  // cliente seria a alternativa, e ela custaria uma SEGUNDA linha do tempo para
  // reconciliar em toda reconexão — que é justamente o que o §2.2 recusa.
  //
  // COM SOM, O PONTO É O MAIS TARDE DOS DOIS. O áudio começa a chegar depois da
  // imagem (ele passa por um `POST` de ida e volta), então o começo da faixa de
  // som é POSTERIOR ao da imagem — e um `currentTime` antes dele deixaria a
  // faixa de som sem dado no instante atual: a MSE não toca, o cursor não anda,
  // e como o cursor não anda ele nunca alcança o som. Trava para sempre, sem
  // erro nenhum. Entrar pelo mais tarde dos dois é o que fecha essa porta.
  function posicionar() {
    if (posicionado || !sbV) return;
    const bv = faixaDe(sbV);
    if (!bv) return;
    let ini = bv.start(0);
    if (sbA) {
      const ba = faixaDe(sbA);
      // Sem som ainda: ESPERAR. Quem desiste é o vigia de [soltarAudio], e ele
      // desiste com prazo — não aqui, calado.
      if (!ba) return;
      ini = Math.max(ini, ba.start(0));
    }
    posicionado = true;
    // E O PONTO DE ENTRADA É A BORDA AO VIVO, não o começo do buffer.
    //
    // Entrar em `ini` põe o cursor no ponto MAIS ANTIGO que as duas faixas
    // têm — e quando a conexão já trouxe alguns segundos, isso são alguns
    // segundos de atraso a recuperar. O `borda()` seguinte via `atraso` acima
    // de `SALTO_S` e saltava: em aparelho, DOIS saltos nos primeiros 43 s de
    // uma sessão sem defeito nenhum. Cada salto é contado como incidente e
    // devolve a folga adaptativa ao teto (ver `recuarAlvo`), então o
    // transitório de partida impedia justamente a convergência que a v5.160
    // existe para dar.
    //
    // `Math.max(ini, …)` mantém a regra de cima intacta: com pouca coisa
    // bufferizada o alvo cai antes de `ini` e o comportamento é o de sempre.
    const fim = bordaViva(bv, sbA ? faixaDe(sbA) : null);
    const entrada = Math.max(ini, Math.min(fim - alvoS, fim - TOCA_S));
    try { el.v.currentTime = entrada; } catch (_) {}
    tocar();
  }

  // O VIGIA DO SOM. Duas perguntas, a mesma resposta.
  //
  // Ele existe porque a MSE não toca sem dado em TODAS as faixas: um grafo de
  // áudio que caiu no celular (contexto suspenso, WebView remontado, encoder
  // AAC solto) congelaria a IMAGEM em três telas da igreja. Soltar a faixa de
  // som devolve a imagem na hora, e o cliente DIZ que ficou sem som — nunca
  // fica quieto, porque "sem som" e "travado" são a mesma tela preta para quem
  // está olhando.
  function vigiarAudio() {
    if (!sbA || !ms || ms.readyState !== 'open') return;
    const agora = Date.now();
    const ba = faixaDe(sbA);
    if (!ba) {
      // Faixa aberta que nunca recebeu um quadro: o `csd` veio e o áudio não.
      if (audioDesde && agora - audioDesde > AUDIO_MUDO_MS) soltarAudio('o som não chegou');
      return;
    }
    if (audioUltimoMs && agora - audioUltimoMs > AUDIO_MUDO_MS) {
      soltarAudio('o som parou de chegar');
      return;
    }
    // O TETO DE REMONTAGENS SE RENOVA depois de um trecho longo com som
    // chegando — mesma regra do `recusasSeguidas` do decodificador, e pelo
    // mesmo motivo.
    //
    // Ele existe para a projeção nunca piscar mais que três vezes por causa do
    // som, e isso continua valendo DENTRO de um episódio. Mas ele era um teto
    // de SESSÃO: três reconexões espalhadas ao longo de um culto — e em
    // aparelho foram cinco em quatro minutos — gastavam o crédito, e a tela
    // ficava muda pelo resto do domingo por causa de uma turbulência de rede
    // que já tinha passado. Um teto que não se renova não é um freio, é uma
    // sentença.
    if (rebuilds && agora - audioSaudavelDesde > AUDIO_SAUDAVEL_MS) {
      rebuilds = 0;
      audioSaudavelDesde = agora;
    }
    const bv = faixaDe(sbV);
    if (!bv) return;
    const desvio = bv.end(bv.length - 1) - ba.end(ba.length - 1);
    if (desvio > ATRASO_AUDIO_S) {
      soltarAudio('o som ficou para trás');
      return;
    }
    // O DESVIO A/V VIRA NÚMERO, e é o único jeito de "dessincronizando" deixar
    // de ser adjetivo. Os dois relógios são independentes por construção: o
    // vídeo anda pelo carimbo da Surface (relógio do sistema) e o áudio por
    // CONTAGEM DE AMOSTRAS do hardware de som, que tem taxa própria — e não há
    // reancoragem de propósito, porque um `tfdt` que salta abre buraco no
    // `buffered` e navegador PARA em buraco. Então eles divergem devagar, e a
    // pergunta que este número responde é quanto, e se cresce.
    //
    // Arredondado a 50 ms: a borda dos dois buffers se mexe a cada append, e
    // um número trocando a cada 250 ms encheria o Registro de relatos que só
    // dizem "mudou o último dígito" — o `relatar` deduplica pela frase.
    //
    // O NOME NÃO PODE SER `ms`, e isto não é estilo. `ms` é a `MediaSource`
    // deste arquivo, lida na PRIMEIRA linha desta função; um `const ms` aqui
    // embaixo declara a variável para o BLOCO INTEIRO (zona morta temporal), e
    // aquela leitura passa a lançar `ReferenceError: Cannot access 'ms' before
    // initialization` — a cada 500 ms, em TODA tela que tenha ligado o som.
    // O laço de `borda()` morria junto: sem poda (a cota do MSE estoura e a
    // tela recomeça), sem perseguição de borda (o atraso cresce sem teto), sem
    // `setLiveSeekableRange` e sem `relatar` — que é exatamente o quadro de
    // "travando e dessincronizando" que a v5.152 introduziu ao dar nome ao
    // desvio A/V.
    const desvioMs = Math.round(desvio * 1000 / 50) * 50;
    porqueSemSom = 'ok (vídeo à frente do som em ' + desvioMs + ' ms)';
  }

  // Solta a faixa de som SEM tocar na de imagem. `removeSourceBuffer` numa
  // `MediaSource` aberta é operação normal da spec, e o que ela custa é a
  // faixa de áudio sumir do elemento — que é exatamente o pedido.
  function soltarAudio(porque) {
    if (!sbA) return;
    const morto = sbA;
    sbA = null;
    mimeA = '';
    audioDesde = 0;
    audioUltimoMs = 0;
    // Os fragmentos de som que ainda estavam na fila vão fora com ela; o
    // `aplicar` já os descartaria, e tirá-los aqui é o que impede a fila de
    // encostar no `FILA_MAX` por causa de uma faixa que não existe mais.
    for (let i = fila.length - 1; i >= 0; i--) if (fila[i].a) fila.splice(i, 1);
    if (emVoo && emVoo.a) emVoo = null;
    if (muxer) muxer.descartarAudio();
    porqueSemSom = 'faixa solta: ' + porque;
    // `removeSourceBuffer` LANÇA numa faixa com operação em voo
    // (`InvalidStateError`), e engolir essa exceção era desfazer a função
    // inteira: a faixa de som continuaria na `MediaSource`, sem receber mais
    // nada — e a MSE só toca com dado em TODAS as faixas, então a IMAGEM
    // congelaria justamente no caminho que existe para salvá-la. O `abort()`
    // cancela o que estiver em voo e é operação normal da spec numa
    // `MediaSource` aberta.
    try { if (morto.updating) morto.abort(); } catch (_) { /* já parada */ }
    try {
      ms.removeSourceBuffer(morto);
    } catch (_) {
      // Última linha de defesa: sem soltar a faixa, sem imagem. Recomeçar
      // limpo custa um piscar e devolve a projeção.
      recomecar('não deu para soltar a faixa de som');
      return;
    }
    semSom('Esta tela ficou sem som (' + porque + ') — a imagem continua.');
    aplicar();
  }

  /**
   * A BORDA AO VIVO DE UM FLUXO DE DUAS FAIXAS: a da faixa mais atrasada.
   *
   * Pura e separada de [borda] por um motivo só — ela é a regra que o
   * `tools/espelho-cliente.test.mjs` afirma. Provar isto num navegador de
   * verdade exigiria uma faixa de áudio real, e o Chromium do CI não traz AAC;
   * a regra, essa, é aritmética e se prova com duas faixas de mentira.
   *
   * [ba] nulo (a maioria das telas, que ficam mudas por decisão) devolve a
   * borda da imagem, que é o comportamento de sempre.
   */
  function bordaViva(bv, ba) {
    const fimV = bv.end(bv.length - 1);
    if (!ba || !ba.length) return fimV;
    return Math.min(fimV, ba.end(ba.length - 1));
  }

  function tocar() {
    const p = el.v.play();
    // O cliente nasce MUDO e tocando: "muted autoplay is always allowed". Se
    // ainda assim for barrado, o botão de gesto é a saída — e ele já está na
    // tela.
    if (p && p.catch) p.catch(() => { avisar('Toque na tela para começar.'); });
  }

  function borda() {
    if (!sbV || !ms || ms.readyState !== 'open') return;
    // O VIGIA VEM ANTES DA PERSEGUIÇÃO: com a faixa de som travando o elemento,
    // o `currentTime` não anda, e perseguir uma borda a partir de um cursor
    // congelado só produziria um salto atrás do outro.
    vigiarAudio();
    // E o posicionamento pode ter ficado esperando o som entrar (ver
    // `posicionar`); depois de soltar a faixa, ele precisa de alguém que o
    // chame de novo — o `updateend` sozinho não basta quando não há mais o que
    // appendar.
    posicionar();
    const b = faixaDe(sbV);
    if (!b) return;
    // A BORDA AO VIVO É A DA FAIXA MAIS ATRASADA, e não a da imagem.
    //
    // A MSE só toca com dado em TODAS as faixas: o cursor que passa do fim do
    // som PARA O VÍDEO, mesmo com imagem bufferizada de sobra. E as duas bordas
    // NÃO andam juntas — medido em aparelho, o som sai ~500 ms atrás da imagem
    // (o caminho dele é worklet → blocos de 40 ms → `postMessage` → fila →
    // `MediaCodec` AAC, e nada disso existe do lado do vídeo).
    //
    // Perseguindo a borda do VÍDEO, a regra mantinha o cursor entre 0,35 s e
    // 0,85 s atrás dela — e a ponta rápida desse intervalo fica 150 ms **à
    // frente** do fim do som. O `<video>` engasgava toda vez que a perseguição
    // chegava lá: micro-travamentos com som ligado, imagem parada, nenhum erro
    // em lugar nenhum e o buffer de vídeo cheio. Era o que sobrava do
    // "travando" depois da v5.154.
    //
    // Com o mínimo das duas, `ALVO_S` volta a ser o que ele diz ser: folga real
    // nas duas faixas. O preço é a latência da imagem crescer pelo atraso do
    // som — e ele é o preço certo, porque uma projeção 0,5 s mais atrasada é
    // invisível e uma projeção que engasga não é. Sem faixa de som (o caso da
    // maioria das telas) nada muda: o mínimo de um só é ele mesmo.
    const ba = sbA ? faixaDe(sbA) : null;
    const fim = bordaViva(b, ba);
    const agora = el.v.currentTime;
    const atraso = fim - agora;

    const fv = folgaDoCursor(b, agora);
    const fa = folgaDoCursor(ba, agora);
    amostrarPiores(
      fv === null ? null : Math.round(fv * 1000),
      fa === null ? null : Math.round(fa * 1000)
    );

    if (el.v.paused && posicionado) tocar();

    // O ENCALHE — o cursor FORA de qualquer intervalo bufferizado, que é o
    // congelamento em estado puro: a MSE não toca, `currentTime` não anda, não
    // há erro, não há evento, e como o cursor não anda ele nunca sai sozinho.
    //
    // Até a v5.157 a ÚNICA saída era o `SALTO_S`, e ele só dispara quando a
    // borda ao vivo abre oito segundos sobre um cursor parado — isto é, a tela
    // ficava congelada por ~7 s TODA VEZ. Era literalmente o relógio da
    // recuperação, e foi ele que o operador cronometrou.
    //
    // Encalhe é condição OBSERVÁVEL no instante: não precisa de prova por
    // tempo. Detectá-lo aqui derruba o teto de tela parada de ~7 s para o
    // compasso, meio segundo.
    // ...E ELE PRECISA ESTAR PARADO, não só fora do buffer. O Chromium pula
    // buraco pequeno sozinho, e um cursor que atravessa um buraco ANDANDO já
    // está se resolvendo — ver `cursorParadoMs`. Um giro inteiro sem andar
    // (`ENCALHE_MS`, abaixo do compasso de 500 ms de propósito) é o que separa
    // o congelamento de verdade do socorro que só serve para estalar a imagem.
    if (posicionado && !el.v.seeking && cursorParadoMs() >= ENCALHE_MS
        && (indiceNoCursor(b, agora) < 0 || (ba && ba.length && indiceNoCursor(ba, agora) < 0))) {
      // O destino precisa estar dentro do ÚLTIMO bloco das DUAS faixas: pular
      // para `fim - ALVO_S` cairia noutro buraco se o bloco vivo começar depois
      // disso, e o encalhe recomeçaria em meio segundo.
      let seguro = b.start(b.length - 1);
      if (ba && ba.length) seguro = Math.max(seguro, ba.start(ba.length - 1));
      const alvo = Math.max(seguro, Math.min(fim - alvoS, fim - TOCA_S));
      recuarAlvo();
      encalhes++;
      encalhesSeguidos++;
      dobrarAberto();
      // Três encalhes seguidos é o destino não estar servindo — a linha do
      // tempo das duas faixas não se sobrepõe. Insistir seria piscar a projeção
      // a cada meio segundo; recomeçar limpo custa um piscar e resolve.
      if (encalhesSeguidos >= 3) { recomecar('o cursor não encontra o fluxo'); return; }
      try { el.v.currentTime = alvo; } catch (_) {}
      el.v.playbackRate = 1;
      zerarPiores();
      return;
    }
    encalhesSeguidos = 0;

    if (atraso > SALTO_S) {
      // A recuperação, não a perseguição — ver o comentário de `SALTO_S`.
      saltos++;
      recuarAlvo();
      try { el.v.currentTime = fim - alvoS; } catch (_) {}
      el.v.playbackRate = 1;
      // O salto é NOSSO, e por isso apaga o pior caso: ele é a recuperação
      // funcionando, não o travamento que o operador viu. `zerarPiores` FECHA a
      // medida em aberto antes de apagá-la — sem isso o travamento que o salto
      // acabou de encerrar não entrava em número nenhum.
      zerarPiores();
    } else if (el.v.readyState < 3) {
      // SEM DADO ADIANTE: acelerar um elemento que não está andando não alcança
      // nada e deixa 1,08 grudado — e foi assim que o log de aparelho chegou,
      // com `vel 108%` sobre uma tela parada. Perseguir exige estar andando.
      el.v.playbackRate = 1;
    } else if (atraso > alvoS + TOL_S) {
      el.v.playbackRate = RAPIDO;
    } else if (atraso < alvoS - TOL_S) {
      el.v.playbackRate = LENTO;
    } else {
      el.v.playbackRate = 1;
    }

    // O TRECHO LIMPO PAGA O ATRASO DE VOLTA. Nada de incidente por
    // `ALVO_CALMA_MS` seguidos e a folga desce um degrau — a tela vai
    // encontrando sozinha o menor atraso que ela aguenta. Quem faz a conta subir
    // de novo é `recuarAlvo`, chamado nos dois socorros e em qualquer parada
    // contada.
    if (travouN !== travouVisto) { travouVisto = travouN; recuarAlvo(); }
    else if (posicionado && el.v.readyState >= 3 && alvoS > ALVO_MIN
             && Date.now() - calmaDesde > ALVO_CALMA_MS) {
      alvoS = Math.max(ALVO_MIN, Math.round((alvoS - ALVO_PASSO) * 100) / 100);
      calmaDesde = Date.now();
    }

    // A JANELA NAVEGÁVEL sai daqui, e NÃO de `ms.duration`: ao vivo não se
    // escreve duração e não se chama `endOfStream()` (§3.11, invariante 5) —
    // é o ponto exato em que copiar o `shared/mse.js`, que tem duração, daria
    // errado.
    if (typeof ms.setLiveSeekableRange === 'function') {
      try { ms.setLiveSeekableRange(b.start(0), fim); } catch (_) {}
    }
    podaPedida = true;
    aplicar();
  }

  // --------------------------------------------------------------------------
  // A VOLTA (§5.1, `POST /r`) — três palavras, e nenhuma delas entra no
  // barramento de comandos do app
  // --------------------------------------------------------------------------

  function pedirChave() {
    const agora = Date.now();
    if (agora - ultimaChave < CHAVE_MS) return;
    ultimaChave = agora;
    postar('/r', { do: 'key' }, true).catch(() => {});
  }

  // "Entregue AAC para ESTA tela." Não liga grafo nenhum no celular — o áudio
  // do espelho sobe com o espelho (§3.9); o que isto abre é a torneira desta
  // tela, e o servidor responde empurrando o `csd` de áudio guardado.
  function pedirAudio() {
    postar('/r', { do: 'audio', on: true }, true).catch(() => {});
  }

  let ultimoAlive = 0;

  // O QUE ESTA TELA ESTÁ VENDO, dito ao celular.
  //
  // Até aqui o Registro do operador respondia só o que o SERVIDOR sabia de cada
  // tela: bytes escritos, descartes, quando foi o último write. Nada disso
  // distingue "a tela está projetando" de "a tela está num laço de reconexão
  // dizendo que não recebeu som" — e foi exatamente essa a pergunta que ficou
  // sem resposta no primeiro culto de teste, com o celular jurando que mandava
  // AAC e a tela jurando que não recebia. O canal já existia (`alive`); o que
  // faltava era o cliente contar o próprio estado por ele.
  //
  // Três campos, e só três: a frase que está na tela (que é onde o cliente já
  // escreve a causa), se a faixa de som existe, e quantos recomeços ele já deu.
  // O texto é cortado aqui e SANEADO no Kotlin, como todo texto vindo da rede.
  // A frase cabia em 110 caracteres porque o corpo INTEIRO tinha de caber nos
  // 256 B do `POST /par`. Com o teto do `/r` autenticado em 4 KiB (ver
  // `EspelhoHttp.TETO_CORPO_RETORNO`) ela cabe inteira — e o que se perdia no
  // corte era sempre o FIM, que é justamente onde a frase da tela diz a causa.
  const AVISO_MAX = 220;
  // O que cabia no teto de 256 B do shell anterior. Ver `relatoCurto`.
  const AVISO_CURTO = 110;

  // O QUE VAI PARA O FIO É ASCII, e isso não é preferência: o `sanear` do
  // `EspelhoPares` deixa passar só `[\x20-\x7E]` — invariante 9, com JUnit,
  // porque um `\n` vindo da rede injetaria linhas falsas no Registro, que é o
  // artefato que este projeto manda COPIAR e repassar.
  //
  // Só que ele APAGA o que não passa, em vez de recusar: as frases deste
  // arquivo são em português, e em aparelho o Registro do operador mostrou
  // `"som: ok (vdeo  frente do som em 500 ms)  fim: ns abortamos"` — sem os
  // acentos, sem as aspas angulares e sem o separador. Um diagnóstico
  // mutilado não é um diagnóstico melhor por ser seguro.
  //
  // A correção é do lado que produz o texto, não do que o sanea: a TELA
  // continua em português com acento (é ela que o visitante lê), e o que
  // viaja é a transliteração. `normalize` não é de contexto seguro, mas um
  // navegador de TV velho pode não trazê-la — daí o `try`, que degrada para o
  // comportamento de antes em vez de derrubar o relato.
  // A PONTUAÇÃO TAMBÉM, e ela não sai pelo `NFD`: travessão, reticências e
  // aspas tipográficas não são letra com acento, são caracteres próprios — e
  // as frases deste arquivo estão cheias delas ("Sem sinal — a conexão caiu").
  // Sem esta troca, o travessão simplesmente evaporava e a frase chegava ao
  // Registro com dois espaços no lugar dele.
  const ASCII = { '—': '-', '–': '-', '…': '...', '“': '"', '”': '"', '‘': "'", '’': "'", '«': '<', '»': '>', '·': '|', ' ': ' ' };

  function semAcento(s) {
    const trocado = s.replace(/[—–…“”‘’«»· ]/g, (c) => ASCII[c] || ' ');
    try {
      return trocado.normalize('NFD').replace(/[̀-ͯ]/g, '');
    } catch (_) { return trocado; }
  }

  /**
   * O QUE SÓ ESTA TELA SABE — e que o servidor não tem como descobrir.
   *
   * Do lado de lá o Registro respondia "escrevi 17,9 MB, 0 descartes, último
   * write há 0 s". Nada disso distingue **imagem andando** de **imagem
   * congelada com o buffer cheio**: os bytes saem do celular do mesmo jeito nos
   * dois casos. A pergunta do operador ("por que está travando?") mora inteira
   * deste lado, e até aqui cabia numa frase de 110 caracteres.
   *
   * Cada campo abaixo existe porque separa dois desfechos com correções
   * DIFERENTES — é a mesma régua do resto do Registro:
   *
   *  - `dq`/`tq` (quadros DESCARTADOS pelo decodificador × total): é o único
   *    número que diz "esta tela não dá conta do fluxo" em vez de "a rede está
   *    ruim". Rede ruim não descarta quadro decodificado, atrasa.
   *  - `vfim`/`afim` (folga do cursor até o fim de cada faixa): NEGATIVO em
   *    qualquer uma delas é o cursor tendo passado do buffer — a MSE não toca,
   *    e a tela congela sem erro. É o defeito que a v5.155 corrigiu, e este é o
   *    número que o teria mostrado no primeiro minuto.
   *  - `rs` (`readyState` do `<video>`): 4 é "tocando com folga", 2 é
   *    "esperando dado". Congelado com `rs` alto é decodificador; congelado com
   *    `rs` baixo é fonte.
   *  - `fila` (append pendente): cheia é este aparelho não escoando; vazia com
   *    imagem parada é o contrário — não está chegando nada.
   *  - `cod`: o que o navegador de fato aceitou. "Não decodifica" e "decodifica
   *    e engasga" são a mesma tela preta.
   *  - `rate`: a perseguição de borda em ação. Colada em 108 o tempo todo é uma
   *    tela que nunca alcança.
   *  - `reb`/`cota`/`rr`: os três tetos internos. Batido qualquer um deles, a
   *    tela desiste de algo em silêncio — e o Registro passa a dizer qual.
   */
  function medidasDaTela() {
    const v = el.v || {};
    // A MEDIDA EM ABERTO ENTRA NO RELATO. Sem isto, uma tela congelada AGORA
    // reportaria o pior caso de antes do congelamento — que é exatamente o log
    // saudável que a v5.157 produziu no meio de um travamento.
    dobrarAberto();
    const bv = faixaDe(sbV);
    const ba = faixaDe(sbA);
    const agora = v.currentTime || 0;
    // `emMs`, e NUNCA `ms`: `ms` é a `MediaSource` deste arquivo, e um
    // `const ms` aqui a poria na zona morta temporal do bloco inteiro. É a
    // mesma linha que a v5.152 escreveu e que custou a auditoria da v5.154;
    // `tools/sombra.test.mjs` a reprovou de novo enquanto isto era escrito.
    const emMs = (s) => Math.round(s * 1000);
    let dq = -1;
    let tq = -1;
    try {
      if (typeof v.getVideoPlaybackQuality === 'function') {
        const q = v.getVideoPlaybackQuality();
        dq = q.droppedVideoFrames | 0;
        tq = q.totalVideoFrames | 0;
      }
    } catch (_) { /* nem todo navegador traz */ }
    return {
      q: conta.quadros,
      qa: conta.quadrosAudio,
      rec: conta.reconexoes,
      kb: Math.round(conta.bytes / 1024),
      fila: fila.length,
      // Folga do cursor até o fim de cada faixa. `-99999` = não há faixa; um
      // NEGATIVO é o cursor fora do buffer, que é o congelamento.
      // Folga do cursor até o fim DO BLOCO EM QUE ELE ESTÁ — ver
      // `folgaDoCursor`. Até a v5.157 era até o fim do ÚLTIMO bloco, e com um
      // buraco isso media a borda de um bloco onde o cursor nem estava: o log
      // de aparelho trouxe `readyState 2` ("sem dado adiante") ao lado de
      // `vfim +3893 ms`, que num buffer contíguo é impossível.
      vfim: bv ? emMs(folgaDoCursor(bv, agora)) : -99999,
      afim: ba ? emMs(folgaDoCursor(ba, agora)) : -99999,
      // A janela viva inteira (passado bufferizado), que é o que a poda governa.
      jan: bv ? emMs(bv.end(bv.length - 1) - bv.start(0)) : 0,
      rate: Math.round((v.playbackRate || 0) * 100),
      rs: v.readyState | 0,
      ns: v.networkState | 0,
      dq: dq,
      tq: tq,
      reb: rebuilds,
      cota: cotaSeguidas,
      rr: recusasSeguidas,
      // O que o navegador aceitou, e o tamanho que ele está desenhando: uma
      // tela esticando 1280x720 num painel de 3840 é uma leitura, não um erro.
      cod: semAcento(((mime || '?') + (mimeA ? '+' + mimeA : ''))
        .replace(/[a-z]+\/mp4; codecs="/g, '').replace(/"/g, '')),
      vid: (v.videoWidth | 0) + 'x' + (v.videoHeight | 0),
      tela: (global.innerWidth | 0) + 'x' + (global.innerHeight | 0),
      err: semAcento(ultimoErroMidia || '').slice(0, 80),
      // O PIOR CASO desde a última descontinuidade nossa — ver `zerarPiores`.
      // Estes cinco NÃO são zerados pelo envio: o relato sai a cada 10 s e a
      // cada troca de frase, então zerar aqui faria o pior caso depender da
      // cadência do relato, e um travamento cairia na janela de alguém.
      pq: piorQuadro,
      nq: parouQuadro,
      pc: piorCursor,
      pv: piorVfim === 99999 ? -99999 : piorVfim,
      pa: piorAfim === 99999 ? -99999 : piorAfim,
      // QUANTOS BLOCOS tem o `buffered` de cada faixa. É o número que separa as
      // duas causas possíveis do congelamento e que não existia: `1` diz que o
      // buffer é contíguo e o problema é FOME (o produtor não entregou a
      // tempo); acima de `1` há BURACO, e a caçada é outra. `-1` = sem faixa.
      nr: bv ? bv.length : -1,
      na: ba ? ba.length : -1,
      // O TOTAL DA SESSÃO — o que responde "trava a cada 7 segundos" com um
      // número em vez de uma impressão. Estes quatro só zeram em `comecar()`.
      tt: travouMs,
      tn: travouN,
      sal: saltos,
      enc: encalhes,
      // Podas recusadas por não haver quadro-chave conhecido antes do corte.
      // Crescendo sem parar, a janela viva está encostando no GOP.
      pod: podaSemChave,
    };
  }

  function corpoDoAlive() {
    // O RAMO DO SOM VAI SEMPRE, e vem primeiro quando não há frase na tela: ele
    // é o dado que decide, e a frase é o contexto. Os dois no mesmo campo
    // porque o Kotlin já o saneia e já o mostra (`diz:`) — um campo novo
    // exigiria APK, e isto precisa chegar por OTA.
    //
    // Os delimitadores são `[` e `|`, e não `«` e `·`: os três antigos eram
    // não-ASCII e sumiam no saneamento, deixando a nota colada na frase da
    // tela sem nada separando as duas.
    const tela = (el.aviso ? el.aviso.textContent || '' : '').trim();
    const nota = '[som: ' + porqueSemSom + (ultimoFim ? ' | fim: ' + ultimoFim : '') + ']';
    const corpo = {
      do: 'alive',
      telaAcesaMin: minutosAcesa(),
      // A FRASE cresceu junto com o teto do `POST /r`: ela era cortada em 110
      // caracteres porque o corpo inteiro tinha de caber em 256 B, e o que se
      // perdia era sempre o fim — que é onde a frase da tela dizia a causa.
      // O CORTE DEPENDE DO TETO QUE O OUTRO LADO TEM. Com 220 caracteres o
      // corpo passa de 256 B mesmo SEM as medidas — ou seja, a degradação para
      // shell antigo teria sido recusada pelo mesmo 413 que a disparou, e o
      // canal morreria de qualquer forma. É o velho AVISO_CURTO ali.
      aviso: semAcento((tela ? nota + ' ' + tela : nota))
        .slice(0, relatoCurto ? AVISO_CURTO : AVISO_MAX),
      som: !!sbA,
      recomecos: conta.recomecos,
    };
    // As medidas vão no MESMO objeto, achatadas: um nível a menos de indireção
    // é uma leitura a menos que pode errar o caminho em silêncio do lado do
    // Kotlin — a mesma razão pela qual os fatos do `EspelhoDiag` moram na raiz.
    // Num shell antigo elas não cabem, e o 413 já nos ensinou isso — ver
    // `relatoCurto`. O relato volta a ser o de antes, que aquele shell entende
    // inteiro, em vez de ser recusado por completo.
    if (relatoCurto) return corpo;
    const m = medidasDaTela();
    for (const k in m) if (Object.prototype.hasOwnProperty.call(m, k)) corpo[k] = m[k];
    return corpo;
  }

  // O SHELL ANTIGO RECUSA O RELATO GRANDE, e o bundle chega antes do APK.
  //
  // As medidas da tela só cabem porque o `POST /r` passou a aceitar 4 KiB
  // (`EspelhoHttp.TETO_CORPO_RETORNO`) — e isso é Kotlin, isto é, chega
  // INSTALANDO. O OTA, não: ele chega sozinho, e num aparelho ainda no shell
  // anterior o corpo de ~600 B estoura o teto de 256 B e volta **413**. Sem
  // esta guarda o resultado seria o pior desfecho possível: o canal de relato
  // morrendo no exato commit que existe para ampliá-lo, e em silêncio.
  //
  // Um 413 é definitivo (o teto é uma constante do shell, não um estado), então
  // basta vê-lo uma vez para desistir das medidas pelo resto da sessão. O que
  // sobra é o relato de antes, que aquele shell entende inteiro.
  let relatoCurto = false;

  async function enviarRelato() {
    if (!vivo || !token) return;
    let r;
    try { r = await postar('/r', corpoDoAlive(), true); } catch (_) { return; }
    if (r && r.status === 413 && !relatoCurto) {
      relatoCurto = true;
      // E o que foi recusado precisa ser REENVIADO na forma curta: senão esta
      // batida se perde, e numa tela que caia logo em seguida ela era a única.
      try { await postar('/r', corpoDoAlive(), true); } catch (_) { /* rede */ }
    }
  }

  function bater() {
    enviarRelato();
  }

  // E ele é enviado também A CADA CONEXÃO e a cada troca da frase, não só de
  // cinco em cinco minutos: uma tela que reconecta a cada três segundos é
  // justamente a que o operador precisa enxergar, e um relato que chega no
  // quinto minuto chegaria depois do culto. O freio é o próprio evento — o
  // corpo é minúsculo e só sai quando algo de fato mudou.
  let ultimoRelato = null;

  function relatar() {
    if (!vivo || !token) return;
    const chave = (el.aviso ? el.aviso.textContent || '' : '')
      + '|' + (sbA ? '1' : '0') + '|' + porqueSemSom + '|' + ultimoFim;
    if (chave === ultimoRelato) return;
    ultimoRelato = chave;
    enviarRelato();
  }

  // --------------------------------------------------------------------------
  // O FLUXO: desmontar `[16 B][carga]` de um `ReadableStream`
  // --------------------------------------------------------------------------

  const pedacos = [];
  let disponivel = 0;
  let cabecalho = null;

  function tirar(n) {
    const saida = new Uint8Array(n);
    let o = 0;
    while (o < n) {
      const p = pedacos[0];
      const quanto = Math.min(p.length, n - o);
      saida.set(p.subarray(0, quanto), o);
      if (quanto === p.length) pedacos.shift();
      else pedacos[0] = p.subarray(quanto);
      o += quanto;
    }
    disponivel -= n;
    return saida;
  }

  function u32(b, o) {
    return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
  }

  function processar() {
    for (;;) {
      if (!cabecalho) {
        if (disponivel < CAB) return;
        const h = tirar(CAB);
        cabecalho = {
          tipo: h[0],
          chave: (h[1] & F_CHAVE) !== 0,
          tam: u32(h, 4),
          // Dois uint32 e não um uint64: evita `BigInt` no cliente, e 2^53 µs
          // são 285 anos de folga (§5.2).
          pts: u32(h, 8) * 4294967296 + u32(h, 12),
        };
        if (cabecalho.tam > CARGA_MAX) {
          cabecalho = null;
          throw new Error('quadro maior que o teto — o fluxo saiu de sincronia');
        }
      }
      if (disponivel < cabecalho.tam) return;
      const carga = tirar(cabecalho.tam);
      const q = cabecalho;
      cabecalho = null;
      receber(q, carga);
    }
  }

  /**
   * O prazo do `csd` de áudio venceu numa conexão ESTÁVEL: abre só com imagem.
   *
   * Ele é o irmão do teste absoluto em [receber] — este cobre "a conexão está
   * de pé e nada mais chega", aquele cobre "a conexão cai antes do prazo". Sem
   * os dois, um dos dois casos fica sem ninguém para decidir.
   */
  function desistirDoAudio() {
    esperaAudio = null;
    const retido = initVideoRetido;
    initVideoRetido = null;
    if (!retido || ms) return;
    // O som não veio: o grafo do celular não subiu (§3.9 — o handshake que
    // libera o `forceMuted` nunca chegou). Abre-se só com imagem, e se diz
    // isso: mudo é um estado, não um defeito escondido.
    porqueSemSom = 'o csd de áudio não chegou em ' + ESPERA_CSD_AUDIO_MS + ' ms';
    semSom('Esta tela está sem som — o celular não está enviando áudio.');
    abrirMidia(retido, null);
  }

  function receber(q, carga) {
    conta.bytes += carga.length + CAB;
    if (q.tipo === T_CSD_VIDEO) {
      const info = muxer.csd(carga);
      if (!info) { avisar('O sinal veio sem os parâmetros do vídeo.', true); return; }
      // A RETENÇÃO: esta tela já pediu som e a `MediaSource` ainda não existe,
      // então as duas faixas têm de nascer juntas — e o `csd` de áudio vem logo
      // atrás, assim que o `POST /r` desta conexão der a volta. Segurar aqui
      // custa milissegundos; abrir só com vídeo custaria uma remontagem.
      if (!ms && audioQuerido) {
        // O PRAZO É ABSOLUTO E ATRAVESSA RECONEXÕES, e essa é a correção
        // inteira. Ele era um `setTimeout` que o `conectar()` limpava no topo
        // de CADA conexão — o que é certo para o `csd` retido (ele morre com a
        // conexão que o trouxe) e é fatal para o PRAZO: numa tela que
        // reconecta a cada dois segundos, um prazo de 2,5 s nunca chega a
        // vencer. O cliente ficava esperando um `csd` de áudio para sempre, a
        // `MediaSource` nunca nascia, e nem o VÍDEO aparecia — com o Registro
        // dizendo, com todas as letras, `som: pedido, esperando o csd`.
        //
        // Marcado em `Date.now()` e não num timer: um instante sobrevive a
        // qualquer número de reconexões, um `setTimeout` não.
        if (!esperaAudioAte) esperaAudioAte = Date.now() + ESPERA_CSD_AUDIO_MS;
        if (Date.now() < esperaAudioAte) {
          initVideoRetido = info;
          // O timer continua existindo para o caso NORMAL — uma conexão
          // estável em que nada mais chega —, porque sem ele nada acordaria a
          // decisão até o próximo quadro.
          if (!esperaAudio) {
            esperaAudio = setTimeout(desistirDoAudio, ESPERA_CSD_AUDIO_MS);
          }
          return;
        }
        // Prazo vencido: abre com o que há. A imagem vem primeiro — uma tela
        // muda projeta, uma tela sem `MediaSource` não projeta nada.
        porqueSemSom = 'o csd de áudio não chegou em ' + ESPERA_CSD_AUDIO_MS + ' ms';
        semSom('Esta tela está sem som — o celular não está enviando áudio.');
        abrirMidia(info, null);
        return;
      }
      abrirMidia(info, null);
      return;
    }
    if (q.tipo === T_VIDEO) {
      // MANDAR BYTES ANTES DO IDR PRODUZ LIXO VERDE (§5.3). O servidor já
      // segura, e o cliente confere de novo — o custo é um `if` e o benefício é
      // que uma reconexão no meio de um GOP nunca pinta lixo na frente de
      // ninguém.
      if (esperandoChave) {
        if (!q.chave) return;
        esperandoChave = false;
      }
      // A poda precisa saber onde estão as chaves — ver `anotarChave`. Anotar
      // aqui, e não no muxer, porque é aqui que se sabe que o quadro foi de
      // fato ACEITO (o descarte de deltas antes do IDR já passou).
      if (q.chave) anotarChave(q.pts);
      conta.quadros++;
      tentativa = 0;                      // quadro de verdade: a espera zera
      // E UM TRECHO LONGO decodificado sem recusa é o que zera o contador de
      // recusas — não o primeiro quadro. A falha que este contador existe para
      // enxergar entrega dezenas de quadros e SÓ ENTÃO estoura, de três em três
      // segundos: zerar no primeiro quadro faria o contador nunca sair de um e
      // a escada nunca subir.
      if (++quadrosDesdeRecusa > QUADROS_SAUDAVEL) recusasSeguidas = 0;
      const frag = muxer.quadro({ ptsUs: q.pts, chave: q.chave, dados: carga });
      if (frag) enfileirar(frag);
      if (conta.quadros === 1) limparAviso();
      return;
    }
    // O ÁUDIO (§3.9): uma SEGUNDA `SourceBuffer` da MESMA `MediaSource`, com o
    // AAC vindo pronto do `MediaCodec` do celular. A sincronia A/V é do
    // NAVEGADOR — uma `MediaSource`, uma linha do tempo —, e é por isso que
    // isto custa dez linhas em vez das duzentas de um relógio próprio.
    if (q.tipo === T_CSD_AUDIO) {
      // Uma tela que não pediu som não recebe AAC (§3.6, invariante 10); se
      // algo chegar assim mesmo, ela continua muda.
      if (!audioQuerido) return;
      const infoA = muxer.csdAudio(carga);
      // ASC ilegível: MUDO, e a imagem intacta. É a metade do cliente da falha
      // segura do §3.9 — nunca áudio pela metade.
      if (!infoA) {
        porqueSemSom = 'csd de áudio ilegível';
        semSom('Esta tela fica sem som: o sinal veio sem os parâmetros do áudio.');
        return;
      }
      if (esperaAudio) {
        // O par completo: as duas faixas nascem agora, juntas.
        clearTimeout(esperaAudio);
        esperaAudio = null;
        const retido = initVideoRetido;
        initVideoRetido = null;
        if (retido) abrirMidia(retido, infoA);
        return;
      }
      // Reconexão com a faixa já de pé: reenviar o segmento de inicialização é
      // legal em MSE e é o que a mantém viva do outro lado da queda.
      if (sbA && infoA.mime === mimeA) { enfileirar(infoA.bytes, true); return; }
      porqueSemSom = 'csd chegou tarde (MediaSource já aberta sem som)';
      // E o `csd` que chega com a `MediaSource` já montada sem faixa de som
      // não pode montar uma agora — o Chromium recusa `addSourceBuffer` depois
      // da inicialização (ver o cabeçalho desta seção). Quem remonta é o GESTO,
      // uma vez; aqui a chegada tardia é ignorada, e é ela que fecha o laço de
      // remontagens que um "remonta quando o csd chegar" produziria.
      return;
    }
    if (q.tipo === T_AUDIO) {
      if (!sbA) return;
      // A âncora do teto de remontagens nasce no PRIMEIRO quadro AAC desta
      // faixa: é dele em diante que "o som está chegando" começa a contar.
      if (!audioUltimoMs) audioSaudavelDesde = Date.now();
      audioUltimoMs = Date.now();
      conta.quadrosAudio++;
      // 'ok' é o piso; o `vigiarAudio` o substitui pelo desvio A/V medido assim
      // que houver as duas bordas. Manter os dois é o que faz "chegou AAC" e
      // "as duas faixas estão alinhadas" serem afirmações diferentes.
      if (porqueSemSom.slice(0, 2) !== 'ok') porqueSemSom = 'ok';
      // O som chegou: a frase pegajosa que dizia o contrário sai de cena.
      if (avisoSom) semSom('');
      const frag = muxer.quadroAudio({ ptsUs: q.pts, dados: carga });
      if (frag) enfileirar(frag, true);
      return;
    }
    if (q.tipo === T_CONTROLE) {
      let j = null;
      try { j = JSON.parse(new TextDecoder().decode(carga)); } catch (_) { return; }
      controle(j);
    }
  }

  function controle(j) {
    if (!j || !j.m) return;
    if (j.m === 'sem-audio') {
      avisar('Esta cena vai sem som' + (j.por ? ' (' + String(j.por).slice(0, 24) + ')' : '') + '.');
      return;
    }
    if (j.m === 'adeus') {
      // Despedida do servidor: NÃO reconectar. Insistir contra um espelho que o
      // operador desligou é a diferença entre uma página quieta e três telas
      // martelando um AP de igreja durante o resto do culto.
      vivo = false;
      parar();
      avisar('O espelho foi desligado no celular.', true);
    }
  }

  // --------------------------------------------------------------------------
  // O LAÇO DE CONEXÃO
  // --------------------------------------------------------------------------

  async function conectar() {
    pedacos.length = 0;
    disponivel = 0;
    cabecalho = null;
    esperandoChave = true;
    // A RETENÇÃO É POR CONEXÃO. Um `csd` de vídeo guardado à espera de um de
    // áudio que morreu com a conexão anterior não pode atravessar para esta:
    // ele abriria a `MediaSource` com o par errado, e o `csd` novo (que vem
    // logo abaixo) cairia no caminho de reconexão sem faixa de som nenhuma.
    if (esperaAudio) { clearTimeout(esperaAudio); esperaAudio = null; }
    initVideoRetido = null;

    abortar = typeof global.AbortController === 'function' ? new global.AbortController() : null;
    const r = await fetch('/v', {
      headers: { Authorization: 'Bearer ' + token },
      cache: 'no-store',
      signal: abortar ? abortar.signal : undefined,
    });
    // 404 É A RESPOSTA ÚNICA do servidor para token inválido, rota inexistente e
    // `Host` recusado (§3.4, invariante 5) — não vazar existência é decisão de
    // projeto, e a consequência aqui é que o cliente NÃO TEM COMO distinguir.
    // Um token válido nunca leva 404, então tratar como token morto é a única
    // leitura útil: voltar ao pareamento é a ação que resolve os três casos.
    if (r.status === 404 || r.status === 401 || r.status === 403) {
      token = '';
      guardado('');
      aoPareamento('A sessão desta tela terminou. Digite o código de novo.');
      return;
    }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    if (!r.body || !r.body.getReader) throw new Error('sem fluxo');

    conta.reconexoes++;
    limparAviso();
    // O PEDIDO DE ÁUDIO É POR CONEXÃO, não por sessão: do lado do servidor a
    // tela é recriada a cada `GET /v` e nasce sem áudio (§3.6, invariante 10),
    // então uma queda de rede deixaria esta tela muda para sempre se o pedido
    // não fosse refeito aqui. É também ele que faz o `csd` de áudio chegar
    // logo atrás do de vídeo — que é o que a retenção em `receber` espera.
    if (audioQuerido) pedirAudio();
    // E o relato desta conexão, sem esperar a batida de cinco minutos: numa
    // tela que reconecta em laço, ESTE é o único momento em que ela consegue
    // contar o que aconteceu na conexão anterior.
    ultimoRelato = null;
    relatar();
    quadrosDesdeRecusa = 0;
    const leitor = r.body.getReader();
    for (;;) {
      const passo = await leitor.read();
      if (passo.done) {
        // O SERVIDOR FECHOU, e isso vira relato: uma tela que reconecta a cada
        // dois segundos com `0 descarte(s)` é um fato do lado de LÁ, e sem
        // nomeá-lo o Registro mostra só a troca de rótulos. `fim do fluxo` é o
        // servidor tendo encerrado; um `throw` daqui é rede.
        ultimoFim = 'fim do fluxo do servidor';
        return;                             // quem reconecta é o laço
      }
      if (!vivo) { try { leitor.cancel(); } catch (_) {} return; }
      pedacos.push(passo.value);
      disponivel += passo.value.length;
      processar();
    }
  }

  async function laco() {
    while (vivo) {
      // Quem abortou fomos NÓS (`recomecar`/`parar`), e nesse caso a tela já
      // está dizendo o motivo certo. Sem esta distinção, o `AbortError` do
      // próprio `fetch` sobrescreveria a frase boa por "Sem sinal — The user
      // aborted a request", em inglês, na tela de quem só quer assistir ao
      // culto.
      let nosso = false;
      try {
        await conectar();
      } catch (e) {
        if (!vivo) return;
        if (e && e.name === 'AbortError') { nosso = true; ultimoFim = 'nós abortamos'; }
        else {
          ultimoFim = 'rede: ' + ((e && e.name) || '?');
          avisar('Sem sinal — ' + ((e && e.message) || 'a conexão caiu') + '.', true);
        }
      }
      if (!vivo) return;
      // A ESCADA VALE TAMBÉM PARA A RECUSA QUE SE REPETE. `recomecar` zera o
      // `tentativa` para uma falha isolada voltar depressa; a partir da terceira
      // recusa seguida do decodificador isso vira um martelo — e um martelo é
      // pior que uma espera, porque não conserta nada e ainda pisca a projeção
      // de três em três segundos na frente de quem está assistindo.
      const degrau = recusasSeguidas >= RECUSAS_ATE_ESCADA
        ? Math.min(recusasSeguidas - RECUSAS_ATE_ESCADA + 1, RECONEXAO.length - 1)
        : Math.min(tentativa, RECONEXAO.length - 1);
      const espera = RECONEXAO[degrau];
      tentativa++;
      if (recusasSeguidas >= RECUSAS_ATE_ESCADA) {
        // E A FRASE PASSA A NOMEAR O ESTADO, em vez de repetir "sem sinal": não
        // é a rede que está falhando, é este navegador que não está aceitando o
        // fluxo — e essa distinção é o que decide se o operador mexe no
        // roteador ou troca a tela.
        avisar('Esta tela não está conseguindo decodificar o fluxo ('
          + recusasSeguidas + ' recusas seguidas) — tentando de novo em '
          + Math.round(espera / 1000) + ' s.', true);
      } else if (!nosso) {
        avisar('Sem sinal — tentando de novo em ' + Math.round(espera / 1000) + ' s.', true);
      }
      await dormir(espera);
    }
  }

  // Recomeçar LIMPO. Nunca se descarta fragmento já muxado: isso abriria buraco
  // no `buffered`, que é exatamente o que o atraso de um quadro do `fmp4.js`
  // trabalha para evitar, e navegador PARA em buraco. Quando não há saída, a
  // saída é jogar fora a linha do tempo inteira e montar outra — pisca uma vez
  // e volta certo.
  function recomecar(porque, suave) {
    conta.recomecos++;
    // A reconexão já tem número próprio (`rec`/`recomecos`) e deixa rastro no
    // Registro. Contá-la também como travamento afogaria o pior caso: cada
    // recomeço injetaria vários segundos em `pq`, e o número que existe para
    // achar a parada silenciosa passaria a medir a parada barulhenta.
    zerarPiores();
    armarQuadros();
    // O anel de chaves é da `MediaSource` que está morrendo: um carimbo antigo
    // faria a poda mirar um ponto que não está mais no buffer.
    chaves.length = 0;
    encalhesSeguidos = 0;
    recuarAlvo();
    // A mídia nova volta a esperar o PRIMEIRO quadro, e essa espera não é uma
    // parada — ver `dobrarAberto`.
    houveQuadro = false;
    fila.length = 0;
    // E O QUE AINDA ESTÁ NO FIO TAMBÉM VAI FORA — sem isto o recomeço não
    // recomeça nada, e o defeito é o pior tipo: silencioso e circular.
    //
    // `recomecar` é chamado de DENTRO de `processar()` (o caminho é
    // receber → enfileirar/aplicar → recomecar), e ao voltar aquele laço
    // continua desmontando os bytes que já estavam no buffer da conexão morta.
    // Esses quadros viravam fragmento e entravam numa `fila` recém-esvaziada —
    // ou seja, ficavam NA FRENTE do segmento de inicialização que a conexão
    // seguinte vai enfileirar de dentro do `sourceopen`. O primeiro
    // `appendBuffer` da `MediaSource` nova era então um fragmento de mídia sem
    // init: o Chromium recusa, dispara `error`, e o cliente recomeça de novo.
    // É o laço de "o decodificador recusou os dados" a cada poucos segundos.
    //
    // Zerar o buffer de desmontagem faz o `processar()` em curso devolver o
    // controle na próxima volta (`disponivel < CAB`) e nada mais é muxado desta
    // conexão.
    pedacos.length = 0;
    disponivel = 0;
    cabecalho = null;
    // A CONEXÃO CAI JUNTO, e sem isto o recomeço não recomeça nada: o `csd`
    // (`0x01`) e o IDR só chegam na ABERTURA de uma conexão (§5.3). Uma
    // `MediaSource` nova sem um `csd` novo ficaria esperando para sempre, com
    // quadros delta chegando e sendo descartados, e nada na tela dizendo por
    // quê. Quem reabre é o laço; `tentativa` zera para a espera ser a curta.
    tentativa = 0;
    if (abortar) { try { abortar.abort(); } catch (_) {} abortar = null; }
    emVoo = null;
    podaPedida = false;
    cotaSeguidas = 0;
    posicionado = false;
    esperandoChave = true;
    sbV = null;
    sbA = null;
    mime = '';
    mimeA = '';
    audioDesde = 0;
    audioUltimoMs = 0;
    if (esperaAudio) { clearTimeout(esperaAudio); esperaAudio = null; }
    initVideoRetido = null;
    if (muxer) { muxer.descartar(); muxer.descartarAudio(); }
    if (ms) {
      try {
        if (ms.readyState === 'open') {
          // TODAS as faixas, de trás para a frente: `sourceBuffers` é uma lista
          // VIVA, e remover pelo índice 0 num laço crescente pula a segunda.
          for (let i = ms.sourceBuffers.length - 1; i >= 0; i--) {
            ms.removeSourceBuffer(ms.sourceBuffers[i]);
          }
        }
      } catch (_) {}
    }
    ms = null;
    try {
      if (el.v.src) { URL.revokeObjectURL(el.v.src); el.v.removeAttribute('src'); el.v.load(); }
    } catch (_) {}
    // `suave` é o recomeço PEDIDO (ligar o som): ele não é falha, e pintá-lo de
    // vermelho no meio do culto diria a coisa errada a quem acabou de tocar na
    // tela.
    if (suave) avisar(porque ? porque + '…' : '');
    else avisar(porque ? 'Recomeçando: ' + porque + '.' : 'Recomeçando…', true);
  }

  function parar() {
    vivo = false;
    // Solta a corrente de quadros: ela pode estar pendurada num quadro que
    // nunca vem (o congelamento), e ali `vivo` sozinho não a alcança.
    geracaoVfc++;
    vfcArmado = false;
    if (abortar) { try { abortar.abort(); } catch (_) {} abortar = null; }
    if (compasso) { clearInterval(compasso); compasso = null; }
    // O `csd` de vídeo retido morre com a conexão: soltá-lo depois abriria uma
    // `MediaSource` para um fluxo que não existe mais.
    if (esperaAudio) { clearTimeout(esperaAudio); esperaAudio = null; }
    initVideoRetido = null;
  }

  function comecar() {
    if (vivo) return;
    if (!temFluxo()) {
      // Sem fluxo de `fetch` NADA funciona — nem o modo imagem, que usa o mesmo
      // transporte (§3.11, invariante 12). Dizer isso é melhor que uma tela
      // preta eterna, e o relato já subiu no pareamento: o operador vê no
      // Registro QUAL navegador é esse.
      avisar('Este navegador não consegue receber o fluxo. Atualize-o ou use outro aparelho.', true);
      return;
    }
    vivo = true;
    muxer = global.AVFmp4.criar();
    ultimoAlive = Date.now();
    // O TOTAL DA SESSÃO nasce aqui, e SÓ aqui: ele existe justamente para
    // sobreviver aos saltos e às reconexões que zeram o pior caso.
    travouMs = 0;
    travouN = 0;
    saltos = 0;
    encalhes = 0;
    encalhesSeguidos = 0;
    podaSemChave = 0;
    chaves.length = 0;
    travouVisto = 0;
    houveQuadro = false;
    piorVfim = 99999;
    piorAfim = 99999;
    recuarAlvo();
    zerarPiores();
    armarQuadros();
    compasso = setInterval(function () {
      borda();
      // O RELATO SEGUE O COMPASSO, e não cada ponto de decisão: os ramos do som
      // são sete e nem todos passam por `avisar`. `relatar` deduplica pela
      // chave, então isto não gera tráfego nenhum enquanto nada muda — e
      // garante que qualquer mudança de estado chegue ao Registro do operador
      // sem que cada ramo novo precise lembrar de avisar.
      relatar();
      if (Date.now() - ultimoAlive > ALIVE_MS) { ultimoAlive = Date.now(); bater(); }
    }, BORDA_MS);
    laco();
  }

  // --------------------------------------------------------------------------
  // O GESTO — um toque, quatro efeitos (§3.11, invariante 9)
  // --------------------------------------------------------------------------

  async function gesto() {
    gestoFeito = true;
    el.gesto.hidden = true;
    doc.body.classList.add('projetando');

    try { if (el.play.requestFullscreen) await el.play.requestFullscreen(); } catch (_) {}

    // AS TELAS NASCEM MUDAS POR DECISÃO, não só por política (§3.11, inv. 10):
    // elas estão dentro da igreja, a 100–300 ms da PA, e três telas
    // desmutadas são três alto-falantes com eco. Quem está em outra sala é quem
    // aperta — e é este toque.
    //
    // E É AQUI, E SÓ AQUI, QUE A `MediaSource` É REMONTADA PARA GANHAR SOM. O
    // Chromium recusa `addSourceBuffer` depois que ela inicializou (ver o
    // cabeçalho da seção da mídia), então a faixa de áudio não pode ser
    // acrescentada a uma projeção em curso: ou ela nasce junto, ou tudo nasce de
    // novo. Amarrar a remontagem ao GESTO — e não à chegada do `csd` de áudio —
    // é o que garante que ela aconteça UMA vez, num instante em que o visitante
    // está olhando para a tela porque acabou de tocar nela.
    audioQuerido = true;
    porqueSemSom = 'pedido, esperando o csd';
    // Tentativa NOVA, prazo novo: o toque do visitante é um pedido explícito.
    esperaAudioAte = 0;
    try {
      el.v.muted = false;
      pedirAudio();
    } catch (_) {}
    tentarSom();
    tocar();

    // CINTO E SUSPENSÓRIO, nunca o único cinto: quem segura a tela acesa no
    // modo vídeo é o wake lock do próprio `<video>` tocando, que não pede
    // contexto seguro nenhum. Este só existe quando houver TLS.
    if (global.isSecureContext && global.navigator.wakeLock) {
      try { await global.navigator.wakeLock.request('screen'); } catch (_) {}
    }
  }

  // "Ligar o som" é REMONTAR, e por isso mora numa função com nome.
  //
  // A faixa de áudio não pode ser acrescentada a uma `MediaSource` que já
  // inicializou (ver o cabeçalho da seção da mídia), então ou ela nasce junto
  // com a de imagem, ou tudo nasce de novo. Só quem toca na tela chega aqui —
  // nunca a chegada de um `csd`, que produziria um laço de remontagens —, e o
  // teto de [REBUILDS_AUDIO] garante que a projeção nunca pisque mais que isso
  // por causa do som. É também o caminho de VOLTA depois de o vigia ter soltado
  // a faixa: o visitante toca de novo e o som retorna.
  function tentarSom() {
    if (!audioQuerido || sbA || !ms) return;
    if (rebuilds >= REBUILDS_AUDIO) return;
    rebuilds++;
    // O PRAZO DO `csd` DE ÁUDIO NASCE DE NOVO A CADA TENTATIVA, e sem esta
    // linha a v5.153 condenava a tela ao silêncio permanente. Aquele prazo é
    // ABSOLUTO e atravessa reconexões de propósito (senão uma tela que
    // reconecta a cada dois segundos espera para sempre) — só que, uma vez
    // VENCIDO, ele nunca mais deixava a retenção acontecer: toda conexão
    // seguinte abria a `MediaSource` só com imagem no primeiro `csd` de vídeo,
    // o `csd` de áudio chegava "tarde", e as três remontagens do teto se
    // gastavam sem nenhuma delas ter chegado a esperar. Uma tentativa NOVA —
    // o toque do visitante, ou uma remontagem — merece um prazo novo, e o teto
    // de [REBUILDS_AUDIO] continua limitando quantas existem.
    esperaAudioAte = 0;
    recomecar('Ligando o som', true);
  }

  // --------------------------------------------------------------------------
  // Partida
  // --------------------------------------------------------------------------

  function acordar() {
    doc.addEventListener('visibilitychange', function () {
      if (doc.visibilityState === 'visible') {
        acesaDesde = Date.now();
      } else {
        acesaMs += Date.now() - acesaDesde;
      }
    });
  }

  function iniciar() {
    ['par', 'pin', 'pinBox', 'parBtn', 'parMsg', 'qrBox', 'qr', 'play', 'v', 'gesto', 'aviso'].forEach(function (id) {
      el[id] = doc.getElementById(id);
    });
    if (!el.par || !el.play) return;      // não é a página do espelho

    el.parBtn.addEventListener('click', parear);
    el.pin.addEventListener('keydown', function (e) { if (e.key === 'Enter') parear(); });
    el.gesto.addEventListener('click', gesto);
    // Um toque em qualquer lugar da projeção vale como o gesto: um visitante
    // que não viu o botão ainda assim consegue a tela cheia. E, depois do
    // primeiro, um toque vale como "tenta o som de novo" — é a saída da tela
    // que ficou sem áudio, dita por ela mesma no aviso.
    el.play.addEventListener('click', function () { if (gestoFeito) tentarSom(); else gesto(); });
    // O MOTIVO DE VERDADE mora aqui, e não no `SourceBuffer`: é o `MediaError`
    // do elemento que traz a frase do demuxer do Chromium. Se a mensagem do
    // recomeço já saiu sem detalhe (a ordem dos dois eventos não é garantida),
    // esta a completa — e o relato ao celular sai junto, porque `avisar` chama
    // `relatar`.
    el.v.addEventListener('error', function () {
      const p = porqueDaMidia();
      const atual = el.aviso ? el.aviso.textContent || '' : '';
      if (p && atual.indexOf('[') < 0) avisar((atual || 'O navegador rejeitou o vídeo') + p, true);
    });
    acordar();

    token = guardado();
    // O QR NASCE JUNTO COM A PÁGINA — sem toque, sem foco, sem nada a digitar.
    // É uma TV: ninguém vai clicar em "gerar código". O campo do PIN não recebe
    // foco por isso mesmo: um teclado virtual abrindo sozinho numa smart TV
    // cobriria justamente o código que ela precisa mostrar.
    if (token) aoPlayer();
    else cicloQr();
  }

  // O ESTADO, LEGÍVEL DE FORA. Esta página não tem Registro — o Registro do
  // operador está no celular, e o que chega lá é o `alive`. Isto aqui é a
  // janela de quem estiver com um console aberto ao lado do aparelho, e é
  // também o que `tools/espelho-cliente.test.mjs` inspeciona. Só leitura:
  // nada aqui liga ou desliga coisa nenhuma.
  global.__espelho = {
    estado: function () {
      return {
        pareado: !!token, vivo: vivo,
        // O QR em cartaz: `qr` é o desenho na tela, `qrId` diz se há espera
        // criada. Os dois juntos separam "o servidor não deu id" de "deu e o
        // desenho falhou" — que na tela são o mesmo espaço vazio.
        qr: !!(el.qrBox && !el.qrBox.hidden), qrId: !!qrId,
        mime: mime, fila: fila.length, posicionado: posicionado,
        quadros: conta.quadros, bytes: conta.bytes,
        recomecos: conta.recomecos, reconexoes: conta.reconexoes,
        // O som, do jeito que ele falha: `audioQuerido` sem `audio` é "esta
        // tela pediu e não recebeu", que é a leitura que faltava no aparelho.
        audioQuerido: audioQuerido, audio: !!sbA, mimeAudio: mimeA,
        quadrosAudio: conta.quadrosAudio, mudo: el.v ? !!el.v.muted : true,
        aviso: el.aviso ? el.aviso.textContent : '',
      };
    },
    relato: relato,
    // A REGRA DA BORDA AO VIVO, exposta para ser AFIRMADA e não para ser usada.
    // Ver o KDoc de `bordaViva`: ela é o que impede o cursor de passar do fim
    // da faixa de som — o micro-travamento com o som ligado —, e é aritmética
    // pura, então o teste a prova sem precisar de um AAC que o Chromium do CI
    // não tem.
    bordaViva: bordaViva,
    // O ENCALHE, pela mesma razão: `indiceNoCursor` é a regra que separa "a
    // tela está atrasada" de "a tela está PARADA", e toda a v5.158 depende de
    // ela estar certa. Montar um buraco de verdade no buffer exigiria uma
    // sequência de fragmentos que o Chromium do CI não decodifica; a regra é
    // aritmética e se prova com um `TimeRanges` de mentira.
    indiceNoCursor: indiceNoCursor,
    folgaDoCursor: folgaDoCursor,
    medidas: medidasDaTela,
  };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})(window);
