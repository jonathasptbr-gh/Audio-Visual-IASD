# A revisão geral — os dez marcos

**Revisão geral é vistoria com escopo fixo.** O que se cobra não é "olhar bem":
é **cobrir os dez marcos abaixo e provar cada um**. Sem os marcos, a varredura
de 2026-11-13 gastou sete agentes, achou 51 coisas — e deixou 8.652 linhas do
site sem ninguém abrir, porque "o site" não era o marco de ninguém.

> **A revisão profunda FOI ENCERRADA em 2026-11-09** (B10): as etapas A1..X3
> de [`REVISAO-PROFUNDA.md`](REVISAO-PROFUNDA.md) terminaram, e aquele arquivo
> e o `docs/revisao/REGISTRO.md` ficam como registro do que mediram. **O que
> vale daqui para a frente é este arquivo.** A revisão **caça DEFEITO**, não só
> higiene (decisão do operador, 14/11): as categorias de defeito são parte da
> vistoria, não um extra.

## Quando acontece

- **Pedido do operador** — é o gatilho normal.
- **Ou quando `docs/RESIDUOS.md` passa de ~15 linhas abertas**, ou quando o
  repositório acumula um intervalo grande sem vistoria (regra prática: mais de
  ~10.000 linhas mudadas, ou mais de 50 commits).

## A revisão é uma sessão própria (B11, B12)

- **A revisão FECHA no dossiê.** O conserto do que ela achou é do **lote
  seguinte** — é o que a regra do `RESIDUOS.md` já diz. A revisão de 14/11
  consertou na mesma sessão e custou 223 passos, acima do teto de 150.
- **Um agente de contexto limpo por marco**, teto de **30 passos por marco**;
  estourou, o agente para e devolve o que tem, e o marco diz o que ficou sem
  olhar.
- **Nas cinco etapas** (1 Planejando · 2 Executando · 3 Testando · 4 Publicando
  · 5 Conferindo), a revisão é a **etapa 2 de 5**. Marco não se anuncia (as
  linhas de etapa são as cinco, genéricas); **sem conserto não há etapa 4** — a
  publicação do conserto é o rito normal de um lote.

## Antes de disparar: meça o intervalo

Nenhuma varredura começa sem saber o que mudou. O medidor é uma ferramenta, não
um `git diff` lido a olho:

```bash
node tools/revisao-cobertura.mjs --base <sha-da-revisão-anterior> --head <HEAD-medido>
node tools/revisao-cobertura.mjs --tabela    # a tabela de marcos que este arquivo copia
```

- **A BASE é o HEAD MEDIDO da revisão anterior, gravado no TOPO do dossiê
  dela — nunca o commit da faxina** (B3): a revisão de 14/11 mediu até
  `ea612559` e os consertos dela saíram depois (`21b28607`) — o mesmo buraco do
  "pós-retrato" de 13/11. A revisão seguinte parte do head que a anterior
  escreveu.
- **O intervalo se mede UMA vez**, com `--head`, e esse head fica escrito no
  topo do dossiê. O fecho roda com o **MESMO head** — nunca o `HEAD` de depois
  (B7): rodar de novo contra outro head muda a conta e o "verde" não reproduz.
- **A citação** exige CAMINHO (`controle/index.html`), nunca nome solto —
  exceção: o nome solto vale quando é **único** entre os arquivos mudados (o
  site e o app têm `index.html`; `controle.js` é um só). O piso é 10% dos
  arquivos do marco citados no dossiê: um marco de 63 arquivos citando 3 não
  foi coberto, foi roçado. Binário não conta (o que se varre é texto).

Ao fechar:

```bash
node tools/revisao-cobertura.mjs --base <sha> --head <head-do-dossiê> --dossie docs/revisao/REVISAO-<data>.md
```

Ela sai com código 1 quando o dossiê não declara os DEZ títulos de marco, ou
quando um marco com mudança cita menos de 10% dos arquivos dele.

## Os dez marcos

**M1 a M8 varrem o INTERVALO** — o que mudou — **mais o que depende do que
mudou** (um símbolo mexido se varre inteiro, com os chamadores); **M9 e M10 são
INTEGRAIS** — todo o arquivo, não só o que mudou (B2). A ordem é a da tabela,
cada marco fecha antes do seguinte; a tabela — ids, títulos e padrões — sai da
ferramenta (`--tabela`), e este arquivo a **copia** (B13):

