#!/usr/bin/env node
// O CICLO DE VIDA DOS DOIS SERVIÇOS EM PRIMEIRO PLANO — a forma, não o comportamento.
//
// ## Por que este oráculo existe
//
// O `SyncService` (downloads) e o `SessionService` (controles do que está no ar)
// são os dois processos que seguram o culto: um mantém o download vivo com o app
// minimizado, o outro mantém o processo fora da lista de descartáveis — e o
// processo é o dos DOIS WebViews e da `Presentation` na TV. As três armadilhas do
// ciclo de vida estão escritas por extenso no `docs/shell/SEGUNDO-PLANO.md` e no
// `SESSAO-DE-MIDIA.md`, e até a K5 elas eram SÓ PROSA: `grep -l "SyncService\|
// SessionService" tools/` devolvia vazio, e não há JUnit possível sem Robolectric
// num repositório que não compila Kotlin.
//
// O que se afirma aqui é a FORMA que cada uma dessas armadilhas deixou no
// arquivo — a ordem do `startForeground` e do `stopSelf`, a guarda que impede
// derrubar um serviço que ainda está subindo, o `onTimeout` que precisa PARAR e
// AVISAR, o `cancel` explícito do cartão na morte, e a publicação do progresso
// na main com a guarda reconferida LÁ (o "conferir-depois-agir" que a K5
// fechou). Não compila, não roda Android e não sabe se o serviço sobe: quem
// prova comportamento é o `verificar` do CI e o aparelho.
//
//   node tools/servico-em-primeiro-plano.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checar, falhas } from './checar.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const LER = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

// SÓ AS LINHAS DE CÓDIGO — o mesmo critério do `invariantes-shell` e do
// `pares-de-comentario`. Estes arquivos são documentados a cada símbolo, e um
// KDoc que CITA `startForeground` não pode satisfazer (nem reprovar) uma
// asserção sobre a chamada de verdade.
const SO_CODIGO = (texto) =>
  texto
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n');

/** A janela de código que começa na assinatura — a mesma técnica do
 *  `invariantes-shell` e do `slot-do-download`: o corpo é curto o bastante para
 *  uma janela fixa, e a janela não depende de casar chaves dentro de strings. */
const janela = (texto, assinatura, largura) => {
  const i = texto.indexOf(assinatura);
  if (i < 0) return '';
  return texto.slice(i, i + largura);
};

const SYNC = SO_CODIGO(LER('app/src/main/java/br/org/iasd/av/SyncService.kt'));
const SESS = SO_CODIGO(LER('app/src/main/java/br/org/iasd/av/SessionService.kt'));

// ===== PREMISSA =====
for (const [nome, texto] of [['SyncService', SYNC], ['SessionService', SESS]]) {
  checar(texto.length > 3000 && texto.includes('ServiceCompat.startForeground('),
    `PREMISSA: o \`${nome}.kt\` foi lido e ele publica por \`ServiceCompat.startForeground\``,
    { bytes: texto.length });
}

// ===== AS TRÊS ARMADILHAS DO SEGUNDO-PLANO, no SyncService =====
const syncStart = janela(SYNC, 'override fun onStartCommand(', 2200);
checar(syncStart.indexOf('ServiceCompat.startForeground(') >= 0
  && syncStart.indexOf('ServiceCompat.startForeground(') < syncStart.indexOf('stopSelf('),
'`startForeground` ANTES de qualquer decisão de parar: um serviço iniciado por `startForegroundService` que morre sem chamá-lo derruba o APP INTEIRO ("did not then call Service.startForeground()"), e o processo é o dos dois WebViews e da `Presentation`');

const syncStop = janela(SYNC, 'fun stop(ctx: Context)', 900);
checar(/if \(foregrounded\) ctx\.stopService/.test(syncStop),
'`stopService` só com o serviço JÁ em primeiro plano (`if (foregrounded)`): derrubá-lo com um `startForegroundService` pendente é o caminho conhecido para o app ser morto — e um item já baixado liga e desliga a proteção em milissegundos, que é exatamente essa janela');

