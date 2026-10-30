# Revisão profunda — o plano em etapas

Pedido do operador (2026-10-30): *"manutenções, otimizações, limpezas e
correções no código todo do app … e também no repositório"*, com a restrição
de tokens. **Este arquivo é só a ESTRUTURA**: nenhuma etapa foi executada aqui.
O andamento mora em [`docs/revisao/REGISTRO.md`](revisao/REGISTRO.md).

## Como uma sessão executa uma etapa

O operador abre uma sessão nova e diz: **"Execute a etapa XN do
docs/REVISAO-PROFUNDA.md"**. A sessão:

1. lê **só** esta seção, a linha da etapa na tabela, o cartão dela abaixo e o
   `docs/revisao/REGISTRO.md` (os "repasses" que etapas anteriores deixaram
   para ela). Nada de ler o repositório inteiro;
2. **delegada**: a leitura pesada vai para um agente (a regra do `CLAUDE.md` —
   a tela do operador fica limpa e o contexto principal sobrevive);
3. trabalha **dentro da cerca** do cartão. Achado fora da cerca **não é
   corrigido**: vira uma linha de REPASSE no registro, endereçada à etapa dona;
4. aplica a **lista de verificação comum** (abaixo) ao que está na cerca;
5. entrega pelo rito do `CLAUDE.md` (vizinhança de oráculos, reversão de
   asserção nova, número de CORREÇÃO, nota no `HISTORICO.md`, `notas.json`
   quando o operador vê diferença, merge em `main`, Release se tocou Kotlin);
6. escreve o relatório: **uma** linha na tabela do registro + um bloco curto
   (≤ 25 linhas) na seção da etapa — o que foi corrigido, o que foi achado e
   não corrigido (com o porquê), os repasses, e o PONTO DE PARADA se não acabou.

### As regras que tornam as etapas independentes

- **Nenhuma etapa depende de outra ter rodado.** A ordem recomendada só
  economiza (a A2 encolhe o contexto de todas as seguintes); fora dela, tudo
  funciona.
- **Cumulativas pelo registro, nunca pela memória:** o que uma etapa precisa
  saber de outra está escrito no registro, e só lá.
- **Uma etapa por vez.** Todas sobem o número da versão e escrevem no
  `HISTORICO.md`; duas em paralelo colidem no merge. Ao começar, ler a versão
  ATUAL do `version.json` — nunca a citada aqui.
- **Retomável.** Etapa grande demais para uma sessão para num ponto declarado
  ("revisado até a linha N / até o arquivo X"), entrega o que já fez e marca
  `parcial` no registro. A sessão seguinte retoma do ponto.
- **Achado ≠ conserto.** Só se corrige o CONFIRMADO (cenário concreto, ou
  medido). Suspeita fica no relatório como suspeita. O método de refutação é o
  da `docs/AUDITORIA-2026-08.md`, e a lista dos achados MORTOS da
  `docs/AUDITORIA-EFICIENCIA-2026-09.md` não se reacha.
- **Sem refatoração de gosto.** Simplificar só onde remove código, remove
  duplicação real ou corrige. Mudança de comportamento visível exige pedido do
  operador (fica como pergunta no relatório).
- **Nada em `docs/PEDIDOS-EM-ESPERA.md` entra aqui** — aquilo é fila do
  operador, com ordem própria. Exceção: o Pacote 8 é a etapa A1.

### Lista de verificação comum (toda etapa de código)

