#!/usr/bin/env node
// A INVARIANTE 9, MÉTODO A MÉTODO: TODO MÉTODO DA PONTE OU RECUSA SEM `host`,
// OU TEM UM MOTIVO DECLARADO PARA NÃO RECUSAR.
//
// ## Por que este oráculo existe
//
// A invariante 9 diz que a ponte do TELÃO nasce com `host = null`, e que por
// isso a superfície privilegiada (pasta, arquivo, espelho, instalação de APK)
// não existe naquele documento. O `invariantes-shell.test.mjs` prova as TRÊS
// LINHAS do `StagePresentation.kt` que montam aquela ponte — mas a guarda de
// cada método é OUTRA coisa: ela é reescrita à mão 51 vezes no
// `NativeBridge.kt`, e é ela que decide o que acontece quando alguém chama o
// método por outro caminho (um script no documento do telão, um bundle antigo,
// um teste).
//
// **A conta medida em 2026-11-08 (revisão K2):** 76 métodos, 50 com recusa
// explícita (`host == null` / `h == null`) e 26 sem ela. Os 26 não são um
// defeito — são papel-agnósticos ou usam chamada segura (`host?.`) —, mas
// NADA no repositório dizia isso: um método novo nascia com ou sem guarda por
// hábito de quem escreveu, e a diferença não aparecia em lugar nenhum até
// alguém abrir o arquivo inteiro.
//
// É a mesma classe do `kotlin-simbolo-importado`: o que quebra aqui não dá erro
// em lugar nenhum — dá um app que instala, abre e oferece uma superfície a mais.
//
// ## O que ele afirma
//
//  1. o arquivo existe e a varredura achou os métodos (PREMISSA: arquivo movido
//     reprova em vez de passar por vácuo);
//  2. todo método `@JavascriptInterface` OU recusa sem `host`, OU está na lista
//     DECLARADA abaixo;
//  3. a lista não é carimbo: o MOTIVO declarado é conferido contra o corpo —
//     `papel` não pode tocar em `host`, `segura` tem de conter `host?.`, e
//     `helper` tem de delegar a um `private fun` que recusa;
//  4. a lista não acumula: um método que GANHOU guarda também reprova até sair
//     da lista (senão ela vira o lugar onde a guarda some de vista).
//
// ## O que ele NÃO é
//
// Não compila, não resolve tipos e não sabe se o método é alcançável. Ele lê o
// `.kt` como TEXTO (sem comentários, que neste repositório falam de `host` o
// tempo todo) e responde uma pergunta só: **a decisão de expor ou não este
// método continua explícita?**
//
//   node tools/ponte-guarda-host.test.mjs            # o arquivo de verdade
//   node tools/ponte-guarda-host.test.mjs <copia>    # a REVERSÃO, num .kt copiado
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checar, falhas } from './checar.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ARQ = process.argv[2] || path.join(RAIZ, 'app/src/main/java/br/org/iasd/av/NativeBridge.kt');

// ===== os 26, um por um, com o motivo CONFERÍVEL =====
//
// `papel`  — o método não toca em `host` (é do contrato dos dois papéis).
// `segura` — usa `host?.`: sem host ele simplesmente não faz nada.
// `helper` — delega a um `private fun` que recusa (a guarda é de lá).
const DECLARADOS = {
  // --- papel-agnósticos: contrato, estado do próprio papel, relay ---
  shellVersion: ['papel', 'a versão do contrato: constante, sem superfície'],
  role: ['papel', 'o papel DO PRÓPRIO WebView — é o que o telão precisa saber'],
  appVersion: ['papel', 'o versionName do pacote, só para o rótulo'],
  otaConfirm: ['papel', 'recusa por PAPEL (`role != "controle"`), e não toca em host'],
  busPost: ['papel', 'o relay é dos DOIS papéis — o telão também publica o status'],
  deckExportUrl: ['papel', 'função PURA: monta a URL de exportação de um link'],

  // --- chamada segura: sem host, não faz nada ---
  keepAlive: ['segura', 'mantém o processo vivo — inofensivo sem host'],
  displays: ['segura', 'lista as telas: o Controle usa; no telão devolve vazio'],
  openCast: ['segura', 'abre o seletor do sistema'],
  abrirSaidaDeAudio: ['segura', 'abre o seletor de saída do sistema'],
  openExternal: ['segura', 'abre URL externa (com o filtro de esquema no corpo)'],
  compartilharTexto: ['segura', 'o chooser do Android, com teto de 4 kB no corpo'],
  espelhoDesligar: ['segura', 'desistir não espera o que se quer parar (a lição do ytCancel)'],
  castTarget: ['segura', 'lê o alvo do cast para o rótulo'],
  saidaDeAudioAlvo: ['segura', 'lê a saída de áudio atual'],
  captureVolumeKeys: ['segura', 'liga/desliga a captura das teclas de volume'],
  telaInteira: ['segura', 'tela cheia da preview'],
  projecaoLocal: ['segura', 'liga o `keepVisible` do Controle quando a preview É a projeção'],
  systemVolume: ['segura', 'lê o volume do sistema'],
  temaClaro: ['segura', 'aplica o cromo do tema'],
  takeShare: ['segura', 'consome o share pendente — o telão recebe `null`'],
  pacoteCancelar: ['segura', 'cancela a criação do pacote'],
  pacoteDescartarPronto: ['segura', 'descarta o pacote pronto que espera o envio'],

  // --- a guarda mora no helper, que é UM só para os três destinos ---
  ytFetch: ['helper', 'ytFetchInterno'],
  ytFetchAudio: ['helper', 'ytFetchInterno'],
  ytFetchAte: ['helper', 'ytFetchInterno'],
};

