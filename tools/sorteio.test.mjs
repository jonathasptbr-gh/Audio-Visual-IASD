#!/usr/bin/env node
// ============================================================================
// A REGRA DO SORTEIO TEMÁTICO — o que pode sair no telão, e o que não pode
//
// ## Por que ele existe
//
// `controle/sorteio.js` decide, a partir do acervo indexado, quais faixas podem
// ser sorteadas para o telão. O operador toca UM botão e a faixa entra em cena:
// não há tela intermediária, não há confirmação, e ninguém confere a lista
// antes. Os quatro modos de errar são silenciosos, e o oráculo cobra os quatro:
//
//   - **aceitar demais** → um episódio de série (~300 MB) ou uma coleção que o
//     operador não marcou entra no lugar do louvor;
//   - **aceitar de menos** → o tema casa na letra e a faixa não aparece, e o
//     operador conclui que o acervo não tem o que ele sabe que tem;
//   - **errar a VARIANTE** → `resolveSongMediaId` mapeia tudo que não seja
//     `'full'` para o playback: uma string errada aqui projeta o instrumental
//     onde se esperava a voz, sem erro em lugar nenhum;
//   - **errar a ORDEM da preferência** → a fila sai cheia de faixas que ainda
//     precisam ser baixadas, e o culto espera a rede da igreja.
//
// ## As capacidades são de MENTIRA, e é isso que torna a regra testável
//
// O módulo não normaliza texto, não lê o IndexedDB e não conhece o índice de
// letras: ele PEDE tudo em `cap`. Aqui `cap` é escrito à mão, com um
// normalizador que faz o mesmo que o `normalizeForSearch` do app (NFD + tira
// diacrítico + minúsculas) — e a fonte de acaso é uma sequência FIXA, que é o
// que permite afirmar qualquer coisa sobre um sorteio.
//
// Node puro, sem rede e sem navegador: entra no `apk.yml` **sem
// `continue-on-error`**.
//
//   node tools/sorteio.test.mjs
// ============================================================================
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { checar, falhas } from './checar.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(raiz, 'app/src/main/assets/web/controle/sorteio.js');

// Mesma carga do `serie.test.mjs`: o módulo é a IIFE `(function (global) { … })(this)`,
// e o corpo de um `new Function` é não-estrito, então o `this` do topo é o
// receptor do `.call`. Zero navegador, e o `globalThis` deste processo fica
// intacto — se um dia o arquivo passar a depender de `document`, isto falha
// alto, que é o que se quer.
const janela = {};
new Function(readFileSync(SRC, 'utf8')).call(janela);
const S = janela.AVSorteio;

checar(!!S, 'o módulo publica window.AVSorteio');
if (!S) { console.log('\n1 FALHA(S)'); process.exit(1); }

// ── O acervo de mentira ─────────────────────────────────────────────────────
// Os campos são os REAIS de `collState[id].songs` (ver o mapa de coleções no
// CLAUDE.md): `id_music`, `name`, `has_instrumental_music`, `fileIdFull`,
// `fileIdPlayback`, `semAudio`, `semPlayback`. Nada inventado — uma forma
// imaginada provaria só que o teste concorda com quem o escreveu.
const HINARIO = { id: 'hymnal-2022', name: 'Hinário Adventista 2022', kind: 'hymnal' };
const ALBUM_NATAL = { id: 'album-9', name: 'Natal — Coral Adventista', kind: 'album' };
const ALBUM_OUTRO = { id: 'album-4', name: 'Momentos de Louvor', kind: 'album' };
const SERIE = { id: 'serie-pv-2026', name: 'Provai e Vede 2026', kind: 'serie' };
const ALBUM_VAZIO = { id: 'album-77', name: 'Álbum sem índice', kind: 'album' };

