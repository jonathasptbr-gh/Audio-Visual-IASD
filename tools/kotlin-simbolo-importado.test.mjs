#!/usr/bin/env node
// TODO SÍMBOLO USADO NO KOTLIN OU ESTÁ IMPORTADO, OU VEM QUALIFICADO.
//
// ## Por que este oráculo existe
//
// **Ninguém compila Kotlin fora do CI.** O `./gradlew` exige o Android SDK, que
// a máquina de quem escreve o lote pode não ter — e quando não tem, o primeiro
// sinal de um símbolo sem `import` é o build da Release falhando, DEPOIS do
// merge em `main`. Foi exatamente o que aconteceu na v1.8.6: um
// `SystemClock.elapsedRealtime()` sem o `import android.os.SystemClock` passou
// por toda a suíte (que é de JavaScript), entrou na `main`, e derrubou o build
// do lote seguinte junto — de outra sessão, que não tinha nada com aquilo.
//
// O custo não é o erro: é ONDE ele aparece. Um símbolo faltando é trivial de
// corrigir e impossível de ver a olho, e o `node --check` da base web não olha
// para `.kt`. Este arquivo é o `node --check` do lado Kotlin, na única pergunta
// que dá para responder sem um compilador: **este nome tem de onde vir?**
//
// ## O que ele NÃO é
//
// Não é um compilador e não tenta ser. Ele não resolve tipos, não confere
// assinaturas e não sabe de genéricos. Ele responde a uma pergunta só, e ela
// pega a classe de erro que mais custa aqui.
//
//   node tools/kotlin-simbolo-importado.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checar, falhas } from './checar.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(RAIZ, 'app/src/main/java/br/org/iasd/av');

// O QUE A LINGUAGEM E O PACOTE JÁ DÃO. Kotlin importa `kotlin.*`, `kotlin.io.*`,
// `java.lang.*` e `kotlin.collections.*` por padrão, e tudo que mora no MESMO
// pacote (`br.org.iasd.av`) dispensa import. A lista abaixo é o primeiro grupo;
// o segundo é montado varrendo os próprios arquivos.
const DE_GRACA = new Set([
  'Any', 'Array', 'Boolean', 'Byte', 'ByteArray', 'Char', 'CharArray', 'CharSequence',
  'Comparable', 'Double', 'DoubleArray', 'Enum', 'Exception', 'Float', 'FloatArray',
  'Int', 'IntArray', 'Iterable', 'Iterator', 'Lazy', 'List', 'Long', 'LongArray',
  'Map', 'Math', 'Nothing', 'Number', 'Pair', 'Result', 'Regex', 'Runnable', 'Set',
  'Short', 'String', 'StringBuilder', 'System', 'Thread', 'Triple', 'Unit',
  'ArithmeticException', 'ClassCastException', 'Error', 'IllegalArgumentException',
  'IllegalStateException', 'IndexOutOfBoundsException', 'NoSuchElementException',
  'NullPointerException', 'NumberFormatException', 'RuntimeException',
  'SecurityException', 'Throwable', 'UnsupportedOperationException',
  // Objetos do stdlib que vivem sem import.
  'Charsets', 'Comparator', 'Delegates', 'Typography', 'RegexOption', 'LazyThreadSafetyMode',
  // `java.lang.*` é importado por padrão, e as caixas dele aparecem por causa
  // das constantes (`Integer.MAX_VALUE` é o teto do `available()` — ver a
  // invariante 8).
  'Integer', 'Character', 'Boolean', 'Void', 'Class', 'Object', 'Runtime',
  // O `R` do Android é gerado pelo build no pacote do app.
  'R',
]);

const arquivos = fs.readdirSync(DIR).filter((f) => f.endsWith('.kt')).sort();
checar(arquivos.length > 0, 'achei os arquivos Kotlin do app', String(arquivos.length));

// PRIMEIRO PASSO: o que cada arquivo DECLARA no topo. São nomes do mesmo
// pacote, e o pacote não precisa de import — então eles valem para TODOS.
const doPacote = new Set();
const fonte = new Map();
for (const f of arquivos) {
  const txt = fs.readFileSync(path.join(DIR, f), 'utf8');
  fonte.set(f, txt);
  for (const m of txt.matchAll(/(?:class|object|interface)\s+([A-Z][A-Za-z0-9_]*)/g)) {
    doPacote.add(m[1]);
  }
}

