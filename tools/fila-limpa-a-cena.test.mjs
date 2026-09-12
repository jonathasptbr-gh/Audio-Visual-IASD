// ============================================================================
// ESVAZIAR A FILA ESVAZIA O PLAYER — E AVISA ANTES (v1.8.84)
//
// Relato do operador: *"ao limpar um item da playlist, ele remove ele da
// exibição, mas quando limpo uma playlist inteira, ele mantém a midia no player
// ao inves de limpar corretamente. Coloque também uma mensagem de aviso ao
// excluir um item ou Playlist que tenha algo tocando no momento, avisando que a
// mídia será interrompida."*
//
// ## O defeito, e por que ele não aparecia no caminho óbvio
//
// A condição do "Limpar" era `plItems.some(noArAgora)` — *"o que está no ar é DA
// FILA?"*. Tocando uma faixa da própria fila ela é verdadeira, e o percurso mais
// natural de quem for conferir passa exatamente por aí: MEDIDO, com a fila em
// [A, B] tocando A, o Limpar já limpava tudo. **Os dois casos que ela deixava de
// fora são os que o operador alcança:**
//
//   1. o que está no player NÃO está na fila (tocando A com a fila em [B]);
//   2. `currentId` sem `midiaNoAr` — a faixa acabou ou o Parar foi tocado, e o
//      `currentId` sobrevive de propósito (é ele que faz o ▶ repetir), então o
//      cartão segue anunciando o nome sobre uma fila vazia.
//
// A pergunta certa é `!!currentId`: a fila é a única lista que o TRANSPORTE
// percorre, e esvaziá-la não deixa sequência para ele governar.
//
// ## E o AVISO troca a superfície da pergunta, não só o texto
//
// A faixa da linha divide a caixa em DOIS rótulos e não tem onde pôr uma frase
// (v5.309); a `dica` dela vai para o `title`, **que não existe num aparelho de
// toque**. Por isso a pergunta sobe para o `appConfirm` quando tem algo a dizer
// — o mesmo caminho de "Limpar o Cronograma" e "Excluir pasta".
//
// **A metade que impede o conserto largo demais é o BLOCO D:** remover da fila
// um item que não está no ar, com a fila sobrando, continua sendo a faixa inline
// e continua não interrompendo nada. Sem ele, "avisar sempre" passa — e o app
// prometeria uma interrupção que não acontece, com o dedo já no botão, além de
// pausar o louvor de quem só reorganizou a fila (v1.8.52).
//
// REVERSÃO MEDIDA, duas peças e duas assimetrias:
//
//   `plItems.some(noArAgora)` de volta no `tirarDaFilaEncerraCena`
//     → 4 reprovadas, TODAS em A e B; C e D passam inteiros. É a prova de que A
//       e B medem o relato (o player apontando para FORA da fila) e de que C e
//       D medem outra coisa — sem essa separação, "avisar sempre" passaria.
//
//   o `pedirSaidaDaFila` sempre pela faixa da linha
//     → 3 reprovadas, todas de DIÁLOGO (as duas de A e a primeira de C); as de
//       limpeza passam. A pergunta e a limpeza são fatos independentes, e é por
//       isso que cada bloco afirma os dois.
//
//   node tools/fila-limpa-a-cena.test.mjs
// ============================================================================
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperarCortina, esperar, porque, checar, falhas, RAIZ_WEB } from './arnes.mjs';

const servidor = servirEstatico(RAIZ_WEB);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);

const erros = [];
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY/;

