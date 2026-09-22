// A VERIFICAÇÃO DO SISTEMA DIZ A VERDADE, E NÃO ATRAPALHA UM CULTO.
//
// ## Por que ele existe
//
// O relato que criou o recurso: *"esse foi um erro que passou despercebido no
// uso cotidiano do app, só notado por que está nos primeiros acessos"*. O erro
// era o da v1.9.13 — o download do acervo quebrado por inteiro, invisível por
// semanas porque quem já tem o acervo baixado nunca baixa de novo.
//
// Um autoteste tem DOIS jeitos de não servir para nada, e os dois são piores
// que não existir:
//
//  - **falso VERMELHO**: reprovar o que está certo. Um celular sem TV
//    reprovando todo o telão, um aparelho novo reprovando toda a biblioteca —
//    em duas rodadas o operador aprende que o vermelho desta folha não quer
//    dizer nada, e o recurso morre. É a regra `semFonte` da v5.134 aplicada a
//    um diagnóstico: "não existe" não é "falhou".
//  - **falso VERDE**: passar sem provar nada. Responde *"isso está coberto?"*
//    com um sim que não existe — que é a definição de oráculo inútil que este
//    repositório já escreveu duas vezes.
//
// E um terceiro, que é o que o culto cobra: **atrapalhar**. O botão está a dois
// toques da projeção.
//
// ## O que ele trava
//
// Os QUATRO desfechos separados pela causa certa (e a distinção entre *"não
// funcionou"* e *"não respondeu"*, que o operador pediu por extenso e que pede
// ações opostas), a checagem que teria pego a v1.9.13, o isolamento de uma
// checagem que lança, o silêncio no barramento, a limpeza atrás de si, e a
// tela e o Registro lendo a MESMA rodada.
//
//   node tools/verificacao-do-sistema.test.mjs
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperarCortina, checar, falhas, RAIZ_WEB, VIEWPORT } from './arnes.mjs';

const servidor = servirEstatico(RAIZ_WEB);
await new Promise((r) => servidor.listen(0, r));
const porta = servidor.address().port;
const navegador = await abrirNavegador();
const ctx = await navegador.newContext({ viewport: VIEWPORT });
await semRedeExterna(ctx);
const pg = await ctx.newPage();

