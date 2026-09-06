#!/usr/bin/env node
// ============================================================================
// O FORMATO DO PACOTE DE TRANSFERÊNCIA (`controle/pacote.js`), em Node puro.
//
// ## Por que este oráculo existe
//
// O pacote é o ÚNICO arquivo que este app produz para ser lido de volta por
// outra instalação, e os três modos de errar dele não dão erro em lugar nenhum:
//
//  1. **O pacote truncado que importa em silêncio.** Sem o registro `fim`
//     obrigatório, um arquivo cortado no meio (cartão cheio, app fechado)
//     entra como se estivesse inteiro — e o operador descobre no sábado que o
//     hinário tem 200 dos 600 hinos. O tamanho do arquivo NÃO responde isso:
//     ele é o que ele é.
//  2. **O cursor que anda o passo errado.** Um `bytes` ausente num cabeçalho
//     faz o leitor parar no meio de um corpo e ler bytes de mídia como se
//     fossem o próximo cabeçalho — e o que sai é "registro de tipo
//     desconhecido" apontando para um pacote que está perfeito.
//  3. **O saneamento que deixa passar o que é DAQUELE aparelho.** Um `stream`
//     que atravessa é um manifesto do googlevideo expirado com tokens de um
//     proxy que só existe na origem: a cena não toca no destino, e o motivo
//     está a um aparelho de distância.
//
// E uma quarta, que é a promessa do recurso: **a mescla nunca pode perder o
// que já está no aparelho.** Ela é medida aqui pela PROPRIEDADE, não por casos
// — para todo par (local, vindo), o que era local continua alcançável.
//
//   node tools/pacote.test.mjs
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checar, falhas } from './checar.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(AQUI, '..', 'app', 'src', 'main', 'assets', 'web');

// A IIFE sobre `this`, como nos outros oráculos puros deste repositório.
const fonte = fs.readFileSync(path.join(WEB, 'controle', 'pacote.js'), 'utf8');
const global_ = { TextEncoder, TextDecoder, Blob };
new Function(fonte).call(global_);
const P = global_.AVPacote;

checar(!!P, 'o módulo publica `AVPacote`');

// ---------------------------------------------------------------------------
// 1. A ASSINATURA — ela é a IDENTIDADE do arquivo, não a extensão
// ---------------------------------------------------------------------------
//
// Um provedor de documentos do Android pode trocar o `.avpkg` por `.bin` ao
// criar o arquivo (o MIME que o `CreateDocument` recebe é
// `application/octet-stream`, cuja extensão canônica é `.bin`). Se a
// importação dependesse do nome, o pacote deixaria de abrir em alguns
// aparelhos e não em outros — a pior forma de um recurso falhar.
{
  const a = P.assinatura();
  checar(a.length === P.ASSINATURA_BYTES, 'a assinatura tem o tamanho declarado', a.length);
  const bom = P.conferirAssinatura(a);
  checar(bom.ok === true && bom.versao === P.VERSAO, 'ela se reconhece', bom);

  const outro = new Uint8Array(P.ASSINATURA_BYTES);
  outro.set([0x50, 0x4b, 0x03, 0x04], 0);   // um zip qualquer
  const r = P.conferirAssinatura(outro);
  checar(r.ok === false, 'um arquivo que não é pacote é recusado');
  // AS DUAS RECUSAS SÃO FRASES DIFERENTES, e não um booleano: elas pedem ações
  // opostas — uma manda conferir qual arquivo foi escolhido, a outra manda
  // atualizar o app. Um `false` para as duas deixaria a tela adivinhando.
  const futuro = P.assinatura();
  new DataView(futuro.buffer).setUint16(6, P.VERSAO + 1, true);
  const rf = P.conferirAssinatura(futuro);
  checar(rf.ok === false, 'um pacote de uma versão mais nova é recusado');
  checar(rf.erro !== r.erro, 'e a FRASE é outra — as duas recusas pedem ações diferentes',
    { naoEhPacote: r.erro, versaoNova: rf.erro });
  // A REVERSÃO: uma versão MENOR (um pacote antigo) continua entrando. Sem
  // esta, uma comparação `!==` passaria nas asserções acima e trancaria o app
  // fora dos próprios pacotes de ontem.
  const antigo = P.assinatura();
  new DataView(antigo.buffer).setUint16(6, 0, true);
  checar(P.conferirAssinatura(antigo).ok === true, 'e um pacote de versão ANTERIOR continua entrando');

  checar(P.conferirAssinatura(new Uint8Array(3)).ok === false,
    'um arquivo menor que a assinatura não estoura — é recusado');
}

