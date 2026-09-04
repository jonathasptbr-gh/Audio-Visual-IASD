// A conta da BIBLIOTECA: "esta coleção está completa?" e "quanto ela ocupa?".
//
// ## Por que ele existe
//
// As duas perguntas eram respondidas por contas diferentes em lugares
// diferentes da MESMA TELA, e as respostas divergiam:
//
//   - "completa" era `countDownloaded(id) >= collSongs(id).length` — uma conta
//     de MÚSICAS —, enquanto o download busca VARIANTES (Cantado + Playback) e
//     a barra de peso já media variantes. Um Playback faltando deixava o card
//     com o botão de baixar ao lado de um chip dizendo "Completo offline".
//   - uma música cuja ORIGEM não tem áudio nunca ganhava id de arquivo, então
//     a coleção nunca ficava completa: o botão de baixar não sumia mais, e cada
//     sincronização voltava a buscar o metadado dela para redescobrir que não
//     há o que baixar.
//   - o peso somava o CATÁLOGO, e as imagens de fundo da letra vão para a mesma
//     pasta sem virar registro: centenas de MB fora de toda conta.
//
// Nenhum desses é erro de sintaxe, e nenhum aparece num `node --check`. São
// contas — e conta errada é exatamente o que um teste prende.
//
//   node tools/acervo.test.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, checar, falhas } from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');

const servidor = servirEstatico(RAIZ);

await new Promise((r) => servidor.listen(0, r));
const porta = servidor.address().port;
const navegador = await abrirNavegador();
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);
const pg = await ctx.newPage();

