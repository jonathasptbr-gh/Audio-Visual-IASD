// A URL DE UM ARQUIVO DO LOUVORJA — as DUAS formas do campo, e o host travado.
//
// ## Por que ele existe
//
// A origem devolvia CAMINHO nos campos `url_music`/`url_instrumental_music`/
// `url_image` (`/musics/123/cantado.mp3`) e `fileUrl` concatenava seco. Ela
// passou a devolver a URL INTEIRA, e a concatenação virou
// `…/file` + `https://…/file/musics/…`.
//
// **O parser de URL não reclama disso.** No PATH STATE do WHATWG o `:` e o `//`
// não são separadores: o pedido sai bem-formado, chega ao host certo, e o
// servidor responde 404 — para TODOS os arquivos. MEDIDO no Registro do
// aparelho do operador: `1203 buscados · 0 gravados · 1203 recusados`, com
// `última: a fonte respondeu HTTP 404 — https://api.louvorja.com.br/file/…`
// (o campo impresso VERBATIM, já absoluto).
//
// E o `json_db` NÃO passa por `fileUrl` — `fetchList` monta a própria URL —,
// então o índice, o catálogo e cada `music_{id}` continuavam chegando na MESMA
// sessão e na MESMA rede. É isso que fazia o defeito parecer falta de internet.
//
// ## O que ele trava
//
// As duas formas aceitas (a nova E a antiga — a origem pode desfazer a mudança
// a qualquer momento, e um app que só aceite a de hoje quebra do mesmo jeito
// silencioso), o HOST travado (aceitar URL absoluta é deixar o JSON dizer para
// onde o `fetch` do WebView privilegiado vai), e a proibição de re-encodar.
//
//   node tools/louvorja-url.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { checar, falhas } from './checar.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..',
  'app', 'src', 'main', 'assets', 'web');

// O módulo é um IIFE sobre `this` e não tem `import`: roda num contexto de VM
// com o mínimo que ele toca. Assim o oráculo exercita O ARQUIVO, e não uma
// cópia da regra escrita aqui — que é o que ele existe para não ser.
const ctx = { URL, fetch: () => {}, Date, console };
ctx.globalThis = ctx;
vm.runInNewContext(fs.readFileSync(path.join(RAIZ, 'controle', 'louvorja.js'), 'utf8'),
  ctx, { filename: 'louvorja.js' });
const L = ctx.Louvorja;

const BASE = 'https://api.louvorja.com.br/file';

// ---- A FORMA ANTIGA (caminho) CONTINUA INTEIRA ---------------------------
// Sem esta metade o conserto vira uma troca de uma quebra por outra.
checar(L.fileUrl('/musics/123/cantado.mp3') === BASE + '/musics/123/cantado.mp3',
  'caminho relativo continua ganhando o prefixo — a forma que a origem usou até aqui',
  L.fileUrl('/musics/123/cantado.mp3'));

// ---- A FORMA NOVA (URL absoluta) PASSA INTACTA ---------------------------
const absoluta = 'https://api.louvorja.com.br/file/musics/pt/Hinário Adventista 2022/'
  + 'Santo, Santo, Santo! - PB.mp3';
checar(L.fileUrl(absoluta) === absoluta,
  'o campo que JÁ É uma URL do servidor de arquivos sai intacto — era ele que saía com o '
  + 'prefixo DOBRADO, e é essa a falha universal do Registro do operador',
  L.fileUrl(absoluta));

// E o desfecho que importa: a URL que vai ao fio deixa de ter o prefixo duas vezes.
const noFio = new URL(L.fileUrl(absoluta)).pathname;
checar(noFio.indexOf('/filehttps') !== 0,
  'e o caminho no fio não começa mais por "/filehttps://…" — o pedido que o servidor '
  + 'respondia 404 estava bem-formado, e é por isso que nada reclamava', noFio.slice(0, 70));
checar(noFio.startsWith('/file/musics/pt/'),
  'ele é o caminho do arquivo, e mais nada', noFio.slice(0, 40));

