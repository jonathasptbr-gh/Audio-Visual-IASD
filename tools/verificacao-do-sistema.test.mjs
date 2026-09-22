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

  // K3 · O RELÓGIO. O campo da hora era de módulo e nunca zerava: as checagens
  // correm quatro de cada vez, então na PRIMEIRA rodada esta chegava antes da
  // que o preenchia, e na SEGUNDA lia o cabeçalho da rodada ANTERIOR — minutos
  // velho — e acusava de torto um relógio certo.
  const relogio = await pg.evaluate(() => {
    const fonte = TESTES.find((c) => c.id === 'relogio').fn.toString();
    return {
      pedeSozinho: /fetch\(/.test(fonte),
      leCarona: /testeHoraDoServidor/.test(fonte),
    };
  });
  checar(relogio.pedeSozinho && !relogio.leCarona,
    'K3 · o relógio busca a hora NA PRÓPRIA rodada e não de carona numa variável que sobrevive à '
    + 'anterior — acusar um relógio certo é o defeito da v1.9.14 voltando pela porta do recurso '
    + 'que existe para pegá-lo', JSON.stringify(relogio));

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

} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) { console.error('\n' + falhas.length + ' falha(s).'); process.exit(1); }
console.log('\nTodos passaram.');
