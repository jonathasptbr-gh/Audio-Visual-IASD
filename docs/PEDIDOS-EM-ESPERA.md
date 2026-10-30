# Pedidos em espera (fila do operador)

Registro dos pedidos do operador **ainda não implementados**, agrupados em
PACOTES de trabalho. Existe para sobreviver a uma limpeza de contexto da sessão:
quem retomar lê este arquivo e pergunta ao operador **qual pacote seguir** —
nada aqui está autorizado para execução sem essa resposta.

**Regra do arquivo:** ele ESVAZIA. Um pacote entregue sai daqui (a nota vai ao
`docs/HISTORICO.md`, como sempre); um pedido revogado sai com uma linha dizendo
quem revogou. Não é log, e não é `docs/ACHADOS-EM-ABERTO.md` (lá moram defeitos
CONFIRMADOS por auditoria; aqui, pedidos).

Contexto da entrega: base web **v1.13.12** em `main`, APK v1.13.12,
`SHELL_VERSION` 82 — conferido em 2026-10-30. Pedidos recebidos em **2026-10-24**, com o
horário do relato.
O operador pediu economia: *"não temos tokens então toda ação deve ser fracionada
e controlada"* — um pacote por vez, cada um com o rito de entrega completo.

**Ordem recomendada ao operador:** o 5, o 7, e o 6 (pesquisa) por
último. (O Pacote 1 — as quatro correções pequenas — saiu na v1.13.11, e a busca no computador foi refeita no servidor na v1.13.12; o Pacote 4 — a lista vertical das Ferramentas e o nome do itinerário no
título da folha — saiu na v1.13.4; o Pacote 2 — o teclado sobrepondo em todo
campo de texto — na v1.13.7; o Pacote 3 — a linha de controles do Modo Fácil —
na v1.13.8. Fora dos pacotes, saíram também as portas do rodapé maiores e em negrito,
na v1.13.7, e a Biblioteca maior do Modo Fácil, na v1.13.9.)

---

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

## Pacote 7 — A faixa de álbum que está NO AR, destacada (só web)

| quando | pedido |
|---|---|
| 2026-10-30 | *"Pode considerar que quero que seja destacado também."* (resposta ao §4 de `docs/ACHADOS-EM-ABERTO.md`) |

Dentro da Biblioteca, a faixa de um álbum que está sendo projetada não se
distingue das vizinhas (o Cronograma e os Favoritos marcam). O defeito tem DUAS
metades, e as duas entram no MESMO lote — o detalhe e a correção proposta estão
em `docs/ACHADOS-EM-ABERTO.md` §4:

1. **a classe não chega** — `marcarNoAr` lê `dataset.id`, e o `hymnResultRow`
   só escreve `dataset.song`;
2. **a cor estaria errada se chegasse** — `.coll-songs > .hymn-result` vence
   `.lib-item.no-ar` por ordem de fonte (no claro, 1,00:1 contra a vizinha).

**Decidido pelo operador (2026-10-30):** *"acender apenas o álbum de onde está
tocando o item"*. A mesma música pode estar em dois álbuns (ou no hinário e numa
coletânea); acende SÓ a faixa do álbum de onde ela foi tocada. Logo não basta
comparar a música de catálogo: o toque tem de guardar a ORIGEM (o álbum), e
`marcarNoAr` compara música + álbum. Uma música tocada por outra porta
(Cronograma, Favoritos, busca) não acende faixa de álbum nenhuma.
Ao entregar, o §4 sai do `ACHADOS-EM-ABERTO.md`.

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
