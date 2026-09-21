// O DOWNLOAD DE UMA COLEÇÃO DIZ A VERDADE SOBRE O QUE CHEGOU AO APARELHO.
//
// ## Por que ele existe
//
// O relato do operador: *"elas dão os tempos para baixar, e os progressos, mas
// depois continuam com o botão de download e não ficam disponíveis offline"*.
//
// Os quatro fatos eram um só defeito. `downloadCollectionSong` só devolvia
// `false` quando o `music_{id}` não vinha; **toda falha abaixo disso** — o
// servidor de arquivos mudo, um HTTP de erro, o disco recusando a gravação —
// era engolida por um `catch (_) { return null }` dentro de
// `downloadCollectionFile`, e a função voltava `undefined`. O laço de
// `syncCollection` lê `!== false`, então:
//
//   · `done` subia (ele conta TENTATIVAS) → a barra ia até o fim;
//   · `falhou` ficava em 0 → o rodapé escrevia "Atualizado (N baixado(s))";
//   · `ok: true` subia para `syncGroup` → o cabeçalho escrevia "Completo";
//   · e nenhum `fileIdFull` era escrito → `colecaoCompleta` continuava `false`,
//     **o botão de baixar continuava na tela e nada ficava offline**.
//
// Nada disso aparece num `node --check`: é um valor de retorno ausente, e o
// desfecho é uma tela que afirma o contrário do disco. MEDIDO antes do
// conserto, com o servidor de arquivos falhando e o banco respondendo:
// `{ ok: true, baixados: 3, falhou: 0 }` e "Atualizado (3 baixado(s))" com
// zero bytes gravados.
//
// ## O que ele trava
//
// As TRÊS causas separadas (cada uma pede uma ação diferente de quem lê), o
// caminho feliz intacto, a regra `semFonte` da v5.134 que NÃO pode regredir
// junto, o índice que deixa de apontar para registro que não existe, e o
// cabeçalho do grupo respondendo pela MESMA régua do botão.
//
//   node tools/download-do-acervo.test.mjs
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, checar, falhas, RAIZ_WEB, VIEWPORT } from './arnes.mjs';

const servidor = servirEstatico(RAIZ_WEB);
await new Promise((r) => servidor.listen(0, r));
const porta = servidor.address().port;
const navegador = await abrirNavegador();
const ctx = await navegador.newContext({ viewport: VIEWPORT });
await semRedeExterna(ctx);
const pg = await ctx.newPage();