// `http://` do mesmo host também é do servidor de arquivos.
checar(L.fileUrl('http://api.louvorja.com.br/file/x.mp3') === 'http://api.louvorja.com.br/file/x.mp3',
  'e o esquema não decide — o que decide é o HOST',
  L.fileUrl('http://api.louvorja.com.br/file/x.mp3'));

// ---- O HOST É TRAVADO, E A FALHA É FECHADA -------------------------------
// Aceitar URL absoluta é deixar o JSON dizer PARA ONDE o `fetch` vai, e quem
// busca é o WebView do origin privilegiado. Um host estranho não pode virar um
// pedido para fora.
const estranho = 'https://evil.example.com/malware.mp3';
checar(L.fileUrl(estranho).indexOf('evil.example.com/') !== 0
  && !/^https?:\/\/evil\.example\.com/i.test(L.fileUrl(estranho)),
  'um host estranho NUNCA vira o destino do fetch — a guarda falha FECHADA, que é o lado '
  + 'certo quando quem escolheu o endereço foi o JSON', L.fileUrl(estranho));
checar(new URL(L.fileUrl(estranho)).host === 'api.louvorja.com.br',
  'ele cai no ramo de sempre: vira caminho do NOSSO host, dá 404 e entra no censo',
  new URL(L.fileUrl(estranho)).host);

// Uma URL absoluta malformada não pode explodir o download inteiro.
checar(typeof L.fileUrl('https://[não é url]/x.mp3') === 'string',
  'URL absoluta malformada não lança — ela cai no ramo de sempre');

// ---- VAZIO E NULO SAEM COMO ENTRARAM -------------------------------------
// `ensureSongVariant` decide "não existe na origem" por `!urlPath` (a regra
// `semFonte` da v5.134). Devolver `BASE` para um campo vazio faria o app pedir
// o diretório e a faixa nunca ficaria marcada.
checar(L.fileUrl('') === '' && L.fileUrl(null) === null && L.fileUrl(undefined) === undefined,
  'campo vazio sai vazio — é por `!urlPath` que a marca "não existe na origem" é decidida',
  JSON.stringify([L.fileUrl(''), L.fileUrl(null)]));

// ---- NADA É RE-ENCODADO --------------------------------------------------
// O `fetch` já percent-encoda espaço e acento pelo path percent-encode set;
// `encodeURI` por cima transforma `%` em `%25` e quebraria TODO download.
// MEDIDO aqui para a proibição não depender de memória.
const jaEncodado = 'https://api.louvorja.com.br/file/musics/pt/Hin%C3%A1rio/a.mp3';
checar(L.fileUrl(jaEncodado) === jaEncodado && L.fileUrl(jaEncodado).indexOf('%25') < 0,
  'um campo que JÁ vem percent-encodado sai intacto: re-encodar viraria `%` em `%25` e '
  + 'quebraria inclusive o que hoje funciona', L.fileUrl(jaEncodado));
checar(encodeURI('/musics/pt/Hin%C3%A1rio/a.mp3').indexOf('%25') > 0,
  'e a medição que sustenta a proibição: `encodeURI` sobre um caminho já codificado '
  + 'produz `%25`', encodeURI('/musics/pt/Hin%C3%A1rio/a.mp3'));

// ---- O QUE O PARSER FAZ COM O NOME DO ARQUIVO ----------------------------
// Com o caminho LEGÍVEL (`/musics/pt/<álbum>/<título>.mp3`) o título do hino
// entra na URL. Espaço, acento, vírgula e `!` são inofensivos; `?` e `#` NÃO
// são — eles abrem query e fragmento, e TRUNCAM o caminho sem erro nenhum.
//
// **NÃO HÁ CONSERTO AQUI, e a ausência é deliberada:** dado um `?` cru, o app
// não tem como distinguir "faz parte do nome" de "a origem quis mandar uma
// query", e re-encodar por segmento quebra o que já vem codificado (acima). O
// que este bloco trava é a MEDIÇÃO — quem vier consertar acha aqui o que já
// foi medido, em vez de refazer.
checar(new URL(BASE + '/pt/a/\'Stavas Lá?.mp3').pathname === '/file/pt/a/\'Stavas%20L%C3%A1',
  'um `?` no nome TRUNCA o caminho (o hino "\'Stavas Lá?" existe no acervo do operador) — '
  + 'medido, não consertado: qualquer saneamento aqui é adivinhação',
  new URL(BASE + '/pt/a/\'Stavas Lá?.mp3').pathname);
