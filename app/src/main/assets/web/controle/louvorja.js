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

  // O HOST do servidor de arquivos e o DOMÍNIO da origem, os dois DERIVADOS do
  // endereço acima e nunca digitados à parte: uma segunda escrita do mesmo
  // endereço divergiria no primeiro ajuste, e o que eles travam é segurança
  // (ver a guarda abaixo).
  //
  // O domínio são os TRÊS ÚLTIMOS RÓTULOS, porque o sufixo é de duas partes
  // (`com.br`) — a origem é brasileira e o endereço é constante deste arquivo,
  // então não há aqui uma regra geral de sufixo público a acertar. Muda o
  // endereço, muda a conta, e é por isso que ela é derivada e não digitada.
  const FILE_HOST = new URL(FILE_URL).host;
  const DOMINIO_ORIGEM = FILE_HOST.split('.').slice(-3).join('.');

  // "Este host é da ORIGEM?" — o PONTO é o que ancora a comparação. Sem ele,
  // `endsWith('louvorja.com.br')` aceitaria `evillouvorja.com.br`, que é a
  // invariante 2 do shell pelo outro lado do string.
  function daOrigem(host) {
    const h = String(host || '').toLowerCase();
    return h === DOMINIO_ORIGEM || h.endsWith('.' + DOMINIO_ORIGEM);
  }

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
  // **E O HOST É TRAVADO — NO DOMÍNIO DA ORIGEM, não num host exato** (v1.9.15).
  // Aceitar URL absoluta é deixar o JSON dizer PARA ONDE o `fetch` vai, e quem
  // busca é o WebView do orígin privilegiado; um endereço de fora cai no ramo de
  // sempre (vira caminho, dá 404 e entra no censo) em vez de virar um pedido
  // para fora — falha FECHADA, que é o lado certo aqui.
  //
  // **MAS TRAVAR NO HOST EXATO É ESTREITO DEMAIS, e o preço disso é MUDO:** a
  // origem serve o áudio e a imagem pelos campos do MESMO JSON, e nada a obriga
  // a servi-los pelo mesmo subdomínio. Um `url_image` em outro host da
  // louvorja.com.br era transformado em caminho, respondia 404, e o desfecho era
  // exatamente o relato — *"conseguiu baixar e usar as músicas, mas não está
  // vindo com as imagens de fundo"*: o áudio chega, o FUNDO da letra não, e nada
  // na tela liga uma coisa à outra. O domínio da origem é a fronteira certa —
  // ele continua impedindo o JSON de escolher um terceiro.
  //
  // **O PONTO É O QUE ANCORA A COMPARAÇÃO**, e tirá-lo é a invariante 2 pelo
  // outro lado: `endsWith('louvorja.com.br')` aceita `evillouvorja.com.br`, um
  // domínio que qualquer um registra.
  //
  // **NADA DE `encodeURI` NEM `encodeURIComponent`.** O `fetch` já percent-encoda
  // espaço e acento pelo path percent-encode set (MEDIDO: idêntico ao
  // `encodeURI` para estes caminhos), e re-encodar transforma `%` em `%25` —
  // que quebraria TODO download, inclusive os que hoje funcionam.
  function fileUrl(path) {
    if (!path) return path;
    const p = String(path);
    if (!/^https?:\/\//i.test(p)) return FILE_URL + p;
    try { return daOrigem(new URL(p).host) ? p : FILE_URL + p; }
    catch (_) { return FILE_URL + p; }
  }

  // **O ENDEREÇO É DE OUTRO HOST?** — quem CLASSIFICA, para quem precisa DIZER.
  //
  // A trava de host do `fileUrl` falha FECHADA, e isso está certo. Mas o que ela
  // produz é um pedido ao NOSSO host com um caminho absurdo, que responde 404 —
  // **indistinguível de "o arquivo não existe"** para quem lê o Registro. Um
  // diagnóstico que dá a mesma resposta para duas causas OPOSTAS (a origem mudou
  // de servidor × o arquivo sumiu) manda procurar no lugar errado.
  //
  // Ele CLASSIFICA e não decide: o `fileUrl` continua sendo quem escolhe o
  // destino, e este aqui só responde por que aquela escolha saiu como saiu.
  function foraDoServidor(path) {
    const p = String(path || '');
    if (!/^https?:\/\//i.test(p)) return false;
    try { return !daOrigem(new URL(p).host); } catch (_) { return true; }
  }

  global.Louvorja = {
    fetchList, fileUrl, foraDoServidor,
    HYMNAL_2022_FILE, HYMNAL_1996_FILE, CATEGORIES_FILE,
  };
})(this);
