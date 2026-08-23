// AS DUAS ESCADAS DE CAPTURA DO MICROFONE, e por que elas são duas.
//
// ## O defeito que este arquivo existe para impedir
//
// O app abre o microfone em DOIS lugares, por dois motivos diferentes:
//
//   display.js  `startMic`      — o AO VIVO, no WebView do telão;
//   controle.js `iniciarRecado` — o RECADO, no WebView do Controle.
//
// Os dois precisam da MESMA escada de três tentativas, e a razão não é estética:
// com `echoCancellation` o Chromium abre o `AudioRecord` em
// `VOICE_COMMUNICATION`, e o Android RECUSA essa sessão quando a saída de áudio
// está em outro caminho — que é o caso deste app **com espelhamento ligado**,
// isto é, o modo normal de um culto com TV. O microfone cru não passa por ali e
// abre.
//
// O RECADO NASCEU COM UM DEGRAU SÓ, e o desfecho foi relatado do aparelho na
// primeira vez que o operador tocou no botão: "O Android não liberou o
// microfone", com o espelhamento no ar. O comentário que explica tudo isso já
// existia no `display.js` — foi lido e não foi aplicado.
//
// ## Por que não é uma função só
//
// São dois DOCUMENTOS, em dois WebViews, com estados diferentes (o telão tem
// `micSeq`/`micWanted` e emite `mic-status`; o Controle tem `recSeq` e escreve
// `recErro`). Unificá-las exigiria um módulo compartilhado carregado pelos dois
// — e `shared/` também é carregado pelas TELAS DA REDE, que rodam em `http://`
// e não têm `getUserMedia`. O preço de manter duas é este arquivo: mesma
// solução do `tipos-que-sobem.test.mjs`, que guarda o par do dreno.
//
//   node tools/mic-escada.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const falhas = [];
function checar(cond, msg, obtido) {
  if (cond) console.log('ok      ' + msg);
  else {
    console.log('FALHOU  ' + msg + (obtido !== undefined ? '\n        obtido: ' + obtido : ''));
    falhas.push(msg);
  }
}

const ler = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

// A escada é um literal de array com três entradas. Extrai o TEXTO dela dos dois
// lados e compara depois de normalizar espaço — o que se quer travar é o
// CONTEÚDO (quais opções, em que ordem), não a formatação.
function escadaDe(src, nome) {
  const m = new RegExp('const ' + nome + '\\s*=\\s*\\[([\\s\\S]*?)\\];').exec(src);
  return m ? m[1].replace(/\/\/[^\n]*/g, '').replace(/\s+/g, ' ').trim() : null;
}

const display = ler('app/src/main/assets/web/display/display.js');
const controle = ler('app/src/main/assets/web/controle/controle.js');

const aVivo = escadaDe(display, 'TENTATIVAS');
const oRecado = escadaDe(controle, 'MIC_TENTATIVAS');

checar(!!aVivo, 'a escada do AO VIVO existe (display.js `TENTATIVAS`)', String(aVivo));
checar(!!oRecado, 'a escada do RECADO existe (controle.js `MIC_TENTATIVAS`)', String(oRecado));

checar(aVivo === oRecado,
  'AS DUAS SÃO IDÊNTICAS — mesmas opções, mesma ordem. É a ordem que faz o microfone '
  + 'abrir com o espelhamento ligado, e é o degrau que faltava no recado',
  'ao vivo: ' + aVivo + '\n        recado:  ' + oRecado);

// AS TRÊS PROPRIEDADES QUE A ESCADA PRECISA TER, afirmadas sobre o texto dela —
// uma igualdade sozinha aprovaria duas escadas igualmente ERRADAS.
checar(/echoCancellation:\s*true/.test(aVivo || ''),
  'o PRIMEIRO degrau pede cancelamento de eco: uma realimentação num culto é estrago '
  + 'público imediato, e vale tentar primeiro o modo que a evita');
checar(/echoCancellation:\s*false/.test(aVivo || ''),
  'o SEGUNDO desliga o processamento: é ele que abre o microfone quando o Android recusa '
  + 'a sessão de VOZ — o caso do app com espelhamento ligado');
checar(/,\s*true\s*,?\s*$/.test((aVivo || '').trim()),
  'e o ÚLTIMO é `true` cru — o pedido que sempre abre, sem restrição nenhuma');

