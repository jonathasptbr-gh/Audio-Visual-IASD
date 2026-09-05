// ============================================================================
// A GEOMETRIA DO APP — as sondas, as superfícies e o cenário, num lugar só.
//
// Este arquivo não roda nada: ele é o que a RÉGUA e o PORTÃO compartilham.
//
//  · `tools/varredura-geometrica.mjs` — a RÉGUA. Não reprova nada: abre tudo e
//    IMPRIME o que mediu. É com ela que se decide o que a asserção deve dizer.
//  · `tools/geometria.test.mjs` — o PORTÃO. Roda as mesmas sondas e reprova.
//
// **Duas cópias divergiriam no primeiro ajuste**, e a divergência seria muda
// nos dois sentidos: o portão medindo uma sonda que a régua já corrigiu, ou a
// régua aprovando um cenário que o portão nem monta. É o argumento do
// `arnes.mjs`, um nível acima.
//
// AS CINCO SONDAS ESTÃO VIVAS, e isso foi provado antes de a varredura valer.
// Uma sonda que nunca dispara é indistinguível de um app sem defeito, e aprova
// tudo em silêncio — o mesmo formato de mentira que ela existe para pegar:
//
// | sonda | a prova |
// |---|---|
// | T1 | REVERSÃO: com o `controle.css` de antes da v1.7.10, a pílula "Versão" sai **22px** da tela a 360×640 · 1,3× |
// | T2 | um DOM à mão: dois filhos de um `flex-direction: row` com `margin-left: -90px` → **90px** |
// | T3 | REVERSÃO: o versículo em destaque com **210px** de excesso, `cabem 0ln, clamp 6` — o clamp que nunca engatou |
// | T4 | a varredura de verdade: o `cue-save-btn` da leitura a **20px** de altura em 5 das 8 telas |
// | T5 | um DOM à mão: uma camada `fixed` que começa a 520px numa tela de 640 → **80px** |
// ============================================================================

/** O rótulo de cada sonda, para o relatório e para a frase da reprovação. */
export const ROTULO = {
  T1: 'FORA DA JANELA', T2: 'IRMÃOS SOBREPOSTOS', T3: 'CORTE SERRADO',
  T4: 'ALVO DE TOQUE', T5: 'CAIXA FIXA FORA DA TELA',
};

// AS TELAS. As quatro primeiras são o retrato real do parque (do Android
// pequeno ao grande); as três últimas somam a ESCALA DE FONTE do sistema, que
// multiplica todo `rem` da folha e é o que a máquina de quem escreve não tem.
export const TELAS = [
  { w: 360, h: 640, nome: '360×640' },
  { w: 360, h: 740, nome: '360×740' },
  { w: 393, h: 786, nome: '393×786' },
  { w: 430, h: 900, nome: '430×900' },
  { w: 412, h: 915, nome: '412×915' },
  { w: 360, h: 740, fonte: 1.15, nome: '360×740 · 1,15×' },
  { w: 393, h: 786, fonte: 1.30, nome: '393×786 · 1,3×' },
  { w: 360, h: 640, fonte: 1.30, nome: '360×640 · 1,3×' },
  { w: 360, h: 740, fonte: 1.50, nome: '360×740 · 1,5×' },
];

