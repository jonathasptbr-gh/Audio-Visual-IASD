#!/usr/bin/env node
// ============================================================================
// O ATALHO DA SAÍDA DE ÁUDIO, E A IMAGEM DA PRÉVIA DESLIGÁVEL (v1.9.9)
//
// Dois recursos num arquivo porque eles compartilham o CENÁRIO — a folha de
// Configurações com a ponte de mentira e uma lista de telas mutável —, e montar
// esse cenário é o que custa. Eles não compartilham nada mais: o que cada um
// trava está abaixo, e as reversões são independentes.
//
// ## 1. O ATALHO DA SAÍDA DE ÁUDIO — o que ele trava
//
// Ele é um botão que **abre uma tela do sistema e não faz mais nada**, e essa
// classe de botão tem um modo de falhar próprio: no navegador ele não tem ponte
// nenhuma a chamar, e um tile aceso que não liga nada é indistinguível de um
// quebrado (a regra da v1.8.50). A guarda é `hidden` fora do app, e ela mora
// numa LISTA COMPARTILHADA com os três do aparelho (`pacoteRenderTiles`) —
// tirá-lo de lá não quebra nada visível no aparelho, o que é exatamente por que
// ninguém veria.
//
// A terceira asserção é a linha do REGISTRO. O alvo não é API documentada e
// varia por fabricante: quando o botão abre a tela errada, essa string é a ÚNICA
// resposta possível a distância — e ela some sem sintoma, porque o Registro é
// lido por alguém que não tem o aparelho na mão.
//
// ## 2. A IMAGEM DA PRÉVIA — as cinco metades, e por que nenhuma basta
//
//  1. **APAGADO SEM DESTINO DE PROJEÇÃO.** Sem TV e sem computador conectado a
//     prévia É a projeção: é o `<video>` dela em tela cheia que a congregação
//     vê. Um tile que aceitasse o toque ali desligaria o culto.
//  2. **LIGADO, O DECODIFICADOR PARA — E FICA PARADO.** O `pause()` mora no
//     `play()` do `stage` (`setSuspenso`) porque um `play` chega por caminhos
//     que o Controle não enumera. A asserção que separa "pausou uma vez" de
//     "está suspenso" é a que manda um `play` DEPOIS.
//  3. **O QUE NÃO DESLIGA.** É a metade do pedido que se erra
//     (*"mantenha as outras conexões de controle"*): `getCurrent()` e a DURAÇÃO
//     continuam em dia — sem isso a barra do Controle mede uma mídia sem
//     duração —, e o comando continua saindo para o telão.
//  4. **PERDER O DESTINO RELIGA SOZINHO, E A MARCAÇÃO FICA.** O veredito é
//     derivado (`economiaAtiva`), então a TV saindo devolve a imagem sem
//     ninguém tocar em nada, e a TV voltando volta a poupar. Se isto quebrar, o
//     desfecho é o operador sem prévia num culto sem TV — a projeção apagada.
//  5. **A TELA CHEIA SUSPENDE.** Em tela cheia o operador está OLHANDO para a
//     prévia, e um retângulo em branco ali recusa a única pergunta que aquele
//     gesto faz. Suspensa e não desligada: sair volta a poupar.
//
//   node tools/saida-de-audio-e-economia.test.mjs
// ============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperarCortina, esperar, porque, checar, falhas } from './arnes.mjs';

