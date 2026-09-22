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

} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) { console.error('\n' + falhas.length + ' falha(s).'); process.exit(1); }
console.log('\nTodos passaram.');
