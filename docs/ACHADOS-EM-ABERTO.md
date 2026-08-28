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

## 3. A resolução baixa da transmissão direta — a REDE está DESCARTADA

**Cenário.** Relato do operador (v1.4.4), sobre um vídeo do YouTube tocado direto
do online numa TV por espelhamento: *"veio som, porém ficou travando e qualidade
de vídeo baixa"*. A leitura na hora foi *"a resolução estava baixa por questão da
internet, ou por garantia do vídeo não travar"* — a explicação certa para o **app
do YouTube**, e **falsa para este app**.

**O QUE ESTÁ RESPONDIDO, e por construção:**

| hipótese | veredito |
|---|---|
| a internet lenta baixou a qualidade | **IMPOSSÍVEL.** `shared/mse.js` **não faz ABR** — está no cabeçalho dele. O manifesto traz UMA faixa de vídeo, escolhida antes do primeiro byte, e ela é servida até o fim. Rede fraca aqui produz **travamento**, nunca imagem menor (e o travamento é o outro relato do mesmo sábado, contado agora pelo `AVStream.fome`) |
| o app escolhe uma faixa baixa de propósito | **NÃO.** O teto é 1080p (`TETO_ALTURA`) e o padrão do seletor é 1080p, rearmado a cada item. **MEDIDO em aparelho** (S24 Ultra, v5.127): `transmitindo 1080p (137@VISIONOS + 140@VISIONOS)` — o itag 137 É 1080p AVC |

**O QUE FALTA MEDIR** são as três causas que sobram, e o Registro passou a
separar as duas primeiras:

| causa | como aparece no Registro |
|---|---|
| o **vídeo** não tem faixa alta | `teto 1080p → transmitindo 360p` sem a nota `HAVIA` |
| o **operador** pediu menos no seletor | `teto 480p → transmitindo 480p` |
| **nós** deixamos resolução na mesa | `transmitindo 360p · HAVIA 1080p transmissível (outro cliente)` |
| o **encoder do Miracast** baixou a taxa | o Registro diz 1080p e a TV continua ruim — aí o gargalo não é nada disto, e o app não tem o que fazer |

**A terceira linha é a única que seria defeito nosso**, e ela existe porque
`candidatosVideo` ordena por `ordemCliente` **antes** da altura: o visionOS vem
primeiro porque é dele que vêm as URLs que o CDN de fato serve (sem PO Token).
Num vídeo cujo visionOS não tenha faixa alta, sairia menos que o disponível.

**Correção proposta, e só depois da medição:** admitir o cliente seguinte quando
o primeiro não tiver nada acima de um piso. **Não foi feito de propósito** —
reordenar por altura entre clientes troca uma imagem pior por um **403 na frente
da congregação**, e o modo de falhar da aposta errada é pior que o defeito que
ela conserta. A linha `HAVIA` existe justamente para que essa decisão seja
tomada com um número, não com uma suposição.

**O que já é resposta hoje**, e o operador precisa saber: numa rede fraca o
conserto é **pedir menos**, no seletor **Online · 1080p · 720p · 480p** da folha
do vídeo, que vale para "Tocar agora" (o `altura` viaja até o `ytStream`). Menos
resolução são menos bytes por segundo — é assim que se troca travamento por
imagem menor num app que não faz isso sozinho.
