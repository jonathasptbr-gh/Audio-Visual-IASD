#!/usr/bin/env node
// A FRONTEIRA DE REDE DO ESPELHO — o que o JUnit NÃO alcança.
//
// ## Por que este oráculo existe
//
// O telão por comandos é a PRIMEIRA fronteira de rede deste projeto: um
// `ServerSocket` que qualquer aparelho da igreja alcança, servindo arquivos e
// comandos. As quatro peças puras (`EspelhoHttp`, `EspelhoPares`,
// `EspelhoMidiaCache`, `EspelhoInterfaces`) têm JUnit e são elas que decidem
// QUEM entra; o `EspelhoServidor` faz sockets, threads e rede, **não tem JUnit
// nenhum** (precisaria de `Context` e de sockets de verdade) e é justamente
// onde ficam as decisões que o JUnit do parser não vê:
//
//   - em que endereço o socket LIGA (um bind em `0.0.0.0` publica o culto em
//     H.264 na rede da operadora, e nada mais neste repositório impede isso);
//   - qual teto conta o quê (a subtração das entregas de mídia existia para não
//     punir fluxo longo — e virou, sem teto próprio, um caminho para abrir
//     threads sem limite);
//   - o que acontece com a mensagem que chega e NUNCA termina;
//   - e se o token — uma capacidade de 128 bits — sai por um caminho que o
//     operador copia e repassa (o `logcat`, o Registro).
//
// Nenhuma delas dá erro em lugar nenhum quando some: dá um app que instala,
// abre e perde a proteção. É a mesma pergunta do `invariantes-shell` e do
// `ponte-guarda-host`, na terceira camada do shell.
//
// ## O que ele NÃO é
//
// Não compila e não abre socket: ele afirma FORMA, não comportamento. Quem prova
// comportamento aqui é o `EspelhoHttpTest`/`EspelhoParesTest` (JUnit, no CI) e o
// `tela-rede.test.mjs` (Chromium). Uma linha que ele aceita ainda pode estar
// errada — o que ele não deixa é a proteção SUMIR sem ninguém ver.
//
//   node tools/espelho-fronteira.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checar, falhas } from './checar.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(RAIZ, 'app/src/main/java/br/org/iasd/av');
const LER = (nome) => fs.readFileSync(path.join(DIR, nome), 'utf8');

/** SÓ AS LINHAS DE CÓDIGO: um KDoc que DESCREVE a regra (e este repositório
 *  escreve um por símbolo, inclusive citando `0.0.0.0` como o erro a não
 *  cometer) não pode satisfazer nem reprovar uma asserção sobre ela. */
const SO_CODIGO = (texto) =>
  texto
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n');

const CODIGO_SERVIDOR = SO_CODIGO(LER('EspelhoServidor.kt'));
const CODIGO_HTTP = SO_CODIGO(LER('EspelhoHttp.kt'));
const CODIGO_PARES = SO_CODIGO(LER('EspelhoPares.kt'));
const CODIGO_CERT = SO_CODIGO(LER('EspelhoCert.kt'));
const CODIGO_CANAL = SO_CODIGO(LER('EspelhoMidiaCanal.kt'));

// ===== 1. ONDE O SOCKET LIGA =====
//
// A regra do `TELAO-POR-COMANDOS.md` §2.3: bind EXPLÍCITO num IPv4 servível,
// nunca pelo construtor de porta (que liga em `0.0.0.0`, isto é, em toda
// interface, `rmnet` inclusive) e nunca em `::`. Operadoras brasileiras
// entregam IPv6 globalmente roteável, e o desfecho normal de "a igreja não tem
// internet" é o celular em dados móveis.
const construtores = CODIGO_SERVIDOR.match(/ServerSocket\([^)]*\)/g) ?? [];
checar(construtores.length >= 2 && construtores.every((c) => c === 'ServerSocket()'),
  'todo `ServerSocket` nasce VAZIO (o construtor de porta liga em 0.0.0.0 em toda interface, `rmnet` inclusive)',
  construtores.join(' · '));
