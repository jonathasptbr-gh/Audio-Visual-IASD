#!/usr/bin/env node
// ============================================================================
// UMA FUNÇÃO SEM CHAMADOR (v1.8.42)
//
// ## Por que este oráculo existe
//
// A regra deste repositório é *"APAGAR CÓDIGO É APAGAR O QUE O DESCREVE, NO
// MESMO LOTE"*, e ela não tinha rede de segurança nenhuma do lado das FUNÇÕES.
// O modo de falhar é mudo por construção: uma função que ninguém chama não erra,
// não aparece em teste de comportamento nenhum, e viaja no bundle do OTA para
// todo aparelho da frota em toda atualização. O que ela custa não é o byte — é o
// COMENTÁRIO dela, que continua afirmando um mecanismo que já não roda, e que a
// próxima sessão lê como verdade.
//
// Duas foram achadas à mão na revisão de 2026-09-07, e as duas são o padrão:
//
//  - `pacoteIconeSvg` — a v1.8.41 trocou os DOIS chamadores dela (o ícone de um
//    grupo passou a vestir `.coll-bar-icon`, a seta virou `chevronUpIconSvg`) e
//    deixou a função de pé. Pior: o `glifos.test.mjs` varria por
//    `pacoteIconeSvg\('ico…'` como uma das suas DUAS entradas, e com zero
//    chamadas essa alternativa parou de casar — a asserção que existia para
//    provar que a entrada do JS foi lida passou a ser satisfeita pela outra
//    alternativa, e seguia verde afirmando o que já não podia afirmar.
//  - `telaoNoChao` — nasceu na v1.6.6 e NUNCA teve chamador no app; só o
//    `telao-no-chao.test.mjs` a chamava. Enquanto isso o `descreverTelao`
//    reescrevia a mesma pergunta inline, e as duas já divergiam.
//
// ## As duas categorias, e por que elas são separadas
//
// MORTA        — nem o app nem os oráculos usam. Apague, com o comentário.
// SÓ O ORÁCULO — o app não chama; só `tools/` chama. É PIOR que morta: o
//                oráculo prova que uma função que ninguém usa funciona, e a
//                lógica de verdade está escrita em OUTRO lugar, livre para
//                divergir. Ou o app passa a usá-la, ou ela sai com o teste.
//
// ## O limite, declarado
//
// A busca é TEXTUAL (`\bnome\b` sobre todo `.js` e `.html` da base, menos
// `vendor/`) e roda SOBRE O CÓDIGO, com os comentários removidos — sem isso um
// comentário que CITA a função conta como uso, e a citação costuma ser
// justamente a que explica o mecanismo que acabou de morrer. MEDIDO ao escrever
// este arquivo: com os comentários dentro, a reversão do `telaoNoChao` NÃO
// reprovava, porque as duas linhas de comentário que o nomeiam bastavam.
// Ela não enxerga despacho por string (`window[nome]()`), e por isso
// erra para o lado BARULHENTO: acusa uma função viva em vez de deixar passar uma
// morta. Uma acusação falsa se resolve em uma linha — a lista `VIVAS_POR_FORA`
// abaixo —, e cada entrada nela tem de dizer QUEM chama.
//
//   node tools/funcao-sem-chamador.test.mjs
// ============================================================================
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = join(RAIZ, 'app/src/main/assets/web');

// Chamadas que a busca textual não enxerga. Cada linha diz QUEM chama.
const VIVAS_POR_FORA = new Set([
  // (vazia hoje — acrescente `nome`, com o chamador no comentário ao lado)
]);

// MORTAS DE PROPÓSITO — e a distinção importa: o que este oráculo combate é o
// resto que ninguém DECIDIU deixar. Um símbolo sem chamador cujo comentário
// ADMITE a ausência e diz por que ele fica não é um resto; é uma decisão, e
// apagá-lo seria desfazê-la por conta própria.
//
// Cada entrada tem de apontar o comentário que a sustenta — sem isso a lista
// vira a porta larga por onde todo achado deste oráculo passa a ser silenciado.
const MORTAS_DE_PROPOSITO = new Set([
  // (vazia hoje — acrescente `nome` com o comentário que a sustenta ao lado)
]);

