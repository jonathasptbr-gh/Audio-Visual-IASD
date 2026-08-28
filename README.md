# Áudio Visual IASD — app Android

App de projeção de mídia para culto. O celular do operador mostra o
**Controle**; a TV recebe **só o Display**, na resolução nativa dela — sem
espelhar a tela do celular.

Isso é possível porque o app usa `android.app.Presentation`: uma segunda tela
de verdade, e não um espelhamento. O sistema inteiro (playlist, transições,
letra sincronizada, Bíblia, mensagens, coleções do LouvorJA, YouTube) roda numa
base web hospedada em dois WebViews do mesmo processo e mesmo origin — que por
isso compartilham IndexedDB, OPFS e o canal de comandos.

**Documento também é mídia.** PDF, PowerPoint (`.pptx`) e Google Apresentações
entram pelo mesmo "Importar arquivos" (ou pelo compartilhamento) e viram uma
imagem por página — daí para a frente têm o fade, a cortina, o telão e os
botões ⏮/⏭ passando página, como qualquer outro item. Não há botão nem fluxo
separado para apresentação: é um arquivo como os outros.

## Instalar

1. Baixe o `.apk` mais recente em **[Releases](../../releases)** (link direto,
   instala pelo Chrome do celular) ou pelos *Artifacts* de uma execução do
   workflow **Build APK**.
2. Autorize "instalar apps de fontes desconhecidas" quando o Android pedir.
3. Conecte a TV (Smart View / MiraScreen / cabo USB-C→HDMI) e abra o app: o
   telão é detectado sozinho.

Sem TV conectada, o app funciona igual ao PWA: a preview do Controle em tela
cheia vira a projeção.

## Compilar

```bash
./gradlew assembleDebug     # exige Android SDK instalado
```

No CI, cada push gera um APK automaticamente; uma tag `v*` publica uma Release.

## Licença

**GPLv3** — ver [`LICENSE`](LICENSE).

Não é escolha de estilo: o `NewPipeExtractor`, que extrai a URL do vídeo do
YouTube no próprio aparelho, é GPL-3.0 e viaja dentro do APK. A GPLv3 exige que
o conjunto seja licenciado sob ela e que o código correspondente seja oferecido
a quem recebe o binário — este repositório é público, e cada Release aponta para
o commit de que foi compilada.

O software de terceiros que vai em cada binário — o APK e o programa de
Windows — está listado em [`AVISOS-DE-TERCEIROS.md`](AVISOS-DE-TERCEIROS.md).

> A licença cobre o **código**. O símbolo e o nome **IASD** são da Igreja
> Adventista do Sétimo Dia, e nada aqui concede direito sobre eles.

## Documentação

- [`CLAUDE.md`](CLAUDE.md) — arquitetura do shell nativo, a ponte `AVNative`,
  invariantes e as divergências entre o caminho web e o nativo.
- [`docs/ARQUITETURA-WEB.md`](docs/ARQUITETURA-WEB.md) — hub da arquitetura da
  base web (`app/src/main/assets/web/`); os capítulos ficam em
  `docs/arquitetura/`.
- [`docs/FONTE-DE-DADOS-LOUVORJA.md`](docs/FONTE-DE-DADOS-LOUVORJA.md) —
  referência do banco público usado para hinos, álbuns e Bíblia.