// A ponte de mentira, com a lista de telas MUTÁVEL (a do
// `som-nao-vaza-ao-perder-a-tela`) e com o `abrirSaidaDeAudio` GRAVANDO: o que
// se mede aqui é o que o app PEDE ao shell — a tela do sistema não existe num
// navegador, e afirmar que ela abriu seria afirmar o arnês.
const PONTE = `(() => {
  window.__telas = [];
  window.__espelho = { ligado: false, telas: [] };
  window.__saidaAberta = 0;
  const B = {
    shellVersion: () => 73,
    role: () => 'controle',
    appVersion: () => '1.99-teste',
    takeShare: () => '',
    busPost: (t) => { try { (window.__enviados = window.__enviados || []).push(JSON.parse(t)); } catch (_) {} },
    otaConfirm: () => {},
    abrirSaidaDeAudio: () => { window.__saidaAberta++; },
    // O RÓTULO É VERBATIM DA FORMA QUE O KOTLIN MONTA (rótulo + componente entre
    // parênteses): a linha do Registro existe para dizer QUAL candidato pegou, e
    // um stub que devolvesse só "ok" não provaria que o componente atravessa.
    saidaDeAudioAlvo: (id) => {
      setTimeout(() => {
        try { window.__avResolve(id, { label: 'Seletor de saída de áudio (com.android.settings/.panel.Panel)' }); } catch (_) {}
      }, 0);
    },
    displays: (id) => {
      setTimeout(() => { try { window.__avResolve(id, window.__telas); } catch (_) {} }, 0);
    },
    // O shell de verdade SEMPRE responde um objeto aqui; o genérico resolveria
    // null, que o app lê como "NÃO SEI" e não como "não há transmissão" — ver
    // 'haDestinoDeProjecao', que é a régua inteira deste arquivo.
    espelhoEstado: (id) => {
      setTimeout(() => { try { window.__avResolve(id, window.__espelho); } catch (_) {} }, 0);
    },
  };
  const nomes = ['apkInstalar','apkProcurar','bgProgress','captureVolumeKeys','projecaoLocal',
    'castTarget','saidaDeAudioAlvo','cifraDiag','cifraHtml','deckDiscard','deckExportUrl','deckPages',
    'espelhoCertApagar','espelhoCertEstado','espelhoCertImportar','espelhoDesligar','espelhoDiag',
    'espelhoEstado','espelhoLigar','espelhoLigarEm','espelhoDerrubar','farolEstado','keepAlive',
    'listFolder','nowPlaying','openCast','abrirSaidaDeAudio','openExternal','otaApply','otaCheck',
    'otaDiag','otaPending','pacoteDiag','pickDoc','pickFolder','salvarTexto','systemVolume',
    'temaClaro','ytCancel','ytCanalPlaylists','ytDiag','ytDiscard','ytFetch','ytFetchAte',
    'ytFetchAudio','ytPlaylist','ytSearch','ytStream','areaTransferencia','atualizacaoEstado',
    'compartilharTexto','pacoteDescartarPronto','espacoLivre',
  ];
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

// Uma faixa de 30 s: o percurso liga, desliga e religa a economia antes de medir,
// e uma faixa que acabasse no meio disso pararia sozinha — o `pausado: true` sairia
// verdadeiro pelo motivo errado, que é a tautologia que este projeto já pagou
// (ver `preview-volta-ao-wallpaper`). `kind: 'video'` porque é o *kind* que
// decide a cena: um `audio` sem letra deixa a prévia no wallpaper, sem `<video>`
// a que perguntar.
const SEMEAR = `
  const wav = (secs) => {
    const sr = 8000, n = sr * secs;
    const buf = new ArrayBuffer(44 + n * 2), dv = new DataView(buf);
    const wr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    wr(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); wr(8, 'WAVEfmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true);
    dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
    wr(36, 'data'); dv.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, Math.sin(i / 20) * 3000, true);
    return new Blob([buf], { type: 'audio/wav' });
  };
  const id = 'louvor-economia';
  const caminho = 'folders/teste/' + id + '.wav';
  await AVDB.opfsWriteFile(caminho, wav(30));
  await AVDB.fileAdd({
    id, folder: 'teste', opfsPath: caminho, srcName: id,
    name: 'LOUVOR DA ECONOMIA', type: 'audio/wav', kind: 'video', size: 1, mtime: 1,
    thumb: null, blob: null, url: null, addedAt: 1, lyrics: null,
  });
  await AVDB.listAdd('imports', id);
  // A SEGUNDA FAIXA existe pela célula do D6: com uma só, o avanço recarrega a
  // MESMA mídia e 'getCurrent()' continua certo por não ter mudado — a asserção
  // passaria mesmo com a entrega do 'load' à prévia PULADA (MEDIDO). Duração
  // diferente de propósito, para a régua poder ser o ID **e** o número.
  const id2 = 'louvor-seguinte';
  const caminho2 = 'folders/teste/' + id2 + '.wav';
  await AVDB.opfsWriteFile(caminho2, wav(12));
  await AVDB.fileAdd({
    id: id2, folder: 'teste', opfsPath: caminho2, srcName: id2,
    name: 'LOUVOR SEGUINTE', type: 'audio/wav', kind: 'video', size: 1, mtime: 1,
    thumb: null, blob: null, url: null, addedAt: 2, lyrics: null,
  });
  await AVDB.listAdd('imports', id2);
