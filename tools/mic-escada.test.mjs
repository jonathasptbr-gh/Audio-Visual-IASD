// A ESCADA DE CAPTURA DO MICROFONE — as propriedades que a fazem abrir.
//
// ## O defeito que este arquivo existe para impedir
//
// Com `echoCancellation` o Chromium abre o `AudioRecord` em
// `VOICE_COMMUNICATION`, e o Android RECUSA essa sessão quando a saída de áudio
// está em outro caminho — que é o caso deste app **com espelhamento ligado**,
// isto é, o modo normal de um culto com TV. O microfone cru não passa por ali e
// abre. Daí a escada de três degraus do `startMic` (display.js): ela não é
// estética, é o que separa "o microfone funciona no culto" de "o microfone
// funciona na bancada".
//
// ## ERA UM PAR, E DEIXOU DE SER (v1.2.16)
//
// Até aqui este arquivo guardava DUAS escadas: a do `startMic` e a do
// `iniciarRecado` (o RECADO, o microfone estilo walkie-talkie que gravava no
// WebView do Controle). Ele nasceu porque o recado saiu com UM degrau só e o
// operador recebeu "O Android não liberou o microfone" no primeiro toque, com o
// espelhamento no ar — o comentário que explicava tudo isso já existia no
// `display.js`, foi lido e não foi aplicado.
//
// O RECADO SAIU. Ele existia para cobrir os modelos SEM TV, onde o microfone ao
// vivo não abria — e a razão de não abrir era um defeito nosso
// (`MODIFY_AUDIO_SETTINGS` fora do manifest, v1.2.13), não uma limitação da
// arquitetura. Sobra UMA escada, e as asserções de PAREAMENTO saíram com a
// segunda: guardar a igualdade de um par de um só é medir nada.
//
// O QUE FICA É O QUE SEMPRE IMPORTOU: as propriedades da escada que sobrou. Uma
// igualdade entre duas escadas nunca provou que elas estavam CERTAS — aprovaria
// duas igualmente erradas —, e são estas linhas que respondem por isso.
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

// A escada é um literal de array com três entradas. Extrai o TEXTO dela e afirma
// sobre o CONTEÚDO (quais opções, em que ordem), nunca sobre a formatação.
function escadaDe(src, nome) {
  const m = new RegExp('const ' + nome + '\\s*=\\s*\\[([\\s\\S]*?)\\];').exec(src);
  return m ? m[1].replace(/\/\/[^\n]*/g, '').replace(/\s+/g, ' ').trim() : null;
}

const display = ler('app/src/main/assets/web/display/display.js');
const controle = ler('app/src/main/assets/web/controle/controle.js');

const aVivo = escadaDe(display, 'TENTATIVAS');
checar(!!aVivo, 'a escada do AO VIVO existe (display.js `TENTATIVAS`)', String(aVivo));

// O RECADO NÃO PODE VOLTAR PELA PORTA DOS FUNDOS. Se um segundo caminho de
// captura reaparecer no Controle sem que este arquivo volte a guardar o par, o
// defeito de origem (um degrau só, num WebView diferente) volta com ele — e
// volta MUDO, porque não haveria mais nada perguntando.
// Sobre o CÓDIGO, nunca sobre a prosa: o `controle.js` MENCIONA `getUserMedia`
// em comentário (ao explicar por que as telas da rede não o têm), e um teste que
// casasse com isso reprovaria o estado correto — a classe "prazo lido como
// veredito" do CLAUDE.md, na sua versão de texto.
const codigoDoControle = controle.split('\n')
  .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
checar(!/getUserMedia\s*\(/.test(codigoDoControle),
  'o CONTROLE não abre captura nenhuma — quem capta é o telão, e um segundo caminho '
  + 'aqui precisa trazer a escada e o par de volta a este oráculo',
  (codigoDoControle.match(/.{0,70}getUserMedia\s*\(.{0,40}/) || [''])[0]);

// AS TRÊS PROPRIEDADES DA ESCADA, afirmadas sobre o texto dela.
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
// zero é o mesmo defeito com outra aparência.
checar(/for\s*\(\s*let\s+i\s*=\s*0;\s*i\s*<\s*TENTATIVAS\.length/.test(display),
  'e o AO VIVO PERCORRE a escada inteira, não só o primeiro degrau — declarar sem '
  + 'iterar seria o defeito original com mais linhas');

// O ÚLTIMO RECURSO: pedir o dispositivo PELO ID em vez de aceitar o "default" do
// navegador. O `default` do Chromium é uma entrada virtual que segue o
// roteamento do sistema, e ela pode falhar enquanto o dispositivo físico abre —
// é uma pergunta diferente, não uma repetição da escada.
checar(/deviceId:\s*\{\s*exact:/.test(display),
  'o ao vivo tenta o dispositivo PELO ID depois da escada — o "default" do navegador '
  + 'é uma entrada virtual, e falhar nele não é falhar no microfone');
// E NÃO PULA O `default`, que era o contrato da v1.2.9 e o defeito dela: MEDIDO
// num aparelho, `entradas de áudio: 1` — e o id dessa entrada É `default`.
// Pular significava que a tentativa por id nunca rodava.
checar(!/d\.deviceId === 'default'\)\s*continue/.test(display),
  'e NÃO pula o "default": num aparelho com uma entrada só, o id dela é `default` — '
  + 'pulá-lo faz a tentativa por id não rodar nunca');

// A MENSAGEM DO NAVEGADOR: `NotReadableError` é o balde genérico do WebRTC, e
// sem a frase que vem junto o Registro empata em "não abriu".
checar(/e\.message\)\s*\?\s*String\(e\.message\)\.slice\(0, 120\)/.test(display),
  'o ao vivo guarda a MENSAGEM do erro, não só o nome — e a trunca, porque um Registro '
  + 'é copiado inteiro');

// E O TELÃO PRECISA MANDAR OS DEGRAUS ao Controle. Sem isso o Registro do
// celular via UMA tentativa e concluía "falhou antes de esgotar a escada" —
// enquanto o telão tinha rodado a escada inteira. Um veredito errado é pior que
// veredito nenhum, e este Registro é lido a distância.
checar(/micStatus\(false, ultimoErro, degraus\)/.test(display),
  'o telão MANDA os degraus no `mic-status` da falha — sem eles o Registro do celular '
  + 'dá um veredito sobre uma escada que ele não viu');
checar(/Array\.isArray\(msg\.degraus\)/.test(controle),
  'e o Controle os LÊ, caindo num degrau genérico só quando o bundle do telão é antigo');

// A DESISTÊNCIA ANTECIPADA: permissão negada não melhora com menos processamento,
// e insistir gasta duas chamadas para dar o mesmo erro.
checar(/NotAllowedError'\s*\|\|\s*\w+\s*===\s*'SecurityError'\)\s*break/.test(display),
  'o ao vivo DESISTE em permissão negada — os outros dois degraus dariam o mesmo erro');

console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
