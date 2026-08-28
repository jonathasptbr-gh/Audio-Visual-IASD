# A medição de alcance

O app e o site contam **quantos aparelhos usam isto**, e nada além disso. Este
arquivo é o CONTRATO: o que é contado, o que **nunca** é, por que o uso próprio
sai por construção, e a medição de que o farol ainda depende (§10).

> ## ⚠ UMA SUPOSIÇÃO AINDA NÃO FOI MEDIDA, e o farol inteiro depende dela
>
> Tudo aqui pressupõe que o `download_count` do GitHub **conta a busca feita
> pelo app** (`HttpURLConnection` no `browser_download_url`, com `?t=`). Isso é
> plausível e não é sabido — ver a medição 1 do §10, que custa dez minutos e um
> aparelho. **Se ela falhar, o farol não conta nada e não avisa**: a contagem
> fica em zero para sempre, e zero é indistinguível de "ninguém usou".
>
> Enquanto ela não rodar, a linha honesta é: *o mecanismo está montado e não
> foi verificado em aparelho.*

## §0 ONDE CADA PEÇA MORA

| peça | arquivo | o quê |
|---|---|---|
| o farol do app | `app/src/main/java/br/org/iasd/av/Farol.kt` | uma busca por dia, na carona da ronda do OTA |
| a chave de exclusão | `NativeBridge.farolEstado`/`farolContar` (shell 57), a linha em Configurações | marca este aparelho como de teste |
| a série no tempo | `.github/workflows/dados.yml` | fotografa os contadores de hora em hora na branch órfã `dados` |
| o painel | `site/registro/index.html` | caminho não listado, exige `#alcance` |
| o farol de visita | o rodapé de `site/index.html` | uma por navegador por dia |
| o oráculo | `tools/registro-alcance.test.mjs` | a tranca, a aritmética, o desenho e o ROTEAMENTO |

## §1 O QUE JÁ EXISTE E JÁ ESTÁ CONTANDO

O GitHub mantém um **contador público, por asset, monotônico** (`download_count`)
em toda Release. Ele não precisa ser ligado, não custa nada e **já está
acumulando desde a v1.0**. Medido em **2026-08-28**, pela API:

| asset | contador | o que ele responde |
|---|---|---|
| `audio-visual-iasd-v1.0.apk` | **5** | downloads da v1.0 |
| `audio-visual-iasd.apk` (nome fixo, v1.0) | **3** | idem, pelo nome antigo que a v1.0 ainda publicava |
| `audio-visual-iasd-v1.3.12.apk` | **1** | |
| `audio-visual-iasd-v1.4.apk` | **1** | |
| `web-1.3.15.zip` | **2** | aparelhos que ADOTARAM aquela base |
| `web-1.3.16.zip` | **2** | idem |
| `web-1.4.zip` | **0** | publicada às 09:01 do mesmo dia |
| `version.json` | **2** | consultas ao manifesto desde 09:01 (o asset é substituído a cada publicação) |

**O primeiro achado é o número, não o mecanismo: o alcance de hoje é de um
dígito.** O app está pré-lançamento. Isso ORDENA todo o resto — um instrumento
barato instalado agora vale mais que um preciso instalado depois, porque o que
ele vai medir ainda não aconteceu. Nada aqui justifica infraestrutura.

**E o `download_count` de um APK é EVENTO DE DOWNLOAD, não instalação e não
pessoa.** Robô, espelho, `wget` e a segunda tentativa de quem estava sem sinal
contam igual. É um teto do alcance, nunca uma contagem de gente — e é assim que
ele tem de ser lido em qualquer painel que se escreva.

## §2 A RESTRIÇÃO CENTRAL: UMA PÁGINA ESTÁTICA NÃO RECEBE DADO

O `site/` é GitHub Pages: ele **entrega** bytes e não tem onde **gravar**. Uma
"seção de registro" na página não pode registrar nada por si — ela só pode
DESENHAR o que outra coisa contou. Existem exatamente três lugares capazes de
registrar uma requisição neste projeto:

