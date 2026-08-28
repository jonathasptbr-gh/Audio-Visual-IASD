# Achados em aberto

**Três** — os dois do áudio do espelhamento, mais a resolução da transmissão
direta (v1.4.4). (Um quarto — *"mídia baixada pausa
quando eu minimizo"* — durou um lote: o operador deu a cena que faltava
(*"ocorre quando não há telas conectadas"*), e ela era a segunda das três
hipóteses. Corrigido na v1.3.12, com a resposta que `DISPLAY.md` já tinha
escrita para o dia.) O que era "o telão pausa sozinho?"
foi MEDIDO (sim, e por qualquer app de mídia) e **corrigido na v1.1.11**; o que
sobrou dele é o caso que a correção não sabe distinguir — a chamada telefônica. Os 21 da auditoria de
2026-08-20 e os dois da campanha de determinismo da v5.316 foram corrigidos nos
lotes em que foram achados; a nota de cada um está em
[`HISTORICO.md`](HISTORICO.md).

---

## 1. O fone/Bluetooth desvia o áudio da TV? (MEDIDO PELA METADE)

**O que já se sabe (relato do operador, v1.1.11):** numa tela secundária por
CABO ou virtual, o Android **oferece a escolha** da saída de mídia entre a tela e
o Bluetooth. Isso responde metade: o seletor existe e funciona nesse caminho.

**O que falta, e é o que decide:** (a) a escolha aparece também com
ESPELHAMENTO (Miracast/Smart View), ou só com tela secundária? O operador
suspeita que só; (b) escolhendo o Bluetooth, o que vai para lá é a mídia do app
ou **a mistura inteira**? Se for a mistura — que é o esperado, porque o Android
roteia por estratégia e não por app —, o vazamento **troca de lugar** em vez de
sumir: sai da TV e vai para onde o fone/caixa estiver. Isso pode até ser
desejável (uma mesa de som tem fader físico), mas é outra coisa, e não pode ser
anunciada como solução.

**Correção proposta:** medir (a) e (b) — cinco minutos. Confirmado que a escolha
existe, a resposta é uma LINHA no bloco "Áudio do aparelho" do Registro dizendo
para onde a mídia está saindo, nunca um recurso: a escolha do device é do sistema
e do operador. `AudioManager.getAudioDevicesForAttributes(USAGE_MEDIA)` (API 33,
pública, sem permissão) responderia isso — mas custa um método de ponte,
`SHELL_VERSION` e Release, e só vale a pena depois de (a) e (b).

**Ressalva do cético:** a evidência de que fone/A2DP vence o submix do
espelhamento é de fórum, não de fonte AOSP. Pode não valer no Samsung do
operador.

---

## 2. A retomada não sabe distinguir uma CHAMADA telefônica (SEM VETO)

**Cenário.** A retomada por roubo de foco entrou na v1.1.11 (revisada na v1.1.14) e cobre o caso
medido: outro app de mídia toma o foco, o telão para, e ele volta sozinho. Mas
**uma chamada telefônica também tira o foco** — e ali a retomada não deveria
disparar: a perda é TRANSITÓRIA, o Chromium já retoma sozinho no fim da ligação,
e do lado JS **não há sinal que nomeie a chamada** (a Media Session API é
desligada no WebView; `visibilityState` é sempre `visible` no telão por causa do
`KeepVisibleWebView`).

**O que limita o estrago hoje:** o teto de três tentativas (`RETOM_ESPERAS`, ~15 s)
e a desistência definitiva até um comando humano. O pior caso é três tentativas
falhas durante a ligação e depois silêncio. **Não medido em aparelho.**

**Correção proposta:** `AVNative.audioModo()` → `AudioManager.getMode()` (API 1,
pública, sem permissão) como VETO de pré-voo: a retomada nem agenda em
`MODE_IN_CALL` / `MODE_IN_COMMUNICATION` / `MODE_RINGTONE`. Ponto de mudança:
`NativeBridge.kt` (fila `io` — é leitura de milissegundos) + `podeRetomar` em
`display.js`. **Custa `SHELL_VERSION` 50, `minShell: 50`, `shellTag` e Release**,
por isso ficou de fora do lote que entregou a retomada.

**Ressalva do cético:** duas flags do Chromium (`kAllowDelayedAudioFocusGain`,
`kDeferAudioFocusUntilAudible`) mudam o desfecho durante a chamada e estão
sujeitas a Finch — o MESMO APK, no mesmo Android, pode responder diferente em
dois celulares. Só teste em aparelho decide se o veto é necessário.

---

## 3. A transmissão direta escolhe a resolução UMA VEZ (NÃO MEDIDO)

**Cenário.** Relato do operador (v1.4.4), sobre um vídeo do YouTube tocado direto
do online numa TV por espelhamento: *"veio som, porém ficou travando e qualidade
de vídeo baixa"*. O travamento ganhou sinal e censo naquele lote; a **resolução
não foi tocada**, e é preciso estar escrito por quê.

`YoutubeGrab.manifesto` ordena os candidatos por `ordemCliente` **e só depois**
por altura (`compareBy({ ordemCliente(it.cliente) }, { -it.altura })`), então o
escolhido é *a faixa mais alta do PRIMEIRO cliente da ordem* — visionOS —, nunca
a mais alta da lista. O `mse.js` serve essa faixa até o fim: **não há ABR**.

**As três hipóteses, e nenhuma foi medida:**

| hipótese | como se separa |
|---|---|
| o visionOS não ofereceu faixa alta para AQUELE vídeo | Registro: `transmitindo Xp` **contra** o `resumo`, que já imprime a maior altura POR CONTÊINER |
| a rede não sustentou a faixa e o `<video>` ficou raspando o buffer | Registro: a linha `ficou sem dados N× (Ns parada no total)`, que passou a existir na v1.4.4 |
| o **link Miracast** baixou a própria taxa (nada a ver com a fonte) | o Registro diz 1080p e a TV continua ruim — aí o gargalo é o espelhamento, e o app não tem o que fazer |

**Por que não foi mexido.** `ordemCliente` é o que faz o CDN de fato servir as
URLs (o visionOS é o cliente que entrega adaptativas sem PO Token). Reordená-lo
por altura sem um aparelho na mão é apostar contra a única coisa que sustenta o
download inteiro — e o modo de falhar seria um 403 na frente da congregação, não
uma imagem pior.

**O que já existe como resposta**, e o operador precisa saber: o seletor
**Online · 1080p · 720p · 480p** da folha do vídeo vale para "Tocar agora" (o
`altura` viaja até o `ytStream`). Numa rede fraca, escolher 480p ANTES de tocar é
o conserto disponível hoje.

**Correção proposta:** ler um Registro do próximo caso pelas três linhas da
tabela. Confirmada a primeira hipótese, o desempate por altura entra **dentro do
mesmo cliente** (já é assim) e o que muda é admitir o cliente seguinte quando o
primeiro não tiver nada acima de um piso — mudança em Kotlin, com `SHELL_VERSION`
e Release, e que só se justifica com a medição na mão.

**Ressalva do cético:** "resolução baixa" numa TV por espelhamento é
observação sobre o que saiu na TELA, e entre a faixa escolhida e a tela há o
encoder do Miracast. As duas primeiras hipóteses podem estar as duas erradas.
