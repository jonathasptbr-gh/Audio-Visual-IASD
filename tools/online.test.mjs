#!/usr/bin/env node
// ============================================================================
// A COLETÂNEA DE VÍDEOS DO LOUVORJA — a regra que traduz canal → playlist →
// vídeo em coletânea → álbum → faixa
//
// ## Por que ele existe
//
// `controle/online.js` lê o payload de `GET /{lang}/collections/online` e
// devolve os álbuns que a Biblioteca desenha. O acervo é curado por OUTRO
// projeto, chega por uma rota que nada neste repositório controla, e **todos os
// modos de errar dele são MUDOS**:
//
//   · um vídeo ADOTADO pela playlist errada entra num álbum plausível, com
//     nome plausível, e só quem conhece o material percebe — no sábado;
//   · um vídeo PERDIDO some de uma lista que ninguém conta;
//   · a ordem entregue ao motor (o `NaN` de um `sequence` ausente) produz
//     listas DIFERENTES em dois aparelhos com o mesmo acervo, sem erro;
//   · um `coll.id` derivado do NOME muda no dia em que o curador corrige um
//     acento — e leva junto o vínculo com os downloads já feitos.
//
// ## E há um quinto, que é o pior porque parece o desfecho certo
//
// O payload vem VAZIO (`{channels:[],playlists:[],videos:[]}` é literalmente o
// que a réplica serve enquanto o bucket não foi preenchido) e a regra devolve
// zero álbuns, sem reclamar. Na tela isso é indistinguível de "o LouvorJA não
// publicou nada" — e é por isso que o DIÁRIO é metade desta regra, não um
// enfeite: são as contagens do payload ao lado das aceitas que separam *"veio
// pouco"* de *"recusamos muito"*.
//
// ## As metades, e nenhuma sozinha prova a regra
//
//  1. **A REGRA DE OURO** — o vínculo é `playlist_id` e NADA mais. Um vídeo
//     cujo título case com o nome de uma playlist, mas cujo `playlist_id` seja
//     desconhecido, é recusado. Afirmar só "o vídeo entrou" aprova uma adoção
//     por semelhança de título.
//  2. **A CONSERVAÇÃO** — o conjunto de ids desenhados é EXATAMENTE o de
//     entrada menos o dos recusados, e o diário nomeia cada baixa. Contar
//     aprova uma troca; conjuntos não.
//  3. **A ORDEM É TOTAL** — `sequence` manda, o que não tem vai para o FIM, e
//     o desempate é determinístico. Sem a terceira, a asserção passa num motor
//     e falha noutro.
//
// A rede NÃO entra aqui: este oráculo é de Node puro, roda no passo "Sanidade
// da base web" (antes do `npm ci`) e por isso não importa o arnês — ver o
// cabeçalho de `tools/checar.mjs`.
// ============================================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { checar, falhas } from './checar.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(raiz, 'app/src/main/assets/web/controle/online.js');
const SRC_SERIE = join(raiz, 'app/src/main/assets/web/controle/serie.js');
const SRC_COLET = join(raiz, 'app/src/main/assets/web/controle/coletanea.js');

// A mesma carga dos irmãos puros: a IIFE recebe o global pelo `this` do `.call`.
// Zero navegador — se um dia o arquivo passar a depender de `document`, isto
// falha alto, que é o que se quer.
const janela = {};
new Function(readFileSync(SRC, 'utf8')).call(janela);
const O = janela.AVOnline;

checar(!!O, 'o módulo publica AVOnline');
if (!O) { console.log('\n1 FALHA(S)'); process.exit(1); }

