<!-- Capítulo de docs/ARQUITETURA-WEB.md. O índice e as regras
     de desenvolvimento ficam lá; este arquivo é só este capítulo. -->

## Motor de renderização (`shared/stage.js`)

`createStage(opts)` retorna um objeto com a API de reprodução. Usado pelo Display
(tela real) e pelo Controle (a mini-preview, muda enquanto houver tela conectada
— ver "A saída de áudio"). Suporta blobs locais,
arquivos do OPFS (`opfsPath` — resolvidos via `AVDB.opfsGetFile`, com re-checagem
de `loadSeq` após o await) e itens de URL direta (`blob=null, url=string`).
Itens `kind='youtube'` (link sem bytes) **não chegam ao stage**: quem os
resolve é o Controle, ANTES do `load` (`resolverLinkYoutube`), e o Display
esvazia o palco se um chegar. O vídeo do YouTube que de fato toca — baixado ou
por transmissão direta (`shared/mse.js`) — entra como `<video>` COMUM, pelo
mesmo caminho de toda mídia local. (Até a v5.212 havia um iframe no
`display.js`; ele saiu com a IFrame Player API.)

### Modelo de camadas: wallpaper é uma cortina por cima de tudo

O wallpaper fica **acima** (z-index maior) de toda mídia — o `<img>` e o
`<video>` do stage. A mídia toca/troca de conteúdo **livremente
por baixo**, sem nunca precisar saber se está "visível"; o wallpaper só
liga/desliga essa cortina por cima, com fade quando configurado.

Isso existe porque o modelo antigo (mídia por cima, escondida/revelada
conforme a view) exigia que cada tipo de mídia rastreasse "já posso me
revelar?" — para o YouTube isso significava só revelar o iframe quando
`view==='visual'` **e** o vídeo já estivesse tocando; se o vídeo começasse com
o wallpaper ligado, essa condição nunca era satisfeita e o vídeo ficava preso
atrás do wallpaper para sempre, mesmo depois de desligar o wallpaper (o áudio
tocava normalmente, só o vídeo nunca aparecia). Com o wallpaper como cortina
por cima, revelar é sempre só "esconder a cortina" — não depende mais de em
que estado (view) a mídia foi carregada.

- **`coveredNow`** (privado) é a única fonte de verdade sobre se a cortina
  está cobrindo agora. Começa `true` (nada carregado).
- **`computeCover()`**: `!current || ended || view === 'wallpaper' ||
  semVisual()` — a cortina deve cobrir sempre que não há mídia, ela "terminou"
  (`ended`, aguardando replay), o operador pediu `view='wallpaper'` — ou o que
  entrou **não tem imagem nenhuma para mostrar**.
  Repare que o primeiro, o segundo e o quarto termos **não dependem da view**:
  sem nada visível em cena a cortina cobre nos dois valores dela. É disso que
  sai a guarda de `setViewFaded` descrita abaixo.

##### `semVisual()`: áudio puro mantém o wallpaper (v5.112)

Um registro `kind: 'audio'` **sem letra sincronizada** — um mp3 importado, o
instrumental de fundo, o áudio baixado de um vídeo do YouTube — não põe nada no
`<img>` nem no `<video>` (ver `applyMedia`). Sem esta pergunta a cortina ABRIA
para ele: o telão saía do wallpaper e ficava no **preto do palco**, com o louvor
tocando por trás de um retângulo vazio. Não era uma capa errada — era a ausência
de qualquer coisa, e no meio de um culto isso se lê como projetor apagado.

A letra é a exceção que confirma a regra: quando o áudio TEM letra a cortina
precisa sair da frente, porque a `.lyrics-layer` fica **por baixo** dela (o
wallpaper tem `z-index` maior, e é assim que ele cobre/revela as camadas de
graça). Por isso a pergunta é feita ao PRÓPRIO registro (`current.lyrics`), que
é quem carrega a letra — a mesma condição que o `display.js` já usa para chamar
`showLyrics` —, e não à camada, que o stage não conhece.

