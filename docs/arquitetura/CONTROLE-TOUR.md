# O tour guiado (v1.14.0)

**O que é.** Um véu escurecido com um RECORTE na peça explicada e um balão curto
(título, uma ou duas frases, "N de M", Voltar · Próximo/Concluir · Pular). Mora em
`controle/tour.js` (`window.AVTour`); os ganchos ficam no `controle.js`, logo
depois do `__avBack`. Oráculo: `tools/tour.test.mjs`.

## Um tour por ESTADO da tela

| tour | quando vale (`qualTour()`) | o que mostra |
|---|---|---|
| `conexao` | Modo Fácil com a cortina "sem tela" (`#simpleMode.sem-tela`) | só a cortina: `#simpleConn`, `#castMirrorBtn`, `#castNetBtn`, `#castLocalBtn` |
| `simples` | Modo Fácil destravado | `#simpleBarra`/`#libBar`, `#sorteioSimplesBtn`, `.simple-song`, `.simple-keys`, `#volPill`, `#simpleSettingsBtn`, `#simpleCastBtn` |
| `avancado` | Modo Avançado | `#library`, `#cronoTitulo`, `#cronoImportar`, `#bibleBtn`, `#toolsBtn`, `#libBar`, `#preview`, `#seek`+`.transport`, `#pvCastBtn`, `#settingsBtn` |

Os passos e os textos são a tabela `TOURS` do `tour.js`. Um passo `opcional` sem
a peça sai da conta; um passo com `semAlvo` e sem a peça à vista vira BALÃO
CENTRAL com o texto que explica (a letra e as teclas do Fácil sem mídia no ar, o
`#pvCastBtn` com tela conectada). O tour vigia o estado: se ele muda no meio (a TV
conectou sozinha), o tour fecha e o do estado novo entra na fila.

## Automático uma vez, e nunca por cima de nada

- **A marca é `localStorage['av.tour']`** (`{"conexao":1,…}`), como a
  `av.dicaNaoPerturbe`: é do aparelho, lida em síncrono e não viaja no pacote de
  transferência. Ela é gravada quando o tour ABRE.
- **Só dispara com a tela LIVRE por 1,2 s seguidos** — `telaOcupadaParaTour()`:
  a cortina de abertura (`#splash`), o `#appDialog` (atualização, "O que mudou",
  consentimentos), qualquer folha de `POPUPS` (a Biblioteca ENCAIXADA do Fácil não
  conta), gavetas, Ferramentas, Bíblia, a prévia inteira ou em tela cheia e um
  campo de texto com foco.
- **Colisão:** se algo abre no meio do tour automático, ele fecha e a marca é
  DESFEITA — volta quando a tela ficar livre. O refeito à mão não desmarca.
- **A camada é 600**: acima dos diálogos (500), abaixo da prévia inteira
  (`2147483000`, e ela é popover no top layer) e da cortina — os dois contam como
  ocupado.

## O que ele toca

Nada que projete ou toque mídia. O único efeito é a pílula de volume: no passo
dela o gancho `volume(true)` a mostra PARADA (`mostrarPilula` sem o relógio) e o
tour a esconde ao sair do passo ou fechar. O voltar do Android é o **degrau 0** do
`__avBack`: fecha o tour (e o fechar desfaz a pílula).

## Geometria

O véu é o `box-shadow` de espalhamento do `.tour-recorte` (cor `--tour-veu`, nos
dois temas); sem peça, o fundo da raiz (`.tour--centro`). O recorte é a UNIÃO dos
alvos visíveis mais 6 px. O balão (até 340 px) vai abaixo, acima, ou — sem lugar
dos dois lados — encostado na borda com mais espaço, sempre dentro da tela.
Reposiciona em `resize`, `visualViewport`, `ResizeObserver` (peça e balão),
`transitionend`, rolagem e a cada 250 ms do vigia; peça cortada pela borda recebe
`scrollIntoView`. Foco no "Próximo", Tab preso no balão, `Escape` fecha.

## Os botões de Configurações

No fim do `#cfgTopo` (some com a seção aberta, como a grade), a linha
`.cfg-ajuda`: **Tour do app** (`#tourBtn`: fecha a folha e `AVTour.refazer()` o
tour do estado atual) e **Guia de sonoplastia** (`#guiaSomBtn`: `AV_PAGINA +
'sonoplastia/'`, com `#dia` — a trilha "Sonoplasta por um dia" — no Modo Fácil;
`openExternal` no app, `window.open` no navegador). Não moram no cabeçalho ao lado
do pedir ajuda: o cabeçalho já cede a palavra "Ajuda" para o título caber a 320px.

## Os oráculos e o arnês

O arnês (`abrirNavegador`) marca os três tours como vistos em TODO contexto — o
véu engole o toque e quebraria os oráculos que não falam dele. Quem mede o tour
passa `comTour: true`.
