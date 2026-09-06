/**
 * TODA CONSTRUÇÃO DE UMA `data class` DESTE REPOSITÓRIO VAI POR NOME.
 *
 * ## O defeito que ele pega, e por que o compilador não o pega
 *
 * Uma `data class` construída POSICIONALMENTE amarra o significado de cada
 * argumento à ORDEM dos campos. Um campo acrescentado no MEIO da declaração
 * empurra todos os seguintes uma casa — e quando dois campos vizinhos têm o
 * MESMO tipo, isso COMPILA. O que sai é a chamada certa carregando os valores
 * errados, sem erro em lugar nenhum.
 *
 * NÃO É HIPÓTESE: foi a v1.8.27. O campo `baixando` entrou na
 * `SyncService.Progress` ANTES do `bytes`, e a `updateProgress` construía a
 * classe com sete argumentos sem nome. O compilador só reprovou porque AQUELA
 * assinatura ainda não tinha o parâmetro; tivesse tido, o `bytes` cairia no
 * `baixando`, a notificação voltaria a mostrar BYTES como se fossem ITENS (o
 * defeito da v5.118) e o lote sairia verde.
 *
 * NINGUÉM COMPILA KOTLIN FORA DO CI — o `./gradlew` exige o Android SDK e a
 * suíte inteira é de JavaScript. Este arquivo é o irmão do
 * `kotlin-simbolo-importado.test.mjs`: a pergunta que dá para responder sem
 * compilador, feita por leitura ESTÁTICA da fonte.
 *
 * ## A regra, e as duas coisas que ela deliberadamente NÃO cobra
 *
 * **Dois ou mais argumentos ⇒ todos por nome.** Sem exceção nomeada, e o
 * "dois" é o piso: com UM argumento não há o que deslocar.
 *
 * Uma regra por TIPO seria mais precisa — só há risco quando dois campos
 * compartilham tipo — e foi recusada por duas razões. Ela muda de veredito
 * quando a CLASSE muda, então um lote que só acrescenta um campo faria o CI
 * reprovar uma chamada que ninguém tocou; e obriga quem escreve a refazer a
 * conta de tipos para saber se a linha passa. O preço da regra simples foi
 * MEDIDO ao escrevê-la: três chamadas a mais que a de tipos não pegaria
 * (`Linha`, `Rede` de três argumentos, `Transmissao`), seis linhas no total.
 *
 * **`src/test` fica de fora.** Ali o valor esperado é escrito LITERALMENTE ao
 * lado da entrada — `assertEquals(Faixa(0, 499), alcanceDe("bytes=0-499", …))`
 * —, e é essa justaposição que prova a ordem dos campos. Nomear os argumentos
 * apagaria a testemunha. Em `src/main` não há testemunha nenhuma.
 *
 * ## NOME DE CLASSE NÃO É ÚNICO, e ignorar isso quebra o oráculo nos DOIS lados
 *
 * MEDIDO ao escrever este arquivo: há DUAS `Achado` (`EspelhoInterfaces` e
 * `ShellUpdater`, com campos completamente diferentes) e uma `Faixa` que é
 * `data class` no `EspelhoHttp` e classe COMUM no `YoutubeGrab`. Um mapa
 * chaveado pelo nome cru guarda a última declaração lida e passa a conferir
 * cada chamada contra a classe ERRADA — a primeira versão reprovou dezoito
 * argumentos corretos por isso. Daí a resolução ser por ARQUIVO: a declaração
 * do mesmo arquivo primeiro, depois a do qualificador escrito na chamada, e
 * nome ambíguo que não caia em nenhuma das duas é PULADO. Pular é o lado certo
 * do erro: acusar código correto é o que faz um oráculo ser desligado.
 */
import fs from 'node:fs';
import { checar, falhas } from './checar.mjs';

const DIR = 'app/src/main/java/br/org/iasd/av';

/**
 * A fonte SEM comentários e SEM conteúdo de string, com as linhas preservadas.
 *
 * Comentário de bloco em Kotlin ANINHA — a varredura é de ESTADO e não regex,
 * pelo motivo escrito no `kotlin-simbolo-importado.test.mjs`: um
 * `/\*[\s\S]*?\*\//` desloca os pares e tira regiões inteiras de código da
 * leitura.
 *
 * O conteúdo de uma string vira o marcador `"_"`, NUNCA espaço: aqui a
 * CONTAGEM de argumentos é a resposta, e `f(a, "")` com a string apagada vira
 * `f(a, )`, isto é, um argumento a menos. MEDIDO — com espaço, sete chamadas
 * já nomeadas apareciam como parcialmente nomeadas.
 */
