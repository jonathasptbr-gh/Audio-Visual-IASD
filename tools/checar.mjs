// A ASSERÇÃO, e SÓ ela — sem uma linha de `import`.
//
// ## Por que este arquivo é separado do `arnes.mjs`
//
// O `arnes.mjs` importa o Playwright, e no workflow os oráculos de NODE PURO
// rodam no passo "Sanidade da base web", que vem **antes** do `npm ci` do passo
// "Preparar o Chromium". Um deles importando o arnês não falharia aqui na
// máquina de quem escreve (onde `node_modules/` existe): falharia só no CI, no
// passo que não tem `continue-on-error`, e o sintoma seria o canal OTA parado
// por um `ERR_MODULE_NOT_FOUND` que nada no arquivo explica.
//
// Por isso `checar` mora num módulo SEM dependência: os 16 de Node puro podem
// usá-lo, e o `arnes.mjs` o reexporta para os de Chromium não precisarem de
// dois imports.
//
// ## O contrato do terceiro argumento
//
// Ele existia em SETE variantes copiadas, e uma delas (`registro.test.mjs`)
// declarava dois parâmetros recebendo três em três chamadas — o valor obtido
// era descartado em silêncio. Um oráculo deste projeto é lido A DISTÂNCIA, no
// log do CI, por quem não pode abrir o navegador: a reprovação que diz o que se
// esperava e cala o que aconteteu manda adivinhar. Aqui `obtido` é sempre
// impresso — objeto vira JSON, o resto vira texto.

/** As reprovações. Cada oráculo é um PROCESSO, então esta array de módulo é o
 *  mesmo que a `const falhas = []` que estava copiada em cada um — e a linha
 *  final deles (`falhas.length ? … : …`) continua lendo exatamente esta. */
export const falhas = [];

export function checar(cond, msg, obtido) {
  if (cond) { console.log('ok      ' + msg); return; }
  const extra = obtido === undefined ? ''
    : '\n        obtido: ' + (typeof obtido === 'string' ? obtido : JSON.stringify(obtido));
  console.log('FALHOU  ' + msg + extra);
  falhas.push(msg);
}