`;

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port;
const navegador = await abrirNavegador({ args: ['--autoplay-policy=no-user-gesture-required'] });
const erros = [];

// O ESTADO INTEIRO NUMA LEITURA. `pvVideo.paused` é o DESFECHO (o decodificador),
// a classe e a marca são o que o operador VÊ, e `getDuration`/`getCurrent` são a
// metade que não pode ter desligado junto.
const lerTudo = (pg) => pg.evaluate(() => {
  const v = document.getElementById('pvVideo');
  const pv = document.getElementById('preview');
  const tile = document.getElementById('economiaTile');
  const dur = preview.getDuration();
  return {
    pausado: !!v.paused,
    invisivel: getComputedStyle(v).visibility === 'hidden',
    classe: pv.classList.contains('pv-economia'),
    // A RÉGUA É O RENDERIZADO, não o atributo. `.pv-economia-marca` declara
    // `display: flex`, e um `display` de autor atropela o `[hidden]` da folha do
    // agente EM SILÊNCIO — é a armadilha que o `.qs-tile[hidden]` deste app já
    // paga por escrito. Aqui quem a fecha é o `[hidden] { display: none
    // !important }` do topo do `controle.css`, e medir o atributo aprovaria a
    // marca mesmo que ela ficasse acesa nos dois estados.
    marca: (() => {
      const m = document.getElementById('pvEconomia');
      const r = m.getBoundingClientRect();
      return getComputedStyle(m).display !== 'none' && r.width > 0 && r.height > 0;
    })(),
    // A CAIXA DELA COBRE A PRÉVIA INTEIRA (`inset: 0`, para centrar o desenho sem
    // uma medida à mão), então a régua de posição e de colisão é a TINTA — o
    // `<svg>` filho. Medir a caixa reprovaria sempre, e por um motivo que não é
    // defeito nenhum.
    tinta: (() => {
      const g = document.querySelector('#pvEconomia svg');
      if (!g) return null;
      const b = g.getBoundingClientRect();
      return { x: b.left, y: b.top, w: b.width, h: b.height, r: b.right, b: b.bottom };
    })(),
    // E A CAIXA NÃO PODE RECEBER O TOQUE: ela cobre os quatro controles da prévia,
    // e sem o `pointer-events: none` eles ficam inalcançáveis por baixo dela.
    marcaAtravessa: (() => {
      const m = document.getElementById('pvEconomia');
      return getComputedStyle(m).pointerEvents === 'none';
    })(),
    // E ELA TEM DE CABER DENTRO DA PRÉVIA: `#preview` recorta, e uma marca fora
    // da caixa some sem erro nenhum.
    //
    // A SEGUNDA RÉGUA É A COLISÃO, e ela existe porque a primeira escrita deste
    // comentário CREDITAVA A PEÇA ERRADA: dizia que *"a coluna de `.pv-fab` mora à
    // direita mas EM CIMA"*, e `.pv-fabs` é `top: 2px; bottom: 2px; right: 2px` —
    // uma coluna de altura INTEIRA, com a tela cheia empurrada para a base por
    // `margin-top: auto`. Se algum controle estiver à vista naquele canto, a marca
    // é desenhada por cima do desenho dele, e `pointer-events: none` não conserta
    // nada disso: o toque passa, a leitura é que fica ilegível.
    marcaDentro: (() => {
      const g = document.querySelector('#pvEconomia svg');
      if (!g) return false;
      const r = g.getBoundingClientRect();
      const p = document.getElementById('preview').getBoundingClientRect();
      return r.width > 0 && r.right <= p.right + 0.5 && r.bottom <= p.bottom + 0.5
        && r.left >= p.left - 0.5 && r.top >= p.top - 0.5;
    })(),
    tileApagado: !!tile.disabled,
    tileAlt: tile.classList.contains('qs-alt'),
    tileTitulo: tile.title,
    marcacao: !!economiaPreview,
    vigor: !!economiaAtiva(),
    // A metade que não pode ter desligado junto com a imagem.
    temCena: !!(preview.getCurrent() && preview.getCurrent().id),
    cenaId: (preview.getCurrent() || {}).id || null,
    duracao: Number.isFinite(dur) && dur > 0,
    podeMexer: !!preverPodeMexer(),
  };
});

async function abrir() {
  const ctx = await navegador.newContext({ viewport: { width: 430, height: 900 } });
  await semRedeExterna(ctx);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await pg.addInitScript(PONTE);
  await pg.goto(base + '/controle/', { waitUntil: 'load' });
  await pg.waitForFunction(
    () => window.__NATIVE__ === true && window.AVDB && typeof window.__avBack === 'function',
    null, { timeout: 30000 },
  );
  await esperarCortina(pg);
  return { ctx, pg };
}

