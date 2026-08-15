// O ORÁCULO DOS TOKENS — `var(--x)` que aponta para um token que não existe.
//
// ## Por que ele existe
//
// Um `var(--nao-existe)` SEM fallback não é um erro em lugar nenhum: a
// declaração inteira computa para o valor INICIAL da propriedade. Não há aviso
// no console, o CSS carrega, a página monta, e o que se vê é um botão com
// `border-radius: 0` no meio de um app inteiro arredondado — ou uma cor que
// virou preto, ou um `gap` que sumiu.
//
// Foi exatamente isso na v5.171: `.cast-choice` (os DOIS botões principais da
// folha "Conectar uma tela") pedia `var(--radius-md)`, um token que nunca
// existiu nesta base. Os dois únicos cantos retos do aplicativo estavam
// justamente na primeira tela do recurso mais novo, e nenhuma ferramenta
// reclamou — foi preciso um par de olhos no aparelho.
//
// É a mesma família do `setInteger` numa chave `long` do `MediaFormat`, do
// `bytes` esquecido no `bgProgress` e do `slideLabel` no `nowPlaying`: falha sem
// exceção, sem log, e sem sintoma no lugar da causa. E a resposta deste
// repositório a essa família é sempre a mesma — um oráculo que a trava.
//
// ## O que ele NÃO reprova
//
// `var(--x, fallback)` COM fallback é um idioma legítimo e muito usado aqui: é
// como o JS entrega valores em tempo de execução (`--vol`, `--ch`, `--tab-w`,
// `--pv-ar`…), e o fallback é o valor de repouso. Reprovar isso quebraria meia
// dúzia de componentes que funcionam.
//
//   node tools/tokens.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');

// Toda folha da base — inclusive a do cliente do espelho, que é servida na rede
// e nunca é aberta por ninguém com um console à mão.
function folhas(dir) {
  const out = [];
  for (const nome of fs.readdirSync(dir)) {
    const p = path.join(dir, nome);
    if (fs.statSync(p).isDirectory()) {
      if (nome === 'vendor') continue;          // código buildado de terceiro
      out.push(...folhas(p));
    } else if (nome.endsWith('.css')) out.push(p);
  }
  return out;
}

// COMENTÁRIO NÃO É DECLARAÇÃO, e também não é uso. Este arquivo documenta a si
// mesmo com fartura — o cabeçalho de `tokens.css` cita `var(--x)` para explicar
// a própria regra —, e sem tirar os comentários o oráculo reprova a prosa que
// existe para justificá-lo. Tirar é estritamente correto nos DOIS sentidos: um
// `--token: valor` dentro de um comentário não define nada, e um `var(--token)`
// dentro de um comentário não pinta nada.
const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

const arquivos = folhas(RAIZ);
const falhas = [];
function checar(cond, msg, detalhe) {
  if (cond) console.log('ok      ' + msg);
  else { console.log('FALHOU  ' + msg + (detalhe ? '\n        ' + detalhe : '')); falhas.push(msg); }
}

checar(arquivos.length > 0, 'a base web tem folhas de estilo para varrer', String(arquivos.length));

// TODAS as definições, de TODAS as folhas: `tokens.css` é a fonte única da
// paleta, mas cada app define os próprios tokens de layout no `:root`.
const definidos = new Set();
const fonte = new Map();   // caminho → conteúdo já sem comentários
for (const f of arquivos) {
  const s = semComentarios(fs.readFileSync(f, 'utf8'));
  fonte.set(f, s);
  for (const m of s.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) definidos.add(m[1]);
}
checar(definidos.has('--accent') && definidos.has('--radius-btn'),
  'e a varredura enxerga os tokens de verdade (a paleta e a escala de raio)',
  definidos.size + ' tokens');

// E TODO uso sem fallback tem de casar com uma definição.
const orfaos = [];
for (const f of arquivos) {
  const s = fonte.get(f);
  for (const m of s.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)\s*\)/g)) {
    if (definidos.has(m[1])) continue;
    orfaos.push(path.relative(RAIZ, f) + ':' + (s.slice(0, m.index).split('\n').length) + ' → ' + m[1]);
  }
}
checar(orfaos.length === 0,
  'nenhum `var(--x)` sem fallback aponta para um token inexistente',
  orfaos.join('\n        '));

