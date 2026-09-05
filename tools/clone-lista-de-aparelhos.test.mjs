#!/usr/bin/env node
// A LISTA DE APARELHOS DO CLONE NÃO PROMETE O QUE NÃO PODE CUMPRIR.
//
// ## O relato
//
// *"na seleção do aparelho para conectar, ele fica eternamente 'medindo',
// mesmo aparecendo o aparelho para conectar."*
//
// Era literal, e o defeito tinha DUAS metades, uma em cada lado da ponte.
//
// **No shell:** a cessão anunciava por mDNS assim que ligava, com ZERO itens —
// o índice varre o OPFS e leva segundos —, e o `acervoPublicar` refazia o
// anúncio com os números de verdade. Só que reanunciar é desanunciar e
// anunciar com o MESMO nome de serviço, e quem procura ignorava um nome já
// achado (`enfileirarResolve`): o TXT novo nunca chegava. E havia um segundo
// defeito no mesmo ponto, mais caro que o rótulo — o aparelho aparecia na
// lista ANTES de ter índice, isto é, oferecido para toque sem ter o que servir.
//
// **No web:** "medindo" era uma promessa sobre um estado que este lado não tem
// como observar. O que chega aqui é o TXT do anúncio, e "zero itens" não
// distingue *"ainda estou contando"* de *"a biblioteca está vazia"*.
//
// ## As duas metades deste oráculo, e por que são duas
//
// A palavra sair do `controle.js` é uma correção de TEXTO; o anúncio sair só
// com os números é a correção de MECANISMO. Provar uma sem a outra aprova
// metade do conserto: contra um shell que ainda anuncia zero, a lista deixa de
// dizer "medindo" e passa a mostrar o endereço para sempre, o que é honesto e
// continua sendo um aparelho oferecido sem índice.
//
//   node tools/clone-lista-de-aparelhos.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { abrirNavegador, checar, falhas } from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(RAIZ, 'app/src/main/assets/web');
const JS = fs.readFileSync(path.join(WEB, 'controle/controle.js'), 'utf8');
const KT_DESC = fs.readFileSync(path.join(RAIZ, 'app/src/main/java/br/org/iasd/av/AcervoDescoberta.kt'), 'utf8');
const KT_ACT = fs.readFileSync(path.join(RAIZ, 'app/src/main/java/br/org/iasd/av/MainActivity.kt'), 'utf8');