// Troca a lista de telas e ESPERA a ingestão — nunca um prazo fixo. Quem responde
// "já chegou?" é o próprio app, e não uma segunda leitura da regra aqui dentro.
const trocarTelas = async (pg, telas) => {
  await pg.evaluate((t) => { window.__telas = t; window.__avDisplaysChanged(); }, telas);
  await pg.waitForFunction(
    (t) => Array.isArray(lastDisplays) && lastDisplays.length === t.n,
    { n: telas.length }, { timeout: 5000 },
  );
};
const TV = [{ id: 7, name: 'TV do templo', w: 1920, h: 1080, density: 320, telao: true }];

const lerRegistro = (pg) => pg.evaluate(async () => {
  await window.renderDiag();
  return typeof diagTexto === 'string' ? diagTexto : '';
});

try {
  const { ctx, pg } = await abrir();

  // =========================================================================
  // A · O ATALHO DA SAÍDA DE ÁUDIO
  // =========================================================================
  const tileAudio = await pg.evaluate(() => {
    const t = document.getElementById('saidaAudioTile');
    if (!t) return null;
    return {
      oculto: !!t.hidden,
      titulo: (t.querySelector('.qs-titulo') || {}).textContent || '',
      dica: t.title,
      // O DESENHO É PRÓPRIO, e não o `#icoSom` (que neste app significa MUDO):
      // reusá-lo faria o mesmo traço responder duas perguntas.
      simbolo: (t.querySelector('use') || {}).getAttribute
        ? t.querySelector('use').getAttribute('href') : '',
    };
  });
  checar(!!tileAudio, 'A1 · o tile "Saída de áudio" existe na folha');
  checar(tileAudio && tileAudio.oculto === false,
    'A2 · e no APP ele está à vista', tileAudio);
  checar(tileAudio && tileAudio.simbolo === '#icoSaidaDeAudio',
    'A3 · com desenho PRÓPRIO — o `#icoSom` deste app significa MUDO, e um símbolo '
    + 'que responde duas perguntas não responde nenhuma', tileAudio);
  checar(tileAudio && /Android/.test(tileAudio.dica),
    'A4 · e a dica diz que quem escolhe a saída é o ANDROID: ele ABRE, não roteia '
    + '— rotear áudio é privilégio de sistema, e um tile que parecesse decidir '
    + 'seria lido como quebrado no dia em que o som não mudasse', tileAudio);

  await pg.evaluate(() => { document.getElementById('saidaAudioTile').click(); });
  const abriu = await esperar(pg, () => window.__saidaAberta === 1, null, 5000);
  checar(abriu === true,
    'A5 · o toque pede ao shell para abrir a tela do sistema, UMA vez', porque(abriu));

  const reg = await lerRegistro(pg);
  checar(/Saída de áudio abre: Seletor de saída de áudio \(com\.android\.settings/.test(reg),
    'A6 · e o Registro carrega o alvo COM o componente — a única resposta possível '
    + 'a distância quando o botão abre a tela errada',
    (reg.match(/Saída de áudio abre:.*/) || ['(a linha não saiu)'])[0]);

  // NO NAVEGADOR ELE NÃO EXISTE, e esta asserção precisa de um contexto SEM a
  // ponte: medir o `hidden` no app aprova o tile mesmo que ninguém o esconda
  // nunca (lá ele é `false` das duas formas). O defeito vive só do outro lado —
  // um tile aceso que não liga nada, que é a regra da v1.8.50.
  const ctxWeb = await navegador.newContext({ viewport: { width: 430, height: 900 } });
  await semRedeExterna(ctxWeb);
  const pgWeb = await ctxWeb.newPage();
  await pgWeb.goto(base + '/controle/', { waitUntil: 'load' });
  await esperarCortina(pgWeb);
  const noNavegador = await pgWeb.evaluate(() => {
    const t = document.getElementById('saidaAudioTile');
    return { oculto: !!(t && t.hidden), semCaixa: !t || t.getBoundingClientRect().width === 0 };
  });
  checar(noNavegador.oculto === true && noNavegador.semCaixa === true,
    'A7 · e NO NAVEGADOR ele não existe: sem ponte não há tela do sistema a abrir, e '
    + 'um tile que só sabe não funcionar é pior que tile nenhum',
    noNavegador);

  // A FILEIRA DO APARELHO CONTINUA INTEIRA com a grade em onze tiles. O pedido da
  // v1.7.6 valia por ARITMÉTICA (9 em 3 colunas), e sem o `grid-column: 1` o
  // `compartilhar` fecharia a terceira fileira ao lado de uma PREFERÊNCIA,
  // deixando exportar/importar órfãos na quarta — a tríade sai partida e o pedido
  // morre por um tile novo em qualquer lote futuro. A régua é o TOPO de cada
  // caixa: classe nenhuma descreve "estão na mesma fileira".
  const fileira = await pg.evaluate(() => {
    const t = (id) => document.getElementById(id).getBoundingClientRect().top;
    return { compartilhar: Math.round(t('shareAppTile')), exportar: Math.round(t('pacoteExportarTile')),
      importar: Math.round(t('pacoteImportarTile')), economia: Math.round(t('economiaTile')) };
  });
  checar(fileira.compartilhar === fileira.exportar && fileira.exportar === fileira.importar,
    'A8 · os TRÊS do aparelho ficam na MESMA fileira com a grade em onze tiles '
    + '(*"compartilhar, exportar e importar devem ser os tres itens da base"*)',
    fileira);
  await ctxWeb.close();

  checar(fileira.economia < fileira.compartilhar,
    'A9 · e as preferências ficam ACIMA deles — é a ordem por ASSUNTO que a posição '
    + 'diz sem gastar uma linha de texto', fileira);

  // =========================================================================
  // B · A ECONOMIA SEM DESTINO DE PROJEÇÃO: o tile APAGADO
  // =========================================================================
  const semDestino = await lerTudo(pg);
  checar(semDestino.tileApagado === true,
    'B1 · SEM TV e sem computador conectado o tile está APAGADO: ali a prévia É a '
    + 'projeção, e aceitar o toque desligaria o culto', semDestino);
  checar(/prévia É a projeção/.test(semDestino.tileTitulo),
    'B2 · e o `title` diz POR QUÊ — apagado sem motivo se lê como quebrado '
    + '(a regra da v1.8.50)', semDestino.tileTitulo);

  // O toque não passa: `disabled` é o que faz o navegador ENGOLIR o evento, e é
  // por isso que ele não é uma classe.
  await pg.evaluate(() => { document.getElementById('economiaTile').click(); });
  const naoPassou = await lerTudo(pg);
  checar(naoPassou.marcacao === false,
    'B3 · e o toque nele não marca nada', naoPassou);

  // =========================================================================
  // C · COM DESTINO: liga, e o DECODIFICADOR PARA
  // =========================================================================
  await pg.evaluate(new Function('return (async () => { setAppMode("full");' + SEMEAR + 'await load(); })()'));
  await trocarTelas(pg, TV);
  await pg.evaluate(() => send('louvor-economia'));
  const tocou = await esperar(pg, () => {
    const v = document.getElementById('pvVideo');
    return !v.paused && v.currentTime > 0.15;
  }, null, 8000);
  checar(tocou === true,
    'C1 · a faixa entra em cena e a prévia ILUSTRA, tocando — a linha de base',
    porque(tocou));

  const destravou = await lerTudo(pg);
  checar(destravou.tileApagado === false,
    'C2 · com a TV conectada o tile DESTRAVA', destravou);

  await pg.evaluate(() => { document.getElementById('economiaTile').click(); });
  const ligou = await esperar(pg, () => economiaAtiva() === true, null, 5000);
  checar(ligou === true, 'C3 · e o toque liga a economia', porque(ligou));

  const comEconomia = await lerTudo(pg);
  checar(comEconomia.pausado === true,
    'C4 · O DECODIFICADOR PARA — é o recurso inteiro, e é a única metade que '
    + 'devolve processamento ao telão (os três WebViews dividem UM processo)',
    comEconomia);
  checar(comEconomia.invisivel === true,
    'C5 · e a imagem SAI DE VISTA: um vídeo pausado mostra o quadro congelado, e '
    + 'uma imagem à vista ao lado da marca "desligada" se lê como prévia TRAVADA',
    comEconomia);
  checar(comEconomia.marca === true && comEconomia.tileAlt === true,
    'C6 · a marca aparece (RENDERIZADA, não só sem o atributo) e o tile '
    + 'troca de DESENHO (a grade tem uma cor só desde a v1.7.6 — estado é desenho, '
    + 'nunca luz)', comEconomia);
  checar(comEconomia.marcaDentro === true,
    'C6b · e ela cabe DENTRO da prévia: `#preview` recorta, e uma marca fora da '
    + 'caixa some sem erro nenhum', comEconomia);
  const colisao = await pg.evaluate(() => {
    const mr = document.querySelector('#pvEconomia svg').getBoundingClientRect();
    return [...document.querySelectorAll('.pv-fab')].filter((e) => {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
      const b = e.getBoundingClientRect();
      if (!b.width || !b.height) return false;
      return !(b.right <= mr.left || b.left >= mr.right || b.bottom <= mr.top || b.top >= mr.bottom);
    }).map((e) => e.id || e.className);
  });
  checar(colisao.length === 0,
    'C6c · e a TINTA dela não cai SOBRE nenhum controle da prévia: MEDIDO, os '
    + 'QUATRO cantos têm um `.pv-fab` de 34px (as duas colunas de controles têm '
    + 'altura inteira), e desenhar sobre o símbolo de um botão o deixa ilegível — '
    + '`pointer-events: none` não conserta isso, porque o que se perde é a LEITURA',
    colisao.join(', ') || '(nenhum)');
  checar(comEconomia.marcaAtravessa === true,
    'C6d · e a CAIXA dela deixa o toque passar: ela cobre a prévia inteira para '
    + 'centrar o desenho, e sem isso os quatro controles ficam inalcançáveis por '
    + 'baixo dela', comEconomia.marcaAtravessa);
  checar(comEconomia.podeMexer === false,
    'C7 · e o realinhamento para de gastar trabalho sobre um `<video>` que não vai '
    + 'andar — a MESMA guarda da página oculta, e não uma segunda régua',
    comEconomia);

  // =========================================================================
  // D · O QUE **NÃO** DESLIGA — a metade do pedido que se erra
  // =========================================================================
  const antes = await pg.evaluate(() => (window.__enviados || []).length);
  await pg.evaluate(() => { cmd({ type: 'play' }); });
  // A ASSERÇÃO QUE SEPARA "pausou uma vez" DE "está suspenso". Sem o `pause()`
  // dentro do `play()` do stage, este comando religa o decodificador e a economia
  // vira um botão que fez efeito por um instante.
  const seguiuParado = await pg.evaluate(async () => {
    await new Promise((r) => setTimeout(r, 600));
    const v = document.getElementById('pvVideo');
    return { pausado: !!v.paused, enviados: (window.__enviados || []).length };
  });
  checar(seguiuParado.pausado === true,
    'D2 · e um `play` CHEGANDO DEPOIS não religa: a suspensão mora no `play()` do '
    + 'stage justamente porque um `play` chega por caminhos que o Controle não '
    + 'enumera (load com autoplay, onBlocked, realinhamento)', seguiuParado);
  checar(seguiuParado.enviados > antes,
    'D3 · e o comando CONTINUA SAINDO para o telão e para as telas da rede — a '
    + 'economia é da prévia, não do barramento',
    { antes, depois: seguiuParado.enviados });

  // A FILA CONTINUA ANDANDO, e esta é a asserção de maior alcance do arquivo: uma
  // playlist que para de avançar no meio do culto é o pior desfecho que esta
  // economia sabe produzir, e ela pararia se o avanço dependesse do `<video>` da
  // prévia. Ele NÃO depende: com TV o caminho é o `media-ended` do telão, e o
  // `onEnded` da prévia (que a economia de fato cala) sempre foi só a rede de
  // segurança do caso SEM projeção — onde a economia não está ativa.
  //
  // A ENTREGA É POR `BroadcastChannel` DE UM IFRAME, e não uma chamada ao
  // handler: um canal não entrega a si mesmo, e chamar o handler daqui pularia
  // justamente a RECEPÇÃO que se quer provar.
  const filaAntes = await pg.evaluate(async () => {
    await AVDB.listAdd('playlist', 'louvor-economia');
    await AVDB.listAdd('playlist', 'louvor-seguinte');
    await load();
    send('louvor-economia');
    return { idNoAr: currentId, fila: (plItems || []).length };
  });
  await esperar(pg, () => economiaAtiva() === true, null, 5000);
  await pg.evaluate((id) => {
    const f = document.createElement('iframe');
    f.style.display = 'none';
    document.body.appendChild(f);
    f.contentWindow.eval('new BroadcastChannel("av-iasd").postMessage('
      + JSON.stringify({ type: 'media-ended', mediaId: id }) + ')');
  }, filaAntes.idNoAr);
  const avancou = await esperar(pg, () => currentId === 'louvor-seguinte', null, 8000);
  checar(avancou === true,
    'D4 · A FILA CONTINUA ANDANDO com a economia ligada: o `media-ended` do telão é '
    + 'o caminho do avanço com TV, e o `onEnded` da prévia (que a economia cala) '
    + 'sempre foi só a rede de segurança do caso SEM projeção — onde a economia '
    + 'nem está ativa', porque(avancou));

  // E a economia atravessa o avanço: um `load` novo não pode religar o
  // decodificador (o `load` com autoplay é justamente um dos caminhos que o
  // `pause()` dentro do `play()` do stage existe para cobrir).
  const depoisDoAvanco = await lerTudo(pg);
  checar(depoisDoAvanco.vigor === true && depoisDoAvanco.pausado === true,
    'D5 · e ela ATRAVESSA o avanço: a mídia seguinte entra com o decodificador '
    + 'parado, sem ninguém tocar no tile', depoisDoAvanco);
  // ===== A CÉLULA É UM `load` QUE ACONTECE **DURANTE** A ECONOMIA =====
  //
  // Esta asserção nasceu medindo o estado logo depois de LIGAR a economia, e ali
  // ela era TAUTOLOGIA: a mídia tinha sido carregada ANTES, então `getCurrent()` e
  // `getDuration()` já estavam preenchidos e nenhuma reversão os apagava. MEDIDO
  // com a reversão que ela existe para pegar — a "otimização" plausível de soltar
  // o decodificador de vez, pulando o `preview.handle(obj)` do ramo `load` quando
  // a economia está ligada —, ela passava verde. Aqui o `load` é o do avanço da
  // fila, que acontece COM a economia em vigor, e a reversão reprova.
  // A RÉGUA É O ESTADO ASSENTADO: `preview.handle({type:'load'})` é assíncrono por
  // dentro (`getMedia` → `opfsGetFile`), então `currentId` já é o novo enquanto
  // `getCurrent()` ainda é o anterior. Ler no instante do avanço media o quadro de
  // ANTES — a mesma armadilha do G2, e a que a v1.9.8 anotou pelo lado oposto.
  // A DURAÇÃO ENTRA NO PREDICADO, e não numa leitura depois: o `<video>` a conhece
  // por `loadedmetadata`, que chega alguns quadros após o `load`. MEDIDO — a
  // asserção separada passou numa execução e reprovou na seguinte, sem uma linha
  // do app mudar, que é o sintoma de uma régua lendo o primeiro quadro.
  const cenaTrocou = await esperar(pg, () => {
    const c = preview.getCurrent() || {};
    const d = preview.getDuration();
    return c.id === 'louvor-seguinte' && Number.isFinite(d) && d > 0;
  }, null, 8000);
  checar(cenaTrocou === true,
    'D6 · e a prévia sabe QUAL mídia é a nova, com a duração dela: a economia não '
    + 'pode pular a entrega '
    + 'do `load` a ela, senão `getCurrent()` fica preso na faixa ANTERIOR e a barra '
    + 'do Controle passa a medir a mídia errada — é a metade que *"manter as outras '
    + 'conexões de controle"* nomeia', porque(cenaTrocou));
  const cenaNova = await lerTudo(pg);
  checar(cenaNova.pausado === true,
    'D6b · e o decodificador AINDA parado com a mídia nova em cena', cenaNova);

  // =========================================================================
  // E · PERDER O DESTINO RELIGA SOZINHO, E A MARCAÇÃO FICA
  // =========================================================================
  await trocarTelas(pg, []);
  const perdeu = await esperar(pg, () => economiaAtiva() === false, null, 5000);
  checar(perdeu === true,
    'E1 · a TV saindo tira a economia de VIGOR sozinha — o veredito é derivado, e '
    + 'sem isso o operador ficaria num culto sem TV com a projeção apagada',
    porque(perdeu));

  const semTvAgora = await lerTudo(pg);
  checar(semTvAgora.classe === false && semTvAgora.invisivel === false && semTvAgora.marca === false,
    'E2 · e a imagem volta à vista no ato', semTvAgora);
  checar(semTvAgora.marcacao === true,
    'E3 · MAS A MARCAÇÃO FICA: ela é a escolha do operador, e reconectar a TV tem '
    + 'de voltar a poupar sem ele tocar em nada', semTvAgora);
  checar(semTvAgora.tileApagado === true,
    'E4 · o tile volta a apagar, porque a pergunta dele é o DESTINO', semTvAgora);

  await trocarTelas(pg, TV);
  const voltou = await esperar(pg, () => economiaAtiva() === true, null, 5000);
  checar(voltou === true,
    'E5 · e a TV voltando volta a poupar, sem um toque — é a outra ponta do mesmo '
    + 'veredito derivado', porque(voltou));

  // =========================================================================
  // F · A MARCAÇÃO É DO APARELHO: ela sobrevive a fechar o app
  // =========================================================================
  // O MESMO CONTEXTO, porque o IndexedDB é por ORIGIN: um contexto novo abriria
  // um banco vazio e a asserção passaria sobre o padrão em vez de sobre o que foi
  // gravado. A recarga é o que reexecuta o `load()`.
  await pg.reload({ waitUntil: 'load' });
  await pg.waitForFunction(() => window.__NATIVE__ === true && window.AVDB, null, { timeout: 30000 });
  await esperarCortina(pg);
  const depoisDaRecarga = await pg.evaluate(() => ({ marcacao: !!economiaPreview }));
  checar(depoisDaRecarga.marcacao === true,
    'F1 · a marcação vem do BANCO e não da sessão: o celular fraco continua fraco '
    + 'na abertura seguinte, e remarcá-la em todo culto é o oposto do pedido',
    depoisDaRecarga);

  // =========================================================================
  // G · A TELA CHEIA SUSPENDE A ECONOMIA
  // =========================================================================
  await pg.evaluate(new Function('return (async () => { setAppMode("full"); await load(); })()'));
  await trocarTelas(pg, TV);
  await pg.evaluate(() => send('louvor-economia'));
  await esperar(pg, () => economiaAtiva() === true, null, 8000);

  // O gesto é um CLIQUE de verdade (`requestFullscreen` exige ativação do
  // usuário), e a PREMISSA é uma asserção própria: sem ela, um runner que recuse
  // a tela cheia faria as duas seguintes medirem o estado de antes e passarem
  // caladas — a armadilha que o `comTema` do arnês já pagou por outro caminho.
  await pg.click('#pvFullBtn');
  const entrou = await esperar(pg, () => document.fullscreenElement === document.getElementById('preview'), null, 5000);
  checar(entrou === true,
    'G1 · PREMISSA: a prévia entra em tela cheia de verdade neste runner',
    porque(entrou));

  if (entrou === true) {
    // O ESTADO ASSENTADO, e não o primeiro quadro: `document.fullscreenElement` é
    // escrito ANTES de o `fullscreenchange` rodar, então ler a visibilidade no
    // instante em que a tela cheia aparece mede o quadro de ANTES — e a asserção
    // passa ou falha por carga do runner. MEDIDO: ela falhou ao abrir um segundo
    // contexto no arquivo, sem uma linha do app ter mudado. É a mesma armadilha
    // da régua que a v1.9.8 anotou (esperar pelo que está indo embora), pelo lado
    // oposto — aqui se esperava pelo que ainda não chegou.
    const assentou = await esperar(pg, () => economiaAtiva() === false
      && !document.getElementById('preview').classList.contains('pv-economia'), null, 5000);
    checar(assentou === true,
      'G2a · a suspensão assenta: o `fullscreenchange` tira a economia de vigor',
      porque(assentou));
    const cheia = await lerTudo(pg);
    checar(cheia.vigor === false && cheia.invisivel === false,
      'G2 · em tela cheia a economia é SUSPENSA e a imagem volta: ali o operador '
      + 'está OLHANDO para a prévia, e um retângulo em branco recusa a única '
      + 'pergunta que aquele gesto faz', cheia);
    checar(cheia.marcacao === true,
      'G3 · SUSPENSA e não desligada — a marcação atravessa', cheia);
    // O REGISTRO TEM DE DIZER A RAZÃO CERTA, e são TRÊS estados. A primeira
    // escrita perguntava só "está em vigor?" e atribuía toda suspensão à falta de
    // destino — em tela cheia isso é uma linha FALSA num texto lido A DISTÂNCIA
    // por quem não tem o aparelho na mão, que é o pior artefato que este projeto
    // sabe produzir. Aqui HÁ destino, e a razão é a tela cheia.
    const regCheia = await lerRegistro(pg);
    const linhaCheia = (regCheia.match(/Imagem da prévia:.*/) || [''])[0];
    checar(/SUSPENSA agora/.test(linhaCheia) && /tela cheia/.test(linhaCheia)
      && !/sem destino/.test(linhaCheia),
      'G3b · e o Registro nomeia a razão CERTA (a tela cheia), não a falta de '
      + 'destino — há destino neste cenário', linhaCheia || '(a linha não saiu)');

    await pg.evaluate(() => { if (document.exitFullscreen) document.exitFullscreen(); });
    const saiu = await esperar(pg, () => !document.fullscreenElement && economiaAtiva() === true, null, 5000);
    checar(saiu === true,
      'G4 · e sair da tela cheia volta a poupar — quem reavalia é o '
      + '`fullscreenchange`, porque num culto com a TV parada não vem outra '
      + 'notícia de destino', porque(saiu));
  }

  checar(erros.length === 0, 'H · nenhum erro de página em todo o percurso', erros.join(' | '));
  await ctx.close();
} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) {
  console.error('\nFALHOU:\n' + falhas.map((f) => ' - ' + f).join('\n'));
  process.exit(1);
}
console.log('\nTodos passaram.');
