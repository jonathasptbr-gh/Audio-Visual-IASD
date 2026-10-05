#!/usr/bin/env node
// ============================================================================
// O ✕ DENTRO DO CAMPO DE BUSCA DA BIBLIOTECA (v1.11.10)
//
// Pedido do operador, verbatim: *"Durante a busca por palavra chave na
// biblioteca, preciso de um 'x' dentro da caixa de texto que permita apagar a
// palavra atual e diretamente digitar uma nova palavra"*.
//
// O que este arquivo trava, e cada uma falha CALADA:
//  1. O ✕ só existe COM TEXTO. Sempre à vista, ele seria um botão que não faz
//     nada no estado em que o campo nasce (a regra da v1.8.50).
//  2. O toque LIMPA e a lista VOLTA ao acervo — sem o `renderSearchResults('')`
//     a lista ficava nos resultados de um termo que já não está escrito.
//  3. O toque DEVOLVE O FOCO ao campo: é o "diretamente digitar uma nova
//     palavra". Sem ele o teclado fecha e o operador toca duas vezes.
//  4. O ✕ está DENTRO do campo, é alcançável (hit-test) e é um alvo de dedo; o
//     texto para antes dele (o recuo) e o ✕ nativo do `type="search"` continua
//     suprimido — dois ✕ no mesmo campo seriam duas respostas ao mesmo gesto.
//  5. Fechar a Biblioteca limpa o campo e some com o ✕ — o `value = ''` do
//     fechar não dispara evento, e o botão ficaria acesso sobre um campo vazio.
//
//   node tools/busca-limpar.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import {
  servirEstatico, abrirNavegador, esperar, esperarCortina, porque, checar, falhas,
  comModoAvancado,
} from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);
await new Promise((r) => servidor.listen(0, r));
const base = `http://localhost:${servidor.address().port}`;
const navegador = await abrirNavegador();
const erros = [];

