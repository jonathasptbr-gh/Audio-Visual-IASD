# Auditoria de eficiência — 2026-09-04

**O que ela mede:** o custo de MANTER este repositório, não a qualidade do que
ele produz. Levantada a pedido do operador (*"seu trabalho está um pouco
ineficiente, ou ficou muito lento"*).

**Base:** `HEAD 86c9e2a` · 28/ago–04/set/2026 · 173 commits · 63 versões.
Tudo abaixo é contagem direta de `git` e do sistema de arquivos. A única
estimativa é a conversão bytes→tokens (≈3,8 B/token em português com marcação),
e ela está marcada onde aparece.

**Versão visual:** https://claude.ai/code/artifact/94a56b04-db66-45ba-a782-2db39c791d95

> **Este arquivo é curto de propósito.** Ele é um relatório sobre inchaço de
> documentação; chegar com 30 kB seria o achado nº 1 se cumprindo. O formato é o
> que o `notas.json` já exige do app: NOMEIA, não explica.

---

## O veredito

Não ficou mais lento fazer as coisas. Ficou mais caro **começar** cada uma — e o
lote encolheu enquanto esse custo de partida crescia.

Cada lote paga um **custo fixo** que não escala com o tamanho da mudança: ler
381 kB de `CLAUDE.md`, navegar 28.570 linhas de `controle.js`, escrever três
documentos, cumprir o rito de merge, rodar 74 oráculos. A série `v1.5.7` →
`v1.5.19` pagou esse custo **doze vezes** por um trabalho que caberia em dois ou
três lotes.

**A lentidão percebida é a amortização, não a execução.**

---

## Os números que sustentam isso

| medida | valor |
|---|---|
| `CLAUDE.md`, lido inteiro em toda sessão | **381.225 B** · 4.567 linhas · ≈100 mil tokens |
| crescimento dele em 7 dias | **308.998 → 381.225 B** (+23%, 10,3 kB/dia) |
| projeção mantida a taxa | ocupa uma janela de 200 mil tokens sozinho em **~31 dias** |
| `docs/` total | **3,0 MB** (HISTORICO 1,5 MB · CONTROLE 498 kB · DESIGN-SYSTEM 101 kB) |
| `controle.js` | **28.570 linhas** · 957 funções · **73%** de todo o JS · 15× o 2º maior |
| merges no histórico | **78 de 173** (45% dos commits são o rito) |
| `apk.yml` | 1.208 linhas, **620 de comentário (51%)** |
| oráculos × código | **38.798** linhas de oráculo para **39.244** de JS (1:1) |
| razão doc:código por lote | v1.5.18 → **383:128 (3:1)** · v1.5.17 → 522:297 |

---

## Os nove achados, por custo

### 1 · ALTA — A documentação virou o produto, e cresce com regra própria

`CLAUDE.md` mistura **regra** (muda o próximo diff) com **justificativa** (a
história do achado). A regra precisa ser lida sempre; a justificativa, quase
nunca. Hoje as duas custam o mesmo, em toda sessão.

- 2.577 palavras em CAIXA ALTA em 4.567 linhas.
- `docs/ESPELHO-DE-PIXELS.md`: 72 kB descrevendo um recurso **removido** (o
  índice já admite que só §2.3, §2.4 e §10-A valem).
- Editado em **85 dos 173 commits** (49%).
- **A ironia é medível:** o arquivo exige do `notas.json` teto de 120 caracteres,
  um tópico por linha e proibição de caixa alta — e não aplica nada disso a si.

**Ajuste:** separar regra de porquê. `CLAUDE.md` fica com invariantes, contratos
e armadilhas ativas, meta de **80 kB**. O resto desce para `docs/`, alcançável
por `grep`. Arquivar inteiro o que descreve recurso removido.

### 2 · ALTA — Doze versões para uma tela: o operador é o arnês de teste visual

`v1.5.7` → `v1.5.19`: 12 versões, 2 dias, a mesma área. Três desenhos completos
da hierarquia da Biblioteca — **cor** (1.5.7/1.5.8) → **moldura** (1.5.9) →
**alternância** (1.5.14) —, dois descartados. A `v1.5.14` saiu em 8 commits
`(N/n)`. A `v1.5.17` precisou de um commit *"o que a revisão do próprio lote
achou"*.

A causa não é indecisão: **não existe lugar barato de olhar antes de publicar.**
A única superfície onde a decisão pode ser tomada é o app instalado, e chegar lá
custa um lote completo.

**Ajuste:** antes de mexer no app, montar uma página descartável de comparação
com as opções lado a lado, nos dois temas, com os números de contraste. Uma
decisão substitui o laço de nove voltas.

### 3 · ALTA — O rito custa o mesmo para uma vírgula e para um recurso

45% dos commits são merges `--no-ff`. Cada lote escreve, em média, tanta
documentação quanto código — com picos de 3:1. Correto para um recurso novo;
desproporcional para um ajuste de 4 px numa margem.

**Ajuste:** escalonar o rito pelo degrau da versão. **CORREÇÃO** ganha só a linha
do `notas.json` e entra agrupada com as irmãs num merge só. **INCREMENTAL** e
**MAIOR** pagam o rito completo. E agrupar: quatro ajustes de margem são um lote.

### 4 · MÉDIA — Um arquivo de 28.570 linhas no caminho de quase todo lote

Tocado em **77 dos 173 commits** (45%). Maiores funções: `resendSceneToDisplay`
462 · `hymnResultRow` 456 · `renderCollectionCard` 368 ·
`renderCollectionsListMiolo` 361.

A invariante 5 está certa e empurra a lógica para o lado web — mas ela **não
exige um arquivo**. O arquivo único é inércia. Os dois defeitos de *lost update*
já registrados (a hidratação da v1.6.0, o `cifraDisco` que zerou 275 cifras) são
sintoma disso: estado de módulo sem dono claro, porque tudo mora junto.

**Ajuste:** extrair por domínio **sem mudar comportamento** — só mover:
Biblioteca, transporte, leitor/cifra, YouTube, diagnóstico. Cinco arquivos de
3–6 mil linhas, com prova de equivalência (a técnica da poda de comentário que o
repo já tem).

### 5 · MÉDIA — A versão mora em três lugares e nenhum script a sincroniza

`version.json` · `controle.js:298 WEB_VERSION` · `index.html #appVersion`.
Scripts de versionamento em `tools/`: **nenhum**. O próprio `CLAUDE.md`
classifica esquecer um deles como *"erro silencioso"*.

O repositório tem 76 oráculos, um deles dedicado a provar que nenhum `var(--x)`
aponta para token inexistente — e a coisa mais fácil de errar, num passo repetido
oito vezes por dia, não tem verificação nenhuma.

**Ajuste:** `tools/versao.mjs` (escreve os três a partir de um argumento) mais uma
asserção no job `verificar`. ~20 linhas, elimina uma classe inteira de erro mudo.

### 6 · MÉDIA — A suíte inteira roda em toda branch de trabalho

Gatilho: `push: [main, 'claude/**']`. Cada push intermediário paga `npm ci` +
Chromium + 74 oráculos + gradle + assemble.

**Refutado em parte, e fica registrado:** o `web-ota` sem filtro de caminho é
desperdício real mas **pequeno** — medi **6 commits só-docs em 173**. Não vale
mexer no maquinário que alimenta a frota por isso.

**Ajuste:** nas branches `claude/**`, rodar só os oráculos dos arquivos tocados.
Suíte completa em `main`, em PR e em tag — onde o portão precisa fechar. E mover
as 620 linhas de prosa do YAML para `docs/shell/`.

### 7 · MÉDIA — Oráculo 1:1 com o código, e muito dele mede DESENHO

Quando o oráculo afirma o desenho, cada rodada de iteração visual exige
reescrevê-lo junto. O `smoke.mjs` chegou a **aprovar o defeito** da Biblioteca,
porque fora escrito para proteger o desenho anterior.

**Ajuste:** separar oráculo de **invariante** (contraste mínimo, sem contorno,
alvo ≥ `--hit`) de oráculo de **desenho específico** (este tom, esta ordem). O
primeiro é permanente. O segundo só se escreve depois que a decisão assentou —
nunca durante a iteração.

### 8 · BAIXA — Auditoria produzida e não aplicada

`AUDITORIA-2026-08.md` 36 kB · 75 achados · **26 por aplicar**.
`AUDITORIA-ESTABILIDADE-AV.md` 23 kB · 10 achados.
`ACHADOS-EM-ABERTO.md` 17 kB · **4 confirmados** e não corrigidos.

76 kB de análise descrevendo trabalho não feito — custo pago duas vezes: para
produzir, e para reler em toda sessão que passa perto.

**Ajuste:** aplicar os 4 confirmados, ou movê-los para uma decisão explícita
(*"não vamos corrigir, e a razão é esta"*). Achado que envelhece vira ruído com
aparência de dívida.

### 9 · BAIXA — As mensagens de commit são ensaios

Exemplo real: `v1.5.19: o A+/A− por baixo da placa, as três portas quietas, e a
tampa que parou de encolher`. O mesmo conteúdo já está no `notas.json`, no
`HISTORICO.md` e frequentemente no `CLAUDE.md` — quarta escrita da mesma
informação, nenhuma canônica.

**Ajuste:** commit descreve **o quê**, em uma linha. O **porquê** tem um lugar só,
e ele já existe: `docs/HISTORICO.md`.

---

## Contraponto — o que NÃO deve ser tocado nesta limpeza

- **A disciplina de oráculo pegou defeitos reais.** O *lost update* da hidratação
  e o `cifraDisco` zerando 275 cifras eram silenciosos, sem sintoma na tela.
  Nenhum seria achado por inspeção.
- **As invariantes escritas evitam relitigar decisões caras.** A válvula
  `minShell`, o watchdog de boot, a invariante 8 do `Range`. Cada uma custou
  rodadas de APK para descobrir e hoje custa uma linha para respeitar. **É esse
  núcleo que vale os 80 kB.**
- **O portão do CI está no lugar certo.** Reprovar em `verificar` barra o canal
  OTA e não barra o APK — a assimetria correta.
- **A cadência é boa.** Oito versões/dia chegando por OTA em minutos é um ciclo
  que poucos projetos têm. **O ajuste é no tamanho do lote, nunca na frequência.**

---

## Plano, por retorno

> **Reordenado depois da refutação.** A ordem original tinha a poda do
> `CLAUDE.md` em primeiro e o fatiamento do `controle.js` em sexto; a segunda
> varredura mudou os dois — a poda encolheu de 79% para 17% e o fatiamento
> perdeu a justificativa técnica.

| # | ação | esforço |
|---|---|---|
| 1 | **Pôr o gate em `autoRefreshCollections`** (achado A) — é o único item de toda a auditoria que toca o culto | 2 linhas, só web |
| 2 | **Corrigir a fixture do `registro.test.mjs`** (achado B) — um oráculo que descreve contrato vencido responde, e responde errado | só `tools/` |
| 3 | **Corrigir as três afirmações falsas** (achado C) — o custo de não fazer é uma sessão futura reintroduzir de boa-fé o que foi removido | 3 frases |
| 4 | Podar o `CLAUDE.md` — **~800 linhas pelo mapa de duplicação medido**, não os 79% da meta original. Bloco a bloco: paleta 480, Biblioteca 288, história da cifra 110 | 1 lote |
| 5 | Fechar os 4 achados em aberto (corrigir ou decidir não corrigir) | 1 lote |
| 6 | Decidir o `dados.yml` (achado D): adensar o cron e remedir em uma semana, ou tirar a promessa do documento | baixo |
| 7 | Comparar antes de publicar (página descartável de opções visuais) | por recurso |
| 8 | Escalonar o rito pelo degrau da versão | regra |
| 9 | `tools/versao.mjs` — **conveniência**, já que o assert existe | ~20 linhas |
| — | ~~Aliviar o CI nas branches~~ · ~~Fatiar o `controle.js`~~ | refutados: pagador inexistente · justificativa técnica inexistente |

---

## A segunda opinião — a refutação que faltava, e o que ela derrubou

> A versão original deste arquivo terminava pedindo isto: *"antes de aplicar os
> achados 4 e 6, que mexem em estrutura, vale uma segunda opinião."* Ela rodou
> depois — **7 frentes, 14 agentes, 27 achados julgados, 17 sobreviveram** — e
> derrubou dois dos nove. O que segue é o veredito, não uma auditoria nova.

### Os que caíram

**Nº 4 — fatiar o `controle.js`: a justificativa técnica não existe.**
O pool de "regra pura extraível" é **1,6%** do arquivo, não os ~40% que a
contagem ingênua sugere: a maioria das funções sem `document.` no corpo toca o
DOM por helper. E o parse de 1,5 MB custa **1,0 ms** (mediana de 9,
`produceCachedData` eager) — o custo de carga não existe.
*Sobrevive só o argumento de NAVEGAÇÃO* (77 de 173 commits tocam o arquivo), e
ele nunca foi medido contra uma alternativa. Fatiar continua defensável como
conforto de quem edita; **não** como desempenho nem como extração de regra.

**Nº 5 — "nenhum script a sincroniza" é meia verdade, e a metade que falta é a
que importa.** `apk.yml:188` **já reprova** a divergência entre `version.json`,
`WEB_VERSION` e `#appVersion` (`assert vjson == vjs == vhtml`). Falta o
ESCRITOR, não a rede de segurança — o "erro silencioso" já é barulhento desde
que aquele assert existe. O `tools/versao.mjs` vira conveniência, não classe de
defeito eliminada.

**Nº 6 — o pagador não existe.** O repositório é público: minutos e artefatos de
Actions são **gratuitos**. O custo real é PAREDE até a frota (203 s) e o SINAL
que se lê, não dinheiro. Pela mesma régua caíram "cachear o Chromium" (~15–20 s
por run) e "a suíte roda duas vezes por lote" — esta última também com a
medição errada (200 runs na janela, não 140).

**Nº 1 — a meta de 80 kB não se sustenta.** Ela seria um corte de 79%. O que está
PROVADO duplicado, medido por shingles de 8 palavras contra os capítulos que já
existem, são **~800 de 4.568 linhas (17%)**: a saga da Biblioteca (310 L, 50,7%
de sobreposição, com 408 L dedicadas em `CONTROLE.md`) e "A paleta" (740 L, 39%).
**"A aba de cifra" NÃO é gordura** — 1,4% contra o `CONTROLE.md`: ela é um
capítulo que nunca ganhou arquivo, e o `CONTROLE.md` aponta de volta para o hub.
O resto do arquivo é regra viva, e é o que o próprio Contraponto acima defende.

### O que a segunda varredura achou e esta auditoria não tinha

| # | achado | quem paga |
|---|---|---|
| **A** | **`autoRefreshCollections` não tem o gate da v1.4.19.** Os cinco pontos de `rotinaDeAcervoPodeCorrer` estão todos em `syncLyrics`/`syncCifrasAcervo`; a fase 1 relê os dois hinários e o catálogo, e a fase 2 as séries — **com mídia no ar**. É a disputa que aquele lote fechou para as rotinas irmãs. Duas linhas, só web. | **o culto** |
| **B** | **A fixture `DIAG` do `registro.test.mjs` divergiu do Kotlin em 7 de 18 linhas.** É a classe de defeito para a qual aquele arquivo foi escrito, acontecendo dentro dele. | quem lê o Registro a distância |
| **C** | **Três afirmações que o código já não cumpre**, nenhuma coberta por oráculo: `CLAUDE.md:3493` diz que "nada no build detecta divergência" entre `colors.xml` e `tokens.css` (o `tokens.test.mjs` trava desde a v1.5.14); o bullet dos "dois caminhos de aplicação" do OTA descreve o `aplicarSozinho`, removido; `PRECEDENCIA_TELAO_MS = 3_000L` contra `DISPLAY_TIMEOUT = 2500`, com o hub afirmando que os dois lados fazem "a mesma conta". | a próxima sessão |
| **D** | **O `dados.yml` entrega 23% do cron horário** — 40 runs em 164,6 h, **zero intervalos de 1 h**, maior buraco 8,09 h — enquanto `MEDICAO-DE-ALCANCE.md:291` promete "horas de uso por hora do dia". | o gráfico prometido |

### O que a segunda varredura propôs e ela mesma matou

Registrado porque **um achado refutado economiza a sessão de quem for reachá-lo**:

- **Excluir `web/vendor/*` do zip do OTA** (412.851 B, 29,1% do bundle). O
  mecanismo é verdade; caíram o ganho e o risco. **Custo inflado ~15×** —
  contaram-se PUBLICAÇÕES como downloads, e o `check()` só baixa a mais nova:
  real 0,4–1,2 MiB/semana, que é **16% de UM fragmento do MSE**. E o risco foi
  LIDO, não medido: hoje bundle e APK têm a mesma lista de arquivos, então o
  estado misto (`sessionRoot` não-nulo E arquivo ausente) **nunca executou em
  aparelho nenhum**, e a cobertura de oráculo é zero.
- **Guardá-lo com `shellTag`.** `shellTag` segura a PUBLICAÇÃO; não faz aparelho
  recusar bundle. MEDIDO: a v1.5.14 saiu com `shellTag` e `minShell: 61`, o
  mesmo piso da anterior. Quem faz recusar é `minShell`. *Fica como correção de
  premissa, e vale independentemente do vendor.*
- **CSS e HTML mortos:** 443 B num zip de 1.418.964 (**0,03%**). 514 das 515
  classes vivas, 25/25 símbolos com `<use>`.
- **Tirar comentário no empacotamento** (economizaria 241 kB, 17%): os oráculos
  validam os arquivos do REPOSITÓRIO — o transform faria a suíte aprovar uma
  coisa e a igreja rodar outra.

### O que ficou de pé sem contestação

Os achados **2, 3, 7, 8 e 9** não foram atacados por nenhuma frente da segunda
varredura, e os números deles continuam valendo. O nº 7 ganhou reforço
independente: a suíte foi reorganizada nesta mesma sessão (arnês compartilhado,
espera pelo FATO, execução em paralelo — 442 s → 152 s), e o `apk.yml` perdeu
567 linhas de justificativa duplicada. Os números da tabela acima já são os de
DEPOIS disso.

---

## Limite declarado

A medição desta auditoria é contagem direta de `git` e do sistema de arquivos; a
única estimativa é a conversão bytes→tokens, marcada onde aparece.

A rodada de refutação **rodou depois**, e está na seção acima: dos nove achados,
**dois caíram** (4 e 5), **dois foram corrigidos na magnitude** (1 e 6) e cinco
seguem sem contestação. Quatro achados novos entraram, e o **A é o único de toda
a auditoria que toca o culto**.

O que continua não medido: nada foi verificado **em aparelho** — os números de
runtime saem de Chromium, e o encoder do Miracast, a térmica e a Wi-Fi da igreja
ficam fora do alcance. E o achado nº 2 não tem número de custo, só de frequência:
ninguém mediu quanto uma página de comparação economizaria de fato.
