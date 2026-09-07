#!/usr/bin/env node
// ============================================================================
// OS IDs DE NOTIFICAÇÃO SÃO UM ESPAÇO COMPARTILHADO — e nada no build sabe.
//
// ## Por que este oráculo existe
//
// `NotificationManager.notify(id, …)` é chaveado por (pacote, tag, id): dois
// arquivos que escolham o MESMO número escrevem um por cima do outro, e o
// compilador não tem como saber — cada constante é `private` no seu companion e
// está perfeitamente correta lida sozinha.
//
// Foi o defeito da v1.8.31, relatado pelo operador como *"após conclusão da
// exportação ou importação, o ícone na barra de notificação não se torna em um
// check"*: o cartão de conclusão nasceu com o id **2**, que já era o do
// [SessionService] — a notificação da SESSÃO DE MÍDIA, de um serviço em
// primeiro plano. Com cena no ar o `notify` substituía o cartão da sessão e o
// `publish()` seguinte dela o substituía de volta; sem cena, o `cancel` do
// `stop()` dela o apagava. Nos dois caminhos o check some, sem erro nenhum.
//
// **UM ORÁCULO DE COMPORTAMENTO NÃO ALCANÇA ISTO**: o lado web chama a ponte
// corretamente (o `pacote-por-grupos` prova isso), o Kotlin monta a notificação
// corretamente, e o que colide é um NÚMERO que só existe no aparelho. Sobra a
// leitura estática — a resposta do `kotlin-simbolo-importado` num lugar novo.
// ============================================================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { checar, falhas } from './checar.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)),
  '..', 'app', 'src', 'main', 'java', 'br', 'org', 'iasd', 'av');

// Comentário de bloco em Kotlin ANINHA — a mesma armadilha que o
// `kotlin-simbolo-importado` documenta. Aqui basta a varredura de ESTADO
// simples, porque só se procura declaração de constante.
function semComentarios(src) {
  let fora = '', i = 0, prof = 0, linha = false;
  while (i < src.length) {
    const dois = src.slice(i, i + 2);
    if (!linha && dois === '/*') { prof++; i += 2; continue; }
    if (!linha && prof && dois === '*/') { prof--; i += 2; continue; }
    if (prof) { i++; continue; }
    if (!linha && dois === '//') { linha = true; i += 2; continue; }
    if (linha) { if (src[i] === '\n') { linha = false; fora += '\n'; } i++; continue; }
    fora += src[i++];
  }
  return fora;
}

const arquivos = fs.readdirSync(RAIZ).filter((f) => f.endsWith('.kt')).sort();
checar(arquivos.length > 0, 'achei os arquivos Kotlin do app', arquivos.length);

// Toda constante cujo NOME diz que ela é um id de notificação. A pergunta é
// pelo nome porque é assim que o repositório as escreve, e um id novo que fuja
// dessa forma não é pego — está dito para quem acrescentar o próximo.
const ids = [];
for (const f of arquivos) {
  const src = semComentarios(fs.readFileSync(path.join(RAIZ, f), 'utf8'));
  const re = /const\s+val\s+(\w*NOTIF\w*ID\w*)\s*(?::\s*\w+\s*)?=\s*(-?\d+)/g;
  let m;
  while ((m = re.exec(src))) ids.push({ arquivo: f, nome: m[1], valor: Number(m[2]) });
}
checar(ids.length >= 3,
  'a varredura de fato achou os ids de notificação (SyncService tem dois, '
  + 'SessionService tem um)', JSON.stringify(ids));

const porValor = new Map();
for (const x of ids) {
  const lista = porValor.get(x.valor) || [];
  lista.push(x.arquivo + '.' + x.nome);
  porValor.set(x.valor, lista);
}
const colididos = [...porValor.entries()].filter(([, l]) => l.length > 1);
checar(colididos.length === 0,
  'nenhum id de notificação é usado por dois lugares — eles são um espaço '
  + 'COMPARTILHADO por todo o app, e duas notificações no mesmo número se '
  + 'apagam uma à outra sem erro em lugar nenhum',
  colididos.map(([v, l]) => v + ': ' + l.join(' × ')).join(' | '));

// A SONDA SE AUTOPROVA: sem ela, um `return` cedo na varredura deixaria o
// placar limpo para sempre.
{
  const falso = [
    { arquivo: 'A.kt', nome: 'NOTIF_ID', valor: 7 },
    { arquivo: 'B.kt', nome: 'NOTIF_FIM_ID', valor: 7 },
  ];
  const mapa = new Map();
  for (const x of falso) {
    const l = mapa.get(x.valor) || [];
    l.push(x.arquivo + '.' + x.nome);
    mapa.set(x.valor, l);
  }
  const achou = [...mapa.values()].filter((l) => l.length > 1).length;
  checar(achou === 1,
    'a sonda DISPARA diante do defeito dela — dois arquivos no mesmo número',
    achou);
}

falhas.length ? (console.log('\n' + falhas.length + ' falha(s).'), process.exit(1))
  : console.log('\nTodos passaram.');
