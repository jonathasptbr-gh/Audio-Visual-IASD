# O app inteiro em atalhos — o navegador do computador como painel de controle

**O que este arquivo é:** um ESTUDO DE CASO, não um pedido de código. Ele
examina a ideia do operador — o celular como servidor e o navegador do
computador como **painel de controle com tudo o que o app tem**, com a
apresentação numa segunda tela — e responde o que é possível, o que não é, o
que já existe e o que precisa ser medido. A entrega é **decisão do operador**.

**Nota de revisão (2026-11-18, 22h).** A primeira versão deste estudo propôs
uma "mesa recortada" — só o que está no ar. O operador corrigiu, e a correção
muda o desenho: ele quer **o app inteiro em atalhos**, porque o painel "vai
estar apenas criando atalhos para os botões e funções que o app vai fazer"; e
quer **começar o processo pelo computador**, sem abrir o app, ligar o servidor
e conectar a tela. A mesa recortada está retirada. O que continua valendo é a
análise de plataforma (§8–§10), a segurança (§12) e os testes (§14).

**Nota de revisão 2 (2026-11-18, 22h50).** O operador corrigiu de novo: o
celular **vai para casa com o dono**, então o estado "quente" (app minimizado
desde o culto anterior) **não é um modelo** — é um acaso. O modelo principal é
o **ouvinte + notificação**: o navegador chama, o celular mostra "Abrir o
app", o operador toca. O "ouvinte" é o que permite o chamado; sem ele, o
navegador não acorda um celular frio. O passo a passo dos modelos está no
§9.6.

---

## 0 · A resposta em oito linhas

1. **O painel é o app em atalhos, não uma cópia da tela.** O app publica um
   **catálogo de ações** (id, rótulo, grupo, estado); o navegador desenha o
   catálogo; cada botão do painel chama a **mesma função** do botão do app. O
   app continua sendo o cérebro; o painel é a superfície.
2. **"Tudo o que o app tem" é cobertura de ações, não o DOM.** Toda função que
   é botão vira atalho; o que é gesto (arrastar, pinçar) vira uma ação
   equivalente ("subir", "descer") ou fica no celular. O painel não precisa
   dos pixels nem do IndexedDB.
3. **Começar pelo computador tem um pré-requisito e dois modelos.** O
   pré-requisito é o **ouvinte**: um serviço pequeno que sobe com o celular e
   escuta na porta. Sem ele, o navegador não tem como chamar um celular
   desligado. Com ele, o modelo que o operador quer é o **B**: o navegador
   chama, o celular mostra "Abrir o app", o operador toca, o app abre. O
   **núcleo headless** é o B sem o toque (o serviço acorda o cérebro sozinho) —
   e é um fork. O "quente" não é modelo: é o acaso de o app ter ficado aberto.
4. **Hoje o cérebro é o WebView da Activity.** Fechar o app (swipe/forçar
   parada) desliga a transmissão, de propósito. O ouvinte **não** abre a
   Activity sozinho — o Android bloqueia Activity em segundo plano; por isso
   ele notifica e o toque é do operador. O núcleo tira o cérebro da Activity;
   é o que dispensa o toque.
5. **Discrição:** o ouvinte tem uma notificação silenciosa; o app aberto tem a
   sua; o Task Manager/"Active apps" mostra. Com o núcleo, não há Activity nem
   Recentes; há o serviço e a notificação. Não é invisível; é o capricho, não a
   necessidade.
6. **O chão:** servidor na LAN, `/display/` em navegador, passador como
   precedente de controle, `SessionService` em primeiro plano,
   `KeepVisibleWebView`. Falta o **registro de ações**, a **página**, o
   **ouvinte** e a notificação; o **núcleo** só se o toque incomodar.
7. **A segunda tela é a página que já existe.** O `/display/` é uma janela no
   segundo monitor em tela cheia; arrasta-se uma vez e ativa-se com um clique.
   Sem programa exclusivo; o navegador é o cliente.
8. **O custo:** P0 = painel + registro + ouvinte + notificação (1 Release + 1
   lote web); P1 = o núcleo (o B sem toque), com spike; P2 = o piloto e o
   ADB/instalação fixa.

---

## 1 · O caso, para não ficar abstrato

O celular vai para casa com o dono. Na segunda ele está no bolso, sem app
aberto, sem servidor, no Wi-Fi de casa. No sábado, 8h40, o operador chega na
igreja e o celular entra na rede da igreja (ou ele liga o ponto de acesso, se
não houver Wi-Fi). Ele senta no computador da mesa de som, que tem o projetor
no segundo monitor, e **não quer pegar o celular**: o que ele quer é abrir o
navegador e ter o app ali.

O que ele precisa que aconteça, na ordem: (1) o celular **perceba** que o
navegador chamou; (2) o operador **autorize** — porque ligar um servidor na
rede não pode ser um comando remoto sem consentimento; (3) o app **suba**
(cérebro + servidor); (4) o painel **abra** no navegador; (5) a segunda
janela vire a **tela da congregação**. O resto do estudo é sobre quem faz cada
passo, e o que cada modelo exige do celular e do operador. O passo a passo
completo está no §9.6.

---

## 2 · O chão que já existe (e o que cada peça não faz)

| peça | o que ela faz hoje | o que falta para a ideia |
|---|---|---|
| **O bundle web** (`app/src/main/assets/web/`) | o app inteiro é uma página; o OTA atualiza sem APK | roda no WebView, com a ponte `__AVBridge`; no navegador não há ponte |
| **`EspelhoServidor`** (`EspelhoServidor.kt`) | serve `/display/`, `/shared/`, `/espelho/`, a mídia `/m/<token>` e o SSE `/e`, na porta 8787, só em IPv4 servível | serve só `PREFIXOS_BUNDLE`; **nunca** `web/controle/` |
| **O papel `tela`** (`espelho/tela.js` + `/display/`) | o telão inteiro em até 3 navegadores da LAN, sem instalar nada | é EXIBIÇÃO: não tem controle |
| **O passador** (`/passador-de-slides/`) | precedente de CONTROLE: `ant`, `prox`, `cortina`, com `ACOES_DO_PASSADOR` e um `POST /r` próprio | só três ações; sem código; sem catálogo |
| **`SessionService`** (`SessionService.kt`) | o único serviço em primeiro plano do culto: `mediaPlayback\|connectedDevice`, sem cota; notificação `IMPORTANCE_LOW` | segura o processo, não a Activity; a transmissão morre com ela |
| **`MainActivity`** | voltar = `moveTaskToBack` (o app nunca `finish()`); o WebView do Controle é `KeepVisibleWebView` com `manterVisivel=false` | fechar (swipe) = `onDestroy` = transmissão desligada |
| **`EspelhoEnergia`** | wake lock de 2 h renovado por tráfego real; Wi-Fi lock; térmica | Doze ignora wake lock; sem tomada, a rede cai |
| **O `Presentation`** (`StagePresentation.kt`) | o telão na TV via HDMI/cast, com `keepPlaying()` quando o app é minimizado | não é o caminho do computador |
| **O estudo 13.3** | o CSS de paisagem do Controle, em duas colunas, para tablet/celular deitado | é o app; o navegador é outra superfície |

