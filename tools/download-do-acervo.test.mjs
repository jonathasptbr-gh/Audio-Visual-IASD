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
// OS RELÓGIOS QUE A ABERTURA ARMA, pelo nome da função — o bloco U pergunta se
// o que religa a passada dos fundos está entre eles. Só REGISTRA: o relógio
// continua sendo o de verdade.
await pg.addInitScript(() => {
  const si = window.setInterval;
  window.__intervalos = [];
  window.setInterval = function (fn, ms, ...resto) {
    window.__intervalos.push({ nome: (fn && fn.name) || '', ms });
    return si.call(this, fn, ms, ...resto);
  };
});

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
          if (window.__modoImg === 'semRede') throw new TypeError('Failed to fetch');
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

  // ---- Q: A VARREDURA DOS FUNDOS CORRE SOZINHA (v1.10.6) -----------------
  //
  // O relato: *"Não há um botão de sincronizar as coleções"* — e ele está
  // certo. O botão de baixar só é desenhado com a coleção INCOMPLETA
  // (`if ((u.syncBusy || !complete) …)`), que é justamente o estado em que o
  // backfill da v1.9.15 NÃO serve: o defeito do fundo mora na coleção
  // completa. MEDIDO no Registro dele: 3556 músicas baixadas e `19 de 60 sem
  // fundo` na Verificação — cerca de mil e cem faixas que nenhum toque
  // alcançava.
  //
  // O que torna a varredura automática possível é o VEREDITO POR MÚSICA com
  // data — a peça que o KDoc da v1.9.15 já nomeava como o que faltava. Sem
  // ele, cada abertura do app custaria ~7100 leituras de IndexedDB só para
  // redescobrir o que já se sabia.
  // A PREMISSA DE REDE DOS BLOCOS Q A S: a passada automática só corre num
  // Wi-Fi CONFIRMADO, e o Chromium de desktop não informa `connection.type` —
  // `networkType()` responde `unknown` aqui, e sem esta linha a passada nunca
  // partiria e toda asserção abaixo mediria uma porta fechada. A célula do
  // `unknown` tem asserção PRÓPRIA (bloco T), que é onde ela importa.
  const premissaRede = await pg.evaluate(() => {
    window.__redeReal = window.networkType;
    window.networkType = () => 'wifi';
    return isConfirmedWifi();
  });
  checar(premissaRede === true, 'a PREMISSA dos blocos Q a S: o aparelho de mentira está num Wi-Fi confirmado',
    premissaRede);

  const q = await pg.evaluate(async () => {
    const out = {};
    const cid = 't-auto';
    const coll = { id: cid, name: 'Álbum Auto', kind: 'album', source: 'fonte-de-uma' };
    window.__modo = 'ok'; window.__opfsQuebrado = false; window.__semFonte = false;
    window.__imagem = '/imagens/capa-101.jpg';

    // 1) O ÁUDIO DESCE E A FOTO FALHA — a faixa fica completa e sem fundo.
    window.__modoImg = 'recusa';
    collState[cid] = { indexSyncedAt: 0, songs: [] };
    await AVDB.setState(fundoChave(cid), null);
    await syncCollection(coll, { allowMobile: true });
    const s = collSongs(cid)[0];
    out.semFundo = (await estadoDoFundo(s)) === 'falta';

    // 2) A SEGUNDA SINCRONIZAÇÃO sai por "Já completo offline" e é ela que
    //    CONFERE — e a conferência, com a foto voltando, vira veredito.
    window.__modoImg = 'ok';
    await syncCollection(coll, { allowMobile: true });
    out.temFundo = (await estadoDoFundo(s)) === 'tem';
    const disco = (await AVDB.getState(fundoChave(cid))) || {};
    out.veredito = disco[s.id_music] || null;
    out.versao = FUNDO_VEREDITO_VERSAO;
    out.idsDaFaixa = fundoIdsDaFaixa(s);

    // 3) COM O VEREDITO NO DISCO, a passada AUTOMÁTICA não confere nem vai à
    //    rede. É esta a "verificação rápida": o estado estável custa zero.
    //    A RÉGUA SÃO AS CONFERÊNCIAS, não os metadados: esta faixa TEM fundo,
    //    e sem o veredito ela seria relida do disco mas não iria à rede — uma
    //    asserção por metadados passaria com o veredito ignorado.
    window.allCollections = () => [coll];
    // O ESPIÃO É O `estadoDoFundo`, que é o que a conferência chama — espiar
    // um vizinho que ela não chama faria toda asserção de "zero conferências"
    // abaixo passar por vacuidade.
    let conferiu = 0;
    const realConferir = window.estadoDoFundo;
    window.estadoDoFundo = async (x) => { conferiu++; return realConferir(x); };
    try {
      fundosProximaPassadaEm = 0;
      fundosUltimaPassada = null;
      await syncFundosAcervo();
      out.conferiuComVeredito = conferiu;
      // O ESTADO ESTÁVEL NO REGISTRO: a passada partiu e não havia o que
      // conferir. O retrato gravado só no fim e só com trabalho feito deixava
      // o bloco dizendo "nenhuma passada" logo acima do piso que ela armou.
      out.blocoEstavel = await blocoFundos();

      // 4) A CONFERÊNCIA QUE PASSA VIRA VEREDITO SOZINHA — sem refazer nada.
      //    O disco é limpo antes (a PREMISSA): o veredito do passo 2 veio da
      //    REFEITURA, e sem limpar esta asserção não distinguiria as duas.
      await AVDB.setState(fundoChave(cid), null);
      fundosProximaPassadaEm = 0;
      conferiu = 0;
      await syncFundosAcervo();
      out.conferiuNaPrimeira = conferiu;
      const d4 = (await AVDB.getState(fundoChave(cid))) || {};
      out.vereditoDaConferencia = d4[s.id_music] || null;

      // 5) O PISO ENTRE PASSADAS: a segunda chamada seguida volta na porta.
      //    O disco é limpo DE NOVO: com o veredito do passo 4 no lugar, a
      //    segunda passada não conferiria nada com piso ou sem ele — e a
      //    asserção do piso seria uma tautologia.
      await AVDB.setState(fundoChave(cid), null);
      conferiu = 0;
      await syncFundosAcervo();
      out.conferiuNaSegunda = conferiu;

      // 6) A COLEÇÃO EM DOWNLOAD FICA DE FORA: o `syncCollection` dela já
      //    chama o backfill no fim, com o `pular` do que acabou de tentar.
      fundosProximaPassadaEm = 0;
      conferiu = 0;
      ui(cid).syncBusy = true;
      try { await syncFundosAcervo(); } finally { ui(cid).syncBusy = false; }
      out.conferiuComDownload = conferiu;
    } finally { window.estadoDoFundo = realConferir; }
    return out;
  });
  checar(q.semFundo === true && q.temFundo === true,
    'a PREMISSA do bloco: a faixa desce sem fundo e a conferência seguinte, com a foto voltando, '
    + 'a recupera — é o cenário do relato, de ponta a ponta', JSON.stringify([q.semFundo, q.temFundo]));
  checar(!!q.veredito && q.veredito.tem === true && q.veredito.v === q.versao
    && q.veredito.ids === q.idsDaFaixa,
    'e a REFEITURA que recebeu o metadado grava o veredito, com versão, ids e data — a faixa estava '
    + 'sem fundo na conferência, então quem carimba aqui é a refeitura (a conferência é o passo 4)',
    JSON.stringify(q.veredito));
  checar(!/nenhuma passada automática/.test(q.blocoEstavel)
    && /toda música baixada já tem veredito/.test(q.blocoEstavel),
    'e no estado ESTÁVEL o Registro diz que a passada correu e não havia o que conferir — e não '
    + '"nenhuma passada", que era o que ele escrevia duas linhas acima do piso que ela armou',
    q.blocoEstavel);
  checar(q.conferiuComVeredito === 0,
    'com o veredito no disco a passada automática não relê UMA faixa — é esta a "verificação '
    + 'rápida" pedida: o estado estável custa zero, contra ~7100 leituras por abertura no acervo '
    + 'do relato', q.conferiuComVeredito);
  checar(q.conferiuNaPrimeira > 0 && !!q.vereditoDaConferencia && q.vereditoDaConferencia.tem === true,
    'e a conferência que PASSA vira veredito sozinha, sem refazer nada — sem isto o veredito só '
    + 'guardaria o que foi refeito, e o acervo sadio seria relido em toda abertura para sempre',
    JSON.stringify([q.conferiuNaPrimeira, q.vereditoDaConferencia]));
  checar(q.conferiuNaSegunda === 0,
    'e há PISO entre duas passadas: `autoRefreshCollections` roda em todo `visibilitychange` — '
    + 'dezenas de vezes por culto —, e sem o piso o teto de bytes seria cobrado a cada volta ao app',
    q.conferiuNaSegunda);
  checar(q.conferiuComDownload === 0,
    'e a coleção EM DOWNLOAD fica de fora: o download dela já chama o backfill no fim, e entrar ao '
    + 'mesmo tempo buscaria a mesma faixa duas vezes e contaria duas falhas por uma tentativa',
    q.conferiuComDownload);

  // ---- R: O QUE O VEREDITO NÃO PODE AFIRMAR ------------------------------
  //
  // As três regras que o separam de um carimbo: a ausência VENCE, a gravação
  // MESCLA, e uma pergunta que não chegou a ser feita NÃO vira resposta.
  const rr = await pg.evaluate(async () => {
    const out = {};
    const agora = Date.now();
    const DIA = 24 * 60 * 60 * 1000;
    const s = { id_music: 9, fileIdFull: 'a1', fileIdPlayback: null };
    const ids = fundoIdsDaFaixa(s);
    const V = (em, tem, extra) => ({ v: FUNDO_VEREDITO_VERSAO, ids, em, tem, ...(extra || {}) });
    // O PRAZO: `tem: true` vale sempre; `tem: false` vale SEIS dias — a falha
    // de um sábado volta à fila na sexta, antes do culto seguinte.
    out.temVale = fundoNoDiscoVale(V(agora - 400 * DIA, true), s, agora);
    out.faltaNova = fundoNoDiscoVale(V(agora - 5 * DIA, false), s, agora);
    // A CÉLULA QUE SEPARA 6 DE 7: a falha de um sábado às 9h e a abertura do
    // sábado seguinte às 7h — 6 dias e 22 horas. Com sete dias ela ainda
    // estaria fora da fila; `7 * DIA` exato não separava nada, porque a
    // comparação é estrita e 7 < 7 é falso nos dois mundos.
    out.faltaDeUmaSemana = fundoNoDiscoVale(V(agora - (7 * DIA - 2 * 60 * 60 * 1000), false), s, agora);
    // O RELÓGIO QUE VOLTOU: idade negativa é vencida, nunca "o salto a mais".
    out.relogioVoltou = fundoNoDiscoVale(V(agora + 3 * DIA, false), s, agora);
    // A VERSÃO: entrada de código antigo não segura o prazo dele.
    out.versaoVelha = fundoNoDiscoVale(V(agora, true, { v: FUNDO_VEREDITO_VERSAO - 1 }), s, agora);
    // OS ARQUIVOS: excluir e rebaixar a coleção cria registros NOVOS, e um
    // "tem fundo" do registro anterior não pode calar a faixa nova.
    out.outroArquivo = fundoNoDiscoVale(V(agora, true),
      { id_music: 9, fileIdFull: 'b2', fileIdPlayback: null }, agora);

    // A MESCLA NUNCA SUBSTITUI — a lição do `275 de 601` que virou `0 de 601`.
    await AVDB.setState('fundos:t-mescla', {
      1: { v: FUNDO_VEREDITO_VERSAO, em: 1, tem: true },
      2: { v: FUNDO_VEREDITO_VERSAO, em: 1, tem: true },
      3: { v: FUNDO_VEREDITO_VERSAO, em: 1, tem: false },
    });
    const novos = { 4: { v: FUNDO_VEREDITO_VERSAO, em: 2, tem: true } };
    await fundoDiscoMesclar('t-mescla', novos);
    const d = (await AVDB.getState('fundos:t-mescla')) || {};
    out.chaves = Object.keys(d).sort().join(',');
    out.sobrouPendente = Object.keys(novos).length;

    // SEM REDE NÃO SE GRAVA VEREDITO. A pergunta nem chegou a ser feita, e
    // carimbá-la custaria a semana inteira de revisita — a regra que a
    // varredura de cifras já escreveu para o `sem-rede`.
    const cid = 't-semrede';
    const coll = { id: cid, name: 'Álbum Sem Rede', kind: 'album', source: 'fonte-de-uma' };
    window.__modo = 'ok'; window.__modoImg = 'recusa'; window.__semFonte = false;
    window.__imagem = '/imagens/capa-101.jpg';
    collState[cid] = { indexSyncedAt: 0, songs: [] };
    await AVDB.setState(fundoChave(cid), null);
    await syncCollection(coll, { allowMobile: true });    // desce sem fundo
    await AVDB.setState(fundoChave(cid), null);           // a premissa: disco limpo
    const sr = collSongs(cid)[0];
    const listaReal = Louvorja.fetchList;
    Louvorja.fetchList = async () => { throw new TypeError('Failed to fetch'); };
    try { await syncImagensColecao(coll, { auto: true }); }
    finally { Louvorja.fetchList = listaReal; }
    const ds = (await AVDB.getState(fundoChave(cid))) || {};
    out.semRedeGravou = Object.prototype.hasOwnProperty.call(ds, String(sr.id_music));

    // SEM TETO (v1.10.7, pedido do operador): a passada refaz TUDO o que falta
    // numa vez — *"se ele achar necessário, ele verifica e atualiza toda a
    // biblioteca baixada"*.
    const cid2 = 't-teto';
    const coll2 = { id: cid2, name: 'Álbum Teto', kind: 'album', source: 'fonte-de-teste' };
    window.__modoImg = 'recusa';
    collState[cid2] = { indexSyncedAt: 0, songs: [] };
    await AVDB.setState(fundoChave(cid2), null);
    await syncCollection(coll2, { allowMobile: true });   // três faixas, sem fundo
    await AVDB.setState(fundoChave(cid2), null);
    window.__modoImg = 'ok';
    const orc = { conferidas: 0, tentadas: 0, refeitas: 0, comResposta: 0, semResposta: 0, fonteMuda: false };
    let tentadas = 0;
    const listaReal2 = Louvorja.fetchList;
    Louvorja.fetchList = async (f) => { if (String(f).startsWith('music_')) tentadas++; return listaReal2(f); };
    try { await syncImagensColecao(coll2, { auto: true, contas: orc }); }
    finally { Louvorja.fetchList = listaReal2; }
    out.tentadasSemTeto = tentadas;
    out.refeitas = orc.refeitas;
    out.conferidas = orc.conferidas;
    window.__imagem = null; window.__modoImg = 'ok';
    return out;
  });
  checar(rr.temVale === true && rr.faltaNova === true && rr.faltaDeUmaSemana === false,
    'o veredito tem DOIS prazos opostos: "tem fundo" vale sempre (o arquivo está lá), e "ainda sem" '
    + 'vence ANTES de uma semana — a falha de um sábado tem de voltar à fila antes do sábado seguinte',
    JSON.stringify([rr.temVale, rr.faltaNova, rr.faltaDeUmaSemana]));
  checar(rr.relogioVoltou === false,
    'e uma ausência gravada com o relógio ADIANTADO vence quando ele é corrigido — senão ela valeria '
    + 'o salto inteiro a mais, com o Registro dizendo "seis dias"', rr.relogioVoltou);
  checar(rr.outroArquivo === false,
    'e o veredito é do REGISTRO, não da música: excluir e rebaixar a coleção cria arquivos novos, e um '
    + '"tem fundo" herdado calaria para sempre uma faixa que desceu sem fundo na segunda vez',
    rr.outroArquivo);
  checar(rr.versaoVelha === false,
    'e entrada de versão antiga não vale: um lote que mude o que conta como "tem fundo" não pode '
    + 'ficar esperando o prazo escrito pelo código que ele veio substituir', rr.versaoVelha);
  checar(rr.chaves === '1,2,3,4' && rr.sobrouPendente === 0,
    'a gravação MESCLA e esvazia a fila — a lição do `275 de 601` que virou `0 de 601`: uma '
    + 'substituição pode produzir zero a partir de centenas, uma mescla não pode',
    JSON.stringify([rr.chaves, rr.sobrouPendente]));
  checar(rr.semRedeGravou === false,
    'sem rede NENHUM veredito é gravado: a pergunta não chegou a ser feita, e carimbá-la custaria '
    + 'o prazo inteiro de revisita sobre uma faixa que ninguém perguntou', rr.semRedeGravou);
  checar(rr.tentadasSemTeto === 3 && rr.refeitas === 3 && rr.conferidas === 3,
    'SEM TETO: as três faixas sem fundo são conferidas E refeitas na mesma passada — o operador pediu '
    + 'que a biblioteca inteira seja atualizada quando for preciso, e não sessenta por vez',
    JSON.stringify([rr.tentadasSemTeto, rr.refeitas, rr.conferidas]));

  // ---- S: O REGISTRO RESPONDE "as fotos vão aparecer no sábado?" ----------
  //
  // A PORTA PERGUNTA PELO QUE O BLOCO DESCREVE (a regra da v1.9.16): ele abre
  // com MÚSICA BAIXADA, e não quando uma passada aconteceu — o aparelho que
  // ainda não teve passada nenhuma é exatamente o que precisa aparecer aqui.
  const ss = await pg.evaluate(async () => {
    const coll = { id: 't-auto', name: 'Álbum Auto', kind: 'album', source: 'fonte-de-uma' };
    window.allCollections = () => [coll];
    const guardado = fundosUltimaPassada;
    fundosUltimaPassada = null;
    const semPassada = await blocoFundos();
    fundosUltimaPassada = guardado;
    return { semPassada, comPassada: await blocoFundos() };
  });
  checar(/^Fundos da letra/.test(ss.semPassada),
    'o bloco existe no Registro de um aparelho que ainda não teve passada automática nenhuma — '
    + 'a porta pergunta por MÚSICA BAIXADA, que é o que ele descreve', ss.semPassada);
  checar(/\d+ música\(s\) baixada\(s\)/.test(ss.semPassada),
    'e a conta viaja com o DENOMINADOR: "0 sem fundo" lê-se como "está tudo bem" tanto onde as '
    + 'três mil chegaram quanto onde nenhuma foi conferida', ss.semPassada);
  checar(/nenhuma passada automática nesta sessão ainda/.test(ss.semPassada)
    && /última passada/.test(ss.comPassada),
    'e ele diz QUAL dos dois estados é o do aparelho — "N por conferir" sem essa linha é um '
    + 'mistério que volta a cada cópia do Registro', JSON.stringify([ss.semPassada, ss.comPassada]));


  // ---- T: O QUE A REVISÃO ADVERSARIAL DA v1.10.6 DERRUBOU ----------------
  //
  // Cada célula abaixo é um cenário que o lote, como saiu da primeira escrita,
  // errava EM SILÊNCIO — e cada uma foi medida contra a versão sem o conserto.
  const tt = await pg.evaluate(async () => {
    const out = {};
    const listaReal = Louvorja.fetchList;
    // Uma coleção de TRÊS faixas baixadas SEM fundo, com o veredito limpo.
    const montar = async (cid) => {
      const coll = { id: cid, name: 'Álbum ' + cid, kind: 'album', source: 'fonte-de-teste' };
      window.__modo = 'ok'; window.__modoImg = 'recusa'; window.__semFonte = false;
      window.__imagem = '/imagens/capa.jpg';
      collState[cid] = { indexSyncedAt: 0, songs: [] };
      await syncCollection(coll, { allowMobile: true });
      await AVDB.setState(fundoChave(cid), null);
      window.__modoImg = 'ok';
      return coll;
    };
    const contarMusic = (antes) => {
      let n = 0;
      Louvorja.fetchList = async (f) => {
        if (String(f).startsWith('music_')) { n++; if (antes) await antes(f, n); }
        return listaReal(f);
      };
      return () => n;
    };

    // T1 · WI-FI NÃO CONFIRMADO: a passada não parte, não arma o piso, e DIZ.
    const cT = await montar('t-rede');
    window.allCollections = () => [cT];
    let conferiu = 0;
    const realEstado = window.estadoDoFundo;
    window.estadoDoFundo = async (x) => { conferiu++; return realEstado(x); };
    try {
      window.networkType = () => 'unknown';
      fundosProximaPassadaEm = 0;
      await syncFundosAcervo();
      out.unknown = { conferiu, piso: fundosProximaPassadaEm, bloco: await blocoFundos() };
      window.networkType = () => 'wifi';

      // T2 · AS LETRAS NO AR: os fundos não partem (o mesmo host) e não armam.
      conferiu = 0;
      lyricSyncRunning = true;
      try { await syncFundosAcervo(); } finally { lyricSyncRunning = false; }
      out.comLetras = { conferiu, piso: fundosProximaPassadaEm };

      // T3 · UM DOWNLOAD PEDIDO EM CURSO: a varredura cede a vez a ele.
      conferiu = 0;
      const [bw, br] = [bgWorkCount, bgRotinaCount];
      bgWorkCount = 1; bgRotinaCount = 0;
      try { await syncFundosAcervo(); } finally { bgWorkCount = bw; bgRotinaCount = br; }
      out.comPedido = { conferiu, piso: fundosProximaPassadaEm };
    } finally { window.estadoDoFundo = realEstado; }

    // T4 · AS LETRAS CEDEM À PASSADA DOS FUNDOS — a outra metade do mesmo fio.
    //      A ORDEM É A ASSERÇÃO: primeiro COM a bandeira, depois o CONTROLE sem
    //      ela. Na ordem inversa o controle guardava a letra das faixas e a
    //      segunda chamada não tinha o que pedir com bandeira ou sem — a
    //      reversão pegou isso como tautologia.
    {
      const n2 = contarMusic();
      fundosPassadaRodando = true;
      try { await syncLyrics(); } finally { fundosPassadaRodando = false; Louvorja.fetchList = listaReal; }
      out.letrasComFundos = n2();
      const n = contarMusic();
      try { await syncLyrics(); } finally { Louvorja.fetchList = listaReal; }
      out.letrasLivres = n();
    }

    // T5 · SEM VER, NÃO SE CARIMBA: registro sem `lyrics` (o antigo) e
    //      leitura que lança ficam SEM veredito — nem alvo, nem "tem fundo".
    {
      const cid = 't-ver';
      const coll = { id: cid, name: 'Álbum Ver', kind: 'album' };
      collState[cid] = { indexSyncedAt: 0, songs: [
        { id_music: 501, name: 'Antiga', track: 1, fileIdFull: 'rec-antigo' },
        { id_music: 502, name: 'Quebrada', track: 2, fileIdFull: 'rec-quebrado' },
      ] };
      await AVDB.setState(fundoChave(cid), null);
      const get = AVDB.fileGet;
      AVDB.fileGet = async (id) => {
        if (id === 'rec-antigo') return { id, name: 'Antiga' };            // sem o campo `lyrics`
        if (id === 'rec-quebrado') throw new Error('leitura falhou');
        return get(id);
      };
      try { await syncImagensColecao(coll, { auto: true }); } finally { AVDB.fileGet = get; }
      out.semVer = (await AVDB.getState(fundoChave(cid))) || {};
    }

    // T6 · `metaOk` É DE CADA FAIXA: a 102 falha DEPOIS de a 101 ter recebido o
    //      metadado. Com um objeto só para a passada, a resposta da 101 valeria
    //      pela 102, que sairia da fila por seis dias sem ter sido perguntada.
    {
      const c6 = await montar('t-meta');
      Louvorja.fetchList = async (f) => {
        if (f === 'music_102') { await new Promise((r) => setTimeout(r, 80)); throw new TypeError('Failed to fetch'); }
        return listaReal(f);
      };
      try { await syncImagensColecao(c6, { auto: true }); } finally { Louvorja.fetchList = listaReal; }
      const d = (await AVDB.getState(fundoChave('t-meta'))) || {};
      out.meta = { v101: !!d[101], v102: !!d[102], v103: !!d[103] };
    }

    // T7 · A CENA ENTRA DEPOIS DE A REFEITURA PARTIR — o caso normal do culto.
    {
      const c7 = await montar('t-cena');
      const n = contarMusic(() => { midiaNoAr = true; });
      try { await syncImagensColecao(c7, { auto: true }); }
      finally { Louvorja.fetchList = listaReal; midiaNoAr = false; }
      out.cenaNoMeio = n();
    }

    // T8 · A COLEÇÃO EXCLUÍDA NO MEIO DA REFEITURA é abandonada: a lixeira
    //      troca o array do índice, e a identidade da faixa separa os casos.
    {
      const c8 = await montar('t-excluir');
      const n = contarMusic(() => { collState['t-excluir'] = { indexSyncedAt: 0, songs: [] }; });
      try { await syncImagensColecao(c8, { auto: true }); } finally { Louvorja.fetchList = listaReal; }
      out.excluida = { music: n(), vereditos: Object.keys((await AVDB.getState(fundoChave('t-excluir'))) || {}).length };
    }

    // T9 · AS CONTAS SÃO DO ACERVO: as duas coleções recebem o MESMO objeto.
    {
      const a = await montar('t-orc-a');
      const b = await montar('t-orc-b');
      window.allCollections = () => [a, b];
      const vistos = [];
      const real = window.syncImagensColecao;
      window.syncImagensColecao = (c, o) => { vistos.push(o && o.contas); return real(c, o); };
      fundosProximaPassadaEm = 0;
      try { await syncFundosAcervo(); } finally { window.syncImagensColecao = real; }
      out.orcamento = { n: vistos.length, mesmo: vistos.length === 2 && !!vistos[0] && vistos[0] === vistos[1] };
    }

    // T11 · A FONTE MUDA PARA A PASSADA. Sem teto, trinta faixas sem fundo
    //       com a fonte fora do ar seriam trinta perguntas sem resposta — e
    //       mil, no acervo do relato, a cada meia hora. Doze bastam para saber.
    {
      const cid = 't-muda';
      const songs = [];
      for (let i = 0; i < 30; i++) {
        const id = 'fm-' + i;
        await AVDB.fileAdd({ id, name: 'Muda ' + i, folder: cid, kind: 'audio',
          lyrics: [{ time: 0, text: 'linha', imageOpfsPath: null }] });
        songs.push({ id_music: 9000 + i, name: 'Muda ' + i, track: i + 1, fileIdFull: id });
      }
      const cM = { id: cid, name: 'Álbum Mudo', kind: 'album' };
      collState[cid] = { indexSyncedAt: 0, songs };
      await AVDB.setState(fundoChave(cid), null);
      window.allCollections = () => [cM];
      const cd = window.countDownloaded;
      window.countDownloaded = (id) => (id === cid ? 30 : cd(id));
      let n = 0;
      Louvorja.fetchList = async (f) => {
        if (String(f).startsWith('music_')) { n++; throw new TypeError('Failed to fetch'); }
        return listaReal(f);
      };
      fundosProximaPassadaEm = 0;
      try { await syncFundosAcervo(); }
      finally { Louvorja.fetchList = listaReal; window.countDownloaded = cd; }
      out.muda = { pedidos: n, fonteMuda: !!(fundosUltimaPassada && fundosUltimaPassada.fonteMuda),
        teto: FUNDO_FONTE_MUDA + NET_CONCURRENCY, bloco: await blocoFundos() };
    }

    // T10 · O BLOCO ESTÁ NO ARQUIVO QUE O OPERADOR COPIA, colado ao download.
    await renderDiag();
    const iAc = diagTexto.indexOf('Download do acervo');
    const iFu = diagTexto.indexOf('Fundos da letra (as fotos atrás da letra)');
    out.registro = { iAc, iFu };
    window.__imagem = null;
    return out;
  });
  checar(tt.unknown.conferiu === 0 && tt.unknown.piso === 0,
    'T1 · num aparelho que NÃO confirma o Wi-Fi a passada automática não parte nem arma o piso — são '
    + 'fotos que ninguém pediu agora, e `unknown` pode ser um 4G (a regra do episódio da semana)',
    JSON.stringify(tt.unknown));
  checar(/Wi-Fi confirmado/.test(tt.unknown.bloco) && /"unknown"/.test(tt.unknown.bloco),
    'T1 · e o Registro DIZ por que ela está parada, com o que o aparelho informa — um no-op mudo seria '
    + 'a rotina "ligada" com nada acontecendo, para sempre', tt.unknown.bloco);
  checar(tt.comLetras.conferiu === 0 && tt.comLetras.piso === 0,
    'T2 · com a varredura de LETRAS no ar os fundos não partem nem armam o piso: as duas pedem '
    + '`music_{id}` ao mesmo host, e o encadeamento só serializava a primeira chamada',
    JSON.stringify(tt.comLetras));
  checar(tt.comPedido.conferiu === 0 && tt.comPedido.piso === 0,
    'T3 · e com um download que o operador PEDIU em curso ela cede a vez a ele — `midiaNoAr` fica '
    + 'falso durante o download de um "Tocar agora", que é justamente o que ele acompanha na barra',
    JSON.stringify(tt.comPedido));
  checar(tt.letrasLivres > 0 && tt.letrasComFundos === 0,
    'T4 · e o inverso: com a passada dos fundos no ar a varredura de LETRAS cede (a premissa é o '
    + 'controle — sem a bandeira ela pede metadado)', JSON.stringify([tt.letrasLivres, tt.letrasComFundos]));
  checar(!tt.semVer[501] && !tt.semVer[502],
    'T5 · sem VER o fundo não se carimba: registro antigo sem letra e leitura que lança ficam sem '
    + 'veredito — um "tem fundo" ali era PERMANENTE, e a letra montada depois com o mesmo id ficava calada',
    JSON.stringify(tt.semVer));
  checar(tt.meta.v101 && tt.meta.v103 && !tt.meta.v102,
    'T6 · `metaOk` é de CADA faixa: a que falhou depois de a vizinha receber o metadado não herda a '
    + 'resposta dela, e não sai da fila por seis dias sem ter sido perguntada', JSON.stringify(tt.meta));
  checar(tt.cenaNoMeio === 1,
    'T7 · a cena que entra DEPOIS de a refeitura partir para as faixas seguintes — o caso normal do '
    + 'culto: o app abre, a varredura parte, e só então o operador toca', tt.cenaNoMeio);
  checar(tt.excluida.music === 1 && tt.excluida.vereditos === 0,
    'T8 · a coleção excluída no meio da refeitura é abandonada: sem isto a capa era gravada numa pasta '
    + 'recém-apagada e o peso voltava ao card de uma coleção removida', JSON.stringify(tt.excluida));
  checar(tt.orcamento.n === 2 && tt.orcamento.mesmo,
    'T9 · as CONTAS são do ACERVO: as duas coleções recebem o MESMO objeto — é nele que a fonte muda é '
    + 'vista (doze sem resposta numa coleção não recomeçam do zero na seguinte) e dele sai o retrato',
    JSON.stringify(tt.orcamento));
  checar(tt.muda.pedidos > 0 && tt.muda.pedidos <= tt.muda.teto && tt.muda.pedidos < 30 && tt.muda.fonteMuda,
    'T11 · com a fonte FORA DO AR a passada para depois de doze perguntas sem resposta (mais as que já '
    + 'estavam em voo) — sem teto, trinta faixas seriam trinta falhas, e mil no acervo do relato',
    JSON.stringify({ pedidos: tt.muda.pedidos, fonteMuda: tt.muda.fonteMuda }));
  checar(/a fonte das músicas não respondeu/.test(tt.muda.bloco),
    'T11 · e o Registro DIZ que ela parou e por quê — uma passada que para calada se lê como "a varredura '
    + 'desistiu"', tt.muda.bloco);
  checar(tt.registro.iAc >= 0 && tt.registro.iFu > tt.registro.iAc,
    'T10 · o bloco está no REGISTRO que o operador salva, logo depois do "Download do acervo" — chamar '
    + 'a função direto provava que ela existe, não que alguém a imprime', JSON.stringify(tt.registro));

  // ---- U: A PASSADA VOLTA SOZINHA, E A FOTO QUE NÃO VOLTOU NÃO CALA (v1.10.7) ----
  //
  // O relato: *"não houve nenhuma atualização das imagens … durante meus
  // testes"*. MEDIDO numa sonda com a abertura DE VERDADE (recarga, cadeia
  // inteira, nada chamado à mão): com o app parado a passada consertou as três
  // faixas em cinco segundos; com uma música tocando na abertura ela cedeu, a
  // cena saiu, e em um minuto de app à vista NADA aconteceu — quem a religava
  // era só o `visibilitychange`, e testar o app é ficar nele tocando mídia.
  const uu = await pg.evaluate(async () => {
    const out = {};
    const listaReal = Louvorja.fetchList;
    const montar = async (cid) => {
      const coll = { id: cid, name: 'Álbum ' + cid, kind: 'album', source: 'fonte-de-teste' };
      window.__modo = 'ok'; window.__modoImg = 'recusa'; window.__semFonte = false;
      window.__imagem = '/imagens/capa.jpg';
      collState[cid] = { indexSyncedAt: 0, songs: [] };
      await syncCollection(coll, { allowMobile: true });
      await AVDB.setState(fundoChave(cid), null);
      window.__modoImg = 'ok';
      return coll;
    };
    const fundos = async (cid) => Promise.all(collSongs(cid).map((x) => estadoDoFundo(x)));
    const novasContas = () => ({ conferidas: 0, tentadas: 0, refeitas: 0, comResposta: 0, semResposta: 0,
      recusadas: 0, ultimoStatus: null, fonteMuda: false });
    // N faixas BAIXADAS e sem fundo, plantadas direto (sem passar pelo download)
    // — o molde do T11. `prefixo` separa os ids de uma célula para outra.
    const plantar = async (cid, n, prefixo, base) => {
      const songs = [];
      for (let i = 0; i < n; i++) {
        const id = prefixo + i;
        await AVDB.fileAdd({ id, name: prefixo + i, folder: cid, kind: 'audio',
          lyrics: [{ time: 0, text: 'linha', imageOpfsPath: null }] });
        songs.push({ id_music: base + i, name: prefixo + i, track: i + 1, fileIdFull: id });
      }
      collState[cid] = { indexSyncedAt: 0, songs };
      await AVDB.setState(fundoChave(cid), null);
      return { id: cid, name: 'Álbum ' + cid, kind: 'album' };
    };
    const comAcervo = async (colls, fn) => {
      const ac = window.allCollections; const cd = window.countDownloaded;
      window.allCollections = () => colls;
      window.countDownloaded = (id) => (colls.some((c) => c.id === id) ? collSongs(id).length : cd(id));
      try { return await fn(); } finally { window.allCollections = ac; window.countDownloaded = cd; }
    };

    // U1 · A FOTO CUJO `fetch` NÃO VOLTOU não vira veredito de seis dias — e o
    //      CONTROLE é a mesma faixa com a fonte RESPONDENDO 404, que vira.
    {
      const c = await montar('u-foto');
      const contas = novasContas();
      window.__modoImg = 'semRede';
      try { await syncImagensColecao(c, { auto: true, contas }); } finally { window.__modoImg = 'ok'; }
      const semRede = (await AVDB.getState(fundoChave('u-foto'))) || {};
      out.fotoSemRede = { vereditos: Object.keys(semRede).length, contas: { ...contas } };
      window.__modoImg = 'recusa';
      try { await syncImagensColecao(c, { auto: true }); } finally { window.__modoImg = 'ok'; }
      const recusa = (await AVDB.getState(fundoChave('u-foto'))) || {};
      const valsRecusa = Object.values(recusa);
      out.fotoRecusa = valsRecusa.map((v) => v.tem);
      // U1b · A CAUSA VIAJA NO VEREDITO (v1.10.8) — não só o "não tem", mas
      // POR QUÊ, para sobreviver ao fechar o app e alcançar o Registro da
      // PRÓXIMA sessão, quando é ela que vê a passada ter de fato rodado.
      out.fotoRecusaCausa = valsRecusa.map((v) => ({ causa: v.causa, status: v.status, url: v.url }));
      out.blocoRecusa = await comAcervo([c], () => blocoFundos());
    }

    // U2 · O SERVIDOR DE FOTOS MUDO com o banco de pé também abre o disjuntor.
    {
      const cid = 'u-foto-muda';
      const songs = [];
      for (let i = 0; i < 30; i++) {
        const id = 'fu-' + i;
        await AVDB.fileAdd({ id, name: 'Foto ' + i, folder: cid, kind: 'audio',
          lyrics: [{ time: 0, text: 'linha', imageOpfsPath: null }] });
        songs.push({ id_music: 9100 + i, name: 'Foto ' + i, track: i + 1, fileIdFull: id });
      }
      const cM = { id: cid, name: 'Álbum das Fotos', kind: 'album' };
      collState[cid] = { indexSyncedAt: 0, songs };
      await AVDB.setState(fundoChave(cid), null);
      const ac = window.allCollections;
      window.allCollections = () => [cM];
      const cd = window.countDownloaded;
      window.countDownloaded = (id) => (id === cid ? 30 : cd(id));
      window.__imagem = '/imagens/muda.jpg';
      window.__modoImg = 'semRede';
      window.__pedidosImg = 0;
      fundosProximaPassadaEm = 0;
      try { await syncFundosAcervo(); }
      finally { window.__modoImg = 'ok'; window.countDownloaded = cd; window.allCollections = ac; }
      out.fotoMuda = { pedidos: window.__pedidosImg, fonteMuda: !!fundosUltimaPassada.fonteMuda,
        teto: FUNDO_FONTE_MUDA + NET_CONCURRENCY };
      delete collState[cid];
    }

    // U3 · A PASSADA CORTADA DEPOIS DE CONFERIR devolve o piso: o que ela
    //      aprendeu está no disco, e segurar meia hora era a cena custando a
    //      meia hora inteira depois de sair.
    {
      const c = await montar('u-corte');
      const ac = window.allCollections;
      window.allCollections = () => [c];
      let n = 0;
      Louvorja.fetchList = async (f) => {
        if (String(f).startsWith('music_')) { n++; midiaNoAr = true; }
        return listaReal(f);
      };
      fundosProximaPassadaEm = 0;
      try { await syncFundosAcervo(); }
      finally { Louvorja.fetchList = listaReal; midiaNoAr = false; window.allCollections = ac; }
      out.corte = { pedidos: n, conferidas: fundosUltimaPassada.conferidas,
        cortada: fundosUltimaPassada.cortada, piso: fundosProximaPassadaEm };
    }

    // U4 · O RELÓGIO RELIGA: a cena no ar, o tique não faz nada; a cena sai, o
    //      tique seguinte conserta. É o cenário do relato, sem abrir e fechar
    //      o app — e o controle de que o tique não conserta com a cena no ar é
    //      o que impede a asserção de passar por um tique que sempre roda.
    {
      const c = await montar('u-religa');
      const ac = window.allCollections;
      window.allCollections = () => [c];
      fundosProximaPassadaEm = 0;
      try {
        midiaNoAr = true;
        await syncFundosAcervo();
        await religarFundos();
        out.religaComCena = await fundos('u-religa');
        midiaNoAr = false;
        await religarFundos();
        out.religaSemCena = await fundos('u-religa');
      } finally { midiaNoAr = false; window.allCollections = ac; }
    }

    // U5 · MINIMIZADO O TIQUE NÃO PARTE: quem a traz de volta é a volta ao
    //      app. Uma passada de centenas de fotos não começa com o aparelho no
    //      bolso.
    {
      const c = await montar('u-oculto');
      const ac = window.allCollections;
      window.allCollections = () => [c];
      fundosProximaPassadaEm = 0;
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      try { await religarFundos(); }
      finally { delete document.visibilityState; window.allCollections = ac; }
      out.oculto = { fundos: await fundos('u-oculto'), visivel: document.visibilityState };
    }

    // U9 · SEM TETO PELA PORTA DE VERDADE: setenta faixas — mais que os 60 da
    //      v1.10.6 — conferidas E refeitas numa passada só de `syncFundosAcervo`.
    //      A célula de três faixas chamando a coleção direto não reprovava um
    //      corte de 60.
    {
      const c = await plantar('u-setenta', 70, 'st-', 9300);
      window.__imagem = '/imagens/setenta.jpg';
      fundosProximaPassadaEm = 0;
      await comAcervo([c], () => syncFundosAcervo());
      const u = fundosUltimaPassada;
      out.setenta = { tentadas: u.tentadas, refeitas: u.refeitas, fonteMuda: u.fonteMuda };
      delete collState['u-setenta'];
    }

    // U10 · A GUARDA `!comResposta` DO DISJUNTOR: a fonte MISTA — metade das
    //       perguntas responde, metade cai — passa das doze falhas e NÃO abre
    //       o disjuntor, porque a fonte está respondendo.
    {
      const c = await plantar('u-mista', 30, 'mx-', 9400);
      let n = 0;
      Louvorja.fetchList = async (f) => {
        if (String(f).startsWith('music_')) {
          n++;
          if (Number(String(f).slice(6)) % 2) throw new TypeError('Failed to fetch');
        }
        return listaReal(f);
      };
      fundosProximaPassadaEm = 0;
      try { await comAcervo([c], () => syncFundosAcervo()); } finally { Louvorja.fetchList = listaReal; }
      const u = fundosUltimaPassada;
      out.mista = { pedidos: n, tentadas: u.tentadas, fonteMuda: u.fonteMuda, semResposta: u.semResposta };
      delete collState['u-mista'];
    }

    // U11 · UM 404 NO METADADO É RESPOSTA SOBRE A FAIXA. Dezoito faixas que a
    //       fonte nega, NA FRENTE de cinco que ela entrega: contadas como "sem
    //       resposta", as dezoito abriam o disjuntor em toda passada e as
    //       cinco de trás nunca eram refeitas.
    {
      const a = await plantar('u-404', 18, 'nf-', 9500);
      const b = await plantar('u-boa', 5, 'bo-', 9600);
      window.__imagem = '/imagens/boa.jpg';
      const pedidosA = [0, 0];
      let passada = 0;
      Louvorja.fetchList = async (f) => {
        const id = Number(String(f).replace('music_', ''));
        if (String(f).startsWith('music_') && id >= 9500 && id < 9600) {
          pedidosA[passada]++;
          throw new Error('HTTP 404');
        }
        return listaReal(f);
      };
      try {
        fundosProximaPassadaEm = 0;
        await comAcervo([a, b], () => syncFundosAcervo());
        const boas = await fundos('u-boa');
        const u1 = { fonteMuda: fundosUltimaPassada.fonteMuda, comResposta: fundosUltimaPassada.comResposta };
        passada = 1;
        fundosProximaPassadaEm = 0;
        await comAcervo([a, b], () => syncFundosAcervo());
        out.http404 = { boas, u1, pedidosA };
      } finally { Louvorja.fetchList = listaReal; }
      delete collState['u-404']; delete collState['u-boa'];
    }

    // U12 · A FONTE RECUSANDO TUDO (401 — o token trocado): o disjuntor abre, e o
    //       Registro diz RECUSOU, com o status — "não respondeu" mandava
    //       procurar a rede.
    {
      const c = await plantar('u-401', 20, 'ua-', 9700);
      Louvorja.fetchList = async (f) => {
        if (String(f).startsWith('music_')) throw new Error('HTTP 401');
        return listaReal(f);
      };
      fundosProximaPassadaEm = 0;
      try { await comAcervo([c], () => syncFundosAcervo()); } finally { Louvorja.fetchList = listaReal; }
      out.h401 = { fonteMuda: fundosUltimaPassada.fonteMuda, recusadas: fundosUltimaPassada.recusadas,
        vereditos: Object.keys((await AVDB.getState(fundoChave('u-401'))) || {}).length,
        bloco: await comAcervo([c], () => blocoFundos()) };
      delete collState['u-401'];
    }

    // U13 · O RETRATO SÃO AS CONTAS VIVAS: lido no meio da refeitura da
    //       primeira coleção, ele diz o que já foi conferido e tentado — a
    //       cópia da partida dizia "0 conferida(s)" pelos minutos da refeitura.
    {
      const c = await plantar('u-vivo', 4, 'vv-', 9800);
      let visto = null;
      Louvorja.fetchList = async (f) => {
        if (String(f).startsWith('music_') && !visto) {
          visto = { conferidas: fundosUltimaPassada.conferidas, tentadas: fundosUltimaPassada.tentadas,
            bloco: await blocoFundos() };
        }
        return listaReal(f);
      };
      fundosProximaPassadaEm = 0;
      try { await comAcervo([c], () => syncFundosAcervo()); } finally { Louvorja.fetchList = listaReal; }
      out.vivo = visto;
      delete collState['u-vivo'];
    }

    // U8 · UMA PASSADA POR VEZ, pela BANDEIRA: com o piso zerado (o relógio
    //      corrigido para a frente no meio de uma passada longa) a segunda
    //      não parte — e o tique agora bate a cada minuto.
    {
      const c = await montar('u-uma');
      const ac = window.allCollections;
      window.allCollections = () => [c];
      let conferiu = 0;
      const real = window.estadoDoFundo;
      window.estadoDoFundo = async (x) => { conferiu++; return real(x); };
      fundosProximaPassadaEm = 0;
      fundosPassadaRodando = true;
      try { await syncFundosAcervo(); }
      finally { fundosPassadaRodando = false; window.estadoDoFundo = real; window.allCollections = ac; }
      out.umaPorVez = conferiu;
    }

    // U6 · A ABERTURA ARMA O RELÓGIO — chamar a função direto provava que ela
    //      existe, não que alguém a chama.
    out.relogio = (window.__intervalos || []).filter((x) => x.nome === 'religarFundos')
      .map((x) => x.ms);
    out.religaMs = FUNDO_RELIGA_MS;

    // U7 · A FRASE DO IMPEDIMENTO promete o que o relógio faz — era "volta na
    //      próxima vez que o app vier à frente", e ficar no app não a trazia.
    midiaNoAr = true;
    try { out.frase = await blocoFundos(); } finally { midiaNoAr = false; }

    window.__imagem = null;
    return out;
  });
  checar(uu.fotoSemRede.vereditos === 0 && uu.fotoSemRede.contas.semResposta === 3
    && uu.fotoSemRede.contas.comResposta === 0,
    'U1 · a foto cujo `fetch` NÃO VOLTOU não carimba seis dias de silêncio — uma oscilação de Wi-Fi '
    + 'não é a fonte dizendo que não tem foto — e conta como fonte MUDA', JSON.stringify(uu.fotoSemRede));
  checar(uu.fotoRecusa.length === 3 && uu.fotoRecusa.every((t) => t === false),
    'U1 · e o CONTROLE: com a fonte RESPONDENDO (404) o veredito é gravado, porque ali houve resposta',
    JSON.stringify(uu.fotoRecusa));
  checar(uu.fotoRecusaCausa.length === 3
    && uu.fotoRecusaCausa.every((v) => v.causa === 'http' && v.status === 404 && /\/imagens\//.test(v.url)),
    'U1b · e o VEREDITO carrega a causa, o status e o endereço tentado (v1.10.8) — não só "não tem", '
    + 'para a causa sobreviver ao fechar o app e alcançar o Registro da sessão em que a passada rodou',
    JSON.stringify(uu.fotoRecusaCausa));
  checar(/causa do que já foi tentado: 3× a fonte respondeu com erro/.test(uu.blocoRecusa)
    && /exemplo: HTTP 404 — .*\/imagens\//.test(uu.blocoRecusa),
    'U1c · e o "Fundos da letra" do Registro soma a DISTRIBUIÇÃO das causas, com um exemplo com '
    + 'endereço — sem isto o operador só tinha "o Registro diz por quê, quando a passada tiver '
    + 'rodado de novo", indefinidamente', uu.blocoRecusa);
  checar(uu.fotoMuda.pedidos > 0 && uu.fotoMuda.pedidos <= uu.fotoMuda.teto && uu.fotoMuda.pedidos < 30
    && uu.fotoMuda.fonteMuda,
    'U2 · com o servidor de FOTOS mudo e o banco de pé a passada também para em doze — sem isto eram '
    + 'duas requisições por faixa, mil faixas, a cada meia hora', JSON.stringify(uu.fotoMuda));
  checar(uu.corte.pedidos > 0 && uu.corte.conferidas > 0 && uu.corte.cortada && uu.corte.piso === 0,
    'U3 · a passada que a cena cortou DEPOIS de conferir devolve o piso — segurá-lo meia hora deixava '
    + 'a cena custando a meia hora inteira depois de sair', JSON.stringify(uu.corte));
  checar(uu.religaComCena.every((e) => e === 'falta') && uu.religaSemCena.every((e) => e === 'tem'),
    'U4 · o RELÓGIO religa: com a cena no ar o tique não faz nada, e o primeiro tique depois de ela '
    + 'sair conserta — sem sair do app, que é o cenário do relato',
    JSON.stringify([uu.religaComCena, uu.religaSemCena]));
  checar(uu.oculto.fundos.every((e) => e === 'falta') && uu.oculto.visivel === 'visible',
    'U5 · e minimizado o tique não parte (e a PREMISSA: o documento voltou a ser visível depois)',
    JSON.stringify(uu.oculto));
  checar(uu.setenta.tentadas === 70 && uu.setenta.refeitas === 70 && !uu.setenta.fonteMuda,
    'U9 · SEM TETO pela porta de verdade: setenta faixas sem fundo — mais que os 60 da v1.10.6 — são '
    + 'tentadas e refeitas numa passada só', JSON.stringify(uu.setenta));
  checar(uu.mista.pedidos === 30 && uu.mista.tentadas === 30 && !uu.mista.fonteMuda && uu.mista.semResposta >= 12,
    'U10 · com a fonte MISTA (metade responde, metade cai) a passada vai até o fim, mesmo passando de '
    + 'doze falhas: o disjuntor é para a fonte que NÃO responde, e esta responde', JSON.stringify(uu.mista));
  checar(uu.http404.boas.every((e) => e === 'tem') && !uu.http404.u1.fonteMuda
    && uu.http404.pedidosA[0] > 0 && uu.http404.pedidosA[1] === 0,
    'U11 · um 404 no metadado é resposta sobre a FAIXA: as dezoito negadas não abrem o disjuntor, as '
    + 'cinco de trás ganham fundo na mesma passada, e na seguinte as negadas nem são perguntadas (veredito '
    + 'de seis dias)', JSON.stringify(uu.http404));
  checar(uu.h401.fonteMuda && uu.h401.recusadas >= 12 && uu.h401.vereditos === 0
    && /recusou 12 perguntas seguidas \(HTTP 401\)/.test(uu.h401.bloco) && !/não respondeu/.test(uu.h401.bloco),
    'U12 · a fonte RECUSANDO tudo (401) abre o disjuntor sem gravar veredito, e o Registro diz "recusou", com '
    + 'o status — "não respondeu" mandava procurar a rede', JSON.stringify({ ...uu.h401, bloco: undefined }));
  checar(uu.vivo && uu.vivo.conferidas === 4 && uu.vivo.tentadas >= 1
    && /4 conferida\(s\), \d+ tentada\(s\)/.test(uu.vivo.bloco),
    'U13 · o retrato são as contas VIVAS: no meio da refeitura ele já diz o que foi conferido e tentado, e o '
    + 'Registro imprime as duas coisas — a cópia da partida dizia "0 conferida(s)" pelos minutos da refeitura',
    JSON.stringify(uu.vivo));
  checar(uu.umaPorVez === 0,
    'U8 · com uma passada no ar a segunda não parte, mesmo com o piso zerado — o piso é relógio, e um '
    + 'relógio corrigido para a frente abriria a porta a cada tique', uu.umaPorVez);
  checar(uu.relogio.length === 1 && uu.relogio[0] === uu.religaMs,
    'U6 · a ABERTURA arma o relógio que religa, UMA vez, no período da constante',
    JSON.stringify(uu.relogio));
  checar(/confere de novo a cada minuto/.test(uu.frase) && !/vier à frente/.test(uu.frase),
    'U7 · e o Registro promete o que o relógio faz — "a próxima vez que o app vier à frente" era a '
    + 'promessa que deixava o operador esperando dentro do app', uu.frase);


} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) { console.error('\n' + falhas.length + ' falha(s).'); process.exit(1); }
console.log('\nTodos passaram.');