// ── AS ENTRADAS ─────────────────────────────────────────────────────────────
// Ids com a FORMA real: 11 caracteres base64url no vídeo, 34 na playlist, 24 no
// canal. Escritos à mão porque o ambiente desta sessão não alcança a rota (a
// política de egresso da organização recusa o CONNECT para os dois hosts do
// LouvorJA), e porque uma fixture capturada congelaria o acervo de uma tarde.
const CANAL_A = 'UCaaaaaaaaaaaaaaaaaaaaaa';
const CANAL_B = 'UCbbbbbbbbbbbbbbbbbbbbbb';
const PL_1 = 'PLaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const PL_2 = 'PLbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const PL_VAZIA = 'PLccccccccccccccccccccccccccccccc0';

const B64 = 'data:image/png;base64,iVBORw0KGgo=';
const URLIMG = 'https://i.ytimg.com/vi/vvvvvvvvvv1/default.jpg';

function payloadBase() {
  return {
    channels: [
      { channel_id: CANAL_B, title: 'Zeta Canal', custom_url: '@zeta', default_image: URLIMG, default_image_base64: B64 },
      { channel_id: CANAL_A, title: 'Alfa Canal', custom_url: '@alfa', default_image: URLIMG, default_image_base64: B64 },
    ],
    playlists: [
      { playlist_id: PL_1, channel_id: CANAL_A, title: 'Louvores 2026', default_image: URLIMG, default_image_base64: B64 },
      { playlist_id: PL_2, channel_id: CANAL_B, title: 'Corais', default_image: URLIMG, default_image_base64: B64 },
      { playlist_id: PL_VAZIA, channel_id: CANAL_A, title: 'Ainda sem vídeo', default_image: '', default_image_base64: '' },
    ],
    videos: [
      { video_id: 'vvvvvvvvvv2', playlist_id: PL_1, title: 'Segundo', sequence: 2, default_image: URLIMG, default_image_base64: B64 },
      { video_id: 'vvvvvvvvvv1', playlist_id: PL_1, title: 'Primeiro', sequence: 1, default_image: URLIMG, default_image_base64: B64 },
      { video_id: 'vvvvvvvvvv3', playlist_id: PL_2, title: 'Coral um', sequence: 1, default_image: URLIMG, default_image_base64: B64 },
    ],
  };
}

const base = O.lerCatalogo(payloadBase());
const porId = (r) => new Map(r.albuns.map((a) => [a.playlistId, a]));

// ── 1. A FORMA, e a hierarquia que ela declara ──────────────────────────────
checar(base.albuns.length === 2,
  'a playlist SEM vídeo não vira álbum (um card que abre vazio é pior que card nenhum)',
  base.albuns.map((a) => a.nome));
checar((base.diario.vazias || []).indexOf('Ainda sem vídeo') >= 0,
  'e ela é NOMEADA no diário — "não publicaram" e "recusamos" pedem ações opostas',
  base.diario.vazias);
checar(porId(base).get(PL_1).itens.length === 2 && porId(base).get(PL_2).itens.length === 1,
  'cada álbum recebe os vídeos da SUA playlist',
  base.albuns.map((a) => a.nome + ':' + a.itens.length));

// ── 2. A REGRA DE OURO: a playlist prova o pertencimento ────────────────────
//
// O vídeo abaixo tem o TÍTULO da playlist "Louvores 2026" dentro do nome e um
// `playlist_id` que não existe no payload. Adotá-lo por semelhança é o defeito
// que esta metade existe para reprovar — e é o defeito que o `serie.js` teve de
// aprender a evitar num canal de verdade.
{
  const p = payloadBase();
  p.videos.push({ video_id: 'vvvvvvvvvv9', playlist_id: 'PLnaoexistenaoexistenaoexiste0000', title: 'Louvores 2026 — faixa extra', sequence: 1 });
  const r = O.lerCatalogo(p);
  const todos = r.albuns.flatMap((a) => a.itens.map((i) => i.id));
  checar(todos.indexOf('vvvvvvvvvv9') < 0,
    'REGRA DE OURO: vídeo com playlist_id desconhecido NÃO é adotado, mesmo com o título da playlist no nome',
    todos);
  checar((r.diario.recusados || []).some((x) => x.motivo === O.MOTIVO_ORFAO),
    'e ele sai do diário como ÓRFÃO, com motivo próprio',
    r.diario.recusados);
}
// O `playlist_id: null` que o controlador devolve de verdade quando a relação
// do Eloquent não resolve — o mesmo caminho, por outra porta.
{
  const p = payloadBase();
  p.videos.push({ video_id: 'vvvvvvvvvv8', playlist_id: null, title: 'Sem playlist' });
  const r = O.lerCatalogo(p);
  checar(r.albuns.flatMap((a) => a.itens.map((i) => i.id)).indexOf('vvvvvvvvvv8') < 0,
    'e `playlist_id: null` (o que o CollectionController devolve de fato) cai na mesma recusa');
}

