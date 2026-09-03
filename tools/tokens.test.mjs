// O ORÁCULO DOS TOKENS — `var(--x)` que aponta para um token que não existe.
//
// ## Por que ele existe
//
// Um `var(--nao-existe)` SEM fallback não é um erro em lugar nenhum: a
// declaração inteira computa para o valor INICIAL da propriedade. Não há aviso
// no console, o CSS carrega, a página monta, e o que se vê é um botão com
// `border-radius: 0` no meio de um app inteiro arredondado — ou uma cor que
// virou preto, ou um `gap` que sumiu.
//
// Foi exatamente isso na v5.171: `.cast-choice` (os DOIS botões principais da
// folha "Conectar uma tela") pedia `var(--radius-md)`, um token que nunca
// existiu nesta base. Os dois únicos cantos retos do aplicativo estavam
// justamente na primeira tela do recurso mais novo, e nenhuma ferramenta
// reclamou — foi preciso um par de olhos no aparelho.
//
// É a mesma família do `setInteger` numa chave `long` do `MediaFormat`, do
// `bytes` esquecido no `bgProgress` e do `slideLabel` no `nowPlaying`: falha sem
// exceção, sem log, e sem sintoma no lugar da causa. E a resposta deste
// repositório a essa família é sempre a mesma — um oráculo que a trava.
//
// ## O que ele NÃO reprova
//
// `var(--x, fallback)` COM fallback é um idioma legítimo e muito usado aqui: é
// como o JS entrega valores em tempo de execução (`--vol`, `--ch`, `--tab-w`,
// `--pv-ar`…), e o fallback é o valor de repouso. Reprovar isso quebraria meia
// dúzia de componentes que funcionam.
//
//   node tools/tokens.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');

// Toda folha da base — inclusive a do cliente do espelho, que é servida na rede
// e nunca é aberta por ninguém com um console à mão.
function folhas(dir) {
  const out = [];
  for (const nome of fs.readdirSync(dir)) {
    const p = path.join(dir, nome);
    if (fs.statSync(p).isDirectory()) {
      if (nome === 'vendor') continue;          // código buildado de terceiro
      out.push(...folhas(p));
    } else if (nome.endsWith('.css')) out.push(p);
  }
  return out;
}

// COMENTÁRIO NÃO É DECLARAÇÃO, e também não é uso. Este arquivo documenta a si
// mesmo com fartura — o cabeçalho de `tokens.css` cita `var(--x)` para explicar
// a própria regra —, e sem tirar os comentários o oráculo reprova a prosa que
// existe para justificá-lo. Tirar é estritamente correto nos DOIS sentidos: um
// `--token: valor` dentro de um comentário não define nada, e um `var(--token)`
// dentro de um comentário não pinta nada.
const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

const arquivos = folhas(RAIZ);
const falhas = [];
function checar(cond, msg, detalhe) {
  if (cond) console.log('ok      ' + msg);
  else { console.log('FALHOU  ' + msg + (detalhe ? '\n        ' + detalhe : '')); falhas.push(msg); }
}

checar(arquivos.length > 0, 'a base web tem folhas de estilo para varrer', String(arquivos.length));

// TODAS as definições, de TODAS as folhas: `tokens.css` é a fonte única da
// paleta, mas cada app define os próprios tokens de layout no `:root`.
const definidos = new Set();
const fonte = new Map();   // caminho → conteúdo já sem comentários
for (const f of arquivos) {
  const s = semComentarios(fs.readFileSync(f, 'utf8'));
  fonte.set(f, s);
  for (const m of s.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) definidos.add(m[1]);
}
checar(definidos.has('--accent') && definidos.has('--radius-btn'),
  'e a varredura enxerga os tokens de verdade (a paleta e a escala de raio)',
  definidos.size + ' tokens');