// AS SUPERFÍCIES. `abrir` roda na página; `alvo` é o que precisa estar de pé
// antes de medir. A ordem é a de uso: a tela, depois o que sobe dela.
export const SUPERFICIES = [
  { nome: 'principal · avançado', abrir: () => { setAppMode('full'); }, alvo: '#playlist' },
  { nome: 'principal · simplificado', abrir: () => { setAppMode('simple'); }, alvo: '.simple-np' },
  { nome: 'biblioteca', abrir: () => { setAppMode('full'); openHymnSearch(false); }, alvo: '.popup-sheet--lib' },
  { nome: 'playlist automática', abrir: () => { setAppMode('full'); abrirSorteio(); }, alvo: '#sorteioPopup.open' },
  { nome: 'fila da playlist', abrir: () => { setAppMode('full'); openPlPopup(); }, alvo: '#plPopup.open' },
  { nome: 'ferramentas', abrir: () => { setAppMode('full'); abrirFerramentas(); }, alvo: '#toolsSheet:not([hidden])' },
  { nome: 'configurações', abrir: () => { setAppMode('full'); openFadePopup(); }, alvo: '#fadePopup.open' },
  { nome: 'histórico', abrir: () => { setAppMode('full'); openHistPopup(); }, alvo: '#histPopup.open' },
  { nome: 'conexão (cast)', abrir: () => { setAppMode('full'); abrirCast(); }, alvo: '#castPopup.open' },
  { nome: 'bíblia · livros', abrir: () => { setAppMode('full'); abrirBiblia(); }, alvo: '#bibleSheet:not([hidden])' },
  { nome: 'bíblia · versões', abrir: () => { setAppMode('full'); openBibleVerPopup(); }, alvo: '#bibleVerPopup.open' },
  {
    nome: 'bíblia · leitura',
    abrir: () => { setAppMode('full'); abrirBiblia(); window.__irParaLeitura(); },
    alvo: '.bible-read',
  },
  { nome: 'leitor de letra', abrir: () => { setAppMode('full'); openLyricsPopup(); }, alvo: '#lyricsPopup.open' },
  {
    nome: 'destinos de um item',
    abrir: () => { setAppMode('full'); escolherDestinos('Onde guardar “Faixa de teste”?', ['cronograma']); },
    alvo: '#songMenuPopup.open',
  },
  {
    // A GAVETA de um favorito (`linhaDeItem`), que é a anatomia da Biblioteca e
    // da pasta do aparelho.
    nome: 'gaveta de um favorito',
    abrir: () => { setAppMode('full'); openHymnSearch(false); window.__abrirGaveta(); },
    alvo: '#hymnResults .lib-item.expanded > .hymn-gaveta',
  },
  {
    // A FAIXA DE OPÇÕES de uma linha do Cronograma (`.row-acoes`), que é OUTRA
    // anatomia — o `⋮` cede a coluna em vez de abrir uma gaveta no corpo.
    nome: 'opções de uma linha',
    abrir: () => { setAppMode('full'); window.__abrirOpcoes(); },
    alvo: '#library .lib-item.acoes-abertas .row-acoes',
  },
];

/**
 * A SONDA — roda dentro da página, e é a mesma para toda superfície.
 *
 * `cfg.pisos` são as EXCEÇÕES NOMEADAS ao piso de toque: `[{ sel, piso }]`, e
 * quem as escreve é o PORTÃO, uma a uma. Uma exceção por escopo ("dentro da
 * Bíblia pode") é a que mais barato se alarga — a lista pede o seletor exato e
 * o número, e quem a lê vê os dois.
 */
