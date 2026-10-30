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

**Ordem recomendada ao operador (2026-10-30):** **8 PRIMEIRO (urgente, pedido do operador)**, depois 12, 9, 10, 11; o 6 segue como estudo. (A saída de áudio pela API pública e a dica do "Não Perturbe" saíram na v1.13.16; O Pacote 7 — a faixa de
álbum no ar destacada — saiu na v1.13.14; o Pacote 5 — o vídeo da semana como item — saiu na v1.13.13; o Pacote 1 — as quatro correções pequenas — saiu na v1.13.11, e a busca no computador foi refeita no servidor na v1.13.12; o Pacote 4 — a lista vertical das Ferramentas e o nome do itinerário no
título da folha — saiu na v1.13.4; o Pacote 2 — o teclado sobrepondo em todo
campo de texto — na v1.13.7; o Pacote 3 — a linha de controles do Modo Fácil —
na v1.13.8. Fora dos pacotes, saíram também as portas do rodapé maiores e em negrito,
na v1.13.7, e a Biblioteca maior do Modo Fácil, na v1.13.9.)

---

## Pacote 8 — URGENTE: os oráculos instáveis do CI

> **Tratado pela etapa A1 da revisão (2026-10-30)** — o relatório e o resíduo (`configuracoes-janelas`, instrumentado) estão em `docs/revisao/REGISTRO.md`.

Pedido do operador (2026-10-30): *"Urgente. Coloque em prioridade."* O lote
v1.13.16 reprovou TRÊS rodadas seguidas, cada uma num oráculo DIFERENTE, todos
de tempo e nenhum tocado pelo lote; todos passam na máquina local (o
`display-smoke` 3 de 3). Cada reprovação segura o bundle e custa ~10 min de
re-run. Os três de hoje:

| oráculo | asserção que reprovou |
|---|---|
| `display-smoke.mjs` | *"o `sendStatus` do meio do fade NÃO VIAJA"* e *"no fim sai UM status, o do palco VAZIO"* |
| `enquadramento-da-camada.test.mjs` | (não lida — o log do run 41075250462 tem a linha) |
| `tela-inteira.test.mjs` | B3 — a linha do tempo da base com `display: none` (sem duração ainda) |

Também reprovaram antes, pelo mesmo padrão: runs 2232 e 2234 (push da v1.13.11
e v1.13.12). **O método é o da campanha de determinismo da v5.316**
(`grep -n "v5.316" docs/HISTORICO.md`): achar em cada um a espera que mede o
RUNNER e trocá-la pelo FATO (`esperar`/`esperarDb`), nunca subir prazo; rodar
sob carga (3 processos + `stress`) até reprovar localmente antes de consertar,
e repetir depois. Levantar os reprovados das últimas ~30 runs do `apk.yml`
antes de começar, para não consertar só os três de hoje.

## Pacote 9 — O editor de mídia vai para as Ferramentas

Pedido do operador (2026-10-30). "Editar mídia" é seção de Configurações
(`#cfgSecoes`, v1.12.48) e passa a ser uma ferramenta da LISTA das Ferramentas
(`FERRAMENTAS`, `abrirFerramenta`). A grade de Configurações perde um tile — é a
vaga que o tile "Saída de áudio" esperava (ver as pendências antigas): os dois
saem no MESMO lote, para a grade não ficar com buraco. Conferir o voltar do
Android (a lista das Ferramentas, degrau 2.5) e o rascunho `edicaoRascunho`.

## Pacote 10 — Alerta de "não está pronto" no nome do Cronograma

Pedido do operador (2026-10-30), recusando um AVISO: *"um ícone de alerta ao
lado do nome do cronograma, que ao tocado avisa e dê a opção de baixar tudo para
deixar pronto"*. O ícone aparece ao lado de `#cronoTitulo` quando algum item do
cronograma ATIVO não toca sem rede (hino sem variante baixada, link do YouTube
sem arquivo, `semana` cujo episódio não está na lista `serie`). Tocar abre uma
folha que diz o que falta (contagem por tipo) e um botão "Baixar tudo", que
reusa os caminhos de download existentes (nada de baixador novo). A pergunta
"toca sem rede?" tem de ser UMA função usada também pelo botão. Sem automação:
nada baixa sozinho.

## Pacote 11 — A abertura antes do primeiro evento do Itinerário

Pedido do operador (2026-10-30): uma OPÇÃO do Itinerário (um interruptor só,
*"com tudo automatizado"*) que, antes do primeiro evento do itinerário ativo,
põe no telão uma tela de espera: contagem regressiva até o primeiro horário,
música de fundo de PLAYBACKS aleatórios do Hinário (a regra do `sorteio.js`,
categoria do hinário, variante playback) e, se houver, avisos. Termina sozinha
no horário do primeiro evento. Itinerário = eventos e títulos; Cronograma =
mídias — não se fundem (o operador recusou a fusão). A planejar: o que conta
como "avisos" (Mensagens? apresentação?), a camada de texto que leva a contagem
(o Itinerário já é provedor por descritor), e o que acontece se o operador tocar
algo no meio.

## Pacote 12 — Otimização e limpeza do repositório

Pedido do operador (2026-10-30): *"realmente estamos a muito tempo sem"*. Abrir
pela `docs/AUDITORIA-EFICIENCIA-2026-09.md` (a lista dos achados mortos
inclusive). O alvo nº 1 segue o `CLAUDE.md`: o bloco *"Versão atual"* voltou a
ser LOG de lote (dezenas de *"A v1.x.y FAZ…"*), contra a regra *"ESTE ARQUIVO
NÃO GUARDA LOG DE LOTE"* — deve ficar a linha do presente e o resto sair (o
conteúdo já mora no `HISTORICO.md`; conferir antes de apagar). Também: a tabela
de divergências (linhas de 2 kB), `ACHADOS-EM-ABERTO.md` (o achado 3 foi
desconsiderado pelo operador e o 1 respondido — sair), e poda de comentário com
as DUAS provas da seção "Documentação".

## Pacote 6 — Pesquisa, sem implementação

| hora | pedido | o que já se sabe |
|---|---|---|
| 2026-10-30 | *"controle remoto de slides para o pregador, algum link de site, endereço ou código que não requer internet… onde ele pode controlar os slides pelo próprio aparelho dele, seja vendo os slides. Ou… integração com aparelhos de passagem de slides bluetooth"* | ESTUDO. Duas vias. **(a) Passador Bluetooth:** quase todo passador é um TECLADO HID (manda PageDown/PageUp, setas, às vezes B/F5); pareado com o celular, as teclas chegam à `MainActivity.onKeyDown` como chegam as de volume — o caminho já existe (`captureVolumeKeys` → `__avVolumeKey`), e ligar `KEYCODE_PAGE_DOWN/UP`, `DPAD_RIGHT/LEFT` ao ⏮/⏭ de slide é Kotlin pequeno + Release. Medir: quais teclas os passadores comuns mandam, e se o pareado como teclado esconde o teclado virtual. **(b) Pelo celular do pregador:** o servidor das telas da rede (sem internet, Wi-Fi ou ponto de acesso) já serve páginas; uma página de CONTROLE (anterior/próximo, e opcionalmente a página atual em miniatura) por uma rota nova com o mesmo pareamento e teto de sessões. Cuidado: hoje a rota de subida aceita só `TIPOS_QUE_SOBEM` (lista de permissão) — um comando de slide vindo da rede é uma porta nova de CONTROLE, não só de exibição, e pede decisão de segurança (código de entrada? só no ponto de acesso?). Ver `docs/TELAO-POR-COMANDOS.md` |
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
