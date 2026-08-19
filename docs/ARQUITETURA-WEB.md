# Claude Code — Audio Visual IASD

A **base web** do sistema de projeção de mídia para culto (IASD): duas telas no
mesmo origin — **Controle** (celular do operador) e **Display** (o telão) — em
JavaScript puro, sem frameworks nem dependências de build. Funciona 100%
offline.

> Este documento cobre **só a base web** (`app/src/main/assets/web/`). A casca
> Android que a hospeda — Presentation, ponte `AVNative`, SAF, OTA, serviço de
> segundo plano — está em [`../CLAUDE.md`](../CLAUDE.md).

## Índice

1. [Regra obrigatória após qualquer alteração](#regra-obrigatória-após-qualquer-alteração) — fluxo de git/merge
2. [Regras de desenvolvimento](#regras-de-desenvolvimento) — invariantes do projeto
3. [A ideia](#a-ideia-duas-telas-um-só-estado) — duas telas, um só estado
4. [Estrutura de arquivos](#estrutura-de-arquivos)
5. [Documento em cena](#documento-em-cena-pdf-powerpoint-google-apresentações) — PDF, PowerPoint e Google Apresentações viram páginas
6. [Modelo de dados (`shared/db.js`)](#modelo-de-dados-shareddbjs) — IDB, OPFS, BroadcastChannel
7. [Motor de renderização (`shared/stage.js`)](#motor-de-renderização-sharedstagejs) — cortina, fades, concorrência
8. [Controle](#controle) — layout, mixer, biblioteca, coleções (LouvorJA), letra sincronizada
9. [Camada de Texto](#camada-de-texto-bíblia--mensagens--letra) — Bíblia, Mensagens, letra avulsa, cronômetro, sorteio, letra sincronizada
10. [Bíblia](#bíblia-aba-bible) — seleção, leitura e projeção
11. [Display](#display) — wallpaper, YouTube, microfone, recuperação de áudio
12. [Design System](#design-system--a-identidade-oficial-iasd-em-dois-temas) — a paleta oficial, os dois temas, tokens, contraste
13. [Fonte de ícones (Material Symbols)](#fonte-de-ícones-material-symbols)
14. [Build, distribuição e instalação](#build-distribuição-e-instalação) — e como esta base é SERVIDA (asset loader + OTA)

---

## Regra obrigatória após qualquer alteração

**Sempre fazer merge com `main` ao finalizar qualquer atualização nos arquivos.**

Fluxo padrão:
```bash
# 1. Desenvolver na branch designada
git add <arquivos>
git commit -m "mensagem descritiva"
git push -u origin <branch>

# 2. Merge obrigatório para main
git checkout main
git merge <branch> --no-ff -m "Merge: <descrição resumida>"
git push origin main
```

---

## Regras de desenvolvimento

- **Contexto de execução fixo: as duas telas SEMPRE rodam dentro do app
  Android**, em dispositivo móvel — o Controle no celular do operador, o
  Display numa `Presentation` na TV. Não projetar nem otimizar para aba de
  navegador ou desktop: decisões de UX/autoplay/layout assumem esse contexto.
  Rodar no navegador continua sendo obrigatório (é como se desenvolve e testa
  fora do aparelho), mas não é o alvo do desenho.
- Nunca perder funcionalidades existentes ao refatorar.
- **Seleção de texto desligada globalmente nos dois apps** (`user-select:
  none !important` + `-webkit-touch-callout: none` +
  `-webkit-tap-highlight-color: transparent` no seletor `*`, em
  `controle.css`/`display.css`) — nenhum dos dois é um documento de texto; um
  toque comprido em botão/linha/telão não deve abrir menu de seleção/copiar. O
  `!important` é necessário porque a UA stylesheet do navegador tem
  especificidade maior que `*` e podia reativar a seleção em algum elemento no
  aparelho. Única exceção: `input, textarea` no Controle (`user-select: text
  !important`, que vence o `*` pela maior especificidade) — os campos de busca
  (`#libSearch`/`#hymnSearchInput`) precisam continuar editáveis/selecionáveis.
- Toda operação IDB multi-passo que precise de atomicidade deve usar `storeTx()`.
- **Mídia PARADA não tem pulso — teste com ela.** Boa parte da UI do Controle é
  reposta de graça pelo `timeupdate` da preview, que só existe em áudio e vídeo.
  Uma imagem (e uma apresentação, que é imagem) não dispara nada: ali, um estado
  que alguém esqueceu de redesenhar fica **permanente**, enquanto no áudio ele se
  conserta sozinho no quadro seguinte e passa despercebido. Foi assim o defeito
  da v5.101 (ver "Documento em cena"). Ao mexer em qualquer render de cena,
  repita o teste com uma imagem em cena, não só com uma música.
- Não introduzir dependências externas — JavaScript puro no cliente, Kotlin puro
  + AndroidX oficial no shell. **UMA exceção deste lado, e ela carrega sob
  demanda:**
  - (a **IFrame Player API do YouTube** era a segunda e SAIU na v5.212, com o
    embed inteiro — ver "YouTube — o EMBED SAIU". Ela executava no MESMO
    documento em que o shell publica `__AVBridge`, e `addJavascriptInterface`
    injeta a ponte em todas as frames: no Controle isso era a ponte COMPLETA à
    disposição de um script de terceiro. Hoje o YouTube toca por transmissão
    direta ou pelo arquivo baixado, nos dois casos num `<video>` comum;)
  - o **renderizador de `.pptx`** (`vendor/pptx-renderer.js`, Apache-2.0, por
    `import()` dinâmico) — existe porque o Android **não desenha PowerPoint** e
    as alternativas eram todas piores: bibliotecas nativas comerciais, um
    servidor de conversão (que manda o material do culto para fora do aparelho)
    ou escrever DrawingML à mão (que produz um slide PARECIDO com o que o pastor
    montou). O levantamento inteiro está no `LEIA-ME.md` daquela pasta.

  Uma terceira exceção precisa do mesmo tipo de justificativa: um problema que
  não se resolve de outro jeito, e a conta da manutenção paga por quem publica
  a biblioteca.
- Ao atualizar o código, atualizar este documento se a mudança afetar arquitetura, protocolo de comandos ou API pública. Mudanças no shell (Kotlin) vão em `../CLAUDE.md`.
- **Todo código novo precisa continuar rodando no navegador.** Caminhos
  específicos do nativo entram sempre como `if (!window.__NATIVE__) { …web… }`
  — nunca o inverso: o comportamento de navegador é o padrão, e o nativo é a
  exceção que se declara. Os pontos onde os dois divergem (autoplay, pastas do
  dispositivo, compartilhamento, fullscreen, atualização) estão tabelados em
  `../CLAUDE.md`, "Divergências entre o caminho web e o nativo".
- **A cada atualização de código, incrementar a versão visual do Controle** em
  **três lugares que precisam bater**:
  1. `version` em `assets/web/version.json` — **a fonte da verdade**. É este
     valor que o `WebUpdater` compara e que dispara (ou não) a atualização por
     OTA nos aparelhos.
  2. a constante `WEB_VERSION` em `controle/controle.js` — é ela que o rodapé
     de Configurações renderiza (`renderVersionLabel()`). Esquecê-la é o erro mais
     traiçoeiro dos três: o OTA entrega o bundle novo e o aparelho continua
     **exibindo a versão antiga**, que é exatamente a leitura que o indicador
     existe para dar.
  3. o fallback estático do `<span id="appVersion">` em `controle/index.html`
     — o que aparece antes de o JS rodar.

  Versionamento incremental simples (5.46, 5.47, 5.48…). **Este documento não
  registra a versão corrente**: um número fixo aqui é a 19ª cópia a
  desatualizar, e quem partisse dela escreveria em `version.json` um valor
  MENOR que o já publicado — caso em que `WebUpdater.compareVersions` ignora o
  bundle em silêncio. Para saber onde a base está, leia `version.json`.

  No app nativo o rótulo mostra os **dois índices** — `Web v5.86 · Shell v1.31`
  —, porque base web e shell atualizam por caminhos independentes (OTA ×
  instalar APK); no navegador sai só `Controle v<versão>`. **Ele mora no rodapé
  do popup de Configurações** desde a v5.49 (antes ficava no cabeçalho da lista,
  visível só na aba Cronograma): versão é metadado de diagnóstico, e o lugar
  onde se procura diagnóstico é junto do estado do telão e do alvo de
  espelhamento.

---

## A ideia: duas telas, um só estado

O sistema é **duas telas** — o **Controle** (celular do operador) e o
**Display** (o telão) — que rodam no **mesmo origin** e por isso compartilham:

- **IndexedDB** — metadados, listas e blobs importados, visíveis pelas duas.
- **OPFS** (Origin Private File System) — bytes dos arquivos sincronizados de
  pastas do dispositivo; acesso permanente, sem prompts de permissão.
- **BroadcastChannel** (`av-iasd`) — o Controle envia comandos em tempo real
  para o Display.

**Onde cada uma roda:** no aparelho, o shell nativo abre as duas em WebViews do
mesmo processo/origin — o Controle na Activity e o Display numa
`android.app.Presentation`, que vai **só ele** para a TV. No navegador (só para
desenvolver) são duas páginas, `/controle/` e `/display/`.

> **De onde isso veio.** A arquitetura nasceu como **dois PWAs instaláveis**,
> porque o Miracast só espelha a tela inteira do celular e a única saída era
> instalar o Display como app separado para espelhar apenas ele. A
> `Presentation` resolveu isso de verdade, e os andaimes daquele modelo
> (`manifest.json`, ícones de WebAPK, service workers, a página com os dois
> links) **foram removidos** — ver CLAUDE.md, "Andaimes do modelo de dois
> PWAs". O que ficou é justamente o que era bom: mesmo origin, IDB/OPFS/
> BroadcastChannel compartilhados e um protocolo de comandos que não mudou.

Tudo funciona **100% offline** — os arquivos vêm do APK (ou do bundle OTA já
baixado) —, exceto o que depende de rede por natureza: vídeos do YouTube,
itens de URL externa e a primeira sincronização do acervo LouvorJA.

---

## Estrutura de arquivos

```
app/src/main/assets/web/
├── version.json                # identidade do bundle OTA (version + minShell)
├── shared/
│   ├── tokens.css              # A PALETA — fonte única, carregada pelos DOIS apps
│   ├── native.js               # ponte AVNative (só existe no app; no-op no navegador)
│   ├── db.js                   # Camada comum: IndexedDB + OPFS + BroadcastChannel (+ relay nativo)
│   ├── stage.js                # Motor de renderização compartilhado
│   ├── stage.css               # CSS do motor (o indicador de espera) — FOLHA e
│   │                           # não `<style>` em runtime: a CSP das telas da
│   │                           # rede bloqueia estilo embutido (v5.205)
│   ├── material-symbols.css    # Font-face da fonte de ícones (subset offline; só o Controle usa)
│   └── fonts/
│       └── material-symbols.woff2  # ~2.2 KB — 30 glifos, todos em uso
├── vendor/                     # ÚNICO código de terceiro daqui — carregado sob demanda
│   ├── pptx-renderer.js        # desenha .pptx (Apache-2.0); ver o LEIA-ME da pasta
│   ├── LICENSE-pptx-renderer.txt
│   └── LEIA-ME.md              # por que a exceção existe, e como atualizar
├── controle/
│   ├── index.html              # UI do operador
│   ├── controle.css            # Estilos do Controle
│   ├── controle.js             # Lógica do Controle
│   ├── louvorja.js             # Cliente da API pública do LouvorJA (Coleções de mídia — ver seção própria)
│   ├── serie.js                # A REGRA das SÉRIES do YouTube — PURA (sem DOM, sem
│   │                           # rede), com oráculo em Node: decide quais playlists
│   │                           # de um canal formam um álbum e o que é LIBRAS
│   └── bible.js                # Cliente da parte bíblica do banco LouvorJA (livros/versões/capítulos — ver seção "Bíblia")
├── espelho/                    # o papel `tela` (telão nas telas da rede)
│   ├── tela.js                 # a casca: SSE, dreno de subida, entrada, relógio
│   └── tela.css                # o CSS da ENTRADA — folha pelo mesmo motivo do
│                               # stage.css (ver o cabeçalho do arquivo)
└── display/
    ├── index.html              # UI do Display (inclui iframe #youtube)
    ├── display.css             # Estilos do Display
    └── display.js              # Lógica do Display
docs/
└── FONTE-DE-DADOS-LOUVORJA.md  # Referência técnica do banco compartilhado (app-ja/LouvorJA)
```

Sem `manifest.json`, sem `icons/`, sem `sw.js` e sem `server.js`: ícone, nome e
orientação vêm do APK, os arquivos são locais por natureza e a atualização é
por OTA (ver "Build, distribuição e instalação", no fim, e o `CLAUDE.md`).

`vendor/` é a única pasta aqui que não é código do projeto, e **nada fora do
caminho do `.pptx` a carrega**: ela entra por `import()` dinâmico, na hora em
que alguém importa uma apresentação. Um arquivo buildado de 1,5 MB no boot
custaria isso a todo culto, e a todo aparelho, para um recurso que a maioria
dos cultos não usa.

---

## Documento em cena: PDF, PowerPoint, Google Apresentações

O que o operador tem na mão é um PDF, um PowerPoint ou um Google
Apresentações. O que o app guarda é **uma imagem por página** — e é essa
tradução que torna o recurso pequeno: a partir dela a apresentação é mídia
comum, com o fade, a cortina, o telão e a `MediaSession` que já existem há
dezenas de versões.

**Não é um recurso de "apresentação", é um TIPO DE ARQUIVO a mais.** Não há
botão próprio, nem aba, nem fluxo separado (a v5.98 teve um, e ele saiu na
v5.99): o operador escolhe o ARQUIVO, e o app decide o que fazer com ele. Um
PDF comum — um roteiro, uma partitura, um comunicado — entra do mesmo jeito
que um de apresentação, porque para o app não há diferença entre os dois.

**Cada formato pelo caminho que existe para ele:**

- **PDF → o shell.** O Android traz um renderizador de PDF **na plataforma**
  (`PdfRenderer`, API 21+): fidelidade total e zero dependência. Ver
  `SlideDeck.kt`. É também o caminho do **Google Apresentações**, que tem uma
  URL de exportação em PDF (`/presentation/d/<id>/export/pdf`) — o shell a monta
  a partir do link e baixa, sem o operador exportar nada. Precisa estar
  compartilhada por link, que é como um roteiro de culto circula.
- **`.pptx` → o próprio WebView.** Aqui o Android não ajuda: não existe na
  plataforma quem desenhe OOXML. O renderizador é a única dependência do lado
  web (`assets/web/vendor/pptx-renderer.js`, Apache-2.0 — o levantamento que
  justifica a exceção está no `LEIA-ME.md` daquela pasta), e ele entra por
  `import()` **dinâmico**: é 1,5 MB que só interessa a quem importar um `.pptx`,
  e carregá-lo no boot custaria isso a todo culto.
- **`.ppt` (anterior a 2007) e `.odp` ficam de fora**, no `accept` do seletor e
  nos `intent-filter`: ninguém sabe desenhá-los, e aceitar para depois falhar é
  pior do que não aceitar.

**O `.pptx` produz DOM; o app projeta IMAGEM.** A ponte entre os dois é
`elementoParaPng`, sem biblioteca nenhuma: o slide vai para dentro de um
`<foreignObject>` de SVG, que o navegador desenha como imagem, e daí para um
canvas. Dois detalhes que não são opcionais:

- **As `<img>` do slide são `blob:`, e uma URL blob NÃO carrega dentro do
  `foreignObject`** (o SVG é um documento à parte). Cada uma é redesenhada num
  canvas e vira `data:` antes da serialização — sem esse passo a foto do slide
  simplesmente não aparece, e o defeito é silencioso.
- **Fundo branco antes de desenhar**, como no lado nativo: o slide pode não
  pintar o próprio papel, e transparente, no telão, é o preto do palco — o texto
  escuro sumiria.

O palco de renderização fica `position:fixed; left:-99999px`, e não
`display:none`: sem layout não há o que rasterizar.

**As portas de entrada são as mesmas de qualquer arquivo:**

- **"Importar arquivos"**, no rodapé fixo do Cronograma. No app (shell ≥ 21) esse botão
  abre o seletor do SISTEMA (`AVNative.pickDoc`, com a lista de mimes), e não o
  `<input type="file">`: aquele devolve um `File` — bytes já lidos —, e quem
  desenha o PDF é o shell, que precisa do ARQUIVO; devolver os bytes pela ponte
  inverteria o princípio dela ("URLs servíveis, nunca bytes") e faria um vídeo
  de 2 GB passar pela memória do WebView. O seletor do sistema entrega
  `content://` para TUDO — a mesma porta por onde as pastas do dispositivo já
  entram —, então a importação inteira passou a ser uma coisa só. No navegador
  (e num shell antigo) continua o `<input type="file">` de sempre, com o `.pptx`
  no `accept`; ali o PDF é o único que não tem como funcionar.
- **Compartilhar** um PDF, um `.pptx` ou o link do Google com o app.
- **Um arquivo ilegível avisa** (PDF com senha, `.pptx` corrompido): diálogo, e
  não um aviso que some sozinho — o operador acabou de escolher um arquivo, e
  silêncio ali leria como "importou". É o uso do diálogo em modo AVISO
  (`cancelText: null` esconde o botão de cancelar: ele não pergunta nada), e o
  texto é um só (`avisarNaoAbriu`) para as duas portas de entrada.
- **E o aviso diz POR QUE** (v5.100), num parêntese no fim: `deckUltimoErro`
  carrega o motivo do ponto que falhou até o diálogo — inclusive o do lado
  Kotlin, já que `deckPages` passou a devolver `{ erro }` em vez de `null`.
  Sem isso, todo defeito deste caminho chegava como a mesma frase, e a primeira
  causa real (o ramo de `https` que engolia o `/saf/`, ver o CLAUDE.md)
  sobreviveu a duas versões parecendo "PDF com senha". Este código roda no
  aparelho do operador, num domingo de manhã, e quem desenvolve não tem o
  aparelho na mão: o diagnóstico precisa caber na tela.

**O registro** é `kind: 'deck'` com `pages: [Blob]` — as páginas ficam DENTRO
do próprio registro de mídia, não em arquivos soltos no OPFS, para que o gc que
já existe as leve junto quando o item sai da última lista. Páginas no OPFS
pediriam uma faxina paralela, que é o tipo de bookkeeping duplicado que vaza
espaço em silêncio. O IndexedDB guarda Blob por referência: ler o registro não
traz os bytes de dezenas de páginas para a memória.

**O nome e o eixo dos botões descrevem a MESMA cena** — e por isso andam
juntos (v5.101). Tudo o que muda a resposta de `slideTarget()` precisa chamar
`renderSlideNav()`, não só `renderNowPlaying()`. O nome tem muito mais caminhos
de atualização que o eixo, então a divergência aparece sempre igual: cabeçalho
certo, botões errados. Foi o defeito da v5.100 — projetar o **cronômetro** ou o
**sorteio** sobre uma apresentação derruba o alvo para `null`, e ao tirá-los o
nome voltava a dizer "1/9" com ⏮/⏭ apagados. Numa mídia com tempo o pulso de
`timeupdate` repunha os limites sozinho e o defeito passava despercebido; **um
deck é imagem parada**, então nada mais rodava e ele ficava permanente. Só uma
importação consertava, por acidente: ela termina em `load()`, que chama
`renderSlideNav()`.

**A navegação é o par ⏮/⏭ que já passa estrofe** (`slideTarget()` devolve
`'deck'`): cada toque passa uma página, e os botões desabilitam nos extremos
como em qualquer outro alvo de slide. O comando é um `page` próprio, e não um
`load` novo — recarregar a mídia para trocar uma imagem que já está na mão
faria o telão piscar preto a cada slide. A `MediaSession` acompanha: o rótulo
dos botões diz "(página)" em vez de "(estrofe)" quando é uma apresentação que
está no ar (`slideLabel`).

> **O `slideLabel` só chegou de fato à notificação na v5.102.** Ele nasceu na
> v5.97 no `pushNowPlaying` e o `SessionService` já o lia desde então — mas
> `shared/native.js` monta o objeto da ponte **campo a campo**, e este ficou de
> fora: a notificação escreveu "(estrofe)" durante toda a rodada das
> apresentações, sem erro em lugar nenhum. É a forma de falhar típica dessa
> função — um campo esquecido ali some em silêncio, e o lado nativo lê o
> `optString` vazio como "use o padrão". Ao acrescentar um campo em
> `pushNowPlaying`, acrescente-o também em `AVNative.nowPlaying`.
>
> Na mesma versão a palavra passou a sair da tabela `SLIDE_AXIS_NAME` — a
> mesma que nomeia os botões da tela —, em vez de um ternário local que
> respondia "estrofe" para versículo e para mensagem.

**A reconexão do telão volta na página certa**, pelo mesmo motivo do tempo de
uma mídia: um dongle que cai no meio da pregação não pode devolver o primeiro
slide na frente de todo mundo — o `load` do reenvio leva o `page`.

## Modelo de dados (`shared/db.js`)

### IndexedDB — banco `av-iasd` v3

| Object Store | Chave | Conteúdo |
|---|---|---|
| `media` | `id` (UUID), índice `youtubeId` | `{ id, blob, url, thumb, type, kind, name, youtubeId, pages, cue, data, createdAt }` |
| `files` | `id` (UUID), índice `folder` | catálogo OPFS: `{ id, folder, opfsPath, srcName, name, type, kind, size, mtime, thumb, addedAt }` |
| `state` | chave string | valor arbitrário (listas, estado atual, pastas dos Favoritos, transições…) |

Um registro de mídia tem **`blob`, `url`, `opfsPath` OU `pages`** (nunca mais
de um): blobs locais importados, itens de URL externa (link direto, YouTube),
arquivos sincronizados no OPFS ou as páginas de uma apresentação. `thumb` pode
ser um `Blob` (miniatura gerada via Canvas) ou uma **string URL** (ex:
thumbnail `hqdefault.jpg` do YouTube).

**E há um quinto caso, que não tem bytes nenhum: `kind: 'cue'`** — a cena de
roteiro (v5.103). Ver "Cenas de roteiro", logo abaixo do modelo de listas.

**A conexão é memorizada; a FALHA não.** `openDB()` guarda a promise da
conexão, mas zera esse cache no caminho de erro. Até a v5.47 a promise
**rejeitada** também ficava memorizada: uma única falha do `indexedDB.open`
(pressão de armazenamento, renderer se recuperando de um OOM) deixava o `AVDB`
inteiro rejeitando para sempre, e o app ficava sem dados até ser fechado e
reaberto — sem nenhum caminho de recuperação. Zerando o cache, a chamada
seguinte simplesmente tenta de novo. O `forget()` confere se o cache ainda é
*esta* promise antes de anulá-lo, senão um `openDB` posterior abriria uma
terceira conexão à toa.

**Os três eventos de ciclo de vida que faltavam**, e todos os três se resumem
a "não deixar o chamador pendurado":

- `db.onversionchange` — a **outra página** (Controle × Display, mesmo origin)
  pediu um upgrade. Sem fechar a conexão daqui, ela bloqueia o upgrade de lá e
  aquela página fica esperando para sempre, com a tela montada e sem dado
  nenhum. Hoje o caso não chega a acontecer no app (o `beginSession` do shell
  fixa um único bundle por sessão, logo um único `DB_VERSION`) — mas o dia em
  que `DB_VERSION` subir de 2 para 3 é exatamente o dia em que ninguém vai
  lembrar disto.
- `req.onblocked` — a ponta oposta: se ALGUÉM não fechar a conexão velha, este
  é o único aviso que existe. Sem ele o `open` não resolve **nem** rejeita.
- `db.onclose` — o navegador pode fechar a conexão por fora numa falha de
  armazenamento; o handle memorizado está morto e precisa ser reaberto.

> **Atenção:** qualquer código que abra o banco fora de `db.js` deve usar
> `indexedDB.open('av-iasd')` **sem número de versão**, para não quebrar com
> `VersionError` quando o schema for atualizado — e precisa de um
> `onupgradeneeded` que crie ao menos o store `state`, senão numa instalação
> nova o banco nasceria sem nenhum object store e o `transaction('state')`
> lançaria `NotFoundError`. Hoje **não há** nenhum abridor externo (o service
> worker que gravava o share sumiu junto com os andaimes de PWA — ver
> "Compartilhamento"); a regra fica registrada porque o `if (!contains(...))`
> do upgrade 1→2 existe por causa dela.

### OPFS + catálogo (`files`)

Os **bytes** dos arquivos de pastas sincronizadas moram no **OPFS**
(`navigator.storage.getDirectory()`), em `folders/<folderId>/<arquivo>`. O
store `files` do IDB guarda apenas **metadados + thumbnail** — por isso listar
e buscar centenas de arquivos é instantâneo (nunca toca o disco); o arquivo só
é aberto na hora de reproduzir (`opfsGetFile` → `URL.createObjectURL`).

- OPFS pertence ao origin: **nenhuma permissão é pedida** para ler — nem no
  Controle, nem no Display (mesmo origin ⇒ mesmo OPFS).
- `getMedia(id)` procura em `media` e cai para `files` — assim IDs do catálogo
  entram em `playlist`/`imports`/pastas dos Favoritos **sem copiar bytes**.
- O `gc()` das listas só apaga do store `media`; registros de `files`
  pertencem à sua pasta OPFS e só são removidos pela exclusão na pasta.
- `renameMedia` cobre os dois stores (no catálogo, renomeia só a exibição;
  o `opfsPath` não muda).

**Três listas nomeadas** (arrays de IDs guardados em `state`): `imports`,
`playlist` e `avulsos`. Migração: `imports` herda o antigo state `order` se
`imports` ainda não existir. (A antiga lista `favorites` foi removida — ver
legado nas chaves de `state`.)

**`avulsos` (v5.87) é a única que o operador não vê.** Ela existe porque
"Tocar agora" num resultado do YouTube não tem nada a ver com o Cronograma —
o vídeo só precisa ir ao telão —, mas um registro em lista NENHUMA é
vazamento permanente: o gc só alcança o que alguma lista já segurou (ver a
nota das funções removidas na v5.48). `avulsos` é o detentor dessa mídia, e é uma
prateleira PEQUENA e de tamanho fixo (`AVULSO_MAX` = 3, no Controle): quem
entra empurra o mais ANTIGO para fora, e aí o `listRemove` decide sozinho — o
blob some se ninguém mais o quiser e fica inteiro se o Cronograma, a playlist
ou um Favorito também o tiverem.

O tamanho é a escolha entre dois extremos ruins. Com **um** lugar, voltar ao
vídeo anterior baixa tudo de novo — exatamente o desperdício que a v5.87
existe para acabar. **Sem limite**, a mídia que a tela não mostra vira uma
pilha de centenas de MB que o operador não tem como apagar (não existe tela de
liberar espaço; o rodapé de uso é só informativo). Três cobre o uso real —
alternar entre dois ou três vídeos num mesmo culto. O que ele quiser guardar,
guarda pelas outras duas opções da mesma folha.

##### Uma prateleira invisível que segurava o que já tinha sido excluído (v5.118)

Sintoma relatado do aparelho: um vídeo já removido de TODAS as telas continuava
marcado como "já está aqui" (✓) na lista de resultados do YouTube — e não havia
onde removê-lo.

A causa é o encontro de duas peças que estavam certas separadamente.
`deleteSelected` chama `listRemove(activeTab, id)` — só da aba ATIVA, o que é o
comportamento correto (excluir do Cronograma não pode tirar da playlist). E
`avulsos` conta para o `isReferenced`, o que também é correto — é o que impede o
gc de apagar a mídia projetada. Juntas: quem tocasse "Tocar agora" e depois
adicionasse o mesmo vídeo ao Cronograma ficava com DOIS detentores, e excluir
pelo Cronograma deixava a prateleira segurando o registro. O blob permanecia no
aparelho, invisível em toda tela, e o ✓ da busca — que pergunta `mediaByYoutube`,
isto é, "existe blob?" — continuava aceso, com razão e sem saída.

A regra que faltava: **excluir é uma declaração de intenção, e ela vale para os
detentores que o operador não pode enxergar.** A prateleira é cache, não
biblioteca. `soltarAvulso(id)` roda junto de toda exclusão explícita.

Com **uma** exceção, e ela é o motivo de a função existir em vez de a linha ser
escrita inline: o que está em CENA agora. Ali a prateleira faz exatamente o
trabalho para o qual foi criada, e soltá-la apagaria o blob de baixo de uma
projeção em andamento — o vídeo seguiria tocando (o Display já tem os bytes),
mas uma queda do dongle o traria de volta e o `getMedia` não acharia nada.
Quando essa mídia sair de cena, o rodízio de `fixarAvulso` a solta sozinho.

`soltarAvulso` nunca apaga nada por conta própria: ela chama `listRemove`, que
decide na mesma transação — se o Cronograma, a playlist ou um Favorito ainda
tiverem o id, o blob fica inteiro. Ela só deixa de esconder um detentor.

> **A auditoria que veio junto**, porque a pergunta era "o que mais pode ficar
> órfão?": todo caminho que cria registro passa por `addMedia`/`addUrlMedia`/
> `addDeck`/`addCue`, e os quatro exigem uma lista. As chaves de fato usadas são
> `imports`, `playlist`, `avulsos`, `favs` (as quatro de `LISTS`) e `folder_<id>`
> (que o `isReferenced` alcança pelo índice `folders`). Nenhuma outra. O único
> `listRemove('folders', …)` que aparece no fonte está DENTRO de um comentário,
> descrevendo o bug que a v5.103 corrigiu.

**Subir o `DB_VERSION` tem um preço, e ele não é o upgrade — é a VOLTA.**
`open` com uma versão MENOR do que a do banco lança `VersionError`, e a base
web ANTERIOR é exatamente para onde o watchdog do OTA volta quando um bundle
não confirma (e é a que o APK instalado embute até a Release seguinte). Um
bundle que sobe o `DB_VERSION`, é servido uma vez e depois é descartado deixa a
base antiga sem conseguir ABRIR o banco: um lançamento inteiro sem playlist,
sem Cronograma e sem biblioteca. O caso se cura sozinho — o `check()` seguinte
rebaixa o bundle de novo —, mas o lançamento estragado é real, e num domingo
ele é o culto. Por isso a regra: só subir junto com uma Release, e só quando o
ganho não couber numa chave de `state`, que é onde uma estrutura auxiliar deve
morar.

**O índice `youtubeId` (v5.87)** responde "este vídeo já está no aparelho?"
sem desserializar blob nenhum (`getAllKeys` no índice). Registros com
`youtubeId: null` ficam de fora dele — `null` não é chave IDB válida —, então
o índice contém exatamente os vídeos vindos do YouTube. É ele que faz o
`ytArquivo` do Controle reaproveitar o arquivo em vez de baixar o mesmo vídeo
uma vez por destino escolhido.

O campo `kind` é derivado do `type` (ou definido pelo chamador para itens de URL):

| Origem | `kind` |
|---|---|
| `type` começa com `image/` | `'image'` |
| `type` começa com `video/` | `'video'` |
| `type` começa com `audio/` | `'audio'` |
| link do YouTube | `'youtube'` |
| URL sem extensão reconhecida | `'url'` |
| outro | `'other'` |

### Chaves de `state` em uso

| Chave | Conteúdo |
|---|---|
| `imports` / `playlist` | arrays de IDs de mídia |
| `current` | `{ mediaId, view, muted, volume, at }` — estado de exibição atual. O `mediaId` é **limpo na abertura** (`clearCurrentSelection`): sessão nova começa com o player vazio; volume/mudo/cortina ficam, que são o ajuste da mesa e não uma seleção |
| `repeat` | `'off'` \| `'all'` \| `'one'` \| `'shuffle'` |
| `fade` | legado — as transições visuais (fade in/out) viraram **inerentes ao sistema** (`createStage.FADE`, fixo em `{in:true, out:true, time:0.6}` e compartilhado pelos dois apps, não configurável); esta chave **não é mais lida nem gravada** (fica ignorada se existir de versões antigas). Fade em toda troca visual: mídia, cortina do wallpaper (view toggle), letra e texto bíblico |
| `fit` | `'contain'` \| `'cover'` \| `'fill'` — preenchimento da mídia (ajustar/preencher/esticar) no Display e na preview |
| `lyricsBg` | `'black'` (padrão) \| `'image'` — fundo atrás da letra sincronizada: preto ou as imagens dos slides |
| `wallpaper` | `Blob` da imagem escolhida para a cortina do telão, ou ausente/`null` = gradiente padrão (ver "Wallpaper personalizado") |
| `favs` | array de IDs — **os FAVORITOS** (v5.103): a marcação de um toque, sem grupo nenhum. É uma das `LISTS` de `db.js`, e é isso que a torna um detentor de referência de verdade (favoritar segura o blob; desfavoritar deixa o gc decidir) |
| `folders` / `folder_<id>` | **LEGADO** (as pastas virtuais saíram na v5.254). `folder_<id>` era um detentor de referência como as listas, escrito só por `listAdd`/`listRemove`/`folderDrop` — a regra fica porque `isReferenced` ainda varre essas chaves, e é ela que vale para QUALQUER chave de `state` que passe a guardar ids de mídia |
| `downloadOk` | `true` depois que o operador autorizou o download sob demanda uma vez (modo simplificado — `ensureDownloadConsent`) |
| `messages` | `[{ id, text }]` — mensagens de texto puro da aba Mensagens (ver "Camada de Texto") |
| `opfs-folders` | `[{ id, name, count, syncedAt, handle? }]` — pastas sincronizadas no OPFS (`handle` acelera re-sync) |
| `coll:<id>` | `{ indexSyncedAt, songs: [{ id_music, track, name, duration, has_instrumental_music, fileIdFull, fileIdPlayback }] }` — índice offline de UMA coleção do LouvorJA (`coll:hymnal-2022`, `coll:hymnal-1996`, `coll:album-<id>`) — ver "Coleções de mídia (LouvorJA)" |
| `albumCatalog` | `{ categories: [{ id_category, name, order, albums: [{ id_album, subtitle, order }] }], albums: [{ id_album, name, color }] }` — a hierarquia categoria → álbum de `pt_categories` (ver "Classificação" nas Coleções). Formato antigo (array achatado) é migrado na leitura |
| `bibleVersions` | `[{ id, name }]` — versões/traduções da Bíblia (de `pt_bible_version`), baixadas na 1ª vez — ver "Bíblia" |
| `bibleBooks` | `[{ id, name }]` — livros da Bíblia (de `pt_bible_book`) para casar o `id_bible_book` real; a estrutura de exibição (abreviações/nº de capítulos) é offline em `bible.js` |
| `bibleVersion` | id da versão da Bíblia selecionada pelo operador |
| `bible:<v>_<b>_<c>` | `{ verses: [{ n, text }], syncedAt }` — texto de UM capítulo (`bible_{v}_{b}_{c}`); a versão inteira é baixada na 1ª vez que a aba é usada (e cada capítulo também sob demanda como fallback) |
| `bibleComplete:<v>` | `true` quando a versão `<v>` foi baixada por completo (todos os capítulos) — evita refazer o download em massa |
| `lyrics:<collId>` | acervo de LETRAS por coleção: `{ <id_music>: [{ a: rótulo\|null, l: [linhas] }] }`, ou `0` marcando "esta música não tem letra". É o que a BUSCA consome — ver "Acervo de LETRAS" |
| `chronoPrefs` | preferências do cronômetro/relógio/timer (modo, duração, formato, legenda, mais o campo `v` de versão do registro). A contagem em curso **não** é persistida |
| `drawPrefs` | sorteio: faixa/lista de opções, "não repetir", histórico e o último resultado — este **é** persistido (ver "Ferramentas: sorteio") |
| `migSemNumeroAlbuns` | marca de passagem única: os arquivos já baixados de coleções que não numeram tiveram o prefixo `N. ` removido (ver "O número é do HINÁRIO") |
| `hymnal2022` | legado — migrado para `coll:hymnal-2022` no `loadCollections()` (a chave antiga permanece, ignorada) |
| `pending-share` | legado — era o share que o service worker gravava aguardando processamento. O SW saiu e o share chega pela ponte nativa; a leitura remanescente da chave (que ninguém escrevia desde a v5.48) saiu na limpeza da auditoria de agosto/2026 — hoje ela é ignorada |
| `order` | legado — lido apenas como fallback de `imports` |
| `favorites` | legado (recurso de favoritos removido) — array de IDs; não é mais lido nem gravado, ignorado |
| `linked-folders` | legado (pastas vinculadas por handle) — substituído por `opfs-folders`; ignorado |
| `louvorja-token` / `louvorja-hymnal` | legado (hinário online removido na v2.5); ignorados |

### API exposta (`window.AVDB`)

```js
setState, getState
stateKeys(prefix)             // chaves de `state` com esse prefixo, numa transação
                              // só e SEM ler valor nenhum — presença em massa
addMedia(blob, meta)          // cria registro + adiciona a meta.list (padrão 'imports')
addUrlMedia(url, meta)        // item de URL externa (blob=null), idem
addDeck(pages, meta)          // apresentação: uma imagem por página
addCue(cue, data, meta)       // CENA DE ROTEIRO: item sem bytes (ver abaixo)
getMedia(id), renameMedia(id, name)
mediaByYoutube(youtubeId, kind)  // o registro desse vídeo na FORMA pedida, ou null
listIds, listSet, listItems, listHas, listAdd, listRemove, gc
folderDrop(folderId)          // apaga um ATALHO inteiro, coletando o que ficar sem dono
fileAdd, fileGet, fileDelete, filesByFolder, filesAll   // catálogo OPFS
opfsSupported, opfsGetFile, opfsWriteFile,              // Origin Private
opfsDeleteFile, opfsDeleteDir                           // File System
kindFromType, sendCommand, onCommand
```

**`listSet` tem duas formas, e a diferença é atomicidade:**

- `listSet(name, [ids])` grava o array como veio — read-modify-write PARTIDO: um
  `listAdd` que comite entre a leitura e esta escrita é perdido, e o registro
  criado em `media` fica órfão para sempre (o gc só roda dentro de
  `listRemove`). Hoje nenhum escritor de fundo mexe em listas, então é
  fragilidade estrutural, não defeito em operação.
- `listSet(name, fn)` é a forma ATÔMICA: `fn(listaAtual)` roda dentro da MESMA
  transação de `state` que grava o resultado. `fn` precisa ser SÍNCRONA — um
  `await` deixaria a transação autocommitar antes do `put`.

Prefira a forma com função ao escrever código novo.

Fora da superfície de propósito: `openDB` (expor a conexão crua convida a montar
transações por fora dos helpers, que é onde mora a atomicidade deste arquivo) e
`storeUrlTemp`/`storeMediaTemp`/`deleteMedia` (gravavam em `media` SEM entrar em
lista nenhuma, isto é, criavam registros que NENHUM gc alcança). Quem precisa de
um registro usa `addMedia`/`addUrlMedia`, que já entram numa lista.

#### Garbage collection de blobs

Um registro só é excluído quando **nada mais aponta para ele** — nem lista, nem
pasta dos Favoritos:

```
listRemove(listName, id)
  → isReferenced(id, exceto listName)?  → não; delete no store media (gc)
```

**`isReferenced` é o ponto único da pergunta "posso destruir este blob?"**, e ela
cobre mais que as duas listas fixas: cada pasta guarda ids em
`state['folder_<id>']`, chaves DINÂMICAS. Sem elas o defeito é destrutivo e
silencioso — importar um vídeo, pô-lo num Favorito e excluí-lo do Cronograma
apagava o BLOB; o Favorito seguia com o id, `getMedia` devolvia `undefined` e o
`filter(Boolean)` do Controle descartava sem avisar. **Qualquer chave de `state`
que passe a guardar ids de mídia precisa entrar ali.**

`isReferenced` recebe o objectStore de `state` JÁ ABERTO, para decidir dentro da
transação de quem chamou — é isso que fecha o TOCTOU. O `gc(id)` avulso (sem
chamador; fica como válvula) usa a MESMA função de propósito: foi a duplicação
da regra em dois lugares que deixou os Favoritos de fora.

**Atomicidade (transação única):** `listAdd`, `listRemove` (com o gc embutido) e
`addMedia`/`addUrlMedia` (registro + entrada na lista) fazem o
read-modify-write dentro de UMA só transação IDB. Sem isso há dois defeitos:
*lost update* (duas escritas concorrentes leem o mesmo array e a segunda
sobrescreve a primeira) e *registro órfão* (o `add` em `media` completa, o
`listAdd` falha, e o blob vaza fora de qualquer lista). O gc de `listRemove`
roda na mesma transação da remoção, fechando o TOCTOU em que um `listAdd`
concorrente re-referenciaria o id no intervalo. (`readListIn` lê a lista de um
objectStore já aberto; `txDone(tx)` confirma o commit.)

**REGRA:** chave de `state` que guarda ids de mídia se escreve por
`listAdd`/`listRemove`/`listSet(name, fn)`. `setState` cru numa dessas chaves é
um vazamento esperando acontecer — foi assim que apagar uma pasta dos Favoritos
deixava blobs de centenas de MB no IndexedDB para sempre, invisíveis e sem
caminho de limpeza. Daí `folderDrop(folderId)`, que apaga índice, lista e varre
os ids numa transação só; **a ordem importa** — a pasta sai de `folders` ANTES da
varredura, senão `isReferenced` a encontraria e ela seguraria os próprios ids.

#### Cenas de roteiro (`kind: 'cue'`)

Um **cue** é um item de lista que aponta para uma CENA em vez de para bytes —
contagem regressiva, leitura bíblica, aviso, letra sem música:

```js
{ kind: 'cue', cue: 'verse',      data: { versionId, bookIdx, chapter, verse } }
{ kind: 'cue', cue: 'message',    data: { msgId, text } }
{ kind: 'cue', cue: 'songlyrics', data: { collId, songId } }
{ kind: 'cue', cue: 'chrono',     data: { mode, durationMs, label, secs, h12 } }
{ kind: 'cue', cue: 'draw',       data: { kind, min, max, pool, label } }
{ kind: 'cue', cue: 'group',      data: { ids: [...] } }        // o "pacote"
```

1. **O Display não muda uma linha, e sequer sabe que cues existem.** Um cue
   NUNCA vira `load`: projetá-lo chama a MESMA função que o botão da aba já
   chamava (`projectBibleVerse`, `projectMessage`, `projectChrono`,
   `projectDraw`, `projectSongLyricsOnly`), que manda o `text`/`chrono`/`draw`
   de sempre. Ponteiro novo, nunca lógica de projeção nova.
2. **A guarda mora em `send()`**, não no toque da lista: é por ali que passam o
   avanço automático da playlist, o ⏮/⏭ do transporte, a notificação nativa e o
   pacote. Um cue que chegasse ao `load` APAGARIA o telão (registro sem
   blob/url/pages cai no `clear()` do stage).
3. **A reconexão do telão vem de graça:** projetar um cue deixa a SESSÃO
   montada, e `resendSceneToDisplay` já reenvia sessões.
4. **O descritor é uma REFERÊNCIA, não uma cópia.** O versículo guarda
   `{versão, livro, capítulo, número}` e o texto vem do cache na hora de
   projetar; a mensagem guarda o `msgId` (com o texto como reserva, para o
   roteiro não ficar mudo se ela for apagada). Um cue não envelhece quando a
   mensagem é editada nem duplica a Escritura no banco.

- **O versículo projeta na versão EM USO HOJE**, com a guardada como reserva: a
  referência é do texto, não da tradução — um roteiro de um mês atrás não pode
  arrastar de volta uma versão trocada nem disparar o download dela no domingo.
- **O sorteio guardado é a CONFIGURAÇÃO, nunca um resultado.** Projetar arma o
  sorteio e espera o toque em "Sortear": um ganhador já pronto ao entrar em cena
  tira do momento o que ele tem de público.

**Guardar uma cena é sempre o mesmo par de botões** (`cueSaveBtn`): ⊞ para o
Cronograma, ★ para os favoritos, sempre `.cue-save-btn`, com o rótulo em `title`
+ `aria-label`. (A folha de destinos das músicas continua com texto: ali as
linhas são um MENU e cada uma diz uma coisa diferente.)

#### Vídeo × só áudio, no seletor que já existia

O mesmo segmentado de Cantada/Playback (`.fit-seg`), com **Vídeo** e **Só
áudio** — é a mesma pergunta ("qual faixa deste item?"), e a escolha vale para
as quatro ações em vez de dobrar a folha para oito linhas.

- **Só áudio não é versão degradada:** o YouTube guarda o áudio em faixa
  SEPARADA, e é por isso que o progressivo tem teto de 720p. Pedindo só o áudio,
  esse teto não existe.
- **O registro entra como `kind: 'audio'` e SEM miniatura** — é o `kind` que faz
  o telão manter o wallpaper (ver `semVisual`, na seção do stage).
- **O nome ganha " (áudio)"**, a convenção do "(Cantado)"/"(Playback)": sem o
  sufixo, vídeo e áudio do mesmo link viram duas linhas de nome idêntico.
- **O reaproveitamento é por FORMA:** as duas convivem no banco com o mesmo
  `youtubeId`, então `mediaByYoutube(id, kind)` filtra — quem pediu áudio não
  pode receber o vídeo de 80 MB que já estava aqui.
- **Ponte:** método PRÓPRIO (`ytFetchAudio`), nunca um parâmetro a mais no
  `ytFetch`. A ponte casa o método por nome + aridade, e mudar a assinatura do
  `ytFetch` quebraria o download inteiro num shell antigo que recebesse este
  bundle por OTA. O seletor só é desenhado com `__SHELL_VERSION__ >= 23`.
- **A escolha viaja no FECHO de cada ação**, nunca em `songMenuFor`: o
  `songMenuItem` chama `closeSongMenu()` ANTES da ação, e ele zera aquele objeto
  — consultá-lo lá dentro encontraria null e todo download sairia como vídeo.
##### TRANSMISSÃO DIRETA: o vídeo sem baixar e sem o player do YouTube

O "Tocar agora" de um resultado do YouTube vira um `<video>` COMUM alimentado por
`MediaSource` — daí para a frente ele é mídia como qualquer outra: fade, cortina,
`MediaSession`, barra de progresso e segundo plano, e **zero pixel de YouTube no
telão**. As alternativas cobravam caro: baixar antes são centenas de MB de espera
antes do primeiro quadro, e o player embutido (removido na v5.212) trazia a UI
dele junto — a rodinha de carregamento, o botão grande na pausa e a tela final
**não têm parâmetro que desligue**, porque não são *controles*.

###### As três peças

| Peça | Onde | O que faz |
|---|---|---|
| manifesto | `YoutubeGrab.manifesto` + `AVNative.ytStream` | escolhe as duas faixas adaptativas pela MESMA fila de candidatos do download (visionOS primeiro) e devolve os byte-ranges do DASH |
| proxy | `StreamProxy.kt` | serve o `googlevideo` em `/stream/<token>`, no nosso origin |
| player | `shared/mse.js` | lê o `sidx`, pede os pedaços e os entrega ao `MediaSource` |

**Por que o proxy não é opcional.** Um `fetch` direto ao googlevideo falha por
três motivos independentes, cada um suficiente sozinho: **CORS** (o googlevideo
não manda `Access-Control-Allow-Origin`), o **User-Agent** (uma faixa do visionOS
pedida com o UA do WebView responde 403) e a **invariante 2** (o WebView recusa
buscar fora do origin).

**Por que ele NÃO é um `PathHandler`.** O `WebViewAssetLoader.PathHandler` recebe
só o caminho — os cabeçalhos não chegam lá —, e MSE é feito de requisições por
FAIXA DE BYTES: sem repassar o `Range`, cada pedido traria o arquivo inteiro para
usar 200 kB. Por isso ele é chamado de dentro do `shouldInterceptRequest`, que
recebe o `WebResourceRequest` completo, ANTES de o asset loader ver a URL — é o
único ponto do app que enxerga os cabeçalhos de uma requisição.

Ele vale para os DOIS WebViews, ao contrário do handler `/saf/`: quem projeta é o
telão, então negá-lo ao Display seria negar o recurso inteiro. A exposição é de
outra natureza — um token de stream aponta para uma faixa do vídeo que já está em
cena, não para o índice de uma pasta do aparelho.

###### O `sidx`, e por que ele é a peça testada

O índice DASH é o que torna a coisa viável: com alguns kilobytes o player sabe
onde começa cada fragmento. Sem ele, "tocar aos 3:20" significaria baixar tudo
até os 3:20.

É também a peça que falha em SILÊNCIO (um erro de deslocamento não dá exceção —
dá vídeo que não toca) e a única do caminho que se verifica sem aparelho, porque
os boxes podem ser construídos byte a byte a partir da especificação. Daí
`tools/sidx.test.mjs`: v0 e v1 (o tamanho do cabeçalho MUDA entre as duas, e
errá-lo desloca todas as entradas), `first_offset`, um box anterior ao `sidx`, o
bit de `reference_type` (que sem máscara viraria um tamanho absurdo), buffer
curto, ausência do box e `timescale` zero.

###### O que este player deliberadamente NÃO é

`mse.js` **não** troca de qualidade, **não** lê MPD e **não** faz ABR — ele lê um
índice, pede pedaços e os entrega. Um player DASH de prateleira (dash.js, Shaka)
são centenas de kB de terceiro para um caso que aqui é minúsculo: duas faixas, um
perfil, sem DRM, sem múltiplas qualidades, sem legenda. O preço está declarado:
isto é superfície NOSSA, e por isso cada ponto de falha avisa quem chamou
(`onErro` → `onStreamErro` do stage), e quem chamou tem para onde cair.

###### A recuperação, e quem a faz

As URLs do googlevideo expiram em algumas horas, então um registro de stream é
transitório por natureza. Quando ele falha em cena:

1. **A preview do Controle é a canária** — ela toca o MESMO registro, na mesma
   hora, e é na tela do operador que a falha aparece primeiro.
2. O Controle pede um manifesto NOVO para o mesmo `youtubeId` e o regrava
   (`AVDB.setMediaStream`).
3. **Uma tentativa só.** Falhando a segunda, o problema não é validade — é rede,
   codec ou vídeo restrito —, e a mídia é substituída pelo DOWNLOAD.

**O telão não recupera sozinho**, e não é omissão: ele recebe a ponte com
`host = null` e não pode pedir manifesto nenhum; e duas recuperações
independentes para a mesma cena brigariam entre si.

###### Só em "Tocar agora"

As outras três ações GUARDAM o item, e um manifesto que expira em horas seria
algo que não abre no domingo. Falhando qualquer coisa (shell antigo, vídeo sem
par adaptativo, WebView sem o codec), o caminho segue para o download **sem
avisar nada ao operador**: ele pediu o louvor, não o método.

##### E a QUALIDADE, logo abaixo

Uma segunda linha de segmentos, no mesmo construtor da primeira (`ytSegRow`):
**1080p · 720p · 480p** (mais **Online**, que não baixa nada).

- **Some com "Só áudio" escolhido** — ali não existe resolução nenhuma, e uma
  escolha que não faz nada é pior que escolha nenhuma.
- **O teto nasce no padrão A CADA ITEM.** Um teto que grudasse faria quem
  escolheu 480p numa rede ruim receber, sem aviso, o vídeo principal do domingo
  seguinte em 480p no telão: o atrito de dois toques é visível, a regressão
  silenciosa não seria.
- **360p ficou de fora**: num telão de salão ele é ruim o suficiente para não
  valer ser oferecido.
- **Ponte:** um TERCEIRO destino (`ytFetchAte`), pela regra de aridade do
  `ytFetchAudio`, e **só quando o teto pedido é MENOR que o padrão** — pedir
  1080p continua saindo pelo `ytFetch` de sempre, que existe em toda versão.
- **O progressivo respeita o teto, mas nunca ao ponto de não entregar nada**
  (`melhorProgressivo`): o maior que couber e, não cabendo nenhum, o MENOR que
  existe. Devolver `null` transformaria "quero economizar dados" em "não baixa".
- **O shell devolve a altura e a duração REAIS** do que de fato veio, não do que
  foi pedido — é isso que alimenta o subtítulo da linha.

##### A EXTRAÇÃO: a fila de candidatos, e o cliente que a sustenta

O YouTube protege as faixas ADAPTATIVAS (tudo acima de 720p e todo áudio
separado) com **SABR enforcement**: sem PO Token o CDN responde **403** a todas,
com qualquer par de contêiner, qualquer perfil de UA e com `Range`. Quem abriu
esse portão foi a própria biblioteca, na v0.26.3, com um cliente **visionOS**
buscado incondicionalmente e sem token nenhum — o conserto foi **uma linha de
`build.gradle.kts`**. A lição fica: **antes de reescrever extração à mão, olhar o
CHANGELOG da dependência.**

**O PO Token via WebView não é a saída, e isso foi verificado:**
`PoTokenProvider.getWebClientPoToken()` não tem UMA ÚNICA chamada em nenhuma
versão do extrator (v0.26.0 → v0.26.4 e `dev`) — o cliente web só serve para
metadados, e o `onFetchPage` consome apenas os tokens **ANDROID** e **iOS**. O
token do cliente Android exige o **DroidGuard** do Play Services, atrelado à
assinatura do app oficial. Um WebView rodando BotGuard aqui alimentaria um campo
que ninguém lê.

**O bump sozinho não bastaria**, e é por isso que a escolha é uma FILA: depois
dele o `StreamInfo` traz uma MISTURA — faixas do visionOS (que baixam) ao lado
das do cliente antigo (que respondem 403) —, e pegar "a de maior altura por
contêiner" pode pegar justamente a envenenada. As regras de `tentarJuntar`:

- **Cliente primeiro, altura depois.** Parece invertido e não é: as duas listas
  trazem 1080p e só a do visionOS baixa; ordenar por altura intercalaria as duas
  e gastaria as tentativas no lado que o CDN recusa. Empatados, mp4 antes de
  WebM — o WebView toca H.264 em qualquer aparelho.
- **O áudio é a sonda barata, e vem primeiro** (alguns MB contra centenas). O
  arquivo baixado fica guardado POR CONTÊINER, então um segundo candidato de
  vídeo mp4 reaproveita o m4a que já veio.
- **Tetos assimétricos:** um 403 falha antes do primeiro byte (candidato de vídeo
  custa uma requisição — cabem quatro); uma MONTAGEM que falha já custou o
  download inteiro do vídeo (teto de dois). Isto roda na rede do chip do
  operador, possivelmente minutos antes do culto.
- **O UA acompanha a URL:** `baixarTentando` lê o `c=` da própria URL e tenta
  primeiro o perfil que combina com ela (visionOS, iOS ou Chrome/Android). A
  constante `UA_VISIONOS` é copiada caractere a caractere do que a biblioteca
  monta — **ao trocar a versão do extrator, conferir `ClientsConstants` e trazer
  os números novos junto**.
- **`adaptativoBloqueado` exige UNANIMIDADE** (todos os candidatos tentados, no
  mínimo dois, mortos com 403). Desligar o caminho adaptativo no primeiro 403
  seria o autogol: com o pool misturado, um 403 isolado é o comportamento NORMAL
  de uma faixa envenenada com uma boa logo atrás. Não é persistido de propósito —
  um estado em disco transformaria a recusa de um dia numa desistência
  permanente.
- **O cliente iOS fica DESLIGADO:** as faixas dele vêm como manifestos HLS, que o
  `isUrl` descarta, e cada faixa a mais é um candidato que a fila pode gastar.
- **O "só áudio" segue a mesma fila**, três candidatos na ordem de cliente, com o
  progressivo no fim.

**O remux** (`MuxMp4.kt`) junta a melhor faixa de vídeo até 1080p (mp4/AVC) com a
melhor de áudio (m4a/AAC) pelo `MediaMuxer` da plataforma — cópia de amostras
comprimidas, não recodificação: sem perda e sem espera. Três guardas:

- **Só monta se for MELHOR que o progressivo** (senão paga dois downloads e um
  muxer para entregar o mesmo de antes).
- **mp4 + m4a, nunca "o melhor" absoluto.** O 1080p vem em AVC (mp4) e VP9
  (WebM), e só o primeiro entra num contêiner MP4 — escolher pelo bitrate e
  descobrir isso no fim seria baixar centenas de MB para falhar no muxer.
- **Uma barra só** para os dois downloads e a montagem (o vídeo pesa 90%, que é a
  proporção real): duas barras que voltam ao zero são indistinguíveis de
  travamento.

O progressivo segue como **piso**: falhando tudo, o app entrega o arquivo de 360p
em vez de nada (um caso conhecido é o vídeo marcado como "made for kids", que o
visionOS não extrai).

###### O diagnóstico da extração, no rodapé de Configurações

`YoutubeGrab.diagnostico` guarda numa linha o que o extrator RECEBEU, de qual
cliente, e o que cada tentativa deu; `AVNative.ytDiag()` a entrega ao rodapé de
Configurações, lido a cada ABERTURA do popup (o valor muda a cada download, e a
graça é comparar antes e depois de um teste). Só no app (shell ≥ 24) e depois da
primeira extração.

```
áudio 5 [m4a 2, webm 3] · vídeo-só 12 [mp4 6 (1080p), webm 6 (1080p)]
  · prog 1 [mp4 1 (360p)] · clientes VISIONOS 17, ANDROID 1
  → juntou 1080p (mp4, 137@VISIONOS/V)
```

- **`clientes VISIONOS n, ANDROID n`** — de qual cliente veio cada faixa LISTADA.
  Sem isso, dezessete faixas parecem a mesma coisa vindo do cliente que funciona
  ou do que só entrega 403.
- **`itag@CLIENTE` em cada tentativa** (`a:` áudio, `v:` vídeo) — uma falha futura
  se correlaciona com o formato exato em vez de virar mais um zero mudo.
- Os dois saem do **`c=` e do `itag=` da própria URL**, não de um campo da
  biblioteca: é o CDN quem os carimba, e o que ele carimbou é o que ele vai
  cobrar no download. De quebra, o diagnóstico não acrescenta superfície de API a
  uma dependência recém-atualizada.
- **`+N manif.`** separa "o YouTube não mandou nada" de "mandou, mas como
  manifesto HLS" — duas leituras que levam a decisões opostas e que sem esse `+`
  apareceriam como o mesmo zero.
- A linha só menciona o itag do ÁUDIO quando ele FALHA; no sucesso nomeia apenas
  o vídeo. Um diagnóstico que narra o caminho feliz vira ruído.

> **ARMADILHA REGISTRADA (v1.46): um diagnóstico pode apontar para o lugar errado
> COM CONFIANÇA.** O `motivo()` procurava três dígitos começando em 4 ou 5 no
> TEXTO da exceção — e `conn.inputStream` lança `FileNotFoundException` cuja
> mensagem é a URL, que carrega `dur=423.061`. O regex leu a duração do vídeo e a
> apresentou como "HTTP 423", um código que nunca aconteceu. Hoje o código vem de
> `conn.responseCode`, lido antes de abrir o fluxo.

> **E a outra: ler uma peça e concluir sobre o conjunto.** A conferência da época
> olhou o *fallback sem token* (que de fato continuava igual) e escreveu que
> "atualizar a biblioteca não resolve" — era exatamente o que resolvia, porque a
> v0.26.3 trouxe um CLIENTE NOVO, que não passa por aquele fallback.
##### Todo campo de log tem botão de copiar (v5.117)

O diagnóstico acima nasceu sem botão, e a primeira leitura chegou aqui como
FOTO DA TELA. Virou regra do projeto (está em `CLAUDE.md`): um campo de
diagnóstico existe para ser repassado, então ele vem com o botão `.log-copy`
(no cabeçalho `.log-head`, sobre a caixa `.diag-box` — o markup nasceu como
`.log-line`/`.log-text`, que a consolidação do Registro no `#diagBox` deixou
para trás) — texto selecionável (contra o `user-select: none` que vale para o
app inteiro) e um botão que não encolhe, porque numa tela estreita quem some
primeiro não pode ser a saída. `copiarTexto` usa `navigator.clipboard` (o app
tem contexto seguro: a base é servida por `https://appassets.androidplatform.
net`) e cai no `execCommand('copy')` se o WebView negar — com o `<textarea>`
posicionado FORA da vista, nunca `display:none`, porque um campo fora do layout
não pode ser selecionado e sem seleção o `copy` copia nada, em silêncio. A
confirmação é o mesmo pulso do resto do app.

**Não exige subir o `DB_VERSION`** (nenhum índice novo; o IDB não tem esquema
por registro), e é isso que o mantém barato: ver o preço da VOLTA descrito em
`DB_VERSION`, em `db.js`. Um bundle anterior que encontre um cue o trata como
mídia sem fonte e cai no `clear()` — nada quebra, nada projeta.

### BroadcastChannel — canal `av-iasd`

Todos os comandos são objetos com um campo `type`.

**Um só ponto de entrega, com a lista de handlers por cima.** `onCommand` só
assina o canal (e o relay nativo) na **primeira** chamada; as seguintes apenas
entram numa lista. O motivo é o `alreadySeen`, que **testa e marca** o `__mid`
na mesma chamada: até a v5.47 cada `onCommand` criava seu próprio `deliver` e
todos compartilhavam o mesmo conjunto de mids, então com dois listeners na
mesma página o primeiro marcava o mid e o segundo via a mensagem como
repetida — o segundo **nunca receberia nada**. E só no app: no navegador não há
relay, não há `__mid`, e os dois funcionariam. Um recurso testado no navegador
que para de funcionar no aparelho é o pior modo de falhar deste projeto. Hoje
há exatamente um `onCommand` por página, então a armadilha estava latente — e é
justamente por isso que seria descoberta tarde, por quem só quisesse observar
`display-status` num módulo novo.

A entrega itera sobre uma **cópia** da lista (um handler que registre outro
durante a entrega não altera a rodada em curso) e envolve cada chamada em
`try/catch`: um handler que lança não pode calar os demais — no telão isso
significaria perder o comando seguinte no meio de um culto.

#### Controle → Display

| `type` | Campos extras | Descrição |
|---|---|---|
| `load` | `mediaId, view, muted, volume, time?, playing?` | Carrega e exibe uma mídia. `time` (segundos) e `playing` (bool) existem para a **reconexão do telão** — ver "Reenvio da cena" |
| `play` | — | Inicia reprodução |
| `pause` | — | Pausa |
| `seek` | `time` (segundos) | Pula para o instante indicado |
| `volume` | `volume` (0.0–1.0) | Altera o volume |
| `mute` | `muted` (bool) | Liga/desliga mudo |
| `view` | `view` (`'visual'`\|`'wallpaper'`) | Alterna entre exibir a mídia ou o wallpaper (com fade, se ativo) |
| `clear` | — | Limpa o Display (volta ao wallpaper, zera `currentId`; com fade-out, se ativo). É o **Parar do transporte**: encerra a CENA INTEIRA, Camada de Texto junto |
| `media-clear` | — | **Tira só a MÍDIA** (v5.178) — o simétrico exato do `text-hide`, e o que faz o stop por camada da lista existir. Com texto em cena o Display manda ao stage `clear-media` (o `fadeOutToBlack`: esmaece o conteúdo **sem tocar na cortina**, porque o cartão de texto vive por BAIXO dela); sem texto, é o `clear` inteiro. Quem escolhe é o DISPLAY, que é quem tem o `textActive`. O ramo vem **antes** do bloco de `textActive` — lá dentro `clear` é justamente o que chama `hideText` |
| `fit` | `fit` (`'contain'`\|`'cover'`\|`'fill'`) | Atualiza ao vivo o preenchimento da mídia (ajustar/preencher/esticar) |
| `lyricsbg` | `mode` (`'black'`\|`'image'`) | Atualiza ao vivo o fundo atrás da letra sincronizada (preto ou imagens dos slides) |
| `wallpaper` | — | Avisa que a imagem do wallpaper mudou. **Sem payload**: o blob mora no state `wallpaper`, que os dois apps compartilham — o Display relê do IDB (ver "Wallpaper personalizado") |
| `text` | `mode, view` + payload conforme o modo | Projeta/atualiza a **Camada de Texto** (ver a seção própria). `mode` = `'verse'` (Bíblia) \| `'message'` (aviso) \| `'chrono'` (relógio/cronômetro/timer) \| `'draw'` (sorteio). Nos dois primeiros o payload é `main` (texto principal) + `sub` (referência dourada abaixo; vazio nas mensagens); nos dois últimos é um **descritor** (`chrono` / `draw`) a partir do qual cada lado calcula o número localmente — ver as seções de Ferramentas. Um novo `text` troca o conteúdo em cena; `view` só liga/desliga a cortina compartilhada. **Independente do áudio**: um `text` NÃO para a mídia do stage — o áudio segue tocando por baixo |
| `text-hide` | — | Encerra a Camada de Texto (Bíblia/Mensagem) sem tocar na mídia de fundo |
| `mic` | `on` (bool) | **Microfone ao vivo** (push-to-talk): o Display abre o microfone e reproduz a voz na projeção. Camada de ÁUDIO independente — não toca na mídia, no texto nem na cortina. Enviado por `AVDB.sendCommand` direto, **nunca** por `cmd()`: a preview é o mesmo aparelho, a centímetros do microfone |
| `audio-retry` | — | Retentativa imediata de liberar o áudio bloqueado (botão de mudo do Controle no estado "sem áudio") |

#### Display → Controle

| `type` | Campos extras | Descrição |
|---|---|---|
| `display-ready` | — | Display pronto; o Controle reenvia a **cena inteira** (ver abaixo) |
| `display-status` | `mediaId, view, muted, volume, playing, currentTime, duration, audioBlocked` | Estado do Display a cada evento de tempo/estado (`audioBlocked`: navegador bloqueou som sem gesto; o Controle avisa o operador) |
| `media-ended` | `mediaId` | Vídeo/áudio chegou ao fim |
| `mic-status` | `on`, `error` | Resultado da abertura do microfone (permissão negada, sem microfone, em uso por outro app…) |

#### Reenvio da cena (`resendSceneToDisplay`)

O Display **sempre** abre no wallpaper e espera um comando — quem sabe o que
estava em cena é o Controle. Quando o dongle cai e volta, o Android destrói e
recria a `Presentation`, o WebView recarrega `/display/` e dispara
`display-ready`; é aí que o Controle reconstitui o telão. Três decisões
sustentam isso, e as duas primeiras nasceram de defeitos vistos em culto:

- **Cena é tudo que está no telão, não "mídia tocando".** A condição de reenvio
  é só `currentId` — qualquer mídia carregada. Ela já foi `playing || isImage`,
  e o que ficava de fora era justamente o caso mais comum de uma queda de
  dongle: o louvor de fundo **pausado** para a oração. Um vídeo pausado mostra
  o quadro congelado, um áudio pausado mantém a letra sincronizada em cena —
  nos dois casos havia algo projetado, e nos dois casos ele sumia para sempre.
- **O `load` leva a POSIÇÃO e o estado de reprodução** (`time`, `playing`). Sem
  eles o telão recarregava do zero: um hino aos 3:20 recomeçava do início na
  frente da congregação, e o `display-status` seguinte chegava com
  `currentTime` 0 e arrastava a preview do Controle junto — o operador perdia
  até a referência de onde estava. O tempo sai da **barra de progresso**
  (`#seek`), a mesma fonte que `pushNowPlaying` usa: é a única que cobre todos
  os tipos, inclusive YouTube, onde `preview.getTime()` não sabe de nada.
  Os campos viajam **dentro do próprio `load`**, e não como um `seek`/`pause`
  enviado logo depois, porque o `onCommand` do Display não serializa: o load é
  assíncrono (`getMedia` → `opfsGetFile` → `mediaReady`) e um comando seguinte
  chegaria a tempo de agir sobre o `<video>` **anterior**, antes de a fonte
  nova entrar.
- **A ordem é mídia primeiro, texto depois.** No Display um `load` **visual**
  encerra a Camada de Texto e um `load` de **áudio** a mantém — mandar o texto
  por último faz as duas combinações caírem no estado certo. Cronômetro e
  sorteio voltam pelo **descritor**, não por um valor: o telão recalcula o
  número a partir do mesmo `startAt`/`rollUntil`, então reaparecem no segundo
  certo (e no mesmo quadro do rolo), não no ponto em que a conexão caiu.

---

## Motor de renderização (`shared/stage.js`)

`createStage(opts)` retorna um objeto com a API de reprodução. Usado pelo Display
(tela real) e pelo Controle (a mini-preview, muda enquanto houver tela conectada
— ver "A saída de áudio"). Suporta blobs locais,
arquivos do OPFS (`opfsPath` — resolvidos via `AVDB.opfsGetFile`, com re-checagem
de `loadSeq` após o await) e itens de URL direta (`blob=null, url=string`).
Itens `kind='youtube'` **não são reproduzidos pelo stage** — ele apenas mostra
a thumbnail no `<img>`; a reprodução real é feita externamente (iframe no
`display.js`, que também **reaproveita a cortina do wallpaper deste mesmo
stage** — ver "Modelo de camadas" abaixo).

### Modelo de camadas: wallpaper é uma cortina por cima de tudo

O wallpaper fica **acima** (z-index maior) de toda mídia — img/video no stage,
e o iframe do YouTube no Display. A mídia toca/troca de conteúdo **livremente
por baixo**, sem nunca precisar saber se está "visível"; o wallpaper só
liga/desliga essa cortina por cima, com fade quando configurado.

Isso existe porque o modelo antigo (mídia por cima, escondida/revelada
conforme a view) exigia que cada tipo de mídia rastreasse "já posso me
revelar?" — para o YouTube isso significava só revelar o iframe quando
`view==='visual'` **e** o vídeo já estivesse tocando; se o vídeo começasse com
o wallpaper ligado, essa condição nunca era satisfeita e o vídeo ficava preso
atrás do wallpaper para sempre, mesmo depois de desligar o wallpaper (o áudio
tocava normalmente, só o vídeo nunca aparecia). Com o wallpaper como cortina
por cima, revelar é sempre só "esconder a cortina" — não depende mais de em
que estado (view) a mídia foi carregada.

- **`coveredNow`** (privado) é a única fonte de verdade sobre se a cortina
  está cobrindo agora. Começa `true` (nada carregado).
- **`computeCover()`**: `!current || ended || view === 'wallpaper' ||
  semVisual()` — a cortina deve cobrir sempre que não há mídia, ela "terminou"
  (`ended`, aguardando replay), o operador pediu `view='wallpaper'` — ou o que
  entrou **não tem imagem nenhuma para mostrar**.
  Repare que o primeiro, o segundo e o quarto termos **não dependem da view**:
  sem nada visível em cena a cortina cobre nos dois valores dela. É disso que
  sai a guarda de `setViewFaded` descrita abaixo.

##### `semVisual()`: áudio puro mantém o wallpaper (v5.112)

Um registro `kind: 'audio'` **sem letra sincronizada** — um mp3 importado, o
instrumental de fundo, o áudio baixado de um vídeo do YouTube — não põe nada no
`<img>` nem no `<video>` (ver `applyMedia`). Sem esta pergunta a cortina ABRIA
para ele: o telão saía do wallpaper e ficava no **preto do palco**, com o louvor
tocando por trás de um retângulo vazio. Não era uma capa errada — era a ausência
de qualquer coisa, e no meio de um culto isso se lê como projetor apagado.

A letra é a exceção que confirma a regra: quando o áudio TEM letra a cortina
precisa sair da frente, porque a `.lyrics-layer` fica **por baixo** dela (o
wallpaper tem `z-index` maior, e é assim que ele cobre/revela as camadas de
graça). Por isso a pergunta é feita ao PRÓPRIO registro (`current.lyrics`), que
é quem carrega a letra — a mesma condição que o `display.js` já usa para chamar
`showLyrics` —, e não à camada, que o stage não conhece.

Três pontos onde ela entra, e o terceiro é o que fecha o caso:

1. `computeCover()`, que governa `play()`, `setView()` e o `clear()`.
2. O fim do `load()`: `view === 'visual' && coveredNow && !semVisual()` — não
   abre a cortina para quem não tem o que mostrar.
3. O **caminho inverso**, que é o que quase escapou: uma IMAGEM em cena seguida
   de um áudio sem letra. Ali a cortina já estava aberta (havia o que ver) e
   ninguém a fecharia — o telão ficaria no preto. Daí o `if (semVisual() &&
   !coveredNow) await coverIn(false)` no fim do `load`.

E como a cortina é **compartilhada** (a Camada de Texto a abre por conta
própria para o cartão aparecer), o Display precisa da mesma regra ao devolvê-la
depois que o texto sai: `reconcileCover` pergunta `stage.shouldCover()` — o
`computeCover` exposto — em vez de reabrir cegamente. Só quando a cena é do
stage: com o player do YouTube no ar, `current` pode estar nulo e a pergunta
responderia "cobre" justamente sobre o vídeo que está tocando.

**Verificado em Chromium**, com Controle e Display na mesma origem trocando
comandos de verdade: imagem em cena → `wallpaper: none`; áudio sem letra logo em
seguida → `wallpaper: flex`, `<img>` e `<video>` ocultos; áudio COM letra →
`wallpaper: none` e a camada de letra visível.
- **`instantCover(show)`** / **`coverIn(rampAudio)`** / **`coverOut()`**: as
  três únicas funções que tocam o elemento do wallpaper. `coverIn`/`coverOut`
  fazem fade (conforme `fadeOut`/`fadeIn` e `fadeTime`) e usam `coverSeq` para
  descartar fades de cortina obsoletos (um pedido mais novo cancela o
  anterior); `instantCover` é imediato (sem fade) e sempre vence.
- `img.hidden`/`video.hidden` (**`applyMedia()`**) passam a depender **só do
  `kind`** da mídia atual — nunca de `view`/`ended`. A mídia continua
  renderizando/tocando por baixo mesmo com a cortina fechada (é assim que o
  áudio do YouTube ou de um vídeo local continua audível com "wallpaper on").
- **`stage.coverIn`/`coverOut`/`instantCover` são expostos publicamente** —
  o Display os chama diretamente quando precisa mexer na cortina sem passar por
  um `load`, já que ela é o **mesmo elemento físico** de wallpaper compartilhado.
  `coverIn(rampAudio=true)` mexe no volume do `<video>` do próprio stage.
  (A superfície nasceu pública para a cortina do EMBED do YouTube, que tinha um
  `<video>` fora do stage e uma rampa de áudio própria — `ytSetView()`,
  `onPlayerStateChange()`. O embed saiu na v5.212 e hoje só há um `<video>`, o do
  stage; a exposição fica porque os pontos acima continuam existindo.)

### Opções de criação

```js
createStage({
  wallpaper,    // elemento do wallpaper (cortina, por cima de tudo)
  img,          // elemento <img>
  video,        // elemento <video>
  forceMuted,   // bool — mantém vídeo sempre mudo (preview do Controle)
  onEnded,      // callback quando o vídeo termina
  onTime,       // callback em timeupdate / loadedmetadata / play / pause / ended / volumechange
  onBlocked,    // callback quando autoplay é bloqueado pelo browser (só
                // NotAllowedError; AbortError de um play() interrompido por
                // pause()/load() seguinte — normal em toda troca de mídia —
                // é ignorado, para não disparar recuperação de áudio à toa)
  onError,      // callback no evento 'error' do <video>
})
```

### Estado interno

```
current     → registro da mídia carregada (null = nada)
ended       → flag: vídeo chegou ao fim (permite replay sem recarregar)
view        → 'visual' | 'wallpaper'
muted       → bool (intenção do operador; independe de forceMuted)
volume      → 0.0 – 1.0
url         → object URL do blob OU URL externa em uso
isBlobUrl   → bool — se true, revoga com URL.revokeObjectURL ao trocar/limpar
loadSeq     → contador para descartar loads/fades concorrentes obsoletos
coveredNow  → bool — a cortina do wallpaper está cobrindo agora?
coverSeq    → contador para descartar fades de cortina obsoletos
fadeIn/fadeOut/fadeTime → transições (fixas: createStage.FADE, ver abaixo)
```

### Transições (fade)

**Regra geral: transição entre mídias é sempre PRETO; o wallpaper só aparece
como ponto final (resting state confirmado), inicial (nada carregado ainda)
ou manipulado explicitamente pelo operador (`view` toggle).** Nunca como parte
de uma troca de conteúdo em andamento — inclusive quando a troca depende de
rede (YouTube) ou é ambígua no momento (fim natural, antes de saber se um
próximo item vem em seguida).

Duas transições **independentes** quando fade está ativo:

**Áudio nunca mostra o `<video>`** (`applyMedia`: `video.hidden = kind !==
'video' || ended`). O elemento é só o "sink" de som — em áudio puro não há um
pixel a exibir. Mantê-lo em cena fazia o navegador desenhar o **placeholder de
mídia** (retângulo claro com botão de play) por cima do preto: invisível
durante o hino, porque a camada de letra o cobria, e aparecendo justamente no
FIM, quando a letra esmaece e o descobre. É o mesmo placeholder já perseguido
na troca de mídia (ver `resetMediaDom`/`load`), mas com outra origem — ali era
um `<video>` sem `src`, aqui é um `<video>` com `src` e nada a mostrar. Um
elemento `display:none` continua tocando áudio normalmente.

**A entrada tem rampa de volume, como a saída.** Isto não existia: `load()`
escrevia o volume direto no alvo e a mídia entrava no talo enquanto o visual
ainda esmaecia — a saída tinha rampa, a entrada não, e a assimetria era audível
a cada troca de hino. Agora, com `fadeIn` ligado, `rampVolume(0, volume,
fadeTime)` roda **depois** de `play()` (que restaura o volume alvo e limpa o
`rampTimer`, e por isso não pode vir depois da rampa).

- **Fade de CONTEÚDO** (`runFadeOut(rampAudio)` + `mediaReady`/fade-in): troca
  de item enquanto já visível (ex: vídeo A → vídeo B com a cortina já aberta),
  fim natural (`ended`) e troca de TIPO de conteúdo (mídia local ↔ YouTube via
  `fadeOutToBlack()`, ver seção do Display). A mídia atual esmaece até o
  **preto** (não até o wallpaper — a cortina não participa dessa transição);
  a próxima entra com fade-in a partir do preto, só depois de pronta pra
  pintar (`mediaReady`: `img.decode()` / `loadeddata` do vídeo, timeout de
  2,5 s) — sem isso o conteúdo "pipoca" no meio do fade. Vídeo/áudio ramp
  0 → alvo junto (exceto preview `forceMuted`).
- **Fade da CORTINA** (`coverIn`/`coverOut`): cobrir ou revelar a mídia
  (independente de qual mídia é ou de qual tipo) — reservado para os três
  contextos legítimos do wallpaper (ponto final/inicial/manual), nunca para
  uma troca de conteúdo em si. Usado em:
  - **Saída** (`stop`, `clear`, `view→wallpaper`): `coverIn()` — a cortina
    sobe revelando... nada, ela é opaca; a mídia continua tocando
    (des)coberta por baixo. `stop`/`clear` cobrem **com rampa de áudio**
    (`coverIn(true)` — corta a reprodução abruptamente, então o volume desce
    suave); `view` toggle é **sem rampa** nos dois sentidos (só o visual
    muda, o áudio não é afetado).
  - **Entrada** (`load` que revela conteúdo coberto, `view→visual`):
    `coverOut()` — a cortina desce, revelando a mídia que já estava tocando
    por baixo (sem precisar esperar nada dela).
- **`ended` (fim natural)**: esmaece até o **PRETO** (`runFadeOut(false)` —
  sem rampa, o vídeo já parou sozinho), nunca a cortina — ainda não se sabe
  se um próximo item vem em seguida. Só cobre com o wallpaper de fato
  (`instantCover(true)`) **~400 ms depois**, e só se `ended` continuar
  verdadeiro e nenhum `loadSeq` mais novo tiver assumido a cena nesse meio
  tempo — ou seja, só quando fica confirmado que é o ponto final de verdade
  (`repeat='off'` ou Controle fechado). Com avanço automático de playlist, o
  `load` do próximo item (disparado por `onEnded`) chega quase junto e
  assume via `loadSeq` bem antes desse prazo — a marca nunca chega a
  aparecer entre os itens da playlist. `video.hidden` também passa a
  considerar `ended` (além do `kind`): sem isso, o `currentTime=0` do fim
  natural (preparando o replay) mostraria um salto pro primeiro frame antes
  do preto/cortina cobrir.
- `setVolume` do operador cancela qualquer rampa em curso (de conteúdo ou de
  cortina — ambas usam o mesmo `rampTimer` do `<video>`, mutuamente exclusivas
  no tempo); `play`/`stop` restauram o volume alvo (evita ficar preso em
  volume 0 pós fade).

### API exposta

```js
stage.handle(cmd)
stage.load(id, view, muted, volume, startAt, autoplay)
                       // startAt: posição inicial em segundos (opcional)
                       // autoplay: só `false` muda algo — a cena volta PAUSADA.
                       //   `undefined` mantém o comportamento de sempre (todo
                       //   load normal toca), então nenhum chamador antigo mudou.
                       // `handle({type:'load'})` os lê de cmd.time / cmd.playing
stage.clear()
stage.play() / pause()
stage.seek(seconds)
stage.setView(v) / setMute(m) / setVolume(vol)
stage.setFade({ fadeIn, fadeOut, time })  // chamado uma vez, no init, com createStage.FADE
stage.setFit(v)        // 'contain' (ajustar) | 'cover' (preencher) | 'fill' (esticar)
stage.setForceMuted(v) // alterna em tempo real se o stage é forçado a ficar mudo
                        // (preview com tela conectada; tela da rede antes do gesto)
                        // ou toca áudio de verdade, com rampa curta (MUTE_RAMP_TIME)
stage.coverIn(rampAudio) / coverOut() / instantCover(show)  // cortina do wallpaper (ver acima)
stage.fadeOutToBlack()  // esmaece até o preto e reseta (current=null) sem tocar a cortina —
                        // usado só na troca de TIPO de conteúdo (mídia local ↔ YouTube)
stage.getCurrent()     // → registro atual ou null
stage.getView()        // → 'visual' | 'wallpaper'
stage.isPlaying()      // → bool
stage.hasEnded()       // → bool (fim natural, aguardando replay — as camadas
                       //   paralelas usam isso para não re-renderizar com o
                       //   currentTime já zerado; ver "Fim natural" na Camada de Texto)
stage.isTimed()        // → bool (true para vídeo/áudio)
stage.getTime()        // → currentTime em segundos
stage.getDuration()    // → duração em segundos
stage.getMuted()       // → bool
stage.getVolume()      // → 0.0 – 1.0
```

*(Os getters sem chamador — `getPage`, `getFit`, `isForceMuted` — saíram da
superfície na limpeza da auditoria de agosto/2026; os setters correspondentes
ficam.)*

### Proporção da preview (`--pv-ar`)

A preview é uma **miniatura fiel do telão**, e isso só se sustenta se ela tiver
a **proporção** do telão. Ela era `aspect-ratio: 16/9` fixo — contra um dongle
2,17:1 (3120×1440, comum), toda mídia mentia sobre o enquadramento: uma imagem
16:9 preenchia a preview inteira e ganhava barras laterais de 18% na projeção,
um vídeo enquadrado aqui aparecia cortado lá, e um versículo que cabe em 3
linhas no telão aparecia truncado no meio da palavra.

`applyPreviewAspect(tv)` (controle.js) escreve `--pv-ar` em `:root`, e
`.preview` usa `aspect-ratio: var(--pv-ar, 16 / 9)`. A fonte é
`AVNative.displays()` — que já devolve `{w, h}` da tela conectada — mais
`onDisplayChange`, então trocar de TV no meio do culto reajusta a preview
sozinho. **Sem TV conectada a projeção é a própria preview em tela cheia**, no
celular: aí o alvo passa a ser a tela do aparelho em paisagem
(`max(screen.w, screen.h) / min(...)`), que é exatamente o que vai ao
espelhamento. No navegador, sem ponte, vale sempre esse segundo caminho.

**A preview ENCOLHE em vez de transbordar.** A largura ideal é
`--deck-pv-h × --pv-ar` (a altura da faixa da grade vezes a proporção), mas ela
nem sempre cabe: num telão largo, ou num celular estreito, a soma
`preview + 2 botões + gaps` estoura a coluna. Com `height: 100%` fixo e
`flex: 0 0 auto` a preview simplesmente vazava por baixo da coluna do mixer e
levava o botão de próxima estrofe para fora da tela. Hoje quem manda é a
LARGURA: `width` ideal + `max-width: 100%` + `flex: 0 1 auto`, com
`height: auto` + `aspect-ratio` — o flex encolhe a preview até caber e a altura
acompanha, preservando a proporção; `align-self: center` mantém a miniatura
centrada quando ela fica mais baixa que a faixa. A altura da faixa é o token
`--deck-pv-h`, usado tanto no `grid-template-rows` do `.deck` quanto neste
cálculo — se os dois divergirem, a conta da largura passa a estar errada.

O valor é limitado a `[PV_AR_MIN, PV_AR_MAX]` = `[1.2, 2.4]`: acima disso a
largura calculada estoura a coluna e a preview passa a ser encolhida pelo
`max-width: 100%`, deixando a faixa com folga vertical em vez de ficar
proporcional. Telas reais de projeção ficam entre 4:3 e ~2,2:1, bem dentro da
faixa; um painel 32:9 bate no teto e deixa de ser proporcional — troca
deliberada. Verificado em 24 combinações (6 larguras de celular × 4 proporções
de telão): nada transborda a linha nem invade o mixer. (Até a v5.48 o limite
também protegia os dois botões de estrofe que dividiam a linha com a preview;
eles saíram na v5.49 — ver "Um par de botões, dois eixos" —, e a faixa subiu de
130px para 150px justamente porque a largura sobrando virou espaço morto.)

Duas consequências que valem registrar:

- **A calibração deixou de ser duplicada.** Todo o dimensionamento das camadas
  já era em `cq*`, relativo ao container, logo **invariante de escala**: com a
  proporção certa, os mesmos números dão a mesma composição em 280px e em
  3120px. Os valores próprios que a preview tinha (`.pv-text-main` 16% maior,
  `.pv-lyrics-box` bem maior…) eram compensação empírica para a proporção
  errada. Hoje `.pv-*` repete literalmente os valores de `.text-*`/`.lyrics-*`,
  e a fidelidade passa a ser estrutural em vez de ajustada à mão.
- **A borda virou `outline`.** Com `box-sizing: border-box`, uma `border: 1px`
  entra no border-box e o `aspect-ratio` passa a valer para a caixa COM a
  borda — 1px em 128px de altura já desloca a proporção ~0,8%, e a proporção é
  justamente o que se está tentando acertar. `outline` com `outline-offset:
  -1px` desenha igual sem ocupar layout.

### Preenchimento da mídia (`setFit`)

`setFit(v)` aplica `object-fit` direto via `style` no `<img>` e no `<video>`
do stage (`'contain'` por padrão, aceita `'cover'`/`'fill'`; qualquer outro
valor cai em `'contain'`) — sobrepõe o `object-fit: contain` fixo do CSS.
Só afeta mídia local (imagem/vídeo do próprio stage); o iframe do YouTube não
usa isso (é conteúdo cross-origin, fora do stage). Persistido em `state.fit`
e propagado pelo comando `fit` — que, tanto no Display quanto no Controle, é
despachado direto para o stage **mesmo com um vídeo do YouTube tocando no
momento** (o roteamento normal de comandos cairia no ramo do YouTube, que
ignora `fit`, e o stage só pegaria o valor novo na próxima mídia local, com
atraso).

### Rampa de mudo (`setMute`)

Mutar/desmutar não corta o áudio na hora — faz uma rampa curta de volume
(`MUTE_RAMP_TIME`, 0,25 s) usando o mesmo `rampTimer` das outras transições
(mutuamente exclusivas no tempo, a mais recente cancela a anterior). Ao
mutar, a rampa desce até 0 e só então `video.muted` é de fato marcado como
`true` (evita o "pop" de um corte abrupto); ao desmutar, `video.muted` volta
a `false` já na hora (senão volume 0 não seria ouvido) e a rampa sobe de 0
até o volume alvo. Um `setTimeout` (`muteApplyTimer`) aplica o `muted` real
ao final da rampa de descida, mas confere `muted` de novo nesse instante —
um `setMute()`/`load()` mais recente pode ter mudado a intenção enquanto a
rampa corria, e a aplicação atrasada não deve "ressuscitar" um mudo já
desfeito. `setVolume()` (o operador arrastando o fader) cancela qualquer
rampa de mudo em andamento, senão o volume ajustado manualmente seria
sobrescrito pelo `muteApplyTimer` pendente. (Havia uma SEGUNDA implementação
desta mesma lógica, em paralelo, para o embed do YouTube — `ytRampVolume` no
Display e `ytPreviewRampVolume` no Controle, com `player.mute()`/`unMute()` nas
pontas. As duas saíram na v5.212 com o embed: hoje há um `<video>` só, e a
rampa é uma só.)

**Fonte única da rampa de volume** (`createStage.rampSteps` /
`createStage.MUTE_RAMP_TIME`): o passo-a-passo do fade sonoro
(`steps = max(2, round(dur*20))`, clamp 0–1) e a duração da rampa de mudo
(0,25 s) ficam definidos **uma vez** no `stage.js` e expostos como
propriedades de `createStage`. Os três "sinks" de áudio do sistema — o
`<video>` do stage (`rampVolume`), o player do YouTube no Display
(`ytRampVolume`) e o da preview no Controle (`ytPreviewRampVolume`) — reusam
esse mesmo `rampSteps`, cada um passando só o seu `apply(v)` (o "onde escrever
o volume"). Antes a matemática e a constante estavam duplicadas nos três
arquivos e podiam divergir. A *orquestração* do mudo (quando mutar de fato,
`muteApplyTimer`) continua por player, pois depende do estado de cada um.

### Concorrência de carregamento

`load()` é assíncrona. O contador `loadSeq` garante que apenas o **último** `load()`
iniciado aplica seu resultado — chamadas anteriores obsoletas são descartadas.

**Posição inicial e autoplay (`startAt`/`autoplay`)** existem para a
**reconexão do telão** (ver "Reenvio da cena"), e cada um tem uma sutileza:

- A posição só "gruda" **depois que a duração é conhecida** — escrever
  `currentTime` junto com o `src` é perdido em silêncio. Por isso ela é
  aplicada num listener `loadedmetadata` com `{ once: true }`: vale para ESTA
  fonte, e a próxima traz o seu próprio pedido. O listener reconfere `loadSeq`
  antes de escrever — outro `load` pode ter assumido durante a espera.
- `autoplay === false` **suprime o `play()`**, e só isso: quem revela a mídia
  continua sendo o `applyMedia()` + a cortina, no fim do mesmo `load`. Um vídeo
  pausado mostra o quadro congelado, que é exatamente o que o telão tinha antes
  de cair.

**A troca de view tem contador PRÓPRIO (`viewSeq`).** `setViewFaded` usava o
mesmo `loadSeq`, e isso fazia um toque em "visual on/off" **cancelar um `load()`
em curso**: o `load` fica assíncrono de 0,7 s a 3 s (fade-out de 0,6 s +
`getMedia` + `opfsGetFile` + `mediaReady` até 2,5 s), e nessa janela o
`runFadeOut` já levou a mídia anterior a `opacity:0` e volume 0 — mas o `src`
novo nunca chegava a ser aplicado. Resultado: telão preto e mudo, com
`current` ainda apontando para o item antigo. O gesto é natural logo depois de
escolher um item (e o deslize ↑ da preview em tela cheia faz o mesmo), então
não é um caso de borda.

A cortina é **ortogonal ao conteúdo** — é o que a própria seção "Duas
transições independentes" afirma. `setViewFaded` guarda os dois contadores:
descarta se um `setViewFaded` mais novo assumiu (`viewSeq`) **ou** se um
`load`/`clear` assumiu a cena no meio do fade (`loadSeq`) — nesses casos quem
chegou depois já decidiu o estado final da cortina. Ações exclusivas
(`load`/`clear`) continuam podendo cancelar um `load`; trocar a view, não.

#### Sem nada em cena, trocar a view não transiciona (v5.69)

`setViewFaded` compara `computeCover()` **antes e depois** de trocar a view e
volta cedo quando o resultado é o mesmo. Sem mídia — ou com a que havia já
terminada — a cortina cobre nos dois valores da view (os termos `!current` e
`ended` não dependem dela), então não há transição nenhuma a fazer.

Fazer uma era o defeito: `coverOut()` esmaecia o wallpaper por 0,6 s sobre o
VAZIO, que é **preto**, e o `instantCover(computeCover())` do fim o recolocava.
Do lado de quem opera, descobrir o telão sem mídia nenhuma **"piscava preto e
voltava"** — uma reação forte para um botão que ali não muda nada do que está
projetado. Só a direção `wallpaper → visual` sofria: na oposta, `coverIn` já
voltava cedo por `coveredNow`.

A exceção é o parâmetro **`overlay`** (`stage.handle({ type:'view', overlay:true })`),
que o Display passa quando o cartão de texto está no ar: ali existe uma camada
por cima do stage, descobrir revela alguma coisa, e o fade tem de acontecer. O
stage sozinho não tem como saber disso — ele só enxerga o que ele mesmo desenha.

---

## Controle

### O tema (claro × escuro), em Configurações

Uma linha segmentada logo abaixo de "Modo do app", e a proximidade é
deliberada: são a mesma classe de decisão ("como este app se apresenta") e as
duas são LEMBRADAS entre aberturas. O escuro vem primeiro por ser o padrão, e o
segmentado segue a leitura esquerda→direita das demais linhas — o estado de
partida à esquerda, como o "Padrão" do wallpaper desde a v5.188.

**Trocar aqui NÃO fecha o popup**, ao contrário do modo do app. O modo troca a
tela inteira ATRÁS do popup (não há o que ver com ele na frente); o tema troca
a cor DO PRÓPRIO POPUP, e é olhando para ele — que acabou de mudar — que o
operador decide se gostou.

**A escolha é lida do `localStorage` (`av.tema`) no topo do `controle.js`**,
antes do primeiro quadro, exatamente pela razão do `av.appMode` logo abaixo: uma
leitura do IndexedDB é assíncrona e chega depois de o app já ter pintado. Aqui o
preço de errar é maior, não menor — o modo troca a TELA, o tema troca a COR DE
TUDO, e um flash do app inteiro em preto antes de virar claro se vê a cada
abertura.

**O escuro é o padrão, e é o app sem atributo nenhum.** Não é inércia: este app
é operado num salão às escuras, e quem nunca escolheu precisa abrir na versão
que não cega o operador nem ilumina a fileira de trás. O claro existe para o
ensaio de sábado de manhã e para quem opera com a igreja acesa.

As cores, a montagem dos três blocos de `tokens.css` e a razão de o PALCO não
ter tema estão no Design System, mais abaixo.

### Modos de uso: "Modo Fácil" (padrão) × avançado

> **O nome na TELA é "Modo Fácil"**; no CÓDIGO o modo continua sendo `'simple'`
> (a classe `mode-simple`, o `appMode`, o `data-mode`) — trocar a string interna
> não mudaria um pixel e esbarraria em dezenas de referências, a mesma razão pela
> qual a aba de Ferramentas segue com `activeTab === 'mic'`.

O app atende duas pessoas: uma abre o celular para **conectar a tela e tocar um
louvor**; a outra opera o culto inteiro. A tela que serve bem à segunda é
excessiva para a primeira, e esconder recursos atrás de uma configuração só
empurraria a escolha para um lugar onde ninguém procura.

**O app abre no ÚLTIMO MODO USADO**, e no simplificado para quem nunca escolheu —
nunca por um seletor na abertura, que cobraria um toque de todo mundo, inclusive
de quem nem sabe que há dois modos, antes de mostrar qualquer coisa útil. A
classe `mode-simple` **já vem no `<body>` do HTML** (e `.open` no `#simpleMode`),
então a tela certa aparece sem esperar JS ou IndexedDB.

**A troca mora em Configurações, nos DOIS modos** (segmento "Modo do app",
`#appModeSeg`) — é ele que GUARDA a escolha entre aberturas. Os botões de
cabeçalho que faziam o mesmo saíram: eram dois controles para uma decisão só, e
o do avançado ocupava a esquerda de uma faixa com largura de celular (e
empurrava o título 63px para fora do centro, medido). No Modo Fácil o cabeçalho
ficou com uma **engrenagem** (`#simpleSettingsBtn`), que é o ÚNICO acesso a
Configurações aqui — daí ela ser `--accent` e não o `--muted` da gêmea do mixer.

> **A ORDEM DAS DUAS REMOÇÕES NÃO FOI ACIDENTE:** o botão do Modo Fácil não podia
> sair antes de existir a engrenagem, porque este modo esconde a `.bottombar`
> inteira — tirar os dois de uma vez teria TRANCADO o operador aqui. Primeiro se
> cria o caminho, depois se remove o atalho.

#### O modo é LEMBRADO entre aberturas

- **Fica em `localStorage`** (`av.appMode`), e não no IndexedDB como TODO o resto
  do estado. O motivo é decisivo: esta chave precisa ser lida **antes do primeiro
  quadro**. Uma leitura do IDB é assíncrona — ela volta depois de o app já ter
  pintado o simplificado, e quem tivesse deixado o avançado veria a tela errada
  trocar embaixo do dedo. `localStorage` é síncrono e mora no mesmo
  `app_webview/`: mesma durabilidade, mesma regra de backup.
- **UMA fonte, não duas.** Gravar nos dois lugares "por garantia" só cria o dia
  em que eles discordam e ninguém sabe qual vale.
- **A restauração é em duas metades.** No TOPO do `controle.js` vai só a pintura
  (a classe do `<body>` e o `.open` do `#simpleMode`), que é a parte que não pode
  esperar; o resto (`setAppMode(appMode)`) roda no `init()`, **depois do
  `load()`** — no avançado ele posiciona o vazado da faixa de abas
  (`moveTabIndicator`), e medir a faixa antes de `load()` desenhá-la dá zero.
- **ARMADILHA:** um `setAppMode('simple')` literal no fim do módulo (que existia
  "para fechar o ciclo com o HTML") passou a reescrever o `localStorage` em toda
  abertura, e o avançado nunca sobrevivia a fechar o app — invisível no diff,
  porque a tela ainda pintava certo até aquela linha rodar.
- **`localStorage` pode LANÇAR** (armazenamento bloqueado): leitura e escrita em
  `try`, e o padrão do app já é a resposta certa no `catch`.

**O simplificado NÃO é uma segunda implementação.** A tela avançada continua no
DOM, só oculta (`body.mode-simple`), e os controles daqui **acionam os botões
reais por `.click()`** — o padrão da notificação nativa. Um botão `disabled`
continua sendo no-op natural, e nenhuma regra de borda passa a existir em dois
lugares. Na mesma linha, `renderSimple()` **copia o glifo e as classes** dos
botões do mixer em vez de recalcular play/pause e mudo.

**A tela é um CONTROLE REMOTO**: teclas grandes (`.simple-key`), nada de
arrastar — quem usa este modo está de pé, com o celular numa mão só. E **sem
contorno**: numa tela em que TUDO é tecla um filete não distingue nada, só
devolve a grade de molduras. Quem diz "isto é tocável" é o fundo mais claro que o
do app e o `:active` que afunda.

| Elemento | O que faz |
|---|---|
| **Seção de conexão** (`#simpleConn`) | as duas formas de conectar — espelhar para a TV e transmitir para navegador, **dois botões irmãos** (ligada, a segunda perde o preenchimento, fica no vermelho contornado e nomeia o desligamento). Ligar e desligar ANIMAM: a folha cresce primeiro e o endereço entra depois (`grid-template-rows: 0fr → 1fr` no `#castLive`, com os atrasos invertidos no fechamento), e a lista de telas é um DIFF por rótulo — refeita por inteiro, ela recomeçaria a animação a cada leitura de 2,5 s e recriaria o botão "Desconectar" debaixo do dedo. Só SEM tela conectada, e ali é a ÚNICA coisa legível: a faixa de ações é içada para o centro da tela, por cima da cortina. É o MESMO nó da folha de "Conectar uma tela" (`#castConn`), movido por `hostCastConn` |
| **Preview** (`.simple-stage`) | a projeção em miniatura, **só com tela conectada**. Mora na faixa de baixo, dividindo a linha com "Buscar música"; o topo da tela é da LETRA, que é o que se lê durante o louvor |
| **Buscar música** (`#simpleSearchBtn`) | o MESMO popup do acervo (`openHymnSearch`); um toque na linha **toca a versão Cantada direto**. Fica na ZONA DE BAIXO — buscar é o começo de OPERAR, então pertence ao transporte, a milímetros do ▶ que vem depois de escolher. Sem tela a preview some e a grade vira uma coluna, com a busca inteira |
| **Linha do tempo** (`#simpleTime`) | decorrido · barra · duração, espelhando a `#seek` do avançado; some quando o item não tem duração. **Interativa**: tocar salta, arrastar procura — voltar o refrão é a coisa mais comum num louvor, e mandar o operador SAIR do modo para isso é o oposto do que o modo dá. O alvo é a FAIXA (`.simple-time-hit`), não o traço de 4px. O comando sai no `pointerup` (um `seek` por quadro engasgaria a mídia) e `simpleSeeking` impede o `timeupdate` de puxar o preenchimento debaixo do dedo |
| **Letra** (`#simpleLyrics`) | a letra INTEIRA da música em cena, com o mesmo destaque da leitura auxiliar do avançado |
| **Play/pause, parar e mudo** | `.click()` em `#playpause` / `#stop` / `#muteToggle`. O parar é a outra metade do transporte — sem ele, tirar a mídia do telão obrigava a ir ao avançado, que é o que se faz no fim de cada louvor |
| **Volume** (`#simpleVolDown` / `#simpleVolUp`) | teclas − e + com o número no meio (`.simple-vol-read`), nunca um slider |
| **Configurações** (`#simpleSettingsBtn`) | `openFadePopup()` — e é de lá que se troca de modo |

**Sem escolha de variante.** O toque na linha da busca chama `simplePlaySong()`,
que toca o Cantado e pronto: abrir a lista com cantada/playback/letra seria
devolver ao operador a decisão que este modo existe para poupar.

**A pergunta do download aparece UMA vez.** `ensureDownloadConsent()` pergunta
antes de gastar internet e grava a resposta em `state.downloadOk` — repetir a
pergunta a cada música viraria ruído no meio do culto. A verificação usa
`songVariantsNeeded()`, a mesma regra da sincronização em massa (não basta ter
`fileIdFull`: o arquivo pode ter sido apagado por fora).

**Volume em degraus, não em curso.** `simpleVolStep()` usa o MESMO passo dos
botões físicos (`VOL_KEY_STEP`) e a mesma `applyVolume()`. `holdRepeat()` faz a
tecla repetir enquanto segurada: o primeiro passo sai no `pointerdown` e a
repetição só começa depois de uma pausa, senão um toque comum viraria dois.

**A zona de letra reusa o renderizador da leitura auxiliar**: `lvBuildSong()` e
`lvMarkCurrent()` recebem o CONTAINER como parâmetro, e `refreshSimpleLyrics()`
entra no mesmo pulso de `renderSlideNav()`, sem timer próprio. Rolar com o dedo
desliga o acompanhamento até a próxima música, como no popup.

A espiada do volume pelos botões físicos (`peekVolume`) **não roda aqui**: as
teclas de volume já estão na tela, com o número ao lado.

#### Sem tela conectada, o modo inteiro fica bloqueado

Neste modo **a projeção É o telão** — não existe preview aqui. Sem tela, buscar
uma música e dar play não produz nada: nem imagem nem som (a preview toca o som
deste aparelho só no modo AVANÇADO — ver "A saída de áudio"; aqui ela segue muda,
e é este bloqueio a razão).

`renderSimpleGate()` cobre a tela com a cortina `#simpleVeil` (`backdrop-filter:
blur(7px)` mais um véu em `--veil`), que **intercepta os toques** do que ficou
atrás. Ela é só o vidro fosco; na frente sobem duas coisas, e só duas:

- **a seção de conexão** (`#simpleConn`), a única ação que resolve o bloqueio.
  Bloqueada a tela, a faixa de ações deixa de ser faixa: preview e "Buscar
  música" somem, e o que resta é içado para o centro exato da tela em
  `position: absolute`. O cartão tem fundo próprio (`--panel`) porque a cortina
  embaçada não é fundo de leitura;
- **Configurações** (`#simpleSettingsBtn`), no cabeçalho, por onde se volta ao
  avançado. **Sem TV o app não fica inútil** — a projeção passa a ser a preview
  em tela cheia —, e trancar essa saída transformaria a falta de telão numa
  parede. O que se bloqueia é o modo, não o app.

**A busca aberta é fechada pelo bloqueio** (`closeHymnSearch()`): perder a tela
com o popup no ar deixaria a busca funcionando por cima de uma tela bloqueada.

> **A remoção desta cortina (v5.199) foi um diagnóstico errado, e o registro
> fica.** O operador relatava "o botão de conectar que persiste em existir e
> bloquear a tela", e a leitura foi de que o BLOQUEIO incomodava — o que ele via
> era o botão ANTIGO reaparecendo, servido pela base embutida no APK depois de um
> recuo do watchdog que não limpava o cache do WebView. Ele chegou a dizer, com
> todas as letras, que "essa parte não era o problema". **Quando o operador
> descreve um sintoma com o nome de um elemento, o nome pode estar errado e o
> sintoma nunca está: vá medir o que ele está vendo.**

#### A preview no lugar da seção de conexão

Conectado, não há nada melhor a dizer sobre "está conectado?" do que **mostrar o
que a TV está exibindo**. A seção de conexão sai e a preview ocupa **a célula
dela** na grade — os dois nunca coexistem, então dividir a célula é o certo e
nada no resto da tela se move.

A preview não tem altura própria ali: a largura é a da coluna e a altura vem da
**proporção do telão**, que é o ponto de ela existir. Como a 16:9 nessa largura
ela sai mais baixa que a tecla ao lado (83px contra 94px num aparelho de 390px),
a grade a centraliza verticalmente — esticá-la custaria a fidelidade da
proporção, que é justamente o que faz a miniatura valer como espelho do telão.

O **ícone de cast no canto** é a saída, e a cor diz isso: conectado ele fica
**vermelho contornado** (`--danger-strong`), porque ali o toque DESCONECTA — quem
já diz que há tela recebendo é a própria preview, que só existe aqui quando há.
Nunca o `--danger` cheio: preenchido, o vermelho deste app significa "está no ar
agora" e competiria com a mídia que a miniatura está mostrando.

> **E por vinte e três versões ele não abria nada nesse estado.** A regra "alguma
> tela ENTROU com a folha aberta: ela fecha" foi escrita como `if (há tela && a
> folha está aberta)` — uma frase sobre EVENTO implementada como teste de ESTADO.
> Com uma tela conectada, QUALQUER passagem por aquela função fechava a folha, e
> `abrirCast` liga a enquete de 2,5 s que a chama: a folha abria e se fechava em
> milissegundos. A correção é a BORDA que a frase sempre descreveu
> (`gateTinhaTela`), com a memória **re-armada em `abrirCast`**.

**A tela cheia (`#pvFullBtn`) não aparece aqui**: neste modo existe um telão
conectado — é o que faz esta faixa existir — e a projeção está nele.

**O nó da preview é O MESMO do modo avançado**, movido de um pai para o outro
(`hostPreview`), pelo padrão do `#selbar` e do `<input type=file>`: duas previews
divergiriam no primeiro ajuste, e dois `createStage` decodificariam o MESMO vídeo
duas vezes num aparelho que já roda dois WebViews.

- **A troca acontece só na mudança de MODO**, não ao conectar/desconectar: sem
  tela a preview some por CSS e um `display: none` não custa nada.
- **Um `<video>` sobrevive à mudança de pai**, e como o embed saiu é só isso que
  a preview tem: `hostPreview` move o nó e nada mais precisa ser refeito.
  (Enquanto o iframe existia ele NÃO sobrevivia — mudar de pai o recarregava —,
  e `hostPreview` remontava a preview no segundo em que ela estava. Isto é a
  diferença de custo entre as duas eras: qualquer coisa que volte a pôr um iframe
  na preview repõe esse trabalho.)
- **`appendChild` de um nó já anexado é remoção e inserção atômicas**, então o
  "removido do documento" que pausaria o vídeo nunca chega a valer.

**O cartão de "Baixando…" aparece aqui também** — é a mesma preview, logo o mesmo
`previewBusy`. Ele volta `visivel: false` no simplificado **sem tela conectada**,
quando a preview não está na tela. As medidas são reduzidas por `.simple-stage`
(anel de 22px, fontes menores) e reservam à direita os 38px do `.pv-fab`, senão
ele transborda a miniatura e passa por baixo do ícone de cast.

**A única parte que muda por contexto é quem responde "há tela?"** No app são as
telas de apresentação que a ponte lista (`AVNative.displays()` +
`onDisplayChange`); no navegador vale a **janela do Display** que o botão abre
(`openWebDisplay`), e como não há evento de "janela fechada", um relógio de 1 s
olha o `closed` — e ele só existe enquanto a janela existe.
### Layout geral

```
┌─────────────────────────────────────────────────────────┐
│                    CRONOGRAMA                           │ ← .list-header (topo; sem appbar)
│  ┌───────────────────────────────────────────────────┐  │
│  │  item 1                                           │  │  ← .lib-list
│  │  item 2                                           │  │     (área scrollável)
│  └───────────────────────────────────────────────────┘  │
│  [        + Importar arquivos        ]                  │ ← #listFoot (fixo, não rola)
│   ↑ na seleção múltipla, a #selbar ocupa esta mesma fatia │
├─────────────────────────────────────────────────────────┤
│ [Cronograma] [Bíblia] [Ferramentas] [🔍]                │  ← .tabs (dentro da barra)
│  ┌─────────────────────────────────────┬──────┐         │  ← .bottombar (base fixa)
│  │  Nome da mídia atual  [seek bar]    │ Cfg  │         │
│  │─────────────────────────────────────│ Wall │         │
│  │    Preview (proporção do telão)     │ Letra│         │
│  │─────────────────────────────────────│ Mudo │         │
│  │  🔁  ⏮  ▶/⏸  ⏹  ⏭  [Playlist]    │ Vol  │         │
│  └─────────────────────────────────────┴──────┘         │
│  [margem segura para navegação por gestos]              │
└─────────────────────────────────────────────────────────┘
```

**Sem barra de topo (`.appbar`):** o app começa direto no cabeçalho da lista, e
`main` ganhou `padding-top` com `env(safe-area-inset-top)`.

**Cabeçalho da lista (`.list-header`):** o `#listTitle` centrado e, só na
navegação da Bíblia, o `#backBtn` à esquerda. A faixa já teve SEIS elementos (a
busca da pasta e o sincronizar foram para a gaveta, o indicador de versão desceu
para Configurações, os dois destinos e a troca de modo saíram) — e o sintoma de
estar disputada era objetivo: numa tela de 360px a raiz dos Favoritos cortava o
próprio título com reticências.

O título é `.84rem` (em .72rem o único texto que responde "onde eu estou" era
menor que o subtítulo de qualquer linha) e é centrado no ESPAÇO QUE SOBRA, não na
tela: centrá-lo pelo eixo da tela exigiria tirá-lo do fluxo e arriscar
sobreposição com o nome comprido de uma pasta. O único elemento que ainda o
desloca é o voltar da Bíblia (19px).

**Controles (`.bottombar`):** fixados na base, e eles **começam na faixa de
abas** — a barra é um `flex` em coluna com dois filhos, a `.tabs` e o `.deck`.
Antes a faixa era o último elemento do `<main>` e flutuava sobre o fundo do app,
separada da barra por dois espaços e por um degrau de cor: duas superfícies para
duas coisas que o polegar usa no mesmo movimento. Ela **não tem `border-top` nem
sombra**: com a fileira encostada no topo, as duas caíam sobre a emenda entre a
aba ativa e o conteúdo, que é onde os dois precisam ser a mesma superfície. O
`padding-bottom` usa `max(env(safe-area-inset-bottom), 12px)`, contra
acionamentos acidentais pela navegação por gestos.

**Grade real (CSS Grid), não flex aproximado:** `.deck` é um `display: grid` de 2
colunas (`minmax(0, 1fr)` / `56px` do mixer) × 3 linhas (`auto` /
`var(--deck-pv-h)` / `auto`), com `.nowplaying`, `.preview-row` e `.transport`
como itens DIRETOS. O `#mixer` ocupa as 3 linhas (`grid-row: 1 / 4`) e usa
`grid-template-rows: subgrid` para **herdar exatamente essas faixas de altura** —
garante alinhamento pixel a pixel entre as duas colunas em vez de depender de
flex-basis calculado à parte. O `padding` do `#mixer` é **só horizontal**:
padding vertical deslocaria as linhas herdadas do subgrid.

A primeira coluna é `minmax(0, 1fr)`, **não** `1fr`: uma faixa `1fr` tem mínimo
automático igual ao min-content do conteúdo, e o título (`#npName`, com
`white-space: nowrap`) tem min-content do texto INTEIRO mesmo já sendo cortado
por ellipsis — um nome longo inflava a coluna, esmagava a de 56px do mixer e
fazia a largura da preview depender do título.

**O mixer NUNCA dita a altura das faixas** — quem dita é sempre a coluna 1. Cada
`.mixer-slot` é uma caixa de posicionamento **vazia no fluxo**, e os botões vivem
num `.mixer-stack` `position: absolute; inset: 0`: um item absoluto não entra no
cálculo de max-content das faixas `auto` do `.deck`, e como o `#mixer` é
`subgrid`, qualquer coisa no fluxo ali contribuiria para as faixas do PAI. Era
essa contribuição que deformava a caixa ao ABRIR o slide de volume — o conteúdo
do mixer muda entre os dois estados (top/mid somem, o botão da base troca um SVG
de 22px por um glifo, alturas intrínsecas diferentes) e as faixas `auto`
mudavam de tamanho, levando junto a altura do deck e da preview. (`min-height: 0`
resolve só metade: ele zera o mínimo automático, mas uma faixa `auto` continua
sendo dimensionada pelo max-content dos itens.)

| Fatia | Linha da grade | Conteúdo |
|---|---|---|
| `.mixer-top` | 1 (`.nowplaying`) | **Configurações** (`#settingsBtn`, engrenagem), **sem caixa de botão** |
| `.mixer-mid` | 2 (`.preview-row`) | **letra/texto completo** (`#lyricsViewBtn`, SVG inline), **cortina do telão** (`#viewToggle`), **mudo** (`#muteToggle`) — cada um com `flex: 1` |
| `.mixer-bottom` | 3 (`.transport`) | **volume** (`#volToggle`/`#volClose`, recolhível) |

A ordem separa o que NÃO opera o culto do que opera: a engrenagem no topo,
sozinha, e abaixo o bloco de operação (letra → cortina → mudo → volume), que é o
que o polegar procura sem olhar. Dentro da fatia do meio a leitura da letra vem
primeiro: é o botão que se consulta o tempo todo enquanto o louvor corre, e a
cortina serve às transições.

**A engrenagem não tem caixa de botão** (`.settings-btn`, e por isso não é
`.ctl-btn`): a fatia do topo acompanha a altura de `.nowplaying`, bem menor que a
da preview, e um bloco achatado ao lado de quatro botões de altura cheia lê como
um botão mal encaixado. É o mesmo tratamento do `#backBtn`: navegação/acesso é
chapado, operação é botão.

**Fonte única do volume (`applyVolume`)**: o fader, o arrasto vertical no terço
direito da preview em tela cheia e os **botões físicos** passam todos pela mesma
função — clamp, desligar o mudo se subir de 0, enviar o comando e atualizar o
fader.

**Botões físicos** (só no app; `window.__avVolumeKey`): a Activity intercepta
`KEYCODE_VOLUME_UP/DOWN` e entrega o passo aqui. O sistema roteia esses botões
para a **saída em uso**, e com Smart View ativo isso vira o volume da TV — o
operador apertava e o fader do app não saía do lugar. **No máximo (ou no zero)** o
passo é devolvido ao sistema (`AVNative.systemVolume`), senão um aparelho com o
volume de mídia baixo ficaria sem como subir com o app aberto.

**A tecla ESPIA o fader** (`peekVolume`, `VOL_PEEK_MS` = 2,8 s): sem isso o botão
físico mexia no volume de forma INVISÍVEL. Ela abre a MESMA visualização do toque
em `#volToggle` (literalmente `openVolume()`) e a recolhe sozinha — um segundo
jeito de desenhar o fader seria um segundo jeito de ele ficar diferente. Três
regras de convivência com o toque: só recolhe o que ela mesma abriu
(`volPeekOwned`); tocar em `#volToggle`/`#volClose` cancela a contagem
(`cancelVolPeek`); mexer no fader durante a espiada a reinicia (`bumpVolPeek`).

Tocar no botão de volume liga `.vol-open` no `#mixer`, que troca **top + mid**
pelo **fader vertical** (`.fader-wrap`, `grid-row: 1 / 3` — exatamente o espaço
de top+mid) mais um `#volClose` na fatia de baixo. O botão da base **não muda de
lugar** entre os dois estados, só de ícone e cor; quem anima é o que está ACIMA
dele. É só estado de UI, não persistido. As durações no JS
(`openVolume`/`closeVolume`) casam com as do CSS (`@keyframes vol-slide-in/out`).

**O fader tem a LARGURA DOS BOTÕES que ele substitui**: a coluna não muda de
espessura ao abrir o volume, só de conteúdo. Isso exige desenhar o trilho
(`appearance: none` + `::-webkit-slider-runnable-track`), porque a espessura do
trilho NATIVO é fixa — alargar o `<input>` sozinho só deixa a barrinha de sempre
boiando num alvo maior (verificado).

Como `appearance: none` desliga junto o preenchimento do `accent-color`, ele é um
gradiente com o corte em `--vol` (0–1), escrito por `renderControls()` no mesmo
ponto em que o valor do fader é sincronizado — um lugar só, e os dois nunca
discordam. O corte NÃO é `--vol * 100%` puro: o CENTRO do cap percorre a altura
MENOS a espessura dele (`--fader-cap`, 26px), então a conta desconta isso e a
borda do preenchimento fica exatamente sob o cap em qualquer posição.

**O cap carrega o NÚMERO (0–100)** (`#volValue`): saber que o fader está "mais ou
menos na metade" não é saber que está em 50 — e com os botões físicos o valor
muda sem ninguém tocar na barra. O número é IRMÃO do `<input>`, não filho
(`::-webkit-slider-thumb` é pseudo-elemento e não aceita conteúdo), então ele
repete a MESMA conta de posição, com `--vol` e `--fader-cap` declaradas no
`.fader-wrap` (o ancestral comum). `pointer-events: none`: quem recebe o arrasto
continua sendo o input por baixo.

**A linha da preview é só a preview**: os dois botões de estrofe que a
flanqueavam viraram o toque curto em ⏮/⏭. Com a linha livre, `--deck-pv-h` subiu
de 130px para 150px — a preview é dimensionada pela ALTURA (altura × `--pv-ar`),
então a largura que os botões ocupavam teria virado espaço morto dos dois lados.
O botão de **repetir** (`#repeat`) é o primeiro de `.transport`, com o de
playlist por último.

Até a v5.48 a tela tinha **quatro** botões para duas ações vizinhas: estrofe
(flanqueando a preview) e mídia (no transporte). Quatro alvos disputando a mesma
faixa estreita — e os de estrofe passavam a maior parte do culto **desabilitados**,
porque sem letra, versículo ou mensagem no ar eles não fazem nada.

Agora é **um par**, com os eixos separados pelo TEMPO do toque
(`attachTransportStep`):

| Toque | O que faz |
|---|---|
| **curto** | o eixo da CENA: passa estrofe quando há estrofe a passar (letra, versículo ou mensagem no ar); passa de mídia quando não há |
| **longo** (`LONGPRESS`, 450 ms) | **sempre** mídia — a saída para trocar de música com uma letra em cena |

- **Quem decide o eixo é `slideTarget()`**, a MESMA função que a notificação
  nativa consulta (`slideMode` em `pushNowPlaying`) e que os gestos da tela
  cheia já usavam. A regra existia em um lugar só e continua assim.
- **Quem executa continua sendo `#slidePrevBtn`/`#slideNextBtn`**, agora ocultos
  no DOM (`.slide-anchor`): é neles que `applySlideLimits` guarda "dá para
  passar estrofe agora?", e um botão `disabled` é um no-op natural. O gesto da
  tela cheia e a notificação seguem chamando `.click()` neles, sem saber de
  nada. Tirá-los do DOM obrigaria a espalhar essa regra por quatro chamadores.
- **O limiar é o mesmo `LONGPRESS` dos itens da biblioteca**: dois tempos
  diferentes para "segurar" no mesmo app seriam duas coisas para o dedo
  aprender. O toque longo age **ao vencer o prazo**, não ao soltar — segurar e
  ver a música trocar é a resposta que o dedo espera —, e o `click` seguinte é
  descartado por uma flag, para a ação não sair duas vezes.
- **O botão diz em que eixo está** (`renderTransportAxis`): contorno em
  `--accent` (`.slide-mode`) e o `title` nomeando estrofe/versículo/mensagem/
  página. Na notificação esse papel é do rótulo; aqui não cabe rótulo, e sem
  sinal nenhum o eixo só se descobriria depois de tocar — errar isso no meio de
  um louvor custa a música inteira.
  - **As três tabelas de rótulo (`SLIDE_AXIS_NAME`/`_PREV`/`_NEXT`) precisam
    cobrir TODOS os alvos de `slideTarget()`.** Elas são indexadas pelo alvo, e
    um alvo ausente não dá erro: vira `undefined` e o `title` passa a dizer
    literalmente "undefined · segure para a próxima mídia". Faltavam `deck`
    (desde a v5.97) e `songlyrics` até a v5.102 — justamente o alvo em que ⏮/⏭
    são o ÚNICO jeito de passar página. Alvo novo em `slideTarget()` = três
    linhas novas aqui.
- **E diz quando o eixo ACABOU** (`.axis-end`, opacidade .55): na última estrofe
  o toque curto não tem para onde ir. Antes isso era óbvio, o botão de estrofe
  ficava cinza; como o mesmo botão ainda serve à mídia no toque longo, ele não
  pode ser `disabled` — esmaecer entrega a mesma leitura sem tirar a outra
  metade do ar.

**Título rolante (now-playing):** o nome da mídia em exibição (`#npName`) tem
um span interno (`#npNameInner`); quando o texto não cabe na largura
disponível, `applyTitleMarquee()` liga a classe `.scrolling` e uma animação
ping-pong (`@keyframes np-marquee`) que rola o título de um lado ao outro para
poder ser lido inteiro (distância e duração calculadas pela medição do
overflow e passadas via `--np-shift`/`--np-dur`). Quando cabe, fica estático e
centralizado (com reticências como fallback). Remedido em cada
`renderNowPlaying()` e no `resize` (debounce).

A preview é um `createStage` com `forceMuted: true` que recebe os mesmos comandos
enviados ao Display (função `cmd()` envia ao canal E aplica na preview). A preview
local comanda a barra de progresso e o avanço automático da playlist. Para itens
YouTube, `cmd()` também dirige um segundo `YT.Player` próprio da preview (mudo,
qualidade mínima) — ver seção do YouTube no Display para os detalhes.

**Controles sobre a preview** (`.pv-fabs`, `setupPreviewGestures`): **dois**
ícones, um em cada canto da direita — **cast em cima, tela cheia embaixo** —,
sempre visíveis (ver "Layout de player", abaixo). Cada um ocupa uma caixa de
`--hit`, e o tamanho do ícone vem do CSS (`24px`), não do atributo do `<svg>`.

Passaram por três arranjos antes deste — e os dois primeiros foram **com quatro
botões**, que é o detalhe que explica por que eles não valem como precedente
contra o atual. Um **em cada canto**: dispersos, o olho procurava cada um num
lugar diferente, e um deles tampava a parte da miniatura onde costuma estar o
texto projetado. Uma **fileira na base**: sobrava vazio dos dois lados, já que
quatro botões não chegavam perto da largura da preview. Uma **coluna de vidro à
direita**, cada botão `flex:1` pela altura toda: com quatro, era a única forma
que cabia; com dois, virou uma barra de ferramentas grande demais para o que
tinha dentro.

Com **dois**, o canto voltou a ser a resposta certa (v5.67), e sem os dois
problemas de antes: não há dispersão com dois alvos na mesma borda, e o de cima
é o cast — não um botão qualquer no meio do caminho do texto, mas o mesmo canto
que todo player usa.

| Ordem (de cima) | Botão | Ação |
|---|---|---|
| 1 | `#pvCastBtn` (cast) | seletor de espelhamento do Android (`AVNative.openCast()`) — **só no app nativo**; oculto no navegador |
| 2 | `#pvFullBtn` (expandir) | **tela cheia** da preview (`requestFullscreen` + trava de paisagem) |

> Eram **três**: a engrenagem (`#pvSettingsBtn`) abria o popup de Exibição.
> Saiu na v5.49, quando Configurações ganhou um botão fixo no topo do mixer —
> duas portas para a mesma tela, uma delas escondível por um toque na preview,
> é espaço gasto sem informação nova (o mesmo argumento que aposentou a aba de
> Álbuns na v5.44). E uma **configuração** que some com um toque acidental na
> miniatura é a que ninguém acha.

> Havia um quarto (`#pvMsgBtn`, mensagem na tela). Ele saiu na v5.31: Mensagens
> virou uma seção da aba **Ferramentas**. Enquanto era a única ferramenta avulsa o
> FAB se justificava; com três delas, ter uma em cima da preview e duas numa aba
> era a mesma pergunta ("que aviso eu ponho na tela?") respondida em dois
> lugares — e o espaço sobre a preview é o que menos sobra.

São a única indicação de que essas ações existem, e a preview fica na base da
tela o tempo todo; escondê-los por omissão devolvia o problema dos gestos
invisíveis que eles substituíram (toque = tela cheia, toque longo = popup), que
nada na tela anunciava.

#### Layout de player: os cantos, sem moldura, permanentes (v5.67)

Eram dois retângulos de vidro (`--glass-bg` + borda + `backdrop-filter`)
**empilhados numa coluna** à direita, ocupando a altura inteira da miniatura em
partes iguais. Isso é desenho de barra de ferramentas, e ele compete com a
imagem justamente onde ela é pequena. Hoje são **só ícones**, um em cada canto
da direita: **cast em cima, tela cheia embaixo** — onde todo player os põe, e
fora do caminho do que está projetado.

- **A caixa continua sendo `--hit`** (o piso de alvo de toque do app). O que
  sumiu foi a moldura, não o alvo.
- **A tela cheia vai ao rodapé por `margin-top: auto`**, não por
  `justify-content: space-between`: no navegador o cast nem existe (`[hidden]`),
  e com um item só o `space-between` o jogaria de volta para o topo — o botão
  trocaria de canto conforme o contexto.
- **A legibilidade virou problema do ícone**, e a resposta é uma `drop-shadow`
  tripla no `<svg>`: ela acompanha o TRAÇO (uma `box-shadow` sombrearia a caixa
  vazia do botão). Duas sombras coladas e quase opacas empilham-se num contorno
  escuro — é o que salva o ícone branco sobre um slide branco, onde não há
  contraste nenhum —, e uma terceira, larga e difusa, o descola de uma textura
  movimentada. Contorno por sombra, e não `paint-order: stroke`, porque estes
  SVGs são desenhados a traço (`fill: none`) e não há preenchimento em volta do
  qual pintar um contorno. Os tokens `--glass-bg`/`--glass-line` saíram da
  paleta junto com a moldura: ninguém mais os usava.
- **O toque na preview não os esconde mais.** Esconder era resposta ao desenho
  errado — a coluna de vidro de fato tampava a miniatura. Sem ela não há o que
  atrapalhar, e o que sobrava era um estado escondido: uma preview sem botão
  nenhum não anuncia que basta tocar nela para trazê-los, que é o problema dos
  gestos invisíveis de volta, com um passo a mais. Errar o alvo por 2px também
  deixou de custar caro: antes o toque caía no reconhecedor de gestos e sumia
  com a coluna inteira, obrigando a tocar de novo só para recuperá-la. Fora da
  tela cheia a preview passou a **não ter ação própria**.

Ficam **sempre ocultos em tela cheia** (`.preview:fullscreen .pv-fabs {
display:none }`): sem TV conectada, a tela cheia É a projeção, e um botão
sobreposto iria junto para o telão. `.pv-fabs` é `pointer-events:none` (só os
botões recebem toque), senão a coluna cobriria parte da preview e o toque nunca
chegaria ao reconhecedor de gestos.

A **tela cheia** (`requestFullscreen` no `#preview` + `screen.orientation.lock
('landscape')`, permitida só já em fullscreen — padrão de player de vídeo,
destravada no `fullscreenchange`) é a **projeção quando não há telão
conectado**. CSS: `.preview:fullscreen` preenche a tela (cantos retos, sem
borda, `touch-action:none`; as camadas internas já são `inset:0` +
`object-fit`). O popup de **Configurações** (`#fadePopup`, aberto pelo
`#settingsBtn` no topo do mixer) guarda o **modo do app** (`#appModeSeg`), a
o seletor de **preenchimento da mídia**
(`#fitSeg` — Ajustar/Preencher/Esticar, ver `stage.setFit()`), as **imagens dos
slides** das músicas (`#lyricsBgSeg` — Mostrar/Remover, ver "Fundo preto vs.
imagens dos slides"), o **wallpaper do telão** e, no rodapé, o **estado do
telão**, o alvo de espelhamento e a **versão**. Chamava-se "Exibição" enquanto
guardava só como o telão se PARECE; com a mesa de som vinda do mixer, o que
reúne as linhas passou a ser "o que se decide uma vez, ao montar o culto" —
aparência do telão E roteamento do áudio. Nenhuma delas se opera durante o
culto, que é o critério de estar aqui e não na coluna do mixer. O `id` segue
`fadePopup` por herança (os controles de fade que lhe deram o nome saíram há
versões): renomeá-lo tocaria dezenas de referências sem mudar nada visível. As
transições (fade) **não têm controle ali** — são inerentes ao sistema (ver o
state `fade`).

**Controle por gestos invisíveis DENTRO do fullscreen:** a tela inteira vira uma
superfície de controle **sem desenhar nada no telão** (o operador espelha a tela
cheia). O reconhecedor distingue cada gesto por **posição (terço esq/central/
dir) + tipo de movimento** e aciona os **botões já existentes** (`.click()`, que
reaproveita os handlers e respeita `disabled` — ex.: estrofe ± vira no-op sem
letra):

| Gesto | Ação | Botão/rota |
|---|---|---|
| Toque terço **central** | Play/Pause | `playPauseEl` |
| Toque terço **esquerdo** | Estrofe anterior | `slidePrevBtnEl` |
| Toque terço **direito** | Próxima estrofe | `slideNextBtnEl` |
| Deslize **←** (horizontal) | Próxima mídia | `nextEl` |
| Deslize **→** (horizontal) | Mídia anterior | `prevEl` |
| Deslize **↑** (esq/central) | Wallpaper on/off | `viewToggleEl` |
| Deslize **↓** (esq/central) | Sair da tela cheia | `document.exitFullscreen()` |
| **Arrastar na vertical** no terço **direito** | Volume (cima=+, baixo=−) | `applyVolume` (a MESMA função do fader `#volSlider` e dos botões físicos) |

Limiares: toque `<14px`, deslize `>45px`, volume vertical `>12px` (relativo,
`-dy/(altura*0.6)`). `setPointerCapture` no `pointerdown` garante o rastreio do
arrasto. O terço direito faz **tap = próxima estrofe**, **arrasto vertical =
volume** e **deslize horizontal = mídia** (distintos por eixo/movimento); deslize
vertical no terço direito nunca vira sair/wallpaper (é sempre volume). A config de
preenchimento é persistida em `state.fit`, aplicada ao vivo via comando (`fit`,
Display + preview) e recarregada do state ao inicializar. A de fade **não
existe mais**: é fixa e compartilhada (`createStage.FADE`), sem state nem
comando (ver a chave legada `fade`).

### Wallpaper personalizado

A cortina do telão aceita uma **imagem escolhida pelo operador** no lugar do
desenho padrão — em **Configurações** (engrenagem no topo do mixer):
*Padrão* / *Escolher imagem* (nessa ordem desde a v5.188: o estado de partida
à esquerda, a ação à direita, como nos demais segmentados).

- **O PADRÃO é o símbolo oficial da IASD** (v5.188): branco, cor sólida única,
  centrado sobre um denim profundo quase-preto — as regras do
  identity.adventist.org (uma cor só, fundo contrastante, espaço livre maior
  que a altura do símbolo). O desenho inteiro mora em
  **`shared/wallpaper-padrao.svg`**, fonte ÚNICA usada pelo `.wallpaper` do
  Display, pelo `.pv-wall` da preview e pelas telas da rede (o bundle servido
  inclui `shared/`). A URL do SVG fica **nas duas folhas consumidoras**, com o
  mesmo caminho relativo — não no token `--wallpaper`, porque um `url()`
  substituído por `var()` resolve contra a PÁGINA, não contra a folha, e cada
  página o quebraria para um caminho diferente (foi o primeiro defeito da
  própria v5.188). O token guarda só a cor de base que aparece enquanto o SVG
  carrega. A marca de TEXTO "Audio Visual IASD"
  (`.wallpaper-brand`/`.pv-brand`) saiu com o gradiente verde: o símbolo é a
  identidade, e um texto por cima só competiria. (E a lição que o SVG carrega
  no próprio comentário: comentário de XML não aceita hífen duplo — um
  `--token` citado ali dentro invalida o arquivo INTEIRO, sem erro em lugar
  nenhum, só um fundo liso.)
- O blob mora no **state `wallpaper`**, que Controle e Display compartilham,
  então o comando `wallpaper` **não carrega payload**: só avisa que mudou, e
  cada lado relê do IDB. (Mandar a imagem pelo canal seria copiar megabytes a
  cada troca, sem ganho nenhum.) **Exceção: as telas da rede** não têm esse
  IDB — para elas o funil `telaEnriquecer` resolve o blob e manda um SEGUNDO
  comando com `__wp` (a URL `/m/` da imagem empurrada), ou o sentinela
  `__wp:'padrao'` quando a troca foi de volta ao padrão; e quem CONECTA no
  meio recebe o wallpaper endereçado no próprio `display-ready`
  (`telaReenviarPreferencias`, junto com `lyricsbg` e `fit`).
- A imagem é **reduzida para no máximo 1920×1080** (`fitWallpaperImage`) antes
  de ser guardada. O operador escolhe uma foto do próprio celular (12 MP);
  guardar e decodificar isso a cada abertura seria desperdício puro — a
  cortina nunca passa da resolução da TV. Imagens que já cabem são guardadas
  como vieram, sem recompressão.
- CSS: a imagem entra como `background-image` inline (vence o
  `background-image` do SVG padrão na folha) com `background-size: cover` —
  limpar o inline devolve o desenho padrão. Aplicado em `restore()` (Display)
  e no `init()` (Controle), além do comando ao vivo.

**Botão ⏹ ("Parar e limpar"):** envia `clear` (volta ao wallpaper) mas mantém
`currentId` — o ▶ recarrega e reproduz do início.

**Botão de playlist (`#plBtn`):** mora na própria linha de transporte
(`.transport`), à direita do botão de repetição — não é mais uma aba
separada (`.tabs`); abre o mesmo bottom-sheet com a fila de reprodução de
sempre. Reaproveita o tamanho/estilo de `.t-btn` (a linha de transporte
cresceu de 5 para 6 botões, cada um um pouco mais estreito). O badge de
contagem (`#plCount`) só aparece a partir do **2º item** (mostra
`count - 1`), e o ícone só fica destacado em `--accent` (`.has-items`) nesse mesmo
caso: com apenas a mídia atual em fila, a playlist é só a reprodução avulsa
e não deve chamar atenção nem com um "1" enganoso nem com o ícone colorido —
fica neutro (branco).

### Feedback (sem alerta flutuante) — e a exceção do salvamento

Não há mais **toast flutuante**. As informações são transmitidas pela própria
interface (estados de botão, contadores, listas). `flash()`/`dismissFlash()` em
`controle.js` viraram **no-ops** na remoção do toast e foram APAGADOS na v5.207,
com os três chamadores que ainda escreviam frases que ninguém via — e a armadilha
de um no-op com cara de canal já tinha cobrado o preço antes disso: as v5.136/v5.137 voltaram a usá-lo como
o ÚNICO aviso de fluxos novos (o desfecho de um share, a procura de OTA, a
sincronização de pastas), e essas mensagens simplesmente não apareciam. A
auditoria de agosto/2026 religou esses pontos ao `avisar()` (a faixa
`#saveHint`, ver abaixo): mensagem com conteúdo real fala por ali; o resto
segue sem toast.

#### O sinal nasce NO BOTÃO que foi tocado (v5.106)

O resultado de um salvamento é invisível justamente onde ele mais importa:
mandar algo ao Cronograma estando na Bíblia, favoritar de dentro do acervo,
guardar um preset das Ferramentas. O toque não produzia sinal nenhum e a única
forma de saber se funcionou era ir conferir — que é exatamente como se acaba
tocando duas vezes.

**O feedback é um pulso de 1,1 s no próprio botão** (`pulsar(btn, tipo)`), não
uma faixa no alto da tela. O motivo é o olhar: no instante do toque ele está no
botão, e é ali que a resposta tem de aparecer. Uma mensagem em outro canto exige
procurar o aviso, e num culto isso não acontece — o operador toca e segue.

```js
const PULSO_MS = 1100;
pulsar(btn, 'ok' | 'dup' | 'erro')   // → true se de fato pulsou
responder(btn, tipo, texto)          // pulsa; se o botão sumiu, avisa por texto
```

| `tipo` | Cor | Quando |
|---|---|---|
| `ok` | `--ok` | entrou |
| `dup` | `--warn` | **já estava lá** — é esta que impede o segundo toque |
| `erro` | `--danger` | não deu (sem rede, sem capítulo, item sumiu do acervo) |

Três detalhes que o mecanismo não pode dispensar:

- **`visivelNaTela(btn)` decide se o pulso VAI acontecer**, e `isConnected` não
  serve para isso: os bottom-sheets fecham por `opacity: 0`, o nó continua no
  documento. A pergunta certa é `offsetParent !== null` (nenhum ancestral em
  `display:none`) mais `!btn.closest('.popup-backdrop:not(.open)')` (a folha que
  o contém não está fechada). Pulsar um botão invisível é o mesmo que não dar
  feedback nenhum, e é por isso que `responder()` cai no texto nesse caso.
- **Quem re-renderiza a lista precisa ESPERAR o pulso.** `toggleFav` atualiza o
  próprio botão no lugar (classe `on`, `title`, `starSvg`) e adia o
  `renderLibrary` em `PULSO_MS` — chamar o render na hora destruiria o nó que
  está pulsando e o sinal duraria um quadro. Mesmo padrão em `refreshDiversos`,
  `exitSelection` (via `sairDaSelecaoDepois()`) e `closePlPopup`: a folha só
  fecha depois de o operador ver a cor. (`closeFolderPicker` era o quarto e saiu
  na v5.254, com as pastas virtuais e a folha de duas origens.)
- **As regras do pulso ficam no FIM de `controle.css`.** `.btn-pulso--ok` tem a
  mesma especificidade de `.row-btn`/`.sel-btn` (0-1-0), então quem decide é a
  ordem. Declaradas antes, elas simplesmente não pintam nada.

**Todo destino passa por `adicionarNaLista(lista, id, nome, btn)`**, que faz o
`listHas` antes do `listAdd` e escolhe entre `ok` e `dup`. Operações em lote
(seleção múltipla, pasta) resolvem o tipo em `tipoLote`/`textoLote` — um pulso
só na barra de seleção, em vez de quatro sinais piscando.

#### `avisar()`: o que sobra para o texto (v5.104)

`avisar(texto, tipo)` continua existindo, mas só onde o pulso não alcança, e o
que ele **não** é continua valendo: não é o toast de volta. Não flutua sobre os
controles (fica no TOPO da tela — a base é onde mora o transporte, e foi por
cobri-lo que o toast saiu), não pede toque para sair (`pointer-events: none`,
some em 2,4 s) e não é usado por nada que já tenha estado próprio na tela.

Dois casos, e só eles:

1. **O botão sumiu** antes de a resposta chegar (a folha fechou, a lista
   re-renderizou) — `responder()` detecta e cai no texto.
2. **O motivo não cabe num botão.** Guardar um pacote com menos de dois itens
   pulsa em vermelho **e** escreve "Monte a fila com dois ou mais itens antes de
   guardar": a cor diz que não deu, a frase diz por quê, e sem a frase o
   operador toca de novo esperando resultado diferente.

> **Armadilha do YouTube:** um vídeo baixado por `ytArquivo` **nasce na lista**
> (o `addMedia` lá dentro já recebe o destino), então perguntar `listHas`
> DEPOIS anunciaria todo download novo como "já estava lá". Em `ytAcao` a
> pergunta é feita ANTES, e só vale quando existe arquivo no aparelho — é esse
> o registro que será reaproveitado. As músicas do acervo não têm esse
> problema: elas vão para o catálogo `files`, não para uma lista.

#### Anti-duplicação (v5.104)

As listas são conjuntos de ids, então `listAdd` **já é idempotente para
mídia**: o mesmo vídeo não entra duas vezes na mesma lista, por construção. O
que não era idempotente é a **cena de roteiro** — cada uma cria um registro
novo, com id novo. Daí `cueChave(cue, data)`, a identidade de conteúdo de uma
cena (tipo + descritor), e duas regras diferentes por destino:

- **Favoritos não repetem.** Favoritar é marcar; dois "Salmo 23:1" na mesma
  gaveta são ruído puro e ninguém consegue distingui-los. O item existente é
  reaproveitado e o botão pulsa em `dup`.
- **O Cronograma PODE repetir.** O mesmo versículo pode ser lido na abertura e
  no apelo; a mesma contagem regressiva pode aparecer duas vezes. A duplicata é
  criada — mas o botão pulsa em `dup`, que é o que separa a repetição
  intencional do toque dado duas vezes.

A chave da MENSAGEM é só o `msgId`: o texto viaja no descritor como reserva
(para o roteiro não ficar mudo se ela for apagada), e compará-lo deixaria a
reserva decidir a identidade.
O único feedback migrado explicitamente para a UI é a **sincronização das
coleções**: `setCollStatus(id, text, autoClearMs?)` grava um subtítulo
no card da coleção (`renderCollectionCard`) — "Atualizando lista…", "Baixando N/T…",
"Já completo offline", "Sem internet — falha ao atualizar" etc. `autoClearMs`
limpa mensagens finais/erro sozinho; o progresso fica até a próxima chamada. O
`.toast` do CSS foi removido.

### Diálogo padrão do app (confirmações / prompts)

`confirm()`/`prompt()` **nativos foram substituídos** por um **modal no tema do
app** (`#appDialog`/`.dialog-*` no CSS + `openAppDialog`/`appConfirm`/`appPrompt`
em `controle.js`) — centralizado, com botão primário preenchido em `--accent-fill` e cancelar
neutro. É **assíncrono** (retorna uma Promise): `appConfirm({title, message,
okText, cancelText})` → `true`/`false`; `appPrompt({title, message, value,
placeholder, okText})` → string (OK) ou `null` (cancelar/fora/Esc). Um só
diálogo reutilizável (o DOM é estático no `index.html`); abrir um novo enquanto
outro está aberto resolve o anterior como cancelado. **Toda interação do tipo
usa isto**: excluir pasta sincronizada/virtual/Hinário, renomear, nova pasta e o
aviso de "sem Wi-Fi" da sincronização em massa. (A exclusão de **pasta virtual**,
que antes não confirmava nada, agora também passa por este diálogo.)

### Deslocamento com o teclado virtual

Para o teclado não cobrir listas/preview: o meta viewport declara
`interactive-widget=resizes-content` (o navegador encolhe o layout ao abrir o
teclado). Como fallback (navegadores que não honram o hint), um handler de
**VisualViewport** (`keyboardShift()` em `controle.js`) mede a altura coberta
pelo teclado (`innerHeight - vv.height - vv.offsetTop`) e escreve em `--kb`, que
`body { height: calc(100svh - var(--kb)) }` (controle.css) usa para encolher o
app pra cima. Quando o layout já é redimensionado pelo navegador (ou o teclado
está fechado), a conta dá ~0 e nada muda — os dois mecanismos convivem.

### O que o telão retoma ao RECONECTAR (`midiaNoAr`, v5.142)

Quando o dongle cai e volta, o Android recria a `Presentation`, o WebView
recarrega `/display/` e dispara `display-ready` — e o Controle reenvia a cena
(`resendSceneToDisplay`). A pergunta que faltava era **o que** contava como
cena.

`currentId` **não é** "está no telão". Ele sobrevive de propósito a duas coisas,
e é isso que permite repetir a faixa com o ▶:

- **`stopClear`** — o operador cobriu o telão (o comando `clear` leva o Display
  de volta ao wallpaper), mas o item continua selecionado;
- **`resetAfterEnd`** — a música acabou e nada a seguiu (`repeat === 'off'`); o
  `stage` já voltou ao wallpaper sozinho pela bandeira `ended`.

Reenviando por `currentId`, os dois viravam defeito: o telão acordava com um
vídeo **engatilhado** que ninguém pediu — e, num `<video>` pausado que nunca
tocou, o WebView pinta o `getDefaultVideoPoster` dele, o retângulo cinza com o
play — ou ressuscitava a música que já tinha terminado, no primeiro quadro dela.
`midiaNoAr` responde a pergunta certa: **um telão vazio também é um estado, e
restaurá-lo é não mandar nada.**

O mesmo estado conserta um terceiro defeito, que parecia não ter relação:

> **O ▶ depois do stop exigia dois toques no stop.** Ele decidia entre "retomar"
> e "recarregar" por `preview.getCurrent()`, que só fica nulo no **fim** do fade
> de saída do `clearFaded` (~0,6 s). O `play` mandado nessa janela era apagado
> pelo `clear` que terminava logo atrás: o botão não fazia nada, e o operador
> aprendeu a tocar em stop duas vezes — o que só comprava o tempo do fade.
> `midiaNoAr` cai no instante do stop, então o primeiro toque no ▶ já recarrega.

E o pôster: **`POSTER_VAZIO` ficou permanente** (ver `shared/stage.js`). Ele saía
no `loadeddata`, com o raciocínio de que "há quadro, então mantê-lo esconderia o
quadro congelado". A premissa estava errada — quem decide o que um `<video>`
pinta é o **show poster flag** do HTML, desligado só pela reprodução ou por um
**seek**. Numa cena restaurada pausada nenhuma das duas acontecia, a bandeira
seguia ligada, e sem atributo de pôster o WebView desenhava o placeholder cinza.
Com a bandeira desligada o atributo é ignorado pelo contrato, então mantê-lo não
custa nada; e para o quadro congelado aparecer de fato, a cena pausada agora
**sempre faz seek** (mesmo para o segundo zero).

### O preto de vários segundos da transmissão direta (v5.142)

Um stream leva segundos entre o comando e o primeiro quadro — init, índice e o
primeiro fragmento vêm da **rede**. Metade desse caso já estava resolvida: quando
a cena anterior era o wallpaper, a cortina fica de pé até haver quadro (o
`mediaReady` com `PRONTO_STREAM_MS` acontece **antes** do `coverOut`).

O que sobrava era a troca de **mídia para mídia**: ali o fade de saída já levou a
anterior ao preto e não há cortina para segurar — segundos de tela preta, sem
nada dizendo que o app está trabalhando. Do lado de quem opera isso é
indistinguível de uma projeção que morreu.

Agora um **giro** entra enquanto se espera (`mostrarEspera`), nos dois caminhos:
sobre o preto, e também sobre o wallpaper — porque ali o operador vê exatamente a
mesma tela de quando nada foi pedido, por vários segundos, depois de ter pedido
um vídeo. Detalhes que não são decoração:

- **Só no stream.** Um arquivo local vira quadro em milissegundos, e um spinner
  que pisca é pior que nenhum.
- **O nó é do MOTOR**, criado por ele no mesmo pai do `<video>`, com o
  `@keyframes` injetado uma vez — não está nos dois `index.html`, pela mesma
  razão que a cortina é compartilhada: duas cópias divergem no primeiro ajuste.
- **`resetMediaDom` o apaga**, então ele nunca sobrevive à cena que o acendeu
  (stop, clear e o começo de todo load passam por lá); e a ordem depois do
  `mediaReady` é conferir o `loadSeq` **antes** de esconder — um load mais novo
  já acendeu o giro dele, e apagá-lo depois de perder a corrida apagaria o
  spinner do load que assumiu.

### Girar a mídia (v5.142)

Vídeo gravado de lado no celular chega **deitado** no telão. Não havia o que
fazer: a mídia é do operador, reencodar no meio de um culto não existe, e "grave
de pé" não conserta um arquivo pronto.

- **Um botão que AVANÇA 90°**, em Configurações, e não quatro segmentos: ninguém
  pensa em "270°", pensa em "gira mais uma vez até ficar de pé", e são no máximo
  três toques até qualquer orientação. O rótulo mostra o ângulo vigente.
- **A caixa troca de eixo antes de girar** (`aplicarGiro` em `shared/stage.js`),
  e é isso que separa este código de um `transform: rotate()` solto: o `<video>`
  ocupa o palco inteiro (W×H) e o `object-fit` encaixa a mídia **nesse**
  retângulo. Girando só o transform, o encaixe teria sido calculado para o
  retângulo errado — um vídeo retrato girado para paisagem apareceria minúsculo
  no meio. Trocando `width`/`height` primeiro, a conta é feita no retângulo em
  que a mídia vai de fato aparecer.
- Por depender do TAMANHO do palco (que muda com a rotação do aparelho, a
  resolução da TV e a preview trocando de casa entre os modos), há um
  `ResizeObserver`; e `applyMedia()` o repõe, porque um elemento `hidden` não
  tem caixa medível.
- **Persistido** (`state.rotate`) como o preenchimento, e **reenviado ANTES do
  `load`** na reconexão: um telão que volta no meio de um vídeo girado não pode
  mostrá-lo deitado nem por um quadro.
- **Tomou o lugar do "Esticar"**, que saiu: distorcer a proporção é o defeito que
  "Ajustar" e "Preencher" existem para evitar, e ninguém o escolhia de propósito.
  O valor guardado é **migrado** uma vez na carga — sem isso, quem já o tinha
  ficaria com a mídia distorcida e sem nenhum controle na tela que explicasse por
  quê.

### O cast só era repintado no modo simplificado (v5.142)

O ícone de cast sobre a preview carrega o estado da conexão, e quem o pintava era
`renderSimpleCast()` — que começa com `if (appMode !== 'simple') return`. No modo
avançado ele **nunca** era repintado: o aceso que o simplificado deixou ficava
para sempre, e o operador via "conectado" sobre uma TV que já não estava lá. O
estado da tela não é decoração de um dos modos; saiu para `renderCastBtn()`.

Do lado do shell, dois avisos faltavam (ver `MainActivity.syncPresentation`): a
saída antecipada de "não há tela" estava **dentro** do `if (current != null)`,
então uma queda em que o sistema já tinha derrubado a janela sozinha não
notificava ninguém; e o `setOnDismissListener` — o caminho da queda por distância
— zerava a referência calado. O lado web ainda reconfere a lista **ao voltar para
a frente**, porque um evento perdido não se recupera sozinho e este WebView é
estrangulado justamente enquanto o app está minimizado.

### A saída de áudio: os displays, ou ESTE APARELHO (v5.215)

**Sem tela nenhuma conectada, quem toca o som é a preview do Controle** — isto
é, o próprio celular. Não há botão, não há preferência e não há nada a lembrar
entre sessões: o estado é **derivado da conexão**, e o único ponto que o aplica
é `acertarSaidaDeAudio()`, que liga e desliga o `forceMuted` do stage da
preview.

```
alguma tela conectada?  ── sim ──▶  preview MUDA (o som é da TV / das telas)
   (simpleDisplay)      ── não ──▶  preview TOCA (o celular é a caixa de som)
```

- **TELA é a pergunta larga**: a TV pela `Presentation` **ou** uma tela da rede
  recebendo. Desde a v5.187 elas são a projeção quando não há TV, e cada uma
  toca o próprio arquivo no `<video>` dela — contá-las é o que impede o celular
  de duplicar o áudio da sala, fora de compasso (são dois decodificadores). Quem
  responde é `simpleDisplay()`, a mesma função do Modo Fácil, por
  `algumaTelaConectada()`: delegar em vez de reescrever é o que impede as duas
  de divergirem no primeiro caso de borda. `telaoConectado()` continua
  respondendo só pela TV, que é a pergunta certa para o atraso da preview e para
  o botão de espelhar.
- **Só no modo avançado.** No Modo Fácil sem tela a cortina cobre tudo (ver o
  bloqueio daquele modo) e não há o que projetar; som saindo de um app bloqueado
  seria a única coisa acontecendo atrás de uma tela que diz "conecte uma tela".
  Trocar de modo é, por isso, um dos gatilhos de `acertarSaidaDeAudio()` — os
  outros são as telas (`renderDisplayStatus`), a transmissão (`lerEspelho`) e a
  janela do Display no navegador (`openWebDisplay`).
- **A troca é automática nos dois sentidos e não corta o áudio**: a rampa curta
  do `setForceMuted` (a mesma `MUTE_RAMP_TIME` do mudo) desce até 0 e só então
  muta ao emudecer, e sobe de 0 ao alvo ao dar som, respeitando o mudo e o fader
  que o operador já tiver ajustado. Uma TV conectando no meio do louvor cala
  este aparelho e o telão assume pelo reenvio de cena que a reconexão já faz
  (`resendSceneToDisplay`, com posição e estado); ela caindo devolve o som para
  cá.
- **O navegador pode recusar**, e a resposta é voltar a tocar MUDO na hora
  (`onBlocked` da preview + `somLocalBloqueado`). No app isso não acontece
  (`mediaPlaybackRequiresUserGesture = false`); num navegador comum a política
  de autoplay rejeita o `play()` com som sem ativação do usuário, e sem esse
  ramo o preço de ligar o som seria a preview **parar de tocar** — trocar uma
  ilustração muda por nenhuma ilustração. A recusa vale só até o próximo `load`:
  cada mídia nova ganha uma tentativa, e o toque que a carregou é a ativação que
  faltava.
- **O Registro diz onde o som está saindo** ("Som: …"). "Não sai som" tem causas
  que a tela não separa — mudo, fader em zero, tela conectada sem volume, este
  aparelho calado por haver tela —, e quem lê o Registro está a distância.

#### Por que não é a "mesa de som" de volta

Da v5.82 à v5.188 existiu um **modo manual** com esse nome: um ícone de
alto-falante sobre a preview (`#pvSoundBtn`) ligava a saída de áudio local, e
`setStandalone()` a alternava. Ele saiu por inteiro na v5.189, a pedido do
operador, e o argumento era bom: os dois WebViews dividem o mesmo processo e a
mesma saída de áudio do Android, então o `<video>` do Controle **rouba o foco de
áudio** e interrompe o player do telão no meio do louvor. A v5.141 já tinha
escondido o botão com telão conectado, e a v5.189 concluiu que a preview é uma
ilustração — e ilustração não faz som.

O que a v5.189 não respondeu foi o caso em que **não há display nenhum**: ali a
projeção É a preview em tela cheia, e uma projeção muda não é projeção. O louvor
simplesmente não tocava em lugar nenhum.

A diferença entre as duas versões é a que faz esta ser segura onde aquela não
era: **não existe interruptor a esquecer ligado**. O estado inteiro é uma função
da conexão, então o desencontro que matava a versão manual — o operador liga a
mesa, conecta a TV depois e o telão é interrompido — não tem como acontecer: com
qualquer tela conectada este aparelho está mudo, sempre. `tools/destinos.test.mjs`
trava a ausência do botão e do modo, e `tools/boot-nativo.test.mjs` (o único que
sobe a base com a ponte presente, que é onde a conexão existe) trava os dois
lados da regra.

Do lado nativo isto é **OTA puro**: nenhuma linha de Kotlin, `SHELL_VERSION`
intacto. O `AVNative.keepAudioAlive`, que a versão manual usava para o WebView
do Controle atravessar o segundo plano, **não voltou** — áudio audível já isenta
a página do estrangulamento (é o que a nota do `snoopDisplayStatus` no
`CLAUDE.md` descreve pelo avesso), e o `SessionService` mantém o processo vivo
enquanto houver cena.


### Leitura auxiliar (letra completa / capítulo inteiro)

O telão mostra **uma** estrofe (ou **um** versículo) por vez — o formato certo
para quem assiste, e o errado para quem opera: o operador precisa saber o que
vem depois, e a preview só espelha o que já está no ar. O botão do meio do
mixer (`#lyricsViewBtn`, folha com linhas) abre um bottom-sheet **com scroll**
(`#lyricsPopup`) com a íntegra do que está em cena.

- **Duas fontes, uma tela**: a **letra** da música em cena
  (`currentItem.lyrics`, os mesmos slides que o Display projeta — o slide de
  capa vira a linha "Início") e o **capítulo** da leitura bíblica
  (`bibleSession.verses`, numerados como numa Bíblia impressa). Basta a sessão
  existir: um capítulo fora do ar continua sendo o que o operador está lendo.
- **O seletor do topo (`#lyricsViewSeg`) só aparece quando há as duas** — o que
  acontece de verdade com um louvor de fundo durante a leitura. Com uma fonte
  só, ela abre direto, sem um seletor de uma opção. A escolha manual (`lvSource`)
  vale enquanto aquela fonte existir; sumindo, cai na disponível.
- **O RESPIRO ENTRE ESTROFES É UMA LINHA EM BRANCO** (`--lv-estrofe-gap`, no
  `:root` de `controle.css` — é medida de layout, não cor). O valor não é gosto:
  é literalmente o que a fonte codifica (`<br><br>`) e vale nos TRÊS lugares em
  que uma estrofe termina — o `gap` desta folha, o `gap` da zona de letra do
  Modo Fácil e o `margin-top` entre dois blocos DENTRO de um slide (a API às
  vezes empacota duas estrofes numa entrada só — v5.142). Uma fronteira de
  estrofe é uma fronteira de estrofe: parece igual nos três, senão a leitura
  ganha um ritmo que o texto não tem. Até a v5.225 os três divergiam e na
  direção ERRADA — 8,8 px (avançado) e 8,0 px (simples) entre estrofes
  diferentes contra 11,4 px entre blocos da mesma, medido: duas estrofes ficavam
  mais juntas que o miolo de uma. A estrutura por baixo estava inteira desde a
  v5.42; o que a desmentia era o par de medidas. `tools/smoke.mjs` trava a
  REGRA (entre ≥ dentro, entre ≥ uma linha, igual nos dois modos), nunca o
  pixel — escrever o número faria o oráculo reprovar numa mudança de fonte.
- **É leitura, não operação.** Nenhuma linha projeta nada ao toque: o que vai
  ao telão continua saindo dos botões de estrofe/versículo (`stepSlide`) e da
  tela da Bíblia. Um popup de consulta que também projeta seria a pior hora
  possível para um toque errado.
- **Um BLOCO de texto, não uma pilha de cartões**: cada estrofe/versículo é um
  parágrafo — sem fundo, sem moldura e sem o padding que cada cartão cobrava.
  Numa tela de celular aquilo custava mais da metade da altura em enfeite, e a
  letra é justamente o que se quer ver de uma vez. O destaque do que está no ar
  virou uma **barra na margem + a cor de acento**; todas as linhas têm o mesmo
  `padding-left` (com a borda transparente nas demais), então o texto não se
  desloca quando a estrofe muda. Na Bíblia o número do versículo entra na linha
  do texto, como numa Bíblia impressa.
- **Acompanha sozinho, mas não disputa**: a linha no ar fica destacada
  (`.lv-row.current`) e a lista rola até centralizá-la — até o operador rolar
  com o dedo (`lvFollow`, desligado no primeiro `pointerdown`/`wheel`, religado
  ao reabrir ou ao trocar de fonte). Sem isso, ler adiante seria impossível:
  a estrofe seguinte puxaria a lista de volta no meio da leitura.
- **Sem timer próprio**: `refreshLyricsView()` é chamada de `renderSlideNav()`,
  que já roda a cada tick de tempo e a cada troca de versículo/mensagem. Com o
  popup fechado custa uma comparação de classe. Uma **assinatura** do conteúdo
  (`lvSignature`) decide entre re-renderizar (trocou a música, o capítulo ou a
  disponibilidade das fontes) e só mover o destaque — e ela inclui a lista de
  fontes DISPONÍVEIS, não só a ativa: começar a leitura bíblica com um louvor
  tocando não muda o que está na frente, mas passa a haver o que alternar.

#### A divisão das estrofes dentro de um slide (v5.142)

Um slide da API pode trazer **mais de uma estrofe**, separadas por uma linha em
branco (`<br><br>` na origem, que `normalizeLyricText` converte em `\n\n`). O
visualizador desenhava o slide inteiro num nó só com `white-space: pre-line` — e
é aí que a divisão se perdia: **`pre-line` colapsa sequências de espaço em
branco**, então `\n\n` vira uma quebra simples e as duas estrofes encostam como
se fossem um bloco só. Era o relato "alguns hinos não estão dividindo, mesmo na
realidade tendo divisões".

`lvBuildSong` divide o texto em blocos e cria um `.lv-text` por bloco. **A LINHA
continua sendo UMA** (o mesmo `data-i`, o mesmo destaque, a mesma posição no
tempo): o que se divide é a apresentação do texto, não a unidade de projeção —
dividir a unidade quebraria o realce da estrofe em cena e o ⏮/⏭. Vale para os
dois lugares que desenham letra, porque os dois chamam a mesma função (o popup de
leitura e o painel do modo simplificado).

### Onde o Display roda

O Display **não é mais um app que se abre**. No aparelho ele é a
`android.app.Presentation` que o shell nativo cria sozinho na TV assim que uma
tela de apresentação aparece — e recria quando o dongle cai e volta (o WebView
recarrega `/display/`, dispara `display-ready` e o Controle reenvia o estado
atual). Por isso o rodapé do popup de Configurações (`#openDisplayBtn`) é um
**indicador de estado**, alimentado ao vivo por `AVNative.displays()` +
`onDisplayChange`: "Telão conectado: <nome> (<w>×<h>)" ou "Nenhum telão
conectado".

**Sem telão conectado**, a projeção é a **preview em tela cheia** (botão de
expandir sobre a preview) — o operador espelha a tela inteira do celular, o que
funciona em qualquer aparelho. É por isso que a tela cheia e seus gestos
invisíveis continuam existindo.

No **navegador** não há Presentation: o mesmo rodapé volta a ser um atalho
(`window.open('../display/', '_blank')`) para abrir a tela do Display numa
janela à parte — útil para desenvolver a base web fora do app, e nada mais.

### Abas e biblioteca

#### Como um item ENTRA no Cronograma

Todos os caminhos convergem para o mesmo modelo — `addMedia`/`addCue` (registro +
lista na mesma transação) ou `listAdd('imports', id)` para o que já existe. Não há
segunda rota de importação: `importarPeloSistema` reusa `importShare` de
propósito, porque é lá que mora o roteamento por tipo.

| Origem | Caminho | Destino |
|---|---|---|
| "Importar arquivos" (seletor do sistema, shell ≥ 21) | `importarPeloSistema` → `importShare` → `escolherDestinos` | **os marcados** (simplificado: `avulsos`) |
| `<input type="file">` (navegador / shell antigo) | handler do `fileEl` | idem |
| Compartilhamento de outro app | `checkPendingShare` → `importShare` | idem |
| Música do acervo | folha de destinos → `addSongToDestinos` | **os marcados** |
| Resultado do YouTube | folha de destinos → `ytAcao` | `avulsos` \| **os marcados** |
| Arquivo de pasta do sistema, item de pasta, favorito | botão `+` da linha | `imports` |
| Link YT já no Cronograma → arquivo | botão de download da linha | substitui **na mesma posição** |
| Versículo em leitura | botão ⊞ no rodapé da Bíblia | `imports` (cue `verse`) |
| Mensagem da aba Ferramentas | `+` na linha da mensagem | `imports` (cue `message`) |
| Letra de uma música do acervo | seletor "Letra" + destinos | `imports` (cue `songlyrics`) |
| Cronômetro/timer configurado | os dois botões de "Guardar esta contagem" | `imports` \| `favs` (cue `chrono`) |
| Sorteio configurado | os dois botões de "Guardar este sorteio" | `imports` \| `favs` (cue `draw`) |
| A fila da playlist | "Guardar como pacote" | `imports` (cue `group`) |

##### UM item, VÁRIOS destinos

O item é o mesmo; o que muda é em quantas listas o mesmo id aparece, e isso nunca
foi uma escolha exclusiva. A tabela `DESTINOS` (em `controle.js`) é a fonte
única — `chave` é o nome como o app fala do destino, `lista` é o nome dele no
banco (o Cronograma é a lista `imports` desde antes de se chamar Cronograma). Ela
substituiu o `YT_LISTA`, uma SEGUNDA tabela com as mesmas três listas só para o
YouTube; duas divergiriam no primeiro destino acrescentado a uma só.

**A gramática é uma só, e vale para todas as folhas:** toda opção — as três
listas E o "Tocar agora" — é SELECIONÁVEL de corpo inteiro, e um botão de
confirmar sempre visível é quem executa. A caixa de marcação é INDICADOR
(`pointer-events: none`), senão o toque que cai nos 20px dela morreria num filho
sem ouvinte. Desabilitado, o confirmar diz "Escolha uma opção".

**O conjunto é da FOLHA ABERTA, não do item** (`destMarcados`, zerado por
`destLimpar()` na abertura e no fechamento). Pelo mesmo motivo que o teto de
resolução nasce no padrão a cada item: uma marcação que grudasse mandaria para os
Favoritos, sem aviso, o vídeo que se quis ver uma vez.

**A união é lida NO CLIQUE**, antes de `closeSongMenu()` — como a variante
Cantada/Playback e o teto de resolução. Uma leitura feita DENTRO da ação
encontraria o conjunto zerado e o item iria para UM destino em vez de dois, sem
erro nenhum. `tools/destinos.test.mjs` trava esse ponto.

**O redesenho da folha é um HOOK DE MÓDULO** (`destRemontar`), ao lado do
`destExecutor`, e não um argumento que cada chamador precisa lembrar de passar —
foi assim que o "Tocar agora" ficou uma versão inteira sem acender o check ao ser
marcado: o estado ficava certo e só o desenho não acompanhava.

Casos particulares:

- **Combinado com um destino de guarda, a transmissão direta fica de fora:** ela
  não produz arquivo (é um manifesto que expira em horas), e quem marcou
  "Cronograma" pediu justamente o que sobra depois do domingo.
- **Um download só** (`ytAcao`): o arquivo nasce na PRIMEIRA lista escolhida e é
  espalhado por `listAdd` (idempotente). "Já estava lá" é sobre o CONJUNTO — um
  vídeo no Cronograma e fora dos Favoritos não é duplicata.
- **A importação PERGUNTA** (`escolherDestinos`, a mesma folha como pergunta),
  com o Cronograma já marcado. É a única porta que precisa de confirmação porque
  não há ação nenhuma até o operador dizer para onde. **Desistir não perde o
  item**: fechar resolve `null` e o lote entra no Cronograma. Um link do YouTube
  compartilhado abre a folha própria dele (destinos + forma + qualidade), e
  perguntar duas vezes seria pior que não perguntar. No simplificado a pergunta
  nem é feita: ali não existe Cronograma nem playlist.
- **A seleção múltipla sobrevive ao destino:** a `#selbar` só redesenha a lista,
  e quem a fecha é o ✕, o voltar do aparelho ou desmarcar o último item.
- **As cenas de roteiro não precisaram de nada**: ⊞ e ★ são botões visíveis ao
  mesmo tempo e nenhum fecha a tela.

A frase do aviso nomeia TODOS os destinos (`ondeDe`/`juntarFrases` sobre o
`LISTA_ROTULO`) e separa o que ENTROU do que JÁ ESTAVA — é essa distinção que
impede o toque repetido. Um aviso por lista seria três faixas piscando para um
toque único.

#### A faixa de abas

Ela fica **no alto da caixa de controles** (`.bottombar`) e são **abas de
verdade**: uma fileira SEM trilho, encostada na borda de cima da caixa e indo de
borda a borda (`margin: 0 -.7rem`, que desfaz o padding lateral dela). Quatro
alvos idênticos — **Cronograma** · **Bíblia** · **Ferramentas** (as `.tab`) e o
**acervo** (`#hymnSearchBtn`, `.tab-add`) —, todos `flex: 1` e `--hit-nav` de
altura, transparentes enquanto não escolhidos.

**A ativa é um VAZADO na cor do corpo**: pintado com `--bg`, o mesmo fundo das
listas logo acima, com raio só EMBAIXO — a aba e a tela que ela abre viram a
mesma superfície, que é o que a palavra "aba" sempre significou antes de virarem
botões. Quem confirma o estado é o **ícone em `--accent`**: o degrau `--bg` ×
`--bar` é 1,32:1, o piso das superfícies grandes, e num salão escuro isso sozinho
é pouco.

Quatro formas anteriores desenhavam uma CAIXA em volta da navegação (trilho de
cartão, fundos próprios por célula, segmentado, segmentado dentro da caixa de
controles) — quatro retângulos com fundo próprio se leem como quatro AÇÕES, e um
trilho por cima é uma segunda caixa dizendo "isto é um grupo", coisa que quatro
ícones lado a lado já dizem. O inverso (tinta nas NÃO escolhidas) foi testado e
revertido: a silhueta é a mesma, mas a mancha escura precisa acompanhar a aba EM
USO.

**O acervo continua SÓLIDO** (`--accent-fill`), dividindo a FORMA com as demais e
trocando só a tinta: na fileira convivem um ESTADO ("estou no Cronograma") e uma
AÇÃO ("abrir o acervo"), e sólido em accent é o que o app usa para "toque aqui e
algo acontece". A fileira inteira é lugar; ele é o único que age.

#### O vazado desliza

O preenchimento da aba ativa é um `<span class="tab-ind">` absoluto dentro da
`.tabs`, e não o fundo do botão: **um elemento pode se MOVER entre as abas; um
fundo que troca de dono só pode piscar de lugar**.

- **Posição e largura são MEDIDAS** (`moveTabIndicator()` lê
  `offsetLeft`/`offsetWidth` e escreve `--tab-x`/`--tab-w` em px), nunca uma
  fração fixa: "25% por aba" dependeria de as células terem sempre o mesmo
  tamanho — verdade hoje, e o tipo de suposição que quebra calada.
- **`moveTabIndicator(false)` POUSA em vez de viajar** (classe `no-anim` +
  reflow forçado antes de escrever os valores, senão o navegador agrupa as duas
  coisas na mesma passada e a transição roda assim mesmo). Usado ao ENTRAR no
  modo avançado (a caixa fica oculta no simplificado, e medir um elemento
  escondido dá 0) e num `resize` (girar a tela não é trocar de aba).
- **Os botões precisam de `position: relative`**, senão o indicador absoluto
  seria pintado ACIMA deles e cobriria o ícone da aba ativa.
- **A duração e a curva são as MESMAS da lista** (`--tab-move` no CSS,
  `TAB_MOVE_MS`/`TAB_MOVE_EASE` no JS): o vazado deslizando e a lista entrando
  pelo lado são dois efeitos de UM gesto. Viver em dois lugares é inevitável (um
  é transição CSS, o outro é Web Animations) — quem mexer num mexe no outro.

**A caixa de controles não tem `border-top` nem sombra**: as duas marcavam onde a
caixa começa e passaram a atrapalhar quando a fileira encostou no topo — a linha
cortava o vazado da aba ativa, e a sombra escurecia justamente a emenda entre o
vazado e o conteúdo, o ponto em que os dois têm de ser a MESMA superfície. O que
separa as duas caixas é o degrau de cor (1,32:1), que a aba ativa atravessa de
propósito.

As quatro células:

- **Cronograma** (`imports`) — itens importados; ficam até serem excluídos.
- **Bíblia** (`bible`) — ver a seção própria. O cabeçalho mostra "Bíblia" nas três
  telas dela: as internas têm nome próprio no corpo (`.bible-book-head`), mas a
  faixa de cima responde "em que aba eu estou".
- **Ferramentas** (`activeTab` segue sendo `'mic'`, por herança) — Mensagens,
  Tempo e Sorteio num seletor no topo, mais o rodapé com microfone e "Projetar no
  telão". O `data-tab` e `renderDiversos`/`refreshDiversos` mantêm os nomes
  antigos de propósito: renomeá-los não muda nada visível e esbarraria em
  `TAB_ORDER`, `scrollKey()` e nas guardas espalhadas que falam essas strings.
- **Acervo** (`#hymnSearchBtn`, a lupa) — **não é uma aba**: não tem `activeTab`
  nem entra em `TAB_ORDER`. Abre o popup que é, ao mesmo tempo, o navegador de
  coleções (campo vazio) e a busca por nome/número/trecho de letra (ao digitar).

- **Favoritos** (`activeTab` segue sendo `'folders'`) — pastas criadas pelo
  operador e pastas do dispositivo sincronizadas no OPFS. Continua sendo um
  `activeTab` (com toda a navegação interna: abrir, buscar, sincronizar), mas
  desde a v5.53 é uma **gaveta que desce do topo** (ver a seção própria),
  aberta pelo botão do **canto direito do cabeçalho** (v5.103 — antes era o
  botão ao lado de "Importar arquivos", no fim do Cronograma, e chegar lá
  exigia rolar a lista inteira). O voltar e o sincronizar moram no cabeçalho DA
  GAVETA; `renderTabs()` mantém o Cronograma aceso enquanto ela está aberta,
  porque é ele que está atrás.
- **Mensagens** — foi para a aba **Ferramentas** (v5.31), como seção do
  acordeão. Antes era um botão flutuante sobre a preview; ver abaixo.

#### O contrato do `shouldInterceptRequest`, e a transmissão direta

**O `InputStream` devolvido não é "a resposta": o Chromium o lê como o recurso
INTEIRO a partir do byte 0, e é ELE quem aplica o `Range`** — incondicionalmente,
para toda resposta interceptada. A cadeia, na fonte:

```
AndroidStreamReaderURLLoader::Start           → ParseRange(resource_request_.headers)  ← incondicional
AndroidStreamReaderURLLoader::OnInputStreamOpened → InputStreamReader::Seek(byte_range_)
InputStreamReader::Seek                       → VerifyRequestedRange + SkipToRequestedRange
net::HttpByteRange::ComputeBounds             → confere contra InputStream.available()
```

Devolver só a fatia pedida aplica o deslocamento **duas vezes**:

| faixa pedida | o que acontece |
|---|---|
| `bytes=0-…` | pular 0 é no-op → **funciona**, e esconde o resto atrás de si |
| `A ≥ tamanho da fatia` | `ComputeBounds` reprova → `ERR_FAILED` **antes de qualquer cabeçalho** |
| `A < tamanho da fatia` | pula `A` DENTRO da fatia e entrega o offset absoluto `2A` — o `fetch` RESOLVE e o vídeo não toca |

Como todo fragmento de mídia começa a megabytes do início, **só a primeira
requisição de cada faixa podia funcionar**.

**A correção é sair do contrato, não emulá-lo.** Do shell 27 em diante o
`shared/mse.js` pede `/stream/<token>?r=<ini>-<fim>` **sem cabeçalho `Range`
nenhum**: sem cabeçalho, `ParseRange` não acha nada, o seek não acontece, e a
fatia chega inteira. A resposta é um **200 seco** — sem 206, sem
`Content-Range`, sem `Accept-Ranges`, e sem `Content-Length` nosso (o loader
escreve o dele a partir do `available()`).

- **`FatiaComoTodo`** atende o ramo do cabeçalho (bundle antigo em shell novo):
  soma o prefixo que não existe no `available()`, absorve o primeiro `skip` e
  zera o fantasma na primeira leitura real — a maquinaria do WebView produz o
  resultado certo, e se um dia ela deixar de refatiar, a fatia sai crua e
  correta.
- **Erro precisa de corpo NÃO VAZIO.** Com `available() == 0` e faixa fora do
  zero, `ComputeBounds` reprova e a resposta inteira vira erro de rede sem
  status: **toda a tabela de mensagens abaixo é indeliverável** para qualquer
  requisição que não seja a primeira.
- **E a razão é saneada para ASCII:** `WebResourceResponse` lança
  `IllegalArgumentException` para qualquer caractere fora de `0x20..0x7E` —
  `IOException("pedaço acima de 24 MB")` tem cedilha, e estourar o teto produzia
  uma segunda exceção de dentro do `catch` em vez de um 502 legível.
- **O teto de 24 MB é TRAVA, não economia:** existe para o dia em que alguém
  apontar este proxy para uma faixa aberta e um vídeo inteiro tentar caber na
  memória do processo que hospeda os dois WebViews e a `Presentation`. O custo
  normal é a memória de UM pedaço (init: centenas de bytes; índice: poucos kB;
  um fragmento por vez).

`tools/webview-range.test.mjs` **transcreve** a regra do Chromium (com
`arquivo:função` de cada trecho) e roda os dois modelos de `InputStream` contra
ela, sobre um recurso em que o byte `i` vale `i % 251` — primo de propósito: um
deslocamento errado sai como **bytes errados**, não como tamanho errado, que é o
único jeito de enxergar a corrupção silenciosa do terceiro ramo. Se o Chromium
mudar essa regra, o lugar de descobrir é o CI, não o culto.

> **O caminho FELIZ não é testável aqui** (exige um fMP4 de verdade, e não há
> ffmpeg no ambiente). O que se trava é o contrato, dos dois lados:
> `webview-range` prova a REGRA e `mse.test.mjs` prova o que sai pelo FIO (a
> faixa na URL, sem cabeçalho).

##### O pôster padrão do WebView

Um `<video>` sem `poster` é pintado pelo WebView com **um retângulo cinza e um
play preto gigante** (contrato de `WebChromeClient.getDefaultVideoPoster`) — não
há como estilizá-lo, só como deixar de pedi-lo. O `stage.js` já escondia o
elemento enquanto não havia `src`; com `MediaSource` o elemento entra em cena
vazio e só ganha quadro depois de init + índice + primeiro fragmento virem da
REDE — **"sem `src`" virou "sem dados"**. A correção é `POSTER_VAZIO` (1×1
transparente), posto a cada `load` e removido no `loadeddata`:

- **transparente e não preto** — as camadas já pintam `--stage-bg`, e um segundo
  "qual preto" divergiria da paleta;
- **removido no primeiro quadro** porque o *show poster flag* do HTML continua
  LIGADO num vídeo pausado que ainda não tocou.

##### As mensagens de falha SÃO o produto

Este recurso roda no aparelho do operador, num WebView, contra URLs que expiram:
**não há como depurar de fora**, e a única coisa que atravessa essa distância é a
linha do Registro. Ela só serve se disser em que passo morreu e com que resposta.

O que o `StreamProxy` responde:

| Resposta | Significa |
|---|---|
| `404 (token desconhecido)` | o proxy foi alcançado e não achou o token |
| `502 (<texto da exceção>)` | o proxy falhou falando com o CDN |
| `403 (googlevideo: Forbidden)` | o CDN recusou — o proxy chegou lá |
| `404` **sem** razão | o proxy NEM foi consultado (respondeu o asset loader) |

O que o player escreve (`AVStream.ultimoErro` → `falhou ao tocar: …`), com
passo + faixa + bytes pedidos + status:

| Mensagem | O que aconteceu |
|---|---|
| `init vídeo: HTTP 403 pedindo bytes 0-739` | o googlevideo recusou |
| `init vídeo: HTTP 404 …` | o **proxy não foi alcançado** |
| `init vídeo: a requisição não completou` | o `fetch` nem saiu |
| `init vídeo: resposta vazia (HTTP 206, pedidos 740 bytes)` | status bom e zero bytes — o mais traiçoeiro, porque o `appendBuffer` aceita sem reclamar e o vídeo nunca começa |
| `init vídeo: o decodificador recusou (…) — mime …` | os bytes vieram e o WebView não os quis |
| `índice vídeo: sidx não reconhecido (N bytes em …)` | o `indexRange` não continha um `sidx` |

Regras que sustentam isso:

- **`diagnostico` e `diagnosticoStream` são campos SEPARADOS.** `buscar()` começa
  com `diagnostico = resumo(info)`, e como a desistência da transmissão é
  justamente o que dispara o download, o motivo durava até a linha seguinte.
- **`porQueNaoDash` conta, por tipo de faixa, quantas passam em CADA
  pré-requisito** — `vídeo mp4 6 (init 6 · índice 0 · codec 6)`. "Não deu" não
  leva a lugar nenhum; essa linha responde de uma vez se o problema é o YouTube
  não mandar os byte-ranges, a biblioteca não preencher o codec, ou não haver
  faixa mp4.
- **`Faixa.dash` exige init + índice, e NÃO tamanho.** O `contentLength` do
  `ItagItem` nasce em `-1` quando o YouTube não informa, e quem diz onde cada
  fragmento começa é o `sidx` — a transmissão inteira já foi barrada por um campo
  que o player nem usa.
- **Codec recusado imprime as STRINGS testadas** (`video/mp4; codecs="avc1.640028"`)
  e o veredito de cada uma.
- **`PAUSA ESPONTÂNEA` não é vídeo travando**: um `<video>` sem dados emite
  `waiting`, não `pause`. O que emite `pause` é o `video.pause()` no topo do
  `load()` — isto é, mídia NOVA entrando.

`tools/mse.test.mjs` sobe um servidor de mentira, confere as mensagens que chegam
ao `onErro` e afirma que **nenhuma pode conter `undefined`** (a armadilha de
aridade: `node --check` não vê aridade, e uma refatoração deixou `pegar()` com
três parâmetros e três chamadas passando quatro). Ele roda com **VP9 + Opus**, e
não com o `avc1`+`aac` do aparelho: o Chromium do Playwright é o build
open-source e não traz codecs proprietários, então `addSourceBuffer` recusaria
`avc1` e todo cenário morreria antes do que se quer medir. Quem confere o suporte
REAL é o Registro do aparelho.

#### UM registro só

Quatro blocos: **identificação** (versões da base, do shell e da ponte; estado do
telão; alvo de espelhamento; UA), **transmissão** (se este WebView tem
`MediaSource` e aceita `avc1`+`aac` — a primeira pergunta quando um "Tocar agora"
cai no download), **a última extração do YouTube**, e **a linha do tempo** dos
dois processos em ordem de relógio. O cabeçalho existe por razão prática: um log
colado sem contexto obriga a primeira resposta a ser sempre a mesma pergunta.

- **Copia-se o registro MONTADO, nunca o visível.** `diagTexto` é a ÚNICA fonte —
  não existe mais visor (`#diagBox` saiu na v5.207: 240 px empurrando para fora
  da tela as linhas que o operador de fato ajusta, para exibir a 0,68 rem um log
  cujo consumidor é um humano A DISTÂNCIA). Um botão de copiar que lesse o DOM
  emudeceria por inteiro.
- **`renderDiag` é assíncrona e roda duas vezes ao abrir a folha** (uma com o que
  já se tem, outra quando a resposta do telão chega) — daí a **guarda de
  sequência**, mesmo padrão do `loadSeq` do stage: sem ela a primeira pode
  terminar depois da segunda e sobrescrevê-la com a linha do tempo SEM os eventos
  do telão, que é justamente o que se foi buscar.
- Se um dia voltar uma caixa de log: **`white-space: pre-wrap`, não `pre`** — a
  linha do YouTube tem centenas de caracteres e viraria rolagem horizontal.

#### O download responde na MINIATURA, nunca numa faixa flutuante

Aviso pertence ao lugar onde a ação aconteceu. No caminho do YouTube o botão
NUNCA está visível (o `songMenuItem` chama `closeSongMenu()` antes da ação),
então `responder(btn, …)` caía sempre no aviso flutuante — no fluxo mais demorado
do app. Hoje o download só pulsa quando o botão por acaso está na tela; sem botão
visível, **silêncio**, porque a miniatura do resultado já troca o anel pelo ✓
(`setYtEstado('pronto')`).

**A falha ganhou o terceiro estado da MESMA miniatura** (`erro`, ao lado de
`baixando` e `pronto`): um download de minutos que termina em nada é o pior
silêncio possível do app. Em `--danger-text` sobre `--danger-soft`, e não
preenchido — vermelho preenchido é "está no ar agora". Some sozinho em 4 s e a
linha volta a aceitar o toque, porque tentar de novo é o que se quer depois de
uma falha de rede.

#### A linha da lista: nome + SUBTÍTULO

O tipo era um **selo** irmão do nome num `flex` em que o nome tem `flex: 1` —
isto é, disputava largura com ele: **a informação sumia exatamente nos itens de
nome comprido**, que são os que menos se distinguem entre si. E vídeo, áudio e
imagem nunca tiveram selo nenhum.

Hoje nome e tipo vivem numa coluna (`.row-text`) e o tipo é a **segunda linha**,
sempre visível. A linha continua com 51 px: a altura já era ditada pela miniatura
de 40 px, e duas linhas de texto somam ~35 px.

`subtituloItem()` diz **tipo + o detalhe que o registro já tem à mão**:

| Item | Subtítulo |
|---|---|
| vídeo | `Vídeo · 1080p` |
| áudio | `Áudio · 4:32` |
| apresentação | `Apresentação · 12 páginas` |
| item de player | `YouTube` — isto é, **depende da rede durante o culto** |
| item de URL | `Link externo` |
| cena de roteiro | o subtipo (`Versículo`, `Mensagem`, `Cronômetro`…) |

- **Nada aqui MEDE coisa alguma a cada render**, e é essa a regra que decide o
  que entra: a resolução vem do shell ou do `<video>` que já monta a miniatura, a
  duração sai de um `preload='metadata'` na importação, as páginas são um
  `.length`. Os campos `height` e `seconds` nascem no REGISTRO
  (`makeMediaRecord`).
- **Exceção consciente: a sincronização de PASTA não mede.** Ela percorre
  centenas de arquivos, e uma leitura de metadados por áudio ali é tempo que o
  operador sente para ganhar um detalhe numa linha.
- **A armadilha do `flex: 1`:** `.row-name` é filho DIRETO de `.row` em sete
  outras listas, e é o `flex: 1` dele que empurra os botões para a direita.
  Tirá-lo da regra base quebraria as sete de uma vez — ele fica, e é desfeito só
  dentro da coluna (`.row-text > .row-name { flex: none }`), porque num pai em
  coluna crescer significaria esticar na VERTICAL e descolar o nome do subtítulo.

#### A LINHA NO AR: `.active` × `.no-ar`, e o desligamento POR CAMADA

`.active` é o item ATUAL — o que o ▶ repete, e que sobrevive de propósito ao
Parar; `.no-ar` é o que está sendo PROJETADO agora. Como uma marca só, depois de
um Parar a linha seguia marcada com o telão vazio, e com uma cena de roteiro
sobre um louvor de fundo (duas camadas no ar) só uma das duas aparecia — isto é,
ela não respondia "o que está sendo projetado?", que é a pergunta que o segundo
toque (tocar de novo no que está no ar = tirar do ar) exige responder antes de
ser tocado. Quem responde são `linhaAtiva` e `linhaNoAr`, e esta lê `midiaNoArId`
**e** `cueNoArId` — as duas camadas, separadas.

O desenho de `.no-ar` é o mesmo "no ar" do resto do app (`--live-strong` sobre
`--live-soft`) e vem com **texto**: o selo `● No ar` prefixado ao subtítulo. Uma
cor a mais numa tela que já tem várias não ensina o que o segundo toque faz; a
palavra ensina.

**O desligamento é POR CAMADA — três portas:**

| a linha é… | o comando | o que continua |
|---|---|---|
| cena de roteiro (versículo, mensagem, cronômetro, sorteio) | `text-hide` | a mídia — o louvor de fundo segue tocando |
| mídia (áudio, vídeo, imagem, apresentação, YouTube) | `media-clear` | a Camada de Texto — o cronômetro segue no ar |
| — o **Parar** do transporte | `clear` | nada: é o ponto final, e está certo que seja |

Sem o `media-clear`, tirar a música de fundo levava o cronômetro junto e a única
saída era parar tudo e reprojetar a cena na frente da congregação.

**Quem escolhe a saída do palco é o DISPLAY**, não o Controle: `textActive` é
estado dele, e duplicar a leitura do outro lado é garantir que os dois divirjam
num domingo. Recebido o `media-clear`, ele manda ao stage `clear-media` (o
`fadeOutToBlack`, que esmaece o conteúdo **sem tocar na cortina**) quando há
texto, e o `clear` de sempre quando não há. A distinção não é estética: o cartão
de texto vive **por baixo** da cortina do stage — a mesma razão do
`instantCover(false)` do ramo de `view` —, então um `clearFaded` com texto em cena
fecharia o wallpaper por cima do versículo que continua no ar.

E o ramo do `media-clear` vem **antes** do bloco de `textActive` em `display.js`:
lá dentro `clear` é justamente o que chama `hideText`, e cair no fluxo comum
faria o comando atravessar até um `stage.handle` que não o conhece — sem erro,
sem log, com o cronômetro saindo do ar e nada que o explicasse.

**O PARAR mora DENTRO da miniatura** (`porParar`). Enquanto a linha está no ar,
tirá-la de lá é a única decisão que ela oferece — na fileira da direita ou dentro
da gaveta do `⋮` ele ficava atrás de um toque ou disputando espaço com ações que
ninguém quer ali. Na capa o alvo é o quadrado inteiro (`--thumb`), não custa um
pixel do nome, e fica sobre a única parte da linha que já dizia "é este item" —
que, com a mídia no ar, é literalmente o que está projetado. O conteúdo da
miniatura é escondido e o botão veste o mesmo preenchimento dos outros da linha:
sem foto por baixo não há o que neutralizar.

Uma função só (`porParar`) nas DUAS listas, senão duas anatomias iguais têm
desfechos diferentes — nos Favoritos ele não existia, e era ali que o operador o
procurava.

Por CSS, e não remontando a linha, porque **quem liga e desliga o estado é o
`marcarNoAr`**, que roda a cada `display-status` (~4 Hz) e só troca classes —
cirurgia de DOM nesse ritmo recriaria botões e perderia listeners quatro vezes
por segundo. O teste mede o RENDERIZADO, não a presença do nó: uma regra que
deixe de casar não apaga botão nenhum, ela só para de escondê-lo, em silêncio.

#### Os botões da linha viram UM SÓ (o `⋮`)

A coluna de texto é `flex: 1` entre a miniatura e uma fileira que **cresce com o
estado do item** — estrela, `+`, o par ↑↓, o download de um link do YouTube, o
Parar quando está no ar: até quatro alvos de `--hit` mais os `gap`, e quem paga é
sempre o nome, a única coisa da linha que não se adivinha.

`montarAcoesDaLinha(li, botoes)` é o funil único — devolve `[caixa, ⋮]` e é
chamado pelo `renderLibrary` e pelo `favItemRow`, para as duas listas não
divergirem. As decisões:

- **A caixa é ABSOLUTA e cobre do fim da MINIATURA até o `⋮`**
  (`left`/`right: calc(var(--thumb) + 1rem)`, a mesma conta dos dois lados).
  Partindo de `--hit` ela come 6px da capa — as duas colunas são as mesmas, então
  errar uma é errar a outra.
- **O fundo é COMPOSTO, nunca herdado.** `background: inherit` copia o VALOR, e o
  valor de uma linha no ar tem alfa .22: a faixa pintava translúcido POR CIMA do
  título, que continuava legível atrás dos botões. Hoje a base é o token opaco
  `--linha` e o estado entra como camada, como a `.row` se pinta.
- **Uma aberta por vez** (`linhaAcoesAberta`): duas seriam duas faixas cobrindo
  dois nomes, e o operador teria de fechar a errada para ler.
- **O fechamento de fora é `pointerdown` na fase de CAPTURA**, não `click`: ele
  fecha ANTES do clique, que é o que impede o menu de piscar por cima do que está
  sendo tocado (e um gesto que não termina em `click` fecha do mesmo jeito).
- **Escolher uma opção FECHA**, e esse ouvinte também é de CAPTURA por um motivo
  que não é preferência: todo botão de linha chama `stopPropagation` no próprio
  `click` (senão o toque acionaria o corpo da linha atrás), e um ouvinte de bolha
  na caixa **não veria nenhum deles**. **Exceções**, pela régua "a ação que NÃO
  TERMINA a conversa com aquele item": o par ↑↓ (reordenar se repete) e a
  ESTRELA (alternador — o desfecho dela é o próprio botão mudando sob o dedo).
- **O vazio da caixa fecha também**, e é a saída barata de quem só queria ler a
  linha: sem ele o único caminho de volta seria acertar o `⋮` outra vez.
- **O redesenho fecha** (`fecharAcoesDaLinha()` no topo do `renderLibrary` e do
  `renderFolderList`): a caixa é remontada a cada render, e a referência velha
  apontaria para um nó fora do documento.
- **O EXCLUIR é o primeiro da faixa**, isto é, o mais longe do `⋮` — que fica
  colado na ponta e é o alvo tocado repetidamente. Do outro lado o vizinho é o
  VAZIO da caixa, que também fecha, mas é área larga em que ninguém mira a borda.
- **O ícone é SVG inline.** `more_vert` (U+E5D4) **não está** no subset de 31
  codepoints de `material-symbols.woff2`, e glifo ausente desenha um retângulo
  vazio sem erro nenhum.
- **Na seleção múltipla não há `⋮`**: ali o alvo é o conjunto, e a linha volta a
  ser uma caixa de escolha.
- **UMA medida para os quadrados da linha** (`--thumb`): capa, botões da linha e
  `⋮`. Miniatura de 40px com botões de 34px são dois quadrados vizinhos com 6px
  de diferença que ninguém decidiu, e um alvo no PISO do app justamente na lista
  mais densa. A linha não fica mais alta — quem já ditava a altura era a capa.

#### O toque encolhe o CARTÃO, não o miolo dele

O feedback tem de ser `transform` no `.lib-item`, que é quem carrega a BORDA, e
não na `.row`: enquanto ela é transparente dá no mesmo, mas com ela visível
(`.no-ar`, `.active`, `.selected`) o miolo se afasta de uma moldura parada e abre
uma fresta dos dois lados.

MAS uma linha NÃO dá feedback por um toque dentro de um bloco que ela apenas
HOSPEDA (o `⋮`, a gaveta, a pasta aberta inline): ali já existe outra resposta, e
duas ao mesmo toque poluem o conjunto. Como `:active` não se simula por API, o
oráculo afirma a REGRA: o alvo do `transform` é a peça com a borda.

#### O subtítulo diz DE ONDE o item veio

`subtituloItem` compõe `tipo · álbum` quando o registro tem `hymnAlbum` — o mesmo
campo do slide de capa, preenchido também para o acervo já baixado
(`preencherAlbunsDosHinos`). **Não há leitura nova**: é o registro respondendo o
que já sabe. Numa lista de culto com três "Ó Adorai o Senhor" de hinários
diferentes, o álbum é o que distingue um do outro.
#### A Biblioteca: a barra no TOPO, sem cabeçalho e sem "baixar tudo"

A folha é uma TELA: sem "Baixar toda a biblioteca" (um alvo do tamanho do
cabeçalho para uma ação de dezenas de gigabytes, no topo da tela em que se
procura UM louvor — baixar coleção por coleção continua no card de cada uma), sem
peso total, e **sem cabeçalho**: ele foi encolhendo por partes até virar uma
faixa inteira repetindo o nome do botão que abre a tela. A barra de busca é o
topo da folha, e é isso — não um mecanismo de posicionamento — que a mantém lá.

**A busca fica no TOPO**, e ela já morou na BASE por ALCANCE. O preço da posição
de baixo está no registro: **quatro lotes seguidos consertando o entorno dela** —
a folha que não via o teclado (é dela que veio a descoberta de que
`.popup-backdrop` é `position: fixed` e nunca viu a conta de altura do `<body>`),
o teclado subindo durante o fade, o tom e a sombra que faltavam, o degrau do tema
claro. Quatro lotes em volta de uma posição são a posição dizendo que não se
paga. O preço da de cima está dito: corrigir a busca com o teclado aberto custa a
tela inteira de percurso do polegar.

**O que fica da era da base, porque nunca foi sobre estar embaixo:** o ✕ DEPOIS
do campo (é o fim da linha em toda folha deste app), a LUPA dentro do campo (o
placeholder some no primeiro caractere digitado) e o TOM próprio com a SOMBRA —
esta INVERTIDA, porque ela diz de que lado o conteúdo passa e a lista deixou de
rolar por cima da barra para rolar por baixo dela. Sai a conta do teclado no
`padding-bottom` da barra e volta a área segura no `padding-bottom` da FOLHA:
quem termina a folha é a lista, e sem ela o último item fica sob a barra de
gestos. O ✕ é QUADRADO por um número com nome (`--campo-alt`): dentro de um flex
o `aspect-ratio` não resolve, porque a largura é resolvida ANTES de o `stretch`
dar uma altura definida (a primeira versão colapsou o botão em 20px).

**O TECLADO SOBREPÕE**: `.popup-backdrop` é `inset: 0`, sem `--kb` e sem
`--vv-top`. As duas contas existiram enquanto a barra morava embaixo (para
encostar no teclado em vez de ficar atrás dele) e enquanto a camada precisava
seguir a viewport visual (para a barra do topo não sair pela borda); com a barra
no topo e o cabeçalho fora, quem rola é a LISTA e a folha inteira encolhendo e
subindo era só efeito colateral. **O `.dialog-backdrop` FICA com a conta**, e a
diferença é a razão dela: o `appPrompt` é um cartão CENTRADO com campo de texto,
e ali a metade de baixo é onde o teclado sobe.

**A ROLAGEM PARA DENTRO DA LISTA.** A estrutura sempre esteve certa (rolar
`#hymnResults` 116px não move um pixel da barra); o que se mexe no APARELHO é a
PÁGINA — a rolagem que chega ao fim de um scroller ENCADEIA para trás, e do
Android 12 em diante o excesso é o efeito STRETCH, que estica e desloca a camada
inteira, barra fixa incluída. `overscroll-behavior: contain` no `.popup-list`
corta o encadeamento (os outros três scrollers do app já o tinham), mais
`overscroll-behavior: none` na raiz para um gesto que comece fora de qualquer
lista.

**E a lista abre no topo** (`hymnResultsEl.scrollTop = 0` no `openHymnSearch`): o
nó é o MESMO entre uma abertura e a seguinte, então ele guardava a rolagem da vez
anterior e a Biblioteca reabria no meio de um hinário.

#### O rodízio das coleções, e os Favoritos ocupando o vão

```
 ┌───────────────────────────┐   ┌───────────────────────────┐
 │ ★ Favoritos          ▲    │   │ ★ Favoritos          ▲    │
 │   Louvor de abertura      │   │   Louvor de abertura      │
 │   Vídeo do testemunho     │   │   Vídeo do testemunho     │
 │                           │   │   … (a lista INTEIRA,     │
 │        (o vão)            │   │      passando do vão)     │
 │                           │   │   …                       │
 ├───────────────────────────┤   ├───────────────────────────┤
 │ Arquivos oficiais    ▼    │   │ Arquivos oficiais    ▼    │
 │ Hinários             ▼    │   │ Hinários             ▼    │
 └───────────────────────────┘   └───────────────────────────┘
   a tela como ela ABRE: o vão      passando do piso, a seção CRESCE
   é o PISO da seção, mesmo         e empurra as fechadas para baixo,
   com a lista vazia                com a Biblioteca rolando
```

**São DOIS estados, e não um.** `grupoAberto` é o rodízio das COLEÇÕES (uma
aberta por vez) e `favAberto` é a seção dos Favoritos, que responde só a si
mesma. No mesmo nome, abrir um hinário custava o atalho que o operador tinha
deixado aberto, e reabri-lo custava fechar o hinário: duas decisões diferentes
disputando o mesmo interruptor.

Com um nome só para as coleções, "duas abertas" deixa de ser um estado que alguma
guarda precisa impedir — é uma frase que não dá para escrever. **`''` é
legítimo**: nenhuma coleção aberta é o estado normal de quem está olhando os
favoritos. (Isto REVOGA a v5.237, cujo argumento — "os grupos são curtos, e
comparar dois deles é o que se faz numa tela de índice" — supunha que a tela
cabe.)

**Quem ocupa o vão são os Favoritos, e SÓ eles.** Fazendo a seção ABERTA crescer,
qualquer que fosse, uma coleção curta ficava com meia tela de fundo vazio
embaixo. Uma coleção aberta mede o conteúdo dela e nada mais; o vão é dos
Favoritos, a única seção com razão para tê-lo (uma lista de atalhos vazia ainda é
o lugar em que o próximo entra).

**O VÃO NÃO É REPARTIDO.** Como `flex: 1 1 auto` ele era DIVIDIDO com a coleção
aberta, e os favoritos encolhiam conforme o operador abrisse outra coisa.
`--fav-vao` é uma altura em PIXELS, medida em JS (`medirVaoDosFavoritos`) a
partir das BARRAS das outras seções — o que sobra da tela com todas elas
colapsadas —, então a conta **não depende de qual coleção está aberta**, que é a
propriedade inteira. `flex: 0 0 auto` impede o flex de mexer nela nos dois
sentidos.

**E ELE É UM PISO, NÃO UMA ALTURA** (`min-height`). Como `height` exato ele
RECORTAVA o corpo, e do recorte vinha um botão "Ver todos" que hoje não existe:
não há mais nada escondido, e quem rola é a Biblioteca. Como piso, a seção
reserva o vão com a lista vazia e cresce com o conteúdo. O `flex-shrink: 0` é o
que faz o piso valer: um `min-height` num filho que encolhe é só uma sugestão.
(`medirVaoDosFavoritos` não muda por causa disso — a medida é a mesma pergunta.)

O `requestAnimationFrame` em volta da MEDIDA do vão é obrigatório: quem chama
`acertarVaoDosFavoritos` durante a montagem da lista ainda vai anexar as outras
seções na mesma passada síncrona, e a conta soma a barra de cada uma. Medir na
hora leria uma tela com metade das seções e devolveria um vão grande demais.

**A coleção que abre rola até o topo dela** (`alinharGrupoNoTopo`): uma coleção
aberta no fim da lista cresce para fora da tela, e quem a abriu fica olhando a
barra dela sem ver um item. **O alinhamento espera a animação do acordeão**
(`ACC_MS + 30`, nunca um `requestAnimationFrame`): durante os 220 ms da abertura
o conteúdo ainda não existe e a lista não tem para onde rolar — em rAF ele media
o layout COLAPSADO e rolava 7px de 59 possíveis. Sem conteúdo abaixo que leve a
seção ao topo, a lista rola até o fim, que é o mais perto que existe.

**A seção NÃO tem tom próprio.** Ela não é uma coleção e só ela ocupa o vão — as
duas coisas são verdade e **nenhuma se lê como COR**: o nome no cabeçalho diz a
primeira e o vão reservado diz a segunda. O que a cor acrescentava era um QUARTO
tom numa escada de três. A classe `.coll-group--fav` fica e responde a duas
perguntas: quem ocupa o vão, e quem pinta os FILHOS como itens em vez de álbuns.

**E OS FILHOS DELA NÃO SÃO COMO OS DAS OUTRAS SEÇÕES:** numa coleção são ÁLBUNS,
aqui são ITENS — e sem regra própria a linha de favorito e o card de álbum
pintavam **1,00:1**, a mesma cor literalmente.

```
 seção (--panel)                    seção (--panel)
   └ card do álbum (--panel-2)        ├ placa dos itens (--panel-2)
       └ faixa: RECESSO ─────────┐    │   └ favorito: RECESSO ─────┘
                                 └────┤        a MESMA cor, por construção
                                      └ pasta sincronizada (--panel-2)
                                          IRMÃ da placa: cor de ÁLBUM
```

A receita é a da faixa (`.coll-songs > .hymn-result`): um recesso (`--surface`,
que dentro de uma seção da Biblioteca é o par `sunk`) sobre uma base de nível de
card. **As duas metades são inseparáveis, e a segunda foi imposta pela medição:**
só o recesso, sobre o tom da SEÇÃO, resolve no escuro (1,58:1 contra o card) e
FALHA no claro, onde a seção é BRANCA e o recesso compõe `#dbdbdb`, a 1,02:1 do
card. Com a base de card por baixo a composição é a mesma da faixa:
`rgb(46,54,63)` no escuro, `rgb(182,188,194)` no claro, a 1,29:1 e 1,37:1.

**A PASTA SINCRONIZADA CONTINUA SENDO UM ÁLBUM** — ela guarda muitos arquivos, é
um CONTÊINER. Os dois níveis querem bases DIFERENTES e uma `<ul>` só não oferece
as duas: sobre o tom da seção o ITEM mede 1,03:1 (some), sobre a placa a PASTA
mede 1,00:1. Daí a **placa dos itens** (`.fav-itens`, criada em
`renderFolderList` e só quando há item), que PINTA `var(--camada)` e vira o
contêiner de nível 2 desta seção — o lugar que num hinário é do card de álbum.
Com ela o par volta a ser o MESMO do álbum, em dois elementos: `.hymnal-card`
pinta e `.coll-songs` zera o degrau seguinte. **As pastas não ganharam regra
nenhuma**: são filhas diretas do corpo, que já reserva `--panel-2` para os filhos
dele — a cor de álbum é o PADRÃO ali.

*(Acumular os dois papéis numa peça só obriga o reset de `--camada` a morar na
regra da LINHA, senão ele vence na hora de o corpo resolver o próprio
`background` e o bloco sai transparente — a armadilha de "A CAMADA" com a
assinatura invertida.)*

**O oráculo mede a COR EFETIVA, nunca a declarada.** Os recessos deste app são
overlays com ALFA, e `getComputedStyle` devolve o alfa: uma asserção sobre o valor
declarado compararia `rgba(0,0,0,.24)` com um `#3c4753` opaco, diria que eles
"diferem" sem ter medido cor nenhuma, passaria com o defeito no lugar e
reprovaria a correção. Ele sobe a árvore compondo até o primeiro fundo opaco.

**Trocar o `display` ACORDA o que estava dormindo.** `.coll-group` é
`display: flex; align-items: center; gap: .5rem`, e o `.coll-group--drop` a
neutralizava com `display: block`. Pôr a seção aberta em `display: flex`
ressuscitou as duas: a barra encolhia ao próprio texto e se centrava (medido:
204px numa seção de 408) e as linhas mais largas que o card vazavam pelos DOIS
lados. Daí o `align-items: stretch; gap: 0` na mesma regra. **Remover uma
declaração devolve o valor de quem estava embaixo; trocar o `display` ATIVA o que
já estava escrito e não fazia nada.**

**E o `gap` das seções não é o das linhas** (`#hymnResults { gap: .6rem }` contra
os .35rem do `.popup-list`): uma seção é um bloco que CONTÉM linhas, e a mesma
medida nos dois níveis os faz se ler como uma pilha só. Escopado no id, nunca na
classe — o mesmo `.popup-list` é a fila da playlist e o conteúdo de uma pasta.
#### Os favoritos se atualizam com a Biblioteca ABERTA (v5.258)

Relato: *"se estou na biblioteca e adiciono algo aos favoritos, ele só aparece
na lista após fechar e abrir novamente."*

Os favoritos têm **duas casas** desde a v5.237 — a gaveta e a seção do topo da
Biblioteca —, e o `toggleFav` só redesenhava a lista de baixo. A correção
(`redesenharFavoritosNaBiblioteca`) redesenha **só o corpo daquela seção**,
achado por uma marca no próprio nó (`data-fav-corpo`), apontando o `favHost`
para ele — e **não** `renderSearchResults()`, que remontaria a tela inteira e
jogaria fora a posição de rolagem de quem estava no meio de um hinário para
marcar uma estrela. O oráculo cobra as duas metades: o item aparece **e** a
rolagem sobrevive.

#### O rodapé fixo da caixa da lista (`#listFoot`)

`<main>` é uma coluna de três faixas: cabeçalho, `<ul id="library">` que rola, e
o **rodapé**, que não rola. O rodapé tem dois inquilinos e **nunca os dois ao
mesmo tempo**:

| Inquilino | Quem monta | Quando |
|---|---|---|
| **"Importar arquivos"** (`.import-row`) | `renderListFoot()` | aba Cronograma, fora de pasta, sem seleção |
| **barra de seleção múltipla** (`#selbar`) | `hostSelbar()` | seleção múltipla ligada |

Os dois vestem a MESMA caixa: é uma fatia só, com inquilinos diferentes.

O lugar de cada um foi decidido pelo que ele custa em outro: "Importar arquivos"
como último `<li>` do `<ul>` exigia rolar trinta itens para alcançar a ação mais
frequente da tela; a barra de seleção no lugar da faixa de ABAS mexia no que não
é da seleção e sumia com a navegação justamente quando o operador pode querer
sair da tela.

Três detalhes que o mecanismo exige:

- **Os dois medem `--hit-foot` (44px)**, e é por isso que a medida é token: com
  alturas diferentes a caixa da lista muda de tamanho ao entrar e sair da
  seleção, e a lista dá um pulo debaixo do dedo que estava segurando o item.
- **`renderListFoot()` reconstrói só o que é dela.** Um `innerHTML = ''` tiraria
  a `#selbar` do documento: o nó é UM só, movido entre hosts (o padrão do
  `<input type="file">`), e perdê-lo é perder os listeners.
- **Quem esconde o rodapé vazio é o JS, não um `:empty`.** A `#selbar` mora ali
  mesmo fora da seleção (escondida por `hidden`), então o rodapé nunca fica de
  fato vazio — e um filho de altura zero ainda consome o `gap` do `<main>`, que
  viraria uma faixa de ar acima da caixa de controles em toda aba sem rodapé. E
  a chamada é **antes** do desvio por aba em `renderLibrary()`: Bíblia e
  Ferramentas saem por `return`, e deixada para o fim ela desenhava o "Importar
  arquivos" embaixo da grade de livros da Bíblia.

O `<input type="file" multiple>` é o mesmo elemento de sempre (`#file`, com o
listener já registrado): ele mora solto no `index.html` e é MOVIDO para dentro do
`<label>` a cada render, porque descartar a linha antiga destruiria um input
criado ali.

**Navegação persistente:** trocar de aba não reseta a busca. A posição de scroll
é guardada por aba (`scrollPos`, chave `scrollKey()`) e restaurada **só na
NAVEGAÇÃO**, nunca em todo redesenho — `load()` roda por dezenas de caminhos
(acrescentar um item, favoritar, o progresso de um download), e restaurar em
todos jogava a lista de volta para o topo. `rememberScroll()` é chamado antes de
trocar de aba. (Memória por sessão, em RAM.)

#### Deslizar troca de aba (carrossel)

`setupTabCarousel` escuta o `<main>` e a própria `.tabs` e troca de aba quando o
dedo anda `TAB_SWIPE_MIN` (60px) na horizontal com o eixo X dominando o Y em
1,5×.

- **A ordem é a da FAIXA** (`SWIPE_TABS`), não a do `TAB_ORDER`: este inclui os
  Favoritos, que não têm botão na faixa — deslizar até uma tela que não aparece
  na navegação deixaria o operador sem indicação de onde está.
- **Age no meio do gesto**, não ao soltar: a aba nova entra deslizando enquanto o
  dedo ainda se move, que é o que faz o gesto parecer arrastar a tela.
- **Duas superfícies escutam** (o `<main>` e a `.tabs`, que mora fora dele), com
  o estado do gesto COMPARTILHADO: é UM gesto, não dois.
- **Vale SOBRE A LISTA, inclusive sobre as linhas** — o Cronograma inteiro é
  feito de linhas, e excluí-las mata o gesto na aba em que ele mais é tentado.
- **`touch-action: pan-y` NO SCROLLER, nunca num ancestral.** A regra de
  `touch-action` PARA de subir na árvore no elemento que IMPLEMENTA o gesto, isto
  é, no contêiner que rola: quem precisa da declaração é cada scroller — a
  `.lib-list`, o `.misc-panel` e a `.msg-list` (na Ferramentas a `.lib-list` é
  `overflow: hidden` e quem rola é o painel de dentro) e as `.bible-half`. Sem
  ela o navegador considera o gesto dele (`manipulation`, herdado do `*`) e o
  engole com um `pointercancel` ao primeiro movimento, muito antes dos 60px. E a
  MESMA regra, lida do outro lado, é o que preserva o `pan-x` do histórico do
  sorteio (`.draw-hist`): um `pan-y` acima dele não o alcança — verificado com
  toque real, o histórico rola de lado (`scrollLeft` 0 → 142) e a aba não muda.
  Esta lição custou três versões e voltou pelo menos três vezes.
- **O gesto de TOQUE tem ciclo próprio, independente dos `pointer*`.** O
  navegador CANCELA o fluxo de ponteiro (`pointercancel`) assim que decide que o
  gesto é dele, e basta um scroller no caminho: armando pelo `pointerdown`, um
  cancelamento matava o gesto antes de ele nascer. `touchstart` arma, `touchmove`
  decide o eixo / reivindica / troca a aba, `touchend`/`touchcancel` encerram. Os
  `pointer*` ficaram só para o MOUSE (filtrados por `pointerType`).
- **Dois limiares, duas decisões:** o EIXO aos 12px (`TAB_CLAIM_MIN`, antes de o
  navegador tomar a decisão dele) e a TROCA aos 60px (`TAB_SWIPE_MIN`, que é
  intenção). Reivindicado, o gesto continua nosso até o dedo levantar — soltar o
  controle no meio deixaria a página rolar de lado no fim do movimento. O
  `touchmove` é **não passivo**, que é o que faz o navegador esperar a decisão do
  handler; um movimento vertical nunca é tocado.
- **A GUARDA PERGUNTA AO DOM, nunca a uma lista de classes.** Quatro consertos
  deste carrossel erraram mantendo à mão a lista do que o eixo horizontal não
  pode atravessar — a última chegou a proibir `.bible-half`, que declara
  `touch-action: pan-y` e LIBERA o gesto, e a mais larga barrava toda sub-tela
  (reconhecida pelo voltar visível), matando o carrossel justamente na navegação
  interna, onde o operador mais desliza. A pergunta certa é MEDIDA: existe, entre
  o alvo e a superfície que escuta, alguém que de fato ROLE na horizontal? Um
  trilho de pílulas cheio responde sim; o mesmo trilho com três pílulas responde
  não. Campos de texto ficam fora por outro motivo (ali o eixo é do cursor), e
  são nomeáveis por serem conceito do HTML, não classe deste app. O modo de
  seleção múltipla continua fora.
- **O `click` do fim do gesto é engolido** por um listener de CAPTURA no
  `<main>`, senão deslizar sobre a grade de livros trocava de aba **e** abria um
  livro, e na ponta do carrossel um deslize sobre "+ Nova mensagem" abria o
  diálogo. A trava é uma **flag desarmada no `pointerdown` seguinte**, nunca um
  listener com prazo: o prazo de 350 ms mede o tempo errado — numa página em
  segundo plano o resto do gesto leva mais que isso e a trava expirava
  justamente antes de o clique chegar.
#### A troca de aba é um DESLIZE INTEIRO (v5.59)

As duas telas se movem juntas, larguras inteiras, como um carrossel de verdade:
a que sai vai para `-100%`, a que entra vem de `+100%`, e em nenhum instante
elas se sobrepõem — são vizinhas, coladas, empurrando-se. Até a v5.58 só o
conteúdo NOVO se mexia (entrava de 44px com um fade, e o antigo simplesmente
sumia): isso é um sinal de direção, não um deslize, e o gesto que o dispara —
arrastar a lista para o lado — promete exatamente que a tela vai sair do lugar.

O truque para ter as DUAS telas ao mesmo tempo com uma lista só no DOM é o
**fantasma** (`makeTabGhost`): os nós antigos são MOVIDOS para um `<ul>`
absoluto posicionado exatamente sobre a área da lista, e a `#library` de
verdade fica livre para receber o conteúdo novo.

- **Mover, não CLONAR.** Um clone reinicia o download de cada miniatura por um
  `blob:` que o render seguinte revoga — as fotos sumiriam no meio do deslize.
  Movidos, os mesmos elementos seguem pintados.
- **O fantasma é feito ANTES do `load()`**, e é ele que o operador continua
  vendo enquanto a lista nova é montada (leituras de IndexedDB — poucos ms, mas
  não zero). Por isso `switchTab` virou `async` e o deslize dispara no
  `finally`: um `load()` que falhe não pode deixar o fantasma congelado sobre a
  lista para sempre.
- **O `<input type="file">` fica para trás de propósito.** Desde a v5.107 ele
  mora no RODAPÉ (`#listFoot`), que fica fora do `<ul>` e portanto fora do
  fantasma — mas a guarda continua: se um dia algo voltar a pendurá-lo dentro
  da lista, ele iria junto, sairia do documento quando o fantasma fosse
  descartado, e o `change` que importa arquivos deixaria de acontecer sem erro
  nenhum no console.
- **Um deslize novo mata o anterior** (`tabGhost`): dois toques rápidos
  deixariam dois retângulos empilhados sobre a lista.
- **`main` é `position: relative` + `overflow: hidden`**: é ele que ancora e
  RECORTA o fantasma — as duas telas atravessam a largura inteira e não podem
  aparecer fora da área da lista.
- **A regra do fantasma precisa das DUAS classes** (`.lib-list.lib-ghost`). Ele
  também é uma `.lib-list`, e aquela regra — que vem DEPOIS na folha — declara
  `position: relative`. Com uma classe só o empate de especificidade era
  decidido pela ordem: o `relative` vencia, o fantasma continuava no fluxo,
  virava um segundo item flex do `main` e DIVIDIA a altura com a lista de
  verdade. O sintoma era a aba de destino aparecer espremida durante o deslize
  e se corrigir sozinha ao fim dele (medido: 478px em repouso, 233px no meio da
  animação, 478px de novo depois que o fantasma sai).
- **Fechar a gaveta de Favoritos passa `semAnim`**: ali o movimento que o
  operador vê é a gaveta subindo, e um carrossel por baixo dela contaria outra
  história.

A **direção** vem da ordem das abas (`TAB_ORDER =
['imports','folders','bible','mic']` — inclui os Favoritos, que são um
`activeTab` sem botão na faixa): ir para uma aba à **direita** faz a nova entrar
pela direita, à esquerda o contrário. A duração e a curva são as MESMAS do
vazado que desliza na faixa (`TAB_MOVE_MS`/`TAB_MOVE_EASE` × `--tab-move`): os
dois são efeitos de UM gesto, e tempos diferentes os separariam em dois eventos.
Respeita `prefers-reduced-motion` — ali não há fantasma nem deslize, a lista
simplesmente troca.

**`load()` tem guarda de sequência** (`loadSeqCtl`, como o `loadSeq` do
stage): é async e disparada fire-and-forget por dezenas de handlers, então
duas chamadas concorrentes poderiam terminar fora de ordem e a mais antiga
sobrescreveria o estado/render da mais nova. `load()` lê tudo do IDB em locais
(as contagens das pastas em `Promise.all`, não mais um `await` sequencial por
pasta a cada micro-mudança) e só aplica ao estado do módulo + renderiza se
`myseq === loadSeqCtl` — senão descarta.

Miniaturas (160×160 px, JPEG 72%) geradas via Canvas no momento da importação.
Vídeos têm thumbnail extraído de um frame perto do início — `min(0,5 s,
duração/3)`, ou seja, 0,5 s para qualquer vídeo acima de ~1,5 s (evita seek
longo/lento; timeout de 3,5 s).
Itens sem blob local exibem badge `URL` ou `YT`.

### Gestos nos itens da biblioteca

| Gesto | Ação |
|---|---|
| Toque simples | **Substitui a playlist por este item** e o exibe no Display |
| `⋮` → ↑ / ↓ | Reordena o item na lista, uma casa por toque (v5.285). **Nos Favoritos o `⋮` saiu na v5.287**: o par mora na faixa de ações da gaveta, que abre no corpo da linha |

**O QUE FECHA A FAIXA, E O QUE NÃO FECHA.** Escolhida a opção, a caixa fecha —
ela cobre o nome, e um menu aberto por cima do item depois de já ter feito o que
se pediu é o defeito que ele existe para corrigir. **São duas exceções**, e as
duas pela mesma régua — *a ação que não TERMINA a conversa com aquele item*:

- o **par ↑↓**, porque reordenar é uma decisão que se REPETE (mover três casas
  são três toques) e fechar no primeiro obrigaria a reabrir a cada casa;
- a **estrela** (v5.289, pedido do operador: *"favoritar um item faz a gaveta de
  opções fechar, mantenha ela aberta"*), porque ela é um ALTERNADOR: o desfecho
  dela é o próprio botão mudando de desenho, ali, sob o dedo.

A estrela fechava por **dois caminhos independentes**, e consertar um só deixaria
o defeito de pé: o ouvinte de captura da caixa, e o `renderLibrary` que
`toggleFav` agenda depois do pulso — este reconstrói a linha inteira. Daí
`manterAcoesAbertas()`, que reusa o `reabrirAcoesEm` do par ↑↓ e a CHAVE que
`montarAcoesDaLinha` carimba no `li` (`data-acoes-chave`). Sem a chave não
haveria como reencontrar a linha: o mesmo item vive em duas listas ao mesmo
tempo.
| `⋮` → 🗑 | **Excluir da lista.** É o PRIMEIRO botão da faixa desde a v5.289 — o mais longe do `⋮`, que fica colado na ponta direita e é o alvo tocado repetidamente (abre e fecha): errá-lo por alguns pixels caía no destrutivo. Do outro lado o vizinho é o VAZIO da caixa, que também fecha, mas é uma área larga em que ninguém mira a borda |
| `⋮` → ✏️ | **Renomear** o item, um toque (v5.288). Ele existia só para UM item de cada vez e atrás de quatro gestos (toque longo → seleção → botão do rodapé → diálogo). **Não entra na pasta do aparelho**, com a mesma guarda do excluir: ali o nome vem do arquivo, e um nome só no registro seria desfeito na varredura seguinte. O lápis é SVG inline — `edit` não está no subset da fonte, e codepoint ausente desenha um retângulo vazio |
| Pressionar e segurar | Entra no modo de seleção múltipla |

**O ARRASTAR SAIU NA v5.285**, das três listas de uma vez (Cronograma,
Favoritos e a fila da playlist), a pedido do operador. Com ele saíram
`attachHandle`, a medição única do `pointerdown`, a linha-guia absoluta e o
`data-fixa` das pastas. O argumento: um arrasto é um gesto CONTÍNUO com captura
de ponteiro, disputando o eixo vertical com a lista que rola por baixo. O preço
está dito — mover dez posições passou de um gesto a dez toques —, e
`reabrirAcoesEm` (a chave `lista:id`, nunca o id nu, porque o mesmo item vive em
duas listas) devolve a gaveta ao item que se moveu, com o botão sob o mesmo
dedo.

**O deslize lateral da linha saiu na v5.50.** Ele adicionava o item à playlist
(`dx <= -SWIPE`), e a única pista de que existia era um ícone a 22% de opacidade
atrás da linha (`.swipe-bg`/`.swipe-hint`, removidos junto). Um atalho que quase
ninguém descobre não justifica reservar para si o eixo horizontal da maior parte
da tela — que é o que impedia o **carrossel de abas** de funcionar sobre a
lista. A playlist continua a um toque, pelo `+` de cada resultado do acervo e
pelo popup da playlist.

Com ele saiu também o `setPointerCapture` da linha: o `pointermove` agora só
CANCELA o gesto do item quando o dedo anda mais de 10px em qualquer direção —
sem tocar no evento, que segue subindo para o carrossel e para a rolagem, que
são de quem o dedo está falando naquele momento.

**O arrasto mede a lista UMA vez** (`measureDrag`, no `pointerdown`; um listener
de `scroll` remede se a lista rolar, e `endDrag` limpa tudo no fim). Antes, cada
`pointermove` — 60 a 120 por segundo — fazia um `querySelectorAll` da lista
inteira e um `getBoundingClientRect` por item, logo depois de escrever
`li.style.transform`: um **reflow síncrono por evento**, com o arrasto
engasgando num Cronograma grande. As posições não mudam durante o arrasto (o
item se move por `transform`, que não altera o layout), então medir uma vez
basta. `showDropLine` e `dropIndex` leem o mesmo cache — a linha-guia e o
destino real nunca discordam.

**Modo de seleção múltipla:** barra substitui as abas, com contagem e botões de
**acrescentar à playlist**, favoritar, adicionar a uma pasta, renomear (1 item)
e excluir.

> **A barra não tem preenchimento** (v5.105). Ela era um bloco em
> `--accent-soft` com contorno SÓLIDO em `--accent` — a mancha âmbar mais forte
> da tela, num app cuja regra é "âmbar é navegação e marca". E, preenchida e
> contornada, ela tinha exatamente a silhueta de um ITEM SELECIONADO da lista
> logo acima (`.lib-item.selected` também é borda accent + fundo), então lia-se
> como mais uma linha marcada em vez de como a barra de ações delas. Hoje é o
> fundo que já está atrás com os botões `--surface-2` flutuando. O sinal de
> "outro modo" fica no CONTADOR em accent: uma cor de texto, não uma placa.
>
> **No rodapé ela veste a moldura TRACEJADA do "Importar arquivos"** (v5.108) —
> mesma linha pontilhada em `--accent`, mesmo raio, mesma caixa. As duas são a
> mesma fatia do rodapé com inquilinos diferentes, e o contorno é o que diz
> isso. Não recria o problema acima: o que fazia a barra parecer um item
> selecionado era o CONJUNTO "preenchimento âmbar + contorno sólido"; uma linha
> pontilhada sobre o fundo do corpo não se parece com item nenhum da lista — é
> a convenção que o app já usa para "espaço a preencher". Na gaveta dos
> Favoritos ela segue sem moldura: ali a folha já é a moldura.
>
> **E ela saiu da caixa de controles** (v5.107): mora no rodapé fixo da lista
> (`#listFoot`), na fatia do "Importar arquivos" — as abas não somem mais para
> abrir espaço a ela. Ali ocupa `--hit-foot` (44px), a mesma altura do botão que
> substitui; os `.sel-btn` continuam em `--hit` (34px), e é a folga de 5px de
> cada lado que os faz parecer flutuando dentro da moldura em vez de
> preenchê-la. Ver "O rodapé fixo da caixa da lista".
>
> O primeiro é da v5.50 e é onde foi parar a função do deslize à
esquerda: para itens da biblioteca, o toque simples SUBSTITUI a fila, então sem
ele montar uma sequência dependeria de um gesto que a tela não anunciava. No
botão, a mesma ação ficou visível e passou a valer para vários itens de uma vez
(`addSelectedToPlaylist`). Os itens selecionados são
indicados **só pelo realce** (`.lib-item.selected` — borda `--accent` + fundo
`--panel-2`), sem
ícone de check; a miniatura fica sempre encostada à esquerda (não há coluna
reservada). Excluir dentro de pasta virtual só remove da pasta; nas demais abas
usa `listRemove` (com gc).

### Favoritos: uma lista só (marcados + pastas do aparelho)

É o caminho curto para o que o operador usa toda semana, e desde a v5.237 são a
**primeira SEÇÃO da Biblioteca** — a gaveta de tela cheia (`#favPopup`) que os
hospedava saiu por inteiro na v5.294, e com ela a BUSCA dentro de uma pasta
(sem substituto: a barra da Biblioteca varre `allCollections()`, que não alcança
o catálogo de pastas) e a SELEÇÃO MÚLTIPLA lá dentro, que era onde morava o
excluir de ARQUIVO FÍSICO por item. Esta última é menos perda do que parece: um
arquivo apagado de uma pasta sincronizada volta na varredura seguinte, e quem
apaga de verdade é o "Excluir pasta e arquivos sincronizados" da própria linha.

**Não existem pastas VIRTUAIS.** O que havia (`folders`/`folder_<id>`, o seletor
`#folderPopup`, o `#selFolder` da seleção múltipla, `renderVirtualFolders`,
`addToFolder`) saiu, e o conteúdo delas não se perdeu:
`migrarPastasParaFavoritos` sobe cada item para `favs` e **só então** derruba o
atalho. A ordem das duas metades é a garantia inteira — `folderDrop` apaga a
mídia que ficou sem detentor, e depois do `listAdd` ela tem um; invertida, um
item cujo único dono era um atalho sumiria do app **e do disco**, calado.

**A organização não é hierarquia, é ORDEM:** a lista é a `favs` (ordem de
chegada até alguém mexer nela), com o mesmo par ↑↓ do Cronograma. **As pastas
sincronizadas ficam no TOPO** — a lista de favoritos cresce por baixo delas, e no
fim cada favorito novo as empurraria para longe.

**O TOQUE NA LINHA NÃO PROJETA: ele abre a gaveta da Biblioteca.** O `⋮` e a
faixa `.row-acoes` existem para caber numa linha que responde ao toque com OUTRA
coisa (no Cronograma, projetar): sem lugar embaixo, a gaveta só tinha para onde
ir por CIMA do título. Com o corpo da linha livre ela desce para onde desce em
toda a Biblioteca, e a sobreposição deixa de existir por construção.

Esta lista mora DENTRO da Biblioteca, e é isso que decide o lado da regra: a
Biblioteca é a tela em que se PREPARA (o toque abre opções) e o Cronograma é a
lista com que se OPERA (o toque projeta). O `⋮` continua inteiro lá e na fila da
playlist.

`renderItemMenu` é a MESMA maquinaria de destinos (`songMenuItem` com `destino`,
`destExecutor`, `destRemontar`, `destConfirmRow`) apontada para a `<ul>` do corpo
da linha. O que ela não tem: **seletor de variante** (o registro já existe) e
**"Favoritar"** (o item É um favorito).

**A ESTRELA NÃO ENTRA NA FAIXA DE AÇÕES; fica a LIXEIRA.** Nesta lista as duas
terminam num `listRemove('favs', id)`, e: (1) aqui a estrela é alternador de UMA
direção — todo item já é favorito, ela nasce acesa, e o único toque possível é o
que apaga; (2) a lixeira PERGUNTA, e a linha some de uma lista curada à mão;
(3) ela solta a prateleira invisível (`soltarAvulso`), que é a diferença entre "a
linha sumiu" e "os bytes saíram". Nas outras listas a estrela fica, e ali ela
alterna de verdade.

**O Parar na capa continua sendo um toque direto**: tirar do ar é a decisão que
não pode custar uma gaveta. E o preço está dito: projetar um favorito passou de
um toque a três — em troca, as três listas ficam a um toque do mesmo lugar
(mandar um favorito à playlist não tinha caminho nenhum nesta tela).

As regras da gaveta são keyadas em `.lib-item`, não em `.hymn-result`: o mesmo
envelope serve as duas listas, e uma segunda anatomia divergiria no próximo
ajuste.

**A listagem é densa** (`#favList`): ela NÃO herda a métrica do Cronograma, e as
duas não fazem a mesma coisa — lá cada linha é ALVO de toque no meio de um culto
e o espaço em volta evita o toque errado; aqui o operador vem PROCURAR. Encolheu
a MOLDURA (miniatura 40→32px, respiro, espaço entre linhas), nunca o TEXTO nem os
ALVOS (os botões seguem em `--hit`, 34px, e é esse piso que limita o resto).
Medido: o passo de uma linha cai de ~57px para ~48px.

#### A pasta abre INLINE, como um álbum

O corpo é montado **uma vez, e só quando a pasta abre**: uma pasta sincronizada
tem centenas de arquivos, e montá-los para todas elas a cada redesenho da seção
seria o trabalho de DOM da tela inteira por algo que ninguém está vendo — a mesma
decisão do corpo de um grupo da Biblioteca.

**Uma anatomia só para as duas listas.** `favItemRow` virou `linhaDeItem`, e o
que muda entre um favorito e um arquivo de pasta viaja em `opts`:

| | favorito | arquivo da pasta |
|---|---|---|
| `lista` | `'favs'` — a faixa de ações tem ↑↓ e excluir | **nenhuma** — a ordem vem do disco, e apagar aqui seria apagar o ARQUIVO |
| `destinos` | playlist · Cronograma | playlist · Cronograma · **Favoritar** |

A segunda linha é a régua de sempre: numa lista de favoritos "Favoritar" não muda
nada, e numa pasta ela é o caminho de promover o arquivo. Uma escolha que não faz
nada é pior que escolha nenhuma — daí ser parâmetro, e não um `if` dentro do
menu.

**`pastaAberta` é um NOME e não um conjunto**, pela razão do `grupoAberto`: "duas
pastas abertas" deixa de ser uma regra que alguém precisa lembrar e passa a ser
uma frase que não dá para escrever. Ele nasce no topo do arquivo, porque é lido
por um caminho de render — a zona morta temporal que já derrubou o app quatro
vezes — e existe porque favoritar um arquivo de dentro da pasta redesenha a
seção: sem essa memória, cada ação fecharia a pasta.

Os arquivos saem ordenados por **nome**: a ordem do disco é a de gravação, e não
diz nada a quem está montando um culto.

##### A seção não pode ficar para trás do banco

`deleteOpfsFolder`, `syncDeviceFolder` e a limpeza de catálogo terminam em
`load()`, que é o funil onde `favItems`, `favSet` e `opfsFolders` são reaplicados
ao estado do módulo — mas `load()` redesenhava o Cronograma (`renderLibrary`) e
mais nada, e a seção de Favoritos é desenhada por `renderFolderList` com
`favHost`. Excluir uma pasta a tirava do banco e a deixava na tela.

`sincronizarFavoritosNaBiblioteca()` entra no fim do `load()`, e a guarda é uma
**assinatura**, nunca um redesenho incondicional: `load()` roda por dezenas de
caminhos com a Biblioteca aberta, e refazer a seção em todos eles fecharia a
gaveta de opções que o operador acabou de abrir. Ela é reconstruída só quando o
que ela DESENHA mudou (os ids dos favoritos e os `id:contagem` das pastas).

Com isso o redesenho explícito do `moverNaLista` **saiu**: ele virou o SEGUNDO, e
`reabrirAcoesEm` é consumido pelo primeiro — o segundo reconstruía a linha sem a
gaveta aberta, tirando o botão de baixo do dedo.

##### O aninhamento cobra o preço: `>` e nunca descendente

`.folder-opfs` é o primeiro `.lib-item` deste app que **contém outros
`.lib-item`**, e todo seletor DESCENDENTE keyado em `.lib-item` vaza para dentro:

| selector | o que ele passou a alcançar |
|---|---|
| `.lib-item.expanded .hymn-gaveta` | a pasta ABERTA satisfaz o `.expanded`, então a gaveta de TODO arquivo lá dentro virava `display: block` |
| `.lib-item:not(.vendo-letra) :is(.hymn-lyrics, .item-detalhe)` | a pasta nunca tem `.vendo-letra`, então ela escondia o detalhe de um arquivo que TEM |
| `.lib-item:has(.hymn-gaveta :active)` | não alcançava `.folder-itens`, e o `--press` da pasta encolhia com o toque num arquivo |

A primeira linha explica dois sintomas de uma vez: a faixa preta embaixo de cada
arquivo era a gaveta vazia dele, e o segundo toque tirava a classe do item **sem
esconder nada**, porque quem as mantinha visíveis era a pasta.

**A regra: a gaveta é do item que a POSSUI, então toda regra dela é `>`.** Um
seletor descendente responde *"existe algum ancestral assim?"*, e a resposta
muda no dia em que alguém aninha o componente — sem erro em lugar nenhum, e num
lugar que não é o da causa. O feedback de toque virou uma linha só para os três
blocos que uma linha apenas HOSPEDA (`.row-acoes`, `.hymn-gaveta`,
`.folder-itens`): quem encolhe é a peça tocada.

E o quarto item era de geometria: o arquivo começava colado na borda do cartão
da pasta (x=18), com a miniatura na mesma coluna da miniatura DA PASTA — lendo-se
como irmão dela em vez de conteúdo. Com o recuo de `.4rem` no corpo ele passa a
ocupar a coluna do favorito logo abaixo (24 e 24; miniaturas em 32 e 32), que é o
que o álbum já fazia pelo padding do `.coll-open`.

#### A ESTRELA É UM BIT, NÃO UM GRUPO

"Favoritos" já foi um recurso de **pastas virtuais** renomeado — o estado prova
(as chaves eram `folders`/`folder_<id>`). Trocou-se o rótulo e o ícone; o modelo
continuou sendo pasta, e daí saíam os três incômodos que o operador relatava:

- **"sempre precisa de uma pasta"** — não existia o ato de *favoritar*. Com zero
  pastas criadas, marcar o primeiro favorito custava seleção → estrela →
  "Nenhuma pasta ainda" → criar → nomear → confirmar. Seis passos para um toque.
- **"não é um acesso rápido"** — a porta era o botão no FIM da lista do
  Cronograma, e só ele.
- **"não abrange tudo"** — `folder_<id>` é um array de ids de MÍDIA, então
  versículo, mensagem, cronômetro e sorteio não podiam ser favoritados.

As três respostas: a lista plana **`favs`** (uma das `LISTS`, portanto detentora
de referência de verdade), a **estrela em toda linha** e as **cenas de roteiro**
(`kind: 'cue'`), que deram identidade de item ao que antes era só uma tela.

- **A estrela é PREENCHIDA quando marcada e contornada quando não**, a convenção
  universal de favorito. Por isso ela é **SVG e não glifo**: a fonte é um subset
  ESTÁTICO da família *Outlined* (sem o eixo `FILL` da variável), e o glifo
  `star` desenha sempre a mesma estrela vazada — cor sozinha deixa a dúvida entre
  "marcado" e "dá para marcar". A desmarcada é `--line`, não `--muted`: discreta
  o bastante para o olho passar batido pela lista, forte o bastante para ser
  achada quando se procura por ela.
- **Estrela = favorito, sempre.** Enquanto as pastas virtuais existiam elas
  também usavam estrela, e o mesmo símbolo dizia duas coisas na mesma tela.
- **Favoritar uma música do acervo continua BAIXANDO o arquivo**, e é
  deliberado: o que se espera de um favorito num domingo de manhã é que ele
  TOQUE, inclusive com a rede da igreja fora do ar. O que mudou é o destino (a
  lista `favs`, direto), não o custo.
  direto), não o custo.
- **Fechar a gaveta devolve à aba de onde ela foi aberta** (`favVoltarPara`).
  Com a porta no cabeçalho fixo, ela é aberta de qualquer lugar — quem a abriu
  no meio de uma leitura bíblica não espera cair no Cronograma ao fechá-la.
- **Excluir na RAIZ da gaveta é desmarcar**, e isso precisa de um ramo próprio
  em `deleteSelected`: sem ele o `else` genérico caía em
  `listRemove('folders', id)` — a chave do ÍNDICE de pastas, que guarda objetos
  e não ids. Um no-op silencioso, com o operador vendo o item continuar na lista
  depois de mandar excluí-lo.

**Por que saiu da lista.** Era uma tela do `#library` como as outras, e por isso
disputava o cabeçalho com o resto do app: ela é a única que precisa de
**voltar + título + busca + sincronizar** ao mesmo tempo, numa faixa que também
carrega a troca de modo. Numa tela de 360px isso não cabia — o título saía com
reticências. Como gaveta ela traz o **próprio cabeçalho** (`renderFavHeader`) e
devolve o de baixo ao que ele é: um rótulo de aba com três elementos.

**O `activeTab` continua `'folders'` enquanto a gaveta está aberta**, e essa é a
decisão que mantém o custo baixo: abrir/fechar/navegar/selecionar/excluir
seguem sendo o mesmo código de sempre. O que mudou foi **o container em que a
lista é desenhada** — `listHost()` devolve `#favList` quando o `activeTab` é
`'folders'` e `#library` no resto. Uma segunda implementação da lista de
favoritos divergiria da primeira no primeiro ajuste.

Três consequências que só aparecem em uso, e as três estão tratadas:

- **A barra de seleção múltipla é MOVIDA para dentro da folha** (`hostSelbar`):
  ela vive na caixa de controles, atrás da gaveta, e selecionar itens dentro de
  uma pasta deixaria a barra invisível. É o mesmo padrão do
  `<input type="file">`, que já muda de casa a cada render — um nó só, movido,
  em vez de dois que divergem. Em casa o lugar dela é **antes do `.deck`**,
  porque é ali que fica a faixa de abas que ela substitui: daí o `insertBefore`
  e não um `appendChild`, que a jogaria para depois do transporte.
- **O voltar do aparelho tem a hierarquia de DENTRO primeiro** (`__avBack`,
  passo 1.5): seleção múltipla → pasta aberta → gaveta. A seleção vem antes da
  pasta porque ela é do conteúdo DELA: sair da pasta com a seleção de pé
  deixaria itens marcados numa lista que não é mais a deles.
- **Fechar volta para a RAIZ.** Uma gaveta reabre no topo; reaparecer dentro de
  uma pasta que o operador fechou há dois toques seria uma memória que ninguém
  pediu. A posição de ROLAGEM, essa sim, continua guardada por `scrollPos`.

O mecanismo por baixo continua usando as MESMAS chaves de state (renomear a
leitura não pode custar a biblioteca de ninguém) — o que mudou é o
enquadramento: não é "onde os arquivos moram", é "o que eu marquei".
A lista tem **duas** naturezas, sem cabeçalho entre elas — é uma lista só:

1. **As pastas do aparelho**, no TOPO, com o botão de re-sync e o de excluir.
   Sem cabeçalho porque não são uma subdivisão da lista: são outra coisa, e o
   desenho já diz isso (ícone de pasta, contador, sincronizar e excluir na mesma
   linha).
2. **Os itens marcados** (`linhaDeItem`), na ordem da lista `favs`. O toque no
   corpo abre a gaveta de opções; as ações da linha (↑↓, excluir) moram na faixa
   no pé dela.

   (O agrupamento por TIPO que existia aqui — Músicas · Vídeos · YouTube ·
   Imagens · Apresentações · Versículos · Letras · Mensagens · Tempo · Sorteios ·
   Pacotes · Outros — supunha que a primeira coisa que o operador sabe sobre o
   que procura é a CATEGORIA; com o item onde ele mesmo o pôs, a primeira coisa
   que ele sabe é o LUGAR. Doze cabeçalhos ainda custavam altura.)

**Pastas sincronizadas (OPFS)** — o fluxo principal para bibliotecas grandes.
`window.showDirectoryPicker()` pede permissão **uma única vez**, na
sincronização: os arquivos de mídia são **copiados em streaming para o OPFS**
(`folders/<folderId>/<arquivo>`) e catalogados no store `files` (metadados +
thumbnail gerada na hora). Depois disso, abrir o app, listar, buscar e reproduzir
**nunca pede permissão** — o catálogo responde na hora e o stage resolve os bytes
do OPFS sob demanda.

- **Re-sync**: tenta reutilizar o handle salvo em `opfs-folders` (browsers que
  persistem permissão nem mostram prompt) e cai no picker se necessário.
  Arquivos com mesmo nome+tamanho+data são pulados; novos/alterados são
  copiados. **Aditiva** — nada é excluído automaticamente.
- **A pasta é gravada ANTES do primeiro arquivo**, com ponto de controle a cada
  25. Gravando o índice só no fim, uma sincronização interrompida deixava 300
  arquivos escritos e NENHUMA pasta que os apontasse: órfãos, invisíveis na
  tela, ocupando gigabytes — e o coletor de lixo, que existe para recolher
  registro sem dono, os apagava. A retomada (o laço pula o que está em dia por
  tamanho + data) sempre existiu; o que faltava era ela ter o que retomar.
- `navigator.storage.persist()` é solicitado na sincronização, para proteger os
  arquivos contra descarte do browser.
- Itens da pasta têm o `+` que adiciona o **id do catálogo** ao Cronograma
  (zero-cópia — `getMedia` resolve pelo fallback).
- Excluir a pasta (com `appConfirm`, o diálogo do app — não há mais nenhum
  `confirm()` nativo na base) apaga o diretório OPFS inteiro, os registros do
  catálogo e as referências em listas.

**Favoritos (`favs`)** — a lista plana, marcada pela estrela de cada linha ou
pela estrela da seleção múltipla (`#selFav`). É onde as CENAS DE ROTEIRO também
podem morar: um versículo, um preset de cronômetro ou um sorteio guardado é um id
como qualquer outro.
### Coleções de mídia (LouvorJA)

Integração com o catálogo público do app **LouvorJA** (`api.louvorja.com.br`,
mesmo backend usado pelo app `app-ja`), para trazer **todo o acervo** como fonte
de mídia offline, sem copiar nenhum código do app-ja (Vue/Vuex) — só o
**protocolo HTTP** dele é reaproveitado, via um cliente próprio e mínimo:
`controle/louvorja.js` (`window.Louvorja`, JS puro, sem dependências).

> 📄 **Referência completa da fonte de dados:**
> [`docs/FONTE-DE-DADOS-LOUVORJA.md`](docs/FONTE-DE-DADOS-LOUVORJA.md) documenta
> **toda** a estrutura técnica classificatória do banco compartilhado (endpoints,
> token, convenção de nomes dos arquivos `json_db` e o schema de cada tipo —
> `music_{id}`, `album_{id}`, listas de músicas/hinários/coletâneas/bíblia,
> `config`, servidor de arquivos). Consulte-o para pedir **qualquer** arquivo do
> sistema sem precisar abrir o repositório do `app-ja`.


- **`Louvorja.fetchList(file)`** — `GET {url-base}/{file}?{YYYYMMDD}` com
  header `Api-Token`, mesmo formato do `Database.js` do app-ja (URL de
  produção + token embutidos no arquivo — já públicos no bundle do app-ja,
  não é um segredo protegido).
- **`Louvorja.fileUrl(path)`** — resolve um campo de URL do banco (ex:
  `url_music`) para a URL completa de download do arquivo.
- Arquivos consumidos: as **listas** `pt_hymnal`/`pt_hymnal_1996` (hinários) e
  `pt_categories` (catálogo de álbuns → `album_{id}`); o **registro individual**
  `music_{id_music}` (com `url_music`, `url_instrumental_music`, `url_image`,
  letra). Constantes de conveniência: `Louvorja.HYMNAL_2022_FILE`,
  `HYMNAL_1996_FILE`, `CATEGORIES_FILE`.

#### Sistema de coleções (genérico)

O que antes era exclusivo do Hinário 2022 virou um **sistema genérico de
coleções**, todo parametrizado por uma `coll = { id, name, kind, source, iconKey }`
(ver `allCollections()`/`FIXED_COLLECTIONS` em `controle.js`). Cada coleção tem
**uma pasta OPFS própria** (`folders/<coll.id>/`) e um **card** no acervo (o
estado padrão da busca; até a v5.43, a aba Álbuns).
Dois tipos:

- **`hymnal`** (fixas): a `source` é um arquivo de **lista** (`pt_hymnal`,
  `pt_hymnal_1996`) que já é o índice completo de hinos. Sempre visíveis; o
  índice leve é atualizado sozinho (`autoRefreshCollections`).
- **`album`** (dinâmicas): descobertas em `pt_categories`
  (`fetchAlbumCatalog` → `state.albumCatalog`, um card por álbum, agrupados
  por categoria). O índice de
  cada álbum vem de `album_{id}.musics` e é buscado **automaticamente**
  (`autoRefreshCollections`, fase 2 — só metadados, sem áudio), com
  concorrência limitada e um TTL (`ALBUM_INDEX_TTL`, 12 h) pra não refazer N
  requisições a cada retomada; álbuns novos/vazios são sempre buscados. Assim a
  busca do acervo cobre **todas** as músicas de **todos** os álbuns mesmo sem
  nada baixado (tocar num resultado baixa sob demanda — igual ao hinário).
  Álbuns cujo nome parece de hinário são pulados (já têm card dedicado).

O himnário em espanhol e demais idiomas ficam de fora naturalmente — só
consumimos arquivos `pt_*`.

**Estado por coleção**: `state['coll:<id>'] = { indexSyncedAt, songs:[…] }`;
fonte de verdade em memória (`collState`, carregada uma vez no `init` por
`loadCollections()`). **Migração**: o antigo `state.hymnal2022` é copiado para
`coll:hymnal-2022` (mesma pasta OPFS `hymnal-2022` — downloads já feitos
continuam válidos). UI transitória (sync em andamento, status, peso) fica em
`collUI` (não persistida).

**O navegador do acervo** (`renderCollectionsList(alvo, redesenhar, opts)`)
renderiza um card por coleção (`renderCollectionCard`), **agrupados por
categoria** — os dois hinários num grupo fixo no topo, depois cada categoria do
banco. Ele **não tem aba própria**: desde a v5.43 é o estado padrão do popup da
lupa, e desde a v5.44 é o único (ver "O acervo É o estado padrão da busca"). A
função recebe o elemento-alvo e o callback de redesenho justamente por isso —
duas cópias divergiriam no primeiro ajuste de categoria.

O card do Hinário **saiu da tela de pastas** (hoje os **Favoritos**, que voltou
a ser só pastas e pastas do sistema).

> **As pílulas de filtro saíram na v5.70.** Havia uma faixa rolável no topo
> (`.coll-filters`/`.coll-pill`: Todos · Hinários · uma por categoria do banco,
> guardada em `albumFilter`), pensada para cortar caminho até um grupo sem rolar
> a lista. Ela cobrava um recorte antes de mostrar o acervo, e o acervo já vem
> recortado: os cabeçalhos de categoria são o mesmo agrupamento, na mesma ordem
> do banco, e os cards são colapsados — a lista inteira cabe em pouquíssimas
> telas de rolagem. Quem sabe o nome digita, e o campo de busca fica logo acima.
>
> Tirá-las simplificou o render: `albumFilter` era o único motivo de três ramos
> em `renderCollectionsList` (ocultar os hinários, pular categorias, e um
> retorno antecipado que escondia os álbuns órfãos e trocava a mensagem de lista
> vazia), e do parâmetro `showName` do cabeçalho de grupo — que hoje só serve a
> "Todo o acervo", onde o nome já está dentro do botão. A faixa também era uma
> exceção no reconhecedor de deslize do carrossel de abas (um trilho horizontal
> dentro de uma área que troca de aba na horizontal); essa exceção saiu junto.

Os mecanismos abaixo (sincronização/download/letra/Wi-Fi/busca) valem **por
coleção**, exatamente como antes valiam só pro Hinário 2022.

#### Baixar a coleção COMPLETA (`syncGroup`)

O cabeçalho de cada grupo (`.coll-group`) deixou de ser só um rótulo: ele
carrega o **resumo do grupo inteiro** (`baixados/total`, somando todos os
álbuns dali) e o botão que **baixa a coleção completa** — "CDs Oficiais/Ano"
tem uma dúzia de álbuns, e sincronizar um a um pela engrenagem de cada card era
uma dúzia de idas ao popup. Vale para os três tipos de grupo: os hinários, cada
categoria do banco e os álbuns órfãos.

O cabeçalho pode **omitir o nome** e continuar existindo (`showName === false`)
— o que estava lá antes era redundante, o que está lá agora é uma ação. Hoje só
"Todo o acervo" usa isso, porque ali o nome já está dentro do próprio botão;
antes da v5.70 valia também para o grupo que a pílula de filtro selecionada já
nomeava.

- **Um álbum por vez, nunca em paralelo** — e isso não custa velocidade: o
  limite de conexões é por HOST, não por álbum (ver `NET_CONCURRENCY`). Dois
  álbuns com 3 downloads cada dariam exatamente as mesmas 6 conexões que um
  álbum com 6, só que com o progresso fragmentado e mais estado concorrente.
- **A pergunta de rede é feita UMA VEZ para o lote.** Fora do Wi-Fi, um
  diálogo com a contagem de álbuns e a estimativa somada; a resposta é
  repassada a cada `syncCollection` via `opts.allowMobile`, então nenhum deles
  pergunta de novo. Sem isso seriam doze diálogos seguidos, que ninguém lê — e
  a decisão continua sendo do operador, como manda a política de Wi-Fi.
- **O lote inteiro é UMA tarefa de segundo plano** (`withBgWork` em volta do
  laço, não por álbum): senão o `SyncService` seria desligado no fim de cada
  álbum e o processo podia ser congelado justamente entre um e outro — que é o
  cenário normal, já que o operador dispara e sai do app.
- **Cancelável na próxima MÚSICA, não no próximo álbum.** Durante o download o
  botão vira ✕; o toque marca `cancel`, e esse sinal **atravessa o álbum em
  curso** (`opts.cancelled`, lido pelo `worker` de `syncCollection`). Parar só
  entre álbuns era, na prática, não poder parar: há álbuns de centenas de
  faixas, e o operador ficava preso ao lote inteiro depois de mudar de ideia.
  Medido com o código real (600 faixas): o cancelamento custa **6 músicas**, as
  que já estavam no ar.
- Estado transitório em `groupUI`/`gui(key)` (não persistido), com
  `setGroupStatus` espelhando o `setCollStatus` dos cards — logo, o progresso
  também passa pelo re-render coalescido.
- **A notificação do sistema acompanha o LOTE**, não cada álbum: o total é a
  soma das músicas pendentes de todos eles, contada uma vez no começo
  (`bgTaskStart` no `syncGroup`, e `syncCollection` recebe `notifOwned` para
  não abrir uma tarefa própria). Ver "Progresso em segundo plano".
- **Um álbum do LOTE não pode cancelar a si mesmo.** `syncCollection` interpreta
  uma segunda chamada com `syncBusy` ligado como "o operador tocou de novo" e
  **aborta** o download em curso — que é o comportamento certo para o botão, e
  desastroso para o laço: o lote pedia dois downloads e o efeito líquido era
  parar um. `opts.fromGroup` marca a chamada como programática, e aí o lote
  apenas **pula** o álbum que já está baixando por conta própria.
- **Sem rede, o cabeçalho conta as falhas.** `fetchCollectionIndex` lança em
  cada álbum e o laço inteiro termina em segundos sem baixar nada; anunciar
  "Coleção completa" em verde ali mandava o operador embora convencido de que o
  acervo estava no aparelho. O status por álbum existe, mas fica dentro de um
  card colapsado e se autolimpa — o cabeçalho, que é o que ele está olhando,
  agora diz "N álbum(ns) sem rede — tente de novo". Isso só é possível porque
  `syncCollection` passou a **devolver um resultado** (abaixo).

**Baixar TODO o acervo** é o mesmo mecanismo com todas as coleções: um
cabeçalho "Todo o acervo" no topo, visível **só em "Todos"** — com um filtro
ativo "tudo" seria ambíguo (tudo do filtro? tudo mesmo?), e o cabeçalho da
categoria já cobre o primeiro caso. Ele confirma **sempre**, mesmo no Wi-Fi
(`opts.confirmScale`), com a contagem de coleções, de músicas pendentes e o
tamanho estimado: a pergunta de rede é sobre o plano de dados, esta é sobre a
escala, e são perguntas diferentes. Com tudo já baixado ele não abre diálogo
nenhum — só responde "Acervo já completo offline".

#### Concorrência de download (`NET_CONCURRENCY`)

Quantas requisições ficam em voo ao mesmo tempo — usada pelo download de
músicas (`syncCollection`), pela Bíblia e pela atualização de índices.

**6 é o teto de conexões simultâneas por host** do motor do WebView em
HTTP/1.1, medido no Chromium com um servidor de latência (36 arquivos de
400 KB, 250 ms de RTT), mediana de 3 rodadas:

| concorrência | tempo | ganho | pico real de conexões |
|---|---|---|---|
| 3 | 3,24 s | (base) | 3 |
| **6** | **1,77 s** | **+82%** | **6** |
| 8 | 1,71 s | +89% | 6 |
| 12 | 2,05 s | +58% | 6 |
| 24 | 1,77 s | +83% | 6 |

De 3 para 6 o download quase **dobra**; acima de 6 o navegador enfileira e não
há ganho — só mais Blobs em memória ao mesmo tempo. Como cada música é baixada
**sequencialmente** (metadados → capa → Cantado → Playback, com as imagens de
estrofe em série por causa do cache compartilhado `resolveImage`), a
concorrência do laço é exatamente o número de conexões: é este o parâmetro que
importa, e não "quantos álbuns ao mesmo tempo".

Ressalva honesta: se o servidor do LouvorJA falar HTTP/2, o limite de 6 não se
aplica (multiplexação) — mas aí o gargalo passa a ser banda, e mais streams
paralelos também não aumentariam o total. 6 é seguro nos dois cenários. O
protocolo real não pôde ser verificado (a rede de desenvolvimento não alcança
`api.louvorja.com.br`).

#### Progresso em segundo plano (`bgTaskStart`/`bgTaskStep`)

Com o app minimizado — o uso normal durante uma sincronização — a notificação do
`SyncService` é a única janela para o download. Quem sabe o progresso é o lado
web, então é ele que reporta, por
`AVNative.bgProgress({label, done, total, etaMs, items, idleMs, bytes})`.

Instrumentados: `syncCollection` (por música), `syncGroup` (por música, no total
do lote), `ensureBibleVersionDownloaded` (por capítulo) e `syncDeviceFolder` (por
arquivo).

- **A notificação mostra O QUE está baixando.** `bgItemStart`/`bgItemEnd`
  registram os itens em voo por tarefa (`bgItemOnly` para fluxos sequenciais,
  cujos `continue` deixariam nomes presos na lista). "23 de 54" é abstrato;
  "002. Ó Adorai o Senhor" é o que o operador reconhece.
- **A lista é uma FILA (`t.fila`), não um espelho do que está no ar.** A
  concorrência reduz o tempo PROPORCIONAL de cada item: se os 6 juntos levam X,
  cada um custou X/6 — e a exibição segue a mesma conta. É deliberadamente
  ilustrativa; contador, barra e estimativa seguem sendo os números reais.
- **Fila, nunca rodízio entre os itens em voo:** o rodízio repetia nomes e a
  lista não avançava. Medido (18 faixas, 6 em paralelo): 18/18 exibidos, 0
  repetidos, em ordem, fila zerada.
- **O ritmo é MEDIDO** (`bgSpinMs` = `decorrido / concluídos`), não chutado:
  mediana de 500 ms em tela contra 521 ms de custo amortizado real.
- **Sem o buffer a lista engasgava.** Os 6 workers andam em lockstep: os eventos
  chegam em RAJADA (meia dúzia em poucos ms) seguida de segundos de silêncio, e
  sem fila a rajada rendia UMA troca de nome — parado até a rajada seguinte, que
  é a sensação de travado.
- **O compasso PARA quando trava** (`BG_STALL_MS`, 90 s sem evento real): animar
  durante uma queda de rede esconderia justamente o que precisa ser visto. A
  lista congela e o `idleMs` cresce — os dois sinais concordam.
- **`idleMs` separa "travado" de "esta faixa é grande".** Passado o limiar, a
  notificação para de prometer tempo restante (uma ETA sobre um ritmo que já não
  existe é a promessa mais enganosa possível) e passa a "sem resposta há X" — sem
  degraus, porque aqui o número precisa SUBIR a cada atualização.
- **Um freio só (`BG_NOTIF_MIN_MS`, 700 ms), e vale apenas para a ROTINA** (a
  atualização em que só o contador andou). Tudo que precisa chegar na hora passa
  `force`. Quem dá o ritmo do item que entra é o compasso (`bgPacerTick`,
  `BG_TICK_MS` = 250 ms), que envia com `force` sempre que o nome troca — um
  segundo piso curto seria PIOR que o `force`, porque o primeiro nome de uma
  tarefa nasce a poucos ms do envio de abertura e ficaria retido até o batimento
  de 2 s.
- **`bgTasks` é um REGISTRO (Map), não um slot único.** Downloads simultâneos
  existem — é por isso que `bgWorkCount` conta em vez de ser booleano — e com um
  slot só as tarefas se sobrescreviam: o `done` de uma saía com o `total` e o
  relógio da outra. A notificação mostra a **dominante** (maior tempo restante) e
  marca as demais com `(+N)`.
- **A estimativa** sai do ritmo médio desde o **primeiro item concluído**, nunca
  desde o `start` (que incluiria o preparo — índice, varredura — e inflaria a
  primeira leitura). Média, não taxa instantânea: faixas têm tamanhos muito
  diferentes.
- **Suavização assimétrica por constante de tempo** (`ETA_TAU_DOWN` 2,5 s /
  `ETA_TAU_UP` 10 s) e arredondamento em degraus no lado nativo: uma contagem
  regressiva de verdade em vez de um número que sobe e desce. Por TEMPO e não por
  chamada — o compasso de 1 s pede a estimativa muito mais vezes que os eventos
  pediam, e um fator fixo por chamada devolveria o número instável.
- **`bgWorkEnd` é IDEMPOTENTE, e precisa ser.** O `clear()` sozinho deixava o
  compasso ligado para sempre: com o Map já vazio, o `bgTaskEnd` seguinte não
  achava nada, o `delete` devolvia `false`, e nem o `bgPacerSync()` nem o envio
  final rodavam — o `setInterval` de 250 ms vazava pelo resto da sessão, com a
  notificação "Baixando mídias" presa e o próximo `bgTaskStart` reusando um pacer
  órfão. Hoje ele sincroniza o compasso e envia o estado final ele mesmo, e a
  ordem entre ele e o `bgTaskEnd` deixa de importar.
- No navegador, e num shell anterior ao `SHELL_VERSION` 10, é no-op.

**Duas camadas, independentes** (`state['coll:<id>']`):

1. **Índice** (leve, só metadados) — permanece offline assim que sincronizado uma
   vez; é o que alimenta a busca mesmo antes do download pesado terminar.
2. **Download** (pesado) — o áudio Cantado (`url_music`) sempre e o
   Playback/instrumental quando existir, mais a capa e as imagens por estrofe,
   gravados no **mesmo catálogo OPFS das pastas sincronizadas** (`AVDB.fileAdd` +
   `AVDB.opfsWriteFile`, pasta `folders/<coll.id>/`). Então listar, buscar, tocar
   e excluir funcionam **sem nenhum código novo** — é só mais uma pasta OPFS, com
   a fonte sendo uma API remota em vez de `showDirectoryPicker()`.

**UI — o card É o álbum, e tocar nele ABRE o álbum** (`renderCollectionCard()` +
`.hymnal-card`). A barra (`.coll-bar`) é uma **linha só**: símbolo + nome (+
subtítulo da categoria) + **peso** (ou o progresso ao vivo) + **baixar/cancelar**
(`.coll-bar-dl`) + a **seta de acordeão**, que é a `.coll-bar-icon` da THUMB
virada por CSS. Sem índice ainda, o toque leva às opções, que é onde está o
sincronizar que resolve isso.

> **O OUVINTE É DO CARD, E NÃO DA BARRA** — e a razão é um defeito que só aparece
> com o dedo. `.coll-bar` está na lista do `:active`, cujo `--press` é
> `scale(.96)`: numa barra de ~395px isso a encolhe ~8px de cada lado. O
> `pointerdown` acerta a barra e dispara o encolhimento; no `pointerup` ela já
> não está ali, e o navegador entrega o `click` ao ANCESTRAL. Medido: até ~7px da
> borda o toque não abre, de 8px em diante abre — e a margem existe nos quatro
> lados. Subir o ouvinte para o card (que não se mexe) fecha a classe inteira.
>
> A **guarda** é o `.coll-open` (o invólucro de tudo que não é a barra): sem ela,
> com o álbum aberto um toque numa faixa borbulharia até aqui e fecharia o álbum
> debaixo do dedo. Ela pergunta pelo INVÓLUCRO e não por uma lista de filhos,
> para o próximo bloco que nascer lá dentro já nascer protegido.
>
> **E A GUARDA PERGUNTA PELO CAMINHO, NÃO PELA ÁRVORE DE AGORA.** Como
> `e.target.closest('.coll-open')` ela fechava o álbum ao se tocar numa caixa de
> marcação: o botão é apagado pelo próprio handler que roda antes (marcar chama
> `renderSongMenu`, que faz `alvo.innerHTML = ''`), então quando o evento chega
> ao card o `e.target` está **desanexado** e `closest` devolve `null`. **Decidir
> pela POSIÇÃO do alvo na árvore é perguntar "onde este nó está agora", e agora é
> depois de todos os handlers que rodaram antes** — `e.composedPath()` é fixado
> no disparo e sobrevive ao apagamento.
>
> **E o `padding` mora em quem PINTA** (a barra e o corpo aberto), nunca no card:
> a barra do álbum ABERTO já desfazia o padding do card com margens negativas
> para grudar como tampa — isto é, com o álbum aberto aquela faixa funcionava e
> com ele fechado não. O mesmo pixel respondendo ou não conforme o estado.

> **Sem molduras, sem seta própria, sem faixa de cor.** Numa lista de dezenas de
> álbuns, com contorno e faixa colorida o que o olho via primeiro eram as linhas,
> não os nomes. O card é **preenchimento sólido**: dentro da folha (`--panel`)
> ele sobe um degrau para `--panel-2` — um cartão da cor do que está atrás dele
> simplesmente não existe aos olhos. **Aberto se diz no NOME**, em accent: um
> segundo degrau de tom não cabia, porque o cartão já gastou um para existir e as
> faixas ocupam o de baixo. O campo `color` continua no catálogo, de graça, se um
> dia a cor voltar como tinta do quadrado do ícone.

**O botão de baixar SAI da barra quando o álbum já está todo no aparelho** (a
condição é `u.syncBusy || !complete`): ele dizia "Baixar esta coleção" para uma
coleção que não tem mais o que baixar — um alvo do tamanho de `--hit` oferecendo
uma ação sem efeito, em cada linha de uma lista de dezenas de álbuns. O que resta
ali é manutenção, e já mora dentro do card aberto. Enquanto o download ROLA o
botão continua, porque ali ele é o cancelar. O botão de GRUPO
(`.coll-group-btn`) **não** segue a regra — ali não existe engrenagem, e sumir
com ele tiraria a única rota de re-sincronizar o grupo.

**O contador da barra é o PESO** (`fracaoPeso`), não a contagem de faixas: ele
responde a pergunta que se faz com o dedo sobre o botão de baixar — *quanto isto
vai me custar*. Quatro faixas podem ser 8 MB ou 80 MB, e é essa diferença que
decide esperar o Wi-Fi ou apagar um álbum para caber outro.

| Estado | Barra |
|---|---|
| sem índice | `não sincron.` |
| nada baixado | `230 MB` — só o que vai custar |
| parcial | `19/249 MB` |
| completo | `2,3 GB`, exato (soma do catálogo) |

O total continua sendo uma ESTIMATIVA (duração × a taxa medida no aparelho); o
que não existe é o `~` que a anunciava — `fmtBytes` já arredonda para uma casa,
então "18 MB" nunca prometeu 18.874.368 bytes, e o til pagava um caractere em
cada contagem da tela mais densa do app.

A contagem de faixas não se perde: ela continua no estado do botão de verificar,
dentro das opções do álbum. E os três contadores da tela — card, cabeçalho de
categoria e "Todo o acervo" — usam a MESMA função: um em faixas e outro em MB
seria a pior das versões. Os de GRUPO ficam mesmo completos: eles somam várias
coleções, e ali o número ainda responde alguma coisa.

**Uma coleção aberta por vez** (abrir uma fecha as demais): duas listas de
centenas de faixas empurrariam o acervo para fora da tela e tirariam do lugar
exatamente o card que o operador estava mirando. Dentro do aberto vem a lista
**inteira** de músicas — sem teto, porque ali se folheia um álbum, e cortar em 60
esconderia o fim de qualquer hinário. As linhas são as mesmas `hymnResultRow` da
busca, com `semColecao` ligado.
#### …mas ela CHEGA em páginas de 100 (v5.74)

"Inteira" é sobre o que está disponível, não sobre o que é montado no toque.
Um hinário tem **613 hinos**, e cada linha é um `<li>` com miniatura, dois
botões e SVG inline dentro deles: montar as 613 de uma vez é um bloco de
JavaScript **síncrono** no meio do toque que abre o card — a animação de
abertura nasce engasgada e o toque parece não ter funcionado. E não é uma vez
só: o card é remontado a cada redesenho do acervo, que o progresso de um
download dispara a cada `COLL_REFRESH_MS`.

`fillSongList(lista, coll, u)` monta `COLL_PAGE` (100) linhas e pendura uma
**sentinela** (`.coll-more`) no fim. Quando ela entra na tela, a página seguinte
é anexada e a sentinela se remuda para o novo fim, até acabarem as faixas.

- **O gatilho é o SCROLL, não um botão.** Quem folheia um hinário está
  procurando um hino, não administrando uma lista: parar para pedir mais é
  atrito num gesto que já é contínuo. A sentinela **também** é um botão, para o
  caso de ela aparecer sem que a rolagem a tenha alcançado (uma lista curta
  demais para rolar dentro do popup) — mas o caminho normal não passa por ele.
- **`IntersectionObserver` com `root: null`.** A viewport resolve sozinha o
  problema de descobrir QUAL elemento rola (hoje `#hymnResults`, amanhã outro):
  a interseção com a viewport já vem recortada pelos `overflow` dos ancestrais,
  então a sentinela só "aparece" quando de fato aparece na tela. O
  `rootMargin: '300px'` adianta a página — o objetivo é que o operador **nunca
  chegue a ver** essa linha.
- **É INCREMENTAL.** A página nova é anexada às linhas que já estão no DOM, sem
  reconstruir as anteriores: reconstruir mexeria no scroll debaixo do dedo que
  acabou de pedir a página.
- **`u.shown` mora no estado de UI do card** (ao lado de `u.expanded`), então um
  redesenho por progresso de download reencontra o mesmo ponto — quem já rolou
  até o hino 400 continua vendo 400.
- **Fechar zera.** Reabrir um hinário que ficou rolado até o fim traria os 613
  de volta de uma vez, que é exatamente o custo que a paginação existe para
  evitar.

#### O canto da barra: a seta que FECHA o álbum

Aberto o card, aquele canto **toma a caixa do botão de baixar** na barra
(`.coll-bar-cfg`, herdando `.coll-bar-dl`): mesma coluna, mesmo alvo, e os dois
nunca fazem falta ao mesmo tempo — fechado, o que se decide é "baixo isto?";
aberto, já se está olhando o conteúdo. Ele já foi uma barra larga rotulada dentro
do card ("Sincronizar e opções": uma linha inteira gasta com o que cabe num canto
que já existia) e uma engrenagem que revelava as opções; com as opções cabendo
SEMPRE que o card está aberto, um botão para revelá-las era cerimônia.

O toque na barra continua alternando: são dois gatilhos para o mesmo
`alternarAcordeao`.

**A exceção é o download EM CURSO.** Ali o botão da barra é o CANCELAR e
continua lá mesmo com o card aberto — um álbum de centenas de faixas, uma vez
começado, precisa poder parar num toque. Nesse estado o álbum se fecha pelo toque
na barra.
### Os acordeões abrem animados

Um acordeão que troca `display` aparece **pronto**, e num toque a lista inteira
abaixo dá um salto — o operador perde de vista onde estava. Animar a altura
mostra de onde o conteúdo saiu, que é a única informação que o salto destrói.
Vale para os dois acordeões do acervo: o **card do álbum** e a **letra** de cada
linha de música.

- **A altura é MEDIDA e animada em JS** (`expandAccordion`/`collapseAccordion`,
  Web Animations API, `ACC_MS` = 220 ms). `auto` não é animável em CSS, e um
  teto fixo cortaria a letra de um hino de 40 linhas ou deixaria um vão enorme
  depois de um refrão de duas.
- **`offsetHeight`, não `scrollHeight`.** A caixa da letra tem teto
  (`max-height: 40vh`) e rola por dentro: o conteúdo de um hino longo passa
  muito do que ela de fato ocupa, e animar até lá abriria um vão e depois
  recuaria.
- **O `overflow: hidden` é devolvido no fim** (`finish` **e** `cancel`). Sem
  isso a lista de músicas ficaria presa à altura do instante em que a animação
  foi montada — e a letra que uma linha abrisse depois seria cortada.
- **O card ganhou um invólucro** (`.coll-open`, com o painel de opções e a lista
  dentro) só para a animação ter UM nó a recortar. O `overflow` não podia ir no
  card: a barra dele é `position: sticky`, e um ancestral com overflow recortado
  a prende. As margens negativas do invólucro repetem as de `.coll-songs` (que
  sangra até a borda do card para o filete do topo atravessar a largura toda) —
  o recorte acontece na borda do **padding**, então esse par margem/padding põe
  a linha de corte exatamente na borda do card.
- **A abertura do álbum é sinalizada pelo render, não pelo clique**
  (`ui(coll.id).animarAbertura`): o card só existe depois de `redesenharAcervo()`
  reconstruir a lista inteira, e a bandeira é consumida ali. Só o toque que
  ABRIU anima — um redesenho por outro motivo (o progresso de um download)
  reencontra o card já aberto, e vê-lo "abrir" sozinho leria como se algo
  tivesse acontecido.
- **Fechar anima ANTES de redesenhar**: o redesenho apaga o nó, e um nó apagado
  não tem como sair deslizando.
- **A letra é montada antes de a linha abrir.** `montarLetra()` é assíncrona, e
  uma caixa ainda vazia mediria zero. Quem rola até a linha que casou com a
  busca passou a ser o chamador, depois de abrir — `scrollIntoView` numa caixa
  `display:none` é no-op.
- **`prefers-reduced-motion: reduce` desliga tudo** (`semMovimento()`): quem
  pediu menos movimento no sistema pediu isso para o app inteiro. Sem animação o
  acordeão abre e fecha como antes, instantâneo.

> O card já foi um **acordeão de "check do sistema"**: expandia um painel de
> status, e as músicas só eram alcançáveis por um botão "Ver músicas" ou pela
> busca. O toque natural no álbum fazia a coisa menos útil. Depois virou um
> atalho para uma **segunda tela** com a lista (`openCollectionSongs`, com
> voltar próprio e um degrau em `__avBack`) — e entrar e sair para ver o que
> tem dentro é caro quando a pergunta é "em qual deles está aquela música?".
> Hoje o acordeão voltou, mas expandindo a **lista**, não o status: o mecanismo
> antigo com um conteúdo novo. `openCollectionSongs` e o `searchScope` que a
> acompanhava não existem mais.

> **Vocabulário: na TELA ela se chama "Biblioteca"** (v5.96). No código e neste
> documento ela continua sendo o **acervo** — `hymnSearchPopup`,
> `renderAcervoTotal`, `openHymnSearch` —, e renomear centenas de símbolos e
> parágrafos para acompanhar um rótulo seria um diff enorme sem nada em troca.
> A tradução é esta: *acervo* (código) = *Biblioteca* (rótulo). Cuidado com o
> outro sentido de "biblioteca" que já existia por aqui — o IndexedDB/OPFS com
> tudo o que o operador baixou (ver as regras de backup em CLAUDE.md); nos
> textos VISÍVEIS ele passou a ser chamado de "os dados do app", para as duas
> coisas não dividirem a mesma palavra na frente de quem usa.

**Opções da coleção** (`buildCollectionOptions` → painel `.coll-opts--inline`,
dentro do card): tudo que é manutenção, numa LINHA — `[⟳ Verificar · ✓ completo]
[🗑]`. Elas aparecem **sempre** que o álbum está aberto; não há botão para
revelá-las, e não há "Ver músicas" (a lista é o toque no card).

- **Sincronizar** (`syncCollection`), rotulado pelo que ESTE toque vai fazer
  neste álbum: **"Verificar atualizações"** com o álbum inteiro no aparelho (não
  há o que baixar — só conferir se o catálogo mudou), **"Baixar"** em qualquer
  outro caso, **"Cancelar"** enquanto roda.
- **O ESTADO fica DENTRO do botão**, na mesma linha do rótulo
  (`.coll-opt-estado`): a gramática do resto do app é **o rótulo nomeia a AÇÃO,
  o estado diz onde ela está** — "Verificar · ✓ completo", "Baixar · 12/24",
  "Atualizar a lista · 52 episódios". Quem encolhe com reticências é o estado,
  nunca a palavra da ação. Sozinho, "Verificar atualizações" não dizia sequer que
  o álbum estava inteiro.
- **O PROGRESSO é DESENHO, não texto.** Enquanto o download roda o botão de
  cancelar se preenche até `--p` (`::before` com `z-index: -1` sob
  `isolation: isolate` — o rótulo é um nó de TEXTO e não recebe `z-index`, então
  quem desce é a barra). Ele não escreve nada de propósito: as palavras
  ("Baixando 2 de 4…") são da barra do card, e uma segunda cópia aqui é a mesma
  classe de defeito que já esvaziou este painel duas vezes. Sem índice não há
  fração e não há barra — uma proporção que não se conhece não se desenha.
- **A remoção é só a LIXEIRA** (`deleteCollection`): 44px contra 316px, e a linha
  inteira passa a ser do botão que carrega ação, estado e progresso. Um
  destrutivo pode ficar sem rótulo aqui porque ele é CONFIRMADO, e o diálogo
  nomeia o alcance ("o que foi baixado… e a lista offline") — a frase segue no
  `title`/`aria-label`.

> **A REGRA QUE ESTE PAINEL ENSINOU, DUAS VEZES: nada aqui repete o que a barra
> do card já diz.** Ele já teve três chips e uma linha de status, e depois um
> chip de peso: o peso está na barra ANTES de abrir (é ele que faz o operador
> decidir abrir), e o "Baixando 2 de 4…" está na barra `sticky` dois centímetros
> acima, que nunca sai de vista enquanto se lê o painel. Um chip permanente de
> REDE também saiu — quem decide se a sincronização pergunta antes de usar dados
> móveis é `isConfirmedWifi()`, e ela o diz **na hora, no diálogo**, que é onde a
> informação tem consequência.

Ele já foi um **bottom-sheet** (`#collPopup`, com degrau próprio de `z-index` e
uma linha em `POPUPS`): um popup sobre o acervo — que já é um popup de tela
cheia — para ver o estado de um álbum **que já estava aberto na tela**. Como
painel, fechar é o mesmo toque que abriu e o `POPUPS`/`z-index` deixaram de ser
necessários. Ele é redesenhado junto com o acervo, e o progresso da sincronização
já dispara `refreshCollectionsIfVisible` — não sobrou popup com vida própria a
sincronizar à parte.

**Uma coleção SEM índice abre direto nas opções**: `openCollectionOptions` liga
`expanded` e mais nada. Ali não há lista para folhear, e o que resolve isso
(sincronizar) está no painel.

**O botão de sincronizar é o mesmo botão de CANCELAR.** Com o download em curso
ele vira ✕ ("Cancelar", com o aviso na BORDA e no texto — o fundo é o
progresso — e **sem giro**: um ✕ girando não se lê como "toque para parar"). Sem
isso, um segundo toque caía num `return` mudo por `u.syncBusy`, e um álbum de
centenas de faixas só parava fechando o app. O cancelamento **fecha a fila** —
nenhuma música nova entra e as que já estão no ar (até `NET_CONCURRENCY`)
terminam: abortar no meio deixaria um arquivo truncado catalogado como completo,
e o custo de esperar é uma faixa, não um álbum. `u.cancel` também é conferido na
VARREDURA do que falta (`songVariantsNeeded` por música), que num álbum grande já
é demorada por si só.
#### "Esta coleção está completa?" — uma pergunta, UMA resposta

**`levantarColecao(id)` é a fonte única**, e três funções finas em cima dela:

- **`colecaoCompleta(id)`** — a pergunta da tela inteira, num lugar só. Conta
  VARIANTES (Cantado + Playback quando a origem declara
  `has_instrumental_music`), nunca músicas. Sem índice não há resposta: um álbum
  que nunca sincronizou não está completo nem incompleto, e o botão ali serve
  para buscar a lista.
- **`faltamNaColecao(id)`** — quantas variantes faltam, para os diálogos e a
  barra da notificação. Prometer "12 músicas" e baixar 10 é a forma mais barata
  de parecer quebrado.
- **`songsBaixaveis(id)`** — o DENOMINADOR do "N de M músicas".

A pergunta já foi respondida em QUATRO lugares por `countDownloaded(id) >=
collSongs(id).length` — uma conta de MÚSICAS —, enquanto o download busca
VARIANTES e a medida de peso já contava variantes: um Playback que faltasse
deixava a barra escrevendo um número EXATO ao lado de um card que ainda mostrava
o botão de baixar. **Duas réguas para a mesma pergunta divergem sozinhas, na
mesma tela.**

**"NÃO EXISTE" não é "não baixei ainda".** Uma música cuja origem não tem o
arquivo (`url_music` vazio) nunca ganha `fileIdFull`, e o efeito era permanente:
a coleção nunca ficava completa, o botão nunca sumia, e **cada sincronização
voltava a buscar o metadado dela** só para redescobrir que não há o que baixar.
`ensureSongVariant` marca (`semAudio`/`semPlayback`) e apaga a marca se a URL
aparecer depois — o índice é reaproveitado in-place pelo `fetchCollectionIndex`,
então a marca sobrevive à atualização da lista de graça. A partir daí
`levantarColecao` a conta como `semFonte`, `songVariantsNeeded` para de pedir o
metadado dela, e ela sai **dos dois lados** da fração (um contador travado em
53/54 ao lado de um "Completo offline" seria a mesma contradição, só que menor).

**O botão de GRUPO segue a mesma régua** (`grupoCompleto(colls)` =
`colls.every(colecaoCompleta)`, e não uma soma de músicas do grupo, que
responderia diferente da linha logo abaixo). O custo do toque ali é bem maior que
num card: `syncGroup` percorre álbum por álbum, cada um buscando o índice na REDE
e conferindo variante por variante — minutos, num acervo grande — para terminar
escrevendo "Completo" e deixar o mesmo botão convidando a repetir tudo.

E é `grupoCompleto` que impede o "Baixar toda a biblioteca" de MENTIR num acervo
recém-instalado: o atalho `songs === 0 → "Já completo"` é verdadeiro para um
álbum SEM ÍNDICE, que tem zero variantes faltando **porque não tem lista
nenhuma** — na janela em que o `autoRefreshCollections` ainda não indexou, o
botão de maior alcance da tela respondia "Já completo" e não fazia nada.

`tools/acervo.test.mjs` prende as três contas (completude de coleção, de grupo e
peso) num Chromium de verdade: conta errada não estoura em lugar nenhum, ela só
mostra o número errado — a classe de defeito que nenhum `node --check` pega.

#### A medição do peso

Duas perguntas, e só uma tem resposta exata:

1. **quanto já está no aparelho** — `AVDB.opfsFolderSize(path)` enumera a PASTA
   e soma o `size` real de cada arquivo. EXATO, e cobre tudo que o download traz.
2. **quanto pesa o álbum inteiro** — o que falta ainda não veio, logo ESTIMATIVA.

**MEDIR A PASTA, NUNCA O CATÁLOGO.** O download grava dois tipos de arquivo na
mesma pasta: os áudios, que viram registro em `files`, e as **imagens de fundo da
letra**, que não viram (são referenciadas de dentro dos slides). Somando o
catálogo, essas imagens ficavam fora de TODA conta — num hinário inteiro,
centenas de MB que o operador via sumir do armazenamento sem explicação, e que
nenhuma tela somava; e ficavam fora também do NUMERADOR da taxa, que por isso
subestimava sistematicamente tudo o que projetava. Enumerar a pasta é ainda **mais
barato**: perguntar o tamanho de um arquivo não desserializa nada, enquanto o
`getAll` do catálogo trazia thumbnail e letra inteira de cada faixa para somar um
campo.

**A estimativa é por DURAÇÃO, não por contagem de faixas.** Áudio é bytes por
segundo: num hinário as durações são parecidas e os dois métodos empatam, mas num
álbum com um louvor de 2 min ao lado de um de 9 a média por faixa erra por um
fator de quatro — e erra na pergunta que decide um gasto de dados móveis. A
duração vem do índice (`duration`, "HH:MM:SS").

**A taxa é MEDIDA no aparelho** (bytes no disco ÷ segundos baixados), nunca uma
constante de bitrate: assim ela amortiza o que não é áudio e acompanha o bitrate
real do acervo. A escada vai da fonte mais específica à mais genérica: a taxa
DESTE álbum → a média de tudo o que já foi baixado → 128 kbps (`BPS_PADRAO`).
Sem o último degrau, um álbum vazio não teria tamanho a mostrar — que é
exatamente quando a informação mais importa. (Para VÍDEO a constante é outra,
`BPS_VIDEO_PADRAO`: a escada inteira pressupõe áudio, e numa série vazia ela
prometia ~50 MB para um ano que pesa ~15 GB.)

Duas ressalvas: o **Playback** conta com a duração do Cantado (a lista leve não
traz `instrumental_duration`, e é a mesma música), e uma faixa **sem duração** no
índice entra por `SEG_PADRAO` (3min30) em vez de somar zero, que faria o álbum
parecer menor do que é.

**O peso medido PERSISTE** (`state['coll-bytes']`) — `collUI` é estado de sessão,
e fechar o app apagava o número. A escrita é coalescida (o contador sobe a cada
arquivo baixado; um `setState` por música seria uma transação de IDB por
download).

**O peso NÃO é recalculado durante o render.** Recalcular é IO, e como o valor
mudar dispara outro `refreshCollectionsIfVisible`, sincronizar uma coleção com a
aba aberta executava N recontagens (N = número de cards) a cada música baixada.
Hoje `downloadCollectionFile` e `downloadCollectionImage` **somam o `blob.size`**
ao cache (`ui(id).bytes`) sem tocar o disco, `deleteCollection` zera, e a
recontagem completa roda só onde a conta muda em bloco:

- **`conferirPesoSeFaltar` reconta uma vez por sessão e por álbum, tenha ele peso
  ou não.** Rodando só com o peso ZERADO, um número errado nunca se corrigia: o
  acumulador só sobe, então qualquer divergência ficava gravada em `state` para
  sempre. (O `Set` que ele usa impede o `refreshCollectionsIfVisible` de dentro
  da recontagem de virar laço.)
- **O fim de uma sincronização reconcilia** (`updateCollBytes` no `finally` de
  `syncCollection`): durante o lote o número sobe por acumulação, que dá
  movimento na tela e erra em toda borda (uma faixa que falhou, um download
  repetido, um cancelamento). O fim do lote é o único momento sem IO concorrente.

**E o re-render é coalescido** (`refreshCollectionsIfVisible` agenda,
`renderCollectionsNow` executa; `COLL_REFRESH_MS` = 400 ms): o progresso chama
isso uma vez por música, e sincronizar o Hinário 2022 reconstruía a lista inteira
613 vezes. A resposta ao TOQUE continua imediata — `syncCollection` chama
`renderCollectionsNow()` direto ao ligar o `syncBusy`; só o progresso espera a
janela.

Sincronização é **aditiva e resumível**: interromper e sincronizar de novo só
baixa o que falta (`fileGet` reconfirma que o arquivo catalogado ainda existe de
fato antes de pular — cobre exclusões manuais feitas por dentro da pasta).

**`syncCollection` devolve `{ ok, baixados, falhou }`.** Devolvendo `undefined`,
uma queda de rede era **invisível para o chamador** — o `syncGroup` varria dezenas
de álbuns em segundos sem baixar nada e ainda anunciava sucesso. Convenção:
`ok: false` é "não deu para baixar" (rede, armazenamento, erro); **cancelar ou já
estar completo é `ok: true`**, porque nos dois casos o sistema fez o que devia.
Na mesma linha, `downloadCollectionSong` devolve `false` quando nem os metadados
vieram, e o worker separa `done` (tentativas — é ele que move a barra) de
`falhou`: sem isso o rodapé anunciava "Atualizado (60 baixado(s))" com ZERO bytes
no disco.

**A ordem entre `bgTaskEnd` e `withBgWork` importa**, e é a mesma nos quatro
fluxos de massa (`syncCollection`, `syncGroup`, `ensureBibleVersionDownloaded`,
`syncLyrics`): o `bgTaskEnd` fica **dentro** do `withBgWork`. Um `finally`
externo roda DEPOIS do `finally` do `withBgWork`, e é este que solta o serviço em
primeiro plano e limpa o registro de tarefas — encerrar a tarefa depois disso
chega sempre tarde demais, sem efeito nenhum.
#### Classificação: categoria → álbum (a hierarquia do banco)

O acervo do LouvorJA tem **dois níveis, e só isso: categoria → álbum → música** —
não há grupo acima da categoria nem subcategoria (ver
`docs/FONTE-DE-DADOS-LOUVORJA.md` §5.5). A relação categoria↔álbum é **N:N**, e
`subtitle`/`order` são campos do **pivô**: variam conforme a categoria em que o
álbum é mostrado.

`state.albumCatalog` guarda a hierarquia inteira — `{ categories: [{ id_category,
name, order, albums: [{ id_album, subtitle, order }] }], albums: [{ id_album,
name, color }] }`. `albums` é o índice deduplicado que dá identidade a cada card
(vira `coll.id`); `categories` preserva a classificação.

`renderCollectionsList()` renderiza **cabeçalhos de categoria** (`.coll-group`)
na ordem do banco, com os álbuns de cada uma também na ordem do banco, e os
**hinários num grupo fixo no topo**. Como a relação é N:N, **o mesmo álbum
aparece em mais de uma categoria** — de propósito, é assim no banco e no app
original, e o subtítulo muda junto. Álbuns que nenhuma categoria reivindica caem
num grupo "Outros álbuns" em vez de sumirem.

**Álbum que é hinário disfarçado** (`isHymnalAlbum`): se `album_{id}.categories`
contém uma string começando com `hymnal.`, aquele "álbum" é na verdade um
hinário — o app-ja redireciona a abertura dele para o módulo do hinário, e como
os dois hinários já têm card fixo aqui, o duplicado é omitido. Esse é o critério
AUTORITATIVO, gravado como `collState[id].isHymnal` quando o índice chega; até lá
vale um palpite pelo nome (`/hin[aá]rio/i`).

**Índices sempre em dia, automaticamente** (`fetchCollectionIndex` /
`autoRefreshCollections`): na abertura e a cada retomada do Controle
(`visibilitychange`), busca (fase 1) os índices leves dos hinários + o catálogo
de álbuns, e (fase 2) o índice leve de CADA álbum (`album_{id}.musics`, só
metadados), com concorrência limitada (`runLimited` com `NET_CONCURRENCY`) e TTL
(`ALBUM_INDEX_TTL`, 12 h — pula os indexados há pouco, sempre busca os
novos/vazios). Ela é **silenciosa**: sem rede, só mantém o que está em cache.
Assim TODO o acervo entra na busca sozinho, baixado ou não.

**O merge é IN-PLACE, mutando os objetos existentes**, e isso não é estilo:
`syncCollection` tira um snapshot do array e grava `fileIdFull`/`fileIdPlayback`
nos objetos DELE conforme baixa. Como esta atualização roda em toda retomada do
app — ou seja, exatamente durante uma sincronização em massa, que é quando o
operador minimiza —, recriar os objetos deixava o snapshot apontando para
órfãos: os bytes iam para o OPFS e para o catálogo, os ids eram descartados no
`setState` seguinte, o card mostrava menos baixados do que existem e a música era
rebaixada. Reaproveitar o objeto preserva de graça qualquer campo extra
(`lyrics`, `_norm`). Complementarmente, `autoRefreshCollections` **pula coleções
com `syncBusy`**.

**Busca/lista — um popup só, e O CAMPO É A CHAVE.** `searchIsBrowsing(q)` é
literalmente `!q`: **campo vazio** = o navegador de coleções (cabeçalhos de
categoria e cards, com as músicas de cada um dentro do próprio acordeão); **com
texto** = a lista de músicas que casam, varrendo TODAS as coleções indexadas. Não
existe "modo coleção" separado — o escopo por coleção (`searchScope`, com título
próprio e um degrau de navegação) foi substituído pelo acordeão do card, que
mostra o álbum **sem perder o acervo de vista em volta**.

`renderSearchResults` monta os resultados dos índices já em memória
(`collState`), então funciona sem rede assim que eles tiverem sido buscados uma
vez; se o popup estiver aberto quando um índice atualiza, a lista se re-renderiza
na hora. Cada resultado carrega sua `coll` para tocar/adicionar/baixar sob
demanda.

**A busca tem teto de 60 resultados**, com uma linha final dizendo quantos
ficaram de fora: ela varre milhares de músicas e renderizar tudo a cada tecla
travaria o campo. Folhear uma coleção INTEIRA não passa por aqui — é o acordeão
do card, que lista tudo (em páginas de 100, ver acima).

**A busca por NÚMERO só vale onde o número identifica** (`collNumbersSongs`).
Num hinário o número É o nome da música ("o 471", e a numeração é a mesma do
hinário impresso); num álbum, `track` é só a posição no disco. Digitar "3" trazia
a faixa 3 de cada álbum indexado, empurrando o hino 3 para o fim da lista.
`songLabel(coll, s, pad)` é o único lugar que monta o rótulo — lista, busca, nome
do arquivo baixado e slide de capa passam todos por ali. Daí `hymnTrack` ser NULO
fora de hinário: é o número NO HINÁRIO, não a faixa do disco, e com isso o slide
de capa, o título do popup de letra e a preview param de numerar sem precisar
conhecer coleção nenhuma (o Display, em especial, só recebe o registro do
arquivo). Uma passagem única corrige o que já está baixado
(`desnumerarAlbunsBaixados`, estado `migSemNumeroAlbuns`) — ela REMOVE o prefixo
`N. ` e zera o `hymnTrack`, em vez de recalcular o nome a partir de `hymnName`,
porque o mesmo registro cobre importados e variantes.

### "Pesquisar <texto> no YouTube", no fim da busca

O acervo é o LouvorJA, e ele não tem tudo. `appendYoutubeSearch` leva a busca
PRONTA para o YouTube e devolve o operador ao ponto em que o `intent-filter` de
share já sabe receber o vídeo — sem isso a saída era sair do app, abrir o
YouTube, **digitar tudo de novo** e compartilhar de volta.

- **Em todos os desfechos da busca**, inclusive (e principalmente) "Nada
  encontrado", que é quando a pergunta "e agora?" aparece. Não aparece enquanto
  se FOLHEIA o acervo (sem texto não há o que pesquisar).
- **O texto vai entre aspas** porque é ele que diz que o toque leva ISTO, e não
  abre o YouTube na página inicial. Entra por `textContent`, nunca `innerHTML`:
  é texto digitado pelo operador.
- **Uma LUPA, não o logotipo do YouTube.** O que o botão faz é uma busca;
  desenhar a marca de outro app promete que ele abre lá dentro em algum lugar
  específico.
#### A BUSCA DO YOUTUBE ACONTECE AQUI DENTRO

Num shell ≥ 18 o botão **não sai do app**: `AVNative.ytSearch(termo)` devolve os
resultados e eles entram **na mesma lista**, abaixo do acervo, com miniatura
16:9, título, canal e duração.

- **O pedido sai em PORTUGUÊS, e o caminho para isso não é o óbvio.** A
  localização padrão da biblioteca é **en-GB**, e o YouTube TRADUZ o título
  quando o canal publica traduções ou quando a tradução automática está ligada —
  uma busca por louvor brasileiro voltava com títulos em inglês de vídeos cujo
  título ORIGINAL é em português.
  - `Localization("pt","BR")` no `NewPipe.init` **não adianta**:
    `StreamingService.getLocalization()` FILTRA o pedido pela lista de idiomas
    suportados do serviço, e a do YouTube tem um item só — `"en-GB"`, com o resto
    **comentado** no fonte. Qualquer outro idioma cai no `Localization.DEFAULT`,
    em silêncio e sem erro: o código PARECE certo. (O país escapa do filtro,
    então metade do pedido chegava.)
  - A saída é `forceLocalization`/`forceContentCountry` no próprio `Extractor` —
    `getExtractorLocalization()` lê o forçado ANTES da lista de suportados. Isso
    exige montar o extrator à mão nos dois caminhos (`getStreamExtractor` e
    `getSearchExtractor`) em vez dos atalhos `getInfo(service, …)`, e no da busca
    **chamar `fetchPage()`**: `SearchInfo.getInfo(extractor)` é o único dos
    `getInfo` que NÃO busca a página sozinho, e sem isso a lista volta vazia, sem
    erro.
  - O código é `"pt"`, não `"pt-BR"`: a lista (comentada) que a biblioteca guarda
    como os `hl` que o YouTube aceita tem "pt" e "pt-PT", e com o `gl=BR` do
    `ContentCountry` "pt" é o português do Brasil.
  - `Accept-Language` acompanha no `NpDownloader`: quem manda de fato é o `hl` do
    corpo InnerTube, mas nem toda requisição é InnerTube, e nas páginas HTML é o
    cabeçalho que decide.
  - **Fixo, nunca herdado do `Locale` do aparelho**: o que se quer é o título
    ORIGINAL, e um celular configurado em inglês traria a tradução de volta.
- **Quem pesquisa é o Kotlin** (`YoutubeGrab.pesquisar`), não o WebView: ali não
  existe CORS e a requisição sai do IP do aparelho. As alternativas não serviam —
  um `<iframe>` da página de resultados é recusado pelo `X-Frame-Options`, e a
  API oficial exigiria uma chave embutida no APK com cota dividida pela frota.
- **Só vídeos** no filtro: canal e playlist não têm o que fazer numa lista cujo
  único destino é virar arquivo de mídia.
- **O nome do canal sai da frente do título** (`tituloLimpo`). Meio YouTube
  publica como "Arautos do Rei - Firme nas Promessas", e no Cronograma isso vira
  uma lista em que a metade esquerda de toda linha é a mesma palavra. A remoção é
  CONSERVADORA — só corta quando o título começa exatamente com o nome do canal
  seguido de um separador, então "Hino 512 - Ao Deus de Abraão" fica inteiro —, e
  o sufixo `- Topic` é descontado antes da comparação, senão ela nunca casaria
  justamente nos vídeos de louvor. O canal continua no subtítulo.
- **A miniatura é montada a partir do ID** (`i.ytimg.com/vi/<id>/mqdefault.jpg`)
  em vez de vir da biblioteca: é uma URL estável há mais de uma década, e assim o
  formato das imagens do extrator — que já mudou entre versões — deixa de poder
  quebrar a lista.
- **Chegar no fim da lista já pesquisa** (`armarAutoBuscaYt`): rolar até o fim do
  que o acervo tem É o gesto de quem não achou o que queria. A espera de 500 ms
  não é enfeite — a lista é reconstruída A CADA TECLA, e com poucos resultados a
  sentinela nasce visível: sem ela a busca dispararia com o termo pela metade,
  uma vez por letra. O termo é reconferido quando o prazo vence.
- **O cabeçalho de seção (`.yt-head`) faz três papéis**: é a SENTINELA que o
  observador vigia (por isso precisa de altura de verdade — um `li` de altura
  zero é uma aposta na forma como o navegador trata interseção de área nula), é o
  sinal de busca em curso (anel + "Procurando no YouTube…") e é o rótulo que
  separa o acervo dos resultados. O filete em cima é a separação; o alinhamento à
  ESQUERDA e o peso são o que o fazem ler como título de seção — centrado, lia
  como mais um item da lista. Pela mesma razão a negativa do acervo diz o escopo
  ("Nada encontrado na biblioteca"): com o cabeçalho do YouTube logo abaixo, uma
  negativa sem escopo parece negar a busca inteira.
- **O botão manual continua onde é a única saída**: navegador e shell < 18, que
  não sabem pesquisar de dentro do app (e ali a auto-busca não acontece — tirar o
  operador do app sem ele ter pedido seria outra coisa). Ele exige shell ≥ 15
  (`AVNative.openExternal`) e **não é desenhado** abaixo disso: o WebView recusa
  navegar para fora do origin, então o toque não faria nada, nem erro no console.
- **O toque num resultado abre a MESMA folha de destinos das músicas do acervo**
  (antes ele baixava direto, e o vídeo caía no Cronograma quisesse o operador ou
  não). "Tocar agora" FECHA a Biblioteca (o cartão de progresso mora na preview,
  que está atrás desta folha); as de "adicionar" a MANTÊM aberta — quem está
  buscando provavelmente vai pegar mais de um —, e ali a linha termina marcada
  como CONCLUÍDA (✓ verde sobre a miniatura) em vez de voltar ao estado inicial,
  que era o que fazia parecer que nada tinha acontecido.
- **O estado de cada linha vive num Map (`ytEstado`)**, nunca na classe do nó: a
  lista é reconstruída a cada tecla e a cada redesenho, e a marca sumiria com o
  download ainda correndo (a razão do `songRowBusy` das músicas). Concluído fica
  APAGADO, não desabilitado: o mesmo vídeo pode ser querido de novo.
- **Cada escolha vai só para o SEU lugar.** A lista de destino é decidida no
  `ytAcao` e entregue ao `addMedia`, que continua gravando registro e entrada na
  MESMA transação — a lista passou a ser ESCOLHIDA, não dispensada, justamente
  para o registro nunca nascer órfão. "Tocar agora" vai para `avulsos`.
- **O mesmo vídeo não baixa duas vezes** (`ytArquivo`): o registro guarda o
  `youtubeId` desde que nasce, então "já tenho isto?" é uma leitura do índice
  (`AVDB.mediaByYoutube`). Só vale para quem tem **blob** — um item de LINK
  carrega o mesmo `youtubeId` e é justamente o que o download existe para
  substituir. Vale também para o compartilhamento do mesmo link.
- **O resultado que já está no aparelho nasce marcado** (`marcarYtProntos`): o ✓
  diz as duas coisas ("acabou de baixar" e "já estava aqui"). É assíncrono — a
  lista não espera o IDB, e o estado mora no `ytEstado`, logo sobrevive ao render.
- **No SIMPLIFICADO não há folha nenhuma: o toque toca.** As outras opções são
  listas que aquela tela não mostra. Vale para TUDO o que é compartilhado com o
  app nesse modo, link e arquivo — e a prateleira `avulsos` nunca poda o LOTE que
  acabou de entrar: um share de cinco arquivos com o limite aplicado item a item
  faria o quinto expulsar o primeiro, que é justamente o que vai ser projetado.
  Quem cede lugar é o que já estava lá de antes, e a fixação é UMA por share.
- **Onde o aviso aparece tem TRÊS destinos, não dois.** Tocar: cartão sobre a
  preview. Cronograma: linha provisória na lista. Playlist: **nenhum dos dois** —
  ela mora dentro de uma bandeja fechada, não há linha para marcar, e desenhar a
  provisória no Cronograma prometeria um item que nunca vai aparecer lá.

**Nome normalizado uma vez, não por tecla** (`s._norm`, gravado por
`fetchCollectionIndex` e preenchido sob demanda no filtro): `normalizeForSearch`
faz `normalize('NFD') + replace + toLowerCase` — três alocações de string sobre
um valor que nunca muda, antes repetidas para CADA música do acervo A CADA TECLA.
Os campos de busca também têm **debounce** (`SEARCH_DEBOUNCE_MS` = 130 ms).

**A linha de resultado** (`hymnResultRow`) é `[indicador] [nome / subtítulo]`,
com a fonte maior que a do resto (`.hymn-name`) porque a lista precisa ser
legível de relance no meio do culto. Tocar na LINHA abre a gaveta logo abaixo,
em **acordeão** — abrir uma fecha a anterior: duas abertas ao mesmo tempo
empurrariam a lista e tirariam do lugar o que o operador estava mirando.
#### UMA LINHA, UM TOQUE, UMA GAVETA

```
 ┌────────────────────────┐
 │ [·] Ó Adorai o Senhor    │ ← 83% da linha para o nome
 ├────────────────────────┤
 │  Tocar agora           │
 │  [Cantada|Playback|Letra] │  as OPÇÕES
 │  Adicionar à playlist  │
 │  … + Confirmar         │
 ├────────────────────────┤
 │  1ª ESTROFE            │  a LETRA (ou o detalhe do vídeo)
 │  Ó adorai o Senhor…    │
 └────────────────────────┘
```

Um alvo só, e a lista inteira do outro lado. Com dois botões na linha (um ▶ e um
`+`, cada um abrindo metade das escolhas), decidir *"o que fazer com este hino?"*
exigia primeiro decidir **qual dos dois era o dono da pergunta** — e essa é uma
pergunta sobre a UI, não sobre o culto.

- **A gaveta tem DUAS metades, e a letra FICA:** as opções em cima, a letra (ou o
  detalhe do vídeo) logo abaixo, na mesma abertura. A ordem não é arbitrária —
  quem abre a gaveta acabou de tocar para DECIDIR, e a decisão tem de estar sob o
  dedo; a letra é a conferência, e ela pode rolar. Quem some fechado é o
  ENVELOPE (`.hymn-gaveta`), nunca cada metade: a animação do acordeão mede
  `offsetHeight` de UM elemento, e com duas caixas irmãs aparecendo por conta
  própria a medida seria de meia gaveta.
- **Nada de menu foi reimplementado.** `renderSongMenu` e `openYtMenu` ganharam
  PARA ONDE escrever (`songMenuFor.alvo`, que viaja no ESTADO porque cada
  remontagem — o seletor, cada marca de destino — precisa refazer a lista no
  mesmo lugar), e o modo `tudo` empilha tocar e adicionar numa lista só. A folha
  `#songMenuPopup` continua de pé com os dois donos que sobraram: os resultados
  do YouTube e o seletor de destinos da importação.
- **Um episódio de SÉRIE desvia para a lista do YouTube**, como a folha já fazia.
- **O quadrado da esquerda é INDICADOR, não botão.** Ele fica porque hospeda o
  anel de download — a única coisa que aquele canto sempre informou de verdade —
  e porque segura a coluna que alinha a lista. Perdeu o `--accent-soft` e o
  `cursor: pointer`: um alvo que não é alvo, num canto onde o dedo mira, é pior
  que não ter nada.
- **O oráculo do ALVO afirma que TODO ponto da linha leva ao mesmo lugar** —
  cantos, bordas e o quadrado onde o ▶ vivia — e conta `button` sem conhecer
  nomes, para valer contra o próximo que aparecer.
- **No simplificado nada disso aparece:** o toque na linha chama `simplePlaySong`
  direto, que é a decisão que aquele modo poupa.

**O SELETOR DECIDE O QUÊ; AS OPÇÕES, ONDE.** O seletor tem três segmentos
(Cantada · Playback · **Letra**) e aparece SEMPRE — ele já dependeu de haver
playback, e toda música tem letra. Com "Letra" escolhida, "Tocar agora" projeta a
letra e cada lista recebe a CENA de letra (`addLyricCue`, que aceita várias
listas), o que torna "Só a letra, no Cronograma" redundante. Sem essa divisão a
variante aparecia duas vezes, uma como segmento e outra como linha.

**Duas armadilhas que a lista trouxe ao mudar de casa**, e as duas são "algo que
ela deixou de herdar":

| Sintoma | Causa |
|---|---|
| marcadores de lista à esquerda | a `<ul>` nova não herdou `list-style: none` de ninguém (a do popup é `.popup-list`, que já o tinha). Não vinha de regra do app: era a **ausência** de uma |
| o feedback de toque encolhia a gaveta inteira | o `:active` do `.lib-item` satisfeito por um botão DENTRO dele |

**A gaveta é um POÇO, soldado à sua linha.** Medido no tema escuro, com o
`--panel` da folha antiga: `--panel` compõe rgb(44,52,60) e a faixa de uma linha
vizinha compõe rgb(46,54,63) — **1,03:1**, isto é, a seção aberta tinha
literalmente a cor das linhas de baixo, com a margem em volta deixando passar a
faixa da própria linha como moldura (três tons indistinguíveis empilhados).

O tom é um par por tema (`--gaveta-bg`/`--gaveta-btn`), e a inversão é
aritmética:

- **escuro** — só dá para DESCER. Subir levaria a `--panel-2`, que é a cor do
  card do álbum, a que aparece nos vãos entre as linhas. Par: `--bg` × `--panel`.
- **claro** — só dá para SUBIR. Descer para `--bg` deixaria a gaveta a 1,09:1 do
  card. Par: `--panel` (branco) × `--panel-2`.

É o precedente do `--field-bar` num lugar novo: **uma superfície cuja direção não
acompanha a escada precisa de um token próprio em cada tema.** E os BLOCOS que
descansam nela vestem `--gaveta-btn` em vez do `--surface` de fábrica, porque
aquele é um OVERLAY — dentro de uma seção da Biblioteca ele resolve para o par
SUNK, e preto sobre um poço que já é o tom mais escuro do app não produz degrau.

**A gaveta não tem margens.** Ela é filha do `.lib-item`, que já pinta a linha
inteira e recorta pelo `border-radius` com `overflow: hidden` — coladas, faixa e
gaveta viram UM bloco com o título em cima e o poço embaixo. O respiro vem do
`padding` da lista de opções.

**A caixa de marcação se vê sem estar marcada** (`--check-vazio`): 1,08:1 contra
o botão em que mora → 1,28:1. Token com TEMA e não o `--scrim` compartilhado (no
claro aquele .6 seria uma lápide), e ainda um RECESSO. O teto é do tema escuro:
preto sobre um botão já escuro comprime a razão por construção.

**A largura do "Ver/Ocultar a letra" não muda com o estado.** "Ocultar" é mais
longo que "Ver": o botão crescia ao ser tocado (110px → 143px) e o CONFIRMAR ao
lado encolhia junto. As duas frases ocupam a MESMA célula de uma grade 1×1 — a
largura é a da maior. **`visibility` e não `display`**, porque a escondida
precisa continuar MEDINDO: é ela que reserva o espaço. Um `min-width` em `ch`
seria um número a manter contra a fonte e contra a tradução; isto não tem número.

Tocar (`playSongVariant`) e os três destinos (`addSongToDestinos` →
`adicionarNasListas`) baixam a música na hora se ainda não estiver offline — e o
download é **um só** por toque, mesmo com os três destinos marcados: o caro é
resolver o id, e o item resultante é o MESMO em todas as listas. O funil é um:
`listasDosDestinos` → `adicionarNasListas`. **"Letra"** baixa também, mas só
quando precisa: a letra costuma já estar no acervo de textos.
### O download vira estado da tela (v5.64-65)

Tocar uma música que ainda não está no aparelho abre um download de dezenas de
segundos. Até a v5.63 o toque não mudava **nada** na tela: o acervo continuava
aberto na mesma lista — ele só fechava depois que o arquivo chegava — e o único
sinal era um toast na tela principal, **atrás** do popup. Do lado de quem opera,
"toquei e não aconteceu nada", e o reflexo é tocar de novo.

A correção tem duas metades, e a primeira é a que resolve o problema:

1. **A resposta é imediata e igual à de uma música já baixada.** `closeSongMenu()`
   e `closeHymnSearch()` passaram para o **começo** de `playSongVariant` (e de
   `projectSongLyricsOnly`), antes do `await`. O toque fecha o acervo na hora;
   se o download falhar, o erro chega por toast, que é o mesmo caminho de
   qualquer outra falha.
2. **A espera aparece na miniatura da preview**, não na tela principal
   (`previewBusy` → `#pvBusy`). É ali que a mídia vai aparecer, então é ali que
   se anuncia que ela está a caminho; um aviso na tela principal seria mais um
   cartaz avulso a interpretar.

Os detalhes que não são óbvios:

- **É um CARTÃO no meio, não uma cortina.** A preview espelha o telão e precisa
  continuar espelhando enquanto a próxima música baixa: o louvor de fundo segue
  tocando ali, e cobri-lo por trinta segundos tiraria a única janela para o que
  está no ar. O cartão é opaco por conta própria — com um véu translúcido a
  marca do wallpaper atravessava o texto.
- **Só acende depois de `PV_BUSY_DELAY_MS` (180 ms).** Uma música já baixada
  resolve em poucos milissegundos, e um cartão que pisca é pior que nenhum: lê-se
  como falha.
- **O contador é um número, não um booleano** (`pvBusyCount`). O operador pode
  disparar dois downloads (tocar um hino e, enquanto ele baixa, projetar a letra
  de outro) — o primeiro a terminar não pode apagar o indicador do outro.
- **A ação e o nome são campos separados** (`Baixando` em caixa alta miúda, o
  nome embaixo). Numa caixa de ~250px `Baixando "Ó Adorai o Senhor"…` vira uma
  linha que estoura; separados, a ação se lê de relance e o nome fica com a
  largura toda, com clamp de duas linhas.
- **O cartão desvia dos `.pv-fab`** (padding-right de 38px): tela cheia
  e cast continuam alcançáveis durante o download.
- **Fora da tela cheia** (mesma regra dos `.pv-fabs`): ali a preview **é** a
  projeção, e o cartão iria para o telão.
- **No simplificado o indicador não existe** — a preview não está na tela. Por
  isso `previewBusy` devolve `{ visivel, soltar }`: o chamador usa `visivel` para
  decidir se `ensureSongDownloaded` ainda deve mostrar o toast
  (`opts.toast`). Dois avisos para o mesmo download é ruído; **nenhum** é o
  defeito que isto conserta.

#### Adicionar a uma lista: a marca vai para a LINHA (v5.65)

Adicionar também pode disparar o download, e ali a preview é o lugar errado: o
acervo **continua aberto de propósito** (adicionar três músicas seguidas é o uso
normal) e nada vai para a preview. O indicador vai então para a miniatura da
própria música — o botão `.hymn-play-thumb`, que é o quadrado de 46px que era a
miniatura. O ▶ some e o anel entra no lugar; o botão segue clicável, porque
tocar uma faixa que já está baixando é legítimo e o download é o mesmo
(`songDownloadInFlight` dedupa).

- **É o MESMO anel** (`.dl-ring`, com `--dl-ring` dando o tamanho): um aro
  girando com a seta de download parada dentro. Dois spinners diferentes para a
  mesma espera fariam o operador perguntar se são coisas diferentes. Cada lugar
  só escolhe onde ele mora — a preview quando a mídia vai aparecer ali, a linha
  quando o que baixa é aquela faixa da lista.
- **Quem acende é `ensureSongDownloaded`**, logo DEPOIS da checagem
  `needsFull || needsPlayback` — o único ponto que já sabe que existe download de
  verdade. Acender no chamador exigiria repetir a checagem (e piscar em toda
  música já baixada, que é o defeito que o atraso de 180 ms evita na preview).
  Como efeito, **todo caminho que baixa sob demanda ganha a marca sem precisar
  lembrar dela**.
- **O estado vive num `Map`, não só na classe do botão** (`songRowBusy`, contado
  por música). A lista do acervo é **reconstruída** durante o download — o
  progresso redesenha a cada 400 ms —, e uma classe escrita no nó sumia no
  redesenho seguinte: a linha voltava a mostrar ▶ com o download ainda correndo.
  `hymnResultRow` relê o Map ao montar (a linha carrega `data-song`) e
  `setSongRowBusy` cuida das que já estão na tela. Contado, e não booleano:
  adicionar a mesma faixa à playlist e ao Cronograma abre dois pedidos, e o
  primeiro a terminar não pode apagar a marca do outro.
- **Os três caminhos de adicionar passam `toast: false`.** O toast que sobra é o
  do RESULTADO ("Adicionado à playlist"), que é outra informação.

**Resolução do id de mídia por variante** (`resolveSongMediaId`) é
**offline-first com download sob demanda**: se a variante já foi baixada
(fase 2 acima), usa o id do catálogo OPFS direto (zero-cópia, mesmo padrão do
botão ➕ das pastas); senão, `ensureSongDownloaded` baixa a música **de
verdade** ali mesmo (mesma `downloadCollectionSong` da sincronização em massa —
áudio + capa + letra, pronto pra tocar 100% offline dali em diante), não um
registro temporário/streaming. `songDownloadInFlight` (Map por
`<coll.id>:<id_music>`, sessão) evita disparar dois downloads da mesma música em
paralelo se o operador tocar/adicionar duas vezes rápido antes do primeiro
terminar. Ver
"Wi-Fi vs dados móveis" abaixo para a política de quando cada tipo de
download é permitido.

> **Nota de rede**: a API de produção precisa aceitar CORS para a origin em que
> a base roda — no aparelho, `https://appassets.androidplatform.net`, servida
> pelo `WebViewAssetLoader` do shell (ver "Build, distribuição e instalação"); no
> navegador, o que o servidor estático de desenvolvimento usar. Não verificado
> em produção: a rede das sessões de desenvolvimento não alcança
> `api.louvorja.com.br`. Se o `fetch` falhar por CORS, a sincronização e a
> busca ao vivo param de funcionar — mas não a busca no índice já baixado, que
> é toda em memória.

#### Letra sincronizada (slides + temporizador)

Cada variante baixada (registro em `files`, criado por `downloadCollectionFile`)
ganha campos extras, sem exigir bump de `DB_VERSION` (o `files`/`media` do
`shared/db.js` guarda objetos livres de schema):

- `lyrics`: `Array<{ time, text, auxText, cover, imageOpfsPath, imagePosition }> | null | undefined`
  — sentinela de 3 estados: `undefined` = nunca processado (dispara
  reprocessamento na próxima sincronização, mesmo que o áudio já esteja
  baixado — é o que dá **backfill** aos hinos sincronizados antes desta
  funcionalidade existir, sem rebaixar áudio: `ensureSongVariant` só
  recalcula e regrava a letra no registro já existente); `null` = já
  processado, mas o hino não tem estrofes com tempo utilizável (não tenta de
  novo à toa); array = primeiro item é sempre o slide de capa (`cover:true`,
  `text:null`, `time:0`, imagem da música), os demais vêm do mapa `lyric` de
  `music_{id}` (filtrados por `show_slide`, tempo do campo certo — `time`
  para Cantado, `instrumental_time` para Playback — convertido pra segundos
  via `parseTimeToSeconds`, ordenados por tempo).
- `hymnName`/`hymnTrack`/`hymnAlbum`: título limpo, número do hino
  (`s.name`/`s.track`, sem o prefixo/sufixo que `name` carrega pra exibição na
  lista) e o **álbum/coleção de onde a música veio** (`coll.name`, v5.219) — as
  três peças do cartão de capa. `hymnAlbum` mora no REGISTRO, e não numa
  consulta na hora de projetar, porque quem projeta é o Display: ele só recebe
  o registro do arquivo e não tem acesso a coleção nenhuma. Registro antigo é
  preenchido na varredura que a sincronização já faz (uma escrita por registro,
  em `ensureSongVariant`) — e, para a biblioteca que JÁ ESTÁ PRONTA, por uma
  passagem única no lançamento (`preencherAlbunsDosHinos`, v5.220, no molde do
  `desnumerarAlbunsBaixados`): os dois pontos de escrita cobrem uma biblioteca
  sendo MONTADA, e nenhum deles alcança a que já existe — música baixada não é
  baixada de novo, e coleção completa não é re-sincronizada. A ligação que a
  passagem lê já existia: o `folder` de todo registro baixado de uma coleção é
  o id dela. Ela corrige além de preencher, para uma coleção renomeada na
  origem não deixar capas com o nome velho.
  **Não há campo de AUTOR na fonte**: o LouvorJA publica nome, faixa e álbuns
  (ver `docs/FONTE-DE-DADOS-LOUVORJA.md` §5.1), e uma linha inventada na frente
  da congregação é pior que uma linha a menos.

#### O cartão de capa (v5.219)

O primeiro slide de todo louvor sincronizado. Ele era **uma linha** — o título
com o número colado na frente ("147. Ó ADORAI O SENHOR"), pintado em `--brand`,
no lugar exato onde a estrofe apareceria um segundo depois. Hoje são três peças
com pesos diferentes:

```
            ──── 147 ────        ← número, BRANCO, 5,8cqmin, entre dois fios
        Ó ADORAI O SENHOR        ← título, BRANCO, 8,4cqmin, até 3 linhas
        HINÁRIO ADVENTISTA       ← álbum, esmaecido, caixa alta espaçada
```

- **O número é branco, e os FIOS é que levam o acento** (v5.222). Ele nasceu em
  `--stage-accent` — 9,75:1 sobre o preto, aprovado por qualquer régua de
  contraste — e o operador o descreveu como "muito discreto no fundo escuro". As
  duas coisas são verdadeiras ao mesmo tempo, e é o que a régua não pega:
  contraste é razão de luminância, e num telão quem decide é **cor + corpo**. O
  número tinha o menor corpo do cartão somado à única cor não-branca da tela.
  A cor ficou onde não precisa ser lida — os dois fios —, com `background`
  explícito, porque com `currentColor` embranquecer o número teria embranquecido
  os fios junto.

- **O título deixou de ser o elemento colorido da tela.** Num telão de igreja o
  que precisa ser lido do fundo do salão é o NOME, e cor tirada de uma paleta de
  UI nunca rende o que o branco pleno rende (21:1 medidos contra os 9,75:1 do
  acento). O acento ficou nos fios (ver o item seguinte).
- **Cada peça só existe se houver o dado.** Um arquivo importado à mão não tem
  número nem álbum, e a capa dele volta a ser o título centralizado, que é a
  capa de sempre.
- **A caixa da capa CRESCE com o conteúdo** — a única do sistema que faz isso. A
  altura fixa (32cqh) existe para a moldura não pular de tamanho entre estrofes;
  na capa ela produzia o defeito oposto, e ele foi fotografado antes de ser
  corrigido: com o título em duas linhas, `num + título + álbum` somavam mais
  que a caixa, o flex encolhia os itens e a linha do álbum era desenhada POR
  CIMA da segunda linha do título. Aqui não há "próximo slide" com que casar a
  altura, então a caixa se ajusta; o teto de 60cqh e o `overflow: hidden`
  seguem sendo a garantia final, e `flex-shrink: 0` no número e no álbum faz o
  título ser o único a absorver a falta de espaço (ele é o único que sabe se
  cortar).
- **A preview espelha o cartão peça a peça.** É na capa que o operador confere
  se pegou o hino certo — uma capa diferente ali seria uma ilustração errada.
  `tools/display-smoke.mjs` trava as três peças e a saída delas na estrofe
  seguinte.

**Quebras de linha vêm da própria API, como `<br>` literal** dentro de
`lyric`/`aux_lyric` (confirmado no app-ja: ele usa `v-html` pra deixar o
navegador interpretar essas tags como quebra real). `buildLyricSlides`
passa `text`/`auxText` por `normalizeLyricText()`, que troca `<br>` (e
variações `<br/>`/`<br />`) por `\n` real — **não** por `innerHTML`/`v-html`
(sem risco de injeção: é só uma troca de string, o resto do texto continua
literal). O CSS (`.lyrics-line`/`.lyrics-aux` no Display,
`.pv-lyrics-line`/`.pv-lyrics-aux` na preview) usa `white-space: pre-line`
para respeitar esse `\n` — sem isso, a quebra pretendida pelo hino se perde
e o navegador quebra a linha sozinho, do jeito errado (ou mostra o `<br>`
literal na tela, já que `textContent` não interpreta HTML).

Imagens por estrofe (`imageOpfsPath`) são baixadas de verdade pro OPFS
(mesma pasta `folders/<coll.id>/`, `downloadCollectionImage`) — nunca URL
remota direta, preserva o offline. Uma linha sem imagem própria **herda a da
anterior** (fallback "grudento", igual ao app original); imagens iguais
entre linhas/variantes são baixadas uma única vez (`resolveImage`, cache por
URL compartilhado entre Cantado e Playback do mesmo hino, já que costumam
usar as mesmas imagens). Um hino tocado/adicionado antes de qualquer
sincronização em massa passa pelo mesmo `downloadCollectionSong` sob demanda
(ver "Resolução do id de mídia por variante" acima) — já sai dali com letra
sincronizada, igual a um hino baixado em massa.

#### Wi-Fi vs dados móveis

A sincronização em **massa** (`syncCollection`, baixar todas as músicas
pendentes de uma coleção de uma vez) fora do Wi-Fi **não é bloqueada — ela
pergunta**. Baixar um hinário inteiro pode ser bastante coisa, e só o operador
sabe se o plano dele aguenta; o que o app não pode é decidir sozinho por ele,
em nenhuma das duas direções.

Sem Wi-Fi confirmado (`isConfirmedWifi`, Network Information API —
`navigator.connection.type === 'wifi' || 'ethernet'`; sem suporte no navegador
cai em `'unknown'`, tratado como Wi-Fi **não** confirmado, postura
conservadora), a lista leve é atualizada sempre (metadados, barato) e o
download pesado abre um diálogo de duas saídas: **"Usar dados móveis"** ou
**"Só no Wi-Fi"**. A escolha vale **só para aquela sincronização daquele
álbum** — não vira preferência do app, e o próximo álbum pergunta de novo.

O diálogo mostra **quanto** falta: `estimatePendingBytes` devolve o mesmo
número que o painel do álbum (`medirColecao`), que é o ponto — a estimativa que
decide o gasto de dados móveis não pode divergir da que o operador acabou de
ler no card.

Um indicador (`.net-badge`, ícone de Wi-Fi inline — fora do subset da fonte)
aparece nas opções da coleção, atualizado ao vivo
(`connection.addEventListener('change', ...)`).

O download **individual** (tocar/adicionar uma música, `ensureSongDownloaded`)
não pergunta nada e é sempre permitido, em qualquer rede: é exatamente o hino
que o operador acabou de pedir — uma música, não um acervo —, e um diálogo a
cada toque seria só atrito. Na prática,
sem Wi-Fi o hinário vai sendo baixado aos poucos, só com o que de fato for
usado em cada culto, em vez de baixar tudo de uma vez usando dados móveis.

**Display** (`display/`): layer `#lyrics` (imagem de fundo
`object-fit:cover` + uma faixa central — `.lyrics-box`: no padrão visual de
"vídeo de louvor", cantos **retos** (`border-radius: 0`), **sem linha de
borda** (v5.42 — o contorno branco desenhava um retângulo que competia com a
letra; quem separa o texto da foto é a própria faixa escura) e sem
`box-shadow`; o fundo é `--lyrics-frame-bg` e **só existe no modo imagem**
(ver "Moldura só no modo imagem" abaixo), com `width`/`height` como fração do
container (`76cqw`/`32cqh`) — a legibilidade do texto vem da própria faixa,
não de um gradiente cobrindo a tela inteira, então funciona igual
independente da imagem por trás), inserido no DOM entre
`#video` e `#youtube`, mesmo `z-index:1` dos demais layers de mídia — a
cortina do wallpaper (hoje `z-index:3`, acima de toda mídia e do cartão de
texto) cobre/revela esse layer de
graça, **sem nenhuma mudança em `stage.js`** (letra é tratada como camada
paralela, mesmo padrão já usado pela ponte do YouTube). `hideLyrics()` é
chamado incondicionalmente no início do tratamento de `load` (antes do
atalho de YouTube) e em `stop`/`clear` — sem isso, trocar de um hino pra um
vídeo do YouTube não escondia a letra de verdade, só ficava mascarado por
sorte de ordem de pintura no DOM. Depois de `AVDB.getMedia(cmd.mediaId)` (já
existia), se `rec.kind==='audio' && rec.lyrics?.length` → `showLyrics(rec)`.
O avanço de slide reaproveita o `onTime`/`sendStatus()` já existente (sem
timer novo): `updateLyricSlide(t)` acha o último slide cujo `time <= t` e só
mexe no DOM quando o índice muda; a imagem de fundo só é re-resolvida (via
`AVDB.opfsGetFile` + object URL, com guarda de sequência tipo `loadSeq`) se o
`imageOpfsPath` realmente mudou entre um slide e o seguinte. `hymnName`/
`hymnTrack` do item atual ficam guardados à parte (`currentLyricsMeta`, não
só passados como parâmetro do `showLyrics` inicial) — sem isso, o slide de
capa perderia o título ao ser re-renderizado pelo tick de tempo (ex:
operador volta pra estrofe 0 depois de já ter avançado).

**Fundo preto vs. imagens dos slides** (`lyricsBgMode`, state `lyricsBg`,
comando `lyricsbg`): **preto é o padrão** — a imagem de cada slide (baixada
durante a sincronização, ver acima) só é de fato usada como fundo se o
operador escolher "Mostrar" no segmento **Imagens dos slides** do popup de
**Exibição** (`#lyricsBgSeg` → `setLyricsBg`/`renderLyricsBgSeg`). Até a v5.18
isso era um botão do mixer; ele saiu de lá porque é uma preferência de
aparência (como preenchimento e wallpaper, seus vizinhos agora), não um
controle de operação — e o lugar que abriu no mixer virou a **leitura
auxiliar** (ver seção própria). `applyLyricsImage(slide)` centraliza a decisão: calcula a "chave
efetiva" da imagem (`slide.imageOpfsPath` só se `lyricsBgMode==='image'`,
senão `null`) antes de decidir se resolve/revoga a `object URL` — o resto da
lógica (cache por chave, guarda de sequência) não muda. `setLyricsBgMode(m)`
troca o modo ao vivo e reaplica no slide atual (`applyLyricsImage`) sem
precisar esperar uma troca de estrofe. Persistido em `state.lyricsBg`
(lido no `restore()` do Display e no `load()` do Controle) e propagado ao
vivo pelo comando `lyricsbg` — mesmo padrão de `fade`/`fit`, mas tratado à
parte de `stage.handle()` (letra é camada paralela, não um comando do
stage). A preview aplica o mesmo modo em si mesma via `applyPvLyricsBg()`
(chamado direto em `cmd()`, sem esperar o Display confirmar nada).

**Moldura só no modo imagem**: o fundo semitransparente da caixa
(`.lyrics-box`/`.pv-lyrics-box`) só existe para dar contraste/legibilidade
contra uma imagem de fundo de verdade — no modo preto puro seria só uma
zona escura flutuando à toa sobre uma tela já preta, sem função nenhuma.
`applyLyricsBgClass()` (Display) / `applyPvLyricsBgClass()` (Controle)
ligam a classe `.imgbg` em `.lyrics-content`/`.pv-lyrics-content` só quando
o modo é `'image'` — o `background` de `.lyrics-box`/`.pv-lyrics-box`
fica `transparent` por padrão e só recebe `--lyrics-frame-bg` via
`.lyrics-content.imgbg .lyrics-box`/`.pv-lyrics-content.imgbg .pv-lyrics-box`.
Chamado em `setLyricsBgMode()`/`restore()` (Display) e em
`showPvLyrics()`/`applyPvLyricsBg()` (Controle) — cobre tanto a troca ao
vivo do botão quanto o estado inicial ao abrir um item já com o modo salvo.

**Preview do Controle (mesma visualização, em miniatura)**: a preview
**sempre espelha o telão** — já vale pra imagem/vídeo (via `stage.js`
compartilhado) e pra YouTube (segundo player, ver seção própria); letra
sincronizada segue o mesmo princípio universal do sistema. `#pvLyrics`
dentro de `#preview` reproduz a mesma estrutura visual do Display (fundo +
faixa central) com **exatamente os mesmos números**, porque são unidades de
container (`cq*`) e não `vw`/`vh`: relativas ao próprio container, elas são
invariantes de escala e dão a mesma composição na caixinha da preview e no
telão (ver "Redimensionamento por Container Queries" abaixo). O que continua
duplicado é a **folha** — as regras `.pv-*` existem à parte porque o container
é outro —, no mesmo padrão da preview do YouTube.
`showPvLyrics`/`hidePvLyrics`/
`renderPvLyricSlide`/`updatePvLyricSlide` espelham exatamente as funções do
Display, chamadas nos mesmos pontos: `cmd()` (`load`/`stop`/`clear`, em vez
do tratamento de comando do Display) e `previewTick()` (em vez do
`sendStatus()`). Não existe mais uma legenda de texto solta na
`.nowplaying` (`#npLyric`, removida) — a miniatura visual da preview já
mostra a composição real (fundo + posição do texto), tornando a legenda
redundante.

**Controle**: a navegação manual de estrofe é o **toque curto em ⏮/⏭** do
transporte (ver "Um par de botões, dois eixos"); as âncoras
`#slidePrevBtn`/`#slideNextBtn` continuam existindo, ocultas, como o ponto único
de estado e execução. `stepSlide(delta)` reaproveita o
**comando `seek` já existente** (sem novo tipo no protocolo) — pula pro
`time` do slide vizinho, e tanto o Display quanto a própria preview
sincronizam a letra sozinhos ao reagir ao novo tempo.

**Moldura de tamanho FIXO** (`.lyrics-box`/`.pv-lyrics-box`): a caixa não
cresce/encolhe conforme o texto do slide muda — `width`/`height` fixos (não
`max-width` + altura intrínseca) calculados para caber o pior caso real: as
letras do Hinário 2022 nunca passam de **2 linhas** por estrofe
(`-webkit-line-clamp: 2` em `.lyrics-line`/`.pv-lyrics-line`, tanto no slide
normal quanto no de capa; `.lyrics-aux`/`.pv-lyrics-aux` — rótulo curto de
seção, ex: "Refrão" — fica em **1 linha só**, não 2, o que também mantém a
caixa mais enxuta).

**Redimensionamento por Container Queries (`cq*`), não `vh`/`vw`**:
`.lyrics-content` (Display) e `.pv-lyrics-content` (preview) são
`container-type: size` — tudo dentro deles (moldura, fonte, padding, gap)
usa unidades `cqw`/`cqh`/`cqmin` (relativas ao TAMANHO DO PRÓPRIO
CONTAINER, não ao viewport). Isso resolve dois problemas que a versão
anterior (`vh`/`vw` + pisos/tetos em `rem`/`px`) tinha:
- **Descompasso em telas pequenas**: um piso de fonte em `rem` fixo parava
  de encolher enquanto a caixa (só em `vh`) continuava encolhendo — a fonte
  acabava maior que a caixa, cortando/bugando o texto. Unidades `cq*` puras
  não têm piso/teto absoluto — tudo escala junto, sempre, em qualquer
  tamanho de tela.
- **Fonte grande demais em proporção estreita**: a fonte usa `cqmin` (o
  menor entre a largura e a altura do container — análogo ao `vmin`, mas
  relativo ao container), não `cqh` puro. Só `cqh` cresce com a altura
  mesmo quando a largura é o fator mais apertado (ex: janela redimensionada
  em modo retrato) — a própria linha de texto (não a quebra intencional)
  deixava de caber, consumindo sozinha as 2 linhas do clamp e cortando fora
  a segunda linha (autorizada) inteira. `cqmin` encolhe a fonte junto com a
  dimensão mais apertada, sempre.
- **Padding do container NUNCA é em `cq*`** — e o motivo é mais forte do que
  parecia. Unidades de container escritas NO PRÓPRIO container **não se
  referem a ele**: resolvem contra o ancestral mais próximo que seja container
  e, não havendo nenhum, contra o **viewport**. No Display isso passa
  despercebido (o container preenche o viewport, então os números coincidem);
  na preview do Controle é destrutivo — a caixa tem ~130px de altura dentro de
  uma tela de ~980px, então `7cqh` virava 7% da TELA DO CELULAR, ou seja
  ~137px de padding vertical numa caixa de 128px. O content-box colapsava para
  zero e, com ele, a fonte (que é `cqmin` do container). **Era essa a causa
  real de o versículo aparecer espremido e cortado na preview.**
  A regra era seguida por `.lyrics-content`/`.pv-lyrics-content` mas estava
  violada por `.text-content`/`.pv-text-content`; hoje as quatro seguem o
  mesmo modelo: o container não tem padding percentual, a CAIXA é fração dele
  (`76cqw`/`32cqh` na letra, `86cqw`/`86cqh` no texto) e o que sobra vira
  margem sozinho via `align-items`/`justify-content: center`.

**Proporções calibradas por medição em pixel** de um vídeo de louvor de
referência (moldura ~76-80% da largura da tela / ~27-36% da altura; fonte da
letra com cap-height ~8,3% da altura da tela). Valores atuais: `.lyrics-line`
em `8cqmin`, `.lyrics-aux` em `4.2cqmin`, capa em `9.5cqmin`, caixa **fixa e
compacta** em `76cqw`/`32cqh`. **A preview usa EXATAMENTE os mesmos números**
(ver "Proporção da preview" abaixo): `cq*` é relativo ao container, portanto
invariante de escala — com a mesma proporção, os mesmos valores dão a mesma
composição numa caixa de 280px e num telão de 3120px. A preview já teve
valores próprios (`9.3cqmin`, `92cqw`/`60cqh`…), que eram compensação
empírica para a proporção errada, não uma necessidade. `overflow:hidden`
no `.lyrics-box`/`.pv-lyrics-box` junto do `-webkit-line-clamp` em
`.lyrics-line`/`.lyrics-aux` (`.pv-lyrics-line`/`.pv-lyrics-aux` na preview)
são a garantia final: qualquer letra maior que o clamp é cortada com
reticências, nunca estoura a moldura (isso ainda pode acontecer em
proporções extremas, tipo uma janela de teste em modo retrato — o Display é
sempre landscape em produção e a preview segue a proporção do telão, dentro de
um clamp, então essa situação não ocorre no uso real).

**Fundo preto sem ícone de "imagem quebrada"**: no modo preto (padrão), a
`<img>` de fundo (`#lyricsImg`/`#pvLyricsImg`) fica **`hidden`** de
propósito, em vez de só sem `src`. Isso sozinho **não bastava**: o seletor
`.lyrics-bg img`/`.pv-lyrics-bg img` (uma classe + um tipo, mais específico
que a regra `[hidden] { display:none }` da folha de estilo padrão do
navegador) vencia e mantinha `display:block` mesmo com o atributo `hidden`
ligado pelo JS — a `<img>` sem `src` continuava renderizando o ícone/borda
padrão de "imagem quebrada" (aparecia como uma linha branca de margem sobre
o preto), no Display e às vezes na preview. A correção precisa de uma regra
própria com especificidade suficiente: `.lyrics-bg img[hidden] { display:
none; }` / `.pv-lyrics-bg img[hidden] { display: none; }`. `.lyrics-bg`/
`.pv-lyrics-bg` têm `background: var(--stage-bg)` próprio (o preto de
verdade do palco, independente da `<img>`);
`applyLyricsImage`/`applyPvLyricsImage` alternam
`hidden` junto com `src` a cada troca de modo/slide. As duas folhas ganharam
`[hidden] { display: none !important }` no topo, o que torna essas regras
específicas redundantes — mas elas ficam, porque a regra genérica é a proteção
de fundo e a específica documenta o caso concreto que já falhou.

### Compartilhamento

Compartilhar mídia com o app cai direto no **Cronograma**. Quem recebe é o
`intent-filter` nativo (`ShareIntake.kt`), que entrega o share à ponte no
formato `{ files:[{name,type,url}], url, title }` — as URLs são servíveis
(`/saf/<token>`), nunca bytes. Do lado web, `checkPendingShare()` processa no
init (e `window.__avShareArrived()` empurra na hora quando o app já está
aberto):

> Isto substituiu o **Web Share Target** do modelo de PWA: o
> `manifest.json` do Controle declarava `share_target` (POST multipart em
> `share-target`, arquivos no campo `media`), o service worker interceptava o
> POST, gravava `pending-share` no IDB e redirecionava para o app. O formato
> do share e todo o processamento abaixo continuam idênticos — só a entrega
> mudou. (A leitura remanescente da chave `pending-share` no IDB, que nada
> escrevia desde a v5.48, saiu na limpeza da auditoria de agosto/2026.)

- **Arquivos** → importados como `addMedia` (com thumbnail).
- **URL do YouTube** (youtu.be, youtube.com — `watch?v=`, `/shorts/`, `/live/`,
  `/embed/`, `/v/`; ID de 11 chars validado) → `addUrlMedia` com
  `kind:'youtube'`, `youtubeId` e thumb `hqdefault.jpg` — cai direto no
  **Cronograma** (`imports`), pronto para tocar.
- **Outras URLs** → `kind` detectado pela extensão (`video`/`audio`/`image`/`url`).

#### O que chegou fica NA FRENTE do operador (v5.77)

Um compartilhamento é um pedido explícito e imediato — ninguém manda um vídeo
para o app de projeção "para depois". Mas o app pode estar em qualquer lugar
quando ele chega: na aba Bíblia, com o acervo aberto em tela cheia, dentro de
uma pasta dos Favoritos, com a seleção múltipla ligada. Até aqui `importShare`
trocava a variável `activeTab` por baixo de tudo isso e chamava `load()` — o
operador voltava para o app e via exatamente a tela que tinha deixado, **sem
sinal nenhum de que algo entrou**.

`focarImportado(id)` roda depois de todo import bem-sucedido:

1. **Sai do que está por cima**, nos dois modos: `exitSelection()` e o
   fechamento de **todos** os popups abertos, percorrendo a MESMA tabela
   `POPUPS` que o ✕, o toque no fundo e o botão voltar já usam — um popup novo
   entra numa linha e passa a ser fechado também por aqui.
2. **A preview em tela cheia só sai quando há TELÃO.** Sem telão conectado ela
   **é** a projeção (ver "Divergências"), e derrubá-la para mostrar uma lista
   tiraria do ar o que estiver em cena. Caro demais para um import — ali o item
   simplesmente espera no Cronograma.
3. Então cada modo faz o que aquele modo quer dizer:
   - **Simplificado → PROJETA na hora** (`send(id)`). Esse modo existe para
     quem não vai operar nada, e a lista sequer aparece nele: "adicionei ao
     Cronograma" não significaria nada. Quem compartilha um louvor com o app já
     conectado à TV quer aquilo no telão.
   - **Avançado → leva para o Cronograma** (`switchTab('imports')`), que é onde
     o item entrou, e deixa a decisão de projetar com o operador — que pode
     estar com outra coisa no ar neste exato segundo.

O alvo é o **primeiro** item que entrou (um share pode trazer vários arquivos),
e para isso `addMedia`/`addUrlMedia` — que já devolviam o registro — passaram a
ter o retorno aproveitado; `handleSharedUrl` também devolve o seu.

### Modos de repetição

Ciclo ao tocar no botão 🔁: `off → all → one → shuffle → off` (persistido em `repeat`).

**Tocar uma música nova zera o `one`** (`replacePlaylistWith`): tanto o toque
simples na biblioteca quanto o "tocar" de um resultado da busca substituem a
playlist por aquele item só — e, junto, desligam o `repeat='one'`. Repetir a
mesma música é uma escolha sobre a música que ESTAVA tocando; mantê-la
prenderia o item novo em laço, que é o oposto de "escolhi outra coisa para
tocar". `all` e `shuffle` ficam: são comportamentos da FILA e voltam a valer
assim que o operador acrescentar itens a ela.

| Modo | Comportamento ao fim do item |
|---|---|
| `off` | Playlist para; `currentId` permanece para replay manual |
| `all` | Avança para o próximo; ao fim da lista volta ao início |
| `one` | Recarrega e reproduz o mesmo item |
| `shuffle` | Avança para item aleatório (nunca repete o atual) |

---

### Séries do YouTube — coleções que NÃO vêm do LouvorJA (v5.228)

Uma **série** é um canal do YouTube que publica um episódio por semana e
organiza o ano em playlists por período. Ela vira um card da Biblioteca ao lado
dos hinários e dos álbuns, e usa a mesma casca: `collState`, `medirColecao`,
barra de peso, `syncCollection`.

**Há duas no catálogo** (v5.244): o **Provai e Vede 2026**
(`@provaievedeoficial`) e o **Informativo Mundial das Missões 2026**
(`@daniellocutor`). A segunda entrou com uma linha no catálogo e nenhum `if` por
recurso — mas ela **desmentiu três suposições** que só pareciam regras porque
havia uma série só, e as três viraram campo declarado:

| Campo | Provai e Vede | Informativo | Por quê |
|---|---|---|---|
| `periodo` | `mes` — "Provai e Vede - Agosto 2026" | `trimestre` — "Informativo \| 3º Trimestre 2026" | `mesDaPlaylist` devolve o mês em que o PERÍODO começa: ele ordena as playlists e é o PISO de quem não declarar data. Quem dá o mês de cada item é sempre a data do TÍTULO |
| `titulo` | `esquerda` — "Match point \| Provai e Vede 2026 (15/Ago)" | `nenhum` — "Informativo Mundial das Missões \| 15 AGOSTO 2026" | no segundo o título é a série + a data, e a história ("O Sonho de Enoc") vive na MINIATURA. Aplicar o padrão daria 52 linhas idênticas, que é o defeito que o padrão existe para corrigir — ao contrário |
| `futuros` | `mostrar` — a playlist do mês só traz o que já saiu | `esconder` — o canal sobe o trimestre e libera um sábado por vez | os que faltam ficam como "prioridade para membros": aparecem e não tocam. Corte pela DATA, com **3 dias de antecedência** (a quarta antes do sábado, v5.256 — o roteiro é montado na semana); sem data no título, nunca esconde |
| (nenhum) | — | — | o **idioma** virou recusa GLOBAL, não campo: ver `ehOutroIdioma` abaixo |

**O canal do Informativo publica a MESMA série em quatro idiomas**, lado a lado
na aba Playlists: "Informativo \| 3º Trimestre 2026" (PT), "Misiones \| 3º
Trimestre 2026" (ES), "Mission Stories \| 2º Quarter 2026" (EN) e "【聖工消息】
2026 第三季" (ZH). O prefixo separa as **playlists** — e não separa os **vídeos**:
em espanhol eles se chamam "Informativo Mundial **de las Misiones**", isto é,
começam com a mesma palavra. Daí `ehOutroIdioma`, irmão do `ehLibras`, aplicado
nos dois níveis: pela ESCRITA (cirílico, hebraico, árabe, tailandês, CJK,
hangul — um caractere basta, porque "【聖工消息】" não tem sílaba que dê para
procurar) e por MARCA (`misiones`/`mision`, `de las`, `missions?`), tudo contra
o `normalizar`. **É a exceção declarada à regra de ouro** ("o título é só
rótulo"): o erro que ela evita não é recuperável no sábado de manhã — é o
testemunho projetado em espanhol na frente da congregação.

> **O ÁUDIO em português é outra pergunta, e ela é do shell.** O YouTube dubla
> vídeo sozinho, e a dublagem não muda o título: ela é uma faixa a mais dentro
> do MESMO vídeo. Quem escolhe é `TrilhaAudio.kt` (v5.242), que decide pelo
> idioma **antes** do cliente e torna o português exclusivo quando ele existe.
> Nada do lado web tem como ver isso, e por isso nada aqui tenta.

**Mas o ITEM não é uma faixa de hinário — é um vídeo do YouTube** (v5.230). A
casca veio do LouvorJA e trouxe junto a premissa dele, "o toque baixa", que ali
está certa (poucos MB, e o acervo existe para ficar offline) e aqui é falsa por
duas ordens de grandeza: ~300 MB por episódio, ~15 GB no ano, e o vídeo do
sábado é visto uma vez. Então:

| O que | Onde | Como |
|---|---|---|
| toque no item | `openSongMenu` → `openYtMenu(serieComoYoutube(coll, s))` | a folha do YouTube, com `semSoAudio: true` (o seletor Vídeo × Só áudio some) |
| "Tocar agora" | `ytAcao(…, ['tocar'])` | **TRANSMISSÃO DIRETA** — `ytStream` → `shared/mse.js`, sem baixar |
| Modo Fácil | `simplePlaySong` desvia para o mesmo `ytAcao` | aquele modo não pergunta nada, e esperar 300 MB com o culto rodando não é opção |
| guardar offline | os destinos da folha (playlist · Cronograma · Favoritos) | um episódio por vez, pelo caminho de download do YouTube |
| card | `renderCollectionCard` / `buildCollectionOptions` | no grupo **"Arquivos oficiais"** do índice (v5.260), separado dos hinários; **sem botão de baixar em lote** com índice na mão; o de opções é "Atualizar a lista" (`syncCollection(coll, { soIndice: true })`), e a série sai de "Baixar toda a biblioteca" |

`downloadSerieItem` e o laço de `syncCollection` continuam existindo e corretos
— o que mudou é que nenhum toque de UI os alcança hoje. O que muda em relação a
uma coleção do LouvorJA é **de onde vem o índice e de onde vêm os bytes**.

| Peça | Onde | O quê |
|---|---|---|
| catálogo + REGRA | `controle/serie.js` (`window.AVSerie`) | **PURO**: sem DOM, sem rede, sem conhecer o `controle.js`. Decide quais playlists do canal são da série, recusa as de LIBRAS, extrai a data do título e ordena. Oráculo: `tools/serie.test.mjs` |
| descoberta | `AVNative.ytCanalPlaylists(canal)` | a **aba Playlists** do canal — `[{name,url,count}]` |
| expansão | `AVNative.ytPlaylist(url)` | os vídeos de uma playlist, com o título **CRU** |
| índice | `fetchSerieIndex` (controle.js) | monta `collState[id].songs` com `{ id_music, name, ytUrl, duration }` |
| download | `downloadSerieItem` (controle.js) | `ytFetch` → OPFS → `fileAdd` com `folder: coll.id`, `kind: 'video'` |

**Três pontos de integração que não são óbvios:**

- **`duration` é uma STRING "M:SS"**, e não segundos. É a forma que o LouvorJA
  publica, e adotá-la faz `parseTimeToSeconds`, `medirColecao`, `fracaoPeso` e a
  estimativa de download valerem sem uma linha nova.
- **`has_instrumental_music: false`, sempre.** Um vídeo não tem Playback; sem
  isso o `songVariantsNeeded` pediria uma segunda variante que nunca vai existir
  e o álbum jamais ficaria completo.
- **`lyrics: null` no registro.** `songVariantsNeeded` pergunta
  `fullRec.lyrics === undefined`: um registro sem o campo seria rebaixado a cada
  sincronização, para sempre, sem nada na tela que o explicasse.

**A mutação do índice é IN-PLACE**, pela mesma razão do `fetchCollectionIndex`
do LouvorJA: o `syncCollection` tira um snapshot do array e grava `fileIdFull`
nos objetos DELE conforme baixa. Recriar os objetos deixaria o snapshot
apontando para órfãos — os bytes iriam para o OPFS e os ids seriam descartados
no `setState` seguinte.

**O REGISTRO conta o que a varredura achou** (v5.249). O bloco "Séries do
YouTube (o que a regra achou)", no Registro de Configurações, traz por série os
parâmetros do catálogo, cada playlist da aba do canal com o VEREDITO (aceita,
com o mês do período; ou recusada, com o motivo), cada vídeo recusado, os que
entraram SEM data no título — o achado que não é recusa — e os nomes
resultantes, um por linha. Os nomes vão CRUS: o consumidor é quem ajusta a
regra, a distância — e a primeira varredura real já provou o ponto: ela achou um
episódio em português recusado pelo marcador de inglês (v5.252).

Dois recortes que os números reais impuseram: os canais têm **94 e 145**
playlists, então some da lista o que traz OUTRO ano no nome (contado por motivo,
nunca em silêncio) — um mês do ano corrente renomeado continua aparecendo, que é
o defeito que o bloco existe para achar; e a linha dos vídeos compara o que veio
com o que o canal **anuncia**, porque um episódio que a extração não traz não
erra em lugar nenhum: ele só não existe na lista.

A peça que o torna confiável é `AVSerie.avaliarPlaylist`/`avaliarVideo`: o
motivo sai de quem DECIDE, e `mesDaPlaylist`/`itensDaPlaylist` são consumidores
das mesmas funções. Um diagnóstico que reexplica por conta própria diverge no
primeiro ajuste. A ordem das perguntas virou contrato porque é ela que o texto
mostra; e as duas metades (aba do canal × varredura dos vídeos) trazem datas
próprias, porque a assinatura pula a extração e só uma delas é de agora.

**O preço da antecedência tem remédio** (v5.256): nesses três dias o vídeo pode
ainda não estar público. `serieComoYoutube` anexa `avisoSeFalhar` (e o card da
série como endereço) enquanto `AVSerie.diasAte(...) > 0`, e o caminho de falha do
`ytAcao` a usa no lugar de "não foi possível baixar" — em dois lugares, porque
"Tocar agora" fecha a Biblioteca e os destinos que guardam não.

**A lista do Informativo é função do DIA** (v5.255), e isso entra em dois
lugares: `indiceVencido` vence o índice na virada do dia (só nas séries com
`futuros: 'esconder'`) e o dia entra na **assinatura** das playlists. Sem o
segundo, a economia devolveria a lista de ontem — sem o episódio de hoje —
carimbada como de hoje, que é o sintoma da v5.233 por outra porta.

**O índice falha com EXCEÇÃO, nunca com lista vazia.** Quem chama já trata isso
como "sem internet — falha ao atualizar" e preserva o índice anterior; devolver
zero itens apagaria da tela a série inteira que o operador já tem baixada, por
uma oscilação de rede.

**A DATA tem DUAS formas, e o mesmo episódio usa as duas** (v5.230): a compacta
entre parênteses ("… 2026 (03/Jan)") e a por extenso ("… 2026 sábado 3
janeiro"). `dataDoVideo` tenta as duas nessa ordem, e `montarData` exige que o
nome **seja** um mês em vez de só começar como um — sem isso "3 marcos" viraria
3 de março. Quando nenhuma casa, o vídeo **entra do mesmo jeito**, sem
identificador de data e no fim do mês: é a regra de ouro em ação, e é o erro
recuperável em vez do episódio ausente.

O Informativo escreve a mesma forma por extenso sem o dia da semana na frente
("15 AGOSTO 2026") — e ela já era lida, sem uma linha nova. **O que ele expôs
foi um defeito de v5.230 que ninguém tinha visto:** o ordinal opcional estava
escrito `[ºo°]?` depois de um `\s*`, então em "03 outubro" ele casava o "o" do
mês como ordinal e entregava "utubro". O regex ACERTAVA — a captura satisfaz
tudo o que ele pede, logo não há retrocesso — e quem recusava era o `montarData`,
lá fora e calado. O `o` do ordinal agora tem de estar **colado no dia** (`3o`), e
a varredura tenta **todos** os candidatos do título em vez de só o primeiro.
Outubro é o único mês que começa com "o", e é o primeiro do 4º trimestre: o mês
inteiro teria entrado sem data e no fim da lista.

O resto — as seis armadilhas de nomenclatura, por que a descoberta é a aba do
canal e não uma busca, e a regra de ouro ("a playlist prova o pertencimento, o
título é só rótulo") — está no topo do `serie.js` e na seção "Séries do YouTube"
do `CLAUDE.md`.

---

## Camada de Texto (Bíblia · Mensagens · Letra)

O sistema serve **texto no telão** por seis provedores que compartilham um
**modelo padronizado** de camada paralela (mesmo padrão do YouTube: um layer
que a **cortina do wallpaper** — sempre por cima de tudo — cobre/revela "de
graça", sem tocar em `stage.js`). São eles:

| Provedor | Driver | Origem do texto | Camada física |
|---|---|---|---|
| **Bíblia** | manual (operador avança versículo) | banco LouvorJA | `#text` / `#pvText` |
| **Mensagens** | manual (operador avança mensagem) | `state.messages` (texto puro) | `#text` / `#pvText` |
| **Letra avulsa** | manual (operador avança estrofe) | acervo de letras (`songLyricStanzas`) | `#text` / `#pvText` |
| **Cronômetro/relógio/timer** | **derivado do relógio** (sem avanço) | o próprio tempo (`chronoReading`) | `#text` / `#pvText` |
| **Sorteio** | **derivado** (rolo até assentar) | faixa numérica ou lista de opções (`drawReading`) | `#text` / `#pvText` |
| **Letra sincronizada** | **temporizado** (segue o `currentTime` do áudio) | música do LouvorJA | `#lyrics` / `#pvLyrics` |

> **Mensagens vive na aba Ferramentas** (v5.31), como uma das ferramentas do
> seletor: lista de avisos salvos, "+ Nova mensagem" e — quando há uma
> projetada — "Tirar do telão" (`hideMessage` → `text-hide`, que encerra só a
> Camada de Texto; um áudio de fundo segue tocando). Tocar numa mensagem
> projeta e a linha fica marcada, então passar de um aviso a outro não exige
> reabrir nada — que era o atrito do bottom-sheet anterior. Com a mensagem fora
> do ar mas a sessão viva, os botões de slide só MOVEM a seleção (mesma regra
> da Bíblia).

### Letra avulsa (projetar a letra SEM tocar a música)

`lyricSession = { title, stanzas: [string], idx, projecting }`, aberta pela
folha rápida de uma música do acervo ("**Apenas a letra**" — ver
`hymnResultRow`). Serve o caso em que a congregação canta **ao vivo**
(instrumentistas na frente, ou hino sem gravação no aparelho): o telão precisa
da letra, e não pode ter um áudio tocando por cima nem trocar de estrofe sozinho
no tempo de uma gravação.

- **Não é uma terceira variante de `playSongVariant`.** Uma variante toca um
  arquivo, e aqui não há arquivo nenhum: a letra vem de `songLyricStanzas`, que
  lê o acervo de letras e funciona para músicas **nunca baixadas**.
- **Sem letra no aparelho, o caminho é o MESMO das outras duas opções da folha**
  (v5.64): baixar a música — que traz a letra junto — e tentar de novo, com o
  indicador na preview dizendo "Baixando a letra". Na v5.63 isto era um beco sem
  saída: "Letra ainda não baixada." e nada acontecia, num item que o operador
  acabara de escolher. Se ainda assim não vier letra, aí sim o aviso
  ("Letra indisponível para esta música").
- **Uma estrofe = um slide**, e o comando é `text` com `mode: 'message'` — o
  telão já sabe desenhar um bloco de texto centrado, que é exatamente o que uma
  estrofe é. Um modo novo no protocolo exigiria shell e bundle novos dos dois
  lados sem mudar um pixel do resultado.
- **A passagem é do operador**, pelos mesmos ⏮/⏭ que já passam mensagem e
  versículo: `slideTarget()` devolve `'songlyrics'` (à frente de `'message'` e
  `'bible'`), `stepSlide` cai em `lyricStep` e `applySlideLimits` desabilita nos
  extremos. É a **ausência** de passagem automática que o operador está pedindo
  ao escolher esta opção.
- **É texto manual como os outros:** `clearManualText()` a encerra junto com as
  demais, projetar Bíblia/Mensagem/cronômetro/sorteio a substitui, um `load` de
  áudio a mantém e um `load` visual a encerra. `resendSceneToDisplay` a reenvia
  na reconexão do telão, e `pushNowPlaying` conta ela como **cena** (o serviço de
  mídia sobe, e o processo com a `Presentation` deixa de ser descartável).
- O now-playing mostra `<nome da música> · <n>/<total>`: sem o número, duas
  estrofes seguidas dariam o mesmo cabeçalho e o operador perderia a única
  referência de onde está.

**Bíblia e Mensagens são literalmente o MESMO cartão** (`#text` no Display,
`#pvText` na preview) — mesmo comando `text`/`text-hide`, só o campo `mode`
distingue (`'verse'` mostra a referência dourada abaixo do texto; `'message'`
usa fonte maior/mais linhas e sem referência). A **Letra** é o **provedor
temporizado** da mesma família — fica no seu layer dedicado `#lyrics` porque
carrega recursos que o cartão de texto puro não representa (imagem de fundo por
estrofe, slide de capa, texto auxiliar); mesclá-la ao `#text` arriscaria a
sincronização de tempo (o recurso principal), então ela permanece separada,
mas segue o mesmo modelo de cortina/fades.

**Independência do áudio** (o ponto-chave do modelo unificado): a Camada de
Texto é **desacoplada do ciclo de vida da mídia do stage** — `showText`/
`showPvText` **não** chamam `stage.clear()`/`preview.clear()`. Assim é possível
**projetar um versículo (ou mensagem) enquanto um áudio toca em segundo plano**:

- Um comando `text`/`text-hide` nunca para a mídia do stage.
- Com a Camada de Texto ativa, o **transporte** (`play`/`pause`/`seek`/`volume`/
  `mute`) continua indo pro stage — controla o **áudio de fundo** (o texto não é
  afetado); o `view` liga/desliga a cortina por cima do texto.
- Um `load` de **áudio** troca o som de fundo **mantendo** o texto; um `load` de
  **visual** (imagem/vídeo/YouTube), `stop` ou `clear` **encerram** o texto e
  seguem o fluxo normal (o Display checa o `kind` do registro em `load` pra
  decidir; o Controle usa `keepText = pvTextActive && currentItem.kind ==='audio'`).
- A **letra sincronizada não coexiste** com a Camada de Texto manual:
  `showLyrics`/`showPvLyrics` retornam cedo se um texto manual estiver em cena
  (a letra pertence a UMA música tocando; um versículo/mensagem manual tem
  precedência sobre a letra do áudio de fundo).
- **Sair do texto sem nada em cena volta ao WALLPAPER, não ao preto**
  (`restoreSceneAfterText`/`restorePvSceneAfterText`). `showText` abre a
  cortina para o cartão aparecer; se não há mídia carregada — ou a que havia já
  terminou (item só na playlist, ou tocado antes) — ninguém a fechava de volta,
  e o telão ficava preto. Agora, quando não há YouTube tocando e
  `!getCurrent() || hasEnded()`, a cortina sobe (`coverIn(false)`). No Controle
  a fonte disso é o **stage** (`preview.getCurrent()`), não `currentItem`: este
  último é o item SELECIONADO e continua apontando para a música terminada — era
  exatamente ele que fazia a preview achar que ainda havia algo em cena.

### Botão voltar do aparelho (`__avBack`)

O shell entrega o botão voltar do Android a `window.__avBack()`; devolver `true`
significa "consumi o toque", `false` faz a Activity minimizar (a projeção segue
viva — sair do app por engano num culto derrubaria o telão). A escada completa,
o prazo de resposta e o porquê de a decisão ser do lado web estão em
[`CLAUDE.md`](../CLAUDE.md), seção "Botão voltar: fecha antes de minimizar".

Do lado web importam duas coisas:

- **A tabela `POPUPS` é a fonte única.** Ela já registrava o ✕ e o toque no
  fundo; agora registra também o voltar. Um popup novo entra numa linha e passa
  a ser fechável pelos três caminhos — duas listas divergiriam no primeiro que
  alguém esquecesse de acrescentar na segunda.
- **A hierarquia não é reimplementada.** O degrau de sub-tela chama
  `navigateBack()`, a mesma função do `#backBtn`, que já sabe que a Bíblia sobe
  leitura→capítulos→livros e que a raiz dos Favoritos volta ao Cronograma.

`__avBack` **não** usa `history`: no navegador não há botão voltar do sistema, e
a função simplesmente nunca é chamada lá. A base continua rodando nos dois
contextos sem guarda nenhuma.

### Acervo de LETRAS (baixado no arranque, v5.36)

A letra deixou de depender do áudio: é baixada junto com o índice, como
informação padrão do acervo. Antes, só quem tinha a música no aparelho podia
buscá-la — e quem procura "aquele hino que fala em…" quase nunca tem os 600
baixados.

**Dois acervos, de propósito.** `files[].lyrics` são **slides** (tempo, imagem,
capa) e só existem com áudio baixado — é o que a projeção sincronizada consome.
`state.lyrics:<collId>` é só **texto**, por música, e existe para toda música do
índice — é o que a busca consome. Fundi-los faria a busca carregar tempos e
caminhos de imagem à toa, e faria o download do índice arrastar o peso dos
slides. O índice de busca (`buildLyricIndex`) lê os **dois**, chaveado por
`collId:id_music`, com o acervo de texto tendo precedência.

- **Caminho de graça primeiro.** Se a API mandar `lyric` já no índice do acervo
  (o app-ja busca por esse campo — §5.3 de `FONTE-DE-DADOS-LOUVORJA.md`),
  `fetchCollectionIndex` colhe dali e a música nem entra na fila. Verificado
  contra uma API simulada: com o campo presente, **zero** requisições
  `music_{id}`.
- **Todo o acervo indexado** (v5.38): hinários **e** álbuns, a mesma cobertura
  do índice de músicas. A busca por trecho não teria por que conhecer metade do
  acervo — "aquele hino que fala em…" e "aquela música do álbum que fala em…"
  são a mesma pergunta, e o operador não sabe (nem deveria precisar saber) de
  qual coleção veio o que procura.
- **Hinários primeiro na fila.** São o que mais se busca, e a fila pode levar
  alguns minutos na primeira abertura: se ela for interrompida (app fechado,
  rede caiu), o que já desceu é o que mais importa. Verificado: os 20 primeiros
  pedidos são todos do hinário, com os álbuns já indexados na fila.
- **Agrupado por `id_music`, não por (coleção, música).** A MESMA faixa aparece
  em várias coletâneas, e `music_{id}` é o mesmo documento para todas — uma
  busca por par custaria três requisições para uma faixa em três álbuns. Aqui
  custa uma, e o resultado é distribuído para todas as coleções que a contêm. É
  o que torna varrer o acervo inteiro viável. Medido: 3 álbuns de 10 faixas com
  uma compartilhada + 20 hinos = **48 requisições**, não 50, e nenhuma música
  pedida duas vezes.
- **Adia só em rede móvel CONHECIDA** (`networkType() === 'cellular'`), e a
  assimetria com `syncCollection` é deliberada: lá descem centenas de MB de
  áudio e perguntar é o certo; aqui é JSON de texto, poucos MB no hinário
  inteiro — menos que UMA música que o app baixa com um toque sem perguntar.
  Usar `isConfirmedWifi()` seria pior que inútil: `navigator.connection.type`
  não existe em boa parte dos aparelhos e devolve `'unknown'`, então exigir
  Wi-Fi confirmado faria o recurso **nunca rodar** na maioria deles.
- **Incremental e resumível.** Só busca o que falta; reabrir o app não refaz
  nada. Verificado: 40 requisições na primeira abertura, **0** na segunda, e
  exatamente **2** depois de apagar duas do acervo.
- **`0` marca "não tem letra"**, e é diferente de ausência: sem essa marca,
  toda abertura tentaria de novo as mesmas centenas. Mas **falha de rede não
  marca** — senão um wi-fi que oscilou tiraria o hino da busca para sempre.
- **Gravação em LOTES** (`LYRIC_BATCH`, 25): são centenas de músicas, e
  reescrever o blob inteiro a cada uma tornaria o download quadrático.
- **A lista de sujas é tirada ANTES de gravar, não depois** (v5.41). Os 6
  workers correm juntos: durante o `await` da gravação os outros continuam
  marcando coleções, e o `clear()` que rodava *depois* apagava essas marcas.
  A letra ficava só na memória — e se aquela coleção já tivesse terminado,
  nunca mais era marcada e a gravação final a ignorava. Medido na API
  simulada: **48 de 48 músicas buscadas, 45 de 50 pares no disco**, com um
  álbum inteiro pela metade, em ~1 de cada 6 aberturas. Com hinário só o
  defeito quase não aparecia (uma coleção, sempre com item seguinte para
  remarcá-la); varrer o acervo inteiro (v5.38) — muitas coleções pequenas
  acabando no meio dos flushes — foi o que o trouxe à tona.
- **Indexa TODA linha**, inclusive `aux_lyric` e estrofes sem `show_slide` — ao
  contrário de `buildLyricSlides`, que filtra o que vira slide. Uma estrofe que
  não é projetada continua sendo letra da música, e para buscar isso só ajuda.
- **Guardado por ESTROFE desde a v5.43** — `[{ a: rótulo|null, l: [linhas] }]`.
  O banco já entrega assim: cada entrada de `music_{id}.lyric` **é** uma
  estrofe, com `order` e `aux_lyric` (o rótulo: "Refrão", "1ª Estrofe"). Até a
  v5.42 guardávamos só as linhas achatadas — o formato de que a BUSCA precisa —,
  e a visualização da letra completa herdava esse achatamento: trinta linhas
  seguidas, sem respiro e sem dizer onde entra o refrão, que é exatamente o que
  o operador procura quando abre a letra. Guardar por estrofe não custa nada à
  busca (`lyricFlatLines` achata na hora de indexar, e o rótulo entra junto —
  "refrão" é palavra que se digita); o caminho inverso, inferir estrofes de
  linhas soltas, **não existe**. Por isso a mudança é no armazenamento, e não
  só na tela.
  - `lyricStanzas` normaliza os dois formatos: um registro legado vira UMA
    estrofe sem rótulo — que é exatamente o que ele já era na tela.
  - O legado entra na mesma fila do que nunca foi baixado (`songsMissingLyric`):
    uma passagem única, em segundo plano e só em wi-fi, como a primeira carga.
    `LYRIC_NONE` (0) **não** entra — já sabemos que a música não tem letra, e o
    formato não muda isso.
  - Quem já tem a música BAIXADA nem espera a fila: os slides do arquivo
    (`stanzasFromSlides`) sempre tiveram a divisão, com `auxText` por slide — ela
    só era descartada. Por isso `songLyricStanzas` prefere os slides quando o
    acervo de texto ainda está no formato antigo.
- Roda como fase 3 do `autoRefreshCollections`, fire-and-forget, com o progresso na
  notificação pelo mesmo `withBgWork` do resto do trabalho de massa.

### O acervo É o estado padrão da busca (v5.43)

Com o campo vazio, a busca listava as primeiras 60 músicas de um acervo de
milhares: uma fatia sem critério, que não responde pergunta nenhuma. Quem abre a
lupa **sem saber o nome** quer folhear — e folhear é por coleção, que é o
recorte que o próprio banco dá e que a aba Álbuns desenhava (ela saiu na
v5.44 — ver abaixo).

Então a abertura da busca passou a ser esse navegador: os mesmos cabeçalhos de
categoria e os mesmos cards. **É a mesma função** — `renderCollectionsList(alvo, redesenhar)` ganhou o elemento-alvo e o
callback de redesenho como parâmetros. Duas cópias divergiriam no primeiro
ajuste de categoria, e o operador veria dois acervos diferentes conforme por
onde entrou.

A busca ganha assim **dois níveis**, e isso muda três coisas:

- **Digitar troca o nível.** `searchIsBrowsing(q)` é `!q`: com
  texto, volta a listar músicas exatamente como antes; apagando, o acervo
  retorna. Nenhuma outra regra da busca mudou.
- **Tocar num card abre a coleção NO PRÓPRIO CARD** (acordeão), com o acervo
  inteiro ainda visível em volta. Até a v5.44 era uma segunda tela, com um
  voltar no cabeçalho e um degrau próprio em `__avBack`; entrar e sair para ver
  o que tem dentro de um álbum é caro quando a pergunta é "em qual deles está
  aquela música?". Uma coleção aberta por vez — duas listas de centenas de
  faixas empurrariam o acervo para fora da tela.
  - A lista sai **inteira**, sem teto: quem abriu um álbum quer percorrê-lo.
    O teto de 60 é da BUSCA, que varre milhares de músicas a cada tecla.
  - As linhas são as mesmas `hymnResultRow` da busca, **sem o subtítulo da
    coleção** (`semColecao`) — repetir "Album 1" nas dez faixas é ruído; o card
    em volta já diz de quem elas são.
  - **A engrenagem desceu para dentro do aberto** (`.coll-open-cfg`), larga e
    rotulada. Manutenção — sincronizar, excluir, peso — é o que se procura
    depois de já estar olhando o álbum, não antes; na barra ela era um ícone
    mudo disputando o toque com a própria linha, que agora abre a coleção.
    *(Superado na v5.72: ela voltou para a barra, mas no lugar do botão de
    baixar — que aberto não tem o que decidir. Ver "A engrenagem volta para a
    barra".)*
  - **A barra da coleção aberta GRUDA no topo** (`position: sticky`). Sem isso,
    percorrer as 600 faixas de um hinário empurrava a própria barra — e a seta
    que fecha — para fora da tela: a única seta à vista passava a ser a de
    OUTRO card, e tocá-la abria aquele em vez de fechar este. Do lado de quem
    opera, "toquei na seta e não fechou". Grudada, a seta da coleção em que se
    está fica sempre ao alcance, e o nome dela também.
  - **Baixar/cancelar voltou para a barra** (`.coll-bar-dl`). Com a engrenagem
    dentro do aberto, baixar um hinário passava por expandir 600 linhas —
    caro para a ação mais comum do acervo.
- **O campo pega o foco na abertura, NOS DOIS MODOS** (v5.131). No simplificado
  isso vale desde a v5.90: lá o acervo é aberto por um botão que se chama
  BUSCAR, o modo inteiro existe para encurtar caminho, e quem entra por ali sabe
  o que quer.

  No avançado a regra era o contrário, com um argumento razoável — a abertura é
  um acervo para folhear, e o teclado cobre metade dele. O que a operação
  mostrou é que quem abre a Biblioteca está atrás de UMA música: o preço da
  regra antiga era um toque a mais toda vez, no meio do culto, para alcançar um
  campo que já estava na tela. Folhear continua a um gesto de distância —
  fechar o teclado é o gesto mais conhecido do Android.

  O `focus()` é SÍNCRONO, dentro do gesto do toque: adiado (um `setTimeout`) ele
  sai da interação, e aí o WebView aceita o foco mas **não abre o teclado** — o
  pior resultado possível, porque na leitura do código parece que funcionou.

#### Tela cheia, e a ação de maior alcance no título (v5.45)

- **O popup ocupa a tela toda** (`.popup-sheet--full`, sem cantos
  arredondados). É a tela em que o operador passa mais tempo antes do culto —
  folhear álbuns, abrir letras, decidir o que baixar — e a folha de 80vh
  deixava uma faixa morta no topo enquanto a lista rolava apertada embaixo.
  Cantos retos porque cantos arredondados anunciam "há algo atrás", e aqui não
  há.
- **"Baixar todo o acervo" subiu para o cabeçalho** (`renderAcervoTotal`,
  mesmo `syncGroup` e mesma chave `grp:Todo o acervo`). Dentro da lista ela
  saía de vista ao primeiro rolar — justamente quando o operador está
  decidindo entre baixar tudo e escolher um álbum. `renderCollectionsList`
  ganhou `opts.semTotal` para não desenhá-la duas vezes.
  - **O chip de status do lote é ESTREITO, e as frases têm de caber nele**
    (v5.75). O cabeçalho é uma linha flex de cinco itens (ícone, título,
    status, baixar, ✕) em 390px: sobram ~180px para o texto. `.popup-total`
    tinha `flex-shrink: 0`, então uma frase comprida não encolhia — empurrava
    o **✕ para fora do sheet** e o acervo ficava sem saída. Duas correções, e
    as duas são necessárias:
    - **Estrutural:** `.popup-close` ganhou `flex-shrink: 0` (o ✕ é intocável),
      `.popup-total` passou a `flex: 0 1 auto; min-width: 0` (é ele quem cede,
      e o `.coll-group-count` dentro dele já corta em reticências) e um
      `max-width: 58%` para o TÍTULO não ser a próxima vítima.
    - **Textual:** as frases de `syncGroup` foram encurtadas até caberem sem
      reticências — "Álbum 3/12" (era `… · <nome do álbum>`, largura
      imprevisível e a causa direta do estouro), "OPFS indisponível",
      "Já completo", "3 álbuns sem rede", "Erro no download", "Completo",
      "Aguardando Wi-Fi". O nome do álbum em download não se perdeu: ele está
      no card do próprio álbum e na notificação do sistema.
- **O contador de itens saiu.** Na abertura ele contava coleções e durante a
  busca, resultados: o mesmo número dizendo coisas diferentes, ao lado de um
  título que já explica a tela. O contador que importa é o `N/M` de baixados,
  que está em cada card e agora também no cabeçalho.
- **Os botões de baixar formam UMA coluna** (v5.47). O do cabeçalho de grupo
  não tem seta de acordeão depois dele, então caía ~40px à direita do botão do
  card logo abaixo. `.coll-group` reserva à direita exatamente o que o card
  gasta depois do seu botão — borda (1px), padding (`.7rem`), seta (20px) e o
  gap antes dela (`.55rem`) — e os dois botões passaram a ter o mesmo alvo de
  34px, porque alinhados na coluna eles também precisam do mesmo tamanho,
  senão os centros discordam. Medido: todos com centro em x=351.
- **Os hinários NÃO baixam em lote** (v5.46). São as duas maiores coleções do
  acervo (~1.100 músicas juntas): um botão só disparando as duas é um download
  que ninguém dimensiona antes de tocar, e que não dá para parar pela metade
  sem perder o outro. O cabeçalho "Hinários" mantém o contador (ele informa) e
  perde o botão (`opts.semBotao`); cada hinário baixa pelo botão do próprio
  card. As categorias de álbuns seguem com o download em lote — ali cada álbum
  tem uma dezena de faixas.
- **As opções da coleção abrem ACIMA do acervo** (v5.46). Os dois são
  `.popup-backdrop` com o mesmo `z-index`, então quem vencia era a ordem do
  documento — e o acervo, declarado depois, cobria as opções por inteiro: o
  toque na engrenagem parecia não fazer nada. `#collPopup` ganhou um degrau
  (`z-index: 210`) e foi para o FIM de `POPUPS`, que passou a ser ordenada de
  baixo para cima: o voltar percorre a tabela de trás para a frente, então
  fechar o acervo antes das opções as deixaria órfãs no ar.
  *(O popup em si saiu na v5.72 — as opções viraram um painel dentro do card —,
  mas a ordenação de `POPUPS` que ele motivou ficou, e é a que o `#songMenuPopup`
  e o `#folderPopup` usam hoje.)*

#### E a aba de Álbuns saiu (v5.44)

Com o acervo desenhado dentro da busca, a aba virou uma segunda porta para a
mesma tela — e duas portas para o mesmo lugar, numa barra de quatro botões, é
espaço gasto sem informação nova. A **lupa** passa a ser a única entrada:
`activeTab` nunca mais vale `'albums'`, e `TAB_ORDER` (que decide a direção do
deslize entre abas) perdeu a entrada.

Nada de função se perdeu — é a mesma `renderCollectionsList`, com os mesmos
cards, cabeçalhos de grupo e botões de sincronizar. Duas peças foram junto:

- **A linha de uso de disco** (`renderStorageUsage`) ganhou `alvo` e a condição
  `valido()` e acompanhou o acervo. Ela mede OPFS + IDB, e quem enche o disco é
  o download de música: o lugar dela é onde se decide baixar — e apagar. Segue
  também em Favoritos, onde já estava.
- **O refresh periódico** (`renderCollectionsNow`, que acompanha o progresso de
  um download em curso) passou a redesenhar o popup — e **só quando ele está
  mostrando o acervo**. Redesenhar por baixo de uma lista de músicas tiraria do
  lugar exatamente o que o operador está mirando.

### Letra completa no resultado aberto (v5.37)

Tocar num resultado da busca abre a **letra completa** da música em acordeão. É
o que fecha o ciclo da busca por trecho: achar o hino e conferir se é ele mesmo,
sem tocar nada e sem sair da lista. (Na v5.37 ela vinha abaixo de uma faixa de
seis botões de ação; desde a v5.63 esses botões viraram dois, moraram na própria
linha, e o acordeão guarda só a letra.)

- **Montada só ao ABRIR, e uma vez só.** Montá-la para todos os resultados
  encheria a lista de centenas de nós de texto que ninguém pediu — e a lista é
  reconstruída a cada tecla digitada.
- **A linha que casou com a busca fica marcada** (fundo dourado) e recebe
  `scrollIntoView`. O operador digitou aquele trecho justamente para achá-lo;
  numa letra de 30 linhas, procurá-lo de novo com os olhos é trabalho que o app
  pode poupar. A marca usa FUNDO, não só cor: precisa ser achada de relance,
  com o bloco rolando.
- **Rola por dentro**, com teto de `40vh`. Solta, uma letra de 40 linhas
  empurraria os resultados seguintes para fora da tela — e o operador perderia
  de vista justamente a lista que estava percorrendo.
- **Sem letra, explica por quê.** Desde a v5.38 a letra cobre todo o acervo, e
  a ausência passou a significar sempre a mesma coisa — a fila do arranque
  ainda não chegou nesta música (ou falhou). A mensagem é única.
- A fonte é `songLyricStanzas`, que lê os mesmos dois acervos da busca (texto
  primeiro, slides do arquivo baixado como complemento) e devolve ESTROFES, não
  linhas soltas — é o formato em que o LouvorJA publica e em que o app guarda
  (ver "A letra é uma lista de ESTROFES").

### Busca dentro da LETRA (v5.35)

"Qual é o hino que fala em *firme nas promessas*?" é a pergunta que o operador
faz de verdade, e até a v5.34 a busca só respondia por título e número. Agora o
mesmo campo (`#hymnSearchInput`) também varre o texto das letras.

**A letra já está no aparelho.** `buildLyricSlides` a grava no registro do
arquivo (store `files`) quando a música é baixada — então o índice sai de **uma
leitura do IDB**, sem nenhuma requisição, e funciona offline, que é o estado
normal no meio de um culto.

- **Alcance** (desde a v5.38): **todo o acervo indexado**, hinários e álbuns —
  ver "Acervo de LETRAS" acima. Não depende mais de a música estar baixada.
- **Título ANTES de letra, sempre.** Quem digita "Firme nas Promessas" quer o
  hino de mesmo nome no topo, não os quinze que citam a expressão numa estrofe.
  São dois grupos concatenados (`porNome` + `porLetra`), e quem casa por título
  **nem chega a consultar** a letra.
- **A linha que casou aparece no resultado** (`.hymn-lyric-hit`, em itálico
  dourado com barra à esquerda, para se ler como citação e não como mais um
  subtítulo). Sem ela o item apareceria sem nenhuma relação visível com o que
  foi digitado, e o operador teria que abrir um por um para descobrir se é o
  hino certo.
- **Mínimo de 3 caracteres** (`LYRIC_MIN_Q`) para a busca entrar na letra: com
  menos, "de"/"ao" casariam em quase todo hino e afogariam os resultados por
  título, que são a maioria dos casos.
- **A estrofe é quebrada em linhas** na indexação (o `<br>` da API já virou
  `\n` em `normalizeLyricText`), para o trecho exibido ser uma linha e não o
  bloco inteiro.
- **O índice é construído sob demanda e redesenha ao ficar pronto**:
  `renderSearchResults` é síncrona (roda a cada tecla) e não pode esperar o IDB.
  É invalidado (`invalidateLyricIndex`) no ponto exato em que uma letra nova é
  gravada — invalidar em vez de reconstruir evita pagar a leitura no meio de uma
  sincronização em massa.
- **Custo medido**: com **3.000** letras indexadas — a escala do acervo inteiro
  —, **16,5 ms por tecla** incluindo o render dos resultados. A varredura é `String.includes` sobre um texto
  normalizado uma única vez por música.
- **Acento não atrapalha**: índice e consulta passam pelo mesmo
  `normalizeForSearch` (NFD + remoção de diacríticos), então "criacao" acha
  "criação".

### Ferramentas: o seletor de ferramenta

A aba reúne quatro ferramentas, e três delas empilhadas **não cabiam** numa tela
de celular: a página ganhava rolagem vertical, e o que a rolagem escondia era
justamente a ferramenta que não estava em uso.

A v5.31 tentou um **acordeão** e ele foi trocado na v5.32: cobrava três
cabeçalhos permanentes de altura para entregar o mesmo resultado, e ainda
deslocava o painel para baixo conforme a posição da ferramenta na pilha — o
Sorteio começava três linhas mais abaixo que as Mensagens. Hoje é um **seletor
no topo** (`.misc-switch`), uma linha só:

- **Uma ferramenta ativa por vez** (`miscTool`), e **só ela é montada** no DOM —
  é o render dela que religa o seu timer de painel. As outras não existem, então
  não há laço batendo em nó invisível.
- **O painel ativo começa sempre no mesmo lugar**, o que importa para a memória
  muscular de quem opera sem olhar.
- **O trilho do seletor é PREENCHIDO no segmento ativo**, ao contrário dos
  segmentados de dentro das ferramentas (Relógio/Cronômetro/Timer,
  Número/Texto), que são contornados. São dois níveis de escolha empilhados na
  mesma tela; parecidos demais, leriam como um só.
- **Ponto vermelho no segmento = aquela ferramenta está projetando.** Trocar de
  ferramenta **não** tira do telão a que estava no ar, e sem o ponto descobrir
  qual é exigiria visitar cada uma. O ponto (`.misc-tab-live`, 7px) é
  `--danger-text`, **não** `--live`: ele é um gráfico que carrega informação
  (piso de 3:1), e o vermelho cheio da paleta — escuro por construção, ver R2 —
  não chegava lá em fundo nenhum. Com o tom claro ele passa nos dois fundos que
  encontra (**7,08:1** sobre o trilho e **3,29:1** sobre o `--accent-fill` do
  segmento ativo), e o anel claro que existia só no segmento ativo saiu: sobre
  um ponto claro ele não separava nada.
- **`#library` não rola nesta aba** (`.lib-misc`): quem administra a altura é o
  seletor + painel, e o painel ativo rola por dentro se precisar. Com a rolagem
  da lista ligada, a página inteira voltaria a rolar e o rodapé sairia da base.
- Verificado nas três ferramentas: **zero rolagem**, horizontal ou vertical.

**O rodapé são as duas ações que MANDAM ALGO PARA A TELA**, lado a lado
(`renderFoot`): o **microfone** e **"Projetar no telão"**. São as únicas com
efeito fora do celular, e tê-las sempre no mesmo ponto vale mais do que a
proximidade com os controles que as configuram — o operador aprende UM lugar em
vez de um por ferramenta. De quebra, o botão de projetar parou de descer
conforme o painel cresce (no sorteio de texto ele ficava abaixo da lista).

- O microfone é uma **barra**, não mais um disco de 132 px: é o único controle
  daqui com urgência real (push-to-talk pode ser preciso no meio de uma frase),
  e como barra custa ~56 px de altura oferecendo área de toque **maior**.
- **"Projetar" age sobre a ferramenta ATIVA** (`miscProjectState`). Em Mensagens
  ele não pode projetar sozinho — falta saber QUAL, e isso se escolhe tocando na
  lista —, então fica **inerte com um `title` que explica**; some não, porque o
  botão é um ponto fixo da tela e sumir faria o microfone pular de largura a
  cada troca. Com uma mensagem já selecionada ele **reexibe** a que ficou: é a
  ação natural depois de um "Tirar do telão", e sem ela o operador teria que
  caçar a linha certa de novo.

> **Vazamento horizontal (v5.31).** A faixa "de/até" do sorteio empurrava a aba
> além da largura da tela. Causa: o padrão de um item flex é `min-width: auto`,
> que o impede de encolher abaixo da largura intrínseca do conteúdo — e um
> `<input type="number">` sem `size` mede ~200 px por conta própria. Dois campos
> de 200 px não cabiam em 394 px. `min-width: 0` nos dois níveis (o campo e o
> wrapper) resolve. É o vazamento clássico de flexbox, e vale para qualquer
> input futuro dentro de uma linha `.misc-row`.

### Ferramentas: cronômetro · relógio · timer

Terceiro provedor da Camada de Texto, na aba **Ferramentas** (junto do microfone).
O que vai ao telão é o **mesmo cartão** da Bíblia e das Mensagens
(`mode: 'chrono'`), e isso não é economia de CSS: herdando o cartão, herda
junto toda a regra de convivência já madura — `load` de **áudio** mantém o
cronômetro no ar (louvor de fundo sob a contagem de abertura é o uso normal),
`load` **visual** o encerra, a cortina do wallpaper o cobre, `text-hide` o tira
sem parar o som. Um layer próprio teria que reimplementar as quatro e
envelheceria separado.

**O comando carrega um DESCRITOR, não um valor.** Quem conta o tempo é cada
lado, localmente, a partir de uma origem comum:

```js
{ type:'text', mode:'chrono', sub:'<legenda>', view:'visual',
  chrono: { mode:'clock'|'stopwatch'|'timer',
            running, startAt:<epoch ms>, baseMs:<acumulado nas pausas>,
            durationMs:<alvo do timer>, secs, h12 } }
```

Mandar o texto pronto a cada segundo colocaria ~3.600 comandos/hora no
barramento só para mexer dois dígitos — e deixaria o telão **parado** se um
deles se perdesse. Os dois WebViews são o mesmo processo no mesmo aparelho,
então `Date.now()` é a mesma base dos dois lados (no navegador, idem).

A consequência que mais importa é a **reconexão**: como o número é derivado do
descritor, `resendSceneToDisplay` reenviar o mesmo objeto devolve o cronômetro
**no segundo certo**, não no ponto em que a conexão caiu — sem estado nenhum a
ressincronizar. É o mesmo princípio do `load` + posição já usado para a mídia.
Verificado recarregando o Display com um timer estourado em cena: volta
exibindo exatamente o mesmo valor do Controle.

- **O relógio nasce em `HH:MM`, 24 h** (v5.31). No telão o que interessa é a
  hora; o dígito dos segundos mudando o tempo todo puxa o olho para um número
  que não informa nada. Quem precisar liga no chip. Preferências gravadas antes
  da v5.31 carregam `secs: true` só porque era o padrão de então — por isso
  `chronoPrefs` ganhou um `v`, e um registro sem ele tem o `secs` ignorado:
  respeitar uma "escolha" que ninguém fez faria a mudança não chegar a ninguém.
- **`baseMs` existe porque pausar precisa congelar o acumulado.** Com `startAt`
  sozinho, retomar perderia todo o trecho anterior.
- **O timer NÃO congela em zero** — passa a contar em negativo, em vermelho
  (`.chrono-over`). Num culto, "estourou por 4 minutos" é a informação que se
  quer; um `00:00` parado não distingue "acabou agora" de "acabou há muito".
- **`tabular-nums` não é enfeite.** Com algarismos de larguras diferentes, a
  linha inteira se desloca a cada segundo (o "1" é bem mais estreito que o "8")
  e o número parece tremer — o defeito clássico de relógio digital em web.
- **A fonte é dimensionada pelo CONTEÚDO** (`--ch`, o número de caracteres, que
  o tick escreve no elemento; o CSS faz `min(24cqmin, calc(86cqw / var(--ch) /
  0.66))`). Um tamanho fixo teria que servir ao pior caso — `12:34:56 PM`, 11
  caracteres, numa tela 4:3 — e aí `09:59` sairia pequeno à toa; generoso
  demais, o pior caso vazaria da tela. Medido em 5 proporções (16:9, 4:3,
  16:10) × 6 strings: nenhum vazamento, e 259 px de corpo em 1080p contra os
  69 px que um valor fixo conservador daria.
- **O laço só existe quando há o que animar**: relógio sempre; cronômetro/timer
  só em marcha. Pausado é um número parado, e `hideText` derruba o laço junto
  com o cartão — fora de cena ele só gastaria bateria reescrevendo um nó
  invisível.
- **O painel do Controle tem laço próprio**, com vida ligada à aba: o operador
  precisa ver a contagem correr **antes** de projetar. Sair da aba não para a
  contagem (ela vive no estado), só o laço do painel.
- **Cronômetro e sorteio dividem UM laço só** no cartão (`liveKind`/`liveDesc`
  no Display, `pvLiveKind`/`pvLiveDesc` no Controle). O cartão é um só, então
  dois timers escrevendo no mesmo nó nunca seriam ambos corretos — bastaria um
  esquecer de parar o outro para o sorteio ser sobrescrito pelo relógio. Com um
  registro único isso é estruturalmente impossível, em vez de depender de
  lembrar. (No PAINEL são dois laços, e ali está certo: são duas seções lado a
  lado, cada uma com o seu próprio nó.)
- **Um provedor por vez.** `projectChrono` encerra Bíblia e Mensagem, e as duas
  encerram o cronômetro — é um cartão só. Enquanto ele está no ar,
  `slideTarget()` devolve `null`: sem essa guarda, os botões de estrofe cairiam
  na letra do áudio de fundo, que está **escondido atrás do cartão** — o
  operador apertaria "próxima estrofe" e a música saltaria sem nada mudar na
  tela.
- **Cronômetro e sorteio CONTAM como cena** para `pushNowPlaying` (o que
  alimenta a sessão de mídia e a notificação nativa — ver `CLAUDE.md`).
  Ficavam de fora: `renderNowPlaying` já os tratava como cena (escreve
  "Cronômetro" no título e chama a função), mas ali `active` dava `false` e o
  Kotlin derrubava a sessão. O efeito não é a projeção cair no meio — uma vez
  que qualquer mídia foi tocada, `currentId` nunca mais volta a `null` e a cena
  segue ativa —, é o caso da sessão **recém-aberta**: projetar a contagem
  regressiva de abertura sem ter selecionado mídia nenhuma **não levantava** o
  serviço em primeiro plano, e o processo (com a `Presentation` junto) seguia
  descartável sob pressão de memória exatamente durante os dez minutos em que o
  operador minimiza o app para esperar.
- **Só as PREFERÊNCIAS persistem** (`state.chronoPrefs`: modo, duração, formato
  do relógio, legenda). Uma contagem em curso não sobrevive ao fechamento do
  app de propósito: restaurar um cronômetro que "correu" com o app fechado
  mostraria um número sem significado.
- A ferramenta vive só no **modo avançado**, como o microfone: o simplificado
  existe para quem quer conectar a tela e tocar um louvor.

### Ferramentas: sorteio

Quarto provedor da Camada de Texto, na mesma aba. Sorteia **número** (faixa
de/até) ou **texto** (lista de opções — nomes, prêmios, perguntas).

**Quem sorteia é só o Controle.** Se cada tela rodasse o próprio `Math.random`,
o telão e a preview anunciariam **ganhadores diferentes** — o pior defeito
possível aqui, e público. O resultado viaja pronto no descritor; o que cada
lado faz sozinho é só a animação até ele.

```js
{ type:'text', mode:'draw', sub:'<legenda>', view:'visual',
  draw: { kind:'number'|'text', value, seed, rollUntil,
          min, max, pool:[<amostra do ruído>] } }
```

- **O rolo é local, e determinístico.** `rollUntil` diz até quando rolar; o
  quadro exibido sai de `rnd32(seed + quadro)` — um PRNG semeado (mulberry32),
  não `Math.random`. É isso que faz telão e preview piscarem **os mesmos
  valores**: a preview existe para mostrar o que o telão mostra, e dois ruídos
  diferentes a tornariam uma tela paralela em vez de um espelho. Medido: 8 de 8
  quadros idênticos durante o rolo.
- **O quadro sai do tempo QUE FALTA**, não do decorrido — assim ele é função
  pura de (descritor, relógio), e um telão que reconecta **no meio do rolo**
  entra no mesmo quadro dos demais e assenta no mesmo ganhador. Verificado
  recarregando o Display durante a animação.
- **Semente nova a cada rodada**: sem ela o ruído seria idêntico toda vez, e um
  sorteio que "roda igual" parece decidido de antemão.
- **A amostra do ruído é limitada** (`DRAW_POOL_CAP`, 40). O que pisca antes de
  assentar não é o sorteio — mandar uma lista de 500 nomes pelo barramento a
  cada rodada seria pagar caro por decoração.
- **"Não repetir" (padrão)** guarda os já sorteados e os exclui das próximas
  rodadas; a lista fica **à vista**, em ordem inversa, porque numa rifa a
  pergunta seguinte é sempre "quem já saiu?" e o contador sozinho não responde.
  Esgotado, o botão desabilita em vez de repetir alguém.
- **Números não materializam a faixa.** Amostragem por rejeição enquanto sobra
  folga, varredura só quando aperta: um "de 1 até 100000" viraria um array de
  100 mil strings a cada sorteio, e no fim (quase tudo já sorteado) a rejeição
  é que ficaria cara. A faixa é limitada a `DRAW_SPAN_CAP` (100000).
- **O resultado e o histórico PERSISTEM** (`state.drawPrefs`), ao contrário do
  cronômetro. Um cronômetro restaurado mostraria um tempo que não correu; um
  sorteio não depende do relógio — e perder "quem já foi sorteado" porque o app
  fechou no meio faria a rodada seguinte repetir alguém, que é exatamente o
  erro que "não repetir" existe para impedir.
- **Trocar número↔texto zera o histórico**: "12" e "Maria" não pertencem ao
  mesmo conjunto, e manter os dois faria o filtro excluir valores que nem podem
  sair.
- **Verificado uniforme**, que é a promessa central: 6.000 sorteios em 1–6 dão
  X² = 9,59 (corte de 1% = 15,09) e 5.000 em cinco nomes dão X² = 5,09 (corte
  13,28).

### Entradas e saídas de camada sempre com fade (`fadeLayerIn`/`fadeLayerOut`)

A mídia do stage e a cortina do wallpaper já têm as próprias transições (ver
`stage.js`). As camadas **paralelas** — letra, texto manual e a imagem de fundo
das estrofes — não passam por lá, e por isso apareciam/sumiam com corte seco.
`fadeLayerIn`/`fadeLayerOut` dão a elas o mesmo tratamento, com
`LAYER_FADE_MS` = 320 ms. **Nada entra ou sai da projeção sem transição.**

As quatro funções (`fadeLayerIn`, `fadeLayerOut`, `fadeContentIn` e o
`findSlideIndex` da letra) vivem em **`shared/stage.js`**, expostas como
propriedades de `createStage` — mesmo padrão já usado por `rampSteps`/
`MUTE_RAMP_TIME`. Elas eram idênticas linha a linha nos dois apps (`pvLayerIn`/
`pvLayerOut`/`pvFadeIn` no Controle) e **não têm calibração própria nenhuma**:
o que difere entre preview e telão é só o CSS, em `cq*` relativo a cada
container. Cada app mantém os aliases locais (`pvLayerIn = createStage.
fadeLayerIn`, etc.) para o resto do código não mudar. As camadas que de fato
carregam calibração continuam duplicadas, de propósito.

- `fadeLayerIn` **não repete o fade** se a camada já estava visível (guarda
  `wasHidden`) — trocar de versículo não faz o cartão inteiro piscar; quem
  anima aí é só o texto (`animateFadeIn`/`pvFadeIn`, 260 ms).
- `fadeLayerOut` só esconde no **término natural** da animação (`onfinish`):
  se um `fadeLayerIn` cancelar o fade no meio (a camada voltou), esconder ali
  apagaria o que acabou de entrar.
- **`hideLyrics(fade)` adia o teardown da imagem de fundo** em `LAYER_FADE_MS`.
  A `<img>` é FILHA da camada: revogar a object URL e escondê-la de imediato
  faria o fundo sumir por trás de um texto ainda esmaecendo. Mesma coisa em
  `hidePvLyrics(fade)`.
  - **O teardown é cancelado EXPLICITAMENTE quando a letra volta** (o timer
    fica guardado em `lyricTeardownTimer`, e `showLyrics` o limpa). A guarda de
    sequência sozinha **não bastava**: se a estrofe que volta usa a MESMA
    imagem (`key === lyricImgKey` — o caso normal quando um versículo entra e
    sai em menos de `LAYER_FADE_MS`, e também quando dois hinos compartilham o
    mesmo `imageOpfsPath`), `applyLyricsImage` devolve cedo e **não**
    incrementa a sequência; o teardown então disparava com o `seq` ainda
    válido, revogava a object URL em uso e apagava o fundo da letra que acabara
    de reaparecer, deixando-a sobre preto até a próxima troca de estrofe.
  - **A revogação vem ANTES da guarda de sequência**, e de propósito: quando o
    caminho de troca já zerou `lyricImgUrl`, aquela URL não é mais de ninguém —
    nenhum outro caminho vai revogá-la. Deixá-la atrás do guard significava que
    uma imagem nova entrando em menos de `LAYER_FADE_MS` (estrofe seguinte, ou
    o operador religando o fundo pelo comando `lyricsbg`) invalidava o callback
    e **o blob da foto ficava retido** até o WebView do telão morrer — uma vez
    a cada ocorrência, o culto inteiro. Só o `removeAttribute('src')` continua
    atrás do guard, porque aí o `src` já é de outra imagem.
- **`renderLyricSlide` só REGISTRA o índice depois de validá-lo.** Gravá-lo
  antes fazia um índice inexistente (`findSlideIndex` devolvendo -1 num tempo
  anterior ao primeiro slide, ou um `showLyrics` com a lista ainda vazia) ficar
  marcado como "já renderizado" — e se o mesmo índice voltasse a ser pedido, a
  guarda de topo devolvia cedo e o slide certo **nunca era pintado**.
- `hideText`/`hidePvText` **não limpam o texto** ao sair: apagá-lo na hora
  deixaria o cartão vazio visível durante todo o fade. O próximo `showText`
  sobrescreve.
- Chamadas com `fade=false` continuam existindo de propósito: quando algo
  NOVO já assume a cena no mesmo instante, a transição é da mídia que entra.

### Trecho sem letra: a moldura some (`.nolyric`)

Solos, introduções e trechos instrumentais têm slide com tempo mas sem texto a
cantar. `renderLyricSlide`/`renderPvLyricSlide` ligam a classe `.nolyric` em
`.lyrics-content`/`.pv-lyrics-content` quando a linha principal está vazia **e**
o auxiliar está oculto; o CSS esmaece a moldura inteira
(`.lyrics-content.nolyric .lyrics-box { opacity: 0 }`, com `transition` na
própria `.lyrics-box`), deixando só a imagem de fundo. Uma caixa escura vazia
parada no meio do telão durante um solo não comunica nada. Volta esmaecendo
quando houver o que cantar.

### Fim natural: a capa do hino não pode piscar

No fim da faixa o stage zera o `currentTime` (preparando o replay) e continua
emitindo tempo. Seguir isso re-renderizaria o slide 0 — a **capa do hino**
aparecia por um instante antes de o wallpaper cobrir. Duas guardas simétricas:

- **Display**: `sendStatus()` só chama `updateLyricSlide` se `!stage.hasEnded()`
  (`hasEnded` foi adicionado à API pública de `stage.js`); o `onEnded` esmaece
  a camada (`fadeLayerOut(lyricsEl)`) mantendo os slides carregados.
- **Controle**: a flag `pvLyricsEnded` trava `updatePvLyricSlide` — ligada pelo
  `onEnded` da preview **e** pelo `media-ended` remoto (o Display pode chegar ao
  fim primeiro), desligada em `cmd()` no próximo `load`/`play`/`seek`.

Terminada a faixa, a letra congela no último slide; o replay a traz de volta
(`updateLyricSlide`/`updatePvLyricSlide` refazem o `fadeLayerIn` se a camada
estiver escondida).

O restante desta seção detalha o provedor **Bíblia**; as **Mensagens** são um
provedor mínimo (CRUD de texto puro em `state.messages` + `projectMessage`/
`msgStep`, análogos a `startBibleReading`/`bibleStep`), e a **Letra** tem sua
própria seção ("Letra sincronizada").

**Excluir uma mensagem mexe na SESSÃO, não só no array** (`deleteMessage`), e
são dois casos distintos:

- **A projetada** precisa ser **tirada do ar antes** de a sessão morrer:
  `clearMsgSession()` sozinho zerava `msgSession` sem mandar `text-hide`, e o
  aviso apagado continuava projetado no telão e na preview. Como a sessão
  morria junto, o botão "Tirar do telão" ficava **desabilitado** e a linha
  sumia da lista — o operador não tinha mais nenhum caminho na aba para tirar o
  texto do ar, só ⏹ Parar ou projetar outra coisa por cima. Hoje é
  `hideMessage()` (que envia o `text-hide`) e **depois** `clearMsgSession()`.
- **Uma ACIMA da projetada** exige reindexar `msgSession.idx`. Sem isso ele
  passava a apontar para a vizinha errada — ou para fora do array: "Mensagem 3"
  numa lista de duas, nenhuma linha marcada como ativa, e "Projetar no telão"
  caindo no guard `idx >= messages.length` de `projectMessage`, ou seja, um
  botão que não faz nada e não explica por quê.

## Bíblia (aba `bible`)

Aba própria para **selecionar e projetar textos bíblicos**, com os dados vindos
do mesmo banco público do LouvorJA (ver `docs/FONTE-DE-DADOS-LOUVORJA.md` §5.6).
O cliente é `controle/bible.js` (`window.Bible`, JS puro), que reaproveita
o transporte de `louvorja.js` (`Louvorja.fetchList`) — sem novas credenciais.

### Duas fontes de dados

- **Estrutura offline (`Bible.BOOKS`)**: os **66 livros** do cânon (abreviação +
  nome + nº de capítulos + testamento `ot`/`nt`), fatos fixos embutidos em
  `bible.js`. Alimentam a seleção de livros/capítulos **sem rede nenhuma**, mesmo
  antes de qualquer download.
- **Online (baixada na 1ª vez que for usada)**: a lista de **versões**
  (`pt_bible_version` → `state.bibleVersions`), a lista de **livros** com o
  `id_bible_book` real (`pt_bible_book` → `state.bibleBooks`, só pra casar os ids
  — a exibição vem de `Bible.BOOKS`) e o **texto dos capítulos**
  (`bible_{v}_{b}_{c}` → cache `state['bible:<v>_<b>_<c>']`). `ensureBibleMeta()`
  busca versões+livros em segundo plano (no `init` e ao entrar na aba); é
  silenciosa (sem rede, mantém o cache). `bibleBookId(idx)` usa o id online
  quando há, senão cai em `idx+1` (ordem canônica).

**Download da versão INTEIRA na 1ª vez** (`ensureBibleVersionDownloaded`,
disparado por `enterBibleTab()` ao entrar na aba e ao trocar de versão): em vez
de baixar só o capítulo tocado, ao usar a Bíblia pela primeira vez o app baixa
**todos os 1189 capítulos** da versão selecionada em segundo plano — resumível
(pula o que já está em cache), concorrência limitada (`runLimited` com
`NET_CONCURRENCY`). O texto é leve (só versículos, sem mídia), então o volume total é modesto. O progresso
(`bibleDl`, memória) aparece **só dentro do popup de seleção de versão**
(`.bible-ver-status` por versão: "✓ Completa offline" / "Baixando N/1189…" /
"Baixa ao usar" — `refreshBibleDl` re-renderiza a lista enquanto o popup está
aberto), **sem disputar espaço com a leitura**; ao terminar sem falhas marca
`state['bibleComplete:<v>']` pra não refazer (cacheado em memória em
`bibleCompleteVersions`, populado pra **todas** as versões no `ensureBibleMeta`).
A leitura por capítulo (`loadBibleChapter`) continua baixando sob demanda como
fallback se o operador abrir um capítulo antes de o download em massa chegar
nele.

### A BÍBLIA BASE, garantida na abertura (v5.242)

Até aqui o download em massa **só** era disparado por alguém ENTRAR na aba
Bíblia (ou trocar de versão). Quem nunca entrou ficava com o caminho sob
demanda: um capítulo por vez, conforme o uso, com a rede da igreja no meio do
culto como única rede disponível. Foi o relato do operador — *"ela está baixando
aos pedaços conforme o uso"* — e era o oposto do que a aba faz assim que é
aberta uma vez.

`garantirBibliaBase()`, chamada no `init()` sem `await` (como o
`autoRefreshCollections`), garante **uma** versão offline por conta do app. O
paralelo com o hinário é exato num ponto e não no outro: lá o que chega sozinho
é a LISTAGEM, porque o áudio pesa; aqui o texto de 1189 capítulos é leve o
bastante para vir inteiro — e vir inteiro é o que torna a Bíblia utilizável sem
rede nenhuma.

**A versão é a que o app já escolheria** (`pickDefaultBibleVersion`: a Almeida
Revista e Atualizada, e a primeira disponível se ela não estiver no banco) — e
**não** `bibleVersionId`, que é a ESCOLHA do operador. A distinção é o recurso
inteiro: esta é a base que o app garante, não a preferência de quem opera. Quem
trocou de versão continua tendo a dele baixada pelo caminho de sempre, ao entrar
na aba; as duas convivem porque `ensureBibleVersionDownloaded` é resumível e
idempotente (uma versão já completa custa uma leitura de estado e volta).

**O freio de 25 falhas SEGUIDAS** (`BIBLE_DL_DESISTE`) nasceu junto, e nasceu
porque a automação o exigiu. Enquanto a varredura só começava por um toque na
aba, insistir até o fim era barato: havia alguém olhando. Automática na
abertura, um lançamento offline — ou com o Wi-Fi da igreja sem uplink, que este
projeto descreve como o ambiente normal — pagaria 1189 requisições fadadas ao
erro, com serviço em primeiro plano, wake lock e notificação, **a cada
abertura**. Vinte e cinco erros seguidos não são uma oscilação (a concorrência é
de 6: um blip produz meia dúzia): são a rede fora. Ele não grava
`bibleComplete`, então a versão segue pendente e a varredura é retomada no
lançamento seguinte — que é o que ela já fazia depois de qualquer interrupção.

O oráculo é o `tools/boot-nativo.test.mjs` (o único que sobe a base COM a
ponte), com o banco do LouvorJA de mentira e a ARA em **segundo** lugar na lista
de versões de propósito: `pickDefaultBibleVersion` cai na primeira disponível
quando não acha a ARA, e uma lista com ela na frente aprovaria os dois
comportamentos.

**O que já está em cache é descoberto com UMA leitura de chaves**
(`AVDB.stateKeys('bible:<v>_')` → `Set`), não com 1189 `getState`. Cada
`getState` abre a própria transação e desserializa o capítulo INTEIRO (~30
versículos de texto) só para testar existência — e essa varredura era refeita a
cada entrada na aba enquanto a flag `bibleComplete` não estivesse marcada. Uma
chave só existe quando o capítulo foi gravado com versículos (os dois pontos de
escrita conferem `vs.length`), então a presença da chave basta como teste.
Consequência boa: se a varredura mostrar que **nada falta**, a flag é marcada
ali mesmo — antes ela só era gravada com `failed === 0`, e uma única falha de
rede (o Wi-Fi da igreja) condenava a versão a revarrer para sempre.

**A varredura é identificada por SEQUÊNCIA (`bibleDlSeq`), não pela versão.**
Cada invocação ganha um `runSeq` monotônico, e os workers comparam com ele.
Comparar `versionId` era **reversível**: trocar de versão e **voltar** fazia os
workers da varredura antiga, ainda em voo, passarem no teste de novo e
retomarem em paralelo com a nova. Pior, a antiga terminava primeiro e — como os
capítulos que ela pulava saíam por um `return` sem contar falha — gravava
`bibleComplete` sobre uma varredura incompleta: flag **persistida**, versão
nunca mais completada. Com a sequência, um worker superado sai contando falha,
que é o que impede a marca de completude indevida.

**Persistência offline (não some entre sessões)**: os capítulos ficam no
IndexedDB (`state`, durável por natureza — sobrevive a fechar/reabrir o app e à
troca de bundle por OTA, que só substitui arquivos servidos). Além
disso, `enterBibleTab()` **e `garantirBibliaBase()`** pedem
`navigator.storage.persist()` — **a mesma
proteção do sync de músicas/pastas** — para o browser não descartar a origin sob
pressão de espaço (é origin-wide e idempotente). O download é **resumível**:
cada capítulo é gravado assim que chega, então uma interrupção não perde o que
já baixou — a reabertura pula o que está em cache e continua de onde parou.

> O texto de cada versículo pode conter marcação HTML (o app original renderiza
> com `v-html`); aqui `Bible.stripHtml()` extrai **texto puro** (troca de string,
> **sem** `innerHTML` — `<br>`→espaço, tags removidas, entidades comuns
> decodificadas), no mesmo espírito do `normalizeLyricText` da letra.

**Versão padrão: Almeida Revista e Atualizada** (`pickDefaultBibleVersion` casa
por nome — "revista e atualizada"/"RA"/"ARA"; senão a 1ª disponível). A troca de
versão **não tem botão próprio**: ela é o primeiro segmento da barra de
referência da tela de leitura (`part('Versão', …)`, uma `.bible-ref-part` como
Livro/Capítulo/Versículo), e o toque abre o popup `#bibleVerPopup` com a lista
— que não fica mais toda exposta em chips. **É na tela de LEITURA**, não na de
livros: ali a grade precisa da altura inteira. Persistido em
`state.bibleVersion`.

`changeBibleVersion` recarrega o capítulo atual na nova versão (mantendo o
versículo) e dispara o download da nova versão inteira. Duas coisas que ela
precisa fazer, e ambas nasceram de defeito:

- **Invalidar o `bibleLoadSeq`.** Sem isso, um capítulo lento pedido *antes* da
  troca voltava *depois*, passava na guarda de sequência (que não havia mudado)
  e sobrescrevia `bibleChapterData` com os versículos do capítulo/versão
  **antigos sob o rótulo dos novos** — e `startBibleReading` monta a sessão a
  partir daí, projetando o versículo errado com a referência certa. É o mesmo
  papel do `loadSeq` do stage.
- **Zerar o estado de erro/carregamento da grade.** Uma falha antiga ("Não foi
  possível baixar este capítulo") continuava na metade de baixo da tela mesmo
  com o capítulo novo já carregado e no ar.

### Seleção em "tabela periódica" (três telas)

`renderBible()` despacha por `bibleScreen` (`'books'`|`'chapters'`|`'reading'`),
renderizando dentro de `#library` uma **grade de células no estilo de uma
tabela periódica** (`.bible-grid` + `.bible-cell`): cada célula é um "símbolo"
(a abreviação do livro, ou o número do capítulo/versículo). O grupo/divisão
canônica de cada livro vem do campo `g` em `bible.js`, concatenado numa classe
(`'bg-' + b.g`: `lei`, `historicos`, `poeticos`, `pmaiores`, `pmenores`,
`evangelhos`, `atos`, `paulinas`, `gerais`, `apocalipse`) — por isso essas
classes **não aparecem literais em lugar nenhum fora do CSS**, e não são código
morto. Cada ladrilho é **tinta escura + faixa lateral de 3px** com a matiz do
grupo, não mais um bloco saturado: ver "Ladrilhos da Bíblia" no Design System
para o porquê e as medições. Sem número de índice e **só a abreviação** (sem o
nome completo, fonte maior). A grade de livros (`.bible-grid--books`)
**preenche a altura disponível** (11 linhas em `1fr`) pra caber **sem scroll**.

**Capítulo e versículo convivem numa tela só** (`'chapters'`), dividida na
vertical (`.bible-split`): em cima a grade de **capítulos**, embaixo a de
**versículos** do capítulo escolhido (`bibleVersesPane()`, que também rende os
estados "Escolha um capítulo acima." / "Baixando versículos…" / erro / capítulo
vazio). O **nome do livro fica em destaque no topo** (`.bible-book-head`) — sem
ele, uma tela só de números não diz em que livro o operador está.

As duas metades dividem a área **ao meio** e cada uma **rola por conta
própria** (`minmax(0,1fr)` nas faixas — sem o mínimo em 0, uma grade grande
como os 150 capítulos de Salmos esticaria a faixa e comeria a outra metade).

A **barra de rolagem fica sempre visível** nelas: no Android a barra é
"overlay" — só aparece durante o gesto e some —, então nada indicava que havia
mais capítulos ou versículos abaixo. Declarar largura em `::-webkit-scrollbar`
tira o modo overlay e a barra passa a ocupar espaço de verdade, o que é o que a
torna permanente (`scrollbar-width`/`scrollbar-color` cobrem o mesmo no padrão
novo). A grade ganha um `padding-right` para a última coluna não encostar nela.

> Houve uma tentativa de **encaixar tudo sem scroll**, encolhendo as células e
> repartindo a altura conforme o número de linhas de cada grade
> (`fitBibleGrids`, calculado em JS). Foi revertida: com Salmos ou o Salmo 119
> as células ficavam pequenas demais para acertar o toque, e a proporção
> variável fazia a tela mudar de cara a cada livro. Rolar com uma barra
> visível é mais previsível.

As duas grades marcam a seleção atual (`.bible-cell--num.active`: preenchimento
em `--accent-fill`, texto em `--on-accent` e `outline` da mesma cor; na grade de
livros, `.bible-cell.active` marca só com um `outline` em `--text`, para não
apagar a tinta do grupo), e é isso que faz **voltar da
leitura mostrar de imediato o capítulo E o versículo que estão no ar**, sem o
operador ter que se localizar — e sem procurar, já que nada rola.

Capítulos e versículos mantêm **tons distintos** (`--cell-chapter` em tom frio,
`--cell-verse` em tom quente) pra separar bem os dois níveis: as duas grades
são iguais em forma e conteúdo (só números) e ficam uma sobre a outra na mesma
tela — sem a diferença de temperatura, o operador perde de vista em qual das
metades está tocando. Fluxo: **livros → capítulo+versículo → leitura**; o botão
voltar (`#backBtn`) recua uma tela (`navigateBack` é `bible`-aware,
`gotoBibleScreen`), e cada troca faz um **leve slide direcional**
(`animateTabSwitch` reaproveitado; `BIBLE_SCREENS` dá a direção).

> Antes eram **quatro** telas — capítulo e versículo eram passos separados. Um
> versículo tem duas coordenadas dentro do mesmo livro; separá-las em telas
> obrigava a voltar uma tela só para trocar de capítulo, e ao voltar da leitura
> só se via a grade de versículos, sem pista de qual capítulo era.

Tocar num **capítulo** dispara `loadBibleChapter()`, que lê o cache ou **baixa
o capítulo na hora** (`Bible.fetchChapter`, gravado em `state`) — sem trocar de
tela: a metade de baixo mostra o estado enquanto isso. Guarda de sequência
(`bibleLoadSeq`) descarta downloads obsoletos numa troca rápida.

### Tela de leitura + projeção e navegação por slide

Tocar num **versículo** (`startBibleReading`) inicia uma **sessão de leitura**
(`bibleSession = { versionId, bookIdx, bookId, bookName, chapter, verses, idx,
projecting }`) e abre a tela `'reading'` — **mas NÃO projeta nada ainda**
(`projecting:false`). A tela de leitura (`renderBibleReading`, `.bible-read`)
mostra **quatro seções empilhadas** — versículo **anterior · atual · próximo ·
seguinte** (`.bible-vsec`): um atrás e **dois à frente**, porque ler adiante é
o que o operador faz (ele precisa saber o que vem para acompanhar a leitura,
não o que já passou).

**Cabe na tela sem scroll**: as quatro seções repartem entre si a altura que
sobra depois do rodapé (`flex: 1 1 0` + `min-height: 0` — é o `min-height` que
permite encolherem abaixo do próprio conteúdo; sem ele voltariam a empurrar a
tela). O **central recebe metade a mais** (`flex: 1.5`), então é o último a
apertar quando o versículo é longo. O texto que não couber é cortado com
reticências (`-webkit-line-clamp`): a íntegra vai para o telão, aqui basta
reconhecer o versículo. Rolar para achar o versículo central seria o oposto do
que essa tela serve. Embaixo, um **rodapé** (`.bible-read-foot`) com um **controle segmentado
único** (`.bible-ref-nav`) trazendo as quatro coordenadas do que está sendo
lido — **Versão · Livro · Capítulo · Versículo** —, cada uma levando ao seu
próprio seletor. Emendados, continuam lendo como uma referência
("ARA · João · 3 · 16") em vez de quatro ações soltas.

A **versão entra pela sigla** (`bibleVersionAbbr`): "Almeida Revista e
Atualizada" ocupava a linha inteira e empurrava a referência para baixo, e a
sigla que todo mundo já usa diz a mesma coisa em três letras. As regras, em
ordem: um acrônimo entre parênteses no próprio nome é a melhor resposta
possível; um nome de uma palavra já é a sigla; senão, as iniciais das palavras
significativas (ignorando "e", "de", "na"…) — o que dá ARA, ARC, NVI, NAA,
NTLH, ACF. Sem `flex-wrap`: quem cede espaço quando a linha aperta é o **nome
do livro** (`.bible-ref-part--book`, o único de largura imprevisível), com
reticências.

**À direita da referência, na MESMA linha** (v5.109), os dois botões de guardar
(`.cue-save-btn`: ⊞ para o Cronograma, ★ para os favoritos). **Aqui eles são
maiores que a caixa padrão** (v5.112): em `--hit` (34px) ficavam 4px mais baixos
e 22px mais estreitos que as células de Livro/Capítulo/Versículo ao lado, e numa
linha só isso não se lê como "botão menor", se lê como desalinhado. A altura vem
de `align-items: stretch` no rodapé — eles acompanham a referência seja qual for
a altura dela, em vez de repetirem um número que precisaria ser mantido à mão nos
dois lugares. A v5.103 os pôs
numa segunda faixa porque com RÓTULO — "Ao Cronograma", "Favoritar" — eles
disputavam a largura com os quatro campos e empurravam a referência para
reticências. Sem rótulo o par mede ~74px e cabe: o que a segunda faixa custava
era ALTURA, e altura nesta tela sai da leitura, que é o conteúdo dela. É por
isso que a `.bible-ref-nav` ganhou `min-width: 0` — sem ele o padrão
`min-width: auto` a impediria de encolher, e "1 Tessalonicenses" empurraria os
botões para fora da tela em vez de virar reticências.

Antes a referência era um botão só, que sempre voltava à grade de livros —
trocar só o capítulo custava passar pela seleção de livro de novo. Capítulo e
Versículo levam à mesma tela porque as duas grades convivem nela. Cada botão
sincroniza `bibleSel` com a leitura antes de navegar, senão a grade abriria no
que o operador escolheu por último, e não no que está no ar. O status offline **não** fica aqui
(só no popup de versões — ver acima). Nos **limites de capítulo/livro**,
as seções anterior/próximo mostram o versículo do **capítulo vizinho** (cruzando
pro livro seguinte/anterior), com um **badge indicador** (`.bible-vsec-cross`,
borda tracejada — ex.: "◂ Livro anterior: Amós 9") **antes** de selecioná-lo; o
texto do vizinho é lido sob demanda (`bibleAdjacentVerse`/`ensureAdjLoaded`,
cache `bibleAdjCache`). Início/fim da Bíblia mostram "Início/Fim da Bíblia".

**Gate de ativação (`projecting`)** — o texto só vai pro telão depois de um
toque no versículo CENTRAL:
- Tocar no **anterior/próximo** (`.bible-vsec.adj`) → `bibleSetIdx` move aquele
  versículo pro central. Enquanto `projecting` é `false`, **só move** — nada vai
  ao telão.
- Tocar no **central** (`.bible-vsec.cur`) → `activateBibleVerse` liga
  `projecting` e **exibe** o versículo. O central ganha a classe `.live`, que
  troca a borda e a referência para `--danger-text` e prefixa o rótulo com
  "● No ar". Era **verde** até a v5.47, enquanto quatro outros lugares do app
  diziam "está no ar" em vermelho — duas cores opostas para a mesma mensagem,
  sem regra que o operador pudesse aprender (ver "As três famílias" no Design
  System).
- Já **ativado**, tocar no anterior/próximo (ou usar os botões de slide) **exibe
  automaticamente** o novo versículo (`bibleSetIdx` chama `projectBibleVerse`).

`projectBibleVerse` sempre marca `projecting:true` (é o ato de exibir);
`renderNowPlaying` só mostra a referência quando `projecting` (antes disso o
telão ainda não tem a Bíblia, então o now-playing segue a mídia normal).

A projeção usa a **Camada de Texto** unificada (ver seção "Camada de Texto"): o
comando `text` (`{ main, sub, mode:'verse', view }`) mostra o **texto do
versículo com a referência (dourada, em `sub`) ABAIXO dele** num cartão central
de **tamanho fixo**, tanto no **Display** (`#text` layer, ver abaixo) quanto na
**preview** do Controle (`#pvText`, `showPvText`) — a preview sempre espelha o
telão. `projectBibleVerse` monta esse comando via `cmd()`.

Os **controles de slide** (o toque curto em ⏮/⏭, que aciona as âncoras
`#slidePrevBtn`/`#slideNextBtn`, e os gestos
invisíveis da preview em tela cheia) **passam/voltam versículos** quando há
sessão ativa: `stepSlide` e `renderSlideNav` checam `bibleSession` antes da letra
sincronizada, chamando `bibleStep`. **No fim do último versículo do capítulo,
`bibleStep` pula para o 1º versículo do capítulo seguinte — cruzando para o
próximo LIVRO se preciso** (`nextChapterRef`/`prevChapterRef` +
`bibleGotoChapter`, que baixa o capítulo vizinho sob demanda e faz a seleção
acompanhar); os botões só desabilitam no começo (Gn 1:1) e no fim (Ap, último
versículo) da Bíblia. Cada troca reenvia um novo comando `text` (não `seek` —
não há áudio/tempo) e o **texto entra com fade** (`animateFadeIn`/`pvFadeIn` —
transições são inerentes ao sistema, ver o state `fade`); mostrar/
esconder a camada e o toggle de wallpaper usam a cortina com fade
(`coverIn`/`coverOut`). O mesmo fade curto entra nas trocas de estrofe da letra
sincronizada. O `#npName` mostra a referência atual; `play`/`pause` **NÃO** são
mais no-op — controlam o **áudio de fundo** quando há um tocando (ver
"Independência do áudio" na seção Camada de Texto); só viram no-op sem áudio de
fundo (o ouvinte de `playPauseEl` checa `!preview.getCurrent()`). Uma **mídia comum** (visual)
assumindo a cena (`send`) ou o **stop** (`stopClear`) encerram a leitura
(`clearManualText` = `clearBibleSession` + `clearMsgSession` + o Display/preview
escondem a camada). Um `send` de **áudio** com sessão de texto ativa **mantém** a
sessão (não chama `clearManualText`) — é o áudio de fundo. O `viewToggle`
(`setView`, ciente da sessão de texto) liga/desliga a **cortina compartilhada**
do wallpaper por cima do texto, sem passar por `preview.handle` (que recobriria —
não há mídia carregada no stage, a menos que seja o áudio de fundo).

**As guardas da Camada de Texto no Controle usam `pvTextActive`, nunca
`bibleSession`.** O Display sempre tratou os dois provedores de forma unificada
(`textActive`); o Controle checava só a Bíblia em dois pontos, e com uma
**Mensagem** no ar isso dava dois defeitos reais: (a) o `setView` caía no
caminho genérico → `setViewFaded` → `instantCover(computeCover())`, e como o
stage da preview está sem `current` a cortina voltava na hora — a mensagem
sumia da preview enquanto seguia corretamente no telão; (b) o ▶ caía em
`send(currentId)`, que chama `clearManualText()` e **tirava a mensagem do telão
no meio do culto**, quando pela documentação deveria ser no-op (e com a Bíblia
era). `previewTick` já usava o predicado certo — os outros dois pontos agora
também.

A projeção de texto é **independente da navegação de abas** (como qualquer outra
mídia): o `load()` (disparado a cada troca de aba) **não chama
`preview.setView` enquanto `pvTextActive`** — sem essa guarda, como o stage da
preview está sem `current` (a Camada de Texto é paralela), `setView` cairia em
`computeCover()===true` e recobriria a cortina, fazendo o texto sumir da preview
ao sair da aba. O Display nunca é afetado por troca de aba (só encerra o texto
com `load` visual/`stop`/`clear` explícitos).

### No Display

Layer `#text` (`.text-layer`), **`z-index:2` — acima de toda a mídia**
(`z-index:1`), inclusive do iframe do YouTube, que vem depois no DOM e com
z-index igual pintaria por cima do cartão. A cortina do wallpaper sobe para
`z-index:3` (nada é colocado sobre o wallpaper) e o escudo do YouTube para
`4`. Como `.layer` já traz `background: var(--stage-bg)`, o cartão é **opaco**: o texto
manual cobre a cena inteira, que é o que se espera de uma interferência
direta do operador.

**É essa opacidade que dá continuidade à cena.** Nada precisa ser
interrompido para o texto aparecer: a mídia segue tocando intacta por baixo —
áudio audível, vídeo rodando, posição preservada — e **reaparece exatamente
onde estava** quando o texto sai. Antes o `showText` derrubava o player do
YouTube (`ytDrop()`) para o cartão ficar visível, e não havia como voltar:
tirar o versículo do ar deixava a cena vazia.

`showText(cmd)` chama apenas `hideLyrics(true)` — a letra sincronizada é a única
coisa que sai de cena, porque ela **é** texto e o manual tem precedência — e
**NÃO chama `stage.clear()`** (o áudio de fundo segue tocando, ver
"Independência do áudio"); pinta `main`/`sub`, aplica a classe
`.mode-message` conforme o `mode` e revela conforme a `view`; um novo `text` já
em cena só troca o texto (sem piscar). Enquanto `textActive`, o roteamento de
comandos trata a Camada de Texto como paralela (igual ao YouTube): `load` de
**áudio** mantém o texto (troca o som de fundo), `load` de
**visual**/`stop`/`clear` chamam `hideText(false)` e seguem o fluxo;
**transporte** (play/pause/seek/volume/mute) cai no fluxo do stage (áudio de
fundo).

**O `view` DELEGA a quem é dono do estado, em vez de mexer na cortina por
fora.** Com o cartão de texto no ar, o ramo de `view` chama `ytSetView(v)` (se
há YouTube) ou `stage.handle({type:'view', view:v})`. Ele já chamou
`coverIn`/`coverOut` direto, e isso movia a cortina deixando `stage.view` /
`yt.view` **congelados no valor antigo** — um estado inconsistente cujo estrago
só aparecia **depois** do `text-hide`, o que tornava o defeito difícil de
associar à causa:

- o `view` seguinte comparava com o valor velho, concluía que nada mudara e
  **retornava sem fazer nada**: o botão de cobrir/mostrar o telão ficava morto,
  e o operador precisava tocá-lo duas ou três vezes;
- na direção oposta era pior — com a cortina cobrindo e `stage.view` ainda
  `'visual'`, o `play` seguinte reavaliava `computeCover()` e **descobria o
  telão sozinho**, expondo a mídia que o operador tinha coberto de propósito.

Delegar tem uma contrapartida a corrigir: o cartão de texto é **independente da
mídia** — um versículo no ar sem nada carregado é o caso mais comum na pregação
—, mas para o stage "sem mídia" (ou mídia terminada) quer dizer cortina
fechada, e o `instantCover(computeCover())` no fim do `setViewFaded`
reengoliria o versículo logo depois do fade. Por isso, ao voltar de um
`view:'visual'`, o Display **reafirma a cortina aberta** — reconferindo
`textActive`, porque o fade dura 0,6 s e nesse intervalo o texto pode ter saído
de cena, caso em que quem manda é o `restoreSceneAfterText`.

E é pela mesma razão que essa chamada passa **`overlay: true`** (v5.69): o stage
só enxerga o que ele mesmo desenha, e sem mídia a cortina cobre nos dois valores
de view — a guarda de `setViewFaded` (abaixo) pularia a transição inteira e o
versículo apareceria seco, sem o fade. O `overlay` é o aviso de que existe uma
camada por cima do stage, então descobrir revela ALGUMA coisa.

**Sair do texto devolve a cena** (`hideText(restore)` → `restoreSceneAfterText()`,
espelhado por `hidePvText`/`restorePvSceneAfterText` na preview): vídeo, imagem e
YouTube não precisam de nada — nunca foram interrompidos e reaparecem sozinhos
assim que o cartão sai da frente. Só a **letra sincronizada** precisa ser
remontada, e **no slide correspondente ao instante atual** da música
(`updateLyricSlide(stage.getTime())`; na preview, `authoritativeTime()`), não do
começo — a música avançou enquanto o versículo estava no ar. O parâmetro
`restore` é falso justamente quando algo novo já vai assumir a cena (load de
visual, `stop`, `clear`): restaurar ali faria a cena antiga piscar antes de ser
substituída. Como `showLyrics` retorna cedo enquanto `textActive`, trocar o
áudio de fundo com o texto no ar também funciona: ao sair, entra a letra do
áudio **atual**.

**E a última coisa que `restoreSceneAfterText` faz, para TODOS os tipos de
mídia, é reconciliar a cortina** (`reconcileCover(view)`: `coverIn(false)` se a
view é `'wallpaper'`, senão `coverOut()`). Antes só a letra era remontada e os
demais tipos devolviam cedo — mas o `showText` mexeu na cortina por conta
própria para o cartão aparecer, então sair de cena tem que devolvê-la ao que a
view vigente manda. Sem isso, um versículo tirado do ar com o telão coberto
deixava a cortina cobrindo uma mídia cuja view é `'visual'`, e o toque seguinte
no botão de visual não fazia nada — para o stage, nada havia mudado. O helper
existe porque a cortina é **compartilhada** (stage, YouTube e a camada de texto
mexem nela) enquanto o estado de view é de quem é dono da cena; `coverIn`/
`coverOut` devolvem cedo quando ela já está onde deveria, então chamá-lo à toa
não custa nem pisca nada no telão.

O texto (`.text-box`) usa o mesmo redimensionamento por Container Queries da
letra (`container-type:size` + `cq*`), mas em prosa (caixa-baixa) e **SEM
moldura, ocupando a tela inteira**. A moldura da letra sincronizada existe para
dar contraste contra a imagem de fundo da estrofe; aqui o texto é sempre
projetado sobre o preto, então a borda seria só uma caixa desenhada à toa — e,
pior, uma caixa FIXA e menor que a tela, que apertava textos bíblicos (bem mais
longos que uma estrofe) num espaço pequeno enquanto sobrava tela vazia em
volta. Agora o texto ocupa o que tiver: `.text-box` é `86cqw`/`86cqh` — o mesmo
espaço útil que o antigo `padding: 7cqh 7cqw` deixava, mas escrito como **fração
do container** em vez de padding percentual (ver "Redimensionamento por
Container Queries": unidades de container escritas no próprio container não se
referem a ele) — e a **fonte é bem maior** (`6.4cqmin`, contra
`4.8cqmin` da caixa antiga; `7.4cqmin` no modo mensagem). No modo `verse` a
**referência (`#textSub`) fica ABAIXO do texto** (ordem no DOM, `hidden` quando
vazia — mensagens não têm referência) e conteúdos muito longos continuam sendo
cortados com reticências (`-webkit-line-clamp: 8` + `overflow:hidden`), que é a
garantia final contra vazamento. A preview espelha tudo isso em
`.pv-text-*`.

---

## Display

Interface mínima: wallpaper + layer de imagem + layer de vídeo + iframe do YouTube.

Escuta o BroadcastChannel e repassa os comandos para `stage.handle()` (ou para
a ponte do YouTube). Ao inicializar, **não** recarrega nem toca a última mídia
sozinho — `restore()` aplica as **preferências visuais** (fade, fundo da letra,
preenchimento, wallpaper) e envia `display-ready`; o Display abre sempre no
wallpaper (ponto inicial), esperando um comando explícito. A inicialização do
sistema precisa ser **controlada** (nenhuma mídia deve começar a tocar sozinha
ao abrir o app) — quem decide se retoma o que estava tocando é o **Controle**,
ao receber `display-ready` (com base no que ELE sabe que estava tocando, não em
algo persistido pelo próprio Display).

**`display-ready` sai num `finally`, e as preferências ficam num `try`.**
ANUNCIAR-SE não pode depender delas: toda a reconexão do sistema pende desse
comando (é ele que dispara o `resendSceneToDisplay`), então se uma leitura do
IDB rejeitasse — upgrade bloqueado, armazenamento despejado, transação
abortada — a `Presentation` recriada depois de um blip do espelhamento ficava
parada no wallpaper, sem nada no Controle explicando e sem outra saída além de
reiniciar o app. Perder o fundo da letra ou o wallpaper é um defeito visível e
recuperável; perder a reconexão, não. No `catch` o Display segue nos padrões
(preto na letra, `contain` no fit, gradiente no fundo).

**Não há service worker aqui.** Havia um bloco que registrava `sw.js` e
recarregava a página no `controllerchange` (adiando até o telão ficar idle),
mas o `sw.js` saiu do bundle junto com os andaimes dos dois PWAs: no navegador
o `register` devolvia 404 e a promise era engolida pelo `.catch`; no app o
bloco nem chegava a rodar. Código morto nos dois contextos, e ainda sugerindo
ao próximo leitor uma atualização que não existia. Quem atualiza a base agora é
o **OTA do shell**, aplicado no PRÓXIMO lançamento — justamente para nunca
recarregar o WebView do telão no meio de um culto. O mesmo bloco também saiu do
Controle, onde `swReg` ficava eternamente `null` e o ramo de "checar
atualização ao retomar" nunca executava.

**Toque único ao abrir (`#startBtn`, "Ligar Sistema") — só no navegador.**
No app ele fica **oculto** (`window.__NATIVE__`): o WebView roda com
`mediaPlaybackRequiresUserGesture = false`, e uma TV não recebe toque nenhum.
No navegador a área de toque cobre a tela inteira (z-index acima de tudo,
inclusive do wallpaper e do escudo do YouTube — qualquer toque serve) e some
para sempre após o primeiro toque; um `.start-pill` central (preenchido no
cor da marca — `--brand` —, com o texto no escuro do app, cantos
arredondados e halo em `--accent-glow`) é só a pista visual de "isto é
clicável" — sem
ele o texto flutuando no preto não parecia um botão. **Ele APENAS ativa o
Display** (destrava o áudio de terceiros/YouTube com o gesto real): não abre o
Controle nem redireciona pra lugar nenhum. (Chegou a existir uma chamada a
`requestFullscreen()` + trava de orientação via Screen Orientation API **no
Display** — removida: na prática regrediu o lançamento do Controle e nunca
engajou. A trava de paisagem só reapareceu, com sucesso, na **preview do
Controle** — lá ela roda já dentro de um `requestFullscreen` de elemento, que é o
contexto em que a Screen Orientation API é permitida.) Ao tocar, a classe `.confirming` dispara uma
animação rápida (~0,3s: pill cresce levemente e esmaece, fundo vai a
transparente) antes do elemento sumir de fato (`hidden = true` só depois do
`setTimeout` correspondente) — sem esse feedback, o overlay sumia no mesmo
instante do toque e a ação parecia não ter surtido efeito nenhum. Existe
porque autoplay com som em conteúdo de
**terceiros** (o iframe do YouTube) exige um **gesto real do usuário** na
página — diferente da mídia local do stage (mesma origem), que autoplay com
som é liberado automaticamente (ver abaixo). Esse gesto **não
pode ser simulado via JS** (é assim que o navegador garante que é uma ação
real da pessoa) — por isso o botão, em vez de tentar automatizar. O toque é um
`pointerdown` normal, que já borbulha para o listener de recuperação de áudio
do stage; se um YouTube já tiver sido restaurado (`restore()`) antes do
toque, o clique reaplica mute/volume/play nele imediatamente — mesmo sem
isso, `ytWatchStart()` e a resincronização de mudo em `ytStartTimeLoop()` (ver
seção do YouTube) convergiriam sozinhos em poucos segundos.

**Áudio sem toque (recuperação automática — só mídia local do stage):** ao
contrário do `#startBtn` acima (que existe só por causa do YouTube), mídia
local **não precisa de nenhum toque prévio** — não há overlay de unlock
bloqueante para ela. Se a política de autoplay do navegador bloquear
som sem gesto num vídeo/áudio local, ele **começa mudo** (sempre permitido — o
conteúdo aparece no telão sem toque) e a recuperação automática religa o áudio
em retentativas de ~5 s (`setMute(false)`, detectando se o navegador pausou).
**No app este mecanismo é desativado** (`window.__NATIVE__`): sem política de
gesto no WebView, qualquer detecção seria falso positivo. **E a guarda de
nativo fica no próprio `onBlocked`**, não só dentro do `beginAudioRecovery()`:
o handler mutava o stage *antes* de descobrir que era falso positivo, e como o
`beginAudioRecovery` devolve cedo no app, `audioBlocked` continuava `false` e
nem o `tryRestoreAudio` nem o comando `audio-retry` faziam qualquer coisa. O
telão ficava **sem som até o próximo load**, e o Controle não recebia sinal
nenhum — o `display-status` só carrega `audioBlocked`, que ali era falso.
No navegador, a primeira retentativa costuma resolver. **Nada é exibido no
telão**: o estado vai no campo `audioBlocked` do `display-status`; no
**Controle**, o
**botão de mudo do mixer** vira indicador (estado `.blocked`, âmbar pulsante,
ícone de volume off) e **atalho**: o clique envia `audio-retry` (retentativa
imediata) em vez de alternar o mudo. Qualquer gesto real no Display
(toque/tecla — `pointerdown`/`keydown` no documento) religa o áudio na hora. O
comando `mute` do operador encerra a recuperação. **Este mecanismo não se
aplica ao YouTube** — ver seção abaixo.

### Microfone ao vivo, no lado do Display

O operador segura o botão no Controle, o comando `mic` atravessa o canal e é o
**Display** que abre o microfone e o reproduz na projeção — um `MediaStream`
não é clonável e portanto **não atravessa o BroadcastChannel**, então quem
reproduz tem de ser quem captura. O caminho é `getUserMedia →
MediaStreamSource → GainNode → destination`, com rampa curta na entrada e na
saída (cortar no meio de uma palavra estala na caixa de som). A parte nativa
(permissão `RECORD_AUDIO`, `onPermissionRequest` do WebView) está em
[`CLAUDE.md`](../CLAUDE.md).

**A captura em voo tem um token (`micSeq`), e `micStream` não servia como
guarda.** Ele só existe DEPOIS de o `getUserMedia` resolver, e o primeiro
push-to-talk da sessão demora (permissão + `onPermissionRequest`). Um
on→off→on nesse intervalo — o operador aperta, não ouve nada, solta e aperta de
novo — disparava um **segundo** `getUserMedia` com o primeiro ainda pendente;
quando os dois resolviam, o segundo sobrescrevia as referências e o primeiro
ficava com as trilhas vivas e o ganho ligado ao `destination`, **sem ninguém
para pará-lo**: microfone aberto no telão (e o indicador de gravação do Android
aceso) até o WebView do telão ser recriado.

Três consequências disso, e cada uma cobre um `await` diferente:

- `stopMic()` **incrementa o token antes da saída antecipada**: com `micStream`
  ainda nulo não há nada a derrubar, mas é preciso registrar que o operador
  soltou o botão — senão o `getUserMedia` pendente vira um microfone aberto que
  nenhum comando desliga.
- `startMic()` reconfere o token **duas vezes**: depois do `getUserMedia` e
  depois do `micCtx.resume()`. O resume é outro `await`, e um `stopMic()` ali
  no meio passava batido — a continuação ligaria a fonte ao `destination`
  depois de o botão já ter sido solto.
- ao parar, o `AudioContext` é **suspenso, não fechado**: fechá-lo exigiria
  criar outro no aperto seguinte, e é justamente esse custo (e a latência de
  abertura) que se quer evitar num push-to-talk. Suspenso, ele para de segurar
  a saída de áudio — e só é suspenso se ninguém tiver reaberto o microfone
  nesse meio tempo.

#### `NotReadableError` não é "outro app está usando" (v5.142)

O relato foi o push-to-talk falhando com **"o microfone está em uso por outro
app"** num aparelho em que nenhum outro app gravava — e a mensagem era nossa, do
mapeamento de `NotReadableError`. O nome do erro engana: ele é o *"não consegui
abrir o dispositivo"* genérico do WebRTC, e no Android a causa comum aqui não é
disputa entre apps, é o **processamento pedido**.

Com `echoCancellation`, o Chromium abre o `AudioRecord` em
`VOICE_COMMUNICATION` para usar o cancelador de eco do hardware — uma sessão de
**voz**, que o sistema recusa quando a saída de áudio está em outro caminho. Que
é exatamente o caso deste app durante um culto: espelhamento ligado, telão
recebendo o som.

`startMic` passou a tentar **três vezes, da melhor para a que sempre abre**:

1. `echoCancellation` + `noiseSuppression` + `autoGainControl` (o de sempre);
2. os três **desligados** — força a fonte `MIC`, sem sessão de voz;
3. `audio: true`, cru.

A ordem é deliberada: o cancelamento de eco fica em primeiro porque num culto uma
realimentação é um estrago imediato e público. Só se ele não abrir é que se desce
— e um push-to-talk que funciona com risco de microfonia é melhor que um que não
funciona, desde que fique registrado, que é o que a linha `microfone SEM
cancelamento de eco` do Registro do telão faz.

**`NotAllowedError`/`SecurityError` não descem a escada**: permissão negada é
resposta do sistema (ou do `MicChromeClient`) e não melhora com menos
processamento — insistir só gastaria duas chamadas para dar o mesmo erro. E a
mensagem ao operador deixou de nomear uma causa que quase sempre estava errada:
chegar até ela agora significa que as três tentativas falharam.

> **Não foi reproduzido aqui.** A condição depende do roteamento de áudio do
> aparelho com espelhamento ativo, que não existe neste ambiente. A escada é a
> hipótese mais provável e não custa nada quando ela está errada — se o erro
> persistir, o Registro do telão passa a dizer qual das três tentativas caiu e
> com que nome, que é o que faltava para responder isso sem adivinhação.

### YouTube — o EMBED SAIU (v5.212), e o que ficou no lugar

**Aqui havia ~95 linhas descrevendo, no presente, um player que não existe
mais.** Elas documentavam a IFrame Player API oficial (`loadYtApi`,
`ytApiPromise`, `YT.Player`, `playerVars`, `createYtHost`, `ytKillCaptions` com
`unloadModule`, o escudo anti-UI, o vigia `ytWatchResume`), e cada uma delas
mandava o leitor procurar um símbolo apagado. Ficam o que foi APRENDIDO e o
endereço do que existe hoje.

**Por que ele saiu.** O KDoc do `display.js` dizia que o risco de
supply-chain do `<script src="https://www.youtube.com/iframe_api">` era
"ACEITO conscientemente" — e descrevia METADE do problema.
`addJavascriptInterface` injeta o objeto em **todas as frames**, iframes de
outra origem inclusive; no telão a ponte nasce com `host = null` e o estrago
seria limitado, mas **o mesmo embed era criado no CONTROLE**, para a preview, e
lá a ponte é a completa (`pickFolder`, `listFolder`, `pickDoc`, `openExternal`,
`espelhoLigar`, `apkInstalar`). A invariante 9 protegia a metade errada.

**O que saiu junto, e é o argumento inteiro:** um segundo motor de transporte
(`ytHandle` ao lado do `stage.handle`), um segundo emissor de status, uma
segunda máquina de mudo que ignorava o `forceMuted` do stage, uma cortina
própria e um `if (yt)` em quinze pontos — ~540 linhas no `display.js` e ~180 no
`controle.js`. Com eles saíram também a dependência de rede/youtube.com **em
cena**, o `document.hidden` que pausava o player com o app minimizado, e a cena
que ia MUDA para as telas da rede porque o Web Audio não alcança um iframe
alheio.

**Quem toca YouTube hoje** é o caminho PRÓPRIO, que já era o preferido:
transmissão direta (`AVNative.ytStream` → `shared/mse.js`, um `MediaSource`
alimentado pelo `StreamProxy`) e, falhando ela, o arquivo baixado pelo
`YoutubeGrab`. Nos dois casos o telão toca um `<video>` COMUM, com fade,
cortina, `MediaSession` e barra de graça — e **zero pixel de YouTube na
projeção**. Um registro `kind: 'youtube'` (o link sem bytes) deixou de ser
tocável como link e passa a ser RESOLVIDO no toque, dentro do `send`
(`resolverLinkYoutube`). Ver "A via do arquivo baixado", abaixo, e a seção da
transmissão direta.

**A lição de método, que é o que sobrevive a qualquer transporte:** três
versões (v5.75–v5.77) atacaram "o telão para ao minimizar" supondo que o
problema era do YouTube — vigia de pausa, `ytWatchResume`, cota de tentativas —
e as três erraram. A prova veio quando uma mídia **local** parou do mesmo
jeito. A causa real está na seção seguinte.
### O telão parava ao minimizar o app — a causa real (v1.28)

Três versões atacaram isto por hipótese, e as três erraram, porque todas
supunham que o problema era do **YouTube**. A prova de que não era veio quando
uma mídia **local** — um arquivo baixado, tocando num `<video>` comum — parou
exatamente do mesmo jeito.

Com isso o alvo mudou: o que para é o **telão inteiro**, e as causas possíveis
são três, todas do lado nativo. A v1.28 fecha as três de uma vez, porque
distingui-las sem instrumentação já custou três tentativas:

1. **O WebView do telão era DESTRUÍDO ao minimizar.** `StagePresentation`
   chamava `release()` no `onStop()` — e `Presentation` é um `Dialog`, cujo
   `onStop()` chega em situações que não são "o telão acabou", entre elas o app
   sair da frente. Isso apagava a projeção inteira; ao voltar, o
   `syncPresentation` encontrava a Presentation fora do ar e criava OUTRA, com
   o telão recarregando do zero. Quem derruba o telão são os donos do ciclo de
   vida, e eles já faziam isso explicitamente.
2. **Metade da visibilidade continuava vazando.** O Chromium calcula a
   visibilidade a partir da janela **e** da View; a v1.26 mentia só sobre a
   primeira. `KeepVisibleWebView` agora cobre `onVisibilityChanged` também.
3. **A suspensão do renderer.** `WebView.onResume()`/`resumeTimers()` chamados
   do `onStop()` da Activity — o instante exato em que o sistema desaceleraria
   tudo —, mais `setRendererPriorityPolicy(IMPORTANT, waivedWhenNotVisible =
   false)`, que é literalmente "não abra mão da prioridade só porque esta View
   não está visível".

#### E o caso relatado era no CELULAR, não no telão (v1.29)

Depois de tudo acima, veio a informação que faltava: a pausa acontecia com a
**mesa de som** ligada — o áudio saindo pelo próprio aparelho. Nesse modo quem
toca é o `<video>` da **preview**, no WebView do **Controle**, e não o do telão.
As três correções anteriores protegiam o WebView errado.

> **E ISTO VOLTOU A TER DONO NA v5.215**, com uma diferença que precisa estar
> dita: sem tela nenhuma conectada, quem toca é de novo o `<video>` da preview,
> no WebView do **Controle** — mas o `AVNative.keepAudioAlive` (e o
> `setAudioAlive` do shell) **saiu na v5.189 e não voltou**. O que segura o caso
> hoje é o que já segurava o defeito relatado quando ele foi diagnosticado:
> **áudio audível isenta a página do estrangulamento** — é a mesma observação
> que o `CLAUDE.md` registra pelo avesso na nota do `snoopDisplayStatus` ("ligar
> o áudio no próprio celular fazia o defeito sumir") — e o `SessionService`
> mantém o processo vivo enquanto houver cena. Se um dia o louvor calar ao
> minimizar o app com o som saindo do celular, é aqui que a resposta começa, e o
> caminho é o `manterVisivel` + `RENDERER_PRIORITY_IMPORTANT` descrito acima.
> Ele custa um degrau de `SHELL_VERSION` e uma Release.

E o Controle ser estrangulado em segundo plano é, normalmente, o comportamento
CERTO: ele é a mesa de comando, e o som está no telão. Deixa de ser certo
exatamente quando a mesa de som está ligada, porque aí o celular é a caixa de
som. Então a proteção virou **condicional e ligável em tempo de execução**:
`AVNative.keepAudioAlive(on)` (chamado por `setStandalone`) → `manterVisivel`
do `KeepVisibleWebView`, mais `onResume()`/`resumeTimers()` no `onStop()` da
Activity e a mesma política de prioridade de renderer do telão. Desligada a
mesa de som, tudo volta ao padrão.

**E, desta vez, uma CAIXA-PRETA.** `diag()` em `display.js` mantém um anel dos
últimos 60 eventos do telão (visibilidade, `pagehide`, `freeze`/`resume`, e cada
`play`/`pause` do `<video>` — separando a pausa COMANDADA da espontânea). O
Controle pede o despejo (`diag-ask` → `diag-dump`) ao abrir **Configurações**,
onde ele aparece como texto. É a única janela para o que acontece com a
projeção enquanto o celular está fora da frente: não há console, não há logcat,
e o Controle está estrangulado justamente nesse intervalo. Se voltar a parar,
o registro diz QUAL das três causas foi — em vez de mais uma rodada de palpite.

### Onde o aviso de download aparece (v5.84)

O cartão sobre a preview diz **"isto vai entrar em cena"**. É a mensagem certa
quando o toque foi TOCAR, e a errada quando ele foi só ADICIONAR: um vídeo
compartilhado que apenas entra no Cronograma não vai ao telão a seguir, e
anunciar o download ali insinua o contrário. A regra passou a ser **o aviso mora
onde o resultado vai aparecer**:

| O que o toque pediu | Onde o aviso aparece |
|---|---|
| Tocar uma música do acervo (cantada, playback, só a letra) | cartão sobre a **preview** (`previewBusy`) |
| Adicionar uma música do acervo a uma lista | miniatura da **linha do acervo** (`setSongRowBusy`) |
| Compartilhar um link do YouTube no **simplificado** | **preview** — ali o item vai direto ao telão |
| Compartilhar um link do YouTube no **avançado** | **linha do Cronograma** (`libBusy`) |
| Converter um item de player que já está na lista | **a própria linha** dele |

O caso novo é o do Cronograma, e ele tem um detalhe: enquanto o arquivo baixa,
**a linha ainda não existe**. Por isso ela é criada PROVISÓRIA — o operador vê o
item entrar na lista na hora, com o anel no lugar da miniatura e o percentual ao
lado, e ela vira o item de verdade quando os bytes chegam. Duas consequências
que o código trata explicitamente:

- **A lista vazia também desenha a provisória.** Sem isso, o primeiro vídeo
  importado num Cronograma vazio mostrava "Cronograma vazio." durante todo o
  download — a pior frase possível naquele momento.
- **O percentual repinta SÓ o texto**, sem refazer a lista: ele chega a cada
  megabyte, e um `load()` por atualização reconstruiria dezenas de linhas (com
  object URLs de miniatura) enquanto o operador rola a lista.
- Enquanto baixa, o botão de converter **sai da linha**: ele já ficava
  desabilitado, mas desenhar "baixar" ao lado de um anel girando é oferecer a
  ação que está em curso.

### A via do arquivo baixado — v5.78, e a extração NATIVA da v5.81

O embed do YouTube **pausa sozinho quando a página fica oculta**, e é isso que o
Android faz com o telão no instante em que o operador minimiza o app. A regra
roda dentro de um iframe de **outra origem**: nenhum código nosso a alcança.
Foram tentadas as duas únicas saídas de fora, e as duas falharam em aparelho:

1. **Mandar tocar de novo** (`ytWatchResume`, v5.77) — o comando chega, o player
   pausa outra vez.
2. **Impedir o WebView do telão de se declarar oculto**
   (`WebViewFactory.KeepVisibleWebView`, v1.26 do shell: `onWindowVisibilityChanged`
   sempre reporta `VISIBLE`). Ficou no código — é correto por si só e barato —,
   mas não bastou.

A resposta que não depende de vencer o player deles é **não usar o player
deles**: o link vira um **arquivo de vídeo no aparelho**, e daí em diante é uma
mídia como qualquer outra — o mesmo `<video>` dos arquivos importados, com fade,
seek, playlist, cortina, `MediaSession` e reprodução em segundo plano que já
funcionam há versões. De quebra: sem anúncio, sem legenda, sem UI de terceiro no
telão e **sem depender da rede durante o culto**, que num salão de igreja é o
ganho maior de todos.

#### Quem extrai é o APARELHO (v5.81)

A v5.78 pedia isso a um servidor [Cobalt](https://cobalt.tools). **Não
funcionou**, e o motivo não é o Cobalt — é a categoria: Cobalt, Invidious e
Piped rodam em **IP de datacenter**, que é exatamente o que o YouTube bloqueia.
Nenhuma lista de instâncias, por melhor que seja, muda isso; foi por isso que
nem a instância digitada à mão nem a descoberta automática (v5.80) entregaram o
vídeo.

Escrever o extrator à mão também não serve: os **PO Tokens** de hoje são
atrelados a cada vídeo e assinados por BotGuard/DroidGuard, e o atalho
`android_sdkless` que os dispensava foi removido. Seria manutenção semanal,
quebrando sempre num domingo.

O que funciona é extrair **no aparelho**: a requisição sai do IP do chip do
operador, que o YouTube não bloqueia — é por isso que o NewPipe funciona no
celular enquanto os servidores públicos apanham. `YoutubeGrab.kt` faz isso com
o `NewPipeExtractor` (a única dependência de terceiro do projeto, e a exceção
está declarada no `CLAUDE.md`), e `AVNative.ytFetch(url, onProgresso)` entrega
ao lado web uma **URL servível** (`/saf/<token>`) — daí para a frente o caminho
é o mesmo de um arquivo compartilhado: `fetch` + `Blob` + `addMedia`, e
`ytDiscard` apaga o intermediário para o vídeo não ficar duas vezes no aparelho.

- **Some o problema de CORS**: o `fetch` do WebView nunca alcançaria o
  `googlevideo.com`, que não manda os cabeçalhos — era por isso que o caminho do
  Cobalt precisava de `alwaysProxy`.
- **MP4 de até 1080p** (v1.44 para o remux, v1.49 para ele passar a funcionar de
  verdade). O YouTube reserva as resoluções altas para faixas separadas de vídeo
  e áudio; juntá-las é o `MediaMuxer` da plataforma (`MuxMp4.kt`), cópia de
  amostras e não recodificação — nada de ffmpeg embarcado. O progressivo segue
  como piso quando a montagem não sai; ver a série "O cliente visionOS destrava
  o 1080p" acima.
- **Sem `PoTokenProvider`, por enquanto.** O extrator faz "o melhor esforço"
  sem ele; montá-lo exige rodar o desafio do BotGuard num WebView — o app tem
  dois, então é factível, mas é outra empreitada. Se um vídeo resistir, o app
  cai no player embutido, que é o plano B de sempre.
- **Exige shell ≥ 16.** Num anterior a função devolve null na hora e o fluxo
  segue como antes.

#### O Cobalt saiu (v5.82)

Ele foi a tentativa das versões 5.78–5.80 e **não funcionou em aparelho**, pelo
motivo que está no começo desta seção: IP de datacenter. Ficar como "segunda
opção" seria manter uma tela de configuração que não leva a lugar nenhum e um
caminho de código que ninguém exercita — os dois envelhecem calados. O plano B
é o player embutido, que já existia e é honesto sobre o que faz.

### O que o watchdog do OTA exige DESTA base (`shared/native.js`)

O mecanismo do watchdog é do shell (`CLAUDE.md`, "OTA da base web"), mas o
sinal de "o bundle subiu inteiro" é dado **daqui**, e ele impõe um contrato
sobre o código do Controle que um refactor pode quebrar sem perceber.

Até a v5.47 a única condição era `window.AVDB` no evento `load`, e o
raciocínio registrado era sobre "um erro de sintaxe em `db.js`" — **o arquivo
menos provável de quebrar**. A ordem dos scripts é `native.js` → `db.js` →
`stage.js` → `louvorja.js` → `bible.js` → `controle.js`: um erro de sintaxe (ou
um `throw` de inicialização) em qualquer um dos quatro últimos aborta **só
aquele script**, o `load` dispara do mesmo jeito, `AVDB` continua lá — e o
bundle quebrado era carimbado como bom e servido **para sempre**, exatamente o
oposto do que o mecanismo existe para fazer. Como o OTA publica a cada push em
`main` e o `controle.js` é de longe o que mais muda, esse era justamente o caso
provável.

O sinal agora é "**o app está de pé**", e cada peça cobre um trecho da cadeia
que a anterior não cobre:

1. **papel `'controle'`** — o WebView do Display carrega bem menos código (não
   carrega `controle.js` nem `louvorja.js`), então deixá-lo confirmar validaria
   um bundle cujo Controle nunca chegou a rodar. E o Display é o caso **normal**
   de culto (TV conectada), ou seja, confirmaria quase sempre no lugar do
   outro. Sem TV o Display nem existe: quem confirma é sempre o Controle, que é
   quem precisa funcionar.
2. **`AVDB` e `createStage`** — os dois módulos compartilhados, cada um
   publicando seu global no fim do arquivo.
3. **`window.__avBack`** — só existe se o `controle.js` foi parseado por
   inteiro **e** executado até quase o fim. É a mesma função que o botão voltar
   do Android consulta, ou seja, um contrato que já existe, não um marcador
   inventado para o watchdog.
4. **um `<li>` dentro de `#playlist`** — o HTML entrega esse `<ul>` **vazio**;
   quem o preenche é `renderPlaylist()`, chamado por `load()` dentro do `init()`
   assíncrono. É o que prova que a inicialização terminou de verdade: `init()`
   começa por `loadCollections()` (louvorja.js) e só então monta a tela, então
   uma quebra em `louvorja.js` ou `bible.js` derruba o `init()` antes daqui e o
   marcador nunca aparece.

**Por polling, e não por uma checagem única no `load`:** o `init()` do Controle
é assíncrono (várias leituras de IndexedDB) e termina DEPOIS do `load`. Uma
checagem única rejeitaria todo bundle bom — o OTA pararia de funcionar por
inteiro, que é o defeito oposto e igualmente ruim. Não há risco de descompasso
de versão: `native.js` viaja **dentro** do bundle que valida, então esta função
e o `__avBack` que ela exige são sempre do mesmo commit.

O erro possível aqui é o **seguro**: a confirmação chega ~1 s depois do `load`,
então fechar o app nesse intervalo faz um bundle bom ser descartado — custo: o
app volta ao embutido e o OTA baixa de novo na abertura seguinte. O erro do
outro lado, carimbar um bundle quebrado, não tem volta sem publicar uma versão
nova.

> **Consequência prática:** mover `__avBack` para outro arquivo, renomear
> `#playlist` ou adiar a primeira renderização da playlist para depois de uma
> interação **quebra o watchdog** — o app deixa de confirmar e todo bundle OTA
> passa a ser descartado no lançamento seguinte, silenciosamente.

### Chamadas à ponte: época e prazo

Duas defesas em `shared/native.js`, ambas invisíveis no navegador:

- **O id de cada chamada é escopado ao CARREGAMENTO da página**, não um
  contador puro (`EPOCH` aleatório + sequência). O renderer pode morrer no meio
  de uma chamada em voo — é para isso que existe o `onRenderProcessGone` do
  shell: o WebView é destruído e recriado, a página recarrega e o contador
  volta a zero, mas o `resolve` do Kotlin aponta sempre para o WebView
  **atual**. Com ids "1", "2", "3", a resposta atrasada de um `listFolder` da
  página velha resolvia a promise homônima da página **nova** — uma lista de
  arquivos chegando onde se esperava o retorno de `displays()`. Com a época, a
  resposta velha não acha entrada no mapa e é descartada.
- **Prazo (`CALL_TIMEOUT_MS`, 60 s) nas chamadas que NÃO dependem de gente.**
  Se o lado nativo nunca responder, sem isso a promise fica pendente para
  sempre e o fluxo que a aguardava para no meio — sem erro, sem nada no
  console. É rede de segurança, não deadline de UX: generoso de propósito,
  porque varrer uma pasta enorme do SAF leva segundos. `pickFolder` e
  `requestMic` ficam **sem prazo**: ali quem responde é uma PESSOA (o seletor
  do SAF, o diálogo de permissão), e um timeout resolveria `null` com o
  operador ainda escolhendo a pasta.

---

## Design System — a identidade oficial IASD, em dois temas

Toda a UI sai de um conjunto fixo de **tokens** (variáveis CSS). **Regra: não
usar valor literal solto na folha; sempre referenciar um token.** Isso existe
porque o projeto acumulou muitas alterações estéticas pontuais (cores e medidas
repetidas à mão), que foram consolidadas nestes padrões.

### A identidade é a OFICIAL, e são DOIS temas (v5.192)

As matizes vêm do **pacote oficial da identidade visual adventista** — o mesmo
de que saiu o símbolo do wallpaper padrão na v5.188. Os dezoito valores:

```
black     #000000     denim     #2F557F  ← o NÚCLEO da identidade (PMS 302)
bluejay   #2E6DE7     earth     #5E3929
campfire  #CD4900     emperor   #4B207F
cave      #255760     forest    #355724
grapevine #712551     iris      #9013FE
lily      #D41583     ming      #007F98
night     #4A4A4A     scarlett  #D0021B
treefrog  #2B8500     velvet    #782832
white     #FFFFFF     winter    #717171
```

**O âmbar saiu, e ele nunca foi oficial.** A v5.47 o adotou como "a marca IASD",
e o argumento era de CONTRASTE, não de identidade: a paleta azul anterior usava
UM valor para os dois papéis (fundo preenchido e texto), e é esse par que
reprovava — não o azul. A saída certa era separar os papéis, que é o que
`--accent`/`--accent-fill`/`--on-accent` fazem desde a v5.48. Com eles no lugar,
o azul oficial passa com folga nos dois temas.

**Duas coisas que a leitura natural inverte:**

1. **Nem todo token é um valor oficial.** Os dezoito foram desenhados para papel
   e para fundo BRANCO — medidos, todos passam AA sobre branco (o pior é
   campfire, 4,62:1) e **nenhum** passa AA como texto sobre o quase-preto do
   tema escuro (bluejay dá 3,97:1; treefrog, 4,02:1). Onde clarear (ou
   escurecer, no tema claro) foi preciso, o comentário de `tokens.css` diz de
   QUAL oficial o valor saiu, e a matiz é preservada.
2. **A escala categórica da Bíblia precisa de mais matizes do que a identidade
   tem.** Os dezoito cobrem sete famílias (azul, verde-água, verde, laranja,
   vermelho, rosa, roxo) em pares claro/escuro, e a tela de livros precisa de
   DEZ grupos separados por pelo menos 20°. Cinco grupos são oficiais e cinco
   preenchem os vãos — e o `scarlett` fica FORA da escala de propósito, porque
   vermelho é atenção neste app e um grupo de livros vermelho competiria com
   "está no ar" na mesma tela.

#### A montagem dos dois temas

```css
:root                      /* o PALCO e o que não muda com o tema */
:root                      /* o tema ESCURO — o padrão, sem atributo nenhum */
:root[data-tema="claro"]   /* o tema CLARO — 0,2,0 vence o 0,1,0 acima */
```

O claro é um **DELTA**: o que ele não redeclara cai no escuro. Três coisas
precisam estar ditas:

- **O PALCO NÃO TEM TEMA.** `--stage-*`, `--wallpaper`, `--lyrics-frame-bg`, as
  sombras e o `--scrim` moram no bloco compartilhado. O Display já ficaria
  escuro por omissão (ele nunca escreve o atributo); o que a separação garante é
  a **preview do Controle**, que roda no documento que TEM tema e existe para
  ESPELHAR o telão. Um telão claro num salão às escuras cega a congregação, e
  uma preview clara deixaria de cumprir seu papel exatamente no tema em que o
  operador mais precisa dela.
- **Um token que exista SÓ no claro não está definido no tema padrão.** O
  `var()` computaria para o valor inicial da propriedade — sem aviso, sem log —,
  e quem escreveu acabaria de ver a cor certa na tela porque estava com o claro
  ligado. `tools/tokens.test.mjs` trava isso.
- **A escolha é lida antes do primeiro quadro**, do `localStorage` (`av.tema`),
  pela mesma razão do modo do app: uma leitura do IndexedDB é assíncrona e o app
  já teria pintado. O que o shell faz — e é só isto — são as duas coisas que o
  CSS não alcança: os ÍCONES das barras de sistema e o `windowBackground`. Ver
  `AVNative.temaClaro` no CLAUDE.md.

**No tema claro os valores oficiais entram quase todos verbatim, e isso não é
sorte:** eles foram desenhados para pousar sobre BRANCO, que é exatamente o
fundo dos cartões desse tema. Escurecer só foi preciso onde a cor pousa sobre o
CINZA da página em vez de sobre branco.

**O degrau de elevação se INVERTE no claro, e a régua muda junto.** No escuro,
"mais alto" é "mais claro"; no claro o painel já é branco e não há para onde
subir, então `--panel-2` desce (um campo dentro de um cartão é um recesso, que é
a convenção de toda UI clara). A consequência é que `--panel-2` e `--bg` ficam
praticamente na mesma luminância — deliberado, e o mesmo que Material e iOS
fazem. O piso de 1,30:1 entre superfícies grandes foi escrito para um salão no
ESCURO, onde sombra não se vê; no claro ele vale só para o par que importa,
fundo × painel (1,29:1), e é dispensado no resto por essa razão.

### Por que a paleta mudou (v5.48)

O app é operado **no escuro**, e a paleta anterior falhava nos dois eixos ao
mesmo tempo:

- **Emitia luz demais.** `--text` (`#f2f2f2`) saía a **88,8%** de luminância
  relativa — hoje são 62,9% —, e o branco puro (`#fff`) aparecia **22 vezes**
  na folha do Controle como cor de ícone e de rótulo, **sem nenhum token que o
  nomeasse**. A tela de livros da Bíblia — 66 ladrilhos saturados preenchendo a
  altura — emitia **7× mais luz que uma lista comum** (16,3% de luminância
  média contra 2,3% de um painel), e é justamente a tela que o operador abre no
  meio da pregação.
- **Separava de menos.** `--bg` × `--bar` dava **1,19:1** e `--panel` ×
  `--panel-2` dava **1,22:1** — os dois abaixo do piso que o próprio design
  system declarava adotar, e ninguém percebeu (ver "Ao mexer em cor").

E, acima de tudo, **a mesma cor significava coisas diferentes em telas
diferentes**. Quatro estados eram pintados por duas famílias de cor cada:

| Estado | Antes | Onde divergia |
|---|---|---|
| está no telão agora | `--danger` ×4 e `--success` ×2 | vermelho em `.pv-fab.live`, `.mic-btn.live`, `.misc-project.live`, `.misc-tab-live`; **verde** em `.bible-vsec.cur.live` e `.msg-item.active` |
| selecionado / onde estou | `--accent` ×19 e `--success` ×2 | tudo accent, menos `.msg-item.active` |
| concluído / OK | `--success` ×8 e `--accent` ×1 | tudo verde, menos `.hymnal-stat.net.ok` (chip que saiu na v5.73) |
| baixando / ocupado | `--accent` ×5 e `--danger` ×2 | o texto do progresso numa cor e o botão de cancelar em outra, na mesma linha |

No sentido inverso, `--gold` (o nome que `--brand` tinha até a v5.192) acumulava **27 usos** cobrindo marca, aviso, erro,
cancelar, destaque de busca e rótulo de estrofe — não existia um `--warn`
separado da marca.

### As três famílias

A paleta tem **três matizes fazendo três trabalhos**, e nada além disso:

- **azul denim** — marca IASD, navegação, seleção, progresso. Uma família só: o
  accent **é** a marca (`--brand` e `--accent` têm o mesmo valor), então não há
  dois azuis disputando significado. Os dois nomes coexistem para que a folha
  possa distinguir "isto é marca/metadado" de "isto é navegação/seleção" sem
  inventar uma segunda matiz. (Eles se chamavam `--gold*` até a v5.192; um token
  chamado "gold" guardando um azul é exatamente a divergência que a fonte única
  existe para impedir, então foram renomeados junto com a cor.)
- **vermelho** (`scarlett`) — atenção, e a **intensidade carrega o tipo**:
  preenchido = está no ar agora; contorno = ação destrutiva; suave = aviso/erro.
- **verde** (`treefrog`) — concluído, conectado. E **só** isso.

A contrapartida conhecida MUDOU DE LUGAR na v5.192, e vale registrar as duas.
Na paleta âmbar, o accent (39°) e o laranja do aviso (27,5°) ficavam a ~12° de
matiz um do outro — duas matizes quentes disputando a mesma leitura. Com o
accent em azul isso acabou, e o que sobra é que o **aviso** (`campfire`, 21°) e
o **vermelho de atenção** (`scarlett`, 353°) ficam a ~28°: melhor, mas ainda
duas matizes quentes. A regra fica de pé pelo mesmo motivo de antes: o aviso
**nunca é cor pura solta** — sempre fundo suave + ícone. Um aviso que se anuncia
só pela matiz não sobrevive a um celular com brilho baixo, nem a quem não
distingue duas matizes vizinhas.

### Onde ficam os tokens

- **`shared/tokens.css`** — **a paleta inteira**, e só ela. Carregada pelos
  **dois** apps, antes da folha de cada um (`<link rel="stylesheet"
  href="../shared/tokens.css">`).
- **`controle/controle.css`** — o `:root` do que **não é cor**: raio, escala de
  ícone, curva de toque e as duas medidas de layout que o JS também lê
  (`--deck-pv-h`, `--fader-cap`). São decisões da UI **densa** do Controle, e o
  Display (que não tem UI) não teria o que fazer com elas.
- **`display/display.css`** — **nenhum token de cor**. Ele consome de
  `tokens.css`: `--brand`, `--wallpaper`, `--lyrics-frame-bg`, os `--stage-*`,
  `--bg` e `--accent-glow`. Essa lista está no topo da folha para ser conferida:
  se ela e um `grep var(--` divergirem, é a lista que está errada. **O Display
  nunca escreve `data-tema`**, então ele fica no bloco escuro por omissão — e os
  tokens do palco que ele mais usa não têm tema de qualquer forma.

**Por que uma folha só.** Até a v5.47 os tokens de marca (`--gold`,
`--wallpaper`, `--lyrics-frame-bg`, `--danger`) eram mantidos **à mão nas duas
folhas**, e o comentário das duas admitia que "a sincronização é manual".
Sincronização manual entre dois arquivos é uma classe de bug, não um processo:
bastava um ajuste entrar só de um lado para o telão e a preview do Controle —
que existe justamente para **espelhar** o telão — passarem a mostrar coisas
diferentes. O precedente de folha compartilhada já existia
(`../shared/material-symbols.css`).

### Tokens

Os valores abaixo são de `shared/tokens.css`, que é a fonte; as razões são
medidas (luminância relativa WCAG, com as superfícies `rgba` compostas contra o
fundo real de cada contexto). **Duas colunas de valor**, uma por tema; onde há
só uma, o token está no bloco COMPARTILHADO e vale nos dois.

| Token | Escuro | Claro | Uso |
|---|---|---|---|
| `--bg` | `#0e1215` | `#dfe3e7` | fundo do app. A matiz é a do denim (211°) em vez de um cinza puro: um cinza neutro ao lado de um accent azul lê como esverdeado |
| `--bar` | `#252b33` | `#ffffff` | bottombar / trilho de abas |
| `--panel` / `--panel-2` | `#2c343c` / `#3b4550` | `#ffffff` / `#dee2e8` | cartões e linhas de lista / o item ativo ou selecionado. **A direção se inverte no claro** (ver "A montagem dos dois temas") |
| `--line` | `#4f5966` | `#97a5b4` | **todas** as bordas e separadores — 2,65:1 contra o fundo no escuro, 1,95:1 no claro |
| `--surface` / `--surface-2` | `rgba(255,255,255,.12)` / `.18` | `rgba(255,255,255,.70)` / `.92` | botão / chip-campo-badge **sobre o fundo do app** (ver R1). Branco com alfa nos DOIS temas: o controle FLUTUA sobre a página |
| `--surface-sunk` / `--surface-2-sunk` | `rgba(0,0,0,.24)` / `.14` | `rgba(0,0,0,.06)` / `.10` | os mesmos dois **dentro de um cartão**, onde o sinal se inverte e o controle AFUNDA. Eram literais em `controle.css` até a v5.192 — os últimos pedaços de cor fora da fonte única, e o tema claro herdaria um recesso de 24% de preto sobre um cartão branco |
| `--text` / `--muted` | `#dce0e5` / `#b0b7bf` | `#4a4a4a` / `#5c636c` | texto (14,19:1 sobre o fundo · 9,52:1 sobre painel no escuro; 6,87:1 · 8,86:1 no claro) / secundário. **No claro o `--text` é o `night` OFICIAL**; o `--muted` é derivado, porque o `winter` oficial (#717171) passa sobre branco (4,88:1) e cai para 3,81:1 sobre o cinza da página |
| `--accent` | `#8fb1f3` | `#2f557f` | o azul como **texto, ícone e borda**. No escuro é o `bluejay` CLAREADO (o oficial dá 3,97:1 sobre o fundo e reprova): 8,74:1 sobre o fundo, 5,86:1 sobre painel. No claro é o `denim` OFICIAL: 7,70:1 sobre painel, 5,97:1 sobre a página |
| `--accent-fill` | `#2f557f` | `#2f557f` | o **`denim` OFICIAL** como fundo de elemento preenchido (aba ativa, botão primário), nos dois temas. 2,44:1 contra o fundo escuro — exatamente o peso que o preenchido âmbar tinha (2,59:1) |
| `--on-accent` | `#e8edf3` | `#ffffff` | o que se escreve **em cima** de `--accent-fill` — 6,54:1 e 7,70:1. O par branco-sobre-denim é o que a própria identidade recomenda; no escuro vale a regra do off-white, e a folga sobra nos dois |
| `--accent-soft` | `rgba(143,177,243,.16)` | `rgba(47,85,127,.12)` | fundo suave de estado ativo |
| `--accent-glow` | `rgba(143,177,243,.32)` | `rgba(47,85,127,.28)` | halo do `.start-pill` do Display. Segue a MATIZ do accent, não o `--accent-fill`: um halo na cor do preenchimento (escuro por definição) sobre o fundo escuro seria invisível. **Saiu do botão de conectar do simplificado bloqueado na v5.75** — ali quem separa o botão do fundo é a cortina embaçada |
| `--brand` / `--brand-soft` / `--brand-text` | `#8fb1f3` / `rgba(143,177,243,.16)` / `#c2d4f8` | `#2f557f` / `rgba(47,85,127,.12)` / `#24446a` | marca ("IASD"): logo, capa da letra, pill "Ligar Sistema", rótulo de estrofe, destaque da busca por letra. Mesmo valor do accent — os dois nomes existem para distinguir marca de navegação na folha |
| `--live` / `--danger` | `#d0021b` | `#d0021b` | o **`scarlett` OFICIAL**, e **só** como preenchimento/borda de "está no ar agora" (ou de superfície destrutiva, que hoje não existe). Como texto ele reprova: 3,32:1 sobre o fundo escuro |
| `--on-live` | `#f6eeef` | `#ffffff` | o que se escreve sobre `--live` — 4,96:1 e 5,67:1 |
| `--live-strong` / `--danger-strong` | `#f97a7e` | `#b80419` | **o vermelho que se lê como vermelho** (v5.76): ícone, borda e marca preenchida. Derivado do `scarlett` (matiz 358°/353°), clareado no escuro e escurecido no claro. Escuro: 7,27:1 sobre `--bg`, 6,59:1 sobre o soft, 4,88:1 sobre `--panel`, **3,77:1 sobre `--panel-2`** — este passa o piso de borda e reprova o de texto, e é por isso que quem veste este vermelho veste junto o fundo suave da própria família. Claro: 4,63:1 sobre o soft, 6,84:1 sobre o painel |
| `--danger-text` | `#e98d83` | `#93382e` | o salmão, para os TRÊS casos em que o `-strong` não serve: a falha na miniatura do YouTube, o pulso de erro e o aviso de falha pousado direto no painel — 5,17:1 sobre `--panel` no escuro, 7,38:1 no claro |
| `--live-soft` / `--danger-soft` | `rgba(208,2,27,.22)` | `rgba(208,2,27,.08)` | fundo suave de "no ar" / destrutivo. O alfa é MUITO menor no claro: qualquer tinta ali escurece a base e derruba o contraste do texto que pousa em cima |
| `--warn` / `--warn-text` / `--warn-soft` | `#ef853f` / `#e5a86c` / `rgba(205,73,0,.18)` | `#bd520a` / `#934410` / `rgba(205,73,0,.08)` | aviso: borda/ícone, texto, fundo. Derivados do **`campfire` OFICIAL** (matiz 21°) — 6,34:1 e 7,95:1 sobre o próprio suave no escuro; 3,38:1 (piso de ícone) e 4,81:1 no claro |
| `--ok` / `--ok-soft` | `#80bd64` / `rgba(43,133,0,.20)` | `#216900` / `rgba(33,105,0,.08)` | concluído/conectado. Derivado do **`treefrog` OFICIAL** (matiz 101°), clareado e DESSATURADO no escuro — no talo ele vira um limão que grita mais que o accent. 5,64:1 sobre painel · 8,41:1 sobre o fundo; no claro 6,81:1 sobre o painel |
| `--stage-bg` / `--stage-text` | `#000` / `#fff` | *(idem)* | **o palco**, não a UI, e por isso NÃO tem tema: o preto é preto de verdade (as barras do letterbox têm de sumir na moldura da TV) e o texto projetado é branco pleno — num telão a legibilidade vem de luminância máxima, não de um off-white calibrado para uma tela a 30 cm do rosto |
| `--stage-text-soft` / `--stage-text-dim` | `rgba(255,255,255,.9)` / `.72` | *(idem)* | marca sobre o wallpaper / linha auxiliar da letra |
| `--scrim` | `rgba(0,0,0,.6)` | *(idem)* | cortina de modal (bottom-sheets e diálogo). Preta nos dois temas — é assim que um modal se destaca em qualquer UI, e no claro ela é o único elemento que precisa vencer uma página branca |
| `--shadow-cap` / `--shadow-card` / `--shadow-ink` | `rgba(0,0,0,.5)` / `.55` / `.9` | *(idem)* | as três elevações nomeadas. Compartilhadas porque sombra é preto com alfa nos dois temas, e os consumidores de `--shadow-ink`/`--shadow-card` pousam sobre a preview (mídia arbitrária), onde clarear a sombra é apagá-la |
| `--veil` / `--veil-solid` | `rgba(14,18,21,.55)` / `.92` | `rgba(223,227,231,.55)` / `.92` | cortina do bloqueio do modo simplificado. É o `--bg` com alfa, e os dois têm de andar **juntos**: senão o véu vira um retângulo mais escuro (ou mais claro) que o app inteiro, justamente na tela que abre por padrão sem TV conectada. A variante sólida cobre o caso sem `backdrop-filter` |
| `--wallpaper` | `#04070d` | *(idem)* | a cor de BASE por baixo do desenho padrão do telão (o símbolo oficial sobre denim profundo, em `shared/wallpaper-padrao.svg`). **A URL não pode morar no token**: um `url()` substituído por `var()` resolve contra a PÁGINA, não contra a folha — quem aponta para o SVG são `display.css` e `controle.css`, com o mesmo caminho relativo |
| `--lyrics-frame-bg` | `rgba(0,0,0,.62)` | *(idem)* | fundo da faixa da letra (modo imagem). **Sem borda**: o contorno branco desenhava um retângulo que competia com a letra, e quem separa o texto da foto é a faixa. A densidade foi escolhida pelo PIOR caso — uma foto branca: `.40` deixava o fundo em ~`#999` (**2,85:1** com o texto branco, reprovado); `.62` põe em ~`#616161`, **6,2:1** |
| `--b-*` / `--bt-*` | dez pares | dez pares | ladrilhos da Bíblia: tinta + a matiz da faixa lateral, invertidas entre os temas. Ver "Ladrilhos da Bíblia" |
| `--cell-chapter{,-text}` / `--cell-verse{,-text}` | `#283543`/`#d6e0eb` · `#433a28`/`#ede5d4` | `#cedff3`/`#183d67` · `#f4e5c7`/`#654310` | células de número da Bíblia. Tons distintos **de propósito** — capítulo frio (a matiz do denim), versículo quente: as duas grades são iguais em forma e conteúdo (só números) e ficam uma sobre a outra na mesma tela |

(Os tokens `--yt`/`--yt-soft` saíram com o selo `.yt-badge` na v5.118, quando a
origem do item virou o subtítulo `.row-sub`; `--live-text` saiu na v5.76 e o
valor dele vive em `--danger-text`.)

Fora de `tokens.css`, no `:root` do Controle (não são cor):

| Token | Valor | Uso |
|---|---|---|
| `--radius-btn` / `--radius-card` / `--radius-pill` | `8px` / `10px` / `999px` | botões e controles / cartões e painéis / badges, chips, pills |
| `--radius-sheet` | `18px` | bottom-sheet — raio MAIOR que o de cartão, e só nos cantos voltados para dentro da tela. É o que lê como "folha que deslizou de fora" em vez de "cartão grande". Eram três `18px` literais, três chances de divergirem |
| `--radius-xs` | `4px` | marcas menores que um botão (badge de 1px de padding, realce de uma linha de letra, a linha-guia de arraste). Com `--radius-btn` elas viram cápsulas; sem raio nenhum, cortes secos no meio do texto |
| `--deck-pv-h` | `130px` | altura da faixa da preview na grade do `.deck` — é token porque a LARGURA da preview sai dela (altura × proporção do telão) |
| `--fader-cap` | `26px` | espessura do cap do fader — **dois** faders a usam (mixer e modo simplificado), e a posição do número sai dela |
| `--icon-sm` / `--icon-md` / `--icon-lg` | `20` / `22` / `24px` | escala dos **glifos de fonte** (`.msym`). Os SVGs inline trazem `width`/`height` no próprio HTML e nunca estiveram sob ela; o modo simplificado tem escala própria, porque ali o alvo é o polegar de quem está de pé |
| `--press` | `scale(.96)` | feedback de toque padrão: todo `:active` usa `transform: var(--press)` |
| `--kb` | `0px` | altura coberta pelo teclado virtual, escrita pelo JS (ver "Deslocamento com o teclado virtual") |

### Métodos/convenções visuais padronizados

- **Feedback de toque:** todo elemento interativo usa
  `:active { transform: var(--press); }` (antes havia `scale(.95/.96/.97/.98)`
  misturados — unificados em `.96`). A regra é **UMA SÓ**, um `:is(...)` com a
  lista de seletores logo depois do bloco `:root`. Antes ela estava repetida em
  17 lugares e, ainda assim, nove controles ficavam de fora (voltar, abas,
  seleção múltipla, botões de linha, fechar popup, escolher pasta,
  preenchimento, linha de música…): como o `*` zera o tap-highlight, esses
  ficavam **totalmente mudos ao toque** no aparelho. Com a lista única, um botão
  novo entra acrescentando um nome — não copiando uma regra.
- **Tamanho de ícone:** três degraus — `--icon-sm` (20px, botões de
  linha/cabeçalho/popup), `--icon-md` (22px, abas e transporte) e `--icon-lg`
  (24px, miniatura-ícone, dicas de deslize e barras largas de ação). Antes havia
  oito tamanhos (19…27px), cinco deles usados uma única vez. **Desde a v5.49 a
  escala governa também os SVGs inline**, por dois `:is(...)` logo depois do
  bloco de feedback de toque: até ali ela valia só para os GLIFOS de fonte
  (`.msym`, via `font-size`), e os SVGs traziam `width`/`height` escritos no
  HTML e no JS — 14, 16, 17, 19, 20, 22, 26, 28, 30 e 44 px espalhados por dois
  arquivos. O efeito não era teórico: o `#addDirBtn` (19px, SVG) e o `#backBtn`
  (20px, glifo) são vizinhos no mesmo cabeçalho, com a mesma caixa de 34px, e o
  ícone de um saía menor que o do outro sem que nada na folha dissesse por quê.
  O atributo do elemento continua no HTML como valor de partida (vale antes de
  o CSS carregar), mas quem manda é a regra. **Duas exceções**, cada uma dita
  no lugar onde mora: os ícones nos cantos da preview (`.pv-fab`, 24px — sem
  moldura, o ícone É o botão) e o modo simplificado (28px nas teclas, 44px no botão de
  conectar), onde o alvo é o polegar de quem está de pé. "Três degraus **e só
  eles**" era a frase antiga, e ela era desmentida por dezenas de valores no
  HTML; agora ela é verificável.
- **Alvo de toque:** dois degraus, e desde a v5.49 são **tokens** — `--hit`
  (34px) e `--hit-nav` (38px, a faixa de navegação: `.tab` e `.tab-add`). O piso
  de 34px vale para `.row-btn`, `.row-handle`, `.popup-close`, `.back-btn`,
  `.add-dir-btn`, `.sel-btn`, `.coll-bar-dl`, `.coll-group-btn` e `.pv-fab`.
  Nada abaixo disso — o `.back-btn` já teve 20×20 px sendo a única saída da tela
  de Favoritos e da navegação da Bíblia, com o `#addDirBtn` (que abre o SAF)
  logo ao lado. Antes o 34 estava escrito literal em sete regras e, ainda assim,
  dois controles ficavam fora da escala por descuido: `.sel-btn` com 36px e o
  botão do acervo com 42×38 — sete literais é o que faz uma escala de duas
  medidas render quatro tamanhos na mesma tela. Os dois botões de baixar
  (`.coll-bar-dl` no card e `.coll-group-btn` no cabeçalho de grupo) têm o
  **mesmo** alvo de propósito: alinhados na mesma coluna, tamanhos diferentes
  fariam os centros discordarem.
- **Receita repetida vira seletor agrupado, não cópia:** os estados de cor são
  declarados por ESTADO (`.view-blocked`/`.muted`/`.danger` num bloco,
  `.active` noutro), a coluna "nome + subtítulo" das linhas de lista é uma regra
  para `.coll-bar-info, .bible-ver-main, .hymn-info`, e `.tab-add` divide a
  caixa de `.tab` (`flex:1`, `--hit-nav`, mesmo raio) em vez de reescrevê-la.
- **Ordem importa quando a especificidade empata:** `.pv-text { z-index: 2 }`
  precisa vir DEPOIS de `.pv-layer { z-index: 1 }` (o elemento tem as duas
  classes). Já esteve antes, e o cartão de texto só ficava acima do iframe do
  YouTube por acaso, pela ordem no DOM.
- **Realce de toque:** `-webkit-tap-highlight-color: transparent` e
  `user-select: none` ficam **só no seletor `*`** (topo da folha) — **não
  repetir** por elemento (era redundante em ~12 regras, removido).
- **Exceção de seleção de texto:** só `input, textarea` no Controle (o campo de
  busca precisa ser editável) — ver "Regras de desenvolvimento".
- **Cantos:** botões/controles = `--radius-btn`; contêineres = `--radius-card`;
  pills/badges = `--radius-pill`; bottom-sheets = `--radius-sheet`; marcas
  menores que um botão = `--radius-xs`. Os dois últimos existem porque três
  `18px` e vários `4px` literais eram três (e vários) chances de divergirem no
  primeiro ajuste. **Quatro botões largos violavam a primeira metade da regra**
  e foram corrigidos na v5.49 (`.import-btn`, `.msg-add-btn`, `.new-folder-btn`
  e `.folder-pick-btn` usavam `--radius-card`): a maioria dos botões largos do
  app — `.misc-project`, `.mic-btn`, `.chrono-btn`, `.draw-go`
  — sempre usou `--radius-btn`, então eram esses quatro que destoavam, e dois
  deles ("Importar arquivos" e "+ Nova mensagem") são o mesmo tipo de botão
  tracejado em telas diferentes. Na mesma passada o tracejado de `.msg-add-btn`
  virou `--accent` como o de `.import-btn`: dois botões de "acrescentar" com
  bordas de cores diferentes. Casos especiais deliberados que continuam fora do
  sistema: `border-radius: 0` da faixa da letra ("vídeo de louvor", cantos
  retos) e `50%` do thumb do fader.
- **Cor literal fora do sistema: nenhuma.** As duas folhas não contêm `#fff`
  nem `#000` soltos — o preto do palco é `--stage-bg`, o branco projetado é
  `--stage-text`, e até o halo do `.start-pill` virou `--accent-glow`. É a
  regra R3.

### O RISCADO é o corte; a cor confirma; o rótulo nomeia a ação

Regra única para os dois cortes do app — o som e a imagem —, na tela **e** na
notificação do app nativo: **o ícone riscado significa CORTADO**. Alto-falante
riscado = mudo; imagem riscada = telão coberto. Na tela, quem reforça é a
**cor/borda** (`.view-blocked`, `.muted`, `.blocked`), que pinta o botão
inteiro; na notificação, onde não há cor de estado, quem nomeia a ação é o
**rótulo** ("Cobrir telão" / "Mostrar mídia").

A v5.47 tinha adotado o **oposto** — "o ícone é o que o toque vai fazer" — e o
problema que ela atacava era real: estado e ação conviviam misturados, o ▶/⏸
sendo ação enquanto cortina e mudo eram estado, e o mesmo gesto (olhar o ícone)
significava coisas opostas conforme o botão. Só que a saída escolhida gastava o
**riscado** — o símbolo universal de "cortado", o mesmo que o Android usa na
própria tecla de volume — para dizer justamente que NADA está cortado. Nada se
perde invertendo: a cor já carrega o estado sozinha, e a informação que o ícone
passa a dar é a que se lê sem aprender nada.

| Estado | Ícone | Cor |
|---|---|---|
| mídia no ar | imagem inteira | neutra |
| telão coberto | **imagem riscada** | vermelha (`.view-blocked`) |
| som ligado | alto-falante inteiro | neutra |
| mudo | **alto-falante riscado** | vermelha (`.muted`) |
| áudio bloqueado no Display | **alto-falante riscado** | âmbar pulsante (`.blocked`) |

Os dois últimos compartilham o ícone de propósito: nos dois **não sai som**, que
é o que o riscado diz; o que os distingue — mudo do operador × bloqueio do
navegador — é a cor, e a distinção só importa para saber o que o toque vai
tentar (mutar × pedir liberação), que é o que o `title` diz.

**O ▶/⏸ segue sendo AÇÃO**, e isso não é inconsistência: ali a convenção é de
plataforma (todo player do mundo mostra ▶ quando está pausado), o botão não tem
cor de estado, e o par não é "cortado/não cortado".

**A exceção é o `repeat`** (`renderRepeat`), e ela é de forma, não de gosto: o
botão CICLA por quatro modos (off → all → one → shuffle). Num ciclo o glifo só
cabe um, e mostrar o próximo apagaria da tela qual está valendo — a cor
distingue ligado de desligado, não qual dos três. Ali o ícone segue sendo o
modo atual, que é a informação que se perderia.

Botões de **função** (engrenagem de Configurações, folha da leitura auxiliar) e
**segmentados** (modo do app, tema, preenchimento, imagens dos slides,
wallpaper) ficam fora da regra por natureza: não alternam duas ações opostas — o
ícone nomeia o recurso, e o segmento marcado diz o resto.

**⏮/⏭ são um terceiro caso**, e o único em que a cor não diz um estado do
sistema e sim o EIXO do botão: `.slide-mode` (contorno em accent) significa "o
toque curto passa estrofe", e `.axis-end` (esmaecido) significa "esse caminho
acabou; o toque longo ainda troca de mídia". Ver "Um par de botões, dois eixos".

### Só preenchimento, nenhum contorno (v5.267)

Pedido do operador: *"não tenhamos itens usando linha de borda, tudo deve ser
com preenchimento sólido, e definição feita por puro e simples contraste entre
os elementos."*

Saíram **82 declarações** de `border`/`outline` das folhas da base. O que
sobrevive são dois DESENHOS, e eles estão nomeados um a um no oráculo — não
detectados por heurística, porque uma heurística deixaria a próxima borda entrar
chamando-se desenho:

- o aro do `.dl-ring` e o do `.av-stage-busy` (os anéis que giram enquanto o app
  espera) — eles **são** círculos, não a moldura de um elemento;
- o ✓ do `.song-menu-check` (duas bordas em L, giradas 45°) — é o glifo que
  falta no subset da fonte de ícones.

**São DOIS oráculos, e nenhum basta sozinho.** `tools/tokens.test.mjs` (Node
puro, sem `continue-on-error`) varre a FONTE e prova que nenhuma regra NOSSA
desenha contorno; `tools/smoke.mjs` mede o RENDERIZADO e prova que nada desenha
borda na tela. O segundo existe porque o primeiro é cego por construção para o
defeito que este lote de fato produziu: **o padrão do navegador não é "sem
borda"**. A folha do UA dá a todo `<button>` um `border: 2px outset` e a todo
campo um `2px inset` — `outset` é um bisel, duas cores —, então tirar a nossa
declaração não removia borda nenhuma daqueles controles, deixava passar a dele.
O `appearance: none` que muitos já declaravam não cobre isso: ele desliga o
desenho nativo do controle, não a borda do UA. A correção é `border: 0` no
reset universal, e ela mora ali e não em cada componente porque o esquecimento
não aparece na folha — aparece no aparelho.

**E é ele que a faz durar.** Uma borda é a coisa mais fácil de acrescentar em
CSS quando duas caixas não estão se separando o bastante — é literalmente o
remendo que este lote veio desfazer — e ela não quebra nada, não erra alto e não
aparece em teste de comportamento nenhum. A varredura é da FONTE e não do
renderizado de propósito: metade das bordas que saíram morava em regras de
ESTADO (`.active`, `.no-ar`, `.expanded`) e em pseudo-elementos, que uma
caminhada pelo DOM só alcançaria se o teste soubesse encenar cada estado.

#### O que substituiu cada contorno

| Era | Virou |
|---|---|
| linha `.active`/`.selected` de uma linha de lista | `--sel-fill`, um fundo OPACO |
| linha `.no-ar` (vermelha) | `--live-fill`, idem |
| `--ok` contornando "já conectado" | `--ok-fill`, idem |
| tracejado de "espaço a preencher" (`.import-btn`, `.selbar`, `.pl-pack`) | preenchimento em `--accent-soft` |
| segmentado/chip marcado (`--accent-soft` + borda) | `--accent-fill` + `--on-accent`, o par que a aba ativa já usava |
| filetes separadores (cabeçalho e rodapé de folha, faixas de álbum, metades da Bíblia) | ESPAÇO |
| faixa lateral do grupo na Bíblia e da estrofe no ar | `linear-gradient` — os mesmos pixels, declarados como o preenchimento que sempre foram |
| anel externo da célula ativa da Bíblia (`outline`) | a célula inteira em `--accent-fill` |
| moldura da preview (`outline`) | `box-shadow: 0 0 0 2px var(--camada)` — uma faixa preenchida que não entra no `aspect-ratio` |
| anel do eco (`.btn-eco`) | `box-shadow` de mesma espessura |
| aresta de 1px do tema claro (`--control-edge`, v5.207) | `--surface-sunk`/`--surface-2-sunk` mais fundos (.14/.20): **1,32:1** e **1,51:1** contra o painel branco, contra os 1,14:1 que motivaram a aresta |

#### Os três fundos de ESTADO são OPACOS, e a razão é medida

`--sel-fill`, `--live-fill` e `--ok-fill` substituíram o par "contorno + tinta
com alfa". Serem opacos não é preferência: **`--accent-soft` a 16% sobre o
painel compõe `#3d4959`, que é o `--panel-2` desta paleta** — isto é, uma linha
SELECIONADA ficava com a cor exata do nível de baixo da árvore, e o que a
distinguia era só a borda que saiu. Opacos, os três valem o mesmo em qualquer
nível: um estado **sai** da escada em vez de ocupar um degrau dela.

E o sinal principal deles é a MATIZ, não a claridade — `--live-fill` fica a
1,03:1 do painel de propósito. Uma linha vermelha entre linhas cinzas se acha
sem precisar ser mais clara que elas, e é a matiz que sobrevive ao brilho baixo
de um salão escuro, onde meio degrau de luminância não sobrevive.

#### A regra do vermelho mudou de eixo

Era "PREENCHIDO = está no ar · CONTORNADO = ação destrutiva". Sem contorno, o
que separa os dois é a INTENSIDADE do mesmo preenchimento:

- **saturado** (`--live` + `--on-live`) = está no ar agora, e só isso — o
  microfone aberto, o ponto de projetando. É o vermelho que não pode ter
  concorrente na tela;
- **suave** (`--live-fill` numa linha, `--danger-soft` num chip ou botão) = ação
  destrutiva, ou "no ar" numa lista. Continua sendo vermelho e continua sem
  competir com o que está de fato no telão.

### Escada de elevação, e a regra que faltava

O que separa duas camadas não é a cor de cada uma, é o **degrau** entre elas:
no celular, com brilho baixo no salão, uma escala quase plana faz botão e fundo
virarem a mesma mancha escura. Degraus da paleta atual:

| Par | Razão | Piso |
|---|---|---|
| fundo × barra de abas | **1,32:1** | 1,30 |
| fundo × painel (nível 1) | **1,49:1** | 1,30 |
| painel × painel-2 (nível 2) | **1,33:1** | 1,30 |
| fundo × `--surface` (botão sobre o fundo) | **1,38:1** | 1,30 |
| painel × `--surface` recuada (botão DENTRO do cartão) | 1,18:1 | assumido |
| painel × `--surface-2` recuada (chip dentro do cartão) | 1,11:1 | assumido |

**O par `--panel` × `--panel-2` cumpre o piso desde a v5.267, e a mudança tem
causa.** Ele valia 1,28:1 e o texto que estava aqui assumia isso com um
argumento que caiu junto com as bordas: *"ele não carrega o estado sozinho em
lugar nenhum — quem diz 'selecionado' é sempre a borda em `--accent`"*. Sem
borda em lugar nenhum do app, este degrau passou a ser o ÚNICO separador entre
uma seção da Biblioteca e o card de álbum dentro dela, e um piso não se cumpre
"quase". `--muted` e `--accent` foram clareados um degrau na mesma conta — no
valor antigo o accent caía a **4,40:1** sobre o painel-2 novo, e reprova AA.

`--line` saiu da tabela porque saiu do papel: não há mais filete nem contorno em
lugar nenhum. Ele sobrevive como TINTA de dois desenhos (a estrela vazada de
favorito, a barra de rolagem das grades da Bíblia).

#### R0 — a escada tem TRÊS degraus, e o quarto é o espaço

Um quarto tom obrigaria o nível mais interno a subir até ~`#4c5865` no tema
escuro, onde `--muted` mede **3,59:1** e `--accent` **3,37:1** — os dois
reprovam AA para texto pequeno, que é exatamente o tamanho do texto de uma linha
de lista. Então a árvore para em três, e quem carrega o quarto nível é o
ESPAÇO: uma faixa dentro de um álbum aberto não tem caixa nenhuma, e o que a
separa da vizinha é o tom do próprio álbum aparecendo entre elas.

No tema CLARO a escada **não é monotônica**, e isso é aritmética e não descuido:
a página é cinza e o nível 1 é branco (a convenção de toda UI clara), então o
primeiro degrau sobe e os seguintes só podem descer — `#dfe3e7` → `#ffffff` →
`#d4dae2`. Folha e card ficam a 1,09:1 um do outro e isso não se lê como
ambiguidade, porque os dois **nunca se encostam**: entre eles há sempre a
moldura branca da seção. `tools/smoke.mjs` mede os pares ADJACENTES (piso 1,28)
e exige apenas que nenhum par coincida (piso 1,05) — a primeira versão daquele
caso exigia monotonia e reprovava um desenho correto.

#### R1 — a superfície AFUNDA dentro de um cartão

O ponto estrutural desta versão. `--surface`/`--surface-2` são branco com alfa
**de propósito**: um botão mantém o mesmo degrau relativo esteja ele sobre o
fundo do app ou sobre a barra — três valores fixos divergiriam no primeiro
ajuste. Mas alfa **EMPILHA**: 12% de branco sobre `--bg` dá `#2f2e2e`, e o
MESMO token sobre `--panel` dá `#4c4b49` — os canais sobem 1,6× e a **luminância
relativa mais que dobra** (2,6×), que é o que o contraste enxerga.
Era essa a causa raiz do pior contraste do app — todo texto e ícone colorido
dentro de um cartão reprovava AA porque a base dele era muito mais clara do que
a folha supunha. O pior caso medido: o ícone de cancelar um download, **2,32:1**.

**Não existe alfa que resolva.** Para o botão manter degrau ≥ 1,30:1 contra o
fundo do app é preciso α ≥ .10; para o texto colorido passar AA dentro do
cartão é preciso α ≤ .08. São incompatíveis, porque um único overlay não pode
servir a duas bases.

A saída é **inverter o sinal dentro do cartão** — que também é a convenção
correta de UI escura (o cartão já está elevado, então o controle dentro dele é
**recesso**) e ainda emite menos luz, o que importa num salão no escuro:

```css
.row-item, .lib-item, .hymnal-card, .msg-item, .bible-vsec,
.dialog-card, .popup-sheet, .fade-row, .simple-lyrics, .simple-key,
.coll-group--drop, #hymnSearchPopup .hymn-search-bar {
  --surface:   var(--surface-sunk);
  --surface-2: var(--surface-2-sunk);
}
```

Como custom properties **herdam**, essa regra só precisa marcar os elementos
que de fato pintam `--panel` de fundo: toda a descendência vem junto, não há
componente a ajustar, e um componente novo nasce coberto.

Os VALORES saíram daqui na v5.192 e viraram `--surface-sunk`/`--surface-2-sunk`
em `tokens.css` (o tema claro precisa de outros dois alfas). E o par FLUTUANTE
ganhou nome próprio na v5.267 — `--surface-alta`/`--surface-2-alta` — porque
passou a existir um caminho de VOLTA: a folha da Biblioteca é nível 0, então os
controles lá dentro flutuam de novo, e um override do mesmo nome não daria isso
(`--surface: var(--surface-alta)` funciona; `--surface: var(--surface)` é um
ciclo, que o CSS descarta).

#### R1.1 — `--camada`: o tom que um bloco veste é decisão do PAI (v5.267)

Pedido do operador: as ramificações da Biblioteca *"visualmente se parecem
muito, dificultando discernir se estou em uma camada ou subcamada"*.

O degrau de tom era só metade do defeito. A outra era que **o mesmo componente
ocupava níveis diferentes da árvore conforme a tela, e pintava sempre a mesma
cor**: uma `.lib-item` na tela principal está sobre `--bg`; a mesma `.lib-item`
dentro da folha da playlist está sobre `--panel` — e pintava `--panel` também,
dois tons idênticos encostados. Escrever isso como seletores descendentes daria
uma regra por combinação, e a próxima tela nasceria com a combinação faltando.

`--camada` é UMA propriedade com um significado só: **o tom que um bloco filho
DESTE contêiner deve vestir.**

```css
:root { --camada: var(--panel); }                    /* página → nível 1 */
.popup-sheet, .dialog-card, .simple-conn { --camada: var(--panel-2); }
.popup-sheet--full { --camada: var(--panel); }       /* é uma TELA, não um cartão */
.coll-group-corpo { --camada: var(--panel-2); }
.coll-songs { --camada: transparent; }               /* não há nível 3 */
```

**Quem a declara é o CONTÊINER, nunca quem pinta**, e isso não é estilo: uma
propriedade escrita no próprio elemento vence na hora de ELE resolver
`var(--camada)`, então um bloco que reservasse o tom dos filhos em si mesmo
passaria a vestir aquele tom. A primeira versão desta regra pôs
`.coll-group--drop` na lista e a seção passou a vestir a cor do card — isto é, o
defeito da v5.241 de volta, e foi o oráculo da escada que o pegou, nos dois
temas.

A árvore da Biblioteca fica assim, e é a mesma da tela principal um nível acima:

```
folha de tela cheia   --bg          nível 0   (era --panel até a v5.267)
  └ seção             --panel       nível 1   (barra + corpo, UM bloco sólido)
      └ card do álbum --panel-2     nível 2
          └ faixa     (sem fundo)   separada da vizinha pelo ESPAÇO
```

**O preço, medido e assumido:** o degrau recuado contra o cartão cai para
1,18:1 (botão) e 1,11:1 (chip). Ali, diferente do fundo do app, o degrau não é
o que anuncia o controle — dentro de um cartão o botão tem ícone, e a linha em
`--line` do próprio cartão já o separa do resto. O que **não** era negociável
era o texto: nenhum par colorido dentro de cartão reprova AA depois desta
regra, e o ícone de cancelar download vai de 2,32:1 para **7,36:1**.

### Uma cor não serve aos dois papéis (accent / accent-fill / on-accent)

`--accent` já foi um valor único usado como **cor de texto** e como **fundo com
texto por cima**. Isso é contradição aritmética, não questão de gosto: para ser
legível COMO TEXTO sobre fundo escuro a cor precisa ser clara; para RECEBER
texto por cima precisa ser escura. Daí três tokens, um por papel:

- **`--accent-fill`** — fundo de elemento preenchido (aba ativa, botão
  primário). É o par **fundo/texto** que reprovava na paleta anterior, e não a
  cor como texto: o azul preenchido com branco por cima passava raspando
  (**4,63:1**), mas o mesmo desenho aplicado ao vermelho — o botão "no ar",
  `--danger` cheio com `#fff` — ficava em **4,23:1**, abaixo dos 4,5 exigidos.
  Separar o papel de fundo do papel de traço é o que torna esse par uma decisão
  em vez de um acidente.
- **`--on-accent`** — o que se escreve em cima de `--accent-fill`. Hoje
  **5,37:1**.
- **`--accent`** — texto, ícone e borda sobre fundo escuro: 8,65:1 sobre o
  fundo, 5,84:1 sobre painel. Elemento **decorativo** sem texto por cima (barra
  de progresso, linha de arraste, trilho de scroll) também usa este, que é o
  que os destaca.

> O texto normativo anterior citava um contraste de **2,66:1 para o azul como
> TEXTO**, e esse número não correspondia a medição nenhuma — o azul antigo
> (`#58a6ff`) dava 7,42:1 sobre o fundo. Ele fazia a régua da decisão parecer
> outra: sugeria que o problema estava no azul como texto, quando estava no
> par fundo/branco. Registrado aqui porque foi essa leitura errada que
> sobreviveu em três lugares da documentação.

### Regras do sistema

- **R1 — a superfície afunda dentro do cartão.** Acima.
- **R2 — `--live`/`--danger` NUNCA são cor de texto, ícone ou borda.** São
  escuros por construção: existem para receber `--on-live` por cima. Texto,
  ícone e borda de "no ar" ou de destrutivo usam `--live-strong`/`--danger-strong`
  (ou `--danger-text`, quando não há fundo suave da própria família).
  Usá-los como cor de traço é literalmente o defeito que produzia o 2,32:1.
- **R3 — branco literal não existe.** Sobre `--accent-fill` use `--on-accent`;
  sobre `--live` use `--on-live`; no resto, `--text`. Nenhuma das duas folhas
  contém `#fff` nem um `rgb(255,255,255)` opaco — as únicas ocorrências de
  branco são os `rgba` nomeados em `tokens.css` (`--surface`, `--stage-text*`).
- **R4 — um estado, uma cor.** A tabela de colisões acima é normativa: no ar =
  vermelho preenchido; selecionado = âmbar; concluído = verde; aviso = laranja
  suave + ícone.
- **R5 — os tokens de cor moram em `shared/tokens.css`**, carregado pelos dois
  apps. Não há mais o que dessincronizar.

### Contraste — o que foi medido

Todo par foi recalculado pelo algoritmo de luminância relativa da WCAG, com as
superfícies `rgba` **compostas contra o fundo real de cada contexto** — que é
justamente o passo que faltava antes. Pisos adotados: **4,5:1** para texto
pequeno, **3:1** para ícone/borda que carrega informação, **~1,30:1** para o
degrau entre duas superfícies grandes.

| Par | Antes | Agora |
|---|---|---|
| fundo × barra de abas | 1,19 ✕ | 1,32 |
| fundo × painel | 1,31 | 1,48 |
| painel × painel ativo | 1,22 ✕ | 1,28 (assumido) |
| fundo × borda | 1,95 | 2,64 |
| texto × fundo | 16,73 | 12,09 |
| rótulo apagado (`--muted`) sobre chip (`--surface-2`) no fundo do app | 4,31 ✕ | 5,06 |
| ícone de cancelar download (dentro do cartão) | 2,32 ✕ | 7,36 |
| rótulo sobre bloco de accent | 4,63 | 5,37 |
| rótulo sobre botão "no ar" | 4,23 ✕ | 4,74 |
| pior ladrilho da Bíblia | 3,94 ✕ | 8,66 |

Todas as combinações de **texto colorido contra todos os fundos do app** passam
AA, incluindo os oito fundos possíveis (fundo do app, cartão, cartão ativo,
botão e chip sobre o fundo, botão e chip dentro do cartão, botão no cartão
ativo).

### Ladrilhos da Bíblia

Deixaram de ser dez blocos saturados e passaram a ser **tinta escura + faixa
lateral de 3px com a matiz do grupo** (`--b-<grupo>` e `--bt-<grupo>`). Três
razões, e a primeira é a que motivou tudo:

- **Luz.** É a única tela do app que preenche o visor inteiro de cor, e é
  justamente a que o operador abre NO ESCURO no meio da pregação. Medida, ela
  emitia **16,3% de luminância média** contra 2,3% de um painel comum — 7×
  mais. Com a tinta são **2,8%**, ou seja **5,8× menos luz**.
- **Contraste.** Cinco dos dez grupos tinham o rótulo abaixo de AA, o pior em
  **3,94:1**. Com a tinta o pior rótulo vai a **8,66:1**, e a faixa mantém
  3,2:1 contra a própria tinta — suficiente para ela carregar a informação de
  agrupamento.
- **As matizes se sobrepunham.** `.bg-lei` e `.bg-evangelhos` ficavam a **1,4°
  de matiz** uma da outra: indistinguíveis. As novas foram redistribuídas com
  **18° de separação mínima**.

**AS MATIZES FORAM REANCORADAS NA IDENTIDADE OFICIAL (v5.192)**, e cinco delas
não puderam ser: a identidade adventista tem SETE famílias de matiz e esta
escala precisa de DEZ grupos separáveis. Cinco são oficiais e cinco preenchem os
vãos, com a separação mínima subindo para **20°**:

| Grupo | Matiz | Origem |
|---|---|---|
| lei | 220° | `bluejay` **oficial** |
| evangelhos | 240° | derivada — o vão entre bluejay e emperor |
| pmaiores | 272° | `emperor` **oficial** (a mesma matiz do `iris`) |
| pmenores | 304° | derivada — o vão entre emperor e lily |
| apocalipse | 48° | derivada — o dourado que este grupo sempre teve; a identidade não tem amarelo |
| historicos | 21° | `campfire` **oficial** |
| gerais | 101° | `treefrog` **oficial** (a mesma matiz do `forest`) |
| paulinas | 141° | derivada — o vão entre treefrog e ming |
| poeticos | 168° | derivada — idem, do outro lado |
| atos | 189° | `ming` **oficial** (a mesma matiz do `cave`) |

O `scarlett` fica **fora da escala de propósito**: vermelho é atenção neste app,
e um grupo de livros vermelho competiria com "está no ar" na mesma tela.

**No tema CLARO a tinta se inverte** — ladrilho claro, rótulo em `--text`. O
alvo do rótulo lá é **6,5:1**, e não os 8,7:1 do escuro, por aritmética: o texto
do tema claro é o `night` (#4A4A4A), não um off-white, então um ladrilho com
8,7:1 contra ele seria branco puro e a matiz do grupo sumiria — que é o oposto
do que a tela existe para fazer. Medido: pior rótulo 6,46:1, pior faixa 3,28:1
contra a própria tinta.

### Ao adicionar/alterar estilo

1. Existe token pro valor? Use-o. Não existe e o valor se repete? **Crie um
   token** — cor em `shared/tokens.css`, o resto no `:root` do Controle.
2. Fundo em accent? Escolha pelo **papel**: `--accent-fill` se houver texto por
   cima (e aí o texto é `--on-accent`), `--accent` se for texto/ícone/borda ou
   decoração.
3. Está pintando "no ar" ou "destrutivo"? R2: o traço é `--live-strong` /
   `--danger-text`, nunca `--live` / `--danger`.
4. Botão novo → acrescentar o seletor à lista `:is(...)` do feedback de toque;
   nada de tap-highlight nem de `:active` próprio.
5. Botão que alterna → ícone = ação, cor = estado (ver acima).
6. Atualizar esta seção e incrementar a versão (os três lugares — ver "Regras
   de desenvolvimento").

### Ao mexer em cor: NÃO há teste automatizado de CONTRASTE

**Não existe teste medindo contraste neste repositório**, e agora são DOIS temas
a medir à mão. O que existe, e não se confunde com isso, são dois oráculos que
pegam a classe de falha *silenciosa* do CSS: `tools/tokens.test.mjs` garante que
todo `var(--x)` sem fallback aponta para um token que EXISTE (um `var()`
inválido computa para o valor inicial da propriedade, sem aviso nenhum — foi
assim que os dois botões da folha de conectar ficaram com cantos retos na
v5.171) e que **nenhum token exista só no tema claro**; `tools/smoke.mjs` trava
o efeito RENDERIZADO nos dois temas, o palco que não os segue, a superfície que
afunda dentro do cartão e a escolha que sobrevive à recarga. Nenhum dos dois
mede razão de contraste.

O texto abaixo é de quando não havia oráculo nenhum, e o alerta continua valendo
para a COR em si. A documentação
anterior afirmava que existia ("há teste medindo isso na
tela renderizada — mudar um token para baixo desses valores falha"), e essa
frase é exatamente o motivo pelo qual dois pares (`--bg`×`--bar` em 1,19 e
`--panel`×`--panel-2` em 1,22) ficaram abaixo do piso declarado sem ninguém
notar: quem confia no doc conclui que uma regressão seria barrada no CI e
ajusta um token sem medir.

Enquanto não houver o teste, **meça à mão** antes de mudar um token: luminância
relativa WCAG, com as superfícies `rgba` compostas contra o fundo real do
contexto — **inclusive o caso "dentro de um cartão"**, que é onde as regressões
aparecem (R1).

---

## Fonte de ícones (Material Symbols)

Versão subconjuntada (~2.2 KB woff2): peso 400, **29 glifos + o espaço, todos
usados** na UI — referenciados por codepoint via o mapa `ICON` em `controle.js`
**ou** direto como entidade HTML `&#x…;` no `controle/index.html`.
**Só o Controle carrega a fonte** — o Display é só wallpaper + mídia, sem
nenhum glifo (por isso `display/index.html` não inclui
`material-symbols.css`/`.woff2`).

**Codepoints no subset** (v5.112):
```
E034 E037 E03B E03D E040 E041 E043 E044 E045 E047
E04F E050 E145 E14C E150 E251 E2C7 E2C8 E2CC E3A1
E3AD E5C4 E5CA E616 E838 E872 E945 EA5D EB80 F116
```

`E5CA` (check) entrou na v5.112 para o **pulso de confirmação**: o `✓` e o `✕`
eram os caracteres Unicode, desenhados pela fonte do SISTEMA (num Android
qualquer, a Roboto) — traço de caneta, com entrada e saída afinando e a perna do
✓ curvando. Ao lado de vinte ícones geométricos de traço constante, o sinal de
confirmação era a única coisa "desenhada à mão" da tela. Agora são `check` e
`close`, retos e do mesmo peso — e o ✕ do erro passou a ser literalmente o mesmo
glifo do botão de fechar.

A v5.110 fez a primeira limpeza real do subset: **saíram** `E5CF`
(expand_more), `E86C` (check_circle) e `E8F5` (visibility_off) — os três
estavam no woff2 sem uma única referência no código, e a varredura por
codepoint (caractere literal, `&#x…;` e `\uXXXX`) confirmou — mais `E413`
(photo_library), aposentado com a troca do ícone da aba. **Entraram** `E616`
(event_note), `EA5D` (more_time) e `E145` (add), pelas razões da caixa abaixo.
Resultado: um terço menor e sem nenhum glifo morto.

#### Cronograma × playlist: dois destinos, dois símbolos (v5.110)

Três ícones eram a mesma pilha de linhas com uma marquinha diferente no canto —
e a marquinha é justamente o que não se lê num toque:

| Onde | Antes | Depois |
|---|---|---|
| aba **Cronograma** | `photo_library` (pilha de fotos) | **`event_note`** — a agenda |
| **adicionar ao Cronograma** | `playlist_add` | **`more_time`** — relógio com `+` |
| **acrescentar à playlist** | `playlist_add` | `playlist_add` (segue) |
| playlist (transporte, `#plBtn`) | `queue_music` | `queue_music` (segue) |

O caso mais grave era o mesmo glifo (`playlist_add`) servindo aos DOIS destinos:
o botão `+` de uma linha mandava para o Cronograma e o da barra de seleção,
idêntico, para a playlist. Agora o Cronograma é a família do **tempo** — sem
linha nenhuma, então se separa da pilha à distância — e diz o que a lista é: a
ORDEM do culto, não uma fila de reprodução. A pilha de fotos, além de parecida
com as outras, nomeava a lista pelo que ela era antes da v5.103: hoje o
Cronograma guarda versículo, mensagem e contagem, não só arquivos com bytes.

O botão de adicionar da linha do acervo (`.hymn-add-btn`) virou o **`add`
neutro**: ele não escolhia destino nenhum, abria a folha que perguntava qual — e
carregar o ícone de um dos três destinos era prometer um caminho que o toque não
faz. (Ele SAIU na v5.285 com o ▶; o princípio migrou intacto para a gaveta, onde
os três destinos aparecem escritos em vez de adivinhados.)

#### Como regerar o subset

Não há dependência nova: o `.woff2` é versionado, e as ferramentas abaixo rodam
uma vez, à mão, na máquina de quem mexe.

```bash
npm pack material-symbols            # a fonte variável Outlined, do npm
pip install fonttools brotli
```

```python
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset
f = TTFont('material-symbols-outlined.woff2')
# PRENDER OS EIXOS é o que faz os glifos antigos saírem idênticos aos do subset
# anterior — a família é variável, e um `wght` diferente redesenha TUDO.
f = instancer.instantiateVariableFont(f, {'FILL': 0, 'GRAD': 0, 'opsz': 24, 'wght': 400})
o = subset.Options(); o.flavor = 'woff2'; o.layout_features = []; o.notdef_outline = False
s = subset.Subsetter(options=o); s.populate(unicodes=CPS); s.subset(f)
f.flavor = 'woff2'; f.save('material-symbols.woff2')
```

Depois **compare o antigo e o novo lado a lado** antes de trocar o arquivo: é a
única forma de perceber que um eixo ficou solto e mexeu em vinte ícones que
ninguém pretendia tocar.

**Ícones fora do subset → SVG inline.** Quando um ícone necessário não está no
subset e re-gerar o woff2 não vale a pena (ou o ambiente não tem `fontTools`),
usa-se um `<svg>` inline direto no HTML, com `fill/stroke: currentColor` (herda
a cor do botão). Hoje: o botão de **volume** do mixer (`#volToggle`, ícone de
faders/mixer), a **lupa** da busca do acervo (`#hymnSearchBtn`), a antena de
**Wi-Fi** dos cards de coleção (`wifiIconEl`), o **fone de ouvido** da mesa de
som (`#pvSoundBtn`, hoje sobre a preview), a **folha com linhas** da leitura
auxiliar (`#lyricsViewBtn`, que substituiu a flor do antigo botão de fundo da
letra), a **engrenagem** de Configurações (`#settingsBtn`, no topo do mixer — e,
desde a v5.250, também no cabeçalho do Modo Fácil), os **três pontos** do menu
de uma linha (`dotsIconSvg`, v5.258 — `more_vert` não está no subset), o
ícone **"arquivos+"** (documento com `+`) do botão de importar no fim do
Cronograma (`.import-btn`), que diferencia importar ARQUIVOS de abrir os
FAVORITOS (estrela, no botão ao lado — e a mesma estrela na "Nova pasta"),
os dois botões flutuantes da preview (**cast** e
**expandir** — `#pvCastBtn`/`#pvFullBtn`),
e nos **cards de coleção** a **seta de baixar** (`downloadAllIconSvg`), o **✕**
de cancelar (`closeIconSvg`), as **setas circulares** de sincronizar
(`syncIconSvg`), o **check** de "completo offline" (`checkIconSvg`), a
**engrenagem** de opções (`gearIconSvg`) com a **seta para cima** que a
substitui enquanto elas estão à mostra (`chevronUpIconSvg`) e o ícone de
**lista** (`listIconSvg`); e nos resultados da busca os botões de tocar
**voz/microfone** (Cantado, `voiceIconSvg`) e **nota musical** (Playback,
`noteIconSvg`); e o **livro com uma cruz** da aba **Bíblia**
(`.tab[data-tab="bible"]`), mais a **grade de módulos** da aba **Ferramentas** —
que substituiu o microfone quando a aba deixou de ter uma ferramenta só.

> **Borda nativa dos `<button>`**: `.tab-add` e `.pv-fab` zeram
> `border`/`appearance` explicitamente — sem isso, um `<button>` (ex.:
> `#hymnSearchBtn`) herda a **borda 3D bicolor (bevel)** do sistema, fora do
> padrão do app. O mesmo motivo do `appearance:none` no `.lib-search`
> (`type="search"`).

---

## Build, distribuição e instalação

Tudo isso vive no shell, não aqui: o APK é gerado e assinado pelo CI
(`.github/workflows/apk.yml`) e a base web é publicada como bundle OTA na
release de tag fixa `web-latest`. Ver `CLAUDE.md`, seções "OTA da base web" e
"Build e distribuição".

Do modelo antigo saíram: o deploy do `public/` no GitHub Pages, a instalação
dos dois PWAs pelo Chrome ("Adicionar à tela inicial"), os `manifest.json` com
`scope`/`orientation`/`share_target`, os ícones PNG/maskable exigidos pelo
gerador de WebAPK e o espelhamento do Display via Miracast de app isolado —
substituído pela `Presentation`, que manda só o Display para a TV.