const ACERVO = {
  'hymnal-2022': [
    // Casa pelo NOME **e** pela letra — é o par que prova a ordem. Cantada e
    // playback na origem, e está no aparelho.
    { id_music: 'h1', name: 'Noite de Paz (Natal)', has_instrumental_music: true,
      fileIdFull: 'f-h1', fileIdPlayback: 'p-h1' },
    // Só cantada na origem (`semPlayback`), e NÃO está no aparelho.
    { id_music: 'h2', name: 'Firme nas Promessas', has_instrumental_music: true,
      semPlayback: true, fileIdFull: null, fileIdPlayback: null },
    // A origem não tem áudio nenhum — a faixa existe no índice e não toca.
    { id_music: 'h3', name: 'Hino sem áudio na origem', semAudio: true,
      has_instrumental_music: false, fileIdFull: null, fileIdPlayback: null },
    // Casa só pela LETRA (o nome não tem a palavra).
    { id_music: 'h4', name: 'Tu és Fiel', has_instrumental_music: false,
      fileIdFull: 'f-h4', fileIdPlayback: null },
  ],
  'album-9': [
    // O nome do ÁLBUM diz "natal", mas a faixa não diz em lugar nenhum (nem título, nem letra):
    // desde a v1.12.5 o álbum NÃO prova o tema — é a armadilha que o operador apontou.
    { id_music: 'a1', name: 'A Estrela do Oriente', has_instrumental_music: true,
      fileIdFull: null, fileIdPlayback: null },
    { id_music: 'a2', name: 'Anjos Cantam', has_instrumental_music: true,
      fileIdFull: 'f-a2', fileIdPlayback: 'p-a2' },
  ],
  'album-4': [
    { id_music: 'b1', name: 'Ao Deus da Minha Vida', has_instrumental_music: true,
      fileIdFull: 'f-b1', fileIdPlayback: null },
  ],
  'serie-pv-2026': [
    // Uma série tem `has_instrumental_music: false` forçado e o `id_music` é o
    // id do vídeo do YouTube. Ela nunca deveria chegar a ser lida.
    { id_music: 'Ab12Cd34Ef5', name: 'Provai e Vede (15/Ago)', has_instrumental_music: false },
  ],
  'album-77': [],
};

// A letra de mentira: só o que casa "natal" e "gratid".
const LETRAS = {
  'hymnal-2022:h4': 'grande é a tua fidelidade · gratidao a ti',
  'hymnal-2022:h1': 'noite feliz de natal',
};

// `normalizeForSearch` do app, replicado (NFD + tira diacrítico + minúsculas).
// Ele NÃO remove pontuação nem colapsa espaço — e o teste depende disso ser
// verdade, porque é assim que a busca da Biblioteca já se comporta.
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// AS COLETÂNEAS de cada álbum (`cap.coletaneas`), com o N:N do banco: o álbum 4
// está em DUAS. O álbum sem índice não está em nenhuma — cai em "outros".
const COLETANEAS_DE = { 'album-9': [7], 'album-4': [7, 8] };

const cap = {
  norm,
  nomeNorm: (s) => norm(s.name),
  ehMusica: (coll) => coll.kind !== 'serie',
  ehHinarioNovo: (coll) => coll.id === 'hymnal-2022',
  ehHinarioAntigo: (coll) => coll.id === 'hymnal-1996',
  coletaneas: (coll) => COLETANEAS_DE[coll.id] || [],
  faixas: (coll) => ACERVO[coll.id] || [],
  // Espelha o `lyricMatch`: piso de 3 caracteres e busca no texto normalizado.
  letraCasa: (coll, s, q) => q.length >= 3 && (LETRAS[coll.id + ':' + s.id_music] || '').includes(q),
  noAparelho: (coll, s, v) => !!(v === 'playback' ? s.fileIdPlayback : s.fileIdFull),
};

const TODAS = [HINARIO, ALBUM_NATAL, ALBUM_OUTRO, SERIE, ALBUM_VAZIO];
const chaves = (r) => r.itens.map((i) => i.coll.id + ':' + i.s.id_music);

