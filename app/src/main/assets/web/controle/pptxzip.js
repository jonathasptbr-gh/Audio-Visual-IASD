// ============================================================================
// O ZIP DE UM `.pptx`, LIDO POR FATIAS — sem materializar o arquivo inteiro.
//
// ## Por que ele existe
//
// O renderizador de `vendor/` só aceita um ArrayBuffer (`Ow`, no buildado), e
// isso é um teto duro: um `.pptx` de 570 MB com vídeo embutido põe 570 MB no
// heap de um processo que hospeda os DOIS WebViews e a `Presentation`. MEDIDO
// no material do operador: o arquivo foi RECUSADO antes disso, no teto de 32
// MiB por entrada da própria biblioteca, por um `ppt/media/media3.mp4` de 78,9
// MiB — um vídeo que, se tivesse entrado, sairia como retângulo PRETO na
// página (o `embutirRecursos` do `deck.js` não alcança `<video>`).
//
// Este arquivo é a saída dos dois problemas de uma vez: ele lê o DIRETÓRIO
// CENTRAL do zip por `Blob.slice()` — que é preguiçoso e não copia byte nenhum
// —, separa os vídeos, e remonta um `.pptx` ENXUTO que o renderizador abre sem
// engasgar. Os vídeos viram mídia de verdade no aparelho, e o `deck.js` os liga
// à página em que estavam.
//
// ## A regra que faz isso ser barato
//
// **Nada é recomprimido.** Ao remontar, os bytes COMPRIMIDOS de cada entrada
// mantida são copiados verbatim, com o CRC e os tamanhos que o diretório
// central já declara. Não há deflate, não há tabela de CRC, e o conteúdo XML
// nunca precisa ser descomprimido só para voltar ao lugar. Descompressão só
// acontece onde alguém quer LER (os `.rels`, para saber qual vídeo é de qual
// slide), e aí é `DecompressionStream`, que o Chromium do WebView tem.
//
// ## O que ele NÃO é
//
// Não é um leitor de zip de uso geral: ele lê o que um `.pptx` do PowerPoint
// escreve, e falha com FRASE em tudo o mais. Zip com senha, `.pptx` emendado
// (múltiplos volumes) e diretório central ausente saem como erro nomeado — o
// `deck.js` os transforma no aviso que o operador lê.
// ============================================================================
(function (global) {
  'use strict';

  // As quatro assinaturas do formato, em little-endian.
  const SIG_EOCD = 0x06054b50;        // fim do diretório central
  const SIG_EOCD64 = 0x06064b50;      // idem, ZIP64
  const SIG_LOC64 = 0x07064b50;       // localizador do ZIP64
  const SIG_CEN = 0x02014b50;         // uma entrada do diretório central
  const SIG_LOC = 0x04034b50;         // um cabeçalho local

  // O EOCD fica no FIM do arquivo e tem tamanho variável (o comentário do zip
  // entra nele). 64 kB + 22 é o pior caso do formato — um comentário maior que
  // isso não existe, porque o campo que o mede é de 16 bits.
  const EOCD_BUSCA = 64 * 1024 + 22;

  // Os valores-sentinela que dizem "o número de verdade está no ZIP64".
  const U16_MAX = 0xffff;
  const U32_MAX = 0xffffffff;

  // O que sai do `.pptx` enxuto e vira mídia no aparelho. Por EXTENSÃO e não
  // por tamanho: o critério tem de ser previsível para o operador — "o vídeo
  // saiu da apresentação e virou um item" é explicável, "arquivos acima de N MB
  // saíram" não é. Áudio entra na mesma lista pelo mesmo motivo do vídeo: o
  // `<audio>` do renderizador também não sobrevive ao `<foreignObject>`.
  const EXT_PESADA = [
    'mp4', 'm4v', 'mov', 'avi', 'wmv', 'mpg', 'mpeg', 'webm', 'mkv',
    'mp3', 'm4a', 'wav', 'wma', 'aac', 'ogg',
  ];

  const TIPO_POR_EXT = {
    mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime',
    avi: 'video/x-msvideo', wmv: 'video/x-ms-wmv', mpg: 'video/mpeg',
    mpeg: 'video/mpeg', webm: 'video/webm', mkv: 'video/x-matroska',
    mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav',
    wma: 'audio/x-ms-wma', aac: 'audio/aac', ogg: 'audio/ogg',
  };

  function extensaoDe(nome) {
    const m = /\.([A-Za-z0-9]+)$/.exec(String(nome || ''));
    return m ? m[1].toLowerCase() : '';
  }

  /** É mídia pesada de `ppt/media/` — o que sai do arquivo enxuto. */
  function ehMidiaPesada(nome) {
    const n = String(nome || '');
    if (n.indexOf('ppt/media/') !== 0 && n.indexOf('ppt/embeddings/') !== 0) return false;
    return EXT_PESADA.indexOf(extensaoDe(n)) >= 0;
  }

  /** O `type` de um Blob a partir do nome — o `<video>` precisa dele. */
  function tipoDe(nome) {
    return TIPO_POR_EXT[extensaoDe(nome)] || 'application/octet-stream';
  }

  function erro(frase) { throw new Error('zip: ' + frase); }

  async function fatia(blob, ini, fim) {
    const b = blob.slice(ini, Math.min(fim, blob.size));
    return new DataView(await b.arrayBuffer());
  }

  // O nome de uma entrada é UTF-8 quando o bit 11 das flags está ligado, e
  // CP437 quando não. O PowerPoint escreve ASCII puro nos caminhos que
  // interessam (`ppt/media/...`), e os dois decodificadores concordam em ASCII
  // — então decodificar sempre como UTF-8 é seguro e evita uma tabela de 256
  // entradas que nunca seria exercitada.
  const TEXTO = new TextDecoder('utf-8');

  /**
   * O DIRETÓRIO CENTRAL do zip, sem ler o corpo do arquivo.
   *
   * Devolve `[{ nome, metodo, comprimido, cru, crc, offsetLocal }]`. `metodo` 0
   * é armazenado e 8 é deflate — os dois únicos que um `.pptx` usa, e os dois
   * únicos que este arquivo aceita.
   */
  async function lerDiretorio(blob) {
    const tam = blob.size;
    if (!tam || tam < 22) erro('arquivo vazio ou pequeno demais para ser um .pptx');

    // 1. Achar o EOCD, varrendo de trás para a frente.
    const desde = Math.max(0, tam - EOCD_BUSCA);
    const cauda = await fatia(blob, desde, tam);
    let pEocd = -1;
    for (let i = cauda.byteLength - 22; i >= 0; i--) {
      if (cauda.getUint32(i, true) === SIG_EOCD) { pEocd = i; break; }
    }
    if (pEocd < 0) erro('não achei o fim do diretório central (o arquivo não é um zip, ou veio truncado)');

    let total = cauda.getUint16(pEocd + 10, true);
    let tamCen = cauda.getUint32(pEocd + 12, true);
    let offCen = cauda.getUint32(pEocd + 16, true);

    // 2. ZIP64, quando algum campo veio no sentinela. Um `.pptx` de centenas de
    //    MB não PRECISA de ZIP64 (o formato só o exige acima de 4 GB), mas há
    //    gravadores que o emitem assim mesmo — e sem isto a leitura falharia
    //    com um número absurdo em vez de uma frase.
    if (total === U16_MAX || tamCen === U32_MAX || offCen === U32_MAX) {
      const pLoc = pEocd - 20;
      if (pLoc < 0 || cauda.getUint32(pLoc, true) !== SIG_LOC64) {
        erro('o arquivo diz ser ZIP64 e não traz o localizador');
      }
      const offEocd64 = Number(cauda.getBigUint64(pLoc + 8, true));
      const d64 = await fatia(blob, offEocd64, offEocd64 + 56);
      if (d64.getUint32(0, true) !== SIG_EOCD64) erro('o fim ZIP64 não está onde o localizador aponta');
      total = Number(d64.getBigUint64(32, true));
      tamCen = Number(d64.getBigUint64(40, true));
      offCen = Number(d64.getBigUint64(48, true));
    }

    if (offCen + tamCen > tam) erro('o diretório central aponta para fora do arquivo');

    // 3. Percorrer as entradas.
    const cen = await fatia(blob, offCen, offCen + tamCen);
    const bytes = new Uint8Array(cen.buffer, cen.byteOffset, cen.byteLength);
    const entradas = [];
    let p = 0;
    for (let i = 0; i < total; i++) {
      if (p + 46 > cen.byteLength) erro('o diretório central acabou antes das ' + total + ' entradas');
      if (cen.getUint32(p, true) !== SIG_CEN) erro('entrada nº ' + (i + 1) + ' do diretório central está corrompida');
      const flags = cen.getUint16(p + 8, true);
      const metodo = cen.getUint16(p + 10, true);
      const crc = cen.getUint32(p + 16, true);
      let comprimido = cen.getUint32(p + 20, true);
      let cru = cen.getUint32(p + 24, true);
      const nLen = cen.getUint16(p + 28, true);
      const eLen = cen.getUint16(p + 30, true);
      const cLen = cen.getUint16(p + 32, true);
      let offsetLocal = cen.getUint32(p + 42, true);
      const nome = TEXTO.decode(bytes.subarray(p + 46, p + 46 + nLen));

      // O campo extra 0x0001 carrega os valores de verdade quando o de 32 bits
      // veio no sentinela. A ORDEM é fixa e os campos são CONDICIONAIS: só está
      // presente o que estourou.
      if (cru === U32_MAX || comprimido === U32_MAX || offsetLocal === U32_MAX) {
        let q = p + 46 + nLen;
        const fimExtra = q + eLen;
        while (q + 4 <= fimExtra) {
          const idExtra = cen.getUint16(q, true);
          const tamExtra = cen.getUint16(q + 2, true);
          if (idExtra === 0x0001) {
            let r = q + 4;
            if (cru === U32_MAX) { cru = Number(cen.getBigUint64(r, true)); r += 8; }
            if (comprimido === U32_MAX) { comprimido = Number(cen.getBigUint64(r, true)); r += 8; }
            if (offsetLocal === U32_MAX) { offsetLocal = Number(cen.getBigUint64(r, true)); r += 8; }
            break;
          }
          q += 4 + tamExtra;
        }
      }

      // Senha: o bit 0 das flags. Vale a mesma regra do PDF protegido — o app
      // não tenta adivinhar, ele DIZ.
      if (flags & 0x1) erro('a apresentação está protegida por senha');
      if (metodo !== 0 && metodo !== 8) {
        erro('a entrada "' + nome + '" usa uma compressão que o app não lê (método ' + metodo + ')');
      }

      entradas.push({ nome, metodo, comprimido, cru, crc, offsetLocal });
      p += 46 + nLen + eLen + cLen;
    }
    return entradas;
  }

  /**
   * Onde os BYTES de uma entrada começam de verdade.
   *
   * Não dá para deduzir do diretório central: o cabeçalho LOCAL tem campos de
   * nome e extra PRÓPRIOS, e o do extra quase sempre difere (é onde mora o
   * alinhamento). Ler os 30 bytes do cabeçalho é a única resposta correta, e
   * pular esta leitura é o defeito clássico deste formato — ele produz bytes
   * deslocados, não um erro.
   */
  async function inicioDosDados(blob, e) {
    const h = await fatia(blob, e.offsetLocal, e.offsetLocal + 30);
    if (h.byteLength < 30 || h.getUint32(0, true) !== SIG_LOC) {
      erro('o cabeçalho local de "' + e.nome + '" não está onde o índice aponta');
    }
    return e.offsetLocal + 30 + h.getUint16(26, true) + h.getUint16(28, true);
  }

  /**
   * Os bytes COMPRIMIDOS de uma entrada, verbatim.
   *
   * É um `Blob.slice()`: nada é copiado nem descomprimido aqui, e o resultado
   * pode ser gravado direto num zip novo com o CRC que o índice já traz.
   */
  async function fatiaCrua(blob, e) {
    const ini = await inicioDosDados(blob, e);
    return blob.slice(ini, ini + e.comprimido);
  }

  /**
   * O CONTEÚDO de uma entrada, descomprimido quando preciso.
   *
   * Método 0 devolve a fatia INTACTA — que é o caso dos vídeos, porque um mp4
   * já é comprimido e o PowerPoint não o deflaciona. É isso que faz extrair
   * 500 MB de vídeo custar zero descompressão.
   */
  async function extrair(blob, e, tipo) {
    const crua = await fatiaCrua(blob, e);
    if (e.metodo === 0) return new Blob([crua], { type: tipo || tipoDe(e.nome) });
    if (typeof global.DecompressionStream !== 'function') {
      erro('este navegador não sabe descomprimir a apresentação');
    }
    const fluxo = crua.stream().pipeThrough(new global.DecompressionStream('deflate-raw'));
    const bytes = await new Response(fluxo).arrayBuffer();
    return new Blob([bytes], { type: tipo || tipoDe(e.nome) });
  }

  /** O texto de uma entrada XML do `.pptx`. */
  async function extrairTexto(blob, e) {
    return await (await extrair(blob, e, 'text/plain')).text();
  }

  // --------------------------------------------------------------------------
  // REMONTAR
  // --------------------------------------------------------------------------

  function escrever32(v, n) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n >>> 0, true); v.push(b); }
  function escrever16(v, n) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, n & 0xffff, true); v.push(b); }

  const CODIFICA = new TextEncoder();

  /**
   * Um `.pptx` NOVO com as entradas escolhidas, bytes copiados verbatim.
   *
   * O que sai é o mesmo arquivo sem os vídeos: mesmo XML, mesmas imagens,
   * mesmos CRCs. O renderizador o abre e desenha os slides; onde havia vídeo
   * ele não acha a mídia e cai no ramo do PÔSTER (`HD`, no buildado), que
   * desenha o quadro de capa como `<img>` — justamente o que o
   * `embutirRecursos` do `deck.js` sabe embutir.
   *
   * **Sem descritor de dados.** A entrada de origem pode ter o bit 3 das flags
   * ligado (tamanhos só depois dos dados); aqui os tamanhos são conhecidos e
   * escritos no cabeçalho, então a flag sai zerada — copiá-la faria o leitor
   * procurar um descritor que não gravamos.
   */
  async function remontar(blob, entradas) {
    const partes = [];
    const central = [];
    let desloc = 0;

    for (const e of entradas) {
      const dados = await fatiaCrua(blob, e);
      const nome = CODIFICA.encode(e.nome);
      const local = [];
      escrever32(local, SIG_LOC);
      escrever16(local, 20);           // versão necessária: 2.0 (deflate)
      escrever16(local, 0x0800);       // só o bit 11: nome em UTF-8
      escrever16(local, e.metodo);
      escrever16(local, 0); escrever16(local, 0);   // hora/data: irrelevantes aqui
      escrever32(local, e.crc);
      escrever32(local, e.comprimido);
      escrever32(local, e.cru);
      escrever16(local, nome.length);
      escrever16(local, 0);            // sem campo extra
      local.push(nome);
      const cabecalho = new Blob(local);
      partes.push(cabecalho, dados);

      const c = [];
      escrever32(c, SIG_CEN);
      escrever16(c, 20); escrever16(c, 20);
      escrever16(c, 0x0800);
      escrever16(c, e.metodo);
      escrever16(c, 0); escrever16(c, 0);
      escrever32(c, e.crc);
      escrever32(c, e.comprimido);
      escrever32(c, e.cru);
      escrever16(c, nome.length);
      escrever16(c, 0); escrever16(c, 0);   // extra, comentário
      escrever16(c, 0); escrever16(c, 0);   // disco, atributos internos
      escrever32(c, 0);                     // atributos externos
      escrever32(c, desloc);
      c.push(nome);
      central.push(new Blob(c));

      desloc += cabecalho.size + dados.size;
    }

    const centralBlob = new Blob(central);
    const fim = [];
    escrever32(fim, SIG_EOCD);
    escrever16(fim, 0); escrever16(fim, 0);
    escrever16(fim, entradas.length); escrever16(fim, entradas.length);
    escrever32(fim, centralBlob.size);
    escrever32(fim, desloc);
    escrever16(fim, 0);   // sem comentário

    return new Blob([...partes, centralBlob, new Blob(fim)], {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    });
  }

  // --------------------------------------------------------------------------
  // QUAL VÍDEO É DE QUAL SLIDE
  // --------------------------------------------------------------------------

  // Um `.rels` liga um `Id` a um alvo. O que interessa aqui são os alvos que
  // apontam para `../media/…`, e o `Type` não entra na conta de propósito: o
  // PowerPoint escreve `video`, `media` e `audio` para a mesma relação conforme
  // a versão, e filtrar por ele perderia vídeo em arquivo antigo. Quem decide é
  // a EXTENSÃO do alvo, que é a mesma régua do `ehMidiaPesada`.
  const RE_REL = /<Relationship\b[^>]*>/g;
  const RE_ATR = /(\w+)="([^"]*)"/g;

  function relacoes(xml) {
    const fora = [];
    let m;
    RE_REL.lastIndex = 0;
    while ((m = RE_REL.exec(String(xml || '')))) {
      const atr = {};
      let a;
      RE_ATR.lastIndex = 0;
      while ((a = RE_ATR.exec(m[0]))) atr[a[1]] = a[2];
      if (atr.Id && atr.Target) fora.push(atr);
    }
    return fora;
  }

  /** `../media/x.mp4` visto de `ppt/slides/` vira `ppt/media/x.mp4`. */
  function resolverAlvo(base, alvo) {
    const a = String(alvo || '').replace(/^\.\//, '');
    if (a.indexOf('/') === 0) return a.slice(1);
    const pilha = base.split('/');
    pilha.pop();
    for (const parte of a.split('/')) {
      if (parte === '..') pilha.pop();
      else if (parte !== '.') pilha.push(parte);
    }
    return pilha.join('/');
  }

  /**
   * A ORDEM dos slides, do `presentation.xml` — que é a mesma que o
   * renderizador usa, porque as duas saem do `sldIdLst`.
   *
   * Deduzir a ordem dos NOMES (`slide1`, `slide2`, …) erraria numa apresentação
   * reordenada, e erraria em silêncio: o vídeo tocaria no slide errado.
   */
  function ordemDosSlides(xmlApresentacao, relsApresentacao) {
    const porId = {};
    for (const r of relacoes(relsApresentacao)) {
      porId[r.Id] = resolverAlvo('ppt/presentation.xml', r.Target);
    }
    const fora = [];
    const re = /<p:sldId\b[^>]*r:id="([^"]+)"[^>]*\/?>/g;
    let m;
    while ((m = re.exec(String(xmlApresentacao || '')))) {
      const alvo = porId[m[1]];
      if (alvo) fora.push(alvo);
    }
    return fora;
  }

  /**
   * PÁGINA → caminho da mídia pesada daquele slide.
   *
   * Um slide com mais de um vídeo devolve o PRIMEIRO: a automação toca um vídeo
   * por página, e prometer mais do que isso seria inventar uma ordem que o
   * `.pptx` não declara.
   */
  function videosPorPagina(ordem, relsPorSlide) {
    const mapa = {};
    ordem.forEach((slide, i) => {
      const xml = relsPorSlide[relsDoSlide(slide)];
      if (!xml) return;
      for (const r of relacoes(xml)) {
        if (String(r.TargetMode || '') === 'External') continue;
        const alvo = resolverAlvo(slide, r.Target);
        if (ehMidiaPesada(alvo)) { mapa[i] = alvo; return; }
      }
    });
    return mapa;
  }

  /** `ppt/slides/slide3.xml` → `ppt/slides/_rels/slide3.xml.rels`. */
  function relsDoSlide(slide) {
    const corte = slide.lastIndexOf('/');
    return slide.slice(0, corte) + '/_rels' + slide.slice(corte) + '.rels';
  }

  global.AVPptxZip = {
    ehMidiaPesada, tipoDe, extensaoDe,
    lerDiretorio, inicioDosDados, fatiaCrua, extrair, extrairTexto, remontar,
    relacoes, resolverAlvo, ordemDosSlides, videosPorPagina, relsDoSlide,
    EXT_PESADA,
  };
})(this);
