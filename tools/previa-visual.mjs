#!/usr/bin/env node
// =============================================================================
// A PRÉVIA VISUAL — o laço de design, sem publicar
//
// **A REGRA:** lote cujo diff é SÓ aparência — CSS, o HTML de uma folha ou de um
// card, espaçamento, cor, sombra, animação — NÃO vai a `main` para ser
// vistoriado. Ele se vê aqui, no working tree, e só entra no rito de publicação
// depois de aprovado. O ciclo de antes era push → CI → OTA → aparelho → olhar;
// este é salvar → recarregar → olhar.
//
// **E O QUE ISSO NÃO MUDA:** a prévia não substitui os oráculos nem a
// conferência no aparelho. O lote visual continua sendo lote: versão, notas,
// portão e release como qualquer outro. O que deixa de existir é o "publica
// para ver como ficou".
//
//   node tools/previa-visual.mjs              serve e imprime as URLs (fica de pé)
//   node tools/previa-visual.mjs --porta 9001
//   node tools/previa-visual.mjs --foto ~/tmp/tela.png
//   node tools/previa-visual.mjs --foto ~/tmp/tela.png --rota /display/ --largura 1280 --altura 720
//
// O QUE ELE SERVE, e por que é fiel: `app/src/main/assets/web` É a base que o
// OTA entrega — a mesma que o WebView do aparelho carrega. Não há build: o
// arquivo salvo é o arquivo servido, a cada requisição.
//
// O QUE ELE NÃO É:
//   · **Sem a ponte** (`window.__NATIVE__` falso, o caminho de navegador que a
//     base mantém de propósito — `docs/DIVERGENCIAS-WEB-NATIVO.md`): telão/TV,
//     `Presentation`, YouTube, cifra, PDF/`.pptx`, share e OTA não existem.
//     Para esses, o ciclo continua no aparelho.
//   · **Chromium do Playwright, não o WebView do aparelho.** Mesma família de
//     motor, mas fonte, densidade e barras de rolagem diferem. Serve para
//     desenho (espaço, cor, corte de texto, hierarquia, alinhamento); não serve
//     para MEDIDA final — e nenhuma asserção de oráculo nasce daqui.
//   · **O que ele mostra é o DISCO, não o HEAD.** Lote sem commit de outra
//     sessão aparece junto (`docs/MULTI-AGENTE.md`): a prévia não distingue de
//     quem é a mudança, e quem olha precisa saber o que está olhando.
//
// A PORTA. 8097 por padrão; 3080/3081/3083 são do harness e não se ocupam.
// `0.0.0.0` de propósito: quem opera olha no NAVEGADOR DO CELULAR, e é a URL da
// rede que chega lá. Para derrubar, Ctrl-C.
// =============================================================================
import os from 'node:os';
import path from 'node:path';
import {
  servirEstatico, RAIZ_WEB, abrirNavegador, esperarCortina, VIEWPORT,
} from './arnes.mjs';

const args = process.argv.slice(2);
const opcao = (nome, padrao = null) => {
  const i = args.indexOf('--' + nome);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : padrao;
};

const numero = (nome, padrao) => {
  const v = Number(opcao(nome, padrao));
  return Number.isFinite(v) && v > 0 ? v : padrao;
};

const PORTA = numero('porta', 8097);
const ROTA = opcao('rota', '/controle/');
const FOTO = opcao('foto');
const LARGURA = numero('largura', VIEWPORT.width);
const ALTURA = numero('altura', VIEWPORT.height);
const ESPERA = numero('espera', 1200);

/** `~/tmp/tela.png` → caminho absoluto: o `fs` não expande `~`, e o hábito de
 *  escrever com ele é o que mantém a foto fora do repositório. */
const absoluto = (p) => (p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : path.resolve(p));

/** As URLs que chegam em algum lugar: a do próprio aparelho e as da rede. */
function urls(porta, rota) {
  const lista = ['http://127.0.0.1:' + porta + rota];
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const i of ifaces || []) {
      if (i.family === 'IPv4' && !i.internal) lista.push('http://' + i.address + ':' + porta + rota);
    }
  }
  return lista;
}

async function fotografar() {
  const servidor = servirEstatico(RAIZ_WEB);
  await new Promise((ok) => servidor.listen(0, '0.0.0.0', ok));
  const porta = servidor.address().port;
  const nav = await abrirNavegador();
  try {
    const ctx = await nav.newContext({ viewport: { width: LARGURA, height: ALTURA }, reducedMotion: 'reduce' });
    const pg = await ctx.newPage();
    const erros = [];
    pg.on('pageerror', (e) => erros.push(e.message));
    await pg.goto('http://127.0.0.1:' + porta + ROTA, { waitUntil: 'load' });
    await esperarCortina(pg).catch(() => { /* a foto sai do que houver */ });
    await pg.waitForTimeout(ESPERA);
    const alvo = absoluto(FOTO);
    await pg.screenshot({ path: alvo });
    const versao = await pg.evaluate(() => (document.getElementById('appVersion') || {}).textContent || '?');
    console.log('foto: ' + alvo + ' (' + LARGURA + 'x' + ALTURA + ', ' + versao + ')');
    if (erros.length) console.log('ERRO de página: ' + erros.slice(0, 3).join(' | '));
  } finally {
    await nav.close();
    servidor.close();
  }
}

if (FOTO) {
  await fotografar();
} else {
  const servidor = servirEstatico(RAIZ_WEB);
  servidor.on('error', (e) => {
    console.log('não subiu (' + e.code + '): a porta ' + PORTA + ' já está ocupada — use --porta.');
    process.exit(1);
  });
  servidor.listen(PORTA, '0.0.0.0', () => {
    console.log('prévia visual — ' + RAIZ_WEB);
    for (const u of urls(PORTA, ROTA)) console.log('  ' + u);
    console.log('salve o arquivo e recarregue a página; Ctrl-C encerra.');
  });
}