| # | onde | custo | o que dá |
|---|---|---|---|
| 1 | o `download_count` do próprio GitHub | **zero** — já existe | contagem agregada, pública, monotônica, sem eixo de tempo |
| 2 | um endpoint nosso (Worker/KV e afins) | conta em terceiro, segredo, nova superfície de falha **e de dado pessoal** | tempo real, aparelho único |
| 3 | nada | zero | só o que o §1 já mostra |

Tudo o que segue é consequência disto.

## §3 AS TRÊS ARQUITETURAS

| | **A — contador de asset** | **B — endpoint próprio** | **C — só ler o que há** |
|---|---|---|---|
| instalações | sim, **retroativo** | sim | sim |
| adoção por versão | sim, **retroativo** | sim | sim |
| aparelhos ativos por semana | sim (farol, §11 degrau 1) | sim | não |
| **aparelhos ÚNICOS** | **não** | sim | não |
| **quantos AGORA** | aproximação horária (§5) | sim | não |
| dado pessoal | nenhum novo (§8) | **o endpoint vê IP** | nenhum |
| dependência externa | nenhuma | uma conta, um segredo, um serviço | nenhuma |
| os números são secretos? | **não** — API pública (§7) | sim | não |
| mudança no APK | nenhuma no degrau 0 | sim | nenhuma |

**A É A QUE ESTÁ NO AR**, nos dois degraus (§11). B fica registrado e parado:
ele é a única resposta para "aparelhos únicos" e "agora", e o preço dele é
exatamente o que o pedido excluiu — um servidor que vê o IP de cada aparelho da
igreja.

## §4 "QUANTOS AGORA" É A PERGUNTA CARA E FRACA

Ela é a métrica **menos útil** para este app e a **mais cara** de obter:

- o app é usado algumas horas por semana, quase todas no sábado de manhã. Em
  qualquer instante escolhido ao acaso, "quantos agora" é **zero** — e um painel
  que responde zero em 95% das leituras não informa alcance, informa a hora.
- ela exige presença em tempo real, que é o único item que obriga o §3-B.

**A pergunta que responde "alcance" é "quantos APARELHOS ATIVOS na semana"**, e
essa sai quase de graça. O painel deve responder ESSA, e mostrar "agora" só se
o §5 sobreviver à medição — como curiosidade, nunca como a métrica do topo.

## §5 O MEDIDOR ACIDENTAL QUE JÁ ESTÁ INSTALADO — *pendente da medição 1*

Todo app rodando consulta o manifesto: `RONDA_MS = 15_000` na frente,
`RONDA_FUNDO_MS = 120_000` em segundo plano (`WebUpdater.kt:480,491`). São
**240 requisições/hora por aparelho em primeiro plano**, 30 em segundo — a
`version.json`, que é um asset de Release e portanto **tem contador**.

Logo, a variação horária do contador é um **medidor de horas de uso**, sem uma
linha de código nova:

```
        Δ contador na hora                    Δ
  ──────────────────────────  ≤  aparelhos  ≤  ──
             240                              30
```

É um INTERVALO, não um número — a mistura de primeiro e segundo plano é
irredutível deste lado. Duas ressalvas que o painel tem de carregar:

- **o contador zera a cada publicação** (o `version.json` é substituído no
  lugar): ele mede a janela desde a última publicação, nunca a vida do app;
- **o CI polui, de forma determinística**: `apk.yml:988` (`gh release download`)
  e `pages.yml:140` (`curl`) buscam o `version.json` a cada run que publica. São
  as duas buscas que explicam o `2` medido no §1 — e é por isso que **o farol do
  degrau 1 tem de ser um asset que nenhum workflow toca**.

**Se a medição 1 falhar, esta seção inteira cai** e o farol do degrau 1 deixa de
ser opcional.

## §6 EXCLUIR O PRÓPRIO USO — POR CONSTRUÇÃO, NUNCA POR SUBTRAÇÃO

Este é o requisito que mais facilmente vira um número que *parece* certo.

