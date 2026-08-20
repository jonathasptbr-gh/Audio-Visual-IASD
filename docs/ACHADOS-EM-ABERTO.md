# Achados em aberto — auditoria de 2026-08-20

> **O que é este arquivo.** A auditoria varreu os 26 arquivos Kotlin, a base web
> e a documentação em 13 frentes, e cada achado passou por um verificador
> ADVERSARIAL cuja tarefa era refutá-lo (66 confirmados, 15 refutados). Tudo que
> era **documentação, comentário ou oráculo** foi corrigido no mesmo lote. O que
> sobrou aqui **muda comportamento**, e por isso é decisão de quem publica.
>
> **Este arquivo é para ESVAZIAR, não para crescer.** Item resolvido sai daqui e
> a regra correspondente vai para o capítulo que a governa. Um arquivo de
> achados que vira arquivo permanente é a próxima coisa a envelhecer mentindo.
>
> A ressalva de cada verificador está incorporada: onde ela reduziu a gravidade
> ou estreitou o cenário, é a versão dele que está escrita.

---

## Os quatro que eu consertaria primeiro

### 1. Meia mídia entregue como se fosse inteira · `EspelhoServidor.kt:623` — ALTA

No ramo EM CRESCIMENTO de `servirMidia` há **quatro** saídas do laço
(`item.completo`, `item.cancelado`, o estouro de `TETO_MIDIA_PARADA_MS` e
`n <= 0`), e as quatro caem no mesmo `saida.write(EspelhoHttp.chunkFinal())`.
Num corpo `chunked` sem `Content-Length`, o terminador `0\r\n\r\n` **É** a
afirmação "o recurso acabou aqui".

**Cenário:** o renderer do Controle morre no meio do empurrão de um vídeo de
300 MB — caso que o projeto trata como normal (`buildControleWebView` remonta o
WebView). O canal nunca recebe `{"fim":true}`, `item.completo` fica falso para
sempre, e 30 s depois o teto estoura e escreve o terminador. O `<video>` da tela
— que **sem TV é a projeção** — toca até onde chegou e dispara `ended`. Sem
exceção, sem erro de rede, sem linha no Registro.

O KDoc do próprio `TETO_MIDIA_PARADA_MS` promete o desfecho que o código não
produz: *"a conexão fecha e o `<video>` da tela cai na recuperação normal dele"*
— o que só vale se o terminador **não** for escrito.

**Correção:** escrever `chunkFinal()` só quando a entrega for completa. Nas
outras três saídas, fechar o socket **sem** o terminador (o cliente vê um erro
de rede, que é a verdade). `item.esperado` já está na mão e não é consultado em
ponto nenhum deste caminho: `pos < item.esperado` é a condição.

### 2. O coletor apaga a mídia que está EM CENA · `shared/db.js:680` — ALTA

A guarda de `currentId` existe só no `soltarAvulso`. Um item que vive numa
única lista (um vídeo baixado direto para a Playlist, destino único na folha)
tem UM detentor: tirar da fila destrói o registro **enquanto ele toca**.

**Cenário:** item tocando → o operador toca no ✕ da linha da fila →
`listRemove('playlist', id)` → `isReferenced` false → `delete(id)` na mesma
transação. O vídeo segue tocando (o telão já tem os bytes) e nada avisa. O
dongle cai e volta — ou um OTA é aplicado — e o `resendSceneToDisplay` chama
`AVDB.getMedia(id)` sobre um registro que não existe mais.

**Correção (a mais barata):** `send(id)` chamar `fixarAvulso(id)` para TODA
mídia que entra em cena, não só no caminho "Tocar agora" — a prateleira
`avulsos` existe justamente para ser a detentora da mídia projetada que não
pertence a lista nenhuma.

### 3. O selo "● No ar" fica na linha errada, e o segundo toque apaga a cena nova · `controle.js:4389` — ALTA

`soUmProvedorDeTexto` troca o provedor da Camada de Texto mas **nunca zera
`cueNoArId`**.

