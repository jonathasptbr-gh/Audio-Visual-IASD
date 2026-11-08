#!/usr/bin/env node
// A ENTREGA DO OTA: a falha não pode ser MUDA, nem carimbada como sucesso.
//
// ## Por que este oráculo existe
//
// O `WebUpdater` e o `ShellUpdater` são o caminho de atualização de TODO aparelho
// e o único do app cujo defeito não tem sintoma: nada quebra, ninguém reclama, e
// o operador simplesmente fica na versão de anteontem. As defesas do download
// (host travado, `sha256`, zip slip, tetos de bytes e de entradas, o piso entre
// consultas, o backoff) estão escritas no `docs/shell/OTA.md` e no KDoc de cada
// símbolo — e até a K5 nenhuma delas tinha oráculo de Kotlin: os três existentes
// (`ota`, `ota-confirma`, `watchdog-modulos`) são de web/JS, e o único guarda
// daquele lado é o bloco "Sanidade da base web" do workflow.
//
// O que se afirma aqui é a FORMA das quatro coisas que a K5 fechou ou endureceu:
//
//   1. DEPOIS DO DOWNLOAD, TODA RECUSA É FALHA (`error`), nunca `return null`.
//      O `checkAsync` carimba `ultimoOk`/`falhasSeguidas`/`proximaEm` para
//      QUALQUER retorno sem exceção: um `return null` ali faz a ronda rebaixar o
//      MESMO zip de 5,6 MB a cada 15 s, para sempre — o modo de falhar que o
//      próprio arquivo diz ter fechado no `sha256`, fechado numa porta só.
//   2. A FORMA DA VERSÃO é conferida antes de ela entrar em NOME DE CAMINHO.
//   3. O `estado()` lê cada coisa UMA vez e monta o diagnóstico com elas — a
//      fotografia é pedida pela enquete de 10 s, na fila `io` do `NativeBridge`.
//   4. O APK baixado tem a CONTA FECHADA: o corpo truncado é falha, não sucesso
//      camuflado de "Não foi possível analisar o pacote" no instalador do
//      Android.
//
// Mais duas coisas que a K5 arrumou e que regridem caladas: a regra "um download
// por vez" escrita UMA vez (no `NativeBridge`, não duplicada num `baixando` do
// `ShellUpdater`), e o nome do repositório numa constante SÓ — eram três
// literais digitados à mão e o contrato nomeava dois.
//
// Não compila Kotlin e não roda Android: quem prova comportamento é o `verificar`
// do CI e o aparelho.
//
//   node tools/ota-ativacao.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checar, falhas } from './checar.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const KOTLIN = path.join(RAIZ, 'app/src/main/java/br/org/iasd/av');
const LER = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

const SO_CODIGO = (texto) =>
  texto
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n');

const janela = (texto, assinatura, largura) => {
  const i = texto.indexOf(assinatura);
  if (i < 0) return '';
  return texto.slice(i, i + largura);
};

const WEB = SO_CODIGO(LER('app/src/main/java/br/org/iasd/av/WebUpdater.kt'));
const SHELL = SO_CODIGO(LER('app/src/main/java/br/org/iasd/av/ShellUpdater.kt'));
const FAROL = SO_CODIGO(LER('app/src/main/java/br/org/iasd/av/Farol.kt'));

// ===== PREMISSA =====
checar(WEB.includes('private fun check(ctx: Context)')
  && WEB.includes('private const val KEY_PENDING') && WEB.includes('fun confirmBoot('),
'PREMISSA: o `WebUpdater.kt` tem a procura, o watchdog e a confirmação de boot',
{ bytes: WEB.length });
checar(SHELL.includes('fun baixarEInstalar(') && SHELL.includes('private fun baixar('),
'PREMISSA: o `ShellUpdater.kt` tem o download do APK', { bytes: SHELL.length });

