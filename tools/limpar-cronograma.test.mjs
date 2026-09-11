// ============================================================================
// LIMPAR O CRONOGRAMA — o botão que substituiu a badge de versão (v1.8.66)
// ============================================================================
//
// Pedido do operador, verbatim: *"substitua o badge de versão que temos na barra
// do topo do cronograma, a esquerda, por um icone/botão de excluir lista (ele
// limpa a lista do cronograma). use um icone de lixeira com list… use o icone na
// cor vermelha e não precisa de corpo para o botão, apenas o icone, que é o
// padrão dessa top bar"*.
//
// ---------- OS CINCO DEFEITOS QUE ESTE ARQUIVO EXISTE PARA IMPEDIR ----------
// Nenhum deles aparece numa captura de tela, e três deixam o botão TOCÁVEL — a
// forma cara de quebrar, porque quem toca conclui que o app travou.
//
//  1. O VERMELHO ERRADO (bloco C). A paleta tem QUATRO vermelhos e o "óbvio" é o
//     que reprova: `--danger` é o scarlett OFICIAL da identidade e mede
//     **2,71:1** contra a barra no tema ESCURO — abaixo do piso de 3:1 para
//     ícone — e **5,67:1** no claro. Escolher pelo nome passa num tema e falha
//     no outro, e uma captura no tema errado não acusa. A régua é o CONTRASTE
//     MEDIDO nos dois, não o nome do token.
//  2. A CENA INTERROMPIDA (bloco E). Limpar o Cronograma com o louvor no ar NÃO
//     pode tirá-lo do telão — é a regra da v1.3.13 (*"excluir de uma lista não
//     tira do ar"*), e a FILA é a única exceção. O defeito é uma interrupção de
//     culto, e o caminho que o produz (um `retirarDoAr` a mais) é uma linha.
//  3. O APAGAR SEM PERGUNTAR (bloco D). O botão mora no canto superior ESQUERDO
//     — onde o polegar encosta ao pegar o celular — e apaga a lista inteira sem
//     desfazer. Um toque tem de abrir a pergunta, e CANCELAR tem de não apagar
//     nada: as duas metades, porque um diálogo que sempre confirma passa na
//     primeira e falha na segunda.
//  4. O BOTÃO ACESO SOBRE NADA (bloco F). Com a lista vazia ele fica `disabled`
//     com o `title` dizendo por quê — a regra da v1.8.50, que pesa o dobro num
//     destrutivo: um botão aceso que não faz nada ensina que tocá-lo é
//     inofensivo, e o dia em que ele voltar a ter o que apagar o operador já
//     aprendeu a tocá-lo sem ler.
//  5. O TÍTULO FORA DO EIXO (bloco B). A grade da faixa virou elástica na v1.7.0
//     POR CAUSA da badge (ela é texto de largura variável). Trocá-la por um
//     botão de caixa fixa pode deslocar o "CRONOGRAMA" do centro, e ninguém
//     relata 8px — mede-se.
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

