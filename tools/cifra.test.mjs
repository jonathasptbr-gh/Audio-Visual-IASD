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
].forEach((t) => checar(C.pareceAcorde(t), 'aceita o acorde ' + t));
[
  'Deus', 'Cristo', 'Amor', 'Ele', 'Senhor', 'Bendito', 'Filho', 'Graca',
  'Glória', 'e', 'do', 'Aleluia',
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

console.log('\n' + (falhas.length ? falhas.length + ' FALHA(S)' : 'tudo certo'));
process.exit(falhas.length ? 1 : 0);