// ===== 1. DEPOIS DO DOWNLOAD, RECUSA É FALHA =====
const depois = janela(WEB, 'download(url, tmpZip)', 9000);
checar(!/return null/.test(depois),
'nenhuma recusa DEPOIS do download devolve `null` — `null` é carimbado como sucesso pelo `checkAsync` (`ultimoOk` renovado, `falhasSeguidas` zerado, sem espera), e a ronda seguinte rebaixa os mesmos 5,6 MB: um zip publicado com a raiz trocada viraria megabytes por minuto, para sempre, no Wi-Fi onde o espelho serve as telas',
{ trechos: (depois.match(/return null/g) || []).length });
checar((depois.match(/error\(/g) || []).length >= 3,
'e as recusas pós-download são `error(...)` — as três: sem `web/controle/index.html`, ativar sobre o bundle em uso, e o `renameTo` que falha',
{ erros: (depois.match(/error\(/g) || []).length });

// ===== 2. A FORMA DA VERSÃO, ANTES DO CAMINHO =====
const inicioCheck = janela(WEB, 'private fun check(ctx: Context)', 900);
checar(/version\.matches\(Regex\(/.test(inicioCheck)
  && inicioCheck.indexOf('version.matches(Regex(') < inicioCheck.indexOf('minShell'),
'a `version` do manifesto é conferida por `Regex` ANTES de qualquer uso: ela entra em NOME DE CAMINHO (`v$version`, `staging-$version-$stamp`) e este arquivo é paranoico com caminho e teto em todo o resto — o CI confere a forma do que é publicado, esta é a mesma conta do lado que não confia no manifesto');

// ===== 3. O `catch` DA PROCURA ENGOLINDO UM `Error` MATA O PROCESSO =====
const busca = janela(WEB, 'fun checkAsync(', 6000);
checar(busca.includes('} catch (e: Throwable) {') && busca.includes('ultimoResultado = "falhou ('),
'o corpo da procura é protegido por `catch (Throwable)` e escreve o desfecho: a extração do bundle é o maior consumidor de memória do processo, e um `Error` que escape mata a thread — e com ela o processo dos dois WebViews e da `Presentation`');

// ===== 4. UMA LEITURA DE CADA COISA NA FOTOGRAFIA =====
const estado = janela(WEB, 'fun estado(ctx: Context)', 1600);
checar(estado.includes('diagDe(') && !estado.includes('diag(ctx)'),
'o `estado()` monta o diagnóstico com o que JÁ leu (`diagDe`), em vez de chamar o `diag()`, que relê tudo: eram ~5 leituras de `version.json` e 3 `getPackageInfo` por fotografia, e a fotografia é pedida pela enquete de 10 s do `controle.js`, na fila `io` — que o `NativeBridge` declara de milissegundos e compartilha com `listFolder` e `otaPending`');
checar((estado.match(/versaoInstalada\(ctx\)/g) || []).length === 1,
'e o `PackageManager` é consultado UMA vez por fotografia (`versaoInstalada`): são IPCs de binder numa fila de milissegundos',
{ vezes: (estado.match(/versaoInstalada\(ctx\)/g) || []).length });

// ===== 5. A CONTA FECHADA DO APK =====
const baixar = janela(SHELL, 'private fun baixar(', 2200);
checar(/if \(total > 0 && lidos != total\)/.test(baixar),
'o download do APK compara os bytes LIDOS com o total anunciado (`lidos != total`) antes de entregar ao instalador: um corpo truncado era aceito como completo, o progresso ia a 100 e o instalador abria sobre um pacote inválido — "Não foi possível analisar o pacote", sem uma linha que dissesse por quê. A conferência já existia, aplicada só ao REUSO do arquivo');

// ===== 6. "UM DOWNLOAD POR VEZ" NUMA CASA SÓ =====
checar(!/baixando/.test(SHELL),
'o `ShellUpdater` não guarda um `baixando`: o único chamador de `baixarEInstalar` está dentro da fila `apk` de uma thread e depois do `apkEmCurso` do `NativeBridge` — a guarda ali era inalcançável e a regra ficava escrita duas vezes, com dois donos (repasse da K2, fechado na K5)');
const ponte = LER('app/src/main/java/br/org/iasd/av/NativeBridge.kt');
checar((ponte.match(/ja ha um download em curso/g) || []).length === 1,
'a frase "ja ha um download em curso" existe UMA vez no Kotlin, no `NativeBridge`, que é quem de fato recusa o segundo toque',
{ vezes: (ponte.match(/ja ha um download em curso/g) || []).length });

// ===== 7. O REPOSITÓRIO NUMA CONSTANTE SÓ =====
const arquivos = fs.readdirSync(KOTLIN).filter((n) => n.endsWith('.kt'));
let literais = 0;
for (const n of arquivos) literais += (fs.readFileSync(path.join(KOTLIN, n), 'utf8').match(/"jonathasptbr-gh\//g) || []).length;
checar(literais === 1,
'o nome do repositório aparece UMA vez no Kotlin (`WebUpdater.REPO`, referenciada pelo `ShellUpdater` e pelo `Farol`): eram TRÊS literais digitados à mão e o contrato nomeava dois — renomear o repositório ao pé da letra deixaria a terceira falando de um nome que não existe, com o `GET` em 404 e o farol parando de contar em silêncio',
{ literais });

// ===== 8. O FAROL NÃO MATERIALIZA A RESPOSTA =====
checar(!/readBytes\(\)/.test(FAROL) && /entrada\.read\(buf\) > 0/.test(FAROL),
'o farol lê o corpo EM TRÂNSITO, com buffer fixo: `readBytes()` materializava o corpo inteiro na memória do processo (largeHeap, dois WebViews, um vídeo) para depois jogar fora — era o único caminho de rede do app sem teto');

// ===== 9. O WATCHDOG DE BOOT: ARMA PELO NOME, DESARMA SÓ O SERVIDO =====
const begin = janela(WEB, 'fun beginSession(', 3200);
checar(/putString\(KEY_PENDING, active\)/.test(begin),
'o watchdog guarda o NOME do subdiretório pendente (`putString(KEY_PENDING, active)`), não um booleano: com booleano a confirmação de um bundle perdoava outro');
checar(/if \(pendente == active\) \{/.test(begin) && /remove\(KEY_ACTIVE\)\.remove\(KEY_PENDING\)/.test(begin),
'o bundle servido que NÃO confirmou o boot anterior é DESCARTADO no lançamento seguinte (apaga o diretório e esquece as duas chaves): é a garantia 3, e o app volta ao embutido');
const confirmar = janela(WEB, 'fun confirmBoot(', 900);
checar(/if \(pendente == servido\)/.test(confirmar) && /remove\(KEY_PENDING\)/.test(confirmar),
'a confirmação desarma SÓ o bundle que está sendo servido (`pendente == servido`): um bundle pendente de outro nome não é perdoado por esta confirmação');
const aplicar = janela(WEB, 'fun applyNow(', 1400);
checar(/putString\(KEY_PENDING, active\)/.test(aplicar) && /putString\(KEY_SERVIDO, active\)/.test(aplicar),
'o `applyNow` (aplicar ao vivo) ARMA o mesmo watchdog e anota o que passou a ser servido — sem a segunda linha o lançamento seguinte compararia contra o bundle da abertura e limparia o cache por uma troca já resolvida');

console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