// ---------------------------------------------------------------------------
// 2. A IDA E VOLTA DE UM REGISTRO — e o CURSOR andando o passo certo
// ---------------------------------------------------------------------------
//
// Este é o bloco que trava a armadilha nº 2. Ele escreve TRÊS registros em
// sequência, com corpos de tamanhos diferentes, e caminha por eles como o
// importador caminha — só pelos números do formato, sem saber onde cada um
// começa.
{
  const enc = new TextEncoder();
  const partes = [];
  const escrever = (cab, corpo) => {
    partes.push(P.cabecalhoParaBytes(Object.assign({}, cab, { bytes: corpo ? corpo.length : 0 })));
    if (corpo) partes.push(corpo);
  };
  escrever({ t: 'info' }, enc.encode('{"app":"audio-visual-iasd"}'));
  escrever({ t: 'opfs', caminho: 'folders/hinario/001.m4a' }, new Uint8Array([1, 2, 3, 4, 5]));
  escrever({ t: 'state', chave: 'fit' }, enc.encode('"cover"'));
  escrever({ t: 'fim' }, null);

  let n = 0;
  for (const p of partes) n += p.length;
  const arq = new Uint8Array(n);
  let o = 0;
  for (const p of partes) { arq.set(p, o); o += p.length; }

  const lidos = [];
  let pos = 0;
  for (let guarda = 0; guarda < 50 && pos < arq.length; guarda++) {
    const tam = P.tamanhoDoCabecalho(arq.subarray(pos, pos + P.PREFIXO_BYTES));
    const ini = pos + P.PREFIXO_BYTES;
    const cab = P.cabecalhoDeBytes(arq.subarray(ini, ini + tam));
    lidos.push({ t: cab.t, corpo: Array.from(arq.subarray(ini + tam, ini + tam + cab.bytes)) });
    pos = ini + tam + cab.bytes;
  }
  checar(pos === arq.length, 'o cursor chega EXATAMENTE ao fim do arquivo', { pos, tamanho: arq.length });
  checar(lidos.length === 4 && lidos[3].t === 'fim', 'e lê os quatro registros, terminando no `fim`',
    lidos.map((x) => x.t).join(','));
  checar(String(lidos[1].corpo) === '1,2,3,4,5', 'o corpo de um registro volta byte a byte', lidos[1].corpo);
  // O CORPO DE TAMANHO ZERO NÃO É UM CASO À PARTE, e é ele que mais erra: um
  // `bytes` ausente no `fim` faria o cursor pular o número errado e parar
  // dentro do nada.
  checar(lidos[3].corpo.length === 0, 'e um registro SEM corpo não consome byte nenhum');
}

// ---------------------------------------------------------------------------
// 3. AS RECUSAS DO LEITOR — um arquivo de fora nunca cai num `default`
// ---------------------------------------------------------------------------
{
  const enc = new TextEncoder();
  const lanca = (fn) => { try { fn(); return false; } catch (_) { return true; } };

  checar(lanca(() => P.cabecalhoDeBytes(enc.encode('não é json'))),
    'um cabeçalho ilegível é recusado com exceção, nunca com um objeto vazio');
  checar(lanca(() => P.cabecalhoDeBytes(enc.encode('{"t":"inventado","bytes":0}'))),
    'um TIPO desconhecido é recusado — a lista é de PERMISSÃO, porque o arquivo vem de fora');
  checar(lanca(() => P.cabecalhoDeBytes(enc.encode('{"t":"opfs"}'))),
    'um cabeçalho SEM `bytes` é recusado: é ele que diz ao cursor quanto pular');
  checar(lanca(() => P.cabecalhoDeBytes(enc.encode('{"t":"opfs","bytes":-1}'))),
    'e um `bytes` negativo também — ele faria o cursor ANDAR PARA TRÁS, num laço infinito');
  checar(lanca(() => P.cabecalhoDeBytes(enc.encode('[1,2,3]'))),
    'um JSON que não é objeto é recusado');

  // O TETO EXISTE CONTRA UM ARQUIVO CORROMPIDO, e não contra malícia: um u32
  // que diga "leia 3 GB de JSON" faria o importador tentar materializar isso e
  // matar o processo — com a projeção junto, porque os dois WebViews e a
  // Presentation dividem um.
  const grande = new Uint8Array(4);
  new DataView(grande.buffer).setUint32(0, 0x7fffffff, true);
  checar(lanca(() => P.tamanhoDoCabecalho(grande)), 'um tamanho de cabeçalho absurdo é recusado');
  const zero = new Uint8Array(4);
  checar(lanca(() => P.tamanhoDoCabecalho(zero)), 'e um tamanho ZERO também — não existe cabeçalho vazio');
  checar(lanca(() => P.tamanhoDoCabecalho(new Uint8Array(2))),
    'e um arquivo que acaba no meio do prefixo estoura com frase, em vez de ler lixo');
}

