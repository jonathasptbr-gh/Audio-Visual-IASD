// ============================================================================
// TRANSMISSÃO DIRETA — um player DASH mínimo sobre MediaSource (v5.120)
//
// ## O que ele resolve
//
// Um vídeo do YouTube tinha dois caminhos, e os dois cobravam caro: BAIXAR
// ANTES (centenas de MB de espera antes do primeiro quadro) ou o PLAYER
// EMBUTIDO, que traz a UI dele junto — rodinha, botão grande na pausa, tela
// final —, e `controls: 0` não desliga nada disso porque não são *controles*.
// Num telão de culto isso aparece.
//
// Aqui o vídeo vira um `<video>` COMUM alimentado por `MediaSource`. Daí para a
// frente é mídia como qualquer outra: fade, cortina, `MediaSession`, barra e
// segundo plano, sem um pixel de YouTube no telão.
//
// ## Por que isto é nosso, contra a regra do projeto
//
// A regra diz para não reimplementar o que uma biblioteca faz. Aqui não há
// alternativa aplicável: um player DASH de prateleira (dash.js, Shaka) são
// centenas de kB de terceiro para um caso — duas faixas, um perfil, sem DRM,
// sem múltiplas qualidades, sem legenda. Este arquivo faz muito menos que um
// player DASH: **não** troca de qualidade, **não** lê MPD, **não** faz ABR. Ele
// lê um `sidx`, pede pedaços e os entrega ao navegador.
//
// O preço está declarado: isto é superfície NOSSA. Por isso cada ponto de falha
// avisa quem chamou (`onErro`), e quem chamou tem para onde cair — o download e
// o player embutido continuam existindo, inteiros.
//
// ## O que ele NÃO faz
//
// Não busca as faixas (é o shell, com a mesma fila de candidatos do download) e
// não fala com o `googlevideo` (é o `StreamProxy`, no origin do app, com o UA
// que combina com a URL). Aqui só entram bytes que já chegaram.
// ============================================================================
(function (global) {
  'use strict';

  // Quantos segundos manter à frente do ponto tocado. Vinte cobre uma oscilação
  // de rede de igreja sem prender megabytes de um vídeo que o operador pode
  // trocar no segundo seguinte — e é o dobro do que um seek típico consome
  // antes de o pedido seguinte chegar.
  const ALVO_S = 20;
  // O compasso do abastecimento. `updateend` já dispara a maior parte dos
  // ciclos; este intervalo cobre o caso em que TUDO está satisfeito e nada mais
  // dispararia evento nenhum — sem ele, o player pararia de pedir ao encher o
  // buffer e só voltaria a acordar num seek.
  //
  // **ELE NÃO PODE SER O ÚNICO A ACORDAR O PLAYER** — ver `EVENTOS_DO_COMPASSO`.
  const TICK_MS = 400;
  // ===== O COMPASSO NÃO PODE DEPENDER SÓ DE UM `setInterval` (v1.2.0) =====
  //
  // Relato do operador: *"vídeos tocando direto do YouTube sem baixar são
  // interrompidos quando o app está em segundo plano"*. Um arquivo BAIXADO não
  // é: ali o `<video>` toca sozinho e nenhum JavaScript precisa rodar durante a
  // reprodução. Aqui precisa — quem repõe o buffer é este laço.
  //
  // E o laço morria por uma razão que não é nossa: **um `setInterval` de página
  // em segundo plano é estrangulado pelo Chromium** (1×/s, e 1×/min depois de
  // alguns minutos escondida). Com `ALVO_S` em 20 s de buffer e um compasso de
  // até um minuto, a sequência é aritmética: o buffer enche, nenhum
  // `updateend` sai porque nada mais é appendado, o vídeo consome os 20 s
  // guardados e trava — até o tique seguinte, que pode estar a quarenta
  // segundos dali. Do lado de quem assiste isso é a projeção parando sozinha,
  // sem erro em lugar nenhum.
  //
  // A saída é não depender de temporizador para o que a MÍDIA já anuncia: os
  // eventos do `<video>` nascem do pipeline de mídia, não do agendador de
  // tarefas, e continuam saindo com a página escondida. `timeupdate` sozinho
  // (~4 Hz enquanto toca) já cobre o caso normal; os outros três cobrem
  // justamente o instante em que ele PARA de sair — a mídia travou por falta de
  // dados, que é quando repor é mais urgente.
  //
  // O intervalo FICA, como piso: ele é o que ainda cobre a cena PAUSADA (sem
  // `timeupdate`) e o buffer cheio com o vídeo parado.
  const EVENTOS_DO_COMPASSO = ['timeupdate', 'progress', 'waiting', 'stalled'];
  // Quanto passado descartar quando o navegador reclamar de espaço. O MSE tem
  // cota, e num vídeo de 1080p ela é atingida antes do fim: descartar o que já
  // passou é o único jeito de continuar, e 30 s atrás do cursor é folga
  // suficiente para um retrocesso curto continuar instantâneo.
  const GUARDA_S = 30;
  // Prazo de um `appendBuffer` do caminho de inicialização. Generoso de
  // propósito: ele não existe para apertar o aparelho, existe para que uma
  // resposta que nunca vem vire ERRO em vez de silêncio eterno.
  const APPEND_MS = 15000;

  // AS FAIXAS QUE ESTE MANIFESTO TEM — uma ou duas.
  //
  // O manifesto do shell traz sempre o par (vídeo + áudio), mas o "Tocar agora ·
  // Só áudio" descarta a de vídeo antes de chegar aqui: quem pediu só o som não
  // tem por que baixar 1080p para jogar fora. Exigir as duas, como esta função
  // fazia, barrava a transmissão justamente no caso mais leve — o que menos
  // deveria esperar por download.
  //
  // Os papéis em PORTUGUÊS porque eles vão parar no Registro, que o operador lê
  // e repassa.
  function faixasDe(man) {
    if (!man) return [];
    return [['vídeo', man.video], ['áudio', man.audio]].filter((par) => par[1] && par[1].url);
  }

  function suportado(man) {
    if (!global.MediaSource) return false;
    const faixas = faixasDe(man);
    if (!faixas.length) return false;
    try {
      return faixas.every((par) => MediaSource.isTypeSupported(par[1].mime));
    } catch (_) { return false; }
  }

  // --------------------------------------------------------------------------
  // A FAIXA VIAJA NA URL, NÃO NO CABEÇALHO — NO APP
  //
  // Num WebView, o `InputStream` devolvido por `shouldInterceptRequest` é lido
  // pelo Chromium como o recurso INTEIRO a partir do byte 0: é ELE quem aplica
  // o `Range` da requisição, pulando `first_byte_position` bytes do que o app
  // entregou. Como o `StreamProxy` entrega só a fatia pedida, o deslocamento
  // saía aplicado duas vezes — e a única requisição que podia funcionar era a
  // que começa em 0, porque ali pular é um no-op. Era exatamente o que o
  // aparelho reportava: o `init` passava, o `índice` morria com "Failed to
  // fetch", sem status nenhum.
  //
  // Pedindo `?r=<ini>-<fim>` SEM cabeçalho `Range`, não há o que parsear e não
  // há seek: a fatia chega inteira. No navegador nada disso existe (não há
  // interceptador), então lá o `Range` continua sendo o jeito certo — e é o
  // caminho padrão, como manda a regra do projeto.
  //
  // É POR ISSO QUE ESTA PERGUNTA NÃO PODE VIRAR UMA CONSTANTE: ela separa o
  // navegador do WebView, não uma versão de shell de outra. O papel `tela` —
  // o mesmo `/display/` num navegador da rede — depende dela para pedir
  // `Range`, e lá não existe `__NATIVE__`.
  // --------------------------------------------------------------------------
  function faixaNaUrl() {
    return !!global.__NATIVE__;
  }

  // Devolve [url, opções] do `fetch`. Guarda na ordem da regra: o navegador é o
  // padrão, o nativo é a exceção declarada.
  function pedido(url, ini, fim) {
    if (!faixaNaUrl()) return [url, { headers: { Range: 'bytes=' + ini + '-' + fim } }];
    return [url + (url.indexOf('?') < 0 ? '?' : '&') + 'r=' + ini + '-' + fim, {}];
  }

  // --------------------------------------------------------------------------
  // O ÍNDICE (`sidx`) — o mapa de tempo → posição de cada fragmento.
  //
  // É ele que torna a coisa toda viável: com alguns kilobytes o player sabe
  // onde começa cada trecho do arquivo, e daí em diante pede só o que precisa.
  // Sem ele, "tocar aos 3:20" significaria baixar tudo até os 3:20.
  //
  // O formato é o do ISO/IEC 14496-12, e vale escrever o que cada campo é
  // porque um erro de deslocamento aqui não dá erro: dá vídeo que não toca.
  // --------------------------------------------------------------------------
  function lerSidx(buf, inicioDosDados) {
    const dv = new DataView(buf);
    // O box PROCURADO, e não assumido na posição 0: o `indexRange` do YouTube
    // costuma cobrir exatamente o `sidx`, mas nada no formato obriga isso — um
    // `styp` na frente é legal e deslocaria tudo em silêncio.
    let p = 0;
    while (p + 8 <= buf.byteLength) {
      const tam = dv.getUint32(p);
      const tipo = String.fromCharCode(
        dv.getUint8(p + 4), dv.getUint8(p + 5), dv.getUint8(p + 6), dv.getUint8(p + 7),
      );
      if (tipo === 'sidx') break;
      if (tam < 8) return null;
      p += tam;
    }
    if (p + 12 > buf.byteLength) return null;

    const versao = dv.getUint8(p + 8);
    // p+12 reference_ID (ignorado: uma faixa só)
    const escala = dv.getUint32(p + 16);
    if (!escala) return null;
    // `earliest_presentation_time` e `first_offset` mudam de 32 para 64 bits na
    // versão 1 — é o único ponto em que o tamanho do cabeçalho varia, e errá-lo
    // desloca TODAS as entradas.
    let q = p + 20;
    let primeiroDeslocamento = 0;
    if (versao === 0) {
      primeiroDeslocamento = dv.getUint32(q + 4);
      q += 8;
    } else {
      // Os 64 bits são lidos como Number: um deslocamento de vídeo cabe com
      // folga em 2^53, e `getBigUint64` obrigaria a converter em toda conta.
      primeiroDeslocamento = dv.getUint32(q + 8) * 4294967296 + dv.getUint32(q + 12);
      q += 16;
    }
    q += 2;                              // reserved
    const quantos = dv.getUint16(q); q += 2;
    if (!quantos || q + quantos * 12 > buf.byteLength) return null;

    const segs = [];
    let posicao = inicioDosDados + primeiroDeslocamento;
    let t = 0;
    for (let i = 0; i < quantos; i++) {
      // O bit mais alto de `referenced_size` é o `reference_type`: 1 significa
      // que a entrada aponta para OUTRO sidx, não para mídia. O YouTube não usa
      // sidx encadeado, mas mascarar o bit custa uma linha e evita um tamanho
      // absurdo caso um dia use.
      const bruto = dv.getUint32(q);
      const tamSeg = bruto & 0x7fffffff;
      const dur = dv.getUint32(q + 4) / escala;
      segs.push({ ini: posicao, fim: posicao + tamSeg - 1, t0: t, dur });
      posicao += tamSeg;
      t += dur;
      q += 12;
    }
    return segs;
  }

  // ===== A ESCOLHA DO DEGRAU — a regra, PURA e com oráculo =====
  //
  // Este player **não faz ABR** (está no cabeçalho), e é exatamente por isso
  // que a escolha importa: ela é feita UMA vez e vale o louvor inteiro.
  // Enquanto o manifesto trouxe uma faixa só, ela era feita CEGA — sempre o
  // teto —, e uma rede que não a sustenta produz TRAVAMENTO, nunca imagem
  // menor. Relato do operador: *"veio som, porém ficou travando e qualidade de
  // vídeo baixa"*.
  //
  // A conta é a de sustentação: uma faixa de `tamanho` bytes ao longo de
  // `segundos` precisa de `tamanho × 8 / segundos` bits por segundo, e o áudio
  // viaja junto — somá-lo não é zelo, é metade do problema num louvor, onde a
  // faixa de áudio pesa perto de um décimo do vídeo.
  //
  // A MARGEM não é conservadorismo: a medida sai dos primeiros bytes, isto é,
  // durante o slow start do TCP, e por isso ela SUBESTIMA. Daí a regra só poder
  // DESCER — uma medida que subestima nunca pode ser usada para justificar um
  // degrau mais alto, e não é: quem chama já começou no topo.
  //
  // **Sem escada, sem degrau**: um manifesto de shell antigo (sem `videos`)
  // devolve o índice 0 e nada muda — a degradação declarada.
  const MARGEM_BANDA = 1.35;
  function escolherDegrau(medidoBps, escada, audio, segundos) {
    if (!Array.isArray(escada) || escada.length < 2) return 0;
    if (!(medidoBps > 0) || !(segundos > 0)) return 0;
    const bytesAudio = (audio && audio.size) || 0;
    const cabe = (v) => {
      const bytes = ((v && v.size) || 0) + bytesAudio;
      // Faixa sem `size` (o `contentLength` do YouTube nasce em -1 quando ele
      // não o informa) não tem como ser julgada: aceitá-la é o certo — o
      // desfecho é o comportamento de antes desta regra, e não uma recusa por
      // um campo ausente. Ver o `dash` do Kotlin, que já paga esta lição.
      if (!(bytes > 0)) return true;
      return (bytes * 8 / segundos) * MARGEM_BANDA <= medidoBps;
    };
    for (let i = 0; i < escada.length; i++) if (cabe(escada[i])) return i;
    // Nada cabe: o degrau mais BAIXO, que é o mais próximo de caber. Recusar a
    // transmissão aqui mandaria a cena ao download de centenas de MB — pior em
    // toda leitura, e por uma rede que talvez sustente o menor.
    return escada.length - 1;
  }

  // A MARCA de "vale a pena tentar de novo", carregada no próprio erro. Ela
  // viaja no objeto e não numa tabela de mensagens porque quem SABE se o
  // tropeço foi acidente é quem o produziu — casar strings de erro depois é a
  // forma de errar que este arquivo já paga em outro lugar (ver o
  // `/HTTP 40[13]/` do `recuperarStream`, que é contrato justamente por isso).
  function marcar(erro, sim) {
    erro.retentavel = !!sim;
    return erro;
  }

  // --------------------------------------------------------------------------

  function criar(video, man, opts) {
    const onErro = (opts && opts.onErro) || function () {};
    let morto = false;
    // ===== O MEDIDOR: bytes ÷ tempo do que JÁ É BUSCADO =====
    //
    // Nenhuma requisição a mais. O init, o índice e o primeiro fragmento têm de
    // ser buscados de qualquer jeito, e são eles que dizem quanto esta rede
    // entrega — pelo caminho REAL (o nosso proxy até o googlevideo), não por um
    // endpoint de teste que mede outra coisa.
    //
    // Um teste de velocidade sintético seria pior nas três pontas: gastaria uma
    // requisição, mediria o mesmo slow start, e ainda assim mediria um INSTANTE.
    let medBytes = 0;
    let medMs = 0;
    // O DEGRAU SÓ TROCA ANTES DO PRIMEIRO QUADRO, e é isso que dispensa toda a
    // costura de tempo: nada foi mostrado (o `stage` segura o aro de espera até
    // `PRONTO_STREAM_MS`), o `currentTime` é zero, e trocar é recomeçar do
    // início em vez de emendar no meio. Depois disso a bandeira fecha para
    // sempre — uma troca com o louvor no ar é gagueira, e este projeto já
    // decidiu que gagueira é pior que uma escolha imperfeita.
    let degrauFeito = false;
    const escada = (man && Array.isArray(man.videos) && man.videos.length > 1) ? man.videos : null;
    let tick = null;
    // Os ouvintes de `EVENTOS_DO_COMPASSO` já estão no `<video>`? A bandeira
    // existe porque `morrer` pode ser chamado ANTES de `iniciar()` chegar a
    // armá-los (um mime recusado no `addSourceBuffer`, um init que não desce),
    // e `removeEventListener` de quem nunca foi adicionado é um no-op silencioso
    // que esconderia a ordem real dos fatos de quem ler isto depois.
    let compassoLigado = false;
    let objUrl = null;
    const ms = new MediaSource();
    const faixas = [];
    // Os fetches EM VOO agora (um AbortController por requisição — as duas
    // faixas podem buscar ao mesmo tempo, então não é um controller só).
    // Existe para `morrer`/`destruir`: sem o abort, os bytes de um telão que
    // já saiu de cena continuavam trafegando até o fim do segmento — rede
    // gasta por um vídeo que ninguém mais vai ver.
    const emVoo = new Set();

    function soltarCompasso() {
      if (!compassoLigado) return;
      compassoLigado = false;
      EVENTOS_DO_COMPASSO.forEach((ev) => {
        try { video.removeEventListener(ev, bombear); } catch (_) {}
      });
    }

    function morrer(porque) {
      if (morto) return;
      morto = true;
      clearInterval(tick);
      // Os ouvintes do compasso saem JUNTO do intervalo, e pelo mesmo motivo:
      // eles chamam `bombear()`, e um `<video>` que já mudou de fonte
      // continuaria emitindo `timeupdate` para um player morto.
      soltarCompasso();
      // Derruba as requisições em voo. Quem estava no `await` recebe um
      // AbortError, cai no catch de quem chamou e esbarra no `morto` já
      // ligado — nenhuma segunda mensagem de erro sai daqui.
      for (const ctl of emVoo) { try { ctl.abort(); } catch (_) {} }
      emVoo.clear();
      // NADA DE `endOfStream()` AQUI. Ele existe para dizer "a mídia acabou", e
      // num MediaSource que nunca recebeu um byte isso é mentira com
      // consequência: o `<video>` dispara `ended`, o stage cobre com o
      // wallpaper e o `autoAdvance` do Controle pula para o próximo item da
      // playlist — um segundo depois do "Tocar agora", sem ninguém entender
      // por quê. Quem sinaliza fim de verdade é `alimentar()`, quando todos os
      // fragmentos entraram. Aqui só se solta o que foi alocado.
      // A URL do objeto é revogada SEMPRE, inclusive na falha: cada
      // `createObjectURL` que não é revogado prende o MediaSource e, por ele,
      // os buffers — num app que troca de mídia dezenas de vezes por culto isso
      // é vazamento de verdade.
      if (objUrl) { try { URL.revokeObjectURL(objUrl); } catch (_) {} objUrl = null; }
      if (porque) {
        global.AVStream.ultimoErro = porque;
        onErro(porque);
      }
    }

    // ===== UMA FALHA DE REDE NÃO É O FIM DA TRANSMISSÃO (v1.2.0) =====
    //
    // Até aqui QUALQUER tropeço matava o player: um `fetch` que não completa
    // sobe pelo `alimentar` até o `morrer`, o Controle recebe `onStreamErro` e
    // `recuperarStream` derruba a cena e cai no download. Um vídeo de 300 MB
    // começando a baixar por causa de um pacote perdido.
    //
    // E é justamente em SEGUNDO PLANO que o tropeço acontece: o Wi-Fi do
    // aparelho entra em economia de energia com o app fora da frente, e o que
    // sai daí é uma conexão que cai e volta em segundos. O download já sabia
    // disso desde sempre (`YoutubeGrab.baixar`: oito tentativas com espera
    // crescente, e 4xx nunca retentado); a transmissão era o único caminho de
    // rede do app sem nenhuma.
    //
    // **A DIVISÃO É A MESMA DO DOWNLOAD, e ela não é preciosismo:** 401/403 é a
    // URL do googlevideo EXPIRADA, e insistir nela é gastar segundos para
    // receber o mesmo 403 — quem conserta isso é `recuperarStream`, que
    // re-extrai o manifesto, e ele reconhece o caso pela MENSAGEM (`HTTP 403`).
    // Retentar aqui atrasaria a única resposta que funciona. O que se retenta é
    // o que pode ter sido um acidente: a requisição que não completou e o 5xx.
    const TENTATIVAS = 4;
    const ESPERA_MS = [400, 1200, 3000];

    function retentavel(e) {
      return !!(e && e.retentavel);
    }

    function dormir(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    // O `passo` viaja junto do erro porque "não deu" não leva a lugar nenhum:
    // este player busca três coisas por faixa — inicialização, índice e mídia —
    // e cada uma falha por um motivo diferente, com um conserto diferente.
    //
    // A ESPERA É INTERROMPÍVEL pelo `morto`: um `destruir()` durante os 3 s da
    // última espera não pode render uma requisição a mais para uma cena que já
    // saiu do telão.
    async function pegar(url, ini, fim, passo) {
      let ultima = null;
      for (let t = 0; t < TENTATIVAS; t++) {
        if (t) {
          await dormir(ESPERA_MS[Math.min(t - 1, ESPERA_MS.length - 1)]);
          if (morto) throw ultima;
        }
        try {
          return await pegarUmaVez(url, ini, fim, passo);
        } catch (e) {
          if (morto || !retentavel(e)) throw e;
          ultima = e;
        }
      }
      throw ultima;
    }

    async function pegarUmaVez(url, ini, fim, passo) {
      const alvo = pedido(url, ini, fim);
      const t0 = Date.now();
      // Abortável: o controller entra no conjunto `emVoo` enquanto a
      // requisição vive, e `morrer` derruba todos de uma vez. O finally o
      // tira do conjunto em QUALQUER desfecho — sucesso, erro HTTP, abort.
      const ctl = typeof AbortController === 'function' ? new AbortController() : null;
      if (ctl) { alvo[1].signal = ctl.signal; emVoo.add(ctl); }
      try {
        let r;
        try {
          r = await fetch(alvo[0], alvo[1]);
        } catch (e) {
          // A FAIXA VAI JUNTO, e isto não é enfeite: este era o único dos três
          // ramos de `pegar()` que não imprimia os números, e foi justamente ele
          // que falhou em aparelho. A investigação inteira teve de deduzir por
          // aritmética o que uma linha de log teria dito.
          // ABORT NÃO É TROPEÇO: ele vem de `morrer`/`destruir`, isto é, de uma
          // decisão nossa. Marcá-lo como retentável faria a saída de cena
          // custar quatro requisições a um servidor que ninguém mais espera.
          const abortou = !!(e && e.name === 'AbortError');
          throw marcar(new Error(passo + ': a requisição não completou ('
            + ((e && e.message) || '?') + ') pedindo bytes ' + ini + '-' + fim), !abortou);
        }
        // 200 é aceito além do 206: um proxy pode responder a faixa inteira, e
        // recusar isso quebraria por preciosismo.
        if (!r.ok && r.status !== 206) {
          // O `statusText` carrega o MOTIVO quando quem respondeu foi o nosso
          // proxy (ver `StreamProxy.erro`): "token desconhecido", "googlevideo:
          // Forbidden", o texto de uma falha de rede. Sem ele sobra um número, e
          // um 404 do proxy e um 404 do asset loader se leem igual — apontando
          // para lugares opostos.
          // 5xx e 429 são do SERVIDOR e passam; 4xx é a URL expirada ou negada,
          // e a resposta certa a ela mora no `recuperarStream` do Controle.
          throw marcar(new Error(passo + ': HTTP ' + r.status
            + (r.statusText ? ' (' + r.statusText + ')' : '')
            + ' pedindo bytes ' + ini + '-' + fim), r.status >= 500 || r.status === 429);
        }
        // O CORPO TAMBÉM PODE MORRER NO MEIO, e este era o ramo sem tratamento:
        // os cabeçalhos chegam, a conexão cai antes do último byte e o
        // `arrayBuffer()` rejeita com um erro do navegador, sem `passo` nenhum.
        // É o desfecho mais provável de um Wi-Fi que entra em economia de
        // energia — exatamente o caso que este lote existe para atravessar.
        let buf;
        try {
          buf = await r.arrayBuffer();
        } catch (e) {
          const abortou = !!(e && e.name === 'AbortError');
          throw marcar(new Error(passo + ': o corpo não chegou inteiro ('
            + ((e && e.message) || '?') + ') pedindo bytes ' + ini + '-' + fim), !abortou);
        }
        // ZERO BYTES com status bom é o caso mais traiçoeiro: o `appendBuffer`
        // aceita sem reclamar e o vídeo simplesmente nunca começa. Melhor falhar
        // aqui, com o número na mão.
        if (!buf.byteLength) {
          throw marcar(new Error(passo + ': resposta vazia (HTTP ' + r.status + ', pedidos '
            + (fim - ini + 1) + ' bytes)'), true);
        }
        // SÓ O QUE DEU CERTO ENTRA NA CONTA. Uma tentativa que falhou mediu o
        // tempo até o erro, não a entrega — e um 403 rápido inflaria a banda
        // exatamente no caso em que nada foi entregue.
        medBytes += buf.byteLength;
        medMs += Math.max(1, Date.now() - t0);
        return buf;
      } finally {
        if (ctl) emVoo.delete(ctl);
      }
    }

    // Quanto já está bufferizado À FRENTE de `t`, na faixa dada.
    function adiante(sb, t) {
      try {
        for (let i = 0; i < sb.buffered.length; i++) {
          if (sb.buffered.start(i) <= t + 0.1 && sb.buffered.end(i) > t) {
            return sb.buffered.end(i) - t;
          }
        }
      } catch (_) {}
      return 0;
    }

    function indiceEm(segs, t) {
      for (let i = 0; i < segs.length; i++) {
        if (t < segs[i].t0 + segs[i].dur) return i;
      }
      return segs.length;
    }

    // Descarta o passado quando o navegador reclama de cota. Só isso: nada de
    // política de cache própria — quem sabe quando o espaço acabou é ele.
    function podar(f) {
      const t = video.currentTime - GUARDA_S;
      if (t <= 0) return false;
      try { f.sb.remove(0, t); return true; } catch (_) { return false; }
    }

    async function alimentar(f) {
      if (morto || f.ocupada || !f.segs) return;
      if (f.sb.updating) return;
      if (f.i >= f.segs.length) {
        // Todas as faixas no fim: o `endOfStream` é o que faz o `<video>`
        // conhecer a duração real e disparar `ended` — sem ele o vídeo trava no
        // último quadro, com o transporte achando que ainda está tocando.
        if (faixas.every((x) => x.segs && x.i >= x.segs.length && !x.sb.updating)) {
          try { if (ms.readyState === 'open') ms.endOfStream(); } catch (_) {}
        }
        return;
      }
      if (adiante(f.sb, video.currentTime) > ALVO_S) return;
      f.ocupada = true;
      // Um seek reposicionou o índice enquanto o fetch corria (ver abaixo):
      // este compasso não appendou nada, e o próximo precisa vir logo.
      let reposicionada = false;
      try {
        // O índice é CAPTURADO antes do await: `aoBuscar` (evento `seeking`)
        // escreve `f.i` no meio dele, e o `f.i++` cego de antes incrementava o
        // índice NOVO do seek — o segmento do ponto buscado nunca era pedido,
        // ficava um buraco no buffer e o vídeo travava ali enquanto a bomba
        // seguia baixando os seguintes.
        const idx = f.i;
        let buf;
        if (f.pendenteBuf && f.pendenteIdx === idx) {
          // Segmento já baixado que a cota devolveu (ver o Quota abaixo):
          // tenta o append dele antes de gastar rede de novo.
          buf = f.pendenteBuf;
        } else {
          // Se havia um pendente de OUTRO índice, um seek moveu o alvo desde
          // que ele foi guardado: o buf é de outro ponto e reaproveitá-lo
          // incrementaria o índice errado — descarta e busca o certo.
          f.pendenteBuf = null;
          const seg = f.segs[idx];
          buf = await pegar(f.url, seg.ini, seg.fim, 'mídia ' + f.papel + ' #' + idx);
        }
        if (morto || ms.readyState !== 'open') return;
        if (f.i !== idx) {
          // O seek moveu o alvo durante o await: descartar é o certo — o
          // append cairia no lugar certo (fragmentos carregam o próprio
          // tempo), mas o incremento pularia o segmento do ponto buscado.
          // O próximo compasso pede o segmento certo.
          reposicionada = true;
          return;
        }
        // A AVALIAÇÃO DO DEGRAU vem DEPOIS do fetch e ANTES do append, e as duas
        // metades da posição importam: depois, porque é o fetch que produz a
        // medida (o primeiro fragmento é o maior pedaço que este player busca, e
        // o único grande o bastante para a conta não ser puro RTT); antes,
        // porque um append que a troca vai apagar em seguida é trabalho jogado
        // fora — e, pior, faria o `f.i++` andar sobre um índice que a troca
        // acabou de substituir.
        //
        // Ela roda DENTRO do `f.ocupada`, então nenhum outro compasso alimenta
        // esta faixa enquanto o degrau é trocado.
        if (!degrauFeito) {
          const trocou = await talvezTrocarDegrau(f);
          if (morto || ms.readyState !== 'open') return;
          // A troca aconteceu: este `buf` é do degrau ANTIGO e o índice voltou a
          // zero. Descartá-lo é o certo — o próximo compasso pede o segmento
          // certo, do degrau novo.
          //
          // O DESFECHO É O RETORNO, e não uma comparação de `f.i`: o caso comum
          // é a troca no PRIMEIRO fragmento, e ali `idx` e o `f.i` novo valem
          // ZERO os dois — a comparação aprovaria o append do buffer velho por
          // cima do init novo, que é a corrupção mais silenciosa que este
          // caminho sabe produzir.
          if (trocou) { reposicionada = true; return; }
        }
        try {
          f.sb.appendBuffer(buf);
          f.pendenteBuf = null;
          f.i++;
        } catch (e) {
          // QuotaExceededError é ESPERADO num vídeo longo, e não é falha: poda
          // o passado e tenta de novo no próximo compasso. O segmento já
          // baixado fica GUARDADO para essa retentativa — jogá-lo fora, como
          // era, pagava a rede duas vezes pelo mesmo pedaço, justamente no
          // vídeo grande em que a cota aperta. Qualquer outro erro é real e
          // sobe.
          if (e && e.name === 'QuotaExceededError' && podar(f)) {
            f.pendenteBuf = buf;
            f.pendenteIdx = idx;
            return;
          }
          throw e;
        }
      } catch (e) {
        morrer((e && e.message) || ('mídia ' + f.papel + ': append falhou'));
      } finally {
        f.ocupada = false;
        // O `bombear` do seek bateu na porta com `ocupada` ligada e foi
        // embora; sem este reengate, quem re-alimentaria a faixa seria só o
        // compasso de TICK_MS — um respiro visível a cada seek à toa.
        if (reposicionada && !morto) bombear();
      }
    }

    function bombear() { faixas.forEach(alimentar); }

    function aoAbrir() {
      try {
        // A DURAÇÃO vem do manifesto, não do sidx: ela é o que a barra de
        // progresso do app lê no `loadedmetadata`, e somar as durações dos
        // fragmentos daria um valor levemente diferente entre as duas faixas.
        if (man.seconds > 0) ms.duration = man.seconds;
        // UMA OU DUAS faixas, conforme o manifesto (ver `faixasDe`): o "Só
        // áudio" chega aqui com a de vídeo já descartada, e um `addSourceBuffer`
        // de vídeo para uma faixa que não existe lançaria antes de qualquer byte
        // ser pedido.
        faixasDe(man).forEach(([papel, t]) => {
          const sb = ms.addSourceBuffer(t.mime);
          sb.mode = 'segments';
          // `pendenteBuf`/`pendenteIdx`: segmento baixado que um
          // QuotaExceededError devolveu — retentado no próximo compasso em
          // vez de rebaixado da rede (ver `alimentar`).
          const f = {
            papel, sb, url: t.url, meta: t, segs: null, i: 0, ocupada: false,
            pendenteBuf: null, pendenteIdx: 0,
          };
          sb.addEventListener('updateend', bombear);
          // MESMA REDAÇÃO do erro de `appendBuffer`, e é o mesmo defeito visto
          // de outro ângulo: os bytes chegaram e o navegador não os quis. Ele
          // dispara por evento (e não por exceção) quando a recusa acontece
          // depois do append aceitar o buffer — e "vídeo sourcebuffer", que era
          // o texto antigo, não dizia nada a ninguém.
          sb.addEventListener('error', () => morrer(
            papel + ': o decodificador recusou os dados — mime ' + t.mime,
          ));
          faixas.push(f);
        });
      } catch (e) {
        morrer('addSourceBuffer: ' + ((e && e.message) || '?'));
        return;
      }
      iniciar();
    }

    // ===== A TROCA DE DEGRAU, e a guarda que a torna segura =====
    //
    // Ela só corre antes do primeiro quadro, então o `remove(0, Infinity)` apaga
    // exatamente o que foi appendado até aqui (o init e um ou dois fragmentos do
    // segundo zero) e o índice recomeça em 0 — sem alinhamento de tempo, que é a
    // parte de um player DASH que este arquivo não tem e não vai ter.
    //
    // **QUALQUER FALHA AQUI MANTÉM O DEGRAU ATUAL.** É a propriedade que torna
    // esta função aceitável num culto: no pior caso a transmissão continua
    // exatamente como continuaria sem ela. Por isso o `catch` não chama
    // `morrer()` — uma otimização que derruba a projeção é pior que a projeção
    // sem otimização.
    const AMOSTRA_MIN = 192 * 1024;   // bytes antes de a medida valer alguma coisa
    async function talvezTrocarDegrau(f) {
      if (degrauFeito || !escada || f.papel !== 'vídeo') return false;
      // JÁ COMEÇOU A TOCAR: tarde demais, e a bandeira fecha para sempre.
      if (video.currentTime > 0.01) { degrauFeito = true; return false; }
      if (medBytes < AMOSTRA_MIN || medMs <= 0) return false;
      const medido = medBytes * 8000 / medMs;
      global.AVStream.banda = Math.round(medido);
      const i = escolherDegrau(medido, escada, man.audio, man.seconds);
      const novo = escada[i];
      // O topo continua servindo: nada a fazer, e a bandeira fecha para não
      // remedir a cada fragmento.
      if (!novo || novo.url === f.url) { degrauFeito = true; return false; }
      degrauFeito = true;
      try {
        await esperarSbLivre(f.sb);
        if (morto) return false;
        try {
          f.sb.remove(0, Infinity);
          await esperarSbLivre(f.sb);
        } catch (_) { /* nada a remover ainda */ }
        if (morto) return false;
        // `changeType` quando o navegador o tem E o mime mudou: dois perfis de
        // AVC no mesmo SourceBuffer é o caso que ele existe para cobrir. Sem
        // ele o append do init novo costuma passar assim mesmo — daí o `try`.
        if (novo.mime && novo.mime !== f.meta.mime && typeof f.sb.changeType === 'function') {
          try { f.sb.changeType(novo.mime); } catch (_) { /* segue com o antigo */ }
        }
        const init = await pegar(novo.url, novo.initStart, novo.initEnd, 'init vídeo (degrau)');
        if (morto) return false;
        await aplicar(f, init);
        const idx = await pegar(novo.url, novo.indexStart, novo.indexEnd, 'índice vídeo (degrau)');
        if (morto) return false;
        const segs = lerSidx(idx, novo.indexEnd + 1);
        // FICA NO DEGRAU QUE JÁ FUNCIONAVA — mas o init NOVO já foi appendado,
        // e a partir dele o `SourceBuffer` passou a descrever a faixa nova. Os
        // fragmentos antigos seriam decodificados contra a descrição errada.
        // `iniciar()` não roda uma segunda vez, então repor o init antigo é
        // trabalho DESTE ponto — e só depois dele se devolve `false`.
        if (!segs || !segs.length) { await reporInit(f); return false; }
        f.meta = novo;
        f.url = novo.url;
        f.segs = segs;
        f.i = 0;
        f.pendenteBuf = null;
        f.initBuf = init;
        global.AVStream.degrau = (novo.altura ? novo.altura + 'p' : '?')
          + ' (medido ' + Math.round(medido / 1000) + ' kbps)';
        return true;
      } catch (_) {
        // O DEGRAU ANTIGO CONTINUA DE PÉ — mas se a falha veio DEPOIS do append
        // do init novo, o `SourceBuffer` está descrito por ele e os fragmentos
        // antigos seriam decodificados errado. Repor o init antigo fecha essa
        // janela; falhando também isso, não há o que fazer além de deixar o
        // `onErro` de sempre agir no compasso seguinte.
        await reporInit(f);
        return false;
      }
    }

    // Devolve o `SourceBuffer` ao init do degrau que `f.meta` descreve. Sem
    // rede quando dá para evitar: o init do degrau em uso é guardado na entrada.
    async function reporInit(f) {
      try {
        await esperarSbLivre(f.sb);
        if (morto) return;
        const init = f.initBuf
          || await pegar(f.url, f.meta.initStart, f.meta.initEnd, 'init ' + f.papel + ' (volta)');
        if (morto) return;
        await aplicar(f, init);
      } catch (_) { /* o `onErro` do compasso seguinte cobre o que sobrar */ }
    }

    // `updateend` como Promise — o `remove` e o `appendBuffer` são assíncronos e
    // só UM por SourceBuffer por vez.
    //
    // **COM PRAZO, e ele não é zelo.** Esta espera roda com `f.ocupada` segurado
    // (a troca de degrau acontece dentro do `alimentar`), e um `updateend` que
    // nunca venha — o `SourceBuffer` desanexado por um `endOfStream`, a
    // `MediaSource` fechada no meio — deixaria a faixa de vídeo travada PARA
    // SEMPRE, sem erro em lugar nenhum: exatamente o modo de falhar que o
    // `CALL_TIMEOUT_MS` da ponte existe para não ter. Vencido o prazo a Promise
    // resolve mesmo assim; o `remove`/`appendBuffer` seguinte lança sobre um
    // `sb` ocupado, e o `catch` da troca devolve o degrau antigo — que é o
    // desfecho seguro desta função inteira.
    const SB_PRAZO_MS = 5000;
    function esperarSbLivre(sb) {
      return new Promise((r) => {
        if (!sb.updating) { r(); return; }
        let pronto = false;
        const fim = () => { if (!pronto) { pronto = true; clearTimeout(t); r(); } };
        const t = setTimeout(fim, SB_PRAZO_MS);
        sb.addEventListener('updateend', fim, { once: true });
      });
    }

    async function iniciar() {
      try {
        for (const f of faixas) {
          // O SEGMENTO DE INICIALIZAÇÃO (`ftyp` + `moov`) primeiro: ele descreve
          // a faixa, e um fragmento de mídia entregue antes dele é rejeitado.
          const init = await pegar(f.url, f.meta.initStart, f.meta.initEnd, 'init ' + f.papel);
          if (morto) return;
          // GUARDADO para a volta de uma troca de degrau que não deu certo (ver
          // `reporInit`). São alguns kB, e é a diferença entre desfazer sem rede
          // e depender dela justamente quando ela acabou de falhar.
          f.initBuf = init;
          try {
            await aplicar(f, init);
          } catch (e2) {
            morrer('init ' + f.papel + ': o decodificador recusou (' + ((e2 && e2.message) || '?')
              + ') — mime ' + f.meta.mime);
            return;
          }
          const idx = await pegar(f.url, f.meta.indexStart, f.meta.indexEnd, 'índice ' + f.papel);
          if (morto) return;
          f.segs = lerSidx(idx, f.meta.indexEnd + 1);
          if (!f.segs || !f.segs.length) {
            morrer('índice ' + f.papel + ': sidx não reconhecido ('
              + idx.byteLength + ' bytes em ' + f.meta.indexStart + '-' + f.meta.indexEnd + ')');
            return;
          }
        }
        // `aoBuscar()` E NÃO `bombear()` — ela termina chamando `bombear()`, e o
        // que ela acrescenta é reaplicar a POSIÇÃO CORRENTE do elemento agora
        // que TODOS os `f.segs` existem.
        //
        // O seek do `startAt` cai exatamente na janela em que eles não existem.
        // O `stage` registra a posição num `loadedmetadata` `{once:true}`, e com
        // duas faixas o `loadedmetadata` da MSE dispara assim que os DOIS
        // segmentos de inicialização foram appendados — isto é, no meio da
        // segunda volta deste `for`, quando a faixa de vídeo já tem `segs` e a
        // de áudio ainda não. `aoBuscar` começa com `if (!f.segs) return`, então
        // aquele seek era DESCARTADO em silêncio para a faixa atrasada: o vídeo
        // reposicionava e o áudio baixava do segundo ZERO. Como o elemento só
        // sai de HAVE_METADATA com dado em TODAS as faixas na posição corrente,
        // a projeção ficava parada até o áudio percorrer o trecho inteiro.
        //
        // Ele morde no caminho mais caro que este player tem: a reconexão do
        // telão (`resendSceneToDisplay` reenvia `load` com `time`) e a aplicação
        // de um OTA, que recarrega as duas páginas com a cena no ar.
        aoBuscar();
        // OS DOIS CAMINHOS, e a ordem não importa porque `bombear` é
        // idempotente (`alimentar` sai por `f.ocupada` e pelo `ALVO_S`).
        // Ver `EVENTOS_DO_COMPASSO`: o intervalo é o piso, os eventos da mídia
        // são o que sobrevive ao estrangulamento de uma página em segundo
        // plano.
        EVENTOS_DO_COMPASSO.forEach((ev) => video.addEventListener(ev, bombear));
        compassoLigado = true;
        tick = setInterval(bombear, TICK_MS);
      } catch (e) {
        morrer((e && e.message) || 'início');
      }
    }

    // `appendBuffer` é assíncrono e só UM por SourceBuffer por vez — daí a
    // espera explícita no caminho de inicialização, que é sequencial por
    // natureza (init antes de índice, índice antes de mídia).
    function aplicar(f, buf) {
      return new Promise((resolve, reject) => {
        let prazo = null;
        const limpar = () => {
          clearTimeout(prazo);
          f.sb.removeEventListener('updateend', ok);
          f.sb.removeEventListener('error', ruim);
        };
        const ok = () => { limpar(); resolve(); };
        const ruim = () => { limpar(); reject(new Error('o SourceBuffer recusou por evento')); };
        f.sb.addEventListener('updateend', ok);
        f.sb.addEventListener('error', ruim);
        // PRAZO. Sem ele, um `updateend` que não vem deixa `iniciar()`
        // pendurado para SEMPRE: a transmissão para sem erro nenhum, que é o
        // único desfecho pior que falhar — ninguém avisa o dono da cena e o
        // download nem chega a ser acionado.
        prazo = setTimeout(() => {
          limpar();
          reject(new Error('o append não respondeu em ' + (APPEND_MS / 1000) + ' s'));
        }, APPEND_MS);
        try { f.sb.appendBuffer(buf); } catch (e) { limpar(); reject(e); }
      });
    }

    // Um seek NÃO limpa o buffer: os fragmentos carregam o próprio tempo, então
    // um append fora de ordem cai no lugar certo sozinho. Limpar seria jogar
    // fora o que já está lá — inclusive quando o operador volta dois segundos.
    function aoBuscar() {
      const t = video.currentTime;
      faixas.forEach((f) => {
        if (!f.segs) return;
        if (adiante(f.sb, t) > 0.5) return;   // já temos este ponto
        f.i = indiceEm(f.segs, t);
      });
      bombear();
    }

    ms.addEventListener('sourceopen', aoAbrir, { once: true });
    video.addEventListener('seeking', aoBuscar);
    objUrl = URL.createObjectURL(ms);
    video.src = objUrl;

    return {
      destruir() {
        video.removeEventListener('seeking', aoBuscar);
        morrer(null);
      },
    };
  }

  // O ÚLTIMO erro de transmissão, para o Registro de Configurações. Um
  // `console.warn` não chega a quem opera o culto — e é justamente quem opera
  // que vê a falha acontecer.
  //
  // `fome` É O CENSO DAS PARADAS POR FALTA DE BUFFER, e ele existe porque a
  // pergunta que este caminho produz não tem resposta em lugar nenhum. Relato do
  // operador: *"veio som, porém ficou travando e qualidade de vídeo baixa"* — e
  // a resposta possível era um palpite (*"deve ser a estabilidade da
  // internet"*). Um `<video>` que trava por rede e um app quebrado produzem a
  // MESMA tela; o que os separa é um número. `quantas` conta os episódios e
  // `segundos` soma quanto tempo a projeção passou parada esperando dados: dois
  // travamentos de meio segundo e dez de cinco segundos são diagnósticos
  // opostos, e uma contagem sozinha não os distingue.
  //
  // Quem os escreve é o `stage.js` (é ele que tem os ouvintes de `waiting` e
  // `playing` e que já acende o indicador de espera) — este módulo é o dono do
  // BALCÃO, para o Registro ter um lugar só onde perguntar pela transmissão.
  global.AVStream = {
    suportado, criar, lerSidx, escolherDegrau, ultimoErro: '',
    fome: { quantas: 0, segundos: 0 },
    // A BANDA MEDIDA na última transmissão, em bits por segundo, e o degrau em
    // que ela parou. Ela sobrevive ao item: o segundo louvor do culto começa
    // sabendo o que o primeiro descobriu, em vez de repetir a mesma medição
    // atrás do mesmo travamento. Zerada só pela morte da página.
    banda: 0,
    degrau: '',
  };
})(window);