// ── 1. O saneamento: nada guardado no banco atravessa cru ───────────────────
// A pior forma deste defeito é a `variante`: `resolveSongMediaId` não pergunta
// `=== 'playback'`, ele pergunta `=== 'full'` e manda TODO o resto para o
// playback. Uma preferência gravada por uma versão futura com outro vocabulário
// projetaria o instrumental sem erro nenhum.
checar(S.sanear({ variante: 'cantada' }).variante === S.VARIANTE_CANTADA,
  'variante desconhecida cai na CANTADA — nunca no playback por omissão',
  S.sanear({ variante: 'cantada' }).variante);
checar(S.sanear({ variante: 'playback' }).variante === 'playback',
  'e a variante válida atravessa');
checar(S.sanear(null).modo === S.MODO_UMA && S.sanear(null).quantos === S.QUANTIDADE_PADRAO,
  'sem preferência nenhuma o padrão é "uma só" na quantidade padrão');
// A QUANTIDADE VIROU UMA FAIXA (v1.8.96), e com ela "fora da lista" deixou de
// existir: o que pode chegar é um número fora dos LIMITES. Ele é CLAMPADO e não
// recusado — devolver ao padrão apagaria uma escolha que só precisava de teto —,
// e as três células são as três que se erram: dentro, acima e abaixo.
checar(S.sanear({ quantos: 7 }).quantos === 7,
  'uma quantidade DENTRO da faixa atravessa: com a roleta no lugar dos presets, '
  + '7 é um valor como outro qualquer', S.sanear({ quantos: 7 }).quantos);
checar(S.sanear({ quantos: 999 }).quantos === S.QUANTIDADE_MAX,
  'acima do teto ela é CLAMPADA, não descartada — o teto existe para não montar '
  + 'centenas de downloads antes da primeira nota, e clampar já o cumpre',
  S.sanear({ quantos: 999 }).quantos);
checar(S.sanear({ quantos: 0 }).quantos === S.QUANTIDADE_PADRAO
  && S.sanear({ quantos: -3 }).quantos === S.QUANTIDADE_PADRAO,
  'e abaixo do piso ela cai no padrão: zero não é uma escolha a preservar',
  JSON.stringify([S.sanear({ quantos: 0 }).quantos, S.sanear({ quantos: -3 }).quantos]));
checar(S.sanear({ soNoAparelho: 'sim' }).soNoAparelho === false,
  'filtro com tipo errado é FALSO, não "verdadeiro porque tem conteúdo"');
// AS CATEGORIAS: só uma LISTA de strings atravessa, sem repetição. Uma string
// solta (`'hinario-2022'`) não vira lista de caracteres, e um registro VELHO,
// com os filtros de exclusão, chega como "nada marcado" — isto é, tudo.
checar(JSON.stringify(S.sanear({ categorias: 'hinario-2022' }).categorias) === '[]',
  'categorias que não são lista caem em NENHUMA marcada (= tudo), nunca em letras soltas',
  JSON.stringify(S.sanear({ categorias: 'hinario-2022' }).categorias));
checar(JSON.stringify(S.sanear({ categorias: ['infantis', 3, '', 'infantis', 'col:7'] }).categorias)
  === JSON.stringify(['infantis', 'col:7']),
  'só strings não vazias entram, e sem repetição',
  JSON.stringify(S.sanear({ categorias: ['infantis', 3, '', 'infantis', 'col:7'] }).categorias));
checar(JSON.stringify(S.sanear({ semHinario: true, semInfantis: true }).categorias) === '[]'
  && S.sanear({ semHinario: true }).semHinario === undefined
  && S.sanear({ semInfantis: true }).semInfantis === undefined,
  'os filtros de EXCLUSÃO saíram: um registro velho com eles chega como "tudo", e '
  + 'eles não atravessam o saneamento', JSON.stringify(S.sanear({ semHinario: true, semInfantis: true })));