Três pontos onde ela entra, e o terceiro é o que fecha o caso:

1. `computeCover()`, que governa `play()`, `setView()` e o `clear()`.
2. O fim do `load()`: `view === 'visual' && coveredNow && !semVisual()` — não
   abre a cortina para quem não tem o que mostrar.
3. O **caminho inverso**, que é o que quase escapou: uma IMAGEM em cena seguida
   de um áudio sem letra. Ali a cortina já estava aberta (havia o que ver) e
   ninguém a fecharia — o telão ficaria no preto. Daí o `if (semVisual() &&
   !coveredNow) await coverIn(false)` no fim do `load`.

E como a cortina é **compartilhada** (a Camada de Texto a abre por conta
própria para o cartão aparecer), o Display precisa da mesma regra ao devolvê-la
depois que o texto sai: `reconcileCover` pergunta `stage.shouldCover()` — o
`computeCover` exposto — em vez de reabrir cegamente. Só quando a cena é do
stage: fora dele `current` pode estar nulo e a pergunta responderia "cobre"
justamente sobre o que está em cena.

**Verificado em Chromium**, com Controle e Display na mesma origem trocando
comandos de verdade: imagem em cena → `wallpaper: none`; áudio sem letra logo em
seguida → `wallpaper: flex`, `<img>` e `<video>` ocultos; áudio COM letra →
`wallpaper: none` e a camada de letra visível.
- **`instantCover(show)`** / **`coverIn(rampAudio)`** / **`coverOut()`**: as
  três únicas funções que tocam o elemento do wallpaper. `coverIn`/`coverOut`
  fazem fade (conforme `fadeOut`/`fadeIn` e `fadeTime`) e usam `coverSeq` para
  descartar fades de cortina obsoletos (um pedido mais novo cancela o
  anterior); `instantCover` é imediato (sem fade) e sempre vence.
- `img.hidden`/`video.hidden` (**`applyMedia()`**) passam a depender **só do
  `kind`** da mídia atual — nunca de `view`/`ended`. A mídia continua
  renderizando/tocando por baixo mesmo com a cortina fechada (é assim que o
  áudio do YouTube ou de um vídeo local continua audível com "wallpaper on").
- **`stage.coverIn`/`coverOut`/`instantCover` são expostos publicamente** —
  o Display os chama diretamente quando precisa mexer na cortina sem passar por
  um `load`, já que ela é o **mesmo elemento físico** de wallpaper compartilhado.
  `coverIn(rampAudio=true)` mexe no volume do `<video>` do próprio stage.
  (A superfície nasceu pública para a cortina do EMBED do YouTube, que tinha um
  `<video>` fora do stage e uma rampa de áudio própria — `ytSetView()`,
  `onPlayerStateChange()`. O embed saiu na v5.212 e hoje só há um `<video>`, o do
  stage; a exposição fica porque os pontos acima continuam existindo.)

### Opções de criação

```js
createStage({
  wallpaper,    // elemento do wallpaper (cortina, por cima de tudo)
  img,          // elemento <img>
  video,        // elemento <video>
  forceMuted,   // bool — mantém vídeo sempre mudo (preview do Controle)
  onEnded,      // callback quando o vídeo termina
  onTime,       // callback em timeupdate / loadedmetadata / play / pause / ended / volumechange
  onBlocked,    // callback quando autoplay é bloqueado pelo browser (só
                // NotAllowedError; AbortError de um play() interrompido por
                // pause()/load() seguinte — normal em toda troca de mídia —
                // é ignorado, para não disparar recuperação de áudio à toa)
  onError,      // callback no evento 'error' do <video>
})
```

### Estado interno

