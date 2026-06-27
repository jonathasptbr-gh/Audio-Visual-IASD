# IASD AV — Projeção

Sistema de **dois PWAs** independentes, na mesma origem, que se comunicam
**100% offline** dentro do mesmo celular:

- **Display** (`/display/`) — tela limpa de exibição (vídeo/imagem em tela cheia)
- **Controle** (`/controle/`) — controle remoto (play, pause, progresso, volume)

A ideia: o **Display** fica na tela que é espelhada/transmitida para a TV; o
**Controle** fica no seu celular. Os dois conversam por `BroadcastChannel` e
compartilham as mídias por `IndexedDB` — sem servidor, sem internet.

## Arquitetura

```
┌─────────────── mesmo celular, mesma origem ───────────────┐
│                                                            │
│   /controle/  ── BroadcastChannel('tv_cast_channel') ──►   │
│   (botões)    ◄── estado (currentTime, play/pause) ──────  │   /display/
│       │                                                    │   (vídeo cheio)
│       └────────► IndexedDB 'iasd-av' ◄─────────────────────┘
│                  (Blobs de vídeo, lidos pelos dois)
└────────────────────────────────────────────────────────────┘
                                                  │
                          Remote Playback API (video.remote.prompt)
                                                  ▼
                                       📺 TV (Miracast/DLNA/Cast)
```

### Comunicação (BroadcastChannel)
- Controle → Display: `load`, `toggle`, `play`, `pause`, `seek`, `volume`, `blackout`, `request-state`
- Display → Controle: `state` (id, currentTime, duração, play/pause, volume) — enviado a cada `timeupdate`, para a barra de progresso

### Mídia (IndexedDB compartilhado)
- O **Controle** grava os vídeos/imagens como `Blob` no IndexedDB `iasd-av`
- O **Display** lê o mesmo registro pelo `id` — sem duplicar armazenamento
- `db.js` (idêntico nas duas pastas) expõe `window.MediaDB`

### Transmitir para a TV (Remote Playback API)
O Display usa `video.remote.prompt()` (Remote Playback API) para enviar **só o
vídeo** para a TV. No Android, essa API suporta **Miracast, DLNA e Chromecast** —
não exige espelhar a tela. Aparece um botão "Transmitir" quando há um
dispositivo disponível na rede. *(Não funciona com vídeo MSE/streaming; Blobs
locais funcionam.)*

> **Por que não Presentation API ou Document PiP?** A Presentation API do Chrome
> no Android só fala com Chromecast; o Document PiP (janela flutuante com botões)
> não existe no Android. A Remote Playback API é o caminho web correto para
> Miracast/DLNA no Android.

## Service Workers
Cada app tem o seu (`/controle/sw.js` e `/display/sw.js`), com escopo próprio,
fazendo cache agressivo da sua interface — abrem instantaneamente, mesmo em
modo avião.

## Uso

1. Abra **https://jonathasptbr-gh.github.io/Audio-Visual-IASD/**
2. Instale **Display** e **Controle** (Adicionar à tela inicial) — viram 2 ícones
3. Espelhe o celular na TV (SmartView) e abra o **Display**, OU use o botão
   **Transmitir** do Display (Remote Playback)
4. No **Controle**, adicione as mídias e comande a reprodução

## Desenvolvimento local

```bash
npm install
npm run dev      # http://localhost:3000
```

## Estrutura

```
public/
├── index.html              # launcher (links para os dois apps)
├── controle/
│   ├── index.html · controle.css · controle.js · db.js · manifest.json · sw.js
│   └── icons/
└── display/
    ├── index.html · display.css · display.js · db.js · manifest.json · sw.js
    └── icons/
```

## Roadmap

- [x] Dual PWA + BroadcastChannel + IndexedDB compartilhado
- [x] Vídeo (play/pause/seek/volume) e imagem, com progresso sincronizado
- [x] Remote Playback API (transmitir vídeo para a TV)
- [ ] Transições / fade entre mídias
- [ ] Lista de reprodução com ordem salva