// ── 3. A CONSERVAÇÃO ────────────────────────────────────────────────────────
{
  const p = payloadBase();
  const entrada = new Set(p.videos.map((v) => v.video_id));
  const saida = base.albuns.flatMap((a) => a.itens.map((i) => i.id));
  const recusados = new Set((base.diario.recusados || []).map((x) => x.nome));
  checar(saida.length === new Set(saida).size,
    'nenhum vídeo é desenhado DUAS vezes dentro do conjunto de álbuns');
  const faltando = [...entrada].filter((id) => saida.indexOf(id) < 0 && !recusados.has(id));
  checar(faltando.length === 0,
    'CONSERVAÇÃO: todo vídeo do payload ou está num álbum, ou está nomeado no diário — nunca some calado',
    faltando);
  checar(base.diario.aceitos === saida.length,
    'e a contagem do diário é a MESMA lista (não uma segunda opinião)',
    { diario: base.diario.aceitos, desenhados: saida.length });
}

// ── 4. O MESMO VÍDEO EM DUAS PLAYLISTS entra nas duas ───────────────────────
//
// É legítimo e comum (um louvor no álbum do ano e numa coletânea temática), e é
// o oposto da duplicata DENTRO da mesma playlist, logo abaixo. Uma asserção só
// de "não duplica" aprovaria a regra que descarta este caso.
{
  const p = payloadBase();
  p.videos.push({ video_id: 'vvvvvvvvvv1', playlist_id: PL_2, title: 'Primeiro', sequence: 2 });
  const r = O.lerCatalogo(p);
  const m = porId(r);
  checar(m.get(PL_1).itens.some((i) => i.id === 'vvvvvvvvvv1')
      && m.get(PL_2).itens.some((i) => i.id === 'vvvvvvvvvv1'),
    'o MESMO vídeo em duas playlists entra nos DOIS álbuns (dois álbuns podem compartilhar uma faixa)');
}
{
  const p = payloadBase();
  p.videos.push({ video_id: 'vvvvvvvvvv1', playlist_id: PL_1, title: 'Primeiro (repetido)', sequence: 9 });
  const r = O.lerCatalogo(p);
  checar(porId(r).get(PL_1).itens.filter((i) => i.id === 'vvvvvvvvvv1').length === 1,
    'mas repetido DENTRO da mesma playlist entra uma vez só (o banco tem UNIQUE nesse par)');
}

