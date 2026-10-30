# Pedidos em espera (fila do operador)

Registro dos pedidos do operador **ainda não implementados**, agrupados em
PACOTES de trabalho. Existe para sobreviver a uma limpeza de contexto da sessão:
quem retomar lê este arquivo e pergunta ao operador **qual pacote seguir** —
nada aqui está autorizado para execução sem essa resposta.

**Regra do arquivo:** ele ESVAZIA. Um pacote entregue sai daqui (a nota vai ao
`docs/HISTORICO.md`, como sempre); um pedido revogado sai com uma linha dizendo
quem revogou. Não é log, e não é `docs/ACHADOS-EM-ABERTO.md` (lá moram defeitos
CONFIRMADOS por auditoria; aqui, pedidos).

Contexto da entrega: base web **v1.13.14** em `main`, APK v1.13.12,
`SHELL_VERSION` 82 — conferido em 2026-10-30. Pedidos recebidos em **2026-10-24**, com o
horário do relato.
O operador pediu economia: *"não temos tokens então toda ação deve ser fracionada
e controlada"* — um pacote por vez, cada um com o rito de entrega completo.

**Ordem recomendada ao operador:** resta o 6 (pesquisa). (O Pacote 7 — a faixa de
álbum no ar destacada — saiu na v1.13.14; o Pacote 5 — o vídeo da semana como item — saiu na v1.13.13; o Pacote 1 — as quatro correções pequenas — saiu na v1.13.11, e a busca no computador foi refeita no servidor na v1.13.12; o Pacote 4 — a lista vertical das Ferramentas e o nome do itinerário no
título da folha — saiu na v1.13.4; o Pacote 2 — o teclado sobrepondo em todo
campo de texto — na v1.13.7; o Pacote 3 — a linha de controles do Modo Fácil —
na v1.13.8. Fora dos pacotes, saíram também as portas do rodapé maiores e em negrito,
na v1.13.7, e a Biblioteca maior do Modo Fácil, na v1.13.9.)

---

## Pacote 6 — Pesquisa, sem implementação

| hora | pedido | o que já se sabe |
|---|---|---|
| 09:58 | *"Problemas com a janela de escolha de saída de som: Janela atual: É o painel de volumes (VOLUME / SOUND). Com MEDIA_OUTPUT / MediaRouter: Abre o painel que lista os dispositivos conectados (alto-falantes do telefone, fones Bluetooth, fones P2/Type-C ou Smart TVs/Cast)… Verifique essas opções"* | o tile "Saída de áudio" (shell 73) tenta uma cadeia; o 1º candidato (broadcast do diálogo do SystemUI) é ENGOLIDO neste aparelho (v1.9.11/v1.9.12, conferido pelo foco da janela e lembrado por `versionCode`), e a cadeia cai no painel de volume. Pista nova: `MediaRouter2.showSystemOutputSwitcher()` (API 34) e `Settings.Panel`/`ACTION_MEDIA_OUTPUT` — **Kotlin, portanto Release**. Pesquisar o que o aparelho do operador expõe e pedir uma cópia do Registro (a cadeia inteira vai lá) |
| 10:34 | *"Vamos estudar e planejar um sistema de compartilhar itinerários e ou cronogramas de forma mais facilitada… compartilhar no whatsapp… um simples link, que ao tocar, abre o app, e busca/baixa oque for necessário inclusive baixando diretamente do aparelho de origem… Talvez precisamos de um servidor? Estude as opções para o menor atrito possível…"* | entregável é um ESTUDO para o operador decidir, não código. Eixos: link de app (App Links no domínio `audiovisualiasd.com.br`, que já é nosso — exige o arquivo de associação de domínio (Digital Asset Links) no `site/` e `intent-filter` no manifesto, logo Release) vs. arquivo `.avpkg` pequeno só com a LISTA; de onde vem a mídia (LouvorJA e YouTube já são re-baixáveis por id; mídia própria do aparelho é o problema difícil — sem servidor, só com os dois aparelhos online ao mesmo tempo); e o que NÃO viajar (privacidade, `docs/MEDICAO-DE-ALCANCE.md`). Comparar com o `.avpkg` atual (`docs/recursos/PACOTE.md`) |

