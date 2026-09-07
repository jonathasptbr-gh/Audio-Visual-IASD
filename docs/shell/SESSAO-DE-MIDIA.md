<!-- Capítulo extraído do `CLAUDE.md` na faxina de 2026-09-07. -->
<!-- O núcleo guarda o RESUMO e o ponteiro; o detalhe mora aqui.  -->

> **Este capítulo saiu do `CLAUDE.md`** (a faxina de 2026-09-07), que era lido
> INTEIRO em toda sessão e por isso cobrava este texto de quem nunca ia abrir
> este assunto. O que ficou lá é o RESUMO — as regras que valem sem abrir
> capítulo nenhum — mais o ponteiro para cá. **O detalhe é este arquivo, e ele
> é a fonte:** uma segunda escrita do mesmo mecanismo divergiria no primeiro
> ajuste, que é o defeito que este repositório mais paga.

**Fora daqui:** [`../../CLAUDE.md`](../../CLAUDE.md) (invariantes, ponte,
barramento, entrega) · [`../HISTORICO.md`](../HISTORICO.md) (o porquê de cada
decisão, por `grep`).

---

# Notificação de controles (sessão de mídia)

[`SessionService.kt`](../../app/src/main/java/br/org/iasd/av/SessionService.kt) publica
um `MediaSession` e uma notificação `MediaStyle`. Dois ganhos, e o segundo é o
menos óbvio:

1. **Controlar sem abrir o app** — o celular fica no suporte, provavelmente
   bloqueado. Os controles aparecem também na tela de bloqueio e nas
   configurações rápidas, de graça.
2. **A projeção deixa de ser descartável.** Sem ele o único serviço em primeiro
   plano era o `SyncService`, que só sobe DURANTE downloads: num culto normal não
   havia nenhum, e o processo seguia candidato a ser morto sob pressão de
   memória — levando a `Presentation` junto.

### O transporte

- **Nenhuma decisão de transporte em Kotlin** (invariante 5). O sistema entrega
  uma string, `SessionRemote` a repassa a `window.__avRemote`, e o web aciona os
  **mesmos botões da tela** por `.click()` — os handlers já tratam os casos de
  borda, e um botão `disabled` é no-op natural. **Por isso nenhuma ação é
  desabilitada no lado nativo:** quem sabe se "estrofe anterior" faz sentido é o
  web, e a cópia em Kotlin envelheceria.
- **`play`/`pause` ≠ `playpause`.** Tela de bloqueio, fone e Android Auto mandam
  intenção explícita; o botão da notificação é alternador. Tratar tudo como
  alternador faria um `onPlay` recebido com o áudio tocando PAUSAR o louvor.
- **⏮/⏭ mudam de eixo conforme a cena** (`slideMode`, de `slideTarget()`): com
  letra, versículo ou mensagem em cena é a estrofe que o operador passa. O rótulo
  diz qual é o modo, para não virar adivinhação — e é por CABER rótulo aqui que
  o eixo duplo continua fazendo sentido neste cartão. **A COLUNA DA TELA CHEIA
  segue a mesma regra** (toque curto passa estrofe, toque longo passa mídia —
  `attachTransportStep`); as duas são as ÚNICAS superfícies com eixo duplo desde
  a v1.3.5. Na BARRA DE TRANSPORTE o par voltou a ser só mídia: lá a preview é
  flanqueada por dois botões de slide próprios, e um eixo escondido atrás do
  tempo do toque não se justifica com o outro a dois centímetros dali.
- **A PALAVRA do rótulo é `slideLabel`** ("estrofe" não serve para uma
  apresentação, onde ⏮/⏭ passam página).
- **Os BOTÕES vêm do web** (`actions`, shell 42), na ordem — invariante 5
  aplicada ao cartão. Lista vazia = os cinco de sempre. O conjunto entra na CHAVE
  de deduplicação do `pushNowPlaying`: sem isso, uma cena que muda só de eixo
  seria deduplicada e o cartão ficaria com os botões da cena anterior. **Um botão
  que sobrou é pior que um que faltou: ele responde.**
- **Declarado nos DOIS lugares que o Android lê** — `PlaybackState` (que desenha
  do 13 em diante) e `Notification.Action` (abaixo dele). Declarar de um lado só
  faz o botão existir em metade dos aparelhos.

> **Do Android 13 em diante quem desenha os botões é o `PlaybackState`**, não a
> notificação: as `Notification.Action` viram decoração. Os controles saem das
> *actions* do estado e os extras (Parar, cortina) de
> `PlaybackState.CustomAction`, entregues por `onCustomAction`.

### O estado

- **Sai de `pushNowPlaying`**, que lê o título do `#npNameInner` já renderizado e
  a posição/duração da própria **barra de progresso** (`#seek`) — em vez de
  reconstruir as origens ou recalcular o tempo por fora. Duplicar essas árvores
  era garantir divergência, e a barra é a única fonte que cobre todos os tipos
  (`preview.getDuration()` é do `<video>` do stage e não sabe nada de YouTube).
  Barra desabilitada zera os dois campos, para o sistema não desenhar uma linha
  do tempo sem significado.
- **Campo novo em `pushNowPlaying` = campo novo em `AVNative.nowPlaying`**,
  sempre — e **sem** subir `SHELL_VERSION`, porque o Kotlin não muda. Ela remonta
  o objeto campo a campo, um campo esquecido some em silêncio e o `optString` lê
  vazio como "use o padrão": foi assim que a notificação escreveu "(estrofe)"
  durante toda a rodada das apresentações.