| # | categoria | pergunta |
|---|---|---|
| 1 | **correção** | há defeito com cenário concreto? (estado, corrida, erro engolido, falha calada) |
| 2 | **culto** | algo aqui pode interromper a projeção ou o som no ar? (prioridade máxima) |
| 3 | **código morto** | função sem chamador, ramo inalcançável, flag nunca lida, órfão de recurso removido |
| 4 | **duplicação** | a mesma regra escrita duas vezes (o defeito clássico deste repositório) |
| 5 | **desempenho** | trabalho por quadro/por status, laço sobre o acervo inteiro, leitura repetida de IDB/DOM |
| 6 | **comentário** | lápide, comentário que contradiz o código, bloco no símbolo errado, prosa histórica que deveria estar no `HISTORICO.md` |
| 7 | **invariantes** | as do `CLAUDE.md` (shell 1–9, ponte, `__NATIVE__`, paleta) continuam de pé |
| 8 | **cobertura** | o trecho tem oráculo? o que falta e vale escrever (só o que trava defeito real) |

Comentário podado se PROVA com as duas provas do `CLAUDE.md` (código igual sem
comentários + `tools/pares-de-comentario.mjs`).

---

## As etapas

Tamanhos medidos em 2026-10-30 (linhas). "Release" = a etapa toca Kotlin e
pede APK. Ordem recomendada = a ordem da tabela.

| id | grupo | etapa | escopo (a cerca) | tamanho | Release |
|---|---|---|---|---|---|
| **A1** | repositório | CI estável | os oráculos instáveis (Pacote 8 da fila) | — | não |
| **A2** | repositório | dieta do `CLAUDE.md` | `CLAUDE.md` | 315 kB | não |
| **A3** | repositório | capítulos grandes | `docs/arquitetura/CONTROLE.md`, `docs/ORACULOS.md`, `docs/arquitetura/DESIGN-SYSTEM.md` | 1,26 MB | não |
| **A4** | repositório | apêndices e arquivo morto | `docs/` restante (auditorias, achados, `ESPELHO-DE-PIXELS.md`, `HISTORICO.md` só a forma) | 3,1 MB | não |
| **A5** | repositório | o arnês e os oráculos | `tools/` (163 arquivos, 5,1 MB) | — | não |
| **A6** | repositório | CI e higiene do repositório | `.github/workflows/`, `package.json`, `.gitignore`, `site/`, arquivos grandes no git | 1.790 | não |
| **W1** | web | núcleo compartilhado | `shared/db.js`, `shared/native.js` | 3.060 | não |
| **W2** | web | motor e telão | `shared/stage.js`, `display/display.js`, `espelho/tela.js`, `display/display.css`, `espelho/tela.css` | 5.390 | não |
| **W3** | web | módulos puros | `controle/` menos `controle.js`/`.css`/`index.html` (11 módulos) | 5.890 | não |
| **C1** | controle.js | abertura, preview, áudio | `controle.js` 1 – 4.074 | 4.074 | não |
| **C2** | controle.js | render, fila, Bíblia, destinos | 4.075 – 7.836 | 3.762 | não |
| **C3** | controle.js | Ferramentas | 7.837 – 11.515 | 3.679 | não |
| **C4** | controle.js | Cronograma, Biblioteca, séries, favoritos | 11.516 – 17.012 | 5.497 | não |
| **C5** | controle.js | cifra, leitura, Modo Fácil leitura, seleção | 17.013 – 21.713 | 4.701 | não |
| **C6** | controle.js | sincronização do acervo, busca, YouTube | 21.714 – 27.742 | 6.029 | não |
| **C7** | controle.js | downloads, playlist automática, Registro | 27.743 – 34.850 | 7.108 | não |
| **C8** | controle.js | Transferir, share, via nativa, wallpaper | 34.851 – 41.462 | 6.612 | não |
| **C9** | controle.js | Configurações, modos, volume, telão por comandos | 41.463 – fim | 7.334 | não |
| **S1** | estilo | CSS — primeira metade | `controle.css` 1 – 6.848 + `shared/tokens.css` | 7.780 | não |
| **S2** | estilo | CSS — segunda metade | `controle.css` 6.849 – fim + `controle/index.html` | 9.790 | não |
| **K1** | shell | Activity e invariantes | `MainActivity.kt`, `StagePresentation.kt`, `WebViewFactory.kt`, `AndroidManifest.xml`, `res/` | 3.880 | sim |
| **K2** | shell | a ponte | `NativeBridge.kt`, `MessageBus.kt`, `SafPathHandler.kt`, `ShareIntake.kt` | 2.990 | sim |
| **K3** | shell | YouTube | `YoutubeGrab.kt`, `MuxMp4.kt`, `TrilhaAudio.kt`, `StreamProxy.kt` | 3.660 | sim |
| **K4** | shell | telão por comandos | os nove `Espelho*.kt` | 5.130 | sim |
| **K5** | shell | serviços e atualização | `SyncService.kt`, `SessionService.kt`, `WebUpdater.kt`, `ShellUpdater.kt`, `Farol.kt`, `WebPathHandler.kt` | 3.590 | sim |
| **K6** | shell | o resto do shell + build | `SlideDeck.kt`, `CifraFonte.kt`, `R2ImagemFonte.kt`, `PacoteCanal.kt`, `PacoteProvider.kt`, `MicChromeClient.kt`, `MicDiag.kt`, `app/build.gradle.kts` | 1.900 | sim |
| **X1** | transversal | o contrato da ponte | a superfície web × Kotlin: órfãos, `SHELL_VERSION`, os 64/76 | — | sim |
| **X2** | transversal | achados em aberto | os três de `docs/ACHADOS-EM-ABERTO.md` + os 26 não aplicados da auditoria 2026-08 | — | depende |
| **X3** | transversal | medição de desempenho | abertura, memória, trabalho por status — medido no Chromium, sem mudar código | — | não |
| **X4** | transversal | partir o `controle.js` (OPCIONAL) | dividir o arquivo de 48,8 mil linhas em módulos | 48.796 | não |