| # | marco | padrões (a ordem importa: o primeiro que casa fica com o arquivo) |
|---|---|---|
| **M4** | o tour | `^app/src/main/assets/web/controle/tour\.js$` `^tools/tour\.test\.mjs$` `^docs/arquitetura/CONTROLE-TOUR\.md$` |
| **M1** | o app web | `^app/src/main/assets/web/controle/[^/]+\.js$` `^app/src/main/assets/web/(notas|version)\.json$` |
| **M2** | a base web, o telão e a tela espelho | `^app/src/main/assets/web/shared/` `^app/src/main/assets/web/controle/shared/` `^app/src/main/assets/web/(display|espelho)/` `tokens\.css$` `^app/src/main/assets/web/vendor/` |
| **M3** | o CSS e o HTML do app | `^app/src/main/assets/web/controle/controle\.css$` `^app/src/main/assets/web/controle/index\.html$` |
| **M5** | o shell e o build | `^app/src/main/java/` `^app/src/main/res/` `^app/src/test/` `AndroidManifest\.xml$` `^app/(build\.gradle|proguard-rules)` `^build\.gradle` `^settings\.gradle` `^gradle` `^package(-lock)?\.json$` `^app/src/main/assets/[^/]+\.properties$` |
| **M6** | o site e as capturas | `^site/` `^capturas/` `^\.github/workflows/pages\.yml$` |
| **M9** | os achados antigos | `^docs/ACHADOS-EM-ABERTO\.md$` `^docs/RESIDUOS\.md$` |
| **M10** | a governança | `^docs/revisao/` `^docs/PEDIDOS-EM-ESPERA\.md$` `^docs/REVISAO-GERAL\.md$` |
| **M8** | as ferramentas e o repositório | `^tools/` `^\.github/workflows/` `^\.gitignore$` `^LICENSE$` `^AVISOS-DE-TERCEIROS\.md$` |
| **M7** | a documentação | `^docs/` `^CLAUDE\.md$` `^README\.md$` |

### O que se procura (B5 — a revisão caça defeito)

**A lista comum, em TODOS os marcos** — é a lista de verificação que a revisão
profunda usava, trazida para cá:

1. **defeito com cenário** — estado lido por duas réguas, corrida, erro
   engolido, falha calada, promessa que o código não cumpre;
2. **culto** — algo aqui pode interromper a projeção ou o som no ar? É a
   prioridade máxima, acima de qualquer outra categoria;
3. **código morto** — função sem chamador, ramo inalcançável, flag nunca lida,
   órfão de recurso removido;
4. **duplicação** — a mesma regra escrita duas vezes;
5. **desempenho** — trabalho por quadro/por status, laço sobre o acervo inteiro,
   leitura repetida de IDB/DOM;
6. **comentário** — lápide, comentário que contradiz o código, bloco no símbolo
   errado, prosa histórica que deveria estar no `HISTORICO.md`;
7. **invariantes** — as do `CLAUDE.md` (shell 1–9, ponte, `__NATIVE__`, paleta)
   continuam de pé;
8. **cobertura** — o trecho tem oráculo? o que falta e vale escrever (só o que
   trava defeito real).

**O método de refutação, o mesmo da revisão profunda:** achado ≠ conserto. Só
se corrige o **CONFIRMADO** (cenário concreto, ou medido); a suspeita fica no
relatório como suspeita, com o que falta para confirmá-la. Toda asserção nova
se prova **por reversão** — ela tem de reprovar com o conserto desfeito. Além
da lista comum, cada marco tem o específico dele, abaixo.

