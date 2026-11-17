#!/usr/bin/env node
// A PORTA DO PREGADOR — a página, a rota e as AÇÕES, medidas contra o servidor.
//
// O Pacote 34 abriu a TERCEIRA porta de subida do `EspelhoServidor`: uma página
// na rede mandando passar slide. Ela é a primeira porta de CONTROLE do app (as
// outras duas, `st` e `alive`, são inertes por construção), e o modo de falhar
// dela é mudo nos dois sentidos — o mesmo par que o `tipos-que-sobem.test.mjs`
// vigia do outro lado do servidor:
//
//   - ação no servidor e não na página → o botão manda um nome que a lista de
//     permissão não conhece, e o servidor responde 404 em silêncio;
//   - ação na página e não no servidor → acontece o mesmo, pela outra ponta.
//
// Nenhuma das duas dá erro em lugar nenhum: o pregador toca no celular, nada
// muda no telão, e o culto segue. É por isso que este oráculo existe, e é por
// isso que ele lê os DOIS lados como TEXTO — sem navegador, no passo que BARRA
// o build.
//
// O QUE MAIS ELE MEDE, e por quê:
//
//   - a página está no bundle e a rota que a serve existe (PREFIXOS_BUNDLE);
//   - a página NÃO leva a marca `av-tela`: com ela, o `tela.js` tomaria o
//     controle do pregador por um telão e passaria a desenhar a entrada dele;
//   - a página não tem estilo embutido nem script embutido (a CSP das páginas
//     servidas é `default-src 'self'`, §8 do `TELAO-POR-COMANDOS.md`);
//   - a guarda de "só slides" mora no CONTROLE, e não na página: quem manda na
//     rede é um cliente, e a regra que vale não pode depender dele.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = join(RAIZ, 'app/src/main/assets/web');
const KT = join(RAIZ, 'app/src/main/java/br/org/iasd/av/EspelhoServidor.kt');
const CONTROLE = join(WEB, 'controle/controle.js');

const falhas = [];
const ok = (t) => console.log('ok\t' + t);
const nao = (t, extra) => { console.log('FALHOU\t' + t + (extra ? '\n\t' + extra : '')); falhas.push(t); };

const ler = (p) => readFileSync(p, 'utf8');
// Fora comentários de JS/CSS: este oráculo mede CÓDIGO, e um trecho citado em
// prosa não é regra.
const semComentario = (txt) => txt
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');

// ---------------------------------------------------------------------------
// 1. A página existe, nos três arquivos, e nenhum é vazio
// ---------------------------------------------------------------------------
const arquivos = ['index.html', 'passador.js', 'passador.css'];
for (const nome of arquivos) {
  const p = join(WEB, 'passador-de-slides', nome);
  if (!existsSync(p)) { nao(`a página do pregador tem ${nome}`, 'sem ele o bundle é publicado quebrado'); continue; }
  const t = ler(p);
  if (t.trim().length < 200) nao(`${nome} tem corpo`, `${t.length} bytes — arquivo vazio não é entrega`);
  else ok(`${nome} existe (${t.length} bytes)`);
}

// ---------------------------------------------------------------------------
// 2. O servidor SERVE a página — prefixo no bundle e porta de entrada
// ---------------------------------------------------------------------------
const kt = ler(KT);
const mPrefixo = kt.match(/PREFIXOS_BUNDLE\s*=\s*mapOf\(([\s\S]*?)\n\s*\)/);
if (!mPrefixo) {
  nao('achei o `PREFIXOS_BUNDLE`', 'sem ele este bloco não mede nada');
} else if (/\"\/passador-de-slides\/\"\s+to\s+\"web\/passador-de-slides\/\"/.test(mPrefixo[1])) {
  ok('o prefixo `/passador-de-slides/` serve `web/passador-de-slides/`');
} else {
  nao('o prefixo `/passador-de-slides/` serve `web/passador-de-slides/`',
    'a página existe no bundle e ninguém a entrega: o link do pregador dá 404');
}

