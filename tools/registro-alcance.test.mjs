// A MEDIÇÃO DE ALCANCE — a tranca, a aritmética e o ROTEAMENTO do farol.
//
// Este oráculo existe por duas razões, e a segunda é a que paga o arquivo.
//
// ## 1. A página desenha errado sem errar
//
// `node --check` aprova um gráfico que mente. MEDIDO neste lote: `.barra-c` e
// `.barra-f` eram `<span>`, que é INLINE — e em elemento inline `width` e
// `height` não fazem nada. As quatro barras saíam do mesmo tamanho, com o
// trilho à vista e o preenchimento invisível: 12, 5, 3 e 1 desenhados
// idênticos. Nada falhou, nada foi ao console, e o defeito só apareceu
// olhando a imagem. Daí a asserção ser sobre a GEOMETRIA renderizada, e não
// sobre o HTML gerado.
//
// ## 2. O ROTEAMENTO do farol falha calado, e é o requisito inteiro
//
// A promessa é "o uso próprio não masca os dados", e ela é cumprida por
// CONSTRUÇÃO: quem audita conta noutro contador. Se o roteamento parar de
// funcionar, nada quebra — a página abre, o gráfico desenha, os números sobem.
// Só que passam a incluir quem mede. Não há sintoma, e o dado fica errado para
// sempre, porque um contador não se corrige depois.
//
// Por isso o teste é sobre a URL que SAI: `v.txt` para um visitante,
// `v-dev.txt` depois de a página do Registro ter sido aberta, e NENHUMA na
// segunda visita do mesmo dia.
//
//   node tools/registro-alcance.test.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semRedeExterna } from './sem-rede.mjs';
import { abrirNavegador, checar, falhas } from './arnes.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'site');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml' };

const servidor = http.createServer((rq, rs) => {
  let f = decodeURIComponent(rq.url.split('?')[0]);
  if (f.endsWith('/')) f += 'index.html';
  try {
    const b = fs.readFileSync(path.join(RAIZ, f));
    rs.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
    rs.end(b);
  } catch { rs.writeHead(404); rs.end('nao'); }
});
await new Promise((r) => servidor.listen(0, r));
const BASE = 'http://127.0.0.1:' + servidor.address().port;

