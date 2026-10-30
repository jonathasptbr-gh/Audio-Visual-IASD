# Inventário da revisão A2 — a dieta do `CLAUDE.md`

A prova de que nenhuma REGRA se perdeu: cada bloco do `CLAUDE.md` de antes
(315.387 bytes, 2026-10-30, `main` em `ccr-dd2ac4d3-rmtvws`) com a casa nova.
**Nenhuma regra mudou de sentido.** O que saiu do núcleo foi COPIADO VERBATIM
para o destino (com os links relativos reescritos para o diretório novo e os
títulos promovidos de nível); no núcleo ficou um resumo de 2–10 linhas com o
link. As linhas `L…` são do arquivo antigo.

| bloco (linhas antigas) | destino |
|---|---|
| título e aviso de autossuficiência (1–15) | fica no núcleo |
| Índice (16–93) | fica no núcleo, refeito: seções, "onde mora o detalhe", "fora daqui" em tabela |
| A conversa com o operador (94–134) | fica no núcleo, inteira |
| O ganho: Presentation (135–163) | fica no núcleo, inteiro |
| Estrutura do repositório — a árvore anotada (164–347) | `docs/ESTRUTURA.md` (novo), verbatim; núcleo: árvore condensada + a linha `**33 arquivos Kotlin…` e o "meça antes de citar" |
| Invariantes 1–9, `KeepVisibleWebView` (348–437) | fica no núcleo, inteiro |
| Reconexão e morte do renderer (438–525) | `docs/arquitetura/DISPLAY.md#reconexão-e-morte-do-renderer-do-núcleo-revisão-a2`, verbatim; núcleo: 5 pontos |
| A ponte: superfície 64/76, globais, `farolContar`, URLs servíveis, token `/saf/`, privilégio do Controle, épocas (526–621) | `docs/shell/PONTE.md` (seção nova ao fim), verbatim; núcleo: 6 pontos |
| `SHELL_VERSION` (622–639) | idem PONTE.md; núcleo: o piso 83, sem guarda web, forma > acréscimo |
| As QUATRO filas, main thread do espelho, `ytCancel`, `minShell` = válvula, mudar forma (640–725) | idem PONTE.md (já coberto em "As QUATRO filas"); núcleo: tabela de 4 linhas |
| Barramento: relay paralelo (726–737) | `docs/arquitetura/MODELO-DE-DADOS.md` (seção nova ao fim), verbatim |
| O DRENO do papel `tela` (738–788) | `docs/TELAO-POR-COMANDOS.md` (seção nova ao fim), verbatim |
| A referência da preview (789–829) | `docs/arquitetura/CONTROLE.md` (seção nova ao fim), verbatim |
| O `load` carrega ponto e estado (830–863) | `docs/arquitetura/MOTOR-STAGE.md` (seção nova ao fim), verbatim |
| Barramento (as quatro, juntas) | núcleo: 4 pontos |
| Segundo plano · Sessão de mídia · OTA (864–958) | ficam no núcleo, inteiros (já eram resumo + capítulo) |
| Telão por comandos: mapa, vias, AP (959–1018) | `docs/TELAO-POR-COMANDOS.md` (seção nova ao fim), verbatim; núcleo: 9 pontos, inclusive a regra de calendário |
| As peças · As decisões · As inversões (1019–1156) | idem TELAO |
| Séries · Cifra · Pacote (1157–1242) | ficam no núcleo, inteiros (já eram resumo + capítulo) |
| A abertura por trás dos panos (1243–1311) | `docs/arquitetura/CONTROLE.md` (seção nova ao fim), verbatim; núcleo: 3 pontos |
| A paleta, as ~40 regras (1312–1756) | `docs/arquitetura/DESIGN-SYSTEM.md` (seção nova ao fim), verbatim; núcleo: as regras duras em uma linha cada |
| Divergências web × nativo, a tabela (1757–1815) | `docs/DIVERGENCIAS-WEB-NATIVO.md` (novo), verbatim; núcleo: uma linha curta por ponto |
| Compartilhamento · Microfone · Voltar · Volume · Cast · Som do espelhamento · Andaimes (1816–2044) | idem DIVERGENCIAS; núcleo: 1–3 linhas cada |
| Build: rotas, `web-ota` sem filtro e com fila (2045–2075) | `docs/BUILD.md` (novo), verbatim; núcleo: resumo |
| O arnês · prazo · paralelo · stub de 60 s · os dois passos de Chromium · rede externa · servidor de mentira · JUnit (2076–2248) | idem BUILD; núcleo: resumo em pontos |
| As regras de MÉTODO dos oráculos (2249–2348: vizinhança local/suíte no CI, workflow lista, a lista do CI, a Sanidade com o script python, reversão, reversão por cópia, `node --check`) | fica no núcleo, inteiro |
| Assinatura · Backup (2349–2417) | `docs/BUILD.md`, verbatim; núcleo: 2 pontos |
| Entrega: merge, APK não restrito, Release/`shellTag`, a nota no HISTORICO (2420–2481) | fica no núcleo, inteiro |
| Entrega: a PÁGINA do site (2482–2564) | `docs/BUILD.md` (seção "A página do site"), verbatim; núcleo: 1 ponto com as regras |
| Código (2565–2583) | fica no núcleo, inteiro |
| Código: a tabela das quatro dependências (2584–2596) | `docs/BUILD.md` (seção "As dependências"), verbatim; núcleo: 1 ponto com as quatro nomeadas |
| Diagnóstico, ~25 regras (2597–2918) | `docs/DIAGNOSTICO.md` (novo), verbatim; núcleo: 6 pontos |
| Documentação (2919–3002) | fica no núcleo; a NARRATIVA da faxina de 2026-09-07 (os 25 blocos, 1.294 linhas, 47% em três dias) → HISTORICO revisão A2 |
| O NÚMERO (3003–3034) | fica no núcleo, inteiro |
| A versão mora em TRÊS lugares (3035–3047) | fica no núcleo, inteiro |
| "Versão atual": a linha do padrão, `SHELL_VERSION`, `minShell`, `shellTag`, "pede Release?" | fica no núcleo (refeita só com o estado atual) |
| "Versão atual": os ~90 resumos de lote v1.11.7 → v1.13.15 (o parágrafo único) | HISTORICO vX já tem (conferido por varredura: toda versão citada tem entrada `**vX**`, e os símbolos em crase estão no apêndice); os que tinham símbolo SEM casa → HISTORICO revisão A2, verbatim |
| "Versão atual": os blocos `>` v1.11.10 → v1.8.16 (lotes) | HISTORICO vX já tem; v1.11.3, v1.10.9, v1.10.8, "AS DUAS JUNTAS", v1.8.99, v1.7.0/v1.8.16 e a faxina das notas → HISTORICO revisão A2, verbatim |
| "Versão atual": a REGRA do `shellTag` (acompanha a última versão; herança; gatilho é `java/`, não a ponte; o modo de falhar caro) | fica no núcleo (condensada); o texto verbatim → HISTORICO revisão A2 |
| "Versão atual": a quarta casa tem oráculo; renumerar mexe nas quatro casas + `notas.json` | fica no núcleo (condensada); verbatim → HISTORICO revisão A2 |
| "Versão atual": `apk` reprovado não pula o `web-ota` (o HOLD) | núcleo: 1 ponto; verbatim → `docs/BUILD.md` e HISTORICO revisão A2 |
| Onde procurar (3503–fim), com a linha da revisão profunda | fica no núcleo, + linhas para os arquivos novos |
