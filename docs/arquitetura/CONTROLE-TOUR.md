# O tour guiado (v1.14.0; seções, "tocando" e halo na v1.14.1; ordem visual na v1.14.3; movimento na v1.14.4; liga/desliga na v1.14.5; só as seções complexas de Configurações na v1.14.10; o anel rente à borda na v1.14.11; a lista do Fácil, o deck um a um e as seções por estado na v1.14.20)

**O que é.** Um véu escurecido com um RECORTE na peça explicada e um balão curto
(título, uma ou duas frases, "N de M", Voltar · Próximo/Concluir · Pular tour). Mora em
`controle/tour.js` (`window.AVTour`); os ganchos ficam no `controle.js`, logo
depois do `__avBack`. Oráculo: `tools/tour.test.mjs`.

## Um tour por ESTADO da tela

| tour | quando vale (`qualTour()`) | o que mostra |
|---|---|---|
| `conexao` | Modo Fácil com a cortina "sem tela" (`#simpleMode.sem-tela`) | só a cortina: `#simpleConn`, `#castMirrorBtn`, `#castNetBtn`, `#castLocalBtn` |
| `simples` | Modo Fácil destravado, Biblioteca encaixada (`.corpo-biblioteca`) | `#simpleBarra`/`#libBar`, a lista da janela (`#hymnResults .lib-importar-btn` "Buscar na galeria" `opcional` (o botão do fim, v1.14.42), `.semana-raiz`, `.hymnal-card > .coll-bar`, `.coll-group-bar`, `.coll-bar-dl`), `#sorteioSimplesBtn`, `#volPill`, `#simpleSettingsBtn`, `#simpleCastBtn`, `FIM` |
| `tocando` | Modo Fácil destravado com a letra e as teclas à vista | `.simple-song`, `.simple-fabs`, `#simpleSlidesRow`, `.simple-nowplaying`, `#simpleStop`, `#simplePlay`, `#simpleTela` |
| `avancado` | Modo Avançado | `#library`, `#cronoTitulo`, `#itinBarBtn` (`opcional`; a porta da faixa do itinerário, "Toque aqui para abrir as opções…"), `#bibleBtn`, `#toolsBtn`, `#libBar` (o texto cita o primeiro item dela, "Importar arquivo" — sem passo próprio desde a v1.14.40, quando o importar saiu da barra do topo), o deck em nove passos (`.np-seek`, `#slidePrevBtn`+`#preview`+`#slideNextBtn`, `#prev`+`#playpause`+`#next`+`#stop`, `#plBtn`, `#repeat`, `#lyricsViewBtn`, `#viewToggle`, `#muteToggle`, `#pvFullBtn`), `#pvCastBtn`, `#settingsBtn`, `FIM` |

Os tours principais apontam as PORTAS e o que já está à vista na tela (a tabela `TOURS` do `tour.js`: o deck do Avançado, a lista da Biblioteca encaixada do Fácil); o que há
dentro de cada janela é o tour de SEÇÃO, abaixo. Um passo `opcional` sem
a peça sai da conta; um passo com `semAlvo` e sem a peça à vista vira BALÃO
CENTRAL com o texto que explica (a letra e as teclas do Fácil sem mídia no ar, o
`#pvCastBtn` com tela conectada). O tour vigia o estado: se ele muda no meio (a TV
conectou sozinha), o tour fecha e o do estado novo entra na fila.

## A ORDEM é a VISUAL, medida ao abrir (v1.14.3)

A ordem do array NÃO é a ordem mostrada: `abrir()` filtra os `opcional` e chama
`ordenar()`, que mede cada peça (`getBoundingClientRect`, a união dos alvos) NAQUELA
tela e naquele modo.

