# IASD AV — Projeção

PWA de projeção de imagens em tela cheia, pensado para ser **espelhado** em uma
segunda tela (TV) via espelhamento de tela do sistema (Samsung SmartView,
Miracast, Chromecast mirror, etc.).

## Como funciona

```
[Smartphone]  ──espelhamento de tela (SmartView/Miracast)──►  [TV]
   index.html (tela cheia)                                     mesma imagem
```

A própria tela do app **é** a tela de exibição. Você espelha o celular na TV
pelo sistema, abre o app, e a imagem aparece em tela cheia na TV. Os controles
(anterior / próxima / tela preta / adicionar) ficam numa barra que **aparece ao
toque e some sozinha**, para não poluir a projeção.

### Por que não usa a Presentation API?

A Presentation API do Chrome no Android **só funciona com dispositivos Google
Cast (Chromecast)** — não com espelhamento Miracast/SmartView. E o
Document Picture-in-Picture (janela flutuante com botões) **não é suportado no
Android**. Por isso a abordagem é o espelhamento de tela única, que funciona em
qualquer combinação de celular + TV.

## Funcionalidades

- Seleção de uma ou várias imagens (vira uma lista de reprodução)
- Navegação anterior / próxima
- **Tela preta** (para esconder a projeção entre os momentos)
- Tela cheia automática (Fullscreen API)
- Mantém a tela ligada durante o uso (Screen Wake Lock API)
- Controles por teclado quando há teclado pareado (setas, espaço, `B`)
- Funciona offline (Service Worker / PWA instalável)

## Uso

1. Espelhe o celular na TV (SmartView / Transmitir tela)
2. Abra o app: **https://jonathasptbr-gh.github.io/Audio-Visual-IASD/**
3. Selecione as imagens
4. Toque na tela para mostrar os controles

## Desenvolvimento local

```bash
npm install
npm run dev      # http://localhost:3000
```

## Estrutura

```
public/
├── index.html        # App de projeção (tela cheia)
├── manifest.json     # PWA manifest
├── sw.js             # Service Worker (cache offline)
├── css/app.css
├── js/app.js
└── icons/
    ├── icon-192.svg
    └── icon-512.svg
```

## Roadmap

- [x] Projeção de imagens em tela cheia + lista de reprodução
- [x] Tela preta / navegação / tela cheia / wake lock
- [ ] Projeção de vídeo
- [ ] Controle de áudio
- [ ] Transições entre imagens (fade configurável)