- **CENA é tudo que está no telão, não só mídia:** `active` inclui `currentId`,
  mensagem, versículo, **cronômetro e sorteio** projetando. O caso que os dois
  últimos cobrem é a sessão RECÉM-ABERTA — projetar a contagem regressiva sem ter
  selecionado mídia nenhuma não levantava o serviço, e o processo seguia
  descartável exatamente durante os dez minutos em que o operador minimiza o app
  para esperar.
- **A posição fica FORA da chave de deduplicação** (a sessão extrapola sozinha:
  posição + decorrido × velocidade). Mas **seek é descontinuidade** que a
  extrapolação não adivinha: em vez de avisar em cada ponto que faz seek,
  `pushNowPlaying` compara o tempo real com o extrapolado e republica além de
  `POS_TOL_MS` (1,5 s, folga para o jitter do `display-status`) — um só lugar
  cobre todas as causas, inclusive as futuras. Durante um ARRASTE não republica:
  ali o valor é a posição do dedo.

### Ciclo de vida e threads

- O serviço vive enquanto houver **cena**, não só enquanto toca: pausado, o
  operador ainda precisa do play.
- **A cena pode acabar enquanto o serviço sobe.** Publicar dispara
  `startForegroundService`, e o `active:false` que vem atrás chega ANTES de o
  serviço existir — sem a guarda ele nascia com "Nada em exibição", e nada mais
  chamaria `stop()` (o web deduplica por chave e não reenvia). `stopSelf(startId)`
  e **não** `stopSelf()`, para uma cena nova já enfileirada cancelar a parada.
  E `stop()` só chama `stopService` quando o serviço **já** está em primeiro
  plano: derrubá-lo com um `startForegroundService` pendente é caminho conhecido
  para o app ser morto — perder a notificação é arranhão, perder a projeção não.
- **`publish()` sempre na main thread.** Todo `@JavascriptInterface` é chamado de
  uma thread do WebView, e `MediaSession` tem handler próprio e não promete ser
  thread-safe.
- **E esse salto de thread abre uma janela, que `running` fecha.** Entre o
  `update()` (thread do WebView) e o `publish` enfileirado na main, o `onDestroy`
  de um `stopSelf` anterior pode rodar: sem a guarda, a continuação publicava
  numa instância destruída — um `notify` que ninguém cancela, ou um
  `startForeground` de um serviço que não existe. Pelo mesmo motivo o `onDestroy`
  **cancela a notificação explicitamente**: o sistema só recolhe sozinho a que
  veio de `startForeground`.

### Ícones

Os do sistema onde eles existem (`android.R.drawable.*`: `ic_media_previous`,
`ic_media_play`/`ic_media_pause`, `ic_media_next`) — um conjunto próprio no
`res/` só para cinco botões não se paga, e o `MediaStyle` os tinge conforme o
tema. **Duas exceções, e as duas pelo mesmo motivo: o símbolo certo não está
lá.**

- **A cortina** (`ic_image` / `ic_image_off`): o sistema não tem imagem riscada,
  e o `ic_menu_view` é um OLHO, que sugere "esconder a vista" quando o que sai
  do telão é a MÍDIA.
- **Parar** (`ic_stop`, v1.1.2): `android.R.drawable` tem play, pause, ⏮ e ⏭ e
  **não tem parar**. O que ocupava o lugar era o `ic_menu_close_clear_cancel` —
  um ✕, que num player não diz "parar", diz "fechar": ao lado do play e do ⏭ ele
  se lia como "dispensar a notificação", a única coisa que aquele botão não faz.
  O quadrado cheio é o MESMO símbolo do `#stop` da barra de transporte do app,
  que é a regra que a cortina já seguia. (O ✕ fica onde ele é verdade: o
  "Desligar transmissão" do cartão da transmissão, que de fato encerra e
  dispensa.)

**O ícone mostra o ESTADO; o rótulo, a AÇÃO.** Telão coberto = imagem riscada;
mídia no ar = imagem inteira. O rótulo ("Cobrir telão"/"Mostrar mídia") nomeia o
que o toque faz — é o que a notificação tem de sobra em relação à tela, onde quem
carrega o estado é a cor. Inverter num lugar só faria o MESMO símbolo significar
coisas opostas nos dois.

### A notificação NÃO pode depender do JS do Controle

Com o app minimizado e sem áudio audível, o sistema estrangula aquele WebView:
`pushNowPlaying` para de ser chamado e a notificação congela — botão em "play",
barra parada — enquanto o telão segue projetando.
`NativeBridge.snoopDisplayStatus` lê de passagem o `display-status` que o telão
já emite pelo `busPost` e corrige play/pause, posição e duração
(`SessionService.updateFromDisplay`). A `Presentation` não é estrangulada: é uma
fonte que continua viva quando a outra não está. **Não é decisão de transporte**
— copia campos que o web já calculou, e sem cena publicada não inventa nada.
Republica com a mesma economia do web. **Sem telão conectado o caso não se
aplica**: ali a projeção É a preview em tela cheia, que exige o app na frente.

> **A verificar em aparelho:** se o WebView criar uma sessão de mídia própria ao
> tocar áudio, poderia aparecer uma notificação concorrente. Nada no código
> indica isso, mas não foi observado rodando.

---
