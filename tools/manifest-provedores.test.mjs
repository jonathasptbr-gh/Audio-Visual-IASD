#!/usr/bin/env node
// DUAS AUTORIDADES SOBRE A MESMA CLASSE COMPARTILHAM UMA INSTÂNCIA — E COM ELA
// A TABELA DE CAMINHOS DA PRIMEIRA.
//
// `ActivityThread.installProvider` guarda o provedor local num mapa chaveado
// por `ComponentName(pacote, CLASSE)`, e não por autoridade. O segundo
// `<provider>` da mesma classe encontra o primeiro nesse mapa e publica o
// objeto DELE — a segunda autoridade passa a ser servida por uma instância
// cujo `<paths>` é o da primeira.
//
// ## Por que isto precisa de oráculo
//
// Foi o "0 KB" que custou CINCO lotes de campo (v1.8.17 a v1.8.21), e o modo de
// falhar é o pior que este repositório sabe produzir, porque ele é ASSIMÉTRICO
// e MUDO do lado de cá:
//
//   - `FileProvider.getUriForFile` é ESTÁTICO e resolve a tabela pela
//     AUTORIDADE, consultando o `PackageManager`. A URI sai CERTA;
//   - o seletor abre, e o nosso lado reporta o tamanho certo — ele lê o
//     `File.length()`, que nunca passou pelo provedor;
//   - quem RECUSA é a instância que serve, no processo do OUTRO app. O
//     receptor lê 0 B, e a única forma de saber é o relato de quem está lá.
//   - e a PRIMEIRA autoridade continua funcionando. Neste app ela é a do APK,
//     exercitada em toda atualização — a metade que funciona é justamente a
//     que faz o defeito parecer impossível.
//
// Nada no build detecta a colisão: as duas declarações são XML válido, o
// manifest merger não reclama, e o app instala. Nenhum oráculo de
// COMPORTAMENTO alcança isto — o que quebra roda noutro processo, em outro
// aplicativo. Sobra a leitura ESTÁTICA do manifesto, que é o que este arquivo
// faz, e é a mesma resposta do `kotlin-simbolo-importado`: a única pergunta que
// dá para responder sem o aparelho.
//
// A correção é uma subclasse trivial por autoridade (`PacoteProvider.kt`).

import { readFileSync, existsSync } from 'node:fs';
import { checar, falhas } from './checar.mjs';

const MANIFESTO = 'app/src/main/AndroidManifest.xml';
const xml = readFileSync(MANIFESTO, 'utf8');

// Comentário de XML NÃO aninha (ao contrário do de bloco do Kotlin), então a
// remoção não-gulosa é exata aqui — e ela é obrigatória: este manifesto
// DESCREVE a colisão em prosa, ao lado da declaração que a evita.
const semComentario = xml.replace(/<!--[\s\S]*?-->/g, '');

const provedores = [];
for (const m of semComentario.matchAll(/<provider\b([\s\S]*?)\/?>/g)) {
  const corpo = m[1];
  const nome = (corpo.match(/android:name\s*=\s*"([^"]+)"/) || [])[1] || '';
  const auth = (corpo.match(/android:authorities\s*=\s*"([^"]+)"/) || [])[1] || '';
  const rec = (corpo.match(/android:resource\s*=\s*"@xml\/([^"]+)"/) || [])[1] || '';
  provedores.push({ nome, auth, rec });
}

// Cada `<provider>` pode trazer o `<meta-data>` num filho, fora do casamento
// acima quando a tag não é auto-fechada. Recolhe o resource pelo bloco inteiro.
for (const p of provedores) {
  if (p.rec) continue;
  const i = semComentario.indexOf('android:authorities="' + p.auth + '"');
  if (i < 0) continue;
  const bloco = semComentario.slice(i, semComentario.indexOf('</provider>', i));
  p.rec = (bloco.match(/android:resource\s*=\s*"@xml\/([^"]+)"/) || [])[1] || '';
}

// A VARREDURA TEM DE TER LIDO ALGUMA COISA: um placar limpo sobre zero
// provedores é indistinguível de um manifesto correto.
checar(provedores.length >= 2,
  'a varredura achou os `<provider>` do manifesto — sem esta, um regex quebrado'
  + ' aprovaria qualquer coisa',
  provedores.length + ' encontrado(s)');

const porClasse = new Map();
for (const p of provedores) {
  if (!porClasse.has(p.nome)) porClasse.set(p.nome, []);
  porClasse.get(p.nome).push(p.auth);
}
const colididos = [...porClasse.entries()].filter(([, a]) => a.length > 1);

checar(colididos.length === 0,
  'nenhuma CLASSE de provedor é declarada duas vezes — duas autoridades sobre a'
  + ' mesma classe compartilham a instância, e a segunda passa a servir com o'
  + ' `<paths>` da primeira (o "0 KB" da v1.8.17)',
  colididos.map(([c, a]) => c + ' → ' + a.join(' e ')).join(' · '));

checar(provedores.every((p) => p.auth),
  'todo `<provider>` declara uma autoridade');

// O `<paths>` APONTADO TEM DE EXISTIR. Um `@xml/` com nome errado não é erro de
// build — o recurso some, e o provedor sobe sem raiz nenhuma: mesma falha
// silenciosa, por outro caminho.
for (const p of provedores) {
  if (!p.rec) continue;
  checar(existsSync('app/src/main/res/xml/' + p.rec + '.xml'),
    'o `<paths>` de ' + p.auth + ' existe: res/xml/' + p.rec + '.xml');
}

// E CADA CLASSE PRÓPRIA TEM DE EXISTIR NO FONTE. Uma classe que o manifesto
// nomeia e o repositório não tem derruba o app ao publicar o provedor.
for (const p of provedores) {
  if (!p.nome.startsWith('.')) continue;
  const arq = 'app/src/main/java/br/org/iasd/av/' + p.nome.slice(1) + '.kt';
  checar(existsSync(arq), 'a classe ' + p.nome + ' existe: ' + arq);
}

console.log('\n' + (falhas.length ? falhas.length + ' FALHA(S)' : 'Todos passaram.'));
process.exit(falhas.length ? 1 : 0);
