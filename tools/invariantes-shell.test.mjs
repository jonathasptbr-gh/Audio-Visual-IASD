#!/usr/bin/env node
// AS INVARIANTES DO SHELL, CONFERIDAS CONTRA O CÓDIGO — não contra a memória.
//
// ## Por que este oráculo existe
//
// As invariantes 1–9 do `CLAUDE.md` são a fronteira entre uma base web servida
// pelo próprio app e um comprometimento do aparelho do operador. Duas delas
// NÃO tinham oráculo nenhum:
//
//   - a **2** (a navegação só autoriza o origin por COMPONENTE do `Uri`, nunca
//     por prefixo de string) — o ponto que "não pode falhar ABERTO", porque
//     `appassets.androidplatform.net.evil.com` começa com o origin e qualquer
//     um registra esse domínio. Dentro de um WebView que injeta `__AVBridge` em
//     TODA página, um `startsWith` autoriza a navegação para fora;
//   - a **9** (o telão nasce com `host = null` e loader SEM `/saf/`), que o
//     próprio `CLAUDE.md` declara sem oráculo, e cuja ausência de teste é o
//     único motivo pelo qual ela depende de duas pessoas não errarem.
//
// As outras (1, 4, 6, 7, 8, e o `onRenderProcessGone`) nasceram de defeitos que
// custaram rodada de APK, e cada uma é hoje um override ou uma linha de
// configuração — trocável por acidente, invisível no `node --check` (que não
// olha `.kt`) e invisível neste aparelho, onde Kotlin não compila.
//
// ## O que ele É
//
// A leitura ESTÁTICA do `.kt` e do manifesto, na única pergunta que dá para
// responder sem aparelho e sem Android SDK: **a declaração que carrega a regra
// ainda está lá, e com a forma que a torna segura?** É a mesma resposta do
// `kotlin-simbolo-importado` e do `manifest-provedores`: o que quebra aqui não
// dá erro em lugar nenhum — dá um app que instala, abre e perde a proteção.
//
// ## O que ele NÃO é
//
// Não compila, não resolve tipos e não sabe se o código roda. Ele afirma forma,
// não comportamento: quem prova comportamento é o `webview-range`, os JUnit do
// espelho e o culto. Uma linha que ele aceita pode ainda estar errada — o que
// ele não deixa é a proteção SUMIR sem ninguém ver.
//
//   node tools/invariantes-shell.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checar, falhas } from './checar.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(RAIZ, 'app/src/main/java/br/org/iasd/av');
const LER = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

// SÓ AS LINHAS DE CÓDIGO. Um comentário que DESCREVE a invocação — e este
// repositório escreve KDoc longo sobre cada uma delas, inclusive citando
// `startsWith` como o erro a não cometer — não pode satisfazer (nem reprovar)
// uma asserção sobre ela. O mesmo critério do `pares-de-comentario`: fica de
// fora a linha cujo primeiro caractere é `//`, `*` ou `/*`, e o comentário de
// XML (`<!--`), que aqui só existe no manifesto.
const SO_CODIGO = (texto) =>
  texto
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*|<!--)/.test(l))
    .join('\n');

const wvf = SO_CODIGO(LER('app/src/main/java/br/org/iasd/av/WebViewFactory.kt'));
const stp = SO_CODIGO(LER('app/src/main/java/br/org/iasd/av/StagePresentation.kt'));
const main = SO_CODIGO(LER('app/src/main/java/br/org/iasd/av/MainActivity.kt'));
const man = LER('app/src/main/AndroidManifest.xml');

const KOTLIN = fs.readdirSync(DIR).filter((f) => f.endsWith('.kt')).sort();
const CODIGO_KOTLIN = KOTLIN.map((f) => [f, SO_CODIGO(fs.readFileSync(path.join(DIR, f), 'utf8'))]);

// A VARREDURA TEM DE TER LIDO ALGUMA COISA. Um placar limpo sobre um caminho
// errado é indistinguível de um código correto — e esta é a falha padrão de
// qualquer varredor que ninguém vigia.
checar(wvf.length > 2_000 && stp.length > 2_000 && main.length > 50_000 && man.length > 5_000,
  'a varredura leu os quatro arquivos do shell (WebViewFactory, StagePresentation, MainActivity, manifesto)',
  `${wvf.length} · ${stp.length} · ${main.length} · ${man.length} bytes`);

// ===== INVARIANTE 1 e 2 — o origin, e a comparação por COMPONENTE =====
checar(/const val ORIGIN_HOST\s*=\s*"appassets\.androidplatform\.net"/.test(wvf),
  'a invariante 1: o host servido é `appassets.androidplatform.net` (contexto seguro; nunca `file://`)');
checar(/const val ORIGIN\s*=\s*"https:\/\/\$ORIGIN_HOST"/.test(wvf),
  'e o origin é MONTADO a partir do host — um valor só, para os dois WebViews (invariante 2)');