// O toque, e o desfecho do diálogo. `sim` = confirmar, `nao` = cancelar.
async function tocarE(pg, sim) {
  await pg.evaluate(() => { document.getElementById('cronoLimpar').click(); });
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
  // A · A BADGE SAIU, O BOTÃO ENTROU — e ele é SÓ o ícone
  // =========================================================================
  {
    const a = await abrir('dark', 6);
    const r = await a.pg.evaluate(() => {
      const b = document.getElementById('cronoLimpar');
      const cs = b && getComputedStyle(b);
      return {
        existe: !!b,
        badge: !!document.getElementById('listVersion'),
        // SÓ O ÍCONE: um filho, e ele é o `<svg>`. Um rótulo aqui contraria o
        // pedido (*"não precisa de corpo para o botão, apenas o icone"*) e a
        // regra da faixa, em que o voltar e a engrenagem também são ícone solto.
        filhos: b ? [...b.children].map((c) => c.tagName.toLowerCase()) : [],
        texto: b ? (b.textContent || '').trim() : null,
        // SEM CORPO: o fundo não pinta. `background: none` computa para
        // `rgba(0, 0, 0, 0)`, como no `#backBtn`.
        fundo: cs && cs.backgroundColor,
        // O DESENHO é o da lixeira-com-lista, e não a lixeira sozinha que o
        // EXCLUIR da seleção e o LIMPAR da fila usam.
        simbolo: b && b.querySelector('use') ? b.querySelector('use').getAttribute('href') : null,
        // A CAIXA é a mesma da engrenagem em frente — o `--hit` da barra.
        cx: b ? +b.getBoundingClientRect().width.toFixed(1) : null,
        cy: b ? +b.getBoundingClientRect().height.toFixed(1) : null,
        gear: +document.getElementById('settingsBtn').getBoundingClientRect().width.toFixed(1),
        // A PROPORÇÃO DO DESENHO — a caixa da LIXEIRA (a tampa mais o corpo que
        // afunila: os três primeiros `<path>`) contra a dos TRAÇOS.
        //
        // MEDIDA NUM CLONE RENDERIZADO, e não no `<symbol>`: um `<symbol>` nunca
        // é desenhado, e o `getBBox()` de um filho dele devolve **zeros** no
        // Chromium — MEDIDO, `{l:0,a:0}` para os dois desenhos, o certo e o
        // errado, o que faria qualquer asserção daqui passar sempre. O clone tem
        // o MESMO path data nas MESMAS unidades de usuário, então a conta é a do
        // desenho de verdade.
        lixeira: (() => {
          const sym = document.getElementById('icoLimparLista');
          if (!sym) return null;
          const NS = 'http://www.w3.org/2000/svg';
          const sv = document.createElementNS(NS, 'svg');
          sv.setAttribute('viewBox', '0 0 24 24');
          sv.setAttribute('width', '240'); sv.setAttribute('height', '240');
          sv.style.cssText = 'position:fixed;left:-9999px;top:0;fill:none;stroke:#000';
          for (const c of sym.children) sv.appendChild(c.cloneNode(true));
          document.body.appendChild(sv);
          const ps = [...sv.querySelectorAll('path')];
          if (ps.length < 6) { sv.remove(); return null; }
          const une = (as) => {
            const bs = as.map((n) => ps[n].getBBox());
            return {
              x: Math.min(...bs.map((b) => b.x)), y: Math.min(...bs.map((b) => b.y)),
              r: Math.max(...bs.map((b) => b.x + b.width)),
              d: Math.max(...bs.map((b) => b.y + b.height)),
            };
          };
          const c = une([0, 1, 2]), t = une([3, 4, 5]);
          sv.remove();
          // `getBBox` responde nas unidades de USUÁRIO — as do `viewBox`, 0..24 —,
          // e não nos pixels em que o clone foi desenhado.
          return {
            l: +(c.r - c.x).toFixed(2), a: +(c.d - c.y).toFixed(2),
            razao: +((c.d - c.y) / (c.r - c.x)).toFixed(2),
            vao: +(t.x - c.r).toFixed(2),
          };
        })(),
      };
    });
    checar(r.existe && !r.badge,
      'A · o botão de limpar ocupa a casa da badge de versão, e a badge não '
      + 'existe mais no cabeçalho — ela não se mudou, ela SAIU',
      JSON.stringify({ botao: r.existe, badge: r.badge }));
    checar(r.filhos.length === 1 && r.filhos[0] === 'svg' && r.texto === '',
      'A · e ele é SÓ o ícone: um filho, o `<svg>`, sem rótulo nenhum — o padrão '
      + 'da barra, em que o voltar e a engrenagem também são ícone solto',
      JSON.stringify({ filhos: r.filhos, texto: r.texto }));
    checar(/,\s*0\)$/.test(r.fundo || ''),
      'A · e SEM CORPO: o botão não pinta fundo. Um corpo aqui o faria a única '
      + 'peça com superfície numa barra de três ícones soltos', r.fundo);
    checar(r.simbolo === '#icoLimparLista',
      'A · e o desenho é a LIXEIRA COM LISTA, não a lixeira sozinha — é ela que '
      + 'distingue "apagar a lista inteira" do EXCLUIR de um item', r.simbolo);
    checar(r.cx === r.gear && Math.abs(r.cx - r.cy) < 0.5,
      'A · e a caixa é a MESMA da engrenagem em frente, e quadrada: as duas '
      + 'pontas da barra medem `--hit`', JSON.stringify(r));
    // E O DESENHO NÃO É ESPREMIDO (v1.8.67). O relato foi *"o icone parece
    // espremido horizontalmente"*, e o defeito não estava na caixa do botão —
    // que já era quadrada, e cuja asserção acima passava — e sim na LIXEIRA
    // dentro dela, achatada no terço esquerdo para sobrar espaço aos traços.
    //
    // A RÉGUA É A RAZÃO, e o teto vem de fora: o `trash-2` do Feather, na MESMA
    // região (tampa + alça + corpo), mede 18 × 20 num viewBox de 24 — **1:1,11**.
    // MEDIDO aqui: **1:1,81** no desenho que o operador viu (8,5 × 15,35) contra
    // **1:1,19** no corrigido (11,6 × 13,75). O teto de 1,4 fica acima de toda
    // lixeira que afunila e abaixo do que se lê como uma lixeira ACHATADA — o
    // olho conhece a forma e atribui a diferença ao desenho, não ao objeto.
    checar(r.lixeira && r.lixeira.razao <= 1.4,
      'A · e a lixeira não é ESPREMIDA: ' + (r.lixeira && r.lixeira.razao)
      + ' de altura por largura, contra o 1,11 do `trash-2` do Feather e o 1,81 '
      + 'do desenho que o operador viu', JSON.stringify(r.lixeira));
    // E O VÃO ENTRE AS DUAS METADES SOBREVIVE À REPARTIÇÃO: alargar a lixeira
    // contra os traços é o modo óbvio de consertar a razão acima, e ele empasta
    // o ícone — a 20px o desenho inteiro tem 1,67px de traço, e um vão menor que
    // a própria linha não se lê como vão.
    checar(r.lixeira && r.lixeira.vao >= 1.5,
      'A · e sobra VÃO entre a lixeira e os traços (' + (r.lixeira && r.lixeira.vao)
      + ' unidades) — alargar a lixeira até encostar neles conserta a razão e '
      + 'empasta o desenho', JSON.stringify(r.lixeira));
    await a.ctx.close();
  }

  // =========================================================================
  // B · O TÍTULO CONTINUA CENTRADO
  // =========================================================================
  //
  // A grade da faixa virou `minmax(--hit, 1fr)` nas duas pontas na v1.7.0 POR
  // CAUSA da badge — texto de largura variável tirava o "CRONOGRAMA" do eixo. O
  // morador novo mede `--hit` cheio, e esta é a asserção que prova que a troca
  // não cobrou nada: o centro do título contra o centro da FAIXA, e não contra
  // a tela (a barra tem margem negativa e vai de 0 a w, mas medir a tela
  // aprovaria uma faixa deslocada).
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
      'B · o título continua no EIXO da faixa (desvio ' + r.desvio + 'px) — a '
      + 'grade elástica nasceu para segurar isso contra uma badge de texto, e '
      + 'o botão de caixa fixa não a desequilibra', JSON.stringify(r));
    await a.ctx.close();
  }

  // =========================================================================
  // C · O VERMELHO, MEDIDO NOS DOIS TEMAS
  // =========================================================================
  //
  // A régua é o CONTRASTE do traço contra a barra em que ele pousa, lido do
  // RENDERIZADO. Ler o nome do token provaria que alguém escreveu
  // `--danger-strong`, não que o ícone se vê: o `--danger` (o scarlett oficial)
  // também "é vermelho" e mede 2,71:1 no escuro.
  for (const tema of ['dark', 'light']) {
    const a = await abrir(tema, 6);
    const r = await a.pg.evaluate(() => {
      const b = document.getElementById('cronoLimpar');
      return {
        tema: document.documentElement.dataset.tema || 'escuro',
        cor: getComputedStyle(b).color,
        barra: getComputedStyle(document.querySelector('.list-header')).backgroundColor,
      };
    });
    checar(r.tema === (tema === 'light' ? 'claro' : 'escuro'),
      'C · ' + tema + ': o app está NESTE tema — a chave `av.tema` é o que o '
      + 'carrega, e o `colorScheme` do aparelho sozinho já não chega ao '
      + 'documento', r.tema);
    const c = razao(r.cor, r.barra);
    checar(c >= 3,
      'C · ' + tema + ': o ícone mede ' + c + ':1 contra a barra, acima do piso '
      + 'de 3:1. O scarlett oficial (`--live`) mede 2,71:1 no escuro — o '
      + 'vermelho certo é o CLAREADO, e a régua é o número, não o nome',
      JSON.stringify({ cor: r.cor, barra: r.barra, razao: c }));
    // E ELE É VERMELHO DE VERDADE, não o `--accent` dos vizinhos: o canal
    // vermelho domina. Sem esta metade, um ícone azul com contraste de sobra
    // passaria na asserção acima.
    const [rr, gg, bb] = rgb(r.cor);
    checar(rr > gg + 30 && rr > bb + 30,
      'C · ' + tema + ': e ele é VERMELHO — o canal r domina os outros dois. Sem '
      + 'isto, o `--accent` azul dos vizinhos passaria no contraste e o botão '
      + 'deixaria de se anunciar como destrutivo', JSON.stringify(rgb(r.cor)));
    await a.ctx.close();
  }

  // =========================================================================
  // D · O TOQUE PERGUNTA, E O CANCELAR NÃO APAGA NADA
  // =========================================================================
  {
    const a = await abrir('dark', 6);
    const antes = await conta(a.pg);
    const { abriu, d } = await tocarE(a.pg, false);
    const depois = await conta(a.pg);
    checar(abriu === true && d.titulo === 'Limpar o Cronograma',
      'D · o toque PERGUNTA antes de apagar — o botão mora no canto onde o '
      + 'polegar encosta, e a lista não tem desfazer',
      porque(abriu) || JSON.stringify(d));
    checar(d.perigoso === true && d.ok === 'Limpar',
      'D · e o diálogo se anuncia DESTRUTIVO (`perigo`), com o verbo no botão — '
      + 'o azul primário diria que confirmar é a ação segura',
      JSON.stringify({ perigo: d.perigoso, ok: d.ok }));
    // A MENSAGEM CARREGA A CONTA, e é por isto que aqui é modal e não a
    // pergunta-na-linha da fila: a `dica` daquela vai para o `title`, e num
    // WebView não há hover — o número nunca apareceria. A CONTA é a única metade
    // que quem lê não tem como saber olhando a tela, porque a lista pode estar
    // rolada.
    //
    // E AS EXPLICAÇÕES SAÍRAM na v1.8.67 (*"pode remover as explicações sobre os
    // itens ainda ficarem em favoritos e sobre continuar tocando"*). A ausência
    // delas é AFIRMADA, e não só deixada de medir: sem isso, alguém que as
    // reintroduzisse por zelo passaria no oráculo — e o pedido era por menos
    // texto, que é uma decisão que se desfaz sozinha se ninguém a guardar. As
    // duas promessas continuam valendo no CÓDIGO, e quem as trava são os blocos
    // D (cancelar não apaga) e E (a cena continua).
    checar(/6 itens/.test(d.msg),
      'D · e ela diz QUANTOS saem — a pergunta-na-linha esconderia o número num '
      + '`title`, que num WebView nunca aparece, e a lista pode estar rolada',
      d.msg);
    checar(!/Favorito|no ar|playlist/i.test(d.msg) && d.msg.length < 60,
      'D · e ela NÃO explica mais nada: as frases sobre os Favoritos e sobre a '
      + 'cena continuar tocando saíram a pedido, e a ausência é afirmada para '
      + 'que zelo não as traga de volta', JSON.stringify({ msg: d.msg, n: d.msg.length }));
    // O VERBO É "LIMPAR" EM TODA PARTE (v1.8.67): *"foque em chamar apenas de
    // 'limpar cronograma'… ao invés da palavra 'excluir'"*. A distinção é real —
    // EXCLUIR é o que se faz a um item, LIMPAR é o que se faz a uma lista —, e
    // a asserção varre os TRÊS lugares onde a palavra apareceria: o título, o
    // botão que confirma e o `title`/`aria-label` do botão que abriu.
    const verbos = await a.pg.evaluate(() => {
      const b = document.getElementById('cronoLimpar');
      return [b.title, b.getAttribute('aria-label')].join(' | ');
    });
    checar(!/exclu/i.test(d.titulo + ' ' + d.ok + ' ' + d.msg + ' ' + verbos)
      && /limpar/i.test(d.titulo) && /limpar/i.test(d.ok) && /limpar/i.test(verbos),
      'D · e o verbo é LIMPAR no título, no confirmar e no próprio botão — nunca '
      + 'EXCLUIR, que é o que se faz a um ITEM e prometeria que os arquivos morrem',
      JSON.stringify({ titulo: d.titulo, ok: d.ok, verbos }));
    checar(antes === 6 && depois === 6,
      'D · e CANCELAR não apaga nada. Sem esta metade, um diálogo que sempre '
      + 'confirma passaria na asserção de cima',
      JSON.stringify({ antes, depois }));
    checar(a.erros.length === 0, 'D · nenhum erro de página', a.erros.join(' | '));
    await a.ctx.close();
  }

  // =========================================================================
  // E · CONFIRMAR ESVAZIA — E A CENA NO AR CONTINUA
  // =========================================================================
  //
  // As duas metades no MESMO cenário, porque é a combinação que o defeito
  // produz: limpar com o louvor no ar. A regra da v1.3.13 — *"excluir de uma
  // lista não tira do ar"* — vale para o ACERVO, e o Cronograma é acervo; a FILA
  // é a única lista que o transporte governa.
  {
    const a = await abrir('dark', 6);
    // Põe o primeiro item no ar e espera a cena assentar.
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
      // A CENA sobreviveu? o id continua o mesmo, e o REGISTRO dele ainda existe
      // — a cena é detentora (`state.current.mediaId`, em `lerDetentores`), e é
      // isso que impede a coleta de apagar os bytes de baixo da projeção.
      cena: typeof currentId !== 'undefined' ? currentId : null,
      registro: !!(typeof currentId !== 'undefined' && currentId
        ? await AVDB.getMedia(currentId) : null),
      vazia: !!document.querySelector('#library .empty'),
    }));
    checar(r.lista === 0 && r.vazia,
      'E · confirmar ESVAZIA a lista, e o Cronograma passa a dizer que está vazio',
      JSON.stringify({ lista: r.lista, vazia: r.vazia, dialogo: d.titulo }));
    checar(!!noAr.id && r.cena === noAr.id && r.registro,
      'E · e a cena NO AR continua: o id não muda e o REGISTRO dele sobrevive à '
      + 'coleta. É a regra da v1.3.13 (*"excluir de uma lista não tira do ar"*) '
      + '— um `retirarDoAr` aqui é uma interrupção de culto',
      JSON.stringify({ antes: noAr.id, depois: r.cena, registro: r.registro }));
    checar(a.erros.length === 0, 'E · nenhum erro de página', a.erros.join(' | '));
    await a.ctx.close();
  }

  // =========================================================================
  // F · COM A LISTA VAZIA ELE É APAGADO, E DIZ POR QUÊ
  // =========================================================================
  //
  // As DUAS pontas medidas — vazio e cheio —, porque um botão sempre `disabled`
  // e um nunca `disabled` passam em metades opostas.
  {
    const a = await abrir('dark', 0);
    const vazio = await a.pg.evaluate(() => {
      const b = document.getElementById('cronoLimpar');
      return { dis: b.disabled, title: b.title, op: getComputedStyle(b).opacity };
    });
    checar(vazio.dis === true && /vazio/i.test(vazio.title) && +vazio.op < 0.9,
      'F · com a lista vazia o botão é APAGADO e o `title` diz por quê — a regra '
      + 'da v1.8.50 pesa o dobro num destrutivo: aceso e inerte, ele ensina que '
      + 'tocá-lo é inofensivo', JSON.stringify(vazio));
    const cheio = await a.pg.evaluate(async () => {
      const z = (ms) => new Promise((f) => setTimeout(f, ms));
      await AVDB.addMedia(new Blob(['x'], { type: 'audio/mpeg' }),
        { name: 'Um', type: 'audio/mpeg', kind: 'audio', list: 'imports' });
      await load(); await z(400);
      const b = document.getElementById('cronoLimpar');
      return { dis: b.disabled, title: b.title, op: getComputedStyle(b).opacity };
    });
    checar(cheio.dis === false && !/vazio/i.test(cheio.title) && +cheio.op > 0.9,
      'F · e com UM item ele volta a acender, com o `title` da ação — sem esta '
      + 'metade, um botão apagado para sempre passaria na de cima',
      JSON.stringify(cheio));
    await a.ctx.close();
  }

  // =========================================================================
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
