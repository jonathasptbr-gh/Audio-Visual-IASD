#!/usr/bin/env node
// ============================================================================
// A DOCUMENTAÇÃO CONCORDA COM O REPOSITÓRIO (v1.8.49)
//
// ## Por que este oráculo existe
//
// A regra nº 1 deste repositório é *"um comentário errado é pior que um
// comentário longo: ele não custa só leitura, produz a decisão errada"*. Ela
// vale para a documentação inteira e **não tinha rede de segurança nenhuma**.
//
// A faxina de 2026-09-07 achou QUINZE fatos falsos À MÃO, e cinco classes deles
// são mecânicas — nenhuma exige julgamento, todas se verificam contra o disco:
//
//  - `docs/arquitetura/CAMADA-DE-TEXTO.md` linkava `../CLAUDE.md` (falta um
//    nível), e o link estava quebrado desde que o capítulo nasceu;
//  - o `docs/shell/README.md` dizia **34 arquivos Kotlin** quando eram 32, e não
//    tinha linha para o `MuxMp4.kt` — num arquivo cuja função É ser o mapa;
//  - `SafJanela.kt` era citado como ARQUIVO em dois lugares, e é uma CLASSE
//    dentro do `SafPathHandler.kt`;
//  - o `funcao-sem-chamador.test.mjs` e o `notificacao-ids.test.mjs` rodavam no
//    CI sem linha na TABELA DE ORÁCULOS, que é o que responde "o que ele trava";
//  - e a pior: **a v1.7.7 não existia no `HISTORICO.md`** — nem índice, nem
//    seção. É o lote que REMOVEU a transmissão direta, uma das decisões mais
//    consequentes do app, e um `grep "v1.7.7"` devolvia NADA. Cinco outras
//    (v1.8.44 a v1.8.48) faltavam pelo mesmo motivo: a regra de entrega manda
//    escrever a nota ao publicar, e quem publica esquece.
//
// ## Como esta classe falha
//
// **Ela não falha: ela RESPONDE, e responde errado.** Nada quebra, nenhum
// oráculo de comportamento reprova, o app continua correto — e a próxima sessão
// lê a linha falsa, procura um arquivo que não existe, ou conclui que uma
// decisão nunca foi tomada porque o `grep` no apêndice devolveu vazio.
//
// ## O limite, declarado
//
// Ele afere o que é MECÂNICO (existe? bate? está listado?), nunca se o texto
// descreve o código com fidelidade — isso não tem como ser verificado por
// máquina, e continua sendo trabalho de leitura. As exceções são NOMEADAS uma a
// uma, com o motivo: é o nome que segura a lista, porque uma exceção por PADRÃO
// é a porta larga por onde todo achado passa a ser silenciado.
//
//   node tools/docs-coerentes.test.mjs
// ============================================================================
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const falhas = [];
const ok = (t) => console.log('ok\t' + t);
const nao = (t, extra) => { console.log('FALHOU\t' + t + (extra ? '\n\t' + extra : '')); falhas.push(t); };
const ler = (p) => readFileSync(join(RAIZ, p), 'utf8');

// Todo `.md` do repositório, menos o que não é nosso.
const docs = [];
(function anda(d) {
  for (const e of readdirSync(join(RAIZ, d), { withFileTypes: true })) {
    const p = d ? d + '/' + e.name : e.name;
    if (e.isDirectory()) { if (!/^(node_modules|\.git|\.github|build|site)$/.test(e.name)) anda(p); }
    else if (e.name.endsWith('.md')) docs.push(p);
  }
})('');

