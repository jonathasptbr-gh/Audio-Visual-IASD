# Pedidos em espera (fila do operador)

Registro dos pedidos do operador **ainda não implementados**, agrupados em
PACOTES de trabalho. Existe para sobreviver a uma limpeza de contexto da sessão:
quem retomar lê este arquivo e pergunta ao operador **qual pacote seguir** —
nada aqui está autorizado para execução sem essa resposta.

**Regra do arquivo:** ele ESVAZIA. Um pacote entregue sai daqui (a nota vai ao
`docs/HISTORICO.md`, como sempre); um pedido revogado sai com uma linha dizendo
quem revogou. Não é log, e não é `docs/ACHADOS-EM-ABERTO.md` (lá moram defeitos
CONFIRMADOS por auditoria; aqui, pedidos).

Contexto da entrega: base web **v1.13.14** em `main`, APK v1.13.12,
`SHELL_VERSION` 82 — conferido em 2026-10-30. Pedidos recebidos em **2026-10-24**, com o
horário do relato.
O operador pediu economia: *"não temos tokens então toda ação deve ser fracionada
e controlada"* — um pacote por vez, cada um com o rito de entrega completo.

**Ordem recomendada ao operador:** resta o 6 (o estudo do compartilhamento). (A saída de áudio pela API pública e a dica do "Não Perturbe" saíram na v1.13.16; O Pacote 7 — a faixa de
álbum no ar destacada — saiu na v1.13.14; o Pacote 5 — o vídeo da semana como item — saiu na v1.13.13; o Pacote 1 — as quatro correções pequenas — saiu na v1.13.11, e a busca no computador foi refeita no servidor na v1.13.12; o Pacote 4 — a lista vertical das Ferramentas e o nome do itinerário no
título da folha — saiu na v1.13.4; o Pacote 2 — o teclado sobrepondo em todo
campo de texto — na v1.13.7; o Pacote 3 — a linha de controles do Modo Fácil —
na v1.13.8. Fora dos pacotes, saíram também as portas do rodapé maiores e em negrito,
na v1.13.7, e a Biblioteca maior do Modo Fácil, na v1.13.9.)

---

## Pacote 6 — Pesquisa, sem implementação

| hora | pedido | o que já se sabe |
|---|---|---|
| 10:34 | *"Vamos estudar e planejar um sistema de compartilhar itinerários e ou cronogramas de forma mais facilitada… compartilhar no whatsapp… um simples link, que ao tocar, abre o app, e busca/baixa oque for necessário inclusive baixando diretamente do aparelho de origem… Talvez precisamos de um servidor? Estude as opções para o menor atrito possível…"* | entregável é um ESTUDO para o operador decidir, não código. Eixos: link de app (App Links no domínio `audiovisualiasd.com.br`, que já é nosso — exige o arquivo de associação de domínio (Digital Asset Links) no `site/` e `intent-filter` no manifesto, logo Release) vs. arquivo `.avpkg` pequeno só com a LISTA; de onde vem a mídia (LouvorJA e YouTube já são re-baixáveis por id; mídia própria do aparelho é o problema difícil — sem servidor, só com os dois aparelhos online ao mesmo tempo); e o que NÃO viajar (privacidade, `docs/MEDICAO-DE-ALCANCE.md`). Comparar com o `.avpkg` atual (`docs/recursos/PACOTE.md`) |

---

## Pendências antigas (anteriores a 2026-10-24)

- **Tirar o tile "Saída de áudio" de Configurações** (decisão do operador,
  2026-10-30): o projeto da janela da Samsung foi ABANDONADO — não há caminho
  documentado (a One UI não expõe a dela; a única via pública,
  `MediaRouter2.showSystemOutputSwitcher`, abre a do Android, e é o que o tile
  faz desde a v1.13.16). O operador usa o atalho do próprio aparelho. **O tile
  FICA até a próxima função nova de Configurações**, que entra NO LUGAR dele para
  a grade não ficar com um buraco. Ao tirar: o tile, `abrirSaidaDeAudio` do web
  (o Kotlin pode ficar órfão, o lado seguro), e manter as linhas *"Mídia saindo
  agora por"* e *"Não Perturbe"* do Registro (o `saidaDeAudioAlvo` continua).
- **O "vídeo da semana" vira OPÇÃO da linha do episódio deste sábado, não uma
  linha a mais** (pedido do operador, 2026-10-30) — **na próxima vez que se
  mexer nas séries**, não sozinho. Hoje, no AVANÇADO, o card da série tem a
  linha "Vídeo da semana (sempre o atual)" no topo (`semanaLinha` →
  `openSemanaMenu`) ACIMA do episódio da semana. O pedido: tirá-la e pôr na
  gaveta de destinos do EPISÓDIO DESTE SÁBADO um seletor segmentado com DUAS
  opções, **"Este sábado"** (o arquivo do episódio, como hoje) e **"Atalho
  universal"** (o item virtual `kind: 'semana'`, `semanaRegistro`), no MESMO
  visual dos seletores Cantada/Playback e da qualidade do YouTube. Os destinos
  (Tocar agora · Cronograma · playlist · Favoritos) levam o que estiver
  escolhido. O Modo Fácil (bloco "Este sábado" da raiz) não muda. Ver
  `docs/recursos/SERIES.md`, "O vídeo da semana como ITEM".
- **Varrer a sobra de ~24 MB do cache do YouTube no shell** — Kotlin; entra
  num lote que já precise de Release, nunca sozinho.