// ── 5. A ORDEM É TOTAL, e o sem-`sequence` vai para o FIM ───────────────────
//
// A célula que separa a escrita certa da ingênua: `Number(undefined)` é `NaN`,
// `a.seq - b.seq` devolve `NaN`, e toda comparação com `NaN` é falsa — a ordem
// fica ENTREGUE AO MOTOR. Um comparador ingênuo passa numa lista pequena e
// produz listas diferentes em dois aparelhos com o mesmo acervo.
{
  const p = payloadBase();
  p.videos = [
    { video_id: 'vvvvvvvvvvC', playlist_id: PL_1, title: 'Zebra sem ordem' },
    { video_id: 'vvvvvvvvvvA', playlist_id: PL_1, title: 'Terceiro', sequence: 3 },
    { video_id: 'vvvvvvvvvvB', playlist_id: PL_1, title: 'Abacate sem ordem' },
    { video_id: 'vvvvvvvvvvD', playlist_id: PL_1, title: 'Primeiro', sequence: 1 },
  ];
  const itens = O.lerCatalogo(p).albuns[0].itens.map((i) => i.nome);
  checar(itens[0] === 'Primeiro' && itens[1] === 'Terceiro',
    'a ordem é por `sequence`, que é a ordem em que o curador montou a playlist', itens);
  checar(itens[2] === 'Abacate sem ordem' && itens[3] === 'Zebra sem ordem',
    'o que NÃO tem `sequence` vai para o FIM e desempata pelo NOME — nunca ao acaso do motor',
    itens);
  // A prova de que a ordem não depende da ordem de ENTRADA: o mesmo conjunto,
  // embaralhado, produz a mesma lista. É isto que o `NaN` quebra.
  const p2 = payloadBase(); p2.videos = p.videos.slice().reverse();
  checar(O.lerCatalogo(p2).albuns[0].itens.map((i) => i.nome).join('|') === itens.join('|'),
    'e ela é ESTÁVEL: o mesmo conjunto em outra ordem de entrada dá a mesma lista');
}

// ── 6. O `coll.id` É DERIVADO DO `playlist_id`, nunca do nome ───────────────
{
  const p = payloadBase();
  p.playlists[0].title = 'Louvores 2026 (corrigido)';
  const r = O.lerCatalogo(p);
  checar(porId(r).get(PL_1).id === porId(base).get(PL_1).id,
    'renomear a playlist NÃO muda o `coll.id` — ele nomeia a pasta do OPFS, e mudá-lo'
    + ' desligaria os downloads já feitos do card que os mostra',
    { antes: porId(base).get(PL_1).id, depois: porId(r).get(PL_1).id });
  checar(porId(base).get(PL_1).id === O.PREFIXO_ID + PL_1,
    'e ele é o prefixo mais o `playlist_id`, que é o que `ehDestaColetanea` reconhece');
  checar(O.ehDestaColetanea(porId(base).get(PL_1).id) && !O.ehDestaColetanea('serie-provai-vede-2026'),
    'ehDestaColetanea casa o prefixo desta coletânea e NÃO o das séries');
}

// ── 7. A FORMA DE UM ID: frouxa no comprimento, estrita no alfabeto ─────────
//
// A assimetria é deliberada e está no KDoc de `ehIdValido`. As duas metades são
// afirmadas porque afirmar só uma aprova o oposto da outra.
checar(O.ehIdValido('vvvvvvvvvv1') && O.ehIdValido('abcdefghijklm') && O.ehIdValido(PL_1),
  'FROUXA no comprimento: 11, 13 e 34 caracteres passam — travar o comprimento é apostar'
  + ' que o YouTube nunca o muda, e o preço dessa aposta é um vídeo que some no sábado');
checar(!O.ehIdValido('https://youtu.be/vvvvvvvvvv1') && !O.ehIdValido('a b') && !O.ehIdValido('<html>')
    && !O.ehIdValido('') && !O.ehIdValido('ab') && !O.ehIdValido(null),
  'ESTRITA no alfabeto: URL, espaço, HTML, vazio, curto demais e nulo são recusados'
  + ' — um deles vira um item que existe na lista e nunca baixa');
{
  const p = payloadBase();
  p.videos.push({ video_id: 'https://youtu.be/x', playlist_id: PL_1, title: 'URL no campo de id' });
  p.videos.push({ video_id: '', playlist_id: PL_1, title: 'Sem id nenhum' });
  const r = O.lerCatalogo(p);
  const motivos = (r.diario.recusados || []).map((x) => x.motivo);
  checar(motivos.indexOf(O.MOTIVO_ID_INVALIDO) >= 0 && motivos.indexOf(O.MOTIVO_SEM_ID) >= 0,
    'e os dois têm motivos DIFERENTES: "escreveram outra coisa" e "não escreveram nada"'
    + ' levam a consertos diferentes do lado do LouvorJA',
    motivos);
}

