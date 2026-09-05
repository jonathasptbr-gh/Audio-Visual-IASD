// ============================================================================
// A APRESENTAÇÃO EM IMAGENS — o `.pptx` desenhado DENTRO do WebView.
//
// O Android não desenha OOXML (a plataforma só traz o `PdfRenderer`, que é o
// caminho do PDF, em `SlideDeck.kt`). Quem desenha aqui é o renderizador de
// `vendor/pptx-renderer.js`, e o que ele produz é DOM. O app projeta IMAGEM:
// este arquivo é a ponte entre os dois, e ele existe SEPARADO do `controle.js`
// pelo motivo dos outros módulos do Controle (`serie.js`, `cifra.js`,
// `sorteio.js`, `hinario.js`) — a tradução tem regras próprias, cada uma com um
// modo de falhar CALADO, e um oráculo (`tools/apresentacao.test.mjs`) só
// alcança o que tem porta de entrada.
//
// ## Por que ele não é "clonar e serializar"
//
// A rasterização é `<foreignObject>`: o slide vai para dentro de um SVG que o
// navegador desenha como imagem. Esse SVG é um DOCUMENTO À PARTE, e é isso que
// governa tudo aqui — dele não se alcança NADA que dependa do documento de
// origem. QUATRO coisas somem em silêncio, e cada uma tem uma função abaixo:
//
//  1. **As URLs `blob:` da biblioteca** (`embutirRecursos`). O renderizador
//     entrega toda mídia do `.pptx` como `URL.createObjectURL`, e uma `blob:`
//     não resolve dentro do `foreignObject`. MEDIDO no material do operador
//     (27 slides, "Semana da Família 2026"): o deck tem **zero `<img>`** — todo
//     fundo é `style="background-image: url(blob:…)"` no `<div>` do slide. A
//     versão anterior só convertia `<img>`, então ela não convertia NADA: as 27
//     páginas saíam brancas, com o texto solto no meio, e o defeito não emite
//     erro em lugar nenhum.
//  2. **Os pixels de um `<canvas>`** (`trocarCanvas`). `cloneNode` copia o
//     elemento e não o bitmap — um GRÁFICO do PowerPoint sairia em branco.
//  3. **O `<video>` de um slide** (`separarVideos`, sobre o `pptxzip.js`). O
//     renderizador o desenha como `<video preload="none">` sobre fundo PRETO, e
//     o `embutirRecursos` abaixo não o alcança — a página sairia com um
//     retângulo preto no lugar do vídeo. Ele é tirado do arquivo ANTES de o
//     renderizador abri-lo, e vira mídia presa à PÁGINA em que estava.
//  4. **A fonte que o aparelho não tem** (`trocarSimbolos`). Marcador de
//     tópico em PowerPoint é TEXTO numa fonte de símbolos, e nenhum Android tem
//     Wingdings: o `v` do material do operador é ❖, e o `` do Symbol é •.
//     Sem tradução o telão mostra a letra `v` — ou, no caso do Symbol, o
//     retângulo vazio da área privativa.
//
// ## E por que o palco é uma caixa de tamanho ZERO
//
// A versão anterior pendurava no `<body>` um `position:fixed` de 1920 px de
// largura por **29.700 px de altura** (os 27 slides de uma vez) e a 99.999 px
// para a esquerda. São duas coisas erradas de uma vez: o pico de memória de uma
// apresentação inteira num processo que hospeda os DOIS WebViews e a
// `Presentation`, e uma região de layout gigante criada e destruída embaixo de
// um app cuja altura é `calc(100svh - var(--kb))`. O relato do operador é
// exatamente a segunda: *"a tela piscou e ocultou o cronograma, subindo os
// controles para o topo da tela, e depois retornou o cronograma"* — `main` é
// `flex: 1` e só encolhe se o `<body>` encolher.
//
// Hoje o palco é `position: fixed` de **0×0 com `overflow: hidden`**, e o que é
// grande mora DENTRO dele: uma caixa desse tamanho não acrescenta um pixel de
// transbordo ao documento. E os slides são rasterizados **um a um**
// (`renderSlideToContainer` + `dispose`), então o pico é UMA página em vez da
// apresentação inteira.
// ============================================================================
(function (global) {
  'use strict';

  const doc = global.document;

  /** Largura da página gerada. O telão de uma igreja é 1080p; acima disso só
   *  engorda o IndexedDB (são dezenas de páginas) sem um pixel visível a mais.
   *  É o mesmo número do `LADO_MAX` do `SlideDeck.kt`, de propósito. */
  const LARGURA = 1920;

  /** Teto de páginas, irmão do `MAX_PAGINAS` do `SlideDeck.kt`: um arquivo de
   *  500 slides não é um roteiro de culto, e rasterizá-lo inteiro enche a
   *  memória do aparelho. O corte é DITO (ver `truncado`), nunca silencioso. */
  const MAX_PAGINAS = 300;

  /**
   * Abaixo disto a página fica em PNG.
   *
   * O formato não é escolha de gosto, é aritmética MEDIDA sobre o material do
   * operador (27 slides com fundo fotográfico, 1920×1080):
   *
   * | formato        | a apresentação inteira |
   * |----------------|------------------------|
   * | PNG            | **100,4 MB**           |
   * | WebP sem perda | 57,7 MB                |
   * | WebP q .9      | **12,3 MB**            |
   *
   * Ou seja: o conserto das imagens (item 1 acima) multiplicaria por mil o que
   * cada apresentação ocupa — PNG de fotografia é o pior caso do formato. E o
   * argumento do `SlideDeck.kt` para o PNG continua VERDADEIRO onde ele nasceu:
   * slide de TEXTO sobre fundo chapado é onde o compressor com perda borra a
   * borda da letra, e é o que vai ser lido de longe.
   *
   * As duas coisas convivem porque a pergunta é respondida POR PÁGINA, e o
   * próprio PNG é quem responde: uma página chapada comprime pequeno (MEDIDO:
   * 44 kB a 208 kB nas páginas sem fundo do mesmo arquivo) e fica em PNG, com
   * a letra intacta; uma página fotográfica passa dos 3 MB e vai para o WebP.
   * O teto separa as duas por mais de uma ordem de grandeza — não é um ajuste
   * fino, é um abismo.
   */
  const PAGINA_LEVE = 512 * 1024;

  /** Qualidade do WebP quando a página é fotográfica. */
  const QUALIDADE = 0.9;

  /**
   * OS TETOS DO ZIP, escritos aqui e não herdados da biblioteca.
   *
   * O `RECOMMENDED_ZIP_LIMITS` do `vendor/` traz 32 MiB por entrada, e esse
   * número mede a coisa errada para este app: ele olha o MAIOR arquivo de
   * dentro do zip, enquanto o que custa heap é o TOTAL. Ele foi o que recusou
   * a apresentação do operador por um vídeo de 78,9 MiB — que hoje nem chega
   * aqui, porque o `separarVideos` o tira antes.
   *
   * O que sobra no enxuto é XML e IMAGEM, e é sobre isso que estes números
   * decidem. A entrada acompanha o total: depois da separação não existe mais
   * a classe de arquivo que justificava um teto próprio, e uma foto de fundo
   * em alta de uma apresentação legítima passa de 32 MiB sem esforço.
   *
   * Os dois AGREGADOS ficam, e são eles que protegem o culto: o renderizador
   * infla toda `ppt/media/*` na abertura, e sem teto uma apresentação
   * patológica derruba o processo — que leva junto a projeção. `maxEntries` e
   * `maxConcurrency` seguem os da biblioteca; o custo deles para o operador é
   * comprovadamente zero (um deck de 300 páginas não passa de ~2.000 entradas).
   */
  const LIMITES_DO_ZIP = Object.freeze({
    maxEntries: 4000,
    maxEntryUncompressedBytes: 192 * 1024 * 1024,
    maxTotalUncompressedBytes: 256 * 1024 * 1024,
    maxMediaBytes: 192 * 1024 * 1024,
    maxConcurrency: 8,
  });

  // ==========================================================================
  // FONTES DE SÍMBOLO
  //
  // O marcador de tópico do PowerPoint é `buFont="Wingdings" buChar="v"` — uma
  // LETRA numa fonte que só existe no Windows. O renderizador repassa isso
  // fielmente (`<span style="font-family: Wingdings">v</span>`), e num Android
  // o que sai é a letra `v`.
  //
  // As tabelas são as do próprio fabricante, e são CURTAS de propósito: só os
  // glifos que aparecem como marcador ou como sinal de conferência. O que não
  // estiver aqui é DEIXADO COMO ESTÁ — traduzir por palpite é trocar um erro
  // visível por um errado que parece certo.
  //
  // A exceção é a ÁREA PRIVATIVA (U+F000–U+F0FF): ali não há como o caractere
  // estar certo — ele é o byte da fonte de símbolo com o plano privativo
  // somado, e sem a fonte o navegador desenha o retângulo vazio. Um marcador
  // é o que ele quase sempre é, e um ponto é infinitamente melhor que um
  // retângulo vazio no telão.
  // ==========================================================================
  const WINGDINGS = {
    0x6c: '●', // l  ●
    0x6d: '❍', // m  ❍
    0x6e: '■', // n  ■
    0x6f: '□', // o  □
    0x70: '❑', // p  ❑
    0x71: '❑', // q  ❑
    0x72: '❒', // r  ❒
    0x73: '◆', // s  ◆
    0x74: '◆', // t  ◆
    0x75: '⬦', // u  ⬦
    0x76: '❖', // v  ❖  ← o do material do operador
    0x77: '♦', // w  ♦
    0x78: '⌧', // x  ⌧
    0xa7: '▪', // §  ▪  (o marcador de segundo nível mais comum)
    0xa8: '▫', // ¨  ▫
    0xd8: '➢', // Ø  ➢
    0xfc: '✓', // ü  ✓
    0xfd: '✗', // ý  ✗
    0xfe: '☑', // þ  ☑
    0xff: '☒', // ÿ  ☒
  };

  const SYMBOL = {
    0xb7: '•', // ·  •  ← o do material do operador (chega como U+F0B7)
    0xa7: '♣', // §  ♣
    0xd8: '∅', // Ø  ∅
    0xae: '→', // ®  →
    0xac: '←', // ¬  ←
    0xad: '↑', // ­  ↑
    0xaf: '↓', // ¯  ↓
  };

  const FONTES_DE_SIMBOLO = [
    [/wingdings/i, WINGDINGS],
    [/webdings/i, WINGDINGS],
    [/symbol/i, SYMBOL],
  ];

  /** A tabela desta família, ou `null` se ela for uma fonte de texto normal. */
  function tabelaDaFonte(familia) {
    const f = String(familia || '');
    if (!f) return null;
    for (const [re, tabela] of FONTES_DE_SIMBOLO) if (re.test(f)) return tabela;
    return null;
  }

  /**
   * O texto de uma fonte de símbolo, em Unicode de verdade.
   *
   * PURA (nada de DOM), e é ela que o oráculo exercita: o resto desta seção é
   * só encontrar os elementos.
   */
  function textoDeSimbolo(texto, tabela) {
    if (!tabela) return String(texto == null ? '' : texto);
    let saida = '';
    for (const ch of String(texto == null ? '' : texto)) {
      const cp = ch.codePointAt(0);
      const baixo = cp >= 0xf000 && cp <= 0xf0ff ? cp - 0xf000 : cp;
      const mapeado = tabela[baixo];
      if (mapeado) saida += mapeado;
      // ÁREA PRIVATIVA sem tradução: o retângulo vazio é o único desfecho que
      // não pode ficar. Fora dela, o caractere é deixado como está.
      else if (cp >= 0xf000 && cp <= 0xf0ff) saida += '•';
      else saida += ch;
    }
    return saida;
  }

  /**
   * Traduz, DENTRO DO CLONE, todo texto que depende de uma fonte de símbolo — e
   * tira a família junto, senão o navegador continuaria procurando uma fonte
   * que não existe para desenhar o ❖ que acabamos de escrever.
   */
  function trocarSimbolos(clone) {
    const nos = [clone, ...clone.querySelectorAll('*')];
    for (const n of nos) {
      if (!n.style || !n.style.fontFamily) continue;
      const tabela = tabelaDaFonte(n.style.fontFamily);
      if (!tabela) continue;
      // Só o texto DIRETO deste elemento: um contêiner que declare a família e
      // tenha filhos com família própria não pode ter o texto deles reescrito
      // pela tabela errada.
      for (const filho of n.childNodes) {
        if (filho.nodeType === 3) filho.nodeValue = textoDeSimbolo(filho.nodeValue, tabela);
      }
      n.style.fontFamily = '';
    }
  }

  // ==========================================================================
  // RECURSOS: tudo que é URL vira `data:`
  // ==========================================================================

  /** `blob:`, `http(s):` e caminho absoluto — o que NÃO resolve dentro do SVG.
   *  `data:` já está embutido e é o que esta função produz. */
  function ehExterna(u) { return /^(blob:|https?:|\/)/.test(String(u || '')); }

  const RE_URL = /url\((['"]?)([^'")]+)\1\)/g;

  /**
   * Um `Map` url → Promise de `data:`. Vive por IMPORTAÇÃO, não por página: no
   * material do operador o mesmo fundo se repete em vários slides, e sem o
   * cache cada página relia e recodificava os mesmos 500 kB.
   */
  function cacheDeRecursos() { return new Map(); }

  function comoDataUrl(url, cache) {
    if (cache && cache.has(url)) return cache.get(url);
    const p = (async () => {
      const res = await fetch(url);
      const b = await res.blob();
      // `FileReader` e NÃO um canvas: o blob já é o JPEG/PNG que veio dentro do
      // `.pptx`, e redesenhá-lo num canvas para `toDataURL('image/png')` — o
      // que a versão anterior fazia com as `<img>` — reencodava uma fotografia
      // de 500 kB como PNG de vários MB, dentro de uma string que ainda seria
      // percent-encodada. Aqui os bytes atravessam INTACTOS.
      return await new Promise((ok, nao) => {
        const fr = new FileReader();
        fr.onload = () => ok(String(fr.result));
        fr.onerror = () => nao(fr.error || new Error('leitura do recurso'));
        fr.readAsDataURL(b);
      });
    })();
    if (cache) cache.set(url, p);
    return p;
  }

  /**
   * Embute no clone toda mídia que o `<foreignObject>` não alcançaria.
   *
   * Varre os DOIS lugares em que o renderizador põe uma URL, e o segundo é o
   * que faltava: o atributo (`<img src>`, `<image href>`) e o `url(...)` de
   * qualquer propriedade do `style` inline — `background-image` do fundo do
   * slide, do preenchimento em ladrilho e do recorte por geometria.
   *
   * Uma falha em UM recurso não derruba a página: o slide sai sem aquela
   * imagem, que é o comportamento de antes desta função e melhor que nenhuma
   * página.
   */
  async function embutirRecursos(clone, cache) {
    const tarefas = [];
    const nos = [clone, ...clone.querySelectorAll('*')];
    for (const n of nos) {
      const tag = String(n.tagName || '').toLowerCase();
      if (tag === 'img' || tag === 'image') {
        const attr = n.hasAttribute('href') ? 'href'
          : (n.hasAttribute('xlink:href') ? 'xlink:href' : 'src');
        const v = n.getAttribute(attr);
        if (v && ehExterna(v)) {
          tarefas.push(comoDataUrl(v, cache)
            .then((d) => n.setAttribute(attr, d))
            .catch(() => {}));
        }
      }
      const st = n.getAttribute && n.getAttribute('style');
      if (st && st.indexOf('url(') >= 0) {
        const urls = [...new Set([...st.matchAll(RE_URL)].map((m) => m[2]).filter(ehExterna))];
        if (urls.length) {
          tarefas.push(Promise.all(urls.map(async (u) => [u, await comoDataUrl(u, cache)]))
            .then((pares) => {
              let novo = n.getAttribute('style');
              for (const [u, d] of pares) novo = novo.split(u).join(d);
              n.setAttribute('style', novo);
            })
            .catch(() => {}));
        }
      }
    }
    await Promise.all(tarefas);
  }

  /**
   * Troca cada `<canvas>` do clone por uma `<img>` com os pixels dele.
   *
   * `cloneNode` copia o ELEMENTO, nunca o bitmap: um gráfico do PowerPoint
   * (que o renderizador desenha em canvas) sairia como um retângulo vazio, sem
   * erro em lugar nenhum. Anda em PARES com o original porque a única ligação
   * entre os dois é a ORDEM do documento.
   */
  function trocarCanvas(origem, clone) {
    const a = [...origem.querySelectorAll('canvas')];
    const b = [...clone.querySelectorAll('canvas')];
    for (let i = 0; i < a.length && i < b.length; i++) {
      try {
        const img = doc.createElement('img');
        img.setAttribute('src', a[i].toDataURL('image/png'));
        img.setAttribute('style', b[i].getAttribute('style') || '');
        img.style.width = a[i].style.width || (a[i].width + 'px');
        img.style.height = a[i].style.height || (a[i].height + 'px');
        b[i].replaceWith(img);
      } catch (_) { /* canvas sujo por origem: o gráfico sai vazio, como antes */ }
    }
  }

  // ==========================================================================
  // DOM → IMAGEM
  // ==========================================================================

  /**
   * Rasteriza um elemento já posicionado, em `w`×`h`.
   *
   * Devolve `{ blob, tipo }` ou `null`. O `null` é "não deu para desenhar esta
   * página" e sobe até o aviso do operador — nunca uma página em branco, que
   * leria como "o arquivo era assim".
   */
  async function elementoParaImagem(el, w, h, cache) {
    const clone = el.cloneNode(true);
    trocarCanvas(el, clone);
    trocarSimbolos(clone);
    await embutirRecursos(clone, cache);
    const html = new XMLSerializer().serializeToString(clone);
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '">'
      + '<foreignObject width="100%" height="100%">'
      + '<div xmlns="http://www.w3.org/1999/xhtml">' + html + '</div>'
      + '</foreignObject></svg>';
    const img = new Image();
    // `data:` e NÃO `URL.createObjectURL`, embora a URL de objeto fosse mais
    // barata e mais curta. MEDIDO: um SVG carregado de uma `blob:` SUJA o
    // canvas, e o `toBlob` seguinte lança `SecurityError` — a apresentação
    // inteira falharia, com uma mensagem que não aponta para cá.
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    try { await img.decode(); } catch (_) { return null; }
    const cv = doc.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    // FUNDO BRANCO antes de desenhar, como no lado nativo (ver `SlideDeck.kt`):
    // o slide pode não pintar o próprio papel, e transparente, no telão, é o
    // preto do palco — o texto escuro sumiria.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return await escolherFormato(cv);
  }

  /**
   * O menor entre o PNG e o WebP — ver `PAGINA_LEVE` para a aritmética.
   *
   * O PNG vem primeiro porque ele é a resposta CERTA para uma página chapada e
   * porque é o mais barato de produzir; o WebP só é encodado quando o PNG já
   * disse que a página é fotográfica. Um navegador sem WebP devolve PNG deste
   * `toBlob` (é o que o padrão manda para tipo não suportado), e a comparação
   * de tamanho absorve isso sozinha — sem guarda de recurso em lugar nenhum.
   */
  async function escolherFormato(cv) {
    const png = await new Promise((r) => cv.toBlob(r, 'image/png'));
    if (!png) return null;
    if (png.size <= PAGINA_LEVE) return { blob: png, tipo: png.type };
    const webp = await new Promise((r) => cv.toBlob(r, 'image/webp', QUALIDADE));
    if (!webp || webp.size >= png.size) return { blob: png, tipo: png.type };
    return { blob: webp, tipo: webp.type };
  }

  // ==========================================================================
  // O PALCO
  // ==========================================================================

  /**
   * A caixa 0×0 onde a apresentação é desenhada — ver o cabeçalho do arquivo.
   *
   * `overflow: hidden` num `position: fixed` sem tamanho: o conteúdo tem
   * LAYOUT (sem layout não há o que rasterizar, que é por que isto não pode ser
   * `display: none`) e não acrescenta um pixel de transbordo ao documento.
   *
   * Dois compartimentos, e eles não são o mesmo: a `oficina` é o contêiner que
   * o renderizador considera seu — ele apaga o `innerHTML` dela em cada
   * `queueRender` —, e a `mesa` é a nossa, uma página por vez.
   */
  function criarPalco() {
    const host = doc.createElement('div');
    host.setAttribute('data-palco-de-slides', '1');
    host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;'
      + 'overflow:hidden;opacity:0;pointer-events:none;z-index:-1;';
    const oficina = doc.createElement('div');
    const mesa = doc.createElement('div');
    host.appendChild(oficina);
    host.appendChild(mesa);
    doc.body.appendChild(host);
    return { host, oficina, mesa, fechar() { host.remove(); } };
  }

  // ==========================================================================
  // O PIPELINE
  // ==========================================================================

  /**
   * O VÍDEO EMBUTIDO SAI DO ARQUIVO ANTES DE ELE SER ABERTO.
   *
   * Um `.pptx` com vídeo não cabe pelo caminho normal, e por DOIS motivos que
   * se somam. O renderizador só aceita ArrayBuffer, então abrir o arquivo do
   * operador (MEDIDO: 570 MB) põe 570 MB no heap de um processo que hospeda os
   * dois WebViews e a `Presentation`; e o teto de 32 MiB por entrada da
   * própria biblioteca recusa o arquivo antes disso, por um `media3.mp4` de
   * 78,9 MiB — um vídeo que, se tivesse entrado, sairia como retângulo PRETO
   * (o `embutirRecursos` daqui não alcança `<video>`, que é a QUARTA coisa que
   * o `<foreignObject>` perde).
   *
   * Daí a separação: o `pptxzip.js` lê o índice do zip por `Blob.slice()` — sem
   * materializar nada —, tira os vídeos e remonta um `.pptx` enxuto com os
   * bytes comprimidos copiados verbatim. O que sobra são XML e imagens, que é
   * exatamente o que vira página. Onde havia vídeo o renderizador não acha a
   * mídia e cai no ramo do PÔSTER, que desenha o quadro de capa como `<img>` —
   * a única das três formas que o `embutirRecursos` sabe embutir.
   *
   * Devolve `{ enxuto, videos, total }`: `videos` é `[{ pagina, blob, nome }]`.
   */
  async function separarVideos(file) {
    const Z = global.AVPptxZip;
    const dir = await Z.lerDiretorio(file);
    const pesadas = dir.filter((e) => Z.ehMidiaPesada(e.nome));
    if (!pesadas.length) return { enxuto: file, videos: [], total: 0 };

    // QUAL VÍDEO É DE QUAL SLIDE. A ordem sai do `sldIdLst` e nunca dos nomes
    // dos arquivos: numa apresentação REORDENADA as duas divergem, e o vídeo
    // tocaria no slide errado — sem sintoma, na frente da congregação.
    let porPagina = {};
    try {
      const achar = (n) => dir.find((e) => e.nome === n);
      const eApres = achar('ppt/presentation.xml');
      const eRels = achar('ppt/_rels/presentation.xml.rels');
      if (eApres && eRels) {
        const ordem = Z.ordemDosSlides(
          await Z.extrairTexto(file, eApres),
          await Z.extrairTexto(file, eRels),
        );
        const rels = {};
        for (const slide of ordem) {
          const nome = Z.relsDoSlide(slide);
          const e = achar(nome);
          if (e) rels[nome] = await Z.extrairTexto(file, e);
        }
        porPagina = Z.videosPorPagina(ordem, rels);
      }
    } catch (e) {
      // A LIGAÇÃO É O QUE PODE FALTAR, NUNCA A APRESENTAÇÃO. Um `.rels` que não
      // parseia custa a automação daquele arquivo: os vídeos saem daqui com
      // `pagina: -1` e o `pptxImportar` os descarta — DIZENDO na linha do item,
      // porque uma apresentação que chega sem os vídeos e sem explicação é
      // indistinguível de uma que nunca os teve. Derrubar a importação inteira
      // por causa do mapa seria trocar um recurso a menos por uma apresentação
      // a menos.
      console.warn('[pptx] não deu para ligar vídeo a slide:', e && e.message);
    }

    const porCaminho = {};
    for (const p in porPagina) porCaminho[porPagina[p]] = p | 0;

    const videos = [];
    for (const e of pesadas) {
      videos.push({
        pagina: (e.nome in porCaminho) ? porCaminho[e.nome] : -1,
        blob: await Z.extrair(file, e),
        nome: e.nome,
        bytes: e.cru,
      });
    }
    const enxuto = await Z.remontar(file, dir.filter((e) => !Z.ehMidiaPesada(e.nome)));
    return { enxuto, videos, total: pesadas.length };
  }

  /**
   * `.pptx` → uma imagem por página.
   *
   * Devolve `{ pages: [Blob], videos: [{pagina, blob, nome}], truncado }`, ou
   * `null` quando não saiu página nenhuma. `onProgresso(feitas, total)` é
   * chamado a cada página.
   *
   * A biblioteca entra por `import()` DINÂMICO: é 1,5 MB que só interessa a
   * quem importar um `.pptx`, e carregá-la no boot custaria isso a todo culto.
   */
  async function paginasDoPptx(file, onProgresso) {
    const { PptxViewer } = await import('../vendor/pptx-renderer.js');
    const { enxuto, videos } = await separarVideos(file);
    const palco = criarPalco();
    let visor = null;
    try {
      // `fitMode: 'none'` desliga o redimensionamento adaptativo do
      // renderizador: com `contain` ele observa a largura do contêiner e
      // re-renderiza a apresentação inteira a cada mudança — e o contêiner
      // aqui tem largura ZERO, que não é uma medida sobre a qual escalar.
      visor = new PptxViewer(palco.oficina, {
        zipLimits: LIMITES_DO_ZIP, fitMode: 'none',
      });
      // `renderMode: 'slide'` é o que impede a abertura de montar a
      // apresentação INTEIRA de uma vez — o pico de memória que este arquivo
      // existe para não ter. A página que ela desenha é descartada logo abaixo,
      // no primeiro `queueRender` que não vem: quem desenha o que vale é o
      // laço.
      await visor.open(await enxuto.arrayBuffer(), { renderMode: 'slide' });
      const total = Math.min(visor.slideCount || 0, MAX_PAGINAS);
      if (!total) return null;
      // A ESCALA SAI DA APRESENTAÇÃO, não da caixa medida. O `.pptx` declara o
      // tamanho do slide e ele não é sempre 16:9 — um material 4:3 medido pela
      // caixa sairia esticado.
      const escala = LARGURA / (visor.slideWidth || LARGURA);
      const w = Math.max(1, Math.round((visor.slideWidth || 0) * escala));
      const h = Math.max(1, Math.round((visor.slideHeight || 0) * escala));
      const cache = cacheDeRecursos();
      const pages = [];
      for (let i = 0; i < total; i++) {
        const cela = doc.createElement('div');
        cela.style.cssText = 'width:' + w + 'px;height:' + h + 'px;'
          + 'overflow:hidden;position:relative;background:#fff;';
        palco.mesa.appendChild(cela);
        let mao = null;
        try {
          mao = visor.renderSlideToContainer(i, cela, escala);
          if (!mao) return null;
          // ESPERAR PELO `ready` É O QUE FALTAVA no lugar de dois quadros de
          // `requestAnimationFrame`: o renderizador tem tarefas assíncronas
          // (metarquivos EMF, gráficos, mídia que só sai do zip depois), e um
          // relógio não sabe quando elas terminam. Uma que falhe não derruba a
          // página — o slide sai sem aquele pedaço, e é isso que o `catch` diz.
          if (mao.ready) { try { await mao.ready; } catch (_) {} }
          const feita = await elementoParaImagem(cela, w, h, cache);
          if (!feita || !feita.blob || !feita.blob.size) return null;
          pages.push(feita.blob);
        } finally {
          if (mao) mao.dispose();
          cela.remove();
        }
        if (onProgresso) onProgresso(i + 1, total);
      }
      // O VÍDEO DE UMA PÁGINA QUE NÃO SAIU não pode ficar apontando para ela: a
      // apresentação é cortada em `MAX_PAGINAS`, e um índice além do fim faria
      // a automação buscar uma página que não existe.
      for (const v of videos) if (v.pagina >= pages.length) v.pagina = -1;
      return pages.length
        ? { pages, videos, truncado: (visor.slideCount || 0) > MAX_PAGINAS }
        : null;
    } finally {
      // `destroy` ANTES de tirar o palco: é ele que revoga as URLs de objeto da
      // mídia do `.pptx` e desmonta o observador de tamanho. Removida a caixa
      // primeiro, o revogar continuaria acontecendo — mas o observador ficaria
      // apontando para um elemento fora do documento.
      try { if (visor) visor.destroy(); } catch (_) {}
      palco.fechar();
    }
  }

  global.AVDeck = {
    LARGURA, MAX_PAGINAS, PAGINA_LEVE, QUALIDADE, LIMITES_DO_ZIP,
    tabelaDaFonte, textoDeSimbolo, trocarSimbolos,
    ehExterna, cacheDeRecursos, comoDataUrl, embutirRecursos, trocarCanvas,
    escolherFormato, elementoParaImagem, criarPalco, paginasDoPptx, separarVideos,
    WINGDINGS, SYMBOL,
  };
})(this);
