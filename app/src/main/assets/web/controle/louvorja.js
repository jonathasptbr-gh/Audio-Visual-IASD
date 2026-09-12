// Cliente mínimo da API pública do LouvorJA (app-ja), usado só pelo Controle
// para sincronizar as coleções de mídia — hinários e álbuns (ver seção
// "Coleções de mídia (LouvorJA)" no CLAUDE.md). Mesmas credenciais já
// públicas no bundle do app-ja (VITE_URL_DATABASE/VITE_URL_FILES/VITE_API_TOKEN
// de produção) — não é um segredo protegido, só reaproveitado aqui.
//
// Exposto como window.Louvorja.

(function (global) {
  'use strict';

  const DB_URL = 'https://api.louvorja.com.br/json_db';
  const FILE_URL = 'https://api.louvorja.com.br/file';
  // A RAIZ REST — a TERCEIRA superfície do mesmo backend, e a única em que o
  // catálogo de vídeos existe. Ver [fetchOnline].
  const API_URL = 'https://api.louvorja.com.br';
  const TOKEN = '02@v2nFB2Dc';

  // Nomes de arquivos de lista usados pelo sistema de coleções (ver seção
  // "Coleções de mídia (LouvorJA)" no CLAUDE.md e docs/FONTE-DE-DADOS-LOUVORJA.md).
  // Os hinários são módulos "hymnal"/"hymnal_1996"; os álbuns são descobertos
  // via "pt_categories". fetchList aceita qualquer nome — estas constantes são
  // só conveniência/documentação.
  const HYMNAL_2022_FILE = 'pt_hymnal';       // Hinário Adventista 2022
  const HYMNAL_1996_FILE = 'pt_hymnal_1996';  // Hinário Adventista 1996
  const CATEGORIES_FILE = 'pt_categories';    // catálogo de coletâneas → álbuns

  // Busca um arquivo do "banco" do LouvorJA (lista ou registro individual,
  // ex: "pt_hymnal" ou "music_123"). Mesmo formato do Database.js do app-ja:
  // header Api-Token + query string de cache-busting diário.
  async function fetchList(file) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const res = await fetch(`${DB_URL}/${file}?${date}`, {
      headers: { 'Api-Token': TOKEN },
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  // Resolve o caminho de um arquivo de mídia (áudio/imagem) vindo de um campo
  // do banco (ex: url_music) para a URL completa de download.
  function fileUrl(path) {
    return FILE_URL + path;
  }

  // ===== O CATÁLOGO DE VÍDEOS ONLINE (a coletânea de vídeos do YouTube) =====
  //
  // `GET /{lang}/collections/online` devolve, de uma vez, os três níveis da
  // curadoria de vídeos do LouvorJA:
  //
  //     { channels: […], playlists: […], videos: […] }
  //
  // Quem lê o payload é `controle/online.js` (a REGRA, pura, com oráculo);
  // aqui fica só o transporte, como manda a divisão que este projeto já faz
  // entre `CifraFonte.kt` e `cifra.js`.
  //
  // ## ELE NÃO ESTÁ EM `json_db`, E ISSO É UM FATO DA ORIGEM
  //
  // `docs/FONTE-DE-DADOS-LOUVORJA.md` §2 diz para preferir SEMPRE a superfície
  // (A), o banco estático `json_db/{arquivo}`, e tratar as rotas REST como
  // instáveis. **Aqui não há escolha a fazer:** as três tabelas de vídeo
  // (`online_videos_channels`, `online_videos_playlists`, `online_videos`) não
  // têm arquivo em `json_db` nenhum — conferido na réplica pública, cujo mapa
  // `COLLECTIONS` lista musics, albums, categories, hymnal, lyrics, files,
  // albums_musics, categories_albums e languages, e mais nada. A única outra
  // porta é a rota legada `/onlinevideos`, cujo formato PADRÃO é um dump de
  // comandos SQL separados por `|` para o app desktop em Pascal.
  //
  // **E a ressalva daquela seção não alcança esta rota.** O que ela descreve
  // são as rotas GENÉRICAS (`/pt/categories`, `/pt/hymnal`), servidas por um
  // curinga `/:lang/:collection` e lidas no app-ja com uma pilha de fallbacks
  // (`m.title || m.name`) que denuncia autor sem certeza do schema. Esta tem
  // CONTROLADOR PRÓPRIO (`CollectionController@online`), anotação OpenAPI
  // própria, registro explícito em `routes/web.php` e teste próprio na réplica.
  // O schema está escrito no controlador, campo a campo.
  //
  // ## POR QUE O HOST PRINCIPAL, E NÃO A RÉPLICA PÚBLICA
  //
  // Existe uma réplica de leitura sem token em `api.louvorja.workers.dev`
  // (Cloudflare Workers + R2), com as mesmas rotas e `Access-Control-Allow-Origin: *`.
  // Ela seria um token a menos — e um HOST A MAIS, que é o que decide:
  // este app já depende de `api.louvorja.com.br` para o hinário, a Bíblia e
  // todo o acervo de áudio, e um segundo nome DNS acrescenta um modo de falhar
  // PRÓPRIO na Wi-Fi de uma igreja (portal cativo, DNS filtrado, um domínio
  // `.dev` que um filtro de conteúdo barra) para um ganho de zero — o token já
  // viaja no bundle, público, desde o primeiro hino. A réplica fica
  // REGISTRADA aqui como o caminho de recuo se um dia esta rota passar a exigir
  // autenticação de verdade.
  //
  // Mesmo `Api-Token` e mesmo cache-busting diário do [fetchList]: é o mesmo
  // backend, e duas convenções de chamada para um host só é a divergência que
  // aparece no primeiro ajuste.
  async function fetchOnline(lang) {
    const l = String(lang || 'pt');
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const res = await fetch(`${API_URL}/${l}/collections/online?${date}`, {
      headers: { 'Api-Token': TOKEN },
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  global.Louvorja = {
    fetchList, fetchOnline, fileUrl,
    HYMNAL_2022_FILE, HYMNAL_1996_FILE, CATEGORIES_FILE,
  };
})(this);
