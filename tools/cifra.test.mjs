#!/usr/bin/env node
// ============================================================================
// A REGRA DA CIFRA — o que o app entende de uma página de cifra
//
// ## Por que ele existe
//
// `controle/cifra.js` lê a marcação de um servidor que **não é nosso e não nos
// deve compatibilidade nenhuma**. É a peça mais frágil do app por construção, e
// os modos de errar dela são todos silenciosos:
//
//   - **slug errado** → a URL não resolve e a aba diz "não achei" para a
//     coleção INTEIRA, como se o site não tivesse o hinário;
//   - **classificar letra como acorde** → a letra some da aba, sem erro nenhum
//     (é o que acontece se a gramática de acorde virar curinga e "Deus" casar);
//   - **classificar acorde como letra** → a transposição não pega nele, e a
//     folha sai meio transposta — o pior desfecho, porque PARECE certa;
//   - **transpor sem preservar coluna** → o acorde desliza para outra sílaba, e
//     de novo a folha parece certa;
//   - **devolver vazio no lugar de "não entendi"** → uma mudança de marcação do
//     site fica indistinguível de uma música ausente, e ninguém investiga.
//
// ## As entradas são SINTÉTICAS, e é de propósito
//
// Ao contrário do `serie.test.mjs` — cujo valor está em usar strings VERBATIM
// do canal —, aqui as fixtures são inventadas: texto de marcador, nunca letra
// de música de verdade. **Nenhum conteúdo de terceiro entra neste
// repositório**, que é a premissa inteira do recurso (o app lê sob demanda, no
// aparelho do operador, e não guarda nada).
//
// O que se perde com isso está dito: estas fixtures provam a GRAMÁTICA do
// parser, não que ela case com o HTML de hoje do site. Essa segunda metade só
// se prova contra uma página real — e é justamente a metade que, quando
// quebrar, se conserta por OTA em minutos. Ver a linha "Cifra:" do Registro.
//
// Node puro, sem rede e sem navegador: entra no `apk.yml` **sem
// `continue-on-error`**.
//
//   node tools/cifra.test.mjs
// ============================================================================
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(raiz, 'app/src/main/assets/web/controle/cifra.js');

// Mesma carga do `serie.test.mjs`: a IIFE é `(function (global) { … })(this)`,
// e o corpo de um `new Function` é não-estrito, então o `this` do topo é o
// receptor do `.call`. Se um dia o módulo passar a depender de `document`, este
// teste falha alto — que é o que se quer de um módulo declarado PURO.
const janela = {};
new Function(readFileSync(SRC, 'utf8')).call(janela);
const C = janela.AVCifra;

const falhas = [];
function checar(cond, nome, extra) {
  if (cond) { console.log('  ok   ' + nome); return; }
  falhas.push(nome);
  console.log('  FALHA ' + nome + (extra === undefined ? '' : '  → ' + JSON.stringify(extra)));
}
function secao(t) { console.log('\n' + t); }

checar(!!C, 'o módulo publica AVCifra');

// ── 1. O SLUG, e o endereço que ele produz ──────────────────────────────────
// O caso âncora é uma URL REAL conferida à mão:
//   https://www.cifraclub.com.br/novo-hinario-adventista/santo-santo-santo/
// É a única parte deste oráculo que amarra o parser ao site de verdade, e ela
// amarra a metade que mais importa — sem slug certo, nada mais é exercitado.
secao('1. slug e URL');
checar(C.slug('Santo, Santo, Santo') === 'santo-santo-santo',
  'pontuação vira separador e não sobra hífen', C.slug('Santo, Santo, Santo'));
checar(C.slug('001. Santo, Santo, Santo') === 'santo-santo-santo',
  'o NÚMERO DA FAIXA sai antes do slug (o nome do hinário chega como "001. …")',
  C.slug('001. Santo, Santo, Santo'));
checar(C.urlDoHino('hymnal-2022', '001. Santo, Santo, Santo')
  === 'https://www.cifraclub.com.br/novo-hinario-adventista/santo-santo-santo/',
  'a URL do hino 2022 bate com a página real', C.urlDoHino('hymnal-2022', '001. Santo, Santo, Santo'));
checar(C.urlDoHino('hymnal-1996', '12 - Ó Vem, Ó Vem!')
  === 'https://www.cifraclub.com.br/hinario-adventista/o-vem-o-vem/',
  'acento, vírgula e "!" não deixam hífen duplo nem hífen na ponta',
  C.urlDoHino('hymnal-1996', '12 - Ó Vem, Ó Vem!'));
