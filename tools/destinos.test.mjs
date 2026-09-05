// UM ITEM, VÁRIOS DESTINOS — o multi-destino das folhas de escolha (v5.141).
//
// ## Por que ele existe
//
// Toda porta de entrada do app (acervo, busca do YouTube, link compartilhado,
// importação de arquivos) pergunta "para onde?" numa folha em que cada linha é
// uma ação completa: o toque executa e a folha fecha. O multi-destino
// acrescentou uma CAIXA DE MARCAÇÃO a cada linha de destino sem tirar nada
// daquilo — e é justamente esse "sem tirar nada" que precisa de trava:
//
//  - a linha continua sendo UM toque quando nada está marcado (o caminho de
//    sempre, e o mais usado durante um culto);
//  - a caixa NÃO pode disparar a ação da linha (era o defeito óbvio: ela vive
//    DENTRO do botão, e sem `stopPropagation` marcar fecharia a folha);
//  - o que está marcado tem de VIAJAR até a ação — e ela roda DEPOIS de
//    `closeSongMenu()`, que zera o conjunto. Um `destUniao()` lido tarde demais
//    devolveria só a linha tocada, calado: o item iria para um destino em vez
//    de dois, e ninguém veria erro nenhum. É a mesma classe de falha muda do
//    `slideLabel` no `nowPlaying` e do `bytes` no `bgProgress`.
//
// O teste roda em Chromium de verdade, sobre a base web servida como no
// aparelho — mas SEM `__AVBridge`, então é o caminho de navegador. Ele opera a
// folha do acervo (a única que não precisa de rede) e confere o que entrou no
// IndexedDB, que é o único lugar onde a resposta é verificável.
//
//   node tools/destinos.test.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, checar, falhas } from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');

const servidor = servirEstatico(RAIZ);

await new Promise((r) => servidor.listen(0, r));
const porta = servidor.address().port;
const navegador = await abrirNavegador();
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
await semRedeExterna(ctx);
const pg = await ctx.newPage();
const base = `http://localhost:${porta}`;

const erros = [];
const EXTERNO = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_PROXY/;
pg.on('console', (m) => {
  if (m.type() !== 'error') return;
  const t = m.text();
  if (EXTERNO.test(t) || /Failed to load resource/.test(t)) return;
  erros.push(t);
});
pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));

