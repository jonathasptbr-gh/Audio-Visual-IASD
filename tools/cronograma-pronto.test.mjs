#!/usr/bin/env node
// O CRONOGRAMA TOCA SEM REDE? — E SEGURAR ARRASTA (v1.13.52).
//
// Dois pedidos do operador que mexem na MESMA linha do Cronograma e saem juntos:
//
//  1. *"um ícone de alerta ao lado do nome do cronograma, que ao tocado avisa e
//     dê a opção de baixar tudo para deixar pronto"* (2026-10-30);
//  2. *"vamos remover a seleção múltipla do cronograma, agora segurar vai servir
//     para mover o item em questão"* (2026-11-07).
//
// ## O que falha calado aqui
//
//  - **o alerta mentindo por omissão.** Ele conta o que NÃO toca sem rede, e a
//    conta é a única razão de ele existir: um item que depende da internet e não
//    entra na lista é um culto que para no sábado com o ícone escondido. Por
//    isso o bloco A mede o NÚMERO, e não "o ícone apareceu".
//  - **duas réguas para a mesma pergunta.** A folha (o que falta) e o botão (o
//    que baixar) têm de perguntar pela MESMA função — o bloco A4 compara os ids
//    que o botão pediu com os que a folha listou. Um `filter` novo no botão
//    (para "só os vídeos", digamos) deixaria a folha prometendo cinco e o botão
//    baixando dois, e o operador só descobriria no culto.
//  - **o contador fechando a conta errada.** O desfecho de uma rotina de massa
//    conta o que chegou ao DISCO, não o que foi tentado, e todo contador de
//    falha leva o DENOMINADOR. O bloco A4 força o pior caso (nada baixa) e cobra
//    a frase "0 de 2".
//  - **o arrasto que não move nada.** Um gesto que levanta a linha bonito e
//    solta no mesmo lugar é indistinguível de um toque que não pegou — o bloco
//    B mede a ORDEM GRAVADA no banco, não o desenho.
//  - **o toque virando arrasto.** O arrasto começa no toque LONGO (450 ms); um
//    toque curto continua projetando, e é o que o bloco B3 confere.
//  - **a seleção sobrevivendo em pedaços.** Bloco C: `#selbar` no documento,
//    `enterSelection` no escopo global e o par ↑↓ nas linhas do Cronograma são
//    as três metades que teriam de sair juntas.
//
// ## A reversão de cada asserção (o passo que ela cobra)
//
//  · A (o ícone e a conta) — apagar a chamada de `agendarConferenciaDoCronograma`
//    no fim do `renderLibrary`: o ícone nunca aparece.
//  · A2 (a régua única) — trocar em `faltaParaTocarSemRede` o ramo do
//    `youtubeId` por `return null`: o vídeo do link sai da conta e o numero cai
//    de 2 para 1.
//  · A3/A4 (a folha e o botão) — trocar o `itens` da folha por uma frase fixa:
//    a comparação de ids deixa de ter o que comparar (o teste reprova pelo
//    número de linhas da lista).
//  · B (o arrasto) — devolver a chamada que o toque longo fazia antes
//    (`enterSelection`): a ordem não muda e o `.arrastando` nunca nasce.
//  · B4 (o gesto tomado pelo sistema) — tirar o `touchmove` que cancela a
//    rolagem: a metade (a) reprova. E trocar o `pointercancel` por
//    `limparArrasto()`: a ordem fica a de antes e a metade (b) reprova.
//  · C (a remoção) — reintroduzir o `#selbar` no HTML: o bloco C acusa.
//
//   node tools/cronograma-pronto.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import {
  servirEstatico, abrirNavegador, esperarCortina, esperar, esperarDb, porque, checar, falhas,
  comModoAvancado,
} from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port + '/controle/index.html';
const navegador = await abrirNavegador();
const erros = [];
try {
  const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true });
  await semRedeExterna(ctx);
  await comModoAvancado(ctx);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await pg.goto(base, { waitUntil: 'load' });
  await esperarCortina(pg);

  // ==========================================================================
  // A. O ALERTA DE "NÃO ESTÁ PRONTO"
  // ==========================================================================
  //
  // Quatro itens, um de cada família que a pergunta precisa separar: o que já
  // está no aparelho, a cena de texto, o link do YouTube e o vídeo da semana.
  // O cenário é montado pelas portas do BANCO (`addMedia`/`addUrlMedia`/
  // `addCue`), que são as mesmas do app — nada de escrever no DOM à mão.
  const ids = await pg.evaluate(async () => {
    setAppMode('full');
    await AVDB.listSet('imports', () => []);
    const baixado = await AVDB.addMedia(new Blob([new Uint8Array(8)], { type: 'audio/mpeg' }),
      { name: 'Louvor no aparelho', type: 'audio/mpeg', kind: 'audio', list: 'imports' });
    const link = await AVDB.addUrlMedia('https://www.youtube.com/watch?v=abc12345678',
      { name: 'Vídeo do link', kind: 'youtube', youtubeId: 'abc12345678', list: 'imports' });
    const cena = await AVDB.addCue('message', { text: 'Bom dia' }, { name: 'Aviso', list: 'imports' });
    const semana = {
      id: 'semana-teste', kind: 'semana', type: 'semana/serie',
      name: 'Série — vídeo da semana', semana: { chave: 'chave-que-nao-existe' },
      blob: null, url: null, thumb: null, youtubeId: null, createdAt: Date.now(),
    };
    await AVDB.mediaAdd(semana);
    await AVDB.listAdd('imports', semana.id);
    await load();
    return { baixado: baixado.id, link: link.id, cena: cena.id, semana: semana.id };
  });
  await pg.evaluate((i) => { window.__ids = i; }, ids);

  // A CONFERÊNCIA roda depois do desenho (ela lê o banco); esperar pelo FATO é
  // o ícone visível, nunca um prazo.
  const apareceu = await esperar(pg, () => {
    const b = document.getElementById('cronoAlerta');
    return !!b && !b.hidden;
  }, null, 8000);
  checar(apareceu === true,
    'A · o alerta aparece ao lado do nome quando algum item do cronograma depende da rede',
    porque(apareceu));

  const alerta = await pg.evaluate(() => {
    const b = document.getElementById('cronoAlerta');
    const titulo = document.getElementById('cronoTitulo');
    if (!b || !titulo) return null;
    const rb = b.getBoundingClientRect();
    const rt = titulo.getBoundingClientRect();
    return {
      escondido: b.hidden,
      frase: b.title,
      // O ícone é IRMÃO do título e está à DIREITA dele — "ao lado do nome",
      // como o operador pediu; e o nome continua o alvo da gaveta.
      direita: rb.left >= rt.right - 0.5,
      quadrado: Math.abs(rb.width - rb.height) <= 0.5 && rb.width >= 30,
    };
  });
  checar(!!alerta && !alerta.escondido && alerta.direita && alerta.quadrado,
    'A · ele é um alvo quadrado À DIREITA do nome (não por cima dele), e não é a porta da gaveta',
    JSON.stringify(alerta));
  checar(/\b2\b/.test(alerta && alerta.frase || ''),
    'A · a conta é DOIS: o vídeo do link e o da semana. O áudio que já está no aparelho e a '
    + 'cena de texto não entram',
    alerta && alerta.frase);

  // ---- A2 · A PERGUNTA É UMA FUNÇÃO SÓ ----
  const tipos = await pg.evaluate(async () => {
    const { baixado, link, cena, semana } = window.__ids;
    const ler = async (id) => { const r = await AVDB.getMedia(id); return await faltaParaTocarSemRede(r); };
    return { baixado: await ler(baixado), link: await ler(link), cena: await ler(cena), semana: await ler(semana) };
  });
  checar(tipos.baixado === null && tipos.cena === null,
    'A2 · "toca sem rede?" responde NADA para o que já tem bytes no aparelho e para a cena de texto',
    JSON.stringify(tipos));
  checar(tipos.link === 'video' && tipos.semana === 'semana',
    'A2 · e ela NOMEIA o que falta nas outras duas famílias, em vez de só dizer "não"',
    JSON.stringify(tipos));

  // ---- A3 · A FOLHA DIZ O QUE FALTA ----
  // A FOLHA É ASSÍNCRONA: o toque dispara `abrirFaltaDoCronograma`, que PERGUNTA
  // ao banco antes de abrir. Esperar pelo fato é esperar a classe, nunca um prazo.
  await pg.evaluate(() => document.getElementById('cronoAlerta').click());
  const abriu = await esperar(pg, () => document.getElementById('appDialog').classList.contains('open'), null, 8000);
  checar(abriu === true, 'A3 · o toque no alerta abre a folha', porque(abriu));
  const folha = await pg.evaluate(async () => {
    const d = document.getElementById('appDialog');
    const aberto = d.classList.contains('open');
    return {
      aberto,
      titulo: document.getElementById('appDialogTitle').textContent,
      itens: [...document.querySelectorAll('#appDialogItens li')].map((li) => li.textContent),
      ok: document.getElementById('appDialogOk').textContent,
      cancelar: document.getElementById('appDialogCancel').hidden
        ? null : document.getElementById('appDialogCancel').textContent,
      rodape: document.getElementById('appDialogRodape').textContent,
    };
  });
  checar(folha.aberto && folha.itens.length === 2,
    'A3 · tocar no alerta abre a folha com UMA LINHA POR TIPO (dois tipos aqui)',
    JSON.stringify(folha));
  checar(/vídeo do YouTube/.test(folha.itens.join(' | ')) && /semana/.test(folha.itens.join(' | ')),
    'A3 · as duas linhas nomeiam o que falta, sem número interno e sem nome de símbolo',
    JSON.stringify(folha.itens));
  checar(folha.ok === 'Baixar tudo' && folha.cancelar !== null,
    'A3 · e ela PERGUNTA (Baixar tudo × Agora não) — o botão que baixa é a resposta, '
    + 'e "nada baixa sozinho" está escrito no rodapé',
    JSON.stringify({ ok: folha.ok, cancelar: folha.cancelar, rodape: folha.rodape }));

  // FECHAR SEM BAIXAR não pode baixar nada — e a lista não muda.
  const fechou = await pg.evaluate(() => {
    document.getElementById('appDialogCancel').click();
    return !document.getElementById('appDialog').classList.contains('open');
  });
  checar(fechou, 'A3 · "Agora não" fecha a folha sem tocar em nada');

  // ---- A4 · O BOTÃO PEDE O QUE A FOLHA PROMETEU, E A CONTA FECHA ----
  //
  // O download de verdade é do shell (`__NATIVE__` não existe no navegador), e
  // o que este bloco mede é a DECISÃO: substituir `baixarUmFaltante` deixa o
  // teste dono do desfecho (pior caso: nada chega) e prova, de uma vez, que o
  // botão usa a MESMA lista da folha e que o contador conta o que chegou ao
  // disco.
  const conta = await pg.evaluate(async () => {
    window.__pedidos = [];
    window.baixarUmFaltante = async (rec, tipo) => { window.__pedidos.push([rec.id, tipo]); return false; };
    document.getElementById('cronoAlerta').click();
    for (let i = 0; i < 100 && !document.getElementById('appDialog').classList.contains('open'); i++) {
      await new Promise((r) => setTimeout(r, 50));
    }
    const lista = [...document.querySelectorAll('#appDialogItens li')].map((li) => li.textContent).length;
    document.getElementById('appDialogOk').click();
    // A folha fecha, o laço roda e o desfecho abre um SEGUNDO diálogo (aviso,
    // sem cancelar). Esperar por ele é esperar pelo fato; o prazo curto é do
    // laço, que aqui não baixa nada.
    for (let i = 0; i < 100 && !/Faltou|Pronto/.test(document.getElementById('appDialogTitle').textContent || ''); i++) {
      await new Promise((r) => setTimeout(r, 50));
    }
    return {
      lista,
      pedidos: window.__pedidos.slice(),
      titulo: document.getElementById('appDialogTitle').textContent,
      mensagem: document.getElementById('appDialogMsg').textContent,
      ok: document.getElementById('appDialogOk').textContent,
      semCancelar: document.getElementById('appDialogCancel').hidden,
    };
  });
  const pediu = conta.pedidos.map((p) => p[0]).sort();
  const devia = [ids.link, ids.semana].sort();
  checar(conta.lista === 2 && JSON.stringify(pediu) === JSON.stringify(devia),
    'A4 · "Baixar tudo" pede EXATAMENTE os itens que a folha listou — a mesma régua nas duas pontas',
    JSON.stringify({ lista: conta.lista, pedidos: conta.pedidos }));
  checar(JSON.stringify(conta.pedidos.map((p) => p[1]).sort()) === JSON.stringify(['semana', 'video']),
    'A4 · e pede cada um pelo caminho dele (o link do YouTube × o vídeo da semana)',
    JSON.stringify(conta.pedidos));
  checar(/0 de 2/.test(conta.mensagem) && conta.titulo === 'Faltou baixar',
    'A4 · o desfecho conta o que CHEGOU ao aparelho, com o denominador: nada baixou, e a '
    + 'frase diz "0 de 2" em vez de anunciar sucesso',
    JSON.stringify({ titulo: conta.titulo, mensagem: conta.mensagem }));
  await pg.evaluate(() => document.getElementById('appDialogOk').click());

  // ---- A5 · SEM NADA FALTANDO, O ÍCONE NÃO EXISTE NA TELA ----
  //
  // O caso normal é este: o Cronograma pronto não mostra ícone nenhum. É a
  // metade que impede o alerta de virar ruído permanente.
  await pg.evaluate(async (i) => {
    await AVDB.listRemove('imports', i.link);
    await AVDB.listRemove('imports', i.semana);
    await load();
  }, ids);
  const sumiu = await esperar(pg, () => {
    const b = document.getElementById('cronoAlerta');
    return !!b && b.hidden;
  }, null, 8000);
  checar(sumiu === true,
    'A5 · com tudo no aparelho (ou sem item que dependa da rede) o ícone sai da tela',
    porque(sumiu));

  // ==========================================================================
  // B. SEGURAR ARRASTA
  // ==========================================================================
  //
  // Quatro linhas com bytes (o caso pronto), para a ordem ser a única coisa em
  // jogo. `fileAdd` seria a forma do acervo; `addMedia` é a porta do IMPORT e
  // é a mesma que o app usa para arquivo escolhido à mão.
  const quatro = await pg.evaluate(async () => {
    await AVDB.listSet('imports', () => []);
    const out = [];
    for (const nome of ['A', 'B', 'C', 'D']) {
      const m = await AVDB.addMedia(new Blob([new Uint8Array(8)], { type: 'audio/mpeg' }),
        { name: 'Louvor ' + nome, type: 'audio/mpeg', kind: 'audio' });
      out.push(m.id);
      await AVDB.listAdd('imports', m.id);
    }
    await load();
    return out;
  });

  // O PONTO DE PARTIDA: as linhas desenhadas, nenhum ↑↓ e nenhuma `.selbar`.
  const antes = await pg.evaluate(() => ({
    linhas: document.querySelectorAll('#library > .lib-item').length,
    setas: document.querySelectorAll('#library .row-ordem').length,
    selbar: !!document.getElementById('selbar'),
  }));
  checar(antes.linhas === 4 && antes.setas === 0,
    'B · ponto de partida: quatro linhas no Cronograma e NENHUM par ↑↓ — quem reordena é o gesto',
    JSON.stringify(antes));

  // O GESTO, com o mouse (que o Chromium entrega como ponteiro): pressionar no
  // CORPO da terceira linha, esperar o toque longo, subir uma casa e soltar.
  const geo = await pg.evaluate((id) => {
    const li = document.querySelector('#library > .lib-item[data-id="' + id + '"]');
    const r = li.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), alt: r.height };
  }, quatro[2]);
  await pg.mouse.move(geo.x, geo.y);
  await pg.mouse.down();
  const levantou = await esperar(pg, () => !!document.querySelector('#library > .lib-item.arrastando'), null, 4000);
  checar(levantou === true,
    'B1 · segurar a linha a LEVANTA (ela ganha o estado de arrasto em vez de entrar em modo de seleção)',
    porque(levantou));

  await pg.mouse.move(geo.x, Math.round(geo.y - geo.alt * 1.5), { steps: 6 });
  const noAr = await pg.evaluate(() => {
    const li = document.querySelector('#library > .lib-item.arrastando');
    const outros = [...document.querySelectorAll('#library > .lib-item:not(.arrastando)')];
    // O VÃO: os itens que a lista deslocou para abrir o lugar. Lido do
    // `transform` INLINE (o alvo), e não do computado — ali a transição dá um
    // valor intermediário e a medida dependeria do relógio.
    const movidos = outros
      .filter((el) => /translateY\(-?[\d.]+px\)/.test(el.style.transform || ''))
      .map((el) => ({ id: el.dataset.id, dy: parseFloat(/translateY\((-?[\d.]+)px\)/.exec(el.style.transform)[1]) }));
    const passo = li ? li.getBoundingClientRect().height
      + (parseFloat(getComputedStyle(document.getElementById('library')).rowGap) || 0) : 0;
    return {
      deslocou: !!li && /translateY\(-?\d/.test(li.style.transform || ''),
      movidos,
      passo: Math.round(passo * 10) / 10,
      // NENHUMA marca de posição: o vão é a única resposta.
      marca: !!document.querySelector('#library > .drop-line'),
    };
  });
  checar(noAr.deslocou && noAr.movidos.length === 1 && !noAr.marca,
    'B2 · o item acompanha o dedo e a LISTA abre o lugar — UM item deslocado, e '
    + 'nenhum elemento de marcação do destino (o espaço é a resposta)',
    JSON.stringify(noAr));
  checar(noAr.movidos.length === 1
      && Math.abs(Math.abs(noAr.movidos[0].dy) - noAr.passo) <= 1,
    'B2 · e o vão tem o TAMANHO do item arrastado mais o vão da lista — é o '
    + 'espaço exato que ele vai ocupar',
    JSON.stringify(noAr));

  await pg.mouse.up();
  const ordemCerta = [quatro[0], quatro[2], quatro[1], quatro[3]];
  const ordem = await esperarDb(pg, async (esperado) => {
    const atuais = await AVDB.listIds('imports');
    return atuais.join(',') === esperado.join(',');
  }, ordemCerta, 8000);
  checar(ordem === true,
    'B2 · e soltar GRAVA a ordem nova: o item foi para a casa de cima, no banco (não só no desenho)',
    JSON.stringify(await pg.evaluate(async () => await AVDB.listIds('imports'))));

  // O gesto não pode deixar rastro: nem classe, nem vão, nem transform.
  const limpo = await pg.evaluate(() => ({
    arrastando: !!document.querySelector('.arrastando'),
    classe: document.getElementById('library').classList.contains('arrastando-lista'),
    transform: [].some.call(document.querySelectorAll('#library > .lib-item'), (li) => li.style.transform),
  }));
  checar(!limpo.arrastando && !limpo.classe && !limpo.transform,
    'B2 · e o desenho volta ao normal no fim (sem classe e sem `transform` pendurado — o vão fecha)',
    JSON.stringify(limpo));

  // ---- B3 · O TOQUE CURTO CONTINUA PROJETANDO ----
  //
  // O arrasto começa no toque LONGO; um toque curto não pode virar arrasto nem
  // deixar de fazer o que sempre fez. A prova é o que foi ao ar.
  const tocou = await pg.evaluate(async (id) => {
    const li = document.querySelector('#library > .lib-item[data-id="' + id + '"]');
    const row = li.querySelector('.row');
    const r = row.getBoundingClientRect();
    const ev = (t, extra) => row.dispatchEvent(new PointerEvent(t, Object.assign({
      bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch',
      clientX: r.left + 40, clientY: r.top + r.height / 2, button: 0, buttons: 1,
    }, extra)));
    ev('pointerdown');
    await new Promise((f) => setTimeout(f, 60));
    ev('pointerup', { buttons: 0 });
    return { arrastando: !!document.querySelector('.arrastando') };
  }, quatro[2]);
  const noArPeloToque = await esperar(pg, (id) => currentId === id, quatro[2], 8000);
  checar(!tocou.arrastando && noArPeloToque === true,
    'B3 · um toque CURTO não arrasta e continua pondo o item no ar (o gesto novo não roubou o toque)',
    JSON.stringify({ tocou, noArPeloToque: porque(noArPeloToque) }));

  // ---- B4 · O SISTEMA PODE TOMAR O GESTO, E O ITEM NÃO PODE VOLTAR ATRÁS ----
  //
  // Relato do operador sobre a v1.13.52: *"ele tenta arrastar, aparecem as
  // marcas, mas a qualquer movimento ele desseleciona e desliga o sistema de
  // reposicionamento"*. O toque longo funcionava (a marca aparecia); quem
  // morria era o MOVIMENTO: o navegador tomava o dedo para ROLAGEM e mandava
  // `pointercancel` no primeiro pixel. As duas metades do conserto se medem
  // aqui — (a) a rolagem é cancelada enquanto o arrasto dura, e (b) se o
  // cancelamento chegar mesmo assim, o item CAI onde o vão está.
  const geoD = await pg.evaluate((id) => {
    const li = document.querySelector('#library > .lib-item[data-id="' + id + '"]');
    const r = li.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), alt: r.height };
  }, quatro[3]);
  await pg.mouse.move(geoD.x, geoD.y);
  await pg.mouse.down();
  const levantou2 = await esperar(pg, () => !!document.querySelector('#library > .lib-item.arrastando'), null, 4000);
  checar(levantou2 === true,
    'B4 · ponto de partida: a segunda linha levanta no toque longo', porque(levantou2));
  await pg.mouse.move(geoD.x, Math.round(geoD.y - geoD.alt * 1.5), { steps: 3 });

  const rolagem = await pg.evaluate(() => {
    const alvo = document.getElementById('library');
    // O `TouchEvent` não carrega toques de verdade — o que se mede é se ALGUÉM
    // cancelou o evento, que é exatamente a pergunta que o navegador faz antes
    // de decidir se rola.
    const ev = new TouchEvent('touchmove', { bubbles: true, cancelable: true });
    alvo.dispatchEvent(ev);
    return { cancelado: ev.defaultPrevented };
  });
  checar(rolagem.cancelado === true,
    'B4 · durante o arrasto a ROLAGEM é CANCELADA — é isso que impede o navegador '
    + 'de tomar o dedo (e mandar `pointercancel`) no primeiro movimento', JSON.stringify(rolagem));

  // E O CANCELAMENTO NÃO DESFAZ O MOVIMENTO: ele entrega onde o VÃO está.
  await pg.evaluate(() => {
    const row = document.querySelector('#library > .lib-item.arrastando .row');
    if (row) row.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 1 }));
  });
  const ordemCancelada = [quatro[0], quatro[2], quatro[3], quatro[1]];
  const caiu = await esperarDb(pg, async (esperado) => {
    const atuais = await AVDB.listIds('imports');
    return atuais.join(',') === esperado.join(',');
  }, ordemCancelada, 8000);
  checar(caiu === true,
    'B4 · e um `pointercancel` do sistema NÃO joga o item de volta: ele cai onde o '
    + 'vão estava aberto (reverter calado era o defeito do relato)',
    JSON.stringify(await pg.evaluate(async () => await AVDB.listIds('imports'))));

  // ---- B5 · AO SOLTAR, NADA PISCA NA ORDEM ANTIGA ----
  //
  // Relato do operador sobre a v1.13.54: *"ao soltar na nova posição, a lista,
  // por uma fração de segundo, pisca na ordem antiga, antes de piscar na
  // posição correta"*. A causa era apagar os deslocamentos ANTES de a gravação
  // terminar: a tela voltava à ordem velha até o redesenho.
  //
  // A prova é lida NO MESMO TIQUE do `pointerup`, dentro da página e antes de
  // qualquer `await` do app: com o conserto, a lista continua na ordem FINAL
  // (os outros deslocados, o item no vão) enquanto a gravação corre.
  const antesB5 = await pg.evaluate(async () => await AVDB.listIds('imports'));
  const semPisca = await pg.evaluate(() => new Promise((ok) => {
    // A LISTA PODE SER REDESENHADA ENTRE O BLOCO ANTERIOR E ESTE (a gravação do
    // B4 dispara um `load`), e o nó que se pega aqui pode sair do documento.
    // Por isso o alvo é escolhido NA HORA, e a investida é refeita se ele cair.
    const tentada = (n) => {
      const ul = document.getElementById('library');
      const lis = [...ul.children].filter((el) => el.classList.contains('lib-item'));
      if (lis.length < 3) return ok({ erro: 'lista curta demais para o ensaio' });
      const alvo = lis[lis.length - 1];              // o ÚLTIMO da lista
      const row = alvo.querySelector('.row');
      const r = alvo.getBoundingClientRect();
      const x = Math.round(r.left + r.width / 2);
      const y0 = Math.round(r.top + r.height / 2);
      const ev = (t, extra) => row.dispatchEvent(new PointerEvent(t, Object.assign({
        bubbles: true, cancelable: true, pointerId: 11, pointerType: 'touch',
        clientX: x, clientY: y0, button: 0, buttons: 1,
      }, extra || {})));
      let tiques = 0;
      ev('pointerdown');
      const espera = setInterval(() => {
        if (!alvo.isConnected) {
          clearInterval(espera);
          return n < 3 ? tentada(n + 1) : ok({ erro: 'a lista foi redesenhada três vezes no meio' });
        }
        if (!alvo.classList.contains('arrastando')) {
          if (++tiques > 66) { clearInterval(espera); ok({ erro: 'o arrasto não começou' }); }
          return;
        }
        clearInterval(espera);
        // Sobe dois vãos: vai para o TOPO da lista.
        const y1 = Math.round(r.top - r.height * 2.2);
        ev('pointermove', { clientY: y1 });
        ev('pointerup', { clientY: y1, buttons: 0 });
        // LIDO AQUI — o instante que a v1.13.54 mostrava na ordem velha.
        ok({
          classe: ul.classList.contains('arrastando-lista'),
          deslocados: [...ul.children].filter((el) => el.classList.contains('lib-item') && el.style.transform).length,
          doAlvo: alvo.style.transform || '',
          preso: !!document.querySelector('.lib-item.arrastando'),
        });
      }, 30);
    };
    tentada(0);
  }));
  checar(!semPisca.erro && semPisca.classe === true && semPisca.preso === false,
    'B5 · no instante do soltar a lista CONTINUA em modo de arrasto (ela não volta à ordem antiga) '
    + 'e o item já não está preso ao dedo',
    JSON.stringify(semPisca));
  checar(!semPisca.erro && semPisca.deslocados >= 1 && /translateY\(-?\d/.test(semPisca.doAlvo),
    'B5 · e o que se vê nesse instante é a ordem FINAL: os outros seguem deslocados e o item '
    + 'já está no vão — nenhum quadro com a ordem de antes',
    JSON.stringify(semPisca));

  const ordemB5 = [antesB5[antesB5.length - 1], ...antesB5.slice(0, -1)];
  const gravouB5 = await esperarDb(pg, async (esperado) => {
    const atuais = await AVDB.listIds('imports');
    return atuais.join(',') === esperado.join(',');
  }, ordemB5, 8000);
  checar(gravouB5 === true,
    'B5 · e a gravação fecha a conta: o item saiu do fim e virou o primeiro',
    JSON.stringify(await pg.evaluate(async () => await AVDB.listIds('imports'))));

  // ==========================================================================
  // C. A SELEÇÃO MÚLTIPLA SAIU INTEIRA
  // ==========================================================================
  const restos = await pg.evaluate(() => ({
    selbar: !!document.getElementById('selbar'),
    funcao: typeof enterSelection,
    contador: !!document.getElementById('selCount'),
    setas: document.querySelectorAll('#library .row-ordem').length,
  }));
  checar(!restos.selbar && restos.funcao === 'undefined' && !restos.contador,
    'C · a barra de seleção e o que a dirigia saíram do documento e do código — não é um modo '
    + 'escondido, é ausência',
    JSON.stringify(restos));
  checar(restos.setas === 0,
    'C · e o par ↑↓ do Cronograma saiu junto: a ordem é do gesto, e um segundo caminho para a '
    + 'mesma decisão voltaria a divergir dele',
    JSON.stringify(restos));

  checar(erros.length === 0, 'nenhum erro de página', erros.slice(0, 3));
} finally {
  await navegador.close();
  await new Promise((r) => servidor.close(r));
}

console.log('\n' + (falhas.length ? falhas.length + ' FALHA(S)' : 'tudo certo'));
process.exit(falhas.length ? 1 : 0);
