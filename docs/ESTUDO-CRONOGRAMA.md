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