**A regra: contadores SEPARADOS, não filtro depois.** O aparelho de teste
incrementa `b-dev`, todo o resto incrementa `b`. Não há o que subtrair, não há
estimativa, e um erro aqui aparece como um número óbvio no contador errado — em
vez de sumir dentro do certo. *Subtrair uma estimativa do próprio uso é como se
produz um painel confiável e falso.*

São **três** fontes de contaminação própria, e cada uma tem resposta própria:

| fonte | resposta |
|---|---|
| **o CI** — os workflows buscam o `version.json` a cada publicação (§5) | o farol é um asset que **nenhum workflow toca**. E o `dados.yml` lê os contadores pela **API**, que não os incrementa |
| **o aparelho do operador** — ele roda o APK de Release, como todo mundo, e portanto não tem marca nenhuma que o distinga. Só uma pessoa sabe | a linha *"Este aparelho na medição de alcance"* em Configurações → `Farol.definirContar`, em `SharedPreferences` **próprias** (as do OTA estão fora do backup, e esta escolha deve sobreviver à troca de aparelho). Ela ROTEIA o farol para `b-dev.txt` |
| **o build de debug** — emulador, `assembleDebug`, cada sessão de trabalho | `ApplicationInfo.FLAG_DEBUGGABLE`, lido em runtime — e **não** `BuildConfig.DEBUG`, que custaria ligar `buildFeatures { buildConfig = true }` no Gradle para um booleano que a plataforma já entrega |

**E a mesma regra vale para as VISITAS AO SITE:** abrir `site/registro/` com a
chave grava `avRegistroOperador` no `localStorage` daquele navegador, e dali em
diante ele acende `v-dev.txt`. Quem audita a própria página é a maior fonte de
visita falsa que ela vai ter.

**O ROTEAMENTO É A METADE QUE FALHA CALADA**, e é por isso que ele tem oráculo
(`tools/registro-alcance.test.mjs`): se ele parar de funcionar, nada quebra — a
página abre, o gráfico desenha, os números sobem. Só que passam a incluir quem
mede, e **contador não se corrige depois**.

**A VISITA É UMA POR NAVEGADOR POR DIA**, e não uma por carregamento. Não é
economia: no painel esta série é desenhada NO MESMO EIXO que "aparelhos por
dia", e duas séries só dividem um eixo quando dividem a unidade. Contando cada
carregamento, uma pessoa que recarrega vinte vezes viraria vinte "visitas" ao
lado de vinte aparelhos de verdade. O preço, dito: navegador anônimo ou com o
armazenamento limpo conta de novo.

## §7 O "SEGREDO": O QUE UMA PÁGINA ESTÁTICA PODE E NÃO PODE ESCONDER

**O QUE ESTÁ NO AR É A OBSCURIDADE, por escolha do operador:** `site/registro/`
não é linkado de lugar nenhum, leva `noindex` e exige `#alcance` no endereço.
A chave é uma constante no topo do `<script>` — trocá-la é trocar aquela linha,
e nada mais depende dela.

**E ela É OBSCURIDADE, não segredo.** Tudo o que a página lê, qualquer visitante
lê; a chave está no HTML que ele acabou de baixar. Serve para não pôr um painel
na frente de quem veio baixar o app — e não serve para mais nada. **A própria
página diz isso**, num aviso no rodapé dela: um operador que a lesse como
segredo tomaria decisões erradas sobre o que pôr ali dentro.

**Segredo de verdade custaria ~40 linhas, e continua disponível:** o workflow
cifraria o JSON
(AES-GCM, chave derivada por PBKDF2 de uma frase que só existe em GitHub Secrets
e na cabeça do operador); a página pede a frase e decifra no navegador
(WebCrypto). Nada da frase entraria no repositório, nada dela entraria no HTML.
Não foi construído — e o que ele mudaria está no parágrafo abaixo, que é o
motivo de a escolha ter sido barata.

