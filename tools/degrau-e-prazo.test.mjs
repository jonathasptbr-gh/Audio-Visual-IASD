#!/usr/bin/env node
// ============================================================================
// AS DUAS REGRAS PURAS QUE A v1.4.19 ACRESCENTOU AO `mse.js`
//
// Elas são irmãs do `escolherDegrau` (que tem oráculo próprio em
// `degrau-de-banda.test.mjs`) e cobrem as duas metades que ele não cobria: QUAL
// degrau pode ser escolhido, e QUANTO TEMPO se espera por um pedaço.
//
// ## 1. `degrausUsaveis` — o degrau escolhido tem de ser decodificável
//
// `suportado` valida o TOPO da escada (`man.video`) e o áudio. Os DEGRAUS não
// passavam por conferência nenhuma: `escolherDegrau` escolhe só por banda. Do
// lado do shell a escada é filtrada por "mp4 e não webm", e **mp4 hoje carrega
// AV1** — um aparelho que decodifica avc1 e não av01 pode ter uma escada em que
// o topo passa e um degrau de baixo não.
//
// Não era uma queda (o `catch` da troca repõe o init antigo), mas era caro onde
// não se pode gastar: duas idas à rede e até 5 s de espera ANTES do primeiro
// quadro, com a bandeira `degrauFeito` queimada — e o Registro anunciando um
// degrau que nunca chegou a valer.
//
// **A FALHA ABERTA TEM ASSERÇÃO PRÓPRIA**, e é ela que decide o desenho: um
// navegador sem `isTypeSupported` (ou uma pergunta que lança) tem de devolver a
// escada CRUA — o comportamento de antes desta regra. Fechar aqui seria trocar
// um desperdício por uma transmissão que não escolhe degrau nenhum, em silêncio.
//
// ## 2. `prazoDoPedido` — o prazo de PAREDE é proporcional
//
// Um prazo fixo erra dos dois lados: mata a transferência legítima de um
// fragmento grande, ou não alcança o gotejamento de um pequeno. A propriedade
// que importa não é o valor — é que no vencimento a taxa efetiva já seja menor
// que a do degrau mais baixo que este player transmite, isto é, que o prazo só
// alcance um fragmento que já estava perdido.
//
//   node tools/degrau-e-prazo.test.mjs
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checar, falhas } from './checar.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const MSE = path.join(AQUI, '..', 'app', 'src', 'main', 'assets', 'web', 'shared', 'mse.js');

const janela = { MediaSource: undefined };
new Function('window', fs.readFileSync(MSE, 'utf8'))(janela);
const { degrausUsaveis, prazoDoPedido } = janela.AVStream;

const AVC = 'video/mp4; codecs="avc1.640028"';
const AV1 = 'video/mp4; codecs="av01.0.08M.08"';
const soAvc = (m) => m.includes('avc1');
const alturas = (l) => (l === null ? null : l.map((v) => v.altura));

// ── 1. o degrau que o aparelho não decodifica SAI da escada ──────────────
const escada = [
  { altura: 1080, mime: AVC },
  { altura: 720, mime: AV1 },
  { altura: 480, mime: AVC },
];
checar(String(alturas(degrausUsaveis(escada, soAvc))) === '1080,480',
  'o degrau em AV1 sai da escada de um aparelho que só decodifica AVC — sem '
  + 'isto a troca gasta duas idas à rede e a bandeira `degrauFeito` para chegar '
  + 'ao degrau antigo',
  alturas(degrausUsaveis(escada, soAvc)));

// ── 2. o TOPO nunca some ─────────────────────────────────────────────────
// Ele é o degrau 0 e o `suportado` já o aprovou antes de a cena entrar. Uma
// regra que pudesse tirá-lo mudaria a cena que JÁ está tocando.
checar(degrausUsaveis(escada, soAvc)[0].altura === 1080,
  'o TOPO continua sendo o degrau 0 — é a faixa que já está em cena, e o '
  + '`suportado` a aprovou antes de o filtro existir');

// ── 3. sobrando UM, não há troca possível ────────────────────────────────
// `null` e não a lista: `escolherDegrau` responderia 0 de qualquer jeito, e o
// caminho curto é o que o leitor não precisa refazer.
checar(degrausUsaveis([{ altura: 1080, mime: AVC }, { altura: 720, mime: AV1 }], soAvc) === null,
  'sobrando UM degrau utilizável a escada vira `null`: não há troca a fazer');

