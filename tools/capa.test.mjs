#!/usr/bin/env node
// ============================================================================
// A CAPA DO CULTO (`controle/capa.js`), em Node puro — o `paginar`.
//
// A capa é lida como MINIATURA no WhatsApp e na prévia de importação; os modos
// de errar dela não dão erro, só uma imagem feia ou mentirosa:
//
// | trava                                   | o defeito que ela pega             |
// |-----------------------------------------|------------------------------------|
// | toda op dentro de 1080×1920             | texto ou cartão vazando da imagem  |
// | todo texto dentro da largura útil       | título comprido passando da borda  |
// | títulos de ≤ 90 letras sem elipse       | o nome do hino cortado              |
// | um tamanho de fonte por papel           | capa que encolhe linha a linha      |
// | páginas: cada linha uma vez, inteira    | lista que some, repete ou se parte  |
// | "Página i de n", continuação, teto 6    | página sem contexto, lista sem fim  |
// | 1 página: sem "Página", sem continuação | a capa curta mudando à toa          |
// | nome ≤ 2 linhas, com elipse             | nome longo empurrando a lista       |
// | sem hora / só mídias                    | cronograma real que quebra o layout |
// | faixa = 1º e último momento com hora    | resumo com a hora errada            |
// | nenhum branco pleno                     | a regra da paleta                   |
//
// O `medir` daqui é APROXIMADO (proporcional ao tamanho da fonte): o oráculo
// prova a regra, não a métrica do Chromium.
//
//   node tools/capa.test.mjs
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checar, falhas } from './checar.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(AQUI, '..', 'app', 'src', 'main', 'assets', 'web');

const fonte = fs.readFileSync(path.join(WEB, 'controle', 'capa.js'), 'utf8');
const global_ = {};
new Function(fonte).call(global_);
const C = global_.AVCapa;

checar(!!C && typeof C.paginar === 'function' && typeof C.desenhar === 'function',
  'o módulo publica `AVCapa` com `paginar` e `desenhar`');
// A PÁGINA 1 vista como "a capa": `cabem` = linhas desenhadas nela, `fora` = o resto do culto.
const diagramarP1 = (dados, medir) => {
  const ps = C.paginar(dados, medir);
  const ult = ps[ps.length - 1];
  return { ops: ps[0].ops, cabem: ps[0].ate, fora: ult.ate + ult.fora - ps[0].ate };
};
checar(C.LARGURA === 1080 && C.ALTURA === 1920, 'a capa é 1080×1920 (9:16)', [C.LARGURA, C.ALTURA]);
checar(C.TETO_PAGINAS === 6, 'o teto é 6 páginas', C.TETO_PAGINAS);

/** Largura ≈ letras × tamanho × fator (negrito mais largo). */
const medir = (t, f) => {
  const tam = Number(/(\d+)px/.exec(f)[1]);
  return Array.from(String(t)).length * tam * (/bold/.test(f) ? 0.6 : 0.52);
};

const textos = (r, papel) => r.ops.filter((o) => o.tipo === 'texto' && (!papel || o.papel === papel));

/** As invariantes de TODA capa: dentro da imagem, dentro da largura útil.
 *  `quieto` devolve os defeitos em vez de imprimir (o laço dos prefixos). */
function invariantes(r, rotulo, quieto) {
  const fora = [];
  for (const o of r.ops) {
    if (o.tipo === 'ret' && (o.x < 0 || o.y < 0 || o.x + o.l > C.LARGURA || o.y + o.a > C.ALTURA)) fora.push(o);
    if (o.tipo === 'circ' && (o.x - o.r < 0 || o.y - o.r < 0 || o.x + o.r > C.LARGURA || o.y + o.r > C.ALTURA)) fora.push(o);
    if (o.tipo === 'texto' && (o.y - o.tam < 0 || o.y + o.tam * 0.3 > C.ALTURA)) fora.push(o);
  }
  const largos = textos(r).filter((o) => {
    const ini = o.alinhar === 'right' ? o.x - o.largura : o.x;
    return ini < C.UTIL.x0 - 0.5 || ini + o.largura > C.UTIL.x1 + 0.5
      || Math.abs(o.largura - medir(o.texto, o.fonte) - (o.espaco ? o.espaco * (Array.from(o.texto).length - 1) : 0)) > 0.5;
  });
  if (quieto) return fora.concat(largos);
  checar(fora.length === 0, rotulo + ': toda op dentro de 1080×1920', fora.slice(0, 2));
  checar(largos.length === 0, rotulo + ': nenhum texto passa da largura útil', largos.slice(0, 2));
}

