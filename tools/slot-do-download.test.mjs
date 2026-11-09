#!/usr/bin/env node
// O DOWNLOAD DO YOUTUBE TEM UM SLOT SÓ — e é UMA thread que o guarda.
//
// ## Por que este oráculo existe
//
// O `YoutubeGrab` guarda os desfechos de download (`resgates`), o pedido de
// cancelamento em UM campo (`cancelarLink`) e os pedaços de UM arquivo em curso
// (`parciais`) — três estados SEM chave, e todos eles partem da mesma premissa:
// **existe no máximo um download por vez**. Quem sustenta a premissa não é o
// `YoutubeGrab`: é a fila `transferencia` do `NativeBridge`, declarada de uma
// thread só por decreto ("Continua sendo UMA THREAD, e isso é invariante").
//
// A premissa se quebra sem erro nenhum se alguém mover o `ytFetch` para outra
// fila, der uma segunda thread à `transferencia` ou abrir um quarto método de
// download que não passe pelo `ytFetchInterno`. O sintoma no culto: um pedido
// de cancelar que mata o download ERRADO, um desfecho guardado que some quando
// outro download chega, um parcial retomado sobre o arquivo de outra faixa. É a
// mesma família do `invariantes-shell` (K1) e do `ponte-guarda-host` (K2):
// forma, não comportamento — e é só a forma que dá para provar sem aparelho,
// num repositório onde o Kotlin não compila.
//
// A segunda metade trava as GUARDAS que nasceram de defeito medido, cada uma
// escrita no KDoc do próprio símbolo:
//
//   - o `cancelarLink` PRESERVADO quando nomeia o link que está na vez —
//     apagá-lo aqui fazia o cancelamento chegar e o download de ~300 MB
//     continuar;
//   - o `cancelarLink` LIMPO no `finally` quando nomeia este link — sem isso um
//     cancelamento que chegou tarde matava o download SEGUINTE do mesmo vídeo;
//   - o `cancelado()` consultado DENTRO do laço de cópia — é o sinalizador que
//     substituiu `Thread.interrupt()`;
//   - a conferência da URL no `parciais` — sem ela, um parcial do itag 137 era
//     "retomado" pelo 136 (mesmo contêiner, mesmo caminho) e saía um arquivo com
//     dois vídeos emendados, sem erro nenhum;
//   - a forma do pedido no `resgatar` (`link` + `soAudio` + `teto`) — devolver o
//     m4a de ontem para quem hoje pediu vídeo é entregar o formato errado com
//     sucesso.
//
// ## O que ele NÃO é
//
// Não compila, não resolve tipo e não sabe se o laço roda. Quem prova
// comportamento é o `verificar` do CI (o JUnit e o build do APK) e o culto.
//
//   node tools/slot-do-download.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checar, falhas } from './checar.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const LER = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

// SÓ AS LINHAS DE CÓDIGO — o mesmo critério do `invariantes-shell` e do
// `pares-de-comentario`. Este arquivo é documentado a cada símbolo, e o KDoc do
// `transferencia` CITA `newSingleThreadExecutor`: um comentário não pode
// satisfazer (nem reprovar) uma asserção sobre a declaração.
const SO_CODIGO = (texto) =>
  texto
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n');

const PONTE = SO_CODIGO(LER('app/src/main/java/br/org/iasd/av/NativeBridge.kt'));
const GRAB = SO_CODIGO(LER('app/src/main/java/br/org/iasd/av/YoutubeGrab.kt'));

/** A janela de código que começa na assinatura — a mesma técnica do
 *  `invariantes-shell`: o corpo é curto o bastante para uma janela fixa, e a
 *  janela não depende de casar chaves dentro de strings de JSON. */
const janela = (texto, assinatura, largura) => {
  const i = texto.indexOf(assinatura);
  if (i < 0) return '';
  return texto.slice(i, i + largura);
};

// ===== A PREMISSA: uma fila, uma thread, uma porta de entrada =====
checar(
  /private val transferencia = Executors\.newSingleThreadExecutor/.test(PONTE),
  'a fila `transferencia` é de UMA thread (é ela que sustenta o slot único do `YoutubeGrab`; com duas, o cancelamento e o desfecho guardado deixam de ter dono)',
);

const ytFetch = janela(PONTE, 'private fun ytFetchInterno(', 2600);
checar(
  ytFetch.includes('transferencia.execute'),
  'o download (`ytFetchInterno`) roda na fila `transferencia`',
);
checar(
  !ytFetch.includes('io.execute'),
  'e NÃO na fila `io` — a mesma mistura que fazia `listFolder`/`otaPending` responderem vazio atrás de um vídeo de minutos',
);

for (const metodo of ['fun ytFetch(', 'fun ytFetchAudio(', 'fun ytFetchAte(']) {
  const corpo = janela(PONTE, metodo, 300);
  checar(
    corpo.includes('ytFetchInterno('),
    `\`${metodo.replace('fun ', '').replace('(', '')}\` desemboca no \`ytFetchInterno\` (uma porta de entrada só; um método novo com executor próprio quebraria o slot calado)`,
  );
}

checar(
  janela(PONTE, 'fun ytDiscard(', 300).includes('transferencia.execute'),
  'o `ytDiscard` roda na MESMA fila: ele apaga o arquivo em que o download escreve, e fora dali poderia apagar o parcial de um download em curso',
);

// ===== O SLOT: dois campos simples, @Volatile, e ninguém mais =====
checar(
  /@Volatile private var baixandoLink: String\? = null/.test(GRAB) &&
    /@Volatile private var cancelarLink: String\? = null/.test(GRAB),
  'o slot do download são DOIS campos `@Volatile` (o link em curso e o pedido de parar), e não um registro por chave',
);