**Por que essa ordem.** A1 primeiro porque um CI que reprova por acaso segura
TODA entrega seguinte. A2 em seguida porque o `CLAUDE.md` é carregado inteiro
em toda sessão (~80 mil tokens antes do primeiro passo): cada kB tirado dali é
economizado em todas as ~30 etapas restantes. Depois o resto do repositório
(A3–A6), a base web do miolo para fora (W, C, S), o shell (K), e por fim o que
cruza camadas (X), que se beneficia dos repasses acumulados.

---

## Os cartões

Cada cartão diz o que a etapa PROCURA além da lista comum, e o que ela NÃO
toca. Os capítulos citados são os únicos que a etapa precisa abrir.

### A — Repositório

**A1 · CI estável.** O Pacote 8 de `docs/PEDIDOS-EM-ESPERA.md`: os três
oráculos que reprovam por tempo (`display-smoke.mjs`,
`enquadramento-da-camada.test.mjs`, `tela-inteira.test.mjs`). Ler o log do run
reprovado, achar a CORRIDA (prazo virando veredito, espera fixa, animação),
consertar o ORÁCULO pelo método do `CLAUDE.md` ("prazo não é asserção"),
rodar cada um ≥ 10 vezes seguidas e sob carga. Repasse: outros oráculos com a
mesma forma de espera. **Não toca** o app, salvo se a corrida for do app (aí
vira repasse para a etapa dona, com o cenário).

**A2 · Dieta do `CLAUDE.md`.** Meta: núcleo ≤ 80 kB sem perder REGRA. Mover
para os capítulos (que já existem) o que é detalhe de recurso; mover para o
`HISTORICO.md` o que é narrativa de lote (o bloco "Versão atual" tem dezenas
de parágrafos de lotes antigos; a tabela de divergências tem células de 40
linhas). Método: inventário regra a regra ANTES de cortar (cada regra tem casa
nova nomeada no relatório), e o `tools/docs-coerentes.test.mjs` verde. **Não
muda regra nenhuma**, só onde ela mora. Cuidado com a "quarta casa da versão"
e a contagem de arquivos Kotlin, que o oráculo lê dali.

