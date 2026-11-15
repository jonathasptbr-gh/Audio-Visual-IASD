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
const arquivos = ['index.html', 'prega.js', 'prega.css'];
for (const nome of arquivos) {
  const p = join(WEB, 'prega', nome);
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
} else if (/\"\/prega\/\"\s+to\s+\"web\/prega\/\"/.test(mPrefixo[1])) {
  ok('o prefixo `/prega/` serve `web/prega/`');
} else {
  nao('o prefixo `/prega/` serve `web/prega/`',
    'a página existe no bundle e ninguém a entrega: o link do pregador dá 404');
}

if (/rota\s*==\s*\"\/prega\"/.test(kt)) ok('`/prega` e `/prega/` levam à página');
else nao('`/prega` e `/prega/` levam à página', 'o link curto é o que se manda no WhatsApp');

// ---------------------------------------------------------------------------
// 3. A PÁGINA NÃO É UM TELÃO — a marca `av-tela` fica de fora
// ---------------------------------------------------------------------------
const mMarca = kt.match(/val marca = ([^\n]+)/);
if (!mMarca) {
  nao('achei a guarda da marca `av-tela`', 'a decisão de papel saiu do lugar medido');
} else if (/web\/prega\//.test(mMarca[1])) {
  ok('a marca `av-tela` não é injetada em `web/prega/`');
} else {
  nao('a marca `av-tela` não é injetada em `web/prega/`',
    'com a marca, o `tela.js` trata o controle do pregador como uma tela da rede');
}

// ---------------------------------------------------------------------------
// 4. AS AÇÕES: os dois lados, e a divergência é MUDA
// ---------------------------------------------------------------------------
const mAcoes = kt.match(/ACOES_DA_PREGA\s*=\s*setOf\(([^)]*)\)/);
const js = semComentario(ler(join(WEB, 'prega/prega.js')));
const daPagina = [...js.matchAll(/acao\('([^']+)'\)/g)].map((m) => m[1]).sort();

if (!mAcoes) {
  nao('achei o `ACOES_DA_PREGA` no EspelhoServidor.kt', 'sem ele não há lista de permissão a comparar');
} else if (!daPagina.length) {
  nao('a página manda ALGUMA ação', 'lista vazia do lado da página = leitura quebrada, não página muda');
} else {
  const doServidor = [...mAcoes[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort();
  ok(`servidor (ACOES_DA_PREGA): ${doServidor.join(', ')}`);
  ok(`página (prega.js): ${daPagina.join(', ')}`);

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

  // O NOME DO RAMO é o contrato do corpo (`{do:'prega'}`) e ele aparece nos
  // dois lados; um renomear de um lado só vira porta muda.
  if (/postar\(\{\s*do:\s*'prega'/.test(js)) ok('a página posta `{do:\'prega\'}` — o mesmo nome do ramo do servidor');
  else nao('a página posta `{do:\'prega\'}`', 'o corpo do POST não casa com o ramo `prega` do `retorno`');
  if (/optString\(\"do\"\)\s*==\s*\"prega\"/.test(kt)) ok('o servidor abre o ramo `prega` no POST /r');
  else nao('o servidor abre o ramo `prega` no POST /r', 'a ação sobe pela rede e morre no `when` do `alive`');
}

// ---------------------------------------------------------------------------
// 5. A GUARDA DE "SÓ SLIDES" MORA NO CONTROLE
// ---------------------------------------------------------------------------
const ctrl = semComentario(ler(CONTROLE));
const mRamo = ctrl.match(/if \(msg\.type === 'prega'\) \{([\s\S]*?)\n  \}/);
if (!mRamo) {
  nao('achei o ramo `prega` no controle.js', 'a ordem chega pelo barramento e ninguém a executa');
} else {
  const corpo = mRamo[1];
  if (/slideTarget\(\)\s*!==\s*'deck'/.test(corpo)) ok('o ramo `prega` desiste fora da apresentação');
  else nao('o ramo `prega` desiste fora da apresentação',
    'com uma letra em cena, o toque do pregador passaria estrofe — o pedido era "só slides"');
  if (/stepSlide\(/.test(corpo)) ok('o ramo `prega` passa pelo MESMO `stepSlide` do ⏮/⏭');
  else nao('o ramo `prega` passa pelo MESMO `stepSlide` do ⏮/⏭', 'um segundo caminho para a mesma ação é o defeito');

  // O EMISSOR tem de existir, e ele é o que a página desenha.
  if (/type:\s*'prega-estado'/.test(ctrl)) ok('o Controle emite `prega-estado` (o que a página desenha)');
  else nao('o Controle emite `prega-estado`', 'sem ele a página nunca sabe a página nem recebe prévia');
  if (/if \(!msg\.ativo\)/.test(js)) ok('a página trata o INATIVO como estado (sem prévia)');
  else nao('a página trata o INATIVO como estado', 'o pedido era não mostrar nada fora da apresentação');
}

// ---------------------------------------------------------------------------
// 6. A CSP DAS PÁGINAS SERVIDAS — nada embutido
// ---------------------------------------------------------------------------
const html = ler(join(WEB, 'prega/index.html'));
if (/<style[\s>]/i.test(html)) nao('a página não tem `<style>` embutido', 'a CSP `default-src self` o bloquearia em silêncio');
else ok('a página não tem `<style>` embutido');
if (/<script(?![^>]*\bsrc=)[^>]*>[^<\s]/i.test(html)) nao('a página não tem script embutido', 'a CSP o bloquearia em silêncio');
else ok('a página não tem script embutido');
if (/\sstyle\s*=\s*"/i.test(html)) nao('a página não usa o atributo `style`', 'a CSP não barra o CSSOM, mas barra o atributo');
else ok('a página não usa o atributo `style`');
for (const nome of ['prega.js', 'prega.css']) {
  const t = semComentario(ler(join(WEB, 'prega', nome)));
  if (/createElement\('style'\)/.test(t)) nao(`${nome} não cria \`<style>\` em runtime`, 'a lição da v5.205: some da tela sem erro nenhum');
  else ok(`${nome} não cria \`<style>\` em runtime`);
}

console.log('');
if (falhas.length) {
  console.log(`${falhas.length} FALHA(S) — a porta do pregador não está fechada.`);
  process.exit(1);
}
console.log('A porta do pregador concorda com a página, a rota e as ações.');