const falhas = [];
const ok = (t) => console.log('ok\t' + t);
const nao = (t, extra) => { console.log('FALHOU\t' + t + (extra ? '\n\t' + extra : '')); falhas.push(t); };

const arquivos = [];
(function anda(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'vendor') continue;
    const p = join(d, e.name);
    if (e.isDirectory()) anda(p);
    else if (/\.(js|html)$/.test(e.name)) arquivos.push(p);
  }
})(WEB);

// SEM COMENTÁRIOS — ver o cabeçalho —, e o removedor é DELIBERADAMENTE
// conservador: ele só apaga o que COMEÇA a linha (`//`, `*`, `/*`, `<!--`).
//
// A versão larga (casar `/*…*/` e `//…` em qualquer posição) foi escrita e
// MEDIDA primeiro, e ela engolia CÓDIGO: um `/*` dentro de uma string ou de um
// literal de regex abre um bloco que só fecha muitas linhas adiante, e com ele
// somem chamadas de verdade — `dotsIconSvg`, chamada na linha 8251, saía como
// morta. Errar assim é pior que o furo que o removedor conserta: acusa função
// viva com a confiança de um oráculo.
//
// O que ficou de fora é comentário à direita de código (`foo(); // nota`), e
// ele é inofensivo aqui: o que interessa é a linha ter a CHAMADA, e ela está
// antes do `//`. O que importa apagar são os blocos de documentação deste
// repositório, que são sempre de linha inteira — e são eles que citam o nome da
// função que acabou de morrer.
const semComentario = (t) => t.split('\n')
  .filter((l) => !/^\s*(\/\/|\*|\/\*|<!--)/.test(l))
  .join('\n');

const corpo = new Map(arquivos.map((f) => [f, readFileSync(f, 'utf8')]));
const app = semComentario([...corpo.values()].join('\n'));
const oraculos = semComentario(readdirSync(join(RAIZ, 'tools'))
  .filter((f) => f.endsWith('.mjs'))
  .map((f) => readFileSync(join(RAIZ, 'tools', f), 'utf8')).join('\n'));

const mortas = [];
const soOraculo = [];
let vistas = 0;
for (const [f, txt] of corpo) {
  if (!f.endsWith('.js')) continue;
  const rel = f.slice(RAIZ.length + 1);
  // O RECUO ENTRA NA REGEX (v1.8.46), e sem ele a varredura via só metade da
  // base: `db.js`, `stage.js` e as outras são um IIFE, e toda função
  // delas nasce indentada. MEDIDO: com a âncora colada no começo da linha, 918
  // funções eram vistas — nenhuma de `shared/`, que é onde mora o banco.
  // Foi assim que o `filesResumo` passou.
  for (const m of txt.matchAll(/^[ \t]*(?:async )?function ([A-Za-z_$][\w$]*)/gm)) {
    const nome = m[1];
    vistas++;
    if (VIVAS_POR_FORA.has(nome) || MORTAS_DE_PROPOSITO.has(nome)) continue;
    const re = new RegExp('\\b' + nome + '\\b', 'g');
    // > 1 = a declaração mais ao menos um uso.
    if ((app.match(re) || []).length > 1) continue;
    ((oraculos.match(re) || []).length ? soOraculo : mortas).push(nome + ' (' + rel + ')');
  }
}

// A PROVA DE QUE A VARREDURA RODOU: sem ela, um `readdirSync` que devolvesse
// nada deixaria as duas listas vazias e o oráculo passaria por AUSÊNCIA.
if (vistas >= 500) ok('a base foi varrida (' + vistas + ' funções em ' + arquivos.length + ' arquivos)');
else nao('a base foi varrida', 'só ' + vistas + ' função(ões) vista(s) — a varredura não achou o código');