**O que não existe em lugar nenhum:** um **registro de ações** — uma lista, no
lado web, que diga "esta é a ação, este é o rótulo, este é o grupo, este é o
estado, este é o handler". Hoje os botões estão espalhados pelo `controle.js`,
cada um com o seu `addEventListener`. O painel precisa desse registro para não
reimplementar o app.

---

## 3 · A correção da premissa: quem faz o trabalho pesado

A frase do pedido é "o smartphone como servidor, que faz o trabalho pesado".
Ela precisa de uma correção, e a correção é a favor da ideia:

| tarefa | onde deve rodar | por quê |
|---|---|---|
| acervo, cronograma, estado, tokens, pareamento | **celular** | é a fonte da verdade; é leve (KB) |
| leitura da mídia e entrega por `/m/` | **celular** | é I/O; o arquivo já está no cache do servidor |
| decodificar e desenhar vídeo, letra, texto, slide | **computador** | GPU do computador; o celular não aquece |
| codificar/transmitir vídeo (pixels) | **ninguém** | é o espelho de pixels que o projeto REMOVEU na v5.187; caro, quente e com atraso |
| transcode de formato | **ninguém** | o navegador toca o que o celular já tem; o que ele não tocar, o app avisa antes |

O celular "faz o trabalho pesado" no sentido de **orquestrar** o culto — não
no de carregar o vídeo nas costas. Quem carrega o vídeo é o computador, e é
por isso que a experiência pode ser discreta: um celular servindo JSON e
bytes, com a tela apagada, gasta muito menos do que um celular codificando
H.264 por três telas — o desenho que a v5.187 aposentou.

**O que isso muda no desenho:** o painel não pede um player novo; pede
**atalhos para as funções do app**. O painel manda ações; o app executa; o
`/display/` desenha. O celular só traduz.

---

## 4 · A arquitetura em três peças (e o cérebro em duas posições)

```
┌────────────────────────── celular ──────────────────────────┐
│  CÉREBRO (hoje: WebView da Activity; no núcleo: WebView     │
│  do serviço)  ── acervo, cronograma, estado, registro de    │
│  ações, handlers                                            │
│      │  __AVBus / MessageBus                                │
│      ▼                                                      │
│  EspelhoServidor :8787  ── HTTP claro na LAN                │
│      ├─ GET /mesa/          → o PAINEL (novo)               │
│      ├─ GET /mesa/acoes     → o CATÁLOGO (novo)             │
│      ├─ GET /e              → SSE: estado + catálogo        │
│      ├─ GET /display/       → a CONGREGAÇÃO (já existe)     │
│      ├─ GET /m/<token>      → a mídia, com Range (já existe)│
│      └─ POST /r             → ações do painel (novo ramo)   │
│  SessionService (FGS)  ── segura o processo; notificação    │
└─────────────────────────────────────────────────────────────┘
              ▲                                   │
              │ ações (POST /r)                   │ estado (SSE) + mídia (/m/)
              │                                   ▼
┌─────────────┴───────────────┐   ┌──────────────────────────────────────────┐
│  computador · janela 1      │   │  computador · janela 2 (2º monitor)      │
│  PAINEL (o app em atalhos)  │   │  /display/ em tela cheia (congregação)   │
│  todas as ações, paisagem   │   │  o mesmo bundle de hoje; som local       │
└─────────────────────────────┘   └──────────────────────────────────────────┘
```

**As duas posições do cérebro, e o que cada uma custa (os passos de cada um estão no §9.6):**

| | **Modelo B (P0)** | **Modelo C, núcleo headless (P1)** |
|---|---|---|
| onde o cérebro mora | WebView da Activity, que abre com o toque e se minimiza | WebView do serviço, sem Activity |
| quem acorda o cérebro | o operador, tocando na notificação | o ouvinte, sozinho |
| fechar o app (swipe) | desliga a transmissão; o ouvinte segue de pé e chama de novo | não há app aberto para fechar |
| discrição | minimizado, tela apagada, notificação | sem Activity; notificação |
| custo | painel + registro + ouvinte | painel + registro + ouvinte + o fork do cérebro |

**O protocolo do painel (o contrato):**

1. `GET /mesa/acoes` → o catálogo: grupos, ações, tipos, estado.
2. `GET /e` (SSE) → `mesa-estado` (o que está habilitado, valores, item no
   ar) e o catálogo quando muda.
3. `POST /r` `{"do":"mesa","acao":"<id>","valor":…}` → o servidor valida a
   lista fechada e injeta `{"type":"mesa","acao":…}` no barramento.
4. O `controle.js` recebe e chama o **handler do registro** — o mesmo do botão.

**Por que isso é barato:** é o padrão do passador (Pacote 34), um ramo de
`POST /r` com lista de permissão própria, e a execução no `controle.js`, que
já é quem manda em tudo. Nada de reimplementar o app no navegador, nada de
ponte nativa falsa. O painel manda INTENÇÃO; o app executa.

---

## 5 · O painel: o app em atalhos

### 5.1 O registro de ações (a peça que falta)

Cada controle do app passa a se declarar uma vez:

```js
// no lado web, junto do controle que já existe
registrarAcao({
  id: 'transporte.playpause',
  grupo: 'Transporte',
  rotulo: 'Tocar / pausar',
  tipo: 'botao',                 // botao | alternador | slider | lista
  estado: () => ({ habilitado: !!midiaNoAr(), valor: tocando() }),
  executar: () => alternarPlay(), // a MESMA função do botão
});
```

O botão do app e o atalho do painel chamam `executar` — não há duas
implementações. O painel não conhece o DOM, o IndexedDB nem o acervo; conhece
o catálogo e o estado.

**O que "tudo" significa, na prática:**