try {
  await pg.goto(`http://localhost:${porta}/controle/`, { waitUntil: 'domcontentloaded' });
  // O SINAL DE BOOT É O FORTE, e a diferença NÃO é de prazo — é de FATO.
  //
  // `AVDB && __avBack` só prova que o `controle.js` foi PARSEADO. O `init()` é
  // assíncrono e começa por `loadCollections()`, que faz **`collState = {}`** —
  // uma substituição inteira. Com o sinal fraco, este oráculo plantava a
  // fixture ANTES disso e o `loadCollections` a APAGAVA no meio do percurso.
  //
  // MEDIDO (com `Emulation.setCPUThrottlingRate`, que é o runner de 4 vCPU sob
  // carga): a 60× o `collState` tinha só a fixture no sinal fraco, e depois do
  // `init()` ela sumia — exatamente a reprovação que apareceu no CI, e só na
  // linha do GRUPO.
  //
  // E SÓ NA LINHA DO GRUPO porque as outras três esperam `false`: um
  // `collState` vazio as satisfaz VACUAMENTE. Uma reprovação visível e três
  // aprovações pelo motivo errado — é isso que um sinal de boot fraco produz
  // aqui, e é por isso que o conserto não é somar prazo.
  //
  // O `<li>` da playlist é a mesma condição que o watchdog do OTA usa para
  // dizer "a inicialização terminou" (o HTML entrega o `<ul>` vazio; quem o
  // preenche é o `renderPlaylist()`, dentro do `init()`), e é a que o
  // `leitor-biblioteca` e o `cifra-offline` já esperam.
  await pg.waitForFunction(
    () => window.AVDB && typeof window.__avBack === 'function'
      && !!document.querySelector('#playlist li'),
    null, { timeout: 30000 },
  );

  // ---- "esta coleção está completa?" ----------------------------------------
  // As músicas entram direto no `collState`, que é a mesma estrutura que o
  // `fetchCollectionIndex` preenche — o teste exercita a conta, não a rede.
  const r = await pg.evaluate(() => {
    collState.tudo = { songs: [
      { id_music: 1, name: 'a', fileIdFull: 'fa' },
      { id_music: 2, name: 'b', fileIdFull: 'fb', has_instrumental_music: true, fileIdPlayback: 'pb' },
    ] };
    collState.semPb = { songs: [
      { id_music: 1, name: 'a', fileIdFull: 'fa' },
      // Playback declarado na origem e AINDA NÃO baixado: a conta de músicas
      // dizia "completa", a de variantes diz que falta uma.
      { id_music: 2, name: 'b', fileIdFull: 'fb', has_instrumental_music: true },
    ] };
    collState.semFonte = { songs: [
      { id_music: 1, name: 'a', fileIdFull: 'fa' },
      // A origem NÃO TEM o áudio desta. Ela nunca vai virar arquivo.
      { id_music: 2, name: 'b', semAudio: true },
    ] };
    collState.vazia = { songs: [] };
    const q = (id) => ({
      completa: colecaoCompleta(id), falta: faltamNaColecao(id),
      baixaveis: songsBaixaveis(id).length,
    });
    return { tudo: q('tudo'), semPb: q('semPb'), semFonte: q('semFonte'), vazia: q('vazia') };
  });

  checar(r.tudo.completa && r.tudo.falta === 0, 'tudo baixado (com o Playback): completa');
  checar(!r.semPb.completa && r.semPb.falta === 1,
    'Playback declarado e ausente: NÃO é completa — a conta é de VARIANTES, não de músicas',
    JSON.stringify(r.semPb));
  checar(r.semFonte.completa && r.semFonte.falta === 0,
    'música sem áudio na origem: completa mesmo assim — "não existe" ≠ "não baixei"',
    JSON.stringify(r.semFonte));
  checar(r.semFonte.baixaveis === 1,
    'e ela sai do DENOMINADOR: o contador chega ao fim em vez de travar em 1/2',
    r.semFonte.baixaveis);
  checar(!r.vazia.completa,
    'sem índice não é completa — o botão ali serve para buscar a lista');

  // ---- e a mesma pergunta para um GRUPO ------------------------------------
  // O botão do cabeçalho de categoria ("CDs do ano") era desenhado SEMPRE — a
  // regra da barra do card nunca chegou até ele. Tocá-lo percorria álbum por
  // álbum, cada um buscando o índice na rede e conferindo variante por
  // variante, para terminar em "completo" e deixar o mesmo botão ali.
  const gr = await pg.evaluate(() => ({
    todosCompletos: grupoCompleto([{ id: 'tudo' }, { id: 'semFonte' }]),
    umIncompleto: grupoCompleto([{ id: 'tudo' }, { id: 'semPb' }]),
    // Um álbum SEM ÍNDICE mantém o grupo incompleto: pela contagem de
    // pendentes ele soma zero (não tem lista), e era assim que "Baixar toda a
    // biblioteca" respondia "Já completo" sem fazer nada.
    umSemIndice: grupoCompleto([{ id: 'tudo' }, { id: 'vazia' }]),
    vazio: grupoCompleto([]),
  }));
  checar(gr.todosCompletos, 'grupo com todas as coleções completas: completo');
  checar(!gr.umIncompleto, 'uma coleção incompleta basta para o grupo não estar');
  checar(!gr.umSemIndice,
    'e um álbum SEM ÍNDICE também — "nada pendente" não é "já completo"');
  checar(!gr.vazio, 'grupo vazio não é completo');

  // ---- "quanto ela ocupa?" -------------------------------------------------
  // O caso inteiro num teste: um arquivo que NÃO é registro do catálogo (uma
  // imagem de fundo de letra) na mesma pasta de um que é.
  const peso = await pg.evaluate(async () => {
    const bin = (n) => new Blob([new Uint8Array(n)]);
    await AVDB.opfsWriteFile('folders/pesoTeste/1-full.mp3', bin(1000));
    await AVDB.opfsWriteFile('folders/pesoTeste/1-img-0.jpg', bin(500));
    return AVDB.opfsFolderSize('folders/pesoTeste');
  });
  checar(peso === 1500,
    'o peso mede o DISCO: a imagem de fundo da letra conta, mesmo sem registro no catálogo',
    peso);

  const semPasta = await pg.evaluate(() => AVDB.opfsFolderSize('folders/naoExiste'));
  checar(semPasta === 0, 'pasta inexistente: 0, sem estourar', semPasta);

  // ---- e SEM O "~" (v5.265) ------------------------------------------------
  // Pedido do operador: tirar o símbolo de aproximado das contagens de peso da
  // Biblioteca. O total continua sendo uma ESTIMATIVA (por duração × a taxa
  // medida no aparelho) — o que sai é o símbolo que a anunciava, e `fmtBytes` já
  // arredonda para uma casa, então o número nunca prometeu precisão de byte.
  //
  // As duas metades, e a segunda é a que impede a correção de virar uma
  // subtração: o "~" some **e o par de números continua lá**. Era ele que
  // respondia "quanto já tenho / quanto vai custar" numa leitura só.
  const par = await pg.evaluate(() => ({
    parcial: fmtFracBytes(3.7 * 1048576, 18 * 1048576),
    unidades: fmtFracBytes(800 * 1024, 1.2 * 1073741824),
  }));
  checar(!/~/.test(par.parcial) && !/~/.test(par.unidades),
    'nenhuma contagem de peso da Biblioteca traz o "~" de estimativa',
    par.parcial + ' · ' + par.unidades);
  checar(/^3,7\/18 MB$/.test(par.parcial),
    'e o PAR continua: "já tenho / vai custar" numa leitura só, com a unidade '
    + 'uma vez quando ela é a mesma nos dois', par.parcial);
  checar(/^800 KB\/1,2 GB$/.test(par.unidades),
    'e as duas unidades ficam quando divergem — omitir a primeira seria falso',
    par.unidades);

  // ---- O ÁLBUM DA CAPA CHEGA À BIBLIOTECA QUE JÁ EXISTE (v5.220) ----------
  //
  // A v5.219 escrevia `hymnAlbum` no download e na varredura da sincronização —
  // os dois pontos certos, e os dois inúteis para o caso real: a música do
  // operador já está baixada, e coleção completa não é re-sincronizada. O
  // relato foi esse: tocar um hino do hinário e a capa não dizer de onde ele é.
  //
  // O que este caso trava é a PASSAGEM de preenchimento, e ele mede o que o
  // Display vai ler — o registro —, não o que a função devolve. Inclui a
  // CORREÇÃO (um nome velho é substituído) e o limite (registro de pasta do
  // aparelho, que não é coleção nenhuma, fica intocado).
  const albuns = await pg.evaluate(async () => {
    await AVDB.setState('migAlbumDaCapa', 0);
    await AVDB.fileAdd({ id: 'capa-1', folder: 'hymnal-2022', name: '147. Ó Adorai (Cantado)',
      hymnName: 'Ó Adorai o Senhor', hymnTrack: 147, kind: 'audio' });
    await AVDB.fileAdd({ id: 'capa-2', folder: 'hymnal-2022', name: 'outro',
      hymnAlbum: 'Nome Antigo do Hinário', kind: 'audio' });
    await AVDB.fileAdd({ id: 'capa-3', folder: 'pastaDoAparelho', name: 'video.mp4', kind: 'video' });
    await preencherAlbunsDosHinos();
    const ler = async (id) => (await AVDB.fileGet(id)) || {};
    return {
      preencheu: (await ler('capa-1')).hymnAlbum,
      corrigiu: (await ler('capa-2')).hymnAlbum,
      naoInventou: (await ler('capa-3')).hymnAlbum,
      marcou: await AVDB.getState('migAlbumDaCapa'),
    };
  });
  checar(albuns.preencheu === 'Hinário Adventista 2022',
    'a música JÁ BAIXADA ganha o nome da coleção — é o `folder` do registro que responde',
    String(albuns.preencheu));
  checar(albuns.corrigiu === 'Hinário Adventista 2022',
    'e um nome velho é CORRIGIDO, não só preenchido', String(albuns.corrigiu));
  checar(albuns.naoInventou === undefined,
    'um arquivo de pasta do aparelho não ganha álbum nenhum', String(albuns.naoInventou));
  checar(!!albuns.marcou, 'a passagem se marca como feita — ela não roda a cada abertura');
} catch (e) {
  checar(false, 'o percurso terminou sem exceção (' + (e && e.message) + ')');
}

await navegador.close();
servidor.close();
console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
