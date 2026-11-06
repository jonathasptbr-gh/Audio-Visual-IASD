// O RETORNO DE UM BOTÃO É SÓ O PULSO, SEM FRASE (v1.13.30, decisão do operador:
// "deixar exclusivamente o sinal nos botões, sem mensagens extras").
//
// `responder(btn, tipo)` tem DOIS parâmetros, e o JavaScript aceita um terceiro
// em silêncio: quem escreve a chamada acha que disse o motivo e o operador vê
// um pulso sem frase. Doze chamadas carregaram frases mortas assim até este
// lote. Node puro: lê `controle.js` e conta os argumentos de NÍVEL ZERO de
// cada `responder(`, pulando strings, template e parênteses aninhados.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checar, falhas } from './checar.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const arq = process.argv[2] || join(raiz, 'app/src/main/assets/web/controle/controle.js');
const src = readFileSync(arq, 'utf8');

// Os argumentos de nível zero a partir do `(` em `i`; null se não fechar.
function argumentos(s, i) {
  let prof = 0, n = 0, temAlgo = false;
  for (let k = i; k < s.length; k++) {
    const c = s[k];
    if (c === "'" || c === '"' || c === '`') {
      for (k++; k < s.length && s[k] !== c; k++) if (s[k] === '\\') k++;
      temAlgo = true; continue;
    }
    if (c === '(' || c === '[' || c === '{') { prof++; if (prof > 1) temAlgo = true; continue; }
    if (c === ')' || c === ']' || c === '}') {
      prof--;
      if (prof === 0) return temAlgo ? n + 1 : 0;
      continue;
    }
    if (prof === 1 && c === ',') { n++; continue; }
    if (prof >= 1 && !/\s/.test(c)) temAlgo = true;
  }
  return null;
}

const linhas = src.split('\n');
let chamadas = 0;
const comTres = [];
let assinatura = null;
const re = /(^|[^\w.$])responder\(/g;
for (let m; (m = re.exec(src));) {
  const ini = m.index + m[1].length;
  const lin = src.slice(0, ini).split('\n').length;
  const texto = linhas[lin - 1];
  if (/^\s*(\/\/|\*)/.test(texto)) continue;          // comentário
  const abre = ini + 'responder'.length;
  const n = argumentos(src, abre);
  if (/function\s+$/.test(src.slice(Math.max(0, ini - 12), ini))) { assinatura = n; continue; }
  chamadas++;
  if (n !== 2) comTres.push(lin + ': ' + texto.trim());
}

checar(assinatura === 2, '`function responder` declara DOIS parâmetros (btn, tipo)', assinatura);
checar(chamadas >= 10, 'a varredura achou as chamadas de `responder(` (premissa: ' + chamadas + ')', chamadas);
checar(comTres.length === 0,
  'toda chamada de `responder(` tem EXATAMENTE dois argumentos — sem frase', comTres);

console.log('');
if (falhas.length) { console.log(falhas.length + ' FALHA(S).'); process.exit(1); }
console.log('Todos passaram.');