// ---------------------------------------------------------------------------
// 1. O culto de sábado: tudo cabe, resumo e faixa de horas
// ---------------------------------------------------------------------------
const sabado = {
  nome: 'Culto de sábado',
  rodape: 'Toque no arquivo para importar no app',
  linhas: [
    { tipo: 'momento', hora: '09:00', titulo: 'Escola Sabatina' },
    { tipo: 'midia', titulo: 'Hino 140 — Ó vem, Senhor', sub: 'hino' },
    { tipo: 'midia', titulo: 'Informativo Mundial das Missões', sub: 'vídeo' },
    { tipo: 'momento', titulo: 'Intervalo' },
    { tipo: 'momento', hora: '11:00', titulo: 'Culto Divino' },
    { tipo: 'midia', titulo: 'Doxologia', sub: 'hino' },
    { tipo: 'momento', hora: '12:10', titulo: 'Bênção final' },
  ],
};
{
  const r = diagramarP1(sabado, medir);
  invariantes(r, 'sábado');
  checar(r.cabem === 7 && r.fora === 0 && textos(r, 'mais').length === 0, 'cabe tudo, sem "e mais"', r);
  const res = textos(r, 'resumo')[0];
  checar(res && res.texto === '4 momentos · 3 mídias · 9h00–12h10',
    'a faixa vai do PRIMEIRO ao ÚLTIMO momento com hora (o sem hora não conta)', res && res.texto);
  checar(textos(r, 'hora').map((o) => o.texto).join() === '09:00,11:00,12:10',
    'a hora sai na coluna só dos momentos que a têm', textos(r, 'hora').map((o) => o.texto));
  const momX = new Set(textos(r, 'momento').map((o) => o.x));
  checar(momX.size === 1, 'todo título de momento na mesma coluna, com hora ou sem', [...momX]);
  checar(textos(r, 'rodape').length === 2, 'rodapé: a marca e o `rodape`');
}