checar(new URL(BASE + '/pt/a/nº 1.mp3').pathname === '/file/pt/a/n%C2%BA%201.mp3',
  'e espaço e acento NÃO truncam: eles entram percent-encodados, que é o certo',
  new URL(BASE + '/pt/a/nº 1.mp3').pathname);

// ---- O DOMÍNIO DA ORIGEM, E NÃO UM HOST EXATO (v1.9.15) ------------------
// O relato que criou esta metade: *"conseguiu baixar, e usar as músicas, mas
// não está vindo com as imagens de fundo"*. Com a trava no host EXATO, um
// `url_image` servido por outro subdomínio da origem virava caminho, respondia
// 404, e o desfecho era o áudio chegando e o FUNDO não — sem nada na tela que
// ligasse as duas coisas.
const subdominio = 'https://files.louvorja.com.br/file/images/1.jpg';
checar(L.fileUrl(subdominio) === subdominio,
  'um subdomínio da ORIGEM passa intacto — é o que faz a imagem de fundo poder chegar '
  + 'quando ela não é servida pelo mesmo host do áudio', L.fileUrl(subdominio));
checar(L.fileUrl('https://louvorja.com.br/file/x.jpg') === 'https://louvorja.com.br/file/x.jpg',
  'e o domínio nu também é a origem', L.fileUrl('https://louvorja.com.br/file/x.jpg'));

// O PONTO É O QUE ANCORA — a invariante 2 do shell pelo outro lado do string.
const parecido = 'https://evillouvorja.com.br/x.jpg';
checar(!/^https?:\/\/evillouvorja/i.test(L.fileUrl(parecido)),
  'um domínio que apenas TERMINA no nome da origem não é a origem: sem o ponto ancorando, '
  + '`evillouvorja.com.br` — que qualquer um registra — seria destino do fetch privilegiado',
  L.fileUrl(parecido));

// ---- A CLASSIFICAÇÃO EXISTE PARA O REGISTRO PODER DIZER ------------------
// A trava falha FECHADA, e isso está certo; o que ela produz é um 404 do NOSSO
// host, indistinguível de "o arquivo não existe". `foraDoServidor` é quem
// separa as duas causas, que pedem ações opostas.
checar(L.foraDoServidor('/musics/123/cantado.mp3') === false,
  'um CAMINHO nunca é "de outro servidor" — ele nem escolhe host',
  L.foraDoServidor('/musics/123/cantado.mp3'));
checar(L.foraDoServidor(absoluta) === false && L.foraDoServidor(subdominio) === false,
  'nem o host de sempre, nem um subdomínio da origem',
  JSON.stringify([L.foraDoServidor(absoluta), L.foraDoServidor(subdominio)]));
checar(L.foraDoServidor(estranho) === true && L.foraDoServidor(parecido) === true,
  'e os dois que o `fileUrl` recusa são os dois que ele NOMEIA no censo',
  JSON.stringify([L.foraDoServidor(estranho), L.foraDoServidor(parecido)]));
checar(L.foraDoServidor('https://[não é url]/x.mp3') === true,
  'URL absoluta ilegível conta como de fora: ela não é do nosso servidor, e é isso que '
  + 'o Registro precisa dizer', L.foraDoServidor('https://[não é url]/x.mp3'));
checar(L.foraDoServidor('') === false && L.foraDoServidor(null) === false,
  'campo vazio não é falha de host nenhuma — quem responde por ele é a marca `semFonte`',
  JSON.stringify([L.foraDoServidor(''), L.foraDoServidor(null)]));

if (falhas.length) { console.error('\n' + falhas.length + ' falha(s).'); process.exit(1); }
console.log('\nTodos passaram.');