// ── 2. A coleção: quem nem chega a ser varrida ──────────────────────────────
// A recusa da SÉRIE é a que mais custa se falhar: o item dela é um vídeo de
// ~300 MB e o `has_instrumental_music: false` faria o filtro "Playback"
// escondê-la por acidente — mas o filtro "Cantada" não.
const semSerie = S.avaliarColecao(SERIE, S.sanear({}), cap);
checar(!semSerie.entra && semSerie.motivo === S.MOTIVO_SEM_MUSICA,
  'a SÉRIE é recusada por não ser acervo de música, e o motivo sai nomeado', semSerie);
checar(S.avaliarColecao(ALBUM_VAZIO, S.sanear({}), cap).motivo === S.MOTIVO_SEM_INDICE,
  'coleção sem índice é recusada como "sem índice" — não como "sem música"');
checar(S.avaliarColecao(HINARIO, S.sanear({ categorias: ['col:7'] }), cap).motivo === S.MOTIVO_CATEGORIA,
  'com outra coleção marcada o hinário sai, e sai nomeado');
checar(S.avaliarColecao(HINARIO, S.sanear({}), cap).entra,
  'e sem nada marcado ele entra — nada marcado é TUDO');
checar(S.avaliarColecao(HINARIO, S.sanear({ categorias: ['infantis'] }), cap).entra,
  'marcar só os INFANTIS deixa o hinário novo entrar — é nele que eles moram');
// A ORDEM das perguntas é contrato (é ela que o Registro imprime): uma série
// também não tem índice útil, e ainda assim o motivo é "não é acervo de música".
checar(S.avaliarColecao({ id: 'serie-x', name: 'x', kind: 'serie' },
  S.sanear({ categorias: ['col:7'] }), { ...cap, faixas: () => [] }).motivo === S.MOTIVO_SEM_MUSICA,
  'a ORDEM dos motivos é contrato: o estrutural vence o consertável');

// ── 3. A variante: a origem tem? (≠ está no aparelho) ───────────────────────
checar(S.temVariante({ has_instrumental_music: true }, 'playback'),
  'playback: a origem tem quando `has_instrumental_music` é verdadeiro');
checar(!S.temVariante({ has_instrumental_music: true, semPlayback: true }, 'playback'),
  '…e NÃO tem quando já se tentou e não havia (`semPlayback`)');
checar(!S.temVariante({ has_instrumental_music: false }, 'playback'),
  '…nem quando o banco não publica playback nenhum');
checar(!S.temVariante({ semAudio: true }, 'full'),
  'cantada: `semAudio` é o único jeito de saber ANTES de tentar baixar');
checar(S.temVariante({}, 'full'),
  'e uma faixa sem marca nenhuma tem a cantada — é o caso normal');

// ── 4. O tema: os DOIS lugares em que ele casa (título e letra), na ordem ───
const poolNatal = S.montarPool(TODAS, { tema: 'natal' }, cap);
checar(!chaves(poolNatal).includes('album-9:a1') && !chaves(poolNatal).includes('album-9:a2'),
  'o NOME DO ÁLBUM não prova o tema: as faixas do álbum "Natal" que não dizem a palavra (título nem letra) FICAM DE FORA',
  chaves(poolNatal));
checar(S.CASOU_ALBUM === undefined && poolNatal.casaram.album === undefined,
  '…e já não existe veredito "álbum": o tema casa no título ou na letra, e só', poolNatal.casaram);
checar(poolNatal.recusas[S.MOTIVO_TEMA] >= 2,
  '…e a recusa é NOMEADA como tema que não casa (o operador sabe por que a faixa não veio)', poolNatal.recusas);
checar(poolNatal.itens.find((i) => i.s.id_music === 'h1').casou === S.CASOU_NOME,
  'o NOME vence a letra quando os dois casam (a mesma ordem da busca)');
