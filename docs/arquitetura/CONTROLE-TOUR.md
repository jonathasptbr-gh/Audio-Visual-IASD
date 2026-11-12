# O tour guiado (v1.14.0; seções, "tocando" e halo na v1.14.1)

**O que é.** Um véu escurecido com um RECORTE na peça explicada e um balão curto
(título, uma ou duas frases, "N de M", Voltar · Próximo/Concluir · Pular). Mora em
`controle/tour.js` (`window.AVTour`); os ganchos ficam no `controle.js`, logo
depois do `__avBack`. Oráculo: `tools/tour.test.mjs`.

## Um tour por ESTADO da tela

| tour | quando vale (`qualTour()`) | o que mostra |
|---|---|---|
| `conexao` | Modo Fácil com a cortina "sem tela" (`#simpleMode.sem-tela`) | só a cortina: `#simpleConn`, `#castMirrorBtn`, `#castNetBtn`, `#castLocalBtn` |
| `simples` | Modo Fácil destravado, Biblioteca encaixada (`.corpo-biblioteca`) | `#simpleBarra`/`#libBar`, `#sorteioSimplesBtn`, `#volPill`, `#simpleSettingsBtn`, `#simpleCastBtn` |
| `tocando` | Modo Fácil destravado com a letra e as teclas à vista | `.simple-song`, `.simple-fabs`, `#simpleSlidesRow`, `.simple-nowplaying`, `#simpleStop`, `#simplePlay`, `#simpleTela` |
| `avancado` | Modo Avançado | `#library`, `#cronoTitulo`, `#cronoImportar`, `#bibleBtn`, `#toolsBtn`, `#libBar`, `#preview`, `#seek`+`.transport`, `#pvCastBtn`, `#settingsBtn` |

Os tours principais só apontam as PORTAS (a tabela `TOURS` do `tour.js`); o que há
dentro de cada janela é o tour de SEÇÃO, abaixo. Um passo `opcional` sem
a peça sai da conta; um passo com `semAlvo` e sem a peça à vista vira BALÃO
CENTRAL com o texto que explica (a letra e as teclas do Fácil sem mídia no ar, o
`#pvCastBtn` com tela conectada). O tour vigia o estado: se ele muda no meio (a TV
conectou sozinha), o tour fecha e o do estado novo entra na fila.

## Os tours de SEÇÃO (v1.14.1)

Na PRIMEIRA ABERTURA de cada janela, folha ou gaveta, ela se explica por dentro (a
tabela `SECOES`). O gatilho é o operador abrir: `secaoDoTour()` (no `controle.js`,
na ordem do `__avBack`) diz qual está por cima, e o tour abre depois de 0,7 s com
ela parada e sem bloqueio (`bloqueioDoTour()`: cortina, diálogo, tela cheia — o
foco num campo NÃO bloqueia, a Biblioteca abre com o teclado).

| chave | onde |
|---|---|
| `configuracoes`, `cfg-tela`, `cfg-hist`, `cfg-teste`, `cfg-edicao`, `cfg-pacote`, `conectar` | os dois modos |
| `biblioteca` (a janela do avançado), `cronogramas`, `biblia`, `ferramentas`, `ferr-clock`, `ferr-stopwatch`, `ferr-timer`, `ferr-itinerario`, `ferr-msg`, `ferr-draw`, `sorteio`, `playlist`, `letra` | avançado |

Uma janela sem entrada na tabela (`songMenuPopup`, `itinPopup`, a gaveta de
itinerários) não tem tour, mas conta como seção aberta: o tour principal espera.
**Os ouvintes que fecham por toque FORA** (gaveta de cronogramas, de itinerários,
ações da linha) ignoram toque dentro do `#tour` — senão o "Próximo" fechava a gaveta
que ele explica.

## Automático uma vez, e nunca por cima de nada

- **A marca é `localStorage['av.tour']`** (`{"conexao":1,"s.biblia":1,…}`; as chaves
  de seção levam o prefixo `s.`; `AVTour.chaves()` lista todas), como a
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
dois temas), e por cima dele o HALO: um anel de 2 px e um brilho de 14 px em
`--tour-halo` (o `--accent` do escuro, `#95b5f4`, com alfa .75/.9); sem peça, o fundo da raiz (`.tour--centro`). O recorte é a UNIÃO dos
alvos visíveis mais 6 px. O balão (até 340 px) vai abaixo, acima, ou — sem lugar
dos dois lados — encostado na borda com mais espaço, sempre dentro da tela.
Reposiciona em `resize`, `visualViewport`, `ResizeObserver` (peça e balão),
`transitionend`, rolagem e a cada 250 ms do vigia; peça cortada pela borda recebe
`scrollIntoView`. Foco no "Próximo", Tab preso no balão, `Escape` fecha.

## Os botões de Configurações

No fim do `#cfgTopo` (some com a seção aberta, como a grade), a linha
`.cfg-ajuda`: **Tour do app** (`#tourBtn`: fecha a folha e `AVTour.refazer()` o
tour do estado atual — e ZERA o modo atual: os outros tours principais dele e todas
as seções que existem nele voltam a se explicar na próxima abertura; o `title` do
botão e o último passo dos tours principais dizem isso) e **Guia de sonoplastia** (`#guiaSomBtn`: `AV_PAGINA +
'sonoplastia/'`, com `#dia` — a trilha "Sonoplasta por um dia" — no Modo Fácil;
`openExternal` no app, `window.open` no navegador). Não moram no cabeçalho ao lado
do pedir ajuda: o cabeçalho já cede a palavra "Ajuda" para o título caber a 320px.

## Os oráculos e o arnês

O arnês (`abrirNavegador`) nasce como um aparelho que já viu TODOS os tours: o gancho
embrulha o `window.AVTour` e, na publicação, grava cada chave de `AVTour.chaves()` —
uma seção nova entra sozinha. O véu engole o toque e quebraria os oráculos que não
falam dele. Quem mexe nas marcas por fora chama `AVTour.armar()`. Quem mede o tour
passa `comTour: true`.
