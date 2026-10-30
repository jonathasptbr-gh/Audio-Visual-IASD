<!-- Capítulo de docs/ARQUITETURA-WEB.md. O índice e as regras
     de desenvolvimento ficam lá; este arquivo é só este capítulo. -->

## Controle

**Este arquivo é o HUB do capítulo do Controle**: o mapa das partes, o índice
por assunto e as regras que valem para o Controle INTEIRO (feedback, diálogo,
teclado virtual). Até a revisão A3 (2026-10-30) o capítulo era um arquivo só, de
770 kB; ele foi partido por área, com o texto MOVIDO verbatim (só o nível dos
títulos e os links mudaram). **Abra só a parte da pergunta** — nunca todas.

**Nesta parte:** [As partes](#as-partes) · [Índice por assunto](#índice-por-assunto) · [Feedback (sem alerta flutuante) — e a exceção do salvamento](#feedback-sem-alerta-flutuante--e-a-exceção-do-salvamento) · [Diálogo padrão do app (confirmações / prompts)](#diálogo-padrão-do-app-confirmações--prompts) · [Deslocamento com o teclado virtual](#deslocamento-com-o-teclado-virtual)

### As partes

| parte | o que tem |
|---|---|
| [`CONTROLE-MODOS.md`](CONTROLE-MODOS.md) | Modo Fácil × avançado: o modo pela SESSÃO, a coluna de páginas, as três teclas, o modo bloqueado sem tela, a preview no lugar da conexão; o vídeo do Modo Fácil em tela cheia, a Biblioteca maior, a troca leitura ↔ Biblioteca, o card do nome |
| [`CONTROLE-LAYOUT.md`](CONTROLE-LAYOUT.md) | layout geral (o vão, as sete células, a coluna da direita, o fader, a barra de progresso), o par de botões e os dois botões de slide (a região fora do padrão, a coluna de operação, o selo de camadas, o layout de player), os controles DENTRO do fullscreen, onde o Display roda |
| [`CONTROLE-NAVEGACAO.md`](CONTROLE-NAVEGACAO.md) | uma tela, duas folhas e uma janela: as portas do rodapé, a folha da Bíblia, a barra da Biblioteca e a janela que sobe |
| [`CONTROLE-CONFIGURACOES.md`](CONTROLE-CONFIGURACOES.md) | o tema, o PAINEL RÁPIDO e as seções (tela, transferir), o rodapé de três botões, a contagem de uso, o Registro (UM registro só), o wallpaper, girar a mídia, o histórico do culto |
| [`CONTROLE-TELAO.md`](CONTROLE-TELAO.md) | a abertura (cortina, badge de versão), o que o telão retoma ao reconectar, o toque que responde no instante, todo carregamento é do Controle, a referência da preview, a saída de áudio (o atalho do sistema, a prévia recolhível) |
| [`CONTROLE-BIBLIOTECA.md`](CONTROLE-BIBLIOTECA.md) | abas e Biblioteca: como um item ENTRA no Cronograma (vários destinos), o vazado, a linha da lista (provisória, no ar, o `⋮`, o subtítulo), o rodízio das coleções, a coletânea, o orçamento da lista colapsada, a divisória, o `#listFoot`, deslizar entre abas, a tampa das coleções |
| [`CONTROLE-LISTAS.md`](CONTROLE-LISTAS.md) | os cronogramas múltiplos, os gestos nos itens (excluir e renomear na linha, a linha da fila, o rodapé da playlist), os Favoritos (a pasta inline, a estrela é um bit), editar mídia |
| [`CONTROLE-COLECOES.md`](CONTROLE-COLECOES.md) | coleções do LouvorJA (servidor fora do ar, seções temáticas, `syncGroup`, concorrência, progresso em segundo plano), os acordeões, a completude ("esta coleção está completa?"), a medição do peso, o redesenho que espera a gaveta fechar, a classificação |
| [`CONTROLE-SORTEIO.md`](CONTROLE-SORTEIO.md) | a playlist automática: filtros, o sorteio do Modo Fácil, o pool, o fundo musical, a faixa de fecho, o lote, o baralho |
| [`CONTROLE-YOUTUBE.md`](CONTROLE-YOUTUBE.md) | pesquisar no YouTube, o download como estado da tela (letra sincronizada, cartão de capa, Wi-Fi × dados), o compartilhamento (o link copiado), o contrato do `shouldInterceptRequest`, as séries do YouTube |
| [`CONTROLE-LEITURA.md`](CONTROLE-LEITURA.md) | a folha de ferramentas (a lista das ferramentas) e a leitura auxiliar (letra completa, capítulo inteiro, a cifra em tela cheia deitada, a divisão das estrofes) |

### Índice por assunto

| seção | assunto |
|---|---|
| [Layout geral](CONTROLE-LAYOUT.md#layout-geral) | a coluna, a preview, o transporte, a barra de baixo |
| [Modos de uso](CONTROLE-MODOS.md#modos-de-uso-modo-fácil-padrão--avançado) | Modo Fácil × avançado |
| [O tema](CONTROLE-CONFIGURACOES.md#o-tema-claro--escuro-em-configurações) · [Wallpaper](CONTROLE-CONFIGURACOES.md#wallpaper-personalizado) · [Girar a mídia](CONTROLE-CONFIGURACOES.md#girar-a-mídia-v5142) | Configurações |
| [Abas e biblioteca](CONTROLE-BIBLIOTECA.md#abas-e-biblioteca) | Cronograma, playlist, busca, gaveta de opções, destinos |
| [Gestos nos itens](CONTROLE-LISTAS.md#gestos-nos-itens-da-biblioteca) | toque, toque longo, reordenar |
| [Coleções de mídia (LouvorJA)](CONTROLE-COLECOES.md#coleções-de-mídia-louvorja) | álbuns, índice, sincronização, peso |
| [Os acordeões](CONTROLE-COLECOES.md#os-acordeões-abrem-animados) | card do álbum, letra, opções da coleção, completude |
| [O download vira estado da tela](CONTROLE-YOUTUBE.md#o-download-vira-estado-da-tela) | espera na preview, anel na linha, letra sincronizada |
| [Séries do YouTube](CONTROLE-YOUTUBE.md#séries-do-youtube--coleções-que-não-vêm-do-louvorja-v5228) | Provai e Vede, Informativo |
| [Playlist automática](CONTROLE-SORTEIO.md#playlist-automática-o-sorteio-temático-v5303) | sortear por tema: uma só ou uma fila |
| [Buscar no YouTube](CONTROLE-YOUTUBE.md#pesquisar-texto-no-youtube-no-fim-da-busca) | busca e download (a transmissão direta saiu na v1.7.7) |
| [Favoritos](CONTROLE-LISTAS.md#favoritos-uma-lista-só-marcados--pastas-do-aparelho) | lista única, pastas do aparelho |
| [A saída de áudio](CONTROLE-TELAO.md#a-saída-de-áudio-os-displays-ou-este-aparelho-v5215) | quando o som sai do celular |
| [Leitura auxiliar](CONTROLE-LEITURA.md#leitura-auxiliar-letra-completa--capítulo-inteiro) · [a cifra em tela cheia](CONTROLE-LEITURA.md#a-cifra-em-tela-cheia-deitada-v160) | letra, Bíblia, cifra, páginas — e o modo deitado |
| [Feedback](#feedback-sem-alerta-flutuante--e-a-exceção-do-salvamento) | a resposta nasce onde o toque nasceu |
| [Compartilhamento](CONTROLE-YOUTUBE.md#compartilhamento) · [Diálogo padrão](#diálogo-padrão-do-app-confirmações--prompts) | entradas e confirmações |
| [O histórico do culto](CONTROLE-CONFIGURACOES.md#o-histórico-do-culto-em-configurações-v120--v1431) | o que já foi ao telão, por sessão |
| [A abertura e a badge de versão](CONTROLE-TELAO.md#a-abertura-e-a-badge-de-versão-v170) | a cortina do `#splash`, as duas casas do número, o limpar do Cronograma |
| [Os cronogramas múltiplos](CONTROLE-LISTAS.md#os-cronogramas-múltiplos-v11254) | o título que troca de cronograma, a gaveta (renomear · nome · excluir por linha; o excluir do único LIMPA) e o importar da barra |
| [O que o telão retoma](CONTROLE-TELAO.md#o-que-o-telão-retoma-ao-reconectar-midianoar-v5142) | reconexão |


### Feedback (sem alerta flutuante) — e a exceção do salvamento

Não há mais **toast flutuante**. As informações são transmitidas pela própria
interface (estados de botão, contadores, listas). `flash()`/`dismissFlash()` em
`controle.js` viraram **no-ops** na remoção do toast e foram APAGADOS na v5.207,
com os três chamadores que ainda escreviam frases que ninguém via — e a armadilha
de um no-op com cara de canal já tinha cobrado o preço antes disso: as v5.136/v5.137 voltaram a usá-lo como
o ÚNICO aviso de fluxos novos (o desfecho de um share, a procura de OTA, a
sincronização de pastas), e essas mensagens simplesmente não apareciam. A
auditoria de agosto/2026 religou esses pontos ao `avisar()` (a faixa
`#saveHint`, ver abaixo): mensagem com conteúdo real fala por ali; o resto
segue sem toast.

#### O sinal nasce NO BOTÃO que foi tocado (v5.106)

O resultado de um salvamento é invisível justamente onde ele mais importa:
mandar algo ao Cronograma estando na Bíblia, favoritar de dentro do acervo,
guardar um preset das Ferramentas. O toque não produzia sinal nenhum e a única
forma de saber se funcionou era ir conferir — que é exatamente como se acaba
tocando duas vezes.

**O feedback é um pulso de 1,1 s no próprio botão** (`pulsar(btn, tipo)`), não
uma faixa no alto da tela. O motivo é o olhar: no instante do toque ele está no
botão, e é ali que a resposta tem de aparecer. Uma mensagem em outro canto exige
procurar o aviso, e num culto isso não acontece — o operador toca e segue.

```js
const PULSO_MS = 1100;
pulsar(btn, 'ok' | 'dup' | 'erro')   // → true se de fato pulsou
responder(btn, tipo, texto)          // pulsa; se o botão sumiu, avisa por texto
```

| `tipo` | Cor | Quando |
|---|---|---|
| `ok` | `--ok` | entrou |
| `dup` | `--warn` | **já estava lá** — é esta que impede o segundo toque |
| `erro` | `--danger` | não deu (sem rede, sem capítulo, item sumiu do acervo) |

Três detalhes que o mecanismo não pode dispensar:

- **`visivelNaTela(btn)` decide se o pulso VAI acontecer**, e `isConnected` não
  serve para isso: os bottom-sheets fecham por `opacity: 0`, o nó continua no
  documento. A pergunta certa é `offsetParent !== null` (nenhum ancestral em
  `display:none`) mais `!btn.closest('.popup-backdrop:not(.open)')` (a folha que
  o contém não está fechada). Pulsar um botão invisível é o mesmo que não dar
  feedback nenhum, e é por isso que `responder()` cai no texto nesse caso.
- **Quem re-renderiza a lista precisa ESPERAR o pulso.** `toggleFav` atualiza o
  próprio botão no lugar (classe `on`, `title`, `starSvg`) e adia o
  `renderLibrary` em `PULSO_MS` — chamar o render na hora destruiria o nó que
  está pulsando e o sinal duraria um quadro. Mesmo padrão em `refreshDiversos`,
  `exitSelection` (via `sairDaSelecaoDepois()`) e `closePlPopup`: a folha só
  fecha depois de o operador ver a cor. (`closeFolderPicker` era o quarto e saiu
  na v5.254, com as pastas virtuais e a folha de duas origens.)
- **As regras do pulso ficam no FIM de `controle.css`.** `.btn-pulso--ok` tem a
  mesma especificidade de `.row-btn`/`.sel-btn` (0-1-0), então quem decide é a
  ordem. Declaradas antes, elas simplesmente não pintam nada.

**Todo destino passa por `adicionarNaLista(lista, id, nome, btn)`**, que faz o
`listHas` antes do `listAdd` e escolhe entre `ok` e `dup`. Operações em lote
(seleção múltipla, pasta) resolvem o tipo em `tipoLote`/`textoLote` — um pulso
só na barra de seleção, em vez de quatro sinais piscando.

#### `avisar()`: o que sobra para o texto (v5.104)

`avisar(texto, tipo)` continua existindo, mas só onde o pulso não alcança, e o
que ele **não** é continua valendo: não é o toast de volta. Não flutua sobre os
controles (fica no TOPO da tela — a base é onde mora o transporte, e foi por
cobri-lo que o toast saiu), não pede toque para sair (`pointer-events: none`,
some em 2,4 s) e não é usado por nada que já tenha estado próprio na tela.

Dois casos, e só eles:

1. **O botão sumiu** antes de a resposta chegar (a folha fechou, a lista
   re-renderizou) — `responder()` detecta e cai no texto.
2. **O motivo não cabe num botão.** Guardar um pacote com menos de dois itens
   pulsa em vermelho **e** escreve "Monte a fila com dois ou mais itens antes de
   guardar": a cor diz que não deu, a frase diz por quê, e sem a frase o
   operador toca de novo esperando resultado diferente.

> **Armadilha do YouTube:** um vídeo baixado por `ytArquivo` **nasce na lista**
> (o `addMedia` lá dentro já recebe o destino), então perguntar `listHas`
> DEPOIS anunciaria todo download novo como "já estava lá". Em `ytAcao` a
> pergunta é feita ANTES, e só vale quando existe arquivo no aparelho — é esse
> o registro que será reaproveitado. As músicas do acervo não têm esse
> problema: elas vão para o catálogo `files`, não para uma lista.

#### Anti-duplicação (v5.104)

As listas são conjuntos de ids, então `listAdd` **já é idempotente para
mídia**: o mesmo vídeo não entra duas vezes na mesma lista, por construção. O
que não era idempotente é a **cena de roteiro** — cada uma cria um registro
novo, com id novo. Daí `cueChave(cue, data)`, a identidade de conteúdo de uma
cena (tipo + descritor), e duas regras diferentes por destino:

- **Favoritos não repetem.** Favoritar é marcar; dois "Salmo 23:1" na mesma
  gaveta são ruído puro e ninguém consegue distingui-los. O item existente é
  reaproveitado e o botão pulsa em `dup`.
- **O Cronograma PODE repetir.** O mesmo versículo pode ser lido na abertura e
  no apelo; a mesma contagem regressiva pode aparecer duas vezes. A duplicata é
  criada — mas o botão pulsa em `dup`, que é o que separa a repetição
  intencional do toque dado duas vezes.

A chave da MENSAGEM é só o `msgId`: o texto viaja no descritor como reserva
(para o roteiro não ficar mudo se ela for apagada), e compará-lo deixaria a
reserva decidir a identidade.
O único feedback migrado explicitamente para a UI é a **sincronização das
coleções**: `setCollStatus(id, text, autoClearMs?)` grava um subtítulo
no card da coleção (`renderCollectionCard`) — "Atualizando lista…", "Baixando N/T…",
"Já completo offline", "Sem internet — falha ao atualizar" etc. `autoClearMs`
limpa mensagens finais/erro sozinho; o progresso fica até a próxima chamada. O
`.toast` do CSS foi removido.

### Diálogo padrão do app (confirmações / prompts)

`confirm()`/`prompt()` **nativos foram substituídos** por um **modal no tema do
app** (`#appDialog`/`.dialog-*` no CSS + `openAppDialog`/`appConfirm`/`appPrompt`
em `controle.js`) — centralizado, com botão primário preenchido em `--accent-fill` e cancelar
neutro. É **assíncrono** (retorna uma Promise): `appConfirm({title, message,
okText, cancelText})` → `true`/`false`; `appPrompt({title, message, value,
placeholder, okText})` → string (OK) ou `null` (cancelar/fora/Esc). Um só
diálogo reutilizável (o DOM é estático no `index.html`); abrir um novo enquanto
outro está aberto resolve o anterior como cancelado. Usam isto: **renomear em
LOTE** (o botão do rodapé da seleção múltipla), excluir uma **pasta do
aparelho** ou o que foi baixado de um **álbum** (as duas apagam BYTES, e a frase
é o que diz quantos), o aviso de "sem Wi-Fi" da sincronização em massa, o
cancelamento de um download em curso e a pergunta do OTA.

**O QUE SAIU DELE NA v5.301: a exclusão de um ITEM de lista.** Ela vale para as
três (Cronograma, Favoritos e a fila da playlist) e agora pergunta na PRÓPRIA
LINHA — ver "A confirmação de excluir mora na linha", abaixo. **E NA v1.4.25
saiu o RENOMEAR de uma linha**, pela mesma porta e pelo mesmo argumento.

A régua que ficou: o modal é para o que **apaga bytes** e precisa dizer QUANTOS,
ou para o que age sobre um CONJUNTO (a seleção múltipla, onde não há uma linha
sob o dedo); o que age sobre UMA linha se resolve onde a linha está.

### Deslocamento com o teclado virtual

O meta viewport declara `interactive-widget=resizes-content` (o navegador encolhe
o layout ao abrir o teclado). Onde o hint não é honrado — o WebView em
edge-to-edge do Android 15+, o aparelho do operador —, um handler de
**VisualViewport** (`keyboardShift()` em `controle.js`) mede a altura coberta
pelo teclado (`innerHeight - vv.height - vv.offsetTop`) e escreve DUAS medidas:
`--kb-folha` (o teclado inteiro, sempre) e `--kb`, que
`body { height: calc(100svh - var(--kb)) }` usa para encolher o app pra cima.

**O TECLADO SOBREPÕE: O PADRÃO DO APP** (v1.13.7, invertendo a regra da v1.4.29).
`--kb` é ZERO para todo campo, e só quem declara `data-teclado="desloca"` o recebe.
Relato que a inverteu: *"o problema da caixa de texto da biblioteca subindo e
descendo em todas as interações de texto do app persiste… edição do nome
cronograma… edição de nome dos itens no cronograma"* — com `--kb` escrito, a caixa
de controles (e a barra da Biblioteca que repousa nela) sobe com o teclado e desce
quando o campo perde o foco; três lotes declararam `sobrepoe` campo a campo, e o
padrão continuava deslocando para o resto. O que cada forma de campo faz:

| forma | quem põe o campo acima do teclado |
|---|---|
| folha do teto (`#fadePopup`, `#sorteioPopup`, `#itinPopup`) | a folha desconta `--kb-folha`; a lista dela rola dentro do que sobra |
| diálogo centrado (`appPrompt`: renomear cronograma/itinerário, nova mensagem, guardar pacote, renomear a seleção) | `.dialog-backdrop` desconta `--kb-folha`, e o cartão centra no que sobra acima do teclado |
| campo no corpo de uma lista (o renomear da faixa no Cronograma e nos Favoritos, as legendas do Tempo, os campos do Sorteio) | `revelarCampo`: rola o scroller do campo até 12px acima do teclado e, sem curso (a última linha), dá a ele um `padding-bottom` provisório, desfeito quando o teclado desce — em até três passadas, porque num scroller de conteúdo FLEXÍVEL (a lista de nomes do Sorteio) a folga encolhe o campo em vez de dar rolagem. Um campo mais alto que o espaço livre vai até o topo do scroller e não além |
| **a EXCEÇÃO: a busca da Biblioteca** (`#hymnSearchInput`, `data-teclado="desloca"`) | o app encolhe: a lista termina onde o teclado começa (`body.lib-aberta.teclado`) e, no Modo Fácil, as teclas saem ("DURANTE UMA BUSCA AS TECLAS SAEM"). A barra sobe porque ela É o campo |

**POR QUE O CAMPO NÃO PODE FICAR SOB O TECLADO, mesmo sobrepondo:** o navegador
revela um campo coberto rolando a viewport VISUAL (`vv.offsetTop`), e isso arrasta
a tela INTEIRA para cima — a barra subindo e descendo por outro caminho. É por isso
que o renomear da faixa, marcado `sobrepoe` desde a v1.4.29, ainda se movia no
aparelho. Se o navegador chegar antes do `revelarCampo`, `scrollTo(0, 0)` devolve a
viewport visual (a raiz não rola e o zoom é travado); essa metade só é medida no
modelo do oráculo. Campo novo nasce SEM marca nenhuma; a exceção nova entra com
`desloca`, a razão ao lado e o nome na lista `EXCECOES` do `teclado-das-folhas`.
Onde o hint é honrado quem encolhe é o próprio navegador, e não há daqui como
impedir.
O **Enter** do campo da Biblioteca (`enterkeyhint="search"`) tira o foco e assim fecha o teclado
sem apagar a busca (v1.12.51; ver "DURANTE UMA BUSCA AS TECLAS SAEM").