// ---------------------------------------------------------------------------
// METADE 1 — o MECANISMO, lido do Kotlin
// ---------------------------------------------------------------------------
//
// A técnica é a do `tipos-que-sobem.test.mjs`: o oráculo não roda o Kotlin, ele
// afirma o CONTRATO que as duas pontas precisam manter. Sem isto, alguém
// devolve o anúncio de zero itens e a única coisa que muda na tela é a palavra.
checar(/fun preparar\(/.test(KT_DESC),
  'o `AcervoDescoberta` tem o `preparar` — guardar porta e rótulo SEM anunciar');
checar(/AcervoDescoberta\.preparar\(/.test(KT_ACT),
  'e o `ligarCessao` o usa: a cessão liga sem pôr o aparelho na rede');
checar(!/AcervoDescoberta\.anunciar\([^)]*0,\s*0L\)/.test(KT_ACT),
  'NINGUÉM anuncia mais com zero itens — era o anúncio que a lista não sabia corrigir');
checar(/private const val REVER_MS/.test(KT_DESC)
  && /achadoEm\s*<\s*REVER_MS/.test(KT_DESC),
  'e um nome JÁ ACHADO pode ser resolvido de novo passada a janela — sem isso o '
  + '`reanunciar` não tem como pousar do outro lado');

// O REGISTRO É SALVO TRUNCANDO (v1.8.4). "w" sem o "t" escreve por cima do
// começo e deixa a CAUDA do arquivo antigo — e o resto que sobra é conteúdo
// plausível, blocos inteiros bem formatados descrevendo um estado que já não
// existe. Num artefato cujo consumidor é um humano A DISTÂNCIA, isso é a
// definição de um log que discorda do aparelho. MEDIDO num Registro de campo: a
// cauda do arquivo anterior entrou no meio de uma linha.
checar(/openOutputStream\(uri, "wt"\)[\s\S]{0,200}?texto\.toByteArray/.test(KT_ACT),
  'o `salvarTexto` abre o documento com "wt" (TRUNCA) — sem o `t`, o Registro '
  + 'novo sai grudado na cauda do antigo');
checar(!/openOutputStream\(uri\)/.test(KT_ACT),
  'e não sobrou nenhum `openOutputStream` sem modo no shell');

// O DESMONTE DIZ POR QUÊ (o outro achado do mesmo Registro): a última linha era
// "cessao da biblioteca ligada" com o estado em "servidor: desligado", e nada
// entre as duas. As causas possíveis pedem ações opostas.
checar(/private fun desmontarEspelho\(motivo: String\)/.test(KT_ACT),
  'o `desmontarEspelho` EXIGE um motivo — um chamador novo escolhe uma frase, não herda silêncio');
checar(/transmissao desligada: /.test(KT_ACT),
  'e ele o escreve no Registro');
for (const [quem, frase] of [
  ['o app fechado', 'o app foi fechado'],
  ['o operador desligando a transmissão', 'o operador desligou a transmissao'],
  ['o operador parando de ceder', 'o operador parou de ceder a biblioteca'],
  ['o Android encerrando o serviço', 'o Android encerrou o servico em primeiro plano'],
]) {
  checar(KT_ACT.includes('"' + frase + '"'), 'o Registro sabe nomear ' + quem, frase);
}

// ---------------------------------------------------------------------------
// METADE 2 — o TEXTO, medido no que a lista de fato desenha
// ---------------------------------------------------------------------------
const navegador = await abrirNavegador();
const ctx = await navegador.newContext();
await semRedeExterna(ctx);
const pg = await ctx.newPage();

try {
  // Como o `recusa-transmissao.test.mjs`: isola a função em vez de subir o
  // Controle inteiro. O que se mede são três ramos de UMA função, e trazer o
  // acervo e a inicialização assíncrona para dentro disso é pagar minutos por
  // um teste que fala de um subtítulo.
  const trecho = JS.match(/^function cloneRenderAchados\(lista\)[\s\S]*?^}/m);
  checar(!!trecho, 'consegui isolar o `cloneRenderAchados` do controle.js');

  await pg.setContent('<!doctype html><html><body><ul id="lista"></ul></body></html>');

  const r = await pg.evaluate(({ fonte }) => {
    const songMenuListEl = document.getElementById('lista');
    const songMenuFor = { clone: true };
    // O `songMenuItem` de verdade monta a linha da folha; aqui basta guardar o
    // que ele recebeu — a asserção é sobre o SUBTÍTULO, e não sobre a caixa.
    const songMenuItem = (icone, titulo, sub) => {
      const li = document.createElement('li');
      li.dataset.titulo = titulo || '';
      li.dataset.sub = sub || '';
      li.textContent = (titulo || '') + ' ' + (sub || '');
      return li;
    };
    const pacoteIconeSvg = () => '';
    const fmtBytes = (n) => n + ' B';
    const cloneProcurandoDesde = Date.now();
    const CLONE_MANUAL_MS = 10000;
    const cloneLinhaManual = () => {};
    const closeSongMenu = () => {};
    const cloneComecar = () => {};
    // eslint-disable-next-line no-new-func
    const montar = new Function(
      'songMenuListEl', 'songMenuFor', 'songMenuItem', 'pacoteIconeSvg', 'fmtBytes',
      'cloneProcurandoDesde', 'CLONE_MANUAL_MS', 'cloneLinhaManual', 'closeSongMenu', 'cloneComecar',
      fonte + '\nreturn cloneRenderAchados;',
    );
    const render = montar(songMenuListEl, songMenuFor, songMenuItem, pacoteIconeSvg, fmtBytes,
      cloneProcurandoDesde, CLONE_MANUAL_MS, cloneLinhaManual, closeSongMenu, cloneComecar);

    const ler = () => ({
      subs: [...songMenuListEl.querySelectorAll('li')].map((li) => li.dataset.sub || ''),
      texto: songMenuListEl.textContent,
    });
    const saida = {};
    render([{ nome: 'A', rotulo: 'Galaxy A54', host: '192.168.0.42', porta: 8787, itens: 612, bytes: 14200 }]);
    saida.comNumeros = ler();
    render([{ nome: 'B', rotulo: 'Galaxy S24', host: '192.168.0.51', porta: 8787, itens: 0, bytes: 0 }]);
    saida.semNumeros = ler();
    render([]);
    saida.vazia = ler();
    return saida;
  }, { fonte: trecho ? trecho[0] : '' });

  checar(r.comNumeros.subs[0] === '612 itens · 14200 B',
    'com os números, a linha diz quantos itens e quanto pesa — que é o que faz '
    + 'escolher entre dois celulares na mesma sala', r.comNumeros.subs[0]);

  checar(r.semNumeros.subs[0] === '192.168.0.51:8787',
    'sem os números, ela diz o ENDEREÇO — verdade, e o que identifica o aparelho',
    r.semNumeros.subs[0]);
  checar(!/medindo/i.test(r.semNumeros.texto),
    'e a palavra "medindo" não aparece: era uma promessa sobre um estado que este '
    + 'lado não observa, e contra um shell que anuncia zero ela ficava para sempre',
    r.semNumeros.texto);

  // A METADE QUE IMPEDE O CONSERTO POR AMPUTAÇÃO. Apagar o feedback inteiro
  // passaria nas duas asserções acima — e o operador ficaria com uma folha
  // vazia nos segundos em que o outro celular ainda está contando o acervo.
  checar(/Procurando na rede/.test(r.vazia.texto),
    'e a lista VAZIA continua dizendo que está procurando — é ela que cobre os '
    + 'segundos em que o outro celular monta o índice', r.vazia.texto);
  // -------------------------------------------------------------------------
  // METADE 3 — O DIÁRIO SOBREVIVE AO QUE APAGOU AS DUAS PROVAS DE CAMPO
  // -------------------------------------------------------------------------
  //
  // Duas cópias falharam e nenhum dos dois Registros pôde dizer por quê, pela
  // MESMA razão nas duas vezes: a falha aparece num diálogo, o operador toca em
  // "Entendi" e reabre o app para copiar o Registro — e aí o anel do web nasceu
  // vazio e o estado do shell também. O `blocoClone` inteiro sumia.
  //
  // A asserção é sobre a PROPRIEDADE que faltava: o bloco existe a partir do
  // DIÁRIO SOZINHO, sem estado de shell nenhum. Um teste que passasse o estado
  // junto aprovaria a versão antiga.
  const trechoBloco = JS.match(/^function blocoClone\(e, diario\)[\s\S]*?^}/m);
  checar(!!trechoBloco, 'consegui isolar o `blocoClone` do controle.js');

  const b = await pg.evaluate(({ fonte }) => {
    const fmtBytes = (n) => n + ' B';
    // eslint-disable-next-line no-new-func
    const montar = new Function('fmtBytes', fonte + '\nreturn blocoClone;');
    const blocoClone = montar(fmtBytes);
    return {
      // O CASO DE CAMPO: processo novo, shell sem memória, e uma tentativa
      // gravada no banco.
      soDiario: blocoClone(null, [
        { em: Date.parse('2026-09-05T18:20:00'), papel: 'levar',
          desfecho: 'Não deu para falar com o outro aparelho.', detalhe: 'parou em: item 7 de 900 (nº 12)' },
      ]),
      // E o silêncio continua sendo silêncio: um aparelho que nunca clonou nem
      // cedeu não ganha bloco (a regra do `ytCenso`).
      semNada: blocoClone(null, []),
      semNadaComShell: blocoClone({ cessao: {}, descoberta: { diag: 'sem uso' }, proxy: 'sem uso' }, []),
    };
  }, { fonte: trechoBloco ? trechoBloco[0] : '' });

  checar(/Clone da biblioteca/.test(b.soDiario) && /Não deu para falar/.test(b.soDiario),
    'o bloco do clone EXISTE a partir do diário sozinho — sem ele, a cópia que '
    + 'falhou saía do Registro sem deixar uma linha', b.soDiario);
  checar(/item 7 de 900/.test(b.soDiario),
    'e ele diz ONDE parou: "não começou" e "parou no meio" pedem conferências opostas',
    b.soDiario);
  checar(b.semNada === '' && b.semNadaComShell === '',
    'e quem nunca clonou nem cedeu continua sem bloco nenhum — uma linha de zeros '
    + 'é mais uma para ler em toda cópia do Registro',
    JSON.stringify([b.semNada, b.semNadaComShell]));

  // A PORTA DE CEDER ANOTA OS DOIS DESFECHOS (v1.8.4). O diário só era escrito
  // quando a lista chegava a ser publicada, e o caminho mais provável de falhar
  // é o outro — o servidor não subir. Sem a linha, o Registro de quem tentou
  // ceder e não conseguiu é IDÊNTICO ao de quem nunca tocou no botão.
  const ligar = JS.match(/^async function cloneLigarCessao\([\s\S]*?^}/m);
  checar(!!ligar && /cloneAnotar\('ceder'/.test(ligar[0]),
    'a falha ao LIGAR a cessão entra no diário — não só a publicação da lista');

  // O ITEM NUNCA É MATERIALIZADO NO HEAP (v1.8.3). A asserção é ESTRUTURAL de
  // propósito: o que se quer garantir é o PICO de memória, e medir pico num
  // navegador é medir a máquina — o que este repositório proíbe a um oráculo
  // que guarda portão. O que dá para afirmar sem ambiguidade é a forma: o laço
  // guarda BLOBS (que o navegador manda para o armazenamento dele) e nunca
  // `ArrayBuffer`s, que ficam no heap do renderer até o fim do item.
  const corpoBaixar = JS.match(/^async function cloneBaixarItem\([\s\S]*?^}/m);
  checar(!!corpoBaixar, 'consegui isolar o `cloneBaixarItem`');
  const cb = corpoBaixar ? corpoBaixar[0] : '';
  checar(/await resp\.blob\(\)/.test(cb) && !/arrayBuffer\(\)/.test(cb),
    'o item chega em BLOBS, nunca em `ArrayBuffer` acumulado — era o mesmo defeito '
    + 'que a v1.7.9 corrigiu no caminho do ARQUIVO, de pé no caminho da REDE', cb.slice(0, 0));

  // O DIÁRIO NÃO VIAJA NO PACOTE, pela mesma razão do histórico: ele descreve
  // ESTE aparelho, e um Registro que mostrasse as tentativas de outro celular é
  // um log que discorda do aparelho — lido a distância por quem não confere.
  const PACOTE = fs.readFileSync(path.join(WEB, 'controle/pacote.js'), 'utf8');
  checar(/'clone-diario',/.test(PACOTE.match(/const FORA = \[[\s\S]*?\];/)?.[0] || ''),
    'e a chave do diário está na lista `FORA` do pacote');
} catch (e) {
  checar(false, 'o percurso terminou sem exceção (' + (e && e.message) + ')');
}

await navegador.close();

if (falhas.length) {
  console.log('\n' + falhas.length + ' falha(s).');
  process.exit(1);
}
console.log('\nTodos passaram.');