function soCodigo(txt) {
  let fora = '';
  let i = 0;
  let bloco = 0;
  const vazio = (c) => (c === '\n' ? '\n' : ' ');
  while (i < txt.length) {
    const dois = txt.substr(i, 2);
    if (bloco > 0) {
      if (dois === '/*') { bloco++; fora += '  '; i += 2; continue; }
      if (dois === '*/') { bloco--; fora += '  '; i += 2; continue; }
      fora += vazio(txt[i]); i++; continue;
    }
    if (dois === '/*') { bloco = 1; fora += '  '; i += 2; continue; }
    if (dois === '//') { while (i < txt.length && txt[i] !== '\n') { fora += ' '; i++; } continue; }
    if (txt.substr(i, 3) === '"""') {
      fora += '"_"'; i += 3;
      while (i < txt.length && txt.substr(i, 3) !== '"""') { fora += vazio(txt[i]); i++; }
      i += 3; continue;
    }
    if (txt[i] === '"') {
      i++;
      while (i < txt.length && txt[i] !== '"') { if (txt[i] === '\\') i++; i++; }
      i++; fora += '"_"'; continue;
    }
    fora += txt[i]; i++;
  }
  return fora;
}

/** O conteúdo entre o `(` em [abre] e o `)` que o fecha. */
function balanceado(s, abre) {
  let n = 0;
  for (let i = abre; i < s.length; i++) {
    if (s[i] === '(') n++;
    else if (s[i] === ')') { n--; if (n === 0) return s.slice(abre + 1, i); }
  }
  return null;
}

/**
 * Os argumentos, cortados nas vírgulas de NÍVEL ZERO.
 *
 * `()`, `<>`, `[]` e `{}` contam porque um argumento legítimo os carrega
 * dentro: `Map<String, String>` num tipo, `minOf(b, tamanho - 1)` num valor, a
 * lambda de um `sortedBy`. Cortar dentro deles inventaria argumentos.
 */
function fatiar(s) {
  const fora = [];
  let atual = '';
  let par = 0, ang = 0, chave = 0, colc = 0;
  for (const c of s) {
    if (c === '(') par++; else if (c === ')') par--;
    else if (c === '<') ang++; else if (c === '>') ang--;
    else if (c === '[') colc++; else if (c === ']') colc--;
    else if (c === '{') chave++; else if (c === '}') chave--;
    if (c === ',' && !par && !ang && !chave && !colc) { fora.push(atual.trim()); atual = ''; continue; }
    atual += c;
  }
  if (atual.trim()) fora.push(atual.trim());
  return fora;
}