// ---- uma série sintética: 3 dias, com o funil visitas > aparelhos ----
// Os valores são escolhidos para a DIFERENÇA ser conferível à mão:
// farol 10 → 13 → 18  dá  3 e 5 aparelhos.
const dia = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const SERIE = {
  amostras: [
    { t: dia(2) + 'T23:17:00Z', apk: {}, web: { '1.4': 2 }, manifesto: 1000, farol: 10, farolDev: 1, visita: 40, visitaDev: 2 },
    { t: dia(1) + 'T23:17:00Z', apk: {}, web: { '1.4': 5 }, manifesto: 1240, farol: 13, farolDev: 1, visita: 47, visitaDev: 2 },
    // `v1.5` está na AMOSTRA com zero downloads e NÃO na marca d'água — é a
    // versão recém-publicada, e a marca d'água só guarda contagem maior que
    // zero. Sem a união das duas fontes ela some do quadro, e o operador
    // publica sem ver a própria versão.
    { t: dia(0) + 'T23:17:00Z', apk: { 'audio-visual-iasd-v1.5.apk': 0 }, web: { '1.4': 9 }, manifesto: 1480, farol: 18, farolDev: 1, visita: 55, visitaDev: 2 },
  ],
  // NOVE APKs — acima do corte de seis, para o rolo-up do passado disparar.
  // As contagens são escolhidas para a soma do passado (3+4+5 = 12) EMPATAR
  // com a maior barra individual: é o caso em que uma régua mal escolhida
  // estoura a caixa.
  visto: {
    'audio-visual-iasd-v1.4.2.apk': 12,
    'audio-visual-iasd-v1.4.1.apk': 2,
    'audio-visual-iasd-v1.4.apk': 1,
    'audio-visual-iasd-v1.3.12.apk': 1,
    'audio-visual-iasd-v1.3.0.apk': 3,
    'audio-visual-iasd-v1.2.17.apk': 2,
    'audio-visual-iasd-v1.2.4.apk': 3,
    'audio-visual-iasd-v1.1.apk': 4,
    'audio-visual-iasd.apk': 5,
    'web-1.4': 9,
  },
};
const navegador = await abrirNavegador();
try {
  // =================================================================
  // A TRANCA
  // =================================================================
  {
    const ctx = await navegador.newContext();
    await semRedeExterna(ctx);
    const pg = await ctx.newPage();
    await pg.goto(BASE + '/registro/', { waitUntil: 'domcontentloaded' });
    const txt = (await pg.locator('body').innerText()).trim();
    checar(txt === 'Não encontrado.', 'sem a chave a página não mostra NADA — nem os rótulos', txt);
    // (A asserção "e não marca o navegador como o do operador" saiu na v1.4.42:
    //  com o sistema de exclusão fora, NADA marca o navegador em lugar nenhum,
    //  e ela virou uma tautologia — passaria com a página vazia. O que ela
    //  defendia continua medido, e agora onde importa: a asserção da seção
    //  seguinte pergunta a mesma coisa com a página ABERTA, que é o único
    //  instante em que a marca chegou a ser escrita.)
    await ctx.close();
  }

  // =================================================================
  // A ARITMÉTICA E O DESENHO
  // =================================================================
  {
    const ctx = await navegador.newContext({ viewport: { width: 900, height: 900 } });
    await semRedeExterna(ctx);
    const pg = await ctx.newPage();
    const erros = [];
    pg.on('pageerror', (e) => erros.push(String(e.message)));
    await pg.route('**raw.githubusercontent.com/**', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SERIE) }));
    await pg.goto(BASE + '/registro/#alcance', { waitUntil: 'domcontentloaded' });
    await pg.waitForSelector('.kpi');

    const kpis = await pg.locator('.kpi-n').allInnerTexts();
    // 18 − 13 = 5 aparelhos no último dia.
    checar(kpis[0] === '5', 'aparelhos no dia = a DIFERENÇA do contador entre dois dias', kpis[0]);
    // (3 + 5) / 2 = 4 — a média ignora o dia sem amostra em vez de contá-lo zero.
    checar(kpis[1] === '4', 'a média por dia é a dos dias COM dado', kpis[1]);
    // A base atual: a contagem da última amostra.
    checar(kpis[2] === '9', 'a base atual vem da última amostra', kpis[2]);

    // ---- a tabela da base: versão, contagem e tempo até a metade ----
    // `v1.4` aparece com 2 no primeiro dia, 5 no segundo (>= metade de 9) e 9
    // no terceiro: a metade é alcançada um dia depois da primeira amostra.
    const bases = await pg.$$eval('table.bases tbody tr', (trs) =>
      trs.map((tr) => [].map.call(tr.children, (td) => td.textContent.trim())));
    checar(bases.length === 1 && bases[0][0] === 'v1.4' && bases[0][1] === '9',
      'a tabela da base mostra a versão e a contagem da última amostra', bases);
    checar(/1 dia/.test(bases[0].join(' ')),
      'e o tempo até a metade é medido entre a primeira amostra e a metade', bases[0]);

    // ---- o "quando": a série de 24 h não tem amostra horária, e o painel diz ----
    const quando = await pg.locator('.q').count();
    checar(quando === 2, 'o "quando" tem as duas leituras: dia da semana e hora', quando);
    const vazioHora = await pg.locator('.q').nth(1).innerText();
    checar(/Sem amostras horárias/.test(vazioHora),
      'e diz que a hora não existe quando a série é diária', vazioHora);

    // ---- o funil: visitas e downloads da janela ----
    // 40 → 47 → 55 de visitas: a janela começa no primeiro dia com aparelho
    // (dia 2), então soma (47−40) + (55−47) = 15. E os dias-aparelho são 3+5=8.
    const funil = await pg.$$eval('.funil .f b', (es) => es.map((e) => e.textContent.trim()));
    checar(funil.length === 3, 'o funil tem os três números', funil);
    checar(funil[0] === '15', 'visitas da janela = SOMA das diferenças dos dias', funil[0]);
    checar(funil[2] === '8', 'e os dias-aparelho somam a coluna de aparelhos', funil[2]);

    // ======================================================================
    // NÃO HÁ MAIS EXCLUSÃO — E O PAINEL DIZ ISSO (v1.4.42)
    //
    // Da v1.4.1 até a v1.4.41 abrir esta página com a chave marcava o navegador
    // (`avRegistroOperador`) e as visitas dele passavam a acender um contador de
    // teste. O operador descartou o mecanismo inteiro: *"descarte a opção de
    // contagem de uso como opcional, deixe sempre ativo, não preciso do sistema
    // de exclusividade"*.
    //
    // DUAS METADES, e a segunda é a que carrega o lote:
    //
    //  1. **a marca não é mais escrita.** Ela falha CALADA nos dois sentidos: um
    //     resto do mecanismo deixaria este navegador fora do número público
    //     para sempre, e nada na tela diria por quê;
    //  2. **o painel AVISA que os números incluem o uso próprio.** Sem exclusão
    //     e sem aviso, "aparelhos por dia" passa a contar o aparelho de quem
    //     publica sem que a leitura mude — é o "confiável e falso" que
    //     `docs/MEDICAO-DE-ALCANCE.md` nomeia, pelo outro lado. Com uma frota
    //     pequena, um aparelho a mais por dia é uma fração que muda a conclusão.
    //
    // A asserção da segunda é sobre o TEXTO RENDERIZADO e não sobre a presença
    // de um nó: uma nota que existisse vazia passaria num teste de seletor.
    // ======================================================================
    const semMarca = await pg.evaluate(() => ({
      marca: localStorage.getItem('avRegistroOperador'),
      interruptor: !!document.getElementById('opContar'),
    }));
    checar(semMarca.marca === null && !semMarca.interruptor,
      'abrir o Registro NÃO marca mais este navegador, e não há interruptor: o '
      + 'sistema de exclusão saiu inteiro', semMarca);

    const aviso = await pg.evaluate(() => {
      const notas = [...document.querySelectorAll('#pag .nota')].map((n) => n.textContent);
      return {
        // A ORDEM importa: a ressalva tem de vir antes dos gráficos, senão ela
        // chega tarde para a leitura que existe para corrigir.
        primeira: notas[0] || '',
        quantas: notas.length,
      };
    });
    checar(/inclu(em|i) o uso pr[óo]prio/i.test(aviso.primeira),
      'e o painel AVISA, logo abaixo dos números, que eles incluem o uso próprio',
      aviso);
    checar(/build de teste|assembleDebug/i.test(aviso.primeira),
      '  ↳ e nomeia a única exclusão que sobrou (o build debuggável), que nunca '
      + 'foi opção de ninguém', aviso.primeira);

    // ---- o medidor de horas fica FORA quando as amostras são diárias ----
    // Intervalos maiores que 3 h são descartados: entre duas amostras de 24 h
    // não há como saber quanto do contador veio de qual hora, e uma média
    // sobre o dia inteiro seria um número preciso e falso.
    const secs = await pg.locator('h2').allInnerTexts();
    checar(!secs.some((s) => s.includes('Horas de uso')),
      'com amostras de 24 h o medidor de horas NÃO é desenhado', secs);

    checar(erros.length === 0, 'nenhum erro de página', erros);
    await ctx.close();
  }

  // =================================================================
  // O ROTEAMENTO DO FAROL DE VISITA — o requisito que falha calado
  // =================================================================
  {
    const ctx = await navegador.newContext();
    await semRedeExterna(ctx);
    const pedidos = [];
    // DEPOIS do `semRedeExterna`: o Playwright resolve as rotas da mais
    // recente para a mais antiga, então esta vence o corte de rede.
    await ctx.route('**github.com/**/dados-latest/**', (r) => {
      pedidos.push(new URL(r.request().url()).pathname.split('/').pop().split('?')[0]);
      return r.fulfill({ status: 200, body: 'x' });
    });
    const pg = await ctx.newPage();

    await pg.goto(BASE + '/', { waitUntil: 'networkidle' });
    checar(pedidos.join() === 'v.txt', 'um visitante acende o contador PÚBLICO', pedidos.slice());

    // ---- a segunda visita do MESMO dia não conta ----
    // É isso que torna "visitas" a mesma unidade que "aparelhos por dia" e
    // permite as duas dividirem um eixo no gráfico.
    await pg.goto(BASE + '/?de-novo', { waitUntil: 'networkidle' });
    checar(pedidos.length === 1, 'e a segunda visita do mesmo dia NÃO acende de novo', pedidos.slice());

    // ---- E DEPOIS DE ABRIR O REGISTRO ELE CONTA NO MESMO LUGAR (v1.4.42) ----
    // Este caso INVERTEU. Até a v1.4.41 ele provava a exclusão de quem audita a
    // própria página (`v-dev.txt`); hoje prova que ela SAIU — e a asserção tem
    // de continuar existindo justamente por isso: um resto do mecanismo (um
    // `localStorage` esquecido, um ramo que ninguém apagou) deixaria o
    // navegador do operador fora do número público **para sempre e em
    // silêncio**, que é o desfecho que este arquivo nasceu para não ter.
    //
    // O percurso é o mesmo de antes de propósito: abrir o Registro, apagar o
    // dia, revisitar. Um teste que só olhasse a home não passaria pelo ponto em
    // que a marca era escrita.
    await pg.route('**raw.githubusercontent.com/**', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SERIE) }));
    await pg.goto(BASE + '/registro/#alcance', { waitUntil: 'domcontentloaded' });
    await pg.waitForSelector('.kpi');
    // o dia é apagado para forçar um novo acendimento, que é o que se quer medir
    await pg.evaluate(() => localStorage.removeItem('avVisitaDia'));
    await pg.goto(BASE + '/', { waitUntil: 'networkidle' });
    checar(pedidos.join() === 'v.txt,v.txt',
      'e quem AUDITOU a página continua contando no mesmo contador: a exclusão '
      + 'saiu, e nenhum resto dela roteia este navegador para outro lugar',
      pedidos.slice());
    await ctx.close();
  }
} finally {
  await navegador.close();
  servidor.close();
}

console.log('');
if (falhas.length) {
  console.log('REPROVOU: ' + falhas.length + ' assercao(oes).');
  process.exit(1);
}
console.log('Todos passaram.');
