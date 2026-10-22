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
          const sw = parseFloat(document.querySelector('#cronoLimpar svg').getAttribute('stroke-width')) || 2;
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
            // O VÃO DE TINTA, e não o de linha de centro: `getBBox` devolve a
            // caixa da GEOMETRIA e IGNORA o traço, então o vão geométrico não
            // diz se os dois lados se TOCAM. MEDIDO: com o traço em 2,85 a
            // lixeira invade os traços em 0,65 unidade e o vão geométrico
            // continua marcando 2,2 — a asserção antiga passava VERDE sobre o
            // defeito que ela nomeia.
            vaoGeo: +(t.x - c.r).toFixed(2),
            vao: +((t.x - c.r) - sw).toFixed(2),
          };
        })(),
        // O TAMANHO RENDERIZADO do desenho, contra o da engrenagem. Não é a
        // caixa do BOTÃO (essa é a `cx`/`cy` acima, e ela já era igual): é o
        // `<svg>` dentro dele, que é onde os dois divergiam em silêncio.
        svgCx: +document.querySelector('#cronoLimpar svg').getBoundingClientRect().width.toFixed(1),
        svgGear: +document.querySelector('#settingsBtn svg').getBoundingClientRect().width.toFixed(1),
        // OS TRÊS DEGRAUS DECLARADOS da escala de ícone, lidos do `:root`. É
        // contra eles que o tamanho é conferido: um número escrito à mão
        // (26px, 26,4px) casaria com "maior que a engrenagem" e não é escala.
        degraus: ['--icon-sm', '--icon-md', '--icon-lg']
          .map((n) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(n))),
        traco: parseFloat(document.querySelector('#cronoLimpar svg').getAttribute('stroke-width')),
        tracoGear: parseFloat(document.querySelector('#settingsBtn svg').getAttribute('stroke-width')),
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
    // E O VÃO ENTRE AS DUAS METADES É DE TINTA (v1.8.68, corrigindo a régua da
    // v1.8.67). Alargar a lixeira contra os traços é o modo óbvio de consertar a
    // razão acima, e ele empasta o ícone — mas ENGROSSAR O TRAÇO faz o mesmo
    // estrago por outro caminho, e a régua antiga era CEGA a ele: `getBBox`
    // devolve a caixa da GEOMETRIA e ignora o traço, então o vão de linha de
    // centro não se move com a espessura. MEDIDO: com `stroke-width` 2,85 a
    // lixeira INVADE os traços em 0,65 unidade e o vão geométrico continua
    // marcando 2,2 — a asserção passava VERDE sobre o defeito que ela nomeia,
    // que é exatamente o que a regra da REVERSÃO deste repositório condena.
    //
    // E O PISO TINHA DE SUBIR DE CHÃO: 1,5 era MENOR que o próprio traço (2,0),
    // então toda a faixa [1,5; 2,0) passava já com tinta sobreposta. Em tinta,
    // o desenho da v1.8.67 tinha 0,2 unidade de folga — um décimo da linha. Hoje
    // são 0,6 (3,0 geométrico − 2,4 de traço), e o piso de 0,4 fica abaixo disso
    // e acima de zero, que é onde os dois lados se encostam.
    checar(r.lixeira && r.lixeira.vao >= 0.4,
      'A · e sobra VÃO DE TINTA entre a lixeira e os traços ('
      + (r.lixeira && r.lixeira.vao) + ' unidades, de um vão geométrico de '
      + (r.lixeira && r.lixeira.vaoGeo) + ' menos o traço) — encostar os dois '
      + 'empasta o desenho, e engrossar o traço encosta sem mover a geometria',
      JSON.stringify(r.lixeira));
    // E O DESENHO MEDE O MESMO QUE O DA ENGRENAGEM (v1.8.68). O relato foi *"o
    // icone da lixeira está muito pequeno visualmente, principalmente em
    // comparação com o volume e preenchimento visual do icone das
    // configurações"*, e a causa era MUDA: os dois botões têm a mesma CAIXA
    // (34px, e a asserção acima já provava isso), mas o `.crono-limpar` não
    // estava em NENHUMA das duas listas de escala de ícone do `controle.css`, e
    // o `<svg>` dele vivia do atributo `width="20"` do HTML enquanto a
    // engrenagem ao lado media 22. É a MESMA armadilha que a v1.5.19 consertou
    // nas três portas do rodapé — e a asserção mede o `<svg>`, não o botão,
    // porque é ali que a divergência mora.
    checar(r.svgCx > r.svgGear && r.degraus.includes(r.svgCx),
      'A · e o DESENHO é MAIOR que o da engrenagem (' + r.svgCx + ' contra '
      + r.svgGear + 'px) E é um DEGRAU DECLARADO da escala (' + r.degraus.join('/')
      + '): a caixa dos dois já era igual, e era o `<svg>` dentro dela que '
      + 'divergia em silêncio — e igualá-lo não bastava, porque uma lixeira é '
      + 'contorno esparso e a engrenagem é glifo denso (66,2 unidades de traço '
      + 'contra 107,3)', JSON.stringify({ limpar: r.svgCx, gear: r.svgGear, degraus: r.degraus }));
    // E O PESO VEM DO TAMANHO, NÃO DA ESPESSURA (v1.8.69). A v1.8.68 fechou o
    // mesmo vão engrossando o traço deste símbolo para 2,4, e o operador revogou
    // o eixo: *"a parte do traço da lixeira, desfaça. Eu queria ela maior e não
    // com traços mais grossos."* Os dois caminhos davam o MESMO número (0,90 e
    // 0,89 de tinta contra a engrenagem); o que os separa é que um degrau de
    // escala é declarado e uma espessura por símbolo é exceção de um consumidor
    // só. Sem esta asserção, o traço volta a engrossar no primeiro lote que
    // quiser mais peso e ninguém lembra por que ele não devia.
    checar(r.traco === r.tracoGear,
      'A · e o TRAÇO é o mesmo do resto do sprite (' + r.traco + ' contra '
      + r.tracoGear + ' da engrenagem): o peso deste ícone vem do DEGRAU de '
      + 'escala, não de uma espessura própria',
      JSON.stringify({ limpar: r.traco, gear: r.tracoGear }));
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
  // C · A TINTA NEUTRA, MEDIDA NOS DOIS TEMAS (v1.8.68)
  // =========================================================================
  //
  // São DUAS réguas, e as duas lidas do RENDERIZADO. Ler o nome do token
  // provaria que alguém escreveu `--muted`, não que o ícone se vê nem que ele é
  // neutro — e a paleta tem branco que some (`--on-accent` mede 13,0:1 no escuro
  // e **1,00:1** no claro, onde ele e a barra valem os dois `#fff`).
  //
  // O VERMELHO SAIU NA v1.8.68, a pedido do operador: *"troque o vermelho pelo
  // branco/cinza, uma cor neutra para esse icone. Vermelho está muito
  // chamativo."* O que o bloco afirmava antes era a escolha ENTRE vermelhos; o
  // que ele afirma agora é que a tinta é NEUTRA e continua acima do piso.
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
      + 'de 3:1 — e a régua é o número, não o nome: `--on-accent` é neutro, está '
      + 'declarado nos dois temas e mede 1,00:1 no claro, branco sobre branco',
      JSON.stringify({ cor: r.cor, barra: r.barra, razao: c }));
    // E ELE É NEUTRO, pela AMPLITUDE DE CROMA — não por um "não é vermelho".
    // A negação simples aprovaria o `--accent` AZUL dos vizinhos, que é o que a
    // metade original existia para barrar, e ali o azul significa NAVEGAÇÃO.
    // MEDIDO, `max(r,g,b) − min(r,g,b)` nos dois temas: `--muted` 16 e 16 ·
    // `--text` 9 e 0 · `--accent` 95 e 80 · `--danger-strong` 127 e 180.
    //
    // O TETO É 40, e a folga é dos DOIS lados de propósito: 24 (o primeiro
    // candidato) aprovaria a cor da PRÓPRIA BARRA, cuja amplitude é 23 — um
    // ícone invisível passaria na metade da neutralidade, e só o piso acima o
    // pegaria. 40 deixa 24 de margem sobre o `--muted` e 40 abaixo do `--accent`.
    const [rr, gg, bb] = rgb(r.cor);
    const croma = Math.max(rr, gg, bb) - Math.min(rr, gg, bb);
    checar(croma <= 40,
      'C · ' + tema + ': e ele é NEUTRO — amplitude de croma ' + croma + ', '
      + 'abaixo do teto de 40. Sem esta metade o vermelho de antes (127 · 180) e '
      + 'o `--accent` azul dos vizinhos (95 · 80) passariam no contraste',
      JSON.stringify({ rgb: [rr, gg, bb], croma }));
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
  //
  // E A RÉGUA DO APAGADO É O DESFECHO, NÃO O MECANISMO (v1.8.68). Até aqui este
  // bloco lia `getComputedStyle(b).opacity` e exigia `< 0.9` — e isso tem três
  // defeitos, os três medidos. (1) Ele trava o MEIO: um esmaecimento feito por
  // COR, com `opacity: 1`, REPROVAVA, isto é, a asserção bloqueava um conserto
  // correto em vez de um defeito. (2) Ele passa para qualquer alfa até 0,89,
  // num estado que a essa altura é indistinguível do aceso. (3) Ele nunca mediu
  // COR nem contraste, então aprovava igualmente o desenho de antes e o de
  // agora — a pergunta *"isso está coberto?"* respondida com um sim que não
  // cobria o que o operador reclamou.
  //
  // O QUE ELE MEDE AGORA é a tinta COMPOSTA contra a barra, nos DOIS temas (o
  // bloco rodava só no escuro, e a única piora possível desta troca mora no
  // CLARO). O piso de 2:1 é o que o desenho anterior violava: MEDIDO, dos 488
  // pixels de tinta do ícone apagado, ZERO cruzavam 2:1 no tema escuro contra
  // 262 no claro — o par de números "1,83 · 2,00" fazia os dois temas parecerem
  // vizinhos, e em tinta legível eles eram 0 contra 262. Apagado não é ausente:
  // a regra da v1.8.50 existe para o operador VER o que não responde e entender
  // por quê, e um traço que some não diz nada.
  for (const tema of ['dark', 'light']) {
    const a = await abrir(tema, 0);
    const vazio = await a.pg.evaluate(() => {
      const b = document.getElementById('cronoLimpar');
      const cs = getComputedStyle(b);
      return {
        dis: b.disabled, title: b.title, op: +cs.opacity, cor: cs.color,
        barra: getComputedStyle(document.querySelector('.list-header')).backgroundColor,
      };
    });
    checar(vazio.dis === true && /vazio/i.test(vazio.title),
      'F · ' + tema + ': com a lista vazia o botão é APAGADO e o `title` diz por '
      + 'quê — a regra da v1.8.50 pesa o dobro num destrutivo: aceso e inerte, '
      + 'ele ensina que tocá-lo é inofensivo', JSON.stringify(vazio));
    // A COMPOSTA: a `opacity` mistura o traço com a barra, então a razão tem de
    // ser calculada sobre a MISTURA — ler a `color` crua devolveria o contraste
    // do token, que é o do estado ACESO.
    const fundo = rgb(vazio.barra);
    const mist = rgb(vazio.cor).map((c, i) => c * vazio.op + fundo[i] * (1 - vazio.op));
    const cApagado = razao('rgb(' + mist.map(Math.round).join(',') + ')', vazio.barra);
    checar(cApagado > 2,
      'F · ' + tema + ': e o apagado ainda SE VÊ — ' + cApagado + ':1 composta '
      + 'contra a barra, acima do piso de 2:1. Abaixo dele não é indisponível, é '
      + 'ausente: o desenho anterior media 1,83:1 no escuro, com ZERO pixels de '
      + 'tinta cruzando 2:1', JSON.stringify({ cor: vazio.cor, op: vazio.op, razao: cApagado }));
    const cheio = await a.pg.evaluate(async () => {
      const z = (ms) => new Promise((f) => setTimeout(f, ms));
      await AVDB.addMedia(new Blob(['x'], { type: 'audio/mpeg' }),
        { name: 'Um', type: 'audio/mpeg', kind: 'audio', list: 'imports' });
      await load(); await z(400);
      const b = document.getElementById('cronoLimpar');
      const cs = getComputedStyle(b);
      return { dis: b.disabled, title: b.title, op: +cs.opacity, cor: cs.color };
    });
    checar(cheio.dis === false && !/vazio/i.test(cheio.title),
      'F · ' + tema + ': e com UM item ele volta a acender, com o `title` da '
      + 'ação — sem esta metade, um botão apagado para sempre passaria na de '
      + 'cima', JSON.stringify(cheio));
    // E A SEPARAÇÃO ENTRE OS ESTADOS É O OUTRO LADO DO MESMO PISO: sem ela, um
    // apagado que subisse até encostar no aceso passaria na asserção acima. O
    // teto de 2x é medido — hoje a separação é 2,6x no escuro e 3,0x no claro,
    // e o vermelho de antes dava 3,2x e 3,4x.
    const cAceso = razao(cheio.cor, vazio.barra);
    checar(cAceso / cApagado >= 2,
      'F · ' + tema + ': e o aceso é NITIDAMENTE mais forte — ' + cAceso + ':1 '
      + 'contra ' + cApagado + ':1, ' + (cAceso / cApagado).toFixed(2) + 'x. O '
      + 'piso de cima sozinho aprovaria um apagado encostado no aceso',
      JSON.stringify({ aceso: cAceso, apagado: cApagado }));
    await a.ctx.close();
  }

  // =========================================================================
  // H · ELE RESPONDE AO TOQUE, E O `aria-label` DIZ POR QUÊ (v1.8.85)
  // =========================================================================
  //
  // DUAS metades, as duas medidas na v1.8.84 como ausentes:
  //
  // (1) `.crono-limpar` ficou FORA da lista do `--press`, e era o único botão
  //     da barra do topo que não afundava nem acendia ao toque — ao lado da
  //     engrenagem, na MESMA faixa, a 34px de distância. A regra do projeto é a
  //     do bloco de guardas: *"Bloco novo que hospede controles entra na lista
  //     de guardas no MESMO lote em que nasce"*, e a recíproca vale para o
  //     controle. REVERSÃO: tirar `.crono-limpar` do `:is(...)` reprova aqui.
  //
  // (2) O `title` diz POR QUÊ o botão está apagado — a outra metade da regra da
  //     v1.8.50 —, mas o nome acessível vem do `aria-label`, que VENCE o
  //     `title`. Congelado no HTML, ele anunciava "Limpar o Cronograma,
  //     indisponível" e a razão não existia para quem usa leitor de tela.
  //     REVERSÃO: tirar o `setAttribute('aria-label', …)` do
  //     `renderCronoLimpar` reprova aqui.
  {
    const a = await abrir('dark', 0);
    const r = await a.pg.evaluate(() => {
      const b = document.getElementById('cronoLimpar');
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
      return {
        botao: dePress(b),
        vizinha: g ? dePress(g) : null,
        rotuloVazio: b.getAttribute('aria-label'),
        titleVazio: b.title,
      };
    });
    checar(r.vizinha === true,
      'H · PREMISSA: a engrenagem da mesma faixa está na lista do `--press` — '
      + 'sem ela a metade de baixo mediria a ausência da lista inteira', r);
    checar(r.botao === true,
      'H · e o limpar também: ele é o botão de uma barra de controles, e um '
      + 'que não afunda ao toque é indistinguível de um quebrado', r);
    checar(r.rotuloVazio === r.titleVazio && /vazio/i.test(r.rotuloVazio),
      'H · com a lista vazia o `aria-label` ACOMPANHA o `title` — o nome '
      + 'acessível vence o `title`, e congelado ele anunciava o botão sem '
      + 'nunca dizer por que está indisponível', r);
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