if (/rota\s*==\s*\"\/passador-de-slides\"/.test(kt)) ok('`/passador-de-slides` e `/passador-de-slides/` levam à página');
else nao('`/passador-de-slides` e `/passador-de-slides/` levam à página', 'o link curto é o que se manda no WhatsApp');

// ---------------------------------------------------------------------------
// 2b. O LINK QUE O OPERADOR MANDA — o link do SITE, e a rota do servidor
// ---------------------------------------------------------------------------
// Desde a v1.14.59 o que circula NÃO é o endereço do aparelho: o WhatsApp não
// reconhece IPv4 privado com porta (chega como texto), e o link passou a ser o
// da PÁGINA PÚBLICA — `https://audiovisualiasd.com.br/passador?h=ip:porta` —
// que redireciona para a rota que o `EspelhoServidor.kt` continua servindo.
// As duas metades continuam medidas: o valor que o app copia (executado, não
// lido por regex) e o `/passador-de-slides` que o servidor serve.
const ctrlCru = ler(CONTROLE);
const ctrlLink = semComentario(ctrlCru);

// As funções são RECORTADAS e EXECUTADAS: uma regex sobre o texto aprovaria
// uma conta que devolve outra coisa. O recorte é por chaves equilibradas e o
// `new Function` roda as MESMAS linhas do bundle — sem navegador e no passo
// que BARRA o build.
function recortaFuncao(fonte, nome) {
  const ini = fonte.indexOf('function ' + nome + '(');
  if (ini < 0) return '';
  let fundo = 0;
  for (let j = fonte.indexOf('{', ini); j < fonte.length; j++) {
    if (fonte[j] === '{') fundo++;
    else if (fonte[j] === '}') { fundo--; if (!fundo) return fonte.slice(ini, j + 1); }
  }
  return '';
}

const mSite = ctrlCru.match(/const SITE_DO_PASSADOR = '([^']+)';/);
let lk = null;
try {
  const corpo = ['hostDoPassador', 'linkDoPassador', 'mensagemDoPassador', 'zapDoPassador']
    .map((n) => recortaFuncao(ctrlCru, n));
  if (mSite && corpo.every(Boolean)) {
    lk = new Function('"use strict";' + mSite[0] + '\n' + corpo.join('\n')
      + '\nreturn { hostDoPassador, linkDoPassador, mensagemDoPassador, zapDoPassador };')();
  }
} catch (_) { lk = null; }

if (!mSite || !lk) {
  nao('as funções do link rodam isoladas', 'sem elas este bloco não mede o valor que o botão copia');
} else {
  if (mSite[1] !== 'https://audiovisualiasd.com.br/passador') {
    nao('o link aponta para a página pública do site', `achei ${JSON.stringify(mSite[1])}`);
  } else ok(`o link aponta para \`${mSite[1]}\``);

  // O MESMO IP DE EXEMPLO DO ORÁCULO DA PÁGINA: o que o app copia tem de ser
  // exatamente o que a página aceita e redireciona.
  const exemplos = [
    ['http://192.168.0.12:8787', 'https://audiovisualiasd.com.br/passador?h=192.168.0.12:8787'],
    ['http://10.1.2.3:80', 'https://audiovisualiasd.com.br/passador?h=10.1.2.3:80'],
    ['http://172.16.0.5:65535', 'https://audiovisualiasd.com.br/passador?h=172.16.0.5:65535'],
  ];
  for (const [base, esperado] of exemplos) {
    const obtido = lk.linkDoPassador(base);
    if (obtido === esperado) ok(`\`${base}\` vira \`${obtido}\``);
    else nao(`\`${base}\` vira o link do site`, `obtido ${JSON.stringify(obtido)}`);
  }

  // O QUE NÃO CABE NA PÁGINA NÃO VIRA LINK DO SITE: IP público, TLS com
  // hostname e endereço sem porta continuam no caminho antigo — e a página
  // recusaria os três. Vazio continua vazio.
  for (const base of ['http://8.8.8.8:80', 'https://igreja.local:8787', 'http://192.168.0.12']) {
    const obtido = lk.linkDoPassador(base);
    if (!obtido.includes('audiovisualiasd.com.br')) ok(`\`${base}\` fica no link antigo`);
    else nao(`\`${base}\` fica no link antigo`, `o site recusaria esse endereço, e o link saiu ${JSON.stringify(obtido)}`);
  }
  if (lk.linkDoPassador('') === '') ok('sem endereço, sem link');
  else nao('sem endereço, sem link', 'o botão copiaria um endereço vazio');

  // A ROTA ANTIGA CONTINUA SENDO O QUE O SERVIDOR SERVE — o site redireciona
  // para ela, então as duas pontas têm de continuar batendo.
  const mSufixo = lk.linkDoPassador.toString().match(/base \+ '([^']+)'/);
  if (!mSufixo) {
    nao('o caminho servido pelo aparelho continua no `linkDoPassador`', 'sem ele o redirecionamento do site não tem para onde ir');
  } else {
    const sufixo = mSufixo[1];
    if (kt.includes('"' + sufixo + '"') || kt.includes(sufixo + '/')) {
      ok(`o servidor serve o caminho do redirecionamento (\`${sufixo}\`)`);
    } else {
      nao('o servidor serve o caminho do redirecionamento',
        `o site manda para ${sufixo} e o EspelhoServidor.kt não conhece esse caminho`);
    }
  }
}

