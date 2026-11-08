# Método de trabalho — atos e cuidados universais

Para o agente, lido no início de **toda** sessão de repositório. Não é sobre
código — é sobre **como trabalhar sem desperdiçar esforço nem refazer**. É
universal (vale para qualquer tarefa, em qualquer repositório do operador). As
lições de uma sessão entram aqui **generalizadas**, nunca narradas.

## O princípio (uma linha)

**Ler o dado real antes de teorizar · verificar antes de concluir · barato antes
de caro · pensar fundo só onde a etapa exige.**

## Autoregulação — o modelo é fixo por sessão; a profundidade é minha

O operador não troca esforço/modelo por etapa. O que eu controlo é **quão fundo
penso em cada etapa**, mesmo num modelo `high`:

| nível | o que é | profundidade do raciocínio |
|---|---|---|
| 0 · mecânico | versão, notas, HISTORICO, commit, git, sintaxe apontada pelo CI | raso — executar e seguir |
| 1 · rotina | ler código/doc para responder pergunta simples; aplicar regra já escrita | raso |
| 2 · diagnóstico | "por que X está errado?" — causa-raiz | fundo, **indo ao dado real** |
| 3 · projeto | arquitetura, tradeoff, risco de regressão amplo | fundo e estruturado |

**Regra dura:** pensar fundo é só para 2 e 3. Se estou num passo 0/1 pensando
muito, é o nível errado — ou o passo é 2/3 e a saída é ir ao dado, não à teoria.

## Atos — o que fazer ANTES de cada passo de risco

**Antes de CONCLUIR "não existe / está faltando":**
1. Separar **"ausente no fonte"** de **"ausente na leitura"**. Se o dado está no
   fonte (log, JSON, endpoint, canal), a pergunta é *por que a leitura não o traz*.
2. Confirmar no fonte, nunca no palpite. **"Não vejo" ≠ "não há".**

**Antes de TEORIZAR sobre número/estado que não fecha:**
1. Ir direto ao dado real. *"O que o fonte manda de fato?"* vale mais que
   *"que cálculo explica o número?"*.
2. Duas voltas de raciocínio sem avançar = **parar e ir ao dado**. Não teorizar
   em círculo.

**Antes de ESCREVER código que toca dependência/API:**
1. Confirmar que o tipo/método está no classpath de **COMPILAÇÃO** (não só
   runtime): dependência `api` vs `implementation` — checar antes de importar.
2. Conhecer a convenção da linguagem (Kotlin mapeia `List.size()` para a
   propriedade `size`; bibliotecas de JSON têm APIs diferentes).

**Antes de BUSCAR dado na rede:**
1. Preferir o endpoint mínimo (oEmbed, API, RSS) à página inteira.
2. Não buscar o mesmo recurso duas vezes — cachear em `$HOME` e reusar.
3. Limitar a saída antes de imprimir (`head`/`grep`), não despejar o arquivo.

**Antes de PUSH / de cada rodada cara (CI ≈ 10 min):**
1. Rodar o que é local e barato: `node --check`, a sanidade da base web, os
   oráculos Node, a validação de JSON.
2. Empurrar **só** com o local verde. O CI confirma; não serve para achar erro
   de sintaxe.

## Cuidados — o que evitar

1. **Não teorizar em círculo** — duas voltas sem avanço = ir ao dado.
2. **Não refazer passo que já deu certo** — reusar leitura, fetch e verificação.
3. **Não concluir cedo demais** — ausência na leitura ≠ ausência no fonte; "achei
   a causa" exige prova (dado real, ou a reversão do oráculo).
4. **Não empurrar sem o check barato** — CI é caro; o local é barato.
5. **Não pensar fundo em tarefa mecânica** — nível 0 é nível 0.
6. **Não reler o que já foi lido na sessão** — `CLAUDE.md`/`ACESSO.md` uma vez;
   o resto por `grep`, nunca releitura integral.

## Bloqueio — declarar e seguir

Travar → declarar **(a)** a condição concreta que bloqueia, **(b)** o próximo
passo MAIS BARATO que destrava, e seguir por ele. Dificuldade ou incerteza não é
bloqueio; bloqueio é uma condição concreta que se repete. Não encher o bloqueio
de teoria.

## Pronto = publicado + verificado

"Commit feito" não é pronto. Pronto é: **o que o operador vê mudou** (bundle/APK
no canal) **e o CI passou**. Antes de publicar, reler o bloco "Entrega" do
`CLAUDE.md` — é curto e é o que trava a publicação.
