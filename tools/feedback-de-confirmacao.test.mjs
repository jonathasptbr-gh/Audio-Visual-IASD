// ============================================================================
// O FEEDBACK DE CONFIRMAÇÃO FALA UMA LÍNGUA SÓ (v1.8.55)
// ============================================================================
//
// Pedido do operador, verbatim: *"revise os elementos de feedback de confirmação
// que temos em diversos processos do app, como confirmar exclusão, confirmar
// salvar em cronograma e etc... hoje tem alguns com efeito verde, outros em
// cinza, outros em azul e etc... padronize todos com o efeito de fundo azul
// claro e icone em azul sólido, sem nada verde (esse é o tipo de feedback que
// temos por exemplo no botão de favoritar nos itens do cronograma)"*.
//
// **A DIVERGÊNCIA QUE ELE VIU NÃO ERA DECISÃO DE NINGUÉM — ERA ESPECIFICIDADE**,
// e é isso que este oráculo existe para travar. As três variantes do
// `.btn-pulso` eram `(0,1,0)` e perdiam para QUATRO seletores `(0,2,0)` que
// pousam nos MESMOS botões:
//
//   · `.fav-btn.on` .................. o botão que o pedido cita como referência
//   · `.row-playlist.on`/`.row-crono.on` ....... os alternadores da fileira
//   · `.qs-tile.qs-on` ....................... os tiles do painel rápido
//   · `.fav-acoes .row-btn` ....... a gaveta, em `--panel`: o CINZA da queixa
//
// O desfecho: **acrescentar a uma lista pulsava AZUL e retirar pulsava VERDE** —
// a mesma ação, duas cores, conforme a direção. Nos tiles do pacote, que ficam
// `qs-on` mesmo ociosos, sucesso E falha saíam azuis, com o glifo ✓/✕ como única
// diferença.
//
// POR ISSO A ASSERÇÃO CENTRAL NÃO É "o pulso é azul": é **"o pulso é o MESMO
// azul nos cinco contextos"**. Medir só um botão solto passaria com a cascata
// inteira de pé — foi assim que o defeito viveu tantas versões.
//
// E A DISTINÇÃO FICA. O âmbar ("já estava lá") e o vermelho (falha) continuam
// diferentes do concluído, e há asserção para isso: colapsar os três em azul
// apagaria o único sinal que separa "entrou agora" de "já estava", que é o que
// impede o toque repetido.

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { servirEstatico, abrirNavegador, esperarCortina, esperar, porque, checar, falhas } from './arnes.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..', 'app', 'src', 'main', 'assets', 'web');
const servidor = servirEstatico(RAIZ);
await new Promise((r) => servidor.listen(0, r));
const base = 'http://localhost:' + servidor.address().port + '/controle/index.html';
const navegador = await abrirNavegador();