// E TODO uso sem fallback tem de casar com uma definição.
const orfaos = [];
for (const f of arquivos) {
  const s = fonte.get(f);
  for (const m of s.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)\s*\)/g)) {
    if (definidos.has(m[1])) continue;
    orfaos.push(path.relative(RAIZ, f) + ':' + (s.slice(0, m.index).split('\n').length) + ' → ' + m[1]);
  }
}
checar(orfaos.length === 0,
  'nenhum `var(--x)` sem fallback aponta para um token inexistente',
  orfaos.join('\n        '));

// ---------- O TEMA CLARO SÓ SOBRESCREVE (v5.192) ----------
// O bloco `:root[data-tema="claro"]` é um DELTA sobre o `:root` de base: o que
// ele não redeclara cai no tema escuro, e é assim que o PALCO (`--stage-*`,
// `--wallpaper`, as sombras) fica igual nos dois — deliberado, porque um telão
// claro cega a congregação e a preview do Controle espelha o telão.
//
// O que essa montagem NÃO tolera é um token que exista SÓ no claro: no tema
// escuro — que é o padrão de quem nunca escolheu nada, isto é, quase todo
// aparelho — ele simplesmente não estaria definido, e o `var()` computaria para
// o valor inicial da propriedade. Sem aviso, sem log, e só no tema padrão: a
// mesma falha da v5.171, num lugar onde quem escreveu acabou de ver a cor certa
// na tela porque estava com o claro ligado.
{
  const s = fonte.get(arquivos.find((f) => f.endsWith('tokens.css'))) || '';
  const blocos = [...s.matchAll(/(:root(?:\[data-tema="(\w+)"\])?)\s*\{([^}]*)\}/g)];
  const naBase = new Set();
  const soNoClaro = [];
  for (const b of blocos) if (!b[2]) for (const m of b[3].matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) naBase.add(m[1]);
  for (const b of blocos) {
    if (b[2] !== 'claro') continue;
    for (const m of b[3].matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) if (!naBase.has(m[1])) soNoClaro.push(m[1]);
  }
  checar(blocos.some((b) => b[2] === 'claro'), 'tokens.css declara o bloco do tema claro',
    blocos.map((b) => b[1]).join(' · '));
  checar(soNoClaro.length === 0,
    'nenhum token existe SÓ no tema claro (o escuro é a base, o claro é o delta)',
    soNoClaro.join(', '));
}