// ── 8. A PLAYLIST REPETIDA: fica a primeira, e a segunda é nomeada ──────────
{
  const p = payloadBase();
  p.playlists.push({ playlist_id: PL_1, channel_id: CANAL_B, title: 'Clone da primeira' });
  const r = O.lerCatalogo(p);
  checar(r.albuns.filter((a) => a.playlistId === PL_1).length === 1,
    'playlist repetida não vira DOIS cards com o mesmo `coll.id` disputando a mesma pasta do OPFS');
  checar(porId(r).get(PL_1).nome === 'Louvores 2026',
    'e quem fica é a PRIMEIRA', porId(r).get(PL_1).nome);
  checar((r.diario.recusadas || []).some((x) => x.motivo === O.MOTIVO_REPETIDA),
    'com a baixa nomeada no diário — a coluna é UNIQUE no banco, então isto é anomalia da origem');
}

// ── 9. CANAL AUSENTE NÃO RECUSA A PLAYLIST (falha ABERTA) ───────────────────
//
// É a regra 2 do `coletanea.js` aplicada aqui: o canal é só o SUBTÍTULO, e
// recusar por causa dele apagaria álbuns inteiros da Biblioteca em silêncio.
{
  const p = payloadBase();
  p.channels = [];
  const r = O.lerCatalogo(p);
  checar(r.albuns.length === 2,
    'sem canal nenhum no payload, as playlists CONTINUAM virando álbuns (falha aberta)',
    r.albuns.length);
  checar(r.albuns.every((a) => a.canal === ''),
    'e o subtítulo fica vazio, que é a única coisa que se perde');
}
{
  const p = payloadBase();
  p.playlists[0].channel_id = null;
  const r = O.lerCatalogo(p);
  checar(!!porId(r).get(PL_1), '`channel_id: null` numa playlist também não a derruba');
}

// ── 10. A ORDEM DOS ÁLBUNS: canal, depois nome; sem canal vai para o fim ────
{
  const p = payloadBase();
  p.playlists.push({ playlist_id: 'PLddddddddddddddddddddddddddddddd0', channel_id: 'UCnaoexiste000000000000', title: 'Aaa sem canal' });
  p.videos.push({ video_id: 'vvvvvvvvvv7', playlist_id: 'PLddddddddddddddddddddddddddddddd0', title: 'Um', sequence: 1 });
  const r = O.lerCatalogo(p);
  const nomes = r.albuns.map((a) => (a.canal || '(sem canal)') + '/' + a.nome);
  checar(nomes[0].startsWith('Alfa Canal') && nomes[1].startsWith('Zeta Canal'),
    'os álbuns saem agrupados por CANAL (alfabético), não intercalados pelo nome da playlist',
    nomes);
  checar(nomes[nomes.length - 1].startsWith('(sem canal)'),
    'e o álbum sem canal vai para o FIM — um grupo sem nome no meio da lista não se explica',
    nomes);
}

// ── 11. A MINIATURA, e o `data:` EMBUTIDO QUE NÃO É GUARDADO ────────────────
//
// O banco manda as duas formas da mesma imagem, e o embutido é recusado por
// TAMANHO: o catálogo lido vai para o IndexedDB com uma entrada por vídeo do
// acervo, e um `data:` URI por faixa multiplica o índice guardado por alguns kB
// cada — para comprar uma ilustração que a gaveta de detalhe dispensa.
checar(O.miniaturaDoVideo({ default_image: URLIMG, default_image_base64: B64 }) === URLIMG,
  'a faixa fica com a URL remota, nunca com o `data:` embutido, quando as duas vêm');