checar(/url\.host\s*==\s*(WebViewFactory\.)?ORIGIN_HOST/.test(wvf),
  'a navegação compara o HOST do `Uri`, e não o prefixo da string da URL (invariante 2 — o ponto que não pode falhar ABERTO)');
// A forma VULNERÁVEL é comparar o origin (ou o host dele) por prefixo — não
// qualquer `startsWith` de esquema: `texto.startsWith("https://")` pergunta se
// uma URL é https, e `origem.startsWith("http://")` no `EspelhoHttp` recorta o
// esquema de um cabeçalho. O que este padrão pega é o "é do nosso origin?"
// escrito por prefixo.
const PREFIXO_DO_ORIGIN =
  /\bstartsWith\s*\(\s*(ORIGIN\b|ORIGIN_HOST\b|ORIGIN\s*\+|"https:\/\/appassets|"appassets\.androidplatform)/;
const comPrefixo = CODIGO_KOTLIN.filter(([, t]) => PREFIXO_DO_ORIGIN.test(t)).map(([f]) => f);
checar(comPrefixo.length === 0,
  'nenhum ponto do shell pergunta "é do origin?" por `startsWith` — `…androidplatform.net.evil.com` começa igual',
  comPrefixo.join(', '));

// E A INVARIANTE 2 TEM UM LUGAR SÓ (revisão X2). Ela já esteve escrita em três
// cópias — a navegação, a janela do `/saf/` e o proxy da transmissão, apagado na
// v1.13.49 — com a MESMA pergunta em formas diferentes. Três escritas da mesma
// cerca divergem no primeiro ajuste, e a que ficar para trás fura a porta que a
// outra fecha, em silêncio: o `startsWith` acima é o teste do PADRÃO errado, e
// este é o teste de a pergunta ser UMA. É a única forma de travar a DIVERGÊNCIA
// sem aparelho: o `invariantes-shell` antigo aceitava as três cópias.
checar(/fun ehDoApp\(url: Uri\): Boolean\s*=\s*url\.scheme == "https" && url\.host == ORIGIN_HOST/.test(wvf),
  'a invariante 2 mora num predicado só, `WebViewFactory.ehDoApp` (esquema E host do `Uri`, na mesma expressão)');
const copias = CODIGO_KOTLIN
  .filter(([f]) => f !== 'WebViewFactory.kt')
  .filter(([, t]) => /\.host\s*[!=]=\s*(WebViewFactory\.)?ORIGIN_HOST/.test(t))
  .map(([f]) => f);
checar(copias.length === 0,
  'e nenhum outro arquivo do shell repete a comparação do host do origin — quem precisa dela chama `WebViewFactory.ehDoApp` (uma cópia a mais é uma porta a mais para divergir)',
  copias.join(', '));
const chamadores = CODIGO_KOTLIN.filter(([, t]) => /\behDoApp\(/.test(t)).map(([f]) => f).sort();
checar(chamadores.length >= 2,
  'a navegação E a janela do `/saf/` perguntam pelo MESMO predicado (as duas portas que a invariante 2 fecha)',
  chamadores.join(', '));

// ===== INVARIANTE 4 — o que o WebView pode abrir =====
for (const [decl, por] of [
  ['allowFileAccess = false', 'sem `file://` direto: tudo entra pelo asset loader'],
  ['allowContentAccess = false', 'sem `content://` direto'],
  ['mediaPlaybackRequiresUserGesture = false', 'é o que aposenta o overlay "Ligar Sistema" e toca o telão sozinho'],
  ['domStorageEnabled = true', 'IndexedDB/localStorage dos dois papéis'],
  ['javaScriptEnabled = true', 'a base web inteira'],
]) {
  checar(new RegExp(decl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(wvf),
    `a invariante 4: \`${decl}\` — ${por}`);
}

// ===== INVARIANTE 6 e 7 — os dois overrides que falham MUDO =====
checar(/class ControleChromeClient\s*:\s*WebChromeClient\(\)/.test(main),
  'o `WebChromeClient` do Controle existe... (invariantes 6 e 7 moram nele, não na factory)');
for (const [nome, por] of [
  ['onShowFileChooser', 'sem ele o WebView IGNORA `<input type="file">` — o toque não faz nada, sem erro no console (importar o Cronograma, escolher o wallpaper)'],
  ['onShowCustomView', 'sem ele `requestFullscreen()` falha em silêncio, e a preview em tela cheia É a projeção quando não há TV'],
  ['onHideCustomView', 'o par do de cima: sem ele a tela cheia nunca desfaz a trava de paisagem'],
]) {
  checar(new RegExp(`override fun ${nome}\\s*\\(`).test(main), `...e declara \`${nome}\`: ${por}`);
}
checar(/requestedOrientation\s*=\s*ActivityInfo\.SCREEN_ORIENTATION_LANDSCAPE/.test(main),
  'a tela cheia trava a paisagem (é o equivalente nativo do `screen.orientation.lock` do PWA)');

// ===== INVARIANTE 8 — o erro com corpo VAZIO não chega =====
checar(/ByteArray\(1\)/.test(wvf),
  'a invariante 8: o 404 tem UM byte de corpo — com corpo vazio o `ComputeBounds` do WebView reprova a faixa e o status evapora');
checar(!/ByteArray\(0\)/.test(wvf),
  'e nenhum caminho devolve corpo de zero byte para uma faixa fora do zero');

// ===== INVARIANTE 9 — o telão não tem a superfície privilegiada =====
checar(/role\s*=\s*"display"/.test(stp),
  'a invariante 9: o telão se declara papel `display` na ponte');
checar(/host\s*=\s*null/.test(stp),
  'a invariante 9: o telão nasce com `host = null` — sem ele `pickFolder`/`listFolder`/`pickDoc`/`openExternal`/`espelhoLigar` virariam superfície de qualquer script daquela página');
checar(/assetLoader\(context,\s*withSaf\s*=\s*false\)/.test(stp),
  'a invariante 9: e o loader do telão é montado SEM o handler `/saf/` (`withSaf = false`)');
checar(/keepVisible\s*=\s*true/.test(stp),
  'o telão nasce `keepVisible = true`: ele É a projeção e não pode se declarar oculto ao Chromium');

// ===== CULTO — a morte do renderer não pode levar o app =====
checar(/override fun onRenderProcessGone\s*\(/.test(wvf) && /onRenderProcessGone[\s\S]{0,1200}?return true/.test(wvf),
  'a morte do renderer é TRATADA (`onRenderProcessGone` devolve `true`): a implementação padrão devolve `false` e o framework MATA o processo — o dos dois WebViews e da `Presentation`, no meio do culto');
checar(/MessageBus\.detach\(view\)/.test(wvf),
  'e o WebView morto sai do barramento antes de ser destruído (um cliente morto recebendo comando é o defeito vizinho)');

// A ÚNICA PORTA DE CONSTRUÇÃO. Um `WebView` novo fora da factory nasceria sem
// as quatro acima e sem o `onRenderProcessGone` — os dois WebViews existem para
// ser os mesmos por dentro.
const forjas = CODIGO_KOTLIN.filter(([, t]) => /:\s*WebView\(/.test(t)).map(([f]) => f);
checar(forjas.length === 1 && forjas[0] === 'WebViewFactory.kt',
  'o shell só constrói `WebView` na factory (um WebView novo nasceria sem as invariantes 4 e 8 e sem o tratamento da morte do renderer)',
  forjas.join(', '));

// ===== O GUIA DE SONOPLASTIA (shell 87) — um WebView de TERCEIRO, sem ponte =====
const guia = SO_CODIGO(LER('app/src/main/java/br/org/iasd/av/GuiaSom.kt'));
const fabricaGuia = (wvf.match(/fun createGuia\([\s\S]*?\n    \}/) || [''])[0];
checar(fabricaGuia && !/addJavascriptInterface|assetLoader|SafJanela/.test(fabricaGuia) && !/addJavascriptInterface/.test(guia),
  'o WebView do guia nasce SEM `addJavascriptInterface`, sem asset loader e sem `/saf/` (a página é do site, terceiro para o app)');
checar(/override fun onRenderProcessGone\s*\(/.test(guia) && /onRenderProcessGone[\s\S]{0,600}?return true/.test(guia),
  'e trata a morte do renderer (`true`): o processo é o mesmo dos dois WebViews e da `Presentation`');
checar(/if \(GuiaSom\.urlDoGuia\(alvo\.toString\(\)\)\) return false/.test(guia) && /fun abrirGuia\(url: String\?\): Boolean \{[\s\S]{0,200}?GuiaSom\.urlDoGuia\(url\)/.test(SO_CODIGO(LER('app/src/main/java/br/org/iasd/av/NativeBridge.kt'))),
  'a cerca do guia é UM predicado (`GuiaSom.urlDoGuia`), perguntado na ponte e a cada navegação do quadro principal');

// ===== O MANIFESTO — o que sustenta os dois WebViews e o reenvio =====
for (const [decl, por] of [
  ['android:hardwareAccelerated="true"', 'os dois WebViews e um vídeo grande no mesmo processo'],
  ['android:largeHeap="true"', 'pelo mesmo motivo: sem ele o OOM chega antes'],
  ['android:launchMode="singleTask"', 'o share com o app aberto chega por `onNewIntent`, não numa segunda Activity'],
  ['android:screenOrientation="portrait"', 'o Controle é retrato; a paisagem é da trava da tela cheia'],
]) {
  checar(man.includes(decl), `o manifesto declara \`${decl}\` — ${por}`);
}
checar(/<queries>[\s\S]*?smartmirroring[\s\S]*?<\/queries>/.test(man),
  'o bloco `<queries>` do manifesto é o que deixa a cadeia do espelhamento RESOLVER (Android 11+ esconde os alvos sem ele)');

console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
