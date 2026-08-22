/**
 * ===== AS SEÇÕES TEMÁTICAS DO HINÁRIO ADVENTISTA 2022 (v1.1.9) =====
 *
 * Pedido do operador: *"o novo hinário tem agrupamentos internos como músicas
 * infantis, a criação, crescimento em Cristo… gostaria de fazer um pequeno
 * índice no início da lista do álbum do hinário e pequenos títulos no meio da
 * listagem dos hinos, para demarcar as divisões de temas"*.
 *
 * **O BANCO NÃO TEM ESSE CAMPO.** `pt_hymnal` traz `id_music`, `track`, `name`,
 * `duration` e `has_instrumental_music`, e mais nada; `pt_categories` é
 * coletânea→álbum, não seção de hinário. O que identifica a seção de um hino é
 * a POSIÇÃO dele — exatamente como já acontecia com a faixa infantil do
 * `sorteio.js`, e é por isso que este arquivo é uma TABELA DE FAIXAS e não uma
 * propriedade lida do registro.
 *
 * A tabela é a transcrição do índice publicado pela CPB
 * (`novohinario.cpb.com.br/doutrinas/`): 8 blocos, 35 seções, 600 hinos. As 28
 * seções doutrinárias são as 28 crenças fundamentais, na ordem do hinário.
 *
 * ===== PURO, E COM ORÁCULO =====
 *
 * Zero DOM, zero rede, zero `window` — ele recebe o global pelo `this` da
 * IIFE, como o
 * `serie.js` e o `sorteio.js`, e é isso que o deixa rodar num `new Function`
 * dentro do Node. O oráculo é `tools/hinario.test.mjs`, e ele
 * afirma a única coisa que não se vê olhando: **a cobertura é CONTÍGUA de 1 a
 * 600, sem lacuna e sem sobreposição**. Um erro de digitação num limite não
 * quebra nada — ele põe o cabeçalho errado sobre um hino, e isso não erra alto
 * em lugar nenhum: a lista continua completa, na ordem certa, com um título
 * mentindo no meio. O operador só descobre no sábado de manhã.
 *
 * ===== SÓ O HINÁRIO NOVO =====
 *
 * Estes números valem para o Hinário Adventista 2022 e SÓ para ele. O de 1996
 * tem 613 hinos e outra organização; aplicar esta tabela lá poria "Infantis"
 * sobre cinquenta hinos escolhidos ao acaso. Quem responde "é o hinário novo?"
 * é o `controle.js`, que conhece a identidade da coleção — este arquivo não
 * pergunta nada sobre coleção nenhuma, ele só sabe traduzir NÚMERO em SEÇÃO.
 */