// **SEM RECUO PARA O EMBUTIDO**, e a razão é da ORIGEM, não uma preferência:
// `OnlineVideos.php` só escreve `default_image_base64` dentro do `isset` da
// MESMA URL que preenche o `default_image` — um registro com o embutido e sem a
// URL não existe. Um recuo aqui seria um ramo que nada alcança, e um comentário
// afirmando um caso que a origem não produz manda o próximo leitor proteger o
// lugar errado.
checar(O.miniaturaDoVideo({ default_image: '', default_image_base64: B64 }) === '',
  'sem URL não há miniatura: o embutido NUNCA é usado, nem como recuo'
  + ' (a origem não produz um sem o outro — conferido em OnlineVideos.php)');
checar(O.miniaturaDoVideo({ default_image: '', default_image_base64: '' }) === ''
    && O.miniaturaDoVideo(null) === '' && O.miniaturaDoVideo({}) === '',
  'o campo vazio é `\'\'` e não `null` no banco (o `?? \'\'` do OnlineVideos.php) — as duas formas devolvem \'\'');
// A ASSERÇÃO QUE FECHA O TAMANHO, e ela é sobre o que se GRAVA, não sobre a
// preferência: nenhum `data:` do payload pode aparecer no catálogo lido quando
// existe URL. O card não tem miniatura nenhuma (o quadrado dele é a SETA, desde
// a v5.244), então um `thumb` de álbum seria peso morto no IndexedDB de todo
// aparelho — e o modo de errar é MUDO, porque nada na tela mostraria a
// diferença.
{
  const bruto = JSON.stringify(base.albuns);
  checar(bruto.indexOf('data:image') < 0,
    'NADA de `data:` embutido entra no catálogo que vai para o IndexedDB — nem no álbum'
    + ' (que não desenha miniatura nenhuma) nem na faixa (que tem a URL)',
    bruto.slice(0, 200));
  checar(base.albuns.every((a) => !('thumb' in a)),
    'e o álbum não carrega campo de miniatura NENHUM: o quadrado do card é a seta',
    Object.keys(base.albuns[0] || {}));
}

// ── 12. A URL DO VÍDEO é a forma que o resto do app já consome ──────────────
checar(O.urlDoVideo('vvvvvvvvvv1') === 'https://www.youtube.com/watch?v=vvvvvvvvvv1',
  'a URL é `watch?v=`, a MESMA que busca, share e série entregam ao `ytFetch`'
  + ' — um segundo formato só daqui seria o primeiro a quebrar',
  O.urlDoVideo('vvvvvvvvvv1'));
checar(base.albuns[0].itens.every((i) => i.url === O.urlDoVideo(i.id)),
  'e é ela que viaja em cada faixa');

// ── 13. O DIÁRIO CONTA O PAYLOAD, não só o resultado ────────────────────────
//
// É a única referência EXTERNA da regra. Sem ela, "2 álbuns" não diz se vieram
// 2 ou 400 — e é essa diferença que separa "o LouvorJA não publicou" de "o app
// recusou", que é a pergunta inteira deste diagnóstico.
checar(base.diario.playlistsNoPayload === 3 && base.diario.videosNoPayload === 3
    && base.diario.canaisNoPayload === 2,
  'o diário registra o que o payload ANUNCIOU, antes de qualquer recusa',
  base.diario);
checar(base.diario.albuns === base.albuns.length,
  'e o que a regra produziu, pela mesma passada');
// A PROCEDÊNCIA. É a primeira pergunta diante de uma curadoria que parece
// errada, e o `@handle` é a única forma que uma PESSOA consegue conferir — o
// `channel_id` funciona e não se lê. Ela mora no DIÁRIO e não no catálogo
// guardado: é diagnóstico, não dado do acervo.
checar((base.diario.canais || []).length === 2
    && base.diario.canais.some((c) => c.nome === 'Alfa Canal' && c.arroba === '@alfa'),
  'o diário carrega os CANAIS com nome e `@handle` — a procedência, para o Registro',
  base.diario.canais);
