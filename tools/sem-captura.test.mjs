// NENHUM CAMINHO DE CAPTURA NA BASE WEB — e o que ele custa para voltar.
//
// ## O que este arquivo guarda hoje
//
// O MICROFONE AO VIVO saiu na v1.8.89, a pedido do operador (*"remova a opção de
// microfone direto para o telão, que temos nas ferramentas"*). Ele era o ÚNICO
// caminho de captura do app: o `startMic` do `display.js`, a escada de três
// degraus que o fazia abrir, o `setMic` com a guarda de papel que impedia cada
// tela da rede de abrir o microfone DO APARELHO ONDE O NAVEGADOR RODA, e o
// `mic-status` que o dreno do `tela.js` tinha de matar.
//
// Fora tudo isso, resta uma pergunta que precisa continuar sendo feita: **um
// caminho de captura não pode voltar sozinho.** Ele volta MUDO — sem a escada,
// sem a guarda de papel, sem o dreno —, e cada uma dessas três peças existia
// porque a ausência dela produzia um defeito que ninguém via.
//
// ## ERA O `mic-escada.test.mjs` (até a v1.8.89)
//
// Aquele arquivo afirmava as PROPRIEDADES da escada: `echoCancellation: true` no
// primeiro degrau, `false` no segundo (é ele que abre o microfone quando o
// Android recusa a sessão de VOZ — o app COM ESPELHAMENTO LIGADO, isto é, o modo
// normal de um culto com TV), `true` cru no terceiro, o percurso da escada
// inteira, o pedido pelo `deviceId` depois dela e a desistência em
// `NotAllowedError`. Sem escada, não há propriedade a afirmar: as asserções
// saíram com ela, como as de PAREAMENTO tinham saído na v1.2.17 junto com o
// RECADO. O que fica é a PORTA — a mesma inversão que aquele arquivo já fazia
// para o Controle, agora para a base inteira.
//
// **A escada não se reinventa de memória, e é por isso que ela está escrita
// acima**: quem trouxer captura de volta traz também um oráculo com aquelas
// afirmações, ou traz o defeito de origem junto.
//
//   node tools/sem-captura.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checar, falhas } from './checar.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ler = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

// SOBRE O CÓDIGO, NUNCA SOBRE A PROSA. As lápides deste lote MENCIONAM
// `getUserMedia` e `mic-status` por extenso, de propósito — é o que impede a
// escada de ser reinventada de memória —, e um teste que casasse com elas
// reprovaria justamente o estado correto. É a classe "prazo lido como veredito"
// do CLAUDE.md, na versão de texto.
const semComentario = (src) => src.split('\n')
  .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

const ARQUIVOS = [
  'app/src/main/assets/web/controle/controle.js',
  'app/src/main/assets/web/display/display.js',
  'app/src/main/assets/web/espelho/tela.js',
  'app/src/main/assets/web/shared/stage.js',
  'app/src/main/assets/web/shared/db.js',
  'app/src/main/assets/web/shared/native.js',
];

for (const rel of ARQUIVOS) {
  const codigo = semComentario(ler(rel));
  checar(!/getUserMedia\s*\(/.test(codigo),
    rel.split('/').pop() + ' não abre captura nenhuma — um caminho novo aqui precisa '
    + 'trazer de volta a escada de três degraus, a guarda de papel do `setMic` e o '
    + 'dreno do `mic-status`, com um oráculo que os afirme',
    (codigo.match(/.{0,70}getUserMedia\s*\(.{0,40}/) || [''])[0]);
}

// E A PONTE NÃO SERVE MAIS O PEDIDO DE PERMISSÃO. `requestMic` e `micDiag`
// saíram do `native.js` no mesmo lote — encolher pelo WEB primeiro é o lado
// seguro, e o `@JavascriptInterface` continua no Kotlin. Se um deles voltar ao
// `native.js` sem consumidor, o `funcao-sem-chamador` reprova; se voltar COM
// consumidor, é captura de novo e as linhas acima é que respondem.
const ponte = semComentario(ler('app/src/main/assets/web/shared/native.js'));
checar(!/\brequestMic\b/.test(ponte),
  'a ponte não expõe mais `requestMic` — pedir a permissão `RECORD_AUDIO` só faz '
  + 'sentido para quem vai capturar');

console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