// O NÚMERO DO WHATSAPP ganha o 55 do Brasil (decisão do operador,
// 2026-11-16): sem ele o `wa.me` abre uma conversa que não existe.
if (/\b55\b/.test(ctrlLink) && /numeroDoWhatsapp/.test(ctrlLink)) {
  ok('o número do WhatsApp ganha o DDI (55) quando vem com DDD');
} else {
  nao('o número do WhatsApp ganha o DDI (55) quando vem com DDD',
    'com DDD e sem 55, o `wa.me` não acha a conversa');
}

// O CARTÃO DO PASSADOR existe na folha de conexão, e ele é UM só (v1.14.64): os
// dois botões COM RÓTULO, a mensagem que viaja e a linha do número moram na
// mesma caixa. Até a v1.14.63 eram dois nós irmãos — dois ícones soltos e um
// cartão de WhatsApp separado —, e o operador leu exatamente isso: *"tratados
// como não do mesmo grupo ou ação"*.
const htmlCast = ler(join(WEB, 'controle/index.html'));
for (const id of ['passadorGrupo', 'passadorCopyBtn', 'passadorZapBtn', 'passadorMsg', 'castZap', 'passadorZapNum', 'passadorZapAbrir']) {
  if (new RegExp('id="' + id + '"').test(htmlCast)) ok(`a folha de conexão tem o \`#${id}\``);
  else nao(`a folha de conexão tem o \`#${id}\``,
    'sem ele o passador não tem atalho nem a linha de envio no WhatsApp');
}

// A MENSAGEM É O QUE SE ESCREVE NA TELA, e o que NÃO se escreve é um SEGUNDO
// ENDEREÇO copiável (`#passadorUrl`, o nó da v1.14.56): o passador continua
// sendo opção do endereço do telão, não um segundo endereço. Desde a v1.14.64 a
// folha mostra a MENSAGEM (o link público + o endereço cru) — é ela que diz o
// que se compartilha, e é o texto que viaja no `?text=`.
if (/id="passadorUrl"/.test(htmlCast)) {
  nao('a folha NÃO tem um segundo endereço copiável',
    'o desenho que saiu na v1.14.57 é o do endereço escrito com botão de copiar próprio');
} else ok('a folha NÃO tem um segundo endereço copiável (`#passadorUrl`)');

// OS DOIS RÓTULOS, no HTML: o texto visível é o que o oráculo de Chromium lê, e
// aqui ele é cobrado no passo que BARRA o build — uma remoção futura não chega
// ao canal nem para ser medida.
for (const [id, rotulo] of [
  ['passadorCopyBtn', 'Copiar link'],
  ['passadorZapBtn', 'Enviar no WhatsApp'],
]) {
  const m = htmlCast.match(new RegExp('id="' + id + '"[\\s\\S]*?</button>'));
  if (m && m[0].includes('>' + rotulo + '<')) ok(`o \`#${id}\` diz "${rotulo}" no próprio botão`);
  else nao(`o \`#${id}\` diz "${rotulo}" no próprio botão`,
    'ícone sozinho não diz o que se compartilha — foi o relato do operador em 16/11');
}

