/**
 * ===== A DISSOLUÇÃO DE UMA COLETÂNEA (v1.5.16) =====
 *
 * Pedido do operador: *"Ajuste as coletâneas, agora os albuns do celebra SP,
 * serão individualmente colocados na coleção de 'diversos'. Não identifiquei
 * independência suficiente para que ele tenha uma coleção só para ele. Remover
 * esse grupo em específico das coleções, fara com que todas as coleções caibam
 * na tela enquanto estiverem colapsadas, sem a necessidade de rolar."*
 *
 * **AS COLETÂNEAS SÃO DO BANCO, NÃO NOSSAS.** `pt_categories` manda
 * categoria → álbum, e o app não tem como pedir ao LouvorJA que reorganize o
 * acervo dele. O que este arquivo faz é uma leitura EDITORIAL: uma tabela que
 * diz *"esta coletânea não tem independência suficiente; os álbuns dela entram
 * naquela"*, aplicada sobre o catálogo cru toda vez que a Biblioteca é
 * desenhada.
 *
 * ===== É UMA TRANSFORMAÇÃO DERIVADA, NUNCA UMA MUTAÇÃO DO CATÁLOGO =====
 *
 * A regra roda na LEITURA (`renderCollectionsListMiolo`) e devolve cópias; o
 * `state['albumCatalog']` continua com o que o banco mandou. Aplicá-la no
 * `fetchAlbumCatalog` e gravar a hierarquia já dissolvida transformaria a
 * decisão em DADO no aparelho: um ajuste da tabela chegaria por OTA em minutos
 * e não desfaria o que já está gravado enquanto não houvesse rede para uma nova
 * busca — e um aparelho offline no sábado ficaria com a regra de anteontem, sem
 * sinal nenhum de que está congelado.
 *
 * ===== MOVER, JAMAIS DROPAR =====
 *
 * MEDIDO num Chromium a 430×900, com o acervo do operador (Favoritos + duas
 * séries + dois hinários + as coletâneas) e **na barra de ANTES do aperto deste
 * mesmo lote** (51,59px; ver `--bar-secao-h` em `controle.css`, que a levou a
 * 45,19px):
 *
 *   - com 5 coletâneas (10 blocos): `scrollHeight` 615 × `clientHeight` 582 — ROLA;
 *   - com 4 (9 blocos): 582 × 582 — não rola.
 *
 * Com a barra apertada os dois cabem, e é por isso que as duas mudanças foram
 * feitas juntas: a dissolução entrega o pedido e o aperto lhe dá margem.
 *
 * E **DROPAR a coletânea devolve o bloco pela porta dos fundos**: sem uma
 * categoria que os reivindique, os álbuns viram ÓRFÃOS e o
 * `renderCollectionsListMiolo` desenha "Outros álbuns" com eles dentro —
 * MEDIDO, 10 blocos, ainda rolando. A dissolução só cumpre o pedido se for uma
 * FUSÃO.
 *
 * ===== AS CINCO REGRAS, CADA UMA RESPONDENDO A UM RISCO MEDIDO =====
 *
 * 1. **Origem ausente** → `sem-origem`, identidade. O banco pode renomear.
 * 2. **DESTINO ausente** → `sem-destino`, identidade, e **a coletânea de origem
 *    FICA NA TELA**. É a regra mais importante do arquivo: dissolver para lugar
 *    nenhum apaga álbuns do acervo em silêncio — eles sairiam da seção que os
 *    hospedava, não haveria destino, e o operador concluiria que o acervo
 *    encolheu. Falhar ABERTO aqui é devolver o desenho de antes.
 * 3. **N:N** — a relação categoria↔álbum é de muitos para muitos (ver
 *    `docs/FONTE-DE-DADOS-LOUVORJA.md` §5.5), e `categoryCards` não deduplica.
 *    Um álbum que JÁ esteja no destino não é empurrado de novo (sairia o mesmo
 *    card duas vezes, com dois pivôs); o pivô que prevalece é o **do destino**,
 *    que é o que descreve o álbum naquele contexto.
 * 4. **Ordem** — os movidos entram no FIM, preservando entre si a ordem que
 *    tinham na origem, com o `order` REESCRITO a partir do maior do destino.
 *    Os `order` das duas coletâneas são escalas independentes do PIVÔ (ambas
 *    começam em 1): mesclar e reordenar por elas produz um intercalado que não
 *    significa nada e continua parecendo uma lista ordenada.
 * 5. **O subtítulo do pivô viaja com o álbum** — é o único texto que o banco
 *    escreveu sobre ele naquela coletânea.
 *
 * ===== A GRAFIA É UMA LISTA, NÃO UMA STRING =====
 *
 * O único registro que temos dos nomes reais é uma captura de aparelho
 * (`site/telas/biblioteca.webp`, com a Biblioteca colapsada) e o fixture de um
 * oráculo: *CDs oficiais/ano · Adoradores · Cantores · Celebra SP · Diversas*.
 * A captura é de antes da v1.5.11 e a barra desenhava o nome em MAIÚSCULAS por
 * CSS, então ela prova o CONJUNTO e a ORDEM — não a caixa nem a acentuação.
 * Daí `de`/`para` serem listas de grafias aceitas, comparadas pelo `normalizar`
 * (sem acento, sem caixa, espaço colapsado).
 *
 * **E `'Diversos'` entra como apelido de propósito:** foi a palavra do PEDIDO, e
 * a seção se chama **`'Diversas'`**. Nenhuma normalização liga uma à outra — é
 * o feminino, não um acento. Aceitar as duas é o que faz a regra sobreviver a
 * uma renomeação do banco em qualquer das direções.
 *
 * ===== PURO, E COM ORÁCULO =====
 *
 * Zero DOM, zero rede, zero `window` — recebe o global pelo `this` da IIFE,
 * como o `serie.js`, o `sorteio.js` e o `hinario.js`, e é isso que o deixa
 * rodar num `new Function` dentro do Node. O oráculo é
 * `tools/coletanea.test.mjs`. Os dois modos de errar são MUDOS: uma fusão que
 * duplica devolve o mesmo card duas vezes numa lista plausível, e uma que
 * perde um álbum devolve uma lista plausível com um a menos — e ninguém conta
 * álbuns.
 */