checar(C.urlDoHino('coll:album-qualquer', 'Alguma Coisa') === '',
  'coleção fora do catálogo não inventa endereço — quem responde é a busca');
checar(C.urlDeBusca('teste de busca')
  === 'https://www.cifraclub.com.br/?q=teste%20de%20busca',
  'a busca genérica codifica o termo', C.urlDeBusca('teste de busca'));
checar(C.urlDeBusca('   ') === '', 'termo em branco não vira requisição');

// ── 2. A GRAMÁTICA DO ACORDE ────────────────────────────────────────────────
// Em PARES: o que ela tem de aceitar, e o que ela não pode aceitar junto. Sem a
// segunda metade, um curinga passaria no teste — e um curinga classifica a
// letra inteira como acordes, apagando-a da aba sem erro nenhum.
secao('2. o que é acorde, e o que não pode ser');
[
  'C', 'G', 'A7', 'Bm', 'Em7', 'C#m7', 'Ab', 'Bb7', 'Dsus4', 'Gadd9',
  'F#m7(b5)', 'G/B', 'A/C#', 'Cº', 'D+',
  // A CLASSE QUE O DEFEITO DA v1.1.13 DEIXAVA DE FORA. O sufixo era uma lista
  // de palavras MINÚSCULAS exigindo dígitos depois, então `7M` — a notação
  // brasileira de sétima maior, e a mais comum num hinário — não casava. Como
  // `transporAcorde` devolvia intacto o que não casasse, esses acordes ficavam
  // PARADOS no tom original enquanto a folha inteira andava.
  'G7M', 'D7M', 'A7M/E', 'D7M/A', 'D#7M', 'A#7M/F',
  'Cmaj7', 'CM7', 'A5+', 'E7(9)', 'Am7(b5)', 'F#7(4)', 'Bm6',
].forEach((t) => checar(C.pareceAcorde(t), 'aceita o acorde ' + t));
[
  'Deus', 'Cristo', 'Amor', 'Ele', 'Senhor', 'Bendito', 'Filho', 'Graca',
  'Glória', 'e', 'do', 'Aleluia',
  // A gramática AFROUXOU na v1.1.14 (de lista de palavras para conjunto de
  // caracteres), e é justamente aí que ela poderia passar a engolir letra. Esta
  // metade é a que prova que não engoliu — sem ela, a correção do `7M` teria
  // sido comprada apagando a letra da aba, que é o defeito PIOR.
  'Canta', 'Face', 'Bendize', 'Ergue', 'Adora', 'Cada', 'Grande', 'Fica',
  '---', '[Intro]', 'Refrao',
].forEach((t) => checar(!C.pareceAcorde(t), 'NÃO aceita a palavra ' + t));

// ── 3. TRANSPOSIÇÃO ─────────────────────────────────────────────────────────
secao('3. transposição');
checar(C.transporAcorde('C', 2) === 'D', 'C +2 = D');
checar(C.transporAcorde('B', 1) === 'C', 'B +1 = C (dá a volta)');
checar(C.transporAcorde('C', -1) === 'B', 'C −1 = B (dá a volta para trás)');
checar(C.transporAcorde('Am7', 3) === 'Cm7', 'o sufixo viaja intacto', C.transporAcorde('Am7', 3));
checar(C.transporAcorde('G/B', 2) === 'A/C#', 'o baixo invertido também sobe', C.transporAcorde('G/B', 2));
// A GRAFIA SEGUE A ORIGEM: uma folha em bemóis continua em bemóis. Musicalmente
// correto, e é o que faz a folha continuar parecendo a mesma para quem a conhece.
checar(C.transporAcorde('Bb', 2) === 'C', 'Bb +2 = C');
checar(C.transporAcorde('Bb', 1) === 'B', 'Bb +1 = B (bemol → natural)', C.transporAcorde('Bb', 1));
checar(C.transporAcorde('Eb', 1) === 'E', 'Eb +1 = E', C.transporAcorde('Eb', 1));
checar(C.transporAcorde('C', 1) === 'C#', 'sem bemol na origem, sobe em sustenido');
checar(C.transporAcorde('Deus', 2) === 'Deus', 'o que não é acorde não é transposto');
checar(C.transporAcorde('C', 0) === 'C' && C.transporLinha('C   G', 0) === 'C   G',
  'zero semitom é identidade');

