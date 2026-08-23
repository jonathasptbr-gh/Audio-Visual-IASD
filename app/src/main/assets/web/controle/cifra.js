// ============================================================================
// CIFRA — a regra que lê uma página de cifra e a transforma em linhas
//
// A aba "Cifra" do visualizador de letras é lida SOB DEMANDA: o operador abre a
// aba, o shell busca a página (`AVNative.cifraHtml`, ver `CifraFonte.kt`) e
// este módulo a interpreta. **Nada é baixado em lote, nada entra no bundle do
// OTA, nada é gravado em disco** — o cache é um `Map` em memória no
// `controle.js`, morto ao fechar o app. Isso é contrato do recurso, não detalhe.
//
// ## Por que é um arquivo à parte, e PURO
//
// Não toca no DOM, não faz rede, não conhece o `controle.js` — a mesma forma do
// `serie.js`, e pelos mesmos dois motivos:
//
//  1. **A decisão é de CONTEÚDO, então é do lado web** (invariante 5). O shell
//     entrega o HTML CRU e não opina. A marcação de um site muda quando o dono
//     dele quiser; nesse dia um ajuste aqui chega à frota por OTA em minutos,
//     com oráculo em Node, enquanto o mesmo ajuste em Kotlin custaria um degrau
//     de `SHELL_VERSION` e uma Release por vírgula — e, até ela sair, a aba
//     fica muda.
//  2. **É a peça mais frágil do app.** Ela depende da marcação de um servidor
//     que não é nosso e que não nos deve compatibilidade nenhuma. Frágil por
//     natureza é o que mais precisa de oráculo (`tools/cifra.test.mjs`, Node
//     puro, no `apk.yml` **sem `continue-on-error`**).
//
// ## A REGRA DE OURO: falhar VAZIO é proibido
//
// Os dois modos de errar deste caminho são silenciosos, e o segundo é pior:
//
//   - **não achar a página** → a aba tem de dizer "não achei ESTA música", que
//     tem conserto (buscar por outro nome);
//   - **achar a página e não entender o HTML** → se isso virar "lista vazia", a
//     aba diz a MESMA frase do caso acima, e a mudança de marcação do site fica
//     indistinguível de uma música ausente. **Ninguém investigaria.**
//
// Por isso [lerPagina] devolve `null` para "não entendi" e um objeto com
// `linhas: []` nunca acontece: ou há folha, ou é `null`. Quem chama traduz os
// dois em frases DIFERENTES, e o Registro imprime o que o parser encontrou.
//
// ## As armadilhas da marcação
//
//  1. **A folha de cifra é um `<pre>`, e isso é estrutural, não estilístico.**
//     Acorde sobre sílaba só se sustenta em texto pré-formatado — qualquer site
//     de cifra usa `<pre>`, e é por isso que a âncora do parser é ele, e não
//     uma classe CSS (que muda no primeiro redesenho do site).
//  2. **Pode haver mais de um `<pre>` na página.** O da folha é o MAIOR; os
//     outros são caixas de exemplo, rodapé, tabela de acordes. Escolher o
//     primeiro é escolher o errado num dia qualquer.
//  3. **O acorde vem MARCADO** (`<b>`), e essa é a fonte confiável de "esta
//     linha é de acordes". A heurística por formato existe só como REDE — ver
//     [pareceAcorde] e o preço declarado dela.
//  4. **`<br>` é quebra de linha de verdade dentro do `<pre>`** de muitos
//     sites, convivendo com `\n` reais. Tratar só um dos dois cola a folha
//     inteira numa linha só, ou a explode em duas colunas.
//  5. **Entidades HTML no meio da letra** (`&amp;`, `&#39;`, `&nbsp;`). O
//     `&nbsp;` é o que mais dói: ele é ESPAÇO, e num `<pre>` ele é espaço de
//     ALINHAMENTO — trocá-lo por nada desloca o acorde de coluna.
//
// ## O que este módulo NÃO faz, de propósito
//
//  - **Não guarda nada.** Sem IndexedDB, sem OPFS, sem `localStorage`.
//  - **Não decide URL de host.** Quem trava o host é o Kotlin ([CifraFonte]);
//    aqui uma URL malformada é só uma busca que não acha.
//  - **Não projeta.** A cifra é para o OPERADOR ler enquanto toca; o que vai ao
//    telão continua sendo a letra, pelo caminho de sempre.
//
// Exposto como window.AVCifra.

