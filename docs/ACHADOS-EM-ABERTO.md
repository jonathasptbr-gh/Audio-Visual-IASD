# Achados em aberto

**Três** — dois do áudio do espelhamento, e um relato do operador que ainda
não foi separado das causas possíveis. O que era "o telão pausa sozinho?"
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

## 3. "Mídia BAIXADA pausa quando eu minimizo o app" (RELATO, NÃO SEPARADO)

**O relato (operador, 2026-08-24):** *"Mídias baixadas sendo executadas estão
sendo pausadas quando minimizo o aplicativo. No caso vídeos baixados do YouTube,
mp4 e etc…"*

**Por que ele não se resolve por leitura.** Esta família já foi atacada TRÊS
vezes, e cada correção fechou um caminho diferente:

| versão | o que era | o que fechou |
|---|---|---|
| v1.26 | o Chromium rebaixa a página quando a JANELA some | `onWindowVisibilityChanged` mentindo VISIBLE |
| v1.27 | a visibilidade tem DOIS componentes, e a v1.26 mentiu só sobre um | `onVisibilityChanged` também |
| v1.28 | `Presentation` é um `Dialog`, e `onStop()` chega quando o app sai da frente | o `onStop` que DERRUBAVA o WebView do telão |
| — | a suspensão do renderer em segundo plano | `keepPlaying()` (`WebView.onResume` + `resumeTimers`) no `onStop` da Activity |

Com as quatro de pé, **o telão não deveria pausar** — e é por isso que o relato
não pode ser respondido com um quinto remendo no mesmo lugar. Há três cenas
possíveis, e elas pedem correções OPOSTAS:

1. **o TELÃO** (`Presentation`, com TV/dongle) — se ele pausa, alguma das quatro
   acima não está valendo, ou é roubo de foco de áudio (o caminho da v1.1.11);
2. **a PREVIEW** (sem TV) — ali pausar é o comportamento CERTO e inevitável: o
   WebView do Controle é estrangulado de propósito em segundo plano, e sem TV a
   projeção exige o app na frente. Não há o que corrigir, há o que dizer;
3. **as TELAS DA REDE** — a mídia baixada viaja por `/m/<token>`, e um item
   ainda em crescimento é servido `chunked` **enquanto o empurrão anda**. O
   empurrão (`telaEmpurrarAgora`) roda no WebView do CONTROLE, que é estrangulado.
   Isso explicaria por que **baixada** pausa e **transmissão direta** não: aquela
   depende do celular continuar empurrando bytes; esta sai do `StreamProxy`, que
   é Kotlin e não é estrangulado por nada.

**O que decide, e já está no aparelho:** o diário do telão carrega `oculto`
(`document.visibilityState`) em CADA linha e nomeia a pausa por causa —
`fim natural` · `pausa (comando)` · **`PAUSA ESPONTÂNEA`**. O Registro de
Configurações traz a linha do tempo inteira.

**Pedido ao operador, para fechar em um passo:** reproduzir (tocar um mp4
baixado, minimizar, esperar parar, voltar) e mandar o Registro logo em seguida,
dizendo se havia TV conectada e se havia tela de computador conectada. Três
respostas possíveis, três consertos diferentes:

- linhas `visibilidade` do telão com `oculto: true` → uma das quatro proteções
  não está valendo naquele aparelho (conserto no shell, com Release);
- `PAUSA ESPONTÂNEA` com `oculto: false` → é foco de áudio, e o caso é o do
  achado 2 acima (a retomada já existe; o que falta é saber se ela desistiu);
- nenhuma linha do telão (não havia TV) → é a cena 2 ou a 3, e a resposta é
  saber se havia tela de computador no ar.

**Não inventar um quinto remendo antes disso.** Cada uma das quatro correções
acima foi barata porque foi feita contra uma medição.