const poolGrat = S.montarPool(TODAS, { tema: 'gratidão' }, cap);
checar(chaves(poolGrat).includes('hymnal-2022:h4'),
  'a LETRA entra no tema, e o acento digitado não atrapalha (normalizador único)');
checar(poolGrat.itens[0].casou === S.CASOU_LETRA, '…e o veredito diz que foi pela letra');
checar(S.montarPool(TODAS, { tema: 'gr' }, cap).itens.length === 0,
  'abaixo do piso de letra a busca curta não varre a letra — senão "de" casaria tudo');
const poolTudo = S.montarPool(TODAS, {}, cap);
checar(poolTudo.itens.every((i) => i.casou === S.CASOU_SEM_TEMA),
  'sem palavra tema o acervo INTEIRO entra, e o veredito o diz');

// ── 5. Quem NÃO entra, e por quê — a prestação de contas ────────────────────
// Uma lista vazia sem motivo é indistinguível de um defeito, e o operador está
// a distância. Estas contagens são o que o Registro imprime.
checar(!chaves(poolTudo).includes('serie-pv-2026:Ab12Cd34Ef5'),
  'o episódio da série NUNCA aparece no pool');
checar(!chaves(poolTudo).includes('hymnal-2022:h3'),
  'a faixa que a origem não tem áudio fica de fora — ela responderia "sem internet"');
checar(poolTudo.recusas[S.MOTIVO_VARIANTE] === 1,
  'e a recusa dela é CONTADA como "variante", não somada num total mudo',
  poolTudo.recusas);
checar(poolTudo.colecoesVistas === 5 && poolTudo.colecoesUsadas === 3,
  'a varredura diz quantas coleções viu e quantas usou',
  [poolTudo.colecoesVistas, poolTudo.colecoesUsadas]);
checar(poolTudo.colecoesRecusadas.some((c) => c.motivo === S.MOTIVO_SEM_INDICE),
  'a coleção sem índice aparece nomeada nas recusas — é a que o operador conserta');
const poolPB = S.montarPool(TODAS, { variante: 'playback' }, cap);
checar(chaves(poolPB).sort().join(',') === 'album-9:a1,album-9:a2,album-4:b1,hymnal-2022:h1'.split(',').sort().join(','),
  'só PLAYBACK deixa exatamente as faixas cujo banco publica instrumental', chaves(poolPB));
// ── 5b. A UNIÃO: marcar estreita para o que está marcado, e só ──────────
const soHinario = S.montarPool(TODAS, { categorias: [S.CAT_HINARIO_2022] }, cap);
checar(chaves(soHinario).length > 0 && chaves(soHinario).every((k) => k.startsWith('hymnal-2022:')),
  'UM toque, "Hinário 2022", e só o hinário entra — o que antes eram duas exclusões',
  chaves(soHinario));
const soCol8 = S.montarPool(TODAS, { categorias: ['col:8'] }, cap);
checar(chaves(soCol8).join(',') === 'album-4:b1',
  'uma coletânea marcada traz os álbuns DELA, e só', chaves(soCol8));
const uniao = S.montarPool(TODAS, { categorias: ['col:8', S.CAT_HINARIO_2022] }, cap);
checar(chaves(uniao).sort().join(',') === chaves(soHinario).concat(chaves(soCol8)).sort().join(','),
  'duas marcadas são a UNIÃO das duas — nem interseção, nem a última que se tocou',
  chaves(uniao));
const col7 = S.montarPool(TODAS, { categorias: ['col:7'] }, cap);
checar(chaves(col7).includes('album-4:b1') && chaves(col7).includes('album-9:a2'),
  'N:N: o álbum que está em duas coletâneas entra por QUALQUER uma delas', chaves(col7));
checar(soCol8.colecoesRecusadas.some((c) => c.motivo === S.MOTIVO_CATEGORIA && /Hinário/.test(c.nome)),
  'e o que ficou de fora pela marca sai NOMEADO como "fora das coleções marcadas"',
  JSON.stringify(soCol8.colecoesRecusadas));
