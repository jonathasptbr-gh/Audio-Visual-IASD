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

  // O ARNÊS DA FONTE: o banco (`json_db`) sempre responde — é ele que faz a
  // lista chegar e as estimativas aparecerem, que é o fato 2 do relato. Quem
  // varia é o servidor de ARQUIVOS (`/file`), que é onde os bytes moram.
  await pg.evaluate(() => {
    window.__fetchReal = window.fetch;
    window.__pedidos = 0;
    window.__modo = 'ok';       // ok | semRede | recusa
    window.__opfsQuebrado = false;
    const opfsReal = AVDB.opfsWriteFile;
    AVDB.opfsWriteFile = async (p, b) => {
      if (window.__opfsQuebrado) throw new DOMException('quota', 'QuotaExceededError');
      return opfsReal(p, b);
    };
    window.fetch = async (u, o) => {
      const s = String(u && u.url ? u.url : u);
      if (s.includes('api.louvorja.com.br/file')) {
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
      return {
        id_music: id,
        url_music: window.__semFonte ? '' : '/musics/' + id + '/cantado.mp3',
        url_image: null, has_instrumental_music: false,
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
} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) { console.error('\n' + falhas.length + ' falha(s).'); process.exit(1); }
console.log('\nTodos passaram.');
