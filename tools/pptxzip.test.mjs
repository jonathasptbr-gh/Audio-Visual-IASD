#!/usr/bin/env node
// ============================================================================
// O ZIP DE UM `.pptx` LIDO POR FATIAS (`controle/pptxzip.js`), em Node puro.
//
// ## Por que este oráculo existe
//
// Ele guarda o caminho que faz uma apresentação de 570 MB caber: ler o índice
// do zip sem materializar o arquivo, tirar os vídeos e remontar o resto. Os
// modos de errar aqui são todos SILENCIOSOS e todos caem na frente da
// congregação:
//
//  1. **O deslocamento dos dados.** O cabeçalho LOCAL tem campos de nome e
//     extra próprios, e quem deduz o início dos bytes pelo diretório central
//     entrega bytes DESLOCADOS — não um erro. Um vídeo assim não toca e um XML
//     assim não parseia, e nada aponta para cá.
//  2. **A ordem dos slides.** Deduzi-la dos NOMES (`slide1`, `slide2`, …) casa
//     com a ordem real quase sempre — e erra exatamente numa apresentação
//     REORDENADA, que é comum. O vídeo tocaria no slide errado, sem sintoma.
//  3. **A remontagem.** Um zip remontado com o bit do descritor de dados
//     copiado, ou com o CRC recalculado errado, é recusado pelo renderizador
//     com uma frase que não aponta para cá.
//
// Cada asserção de conteúdo vem com a REVERSÃO ao lado — o mesmo cenário pelo
// caminho ingênuo, provando que a pergunta tem dente.
//
//   node tools/pptxzip.test.mjs
// ============================================================================
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checar, falhas } from './checar.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(AQUI, '..', 'app', 'src', 'main', 'assets', 'web');

// O módulo é uma IIFE sobre `this` — o mesmo carregamento que o `deck.js` usa
// nos outros oráculos puros deste repositório.
const fonte = fs.readFileSync(path.join(WEB, 'controle', 'pptxzip.js'), 'utf8');
const global_ = { DecompressionStream, Blob, Response, TextDecoder, TextEncoder };
new Function(fonte).call(global_);
const Z = global_.AVPptxZip;

// ---------------------------------------------------------------------------
// UM ZIP DE VERDADE, montado aqui
//
// Escrito à mão de propósito: um zip produzido pela MESMA biblioteca que o lê
// prova só que ela concorda consigo mesma. Este escritor imita o que o
// PowerPoint faz e que mais dói — CAMPO EXTRA no cabeçalho local e ausente no
// diretório central, que é a armadilha nº 1 acima.
// ---------------------------------------------------------------------------
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function montarZip(itens, { extraLocal = 0 } = {}) {
  const partes = [];
  const central = [];
  let desloc = 0;
  for (const it of itens) {
    const cru = Buffer.from(it.dados);
    const deflacionar = it.metodo === 8;
    const dados = deflacionar ? zlib.deflateRawSync(cru) : cru;
    const nome = Buffer.from(it.nome, 'utf8');
    const extra = Buffer.alloc(extraLocal);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4);
    // O bit 3 (descritor de dados) vai LIGADO na origem de propósito: é ele que
    // a remontagem tem de zerar, e sem um caso assim a regra não é exercitada.
    h.writeUInt16LE(0x0808, 6);
    h.writeUInt16LE(it.metodo, 8);
    h.writeUInt32LE(crc32(cru), 14);
    h.writeUInt32LE(dados.length, 18); h.writeUInt32LE(cru.length, 22);
    h.writeUInt16LE(nome.length, 26); h.writeUInt16LE(extra.length, 28);
    partes.push(h, nome, extra, dados);

    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0x0808, 8); c.writeUInt16LE(it.metodo, 10);
    c.writeUInt32LE(crc32(cru), 16);
    c.writeUInt32LE(dados.length, 20); c.writeUInt32LE(cru.length, 24);
    c.writeUInt16LE(nome.length, 28); c.writeUInt16LE(0, 30); c.writeUInt16LE(0, 32);
    c.writeUInt32LE(desloc, 42);
    central.push(c, nome);
    desloc += h.length + nome.length + extra.length + dados.length;
  }
  const cen = Buffer.concat(central);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(itens.length, 8); fim.writeUInt16LE(itens.length, 10);
  fim.writeUInt32LE(cen.length, 12); fim.writeUInt32LE(desloc, 16);
  return Buffer.concat([...partes, cen, fim]);
}