**A3 · Capítulos grandes.** `CONTROLE.md` (762 kB) é o maior custo por
pergunta: quebrar em capítulos por área (Biblioteca, Modo Fácil,
Configurações, Ferramentas, YouTube…) e atualizar o mapa do
`docs/ARQUITETURA-WEB.md`. `ORACULOS.md` e `DESIGN-SYSTEM.md`: tirar narrativa
de lote, manter regra e medida que sustenta decisão. Os links do
`docs-coerentes` ficam verdes.

**A4 · Apêndices e arquivo morto.** Decidir com o operador (pergunta no
relatório) se `ESPELHO-DE-PIXELS.md` e as auditorias fechadas saem do
repositório (o git guarda). Conferir se os 26 achados não aplicados da
auditoria 2026-08 ainda existem no código (só conferir; consertar é X2).
`HISTORICO.md` (2,6 MB): só a FORMA — índice navegável por `grep`, nada
reescrito.

**A5 · O arnês e os oráculos.** Duplicação que sobrou fora do `tools/arnes.mjs`;
oráculos que medem a mesma coisa; fixtures pesadas; os mais lentos medidos
arquivo a arquivo (a regra "onde está o tempo?"); stubs da ponte sem métodos
novos (o defeito dos 60 s); a varredura `comm` dos dois sentidos. **Nenhuma
asserção é apagada sem a reversão provar que ela não trava nada.**

**A6 · CI e higiene.** `apk.yml` (1.367 linhas): passos duplicados, cache do
Gradle/npm, o tempo total do `verificar`; `dados.yml` e `pages.yml`; arquivos
grandes versionados que não precisam estar no git; `.gitignore`; o `site/`.
**Não mexe** no maquinário do `web-ota` sem medir (o preço de errar é o canal
parar) — mudança ali vira pergunta ao operador.

### W — Base web fora do `controle.js`

**W1 · Núcleo compartilhado.** `db.js`: o uso de `storeTx`/`updateState` (o
par `getState`+`setState` é defeito), o coletor de referências, o OPFS. 
`native.js`: as filas, os prazos, a remontagem campo a campo. Capítulos:
`docs/arquitetura/MODELO-DE-DADOS.md`, `docs/shell/PONTE.md`.

**W2 · Motor e telão.** Concorrência de `load` (`loadSeq`), fades, o
`display-status` a 4 Hz, o dreno do papel `tela`, guardas de comando de
descida. É o código que está NO AR durante o culto: critério de culto acima de
tudo. Capítulos: `MOTOR-STAGE.md`, `DISPLAY.md`, `docs/TELAO-POR-COMANDOS.md`.

**W3 · Módulos puros.** Têm oráculo Node cada um: a etapa é barata e segura.
Código morto, regras duplicadas com o `controle.js` (repasse para a etapa C
dona), desempenho de laços sobre o acervo.

### C — O `controle.js` em nove fatias

O arquivo tem 48.796 linhas e ~1.300 funções; as fatias seguem os marcadores
`// =====` e têm de 3,7 a 7,3 mil linhas cada. **Os números de linha
envelhecem**: ao começar, a etapa reencontra a fronteira pelo MARCADOR citado,
não pelo número. Uma função que atravessa a fronteira é da fatia onde COMEÇA.

| id | começa em | termina antes de |
|---|---|---|
| C1 | início do arquivo | `// ===== carregar + render =====` |
| C2 | `carregar + render` | `// ===== Cronômetro / Relógio / Timer` |
| C3 | `Cronômetro / Relógio / Timer` | `A ALTURA DO RODAPÉ FLUTUANTE É LIDA` |
| C4 | `A ALTURA DO RODAPÉ FLUTUANTE` | `// ===== A ABA DE CIFRA (v1.1.7)` |
| C5 | `A ABA DE CIFRA` | `// ===== Coleções de mídia (LouvorJA) — sincronização` |
| C6 | `Coleções de mídia (LouvorJA) — sincronização` | o bloco antes de `"Baixando" na LINHA da música` (linha ~27.743) |
| C7 | linha ~27.743 | o bloco antes de `O QUE FICA DE FORA, e por quê` (linha ~34.851) |
| C8 | linha ~34.851 | `// ===== Diálogo padrão do app` |
| C9 | `Diálogo padrão do app` | fim do arquivo |