/** O nome de cada campo da lista de parâmetros de um construtor. */
function camposDe(dentro) {
  return fatiar(dentro)
    .map((c) => (c.match(/(?:\bval\b|\bvar\b)?\s*([A-Za-z0-9_]+)\s*:/) || [])[1])
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// AS DECLARAÇÕES, POR ARQUIVO
//
// TODA classe entra, não só as `data` — é a declaração comum do mesmo nome no
// mesmo arquivo que impede uma chamada de ser conferida contra a `data class`
// homônima de outro (a `Faixa` do `YoutubeGrab`).
function varrer(fontes) {
  const porArquivo = new Map();
  const porNome = new Map();
  for (const [f, cod] of fontes) {
    const mapa = new Map();
    for (const m of cod.matchAll(/\b(data\s+)?class\s+([A-Z][A-Za-z0-9_]*)\s*\(/g)) {
      const dentro = balanceado(cod, m.index + m[0].length - 1);
      if (dentro == null) continue;
      const d = { arquivo: f, nome: m[2], ehData: !!m[1], campos: camposDe(dentro) };
      mapa.set(m[2], d);
      if (!porNome.has(m[2])) porNome.set(m[2], []);
      porNome.get(m[2]).push(d);
    }
    porArquivo.set(f, mapa);
  }
  return { porArquivo, porNome };
}

/**
 * A QUE declaração uma chamada se refere: a do mesmo arquivo, a do arquivo que
 * o qualificador nomeia, ou — só quando o nome é único no repositório — a
 * única que existe. Nome ambíguo sem nenhuma das pistas devolve `null`.
 */
function resolver({ porArquivo, porNome }, arquivo, qualificador, nome) {
  const local = porArquivo.get(arquivo)?.get(nome);
  if (local) return local;
  const todas = porNome.get(nome) || [];
  if (qualificador) {
    const q = todas.find((d) => d.arquivo === qualificador + '.kt');
    if (q) return q;
  }
  return todas.length === 1 ? todas[0] : null;
}

/** Cada `Nome(` ou `Qualificador.Nome(` do arquivo, já com os argumentos. */
function* chamadas(cod, nome) {
  const re = new RegExp(`(^|[^A-Za-z0-9_])(?:([A-Z][A-Za-z0-9_]*)\\.)?${nome}\\s*\\(`, 'g');
  for (const m of cod.matchAll(re)) {
    // A própria declaração não é uma construção.
    if (/\bclass\s+$/.test(cod.slice(Math.max(0, m.index - 12), m.index + m[0].length - nome.length - 1))) continue;
    const dentro = balanceado(cod, m.index + m[0].length - 1);
    if (dentro == null) continue;
    yield {
      qualificador: m[2] || null,
      args: fatiar(dentro),
      linha: cod.slice(0, m.index).split('\n').length,
    };
  }
}

const NOMEADO = /^([A-Za-z0-9_]+)\s*=[^=]/;

/** As duas leituras que o oráculo faz sobre uma base. */
function auditar(fontes) {
  const decl = varrer(fontes);
  const posicionais = [];
  const invalidos = [];
  let vistas = 0;
  for (const [f, cod] of fontes) {
    for (const nome of decl.porNome.keys()) {
      for (const c of chamadas(cod, nome)) {
        const alvo = resolver(decl, f, c.qualificador, nome);
        if (!alvo || !alvo.ehData) continue;
        vistas++;
        if (c.args.length >= 2 && !c.args.every((a) => NOMEADO.test(a))) {
          posicionais.push(`${f}:${c.linha} ${nome}(${c.args.join(', ')})`);
        }
        for (const a of c.args) {
          const mm = a.match(NOMEADO);
          if (mm && !alvo.campos.includes(mm[1])) {
            invalidos.push(`${f}:${c.linha} ${nome}(… ${mm[1]} = …)`);
          }
        }
      }
    }
  }
  return { decl, posicionais, invalidos, vistas };
}

const arquivos = fs.readdirSync(DIR).filter((f) => f.endsWith('.kt')).sort();
const fontes = new Map(arquivos.map((f) => [f, soCodigo(fs.readFileSync(`${DIR}/${f}`, 'utf8'))]));
const r = auditar(fontes);

const datas = [...r.decl.porNome.values()].flat().filter((d) => d.ehData);
checar(datas.length >= 15, 'a varredura achou as `data class` do shell', String(datas.length));
checar(r.vistas > 20, 'a varredura de fato leu as construções', String(r.vistas));

checar(r.posicionais.length === 0,
  'nenhuma `data class` do shell é construída por POSIÇÃO com dois ou mais argumentos',
  r.posicionais.join(' · '));

// A conversão para nomes troca uma classe de erro por outra: o deslocamento
// silencioso sai, e entra o nome DIGITADO ERRADO. Aquele o compilador não
// pegava; este ele pega — mas o primeiro sinal seria o build falhando DEPOIS
// do merge em `main`, levando junto o lote seguinte (foi a v1.8.6).
checar(r.invalidos.length === 0,
  'todo argumento nomeado nomeia um campo que a `data class` de fato tem',
  r.invalidos.join(' · '));

// ---------------------------------------------------------------------------
// AS SONDAS SE AUTOPROVAM
//
// Sem isto, um `continue` cedo em qualquer filtro deixa a varredura muda e o
// oráculo verde PARA SEMPRE — o modo de falhar que o `geometria.test.mjs`
// resolveu do mesmo jeito. O cenário carrega as DUAS armadilhas medidas na
// base real: o nome homônimo em dois arquivos, e o homônimo que não é `data`.
const CENARIO = new Map([
  ['Um.kt', `package p
data class Alvo(val a: String, val b: String, val c: Long = 0)
class UsoUm {
    fun bom() = Alvo(a = "x", b = "y")
    fun ruim() = Alvo("x", "y")
    fun meio() = Alvo("x", b = "y")
    fun um() = Alvo("x")
    fun errado() = Alvo(a = "x", z = "y")
}`],
  ['Dois.kt', `package p
class Alvo(val q: Int, val r: Int)
class UsoDois { fun cru() = Alvo(1, 2) }`],
].map(([f, t]) => [f, soCodigo(t)]));

const s = auditar(CENARIO);
checar(s.posicionais.length === 2,
  'a sonda pega o POSICIONAL e o PARCIALMENTE nomeado, e só eles',
  s.posicionais.join(' | '));
checar(s.posicionais.every((p) => p.startsWith('Um.kt')),
  'a classe COMUM homônima de outro arquivo fica de fora',
  s.posicionais.join(' | '));
checar(s.posicionais.every((p) => p.includes('"_"')),
  'a string virou marcador e não sumiu do argumento',
  s.posicionais.join(' | '));
checar(s.invalidos.length === 1 && s.invalidos[0].includes('z'),
  'a sonda pega o argumento que nomeia um campo inexistente',
  s.invalidos.join(' | '));

if (falhas.length) {
  console.log('\n' + falhas.length + ' falha(s).');
  process.exit(1);
}
console.log('\nTodos passaram.');
