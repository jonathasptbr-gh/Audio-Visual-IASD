// ============================================================================
// LIMPAR O CRONOGRAMA — o EXCLUIR do único (v1.13.5) — e o IMPORTAR na barra
// ============================================================================
//
// O botão de limpar morou na trilha 1 da barra do topo da v1.8.66 à v1.13.4.
// Pedido do operador (v1.13.5), verbatim: *"remova o botão de limpar
// cronograma, pois sua função basicamente se pode obter pelo botão de excluir
// cronograma na lista de cronogramas"* e *"no lugar do esvaziar lista de
// cronograma, mova o botão de importar arquivo para o cronograma. Use é claro
// um botão de apenas ícone"*.
//
// Com UM cronograma só, EXCLUIR é LIMPAR: o app nunca fica com zero, e o
// excluir do único (que até a v1.13.4 era apagado) esvazia a lista e deixa o
// cronograma de pé. A função é a mesma de sempre (`limparCronograma`); o que
// mudou é a porta.
//
// ---------- O QUE ESTE ARQUIVO EXISTE PARA IMPEDIR ----------
//
//  1. A FUNÇÃO PERDIDA (blocos D e E). Sem o botão da barra, a ÚNICA porta para
//     esvaziar o único cronograma é o excluir dele — apagado como era, a função
//     sumia sem nada na tela dizer onde foi.
//  2. A CENA INTERROMPIDA (bloco E). Limpar com o louvor no ar NÃO pode tirá-lo
//     do telão — a regra da v1.3.13 (*"excluir de uma lista não tira do ar"*).
//  3. O APAGAR SEM PERGUNTAR (bloco D). Um toque abre a pergunta, e CANCELAR não
//     apaga nada: as duas metades, porque um diálogo que sempre confirma passa
//     na primeira e falha na segunda.
//  4. O BOTÃO ACESO SOBRE NADA (bloco F). Com o único cronograma vazio o excluir
//     fica `disabled`, com o `title` (e o `aria-label`) dizendo por quê.
//  5. O IMPORTAR (blocos A, B, C e H): ele é o morador da trilha 1 — só o ícone,
//     sem corpo, a caixa da engrenagem, o título no eixo, a tinta acima do piso
//     nos dois temas, a resposta ao toque — e o toque abre o seletor.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import {
  servirEstatico, abrirNavegador, esperarCortina, esperar, porque, checar, falhas,
  lerPng, pixel, luminancia, comTema,
} from './arnes.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port + '/controle/index.html';
const navegador = await abrirNavegador();

const rgb = (c) => c.match(/\d+/g).slice(0, 3).map(Number);
const razao = (a, b) => {
  const [x, y] = [luminancia(rgb(a)), luminancia(rgb(b))].sort((p, q) => q - p);
  return +((x + 0.05) / (y + 0.05)).toFixed(2);
};

// A CENA: o Cronograma com itens de verdade. `n` itens de áudio, que é o kind
// mais barato de plantar e o que o Cronograma de um culto mais carrega.
async function abrir(tema, n) {
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 900 }, hasTouch: true, colorScheme: tema });
  await semRedeExterna(ctx);
  await comTema(ctx, tema);
  const pg = await ctx.newPage();
  const erros = [];
  pg.on('pageerror', (e) => erros.push(String(e.message)));
  await pg.goto(base, { waitUntil: 'load' });
  await esperarCortina(pg);
  await pg.evaluate(async (qtd) => {
    const z = (ms) => new Promise((f) => setTimeout(f, ms));
    setAppMode('full'); await z(150);
    for (let i = 0; i < qtd; i++) {
      await AVDB.addMedia(new Blob(['x'], { type: 'audio/mpeg' }),
        { name: 'Louvor ' + i, type: 'audio/mpeg', kind: 'audio', list: 'imports' });
    }
    await load(); await z(400);
  }, n);
  return { ctx, pg, erros };
}

