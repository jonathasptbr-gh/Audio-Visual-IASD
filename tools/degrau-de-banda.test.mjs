#!/usr/bin/env node
// ============================================================================
// A ESCOLHA DO DEGRAU — a regra que troca travamento por imagem menor
//
// ## Por que ela existe
//
// `shared/mse.js` **não faz ABR**, e é justamente por isso que a escolha
// importa: ela é feita UMA vez e vale o louvor inteiro. Enquanto o manifesto
// trouxe uma faixa só, ela era feita CEGA — sempre o teto —, e a consequência
// inverte a intuição vinda do app do YouTube: aqui uma rede que não sustenta a
// faixa produz **travamento**, nunca imagem menor.
//
// Relato do operador: *"veio som, porém ficou travando e qualidade de vídeo
// baixa"*, com a leitura de que *"a resolução estava baixa por questão da
// internet"* — que é falsa neste app, e é a razão de a pergunta *"não dá para
// medir a velocidade e escolher melhor?"* ser a pergunta certa.
//
// ## O que ele trava, e por que cada caso decide alguma coisa
//
//  1. **rede sobrando → o topo.** Sem esta metade a regra seria um jeito
//     elaborado de projetar 480p numa igreja com fibra.
//  2. **rede apertada → o degrau que CABE**, não o mais baixo: recuar demais é
//     o mesmo defeito do outro lado, e ninguém reclamaria dele.
//  3. **rede péssima → o mais baixo**, nunca uma recusa. Recusar mandaria a
//     cena ao download de centenas de MB — pior em toda leitura.
//  4. **a MARGEM existe**: uma faixa que cabe EXATAMENTE não cabe. A medida sai
//     dos primeiros bytes, durante o slow start do TCP, e por isso subestima —
//     mas nas duas pontas: escolher no limite é escolher travar.
//  5. **o ÁUDIO conta.** Ele viaja junto e pesa perto de um décimo do vídeo num
//     louvor; ignorá-lo é errar a conta para cima justamente onde ela aperta.
//  6. **sem escada, sem degrau** (shell antigo, manifesto de uma faixa só) e
//     **sem medida, sem degrau**: os dois caem no índice 0, que é o
//     comportamento de antes desta regra.
//  7. **faixa sem `size` é ACEITA.** O `contentLength` do YouTube nasce em -1
//     quando ele não o informa, e recusar por campo ausente é a lição que o
//     `dash` do Kotlin já pagou uma vez (a v5.120 derrubou a transmissão
//     inteira exigindo justamente esse campo).
//
//   node tools/degrau-de-banda.test.mjs
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checar, falhas } from './checar.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const MSE = path.join(AQUI, '..', 'app', 'src', 'main', 'assets', 'web', 'shared', 'mse.js');

// O módulo é uma IIFE que escreve em `global`. Um objeto de mentira no lugar do
// `window` basta: nada aqui toca DOM, e é isso que faz a regra ser PURA.
const janela = { MediaSource: undefined };
new Function('window', fs.readFileSync(MSE, 'utf8'))(janela);
const { escolherDegrau } = janela.AVStream;

// Um louvor de 4 minutos, com a escada que o YouTube costuma publicar. Os
// tamanhos são os de um vídeo real dessa duração: ~4,3 Mbps em 1080p, ~2,1 em
// 720p, ~1,0 em 480p, e o áudio em ~128 kbps.
const SEGUNDOS = 240;
const mb = (bits) => Math.round((bits * SEGUNDOS) / 8);
const ESCADA = [
  { altura: 1080, size: mb(4300000) },
  { altura: 720, size: mb(2100000) },
  { altura: 480, size: mb(1000000) },
];
const AUDIO = { size: mb(128000) };
const alturaEm = (i) => (ESCADA[i] ? ESCADA[i].altura : null);

// ── 1. rede sobrando ────────────────────────────────────────────────────
checar(alturaEm(escolherDegrau(50e6, ESCADA, AUDIO, SEGUNDOS)) === 1080,
  'com 50 Mbps o topo é escolhido — a regra não pode ser um jeito elaborado de '
  + 'projetar 480p numa igreja com fibra');

// ── 2. rede apertada: o que CABE, não o mais baixo ──────────────────────
// 4 Mbps não sustenta 1080p (4,3 + 0,128, com margem), e sustenta 720p com
// folga. Recuar até 480p seria o mesmo defeito do outro lado.
checar(alturaEm(escolherDegrau(4e6, ESCADA, AUDIO, SEGUNDOS)) === 720,
  'com 4 Mbps desce para 720p — o degrau que cabe, e não o mais baixo',
  alturaEm(escolherDegrau(4e6, ESCADA, AUDIO, SEGUNDOS)));