const syncTimeout = janela(SYNC, 'override fun onTimeout(', 900);
checar(syncTimeout.includes('stopSelf(') && syncTimeout.includes('releaseWakeLock()')
  && syncTimeout.includes('onGone?.invoke()'),
'`onTimeout` (cota de `dataSync` do Android 15) PARA e AVISA: `stopSelf` dentro dos segundos que o sistema dá, o wake lock devolvido, e o `onGone` que faz o Kotlin ESQUECER que protegia — sem esse aviso o `keepAlive(true)` seguinte é tratado como repetido e o download seguinte fica sem proteção nenhuma, calado');

const syncDestroy = janela(SYNC, 'override fun onDestroy()', 1200);
checar(syncDestroy.includes('releaseWakeLock()') && syncDestroy.includes('cancel(NOTIF_ID)'),
'o `onDestroy` do SyncService devolve o wake lock e CANCELA o cartão explicitamente: ele é postado por `notify` (não por `startForeground`) e não está amarrado ao ciclo de vida do serviço — sem o cancelamento, um `setOngoing(true)` fica na gaveta para sempre');

checar(/progress = null/.test(syncDestroy),
'o `onDestroy` esquece o `progress`: sem isto o próximo serviço a subir monta o PRIMEIRO cartão com o rótulo e os bytes do trabalho ANTERIOR — e a cota de FGS é um dos caminhos que matam o serviço no meio de um lote (K5)');

// ===== A PUBLICAÇÃO DO PROGRESSO: main, e a guarda reconferida LÁ =====
const syncProgress = janela(SYNC, 'fun updateProgress(', 3000);
checar(syncProgress.includes('mainHandler.post {')
  && syncProgress.indexOf('mainHandler.post {') < syncProgress.indexOf('if (!running)'),
'o `updateProgress` publica na MAIN e reconfere `running` DENTRO do bloco: conferir na thread do WebView e publicar logo em seguida é "conferir-depois-agir", e o `onDestroy` (main) faz `running = false` + `cancel` no meio do caminho — o `notify` chegava depois dele e deixava um cartão `ongoing` eterno, sem download por trás (K5)');

// ===== AS MESMAS ARMADILHAS no SessionService =====
const sessStart = janela(SESS, 'override fun onStartCommand(', 3000);
checar(sessStart.indexOf('publish()') >= 0
  && sessStart.indexOf('publish()') < sessStart.indexOf('stopSelf(startId)'),
'o `onStartCommand` do SessionService publica ANTES de decidir parar: a cena pode acabar enquanto o serviço sobe, e sair sem `startForeground` derruba o app inteiro');

const sessStop = janela(SESS, 'private fun pararSeNadaVivo(', 900);
checar(sessStop.includes('if (!foregrounded) return')
  && sessStop.indexOf('if (!foregrounded) return') < sessStop.indexOf('stopService('),
'`pararSeNadaVivo` não derruba o serviço antes de ele estar em primeiro plano (`if (!foregrounded) return`): a janela do `startForegroundService` pendente é a mesma do SyncService');

const sessDestroy = janela(SESS, 'override fun onDestroy()', 1400);
checar(sessDestroy.includes('cancel(NOTIF_ID)') && sessDestroy.includes('release()'),
'o `onDestroy` do SessionService cancela o cartão e SOLTA a `MediaSession`: um `notify` não tem relação com o ciclo de vida do Service, e o cartão de controles é `ongoing`');

// ===== UMA REGRA DE "PUBLICAR OU RELIGAR", num lugar só (K5) =====
const regra = janela(SESS, 'private fun republicarOuIniciar(', 300);
checar(/if \(running && inst != null\) inst\.publish\(\) else iniciar\(ctx\)/.test(regra),
'a regra "publica se o serviço está de pé, senão religa" mora num helper, com `running` E `instance` na mesma guarda: ela estava escrita em cinco pontos e já tinha divergido num deles (o do telão, sem o `running`), onde a faixa entre `running = false` e `instance = null` do `onDestroy` ressuscitava o serviço que estava morrendo');