// Uma apresentação de três slides em que a ORDEM DECLARADA está trocada: o
// `sldIdLst` diz 3, 1, 2. É o cenário da armadilha nº 2.
const APRESENTACAO = `<?xml version="1.0"?><p:presentation xmlns:p="p" xmlns:r="r"><p:sldIdLst>
  <p:sldId id="256" r:id="rId3"/><p:sldId id="257" r:id="rId1"/><p:sldId id="258" r:id="rId2"/>
</p:sldIdLst></p:presentation>`;
const RELS_APRES = `<?xml version="1.0"?><Relationships>
  <Relationship Id="rId1" Target="slides/slide1.xml"/>
  <Relationship Id="rId2" Target="slides/slide2.xml"/>
  <Relationship Id="rId3" Target="slides/slide3.xml"/>
</Relationships>`;
// O vídeo está no slide2.xml, que a ordem declarada põe em TERCEIRO (página 2).
const RELS_SLIDE2 = `<?xml version="1.0"?><Relationships>
  <Relationship Id="rId1" Type="http://…/image" Target="../media/image1.png"/>
  <Relationship Id="rId2" Type="http://…/video" Target="../media/media3.mp4"/>
</Relationships>`;
const RELS_SLIDE1 = `<?xml version="1.0"?><Relationships>
  <Relationship Id="rId1" Type="http://…/hyperlink" TargetMode="External" Target="https://exemplo/x.mp4"/>
</Relationships>`;
const RELS_SLIDE3 = `<?xml version="1.0"?><Relationships></Relationships>`;

const VIDEO = Buffer.alloc(4096);
for (let i = 0; i < VIDEO.length; i++) VIDEO[i] = (i * 7 + 13) & 0xff;

const ITENS = [
  { nome: '[Content_Types].xml', dados: '<Types/>', metodo: 8 },
  { nome: 'ppt/presentation.xml', dados: APRESENTACAO, metodo: 8 },
  { nome: 'ppt/_rels/presentation.xml.rels', dados: RELS_APRES, metodo: 8 },
  { nome: 'ppt/slides/slide1.xml', dados: '<sld/>', metodo: 8 },
  { nome: 'ppt/slides/slide2.xml', dados: '<sld/>', metodo: 8 },
  { nome: 'ppt/slides/slide3.xml', dados: '<sld/>', metodo: 8 },
  { nome: 'ppt/slides/_rels/slide1.xml.rels', dados: RELS_SLIDE1, metodo: 8 },
  { nome: 'ppt/slides/_rels/slide2.xml.rels', dados: RELS_SLIDE2, metodo: 8 },
  { nome: 'ppt/slides/_rels/slide3.xml.rels', dados: RELS_SLIDE3, metodo: 8 },
  { nome: 'ppt/media/image1.png', dados: 'PNG-de-mentira', metodo: 0 },
  // O vídeo é ARMAZENADO, como o PowerPoint faz: um mp4 já é comprimido.
  { nome: 'ppt/media/media3.mp4', dados: VIDEO, metodo: 0 },
];

const bytes = montarZip(ITENS, { extraLocal: 16 });
const blob = new Blob([bytes]);

console.log('::group::pptxzip');

// ---------------------------------------------------------------------------
// 1. O ÍNDICE
// ---------------------------------------------------------------------------
const dir = await Z.lerDiretorio(blob);
checar(dir.length === 11, 'lê as 11 entradas do índice', dir.length);
const vid = dir.find((e) => e.nome === 'ppt/media/media3.mp4');
checar(!!vid === true, 'acha o vídeo pelo nome', !!vid);
checar(vid && vid.cru === VIDEO.length, 'e o tamanho dele', vid && vid.cru);
checar(vid && vid.metodo === 0, 'o vídeo é ARMAZENADO (nada a descomprimir)', vid && vid.metodo);

// ---------------------------------------------------------------------------
// 2. O DESLOCAMENTO DOS DADOS — a armadilha nº 1
//
// O zip acima tem 16 bytes de campo extra NO CABEÇALHO LOCAL e nenhum no
// índice. Quem somar só os 30 bytes fixos + o nome lê 16 bytes adiantado.
// ---------------------------------------------------------------------------
const extraido = Buffer.from(await (await Z.extrair(blob, vid)).arrayBuffer());
checar(Buffer.compare(extraido, VIDEO) === 0, 'extrai o vídeo byte a byte', extraido.length);

const ingenuo = vid.offsetLocal + 30 + Buffer.byteLength('ppt/media/media3.mp4');
const real = await Z.inicioDosDados(blob, vid);
checar(real - ingenuo === 16, 'REVERSÃO: o caminho ingênuo erraria o início em 16 bytes', real - ingenuo);

const xml = await Z.extrairTexto(blob, dir.find((e) => e.nome === 'ppt/presentation.xml'));
checar(xml.indexOf('sldIdLst') > 0, 'descomprime o XML deflacionado', xml.slice(0, 60));

// ---------------------------------------------------------------------------
// 3. A ORDEM DOS SLIDES — a armadilha nº 2
// ---------------------------------------------------------------------------
const ordem = Z.ordemDosSlides(APRESENTACAO, RELS_APRES);
checar(ordem.join(',') === 'ppt/slides/slide3.xml,ppt/slides/slide1.xml,ppt/slides/slide2.xml',
  'a ordem sai do sldIdLst, não do nome', ordem.join(','));