| regra | o quê |
|---|---|
| faixa | centros verticais em ordem; cada um entra na faixa do anterior se dista dele até max(`LINHA_PX` = 24 px, metade da altura do menor dos dois) — encadeado |
| ordem | faixa de cima para baixo; dentro dela, `left` crescente (empate: a ordem declarada) |
| `abertura: true` | FIXO no começo, na ordem declarada: a moldura que apresenta a tela ou a janela e CONTÉM as outras peças (`#simpleConn`, `#library`, `#bibleBody`, `.bible-vsec.cur`, `#histSecao`, `#testeCorpo`, `#msgWrap .msg-list`, `.edicao-card`, `#lyricsViewBody`, a folha da Playlist e a da Letra) |
| moldura | um passo cuja peça CONTÉM a de outro (a caixa inteira, ±1,5 px) vem logo ANTES da primeira peça de dentro, onde quer que ela caia na faixa — a `abertura` local: a moldura fica no lugar dela na tela, não no começo do tour. É o que põe a prévia com as setas antes dos botões do alto dela, cujo centro fica acima do da prévia (v1.14.21) |
| `fecho: true` / sem `alvo` | FIXO no fim (`FIM`: "Tour do app", balão central, em `simples` e `avancado`) |
| peça fora de vista | (o balão central do `semAlvo`) vai para o fim, ANTES do fecho, na ordem declarada |
| `volume: true` | a pílula está escondida (`visibility`) até o passo dela, e a CAIXA dela muda quando aparece (no Fácil é uma faixa alta na borda esquerda, por cima da Biblioteca): ela NÃO ordena — vai para o fim, antes do fecho — e fica FORA da regra da ordem (o bloco J não a conta: o passo cria a própria peça) (v1.14.20) |

O texto de um passo não pode depender do passo anterior (a posição dele muda com a
tela). Nenhum tour tem ordem estática. Oráculo: o bloco J do `tour.test.mjs` (todos
os tours, nos dois modos, a 390×860 e a 360×640; o `AVTour.passoAtual()` dá o passo
na ordem mostrada).

**`alvo` e `todos`.** `alvo` é um seletor ou uma lista deles, e o recorte é a
UNIÃO entre os SELETORES — a faixa e as duas pontas do mesmo controle. De cada
seletor entra UMA peça (a primeira visível), **salvo `todos: true`**, quando o
passo explica o conjunto inteiro ("os quatro botões de ajuste", as categorias):
aí entram todas as ocorrências visíveis. Sem `todos`, unir as LINHAS é o defeito
que a v1.14.15 consertou — `#histList .row-item .row-btn` destacava a lista toda
em vez da primeira linha, que é a que explica o gesto; e o inverso (passo que
explica um conjunto com uma peça só) é o da v1.14.16, que pôs `todos` em cinco
passos e deixou dois de fora, consertados na v1.14.17.

**A lista do Fácil e o deck do Avançado (v1.14.20).** O `simples` explica a janela que já
está aberta sobre a barra: a Liturgia (`.semana-raiz`), o cartão de coleção
(`.hymnal-card > .coll-bar`), as barras de seção do catálogo (`.coll-group-bar`, `todos`) e a
seta de download (`.coll-bar-dl:not(.coll-bar-rm)` — a lixeira leva a mesma classe). Todos
`opcional` e sem abrir nada: os cartões nascem fechados, a Liturgia só existe no app e as barras
vêm da rede; o toque que toca direto e o download de uma música avulsa (a pergunta é só da
primeira vez) vão no texto dos passos que têm peça em qualquer instalação. No `avancado` o
deck são nove passos em vez de um: o grupo de tocar NÃO leva `#repeat` nem `#plBtn`, que abrem a
mesma fileira — a união de todos recortaria os dois por baixo. Nenhum é `opcional`: são HTML
estático e só ficam apagados sem mídia (`visivel()` não conta `disabled`).

**Os textos:** título = o rótulo que está na tela (ou descrição curta, sem rótulo);
corpo de 1–2 frases com o que é, para que serve e o verbo de ação ("Toque…",
"Arraste…", "Segure…"), mais o detalhe que não é óbvio — conferido no código. As
peças das Ferramentas que moram no rodapé (`#toolsFoot`, irmão do `#toolsBody`) são
procuradas lá.

## Os tours de SEÇÃO (v1.14.1)

Na PRIMEIRA ABERTURA de cada janela, folha ou gaveta, ela se explica por dentro (a
tabela `SECOES`). O gatilho é o operador abrir: `secaoDoTour()` (no `controle.js`,
na ordem do `__avBack`) diz qual está por cima, e o tour abre depois de 0,7 s com
ela parada e sem bloqueio (`bloqueioDoTour()`: cortina, diálogo, tela cheia — o
foco num campo NÃO bloqueia, a Biblioteca abre com o teclado).