export const SONDA = (cfg) => {
  const pisos = (cfg && cfg.pisos) || [];
  const PISO_TOQUE = parseFloat(getComputedStyle(document.documentElement)
    .getPropertyValue('--hit')) || 34;
  const pisoDe = (el) => {
    for (const p of pisos) { try { if (el.matches(p.sel)) return p.piso; } catch (_) { /* seletor ruim */ } }
    return PISO_TOQUE;
  };
  const achados = [];
  const nos = [];
  const vistos = new Set();

  const caminho = (el) => {
    const p = [];
    for (let n = el; n && n.tagName && n !== document.body; n = n.parentElement) {
      if (n.id) { p.unshift('#' + n.id); break; }
      let s = n.tagName.toLowerCase();
      if (n.classList.length) s += '.' + [...n.classList].slice(0, 2).join('.');
      p.unshift(s);
      if (p.length >= 4) break;
    }
    return p.join(' ');
  };
  const trecho = (el) => {
    const t = (el.textContent || '').trim().replace(/\s+/g, ' ');
    return t.length > 42 ? t.slice(0, 42) + '…' : t;
  };

  // A VARREDURA PODA SUBÁRVORE, e é isso que a faz não mentir: um filho de um
  // popup fechado tem caixa de verdade e reportaria tudo como fora da tela.
  (function anda(el) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return;
    const r = el.getBoundingClientRect();
    if (r.width >= 0.5 && r.height >= 0.5) { nos.push({ el, cs, r }); vistos.add(el); }
    for (const f of el.children) anda(f);
  })(document.body);

  const roupaDeAncestral = (el, teste) => {
    for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
      if (teste(getComputedStyle(n), n)) return true;
    }
    return false;
  };
  const jaReportado = (el, lista) => {
    for (let n = el.parentElement; n; n = n.parentElement) if (lista.has(n)) return true;
    return false;
  };

  // ---- T1 · FORA DA JANELA -------------------------------------------------
  const forasT1 = new Set();
  for (const { el, r } of nos) {
    const excesso = Math.max(r.right - innerWidth, -r.left);
    if (excesso <= 0.5) continue;
    if (roupaDeAncestral(el, (c) => /(auto|scroll)/.test(c.overflowX))) continue;
    if (jaReportado(el, forasT1)) continue;
    forasT1.add(el);
    achados.push({ t: 'T1', onde: caminho(el), px: +excesso.toFixed(1), txt: trecho(el) });
  }

  // ---- T2 · IRMÃOS SOBREPOSTOS NUMA LINHA ----------------------------------
  for (const { el, cs } of nos) {
    const linha = /flex$/.test(cs.display) && /^row/.test(cs.flexDirection);
    if (!linha) continue;
    const filhos = [...el.children].filter((f) => vistos.has(f)
      && !/(absolute|fixed)/.test(getComputedStyle(f).position));
    for (let i = 0; i < filhos.length; i++) {
      for (let j = i + 1; j < filhos.length; j++) {
        const a = filhos[i].getBoundingClientRect();
        const b = filhos[j].getBoundingClientRect();
        const dx = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const dy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (dx <= 0.5 || dy <= 0.5) continue;
        achados.push({
          t: 'T2', onde: caminho(el), px: +dx.toFixed(1),
          txt: trecho(filhos[i]) + '  ⨯  ' + trecho(filhos[j]),
        });
      }
    }
  }

  // ---- T3 · CORTE SERRADO --------------------------------------------------
  const forasT3 = new Set();
  for (const { el, cs } of nos) {
    if (!/^(hidden|clip)$/.test(cs.overflowY)) continue;
    const excesso = el.scrollHeight - el.clientHeight;
    if (excesso <= 1) continue;
    if (!(el.textContent || '').trim()) continue;
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
    const cabem = Math.floor((el.clientHeight + 0.5) / lh);
    const clamp = parseInt(cs.webkitLineClamp, 10);
    const clampEngata = clamp > 0 && clamp <= cabem;
    if (clampEngata) continue;
    const mascara = (cs.maskImage && cs.maskImage !== 'none')
      || (cs.webkitMaskImage && cs.webkitMaskImage !== 'none');
    if (mascara) continue;
    if (cs.textOverflow === 'ellipsis' && cs.whiteSpace === 'nowrap') continue;
    if (jaReportado(el, forasT3)) continue;
    forasT3.add(el);
    achados.push({
      t: 'T3', onde: caminho(el), px: +excesso.toFixed(1),
      txt: trecho(el), extra: 'cabem ' + cabem + 'ln, clamp ' + (clamp > 0 ? clamp : '—'),
    });
  }

  // ---- T4 · ALVO DE TOQUE --------------------------------------------------
  for (const { el, r } of nos) {
    const clicavel = /^(button|a|select)$/i.test(el.tagName)
      || el.getAttribute('role') === 'button'
      || (el.tagName === 'INPUT' && /^(button|submit|checkbox|radio)$/i.test(el.type));
    if (!clicavel) continue;
    const menor = Math.min(r.width, r.height);
    const piso = pisoDe(el);
    if (menor >= piso - 0.5) continue;
    achados.push({
      t: 'T4', onde: caminho(el), px: +menor.toFixed(1), piso,
      txt: trecho(el) || el.getAttribute('aria-label') || el.getAttribute('title') || '',
    });
  }

  // ---- T5 · CAIXA FIXA FORA DA TELA ---------------------------------------
  for (const { el, cs, r } of nos) {
    if (cs.position !== 'fixed') continue;
    const fora = Math.max(r.bottom - innerHeight, -r.top, r.right - innerWidth, -r.left);
    if (fora <= 1) continue;
    achados.push({ t: 'T5', onde: caminho(el), px: +fora.toFixed(1), txt: trecho(el) });
  }

  return { achados, nos: nos.length };
};