try {
  await pg.goto(`http://localhost:${porta}/controle/`, { waitUntil: 'domcontentloaded' });
  // O SINAL DE BOOT FORTE, pela mesma razão do `acervo.test.mjs`: o `init()`
  // começa por `loadCollections()`, que faz `collState = {}` — plantar a
  // fixture antes disso é vê-la apagada no meio do percurso.
  await pg.waitForFunction(
    () => window.AVDB && typeof window.__avBack === 'function'
      && (!!document.querySelector('#playlist li') || document.getElementById('plBtn').disabled),
    null, { timeout: 30000 },
  );

  // O MODO AVANÇADO É PREMISSA DOS CASOS DO CARTÃO: no Modo Fácil sem telão o
  // `previewBusy` devolve um STUB com `falhar` no-op (lá quem avisa é outra
  // superfície), e uma asserção sobre o texto do cartão mediria o stub.
  await pg.evaluate(() => { appMode = 'full'; });

  // O ARNÊS DA FONTE: o banco (`json_db`) sempre responde — é ele que faz a
  // lista chegar e as estimativas aparecerem, que é o fato 2 do relato. Quem
  // varia é o servidor de ARQUIVOS (`/file`), que é onde os bytes moram.
  await pg.evaluate(() => {
    window.__fetchReal = window.fetch;
    window.__pedidos = 0;
    window.__pedidosImg = 0;
    window.__modo = 'ok';       // ok | semRede | recusa
    window.__modoImg = 'ok';    // ok | recusa   (a imagem de fundo da letra)
    window.__imagem = null;     // o campo `url_image` da fixture, quando há um
    window.__opfsQuebrado = false;
    const opfsReal = AVDB.opfsWriteFile;
    AVDB.opfsWriteFile = async (p, b) => {
      if (window.__opfsQuebrado) throw new DOMException('quota', 'QuotaExceededError');
      return opfsReal(p, b);
    };
    window.fetch = async (u, o) => {
      const s = String(u && u.url ? u.url : u);
      if (s.includes('api.louvorja.com.br/file')) {
        // A IMAGEM TEM MODO PRÓPRIO: o caso do relato é o áudio chegando e o
        // FUNDO não, e com um modo só ele não existe — os dois falhariam ou os
        // dois viriam, que é justamente o par que esconde o defeito.
        if (/\.(jpg|png|webp)$|\/imagens\//.test(s)) {
          window.__pedidosImg++;
          if (window.__modoImg === 'recusa') return new Response('', { status: 404 });
          return new Response(new Blob([new Uint8Array(64)], { type: 'image/jpeg' }), { status: 200 });
        }
        window.__pedidos++;
        if (window.__modo === 'semRede') throw new TypeError('Failed to fetch');
        if (window.__modo === 'recusa') return new Response('', { status: 404 });
        // OK: um mp3 de mentira, com bytes de verdade — é o `blob.size` que
        // alimenta o peso da coleção.
        return new Response(new Blob([new Uint8Array(2048)], { type: 'audio/mpeg' }), { status: 200 });
      }
      return window.__fetchReal(u, o);
    };
    // FAIXAS COM `url_music` (o caso normal) e uma SEM (a regra `semFonte` da
    // v5.134: "não existe na origem" ≠ "não baixei ainda").
    window.__semFonte = false;
    Louvorja.fetchList = async (file) => {
      // UMA FAIXA SÓ, para o caso do id órfão: a célula que ele mede é "este
      // álbum está completo?", e com três faixas as outras duas respondem por
      // si — a asserção passaria com e sem o conserto (uma tautologia).
      if (file === 'fonte-de-uma') {
        return { musics: [{ id_music: 101, track: 1, name: 'Hino A', duration: '00:03:30' }] };
      }
      if (file === 'fonte-de-teste') {
        return { musics: [
          { id_music: 101, track: 1, name: 'Hino A', duration: '00:03:30' },
          { id_music: 102, track: 2, name: 'Hino B', duration: '00:04:00' },
          { id_music: 103, track: 3, name: 'Hino C', duration: '00:03:00' },
        ] };
      }
      const id = Number(String(file).replace('music_', ''));
      // O CAMINHO TEM A FORMA DO DE VERDADE: o LouvorJA devolve
      // `/musics/pt/<Álbum>/<Música>.mp3`, com ESPAÇO e ACENTO crus — e é essa
      // forma que faz a URL do fio diferir do caminho do banco, que é o que o
      // Registro passou a mostrar. Um caminho só de ASCII esconderia a
      // diferença e a asserção passaria por não ter o que medir.
      const caminho = '/musics/pt/Hinário de Teste 2022/Hino ' + id + ' - PB.mp3';
      return {
        id_music: id,
        url_music: window.__semFonte ? '' : caminho,
        url_image: window.__imagem, has_instrumental_music: false,
        lyric: { 1: { show_slide: 1, order: 1, lyric: 'linha', time: '00:00:10' } },
      };
    };
  });

  // Um álbum novo por caso: `syncCollection` é aditiva e resumível de
  // propósito, então reusar o mesmo id faria o segundo caso partir do que o
  // primeiro deixou — e o teste mediria a retomada, não a causa.
  const rodar = async (id, preparar) => pg.evaluate(async ([cid, prep]) => {
    // eslint-disable-next-line no-new-func
    new Function(prep)();
    window.__pedidos = 0;
    const coll = { id: cid, name: 'Álbum ' + cid, kind: 'album', source: 'fonte-de-teste' };
    collState[cid] = { indexSyncedAt: 0, songs: [] };
    const antes = JSON.parse(JSON.stringify({
      semRede: acervoCenso.semRede, recusadas: acervoCenso.recusadas, semEspaco: acervoCenso.semEspaco,
    }));
    const devolveu = await syncCollection(coll, { allowMobile: true });
    return {
      pedidos: window.__pedidos,
      devolveu,
      status: ui(cid).status,
      completa: colecaoCompleta(cid),
      falta: faltamNaColecao(cid),
      ids: collSongs(cid).map((s) => s.fileIdFull || null),
      grupo: grupoCompleto([{ id: cid }]),
      censo: {
        semRede: acervoCenso.semRede - antes.semRede,
        recusadas: acervoCenso.recusadas - antes.recusadas,
        semEspaco: acervoCenso.semEspaco - antes.semEspaco,
      },
      registro: blocoAcervo(),
    };
  }, [id, preparar]);

  // ---- A: O SERVIDOR DE ARQUIVOS NÃO RESPONDE -----------------------------
  // O caso do relato. O banco respondeu (a lista chegou), os bytes não vieram.
  const a = await rodar('t-semrede', "window.__modo='semRede'; window.__opfsQuebrado=false; window.__semFonte=false;");
  checar(a.pedidos === 3, 'o download foi de fato buscar os três arquivos', a.pedidos);
  checar(a.devolveu && a.devolveu.ok === false,
    'nenhum byte chegou: a sincronização devolve ok:FALSE — era `ok:true`, e era isso que fazia '
    + 'o cabeçalho do grupo escrever "Completo"', JSON.stringify(a.devolveu));
  checar(a.devolveu.baixados === 0 && a.devolveu.falhou === 3,
    'e a conta é a do DISCO: 0 baixadas, 3 falhas — `done` conta tentativas, e era ele que subia sozinho',
    JSON.stringify(a.devolveu));
  checar(/0 baixado/.test(a.status) && /sem rede/.test(a.status),
    'o rodapé do card diz 0 e NOMEIA a causa (era "Atualizado (3 baixado(s))")', a.status);
  checar(!a.completa && a.falta === 3 && a.ids.every((x) => x === null),
    'e o índice não inventa id nenhum: o botão de baixar continua — agora com o rodapé explicando por quê',
    JSON.stringify(a.ids));
  checar(a.censo.semRede === 3 && a.censo.recusadas === 0 && a.censo.semEspaco === 0,
    'o censo separa a causa: três "sem rede", nenhuma das outras duas', JSON.stringify(a.censo));

  // ---- B: A FONTE RECUSA (HTTP de erro) -----------------------------------
  // Outra causa, outra AÇÃO: aqui esperar o Wi-Fi não resolve nada — o endereço
  // do arquivo mudou na origem, e é isso que a frase tem de dizer.
  const b = await rodar('t-recusa', "window.__modo='recusa'; window.__opfsQuebrado=false; window.__semFonte=false;");
  checar(b.devolveu.ok === false && b.devolveu.falhou === 3,
    'a fonte respondendo com erro também é falha, não sucesso', JSON.stringify(b.devolveu));
  checar(/recusada/.test(b.status) && !/sem rede/.test(b.status),
    'e a frase é OUTRA: "recusada(s) pela fonte" — "sem rede" mandaria esperar um Wi-Fi que não resolve',
    b.status);
  checar(b.censo.recusadas === 3 && b.censo.semRede === 0,
    'o censo conta na coluna certa', JSON.stringify(b.censo));

  // ---- C: O APARELHO RECUSA GRAVAR ----------------------------------------
  // A terceira, e a que mais se parece com "está tudo bem": a rede responde,
  // os bytes chegam, e o disco é que não os aceita.
  const c = await rodar('t-espaco', "window.__modo='ok'; window.__opfsQuebrado=true; window.__semFonte=false;");
  checar(c.devolveu.ok === false && c.devolveu.falhou === 3,
    'o disco recusando a gravação é falha — a rede respondeu, e o arquivo não existe assim mesmo',
    JSON.stringify(c.devolveu));
  checar(/espaço/.test(c.status),
    'e a frase diz ESPAÇO, não rede: as duas pedem ações opostas', c.status);
  checar(c.censo.semEspaco === 3 && c.censo.semRede === 0 && c.censo.recusadas === 0,
    'terceira coluna do censo', JSON.stringify(c.censo));

  // ---- D: TUDO CHEGA ------------------------------------------------------
  // A metade que impede o conserto de virar "reprovar sempre".
  const d = await rodar('t-ok', "window.__modo='ok'; window.__opfsQuebrado=false; window.__semFonte=false;");
  checar(d.devolveu.ok === true && d.devolveu.baixados === 3 && d.devolveu.falhou === 0,
    'o caminho feliz continua inteiro: três baixadas, nenhuma falha', JSON.stringify(d.devolveu));
  checar(d.completa && d.falta === 0 && d.ids.every(Boolean),
    'e a coleção fica COMPLETA — é isso que tira o botão de baixar da tela', JSON.stringify(d.ids));
  checar(d.grupo, 'e o grupo que só a contém também', d.grupo);
  checar(!/sem rede|recusada|espaço/.test(d.status),
    'o rodapé não inventa falha nenhuma', d.status);

  // ---- E: "NÃO EXISTE NA ORIGEM" CONTINUA SENDO SUCESSO (v5.134) ----------
  // A regressão que este conserto poderia ter comprado: `ensureSongVariant`
  // passou a devolver booleano, e o ramo do `url_music` vazio devolve `true`.
  // Devolvendo `false` ali, toda música que a origem não publica viraria uma
  // falha eterna — o botão de baixar nunca mais sairia daquele álbum, que é
  // exatamente o defeito que a v5.134 consertou.
  const e = await rodar('t-semfonte', "window.__modo='ok'; window.__opfsQuebrado=false; window.__semFonte=true;");
  checar(e.devolveu.ok === true && e.devolveu.falhou === 0,
    'música sem áudio NA ORIGEM não é falha de download — "não existe" ≠ "não baixei"',
    JSON.stringify(e.devolveu));
  checar(e.completa && e.falta === 0,
    'e a coleção fica completa mesmo assim: o botão sai (a regra da v5.134, intacta)',
    JSON.stringify({ completa: e.completa, falta: e.falta }));
  checar(e.pedidos === 0, 'e nenhum arquivo chega a ser pedido', e.pedidos);

  // ---- F: O ÍNDICE NÃO APONTA PARA REGISTRO QUE NÃO EXISTE ----------------
  // A divergência OPOSTA à do relato, e igualmente ruim: `fileIdFull` apontando
  // para um registro que o catálogo já não tem faz `songVariantsNeeded` dizer
  // "pendente" e `levantarColecao` dizer "feita" — o botão some sobre uma faixa
  // que não toca. As duas réguas têm de concordar.
  const f = await pg.evaluate(async () => {
    window.__modo = 'semRede'; window.__opfsQuebrado = false; window.__semFonte = false;
    const coll = { id: 't-orfao', name: 'Órfão', kind: 'album', source: 'fonte-de-uma' };
    collState[coll.id] = { indexSyncedAt: Date.now(), songs: [
      // id de arquivo que NUNCA existiu no catálogo
      { id_music: 101, track: 1, name: 'Hino A', duration: '00:03:30', fileIdFull: 'sumiu' },
    ] };
    const antesDaConta = colecaoCompleta(coll.id);
    await syncCollection(coll, { allowMobile: true });
    return {
      antesDaConta,
      idDepois: collSongs(coll.id)[0].fileIdFull,
      completaDepois: colecaoCompleta(coll.id),
    };
  });
  checar(f.antesDaConta === true,
    'premissa: com o id órfão no índice, a conta da tela dizia COMPLETA', f.antesDaConta);
  checar(f.idDepois === null && f.completaDepois === false,
    'a sincronização apaga o id que não resolve mais — a tela volta a dizer que falta, '
    + 'em vez de esconder o botão sobre uma faixa que não toca',
    JSON.stringify({ id: f.idDepois, completa: f.completaDepois }));

  // ---- G: O REGISTRO RESPONDE "POR QUE O BOTÃO CONTINUA AÍ?" --------------
  // Antes deste lote o Registro não tinha UMA linha sobre este caminho: o
  // relato chegava sem nada a conferir a distância.
  const reg = a.registro;
  checar(/^Download do acervo\n/.test(reg), 'o bloco existe e se nomeia', String(reg).slice(0, 40));
  checar(/arquivos buscados nesta sessão/.test(reg) && /gravados no aparelho/.test(reg),
    'com os DOIS números — buscados e gravados: é a diferença entre eles que descreve o defeito', reg);
  checar(/última: /.test(reg),
    'e o dado CRU da última falha: a contagem diz com que frequência, só o endereço diz qual arquivo', reg);

  // ---- H: O CABEÇALHO DO GRUPO NÃO DIZ "COMPLETO" COM O BOTÃO NA TELA -----
  // O caso do MEIO, que `semRede` sozinho deixava passar: metade das faixas
  // falha, o álbum devolve `ok:true` (nem tudo falhou) e o cabeçalho escrevia
  // "Completo" com o botão de baixar na linha de baixo.
  //
  // E ELE MEDE O TEXTO DO CABEÇALHO, não a função por baixo: `grupoCompleto` é
  // pura e sempre respondeu certo — quem errava era `syncGroup`, que nem a
  // consultava. Uma asserção sobre a função passaria com e sem o conserto.
  const h = await pg.evaluate(async () => {
    // UMA de três passa: é a célula do MEIO, e a única em que o álbum devolve
    // `ok:true` (o `ok` só é falso quando TUDO falhou) com a coleção ainda
    // incompleta. Com zero passando o cabeçalho já dizia "1 álbum sem rede"; com
    // três passando ele está certo em dizer "Completo". Fora desta célula a
    // asserção passa com e sem o conserto.
    let n = 0;
    window.__opfsQuebrado = false; window.__semFonte = false;
    const real = window.fetch;
    window.fetch = async (u, o) => {
      const str = String(u && u.url ? u.url : u);
      if (str.includes('api.louvorja.com.br/file')) {
        n++;
        if (n > 1) throw new TypeError('Failed to fetch');
        return new Response(new Blob([new Uint8Array(2048)], { type: 'audio/mpeg' }), { status: 200 });
      }
      return real(u, o);
    };
    // O Wi-Fi CONFIRMADO tira do caminho o diálogo de dados móveis do
    // `syncGroup` (ele pergunta uma vez pelo LOTE, e essa pergunta espera uma
    // PESSOA — sem prazo, como toda espera por gesto deste app).
    if (!navigator.connection) Object.defineProperty(navigator, 'connection', { value: {}, configurable: true });
    Object.defineProperty(navigator.connection, 'type', { value: 'wifi', configurable: true });
    const coll = { id: 't-metade', name: 'Metade', kind: 'album', source: 'fonte-de-teste' };
    collState[coll.id] = { indexSyncedAt: 0, songs: [] };
    await syncGroup('grupo-de-teste', 'Coletanea de Teste', [coll], null);
    // DEVOLVE O `fetch` AO ARNÊS. Este caso instala um stub PRÓPRIO (uma passa,
    // o resto cai), e deixá-lo de pé faz todo caso seguinte medir uma rede
    // caída — o defeito de arnês mais barato de cometer e o mais caro de ler,
    // porque a asserção reprova descrevendo a causa errada.
    window.fetch = real;
    return {
      baixadas: collSongs(coll.id).filter((x) => x.fileIdFull).length,
      grupoCompleto: grupoCompleto([{ id: coll.id }]),
      statusDoGrupo: gui('grupo-de-teste').status,
    };
  });
  checar(h.baixadas === 1 && h.grupoCompleto === false,
    'premissa: uma faixa de três chegou ao disco — o álbum devolve ok:true (nem tudo falhou) '
    + 'e o grupo continua incompleto, com o botão de baixar na linha',
    JSON.stringify({ baixadas: h.baixadas, completo: h.grupoCompleto }));
  checar(!/Completo/.test(h.statusDoGrupo),
    'então o cabeçalho do grupo NÃO escreve "Completo" — era o que ele fazia, porque lia só o '
    + '`ok` do álbum e nunca a mesma pergunta do botão', h.statusDoGrupo);
  checar(/Faltou/.test(h.statusDoGrupo),
    'e ele diz que faltou parte, que é o que manda o operador abrir os cards', h.statusDoGrupo);

  // ---- I: A CAUSA CHEGA AO CARTÃO DA PRÉVIA (v1.9.14) ---------------------
  //
  // O relato: *"não executam se selecionados individualmente, com mensagens de
  // 'sem internet para baixar', o que eu comprovei que tenho internet"*. A
  // fonte respondeu HTTP 404 e o cartão acusou a rede do operador — um texto
  // FIXO no ponto em que a rede era a única falha imaginável.
  //
  // A CÉLULA É O 404, não a queda de rede: com o fetch falhando o texto velho
  // estaria CERTO por acidente, e a asserção passaria com e sem o conserto.
  const i1 = await pg.evaluate(async () => {
    window.__modo = 'recusa'; window.__opfsQuebrado = false; window.__semFonte = false;
    const coll = { id: 't-cartao', name: 'Cartão', kind: 'album', source: 'fonte-de-uma' };
    collState[coll.id] = { indexSyncedAt: 0, songs: [] };
    await fetchCollectionIndex(coll);
    const s = collSongs(coll.id)[0];
    const antes = acervoCenso.recusadas;
    await playSongVariant(coll, s, 'full');
    return {
      cap: document.getElementById('pvBusyCap').textContent,
      texto: document.getElementById('pvBusyLabel').textContent,
      // A premissa é do TOQUE, não da sessão: `ultimoStatus` sobrevive aos casos
      // anteriores, e lido sozinho ele aprova pelo motivo errado.
      recusouAgora: acervoCenso.recusadas - antes,
      ultimoStatus: acervoCenso.ultimoStatus,
    };
  });
  checar(i1.recusouAgora === 1 && i1.ultimoStatus === 404,
    'premissa: a fonte respondeu 404 NESTE toque',
    JSON.stringify({ recusouAgora: i1.recusouAgora, status: i1.ultimoStatus }));
  checar(!/sem internet/.test(i1.texto),
    'o cartão NÃO acusa a internet do operador quando a fonte respondeu — era "sem internet '
    + 'para baixar" sobre um HTTP 404, e mandava consertar o que não estava quebrado', i1.texto);
  checar(/404/.test(i1.texto),
    'e o NÚMERO vai junto: "a fonte recusou" manda procurar defeito no app, "404" diz que o '
    + 'arquivo não está no endereço que o banco deu', i1.texto);
  checar(/Não deu/.test(i1.cap), 'e continua sendo o cartão de falha, não um aviso', i1.cap);

  // ---- J: E "SEM INTERNET" CONTINUA SENDO DITO ONDE ELE É VERDADE ---------
  // A metade que impede o conserto de virar "nunca mais falar de rede": quando
  // o `music_{id}` não vem, `downloadCollectionSong` desiste ANTES de pedir
  // arquivo nenhum e o censo não se move — essa É a falha de rede.
  const j = await pg.evaluate(async () => {
    const real = Louvorja.fetchList;
    const coll = { id: 't-cartao-rede', name: 'Cartão rede', kind: 'album', source: 'fonte-de-uma' };
    collState[coll.id] = { indexSyncedAt: 0, songs: [] };
    await fetchCollectionIndex(coll);
    const s = collSongs(coll.id)[0];
    // o índice já chegou; agora o BANCO cai
    Louvorja.fetchList = async () => { throw new TypeError('Failed to fetch'); };
    const antes = acervoCenso.tentadas;
    try { await playSongVariant(coll, s, 'full'); } finally { Louvorja.fetchList = real; }
    return { texto: document.getElementById('pvBusyLabel').textContent, pediuArquivo: acervoCenso.tentadas - antes };
  });
  checar(j.pediuArquivo === 0,
    'premissa: sem o `music_{id}` nenhum arquivo chega a ser pedido', j.pediuArquivo);
  checar(/sem internet/.test(j.texto),
    'e AÍ o cartão diz "sem internet" — o ramo continua, e é o certo quando nada foi tentado',
    j.texto);

  // ---- K: "NÃO TEM LETRA" É AFIRMAÇÃO SOBRE A MÚSICA, NÃO SOBRE A TENTATIVA
  // A letra vem no MESMO `music_{id}` que o áudio, então um download que falhou
  // deixa a lista vazia pelo motivo errado — e o cartão dizia que o hino não
  // tem letra quando o que houve foi a fonte recusar o arquivo.
  const k = await pg.evaluate(async () => {
    window.__modo = 'recusa';
    const coll = { id: 't-letra', name: 'Letra', kind: 'album', source: 'fonte-de-uma' };
    collState[coll.id] = { indexSyncedAt: 0, songs: [] };
    await fetchCollectionIndex(coll);
    const s = collSongs(coll.id)[0];
    await projectSongLyricsOnly(coll, s);
    return { texto: document.getElementById('pvBusyLabel').textContent };
  });
  checar(!/não tem letra/.test(k.texto),
    'com a fonte recusando, o cartão NÃO afirma que a música não tem letra — só se afirma a '
    + 'ausência quando a busca chegou ao fim', k.texto);
  checar(/404/.test(k.texto), 'ele diz a MESMA causa das outras portas', k.texto);

  // ---- L: O REGISTRO RESPONDE A PERGUNTA SEGUINTE (v1.9.14) ---------------
  //
  // A primeira cópia do Registro com este bloco parou na porta da pergunta que
  // decide o conserto: 1203 falhas e UM status guardado não distinguem "tudo
  // 404" de "uns 403 e uns 404", e um contador único não diz se o problema é de
  // UM álbum ou da fonte inteira.
  const l = await pg.evaluate(async () => {
    // dois álbuns, dois status diferentes: é a célula em que um contador único
    // e um status único respondem errado.
    let n = 0;
    const real = window.fetch;
    window.fetch = async (u, o) => {
      const str = String(u && u.url ? u.url : u);
      if (str.includes('api.louvorja.com.br/file')) { n++; return new Response('', { status: n === 1 ? 403 : 404 }); }
      return real(u, o);
    };
    const a = { id: 't-reg-a', name: 'Álbum Um', kind: 'album', source: 'fonte-de-uma' };
    const b = { id: 't-reg-b', name: 'Álbum Dois', kind: 'album', source: 'fonte-de-teste' };
    collState[a.id] = { indexSyncedAt: 0, songs: [] };
    collState[b.id] = { indexSyncedAt: 0, songs: [] };
    await syncCollection(a, { allowMobile: true });
    await syncCollection(b, { allowMobile: true });
    window.fetch = real;
    return {
      registro: blocoAcervo(),
      // O bloco CORTA a lista em `ACERVO_ALBUNS_MAX` e diz o corte; quem guarda
      // todos é o censo, e é nele que a conta por álbum se afirma.
      albuns: JSON.parse(JSON.stringify(acervoCenso.albuns)),
      porStatus: JSON.parse(JSON.stringify(acervoCenso.porStatus)),
    };
  });
  checar(/respostas da fonte:/.test(l.registro) && /HTTP 404/.test(l.registro) && /HTTP 403/.test(l.registro),
    'o Registro traz a DISTRIBUIÇÃO de status — 403 em tudo é a ROTA, 404 em tudo é o CAMINHO, '
    + 'e um contador único não separa os dois', l.registro);
  checar(l.albuns['Álbum Um'] === 1 && l.albuns['Álbum Dois'] === 3,
    'e DE QUEM são as falhas, uma a uma: um álbum falhando enquanto os outros baixam é dado '
    + 'da fonte, todos falhando é a rota', JSON.stringify(l.albuns));
  checar(/álbuns com falha: \d+/.test(l.registro) && /\n    - .+: \d+/.test(l.registro),
    'o bloco traz a conta e os nomes', l.registro.slice(0, 400));
  checar(!/\u2026 e mais/.test(l.registro) || /… e mais \d+/.test(l.registro),
    'e o CORTE É DITO quando a lista passa do teto — como em todo bloco deste Registro',
    l.registro.slice(0, 400));
  checar(/no fio: https:\/\/api\.louvorja\.com\.br\/file/.test(l.registro),
    'e a URL COMO O SERVIDOR A RECEBEU — o caminho do banco vem com espaço e acento crus, e '
    + 'colar o cru num navegador responde outra pergunta', l.registro);


  // ---- M: A EXTENSÃO SAI DO NOME, NÃO DA URL INTEIRA (v1.9.15) ------------
  //
  // `url.split('.').pop()` bastava enquanto o campo era CAMINHO. Com ele virando
  // URL ABSOLUTA o HOST entra na conta, e host tem ponto: um endereço sem
  // extensão no fim devolvia `br/file/images/123` como "extensão", que vira
  // CAMINHO no OPFS (`splitPath` quebra por `/`) e espalha o arquivo por
  // diretórios inventados — onde a soma de peso da pasta, que lê só o primeiro
  // nível, deixa de contá-lo.
  // MEDIDO NO CAMINHO GRAVADO, e não na função: uma asserção que chama
  // `extensaoDoArquivo` direto passa com e sem o conserto no CONSUMIDOR — ela
  // prova que a função existe, não que alguém a usa. A célula é o
  // `imageOpfsPath` do registro.
  const m = await pg.evaluate(async () => {
    window.__modo = 'ok'; window.__modoImg = 'ok'; window.__opfsQuebrado = false; window.__semFonte = false;
    window.__imagem = 'https://api.louvorja.com.br/file/imagens/123';  // SEM extensão no fim
    const coll = { id: 't-ext', name: 'Álbum Ext', kind: 'album', source: 'fonte-de-uma' };
    collState[coll.id] = { indexSyncedAt: 0, songs: [] };
    await syncCollection(coll, { allowMobile: true });
    const rec = await AVDB.fileGet(collSongs(coll.id)[0].fileIdFull);
    const caminho = (rec && rec.lyrics && rec.lyrics[0] && rec.lyrics[0].imageOpfsPath) || '';
    window.__imagem = null;
    return {
      caminho,
      segmentos: caminho.split('/').filter(Boolean).length,
      // as bordas, medidas na função — elas não têm consumidor próprio, e o que
      // as cobre é esta linha.
      comExt: extensaoDoArquivo('https://api.louvorja.com.br/file/a/Hino 1 - PB.mp3', 'mp3'),
      caminhoRelativo: extensaoDoArquivo('/musics/123/cantado.mp3', 'mp3'),
      comQuery: extensaoDoArquivo('https://api.louvorja.com.br/file/a/x.jpg?v=1.2', 'jpg'),
      pontoNoMeio: extensaoDoArquivo('https://api.louvorja.com.br/file/a/Hino n.1 - PB', 'mp3'),
      velho: 'https://api.louvorja.com.br/file/imagens/123'.split('.').pop(),
    };
  });
  checar(m.segmentos === 3 && /\.jpg$/.test(m.caminho),
    'a imagem de um endereço SEM extensão é gravada num arquivo, não numa árvore de diretórios '
    + 'inventados — `splitPath` quebra por "/", e o que estava sobrando ali era um pedaço do HOST',
    m.caminho);
  checar(m.velho.indexOf('/') > 0,
    'e a MEDIÇÃO que sustenta o conserto: a conta antiga devolvia um pedaço de caminho como '
    + '"extensão"', m.velho);
  checar(m.comExt === 'mp3' && m.caminhoRelativo === 'mp3' && m.comQuery === 'jpg',
    'as formas que já funcionavam continuam inteiras — absoluta com extensão, caminho relativo, '
    + 'e a query que não faz parte do nome',
    JSON.stringify([m.comExt, m.caminhoRelativo, m.comQuery]));
  checar(m.pontoNoMeio === 'mp3',
    'e um ponto NO MEIO do nome não vira extensão: o resultado é VALIDADO, não só recortado',
    m.pontoNoMeio);

  // ---- N: O ENDEREÇO DE OUTRO SERVIDOR É CAUSA COM NOME (v1.9.15) ---------
  //
  // A trava de host do `fileUrl` falha FECHADA, e está certo; o que ela produz é
  // um 404 do NOSSO host — indistinguível de "o arquivo não existe". Duas causas
  // OPOSTAS com a mesma linha mandam procurar no lugar errado.
  const n = await pg.evaluate(async () => {
    // O CENSO É ZERADO AQUI, e é PREMISSA: ele acumula pela sessão inteira, e
    // os casos A–C já deixaram falhas de todas as outras colunas. A asserção do
    // fecho — *"nenhuma falha"* não pode conviver com uma linha de falha — passa
    // por acidente contra um censo sujo, com e sem o conserto.
    Object.assign(acervoCenso, {
      tentadas: 0, gravadas: 0, semRede: 0, recusadas: 0, semEspaco: 0,
      capasPerdidas: 0, foraDoServidor: 0, truncaveis: 0,
      porStatus: {}, albuns: {}, motivo: '', ultimoStatus: 0, ultimaUrl: '', ultimoPath: '',
    });
    const antes = { fora: acervoCenso.foraDoServidor, recusadas: acervoCenso.recusadas };
    window.__modo = 'ok'; window.__modoImg = 'ok'; window.__opfsQuebrado = false; window.__semFonte = false;
    window.__imagem = 'https://cdn.outrolugar.example/imagens/1.jpg';
    window.__pedidos = 0; window.__pedidosImg = 0;
    const coll = { id: 't-fora', name: 'Álbum Fora', kind: 'album', source: 'fonte-de-uma' };
    collState[coll.id] = { indexSyncedAt: 0, songs: [] };
    const censoAntes = retratoDoCenso();
    const devolveu = await syncCollection(coll, { allowMobile: true });
    const r = {
      devolveu,
      fora: acervoCenso.foraDoServidor - antes.fora,
      recusadas: acervoCenso.recusadas - antes.recusadas,
      pedidosImg: window.__pedidosImg,
      cartao: motivoDoCartao(censoAntes),
      registro: blocoAcervo(),
      outras: acervoCenso.semRede + acervoCenso.recusadas + acervoCenso.semEspaco,
    };
    window.__imagem = null;
    return r;
  });
  checar(n.fora === 1 && n.pedidosImg === 0,
    'o endereço de fora é CONTADO e o pedido nem sai — ele está condenado por construção',
    JSON.stringify([n.fora, n.pedidosImg]));
  checar(n.recusadas === 0,
    'e NÃO entra em "recusadas": aquela conta o que a FONTE respondeu, e aqui ninguém respondeu '
    + '— misturar as duas faria a distribuição de status descrever uma resposta que não houve',
    n.recusadas);
  checar(/FORA do servidor/.test(n.registro) && /cdn\.outrolugar\.example/.test(n.registro),
    'o Registro diz a causa E para onde a origem apontou — saber que aconteceu não diz se a '
    + 'trava precisa alcançar aquele host', n.registro);
  checar(/mudou de servidor/.test(n.cartao),
    'e o cartão da prévia nomeia a mesma causa, em vez de acusar a internet do operador', n.cartao);
  checar(n.devolveu.ok === true && n.devolveu.baixados === 1,
    'o ÁUDIO chegou assim mesmo: uma capa perdida custa o fundo de um slide, não a faixa',
    JSON.stringify(n.devolveu));
  checar(n.outras === 0,
    'premissa do fecho: nesta passada NENHUMA das três colunas antigas subiu — sem ela o bloco '
    + 'já não diria "nenhuma falha" por outro motivo, e a asserção abaixo passaria por acidente',
    n.outras);
  checar(!/nenhuma falha de download/.test(n.registro),
    'e o bloco NÃO se fecha dizendo "nenhuma falha" com uma linha de falha impressa acima — '
    + 'um log que se contradiz na própria altura é o pior artefato de um diagnóstico lido a distância',
    n.registro);

  // ---- O: O FUNDO DA LETRA ALCANÇA O QUE JÁ ESTÁ NO APARELHO (v1.9.15) ----
  //
  // O relato: *"conseguiu baixar, e usar as músicas, mas não está vindo com as
  // imagens de fundo"*. Os slides guardam `imageOpfsPath` resolvido NO MOMENTO
  // do download, e `ensureSongVariant` devolve cedo para todo registro que já
  // tenha `lyrics` — então a faixa baixada num dia em que as imagens falhavam
  // fica sem fundo PARA SEMPRE, e re-sincronizar não reconstrói nada.
  const o = await pg.evaluate(async () => {
    const fundos = (rec) => (rec && Array.isArray(rec.lyrics)
      ? rec.lyrics.filter((x) => x && x.imageOpfsPath).length : -1);
    // 1) o áudio chega, a imagem NÃO — é a célula do relato.
    window.__modo = 'ok'; window.__modoImg = 'recusa'; window.__opfsQuebrado = false; window.__semFonte = false;
    window.__imagem = '/imagens/capa-101.jpg';
    const coll = { id: 't-fundo', name: 'Álbum Fundo', kind: 'album', source: 'fonte-de-uma' };
    collState[coll.id] = { indexSyncedAt: 0, songs: [] };
    await syncCollection(coll, { allowMobile: true });
    const s1 = collSongs(coll.id)[0];
    const antes = fundos(await AVDB.fileGet(s1.fileIdFull));
    const completaAntes = colecaoCompleta(coll.id);

    // 2) a imagem passa a vir, e o operador toca em sincronizar de novo.
    window.__modoImg = 'ok';
    window.__pedidos = 0; window.__pedidosImg = 0;
    await syncCollection(coll, { allowMobile: true });
    const s2 = collSongs(coll.id)[0];
    const depois = fundos(await AVDB.fileGet(s2.fileIdFull));
    const r = {
      antes, depois, completaAntes,
      status: ui(coll.id).status,
      audioRebaixado: window.__pedidos,
      mesmoId: s1.fileIdFull === s2.fileIdFull,
    };
    window.__imagem = null;
    return r;
  });
  checar(o.antes === 0 && o.completaAntes,
    'a PREMISSA, e é ela que faz o defeito invisível: a faixa fica COMPLETA (o áudio chegou) com '
    + 'zero slides com fundo — nenhuma régua da tela tem o que reclamar',
    JSON.stringify([o.antes, o.completaAntes]));
  checar(o.depois > 0,
    'depois de sincronizar com a imagem voltando, os slides GANHAM fundo — sem isto a única saída '
    + 'do operador seria excluir a coleção e rebaixar o hinário inteiro pelas fotos', o.depois);
  checar(o.audioRebaixado === 0 && o.mesmoId,
    'e o áudio NÃO é rebaixado: o mesmo arquivo continua no lugar, e a rotina dos fundos não puxa '
    + 'megabytes sob um rótulo que diz outra coisa', JSON.stringify([o.audioRebaixado, o.mesmoId]));
  checar(/Fundos da letra: 1/.test(o.status),
    'e a faixa de status DIZ o que aconteceu — um toque em sincronizar que faz algo e não conta '
    + 'é indistinguível de um que não fez nada', o.status);
  // ---- P: O BLOCO NÃO SOME QUANDO SÓ A CAPA FALHOU (v1.9.16) --------------
  //
  // `tentadas` conta só VARIANTES DE ÁUDIO, e a porta do bloco era ela. Com o
  // áudio já todo no disco — o hinário do relato — a sincronização sai por
  // "Já completo offline", o backfill do fundo roda, MIL capas falham, e
  // `downloadCollectionFile` nunca é chamado: `tentadas` fica em zero e o bloco
  // inteiro desaparece do Registro. **Um diagnóstico que some justamente no caso
  // que ele existe para explicar é pior que não existir** — quem copia o
  // Registro conclui que não há nada a ver ali.
  const o2 = await pg.evaluate(async () => {
    const coll = { id: 't-bloco', name: 'Álbum Bloco', kind: 'album', source: 'fonte-de-uma' };
    collState[coll.id] = { indexSyncedAt: 0, songs: [] };
    // 1) o áudio desce e a capa falha — a faixa fica completa e sem fundo.
    window.__modo = 'ok'; window.__modoImg = 'recusa'; window.__opfsQuebrado = false; window.__semFonte = false;
    window.__imagem = '/imagens/capa-101.jpg';
    await syncCollection(coll, { allowMobile: true });
    // 2) O CENSO É ZERADO: é a PREMISSA, e sem ela o `tentadas` do passo 1
    //    mantém o bloco de pé e a asserção passa com e sem o conserto.
    Object.assign(acervoCenso, {
      tentadas: 0, gravadas: 0, semRede: 0, recusadas: 0, semEspaco: 0,
      capasPedidas: 0, capasPerdidas: 0, foraDoServidor: 0, truncaveis: 0,
      porStatus: {}, albuns: {}, motivo: '', ultimoStatus: 0, ultimaUrl: '', ultimoPath: '',
    });
    // 3) o operador toca em sincronizar de novo: só o backfill roda.
    await syncCollection(coll, { allowMobile: true });
    const r = {
      tentadas: acervoCenso.tentadas,
      pedidas: acervoCenso.capasPedidas,
      perdidas: acervoCenso.capasPerdidas,
      registro: blocoAcervo(),
    };
    window.__imagem = null; window.__modoImg = 'ok';
    return r;
  });
  checar(o2.tentadas === 0 && o2.perdidas > 0,
    'a PREMISSA: nenhum arquivo de ÁUDIO foi buscado nesta passada (o backfill não passa pelo '
    + '`downloadCollectionFile`) e a capa falhou — é a célula exata do hinário completo',
    JSON.stringify([o2.tentadas, o2.perdidas]));
  checar(o2.registro !== '',
    'e o bloco "Download do acervo" NÃO some do Registro — era `if (!c.tentadas) return ""`, e '
    + 'com ele o operador copiava um Registro sem uma linha sobre mil capas que não vieram',
    JSON.stringify(o2.registro));
  checar(/imagens de fundo pedidas: \d+/.test(o2.registro) && /não vieram/.test(o2.registro),
    'e ele traz os DOIS números da capa: só "perdidas" lê-se como "está tudo bem" tanto onde as '
    + 'mil chegaram quanto onde nenhuma foi pedida', o2.registro);
  checar(!/arquivos buscados nesta sessão: 0/.test(o2.registro),
    'e a linha do ÁUDIO não sai anunciando "0 · 0" numa passada que não buscou áudio nenhum',
    o2.registro);

} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) { console.error('\n' + falhas.length + ' falha(s).'); process.exit(1); }
console.log('\nTodos passaram.');