// ── 4. escada de um degrau só, ou ausente ────────────────────────────────
checar(degrausUsaveis([{ altura: 1080, mime: AVC }], soAvc) === null
  && degrausUsaveis(undefined, soAvc) === null
  && degrausUsaveis(null, soAvc) === null,
  'manifesto de shell antigo (sem `videos`) ou de uma faixa só: `null`, que é '
  + 'o comportamento de antes da escada');

// ── 5. FALHA ABERTA: a pergunta que lança devolve a escada CRUA ──────────
const explode = () => { throw new Error('sem isTypeSupported'); };
checar(String(alturas(degrausUsaveis(escada, explode))) === '1080,720,480',
  'FALHA ABERTA: a pergunta que lança devolve a escada CRUA — fechar aqui '
  + 'trocaria um desperdício por uma transmissão que não escolhe degrau nenhum',
  alturas(degrausUsaveis(escada, explode)));

// ── 6. faixa sem `mime` PASSA ────────────────────────────────────────────
// Mesma lição do `size` no `escolherDegrau`: recusar por campo ausente é o
// defeito que a v5.120 já pagou uma vez.
const semMime = [{ altura: 1080, mime: AVC }, { altura: 720 }, { altura: 480, mime: AVC }];
checar(String(alturas(degrausUsaveis(semMime, soAvc))) === '1080,720,480',
  'faixa sem `mime` é aceita — recusar por campo ausente é a lição que o '
  + '`dash` do Kotlin já pagou',
  alturas(degrausUsaveis(semMime, soAvc)));

// ── 7. o PRAZO cresce com o pedido ───────────────────────────────────────
const init = prazoDoPedido(800);
const frag = prazoDoPedido(2.5 * 1024 * 1024);
checar(frag > init,
  'o prazo de um fragmento de 2,5 MB é maior que o de um init de 800 B — um '
  + 'prazo fixo mata a transferência legítima do grande ou não alcança o '
  + 'gotejamento do pequeno',
  { init, frag });

// ── 8. no vencimento, o fragmento JÁ ESTAVA PERDIDO ─────────────
// A propriedade, e não o valor — e ela é RELATIVA, porque o tamanho do fragmento
// escala com o degrau: 5 s de 1080p são megabytes, 5 s de 144p são dezenas de kB.
// Um piso absoluto em bits por segundo aprovaria um prazo apertado para o degrau
// pequeno e frouxo para o grande, que é o defeito que o prazo proporcional
// existe para não ter.
//
// A régua certa: a taxa implícita no vencimento tem de ser uma FRAÇÃO da que
// aquele fragmento exige para sustentar o próprio degrau. Um terço é folgado
// — na prática a conta dá entre 1/4 e 1/30 —, e é o que garante que o prazo
// nunca alcance uma transferência que ainda podia dar certo.
const SEG_POR_FRAGMENTO = 5;
const TETO_DA_FRACAO = 1 / 3;
let sempreFolgado = true;
const medidas = [];
for (const kbps of [100, 250, 500, 1000, 2500, 4000, 8000]) {
  const bytes = (kbps * 1000 * SEG_POR_FRAGMENTO) / 8;
  const implicita = (bytes * 8) / (prazoDoPedido(bytes) / 1000);
  const fracao = implicita / (kbps * 1000);
  medidas.push({ degrau: kbps + ' kbps', fracao: Math.round(fracao * 100) / 100 });
  if (fracao > TETO_DA_FRACAO) sempreFolgado = false;
}
checar(sempreFolgado,
  'no vencimento a taxa implícita é no máximo um TERÇO da que o próprio '
  + 'fragmento exige — o prazo nunca alcança uma transferência que ainda podia '
  + 'dar certo. A régua é relativa porque o tamanho do fragmento escala com o '
  + 'degrau: 5 s de 1080p são megabytes, 5 s de 144p são dezenas de kB',
  medidas);

// ── 9. o PISO cobre o pedido minúsculo ───────────────────────────────────
// Init e índice são centenas de bytes: sem piso, a conta proporcional daria um
// prazo de milissegundos e toda transmissão morreria no primeiro pedido.
checar(prazoDoPedido(0) >= 15000 && prazoDoPedido(1) >= 15000,
  'o PISO cobre o pedido minúsculo: sem ele a conta proporcional daria '
  + 'milissegundos para o init, e nenhuma transmissão começaria',
  prazoDoPedido(0));

console.log(falhas.length ? '\n' + falhas.length + ' falha(s)' : '\ntudo certo');
process.exit(falhas.length ? 1 : 0);