// ---------------------------------------------------------------------------
// 2. As PÁGINAS: 60 linhas, todos os prefixos, o teto em 200
// ---------------------------------------------------------------------------
const NOMES = [
  'Castelo forte é nosso Deus', 'Saudai o nome de Jesus', 'Ó vem, Senhor',
  'Quão grande és Tu, ó Senhor meu Deus, quando contemplo a criação inteira', // ~70
  'Grandioso és Tu', 'Mais perto quero estar, meu Deus, de Ti, inda que seja a dor que me una a Ti', // ~90
];
// Títulos de momento de ~45 letras (negrito 40 px na coluna do título) e de mídia até ~90.
const lista = (n, comHora = true) => {
  const ls = [];
  for (let i = 0; i < n; i++) {
    ls.push(i % 6 === 0
      ? { tipo: 'momento', ...(comHora ? { hora: String(8 + Math.floor(i / 6) % 12).padStart(2, '0') + ':00' } : {}),
        titulo: i % 12 ? 'Momento ' + i : 'Louvor e adoração congregacional da manhã ' + i }
      : { tipo: 'midia', titulo: 'Hino ' + (100 + i) + ' — ' + NOMES[i % NOMES.length], sub: i % 3 ? 'hino' : 'vídeo' });
  }
  return ls;
};
/** Confere as páginas de uma lista; devolve a lista de defeitos. */
function conferirPaginas(ps, n, rotulo) {
  const erros = [];
  const vistas = [];
  ps.forEach((p, k) => {
    const inv = invariantes(p, rotulo + ' p' + (k + 1), true);
    if (inv.length) erros.push(['fora da página', k, inv[0]]);
    if (p.pagina !== k + 1 || p.paginas !== ps.length) erros.push(['numeração', k, p.pagina, p.paginas]);
    const pag = textos(p, 'pagina').map((o) => o.texto);
    if (ps.length > 1 ? pag.join() !== 'Página ' + (k + 1) + ' de ' + ps.length : pag.length) erros.push(['rodapé', k, pag]);
    const proprias = [...new Set(p.ops.filter((o) => o.linha !== undefined && !o.continua).map((o) => o.linha))];
    const faixa = Array.from({ length: p.ate - p.de }, (_, i) => p.de + i);
    if (proprias.sort((a, b) => a - b).join() !== faixa.join()) erros.push(['faixa', k, p.de, p.ate, proprias]);
    vistas.push(...faixa);
    const cont = p.ops.filter((o) => o.continua);
    const deveTer = k > 0 && p.de < n && lista0[p.de].tipo === 'midia' && lista0.slice(0, p.de).some((l) => l.tipo === 'momento');
    if (deveTer !== (textos(p, 'continuacao').length === 1)) erros.push(['continuação', k, p.de]);
    // A continuação NÃO repete a hora (pedido do operador, 18/11): ela diria que o momento começa ali.
    if (cont.some((o) => o.papel === 'hora')) erros.push(['hora na continuação', k]);
    if (cont.length && !cont.every((o) => lista0[o.linha].tipo === 'momento' && o.linha < p.de
      && !lista0.slice(o.linha + 1, p.de).some((l) => l.tipo === 'momento'))) erros.push(['continuação errada', k]);
    if (k < ps.length - 1 && p.ate - p.de > 1 && lista0[p.ate - 1].tipo === 'momento') erros.push(['órfão', k]);
    const mais = textos(p, 'mais').map((o) => o.texto).join();
    const esperado = p.fora ? 'e mais ' + p.fora + (p.fora === 1 ? ' item' : ' itens') : '';
    if (mais !== esperado || (p.fora && k !== 5)) erros.push(['mais', k, mais, p.fora]);
  });
  const fora = ps.length ? ps[ps.length - 1].fora : 0;
  if (vistas.join() !== Array.from({ length: n - fora }, (_, i) => i).join()) erros.push(['cobertura', vistas.length, fora]);
  if (ps.length > 6) erros.push(['teto', ps.length]);
  return erros;
}
let lista0;
{
  lista0 = lista(60);
  const ps = C.paginar({ nome: 'Culto longo', rodape: 'Toque no arquivo para importar no app', linhas: lista0 }, medir);
  checar(ps.length > 1 && ps.length <= 6 && ps[ps.length - 1].fora === 0, '60 linhas: várias páginas, ≤ 6, nada fora', ps.length);
  checar(conferirPaginas(ps, 60, '60 linhas').length === 0,
    '60 linhas: cada linha uma vez, inteira, "Página i de n", continuação só dentro de grupo, sem órfão',
    conferirPaginas(ps, 60, '60 linhas'));
  checar(ps.some((p) => p.ops.some((o) => o.continua)) && ps.some((p, k) => k && !p.ops.some((o) => o.continua)) || ps.every((p, k) => !k || p.ops.some((o) => o.continua)),
    'premissa: a lista de 60 exercita a continuação');
  // A MÍDIA DE 2 LINHAS: existe, e cada uma mora numa página só (a faixa acima já prova).
  const duas = ps.flatMap((p) => p.ops).filter((o) => o.papel === 'midia');
  const porLinha = {};
  for (const o of duas) porLinha[o.linha] = (porLinha[o.linha] || 0) + 1;
  checar(Object.values(porLinha).some((v) => v === 2) && Object.values(porLinha).every((v) => v <= 2),
    'mídia de nome longo quebra em 2 linhas (nunca 3)', porLinha);
  // UM TAMANHO POR PAPEL em todas as páginas.
  const tams = {};
  for (const o of ps.flatMap((p) => textos(p))) (tams[o.papel] ||= new Set()).add(o.tam);
  checar(Object.values(tams).every((t) => t.size === 1), 'um tamanho de fonte por papel, igual em todas as páginas',
    Object.fromEntries(Object.entries(tams).map(([k, v]) => [k, [...v]])));
  // NENHUM TÍTULO CORTADO: nomes até ~90 letras não ganham elipse.
  const cortados = ps.flatMap((p) => textos(p)).filter((o) => /…$/.test(o.texto) && o.papel !== 'nome');
  checar(cortados.length === 0 && lista0.some((l) => l.tipo === 'midia' && Array.from(l.titulo).length >= 87), 'nenhum texto cortado: mídia até ~90 letras, momento até ~45',
    cortados.map((o) => o.texto));
  // Todo prefixo: a mesma conferência.
  const errados = [];
  for (let n = 1; n <= 60; n++) {
    const e = conferirPaginas(C.paginar({ nome: 'x', linhas: lista0.slice(0, n) }, medir), n, 'prefixo ' + n);
    if (e.length) errados.push([n, e[0]]);
  }
  checar(errados.length === 0, 'todo prefixo de 1 a 60 linhas passa na mesma conferência', errados.slice(0, 3));
}
{
  lista0 = lista(200);
  const ps = C.paginar({ nome: 'Congresso', linhas: lista0 }, medir);
  const ult = ps[ps.length - 1];
  checar(ps.length === 6 && ult.fora === 200 - ult.ate && ult.fora > 0, '200 linhas: teto de 6 páginas, a 6ª com fora = 200 − ate',
    [ps.length, ult.ate, ult.fora]);
  checar(conferirPaginas(ps, 200, '200 linhas').length === 0, '200 linhas: "e mais N itens" exato, só na 6ª',
    conferirPaginas(ps, 200, '200 linhas'));
  checar(ps.slice(0, 5).every((p) => !textos(p, 'mais').length), 'as 5 primeiras não têm "e mais"');
}
{
  // UMA PÁGINA: sem "Página 1 de 1", sem continuação, a lista inteira.
  const ps = C.paginar(sabado, medir);
  checar(ps.length === 1 && !textos(ps[0], 'pagina').length && !ps[0].ops.some((o) => o.continua)
    && ps[0].de === 0 && ps[0].ate === 7 && ps[0].fora === 0,
    '1 página: sem "Página", sem continuação, de 0 a 7');
}