if (!mortas.length) ok('nenhuma função sem chamador nenhum');
else nao('nenhuma função sem chamador nenhum',
  mortas.join('\n\t') + '\n\tconserto: apague a função E o comentário dela, no mesmo lote');

if (!soOraculo.length) ok('nenhuma função existe só para o oráculo chamar');
else nao('nenhuma função existe só para o oráculo chamar',
  soOraculo.join('\n\t')
  + '\n\tconserto: faça o APP usá-la (a lógica de verdade costuma estar'
  + '\n\tduplicada em outro lugar), ou apague-a junto com a asserção');

// ============================================================================
// A SUPERFÍCIE PÚBLICA DO BANCO — `global.AVDB = { … }` (v1.8.46)
//
// A contagem acima não alcança um nome EXPORTADO: ele aparece duas vezes (a
// declaração e a linha da exportação), e `> 1` o aprova. Foi assim que o
// `filesResumo` sobreviveu — o único consumidor dele no repositório era um
// espião de oráculo afirmando que ele NÃO é chamado.
//
// Aqui a pergunta é a certa para uma API: **alguém acessa `AVDB.<nome>`?** A
// lista é a do `db.js`, e os consumidores dela chegam todos por esse prefixo
// (278 ocorrências só no `controle.js`), então não há falso positivo a temer.
// Escopada a ELA de propósito: uma varredura genérica por `return { … }` casa
// todo objeto devolvido por qualquer função, e foi o que produziu dois falsos
// positivos ao escrever este bloco.
// ============================================================================
{
  const db = corpo.get(join(WEB, 'shared/db.js')) || '';
  const m = db.match(/global\.AVDB = \{([\s\S]*?)\n  \};/);
  if (!m) {
    nao('achei o `global.AVDB = { … }` no db.js',
      'sem ele este bloco não mede nada — não deixe passar por ausência');
  } else {
    const nomes = [...semComentario(m[1]).matchAll(/([A-Za-z_$][\w$]*)\s*(?=[,\n])/g)]
      .map((x) => x[1]).filter((n2) => !/^(true|false|null|slice)$/.test(n2));
    const orfaos = nomes.filter((n2) => !MORTAS_DE_PROPOSITO.has(n2)
      && !new RegExp('\\.' + n2 + '\\b').test(app.replace(m[0], '')));
    if (nomes.length >= 40) ok('a superfície do `AVDB` foi lida (' + nomes.length + ' nomes)');
    else nao('a superfície do `AVDB` foi lida', 'só ' + nomes.length + ' nome(s)');
    if (!orfaos.length) ok('e todo nome exportado pelo `AVDB` é acessado no app');
    else {
      const soTeste = orfaos.filter((n2) => new RegExp('\\.' + n2 + '\\b').test(oraculos));
      nao('todo nome exportado pelo `AVDB` é acessado no app',
        orfaos.join(', ')
        + (soTeste.length ? '\n\tdesses, SÓ O ORÁCULO usa: ' + soTeste.join(', ') : '')
        + '\n\tconserto: apague o que ninguém chama, ou faça o app usá-lo');
    }
  }
}