// ---------------------------------------------------------------------------
// 4. O SANEAMENTO — o que é DAQUELE aparelho não atravessa
// ---------------------------------------------------------------------------
{
  const rec = {
    id: 'abc', name: 'Louvor', kind: 'video', type: 'video/mp4',
    blob: { size: 10 }, thumb: { size: 2 }, pages: [{ size: 1 }],
    stream: { video: { url: 'https://appassets.androidplatform.net/stream/xyz' } },
    youtubeId: 'aaa', lyrics: [{ time: 0, text: 'a' }], createdAt: 1,
  };
  const s = P.sanearMedia(rec);
  checar(!('blob' in s) && !('thumb' in s) && !('pages' in s),
    'os campos que carregam BYTES saem do cabeçalho — eles viajam como corpo de registros próprios',
    Object.keys(s).join(','));
  // A ARMADILHA QUE ESTE CAMPO É: um `stream` que atravessa chega ao destino
  // como um manifesto do googlevideo expirado, com tokens de um `StreamProxy`
  // que só existe na origem — a cena não toca, e nada aponta para cá. Sem o
  // campo, o item é o LINK que ele sempre foi, resolvido no primeiro toque.
  checar(!('stream' in s), 'e o `stream` também sai: ele é de outro aparelho E de outra hora');
  checar(s.id === 'abc' && s.youtubeId === 'aaa' && Array.isArray(s.lyrics),
    'e TUDO o mais atravessa — inclusive a letra, que é o que faz a faixa valer no destino');
  checar(rec.blob && rec.stream, 'o registro ORIGINAL não é tocado (o saneamento devolve uma cópia)');

  const arq = P.sanearArquivo({ id: 'f1', opfsPath: 'folders/x/1.m4a', thumb: { size: 3 }, blob: null });
  checar(!('thumb' in arq) && arq.blob === null && arq.opfsPath === 'folders/x/1.m4a',
    'o registro do catálogo OPFS segue a mesma regra', Object.keys(arq).join(','));
}

// ---------------------------------------------------------------------------
// 5. AS CHAVES QUE NÃO VIAJAM — cada uma faz o destino AGIR ou MENTIR
// ---------------------------------------------------------------------------
{
  checar(P.chaveViaja('fit') && P.chaveViaja('cifras:hymnal-2022') && P.chaveViaja('imports'),
    'as preferências e os catálogos atravessam');
  for (const [chave, porque] of [
    ['ota-intencao', 'reabriria o instalador do APK no aparelho de destino'],
    ['yt-intencoes', 'faria o destino reclamar downloads que nunca começaram nele'],
    ['opfs-folders', 'guarda concessões do SAF que não existem no outro aparelho'],
    ['current', 'trocaria a projeção de quem importa'],
    ['historico', 'misturaria dois cultos num diário só'],
  ]) {
    checar(!P.chaveViaja(chave), 'e `' + chave + '` NÃO atravessa: ' + porque);
  }
  checar(!P.chaveViaja('') && !P.chaveViaja(null), 'uma chave vazia ou ausente não atravessa');
}

// ---------------------------------------------------------------------------
// 6. AS PASTAS DO APARELHO — o corte que o CAMINHO sozinho não sabe fazer
// ---------------------------------------------------------------------------
//
// O OPFS guarda as duas coisas na MESMA prateleira: `folders/<id>/` é tanto uma
// coleção baixada do acervo quanto uma pasta sincronizada do celular. Quem as
// separa é a lista `opfs-folders` — e é por isso que o filtro é uma função
// construída a partir dela, e não um teste de prefixo escrito à mão.
{
  const viaja = P.pastasDoAparelho([{ id: 'pasta-do-celular', name: 'Vídeos' }]);
  checar(viaja('folders/hymnal-2022/001.m4a'),
    'a coleção baixada do acervo VIAJA — ela é o ponto do recurso');
  checar(!viaja('folders/pasta-do-celular/culto.mp4'),
    'e a pasta do APARELHO não: ela é a cópia de arquivos que vivem no outro celular');
  checar(viaja('folders/pasta-do-celular-2/x.mp4'),
    'o corte é pelo SEGMENTO inteiro, nunca por prefixo de texto — senão uma pasta '
    + 'cujo id COMEÇA com o de outra sairia junto');
  checar(P.pastasDoAparelho(null)('folders/x/1.m4a') && P.pastasDoAparelho([])('folders/x/1.m4a'),
    'sem pasta nenhuma cadastrada, tudo viaja');
}

