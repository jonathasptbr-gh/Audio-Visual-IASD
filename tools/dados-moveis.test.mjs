#!/usr/bin/env node
// ============================================================================
// A OPÇÃO "DADOS MÓVEIS" (v1.11.0)
//
// Pedido do operador: *"crie uma opção para permitir ou não o uso de dados
// móveis para as funções do app, coloque essa opção nas configurações"*.
//
// ## O que ela substitui, e por que o diálogo tinha de sair
//
// Até aqui, fora do Wi-Fi confirmado, a sincronização em massa de um álbum ou
// de um grupo (`syncCollection`/`syncGroup`) abria um DIÁLOGO por toque —
// *"Baixar usando dados móveis?"* — e o comentário de origem dizia, por
// escrito, que a escolha *"não vira uma preferência do app"*. Virou, a pedido:
// hoje a decisão mora nas Configurações, vale para o app inteiro, e o diálogo
// SAIU — sem Wi-Fi e sem a opção ligada, o app não pergunta mais, só espera.
//
// Os DOIS automáticos que já eram Wi-Fi-only (o episódio da semana de uma
// série, os fundos da letra) agora também obedecem à opção — perguntado se
// deveriam, o operador respondeu *"Sim, incluir os dois"*. O que fica de FORA,
// também por resposta explícita: um download AVULSO (tocar, adicionar ao
// Cronograma/Favoritos) e um vídeo do YouTube — continuam sempre permitidos,
// como já eram.
//
// ## O que este oráculo mede
//
//  A. O TILE em Configurações: nasce DESLIGADO, sempre clicável e ACESO (a
//     regra da v1.7.6 — estado só no ícone), com o `title` certo nos dois
//     estados; o toque grava no banco e sobrevive a um reload.
//  B. NENHUM DIÁLOGO ABRE MAIS — a prova de regressão mais importante deste
//     lote: `appConfirm`/`appDialogEl` nunca ficam `.open` durante um
//     `syncCollection`/`syncGroup` em rede móvel, nas duas direções (opção
//     desligada = espera; ligada = baixa).
//  C. O RAMO "JÁ COMPLETO OFFLINE" cede à MESMA regra: sem a opção e sem
//     Wi-Fi, sincronizar um álbum cujo áudio já está no aparelho não busca
//     fundo nem cifra nenhuma — o automático de fundos fecha essa lacuna
//     sozinho depois, quando a rede permitir.
//  D. `redeLiberadaParaBaixar()` isolada: Wi-Fi sozinho basta, a opção sozinha
//     basta, nenhum dos dois bloqueia.
//
// A REVERSÃO (desfazer as duas linhas que trocam `isConfirmedWifi()` por
// `redeLiberadaParaBaixar()` em `syncCollection`/`syncGroup`, e desfazer a
// remoção do `appConfirm`) faz o bloco B reprovar: o diálogo volta a abrir, ou
// o download passa mesmo com a opção desligada e sem Wi-Fi.
//
//   node tools/dados-moveis.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperarCortina, esperar, porque, checar, falhas } from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);

await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador();
const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true });
await semRedeExterna(ctx);
const pg = await ctx.newPage();

const rede = (tipo) => pg.evaluate((t) => {
  if (!navigator.connection) Object.defineProperty(navigator, 'connection', { value: {}, configurable: true });
  Object.defineProperty(navigator.connection, 'type', { value: t, configurable: true });
}, tipo);

// O ARNÊS DA FONTE — a MESMA forma do `download-do-acervo.test.mjs`: o banco
// sempre responde (é ele que faz a lista chegar), e o servidor de ARQUIVOS é
// quem varia. Aqui só precisa de UM modo (sempre OK) — o que se mede é SE o
// pedido sai, não como ele falha.
const armarFonte = () => pg.evaluate(() => {
  window.__pedidos = 0;
  const real = window.fetch;
  window.fetch = async (u, o) => {
    const s = String(u && u.url ? u.url : u);
    if (s.includes('api.louvorja.com.br/file')) {
      window.__pedidos++;
      return new Response(new Blob([new Uint8Array(2048)], { type: 'audio/mpeg' }), { status: 200 });
    }
    return real(u, o);
  };
  Louvorja.fetchList = async (file) => {
    if (file === 'fonte-dm') {
      return { musics: [{ id_music: 201, track: 1, name: 'Hino DM', duration: '00:03:00' }] };
    }
    return { id_music: 201, url_music: '/musics/pt/Teste/Hino DM.mp3', url_image: null,
      has_instrumental_music: false, lyric: null };
  };
});

const dialogoAbriu = () => pg.evaluate(() => appDialogEl.classList.contains('open'));