try {
  for (const tema of ['dark', 'light']) {
    const ctx = await navegador.newContext({
      viewport: { width: 390, height: 900 }, hasTouch: true, colorScheme: tema,
    });
    await semRedeExterna(ctx);
    const pg = await ctx.newPage();
    await pg.goto(base, { waitUntil: 'load' });
    await esperarCortina(pg);

    // ── A. O MESMO AZUL NOS CINCO CONTEXTOS ─────────────────────────────
    const cores = await pg.evaluate(() => {
      setAppMode('full');
      const raiz = getComputedStyle(document.documentElement);
      const tok = (n) => raiz.getPropertyValue(n).trim();
      // Um hospedeiro por contexto. `.fav-acoes` é a GAVETA, e é o único que
      // pinta pelo ANCESTRAL — os outros três pintam pela própria classe.
      const gaveta = document.createElement('div');
      gaveta.className = 'fav-acoes';
      const solto = document.createElement('div');
      document.body.append(gaveta, solto);
      const medir = (classe, pai) => {
        const b = document.createElement('button');
        b.className = classe;
        b.innerHTML = '<span>x</span>';
        pai.appendChild(b);
        const c = getComputedStyle(b);
        const r = { bg: c.backgroundColor, cor: c.color };
        b.remove();
        return r;
      };
      const ok = 'btn-pulso btn-pulso--ok';
      return {
        contextos: {
          solto: medir('row-btn ' + ok, solto),
          estrelaAcesa: medir('row-btn fav-btn on ' + ok, solto),
          filaAcesa: medir('row-btn row-playlist on ' + ok, solto),
          tileAceso: medir('qs-tile qs-on ' + ok, solto),
          naGaveta: medir('row-btn ' + ok, gaveta),
        },
        dup: medir('row-btn btn-pulso btn-pulso--dup', solto),
        erro: medir('row-btn btn-pulso btn-pulso--erro', solto),
        // A REFERÊNCIA QUE O PEDIDO NOMEIA, lida do próprio app.
        referencia: medir('row-btn fav-btn on', solto),
        tokens: { btnAccent: tok('--btn-accent'), accent: tok('--accent'),
          btnOk: tok('--btn-ok'), ok: tok('--ok') },
      };
    });

    const vistos = Object.values(cores.contextos);
    const iguais = new Set(vistos.map((v) => v.bg + '|' + v.cor));
    checar(iguais.size === 1,
      'A · ' + tema + ': o pulso de confirmação é o MESMO em TODOS os cinco '
      + 'contextos — solto, sobre a estrela acesa, sobre a fila acesa, sobre um '
      + 'tile aceso e dentro da gaveta. Medir só um botão solto passaria com a '
      + 'cascata inteira de pé, que é como o defeito viveu tantas versões',
      JSON.stringify(cores.contextos));

    // E ele é o par que o pedido nomeia, lido do PRÓPRIO botão de referência —
    // não de um literal escrito aqui, que envelheceria à parte da paleta.
    checar(vistos[0].bg === cores.referencia.bg && vistos[0].cor === cores.referencia.cor,
      'A · ' + tema + ': e é o MESMO par do botão de favoritar, que é a '
      + 'referência que o operador citou — lido do botão, não de um literal',
      JSON.stringify({ pulso: vistos[0], referencia: cores.referencia }));

    // ── B. NADA DE VERDE ────────────────────────────────────────────────
    const verde = await pg.evaluate((c) => {
      const raiz = getComputedStyle(document.documentElement);
      const hex = (n) => raiz.getPropertyValue(n).trim();
      // O token vira rgb() pelo próprio navegador, para comparar com o computado.
      const d = document.createElement('div');
      document.body.appendChild(d);
      const rgbDe = (v) => { d.style.color = v; const r = getComputedStyle(d).color; return r; };
      const r = { ok: rgbDe(hex('--ok')), btnOk: rgbDe(hex('--btn-ok')) };
      d.remove();
      return r;
    }, cores);
    checar(vistos[0].cor !== verde.ok && vistos[0].bg !== verde.btnOk,
      'B · ' + tema + ': e ele não é mais o VERDE — nem no traço nem no fundo. '
      + 'É a metade literal do pedido ("sem nada verde")',
      JSON.stringify({ pulso: vistos[0], verde }));

    // ── C. AS OUTRAS DUAS LEITURAS CONTINUAM DISTINTAS ──────────────────
    checar(cores.dup.bg !== vistos[0].bg && cores.erro.bg !== vistos[0].bg
        && cores.dup.bg !== cores.erro.bg,
      'C · ' + tema + ': o "já estava lá" e a FALHA continuam distintos do '
      + 'concluído — colapsar os três em azul apagaria o único sinal que separa '
      + '"entrou agora" de "já estava", que é o que impede o toque repetido',
      JSON.stringify({ ok: vistos[0], dup: cores.dup, erro: cores.erro }));

    // ── D. NO CAMINHO REAL, e não só em classes sintéticas ──────────────
    //
    // As asserções acima montam os botões à mão: elas provam a CASCATA, que é o
    // defeito. Esta prova que o caminho de verdade chega lá — o operador toca a
    // estrela de um item e o que ele vê durante o pulso é o azul.
    const real = await pg.evaluate(async () => {
      const m = await AVDB.addMedia(new Blob(['x'], { type: 'audio/mpeg' }),
        { name: 'Faixa da estrela', type: 'audio/mpeg', kind: 'audio', list: 'imports' });
      await load();
      await renderLibrary();
      await new Promise((f) => setTimeout(f, 300));
      const li = [...document.querySelectorAll('#library li')]
        .find((e) => (e.textContent || '').includes('Faixa da estrela'));
      if (!li) return { erro: 'a linha não foi desenhada' };
      const fav = li.querySelector('.fav-btn');
      if (!fav) return { erro: 'a linha não tem estrela' };
      fav.click();
      // O PULSO NÃO CHEGA NO INSTANTE DO CLIQUE: `toggleFav` grava no banco antes
      // de chamar o `responder`, e o botão só ganha a classe depois. Espera-se
      // por ELA, e não por um prazo — sem isso a primeira leitura sai vazia e o
      // oráculo reprova o app por um `await` que ele tem de ter.
      for (let i = 0; i < 100 && !fav.classList.contains('btn-pulso'); i++) {
        await new Promise((f) => setTimeout(f, 20));
      }
      // AMOSTRA ENQUANTO O PULSO ESTÁ ACESO, e guarda a ÚLTIMA leitura com a
      // classe ainda no botão. São duas armadilhas de arnês, as duas medidas
      // aqui: o `.btn-pulso` declara `transition` de fundo e de cor, então uma
      // leitura aos 120 ms pega o MEIO da interpolação (um rgba com alfa, vindo
      // do fundo anterior); e o pulso dura 1100 ms, então um laço que espere a
      // cor "parar de mudar" atravessa a janela e lê o botão JÁ DE VOLTA ao
      // normal — que foi exatamente o que aconteceu na escrita, nas duas vezes.
      const amostras = [];
      for (let i = 0; i < 80; i++) {
        if (!fav.classList.contains('btn-pulso')) break;
        const c = getComputedStyle(fav);
        amostras.push({ bg: c.backgroundColor, cor: c.color });
        await new Promise((f) => setTimeout(f, 20));
      }
      const ultima = amostras[amostras.length - 1] || {};
      return { pulsou: amostras.length > 0, amostras: amostras.length,
        bg: ultima.bg, cor: ultima.cor, id: m.id };
    });
    checar(!real.erro && real.pulsou === true
        && real.bg === vistos[0].bg && real.cor === vistos[0].cor,
      'D · ' + tema + ': e no CAMINHO REAL — a estrela de um item da Biblioteca, '
      + 'tocada — o pulso sai na mesma cor. É o caso em que a cascata mordia: '
      + 'favoritar pintava azul e DESfavoritar pintava verde',
      JSON.stringify({ real, esperado: vistos[0] }));

    await ctx.close();
  }

  // ── E. O QUE SOBRA VERDE É ESTADO, E A LISTA É NOMEADA ────────────────
  //
  // Asserção de FONTE, e ela é a que impede o verde de voltar pela porta dos
  // fundos: um seletor novo consumindo `--ok` reprova aqui até que alguém o
  // nomeie — e nomeá-lo obriga a responder se aquilo é ESTADO ou DESFECHO.
  // É a mesma mecânica das quatro exceções de contorno do `tokens.test.mjs`:
  // é o NOME que segura a lista, não uma regra que o próximo possa alegar
  // cumprir.
  const css = fs.readFileSync(path.join(RAIZ, 'controle', 'controle.css'), 'utf8');
  const linhas = css.split('\n');
  const consumidores = [];
  for (let i = 0; i < linhas.length; i++) {
    if (!/var\(--(ok|btn-ok|ok-fill)\)/.test(linhas[i])) continue;
    // o seletor é a última linha anterior (ou a própria) que abre um bloco
    let j = i;
    while (j >= 0 && !/[.#:a-z\]][^;]*\{/.test(linhas[j])) j--;
    const sel = (linhas[j] || '').split('{')[0].trim();
    if (!consumidores.includes(sel)) consumidores.push(sel);
  }
  const ESPERADOS = [
    '.lv-badge',                       // "há letra ou texto para ler" — disponibilidade
    '.display-status.connected',       // (regra morta: o elemento só existe no ramo do navegador)
    '.cast-acao.connected',            // "há TV no ar" — dura o culto, não 1,1 s
    '.cast-acao.connected .cast-acao-ico',  // o ícone do mesmo botão, mesmo estado
  ];
  const sobrando = consumidores.filter((c) => !ESPERADOS.includes(c));
  checar(sobrando.length === 0,
    'E · o verde que SOBRA é ATIVIDADE, nunca desfecho de toque, e a lista é '
    + 'NOMEADA: um seletor novo consumindo `--ok` reprova aqui até alguém dizer '
    + 'se aquilo é ESTADO ou CONFIRMAÇÃO', JSON.stringify({ sobrando, consumidores }));
  // E A LISTA VALE NOS DOIS SENTIDOS (v1.8.56). Só a direção acima é
  // TAUTOLOGIA para a metade que interessa aqui: apagar um seletor do CSS e
  // esquecê-lo na lista deixa o oráculo verde, e a lista passa a NOMEAR o que
  // não existe — que é o mesmo defeito do comentário que sobrevive ao código.
  // É a varredura `comm -3` que este repositório já exige para o workflow,
  // aplicada a uma lista de dentro de um arquivo.
  const faltando = ESPERADOS.filter((e) => !consumidores.includes(e));
  checar(faltando.length === 0,
    'E · e nenhum NOME da lista descreve um seletor que já saiu do CSS — uma '
    + 'lista de permissão que envelhece deixa de dizer o que está permitido',
    JSON.stringify({ faltando, consumidores }));
  checar(!consumidores.includes('.btn-pulso--ok') && !consumidores.includes('.row-nota--ok'),
    'E · e os DOIS canais de confirmação saíram do verde — o pulso do botão e a '
    + 'nota na linha, que é o irmão dele para quando o botão já saiu de cena',
    JSON.stringify(consumidores));
  // OS DOIS QUE SAÍRAM NA v1.8.56, nomeados um a um pela mesma razão: eles
  // pareciam estado e eram CONCLUSÃO. *"verde é para sinal de 'ligado', nesses
  // casos são mensagem de conclusão, não de atividade"* — o operador, verbatim.
  checar(!consumidores.includes('.yt-result .yt-ok') && !consumidores.includes('.bible-ver-status.done'),
    'E · e os DOIS indicadores de conclusão também: o ✓ do download do YouTube '
    + 'e o "Completa offline" da Bíblia — os dois anunciam algo que ACABOU, não '
    + 'algo que está no ar', JSON.stringify(consumidores));

} finally {
  await navegador.close();
  servidor.close();
}

if (falhas.length) {
  console.log('\n' + falhas.length + ' falha(s).');
  process.exit(1);
}
console.log('\nTodos passaram.');
