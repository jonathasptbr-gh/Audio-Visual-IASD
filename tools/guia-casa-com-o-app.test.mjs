#!/usr/bin/env node
// ============================================================================
// O GUIA PÚBLICO CONCORDA COM O APP QUE EXISTE (2026-11-14)
//
// O guia de sonoplastia do site é a descrição do app que o operador lê ANTES de
// abrir o app, e ele não nasce do código: é escrito à mão, capítulo a capítulo.
// Em 2026-11-14 dois textos velhos foram achados porque nenhum oráculo comparava
// o guia com o app — "Editar mídia" mandava para Configurações (ele é a 7ª e
// última linha de FERRAMENTAS desde a v1.14.7) e o "Tour do app" era descrito
// como "refaz os tours". Nenhum dos dois quebra nada: o guia abre, o link
// funciona, e quem segue a instrução procura um botão numa seção que não o tem.
//
// O que este arquivo afirma, lendo os DOIS textos e nunca uma cópia deles:
//  A. A LISTA DE FERRAMENTAS, POR NOME: cada `nome:` de `FERRAMENTAS`
//     (`controle/controle.js`) aparece no texto do guia, e cada título de
//     ferramenta do guia (`<h4 id="i21-fer-…">` mais o capítulo do
//     `i21-editar`) é um nome que o app ainda tem. A comparação é de CONJUNTO:
//     uma ferramenta que troca de lugar nos dois lados continua certa.
//  B. "EDITAR MÍDIA" DIZ ONDE ELE ESTÁ: em Ferramentas, e não em Configurações;
//     e o guia e o app concordam que ele é a última linha da lista.
//  C. O "TOUR DO APP" É O QUADRADO no fim da grade de Configurações; o texto
//     não o descreve como "refaz os tours" nem "uma vez por tela".
// A leitura do `controle.js` é a FATIA da `const FERRAMENTAS` — o arquivo tem
// 47 mil linhas e o resto dele não decide nada daqui.
//
//   node tools/guia-casa-com-o-app.test.mjs
// ============================================================================
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checar, falhas } from './checar.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ler = (p) => readFileSync(join(RAIZ, p), 'utf8');
const CONTROLE = ler('app/src/main/assets/web/controle/controle.js');
const GUIA = ler('site/sonoplastia/index.html');
const INDEX = ler('app/src/main/assets/web/controle/index.html');

// Um trecho do guia entre duas âncoras; vazio quer dizer âncora que sumiu.
function entre(texto, de, ate) {
  const a = texto.indexOf(de);
  if (a < 0) return '';
  const b = texto.indexOf(ate, a);
  return b < 0 ? '' : texto.slice(a, b);
}
// A frase em volta do alvo, para a reprovação mostrar o texto que aconteceu.
const aoRedor = (texto, alvo) => {
  const a = texto.indexOf(alvo);
  return a < 0 ? '(não achei "' + alvo + '")' : texto.slice(Math.max(0, a - 60), a + 80).replace(/\s+/g, ' ');
};

// ============================================================================
// A · A LISTA DE FERRAMENTAS DO APP × OS TÍTULOS DE FERRAMENTA DO GUIA
// ============================================================================
const inicioFerr = CONTROLE.indexOf('const FERRAMENTAS = [');
const blocoFerr = inicioFerr < 0 ? '' : CONTROLE.slice(inicioFerr, CONTROLE.indexOf('\n];', inicioFerr));
const ferramentas = [...blocoFerr.matchAll(/nome:\s*'([^']+)'/g)].map((m) => m[1]);
// A seção de Ferramentas e o capítulo do Editar mídia são vizinhos na página,
// mas não no arquivo: o do Editar mídia vem depois de Slides, e é ali que o
// guia descreve a SÉTIMA ferramenta.
const secaoFerr = entre(GUIA, 'id="i21-ferramentas"', 'id="i21-documentos"');
// A ÂNCORA LEVA A TAG INTEIRA: `entre()` corta a partir do índice, e começar em
// `id="i21-editar"` deixava o `<h3 …>` de fora — o título do capítulo nunca
// casava e a sétima ferramenta nunca era conferida no sentido guia→app.
const secaoEditar = entre(GUIA, '<h3 id="i21-editar"', 'id="i21-leitura"');
const textoDasFerramentas = secaoFerr + secaoEditar;

checar(inicioFerr >= 0 && ferramentas.length >= 6,
  'A · a `const FERRAMENTAS` foi lida no `controle.js`',
  inicioFerr < 0 ? 'não achei "const FERRAMENTAS = ["' : ferramentas.length + ' nome(s): ' + ferramentas.join(' · '));
checar(secaoFerr.length > 2000, 'A · a seção de Ferramentas do guia foi lida', secaoFerr.length + ' caracteres');
checar(secaoEditar.length > 200, 'A · o capítulo do Editar mídia no guia foi lido', secaoEditar.length + ' caracteres');

