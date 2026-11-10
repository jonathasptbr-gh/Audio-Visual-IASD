# Capturas do app — entrada

Os JPEGs que o operador manda do aparelho, antes da triagem. **O site não usa
esta pasta:** ele serve `site/telas/`, e o Pages publica só `site/` — nada
daqui vai ao ar.

Fluxo: o lote chega em `capturas/entrada/` → escolhe-se o que vira slide →
converte-se para WebP 800×1632 em `site/telas/` → o resto fica como candidato.

- `capturas/entrada/` — os originais (1255×2560, JPEG).
- `site/telas/` — o que está no ar, um arquivo por tela do carrossel.
