# Lançamento da 1.0 — o que falta

Levantado em 21/08/2026, sobre `959142b` (v5.317). **É arquivo para ESVAZIAR**,
como o `ACHADOS-EM-ABERTO.md`: cada item sai daqui no lote que o resolve, e o
arquivo inteiro sai quando a 1.0 sair. O que sobreviver como REGRA vai para o
capítulo que a governa — nunca fica aqui.

Os blocos marcados **MEDIDO** foram verificados no código e contra a API do
GitHub na data acima. O resto é leitura de documentação e decisão de produto.

---

## Estado: o que já foi feito

O lote de código da 1.0 **já entrou** (auditoria de 42 agentes, 118 pontos
mapeados, 25 oráculos verdes):

| feito | o quê |
|---|---|
| ✅ | `version.json` 5.317 → **1.0**, `minShell` 2 → **46**, `shellTag: "v1.0"` |
| ✅ | `WEB_VERSION` e o span do rodapé, junto |
| ✅ | `SHELL_VERSION` → **46** (a ponte ENCOLHE: saem os dois argumentos ignorados) |
| ✅ | as **37 guardas** de `__SHELL_VERSION__` do lado web |
| ✅ | a compatibilidade com bundle antigo no Kotlin (`__avOta`, `KEY_PENDING_LEGACY`, `espelho-status`) |
| ✅ | CI: guarda do `retag` contra `web-latest`, teto do `minShell`, asset de nome fixo, corpo da Release |
| ✅ | `limpar-versoes.yml` — o ritual que apaga as 103 tags/Releases antigas |
| ✅ | documentação: `CLAUDE.md`, `docs/shell/PONTE.md`, `docs/shell/OTA.md`, os capítulos |

**A decisão do §2 foi o caminho B, sem migrador.** Preço aceito e registrado:
uma **desinstalação manual, uma vez** — `beginSession` só descarta o bundle OTA
guardado quando a base do APK é MAIOR, e `1.0 < 5.317`.

### O que AINDA falta

