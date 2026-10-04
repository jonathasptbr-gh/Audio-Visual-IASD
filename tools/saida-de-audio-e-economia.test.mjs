#!/usr/bin/env node
// ============================================================================
// O ATALHO DA SAÍDA DE ÁUDIO, E A SETA QUE RECOLHE A PRÉVIA (v1.9.9 / v1.11.7)
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
// numa LISTA COMPARTILHADA com os do aparelho (`pacoteRenderTiles`) — tirá-lo de
// lá não quebra nada visível no aparelho, o que é exatamente por que ninguém
// veria.
//
// A terceira asserção é a linha do REGISTRO. O alvo não é API documentada e
// varia por fabricante: quando o botão abre a tela errada, essa string é a ÚNICA
// resposta possível a distância — e ela some sem sintoma, porque o Registro é
// lido por alguém que não tem o aparelho na mão.
//
// A FILEIRA DO APARELHO (A8/A9): `shareAppTile` e `pacoteTile` fecham a grade de
// Configurações e começam fileira nova abaixo das preferências. A aritmética
// (6 preferências em 3 colunas) já os põe lá sozinha, e é por isso que a regra
// de CSS (`grid-column: 1`) só se prova numa célula em que a aritmética falha —
// uma preferência a menos (A9b).
//
// ## 2. A SETA QUE RECOLHE A PRÉVIA — as seis metades, e por que nenhuma basta
//
// A seta (`#pvRecolherBtn`, no topo da própria prévia, nos DOIS modos) tomou o
// lugar do tile "Imagem da prévia". Ela faz DUAS coisas com réguas diferentes de
// propósito: a GEOMETRIA (`pv-recolhida`) segue a MARCAÇÃO, e a DECODIFICAÇÃO
// (`economiaAtiva`) segue a marcação E o destino de projeção E o fora-da-tela-
// cheia. Ligar a decodificação à marcação pararia o `<video>` que, sem TV, é a
// fonte do som; ligar a geometria ao veredito faria a seta não fazer nada visível
// sem TV.
//
//  1. **SEMPRE CLICÁVEL, mesmo sem destino de projeção, E RECOLHE** (v1.10.10,
//     mantido): a escolha grava sem destino, e a prévia recolhe — é o que faz o
//     toque ter efeito à vista. Só o EFEITO sobre a decodificação continua
//     exclusivo de quando há para onde projetar.
//  2. **RECOLHIDA, A PRÉVIA MEDE POUCO E NENHUM BOTÃO SE PERDE.** A altura
//     medida cabe em 80px (38 sem selo/giro, 72 com) e todo `.pv-fab` fica
//     DENTRO dela, sem sobrepor outro e sem espremer. A reversão é tirar a regra
//     de CSS do recolhido.
//  3. **LIGADO, O DECODIFICADOR PARA — E FICA PARADO.** O `pause()` mora no
//     `play()` do `stage` (`setSuspenso`) porque um `play` chega por caminhos que
//     o Controle não enumera. A asserção que separa "pausou uma vez" de "está
//     suspenso" é a que manda um `play` DEPOIS.
//  4. **O QUE NÃO DESLIGA.** É a metade do pedido que se erra
//     (*"mantenha as outras conexões de controle"*): `getCurrent()` e a DURAÇÃO
//     continuam em dia — sem isso a barra do Controle mede uma mídia sem
//     duração —, e o comando continua saindo para o telão.
//  5. **PERDER O DESTINO RELIGA A DECODIFICAÇÃO, E A PRÉVIA CONTINUA RECOLHIDA.**
//     O veredito é derivado (`economiaAtiva`), então a TV saindo devolve o
//     `<video>` ao ar sem ninguém tocar em nada, mas a geometria é escolha do
//     operador: ela e a marcação ficam, e a TV voltando volta a poupar.
//  6. **A TELA CHEIA NÃO É RECOLHIDA.** Em tela cheia o operador está OLHANDO
//     para a prévia (e sem TV ela É a projeção): o CSS recolhido exclui
//     `:fullscreen`, a decodificação é suspensa, e sair volta recolhida sem
//     alternar a marcação.
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
  // O DESFECHO do último toque, como no aparelho: 'nunca' antes de tocar, e o que
  // o cenário mandar depois. É ele que responde *"o diálogo do sistema subiu?"* —
  // a terceira pergunta, que a lista de candidatos não responde.
  window.__saidaDesfecho = 'nunca';
  window.__saidaBloqueado = false;
  const B = {
    shellVersion: () => 73,
    role: () => 'controle',
    appVersion: () => '1.99-teste',
    takeShare: () => '',
    busPost: (t) => { try { (window.__enviados = window.__enviados || []).push(JSON.parse(t)); } catch (_) {} },
    otaConfirm: () => {},
    abrirSaidaDeAudio: () => {
      window.__saidaAberta++;
      // O APARELHO DE TESTE ENGOLE, como o do operador: o primeiro toque mede, e
      // do segundo em diante o shell já sabe e responde 'bloqueado'.
      window.__saidaDesfecho = window.__saidaDesfecho === 'nunca' ? 'engolido' : 'bloqueado';
      window.__saidaBloqueado = window.__saidaDesfecho === 'bloqueado';
    },
    // O RÓTULO É VERBATIM DA FORMA QUE O KOTLIN MONTA (rótulo + componente entre
    // parênteses): a linha do Registro existe para dizer QUAL candidato pegou, e
    // um stub que devolvesse só "ok" não provaria que o componente atravessa.
    saidaDeAudioAlvo: (id) => {
      setTimeout(() => {
        try {
          window.__avResolve(id, {
            label: 'Seletor de saída (SystemUI) (com.android.systemui/.media.MediaOutputDialogReceiver)',
            // UM CANDIDATO AUSENTE DE PROPÓSITO (o do app de Configurações): é o
            // caso do aparelho do operador na v1.9.9, e é ele que a linha do
            // Registro existe para dizer. Um stub com tudo presente provaria a
            // lista contra o cenário que nunca dá problema.
            desfecho: window.__saidaDesfecho,
            candidatos: [
              { acao: 'com.android.systemui.action.LAUNCH_MEDIA_OUTPUT_DIALOG',
                rotulo: 'Seletor de saída (SystemUI)', tipo: 'broadcast',
                alvo: 'com.android.systemui/.media.MediaOutputDialogReceiver',
                bloqueado: !!window.__saidaBloqueado },
              { acao: 'com.android.settings.panel.action.MEDIA_OUTPUT',
                rotulo: 'Seletor de saída (Configurações)', tipo: 'tela', alvo: null },
              { acao: 'android.settings.panel.action.VOLUME',
                rotulo: 'Painel de volume', tipo: 'tela',
                alvo: 'com.android.settings/.panel.SettingsPanelActivity' },
            ],
          });
        } catch (_) {}
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
// as classes e a seta são o que o operador VÊ, e `getDuration`/`getCurrent` são a
// metade que não pode ter desligado junto.
const lerTudo = (pg) => pg.evaluate(() => {
  const v = document.getElementById('pvVideo');
  const pv = document.getElementById('preview');
  const seta = document.getElementById('pvRecolherBtn');
  const dur = preview.getDuration();
  return {
    pausado: !!v.paused,
    invisivel: getComputedStyle(v).visibility === 'hidden',
    classe: pv.classList.contains('pv-economia'),
    // A GEOMETRIA: a classe que o CSS lê, e a altura RENDERIZADA — a primeira
    // sozinha aprovaria uma regra de CSS apagada.
    recolhida: pv.classList.contains('pv-recolhida'),
    altura: pv.getBoundingClientRect().height,
    setaApagada: !!seta.disabled,
    setaAlternada: seta.classList.contains('alternado'),
    setaExpandida: seta.getAttribute('aria-expanded'),
    setaTitulo: seta.title,
    marcacao: !!economiaPreview,
    vigor: !!economiaAtiva(),
    // A metade que não pode ter desligado junto com a imagem.
    temCena: !!(preview.getCurrent() && preview.getCurrent().id),
    cenaId: (preview.getCurrent() || {}).id || null,
    duracao: Number.isFinite(dur) && dur > 0,
    podeMexer: !!preverPodeMexer(),
  };
});

// OS CONTROLES DA PRÉVIA, MEDIDOS. Recolhida, a prévia vira uma grade de uma ou
// duas linhas, e o defeito que ela pode ter não é de estado: é um botão que
// sai da caixa (`#preview` recorta, e some sem erro), cai sobre outro, ou é
// espremido abaixo de um alvo de toque. A régua é o RENDERIZADO de cada
// `.pv-fab` visível, e a seta tem de receber o toque no centro dela.
const medirFabs = (pg) => pg.evaluate(() => {
  const pv = document.getElementById('preview').getBoundingClientRect();
  const visiveis = [...document.querySelectorAll('.pv-fab')].filter((e) => {
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
    const b = e.getBoundingClientRect();
    return b.width > 0 && b.height > 0;
  }).map((e) => {
    const b = e.getBoundingClientRect();
    return { id: e.id || e.className, l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height };
  });
  const T = 0.5;
  const fora = visiveis.filter((f) => f.l < pv.left - T || f.t < pv.top - T || f.r > pv.right + T || f.b > pv.bottom + T)
    .map((f) => f.id);
  const sobrepostos = [];
  for (let i = 0; i < visiveis.length; i++) {
    for (let j = i + 1; j < visiveis.length; j++) {
      const a = visiveis[i], b = visiveis[j];
      if (!(a.r <= b.l + T || b.r <= a.l + T || a.b <= b.t + T || b.b <= a.t + T)) sobrepostos.push(a.id + ' x ' + b.id);
    }
  }
  const espremidos = visiveis.filter((f) => f.w < 33.5 || f.h < 33.5).map((f) => f.id + ' ' + Math.round(f.w) + 'x' + Math.round(f.h));
  const seta = visiveis.find((f) => f.id === 'pvRecolherBtn');
  let setaCoberta = null;
  if (seta) {
    const alvo = document.elementFromPoint((seta.l + seta.r) / 2, (seta.t + seta.b) / 2);
    setaCoberta = !(alvo && alvo.closest('#pvRecolherBtn'));
  }
  return { n: visiveis.length, ids: visiveis.map((f) => f.id), fora, sobrepostos, espremidos, setaCoberta, altura: pv.height };
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
  checar(/Saída de áudio abre: Seletor de saída \(SystemUI\) \(com\.android\.systemui/.test(reg),
    'A6 · e o Registro carrega o alvo COM o componente — a única resposta possível '
    + 'a distância quando o botão abre a tela errada',
    (reg.match(/Saída de áudio abre:.*/) || ['(a linha não saiu)'])[0]);

  // ===== A CADEIA INTEIRA, e não só quem pegou (v1.9.10) =====
  //
  // A v1.9.9 abriu a tela errada no aparelho do operador, e o Registro daquela
  // versão não tinha como responder por quê: ele dizia qual candidato PEGOU, que
  // não é a mesma pergunta que quais EXISTEM. As duas metades desta asserção são
  // obrigatórias — a lista tem de mostrar o que ESTÁ lá E o que FALTA, senão ela
  // vira uma segunda cópia da linha de cima.
  const linhas = reg.split('\n').filter((x) => /^\s+· /.test(x));
  checar(linhas.length === 3,
    'A6a · o Registro lista a CADEIA inteira, um candidato por linha, na ordem',
    JSON.stringify(linhas));
  checar(/SystemUI.*\[broadcast\].*com\.android\.systemui/.test(linhas[0] || ''),
    'A6b · com o TIPO de cada um — o diálogo do SystemUI é um BROADCAST, e é '
    + 'exatamente isso que a cadeia da v1.9.9 não sabia disparar',
    linhas[0] || '(sem linha)');
  checar(/não existe neste aparelho/.test(linhas[1] || ''),
    'A6c · e o que FALTA aparece dito: é o candidato ausente que explica por que o '
    + 'atalho caiu na tela errada, e sem ele a lista não responde nada que a linha '
    + 'de cima já não respondesse', linhas[1] || '(sem linha)');

  // ===== E A TERCEIRA PERGUNTA: O DIÁLOGO CHEGOU A SUBIR? (v1.9.11) =====
  //
  // Relato do operador sobre a v1.9.10: *"dessa vez ele não abriu nenhuma
  // janela"*, com o Registro mostrando o receptor do SystemUI PRESENTE. A lista
  // de candidatos responde *"quais existem"* e não *"ele abriu"* — `sendBroadcast`
  // não devolve desfecho nenhum, e quem recebe pode engolir em silêncio.
  //
  // A LINHA É RELIDA a cada montagem do Registro, e é isso que esta asserção
  // trava junto: o desfecho muda a CADA toque, e lê-lo só na carga faria o
  // Registro dizer "nunca" para sempre — o diagnóstico que envelhece calado, que
  // é o pior artefato que este projeto sabe produzir.
  const regDepois = await lerRegistro(pg);
  checar(/Saída de áudio, último toque: o diálogo foi ENGOLIDO/.test(regDepois),
    'A6d · o Registro diz se o diálogo do sistema SUBIU ou foi ENGOLIDO — e relê a '
    + 'cada montagem, senão ele responderia "nunca" para sempre',
    (regDepois.match(/Saída de áudio, último toque:.*/) || ['(a linha não saiu)'])[0]);

  // ===== O SEGUNDO TOQUE NÃO PAGA A ESPERA (v1.9.12) =====
  //
  // Pedido do operador, depois de o Registro dele PROVAR que o diálogo é engolido
  // naquele aparelho: tirar a espera. Os 800 ms são o que impede o tile de ficar
  // mudo, mas onde o desfecho já é conhecido eles são espera pura — e ele os paga
  // em todo toque, num culto.
  //
  // A ASSERÇÃO É SOBRE O ESTADO DITO, e não sobre o relógio: medir 800 ms aqui
  // seria medir o arnês (o shell de mentira não espera nada). O que se trava é que
  // o app SABE que está bloqueado e DIZ isso — sem a linha, "o app deixou de
  // tentar" é um estado invisível, e um estado invisível num diagnóstico lido a
  // distância é o que este Registro existe para não produzir.
  await pg.evaluate(() => { document.getElementById('saidaAudioTile').click(); });
  await esperar(pg, () => window.__saidaAberta === 2, null, 5000);
  const regBloq = await lerRegistro(pg);
  checar(/último toque: o diálogo está BLOQUEADO neste aparelho/.test(regBloq),
    'A6e · depois de medido, o Registro diz que o diálogo está BLOQUEADO e que o '
    + 'app abre a tela seguinte NO ATO',
    (regBloq.match(/Saída de áudio, último toque:.*/) || ['(a linha não saiu)'])[0]);
  const linhaBloq = regBloq.split('\n').filter((x) => /^\s+· /.test(x))[0] || '';
  checar(/BLOQUEADO — o app não tenta mais nesta versão/.test(linhaBloq),
    'A6f · e a linha DO CANDIDATO carrega a marca: o endereço EXISTE e o sistema '
    + 'recusa mostrar a janela, e as duas coisas juntas são o diagnóstico',
    linhaBloq || '(sem linha)');

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

  // A FILEIRA DO APARELHO, com a grade em OITO tiles (v1.11.7): preferências
  // (tema, tela, histórico, saída de áudio, dados móveis, verificar) e depois o
  // grupo do aparelho (compartilhar, transferir). A régua é o TOPO de cada caixa:
  // classe nenhuma descreve "estão na mesma fileira". Os tiles de dentro das
  // janelas (fit/wallpaper/fundo/giro, exportar/importar) NÃO estão na grade.
  const topos = () => pg.evaluate(() => {
    const t = (id) => Math.round(document.getElementById(id).getBoundingClientRect().top);
    const grade = document.querySelector('.qs-grade');
    const ids = [...grade.querySelectorAll('.qs-tile')]
      .filter((e) => !e.hidden && e.getBoundingClientRect().width > 0).map((e) => e.id);
    return {
      compartilhar: t('shareAppTile'), transferir: t('pacoteTile'),
      saida: t('saidaAudioTile'), dados: t('dadosMoveisTile'), verificar: t('testeTile'),
      ids,
    };
  });
  const fileira = await topos();
  checar(fileira.ids.length === 8,
    'A8a · a grade de Configurações tem os OITO tiles que o desenho pede (os '
    + 'quatro ajustes do telão e o exportar/importar moram nas janelas)', fileira.ids);
  checar(fileira.compartilhar === fileira.transferir,
    'A8 · os DOIS do aparelho (compartilhar e transferir) ficam na MESMA fileira '
    + '(*"compartilhar, exportar e importar devem ser os itens da base"*)', fileira);
  checar(fileira.saida < fileira.compartilhar && fileira.dados < fileira.compartilhar
    && fileira.verificar < fileira.compartilhar,
    'A9 · e as preferências ficam ACIMA deles — é a ordem por ASSUNTO que a posição '
    + 'diz sem gastar uma linha de texto', fileira);
  // A CÉLULA EM QUE A ARITMÉTICA FALHA: com seis preferências em três colunas os
  // dois do aparelho caem sozinhos na terceira fileira, e a regra de CSS não é
  // exercida. Uma preferência a menos (cinco) deixa um vão na segunda fileira, e
  // sem o `grid-column: 1` o `compartilhar` o ocuparia, ao lado de uma PREFERÊNCIA.
  await pg.evaluate(() => { document.getElementById('testeTile').hidden = true; });
  const cinco = await topos();
  checar(cinco.compartilhar === cinco.transferir && cinco.saida < cinco.compartilhar
    && cinco.dados < cinco.compartilhar,
    'A9b · e continuam começando fileira NOVA com uma preferência a menos: nenhuma '
    + 'fileira mistura preferência com ação do aparelho (a aritmética não é a regra)',
    cinco);
  await pg.evaluate(() => { document.getElementById('testeTile').hidden = false; });
  await ctxWeb.close();

  // =========================================================================
  // B · A SETA SEM DESTINO DE PROJEÇÃO: SEMPRE CLICÁVEL, E RECOLHE (v1.10.10)
  // =========================================================================
  // O AVANÇADO, porque a geometria só é MEDIDA onde a prévia tem caixa: no Modo
  // Fácil sem tela o app está bloqueado e a prévia mede 0 — `altura <= 80` seria
  // verdade por ausência, a tautologia que esta seção existe para não repetir.
  await pg.evaluate(() => { setAppMode('full'); });
  const caixa = await esperar(pg, () => document.getElementById('preview').getBoundingClientRect().height > 80, null, 5000);
  checar(caixa === true,
    'B0 · PREMISSA: no avançado, sem destino, a prévia tem caixa (altura natural) '
    + '— é nela que a geometria se mede', porque(caixa));
  const semDestino = await lerTudo(pg);
  checar(semDestino.setaApagada === false,
    'B1 · SEM TV e sem computador conectado a seta NÃO fica apagada — a opção '
    + 'é selecionável desde sempre, mesmo com o EFEITO sobre a decodificação '
    + 'ainda exclusivo de quando há para onde projetar', semDestino);
  checar(semDestino.setaAlternada === false && semDestino.setaExpandida === 'true'
    && semDestino.recolhida === false,
    'B2 · e ela nasce no estado EXPANDIDO — o desenho (`alternado`) e o '
    + '`aria-expanded` dizem a MARCAÇÃO, e a prévia está na altura natural',
    semDestino);
  checar(/só deixa de ser decodificada com TV ou computador/.test(semDestino.setaTitulo),
    'B3 · e o `title` diz a AÇÃO e explica que o efeito sobre a imagem é exclusivo '
    + 'de quando há destino — sem dizer que o controle está indisponível',
    semDestino.setaTitulo);

  // O TOQUE PASSA, GRAVA A PREFERÊNCIA E RECOLHE — mesmo sem destino: é a metade
  // do pedido que a v1.8.50 proibia (*"é uma opção selecionável desde sempre"*).
  await pg.evaluate(() => { document.getElementById('pvRecolherBtn').click(); });
  const tocouSemDestino = await esperar(pg, () => economiaPreview === true, null, 5000);
  checar(tocouSemDestino === true,
    'B4 · e o toque MARCA a escolha mesmo sem destino — ela fica pré-armada '
    + 'para quando uma TV ou computador entrar', porque(tocouSemDestino));
  const depoisDoToque = await lerTudo(pg);
  checar(depoisDoToque.vigor === false && depoisDoToque.classe === false,
    'B5 · mas o EFEITO sobre a decodificação continua exclusivo de quando há '
    + 'destino — sem TV e sem computador a prévia É a projeção, e ela não pode '
    + 'ficar suspensa', depoisDoToque);
  checar(depoisDoToque.recolhida === true && depoisDoToque.altura <= 80,
    'B5b · MAS A GEOMETRIA SEGUE A MARCAÇÃO: a prévia recolhe mesmo sem destino '
    + '(é o que faz a seta ter efeito à vista), e mede no máximo 80px — 38 sem '
    + 'selo/giro, 72 com', depoisDoToque);
  checar(depoisDoToque.setaApagada === false && depoisDoToque.setaAlternada === true
    && depoisDoToque.setaExpandida === 'false',
    'B6 · e a seta CONTINUA clicável depois do toque, com o desenho trocado — '
    + 'desmarcar não pode ficar mais difícil que marcar', depoisDoToque);
  const fabsB = await medirFabs(pg);
  checar(fabsB.n >= 1 && fabsB.fora.length === 0 && fabsB.sobrepostos.length === 0
    && fabsB.espremidos.length === 0 && fabsB.setaCoberta === false,
    'B6b · e, recolhida, todo botão da prévia fica DENTRO dela, sem sobrepor outro, '
    + 'sem ser espremido, e a seta recebe o toque no centro dela', fabsB);
  // Desfaz a marcação: os blocos seguintes partem do estado limpo de sempre.
  await pg.evaluate(() => { document.getElementById('pvRecolherBtn').click(); });
  await esperar(pg, () => economiaPreview === false, null, 5000);
  const expandiu = await lerTudo(pg);
  checar(expandiu.recolhida === false && expandiu.altura > 80 && expandiu.setaAlternada === false,
    'B7 · e o segundo toque EXPANDE de volta: a classe sai e a prévia recupera a '
    + 'altura natural', expandiu);

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
  checar(destravou.setaApagada === false && destravou.recolhida === false,
    'C2 · com a TV conectada a seta continua clicável — nunca esteve travada '
    + '(v1.10.10) — e a prévia segue expandida até o toque', destravou);

  await pg.evaluate(() => { document.getElementById('pvRecolherBtn').click(); });
  const ligou = await esperar(pg, () => economiaAtiva() === true, null, 5000);
  checar(ligou === true, 'C3 · e o toque liga a economia', porque(ligou));

  const comEconomia = await lerTudo(pg);
  checar(comEconomia.pausado === true,
    'C4 · O DECODIFICADOR PARA — é o recurso inteiro, e é a única metade que '
    + 'devolve processamento ao telão (os três WebViews dividem UM processo)',
    comEconomia);
  checar(comEconomia.invisivel === true,
    'C5 · e a imagem SAI DE VISTA: um vídeo pausado mostra o quadro congelado, e '
    + 'uma imagem à vista numa prévia recolhida se lê como prévia TRAVADA',
    comEconomia);
  checar(comEconomia.recolhida === true && comEconomia.classe === true
    && comEconomia.setaAlternada === true && comEconomia.setaExpandida === 'false',
    'C6 · a prévia RECOLHE (`pv-recolhida`) e a economia entra em vigor '
    + '(`pv-economia`), e a seta troca de DESENHO — estado é desenho, nunca luz',
    comEconomia);
  checar(comEconomia.altura <= 80,
    'C6a · e a altura RENDERIZADA cabe em 80px — a classe sozinha aprovaria uma '
    + 'regra de CSS apagada, que é o defeito que esta asserção existe para pegar',
    comEconomia.altura);
  const fabs = await medirFabs(pg);
  checar(fabs.n >= 3 && fabs.fora.length === 0,
    'C6b · todo botão da prévia fica DENTRO da caixa recolhida: `#preview` recorta, '
    + 'e um botão fora dela some sem erro nenhum', fabs);
  checar(fabs.sobrepostos.length === 0 && fabs.espremidos.length === 0,
    'C6c · nenhum botão cai SOBRE outro nem é ESPREMIDO abaixo de um alvo de toque: '
    + 'recolhida, as três colunas viram uma linha, e é ali que um deles se perderia',
    fabs);
  checar(fabs.setaCoberta === false,
    'C6d · e a seta recebe o toque no centro dela (nada a cobre) — sem isso o '
    + 'operador recolhe e não consegue expandir', fabs);
  checar(comEconomia.podeMexer === false,
    'C7 · e o realinhamento para de gastar trabalho sobre um `<video>` que não vai '
    + 'andar — a MESMA guarda da página oculta, e não uma segunda régua',
    comEconomia);

  // O MODO FÁCIL TAMBÉM RECOLHE, E A SETA FICA NO CANTO: a prévia é UM nó que
  // muda de casa (`hostPreview`), e a seta tem de continuar à vista e tocável lá,
  // sem trocar de lugar quando o toque muda o estado. Há TV, então o Modo Fácil
  // está destravado e a prévia tem caixa.
  await pg.evaluate(() => { setAppMode('simple'); });
  const facil = await esperar(pg, () => {
    const r = document.getElementById('preview').getBoundingClientRect();
    return r.height > 0 && r.height <= 80
      && document.getElementById('simpleStage').contains(document.getElementById('preview'));
  }, null, 5000);
  const fabsFacil = await medirFabs(pg);
  const posFacil = await pg.evaluate(() => {
    const p = document.getElementById('preview').getBoundingClientRect();
    const s = document.getElementById('pvRecolherBtn').getBoundingClientRect();
    return { esq: Math.round(s.left - p.left), centroDaPrevia: Math.round((p.width - s.width) / 2) };
  });
  checar(facil === true && fabsFacil.fora.length === 0 && fabsFacil.sobrepostos.length === 0
    && fabsFacil.espremidos.length === 0 && fabsFacil.setaCoberta === false
    && posFacil.esq < posFacil.centroDaPrevia,
    'C8 · no MODO FÁCIL a prévia recolhida também mede até 80px, a seta fica no '
    + 'CANTO (não no centro) e nenhum botão colide, sai ou é espremido',
    { facil: porque(facil) || facil, fabsFacil, posFacil });
  // A MESMA SETA, EXPANDIDA: ela não pode trocar de lugar quando o toque muda o
  // estado (quem toca duas vezes a procuraria). As duas regras de CSS que a põem
  // no canto são diferentes (a da prévia aberta e a da recolhida), e cada uma só
  // se prova no estado dela.
  await pg.evaluate(() => { setEconomiaPreview(false); });
  const abertaFacil = await esperar(pg, () => document.getElementById('preview').getBoundingClientRect().height > 80, null, 5000);
  const posAberta = await pg.evaluate(() => {
    const p = document.getElementById('preview').getBoundingClientRect();
    const s = document.getElementById('pvRecolherBtn').getBoundingClientRect();
    return { esq: Math.round(s.left - p.left), top: Math.round(s.top - p.top) };
  });
  checar(abertaFacil === true && posAberta.esq === posFacil.esq && posAberta.top <= 4,
    'C8b · e a seta do Modo Fácil EXPANDIDA fica no MESMO canto (esquerda e no '
    + 'topo) — não troca de lugar quando o toque muda o estado',
    { abertaFacil: porque(abertaFacil) || abertaFacil, posAberta, posFacil });
  await pg.evaluate(() => { setEconomiaPreview(true); });
  await esperar(pg, () => economiaAtiva() === true, null, 5000);
  await pg.evaluate(() => { setAppMode('full'); });
  await esperar(pg, () => document.getElementById('preview').getBoundingClientRect().height > 0
    && !document.getElementById('simpleStage').contains(document.getElementById('preview')), null, 5000);

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

  // A SUSPENSÃO SAIU DO `stage`: o inverso exato do D2. O `<video>` não volta a
  // andar sozinho (o realinhamento só age com um telão mandando status, e aqui
  // ele é de mentira), então a pergunta é se um `play` que CHEGA agora é
  // obedecido — com a suspensão ainda no `stage`, ele continuaria parado.
  await pg.evaluate(() => { cmd({ type: 'play' }); });
  const religou = await esperar(pg, () => !document.getElementById('pvVideo').paused, null, 5000);
  checar(religou === true,
    'E2a · e a decodificação RELIGA no ato: um `play` que chega depois é obedecido '
    + '(o inverso do D2) — sem TV a prévia é a fonte do que a congregação ouve, e '
    + 'a suspensão presa seria o culto calado', porque(religou));
  const semTvAgora = await lerTudo(pg);
  checar(semTvAgora.classe === false,
    'E2 · e a economia sai de vigor (`pv-economia` some)', semTvAgora);
  checar(semTvAgora.recolhida === true && semTvAgora.altura <= 80
    && semTvAgora.setaAlternada === true,
    'E2b · MAS A PRÉVIA CONTINUA RECOLHIDA: a geometria é escolha do operador e não '
    + 'responde ao destino — perder a TV religa a decodificação, nunca expande a '
    + 'prévia por conta própria', semTvAgora);
  checar(semTvAgora.marcacao === true,
    'E3 · e A MARCAÇÃO FICA: ela é a escolha do operador, e reconectar a TV tem '
    + 'de voltar a poupar sem ele tocar em nada', semTvAgora);
  checar(semTvAgora.setaApagada === false,
    'E4 · e a seta CONTINUA sem `disabled` sem TV — só o EFEITO (`economiaAtiva`) '
    + 'responde à pergunta do destino, nunca o `disabled` (v1.10.10)', semTvAgora);

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
  const depoisDaRecarga = await pg.evaluate(() => ({
    marcacao: !!economiaPreview,
    recolhida: document.getElementById('preview').classList.contains('pv-recolhida'),
    seta: document.getElementById('pvRecolherBtn').classList.contains('alternado'),
  }));
  checar(depoisDaRecarga.marcacao === true,
    'F1 · a marcação vem do BANCO e não da sessão: o celular fraco continua fraco '
    + 'na abertura seguinte, e remarcá-la em todo culto é o oposto do pedido',
    depoisDaRecarga);
  checar(depoisDaRecarga.recolhida === true && depoisDaRecarga.seta === true,
    'F2 · e a prévia NASCE recolhida e a seta com o desenho trocado: a geometria '
    + 'segue a marcação lida do banco, não só o clique da sessão', depoisDaRecarga);

  // =========================================================================
  // G · A TELA CHEIA SUSPENDE A ECONOMIA
  // =========================================================================
  await pg.evaluate(new Function('return (async () => { setAppMode("full"); await load(); })()'));
  await trocarTelas(pg, TV);
  await pg.evaluate(() => send('louvor-economia'));
  await esperar(pg, () => economiaAtiva() === true, null, 8000);
  // A PREMISSA DA CÉLULA: a prévia chega à tela cheia RECOLHIDA. Sem ela as
  // asserções de geometria abaixo medem uma prévia que nunca esteve recolhida e
  // passariam com ou sem a exclusão `:fullscreen` do CSS.
  const recolhidaAntes = await lerTudo(pg);
  checar(recolhidaAntes.recolhida === true && recolhidaAntes.altura <= 80,
    'G0 · PREMISSA: a prévia está RECOLHIDA (marcação lida do banco) antes de '
    + 'entrar em tela cheia', recolhidaAntes);

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
    // A TELA CHEIA NÃO É RECOLHIDA: sem TV ela É a projeção, e uma regra de CSS
    // sem a exclusão `:fullscreen` deixaria o telão em 38px, sem erro algum. A
    // classe (a marcação) FICA — é o CSS que a cala, sem o atraso de um quadro.
    const geomCheia = await pg.evaluate(() => {
      const r = document.getElementById('preview').getBoundingClientRect();
      const v = getComputedStyle(document.getElementById('pvVideo')).visibility;
      return { w: Math.round(r.width), h: Math.round(r.height), iw: innerWidth, ih: innerHeight, video: v,
        classe: document.getElementById('preview').classList.contains('pv-recolhida') };
    });
    checar(geomCheia.w >= geomCheia.iw - 1 && geomCheia.h >= geomCheia.ih - 1,
      'G2b · em tela cheia a prévia OCUPA a viewport inteira — o recolhido não vale '
      + 'ali', geomCheia);
    checar(geomCheia.video === 'visible' && geomCheia.classe === true,
      'G2c · e o `<video>` está VISÍVEL (as camadas não ficam `visibility: hidden`) '
      + 'com a marcação ainda ligada', geomCheia);
    // O REGISTRO TEM DE DIZER A RAZÃO CERTA, e são TRÊS estados. A primeira
    // escrita perguntava só "está em vigor?" e atribuía toda suspensão à falta de
    // destino — em tela cheia isso é uma linha FALSA num texto lido A DISTÂNCIA
    // por quem não tem o aparelho na mão, que é o pior artefato que este projeto
    // sabe produzir. Aqui HÁ destino, e a razão é a tela cheia.
    const regCheia = await lerRegistro(pg);
    const linhaCheia = (regCheia.match(/Prévia: RECOLHIDA.*/) || [''])[0];
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
    // E A GEOMETRIA VOLTA RECOLHIDA, SEM ALTERNAR A MARCAÇÃO: sair da tela cheia
    // não é um toque na seta, e a marcação que o operador escolheu atravessa.
    const voltouRecolhida = await esperar(pg, () => {
      const r = document.getElementById('preview').getBoundingClientRect();
      return r.height <= 80 && r.height > 0;
    }, null, 5000);
    const depoisDeSair = await lerTudo(pg);
    checar(voltouRecolhida === true && depoisDeSair.recolhida === true
      && depoisDeSair.marcacao === true && depoisDeSair.setaAlternada === true,
      'G5 · e sair da tela cheia volta RECOLHIDA, sem alternar a marcação',
      porque(voltouRecolhida) || depoisDeSair);
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
