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

  // A BUSCA GENÉRICA — o "qualquer música". Sem catálogo e sem palpite de
  // slug: quem procura é o site.
  function urlDeBusca(termo) {
    const t = String(termo == null ? '' : termo).trim();
    if (!t) return '';
    return BASE + '?q=' + encodeURIComponent(t);
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
  const ACORDE = new RegExp(
    '^[A-G][#b]?'                       // fundamental
    + '(?:m|maj|min|dim|aug|sus|add|º|°|\\+)?'  // qualidade
    + '(?:\\d+)?'                       // 7, 9, 11, 13
    + '(?:(?:sus|add|maj|m|b|#)\\d+)*'  // sus4, add9, 7M, b5, #11 encadeados
    + '(?:\\((?:[^)]{0,12})\\))?'       // (b5), (9), (#11)
    + '(?:\\/[A-G][#b]?)?$',            // baixo invertido
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
    if (!pareceAcorde(token)) return token;
    const bemol = token.indexOf('b') > 0;
    const escala = bemol ? BEMOIS : SUSTENIDOS;
    return token.replace(/([A-G][#b]?)/g, (nota) => {
      const i = indiceDaNota(nota);
      if (i < 0) return nota;
      return escala[(((i + semitons) % 12) + 12) % 12];
    });
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
  function lerBusca(html) {
    const vistos = new Set();
    const saida = [];
    const re = /<a\b[^>]*href="(\/[^"#?]+\/)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m = re.exec(String(html || ''));
    while (m) {
      const caminho = m[1];
      const partes = caminho.split('/').filter(Boolean);
      const nome = semTags(m[2]);
      if (partes.length === 2 && nome && !vistos.has(caminho)) {
        vistos.add(caminho);
        saida.push({ nome, artista: partes[0].replace(/-/g, ' '), url: BASE.replace(/\/$/, '') + caminho });
      }
      m = re.exec(String(html || ''));
    }
    return saida;
  }

  global.AVCifra = {
    CATALOGO, BASE,
    OK, MOTIVO_SEM_REDE, MOTIVO_NAO_TEM, MOTIVO_RECUSOU, MOTIVO_ILEGIVEL,
    normalizar, semNumero, slug, decodificar,
    urlDoHino, urlDaMusica, urlDeBusca,
    pareceAcorde, transporAcorde, transporLinha, transporTom,
    lerFolha, lerPagina, lerBusca, somenteLetra,
  };
})(this);