// A MENSAGEM: o link do site na PRIMEIRA linha (sozinho, porque com prosa em
// volta o WhatsApp deixa de reconhecer o endereço) e o endereço CRU na
// segunda, que é o que se digita se a página não abrir. O `zapDoPassador`
// codifica a mensagem INTEIRA — as duas linhas viajam no mesmo `?text=`.
// AQUI se lê o TEXTO CRU: o `semComentario` corta tudo depois de `//`, e a
// linha da URL tem `https://` — o `encodeURIComponent` sumiria da leitura.
if (!lk) {
  nao('a mensagem do WhatsApp tem o link e o endereço cru', 'as funções do link não rodaram');
} else {
  const link = lk.linkDoPassador('http://192.168.0.12:8787');
  const msg = lk.mensagemDoPassador(link, lk.hostDoPassador('http://192.168.0.12:8787'));
  const linhas = msg.split('\n');
  const corpo = msg.replace(/\n/g, '\\n');
  if (linhas[0] === link && linhas[1] === 'Se o link não abrir, use: 192.168.0.12:8787') {
    ok(`a mensagem é o link na 1ª linha e o endereço cru na 2ª (\`${corpo}\`)`);
  } else {
    nao('a mensagem é o link na 1ª linha e o endereço cru na 2ª', `saiu ${JSON.stringify(msg)}`);
  }
  // O TLS não tem endereço cru (o link antigo JÁ é o endereço do aparelho):
  // a mensagem fica só o link, sem uma segunda linha repetindo o mesmo.
  const semCru = lk.mensagemDoPassador('https://igreja.local:8787/passador-de-slides', '');
  if (semCru === 'https://igreja.local:8787/passador-de-slides') ok('sem endereço cru, a mensagem fica só o link');
  else nao('sem endereço cru, a mensagem fica só o link', `saiu ${JSON.stringify(semCru)}`);

  const zap = lk.zapDoPassador('5511999999999', msg);
  if (zap === 'https://wa.me/5511999999999?text=' + encodeURIComponent(msg)) {
    ok('o `wa.me` leva a mensagem inteira codificada');
  } else {
    nao('o `wa.me` leva a mensagem inteira codificada', `saiu ${JSON.stringify(zap)}`);
  }
}

// ---------------------------------------------------------------------------
// 3. A PÁGINA NÃO É UM TELÃO — a marca `av-tela` fica de fora
// ---------------------------------------------------------------------------
const mMarca = kt.match(/val marca = ([^\n]+)/);
if (!mMarca) {
  nao('achei a guarda da marca `av-tela`', 'a decisão de papel saiu do lugar medido');
} else if (/web\/passador-de-slides\//.test(mMarca[1])) {
  ok('a marca `av-tela` não é injetada em `web/passador-de-slides/`');
} else {
  nao('a marca `av-tela` não é injetada em `web/passador-de-slides/`',
    'com a marca, o `tela.js` trata o controle do pregador como uma tela da rede');
}