checar(chaves(S.montarPool(TODAS, { categorias: [S.CAT_OUTROS] }, cap)).length === 0
  && S.montarPool(TODAS, { categorias: [S.CAT_OUTROS] }, cap).colecoesRecusadas
    .some((c) => c.nome === 'Álbum sem índice' && c.motivo === S.MOTIVO_SEM_INDICE),
  'o álbum sem coletânea é "outros": marcado, ele passa da marca e só para no índice que falta');
checar(chaves(S.montarPool(TODAS, { categorias: ['col:999'] }, cap)).length === 0,
  'uma marca que nada no acervo tem dá pool VAZIO — nunca "tudo" por engano');
const poolLocal = S.montarPool(TODAS, { soNoAparelho: true }, cap);
checar(chaves(poolLocal).sort().join(',') === ['hymnal-2022:h1', 'hymnal-2022:h4', 'album-9:a2', 'album-4:b1'].sort().join(','),
  '"só no aparelho" deixa só o que tem `fileIdFull`', chaves(poolLocal));
checar(poolTudo.noAparelho === 4,
  'o pool conta as duas metades — é o "12 casam · 3 já no aparelho" da tela',
  poolTudo.noAparelho);

// O PAR QUE NÃO PODE SER RECUSADO JUNTO: o filtro de aparelho olha a variante
// PEDIDA. Com "playback" marcado, uma faixa cuja cantada está baixada e cujo
// playback não está NÃO pode contar como presente.
const poolPBLocal = S.montarPool(TODAS, { variante: 'playback', soNoAparelho: true }, cap);
checar(!chaves(poolPBLocal).includes('album-4:b1'),
  'o "está no aparelho?" é por VARIANTE: a cantada baixada não vale pelo playback',
  chaves(poolPBLocal));

// ── 6. O sorteio: a preferência é ABSOLUTA, e as duas metades embaralham ────
// `rnd` fixo — é o que permite afirmar qualquer coisa aqui. Sem ele o teste só
// poderia contar itens, e a ORDEM é justamente o que decide se o culto espera
// um download.
const rndFixo = (() => { let i = 0; const v = [0.9, 0.1, 0.5, 0.3, 0.7, 0.2, 0.8, 0.4]; return () => v[i++ % v.length]; })();
const seis = S.sortear(poolTudo.itens, 4, rndFixo);
checar(seis.length === 4, 'o sorteio devolve exatamente o teto pedido', seis.length);
checar(seis.slice(0, poolTudo.noAparelho).every((i) => i.noAparelho),
  'O QUE JÁ ESTÁ NO APARELHO VEM PRIMEIRO — a fila não faz o culto esperar a rede',
  seis.map((i) => [i.s.id_music, i.noAparelho]));
const soDoisLocais = poolTudo.itens.filter((i) => i.noAparelho).slice(0, 2)
  .concat(poolTudo.itens.filter((i) => !i.noAparelho));
const cinco = S.sortear(soDoisLocais, 5, rndFixo);
checar(cinco.slice(0, 2).every((i) => i.noAparelho) && cinco.slice(2).some((i) => !i.noAparelho),
  'faltando baixadas para encher a fila, o resto vem do que precisa baixar');
checar(S.sortear([], 5, rndFixo).length === 0,
  'pool vazio devolve fila vazia — nunca um item indefinido a caminho do telão');
checar(S.sortear(poolTudo.itens, 0, rndFixo).length === 1,
  'quantidade zero ou negativa vira UMA — o botão nunca dispara para o nada');