// O toque no EXCLUIR do único cronograma (na linha dele, na gaveta), e o
// desfecho do diálogo. `sim` = confirmar, `nao` = cancelar.
async function abrirGaveta(pg) {
  if (await pg.evaluate(() => document.getElementById('cronoGaveta').classList.contains('aberta'))) return;
  await pg.evaluate(() => document.getElementById('cronoTitulo').click());
  await esperar(pg, () => document.getElementById('cronoGaveta').classList.contains('aberta'));
}
const excluirDoUnico = (pg) => pg.evaluate(() => {
  const b = document.querySelector('#cronoLista .crono-item .crono-excluir');
  return { dis: b.disabled, title: b.title, aria: b.getAttribute('aria-label'), linhas: document.querySelectorAll('#cronoLista .crono-item').length };
});
async function tocarE(pg, sim) {
  await abrirGaveta(pg);
  await pg.evaluate(() => { document.querySelector('#cronoLista .crono-item .crono-excluir').click(); });
  const abriu = await esperar(pg, () => {
    const bd = document.querySelector('.dialog-backdrop');
    return !!bd && bd.classList.contains('open');
  });
  const d = await pg.evaluate(() => ({
    titulo: ((document.getElementById('appDialogTitle') || {}).textContent || '').trim(),
    msg: ((document.getElementById('appDialogMsg') || {}).textContent || '').trim(),
    ok: ((document.getElementById('appDialogOk') || {}).textContent || '').trim(),
    // `perigo` troca o azul primário pelo par destrutivo — é a classe que diz
    // "isto APAGA", e medi-la é medir que o diálogo se anuncia como destrutivo.
    perigoso: !!(document.getElementById('appDialogOk') || {}).classList
      && document.getElementById('appDialogOk').classList.contains('perigo'),
  }));
  await pg.evaluate((simm) => {
    document.getElementById(simm ? 'appDialogOk' : 'appDialogCancel').click();
  }, sim);
  await pg.waitForTimeout(500);
  return { abriu, d };
}

const conta = (pg) => pg.evaluate(async () => (await AVDB.listIds('imports')).length);