try {
  await pg.goto(base + '/controle/', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(
    () => window.AVDB && window.createStage && typeof window.__avBack === 'function',
    null, { timeout: 20000 },
  );
  // O app ABRE no simplificado (ver `storedAppMode`), e as folhas de destino são
  // do avançado — é lá que existem Cronograma e playlist para escolher.
  await pg.evaluate(() => setAppMode('full'));

  // ---- A TABELA é a fonte única dos destinos ----
  // Ela existe para que uma porta nova não invente uma segunda lista de
  // destinos — foi o que aconteceu com o `YT_LISTA`, que duplicava as MESMAS
  // três listas só para o YouTube.
  const tabela = await pg.evaluate(() => (typeof DESTINOS === 'undefined' ? null : DESTINOS.map((d) => [d.chave, d.lista])));
  checar(!!tabela && tabela.length === 3, 'a tabela de destinos existe e tem os três lugares');
  checar(JSON.stringify(tabela) === JSON.stringify([
    ['playlist', 'playlist'], ['cronograma', 'imports'], ['favoritos', 'favs'],
  ]), 'e cada chave aponta para a lista certa do banco');

  // ---- Uma mídia de mentira, para ter o que mandar ----
  // O acervo LouvorJA precisa de rede; o que se testa aqui é o TRANSPORTE dos
  // destinos, não o download. Uma mídia criada direto no banco basta — é o
  // mesmo id que `addSongToDestinos` entregaria a `adicionarNasListas`.
  const idMidia = await pg.evaluate(async () => {
    const rec = await AVDB.addMedia(new Blob(['x'], { type: 'audio/mpeg' }), {
      name: 'Louvor de teste', type: 'audio/mpeg', kind: 'audio', list: 'avulsos',
    });
    return rec.id;
  });

  // ---- O caminho de UM destino continua igual ----
  await pg.evaluate((id) => adicionarNasListas(['imports'], id, 'Louvor de teste', null), idMidia);
  let onde = await pg.evaluate(async (id) => ({
    imports: await AVDB.listHas('imports', id),
    playlist: await AVDB.listHas('playlist', id),
    favs: await AVDB.listHas('favs', id),
  }), idMidia);
  checar(onde.imports && !onde.playlist && !onde.favs, 'um destino só continua indo para um lugar só');

  // ---- VÁRIOS de uma vez ----
  await pg.evaluate((id) => adicionarNasListas(['playlist', 'favs'], id, 'Louvor de teste', null), idMidia);
  onde = await pg.evaluate(async (id) => ({
    imports: await AVDB.listHas('imports', id),
    playlist: await AVDB.listHas('playlist', id),
    favs: await AVDB.listHas('favs', id),
  }), idMidia);
  checar(onde.playlist && onde.favs, 'e dois destinos num pedido só chegam aos dois');
  checar(onde.imports, 'sem tirar o item de onde ele já estava');

  // ---- A frase do aviso nomeia TODOS os destinos ----
  // "adicionado à playlist" para um item que foi a três lugares é o app
  // contando metade da verdade — e é a metade que o operador usaria para
  // decidir se precisa repetir o toque.
  const frase = await pg.evaluate(() => ondeDe(['playlist', 'imports', 'favs'], 'para'));
  checar(/playlist/.test(frase) && /Cronograma/.test(frase) && /favoritos/.test(frase),
    'o aviso nomeia os três destinos');
  checar(/ e /.test(frase), 'e os junta como se fala ("… e …"), não como lista de código');

  // ---- A UNIÃO: o marcado + a linha tocada ----
  const uniao = await pg.evaluate(() => {
    destMarcados.clear();
    destMarcados.add('favoritos');
    return destUniao('cronograma');
  });
  checar(JSON.stringify(uniao) === JSON.stringify(['cronograma', 'favoritos']),
    'tocar numa linha leva junto o que já estava marcado');
  const ordem = await pg.evaluate(() => {
    destMarcados.clear();
    destMarcados.add('favoritos');
    destMarcados.add('playlist');
    return destUniao('cronograma');
  });
  checar(JSON.stringify(ordem) === JSON.stringify(['playlist', 'cronograma', 'favoritos']),
    'e a ordem é a da tabela, não a ordem em que o operador marcou');
  const comTocar = await pg.evaluate(() => {
    destMarcados.clear();
    destMarcados.add('cronograma');
    return destUniao('tocar');
  });
  checar(JSON.stringify(comTocar) === JSON.stringify(['cronograma', 'tocar']),
    '"Tocar agora" honra o que está marcado (projeta E guarda), com o telão por último');
  await pg.evaluate(() => destLimpar());

  // ---- A FOLHA, operada de verdade ----
  // Daqui em diante o teste toca nos elementos como o operador tocaria: é o
  // único jeito de pegar o `stopPropagation` da caixa e o `destUniao` lido
  // tarde demais, que são defeitos do DOM, não da lógica.
  await pg.evaluate(() => {
    // A folha do YouTube não precisa de rede para ser MONTADA — só a ação
    // precisa. `openYtMenu` com um resultado de mentira dá as quatro linhas
    // (tocar + os três destinos) numa tela só.
    openYtMenu({ id: 'zzzzzzzzzzz', url: 'https://youtu.be/zzzzzzzzzzz', name: 'Vídeo de teste' });
  });
  await pg.waitForSelector('#songMenuPopup.open', { timeout: 5000 });
  // ── O MÉTODO UNIVERSAL (v5.252) ──────────────────────────────────────────
  // Pedido do operador: *"faça um método universal, o botão de confirmar sempre
  // visível, e todas as outras opções (inclusive o tocar agora) são opções
  // selecionáveis, não apenas tocando no check, mas de corpo inteiro."*
  //
  // Antes a folha tinha duas gramáticas: o CORPO da linha executava e fechava
  // tudo, e a caixinha de 20px na borda apenas marcava. As asserções abaixo são
  // a inversão disso, e cada uma nomeia a metade que ela trava.
  const caixas = await pg.$$eval('#songMenuList .song-menu-check', (els) => els.length);
  checar(caixas === 4,
    'TODA opção da folha é selecionável — as três listas E o "Tocar agora"',
    String(caixas));

  // O CORPO da linha marca. Antes ele executava: é a mudança inteira num toque.
  await pg.evaluate(() => {
    const linhas = [...document.querySelectorAll('#songMenuList .song-menu-btn')]
      .filter((b) => b.querySelector('.song-menu-check'));
    linhas[1].click();   // a segunda opção: "Adicionar à playlist"
  });
  const aberta = await pg.$eval('#songMenuPopup', (el) => el.classList.contains('open'));
  checar(aberta, 'e o toque no CORPO dela marca sem executar — a folha continua aberta');
  const marcado = await pg.evaluate(() => [...destMarcados]);
  checar(marcado.length === 1 && marcado[0] === 'playlist',
    'com o destino da linha em que se tocou', JSON.stringify(marcado));
  const pintou = await pg.$$eval('#songMenuList .song-menu-check',
    (els) => els.filter((e) => e.classList.contains('on')).length);
  checar(pintou === 1, 'e a caixa mostra que está marcada');

  // O toque na CAIXA faz a mesma coisa que o toque na linha — ela é indicador,
  // e um ponto morto justamente no pedaço que mais parece o alvo seria o pior
  // desfecho possível desta mudança.
  await pg.evaluate(() => document.querySelectorAll('#songMenuList .song-menu-check')[1].click());
  checar((await pg.evaluate(() => destMarcados.size)) === 0,
    'e o toque na CAIXA alterna igual: ela é indicador, não um alvo à parte');
  await pg.evaluate(() => {
    const linhas = [...document.querySelectorAll('#songMenuList .song-menu-btn')]
      .filter((b) => b.querySelector('.song-menu-check'));
    linhas[1].click();
  });

  // O CONFIRMAR É SEMPRE VISÍVEL, marcado ou não — ele só nascia depois da
  // primeira marca, isto é, era invisível justamente para quem ainda não sabia
  // que dava para marcar.
  const temGo = await pg.$$eval('#songMenuList .song-menu-go', (els) => els.length);
  checar(temGo === 1, 'e a linha de confirmação está lá');
  // ── E ELE TEM A ALTURA DAS LINHAS QUE FECHA (v5.301) ─────────────────────
  // Relato do operador: *"verifique a altura do botão de confirmar que temos em
  // toda a biblioteca nas opções de play, ele parece menor que o padrão dos
  // seus botões vizinhos"*. Estava, por OMISSÃO: quem dita a altura de uma
  // linha de opção não é o `padding` (igual para todas), é o `.song-menu-check`,
  // que reserva `--hit`. O confirmar não tem check nem ícone, então sobrava só
  // a linha de texto — ~19px contra os 34px dos vizinhos.
  //
  // Medido no RENDERIZADO e contra o que o DESENHO RESERVA (`--hit`), nunca
  // contra um número escrito aqui — um piso em pixel aprovaria os dois errados
  // juntos no dia em que `--hit` mudar.
  //
  // E NUNCA COMO IGUALDADE DE ALTURA RENDERIZADA, que era a forma anterior: uma
  // linha de opção mede o padding mais o MAIOR entre o `--hit` do check e o
  // texto dela, e a opção "Tocar agora" tem DUAS linhas de texto. O app pede
  // `system-ui, -apple-system, sans-serif`, então quem responde é a fonte que a
  // máquina tem. MEDIDO aqui, com a MESMA página e o MESMO CSS: as quatro
  // opções dão 53px sob DejaVu/FreeSans e a de duas linhas dá 55px quando
  // `system-ui` resolve para WenQuanYi Zen Hei, enquanto o confirmar fica em 53
  // nos dois casos. A igualdade media a FONTE DO RUNNER, não o app.
  //
  // O piso, esse, é font-free, e são as duas metades que o compõem — cada
  // `checar` abaixo trava uma:
  //
  //   altura da linha = padding + conteúdo,  conteúdo ≥ `--hit`
  //
  // Iguais as duas parcelas, o piso renderizado é o mesmo e o texto só pode
  // fazer a linha CRESCER. Os ~19px do defeito original reprovam a primeira.
  const alturas = await pg.evaluate(() => {
    const px = (v) => Math.round(parseFloat(v) * 100) / 100;
    const respiro = (el) => {
      const cs = getComputedStyle(el);
      return px(cs.paddingTop) + px(cs.paddingBottom);
    };
    const conteudo = (el) => Math.round(el.getBoundingClientRect().height - respiro(el));
    const go = document.querySelector('#songMenuList .song-menu-go');
    const opcoes = [...document.querySelectorAll('#songMenuList .song-menu-btn')]
      .filter((b) => b.querySelector('.song-menu-check'));
    return {
      hit: Math.round(parseFloat(getComputedStyle(document.documentElement)
        .getPropertyValue('--hit'))),
      go: Math.round(go.getBoundingClientRect().height),
      goConteudo: conteudo(go), goRespiro: respiro(go),
      opcoes: opcoes.map((el) => Math.round(el.getBoundingClientRect().height)),
      opcoesRespiro: opcoes.map(respiro),
    };
  });
  checar(alturas.hit > 0 && alturas.goConteudo >= alturas.hit,
    'e ele RESERVA `--hit` de conteúdo, como o check reserva nas opções ('
    + alturas.goConteudo + 'px ≥ ' + alturas.hit + 'px) — era esta a omissão: '
    + 'sem check nem ícone sobrava só a linha de texto', JSON.stringify(alturas));
  checar(alturas.opcoesRespiro.length > 0
      && alturas.opcoesRespiro.every((r) => r === alturas.goRespiro),
    'e o MESMO respiro das opções que fecha (' + alturas.goRespiro + 'px de padding) '
    + '— com o conteúdo no mesmo piso, é o padding que decide se ele nasce mais baixo',
    JSON.stringify(alturas));
  // ── O "TOCAR AGORA" SOZINHO (v5.254) ─────────────────────────────────────
  // Relato do operador: *"o seletivo de tocar agora… se eu toco apenas nele, ele
  // não dá o feedback do check"*.
  //
  // Ele era a única linha da folha que não recebia o redesenho: até a v5.253 o
  // corpo dela EXECUTAVA e fechava tudo, então nunca precisou de um — quando ela
  // virou selecionável, o argumento ficou para trás. O toque marcava o destino e
  // a tela não mudava um pixel, nem na caixa nem no confirmar.
  //
  // O caso mede as DUAS coisas que o redesenho reconstrói, porque o defeito
  // apagava as duas de uma vez.
  const soTocar = await pg.evaluate(() => {
    destMarcados.clear();
    openYtMenu({ id: 'zzzzzzzzzzz', url: 'https://youtu.be/zzzzzzzzzzz', name: 'Vídeo de teste' });
    const linha = [...document.querySelectorAll('#songMenuList .song-menu-btn')]
      .find((b) => /Tocar agora/.test(b.textContent));
    linha.click();
    const depois = [...document.querySelectorAll('#songMenuList .song-menu-btn')]
      .find((b) => /Tocar agora/.test(b.textContent));
    const go = document.querySelector('#songMenuList .song-menu-go');
    return {
      marcado: [...destMarcados],
      check: !!(depois && depois.querySelector('.song-menu-check.on')),
      goAtivo: !!(go && !go.disabled),
      goTexto: go ? go.textContent.trim() : '',
      aberta: document.getElementById('songMenuPopup').classList.contains('open'),
    };
  });
  checar(soTocar.marcado.length === 1 && soTocar.marcado[0] === 'tocar' && soTocar.aberta,
    'tocar SÓ no "Tocar agora" marca-o e mantém a folha aberta',
    JSON.stringify(soTocar.marcado));
  checar(soTocar.check,
    'e a CAIXA dele acende — era este o feedback que não vinha');
  checar(soTocar.goAtivo && /Confirmar/.test(soTocar.goTexto),
    'e o confirmar habilita junto: as duas coisas que o redesenho reconstrói',
    JSON.stringify(soTocar.goTexto));

  const goVazio = await pg.evaluate(() => {
    destMarcados.clear();
    openYtMenu({ id: 'zzzzzzzzzzz', url: 'https://youtu.be/zzzzzzzzzzz', name: 'Vídeo de teste' });
    const b = document.querySelector('#songMenuList .song-menu-go');
    return { existe: !!b, desabilitado: !!(b && b.disabled), texto: b ? b.textContent.trim() : '' };
  });
  checar(goVazio.existe && goVazio.desabilitado && /Escolha uma opção/.test(goVazio.texto),
    'SEM NADA MARCADO ela continua na tela, desabilitada, dizendo o que falta',
    JSON.stringify(goVazio.texto));

  // Fechar a folha ZERA o conjunto: uma marcação que atravessasse itens
  // mandaria para os Favoritos, sem aviso, o vídeo seguinte.
  await pg.evaluate(() => closeSongMenu());
  const zerou = await pg.evaluate(() => destMarcados.size);
  checar(zerou === 0, 'fechar a folha zera as marcações (elas são da folha, não do item)');

  // ---- A folha do ACERVO passa pelo mesmo caminho ----
  const alvos = await pg.evaluate(async () => {
    // O executor é substituído para capturar o que a folha ENTREGA: rodar o
    // verdadeiro exigiria baixar a música do LouvorJA, e o que se verifica aqui
    // é o transporte da escolha até a ação — o ponto em que ela se perdia.
    const coll = { id: 'teste', name: 'Coleção' };
    const s = { id_music: 1, name: 'Hino', has_instrumental_music: false };
    // A LISTA DO ACERVO DEIXOU DE SER UMA FOLHA (v5.285): ela é montada no
    // corpo da linha, e `montarOpcoes` a arma assim — o alvo em `songMenuFor`.
    // (O parâmetro `modo` saiu na v5.286: a lista é uma só.) Este caso monta o mesmo
    // estado num `<ul>` solto porque o que ele verifica é o TRANSPORTE da
    // escolha até a ação, com `coll`/`s` sintéticos que uma linha de verdade não
    // teria como desenhar.
    const alvo = document.createElement('ul');
    alvo.id = 'destinosTeste';
    document.body.appendChild(alvo);
    songMenuFor = { coll, s, variant: 'full', alvo };
    destLimpar();
    renderSongMenu();
    let capturado = null;
    const original = window.addSongToDestinos;
    window.addSongToDestinos = (c, m, v, destinos) => { capturado = destinos; };
    // Duas linhas MARCADAS pelo corpo, e só então o confirmar.
    // POR RÓTULO, e não por índice (v5.286): a lista ganhou o "Tocar agora"
    // como primeira selecionável, e um índice teria escorregado em silêncio
    // para o vizinho — marcando playlist onde o caso diz Cronograma.
    const porRotulo = (txt) => [...alvo.querySelectorAll('.song-menu-btn')]
      .find((b) => b.querySelector('.song-menu-check')
        && new RegExp(txt, 'i').test(b.textContent));
    porRotulo('Cronograma').click();
    porRotulo('Favoritar').click();
    alvo.querySelector('.song-menu-go').click();
    window.addSongToDestinos = original;
    alvo.remove();
    songMenuFor = null;
    return capturado;
  });
  checar(JSON.stringify(alvos) === JSON.stringify(['cronograma', 'favoritos']),
    'no acervo, é o CONFIRMAR que entrega a união — e ela chega inteira mesmo '
    + 'rodando depois de a folha fechar', JSON.stringify(alvos));

  checar(await pg.$eval('#songMenuPopup', (el) => !el.classList.contains('open')),
    'e a FOLHA nem chega a abrir para um item do acervo: a lista dele mora no '
    + 'corpo da linha desde a v5.285');

  // ---- REABRIR UMA GAVETA JÁ MONTADA NÃO EXECUTA SOBRE A VIZINHA ----
  //
  // Tudo acima mede a folha (`renderSongMenu`/`openYtMenu`), que é montada a
  // cada abertura. A gaveta de `linhaDeItem` — a linha de um FAVORITO e a de um
  // arquivo da pasta do aparelho — vive no corpo da linha, e ali há um segundo
  // caminho: abrir a linha B reescreve os QUATRO globais da folha
  // (`songMenuFor`, `destExecutor`, `destRemontar` e o Set `destMarcados`), e
  // voltar para A tinha de repor todos. Repondo só o `songMenuFor`, o DOM de A
  // ficava na tela com o `destExecutor` de B por baixo: o "Confirmar" da linha A
  // mandava B ao Cronograma e ao TELÃO. E ele não precisa de marca nenhuma para
  // disparar — "Tocar agora" nasce marcado (`destPadraoTocar`).
  //
  // MUDO nos dois sentidos: nada no console, e a tela mostra a linha certa. A
  // asserção é o que o EXECUTOR recebeu, nunca o que a gaveta desenha.
  const reabrir = await pg.evaluate(async () => {
    const mk = async (nome) => AVDB.addMedia(new Blob(['x'], { type: 'audio/mpeg' }),
      { name: nome, type: 'audio/mpeg', kind: 'audio', list: 'avulsos' });
    const A = await mk('ITEM A'); const B = await mk('ITEM B');
    const ul = document.createElement('ul');
    document.body.appendChild(ul);
    ul.appendChild(linhaDeItem(A, { destinos: ['playlist', 'cronograma'] }));
    ul.appendChild(linhaDeItem(B, { destinos: ['playlist', 'cronograma'] }));
    const projetados = []; const listados = [];
    const oProj = window.projetarItem; const oAdd = window.adicionarNasListas;
    window.projetarItem = async (it) => { projetados.push(it.name); };
    window.adicionarNasListas = async (l, id, nome) => { listados.push(nome); };
    const linhas = [...ul.children];
    const abrir = (i) => linhas[i].querySelector('.row').click();
    abrir(0);   // A: a gaveta monta e "Tocar agora" nasce marcado
    abrir(1);   // B: reescreve os globais da folha
    abrir(0);   // volta para A — a gaveta dela JÁ está montada
    linhas[0].querySelector('.song-menu-go').click();
    await new Promise((r) => setTimeout(r, 200));
    window.projetarItem = oProj; window.adicionarNasListas = oAdd;
    ul.remove();
    return { projetados, listados };
  });
  checar(JSON.stringify(reabrir.projetados) === JSON.stringify(['ITEM A']),
    'reabrir a gaveta de um favorito executa sobre ELE, não sobre a última gaveta montada',
    JSON.stringify(reabrir));
  checar(!reabrir.listados.includes('ITEM B'),
    'e nada da linha vizinha entra em lista nenhuma', JSON.stringify(reabrir));

  // ---- A SELEÇÃO MÚLTIPLA SOBREVIVE AO DESTINO ----
  // Os três botões da barra (playlist, favoritos, pasta) já eram destinos lado a
  // lado; o que os separava era a barra sumindo no primeiro toque. Mandar cinco
  // louvores para a playlist E para os Favoritos exigia selecioná-los duas vezes.
  const selecao = await pg.evaluate(async (id) => {
    enterSelection(id);
    await favoritarSelecionados();
    await new Promise((r) => setTimeout(r, 500));   // além do PULSO_MS
    const vivo = selectionMode && selected.has(id);
    exitSelection();
    return { vivo, saiu: !selectionMode };
  }, idMidia);
  checar(selecao.vivo, 'mandar a seleção a um destino NÃO a encerra (dá para mandar a outro)');
  checar(selecao.saiu, 'e o ✕ / voltar continua encerrando-a');

  // ---- A MESMA FOLHA COMO PERGUNTA (importação e compartilhamento) ----
  // O SIMPLIFICADO não pergunta, e é a resposta certa: ali não existe
  // Cronograma nem playlist, e uma folha com destinos que a tela não tem seria
  // pior que folha nenhuma (a mesma regra do link compartilhado naquele modo).
  const noSimples = await pg.evaluate(async () => {
    setAppMode('simple');
    const r = await escolherDestinos('Importar', ['cronograma']);
    setAppMode('full');
    return r;
  });
  checar(noSimples === null, 'no modo simplificado a pergunta nem chega a ser feita');

  // Aqui não há ação por trás da linha: a folha É a pergunta, e a resposta é a
  // promessa que ela resolve. Fechar sem responder não pode deixá-la pendente
  // para sempre — seria um share que nunca chega à lista.
  const escolhido = await pg.evaluate(async () => {
    const p = escolherDestinos('Importar', ['cronograma']);
    await new Promise((r) => setTimeout(r, 50));
    // A linha dos Favoritos, pelo CORPO dela: nesta folha a linha inteira marca.
    const linhas = [...document.querySelectorAll('#songMenuList .song-menu-btn')];
    linhas[2].click();
    await new Promise((r) => setTimeout(r, 50));
    document.querySelector('#songMenuList .song-menu-go').click();
    return p;
  });
  checar(JSON.stringify(escolhido) === JSON.stringify(['cronograma', 'favoritos']),
    'a pergunta da importação abre com o Cronograma marcado e aceita um segundo destino');
  const desistiu = await pg.evaluate(async () => {
    const p = escolherDestinos('Importar', ['cronograma']);
    await new Promise((r) => setTimeout(r, 50));
    closeSongMenu();   // o ✕, o toque no fundo e o voltar do aparelho caem todos aqui
    return p;
  });
  checar(desistiu === null, 'e desistir resolve em vez de deixar a importação pendurada');

  // ---- O CANCELAR DO DOWNLOAD (v5.191) ----
  // Três lugares mostram um download em curso e só um deles sabia cancelar (a
  // linha do resultado da busca — justamente a que some quando o operador fecha
  // a busca). O que este caso trava é que os OUTROS dois passaram a saber:
  // o cartão sobre a preview e a linha provisória do Cronograma.
  const cancelar = await pg.evaluate(async () => {
    const out = {};
    // 1. O cartão sobre a preview: o botão só existe quando quem está baixando
    //    SABE cancelar (um hino local não sabe, e um botão morto seria pior).
    const semAlca = previewBusy('Preparando vídeo', 'Sem alça');
    out.escondidoSemAlca = document.getElementById('pvBusyCancel').hidden;
    semAlca.soltar();
    let chamou = 0;
    const comAlca = previewBusy('Baixando vídeo', 'Com alça', () => { chamou++; });
    out.visivelComAlca = !document.getElementById('pvBusyCancel').hidden;
    document.getElementById('pvBusyCancel').click();
    out.chamou = chamou === 1;
    comAlca.soltar();
    out.sumiuAoSoltar = document.getElementById('pvBusyCancel').hidden;

    // 2. A linha provisória do Cronograma, com o ✕ na própria linha.
    //    A assinatura ESPELHA a do `previewBusy` acima — legenda primeiro, nome
    //    depois —, e é a legenda que decide o ícone da miniatura (v1.7.1).
    let naLinha = 0;
    const dl = libBusy('Baixando vídeo', 'Vídeo do YouTube', null, () => { naLinha++; });
    await load();
    const li = [...document.querySelectorAll('.lib-item.baixando')].pop();
    // `.row-cancel` desde a v1.7.4: o ✕ deixou de ser um botão próprio e passou
    // a ocupar a COLUNA DO `⋮`, com a caixa e a escala de um `.row-btn`.
    const x = li && li.querySelector('.row-cancel');
    out.temBotaoNaLinha = !!x;
    if (x) x.click();
    out.cancelouNaLinha = naLinha === 1;
    dl.soltar();
    return out;
  });
  checar(cancelar.escondidoSemAlca, 'o cartão da preview NÃO mostra cancelar quando não há o que cancelar');
  checar(cancelar.visivelComAlca, 'e mostra quando o download sabe ser parado');
  checar(cancelar.chamou, 'o toque no botão chama o cancelamento daquele download');
  checar(cancelar.sumiuAoSoltar, 'e o botão sai com o dono dele');
  checar(cancelar.temBotaoNaLinha, 'a linha provisória do Cronograma tem o ✕ de cancelar');
  checar(cancelar.cancelouNaLinha, 'e ele cancela o download daquela linha');

  // ---- A INTENÇÃO SEM DESTINO NÃO RESSUSCITA (v5.191) ----
  // "Tocar agora" é do instante em que o operador tocou: reclamá-lo no
  // lançamento seguinte baixa minutos de vídeo para uma cena que já passou, e o
  // item não aparece em lista nenhuma para ser achado depois. Era o relato —
  // "esse vídeo não está mais indo para o player e ele continua querendo
  // baixar".
  const listas = await pg.evaluate(() => (typeof LISTAS_VISIVEIS === 'undefined' ? null : LISTAS_VISIVEIS.slice()));
  checar(!!listas && listas.indexOf('avulsos') < 0,
    'a prateleira invisível (avulsos) NÃO conta como destino de resgate');
  checar(!!listas && listas.indexOf('imports') >= 0 && listas.indexOf('playlist') >= 0
    && listas.indexOf('favs') >= 0,
    'e as três listas visíveis contam');
  const teto = await pg.evaluate(() => (typeof INTENCAO_MAX_TENTATIVAS === 'undefined' ? -1 : INTENCAO_MAX_TENTATIVAS));
  checar(teto >= 1 && teto <= 3,
    'há um teto de resgates — sem ele a intenção volta a cada abertura pelas 6 h inteiras');

  // ---- A MESA DE SOM NÃO VOLTA COMO MODO (v5.189, reafirmado na v5.215) ----
  //
  // O som deste aparelho voltou a existir na v5.215 — mas como CONSEQUÊNCIA da
  // conexão (sem tela nenhuma, a preview toca; ver `acertarSaidaDeAudio`), e
  // nunca como um interruptor. O que este caso trava é justamente a diferença:
  // um botão de som sobre a preview, ou um `standalone` guardado, é o caminho
  // de volta para o `<video>` do Controle roubar o foco de áudio do Android e
  // interromper o player do telão no meio do louvor — que era o defeito da
  // versão manual, e que só o estado DERIVADO impede por construção.
  const semSom = await pg.evaluate(() => ({
    semBotao: !document.getElementById('pvSoundBtn'),
    semModo: typeof window.setStandalone === 'undefined',
    derivado: typeof somLocalDeveEstar === 'function',
  }));
  checar(semSom.semBotao, 'não há botão de som sobre a preview');
  checar(semSom.semModo, 'e a "mesa de som" não volta como MODO — não há interruptor a esquecer ligado');
  checar(semSom.derivado, 'o som deste aparelho é DERIVADO da conexão (somLocalDeveEstar)');
} catch (e) {
  checar(false, 'o percurso terminou sem exceção (' + (e && e.message) + ')');
}

checar(erros.length === 0, 'nenhum erro de console' + (erros.length ? ':\n        ' + erros.join('\n        ') : ''));

await navegador.close();
servidor.close();
console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