```
current     → registro da mídia carregada (null = nada)
ended       → flag: vídeo chegou ao fim (permite replay sem recarregar)
view        → 'visual' | 'wallpaper'
muted       → bool (intenção do operador; independe de forceMuted)
volume      → 0.0 – 1.0
url         → object URL do blob OU URL externa em uso
isBlobUrl   → bool — se true, revoga com URL.revokeObjectURL ao trocar/limpar
loadSeq     → contador para descartar loads/fades concorrentes obsoletos
coveredNow  → bool — a cortina do wallpaper está cobrindo agora?
coverSeq    → contador para descartar fades de cortina obsoletos
fadeIn/fadeOut/fadeTime → transições (fixas: createStage.FADE, ver abaixo)
```

### Transições (fade)

**Regra geral: transição entre mídias é sempre PRETO; o wallpaper só aparece
como ponto final (resting state confirmado), inicial (nada carregado ainda)
ou manipulado explicitamente pelo operador (`view` toggle).** Nunca como parte
de uma troca de conteúdo em andamento — inclusive quando a troca depende de
rede (YouTube) ou é ambígua no momento (fim natural, antes de saber se um
próximo item vem em seguida).

Duas transições **independentes** quando fade está ativo:

**Áudio nunca mostra o `<video>`** (`applyMedia`: `video.hidden = kind !==
'video' || ended`). O elemento é só o "sink" de som — em áudio puro não há um
pixel a exibir. Mantê-lo em cena fazia o navegador desenhar o **placeholder de
mídia** (retângulo claro com botão de play) por cima do preto: invisível
durante o hino, porque a camada de letra o cobria, e aparecendo justamente no
FIM, quando a letra esmaece e o descobre. É o mesmo placeholder já perseguido
na troca de mídia (ver `resetMediaDom`/`load`), mas com outra origem — ali era
um `<video>` sem `src`, aqui é um `<video>` com `src` e nada a mostrar. Um
elemento `display:none` continua tocando áudio normalmente.

**A entrada tem rampa de volume, como a saída.** Isto não existia: `load()`
escrevia o volume direto no alvo e a mídia entrava no talo enquanto o visual
ainda esmaecia — a saída tinha rampa, a entrada não, e a assimetria era audível
a cada troca de hino. Agora, com `fadeIn` ligado, `rampVolume(0, volume,
fadeTime)` roda **depois** de `play()` (que restaura o volume alvo e limpa o
`rampTimer`, e por isso não pode vir depois da rampa).

- **Fade de CONTEÚDO** (`runFadeOut(rampAudio)` + `mediaReady`/fade-in): troca
  de item enquanto já visível (ex: vídeo A → vídeo B com a cortina já aberta),
  fim natural (`ended`) e troca de TIPO de conteúdo (mídia local ↔ YouTube via
  `fadeOutToBlack()`, ver seção do Display). A mídia atual esmaece até o
  **preto** (não até o wallpaper — a cortina não participa dessa transição);
  a próxima entra com fade-in a partir do preto, só depois de pronta pra
  pintar (`mediaReady`: `img.decode()` / `loadeddata` do vídeo, timeout de
  2,5 s) — sem isso o conteúdo "pipoca" no meio do fade. Vídeo/áudio ramp
  0 → alvo junto (exceto preview `forceMuted`).
- **Fade da CORTINA** (`coverIn`/`coverOut`): cobrir ou revelar a mídia
  (independente de qual mídia é ou de qual tipo) — reservado para os três
  contextos legítimos do wallpaper (ponto final/inicial/manual), nunca para
  uma troca de conteúdo em si. Usado em:
  - **Saída** (`stop`, `clear`, `view→wallpaper`): `coverIn()` — a cortina
    sobe revelando... nada, ela é opaca; a mídia continua tocando
    (des)coberta por baixo. `stop`/`clear` cobrem **com rampa de áudio**
    (`coverIn(true)` — corta a reprodução abruptamente, então o volume desce
    suave); `view` toggle é **sem rampa** nos dois sentidos (só o visual
    muda, o áudio não é afetado).
  - **Entrada** (`load` que revela conteúdo coberto, `view→visual`):
    `coverOut()` — a cortina desce, revelando a mídia que já estava tocando
    por baixo (sem precisar esperar nada dela).
