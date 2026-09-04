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
//   - **aceitar demais** → um episódio de série (~300 MB) ou um hinário que o
//     filtro mandou tirar entra no lugar do louvor;
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
    // Casa pelo ÁLBUM: o nome da faixa não diz "natal" em lugar nenhum.
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

const cap = {
  norm,
  nomeNorm: (s) => norm(s.name),
  ehMusica: (coll) => coll.kind !== 'serie',
  ehHinario: (coll) => coll.kind === 'hymnal',
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
checar(S.sanear({ quantos: 7 }).quantos === S.QUANTIDADE_PADRAO,
  'uma quantidade fora da lista de tetos cai no padrão — não vira teto novo',
  S.sanear({ quantos: 7 }).quantos);
checar(S.sanear({ semHinario: 'sim' }).semHinario === false,
  'filtro com tipo errado é FALSO, não "verdadeiro porque tem conteúdo"');

// ── 2. A coleção: quem nem chega a ser varrida ──────────────────────────────
// A recusa da SÉRIE é a que mais custa se falhar: o item dela é um vídeo de
// ~300 MB e o `has_instrumental_music: false` faria o filtro "Playback"
// escondê-la por acidente — mas o filtro "Cantada" não.
const semSerie = S.avaliarColecao(SERIE, S.sanear({}), cap);
checar(!semSerie.entra && semSerie.motivo === S.MOTIVO_SEM_MUSICA,
  'a SÉRIE é recusada por não ser acervo de música, e o motivo sai nomeado', semSerie);
checar(S.avaliarColecao(ALBUM_VAZIO, S.sanear({}), cap).motivo === S.MOTIVO_SEM_INDICE,
  'coleção sem índice é recusada como "sem índice" — não como "sem música"');
checar(S.avaliarColecao(HINARIO, S.sanear({ semHinario: true }), cap).motivo === S.MOTIVO_HINARIO,
  'com o filtro ligado o hinário sai, e sai nomeado');
checar(S.avaliarColecao(HINARIO, S.sanear({}), cap).entra,
  'e sem o filtro ele entra — "não tocar do hinário" é OPÇÃO, não regra');
// A ORDEM das perguntas é contrato (é ela que o Registro imprime): uma série
// também não tem índice útil, e ainda assim o motivo é "não é acervo de música".
checar(S.avaliarColecao({ id: 'serie-x', name: 'x', kind: 'serie' },
  S.sanear({ semHinario: true }), { ...cap, faixas: () => [] }).motivo === S.MOTIVO_SEM_MUSICA,
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

// ── 4. O tema: os três lugares em que ele casa, na ordem ────────────────────
const poolNatal = S.montarPool(TODAS, { tema: 'natal' }, cap);
checar(chaves(poolNatal).includes('album-9:a1'),
  'o ÁLBUM prova o tema: "A Estrela do Oriente" entra pelo nome do álbum Natal');
checar(poolNatal.itens.find((i) => i.s.id_music === 'a1').casou === S.CASOU_ALBUM,
  '…e o veredito diz que foi pelo álbum', poolNatal.itens.find((i) => i.s.id_music === 'a1').casou);
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
checar(!chaves(S.montarPool(TODAS, { semHinario: true }, cap)).some((k) => k.startsWith('hymnal-')),
  '"não tocar do hinário" tira o hinário inteiro do pool');
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

// ── N. "SEM INFANTIS": a faixa 508–557 do hinário NOVO ─────────────────────
//
// Pedido do operador: *"ela restringe a inclusão das músicas 508 a 557 do novo
// hinário adventista. Ela vem ativa por padrão para não incluir as infantis"*.
//
// TRÊS modos de errar, e os três são silenciosos:
//   - **a ponta** — um intervalo exclusivo deixa 508 ou 557 passar, e o
//     operador recebe um infantil no meio do louvor sem nada que explique;
//   - **o hinário errado** — aplicar 508–557 ao Hinário 1996 recusa cinquenta
//     hinos escolhidos ao acaso, e a lista só fica "menor" sem dizer por quê;
//   - **o padrão** — o filtro nasce LIGADO, e um `sorteioPrefs` gravado por uma
//     versão anterior (que não tem o campo) não pode ressuscitá-lo desligado.
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
    // para ele. Sem este par, um filtro que ignorasse a coleção passaria.
    'hymnal-1996': [hino('v530', 530, 'Hino 530 do hinário de 1996')],
  };
  const capI = {
    ...cap,
    faixas: (coll) => ACERVO_I[coll.id] || [],
    ehHinarioNovo: (coll) => coll.id === 'hymnal-2022',
    noAparelho: () => true,
  };
  const TODAS_I = [H2022, H1996];
  const nums = (r) => r.itens.map((i) => i.s.track).sort((a, b) => a - b);

  // O PADRÃO — ninguém tocou em nada.
  checar(S.sanear(null).semInfantis === true,
    'SEM INFANTIS NASCE LIGADO: o padrão do app não sorteia hino infantil');
  checar(S.sanear({}).semInfantis === true,
    'e um objeto vazio também cai no ligado');
  // A ARMADILHA DO PADRÃO INVERTIDO: todo irmão deste filtro usa `=== true`, que
  // devolve `false` para um campo AUSENTE. Aqui isso ressuscitaria o filtro
  // desligado em todo aparelho que já tinha prefs gravadas — o operador
  // receberia infantis sem ter mexido em nada, e nada na tela diria por quê.
  checar(S.sanear({ semHinario: true, soNoAparelho: false }).semInfantis === true,
    'e prefs GRAVADAS POR UMA VERSÃO ANTERIOR (sem o campo) voltam com ele LIGADO',
    JSON.stringify(S.sanear({ semHinario: true })));
  checar(S.sanear({ semInfantis: false }).semInfantis === false,
    'quem o desligou de propósito continua com ele desligado');

  const ligado = S.montarPool(TODAS_I, { semInfantis: true }, capI);
  checar(JSON.stringify(nums(ligado)) === JSON.stringify([507, 530, 558]),
    'LIGADO, saem os três infantis do hinário novo — e as duas pontas (508 e 557) '
    + 'saem junto, porque o intervalo é INCLUSIVO', JSON.stringify(nums(ligado)));
  checar(ligado.itens.some((i) => i.coll.id === 'hymnal-1996' && i.s.track === 530),
    'e o 530 DO HINÁRIO DE 1996 continua entrando: a faixa é a numeração do NOVO',
    JSON.stringify(ligado.itens.map((i) => i.coll.id + ':' + i.s.track)));
  checar(ligado.recusas[S.MOTIVO_INFANTIL] === 3,
    'a recusa é CONTADA e NOMEADA — uma lista menor sem motivo é indistinguível '
    + 'de um defeito', JSON.stringify(ligado.recusas));

  const desligado = S.montarPool(TODAS_I, { semInfantis: false }, capI);
  checar(JSON.stringify(nums(desligado)) === JSON.stringify([507, 508, 530, 530, 557, 558]),
    'DESLIGADO, os infantis voltam inteiros — o filtro é uma escolha, não uma '
    + 'remoção do acervo', JSON.stringify(nums(desligado)));
  checar(!desligado.recusas[S.MOTIVO_INFANTIL],
    'e ninguém é recusado por ele');

  // A CAPACIDADE AUSENTE não pode quebrar a regra: um `cap` sem
  // `ehHinarioNovo` (um chamador antigo) desliga o filtro em vez de lançar.
  const semCap = S.montarPool(TODAS_I, { semInfantis: true },
    { ...capI, ehHinarioNovo: undefined });
  checar(semCap.itens.length === 6,
    'sem a capacidade `ehHinarioNovo` o filtro não age — e não lança',
    semCap.itens.length + ' item(ns)');
}

console.log('\n' + (falhas.length ? falhas.length + ' FALHA(S)' : 'tudo certo'));
process.exit(falhas.length ? 1 : 0);