> **MAS ISSO PROTEGE O PAINEL, NÃO OS NÚMEROS — e esta é a frase que o pedido
> pressupõe e que não é verdade.** `download_count` é API **pública** de um
> repositório **público**: qualquer pessoa que saiba onde olhar lê a contagem
> crua, cifrada a página ou não. O que a cifra dá é a ANÁLISE privada (a série
> no tempo, os descontos, o que se concluiu) e a seção fora do caminho de quem
> visita o site.
>
> **Tornar os NÚMEROS secretos exige a arquitetura B** — o farol teria de viver
> fora de um repositório público. É uma razão legítima para escolher B; não é a
> razão pela qual B foi recusado aqui, e as duas não devem ser confundidas na
> hora de decidir.

## §8 DADO PESSOAL: O QUE NÃO É COLETADO, E POR QUÊ

- **Nada identificável atravessa a rede.** O aparelho busca um arquivo estático
  — exatamente o que ele já faz 240 vezes por hora. Não há corpo, não há
  parâmetro que varie por aparelho, não há id.
- **O GitHub vê o IP de cada busca; nós não.** E ele já o vê, pela ronda do OTA:
  este desenho **não acrescenta exposição nenhuma**, porque a requisição já
  acontece. É o argumento mais forte a favor de A e o que B destrói.
- **Nada aqui distingue um aparelho de outro.** Isso é uma **limitação**, não só
  uma virtude: é exatamente por isso que "aparelhos únicos" não existe em A, e
  dizer isso no painel é o que impede alguém de ler "downloads" como "pessoas".
- **A regra que mantém tudo acima verdadeiro:** *o farol não carrega query que
  varie por aparelho.* Um id, mesmo com hash, transforma contagem agregada em
  rastreamento — é a linha que separa este desenho de telemetria. (O `?t=<ms>`
  que o OTA já manda é carimbo de tempo contra cache, não identidade.)

## §9 AS ARMADILHAS — as três primeiras são MEDIDAS

1. **A faxina do `web-ota` APAGA contador.** `apk.yml:1111` recolhe os
   `web-*.zip`, deixando os três mais novos. Apagar o asset **destrói a contagem
   dele para sempre**. Logo: a adoção por versão só existe se algo TIRAR
   FOTOGRAFIA antes da faxina — e um asset de farol tem de ser **explicitamente
   excluído** de qualquer recolhimento, já que o valor dele é ser velho.