- **`ended` (fim natural)**: esmaece até o **PRETO** (`runFadeOut(false)` —
  sem rampa, o vídeo já parou sozinho), nunca a cortina — ainda não se sabe
  se um próximo item vem em seguida. Só cobre com o wallpaper de fato
  (`instantCover(true)`) **~400 ms depois**, e só se `ended` continuar
  verdadeiro e nenhum `loadSeq` mais novo tiver assumido a cena nesse meio
  tempo — ou seja, só quando fica confirmado que é o ponto final de verdade
  (`repeat='off'` ou Controle fechado). Com avanço automático de playlist, o
  `load` do próximo item (disparado por `onEnded`) chega quase junto e
  assume via `loadSeq` bem antes desse prazo — a marca nunca chega a
  aparecer entre os itens da playlist. `video.hidden` também passa a
  considerar `ended` (além do `kind`): sem isso, o `currentTime=0` do fim
  natural (preparando o replay) mostraria um salto pro primeiro frame antes
  do preto/cortina cobrir.
- `setVolume` do operador cancela qualquer rampa em curso (de conteúdo ou de
  cortina — ambas usam o mesmo `rampTimer` do `<video>`, mutuamente exclusivas
  no tempo); `play`/`stop` restauram o volume alvo (evita ficar preso em
  volume 0 pós fade).

### API exposta

```js
stage.handle(cmd)
stage.load(id, view, muted, volume, startAt, autoplay)
                       // startAt: posição inicial em segundos (opcional)
                       // autoplay: só `false` muda algo — a cena volta PAUSADA.
                       //   `undefined` mantém o comportamento de sempre (todo
                       //   load normal toca), então nenhum chamador antigo mudou.
                       // `handle({type:'load'})` os lê de cmd.time / cmd.playing
stage.clear()
stage.play() / pause()
stage.seek(seconds)
stage.setView(v) / setMute(m) / setVolume(vol)
stage.setFade({ fadeIn, fadeOut, time })  // chamado uma vez, no init, com createStage.FADE
stage.setFit(v)        // 'contain' (ajustar) | 'cover' (preencher) | 'fill' (esticar)
stage.setForceMuted(v) // alterna em tempo real se o stage é forçado a ficar mudo
                        // (preview com tela conectada; tela da rede antes do gesto)
                        // ou toca áudio de verdade, com rampa curta (MUTE_RAMP_TIME)
stage.coverIn(rampAudio) / coverOut() / instantCover(show)  // cortina do wallpaper (ver acima)
stage.fadeOutToBlack()  // esmaece até o preto e reseta (current=null) sem tocar a cortina —
                        // usado só na troca de TIPO de conteúdo (mídia local ↔ YouTube)
stage.getCurrent()     // → registro atual ou null
stage.getView()        // → 'visual' | 'wallpaper'
stage.isPlaying()      // → bool
stage.hasEnded()       // → bool (fim natural, aguardando replay — as camadas
                       //   paralelas usam isso para não re-renderizar com o
                       //   currentTime já zerado; ver "Fim natural" na Camada de Texto)
stage.isTimed()        // → bool (true para vídeo/áudio)
stage.getTime()        // → currentTime em segundos
stage.getDuration()    // → duração em segundos
stage.getMuted()       // → bool
stage.getVolume()      // → 0.0 – 1.0
```

*(Os getters sem chamador — `getPage`, `getFit`, `isForceMuted` — saíram da
superfície na limpeza da auditoria de agosto/2026; os setters correspondentes
ficam.)*

### Proporção da preview (`--pv-ar`)