// ---------------------------------------------------------------------------
// 3. Nome longo: no máximo 2 linhas, a segunda com elipse
// ---------------------------------------------------------------------------
{
  const nome = 'Culto de Ação de Graças pelo aniversário de cinquenta anos da Igreja Adventista do Sétimo Dia central';
  const r = diagramarP1({ nome, linhas: sabado.linhas }, medir);
  invariantes(r, 'nome longo');
  const ns = textos(r, 'nome');
  checar(ns.length === 2 && ns[1].texto.endsWith('…') && !ns[0].texto.endsWith('…'),
    'nome longo: 2 linhas, elipse só na segunda', ns.map((o) => o.texto));
  const palavra = diagramarP1({ nome: 'A'.repeat(80), linhas: [] }, medir);
  invariantes(palavra, 'palavra gigante');
  checar(textos(palavra, 'nome').length === 2, 'uma palavra maior que a linha é partida, ainda em 2 linhas');
  const curto = diagramarP1({ nome: 'Culto jovem', linhas: [] }, medir);
  checar(textos(curto, 'nome').length === 1, 'nome curto: 1 linha');
  checar(textos(curto, 'resumo')[0].texto === 'cronograma vazio', 'lista vazia não quebra',
    textos(curto, 'resumo')[0].texto);
}

// ---------------------------------------------------------------------------
// 4. Momentos sem hora e cronograma só de mídias
// ---------------------------------------------------------------------------
{
  const semHora = diagramarP1({ nome: 'Pequeno grupo', linhas: [
    { tipo: 'momento', titulo: 'Abertura' }, { tipo: 'midia', titulo: 'Hino 1', sub: 'áudio' },
    { tipo: 'momento', titulo: 'Estudo' },
  ] }, medir);
  invariantes(semHora, 'sem hora');
  checar(textos(semHora, 'hora').length === 0 && textos(semHora, 'resumo')[0].texto === '2 momentos · 1 mídia',
    'momentos sem hora: sem coluna de hora e sem faixa', textos(semHora, 'resumo')[0].texto);
  checar(textos(semHora, 'momento')[0].x === C.UTIL.x0, 'sem hora, o momento encosta na margem');

  const midias = diagramarP1({ nome: 'Louvor', linhas: [
    { tipo: 'midia', titulo: 'Hino 46 — Santo, Santo, Santo', sub: 'hino' },
    { tipo: 'midia', titulo: 'Sem tipo nenhum' },
  ] }, medir);
  invariantes(midias, 'só mídias');
  checar(textos(midias, 'midia').length === 2 && textos(midias, 'resumo')[0].texto === '2 mídias',
    'cronograma só de mídias', textos(midias, 'resumo')[0].texto);
  const longa = diagramarP1({ nome: 'x', linhas: [{ tipo: 'midia', titulo: 'Z'.repeat(200), sub: 'vídeo do YouTube com legenda' }] }, medir);
  invariantes(longa, 'título e tipo longos');
  const tl = textos(longa, 'midia');
  checar(tl.length === 2 && tl[1].texto.endsWith('…') && !tl[0].texto.endsWith('…'),
    'título de mídia maior que 2 linhas: quebra e elipse só no fim da 2ª', tl.map((o) => o.texto));
}

// ---------------------------------------------------------------------------
// 5. A paleta: nenhum branco pleno, e as ops só usam cores dela
// ---------------------------------------------------------------------------
{
  const cores = Object.values(C.CORES).map((c) => c.toLowerCase());
  checar(!cores.some((c) => c === '#fff' || c === '#ffffff'), 'nenhuma cor da paleta é branco pleno', cores);
  const r = diagramarP1(sabado, medir);
  const alheias = r.ops.filter((o) => !cores.includes(String(o.cor).toLowerCase()));
  checar(alheias.length === 0, 'toda op pinta com uma cor da paleta', alheias.slice(0, 2));
}

// ---------------------------------------------------------------------------
// 6. `desenhar`/`desenharPaginas` sem canvas rejeitam (Node não tem `document`)
// ---------------------------------------------------------------------------
{
  let rejeitou = false;
  await C.desenhar(sabado).catch(() => { rejeitou = true; });
  checar(rejeitou, '`desenhar` sem canvas rejeita em vez de pendurar');
  let rej2 = false;
  await C.desenharPaginas(sabado).catch(() => { rej2 = true; });
  checar(rej2, '`desenharPaginas` sem canvas rejeita');
}

if (falhas.length) { console.log(`\n${falhas.length} falha(s)`); process.exit(1); }
console.log('\ncapa: OK');