// ============================================================================
// UMA CONSTANTE SEM LEITOR (v1.8.47)
//
// A mesma pergunta do bloco de cima, na outra metade do que a base declara — e
// a que a revisão de 2026-09-07 achou à mão depois de o oráculo já existir:
//
//  - `STREAM_RETENTAR_MS` e `streamRetentado` — a TRANSMISSÃO DIRETA tinha
//    saído do app, e o par que media a retentativa ficou, com TRINTA E TRÊS
//    linhas de comentário afirmando que o app re-extrai um manifesto que ele
//    não pede mais. Nenhum oráculo alcança isso: não há comportamento a medir.
//  - `listBodyEl` — a v1.5.0 tirou a faixa de abas e o fantasma que ela
//    animava; o handle ficou, e o comentário dele seguia dizendo que o
//    `.list-body` é o offsetParent de um fantasma que não existe.
//
// A REGEX PEGA O RECUO 0-2, e por isso ela alcança também variáveis LOCAIS de
// uma função de topo. Isso não é ruído: um local que aparece UMA vez no
// repositório inteiro foi declarado e nunca lido, que é o mesmo defeito um
// escopo abaixo. MEDIDO na entrada deste bloco: com a base limpa, ZERO.
// ============================================================================
{
  const mortasC = [];
  const soOraculoC = [];
  let vistasC = 0;
  for (const [f, txt] of corpo) {
    if (!f.endsWith('.js')) continue;
    const rel = f.slice(RAIZ.length + 1);
    for (const m of txt.matchAll(/^[ \t]{0,2}(?:const|let) ([A-Za-z_$][\w$]{2,}) *=/gm)) {
      const nome = m[1];
      vistasC++;
      if (VIVAS_POR_FORA.has(nome) || MORTAS_DE_PROPOSITO.has(nome)) continue;
      const re = new RegExp('\\b' + nome + '\\b', 'g');
      if ((app.match(re) || []).length > 1) continue;
      ((oraculos.match(re) || []).length ? soOraculoC : mortasC).push(nome + ' (' + rel + ')');
    }
  }
  if (vistasC >= 300) ok('a base foi varrida por constantes (' + vistasC + ')');
  else nao('a base foi varrida por constantes', 'só ' + vistasC + ' — a varredura não achou o código');
  if (!mortasC.length) ok('nenhuma constante ou variável de módulo sem leitor');
  else nao('nenhuma constante ou variável de módulo sem leitor',
    mortasC.join('\n\t') + '\n\tconserto: apague o símbolo E o comentário dele, no mesmo lote');
  if (!soOraculoC.length) ok('nenhuma constante existe só para o oráculo ler');
  else nao('nenhuma constante existe só para o oráculo ler', soOraculoC.join('\n\t'));
}