(function (global) {
  'use strict';

  // A TABELA. Uma linha por coletânea dissolvida; `de` e `para` são as grafias
  // aceitas, em ordem de preferência. Uma linha a mais dissolve outra coletânea
  // sem código novo.
  const DISSOLVER = [
    { de: ['Celebra SP'], para: ['Diversas', 'Diversos'] },
  ];

  // Os motivos que o Registro imprime. Eles são o VEREDITO de quem decidiu —
  // quem monta a frase é o `controle.js` (a invariante do diagnóstico: Kotlin e
  // regra devolvem dado, a UI monta o texto).
  const MOTIVO_MOVIDA = 'movida';          // dissolveu
  const MOTIVO_SEM_ORIGEM = 'sem-origem';  // a coletânea não existe neste banco
  const MOTIVO_SEM_DESTINO = 'sem-destino'; // o destino não existe: NADA é feito

  // Cópia do `normalizar` do `serie.js`, DE PROPÓSITO — a regra do `hinario.js`
  // aplicada de novo: um módulo puro não importa outro módulo puro para ler uma
  // função de quatro linhas. Quem impede a divergência é o oráculo, que compara
  // os dois FONTES.
  function normalizar(s) {
    return String(s == null ? '' : s)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Igualdade de nome de coletânea: normalizada e INTEIRA, nunca por prefixo ou
  // por conteúdo. "Celebra SP" e "Celebra SP 2" são coletâneas diferentes, e um
  // `includes` dissolveria a segunda junto sem que ninguém pedisse.
  function casa(nome, aceitos) {
    const n = normalizar(nome);
    if (!n) return false;
    return (aceitos || []).some((a) => n === normalizar(a));
  }

  // Acha o ÍNDICE da primeira categoria cujo nome casa com uma das grafias.
  // Índice e não objeto: quem chama precisa saber ONDE ela está para poder
  // remover a origem e reescrever o destino no lugar.
  function acharIndice(categorias, aceitos) {
    for (let i = 0; i < categorias.length; i++) {
      if (casa(categorias[i] && categorias[i].name, aceitos)) return i;
    }
    return -1;
  }

  // Cópia rasa de uma entrada do pivô. O pivô é `{ id_album, subtitle, order }`
  // e mais nada (ver `fetchAlbumCatalog`); copiá-lo campo a campo é o que
  // garante que a regra nunca devolva uma referência à entrada de ENTRADA.
  // Um pivô sem `id_album` é DESCARTADO, e não copiado: é o mesmo filtro que o
  // `fetchAlbumCatalog` já aplica na entrada. Sem ele, um `null` no array faz
  // `aplicar` LANÇAR — e como o `blocoColetaneas` do Registro chama a mesma
  // função, a exceção derruba o Registro inteiro, não só este bloco: o operador
  // copia o texto anterior e nada na tela diz que ele é velho.
  function copiarPivo(a) {
    if (!a || a.id_album == null) return null;
    return { id_album: a.id_album, subtitle: a.subtitle || '', order: Number(a.order) || 0 };
  }

  /**
   * Aplica a tabela sobre as categorias CRUAS do catálogo.
   *
   * Devolve `{ categorias, diario }` e **nunca muta a entrada**:
   *   - `categorias`: a lista a desenhar, com as origens dissolvidas fora;
   *   - `diario`: uma entrada por linha da tabela, com o dado CRU e o motivo —
   *     `{ de, para, motivo, movidos, jaEstavam, repetidosNaOrigem }`.
   *     `de`/`para` são os nomes VERBATIM do banco quando a categoria existe, e
   *     a primeira grafia da tabela quando não existe: é lendo o nome cru que
   *     se descobre uma renomeação, e é para isso que o bloco do Registro existe.
   */
  function aplicar(categorias) {
    const entrada = Array.isArray(categorias) ? categorias : [];
    // A cópia é feita UMA vez, no começo, e todas as regras trabalham sobre ela.
    let out = entrada.map((c) => ({
      id_category: c && c.id_category,
      name: (c && c.name) || '',
      order: Number(c && c.order) || 0,
      albums: (Array.isArray(c && c.albums) ? c.albums : []).map(copiarPivo).filter(Boolean),
    }));
    const diario = [];

    for (const regra of DISSOLVER) {
      const iDe = acharIndice(out, regra.de);
      const iPara = acharIndice(out, regra.para);
      if (iDe < 0) {
        diario.push({ de: regra.de[0], para: regra.para[0],
          motivo: MOTIVO_SEM_ORIGEM, movidos: [], jaEstavam: [], repetidosNaOrigem: [] });
        continue;
      }
      if (iPara < 0) {
        // FALHA ABERTA: a coletânea de origem continua na tela, inteira.
        diario.push({ de: out[iDe].name, para: regra.para[0],
          motivo: MOTIVO_SEM_DESTINO, movidos: [], jaEstavam: [], repetidosNaOrigem: [] });
        continue;
      }
      if (iDe === iPara) {
        // LINHA DEGENERADA: `de` e `para` resolvem para a MESMA categoria. Sem
        // esta guarda, todo álbum cairia em "já está no destino" e o `filter`
        // logo abaixo removeria a categoria — os álbuns sumiriam da Biblioteca,
        // que é exatamente o desfecho que o `sem-destino` existe para impedir,
        // pela única porta que ele não cobre. Hoje é inalcançável (nenhuma
        // grafia de "Celebra SP" normaliza para "Diversas"), e a tabela convida
        // a crescer: "uma linha a mais dissolve outra coletânea sem código novo".
        diario.push({ de: out[iDe].name, para: out[iPara].name,
          motivo: MOTIVO_SEM_DESTINO, movidos: [], jaEstavam: [], repetidosNaOrigem: [] });
        continue;
      }
      const origem = out[iDe];
      const destino = out[iPara];
      // CONGELADO antes do laço, e é isso que separa duas coisas diferentes: um
      // álbum que o banco lista nas DUAS coletâneas (N:N, o caso real) e um
      // álbum repetido DENTRO da própria origem. Alimentando o mesmo conjunto,
      // o segundo saía no Registro como "já estava no destino" — a frase manda
      // procurar o álbum na coletânea de destino, onde ele não está.
      const noDestino = new Set(destino.albums.map((a) => a.id_album));
      const jaLa = new Set(noDestino);
      // O maior `order` do destino é a base da nova escala. `reduce` e não
      // `albums[length-1].order`: a lista chega ordenada do `fetchAlbumCatalog`,
      // mas depender dessa ordenação aqui é uma segunda escrita da invariante.
      let base = destino.albums.reduce((m, a) => Math.max(m, Number(a.order) || 0), 0);
      const movidos = [];
      const jaEstavam = [];
      const repetidosNaOrigem = [];
      for (const a of origem.albums) {
        if (jaLa.has(a.id_album)) {
          (noDestino.has(a.id_album) ? jaEstavam : repetidosNaOrigem).push(a.id_album);
          continue;
        }
        jaLa.add(a.id_album);
        base += 1;
        destino.albums.push({ id_album: a.id_album, subtitle: a.subtitle || '', order: base });
        movidos.push(a.id_album);
      }
      out = out.filter((_, i) => i !== iDe);
      diario.push({ de: origem.name, para: destino.name,
        motivo: MOTIVO_MOVIDA, movidos, jaEstavam, repetidosNaOrigem });
    }

    return { categorias: out, diario };
  }

  global.AVColetanea = {
    DISSOLVER, MOTIVO_MOVIDA, MOTIVO_SEM_ORIGEM, MOTIVO_SEM_DESTINO,
    normalizar, casa, aplicar,
  };
})(this);
