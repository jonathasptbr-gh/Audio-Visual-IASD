# IASD AV — Projeção em Segunda Tela

PWA para projeção de imagens (e futuramente áudio/vídeo) em telas secundárias, usando o smartphone como controlador.

## Tecnologia

Usa a [Presentation API](https://developer.mozilla.org/en-US/docs/Web/API/Presentation_API) nativa do browser, que é o padrão W3C para projeção em segunda tela.

## Como funciona

```
[Smartphone — Controlador]  ──Presentation API──►  [TV/Monitor — Receptor]
        index.html                                    receiver.html
```

1. O controlador (smartphone/PC) abre `index.html`
2. O usuário seleciona uma imagem e clica **Iniciar Projeção**
3. O browser abre `receiver.html` na tela secundária conectada
4. A imagem é enviada via `PresentationConnection.send()` (base64)
5. O receptor exibe a imagem em tela cheia

## Requisitos

- **Navegador:** Chrome 47+ ou Edge (desktop) — a Presentation API tem suporte limitado
- **HTTPS** em produção (funciona em `localhost` sem HTTPS)
- Monitor/TV secundário conectado ao computador que exibe o controlador

## Desenvolvimento local

```bash
npm install
npm run dev
# Abre http://localhost:3000
```

## Estrutura

```
public/
├── index.html       # Controlador (smartphone)
├── receiver.html    # Receptor (segunda tela)
├── manifest.json    # PWA manifest
├── sw.js            # Service Worker (cache offline)
├── css/
│   ├── controller.css
│   └── receiver.css
├── js/
│   ├── controller.js
│   └── receiver.js
└── icons/
    ├── icon-192.svg
    └── icon-512.svg
```

## Roadmap

- [x] Projeção de imagens
- [ ] Projeção de vídeo
- [ ] Controle de áudio
- [ ] Múltiplas mídias / lista de reprodução
- [ ] Modo apresentação (slides)