// ---------- O TEMA CLARO SÓ SOBRESCREVE (v5.192) ----------
// O bloco `:root[data-tema="claro"]` é um DELTA sobre o `:root` de base: o que
// ele não redeclara cai no tema escuro, e é assim que o PALCO (`--stage-*`,
// `--wallpaper`, as sombras) fica igual nos dois — deliberado, porque um telão
// claro cega a congregação e a preview do Controle espelha o telão.
//
// O que essa montagem NÃO tolera é um token que exista SÓ no claro: no tema
// escuro — que é o padrão de quem nunca escolheu nada, isto é, quase todo
// aparelho — ele simplesmente não estaria definido, e o `var()` computaria para
// o valor inicial da propriedade. Sem aviso, sem log, e só no tema padrão: a
// mesma falha da v5.171, num lugar onde quem escreveu acabou de ver a cor certa
// na tela porque estava com o claro ligado.
{
  const s = fonte.get(arquivos.find((f) => f.endsWith('tokens.css'))) || '';
  const blocos = [...s.matchAll(/(:root(?:\[data-tema="(\w+)"\])?)\s*\{([^}]*)\}/g)];
  const naBase = new Set();
  const soNoClaro = [];
  for (const b of blocos) if (!b[2]) for (const m of b[3].matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) naBase.add(m[1]);
  for (const b of blocos) {
    if (b[2] !== 'claro') continue;
    for (const m of b[3].matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) if (!naBase.has(m[1])) soNoClaro.push(m[1]);
  }
  checar(blocos.some((b) => b[2] === 'claro'), 'tokens.css declara o bloco do tema claro',
    blocos.map((b) => b[1]).join(' · '));
  checar(soNoClaro.length === 0,
    'nenhum token existe SÓ no tema claro (o escuro é a base, o claro é o delta)',
    soNoClaro.join(', '));
}

// ---------- NENHUM CONTORNO EM LUGAR NENHUM (v5.267) ----------
// Pedido do operador: *"não tenhamos itens usando linha de borda, tudo deve ser
// com preenchimento sólido, e definição feita por puro e simples contraste entre
// os elementos."*
//
// Ele é uma REGRA DA CASA agora, e regra de casa sem oráculo dura até o próximo
// lote: uma borda é a coisa mais fácil de acrescentar em CSS quando duas caixas
// não estão se separando o bastante — é literalmente o remendo que este lote veio
// desfazer, e ele estava espalhado por 88 declarações. Um `border: 1px solid` a
// mais não quebra nada, não erra alto e não aparece em teste de comportamento
// nenhum; some dentro de uma folha de 4.300 linhas e volta a valer como
// precedente para o próximo.
//
// A varredura é da FONTE e não do renderizado, e isso é deliberado: metade das
// bordas que saíram morava em regras de ESTADO (`.active`, `.no-ar`,
// `.expanded`) e em pseudo-elementos, que uma caminhada pelo DOM só alcançaria
// se o teste soubesse encenar cada um dos estados.
//
// ## O que NÃO é contorno, e por isso passa
//
// `border` também é a forma idiomática de DESENHAR em CSS, e desenho não é o que
// o pedido trata. Dois casos, os dois nomeados aqui em vez de detectados por
// heurística — uma heurística deixaria a próxima borda entrar chamando-se
// "desenho":
//
//   · o aro do `.dl-ring` (o anel que gira enquanto um download corre) e o do
//     `.av-stage-busy` (o mesmo, no palco) — eles SÃO círculos, não a moldura
//     de um elemento;
//   · o ✓ do `.song-menu-check` (duas bordas em L, giradas 45°) — é o glifo que
//     falta no subset da fonte de ícones.
//
// Largura zero e cor transparente também passam: os dois não desenham nada.
{
  // As regras dos DESENHOS, recortadas da fonte antes da varredura. Nomeadas
  // uma a uma de propósito: uma heurística ("anéis podem") deixaria a próxima
  // borda entrar chamando-se desenho.
  const recortar = (s) => s
    .replace(/\.dl-ring::before\s*\{[^}]*\}/g, '')
    .replace(/\.av-stage-busy::after\s*\{[^}]*\}/g, '')
    .replace(/\.song-menu-check\.on::after\s*\{[^}]*\}/g, '')
    .replace(/@media[^{]*\{\s*\.dl-ring::before[^}]*\}/g, '');
  const contornos = [];
  for (const f of arquivos) {
    const s = recortar(semComentarios(fonte.get(f) || ''));
    for (const m of s.matchAll(/(^|[;{\s])(border(?:-(?:top|right|bottom|left))?(?:-(?:width|color|style))?|outline(?:-(?:width|color|style))?)\s*:\s*([^;}]+)/g)) {
      const valor = m[3].trim();
      // `border-radius` não é contorno (a regex acima já não o casa), e estes
      // três valores não desenham: sem linha, sem largura, sem cor.
      if (/^(none|0|0px|transparent|hidden)$/.test(valor)) continue;
      if (/\btransparent\b/.test(valor) && !/\b(solid|dashed|dotted)\b/.test(valor)) continue;
      contornos.push(path.relative(RAIZ, f) + ':' + (s.slice(0, m.index).split('\n').length)
        + ' → ' + m[2] + ': ' + valor);
    }
  }
  checar(contornos.length === 0,
    'nenhuma regra desenha contorno: no app tudo se separa por PREENCHIMENTO',
    contornos.join('\n        '));
}

console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