| # | marco | o que se procura ALÉM da lista comum | fecha quando |
|---|---|---|---|
| **M1** | o app web | parâmetro sem leitor, duplicata de regra entre funções do arquivo | todo achado tem arquivo:linha, prova e veredito |
| **M2** | a base web, o telão e a tela espelho | símbolo exportado sem chamador, token sem `var()`, dependência de terceiros sem justificativa | idem |
| **M3** | o CSS e o HTML do app | seletor sem produtor (provar as DUAS pontas), id sem leitor, `<symbol>` sem `<use>` | idem |
| **M4** | o tour | passo inalcançável, âncora que não existe, chave de "já visto" sem gravador, asserção vacuosa | idem |
| **M5** | o shell e o build | import morto, KDoc falso, `SHELL_VERSION` × `minShell` × ponte | idem, e o CI verde compensa o que não compila aqui |
| **M6** | o site e as capturas | texto velho contra o app de hoje, asset órfão, CSS/JS morto, peso, oráculo que case guia × app | idem |
| **M9** | os achados antigos | cada linha do RES e do ACH reconferida contra o código de HOJE: aberto, fechado ou obsoleto | nenhuma linha fica sem veredito |
| **M10** | a governança | achado sem casa, pacote já entregue, dossiê que omite id fechado, resíduo sem dono | as três listas concordam |

## O vocabulário, o critério de parada e a gravidade (B14)

- **Estado de um ACHADO** é um de três: **CONFIRMADO** · **REFUTADO** ·
  **OBSOLETO**, sempre com `arquivo:linha` e o comando que produziu a prova.
  **Estado de um MARCO** é **limpo** ("LIMPO — sem mudança no intervalo", com a
  prova, ou "sem achado", com a prova) ou **com achados**. O que sobrou mora no
  `RESIDUOS.md` como **aberto** (com dono) ou em **Fechado/decidido**. Não há
  outro vocabulário: "NÃO VERIFICADO" de auditoria antiga não é estado de
  resíduo — é registro daquela data.
- **Gravidade** de cada achado: **A** = causa erro ou perda · **M** = confunde
  ou custa · **B** = cosmético.
- **Critério de parada:** a revisão para quando o dossiê fecha — os dez marcos
  (o limpo também aparece, dizendo "limpo" e com que prova), o custo em passos
  e ferramentas, o que NÃO foi medido, e o resíduo no `RESIDUOS.md` — e a
  ferramenta fica verde com o head do dossiê. **O conserto não entra na
  revisão: entra no lote seguinte.**
- **Ordem:** a da tabela acima, M1 → M10; onde a área é grande, o marco se
  parte em dois, nunca se pula.

## O que o relatório de cada marco entrega

- **Veredito por achado**: CONFIRMADO · REFUTADO · OBSOLETO, sempre com
  `arquivo:linha` e o comando que produziu a prova.
- **"NÃO MEDIDO" explícito.** O que não foi exercitado — tela, aparelho, JUnit,
  Chromium — se declara. Silêncio ali vira "não há o que medir", que é falso.
- **Custo**: passos e ferramentas usados. Sem isso não se compara uma revisão com
  a outra.

## O que fecha a revisão geral

1. O dossiê em `docs/revisao/REVISAO-<data>.md`, com os DEZ marcos — cada um
   com o título da tabela (a ferramenta cobra), o marco sem mudança dizendo
   "LIMPO" com a prova, e no topo o intervalo medido (`base → head`).
2. `docs/RESIDUOS.md` com o que sobrou, cada linha com dono e tamanho.
3. `docs/PEDIDOS-EM-ESPERA.md` com os pacotes que nasceram da revisão.
4. A tabela de estado no topo do dossiê, com **todos** os ids — inclusive os
   fechados antes e os refutados. Dossiê que omite id fechado faz a próxima
   sessão reconferir o que já era.
5. `node tools/revisao-cobertura.mjs --base <sha> --head <head-do-dossiê>
   --dossie <dossiê>` **verde**: os dez títulos declarados e todo marco com
   mudança com ao menos 10% dos arquivos citados.

> **A revisão não é uma caçada: é uma vistoria.** O que se cobra não é achar
> mais, é não deixar área sem olhar. Um marco limpo, provado, vale mais que dez
> achados num marco só.

## A higienização, depois

O que a revisão achou e é **fino** (ver `docs/RESIDUOS.md`) fecha em seguida,
por um agente de contexto limpo, um lote por vez. O que pede decisão do operador
vira pacote na fila — **todo resíduo com dono `operador` ganha pacote**, ou o
`tools/estado.sh` imprime essas linhas enquanto não ganhar (B1). **Nenhuma
revisão se encerra com resíduo fino aberto sem dono.**
