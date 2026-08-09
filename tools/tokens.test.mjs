// O ORÁCULO DOS TOKENS — `var(--x)` que aponta para um token que não existe.
//
// ## Por que ele existe
//
// Um `var(--nao-existe)` SEM fallback não é um erro em lugar nenhum: a
// declaração inteira computa para o valor INICIAL da propriedade. Não há aviso
// no console, o CSS carrega, a página monta, e o que se vê é um botão com
// `border-radius: 0` no meio de um app inteiro arredondado — ou uma cor que
// virou preto, ou um `gap` que sumiu.
//
// Foi exatamente isso na v5.171: `.cast-choice` (os DOIS botões principais da
// folha "Conectar uma tela") pedia `var(--radius-md)`, um token que nunca
// existiu nesta base. Os dois únicos cantos retos do aplicativo estavam
// justamente na primeira tela do recurso mais novo, e nenhuma ferramenta
// reclamou — foi preciso um par de olhos no aparelho.
//
// É a mesma família do `setInteger` numa chave `long` do `MediaFormat`, do
// `bytes` esquecido no `bgProgress` e do `slideLabel` no `nowPlaying`: falha sem
// exceção, sem log, e sem sintoma no lugar da causa. E a resposta deste
// repositório a essa família é sempre a mesma — um oráculo que a trava.
//
// ## O que ele NÃO reprova
//
// `var(--x, fallback)` COM fallback é um idioma legítimo e muito usado aqui: é
// como o JS entrega valores em tempo de execução (`--vol`, `--ch`, `--tab-w`,
// `--pv-ar`…), e o fallback é o valor de repouso. Reprovar isso quebraria meia
// dúzia de componentes que funcionam.
//
//   node tools/tokens.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');

// Toda folha da base — inclusive a do cliente do espelho, que é servida na rede
// e nunca é aberta por ninguém com um console à mão.
function folhas(dir) {
  const out = [];
  for (const nome of fs.readdirSync(dir)) {
    const p = path.join(dir, nome);
    if (fs.statSync(p).isDirectory()) {
      if (nome === 'vendor') continue;          // código buildado de terceiro
      out.push(...folhas(p));
    } else if (nome.endsWith('.css')) out.push(p);
  }
  return out;
}

const arquivos = folhas(RAIZ);
const falhas = [];
function checar(cond, msg, detalhe) {
  if (cond) console.log('ok      ' + msg);
  else { console.log('FALHOU  ' + msg + (detalhe ? '\n        ' + detalhe : '')); falhas.push(msg); }
}

checar(arquivos.length > 0, 'a base web tem folhas de estilo para varrer', String(arquivos.length));

// TODAS as definições, de TODAS as folhas: `tokens.css` é a fonte única da
// paleta, mas cada app define os próprios tokens de layout no `:root`.
const definidos = new Set();
for (const f of arquivos) {
  for (const m of fs.readFileSync(f, 'utf8').matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) definidos.add(m[1]);
}
checar(definidos.has('--accent') && definidos.has('--radius-btn'),
  'e a varredura enxerga os tokens de verdade (a paleta e a escala de raio)',
  definidos.size + ' tokens');

// E TODO uso sem fallback tem de casar com uma definição.
const orfaos = [];
for (const f of arquivos) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)\s*\)/g)) {
    if (definidos.has(m[1])) continue;
    orfaos.push(path.relative(RAIZ, f) + ':' + (s.slice(0, m.index).split('\n').length) + ' → ' + m[1]);
  }
}
checar(orfaos.length === 0,
  'nenhum `var(--x)` sem fallback aponta para um token inexistente',
  orfaos.join('\n        '));

console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