| chave | onde |
|---|---|
| `cfg-hist`, `cfg-pacote`, `conectar` | os dois modos |
| `biblioteca` (a janela do avançado), `cronogramas`, `biblia`, `biblia-leitura`, `ferramentas`, `ferr-clock`, `ferr-stopwatch`, `ferr-timer`, `ferr-msg`, `ferr-draw`, `ferr-edicao`, `ferr-edicao-form`, `sorteio`, `playlist`, `letra`, `letra-cifra` | avançado |

A raiz de Configurações, a Tela e a Verificação não têm tour: são janelas de ajuste
simples. O editor de mídia só existe no avançado — a lista das
Ferramentas do Fácil não tem o quadrado dele — e tem uma seção por vista (abaixo). Uma seção
sem NENHUM passo visível não abre nem grava a marca, e o automático volta a tentar a cada
segundo: por isso toda seção precisa de um passo à vista no estado em que o gatilho a devolve. As três portas de conexão
(`#castMirrorBtn`, `#castNetBtn`, `#castLocalBtn`) são as mesmas consts no tour
`conexao` e na seção `conectar`; muda só o texto do "Tocar neste celular" (na
cortina é a saída sem TV, na janela um interruptor) e o `opcional` da TV.

**TRÊS JANELAS SE DIVIDEM POR ESTADO (v1.14.20)**, cada estado com a própria marca de visto: a
Letra e a Cifra (`letra`/`letra-cifra`: o `secaoDoTour()` devolve a segunda quando o ▶ da barra
da cifra, `.lv-cifra-rolar`, está no DOM — `!hidden` não prova a barra completa, o "Procurando a
cifra…" também a mostra), a escolha e o formulário do editor de mídia (`ferr-edicao`/
`ferr-edicao-form`: `edicaoVista === 'form'` com `edicaoOrigem`) e a grade e a leitura da Bíblia
(`biblia`/`biblia-leitura`: `bibleScreen === 'reading'`). **E `modos` é porteiro** (v1.14.20): o
`candidato()` só oferece a seção que existe no modo em vigor — no Fácil, a Biblioteca aberta por cima
da leitura devolve `'biblioteca'` (a janela do avançado), e o tour dela abria dentro do Fácil com o
texto do avançado. O porquê é o `abrir()`: ele grava a
marca NA ABERTURA, então uma seção só, aberta na primeira vista, gastava a marca e a outra vista
nunca se explicava — e `opcional` não evita isso. Trocar de vista fecha o tour (o NOME da seção
mudou, `vigiar()`) e o automático oferece o da vista nova se ela ainda não foi vista. Quem
acrescentar uma vista nova a uma janela com tour: seção própria, não passo `opcional`.

**O rodapé das Ferramentas (v1.14.20):** as três saídas — o projetar e os dois quadrados de
guardar — são UM passo (`SAIDAS`, `todos`) nas quatro ferramentas que projetam e guardam
(Relógio, Cronômetro, Timer e Sorteio); a união é a ponta direita do rodapé. O Timer ganhou o passo da roleta
(`#chronoRoletas`); a lista de Ferramentas perdeu o "Fechar" (é a mesma porta que abriu) e ganhou
o "Editar mídia"; as Mensagens explicam a lista e as opções de formatação — na primeira
instalação a lista está vazia, e o passo das opções vira balão central (`semAlvo`).

**A Playlist automática (v1.14.21):** a lista sorteada já vem na primeira abertura (sem tema, o
acervo inteiro embaralhado), então os passos dela moram no mesmo `sorteio`: a moldura
(`.sorteio-res-cab` + `.sorteio-res`, presente nos três estados — montando, vazia e cheia), a linha
(`.sorteio-res-btn`, com `semAlvo` para a lista vazia), o `#sorteioQuantidade` e o embaralhar
(`.sorteio-sortear`), que tem passo próprio fora do destaque da saída.

Uma janela sem entrada na tabela (`songMenuPopup`, `itinPopup`) não tem tour, mas conta como seção aberta: o tour principal espera.
**Os ouvintes que fecham por toque FORA** (gaveta de cronogramas,
ações da linha) ignoram toque dentro do `#tour` — senão o "Próximo" fechava a gaveta
que ele explica.

## O tour liga e desliga por INTEIRO (v1.14.5)