const degraus = (aVivo || '').split(/\},\s*/).length;
checar(degraus >= 3,
  'são TRÊS degraus: um só era o defeito, e dois deixariam de fora o pedido cru',
  'degraus=' + degraus);

// E O CONSUMIDOR PRECISA PERCORRÊ-LA. Uma escada declarada e usada só no índice
// zero é o mesmo defeito com outra aparência — foi assim que o recado saiu.
checar(/for\s*\(\s*let\s+i\s*=\s*0;\s*i\s*<\s*MIC_TENTATIVAS\.length/.test(controle),
  'e o RECADO PERCORRE a escada inteira, não só o primeiro degrau — declarar sem iterar '
  + 'seria o defeito original com mais linhas');
checar(/for\s*\(\s*let\s+i\s*=\s*0;\s*i\s*<\s*TENTATIVAS\.length/.test(display),
  'e o AO VIVO também');

// O ÚLTIMO RECURSO, nos dois: pedir o dispositivo PELO ID em vez de aceitar o
// "default" do navegador. O `default` do Chromium é uma entrada virtual que
// segue o roteamento do sistema, e ela pode falhar enquanto o dispositivo
// físico abre — é uma pergunta diferente, não uma repetição da escada.
//
// Ele entrou depois de um Registro real em que os TRÊS degraus de restrição
// deram `NotReadableError` com `entradas de áudio: 1`: com o dispositivo à
// vista e a permissão concedida, não havia mais restrição a afrouxar.
for (const [nome, src] of [['ao vivo', display], ['recado', controle]]) {
  checar(/deviceId:\s*\{\s*exact:/.test(src),
    'o ' + nome + ' tenta o dispositivo PELO ID depois da escada — o "default" do '
    + 'navegador é uma entrada virtual, e falhar nele não é falhar no microfone');
  // E NÃO PULA O `default`, que era o contrato da v1.2.9 e o defeito dela:
  // MEDIDO num aparelho, `entradas de áudio: 1` — e o id dessa entrada É
  // `default`. Pular significava que a tentativa por id nunca rodava, e o
  // Registro seguiu marcando "3 tentativa(s)" enquanto eu anunciava quatro.
  checar(!/d\.deviceId === 'default'\)\s*continue/.test(src),
    'e NÃO pula o "default": num aparelho com uma entrada só, o id dela é `default` — '
    + 'pulá-lo faz a tentativa por id não rodar nunca');
}

// A MENSAGEM DO NAVEGADOR, nos dois: `NotReadableError` é o balde genérico do
// WebRTC, e sem a frase que vem junto o Registro empata em "não abriu".
for (const [nome, src] of [['ao vivo', display], ['recado', controle]]) {
  checar(/e\.message\)\s*\?\s*String\(e\.message\)\.slice\(0, 120\)/.test(src),
    'o ' + nome + ' guarda a MENSAGEM do erro, não só o nome — e a trunca, porque um '
    + 'Registro é copiado inteiro');
}

// E O TELÃO PRECISA MANDAR OS DEGRAUS ao Controle. Sem isso o Registro do
// celular via UMA tentativa e concluía "falhou antes de esgotar a escada" —
// enquanto o telão tinha rodado a escada inteira. Um veredito errado é pior que
// veredito nenhum, e este Registro é lido a distância.
checar(/micStatus\(false, ultimoErro, degraus\)/.test(display),
  'o telão MANDA os degraus no `mic-status` da falha — sem eles o Registro do celular '
  + 'dá um veredito sobre uma escada que ele não viu');
checar(/Array\.isArray\(msg\.degraus\)/.test(controle),
  'e o Controle os LÊ, caindo num degrau genérico só quando o bundle do telão é antigo');

// A DESISTÊNCIA ANTECIPADA, nos dois: permissão negada não melhora com menos
// processamento, e insistir gasta duas chamadas para dar o mesmo erro.
for (const [nome, src] of [['ao vivo', display], ['recado', controle]]) {
  checar(/NotAllowedError'\s*\|\|\s*\w+\s*===\s*'SecurityError'\)\s*break/.test(src),
    'o ' + nome + ' DESISTE em permissão negada — os outros dois degraus dariam o mesmo erro');
}

console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