// ===== A FONTE QUE SOBREVIVE AO ESTRANGULAMENTO (revisão X2) =====
//
// O `display-status` a ~4 Hz é a ÚNICA fonte que continua chegando com o
// Controle estrangulado em segundo plano, e é ela que mantém o cartão de
// controles com o play/pause e a posição certos. Ela chegava sem asserção
// nenhuma (só a de passar pelo `republicarOuIniciar`), e o que a torna segura
// é a FORMA de três coisas — nenhuma delas visível num teste de comportamento
// sem aparelho:
//
//  1. ler e gravar `scene` DENTRO do monitor, saindo sem publicar quando não
//     há cena (o telão pode estar emitindo status de uma reprodução que o
//     Controle nem reportou);
//  2. gravar SÓ o transporte (play/pause, posição, duração), com a tolerância
//     do salto — reenviar a cada quadro seria uma republicação por quadro;
//  3. publicar DEPOIS de o monitor fechar: `publish()` salta para a main e
//     volta a chamar para cá, e segurar o monitor nesse caminho transforma a
//     correção de corrida numa fila.
const ufd = janela(SESS, 'fun updateFromDisplay(', 2600);
checar(ufd.length > 500,
  'PREMISSA: o `updateFromDisplay` foi lido (o método existe e tem corpo)',
  ufd.length + ' bytes');
checar(/synchronized\(trava\)\s*\{[\s\S]*?val s = scene \?: return/.test(ufd),
  'o `updateFromDisplay` lê a cena DENTRO do monitor e sai sem publicar sem cena (`scene ?: return`) — o `display-status` pode chegar de uma reprodução que o Controle não reportou');
checar(/POS_TOL_MS/.test(ufd)
  && /scene = s\.copy\(playing = playing, positionMs = positionMs, durationMs = dur\)/.test(ufd),
  'e grava só o TRANSPORTE (play/pause, posição, duração), com a tolerância do salto (`POS_TOL_MS`): a sessão extrapola o tempo sozinha, e só um salto precisa de reenvio');
{
  const iTrava = ufd.indexOf('synchronized(trava)');
  const iPub = ufd.indexOf('republicarOuIniciar(ctx)');
  checar(iPub > iTrava && /\n {12}\}\n/.test(ufd.slice(iTrava, iPub)),
    'e o `republicarOuIniciar` vem DEPOIS de o monitor fechar: publicar salta para a main e volta a chamar para cá, e segurar o monitor nesse caminho transforma a correção de corrida numa fila');
}

for (const [nome, assinatura] of [
  ['update', 'fun update(ctx: Context, s: Scene)'],
  ['updateFromDisplay', 'fun updateFromDisplay('],
  ['transmissaoLigada', 'fun transmissaoLigada('],
]) {
  checar(janela(SESS, assinatura, 1400).includes('republicarOuIniciar('),
    `o \`${nome}\` passa pelo helper em vez de repetir a guarda: cinco cópias da mesma regra são cinco lugares para divergir, e a divergência aqui é o serviço voltando durante a própria destruição`);
}

// ===== E O CARTÃO DA TRANSMISSÃO NÃO PODE MENTIR COM CENA NO AR =====
const atualizar = janela(SESS, 'private fun atualizarTransmissao(', 600);
checar(atualizar.includes('republicarOuIniciar(') && !/if \(scene != null\) return/.test(atualizar),
'a mudança da transmissão republica MESMO com cena no ar: a linha do endereço e da contagem é o SUBTEXTO do cartão do player desde a v5.231, e a guarda que existia ali descrevia o cartão de antes — com ela, o cartão dizia "nenhuma tela ainda" com a TV projetando, até a cena mudar');

console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
