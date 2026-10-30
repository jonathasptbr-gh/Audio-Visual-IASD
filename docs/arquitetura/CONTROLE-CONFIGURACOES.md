<!-- Parte do capítulo do Controle (o índice das partes está em CONTROLE.md;
     o mapa geral, em docs/ARQUITETURA-WEB.md). Partida do CONTROLE.md na
     revisão A3 (2026-10-30): o texto foi MOVIDO verbatim. -->

## Controle — Configurações (tema, painel rápido, wallpaper, histórico, Registro)

> Parte do capítulo do Controle — o índice das partes e as regras que valem
> para o Controle inteiro estão em [`CONTROLE.md`](CONTROLE.md).

**Nesta parte:** [O tema (claro × escuro), em Configurações](#o-tema-claro--escuro-em-configurações) · [Configurações é um PAINEL RÁPIDO](#configurações-é-um-painel-rápido-v1438) · [O rodapé são TRÊS BOTÕES IGUAIS](#o-rodapé-são-três-botões-iguais-v1865-revogando-a-v1444) · [A contagem de uso NÃO TEM MAIS CHAVE](#a-contagem-de-uso-não-tem-mais-chave-v1442) · [UM registro só](#um-registro-só) · [Wallpaper personalizado](#wallpaper-personalizado) · [Girar a mídia](#girar-a-mídia-v5142) · [O histórico do culto, em Configurações](#o-histórico-do-culto-em-configurações-v120--v1431)


### O tema (claro × escuro), em Configurações

Uma linha segmentada logo abaixo de "Modo do app", e a proximidade é
deliberada: são a mesma classe de decisão ("como este app se apresenta") e as
duas são LEMBRADAS entre aberturas. O escuro vem primeiro por ser o padrão, e o
segmentado segue a leitura esquerda→direita das demais linhas — o estado de
partida à esquerda, como o "Padrão" do wallpaper desde a v5.188.

**Trocar aqui NÃO fecha o popup**, ao contrário do modo do app. O modo troca a
tela inteira ATRÁS do popup (não há o que ver com ele na frente); o tema troca
a cor DO PRÓPRIO POPUP, e é olhando para ele — que acabou de mudar — que o
operador decide se gostou.

**A escolha é lida do `localStorage` (`av.tema`) no topo do `controle.js`**,
antes do primeiro quadro, exatamente pela razão do `av.appMode` logo abaixo (que
vive em `sessionStorage`, pelo mesmo motivo de ser síncrono): uma leitura do
IndexedDB é assíncrona e chega depois de o app já ter pintado. Aqui o
preço de errar é maior, não menor — o modo troca a TELA, o tema troca a COR DE
TUDO, e um flash do app inteiro em preto antes de virar claro se vê a cada
abertura.

**O escuro é o padrão, e é o app sem atributo nenhum.** Não é inércia: este app
é operado num salão às escuras, e quem nunca escolheu precisa abrir na versão
que não cega o operador nem ilumina a fileira de trás. O claro existe para o
ensaio de sábado de manhã e para quem opera com a igreja acesa.

As cores, a montagem dos três blocos de `tokens.css` e a razão de o PALCO não
ter tema estão no Design System, mais abaixo.

### Configurações é um PAINEL RÁPIDO (v1.4.38)

Ela era uma pilha de sete **faixas** de largura inteira — rótulo por extenso à
esquerda, segmentado de duas opções à direita, ~64px cada. Uma opção por faixa
levava o corpo a passar dos 480px, e a folha rolava num aparelho de 640px de
altura. Hoje é uma **grade de três colunas** de tiles: **ícone e título curto**,
e o toque **alterna** — o painel rápido de um celular. (A palavra do estado, que
era uma segunda linha em cada tile, saiu na v1.7.2; ver a regra 2 abaixo.)

**A GRADE TEM OITO TILES E TRÊS COLUNAS** (v1.11.7), na ordem da tabela, de cima
para baixo: o que se **ajusta** (seis) e, numa fileira própria, o que se faz com
o **APP fora da projeção** (dois). Pedido do operador (v1.7.6): *"reordene os
botões: compartilhar, exportar e importar devem ser os tres itens da base"* — e
hoje são **Compartilhar e Transferir**, porque exportar e importar viraram um
tile só (ver abaixo). O que faz a fileira do aparelho começar sozinha, com a
ponte ou sem ela, é `#shareAppTile { grid-column: 1 }` no CSS.

Em nativo as fileiras são `[Tema · Tela · Histórico]` `[Saída de áudio · Dados
móveis · Verificar]` `[Compartilhar · Transferir]`; no navegador (Saída de
áudio, Compartilhar e Transferir são `hidden`) são cinco tiles.

| tile | id | estado (`data-estado`) | aceso | ícone |
|---|---|---|---|---|
| Tema | `#temaTile` | `escuro` · `claro` | **sempre** | `#icoLua` / `#icoSol` |
| **Tela** | `#telaTile` | — (abre a seção da Tela) | **sempre** (classe no HTML) | `#icoTela` |
| Histórico | `#histOpenRow` | — (abre a seção) | **sempre** (classe no HTML) | `#icoHistorico` |
| Saída de áudio | `#saidaAudioTile` | — (abre o seletor do sistema) | **sempre** | `#icoSaidaDeAudio` |
| Dados móveis | `#dadosMoveisTile` | `on` · `off` | **sempre** | `#icoDadosMoveisOff` / `#icoDadosMoveis` |
| Verificar | `#testeTile` | — (abre a seção) | **sempre** | `#icoVerificar` |
| Compartilhar | `#shareAppTile` | `app` | **sempre** | `#icoCompartilhar` |
| **Transferir** | `#pacoteTile` | `ocioso` · `ocupado` · `pronto-para-enviar` | **sempre** | `#icoTransferir` / `#icoCompartilhar` (pronto) · o ARO no lugar dele em curso |

#### As SEÇÕES de Configurações (v1.12.48)

Pedido do operador: *"ao invés das opções de configurações abrirem em uma nova
janela na base da tela, faça com que seus conteúdos abram dentro da janela
original das configurações, abaixo dos botões … mas acima dos botões de versão e
pedir ajuda. Ajuste a questão do botão de fechar dessas 'janelas', para que sejam
mais individuais e não concorram visualmente com o botão de fechar a janela toda
… Lembre de fazer as animações de alternância, abertura e fechamento dessas
seções no corpo, como também cuidar a animação da própria janela"*.

**Tela, Transferir, Editar mídia, Histórico e Verificação são SEÇÕES de
`#fadePopup`**, e não folhas: cada uma é uma `<section class="cfg-sec">`
(`#telaSecao`, `#pacoteSecao`, `#edicaoSecao`, `#histSecao`, `#testeSecao`)
dentro de `#cfgSecoes`, no fim da `.fade-opts` — depois do `#cfgTopo` (o modo e a
`.qs-grade`), e são o fim da folha: a versão e o pedir ajuda moram no CABEÇALHO
da folha (v1.12.50), e o `.popup-footer` só existe com a atualização adiada (`#otaRow`) ou
no navegador (`#openDisplayBtn`) — vazio, ele some
(`.popup-footer:not(:has(> :not([hidden])))`). Os ids de dentro (tiles, listas,
botões) são os de quando eram folhas.

| peça | onde | regra |
|---|---|---|
| a tabela | `SECOES` (bloco do topo do `controle.js`) | tile, nó, `abrir`, `recolher` de cada seção. Seção nova = uma linha + uma `<section class="cfg-sec">` |
| a troca | `trocarSecao(nome)` | UMA aberta por vez: o tile abre a dele (e o mesmo nome RECOLHE; com a grade escondida, a porta na tela é o chevron e o voltar). `abrirSecao(nome)` abre Configurações antes se preciso; `recolherSecao()` |
| a grade some | `#cfgTopo` · `.com-secao` | v1.12.50, pedido do operador: *"faça com que a zona dos botões originais das configurações seja oculta (pode manter a animação de deslizar para cima)"*. Abrir uma seção (de nenhuma) põe `.com-secao` na `.fade-opts`, zera a rolagem e anima o `margin-top` do topo até a altura dele negativa — ele SOBE, recortado pela borda do scroller — e só então lhe dá `hidden`; recolher o devolve descendo. A troca entre seções (`de && para`) não o toca. Vale para as CINCO seções, a Tela inclusive (o padrão que o operador pediu). `rolarAteSecao` SAIU: com o topo fora, a seção começa no topo da folha |
| a animação | `trocarSecao` · `animarAlturaDasSecoes` | WAAPI na `height` de `#cfgSecoes` (`--dur-lenta`); a folha tem a altura do conteúdo e cresce JUNTO. O TETO é `calc(100% - 3.5rem)` desde a v1.12.49 (`#fadePopup .popup-sheet`, era 80%): *"permita essa janela … ficar maior em altura"* — a lista de uma seção usa quase a tela, e o scrim fica à vista embaixo. Na troca a seção que sai é `.saindo` (absoluta, sem toque) e as duas se cruzam por opacidade. Mudanças de DENTRO (a Verificação terminando, o editor trocando de vista) passam por `animarAlturaDasSecoes`. Sem movimento: sem animação, mesmo estado final |
| o fechar | `.cfg-sec-recolher` | NENHUMA seção tem ✕ — o único é o de Configurações. O cabeçalho (`.cfg-sec-cab`: o desenho e o título do tile) tem um chevron para cima SEM CAIXA (`--muted`, fundo transparente, `--hit` × `--hit`) |
| o cabeçalho da seção | `.fade-opts.com-secao .cfg-sec-cab` | GRUDA no topo do scroller, logo abaixo do cabeçalho da folha (`sticky`, `top: -var(--veu-topo)`), de borda a borda (margens negativas de `--veu-*`, o recuo de volta em `padding`) e OPACO (`--panel`, `z-index: 7`). Ele cobre a tira de cima do scroller, então a sombra de "há mais acima" é DELE (`::after` na borda de baixo, só com `.tem-acima`) — a receita da faixa de fecho, de cabeça para baixo |
| o topo da folha | `.cfg-titulos` · `#versaoBtn.versao-txt` · `#contatoBtn.popup-acao` | v1.12.50: a VERSÃO é texto ao lado do título (sem fundo nem borda, `--fs-sm`, `--muted` — 6,66:1 sobre `--panel` nos dois temas), e o toque mostra o que mudou; título e versão dividem uma caixa que QUEBRA (a 360×1,25× a versão desce e o título fica inteiro). O PEDIR AJUDA é o balão (`#icoContato`, `--icon-sm`) com a palavra **"Ajuda"** ao lado (v1.12.52, `.popup-acao--rotulo`: `--fs-sm`, `--fw-medio`, `--muted` — a régua da versão; altura `--hit`, sem fundo) logo antes do ✕, `hidden` fora do app. A PALAVRA CEDE AO TÍTULO: ela come ~42px, e MEDIDO a 320×1,25× e a 360×1,5× "Configurações" saía cortado — sem lugar para o título inteiro o botão volta a ser só o balão (`.compacto`, `acertarAjudaDoCabecalho`, tudo ou nada, medido na abertura e no `resize`). A 360×1,25× a palavra cabe (22px de sobra) |
| a Verificação | `#testeOcultar` · `#testeCancelar` · `pintarTileDoTeste` | enquanto anda, o Refazer e o Registro somem e a faixa mostra o OCULTAR (secundário, `.teste-refazer`: `--surface` + `--accent`, o chevron para cima) e o CANCELAR (✕ + "Cancelar", `--danger-strong` sobre `--btn-danger`). **Desde a v1.12.52 recolher só OCULTA** (pedido do operador: *"fazer um botão de ocultar para o processo de verificação sem ser interrompido"*): o Ocultar, o chevron (que fica à vista), o voltar e fechar Configurações recolhem a seção e a rodada SEGUE; só o Cancelar a interrompe (`cancelarVerificacao` + recolher). Oculta, o tile "Verificar" é o SINAL — a mecânica do Transferir: o aro no lugar do ícone e o percentual no lugar do título (`falarNoTile`), e, terminada com a seção recolhida (`testeNaoVisto`), o desfecho (`rotuloDoTileDoTeste`: "Tudo certo", "N problemas", "N sem resposta") até a seção abrir. Reabrir no meio mostra a barra no ponto atual; reabrir com resultado NÃO VISTO o mostra sem rodar; um resultado já visto roda de novo na reabertura. Nenhuma cor nova. O Ocultar cede a largura ao Cancelar pela régua do Refazer (`acertarFechoDoTeste`) |
| o aberto | `aria-expanded` no tile | **ABERTO não é cor**: o tile não muda; quem diz é o corpo à vista e o cabeçalho com o desenho dele |
| a faixa de fecho | `.cfg-sec > .popup-fecho`, `.cfg-sec > #histClearFaixa` | GRUDA na base da folha (`sticky`, fundo `--panel`, `z-index: 6` acima da tira de sombra) — a regra da v1.8.60, *"o botão de salvar … fixo na base"*, sobrevivendo à mudança de casa. Desde a v1.12.49: DE BORDA A BORDA (margens negativas de `--veu-esq`/`--veu-dir`, o recuo de volta em `padding`), respiro `--sp-6` acima e `--cfg-base` (`.9rem`) abaixo, e a SOMBRA de "há mais abaixo" é dela (`::before` na borda de cima, só com a `.fade-opts.tem-abaixo`) |
| a base da folha | `.fade-opts` (`padding-bottom: 0`) · `.cfg-secoes` (`margin-bottom: --cfg-base`) | a regra da v1.8.63 (*margem do último item, nunca padding do scroller*): com uma seção de faixa aberta a margem é zero e a base é o `padding` da faixa, então ela fica no MESMO lugar grudada e no fim da rolagem |
| as listas | `.cfg-sec .popup-list` | NÃO rolam sozinhas (sem `rola`): quem rola é a `.fade-opts`. Um scroller dentro de outro faz o mesmo gesto mover coisas diferentes |

**Os três defeitos que a v1.12.49 fechou** (*"vi bugs visuais na área do histórico …
a sombra de fronteiras de lista e o espaçamento da base antes dos botões do
rodapé"*), MEDIDOS a 360 e 430 px, 1× e 1,5×, nos dois temas, e travados no bloco H
do `configuracoes-janelas`:

1. **A tira nas calhas.** A faixa tinha a largura do CONTENT box, e a tira de baixo
   do scroller (`.rola::after`, de borda a borda) aparecia nos 14,4 px de cada lado
   dela — uma sombra colada à borda da folha, ao lado de um botão opaco.
2. **O corte sem aviso.** Grudada, a faixa cobria a tira inteira no miolo, e a
   lista sumia atrás dela sem sombra nenhuma; a sombra passou a ser da faixa.
3. **O pulo da base.** O `padding-bottom` de 16 px da `.fade-opts` entrava DEBAIXO
   da faixa no fim da rolagem: grudada, 16 px sob o botão; no fim, 32 px — e mais
   o rodapé da versão embaixo. Era também a armadilha da v1.8.63 (a tira recortada
   nos últimos 16 px de rolagem).

- **Fechar Configurações recolhe a seção** (`closeFadePopup`, sem animar) — e
  uma Verificação em curso SEGUE oculta (v1.12.52; até a v1.12.51 fechar a cancelava).
- **O que muda NO MEIO de uma troca continua animando** (v1.12.52): um gancho de
  abrir assíncrono desenha durante a animação da troca, quando `animarAlturaDasSecoes`
  só desenha; o `fim()` de `mudarSecao` mede a altura natural e, se ela não é a que a
  troca alcançou, anima da altura da troca até ela (`D × 0,6`). Sem isto a caixa
  saltava no último quadro.
- **O voltar recolhe a seção ANTES de fechar Configurações** (`__avBack`, no
  degrau da folha). As folhas que uma seção abre por cima (a pergunta de destino
  do editor, `#songMenuPopup`) continuam folhas e fecham primeiro.
- **Projetar um item do Histórico fecha Configurações inteira:** ela cobre a
  preview e o transporte, que é onde a resposta ao toque aparece.
- **Não há caminho de fora** que abra uma delas sem Configurações; quem quiser
  um usa `abrirSecao(nome)`, que abre a folha antes.
- **Fechar Configurações e o voltar devolvem a grade** junto com o recolher (sem
  animar, no fechar): a próxima abertura começa na grade.

#### A seção da TELA (v1.11.7; seção desde a v1.12.48)

Pedido do operador: *"centralizar opções que se referem a tela em um botão nas
configurações, que abre uma janela com as opções"*. Quatro tiles que eram da
grade moram agora em `#telaSecao`, com os **mesmos ids e o mesmo markup**
(pintores, `data-estado` e quase todos os oráculos os alcançam por id).

| tile | id | estado (`data-estado`) | ícone |
|---|---|---|---|
| Preenchimento | `#fitTile` | `contain` · `cover` (ver `stage.setFit()`) | `#icoAjustar` / `#icoPreencher` |
| Wallpaper | `#wallTile` | `padrao` · `propria` | `#icoWallpaper` / `#icoWallpaperProprio` |
| Fundo da letra | `#lyricsBgTile` | `image` · `black` (ver "Fundo preto vs. imagens dos slides") | `#icoImagem` / `#icoImagemOff` |
| Girar no telão | `#rotBtn` | `0` `90` `180` `270` | `#icoPaisagem`, GIRADO pelo `data-estado` |

- **O Tema FICA na grade:** é a cor do APP, e o palco não tem tema — pô-lo numa
  seção chamada "Tela" induziria a lê-lo como o tema do telão. O Histórico (o
  que foi ao ar), a Saída de áudio (o som) e os Dados móveis (a rede) também não
  descrevem a aparência do telão.
- **O WALLPAPER continua sendo um `<label>` com o `<input type=file>` DENTRO**
  (invariante 6 do shell): a ativação nativa do rótulo é o que abre o
  `onShowFileChooser`. Tocar num tile NÃO recolhe a seção.
- **A grade da seção é `.qs-grade-folha`, DUAS colunas** (4 tiles fecham 2×2; 3
  deixariam um órfão e 4 não comportam "Preenchimento" a 360px). **Não é
  `.qs-grade`**: essa é a grade de Configurações, e os oráculos a alcançam por
  `document.querySelector('.qs-grade')`.
- **A seção recolhida é `hidden` (`display: none`):** o nó existe e `load()`
  pinta o `data-estado` dos quatro na carga, mas o que depende de LAYOUT (o
  `transform` computado do giro, a largura do ícone) só existe com ela aberta —
  `aoAbrirTela` refaz isso na abertura.

#### A seção do TRANSFERIR (v1.11.7; a lista sempre à vista, v1.11.9; seção desde a v1.12.48)

Pedido do operador (v1.11.7): *"os botões de exportar e importar, para que sejam
um único botão, e depois na janela aberta teremos a escolha de exportar ou
importar dados, junto com o sistema que já temos de listagem da biblioteca atual
antes da exportação, afinal, para importação também é bom saber o que já se
tem"*. E a v1.11.9, sobre a primeira entrega: *"em ambos os casos a lista será
vista, então já pode tornar ela visível diretamente e ter apenas os dois botões
de ações na base"*.

- **`#pacoteTile` abre `#pacoteSecao`**: cabeçalho, a LISTA (`#pacoteLista`), a
  nota (`#pacoteNota`) e, no `.popup-fecho` — grudado na base da folha, como o
  confirmar de toda seção —, os DOIS botões de sempre (`#pacoteExportarTile`,
  `#pacoteImportarTile`, mesmos ids, mesmo markup, mesmos três desenhos, lado a
  lado). Toda a coreografia de `pacoteRenderTiles` — o aro, o pronto-para-enviar,
  o irmão que vira Cancelar ou Descartar — continua pintando ELES:
  `pacoteRenderTiles()` é `pacoteRenderPar()` (o corpo de antes) mais
  `pacoteSinal()` mais `pacoteRedesenharLista()`.
- **A LISTA JÁ ESTÁ NA SEÇÃO, e é a escolha do que levar.** `aoAbrirPacote()`
  chama `pacoteAbrirLista()`: o plano APROXIMADO (`pacotePlanoAproximado`, o que
  a Biblioteca já sabe) vai para `pacoteEsboco` e `renderPacoteGrupos(plano)`
  desenha as mesmas linhas do seletor de destinos (`songMenuItem`, o Set
  `destMarcados`), **tudo marcado** (`pacoteMarcarPadrao`). A nota diz o peso do
  que está marcado (*"Exportar leva até X"*, o teto) e a promessa do Importar;
  num aparelho sem biblioteca a lista é uma frase de vazio (`li.empty`) e a nota
  só fala do Importar. **Importar não lê a marca**: traz o que o arquivo tiver.
- **O toque no Exportar É a confirmação:** `exportarPacote()` lê
  `pacoteSelecao(pacoteEsboco)` na hora e segue para a medição, o destino e a
  escrita — sem folha por cima. **Chamada direta, sem a janela aberta** (os
  oráculos), ela monta o plano e marca TUDO, que é o padrão da lista. O toque no
  Importar chama `importarPacote()` direto: o seletor de arquivos abre na hora.
  A folha "O que levar" (`escolherGruposDoPacote`), a listagem em leitura
  (`mostrarAcervoParaImportar`, `renderPacoteGrupos(plano, { leitura })`) e o
  `importarPeloTile` SAÍRAM com este lote.
- **COM TRABALHO ANDANDO OU UM PACOTE PRONTO A LISTA TRAVA**
  (`pacoteOcupado()`: `pacoteEmCurso || pacoteExportando || pacoteImportando ||
  pacoteMedindo || pacotePronto`): `#pacoteLista.travada`, as linhas de marcar
  `disabled`, a barra da seção `aria-disabled` e as caixas em `--op-inativo` —
  INDISPONÍVEL, nunca "desligado". As seções continuam abrindo. Descartar o
  pronto a destrava. **`innerHTML = ''`, nunca `limparFolha`**, ao redesenhar: a
  `limparFolha` esvazia o `.popup-fecho` irmão — onde moram os dois botões.
- **O TILE DA GRADE É O SINAL, não só a porta** (`pacoteSinal`): com a janela
  fechada durante os minutos de uma exportação, o aro gira nele
  (`pacoteExportando || pacoteImportando || pacoteMedindo` — NUNCA
  `pacoteEmCurso`, que sobe no primeiro toque) e o desenho de compartilhar
  aparece quando há um pacote pronto. A importação também ganha aro ali (no
  botão dela ela vira o Cancelar, mas o tile da grade não tem irmão). Nunca
  `disabled`: tocar nele é a única forma de chegar ao cancelar, ao enviar e ao
  descartar.
- **O feedback dos dois botões é espelhado no tile da grade**
  (`pacoteFalar`/`pacoteCalar`/`pacotePulsar`): `pulsar` recusa um nó dentro de
  `.popup-backdrop:not(.open)` e uma frase emprestada num nó oculto não se vê.
  O rótulo de PAPEL do irmão ("Cancelar", "Descartar") NÃO é espelhado — no tile
  da grade seria uma mentira.
- **Fechar a janela com uma exportação em curso não cancela nada:** o estado é de
  módulo (`pacoteExportando`, `pacotePronto`…) e o trabalho roda sob `withBgWork`
  + notificação. Cancelar é tocar no tile que trabalha.
- **A folha "O que levar" (`#songMenuPopup`, z 210) abre POR CIMA da janela
  (z 205).**

**A COLUNA "ACESO" DIZ "SEMPRE"**, e a regra é a da v1.7.6. Pedido do operador:
*"todos os botões devem ter o mesmo azul de ativo, não temos mais essa diferença,
toda diferença de estado é pelo icone, não pela cor"*. A v1.4.40 acendeu os
tiles sem "desligado" e deixou dois apagando (o fundo da letra e o giro); os dois
já tinham o estado no DESENHO, então a luz era a segunda cópia da mesma resposta
— dita na única tinta que este app já reserva para outra coisa. **Apagado aqui
quer dizer INDISPONÍVEL** (`opacity: .3` + `disabled`), e é a queixa da v1.4.25.

**A consequência para o próximo tile é dura, e é a soma das duas remoções:** a
palavra do estado saiu na v1.7.2, a cor saiu na v1.7.6, e o desenho é o único
canal que sobrou. *Um estado que não caiba num desenho não cabe nesta grade.*

**A fileira do aparelho começa sozinha** (`#shareAppTile { grid-column: 1 }`): a
v1.7.6 media a última fileira CHEIA, e aquilo era um atalho verdadeiro enquanto o
grupo do aparelho tinha exatamente três tiles. O oráculo mede a propriedade (o
grupo do aparelho começa uma fileira nova), não o atalho.

**Os tiles que dependem da ponte são `hidden` um a um fora do app**
(`pacoteRenderTiles`): Saída de áudio, Compartilhar e Transferir — o seletor do
Android, o "Salvar como" do SAF e o canal de bytes só existem lá, e um botão que
só sabe não funcionar é pior que botão nenhum. A **contagem de uso** saiu daqui
na v1.4.41 e, uma versão depois, saiu do app inteiro: ver "A contagem de uso"
abaixo.

**O TÍTULO DO GIRO DIZ ONDE** (v1.4.41): *"Girar no telão"*, e o `title`
completa pela negativa (*"não gira o app nem a tela do celular"*). "Girar"
sozinho, numa folha de Configurações, lê-se como o giro da INTERFACE — que é o
que um controle com esse nome faz em quase todo app — e aqui é o oposto: a tela
do celular fica como está e quem gira é a mídia projetada.

As três regras do tile, escritas por inteiro no `index.html`:

1. **O ÍCONE DIZ O ESTADO; o TÍTULO diz o assunto.** Quem tem dois estados tem
   dois desenhos, trocados por `.ico-base`/`.ico-alt` — a mecânica da cortina
   (`.pv-fab`), e pelo mesmo motivo: a folha do documento não atravessa a
   árvore-sombra de um `<use>`.
   **Quem troca o desenho é `.qs-alt`, e não `.qs-on`** (v1.4.40): são duas
   perguntas — *"qual desenho?"* e *"está ligado?"* — e enquanto foram a mesma
   classe um tile sempre aceso ficaria preso no desenho alternativo.
2. **NADA DE TEXTO ALÉM DO TÍTULO** (v1.7.2). A `.qs-estado` — a segunda linha,
   com o estado por extenso — existiu da v1.4.38 até aqui, com a razão escrita:
   *um ícone sozinho responde por CONVENÇÃO, e convenção é o que se erra num app
   aberto três vezes por semana*. Ela saiu a pedido do operador: *"remova o
   subtítulo dos botões das configurações, todo tipo de informação além do nome
   deve ser representada pelo ícone"*.

   **A informação não foi removida; ela mudou de canal**, tile a tile:

   | tile | o que a palavra dizia | quem responde agora |
   |---|---|---|
   | tema, preenchimento, fundo da letra | `Escuro`, `Ajustar`, `Mostrar` | o par de desenhos, que eles JÁ tinham |
   | wallpaper | `Padrão` · `Própria` | o par NOVO: o rolo vazio × o rolo cheio |
   | girar | `0°` … `270°` | o próprio ícone, GIRADO pelo `data-estado` (e desde a v1.7.6 ele é um QUADRO DE PAISAGEM) |
   | histórico, compartilhar | `Abrir`, `O app` | nada — eles não tinham estado |
   | exportar, importar | `42%` | o ARO no lugar do ícone; o NÚMERO voltou para o PRÓPRIO TÍTULO na v1.7.3 (ver abaixo) |

   O GIRO não ganhou quatro desenhos — a v1.4.38 mediu que quatro desenhos que
   só diferem pelo ângulo não se distinguem a 22px, e isso continua verdade. O
   que ele ganhou foi o MESMO desenho na posição que ele descreve, com
   `transition`: é vendo o ícone VIRAR sob o dedo que se lê o que o toque fez.

   **E na v1.7.6 esse desenho passou a ser um QUADRO DE PAISAGEM**
   (`#icoPaisagem`), a pedido: *"use um icone de picture, paisagem. O próprio
   quadro vai girar e vai ser mais intuitivo que um seta circular rodando, pois
   vai literalmente representar em qual posição está a paisagem"*. **O mecanismo
   não mudou uma linha; mudou o que ele vira.** Uma seta girada é a AÇÃO
   desenhada duas vezes (ela já significa *"gire"*), e a 90° é só uma seta
   apontando para outro lado; um quadro girado é o ESTADO.

   O desenho é **assimétrico nos dois eixos, de propósito**, e essa é a
   exigência dura: sem isso 0° e 180° ficam idênticos, e 90° e 270° também —
   quatro estados em dois desenhos. O sol no ALTO e o morro EMBAIXO resolvem o
   vertical; o sol à DIREITA e o morro à ESQUERDA resolvem o horizontal, e a
   proporção o reforça.

   **O MORRO NÃO ATRAVESSA O QUADRO DE PAREDE A PAREDE, e isso foi MEDIDO:** um
   pico que toca as duas paredes com pouco céu acima é a ABA DE UM ENVELOPE, e a
   180° o desenho vira o glifo universal de e-mail — quatro candidatos
   renderizados a 22px e a 58px, e os três que atravessavam liam-se assim. Aqui
   ele ocupa a metade esquerda e a de baixo, e sobra CÉU: é o céu que faz um
   quadro ser uma paisagem.

   E ele **não é o `#icoImagem` do tile vizinho**, que é a armadilha que o
   `#icoWallpaper` já pagou nesta mesma grade — as três diferenças sobrevivem a
   22px: quadro bem mais LARGO (21×13 contra 17×14), o SOL À DIREITA (lá ele
   está à esquerda) e um PICO SÓ, na metade esquerda, contra o recorte irregular
   que atravessa o outro inteiro.

   O WALLPAPER ganhou o par porque era o único de dois estados sem nenhum. A
   razão de não ter também continua válida, e é ela que decidiu a FORMA do par:
   um desenho de "foto" viraria o `#icoImagem` de outro tile da mesma grade, e o
   par não sai daí — sai do próprio rolo.

   O ESTADO CONTINUA DITO fora da tela: `pintarTile` escreve o `aria-label` como
   `Título: Estado`. Quem lê a grade por leitor de tela tinha só "Tema", que não
   responde nada.

   **A consequência para o PRÓXIMO tile é dura:** um tile cujo estado não caiba
   num desenho não cabe nesta grade. Não há mais onde escrever a palavra, e
   devolvê-la para um só devolve a segunda linha a todos — a grade tem altura
   comum.

   **E O TÍTULO EMPRESTA A SI MESMO** (`falarNoTile`, v1.7.3), que é outra
   coisa: a segunda linha era PERMANENTE e descrevia o repouso; esta é o próprio
   título, por alguns segundos, e volta. É a mecânica do `#otaRow`
   (`falarNoOta`) — e a do "Guardar como pacote" até a v1.8.53, que a perdeu ao
   virar botão de símbolo —, e a regra dela está na lista de canais de resposta
   do `controle.js` desde a v5.207 — *"o
   rótulo do controle empresta a si mesmo por alguns segundos e volta"*. Foi por
   ela que o cartão sobre a preview saiu do caminho da exportação: aquele canal
   é o do que ACONTECERIA NA PREVIEW, e uma exportação acontece no botão.

   O rótulo de origem mora no **`data-nome` do nó**, e não num `WeakMap` de
   módulo: `pacoteRenderTiles()` roda no topo do arquivo, na carga, e o
   `pintarTile` leria a constante antes da linha que a declara — zona morta
   temporal, e o app não abre.
3. **A COR NÃO DIZ ESTADO NENHUM: TODO TILE É ACESO** (v1.7.6). `qs-on` é
   `--btn-accent` + `--accent`, a gramática de INTERRUPTOR LIGADO da paleta —
   e, desde a v1.8.95, também a de ESCOLHA ENTRE ALTERNATIVAS, que desceu para
   o MESMO par: foi este tile o modelo que o operador apontou ao tirar o denim
   (`--accent-fill`) das seleções e reservá-lo aos BOTÕES.

   A v1.4.38 lia o aceso como *"o estado não é o padrão"*; a v1.4.40 acendeu os
   tiles sem "desligado" e deixou DOIS apagando (o fundo da letra e o giro); e a
   v1.7.6 encerrou a distinção, a pedido do operador: *"todos os botões devem
   ter o mesmo azul de ativo, não temos mais essa diferença, toda diferença de
   estado é pelo icone, não pela cor"*.

   **Os dois que apagavam já tinham o estado no DESENHO** — a imagem riscada, e
   o quadro na posição em que a mídia está —, então a luz era a segunda cópia da
   mesma resposta, gasta na única propriedade que este app já usa para outra
   coisa: **apagado quer dizer INDISPONÍVEL** (`opacity: .3` + `disabled`), a
   queixa exata da v1.4.25.

   **`qs-on` e o parâmetro `aceso` FICAM.** O que morreu foi a política de
   usá-los para dizer estado, não a capacidade de apagar um tile que de fato
   esteja indisponível — quem passar `false` ali está dizendo isso, e é assim
   que se lê.

   **O que se perde está dito:** a grade não responde *"o que eu deixei mexido
   aqui?"* de relance. Quem respondia era a palavra do estado (fora na v1.7.2) e
   depois a luz (fora agora); hoje responde o DESENHO de cada tile, um a um.

   **Um tile EM CURSO não apaga** (v1.7.2, `.qs-trabalhando`): exportar e
   importar ficam `disabled` enquanto trabalham, e a folha do agente esmaece um
   botão desabilitado em alguns motores. Aqui isso seria dizer INDISPONÍVEL
   sobre um botão que está justamente trabalhando — daí o `opacity: 1` explícito
   e o ARO no lugar do ícone. O aro é a MESMA declaração do `.dl-ring` (um
   desenho, dois consumidores), com o tile pondo só a geometria; escrevê-lo de
   novo seria uma segunda opinião sobre o mesmo anel.

   (A v1.4.40 tinha INVERTIDO o aceso do **fundo da letra**, que marcava o
   estado fora do padrão e passou a marcar a função ligada. A inversão morreu
   com a política na v1.7.6 — hoje ele é aceso nos dois estados, e quem responde
   é o par de desenhos que ele já tinha.)

**Quem pinta é `pintarTile(el, estado, rotulo, aceso, alt)`, e é um ponto só** —
o `data-estado`, o `aria-label`, o aceso e o desenho saem da mesma chamada, e é
pelo `data-estado` que os oráculos perguntam (nunca pela classe, que é
aparência). O `rotulo` continua sendo o estado por extenso; o que mudou na
v1.7.2 é o DESTINO dele, que era a `.qs-estado` e passou a ser o `aria-label`.
O **histórico** é o único que recebe o `qs-on` no HTML, porque é o único que
nenhuma função pinta: ele não tem estado — abre uma folha e pronto. Os tiles são
pintados **no `load()`**, não só ao abrir a folha: um segmentado carregava o
valor de cada opção no HTML (`data-fit`) e já dizia a verdade antes de alguém
olhar; um tile só diz o que a pintura escreveu. O da **Medição** fica de fora
dessa regra — ele é uma ida à ponte, e `load()` roda dezenas de vezes por culto.

**O MODO DO APP É UM INTERRUPTOR QUE DESLIZA** (`#appModeSeg`, `.qs-modo`
dentro da `.fade-row--modo`, v1.4.43), com o trilho medindo exatamente a grade
de tiles (v1.4.44) e **a palavra DENTRO de cada metade** — "Modo simples" e
"Modo avançado" (v1.7.2). O rótulo solto acima dele saiu a pedido: *"remova o
título unificado de 'modo do app', ao invés disso, use texto individual dentro
de cada botão"*. Ele era o único texto sem controle desta folha (a v1.4.44 tinha
gasto um lote centrando-o), e o que ele dizia as duas metades passaram a dizer
sozinhas. `data-mode="simple"` é o mesmo valor de sempre: o que mudou é o
RÓTULO na tela, e o resto do app continua chamando o modo de Fácil
(`.simple-*`, `mode-simple`). Ele continua sendo um SELETOR e não um
tile — as duas opções ficam à vista, com ícone e palavra —, mas o desenho mudou
a pedido do operador: *"simplifique o design do agrupamento e botões de fácil e
avançado, eles estão com muitas camadas e tons de grupos. faça eles do tipo
toggle onde ele desliza de um lado para o outro"*.

**Eram QUATRO tons empilhados** para uma escolha de duas posições: a folha
(`--panel`), o cartão em destaque (`--camada`), a superfície afundada de cada
botão (`--surface`) e o denim cheio (`--accent-fill`) do escolhido. Hoje são
**DOIS**: o trilho e o polegar — e o polegar veste `--btn-accent` desde a
v1.8.95, com o rótulo escolhido em `--accent`, porque ESCOLHIDO deixou de ser o
denim. O cartão saiu — aquela linha tinha peso por TOM e por
TAMANHO, e passou a ter peso por **movimento**, que nenhuma das irmãs tem e que
não gasta degrau da escada de camadas.

- **O polegar é um `::before` do trilho**, não uma terceira caixa no HTML. Ele
  mede metade do trilho menos o respiro, então `translateX(100%)` o encaixa na
  outra metade **sem conta nenhuma em runtime**: uma largura em porcentagem se
  resolveria contra o trilho, e o `translateX` de um elemento posicionado se
  resolve contra a largura DELE. `transform` e não `left` — `left` devolve a
  animação ao layout.
- **`grid` de duas colunas iguais, não `flex: 1`.** Com o polegar medindo metade
  exata, as duas metades do conteúdo têm de medir a mesma coisa por CONSTRUÇÃO;
  `flex: 1` distribui a SOBRA, e "Avançado" é mais longo que "Fácil".
- **O estado vive no `data-modo`** do trilho, escrito por `renderAppModeSeg` — a
  mesma disciplina do `data-estado` dos tiles. Escrito só na abertura, o polegar
  ficaria parado no modo de ontem enquanto o `.active` diria o certo.
- **`--text` e não `--muted` no rótulo apagado**: `--muted` sobre o trilho dá
  3,47:1 no tema claro, abaixo do piso de 4,5:1. O que separa as metades é o
  POLEGAR; esmaecer o não escolhido diria "indisponível", que nesta paleta é
  outra palavra.

**A TROCA FECHA A FOLHA, DEPOIS DO POLEGAR** (v1.12.29, revogando a v1.4.43,
que a mantinha aberta): *"Ao trocar entre o modo simples e o modo avançado,
feche a janela de configurações. Mas tome cuidado para que o fechamento da
janela só aconteça depois da animação de movimento do botão … Para que a tela
não pisque de repente"*. `trocarModoPelaFolha` faz em três tempos:

| tempo | o que acontece |
|---|---|
| toque | o POLEGAR desliza (só `data-modo`/`.active` do trilho; `appMode` ainda é o antigo) |
| fim da transição do polegar | `setAppMode` **e** `closeFadePopup` no MESMO quadro: a tela troca por baixo do véu, que esmaece com a folha |
| `--dur-lenta` depois | a folha saiu pela transição de sempre |

- **O prazo é LIDO do CSS** (`msDaTransicao(trilho, '::before')`: duração +
  atraso), nunca escrito no JS. Com `prefers-reduced-motion` a folha zera a
  transição do polegar e a troca é imediata.
- **Trocar DEPOIS de a folha sair é o defeito do pedido:** a tela velha aparece
  e troca seca.
- **Um segundo toque na janela re-mira**; de volta ao modo em vigor, nada troca
  e a folha fica.

**A folha não se mexe enquanto o polegar anda** por onde MORA: o `#fadePopup` é
`position: fixed` e vive **fora do `<main>`**, que é o que o
`body.mode-simple main { display: none }` esconde. Oráculo: o bloco da troca de
modo do `smoke.mjs` (a ordem: modo antigo e folha aberta no meio do polegar;
modo novo e folha fechando no fim; prazo igual ao lido do CSS).

#### O cartão invisível, e o rótulo que era o único texto solto (v1.4.44)

**MEDIDO** numa viewport de 430: o trilho ia de 27,2 a 402,8 (375,6px) e a grade
de tiles, de 14,4 a 415,6 (401,2px) — **12,8px de recuo de cada lado**. Foi o
relato do operador (*"parece não estar alinhado com os outros botões abaixo"*), e
o culpado **não desenha nada**: a `.fade-row` pinta `--panel`, o MESMO tom da
folha, então o cartão é invisível e o que se vê é só o `padding` dele.

**Um cartão invisível que só desalinha não é um cartão: é padding.** A linha
virou o que já parecia ser — uma legenda e um trilho.

- **`background: none` E o `padding` zerado**, os dois. Só o padding deixaria a
  regra de R1 (a `.fade-row` está na lista) descrevendo um bloco que não pinta
  mais nada. Ela **continua na lista**, e isso está certo: a lista é o que AFUNDA
  a superfície dos filhos, e quem afunda aqui é a folha — o que a linha não faz
  mais é pintar por cima dela.
- **O rótulo é CENTRADO.** Ele encabeça um controle de duas metades simétricas e
  é o único texto solto desta folha; à esquerda ele apontava para a metade
  "Fácil", que é uma das duas escolhas. O oráculo mede o TEXTO PINTADO (um
  `Range` sobre o nó de texto), nunca a caixa do `<span>`: `.fade-row--fit` é
  `align-items: stretch`, então ela ocupa a linha inteira nas duas versões.

**O WALLPAPER É UM `<label>`** sobre o `<input type="file">`: é a ativação
nativa do rótulo que abre o seletor do aparelho (invariante 6 — sem o
`onShowFileChooser` do `ControleChromeClient` o toque não faria nada, sem erro
no console). Com uma imagem própria no ar o toque volta ao padrão, e quem
cancela a ativação é um `preventDefault()` no ouvinte. Trocar uma imagem por
outra são **dois toques**, e esse é o preço declarado de o wallpaper caber num
tile como os outros.

O rodapé: **estado do telão**, e a fileira de três — a **versão**, o
**Registro** e o **Pedir ajuda**.

### O rodapé são TRÊS BOTÕES IGUAIS (v1.8.65, revogando a v1.4.44)

Pedido do operador, em quatro metades: *"coloque a versão, o registro e o pedir
ajuda... igualmente distribuídos horizontalmente"*, *"pode dar um destaque em
negrito para o número da versão"*, *"coloque os ícones tanto do registro quanto
do pedir ajuda à direita de seus respectivos textos"*, *"faça os três serem três
botões separados, no mesmo estilo do botão de 'pedir ajuda'. e remova o fundo
cinza desse rodapé"*.

**Ele deixou de ser uma SUPERFÍCIE e virou uma FILEIRA**, e é isso que revoga as
duas rodadas anteriores. A v1.4.43 unificou três desenhos em duas pastilhas e a
v1.4.44 as fundiu numa faixa só — *"a superfície é a faixa, e o que mora nela é
texto e um alvo"*. Sem `--surface-2` não há faixa a ser superfície: saem com ela
o `padding`, o `border-radius` e o `min-height`, e a altura volta a ser a dos
filhos (`--hit`, por regra do `.diag-btn`).

| na fileira | o quê |
|---|---|
| 1º | `#versaoBtn` — o número em `--fw-forte`, e o toque abre *"O que mudou"* |
| 2º | `#contatoBtn` — "Pedir ajuda", ícone à direita |

(O `#diagSave` — "Registro" — foi o 2º até a v1.12.29, quando saiu a pedido do
operador: a porta do Registro é só a da folha da Verificação.)

- **A divisão é `flex: 1 1 0`, base ZERO** — é o que iguala. `1 1 auto` daria a
  cada um a própria largura mais um pedaço, e "Pedir ajuda" sairia sempre maior
  (MEDIDO a 390×1×: 117,7 nos três contra 107,8 / 132,8 / 152,6).
- **Não há piso escrito, e a ausência é decisão MEDIDA.** Um
  `min-width: max-content` foi escrito e removido no mesmo lote: um item flex já
  nasce com `min-width: auto`, e com o `white-space: nowrap` do `.diag-btn` isso
  é o rótulo inteiro — forçar um dá largura por largura o mesmo que o outro. Sem
  piso, a divisão igual vale enquanto couber; apertando, os mínimos automáticos
  vencem e as larguras saem desiguais com cada rótulo íntegro; apertando mais, o
  `flex-wrap` empilha. Nenhum dos três degraus corta uma palavra.
- **O recuo do `.diag-btn` caiu a `--sp-3`** (era `--sp-5`, *"o mesmo respiro de
  bloco que a faixa reserva à esquerda"* — e essa folga saiu com a pastilha).
  Com três dividindo a linha, o recuo sai da largura do RÓTULO: MEDIDO, o degrau
  põe 360×1,25× e 430×1,5× numa linha só, onde antes saíam em duas.
- **Os TRÊS vestem o preenchido**, revogando a v1.8.51 (*"só um deles o veste:
  guardar o Registro é o PASSO, falar é o DESTINO"*). Aquilo respondia ao relato
  de então — o contato precisava se destacar de um vizinho apagado. Numa fileira
  sem fundo o que está em jogo deixou de ser a hierarquia entre eles e passou a
  ser cada um se ler COMO BOTÃO, e um `background: none` sobre a folha não se lê.
- **O ícone à direita é a ORDEM DOS FILHOS**, nunca `row-reverse`: o segundo
  daria o mesmo desenho e mentiria para o leitor de tela, que percorre o DOM.
- **O PREÇO está medido e é de contraste:** o botão contra a folha caiu de
  **1,94:1 para 1,77:1** no escuro — o cinza que saiu clareava o fundo atrás
  dele. Os dois estão abaixo do piso de 3:1 para superfície, e o que mantém o
  controle identificável é o RÓTULO, que mede 6,54:1 no escuro e 7,70:1 no
  claro. No tema claro o botão contra a folha mede 7,70:1.

#### O toque na versão abre "O que mudou" (v1.8.65)

*"para o botão de versão, ao tocar, ele mostra o popup de atualizações que
ocorreram na última atualização (ou um log em lista das atualizações que tiveram
em cada versão recente)"*.

**A fonte é o `notas.json` do bundle INSTALADO, e não o `otaNotas`** — e as duas
têm a mesma FORMA (`[{versao, itens}]`), o que faz a troca compilar, renderizar
e falhar só no caso normal: o `otaNotas` é o que vem NA atualização oferecida, e
fora de uma atualização pendente ele está VAZIO. O arquivo viaja no bundle de
propósito (ver o OTA), então o app tem em disco a linha do tempo do que ele É.

- **Teto de CINCO versões**, e o rodapé do diálogo só aparece quando há corte a
  anunciar: dizê-lo com quatro guardadas descreveria um recorte que não houve.
- **O prefixo `vX.Y.Z ·` vai em TODA linha** — ao contrário da lista do OTA, que
  o omite porque lá o título já diz de que versão se fala. Aqui são várias, e
  sem ele as mudanças de três lotes viram uma lista só, sem fronteira.
- **`cancelText: null`**: ele conta, não pergunta.
- **Falhar não pode ser mudo.** Sem o arquivo a MENSAGEM muda e aponta o
  Registro ao lado; um diálogo vazio é indistinguível de um botão quebrado.

#### O COPIAR do Registro saiu (v1.4.44)

*"pode remover o sistema de copiar registro. o registro está cada vez maior e
mais completo e acaba por ele ficar longo de mais para compartilhar via chat de
texto."*

A área de transferência é o caminho que **corta o texto no meio sem avisar** —
foi esse relato que criou o salvar em arquivo na v1.2.16 —, e o Registro só
cresceu desde então. Ficou a porta que não corta.

- **O `copiarTexto`, o `.log-copy` e o `#icoCopiar` FICAM**, com o consumidor que
  os justifica: o `#castUrlCopy`, o endereço da transmissão — curto, e feito para
  ser digitado noutro aparelho. A regra geral mudou de forma e não de intenção:
  todo campo de log continua nascendo com uma porta de saída, e **qual porta
  depende do TAMANHO**.
- **CONSEQUÊNCIA DECLARADA:** num navegador o rodapé não tem mais como exportar
  o Registro (o salvar depende da ponte, e é `hidden` fora do app). É o certo —
  ali metade dos blocos dele nem existe. O rótulo acompanha o botão pelo mesmo
  motivo: uma palavra sozinha, sem alvo ao lado, é um controle que não existe.

### A contagem de uso NÃO TEM MAIS CHAVE (v1.4.42)

Ela foi um tile do painel (v1.4.1–v1.4.40) e uma linha do rodapé do Registro
(v1.4.41). Saiu inteira a pedido do operador: *"descarte a opção de contagem de
uso como opcional, deixe sempre ativo, não preciso do sistema de
exclusividade"*.

**O que saiu:** a linha `#farolRow` e o `renderFarolLinha`, o `farolContar` da
ponte (shell 61 — encolher a ponte é um lote APK + web publicado JUNTO, com
`shellTag`), o `Farol.definirContar` e a leitura da preferência em
`Farol.contar`. Os símbolos `#icoMedicao`/`#icoMedicaoOff` foram junto: um
`<symbol>` sem consumidor viaja no bundle do OTA e não desenha nada em lugar
nenhum.

**O que fica:** `farolEstado`, agora **só leitura**, alimentando a linha
*"Alcance:"* do Registro — que responde *"o farol chegou a acender?"*, a
pergunta que faz aquele texto ser copiado. E a exclusão do **build debuggável**,
que nunca foi opção de ninguém: emulador e `assembleDebug` acendem num contador
separado por `FLAG_DEBUGGABLE`.

**Por que o APK era obrigatório.** A chave já gravada em quem a usou continuaria
sendo lida por um shell antigo: um aparelho marcado *"fica de fora"* ficaria fora
da contagem **para sempre**, sem tela para desmarcar. É o `Farol.contar` do APK
novo que o devolve — daí o `shellTag` segurando o bundle até a Release existir.

**E o pedido anterior (v1.4.41), de a chave morar na página do site, não era
possível** — fica registrado porque a pergunta volta:

| | app | página de alcance |
|---|---|---|
| origem | `appassets.androidplatform.net` | `audiovisualiasd.com.br` |
| onde a chave mora | `SharedPreferences` (`Farol.kt`) | `localStorage` do navegador |
| quem lê a do outro | ninguém | ninguém |

E não há terceira via: o app **não tem intent-filter de URL** (só `MAIN` e
`SEND`/`SEND_MULTIPLE`, ver `AndroidManifest.xml`). Abrir uma porta de entrada
EXPORTADA que troca uma chave de privacidade é pior que a linha — é a classe de
risco que o KDoc do `ShareIntake` já nomeia.

### UM registro só

Um cabeçalho de **identificação** (versões da base, do shell e da ponte; estado
do telão; alvo de espelhamento; aparelho), **a linha do tempo** dos dois
processos em ordem de relógio, e só então os blocos de verificação por recurso
(extração do YouTube, cifra, espelho, áudio, Séries,
sorteio). O cabeçalho existe por razão prática: um log colado sem contexto obriga
a primeira resposta a ser sempre a mesma pergunta.

**A POSIÇÃO DA LINHA DO TEMPO É O RECURSO** (v1.1.19). Ela era o ÚLTIMO bloco,
atrás dos sete de verificação — num Registro real começava na linha ~150, que é a
definição operacional de ENTERRADA. Ela responde *"o que aconteceu no culto?"*,
que é a pergunta que faz alguém copiar isto; os outros respondem *"por que ESTE
recurso se comportou assim?"*, que só se pergunta depois de saber o que
aconteceu. Ela é montada no primeiro `renderDiag` e só ganha as linhas do telão
no segundo, quando o `diag-ask` responde — a ORDEM dos blocos não muda entre os
dois. Oráculo: `registro.test.mjs`, medindo POSIÇÃO NO TEXTO (é o texto colado
que o operador manda, e é nele que "está no fim" quer dizer alguma coisa).

**O REGISTRO É SOBRE O CULTO, não sobre o catálogo** (v1.1.19). Ele responde a
quatro perguntas, e é por elas que se decide o que entra:

| pergunta | o que a responde |
|---|---|
| *o que eu toquei antes disso?* | `entrou em cena: <nome> ← fila`, `parou a mídia (<tipo>)` |
| *quando a conexão mudou?* | `TV conectada` · `TV DESCONECTADA` · `TV mudou` · `a projeção se reapresentou` · `transmissão RECUSADA: <frase do shell>` · `rede do celular: OFFLINE/online` |
| *o que quebrou?* | `ERRO DE MÍDIA` (preview **e** telão), `PAUSA ESPONTÂNEA` + o placar da retomada, `transmissão falhou no telão` |
| *quem eu sou?* | o cabeçalho, mais `app aberto · web vX · shell vY` como primeira linha do anel |

Uma varredura de catálogo (as **Séries**) responde a uma quinta pergunta, de quem
AJUSTA A REGRA meses depois. Ela cabe — resumida —, mas não pode empurrar as
outras quatro para baixo: medido num aparelho, o bloco nominal ocupou ~140 de
~170 linhas de uma cópia. Ver a seção das Séries no `CLAUDE.md`.

**AS TRANSIÇÕES, nunca o estado.** O cabeçalho já diz o que está conectado
AGORA; o que a linha do tempo acrescenta é QUANDO mudou — um dongle que oscila
rende uma escada de linhas que É o diagnóstico. Por isso `renderDisplayStatus`
compara com `lastDisplays` **antes** de sobrescrevê-lo, e `ligarEspelho` só
carimba a RECUSA (um culto em que a transmissão sobe de primeira não produz linha
nenhuma).

**A LINHA DO TEMPO NÃO TRUNCA.** `diagLinhas` é o anel do celular
(`DIAG_MAX_C` = 200, porque 40 cobriam minutos e um culto dura duas horas) mais
as 60 linhas que o telão manda no `diag-dump`: até 100 já estão na mão quando
`eventosDiag` roda, e o `.slice(-16)` jogava fora até 84 — **incluindo as que o
`diag-ask` acabara de ir buscar pela rede**. O teto existia para não estourar um
visor que não existe mais (ver abaixo), e comprimento não custa tela nenhuma. O
que encurta sem apagar é o **colapso da repetição CONSECUTIVA** (`visibilidade
×7`): sete iguais não dizem mais que a contagem. Ele exige `t2 == null` nos dois
lados — duas linhas com posições diferentes não são a mesma linha.

- **Copia-se o registro MONTADO, nunca o visível.** `diagTexto` é a ÚNICA fonte —
  não existe mais visor (`#diagBox` saiu na v5.207: 240 px empurrando para fora
  da tela as linhas que o operador de fato ajusta, para exibir a 0,68 rem um log
  cujo consumidor é um humano A DISTÂNCIA). Um botão de copiar que lesse o DOM
  emudeceria por inteiro.
- **`renderDiag` é assíncrona e roda duas vezes ao abrir a folha** (uma com o que
  já se tem, outra quando a resposta do telão chega) — daí a **guarda de
  sequência**, mesmo padrão do `loadSeq` do stage: sem ela a primeira pode
  terminar depois da segunda e sobrescrevê-la com a linha do tempo SEM os eventos
  do telão, que é justamente o que se foi buscar.
- Se um dia voltar uma caixa de log: **`white-space: pre-wrap`, não `pre`** — a
  linha do YouTube tem centenas de caracteres e viraria rolagem horizontal.

### Wallpaper personalizado

A cortina do telão aceita uma **imagem escolhida pelo operador** no lugar do
desenho padrão — em **Configurações** (a engrenagem do cabeçalho):
*Padrão* / *Escolher imagem* (nessa ordem desde a v5.188: o estado de partida
à esquerda, a ação à direita, como nos demais segmentados).

- **O PADRÃO é o símbolo oficial da IASD** (v5.188): branco, cor sólida única,
  centrado sobre um denim profundo quase-preto — as regras do
  identity.adventist.org (uma cor só, fundo contrastante, espaço livre maior
  que a altura do símbolo). O desenho inteiro mora em
  **`shared/wallpaper-padrao.svg`**, fonte ÚNICA usada pelo `.wallpaper` do
  Display, pelo `.pv-wall` da preview e pelas telas da rede (o bundle servido
  inclui `shared/`). A URL do SVG fica **nas duas folhas consumidoras**, com o
  mesmo caminho relativo — não no token `--wallpaper`, porque um `url()`
  substituído por `var()` resolve contra a PÁGINA, não contra a folha, e cada
  página o quebraria para um caminho diferente (foi o primeiro defeito da
  própria v5.188). O token guarda só a cor de base que aparece enquanto o SVG
  carrega. A marca de TEXTO "Audio Visual IASD"
  (`.wallpaper-brand`/`.pv-brand`) saiu com o gradiente verde: o símbolo é a
  identidade, e um texto por cima só competiria. (E a lição que o SVG carrega
  no próprio comentário: comentário de XML não aceita hífen duplo — um
  `--token` citado ali dentro invalida o arquivo INTEIRO, sem erro em lugar
  nenhum, só um fundo liso.)
- O blob mora no **state `wallpaper`**, que Controle e Display compartilham,
  então o comando `wallpaper` **não carrega payload**: só avisa que mudou, e
  cada lado relê do IDB. (Mandar a imagem pelo canal seria copiar megabytes a
  cada troca, sem ganho nenhum.) **Exceção: as telas da rede** não têm esse
  IDB — para elas o funil `telaEnriquecer` resolve o blob e manda um SEGUNDO
  comando com `__wp` (a URL `/m/` da imagem empurrada), ou o sentinela
  `__wp:'padrao'` quando a troca foi de volta ao padrão; e quem CONECTA no
  meio recebe o wallpaper endereçado no próprio `display-ready`
  (`telaReenviarPreferencias`, junto com `lyricsbg` e `fit`).
- A imagem é **reduzida para no máximo 1920×1080** (`fitWallpaperImage`) antes
  de ser guardada. O operador escolhe uma foto do próprio celular (12 MP);
  guardar e decodificar isso a cada abertura seria desperdício puro — a
  cortina nunca passa da resolução da TV. Imagens que já cabem são guardadas
  como vieram, sem recompressão.
- CSS: a imagem entra como `background-image` inline (vence o
  `background-image` do SVG padrão na folha) com `background-size: cover` —
  limpar o inline devolve o desenho padrão. Aplicado em `restore()` (Display)
  e no `init()` (Controle), além do comando ao vivo.

**Botão ⏹ ("Parar e limpar"):** envia `clear` (volta ao wallpaper) mas mantém
`currentId` — o ▶ recarrega e reproduz do início.

**Botão de playlist (`#plBtn`):** mora na própria linha de transporte
(`.transport`), à direita do botão de repetição — não é mais uma aba
separada (`.tabs`); abre o mesmo bottom-sheet com a fila de reprodução de
sempre. Reaproveita o tamanho/estilo de `.t-btn` (a linha de transporte
cresceu de 5 para 6 botões, cada um um pouco mais estreito).

**O selo de contagem (`#plCount`) diz o TOTAL da fila, e só aparece a partir do
2º item** (v1.8.80, revogando a regra de contar os itens ALÉM do primeiro):
*"esse número deve representar o número total de itens na playlist. É claro, se
houver apenas um item, ainda não precisa mostrar o número"*. A régua antiga
(`count - 1`) fazia o selo dizer **1** com duas mídias na fila e discordar do
contador da própria folha, que sempre disse o total — duas contagens da mesma
lista, na mesma tela. O limiar (`> 1`) é o que fica: com a mídia atual sozinha, a
fila é a reprodução avulsa e não merece um número.

**O ÍCONE NÃO MUDA DE COR** — houve uma classe `.has-items` que o tingia de
`--accent` no mesmo caso, e a regra dela saiu do `controle.css` na v1.5.0 com o
rodapé; a escrita sobreviveu sem consumidor até a v1.8.79, com este capítulo
prometendo um destaque que não acontecia há sete meses. Quem diz "há fila" é o
SELO, e só ele.

### Girar a mídia (v5.142)

Vídeo gravado de lado no celular chega **deitado** no telão. Não havia o que
fazer: a mídia é do operador, reencodar no meio de um culto não existe, e "grave
de pé" não conserta um arquivo pronto.

- **Um botão que AVANÇA 90°**, em Configurações, e não quatro segmentos: ninguém
  pensa em "270°", pensa em "gira mais uma vez até ficar de pé", e são no máximo
  três toques até qualquer orientação. O rótulo mostra o ângulo vigente.
- **A caixa troca de eixo antes de girar** (`aplicarGiro` em `shared/stage.js`),
  e é isso que separa este código de um `transform: rotate()` solto: o `<video>`
  ocupa o palco inteiro (W×H) e o `object-fit` encaixa a mídia **nesse**
  retângulo. Girando só o transform, o encaixe teria sido calculado para o
  retângulo errado — um vídeo retrato girado para paisagem apareceria minúsculo
  no meio. Trocando `width`/`height` primeiro, a conta é feita no retângulo em
  que a mídia vai de fato aparecer.
- Por depender do TAMANHO do palco (que muda com a rotação do aparelho, a
  resolução da TV e a preview trocando de casa entre os modos), há um
  `ResizeObserver`; e `applyMedia()` o repõe, porque um elemento `hidden` não
  tem caixa medível.
- **Persistido** (`state.rotate`) como o preenchimento, e **reenviado ANTES do
  `load`** na reconexão: um telão que volta no meio de um vídeo girado não pode
  mostrá-lo deitado nem por um quadro.
- **Tomou o lugar do "Esticar"**, que saiu: distorcer a proporção é o defeito que
  "Ajustar" e "Preencher" existem para evitar, e ninguém o escolhia de propósito.
  O valor guardado é **migrado** uma vez na carga — sem isso, quem já o tinha
  ficaria com a mídia distorcida e sem nenhum controle na tela que explicasse por
  quê.

### O histórico do culto, em Configurações (v1.2.0 · v1.4.31)

A lista do que **já foi ao telão** — a pergunta que nenhuma outra lista do app
responde. O Cronograma é o que se PRETENDE tocar, a playlist é o que vem A
SEGUIR, e as duas são voláteis (um toque numa mídia da Biblioteca redefine a
fila inteira). O histórico é para quem monta o culto seguinte, ou precisa
repetir um louvor que entrou de improviso e não ficou guardado em lista nenhuma.

**ELE MORA EM CONFIGURAÇÕES desde a v1.4.31** (`#histOpenRow`). Era a sétima
célula da linha de transporte, e aquela fileira é o que se opera DURANTE o
culto; o histórico é o que se consulta ANTES ou DEPOIS. Ele é uma SEÇÃO de
Configurações (`#histSecao`, v1.12.48; era uma folha aberta por cima dela) — ver
"As SEÇÕES de Configurações".

#### O que cada linha guarda

Nome e subtítulo são **cópias**, feitas no instante da projeção — um item pode
deixar de existir entre tocar e ser consultado (a prateleira `avulsos` tem teto
de três, e o coletor recolhe os bytes de quem sai da última lista). Guardar só o
id daria uma lista de linhas em branco no fim de um culto normal.

**Repetição consecutiva não abre linha nova**: `repeat: 'one'` reenvia o mesmo id
a cada fim de faixa, e um louvor em laço durante a oração encheria a lista com
trinta cópias do mesmo nome. O que se atualiza é a HORA, e o `×3` do subtítulo
diz quantas voltas — o mesmo colapso da linha do tempo do Registro.

#### As SESSÕES (v1.4.31)

Pedido do operador: *"armazene os dados entre sessões, separando as sessões.
mantenha os itens usáveis apenas na categoria da sessão atual. para as sessões
antigas, deixe usáveis apenas itens padrões do sistema, como músicas, textos,
links e etc... que não dependem de um arquivo que pode já ter sido excluído,
para não ser obrigado a manter aquele arquivo"*.

Isto **revoga** o *"apagada a cada nova sessão"* do pedido de v1.2.0, e as duas
coisas não se contradizem porque o que substitui o apagamento é a **separação**:
a sessão de hoje fica sozinha no topo, com cabeçalho próprio, e as antigas
abaixo dela.

- **Uma sessão é uma carga do documento** — a única definição que o lado web tem
  como observar. Minimizar não abre sessão nova; fechar e reabrir abre.
- **Ela nasce na PRIMEIRA projeção**, não na carga: um app aberto e fechado sem
  projetar nada não deixa um cabeçalho sobre nada na lista de quem a consultar
  no sábado seguinte.
- **O cabeçalho diz o DIA e a JANELA DE HORAS** (`14 itens · 09:12–10:40`). O dia
  é escrito à mão ("Hoje", "Ontem", `sáb, 23/08`) e não por
  `toLocaleDateString`: os nomes e a ordem dos campos saem dos dados de locale
  do navegador, que variam entre o aparelho e o Chromium do oráculo — e as duas
  formas que mais importam não vêm de locale nenhum. A janela responde o que o
  dia não responde: se a sessão de sábado é o culto da manhã ou o ensaio da
  noite.
- **Guardadas: 12 sessões** (`HIST_SESSOES_MAX`). Um culto por sábado mais dois
  menores na semana dá cerca de um mês, que é o alcance da pergunta.

#### O DIA É UM BLOCO, E A SUBLISTA TEM CORPO (v1.7.5)

Relato do operador: *"ajuste os cards que separam os dias, para que tenham uma
coloração diferente dos cards de itens exibidos naquela seção. Atualmente a
lista está confusa, pois está difícil distinguir as sublistas"* — e, em seguida:
*"caso ache mais correto, utilize o design de corpo e lista que já temos na
biblioteca"*.

**MEDIDO, e era literal:** o cabeçalho pintava `--camada` e a `.row` de cada
linha pinta `--linha`, que dentro desta folha resolve para `--camada` também —
`rgb(48, 66, 84)` no escuro e `rgb(212, 218, 226)` no claro, os DOIS. **1,00:1**,
o mesmo número que a Biblioteca mediu na v1.5.14 entre a tampa de um álbum e as
faixas dele.

**A resposta é a de lá, inteira — e ela tem DUAS metades**, porque o degrau de
tom sozinho não resolve o que o relato descreve: dois tons alternados numa lista
PLANA continuam sendo uma corrida de irmãos.

```
#histList (.popup-list, papel da folha)
  └ li.hist-sessao        ← o BLOCO do dia: pinta o POÇO
      ├ .hist-sessao-bar  ← a barra (sem tom próprio; herda por transparência)
      └ ul.hist-corpo     ← --camada: var(--panel)
          └ li.row-item   ← a LINHA: pousa no PAPEL
```

- **A FILIAÇÃO.** As linhas de um dia moram DENTRO do bloco daquele dia; elas
  eram irmãs do cabeçalho, e um cabeçalho sem corpo não tem como dizer onde a
  sublista dele acaba. É a anatomia da `.coll-group` da Biblioteca, e o `<li>`
  continua sendo da MESMA `<ul>` pela razão de sempre — a folha rola inteira, e
  um cabeçalho fora dela ficaria parado sobre o conteúdo errado. Aninhar não
  muda isso: muda só de quem cada linha é filha.
- **A ALTERNÂNCIA.** Não se acrescenta um degrau: papel (a folha) → poço (o
  bloco do dia) → papel (a linha). Quem RESERVA o tom é o contêiner — a
  `.hist-corpo` declara `--camada: var(--panel)` e a `.row-item` a lê em
  `--linha` —, nunca quem pinta. MEDIDO no par novo: **1,43:1** no escuro e
  **1,35:1** no claro, os mesmos números da Biblioteca e pela mesma razão.
- **O TEMA CLARO é quem fecha a conta:** nele `--panel` é BRANCO e todo o resto
  se agrupa perto de L≈0,70, então o único tom que passa o piso de 1,28:1 contra
  o poço é o próprio papel. Logo um dos dois tem de ser o papel, e a escolha sai
  do que cada um É — o bloco do dia é a MOLDURA de um agrupamento, a linha é o
  CONTEÚDO que pousa nela.
- **A barra NÃO gruda** (a `.coll-group-bar` da Biblioteca é `sticky`): aqui não
  há tampa de nível acima a que se colar, e um cabeçalho grudado num popup que
  já rola inteiro flutuaria sobre a lista de OUTRO dia.

Oráculo: `historico.test.mjs`, nas duas metades e nos dois temas, com as três
reversões medidas — sem a camada reservada o passo cai a **1,08:1** (escuro) e
**1,04:1** (claro); sem o poço do bloco, a **1,00:1**; e com a lista PLANA o
arquivo reprova já na primeira leitura.

#### A gravação sai do caminho quente

Foi este o argumento que manteve o histórico em memória por vinte e nove
versões: o `send` é o ponto por onde toda projeção passa, e uma escrita no
IndexedDB ali é o caminho mais quente do culto.

Ela continua fora dele. `historicoRegistrar` mexe só na memória e **agenda** a
gravação (`HIST_GRAVA_MS`, 2 s), que coalesce a rajada de um culto inteiro numa
escrita a cada dois segundos de silêncio. **`AVDB.updateState`, nunca
`setState`:** só ela espera o COMMIT, e um histórico que perde a última projeção
porque a transação ficou em voo é o defeito que este lote existe para não ter.

**O preço, dito:** os últimos segundos podem se perder numa morte do renderer.
Daí a saída de cena (`visibilitychange`) forçar a gravação pendente — sair da
frente é o instante em que o processo passa a ser descartável.

#### A RECEITA: o que uma sessão antiga ainda oferece

Cada linha guarda, além do registro do fato, o **mínimo para trazer o item de
volta sem depender de um arquivo** (`histReceita`, gravada no instante da
projeção). Três formas, e cada uma responde a uma das coisas que o pedido nomeia:

| forma | o que guarda | como volta |
|---|---|---|
| **cena** (`textos`) | o descritor inteiro (versículo, mensagem, cronômetro) | remontada, sem tocar em byte nenhum |
| **link** (`links`) | o endereço e o id do YouTube | reaproveita um registro que já exista, ou cria |
| **acervo** (`músicas`) | `folder` + `srcName` | PROCURA na coleção — o `id` não serve, um hino reapagado e rebaixado ganha id novo |

**Sem receita** fica o que só existe porque um arquivo foi importado ou
compartilhado — exatamente o que o coletor recolhe, e exatamente o que o
operador não quer ser obrigado a manter.

- **Na sessão ATUAL tudo é usável**, como sempre foi: o registro que acabou de
  tocar está vivo por construção, e a linha cujo arquivo sumiu no meio do culto
  continua sendo marcada com *"Não está mais no aparelho"*.
- **Numa sessão ANTIGA, só o que tem receita** (`histAcionavel`). O que sobra é
  a linha do fato, esmaecida e com **`· só registro`** no fim do subtítulo — uma
  linha que não responde ao toque e não diz por quê é indistinguível de um app
  quebrado.
- **A resolução tenta o ID PRIMEIRO** (`histResolver`): ele é de graça e devolve
  o registro original, que é o caso normal dentro do culto de hoje. Só então
  entra a receita. Um item CRIADO nasce em `avulsos` quando o toque é para
  projetar (a prateleira volátil, com o teto de três) e em `imports` quando o
  operador mandou ao Cronograma — sem lista ele nasceria órfão e o `gcOrfaos`
  da abertura seguinte o apagaria.

#### Limpar

Pedido: *"limpar todo o histórico ou por sessões"*. São dois lugares, e a
distância entre eles é deliberada: o **por sessão** mora no cabeçalho dela, o
**tudo** no rodapé da folha (`#histClear`, na faixa própria que a confirmação
exige — ver `pedirConfirmacaoNaLinha`). Os dois perguntam antes.

**Nenhum arquivo é tocado** — daqui não sai `listRemove` nenhum, e por isso o
coletor não roda: o que se apaga é o registro do que aconteceu. Limpar a sessão
ATUAL a REMOVE em vez de esvaziá-la, e a próxima projeção abre uma sessão nova
com a hora em que ela de fato recomeçou; uma sessão esvaziada guardaria um
cabeçalho dizendo "0 itens" com a hora de um culto que o operador acabou de
mandar apagar.

#### O que a folha NÃO tem

- **Sem excluir e sem reordenar linha:** um fato não se edita, e um destrutivo
  ali apagaria o registro sem apagar nada do aparelho.
- **Sem contador no cabeçalho** (o `.popup-count` da playlist): ali o número é o
  que falta tocar; aqui a lista inteira já o mostra.