Além da lista comum, toda fatia C procura: **o mesmo estado lido por réguas
diferentes** (`haOQueParar` × `cenaNoAr` × `midiaNoAr` — o defeito mais caro
do app), **listeners e timers que não se desarmam**, **medidas de layout
repetidas por quadro**, e **prosa de lote dentro do código** (o arquivo
carrega dezenas de blocos "(vX.Y.Z)" que são histórico — encurtar para a regra
é ganho direto de token em toda sessão futura que ler o arquivo). O capítulo
do recurso tocado é aberto sob demanda, nunca o `CONTROLE.md` inteiro.

### S — Estilo

**S1/S2 · CSS.** Regras mortas (seletor sem elemento — medir no DOM do app, não
por `grep`), `!important`, cores literais (a paleta proíbe), regras empatadas
que dependem da ordem do arquivo, tokens declarados e não usados (S1 cuida de
`tokens.css`). O `smoke.mjs` e o `tokens.test.mjs` são a vizinhança
obrigatória. **Visual não muda**: captura antes/depois nos dois temas.

### K — O shell Kotlin

Toda etapa K: `./gradlew testDebugUnitTest` e `assembleDebug` verdes,
`shellTag` no `version.json` e Release depois do merge. Se a etapa só achar
coisas pequenas, pode **acumular** o conserto e entregar numa Release só —
desde que diga no registro. Capítulo de cada uma: `docs/shell/README.md`
aponta.

**K1** — as invariantes 1–9 conferidas uma a uma no código (é a etapa que as
prova); a `Presentation`, a escada de retomada, a morte do renderer.
**K2** — as quatro filas (nada de rede em `io`), a época das Promises, o
`SafRegistry`. Os seis ÓRFÃOS ficam para X1. **K3** — o slot único de download,
o cancelamento, o cache que sobra. **K4** — a fronteira de rede: tetos do
parser, tokens, `Host`, os JUnit. **K5** — FGS, wake lock, cota do Android 15,
o watchdog do OTA. **K6** — o resto, mais a versão das dependências (o pin do
NewPipe: ler o CHANGELOG antes de subir).

### X — Transversais (melhor depois das camadas)

**X1 · Contrato da ponte.** Refazer a conta medida (64 · 70 · 76), tirar os
seis órfãos do Kotlin num lote APK + web com `shellTag`, subir
`SHELL_VERSION`, atualizar `docs/shell/PONTE.md`.

**X2 · Achados em aberto.** Um por um, com a correção proposta que o próprio
documento traz; o arquivo esvazia. Os que dependem de aparelho viram pergunta.

**X3 · Medição.** Sem mudar código: tempo de abertura, heap depois de uma hora
de status a 4 Hz, quantos `getComputedStyle` por render, custo da busca na
Biblioteca com o acervo cheio. Sai uma lista ORDENADA por ganho, que alimenta
etapas futuras (ou repasses).

**X4 · Partir o `controle.js` (OPCIONAL, e por último).** É a mudança mais
arriscada da lista (ordem dos `<script>`, as globais do `otaAppIsUp`, os
oráculos que leem o arquivo). Só com as fatias C já revisadas, e só se o
operador quiser — o ganho é de manutenção, não algo que ele vê.

---

## O que este plano NÃO cobre

- Recurso novo ou mudança visível: vai à fila do operador.
- Os pacotes 9–12 de `docs/PEDIDOS-EM-ESPERA.md`.
- Teste em aparelho: as etapas que precisarem dizem *o que o operador confere*.