try {
  await pg.goto(base + '/controle/', { waitUntil: 'load' });
  await pg.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function', null, { timeout: 30000 });
  await esperarCortina(pg);
  await pg.evaluate(() => { setAppMode('full'); });
  await armarFonte();

  // =========================================================================
  // A · O TILE EM CONFIGURAÇÕES
  // =========================================================================
  await pg.evaluate(() => { document.getElementById('settingsBtn').click(); });
  await pg.waitForSelector('#fadePopup.open', { timeout: 5000 });

  const ler = () => pg.evaluate(() => {
    const t = document.getElementById('dadosMoveisTile');
    return {
      existe: !!t,
      apagado: !!t.disabled,
      aceso: t.classList.contains('qs-on'),
      alt: t.classList.contains('qs-alt'),
      titulo: t.title,
      valor: !!permitirDadosMoveis,
    };
  });

  const antes = await ler();
  checar(antes.existe, 'A · o tile "Dados móveis" existe em Configurações');
  checar(antes.valor === false && antes.alt === false,
    'A1 · nasce DESLIGADO — a régua conservadora que os dois automáticos já '
    + 'seguiam sozinhos: ninguém que não abrir esta folha vê consumo novo de '
    + 'dados móveis aparecer sozinho', antes);
  checar(antes.apagado === false && antes.aceso === true,
    'A2 · SEMPRE clicável e ACESO — o mesmo padrão do "Imagem da prévia" ao '
    + 'lado (a regra da v1.7.6: estado só no ícone, nunca na cor)', antes);
  checar(/Permitir que o acervo/.test(antes.titulo),
    'A3 · o título explica o que ele liga', antes.titulo);

  await pg.evaluate(() => { document.getElementById('dadosMoveisTile').click(); });
  const depois = await ler();
  checar(depois.valor === true && depois.alt === true,
    'A4 · o toque MARCA — e o ícone troca (`qs-alt`), nunca a cor', depois);
  checar(/toque para restringir/.test(depois.titulo),
    'A5 · e o título muda para explicar o desfazer', depois.titulo);

  await pg.reload({ waitUntil: 'load' });
  await pg.waitForFunction(() => window.AVDB && typeof window.__avBack === 'function', null, { timeout: 30000 });
  await esperarCortina(pg);
  // O RELOAD APAGA O ARNÊS DA FONTE (uma escrita em runtime, não
  // `addInitScript`): sem rearmar aqui, os blocos B/C mediriam a rede de
  // verdade — bloqueada por `semRedeExterna` — e não o recurso.
  await armarFonte();
  const depoisDoReload = await pg.evaluate(() => !!permitirDadosMoveis);
  checar(depoisDoReload === true,
    'A6 · a marcação SOBREVIVE ao reload — vem do banco, como a "Imagem da '
    + 'prévia" ao lado, não da sessão', depoisDoReload);
  await pg.evaluate(() => setPermitirDadosMoveis(false));

  // =========================================================================
  // D · `redeLiberadaParaBaixar()` ISOLADA
  // =========================================================================
  await rede('cellular');
  const d1 = await pg.evaluate(() => redeLiberadaParaBaixar());
  checar(d1 === false, 'D1 · sem Wi-Fi e com a opção desligada, a rede NÃO está liberada', d1);
  await pg.evaluate(() => setPermitirDadosMoveis(true));
  const d2 = await pg.evaluate(() => redeLiberadaParaBaixar());
  checar(d2 === true, 'D2 · a OPÇÃO sozinha já libera, mesmo sem Wi-Fi', d2);
  await pg.evaluate(() => setPermitirDadosMoveis(false));
  await rede('wifi');
  const d3 = await pg.evaluate(() => redeLiberadaParaBaixar());
  checar(d3 === true, 'D3 · e o WI-FI sozinho já libera, mesmo com a opção desligada', d3);

  // =========================================================================
  // B · NENHUM DIÁLOGO ABRE MAIS
  // =========================================================================
  await rede('cellular');
  await pg.evaluate(() => { setPermitirDadosMoveis(false); });

  const semOpcao = await pg.evaluate(async () => {
    window.__pedidos = 0;
    const coll = { id: 'dm-b1', name: 'Álbum DM 1', kind: 'album', source: 'fonte-dm' };
    collState[coll.id] = { indexSyncedAt: 0, songs: [] };
    const r = await syncCollection(coll);
    return { pedidos: window.__pedidos, devolveu: r, status: ui(coll.id).status,
      completa: colecaoCompleta(coll.id) };
  });
  checar(semOpcao.pedidos === 0,
    'B1 · SEM Wi-Fi e SEM a opção: nenhum byte é pedido — nem para perguntar, '
    + 'nem para baixar', semOpcao);
  checar(semOpcao.completa === false, 'B2 · e o álbum continua incompleto', semOpcao);
  checar(/Dados móveis/.test(semOpcao.status) && /Wi-Fi/.test(semOpcao.status),
    'B3 · e o status diz o que fazer — esperar o Wi-Fi, ou ligar a opção',
    semOpcao.status);
  const abriuB = await dialogoAbriu();
  checar(abriuB === false,
    'B4 · e o DIÁLOGO NUNCA ABRIU — é a prova de regressão: até a v1.10.10 este '
    + 'exato cenário abria "Baixar usando dados móveis?" e esperava um toque',
    abriuB);

  await pg.evaluate(() => { setPermitirDadosMoveis(true); });
  const comOpcao = await pg.evaluate(async () => {
    window.__pedidos = 0;
    const coll = { id: 'dm-b2', name: 'Álbum DM 2', kind: 'album', source: 'fonte-dm' };
    collState[coll.id] = { indexSyncedAt: 0, songs: [] };
    const r = await syncCollection(coll);
    return { pedidos: window.__pedidos, devolveu: r, completa: colecaoCompleta(coll.id) };
  });
  checar(comOpcao.pedidos === 1 && comOpcao.completa === true,
    'B5 · COM a opção ligada, mesmo em rede móvel: baixa normalmente, sem '
    + 'perguntar nada', comOpcao);
  const abriuB2 = await dialogoAbriu();
  checar(abriuB2 === false, 'B6 · e também aqui nenhum diálogo abriu', abriuB2);

  // syncGroup, a mesma prova pelo caminho do LOTE (categoria/"todo o acervo")
  await pg.evaluate(() => { setPermitirDadosMoveis(false); });
  const grupoSem = await pg.evaluate(async () => {
    window.__pedidos = 0;
    const coll = { id: 'dm-g1', name: 'Álbum DM G1', kind: 'album', source: 'fonte-dm' };
    collState[coll.id] = { indexSyncedAt: 0, songs: [] };
    await syncGroup('dm-grupo', 'Grupo DM', [coll], null);
    return { pedidos: window.__pedidos, status: gui('dm-grupo').status, completa: colecaoCompleta(coll.id) };
  });
  checar(grupoSem.pedidos === 0 && grupoSem.completa === false,
    'B7 · `syncGroup` SEM Wi-Fi e sem a opção: também não pede nada', grupoSem);
  checar(/Wi-Fi/.test(grupoSem.status), 'B8 · e o status do LOTE também aponta o caminho', grupoSem.status);
  const abriuG = await dialogoAbriu();
  checar(abriuG === false,
    'B9 · e o diálogo do LOTE também não abre mais — até a v1.10.10 `syncGroup` '
    + 'tinha o próprio "Baixar usando dados móveis?"', abriuG);

  // =========================================================================
  // C · O RAMO "JÁ COMPLETO OFFLINE" CEDE À MESMA REGRA
  // =========================================================================
  await pg.evaluate(() => { setPermitirDadosMoveis(true); });
  const completoAntes = await pg.evaluate(async () => {
    // Deixa o áudio já baixado (com a opção ligada, sem custar a asserção).
    const coll = { id: 'dm-c1', name: 'Álbum DM C', kind: 'album', source: 'fonte-dm' };
    collState[coll.id] = { indexSyncedAt: 0, songs: [] };
    await syncCollection(coll);
    return colecaoCompleta(coll.id);
  });
  checar(completoAntes === true, 'C · PREMISSA: o álbum já está completo offline', completoAntes);

  await pg.evaluate(() => {
    window.__pedidosFundo = 0;
    window.__syncImagensReal = window.syncImagensColecao;
    window.syncImagensColecao = async (c) => { window.__pedidosFundo++; return window.__syncImagensReal(c); };
    window.__pedidosCifra = 0;
    window.__syncCifrasReal = window.syncCifrasColecao;
    window.syncCifrasColecao = async (c) => { window.__pedidosCifra++; return window.__syncCifrasReal(c); };
  });
  await pg.evaluate(() => { setPermitirDadosMoveis(false); });
  const completoSemOpcao = await pg.evaluate(async () => {
    const coll = { id: 'dm-c1', name: 'Álbum DM C', kind: 'album', source: 'fonte-dm' };
    await syncCollection(coll);
    return { fundo: window.__pedidosFundo, cifra: window.__pedidosCifra };
  });
  checar(completoSemOpcao.fundo === 0 && completoSemOpcao.cifra === 0,
    'C1 · sem Wi-Fi e sem a opção, sincronizar um álbum JÁ COMPLETO não busca '
    + 'fundo nem cifra — o automático de fundos fecha essa lacuna sozinho '
    + 'depois, quando a rede permitir', completoSemOpcao);

  await pg.evaluate(() => { setPermitirDadosMoveis(true); });
  const completoComOpcao = await pg.evaluate(async () => {
    const coll = { id: 'dm-c1', name: 'Álbum DM C', kind: 'album', source: 'fonte-dm' };
    window.__pedidosFundo = 0; window.__pedidosCifra = 0;
    await syncCollection(coll);
    return { fundo: window.__pedidosFundo, cifra: window.__pedidosCifra };
  });
  checar(completoComOpcao.fundo === 1 && completoComOpcao.cifra === 1,
    'C2 · e com a opção ligada, o mesmo toque em sincronizar BUSCA fundo e '
    + 'cifra normalmente', completoComOpcao);
  await pg.evaluate(() => {
    window.syncImagensColecao = window.__syncImagensReal;
    window.syncCifrasColecao = window.__syncCifrasReal;
  });

  await pg.evaluate(() => { setPermitirDadosMoveis(false); });
  await rede('wifi');
} finally {
  await navegador.close();
  await new Promise((r) => servidor.close(r));
}

console.log(falhas.length ? '\n' + falhas.length + ' falha(s)' : '\ntudo certo');
process.exit(falhas.length ? 1 : 0);
