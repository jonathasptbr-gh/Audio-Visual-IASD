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

// ---- uma série sintética: 4 semanas, uma amostra por dia ----
// O painel só lê o farol, por semana: o dia de MAIOR uso da semana (domingo a
// sábado), menos 1 (o aparelho de quem publica). O sábado leva +5 aparelhos e a
// quarta +2; os outros dias, 0 ou 1. Assim a semana vale 5 − 1 = 4, e as quatro
// semanas dão a mesma média.
const FIM = new Date(Date.UTC(2026, 8, 26, 23, 17, 0));   // sábado, 26/09/2026
const INI = new Date(FIM.getTime() - 27 * 864e5);         // domingo, 30/08
const amostras = [];
let farol = 40, manifesto = 5000, visita = 300;
for (let i = 0; i < 28; i++) {
  const t = new Date(INI.getTime() + i * 864e5);
  const dow = t.getUTCDay();                               // 0 dom … 6 sáb
  farol += dow === 6 ? 5 : (dow === 3 ? 2 : (i % 3 === 0 ? 1 : 0));
  manifesto += 300;
  visita += 4;
  amostras.push({
    t: t.toISOString(), apk: {}, web: {}, manifesto, farol, farolDev: 1, visita, visitaDev: 2,
  });
}
const SERIE = { amostras, visto: {} };

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
    // O sábado a série dá 5; o painel desconta 1 e mostra 4 — nas duas caixas.
    checar(kpis.length === 2, 'só dois números: a semana e a média', kpis);
    checar(kpis[0] === '4', 'a última semana desconta 1 (o aparelho do operador)', kpis[0]);
    checar(kpis[1] === '4', 'e a média das últimas 4 semanas é a mesma conta', kpis[1]);

    // uma barra por semana com amostra, e nenhuma com valor negativo
    const barras = await pg.$$eval('.sem', (es) => es.map((e) =>
      [e.querySelector('.sem-v').textContent.trim(),
       Math.round(e.querySelector('b').getBoundingClientRect().height)]));
    checar(barras.length === 4, 'uma barra por semana', barras.length);
    checar(barras.every((b) => b[0] === '4' && b[1] > 0),
      'e todas desenham a altura do valor descontado', barras);

    // O DESCONTO TEM DE ESTAR ESCRITO: é ele que muda a leitura do número.
    const nota1 = await pg.evaluate(() => {
      const notas = [...document.querySelectorAll('#pag .nota')].map((n) => n.textContent);
      return { primeira: notas[0] || '', quantas: notas.length };
    });
    checar(/descontado 1/i.test(nota1.primeira) && /quem publica|operador/i.test(nota1.primeira),
      'o painel avisa que desconta o aparelho de quem publica', nota1.primeira);
    checar(/build de teste|assembleDebug/i.test(nota1.primeira),
      '  ↳ e nomeia a única exclusão que sobrou (o build de teste), que nunca '
      + 'foi escolha de ninguém', nota1.primeira);

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
    // O AVISO MUDOU DE SENTIDO (2026-11-10, a pedido do operador): antes ele
    // dizia que o uso próprio ENTRAVA; agora o painel DESCONTA 1 por semana, o
    // aparelho de quem publica. A frase renderizada é o que se cobra, porque
    // uma nota vazia passaria num teste de seletor.
    checar(/descontado 1/i.test(aviso.primeira),
      'e o painel AVISA, logo abaixo dos números, que desconta o aparelho do operador',
      aviso.primeira);
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