// ============================================================================
// 1 · TODO LINK RELATIVO APONTA PARA UM ARQUIVO QUE EXISTE
//
// Um link quebrado num documento que se lê no GitHub é um 404 silencioso: quem
// clica não descobre que o capítulo mudou de lugar, descobre que ele "não
// existe". Três estavam quebrados, e o de `../CLAUDE.md` a partir de
// `docs/arquitetura/` nasceu quebrado com o capítulo.
// ============================================================================
{
  // `../../releases` e afins: a convenção do GitHub para apontar para a aba do
  // próprio repositório a partir do README. Não é caminho de arquivo.
  const DO_GITHUB = /^\.\.\/\.\.\/(releases|issues|actions|pulls|wiki)(\/|$)/;
  const quebrados = [];
  let vistos = 0;
  for (const f of docs) {
    for (const m of ler(f).matchAll(/\[[^\]]*\]\(([^)\s#]+)(#[^)]*)?\)/g)) {
      const alvo = m[1].trim();
      if (/^(https?:|mailto:|#)/.test(alvo)) continue;
      vistos++;
      if (DO_GITHUB.test(alvo)) continue;
      if (!existsSync(resolve(RAIZ, dirname(f), alvo))) quebrados.push(f + ' → ' + alvo);
    }
  }
  if (vistos >= 50) ok('os links relativos foram varridos (' + vistos + ' em ' + docs.length + ' arquivos)');
  else nao('os links relativos foram varridos', 'só ' + vistos + ' — a varredura não achou os documentos');
  if (!quebrados.length) ok('e todo link relativo aponta para um arquivo que existe');
  else nao('todo link relativo aponta para um arquivo que existe', quebrados.join('\n\t'));
}

// ============================================================================
// 2 · TODO ARQUIVO DE CÓDIGO CITADO EXISTE
//
// A citação `entre crases` é como este repositório aponta para o código, e ela
// é o que a próxima sessão vai abrir. Um nome que não existe manda procurar —
// e, pior, sugere um mecanismo que não está lá (`SafJanela.kt` como arquivo
// insinua um módulo próprio; ele é uma classe dentro do `SafPathHandler.kt`).
//
// AS EXCEÇÕES SÃO NOMEADAS, cada uma com o motivo. Um nome novo que não exista
// reprova — que é o ponto.
// ============================================================================
{
  // Os apêndices FALAM do passado por definição: o histórico é verbatim e não é
  // reescrito ("uma decisão revogada é anotada na nota que a revoga"), as
  // auditorias descrevem o estado de uma data, e o `ESPELHO-DE-PIXELS` é
  // arquivo de um recurso removido.
  const APENDICES = /^docs\/(HISTORICO|AUDITORIA-.*|ESPELHO-DE-PIXELS)\.md$/;

  const NOMEADAS = new Map([
    // Os andaimes de PWA, removidos na v5.48 — os documentos explicam a AUSÊNCIA.
    ['sw.js', 'o service worker saiu do bundle (v5.48); os docs explicam a ausência'],
    ['manifest.json', 'idem — o WebAPK não existe num WebView'],
    ['server.js', 'idem — o servidor de desenvolvimento do modelo de dois PWAs'],
    // O ESPELHO DE PIXELS, removido na v5.187.
    ['cliente.js', 'o espelho de pixels saiu na v5.187'],
    ['fmp4.js', 'idem'],
    ['fmp4.test.mjs', 'idem — o oráculo saiu com o recurso'],
    ['espelho-cliente.test.mjs', 'idem'],
    ['EspelhoMidia.kt', 'idem — hoje são o EspelhoMidiaCache e o EspelhoMidiaCanal'],
    // A folha do aro de espera do palco, removida na v1.4.8.
    ['stage.css', 'saiu na v1.4.8 com o aro de espera do palco'],
    // Oráculos que saíram com o recurso que mediam.
    ['cifra-teclado.test.mjs', 'saiu na v1.3.3 com a busca à mão da cifra'],
    ['clone-de-outro-celular.test.mjs', 'saiu na v1.8.16 com o clone pela rede'],
    ['clone-lista-de-aparelhos.test.mjs', 'idem'],
    // O banco LouvorJA é um projeto de TERCEIRO — a referência descreve o que
    // existe LÁ, e este repositório não tem como conferir.
    ['Database.js', 'arquivo do projeto LouvorJA, não deste repositório'],
    ['Media.js', 'idem'],
    ['Path.js', 'idem'],
    ['state.js', 'idem'],
    // Caminhos de RUNTIME no aparelho, não arquivos versionados.
    ['web-ota.xml', 'caminho no armazenamento do app, não um arquivo do repositório'],
    ['espelho-tls.xml', 'idem'],
    // Dentro do pacote npm do renderizador, não no nosso disco.
    ['aiden0z-pptx-renderer.browser.es.js', 'arquivo de dentro da dependência'],
    // Anexo de varredura que o próprio documento previu apagar, e apagou.
    ['anexo-varredura-command-stream.json', 'anexo temporário, apagado como estava previsto (o TELAO diz isso)'],
    // Asset publicado na branch de dados, lido por URL.
    ['serie.json', 'asset servido por raw.githubusercontent, não versionado aqui'],
  ]);

  const reais = new Set();
  (function anda(d) {
    for (const e of readdirSync(join(RAIZ, d), { withFileTypes: true })) {
      const p = d ? d + '/' + e.name : e.name;
      if (e.isDirectory()) { if (!/^(node_modules|\.git|build|\.gradle)$/.test(e.name)) anda(p); }
      else reais.add(e.name);
    }
  })('');

  const fantasmas = new Map();
  let citacoes = 0;
  for (const f of docs) {
    if (APENDICES.test(f)) continue;
    for (const m of ler(f).matchAll(/`([A-Za-z0-9_.\/-]+\.(?:kt|js|mjs|css|html|json|xml))`/g)) {
      citacoes++;
      const nome = m[1].split('/').pop();
      if (reais.has(nome) || NOMEADAS.has(nome)) continue;
      const k = nome + '  (' + f + ')';
      if (!fantasmas.has(k)) fantasmas.set(k, true);
    }
  }
  if (citacoes >= 200) ok('as citações de arquivo foram varridas (' + citacoes + ')');
  else nao('as citações de arquivo foram varridas', 'só ' + citacoes + ' — a varredura não leu os documentos');
  if (!fantasmas.size) ok('e todo arquivo de código citado existe (ou está na lista NOMEADA)');
  else nao('todo arquivo de código citado existe',
    [...fantasmas.keys()].join('\n\t')
    + '\n\tconserto: corrija o nome, ou acrescente à lista NOMEADAS com o MOTIVO ao lado');

  // A OUTRA METADE: uma exceção que deixou de ser necessária é lixo que esconde
  // o próximo achado — se o arquivo voltou a existir, a linha tem de sair.
  const obsoletas = [...NOMEADAS.keys()].filter((n) => reais.has(n));
  if (!obsoletas.length) ok('e nenhuma exceção nomeada aponta para um arquivo que EXISTE');
  else nao('nenhuma exceção nomeada aponta para um arquivo que existe',
    obsoletas.join(', ') + '\n\tconserto: tire da lista — o arquivo voltou');
}

// ============================================================================
// 3 · OS MAPAS DE ARQUIVO ESTÃO COMPLETOS, E AS CONTAGENS BATEM
//
// O `docs/shell/README.md` existe para UMA coisa: dizer onde cada `.kt` é
// explicado. Ele dizia 34 quando eram 32, e não tinha linha para o `MuxMp4.kt`
// — um mapa incompleto é pior que mapa nenhum, porque quem o lê conclui que o
// arquivo que falta não tem capítulo, quando o que falta é a linha.
// ============================================================================
{
  const kt = readdirSync(join(RAIZ, 'app/src/main/java/br/org/iasd/av')).filter((f) => f.endsWith('.kt'));
  const js = [];
  (function anda(d) {
    for (const e of readdirSync(join(RAIZ, d), { withFileTypes: true })) {
      if (e.name === 'vendor') continue;
      const p = d + '/' + e.name;
      if (e.isDirectory()) anda(p); else if (e.name.endsWith('.js')) js.push(e.name);
    }
  })('app/src/main/assets/web');

  const mapaKt = ler('docs/shell/README.md');
  const faltamKt = kt.filter((n) => !mapaKt.includes(n));
  if (kt.length >= 25) ok('o shell foi varrido (' + kt.length + ' arquivos Kotlin)');
  else nao('o shell foi varrido', 'só ' + kt.length + ' — o caminho mudou?');
  if (!faltamKt.length) ok('e todo `.kt` tem linha no mapa do `docs/shell/README.md`');
  else nao('todo `.kt` tem linha no mapa do shell', faltamKt.join(', '));

  const mapaJs = ler('docs/ARQUITETURA-WEB.md');
  const faltamJs = js.filter((n) => !mapaJs.includes(n));
  if (!faltamJs.length) ok('e todo `.js` da base aparece no `docs/ARQUITETURA-WEB.md`');
  else nao('todo `.js` da base aparece no ARQUITETURA-WEB', faltamJs.join(', '));

  // A CONTAGEM ESCRITA POR EXTENSO. Ela envelhece calada: o número continua
  // parecendo autoridade depois de o repositório mudar debaixo dele.
  const contagens = [
    ['docs/shell/README.md', /`app\/src\/main\/java\/br\/org\/iasd\/av\/`, (\d+) arquivos/, kt.length, 'arquivos Kotlin no mapa do shell'],
    ['CLAUDE.md', /\*\*(\d+) arquivos Kotlin/, kt.length, 'arquivos Kotlin no CLAUDE.md'],
  ];
  for (const [arq, re, esperado, nome] of contagens) {
    const m = ler(arq).match(re);
    if (!m) { nao('a contagem de ' + nome + ' foi encontrada', 'o padrão não casou em ' + arq + ' — o texto mudou de forma'); continue; }
    if (Number(m[1]) === esperado) ok('a contagem de ' + nome + ' bate (' + esperado + ')');
    else nao('a contagem de ' + nome + ' bate', arq + ' diz ' + m[1] + ', o disco tem ' + esperado);
  }
}

// ============================================================================
// 4 · TODO ORÁCULO DO CI TEM LINHA NA TABELA, E VICE-VERSA
//
// A tabela do `CLAUDE.md` é o que responde *"o que este oráculo trava, e como
// aquele defeito falha calado"*. Dois rodavam no CI sem linha nenhuma, e
// existiam só dentro dos blocos de lote — que a faxina apagou. Um oráculo sem
// linha some da consciência do projeto; uma linha sem oráculo promete uma rede
// de segurança que não existe.
// ============================================================================
{
  const wf = ler('.github/workflows/apk.yml');
  const noCi = new Set([...wf.matchAll(/tools\/([a-z0-9.-]+\.(?:test\.)?mjs)/g)].map((m) => m[1]));
  // A TABELA MUDOU DE CASA na faxina de 2026-09-07 (ela é REFERÊNCIA, e o
  // `CLAUDE.md` é lido inteiro em toda sessão), mas o MÉTODO ficou lá — então a
  // pergunta é pela UNIÃO dos dois. Escrita assim, ela sobrevive à tabela mudar
  // de arquivo de novo: o que ela afere é "existe linha em algum lugar
  // canônico?", não "está naquele arquivo".
  const canon = ler('docs/ORACULOS.md') + '\n' + ler('CLAUDE.md');
  // O ARNÊS não é oráculo: ele tem seção própria, e não trava defeito nenhum.
  const ARNES = new Set(['arnes.mjs', 'checar.mjs']);
  const semLinha = [...noCi].filter((o) => !ARNES.has(o) && !canon.includes(o)).sort();
  const noDisco = new Set(readdirSync(join(RAIZ, 'tools')).filter((f) => f.endsWith('.test.mjs')));
  const foraDoCi = [...noDisco].filter((o) => !noCi.has(o)).sort();

  if (noCi.size >= 60) ok('o workflow foi lido (' + noCi.size + ' oráculos no CI)');
  else nao('o workflow foi lido', 'só ' + noCi.size + ' — o padrão do `rodar` mudou?');
  if (!semLinha.length) ok('e todo oráculo do CI tem linha em `docs/ORACULOS.md`');
  else nao('todo oráculo do CI tem linha na tabela de oráculos',
    semLinha.join(', ') + '\n\tconserto: acrescente a linha em `docs/ORACULOS.md`, dizendo o que ele trava');
  // *"Teste que não está no workflow é documentação, não rede de segurança"* — a
  // regra do repositório, cobrada aqui em vez de por uma linha de `comm`.
  if (!foraDoCi.length) ok('e todo oráculo de `tools/` roda no CI');
  else nao('todo oráculo de tools/ roda no CI',
    foraDoCi.join(', ') + '\n\tum oráculo que não roda é pior que oráculo nenhum: ele responde'
    + '\n\t"isso está coberto?" com um sim que não existe');
}

// ============================================================================
// 5 · TODA VERSÃO PUBLICADA TEM NOTA NO HISTÓRICO
//
// É a que pega o esquecimento que de fato aconteceu — SEIS vezes. A regra de
// entrega diz *"ao publicar, a nota do lote vai para lá (topo + uma linha no
// índice)"*, e quem publica está ocupado com o merge e a Release.
//
// A v1.7.7 — o lote que REMOVEU a transmissão direta — não estava lá: nem
// índice, nem seção. `grep "v1.7.7" docs/HISTORICO.md` devolvia vazio sobre uma
// das decisões mais consequentes do app.
//
// A régua é o `notas.json`, que é a lista do que de fato foi PUBLICADO por OTA.
// ============================================================================
{
  const notas = JSON.parse(ler('app/src/main/assets/web/notas.json'));
  const hist = ler('docs/HISTORICO.md');
  const semNota = notas.map((e) => e.versao).filter((v) => !hist.includes('**v' + v + '**') && !hist.includes('## v' + v + ' '));
  if (notas.length >= 20) ok('o `notas.json` foi lido (' + notas.length + ' versões publicadas)');
  else nao('o notas.json foi lido', 'só ' + notas.length + ' entradas');
  if (!semNota.length) ok('e toda versão publicada tem nota no `docs/HISTORICO.md`');
  else nao('toda versão publicada tem nota no HISTORICO',
    semNota.join(', ')
    + '\n\tconserto: escreva a entrada de índice (`- **vX** — …`) no topo do índice.'
    + '\n\tSem ela, um `grep` por aquela versão devolve VAZIO — e o apêndice é'
    + '\n\to lugar declarado para responder "por que isto é assim?"');
}

// ============================================================================
// 6 · AS ÂNCORAS INTERNAS APONTAM PARA SEÇÕES QUE EXISTEM
//
// O índice do `CLAUDE.md` e os dos capítulos navegam por âncora. Uma seção
// renomeada deixa a linha do índice apontando para lugar nenhum — e o índice é
// justamente o que se lê para NÃO carregar o arquivo inteiro.
// ============================================================================
{
  const acento = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const slug = (t) => acento(t.trim().toLowerCase()).replace(/[^a-z0-9 -]/g, '').replace(/ /g, '-');
  const quebradas = [];
  let ancoras = 0;
  for (const f of docs) {
    const src = ler(f);
    const titulos = new Set([...src.matchAll(/^#{1,6} (.+)$/gm)].map((m) => slug(m[1])));
    for (const m of src.matchAll(/\]\((#[a-z0-9-]+)\)/g)) {
      ancoras++;
      if (!titulos.has(m[1].slice(1))) quebradas.push(f + ' → ' + m[1]);
    }
  }
  if (ancoras >= 20) ok('as âncoras internas foram varridas (' + ancoras + ')');
  else nao('as âncoras internas foram varridas', 'só ' + ancoras);
  if (!quebradas.length) ok('e toda âncora interna aponta para uma seção que existe');
  else nao('toda âncora interna aponta para uma seção que existe', quebradas.join('\n\t'));
}

console.log('');
if (falhas.length) { console.log(falhas.length + ' FALHA(S).'); process.exit(1); }
console.log('A documentação concorda com o repositório.');
