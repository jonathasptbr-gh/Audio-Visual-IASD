# Audio Visual IASD

Sistema para **transmitir e controlar multimídia** usando uma arquitetura
**dual-PWA** (dois aplicativos web progressivos no mesmo domínio).

## A ideia

O Android consegue espelhar via **Miracast** um único app selecionado. Aproveitamos
isso dividindo o sistema em dois PWAs:

- **Display** (`/display/`) — a tela que aparece no projetor/TV. É este app que o
  Android espelha.
- **Controle** (`/controle/`) — fica no celular do operador, sempre disponível.
  Comanda o que aparece no Display.

Como os dois PWAs estão no **mesmo domínio (origin)**, eles compartilham:

- **IndexedDB** → as imagens ficam guardadas offline, acessíveis pelos dois.
- **BroadcastChannel** → o Controle envia comandos em tempo real para o Display.

Cada PWA tem `manifest.id`, `scope` e `start_url` **próprios**, então o Android os
instala e trata como **dois apps distintos** — permitindo espelhar só o Display.

Tudo funciona **100% offline** depois da primeira carga (service workers).

## Funcionalidades

### Playlist
- Importar **imagens, vídeos e áudios** (vários de uma vez) pelo Controle.
- Ficam salvos offline no IndexedDB, numa lista ordenável.
- Reordenar (▲▼), renomear (editar o nome inline) e remover.
- Tocar num item → envia para o Display.

### Controle de mídia (barra fixa no topo)
- ⏮ Anterior · ▶/⏸ Play/Pause · ⏹ Parar · ⏭ Seguinte.
- Barra de progresso com tempo (seek), sincronizada com o Display.

### Visibilidade e áudio (independentes)
- **Toggle Visual ↔ Wallpaper**: mostra a mídia na tela ou só o wallpaper. O
  vídeo/áudio continua tocando mesmo com o wallpaper na tela — então "wallpaper
  com o áudio do vídeo" é só: Wallpaper + não-mudo.
- **Volume + mudo**: um slider ajusta o volume real da mídia no Display (0–100%)
  e a porcentagem reflete isso; o botão liga/desliga o mudo (mexer no volume
  tira o mudo). Obs.: o volume do *sistema* não é acessível por navegadores —
  este é o volume do elemento de mídia, que se multiplica com o do aparelho.

> Na primeira vez, toque uma vez no Display para liberar o áudio (política de
> autoplay dos navegadores).

## Estrutura

```
public/
├── index.html          # página inicial com links para os dois apps
├── shared/db.js        # camada comum: IndexedDB + BroadcastChannel
├── controle/           # PWA Controle (manifest, sw, ui)
└── display/            # PWA Display  (manifest, sw, ui)
server.js               # servidor estático mínimo (Node, sem dependências)
```

## Testar online (GitHub Pages)

A cada push na branch `main`, o GitHub Pages publica automaticamente a pasta
`public/` (workflow em `.github/workflows/deploy.yml`):

> https://jonathasptbr-gh.github.io/Audio-Visual-IASD/

Como o site fica em uma subpasta, **todos os caminhos do projeto são relativos**
(funcionam tanto em `localhost` quanto no Pages).

## Rodar localmente

```bash
npm start
```

Acesse `http://localhost:3000`. Service workers funcionam em `localhost`; em
produção é necessário **HTTPS** (o GitHub Pages já fornece).

### Instalar no Android

1. Abra o site no Chrome do celular.
2. Entre em **Abrir Display** e instale (menu → "Adicionar à tela inicial").
3. Volte e entre em **Abrir Controle** e instale também.
4. Os dois aparecerão como apps separados. Espelhe o **Display** via Miracast e
   opere pelo **Controle**.