// ── 3a. O DEFEITO DA v1.1.13, preso pelos números do aparelho ───────────────
// A folha real vem no tom de D; o operador pediu A (−5) e A# (−4). Os valores
// esperados foram conferidos contra a página do site nos dois tons: era ali que
// `D7M/A` e `G7M` ficavam parados enquanto o resto da linha andava.
checar(C.transporAcorde('D7M/A', -5) === 'A7M/E',
  'D7M/A −5 = A7M/E (raiz E baixo andam, o 7M viaja intacto)', C.transporAcorde('D7M/A', -5));
checar(C.transporAcorde('G7M', -5) === 'D7M', 'G7M −5 = D7M', C.transporAcorde('G7M', -5));
checar(C.transporAcorde('D7M/A', -4) === 'A#7M/F', 'D7M/A −4 = A#7M/F', C.transporAcorde('D7M/A', -4));
checar(C.transporAcorde('G7M', -4) === 'D#7M', 'G7M −4 = D#7M', C.transporAcorde('G7M', -4));
checar(C.transporAcorde('Cmaj7', 2) === 'Dmaj7', 'a grafia por extenso também anda');
checar(C.transporAcorde('A5+', 3) === 'C5+', 'e as alterações com sinal');
// A GRAFIA SEGUE A RAIZ, não um `b` perdido dentro da extensão: o bemol de uma
// ALTERAÇÃO não diz nada sobre como a fundamental é escrita.
checar(C.transporAcorde('C7(b9)', 1) === 'C#7(b9)',
  'o b de (b9) não force a raiz para bemol', C.transporAcorde('C7(b9)', 1));
// E A EXTENSÃO VIAJA VERBATIM — só raiz e baixo andam.
checar(C.transporAcorde('F#m7(b5)', 1) === 'Gm7(b5)',
  'a extensão inteira é preservada', C.transporAcorde('F#m7(b5)', 1));

