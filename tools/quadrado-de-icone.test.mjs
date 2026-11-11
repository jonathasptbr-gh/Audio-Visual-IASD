// ============================================================================
// UM BOTÃO SEM RÓTULO É QUADRADO (v1.8.57)
// ============================================================================
//
// Relato do operador, verbatim: *"Verifique a altura dos botões nas janelas de
// confirmação, na janela da playlist automática e em diversas janelas do tipo,
// me parece que não há um padrão, principalmente quando é relativo a botões de
// adicionar ao cronograma ou adicionar aos favoritos, que normalmente devem ser
// quadrados, mas que por falta desse padrão de altura desses botões, estão
// saindo de diversas alturas..."*
//
// **A CAUSA É UMA SÓ, E NÃO ERA DECISÃO DE NINGUÉM: `align-items: stretch`.**
// Ele é o padrão do flex. Um botão de símbolo que declara só a LARGURA recebe a
// altura do IRMÃO, e o irmão de uma faixa de fecho é um botão de rótulo, que é
// mais alto. MEDIDO, os mesmos dois destinos (ao Cronograma e favoritar) saíam
// em TRÊS caixas: 42,4×53,2 na playlist automática, 42,4×42,4 no rodapé da fila
// e 42×36,6 na Bíblia — e o desvio da Bíblia MUDAVA com a tela.
//
// ---------- POR QUE A ASSERÇÃO NÃO É UMA LISTA DE SELETORES ----------
//
// Uma lista dos quatro que este lote consertou trava o passado e não o futuro:
// o quinto botão a nascer numa faixa de fecho estica igual, e a lista não sabe.
// Pior, é o modo de falhar que o `CLAUDE.md` nomeia em cinco lugares — *"é o
// NOME que segura a lista"* vale onde a lista É a regra, e aqui ela não é.
//
// A regra deriva do DOM: **um botão que não tem rótulo de texto é quadrado**.
// Quem decide não é um seletor curado, é o próprio botão — se ele tem texto, é
// um botão de rótulo e a largura é dele; se não tem, é um símbolo, e um símbolo
// numa caixa retangular está torto. Um botão novo entra na conta por existir.
//
// E O BLOCO B FECHA A PORTA DOS FUNDOS, na FONTE: nenhuma regra que dimensione
// um botão de ícone pode declarar `height: auto` ou `align-self: stretch` — é a
// mecânica exata dos quatro defeitos, e ela é greppável. Sem ele, um botão que
// o bloco A não alcança (uma folha que este oráculo não abre) volta a esticar
// sem nada acusar.

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperarCortina, checar, falhas } from './arnes.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port + '/controle/index.html';
const navegador = await abrirNavegador();

