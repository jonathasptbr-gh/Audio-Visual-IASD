// A REDE EXTERNA NÃO ENTRA NUM ORÁCULO.
//
// ## O defeito que este arquivo fecha
//
// Os oráculos em Chromium sobem a base web de verdade, e a base web fala com a
// LouvorJA na carga: `pt_hymnal`, `pt_hymnal_1996`, `pt_categories`,
// `pt_bible_version`, `pt_bible_book` e um `music_<id>` por faixa. **Nenhum
// oráculo interceptava isso** (só o `boot-nativo` cobria três URLs da Bíblia,
// e numa página só).
//
// Num ambiente de desenvolvimento sem saída para a internet as chamadas morrem
// e o oráculo é determinístico — POR ACIDENTE. No runner do GitHub Actions elas
// RESPONDEM, o hinário real (centenas de faixas) desaba sobre o acervo plantado
// pela fixture, e a asserção passa a medir o catálogo da LouvorJA. Foi assim
// que `smoke`, `boot-nativo` e `sorteio-tela` ficaram vermelhos no CI enquanto
// passavam na máquina de quem os escreveu: 12 de 15, com o passo em
// `continue-on-error`, ou seja, sem ninguém notar.
//
// E o modo de falhar é o pior possível: **a suíte fica vermelha por um motivo
// que não é do código**, e uma suíte que grita sem razão é uma suíte que se
// aprende a ignorar — que é como um defeito de verdade passa.
//
// ## Por que BLOQUEAR é seguro, e não um remendo
//
// Os quinze oráculos passam num sandbox onde TODA saída externa já falha. Isso
// é a prova: nenhum deles depende de uma resposta de terceiro. Bloquear não
// muda o que eles medem — torna igual, em toda máquina, o que hoje depende de
// haver ou não internet.
//
// Fixture de terceiro que um oráculo REALMENTE queira exercitar entra por um
// `route()` próprio dele, registrado DEPOIS deste (o Playwright resolve as
// rotas da mais recente para a mais antiga), com o corpo escrito à mão. É a
// mesma regra do servidor de mentira das telas da rede: o que o teste afirma
// tem de estar escrito no teste.
const LOCAL = /^(https?:\/\/(localhost|127\.0\.0\.1)(:|\/)|data:|blob:|about:)/;

/**
 * Corta a saída para a internet de um BrowserContext.
 *
 * Chamar LOGO DEPOIS do `newContext()` e ANTES do primeiro `goto` — uma rota
 * registrada depois da carga não desfaz o pedido que já partiu.
 *
 * @param {import('playwright').BrowserContext} ctx
 * @param {(url: string) => void} [aoBloquear] para um oráculo que queira
 *   AFIRMAR o que foi bloqueado (nenhum precisa hoje).
 */
export async function semRedeExterna(ctx, aoBloquear) {
  await ctx.route('**/*', (rota) => {
    const url = rota.request().url();
    if (LOCAL.test(url)) return rota.continue();
    if (aoBloquear) aoBloquear(url);
    // `abort` e não uma resposta vazia: um 200 sem corpo é uma resposta
    // BOA-mas-vazia, e o caminho de erro do app (que é o que existe hoje, e o
    // que o sandbox exercita) é outro. O que se quer é "não há rede".
    return rota.abort();
  });
}
