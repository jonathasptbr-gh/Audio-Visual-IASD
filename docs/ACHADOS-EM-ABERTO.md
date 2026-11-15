# Achados em aberto

**UM** em aberto.

**Arquivo para esvaziar, não para crescer:** relato novo abre item novo, com a
cena que ele der. Aqui moram **defeitos CONFIRMADOS** em aberto — o que pede
medição em aparelho, decisão de desenho ou registro de suspeita não fica aqui
(decisão → `RESIDUOS.md` "Fechado/decidido"; suspeita → o dossiê da revisão).

## §1 — a tela cheia da música no Modo Fácil desfaz sozinha (2026-11-15)

**Cena do operador**, no app, sem tela conectada, "tocar neste celular": uma
música comum da Biblioteca no ar, e o toque na tecla da tela cheia (`#simpleTela`,
abaixo da letra) **vira a tela e a desvira logo em seguida** — a arte do telão
nem chega a aparecer.

**Confirmado no arnês, pelo caminho nativo (`AVNative.telaInteira`):** a tecla
entra (`pvInteira` + `telaInteira(true)`) e a PRIMEIRA atualização da lista de
telas a derruba — `__avDisplaysChanged` → `renderDisplayStatus` →
`renderSimpleCast` → `renderSimpleGate` → `acertarTelaCheiaDoVideo(false)`. A
régua da saída (`telaCheiaDoVideoCabe()`) só aceita vídeo SEM leitura, e
`fsDoVideo` é armado também pela tecla (`abrirTelaCheiaDoModoFacil`): o portão
confunde "uma tela chegou" com "o portão foi redesenhado". A rotação é quem
entrega a primeira notificação — o `onDisplayChanged` do display interno roda
`syncPresentation` → `notifyDisplayChange`, e sem tela externa ele notifica
sempre. Medido no oráculo: música com letra fecha na reconsulta; vídeo sem letra
(controle) fica; e a música SEGUINTE também fecha, pelo
`acertarTelaCheiaDoVideo(true)` do `send`.

**Alcance:** tudo o que não é vídeo sem letra — música com letra, apresentação,
imagem.

**Correção decidida (operador, 2026-11-15): um lote só disto, depois de o lote do
Itinerário (v1.14.32) sair.** Guardar QUEM abriu a tela cheia (a regra do vídeo
ou a tecla) e desfazer sozinho só a da regra; a da tecla fecha no Parar, no fim e
quando uma tela entra — o portão passa a fechar só quando há tela (`temTela`). O
caso entra no `tools/tela-inteira.test.mjs`, que hoje cobre só o vídeo.

**Esvaziado em 2026-11-14 (Pacote 26, B9).** Os cinco itens que moraram aqui
fecharam, e a nota de cada um está em [`HISTORICO.md`](HISTORICO.md):

- **§1** o fone/Bluetooth desvia o áudio da TV — fechado em 2026-11-08 por
  RESPOSTA DO OPERADOR (o Bluetooth é o destino desejado);
- **§2** a chamada telefônica — fechado em 2026-11-09 (não é problema; relato
  novo abre item novo);
- **§3** só o cliente pode fazer o app escolher baixo — fechado em 2026-11-08
  por RESPOSTA DO OPERADOR;
- **§4** os três oráculos presos à fonte do runner — não era defeito do app:
  migrou para o `docs/RESIDUOS.md`, dono `CI`;
- **§5** o guia pode não abrir e o web não sabe — **corrigido no Kotlin e
  publicado no APK da v1.14.13** (nada de `java/` mudou depois da tag; o
  "falta o APK" que o texto antigo dizia era falso);
- **§6** a pílula de volume na tela cheia deitada — **FICA COMO ESTÁ**, decisão
  do operador em 2026-11-14; o registro está no `RESIDUOS.md`,
  "Fechado/decidido".

Os laudos antigos continuam no histórico do git (`git log -- docs/ACHADOS-EM-ABERTO.md`).