// A SEGUNDA partição também embaralha. Sem isto o que completa a fila sai na
// ordem do acervo, isto é, sempre o mesmo álbum, e o recurso deixa de sortear
// exatamente onde ele mais importa (aparelho recém-configurado, nada baixado).
const soRemotos = poolTudo.itens.filter((i) => !i.noAparelho);
if (soRemotos.length >= 2) {
  const ordens = new Set();
  for (let k = 0; k < 40; k++) ordens.add(S.sortear(soRemotos, soRemotos.length).map((i) => i.s.id_music).join(','));
  checar(ordens.size > 1, 'a partição do que falta baixar TAMBÉM é embaralhada', [...ordens]);
} else {
  checar(false, 'o acervo de mentira precisa de 2+ faixas não baixadas para provar o embaralhamento');
}

// ── 7. A varredura enxerga alguma coisa ─────────────────────────────────────
// Verde por vácuo é indistinguível de varredor quebrado: se o acervo de mentira
// deixar de ser lido (um `cap` renomeado, um campo que sumiu), tudo acima passa
// por não achar nada em que reprovar.
checar(poolTudo.faixasVistas === 7,
  'a varredura leu as 7 faixas das 3 coleções aceitas — o teste não passa por vácuo',
  poolTudo.faixasVistas);
checar(poolTudo.itens.length > 0 && poolNatal.itens.length > 0 && poolGrat.itens.length > 0,
  'os três pools do teste têm conteúdo');

