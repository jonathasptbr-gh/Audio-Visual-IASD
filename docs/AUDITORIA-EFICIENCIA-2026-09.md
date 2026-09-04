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

| # | ação | esforço |
|---|---|---|
| 1 | Podar o `CLAUDE.md` para 80 kB — devolve ~75 mil tokens em TODA sessão | 1 lote |
| 2 | Comparar antes de publicar (página descartável de opções visuais) | por recurso |
| 3 | Escalonar o rito pelo degrau da versão | regra |
| 4 | `tools/versao.mjs` + asserção no `verificar` | ~20 linhas |
| 5 | Aliviar o CI nas branches `claude/**` | 1 lote |
| 6 | Fatiar o `controle.js` em cinco módulos, só movendo | 1 lote grande |
| 7 | Fechar os 4 achados em aberto (corrigir ou decidir não corrigir) | 1 lote |

---

## Limite declarado

A rodada de refutação adversarial preparada para esta auditoria — seis analistas
e um cético independente por dimensão — **bateu no limite da sessão e não
rodou**. Tudo foi apurado diretamente.

Consequência: o relatório é forte em **medição** e fraco em **contra-argumento**.
Cada achado tem número verificável, mas só o nº 6 passou por refutação (a minha,
medindo os 6 commits só-docs). **Antes de aplicar os achados 4 e 6, que mexem em
estrutura, vale uma segunda opinião.**