// SEGUNDO PASSO: o que cada arquivo declara COMO MEMBRO — as constantes de
// `companion object` (`const val FAIXA = ...`) e os `val` de nome maiúsculo.
// Elas são visíveis no arquivo sem import nenhum, e tratá-las como símbolo
// externo faria o oráculo acusar código correto em massa.
const membros = new Map();
for (const f of arquivos) {
  const nomes = new Set();
  for (const m of fonte.get(f).matchAll(/\b(?:const\s+)?(?:val|var)\s+([A-Z][A-Za-z0-9_]*)/g)) {
    nomes.add(m[1]);
  }
  // As ENTRADAS de um enum também: `enum class X { UM, DOIS }`.
  for (const m of fonte.get(f).matchAll(/enum\s+class\s+[A-Za-z0-9_]+[^{]*\{([^}]*)\}/g)) {
    for (const e of m[1].split(/[,;\n]/)) {
      const t = e.trim().match(/^([A-Z][A-Z0-9_]*)/);
      if (t) nomes.add(t[1]);
    }
  }
  membros.set(f, nomes);
}

/**
 * TIRA COMENTÁRIOS E LITERAIS — com um VARREDOR, e não com regex.
 *
 * A primeira versão deste arquivo usou `replace(/\/\*[\s\S]*?\*\//g, ' ')`, e
 * ela SILENCIOU o oráculo: comentário de bloco em Kotlin ANINHA, e um `/*`
 * dentro de um KDoc desloca todos os pares seguintes — regiões inteiras de
 * código viravam "comentário" e saíam da varredura. MEDIDO: com aquele regex, o
 * próprio defeito que este arquivo veio pegar (o `SystemClock` sem import, na
 * linha 2270 do `MainActivity.kt`) passava batido.
 *
 * Um oráculo que não vê o que veio ver é pior que oráculo nenhum: ele dá o
 * verde e a pergunta deixa de ser feita.
 */
function soCodigo(txt) {
  let fora = '';
  let i = 0;
  let nivelBloco = 0;
  while (i < txt.length) {
    const dois = txt.substr(i, 2);
    if (nivelBloco > 0) {
      if (dois === '/*') { nivelBloco++; i += 2; continue; }
      if (dois === '*/') { nivelBloco--; i += 2; continue; }
      i++; continue;
    }
    if (dois === '/*') { nivelBloco = 1; i += 2; fora += ' '; continue; }
    if (dois === '//') { while (i < txt.length && txt[i] !== '\n') i++; fora += ' '; continue; }
    if (txt.substr(i, 3) === '"""') {
      i += 3;
      while (i < txt.length && txt.substr(i, 3) !== '"""') i++;
      i += 3; fora += '""'; continue;
    }
    if (txt[i] === '"') {
      i++;
      while (i < txt.length && txt[i] !== '"') { if (txt[i] === '\\') i++; i++; }
      i++; fora += '""'; continue;
    }
    fora += txt[i]; i++;
  }
  return fora;
}

let usos = 0;
for (const f of arquivos) {
  const txt = fonte.get(f);
  // O QUE ESTE ARQUIVO IMPORTA. `import a.b.C` dá `C`; `import a.b.C as D` dá
  // `D`; um `import a.b.*` desliga a conferência do arquivo — não dá para saber
  // o que ele traz sem resolver o classpath, e reprovar por não saber seria
  // acusar código correto.
  const importados = new Set();
  let curinga = false;
  for (const m of txt.matchAll(/^import\s+([A-Za-z0-9_.]+)(?:\s+as\s+([A-Za-z0-9_]+))?/gm)) {
    if (m[1].endsWith('.*')) { curinga = true; continue; }
    importados.add(m[2] || m[1].split('.').pop());
  }
  if (curinga) continue;

  const codigo = soCodigo(txt);

  // O USO: um nome Maiúsculo seguido de ponto, que NÃO venha depois de outro
  // ponto (aí ele é o segmento de um nome já qualificado, como o `os` de
  // `android.os.SystemClock`) nem depois de uma letra.
  const faltando = new Set();
  for (const m of codigo.matchAll(/(^|[^A-Za-z0-9_.])([A-Z][A-Za-z0-9_]*)\s*\./g)) {
    const nome = m[2];
    usos++;
    if (DE_GRACA.has(nome) || doPacote.has(nome) || importados.has(nome)
        || membros.get(f).has(nome)) continue;
    faltando.add(nome);
  }
  checar(faltando.size === 0,
    f + ': todo símbolo usado tem import, é do pacote, ou vem qualificado',
    [...faltando].join(', '));
}

checar(usos > 100, 'a varredura de fato leu os arquivos (usos encontrados)', String(usos));

if (falhas.length) {
  console.log('\n' + falhas.length + ' falha(s).');
  process.exit(1);
}
console.log('\nTodos passaram.');
