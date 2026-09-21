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

  // O HOST do servidor de arquivos, DERIVADO e nunca digitado à parte: uma
  // segunda escrita do mesmo endereço divergiria no primeiro ajuste, e o que
  // ela trava é segurança (ver a guarda abaixo).
  const FILE_HOST = new URL(FILE_URL).host;

  // Resolve o campo de mídia de um registro do banco (`url_music`,
  // `url_instrumental_music`, `url_image`) para a URL de download.
  //
  // ===== A ORIGEM PASSOU A DEVOLVER URL ABSOLUTA (v1.9.14) =====
  //
  // Ela devolvia CAMINHO (`/musics/123/cantado.mp3`) e a concatenação seca
  // bastava. Hoje ela devolve a URL inteira — MEDIDO no Registro do aparelho do
  // operador, que imprime o campo VERBATIM:
  //
  //   última: a fonte respondeu HTTP 404 —
  //   https://api.louvorja.com.br/file/musics/pt/Hinário Adventista 2022/Santo, Santo, Santo! - PB.mp3
  //
  // Concatenado, isso vira `…/file` + `https://…/file/musics/…`, e o parser de
  // URL não reclama: no PATH STATE o `:` e o `//` não são separadores, então o
  // pedido sai BEM-FORMADO, chega ao host certo e o servidor responde 404 —
  // **para 100% dos arquivos**. Era essa a falha universal do Registro: 1203
  // buscados, 0 gravados, 1203 recusados. O `json_db` não passa por aqui
  // (`fetchList` monta a sua própria URL), e é por isso que o índice, o catálogo
  // e cada `music_{id}` chegavam normalmente na MESMA sessão e na MESMA rede —
  // o que fazia o defeito parecer falta de internet, que é o que o app dizia.
  //
  // **AS DUAS FORMAS SÃO ACEITAS**, e não só a nova: o campo pode voltar a ser
  // caminho a qualquer momento (foi assim até aqui), e um app que só aceite a
  // forma de hoje quebra no dia em que a origem desfizer a mudança — pelo mesmo
  // caminho silencioso.
  //
  // **E O HOST É TRAVADO.** Aceitar URL absoluta é deixar o JSON dizer PARA ONDE
  // o `fetch` vai, e quem busca é o WebView do orígin privilegiado. Um host
  // estranho cai no ramo de sempre (vira caminho, dá 404 e entra no censo) em
  // vez de virar um pedido para fora — falha FECHADA, que é o lado certo aqui.
  //
  // **NADA DE `encodeURI` NEM `encodeURIComponent`.** O `fetch` já percent-encoda
  // espaço e acento pelo path percent-encode set (MEDIDO: idêntico ao
  // `encodeURI` para estes caminhos), e re-encodar transforma `%` em `%25` —
  // que quebraria TODO download, inclusive os que hoje funcionam.
  function fileUrl(path) {
    if (!path) return path;
    const p = String(path);
    if (!/^https?:\/\//i.test(p)) return FILE_URL + p;
    try { return new URL(p).host === FILE_HOST ? p : FILE_URL + p; }
    catch (_) { return FILE_URL + p; }
  }

  global.Louvorja = { fetchList, fileUrl, HYMNAL_2022_FILE, HYMNAL_1996_FILE, CATEGORIES_FILE };
})(this);
