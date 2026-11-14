# A revisão geral — os dez marcos

**Revisão geral é vistoria com escopo fixo.** O que se cobra não é "olhar bem":
é **cobrir os dez marcos abaixo e provar cada um**. Sem os marcos, a varredura
de 2026-11-13 gastou sete agentes, achou 51 coisas — e deixou 8.652 linhas do
site sem ninguém abrir, porque "o site" não era o marco de ninguém.

## Quando acontece

- **Pedido do operador** — é o gatilho normal.

> Este arquivo substitui o formato de [`REVISAO-PROFUNDA.md`](REVISAO-PROFUNDA.md)
> (as etapas A1..X3, de 2026-09 a 2026-11): aquele foi um plano de uma revisão
> só, cumprido e fechado. O que vale daqui para a frente é o escopo fixo dos dez
> marcos. A revisão profunda continua no repositório como registro do que ela
> mediu.
- **Ou quando `docs/RESIDUOS.md` passa de ~15 linhas abertas**, ou quando o
  repositório acumula um intervalo grande sem vistoria (regra prática: mais de
  ~10.000 linhas mudadas, ou mais de 50 commits).

## Antes de disparar: meça o intervalo

Nenhuma varredura começa sem saber o que mudou. O medidor é uma ferramenta, não
um `git diff` lido a olho:

```bash
node tools/revisao-cobertura.mjs --base <commit-da-revisão-anterior>
```

Ele imprime os marcos, quantos arquivos e linhas cada um recebeu no intervalo, e
**sai com código 1 se algum marco recebeu mudança e nenhum arquivo dele foi
citado no dossiê** — é a trava contra a área pulada em silêncio. Ao fechar:

```bash
node tools/revisao-cobertura.mjs --base <sha> --dossie docs/revisao/REVISAO-<data>.md
```

## Os dez marcos

Cada marco é **uma varredura** e **um relatório**. Um agente de contexto limpo
por marco — ele lê o repositório, não a conversa. Onde a área é grande, o marco
se parte em dois, nunca se pula.

| # | marco | escopo | o que se procura | fecha quando |
|---|---|---|---|---|
| **M1** | o app web | `assets/web/controle/controle.js` | código morto, ramo inalcançável, parâmetro sem leitor, duplicata, comentário que contradiz o corpo | todo achado tem arquivo:linha, prova e veredito |
| **M2** | a base compartilhada | `assets/web/shared/**`, `tokens.css`, `vendor/` | símbolo exportado sem chamador, token sem `var()`, dependência de terceiros sem justificativa | idem |
| **M3** | o CSS e o HTML do app | `controle/controle.css`, `controle/index.html` | seletor sem produtor (provar as DUAS pontas), id sem leitor, `<symbol>` sem `<use>`, comentário falso | idem |
| **M4** | o tour | `controle/tour.js`, `tools/tour.test.mjs`, `arquitetura/CONTROLE-TOUR.md` | passo inalcançável, âncora que não existe, chave de "já visto" sem gravador, asserção vacuosa | idem |
| **M5** | o shell | `java/**`, `res/**`, `AndroidManifest.xml`, `build.gradle.kts` | símbolo sem chamador, import morto, KDoc falso, `SHELL_VERSION` × `minShell` × ponte | idem, e o CI verde compensa o que não compila aqui |
| **M6** | **o site** | `site/**`, `.github/workflows/pages.yml` | texto velho contra o app de hoje, asset órfão, CSS/JS morto, peso, oráculo que case guia × app | idem |
| **M7** | a documentação | `docs/**`, `CLAUDE.md`, `README.md` | fato velho, link morto, contagem velha, doc órfão no mapa, índice do HISTORICO, teto do `notas.json` | idem |
| **M8** | as ferramentas e o repositório | `tools/**`, `.github/workflows/**` | oráculo fora do portão ou do workflow, ferramenta sem chamador, passo morto, arquivo grande rastreado | idem |
| **M9** | os achados antigos | `ACHADOS-EM-ABERTO`, `AUDITORIA-*`, `RESIDUOS.md` | cada linha reconferida contra o código de HOJE: aberto, fechado ou obsoleto | nenhuma linha fica sem veredito |
| **M10** | a governança | o dossiê × `PEDIDOS-EM-ESPERA` × `RESIDUOS.md` | achado sem casa, pacote já entregue, dossiê que omite id fechado, resíduo sem dono | as três listas concordam |

## O que o relatório de cada marco entrega

- **Veredito por achado**: CONFIRMADO · REFUTADO · OBSOLETO, sempre com
  `arquivo:linha` e o comando que produziu a prova.
- **"NÃO MEDIDO" explícito.** O que não foi exercitado — tela, aparelho, JUnit,
  Chromium — se declara. Silêncio ali vira "não há o que medir", que é falso.
- **Custo**: passos e ferramentas usados. Sem isso não se compara uma revisão com
  a outra.

## O que fecha a revisão geral

1. O dossiê em `docs/revisao/REVISAO-<data>.md`, com os dez marcos (marco sem
   achado também aparece, dizendo "limpo" e com que prova).
2. `docs/RESIDUOS.md` com o que sobrou, cada linha com dono e tamanho.
3. `docs/PEDIDOS-EM-ESPERA.md` com os pacotes que nasceram da revisão.
4. A tabela de estado no topo do dossiê, com **todos** os ids — inclusive os
   fechados antes e os refutados. Dossiê que omite id fechado faz a próxima
   sessão reconferir o que já era.
5. `node tools/revisao-cobertura.mjs --base <sha> --dossie <dossiê>` **verde**:
   todo marco com mudança tem arquivo citado.

> **A revisão não é uma caçada: é uma vistoria.** O que se cobra não é achar
> mais, é não deixar área sem olhar. Um marco limpo, provado, vale mais que dez
> achados num marco só.

## A higienização, depois

O que a revisão achou e é **fino** (ver `docs/RESIDUOS.md`) fecha em seguida,
por um agente de contexto limpo, um lote por vez. O que pede decisão do operador
vira pacote na fila. **Nenhuma revisão se encerra com resíduo fino aberto sem
dono.**
