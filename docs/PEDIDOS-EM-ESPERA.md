# Pedidos em espera (fila do operador)

Registro dos pedidos do operador **ainda não implementados**, agrupados em
PACOTES de trabalho. Existe para sobreviver a uma limpeza de contexto da sessão:
quem retomar lê este arquivo e pergunta ao operador **qual pacote seguir** —
nada aqui está autorizado para execução sem essa resposta.

**Regra do arquivo:** ele ESVAZIA. Um pacote entregue sai daqui (a nota vai ao
`docs/HISTORICO.md`, como sempre); um pedido revogado sai com uma linha dizendo
quem revogou. Não é log, e não é `docs/ACHADOS-EM-ABERTO.md` (lá moram defeitos
CONFIRMADOS por auditoria; aqui, pedidos).

Contexto da entrega: base web **v1.13.3** em `main` (28b7e5dd), APK v1.12.46,
`SHELL_VERSION` 82. Pedidos recebidos em **2026-10-24**, com o horário do relato.
O operador pediu economia: *"não temos tokens então toda ação deve ser fracionada
e controlada"* — um pacote por vez, cada um com o rito de entrega completo.

**Ordem recomendada ao operador:** 1 → 3 → 5, e o 6 (pesquisa) por
último. (O Pacote 4 — a lista vertical das Ferramentas e o nome do itinerário no
título da folha — saiu na v1.13.4; o Pacote 2 — o teclado sobrepondo em todo
campo de texto — na v1.13.7.)

---

## Pacote 1 — Correções pequenas (só web)

| hora | pedido (em substância) | pista técnica |
|---|---|---|
| 07:46 | *"Na preview, o display do itinerário está tendo o texto de 'agora' e 'a seguir' vazados fora de sua caixa para a esquerda… no telão ele se encaixou. Verifique… método de enquadramento, para que fique visualmente igual na preview."* | o bloco do itinerário (v1.13.1/v1.13.2: `--stage-painel`, `align-self: center`, a marca "Agora" à esquerda do horário) mede bem no telão e transborda na preview. Suspeita: medida em `vw`/px absoluto em vez da caixa do palco (o palco da preview não tem a largura da janela). A regra é a de sempre — a preview ESPELHA o telão, então o enquadramento tem de ser relativo ao palco, não à viewport. Oráculo: medir a caixa do texto contra a do palco nos dois documentos |
| 09:24 | *"Verifique as mensagens duplicadas no processo de conectar a um computador, quando o aparelho não está conectado a nenhuma rede wifi…"* | folha de conexão do telão por comandos (`docs/TELAO-POR-COMANDOS.md`). Sem Wi-Fi cliente e sem ponto de acesso, duas frases dizem a mesma coisa. Achar as duas fontes e deixar UMA |
| 10:38 | *"A alteração entre slides dos textos bíblicos está muito instantânea… mais suave… ligeiramente mais devagar."* | a troca de estrofe/slide da Bíblia na Camada de Texto (`docs/arquitetura/CAMADA-DE-TEXTO.md`). Dar uma transição curta (cruzamento de opacidade) mais lenta que a atual; respeitar `prefers-reduced-motion`. Conferir se a letra de música usa o mesmo caminho antes de mudar — o pedido é da BÍBLIA |
| 09:22 | *"Ao tentar escolher o momento de um vídeo… deslizando a barra de progresso… o vídeo no computador conectado via navegador, apenas reinicia, mas não pula realmente para o ponto."* | tela da rede (papel `tela`), mídia por `/m/<token>` com `Range` RFC 7233 (`EspelhoHttp.alcanceDe`). "Reinicia" sugere: (a) o `seek` chega mas o `<video>` não tem a faixa servível (resposta 200 em vez de 206 → o navegador recomeça), ou (b) item ainda EM CRESCIMENTO servido em chunked, que não é buscável. Se (a) for no Kotlin, o pacote deixa de ser só web — **medir antes de prometer**. Reproduzir no `tela-rede.test.mjs` |

## Pacote 3 — A linha de controles do Modo Fácil (só web)

| hora | pedido |
|---|---|
| 11:22 | *"Vamos remover o botão de mais e menos de volume e o de mute do modo simples. Adicione a função de mute ao próprio botão que indica o nivel de volume (… cor do botão normal…). Então fica assim: botão de stop, botão de play/pause e botão de nivel de volume/mute"* |
| 10:13 | *"Esconder play pause e stop no modo simples, após um encerramento de mídia, no caso também vale para quando feito stop pelo usuário. Lembre de animar o recolhimento e com tempo suficiente para não desaparecer debaixo dos dedos do usuário."* |

