#!/usr/bin/env node
// ============================================================================
// A PÁGINA PÚBLICA DO PASSADOR — o redirecionamento E a cerca de segurança
//
// ## Por que ele existe
//
// O WhatsApp não transforma `http://192.168.x.y:8787/passador-de-slides` em
// link clicável (medido pelo operador: IPv4 privado com porta chega como
// TEXTO). A saída escolhida é uma página no site, que recebe o endereço da
// igreja em `h` e redireciona para ele. Só que essa página vira uma NAVEGAÇÃO
// DE TOPO controlada pela URL, no origin que também serve o download do app —
// e o modo de falhar dela é o pior deste repositório: um `javascript:` aceito
// é XSS no domínio do site, e um host público aceito é redirecionamento
// aberto com o nome da igreja.
//
// Por isso este oráculo mede as DUAS metades, e as duas contra o HTML REAL
// servido como o GitHub Pages o serve:
//
//  A. **A VALIDAÇÃO ACEITA EXATAMENTE a faixa privada** e a porta 1–65535.
//     Um IP público, um hostname, um esquema, `//`, `@`, caminho extra ou
//     `javascript:` NÃO redirecionam e caem na mensagem de link incompleto.
//     A prova é o que o navegador FAZ (a URL não mudou e nenhuma requisição
//     saiu), não o texto do arquivo.
//  B. **O REDIRECIONAMENTO EXISTE e é de topo por JS** — `location.replace`,
//     não `<meta refresh>`: o robô de prévia do WhatsApp não executa JS, e é
//     isso que impede a prévia de seguir para um IP privado. A página também
//     NÃO faz sonda por `fetch` (de `https` para `http` seria mixed content).
//  C. **O FALLBACK FICA VISÍVEL** com o endereço escrito e o link "Abrir o
//     passador" — para quando o redirecionamento for bloqueado. A prova é a
//     página com a navegação para o IP PAUSADA pelo `route`.
//
//   node tools/passador-publico.test.mjs
// ============================================================================
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { servirEstatico, abrirNavegador, checar, falhas, esperar, porque, RAIZ_SITE } from './arnes.mjs';
import { semRedeExterna } from './sem-rede.mjs';

const ARQUIVO = join(RAIZ_SITE, 'passador/index.html');
const HTML = readFileSync(ARQUIVO, 'utf8');

const servidor = servirEstatico(RAIZ_SITE);
await new Promise((r) => servidor.listen(0, r));
const BASE = 'http://127.0.0.1:' + servidor.address().port + '/passador/';
const navegador = await abrirNavegador();

// PRENDER A SAÍDA: o `setTimeout(..., 150)` do redirecionamento é GUARDADO, e
// não disparado. A página é a mesma, e a navegação de verdade é o bloco B; aqui
// o que se mede é o fallback, e sem isto o documento seria trocado no meio da
// leitura — uma corrida contra 150 ms que o runner pode perder.
const prenderSaida = () => {
  window.__avSaida = null;
  const original = window.setTimeout;
  window.setTimeout = function (fn, ms, ...args) {
    if (ms === 150 && typeof fn === 'function') { window.__avSaida = () => fn(...args); return 0; }
    return original.call(window, fn, ms, ...args);
  };
};

const abrir = async (prender = false) => {
  const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
  const externas = [];
  await semRedeExterna(ctx, (u) => externas.push(u));
  if (prender) await ctx.addInitScript(prenderSaida);
  return { ctx, externas };
};