// CADA FERRAMENTA DO APP TEM TEXTO NO GUIA.
for (const nome of ferramentas) {
  checar(textoDasFerramentas.includes(nome),
    'A · a ferramenta "' + nome + '" do app aparece no texto do guia',
    textoDasFerramentas.includes(nome) ? undefined : 'ausente das duas seções');
}

// E NENHUM TÍTULO DO GUIA É DE FERRAMENTA QUE SAIU DO APP. O título do
// Cronômetro e do Timer é um só ("Cronômetro e Timer"), e o do Editar mídia
// leva o subtítulo depois dos dois-pontos.
const nomesDoGuia = [
  ...[...secaoFerr.matchAll(/<h4 id="i21-fer-[^"]+">([^<]+)<\/h4>/g)].map((m) => m[1]),
  ...[...secaoEditar.matchAll(/<h3 id="i21-editar">([^<]+)<\/h3>/g)].map((m) => m[1].split(':')[0]),
].flatMap((t) => t.split(/\s+e\s+/)).map((t) => t.trim()).filter(Boolean);

checar(nomesDoGuia.length >= 6, 'A · os títulos de ferramenta do guia foram lidos', nomesDoGuia.join(' · '));
for (const nome of nomesDoGuia) {
  checar(ferramentas.includes(nome),
    'A · a ferramenta "' + nome + '" que o guia lista existe no app',
    ferramentas.includes(nome) ? undefined : 'o app tem: ' + ferramentas.join(' · '));
}

// ============================================================================
// B · ONDE FICA O "EDITAR MÍDIA"
//
// Ele era uma seção de Configurações até a v1.14.7 e passou a ser a última
// linha de Ferramentas porque não projeta nada: monta o item editado. O guia
// que ainda manda para Configurações manda procurar um botão que não está lá.
// ============================================================================
checar(secaoEditar.includes('Ferramentas'),
  'B · "Editar mídia" diz que está em Ferramentas', aoRedor(secaoEditar, 'mídia'));
checar(!secaoEditar.includes('Configurações'),
  'B · "Editar mídia" não manda mais para Configurações',
  aoRedor(secaoEditar, 'Configurações'));
checar(ferramentas[ferramentas.length - 1] === 'Editar mídia',
  'B · o app mantém "Editar mídia" como a última linha de FERRAMENTAS',
  'a última é "' + ferramentas[ferramentas.length - 1] + '"');
checar(secaoEditar.includes('última linha'),
  'B · e o guia diz que ele é a última linha de Ferramentas', aoRedor(secaoEditar, 'linha'));

// ============================================================================
// C · O "TOUR DO APP"
//
// É o quadrado no fim da grade de Configurações. "Refaz os tours" e "uma vez
// por tela" descrevem outro mecanismo: o botão de Configurações refaz o tour do
// estado atual, e ninguém "refaz os tours" de todas as seções de uma vez.
// ============================================================================
const inicioTour = GUIA.indexOf('<li><b>Tour do app</b>');
const linhaTour = inicioTour < 0 ? '' : GUIA.slice(inicioTour, GUIA.indexOf('</li>', inicioTour) + 5);
checar(linhaTour.length > 0, 'C · a linha do "Tour do app" no guia foi encontrada',
  inicioTour < 0 ? 'não achei "<li><b>Tour do app</b>"' : undefined);
checar(linhaTour.includes('quadrado') && linhaTour.includes('Configurações'),
  'C · o "Tour do app" é o quadrado no fim da grade de Configurações', linhaTour);
checar(!linhaTour.includes('refaz os tours') && !linhaTour.includes('uma vez por tela'),
  'C · o "Tour do app" não é descrito como "refaz os tours" nem "uma vez por tela"', linhaTour);

// O GUIA DIZ ONDE ELE ESTÁ; O APP TEM DE CONCORDAR. Sem esta metade, renomear
// ou mover o quadrado deixava o guia certo sobre um botão que não existe mais.
const gradeIdx = entre(INDEX, '<div class="qs-grade">', '</div>');
const tiles = [...gradeIdx.matchAll(/<button[^>]*class="([^"]*)"[^>]*id="([^"]+)"/g)]
  .map((m) => ({ classes: m[1], id: m[2] }))
  .filter((t) => t.classes.split(/\s+/).includes('qs-tile'));
const ultimo = tiles.length ? tiles[tiles.length - 1].id : null;
checar(tiles.length >= 8, 'C · a grade de Configurações do app tem os oito quadrados', tiles.length + ' quadrado(s): ' + tiles.map((t) => t.id).join(' · '));
checar(ultimo === 'tourBtn', 'C · o "Tour do app" é o ÚLTIMO quadrado da grade, no app', 'último: ' + ultimo);
checar(!/<input[^>]*id="tourBtn"|song-menu-check[^>]*id="tourBtn"/.test(INDEX),
  'C · o "Tour do app" não é uma caixa de marcação no HTML', 'achado o padrão de caixa');

console.log(falhas.length ? '\n' + falhas.length + ' falha(s)' : '\ntudo certo');
process.exit(falhas.length ? 1 : 0);
