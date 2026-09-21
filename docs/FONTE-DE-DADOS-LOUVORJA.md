# Fonte de dados LouvorJA — referência técnica

> **Para que serve este documento.** O **Audio Visual IASD** e o app **LouvorJA**
> (`app-ja`, Vue/Vuex) são projetos **independentes**, mas **compartilham o mesmo
> banco público de arquivos de multimídia** — o backend `api.louvorja.com.br`. O
> Audio Visual IASD já consome esse banco no recurso **Hinário Adventista 2022**
> (ver `public/controle/louvorja.js` e a seção "Hinário Adventista 2022" no
> `CLAUDE.md`).
>
> Este arquivo documenta **toda a estrutura técnica classificatória** dessa
> fonte de dados — endpoints, autenticação, convenção de nomes dos arquivos e o
> **schema de cada tipo de registro** — para que se possa **pedir qualquer tipo
> de arquivo que exista no sistema** sem precisar mais abrir/integrar o
> repositório do `app-ja`. É a fonte única de verdade do contrato de dados do
> lado do Audio Visual IASD.
>
> **Origem.** Extraído por engenharia reversa do `app-ja` (arquivos
> `src/helpers/Database.js`, `Path.js`, `Media.js`, os módulos `core/*` e o
> `.env.production`) e do cliente já em uso aqui (`public/controle/louvorja.js`).
> Campos marcados **✅ confirmado** são lidos por código real; **🔶 inferido**
> aparecem no fluxo mas sem uso direto verificado de todos os campos.

---

## Índice