| tipo de coisa no app | no painel |
|---|---|
| botão (play, próximo, cortina, tela cheia) | botão |
| alternador (mudo, letra, modo) | alternador |
| slider (volume, posição) | slider |
| lista (acervo, cronograma, telas) | lista com nomes/ids e ações; os bytes ficam no celular |
| formulário (mensagem, texto, buscar) | campo + ação |
| gesto (arrastar para reordenar, pinçar) | ação equivalente ("subir", "descer", "aplicar") ou fica no celular |
| contexto (editar um item, abrir uma folha) | a ação fica desabilitada com o motivo, até o contexto existir |

**O recorte que fica de fora, e é honesto:** o painel não é um clone visual do
app. Ele é uma **superfície de ações** desenhada para tela grande. O operador
não vai arrastar uma mídia para o cronograma no navegador; ele vai tocar
"adicionar ao cronograma" na lista. Se um dia precisar do gesto, o celular
está ali.

### 5.2 O catálogo (o contrato)

```json
{
  "grupos": [
    { "id": "transporte", "titulo": "Transporte", "acoes": [
      { "id": "transporte.playpause", "rotulo": "Tocar / pausar",
        "tipo": "botao", "habilitado": true, "valor": false },
      { "id": "transporte.volume", "rotulo": "Volume",
        "tipo": "slider", "habilitado": true, "valor": 60, "min": 0, "max": 100 }
    ]},
    { "id": "slides", "titulo": "Slides", "acoes": [
      { "id": "slides.prox", "rotulo": "Próximo", "tipo": "botao",
        "habilitado": true },
      { "id": "slides.ant", "rotulo": "Anterior", "tipo": "botao",
        "habilitado": true }
    ]}
  ]
}
```

**As regras do catálogo:**

1. **O id é estável** e é o mesmo no registro, no catálogo e no `POST /r`.
2. **O handler é o mesmo do botão** — o teste de fronteira cobra o par
   (registro × painel), como o `passador-fronteira` cobra o par das ações.
3. **O estado vem do app**, não do painel: `habilitado`, `valor`, `motivo`.
   O painel não decide se "próximo" faz sentido; ele desenha o que o app diz.
4. **A lista fechada** `ACOES_DA_MESA` no servidor é a última fronteira: o que
   não está nela morre no 404 uniforme, mesmo que o painel invente o id.
5. **Nada de blob, `opfsPath` ou `youtubeId`** no catálogo; a mídia vai por
   `/m/<token>`, como no `__rec`.

**A cobertura cresce por lotes.** O P0 cobre transporte, slides, letra,
cortina, cronograma (lista + próximo) e status; os lotes seguintes acrescentam
biblioteca, configurações, telas, compartilhar. "Tudo" é a direção; a página é
útil desde o primeiro lote.

### 5.3 Os três desenhos

| desenho | o que é | custo | o que quebra | veredito |
|---|---|---|---|---|
| **A · o registro de ações** | o app se declara; o painel desenha o catálogo; o handler é o mesmo | médio: 1 Release (rota + lista + sessão) + 1 lote web (registro + página) + oráculos | nada do que existe; é uma porta nova, com lista fechada | **recomendado** |
| **B · o DOM no navegador** | servir `web/controle/` com uma ponte que troca `__AVBridge` por HTTP | alto: o bundle assume IndexedDB, OPFS, ponte nativa, 430×900 e 76 oráculos | a segurança (o app inteiro na LAN), o layout, a manutenção de duas pontes | **não** |
| **C · espelhar a tela** | transmitir os pixels do Controle para o navegador | alto: codec, atraso, térmica | é o espelho que a v5.187 removeu; volta o problema que ele resolveu | **não** |

**Sobre o desenho B, o número que decide:** o servidor recusa `web/controle/`
por decisão escrita (§8 do `TELAO-POR-COMANDOS.md`); servir o bundle é abrir
Configurações, acervo, compartilhamento e a ponte inteira para qualquer um na
rede. Não é uma questão de esforço; é a fronteira de segurança do projeto.

**Sobre o desenho C, a lição que já foi paga:** o espelho de pixels custou uma
auditoria inteira (v5.154 → v5.187) e foi removido porque quase todo defeito
dele existia por haver vídeo sendo transmitido. Não se volta.

**O atalho de protótipo, que não é o desenho:** dá para o painel mandar
`element.click()` em seletores do DOM do app (o "atalho para o botão" ao pé da
letra). Serve para provar a página em uma tarde; não serve para o produto —
seletor quebra, estado não desce, e cada botão vira uma string mágica. O
registro é o caminho.

---

## 6 · O catálogo, o estado e o que o app continua sendo

**O app continua sendo o cérebro.** O painel não carrega o acervo, não abre o
IndexedDB, não escreve no OPFS. Ele vê nomes, ids, estados e miniaturas; e
manda ações. O que o operador chama de "app no computador" é **o mesmo app,
com os mesmos botões, em outra tela** — não um segundo app.

**O que desce no `mesa-estado`:** o item no ar, o próximo, a posição, tocando,
página/total, cortina, volume, a lista do cronograma (nomes/ids), as telas
conectadas, a térmica, a bateria/carregando, os avisos. É o irmão do
`passador-estado`, com mais campos.

**O que sobe:** a ação e o valor. Nada de "faz isso por mim" fora do catálogo.

**O que o painel NÃO faz:** não busca no acervo, não edita o cronograma, não
mexe em configurações, não compartilha, não baixa mídia — a menos que essas
ações estejam registradas e liberadas, uma a uma. A lista fechada é o que
impede o "tudo" de virar "o app inteiro exposto".

---

## 7 · O modo paisagem, agora no navegador

O estudo 13.3 é o CSS de paisagem do **app** (duas colunas, `@media
(orientation: landscape)`, 76 oráculos de 430×900). O painel é outra coisa:

| | app (13.3) | painel (este estudo) |
|---|---|---|
| superfície | WebView retrato fixo (manifesto `portrait`) | navegador do computador |
| layout | media query em cima do DOM existente | página nova, paisagem desde o dia 1 |
| oráculos | os 76 de geometria, cada um ganha célula | os da página nova (cabe em 1280×720 e 1920×1080) |
| rotação do celular | Release (liberar `screenOrientation`) | não depende do celular |
| o que resolve | tablet/celular deitado | tela grande de verdade, sem Release de rotação |