// ---------------------------------------------------------------------------
// 7. O NOME SUGERIDO carrega a DATA
// ---------------------------------------------------------------------------
//
// Mesma razão do arquivo do Registro: o valor de um pacote é comparar dois, e
// dois arquivos com o mesmo nome viram "acervo (1).avpkg" na pasta — uma semana
// depois ninguém sabe qual é qual.
{
  const n = P.nomeDoArquivo(new Date(2026, 8, 5, 9, 7));
  checar(n === 'acervo-av-20260905-0907.avpkg', 'o nome traz a data e a hora, com zero à esquerda', n);
  checar(P.nomeDoArquivo().endsWith('.avpkg'), 'e sem argumento ele usa o relógio de agora');
}

// ---------------------------------------------------------------------------
// 8. O GRUPO DE UM CAMINHO (v1.7.2) — a folha de escolha da exportação
// ---------------------------------------------------------------------------
//
// A relação entre o OPFS e as coleções é uma CONVENÇÃO DE CAMINHO
// (`folders/<id>/…`), não um campo, e é por isso que a regra é pura e mora
// aqui: ela é o que erra quando a convenção muda.
//
// O QUE ELA NÃO PODE FAZER é deixar um arquivo sem grupo. Um caminho que não
// caia em lugar nenhum sai do pacote SEM APARECER em lista nenhuma — nem na
// folha, nem no arquivo —, que é o silêncio que a varredura do DISCO (contra a
// do catálogo) já teve de consertar uma vez neste recurso.
{
  const cols = new Set(['hymnal-2022', 'album-um']);
  checar(P.grupoDoCaminho('folders/hymnal-2022/001.m4a', cols) === 'col:hymnal-2022',
    'um arquivo sob a pasta de uma coleção CONHECIDA vai para o grupo dela');
  checar(P.grupoDoCaminho('folders/album-um/a/b/c.jpg', cols) === 'col:album-um',
    'e a profundidade não importa: quem decide é o SEGUNDO segmento');
  // ESTE É O PAR QUE IMPEDE O SILÊNCIO. Uma coleção que saiu do catálogo (o
  // operador removeu o álbum, o banco deixou de listá-lo) continua com bytes no
  // disco, e eles TÊM de ter para onde ir.
  checar(P.grupoDoCaminho('folders/album-que-sumiu/x.m4a', cols) === 'outros',
    'uma coleção que saiu do catálogo cai em "outros" — nunca em lugar nenhum');
  checar(P.grupoDoCaminho('avulsos/x.jpg', cols) === 'outros',
    'e o que nem está sob `folders/` também');
  checar(P.grupoDoCaminho('folders', cols) === 'outros'
    && P.grupoDoCaminho('', cols) === 'outros'
    && P.grupoDoCaminho(null, cols) === 'outros',
    'caminho degenerado cai em "outros" em vez de inventar um grupo');
  // SEM CATÁLOGO, TUDO É "OUTROS", e isso é escolha: um grupo com id cru na
  // folha ("col:album-3f2a") não diz nada a quem escolhe o que levar.
  checar(P.grupoDoCaminho('folders/hymnal-2022/001.m4a', new Set()) === 'outros'
    && P.grupoDoCaminho('folders/hymnal-2022/001.m4a', null) === 'outros',
    'sem conjunto de coleções nada ganha nome próprio — e nada se perde');

  checar(P.colecaoDoGrupo('col:hymnal-2022') === 'hymnal-2022',
    'a volta devolve o id da coleção');
  checar(P.colecaoDoGrupo('outros') === '' && P.colecaoDoGrupo('ajustes') === ''
    && P.colecaoDoGrupo('') === '',
    'e vazio para os grupos que não são coleção');
}

falhas.length ? (console.log('\n' + falhas.length + ' falha(s).'), process.exit(1))
  : console.log('\nTodos passaram.');