**Cenário:** o operador projeta o cue "João 3:16" pelo Cronograma
(`cueNoArId = <id>`). Vai a Ferramentas → Cronômetro → "Projetar no telão":
`soUmProvedorDeTexto('chrono')` limpa a `bibleSession`, mas `cueNoArId` continua
sendo o do versículo. De volta ao Cronograma, a linha do versículo **ainda tem o
selo "● No ar"**; o operador toca nela esperando reprojetar o versículo, o
`onTap` lê `noArAgora = true` e chama `retirarDoAr` → **o cronômetro sai do
telão na frente da congregação**, e o versículo não entra.

**Correção:** zerar `cueNoArId` dentro de `soUmProvedorDeTexto` — é ela que já é
o lugar ÚNICO do rodízio. Um parâmetro opcional com o id do cue que assume
elimina de quebra a escrita separada da linha 8512, hoje o segundo lugar que
decide a mesma coisa.

### 4. ⏭/⏮ ficam presos quando o próximo item é imagem e há áudio no ar · `controle.js:8541` — MÉDIA (alta confiança)

**Cenário:** fila `[louvor.mp3, aviso.jpg]`. O operador toca no louvor pela
folha da playlist; toca ⏭ ("Próxima mídia") → `step(1)` → `send(B)` **sem**
`daFila` → `audioNoAr()` é true → `projetarImagemSobre(B)`: a imagem entra por
cima e `currentId` continua sendo A. Toca ⏭ de novo: `idx` continua o de A,
`target` continua B, e nada muda na tela. **O botão "Próxima mídia" deixa de
andar na fila**, e o mesmo vale para o ⏭ da notificação e da tela de bloqueio.

**Correção:** `step()` passar `daFila` — o eixo de ⏮/⏭ é "trocar de MÍDIA", a
mesma intenção do avanço automático. A sobreposição continua valendo para o
toque na LINHA.

---

## Entrega e atualização

### 5. O `HOLD` do `shellTag` pode não soltar sozinho · `.github/workflows/apk.yml:19` — ALTA (confiança média)

A Release é criada por `softprops/action-gh-release` com o `GITHUB_TOKEN`
padrão, e eventos originados nesse token **não disparam novas execuções de
workflow**. Se isso valer aqui, o `on: release: [published]` nunca roda pelo
fluxo `git push --tags`, o bundle fica segurado até o próximo push em `main`, e
o sintoma é o de sempre: "a atualização não chega".

> **Ressalva do verificador, e ela importa:** no disparo MANUAL (*Run workflow*
> com `release_tag`) o `web-ota` roda na mesma execução, porque `github.ref` é
> `refs/heads/main`. Mas ele publica o manifesto **antes** de o job `apk`
> publicar a Release — é uma **corrida**, não uma impossibilidade. No fluxo por
> tag, aí sim o gatilho não vem.

**Correção:** publicar a Release com um PAT, **ou** o job `apk` chamar o
`web-ota` depois de publicar. **Enquanto nenhuma das duas existir:** depois de
publicar uma Release para um lote com `shellTag`, **confira** se o `web-ota`
rodou, e reexecute-o à mão se não.

### 6. Retomada da atualização abre modal de erro e apaga a intenção · `controle.js:19332` — MÉDIA

A intenção sobrevive ao processo; o `achado` do `ShellUpdater` (estado
`@Volatile` de processo) não. Numa abertura sem rede, `retomarAtualizacao`
chama `apkInstalar` com `achado == null`, recebe *"não há versão nova para
baixar"*, **apaga a intenção antes de testar o erro** e abre um modal "A
atualização do app falhou".

**Correção:** tratar esse erro como "ainda não sei" — não apagar a intenção,
não abrir modal, deixar a enquete tentar de novo quando o manifesto chegar.

### 7. O piso de 5 s entre consultas não segura a enquete web · `WebUpdater.kt:448` — MÉDIA

`MIN_ENTRE_CHECKS_MS` é 5 s e a enquete do lado web é de 10 s: a condição nunca
reprova. Com a ronda de 15 s por cima, dá ~6–10 GETs/min por aparelho,
indefinidamente. O KDoc do `RONDA_MS` orça 240/hora.

> **Ressalva:** o gatilho de REDE **é** servido pelo piso (`vigiarRede` chama
> sem `forcar`), e o `forcar` do `onResume` é decisão DELIBERADA e declarada no
> `CLAUDE.md`. O que sobra é a enquete de 10 s passando livre.