/**
 * O CENÁRIO — um app com acervo, Cronograma, Bíblia e histórico. Uma tela vazia
 * não tem defeito de layout nenhum, que é o jeito mais fácil de uma varredura
 * mentir sobre si mesma (daí a sonda devolver quantos nós andou).
 */
export const SEMENTE = async () => {
  const NOME_LONGO = 'Grande é o Senhor e mui digno de louvor na cidade do nosso Deus';
  const faixas = (n, pre) => Array.from({ length: n }, (_, i) => ({
    id_music: pre + (i + 1), track: i + 1,
    name: (i % 3 === 0 ? NOME_LONGO : 'Faixa ' + (i + 1)),
    duration: '3:00', has_instrumental_music: i % 2 === 0,
  }));
  collState['hymnal-2022'] = { indexSyncedAt: Date.now(), isHymnal: true, songs: faixas(40, 'h') };
  albumCatalog.categories = [{ name: 'Diversas', albums: [{ id_album: 77, name: 'Álbum de teste com um nome comprido' }] }];
  albumCatalog.albums = [{ id_album: 77, name: 'Álbum de teste com um nome comprido' }];
  collState['album-77'] = { indexSyncedAt: Date.now(), songs: faixas(12, 'a') };

  const mk = async (nome, lista, tipo) => AVDB.addMedia(
    new Blob(['x'.repeat(64)], { type: tipo }), { name: nome, list: lista });

  const a = await mk(NOME_LONGO, 'imports', 'audio/mpeg');
  await mk('Vídeo do testemunho desta semana', 'imports', 'video/mp4');
  await mk('Aviso', 'imports', 'image/png');
  await mk('Favorito com nome bem comprido para medir a linha', 'favs', 'audio/mpeg');
  await mk('Outro favorito', 'favs', 'audio/mpeg');
  window.__itemId = a.id;

  // A BÍBLIA: o capítulo do relato do operador, com o versículo que não cabia.
  const bookIdx = Bible.BOOKS.findIndex((x) => /Naum/i.test(x.name));
  const vs = [];
  for (let i = 1; i <= 19; i++) {
    vs.push({
      n: i,
      text: i === 3
        ? 'os cavaleiros que esporeiam, a espada flamejante, o relampejar da lança '
          + 'e multidão de traspassados, massa de cadáveres, mortos sem fim; tropeça '
          + 'gente sobre os mortos.'
        : 'Versículo ' + i + ' de teste com um texto razoavelmente longo para ocupar linhas nesta folha.',
    });
  }
  await AVDB.setState('bible:' + bibleVersionId + '_' + bibleBookId(bookIdx) + '_3',
    { verses: vs, syncedAt: Date.now() });
  bibleVersions = [{ id: 'ara', name: 'Almeida Revista e Atualizada (ARA)' },
                   { id: 'nvi', name: 'Nova Versão Internacional (NVI)' }];
  bibleVersionId = 'ara';

  // O HISTÓRICO, que só existe depois de alguém projetar.
  for (let i = 0; i < 4; i++) {
    historicoRegistrar('x' + i, { name: NOME_LONGO, kind: 'audio' });
  }

  // OS ATALHOS que as superfícies aninhadas usam: a leitura da Bíblia e a
  // gaveta de uma faixa não têm porta de entrada por função global.
  window.__irParaLeitura = () => {
    bibleSel = { bookIdx, chapter: 3 };
    bibleChapterData = { verses: vs };
    startBibleReading(2);   // o índice 2 é o versículo 3 — o do relato
  };
  // A gaveta de um FAVORITO mora na Biblioteca, e ela precisa da placa aberta.
  window.__abrirGaveta = () => {
    favAberto = true;
    hymnResultsEl.innerHTML = '';
    renderCollectionsList(hymnResultsEl, () => {}, { semTotal: true });
    const li = hymnResultsEl.querySelector('.fav-itens > .lib-item');
    if (li) li.querySelector('.row').click();
  };
  // A faixa de opções de uma linha do CRONOGRAMA sai do `⋮`, não do corpo.
  window.__abrirOpcoes = () => {
    document.querySelector('#library .lib-item .row-mais')?.click();
  };
  await load();
  renderLibrary();
};