try {
  // ── A CASA: o arquivo é autocontido e não se anuncia ────────────────────
  checar(/<html lang="pt-BR">/.test(HTML), 'a página declara português no `<html>`');
  checar(/<title>Passador de slides<\/title>/.test(HTML),
    'o título é curto e diz o recurso ("Passador de slides")');
  checar(/<meta name="robots" content="noindex, nofollow, noarchive">/.test(HTML),
    'a página pede `noindex` (higiene, como o site/registro)');
  checar(!/<meta[^>]+http-equiv=["']?refresh/i.test(HTML),
    'NÃO há `<meta refresh>`: quem redireciona é o JS, e o robô de prévia não o executa');
  checar(!/<script[^>]+\bsrc=/i.test(HTML), 'sem script externo');
  checar(!/<link[^>]+rel=["']?stylesheet/i.test(HTML),
    'sem folha externa — o CSS é inline, e não há dependência de rede');
  checar(!/<img[^>]+\bsrc=["']https?:/i.test(HTML), 'sem imagem remota');
  checar(!/analytics|gtag\(|googletagmanager/i.test(HTML), 'sem analytics');
  checar(/location\.replace\(/.test(HTML) && !/location\.href\s*=/.test(HTML),
    'a saída é `location.replace` — navegação de topo, sem entrada no histórico');
  checar(!/fetch\s*\(/.test(HTML),
    'sem sonda automática: de `https` para `http` o `fetch` seria mixed content');

  // ── B. O REDIRECIONAMENTO: um IP privado válido sai de verdade ───────────
  {
    const { ctx, externas } = await abrir();
    const pg = await ctx.newPage();
    const pedidos = [];
    // A ROTA DO DESTINO É DO ORÁCULO, registrada DEPOIS do `semRedeExterna`:
    // o Playwright resolve da mais recente para a mais antiga, e é assim que a
    // navegação para o IP privado vira um fato medível em vez de uma recusa de
    // rede.
    await ctx.route('http://192.168.0.12:8787/**', (rota) => {
      pedidos.push(rota.request().url());
      return rota.fulfill({
        status: 200, contentType: 'text/html; charset=utf-8',
        body: '<!doctype html><title>alvo</title><p id="alvo">passador</p>',
      });
    });
    await pg.goto(BASE + '?h=192.168.0.12:8787', { waitUntil: 'load' });
    const foi = await esperar(pg, () => location.hostname === '192.168.0.12' && location.port === '8787');
    checar(foi === true, '`?h=192.168.0.12:8787` navega para o endereço da igreja',
      porque(foi) || pedidos.join(' · '));
    checar((await pg.textContent('#alvo')) === 'passador',
      'o destino recebido é o passador (a navegação chegou, não é só a URL mudando)');
    checar(externas.length === 0 && pedidos.length === 1,
      'e nenhuma outra saída para a rede foi tentada',
      { externas, pedidos });
    await ctx.close();
  }

  // ── C. O FALLBACK: o endereço à vista com a saída RETIDA ────────────────
  {
    const { ctx } = await abrir(true);
    const pg = await ctx.newPage();
    // O `:` CODIFICADO também tem de valer: quem monta o link pode preferir
    // `%3A`, e a página lê o parâmetro com `URLSearchParams` (que decodifica).
    await pg.goto(BASE + '?h=192.168.7.9%3A8787', { waitUntil: 'domcontentloaded' });
    const visivel = await esperar(pg, () => {
      const c = document.getElementById('abrindo');
      return !!c && !c.hidden;
    });
    checar(visivel === true, 'a caixa do fallback aparece', porque(visivel));
    const texto = (await pg.textContent('#abrindo') || '').replace(/\s+/g, ' ').trim();
    checar(texto.includes('Não abriu? Copie este endereço no navegador: 192.168.7.9:8787'),
      'o fallback traz a frase pedida e o endereço VALIDADO escrito em texto', texto);
    checar((await pg.getAttribute('#abrir', 'href')) === 'http://192.168.7.9:8787',
      'o "Abrir o passador" leva ao MESMO destino do redirecionamento');
    checar(await pg.evaluate(() => typeof window.__avSaida === 'function'),
      'e a página AGENDOU a saída para o endereço validado (o `location.replace` existe)');
    await ctx.close();
  }

  // ── D. A CERCA: o que não é IPv4 privado NÃO redireciona, nunca ──────────
  {
    const { ctx, externas } = await abrir();
    const pg = await ctx.newPage();
    let dialogo = false;
    pg.on('dialog', (d) => { dialogo = true; d.dismiss().catch(() => {}); });

    const recusados = [
      ['javascript:alert(1)', 'esquema `javascript:`'],
      ['//evil.com', 'protocolo relativo `//`'],
      ['http://192.168.0.12:8787', 'esquema escrito na URL'],
      ['192.168.0.12:8787/passador', 'caminho extra'],
      ['user@192.168.0.12:8787', '`@` (userinfo)'],
      ['8.8.8.8:80', 'IPv4 público'],
      ['172.15.0.1:8787', 'fora de 172.16–172.31'],
      ['192.169.0.1:8787', 'fora de 192.168'],
      ['192.168.0.12', 'sem porta'],
      ['192.168.0.12:0', 'porta 0'],
      ['192.168.0.12:65536', 'porta acima de 65535'],
      ['192.168.0.12:8787:1', 'duas portas'],
      ['10.0.0.256:8787', 'octeto acima de 255'],
      ['10.0.0.01:8787', 'octeto com zero à esquerda'],
      ['192.168.0.12:08787', 'porta com zero à esquerda'],
    ];
    let aindaNoLugar = true;
    for (const [h, motivo] of recusados) {
      await pg.goto(BASE + '?h=' + encodeURIComponent(h), { waitUntil: 'domcontentloaded' });
      const erro = await pg.isVisible('#incompleto');
      const abrindo = await pg.isVisible('#abrindo');
      const ancora = (await pg.getAttribute('#abrir', 'href')) || '';
      const url = pg.url();
      if (!erro || abrindo || !url.startsWith(BASE) || ancora !== '#') {
        aindaNoLugar = false;
        checar(false, `recusa ${motivo}`, { h, erro, abrindo, url, ancora });
      }
    }
    if (aindaNoLugar) {
      for (const [h, motivo] of recusados) console.log('ok      recusa ' + motivo + ' (`' + h + '`)');
    }
    checar(dialogo === false, 'nenhum `javascript:` virou diálogo no origin do site');
    checar(externas.length === 0, 'e nenhum redirecionamento abriu saída para fora', externas);

    // O `h` AUSENTE e o VAZIO caem na mesma página de erro, e ela explica.
    for (const url of [BASE, BASE + '?h=', BASE + '?h=%20']) {
      await pg.goto(url, { waitUntil: 'domcontentloaded' });
      const erro = await pg.isVisible('#incompleto');
      const texto = (await pg.textContent('#incompleto') || '').replace(/\s+/g, ' ').trim();
      checar(erro && /Este link veio incompleto/.test(texto),
        'link faltando ou vazio mostra a mensagem de link incompleto (' + url.replace(BASE, '') + ')',
        texto);
    }
    checar((await pg.textContent('#incompleto')).includes('Peça para enviarem o link'),
      'a mensagem de erro diz o que fazer (pedir o link de novo), e nunca tela branca');
    await ctx.close();
  }

  // ── E. A FRONTEIRA VÁLIDA DOS DOIS LADOS NÃO É ACEITA POR ACIDENTE ──────
  // Os extremos privados que a página DEVE aceitar. Medir só as recusas
  // aprovaria uma cerca que recusa tudo — e o passador nunca abriria.
  {
    const { ctx } = await abrir(true);
    for (const h of ['10.0.0.1:1', '172.16.0.1:65535', '172.31.255.255:8787', '192.168.255.254:8080']) {
      const pg = await ctx.newPage();
      await pg.goto(BASE + '?h=' + encodeURIComponent(h), { waitUntil: 'domcontentloaded' });
      checar((await pg.getAttribute('#abrir', 'href')) === 'http://' + h,
        `o "Abrir o passador" de \`${h}\` aponta para o endereço certo`);
      checar(await pg.evaluate(() => typeof window.__avSaida === 'function'),
        `o limite privado ainda foi aceito (a saída foi agendada): \`${h}\``);
      await pg.close();
    }
    await ctx.close();
  }
} finally {
  await navegador.close();
  await new Promise((r) => servidor.close(r));
}

console.log('');
if (falhas.length) {
  console.log(`${falhas.length} FALHA(S) — o redirecionamento público não está cercado.`);
  process.exit(1);
}
console.log('A página pública redireciona só para IPv4 privado com porta, e mantém o fallback à vista.');