const cancelarFn = janela(GRAB, 'fun cancelar(link: String)', 1200);
checar(
  !cancelarFn.includes('execute') && !cancelarFn.includes('.interrupt('),
  'o `cancelar()` só ESCREVE o campo — sem fila, sem interrupção de thread (a `transferencia` está ocupada justamente pelo download que se quer parar)',
);

checar(
  /fun cancelar\(link: String\) \{\s*if \(baixandoLink != null\) cancelarLink = link\s*\}/.test(GRAB),
  'o `cancelar()` só ARMA com um download em voo: armado sem alvo, o campo sobrevivia ao próximo download do MESMO link e o matava no primeiro bloco (cartão vermelho em dois segundos, sem rede, diagnóstico "cancelado pelo operador" para um pedido que ninguém fez)',
);

checar(
  /if \(cancelarLink != link\) cancelarLink = null/.test(GRAB),
  'o cancelamento que NOMEIA o link da vez é preservado ao começar (`cancelarLink != link`): apagá-lo fazia o pedido chegar com o item ainda enfileirado e os ~300 MB baixarem assim mesmo',
);

const finalmente = janela(GRAB, 'private fun buscarInterno(', 14000);
checar(
  /baixandoLink = null/.test(finalmente) &&
    /if \(cancelarLink == link\) cancelarLink = null/.test(finalmente),
  'o `finally` do download LIMPA os dois campos (um cancelamento que chegou depois do fim mataria o download seguinte do mesmo vídeo)',
);

const cancelado = janela(GRAB, 'private fun cancelado()', 300);
checar(
  /cancelarLink \?: return false/.test(cancelado) && /alvo == baixandoLink/.test(cancelado),
  '`cancelado()` só responde SIM para o pedido que nomeia o download EM CURSO',
);

const pedaco = janela(GRAB, 'private fun baixarPedaco(', 3000);
checar(
  /if \(cancelado\(\)\) throw IOException\(CANCELADO\)/.test(pedaco),
  'o laço de cópia CONSULTA o cancelamento a cada bloco (é ele que substitui o `Thread.interrupt()`, que mataria a conexão com socket meio aberto)',
);

// ===== O CACHE: o parcial só é retomado pela MESMA URL =====
checar(
  /private val parciais = java\.util\.concurrent\.ConcurrentHashMap<String, Pedacos>\(\)/.test(GRAB),
  'os parciais em curso são um `ConcurrentHashMap` por CAMINHO (o arquivo é nomeado por vídeo + contêiner, e dois itags do mesmo contêiner escrevem no mesmo caminho)',
);

checar(
  /anterior != null && anterior\.url == url && destino\.isFile/.test(GRAB),
  'a retomada exige a MESMA URL — sem esta conferência, o parcial do itag 137 era emendado com o 136 e saía um vídeo de dois pedaços, sem erro nenhum',
);

// ===== O DESFECHO GUARDADO: um registro POR PEDIDO (X2, v1.13.50) =====
//
// Era um SLOT ÚNICO, e isso era um defeito: baixar o vídeo B apagava o
// desfecho do A, e a página que ainda ia reclamá-lo pedia o download de novo —
// com o arquivo do A ficando no cache sem dono. Hoje é um registro podado,
// chaveado pelo PEDIDO (link, forma e teto); devolver o m4a de ontem para quem
// pediu vídeo continuaria sendo entregar o formato errado com sucesso.
const chave = janela(GRAB, 'private fun chaveDeResgate(', 400);
checar(
  /"\$link\|\$soAudio\|\$teto"/.test(chave),
  'a chave do desfecho guardado é o PEDIDO inteiro — link, forma (`soAudio`) e teto',
);
const resgatar = janela(GRAB, 'fun resgatar(', 900);
checar(
  /val chave = chaveDeResgate\(link, soAudio, teto\)/.test(resgatar)
  && /resgates\[chave\] \?: return null/.test(resgatar),
  'e a consulta é feita POR essa chave — não há mais um slot que o download seguinte sobrescreve',
);
checar(
  /if \(!File\(r\.arquivo\)\.isFile\) \{ resgates\.remove\(chave\); return null \}/.test(resgatar),
  'e o desfecho guardado MORRE se o arquivo sumiu (a faxina do sistema apaga o cache): um resultado apontando para arquivo inexistente é pior que resultado nenhum',
);
const guardar = janela(GRAB, 'private fun guardarResgate(', 600);
checar(
  /resgates\[chaveDeResgate\(link, soAudio, teto\)\] = Resgate\(json, caminho\)/.test(guardar)
  && /while \(resgates\.size > RESGATES_MAX\)/.test(guardar)
  && /private const val RESGATES_MAX = 4/.test(GRAB),
  'o registro é PODADO no mais antigo (`RESGATES_MAX`): sem teto, uma sessão de culto o faria crescer sem limite — e o despejo NÃO apaga o arquivo, que pode estar sendo copiado pelo `fetch` da página',
);

// ===== A BARRA: o último número que o operador vê não anda para trás =====
checar(
  /@Synchronized fun fechar\(bytes: Long\) \{[\s\S]{0,500}?maxOf\(bytes, maior\)/.test(GRAB),
  'o `fechar()` da barra passa pela MESMA régua do `emitir` (`maxOf(bytes, maior)`): ele é chamado com a soma das partes e depois com o tamanho do arquivo montado, que é MENOR — e o último número na tela voltava alguns MB',
);

console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