2. **O `web-ota` NÃO TEM FILTRO DE CAMINHO** (dito no `CLAUDE.md`, "Build e
   distribuição"). Um workflow que commitasse a série de hora em hora em `main`
   **republicaria o bundle de hora em hora** — e cada publicação substitui o
   `version.json`, **zerando justamente o contador do §5**. O instrumento
   destruiria a própria medida. Daí a série morar numa branch órfã `dados`: o
   `on: push` do `apk.yml` é `branches: [main, 'claude/**']`, e `dados` não casa.
3. **Asset de Release não tem CORS; `raw.githubusercontent.com` tem.** O
   `pages.yml` já registra a medição (*"o asset de release responde SEM
   `Access-Control-Allow-Origin`"*), e é por isso que ele escreve a versão no
   HTML em tempo de deploy. A página, portanto, **não pode ler a série de um
   asset** — ela lê de `raw.githubusercontent.com/<repo>/dados/serie.json`, que
   responde com CORS liberado.
4. **Republicar um asset zera o contador dele.** Vale para o `version.json` a
   cada publicação (§5): ele mede uma janela, nunca a vida do app.
5. **Contador é monotônico e não tem tempo dentro.** O eixo de tempo só existe
   se algo fotografar periodicamente. **A série é o artefato que importa; os
   contadores são só a sonda** — e uma sonda que ninguém fotografou não deixou
   história nenhuma para trás.

## §10 AS DUAS MEDIÇÕES — elas vêm ANTES da primeira linha

As duas são baratas e as duas são decisivas.

| # | a suposição | o teste | se falhar |
|---|---|---|---|
| **1** | o `download_count` conta a busca do **APP** (`HttpURLConnection` no `browser_download_url`, com `?t=`) | anotar o contador do `version.json`; abrir o app 10 min com rede boa e a tela ligada; reler | Δ≈40 → **o medidor do §5 existe**. Δ=0 → o §5 CAI, e o farol do degrau 1 deixa de ser opcional: passa a ser a única fonte de "ativos" |
| **2** | o `download_count` conta a busca do **NAVEGADOR** | anotar o contador de um asset; abrir a URL dele numa aba; reler | Δ=0 → visitas ao site não são contáveis por este caminho, e a seção de visitas sai do painel |

Nenhuma das duas precisa de código. Ambas precisam de um aparelho e de dez
minutos — e a 1 tem de rodar numa janela **sem publicação**, senão a
substituição do asset zera o contador no meio do teste.

## §11 O DESENHO RECOMENDADO, EM DEGRAUS

### Degrau 0 — FEITO (`dados.yml` + `site/registro/`)

Um workflow agendado (de hora em hora) lê os contadores pela API, acrescenta uma
linha à série e a grava **na branch órfã `dados`** (§9.2). A seção oculta do
site lê a série por `raw.githubusercontent.com` (§9.3) e desenha.

Responde: **instalações por versão** · **adoção de cada base** · e, se a medição
1 passar, **horas de uso por hora do dia**. Tudo **retroativo** ao que o §1 já
acumulou. Custo: um workflow e uma página. **Zero mudança no APK, zero Release,
zero `SHELL_VERSION`.**

E ele **fotografa antes da faxina** (§9.1) — que é a única parte com prazo: cada
publicação nova apaga o contador de um `web-*.zip` que ninguém mais vai ler.

### Degrau 1 — FEITO (`Farol.kt` + a chave de Configurações)

O farol por sessão: o app busca **uma vez por dia** um asset minúsculo que
nenhum workflow toca; a diferença diária é **aparelhos ativos no dia**, limpa,
sem depender da aritmética do §5. Com a chave de exclusão do §6 roteando o
aparelho do operador para o contador separado.

Custo pago: `SHELL_VERSION` 57, lote APK + web com `shellTag: v1.4.1`, e a
Release.

**O estudo argumentou contra construí-lo agora** — com o alcance em um dígito, o
degrau 0 sozinho já responderia — e a decisão do operador foi construir os dois
no mesmo lote. Fica registrado porque a razão importa: o degrau 1 é o único que
dá "aparelhos ativos" **limpo**, sem depender da aritmética do §5, e ele só
começa a acumular história a partir do dia em que é instalado.

### Degrau 2 — parado, e registrado como parado

Endpoint próprio (§3-B). Única resposta para **aparelhos únicos** e **tempo
real**, e única forma de os números não serem públicos (§7). Só entra se a
pergunta mudar de "qual é o alcance?" para "quem são?" — que é outra pergunta,
com outro custo de privacidade.

## §12 O QUE FICA DE FORA, E POR QUÊ

| descartado | por quê |
|---|---|
| analytics de terceiro (GA e afins) | manda o visitante para fora, coleta o que este projeto recusa coletar, e a regra de "sem dependências externas" existe justamente para o caso em que a alternativa é uma linha de script |
| id de aparelho, mesmo com hash | é a linha que separa contagem de rastreamento (§8) |
| contar pelo `Referer` ou por log de acesso | o Pages não expõe log nenhum |
| commitar a série em `main` | republica o bundle e zera o contador que se quer medir (§9.2) |
| ler a série de um asset de Release | sem CORS (§9.3) |
| subtrair o próprio uso por estimativa | §6 — produz um painel confiável e falso |
| cifrar o painel (AES-GCM + frase) | §7 — escolha do operador pela obscuridade. Continua disponível, e o que ele mudaria (a ANÁLISE, nunca os números) está escrito lá |
| farol por SESSÃO em vez de por dia | quem abre o app quarenta vezes numa manhã de trabalho viraria quarenta. Por dia, o pior caso de um aparelho é contribuir com 1 — e a diferença entre dois dias passa a ser "aparelhos", que é a métrica de alcance |
| retentar o farol que falhou | um dia perdido custa um ponto numa série; insistir custa fio e bateria no meio de um culto. É a única coisa deste projeto que pode falhar sem consequência, e falha calada de propósito |
