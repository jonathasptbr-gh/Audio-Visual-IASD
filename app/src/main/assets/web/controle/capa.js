// ============================================================================
// A CAPA DO CULTO — o itinerário do cronograma em PNGs 1080×1920 (9:16).
//
// Viaja DENTRO do `.avpkg` de um culto: é o que a prévia de importação mostra
// e o que o WhatsApp exibe como miniatura antes de alguém tocar no arquivo. Por
// isso a régua é **legível em miniatura**: poucos tamanhos, hierarquia forte,
// nada de branco pleno, UM tamanho de fonte por papel (em toda página e todo
// culto: título comprido QUEBRA em 2 linhas, nunca encolhe). Lista que não cabe numa capa vira MAIS capas
// ("Página 2 de 3" no rodapé), até `TETO_PAGINAS`.
//
// ## Duas metades, como o `pacote.js`
//
// | função           | onde roda        | o que faz                                          |
// |------------------|------------------|----------------------------------------------------|
// | `paginar`        | Node e navegador | PURA: dados + `medir` → `[{ ops, pagina, paginas, de, ate, fora }]` |
// | `desenharPaginas`| só navegador     | um canvas por página → `Blob[]` PNG                 |
// | `desenhar`       | só navegador     | só a página 1 → `Blob` PNG                          |
//
// Toda decisão (quebra, elipse, repartição, continuação, "e mais N") mora em
// `paginar`, com oráculo em Node (`tools/capa.test.mjs`); os `desenhar*` só
// pintam. `medir(texto, fonte) → px` é injetado: no navegador é o
// `measureText` do canvas, no oráculo uma aproximação.
//
// ## As páginas
//
// | regra                 | como                                                        |
// |-----------------------|-------------------------------------------------------------|
// | cabeçalho             | repetido em toda página; o resumo conta o culto INTEIRO      |
// | quebra                | título de momento e de mídia em até 2 linhas, elipse só na 2ª; o `sub` fica na 1ª |
// | corte                 | linha inteira (a de 2 linhas não se parte); `de..ate` (ate exclusivo) em `dados.linhas`   |
// | continuação           | página que começa dentro do grupo de um momento repete a linha dele com "(continuação)" (`continua: true` nas ops) |
// | momento órfão no pé   | passa para a próxima página                                 |
// | teto                  | `TETO_PAGINAS`; só na última, sobrando, entra "e mais N itens" (`fora`) |
// | uma página só         | sem "Página 1 de 1": igual à capa sem paginação              |
//
// ## As ops
//
//   { tipo: 'ret',   x, y, l, a, cor, raio? }
//   { tipo: 'circ',  x, y, r, cor }                       (x, y = centro)
//   { tipo: 'texto', texto, x, y, fonte, tam, cor, alinhar: 'left'|'right',
//     largura, espaco?, papel, linha?, continua? }
//
// `y` do texto é a LINHA DE BASE; `largura` é a medida já com o `espaco` entre
// letras; `linha` é o índice em `dados.linhas` (só nas linhas da lista).
// ============================================================================
(function (global) {
  'use strict';

  const LARGURA = 1080;
  const ALTURA = 1920; // 9:16, a tela cheia do celular (o status do WhatsApp)

  // A paleta ESCURA de `shared/tokens.css`. O canvas não lê CSS: os valores
  // são cópia, com o token ao lado — mudou lá, muda aqui no mesmo lote.
  const CORES = {
    BG: '#0b1219',          // --bg
    PAINEL: '#212f3d',      // --panel
    PAINEL_2: '#304254',    // --panel-2
    TEXTO: '#dce0e5',       // --text
    MUTED: '#b6bdc6',       // --muted
    BRAND: '#95b5f4',       // --brand
    ACCENT: '#95b5f4',      // --accent
    ACCENT_FILL: '#2f557f', // --accent-fill
  };

  const FAMILIA = 'system-ui, -apple-system, sans-serif'; // a do app; sem fonte embarcada
  const fonte = (tam, negrito) => (negrito ? 'bold ' : '') + tam + 'px ' + FAMILIA;

  // A RÉGUA. Painel a 48 px da borda dos lados e 64 em cima/embaixo; conteúdo
  // a 64 px dentro dele dos lados e 88 em cima.
  const MARGEM = 48;
  const RECUO = 64;
  const MARGEM_V = 64;
  const RECUO_V = 88;
  const X0 = MARGEM + RECUO;            // 112
  const X1 = LARGURA - MARGEM - RECUO;  // 968 → largura útil 856
  const RAIO = 40;

  // Tamanhos [px]: rótulo, nome (e entrelinha), resumo, momento, hora, mídia,
  // tipo da mídia, "e mais", rodapé, "Página i de n", "(continuação)".
  const T = { rotulo: 24, nome: 72, nomeLh: 84, resumo: 32, mom: 40, hora: 36,
    mid: 32, sub: 26, mais: 30, rod: 24, pag: 26, cont: 28 };
  // Alturas das linhas da lista; `GAP` só antes de um momento que não é o primeiro.
  const H = { mom: 66, mid: 54, mais: 56, gap: 22 };
  const LH = { mom: 48, mid: 40 }; // entrelinha da 2ª linha de um título quebrado
  const COL_HORA = 148;   // a coluna fixa da hora
  const RODAPE_Y = ALTURA - MARGEM_V - 72; // linha de base do rodapé
  const LISTA_FIM = RODAPE_Y - 70;       // nada da lista passa daqui
  const PAG_EXTRA = 48;                  // a linha "Página i de n", com várias páginas
  const TETO_PAGINAS = 6;
  const MARCA_CONT = '(continuação)';

  const larguraDe = (medir, t, f, espaco) =>
    medir(t, f) + (espaco ? espaco * Math.max(0, Array.from(t).length - 1) : 0);

  /** Corta pelo fim e põe "…" até caber em `max`. Texto que cabe volta igual. */
  function elidir(t, f, max, medir) {
    t = String(t == null ? '' : t);
    if (medir(t, f) <= max) return t;
    const cs = Array.from(t);
    while (cs.length && medir(cs.join('').trimEnd() + '…', f) > max) cs.pop();
    return cs.length ? cs.join('').trimEnd() + '…' : '…';
  }

  /** Quebra gulosa por palavra em até `n` linhas; a última leva o resto com
   *  elipse. Palavra maior que a linha inteira é partida por letra. `maxes`:
   *  um número, ou a largura de cada linha (a última vale para as seguintes). */
  function quebrar(t, f, maxes, n, medir) {
    const lst = [].concat(maxes);
    const pal = String(t || '').trim().split(/\s+/).filter(Boolean);
    const linhas = [];
    let atual = '';
    for (let i = 0; i < pal.length; i++) {
      const max = lst[Math.min(linhas.length, lst.length - 1)];
      const cand = atual ? atual + ' ' + pal[i] : pal[i];
      if (medir(cand, f) <= max) { atual = cand; continue; }
      if (linhas.length === n - 1) { // última linha: o resto inteiro, elidido
        linhas.push(elidir(pal.slice(i).reduce((a, p) => a + ' ' + p, atual).trim(), f, max, medir));
        return linhas;
      }
      if (atual) { linhas.push(atual); atual = ''; i--; continue; }
      // palavra sozinha não cabe: parte por letra
      const cs = Array.from(pal[i]);
      let k = cs.length;
      while (k > 1 && medir(cs.slice(0, k).join(''), f) > max) k--;
      linhas.push(cs.slice(0, k).join(''));
      pal[i] = cs.slice(k).join('');
      if (pal[i]) i--;
    }
    if (atual) linhas.push(atual);
    return linhas.slice(0, n);
  }

  /** "09:00" → "9h00"; o que não for hora volta como veio. */
  function horaCurta(h) {
    const m = /^(\d{1,2})[:h](\d{2})/.exec(String(h || '').trim());
    return m ? Number(m[1]) + 'h' + m[2] : String(h || '').trim();
  }

  /** "4 momentos · 9 mídias · 9h00–12h10" — a faixa só com momentos COM hora,
   *  do primeiro ao último na ordem do cronograma. */
  function resumo(linhas) {
    const mom = linhas.filter((l) => l.tipo === 'momento');
    const nMid = linhas.length - mom.length;
    const partes = [];
    if (mom.length) partes.push(mom.length + (mom.length === 1 ? ' momento' : ' momentos'));
    if (nMid) partes.push(nMid + (nMid === 1 ? ' mídia' : ' mídias'));
    const horas = mom.map((l) => String(l.hora || '').trim()).filter(Boolean);
    if (horas.length) {
      const a = horaCurta(horas[0]);
      const b = horaCurta(horas[horas.length - 1]);
      partes.push(a === b ? a : a + '–' + b);
    }
    return partes.length ? partes.join(' · ') : 'cronograma vazio';
  }

  const normalizar = (dados) => (Array.isArray(dados && dados.linhas) ? dados.linhas : [])
    .map((l) => ({ tipo: l && l.tipo === 'momento' ? 'momento' : 'midia',
      hora: l && l.hora ? String(l.hora) : '', titulo: String((l && l.titulo) || ''),
      sub: l && l.sub ? String(l.sub) : '' }));


  /** O momento cujo grupo contém a linha `s` (mídia), ou -1. */
  function grupoDe(linhas, s) {
    if (s <= 0 || linhas[s].tipo === 'momento') return -1;
    for (let j = s - 1; j >= 0; j--) if (linhas[j].tipo === 'momento') return j;
    return -1;
  }

  /** As faixas `[{ de, ate, cont, fora }]`. Cabe tudo em `disp1` ⇒ uma página
   *  com o rodapé simples; senão reparte em `disp2` (rodapé com "Página i de n"). */
  function repartir(linhas, alt, altCont, disp1, disp2) {
    const n = linhas.length;
    // `GAP` só antes de momento que não abre a página.
    const alturaDe = (i, abre) => alt[i] + (linhas[i].tipo === 'momento' && !abre ? H.gap : 0);
    if (linhas.reduce((a, l, i) => a + alturaDe(i, i === 0), 0) <= disp1) {
      return [{ de: 0, ate: n, cont: -1, fora: 0 }];
    }
    const faixas = [];
    let s = 0;
    while (s < n && faixas.length < TETO_PAGINAS) {
      const ultima = faixas.length === TETO_PAGINAS - 1;
      const cont = grupoDe(linhas, s);
      let acc = cont >= 0 ? altCont(cont) : 0;
      let resto = 0;
      for (let i = s; i < n; i++) resto += alturaDe(i, i === s && cont < 0);
      let ate = n;
      if (acc + resto > disp2) {
        const reserva = ultima ? H.mais : 0;
        ate = s;
        while (ate < n && acc + alturaDe(ate, ate === s && cont < 0) + reserva <= disp2) {
          acc += alturaDe(ate, ate === s && cont < 0);
          ate++;
        }
        if (ate - s > 1 && linhas[ate - 1].tipo === 'momento') ate--; // órfão desce
        if (ate === s) ate = s + 1; // sempre anda (só com uma régua absurda)
      }
      faixas.push({ de: s, ate, cont, fora: ultima ? n - ate : 0 });
      s = ate;
    }
    return faixas;
  }

  function paginar(dados, medir) {
    dados = dados || {};
    const linhas = normalizar(dados);
    const util = X1 - X0;
    const fNome = fonte(T.nome, true);
    const nome = quebrar(String(dados.nome || '').trim() || 'Culto', fNome, util, 2, medir);
    const txtResumo = elidir(resumo(linhas), fonte(T.resumo, false), util, medir);
    // A geometria do cabeçalho não muda entre páginas: o início da lista também não.
    const listaIni = MARGEM_V + RECUO_V + T.rotulo + 26 + nome.length * T.nomeLh + 64 + 38 + 3 + 26;

    // Coluna de hora só se algum momento tiver hora. A mídia é recuada pouco: sob
    // a coluna da hora (16 px) ou, sem ela, 36 px sob o momento — a largura
    // fica para o título dela.
    const temHora = linhas.some((l) => l.tipo === 'momento' && l.hora.trim());
    const temMom = linhas.some((l) => l.tipo === 'momento');
    const xTitMom = X0 + (temHora ? COL_HORA : 0);
    const xMarca = X0 + (temHora ? 16 : temMom ? 36 : 0);
    const xt = xMarca + 32;

    // As linhas de cada título, ANTES de repartir: a altura de uma linha da
    // lista depende de quantas o título dela ocupa.
    const fMom = fonte(T.mom, true);
    const fMid = fonte(T.mid, false);
    const fSub = fonte(T.sub, false);
    const wCont = medir(MARCA_CONT, fonte(T.cont, false)) + 14;
    const umaAo = (tl) => (tl.length ? tl : ['']);
    const lay = linhas.map((l) => {
      if (l.tipo === 'momento') {
        const tl = umaAo(quebrar(l.titulo, fMom, X1 - xTitMom, 2, medir));
        return { tl, alt: H.mom + (tl.length - 1) * LH.mom };
      }
      const sub = l.sub ? elidir(l.sub, fSub, Math.round(util * 0.3), medir) : '';
      const l1 = sub ? X1 - larguraDe(medir, sub, fSub) - 24 - xt : X1 - xt;
      const tl = umaAo(quebrar(l.titulo, fMid, [l1, X1 - xt], 2, medir));
      return { tl, sub, alt: H.mid + (tl.length - 1) * LH.mid };
    });
    // Na continuação, a 1ª linha do título cede a largura da marca.
    const linhasCont = (j) => umaAo(quebrar(linhas[j].titulo, fMom, [X1 - xTitMom - wCont, X1 - xTitMom], 2, medir));
    const altCont = (j) => H.mom + (linhasCont(j).length - 1) * LH.mom;
    const faixas = repartir(linhas, lay.map((x) => x.alt), altCont,
      LISTA_FIM - listaIni, LISTA_FIM - PAG_EXTRA - listaIni);
    const paginas = faixas.length;

    return faixas.map((fx, p) => {
      const ops = [];
      const texto = (t, x, y, tam, negrito, cor, papel, extra) => {
        const f = fonte(tam, negrito);
        const espaco = extra && extra.espaco;
        const op = { tipo: 'texto', texto: t, x, y, fonte: f, tam, cor, alinhar: 'left',
          largura: larguraDe(medir, t, f, espaco), papel };
        ops.push(Object.assign(op, extra || {}));
        return op;
      };

      // Fundo, painel e cabeçalho: rótulo espaçado, nome (≤ 2 linhas), resumo, filete.
      ops.push({ tipo: 'ret', x: 0, y: 0, l: LARGURA, a: ALTURA, cor: CORES.BG });
      ops.push({ tipo: 'ret', x: MARGEM, y: MARGEM_V, l: LARGURA - 2 * MARGEM, a: ALTURA - 2 * MARGEM_V,
        cor: CORES.PAINEL, raio: RAIO });
      let y = MARGEM_V + RECUO_V + T.rotulo;
      texto('CRONOGRAMA', X0, y, T.rotulo, true, CORES.BRAND, 'rotulo', { espaco: 6 });
      y += 26;
      for (const l of nome) { y += T.nomeLh; texto(l, X0, y, T.nome, true, CORES.TEXTO, 'nome'); }
      y += 64;
      texto(txtResumo, X0, y, T.resumo, false, CORES.MUTED, 'resumo');
      y += 38;
      ops.push({ tipo: 'ret', x: X0, y, l: util, a: 3, cor: CORES.PAINEL_2 });

      // A linha de momento: hora na coluna, título (1–2 linhas); na
      // continuação, a marca depois da 1ª linha e SEM a hora (pedido do operador,
      // 18/11: a hora diria que o momento começa ali). Devolve a altura.
      const momento = (i, topo, extra) => {
        const l = linhas[i];
        const base = topo + 47;
        if (temHora && l.hora.trim() && !extra) {
          texto(elidir(l.hora.trim(), fonte(T.hora, true), COL_HORA - 20, medir), X0, base,
            T.hora, true, CORES.ACCENT, 'hora', Object.assign({ linha: i }, extra));
        }
        const tl = extra ? linhasCont(i) : lay[i].tl;
        tl.forEach((t, k) => {
          const op = texto(t, xTitMom, base + k * LH.mom, T.mom, true, CORES.TEXTO, 'momento',
            Object.assign({ linha: i }, extra));
          if (extra && !k) {
            texto(MARCA_CONT, xTitMom + op.largura + 14, base, T.cont, false, CORES.MUTED,
              'continuacao', Object.assign({ linha: i }, extra));
          }
        });
        return H.mom + (tl.length - 1) * LH.mom;
      };

      let topo = listaIni;
      if (fx.cont >= 0) topo += momento(fx.cont, topo, { continua: true });
      for (let i = fx.de; i < fx.ate; i++) {
        const l = linhas[i];
        if (l.tipo === 'momento') {
          if (i > fx.de || fx.cont >= 0) topo += H.gap;
          topo += momento(i, topo);
        } else {
          const base = topo + 38;
          ops.push({ tipo: 'circ', x: xMarca + 8, y: base - 11, r: 7, cor: CORES.ACCENT_FILL, linha: i });
          if (lay[i].sub) {
            const op = texto(lay[i].sub, X1, base, T.sub, false, CORES.MUTED, 'sub', { linha: i });
            op.alinhar = 'right';
          }
          lay[i].tl.forEach((t, k) => texto(t, xt, base + k * LH.mid, T.mid, false, CORES.TEXTO,
            'midia', { linha: i }));
          topo += lay[i].alt;
        }
      }
      if (fx.fora) {
        texto('e mais ' + fx.fora + (fx.fora === 1 ? ' item' : ' itens'), xMarca + 32, topo + 40, T.mais,
          false, CORES.MUTED, 'mais');
      }

      // Rodapé: filete; com várias páginas, "Página i de n" numa linha acima;
      // a marca à esquerda e o `rodape` à direita (o que sobrar).
      const extraPag = paginas > 1 ? PAG_EXTRA : 0;
      ops.push({ tipo: 'ret', x: X0, y: RODAPE_Y - 46 - extraPag, l: util, a: 2, cor: CORES.PAINEL_2 });
      if (paginas > 1) {
        texto('Página ' + (p + 1) + ' de ' + paginas, X0, RODAPE_Y - 42, T.pag, true,
          CORES.BRAND, 'pagina');
      }
      const fr = fonte(T.rod, false);
      const marca = texto('Áudio Visual IASD', X0, RODAPE_Y, T.rod, true, CORES.MUTED, 'rodape');
      if (dados.rodape) {
        const r = elidir(dados.rodape, fr, util - marca.largura - 32, medir);
        const op = texto(r, X1, RODAPE_Y, T.rod, false, CORES.MUTED, 'rodape');
        op.alinhar = 'right';
      }
      return { ops, pagina: p + 1, paginas, de: fx.de, ate: fx.ate, fora: fx.fora };
    });
  }

  /** Pinta texto com `espaco` letra a letra: `letterSpacing` do canvas não
   *  existe em todo WebView, e assim a pintura bate com a medida de `paginar`. */
  function pintarTexto(ctx, op) {
    ctx.font = op.fonte;
    ctx.fillStyle = op.cor;
    ctx.textBaseline = 'alphabetic';
    const x = op.alinhar === 'right' ? op.x - op.largura : op.x;
    ctx.textAlign = 'left';
    if (!op.espaco) { ctx.fillText(op.texto, x, op.y); return; }
    let cx = x;
    for (const c of Array.from(op.texto)) { ctx.fillText(c, cx, op.y); cx += ctx.measureText(c).width + op.espaco; }
  }

  function ret(ctx, op) {
    ctx.fillStyle = op.cor;
    const r = op.raio || 0;
    if (!r) { ctx.fillRect(op.x, op.y, op.l, op.a); return; }
    const { x, y, l, a } = op;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + l, y, x + l, y + a, r);
    ctx.arcTo(x + l, y + a, x, y + a, r);
    ctx.arcTo(x, y + a, x, y, r);
    ctx.arcTo(x, y, x + l, y, r);
    ctx.closePath();
    ctx.fill();
  }

  /** Um canvas `LARGURA`×`ALTURA` com 2D, ou `null` (Node, WebView sem canvas). */
  function novoCanvas() {
    const doc = global.document;
    const cv = doc && doc.createElement ? doc.createElement('canvas') : null;
    const ctx = cv && cv.getContext ? cv.getContext('2d') : null;
    if (!ctx || !cv.toBlob) return null;
    cv.width = LARGURA;
    cv.height = ALTURA;
    return { cv, ctx };
  }

  function pintar(ctx, ops) {
    for (const op of ops) {
      if (op.tipo === 'ret') ret(ctx, op);
      else if (op.tipo === 'circ') {
        ctx.fillStyle = op.cor;
        ctx.beginPath();
        ctx.arc(op.x, op.y, op.r, 0, Math.PI * 2);
        ctx.fill();
      } else pintarTexto(ctx, op);
    }
  }

  const png = (cv) => new Promise((ok, falha) =>
    cv.toBlob((b) => (b ? ok(b) : falha(new Error('capa: toBlob vazio'))), 'image/png'));

  /** Navegador: um PNG por página, em ordem. Rejeita sem canvas 2D ou se um
   *  `toBlob` devolver nada. Um canvas só, repintado: a memória é a de uma página. */
  async function desenharPaginas(dados, ate) {
    const c = novoCanvas();
    if (!c) throw new Error('capa: canvas indisponível');
    const medir = (t, f) => { c.ctx.font = f; return c.ctx.measureText(t).width; };
    const pags = paginar(dados, medir).slice(0, ate || TETO_PAGINAS);
    const blobs = [];
    for (const p of pags) {
      c.ctx.clearRect(0, 0, LARGURA, ALTURA);
      pintar(c.ctx, p.ops);
      blobs.push(await png(c.cv));
    }
    return blobs;
  }

  /** Navegador: só a página 1 (a capa que vai na miniatura). */
  const desenhar = (dados) => desenharPaginas(dados, 1).then((b) => b[0]);

  global.AVCapa = {
    LARGURA,
    ALTURA,
    TETO_PAGINAS,
    CORES,
    UTIL: { x0: X0, x1: X1 },
    resumo,
    paginar,
    desenharPaginas,
    desenhar,
  };
})(this);