checar((CODIGO_SERVIDOR.match(/\.bind\(\s*InetSocketAddress\(/g) ?? []).length >= 2,
  'os dois caminhos (o `ligar` e o rebind por troca de IP) ligam com `bind(InetSocketAddress(ipv4, porta))`',
  (CODIGO_SERVIDOR.match(/\.bind\([\s\S]{0,40}/g) ?? []).join(' · '));
checar(!/InetAddress\.getByName|InetSocketAddress\(\s*null/.test(CODIGO_SERVIDOR),
  'nenhum bind é resolvido por NOME nem com endereço nulo (um nome que resolva para 0.0.0.0 reabre a porta do mundo)');

// ===== 2. OS DOIS TETOS DE CONEXÃO, E O QUE CADA UM CONTA =====
//
// `TETO_EM_VOO` conta conexões que ainda não viraram fluxo, e por isso
// SUBTRAI as telas de comando e as entregas de mídia (são fluxos longos; contá-
// los derrubava a segunda tela que abrisse a página). A subtração é a metade
// certa — e a outra metade é que existe um teto PRÓPRIO para a mídia: sem ele,
// `GET /m/` é anônimo por token e cada faixa segura uma thread até o fim dela.
checar(/emVoo\.get\(\)\s*-\s*telasSse\.size\s*-\s*midiaEmVoo\.get\(\)/.test(CODIGO_SERVIDOR),
  'o teto de conexões em voo subtrai os FLUXOS (telas de comando e entregas de mídia), e não apenas as telas');
checar(/TETO_MIDIA_EM_VOO/.test(CODIGO_SERVIDOR) &&
  /if\s*\(\s*midias\s*>\s*TETO_MIDIA_EM_VOO\s*\)/.test(CODIGO_SERVIDOR) &&
  /midiaEmVoo\.decrementAndGet\(\)/.test(CODIGO_SERVIDOR),
  'a entrega de mídia tem TETO PRÓPRIO e devolve o contador quando recusa (a rota é anônima por token: sem teto, um visitante abre threads até o processo dos dois WebViews desistir)');

// ===== 3. A MENSAGEM QUE NUNCA TERMINA =====
//
// O `soTimeout` do servidor é por `read()`. Um cliente que pinga um byte de
// cada vez fica abaixo dele PARA SEMPRE: 4 KiB de cabeçalho a 1 byte por 9 s
// valem ~10 h com a thread presa. O prazo TOTAL é o que fecha essa porta, e o
// JUnit do parser (`aMensagemQueNaoTerminaAMortoMorreNoPrazoTotal`) é a prova de
// comportamento — aqui se afirma que ele continua LIGADO no caminho.
checar(/const val PRAZO_TOTAL_REQ_MS\s*=\s*20_000L/.test(CODIGO_HTTP),
  'o parser declara o prazo TOTAL da mensagem (o `setSoTimeout` não cobre o cliente lento)');
checar(/Fonte\(entrada,\s*prazoTotalMs\)/.test(CODIGO_HTTP),
  'e o passa à `Fonte`, que é quem lê (um prazo declarado e não ligado é documentação, não rede de segurança)');
checar(/System\.nanoTime\(\)\s*>\s*limiteNs/.test(CODIGO_HTTP) && /System\.nanoTime\(\)/.test(CODIGO_HTTP),
  'a `Fonte` estoura o prazo entre duas leituras, com relógio MONOTÔNICO (`currentTimeMillis` pode saltar e o prazo nunca vencer)');

// ===== 4. O 404 É O MESMO PARA TODAS AS RECUSAS =====
//
// Host fora da allowlist, origem estranha, rota inexistente e token inválido
// respondem o MESMO 404, byte a byte: é o que impede a resposta de dizer "isto
// existe" a quem está sondando a rede (§3.4, invariante 5).
checar(/is Erro\.HostRecusado\s*->\s*naoEncontrado\(\)/.test(CODIGO_HTTP) &&
  /is Erro\.OrigemEstranha\s*->\s*naoEncontrado\(\)/.test(CODIGO_HTTP),
  'host recusado e origem estranha caem no MESMO 404 do token inválido e da rota inexistente');
checar(/else\s*->\s*responder\(saida,\s*naoAchei\(\)\)/.test(CODIGO_SERVIDOR),
  'e a rota que não existe também, no `else` do roteador (um roteador com `else` explícito é o que não deixa rota nova herdar 200)');

// ===== 5. O TOKEN DE SESSÃO SÓ VIAJA EM CABEÇALHO =====
//
// "O token NUNCA viaja numa URL" é a invariante 1 do `EspelhoPares`, e ela vale
// porque o parser não tem outra porta: `Cookie` não é lido, e nenhuma rota
// consulta a query. Quem lê a sessão é uma linha só, a partir do cabeçalho.
checar(/validarToken\(req\.autorizacao\)/.test(CODIGO_SERVIDOR),
  'a sessão é lida do cabeçalho `Authorization` (`req.autorizacao`), nunca da query nem de um cookie');
checar(!/cookie/i.test(CODIGO_HTTP),
  'o parser não conhece `Cookie` (uma segunda fonte de credencial divergiria da primeira sem ninguém ver)');
checar(!/\.query\b/.test(CODIGO_SERVIDOR),
  'e nenhuma rota do servidor consulta a query (o `/m/` usa o token de SERVIÇO no caminho, que é outro)');

// ===== 6. O TOKEN NÃO SAI POR UM CANAL QUE SE COPIA E REPASSA =====
//
// Ele é uma capacidade: quem o lê baixa a mídia sem sessão nenhuma. O Registro
// existe para ser copiado, e o `logcat` vai junto num relatório de defeito —
// por isso nem um nem outro podem carregá-lo. (O `Sessao.toString` já o esconde;
// esta asserção pega o que for escrito à mão.)
const linhasDeLog = CODIGO_SERVIDOR.split('\n')
  .filter((l) => /Log\.[a-z]|registrar\(/.test(l));
checar(!linhasDeLog.some((l) => /\$token|\btoken\b/.test(l)),
  'nenhuma linha de `Log`/`registrar` interpola token (o Registro é copiado, e o logcat viaja num relatório de defeito)',
  linhasDeLog.filter((l) => /\$token|\btoken\b/.test(l)).join(' · '));

// ===== 7. O TERMINADOR DO CHUNKED SÓ AFIRMA O QUE É VERDADE =====
//
// Num corpo `chunked` o `0\r\n\r\n` É a afirmação "o recurso acabou aqui": quem
// a escreve numa entrega interrompida faz a tela tocar meia mídia e disparar
// `ended` sem erro em lugar nenhum. A conta que decide está no `servirMidia`.
// A FATIA TERMINA NA FUNÇÃO SEGUINTE: sem esse corte, a contagem pegaria o
// `chunkFinal` da transmissão (outra rota, outro corpo) e acusaria o dobro.
const inicioMidia = CODIGO_SERVIDOR.indexOf('private fun servirMidia');
const fimMidia = CODIGO_SERVIDOR.indexOf('\n    private fun ', inicioMidia + 10);
const midia = CODIGO_SERVIDOR.slice(inicioMidia, fimMidia > 0 ? fimMidia : undefined);
const terminator = midia.indexOf('EspelhoHttp.chunkFinal()');
const porta = midia.indexOf('if (inteiro)');
checar(terminator > 0 && porta > 0 && porta < terminator &&
  (midia.match(/EspelhoHttp\.chunkFinal\(\)/g) ?? []).length === 1,
  'o terminador do `chunked` está DEPOIS da conta `if (inteiro)` e aparece UMA vez (escrevê-lo também no caminho truncado é entregar meia mídia como se fosse inteira)',
  (midia.match(/EspelhoHttp\.chunkFinal\(\)/g) ?? []).length + ' ocorrência(s)');
checar(/entrega TRUNCADA/.test(midia) && /sem terminador/.test(midia),
  'e o caminho truncado deixa a linha no Registro que diz isso ao operador');

// ===== 8. O CERTIFICADO APAGADO É O QUE ACONTECEU =====
//
// `File.delete()` devolve `false` e não lança. Ignorar o retorno fazia a ponte
// resolver `true` SEMPRE — a folha dizia "apagado" com a chave privada ainda no
// disco. A cadeia inteira tem de carregar o desfecho.
checar(/fun apagar\(ctx: Context\): Boolean/.test(CODIGO_CERT) &&
  /!f\.exists\(\) \|\| f\.delete\(\)/.test(CODIGO_CERT),
  '`EspelhoCert.apagar` devolve o DESFECHO do `delete()` (e não o pedido)');
checar(/fun mirrorCertRemove\(onResult: \(Boolean\) -> Unit\)/.test(SO_CODIGO(LER('NativeBridge.kt'))),
  'a interface do host carrega o booleano até a ponte');
checar(/h\.mirrorCertRemove\s*\{\s*saiu\s*->\s*resolve\(callId,\s*saiu\.toString\(\)\)\s*\}/.test(SO_CODIGO(LER('NativeBridge.kt'))),
  'e a ponte publica o valor que veio, não um `true` fixo');

// ===== 9. O BLOCO DE MÍDIA PERTENCE AO ITEM EM QUE CHEGOU =====
//
// O token vai carimbado no `Trabalho` na CHEGADA. Lido do campo volátil na hora
// de escrever, um bloco do item anterior era gravado no item seguinte (ou
// descartado) quando o lado web abria outro depois de um prazo vencido — e o
// desfecho era um retalho de imagem com o tamanho certo e o conteúdo errado.
checar(/private class Trabalho\([\s\S]{0,200}?val token: String/.test(CODIGO_CANAL),
  'o `Trabalho` carrega o token do item a que o bloco pertence');
checar(/c\.escrever\(t\.token, t\.bytes\)/.test(CODIGO_CANAL) && !/c\.escrever\(token,/.test(CODIGO_CANAL),
  'e o laço de escrita usa ESSE token, nunca relê o campo volátil na hora de gravar');

console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
