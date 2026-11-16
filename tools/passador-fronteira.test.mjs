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
// 2b. O LINK QUE O OPERADOR MANDA — o sufixo do Controle e a rota do servidor
// ---------------------------------------------------------------------------
// O link do passador é MONTADO no `controle.js` (o ícone de copiar e o de
// WhatsApp) a partir do endereço da transmissão, e o caminho é uma
// constante nos dois lados: a rota que o `EspelhoServidor.kt` serve e o sufixo
// que o Controle escreve. Divergir é o defeito MUDO deste lote: o operador
// manda no WhatsApp um endereço que o APK dele não serve, e quem recebe vê
// "site não encontrado" no domingo — sem erro nenhum aparecer aqui.
const ctrlLink = semComentario(ler(CONTROLE));
const mLink = ctrlLink.match(/function linkDoPassador[\s\S]{0,400}?base \+ '([^']+)'/);
if (!mLink) {
  nao('achei o sufixo do link no `controle.js`', 'sem ele os dois botões copiam o endereço do telão, não o do passador');
} else {
  const sufixo = mLink[1];
  if (!/^\/[a-z-]+$/.test(sufixo)) {
    nao('o Controle monta o link com um CAMINHO', `achei ${JSON.stringify(sufixo)} — tem de ser um caminho como /passador-de-slides`);
  } else ok(`o Controle monta o link com \`${sufixo}\``);
  if (kt.includes('"' + sufixo + '"') || kt.includes(sufixo + '/')) {
    ok('o servidor serve a MESMA rota que o Controle escreve');
  } else {
    nao('o servidor serve a MESMA rota que o Controle escreve',
      `o link sai com ${sufixo} e o EspelhoServidor.kt não conhece esse caminho`);
  }
  // O NÚMERO DO WHATSAPP ganha o 55 do Brasil (decisão do operador,
  // 2026-11-16): sem ele o `wa.me` abre uma conversa que não existe.
  if (/\b55\b/.test(ctrlLink) && /numeroDoWhatsapp/.test(ctrlLink)) {
    ok('o número do WhatsApp ganha o DDI (55) quando vem com DDD');
  } else {
    nao('o número do WhatsApp ganha o DDI (55) quando vem com DDD',
      'com DDD e sem 55, o `wa.me` não acha a conversa');
  }
}

// OS ATALHOS existem na folha de conexão — e o LINK NÃO (v1.14.57: o operador
// cortou o segundo endereço escrito e a descrição; ficaram dois ícones).
const htmlCast = ler(join(WEB, 'controle/index.html'));
for (const id of ['passadorCopyBtn', 'passadorZapBtn', 'castZap', 'passadorZapNum', 'passadorZapAbrir']) {
  if (new RegExp('id="' + id + '"').test(htmlCast)) ok(`a folha de conexão tem o \`#${id}\``);
  else nao(`a folha de conexão tem o \`#${id}\``,
    'sem ele o passador não tem atalho nem zona de envio no WhatsApp');
}
if (/id="passadorUrl"/.test(htmlCast)) {
  nao('o link do passador NÃO se escreve na tela',
    'o pedido é atalho de ícone: link e descrição escritos de volta é o desenho que saiu');
} else ok('o link do passador NÃO se escreve na tela (atalhos de ícone)');

// A MENSAGEM É SÓ O LINK (decisão do operador, 2026-11-16): com prosa em volta,
// o WhatsApp não reconhece o endereço, e o link chega para ser copiado à mão.
// AQUI se lê o TEXTO CRU: o `semComentario` corta tudo depois de `//`, e a
// linha da URL tem `https://` — o `encodeURIComponent` sumiria da leitura.
const mZap = ler(CONTROLE).match(/function zapDoPassador\(numero, link\)[\s\S]{0,200}?encodeURIComponent\(([^)]+)\)/);
if (!mZap) {
  nao('achei o `zapDoPassador` no `controle.js`', 'sem ele a zona do WhatsApp não monta a URL');
} else if (mZap[1].trim() !== 'link') {
  nao('a mensagem do WhatsApp é SÓ o link', `o texto viaja como \`${mZap[1].trim()}\` — prosa em volta desliga o reconhecimento`);
} else ok('a mensagem do WhatsApp é SÓ o link');

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