// ---------- NENHUM CONTORNO EM LUGAR NENHUM (v5.267) ----------
// Pedido do operador: *"não tenhamos itens usando linha de borda, tudo deve ser
// com preenchimento sólido, e definição feita por puro e simples contraste entre
// os elementos."*
//
// Ele é uma REGRA DA CASA agora, e regra de casa sem oráculo dura até o próximo
// lote: uma borda é a coisa mais fácil de acrescentar em CSS quando duas caixas
// não estão se separando o bastante — é literalmente o remendo que este lote veio
// desfazer, e ele estava espalhado por 88 declarações. Um `border: 1px solid` a
// mais não quebra nada, não erra alto e não aparece em teste de comportamento
// nenhum; some dentro de uma folha de 4.300 linhas e volta a valer como
// precedente para o próximo.
//
// A varredura é da FONTE e não do renderizado, e isso é deliberado: metade das
// bordas que saíram morava em regras de ESTADO (`.active`, `.no-ar`,
// `.expanded`) e em pseudo-elementos, que uma caminhada pelo DOM só alcançaria
// se o teste soubesse encenar cada um dos estados.
//
// ## O que NÃO é contorno, e por isso passa
//
// `border` também é a forma idiomática de DESENHAR em CSS, e desenho não é o que
// o pedido trata. Dois casos, os dois nomeados aqui em vez de detectados por
// heurística — uma heurística deixaria a próxima borda entrar chamando-se
// "desenho":
//
//   · o aro do `.dl-ring` (o anel que gira enquanto um download corre) — ele É
//     um círculo, não a moldura de um elemento. O irmão dele no palco
//     (`.av-stage-busy`) saiu na v1.4.8, junto com a folha `shared/stage.css`:
//     o telão não anuncia mais preparo nenhum;
//   · o ✓ do `.song-menu-check` (duas bordas em L, giradas 45°) — é o glifo que
//     falta no subset da fonte de ícones.
//
// ## E A ÚNICA BORDA QUE É BORDA (v1.5.5)
//
// O campo de busca da Biblioteca, e ele é EXCEÇÃO PEDIDA, não desenho: *"abra
// uma única exceção ao conceito de sem bordas do app, para poder fazer a caixa
// de texto da busca para que seja branca com a borda em cinza"*.
//
// Ela entra pelo mesmo mecanismo dos dois de cima — um nome, escrito à mão — e
// **é o nome que a mantém única**: a lista não tem regra que a próxima borda
// possa alegar cumprir. O argumento é aritmético e não estético: no tema claro
// `--bar` é BRANCO e o campo é branco, isto é 1,00:1, e sem contorno a caixa de
// texto não existe na tela. Foi essa mesma conta que criou a faixa `--field-bar`
// na v5.270; a borda resolve sem trazer a faixa de volta, que é o que o operador
// recusou na v1.5.2.
//
// ## E A MOLDURA DA BIBLIOTECA (v1.5.9), que é uma AUTORIDADE, não uma brecha
//
// A EXCEÇÃO DA BIBLIOTECA SAIU NA v1.5.14, e o app voltou a ter ZERO contornos.
//
// Ela foi dada na v1.5.9 e era explícita e escopada: *"vou lhe dar autoridade
// para usar sistemas visuais de design e organização usando bordas, mas apenas
// para a biblioteca. pois temos 3 niveis de listagens na biblioteca e o sistema
// de separação apenas por cor sólida de cards está limitando nossas opções"*.
//
// **A autorização era para o PROBLEMA, não para a solução**, e o problema tinha
// causa aritmética: quatro níveis (janela → seção → álbum → faixa) sobre uma
// escada de três degraus, com a janela tendo gastado o de cima na v1.5.7.
// MEDIDO no renderizado, o desenho que a moldura sustentava não cumpria o piso
// de 1,28:1 em NENHUM par de superfícies — sete de sete reprovavam no tema
// escuro —, e três pares valiam 1,00:1. O traço de 1px era a única coisa da
// tela com contraste de verdade, e por isso parecia funcionar.
//
// A v1.5.14 troca a ESCADA (que acumula e acaba) pela ALTERNÂNCIA papel → poço
// → papel: duas superfícies, profundidade ilimitada, 1,35:1 e 1,43:1 em cada
// degrau. Sem escassez de degrau não há o que a borda resolva, e o pedido de
// então — *"poucas bordas, sem traços finos, ou designs visualmente poluídos"* —
// a dispensa. Restam as TRÊS exceções nomeadas acima, que são DESENHOS e não
// separadores.
//
// ## E A DIVISÓRIA ENTRE FAIXAS IRMÃS (v1.5.16) — a QUARTA, e ela é um TRAÇO
//
// Pedido do operador: *"Verifique a criação de um elemento de linha divisória
// (não borda inteira), na listagem do itens propriamente dos álbuns, para
// melhor distinção entre os itens."*
//
// **A moldura não voltou.** A distinção é de OBJETO, não de espessura: a
// moldura era um retângulo por nível, quatro arestas, em três níveis ao mesmo
// tempo, e carregava a HIERARQUIA — trabalho que a alternância faz hoje com
// degrau real. Esta é UMA aresta, num nível só, entre IRMÃS, e faz o que a
// alternância por construção não faz: separar vizinhas do MESMO nível. As três
// palavras do pedido que decidem são *"não borda inteira"* — ele já sabe que o
// app aboliu contorno e está distinguindo uma DIVISÓRIA de uma MOLDURA.
//
// E ela é ARITMÉTICA de novo: desde a v1.5.14 a faixa é transparente e a placa
// atrás dela é `--panel`, então o vão de 4px que separa duas faixas mede
// **1,00:1** contra os dois lados. Não é pouca separação — é separação nenhuma.
//
// **POR QUE ELA NÃO É UMA `border`, e por que isso NÃO é escapar pela letra.**
// `border-bottom` cobre a caixa inteira e não tem como ser RECUADA, que é
// literalmente o *"não borda inteira"* do pedido: a divisória começa na coluna
// do NOME, não sob a miniatura. A forma vem do pedido. Mas um traço pintado
// passaria por esta varredura sem que ninguém decidisse nada, e o precedente
// que entraria no repositório seria *"filete pode, desde que não se chame
// border"* — a heurística exata contra a qual este arquivo avisa. Daí as duas
// asserções logo abaixo: uma POSITIVA, que exige que `--divisoria` tenha um
// consumidor só e que ele seja este seletor, e uma NEGATIVA, que varre a fonte
// por QUALQUER traço pintado e reprova todos os outros.
//
// Largura zero e cor transparente também passam: os dois não desenham nada.
{
  // As regras dos DESENHOS, recortadas da fonte antes da varredura. Nomeadas
  // uma a uma de propósito: uma heurística ("anéis podem") deixaria a próxima
  // borda entrar chamando-se desenho.
  const recortar = (s) => s
    .replace(/\.dl-ring::before\s*\{[^}]*\}/g, '')
    .replace(/\.song-menu-check\.on::after\s*\{[^}]*\}/g, '')
    .replace(/#hymnSearchInput\s*\{[^}]*\}/g, '')
    // (O RECORTE POR ESCOPO `.acervo` saiu na v1.5.14, com a moldura. Ele era a
    // única exceção deste oráculo que não nomeava uma peça — e uma exceção por
    // escopo é a que mais barato se alarga: bastava um seletor novo começar com
    // `.acervo` para uma borda entrar sem ninguém decidir nada.)
    .replace(/@media[^{]*\{\s*\.dl-ring::before[^}]*\}/g, '');
  const contornos = [];
  for (const f of arquivos) {
    const s = recortar(semComentarios(fonte.get(f) || ''));
    for (const m of s.matchAll(/(^|[;{\s])(border(?:-(?:top|right|bottom|left))?(?:-(?:width|color|style))?|outline(?:-(?:width|color|style))?)\s*:\s*([^;}]+)/g)) {
      const valor = m[3].trim();
      // `border-radius` não é contorno (a regex acima já não o casa), e estes
      // três valores não desenham: sem linha, sem largura, sem cor.
      if (/^(none|0|0px|transparent|hidden)$/.test(valor)) continue;
      if (/\btransparent\b/.test(valor) && !/\b(solid|dashed|dotted)\b/.test(valor)) continue;
      contornos.push(path.relative(RAIZ, f) + ':' + (s.slice(0, m.index).split('\n').length)
        + ' → ' + m[2] + ': ' + valor);
    }
  }
  checar(contornos.length === 0,
    'nenhuma regra desenha contorno: no app tudo se separa por PREENCHIMENTO',
    contornos.join('\n        '));
}