// ===== a leitura: SEM COMENTÁRIO, e é por isso que ela confere =====
//
// O padrão da guarda é `host == null`, e este arquivo FALA de guarda em KDoc o
// tempo todo ("Privilégio do Controle", "a mesma guarda dos três irmãos"). Um
// scan que lesse comentário contaria a FRASE como se fosse o CÓDIGO — o defeito
// que o `invariantes-shell` já registra ("um comentário não pode satisfazer nem
// reprovar asserção"). O scanner é string-aware para não cortar o `//` de uma
// URL dentro de literal.
function semComentario(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === c) { j++; break; }
        j++;
      }
      out += src.slice(i, j);
      i = j;
      continue;
    }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

const bruto = fs.readFileSync(ARQ, 'utf8');
checar(/class NativeBridge\b/.test(bruto),
  'a premissa: o arquivo lido é o `NativeBridge.kt` (arquivo movido reprova aqui, não passa por vácuo)',
  ARQ);

const linhas = semComentario(bruto).split('\n');

/** Os métodos `@JavascriptInterface`, com o corpo = a linha da declaração e o
 *  que vier até a PRÓXIMA declaração (na mesma indentação de 4). */
const metodos = [];
let pendente = false;
linhas.forEach((l, i) => {
  if (l.trim() === '@JavascriptInterface') { pendente = true; return; }
  if (!pendente) return;
  const m = l.match(/^\s{4}fun (\w+)\s*\(/);
  if (!m) return;
  pendente = false;
  metodos.push({ nome: m[1], linha: i + 1, decl: l });
});

const guarda = (corpo) => /\bhost == null\b|\bh == null\b/.test(corpo);

const comGuarda = [];
const semGuarda = [];
for (const m of metodos) {
  const partes = [m.decl];
  for (let k = m.linha; k < linhas.length; k++) {
    const l = linhas[k];
    if (l.trim() === '@JavascriptInterface' || /^\s{4}(private\s+)?fun \w+\s*\(/.test(l)) break;
    partes.push(l);
  }
  m.corpo = partes.join('\n');
  (guarda(m.corpo) ? comGuarda : semGuarda).push(m.nome);
}

// ===== as asserções =====
checar(metodos.length === 76,
  'a premissa: a varredura achou os 76 métodos `@JavascriptInterface` (a conta do `CLAUDE.md`)',
  metodos.length);
checar(comGuarda.length === 76 - Object.keys(DECLARADOS).length,
  `a conta: ${76 - Object.keys(DECLARADOS).length} métodos recusam sem \`host\` e ${Object.keys(DECLARADOS).length} têm motivo declarado (76 no total)`,
  `${comGuarda.length} com guarda · ${semGuarda.length} sem`);

const faltandoNaLista = semGuarda.filter((n) => !DECLARADOS[n]);
checar(faltandoNaLista.length === 0,
  'todo método SEM guarda de `host` está na lista declarada deste oráculo (método novo nasce com guarda ou com motivo escrito)',
  faltandoNaLista.join(', ') || 'nenhum');

const sobrandoNaLista = Object.keys(DECLARADOS).filter((n) => !semGuarda.includes(n));
checar(sobrandoNaLista.length === 0,
  'a lista não acumula: todo método declarado ainda está SEM guarda — quem GANHOU uma guarda sai da lista (senão ela esconde a guarda que sumiu)',
  sobrandoNaLista.join(', ') || 'nenhum');

const corpoDe = (nome) => (metodos.find((m) => m.nome === nome) || {}).corpo || '';

// O MOTIVO, conferido contra o CORPO — a lista deixa de ser carimbo.
for (const [nome, [tipo, detalhe]] of Object.entries(DECLARADOS)) {
  if (!semGuarda.includes(nome)) continue;
  const corpo = corpoDe(nome);
  if (tipo === 'papel') {
    checar(!/\bhost\b/.test(corpo),
      `\`${nome}\` foi declarado papel-agnóstico — ${detalhe}`,
      corpo.match(/.*\bhost\b.*/)?.[0]?.trim() || 'não toca em `host`');
  } else if (tipo === 'segura') {
    checar(/host\?\./.test(corpo),
      `\`${nome}\` foi declarado de CHAMADA SEGURA (\`host?.\`) — ${detalhe}`,
      corpo.match(/.*host.*/)?.[0]?.trim() || 'não usa `host?.`');
  } else if (tipo === 'helper') {
    const helper = detalhe;
    const achouChamada = new RegExp(`\\b${helper}\\s*\\(`).test(corpo);
    const corpoDoHelper = (() => {
      const i = linhas.findIndex((l) => new RegExp(`^\\s{4}private fun ${helper}\\s*\\(`).test(l));
      if (i < 0) return '';
      const partes = [linhas[i]];
      for (let k = i + 1; k < linhas.length; k++) {
        if (/^\s{4}(private\s+)?fun \w+\s*\(/.test(linhas[k]) || linhas[k].trim() === '@JavascriptInterface') break;
        partes.push(linhas[k]);
      }
      return partes.join('\n');
    })();
    checar(achouChamada && guarda(corpoDoHelper),
      `\`${nome}\` delega a \`${helper}\`, e é LÁ que a recusa sem \`host\` mora`,
      achouChamada ? (guarda(corpoDoHelper) ? 'helper sem guarda' : 'oculto') : 'não chama o helper');
  } else {
    checar(false, `o motivo de \`${nome}\` é de um tipo conhecido (papel · segura · helper)`, tipo);
  }
}

console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