try {
  const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true });
  await semRedeExterna(ctx);
  await comModoAvancado(ctx);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await esperarCortina(pg);
  await pg.evaluate(() => openHymnSearch(false));
  const abriu = await esperar(pg, () => document.getElementById('hymnSearchPopup').classList.contains('open'), null, 15000);
  checar(abriu === true, 'PREMISSA: a Biblioteca abre', porque(abriu));
  await pg.evaluate(async () => {
    await Promise.all(document.querySelector('#hymnSearchPopup .popup-sheet').getAnimations().map((a) => a.finished.catch(() => {})));
  });

  const ler = () => pg.evaluate(() => {
    const campo = document.getElementById('hymnSearchInput');
    const x = document.getElementById('hymnSearchLimpar');
    const rc = campo.getBoundingClientRect();
    const rx = x.getBoundingClientRect();
    const cx = rx.left + rx.width / 2, cy = rx.top + rx.height / 2;
    const topo = document.elementFromPoint(cx, cy);
    return {
      oculto: x.hidden,
      valor: campo.value,
      foco: document.activeElement && document.activeElement.id,
      largura: +rx.width.toFixed(1), altura: +rx.height.toFixed(1),
      dentro: rx.width > 0 && rx.left >= rc.left && rx.right <= rc.right + 0.5
        && rx.top >= rc.top - 0.5 && rx.bottom <= rc.bottom + 0.5,
      alcanca: !!topo && (topo === x || x.contains(topo)),
      recuo: parseFloat(getComputedStyle(campo).paddingRight),
      // `getComputedStyle` de pseudo-elemento WebKit devolve o padrão do motor, não
      // a regra do app: a pergunta certa é se a REGRA que o suprime existe.
      nativo: [...document.styleSheets].some((f) => { try {
        return [...f.cssRules].some((r) => /lib-search::-webkit-search-cancel-button/.test(r.selectorText || '')
          && r.style.display === 'none'); } catch (_) { return false; } }),
      acervo: !!document.querySelector('#hymnResults .coll-group, #hymnResults .lib-item, #hymnResults .hymnal-card'),
    };
  });

  // 1 · sem texto, sem ✕
  const vazio = await ler();
  checar(vazio.oculto === true && vazio.largura === 0,
    '1 · com o campo VAZIO o ✕ não existe (`hidden`): um botão que não faz nada '
    + 'é o botão aceso que o toque tenta duas vezes', JSON.stringify(vazio));
  checar(vazio.nativo === true,
    '1 · e o ✕ NATIVO do `type="search"` continua suprimido — dois ✕ no mesmo '
    + 'campo seriam duas respostas ao mesmo gesto', vazio.nativo);

  // 2 · com texto, ✕ à vista, dentro do campo, alcançável e de tamanho de dedo
  await pg.fill('#hymnSearchInput', 'qqqqqqqq');
  await esperar(pg, () => !document.getElementById('hymnSearchLimpar').hidden, null, 10000);
  const cheio = await ler();
  checar(cheio.oculto === false && cheio.dentro,
    '2 · digitar mostra o ✕ DENTRO do campo', JSON.stringify(cheio));
  checar(cheio.alcanca,
    '2 · e ele é ALCANÇÁVEL: o hit-test no centro devolve o próprio botão (nada '
    + 'por cima do ✕, nem o campo)', JSON.stringify(cheio));
  checar(cheio.largura >= 34 && cheio.altura >= 34,
    '2 · e é um alvo de dedo (>= 34px nos dois eixos, o `--hit` do app)',
    cheio.largura + '×' + cheio.altura);
  checar(cheio.recuo >= cheio.largura,
    '2 · o texto para ANTES do ✕: o recuo à direita do campo é maior que a '
    + 'largura do botão, senão a palavra passa por baixo dele',
    cheio.recuo + ' contra ' + cheio.largura);
  // A lista está num estado de BUSCA (nenhum acervo): é o que o toque desfaz.
  const nasBuscas = await esperar(pg, () =>
    !document.querySelector('#hymnResults .coll-group, #hymnResults .lib-item, #hymnResults .hymnal-card'), null, 10000);
  checar(nasBuscas === true,
    'PREMISSA: com o termo digitado a lista saiu do acervo', porque(nasBuscas));

  // 3 · o toque limpa, devolve a lista e o foco
  // O campo PERDE o foco antes (o teclado dispensado): com ele já focado a
  // asserção do foco passaria mesmo sem a linha que o devolve.
  await pg.evaluate(() => document.getElementById('hymnSearchInput').blur());
  await pg.click('#hymnSearchLimpar');
  const voltou = await esperar(pg, () =>
    !!document.querySelector('#hymnResults .coll-group, #hymnResults .lib-item, #hymnResults .hymnal-card'), null, 10000);
  const depois = await ler();
  checar(depois.valor === '' && depois.oculto === true,
    '3 · o toque APAGA a palavra e o ✕ some', JSON.stringify(depois));
  checar(voltou === true,
    '3 · e a lista VOLTA ao acervo na hora — sem o `renderSearchResults(\'\')` ela '
    + 'ficaria nos resultados de um termo que já não está escrito', porque(voltou));
  checar(depois.foco === 'hymnSearchInput',
    '3 · e o FOCO fica no campo: é o "diretamente digitar uma nova palavra" — o '
    + 'teclado não fecha entre apagar e digitar', depois.foco);
  // E DIGITAR DE NOVO FUNCIONA, com o ✕ de volta.
  await pg.keyboard.type('amor');
  await esperar(pg, () => !document.getElementById('hymnSearchLimpar').hidden, null, 10000);
  const novo = await ler();
  checar(novo.valor === 'amor' && novo.oculto === false,
    '3 · e a palavra nova entra no campo e o ✕ volta', JSON.stringify(novo));

  // 4 · fechar a Biblioteca limpa e some com o ✕ (o `value = ''` não dispara evento)
  await pg.evaluate(() => closeHymnSearch());
  await esperar(pg, () => !document.getElementById('hymnSearchPopup').classList.contains('open'), null, 15000);
  const fechada = await ler();
  checar(fechada.valor === '' && fechada.oculto === true,
    '4 · fechar a Biblioteca limpa o campo E some com o ✕ — o `value = \'\'` do '
    + 'fechar não dispara `input`, e o botão ficaria à vista sobre um campo vazio',
    JSON.stringify(fechada));

  checar(erros.length === 0, 'nenhum erro de página', erros.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

falhas.length ? (console.log('\n' + falhas.length + ' falha(s).'), process.exit(1))
  : console.log('\nTodos passaram.');