const relsPorSlide = {
  'ppt/slides/_rels/slide1.xml.rels': RELS_SLIDE1,
  'ppt/slides/_rels/slide2.xml.rels': RELS_SLIDE2,
  'ppt/slides/_rels/slide3.xml.rels': RELS_SLIDE3,
};
const mapa = Z.videosPorPagina(ordem, relsPorSlide);
checar(mapa[2] === 'ppt/media/media3.mp4', 'o vídeo do slide2 cai na PÁGINA 2', mapa[2]);
checar(Object.keys(mapa).join(',') === '2', 'e em nenhuma outra', Object.keys(mapa).join(','));

const ordemIngenua = ['ppt/slides/slide1.xml', 'ppt/slides/slide2.xml', 'ppt/slides/slide3.xml'];
const mapaIngenuo = Z.videosPorPagina(ordemIngenua, relsPorSlide);
checar(mapaIngenuo[1] === 'ppt/media/media3.mp4', 'REVERSÃO: pela ordem dos NOMES ele cairia na página 1', mapaIngenuo[1]);

checar(mapa[0] === undefined, 'link externo .mp4 não conta como vídeo embutido', mapa[0]);
checar(Z.ehMidiaPesada('ppt/media/image1.png') === false, 'imagem não conta como mídia pesada', Z.ehMidiaPesada('ppt/media/image1.png'));
checar(Z.ehMidiaPesada('ppt/media/media3.mp4') === true, 'o mp4 conta', Z.ehMidiaPesada('ppt/media/media3.mp4'));
checar(Z.ehMidiaPesada('docProps/x.mp4') === false, 'mp4 fora de ppt/media não conta', Z.ehMidiaPesada('docProps/x.mp4'));

// ---------------------------------------------------------------------------
// 4. A REMONTAGEM
// ---------------------------------------------------------------------------
const mantidas = dir.filter((e) => !Z.ehMidiaPesada(e.nome));
const enxuto = await Z.remontar(blob, mantidas);
checar(mantidas.length === 10, 'o enxuto perdeu só o vídeo', mantidas.length);
checar(enxuto.size < blob.size - VIDEO.length, 'e encolheu de verdade', enxuto.size);

// A prova de que o zip novo é LEGÍVEL é relê-lo pelo mesmo leitor e conferir o
// conteúdo — um cabeçalho errado sobreviveria a uma conferência de tamanho.
const dir2 = await Z.lerDiretorio(enxuto);
checar(dir2.length === 10, 'o zip remontado é legível', dir2.length);
checar(dir2.some((e) => e.nome.endsWith('.mp4')) === false, 'o vídeo não está lá', dir2.some((e) => e.nome.endsWith('.mp4')));
const xml2 = await Z.extrairTexto(enxuto, dir2.find((e) => e.nome === 'ppt/presentation.xml'));
checar(xml2 === APRESENTACAO, 'e o XML sobreviveu intacto', xml2);
const png2 = await (await Z.extrair(enxuto, dir2.find((e) => e.nome === 'ppt/media/image1.png'))).text();
checar(png2 === 'PNG-de-mentira', 'a imagem armazenada sobreviveu', png2);

// O bit 3 (descritor de dados) da origem NÃO pode ter sido copiado: quem o
// copia manda o leitor procurar um descritor que não gravamos.
const b2 = Buffer.from(await enxuto.arrayBuffer());
const flags = b2.readUInt16LE(6);
checar((flags & 0x8) === 0, 'a remontagem zera o bit do descritor de dados', flags);
checar((flags & 0x800) !== 0, 'e mantém o bit de nome em UTF-8', flags);

// ---------------------------------------------------------------------------
// 5. AS FRASES DE RECUSA
// ---------------------------------------------------------------------------
async function frase(fn) { try { await fn(); return ''; } catch (e) { return e.message; } }
checar((await frase(() => Z.lerDiretorio(new Blob([Buffer.alloc(5000)])))).indexOf('não achei o fim') > 0 === true, 'arquivo que não é zip sai com frase', (await frase(() => Z.lerDiretorio(new Blob([Buffer.alloc(5000)])))).indexOf('não achei o fim') > 0);
checar((await frase(() => Z.lerDiretorio(new Blob([])))).indexOf('vazio') > 0 === true, 'arquivo vazio sai com frase', (await frase(() => Z.lerDiretorio(new Blob([])))).indexOf('vazio') > 0);

const comSenha = montarZip([{ nome: 'a.xml', dados: 'x', metodo: 8 }]);
const bs = Buffer.from(comSenha);
// liga o bit 0 (senha) no índice central
const pos = bs.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
bs.writeUInt16LE(bs.readUInt16LE(pos + 8) | 0x1, pos + 8);
checar((await frase(() => Z.lerDiretorio(new Blob([bs])))).indexOf('senha') > 0 === true, 'zip com senha sai com a frase da senha', (await frase(() => Z.lerDiretorio(new Blob([bs])))).indexOf('senha') > 0);

console.log('::endgroup::');
process.exit(falhas.length ? 1 : 0);