Os dois pedidos são A MESMA linha (`.simple-remote`), e por isso um pacote só.
Resultado: **Parar · Play/Pausa · Nível (toque = mudo)**, o nível na cor de
botão normal (não `--btn-accent`). Sem mídia no ar (fim natural ou Parar), a
linha recolhe ANIMADA, com uma espera antes de começar (o dedo ainda está ali)
— a pergunta é `haOQueParar()`, a mesma do Parar. Cuidar: o ± do Modo Fácil é
hoje o que mantém o passo de volume igual às teclas físicas (`volumeProximo`);
sem ele, as teclas físicas ficam como o único ajuste fino no Modo Fácil —
**dizer isso ao operador na entrega**. Oráculo: `modo-simples-corpo` (ou um novo)
para a composição e o recolhimento com o relógio mockado.

## Pacote 5 — O vídeo da semana como item (só web, provável)

| hora | pedido |
|---|---|
| 10:28 | *"Sistema do provai e vede e do informativo mundial… 'elemento genérico da semana'… 'provai e vede atual'… um item que automaticamente toca o respectivo vídeo da semana… cronograma pode ser atemporal."* |

Um item VIRTUAL por série ("Provai e Vede — vídeo da semana") que pode entrar no
Cronograma, na playlist e nos Favoritos e, ao tocar, resolve para o episódio
retido pela lista `serie` de `db.js` (o detentor de tamanho UM). Um Cronograma
montado uma vez serve todo sábado. É o mesmo desenho do item editado (v1.12.0):
registro que `getMedia` devolve RESOLVIDO. Perguntas a fechar: o que tocar sem o
episódio baixado (baixar e projetar, como o "Tocar agora"? avisar?); como o
item viaja no `.avpkg`; e o rótulo na lista (mostrar a data do episódio
resolvido). Ver `docs/recursos/SERIES.md`.

## Pacote 6 — Pesquisa, sem implementação

| hora | pedido | o que já se sabe |
|---|---|---|
| 09:58 | *"Problemas com a janela de escolha de saída de som: Janela atual: É o painel de volumes (VOLUME / SOUND). Com MEDIA_OUTPUT / MediaRouter: Abre o painel que lista os dispositivos conectados (alto-falantes do telefone, fones Bluetooth, fones P2/Type-C ou Smart TVs/Cast)… Verifique essas opções"* | o tile "Saída de áudio" (shell 73) tenta uma cadeia; o 1º candidato (broadcast do diálogo do SystemUI) é ENGOLIDO neste aparelho (v1.9.11/v1.9.12, conferido pelo foco da janela e lembrado por `versionCode`), e a cadeia cai no painel de volume. Pista nova: `MediaRouter2.showSystemOutputSwitcher()` (API 34) e `Settings.Panel`/`ACTION_MEDIA_OUTPUT` — **Kotlin, portanto Release**. Pesquisar o que o aparelho do operador expõe e pedir uma cópia do Registro (a cadeia inteira vai lá) |
| 10:34 | *"Vamos estudar e planejar um sistema de compartilhar itinerários e ou cronogramas de forma mais facilitada… compartilhar no whatsapp… um simples link, que ao tocar, abre o app, e busca/baixa oque for necessário inclusive baixando diretamente do aparelho de origem… Talvez precisamos de um servidor? Estude as opções para o menor atrito possível…"* | entregável é um ESTUDO para o operador decidir, não código. Eixos: link de app (App Links no domínio `audiovisualiasd.com.br`, que já é nosso — exige o arquivo de associação de domínio (Digital Asset Links) no `site/` e `intent-filter` no manifesto, logo Release) vs. arquivo `.avpkg` pequeno só com a LISTA; de onde vem a mídia (LouvorJA e YouTube já são re-baixáveis por id; mídia própria do aparelho é o problema difícil — sem servidor, só com os dois aparelhos online ao mesmo tempo); e o que NÃO viajar (privacidade, `docs/MEDICAO-DE-ALCANCE.md`). Comparar com o `.avpkg` atual (`docs/recursos/PACOTE.md`) |

---

## Pendências antigas (anteriores a 2026-10-24)

- **Notificação abaixando o volume da mídia** (análise da v1.13.1): a saída
  barata é (a) uma dica, só web, sugerindo ligar o "Não Perturbe" quando o som
  sai pelo celular; (b) um tile que abre as configurações do Não Perturbe pede
  Kotlin e Release; (c) ligá-lo automaticamente foi desaconselhado. **Aguarda o
  operador dizer se quer (a).**
- **Varrer a sobra de ~24 MB do cache do YouTube no shell** — Kotlin; entra
  num lote que já precise de Release, nunca sozinho.