**A vantagem:** o painel entrega a experiência de "app no computador, tela
maior, controles organizados" sem esperar a Release da rotação e sem herdar a
dívida dos 76 oráculos. **A desvantagem:** é uma página nova para desenhar e
orar; não é o app de sempre.

**A segunda tela, na prática:** a página `/display/` já é a tela da
congregação e já roda em navegador. No computador, ela é uma janela que o
operador arrasta para o segundo monitor e ativa com um clique (o botão "Ativar
esta tela" gasta o gesto de tela cheia + som, como na TV). O painel pode abrir
essa janela com `window.open` e mostrar o passo a passo; o arrasto é o único
gesto manual.

**Por que não há posicionamento automático:** a Window Management API
(`getScreenDetails`, `requestFullscreen({screen})`) é experimental, só
Chrome/Edge, e exige **contexto seguro**. O servidor serve **HTTP claro** na
LAN; `http://192.168.x.x` não é contexto seguro, então a API não está
disponível. Sobra arrastar a janela uma vez e apertar F11 — e isso é
suficiente para o caso. (Se um dia o TLS voltar a ter porta na UI, o
posicionamento automático vem de graça; não é pré-requisito.)

---

## 8 · A discrição: até onde dá para esconder

O Android não deixa um app comum rodar sem NENHUM sinal. O que dá para
escolher é o nível:

| nível | o que o operador vê | como chegar | limite |
|---|---|---|---|
| 0 | app aberto, tela acesa | hoje | é o que a ideia quer evitar |
| 1 | app minimizado, tela apagada; cartão na gaveta; app no Recentes | voltar/home; é o que o app já faz | a transmissão VIVE; o cartão é silencioso (`IMPORTANCE_LOW`) |
| 2 | cartão dispensado; app no "Active apps" | Android 13+: o operador dispensa o cartão | o Task Manager continua listando, e é por lá que se para; o cartão tende a reaparecer quando o app publica estado (a medir) |
| 3 | sem cartão nenhum; app no "Active apps" | negar a permissão de notificação | perde os controles de transporte e o "Desligar transmissão" da notificação; o Task Manager continua mostrando o app |
| 4 | invisível | root/Shizuku/device owner | **não é suportado, não é o caminho** |

**O nível 2 é o ponto doce** para o Modelo B (depois do toque, com o app minimizado): o celular fica na gaveta, a
tela apagada, o cartão silencioso (que o operador pode dispensar), e o "Active
apps" é o preço honesto de o sistema saber que algo roda.

**Com o núcleo headless**, o nível 2 vira o estado natural: não há Activity
para minimizar, não há app no Recentes; há o serviço e a notificação. O
Task Manager continua. **Não é invisível** — é o mínimo que o Android cobra de
um app que está servindo.

**O que NÃO dá para esconder:** o "Active apps", o consumo na tela de bateria,
o ícone de ponto de acesso (se o celular for o AP) e o ícone de carregando (que
é o que mantém o Doze longe). Nada disso é um problema no culto; é o mínimo.

**A distinção que decide o pedido:** `voltar`/`home` = **minimizar** (a
transmissão vive); `swipe` no Recentes ou "Forçar parada" = **fechar** (o
`onDestroy` desliga a transmissão, por decisão de projeto — para não deixar um
`ServerSocket` na rede da igreja sem ninguém para desligá-lo). O app com Activity (Modelo B) não
tem um estado "fechado, mas servindo"; o núcleo headless (Modelo C) tem. Ver §9.

---

## 9 · Começar pelo computador: os modelos, passo a passo

O pedido é começar pelo navegador, sem ter de abrir o app, ligar o servidor e
conectar a tela, com o celular **indo para casa com o dono**. Isso elimina o
"celular fixo, sempre quente" como modelo. Sobram os modelos abaixo; o §9.6
conta cada um como uma pessoa o usaria.

### 9.1 Por que o navegador não liga o app sozinho

Três barreiras, todas do Android, nenhuma do projeto:

1. **Alguém precisa estar escutando.** Um app que não está rodando não tem
   socket aberto; o navegador chama e ninguém atende. Só há três jeitos de
   haver quem atenda: um **serviço do próprio app** (o ouvinte), um **servidor
   na internet** que empurra um aviso (FCM) ou **ADB/device owner**.
2. **Um app em segundo plano não pode abrir uma Activity** (desde o Android
   10). As saídas sancionadas são uma ação do usuário (o **toque na
   notificação**), uma janela visível, o companion device, o device owner ou o
   ADB. Daí a notificação com "Abrir": o toque é o que o Android exige.
3. **Alguém precisa estar na mesma rede.** O celular e o computador têm de se
   enxergar. Se a igreja não tem Wi-Fi, o celular precisa ligar o ponto de
   acesso, e **isso é um gesto no celular** que o computador não pode fazer.

### 9.2 O ouvinte não é tão complexo — e a alternativa é pior

O operador achou o ouvinte complexo e propôs "o navegador chama e o celular
toca uma notificação". Mas **a notificação já pressupõe o ouvinte**: para o
navegador chamar o celular, algo no celular tem de ouvir. A alternativa sem
ouvinte é um **servidor na internet** que recebe o chamado do navegador e
empurra a notificação por FCM: exige internet nos dois lados, um servidor
nosso (o projeto não tem nenhum) e a conta do Google; na igreja sem internet,
não funciona. O ouvinte local é mais simples.

O ouvinte, de fato, é pequeno: um serviço em primeiro plano do tipo
`connectedDevice` (o mesmo que o app já declara), que sobe no boot e abre um
socket **só** em endereço servível (Wi-Fi ou ponto de acesso; nunca `rmnet`,
a regra do §2.3 do `TELAO-POR-COMANDOS.md`). Ele responde a uma única rota
("quero abrir") e publica a notificação. Reaproveita o `EspelhoServidor`, as
regras de bind e o `EspelhoPares`; o código novo é o receiver de boot, a rota
e a notificação. Mas ele tem **consequências**, e elas são o que importa
(§9.7).

### 9.3 O endereço: como o navegador acha o celular frio

Sem o app aberto, ninguém leu o IP na tela. Opções:

| opção | como é | limite |
|---|---|---|
| **IP reservado** no roteador da igreja | configuração de uma vez; favorito no navegador | depende do roteador e de alguém com acesso |
| **gateway do ponto de acesso** | no hotspot do Android o celular costuma ser `192.168.43.1`/`192.168.x.1` | varia por fabricante; **a medir** |
| **nome `av.local` (mDNS)** de volta | o ouvinte anuncia o nome; Windows e Chrome do computador resolvem `.local` | foi removido na v5.186 porque o Chrome do Android e as Smart TVs não resolvem — para o **computador** o motivo não vale, mas é código de multicast novo |
| **página de "achar o celular"** | o navegador varre a sub-rede | feio, lento, e varredura de rede é má prática |

A recomendação é **IP reservado ou gateway do hotspot, como favorito**, e o
`av.local` só se o piloto mostrar que o IP incomoda.

### 9.4 O ouvinte e o "um toque": o que o Android deixa

- O serviço sobe no boot (`BOOT_COMPLETED`) **como `connectedDevice`**: o
  Android 15 barra `mediaPlayback` e `dataSync` nesse caminho, não
  `connectedDevice` ([doc](https://developer.android.com/about/versions/15/behavior-changes-15)).
- Só sobe **se o app foi aberto ao menos uma vez** e **não foi "forçado a
  parar"**: app em estado "stopped" não recebe broadcast.
- **Se o operador "para" o app** pelo Task Manager (o botão Stop), o app
  inteiro morre, ouvinte incluído, e só volta abrindo o app ou reiniciando o
  celular ([doc](https://developer.android.com/develop/background-work/services/fgs/handle-user-stopping)).
- Toque na notificação **pode** abrir a Activity: é ação do usuário, isenção
  prevista ([doc](https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start)).
- **Doze** (tela apagada, parado, sem carregador) suspende a rede; o ouvinte
  pode não ouvir. Com o celular no bolso (em movimento) isso tende a não
  acontecer; sobre a mesa, sem carregador, pode. **A medir.**

### 9.5 O núcleo headless (o B sem o toque)

O mesmo ouvinte, mas no lugar de pedir o toque ele **acorda o cérebro dentro
do serviço**: um WebView criado pelo `SessionService`, carregando o bundle,
com a ponte, o registro de ações e o servidor. Sem Activity, sem Recentes. É o
único modelo que dispensa o celular, e o único que é um **fork**:

1. **WebView sem Activity não é caminho documentado.** Spike no aparelho.
2. **A ponte tem métodos que pedem Activity** (escolher arquivo, compartilhar,
   instalar APK): no núcleo respondem `sem-activity`.
3. **Dois cérebros** se o operador abrir o app com o núcleo no ar: estado e
   comandos duplicados. Saída: o app do celular vira **cliente** do núcleo, ou
   o núcleo é o único cérebro. É a decisão de UX mais séria.
4. **Memória e térmica:** um WebView a mais; aparelho de 2 GB sofre.
5. **A notificação continua**: não é invisível.

### 9.6 O passo a passo: como alguém usaria cada modelo

Cenário comum: sábado, 8h40. O celular está no bolso do operador e já está na
rede da igreja. O computador da mesa tem o projetor no segundo monitor.
**"Passos do operador"** são o que ele faz; **"o que acontece"** é o sistema.

#### Modelo 0 — HOJE (para comparar)

| # | passos do operador | o que acontece |
|---|---|---|
| 1 | tira o celular do bolso, destrava, abre o app | a Activity abre, o cérebro (WebView) carrega |
| 2 | toca em "Ligar transmissão" | o servidor sobe, o endereço e o código aparecem |
| 3 | lê o IP no celular; digita no navegador do computador | o navegador carrega a página de entrada |
| 4 | digita o código | a tela é pareada |
| 5 | clica em "Ativar esta tela" no navegador | tela cheia + som; a tela está pronta |
| 6 | controla **pelo celular** | o celular é a mesa |

**Limite:** o celular é o controle. É o que o operador quer **parar** de fazer.

#### Modelo A — "quente" (celular fixo, minimizado): REJEITADO

Só funcionaria com o celular ficando na igreja. O operador descartou: o
celular vai para casa com o dono. Deixo-o só porque, **durante o culto**, o
Modelo B termina nesse estado (o app minimizado servindo): ele é uma **fase**
dos outros modelos, não um modelo.

#### Modelo B — ouvinte + notificação + um toque (o pedido do operador)

*Uma vez, em casa ou na igreja (instalação):*

| # | passos | o que acontece |
|---|---|---|
| 0a | abre o app; liga "Permitir abrir pelo computador" | o app pede notificação (Android 13+) e registra o ouvinte |
| 0b | (opcional) reserva o IP do celular no roteador da igreja | o endereço fica estável |
| 0c | no computador, salva o endereço como favorito | — |

*Em todo culto:*

| # | passos do operador | o que acontece |
|---|---|---|
| 1 | chega; o celular entra no Wi-Fi da igreja (ou liga o ponto de acesso, se não houver) | o ouvinte, que já estava no ar, passa a escutar no endereço novo |
| 2 | no computador, abre o favorito | o navegador chama o ouvinte; a página responde "Chamando o celular…" |
| 3 | olha o celular: vê a notificação "Mesa pedindo para abrir — código 4821" | o ouvinte publicou a notificação |
| 4 | toca em **Abrir** (a tela pode pedir desbloqueio) | a Activity abre, o cérebro carrega, o servidor sobe **sozinho** e a Activity se minimiza |
| 5 | volta ao computador; a página já mostra o painel; digita o código | sessão autorizada; o catálogo chega |
| 6 | clica em "Abrir a tela da congregação"; arrasta a janela para o projetor; F11 e um clique | a segunda tela está no ar |
| 7 | controla **pelo painel**; guarda o celular no bolso | o app roda minimizado; tela apagada |

**Quantas vezes toca no celular:** uma (o toque no passo 4); mais, se
precisar ligar o ponto de acesso.

**Consequências e limites:**

- O app **aparece por alguns segundos** na tela (a Activity abre e minimiza):
  o toque é obrigatório (§9.1).
- O celular tem de estar **na mesma rede**. Sem Wi-Fi na igreja, o operador
  liga o ponto de acesso (um gesto no celular).
- Depende do ouvinte estar vivo: ele **não sobrevive** a "Parar" no Task
  Manager nem a "Forçar parada"; sobrevive a minimizar e a reiniciar (sobe no
  boot).
- O ouvinte fica ligado **o tempo todo** (em casa também): notificação fixa,
  socket aberto, bateria. A trava de rede (§9.7) é a resposta.
- Em Doze, o ouvinte pode não ouvir (§9.4). Se o computador chamar e nada
  acontecer, o operador **acorda o celular** (liga a tela) e chama de novo.
- Fabricantes que matam serviços (Xiaomi, Huawei, Samsung) exigem a lista de
  exceção da bateria.

#### Modelo C — ouvinte + núcleo headless (sem tocar no celular)

*Instalação:* igual ao B, mais "Permitir abrir sem tocar no celular" (um
consentimento explícito, porque a notificação deixa de ser o portão).

| # | passos do operador | o que acontece |
|---|---|---|
| 1 | chega; o celular entra no Wi-Fi (ou ponto de acesso) | o ouvinte escuta |
| 2 | no computador, abre o favorito e digita o código fixo (ou usa o navegador já autorizado) | o ouvinte valida e acorda o núcleo |
| 3 | espera alguns segundos | o serviço cria o WebView, carrega o bundle, o servidor sobe; o painel aparece |
| 4 | abre a tela da congregação; arrasta; F11 e um clique | a segunda tela está no ar |
| 5 | controla pelo painel | o celular fica no bolso, sem app aberto |

**Quantas vezes toca no celular:** zero (se tiver rede).

**Consequências e limites:**

- A segurança muda: **ninguém autoriza no celular**. A porta é o código fixo
  (ou o navegador autorizado antes). É o que o §12 trata.
- **O cérebro no serviço é o fork** do §9.5: spike, dois cérebros e métodos da
  ponte sem Activity.
- O app **não precisa aparecer** em nenhum momento; ainda há a notificação.
- Mesmos limites do B para rede, Doze, fabricante e "Parar".
- Se o operador abrir o app com o núcleo no ar, é preciso a decisão de UX do
  §9.5 (cliente do núcleo ou núcleo único).

#### Modelo D — ADB (instalação fixa, não é caminho de operador)

O computador roda `adb shell am start` e abre o app. Pede depuração
USB/sem fio ligada no celular, que é um risco de segurança permanente e um
cabo ou pareamento que o operador não vai querer. Serve a uma **instalação
fixa** (um celular dedicado que fica na igreja), que o operador descartou.

#### Modelo E — servidor na internet + FCM

O navegador chama um servidor nosso, que empurra uma notificação ao celular.
Dispensa ouvinte local e o celular não precisa estar na mesma rede **para
receber o chamado**. Exige internet nos dois lados, conta Google/Firebase e um
servidor mantido por nós (o projeto não tem nenhum; o Pacote 16 trata dessa
pergunta). E o celular ainda precisaria estar na mesma rede para o painel.
Não resolve o problema, só troca o ouvinte por um servidor.

### 9.7 O que o ouvinte custa (e as travas)

| custo | por quê | trava |
|---|---|---|
| **notificação fixa** | o serviço em primeiro plano exige | canal silencioso; texto "Pronto para o computador" |
| **socket aberto na rede de casa** | o ouvinte escuta onde o celular estiver | **só em rede aprovada** (a da igreja, identificada pelo gateway/SSID, ou o ponto de acesso do celular); em casa, não escuta |
| **superfície de ataque** | qualquer um na rede chama o ouvinte | o chamado só **gera uma notificação**; nada abre sem o toque (B) ou o código (C); limite de chamados por minuto |
| **bateria** | serviço vivo | o ouvinte é leve; medir |
| **o "Parar" do sistema** | derruba tudo | aviso no app; o operador sabe |
| **reboot** | o serviço não volta sozinho se parado pelo usuário | `BOOT_COMPLETED` + app aberto uma vez |

**A trava de rede é o que muda "ouvinte sempre ligado" de risco para recurso.**
Sem ela, o celular vira um servidor chamável em qualquer Wi-Fi que o operador
usar.

---

## 10 · O segundo plano e o núcleo: o que o Android cobra

| fato | consequência | o que fazer |
|---|---|---|
| **Doze** (tela apagada, parado, sem carregador, depois de um tempo) suspende a REDE e ignora wake locks — vale para TODOS os apps, com ou sem serviço em primeiro plano ([doc](https://developer.android.com/training/monitoring-device-state/doze-standby)) | o servidor para de responder; o painel "congela" | **celular na tomada** (o carregador sai do Doze); ou isenção de otimização de bateria |
| **App Standby** | o serviço em primeiro plano mantém o app ativo | nada |
| **WebView estrangulado em segundo plano** (o Chromium marca a página como `hidden`) | o CÉREBRO é o `controle.js`; se ele é estrangulado, a ação do painel demora ou não roda | `manterVisivel` no WebView do cérebro enquanto o painel estiver conectado (o mecanismo já existe) |
| **Fabricante agressivo** (Xiaomi, Huawei, Samsung) | mata o serviço mesmo com FGS | whitelist/autostart no aparelho; medir no aparelho da igreja |
| **Android 15: `dataSync` 6 h / `mediaProcessing` 6 h** | **não se aplica**: os tipos do culto são `mediaPlayback\|connectedDevice` (Modelo B, depois do toque) ou `connectedDevice` puro (ouvinte e núcleo), sem cota | nada |
| **Android 15: boot não pode subir `mediaPlayback`** | o ouvinte/núcleo no boot tem de ser `connectedDevice` puro; o `mediaPlayback` fica para quando o app abrir | separar os tipos |
| **`START_NOT_STICKY`** | o serviço não se recria sozinho depois de morto | não prometer "volta sozinho" |
| **Térmica/carga** | 2 h de servidor + tela apagada é leve; o carregador esquenta | medir a térmica (o `EspelhoEnergia` já lê) |

**A conclusão do segundo plano:** durante o culto o celular está no bolso ou
sobre a mesa. No bolso, em movimento, o Doze tende a não atuar; parado e sem
carregador, atua e derruba a rede (a medir, §14). O estado "minimizado, tela
apagada, WebView acordado" é o que o Modelo B atinge depois do toque; "sem
Activity, servindo" é o Modelo C. O celular na tomada é o jeito seguro nos dois.

---

## 11 · O navegador: o que ele faz bem e o que ele não faz

| item | o que esperar | observação |
|---|---|---|
| **duas janelas, dois monitores** | sim; a segunda em tela cheia | arrastar + F11; posicionamento automático só com contexto seguro (não no HTTP da LAN) |
| **som** | sim, pelo computador | autoplay com som exige gesto; o botão "Ativar esta tela" já é esse gesto |
| **vídeo** | H.264/AAC, VP9/Opus, AV1 | HEVC depende do SO/navegador; MKV não toca; **medir a lista da igreja** e avisar antes |
| **SSE + `fetch` streaming** | sim | é o que o `tela.js` já usa; `EventSource` não manda `Authorization` |
| **`crypto.randomUUID`** | **não** em HTTP | use `crypto.getRandomValues` ou token do servidor |
| **CSP `default-src 'self'`** | sim | nada de estilo embutido; folha servida, como nas telas |
| **duas abas em segundo plano** | o navegador estrangula aba oculta | mantenha as duas janelas visíveis (é o caso: uma em cada monitor) |
| **atualização** | o OTA já atualiza o bundle | o painel é servido do mesmo bundle; não há cliente desatualizado |
| **Windows/macOS/Linux** | qualquer navegador moderno | sem programa exclusivo; é o ponto do pedido |

**O que o navegador NÃO resolve:** codecs que o celular toca e ele não; um
`<video>` que o Chrome não busca (o `stage.js` já tem a recarga por URL nova);
e a diferença de relógio entre o painel e a tela — que o `tela.js` já corrige
pelo epoch dos pings.

---

## 12 · Segurança: o "tudo" é uma lista fechada

O pedido "tudo o que o app tem" assusta, e com razão: o app tem acervo,
configurações, compartilhamento, instalação de APK. A regra que segura isso:

| risco | como o desenho segura |
|---|---|
| o painel vira o app inteiro na LAN | o servidor nunca serve `web/controle/`; o painel é `web/mesa/`; o catálogo é a lista fechada |
| um id inventado executa algo | `ACOES_DA_MESA` no servidor; o que não está nela morre no 404 uniforme |
| um link vaza e qualquer um controla | **código de entrada** (4–6 dígitos) mostrado no celular, ou um **token de navegador confiável** (menos atrito, com revogação no app); token em `sessionStorage`, nunca na URL; **1 vaga de controle** separada das 3 de exibição |
| o acervo inteiro desce | o painel recebe nomes/ids/estado, não bytes; a mídia vai por `/m/<token>` |
| a sessão fica aberta | prazo de 6 h (o mesmo do `EspelhoPares`) + "derrubar" |
| o CSP quebra | a página do painel entra na regra: sem estilo embutido, folha servida |

**O código de entrada é a diferença entre o painel e o passador.** O passador
pode ficar sem código: são três ações de baixo poder, e o operador entrega o
link de propósito. O painel tem o poder do app; ele não pode ser "quem está na
LAN entra".

---

## 13 · Riscos, em tabela

| risco | gravidade | por quê | mitigação |
|---|---|---|---|
| **Doze sem carregador** | alta | a rede cai e o painel congela no meio do culto | celular na tomada (regra de operação) ou isenção de bateria |
| **WebView estrangulado** | alta | o cérebro é JS; minimizado, ele desacelera | `manterVisivel` no cérebro enquanto o painel estiver conectado |
| **swipe no Recentes (Modelo B)** | média | desliga a transmissão (decisão de projeto), mas o ouvinte segue de pé: o navegador chama de novo e o operador toca | o painel avisa quando a transmissão cair; onboarding "minimize, não feche" |
| **fabricante mata o serviço** | média-alta | Xiaomi/Huawei/Samsung | whitelist/autostart; medir no aparelho da igreja |
| **WebView no serviço (núcleo)** | alta | caminho não documentado; renderer, memória, ponte | spike no aparelho, com os testes do §14; se falhar, fica o toque |
| **dois cérebros (núcleo + Activity)** | alta | estado duplicado, comandos duplicados | o app do celular vira cliente do núcleo, ou o núcleo é o único cérebro |
| **codec que o Chrome não toca** | média | HEVC/MKV | pré-voo no app: avisar antes do culto; não transcodificar |
| **segurança da porta de controle** | alta | poder sobre o app inteiro | código + 1 vaga + lista fechada + 404 uniforme |
| **duas telas com a mesma mídia** | média | TV (Presentation) + navegador podem divergir | uma destinação visível por vez; o painel mostra qual está no ar |
| **Wi-Fi da igreja saturada** | média | a mídia vai por `/m/` para cada tela | 1 tela de computador + o painel; o teto de 3 já existe |
| **bateria/térmica em 2 h** | baixa-média | servidor + tela apagada é leve, mas o carregador esquenta | medir; o `EspelhoEnergia` já lê a térmica |
| **duas cópias da regra** | média | o painel pode reimplementar o que o `controle.js` já faz | o painel manda INTENÇÃO; o handler é o do registro (invariante 5) |

---

## 14 · O que medir antes de decidir (o piloto)

Nenhum número abaixo foi medido nesta sessão. Cada teste tem um critério de
passagem; o que falhar muda o desenho, não vira "detalhe".

| # | teste | como | passa se |
|---|---|---|---|
| 1 | **B de ponta a ponta** | celular no bolso, na rede da igreja; abrir o favorito; tocar em Abrir; usar o painel 2 h com o app minimizado | o ouvinte atende; o toque abre e minimiza o app; as ações chegam; a térmica não sobe de degrau |
| 2 | **Doze** | sem carregador, tela apagada, 40 min; pingar `/e` a cada 5 min | com carregador: nunca cai; sem: medir quando cai |
| 3 | **estrangulamento** | app minimizado, mandar "play" do painel; medir o atraso; repetir com `manterVisivel` | < 200 ms com o mecanismo ligado |
| 4 | **notificação** | Android 13/14: dispensar o cartão; ver o Task Manager; ver se o app republica | o serviço continua; o cartão não volta sozinho sem mudança de estado |
| 5 | **segunda tela** | Chrome/Edge, dois monitores, HTTP; tentar `window.open` + coordenadas; depois arrastar + F11 | ≤ 2 gestos após a primeira configuração |
| 6 | **codecs** | a lista real da igreja (mp4 H.264, webm VP9, HEVC, MKV) no Chrome/Edge | o app avisa antes do culto o que não toca |
| 7 | **vazão** | vídeo 1080p ~8 Mbps por `/m/` para o computador, 10 min, com o painel aberto | sem travar; medir o buffer |
| 8 | **fabricante** | o aparelho da igreja, 2 h minimizado | o serviço sobrevive; se não, whitelist documentada |
| 9 | **latência** | botão do painel → tela; 30 amostras | mediana < 150 ms na LAN |
| 10 | **núcleo: WebView no serviço** | um spike: criar o WebView no `SessionService`, carregar o bundle por `WebViewAssetLoader`, rodar o `controle.js`, abrir IndexedDB/OPFS, usar a ponte e o `EspelhoMidiaCanal`, 2 h, matar o renderer | carrega, executa, persiste, sobrevive ao renderer; sem Activity |
| 11 | **núcleo: cold start** | celular reiniciado; o navegador abre o painel; o serviço acorda o núcleo | o painel fica pronto sem toque no celular (se o teste 10 passar) |
| 12 | **ouvinte no boot e em Doze** | Android 15: um `connectedDevice` sobe no boot; depois, celular parado sobre a mesa, sem carregador, 30 min, chamar pelo navegador | o ouvinte sobe; medir se ele ainda atende em Doze |
| 13 | **trava de rede** | celular no Wi-Fi de casa e depois no da igreja e no hotspot | em casa não escuta; na igreja e no hotspot escuta |

---

## 15 · Recomendação, em fases

### P0 — o painel, o ouvinte e o toque (o Modelo B)

1. **O registro de ações** no lado web e o **painel** `web/mesa/` (paisagem,
   catálogo, atalhos de teclado, botão "Abrir a tela da congregação"). Prefixo
   próprio (nunca `web/controle/`), ramo `POST /r` `{"do":"mesa",…}` com
   `ACOES_DA_MESA`, vaga de controle separada, código de entrada.
2. **O ouvinte** `connectedDevice` no boot, com a trava de rede (§9.7), a rota
   "quero abrir" e a notificação "Abrir".
3. **O toque abre o app já com a transmissão ligada** e a Activity se
   minimiza sozinha: o operador não toca em "Ligar transmissão".
4. Oráculos: o par (registro × `ACOES_DA_MESA`), a cobertura, a página caber
   em 1280×720 e 1920×1080, sem estilo embutido; JUnit do bind e da trava.

Custo: 1 Release (receiver, serviço, rota, notificação, intent) + 1 lote web.

### P1 — o núcleo (o Modelo C), só depois do spike

O spike do §14 (WebView no serviço) decide. Se passar, o toque some; se não,
o B fica. É outro estudo, com o seu plano.

### P2 — o piloto na igreja

Os testes do §14 no aparelho, no computador e no projetor reais; o endereço
(reserva de DHCP ou gateway do hotspot); o `av.local` só se o IP incomodar.

### Não fazer

- Servir `web/controle/` à rede.
- O bundle + ponte falsa no navegador (desenho B do §5.3).
- Espelho de pixels.
- Transcodificar no celular.
- Ouvinte sem trava de rede.
- Servidor na internet (Modelo E) como atalho.
- Prometer "invisível".

---

## 16 · As decisões que precisam do operador

1. **O toque no celular (Modelo B) basta, ou o "sem tocar" (C) é requisito?**
   (Recomendo B primeiro; o C depende de um spike e de abrir mão da
   autorização no celular.)
2. **O ouvinte fica ligado em que redes?** (Recomendo só a da igreja e o
   ponto de acesso do celular; em casa, não.)
3. **Como o computador acha o celular?** (IP reservado ou gateway do hotspot,
   como favorito; `av.local` só se incomodar.)
4. **Sem Wi-Fi na igreja, o operador liga o ponto de acesso no celular?**
   (É um gesto que o computador não faz; a alternativa é ter Wi-Fi.)
5. **O painel começa com as ações principais e cresce, ou espera a cobertura
   total?** (Recomendo crescer.)
6. **Código de entrada sempre, ou o navegador "confiável" depois da primeira
   vez?** (Recomendo código; confiável como evolução, com revogação.)

---

## 17 · O que este estudo não é

- **Não é o 13.3.** O CSS de paisagem do app continua sendo o 13.3; o painel é
  uma superfície nova, que não substitui a rotação do app.
- **Não é o app para Windows.** Aquele projeto saiu em 2026-11-13; este é o
  pedaço que não dependia dele.
- **Não é uma promessa de invisibilidade.** O Android cobra um sinal; o
  estudo mostra qual é o mínimo.
- **Não é um pedido de código.** É a decisão, com o custo e os limites na
  mesa.
- **Não é o núcleo headless decidido.** É o caminho, com um spike antes.

---

## Fontes

**Código e docs do projeto**

- [`TELAO-POR-COMANDOS.md`](TELAO-POR-COMANDOS.md) — o contrato do servidor,
  o papel `tela`, o passador, a segurança, o Doze e a decisão de não servir
  `web/controle/`.
- [`NUCLEO-TECNICO.md`](NUCLEO-TECNICO.md) — o `KeepVisibleWebView`, o
  estrangulamento do Controle em segundo plano, a notificação.
- [`PEDIDOS-EM-ESPERA.md`](PEDIDOS-EM-ESPERA.md) — o 13.1 (controle do
  pregador) e o 13.3 (paisagem).
- `app/src/main/java/br/org/iasd/av/MainActivity.kt` — `moveTaskToBack`,
  `onDestroy`, "a transmissão não sobrevive ao fechamento", `setProjecaoLocal`.
- `app/src/main/java/br/org/iasd/av/SessionService.kt` — o serviço
  `mediaPlayback|connectedDevice`, o canal `IMPORTANCE_LOW`, a notificação.
- `app/src/main/java/br/org/iasd/av/EspelhoEnergia.kt` — wake lock, Wi-Fi
  lock, térmica.
- `app/src/main/AndroidManifest.xml` — `portrait`, as permissões de FGS, o
  `connectedDevice` e a nota do `CHANGE_WIFI_MULTICAST_STATE`.

**Plataforma**

- [Doze e App Standby](https://developer.android.com/training/monitoring-device-state/doze-standby)
  — rede suspensa e wake locks ignorados; o carregador sai do Doze.
- [Mudanças do Android 15](https://developer.android.com/about/versions/15/behavior-changes-15)
  — `dataSync` 6 h, `mediaProcessing` 6 h, boot sem `mediaPlayback`,
  `SYSTEM_ALERT_WINDOW` estreitado.
- [Restrições de start de FGS em segundo plano](https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start)
  — as isenções (boot, ação do usuário, isenção de bateria, companion device).
- [Como o usuário para um app com FGS](https://developer.android.com/develop/background-work/services/fgs/handle-user-stopping)
  — o Task Manager / "Active apps" e o `REASON_USER_REQUESTED`.
- [Mudanças do Android 13](https://developer.android.com/about/versions/13/behavior-changes-13)
  — a permissão de notificação e o Task Manager.
- [Window Management API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Window_Management_API)
  — experimental, contexto seguro, `getScreenDetails`, `requestFullscreen({screen})`.
