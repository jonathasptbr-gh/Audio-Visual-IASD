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

// ============================================================================
// E OS DOIS RELÓGIOS DA PRECEDÊNCIA (v1.8.42)
//
// `NativeBridge.snoopStatusDeFora` faz a MESMA conta que o `controle.js`: com
// um telão de verdade emitindo, `tela-status` é ruído. O hub afirma por escrito
// que "o silêncio que troca a eleita é o mesmo dos dois lados, porque duas
// contas com réguas diferentes elegeriam telas diferentes" — e MEDIDO, elas
// divergiam: 3.000 ms no Kotlin contra 2.500 no web, meio segundo em que o web
// já passara a referência à tela da rede e o Kotlin ainda suprimia o status,
// congelando a posição na notificação e na tela de bloqueio.
//
// O par IRMÃO (`TELA_REF_SILENCIO_MS`, a ELEIÇÃO entre telas) sempre bateu, e
// o KDoc de lá diz que espelha — é a prova de que a divergência era descuido, e
// não decisão. As duas entram aqui pelo mesmo motivo do dreno acima: um número
// que mora em dois arquivos e não tem oráculo diverge no primeiro ajuste.
// ============================================================================
{
  const bridge = readFileSync(join(RAIZ, 'app/src/main/java/br/org/iasd/av/NativeBridge.kt'), 'utf8');
  const controle = readFileSync(join(RAIZ, 'app/src/main/assets/web/controle/controle.js'), 'utf8');
  const num = (txt, re, nome) => {
    const m = txt.match(re);
    if (!m) { nao('achei o `' + nome + '`', 'sem ele este bloco não mede nada'); return null; }
    return Number(m[1].replace(/_/g, ''));
  };
  const pares = [
    ['precedência do telão',
      num(bridge, /PRECEDENCIA_TELAO_MS\s*=\s*([\d_]+)L/, 'PRECEDENCIA_TELAO_MS'),
      num(controle, /const DISPLAY_TIMEOUT\s*=\s*(\d+)/, 'DISPLAY_TIMEOUT'),
      'PRECEDENCIA_TELAO_MS × DISPLAY_TIMEOUT'],
    ['eleição entre telas',
      num(bridge, /TELA_REF_SILENCIO_MS\s*=\s*([\d_]+)L/, 'TELA_REF_SILENCIO_MS (kt)'),
      num(controle, /const TELA_REF_SILENCIO_MS\s*=\s*(\d+)/, 'TELA_REF_SILENCIO_MS (js)'),
      'TELA_REF_SILENCIO_MS nos dois lados'],
  ];
  for (const [nome, kt2, js2, rotulo] of pares) {
    if (kt2 === null || js2 === null) continue;
    if (kt2 === js2) ok(`a ${nome} vale ${kt2} ms nos dois lados (${rotulo})`);
    else nao(`a ${nome} vale o mesmo nos dois lados`,
      `${rotulo}: Kotlin ${kt2} ms × web ${js2} ms — duas réguas elegem telas diferentes`);
  }
}

console.log('');
if (falhas.length) {
  console.log(`${falhas.length} FALHA(S) — as duas listas do dreno divergiram.`);
  process.exit(1);
}
console.log('As duas metades do dreno concordam.');