// ── N. OS INFANTIS SÃO UMA CATEGORIA: a faixa 508–557 do hinário NOVO ────
//
// O antigo filtro "Sem infantis" virou PARTIÇÃO (v1.12.53): o hinário novo se
// divide em "Hinário 2022" (sem os infantis) e "Infantis". Três modos de errar,
// e os três são silenciosos:
//   - **a ponta** — um intervalo exclusivo põe 508 ou 557 do lado errado, e o
//     operador recebe um infantil no meio do louvor sem nada que explique (é
//     também o sorteio do Modo Fácil, que sorteia "Hinário 2022" sem perguntar);
//   - **o hinário errado** — aplicar 508–557 ao Hinário 1996 tiraria cinquenta
//     hinos escolhidos ao acaso da categoria dele;
//   - **o buraco** — uma faixa que não está em categoria nenhuma some de toda
//     marca, e só aparece com nada marcado.
//
// FIXTURE PRÓPRIO: o acervo lá de cima é contado por asserção ("as 7 faixas"),
// e acrescentar faixas nele faria este bloco reprovar um caso que não é dele.
{
  const H2022 = { id: 'hymnal-2022', name: 'Hinário Adventista 2022', kind: 'hymnal' };
  const H1996 = { id: 'hymnal-1996', name: 'Hinário Adventista 1996', kind: 'hymnal' };
  const hino = (id, track, nome) => ({ id_music: id, track, name: nome,
    has_instrumental_music: false, semPlayback: true, fileIdFull: 'f-' + id });
  const ACERVO_I = {
    'hymnal-2022': [
      hino('n507', 507, 'O último antes da faixa'),
      hino('n508', 508, 'O primeiro infantil'),
      hino('n530', 530, 'Um infantil do meio'),
      hino('n557', 557, 'O último infantil'),
      hino('n558', 558, 'O primeiro depois da faixa'),
    ],
    // MESMO NÚMERO, hinário de 1996: ele numera outra coisa, e a faixa não vale
    // para ele. Sem este par, uma regra que ignorasse a coleção passaria.
    'hymnal-1996': [hino('v530', 530, 'Hino 530 do hinário de 1996')],
  };
  const capI = {
    ...cap,
    faixas: (coll) => ACERVO_I[coll.id] || [],
    noAparelho: () => true,
  };
  const TODAS_I = [H2022, H1996];
  const nums = (r) => r.itens.map((i) => i.s.track).sort((a, b) => a - b);

  const soH = S.montarPool(TODAS_I, { categorias: [S.CAT_HINARIO_2022] }, capI);
  checar(JSON.stringify(nums(soH)) === JSON.stringify([507, 558]),
    '"Hinário 2022" é o hinário novo SEM os infantis — e as duas pontas (508 e 557) '
    + 'ficam de fora, porque o intervalo é INCLUSIVO', JSON.stringify(nums(soH)));
  checar(soH.recusas[S.MOTIVO_CATEGORIA] === 3,
    'os três infantis são CONTADOS como fora das coleções marcadas — uma lista '
    + 'menor sem motivo é indistinguível de um defeito', JSON.stringify(soH.recusas));
  const soI = S.montarPool(TODAS_I, { categorias: [S.CAT_INFANTIS] }, capI);
  checar(JSON.stringify(nums(soI)) === JSON.stringify([508, 530, 557]),
    '"Infantis" é exatamente a faixa 508–557 do hinário novo', JSON.stringify(nums(soI)));
  checar(!soI.itens.some((i) => i.coll.id === 'hymnal-1996'),
    'e o 530 DO HINÁRIO DE 1996 não é infantil: a faixa é a numeração do NOVO',
    JSON.stringify(soI.itens.map((i) => i.coll.id + ':' + i.s.track)));
  const so96 = S.montarPool(TODAS_I, { categorias: [S.CAT_HINARIO_1996] }, capI);
  checar(JSON.stringify(so96.itens.map((i) => i.coll.id + ':' + i.s.track)) === JSON.stringify(['hymnal-1996:530']),
    '"Hinário 1996" é o de 1996, inteiro', JSON.stringify(nums(so96)));
  const tudo = S.montarPool(TODAS_I, {}, capI);
  checar(tudo.itens.length === 6 && tudo.itens.length === soH.itens.length + soI.itens.length + so96.itens.length,
    'SEM BURACO E SEM SOBRA: nada marcado traz as 6, e as três categorias somadas dão as mesmas 6',
    [tudo.itens.length, soH.itens.length, soI.itens.length, so96.itens.length].join(' · '));

  // A CAPACIDADE AUSENTE não pode quebrar a regra: um `cap` sem
  // `ehHinarioNovo` (um chamador antigo) não divide o hinário — e não lança.
  const semCap = S.montarPool(TODAS_I, {}, { ...capI, ehHinarioNovo: undefined });
  checar(semCap.itens.length === 6,
    'sem a capacidade `ehHinarioNovo` nada lança, e nada marcado continua sendo tudo',
    semCap.itens.length + ' item(ns)');

  // ── AS CATEGORIAS QUE A FOLHA OFERECE ──
  const disp = S.categoriasDisponiveis(TODAS.concat([H1996]),
    [{ id: 7, nome: 'Diversas' }, { id: 8, nome: 'CDs oficiais' }, { id: 7, nome: 'repetida' }], cap, true);
  checar(JSON.stringify(disp.map((d) => d.chave)) === JSON.stringify(
    [S.CAT_HINARIO_2022, S.CAT_HINARIO_1996, S.CAT_INFANTIS, 'col:7', 'col:8', S.CAT_OUTROS]),
    'a folha oferece os dois hinários e os infantis, depois as coletâneas na ordem dada '
    + '(sem repetir), e "outros" por último', JSON.stringify(disp.map((d) => d.chave)));
  checar(disp.find((d) => d.chave === 'col:7').faixas === 3 && disp.find((d) => d.chave === 'col:8').faixas === 1
    && disp.find((d) => d.chave === S.CAT_HINARIO_1996).faixas === 0,
    'cada uma diz quantas faixas INDEXADAS tem — zero é o que a tela apaga',
    JSON.stringify(disp.map((d) => [d.chave, d.faixas])));
  checar(!S.categoriasDisponiveis(TODAS, [], cap, false).some((d) => d.chave === S.CAT_OUTROS),
    '"outros" só existe quando há álbum sem coletânea');
}

console.log('\n' + (falhas.length ? falhas.length + ' FALHA(S)' : 'tudo certo'));
process.exit(falhas.length ? 1 : 0);