// ── 3. rede péssima: o mais baixo, NUNCA uma recusa ─────────────────────
checar(alturaEm(escolherDegrau(200e3, ESCADA, AUDIO, SEGUNDOS)) === 480,
  'com 200 kbps nada cabe e sai o degrau MAIS BAIXO — recusar mandaria a cena '
  + 'ao download de centenas de MB, pior em toda leitura');

// ── 4. a MARGEM ─────────────────────────────────────────────────────────
// Exatamente a taxa do topo (vídeo + áudio) NÃO basta: sem folga, escolher no
// limite é escolher travar.
const exato = (4300000 + 128000);
checar(alturaEm(escolherDegrau(exato, ESCADA, AUDIO, SEGUNDOS)) !== 1080,
  'a taxa EXATA do topo não o elege: a medida sai do slow start e a margem é o '
  + 'que impede "cabe justinho" de virar travamento',
  alturaEm(escolherDegrau(exato, ESCADA, AUDIO, SEGUNDOS)));
checar(alturaEm(escolherDegrau(exato * 1.5, ESCADA, AUDIO, SEGUNDOS)) === 1080,
  'e com folga de verdade ele volta a ser eleito — a margem é folga, não recuo');

// ── 5. o ÁUDIO conta ────────────────────────────────────────────────────
// Uma banda que cabe o vídeo sozinho, e não cabe vídeo + áudio: só a conta
// COMPLETA separa os dois desfechos.
const soVideo = 4300000 * 1.35 + 1000;      // passa raspando ignorando o áudio
checar(alturaEm(escolherDegrau(soVideo, ESCADA, AUDIO, SEGUNDOS)) === 720,
  'o ÁUDIO entra na conta: uma banda que caberia só o vídeo não elege o topo — '
  + 'ele viaja junto, e ignorá-lo erra para cima onde a conta aperta',
  alturaEm(escolherDegrau(soVideo, ESCADA, AUDIO, SEGUNDOS)));
checar(alturaEm(escolherDegrau(soVideo, ESCADA, null, SEGUNDOS)) === 1080,
  'e sem faixa de áudio (o "Tocar agora · só áudio" descarta o vídeo antes) a '
  + 'mesma banda elege o topo — é a prova de que o oráculo mediu o áudio, e não '
  + 'um limiar qualquer');

// ── 6. sem escada e sem medida ──────────────────────────────────────────
checar(escolherDegrau(200e3, [ESCADA[0]], AUDIO, SEGUNDOS) === 0,
  'manifesto de UMA faixa (shell antigo) devolve o índice 0 — a degradação '
  + 'declarada, e não uma recusa');
checar(escolherDegrau(0, ESCADA, AUDIO, SEGUNDOS) === 0
  && escolherDegrau(-1, ESCADA, AUDIO, SEGUNDOS) === 0,
  'sem medida NÃO se decide nada: banda zero ou negativa fica no topo, que é '
  + 'onde a transmissão já começava');
checar(escolherDegrau(200e3, ESCADA, AUDIO, 0) === 0,
  'e sem duração a conta não existe — um vídeo ao vivo cairia aqui, e adivinhar '
  + 'seria pior que não mexer');

// ── 7. faixa sem `size` ─────────────────────────────────────────────────
// `contentLength` -1 é o YouTube não informando; recusar por campo ausente é a
// lição que a v5.120 já pagou no `dash`.
const semTamanho = [{ altura: 1080 }, ESCADA[1], ESCADA[2]];
checar(alturaEm(escolherDegrau(200e3, semTamanho, AUDIO, SEGUNDOS)) === 1080,
  'faixa SEM `size` é aceita: o `contentLength` do YouTube nasce em -1, e '
  + 'recusar por campo ausente derrubaria a transmissão por um dado que o '
  + 'player nem usa',
  alturaEm(escolherDegrau(200e3, semTamanho, AUDIO, SEGUNDOS)));

// ── 8. a regra é MONOTÔNICA ─────────────────────────────────────────────
// Mais banda nunca pode dar um degrau PIOR. É a propriedade que uma tabela de
// limiares escrita à mão quebra no primeiro ajuste, e que nenhum caso isolado
// acima pegaria.
let anterior = ESCADA.length;
let monotonica = true;
for (const bps of [100e3, 500e3, 1e6, 1.5e6, 2e6, 3e6, 4e6, 6e6, 10e6, 100e6]) {
  const i = escolherDegrau(bps, ESCADA, AUDIO, SEGUNDOS);
  if (i > anterior) monotonica = false;
  anterior = i;
}
checar(monotonica,
  'MONOTÔNICA: mais banda nunca devolve um degrau pior — a propriedade que '
  + 'nenhum caso isolado pega e que uma tabela de limiares quebra no primeiro '
  + 'ajuste');

console.log(falhas.length ? '\n' + falhas.length + ' falha(s)' : '\ntudo certo');
process.exit(falhas.length ? 1 : 0);
