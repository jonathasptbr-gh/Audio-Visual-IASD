#!/usr/bin/env node
// ============================================================================
// A CIFRA DO HINÁRIO GUARDADA NO APARELHO ABRE **SEM REDE**
//
// ## O que ele trava
//
// O download do hinário passou a trazer também as cifras (v1.1.28), guardadas
// em `cifras:<coleção>` no IndexedDB. A promessa é uma só, e é operacional: no
// sábado, com o Wi-Fi da igreja oscilando, a folha abre.
//
// **Uma promessa dessas falha CALADA.** Se a leitura do disco não acontecesse,
// o app cairia no caminho de rede e — com rede — a folha abriria do mesmo
// jeito, com a mesma aparência, pela porta errada. Ninguém veria diferença até
// o dia em que a rede não estivesse lá.
//
// Por isso a asserção não é "a folha apareceu": é **`cifraHtml` não foi
// chamado nenhuma vez**. A ponte de mentira CONTA as chamadas e responde
// `status 0` (sem rede) a todas — assim, se o disco não for lido, não há
// segundo caminho por onde a folha possa vir, e o caso reprova.
//
// A outra metade é o simétrico: uma música que NÃO está guardada tem de ir à
// rede. Sem ela, "nunca chamar a rede" passaria — e o recurso inteiro seria um
// cache que nunca preenche.
//
//   node tools/cifra-offline.test.mjs
// ============================================================================
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
};
const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const arquivo = path.join(RAIZ, p);
  if (!arquivo.startsWith(RAIZ) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
    res.writeHead(404); res.end('nao'); return;
  }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream' });
  fs.createReadStream(arquivo).pipe(res);
});

// A PONTE CONTA as chamadas de rede e responde "sem rede" a todas. É o
// instrumento do caso: com ela, a folha só pode vir do disco.
const PONTE = `(() => {
  window.__nCifraHtml = 0;
  const B = {
    shellVersion: () => 50,
    role: () => 'controle',
    appVersion: () => '1.98-teste',
    takeShare: () => '',
    busPost: () => {},
    otaConfirm: () => {},
    cifraHtml: (id, url) => {
      window.__nCifraHtml++;
      // Por padrão "sem rede" — é o instrumento dos casos de leitura do disco.
      // window.__rota permite a um caso mandar o site responder outra coisa
      // (sem crase: este bloco é um template literal).
      const r = (window.__rota && window.__rota(url)) || { status: 0, html: '' };
      setTimeout(() => { try { window.__avResolve(id, r); } catch (_) {} }, 0);
    },
  };
  const nomes = ['apkInstalar','apkProcurar','bgProgress','captureVolumeKeys','projecaoLocal','castTarget',
    'cifraDiag','deckDiscard','deckExportUrl','deckPages','displays','espelhoCertApagar',
    'espelhoCertEstado','espelhoCertImportar','espelhoDesligar','espelhoDiag','espelhoEstado',
    'espelhoLigar','keepAlive','listFolder','nowPlaying','openCast','openExternal','otaApply',
    'otaCheck','otaDiag','otaPending','pickDoc','pickFolder','requestMic','systemVolume',
    'temaClaro','ytCancel','ytCanalPlaylists','ytDiag','ytDiscard','ytFetch','ytFetchAte',
    'ytFetchAudio','ytPlaylist','ytSearch','ytStream','areaTransferencia','atualizacaoEstado'];
  for (const n of nomes) {
    if (B[n]) continue;
    B[n] = (...args) => {
      const id = args[0];
      if (typeof id === 'string') setTimeout(() => { try { window.__avResolve(id, null); } catch (_) {} }, 0);
      return undefined;
    };
  }
  window.__AVBridge = B;
})();`;

const falhas = [];
function checar(cond, msg, obtido) {
  if (cond) console.log('ok      ' + msg);
  else {
    console.log('FALHOU  ' + msg + (obtido !== undefined ? '\n        obtido: ' + JSON.stringify(obtido) : ''));
    falhas.push(msg);
  }
}

await new Promise((r) => servidor.listen(0, r));
const porta = servidor.address().port;
const navegador = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);
const pg = await ctx.newPage();
const base = `http://localhost:${porta}`;