// ---------------------------------------------------------------------------
// 4. AS AÇÕES: os dois lados, e a divergência é MUDA
// ---------------------------------------------------------------------------
const mAcoes = kt.match(/ACOES_DO_PASSADOR\s*=\s*setOf\(([^)]*)\)/);
const js = semComentario(ler(join(WEB, 'passador-de-slides/passador.js')));
const daPagina = [...js.matchAll(/acao\('([^']+)'\)/g)].map((m) => m[1]).sort();

if (!mAcoes) {
  nao('achei o `ACOES_DO_PASSADOR` no EspelhoServidor.kt', 'sem ele não há lista de permissão a comparar');
} else if (!daPagina.length) {
  nao('a página manda ALGUMA ação', 'lista vazia do lado da página = leitura quebrada, não página muda');
} else {
  const doServidor = [...mAcoes[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort();
  ok(`servidor (ACOES_DO_PASSADOR): ${doServidor.join(', ')}`);
  ok(`página (passador.js): ${daPagina.join(', ')}`);

  const soNaPagina = daPagina.filter((a) => !doServidor.includes(a));
  const soNoServidor = doServidor.filter((a) => !daPagina.includes(a));
  if (soNaPagina.length) {
    nao('nenhuma ação da página falta no servidor',
      `só na página: ${soNaPagina.join(', ')} — o botão existe, o servidor responde 404, calado`);
  } else ok('nenhuma ação da página falta no servidor');
  if (soNoServidor.length) {
    // AÇÃO A MAIS NO SERVIDOR NÃO É ERRO POR SI: uma ação sem botão é porta
    // que aceita o que ninguém oferece. É o mesmo raciocínio do dreno de
    // subida — a lista é de PERMISSÃO, e permissão sem uso é superfície.
    nao('nenhuma ação do servidor é oferecida sem botão',
      `só no servidor: ${soNoServidor.join(', ')} — permissão sem uso é superfície aberta`);
  } else ok('nenhuma ação do servidor é oferecida sem botão');

  // O NOME DO RAMO é o contrato do corpo (`{do:'passador'}`) e ele aparece nos
  // dois lados; um renomear de um lado só vira porta muda.
  if (/postar\(\{\s*do:\s*'passador'/.test(js)) ok('a página posta `{do:\'passador\'}` — o mesmo nome do ramo do servidor');
  else nao('a página posta `{do:\'passador\'}`', 'o corpo do POST não casa com o ramo `passador` do `retorno`');
  if (/optString\(\"do\"\)\s*==\s*\"passador\"/.test(kt)) ok('o servidor abre o ramo `passador` no POST /r');
  else nao('o servidor abre o ramo `passador` no POST /r', 'a ação sobe pela rede e morre no `when` do `alive`');
}

// ---------------------------------------------------------------------------
// 5. A GUARDA DE "SÓ SLIDES" MORA NO CONTROLE
// ---------------------------------------------------------------------------
const ctrl = semComentario(ler(CONTROLE));
const mRamo = ctrl.match(/if \(msg\.type === 'passador'\) \{([\s\S]*?)\n  \}/);
if (!mRamo) {
  nao('achei o ramo `passador` no controle.js', 'a ordem chega pelo barramento e ninguém a executa');
} else {
  const corpo = mRamo[1];
  if (/slideTarget\(\)\s*!==\s*'deck'/.test(corpo)) ok('o ramo `passador` desiste fora da apresentação');
  else nao('o ramo `passador` desiste fora da apresentação',
    'com uma letra em cena, o toque do pregador passaria estrofe — o pedido era "só slides"');
  if (/stepSlide\(/.test(corpo)) ok('o ramo `passador` passa pelo MESMO `stepSlide` do ⏮/⏭');
  else nao('o ramo `passador` passa pelo MESMO `stepSlide` do ⏮/⏭', 'um segundo caminho para a mesma ação é o defeito');

  // O EMISSOR tem de existir, e ele é o que a página desenha.
  if (/type:\s*'passador-estado'/.test(ctrl)) ok('o Controle emite `passador-estado` (o que a página desenha)');
  else nao('o Controle emite `passador-estado`', 'sem ele a página nunca sabe a página nem recebe prévia');
  if (/if \(!msg\.ativo\)/.test(js)) ok('a página trata o INATIVO como estado (sem prévia)');
  else nao('a página trata o INATIVO como estado', 'o pedido era não mostrar nada fora da apresentação');
}

// ---------------------------------------------------------------------------
// 6. A CSP DAS PÁGINAS SERVIDAS — nada embutido
// ---------------------------------------------------------------------------
const html = ler(join(WEB, 'passador-de-slides/index.html'));
if (/<style[\s>]/i.test(html)) nao('a página não tem `<style>` embutido', 'a CSP `default-src self` o bloquearia em silêncio');
else ok('a página não tem `<style>` embutido');
if (/<script(?![^>]*\bsrc=)[^>]*>[^<\s]/i.test(html)) nao('a página não tem script embutido', 'a CSP o bloquearia em silêncio');
else ok('a página não tem script embutido');
if (/\sstyle\s*=\s*"/i.test(html)) nao('a página não usa o atributo `style`', 'a CSP não barra o CSSOM, mas barra o atributo');
else ok('a página não usa o atributo `style`');
for (const nome of ['passador.js', 'passador.css']) {
  const t = semComentario(ler(join(WEB, 'passador-de-slides', nome)));
  if (/createElement\('style'\)/.test(t)) nao(`${nome} não cria \`<style>\` em runtime`, 'a lição da v5.205: some da tela sem erro nenhum');
  else ok(`${nome} não cria \`<style>\` em runtime`);
}

console.log('');
if (falhas.length) {
  console.log(`${falhas.length} FALHA(S) — a porta do pregador não está fechada.`);
  process.exit(1);
}
console.log('A porta do pregador concorda com a página, a rota e as ações.');