// ---------- E NENHUM TRAÇO PINTADO ALÉM DA DIVISÓRIA (v1.5.16) ----------
// O par da asserção acima, e é ele que impede que a exceção da v1.5.16 vire
// brecha. A varredura de contorno casa a palavra `border`; um filete desenhado
// como bloco de 1px com fundo passa por ela sem que ninguém decida nada, e o
// próximo separador entra como `height: 1px; background: var(--surface)`.
//
// A régua é a FORMA, não o nome: um bloco cuja regra declare `height: 1px` (ou
// `width: 1px`) E um `background` que não seja transparente É um traço, chame-se
// como se chamar. A única passagem é o seletor NOMEADO — a mesma mecânica dos
// quatro desenhos de cima.
//
// PROVADO POR REVERSÃO: trocar o seletor da exceção por outro qualquer, ou
// acrescentar um segundo bloco de 1px pintado em qualquer lugar da base, reprova.
{
  // A EXCEÇÃO É UMA REGRA SÓ, com DUAS listas na frente (v1.5.18): a faixa de um
  // álbum e a linha de um favorito. O operador pediu a segunda ao ver que ela
  // faltava, e ela entrou no MESMO bloco de declaração de propósito — é isso
  // que mantém `--divisoria` com um consumidor único, que é a metade positiva
  // logo abaixo. Uma segunda regra com o mesmo `background` passaria por esta
  // varredura e reprovaria naquela, que é o desenho certo do par.
  const EXCECAO = '.acervo .coll-songs > .hymn-result + .hymn-result::before,'
    + ' #hymnResults > .coll-group--fav.aberto .fav-itens > .lib-item + .lib-item::before';
  const tracos = [];
  let consumidores = 0;
  for (const f of arquivos) {
    const cru = fonte.get(f) || '';
    const s = semComentarios(cru);
    // Bloco a bloco, como a varredura do R1 — entre um `}` e o seletor seguinte
    // cabe um comentário de trinta linhas, e um teto de caracteres faria o
    // oráculo pular justamente as regras mais documentadas.
    let pos = 0;
    for (const bruto of s.split('}')) {
      const chave = bruto.indexOf('{');
      const inicio = pos;
      pos += bruto.length + 1;
      if (chave < 0) continue;
      const sel = bruto.slice(0, chave).trim();
      const corpo = bruto.slice(chave + 1);
      if (!sel || sel.startsWith('@')) continue;
      if (/background\s*:\s*var\(--divisoria\)/.test(corpo)) consumidores++;
      const fino = /(?:^|[;{\s])(?:height|width)\s*:\s*1px\s*(?:;|$)/.test(corpo);
      if (!fino) continue;
      const m = corpo.match(/(?:^|[;{\s])background(?:-color)?\s*:\s*([^;}]+)/);
      if (!m) continue;
      const valor = m[1].trim();
      if (/^(none|transparent)$/.test(valor)) continue;
      // O seletor vem da FONTE, com a quebra de linha entre as duas listas — a
      // comparação normaliza o espaço, senão a exceção nomeada nunca casaria.
      if (sel.replace(/\s+/g, ' ').trim() === EXCECAO) continue;
      tracos.push(path.relative(RAIZ, f) + ':' + (s.slice(0, inicio).split('\n').length)
        + ' → ' + sel.replace(/\s+/g, ' ') + ' { ' + valor + ' }');
    }
  }
  checar(tracos.length === 0,
    'nenhum TRAÇO pintado além da divisória nomeada: um filete não deixa de ser '
    + 'um filete por não se chamar `border`',
    tracos.join('\n        '));
  // E A METADE POSITIVA: `--divisoria` tem UM consumidor, e é o seletor da
  // exceção. Sem ela, o token viraria a porta larga — qualquer regra nova
  // poderia consumi-lo e a asserção acima a deixaria passar pelo nome do token.
  checar(consumidores === 1,
    '`--divisoria` é consumido por exatamente UMA regra (a exceção nomeada)',
    consumidores + ' consumidor(es)');
}

// ---------- A SUPERFÍCIE DE UM CONTROLE É OPACA (v1.3.14) ----------
// Os `-soft` da paleta são TINTA COM ALFA, e alfa EMPILHA: o mesmo token compõe
// uma cor sobre `--panel` e outra sobre `--panel-2`. MEDIDO no escuro, a deriva
// do MESMO botão entre a base mais escura e a mais clara em que ele pousa era
// de 1,97:1 no accent — MAIOR que o degrau `--bg` × `--panel` (1,49:1), isto é,
// o mesmo chevron variava mais que dois níveis inteiros da escada. Era a queixa
// "cores diferentes ou inconsistentes entre grupos de hinário, informativos e
// coleções": o chevron da SEÇÃO compunha #3d4959 e o do CARD, #4a596d.
//
// A família `--btn-*` existe para isso, e este caso é o que a mantém: um
// `background: var(--accent-soft)` é a coisa mais fácil de escrever quando se
// quer "um botão azulzinho", e ele não erra alto — erra só quando o mesmo
// componente nasce em duas telas, que é meses depois e longe daqui.
//
// OS `-soft` FICAM, e por isso a varredura é só de `background`: eles continuam
// certos onde a translucidez é o efeito e não o acidente — o `box-shadow` do
// pulso de "no ar", o trilho do `.dl-ring` (um anel desenhado sobre base
// arbitrária). Nenhum dos dois é superfície de controle.
{
  const soft = [];
  for (const f of arquivos) {
    const s = fonte.get(f) || '';
    for (const m of s.matchAll(/background(?:-color)?\s*:\s*var\(\s*--(accent|brand|danger|warn|ok|live)-soft\s*\)/g)) {
      soft.push(path.relative(RAIZ, f) + ':' + (s.slice(0, m.index).split('\n').length)
        + ' → --' + m[1] + '-soft (use --btn-' + m[1].replace('brand', 'accent').replace('live', 'danger') + ')');
    }
  }
  checar(soft.length === 0,
    'nenhuma superfície de controle é uma tinta com ALFA: fundo de botão e de '
    + 'chip usa a família OPACA `--btn-*`, que vale o mesmo em qualquer camada',
    soft.join('\n        '));
}

// ---------- MARCA DE CONFLITO NA FOLHA (v1.4.31) ----------
// MEDIDO, e é o defeito que criou esta asserção: a v1.4.27 subiu com um
// conflito de merge por resolver DENTRO do `:is(...)` da lista do `--press` —
// `<<<<<<< HEAD`, o par de selectores e o `>>>>>>> <sha>` inteiros no arquivo.
//
// **`:is()` é uma lista FORGIVING**, e é isso que torna a falha muda: o
// navegador descarta os componentes inválidos e aplica o resto. As ~40 classes
// da lista continuaram recuando ao toque, o CI seguiu verde por três lotes, e o
// que se perdeu foram só os DOIS seletores em disputa — o `.row-slot--ok` (o ✓
// do renomear) e o `.lv-row--tocavel` (a linha de slide que projeta), que
// deixaram de responder ao dedo sem nada na tela dizer por quê. Um oráculo de
// COMPORTAMENTO não pega isto: ele mede um seletor que sobreviveu.
//
// Em JS o `node --check` já reprova (a marca é erro de sintaxe); numa folha e
// num HTML ela é texto que o parser engole. Daí a varredura ser aqui, e ser do
// ARQUIVO CRU — a marca pode cair dentro de um comentário e continuar cortando
// o que veio depois.
{
  // O ARQUIVO CRU, e não o de `fonte`: ali os comentários viraram espaço, e uma
  // marca DENTRO de um comentário continua cortando o que vem depois dela.
  const marcados = [];
  for (const f of [...arquivos, path.join(RAIZ, 'controle', 'index.html'),
    path.join(RAIZ, 'display', 'index.html')]) {
    if (!fs.existsSync(f)) continue;
    const linhas = fs.readFileSync(f, 'utf8').split('\n');
    const i = linhas.findIndex((l) => /^(<{7}|={7}|>{7})(\s|$)/.test(l));
    if (i >= 0) marcados.push(path.basename(f) + ':' + (i + 1) + ' → ' + linhas[i].slice(0, 60));
  }
  checar(marcados.length === 0,
    'nenhuma folha nem HTML da base carrega marca de conflito de merge: `:is()` '
    + 'descarta a inválida e leva junto, em silêncio, os seletores em disputa',
    marcados.join('\n        '));
}

// ---------- QUEM PINTA `--panel` ENTRA NA REGRA R1 (v1.3.14) ----------
// R1 diz que a superfície de um controle AFUNDA dentro de um cartão, e ela é
// implementada por uma LISTA de seletores que redeclaram `--surface`. Uma lista
// só protege quem está nela — e um bloco novo que pinte `--panel` sem entrar
// aqui herda o overlay FLUTUANTE, que é branco com alfa.
//
// MEDIDO, e é o caso que criou esta asserção: a `.tools-sheet` nasceu na v1.3.10
// pintando `--panel` e nunca entrou na lista. No tema CLARO o `.mic-btn` dentro
// dela saía em branco a 92% sobre branco pleno — **1,00:1**. A barra de
// push-to-talk, 56px, o controle que se procura sem olhar, não existia na tela.
//
// A varredura é do `--panel` LITERAL, não de `var(--camada)`: quem lê a camada
// está justamente delegando o nível ao pai, e o pai é que precisa estar na
// lista. Exceções nomeadas uma a uma, como as dos contornos.
{
  const css = fonte.get(arquivos.find((f) => f.endsWith('controle.css'))) || '';
  const regra = css.match(/([^{}]*)\{\s*--surface:\s*var\(--surface-sunk\);\s*--surface-2:\s*var\(--surface-2-sunk\);\s*\}/);
  const naLista = regra
    ? new Set(regra[1].split(',').map((x) => x.trim()).filter(Boolean))
    : new Set();
  checar(naLista.size > 5, 'a lista de R1 (o que AFUNDA a superfície) foi encontrada',
    naLista.size + ' seletores');
  // Não é bloco de conteúdo: uma barra de rolagem não hospeda controle nenhum.
  //
  // `.lv-selo` (v1.4.35) entra pela MESMA razão, e ela está no CSS: o selo da
  // página é um RÓTULO sobre a miniatura, com `pointer-events: none` — ele não
  // hospeda controle e não pode hospedar. Ele pinta `--panel` porque pousa sobre
  // um pixel de apresentação (precisa de fundo OPACO) e porque é o único tom
  // opaco em que o número passa AA: MEDIDO em `tokens.css`, `--muted` dá 4,88:1
  // sobre `--panel` e 3,66:1 sobre `--panel-2` — trocar de token para escapar
  // desta asserção custaria a legibilidade que ela existe para defender.
  const excecoes = [/scrollbar/, /^\.lv-selo$/];
  // A varredura é por BLOCO e não por regex de rua: entre um `}` e o seletor
  // seguinte cabe um comentário de trinta linhas (já em branco, mas ocupando
  // espaço), e um teto de caracteres no meio faz o oráculo pular exatamente as
  // regras mais documentadas — que são as que mais importam. Foi o que
  // aconteceu na primeira versão desta asserção: ela passou por cima da
  // `.tools-sheet`, o caso que a criou.
  const fora = [];
  let pos = 0;
  for (const bruto of css.split('}')) {
    const chave = bruto.indexOf('{');
    const inicio = pos;
    pos += bruto.length + 1;
    if (chave < 0) continue;
    const sel = bruto.slice(0, chave).trim();
    const corpo = bruto.slice(chave + 1);
    if (!/background\s*:\s*var\(--panel\)/.test(corpo)) continue;
    if (!sel || sel.startsWith('@') || excecoes.some((r) => r.test(sel))) continue;
    // Um seletor composto entra se QUALQUER uma das partes dele estiver na lista.
    if (sel.split(',').map((x) => x.trim()).some((x) => naLista.has(x))) continue;
    // ===== O SUJEITO DE UM DESCENDENTE É O ÚLTIMO SIMPLES (v1.5.7) =====
    // `.popup-backdrop--lib.open .popup-sheet--lib` PINTA a folha, e é a folha
    // que os filhos leem — o recesso dela mora numa regra da classe crua, como
    // manda a doutrina (o estado troca a tinta, não a escada). Comparar a string
    // INTEIRA fazia o oráculo reprovar uma regra correta, e a próxima regra de
    // estado que pintasse um cartão cairia no mesmo lugar.
    //
    // Isto NÃO afrouxa a asserção: o sujeito é quem hospeda os filhos, e é a
    // superfície DELE que a R1 governa. O que continua reprovando é pintar
    // `--panel` num bloco que, ele mesmo, não afunda em lugar nenhum.
    const sujeito = (x) => x.trim().split(/\s+/).pop();
    if (sel.split(',').map(sujeito).some((x) => naLista.has(x))) continue;
    if (sel.split(',').map(sujeito).some((x) => new RegExp(
      x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      + '\\s*\\{[^{}]*--surface:\\s*var\\(--surface-sunk\\)').test(css))) continue;
    // OU o bloco afunda a superfície POR CONTA PRÓPRIA, numa regra dele — é o
    // caso da `.simple-conn`. O que a asserção cobra é o EFEITO (o controle
    // dentro dele afunda), não a filiação a uma lista.
    if (/--surface:\s*var\(--surface-sunk\)/.test(corpo)) continue;
    if (new RegExp(sel.split(',')[0].trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      + '\\s*\\{[^{}]*--surface:\\s*var\\(--surface-sunk\\)').test(css)) continue;
    fora.push(sel.replace(/\s+/g, ' ') + ' (linha '
      + (css.slice(0, inicio).split('\n').length) + ')');
  }
  checar(fora.length === 0,
    'todo bloco que pinta `--panel` está na lista de R1: sem isso os controles '
    + 'dentro dele usam a superfície FLUTUANTE e somem no tema claro',
    fora.join('\n        '));
}

// ===== O ESPELHO NATIVO: `colors.xml` × `tokens.css` (v1.5.14) =====
//
// `--bg` é a ÚNICA cor deste projeto que existe em dois lugares por
// necessidade: um recurso de Android não enxerga custom property, e o
// `windowBackground` (o que aparece ANTES de o WebView carregar) e os ícones
// das barras de sistema só podem sair do XML. Os dois valores TÊM de ser
// iguais — divergir é o "flash" de outro preto no primeiro quadro, e a faixa
// de outra cor nas safe-areas com o edge-to-edge do Android 15+.
//
// **O comentário do próprio `colors.xml` admitia que nada verificava isso**
// (*"nada no build detecta a divergência, e o OTA pode trocar a base web sem
// trocar o APK"*) — e é justamente o OTA que torna a divergência provável: a
// base web chega em minutos, o `res/` só chega instalando um APK. Este caso
// existe para que a próxima troca de `--bg` não possa esquecer o outro lado.
{
  const xml = fs.readFileSync(path.join(RAIZ, '..', '..', 'res', 'values', 'colors.xml'), 'utf8');
  const cor = (nome) => {
    const m = new RegExp('<color name="' + nome + '">\\s*(#[0-9a-fA-F]{3,8})\\s*</color>').exec(xml);
    return m ? m[1].toLowerCase() : null;
  };
  // `--bg` de cada tema, lido da FONTE (os dois blocos `:root` de tokens.css).
  const tk = fonte.get(arquivos.find((f) => f.endsWith('tokens.css'))) || '';
  const blocos = [...semComentarios(tk).matchAll(/:root([^{]*)\{([^}]*)\}/g)];
  const bgDe = (claro) => {
    for (const b of blocos) {
      const ehClaro = b[1].includes('data-tema');
      if (ehClaro !== claro) continue;
      const m = /(?:^|;)\s*--bg:\s*([^;]+)/.exec(b[2]);
      if (m) return m[1].trim().toLowerCase();
    }
    return null;
  };
  const escuro = bgDe(false);
  const claro = bgDe(true);
  checar(!!escuro && !!claro, 'o `--bg` dos dois temas foi encontrado em tokens.css',
    'escuro ' + escuro + ' · claro ' + claro);
  checar(cor('app_bg') === escuro,
    '`app_bg` do colors.xml espelha o `--bg` do tema ESCURO: é o windowBackground '
    + 'do primeiro quadro, e divergir devolve o flash de outro preto',
    'xml ' + cor('app_bg') + ' · token ' + escuro);
  checar(cor('app_bg_claro') === claro,
    'e `app_bg_claro` espelha o do tema CLARO',
    'xml ' + cor('app_bg_claro') + ' · token ' + claro);
  // O ícone segue o tema ESCURO e não a escolha do operador: ele é desenhado
  // pela gaveta do sistema com o app fechado, e abrir o app tem de expandir o
  // fundo do próprio ícone.
  checar(cor('ic_launcher_background') === escuro,
    'e o fundo do ícone adaptativo é o mesmo do tema escuro: abrir o app expande '
    + 'o fundo do próprio ícone',
    'xml ' + cor('ic_launcher_background') + ' · token ' + escuro);
}

console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