(function (global) {
  'use strict';

  // ===== O CATÁLOGO =====
  // Uma coleção do app → o caminho do "artista" no site. É o mesmo desenho do
  // `SERIES` do `serie.js`: uma linha a mais dá um hinário novo sem código
  // novo. Só existe porque, para uma coleção conhecida, a URL é DEDUZÍVEL do
  // nome do hino e não há busca nenhuma no caminho — é uma requisição em vez de
  // duas, e sem o ranking de ninguém escolhendo por nós.
  //
  // Quem não estiver aqui cai na busca genérica ([urlDeBusca]), que é o
  // "qualquer música" — o hinário só ganha o atalho.
  const CATALOGO = {
    'hymnal-2022': 'novo-hinario-adventista',
    'hymnal-1996': 'hinario-adventista',
  };

  const BASE = 'https://www.cifraclub.com.br/';

  // ===== MOTIVOS =====
  // O VEREDITO de quem decidiu, para o Registro montar a frase (ver a regra do
  // diagnóstico no CLAUDE.md). Cada um pede uma ação DIFERENTE do operador, e é
  // por isso que são cinco e não um "falhou".
  const OK = 'ok';                       // achou e entendeu
  const MOTIVO_SEM_REDE = 'sem-rede';    // status 0: não houve resposta
  const MOTIVO_NAO_TEM = 'nao-tem';      // 404: o site respondeu que não tem
  const MOTIVO_RECUSOU = 'recusou';      // outro status: o site respondeu outra coisa
  const MOTIVO_ILEGIVEL = 'ilegivel';    // respondeu 200 e o HTML não tem folha

  // ===== texto =====

  // Sem acento, sem caixa, sem espaço repetido. A mesma função do `serie.js`,
  // reescrita aqui porque este módulo é PURO e não depende daquele — dois
  // arquivos independentes não podem ter ordem de carga entre si.
  function normalizar(s) {
    return String(s == null ? '' : s)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')   // marcas de acento, já separadas pelo NFD
      .replace(/\s+/g, ' ')
      .trim();
  }

  // O número da faixa sai do nome ANTES do slug. Os itens do hinário chegam
  // como "001. Nome do Hino" (ver `songLabel`), e o número não faz parte do
  // endereço da música em site nenhum — deixá-lo produz um slug que nunca
  // resolve, e a aba diria "não achei" para toda a coleção.
  function semNumero(nome) {
    return String(nome == null ? '' : nome).replace(/^\s*\d+\s*[.\-–—)]?\s*/, '');
  }

  // O pedaço de URL: minúsculas, sem acento, o resto vira hífen.
  //
  // Hífens nas pontas e repetidos são removidos — "Ó Vem, Ó Vem!" produziria
  // `-o-vem--o-vem-`, que é um endereço diferente de `o-vem-o-vem` e não
  // resolve. É a diferença entre a coleção inteira funcionar e nenhuma música
  // funcionar, decidida por dois caracteres.
  function slug(nome) {
    return normalizar(semNumero(nome))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // ===== URLs =====

  // O endereço direto de um hino de coleção conhecida, ou '' se ela não estiver
  // no catálogo (aí quem responde é a busca).
  function urlDoHino(collId, nome) {
    const artista = CATALOGO[collId];
    const s = slug(nome);
    if (!artista || !s) return '';
    return BASE + artista + '/' + s + '/';
  }

  // O endereço de uma música qualquer, dado o caminho do artista já conhecido
  // (é o que a busca devolve).
  function urlDaMusica(artistaPath, nome) {
    const a = slug(artistaPath);
    const s = slug(nome);
    if (!a || !s) return '';
    return BASE + a + '/' + s + '/';
  }

  /**
   * ARTISTAS que valem uma tentativa DEDUZÍVEL, além do catálogo.
   *
   * Os CDs oficiais e os do ano estão no site sob a coleção **Ministério
   * Jovem** — a mesma forma do [CATALOGO], mas sem uma coleção do acervo para
   * mapear: os álbuns do ano são dezenas ("Missão", "Salmos", "Adoradores"…) e
   * todos caem no mesmo artista lá.
   *
   * Por que uma tentativa própria, e não confiar na busca: a URL aqui é
   * DEDUZÍVEL do nome da música, então é **uma requisição, sem ranking de
   * ninguém escolhendo por nós** — a mesma razão pela qual o catálogo vem antes
   * da busca. Ela entra DEPOIS do catálogo e ANTES da busca genérica.
   *
   * **O custo de estar errado é um 404**, e a busca genérica roda em seguida
   * como sempre — nenhum caminho regride. Cada tentativa entra no Registro
   * verbatim, então um slug que o site renomeie aparece como
   * `padrao …/ministerio-jovem/… → nao-tem` em toda música, e se conserta por
   * OTA sem Release.
   *
   * **A LISTA É PLURAL PORQUE OS CDs DO ANO TÊM ARTISTA PRÓPRIO.** O
   * `cd-jovem-2018` entrou verificado contra a página real
   * (`/cd-jovem-2018/nunca-mais-as-lagrimas/`), e a família continua: cada ano
   * é uma linha. O teto prático é o número de requisições — cada entrada é uma
   * tentativa a mais numa música que não está em nenhuma delas —, então a
   * lista é para os artistas que cobrem MUITAS músicas, não para um álbum
   * específico. Um álbum que se saiba mapear vale mais no [CATALOGO], que é
   * uma tentativa DIRIGIDA em vez de mais uma no rodízio.
   */
  const ARTISTAS_PADRAO = ['ministerio-jovem', 'cd-jovem-2018'];

  /** As URLs dedutíveis de [ARTISTAS_PADRAO] para este nome. */
  function urlsPadrao(nome) {
    return ARTISTAS_PADRAO.map((a) => urlDaMusica(a, nome)).filter(Boolean);
  }

  // A BUSCA GENÉRICA — o "qualquer música". Sem catálogo e sem palpite de
  // slug: quem procura é o site.
  /**
   * A busca do site. `extra` é o SEGUNDO tento (o álbum junto do nome), e ele
   * não é o primeiro de propósito: o álbum do acervo não é o artista do site, e
   * uma palavra a mais numa busca de texto pode ENCOLHER o resultado em vez de
   * afiná-lo. Ele entra quando o primeiro tento não devolveu nada com
   * parentesco — ali não há o que encolher.
   */
  function urlDeBusca(termo, extra) {
    const t = String(termo == null ? '' : termo).trim();
    if (!t) return '';
    const e = String(extra == null ? '' : extra).trim();
    return BASE + '?q=' + encodeURIComponent(e ? t + ' ' + e : t);
  }

  // ===== HTML =====

  // As entidades que aparecem de fato numa página em português. `&nbsp;` vira
  // ESPAÇO e não string vazia: dentro de um `<pre>` ele é espaço de
  // ALINHAMENTO, e comê-lo desloca o acorde da sílaba a que ele pertence.
  const ENTIDADES = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú',
    atilde: 'ã', otilde: 'õ', ccedil: 'ç', acirc: 'â', ecirc: 'ê', ocirc: 'ô',
    agrave: 'à', uuml: 'ü', ndash: '–', mdash: '—', hellip: '…',
  };

  function decodificar(s) {
    return String(s == null ? '' : s).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (todo, corpo) => {
      if (corpo[0] === '#') {
        const n = corpo[1] === 'x' || corpo[1] === 'X'
          ? parseInt(corpo.slice(2), 16)
          : parseInt(corpo.slice(1), 10);
        // Um código fora da faixa útil devolve a entidade INTEIRA em vez de um
        // caractere de substituição: no meio de uma letra, "&#999999;" visível
        // é um defeito que alguém relata; um "�" mudo, ninguém.
        return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : todo;
      }
      const v = ENTIDADES[corpo.toLowerCase()];
      return v === undefined ? todo : v;
    });
  }

  function semTags(s) {
    return decodificar(String(s == null ? '' : s).replace(/<[^>]*>/g, '')).trim();
  }

  // O conteúdo do PRIMEIRO elemento `tag` da página, sem marcação. Serve para
  // `<h1>`/`<h2>`, que é onde título e artista moram em qualquer página de
  // cifra — e é uma âncora semântica, não uma classe CSS (que muda no primeiro
  // redesenho do site).
  function primeiroTexto(html, tag) {
    const re = new RegExp('<' + tag + '\\b[^>]*>([\\s\\S]*?)<\\/' + tag + '>', 'i');
    const m = re.exec(String(html || ''));
    return m ? semTags(m[1]) : '';
  }

  // O MAIOR `<pre>` da página. Ver a armadilha 2: uma página pode ter vários, e
  // o da folha é o mais longo por uma margem enorme. Devolve '' se não houver.
  function maiorPre(html) {
    const re = /<pre\b[^>]*>([\s\S]*?)<\/pre>/gi;
    let melhor = '';
    let m = re.exec(String(html || ''));
    while (m) {
      if (m[1].length > melhor.length) melhor = m[1];
      m = re.exec(String(html || ''));
    }
    return melhor;
  }

  // O tom declarado na página, ou ''. Tolerante de propósito: procura a palavra
  // "tom" seguida do acorde em qualquer marcação intermediária. Ele é INFORMAÇÃO
  // (o cabeçalho da aba), nunca entrada de cálculo — a transposição opera sobre
  // os acordes da folha, então um tom não lido não quebra nada.
  function lerTom(html) {
    const m = /tom\s*:?\s*(?:<[^>]*>\s*)*([A-G][#b]?m?)\b/i.exec(String(html || ''));
    return m ? m[1] : '';
  }

  // ===== acordes =====

  const SUSTENIDOS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const BEMOIS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

  // A gramática de um acorde, e ela é ESTREITA de propósito.
  //
  // A tentação é aceitar "letra maiúscula seguida de qualquer coisa" — e aí
  // "Deus", "Cristo" e "Amor" viram acordes, e uma linha de letra inteira é
  // classificada como linha de acordes: a letra some da aba, sem erro nenhum.
  // Por isso o sufixo é uma LISTA, não um curinga.
  // A gramática, em TRÊS pedaços: raiz · extensão · baixo.
  //
  // ===== O QUE ESTAVA ERRADO, e por que era mudo (v1.1.14) =====
  //
  // A versão anterior enumerava o sufixo como uma LISTA de palavras minúsculas
  // que exigiam dígitos depois (`(?:sus|add|maj|m|b|#)\d+`). `7M` — a notação
  // brasileira de sétima maior, e a mais comum num hinário — é dígito seguido
  // de **M maiúsculo**: não casava com nada. E como [transporAcorde] começava
  // por `if (!pareceAcorde(token)) return token`, o acorde reprovado voltava
  // **intacto**: numa folha transposta, `D7M/A` e `G7M` ficavam parados no tom
  // ORIGINAL enquanto tudo em volta andava. Dissonância na frente de quem toca,
  // sem erro no console e sem nada na tela que a explicasse.
  //
  // A lição não é "faltava `7M` na lista": é que **enumerar sufixo não escala**.
  // Cada notação que faltar reaparece como o mesmo defeito mudo — e ainda
  // faltavam `Maj7`, `5+`, `7-`, `M7`. Por isso a extensão passou a ser
  // limitada por CARACTERES, não por palavras: vale qualquer sequência feita
  // do alfabeto que as extensões usam.
  //
  // ===== E ISSO NÃO É UM CURINGA =====
  //
  // O perigo original continua de pé e a defesa contra ele também: aceitar
  // "maiúscula seguida de qualquer coisa" faria uma linha de LETRA ser
  // classificada como acordes e **sumir da aba**. As letras permitidas na
  // extensão são exatamente as de `maj min dim aug sus add M m b #` — e nenhuma
  // palavra portuguesa passa por elas: "Deus" tem `e`, "Amor" tem `o` e `r`,
  // "Cristo" tem `r`, "Glória" tem `l`. O oráculo cobra os dois lados.
  //
  // A extensão é uma sequência de PEÇAS conhecidas, não um conjunto de
  // caracteres soltos — e a diferença não é acadêmica. Com o alfabeto solto
  // (`[0-9mMajsudingº°…]`), "Cada" virava acorde: `C` + `ada`, porque `a` e `d`
  // estavam lá para servir a `add` e a `dim`. Exigindo que a extensão se
  // decomponha em peças INTEIRAS, `ada` não é `add` nem `a`, e a palavra
  // reprova — junto com "Da", "Ai", "Adora" e "Canta".
  //
  // O que o defeito da v1.1.13 ensinou não foi "não use lista": foi que a lista
  // precisa (a) ter as peças que a notação brasileira usa, `M` inclusive, e
  // (b) NÃO exigir dígito depois de cada uma — era essa exigência que fazia
  // `7M` reprovar. As peças longas vêm antes das curtas na alternância, senão
  // `m` consumiria o começo de `maj` e sobraria `aj`.
  const RAIZ = '[A-G][#b]?';
  const PECA = '(?:maj|min|dim|aug|sus|add|M|m|º|°|\\+|-|#|b|\\d|\\([^)]{0,12}\\))';
  const EXTENSAO = PECA + '*';
  const ACORDE = new RegExp(
    '^(' + RAIZ + ')'                   // fundamental
    + '(' + EXTENSAO + ')'              // 7M, m7, sus4, add9, (b5), 5+, maj7…
    + '(?:\\/(' + RAIZ + '))?$',        // baixo invertido
  );

  // "Isto parece um acorde?" — a REDE, não a fonte de verdade.
  //
  // A fonte é a marcação (`<b>`); esta função só existe para o dia em que o
  // site parar de marcar. **O preço está declarado:** a palavra portuguesa "A"
  // é também um acorde, então uma linha de letra composta só dela seria lida
  // como linha de acordes. Não há como distinguir sem contexto, e o caso é raro
  // o bastante para o preço ser menor que o de não ter rede nenhuma.
  function pareceAcorde(token) {
    return ACORDE.test(token);
  }

  function indiceDaNota(nota) {
    const i = SUSTENIDOS.indexOf(nota);
    return i >= 0 ? i : BEMOIS.indexOf(nota);
  }

  // Transpõe UM acorde. O sufixo viaja intacto — só a fundamental (e o baixo
  // depois da barra) mudam.
  //
  // A GRAFIA SEGUE A ORIGEM: uma folha escrita em bemóis continua em bemóis. É
  // musicalmente correto (a armadura não muda por transpor) e, mais prático que
  // isso, é o que faz a folha continuar parecendo a mesma folha para quem já a
  // conhece.
  function transporAcorde(token, semitons) {
    const m = ACORDE.exec(token);
    if (!m) return token;
    const [, raiz, extensao, baixo] = m;
    // A GRAFIA SEGUE A RAIZ, não o token inteiro. Perguntar `token.indexOf('b')`
    // fazia o bemol de uma ALTERAÇÃO decidir a grafia da fundamental: `C7(b9)`
    // subindo meio tom saía `Db7(b9)` em vez de `C#7(b9)` — o `b` do `(b9)` não
    // diz nada sobre como a raiz é escrita.
    const bemol = raiz[1] === 'b' || (baixo && baixo[1] === 'b');
    const escala = bemol ? BEMOIS : SUSTENIDOS;
    const mover = (nota) => {
      const i = indiceDaNota(nota);
      return i < 0 ? nota : escala[(((i + semitons) % 12) + 12) % 12];
    };
    // SÓ raiz e baixo andam. A extensão viaja verbatim — antes um `replace`
    // global de `[A-G]` varria o token inteiro e podia mexer numa letra dentro
    // da extensão; transpor pelos PEDAÇOS que a gramática já separou torna
    // isso impossível por construção, em vez de improvável.
    return mover(raiz) + extensao + (baixo ? '/' + mover(baixo) : '');
  }

  // Transpõe uma LINHA de acordes PRESERVANDO AS COLUNAS.
  //
  // Este é o ponto que separa uma transposição útil de uma inútil: o acorde
  // vale pela coluna em que está — ele diz em que SÍLABA a harmonia troca. Um
  // "C" que vira "C#" ganha um caractere, e um `replace` ingênuo empurra todos
  // os acordes seguintes da linha uma coluna para a direita. Depois de três
  // trocas a folha inteira está fora de sincronia com a letra logo abaixo, e o
  // resultado é pior que não ter transposição: ele PARECE certo.
  //
  // Cada token é reposto na coluna em que começava. Quando o token anterior
  // ficou mais longo e invadiu essa coluna, entra UM espaço — perder a coluna
  // exata de um acorde é ruim; colar dois acordes num só é ilegível.
  function transporLinha(texto, semitons) {
    const linha = String(texto == null ? '' : texto);
    if (!semitons) return linha;
    let saida = '';
    const re = /\S+/g;
    let m = re.exec(linha);
    while (m) {
      const alvo = m.index;
      if (saida.length < alvo) saida += ' '.repeat(alvo - saida.length);
      else if (saida.length > 0) saida += ' ';
      saida += transporAcorde(m[0], semitons);
      m = re.exec(linha);
    }
    return saida;
  }

  // O tom do cabeçalho acompanha a transposição — senão a aba mostra um tom que
  // não é mais o da folha que está logo abaixo dele, que é a única coisa pior
  // que não mostrar tom nenhum.
  function transporTom(tom, semitons) {
    if (!tom || !semitons) return tom || '';
    return transporAcorde(tom, semitons);
  }

  // ===== a folha =====

  // Sentinelas para marcar o que veio dentro de `<b>`. Caracteres do bloco
  // "Private Use Area": impossíveis numa letra de música, e por isso seguros
  // como marca temporária dentro do texto do usuário.
  // ESCRITOS COMO ESCAPE, e não como o caractere literal: invisíveis num
  // diff, eles seriam apagados por um editor distraído sem ninguém ver — e o
  // que quebra é a classificação inteira das linhas, em silêncio.
  const ABRE = '\ue000';
  const FECHA = '\ue001';

  /**
   * A folha de cifra, em linhas — `[{ tipo, texto }]`, com `tipo` em
   * `'acordes' | 'letra' | 'vazio'`.
   *
   * A classificação é por MARCAÇÃO primeiro (o que veio em `<b>`) e por FORMATO
   * só em seguida (ver [pareceAcorde]): uma linha é de acordes quando tudo o
   * que ela tem de não-branco é acorde.
   */
  function lerFolha(preHtml) {
    const bruto = String(preHtml || '')
      // O `<b>` vira sentinela ANTES de as tags caírem — é a única informação
      // desta página que não sobrevive ao `semTags`.
      .replace(/<b\b[^>]*>([\s\S]*?)<\/b>/gi, (todo, dentro) => ABRE + dentro + FECHA)
      .replace(/<br\s*\/?>/gi, '\n')     // armadilha 4
      .replace(/<[^>]*>/g, '');
    const texto = decodificar(bruto).replace(/\r\n?/g, '\n');

    return texto.split('\n').map((linhaCrua) => {
      const marcados = [];
      const linha = linhaCrua.replace(
        new RegExp(ABRE + '([\\s\\S]*?)' + FECHA, 'g'),
        (todo, dentro) => { marcados.push(dentro); return dentro; },
      );
      const nu = linha.replace(/\s+/g, '');
      if (!nu) return { tipo: 'vazio', texto: '' };

      // MARCADA: sobrou algo fora dos `<b>`? Então é linha mista (acorde
      // inline no meio da letra), e ela é LETRA — reclassificá-la como acordes
      // apagaria a letra que ela carrega.
      if (marcados.length) {
        const foraDosMarcados = marcados
          .reduce((acc, m) => acc.replace(m, ''), linha)
          .replace(/\s+/g, '');
        return { tipo: foraDosMarcados ? 'letra' : 'acordes', texto: linha.replace(/\s+$/, '') };
      }

      // SEM MARCAÇÃO: a rede. Todos os tokens são acordes?
      const tokens = linha.trim().split(/\s+/);
      const soAcordes = tokens.every(pareceAcorde);
      return { tipo: soAcordes ? 'acordes' : 'letra', texto: linha.replace(/\s+$/, '') };
    });
  }

  /**
   * A PÁGINA inteira — `{ titulo, artista, tom, linhas }` — ou `null`.
   *
   * `null` significa **"respondeu e eu não entendi"**, e é diferente de uma
   * folha vazia de propósito (ver a REGRA DE OURO no topo): quem chama tem de
   * dizer frases diferentes, senão uma mudança de marcação do site fica
   * indistinguível de uma música que não existe lá.
   */
  function lerPagina(html) {
    const pre = maiorPre(html);
    if (!pre) return null;
    const linhas = lerFolha(pre);
    // Uma folha só de linhas vazias é um `<pre>` que não era a folha.
    if (!linhas.some((l) => l.tipo !== 'vazio')) return null;
    return {
      titulo: primeiroTexto(html, 'h1'),
      artista: primeiroTexto(html, 'h2'),
      tom: lerTom(html),
      linhas,
    };
  }

  /**
   * SÓ A LETRA — as linhas de acordes caem fora.
   *
   * A aba mostra a folha; esta função existe para o operador que quer a letra
   * limpa da mesma requisição, sem uma segunda ida à rede. Linhas vazias
   * seguidas colapsam numa só: sem os acordes, o que sobrava era o dobro de
   * respiro entre as estrofes.
   */
  function somenteLetra(linhas) {
    const saida = [];
    (linhas || []).forEach((l) => {
      if (l.tipo === 'acordes') return;
      const t = l.tipo === 'vazio' ? '' : String(l.texto || '').trim();
      if (!t && !saida.length) return;
      if (!t && !saida[saida.length - 1]) return;
      saida.push(t);
    });
    while (saida.length && !saida[saida.length - 1]) saida.pop();
    return saida;
  }

  /**
   * Os RESULTADOS de uma busca — `[{ nome, artista, url }]`.
   *
   * Um resultado é um link de DOIS segmentos (`/artista/musica/`), que é a
   * forma de um endereço de música no site. O filtro por número de segmentos é
   * o que separa a música da navegação do site (categorias, listas, páginas
   * institucionais) sem depender de classe CSS nenhuma.
   */
  // ===== A BUSCA: PARENTESCO, NÃO POSIÇÃO (v1.1.21) =====
  //
  // A v1.1.10 pegava o PRIMEIRO link de dois segmentos da página de resultados,
  // e isso está errado por duas razões independentes:
  //
  //  1. **A navegação do site também é link de dois segmentos.** MEDIDO num
  //     aparelho: uma busca por "Em Oração" devolveu 27 resultados e o escolhido
  //     foi `/letra/A/` — o ÍNDICE ALFABÉTICO do site, que mora no cabeçalho e
  //     por isso aparece ANTES de qualquer resultado no HTML.
  //  2. **A posição no documento não é a posição no ranking.** Cabeçalho,
  //     rodapé, "mais acessadas" e blocos de sugestão vêm todos no mesmo HTML.
  //
  // A correção NÃO é uma lista de rotas do site, que muda quando o dono dele
  // quiser: é **exigir parentesco com o que se procurou**. Um resultado cujo
  // texto não tem relação nenhuma com o nome da música não é o resultado certo,
  // e nunca vai ser — mesmo que seja o primeiro. A lista de seções existe só
  // como primeiro corte barato; quem decide é o [parentesco].
  //
  // **O preço, dito:** um hino cujo nome no acervo não compartilhe NENHUMA
  // palavra com o nome no site é recusado, e cai no "não achei". É o caso que a
  // busca genérica existia para cobrir, e continua coberto pelo grau mais frouxo
  // (uma palavra em comum). Abaixo disso, "achei alguma coisa" e "achei a música"
  // são coisas diferentes, e este projeto não troca a segunda pela primeira.

  /** Seções conhecidas do site: primeiro corte, barato e sem pretensão. */
  const SECOES = new Set([
    'letra', 'letras', 'busca', 'buscar', 'tags', 'tag', 'estilos', 'estilo',
    'artistas', 'musicas', 'cifras', 'top', 'mais-acessadas', 'novidades',
    'videoaulas', 'aprenda', 'academy', 'blog', 'app', 'premium', 'pro',
    'assinatura', 'login', 'cadastro', 'favoritos', 'sobre', 'contato',
    'termos', 'privacidade', 'n', 'pt', 'en', 'es',
  ]);

  /**
   * Palavras que não distinguem nada. O corte de 4 caracteres já derruba quase
   * todas as preposições do português; aqui ficam as que passam por ele.
   */
  const VAZIAS = new Set([
    'para', 'como', 'sobre', 'todo', 'toda', 'todos', 'todas', 'mais', 'menos',
    'pelo', 'pela', 'pelos', 'pelas', 'esta', 'este', 'isso', 'aquilo',
    'nossa', 'nosso', 'nossas', 'nossos', 'seus', 'suas', 'meus', 'minha',
    'minhas', 'quando', 'porque', 'entre', 'ainda', 'mesmo',
  ]);

  /** As palavras que de fato identificam um título. */
  function palavrasFortes(s) {
    return normalizar(semNumero(s)).toLowerCase()
      .replace(/[^a-z0-9à-ÿ ]+/g, ' ')
      .split(' ')
      .filter((p) => p.length >= 4 && !VAZIAS.has(p));
  }

  /** O texto reduzido ao que se pode comparar: sem número, sem pontuação. */
  function chaveDeTitulo(s) {
    return normalizar(semNumero(s)).toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  /**
   * O quanto um resultado se PARECE com o que se procurou: 3 = o mesmo título,
   * 2 = um contém o outro, 1 = pelo menos uma palavra forte em comum, 0 = nada.
   *
   * **Zero é recusa, não último lugar.** É o zero que derruba o `/letra/A/` e
   * todo bloco de sugestão da página; sem ele, uma lista sem nenhum resultado
   * bom devolve o primeiro item da navegação com toda a confiança.
   */
  function parentesco(titulo, alvo) {
    const a = chaveDeTitulo(titulo);
    const b = chaveDeTitulo(alvo);
    if (!a || !b) return 0;
    if (a === b) return 3;
    // A CONTENÇÃO EXIGE CORPO. Sem o piso, `'emoracao'.includes('a')` casa — e o
    // grau 2 devolve justamente o `/letra/A/` que esta função existe para
    // recusar. Um título de uma ou duas letras está contido em quase tudo; ele
    // só pode ser parente por IGUALDADE, que é o grau acima.
    if (Math.min(a.length, b.length) >= 4 && (a.includes(b) || b.includes(a))) return 2;
    const fortes = new Set(palavrasFortes(alvo));
    return palavrasFortes(titulo).some((p) => fortes.has(p)) ? 1 : 0;
  }

  /**
   * Ordena os achados por parentesco com `nome`, com o `artista` (o nome do
   * álbum, do lado de cá) como DESEMPATE — nunca como filtro.
   *
   * O álbum do acervo não é o artista do site: "Em Oração" está no álbum
   * "Missão", e quem gravou pode ser qualquer um. Um sinal que só soma é
   * seguro; um que filtra derrubaria a música certa toda vez que os dois não
   * coincidissem, que é o caso normal.
   *
   * A ordem do documento decide os empates (`i`), e não há ordenação instável:
   * `sort` do JS é estável desde o ES2019, mas depender disso num arranjo que
   * outra pessoa vai reordenar é apostar num detalhe.
   */
  function ordenarBusca(achados, nome, artista) {
    // Um resultado sob um dos [ARTISTAS_PADRAO] é, por definição, de um CD
    // oficial — o mesmo desempate do álbum, por outro caminho e sem depender de
    // o nome do álbum do acervo bater com nada.
    const doPadrao = (r) => (ARTISTAS_PADRAO.includes(slug(r.artista)) ? 1 : 0);
    return (Array.isArray(achados) ? achados : [])
      .map((r, i) => ({
        r,
        i,
        p: parentesco(r.nome, nome),
        a: (artista ? parentesco(r.artista, artista) : 0) + doPadrao(r),
      }))
      .filter((x) => x.p > 0)
      .sort((x, y) => (y.p - x.p) || (y.a - x.a) || (x.i - y.i))
      .map((x) => x.r);
  }

  /**
   * O caminho `/artista/musica/` é de uma MÚSICA?
   *
   * Estrutura primeiro, lista de seções depois: um slug de uma letra
   * (`/letra/A/`) ou de duas não nomeia música nenhuma, e essa regra vale para
   * qualquer site. A [SECOES] cobre o que passa pela estrutura e ainda assim é
   * navegação — e ela é o corte BARATO, não a defesa: quem defende é o
   * [parentesco], porque uma lista de rotas de terceiro envelhece sozinha.
   */
  function ehCaminhoDeMusica(partes) {
    if (partes.length !== 2) return false;
    const [a, b] = partes;
    if (SECOES.has(a.toLowerCase()) || SECOES.has(b.toLowerCase())) return false;
    return a.length >= 2 && b.length >= 3;
  }

  function lerBusca(html) {
    const vistos = new Set();
    const saida = [];
    const re = /<a\b[^>]*href="(\/[^"#?]+\/)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m = re.exec(String(html || ''));
    while (m) {
      const caminho = m[1];
      const partes = caminho.split('/').filter(Boolean);
      const nome = semTags(m[2]);
      if (ehCaminhoDeMusica(partes) && nome.length >= 2 && !vistos.has(caminho)) {
        vistos.add(caminho);
        saida.push({ nome, artista: partes[0].replace(/-/g, ' '), url: BASE.replace(/\/$/, '') + caminho });
      }
      m = re.exec(String(html || ''));
    }
    return saida;
  }

  // ===== A QUEBRA DE LINHA DO PAR (v1.1.19) =====
  //
  // O acorde vale por estar SOBRE a sílaba em que a harmonia troca. Isso torna
  // acorde e letra **uma unidade**, e é por isso que a quebra não pode ser
  // delegada ao navegador.
  //
  // A v1.1.13 usava `white-space: pre-wrap` e o preço estava declarado — mas
  // medido no aparelho ele é inaceitável: o CSS quebra cada linha
  // INDEPENDENTEMENTE, então uma folha larga sai assim
  //
  //     acordes (1ª metade)
  //     acordes (2ª metade)
  //     letra   (1ª metade)
  //     letra   (2ª metade)
  //
  // e a segunda metade dos acordes fica a DUAS linhas de distância da sílaba a
  // que pertence. Não é alinhamento imperfeito: é o par desfeito.
  //
  // Aqui a quebra é NOSSA, e o corte é o MESMO índice nas duas linhas — o que
  // preserva o alinhamento por construção, porque as duas fatias saem da mesma
  // coluna. A saída intercala `acordes` e `letra`, então cada metade continua
  // grudada na sua.
  //
  // `colunas` é INJETADO por quem chama (o `controle.js` mede a fonte
  // renderizada): este módulo é PURO e não pode olhar o DOM — e é isso que
  // torna a regra exercitável no oráculo, que é o que ela mais precisa.

  // O corte parte um token? (um acorde, ou uma palavra da letra)
  function cortaToken(s, c) {
    return c > 0 && c < s.length && s[c] !== ' ' && s[c - 1] !== ' ';
  }

  // O maior corte até `W` que não parte um acorde NEM uma palavra.
  //
  // Desce a partir do limite porque o objetivo é aproveitar a largura; o piso
  // (`MIN`) impede que uma linha sem espaço nenhum produza fatias absurdamente
  // curtas — e, no pior caso, corta em `W` mesmo: uma quebra feia é melhor que
  // um laço que não termina.
  function pontoDeQuebra(A, L, W) {
    const MIN = Math.max(4, Math.floor(W * 0.35));
    for (let c = W; c >= MIN; c--) {
      if (!cortaToken(A, c) && !cortaToken(L, c)) return c;
    }
    return W;
  }

  // O recuo de uma fatia; uma fatia em branco não tem opinião sobre margem, e
  // por isso devolve Infinity — quem manda é a outra.
  function recuoDe(s) {
    return s.trim() ? s.length - s.replace(/^ +/, '').length : Infinity;
  }

  const semRabo = (s) => s.replace(/ +$/, '');

  function fatiar(A, L, W, temA, temL, saida) {
    let a = A;
    let l = L;
    for (;;) {
      if (Math.max(semRabo(a).length, semRabo(l).length) <= W) {
        if (temA) saida.push({ tipo: 'acordes', texto: semRabo(a) });
        if (temL) saida.push({ tipo: 'letra', texto: semRabo(l) });
        return;
      }
      const c = pontoDeQuebra(a, l, W);
      if (temA) saida.push({ tipo: 'acordes', texto: semRabo(a.slice(0, c)) });
      if (temL) saida.push({ tipo: 'letra', texto: semRabo(l.slice(0, c)) });
      const ra = a.slice(c);
      const rl = l.slice(c);
      // O MESMO recuo sai das duas — tirar recuos diferentes desalinharia
      // justamente o que este código existe para manter junto.
      let k = Math.min(recuoDe(ra), recuoDe(rl));
      if (!Number.isFinite(k)) k = 0;
      a = ra.slice(k);
      l = rl.slice(k);
      if (!a.trim() && !l.trim()) return;
    }
  }

  /**
   * Reescreve a folha para caber em `colunas`, quebrando ACORDE e LETRA no
   * mesmo ponto. Devolve a mesma forma de [lerFolha].
   *
   * `colunas` inútil (0, negativo, NaN) devolve a folha INTACTA: sem medida
   * confiável, não quebrar é melhor que quebrar no lugar errado — o pior
   * desfecho aqui é uma rolagem lateral, e o outro é a folha mentindo.
   */
  function quebrarPares(linhas, colunas) {
    const W = Math.floor(Number(colunas) || 0);
    const src = Array.isArray(linhas) ? linhas : [];
    if (!(W >= 8)) return src.slice();
    const saida = [];
    for (let i = 0; i < src.length; i++) {
      const linha = src[i];
      if (!linha || linha.tipo === 'vazio') { saida.push({ tipo: 'vazio', texto: '' }); continue; }
      // O PAR é uma linha de acordes seguida de uma de letra. Linha solta
      // (acordes sem letra abaixo, ou letra sem acordes acima) quebra sozinha,
      // pelo mesmo caminho — com a outra metade vazia.
      const ehPar = linha.tipo === 'acordes' && src[i + 1] && src[i + 1].tipo === 'letra';
      const A = linha.tipo === 'acordes' ? String(linha.texto || '') : '';
      const L = ehPar ? String(src[i + 1].texto || '')
        : (linha.tipo === 'letra' ? String(linha.texto || '') : '');
      if (ehPar) i++;
      fatiar(A, L, W, linha.tipo === 'acordes', ehPar || linha.tipo === 'letra', saida);
    }
    return saida;
  }


  // ===== A JANELA DA ROLAGEM AUTOMÁTICA (v1.1.20) =====
  //
  // A folha de cifra rola no tempo da MÚSICA, não num cronômetro nosso: a mesma
  // folha serve a um hino de 2 min e a um de 6, e quem decide o ritmo da leitura
  // é a gravação. O que mora aqui é a FUNÇÃO que traduz "onde a música está" em
  // "onde a folha deve estar" — pura, injetável, exercitável.
  //
  // Ela não é a reta ingênua `f = t / duração`. Tem uma ABERTURA e um FECHO:
  //
  //  - **ABERTURA**: o começo fica parado alguns segundos. Quem chega numa
  //    música quer VER o início — introdução, tom, primeira estrofe — antes de
  //    a folha começar a fugir dele.
  //  - **FECHO**: a folha chega ao fim BEM ANTES de a música acabar. O final é
  //    a parte que mais se erra e a que mais precisa ser lida com antecedência;
  //    uma folha que mostra o último acorde depois de ele passar não serve para
  //    nada.
  //
  // Os dois são FRAÇÃO da música com piso e teto em SEGUNDOS, e é a combinação
  // que os torna certos nos dois extremos: fração pura daria dois segundos de
  // abertura num hino curto (não dá tempo de ler nada) e meio minuto num longo
  // (a folha parada com a primeira estrofe já cantada).
  const ABERTURA = { frac: 0.08, min: 4, max: 12 };
  const FECHO = { frac: 0.12, min: 8, max: 25 };

  /**
   * `[t0, t1]` em segundos: o trecho da música em que a folha de fato desce.
   *
   * Música curta demais para caber abertura e fecho devolve a música INTEIRA.
   * Uma janela invertida — ou de meio segundo — faria a folha saltar do topo ao
   * fim num quadro só, que é pior que não ter abertura nenhuma. **O piso é um
   * segundo, não zero:** com zero a divisão da fração é 0/0.
   */
  function janelaDeRolagem(dur) {
    const d = Number(dur) || 0;
    if (!(d > 0)) return { t0: 0, t1: 0 };
    const trava = (r) => Math.min(r.max, Math.max(r.min, d * r.frac));
    const t0 = trava(ABERTURA);
    const t1 = d - trava(FECHO);
    if (!(t1 - t0 >= 1)) return { t0: 0, t1: d };
    return { t0, t1 };
  }

  /**
   * Onde a folha deve estar, de 0 (topo) a 1 (fim), para a música em `t`.
   *
   * Sempre dentro de `[0, 1]`: `t` chega de um relógio que pode passar da
   * duração por um quadro (ou vir negativo num seek em curso), e uma fração
   * fora da faixa viraria um `scrollTop` fora da folha.
   */
  function fracaoDaRolagem(t, dur) {
    const { t0, t1 } = janelaDeRolagem(dur);
    if (!(t1 > t0)) return 0;
    const x = Math.min(Number(dur) || 0, Math.max(0, Number(t) || 0));
    return Math.min(1, Math.max(0, (x - t0) / (t1 - t0)));
  }


  // ===== A RADIOGRAFIA: o que a PÁGINA parecia (v1.1.24) =====
  //
  // Este parser lê a marcação de um servidor que não é nosso e que não nos deve
  // compatibilidade nenhuma. Quando ele quebra, o Registro diz `ilegivel` — e
  // `ilegivel` responde "não entendi", não "o que era". A distância entre as
  // duas é uma sessão inteira de adivinhação a distância.
  //
  // [radiografia] devolve a ESTRUTURA da página: quantos `<pre>`, de que
  // tamanho, quantos `<b>` dentro do maior, quantos links de música, e uma
  // amostra curta dos endereços. Com isso, um Registro colado numa conversa
  // responde "o site mudou o quê?" sem ninguém precisar abrir a página.
  //
  // **O QUE ELA NÃO LEVA: o CONTEÚDO.** Nem letra, nem acordes, nem parágrafo
  // nenhum da página. Isso não é economia de bytes — é o contrato do recurso: o
  // app LÊ conteúdo de terceiro no aparelho do operador e não o distribui. Um
  // Registro é feito para ser copiado e mandado para fora; o que sai daqui é
  // FORMA (contagens, tamanhos, endereços), e endereço é ponteiro, não cópia.
  // Os textos de link entram porque são o que identifica um resultado de busca,
  // e vão truncados.
  const RADIO_AMOSTRA = 8;      // endereços na amostra
  const RADIO_TEXTO = 46;       // caracteres por texto de link

  function radiografia(html) {
    const s = String(html || '');
    const pres = [];
    const rePre = /<pre\b[^>]*>([\s\S]*?)<\/pre>/gi;
    for (let m; (m = rePre.exec(s));) pres.push(m[1].length);
    const maior = maiorPre(s) || '';
    const links = [];
    const re = /<a\b[^>]*href="(\/[^"#?]+\/)"[^>]*>([\s\S]*?)<\/a>/gi;
    const vistos = new Set();
    for (let m; (m = re.exec(s));) {
      if (vistos.has(m[1])) continue;
      vistos.add(m[1]);
      links.push({ caminho: m[1], texto: semTags(m[2]).slice(0, RADIO_TEXTO) });
    }
    const deMusica = links.filter((l) => ehCaminhoDeMusica(l.caminho.split('/').filter(Boolean)));
    return {
      bytes: s.length,
      titulo: primeiroTexto(s, 'title').slice(0, RADIO_TEXTO * 2),
      h1: primeiroTexto(s, 'h1').slice(0, RADIO_TEXTO),
      h2: primeiroTexto(s, 'h2').slice(0, RADIO_TEXTO),
      tom: lerTom(s),
      pres: pres.length,
      maiorPre: maior.length,
      bNoMaiorPre: (maior.match(/<b\b/gi) || []).length,
      links: links.length,
      linksDeMusica: deMusica.length,
      // A AMOSTRA MOSTRA O QUE PASSOU — e, quando NADA passou, o que havia
      // (v1.1.29). O ponto cego da primeira versão: ela amostrava só
      // `deMusica`, então o Registro ficava mudo exatamente no caso em que a
      // pergunta é "por que zero?". MEDIDO num aparelho: "38 link(s) de 2
      // segmentos, 0 com forma de música" e nenhuma pista de quais eram os 38.
      amostra: (deMusica.length ? deMusica : links).slice(0, RADIO_AMOSTRA),
      amostraEhCrua: deMusica.length === 0 && links.length > 0,
    };
  }

  global.AVCifra = {
    CATALOGO, BASE,
    OK, MOTIVO_SEM_REDE, MOTIVO_NAO_TEM, MOTIVO_RECUSOU, MOTIVO_ILEGIVEL,
    normalizar, semNumero, slug, decodificar,
    urlDoHino, urlDaMusica, urlDeBusca,
    ARTISTAS_PADRAO, urlsPadrao,
    pareceAcorde, transporAcorde, transporLinha, transporTom,
    lerFolha, lerPagina, lerBusca, somenteLetra,
    ordenarBusca, parentesco, ehCaminhoDeMusica, radiografia,
    quebrarPares, pontoDeQuebra,
    janelaDeRolagem, fracaoDaRolagem,
  };
})(this);