try {
  await pg.goto(`http://localhost:${porta}/controle/`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(
    () => window.AVDB && typeof window.__avBack === 'function' && typeof window.rodarAutoteste === 'function',
    null, { timeout: 30000 },
  );
  await esperarCortina(pg);

  // O ESPIÃO DO BARRAMENTO é instalado ANTES da primeira rodada: o que ele
  // mede é uma AUSÊNCIA, e uma ausência só se mede a partir do começo.
  await pg.evaluate(() => {
    window.__cmds = [];
    const real = AVDB.sendCommand;
    AVDB.sendCommand = (m) => { window.__cmds.push(m && m.type); return real.call(AVDB, m); };
  });

  const r = await pg.evaluate(async () => {
    const res = await rodarAutoteste();
    const porId = {};
    for (const it of res.itens) porId[it.id] = it;
    return { res: { ok: res.ok, falhou: res.falhou, mudo: res.mudo, na: res.na, total: res.itens.length }, porId, cmds: window.__cmds.slice() };
  });

  // ---- A: OS QUATRO DESFECHOS, E O QUARTO É O QUE SALVA O RECURSO --------
  checar(r.res.total >= 30,
    'a bateria cobre o app inteiro, e não um punhado de linhas — o pedido foi "tudo que for possível"',
    r.res.total);
  checar(r.res.na > 0 && r.res.ok > 0,
    'num navegador sem ponte há OK e há NÃO SE APLICA: os dois desfechos existem e a rodada não é uniforme',
    JSON.stringify(r.res));
  // A CÉLULA: sem ponte nativa, tudo que depende do app Android é NÃO SE
  // APLICA — jamais falha. Sem esta regra, abrir o app num aparelho sem TV
  // pinta a folha inteira de vermelho e o operador para de ler.
  const semPonte = ['ponte', 'piso-shell', 'atualizacao', 'tv-listada', 'telao-no-ar', 'telas-rede', 'controles-fora', 'notificacao', 'espaco-pacote'];
  const reprovados = semPonte.filter((id) => r.porId[id] && r.porId[id].v !== 'na');
  checar(reprovados.length === 0,
    'sem o app Android nada disso REPROVA — "não existe" não é "falhou", e um falso vermelho por linha '
    + 'ensina o operador a ignorar a folha inteira',
    JSON.stringify(reprovados.map((id) => id + '=' + r.porId[id].v)));

  // ---- B: "NÃO RESPONDEU" NÃO É "NÃO FUNCIONOU" -------------------------
  // O operador pediu os dois por extenso, e eles pedem AÇÕES OPOSTAS: um manda
  // olhar o Wi-Fi, o outro manda avisar que a fonte mudou. É a mesma separação
  // que o censo do acervo faz entre "o servidor não respondeu" e "a fonte
  // respondeu HTTP 404".
  checar(r.porId['fonte-banco'] && r.porId['fonte-banco'].v === 'mudo',
    'com a internet bloqueada, a fonte entra como NÃO RESPONDEU — e não como "não funcionou", que '
    + 'mandaria o operador procurar defeito no app',
    r.porId['fonte-banco'] && r.porId['fonte-banco'].v + ' — ' + r.porId['fonte-banco'].nota);

  // ---- C: O SILÊNCIO NO BARRAMENTO --------------------------------------
  // A checagem mais importante do arquivo: o botão está a dois toques da
  // projeção, e a congregação não pode ver o autoteste.
  const proibidos = r.cmds.filter((t) => t && t !== 'diag-ask');
  checar(proibidos.length === 0,
    'a rodada inteira não manda NENHUM comando que mude a cena — só o `diag-ask`, que pede o diário '
    + 'e não toca no que está projetado',
    JSON.stringify(proibidos));

  // ---- D: A RODADA NÃO SUJA O APARELHO ----------------------------------
  // Um autoteste que deixa rastro não pode ser tocado duas vezes.
  const rastro = await pg.evaluate(async () => {
    const chaves = await AVDB.stateKeys('autoteste');
    const arquivos = await AVDB.opfsTodosOsArquivos();
    return {
      estado: (chaves || []).slice(),
      disco: (arquivos || []).map((x) => x.caminho).filter((c) => String(c).startsWith('autoteste')),
    };
  });
  checar(rastro.estado.length === 0 && rastro.disco.length === 0,
    'a sonda de escrita apaga o que criou — senão o segundo toque no botão mediria o lixo do primeiro',
    JSON.stringify(rastro));

  // ---- E: A TELA E O REGISTRO LEEM A MESMA RODADA -----------------------
  // Duas leituras da mesma rodada divergem no primeiro ajuste, e o que sai é
  // uma tela que discorda do arquivo que o operador mandou.
  const bloco = await pg.evaluate(() => blocoAutoteste());
  checar(/^Verificação do sistema\n/.test(bloco), 'o bloco do Registro existe e se nomeia', bloco.slice(0, 40));
  checar(bloco.includes(r.res.ok + ' ok · ' + r.res.falhou + ' com falha · ' + r.res.mudo + ' sem resposta'),
    'e o placar dele é o MESMO objeto que a tela desenha — não uma segunda contagem',
    bloco.split('\n')[2]);
  const linhasDoBloco = bloco.split('\n').filter((l) => /^ {4}(OK|FALHOU|SEM RESPOSTA|n\/a) /.test(l)).length;
  checar(linhasDoBloco === r.res.total,
    'e ele traz TODAS as linhas, não só as ruins: "o que funcionou" foi metade do pedido',
    linhasDoBloco + ' de ' + r.res.total);

  // ---- F: UMA CHECAGEM QUE LANÇA NÃO DERRUBA A RODADA -------------------
  const isolada = await pg.evaluate(async () => {
    const antes = TESTES.length;
    TESTES.push({ id: 'z-explode', area: 'Teste', titulo: 'uma que lança', fn: () => { throw new Error('estourei'); } });
    TESTES.push({ id: 'z-null', area: 'Teste', titulo: 'uma que não devolve nada', fn: async () => undefined });
    const res = await rodarAutoteste();
    TESTES.length = antes;
    const p = {};
    for (const it of res.itens) p[it.id] = it;
    return { total: res.itens.length, explode: p['z-explode'], nulo: p['z-null'], antes };
  });
  checar(isolada.total === isolada.antes + 2,
    'uma checagem que lança não interrompe as outras — ela é UMA linha do relatório, e a falha dela é '
    + 'o conteúdo daquela linha', isolada.total);
  checar(isolada.explode && isolada.explode.v === 'falhou' && /estourei/.test(isolada.explode.nota),
    'e a frase do erro vai para a linha, nunca um "[object Object]" no texto que o operador copia',
    JSON.stringify(isolada.explode));
  checar(isolada.nulo && isolada.nulo.v === 'falhou',
    'e uma checagem que não devolve desfecho conta como FALHA — o silêncio dela seria um falso verde',
    JSON.stringify(isolada.nulo));

  // ---- G: A FONTE QUE RESPONDE ERRADO É "NÃO FUNCIONOU" (a v1.9.13) -----
  //
  // ESTA É A CÉLULA DO RELATO. Na v1.9.13 o banco respondia tudo — a lista
  // aparecia, a estimativa aparecia, a barra andava — e só os BYTES não vinham,
  // porque o campo `url_*` virou URL absoluta e o app somava o prefixo por
  // cima. Aqui o banco responde e o servidor de arquivos dá 404, que é
  // exatamente o estado daquele lote.
  const comoNaV19013 = await pg.evaluate(async () => {
    const real = window.fetch;
    window.fetch = async (u, o) => {
      const s = String(u && u.url ? u.url : u);
      if (s.includes('api.louvorja.com.br/json_db/music_')) {
        return new Response(JSON.stringify({ id_music: 1, url_music: '/musics/1/cantado.mp3', lyric: {} }),
          { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (s.includes('api.louvorja.com.br/file')) return new Response('', { status: 404 });
      if (s.includes('api.louvorja.com.br/json_db')) {
        return new Response(JSON.stringify({ categories: [{ id: 1 }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return real(u, o);
    };
    // UMA FAIXA NO ÍNDICE DE UM HINÁRIO DE VERDADE: a checagem tira a faixa de
    // `allCollections()`, que traz os hinários fixos — um id inventado não
    // apareceria ali, e a checagem sairia como NÃO SE APLICA.
    const hinario = allCollections()[0].id;
    const guardado = collState[hinario];
    collState[hinario] = { indexSyncedAt: Date.now(), songs: [{ id_music: 1, name: 'Hino', track: 1 }] };
    const achada = TESTES.find((c) => c.id === 'fonte-arquivo');
    const banco = TESTES.find((c) => c.id === 'fonte-banco');
    const r1 = await rodarUmaChecagem(achada);
    const r2 = await rodarUmaChecagem(banco);
    window.fetch = real;
    if (guardado) collState[hinario] = guardado; else delete collState[hinario];
    return { arquivo: r1, banco: r2 };
  });
  checar(comoNaV19013.banco.v === 'ok',
    'PREMISSA da célula: o banco responde normalmente — é isso que fazia o defeito da v1.9.13 parecer '
    + 'falta de internet e passar despercebido', JSON.stringify(comoNaV19013.banco));
  checar(comoNaV19013.arquivo.v === 'falhou' && /404/.test(comoNaV19013.arquivo.nota),
    'e o servidor de ARQUIVOS respondendo 404 REPROVA, com o número junto — é esta linha que teria '
    + 'mostrado a v1.9.13 no primeiro toque, em vez de semanas depois',
    JSON.stringify(comoNaV19013.arquivo));

  // ---- H: COM MÍDIA NO AR, O QUE TOCA A CENA NÃO RODA -------------------
  const emCulto = await pg.evaluate(async () => {
    const antes = midiaNoAr;
    midiaNoAr = true;
    const res = await rodarAutoteste();
    midiaNoAr = antes;
    const p = {};
    for (const it of res.itens) p[it.id] = it;
    return { dec: p['decodificador'], armazenamento: p['opfs'] };
  });
  checar(emCulto.dec && emCulto.dec.v === 'na' && /mídia no ar/.test(emCulto.dec.nota),
    'com o louvor no ar, a checagem que abre um áudio sai como NÃO SE APLICA — um `play()` pede foco '
    + 'e o Chromium PAUSA o telão, que é uma interrupção de culto',
    JSON.stringify(emCulto.dec));
  checar(emCulto.armazenamento && emCulto.armazenamento.v !== 'na',
    'e o resto RODA assim mesmo: ceder a vez não é recusar a rodada — um toque que não faz nada é o '
    + 'pior desfecho de um botão', JSON.stringify(emCulto.armazenamento));

  // ---- I: A COR DO QUE PASSOU É AZUL, NUNCA VERDE -----------------------
  // A régua é do operador (v1.8.56): *"verde é para sinal de 'ligado'; nesses
  // casos são mensagem de conclusão, não de atividade"*. Uma checagem que
  // respondeu é uma conclusão.
  await pg.evaluate(() => { if (typeof setAppMode === 'function') setAppMode('full'); });
  await pg.click('#settingsBtn');
  await pg.waitForSelector('#fadePopup.open', { timeout: 5000 });
  await pg.click('#testeTile');
  await pg.waitForSelector('#testePopup.open', { timeout: 5000 });
  await pg.waitForFunction(() => !document.getElementById('testeRodar').disabled
    && document.querySelectorAll('#testeList .teste-item').length > 0, null, { timeout: 25000 });
  const tela = await pg.evaluate(() => {
    const cor = (sel) => {
      const el = document.querySelector(sel + ' .teste-marca');
      return el ? getComputedStyle(el).color : '';
    };
    const raiz = getComputedStyle(document.documentElement);
    const itens = [...document.querySelectorAll('#testeList .teste-item')];
    return {
      corOk: cor('.teste-item--ok'),
      accent: raiz.getPropertyValue('--accent').trim(),
      ok: raiz.getPropertyValue('--ok').trim(),
      itens: itens.length,
      comDesenho: itens.filter((i) => i.querySelector('.teste-marca svg path')).length,
      areas: document.querySelectorAll('#testeList .teste-area').length,
      resumo: document.getElementById('testeResumo').textContent,
    };
  });
  const rgb = (hex) => {
    const h = hex.replace('#', '');
    return 'rgb(' + parseInt(h.slice(0, 2), 16) + ', ' + parseInt(h.slice(2, 4), 16) + ', ' + parseInt(h.slice(4, 6), 16) + ')';
  };
  checar(tela.corOk === rgb(tela.accent),
    'o que PASSOU veste o azul de `--accent` — a conclusão de uma ação é azul neste app desde a '
    + 'v1.8.55, e o verde tem dois consumidores só (a TV no ar e o ponto do Auxiliar)',
    tela.corOk + ' vs ' + rgb(tela.accent));
  checar(tela.corOk !== rgb(tela.ok),
    'e NÃO é o verde: "verde é para sinal de ligado, nesses casos são mensagem de conclusão, não de '
    + 'atividade" — a régua é do operador', tela.corOk + ' vs ' + rgb(tela.ok));
  checar(tela.comDesenho === tela.itens && tela.itens > 0,
    'toda linha tem a marca DESENHADA: a fonte de símbolos é um subset de 31 codepoints e um de fora '
    + 'não desenha nada — um vão do tamanho de um ícone, sem erro nenhum', tela.comDesenho + '/' + tela.itens);
  checar(tela.areas >= 6, 'e a lista é agrupada por área, que é como o operador procura', tela.areas);
  checar(/funcionaram/.test(tela.resumo),
    'o resumo responde em UMA olhada, que é o que se lê antes de subir para a mesa de som', tela.resumo);

  // ---- J: O VOLTAR DEVOLVE CONFIGURAÇÕES --------------------------------
  const volta = await pg.evaluate(() => {
    window.__avBack();
    return {
      teste: document.getElementById('testePopup').classList.contains('open'),
      config: document.getElementById('fadePopup').classList.contains('open'),
    };
  });
  checar(!volta.teste && volta.config,
    'o voltar fecha esta folha e devolve Configurações, de onde ela nasceu — a tabela POPUPS é '
    + 'percorrida de trás para a frente, e a ordem dela diz isso', JSON.stringify(volta));

  // ---- K: OS FALSOS VERDES QUE A PRIMEIRA VERSÃO NÃO PODIA VER (v1.10.1) ----
  //
  // Uma revisão adversarial da v1.10.0 achou checagens que **não tinham como
  // reprovar** — e um falso verde é pior que a linha não existir, porque
  // responde *"isso está coberto?"* com um sim que não existe. As quatro daqui
  // foram MEDIDAS, não deduzidas.

  // K1 · A FONTE DOS ÍCONES. `document.fonts.check()` devolve **true com a
  // folha dos ícones AUSENTE** (sem `@font-face` declarada ele responde pela
  // fonte de recuo) — medido, com `document.fonts` VAZIO. A régua que resta é a
  // largura de avanço: o Material Symbols tem quadratura de em inteiro, então
  // um glifo dele mede exatamente o tamanho da fonte.
  const semFonte = await pg.evaluate(async () => {
    const achada = TESTES.find((c) => c.id === 'icones');
    const comFonte = await rodarUmaChecagem(achada);
    // a folha é trocada por uma família que NÃO tem quadratura de em
    const st = document.createElement('style');
    st.textContent = '.msym { font-family: monospace !important; }';
    document.head.appendChild(st);
    const semEla = await rodarUmaChecagem(achada);
    st.remove();
    return { comFonte, semEla, checkMente: document.fonts.check('24px "Material Symbols Outlined"') };
  });
  checar(semFonte.comFonte.v === 'ok',
    'K1 · com a fonte dos ícones no lugar a checagem passa', JSON.stringify(semFonte.comFonte));
  checar(semFonte.semEla.v === 'falhou',
    'K1 · e com os ícones caindo na fonte de recuo ela REPROVA — era um verde garantido, porque '
    + '`document.fonts.check()` responde `true` até com a folha ausente',
    JSON.stringify(semFonte.semEla));

  // K2 · O TELÃO. `simpleDisplay()` responde *"há alguma projeção"* (TV **ou**
  // computador da rede); a pergunta desta linha é *"a Presentation subiu?"*.
  // Com um computador projetando e o telão da TV no chão, ela saía VERDE
  // exatamente no estado que existe para pegar.
  const telao = await pg.evaluate(async () => {
    const achada = TESTES.find((c) => c.id === 'telao-no-ar');
    const resp = TESTES.find((c) => c.id === 'telao-responde');
    const nativo = window.__NATIVE__;
    const dsp = lastDisplays;
    const noAr = window.telaoNoAr; const daRede = window.telasDaRede;
    window.__NATIVE__ = true;
    lastDisplays = [{ id: 1, name: 'TV' }];
    window.telaoNoAr = () => null;                       // a Presentation está no chão
    window.telasDaRede = () => [{ rotulo: 'PC' }];       // e há um computador projetando
    const r1 = await rodarUmaChecagem(achada);
    const r2 = await rodarUmaChecagem(resp);
    window.__NATIVE__ = nativo; lastDisplays = dsp;
    window.telaoNoAr = noAr; window.telasDaRede = daRede;
    return { noAr: r1, responde: r2 };
  });
  checar(telao.noAr.v === 'falhou',
    'K2 · com a TV conectada e a projeção no chão a linha REPROVA, mesmo havendo um computador '
    + 'projetando — a régua é a Presentation, não "há alguma projeção"', JSON.stringify(telao.noAr));
  checar(telao.responde.v === 'na' && /computador/.test(telao.responde.nota),
    'K2 · e a do "responde aos comandos" sai NÃO SE APLICA em vez de SEM RESPOSTA: o `diag-dump` de '
    + 'um computador MORRE NO DRENO, então ali ela nunca teria resposta — um vermelho permanente',
    JSON.stringify(telao.responde));

  // K3 · O RELÓGIO SAIU DA TABELA (v1.10.5), e o que fica é a MEDIÇÃO que o
  // tirou — senão a próxima sessão o reescreve. Ele lia o cabeçalho `Date` da
  // resposta da origem; `Date` NÃO é cabeçalho de resposta liberado por
  // padrão no CORS, e a origem não manda `Access-Control-Expose-Headers`.
  // MEDIDO em Chromium com servidor local em dois origins: com
  // `Access-Control-Allow-Origin: *` o `headers.get('date')` devolve **null**;
  // só com `Expose-Headers: Date` ele devolve a hora. No aparelho do operador
  // a linha saiu "a internet não respondeu com a hora" — um `na` PERMANENTE,
  // e a regra da v1.10.2 manda uma linha assim sair da tabela.
  const semRelogio = await pg.evaluate(() => ({
    naTabela: TESTES.some((c) => c.id === 'relogio'),
    orfao: /testeHoraDoServidor/.test(String(window.rodarAutoteste)),
  }));
  checar(!semRelogio.naTabela && !semRelogio.orfao,
    'K3 · a linha do relógio não está mais na tabela, e não sobrou campo órfão dela — ela não '
    + 'tinha como responder: `Date` não é legível cross-origin sem o servidor o expor',
    JSON.stringify(semRelogio));

  // K4 · AS TRÊS CASAS DA VERSÃO. O `renderVersionLabel()` escreve
  // `'v' + WEB_VERSION` dentro do `#appVersion` na carga: ler o nó era comparar
  // `WEB_VERSION` consigo mesmo. A casa de verdade é o literal do documento.
  const versoes = await pg.evaluate(() => {
    const fonte = TESTES.find((c) => c.id === 'versoes').fn.toString();
    return { leDocumento: /index\.html/.test(fonte), leONo: /getElementById\('appVersion'\)/.test(fonte) };
  });
  checar(versoes.leDocumento && !versoes.leONo,
    'K4 · a terceira casa da versão sai do ARQUIVO e não do nó da tela, que o próprio app reescreve '
    + 'na carga — comparar o nó era comparar `WEB_VERSION` consigo mesmo', JSON.stringify(versoes));

  // K5 · O DECODIFICADOR. O WAV da v1.10.0 tinha o bloco `data` com ZERO bytes:
  // medido, `duration` saía `Infinity` e nenhum decodificador chegava a rodar.
  const wav = await pg.evaluate(async () => {
    const fonte = TESTES.find((c) => c.id === 'decodificador').fn.toString();
    const m = fonte.match(/base64,([A-Za-z0-9+/=]+)/);
    const bin = atob(m[1]);
    const bytes = new Uint8Array([...bin].map((c) => c.charCodeAt(0)));
    const tam = new DataView(bytes.buffer).getUint32(40, true);
    return { bytes: bytes.length, amostras: tam, exigeDuracao: /isFinite\(a\.duration\)/.test(fonte) };
  });
  checar(wav.amostras > 0,
    'K5 · o áudio de teste tem amostras de verdade — com o bloco `data` vazio o navegador lê 44 bytes '
    + 'de cabeçalho e nenhum decodificador roda', JSON.stringify(wav));
  checar(wav.exigeDuracao,
    'K5 · e a asserção é a DURAÇÃO finita, não o mero evento: um `loadedmetadata` com `Infinity` '
    + 'passava sem provar nada', wav.exigeDuracao);

  // ===== BLOCO L · AS CHECAGENS QUE AINDA MENTIAM (v1.10.2) =====
  //
  // A revisão adversarial da v1.10.1 achou mais SEIS, e a classe é a mesma: uma
  // linha que não pode reprovar responde *"isso está coberto?"* com um sim que
  // não existe. Cada asserção aqui rodou DUAS vezes — com o conserto e com ele
  // desfeito — e nenhuma passou nas duas.

  // L1 · CHEGAR NÃO É RODAR. `partes-do-bundle` aprova pelo TAMANHO do arquivo;
  // um erro de topo aborta só aquele script e a global nunca existe — arquivo
  // íntegro, 200 OK, recurso mudo. É a lição da v5.121.
  const modulos = await pg.evaluate(async () => {
    const achada = TESTES.find((c) => c.id === 'modulos');
    const inteiro = await rodarUmaChecagem(achada);
    const guardado = window.AVSorteio;
    delete window.AVSorteio;                 // o módulo entregou os bytes e não rodou
    const semUm = await rodarUmaChecagem(achada);
    window.AVSorteio = guardado;
    return { inteiro, semUm };
  });
  checar(modulos.inteiro.v === 'ok',
    'L1 · com os doze módulos de pé a checagem passa', JSON.stringify(modulos.inteiro));
  checar(modulos.semUm.v === 'falhou' && /playlist autom/.test(modulos.semUm.nota),
    'L1 · e um módulo que CHEGOU e não RODOU reprova, com o nome do recurso que fica mudo — o '
    + 'arquivo continua íntegro e de tamanho cheio, então a linha de cima não tem como vê-lo',
    JSON.stringify(modulos.semUm));

  // L2 · A AMOSTRA ALCANÇA A LISTA INTEIRA. A conta anterior dava passo 1 para
  // toda lista entre o teto e o DOBRO dele, e o `slice` entregava um bloco
  // CONTÍGUO do começo — que nestas listas é o hinário. A coleção recém-baixada
  // ficava fora da amostra e a linha saía verde.
  const amostra = await pg.evaluate(async () => {
    const achada = TESTES.find((c) => c.id === 'acervo-ids');
    const cols = window.allCollections; const songs = window.collSongs;
    const get = AVDB.fileGet;
    // 200 faixas: as 199 primeiras resolvem, a ÚLTIMA é órfã — a que chegou por
    // último, que é a que se quer conferir.
    const lista = Array.from({ length: 200 }, (_, i) => ({ name: 'f' + i, fileIdFull: 'id' + i }));
    window.allCollections = () => [{ id: 'c', name: 'Coleção' }];
    window.collSongs = () => lista;
    AVDB.fileGet = async (id) => (id === 'id199' ? null : { id });
    const r = await rodarUmaChecagem(achada);
    window.allCollections = cols; window.collSongs = songs; AVDB.fileGet = get;
    return r;
  });
  checar(amostra.v === 'falhou' && /f199/.test(amostra.nota),
    'L2 · numa lista de 200 com o teto em 120 a órfã do FIM entra na amostra — com o passo de '
    + 'antes (floor(200/120) = 1) o corte era o bloco 0..119 e ela nunca era conferida',
    JSON.stringify(amostra));

  // L3 · QUEM TIROU A CORTINA. O nó ausente é o desfecho dos DOIS caminhos — o
  // `pronto()` do fim do `init()` e o teto de 12 s do `<head>`, que é a rede de
  // segurança de um app que NÃO subiu. A linha perguntava pelo nó e saía verde
  // nos dois.
  const cortina = await pg.evaluate(async () => {
    const achada = TESTES.find((c) => c.id === 'cortina');
    const real = window.__avSplash;
    window.__avSplash = { motivo: 'pronto' };
    const subiu = await rodarUmaChecagem(achada);
    window.__avSplash = { motivo: 'prazo' };
    const resgatado = await rodarUmaChecagem(achada);
    window.__avSplash = { motivo: '' };
    const emCurso = await rodarUmaChecagem(achada);
    window.__avSplash = real;
    return { subiu, resgatado, emCurso, noSumiu: !document.getElementById('splash') };
  });
  checar(cortina.noSumiu,
    'L3 · PREMISSA: o nó da cortina já saiu do documento — é por isso que perguntar por ele não '
    + 'distinguia nada', cortina.noSumiu);
  checar(cortina.subiu.v === 'ok' && cortina.resgatado.v === 'falhou' && cortina.emCurso.v === 'na',
    'L3 · e os dois caminhos passam a ser distinguíveis: `pronto()` é verde, o teto de 12 s REPROVA '
    + '— o `controle.js` abortado no topo era o estado mais grave do app e saía como "funcionou"',
    JSON.stringify(cortina));

  // L4 · REDE NÃO É INTERNET. `navigator.onLine` responde por uma INTERFACE, e
  // a rede da igreja é o caso em que os dois divergem: um Wi-Fi sem uplink diz
  // `true`. O relatório se contradizia na própria altura.
  const internet = await pg.evaluate(async () => {
    const achada = TESTES.find((c) => c.id === 'internet');
    const real = window.fetch;
    window.fetch = () => Promise.reject(new TypeError('Failed to fetch'));
    const semSaida = await rodarUmaChecagem(achada);
    window.fetch = async () => new Response('', { status: 200 });
    const comSaida = await rodarUmaChecagem(achada);
    window.fetch = real;
    return { semSaida, comSaida, onLine: navigator.onLine };
  });
  checar(internet.onLine,
    'L4 · PREMISSA: o aparelho se diz conectado — é o estado em que a linha antiga saía verde',
    internet.onLine);
  checar(internet.semSaida.v === 'falhou' && internet.comSaida.v === 'ok',
    'L4 · conectado e SEM SAÍDA reprova, conectado e com saída passa — antes as duas saíam iguais, '
    + 'três linhas acima de quatro checagens dizendo "a internet não respondeu"',
    JSON.stringify(internet));

  // L5/L6 · OS DOIS GANCHOS QUE O SISTEMA CHAMA. `navigator.mediaSession` é de
  // outra API, que este app não usa e que o Chromium oferece sempre; e o pedido
  // das teclas é ENVIO MUDO, com a bandeira escrita na linha seguinte. As duas
  // linhas eram verdes garantidos. O que pode faltar são os ganchos de CÁ.
  const ganchos = await pg.evaluate(async () => {
    const fora = TESTES.find((c) => c.id === 'controles-fora');
    const vol = TESTES.find((c) => c.id === 'volume');
    const nativo = window.__NATIVE__; const av = window.AVNative;
    const rem = window.__avRemote; const vk = window.__avVolumeKey;
    window.__NATIVE__ = true;
    window.AVNative = Object.assign({}, av, { nowPlaying() {} });
    window.__avRemote = () => {}; window.__avVolumeKey = () => {};
    const foraOk = await rodarUmaChecagem(fora);
    const volOk = await rodarUmaChecagem(vol);
    delete window.__avRemote; delete window.__avVolumeKey;
    const foraSem = await rodarUmaChecagem(fora);
    const volSem = await rodarUmaChecagem(vol);
    window.__NATIVE__ = nativo; window.AVNative = av;
    window.__avRemote = rem; window.__avVolumeKey = vk;
    return { foraOk, volOk, foraSem, volSem, temApiWeb: !!navigator.mediaSession };
  });
  checar(ganchos.temApiWeb,
    'L5 · PREMISSA: o navegador oferece `navigator.mediaSession` — era isso que a linha media, e '
    + 'é por isso que ela nunca reprovava', ganchos.temApiWeb);
  checar(ganchos.foraOk.v === 'ok' && ganchos.foraSem.v === 'falhou',
    'L5 · sem o gancho `__avRemote` os botões da tela de bloqueio ficam desenhados e INERTES, e a '
    + 'linha passa a dizer isso', JSON.stringify(ganchos));
  // L6 · A RÉGUA AQUI É A CAUSA, NÃO O DESFECHO. Fora do app a bandeira do
  // pedido é `false` e a linha reprova pelos dois lados — o que a asserção mede
  // é QUAL das duas causas ela nomeia, porque é isso que o conserto mudou:
  // desfeito, as duas saem com a frase da bandeira e o gancho nunca é olhado.
  checar(/painel de volume/.test(ganchos.volOk.nota) && /não acham quem responda/.test(ganchos.volSem.nota),
    'L6 · com o gancho `__avVolumeKey` de pé a causa é a bandeira do pedido; SEM ele a causa passa a '
    + 'ser o gancho — as teclas físicas não acham quem responda, que é o desfecho mais confuso dos '
    + 'dois e o único que o envio mudo da ponte jamais acusaria', JSON.stringify(ganchos));

  // L7 · O "VERIFICANDO…" EXISTE DE VERDADE. A trava só era erguida DENTRO de
  // `rodarAutoteste`, e o desenho vinha antes da chamada: o ramo nunca
  // executava. A folha ficava em BRANCO a rodada inteira na primeira abertura
  // e, da segunda em diante, mostrava o veredito da rodada ANTERIOR com o aro
  // girando por cima.
  const durante = await pg.evaluate(async () => {
    const p = dispararTeste();
    const noAto = document.getElementById('testeResumo').textContent;
    const travada = testeRodando;
    await p;
    return { noAto, travada, depois: document.getElementById('testeResumo').textContent };
  });
  checar(durante.travada && /Verificando/.test(durante.noAto),
    'L7 · a folha diz "Verificando…" DURANTE a rodada — o prólogo de `rodarAutoteste` é síncrono, e '
    + 'é por isso que o desenho tem de vir depois da chamada e antes do `await`',
    JSON.stringify(durante.noAto));
  checar(/funcionaram/.test(durante.depois),
    'L7 · e o veredito substitui o aviso quando ela termina', JSON.stringify(durante.depois));

  // L8 · ZERO É UM NÚMERO. `!bytes` engolia o disco CHEIO junto com "o aparelho
  // não informou" — duas causas opostas na mesma linha, e a que importa saía
  // como "não se aplica".
  const pacote = await pg.evaluate(async () => {
    const achada = TESTES.find((c) => c.id === 'espaco-pacote');
    const nativo = window.__NATIVE__; const av = window.AVNative;
    window.__NATIVE__ = true;
    window.AVNative = Object.assign({}, av, { pacoteEspaco: async () => 0 });
    const cheio = await rodarUmaChecagem(achada);
    window.AVNative = Object.assign({}, av, { pacoteEspaco: async () => null });
    const mudo = await rodarUmaChecagem(achada);
    window.__NATIVE__ = nativo; window.AVNative = av;
    return { cheio, mudo };
  });
  checar(pacote.cheio.v !== 'na' || !/não informou/.test(pacote.cheio.nota),
    'L8 · disco ZERADO não é "o aparelho não informou" — com `!bytes` as duas causas opostas saíam '
    + 'na mesma frase, e a que importa era a que sumia', JSON.stringify(pacote.cheio));
  checar(pacote.mudo.v === 'na' && /não informou/.test(pacote.mudo.nota),
    'L8 · e o aparelho que de fato não informa continua sendo "não se aplica"',
    JSON.stringify(pacote.mudo));

  // ===== BLOCO M · O SALVAR DA FOLHA (v1.10.3) =====
  //
  // Pedido do operador: *"faça com que essa verificação, após feita, tenha uma
  // botão para salvar o registro normal + os dados dessa verificação"*. Ele
  // revoga a decisão da v1.10.0 de não haver salvar aqui — e o ARGUMENTO
  // daquela decisão é o que este bloco trava: **o arquivo continua sendo UM**.

  // M1 · SEM PONTE ELE NÃO EXISTE. Gravar arquivo é o SAF; um botão que só sabe
  // não funcionar é pior que botão nenhum, e é a regra do `#diagSave`.
  const semPonteSalvar = await pg.evaluate(() => {
    const sv = document.getElementById('testeSalvar');
    return { existe: !!sv, hidden: sv && sv.hidden, display: sv && getComputedStyle(sv).display,
      largura: sv ? sv.getBoundingClientRect().width : -1, nativo: !!window.__NATIVE__ };
  });
  checar(semPonteSalvar.existe && !semPonteSalvar.nativo,
    'M1 · PREMISSA: o botão está no documento e esta página não tem ponte', JSON.stringify(semPonteSalvar));
  checar(semPonteSalvar.hidden && semPonteSalvar.display === 'none' && semPonteSalvar.largura === 0,
    'M1 · e sem ponte ele não é desenhado nem ocupa lugar — gravar arquivo é o seletor do sistema, '
    + 'e o navegador não o tem', JSON.stringify(semPonteSalvar));

  // M2 · O QUADRADO DA FAIXA. Dois rótulos não cabem lado a lado — MEDIDO, a
  // 320px com a fonte a 1,5× sobram 286px e só "Verificar de novo" pede 224.
  // É o caso declarado da v1.8.57, e a faixa com irmão tem UMA altura (v1.8.61).
  const caixa = await pg.evaluate(async () => {
    const sv = document.getElementById('testeSalvar');
    window.__NATIVE__ = true; sv.hidden = false;
    openTestePopup();
    // ESPERA O FATO, NUNCA UM PRAZO: `openTestePopup` dispara uma rodada e não a
    // aguarda. Sob carga (o CI roda três oráculos de cada vez) um `setTimeout`
    // curto deixa a rodada em voo, e os blocos seguintes leem o estado no meio
    // dela — uma reprovação por carga do runner chega indistinguível de um
    // defeito do app, que é a primeira classe que a campanha da v5.316 teve de
    // corrigir uma a uma.
    while (testeRodando || !testeResultado) await new Promise((r) => setTimeout(r, 20));
    const go = document.getElementById('testeRodar');
    const a = sv.getBoundingClientRect(); const b = go.getBoundingClientRect();
    const svg = sv.querySelector('svg').getBoundingClientRect();
    return {
      sv: [+a.width.toFixed(1), +a.height.toFixed(1)],
      go: [+b.width.toFixed(1), +b.height.toFixed(1)],
      svg: [+svg.width.toFixed(1), +svg.height.toFixed(1)],
      cortou: go.scrollWidth > go.clientWidth + 1,
    };
  });
  checar(Math.abs(caixa.sv[0] - caixa.sv[1]) < 0.5,
    'M2 · ele é QUADRADO, nas duas dimensões declaradas — um botão sem rótulo não sai de dois '
    + 'tamanhos por esticamento (v1.8.57)', JSON.stringify(caixa.sv));
  checar(Math.abs(caixa.sv[1] - caixa.go[1]) < 0.5,
    'M2 · e a faixa de fecho com irmão tem UMA altura só (v1.8.61)', JSON.stringify(caixa));
  checar(!caixa.cortou && caixa.svg[0] > 0,
    'M2 · o rótulo do primário continua inteiro ao lado dele, e o ícone DESENHA — a fonte de '
    + 'símbolos é um subset de 31 codepoints, então aqui é `<use>` de um `<symbol>`, como no '
    + 'salvar do Registro', JSON.stringify(caixa));

  // M3 · O ARQUIVO É UM SÓ, e é o do Registro. `blocoAutoteste()` já é um bloco
  // do `renderDiag()`: o que o botão salva É "o registro normal + os dados
  // desta verificação". Um segundo artefato parecido faria quem lê a distância
  // perguntar qual dos dois é o de verdade — o argumento que a v1.10.0 escreveu
  // e que sobrevive a esta revogação.
  const salvo = await pg.evaluate(async () => {
    const pedidos = [];
    const av = window.AVNative;
    window.AVNative = Object.assign({}, av, {
      salvarTexto: (nome, texto) => { pedidos.push({ nome, texto }); return Promise.resolve('/mnt/x/' + nome); },
    });
    await rodarAutoteste();
    await salvarRegistroDaVerificacao();
    window.AVNative = av;
    const t = pedidos[0] ? pedidos[0].texto : '';
    return {
      n: pedidos.length,
      nome: pedidos[0] ? pedidos[0].nome : '',
      temVerificacao: /Verificação do sistema/.test(t),
      temCabecalho: t.slice(0, 400).length > 0 && !/^Verificação do sistema/.test(t),
      bytes: t.length,
      igualAoRegistro: t === diagTexto,
    };
  });
  checar(salvo.n === 1 && salvo.bytes > 200,
    'M3 · um toque grava UM arquivo, com conteúdo', JSON.stringify(salvo));
  checar(salvo.igualAoRegistro && salvo.temVerificacao && salvo.temCabecalho,
    'M3 · e o que ele grava é o REGISTRO INTEIRO com a verificação dentro — não um segundo '
    + 'artefato parecido, que é o que faria quem lê a distância perguntar qual dos dois vale',
    JSON.stringify(salvo));
  checar(/^registro-av-\d{8}-\d{4}\.txt$/.test(salvo.nome),
    'M3 · com o MESMO nome do salvar de Configurações: duas portas, um arquivo, um padrão de nome',
    salvo.nome);

  // M4 · ELE MONTA O TEXTO ANTES DE GRAVAR. `dispararTeste` chama `renderDiag()`
  // SEM `await`, e aquela função vai à ponte cinco vezes: um toque logo depois
  // da rodada pegaria a montagem ANTERIOR — ou, na primeira abertura do app, a
  // string VAZIA com que `diagTexto` nasce. Um arquivo de zero byte que o
  // operador manda achando que mandou o Registro é o pior desfecho deste botão.
  const frescor = await pg.evaluate(() => {
    const f = salvarRegistroDaVerificacao.toString();
    return { esperaOTexto: /await\s+renderDiag\(\)/.test(f), recusaVazio: /if\s*\(!diagTexto\)/.test(f) };
  });
  checar(frescor.esperaOTexto,
    'M4 · ele ESPERA a montagem do Registro antes de gravar — sem isso o arquivo sai com a '
    + 'montagem anterior, ou vazio na primeira abertura do app', JSON.stringify(frescor));
  const vazio = await pg.evaluate(async () => {
    const pedidos = [];
    const av = window.AVNative; const real = window.renderDiag;
    window.AVNative = Object.assign({}, av, {
      salvarTexto: (nome, texto) => { pedidos.push(texto); return Promise.resolve('/mnt/x'); },
    });
    // a montagem devolve cedo (outra assumiu): `diagTexto` fica vazio
    const guardado = diagTexto;
    window.renderDiag = async () => { diagTexto = ''; };
    await salvarRegistroDaVerificacao();
    window.renderDiag = real; window.AVNative = av; diagTexto = guardado;
    return { gravou: pedidos.length };
  });
  checar(vazio.gravou === 0,
    'M4 · e um texto VAZIO nunca é gravado: o `renderDiag` tem guarda de sequência e volta cedo '
    + 'quando outra montagem assume — gravar ali seria o arquivo que discorda do aparelho',
    JSON.stringify(vazio));

  // M5 · "APÓS FEITA" É A PALAVRA DO PEDIDO. Durante a rodada o arquivo sairia
  // com o resultado da ANTERIOR; antes da primeira, sem nenhum. É `disabled`
  // com o `title` dizendo por quê, nunca um botão aceso que não faz nada.
  const trava = await pg.evaluate(async () => {
    const sv = document.getElementById('testeSalvar');
    const guardado = testeResultado;
    testeResultado = null; desenharTeste();
    const semRodada = { off: sv.disabled, title: sv.title };
    const p = dispararTeste();
    const durante = { off: sv.disabled, title: sv.title };
    await p;
    const depois = { off: sv.disabled, title: sv.title };
    testeResultado = guardado;
    return { semRodada, durante, depois };
  });
  checar(trava.semRodada.off && /[Nn]ada verificado/.test(trava.semRodada.title),
    'M5 · sem rodada na mão ele é APAGADO, com o motivo no `title`', JSON.stringify(trava.semRodada));
  checar(trava.durante.off && /[Ee]spere/.test(trava.durante.title),
    'M5 · durante a rodada também, e a razão MUDA com o estado — salvar ali gravaria o resultado '
    + 'da rodada anterior', JSON.stringify(trava.durante));
  checar(!trava.depois.off,
    'M5 · e ele acende quando a verificação termina, que é o "após feita" do pedido',
    JSON.stringify(trava.depois));

  // ===== BLOCO N · AS SETE LINHAS NOVAS (v1.10.4) =====
  //
  // *"Deve abranger tudo que for possível"*, na segunda metade do pedido que
  // criou o recurso. Cada uma destas sete pega um defeito que **nenhuma das 34
  // anteriores alcançava**, e cada asserção aqui mede a CÉLULA em que ela
  // reprova por defeito de verdade — nunca a existência da função.

  // N1 · A PASTA QUE MOSTRA ZERO. O número gravado em zero sobre uma pasta que
  // TEM arquivos desarma a recuperação automática do app: o pedido de pasta de
  // novo é guardado por `count > 0`, então uma permissão revogada deixa de ser
  // recuperável sozinha.
  const pastas = await pg.evaluate(async () => {
    const achada = TESTES.find((c) => c.id === 'pastas-contagem');
    const fbf = AVDB.filesByFolder; const guardado = opfsFolders; const busy = syncBusy;
    syncBusy = false;
    AVDB.filesByFolder = async () => [1, 2, 3, 4, 5];
    opfsFolders = [{ id: 'p1', name: 'Vídeos do culto', count: 5 }];
    const certo = await rodarUmaChecagem(achada);
    opfsFolders = [{ id: 'p1', name: 'Vídeos do culto', count: 0 }];
    const zerada = await rodarUmaChecagem(achada);
    opfsFolders = [{ id: 'p1', name: 'Vídeos do culto', count: 2 }];
    const errada = await rodarUmaChecagem(achada);
    opfsFolders = []; const semPasta = await rodarUmaChecagem(achada);
    AVDB.filesByFolder = fbf; opfsFolders = guardado; syncBusy = busy;
    return { certo, zerada, errada, semPasta };
  });
  checar(pastas.certo.v === 'ok' && pastas.semPasta.v === 'na',
    'N1 · pasta em dia passa, e um aparelho sem pasta nenhuma sai NÃO SE APLICA — a pergunta não '
    + 'existe ali', JSON.stringify([pastas.certo, pastas.semPasta]));
  checar(pastas.zerada.v === 'falhou' && /zero o app não percebe/.test(pastas.zerada.nota),
    'N1 · e a pasta que MOSTRA ZERO e tem cinco reprova nomeando o preço: com o número em zero o '
    + 'app não pede a pasta de novo quando ela para de responder', JSON.stringify(pastas.zerada));
  checar(pastas.errada.v === 'falhou' && /mostra 2 e tem 5/.test(pastas.errada.nota),
    'N1 · e a contagem só errada reprova com os DOIS números — "a cópia parou no meio" é outra '
    + 'ação que "toque em sincronizar porque o zero desarma o resgate"', JSON.stringify(pastas.errada));

  // N2 · A BÍBLIA EMPAREDADA. A bandeira e o texto são o mesmo fato em dois
  // lugares, e nada os mantém juntos: com a bandeira de pé sobre um banco
  // vazio, a varredura devolve cedo NA BANDEIRA e a versão nunca mais é
  // rebaixada. A folha diz "Completa offline" e o erro só aparece no púlpito.
  const biblia = await pg.evaluate(async () => {
    const achada = TESTES.find((c) => c.id === 'biblia-completa');
    const gs = AVDB.getState; const sk = AVDB.stateKeys;
    const vs = bibleVersions; const bb = bibleBooksOnline;
    bibleVersions = [{ id: 1, name: 'Almeida Revista' }];
    bibleBooksOnline = null;
    AVDB.getState = async (k) => (k === 'bibleComplete:1' ? true : (k === 'bibleBooks' ? null : null));
    // o banco INTEIRO no lugar
    const todas = [];
    Bible.BOOKS.forEach((b, i) => { for (let c = 1; c <= b.chapters; c++) todas.push('bible:1_' + (i + 1) + '_' + c); });
    AVDB.stateKeys = async () => todas.slice();
    const completa = await rodarUmaChecagem(achada);
    // o EMPAREDADO: bandeira de pé, zero capítulos
    AVDB.stateKeys = async () => [];
    const vazia = await rodarUmaChecagem(achada);
    // e o banco com UM buraco
    AVDB.stateKeys = async () => todas.slice(1);
    const furada = await rodarUmaChecagem(achada);
    // sem bandeira nenhuma
    AVDB.getState = async () => null;
    AVDB.stateKeys = async () => todas.slice();
    const semBandeira = await rodarUmaChecagem(achada);
    AVDB.getState = gs; AVDB.stateKeys = sk; bibleVersions = vs; bibleBooksOnline = bb;
    return { completa, vazia, furada, semBandeira, total: todas.length };
  });
  checar(biblia.completa.v === 'ok' && biblia.semBandeira.v === 'na',
    'N2 · PREMISSA: com os ' + biblia.total + ' capítulos no lugar ela passa, e sem versão marcada '
    + 'ela não se pronuncia', JSON.stringify([biblia.completa, biblia.semBandeira]));
  checar(biblia.vazia.v === 'falhou' && /não volta a baixar sozinha/.test(biblia.vazia.nota),
    'N2 · a versão EMPAREDADA reprova — bandeira de pé, zero capítulos — e a nota manda escolher '
    + 'OUTRA versão, porque nesta o botão de excluir nem é desenhado', JSON.stringify(biblia.vazia));
  checar(biblia.furada.v === 'falhou' && /faltam 1 de /.test(biblia.furada.nota)
    && /exclua esta versão/.test(biblia.furada.nota),
    'N2 · e um ÚNICO capítulo faltando reprova com outra ação: ali há o que excluir, e a conta diz '
    + 'quantos', JSON.stringify(biblia.furada));

  // N3 · A VERSÃO QUE ABRE NO PÚLPITO. O app garante offline a versão PADRÃO;
  // a leitura usa a ESCOLHA do operador. Com a rede da igreja fora a varredura
  // da escolhida desiste, e nada fora do seletor de versões diz isso.
  const emUso = await pg.evaluate(async () => {
    const achada = TESTES.find((c) => c.id === 'biblia-em-uso');
    const gs = AVDB.getState; const sk = AVDB.stateKeys;
    const vs = bibleVersions; const vid = bibleVersionId; const bb = bibleBooksOnline;
    bibleVersions = [{ id: 1, name: 'Almeida' }, { id: 2, name: 'NVI' }];
    bibleBooksOnline = null; bibleVersionId = 2;
    AVDB.getState = async () => null;               // a 2 NÃO está marcada
    const daOutra = [];
    Bible.BOOKS.forEach((b, i) => { for (let c = 1; c <= b.chapters; c++) daOutra.push('bible:1_' + (i + 1) + '_' + c); });
    AVDB.stateKeys = async () => daOutra.slice();   // só a versão 1 no disco
    const metade = await rodarUmaChecagem(achada);
    AVDB.stateKeys = async () => [];                // nada de Bíblia nenhuma
    const aparelhoNovo = await rodarUmaChecagem(achada);
    AVDB.getState = gs; AVDB.stateKeys = sk;
    bibleVersions = vs; bibleVersionId = vid; bibleBooksOnline = bb;
    return { metade, aparelhoNovo };
  });
  checar(emUso.metade.v === 'falhou' && /NVI é a versão que abre no púlpito/.test(emUso.metade.nota)
    && / 0 de /.test(emUso.metade.nota),
    'N3 · com o texto de OUTRA versão no disco e nenhum da escolhida, ela reprova NOMEANDO a '
    + 'escolhida — o app garante uma e o púlpito abre a outra', JSON.stringify(emUso.metade));
  checar(emUso.aparelhoNovo.v === 'na',
    'N3 · e o aparelho sem Bíblia NENHUMA sai NÃO SE APLICA: ali o app ainda vai baixar uma '
    + 'sozinho, e reprovar seria a parede vermelha do aparelho novo', JSON.stringify(emUso.aparelhoNovo));

  // N4 · A CIFRA QUE SOME POR UM MÊS. Um veredito "não tem" vale 30 dias, e a
  // aba nem é desenhada sem folha na mão (v1.8.28): um site que mudou de
  // endereço tira a cifra do app por um mês, sem uma linha em lugar nenhum.
  const cifra = await pg.evaluate(async () => {
    const achada = TESTES.find((c) => c.id === 'cifra-acervo');
    const ac = window.allCollections; const cs = window.collSongs;
    const cd = window.countDownloaded; const gs = AVDB.getState;
    const hinos = Array.from({ length: 40 }, (_, i) => ({ name: 'Hino ' + (i + 1) }));
    // O id É O DO CATÁLOGO da cifra (`AVCifra.CATALOGO`), e não um inventado:
    // `cifraDeduzivel` pergunta por ele, e uma coleção fora dali não entra na
    // conta — que é justamente a regra que a linha existe para honrar.
    window.allCollections = () => [{ id: 'hymnal-2022', name: 'Hinário 2022', kind: 'hymnal' }];
    window.collSongs = () => hinos;
    window.countDownloaded = () => 40;
    const agora = Date.now();
    const mapa = (comFolha) => {
      const o = {};
      hinos.forEach((h, i) => {
        const k = cifraChaveNoDisco(h.name);
        if (k) o[k] = comFolha && i < 30 ? { pagina: '<html>', em: agora } : { semCifra: true, em: agora };
      });
      return o;
    };
    AVDB.getState = async () => mapa(true);
    const comCifras = await rodarUmaChecagem(achada);
    AVDB.getState = async () => mapa(false);   // o site mudou: NENHUMA folha
    const siteMudou = await rodarUmaChecagem(achada);
    AVDB.getState = async () => ({});          // nunca varrido
    const novo = await rodarUmaChecagem(achada);
    window.allCollections = ac; window.collSongs = cs;
    window.countDownloaded = cd; AVDB.getState = gs;
    return { comCifras, siteMudou, novo };
  });
  checar(cifra.comCifras.v === 'ok' && /30 de 40/.test(cifra.comCifras.nota),
    'N4 · PREMISSA: com 30 folhas em 40 hinos julgados ela passa, e diz a proporção',
    JSON.stringify(cifra.comCifras));
  checar(cifra.siteMudou.v === 'falhou' && /NENHUMA cifra guardada/.test(cifra.siteMudou.nota),
    'N4 · e 40 hinos respondidos com ZERO folhas reprova: no hinário toda música tem cifra no '
    + 'site, então zero é o site que mudou — não o acervo que não tem', JSON.stringify(cifra.siteMudou));
  checar(cifra.novo.v === 'na',
    'N4 · o aparelho que a varredura ainda não visitou sai NÃO SE APLICA — abaixo do piso a conta '
    + 'não vale, e reprovar ali seria vermelho em todo aparelho novo', JSON.stringify(cifra.novo));

  // N5 e N6 · AS TRÊS LISTAS DO OPERADOR. O `acervo-ids` varre as COLEÇÕES e
  // não alcança o Cronograma, os Favoritos nem a prateleira. São dois degraus
  // do MESMO caminho de quem executa — o id resolve? o registro tem bytes? —
  // e por isso duas linhas, com ações diferentes.
  const listas = await pg.evaluate(async () => {
    const sumidas = TESTES.find((c) => c.id === 'listas-sumidas');
    const arq = TESTES.find((c) => c.id === 'listas-arquivo');
    const li = AVDB.listIds; const gm = AVDB.getMedia; const og = AVDB.opfsGetFile;
    AVDB.listIds = async (l) => (l === 'imports' ? ['a', 'b', 'c'] : (l === 'favs' ? ['d'] : []));
    AVDB.getMedia = async (id) => ({ id, name: 'Louvor ' + id, opfsPath: 'm/' + id + '.mp4' });
    AVDB.opfsGetFile = async () => ({ size: 10 });
    const idsOk = await rodarUmaChecagem(sumidas);
    const arqOk = await rodarUmaChecagem(arq);
    AVDB.getMedia = async (id) => (id === 'b' ? null
      : { id, name: 'Louvor ' + id, opfsPath: 'm/' + id + '.mp4' });
    const idSumido = await rodarUmaChecagem(sumidas);
    AVDB.getMedia = async (id) => ({ id, name: 'Louvor ' + id, opfsPath: 'm/' + id + '.mp4' });
    AVDB.opfsGetFile = async (c) => (c === 'm/c.mp4' ? null : { size: 10 });
    const semArquivo = await rodarUmaChecagem(arq);
    // e o registro que NÃO guarda arquivo não inventa defeito
    AVDB.getMedia = async (id) => ({ id, name: 'Cena ' + id, kind: 'cue' });
    const semCaminho = await rodarUmaChecagem(arq);
    AVDB.listIds = async () => [];
    const vazio = await rodarUmaChecagem(sumidas);
    AVDB.listIds = li; AVDB.getMedia = gm; AVDB.opfsGetFile = og;
    return { idsOk, arqOk, idSumido, semArquivo, semCaminho, vazio };
  });
  checar(listas.idsOk.v === 'ok' && listas.arqOk.v === 'ok' && listas.vazio.v === 'na',
    'N5 · PREMISSA: com as quatro linhas resolvendo e com arquivo, as duas passam; sem lista '
    + 'montada, a pergunta não existe', JSON.stringify([listas.idsOk, listas.arqOk, listas.vazio]));
  checar(listas.idSumido.v === 'falhou' && /Cronograma: 1/.test(listas.idSumido.nota),
    'N5 · o id que NÃO RESOLVE MAIS reprova, e a nota diz EM QUE LISTA — a linha nunca é '
    + 'desenhada, mas a estrela e o ⊕ continuam dizendo que o item está lá',
    JSON.stringify(listas.idSumido));
  checar(listas.semArquivo.v === 'falhou' && /sem o arquivo no aparelho/.test(listas.semArquivo.nota),
    'N6 · e o registro que resolve SEM os bytes reprova à parte: ali a linha está à vista e falha '
    + 'no toque, que é outra ação', JSON.stringify(listas.semArquivo));
  checar(listas.semCaminho.v === 'na',
    'N6 · o que não guarda arquivo (cena de roteiro, link, apresentação) sai NÃO SE APLICA — '
    + 'perguntar pelo arquivo deles seria inventar um defeito', JSON.stringify(listas.semCaminho));

  // N7 · O SLIDE QUE SAI BRANCO. A apresentação falha CALADA de duas formas — a
  // página não sai, ou sai com o texto sobre papel, porque a mídia `blob:` não
  // sobrevive ao `<foreignObject>`. Os bytes do módulo chegam e ele RODA, que
  // é tudo o que as duas linhas de "O aplicativo" perguntam.
  const deck = await pg.evaluate(async () => {
    const achada = TESTES.find((c) => c.id === 'desenhador');
    const real = await rodarUmaChecagem(achada);
    const orig = AVDeck.elementoParaImagem;
    // o desenhador que devolve a página SEM a imagem embutida: 8×8 no FUNDO
    AVDeck.elementoParaImagem = async () => {
      const cv = document.createElement('canvas');
      cv.width = 8; cv.height = 8;
      const cx = cv.getContext('2d');
      cx.fillStyle = 'rgb(255,0,0)'; cx.fillRect(0, 0, 8, 8);
      const b = await new Promise((r) => cv.toBlob(r, 'image/png'));
      return { blob: b, tipo: 'image/png' };
    };
    const branca = await rodarUmaChecagem(achada);
    AVDeck.elementoParaImagem = async () => null;
    const morta = await rodarUmaChecagem(achada);
    AVDeck.elementoParaImagem = orig;
    const sobrou = document.querySelectorAll('canvas').length;
    return { real, branca, morta, sobrou };
  });
  checar(deck.real.v === 'ok',
    'N7 · o pipeline de VERDADE do app desenha uma página de 8px e ela sai com a cor da imagem '
    + 'embutida — não é uma cópia do desenhador, é ele', JSON.stringify(deck.real));
  checar(deck.branca.v === 'falhou' && /texto sobre papel branco/.test(deck.branca.nota),
    'N7 · e a página que sai SEM a imagem de fundo reprova: ela tem o tamanho certo, o número de '
    + 'páginas certo e não lança — é o DESFECHO que denuncia, por isso a imagem é RELIDA',
    JSON.stringify(deck.branca));
  checar(deck.morta.v === 'falhou' && /não transformou um slide/.test(deck.morta.nota),
    'N7 · e o desenhador que devolve nada reprova com a frase do operador: PDF e PowerPoint não '
    + 'vão abrir', JSON.stringify(deck.morta));

  // ===== BLOCO O · O QUE O APARELHO DO OPERADOR RESPONDEU (v1.10.5) =====
  //
  // A primeira rodada num Android de verdade (SM-S928B, Android 16, WebView
  // 153, 2,6 GB de biblioteca) devolveu TRÊS falhas e uma sem resposta. Uma
  // das falhas era verdadeira; as outras três linhas não tinham como acertar.
  // **Nenhuma delas seria descoberta sem o aparelho** — é por isso que o
  // Registro existe.

  // O1 · "HÁ INTERNET AGORA" REPROVOU COM A INTERNET FUNCIONANDO. As três
  // linhas da fonte passaram e a busca do OTA tinha respondido 3 s antes. A
  // causa é o MODO do `fetch`: em `cors` (o padrão) ele REJEITA quando a rota
  // não manda `Access-Control-Allow-Origin`, e a origem não o manda na RAIZ.
  // MEDIDO em Chromium, servidor local em dois origins: sem CORS rejeita em
  // `cors` e resolve OPACA em `no-cors`; endereço MORTO rejeita nos dois.
  const netFix = await pg.evaluate(async () => {
    const achada = TESTES.find((c) => c.id === 'internet');
    const real = window.fetch;
    const modos = [];
    // a rota SEM CORS: rejeita em `cors`, resolve opaca em `no-cors` — o
    // comportamento do servidor de arquivos da origem, medido.
    window.fetch = (u, o) => {
      modos.push((o && o.mode) || 'cors');
      // A resposta OPACA de verdade tem `status: 0`, e o construtor de
      // `Response` recusa esse número — o que importa para a linha é que a
      // Promise RESOLVA com um objeto, que é o que a opaca faz.
      return ((o && o.mode) === 'no-cors')
        ? Promise.resolve({ ok: false, status: 0, type: 'opaque', headers: new Headers() })
        : Promise.reject(new TypeError('Failed to fetch'));
    };
    const semCors = await rodarUmaChecagem(achada);
    // e o endereço MORTO continua reprovando, senão a linha não mede nada
    window.fetch = () => Promise.reject(new TypeError('Failed to fetch'));
    const semSaida = await rodarUmaChecagem(achada);
    window.fetch = real;
    return { semCors, semSaida, modos };
  });
  checar(netFix.modos.length > 0 && netFix.modos.every((m) => m === 'no-cors'),
    'O1 · a sonda vai em `no-cors` — a pergunta é *há saída?*, e ela não precisa LER a resposta '
    + 'para respondê-la', JSON.stringify(netFix.modos));
  checar(netFix.semCors.v === 'ok',
    'O1 · e uma rota que o CORS recusa deixa de virar "sem internet": era o vermelho no aparelho '
    + 'do operador, com a fonte respondendo nas três linhas de cima', JSON.stringify(netFix.semCors));
  checar(netFix.semSaida.v === 'falhou' && /não tem saída/.test(netFix.semSaida.nota),
    'O1 · o endereço MORTO continua reprovando — trocar o modo não pode ter trocado a pergunta '
    + 'por um verde garantido', JSON.stringify(netFix.semSaida));

  // O2 · A NEGAÇÃO DO ANDROID NÃO É FALHA. A v1.10.0 deixou escrito que esta
  // linha não tinha sido medida num Android de verdade. O aparelho respondeu:
  // `persist()` NEGADO, com a biblioteca intacta e o app em uso há meses — um
  // vermelho permanente sobre o que funciona.
  const persist = await pg.evaluate(async () => {
    const achada = TESTES.find((c) => c.id === 'persistencia');
    const st = navigator.storage;
    const falso = {
      persisted: async () => false,
      persist: async () => false,
      estimate: async () => ({ usage: 2600000000, quota: 9e10 }),
    };
    Object.defineProperty(navigator, 'storage', { value: falso, configurable: true });
    const nativo = window.__NATIVE__;
    window.__NATIVE__ = true;
    const noApp = await rodarUmaChecagem(achada);
    window.__NATIVE__ = false;
    const noNavegador = await rodarUmaChecagem(achada);
    // e concedida continua sendo OK nos dois
    falso.persisted = async () => true;
    window.__NATIVE__ = true;
    const concedida = await rodarUmaChecagem(achada);
    window.__NATIVE__ = nativo;
    Object.defineProperty(navigator, 'storage', { value: st, configurable: true });
    return { noApp, noNavegador, concedida };
  });
  checar(persist.noApp.v === 'na' && /vive no espaço do app/.test(persist.noApp.nota),
    'O2 · no APP a negação sai NÃO SE APLICA com a razão de plataforma: a marca não é concedida a '
    + 'um WebView, e a biblioteca só sai junto com o app', JSON.stringify(persist.noApp));
  checar(persist.noNavegador.v === 'falhou',
    'O2 · e no NAVEGADOR a falha FICA, porque ali o despejo é real — a guarda é do app, não da '
    + 'pergunta', JSON.stringify(persist.noNavegador));
  checar(persist.concedida.v === 'ok',
    'O2 · concedida continua passando: o aparelho que dá a marca não perdeu a linha',
    JSON.stringify(persist.concedida));

  // O3 · "NÃO RESPONDEU EM 6 s" É O DESFECHO MAIS INÚTIL QUE UMA LINHA SABE
  // PRODUZIR. A varredura do disco custa um `getFile()` por entrada e não cabe
  // no prazo num acervo de verdade — no aparelho do operador ela estourou E
  // foi o poste mais alto da rodada (6,2 s de 6,2 s).
  const disco = await pg.evaluate(async () => {
    const achada = TESTES.find((c) => c.id === 'acervo-arquivos');
    const real = AVDB.opfsTodosOsArquivos; const fa = AVDB.filesAll;
    let tetoRecebido = null;
    AVDB.filesAll = async () => [];
    AVDB.opfsTodosOsArquivos = async (teto) => {
      tetoRecebido = teto;
      const a = Array.from({ length: 4000 }, (_, i) => ({ caminho: 'm/' + i, tamanho: 10, tipo: '' }));
      a.parcial = true;
      return a;
    };
    const parcial = await rodarUmaChecagem(achada);
    AVDB.opfsTodosOsArquivos = async () => [{ caminho: 'm/1', tamanho: 10, tipo: '' }];
    const inteiro = await rodarUmaChecagem(achada);
    AVDB.opfsTodosOsArquivos = real; AVDB.filesAll = fa;
    return { parcial, inteiro, tetoRecebido };
  });
  checar(typeof disco.tetoRecebido === 'number' && disco.tetoRecebido > 0,
    'O3 · a varredura do disco vai com TETO — sem ele a linha não responde num acervo de verdade',
    String(disco.tetoRecebido));
  checar(disco.parcial.v === 'ok' && /os primeiros/.test(disco.parcial.nota),
    'O3 · e quando a conta é parcial a linha DIZ isso: sem a palavra, "4000 arquivos" se leria '
    + 'como o total', JSON.stringify(disco.parcial));
  checar(disco.inteiro.v === 'ok' && !/os primeiros/.test(disco.inteiro.nota),
    'O3 · o acervo que cabe no teto segue sem a ressalva — ela é o que a varredura MEDIU, não um '
    + 'aviso permanente', JSON.stringify(disco.inteiro));

  // O4 · E O TETO É MEDIDO NA VARREDURA DE VERDADE, nunca num embrulho dela.
  // A asserção de cima STUBA o `opfsTodosOsArquivos` e fabrica a marca — ela
  // prova o CONSUMIDOR e é cega ao produtor. MEDIDO por reversão: tirar o
  // `out.parcial` do `db.js` não reprovava nada. Esta planta arquivos de
  // verdade no OPFS e pede um teto menor que eles.
  const tetoReal = await pg.evaluate(async () => {
    if (!AVDB.opfsSupported()) return { pulou: true };
    const raiz = await navigator.storage.getDirectory();
    const dir = await raiz.getDirectoryHandle('teste-teto', { create: true });
    for (let i = 0; i < 12; i++) {
      const fh = await dir.getFileHandle('a' + i + '.bin', { create: true });
      const w = await fh.createWritable();
      await w.write(new Uint8Array(4));
      await w.close();
    }
    const cortado = await AVDB.opfsTodosOsArquivos(5);
    const inteiro = await AVDB.opfsTodosOsArquivos(10000);
    const semTeto = await AVDB.opfsTodosOsArquivos();
    // LIMPA O QUE CRIOU, inclusive se a asserção reprovar depois — a regra da
    // sonda de escrita.
    try { await raiz.removeEntry('teste-teto', { recursive: true }); } catch (_) { /* já foi */ }
    return {
      cortado: { n: cortado.length, parcial: !!cortado.parcial },
      inteiro: { n: inteiro.length, parcial: !!inteiro.parcial },
      semTeto: { n: semTeto.length, parcial: !!semTeto.parcial },
    };
  });
  if (tetoReal.pulou) {
    checar(false, 'O4 · PREMISSA: o OPFS existe neste navegador', 'sem OPFS');
  } else {
    checar(tetoReal.cortado.n === 5 && tetoReal.cortado.parcial,
      'O4 · com doze arquivos no disco e teto de cinco, a varredura PARA em cinco e se marca como '
      + 'parcial — ela não varre tudo para cortar depois, que é o custo que o teto existe para '
      + 'não pagar', JSON.stringify(tetoReal.cortado));
    checar(tetoReal.inteiro.n >= 12 && !tetoReal.inteiro.parcial
      && tetoReal.semTeto.n >= 12 && !tetoReal.semTeto.parcial,
      'O4 · e com teto folgado (ou sem teto nenhum, que é como o coletor a chama) ela varre tudo e '
      + 'NÃO se marca — a marca é o que a varredura mediu', JSON.stringify(tetoReal));
  }

} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) { console.error('\n' + falhas.length + ' falha(s).'); process.exit(1); }
console.log('\nTodos passaram.');