A preview é uma **miniatura fiel do telão**, e isso só se sustenta se ela tiver
a **proporção** do telão. Ela era `aspect-ratio: 16/9` fixo — contra um dongle
2,17:1 (3120×1440, comum), toda mídia mentia sobre o enquadramento: uma imagem
16:9 preenchia a preview inteira e ganhava barras laterais de 18% na projeção,
um vídeo enquadrado aqui aparecia cortado lá, e um versículo que cabe em 3
linhas no telão aparecia truncado no meio da palavra.

`applyPreviewAspect(tv)` (controle.js) escreve `--pv-ar` em `:root`, e
`.preview` usa `aspect-ratio: var(--pv-ar, 16 / 9)`. A fonte é
`AVNative.displays()` — que já devolve `{w, h}` da tela conectada — mais
`onDisplayChange`, então trocar de TV no meio do culto reajusta a preview
sozinho. **Sem TV conectada a projeção é a própria preview em tela cheia**, no
celular: aí o alvo passa a ser a tela do aparelho em paisagem
(`max(screen.w, screen.h) / min(...)`), que é exatamente o que vai ao
espelhamento. No navegador, sem ponte, vale sempre esse segundo caminho.

**A preview ENCOLHE em vez de transbordar.** A largura ideal é
`--deck-pv-h × --pv-ar` (a altura da faixa da grade vezes a proporção), mas ela
nem sempre cabe: num telão largo, ou num celular estreito, a soma
`preview + 2 botões + gaps` estoura a coluna. Com `height: 100%` fixo e
`flex: 0 0 auto` a preview simplesmente vazava por baixo da coluna do mixer e
levava o botão de próxima estrofe para fora da tela. Hoje quem manda é a
LARGURA: `width` ideal + `max-width: 100%` + `flex: 0 1 auto`, com
`height: auto` + `aspect-ratio` — o flex encolhe a preview até caber e a altura
acompanha, preservando a proporção; `align-self: center` mantém a miniatura
centrada quando ela fica mais baixa que a faixa. A altura da faixa é o token
`--deck-pv-h`, usado tanto no `grid-template-rows` do `.deck` quanto neste
cálculo — se os dois divergirem, a conta da largura passa a estar errada.

O valor é limitado a `[PV_AR_MIN, PV_AR_MAX]` = `[1.2, 2.4]`: acima disso a
largura calculada estoura a coluna e a preview passa a ser encolhida pelo
`max-width: 100%`, deixando a faixa com folga vertical em vez de ficar
proporcional. Telas reais de projeção ficam entre 4:3 e ~2,2:1, bem dentro da
faixa; um painel 32:9 bate no teto e deixa de ser proporcional — troca
deliberada. Verificado em 24 combinações (6 larguras de celular × 4 proporções
de telão): nada transborda a linha nem invade o mixer. (Até a v5.48 o limite
também protegia os dois botões de estrofe que dividiam a linha com a preview;
eles saíram na v5.49 — ver "Um par de botões, dois eixos" —, e a faixa subiu de
130px para 150px justamente porque a largura sobrando virou espaço morto.)

Duas consequências que valem registrar:

- **A calibração deixou de ser duplicada.** Todo o dimensionamento das camadas
  já era em `cq*`, relativo ao container, logo **invariante de escala**: com a
  proporção certa, os mesmos números dão a mesma composição em 280px e em
  3120px. Os valores próprios que a preview tinha (`.pv-text-main` 16% maior,
  `.pv-lyrics-box` bem maior…) eram compensação empírica para a proporção
  errada. Hoje `.pv-*` repete literalmente os valores de `.text-*`/`.lyrics-*`,
  e a fidelidade passa a ser estrutural em vez de ajustada à mão.