try {
  // =========================================================================
  // A · O LIMPAR SAIU DA BARRA; O IMPORTAR MORA LÁ — e ele é SÓ o ícone
  // =========================================================================
  {
    const a = await abrir('dark', 6);
    const r = await a.pg.evaluate(() => {
      const b = document.getElementById('cronoImportar');
      const cs = b && getComputedStyle(b);
      const h = document.querySelector('.list-header').getBoundingClientRect();
      const t = document.getElementById('cronoTitulo').getBoundingClientRect();
      const svg = b && b.querySelector('svg');
      return {
        limpar: !!document.getElementById('cronoLimpar') || !!document.querySelector('.crono-limpar'),
        simboloVelho: !!document.getElementById('icoLimparLista'),
        // A PORTA "IMPORTAR" DO RODAPÉ saiu junto: lá sobram duas.
        portaVelha: !!document.querySelector('#listFoot .import-btn'),
        existe: !!b,
        // SÓ O ÍCONE: um filho, e ele é o `<svg>` — a regra da faixa, em que o
        // voltar e a engrenagem também são ícone solto.
        filhos: b ? [...b.children].map((c) => c.tagName.toLowerCase()) : [],
        texto: b ? (b.textContent || '').trim() : null,
        rotulo: b ? b.getAttribute('aria-label') : null,
        // SEM CORPO: `background: none` computa para `rgba(0, 0, 0, 0)`.
        fundo: cs && cs.backgroundColor,
        // NA TRILHA 1: encostado à esquerda, antes do título.
        esq: b ? +(b.getBoundingClientRect().left - h.left).toFixed(1) : null,
        antes: b ? b.getBoundingClientRect().right <= t.left : false,
        // A CAIXA é a mesma da engrenagem em frente — o `--hit` da barra.
        cx: b ? +b.getBoundingClientRect().width.toFixed(1) : null,
        cy: b ? +b.getBoundingClientRect().height.toFixed(1) : null,
        gear: +document.getElementById('settingsBtn').getBoundingClientRect().width.toFixed(1),
        // O DESENHO SEGUE `--icon-lg` por REGRA PRÓPRIA, e não o atributo do HTML
        // — a armadilha muda da v1.8.68. A régua é FORÇAR o token: hoje os dois
        // valem 24, e "mede 24px" passaria por acidente sem a regra.
        svgCx: (() => {
          if (!svg) return null;
          const de = document.documentElement;
          de.style.setProperty('--icon-lg', '30px');
          const w = +svg.getBoundingClientRect().width.toFixed(1);
          de.style.removeProperty('--icon-lg');
          return w;
        })(),
        lg: 30,
      };
    });
    checar(!r.limpar && !r.simboloVelho && !r.portaVelha,
      'A · o LIMPAR saiu da barra (com o desenho da lixeira-com-lista), e a porta '
      + '"Importar" saiu do rodapé (v1.13.5)', JSON.stringify(r));
    checar(r.existe && r.esq < 24 && r.antes,
      'A · e o IMPORTAR mora na trilha 1 da barra, encostado à ESQUERDA, antes do título',
      JSON.stringify(r));
    checar(r.filhos.length === 1 && r.filhos[0] === 'svg' && r.texto === '' && /importar/i.test(r.rotulo || ''),
      'A · e é SÓ o ícone — nenhum rótulo à vista, e o nome acessível diz o que ele faz',
      JSON.stringify({ filhos: r.filhos, texto: r.texto, rotulo: r.rotulo }));
    checar(/,\s*0\)$/.test(r.fundo || ''),
      'A · e ele é CHAPADO, como a engrenagem: o fundo não pinta', r.fundo);
    checar(r.cx === r.gear && Math.abs(r.cx - r.cy) < 0.5,
      'A · e a caixa é a da engrenagem em frente (`--hit`, quadrada)', JSON.stringify(r));
    checar(r.svgCx === r.lg,
      'A · e o desenho SEGUE `--icon-lg` (forçado a 30px, mede ' + r.svgCx + 'px) — regra própria, o '
      + 'degrau a mais de um contorno esparso ao lado da engrenagem densa', JSON.stringify(r));
    // O TOQUE ABRE O SELETOR. No navegador, o `#file` (o Playwright vê o
    // `filechooser`); no app, o do sistema (`AVNative.pickDoc`) — aqui com uma
    // ponte de mentira que só registra a chamada.
    const [escolha] = await Promise.all([
      a.pg.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null),
      a.pg.click('#cronoImportar'),
    ]);
    checar(!!escolha && escolha.isMultiple(),
      'A · e o toque abre o seletor de arquivos do navegador (vários de uma vez)', String(!!escolha));
    const nativo = await a.pg.evaluate(async () => {
      const antes = [window.__NATIVE__, window.AVNative];
      let pediu = null;
      window.__NATIVE__ = true;
      window.AVNative = { pickDoc: async (mimes) => { pediu = mimes; return []; } };
      try { document.getElementById('cronoImportar').click(); await new Promise((f) => setTimeout(f, 50)); }
      finally { [window.__NATIVE__, window.AVNative] = antes; }
      return pediu;
    });
    checar(typeof nativo === 'string' && /application\/pdf/.test(nativo),
      'A · e, no app, o toque abre o seletor do SISTEMA (`AVNative.pickDoc`), o único que '
      + 'serve ao PDF', String(nativo));
    checar(a.erros.length === 0, 'A · nenhum erro de página', a.erros.join(' | '));
    await a.ctx.close();
  }

  // =========================================================================
  // B · O TÍTULO CONTINUA CENTRADO
  // =========================================================================
  //
  // As duas pontas da faixa medem `--hit` cheio (o importar e a engrenagem), e
  // esta é a asserção que prova que a troca não cobrou nada: o centro do título
  // contra o centro da FAIXA, e não contra a tela.
  {
    const a = await abrir('dark', 6);
    const r = await a.pg.evaluate(() => {
      const f = document.querySelector('.list-header').getBoundingClientRect();
      const t = document.getElementById('listTitle').getBoundingClientRect();
      return {
        desvio: +Math.abs((t.left + t.width / 2) - (f.left + f.width / 2)).toFixed(2),
        titulo: (document.getElementById('listTitle').textContent || '').trim(),
      };
    });
    // O TEXTO É `Cronograma`, e não `CRONOGRAMA`: a caixa alta da faixa é
    // `text-transform` no CSS, e o `textContent` devolve o que está no HTML.
    checar(r.desvio <= 1 && r.titulo === 'Cronograma',
      'B · o título continua no EIXO da faixa (desvio ' + r.desvio + 'px)', JSON.stringify(r));
    await a.ctx.close();
  }

  // =========================================================================
  // C · A TINTA DO IMPORTAR, MEDIDA NOS DOIS TEMAS
  // =========================================================================
  //
  // Lida do RENDERIZADO: ler o nome do token provaria que alguém escreveu
  // `--accent`, não que o ícone se vê — e a paleta tem cor que some num tema só
  // (`--on-accent` mede **1,00:1** no claro, branco sobre a barra branca).
  for (const tema of ['dark', 'light']) {
    const a = await abrir(tema, 6);
    const r = await a.pg.evaluate(() => {
      const b = document.getElementById('cronoImportar');
      return {
        tema: document.documentElement.dataset.tema || 'escuro',
        cor: getComputedStyle(b).color,
        gear: getComputedStyle(document.getElementById('settingsBtn')).color,
        barra: getComputedStyle(document.querySelector('.list-header')).backgroundColor,
      };
    });
    checar(r.tema === (tema === 'light' ? 'claro' : 'escuro'),
      'C · ' + tema + ': o app está NESTE tema', r.tema);
    const c = razao(r.cor, r.barra);
    checar(c >= 3 && r.cor === r.gear,
      'C · ' + tema + ': o ícone mede ' + c + ':1 contra a barra, acima do piso de 3:1, e '
      + 'veste a tinta da engrenagem em frente — as duas pontas são AÇÕES',
      JSON.stringify({ cor: r.cor, gear: r.gear, barra: r.barra, razao: c }));
    await a.ctx.close();
  }

  // =========================================================================
  // D · O EXCLUIR DO ÚNICO PERGUNTA LIMPAR, E O CANCELAR NÃO APAGA NADA
  // =========================================================================
  {
    const a = await abrir('dark', 6);
    const antes = await conta(a.pg);
    const { abriu, d } = await tocarE(a.pg, false);
    const depois = await conta(a.pg);
    checar(abriu === true && d.titulo === 'Limpar o cronograma',
      'D · o toque no Excluir do ÚNICO cronograma PERGUNTA, e a pergunta é LIMPAR — o '
      + 'que de fato acontece: a lista esvazia e o cronograma fica',
      porque(abriu) || JSON.stringify(d));
    checar(d.perigoso === true && d.ok === 'Limpar',
      'D · e o diálogo se anuncia DESTRUTIVO (`perigo`), com o verbo no botão — '
      + 'o azul primário diria que confirmar é a ação segura',
      JSON.stringify({ perigo: d.perigoso, ok: d.ok }));
    // A MENSAGEM CARREGA A CONTA (a lista pode estar rolada) e DIZ QUE O
    // CRONOGRAMA FICA — o toque foi num "Excluir", e sem a frase quem confirma
    // não sabe se o nome some junto. As explicações sobre os Favoritos e a cena
    // continuar tocando saíram a pedido (v1.8.67), e a ausência é afirmada.
    checar(/6 itens/.test(d.msg) && /único/.test(d.msg) && /fica vazio/.test(d.msg),
      'D · e ela diz QUANTOS saem e que o cronograma, o único, FICA vazio', d.msg);
    checar(!/Favorito|no ar|playlist/i.test(d.msg) && d.msg.length < 100,
      'D · e ela NÃO explica mais nada: as frases sobre os Favoritos e sobre a '
      + 'cena continuar tocando saíram a pedido', JSON.stringify({ msg: d.msg, n: d.msg.length }));
    // O VERBO DO DIÁLOGO É "LIMPAR" (v1.8.67): EXCLUIR é o que se faz a um item,
    // LIMPAR é o que se faz a uma lista. E o `title` do botão que abriu diz o
    // mesmo — ele mora na coluna do excluir, mas o que faz ali é limpar.
    const botao = await excluirDoUnico(a.pg);
    checar(!/exclu/i.test(d.titulo + ' ' + d.ok + ' ' + d.msg) && /limpar/i.test(botao.title),
      'D · e o verbo é LIMPAR no título, no confirmar e no `title` do botão',
      JSON.stringify({ titulo: d.titulo, ok: d.ok, botao: botao.title }));
    checar(antes === 6 && depois === 6 && botao.linhas === 1,
      'D · e CANCELAR não apaga nada. Sem esta metade, um diálogo que sempre '
      + 'confirma passaria na asserção de cima', JSON.stringify({ antes, depois, linhas: botao.linhas }));
    checar(a.erros.length === 0, 'D · nenhum erro de página', a.erros.join(' | '));
    await a.ctx.close();
  }

  // =========================================================================
  // E · CONFIRMAR ESVAZIA, O CRONOGRAMA FICA — E A CENA NO AR CONTINUA
  // =========================================================================
  //
  // As metades no MESMO cenário, porque é a combinação que o defeito produz:
  // limpar com o louvor no ar. A regra da v1.3.13 — *"excluir de uma lista não
  // tira do ar"* — vale para o ACERVO, e o Cronograma é acervo.
  {
    const a = await abrir('dark', 6);
    await a.pg.evaluate(async () => {
      const z = (ms) => new Promise((f) => setTimeout(f, ms));
      const it = (await AVDB.listItems('imports'))[0];
      await send(it.id); await z(600);
    });
    const noAr = await a.pg.evaluate(() => ({
      id: typeof currentId !== 'undefined' ? currentId : null,
    }));
    const { d } = await tocarE(a.pg, true);
    const r = await a.pg.evaluate(async () => ({
      lista: (await AVDB.listIds('imports')).length,
      cronos: (await AVDB.cronoLer()).itens.length,
      titulo: document.getElementById('listTitle').textContent,
      cena: typeof currentId !== 'undefined' ? currentId : null,
      registro: !!(typeof currentId !== 'undefined' && currentId
        ? await AVDB.getMedia(currentId) : null),
      vazia: !!document.querySelector('#library .empty'),
      gaveta: !document.getElementById('cronoGaveta').hidden,
    }));
    checar(r.lista === 0 && r.vazia && r.cronos === 1 && r.titulo === 'Cronograma',
      'E · confirmar ESVAZIA a lista e o cronograma FICA, com o nome — o app nunca fica '
      + 'sem cronograma', JSON.stringify({ ...r, dialogo: d.titulo }));
    checar(!!noAr.id && r.cena === noAr.id && r.registro,
      'E · e a cena NO AR continua: o id não muda e o REGISTRO dele sobrevive à '
      + 'coleta — um `retirarDoAr` aqui é uma interrupção de culto',
      JSON.stringify({ antes: noAr.id, depois: r.cena, registro: r.registro }));
    const depois = await excluirDoUnico(a.pg);
    checar(r.gaveta && depois.dis === true && /vazio/i.test(depois.title),
      'E · e a gaveta FICA aberta, redesenhada: o Excluir do único, agora vazio, apaga',
      JSON.stringify({ gaveta: r.gaveta, depois }));
    checar(a.erros.length === 0, 'E · nenhum erro de página', a.erros.join(' | '));
    await a.ctx.close();
  }

  // =========================================================================
  // F · COM O ÚNICO VAZIO ELE É APAGADO, E DIZ POR QUÊ
  // =========================================================================
  //
  // As DUAS pontas medidas — vazio e cheio —, porque um botão sempre `disabled`
  // e um nunca `disabled` passam em metades opostas. E o `aria-label`
  // ACOMPANHA o `title`: o nome acessível vem dele, que VENCE o `title`.
  {
    const a = await abrir('dark', 0);
    await abrirGaveta(a.pg);
    const vazio = await excluirDoUnico(a.pg);
    checar(vazio.dis === true && /vazio/i.test(vazio.title) && vazio.aria === vazio.title,
      'F · com o único cronograma vazio o Excluir é APAGADO, e o `title` e o '
      + '`aria-label` dizem por quê — aceso e inerte, ele ensinaria que tocá-lo é inofensivo',
      JSON.stringify(vazio));
    const cheio = await a.pg.evaluate(async () => {
      const z = (ms) => new Promise((f) => setTimeout(f, ms));
      await AVDB.addMedia(new Blob(['x'], { type: 'audio/mpeg' }),
        { name: 'Um', type: 'audio/mpeg', kind: 'audio', list: 'imports' });
      await load(); await z(400);
      const b = document.querySelector('#cronoLista .crono-item .crono-excluir');
      return { dis: b.disabled, title: b.title, aria: b.getAttribute('aria-label') };
    });
    checar(cheio.dis === false && !/vazio/i.test(cheio.title) && /limpar/i.test(cheio.title)
      && cheio.aria === cheio.title,
      'F · e com UM item ele volta a acender, com o `title` da ação — sem esta metade, '
      + 'um botão apagado para sempre passaria na de cima', JSON.stringify(cheio));
    await a.ctx.close();
  }

  // =========================================================================
  // H · O IMPORTAR RESPONDE AO TOQUE
  // =========================================================================
  //
  // A regra do bloco de guardas: *"Bloco novo que hospede controles entra na
  // lista de guardas no MESMO lote em que nasce"*, e a recíproca vale para o
  // controle. REVERSÃO: tirar `.crono-importar` do `:is(...)` do `--press`
  // reprova aqui.
  {
    const a = await abrir('dark', 0);
    const r = await a.pg.evaluate(() => {
      const b = document.getElementById('cronoImportar');
      const g = document.getElementById('settingsBtn') || document.querySelector('.settings-btn');
      const dePress = (el) => {
        // a regra do `--press` é `:active`; sem pseudo-classe em JS, mede-se a
        // DECLARAÇÃO: o seletor tem de alcançar o elemento.
        for (const folha of document.styleSheets) {
          let regras; try { regras = folha.cssRules; } catch (_) { continue; }
          for (const reg of regras) {
            if (!reg.selectorText || !/:active/.test(reg.selectorText)) continue;
            if (!/var\(--press\)/.test(reg.style.transform || '')) continue;
            const sem = reg.selectorText.replace(/:active/g, '');
            try { if (el.matches(sem)) return true; } catch (_) {}
          }
        }
        return false;
      };
      return { botao: dePress(b), vizinha: g ? dePress(g) : null };
    });
    checar(r.vizinha === true,
      'H · PREMISSA: a engrenagem da mesma faixa está na lista do `--press` — '
      + 'sem ela a metade de baixo mediria a ausência da lista inteira', r);
    checar(r.botao === true,
      'H · e o importar também: um botão de barra que não afunda ao toque é '
      + 'indistinguível de um quebrado', r);
    await a.ctx.close();
  }

  // G · O CRONOGRAMA VAZIO É UMA MARCA-D'ÁGUA (v1.8.67)
  // =========================================================================
  //
  // Pedido do operador: *"um texto maior, em negrito, centralizado na tela, mas
  // com uma cor com menos contraste do que a atual, para ficar mais mesclado a
  // cor do fundo e se destacar menos"*. São QUATRO metades e cada uma quebra
  // sozinha, então cada uma tem asserção.
  //
  // O CONTRASTE É MEDIDO DO RENDERIZADO, e a régua é INVERTIDA: aqui se exige
  // que ele fique ABAIXO de um teto, não acima de um piso. É o único lugar deste
  // repositório em que isso acontece, e a razão está no CSS — a frase descreve
  // uma ausência que já está à vista, e não carrega informação que se perca.
  // Sem o teto, "menos contraste" é uma opinião; com ele, é um número.
  {
    const a = await abrir('dark', 0);
    const g = await a.pg.evaluate(() => {
      const e = document.querySelector('#library > .empty');
      if (!e) return null;
      const lista = document.getElementById('library').getBoundingClientRect();
      // A RÉGUA É O TEXTO, NUNCA A CAIXA DELE. O `<li>` carrega `flex: 1` e come
      // a altura que sobra do scroller nos DOIS casos — com e sem o
      // `place-content` —, então o `getBoundingClientRect()` dele devolve o mesmo
      // retângulo e a asserção passa nas duas versões. MEDIDO por reversão: ela
      // era TAUTOLOGIA. O que se move é a LINHA de texto dentro da caixa, e quem
      // a alcança é um `Range` sobre o conteúdo — a mesma armadilha do
      // `scrollWidth` de um `<span>` na v1.8.65, onde o medido também não era
      // quem transbordava.
      const faixa = document.createRange();
      faixa.selectNodeContents(e);
      const r = faixa.getBoundingClientRect();
      const cs = getComputedStyle(e);
      const raiz = parseFloat(getComputedStyle(document.documentElement).fontSize);
      return {
        texto: (e.textContent || '').trim(),
        peso: cs.fontWeight,
        // O TAMANHO em `rem`, e não em px: o px varia com a fonte do sistema, e
        // o que a asserção guarda é o DEGRAU contra o corpo da lista.
        fs: +(parseFloat(cs.fontSize) / raiz).toFixed(2),
        opacidade: +cs.opacity,
        cor: cs.color,
        fundo: getComputedStyle(document.body).backgroundColor,
        // CENTRADA NOS DOIS EIXOS: os centros da LINHA contra os da lista.
        dx: +Math.abs((r.left + r.width / 2) - (lista.left + lista.width / 2)).toFixed(1),
        dy: +Math.abs((r.top + r.height / 2) - (lista.top + lista.height / 2)).toFixed(1),
        alturaLista: +lista.height.toFixed(1),
      };
    });
    checar(!!g && /vazio/i.test(g.texto),
      'G · com a lista vazia o Cronograma diz que está vazio', g && g.texto);
    checar(g.fs >= 1.1 && g.peso === '700',
      'G · e a frase é MAIOR e em NEGRITO — ' + g.fs + 'rem contra os 0,9rem da '
      + '`.empty` comum, que serve a caixas pequenas noutras listas',
      JSON.stringify({ fs: g.fs, peso: g.peso }));
    // O TETO VERTICAL É 6px, E O RESTO TEM NOME: o item é centrado no CONTENT
    // box, e o `#library` carrega `padding-top: --sp-5` (o vão sob a barra) com
    // `padding-bottom: 0` — logo o centro do conteúdo fica metade disso abaixo
    // do centro da caixa. MEDIDO: **4,8px** em 577,4 de altura, 0,8%. Zerar
    // exigiria o item ignorar o padding do próprio scroller, que é brigar com o
    // layout por um desvio invisível. O teto está acima do resto conhecido e
    // abaixo do defeito que ele veio pegar: sem a exclusão da folga do rodapé,
    // este mesmo número era **28,6px**.
    checar(g.dx <= 2 && g.dy <= 6 && g.alturaLista > 200,
      'G · e ela está centrada NOS DOIS EIXOS da lista (dx ' + g.dx + ', dy '
      + g.dy + 'px — o resto é metade do vão sob a barra) — o vertical é o que '
      + '"centralizado na tela" pede, e ele só existe porque o item come a '
      + 'altura que sobra', JSON.stringify(g));
    // A COR COMPOSTA: a `opacity` mistura o traço com o fundo, então a razão tem
    // de ser calculada sobre a MISTURA — ler `color` cru devolveria o contraste
    // do token, que é justamente o que o pedido mandou baixar.
    const mist = rgb(g.cor).map((c, i) => Math.round(c * g.opacidade + rgb(g.fundo)[i] * (1 - g.opacidade)));
    const c = razao('rgb(' + mist.join(',') + ')', g.fundo);
    checar(c < 4.5 && c > 2,
      'G · e ela MESCLA com o fundo: ' + c + ':1, abaixo do piso de 4,5 de '
      + 'propósito (era 9,94:1) e ainda acima de 2, que é o chão em que ela '
      + 'deixaria de ser legível de relance', JSON.stringify({ razao: c, op: g.opacidade }));
    await a.ctx.close();
  }
} finally {
  await navegador.close();
  servidor.close();
}

console.log(falhas.length ? '\n' + falhas.length + ' falha(s).' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