checar(JSON.stringify(base.albuns).indexOf('@alfa') < 0,
  'e ela NÃO entra no catálogo guardado: é diagnóstico de uma busca, não dado do acervo',
  base.albuns[0]);

// ── 14. UM PAYLOAD TORTO NÃO LANÇA ─────────────────────────────────────────
//
// Lançar obrigaria todo chamador a um `try` e, pior, faria um campo renomeado
// do lado do LouvorJA derrubar a Biblioteca inteira em vez de esvaziar uma
// seção dela.
for (const ruim of [null, undefined, {}, [], 'nada', { channels: 'x', playlists: null, videos: 7 }]) {
  let r = null, lancou = false;
  try { r = O.lerCatalogo(ruim); } catch (_) { lancou = true; }
  checar(!lancou && r && Array.isArray(r.albuns) && r.albuns.length === 0 && !!r.diario,
    'payload torto (' + JSON.stringify(ruim) + ') devolve a MESMA forma, com zero álbuns, sem lançar');
}

// ── 15. O RÓTULO DE RESERVA: nada entra sem nome ────────────────────────────
{
  const p = payloadBase();
  p.videos.push({ video_id: 'vvvvvvvvvv5', playlist_id: PL_1, title: '', sequence: 9 });
  p.playlists[1].title = '';
  const r = O.lerCatalogo(p);
  const semNome = porId(r).get(PL_1).itens.find((i) => i.id === 'vvvvvvvvvv5');
  checar(!!semNome && semNome.nome.length > 0,
    'vídeo sem título entra com rótulo derivado do id — uma linha em branco é indistinguível de um defeito de desenho',
    semNome && semNome.nome);
  checar(porId(r).get(PL_2).nome.length > 0, 'e a playlist sem título também');
  checar((r.diario.semNome || []).length >= 2,
    'mas os dois são CONTADOS: um acervo inteiro sem nome é o sintoma de um payload lido pelo campo errado,'
    + ' e sem esta contagem ele chega como "funcionou"',
    r.diario.semNome);
}

// ── 16. `normalizar` continua idêntico às cópias irmãs ─────────────────────
//
// A duplicação entre os módulos puros é deliberada (módulo puro não importa
// módulo neste projeto); a DIVERGÊNCIA é o que não pode passar. Mesmo método do
// bloco final do `coletanea.test.mjs`.
{
  const corpo = (src) => {
    const t = readFileSync(src, 'utf8');
    const i = t.indexOf('function normalizar(');
    return i < 0 ? null : t.slice(i, t.indexOf('\n  }\n', i));
  };
  const meu = corpo(SRC), doSerie = corpo(SRC_SERIE), daColet = corpo(SRC_COLET);
  checar(!!meu && !!doSerie && !!daColet,
    'os três arquivos continuam declarando `normalizar` — se um parar, esta comparação vira'
    + ' um no-op silencioso e é ESTE checar que avisa');
  checar(meu === doSerie && meu === daColet,
    'e as três cópias são idênticas (a duplicação é deliberada; a divergência é o que não pode passar)',
    { online: meu, serie: doSerie, coletanea: daColet });
}

// ── 17. A IMPRESSÃO DA REGRA existe e é uma string estável ─────────────────
//
// É ela que invalida o catálogo guardado quando a REGRA muda sem a fonte mudar
// — a armadilha que mordeu as séries três vezes (o índice velho de pé para
// sempre, no IndexedDB, onde limpar o cache não alcança).
checar(typeof O.IMPRESSAO === 'string' && O.IMPRESSAO.length > 0,
  'a regra publica uma IMPRESSÃO, que é o que o `loadCollections` compara para descartar'
  + ' um catálogo guardado por uma versão anterior dela',
  O.IMPRESSAO);

console.log('');
if (falhas.length) {
  console.log(falhas.length + ' FALHA(S)');
  process.exit(1);
}
console.log('Todos passaram.');
