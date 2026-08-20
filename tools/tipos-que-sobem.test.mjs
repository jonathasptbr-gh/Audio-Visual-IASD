#!/usr/bin/env node
// A LISTA DE PERMISSÃO DO DRENO EXISTE NOS DOIS LADOS — e este oráculo cobra o
// PAR.
//
// Cada tela da rede roda uma cópia do `/web/display/`, e a arquitetura inteira
// supõe UM telão. Drenado tudo passa: `display-status` a ~4 Hz de CADA tela,
// `media-ended` dobrado dando um segundo `load` em `repeat one`, `mic-status`
// de uma tela — que NEGA `getUserMedia` em silêncio, por não ter o
// `MicChromeClient` — apagando o estado do microfone VERDADEIRO.
//
// Por isso a lista é de PERMISSÃO, e por isso ela é DUPLA:
//   - `espelho/tela.js`  (`drenar`)        — evita o tráfego;
//   - `EspelhoServidor.kt` (`TIPOS_QUE_SOBEM`, na rota `POST /r`) — é a que VALE.
// "Validação que mora só no cliente não é validação" (CLAUDE.md).
//
// O KDoc do `TIPOS_QUE_SOBEM` afirmava que "o `tools/tela-rede.test.mjs` cobra
// o par". Ele não cobrava: aquele oráculo sobe um servidor de MENTIRA e nunca
// lê o `EspelhoServidor.kt`. Duas listas sem oráculo divergem no primeiro
// esquecimento — e a divergência é MUDA nos dois sentidos:
//   - tipo no servidor e não no cliente → morre no dreno, e o recurso novo
//     simplesmente não funciona nas telas;
//   - tipo no cliente e não no servidor → sobe pela rede e o servidor o
//     descarta, com o mesmo sintoma e um salto de rede a mais.
//
// Node puro, sem navegador: os dois lados são lidos como TEXTO, que é o que
// permite este teste morar no passo que BARRA o build.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const KT = join(RAIZ, 'app/src/main/java/br/org/iasd/av/EspelhoServidor.kt');
const JS = join(RAIZ, 'app/src/main/assets/web/espelho/tela.js');

const falhas = [];
const ok = (t) => console.log('ok\t' + t);
const nao = (t, extra) => { console.log('FALHOU\t' + t + (extra ? '\n\t' + extra : '')); falhas.push(t); };

// ---- lado SERVIDOR: o `setOf(...)` do TIPOS_QUE_SOBEM -----------------------
const kt = readFileSync(KT, 'utf8');
const mKt = kt.match(/TIPOS_QUE_SOBEM\s*=\s*setOf\(([^)]*)\)/);
if (!mKt) {
  nao('achei o `TIPOS_QUE_SOBEM` no EspelhoServidor.kt',
      'sem ele este oráculo não mede nada — não deixe passar por ausência');
} else {
  const servidor = [...mKt[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort();
  ok(`servidor (EspelhoServidor.kt): ${servidor.join(', ')}`);

  // ---- lado CLIENTE: o que o `drenar()` do tela.js deixa SUBIR --------------
  // O dreno é uma cadeia de `if (msg.type === '…')` que chama `subir(...)`.
  // Ler o corpo da função como texto é frágil de propósito: se alguém mudar a
  // FORMA do dreno, este oráculo reprova e obriga a reescrever a leitura junto
  // — que é melhor que medir a forma antiga em silêncio.
  const js = readFileSync(JS, 'utf8');
  const mFn = js.match(/function drenar\(msg\)\s*\{([\s\S]*?)\n  \}/);
  if (!mFn) {
    nao('achei o corpo do `drenar()` no espelho/tela.js',
        'a forma do dreno mudou; reescreva a leitura deste oráculo');
  } else {
    const corpo = mFn[1];
    // fora comentários, para não casar um tipo citado em prosa
    const semCom = corpo.replace(/\/\*[\s\S]*?\*\//g, ' ')
      .split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
    const cliente = [...semCom.matchAll(/msg\.type\s*===\s*'([^']+)'/g)].map((m) => m[1]).sort();
    ok(`cliente (espelho/tela.js): ${cliente.join(', ')}`);

    if (!cliente.length) {
      nao('o dreno do cliente aceita ALGUM tipo', 'lista vazia = leitura quebrada, não dreno mudo');
    }

    // O `display-status` SOBE RENOMEADO para `tela-status` — sem nome próprio,
    // tudo que espera "o telão" o receberia por engano.
    const RENOMEIA = { 'display-status': 'tela-status' };
    const clienteNoFio = cliente.map((t) => RENOMEIA[t] || t).sort();
    ok(`cliente, como chega no fio: ${clienteNoFio.join(', ')}`);

    const soNoCliente = clienteNoFio.filter((t) => !servidor.includes(t));
    const soNoServidor = servidor.filter((t) => !clienteNoFio.includes(t));

    if (soNoCliente.length) {
      nao('nenhum tipo sobe do cliente sem o servidor aceitar',
          `só no cliente: ${soNoCliente.join(', ')} — sobe pela rede e o servidor descarta, calado`);
    } else ok('nenhum tipo sobe do cliente sem o servidor aceitar');

    if (soNoServidor.length) {
      nao('nenhum tipo é aceito pelo servidor sem o cliente enviar',
          `só no servidor: ${soNoServidor.join(', ')} — o dreno o mata antes, e o recurso não funciona`);
    } else ok('nenhum tipo é aceito pelo servidor sem o cliente enviar');

    // O `display-ready` é o único que passa INTEIRO, e é ele que dispara o
    // reenvio das preferências pelo carimbo `__tela`.
    if (cliente.includes('display-ready')) ok('`display-ready` passa — é o que faz a tela se recuperar sozinha');
    else nao('`display-ready` passa', 'sem ele a tela fica no wallpaper até alguém tocar em algo');
  }
}

console.log('');
if (falhas.length) {
  console.log(`${falhas.length} FALHA(S) — as duas listas do dreno divergiram.`);
  process.exit(1);
}
console.log('As duas metades do dreno concordam.');
