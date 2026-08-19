# Claude Code — Audio Visual IASD

A **base web** do sistema de projeção de mídia para culto (IASD): duas telas no
mesmo origin — **Controle** (celular do operador) e **Display** (o telão) — em
JavaScript puro, sem frameworks nem dependências de build. Funciona 100%
offline.

> Este documento cobre **só a base web** (`app/src/main/assets/web/`). A casca
> Android que a hospeda — Presentation, ponte `AVNative`, SAF, OTA, serviço de
> segundo plano — está em [`../CLAUDE.md`](../CLAUDE.md).

## Índice — QUAL ARQUIVO ABRIR

Este documento é o HUB: aqui ficam as regras que valem para a base inteira e o
mapa dos arquivos. **Cada capítulo mora num arquivo próprio** (`docs/arquitetura/`),
para uma pergunta sobre a Bíblia não custar a leitura do Controle inteiro.

| capítulo | arquivo | quando abrir |
|---|---|---|
| Controle | [`arquitetura/CONTROLE.md`](arquitetura/CONTROLE.md) | layout, transporte, mixer, Biblioteca, coleções (LouvorJA), YouTube, favoritos, playlist, séries, playlist automática |
| Modelo de dados | [`arquitetura/MODELO-DE-DADOS.md`](arquitetura/MODELO-DE-DADOS.md) | `shared/db.js`: IDB, OPFS, BroadcastChannel, coletor de lixo |
| Motor de renderização | [`arquitetura/MOTOR-STAGE.md`](arquitetura/MOTOR-STAGE.md) | `shared/stage.js`: cortina, fades, concorrência de load |
| Camada de Texto | [`arquitetura/CAMADA-DE-TEXTO.md`](arquitetura/CAMADA-DE-TEXTO.md) | Bíblia, Mensagens, letra avulsa, cronômetro, sorteio, letra sincronizada |
| Bíblia | [`arquitetura/BIBLIA.md`](arquitetura/BIBLIA.md) | a aba `bible`: seleção, leitura e projeção |
| Display | [`arquitetura/DISPLAY.md`](arquitetura/DISPLAY.md) | wallpaper, microfone, recuperação de áudio, o telão |
| Design System | [`arquitetura/DESIGN-SYSTEM.md`](arquitetura/DESIGN-SYSTEM.md) | **antes de escrever qualquer cor**; tokens, dois temas, contraste, ícones |
| Documento em cena | [`arquitetura/DOCUMENTO-EM-CENA.md`](arquitetura/DOCUMENTO-EM-CENA.md) | PDF, PowerPoint e Google Apresentações virando páginas |

Neste arquivo:

1. [Regra obrigatória após qualquer alteração](#regra-obrigatória-após-qualquer-alteração) — fluxo de git/merge
2. [Regras de desenvolvimento](#regras-de-desenvolvimento) — invariantes da base web
3. [A ideia](#a-ideia-duas-telas-um-só-estado) — duas telas, um só estado
4. [Estrutura de arquivos](#estrutura-de-arquivos)
5. [Build, distribuição e instalação](#build-distribuição-e-instalação) — e como esta base é SERVIDA (asset loader + OTA)

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
│   ├── sorteio.js              # A REGRA da PLAYLIST AUTOMÁTICA — PURA, com as
│   │                           # capacidades INJETADAS (normalizar, casar letra,
│   │                           # "está no aparelho?") e oráculo em Node: decide
│   │                           # o que pode ser sorteado para o telão
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
