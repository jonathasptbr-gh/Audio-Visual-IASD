# Achados em aberto

**Dois**, os dois do áudio do espelhamento. O que era "o telão pausa sozinho?"
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

**Cenário.** A retomada por roubo de foco entrou na v1.1.11 e cobre o caso
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