`localStorage['av.tour.off'] = '1'` desliga TODOS os tours automáticos (os principais
e os de seção): `armar()` não arma e o `tique()` já armado se desfaz. `AVTour.ativo()`
lê; `desativar()` grava, fecha o tour aberto e para o automático; `refazer()` LIGA
(e faz o de sempre). As marcas de "visto" (`av.tour`) ficam como estão. A mudança
sai pelo evento `av-tour-ativo` na `window`.

| quem | efeito |
|---|---|
| **"Pular tour"** (o botão do balão) | `desativar()` — fecha com o fade e desliga de vez |
| Escape · voltar do Android · "Concluir" | só FECHAM o tour atual; o automático segue ligado |
| quadrado **"Tour do app"** (Configurações) | desligar = `desativar()` (a folha fica); ligar = `refazer()` (a folha fecha e o tour do modo abre) |

Só o automático obedece: `abrir()` e `refazer()` à mão sempre abrem.

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
- **A camada é 600**: acima dos diálogos (`.dialog-backdrop`, 300) e da cortina
  (`#splash`, 500), abaixo da prévia inteira (`2147483000`, e ela é popover no top
  layer). A cortina e a prévia contam como ocupado: o tour nunca abre por cima delas.

## O que ele toca

Nada que projete ou toque mídia. O único efeito é a pílula de volume: no passo
dela o gancho `volume(true)` a mostra PARADA (`mostrarPilula` sem o relógio) e o
tour a esconde ao sair do passo ou fechar. O voltar do Android é o **degrau 0** do
`__avBack`: fecha o tour (e o fechar desfaz a pílula).

## Geometria

O véu é o `box-shadow` de espalhamento do `.tour-recorte` (cor `--tour-veu`, nos
dois temas), e por cima dele o HALO: um anel de 2 px e um brilho de 14 px em
`--tour-halo` (o `--accent` do escuro, `#95b5f4`, com alfa .75/.9); sem peça, o fundo da raiz (`.tour--sem-recorte`).

A tela é a ÁREA VISÍVEL (`areaVisivel()`): o `visualViewport` quando existe (com o
teclado ou a barra do navegador, a janela de layout não é o que o olho vê), senão a
janela.

| constante | valor | o que faz |
|---|---|---|
| `FOLGA` | 6 px | o recorte é a UNIÃO dos alvos SELECIONADOS mais esta folga, a peça INTEIRA; o raio é o do cartão ou o da peça + 6 px (uma pílula ganha halo de pílula) |
| `ANEL` | 2 px | a espessura do anel (`box-shadow: 0 0 0 2px`), desenhado POR FORA da caixa: o recorte é preso a 2 px de cada borda da área visível e o anel termina exatamente nela — encosta, não fura (a régua do foco dos controles). Numa peça colada à borda, só esses 2 px saem da folga |
| `MARGEM` | 16 px | o balão (largura `min(340, área − 2·16)`, altura máxima `área − 2·16`) nunca chega a menos disto de borda nenhuma |
| `VAO` | 10 px | entre o recorte e o balão |

O balão vai abaixo do recorte, acima, ou — sem lugar dos dois lados — encostado (a
`MARGEM`) na borda com mais espaço; sem peça, no centro. Oráculo: `recorteBate` do
`tour.test.mjs` — a peça vem de `AVTour.alvos()` (o que o passo SELECIONOU), o
oráculo cobra UM alvo por seletor (todos com `todos`) e mede o recorte = a peça +
`AVTour.FOLGA`, preso entre `AVTour.ANEL` e a área − `ANEL` —, nos blocos que
medem o recorte.
Reposiciona em `resize`, `visualViewport`, `ResizeObserver` (peça e balão),
`transitionend`, rolagem e a cada 250 ms do vigia; peça cortada pela borda recebe
`scrollIntoView`. Foco no "Próximo", Tab preso no balão, `Escape` fecha.

## O movimento (v1.14.4)

Nada salta entre passos. Tokens em `shared/tokens.css`: `--tour-mov` (.34s, o
trajeto), `--tour-fade` (.12s, a troca do texto), `--tour-curva` (a curva de saída
das gavetas, `cubic-bezier(.22, .61, .36, 1)`).

