# Estudo: entregar o culto e nascer com o culto — compartilhar e modelos

**O que este arquivo é:** um ESTUDO, não um pedido de código. Os dois assuntos
são os lados da mesma moeda — **compartilhar** um cronograma e **ter modelos**
de cronograma —, e o desenho de um decide o do outro. A entrega é **decisão do
operador**; os pedidos originais estão em
[`PEDIDOS-EM-ESPERA.md`](PEDIDOS-EM-ESPERA.md) (Pacote 16 e estudo 13.1).

---

## 1 · O que já existe, medido

| peça | o que é hoje | o que ela não faz |
|---|---|---|
| **o Cronograma** | uma LISTA ORDENADA de itens: mídias (com id) e **momentos** (itens de roteiro `kind: 'cue'`, com nome e hora) | não é exportável como unidade |
| **vários cronogramas** | um ATIVO (o que está no ar) mais os GUARDADOS, numa chave só (`cronogramas`), com troca transacional | guardar não é entregar |
| **o Itinerário** | os momentos e a faixa de opções; o telão mostra a hora de cada momento | idem |
| **`.avpkg`** ([`PACOTE.md`](recursos/PACOTE.md)) | leva o ACERVO inteiro; *importar só acrescenta* | gigabytes, não atravessa o WhatsApp, e não leva a organização |
| **a página do passador** | precedente vivo: endereço público nosso que redireciona para o IP da rede local | é de CONTROLE, não de entrega |
| **o servidor das telas** | pareia aparelhos na mesma Wi-Fi, sem internet ([`TELAO-POR-COMANDOS.md`](TELAO-POR-COMANDOS.md)) | só exibe; não recebe arquivo |

**A conta que decide tudo:** a mídia é pesada (GB) e a organização é leve (KB).
Um culto de 60 minutos são ~15 itens, e a organização deles — ordem, nomes,
horas — cabe em **poucos kilobytes**. O que falta é o formato e o caminho.

---

## 2 · O lado A — compartilhar

### 2.1 O que precisa viajar

| campo | tamanho | por quê |
|---|---|---|
| a ordem dos itens | bytes | é o culto |
| o nome e a hora de cada momento | bytes | o itinerário é isso |
| a IDENTIDADE de cada mídia | bytes | YouTube e LouvorJA já são re-baixáveis por id; a mídia PRÓPRIA não é |
| uma impressão digital da mídia própria | bytes | nome + tamanho + duração: é o que permite dizer "falta esta" |

**O que NÃO viaja nunca:** medição de uso e qualquer coisa de alcance
([`MEDICAO-DE-ALCANCE.md`](MEDICAO-DE-ALCANCE.md)); e nada entra no aparelho do
destinatário sem ele ver e CONFIRMAR antes.

### 2.2 As três rotas

| rota | como chega | custo | resolve | não resolve |
|---|---|---|---|---|
| **1 · arquivo pequeno** (`.avro`, KB) | WhatsApp, como documento; o app abre pelo seletor que já existe | **baixo** — só web se o seletor aceitar a extensão; Kotlin se precisar de filtro | ordem, momentos, ids re-baixáveis; mídia própria vira LISTA DE FALTANTES | a mídia própria não atravessa sozinha |
| **2 · link do app** (App Links em `audiovisualiasd.com.br`) | um toque abre o app com o roteiro embutido no endereço | **médio-alto** — site + Digital Asset Links + `intent-filter` ⇒ **Release** | o "toque e abre" que o operador descreveu; é o único que dispensa explicar "abra o arquivo" | a mídia própria também não viaja |
| **3 · os dois aparelhos na mesma Wi-Fi** | a rota de 1 + uma "sala" temporária no servidor das telas; o destinatário puxa o que falta | **médio** — página nova no servidor ⇒ Shell | **a mídia própria**, que é o caso difícil | exige os dois aparelhos juntos e online |

