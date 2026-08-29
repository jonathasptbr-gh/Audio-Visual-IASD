# Achados em aberto

**Três** — os dois do áudio do espelhamento, mais o CLIENTE de onde sai a escada
da transmissão direta (v1.4.5; as outras duas hipóteses daquele relato morreram,
uma por construção e a outra por correção). (Um quarto — *"mídia baixada pausa
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

## 3. Só o CLIENTE pode fazer o app escolher baixo (NÃO MEDIDO)

**O que já foi respondido, e saiu deste arquivo:** a rede **não** baixa a
resolução (não há ABR — v1.4.4), e desde a **v1.4.5** o app **mede** a banda nos
primeiros bytes e desce o degrau que não couber, antes do primeiro quadro. As
duas hipóteses que estavam aqui morreram: a da internet por construção, a do
"app escolhe cego" por correção.

**O que sobra é uma só, e é estrutural.** `candidatosVideo` ordena por
`ordemCliente` **antes** da altura — o visionOS vem primeiro porque é dele que
vêm as URLs que o CDN serve sem PO Token. A escada que o manifesto entrega é,
portanto, a escada **daquele cliente**. Num vídeo cujo visionOS não tenha faixa
alta, o teto real fica abaixo do disponível, e a medição não ajuda: ela escolhe
dentro da escada que recebeu.

**Como isso aparece:** a nota `HAVIA Zp transmissível (outro cliente)` na linha
de transmissão do Registro (v1.4.4). Ela só sai quando existe faixa mp4
transmissível mais alta, sob o mesmo teto, fora da escada escolhida. **MEDIDO em
aparelho na v5.127**, o caso normal é `137@VISIONOS`, que é 1080p — a nota deve
ser rara.

### MEDIDO em 29/08/2026, e é OUTRO caso — o visionOS veio VAZIO

Registro de aparelho (SM-S928B, Android 16, web v1.4.8 · shell v1.4.5), num
"Tocar agora" que o operador leu como *"parecendo o vídeo com pouca
resolução"* numa TV 3840×2160:

```
transmissão: … prog 1 [mp4 1 (360p)] · clientes ANDROID 1 · vídeo mp4 0 · áudio m4a 0
             → SEM PAR DASH, caindo no download
download:    … sem vídeo-só acima de 360p → veio mp4 18@ANDROID (360p)
a rede mediu 12599 kbps (coube no teto)
```

**O que isso fecha:** não é a TELA (360p ampliado ~6× é a imagem descrita; 1080p
num 4K pequeno não fica assim), não é a REDE (12,6 Mbps sustentam 1080p com
folga, e a medição da v1.4.5 nem chegou a ter degrau para escolher), e não é a
regra de escolha.

**O que isso ABRE, e é diferente da hipótese acima:** ali o visionOS estava
presente e sem faixa alta; aqui ele **não devolveu nada** — a extração inteira
deu UM formato, do cliente ANDROID, e o progressivo legado é 360p por
construção. A nota `HAVIA Zp` não sai neste caso, porque não havia faixa
nenhuma em cliente nenhum.

**Enquanto isso a correção proposta acima segue NÃO FEITA, e agora por dois
motivos:** o de sempre (reordenar por altura entre clientes troca imagem ruim
por 403 na frente da congregação) e um novo — **ela não alcançaria este caso**,
onde não há segundo cliente com faixa alguma para admitir.

### A SEGUNDA MEDIÇÃO fechou: é o EXTRATOR, e o conserto não é nosso

O passo que faltava era um "Tocar agora" noutro vídeo. Registro de 29/08/2026
(web v1.4.10 · shell v1.4.5), sessão com **três** vídeos e canais diferentes —
"MINHA VIDA É UMA VIAGEM", "ARAUTOS DO REI - TENHO PAZ" e "QUEM TEM JESUS -
Minha Vida é uma Viagem (OFICIAL)" —, e a última extração saiu **idêntica** à
da véspera, num vídeo diferente:

```
transmissão: … prog 1 [mp4 1 (360p)] · clientes ANDROID 1 · … → SEM PAR DASH
download:    … → veio mp4 18@ANDROID (360p)
a rede mediu 4969 kbps (coube no teto)
```

Dois vídeos independentes, duas sessões, o mesmo resultado degenerado: **o
visionOS não está devolvendo faixa nenhuma.** É exatamente a pergunta que a
linha `porCliente` nasceu para responder (*"o visionOS chegou a este
aparelho?"*), e a resposta é não.

**E o conserto não existe hoje.** Conferido no repositório do extrator em
29/08/2026:

| verificação | resultado |
|---|---|
| tag mais nova | **v0.26.5** (o pin é `v0.26.4`) |
| `v0.26.4..v0.26.5` | 3 commits, todos *"Fix media.ccc.de live streams"* — **nada de YouTube** |
| `master` | está EM `v0.26.5`; nenhum commit de YouTube depois dela |
| issue aberta | **#1528**, 03/08/2026 — *"Video quality capped at 360p despite bg-helper (PO token) correctly configured"*: é o **SABR**, e o redesenho upstream que o trata como conceito de primeira classe **ainda não compila** |

**Subir o pin para a v0.26.5 não muda nada** — e isso é MEDIÇÃO, não suposição:
o diff entre as duas tags não toca no YouTube.

**Portanto:** enquanto o extrator não resolver o SABR, todo "Tocar agora" cai no
progressivo legado, que é **360p por construção**. Não é a tela, não é a rede,
não é a regra de escolha e não é o pin. Reabrir isto quando sair uma versão do
extrator com commits de YouTube — e a linha `porCliente` do Registro é o
oráculo de campo que diz, em um toque, se ela resolveu.

### O SILÊNCIO SOBRE ELA — RESOLVIDO na v1.4.11

O que ficava do nosso lado não era a resolução: era **não dizer**. Um download
comum mostra a altura no subtítulo da linha ("Vídeo · 360p"), mas o "Tocar
agora" põe o item na prateleira `avulsos`, **que não tem lista visível** — o
operador projetava 360p sem nada na tela dizendo isso, e a leitura possível
voltava a ser *"o app está ruim"*.

O operador pediu o aviso, e ele saiu no cartão que já dizia "Preparando"
(`avisarResolucaoLimitada` → `previewBusy().avisar`). A regra é **duas
condições** — abaixo do pedido **e** abaixo de 720p —, porque uma só erra para
os dois lados: só a primeira faz quem escolheu 480p receber um aviso a cada
toque dizendo o que acabou de pedir; só a segunda transforma um teto baixo
escolhido à mão em alarme. Oráculo: a metade 9 do `toque-instantaneo.test.mjs`,
provada por reversão nas três frentes (sem aviso; só a primeira condição; só a
segunda).

**A resolução em si continua sem conserto nosso** — ver acima.

**Correção proposta, e só com a nota na mão:** admitir o cliente seguinte quando
o primeiro não tiver nada acima de um piso. **Não foi feita de propósito:**
reordenar por altura entre clientes troca uma imagem pior por um **403 na frente
da congregação**, e o modo de falhar da aposta errada é pior que o defeito que
ela conserta.

**Ressalva do cético:** "resolução baixa" numa TV por espelhamento é observação
sobre o que saiu na TELA, e entre a faixa escolhida e a tela há o encoder do
Miracast. Se o Registro disser 1080p e a imagem continuar ruim, o gargalo não é
nada disto — e o app não tem o que fazer. O teste que separa os dois custa cinco
minutos: projetar na mesma TV um vídeo **já baixado** em 1080p.