| momento | o que anima | como |
|---|---|---|
| troca de passo | recorte: posição, tamanho, raio | `left/top/width/height/border-radius` com transição — sem filhos, o layout é nulo; `transform` promoveria uma camada do tamanho da sombra de 200vmax |
| | balão: posição e altura | `transform: translate()` (não refaz o texto); a altura vai da travada à natural do texto novo |
| | texto (título, corpo, "N de M") | some em `--tour-fade` (`.tour-balao--trocando`), troca, volta durante o trajeto |
| para o centro | o buraco encolhe até o meio do balão e o halo apaga (`.tour--centro`, `box-shadow` com halo transparente) | no fim o recorte sai e o véu vira o fundo da raiz (`.tour--sem-recorte`), da mesma cor |
| do centro | o buraco nasce fechado no meio do balão (`.tour--fixo`) e abre até a peça | |
| abrir | véu em fade, recorte e balão de `scale .94` a 1 | `.tour--entrando`, tirada no quadro seguinte |
| fechar | uma CÓPIA inerte (`sombra()`, sem ids, `pointer-events: none`) some em fade | o tour de verdade fecha na hora: `#tour` oculto, o toque volta ao app |
| resize, teclado, ResizeObserver, rolagem, vigia | o mesmo trajeto, curto (`.tour--ajuste` = `--dur-rapida`) | as transições redirecionam do ponto em que estão: sem tremer |

**A ordem da troca** (`mostrarPasso` → `assentar` → `mover`): o volume, os botões e a
rolagem (`scrollIntoView`) acontecem NA HORA; o texto some com a altura do balão
travada; `assentar()` espera a peça parar (dois quadros no mesmo lugar, teto
`ASSENTA_MS` = 700 ms — rolagem, janela ou pílula entrando); passado o fade, `mover()`
troca o texto e leva recorte e balão juntos. Até lá o recorte fica onde estava:
nunca salta para a posição velha. Durante a troca (`animando`) os reposicionamentos
esperam; o fim dela reposiciona.

**Cliques repetidos:** cada troca leva um número (`seq`); a seguinte cancela a
anterior e o ÚLTIMO vence — três "Próximo" rápidos andam três passos.

**`prefers-reduced-motion: reduce`:** os tokens viram 0 (no `controle.css`) e o
`mostrarPasso` toma o caminho instantâneo (o de antes da v1.14.4); sem cópia ao
fechar.

**Oráculo:** bloco K do `tour.test.mjs` — as transições computadas; o recorte,
com as transições pausadas na metade, ENTRE a peça A e a B; três cliques rápidos;
a duração 0 com movimento reduzido. As outras medidas esperam `AVTour.quieto()`
(sem troca nem transição correndo).

## Os botões de Configurações

No fim do `#cfgTopo` (some com a seção aberta, como a grade), a linha
`.cfg-ajuda`: **Tour do app** (`#tourBtn`, o ÚLTIMO `.qs-tile` da grade — dois ícones,
`#icoTourOff`/`#icoTour`, e o estado só no desenho; nasce ligado. Desligar desliga o
tour (acima) e a folha fica; ligar de novo fecha a folha e `AVTour.refazer()` o tour do
estado atual — e ZERA o modo atual: os outros tours principais dele e todas as
seções que existem nele voltam a se explicar na próxima abertura; o `title` do botão
muda com o estado e o último passo dos tours principais diz como rever) e **Guia de sonoplastia** (`#guiaSomBtn`, com a SETA de "abre outra tela" — `icoExterno`,
porque ele sai da tela atual: `AV_PAGINA +
'sonoplastia/'`, com `#dia` — a trilha "Sonoplasta por um dia" — no Modo Fácil;
no app, `AVNative.abrirGuia` — uma tela do próprio app, WebView SEM ponte, desde o
shell 87 —, com queda no `openExternal` no casco antigo ou na recusa; `window.open`
no navegador; oráculo `guia-no-app.test.mjs`). Não moram no cabeçalho ao lado
do pedir ajuda: o cabeçalho já cede a palavra "Ajuda" para o título caber a 320px.

## Os oráculos e o arnês

O arnês (`abrirNavegador`) nasce como um aparelho que já viu TODOS os tours: o gancho
embrulha o `window.AVTour` e, na publicação, grava cada chave de `AVTour.chaves()` —
uma seção nova entra sozinha. O véu engole o toque e quebraria os oráculos que não
falam dele. Quem mexe nas marcas por fora chama `AVTour.armar()`. Quem mede o tour
passa `comTour: true`.