### Estudo da saída de áudio — ETAPA 1 (análise), 2026-10-30

**O que o Registro de 30/10 08:54 mede** (SM-S928B, **Android 17**, WebView 156,
web v1.13.15 · shell v1.13.12): a cadeia inteira de `audioOutputCandidates()`.

| # | candidato | neste aparelho |
|---|---|---|
| 1 | broadcast `LAUNCH_MEDIA_OUTPUT_DIALOG` → `com.android.systemui/.media.dialog.MediaOutputDialogReceiver` | o receptor EXISTE, o `sendBroadcast` não lança, e o diálogo NÃO sobe (foco conferido em 800 ms) → **BLOQUEADO** por `versionCode` |
| 2 | `com.android.settings.panel.action.MEDIA_OUTPUT` | **não existe** neste aparelho |
| 3 | `Settings.Panel.ACTION_VOLUME` → `com.android.settings/.panel.SettingsPanelActivity` | é o que abre hoje (o painel de volume) |
| 4 | `ACTION_SOUND_SETTINGS` | o piso |

**Conclusão: as duas pistas do relato das 09:58 já estão na cadeia e as duas
estão mortas aqui** — o diálogo do SystemUI engole o broadcast de terceiro
(provável restrição a chamador privilegiado nas versões novas; não conferido
na fonte) e o painel `MEDIA_OUTPUT` do app de Configurações não existe. **A
única porta que sobra é a PÚBLICA: `MediaRouter2.getInstance(ctx)
.showSystemOutputSwitcher()`** (API 34, documentada, sem permissão). No AOSP ela
vai `MediaRouterService.showMediaOutputSwitcher(pacote)` → `StatusBarManager` →
SystemUI `MediaOutputSwitcherDialogUI` — o MESMO diálogo do candidato 1, mas pelo
caminho que o sistema oferece a terceiros. Exige o app em primeiro plano (o toque
no tile garante). Devolve `boolean`, que NÃO é prova de janela: conferir pelo
foco, como o broadcast.

**Plano (etapas 2–5, não autorizadas ainda):**
- `MainActivity`: candidato NOVO na frente, só com `SDK_INT >= 34`
  (`compileSdk` 35 já cobre), com a mesma conferência por foco e a mesma memória
  de bloqueio por `versionCode`, **separada** da do broadcast; o rótulo dele entra
  na lista que o Registro imprime (`listAudioOutputCandidates`). Nenhum
  `import` de AndroidX: `android.media.MediaRouter2` é da plataforma.
- **Só Kotlin → Release** com `shellTag`. A ponte não muda (`abrirSaidaDeAudio`
  e `saidaDeAudioAlvo` mantêm a forma), então o `SHELL_VERSION` não precisa
  subir; o web só muda se o texto do `title` do tile mudar.
- **Risco declarado:** a One UI pode trocar o diálogo do AOSP pelo dela, ou
  recusar também esta via — só o aparelho decide. Recusando, o desfecho continua
  o painel de volume (o piso de hoje), e o Registro diz que a via nova foi
  engolida. Não há quinta porta pública conhecida.
- **Achado 1 de `ACHADOS-EM-ABERTO.md`, de carona (opcional):** uma linha *"a
  mídia está saindo por: …"* no bloco "Áudio do aparelho" via
  `AudioManager.getAudioDevicesForAttributes(USAGE_MEDIA)` (API 33, pública) —
  esta sim é método novo de ponte (`SHELL_VERSION` 83).

---

## Pendências antigas (anteriores a 2026-10-24)

- **Notificação abaixando o volume da mídia** (análise da v1.13.1): **o operador
  escolheu (a) em 2026-10-30** — uma dica, só web, sugerindo ligar o "Não
  Perturbe" quando o som sai pelo celular. (b) (tile que abre as configurações
  do Não Perturbe) pede Kotlin e Release; (c) (ligar sozinho) foi desaconselhado.
  **Aprovado, ainda não implementado** — entra no lote que o operador indicar.
- **Varrer a sobra de ~24 MB do cache do YouTube no shell** — Kotlin; entra
  num lote que já precise de Release, nunca sozinho.
