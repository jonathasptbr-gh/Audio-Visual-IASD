// AS LISTAS QUE MORAM EM DUAS LINGUAGENS, E QUE TÊM DE CONCORDAR.
//
// Este oráculo é irmão do `tipos-que-sobem.test.mjs`, e existe pela mesma razão
// que ele: **uma lista escrita duas vezes, em dois arquivos, diverge no
// primeiro esquecimento — e a divergência é MUDA.** Ali eram o dreno do papel
// `tela` e o `TIPOS_QUE_SOBEM`; aqui são o contrato da segunda casca.
//
// Ele lê os ARQUIVOS DE VERDADE, nunca uma cópia: uma terceira escrita da lista
// dentro do próprio teste seria mais um lugar para envelhecer.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ler = (p) => fs.readFileSync(path.join(raiz, p), 'utf8');

let falhas = 0;
const checar = (ok, o) => { if (ok) { console.log('  . ' + o); } else { falhas++; console.error('  x ' + o); } };

// ---------------------------------------------------------------------------
// 1. O DEGRAU DO CONTRATO É UM SÓ — e ele mora em DOIS arquivos.
//
// `NativeBridge.SHELL_VERSION` (Kotlin/Android) e `Programa.SHELL` (C#) medem a
// MESMA coisa: a superfície da ponte, que é uma só para as duas cascas. O
// bundle declara `minShell` e é comparado contra ele **nos dois lados**.
//
// Divergindo, o modo de falhar é o pior que este projeto conhece: o computador
// declara um contrato que não cumpre (ou recusa um bundle que rodaria), e o
// `native.js` chama um método que a folha não tem — `TypeError` engolido pelo
// `catch`, com o botão mudo em culto.
console.log('o degrau do contrato:');
{
  const kt = ler('app/src/main/java/br/org/iasd/av/NativeBridge.kt');
  const cs = ler('windows/AudioVisualIASD/Programa.cs');
  const vKt = /const val SHELL_VERSION = (\d+)/.exec(kt);
  const vCs = /const int SHELL = (\d+)/.exec(cs);
  checar(!!vKt, 'o Android declara SHELL_VERSION');
  checar(!!vCs, 'a casca declara SHELL');
  if (vKt && vCs) {
    checar(vKt[1] === vCs[1],
      `Android=${vKt[1]} e casca=${vCs[1]} — a superfície da ponte é UMA, o número tem de ser um`);
  }

  // E o PISO do bundle não pode passar dos dois.
  const vj = JSON.parse(ler('app/src/main/assets/web/version.json'));
  checar(Number(vj.minShell) <= Number(vKt?.[1] ?? 0),
    `o bundle pede minShell ${vj.minShell} e o shell oferece ${vKt?.[1]}`);
}

// ---------------------------------------------------------------------------
// 2. O QUE O NÚCLEO MANDA PARA A CASCA, A CASCA TEM DE SABER RECEBER.
//
// `NucleoDespacho.DA_CASCA` (Kotlin) diz o que atravessa o cano; o `switch` de
// `Folhas.Atender` (C#) diz o que a casca responde. **Um método em DA_CASCA sem
// `case` correspondente não trava nada** — ele cai no `default`, resolve `null`
// e entra em `SemDono`, que é um destino legítimo e visível.
//
// O que este teste trava é o INVERSO, que é mudo: um `case` que a casca
// implementa e que o núcleo **nunca lhe manda**. O método existe, funciona,
// está testado à mão — e nunca é chamado, porque o despacho o resolve `null`
// antes de chegar ao cano. Código que parece pronto e nunca roda.
console.log('\no que atravessa o cano:');
{
  const kt = ler('core/src/main/kotlin/br/org/iasd/av/NucleoDespacho.kt');
  const i = kt.indexOf('val DA_CASCA = setOf(');
  const daCasca = new Set([...kt.slice(i, kt.indexOf(')', i)).matchAll(/"(\w+)"/g)].map((m) => m[1]));
  const cases = new Set([...ler('windows/AudioVisualIASD/Folhas.cs').matchAll(/case "(\w+)":/g)].map((m) => m[1]));

  checar(daCasca.size > 0 && cases.size > 0, `DA_CASCA tem ${daCasca.size}, a casca responde ${cases.size}`);

  const orfaos = [...cases].filter((m) => !daCasca.has(m));
  checar(orfaos.length === 0,
    'a casca não responde nada que o núcleo não lhe mande: ' + (orfaos.join(', ') || 'nenhum órfão'));

  // O outro sentido NÃO é erro — é a lista do que falta, e ela é ESPERADA
  // enquanto os lotes 4 a 7 não chegarem. O que o teste cobra é que ela seja
  // exatamente a que a documentação afirma, para o `docs/SEGUNDA-CASCA.md` §7
  // não envelhecer em silêncio.
  const semCase = [...daCasca].filter((m) => !cases.has(m)).sort();
  const doDoc = [...ler('docs/SEGUNDA-CASCA.md')
    .matchAll(/casca, \*\*declarado e ainda não implementado\*\* \| \d+ \| ([^|]+)\|/g)]
    .flatMap((m) => [...m[1].matchAll(/`(\w+)`/g)].map((x) => x[1])).sort();
  checar(doDoc.length > 0, 'a documentação declara a lista do que falta na casca');
  checar(JSON.stringify(semCase) === JSON.stringify(doDoc),
    `o §7 do documento diz [${doDoc}] e o código diz [${semCase}]`);
}

// ---------------------------------------------------------------------------
// 3. OS PRIVILEGIADOS SÃO OS MESMOS QUE A DOCUMENTAÇÃO NOMEIA.
//
// A invariante 9 é a única guarda deste projeto cujo custo de errar é o disco
// do operador e um servidor na rede da igreja. A lista dela não pode divergir
// do que o contrato afirma.
console.log('\na invariante 9:');
{
  const kt = ler('core/src/main/kotlin/br/org/iasd/av/NucleoDespacho.kt');
  const i = kt.indexOf('val PRIVILEGIADOS = setOf(');
  const priv = [...kt.slice(i, kt.indexOf(')', i)).matchAll(/"(\w+)"/g)].map((m) => m[1]).sort();
  checar(priv.length === 6, `são ${priv.length} privilegiados`);
  for (const m of ['pickFolder', 'listFolder', 'pickDoc', 'openExternal', 'espelhoLigar', 'espelhoLigarEm']) {
    checar(priv.includes(m), `${m} está na lista`);
  }
}

if (falhas) { console.error(`\n${falhas} asserção(ões) reprovada(s)`); process.exit(1); }
console.log('\ncasca-contrato: tudo certo');