**Correção:** afrouxar a enquete web para 30–60 s (ela é rede de segurança; o
caminho principal é o empurrão do shell), ou subir o piso acima dela.

### 8. `apkProcurar` faz rede na fila `io` · `NativeBridge.kt:441` — ALTA

`io` é declarada, na tabela do `CLAUDE.md` e no próprio KDoc, como "só o que
responde em milissegundos". `apkProcurar` é a única chamada de rede que roda
nela, com 20 s de connect + 20 s de read. No pior caso ela trava por 40 s a fila
de que `otaPending`, `atualizacaoEstado` e `listFolder` dependem — e um
`listFolder` que vença os 60 s resolve `null`, que o `controle.js` lê como "a
pasta sumiu do aparelho".

**Correção:** mover para a fila `extracao` (rede lendo metadados é a definição
exata dela).

---

## Telas da rede

### 9. Sem correlação pedido↔resposta no canal `__avTelaMidia` · `controle.js:19895` — MÉDIA

`telaPedir` guarda o `resolve` num único campo global e o `onmessage` não
confere de qual pedido a resposta veio. Uma resposta atrasada resolve a promessa
do pedido SEGUINTE, e o item é abandonado calado.

> **Ressalva:** a defasagem **não** é permanente — uma resposta sem pedido
> pendente é descartada e o par se realinha. O custo típico é UM item
> abandonado, não "nenhuma mídia empurrada pelo resto da sessão".

**Correção:** numerar os pedidos (`seq` no objeto de texto, devolvido pelo
`EspelhoMidiaCanal.responder`) e descartar resposta cujo `seq` não seja o
pendente.

### 10. Corrida no token do wallpaper · `controle.js:19913` — MÉDIA

O empurrão lê `telaTokenDe('__wp')` na hora de EMPURRAR, não na de enfileirar.
Trocando o wallpaper duas vezes seguidas, o comando anuncia `/m/T2` que nunca
recebe bytes (o blob novo é descartado pela deduplicação por id) — o wallpaper
some e responde 404.

**Correção:** carregar o token no item enfileirado e deduplicar por **id +
token**.

### 11. `await0Rec` não acha a imagem sobre o áudio · `controle.js:19970` — ALTA

Com a imagem sobre o áudio em cena e a aba trocada (o que zera `libItems`), um
reenvio de cena (`display-ready` de uma tela que deu F5, ou uma tela nova
entrando) manda `{type:'text',mode:'image',mediaId}` **sem `__rec`** — e a tela
pinta um cartão PRETO sobre a projeção até alguém tocar em outra coisa.

**Correção:** guardar o registro na sessão (`imgSession.rec`) e `await0Rec`
consultá-la antes de varrer as listas. Vale acrescentar o caso ao
`tela-rede.test.mjs`.

### 12. A rota de mídia falha em silêncio · `EspelhoServidor.kt:571` — MÉDIA

Um 404 em `/m/<token>` não escreve nada no diário, e o "cache de mídia" que o
Registro promete nunca é publicado em `estado()`.

**Correção:** `registrar(...)` no 404 e publicar `midia { itens, bytes, teto }`
— os acessores já existem no `EspelhoMidiaCache`.

### 13. `wakeLock`/`wifiLock` sem `@Volatile` · `EspelhoEnergia.kt:64` — BAIXA (rebaixada)

São os únicos campos mutáveis do objeto sem `@Volatile`, escritos de três
threads. O pior caso é um wake lock adquirido sem referência.

> **Ressalva:** o `acquire` é de 2 h com timeout, então ele **expira sozinho** —
> o prejuízo é bateria, não recurso preso para sempre.

**Correção mínima e claramente certa:** `@Volatile` nos dois, alinhando-os aos
sete irmãos.

---

## YouTube e séries

### 14. O filtro de contêiner roda antes do `soPortugues` · `YoutubeGrab.kt:1301` — MÉDIA

`candidatosAudio(info, "m4a", …)` corta por extensão **antes** de perguntar pelo
português. Se a trilha pt-BR existir só em WEBMA e a original `en` em m4a, o
corte apaga a exclusividade do português e o testemunho vai ao telão **em
inglês**, com o download terminando em sucesso e sem linha no Registro.

