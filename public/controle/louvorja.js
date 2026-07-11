// Cliente mínimo da API pública do LouvorJA (app-ja), usado só pelo Controle
// para sincronizar o catálogo do Hinário Adventista 2022 (ver seção
// "Hinário Adventista 2022 (LouvorJA)" no CLAUDE.md). Mesmas credenciais já
// públicas no bundle do app-ja (VITE_URL_DATABASE/VITE_URL_FILES/VITE_API_TOKEN
// de produção) — não é um segredo protegido, só reaproveitado aqui.
//
// Exposto como window.Louvorja.

(function (global) {
  'use strict';

  const DB_URL = 'https://api.louvorja.com.br/json_db';
  const FILE_URL = 'https://api.louvorja.com.br/file';
  const TOKEN = '02@v2nFB2Dc';

  // Nome do arquivo de lista do Hinário 2022 (módulo "hymnal", sem sufixo de
  // ano — o hinário de 1996 é "hymnal_1996"; ver CLAUDE.md).
  const HYMNAL_2022_FILE = 'pt_hymnal';

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

  global.Louvorja = { fetchList, fileUrl, HYMNAL_2022_FILE };
})(this);