| falta | por quê |
|---|---|
| ⬜ | **rodar o `limpar-versoes.yml`** — não há token com escrita nesta sessão; o job roda com o `GITHUB_TOKEN` do Actions |
| ⬜ | **publicar a Release `v1.0`** — depois da limpeza, nunca antes (ver §2) |
| ⬜ | **desinstalar e reinstalar** no aparelho |
| ⬜ | `LICENSE` (GPLv3) — [§4](#4--o-que-mais-o-lançamento-pede), continua BLOQUEADOR |
| ⬜ | a página, o guia do Modo Fácil e as capturas — [§1](#1--o-ponto-de-acesso) e [§3](#3--o-tutorial-do-modo-fácil) |

## Índice

| # | seção | o que decide |
|---|---|---|
| — | [Estado medido](#estado-medido) | de onde se parte |
| — | [As três decisões](#as-três-decisões-que-travam-o-resto) | **responder antes de escrever a primeira linha** |
| 1 | [O ponto de acesso](#1--o-ponto-de-acesso) | a página, o link de download, o Play Protect |
| 2 | [O versionamento](#2--o-versionamento) | a tag `v1.0`, que **não está livre** |
| 3 | [O tutorial do Modo Fácil](#3--o-tutorial-do-modo-fácil) | o roteiro e o bloqueio das capturas |
| 4 | [O que mais o lançamento pede](#4--o-que-mais-o-lançamento-pede) | licença (BLOQUEADOR), privacidade, suporte |
| — | [A ordem importa](#a-ordem-importa) | a sequência, e por que cada passo espera o anterior |

---

## Estado medido

| medida | valor |
|---|---|
| shell publicado | **v2.4** (20/08/2026) · `SHELL_VERSION` 45 |
| base web no ar | **5.317**, em `web-latest` |
| APK | **4,4 MB** (4.416.079 bytes) · **1 download** |
| tags no remoto | **104**: `v1.0`→`v1.99`, `v2.0`→`v2.4`, mais `web-latest` |
| commits | `versionCode` = `100000 + a contagem` — sobe sozinho, sem tag |
| achados em aberto | **0** · 27 oráculos · portão do CI fechado desde a v5.316 |
| repositório | **público** (o Pages sai no plano gratuito) |

**O que já não precisa de trabalho:** `ACHADOS-EM-ABERTO.md` vazio, portão do CI
fechando de verdade (com campanha de determinismo 64/64 por trás), assinatura por
keystore fixa com conferência positiva do `apksigner`, os dois canais de
atualização já unificados numa pergunta só, e as regras de backup escritas.

---

## As três decisões que travam o resto

### 1. O nome do repositório é o de hoje?

`WebUpdater.REPO` e `ShellUpdater.REPO` são constantes **compiladas no shell**.
Renomear o repositório depois de cortar a 1.0 exige um APK novo só para
consertar a URL — e o modo de falhar é MUDO: o `check()` engole tudo em `Log.i`,
e o sintoma é "a atualização parou de chegar".

É a única decisão desta lista que fica **mais cara a cada dia**. Se
`Audio-Visual-IASD` vai virar minúsculo, ou casar com o domínio, é agora.

### 2. Renumerar de verdade, ou só o rótulo?

`v1.0` **já existe**, e mais 102 irmãs. Os três caminhos e o preço de cada um
estão em [§2](#2--o-versionamento). O que barateia a escolha: a v2.4 tem **um**
download.

### 3. A 1.0 nasce só-sideload, ou já com conta na Play Store?

Distribuir `.apk` por fora funciona hoje, e é o que a página vai ensinar. Mas o
Google está implantando **verificação obrigatória de desenvolvedor para
instalação fora da loja** — um modelo só-sideload tem prazo, e o prazo não é
nosso. A conta custa US$ 25, uma vez, e vale mesmo com distribuição fechada.

Não é bloqueador da 1.0. Decidido agora, evita descobrir depois que a página
inteira ensina um caminho que deixou de existir.

---

## 1 · O ponto de acesso

### Onde a página mora

Pasta **`site/`** na raiz, publicada por workflow próprio de Pages.
**Não em `docs/`**: aquele nome já é a árvore de arquitetura, e a opção
"publicar da pasta `/docs`" do GitHub poria `CONTROLE.md` e `HISTORICO.md` no ar
como site.

| arquivo | para quê |
|---|---|
| `site/index.html` | a página: o que o app faz, baixar, instalar, guia do Modo Fácil |
| `site/.nojekyll` | vazio. Impede o Jekyll de comer qualquer caminho começado por `_` |
| `site/CNAME` | o domínio próprio, quando existir. Com deploy por Actions ele precisa estar **DENTRO do artefato** — a configuração feita só pela interface é reescrita a cada publicação |
| `.github/workflows/pages.yml` | `actions/deploy-pages`, disparado por push em `main` que toque em `site/` |

### A armadilha do prefixo — ela cobra na MIGRAÇÃO, não agora

O endereço padrão é `jonathasptbr-gh.github.io/Audio-Visual-IASD/`, com prefixo
de caminho. **O domínio próprio serve da RAIZ.** Todo link absoluto que funcionar
hoje (`/guia/`, `/img/tela.png`) quebra no dia da troca — e quebra calado, porque
o GitHub devolve a 404 dele, não um erro nosso.

**Regra desde o primeiro commit: tudo relativo** (`./guia/`, `img/tela.png`). O
mesmo build serve os dois endereços sem uma linha alterada, e a migração vira
DNS mais um arquivo `CNAME`.

### O link de download — os dois caminhos óbvios estão fechados

> **MEDIDO — o nome do asset carrega a versão.**
> `apk.yml:974` → `cp "$SRC" "dist/audio-visual-iasd-${APK_NAME}.apk"`.
> Publicado hoje: `audio-visual-iasd-v2.4.apk`. **Não há nome fixo** para o
> `/releases/latest/download/` alcançar.

> **MEDIDO — o manifesto OTA serve, mas o navegador não o alcança.**
> `web-latest/version.json` já traz `shell.versao`, `shell.apk` e `shell.bytes`.
> Mas a resposta do asset **não traz `Access-Control-Allow-Origin`** (conferido
> mandando `Origin:` da Pages): um `fetch()` da página é bloqueado pelo CORS.

**Duas medidas pequenas, e cada uma se sustenta sozinha:**

- **a · um asset de nome fixo.** O job `apk` sobe **também** uma cópia
  `audio-visual-iasd.apk`, ao lado da versionada. Isso torna
  `…/releases/latest/download/audio-visual-iasd.apk` um link permanente —
  imprimível num aviso de igreja, colável num grupo, e que nunca apodrece.
- **b · o número escrito no deploy.** O workflow da Pages **escreve** versão e
  tamanho na página ao publicar; o CI conhece a tag. Número certo sem depender de
  nada em runtime, e sem uma segunda fonte que possa discordar do aparelho.

### O que a página precisa dizer

| bloco | conteúdo |
|---|---|
| o que é | o ganho em UMA frase: a TV recebe **só a projeção**, não o espelho do celular. É o que distingue este app de qualquer outro |
| baixar | versão, tamanho, botão. Requisito: **Android 8.0+** (`minSdk 26`). Uma linha dizendo que atualiza por cima sem perder nada |
| instalar | fontes desconhecidas + Play Protect — o passo em que a instalação de fato para |
| usar | o guia do Modo Fácil ([§3](#3--o-tutorial-do-modo-fácil)) |
| suporte e privacidade | como relatar um problema, e o que o app faz com os dados ([§4](#4--o-que-mais-o-lançamento-pede)) |

### Instalar de fonte desconhecida + Play Protect — o que precisa estar certo

- **A autorização é POR APLICATIVO, não global.** Do Android 8 em diante quem
  recebe a permissão é o **navegador** que baixou (o Chrome), não o sistema.
  Quem escreve "ative fontes desconhecidas nas Configurações" manda o usuário a
  uma tela que não existe mais.
- **O Play Protect não está dizendo "vírus".** Ele avisa que não *reconhece* o
  desenvolvedor — ausência de reputação, não presença de ameaça. A frase que
  explica isso evita a desistência exata em que o download morre.
- **"Enviar para análise" é a resposta certa**, leva segundos, e é o caminho que
  constrói a reputação que hoje falta.
- O app pede `REQUEST_INSTALL_PACKAGES` — é ele que permite a atualização de
  dentro do app, e também uma das permissões que deixam o Play Protect mais
  falante. A página deve dizer por que ela está lá.
- **Capturas de cada aviso valem mais que qualquer parágrafo** — ver o bloqueio
  em [§3](#3--o-tutorial-do-modo-fácil).

---

## 2 · O versionamento

> **MEDIDO — o espaço de nomes está cheio.** 104 tags no remoto, e as 103 `v*`
> têm Release publicada. A `v1.0` foi a que saiu com assinatura de **debug** — a
> própria nota da v2.4 ainda avisa isso.

### A armadilha: a atualização só anda PARA CIMA

`ShellUpdater.kt:123` descarta o achado quando a versão anunciada não é
**estritamente maior** que a instalada:

```kotlin
if (WebUpdater.compareVersions(v, limpar(versaoInstalada(app))) <= 0) { achado = null; return }
```

Publicar uma "v1.0" nova com aparelhos em 2.4 no campo significa que eles
**NUNCA** serão avisados — sem erro, sem log visível, sem nada na tela. Ficam
parados para sempre no shell antigo, recebendo base web nova por OTA (canal
independente) e shell nenhum.

**O que barateia tudo:** a v2.4 registra **1 download**. A base instalada são os
aparelhos de quem publica.

### Os três caminhos

| | o quê | risco | preço |
|---|---|---|---|
| **A** | `v2.5` na tag, "versão 1.0" na página | nenhum | **dois números para a mesma coisa** — a divergência que este projeto recusa em todo lugar. *Não recomendado* |
| **B** ⭐ | apagar as 103 Releases/tags `v*`, recomeçar em `v1.0` | os aparelhos em 2.x precisam de UMA reinstalação manual — hoje, os seus | um ritual de limpeza, uma vez |
| **C** | `v1.0.0`, três componentes | — | **não resolve nada**: `compareVersions` compara componente a componente, `1` continua menor que `2`. *Descartado* |

### Se for o B — o que NÃO pode ser tocado

- **`web-latest` nunca é apagada.** É o canal OTA de todo aparelho instalado, e a
  URL está compilada no shell. Apagá-la mata a atualização da base web para
  sempre.
- **`versionCode` não se mexe.** Vem de `100000 + contagem de commits` e sobe
  sozinho a cada commit, sem depender de tag nenhuma. Instalar por cima segue
  funcionando **porque a keystore é a mesma** — é ela que manda, não o nome da
  versão.
- **O histórico não mora nas tags.** Está em `HISTORICO.md` e nos commits.
  Apagar Release não apaga nada que alguém vá procurar.

### A segunda linha de versão — e por que ela deve FICAR QUIETA

A base web tem número próprio (`version.json`, hoje 5.317) e ele governa o OTA
pela **mesma regra de "estritamente maior"**. Rebaixá-lo para 1.0 faria todo
aparelho instalado **recusar o bundle em silêncio** — o mesmo defeito de cima, no
outro canal, e este atinge até quem instalar a 1.0 depois.

**Recomendação: não mexer nela.** A versão pública é a do APK; a da base web é o
número de diagnóstico que responde "o OTA chegou?", e ela já aparece no rodapé ao
lado da outra (`renderVersionLabel`). Zerar as duas juntas só se paga se a
reinstalação manual for aceita de qualquer forma — e mesmo aí custa a única coisa
que a linha web dá de graça.

---

## 3 · O tutorial do Modo Fácil

### O nome, antes de escrever qualquer linha

**Na tela o nome é "Modo Fácil"**; `'simple'` é só o nome interno, e
`docs/arquitetura/CONTROLE.md:58` registra que a string do código fica como está
de propósito. O tutorial usa o nome da TELA — um guia que chama o modo por um
nome que não aparece em lugar nenhum já começa mandando o leitor procurar o que
não existe.

### O que o modo tem

| elemento | o que faz | quando aparece |
|---|---|---|
| engrenagem | o **único** acesso a Configurações neste modo | sempre, acima da cortina |
| seção de conexão | dois botões irmãos: espelhar na TV, ou transmitir para navegadores da rede | só **sem** tela conectada — içada ao centro, sobre a cortina |
| preview | a projeção em miniatura; o ícone de cast troca de tela ou desconecta | só **com** tela conectada |
| buscar música | abre o acervo; um toque na linha toca a versão Cantada **direto** | sempre |
| letra | a letra inteira, com destaque acompanhando sozinho | com música em cena |
| linha do tempo | tocar salta, arrastar procura | some quando o item não tem duração |
| ▶ · ■ · mudo | teclas grandes; ■ é "parar e limpar", o fim de cada louvor | sempre |
| volume − / + | teclas com o número no meio, nunca um slider | sempre |

### O roteiro cai daí — quatro movimentos

1. **Conectar.** Sem tela, a cortina cobre tudo e a conexão é a única coisa
   legível — o app já conduz aqui. O texto só nomeia as duas opções e diz que a
   segunda **não precisa de TV nenhuma**, só de um navegador na mesma rede.
2. **Buscar.** "Buscar música" abre o acervo. Um toque na linha **já toca** — é
   aqui que o guia precisa dizer que não há segundo passo de confirmação, porque
   a ausência dele é o que surpreende.
3. **Tocar.** ▶, ■ e mudo. A letra sobe sozinha no alto. A barra aceita toque e
   arraste — voltar o refrão é a coisa mais comum num louvor, e é o que **parece**
   que não dá para fazer neste modo.
4. **Controlar sem olhar.** Volume por − e +, os botões físicos do celular, e a
   notificação de mídia — que controla com o app minimizado e o celular
   bloqueado, que é como ele passa o culto no suporte.

### Onde o tutorial mora — e por que NÃO nos dois

**Na página, para a 1.0.** O app não tem tela de ajuda, e criar uma é trabalho de
produto, não de lançamento. A página ainda alcança quem **ainda não instalou** —
metade do público de um lançamento.

Se um dia entrar no app, entra como `openExternal` para a MESMA página. **Nunca
como segunda cópia**: duas listas divergem no primeiro esquecimento, que é a
regra que o próprio projeto aplica ao dreno da tela e à tabela de popups.

*A contrapartida honesta:* a igreja com Wi-Fi ruim não abre a página na hora da
dúvida. Se isso pesar, a saída barata é um PDF de uma página, baixável pela
própria página — não uma segunda implementação.

### O BLOQUEIO real

**Não existem capturas de tela**, e um guia de operação sem imagem é um guia que
ninguém segue. Elas têm de sair de um aparelho de verdade, em **dois estados**:
sem tela conectada (a cortina e o cartão de conexão) e com tela conectada (a
preview no lugar dele). Mais os dois avisos do Android durante a instalação, que
só aparecem numa instalação de verdade.

É a única tarefa deste lançamento que nenhuma sessão resolve sozinha.

---

## 4 · O que mais o lançamento pede

### A licença — ausente, e é OBRIGAÇÃO, não formalidade

> **MEDIDO.** O `NewPipeExtractor` — a dependência pinada em
> `app/build.gradle.kts` — é **GPLv3**. Não há arquivo `LICENSE` na raiz.

Distribuir publicamente um binário com GPLv3 dentro obriga a licenciar o
conjunto sob GPLv3 e a oferecer o código correspondente a quem recebe. O
repositório é público, então a fonte já está disponível — mas **sem `LICENSE` o
padrão legal é "todos os direitos reservados"**, que é exatamente o incompatível
com a obrigação que a dependência cria.

Enquanto os APKs eram builds internos, ninguém "recebia" nada. Uma **versão
pública definitiva** muda essa frase, e é por isso que o item aparece agora e não
antes.

O `pptx-renderer` é Apache-2.0, que **é** compatível com GPLv3 numa via só (pode
entrar num trabalho GPLv3) — não há conflito ali. A correção é um `LICENSE` com o
texto da GPLv3 mais uma nota de terceiros; o `vendor/LICENSE-pptx-renderer.txt`
já existe. **Um commit.**

### Política de privacidade

O app pede microfone, lê pastas do aparelho, abre um servidor na rede da igreja e
fala com LouvorJA e YouTube. Mesmo fora da Play Store, uma seção que diz o que
**sai** do aparelho — nada, fora as buscas — é o sinal de confiança de que este
público precisa mais que a maioria. E vira obrigatória no dia em que houver
listagem na loja. A resposta é curta e favorável: **não há servidor nosso, não há
conta, não há telemetria.**

### O canal de suporte já está meio pronto

O app tem **Configurações → Registro → copiar**, com botão de cópia em todo campo
de log — a metade difícil de um fluxo de suporte, já construída. Falta a metade
fácil: a página dizer *"antes de relatar, copie o Registro e cole no relato"*, e
nomear onde relatar. As Issues estão sem uso; um e-mail serve igual, e para este
público provavelmente melhor.

### O README fala com a pessoa errada

Hoje ele abre em `android.app.Presentation` e termina em `./gradlew
assembleDebug`. Numa 1.0 pública a primeira linha é o link da página, e o
conteúdo de desenvolvedor desce. Quem chega ao repositório vindo do `.apk` quer
instalar, não compilar.

### O workflow não tem filtro de caminho

Não há `paths-ignore`: editar uma vírgula em `site/` e empurrar para `main`
dispara o `web-ota` inteiro e republica o bundle sem necessidade. Não quebra nada
(o aparelho descarta versão igual), mas gasta runner e reescreve os assets de
`web-latest` à toa — a mesma janela de intercalação que a fila `concurrency`
existe para fechar. **Vale fazer DEPOIS do corte:** mexe em maquinário sensível,
e um erro ali para o canal OTA.

---

## A ordem importa

Cada passo depende do anterior por um motivo concreto, não por arrumação.

1. **Fechar o nome do repositório.** A URL está compilada no shell; depois do
   corte, renomear custa um APK novo — e falha calado.
2. **`LICENSE` (GPLv3) na raiz.** A 1.0 é a primeira que sai como versão
   pública: a obrigação nasce com ela.
3. **Decidir A, B ou C do versionamento.** Sendo o B, a limpeza das 103 Releases
   vem aqui — **preservando `web-latest`**.
4. **Escrever a página, com o guia do Modo Fácil dentro.** Sem as capturas ainda;
   o texto e a estrutura não dependem delas.
5. **Ajustar o CI: asset de nome fixo + workflow da Pages.** O nome fixo precisa
   existir **antes** da primeira Release da 1.0, senão o link permanente nasce
   apontando para o vazio.
6. **Declarar `"shellTag": "v1.0"` no `version.json`.** É isso que faz o
   `web-ota` segurar o bundle até a Release existir, e depois republicar o
   manifesto com o link do APK dentro.
7. **Merge em `main`.** O canal segura e diz no resumo do run que está segurando
   — o estado normal entre o merge e a Release.
8. **Actions → *Build APK* → `release_tag: v1.0`.** A tag nasce do próprio
   workflow, a partir de `main`.
9. **Conferir o manifesto e instalar num aparelho limpo.** O manifesto tem de
   voltar com `shell.versao: "1.0"`. A instalação limpa é o que valida o guia — e
   é quando as capturas são tiradas.
10. **Ligar o Pages, e só então o domínio próprio.** O endereço do `github.io`
    tem de funcionar inteiro antes de o DNS entrar na conta: um link relativo
    quebrado e um DNS ainda propagando parecem o mesmo problema.