// A COLUNA é o dado. Um acorde vale por estar sobre a sílaba em que a harmonia
// troca; um `replace` ingênuo empurra todos os seguintes e a folha sai fora de
// sincronia — parecendo certa, que é o pior.
secao('3b. transposição PRESERVA AS COLUNAS');
{
  const antes = 'C       G       Am      F';
  const depois = C.transporLinha(antes, 2);
  const colAntes = [...antes.matchAll(/\S+/g)].map((m) => m.index);
  const colDepois = [...depois.matchAll(/\S+/g)].map((m) => m.index);
  checar(JSON.stringify(colAntes) === JSON.stringify(colDepois),
    'os acordes ficam nas MESMAS colunas quando cabem', { antes, depois, colAntes, colDepois });
  checar(depois.trim().split(/\s+/).join(' ') === 'D A Bm G',
    'e são de fato os acordes transpostos', depois);
}
{
  // O caso em que NÃO cabe: "C" (1 char) vira "C#" (2) num espaço de 1. Perder
  // a coluna exata é ruim; colar dois acordes num só é ilegível.
  const depois = C.transporLinha('C G', 1);
  checar(/^C#\s+G#$/.test(depois), 'quando o acorde cresce, entra um espaço em vez de colar', depois);
}

// ── 4. ENTIDADES ────────────────────────────────────────────────────────────
secao('4. entidades HTML');
checar(C.decodificar('a &amp; b') === 'a & b', '&amp;');
checar(C.decodificar('d&#39;agua') === "d'agua", 'numérica decimal');
checar(C.decodificar('&#x41;') === 'A', 'numérica hexadecimal');
// O `&nbsp;` é ESPAÇO, e num `<pre>` ele é espaço de ALINHAMENTO: comê-lo
// desloca o acorde da sílaba a que ele pertence.
checar(C.decodificar('C&nbsp;&nbsp;&nbsp;G') === 'C   G',
  '&nbsp; vira ESPAÇO, não string vazia', C.decodificar('C&nbsp;&nbsp;&nbsp;G'));
checar(C.decodificar('&#999999999;') === '&#999999999;',
  'código fora da faixa fica VISÍVEL em vez de virar um "" mudo');
checar(C.decodificar('&naoexiste;') === '&naoexiste;', 'entidade desconhecida é preservada');

// ── 5. A FOLHA ──────────────────────────────────────────────────────────────
// Texto de marcador, nunca letra de verdade — ver o cabeçalho.
secao('5. a folha: acorde × letra');
{
  const pre = [
    '<b>C</b>      <b>G</b>',
    'Primeira linha de marcador',
    '',
    '<b>Am</b>     <b>F</b>',
    'Segunda linha de marcador',
  ].join('\n');
  const linhas = C.lerFolha(pre);
  checar(linhas.length === 5, 'uma linha de saída por linha de entrada', linhas.length);
  checar(linhas[0].tipo === 'acordes', 'a linha só de <b> é de acordes');
  checar(linhas[1].tipo === 'letra', 'a linha sem <b> é letra');
  checar(linhas[2].tipo === 'vazio', 'a linha em branco é vazio');
  checar(linhas[0].texto === 'C      G', 'o alinhamento sobrevive à remoção das tags', linhas[0].texto);
}
{
  // `<br>` convivendo com `\n` reais (armadilha 4). Tratar só um dos dois cola
  // a folha inteira numa linha ou a explode.
  const linhas = C.lerFolha('<b>C</b><br>linha um<br />linha dois\n<b>G</b>');
  checar(linhas.length === 4, '<br>, <br /> e \\n contam todos como quebra', linhas.map((l) => l.tipo));
  checar(linhas[3].tipo === 'acordes', 'e a última linha continua sendo lida');
}
{
  // A REDE: sem marcação nenhuma, decide o formato.
  const linhas = C.lerFolha('C       G\nlinha de marcador aqui');
  checar(linhas[0].tipo === 'acordes', 'sem <b>, a linha só de acordes ainda é reconhecida');
  checar(linhas[1].tipo === 'letra', 'e a linha de palavras continua sendo letra');
}
{
  // Linha MISTA: acorde inline no meio da letra. Reclassificá-la como acordes
  // apagaria a letra que ela carrega.
  const linhas = C.lerFolha('palavra <b>C</b> outra palavra');
  checar(linhas[0].tipo === 'letra', 'linha com <b> E texto fora dele é LETRA', linhas[0]);
}

// ── 6. A PÁGINA, e o "não entendi" que não pode virar vazio ─────────────────
secao('6. lerPagina');
{
  const html = '<h1>Titulo de Marcador</h1><h2>Artista de Marcador</h2>'
    + '<div>Tom: <a href="#">G</a></div>'
    + '<pre>curto</pre>'
    + '<pre><b>C</b>      <b>G</b>\nlinha de marcador\n</pre>';
  const p = C.lerPagina(html);
  checar(!!p, 'lê uma página bem formada');
  checar(p.titulo === 'Titulo de Marcador', 'o título sai do <h1>', p && p.titulo);
  checar(p.artista === 'Artista de Marcador', 'o artista sai do <h2>', p && p.artista);
  checar(p.tom === 'G', 'o tom é lido apesar da marcação no meio', p && p.tom);
  // O MAIOR <pre>, não o primeiro: uma página tem caixas de exemplo e rodapé.
  checar(p.linhas.some((l) => l.tipo === 'acordes'),
    'escolhe o MAIOR <pre>, não o primeiro', p && p.linhas);
}
checar(C.lerPagina('<h1>Só o título</h1><p>sem folha</p>') === null,
  'página SEM <pre> devolve null — "não entendi", que é diferente de "não tem"');
checar(C.lerPagina('<pre>   \n\n  </pre>') === null,
  'um <pre> só de espaço também é null, não uma folha vazia');
checar(C.lerPagina('') === null, 'HTML vazio devolve null');

// ── 7. SÓ A LETRA ───────────────────────────────────────────────────────────
secao('7. somenteLetra');
{
  const linhas = C.lerFolha([
    '<b>C</b>      <b>G</b>',
    'primeira de marcador',
    '',
    '<b>Am</b>',
    'segunda de marcador',
  ].join('\n'));
  const letra = C.somenteLetra(linhas);
  checar(letra.join('|') === 'primeira de marcador||segunda de marcador',
    'as linhas de acorde caem fora e o respiro entre estrofes sobrevive', letra);
  checar(!letra.some((l) => /^[A-G]/.test(l) && l.length <= 3), 'nenhum acorde solto sobrou');
}
{
  const letra = C.somenteLetra(C.lerFolha('\n\n<b>C</b>\n\n\nlinha\n\n\n'));
  checar(letra.join('|') === 'linha', 'vazios do começo e do fim são aparados', letra);
}

// ── 8. A BUSCA ──────────────────────────────────────────────────────────────
// Um resultado é um link de DOIS segmentos (`/artista/musica/`). É o filtro que
// separa música de navegação do site sem depender de classe CSS nenhuma.
secao('8. lerBusca');
{
  const html = [
    '<a href="/artista-de-marcador/musica-de-marcador/">Musica De Marcador</a>',
    '<a href="/categoria/">Uma categoria</a>',
    '<a href="/a/b/c/">Fundo demais</a>',
    '<a href="/artista-de-marcador/musica-de-marcador/">duplicata</a>',
    '<a href="https://outro.site/a/b/">absoluta</a>',
  ].join('');
  const r = C.lerBusca(html);
  checar(r.length === 1, 'só o link de dois segmentos entra, e sem duplicata', r);
  checar(r[0].url === 'https://www.cifraclub.com.br/artista-de-marcador/musica-de-marcador/',
    'o caminho relativo vira URL absoluta do site', r[0] && r[0].url);
  checar(r[0].artista === 'artista de marcador', 'o artista sai do primeiro segmento', r[0] && r[0].artista);
}
checar(C.lerBusca('').length === 0, 'HTML vazio devolve lista vazia');

// ── 9. A QUEBRA DO PAR ──────────────────────────────────────────────────────
// A regra que esta seção trava é UMA: acorde e letra são um PAR, e uma folha
// larga demais tem de sair quebrada nas DUAS linhas no MESMO ponto. O modo de
// errar é o que a v1.1.13 entregou — o CSS quebrando cada linha por conta
// própria, e a segunda metade do acorde caindo duas linhas abaixo da sílaba a
// que pertence. Ele não erra alto: a folha continua bonita, com os acordes
// sobre a letra errada.
//
// As entradas são SINTÉTICAS (nenhum conteúdo de terceiro entra neste
// repositório) e o que elas exercitam é geometria de texto, que é o que a regra
// de fato decide.
secao('9. quebrarPares');
{
  // Cada acorde está sobre uma coluna que a letra abaixo ocupa; é essa relação
  // que a quebra tem de preservar em cada metade.
  const A = 'C       G       Am      F       C       G';
  const L = 'aaaa    bbbb    cccc    dddd    eeee    ffff';
  const folha = [
    { tipo: 'acordes', texto: A },
    { tipo: 'letra', texto: L },
    { tipo: 'vazio', texto: '' },
  ];

  // A COLUNA DE CADA ACORDE, dentro da metade em que ele caiu: se as duas
  // linhas foram cortadas no mesmo índice, o acorde continua sobre a sílaba.
  // Comparar o texto inteiro não provaria isso — o corte pode estar certo e o
  // recuo errado, e é o recuo que desloca a coluna.
  const paresDe = (linhas) => {
    const out = [];
    for (let i = 0; i < linhas.length; i++) {
      if (linhas[i].tipo !== 'acordes') continue;
      const l = linhas[i + 1] && linhas[i + 1].tipo === 'letra' ? linhas[i + 1].texto : '';
      out.push([linhas[i].texto, l]);
    }
    return out;
  };

  for (const W of [24, 30, 40]) {
    const r = C.quebrarPares(folha, W);
    const larguraMax = Math.max(...r.map((x) => x.texto.length));
    checar(larguraMax <= W, 'nada passa de ' + W + ' colunas', larguraMax);

    // A ALTERNÂNCIA: acordes-letra, acordes-letra… Duas linhas de acordes
    // seguidas seriam exatamente o defeito que esta seção existe para pegar.
    const tipos = r.map((x) => x.tipo).filter((t) => t !== 'vazio');
    const alterna = tipos.every((t, i) => t === (i % 2 === 0 ? 'acordes' : 'letra'));
    checar(alterna, 'a saída alterna acordes/letra em ' + W + ' colunas', tipos);

    // O PAR PRESERVADO: em cada metade, cada acorde continua sobre as mesmas
    // letras que ele regia na folha inteira.
    const ok = paresDe(r).every(([a, l]) => {
      for (let c = 0; c < a.length; c++) {
        if (a[c] === ' ') continue;
        // A sílaba sob a coluna do acorde, na folha original e na fatia, tem de
        // ser a mesma — é isso, e só isso, que o alinhamento significa.
        if (l[c] === undefined) return c >= l.length; // acorde além do fim da letra: sem sílaba a reger
        if (l[c] === ' ') return false;
      }
      return true;
    });
    checar(ok, 'cada acorde continua sobre uma sílaba em ' + W + ' colunas', paresDe(r));

    checar(r.some((x) => x.tipo === 'vazio'), 'a linha vazia sobrevive em ' + W + ' colunas');
  }

  // A folha CABE: nada a fazer. Uma quebra "por precaução" aqui inventaria
  // linhas onde o site não tinha nenhuma.
  const cabe = C.quebrarPares(folha, 200);
  checar(cabe.length === folha.length, 'folha que cabe sai com o mesmo número de linhas', cabe.length);
  checar(cabe[0].texto === A.replace(/ +$/, ''), 'e com o texto intacto', cabe[0].texto);

  // MEDIDA INÚTIL = FOLHA INTACTA. Sem largura confiável (o popup ainda
  // fechado, a folha fora da árvore) o pior desfecho é uma rolagem lateral; o
  // outro seria a folha mentindo, quebrada num ponto tirado do nada.
  for (const ruim of [0, -5, NaN, undefined, 3]) {
    const r = C.quebrarPares(folha, ruim);
    checar(r.length === folha.length, 'colunas ' + String(ruim) + ' devolve a folha intacta', r.length);
  }

  // LINHA SOLTA — acordes sem letra abaixo (um intro), letra sem acordes acima
  // (um refrão já sabido). Ela quebra pelo mesmo caminho, com a outra metade
  // vazia, e não pode ganhar uma parceira em branco.
  const soltas = [
    { tipo: 'acordes', texto: 'C       G       Am      F       C       G' },
    { tipo: 'letra', texto: 'uma linha de letra bem comprida que nao cabe de jeito nenhum' },
  ];
  const rs = C.quebrarPares(soltas, 24);
  checar(rs.filter((x) => x.tipo === 'letra').length >= 2, 'a letra solta quebra', rs);
  checar(!rs.some((x, i) => x.tipo === 'acordes' && rs[i - 1] && rs[i - 1].tipo === 'acordes'
    && rs[i - 1].texto === ''), 'nenhuma metade vazia é inventada', rs);

  // O CORTE NÃO PARTE TOKEN. Um acorde cortado ao meio ("Am" → "A" + "m") vira
  // outro acorde — e um que soa. Uma palavra cortada só fica feia; o acorde
  // fica ERRADO, e é por isso que as duas linhas votam no ponto de corte.
  checar(C.pontoDeQuebra('C   Am  F', 'aa  bbb cc', 6) === 4,
    'o corte recua até não partir acorde nem palavra', C.pontoDeQuebra('C   Am  F', 'aa  bbb cc', 6));

  // Linha sem espaço nenhum: não há corte bom, e o corte feio é melhor que um
  // laço que não termina.
  checar(C.pontoDeQuebra('', 'aaaaaaaaaaaaaaaa', 8) === 8,
    'sem espaço nenhum, corta no limite', C.pontoDeQuebra('', 'aaaaaaaaaaaaaaaa', 8));

  // E O LAÇO TERMINA, que é a propriedade que um `for(;;)` precisa provar.
  const gigante = [
    { tipo: 'acordes', texto: 'C'.repeat(400) },
    { tipo: 'letra', texto: 'a'.repeat(400) },
  ];
  checar(C.quebrarPares(gigante, 8).length > 0, 'linha sem espaço nenhum termina', undefined);
}

// ── 10. A JANELA DA ROLAGEM AUTOMÁTICA ──────────────────────────────────────
// A folha rola no tempo da MÚSICA, e a tradução "onde a música está" → "onde a
// folha deve estar" é a regra que esta seção trava. Ela erra CALADA nos dois
// sentidos: uma abertura curta demais faz a folha fugir do começo antes de
// alguém lê-lo, e um fecho curto demais entrega o último acorde depois de ele
// ter passado — nos dois casos a rolagem continua funcionando, bonita e inútil.
secao('10. janelaDeRolagem / fracaoDaRolagem');
{
  // O CASO NORMAL: um hino de 4 min. Abertura e fecho batem nos TETOS, porque é
  // aí que a fração pura passaria do razoável.
  const j = C.janelaDeRolagem(240);
  checar(j.t0 === 12, 'a abertura bate no teto de 12 s num hino de 4 min', j.t0);
  checar(j.t1 === 240 - 25, 'e o fecho no teto de 25 s', j.t1);

  // UM HINO CURTO: os dois batem nos PISOS. É a metade que uma fração pura
  // erraria — 8% de 40 s são 3,2 s, que não dá tempo de ler o tom.
  const c = C.janelaDeRolagem(40);
  checar(c.t0 === 4, 'a abertura bate no piso de 4 s num hino de 40 s', c.t0);
  checar(c.t1 === 32, 'e o fecho no piso de 8 s', c.t1);

  // A JANELA É SEMPRE CRESCENTE. Num item curto demais para caber os dois, a
  // regra devolve a música INTEIRA — uma janela invertida (ou de meio segundo)
  // faria a folha saltar do topo ao fim num quadro só.
  for (const d of [0.5, 1, 5, 10, 12, 13, 20, 60, 600, 3600]) {
    const w = C.janelaDeRolagem(d);
    checar(w.t1 >= w.t0, 'a janela nunca inverte em ' + d + ' s', w);
    checar(w.t0 >= 0 && w.t1 <= d, 'e nunca sai da música em ' + d + ' s', w);
  }
  const nada = C.janelaDeRolagem(0);
  checar(nada.t0 === 0 && nada.t1 === 0, 'duração 0 devolve janela vazia', nada);

  // A FRAÇÃO: parada no começo, parada no fim, monótona no meio.
  const D = 240;
  checar(C.fracaoDaRolagem(0, D) === 0, 'no segundo 0 a folha está no topo');
  checar(C.fracaoDaRolagem(11, D) === 0, 'e ainda está no topo durante a abertura');
  checar(C.fracaoDaRolagem(215, D) === 1, 'no início do fecho a folha já está no fim');
  checar(C.fracaoDaRolagem(240, D) === 1, 'e continua no fim até a música acabar');
  checar(Math.abs(C.fracaoDaRolagem((12 + 215) / 2, D) - 0.5) < 1e-9,
    'no meio da janela a folha está na metade', C.fracaoDaRolagem((12 + 215) / 2, D));

  let anterior = -1;
  let monotona = true;
  for (let t = 0; t <= D; t += 0.5) {
    const f = C.fracaoDaRolagem(t, D);
    if (f < anterior - 1e-12) monotona = false;
    anterior = f;
  }
  checar(monotona, 'a folha nunca anda para trás com a música andando para a frente');

  // FORA DA FAIXA. `t` chega de um relógio que pode passar da duração por um
  // quadro, ou vir negativo no meio de um seek; uma fração fora de [0,1] viraria
  // um `scrollTop` fora da folha.
  for (const [t, d, esperado] of [[-10, D, 0], [1e6, D, 1], [NaN, D, 0], [10, 0, 0], [10, NaN, 0]]) {
    const f = C.fracaoDaRolagem(t, d);
    checar(f === esperado, 'fracaoDaRolagem(' + t + ', ' + d + ') = ' + esperado, f);
  }
}

// ── 11. A BUSCA ESCOLHE POR PARENTESCO, NÃO POR POSIÇÃO ─────────────────────
// O CASO MEDIDO num aparelho (Registro de 22/08): uma busca por "Em Oração"
// devolveu 27 resultados e o escolhido foi `/letra/A/` — o ÍNDICE ALFABÉTICO do
// site, que mora no cabeçalho e por isso aparece ANTES de qualquer resultado no
// HTML. Ele tem dois segmentos, tem texto, e a regra antiga pegava o primeiro
// que casasse com isso.
//
// A defesa não é a lista de rotas do site (ela muda quando o dono dele quiser):
// é EXIGIR PARENTESCO com o que se procurou. As duas metades são cobradas aqui.
secao('11. a busca escolhe por parentesco');
{
  // A ESTRUTURA: o índice alfabético cai antes de qualquer ranking.
  checar(!C.ehCaminhoDeMusica(['letra', 'A']), '/letra/A/ não é caminho de música');
  checar(!C.ehCaminhoDeMusica(['busca', 'em-oracao']), 'uma seção do site também não');
  checar(!C.ehCaminhoDeMusica(['artista-de-marcador']), 'um segmento só não é música');
  checar(!C.ehCaminhoDeMusica(['a', 'b', 'c']), 'três segmentos também não');
  checar(C.ehCaminhoDeMusica(['artista-de-marcador', 'musica-de-marcador']),
    'e o caminho de uma música de verdade passa');

  // O PARENTESCO, nos quatro graus. O zero é o que importa: ele é RECUSA, não
  // último lugar — sem ele, uma lista sem nenhum resultado bom devolve o
  // primeiro item da navegação com toda a confiança.
  checar(C.parentesco('Em Oração', 'Em Oração') === 3, 'o mesmo título vale 3');
  checar(C.parentesco('Em Oração (ao vivo)', 'Em Oração') === 2, 'um contendo o outro vale 2');
  checar(C.parentesco('Oração da Manhã', 'Em Oração') === 1, 'uma palavra forte em comum vale 1');
  checar(C.parentesco('A', 'Em Oração') === 0, 'o índice alfabético vale 0 — e 0 é RECUSA');
  checar(C.parentesco('Gospel', 'Em Oração') === 0, 'e uma seção de estilo também');
  // "Em" tem 2 letras e não conta: senão TODO título com "em" seria parente.
  checar(C.parentesco('Em Casa', 'Em Oração') === 0, 'palavra curta não cria parentesco');
  checar(C.parentesco('001. Santo, Santo, Santo', 'Santo Santo Santo') === 3,
    'número de faixa e pontuação não separam o que é o mesmo título');

  // A METADE DE PONTA A PONTA: o HTML de uma página de resultados com a
  // navegação do site vindo ANTES do resultado certo, que é a forma do defeito.
  const html = [
    '<a href="/letra/A/">A</a>',
    '<a href="/estilos/gospel/">Gospel</a>',
    '<a href="/outro-artista-marcador/outra-musica-marcador/">Outra Musica Marcador</a>',
    '<a href="/artista-de-marcador/em-oracao/">Em Oração</a>',
  ].join('');
  const achados = C.lerBusca(html);
  checar(!achados.some((x) => /\/letra\//.test(x.url)), 'o índice alfabético não entra na lista', achados);
  const ordenado = C.ordenarBusca(achados, 'Em Oração', 'Missão');
  checar(ordenado.length === 1, 'só o que tem parentesco sobrevive', ordenado);
  checar(ordenado[0] && /em-oracao/.test(ordenado[0].url),
    'e o escolhido é a música, não o primeiro link do documento', ordenado[0] && ordenado[0].url);

  // NADA COM PARENTESCO = LISTA VAZIA, e não "o primeiro que apareceu". Uma
  // busca que só devolve navegação tem de virar "não achei".
  const soNav = C.ordenarBusca(C.lerBusca('<a href="/letra/A/">A</a><a href="/estilos/gospel/">Gospel</a>'),
    'Em Oração', 'Missão');
  checar(soNav.length === 0, 'uma página só de navegação não devolve candidato nenhum', soNav);

  // O ÁLBUM DESEMPATA, e só isso. Ele não é o artista do site — filtrar por ele
  // derrubaria a música certa toda vez que os dois não coincidissem.
  const dois = C.lerBusca([
    '<a href="/outro-artista-marcador/em-oracao/">Em Oração</a>',
    '<a href="/missao-marcador/em-oracao/">Em Oração</a>',
  ].join(''));
  const ord2 = C.ordenarBusca(dois, 'Em Oração', 'Missão Marcador');
  checar(ord2.length === 2, 'os dois homônimos continuam na lista', ord2.length);
  checar(/missao-marcador/.test(ord2[0].url), 'e o do álbum que bate vem primeiro', ord2[0].url);

  // A CONSULTA com o álbum é a SEGUNDA, e existe.
  checar(C.urlDeBusca('Em Oração').endsWith('?q=Em%20Ora%C3%A7%C3%A3o'),
    'o primeiro tento leva só o nome', C.urlDeBusca('Em Oração'));
  checar(C.urlDeBusca('Em Oração', 'Missão').includes('Miss%C3%A3o'),
    'o segundo leva o álbum junto', C.urlDeBusca('Em Oração', 'Missão'));
  checar(C.urlDeBusca('Em Oração', '  ') === C.urlDeBusca('Em Oração'),
    'álbum em branco não muda a consulta');
}

console.log('\n' + (falhas.length ? falhas.length + ' FALHA(S)' : 'tudo certo'));
process.exit(falhas.length ? 1 : 0);