// ── A SUPERFÍCIE DA PONTE (v1.8.71) ─────────────────────────────────────────
//
// Os dois blocos acima varrem DECLARAÇÕES (`function foo`) e CONSTANTES DE
// MÓDULO. Os métodos de `AVNative` não são nem uma coisa nem outra — são
// propriedades de um objeto literal —, e por isso três deles atravessaram a
// varredura: `ytStream` (órfão desde a v1.7.7, com a transmissão direta),
// `otaPending` e `apkProcurar` (absorvidos pelo `atualizacaoEstado`, cujo
// próprio comentário registra a fusão: *"com `otaPending`, `apkProcurar` e
// `otaDiag` separados, as três respostas chegam em três momentos"*).
//
// O custo deste vão é o da regra inteira: o comentário do `apkProcurar` ainda
// dizia *"quem chama é uma linha de Configurações"* — uma linha que já não
// existe —, e o `CLAUDE.md` afirmava que a ponte tinha 63 métodos e que ela era
// *"a superfície inteira que o resto do lado web tem direito de usar"*.
//
// A LISTA DE EXCEÇÃO É POR NOME, e a razão vai ao lado: é o nome que a segura,
// porque ela não tem regra que o próximo órfão possa alegar cumprir.
{
  const SEM_UI_DE_PROPOSITO = new Map([
    // O `.p12` do TLS das telas da rede: o shell serve os três, a folha que os
    // acionava saiu na v5.196, e a `docs/shell/PONTE.md` declara esse estado.
    // Eles NÃO são órfãos por descuido — apagá-los tiraria a única porta de um
    // recurso que o Kotlin continua servindo.
    ['espelhoCertImportar', 'sem UI desde a v5.196 (PONTE.md)'],
    ['espelhoCertEstado', 'sem UI desde a v5.196 (PONTE.md)'],
    ['espelhoCertApagar', 'sem UI desde a v5.196 (PONTE.md)'],
  ]);

  const NATIVE = join(WEB, 'shared/native.js');
  const fonte = readFileSync(NATIVE, 'utf8');
  const i = fonte.indexOf('global.AVNative = {');
  // QUEM CHAMA é todo o resto da base — o `native.js` sai do corpo, senão a
  // própria definição conta como uso e o bloco aprova qualquer coisa.
  const foraDaPonte = semComentario([...corpo.entries()]
    .filter(([f]) => f !== NATIVE).map(([, t]) => t).join('\n'));

  const metodos = [...fonte.slice(i).matchAll(/^\s{4}([a-zA-Z][a-zA-Z0-9]*)[:(]/gm)].map((m) => m[1]);
  const orfaos = [];
  for (const nome of metodos) {
    if (SEM_UI_DE_PROPOSITO.has(nome)) continue;
    if (new RegExp('\\b' + nome + '\\b').test(foraDaPonte)) continue;
    orfaos.push(nome);
  }

  // A PREMISSA, senão um regex que pare de casar aprova a ponte inteira calada.
  if (metodos.length >= 30) ok('a superfície da ponte foi varrida (' + metodos.length + ' métodos)');
  else nao('a superfície da ponte foi varrida', 'só ' + metodos.length + ' método(s) — o recorte do objeto falhou');

  if (!orfaos.length) ok('todo método de `AVNative` tem consumidor fora do `native.js`');
  else nao('todo método de `AVNative` tem consumidor fora do `native.js`',
    orfaos.join(', ') + '\n\tconserto: encolher a ponte pelo LADO WEB (o Kotlin fica, e por isso'
    + '\n\to lote NÃO pede Release), apagando o método E o comentário dele. Se o método'
    + '\n\tdeve existir sem consumidor, ele entra em `SEM_UI_DE_PROPOSITO` com a razão.');

  // E A LISTA DE EXCEÇÃO NÃO PODE ENVELHECER: um nome que já não descreve
  // método nenhum é a mesma armadilha pelo outro lado — ele some da ponte, a
  // linha fica, e a próxima leitura acredita que há um recurso ali.
  const fantasmas = [...SEM_UI_DE_PROPOSITO.keys()].filter((n) => !metodos.includes(n));
  if (!fantasmas.length) ok('e nenhuma exceção da lista descreve um método que já não existe');
  else nao('e nenhuma exceção da lista descreve um método que já não existe', fantasmas.join(', '));
}

// ============================================================================
// UM PARÂMETRO QUE NINGUÉM SUPRE (v1.8.76)
//
// A quarta metade da mesma pergunta, e a que escapava dos três blocos acima:
// eles varrem NOMES — funções, a superfície do `AVDB`, constantes de módulo —, e
// um parâmetro não é nenhum dos três. O `send(id, daFila, retomarEm)` atravessou
// 46 versões assim: o produtor do terceiro argumento era o RECADO, removido na
// v1.2.17, e as duas linhas que o leem nunca mais rodaram. O custo não era o
// byte — era o comentário ao lado, que continuava creditando o RECADO como quem
// o alimenta, a 5.500 linhas de distância da linha do mesmo arquivo que diz que
// o RECADO saiu. *Um comentário errado não custa leitura: produz a decisão
// errada.*
//
// MEDIDO na entrada: SETE parâmetros em 1.270 funções, e dois deles já estavam
// na auditoria de 2026-09-11 como achados separados.
//
// ## A regra, e o que ela deliberadamente NÃO acusa
//
// Acusa: parâmetro SEM `=` padrão na assinatura, LIDO no corpo, em função cujo
// nome nunca aparece solto (só como chamada), e cuja aridade máxima observada
// fica abaixo da posição dele.
//
// Não acusa `function f(a, ms = 3000)`: um padrão na assinatura é a DECLARAÇÃO
// de que o parâmetro é opcional, visível para quem lê a linha — o mesmo papel
// que o comentário das `MORTAS_DE_PROPOSITO`. Já `function f(a, ms)` com um
// `ms || 3000` enterrado no corpo não declara nada: o leitor da assinatura vê um
// segundo parâmetro e tem de cavar. É a diferença entre um contrato e uma
// armadilha, e é onde a linha foi traçada.
//
// ## Por que ele é MUDO em vez de barulhento, ao contrário dos de cima
//
// Contar argumentos é ler JavaScript, e o leitor aqui é um scanner de texto.
// Onde ele não tem certeza — um template literal, um literal de regex, parênteses
// que não fecham — ele DESISTE daquela função inteira (`incerto`), e onde o nome
// aparece solto (callback, alias) ele desiste também, porque aí a aridade vem de
// quem invoca o callback e não de quem escreveu a linha. MEDIDO: 247 das 1.270
// funções são puladas por essas duas portas. É a escolha oposta à do primeiro
// bloco, e de propósito: lá uma acusação falsa se resolve com uma linha de
// allow-list; aqui ela seria um pedido para APAGAR um parâmetro vivo.
// ============================================================================
{
  // Cada entrada diz POR QUE o parâmetro fica — e o nome de quem deveria
  // supri-lo, quando o defeito é o chamador e não o parâmetro.
  const SUPRIDO_POR_FORA = new Map([
    // (vazia hoje — a entrada tem a forma `nome/parametro`, com a razão ao lado)
  ]);

  const FECHA = { '(': ')', '[': ']', '{': '}' };
  // Devolve a aridade da chamada que abre em `i`, ou `null` quando não dá para
  // ter certeza — ver o cabeçalho.
  const aridade = (t, i) => {
    const pilha = []; let args = 0, algo = false;
    for (; i < t.length; i++) {
      const c = t[i];
      if (c === '`') return null;
      if (c === '/') {
        let j = i - 1;
        while (j >= 0 && /\s/.test(t[j])) j--;
        if (j < 0 || t[j] === '(' || t[j] === ',') return null;   // posição de regex literal
      }
      if (c === '"' || c === "'") {
        const q = c; i++;
        while (i < t.length && t[i] !== q) { if (t[i] === '\\') i++; i++; }
        algo = true; continue;
      }
      if (FECHA[c]) { pilha.push(FECHA[c]); if (pilha.length > 1) algo = true; continue; }
      if (c === ')' || c === ']' || c === '}') {
        if (pilha.pop() !== c) return null;
        if (!pilha.length) return algo ? args + 1 : 0;
        continue;
      }
      if (c === ',' && pilha.length === 1) { args++; algo = true; continue; }
      if (!/\s/.test(c)) algo = true;
    }
    return null;
  };

  const orfaos = [];
  let olhadas = 0;
  for (const [f, txt] of corpo) {
    if (!f.endsWith('.js')) continue;
    const rel = f.slice(RAIZ.length + 1);
    const limpo = semComentario(txt);
    for (const m of limpo.matchAll(/^[ \t]*(?:async )?function ([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/gm)) {
      const [, nome, lista] = m;
      // Padrão declarado, destruturação, rest: fora, pelo cabeçalho.
      if (!lista.trim() || /[={[.]/.test(lista) || lista.includes('...')) continue;
      const params = lista.split(',').map((x) => x.trim()).filter(Boolean);
      const corpoFn = limpo.slice(m.index + m[0].length, m.index + m[0].length + 20000);
      if (/\barguments\b/.test(corpoFn)) continue;
      // Nome solto em qualquer lugar = a aridade vem de fora.
      const todas = (app.match(new RegExp('\\b' + nome + '\\b', 'g')) || []).length;
      const comParen = (app.match(new RegExp('\\b' + nome + '\\s*\\(', 'g')) || []).length;
      if (todas !== comParen) continue;
      let max = 0, incerto = false, chamadas = 0;
      for (const c of app.matchAll(new RegExp('\\b' + nome + '\\s*\\(', 'g'))) {
        if (/function\s+$/.test(app.slice(Math.max(0, c.index - 12), c.index))) continue;
        chamadas++;
        const n = aridade(app, c.index + c[0].length - 1);
        if (n === null) { incerto = true; break; }
        if (n > max) max = n;
      }
      if (incerto || !chamadas) continue;
      olhadas++;
      for (let i = max; i < params.length; i++) {
        if (SUPRIDO_POR_FORA.has(nome + '/' + params[i])) continue;
        if (new RegExp('\\b' + params[i] + '\\b').test(corpoFn)) {
          orfaos.push(nome + '(' + lista + ') → `' + params[i] + '` (posição ' + (i + 1)
            + '), máx. suprido = ' + max + '  [' + rel + ']');
        }
      }
    }
  }

  // A PREMISSA, pelo mesmo motivo dos outros blocos: com as duas portas de
  // desistência acima, um recorte quebrado zera a lista e o oráculo passa por
  // AUSÊNCIA. MEDIDO ao escrever: 570 funções chegam até a contagem.
  if (olhadas >= 200) ok('as assinaturas foram varridas (' + olhadas + ' funções com aridade conferível)');
  else nao('as assinaturas foram varridas',
    'só ' + olhadas + ' função(ões) — o recorte da assinatura ou a contagem falhou');

  if (!orfaos.length) ok('e todo parâmetro lido no corpo é suprido por algum chamador');
  else nao('todo parâmetro lido no corpo é suprido por algum chamador',
    orfaos.join('\n\t')
    + '\n\tconserto: apague o parâmetro E o comentário que o explica, no mesmo lote.'
    + '\n\tSe o defeito for o CHAMADOR (o parâmetro devia ser suprido e não é), ele'
    + '\n\tentra em `SUPRIDO_POR_FORA` nomeando quem deveria supri-lo.');

  // E a lista não pode envelhecer — a mesma regra do bloco da ponte.
  const fantasmas = [...SUPRIDO_POR_FORA.keys()].filter((k) => {
    const [n, p] = k.split('/');
    return !new RegExp('function ' + n + '\\s*\\([^)]*\\b' + p + '\\b').test(app);
  });
  if (!fantasmas.length) ok('e nenhuma exceção da lista descreve um parâmetro que já não existe');
  else nao('e nenhuma exceção da lista descreve um parâmetro que já não existe', fantasmas.join(', '));
}

// ============================================================================
// UMA MARCA NO DOM QUE NINGUÉM LÊ (v1.8.79)
//
// O quinto bloco, e a outra metade do que a base ESCREVE: os quatro de cima
// varrem o que ela DECLARA (funções, a superfície do `AVDB`, constantes,
// parâmetros); uma classe posta por `classList.toggle` e um `dataset.x = …` não
// são declarações de nada — são marcação, e por isso atravessavam tudo.
//
// MEDIDO na entrada: 76 classes escritas por JS, UMA sem leitor
// (`.has-items`, cuja regra de CSS saiu na v1.5.0 e cuja doc continuava
// prometendo que o ícone da fila acende); 24 `dataset` escritos, UM sem leitor
// (`dataset.tool`, das abas de Ferramentas).
//
// O custo é o de sempre nesta classe: não é o atributo, é o PRÓXIMO LEITOR
// supor que existe consumidor e preservá-lo — ou escrever um seletor
// `[data-tool]` acreditando que a marcação já é contrato.
//
// ## "SÓ O ORÁCULO LÊ" É LEGÍTIMO AQUI, e é o oposto do primeiro bloco
//
// Lá, uma função que só o oráculo chama é PIOR que morta: ele prova que algo
// que ninguém usa funciona. Uma marca no DOM é o contrário — ela existe para
// ser AGARRADA de fora, e um `data-dest` que só o `sorteio-tela` lê É o
// contrato de teste, declarado. Por isso a pergunta aqui é só *"alguém lê?"*,
// com os oráculos contando como leitores.
//
// ## Onde a varredura desiste
//
// A busca é TEXTUAL, e leitura tem muitas formas: `classList.contains`, um
// seletor de CSS, um `[data-x=…]` escrito DENTRO do JS, o atributo no HTML.
// Todas contam. **Duas armadilhas foram medidas ao escrever este bloco**, e as
// duas produziam acusação FALSA: `dataset.x ===` casava como atribuição (o `=`
// de `===`), e um seletor de atributo dentro de uma string de JS não era
// procurado no JS. Sem as duas correções o bloco acusava quatro marcas vivas.
// ============================================================================
{
  // O CSS É LIDO AQUI, e não pelo `arquivos` lá de cima: aquele alimenta o
  // `app` dos quatro blocos anteriores, e uma classe de folha de estilo com o
  // nome de uma função passaria a contar como USO dela — o oráculo aprovaria
  // uma função morta por causa de um seletor homônimo.
  const cssFiles = [];
  (function andaCss(d) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'vendor') continue;
      const p2 = join(d, e.name);
      if (e.isDirectory()) andaCss(p2);
      else if (p2.endsWith('.css')) cssFiles.push(p2);
    }
  })(WEB);
  const cssTxt = cssFiles.map((f) => readFileSync(f, 'utf8')).join('\n');
  const jsTxt = semComentario([...corpo.entries()]
    .filter(([f]) => f.endsWith('.js')).map(([, t]) => t).join('\n'));
  const htmlTxt = [...corpo.entries()]
    .filter(([f]) => f.endsWith('.html')).map(([, t]) => t).join('\n');
  const tudoQueLe = jsTxt + '\n' + cssTxt + '\n' + htmlTxt + '\n' + oraculos;

  const semLeitor = [];

  // ----- CLASSES -----
  const escritas = new Set([...jsTxt.matchAll(/classList\.(?:toggle|add)\(\s*'([a-z][a-z0-9-]*)'/g)]
    .map((m) => m[1]));
  for (const c of escritas) {
    // O que sobra depois de tirar as ESCRITAS é tudo o que pode ser leitura:
    // `.classe` numa folha, `contains('classe')`, o atributo no HTML, um
    // seletor de oráculo.
    const semEscritas = tudoQueLe.replace(new RegExp("classList\\.(?:toggle|add)\\(\\s*'" + c + "'", 'g'), '');
    if (!new RegExp('[.\'"`\\s]' + c + '\\b').test(semEscritas)) semLeitor.push('classe `.' + c + '`');
  }

  // ----- DATASET -----
  const dsEscritos = new Set([...jsTxt.matchAll(/\.dataset\.([a-zA-Z][\w]*)\s*=(?!=)/g)].map((m) => m[1]));
  for (const n of dsEscritos) {
    const kebab = 'data-' + n.replace(/[A-Z]/g, (ch) => '-' + ch.toLowerCase());
    // Tira as ATRIBUIÇÕES; o que casar depois é leitura — inclusive o `===`.
    const semEscritas = tudoQueLe.replace(new RegExp('dataset\\.' + n + '\\s*=(?!=)', 'g'), '');
    const lido = new RegExp('dataset\\.' + n + '\\b').test(semEscritas)
      || new RegExp('\\[' + kebab + '\\b').test(semEscritas)
      || new RegExp('getAttribute\\([\'"]' + kebab + '[\'"]').test(semEscritas);
    if (!lido) semLeitor.push('`dataset.' + n + '` (' + kebab + ')');
  }

  // A PREMISSA: um recorte quebrado zera as duas listas e o bloco passa por
  // AUSÊNCIA. MEDIDO ao escrever: 76 classes e 24 `dataset`.
  const vistas = escritas.size + dsEscritos.size;
  if (escritas.size >= 40 && dsEscritos.size >= 15) {
    ok('as marcas do DOM foram varridas (' + escritas.size + ' classes, ' + dsEscritos.size + ' `dataset`)');
  } else {
    nao('as marcas do DOM foram varridas',
      'só ' + vistas + ' marca(s) — o recorte do `classList`/`dataset` falhou');
  }

  if (!semLeitor.length) ok('e toda marca escrita no DOM tem quem a leia');
  else nao('toda marca escrita no DOM tem quem a leia',
    semLeitor.join('\n\t')
    + '\n\tconserto: apague a escrita E o que a descreve (comentário e doc), no mesmo'
    + '\n\tlote. Se a marca deve existir como HOOK, o oráculo que a lê entra no MESMO'
    + '\n\tlote — é ele que a torna contrato.');
}

console.log('');
if (falhas.length) { console.log(falhas.length + ' FALHA(S).'); process.exit(1); }
console.log('Toda função da base tem chamador no app.');