1. [Endpoints, base URLs e autenticação](#1-endpoints-base-urls-e-autenticação)
2. [As duas superfícies de API](#2-as-duas-superfícies-de-api)
   - [2.1 `GET /{lang}/collections/online` — o catálogo de vídeos](#21-get-langcollectionsonline--o-catálogo-de-vídeos)
3. [Convenção de nomes dos arquivos do "banco" (`json_db`)](#3-convenção-de-nomes-dos-arquivos-do-banco-json_db)
4. [Servidor de arquivos de mídia (`file`)](#4-servidor-de-arquivos-de-mídia-file)
5. [Schemas por tipo de arquivo](#5-schemas-por-tipo-de-arquivo)
   - [5.1 `music_{id_music}` — registro completo de uma música/hino](#51-music_id_music--registro-completo-de-uma-músicahino)
   - [5.2 `album_{id_album}` — registro de um álbum/coletânea](#52-album_id_album--registro-de-um-álbumcoletânea)
   - [5.3 `{locale}_musics` — lista geral de músicas](#53-locale_musics--lista-geral-de-músicas)
   - [5.4 `{locale}_hymnal` e `{locale}_hymnal_1996` — listas de hinários](#54-locale_hymnal-e-locale_hymnal_1996--listas-de-hinários)
   - [5.5 `{locale}_categories` — coletâneas/categorias e álbuns](#55-locale_categories--coletâneascategorias-e-álbuns)
   - [5.6 Bíblia: `{locale}_bible_book`, `{locale}_bible_version`, `bible_{v}_{b}_{c}`](#56-bíblia-locale_bible_book-locale_bible_version-bible_v_b_c)
   - [5.7 `config` — versão do banco](#57-config--versão-do-banco)
6. [Formatos de valores (convenções de campo)](#6-formatos-de-valores-convenções-de-campo)
7. [Receita: como pedir/baixar qualquer arquivo](#7-receita-como-pedirbaixar-qualquer-arquivo)
8. [Cache, cache-busting e CORS](#8-cache-cache-busting-e-cors)
9. [Ressalvas e pontos não verificados](#9-ressalvas-e-pontos-não-verificados)

---

## 1. Endpoints, base URLs e autenticação

Duas raízes de URL, ambas no host `api.louvorja.com.br` (produção):

| Papel | Variável no app-ja | Produção | Desenvolvimento (app-ja) |
|---|---|---|---|
| **Banco** (JSON) | `VITE_URL_DATABASE` | `https://api.louvorja.com.br/json_db` | `http://localhost:7070/database` |
| **Arquivos** (mídia binária) | `VITE_URL_FILES` | `https://api.louvorja.com.br/file` | `http://localhost:7070` |
| **Token** | `VITE_API_TOKEN` | `02@v2nFB2Dc` | `02@v2nFB2Dc` |

- **Autenticação:** header **`Api-Token: 02@v2nFB2Dc`** em toda requisição ao
  banco. O token **já é público** no bundle de produção do app-ja (e no
  `louvorja.js` daqui) — **não é um segredo protegido**, é só um gate simples do
  backend. O servidor de arquivos (`/file`) é servido direto (sem header
  obrigatório observado).
- **Método:** sempre `GET`.
- **Cache-busting:** o app-ja anexa `?{YYYYMMDD}` (data de hoje, sem hífens) à
  URL do banco — ex: `.../json_db/pt_hymnal?20260718`. Serve só pra furar cache
  de CDN/navegador uma vez por dia. É opcional do ponto de vista do backend.
- **Resposta:** sempre **JSON** (um array ou um objeto, conforme o tipo — ver
  §5). Um `404`/erro significa "arquivo inexistente".

Já implementado aqui em `public/controle/louvorja.js`:

```js
const DB_URL   = 'https://api.louvorja.com.br/json_db';
const FILE_URL = 'https://api.louvorja.com.br/file';
const TOKEN    = '02@v2nFB2Dc';

async function fetchList(file) {                 // file: "pt_hymnal", "music_123"…
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const res = await fetch(`${DB_URL}/${file}?${date}`, { headers: { 'Api-Token': TOKEN } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}
function fileUrl(path) { return FILE_URL + path; } // path vem de url_music, url_image…
```

---

## 2. As duas superfícies de API

O mesmo backend expõe **duas** formas de acesso. **Use a primeira** — é a
canônica e a única totalmente verificada.

### (A) Banco estático `json_db/{arquivo}` — **✅ canônica**
Arquivos JSON "planos", nomeados por convenção (§3). É o que `Database.js` do
app-ja e o `louvorja.js` daqui usam. **Todo o resto deste documento descreve
esta superfície.**

### (B) Rotas REST `/{locale}/{recurso}` — **🔶 secundária/não confiável**
O módulo de chatbot do app-ja (`ChatScreen.vue`) chama rotas alternativas:
`GET /pt/categories`, `GET /pt/hymnal?limit=200`, além de `GET /json_db/pt_musics`.
O código do chatbot lê os campos com **muitos fallbacks** (`m.title || m.name`,
`h.number || h.num || h.numero`), o que indica que **o autor não tinha certeza
do schema** dessas rotas. Trate-as como **não documentadas/instáveis**; prefira
sempre a superfície (A). Ficam registradas aqui só para não serem "descobertas"
de novo por engano.

**MAS A RESSALVA É SOBRE AS ROTAS CURINGA, e uma delas é exceção declarada
(v1.8.97).** O que a torna instável é o mecanismo: elas são servidas por um
`/:lang/:collection` genérico, sem controlador próprio e sem schema escrito em
lugar nenhum. **`GET /{lang}/collections/online` não é uma delas** — ela tem
controlador próprio (`CollectionController@online`), anotação OpenAPI própria,
registro explícito em `routes/web.php` e teste próprio na réplica, e o schema
está no controlador campo a campo. **E não há escolha a fazer:** o catálogo de
vídeos do YouTube (as três tabelas `online_videos_*`) **não tem arquivo em
`json_db` nenhum** — conferido no mapa `COLLECTIONS` da réplica pública
(`louvorja/api-workers`), que lista musics, albums, categories, hymnal, lyrics,
files, albums_musics, categories_albums e languages e mais nada. A única outra
porta é a rota legada `/onlinevideos`, cujo formato PADRÃO é um dump de comandos
SQL separados por `|` para o app desktop em Pascal.

### 2.1 `GET /{lang}/collections/online` — o catálogo de vídeos

> **NÃO É CONSUMIDA POR ESTE APP** (desde a v1.8.98). Ela foi, por um lote: a
> v1.8.97 a transformou numa coletânea da Biblioteca e a v1.8.98 removeu o
> recurso a pedido do operador — *"se tornaram irrelevantes no meu app que já
> possui o sistema de busca direta no YouTube"*. **O recurso funcionava**: o
> Registro dele registrou 1150 vídeos em 16 playlists de 5 canais, nada
> recusado e nada perdido. O que não se sustentou foi a utilidade, não a rota.
>
> A seção FICA porque este arquivo é a referência do CONTRATO DE DADOS da
> fonte, não do que o app usa hoje — e porque o levantamento abaixo custou
> leitura do código-fonte do `louvorja/api`. Quem for reabrir a ideia começa
> daqui e não do zero.

Mesmo host, mesmo header `Api-Token` e mesmo cache-busting diário do
[fetchList]. Cache de 600 s no servidor; só registros `status = 'validated'`
são servidos.

```jsonc
{
  "channels":  [{ "channel_id", "title", "custom_url", "default_image", "default_image_base64" }],
  "playlists": [{ "playlist_id", "channel_id", "title", "default_image", "default_image_base64" }],
  "videos":    [{ "video_id", "playlist_id", "title", "sequence", "default_image", "default_image_base64" }]
}
```

**Quatro fatos do formato, lidos no código-fonte de `louvorja/api` e não
inferidos** — os três primeiros mudam quem consome:

| fato | consequência |
|---|---|
| `default_image` é uma URL absoluta do `i.ytimg.com` e cai em string **VAZIA**, nunca `null` (o `?? ''` de `app/Helpers/OnlineVideos.php`) | a guarda é `!img`, e um `img === null` deixa passar o vazio |
| `default_image_base64` é um `data:` URI da MESMA imagem (o thumbnail `default`, 120×90), embutido | desenha sem internet — e **custa tamanho em tudo o que for guardado**: um por vídeo multiplica um índice de mil itens por alguns kB cada. Quem consumir isto guarda a URL e recusa o embutido; e ele **nunca vem sozinho** (o `isset` que o preenche é o da MESMA URL), então não há recuo a escrever |
| `playlist.channel_id` e `video.playlist_id` podem vir **`null`** (o ternário `$x->relation ? … : null` do controlador) | o vídeo órfão é caso REAL, não hipótese; a playlist sem canal fica sem subtítulo, mas não pode ser recusada |
| `sequence` é a ordem dentro da playlist | pode FALTAR — e `Number(undefined)` é `NaN`, cujo comparador entrega a ordem ao motor |

**Hierarquia:** canal 1—N playlist 1—N vídeo, segmentada por `id_language`
(`pt`, `es`). `UNIQUE(id_online_video_playlist, video_id)` no banco, então o
mesmo vídeo em duas playlists é legítimo e comum; repetido dentro da mesma, não.

> **A réplica pública** (`https://api.louvorja.workers.dev`, `louvorja/api-workers`,
> Cloudflare Workers + R2) serve as mesmas rotas **sem token**, com
> `Access-Control-Allow-Origin: *`. Ela foi RECUSADA para este consumo e o
> motivo fica registrado: seria um HOST A MAIS, e um segundo nome DNS
> acrescenta um modo de falhar próprio na Wi-Fi de uma igreja (portal cativo,
> DNS filtrado, um `.dev` que um filtro de conteúdo barra) para um ganho de zero
> — o token já viaja no bundle desde o primeiro hino. Fica como **caminho de
> recuo** se um dia esta rota passar a exigir autenticação de verdade.

---

## 3. Convenção de nomes dos arquivos do "banco" (`json_db`)

Todo pedido é `GET {DB_URL}/{nome_do_arquivo}` (sem extensão `.json` na URL). Os
nomes seguem estas famílias. **`{locale}`** é o idioma: **`pt`** e **`es`**
confirmados (o app-ja só tem `pt`/`es`); provavelmente há outros no backend, mas
só esses dois são exercitados pelo cliente.

| Família | Nome do arquivo | Tipo raiz | Conteúdo | §  |
|---|---|---|---|---|
| **Lista de músicas** | `{locale}_musics` | `Array` | todas as músicas (leve) | 5.3 |
| **Lista Hinário 2022** | `{locale}_hymnal` | `Array` | hinos do Hinário Adventista 2022 | 5.4 |
| **Lista Hinário 1996** | `{locale}_hymnal_1996` | `Array` | hinos do Hinário 1996 | 5.4 |
| **Coletâneas/categorias** | `{locale}_categories` | `Array` | categorias → álbuns | 5.5 |
| **Lista de livros bíblicos** | `{locale}_bible_book` | `Array` | livros da Bíblia | 5.6 |
| **Lista de versões bíblicas** | `{locale}_bible_version` | `Array` | traduções/versões | 5.6 |
| **Registro de música** | `music_{id_music}` | `Object` | 1 música completa (áudio, letra, imagens) | 5.1 |
| **Registro de álbum** | `album_{id_album}` | `Object` | 1 álbum (faixas, categorias) | 5.2 |
| **Capítulo bíblico** | `bible_{id_version}_{id_book}_{chapter}` | `Object` | versículos de 1 capítulo | 5.6 |
| **Configuração** | `config` | `Object` | versão do banco | 5.7 |

**Regra mental:** nomes **sem** `id` no fim são **listas** (por idioma); nomes
`tipo_{id}` são **registros individuais**. Para buscar a mídia de fato (áudio,
capa), pega-se o `id` numa **lista**, busca-se o **registro** (`music_{id}`), e o
registro traz os **paths** que resolvem no servidor de arquivos (§4).

---

## 4. Servidor de arquivos de mídia (`file`)

Arquivos binários (áudios `.mp3`, imagens `.jpg`/`.png`, etc.) **não** ficam no
banco JSON. O banco guarda o ENDEREÇO deles em campos `url_*` (`url_music`,
`url_instrumental_music`, `url_image`), **em duas formas** — e quem resolve as
duas é `Louvorja.fileUrl`, com oráculo em `tools/louvorja-url.test.mjs`:

| o campo vem como | a URL final é |
|---|---|
| **caminho** (começa com `/`) | `{FILE_URL}{path}` → `https://api.louvorja.com.br/file{path}` |
| **URL absoluta** de um host de `louvorja.com.br` | **ela mesma**, sem prefixo nenhum |

Exemplos das duas, os dois observados em campo:
`"/musics/123/cantado.mp3"` → `https://api.louvorja.com.br/file/musics/123/cantado.mp3`;
`"https://api.louvorja.com.br/file/musics/pt/Hinário Adventista 2022/Santo, Santo, Santo! - PB.mp3"`
→ ela mesma.

> **O DESTINO É TRAVADO NO DOMÍNIO DA ORIGEM.** Aceitar URL absoluta é deixar o
> JSON dizer PARA ONDE o `fetch` do WebView privilegiado vai. Um endereço fora de
> `louvorja.com.br` **não** vira o destino do pedido: ele cai no ramo de caminho,
> dá 404 e entra no censo do Registro — falha FECHADA, **e com causa PRÓPRIA**
> (`foraDoServidor`), porque um 404 do nosso host é indistinguível de *"o arquivo
> não existe"*.
>
> **É o DOMÍNIO e não o host exato**, e a razão é o que a origem NÃO promete: ela
> serve áudio e imagem por campos do MESMO JSON, e nada a obriga a servi-los pelo
> mesmo subdomínio. Travado no host exato, um `url_image` noutro host dela vira
> caminho e dá 404 — o áudio chega e o FUNDO da letra não. **O ponto ancora a
> comparação:** sem ele, `endsWith('louvorja.com.br')` aceitaria
> `evillouvorja.com.br`.

- A **extensão** vem do NOME DO ARQUIVO, **nunca da URL inteira**: o host tem
  pontos, e `url.split('.').pop()` sobre uma URL absoluta sem extensão devolve um
  pedaço de CAMINHO — que vira árvore de diretórios no OPFS. Recorta-se o último
  segmento e **valida-se** o resultado (`extensaoDoArquivo`). Áudios costumam ser
  `.mp3`; imagens `.jpg`.
- **Sem cache-busting** por padrão nesses arquivos (são imutáveis por path).
- O tipo MIME real vem do `Content-Type`/`blob.type` da resposta (fallback
  usado aqui: `audio/mpeg` para áudio).

---

## 5. Schemas por tipo de arquivo

> Convenção: **✅ confirmado** = campo lido por código real (app-ja e/ou o
> `controle.js` daqui). **🔶 inferido** = presente no fluxo, mas nem todo campo
> teve leitura direta verificada. Campos que o backend possa ter além destes são
> ignoráveis para os fins do Audio Visual IASD.

### 5.1 `music_{id_music}` — registro completo de uma música/hino

Objeto único. É a peça central: traz o áudio, a letra sincronizada e as imagens.

| Campo | Tipo | Descrição | Status |
|---|---|---|---|
| `name` | `string` | nome/título da música | ✅ |
| `track` | `number` \| `string` | número da faixa/hino (quando aplicável) | ✅ |
| `duration` | `string` `"HH:MM:SS"` | duração do áudio **Cantado** | ✅ |
| `instrumental_duration` | `string` `"HH:MM:SS"` | duração do **Playback** | ✅ |
| `has_instrumental_music` | `0\|1` / bool | existe faixa instrumental (Playback)? | ✅ |
| `url_music` | `string` (path) | áudio **Cantado** (resolver via §4) | ✅ |
| `url_instrumental_music` | `string` (path) | áudio **Playback/instrumental** | ✅ |
| `url_image` | `string` (path) | imagem de **capa** da música | ✅ |
| `image_position` | `number` | posição da capa (grade 3×3, ver §6) | ✅ |
| `albums` | `Array<objeto>` | álbuns a que a música pertence (ver abaixo) | ✅ |
| `lyric` | `Object<idLinha, LinhaDeLetra>` | mapa das linhas de letra/slides | ✅ |

**`albums[]`** (dentro de `music_{id}` e também nas listas §5.3/5.4):

| Campo | Tipo | Descrição | Status |
|---|---|---|---|
| `id_album` | `number` | id do álbum | ✅ |
| `name` | `string` | nome do álbum | ✅ |
| `type` | `string` | tipo do álbum; ex.: `"hymnal"` para hinários | ✅ |
| `pivot.track` | `number`\|`string` | nº da faixa **dentro daquele álbum** | ✅ |
| `order` | `number` | ordem | 🔶 |
| `url_image` | `string` (path) | capa do álbum | 🔶 |
| `color` | `string` (hex) | cor de destaque do álbum | 🔶 |

**`lyric` — mapa `{ idDaLinha: objeto }`** (itere com `Object.values(...)`). Cada
linha:

| Campo | Tipo | Descrição | Status |
|---|---|---|---|
| `order` | `number` | ordem da linha (ordenar por isto) | ✅ |
| `show_slide` | `0\|1` | `1` = vira um slide projetável; `0` = ignorar | ✅ |
| `lyric` | `string` | texto da estrofe (com `<br>` literais — ver §6) | ✅ |
| `aux_lyric` | `string`\|null | rótulo auxiliar da seção (ex.: "Refrão") | ✅ |
| `time` | `string` `"HH:MM:SS"` | instante do slide na faixa **Cantado** | ✅ |
| `instrumental_time` | `string` `"HH:MM:SS"` | instante do slide na faixa **Playback** | ✅ |
| `url_image` | `string` (path)\|null | imagem de fundo **desta** linha | ✅ |
| `image_position` | `number` | posição da imagem desta linha (§6) | ✅ |

> **Regra de imagem "grudenta":** uma linha **sem** `url_image` **herda** a
> imagem da linha anterior (e, no início, a `url_image` de capa da música). É
> assim que o app-ja e o Audio Visual IASD montam o fundo de cada slide.
>
> **Slide de capa:** montado pelo cliente (não vem no `lyric`): tempo `0`, sem
> texto, usando `music.url_image`/`image_position`.

### 5.2 `album_{id_album}` — registro de um álbum/coletânea

| Campo | Tipo | Descrição | Status |
|---|---|---|---|
| `name` | `string` | nome do álbum | ✅ |
| `url_image` | `string` (path) | capa | ✅ |
| `color` | `string` (hex) | cor de destaque (ex.: `"#385F73"`) | ✅ |
| `musics` | `Array<objeto>` | faixas do álbum (ver abaixo) | ✅ |
| `categories` | `Array<string>` | categorias; itens podem ser `"hymnal.{moduleId}"` | ✅ |
| `albums` | — | **não existe aqui.** `setAlbumInfo` lê `albums[]` de **`music_{id}`** (os álbuns a que a MÚSICA pertence), não do registro do álbum — ver §5.1 | ✅ |

> **`subtitle` não é campo do álbum.** Ele só aparece em
> `{locale}_categories[].albums[]` (§5.5): é um campo do **pivô**
> categoria↔álbum, junto com `order`. O mesmo álbum pode ter subtítulo e ordem
> diferentes em cada categoria — é por isso que o app-ja **zera** o `subtitle`
> ao montar a visão "Todas as Coletâneas", onde os álbuns são deduplicados por
> `id_album` e a noção de categoria se perde
> (`src/modules/core/collections/interface/Index.vue`).

**`musics[]`** dentro de um álbum: `id_music`, `track`, `name`, `duration`,
`has_instrumental_music` — mesmos campos "leves" das listas (§5.3). ✅

> **Truque do hinário:** se `album.categories` contém uma string começando com
> `"hymnal."` (ex.: `"hymnal.hymnal"`), o app-ja **redireciona** a abertura do
> álbum para o **módulo de hinário** correspondente (`split('.')[1]`) em vez de
> renderizar o álbum como lista comum. Relevante só se você for mapear álbuns →
> hinários; para pedir arquivos avulsos, ignore.

### 5.3 `{locale}_musics` — lista geral de músicas

`Array` de objetos **leves** (sem letra nem URLs de mídia — essas só vêm em
`music_{id}`). Campos por item (✅):

| Campo | Tipo | Descrição |
|---|---|---|
| `id_music` | `number` | id (usar para buscar `music_{id}`) |
| `name` | `string` | nome |
| `duration` | `string` `"HH:MM:SS"` | duração |
| `has_instrumental_music` | `0\|1` | tem Playback? |
| `albums` | `Array` | álbuns (com `name`, `type`, `pivot.track` — §5.1) |
| `lyric`, `track` | — | usados como campos de busca no app-ja (podem estar presentes; a busca por `track` de hinário na verdade lê `albums[].pivot.track`) |

> A busca do app-ja (`DataTable.vue`) filtra por `name`, `lyric`, `albums_names`
> e `track`. Para `track`, quando o item tem `albums`, ela compara
> `albums[].pivot.track` **apenas** em álbuns cujo `type == "hymnal"`.
>
> ⚠️ **O próprio app-ja diverge aqui:** `DataTable.vue` lê `album.pivot.track`,
> mas `Media.js` (`setAlbumInfo`) lê `album.track` **direto**. Ou o backend
> manda os dois, ou um dos dois caminhos está quebrado lá. Quem for consumir
> deve aceitar os dois: `album.pivot?.track ?? album.track`.

### 5.4 `{locale}_hymnal` e `{locale}_hymnal_1996` — listas de hinários

`Array` de objetos. **Contrato já em uso neste repositório** (`fetchHymnalIndex`
em `controle.js` lê exatamente estes campos, ✅):

| Campo | Tipo | Descrição |
|---|---|---|
| `id_music` | `number` | id (usar para `music_{id}`) |
| `track` | `number`\|`string` | número do hino |
| `name` | `string` | título do hino |
| `duration` | `string` `"HH:MM:SS"` | duração do Cantado |
| `has_instrumental_music` | `0\|1` | tem Playback? |

- `pt_hymnal` = **Hinário Adventista 2022** (é o `Louvorja.HYMNAL_2022_FILE`).
- `pt_hymnal_1996` = **Hinário 1996** (mesma estrutura; integrado como coleção
  `hymnal-1996` — ver "Coleções de mídia (LouvorJA)" no CLAUDE.md).
- Cada item é um `music_{id_music}` "resumido" — a mídia real (áudio, letra,
  imagens) vem de `music_{id_music}` (§5.1).

### 5.5 `{locale}_categories` — coletâneas/categorias e álbuns

**A hierarquia do acervo é de dois níveis e só isso: categoria → álbum →
música.** Não existe grupo acima da categoria, nem subcategoria, nem
`id_parent` — verificado no código do app-ja (`src/modules/core/collections/`,
`src/helpers/Media.js`). O `module_group` que aparece em `src/store/state.js`
agrupa **módulos do app** na gaveta de aplicativos (`musics`/`bible`/
`utilities`), não álbuns.

A relação categoria↔álbum é **N:N**: o mesmo `id_album` aparece em `albums[]`
de mais de uma categoria (é por isso que o app-ja deduplica por `id_album` ao
montar "Todas as Coletâneas"). `subtitle` e `order` são campos do **pivô** —
variam conforme a categoria; `name`, `color` e `url_image` são cópias do
registro do álbum.

`Array` de **categorias**; cada uma agrupa **álbuns** (✅, do módulo
`collections`):

Campos da **categoria** efetivamente lidos pelo app-ja (✅): `id_category`,
`name`, `order` (ordena as categorias) e `albums`. **Não** há `url_image`,
`color`, `subtitle`, `type` nem `id_parent` na categoria — se o backend
enviar, o app ignora.

```jsonc
[
  {
    "id_category": 1,
    "name": "Nome da categoria",
    "order": 1,
    "albums": [
      {
        "id_album": 10,          // buscar detalhe em album_{id_album}
        "name": "Nome do álbum",
        "subtitle": "…",
        "url_image": "/…",       // resolver via §4
        "color": "#385F73",
        "order": 1
      }
    ]
  }
]
```

### 5.6 Bíblia: `{locale}_bible_book`, `{locale}_bible_version`, `bible_{v}_{b}_{c}`

- **`{locale}_bible_book`** — `Array` de livros. Campo-chave ✅: `id_bible_book`
  (+ `name`, e provavelmente nº de capítulos 🔶).
- **`{locale}_bible_version`** — `Array` de versões/traduções. Campo-chave ✅:
  `id_bible_version` (+ `name` 🔶).
- **`bible_{id_bible_version}_{id_bible_book}_{chapter}`** — versículos de **um
  capítulo**. Montado como `bible_{v}_{b}_{c}` (ex.: `bible_1_1_1`). Retorna um
  **mapa `{ numeroDoVersiculo: textoHTML }`** (o texto pode conter marcação; o
  app-ja renderiza com `v-html`). 🔶 O app deriva `scriptural_reference`/`text`
  no cliente — não são campos do arquivo.

### 5.7 `config` — versão do banco

Objeto de configuração. Campo confirmado ✅: **`version_number`** (o app-ja
exibe `packageJson.version + "." + version_number` no rodapé). Outros campos
podem existir, mas só `version_number` é lido.

---

## 6. Formatos de valores (convenções de campo)

- **Tempo (`time`, `instrumental_time`, `duration`, `instrumental_duration`)**:
  string `"HH:MM:SS"` (aceita menos partes, ex.: `"MM:SS"`). Converter pra
  segundos: preencher com zeros à esquerda até 3 partes e fazer `h*3600 + m*60 +
  s`. Vazio/inválido = "sem tempo" (**não** tratar como `0` — colidiria com o
  slide de capa). Ver `parseTimeToSeconds` em `controle.js`.
- **`image_position`**: inteiro que indexa uma **grade 3×3** de `background-position`
  (`object-position`), na ordem
  `[top-left, top-center, top-right, center-left, center-center, center-right,
  bottom-left, bottom-center, bottom-right]`. Default = centro. Serve pra ancorar
  a imagem de fundo do slide.
- **Campos `url_*`**: vêm em **DUAS formas**, e o app aceita as duas
  (`Louvorja.fileUrl`, oráculo `tools/louvorja-url.test.mjs`):
  - **caminho** começando com `/` — a URL final é `FILE_URL + path` (§4);
  - **URL absoluta** do próprio `api.louvorja.com.br` — usada COMO ESTÁ.

  > **A afirmação "nunca são URLs absolutas" estava aqui e DEIXOU DE SER
  > VERDADE.** MEDIDO em 2026-09-21 no Registro de um aparelho: o campo veio
  > `https://api.louvorja.com.br/file/musics/pt/Hinário Adventista 2022/…`.
  > Concatenado, isso dobra o prefixo, e **o parser de URL não reclama** (no
  > PATH STATE o `:` e o `//` não são separadores): o pedido sai bem-formado e o
  > servidor responde 404 para 100% dos arquivos. O `json_db` não passa por ali,
  > então o índice continua chegando — e o defeito se parece com falta de
  > internet. Ver a v1.9.14 no `HISTORICO.md`.

- **O caminho é LEGÍVEL, e isso põe o título do hino dentro da URL**
  (`/musics/pt/<álbum>/<título>.mp3`, em vez do `/musics/<id>/cantado.mp3`
  antigo). Espaço, acento, vírgula e `!` são inofensivos — o `fetch`
  percent-encoda o que precisa —, mas **`?` e `#` truncam a URL sem erro
  nenhum** (eles abrem query e fragmento). O acervo tem títulos assim
  (*"'Stavas Lá?"*). **Não há saneamento no app, e a ausência é deliberada:**
  dado um `?` cru não se distingue "faz parte do nome" de "a origem quis uma
  query", e re-encodar por segmento quebra o que já vem codificado (`%` →
  `%25`). O que existe é a CONTAGEM, no bloco "Download do acervo" do Registro.

- **Nada é re-encodado pelo app.** `encodeURI`/`encodeURIComponent` sobre um
  caminho que já tenha `%` o corrompem.
- **Quebras de linha na letra (`lyric`/`aux_lyric`)**: a API embute quebras
  **manuais** como tags **`<br>` literais** dentro do texto. O app-ja renderiza
  com `v-html`; aqui convertemos `<br>`/`<br/>`/`<br />` → `\n` real
  (`normalizeLyricText`) e usamos `white-space: pre-line` (sem `innerHTML`, sem
  risco de injeção). **Não** trate o texto como HTML confiável de forma geral.
- **Booleanos**: costumam vir como `0`/`1` (ex.: `show_slide`,
  `has_instrumental_music`). Normalize com `!!campo` ou `campo === 1`.
- **`categories[]` de álbum**: array de **strings**; itens `"hymnal.{id}"`
  sinalizam hinário (§5.2).

---

## 7. Receita: como pedir/baixar qualquer arquivo

Padrão único, reaproveitando `window.Louvorja` (já carregado no Controle):

```js
// 1) LISTA (achar ids) — ex.: hinos do Hinário 2022 ou músicas gerais
const hinos   = await Louvorja.fetchList('pt_hymnal');      // Array (§5.4)
const musicas = await Louvorja.fetchList('pt_musics');      // Array (§5.3)
const cats    = await Louvorja.fetchList('pt_categories');  // Array (§5.5)

// 2) REGISTRO (detalhe + paths de mídia) — ex.: uma música/hino específico
const rec = await Louvorja.fetchList('music_' + idMusic);   // Object (§5.1)
//    rec.url_music, rec.url_instrumental_music, rec.url_image, rec.lyric{...}

// 3) MÍDIA BINÁRIA (baixar de fato) — resolver o path no servidor de arquivos
const audioResp = await fetch(Louvorja.fileUrl(rec.url_music));   // §4
const audioBlob = await audioResp.blob();
const capaResp  = await fetch(Louvorja.fileUrl(rec.url_image));
const capaBlob  = await capaResp.blob();

// 4) (opcional) gravar offline no MESMO catálogo OPFS das pastas sincronizadas
//    AVDB.opfsWriteFile('folders/<pasta>/<arquivo>.mp3', audioBlob)
//    AVDB.fileAdd({ id, folder, opfsPath, name, type, kind:'audio', ... })
//    — ver downloadHymnalFile()/downloadHymnalSong() em controle.js como modelo.
```

Para **um tipo novo** (bíblia, álbum, coletânea), é o mesmo fluxo: monte o nome
do arquivo pela convenção da §3, `fetchList(nome)`, leia os campos pela §5 e,
se houver `url_*`, baixe via `fileUrl(path)`.

> Se algum arquivo precisar de um nome que `louvorja.js` ainda não conheça (ex.:
> `HYMNAL_2022_FILE`), **não** é preciso mudar o cliente — `fetchList('qualquer_nome')`
> já aceita qualquer string. Adicione constantes novas só por conveniência.

---

## 8. Cache, cache-busting e CORS

- **Cache-busting diário**: `?{YYYYMMDD}` na URL do banco (§1). Opcional; útil
  contra CDN preso.
- **Cache de sessão (app-ja)**: o `Database.js` guarda cada arquivo em
  `sessionStorage` (`db:{file}`) pra não rebaixar na mesma sessão. Réplica
  opcional aqui — o Audio Visual IASD hoje guarda o índice do hinário em
  `state.hymnal2022` (IndexedDB) e os binários no OPFS.
- **CORS** ⚠️: a API de produção precisa liberar CORS para a origin de quem
  chama — e **a origin do app não é a da página**. O que roda no aparelho é
  servido de `https://appassets.androidplatform.net/` (a invariante 1: contexto
  seguro, nunca `file://`); `audiovisualiasd.com.br` é só a página de download,
  e ela não faz chamada nenhuma à LouvorJA. Se o `fetch` falhar por CORS, a
  sincronização e a busca ao vivo param — a busca no que **já** foi baixado
  (OPFS/IndexedDB) continua funcionando offline.

---

## 9. Ressalvas e pontos não verificados

- **Idiomas**: só `pt` e `es` são exercitados pelo app-ja; outros locales podem
  existir no backend, mas não confirmados.
- **Superfície REST (`/pt/categories`, `/pt/hymnal?limit=200`)**: existe no
  chatbot do app-ja mas com schema **incerto** (código cheio de fallbacks). Não
  confie nela; prefira `json_db/*` (§2).
- **Campos 🔶 inferido**: aparecem no fluxo, mas nem todos tiveram leitura
  direta verificada em código — valide o JSON real ao usar um campo novo.
- **`bible_{v}_{b}_{c}`**: a forma exata (mapa `num→texto` vs. objeto com
  metadados) foi inferida do uso; confirmar contra o JSON real antes de depender
  de campos além dos versículos.
- **Token/URLs**: já públicos no bundle do app-ja; se o backend girar o token ou
  mudar as rotas, atualizar `public/controle/louvorja.js` **e** este documento.
- **Manutenção**: ao mexer em qualquer coisa de banco de dados no Audio Visual
  IASD, **este arquivo é a referência** — não é mais necessário abrir/integrar o
  `app-ja`. Se descobrir um campo/arquivo novo, registre-o aqui.
