# Achados em aberto

**Dois**, os dois do áudio do espelhamento (v1.1.8), e os dois esperando a MESMA
coisa: uma medição em aparelho que ninguém fez ainda. Os 21 da auditoria de
2026-08-20 e os dois da campanha de determinismo da v5.316 foram corrigidos nos
lotes em que foram achados; a nota de cada um está em
[`HISTORICO.md`](HISTORICO.md).

---

## 1. O fone/Bluetooth desvia o áudio da TV? (NÃO MEDIDO)

**Cenário.** Com o espelhamento no ar, o som do aparelho INTEIRO vai para as
caixas — inclusive a mídia de qualquer outro app (ver a seção do espelhamento no
`CLAUDE.md`). Não há como isolar por API. Resta a pergunta prática: **ligando um
fone ou uma caixa Bluetooth ao celular, o Android tira a mídia do espelhamento?**

O Android escolhe **um** device de saída para a estratégia de mídia, e a
prioridade normal põe fone/A2DP acima do submix do Wi-Fi Display. Se for isso, o
desfecho é uma troca de problema, não uma solução: a TV emudece e **o mix
inteiro — o vazamento junto — desce para onde o cabo estiver ligado**. Se for a
mesa de som, o operador ganha um fader físico para cortar; se for um fone, perde
a projeção sonora.

**Correção proposta:** medir primeiro (2 minutos: espelhar, tocar algo, parear um
fone, ouvir onde sai). Confirmado que desvia, a resposta é uma LINHA no bloco
"Áudio do aparelho" do Registro dizendo para onde a mídia está indo — nunca um
recurso: a escolha do device é do sistema e do operador, não do app.

**Ressalva do cético:** a evidência de que fone/A2DP vence o submix é de fórum,
não de fonte AOSP nem de doc. Pode não valer no Samsung do operador, e pode
mudar por versão. **Nada além da medição autoriza escrever isso na tela.**

---

## 2. O telão pausa sozinho quando outro app toma o foco de áudio? (RELATADO, NÃO MEDIDO)

**Cenário.** Quem toca a mídia do culto é o `<video>` do WebView do telão, e o
Chromium pede foco de áudio por elemento (`kRequestSystemAudioFocus`, ligado por
padrão). Perdido o foco para um app de fora, ele chama `onSuspend()` — **pausa**
— e, no caso de perda PERMANENTE (`AUDIOFOCUS_GAIN`, o que outro app de mídia
pede), **abandona o foco e não volta sozinho**. O louvor para na frente da
congregação e só um toque do operador o traz de volta.

**Grau de confirmação:** o operador relata que isto acontecia com a antiga "mesa
de som" — mas aquilo era disputa DENTRO do mesmo uid (a preview do Controle
contra o telão), que o `acertarSaidaDeAudio` já fecha. O caso de um app de FORA é
mecanicamente mais severo e **nunca foi observado**. `display.js` carimba
`PAUSA ESPONTÂNEA` no Registro; desde a v1.1.8 esse carimbo é confiável (antes o
fim de toda faixa produzia um).

**Correção proposta — e ela NÃO é a óbvia.** Retomar automaticamente
(`stage.play()` no evento de pausa espontânea, `display.js:1080`) é possível e
seria OTA puro, mas foi ADIADA de propósito, por quatro razões medidas em fonte:

1. **Não pausa a outra mídia**, que era o ganho esperado. O framework MUTA o
   perdedor com um `VolumeShaper` e **desfaz sozinho ~4 s depois**
   (`forgetUid` → `unfadeOutUid`). Pausar é decisão do outro app, não garantia.
2. **Contra um ALARME não faz nada:** `USAGE_ALARM` está fora de
   `DEFAULT_FADEABLE_USAGES`. O desfecho é louvor **e** despertador juntos.
3. **Uma chamada não é distinguível a tempo.** Ela é perda TRANSITÓRIA e dura
   minutos, então qualquer espera curta ainda dispara DENTRO da ligação — e o
   Chromium já retoma sozinho no fim da chamada, sem código nosso.
4. **Ela apaga o sintoma.** "PAUSA ESPONTÂNEA" com hora e posição vira um soluço
   que ninguém relata; se a causa não for foco (térmica, memória, renderer), a
   próxima investigação começa com MENOS evidência.

**O que fazer antes:** um censo de um culto real com o carimbo já confiável. Se
as pausas existirem e forem de foco, a retomada entra com teto de 3 tentativas,
espera crescente (1,5 s / 4 s / 10 s), guarda de `v.ended` (sem ela o fim de
faixa RELIGA a mídia com a playlist avançando por baixo — dois itens no ar) e
desistência até ação humana. Um veto por `AudioManager.getMode()` fecharia o caso
da chamada, mas custa `SHELL_VERSION` 48 e Release.

---

## Para que este arquivo existe

Um defeito CONFIRMADO que ainda não foi corrigido não pode morar só numa
conversa. Aqui ele espera, com **arquivo:linha, o cenário concreto de falha e a
correção proposta** — nada de "melhorar X".

**É arquivo para ESVAZIAR.** Item resolvido SAI daqui no mesmo lote em que o
conserto entra, e a regra que ele deixou vai para o capítulo dela. Um arquivo de
achados que vira permanente é a próxima coisa a envelhecer mentindo — que é
exatamente a classe de defeito que a auditoria de agosto/2026 passou uma sessão
inteira varrendo.

**O que NÃO entra:** o que já foi corrigido (vai para o `HISTORICO.md`), o que é
gosto ou refatoração sem defeito, e o que é regra viva (vai para o `CLAUDE.md`
ou para `docs/arquitetura/`).

## Quando um achado fica

Só quando ele **muda comportamento** e a correção é decisão de quem publica —
custo alto, risco em culto, ou uma escolha de produto. Achado de documentação,
comentário ou oráculo não espera: corrige-se no lote em que foi encontrado.

E ele fica **com a ressalva de quem o verificou**. Todo achado desta casa passa
por um cético cuja tarefa é refutá-lo; quando a ressalva estreita o cenário ou
rebaixa a gravidade, é a versão dela que vale — não a do achado original.