try {
  // ── A. NO APP RENDERIZADO ────────────────────────────────────────────────
  //
  // Em DUAS escalas de fonte, porque a caixa da faixa é híbrida (px + rem) e
  // cresce com a do sistema enquanto `--hit` não cresce: um botão quadrado a
  // 1× pode deixar de ser a 1,3×, que é o tamanho em que este app é operado
  // por quem tem a fonte do Android aumentada.
  for (const escala of [1, 1.3]) {
    const ctx = await navegador.newContext({
      viewport: { width: 390, height: 900 }, hasTouch: true, colorScheme: 'dark',
    });
    await semRedeExterna(ctx);
    const pg = await ctx.newPage();
    await pg.goto(base, { waitUntil: 'load' });
    if (escala !== 1) {
      await pg.evaluate((e) => { document.documentElement.style.fontSize = (16 * e) + 'px'; }, escala);
    }
    await esperarCortina(pg);

    const r = await pg.evaluate(async () => {
      const espera = (ms) => new Promise((f) => setTimeout(f, ms));
      setAppMode('full'); await espera(120);

      // ACERVO PLANTADO pelo caminho do app: três mídias no Cronograma, uma
      // delas favoritada e duas na fila — é o que faz as quatro superfícies
      // desenharem os botões de destino de verdade.
      const ids = [];
      for (const nome of ['Louvor A', 'Louvor B', 'Louvor C']) {
        const rec = await AVDB.addMedia(new Blob(['x'], { type: 'audio/mpeg' }),
          { name: nome, type: 'audio/mpeg', kind: 'audio', list: 'imports' });
        ids.push(rec.id);
      }
      await AVDB.listAdd('favs', ids[0]);
      await AVDB.listAdd('playlist', ids[0]);
      await AVDB.listAdd('playlist', ids[1]);
      await recarregarFavoritos();
      plItems = await AVDB.listItems('playlist');
      await load(); await espera(200);

      const vistos = [];
      // QUEM ENTRA NA CONTA, e os dois filtros são DERIVADOS do DOM — nenhum
      // é uma lista de nomes que envelhece:
      //
      //  1. SEM RÓTULO DE TEXTO. Quem tem texto é botão de rótulo e a largura
      //     é dele. O `aria-label`/`title` não conta como rótulo — ele é
      //     justamente o que um botão mudo deve a quem o encontra, e a v1.8.56
      //     os pôs nos três destinos do sorteio.
      //
      //  2. DENTRO DE UMA FOLHA (`.popup-sheet`, `.dialog-card`) OU DE UMA
      //     GAVETA (`.row-acoes`, `.hymn-gaveta`). É o recorte do pedido —
      //     *"nas janelas de confirmação, na janela da playlist automática e em
      //     diversas janelas do tipo"* — e ele é ESTRUTURAL, não uma lista.
      //
      //  3. E NÃO É UMA CÉLULA DA CAIXA DE CONTROLES. MEDIDO, sete botões de
      //     símbolo são retangulares de propósito: `#slidePrevBtn`/
      //     `#slideNextBtn` (47,7 × 113,1 — atravessam a coluna inteira) e as
      //     portas do rodapé e da Biblioteca (47,7 × 40). Ali quem dita o
      //     tamanho é a CÉLULA, não o botão: a largura é `--deck-col`, uma
      //     fração da tela, e uma porta quadrada deixaria buraco entre as
      //     vizinhas — é a decisão da v1.5.5, *"na largura dos botões do
      //     transporte"*.
      //
      //     E O TESTE NÃO É O NOME DELES: é a LARGURA DO PRÓPRIO TRANSPORTE,
      //     lida do `.t-btn` no mesmo quadro. Um botão que mede o que uma
      //     tecla do transporte mede É uma célula daquela grade, seja qual for
      //     o id — a porta que nascer amanhã cai fora por medir igual, não por
      //     alguém lembrar de nomeá-la. **Um botão de símbolo cujo tamanho vem
      //     do LUGAR não é o defeito relatado; o defeito é o que vem do IRMÃO.**
      const colunaDoTransporte = (() => {
        const t = document.querySelector('.t-btn');
        return t ? t.getBoundingClientRect().width : -1;
      })();
      const colher = (onde) => {
        for (const b of document.querySelectorAll('button')) {
          const q = b.getBoundingClientRect();
          if (!q.width || !q.height) continue;
          if ((b.textContent || '').trim()) continue;
          if (!b.querySelector('svg, .msym')) continue;
          if (!b.closest('.popup-sheet, .dialog-card, .row-acoes, .hymn-gaveta')) continue;
          if (colunaDoTransporte > 0 && Math.abs(q.width - colunaDoTransporte) <= 1) continue;
          const chave = onde + '|' + (b.id || b.className);
          if (vistos.some((v) => v.chave === chave)) continue;
          vistos.push({ chave, onde, cls: b.id || b.className,
            w: +q.width.toFixed(1), h: +q.height.toFixed(1),
            quad: Math.abs(q.width - q.height) <= 1 });
        }
      };

      colher('Cronograma');
      // a gaveta de uma linha (o `⋮`)
      document.querySelector('#library .lib-item .row-mais')?.click(); await espera(260);
      colher('gaveta do ⋮');
      // a playlist automática — a faixa que o operador nomeia
      abrirSorteio(); await espera(200); colher('playlist automática');
      if (typeof fecharSorteio === 'function') fecharSorteio(); await espera(120);
      // o rodapé da fila
      document.getElementById('plBtn')?.click(); await espera(220); colher('rodapé da fila');
      document.getElementById('plPopup')?.classList.remove('open'); await espera(120);
      // A GAVETA DE UM FAVORITO E A FAIXA DO `⋮` DELE. Elas só existem dentro da
      // Biblioteca, no grupo dos Favoritos aberto. Desde a v1.13.68 a faixa de
      // ações do favorito é uma `.row-acoes` da própria linha (como a do
      // Cronograma) e NÃO há mais a exceção `.fav-acoes`: a regra do quadrado vale
      // inteira, e o `colher` abaixo a mede como mede o Cronograma.
      openHymnSearch(false); await espera(320);
      document.querySelector('#hymnResults .coll-group--fav .coll-group-bar')?.click();
      await espera(320);
      document.querySelector('#hymnResults .coll-group--fav .lib-item .row')?.click();
      await espera(400);
      colher('gaveta de um favorito');
      // O `⋮` É DA LINHA (v1.13.68): é o toque nele que põe a faixa à vista.
      document.querySelector('#hymnResults .coll-group--fav .lib-item .row-mais')?.click();
      await espera(120);
      colher('opções de um favorito');

      return { vistos, quantos: vistos.length };
    });

    const tortos = r.vistos.filter((v) => !v.quad);
    checar(r.quantos >= 6,
      'A · ' + escala + '×: o oráculo ALCANÇOU os botões de símbolo (' + r.quantos + ') — '
      + 'um censo vazio passaria sem medir nada, que é o placar cheio que não prova nada',
      JSON.stringify(r.vistos.map((v) => v.cls)));
    checar(tortos.length === 0,
      'A · ' + escala + '×: TODO botão sem rótulo é QUADRADO. Quem não é recebeu a '
      + 'altura de um irmão pelo `align-items: stretch`, que é o padrão do flex e '
      + 'não uma decisão — foi assim que os mesmos dois destinos saíram em três caixas',
      JSON.stringify(tortos));
    checar(r.vistos.some((v) => v.onde === 'opções de um favorito'),
      'C · ' + escala + '×: a faixa do `⋮` de um FAVORITO foi alcançada pelo censo — ela é uma '
      + '`.row-acoes` como a do Cronograma (v1.13.68), sem a exceção `.fav-acoes` de antes, e a '
      + 'regra do quadrado do bloco A a mede',
      JSON.stringify(r.vistos.map((v) => v.onde)));
    await ctx.close();
  }

  // ── B. NA FONTE: A MECÂNICA DO DEFEITO NÃO VOLTA ─────────────────────────
  //
  // O bloco A só mede o que ele consegue ABRIR. Este fecha a porta dos fundos
  // para as folhas que ele não alcança, e trava a CAUSA em vez do sintoma.
  const css = fs.readFileSync(path.join(RAIZ, 'controle', 'controle.css'), 'utf8');
  // as famílias que o esqueleto de botão de ícone dimensiona (controle.css ~2168)
  const FAMILIAS = /(\.row-btn|\.row-slot|\.cue-save-btn|\.popup-close|\.log-copy|\.back-btn|\.lv-cheia-btn|\.pl-pack|\.sorteio-dest|\.fav-btn)/;
  const linhas = css.split('\n');
  const suspeitos = [];
  for (let i = 0; i < linhas.length; i++) {
    if (!/(height:\s*auto|align-self:\s*stretch)/.test(linhas[i])) continue;
    // o seletor é a última linha (ou a própria) que abre um bloco
    let j = i;
    while (j >= 0 && !/[.#:a-z\]][^;]*\{/.test(linhas[j])) j--;
    const sel = (linhas[j] || '').split('{')[0].trim();
    // A EXCEÇÃO NOMEADA, e ela não é silêncio: a faixa da gaveta de um favorito
    // é a única em que o quadrado não cabe (largura da capa × altura da faixa,
    // 40 × 42, as duas medidas e as duas com oráculo), e o bloco C mede ali a
    // regra que a substitui. Nomeá-la aqui sem o C seria a lista que se edita
    // para calar o teste.
    if (/\.fav-acoes|\.linha-confirma/.test(sel)) continue;
    // E `height: auto` NÃO É O DEFEITO — o defeito é ele SEM `aspect-ratio`.
    // Herdar a altura de um vizinho é legítimo (é o que mantém os dois botões
    // da Bíblia alinhados com as pílulas, e é o que impede a barra de crescer
    // e serrar a leitura); o que torna o botão retangular é não haver de onde
    // derivar a largura. MEDIDO: com a razão declarada, os dois saem 36,6×36,6
    // a 430×900 e 34×34 a 360×640·1,3×, com a barra na mesma altura de antes.
    const bloco = linhas.slice(j, Math.min(j + 12, linhas.length)).join(' ');
    if (/aspect-ratio\s*:\s*1/.test(bloco)) continue;
    if (FAMILIAS.test(sel)) suspeitos.push({ linha: i + 1, sel, decl: linhas[i].trim() });
  }
  checar(suspeitos.length === 0,
    'B · nenhuma regra que dimensione um botão de ÍCONE declara `height: auto` ou '
    + '`align-self: stretch` — é a mecânica exata dos quatro defeitos deste lote, e '
    + 'ela some da fonte, não só do render',
    JSON.stringify(suspeitos));

  // E O NÚMERO DA FAIXA MORA NUM LUGAR SÓ. Ele existia DUAS vezes, com dois
  // nomes e a mesma expressão (`--faixa-alt` no rodapé da fila, `--dest-quad`
  // na faixa do sorteio) — e foi essa duplicata que deixou a segunda faixa
  // copiar a LARGURA sem a altura.
  const decls = (css.match(/--quad-faixa:\s*[^;]+;/g) || []);
  checar(decls.length === 1 && !/--dest-quad\s*:/.test(css),
    'B · o número do quadrado da faixa é DECLARADO UMA VEZ (`--quad-faixa`, no '
    + '`:root`) e o `--dest-quad` que o repetia com outro nome saiu — dois nomes '
    + 'para um valor é a divergência esperando a primeira edição',
    JSON.stringify({ decls, temDestQuad: /--dest-quad\s*:/.test(css) }));

} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) {
  console.log('\n' + falhas.length + ' falha(s).');
  process.exit(1);
}
console.log('\nTodos passaram.');