(function (global) {
  'use strict';

  // A tabela, na ordem do hinário. `de`/`ate` são INCLUSIVOS nas duas pontas.
  //
  // O 587 aparece DUAS vezes no hinário impresso (587A e 587B, duas versões do
  // mesmo hino) e isso não muda nada aqui: as duas caem dentro de 578–587 e
  // pertencem à mesma seção. A tabela é por FAIXA justamente por isso — ela não
  // supõe que todo número exista uma vez só.
  const SECOES = [
    // ---- A Doutrina de Deus ----
    { bloco: "A Doutrina de Deus", nome: "A Trindade", de: 1, ate: 14 },
    { bloco: "A Doutrina de Deus", nome: "O Pai", de: 15, ate: 22 },
    { bloco: "A Doutrina de Deus", nome: "O Filho", de: 23, ate: 39 },
    { bloco: "A Doutrina de Deus", nome: "O Espírito Santo", de: 40, ate: 48 },
    { bloco: "A Doutrina de Deus", nome: "As Escrituras Sagradas", de: 49, ate: 58 },
    // ---- A Doutrina do Ser Humano ----
    { bloco: "A Doutrina do Ser Humano", nome: "A Criação", de: 59, ate: 63 },
    { bloco: "A Doutrina do Ser Humano", nome: "A Natureza da Humanidade", de: 64, ate: 69 },
    // ---- A Doutrina da Salvação ----
    { bloco: "A Doutrina da Salvação", nome: "O Grande Conflito", de: 70, ate: 78 },
    { bloco: "A Doutrina da Salvação", nome: "Vida, Morte e Ressurreição de Cristo", de: 79, ate: 114 },
    { bloco: "A Doutrina da Salvação", nome: "A Experiência da Salvação", de: 115, ate: 172 },
    { bloco: "A Doutrina da Salvação", nome: "Crescimento em Cristo", de: 173, ate: 216 },
    // ---- A Doutrina da Igreja ----
    { bloco: "A Doutrina da Igreja", nome: "A Igreja", de: 217, ate: 222 },
    { bloco: "A Doutrina da Igreja", nome: "O Remanescente e Sua Missão", de: 223, ate: 241 },
    { bloco: "A Doutrina da Igreja", nome: "Unidade no Corpo de Cristo", de: 242, ate: 248 },
    { bloco: "A Doutrina da Igreja", nome: "O Batismo", de: 249, ate: 255 },
    { bloco: "A Doutrina da Igreja", nome: "A Ceia do Senhor", de: 256, ate: 260 },
    { bloco: "A Doutrina da Igreja", nome: "Dons e Ministérios Espirituais", de: 261, ate: 276 },
    { bloco: "A Doutrina da Igreja", nome: "O Dom de Profecia", de: 277, ate: 281 },
    // ---- A Doutrina da Vida Cristã ----
    { bloco: "A Doutrina da Vida Cristã", nome: "A Lei de Deus", de: 282, ate: 289 },
    { bloco: "A Doutrina da Vida Cristã", nome: "O Sábado", de: 290, ate: 299 },
    { bloco: "A Doutrina da Vida Cristã", nome: "Mordomia Cristã", de: 300, ate: 314 },
    { bloco: "A Doutrina da Vida Cristã", nome: "Conduta Cristã", de: 315, ate: 407 },
    { bloco: "A Doutrina da Vida Cristã", nome: "O Casamento e a Família", de: 408, ate: 428 },
    // ---- A Doutrina dos Últimos Eventos ----
    { bloco: "A Doutrina dos Últimos Eventos", nome: "O Ministério de Cristo no Santuário Celestial", de: 429, ate: 439 },
    { bloco: "A Doutrina dos Últimos Eventos", nome: "A Segunda Vinda de Cristo", de: 440, ate: 469 },
    { bloco: "A Doutrina dos Últimos Eventos", nome: "Morte e Ressurreição", de: 470, ate: 476 },
    { bloco: "A Doutrina dos Últimos Eventos", nome: "O Milênio e o Fim do Pecado", de: 477, ate: 490 },
    { bloco: "A Doutrina dos Últimos Eventos", nome: "A Nova Terra", de: 491, ate: 507 },
    // ---- Hinos Infantis ----
    { bloco: "Hinos Infantis", nome: "Infantis", de: 508, ate: 557 },
    // ---- Hinos Litúrgicos ----
    { bloco: "Hinos Litúrgicos", nome: "Introito", de: 558, ate: 571 },
    { bloco: "Hinos Litúrgicos", nome: "Ofertório", de: 572, ate: 577 },
    { bloco: "Hinos Litúrgicos", nome: "Oração Pastoral", de: 578, ate: 587 },
    { bloco: "Hinos Litúrgicos", nome: "Adoração Infantil", de: 588, ate: 588 },
    { bloco: "Hinos Litúrgicos", nome: "Introdução ao Sermão", de: 589, ate: 591 },
    { bloco: "Hinos Litúrgicos", nome: "Despedida", de: 592, ate: 600 },
  ];

  // Os 8 blocos, na ordem em que aparecem — derivados da tabela, nunca uma
  // segunda lista: duas listas divergem no primeiro esquecimento.
  const BLOCOS = SECOES.reduce((acc, s) => {
    if (acc[acc.length - 1] !== s.bloco) acc.push(s.bloco);
    return acc;
  }, []);

  const PRIMEIRO = SECOES[0].de;
  const ULTIMO = SECOES[SECOES.length - 1].ate;

  // A SEÇÃO DE UM NÚMERO. Busca linear numa tabela de 35 — um índice por número
  // custaria 600 entradas e uma invalidação a mais para manter; a lista do álbum
  // chama isto uma vez por linha desenhada, e uma linha custa muito mais que
  // isto em DOM.
  //
  // Fora da faixa devolve `null`, e quem chama trata: um hinário que ganhe o
  // hino 601 aparece sem cabeçalho, o que é infinitamente melhor que herdar o
  // rótulo do vizinho.
  function secaoDe(numero) {
    const n = numero | 0;
    if (n < PRIMEIRO || n > ULTIMO) return null;
    for (const s of SECOES) if (n >= s.de && n <= s.ate) return s;
    return null;
  }

  // A seção que COMEÇA neste número — é ela que vira cabeçalho na listagem.
  // Perguntar "mudou de seção em relação à linha anterior?" daria o mesmo
  // resultado na lista inteira e o resultado ERRADO na primeira linha de uma
  // PÁGINA: a lista chega de 100 em 100 (`fillSongList`) e a linha anterior nem
  // sempre está no DOM.
  function comecaSecao(numero) {
    const n = numero | 0;
    for (const s of SECOES) if (s.de === n) return s;
    return null;
  }

  // A FAIXA INFANTIL, para quem só precisa dela.
  //
  // O `sorteio.js` tem os mesmos dois números escritos nele, e isso é
  // DELIBERADO: ele é puro e independente por contrato (capacidades injetadas,
  // oráculo próprio), e fazer um módulo puro importar outro para ler duas
  // constantes trocaria uma duplicação visível por um acoplamento invisível.
  // Quem impede a divergência é o oráculo — `hinario.test.mjs` compara os dois
  // arquivos e reprova se eles discordarem.
  function ehInfantil(numero) {
    const s = secaoDe(numero);
    return !!s && s.bloco === 'Hinos Infantis';
  }

  // O ÍNDICE, agrupado por bloco — a forma que a tela desenha. Devolve cópias
  // rasas: o consumidor não tem por que poder reescrever a tabela.
  function indice() {
    return BLOCOS.map((b) => ({
      bloco: b,
      secoes: SECOES.filter((s) => s.bloco === b)
        .map((s) => ({ nome: s.nome, de: s.de, ate: s.ate, bloco: s.bloco })),
    }));
  }

  global.AVHinario = { SECOES, BLOCOS, secaoDe, comecaSecao, ehInfantil, indice };
})(this);