**Recomendação:** **1 agora, 3 quando doer.** A rota 1 entrega o culto montado
com tudo o que é re-baixável — que já é a maior parte do acervo — e a lista de
faltantes diz ao organizador o que mandar como mídia solta (o WhatsApp já
transporta vídeo e foto). A rota 2 é a mais bonita e a mais cara: só depois de
o formato do roteiro estar provado em uso.

### 2.3 A ordem de chegada no destinatário

1. ele toca no arquivo (ou no link) → o app abre a **prévia do que vai entrar**
2. a prévia lista: as mídias re-baixáveis, as que ele JÁ TEM e as que faltam
3. ele confirma → o app cria um cronograma GUARDADO (nunca mexe no ativo) e
   dispara os downloads que conhece
4. o que falta entra numa lista de pendências com o nome do arquivo e o tamanho
5. *importar só acrescenta*: nada do que ele já tem é substituído

---

## 3 · O lado B — modelos

### 3.1 O que é um modelo

**Um modelo é um cronograma com as mídias trocadas por vagas.** A mesma lista
ordenada, os mesmos momentos com hora, e em cada lugar onde haveria uma mídia
uma **vaga** com: o que se espera ali (hino, vídeo, foto, texto, leitura), a
duração alvo e, quando fizer sentido, uma dica de busca ("hino 1", "louvor do
tema", "vídeo do programa").

Isso não é metáfora — é o mesmo objeto. **Um modelo é o cronograma sem mídia; e
um cronograma entregue é um modelo com as mídias.** Por isso o arquivo da rota 1
carrega os dois: o mesmo `.avro` serve de "culto pronto" e de "modelo".

### 3.2 Os três modelos (a liturgia)

Referência: a proposta de liturgia aprovada pela Igreja em 2015 recomenda que o
culto de adoração **não passe de 1h15**, que o louvor converse com o tema do
sermão e que Escola Sabatina e Culto Divino tenham **continuidade** — a
transição marcada por um hino ([notícia oficial](https://noticias.adventistas.org/pt/aprovada-proposta-de-liturgia-de-cultos-da-igreja-adventista/)).
Os modelos abaixo são a **nossa** sugestão de partida, editável item a item.

**Sábado de manhã** — Escola Sabatina 9h + Culto Divino 11h (90 min no total):

| quando | item | o sonoplasta precisa de |
|---|---|---|
| 9h00 | Prelúdio / música de acolhida | 1 música instrumental |
| 9h05 | Boas-vindas e hino inicial da Escola Sabatina | letra do hino |
| 9h12 | Oração inicial | — |
| 9h15 | Recapitulação da lição (por unidades) | imagem do tema da lição |
| 9h40 | Missões e ofertório da Escola Sabatina | vídeo/foto do projeto |
| 9h50 | Avisos e encerramento | 1 arte |
| 10h55 | **Transição** (hino de adoração) | letra do hino |
| 11h00 | Entrada da Bíblia + hino inicial do Culto Divino | letra do hino |
| 11h07 | Oração inicial | — |
| 11h10 | Leitura bíblica | o texto no telão |
| 11h15 | Hino de louvor | letra do hino |
| 11h20 | Ofertório (música especial) | 1 música |
| 11h28 | **Sermão** | o tema/slides, a Bíblia |
| 12h00 | Hino final e oração final | letra do hino |
| 12h10 | Bênção e pós-lúdio | 1 música |

**Domingo à noite** — culto evangelístico (75 min):

| quando | item | o sonoplasta precisa de |
|---|---|---|
| 19h00 | Música ambiente / acolhida | 1 música |
| 19h05 | Hino de abertura | letra |
| 19h10 | Oração inicial | — |
| 19h13 | Avisos e testemunhos | artes e fotos |
| 19h23 | Música especial | 1 música |
| 19h30 | **Pregação evangelística** | slides, Bíblia |
| 20h00 | Apelo e oração | 1 música de fundo |
| 20h10 | Encerramento e avisos finais | 1 arte |

**Quarta à noite** — culto de oração e estudo (60 min):

| quando | item | o sonoplasta precisa de |
|---|---|---|
| 19h30 | Música de acolhida | 1 música |
| 19h33 | Hino e oração de abertura | letra |
| 19h38 | **Estudo da lição / palestra** | slides, Bíblia |
| 20h05 | Pedidos e intercessão | imagem do pedido |
| 20h18 | Hino final e bênção | letra |

### 3.3 Como o modelo entra no app

- a folha "Cronogramas" ganha **"Novo a partir de um modelo"**: Em branco ·
  Sábado de manhã · Domingo à noite · Quarta à noite · **Meus modelos**
- aplicar **cria um cronograma GUARDADO** — nunca toca no que está no ar
- cada vaga mostra o que espera ali; o operador toca na vaga e escolhe da
  Biblioteca, ou arrasta uma mídia para cima dela
- **"Salvar como modelo"** em qualquer cronograma: as mídias viram vagas com o
  nome delas como dica
- o modelo é chave nova (`modelos`) ao lado de `cronogramas`, com a mesma
  forma — e os três de fábrica não ocupam espaço nenhum se não forem usados

---

## 4 · As quatro decisões (sem elas, nada se coda)

1. **Servidor: sim ou não?** A recomendação é **não**: a rota 1 e os modelos
   vivem sem nenhum. O único caso que pede servidor é a mídia própria, e ele se
   resolve com os dois aparelhos na mesma Wi-Fi (rota 3).
2. **Qual rota de entrega primeiro?** (recomendo a 1: o arquivo pequeno)
3. **O modelo nasce vazio ou com sugestões da semana?** (a semana já existe no
   acervo — hinos e vídeos da série; sugerir é mais um passo de leitura)
4. **Quem pode editar um modelo recebido?** (recomendo: quem recebe pode editar
   a cópia dele; o modelo original nunca é alterado por importação)

---

## 5 · O que sai primeiro, e o que cada etapa custa

| etapa | o que entrega | toca | risco |
|---|---|---|---|
| **1 · os três modelos** | a chave `modelos`, a folha de novo cronograma e "salvar como modelo" | **só web** | baixo — não toca no ativo nem no telão |
| **2 · o `.avro` (exportar e abrir)** | o roteiro de KB, a prévia do que entra e a lista de faltantes | web; Kotlin **se** o seletor precisar de filtro | médio — é o primeiro caminho de ENTRADA de arquivo de organização |
| **3 · o link do app** | o "toque e abre" | site + manifesto ⇒ **Release** | médio — o Digital Asset Links é uma vez só, e erra-se em silêncio |
| **4 · a sala na Wi-Fi** | a mídia própria entre dois aparelhos | servidor das telas ⇒ Shell | alto — porta nova de SUBIDA, com a decisão de segurança do 13.1 |

**A etapa 1 é a que devolve mais por menos**, e ela já vale sozinha: um modelo
de sábado pela manhã poupa ao sonoplasta montar os quinze itens do zero todo
sábado. A etapa 2 é o que o operador descreveu como "um simples link"; a 1 é o
que faz o culto nascer pronto. Juntas, são a mesma moeda.

---

# Parte II — o plano decidido (2026-11-17)

**Decisão do operador:** a rota é o **LINK**, feita do jeito mais completo e
bonito — com os **modelos** dentro —, e o destinatário tem de poder **VER o
itinerário antes de importar**, por uma imagem/PDF que acompanha o link no
WhatsApp. As respostas das quatro decisões da Parte I:

| pergunta | resposta |
|---|---|
| servidor | **não** |
| rota | **link** (o `.avro` fica como o arquivo que o link carrega) |
| modelo vazio ou com sugestão | nasce **vazio**, com as vagas nomeadas; sugestão é passo 2 |
| quem edita o recebido | quem recebe edita a CÓPIA; o original nunca muda |

**A chave que ele deu, e que simplifica tudo:** a maior parte da mídia **já é
nativa da biblioteca** (hinário, Provai e Vede, Informativo, as séries). Então o
roteiro carrega essas como **referência** (id + nome) e só a mídia
ESPECIALIZADA viaja como "vem junto" (nome + tamanho). O link fica pequeno de
verdade, e a prévia pode dizer, item por item: **"já na sua biblioteca"** ou
**"vem junto"**.

## 1 · O formato do roteiro (o mesmo para culto e para modelo)

```jsonc
{ "av": 1, "tipo": "culto" | "modelo", "nome": "Culto de sábado",
  "igreja": "IASD Central", "quando": "2026-11-21T11:00",
  "itens": [
    { "m": "momento", "nome": "Escola Sabatina", "hora": "09:00" },
    { "m": "midia", "origem": "biblioteca", "id": "hino-140", "nome": "Hino 140" },
    { "m": "midia", "origem": "youtube", "id": "abc123", "nome": "Provai e Vede" },
    { "m": "vaga", "espera": "video", "nome": "Vídeo do programa", "min": 6 },
    { "m": "midia", "origem": "propria", "nome": "batismo.mp4", "bytes": 84000000 } ] }
```

**O link:** `https://audiovisualiasd.com.br/crono#r=<base64url do JSON
comprimido>`. O roteiro vai no **fragmento** (`#`), que **não chega ao
servidor** — a privacidade do culto não depende de ninguém. Sem servidor, sem
banco, sem id de sessão: o link É o dado.

## 2 · A página (a cara do culto antes de importar)

Mesma família visual de `site/passador/`: uma coluna, o cartão do culto no topo
(nome, igreja, data, duração total), a lista dos itens com a hora, o selo de
cada mídia (**já na biblioteca** / **vem junto** / **falta**), e o botão
"Abrir no app". O que o WhatsApp mostra é o cartão OG do site; o que o
destinatário vê antes de tocar é a **imagem** (abaixo).

```
┌──────────────────────────────┐   ┌──────────────────────────────┐
│  CRONOGRAMA · IASD Central   │   │  o CARD (PNG 1080×1350)      │
│  Sábado, 21/11 · 9h–12h10    │   │  — gerado pelo APP e enviado │
│ ──────────────────────────── │   │    junto com o link          │
│ 09:00  Escola Sabatina       │   │  — o itinerário inteiro,     │
│ 09:05  Hino 140   ✔ na bibl. │   │    legível no WhatsApp       │
│ 09:15  Recapitulação         │   │  — a mesma cara da página    │
│ 11:28  Sermão                │   └──────────────────────────────┘
│ 11:15  Vídeo  ⇩ vem junto    │
│ 12:00  Hino final ✔          │
│ ┌──────────┐ ┌────────────┐  │
│ │Abrir no  │ │Baixar o    │  │
│ │app       │ │roteiro     │  │
│ └──────────┘ └────────────┘  │
└──────────────────────────────┘
```

## 3 · Os quatro lotes, nesta ordem

| lote | o que entrega | toca | o que se vê no fim |
|---|---|---|---|
| **L1 · a página** | `site/cronograma/` lendo o fragmento e desenhando o cartão | **só site** | um link já MOSTRA o culto, mesmo sem app |
| **L2 · o gerador e o card** | "Compartilhar o culto" na folha dos Cronogramas: gera o link, o PNG do card e a mensagem | **só web** | o operador manda no WhatsApp: imagem + link |
| **L3 · o app abre o link** | Digital Asset Links + `intent-filter` + o parser: prévia, "já na biblioteca" × "vem junto", confirmação e importação guardada | site + manifesto ⇒ **Release** | o toque abre o app e importa |
| **L4 · os modelos** | a chave `modelos`, os três de fábrica, "Novo a partir de um modelo" e "Salvar como modelo" — e o link pode carregar `tipo: "modelo"` | **só web** | o culto nasce pronto |

## 3.1 · O pacote COMPLETO — uma interação, e de onde vêm os bytes

**Decisão do operador (17/11, em cima desta Parte II): arquivo solto NÃO.** O
que ele quer é *"um link, uma interação, cronograma completo"*. Isso muda o
desenho, e a resposta honesta tem duas metades:

**O LINK sempre funciona para o ROTEIRO.** Ele vai no fragmento, mora no
próprio endereço e não depende de ninguém estar online: a página abre, mostra
o culto inteiro e o app importa a organização, os momentos e tudo o que é
re-baixável (biblioteca, YouTube). Isso é o que o L1/L2 entregam.

**A MÍDIA ESPECIALIZADA só tem dois caminhos para viajar — e nenhum é mágica:**

| caminho | como o link a entrega | preço |
|---|---|---|
| **A · o organizador é o servidor** | o MESMO link aponta para uma "sala" no aparelho dele (o servidor das telas já faz isso na Wi-Fi); a página baixa os arquivos de lá ao tocar em "Importar o culto" — um toque, o pacote inteiro | **os dois precisam estar online na mesma rede no momento** (Wi-Fi da igreja ou o ponto de acesso do celular). Zero custo recorrente |
| **B · um servidor nosso** | o link funciona sempre: a mídia fica guardada e o destinatário baixa quando quiser, dias depois | **custo recorrente** (hospedagem + armazenamento + segurança), e o site hoje é estático — é infraestrutura nova |

**Recomendação: A, com o B declarado como a saída para o caso assíncrono.** A
igreja já tem o encontro — o organizador e o sonoplasta estão no mesmo lugar
no sábado de manhã. O caminho A usa o que já existe (o pareamento das telas da
rede e o `.avpkg`, que já leva o acervo inteiro e *importar só acrescenta*) e
não custa nada por mês. O B só se paga se o culto for montado num dia e aberto
noutro lugar.

**A interação continua UMA:** abrir o link → ver o culto → **"Importar o
culto"** → o app busca o que falta no aparelho do organizador e mostra o
progresso. Se ele não estiver online, a página diz o que falta, com nome e
tamanho, e oferece "pedir ao organizador" — nunca um arquivo solto no meio do
WhatsApp.

**O que isso muda nos lotes:** o **L3** cresce — o app abre o link E é capaz de
puxar a mídia da sala do organizador (é o mesmo servidor das telas, com uma
rota de LEITURA de arquivo). Fica assim:

| lote | entrega | toca |
|---|---|---|
| **L3a · o app abre o link** | prévia, confirmação e importação da organização e das mídias re-baixáveis | site + manifesto ⇒ **Release** |
| **L3b · a sala do organizador** | a mesma prévia puxa a mídia especializada do aparelho dele, numa interação | shell (o servidor das telas) ⇒ **Release** |

## 3.2 · O organizador como fonte, mas PELA INTERNET — sim, e é assim que fica

**Pergunta do operador (17/11):** *"podemos fazer pela internet ao invés de
limitarmos ao wifi ou mesma rede? É possível?"* — **É possível, e a limitação
não é o app: é a rede.** Um aparelho no 4G/5G quase nunca é alcançável por
outro aparelho; quem resolve isso é uma peça de infraestrutura, e há quatro
degraus:

| degrau | como funciona | o que custa | quando falha |
|---|---|---|---|
| **1 · IPv6 público** | o celular tem endereço público e o app serve a sala nele; o link carrega o endereço | **nada** | operadora sem IPv6, firewall de entrada, endereço que muda — falha em SILÊNCIO |
| **2 · P2P (WebRTC) + sinalização** | os dois aparelhos negociam por um serviço mínimo (WebSocket) e os BYTES vão direto | hospedagem de um serviço de KB; relay quando a rede não deixa | rede simétrica (comum no 4G) exige **relay**, e aí os bytes passam por um servidor |
| **3 · uma "sala" em storage** | o organizador SOBE a mídia especializada; o link aponta para ela; o destinatário baixa quando quiser | free tier cobre um culto por semana com folga (ex.: R2 — 10 GB e saída gratuita) | precisa de conta e de um token curto: infraestrutura nossa |
| **4 · Wi-Fi** | o que já existe | nada | os dois precisam estar juntos |

**A recomendação, sem enfeite:** o **degrau 4 sai primeiro** (custo zero, e é o
caso do sábado), e o **degrau 3 é o que compra o "de qualquer lugar"** — é o
único em que o link funciona sozinho, dias depois, sem ninguém online. O 1 é
sorte, não plano. O 2 é o mais elegante e o mais caro de manter (relay, cotas,
depuração de NAT), e não vale antes de o 4 e o 3 estarem em uso.

**O desenho que não muda com o degrau escolhido:** o app tenta, nesta ordem —
**a sala publicada** (se o organizador publicou) → **o aparelho dele na rede**
(se estiver) → **o que é re-baixável** (biblioteca e YouTube) — e a página diz,
item por item, de onde cada mídia veio. A interação é a mesma, uma.

**LGPD, uma linha:** no degrau 3 a mídia da igreja passa a morar num provedor
de nuvem; o organizador precisa saber e consentir com isso na hora de
publicar, e a sala se APAGA sozinha depois de N dias (o prazo é decisão dele).

## 4 · O que a primeira página precisa provar (L1)

1. um link sem roteiro válido **não quebra**: mostra a página de erro do site
2. o cartão mostra hora, nome e o selo de cada mídia, sem cortar
3. a página funciona **sem JavaScript de terceiros** e sem pedir nada a nenhum
  servidor (o roteiro vem no fragmento)
4. o botão "Baixar o roteiro" entrega um `.avro` que o app vai saber abrir
5. a leitura é **só leitura**: a página nunca importa nada sozinha

---

# Parte III — o pacote (decisão do operador, 17/11)

**A pergunta foi:** *"e se abandonarmos o link e trabalharmos próximo do
formato que já usamos para a exportação, onde se cria um arquivo com tudo
junto?"* — **é a rota mais sólida das três**, e a que mais aproveita o que já
existe. O link e a sala (Partes I e II) ficam como registro do estudo; esta
parte os SUBSTITUI.

## 1 · Por que ela ganha

| o problema do link | como o pacote resolve |
|---|---|
| a mídia especializada precisa de uma fonte online | ela VIAJA dentro do arquivo |
| servidor, conta, token, custo mensal | nenhum |
| quem está online na hora | ninguém precisa estar |
| o link pode expirar ou o endereço mudar | o arquivo é do destinatário, para sempre |
| depender de App Links e Release | a exportação e a importação já são **JavaScript** (`controle/pacote.js`) ⇒ **só web / OTA** |

**O que já existe e é reusado inteiro:** o `.avpkg` é criado no lado web, leva
o acervo **e as preferências**, e a importação **só acrescenta**, com dedupe
por conteúdo ([`PACOTE.md`](recursos/PACOTE.md)). O pacote do culto é esse
mesmo arquivo com **duas coisas a mais na raiz**.

## 2 · O formato — `.avpkg` v2, sem inventar outro

```
culto-2026-11-21.avpkg   (ZIP)
├── manifesto.json    { "av": 2, "tipo": "culto"|"modelo", "versao": "1.14.x" }
├── roteiro.json      a organização: momentos, horas, mídias por id, vagas
├── capa.png          o card do culto (1080×1350) — a prévia que o app mostra
└── midias/           SÓ a mídia especializada (foto, vídeo, PPTX), com o
                      nome que o roteiro referencia
```

- **a mídia da biblioteca não entra**: hinário, Provai e Vede, Informativo, as
  séries — o roteiro leva o **id** e o destinatário já tem; o pacote fica do
  tamanho da mídia ESPECIALIZADA
- **compatível para trás**: um app antigo ignora `roteiro.json` e `capa.png` e
  importa o acervo como sempre; um app novo, diante de um pacote sem roteiro,
  faz exatamente o que faz hoje
- **determinístico**: a única data que entra é a do próprio culto, e o
  `manifesto.json` não carrega relógio — o mesmo culto exportado duas vezes dá
  o mesmo arquivo (é o que permite dedupe por hash entre aparelhos)
- **nome do arquivo**: `culto-AAAA-MM-DD.avpkg` — é o que aparece na conversa

## 3 · A entrega: WhatsApp, como documento

O WhatsApp transporta documento até 2 GB; um culto com a mídia especializada
fica na casa das dezenas de MB. **Uma interação nos dois lados:** o operador
toca em "Exportar o culto" e escolhe o contato; o destinatário toca no arquivo
e o app abre a **prévia** (a capa, os itens, o que já tem e o que vem junto) e
confirma. *Importar só acrescenta* — a mesma regra de sempre.

## 4 · A prévia antes de importar — o único ponto em que o pacote perde

O arquivo não tem miniatura na conversa (o WhatsApp mostra o ícone de
documento). Duas respostas, nesta ordem:

1. **a prévia no app** (já resolve o essencial): o toque abre a capa e a lista
   ANTES de importar, com o botão de confirmar. É uma interação, e nada entra
   sem o "sim" de quem recebe.
2. **a capa na conversa** (refinamento, se ele quiser): o app manda o
   `capa.png` junto, como imagem — dois arquivos, um toque cada. Ou o pacote
   vira **PDF com anexos**: o WhatsApp desenha a página 1 (a capa) como
   miniatura, e o PDF carrega o `.avpkg` embutido. Custa um escritor de PDF com
   anexos no web — fica para depois de o pacote estar em uso.

## 5 · Os lotes (todos **só web**, sem Release)

| lote | entrega | prova |
|---|---|---|
| **P1 · exportar o culto** | "Exportar o culto" na folha dos Cronogramas: monta o `.avpkg` v2 com roteiro + capa + mídia especializada | oráculo: o arquivo tem as quatro partes, e a mídia da biblioteca NÃO entra |
| **P2 · importar com prévia** | a folha de prévia (capa, itens, "já tenho"/"vem junto") e a confirmação; importação guardada | oráculo: importa, não substitui, e um pacote sem roteiro se comporta como hoje |
| **P3 · os modelos** | a chave `modelos`, os três de fábrica, "Novo a partir de um modelo" e o `tipo: "modelo"` no mesmo pacote | oráculo: o modelo gera um cronograma guardado e não toca no ativo |
| **P4 · a capa na conversa** | (fase 2) o `capa.png` junto, ou o PDF com anexos | — |

**A ordem de valor:** P3 (o culto nasce pronto) e P1 (o culto viaja) são as que
mudam o sábado; P2 fecha o ciclo com o "sim" do destinatário; P4 é polimento.

## 6 · O envelope: miniatura na conversa e porta de entrada

**O que o operador apontou (17/11):** *"o nosso `.avpkg` não tem uma miniatura
que faça ele ser discernido, também não é uma porta de entrada — o usuário tem
de abrir o app e depois reprocurar o arquivo"*. São duas propriedades
diferentes, e elas puxam para lados opostos:

| propriedade | o que ela exige | dá para ter com o pacote hoje? |
|---|---|---|
| **miniatura na conversa** | o arquivo tem de ser IMAGEM — o WhatsApp desenha miniatura de imagem e de vídeo; documento (PDF, PPTX, ZIP) sai com **ícone genérico + nome** | não |
| **tocar e cair no app** | o app tem de se declarar DONO daquele tipo — `intent-filter` no manifesto | **não hoje; e é a peça que falta** |
| **levar a mídia e ser lido pelo app** | ZIP | sim, é o que o `.avpkg` já é |

**A porta de entrada é a peça mais barata e a mais valiosa.** O app já recebe
"compartilhar para" (vídeo, link, arquivo), mas não se declara dono do
`.avpkg`: por isso o toque no arquivo cai no gerenciador de arquivos e o
caminho vira "abrir o app → importar → procurar". Um `intent-filter` de
`ACTION_VIEW` para a extensão (com o MIME próprio) faz o toque abrir o app na
**prévia** — um toque. É Kotlin ⇒ **Release**, e é pequeno.

**A miniatura não se resolve com contêiner.** Testado o que os mensageiros
fazem: PDF e PPTX também saem com ícone no WhatsApp (o PDF mostra a página 1
em alguns aparelhos, não em todos). Quem quiser imagem na conversa precisa de
uma IMAGEM — e aí há duas saídas honestas:

- **A · o card como primeira bolha** (a que recomendo): o app manda o
  `capa.png` e, na sequência, o `.avpkg`. O destinatário **vê o culto antes de
  tocar** (é o que o operador pediu desde o começo), e a importação continua
  sendo o toque no pacote. Não é "mídia solta": a capa é a prévia, e a mídia
  continua toda dentro do pacote.
- **B · o PDF-envelope** (fase 2, se ele quiser um único documento "de gente"):
  um PDF com a página 1 = o card e o `.avpkg` **embutido** como anexo (PDF
  Portfolio), mais o mesmo ZIP acrescentado depois do `%%EOF` como atalho de
  leitura. Abre em qualquer leitor, é organizado — mas o leitor de PDF do
  Android não é o nosso app, então a importação ainda precisa do passo do
  `.avpkg`. Custa um escritor de PDF com anexos no web.

**A combinação recomendada:** o `.avpkg` v2 (o payload) + o `intent-filter`
(A: o toque abre o app) + o card como primeira bolha. É o mínimo que entrega
as três coisas, e nenhuma delas inventa formato novo.

**E o nome do arquivo importa:** `Culto 21-11 Sábado.avpkg` (o culto e a data)
é o que faz o arquivo ser discernido na conversa enquanto a miniatura não vem.

## 7 · A imagem e o pacote na MESMA ação de compartilhar

**Pergunta do operador (17/11):** *"conseguimos compartilhar a imagem e o
arquivo na mesma mensagem/compartilhamento? Se sim vai servir, pois é
requisitar ficar indo e voltando no app para enviar as duas."*

**Sim, no Android: uma ação, dois arquivos.** O `ACTION_SEND_MULTIPLE` com
`type="*/*"` e uma lista de URIs entrega os dois ao WhatsApp de uma vez — o
operador toca em "Compartilhar o culto" **uma vez** e escolhe o contato; nada
de voltar ao app. O que NÃO se promete é o desenho da conversa: o WhatsApp
costuma mostrar **duas bolhas** (a imagem e o documento) na mesma conversa, e
isso é o desejável — a imagem primeiro, o arquivo logo abaixo.

**O truque que parece resolver tudo e NÃO resolve:** um único PNG com o ZIP
acrescentado depois do fim da imagem (a conversa mostraria a capa como
miniatura de verdade, e o app acharia o pacote pelo marcador). Duas razões para
descartar: **o WhatsApp RECOMPRIME foto**, e a recompressão destrói os bytes
anexados — o pacote sumiria em silêncio, que é o pior defeito possível; e a
galeria abriria a imagem, não o app.

**A medição que fecha a decisão (no aparelho do operador):**
1. `ACTION_SEND_MULTIPLE` misto (PNG + `.avpkg`) chega ao WhatsApp com os dois?
2. vira duas bolhas na mesma conversa, ou ele recusa um deles?
3. o `.avpkg` chega com o MESMO tamanho (o WhatsApp não mexe em documento)?

Até essa medição, o desenho é: **uma ação com os dois arquivos**, e o
`intent-filter` para o toque no pacote cair no app.
