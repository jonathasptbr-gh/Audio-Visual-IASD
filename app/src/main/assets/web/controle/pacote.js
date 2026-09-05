// ============================================================================
// O PACOTE DE TRANSFERÊNCIA — o acervo de um aparelho num arquivo só.
//
// ## Por que ele existe
//
// Pedido do operador: *"o download e instalação do app é leve, mas a biblioteca
// e o resto são pesados; para opções offline, permitir copiar e compartilhar o
// arquivo diretamente de um smartphone para o outro é extremamente útil …
// analise um método de exportar e importar os dados armazenados de um app para
// o outro app em outro dispositivo. no caso criar um modelo de arquivo para
// exportar e importar."*
//
// Um hinário inteiro são centenas de faixas baixadas uma a uma de um servidor
// de terceiro, e a Wi-Fi de uma igreja no sábado de manhã é o pior lugar do
// mundo para fazer isso. Com um arquivo, o segundo aparelho recebe por cabo,
// Bluetooth ou cartão o que o primeiro levou horas para juntar.
//
// ## O que este arquivo É, e o que ele NÃO é
//
// Ele é a REGRA do formato — pura, sem DOM, sem IndexedDB, sem ponte, com
// oráculo em Node (`tools/pacote.test.mjs`). Quem lê e escreve bytes de verdade
// é o `controle.js`, que tem o banco e o canal do shell. É a mesma divisão do
// `pptxzip.js` (a regra do zip aqui, o arquivo lá) e das SÉRIES: o que erra é a
// regra, e a regra se conserta por OTA em minutos.
//
// ## O FORMATO, e por que ele é sequencial
//
//   ┌──────────────┬──────────────────────────────────────────────┐
//   │ assinatura   │ 8 bytes: "AVPKG" + 0x01 + versão (u16 LE)    │
//   ├──────────────┼──────────────────────────────────────────────┤
//   │ registro ×N  │ u32 LE (tamanho do cabeçalho) │ JSON │ corpo │
//   └──────────────┴──────────────────────────────────────────────┘
//
// O corpo tem exatamente `cab.bytes` bytes (0 = sem corpo). O último registro é
// `{ t: 'fim' }`, e ele é OBRIGATÓRIO: é ele — e não o tamanho do arquivo — que
// distingue um pacote inteiro de um pacote que acabou no meio. Meia biblioteca
// que importa em silêncio é o pior desfecho que este recurso pode produzir.
//
// **Sequencial e não zip**, e a razão é o tamanho: um acervo passa de
// gigabytes, e um zip pede o DIRETÓRIO CENTRAL no fim — quem escreve precisa
// guardar uma entrada por arquivo até o último byte, e quem lê precisa
// alcançar o fim antes de abrir o primeiro item. Aqui os dois lados andam para
// a frente, um registro por vez, e a memória usada é a do maior BLOCO (1 MiB),
// nunca a do maior arquivo. Nada é comprimido de propósito: o que pesa num
// acervo é mp4 e m4a, que já são comprimidos, e recomprimi-los custaria horas
// de CPU para não ganhar nada.
//
// **A extensão é cosmética.** Quem identifica o arquivo é a ASSINATURA nos
// primeiros oito bytes — um provedor de documentos do Android pode trocar o
// `.avpkg` por `.bin` ao criar, e o pacote continua importando. É a mesma
// disciplina do `SafRegistry`: vale o conteúdo, nunca o rótulo.
// ============================================================================
(function (global) {
  'use strict';

  // "AVPKG" + 0x01 (fim do texto, para um editor não emendar a assinatura na
  // primeira chave JSON) + a versão do FORMATO em u16 little-endian.
  const MAGICA = [0x41, 0x56, 0x50, 0x4b, 0x47, 0x01];
  const VERSAO = 1;
  const ASSINATURA_BYTES = 8;
  const PREFIXO_BYTES = 4;

  // Teto do cabeçalho de UM registro. Ele é generoso porque o cabeçalho de uma
  // mídia carrega o registro inteiro do banco — e a LETRA de um hino mora lá
  // dentro, com dezenas de estrofes. É também a defesa contra um arquivo
  // corrompido cujo u32 diga "leia 3 GB de JSON": sem teto, o importador tenta
  // materializar isso e o processo morre levando a projeção junto.
  const TETO_CABECALHO = 4 * 1024 * 1024;

  // Os tipos de registro. LISTA DE PERMISSÃO, e não uma validação por forma:
  // um pacote é um arquivo de fora, e um `t` desconhecido tem de ser recusado
  // em vez de cair num `default` que ninguém escreveu. Um tipo novo entra aqui
  // E no `switch` do importador — as duas metades, no mesmo lote.
  const TIPOS = [
    'info',        // o cabeçalho humano do pacote (corpo: JSON)
    'state',       // uma chave de `state` cujo valor é JSON
    'state-blob',  // uma chave de `state` cujo valor é um Blob (o wallpaper)
    'media',       // um registro de "media"; o corpo é o blob principal
    'media-thumb', // a miniatura daquele registro
    'media-pagina',// uma página de uma apresentação (kind 'deck')
    'arquivo',     // um registro do catálogo OPFS ("files"); sem corpo
    'arquivo-thumb',
    'opfs',        // um arquivo do OPFS, pelo CAMINHO
    'fim',
  ];

  // ===== AS CHAVES DE `state` QUE NÃO VIAJAM =====
  //
  // LISTA DE RECUSA e não de permissão, ao contrário dos TIPOS acima — e a
  // assimetria é deliberada. Ali o perigo é ACEITAR o desconhecido (um arquivo
  // de fora); aqui o perigo é DESCARTAR o desconhecido: uma preferência nova
  // que ninguém lembrasse de acrescentar a uma lista de permissão simplesmente
  // não atravessaria, em silêncio, e o operador descobriria no sábado. O
  // conjunto perigoso é pequeno e nomeável; o resto é preferência, e preferência
  // que viaja a mais não quebra nada.
  //
  // Cada uma está aqui por um motivo próprio:
  const FORA = [
    // TRANSITÓRIAS, e as duas fazem o aparelho de destino AGIR sozinho:
    // `ota-intencao` reabre o instalador do APK na primeira abertura, e
    // `yt-intencoes` faz o app reclamar downloads que nunca começaram AQUI.
    'ota-intencao',
    'yt-intencoes',
    // A PASTA DO APARELHO. Ela guarda `content://` do SAF, que são concessões
    // deste aparelho e não significam nada no outro — e o modo de falhar é o
    // PIOR do app: `listFolder` sobre uma URI que não se pode abrir devolve
    // lista VAZIA, e o `controle.js` lê isso como "a pasta sumiu do aparelho".
    // Os arquivos dessas pastas também ficam de fora (ver `pastasDoAparelho`).
    'opfs-folders',
    // A CENA NO AR e o HISTÓRICO do culto: as duas descrevem o que aconteceu
    // NAQUELE aparelho. Importar a cena do outro trocaria a projeção de quem
    // importa; importar o histórico misturaria dois cultos num diário só.
    'current',
    'historico',
  ];

  /** A assinatura do arquivo, pronta para ser o primeiro bloco escrito. */
  function assinatura() {
    const u8 = new Uint8Array(ASSINATURA_BYTES);
    u8.set(MAGICA, 0);
    new DataView(u8.buffer).setUint16(MAGICA.length, VERSAO, true);
    return u8;
  }

  /**
   * `{ ok: true, versao }` ou `{ ok: false, erro }` — a FRASE, não um booleano.
   *
   * As duas recusas pedem respostas diferentes e por isso não são a mesma:
   * "não é um pacote do app" manda o operador conferir qual arquivo ele
   * escolheu; "foi feito por uma versão mais nova" manda atualizar o app. Um
   * `false` para os dois casos deixaria a tela adivinhando.
   */
  function conferirAssinatura(u8) {
    if (!u8 || u8.length < ASSINATURA_BYTES) {
      return { ok: false, erro: 'Este arquivo não é um pacote do Áudio Visual IASD.' };
    }
    for (let i = 0; i < MAGICA.length; i++) {
      if (u8[i] !== MAGICA[i]) {
        return { ok: false, erro: 'Este arquivo não é um pacote do Áudio Visual IASD.' };
      }
    }
    const versao = new DataView(u8.buffer, u8.byteOffset, u8.byteLength)
      .getUint16(MAGICA.length, true);
    if (versao > VERSAO) {
      return { ok: false, erro: 'Este pacote foi criado por uma versão mais nova do app. Atualize antes de importar.' };
    }
    return { ok: true, versao };
  }

  /** O registro em bytes: `u32 LE` do tamanho do JSON + o JSON. O CORPO é
   *  escrito pelo chamador, logo em seguida — ele já tem o Blob na mão e não
   *  precisa copiá-lo para dentro de um array só para sair de novo. */
  function cabecalhoParaBytes(cab) {
    const json = new TextEncoder().encode(JSON.stringify(cab));
    if (json.length > TETO_CABECALHO) throw new Error('pacote: cabeçalho grande demais');
    const u8 = new Uint8Array(PREFIXO_BYTES + json.length);
    new DataView(u8.buffer).setUint32(0, json.length, true);
    u8.set(json, PREFIXO_BYTES);
    return u8;
  }

  /** Quantos bytes de JSON vêm a seguir. Lança com FRASE fora do teto — um
   *  arquivo corrompido cujo u32 diga "3 GB" mataria o processo, e com ele a
   *  projeção. */
  function tamanhoDoCabecalho(u8) {
    if (!u8 || u8.length < PREFIXO_BYTES) throw new Error('pacote: acabou no meio de um registro');
    const n = new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getUint32(0, true);
    if (n <= 0 || n > TETO_CABECALHO) throw new Error('pacote: registro com tamanho impossível');
    return n;
  }

  /**
   * O cabeçalho já validado — `{ t, bytes, … }`.
   *
   * `bytes` SEMPRE existe e é inteiro não-negativo, mesmo nos tipos sem corpo:
   * é ele que diz ao leitor quanto pular para chegar ao registro seguinte, e um
   * `undefined` ali faria o cursor parar no lugar errado e ler lixo como se
   * fosse o próximo cabeçalho.
   */
  function cabecalhoDeBytes(u8) {
    let cab;
    try { cab = JSON.parse(new TextDecoder().decode(u8)); } catch (_) {
      throw new Error('pacote: registro ilegível');
    }
    if (!cab || typeof cab !== 'object' || Array.isArray(cab)) {
      throw new Error('pacote: registro ilegível');
    }
    if (TIPOS.indexOf(cab.t) < 0) throw new Error('pacote: registro de tipo desconhecido');
    const n = cab.bytes;
    if (!Number.isInteger(n) || n < 0) throw new Error('pacote: registro sem tamanho');
    return cab;
  }

  // ===== O SANEAMENTO DOS REGISTROS =====
  //
  // A regra é a mesma do `telaSanearRec` do telão por comandos: **o que é deste
  // aparelho não atravessa.** Ali o motivo era a rede; aqui é o tempo e o outro
  // aparelho, e o efeito é idêntico — um campo que só faz sentido na origem
  // chega ao destino como uma referência para lugar nenhum.

  /** Os campos que carregam BYTES e viajam como registros próprios. */
  const CAMPOS_BLOB = ['blob', 'thumb', 'pages'];

  /**
   * O registro de "media" pronto para o cabeçalho.
   *
   * Sai o que carrega bytes (eles viajam como corpo dos registros) e sai o
   * `stream`: ele é o manifesto de uma TRANSMISSÃO DIRETA, com URLs do
   * googlevideo que expiram em horas e tokens de um `StreamProxy` que só existe
   * no aparelho de origem. Um item com `stream` e sem `blob` chega ao destino
   * como uma cena que não toca — e o `onStreamErro` de lá pediria um manifesto
   * novo, o que funciona, mas depois de a projeção já ter falhado uma vez.
   * Sem o campo, o item é um LINK do YouTube, que é o que ele de fato é: o
   * destino o resolve no primeiro toque, pelo caminho que já existe.
   */
  function sanearMedia(rec) {
    const out = {};
    for (const k of Object.keys(rec || {})) {
      if (CAMPOS_BLOB.indexOf(k) >= 0 || k === 'stream') continue;
      out[k] = rec[k];
    }
    return out;
  }

  /** O registro do catálogo OPFS. Mesma regra: a miniatura viaja à parte, e o
   *  `blob`/`url` de um registro de arquivo já nascem nulos. */
  function sanearArquivo(rec) {
    const out = {};
    for (const k of Object.keys(rec || {})) {
      if (k === 'thumb' || k === 'blob') continue;
      out[k] = rec[k];
    }
    out.blob = null;
    return out;
  }

  /** Esta chave de `state` atravessa? Ver a lista `FORA` e o porquê de ela ser
   *  de RECUSA. */
  function chaveViaja(chave) {
    return typeof chave === 'string' && chave !== '' && FORA.indexOf(chave) < 0;
  }

  /**
   * OS CAMINHOS DE OPFS QUE NÃO VIAJAM: os de uma pasta do APARELHO.
   *
   * O OPFS guarda as duas coisas na mesma prateleira — `folders/<id>/` é tanto
   * uma coleção baixada do acervo quanto uma pasta sincronizada do celular —, e
   * o que as separa não é o caminho: é a lista `opfs-folders`, que nomeia as do
   * aparelho. Elas ficam de fora porque a origem delas fica: são a CÓPIA de
   * arquivos que vivem naquele celular, e no destino o "sincronizar" delas não
   * teria para onde apontar (ver o comentário da chave em `FORA`).
   *
   * Devolve uma função `(caminho) => boolean`, para o chamador percorrer o OPFS
   * uma vez só perguntando a cada arquivo.
   */
  // ===== OS GRUPOS DA EXPORTAÇÃO (v1.7.2) =====
  //
  // Pedido do operador: *"pode fazer ele de forma segmentada, por coleção? …
  // caso o usuário não queira levar toda a biblioteca … permita um popup com um
  // check list de grupos para a exportação"*.
  //
  // A regra é UMA pergunta — *"a que grupo pertence este caminho do OPFS?"* — e
  // ela mora aqui porque é ela que erra: o OPFS é uma árvore de arquivos e a
  // relação com as coleções é uma CONVENÇÃO DE CAMINHO (`folders/<id>/…`), não
  // um campo. Se um dia ela mudar, o conserto chega por OTA em minutos.
  //
  // TRÊS CHAVES, e a terceira é a que impede o silêncio:
  //
  //   · `col:<id>` — o que mora sob `folders/<id>/`, com `<id>` de uma coleção
  //     que este aparelho conhece;
  //   · `outros`   — TODO o resto que ainda viaja: `folders/<id>/` de uma
  //     coleção que saiu do catálogo, e arquivos fora de `folders/`. É a chave
  //     de escape, e ela existe porque a alternativa é um arquivo sumir do
  //     pacote sem aparecer em lista nenhuma — que é o defeito que a varredura
  //     do DISCO (e não do catálogo) já existiu para consertar uma vez;
  //   · `ajustes`  — as chaves de `state`. Não é um caminho, é o grupo que
  //     recebe tudo o que não é arquivo, e ele NÃO É OPCIONAL (ver abaixo).
  //
  // O `ajustes` VIAJA SEMPRE, e a razão é o coletor de lixo do destino: as
  // listas do app (`imports`, `playlist`, `favs`) moram em `state`, e um item de
  // mídia que chega sem a lista que o referencia é ÓRFÃO — o `gcOrfaos` da
  // abertura seguinte o apaga. Um pacote "só a mídia" importaria e sumiria
  // sozinho, que é o pior desfecho que este recurso sabe produzir.
  const GRUPO_AJUSTES = 'ajustes';
  const GRUPO_OUTROS = 'outros';
  const GRUPO_COL = 'col:';

  /**
   * O grupo de um caminho do OPFS. `colecoes` é o conjunto de ids que este
   * aparelho conhece — injetado, porque o catálogo é do `controle.js` e este
   * módulo é puro.
   */
  function grupoDoCaminho(caminho, colecoes) {
    const partes = String(caminho || '').split('/').filter(Boolean);
    if (partes.length >= 2 && partes[0] === 'folders') {
      const id = partes[1];
      // O `has` é sobre o CONJUNTO INJETADO, e por isso um `Set` vazio manda
      // tudo para `outros` em vez de inventar grupos: sem catálogo não há como
      // nomear uma coleção, e um grupo com id cru na tela não diz nada.
      if (colecoes && colecoes.has && colecoes.has(id)) return GRUPO_COL + id;
    }
    return GRUPO_OUTROS;
  }

  /** O id da coleção de uma chave `col:<id>`, ou `''` para as outras. */
  function colecaoDoGrupo(chave) {
    const c = String(chave || '');
    return c.indexOf(GRUPO_COL) === 0 ? c.slice(GRUPO_COL.length) : '';
  }

  function pastasDoAparelho(lista) {
    const ids = new Set();
    for (const f of (Array.isArray(lista) ? lista : [])) {
      if (f && f.id) ids.add('folders/' + f.id + '/');
    }
    return function caminhoViaja(caminho) {
      const c = String(caminho || '');
      for (const p of ids) if (c.indexOf(p) === 0) return false;
      return true;
    };
  }

  /**
   * O NOME SUGERIDO, com a DATA dentro.
   *
   * Pelo mesmo motivo do arquivo do Registro: o valor de um pacote é comparar
   * dois ("o de antes de eu apagar o hinário" e o de hoje), e dois arquivos com
   * o mesmo nome viram "acervo (1).avpkg" na pasta — uma semana depois ninguém
   * sabe qual é qual.
   */
  function nomeDoArquivo(d) {
    const q = d instanceof Date ? d : new Date();
    const p = (n) => String(n).padStart(2, '0');
    return 'acervo-av-' + q.getFullYear() + p(q.getMonth() + 1) + p(q.getDate())
      + '-' + p(q.getHours()) + p(q.getMinutes()) + '.avpkg';
  }

  global.AVPacote = {
    VERSAO,
    ASSINATURA_BYTES,
    PREFIXO_BYTES,
    TETO_CABECALHO,
    TIPOS,
    FORA,
    assinatura,
    conferirAssinatura,
    cabecalhoParaBytes,
    tamanhoDoCabecalho,
    cabecalhoDeBytes,
    sanearMedia,
    sanearArquivo,
    chaveViaja,
    GRUPO_AJUSTES,
    GRUPO_OUTROS,
    GRUPO_COL,
    grupoDoCaminho,
    colecaoDoGrupo,
    pastasDoAparelho,
    nomeDoArquivo,
  };
})(this);