> **Ressalva:** é um *hazard* de ordem de filtros confirmado no código; a
> assimetria de contêiner entre trilhas é plausível mas não foi observada. O
> mesmo corte existe em `manifesto`, então a transmissão direta tem a mesma
> exposição.

**Correção:** perguntar pelo português na lista COMPLETA antes de cortar por
contêiner; se o corte esvaziar o pt, tratar aquele contêiner como sem áudio
utilizável e empurrar `tentarJuntar` para o outro par. **No mínimo**,
acrescentar ao `TrilhaAudioTest` o par que falta.

### 15. `ESCRITAS_DE_FORA` recusa pontuação de largura fixa · `serie.js:263` — BAIXA

Um "｜" (pipe de largura fixa) num título português faz o episódio ser recusado
como "está em outro idioma". É o defeito da v5.252 ("Mission Refocus") por outra
régua.

**Correção:** estreitar a faixa final para o que é escrita CJK de verdade,
deixando FF00–FF60 (ASCII de largura fixa) fora. Um caso no `serie.test.mjs`.

### 16. `nomeDoItem` pode devolver vazio · `serie.js:717` — BAIXA

Contra o que o próprio KDoc e o `CLAUDE.md` prometem ("nunca devolve vazio"). O
gatilho — `name` vazio vindo do extrator — é hipotético.

---

## Contrato de UI e diagnóstico

### 17. "Tirar da fila" promete o contrário do que faz · `controle.js:2889` — MÉDIA

A fila **é** detentora (`LISTS` em `db.js:60`). Um item que só vive nela é
DESTRUÍDO ao sair — para um episódio de série de ~300 MB baixado em rede de
celular, o gesto que pareceu reversível não é.

> **Ressalva:** a dica na tela ("continua onde estiver guardado") é condicional
> e não mente literalmente; o que está errado é o comentário de
> `controle.js:2877-2879`, que afirma o oposto do `lerDetentores` e do comentário
> de `togglePlaylist` (8424-8427).

**Correção:** escolher UM contrato e escrevê-lo nos três lugares. A dica dizer a
cláusula destrutiva é o caminho mais honesto.

### 18. "Só há hinário neste aparelho" sem olhar as recusas · `controle.js:13933` — BAIXA

A frase erra quando há coleções recusadas por `MOTIVO_SEM_INDICE`: o operador
desliga o filtro, continua vazio, e nada diz que falta carregar a biblioteca.

### 19. `novoToken()` e `porId()` são código morto · `EspelhoMidiaCache.kt:213` — BAIXA

> **Ressalva:** a frase "a entropia é do lado que cunha" (KDoc do topo) está
> CORRETA. Quem promete um caminho de reserva inexistente é só o KDoc de
> `novoToken` (210-212).

---

## Testes que faltam

### 20. `letraCasa` não é amarrada por oráculo nenhum · `sorteio-tela.test.mjs:126`

É a única das capacidades injetadas sem verificação de ponteiro. Trocar a ordem
dos argumentos de `lyricMatch` faria o sorteio parar de achar faixas que casam
SÓ na letra — os dois oráculos passariam, e o pool voltaria plausível e ERRADO,
que é o segundo dos quatro modos de errar declarados no topo do próprio teste.

> O comentário daquele oráculo ainda fala em "quatro ponteiros"; `sorteioCap`
> devolve **sete**.

### 21. Nenhum oráculo de JS roda em PR nem em branch · `.github/workflows/apk.yml:49`

Todos os oráculos moram no job `web-ota`, cujo `if` exige `refs/heads/main`. A
primeira vez que a suíte roda é **no push em `main`** — quando o commit já está
na linha que alimenta a frota. Um `tokens.test.mjs` que reprove ali não publica
o bundle, mas `main` já contém o commit e a saída é um segundo lote.

**Correção:** extrair os passos de verificação para um job próprio, sem o `if`
de `main`, rodando em `push` e `pull_request`, e deixar no `web-ota` só
empacotar/publicar com `needs:`. Não foi feito aqui porque reestrutura o job que
alimenta o canal OTA — é mudança que pede uma execução de verdade para conferir.