- **A borda virou `outline`.** Com `box-sizing: border-box`, uma `border: 1px`
  entra no border-box e o `aspect-ratio` passa a valer para a caixa COM a
  borda — 1px em 128px de altura já desloca a proporção ~0,8%, e a proporção é
  justamente o que se está tentando acertar. `outline` com `outline-offset:
  -1px` desenha igual sem ocupar layout.

### Preenchimento da mídia (`setFit`)

`setFit(v)` aplica `object-fit` direto via `style` no `<img>` e no `<video>`
do stage (`'contain'` por padrão, aceita `'cover'`/`'fill'`; qualquer outro
valor cai em `'contain'`) — sobrepõe o `object-fit: contain` fixo do CSS.
Persistido em `state.fit` e propagado pelo comando `fit`, despachado direto
para o stage nos dois documentos. (O desvio direto nasceu porque o roteamento
normal cairia no ramo do embed do YouTube, que ignorava `fit`; o ramo saiu na
v5.212 e o desvio ficou, agora sem exceção nenhuma a contornar.)

### Rampa de mudo (`setMute`)

Mutar/desmutar não corta o áudio na hora — faz uma rampa curta de volume
(`MUTE_RAMP_TIME`, 0,25 s) usando o mesmo `rampTimer` das outras transições
(mutuamente exclusivas no tempo, a mais recente cancela a anterior). Ao
mutar, a rampa desce até 0 e só então `video.muted` é de fato marcado como
`true` (evita o "pop" de um corte abrupto); ao desmutar, `video.muted` volta
a `false` já na hora (senão volume 0 não seria ouvido) e a rampa sobe até o
volume alvo **partindo de onde o volume está** — 0 quando se sai do mudo (não
há o que preservar), o valor corrente em todo o resto.

**Essa partida é o conserto da v1.4.17, e o defeito que ela apaga não tinha
sintoma de tela.** A rampa partia de zero SEMPRE, e `setMute` é uma função de
DECLARAR estado: quem a chama no Controle é o `load()`, que reaplica a cena
inteira a cada troca de aba, a cada redesenho da lista, a cada importação. Com
o som já ligado, cada uma dessas reafirmações escrevia `volume 1 → 0 → 1` no
`<video>` que estava tocando (MEDIDO no arnês). Em JS o par é atômico; no
aparelho cada escrita atravessa o renderer até o `AudioRendererImpl`, e o
retorno de chamada do áudio roda a cada ~10 ms — caindo entre as duas, ele
rende um buffer em silêncio. Era o ESTALO relatado ao navegar entre o
Cronograma e a Bíblia com um louvor no ar, e a janela se abre justamente ali,
onde a thread principal está mais ocupada. O outro caso que a partida corrige
é o TOQUE DUPLO no botão de mudo — desmutar no meio da rampa de mutar.
Oráculo: `tools/aba-sem-estalo.test.mjs`, provado por reversão. Um `setTimeout` (`muteApplyTimer`) aplica o `muted` real
ao final da rampa de descida, mas confere `muted` de novo nesse instante —
um `setMute()`/`load()` mais recente pode ter mudado a intenção enquanto a
rampa corria, e a aplicação atrasada não deve "ressuscitar" um mudo já
desfeito. `setVolume()` (o operador arrastando o fader) cancela qualquer
rampa de mudo em andamento, senão o volume ajustado manualmente seria
sobrescrito pelo `muteApplyTimer` pendente. (Havia uma SEGUNDA implementação
desta mesma lógica, em paralelo, para o embed do YouTube — `ytRampVolume` no
Display e `ytPreviewRampVolume` no Controle, com `player.mute()`/`unMute()` nas
pontas. As duas saíram na v5.212 com o embed: hoje há um `<video>` só, e a
rampa é uma só.)

**Hoje há UM sink de áudio, e a rampa é uma só**: o `<video>` do stage
(`rampVolume`). O passo-a-passo do fade sonoro (`steps = max(2, round(dur*20))`,
clamp 0–1) e a duração da rampa de mudo (0,25 s) vivem no `stage.js`.