try {
  await pg.addInitScript(PONTE);
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  // A MESMA espera do watchdog: plantar cenário antes do fim do `init()` é
  // correr contra a inicialização, que o zera com razão.
  await pg.waitForFunction(
    () => window.__NATIVE__ === true && window.AVDB && typeof window.__avBack === 'function'
      && !!document.querySelector('#playlist li'),
    null, { timeout: 30000 },
  );

  // QUEM GUARDA CIFRA — hoje, todo acervo de MÚSICA (v1.2.14). O corte é o
  // mesmo do `cifraCabe`: uma SÉRIE é testemunho em vídeo, e procurar cifra
  // dela é requisição garantidamente perdida.
  //
  // `cifraDeduzivel` continua existindo e responde OUTRA pergunta — quantas
  // requisições custa uma música. Confundir as duas foi o que manteve o
  // arquivo preso aos dois hinários.
  const guardavel = await pg.evaluate(() => ({
    hinario: cifraGuardavel({ id: 'hymnal-2022' }),
    album: cifraGuardavel({ id: 'qualquer-album' }),
    serie: cifraGuardavel({ id: 'serie-x', kind: 'serie' }),
    dedHinario: cifraDeduzivel({ id: 'hymnal-2022' }),
    dedAlbum: cifraDeduzivel({ id: 'qualquer-album' }),
  }));
  checar(guardavel.hinario === true, 'o Hinário 2022 guarda cifra');
  checar(guardavel.album === true, 'e um álbum comum TAMBÉM — o arquivo vale para o acervo inteiro');
  checar(guardavel.serie === false,
    'mas uma SÉRIE não: é vídeo, e a requisição seria perdida por construção');
  checar(guardavel.dedHinario === true && guardavel.dedAlbum === false,
    'e o endereço DEDUZÍVEL continua sendo só o dos hinários — outra pergunta', guardavel);

  // O GATILHO EXISTE FORA DO DOWNLOAD (v1.1.30). A v1.1.28 pendurou a busca no
  // fim do `syncCollection` — e um hinário JÁ COMPLETO faz aquela função
  // retornar em "Já completo offline" muito antes do gancho. MEDIDO em dois
  // Registros seguidos: `0 de 601` depois de o operador sincronizar. Quem
  // remover `syncCifrasAcervo` da rotina de abertura reproduz isso.
  checar(await pg.evaluate(() => typeof syncCifrasAcervo === 'function'),
    'existe um caminho que NÃO depende de o hinário estar sendo baixado');
  const naRotina = await pg.evaluate(() => /syncCifrasAcervo\(\)/.test(String(autoRefreshCollections)));
  checar(naRotina, 'e ele é chamado pela rotina de abertura, ao lado do syncLyrics', naRotina);

  // SEMEAR o disco como o download teria deixado.
  const semeou = await pg.evaluate(async () => {
    const chave = cifraChaveNoDisco('001. Hino De Marcador');
    await AVDB.setState('cifras:hymnal-2022', {
      [chave]: {
        url: 'https://www.cifraclub.com.br/novo-hinario-adventista/hino-de-marcador/',
        em: 1,
        pagina: {
          titulo: 'Hino De Marcador', artista: 'Novo Hinario', tom: 'G',
          linhas: [
            { tipo: 'acordes', texto: 'G       C' },
            { tipo: 'letra', texto: 'linha de marcador' },
          ],
        },
      },
    });
    cifraDiscoColl = ''; cifraDisco = null;   // força a releitura do disco
    return chave;
  });
  checar(!!semeou, 'o disco foi semeado com um hino', semeou);

  // A LEITURA, com a rede respondendo "sem rede" a tudo.
  const r = await pg.evaluate(async () => {
    const item = {
      id: 'h1', name: '001. Hino De Marcador', kind: 'audio',
      hymnAlbum: (allCollections().find((c) => c.id === 'hymnal-2022') || {}).name,
    };
    const antes = window.__nCifraHtml;
    cifraCache.clear();
    cifraGarantir(item);
    for (let i = 0; i < 100; i++) {
      const e = cifraCache.get(cifraChave(item));
      if (e && e.estado !== 'buscando') {
        return { estado: e.estado, tom: e.pagina && e.pagina.tom, rede: window.__nCifraHtml - antes };
      }
      await new Promise((res) => setTimeout(res, 50));
    }
    return { estado: 'nunca resolveu', rede: window.__nCifraHtml - antes };
  });
  checar(r.estado === 'ok', 'a folha abre com a rede toda respondendo "sem rede"', r);
  checar(r.tom === 'G', 'e é a folha guardada (o tom veio do disco)', r.tom);
  checar(r.rede === 0,
    'e NENHUMA requisição saiu — é isso, e não a folha na tela, que prova o offline', r.rede);

  // A OUTRA METADE: o que NÃO está guardado tem de ir à rede. Sem ela, "nunca
  // chamar a rede" passaria e o recurso seria um cache que nunca preenche.
  const r2 = await pg.evaluate(async () => {
    const item = {
      id: 'h2', name: '002. Outro Hino De Marcador', kind: 'audio',
      hymnAlbum: (allCollections().find((c) => c.id === 'hymnal-2022') || {}).name,
    };
    const antes = window.__nCifraHtml;
    cifraGarantir(item);
    for (let i = 0; i < 100; i++) {
      const e = cifraCache.get(cifraChave(item));
      if (e && e.estado !== 'buscando') return { estado: e.estado, rede: window.__nCifraHtml - antes };
      await new Promise((res) => setTimeout(res, 50));
    }
    return { estado: 'nunca resolveu', rede: window.__nCifraHtml - antes };
  });
  checar(r2.rede > 0, 'um hino NÃO guardado vai à rede', r2);
  checar(r2.estado === 'falha', 'e sem rede ele falha, em vez de inventar uma folha', r2.estado);

  // ---- A GRAVAÇÃO MESCLA; ELA NUNCA SUBSTITUI (v1.2.10) -------------------
  //
  // MEDIDO num aparelho: `275 de 601` virou `0 de 601`, e a cada abertura o app
  // recomeçava o download do zero. A gravação era `setState` do mapa INTEIRO a
  // partir de um slot de módulo cuja identidade mora noutra variável — bastava
  // o slot não ser o daquela coleção (ou ser `null`) para o acervo guardado ser
  // apagado por um `{}`.
  //
  // A asserção é a PROPRIEDADE, não o interleaving: **uma mescla não pode
  // produzir zero a partir de 275**. O cenário abaixo é o pior caso do defeito
  // — o slot de memória VAZIO na hora de gravar — e com a substituição de volta
  // ele reprova.
  const mesclou = await pg.evaluate(async () => {
    await AVDB.setState('cifras:hymnal-2022', {
      a: { pagina: { tom: 'A', linhas: [] }, url: 'u-a', em: 1 },
      b: { pagina: { tom: 'B', linhas: [] }, url: 'u-b', em: 1 },
      c: { pagina: { tom: 'C', linhas: [] }, url: 'u-c', em: 1 },
    });
    // O SLOT VAZIO: é o estado em que a substituição escrevia `{}` por cima.
    cifraDiscoColl = ''; cifraDisco = null;
    const novas = { d: { pagina: { tom: 'D', linhas: [] }, url: 'u-d', em: 2 } };
    await cifraDiscoMesclar('hymnal-2022', novas);
    const disco = (await AVDB.getState('cifras:hymnal-2022')) || {};
    return { chaves: Object.keys(disco).sort(), sobrouPendente: Object.keys(novas).length };
  });
  checar(mesclou.chaves.join(',') === 'a,b,c,d',
    'a gravação MESCLA: as três guardadas sobrevivem e a nova entra', mesclou.chaves);
  checar(mesclou.sobrouPendente === 0,
    'e o que foi para o disco sai da fila de pendentes — senão o lote seguinte o reenvia',
    mesclou.sobrouPendente);

  // E O SLOT DE LEITURA ACOMPANHA — quando é o DESTA coleção. Sem isto a aba
  // iria à rede por uma cifra que a passada acabou de guardar; e escrevê-lo sem
  // conferir de quem ele é seria o defeito original de novo, por outra porta.
  const slot = await pg.evaluate(async () => {
    const semDono = (cifraDiscoColl === 'hymnal-2022');   // ainda vazio: não é dela
    await cifraDiscoDe('hymnal-2022');                    // agora o slot é dela
    await cifraDiscoMesclar('hymnal-2022', {
      e: { pagina: { tom: 'E', linhas: [] }, url: 'u-e', em: 3 },
    });
    return { semDono, chaves: Object.keys(cifraDisco || {}).sort().join(',') };
  });
  checar(slot.semDono === false,
    'a mescla NÃO escreve num slot que é de outra coleção — era esse o defeito', slot.semDono);
  checar(slot.chaves === 'a,b,c,d,e',
    'e escreve no slot quando ele é o desta coleção', slot.chaves);
  // ---- "O SITE SÓ TEM A LETRA" É RESPOSTA, E ELA É GRAVADA (v1.2.10) ------
  //
  // MEDIDO numa bateria: ~12 das 85 falhas eram endereços que EXISTEM,
  // respondendo 200 sem folha nenhuma. Chamar isso de "não entendi" faz o
  // download do hinário rebater as mesmas músicas TODA sessão, para sempre.
  //
  // Gravar uma ausência é o que este arquivo mais teme — daí as DUAS defesas: o
  // marcador positivo (no `cifra.js`, com oráculo próprio) e o TETO por passada,
  // medido abaixo. Uma música sem cifra é um fato; um terço do hinário de uma
  // vez é o site tendo mudado de marcação.
  const passada = async (quantosSoLetra, total) => pg.evaluate(async (arg) => {
    await AVDB.setState('cifras:hymnal-2022', {});
    // O DIÁRIO TAMBÉM: uma passada recusada põe a coleção em prazo de sete
    // dias, e sem limpá-lo o cenário seguinte mede o prazo, não a regra.
    await AVDB.setState('cifras-passada:hymnal-2022', null);
    cifraDiscoColl = ''; cifraDisco = null; cifraSyncRodando = false;
    const nomes = Array.from({ length: arg.total }, (_, i) => 'Hino ' + (i + 1));
    collState['hymnal-2022'] = { songs: nomes.map((n, i) => ({ id_music: 'h' + i, name: n })) };
    const soLetra = new Set(nomes.slice(0, arg.quantos).map((n) => AVCifra.slug(n)));
    window.__rota = (url) => {
      const m = /\/novo-hinario-adventista\/([^/]+)\//.exec(url);
      if (!m) return { status: 404, html: '' };
      if (soLetra.has(m[1])) {
        return { status: 200, html: '<title>X (letra da música)</title><h1>X</h1><p>letra</p>' };
      }
      return { status: 200, html: '<h1>X</h1><pre><b>C</b>\nlinha de marcador\n</pre>' };
    };
    const coll = allCollections().find((c) => c.id === 'hymnal-2022');
    await syncCifrasColecao(coll);
    window.__rota = null;
    const disco = (await AVDB.getState('cifras:hymnal-2022')) || {};
    const vals = Object.values(disco);
    return { cifras: vals.filter((v) => v.pagina).length, semCifra: vals.filter((v) => v.semCifra).length };
  }, { quantos: quantosSoLetra, total });

  // ---- OS EXEMPLOS SOBREVIVEM À RECUSA (v1.2.18) -------------------------
  //
  // É a única coisa que sobrevive a uma passada recusada, e por isso a única
  // que permite investigá-la: nome, veredito e ENDEREÇO. Sem o endereço a lista
  // não serve para nada — é abrindo a página que se descobre se o erro é o
  // endereço que montamos ou a leitura que fazemos dele.
  const comExemplos = await pg.evaluate(async () => {
    await AVDB.setState('cifras:hymnal-2022', {});
    cifraDiscoColl = ''; cifraDisco = null; cifraSyncRodando = false;
    await AVDB.setState('cifras-passada:hymnal-2022', null);
    const nomes = Array.from({ length: 10 }, (_, i) => '00' + (i + 1) + '. Hino De Marcador ' + (i + 1));
    collState['hymnal-2022'] = { songs: nomes.map((n, i) => ({ id_music: 'h' + i, name: n })) };
    // TODAS voltam como página de letra — o caso que o teto recusava.
    window.__rota = () => ({
      status: 200, html: '<title>X (letra da música)</title><h1>X</h1><p>letra</p>',
    });
    const coll = allCollections().find((c) => c.id === 'hymnal-2022');
    await syncCifrasColecao(coll);
    window.__rota = null;
    const d = (await AVDB.getState('cifras-passada:hymnal-2022')) || {};
    const disco = (await AVDB.getState('cifras:hymnal-2022')) || {};
    return { diario: d, guardadas: Object.keys(disco).length };
  });
  checar(comExemplos.guardadas === 10,
    'uma passada TODA de páginas sem cifra GRAVA as dez — o teto que as recusava saiu '
    + '(v1.2.21): ele era estruturalmente errado, porque a passada só cobre o que FALTA '
    + 'e a proporção de ausências tende a 100% num acervo saudável', comExemplos.guardadas);
  checar(comExemplos.diario.semCifra === 10,
    'e o diário conta o que a passada de fato encontrou', comExemplos.diario);
  const ex = comExemplos.diario.exemplos || [];
  checar(ex.length > 0 && ex.length <= 12,
    'e ele guarda EXEMPLOS do que não saiu com folha', ex.length);
  checar(ex.every((e) => /^\d+\./.test(e.nome)),
    'com o NÚMERO do hino no nome — é por ele que o operador acha a página no site',
    ex.map((e) => e.nome));
  checar(ex.every((e) => /^https:\/\/www\.cifraclub\.com\.br\//.test(e.url)),
    'e com o ENDEREÇO tentado: sem ele não há como ver se o erro é o endereço ou a leitura',
    ex.map((e) => e.url));
  checar(ex.every((e) => e.motivo === 'sem-cifra'),
    'e o veredito de cada um', ex.map((e) => e.motivo));

  const poucas = await passada(2, 20);
  checar(poucas.cifras === 18 && poucas.semCifra === 2,
    'as duas sem cifra ficam GRAVADAS — é isso que impede a varredura de rebatê-las toda sessão',
    poucas);

  const dominada = await passada(18, 20);
  checar(dominada.cifras === 2 && dominada.semCifra === 18,
    'e uma passada DOMINADA por elas também grava — o que protege contra uma mudança '
    + 'de marcação do site não é a proporção, é o MARCADOR POSITIVO (sem o `<title>` '
    + 'anunciando a variante nada é gravado) e o PRAZO de 30 dias', dominada);

  // ---- A AUSÊNCIA TEM PRAZO, E É ELA QUE TORNA O ACERVO VARRÍVEL (v1.2.14) --
  //
  // No hinário toda música existe no site, e "não achei" era sempre defeito
  // nosso: nada era gravado, e a passada seguinte tentava de novo. No acervo de
  // álbuns a conta se inverte — MEDIDO na bateria, cerca de dois terços não
  // estão sob nenhum endereço deduzível. Sem memória, são milhares de
  // requisições a um site de terceiro EM TODA ABERTURA para redescobrir o mesmo.
  //
  // A resposta não é gravar para sempre nem não gravar: é gravar COM DATA.
  const prazo = await pg.evaluate(async () => {
    const agora = Date.now();
    const dia = 24 * 60 * 60 * 1000;
    return {
      // Uma FOLHA vale sempre: ela não envelhece, e rebaixá-la seria refazer o
      // download do acervo inteiro por um relógio.
      folhaVelha: cifraNoDiscoVale({ pagina: { linhas: [] }, em: agora - 900 * dia }, agora),
      // Uma ausência RECENTE poupa a cadeia inteira…
      ausenciaNova: cifraNoDiscoVale({ naoTem: true, em: agora - 3 * dia }, agora),
      // …e uma VENCIDA volta para a fila: o site pode ter publicado a cifra.
      ausenciaVelha: cifraNoDiscoVale({ naoTem: true, em: agora - 40 * dia }, agora),
      soLetraNova: cifraNoDiscoVale({ semCifra: 'letra', em: agora - dia }, agora),
      soLetraVelha: cifraNoDiscoVale({ semCifra: 'letra', em: agora - 40 * dia }, agora),
      vazio: cifraNoDiscoVale(null, agora),
    };
  });
  checar(prazo.folhaVelha === true, 'uma folha guardada NÃO vence — ela não envelhece', prazo);
  checar(prazo.ausenciaNova === true && prazo.ausenciaVelha === false,
    'uma ausência vale 30 dias e depois volta para a fila: o site pode ter publicado a cifra',
    prazo);
  checar(prazo.soLetraNova === true && prazo.soLetraVelha === false,
    'e o sem-cifra segue a mesma régua — nenhum veredito nosso vira buraco permanente', prazo);
  checar(prazo.vazio === false, 'nada guardado é nada guardado');

  // A OUTRA METADE: a ausência guardada RESPONDE, em vez de refazer a cadeia.
  // Sem isto a aba gasta quatro requisições para chegar à mesma frase que a
  // varredura já tinha escrito — com o instrumento na mão.
  const respondeDoDisco = await pg.evaluate(async () => {
    await AVDB.setState('cifras:hymnal-2022', {
      [cifraChaveNoDisco('001. Hino Sem Cifra')]: { semCifra: 'letra', url: 'u', em: Date.now() },
    });
    cifraDiscoColl = ''; cifraDisco = null;
    const coll = allCollections().find((c) => c.id === 'hymnal-2022');
    const antes = window.__nCifraHtml;
    const r = await cifraProcurar('001. Hino Sem Cifra', coll, 'k', {});
    return { motivo: r.motivo, via: r.via, rede: window.__nCifraHtml - antes };
  });
  checar(respondeDoDisco.motivo === 'sem-cifra' && respondeDoDisco.via === 'aparelho',
    'a ausência guardada responde com o motivo que a varredura achou', respondeDoDisco);
  checar(respondeDoDisco.rede === 0,
    'e SEM tocar na rede — é o que ela existe para poupar', respondeDoDisco.rede);

  // ---- A CADEIA NÃO GASTA O QUE JÁ FOI RESPONDIDO (v1.2.15) --------------
  //
  // MEDIDO num Registro real: um hino cujo endereço do CATÁLOGO respondeu
  // "só a letra" gastava mais três requisições — o álbum-como-artista e os dois
  // artistas padrão, todas 404 — para chegar ao MESMO veredito. Vezes as ~300
  // do Hinário 2022 que faltavam varrer.
  //
  // Duas podas, e as duas valem SÓ para a coleção do catálogo: ali o endereço é
  // deduzível de uma tabela, então aquela É a página do hino. Num álbum o
  // `sem-cifra` de um endereço não fecha a pergunta.
  const poda = await pg.evaluate(async () => {
    const coll = allCollections().find((c) => c.id === 'hymnal-2022');
    await AVDB.setState('cifras:hymnal-2022', {});
    cifraDiscoColl = ''; cifraDisco = null;
    const vistas = [];
    window.__rota = (url) => {
      vistas.push(url);
      if (/\/novo-hinario-adventista\//.test(url)) {
        return { status: 200, html: '<title>X (letra da música)</title><h1>X</h1><p>letra</p>' };
      }
      return { status: 404, html: '' };
    };
    const r = await cifraProcurar('001. Hino De Marcador', coll, 'k', { mudo: true, semDisco: true });
    window.__rota = null;
    return { motivo: r.motivo, via: r.via, vistas, tentativas: r.tentativas };
  });
  checar(poda.motivo === 'sem-cifra',
    'o catálogo responde a página de letra e esse é o veredito', poda.motivo);
  checar(poda.vistas.length === 1,
    'e a procura PARA ali: uma requisição, não quatro — o catálogo é autoridade '
    + 'sobre o hinário', poda.vistas);
  // E A SEGUNDA PODA precisa de um caso em que a cadeia CONTINUA — senão a
  // parada acima a esconde, e o oráculo aprovaria a remoção dela.
  const semNome = await pg.evaluate(async () => {
    const coll = allCollections().find((c) => c.id === 'hymnal-2022');
    const vistas = [];
    window.__rota = (url) => { vistas.push(url); return { status: 404, html: '' }; };
    await cifraProcurar('002. Outro Hino De Marcador', coll, 'k3', { mudo: true, semDisco: true });
    window.__rota = null;
    return vistas;
  });
  checar(semNome.length >= 2,
    'com o catálogo em 404 a cadeia CONTINUA — é o caso que exercita a poda abaixo',
    semNome);
  checar(!semNome.some((u) => /hinario-adventista-2022/.test(u)),
    'o nome do hinário NUNCA é adivinhado como artista: `/hinario-adventista-2022/` '
    + 'não existe no site, e seria um 404 certo por hino', semNome);

  // A OUTRA METADE: num ÁLBUM o `sem-cifra` de um endereço NÃO fecha a pergunta,
  // porque a mesma música pode estar cifrada sob outro artista. Sem ela, a poda
  // acima cortaria o acervo inteiro junto com o desperdício.
  const album = await pg.evaluate(async () => {
    const coll = { id: 'album-marcador', name: 'Album Marcador' };
    const vistas = [];
    window.__rota = (url) => {
      vistas.push(url);
      if (/\/album-marcador\//.test(url)) {
        return { status: 200, html: '<title>X (letra da música)</title><h1>X</h1><p>letra</p>' };
      }
      if (/\/ministerio-jovem\//.test(url)) {
        return { status: 200, html: '<h1>X</h1><pre><b>C</b>\nlinha de marcador\n</pre>' };
      }
      return { status: 404, html: '' };
    };
    const r = await cifraProcurar('Musica De Marcador', coll, 'k2', { mudo: true, semDisco: true });
    window.__rota = null;
    return { ok: r.ok, via: r.via, vistas };
  });
  checar(album.ok === true && album.via === 'padrao',
    'num ÁLBUM a cadeia continua depois de um sem-cifra — e acha a cifra sob outro artista',
    album);
  checar(album.vistas.length >= 2,
    'ou seja: ela gastou a requisição seguinte de propósito', album.vistas);

} finally {
  await navegador.close();
  servidor.close();
}

console.log('\n' + (falhas.length ? falhas.length + ' FALHA(S)' : 'tudo certo'));
process.exit(falhas.length ? 1 : 0);