try {
  const pg = await ctx.newPage();
  pg.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (EXTERNO.test(t) || /Failed to load resource/.test(t)) return;
    erros.push(t);
  });
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));

  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function', null, { timeout: 30000 });
  await esperarCortina(pg);
  await pg.evaluate(() => setAppMode('full'));

  // Dois WAVs de 30 s: o percurso tem de terminar com a faixa ainda andando, ou
  // o `midiaNoAr` cai sozinho e o oráculo mede o fim natural achando que mede o
  // Limpar.
  const ids = await pg.evaluate(async () => {
    const wav = () => {
      const sr = 8000, secs = 30, n = sr * secs;
      const buf = new ArrayBuffer(44 + n * 2), dv = new DataView(buf);
      const wr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
      wr(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); wr(8, 'WAVEfmt ');
      dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
      dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true);
      dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
      wr(36, 'data'); dv.setUint32(40, n * 2, true);
      for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, Math.sin(i / 20) * 3000, true);
      return new Blob([buf], { type: 'audio/wav' });
    };
    const a = await AVDB.addMedia(wav(), { name: 'Louvor A', type: 'audio/wav', kind: 'audio', list: 'imports' });
    const b = await AVDB.addMedia(wav(), { name: 'Louvor B', type: 'audio/wav', kind: 'audio', list: 'imports' });
    // A MENSAGEM do bloco E: sem ela `projectMessage(0)` não tem o que projetar
    // e o bloco mede um cartão que nunca subiu.
    messages = [{ id: 'm1', text: 'Culto da Palavra às 19h30' }];
    await saveMessages();
    return { a: a.id, b: b.id };
  });

  // O QUE SE MEDE: `currentId` é o que o player aponta (é ele que faz o cartão
  // dizer o nome e o ▶ repetir), `midiaNoAr` é o que o resto do app consulta, e
  // o `<video>` é a prova de que a faixa de fato parou — as três, porque um
  // conserto que zerasse só a variável deixaria o som no ar.
  const espiar = () => pg.evaluate(() => {
    const v = document.querySelector('#preview video');
    return {
      currentId, midiaNoAr, fila: plItems.length,
      tocando: !!v && !v.paused,
      cartaoVazio: /nada em exibição/i.test(document.getElementById('npTitle')
        ? document.getElementById('npTitle').textContent : ''),
    };
  });
  // A PERGUNTA que está na tela: em qual superfície, e o que ela DIZ.
  const pergunta = () => pg.evaluate(() => {
    const d = document.getElementById('appDialog');
    if (d && d.classList.contains('open')) {
      const ok = document.getElementById('appDialogOk');
      return {
        onde: 'dialogo',
        titulo: document.getElementById('appDialogTitle').textContent.trim(),
        msg: document.getElementById('appDialogMsg').textContent.trim(),
        ok: ok.textContent.trim(), perigo: ok.classList.contains('perigo'),
      };
    }
    const faixa = document.querySelector('.linha-confirma');
    return faixa
      ? { onde: 'faixa', botoes: [...faixa.querySelectorAll('button')].map((x) => x.textContent.trim()) }
      : { onde: 'nenhuma' };
  });
  const confirmar = async () => {
    await pg.evaluate(() => {
      const d = document.getElementById('appDialog');
      if (d && d.classList.contains('open')) { document.getElementById('appDialogOk').click(); return; }
      const b = document.querySelector('.linha-confirma .linha-sim');
      if (b) b.click();
    });
    await pg.waitForTimeout(1200);
  };
  const abrirFila = async () => {
    await pg.evaluate(() => { if (!plPopupEl.classList.contains('open')) plBtnEl.click(); });
    await pg.waitForTimeout(400);
  };
  const montar = async (fila, tocar) => {
    await pg.evaluate(async (o) => {
      fecharConfirmacaoNaLinha();
      await AVDB.listSet('playlist', o.fila);
      await load();
    }, { fila });
    await pg.waitForTimeout(250);
    if (tocar) {
      await pg.evaluate((id) => send(id), tocar);
      const ok = await esperar(pg, () => {
        const v = document.querySelector('#preview video');
        return !!v && !v.paused && v.currentTime > 0.3;
      });
      if (ok !== true) throw new Error('a faixa não começou: ' + ok);
    }
  };

  // =======================================================================
  // A · O CASO DO RELATO: o que está no player não é da fila
  // =======================================================================
  await montar([ids.b], ids.a);
  const a0 = await espiar();
  checar(a0.currentId === ids.a && a0.tocando && a0.fila === 1,
    'A · ponto de partida: tocando A com a fila em [B] — o player aponta para '
    + 'fora da fila, que é o estado em que a condição antiga respondia "não é '
    + 'minha"', a0);

  await abrirFila();
  await pg.evaluate(() => document.getElementById('plClear').click());
  await pg.waitForTimeout(300);
  const pa = await pergunta();
  checar(pa.onde === 'dialogo' && /interrompida/i.test(pa.msg),
    'A · a pergunta sobe para o DIÁLOGO e DIZ que a mídia será interrompida — a '
    + 'faixa da linha não tem onde pôr uma frase, e a `dica` dela vira um '
    + '`title`, que não existe num aparelho de toque', pa);
  checar(pa.perigo === true && pa.ok === 'Confirmar',
    '  ↳ com o botão no par destrutivo da paleta', pa);
  await confirmar();
  const a1 = await espiar();
  checar(a1.fila === 0 && a1.currentId === null && !a1.midiaNoAr && !a1.tocando,
    'A · e o player esvazia junto com a fila — era ele que ficava tocando, '
    + 'porque a pergunta era pela PROVENIÊNCIA do que estava no ar', a1);

  // =======================================================================
  // B · `currentId` DE PÉ SEM MÍDIA NO AR — a faixa acabou, ou o Parar veio
  // =======================================================================
  await montar([ids.a, ids.b], ids.a);
  await pg.evaluate(() => document.getElementById('stop').click());
  await pg.waitForTimeout(700);
  const b0 = await espiar();
  checar(b0.currentId === ids.a && !b0.midiaNoAr,
    'B · ponto de partida: o Parar preserva o `currentId` de propósito (é ele que '
    + 'faz o ▶ repetir a faixa), então o cartão continua anunciando o nome', b0);
  await abrirFila();
  await pg.evaluate(() => document.getElementById('plClear').click());
  await pg.waitForTimeout(300);
  await confirmar();
  const b1 = await espiar();
  checar(b1.fila === 0 && b1.currentId === null,
    'B · e o Limpar zera o player também aqui — "limpar de verdade" é o cartão '
    + 'dizer "Nada em exibição", e sem zerar o `currentId` ele é inalcançável', b1);

  // =======================================================================
  // C · A LIXEIRA DA LINHA, no último item e no ar
  // =======================================================================
  await montar([ids.a], ids.a);
  await abrirFila();
  await pg.evaluate(() => {
    const li = document.querySelector('#playlist li');
    li.querySelector('.row-excluir').click();
  });
  await pg.waitForTimeout(300);
  const pc = await pergunta();
  checar(pc.onde === 'dialogo' && /interrompida/i.test(pc.msg),
    'C · a lixeira do ÚLTIMO item no ar também avisa, pela mesma porta', pc);
  await confirmar();
  const c1 = await espiar();
  checar(c1.fila === 0 && c1.currentId === null && !c1.tocando,
    'C · e a cena se encerra, como a v1.8.52 já pedia', c1);

  // =======================================================================
  // D · A REVERSÃO: o que NÃO interrompe não avisa, e não para nada
  // =======================================================================
  //
  // Sem este bloco, "avisar sempre" passa em A e em C — e o app prometeria uma
  // interrupção que não acontece, além de pausar o louvor de quem só
  // reorganizou a fila.
  await montar([ids.a, ids.b], ids.a);
  await abrirFila();
  await pg.evaluate(() => {
    const li = document.querySelectorAll('#playlist li')[1];   // o item que NÃO está no ar
    li.querySelector('.row-excluir').click();
  });
  await pg.waitForTimeout(300);
  const pd = await pergunta();
  checar(pd.onde === 'faixa',
    'D · remover um item que NÃO está no ar mantém a pergunta na FAIXA da linha '
    + '— ela é o "tem certeza?" de um gesto cuja consequência a própria linha '
    + 'mostra, e trocá-la por um diálogo cobraria um modal por item removido', pd);
  const antes = await espiar();
  await confirmar();
  const d1 = await espiar();
  checar(d1.fila === 1 && d1.currentId === ids.a && d1.tocando,
    'D · e o louvor continua tocando: com fila sobrando nada é interrompido '
    + '(v1.8.52 — "pausar o louvor porque o operador reorganizou a fila seria '
    + 'interrupção de culto")', { antes, d1 });

  // =======================================================================
  // E · A CAMADA DE TEXTO NÃO É LEVADA JUNTO
  // =======================================================================
  //
  // A condição nova é `!!currentId`, e um versículo sobre um louvor de fundo tem
  // `currentId` de pé: sem a escolha do `encerrarCenaDaFila` entre `clear` e
  // `media-clear`, o Limpar apagaria a Escritura do telão junto com o louvor.
  await montar([ids.a], ids.a);
  await pg.evaluate(() => projectMessage(0));
  await pg.waitForTimeout(500);
  const e0 = await espiar();
  const cartaoE0 = await pg.evaluate(() => !document.getElementById('pvText').hidden);
  checar(e0.tocando && cartaoE0,
    'E · ponto de partida: o louvor toca com uma mensagem projetada por cima', { e0, cartaoE0 });
  await abrirFila();
  await pg.evaluate(() => document.getElementById('plClear').click());
  await pg.waitForTimeout(300);
  await confirmar();
  const e1 = await espiar();
  const cartaoE1 = await pg.evaluate(() => !document.getElementById('pvText').hidden);
  checar(e1.fila === 0 && !e1.tocando && cartaoE1,
    'E · o Limpar leva a MÍDIA e deixa a Camada de Texto — `encerrarCenaDaFila` '
    + 'escolhe `media-clear` por `cenaDeRoteiroNoAr()`, e sem isso a condição '
    + 'nova apagaria a Escritura do telão junto', { e1, cartaoE1 });

  checar(erros.length === 0, 'nenhum erro de console', erros);
} catch (e) {
  checar(false, 'o percurso terminou sem exceção (' + (e && e.message) + ')');
} finally {
  await navegador.close();
  servidor.close();
}

console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