`createStage.rampSteps` e `createStage.MUTE_RAMP_TIME` continuam expostos, mas
**não têm consumidor externo desde a v5.212** — não os leia como contrato. Eles
existiam para os outros dois sinks (`ytRampVolume`, `ytPreviewRampVolume`), que
saíram com o embed.

### Concorrência de carregamento

`load()` é assíncrona. O contador `loadSeq` garante que apenas o **último** `load()`
iniciado aplica seu resultado — chamadas anteriores obsoletas são descartadas.

**Posição inicial e autoplay (`startAt`/`autoplay`)** existem para a
**reconexão do telão** (ver "Reenvio da cena"), e cada um tem uma sutileza:

- A posição só "gruda" **depois que a duração é conhecida** — escrever
  `currentTime` junto com o `src` é perdido em silêncio. Por isso ela é
  aplicada num listener `loadedmetadata` com `{ once: true }`: vale para ESTA
  fonte, e a próxima traz o seu próprio pedido. O listener reconfere `loadSeq`
  antes de escrever — outro `load` pode ter assumido durante a espera.
- `autoplay === false` **suprime o `play()`**, e só isso: quem revela a mídia
  continua sendo o `applyMedia()` + a cortina, no fim do mesmo `load`. Um vídeo
  pausado mostra o quadro congelado, que é exatamente o que o telão tinha antes
  de cair.

**A troca de view tem contador PRÓPRIO (`viewSeq`).** `setViewFaded` usava o
mesmo `loadSeq`, e isso fazia um toque em "visual on/off" **cancelar um `load()`
em curso**: o `load` fica assíncrono de 0,7 s a 3 s (fade-out de 0,6 s +
`getMedia` + `opfsGetFile` + `mediaReady` até 2,5 s), e nessa janela o
`runFadeOut` já levou a mídia anterior a `opacity:0` e volume 0 — mas o `src`
novo nunca chegava a ser aplicado. Resultado: telão preto e mudo, com
`current` ainda apontando para o item antigo. O gesto é natural logo depois de
escolher um item (e o deslize ↑ da preview em tela cheia faz o mesmo), então
não é um caso de borda.

A cortina é **ortogonal ao conteúdo** — é o que a própria seção "Duas
transições independentes" afirma. `setViewFaded` guarda os dois contadores:
descarta se um `setViewFaded` mais novo assumiu (`viewSeq`) **ou** se um
`load`/`clear` assumiu a cena no meio do fade (`loadSeq`) — nesses casos quem
chegou depois já decidiu o estado final da cortina. Ações exclusivas
(`load`/`clear`) continuam podendo cancelar um `load`; trocar a view, não.

#### Sem nada em cena, trocar a view não transiciona (v5.69)

`setViewFaded` compara `computeCover()` **antes e depois** de trocar a view e
volta cedo quando o resultado é o mesmo. Sem mídia — ou com a que havia já
terminada — a cortina cobre nos dois valores da view (os termos `!current` e
`ended` não dependem dela), então não há transição nenhuma a fazer.

Fazer uma era o defeito: `coverOut()` esmaecia o wallpaper por 0,6 s sobre o
VAZIO, que é **preto**, e o `instantCover(computeCover())` do fim o recolocava.
Do lado de quem opera, descobrir o telão sem mídia nenhuma **"piscava preto e
voltava"** — uma reação forte para um botão que ali não muda nada do que está
projetado. Só a direção `wallpaper → visual` sofria: na oposta, `coverIn` já
voltava cedo por `coveredNow`.

A exceção é o parâmetro **`overlay`** (`stage.handle({ type:'view', overlay:true })`),
que o Display passa quando o cartão de texto está no ar: ali existe uma camada
por cima do stage, descobrir revela alguma coisa, e o fade tem de acontecer. O
stage sozinho não tem como saber disso — ele só enxerga o que ele mesmo desenha.

---
