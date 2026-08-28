// A METADE PRODUTORA do envelope da ponte do computador.
//
// A consumidora é o `NucleoPonteTest` (JUnit), e as duas leem AS MESMAS
// fixtures — `tools/fixtures/ponte-envelope.json`, escritas à mão. É a forma
// que este projeto já viu falhar em silêncio duas vezes: o `__tela` do
// `display-ready` (que ia no `tela-status` e nunca no anúncio, com a função
// jamais executada para uma tela de verdade) e o `TIPOS_QUE_SOBEM` do dreno.
// A regra que saiu daquilo é a que este arquivo cumpre: *ler cada lado isolado
// aprova os dois.*
//
// AS FIXTURES NÃO SÃO GERADAS POR NENHUM DOS DOIS LADOS. Fossem, cada oráculo
// provaria que um lado concorda consigo mesmo — e a divergência entre eles é
// exatamente o que não se enxerga assim.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fix = JSON.parse(fs.readFileSync(path.join(raiz, 'tools/fixtures/ponte-envelope.json'), 'utf8'));

let falhas = 0;
function checar(ok, o_que) {
  if (ok) return;
  falhas++;
  console.error('  ✗ ' + o_que);
}

// ---------------------------------------------------------------- a folha
//
// Ela é carregada COMO A CASCA A CARREGA: um `window` de mentira com o
// `__AV_CASCA__` que o C# injeta antes dela. Sem isso a IIFE retorna na
// entrada e o oráculo mediria o silêncio.
const folha = fs.readFileSync(path.join(raiz, 'windows/casca/ponte.js'), 'utf8');

const janela = {
  __AV_CASCA__: { base: 'http://127.0.0.1:8420', papel: 'controle', sessao: 'sessao-de-teste', shell: 58, nome: '1.4.6' },
  // O que a folha toca ao subir. `EventSource` e `fetch` existem só para ela
  // não estourar; o que este oráculo mede é o ENVELOPE, não o transporte.
  EventSource: function () { return { set onmessage(_) {} }; },
  fetch: () => Promise.resolve({}),
  TextEncoder,
  XMLHttpRequest: function () {},
};
new Function('window', folha)(janela);

checar(typeof janela.__AVEnvelope?.montar === 'function', 'a folha publica o codec');
checar(typeof janela.__AVBridge === 'object', 'a folha publica __AVBridge');

// ------------------------------------------------------- o contrato, byte a byte
console.log('envelopes bons:');
for (const c of fix.bons) {
  const b = Buffer.from(janela.__AVEnvelope.montar(c.id, c.metodo, c.args));
  const esperado = Buffer.from(c.fio, 'utf8');
  const bate = b.equals(esperado);
  checar(bate, `${c.nome}: o produtor JS diverge da fixture\n     esperado: ${JSON.stringify(esperado.toString())}\n     produziu: ${JSON.stringify(b.toString())}`);
  if (bate) console.log('  ✓ ' + c.nome);
}

// O AUTO-TESTE DA FIXTURE. Ele não mede o app: mede se a fixture continua
// dizendo a verdade sobre si mesma depois de alguém editá-la à mão — que é o
// único jeito de ela ser editada.
for (const c of fix.bons) {
  checar(Buffer.byteLength(c.fio, 'utf8') === c.bytes,
    `${c.nome}: a fixture declara ${c.bytes} bytes e tem ${Buffer.byteLength(c.fio, 'utf8')}`);
}

// ------------------------------------------------------------ o que a folha OFERECE
//
// A superfície da ponte está escrita por extenso na folha, e um método que o
// `native.js` chame e não exista lá vira `TypeError` — engolido pelo `catch`
// do `native.js`, com o botão ficando mudo em culto. Esta é a asserção que
// pega isso, e ela lê a lista do `native.js`, não uma cópia.
const nativeJs = fs.readFileSync(path.join(raiz, 'app/src/main/assets/web/shared/native.js'), 'utf8');
const chamados = [...new Set([...nativeJs.matchAll(/\bB\.([a-zA-Z][A-Za-z0-9]*)\s*\(/g)].map((m) => m[1]))].sort();
checar(chamados.length > 50, `o `.concat('`native.js` devia chamar dezenas de métodos, achei ', chamados.length));

const faltando = chamados.filter((m) => typeof janela.__AVBridge[m] !== 'function');
checar(faltando.length === 0,
  'a folha do computador não oferece o que o native.js chama: ' + faltando.join(', '));

// O PAR: nada a mais. Um método na folha que ninguém chame é código morto que
// passa a parecer contrato — e um dia alguém o "conserta" em vez de apagá-lo.
const sobrando = Object.keys(janela.__AVBridge).filter((m) => !chamados.includes(m));
checar(sobrando.length === 0, 'a folha oferece o que ninguém chama: ' + sobrando.join(', '));

console.log(`\nsuperfície: o native.js chama ${chamados.length} métodos; faltam ${faltando.length} na folha, sobram ${sobrando.length}`);

// --------------------------------------------------- os SÍNCRONOS são síncronos
//
// O `native.js` lê os três na CARGA, antes de qualquer Promise poder ter
// resolvido: `__SHELL_VERSION__`, `__AV_ROLE__` e `__SHELL_NAME__` saem daí.
// Devolvê-los como Promise deixaria o app subir com versão 0, papel vazio e
// nome vazio — e nada disso dá erro.
checar(janela.__AVBridge.shellVersion() === 58, 'shellVersion devolve o inteiro, na hora');
checar(janela.__AVBridge.role() === 'controle', 'role devolve o papel SELADO PELA CASCA');
checar(janela.__AVBridge.appVersion() === '1.4.6', 'appVersion devolve o nome, na hora');

// O PAPEL VEM DA CASCA, não da página. É a invariante 9 no ponto em que ela
// nasce: quem cria a janela decide o que ela é.
const telao = { ...janela, __AV_CASCA__: { ...janela.__AV_CASCA__, papel: 'display' } };
new Function('window', folha)(telao);
checar(telao.__AVBridge.role() === 'display', 'a mesma folha, outro papel — porque a casca o selou');

// ---------------------------------------------------------- o que a folha ENVIA
//
// Um método assíncrono manda o id da chamada; um de efeito manda o sentinela.
// Trocar os dois é mudo: a promessa de um nunca resolve, e o outro ganha um
// `resolve` que ninguém espera.
const enviados = [];
const j2 = {
  ...janela,
  fetch: (url, o) => { enviados.push({ url, corpo: Buffer.from(o.body).toString('utf8') }); return Promise.resolve({}); },
};
new Function('window', folha)(j2);
j2.__AVBridge.listFolder('ab12cd:7', 'content://x');
j2.__AVBridge.temaClaro(true);
checar(enviados.length === 2, 'as duas chamadas saíram');
checar(enviados[0].url.includes('s=sessao-de-teste'), 'a sessão vai na query — é por ela que a resposta volta');
checar(enviados[0].corpo.startsWith('AV1\nab12cd:7\nlistFolder\n1\n'),
  'o assíncrono leva o id da chamada: ' + JSON.stringify(enviados[0].corpo));
checar(enviados[1].corpo.startsWith('AV1\n-\ntemaClaro\n1\n4\ntrue\n'),
  'o de efeito leva o sentinela, e o booleano vira texto: ' + JSON.stringify(enviados[1].corpo));

// ------------------------------------------------------------------- desfecho
if (falhas) {
  console.error(`\n${falhas} asserção(ões) reprovada(s)`);
  process.exit(1);
}
console.log('\nponte-envelope: tudo certo');
