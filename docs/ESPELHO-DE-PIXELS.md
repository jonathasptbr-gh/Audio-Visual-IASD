# Espelho de pixels — ARQUIVO (recurso removido na v5.187 / APK v1.86)

**Nada aqui descreve código que existe.** O espelho de pixels (VirtualDisplay →
MediaCodec H.264 → fMP4 no cliente → MediaSource) foi substituído pelo **telão
por comandos**; a especificação viva é
[`TELAO-POR-COMANDOS.md`](TELAO-POR-COMANDOS.md). Saíram com ele
`EspelhoCodec.kt`, `EspelhoDisplay.kt`, `EspelhoAudio.kt`,
`MirrorPresentation.kt`, `espelho/cliente.js` e `espelho/fmp4.js`.

**Sobrou só o que ainda é citado por código vivo ou por outro doc:**

| seção | por que ficou |
|---|---|
| §2.3 — onde o socket liga | invariante de rede, intacta no transporte novo (bind ao IPv4 da Wi-Fi, nunca `0.0.0.0`) |
| §2.4 — TLS autoassinado | citada por `EspelhoCert.kt`, `NativeBridge.kt` e `shared/native.js` |
| §10-A — a auditoria de defeitos | é o argumento documentado da substituição, citado por `TELAO-POR-COMANDOS.md` §187 |

O resto — resumo executivo, arquivo-por-arquivo, protocolo do fio, ordem de
implementação, riscos e a lista "o que não fazer" — descrevia arquivos apagados
e saiu na limpeza de documentação. Está no histórico do git.

---

### 2.3 A rede: onde o socket liga, e por que isso é a linha mais importante da seção

`ServerSocket(8787)` liga em **0.0.0.0** — toda interface do aparelho, inclusive `rmnet`. E o
enunciado deste projeto diz que a igreja pode não ter internet, cujo desfecho normal é o celular em
dados móveis. Operadoras brasileiras entregam **IPv6 globalmente roteável** ao aparelho, sem NAT e
sem firewall implícito. O resultado seria **o culto em H.264 numa porta alcançável do mundo,
protegida por um código curto** — e ninguém no prédio teria como perceber.

**A regra, e ela não é negociável:**

1. O socket é ligado ao **endereço IPv4 da rede ativa**, explicitamente
   (`ServerSocket().bind(InetSocketAddress(ipv4DaWifi, porta), backlog)`), **nunca** pelo construtor
   de porta e **nunca** em `::`. Os endereços IPv6 temporários do Android rotacionam, e um bind em
   `::` reintroduz o problema por outra porta.
2. **Recusa ligar** quando `NetworkCapabilities` não tiver `TRANSPORT_WIFI`, ou tiver
   `TRANSPORT_CELLULAR` ou `TRANSPORT_VPN` — com a frase no Registro, nunca em silêncio.
3. `registerNetworkCallback` → `onLost` / `onCapabilitiesChanged` que perca o Wi-Fi **desliga o
   servidor**. Um endereço que sumiu não pode continuar escutando.

Isto reinstala, com mais rigor, a regra do plano original ("sem Wi-Fi, não desenhar o
endereço nem o QR"), que a versão intermediária tinha perdido.

### 2.4 TLS — o degrau, com as três condições que são do operador

Certificado público para IP privado **não existe e nunca vai existir**: a CA/Browser Forum proibiu
*Reserved IP Addresses* e *Internal Names* em 2015 e mandou revogar os remanescentes em 2016
**(doc — [CA/B Forum](https://cabforum.org/working-groups/server/internal-names/))**. A Let's Encrypt
passou a emitir para IP, **só IP público, só HTTP-01/TLS-ALPN-01**. Autoassinado com CA instalada no
cliente está **descartado**: desde o Android 7 apps com `targetSdk ≥ 24` não confiam em CA de
usuário, o Chrome do Android exige Certificate Transparency (`ERR_CERTIFICATE_TRANSPARENCY_REQUIRED`
numa CA própria), e o navegador de uma smart TV não tem UI para instalar CA. Trocaria uma limitação
silenciosa e previsível por **uma tela vermelha em cada culto, em cada aparelho**.

O que **funciona** é o modelo Plex/Tailscale: **um NOME que o operador controla, com registro `A`
apontando para o IP privado, e certificado emitido por DNS-01** **(prática — `*.plex.direct`,
`*.ts.net`)**. Do lado Kotlin custa ~40 linhas e **zero dependência**: `KeyStore.getInstance("PKCS12")`
→ `KeyManagerFactory` → `SSLContext.getInstance("TLS")`, e daí em diante os `InputStream`/`OutputStream`
são idênticos. O custo de CPU é irrelevante: 3 Mbps = 0,375 MB/s, e AES-GCM com as extensões ARMv8
roda em ~1,2 GB/s por núcleo — **~0,03% de um núcleo**.

**As três condições, e as três são do operador, não do código:**

1. um subdomínio dedicado com **wildcard por DNS-01** (`*.lan.igreja.org.br`), para trocar de IP sem
   reemitir;
2. **uma entrada estática de DNS no roteador da igreja** (`address=/telao.igreja.org.br/192.168.0.42`
   no dnsmasq). Sem ela o nome só resolve com internet, e a proteção contra DNS rebinding — ligada
   por padrão em pfSense e Fritz!Box, e o motivo nº 1 de suporte do próprio Plex — o quebra em
   silêncio;
3. renovação automática. O teto de validade já é **200 dias** e cai para 100 em 2027 e 47 em 2029
   **(doc — [Ballot SC-081v3](https://cabforum.org/2025/04/11/ballot-sc081v3-introduce-schedule-of-reducing-validity-and-data-reuse-periods/))**.

**A chave privada nunca vai no APK** (as Releases são públicas no GitHub) e **nunca vai no backup**
(mesma disciplina de `res/xml/backup_rules.xml` e `data_extraction_rules.xml`, que já existem para o
bundle OTA). O `.p12` chega por importação manual (`pickDoc`, que já existe), **com a senha digitada
à mão pelo operador** — senha no mesmo canal do arquivo anula o `sha256` e o TLS, coisa que o
próprio `WebUpdater.kt:558` já admite por escrito **(código)**.

**E a "placa de rua" NÃO leva credencial no APK.** A ideia de o celular publicar sozinho o IP no
site do operador exige um segredo compartilhado, e o segredo estaria num binário público — qualquer
pessoa reescreveria `igreja.org.br/telao` e a página oficial da igreja passaria a apontar para onde
o atacante quisesse, com o domínio da própria igreja. As duas formas aceitas são: o operador digita
o endereço no site à mão (uma vez por IP novo, e o IP é fixo por reserva de DHCP), ou uma credencial
**por aparelho**, digitada em Configurações — a mesma disciplina da senha do `.p12`. E a página fica
**atrás de login**, não "atrás de login *ou* com valor que expira": expirar não esconde nada de quem
olha durante o culto, que é a janela em que o valor é útil.


---

## 10-A. A AUDITORIA DE 5.154 — o que estava quebrado, e por quê

> Escrito depois de uma revisão linha a linha do recurso inteiro, com o relato do operador de que
> "tecnicamente conecta, mas está estruturalmente quebrado". **Os seis achados abaixo estão
> corrigidos.** Eles ficam aqui porque quatro deles são de uma mesma família — *código que o
> compilador aprova, que a especificação descreve, e que nunca roda* — e é essa família que este
> documento precisa ensinar a procurar.

| # | Onde | O que era | Por que ninguém viu |
|---|---|---|---|
| **A1** | `espelho/cliente.js`, `vigiarAudio()` | Um `const ms` no fim da função **sombreava a `MediaSource` do módulo**, lida na primeira linha da mesma função. Zona morta temporal ⇒ `ReferenceError` a cada 500 ms, **em toda tela que tivesse ligado o som** | `node --check` aprova. E a guarda de cima começa por `!sbA`, então o erro só existia depois do gesto do visitante — o sintoma chegou como *"travando e dessincronizando"*, nunca como exceção |
| **A2** | idem, `recomecar()` | O recomeço não esvaziava o **buffer do fio**. `recomecar` é chamado de dentro de `processar()`, e ao voltar aquele laço seguia muxando os bytes da conexão MORTA para dentro de uma `fila` recém-limpa — ou seja, na frente do segmento de inicialização da conexão seguinte. O primeiro `appendBuffer` da `MediaSource` nova era um fragmento sem init | O sintoma é o laço de *"o decodificador recusou os dados"* de três em três segundos, que a v5.147 tratou como **cadência** (a escada de reconexão) sem chegar à causa |
| **A3** | idem, `soltarAudio()` | `removeSourceBuffer` numa faixa com operação em voo **lança**, e a exceção era engolida. A faixa de som ficava na `MediaSource` sem receber mais nada — e a MSE só toca com dado em todas as faixas ⇒ **a imagem congelava**, exatamente no caminho que existe para salvá-la | Só acontece quando a faixa é solta com um append em curso, isto é, sob carga |
| **A4** | idem, prazo do `csd` de áudio | O prazo absoluto da v5.153 nunca era rearmado. **Vencido uma vez, vencido para sempre**: toda conexão seguinte abria a `MediaSource` só com imagem, o `csd` de áudio chegava "tarde", e as três remontagens do teto se gastavam sem nenhuma delas ter chegado a esperar ⇒ tela muda pelo resto da sessão | O teto de remontagens é a defesa contra um laço, e ele mascarava a causa |
| **A5** | `EspelhoServidor.kt` | O quadro de **despedida** (`0x30 {"m":"adeus"}`) estava implementado nas DUAS pontas e **não era emitido por ninguém**. Desligar o espelho era, do lado do navegador, indistinguível de uma queda de rede: até três telas batendo numa porta fechada a cada 8 s pelo resto do culto | `avisar()` existia, com KDoc; faltava o chamador. Código morto simétrico não aparece em nenhuma leitura de um lado só |
| **A6** | `EspelhoServidor.kt` | Duas janelas de corrida na **ordem do fio**: o `csd` de vídeo era enfileirado *depois* de a tela entrar no fan-out, e a torneira de áudio era aberta *antes* de o `csd` de áudio entrar na fila. Nos dois casos o cliente recebia um quadro antes dos parâmetros que o explicam, e o descartava | Autocurável em segundos — e "em segundos" num telão parado quer dizer até o próximo IDR |

### 10-A.1 — o que a PRIMEIRA rodada em aparelho depois da correção mostrou (5.155)

O Registro do S24 Ultra, com o espelho no ar e uma tela recebendo, trouxe duas linhas que só
existem porque a v5.154 devolveu o canal de relato. As duas viraram correção:

| # | A linha | O que ela quer dizer |
|---|---|---|
| **A7** | `som: ok (vídeo à frente do som em 500 ms)` | **A borda ao vivo estava sendo lida da faixa errada.** A perseguição usava o fim do buffer de VÍDEO, mantendo o cursor entre 0,35 s e 0,85 s atrás dele — e a ponta rápida desse intervalo fica **150 ms à frente do fim do som**. A MSE só toca com dado em TODAS as faixas, então o `<video>` engasgava toda vez que a perseguição chegava lá: micro-travamentos **com o buffer de vídeo cheio**, sem um único erro. Os 500 ms não são desvio de sincronia (os carimbos são absolutos e do mesmo relógio) — são o caminho do som (worklet → blocos de 40 ms → `postMessage` → fila → `MediaCodec` AAC) produzindo meio segundo atrás do vídeo. A borda ao vivo de um fluxo de N faixas é o **mínimo** das bordas, e agora é isso que `bordaViva()` devolve. O custo é a imagem atrasar pelo atraso do som; é o preço certo, porque meio segundo a mais é invisível e um engasgo não é. |
| **A8** | `diz: "som: ok (vdeo  frente do som em 500 ms)  fim: ns abortamos"` | **O diagnóstico chegava mutilado.** `EspelhoPares.sanear` deixa passar só `[\x20-\x7E]` — invariante 9, com JUnit, e ela está certa: um `\n` vindo da rede injetaria linhas falsas no artefato que este projeto manda copiar e repassar. Só que ela **apaga** o que não passa, e as frases do cliente são em português: sumiram os acentos, as aspas angulares e o separador. O conserto é do lado que ESCREVE, nunca do que saneia — a tela segue em português com acento, e o que viaja é a transliteração (`semAcento`, mais os delimitadores trocados para `[`/`\|`). |

A7 tem oráculo: a regra é aritmética, então ela mora numa função pura exposta em `__espelho` e o
`espelho-cliente.test.mjs` a afirma com duas faixas de mentira — provar isso com uma faixa de som
de verdade exigiria um AAC que o Chromium do CI não tem. A8 tem o par negativo: o teste exige que
**nenhum** `alive` carregue byte fora de `[\x20-\x7E]`, isto é, que o saneamento do Kotlin não
tenha o que apagar.

**E o que a mesma rodada CONFIRMOU**, para não se perder: `readback: OK — o vídeo aparece`
(`#F934FF` medido onde se esperava magenta), `flags=4 · privada: SIM`, viewport 961,5 px CSS contra
o alvo de 960, `c2.qti.avc.encoder` com 16 instâncias, `atraso relativo 0 ms`, `0 descarte(s)` e
`24 blocos de PCM/s`. O R1 da §1.2 está respondido em produção: **a camada de vídeo entra na
composição de um `VirtualDisplay` privado neste aparelho.**

### 10-A.2 — o Registro deixa de ser meia resposta, e o modo IMAGEM sai (5.156)

**O que o Registro não respondia.** A rodada anterior fechou dois defeitos usando exatamente uma
linha do relato da tela (`som: ok (vídeo à frente do som em 500 ms)`), e isso expôs a forma do
buraco: **o servidor enxerga bytes escritos; quem sabe se a imagem ANDA é a tela** — e o único canal
dela era uma frase de 110 caracteres, espremida no `aviso` porque o corpo inteiro do `POST /r` tinha
de caber nos 256 B do parser.

O teto do `/r` passou a ser próprio (`TETO_CORPO_RETORNO`, 4 KiB), e a assimetria é o ponto: o
`POST /par` é **anônimo** e continua em 256 B — é isso que impede um desconhecido de nos fazer
alocar. O `/r` só existe depois de o operador ter aprovado aquela tela. Com ele cabem as medidas:

| O que passou a viajar | A pergunta que ele responde, e que nada antes respondia |
|---|---|
| `vfim`/`afim` — folga do cursor até o fim de cada faixa | **negativo é o cursor fora do buffer**, isto é, a MSE sem dado: a tela congela sem erro. É o defeito da v5.155, e este número o teria mostrado no primeiro minuto |
| `dq`/`tq` — quadros descartados pelo decodificador | "este aparelho não dá conta" × "a rede está ruim". Rede ruim atrasa; ela não descarta quadro já decodificado |
| `rs` — `readyState` do `<video>` | congelado com `rs` alto é decodificador; com `rs` baixo é fonte |
| `fila`, `cota`, `reb`, `rr` | os quatro tetos internos do cliente. Batido qualquer um, ele desiste de algo **em silêncio** |
| `cod`, `vid`, `tela`, `err` | o codec que o navegador aceitou, o tamanho que ele desenha, e o `MediaError` do elemento — a frase do demuxer que ninguém leria, porque ninguém abre console numa TV |

E o que só o **servidor** sabia e não publicava: fila por tela e seu teto, `esperandoIdr` (a tela
está PRETA agora, por construção), há quanto tempo aquela conexão existe, quadros enviados,
`conexoesTotais`, o freio de IDR em três números (**pedidos / atendidos / engolidos** — um pedido
engolido é tela preta até o IDR espontâneo, e o freio trabalhava em silêncio), as recusas por motivo
(`host` é tentativa de **DNS rebinding** contra o aparelho; `malformada` em quantidade é um scanner),
e a **banda que o enlace declara** — que responde antes do culto a pergunta que sustenta o recurso:
*cabem 3 Mbps × 3 telas neste AP?*

Mais três fatos do lado nativo: a **janela do espelho perguntada em vez de deduzida** (o §7.5
inferia "retângulo preto" pelo bitrate cruzado com a cena, e a inferência erra nos dois sentidos), as
**mortes de renderer** (a recuperação é automática e silenciosa, e por isso sumia do diagnóstico), o
**perfil/nível que o encoder escolheu** (*"esta TV não decodifica o fluxo"* × *"não decodifica ESTE
perfil"* são a mesma tela preta) e a **memória do processo** — que é a CAUSA de que
`ERROR_RECLAIMED` e a morte do renderer são consequência. O anel do diário passou a ser mostrado
inteiro: ele guarda 60 linhas e a tela imprimia 12, jogando fora justamente o que veio ANTES da
queda.

**A guarda que isto exigiu, e ela é a regra de sempre:** o bundle chega por OTA e o APK não. Num
shell anterior o `/r` ainda tem teto de 256 B e devolve **413** — o canal de relato morreria no
commit que existe para ampliá-lo. O cliente vê o 413 uma vez, desiste das medidas pelo resto da
sessão e reenvia o relato curto. Degrada, não quebra.

**E o modo IMAGEM saiu.** Ele era o degrau de baixo (JPEG a ~10 fps, sem `MediaSource`), e o que o
derrubou não foi desempenho: **ele não tem áudio e não tem como ter** — o som do espelho é uma
segunda `SourceBuffer` da mesma `MediaSource` (§3.9), e um `<canvas>` não é `HTMLMediaElement`. Um
telão de igreja mudo não é um degrau, é outro produto. Com ele saíram a segunda Surface, o
`ImageReader`, a `HandlerThread` que comprimia JPEG de 720p na CPU do aparelho que está projetando,
e um segundo caminho em toda decisão do `EspelhoDisplay` e do cliente. O byte `0x20` fica
**aposentado e não reciclado**: um número de protocolo reusado é um cliente antigo decodificando a
coisa errada, em silêncio.

**A porta de entrada mudou de lugar.** O botão de cast sempre significou "pôr isto noutra tela", e
ele abria direto o espelhamento do fabricante enquanto o espelho na rede vivia numa linha de
Configurações que só quem já sabia dele iria procurar. São dois caminhos técnicos para **uma**
decisão do operador. Agora o cast abre uma folha com os dois, com a diferença dita (*a tela inteira
do celular* × *só o telão, para navegadores*), e "Mostrar numa tela da rede" **liga o espelho e abre
o leitor de QR num toque** — a ordem entre as duas coisas existe por causa de como o recurso é
construído, não por causa de quem o usa.

**A regra que sai daí, e ela vale para o repositório inteiro:** um `let`/`const` dentro de uma
função que repete um nome do módulo é a mesma família de defeito do `setInteger` numa chave `long`
(§3.3, C1), do `bytes` esquecido no `bgProgress` e do `slideLabel` no `nowPlaying` — **falha sem
exceção, sem log e sem sintoma no lugar da causa**. O oráculo é `tools/sombra.test.mjs`: Node puro,
sem `continue-on-error`, e ele varre a base web inteira.

E a segunda regra: **teste que exercita só o caminho feliz não é rede de segurança**. O
`espelho-cliente.test.mjs` cobria o percurso do PIN, o do QR e o modo imagem, e passava verde com
A1, A2, A3 e A5 no lugar. Ele ganhou o caso da despedida; A1 é pego pelo oráculo de sombra.

### 10-A.3 — o relato deixa de ser uma FOTOGRAFIA, e o batimento cede a vez (5.157)

O primeiro Registro trazido do culto depois da §10-A.2 mostrou uma tela **saudável**: folga de
741 ms (dentro da banda de `ALVO_S ± TOL_S`), `rate` em 100%, fila vazia, `rs` 4. E o relato do
operador, no mesmo culto, foi *"trava a cada 7 segundos, e trava mais quando eu mexo"*.

Os dois são verdade ao mesmo tempo, e essa é a leitura: **as vinte medidas da §10-A.2 são um
instantâneo do milissegundo em que o relato saiu**. Um travamento de dois segundos não deixa rastro
nenhum numa amostra tirada depois — as bordas se recompuseram, `rate` voltou a 1, a fila escoou.
Quem manda o relato, por construção, não está travando naquele instante.

**P2 — cinco números que ACUMULAM.** `pq` é o maior intervalo entre quadros que o compositor de fato
apresentou (`requestVideoFrameCallback`, que é a definição exata de "congelou" — o `currentTime`
mente nos dois sentidos: anda com o elemento decodificando sem apresentar, e para durante um seek
que ninguém percebeu); `nq` conta quantas dessas paradas passaram de 1 s; `pc` é o cursor parado,
amostrado no compasso de 500 ms, que é o que sobra num navegador sem `rVFC`; `pv`/`pa` são a **menor
folga já vista** em cada faixa — o que antecede o congelamento, e que o valor instantâneo esconde.

Duas decisões que parecem detalhe e não são:

- **Eles não zeram no envio.** O relato sai a cada 10 s e a cada troca de frase; zerar ali faria o
  pior caso depender da cadência do relato, e um travamento inteiro caberia dentro da janela de
  alguém. Zeram só numa descontinuidade **nossa**: o salto de recuperação (`SALTO_S`) e a
  reconexão — que já têm número próprio e deixam rastro. Contá-las como travamento faria o número
  que existe para achar a parada **silenciosa** passar a medir a barulhenta.
- **A corrente de `rVFC` tem GERAÇÃO**, pela mesma razão da época das Promises da ponte: um callback
  pendente não é cancelável quando não chegam quadros — que é justamente o caso do congelamento —,
  então `parar()` seguido de `comecar()` deixaria duas correntes contando o mesmo intervalo.

`pq` vai `-1` sem `rVFC`: ausência de medida e medida zero são leituras opostas.

**P3 — o batimento cede a vez ao conteúdo.** O batimento de 8 Hz (§3.3) nasceu **incondicional**, e
num vídeo de verdade ele passou a competir: oito batidas por segundo em **fase aleatória** contra
trinta quadros por segundo, cada uma forçando uma recomposição fora do ritmo do `<video>`. O encoder
recebe quadros em intervalos irregulares, o carimbo dos fragmentos herda o jitter, e do outro lado
o cliente o mede como quadro descartado — os **7%** que o Registro mostrou.

A pergunta certa não é "está tocando?" (um vídeo pausado mostra quadro congelado e **precisa** do
batimento; um item de áudio com wallpaper também) — é *"alguém já pintou um quadro há pouco?"*. É
`rVFC` de novo, no documento do telão, e ele se corrige sozinho: no instante em que o conteúdo para,
o batimento volta na batida seguinte. Sem `rVFC`, a aproximação honesta (tocando, com imagem e com
dado), que erra só para o lado de bater a mais.

**O que isto NÃO é.** Não é a correção do travamento — é o que o transforma em número. A hipótese
principal continua sendo que, numa cena parada de letra, o único produtor de quadros é um
`setInterval` na **main thread do Blink**, compartilhada com o Controle e com o telão: a interação
do operador a disputa, o batimento atrasa, e a folga de 741 ms do cliente acaba. `ALVO_S` de 0,6 s
para 1,5 s é a resposta óbvia e está **retida de propósito** — aplicá-la agora mascararia a medida
que acabou de nascer. Primeiro o número, depois a folga.

*(A hipótese acima estava errada — ver §10-A.4. O batimento contribuía, mas a causa era a poda.)*

### 10-A.4 — a poda apagava o PRESENTE, e os "7 segundos" eram o relógio da recuperação (5.158)

O log da v5.157 fechou o caso ao trazer três números incompatíveis no mesmo instantâneo:
`readyState 2` (**sem dado adiante**) ao lado de `vfim +3893 ms` (**3,9 s bufferizados adiante**),
com `vel 108%` numa tela que não andava. Num buffer contíguo isso é impossível — logo o buffer não
era contíguo, ou a folga não media o que dizia medir. Era o segundo caso, e ele levou ao primeiro.

**A causa: `SourceBuffer.remove()` não apaga só o que se pede.** O algoritmo de remoção de quadros
codificados da MSE, depois de remover o intervalo, **continua apagando até o próximo ponto de acesso
aleatório** — senão sobrariam quadros delta sem a chave de que dependem. E se não houver ponto de
acesso aleatório depois do fim pedido, o `remove end timestamp` vira a **duração**, isto é: apaga
até o fim de tudo.

Agora a aritmética do espelho:

- `JANELA_S` era **5 s**, e `I_FRAME_S` do `EspelhoCodec` também é 5 — mas em **contagem de
  quadros**: o framework converte `KEY_I_FRAME_INTERVAL` por `KEY_FRAME_RATE`, declarado 30. São
  **150 quadros** entre chaves.
- Numa cena de letra o produtor entrega ~8 quadros por segundo. 150 quadros = **~19 segundos de
  parede** entre um IDR e o próximo.
- `podar()` chamava `remove(0, currentTime - 5)` com o próximo IDR até 19 s à frente. A MSE apagava
  de `currentTime - 5` **até esse IDR** — isto é, **o presente e os próximos catorze segundos**.
- O cursor ficava fora de qualquer bloco: a MSE não toca, `currentTime` não anda, **não há erro e
  não há evento**. E como o cursor não anda, ele nunca sai sozinho.
- A única saída era `if (atraso > SALTO_S)` com `SALTO_S = 8`: a borda ao vivo precisava abrir oito
  segundos sobre um cursor parado. Partindo da folga de regime (0,35–0,85 s), isso leva **7,15 a
  7,65 s**.

**Os "trava a cada 7 segundos" nunca foram o defeito: eram o RELÓGIO DA RECUPERAÇÃO**, uma constante
do cliente. E o ciclo fecha: recuperado o cursor, o buffer volta a acumular passado, em ~5 s a poda
roda de novo, e tudo se repete. Também explica por que **vídeo real trava menos** — a 30 fps, 150
quadros são 5 s de parede, praticamente a janela, e a remoção quase não passa do pedido.

Quatro correções, e cada uma fecha um degrau diferente:

- **A poda corta EM CIMA DE UMA CHAVE que o cliente viu passar.** Ele não precisa supor onde elas
  estão: `q.chave` chega no fio (§5.3), e um anel de 64 carimbos basta. `limite` passa a ser a maior
  chave ≤ o ponto pedido, **menos 50 ms** — mirando o carimbo exato, qualquer arredondamento para
  cima faria a MSE pular para a chave SEGUINTE, e voltaríamos a apagar o presente, só que mais
  raramente, que é o pior tipo de defeito. Sem chave conhecida, a poda **desiste** (`pod` conta) e a
  janela cresce por mais um giro: memória é barata, projeção não é.
- **`JANELA_S` 5 → 12 s** e **`GUARDA_S` 2 → 6 s**, para a janela caber um GOP com folga mesmo antes
  de a primeira chave nova aparecer.
- **O ENCALHE é detectado no instante.** Cursor fora de qualquer bloco é condição **observável**, não
  algo que precise de oito segundos de prova: `indiceNoCursor` < 0 em qualquer faixa dispara o salto
  na mesma volta do compasso. O teto de tela congelada cai de ~7 s para meio segundo. O destino é o
  começo do **último bloco das duas faixas** (pular para `fim − ALVO_S` cairia noutro buraco), e três
  encalhes seguidos viram `recomecar` — insistir seria piscar a projeção a cada meio segundo.
  Com isso `SALTO_S` volta a ser o que ele diz ser (a aba que ficou congelada) e cabe em **4 s**.
- **`ALVO_S` 0,6 → 1,5 s**, agora sim: ele era o orçamento inteiro da tela contra um soluço do
  celular, e um bloqueio de 600 ms na main thread do Blink o esgotava. `TOL_S` **não** acompanha —
  alargá-la para 0,5 poria o cursor a 100 ms de uma borda que o próprio encoder deixa 150 ms sem
  andar, reabrindo o engasgo da v5.155. Junto, uma linha defensiva: `playbackRate = 1` quando
  `readyState < 3`, porque acelerar um elemento parado não alcança nada e foi assim que o log chegou
  (`vel 108%` sobre uma tela congelada).

**E a medida da v5.157 estava quebrada — isto vem antes de tudo.** `pq` ("maior parada de imagem")
só era escrito **dentro** do callback de `requestVideoFrameCallback`: durante o congelamento nada é
comparado, e o intervalo só nasceria no quadro que ENCERRA a parada. Só que `zerarPiores()` escreve
`ultimoQuadroMs = Date.now()` e é chamado **pelo salto que encerra a parada** — todo travamento
resolvido por salto contribuía **zero**. A primeira linha que o operador lia dizia "0,3 s" sobre uma
tela que ele viu congelar por segundos. Agora o intervalo **em aberto** entra na medida a cada
compasso e antes de cada zeragem (`dobrarAberto`, sob guarda de `vfcArmado` — sem ela, uma TV sem
`rVFC` trocaria o sentinela honesto `-1` por "tempo desde que liguei").

E `pv`/`pa` "nunca ficaram negativas" era **tautologia**: medidas contra `end(length − 1)`, elas não
podem ser negativas enquanto existir qualquer bloco à frente. `folgaDoCursor` passa a medir até o fim
**do bloco em que o cursor está**, e devolve negativo num buraco — que é o que o KDoc de
`medidasDe` sempre prometeu e a geometria antiga nunca produzia.

Sete campos novos no relato, e cada um decide alguma coisa: `nr`/`na` (quantos blocos tem cada
faixa — `1` é fome, acima de `1` é buraco), `tt`/`tn` (o total da sessão, que sobrevive aos saltos e
responde "trava a cada 7 segundos" com um número), `sal`/`enc` (as duas recuperações, contadas à
parte porque têm causas diferentes) e `pod`.

**Divisão de entrega:** a correção inteira é `cliente.js`, isto é, **OTA** — e `vfim`/`afim` já são
campos conhecidos, então a folga honesta chega sozinha. Os sete campos novos passam pela lista fixa
de `EspelhoServidor.medidasDe` e **exigem o APK**; num shell anterior são descartados em silêncio e
as linhas simplesmente não são desenhadas.

### 10-A.5 — o GOP era maior que a janela, e pelo MESMO motivo de sempre (5.159)

A v5.158 funcionou: o travamento de sete segundos virou **2 paradas, 2,3 s no total** em quatro
minutos de culto. O que o log seguinte mostrou foi o que sobrou, e vale por si:

| medido | leitura |
|---|---|
| `65 poda(s) sem quadro-chave` | a poda **nunca** conseguiu cortar |
| `janela 25.6 s` | e por isso a janela viva cresceu ao dobro do pedido |
| `0 chave(s)` numa janela de 10 s | não havia quadro-chave para cortar |
| `10 encalhe(s) do cursor` em 1 min | o socorro novo disparando dez vezes por minuto |
| `115/841 (13.7%) perdido(s)` | contra 1,6% na v5.157 |

**`KEY_I_FRAME_INTERVAL` não é segundos de parede — é contagem de QUADROS.** O framework o
multiplica por `KEY_FRAME_RATE` (declarado 30, ver a armadilha 9 do `EspelhoCodec.kt`), então o
valor 5 são **150 quadros**; a ~9 quadros por segundo de uma cena parada, isso são **~16 s** entre
IDRs espontâneos. É exatamente a mesma família do defeito da §10-A.4 (`JANELA_S` contra um GOP em
frames) e do `setInteger` numa chave `long` da §3.3: **a unidade não é a que o nome sugere, o
compilador aprova, e nada falha — o número só fica errado.**

Com o GOP em 16 s e a janela em 12, a poda corretamente **desiste** (é a guarda que a §10-A.4
introduziu) e a janela cresce sem parar. Três correções:

- **`I_FRAME_S` 5 → 2** (`EspelhoCodec.kt`, **APK**). São 60 quadros: ~7,5 s numa cena parada a
  8 fps e **2,0 s num vídeo a 30 fps** — os dois abaixo da janela do cliente, e o segundo é o GOP
  padrão de transmissão ao vivo, o que deixa o fluxo pronto para o caminho de live/podcast sem
  outra mudança. Continua inteiro: nada de `setFloat`, que alguns codecs de fabricante tratam mal.
  O custo dobra o piso de banda de uma cena parada (~300 kbps por tela), e **não** o multiplica por
  cinco — a estimativa antiga do KDoc tratava o valor como segundos, que era o erro.
- **A poda faminta PEDE uma chave** (`cliente.js`, **OTA**). O caminho já existe e já é usado a cada
  conexão (`POST /r {do:'key'}`); o cliente não precisa esperar o encoder. Freio próprio e longo
  (8 s), porque um IDR de 720p custa dezenas de kB. Sozinho ele já limita a janela — a correção do
  encoder é a estrutural, esta é a que chega sem instalar nada.
- **O encalhe exige o cursor PARADO** (`cliente.js`, **OTA**). Fora do buffer **andando** é o
  Chromium pulando um buraco pequeno sozinho (o *gap jumping* dele) e não precisa de socorro:
  socorrê-lo escreve `currentTime`, o que estala, esvazia o decodificador e conta quadro
  descartado. Foi o que levou os 1,6% a 13,7%. Um giro inteiro sem andar (`ENCALHE_MS`, 400 ms,
  abaixo do compasso de propósito) mantém o teto de tela congelada em ~1 s.

### 10-A.6 — o atraso, que só virou a queixa depois que o travamento saiu (5.160)

Terceiro log de aparelho: `1 parada(s) na sessao, 1.5 s no total` em quatro minutos, **zero
encalhes**, `2 chave(s) = 139 kbps` (o GOP voltou a caber na janela), quadros perdidos de 13,7% para
8,6%. O operador: *"está começando a ficar bom… uma ressalva ainda é um delay entre a ação no
controle e na exibição, que pode chegar a 2 s ou mais."*

**Esses 2 s estão no próprio log, e são nossos por decisão:** `folga do cursor: video +2092 ms`. A
conta é `ALVO_S` (1,5 s) + o desvio A/V (~500 ms), porque `bordaViva` é o **mínimo** das duas bordas
(§10-A.1) e o som sai atrás da imagem. A linha `folga do cursor: video` **é** o atraso da projeção,
e é assim que ele se mede daqui em diante — não no dedo.

A folga é seguro contra soluço do produtor, e seguro custa atraso. **Um valor fixo obriga a escolher
entre travar e demorar.** Um valor que encolhe não obriga:

- desce **um degrau de 100 ms a cada 8 s sem incidente**, de 1,5 s até um piso de **0,7 s**;
- volta ao **teto de uma vez** em qualquer incidente — encalhe, salto, ou parada contada;
- só encolhe com `readyState ≥ 3` e já posicionado, para o transitório de partida não contar como
  trecho limpo.

A assimetria é a mesma da suavização da ETA do download (cai rápido, sobe devagar), com o sinal
invertido porque aqui o número que dói é o outro: **subir devagar depois de um travamento seria
travar de novo** enquanto a folga se reconstrói. O efeito é que cada tela converge para o menor
atraso que **ela** aguenta — uma rede ruim recebe sozinha a folga que uma rede boa não paga —, e
~64 s de culto limpo levam a projeção de ~2,0 s para ~1,2 s de atraso.

**Nenhum campo novo:** `vfim` já é o número, e não gastar um campo aqui é o que mantém este lote em
**OTA puro**, sem Release. Junto veio uma correção de leitura: `pod` passou a contar podas
**seguidas** (zera no primeiro corte bem-sucedido) — acumulado, ele marcava 46 numa sessão saudável
só pelo transitório de partida, que a ~2 podas por segundo enche em ~17 s. Um número grande que não
queria dizer nada é pior que nenhum.

### 10-A.7 — o transitório de partida estava impedindo a convergência (5.161)

Quarto log. O produtor mudou de regime (cena de vídeo real: `29.6 fps`, `intervalo 33 ms`,
`5 chave(s)` em 10 s — o GOP de 2 s do `I_FRAME_S` novo, exatamente como projetado), zero encalhes,
`pod` em zero. E a adaptação **funcionando**: `menor folga ja vista: som +1362 ms` é igual à folga
atual, isto é, o alvo estava descendo naquele instante.

Mas em 43 s de sessão sem defeito nenhum apareceram `1 parada(s), 1.5 s` e `2 salto(s)`. Os dois são
o **transitório de partida**, e ambos disparam `recuarAlvo()` — ou seja, o começo de cada sessão
estava sistematicamente impedindo a convergência que a §10-A.6 existe para dar.

- **`posicionar()` entrava no ponto mais ANTIGO que as duas faixas tinham.** Quando a conexão já
  trouxe alguns segundos, isso são alguns segundos de atraso a recuperar, e o `borda()` seguinte via
  `atraso > SALTO_S` e saltava. A entrada passa a ser `max(inicioComum, min(bordaViva − alvo,
  bordaViva − 50 ms))`: a tela nasce **na latência certa**, em vez de nascer atrasada e correr a
  108% até alcançar. O `Math.max` mantém a regra do som (§ o KDoc de `posicionar`) intacta — com
  pouca coisa bufferizada o alvo cai antes do início comum e o comportamento é o de sempre.
- **A espera pelo PRIMEIRO quadro era contada como travamento.** Entre `comecar()` e o primeiro
  quadro apresentado correm a conexão, o segmento de inicialização e o primeiro fragmento —
  segundos, legitimamente. Parada é intervalo **entre** quadros; sem o primeiro não há intervalo.

É o mesmo tema de todo este apêndice: **a medida errada custa mais que a ausência dela.** Aqui ela
não só mentia no Registro — ela realimentava o controlador e segurava o atraso no teto.

Um número para vigiar, sem ação por enquanto: `ritmo 4107 kbps` contra `alvo 3000 kbps`. É o VBR
fazendo o que VBR faz numa cena de movimento, e o enlace medido comporta; com **três** telas isso
seriam ~12 Mbps no AP da igreja, e é aí que o número deixa de ser acadêmico.

### 10-A.8 — o que estraga não é o atraso, é a DESSINCRONIA (5.162)

O operador, depois de quatro rodadas de números: *"talvez o que mais estrague a sensação não é o
delay em si, mas a visualização dessíncrona com o preview, e a sensação dos botões não terem
funcionado."*

A leitura está certa, e reformula o problema. O atraso absoluto de ~1 s numa projeção é invisível —
**ninguém interage com um telão**. O que dói são duas coisas derivadas dele:

1. **A preview muda no ato e a tela da rede muda um segundo depois.** O operador compara duas coisas
   que nunca vão bater, e o que ele sente não é "está atrasado" e sim "o botão não funcionou" —
   porque a resposta que ele conhece já aconteceu e a que importa ainda não.
2. **O botão fica esse segundo sem responder.** E aí ele toca de novo, e o comando vai duas vezes.

**A preview atrasa junto.** `cmd(obj)` já era o funil único: `AVDB.sendCommand(obj)` na primeira
linha, e todo o resto da função é a metade da preview. Basta a metade da preview entrar numa **fila**
que escoa `previewAtrasoMs` depois — e a preview vira um espelho **fiel e deslocado no tempo**:
letra, fades, cortina, carregamento, tudo desliza junto, porque tudo já passava por ali.

Foi por isso que a função virou duas, em vez de o **relógio** da preview ser mexido. Deslocar
`currentTime` obrigaria a desfazer o deslocamento em cada consumidor — barra, navegação de estrofe,
`MediaSession` — e cada um deles é uma chance de errar o sinal. Aqui o que atrasa é a **ordem**, e
ela é uma só.

Quatro decisões que não são detalhe:

- **Fila, e não um `setTimeout` por comando.** O atraso muda de valor conforme as telas entram e
  saem, e dois `setTimeout` com atrasos diferentes podem **inverter a ordem** — um `play` chegando
  antes do `load` a que ele pertence. A fila preserva a ordem por construção, e drena inteira quando
  o atraso cai a zero.
- **O atraso é MEDIDO.** Cada tela relata a própria folga do cursor (`vivo.vfim`), que é literalmente
  o quanto ela está atrás da projeção; o valor é a **mediana** das conectadas, limitada a
  [300, 2500] ms, com 1200 ms de piso quando nenhuma relatou ainda. Fora da folha, uma enquete de
  fundo de 10 s mantém isso vivo — a folga do cliente encolhe de 100 em 100 ms a cada 8 s, então não
  há por que perguntar mais rápido.
- **Só sem telão conectado.** É a mesma frase do §1: *sem telão, as telas da rede SÃO o que a
  congregação vê*. Com uma TV ligada ela é a projeção, chega no ato, e atrasar a preview seria
  dessincronizá-la do que importa.
- **`authoritativeTime()` soma o atraso de volta.** Ela decide qual estrofe vem a seguir, e com o
  tempo deslocado "próxima estrofe", tocado logo depois de a estrofe virar na tela, devolveria a
  estrofe que **já está no ar** — isto é, o botão pareceria não funcionar, que é exatamente o
  defeito que este lote existe para curar. A barra de posição segue a mesma regra (ela existe para
  ser arrastada, e um seek precisa ser absoluto); a letra desenhada dentro da preview segue o tempo
  **deslocado**, porque ela tem de casar com a imagem que está ali.

E a fila tem um teto (`FILA_PREVIEW_MAX`): o telão recebe pelo `sendCommand` aconteça o que
acontecer, mas uma preview congelada deixaria o operador voando cego com a projeção funcionando. Aba
estrangulada em segundo plano é o caso real — os timers atrasam e os comandos empilham. Perder o
deslocamento é um arranhão; perder a preview, não.

**O eco.** Um anel curto em accent no botão tocado, que **não troca o conteúdo**. O `.btn-pulso` que
o app já tinha esconde o filho para pôr um ✓ no lugar — certo para salvar e copiar, cujo resultado
não aparece em canto nenhum, e errado para o transporte: o ▶ virando ✓ e voltando esconde justamente
o ícone que carrega o estado. Ele é **delegado por seletor**, e não um `eco()` em cada handler: os
handlers do transporte são vários (toque curto × toque longo, cortina, estrofe, playlist) e um
esquecido seria um botão mudo sem ninguém notar. Botão desabilitado não emite `click`, então o eco
nunca promete uma ação que não aconteceu. `tools/smoke.mjs` trava as duas metades — que ele apareça,
e que o ícone continue visível.

### 10-A.9 — o descarte do servidor matava o SOM (5.163)

Log com o som interrompido mais de uma vez e a tela terminando **muda**: `12 descarte(s)`,
`3 remontagem(ns) de som`, `som: PEDIDO e a faixa não nasceu`, `codec: avc1.64001F` (sem `mp4a`), e
`diz: "faixa solta: o som parou de chegar"`.

**A causa é uma linha em `entregar()`.** Quando a fila de uma tela enche — o cliente não escoa, a
rede engasgou — o servidor fazia `t.fila.clear()`. Isso varre o **áudio** junto com o vídeo. E o
cliente tem um vigia que solta a faixa de som depois de `AUDIO_MUDO_MS` (3 s) sem um quadro AAC,
porque a MSE não toca sem dado em **todas** as faixas e uma faixa de som parada congelaria a IMAGEM
(§3.9). Alguns estouros seguidos varrem os 3 s, a faixa é solta, o cliente remonta, e ao terceiro
desiste — muda pelo resto do culto.

A conta que decide: o AAC são **96 kbps** contra ~3 Mbps de vídeo, isto é **3% dos bytes**.
Descartá-lo não alivia backpressure nenhuma e custa a faixa inteira. O sacrifício certo é o vídeo,
que se recupera sozinho no próximo quadro-chave — que é justamente o que as duas linhas seguintes do
método já preparavam (`esperandoIdr = true` + `pedirIdrComFreio`).

A fila carregava `ByteArray` puro, e por isso o estouro só sabia `clear()`; ela passou a carregar um
`Pedaco(bytes, audio)` e o descarte virou `removeAll { !it.audio }` — atômico num
`ArrayBlockingQueue`, e preservando a ordem do que fica, que é o contrato do fio (§5.3). **Exige o
APK.**

Três correções de leitura vieram junto, todas OTA, e as três são da mesma família de tudo neste
apêndice — **o número que mente custa mais que o número ausente**:

- **O teto de remontagens de som se RENOVA** depois de 45 s de som chegando sem falha, como o
  `recusasSeguidas` do decodificador. Ele existe para a projeção nunca piscar mais que três vezes
  *num episódio*; era um teto de **sessão**, e cinco reconexões espalhadas por um culto o gastavam —
  a tela ficava muda pelo resto do domingo por causa de uma turbulência que já tinha passado. Um
  teto que não se renova não é um freio, é uma sentença.
- **`menor folga já vista` passou a ser da SESSÃO.** Ela vivia junto com o resto do pior caso,
  zerada em cada descontinuidade — e a descontinuidade principal é o **salto**, que é exatamente a
  consequência do que ela existe para mostrar. Daí `11 salto(s)` ao lado de um tranquilizador
  `+1614 ms`, medido só na janela depois do último salto.
- **`-99999` é ausência de faixa, não folga negativa.** Sem a ressalva, toda tela muda — a maioria
  delas, e toda tela que perdeu o som — saía do Registro com `← chegou a secar`. Alarme falso em
  cima do log que existe justamente para separar alarme de ruído.

E o freio de IDR ganhou fôlego: `CHAVE_PODA_MS` foi de 8 s para **30 s**. O freio do servidor é
compartilhado (1 por tela a cada 2 s, mais um piso global de 1 s) e não distingue um pedido de
**faxina** de um de **estreia** — `17 pedido(s) · 8 atendido(s) · 9 engolido(s)`, e um engolido na
hora errada é uma tela nova esperando a próxima chave para ver a primeira imagem. Desde que o GOP
passou a caber na janela (§10-A.5), a poda quase não precisa pedir nada.

---

### 10-A.10 — a PORTA ABERTA nunca abriu, e era ela a metade que faltava (5.172)

O operador relatou o espelho "funcionando, mas sem estabilidade nem confiabilidade na conexão". A
revisão achou **oito** defeitos, e o primeiro explica sozinho a maior parte da queixa. Os oito têm
uma família em comum com o resto deste apêndice: nenhum deles dá erro em lugar nenhum.

**1. `tentarPortaAberta` mandava um corpo que o servidor recusava.** A v5.170 declarou que "quem
abrir o endereço entra"; a v5.171 construiu a folha inteira em volta disso. O `cliente.js` pedia a
entrada assim que a página abria — um `POST /par` com o relato e mais nada — e o `when` do
`EspelhoServidor.parear` tinha ramo para `pin`, para `qr` e para `espera`. Um corpo sem nenhum dos
três caía no `else -> 403`. **O recurso anunciado nunca chegou a existir.**

O atrito da estreia era o menor custo. O grande é a **recuperação**: toda queda de rede, toda
religada do espelho, toda expiração de token e todo `EspelhoPares.zerar()` devolvem a tela ao
pareamento — e sem esse ramo ela ficava lá, mostrando um QR que ninguém ia ler, no meio do culto,
até alguém atravessar o salão. É essa a diferença entre "conecta" e "é confiável".

O ramo passou a existir nos dois lados. O corpo **nu** também vale como pedido de entrada, de
propósito: é o que os bundles já instalados mandam, e o APK precisa consertá-los sem depender de o
OTA chegar antes. Quem decide é o `EspelhoPares.entrarAberto`, que **não cria espera nenhuma** (uma
por entrada encheria o `MAX_ESPERAS` na primeira tela que reconectasse em laço — trancando o PIN,
que é o plano B), respeita o bloqueio por origem e o teto de sessões, e **não conta erro** com a
porta fechada: não houve segredo tentado, e contá-lo faria uma TV que perguntou "posso entrar?"
gastar a cota do visitante que está digitando o PIN ao lado.

**2. Três recomeços trancavam o espelho pelo resto do culto.** Uma sessão só saía de `vivas` por
`encerrar`, por `recusar` ou pelas **seis horas** do prazo. Uma tela que recomeça numa aba nova (a
TV desligada e religada, o navegador que perdeu o `sessionStorage`) pede um token novo e deixa o
antigo ocupando vaga — e o teto é **três**. Com a porta aberta isso deixaria de ser hipótese para
ser rotina. `liberarVagaOciosa` toma a vaga **mais ociosa** quando ela está parada há mais de
`PRAZO_OCIOSA_MS` (4 min), e só quando uma tela nova precisa dela. A mais ociosa, e nunca a mais
velha: a mais velha pode ser justamente a TV do templo, ligada desde o começo. A invariante 3 sai
ilesa — o carimbo de uso só faz uma sessão morrer **mais cedo**, nunca estende o prazo absoluto.

**3. "Desconectar" era um botão que não fazia nada.** A folha manda o **rótulo** da tela ("B") ao
`espelhoAprovar(id, false)`, e o `approveMirrorScreen` o entregava ao `EspelhoPares.recusar`, que
procura um `id` de espera (base64url de 128 bits). Nunca casava, saía em silêncio e devolvia `true`.
Pior: um rótulo vazio cairia no id reservado da aprovação automática e **fecharia a porta** em vez
de derrubar alguém. E o botão não é um detalhe — ele é a resposta inteira do desenho ao curioso na
rede, já que a porta nasce aberta e o dano real dele é ocupar uma das três vagas. Agora o rótulo é
resolvido para a sessão, o socket é fechado de fora, e a origem fica de castigo por
`BLOQUEIO_DERRUBADA_MS` (2 min) — senão, com a porta aberta, a tela derrubada volta em dois segundos
e o botão continuaria não fazendo nada visível.

**4. O teto de conexões em voo contava os FLUXOS.** `servirFluxo` não volta enquanto a tela estiver
conectada, então cada telão vivo segurava um dos oito slots pelo culto inteiro. Com três telas
restavam cinco — e um navegador abre até **seis** conexões paralelas por host só para carregar a
página (`/`, `/e.css`, `/e.js`, `/f.js`, `/q.js`). A segunda tela a abrir o endereço já esbarrava no
teto e recebia conexões recusadas, que na tela viram *"não foi possível falar com o celular"*, sem
nada no Registro que ligasse uma coisa à outra. O teto passou a excluir os fluxos (que já têm teto
próprio, `TETO_TELAS`) e subiu para 16.

**5. O cliente não tinha detector para o FIO MUDO.** Toda a recuperação dele age sobre a
*reprodução* — o salto, o encalhe, a poda, a remontagem — e todas supõem que os bytes continuam
chegando. Um TCP meio-aberto (a Wi-Fi que trocou de ponto de acesso, o celular que mudou de IP, o AP
que limpou a tabela) deixa o `fetch` de `/v` pendurado para sempre: nem `done`, nem erro, nem
evento. A tela congela e o laço de reconexão, que consertaria isso, nunca roda porque a conexão
anterior nunca terminou. `vigiarFio` aborta depois de `SEM_BYTES_MS` (20 s) e o motivo viaja no
`alive` (`fim: sem bytes por 20 s`) — senão a única leitura possível seria "a tela reconectou
sozinha, não se sabe por quê".

**6. E o servidor não tinha o detector simétrico.** Do lado de cá, um socket meio-aberto não trava
escrita nenhuma enquanto o buffer de envio do kernel couber — numa cena parada (156 kbps) isso são
minutos segurando uma das três vagas. Qualquer `POST /r` passou a valer como sinal de vida, e o
vigia fecha a tela que emudeceu por `TETO_SEM_RELATO_MS` (60 s, contra os 10 s de batida do
cliente). `SO_KEEPALIVE` entrou junto, de graça, e o `PRAZO_LINHA_MS` subiu de 2 s para os 10 s que
o KDoc do `EspelhoHttp` já anunciava — 2 s é o que uma Wi-Fi congestionada leva para entregar um
corpo de 4 KiB, e com o detector novo um relato atrasado deixaria de ser um relato perdido para
virar uma tela derrubada por causa de um timer apertado.

**7. Uma oscilação da rede padrão derrubava o espelho inteiro.**
`registerDefaultNetworkCallback` fala da rede **padrão**, não da nossa: no instante em que o Android
reavalia a Wi-Fi (revalidação, roaming entre APs, um `onCapabilitiesChanged` durante o handover) o
padrão pisca para a rede móvel e volta em segundos. O caminho antigo lia isso como "a rede sumiu" e
derrubava servidor, tela virtual e encoder no meio do culto. Suspeita deixou de ser veredito: o
motivo fica anotado, o vigia confirma `GRACA_REDE_MS` (6 s) depois perguntando o que de fato
importa — *o IP em que este socket está ligado ainda é um endereço deste aparelho numa Wi-Fi?* — e
só então a queda acontece.

**8. E o adeus era uma sentença.** Recebido o `0x30 {"m":"adeus"}` o cliente parava e ficava morto
até alguém recarregar a página à mão. Desligar e ligar o espelho é coisa que o operador faz várias
vezes numa tarde de testes, e cada vez custava uma caminhada até cada televisor. Parar de martelar
continua certo; desistir, não. Passados 20 s a página volta a oferecer entrada, e com a porta aberta
isso é automático e silencioso.

Duas correções menores vieram no mesmo lote: a fila por tela passou de 24 quadros (~1 s, curto
demais para atravessar um soluço de AP) para **64 quadros com teto de 1,5 MB** — os dois juntos
dizem "até N quadros, e nunca mais que M bytes", que é o que o teto de quadros sozinho não dizia; e
um pedido de IDR **engolido pelo freio deixou de ser um pedido perdido** (ele fica pendente e o
vigia o repete no giro seguinte, o que troca "preta até o próximo IDR espontâneo" por "preta por até
um segundo"). O `csd` de áudio do `POST /r {do:audio}` passou a ir pelo caminho normal de entrega —
com a fila cheia, o `offer` solto falhava em silêncio e a tela ficava em `som: pedido, esperando o
csd` para sempre, o único dos sete desfechos do som cuja causa estava deste lado.

**A divisão do lote**, que importa para quem for testar em aparelho: os itens 1 (metade), 2, 3, 4,
6, 7 e as duas menores são **Kotlin — só chegam instalando o APK**. Os itens 1 (a outra metade), 5 e
8 vivem no `cliente.js` e chegam **por OTA**. `SHELL_VERSION` **não sobe**: nenhum método da ponte
nasceu nem mudou de assinatura. E as duas metades degradam sozinhas — um bundle novo num shell
antigo recebe 403 no pedido de entrada e volta ao QR (o comportamento de hoje), e um bundle antigo
num shell novo entra pela porta aberta assim mesmo, porque o corpo nu vale como pedido.

### 10-A.11 — o som morria FORA do espelho, e a porta de volta não existia (5.177)

O operador relatou a tela da rede ficando **muda com a imagem seguindo**, e desta vez o Registro
trazia a resposta inteira — mas não no lado em que se estava procurando.

Do lado do servidor tudo estava certo: `24 blocos de PCM/s`, `7424` quadros AAC produzidos,
`0 descarte(s)`, `fila 0/64`, enlace a 98 Mbps. A tela dizia ter recebido `5731 de som`. Ou seja: o
som **estava sendo produzido e estava chegando**, e mesmo assim a faixa não existia
(`som: PEDIDO e a faixa não nasceu`, `2 remontagem(ns)`).

**A causa estava na LINHA DO TEMPO, e ela nem é do espelho.** Pares repetidos de
`📱 play [oculto]` / `📱 PAUSA ESPONTÂNEA [oculto]`, a ~4 Hz. Aqueles `📱` são o `diagC` do
`controle.js` (`onde: 'celular'`), isto é **a preview do Controle** — não o telão. A v5.173 fez o
Controle passar a escutar o `espelho-status`, o que está certo (sem TV o espelho É a projeção), e
com isso o `resyncPreviewToDisplay` passou a rodar com o app minimizado: ele chama `preview.play()`,
o Chromium **pausa um `<video>` de página oculta**, o status seguinte chega 250 ms depois e
recomeça. Os três WebViews dividem UM processo — essa rotatividade de decodificador é o que faz o
`AudioWorklet` do espelho engasgar, o cliente vencer o `AUDIO_MUDO_MS` e soltar a faixa.

É a família de sempre deste apêndice: **nenhum dos dois lados dá erro**. O `play()` é aceito, a
pausa que vem atrás é comportamento documentado do navegador, e do lado do cliente soltar a faixa é
exatamente o que ele deve fazer para salvar a imagem.

Duas correções, e nenhuma sozinha bastaria:

1. **`preverPodeMexer`** (`controle.js`): com a página escondida não se toca no transporte da
   preview. Um `play()` que o navegador desfaz no quadro seguinte não é sincronização, é ruído — e
   quem realinha é a retomada, que já é EXATA desde a v5.173. A janela de `forcarResyncAte` só é
   CONSUMIDA quando há como agir.
2. **`voltouOSom`** (`cliente.js`): `soltarAudio` era uma **porta de mão única**. Ele acerta ao
   soltar (a MSE não toca sem dado em todas as faixas, e a imagem morreria pelo som), mas o que
   sobrava era uma tela muda pelo resto do culto, esperando alguém atravessar o salão para tocar
   nela — e a causa mais comum é passageira. Agora, com o AAC voltando a chegar por 2 s **seguidos**
   (a janela reinicia a cada intervalo maior que `AUDIO_MUDO_MS`, para um quadro perdido no meio de
   uma turbulência não contar como recuperação), o cliente remonta sozinho. O freio é o de sempre:
   `REBUILDS_AUDIO`, que só se renova depois de `AUDIO_SAUDAVEL_MS` de som limpo — isto é, depois de
   a remontagem ter dado certo.

**O lote inteiro é OTA** — nenhuma linha de Kotlin. É a primeira entrada deste apêndice em que a
causa raiz morava **fora** do espelho, e é a razão de ela estar escrita aqui assim mesmo: quem for
diagnosticar "a tela ficou muda" vai começar por este documento.

### 10-A.12 — a folha ligava o servidor para poder mostrar o estado (5.184)

Esta não é uma falha de código: é uma falha de FORMA, e ela produziu uma decisão que ninguém teria
tomado de propósito.

Desde a v5.156 as duas maneiras de conectar eram o **mesmo cartão de escolha** (`.cast-choice`) —
"Espelhar a tela na TV" e "Mostrar numa tela da rede", lado a lado. Só que elas não são a mesma
coisa: espelhar é uma **ação** que sai do app (abre o seletor do fabricante, e o assunto termina
ali); transmitir pelo site é um **estado** que dura o culto inteiro. Um cartão de escolha não tem
como mostrar "ligado", e a consequência está escrita no `abrirCast` da v5.171: **abrir a folha
ligava o servidor**. O comentário justificava — "ninguém abre 'Conectar uma tela' para não
conectar" — e o que não estava dito é o preço: não havia como abrir aquela tela para conferir o
endereço, o alvo de espelhamento ou quem está vendo **sem subir um `ServerSocket` na rede da
igreja**; e, com o telão no ar, sem disparar a pergunta do custo dobrado (§2.6).

A correção é a forma certa para cada coisa: **botão** para a ação, **interruptor** para o estado.
Com um interruptor o problema desaparece do outro lado — o estado é visível parado, e quem o muda é
o operador. Abrir a folha voltou a ser só ler.

Três consequências que valem por si:

- **Os dois endereços são iguais em peso.** `av.local` era o corpo grande e o IP era uma legenda em
  `.78rem`/`--muted`. É o contrário do que este documento diz em §2.7: `.local` **não** resolve no
  Chrome do Android nem na maioria das Smart TVs, então o número é justamente o que funciona quando
  o nome falha — e os dois são digitados no mesmo controle remoto.
- **A folha estava CONGELADA no instante da abertura.** `lerEspelho()` — a enquete de 2,5 s que
  existe para essa tela estar viva enquanto o operador olha para ela — chamava `renderEspelho()` e
  `renderCastBtn()`, e **nunca** `renderCast()`. Uma tela que entrasse depois de a folha abrir não
  aparecia na lista; o endereço não aparecia quando o servidor subia. Defeito de omissão, sem
  sintoma no lugar da causa — a folha simplesmente não mudava, o que se lê como "ninguém conectou".
- **Três ícones da UI de conexão nunca foram desenhados.** `&#xe307;` (cabeçalho da folha),
  `&#xe8ad;` (botão de espelhar) e `&#xe3b0;` (ler o código) estão **ausentes do subconjunto** em
  `shared/fonts/material-symbols.woff2` — uma fonte gerada à mão que nunca foi regerada quando esta
  UI nasceu. O modo de falhar é o mais mudo que uma fonte tem: o codepoint está no cmap (o navegador
  reserva a largura de avanço e **não** cai no fallback, então não aparece tofu) e o contorno está
  vazio. O que sobra é um vão do tamanho exato de um ícone, que se lê como desalinhamento. Medido
  com `getImageData` sobre os 32 codepoints do bundle: exatamente estes três dão zero pixel de
  tinta. Agora são `<symbol>`/`<use>` inline, como a engrenagem e o texto corrido já eram — e assim
  não dependem mais de um artefato binário que ninguém revisa num diff.

`tools/smoke.mjs` ganhou o par de asserções que trava a paleta destes dois controles: o botão
principal preenchido em `--accent-fill` com `--on-accent` por cima, e o interruptor vestindo o mesmo
âmbar **só quando ligado**. Trocar `--accent` por `--accent-fill` ali não quebra nada de forma
visível no CI — sai um botão âmbar-claro com texto quase branco por cima, abaixo do piso de
contraste, e só um par de olhos no aparelho notaria.

**O lote é OTA** — nenhuma linha de Kotlin.

### 10-A.13 — o eixo do som era um laço ABERTO, e por isso a deriva era eterna (5.185)

O relato: *"o som fica para trás e a imagem continua, a tela fica sem áudio"*. As três frases não são
três sintomas — são **a sequência inteira de um defeito só**, e a última delas é literalmente o que o
`cliente.js` escreve: `soltarAudio('o som ficou para trás')`.

**Os dois eixos são de naturezas diferentes, e essa parte é desenho, não defeito.** O vídeo é
`brutoUs - baseUs` — relógio monotônico, anda sozinho. O som é `ancoraUs + amostras × 1e6 / taxa` —
**contagem de amostras**, só anda quando chega PCM. O que faltava é o que fecha isso: **nada, em
lugar nenhum, conferia uma coisa contra a outra.** O `EspelhoAudio` produzia, o `EspelhoServidor`
entregava, o cliente media `bv.end - ba.end` e desistia aos 3 s — e o único lado com poder de
consertar era o único que não estava olhando.

Três produtores de deriva, todos reais, todos **permanentes** e todos **acumulativos**:

1. **O `AudioWorklet` engasgando.** Os três WebViews dividem UM processo (invariante 3), e a §10-A.11
   documenta uma rotatividade de decodificador que rouba exatamente esse fio. Enquanto ele não
   produz, o eixo do som PARA e o do vídeo segue andando. Um engasgo de 1,2 s é 1,2 s de defasagem
   **para o resto do culto**.
2. **O relógio do hardware de áudio**, que não é o do sistema. Dezenas a centenas de ppm são décimos
   de segundo por hora, e um culto tem duas.
3. **PCM perdido dentro do `alimentar`** — e este era um defeito de verdade. A regra "o que não coube
   CONTA assim mesmo" estava escrita e aplicada em `aoReceberPcm` (fila cheia), e **faltava em cinco
   saídas** do `alimentar`: encoder sem buffer de entrada depois de `TENTATIVAS`,
   `IllegalStateException` no `dequeue`, no `getInputBuffer` ou no `queueInputBuffer`, e o buffer
   curto demais para um quadro de amostras. Cada uma devolvia o resto do bloco ao nada **sem somar as
   amostras dele**, recuando o eixo permanentemente.

E o desfecho tinha um segundo andar, que é o que transforma "dessincronizado" em **mudo**: soltar a
faixa **não desfaz a deriva**, porque ela está no celular. A tela remontava, `vigiarAudio` media o
MESMO desvio no primeiro giro e soltava de novo — três vezes em poucos segundos. O teto de
remontagens se esgotava, e renová-lo exige 45 s de som limpo que nunca iam acontecer. Muda pelo resto
do culto, com o Registro dizendo, com toda a razão, que o AAC estava chegando.

**A correção fecha o laço, e a metade que importa é o produtor.** `EspelhoAudio.corrigirDeriva` mede
`(relógio desde a âncora) − (amostras recebidas + silêncio inserido) ÷ taxa` antes de cada bloco, e
age:

- **abaixo de `DERIVA_MIN_US` (250 ms) não mexe em nada.** A chegada dos blocos tem jitter próprio
  (`postMessage` na main thread), e corrigir 20 ms a cada bloco trocaria uma deriva por um serrilhado.
- **entre a zona morta e 3 s, insere SILÊNCIO**, em passos de `TETO_SILENCIO_US`. Isto não é
  reancoragem: o eixo continua sendo contagem de amostras, o `buffered` continua colado, e o muxer
  não estica amostra nenhuma. O ouvinte percebe o que de fato aconteceu — um trecho mudo do tamanho
  do engasgo — e depois dele o som volta **alinhado** em vez de voltar atrasado para sempre.
- **acima de 3 s, reancora.** O limiar não é escolhido: é o `AUDIO_MUDO_MS` do cliente. Passado ele a
  tela já soltou a faixa e vai remontá-la, então não há continuidade a preservar e encher três
  segundos de silêncio só atrasaria a volta. É a mesma reancoragem da página que renasce (v5.182).

**A medida é contra o PCM RECEBIDO, nunca contra o consumido**, e essa é a armadilha que a primeira
escrita desta correção caiu: entre a entrega e o consumo há uma fila de até `FILA_BLOCOS` × ~40 ms.
Um engasgo da main thread empilha blocos lá dentro, e medir do lado do encoder leria isso como "o
som parou de ser produzido" — a correção encheria de silêncio um buraco que os blocos empilhados
fechariam sozinhos meio segundo depois, jogando o som **à frente** do vídeo. Que é o único erro que
este desenho não tem como desfazer, porque a correção para trás é rebobinar o `tfdt`.

Do lado do cliente entra a guarda que faltava: **`voltouOSom` não remonta enquanto o fio ainda
mostrar o som mais de `ATRASO_VOLTA_S` (1,5 s) atrás.** Ela não conserta a deriva — quem conserta é o
celular — mas impede que os três créditos de remontagem sejam queimados **antes** de a correção
chegar, e faz a tela voltar a ter som sozinha no instante do realinhamento. `vigiarAudio` não servia
para responder isso: ele mede `bv.end - ba.end`, e com a faixa solta não existe `ba`. Os carimbos
crus do fio existem sempre — daí `desvioDoFio`.

**E o Registro ganhou a linha que faltava o tempo todo.** "O som ficou para trás" era escrito pela
TELA, e do lado do celular não havia **uma** medida que o confirmasse ou o desmentisse: o operador
via `24 blocos de PCM/s`, `7424 quadro(s)`, `0 descarte(s)` — tudo saudável — e uma tela muda. Agora
sai `som atrás do vídeo: agora N ms · pior M ms`, com as correções e o silêncio inserido, e um alarme
quando o pior passou dos 3 s em que a tela desiste.

**Metade APK, metade OTA**, e as duas degradam sozinhas: a correção da deriva é Kotlin e **só chega
instalando o APK**; a guarda do `voltouOSom` e a linha do Registro chegam por OTA e valem sozinhas —
num shell antigo `derivaMs` vem `undefined` e a linha simplesmente não é desenhada, como manda a
regra do bloco. `SHELL_VERSION` **não sobe**: nenhum método da ponte nasceu ou mudou de assinatura.

**O que ficou de fora, e está dito:** o embed do YouTube segue sem áudio (iframe de outra origem) e o
microfone ao vivo segue proibido de sair na rede. As duas são decisões do §3.9, não consequências
deste defeito.
### 10-A.14 — a entrada vira um CÓDIGO de três dígitos, e o `av.local` sai (5.186)

O pedido do operador tem quatro partes, e a última governa as outras três: *"o
botão de conectar já vai fazer a função de liberar o áudio e colocar em tela
cheia"*.

**Isso é uma restrição de plataforma, não de gosto.** `requestFullscreen()` e
sair do `muted` exigem *ativação transitória do usuário*, e um gesto vale por
poucos segundos. Para um botão fazer as três coisas, ele precisa gastar o gesto
ANTES de a rede responder — e daí sai, por dedução e não por oportunismo, que
**não pode existir fila de aprovação**: quando o operador aprovasse, o gesto já
teria passado, e a tela entraria muda e em janela. Numa TV do outro lado do
salão não há ninguém para dar o segundo toque; é exatamente o caso que este
recurso existe para resolver.

O que saiu, e por quê:

| saiu | porque |
|---|---|
| a fila (`Pendencia`, `aprovar`, `recusar`, `consultar`, `pendentes`, a aprovação automática) | código certo ENTRA, na mesma resposta — não há o que aprovar |
| a porta aberta (`entrarAberto`, §10-A.10) | agora há um código, e ele é exigido. É mais forte que a v5.170, não mais fraco |
| o QR inteiro (`esperaQr`, `espelho/qr.js`, `tools/qr.test.mjs`, o leitor do Controle, `requestCam`, a permissão `CAMERA`) | ele existia para INVERTER quem mostra e quem lê o segredo; a inversão perdeu a razão de ser quando o segredo virou três dígitos que a TELA digita |
| o mDNS (`EspelhoMdns.kt`, `EspelhoMdnsPacote.kt`, o JUnit) | `av.local` não resolve no Chrome do Android nem na maioria das Smart TVs — §2.7 sempre disse isso, e o IP sempre foi o endereço que de fato funcionava |

**O que sustenta três dígitos.** Mil combinações não se defendem pelo tamanho:
quem as defende é o **bloqueio crescente por origem** — `BLOQUEIO_MS` (60 s)
dobrando a cada bloqueio novo da mesma origem, até `BLOQUEIO_MAX_MS` (30 min).
Com um minuto FIXO, mil combinações saem em ~3 h de martelada paciente (cinco
tentativas por minuto); dobrando, a sétima rodada já custa mais que o culto
inteiro. Duas decisões sustentam isso e as duas têm JUnit:

- **o contador de bloqueios NÃO zera quando o bloqueio vence** (só a cota de
  erros zera). Quem esperou o minuto e voltou a martelar é exatamente quem a
  rodada seguinte precisa segurar por mais tempo — zerar ali devolveria a
  martelada ao primeiro degrau a cada rodada, e o crescimento não existiria;
- **e ele zera inteiro na primeira tentativa CERTA.** Quem acertou não é quem
  estava martelando, e carregar o expoente adiante puniria a TV que errou o
  número duas vezes antes de acertar.

O teto tem um caso próprio, e ele é da família do `setInteger` numa chave `long`
(§3.3, C1): em Kotlin/JVM o `shl` usa só os **6 bits baixos** do deslocamento, e
`1L shl 64` é `1L`. Sem o `coerceAtMost`, a 65ª rodada devolveria UM MINUTO — o
oposto exato do que o crescimento existe para fazer, sem nada que o denunciasse.

E `limpar` passou a esquecer uma origem depois de `BLOQUEIO_MAX_MS` parada, e
não `BLOQUEIO_MS`: com o expoente morando no mapa, esquecê-lo depois de um
minuto de silêncio teria o mesmo efeito de zerá-lo.

**A reentrada sozinha**, do lado do cliente, é a metade que salva um culto. A
tela guarda **em memória** (nunca no `sessionStorage` — lá mora o token, e um
segredo a mais guardado é um segredo a mais a vazar) o último código que
funcionou, e reentra com espera crescente. Recusada, ela **desiste e diz por
quê**: o código nasce a cada `ligar`, então uma recusa depois de uma queda quer
dizer "o operador religou a transmissão", e martelar um número morto pelo resto
do culto seria pior que parar.

**Um defeito que o teste pegou, e ele é da família deste apêndice.** A primeira
versão do `armarGesto` pedia `requestFullscreen()` no `#play` — que, no instante
do toque, ainda está `hidden`. O Chromium ACEITA: o elemento vira o elemento de
tela cheia, **desenha nada**, e passa a interceptar os toques. O campo do código
ficava visível por baixo e completamente inerte — o pior desfecho possível numa
TV que ninguém vai atender. O `tools/espelho-cliente.test.mjs` o nomeou com
todas as letras (`html intercepts pointer events`), e a correção é pedir tela
cheia no **documento**, que contém os dois estados: a troca de um para o outro
acontece dentro dela, sem pedir nada de novo.

**`CHANGE_WIFI_MULTICAST_STATE` FICA no manifest**, e a leitura natural ("o mDNS
saiu, logo ela é lixo") está errada: quem a exige não é o multicast, é o TIPO do
serviço em primeiro plano (`connectedDevice`, §2.6). Removê-la faz
`startForeground` lançar `SecurityException` e derruba o app inteiro no instante
em que o operador liga a transmissão.

**Metade APK, metade OTA**, e as duas metades precisam chegar juntas: o servidor
só aceita `{"codigo": …}` e o cliente só manda isso. Um bundle novo num shell
antigo cai no `else -> 403`; um bundle antigo num shell novo também. É por isso
que `SHELL_VERSION` sobe a **36** — o primeiro degrau deste contrato que
ENCOLHE.

---

## 11. A FRASE PARA O OPERADOR

> Dá para pôr o telão inteiro — inclusive vídeo, fades e cortina — em até três navegadores da rede da
> igreja, sem instalar nada nas telas e sem depender de internet. O celular vira o servidor; quem
> quiser assistir digita o endereço, digita o **código de três dígitos** que aparece na sua tela, e
> toca em Conectar — e esse toque já entra com som e em tela cheia. Você vê quem entrou e pode
> derrubar qualquer uma.
>
> Quatro coisas precisam ser ditas antes: **o roteador da igreja pode bloquear isso sozinho**
> (isolamento de clientes) e não há conserto do lado do app — o próprio recurso vai dizer, em texto,
> quando for esse o caso; **o celular precisa ficar no carregador**; **o som não vai completo** (o
> vídeo do YouTube tocado pelo player embutido vai mudo, e o microfone ao vivo nunca sai na rede, de
> propósito); e **você liga isso pela primeira vez numa terça-feira, não no domingo**.
>
> O espelho é auxiliar: ele **não desliga a TV, não muda a projeção e não se desliga sozinho quando a
> TV conecta**. Se ele falhar, quem perde a imagem são as telas da rede — nunca o salão.
>
> O seu site HTTPS entra como **a placa de rua** — `igreja.org.br/telao` mostrando o endereço do dia
> e um QR —, e pode virar cadeado verde de verdade se você puser um nome do seu domínio apontando
> para o celular. Isso é um degrau: com internet fica melhor, sem internet volta a ser o que seria de
> qualquer forma — **e nunca menos que isso**.

---

**Fontes verificadas ao escrever este documento:**
[VirtualDisplayAdapter.java](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/main/services/core/java/com/android/server/display/VirtualDisplayAdapter.java) ·
[DisplayManagerService.java](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/main/services/core/java/com/android/server/display/DisplayManagerService.java) ·
[DisplayManager.java](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/main/core/java/android/hardware/display/DisplayManager.java) ·
[DisplayDeviceInfo.java](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/main/services/core/java/com/android/server/display/DisplayDeviceInfo.java) ·
[Presentation.java](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/main/core/java/android/app/Presentation.java) ·
[WindowManagerService.java](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/main/services/core/java/com/android/server/wm/WindowManagerService.java) ·
[VirtualDisplay.java](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/main/core/java/android/hardware/display/VirtualDisplay.java) ·
[MediaFormat.java](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/main/media/java/android/media/MediaFormat.java) ·
[PixelCopy.java](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/main/graphics/java/android/view/PixelCopy.java) ·
[Chromium video_wake_lock.cc](https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/core/html/media/video_wake_lock.cc) ·
[Foreground service types](https://developer.android.com/develop/background-work/services/fgs/service-types) ·
[JavaScript bridge / WebMessageListener](https://developer.android.com/develop/ui/views/layout/webapps/native-api-access-jsbridge) ·
[AOSP: Implement HWC](https://source.android.com/docs/core/graphics/implement-hwc) ·
[Flutter VirtualDisplayController.java](https://raw.githubusercontent.com/flutter/flutter/master/engine/src/flutter/shell/platform/android/io/flutter/plugin/platform/VirtualDisplayController.java) ·
[scrcpy SurfaceEncoder.java](https://raw.githubusercontent.com/Genymobile/scrcpy/master/server/src/main/java/com/genymobile/scrcpy/video/SurfaceEncoder.java) ·
[go2rtc video-rtc.js](https://raw.githubusercontent.com/AlexxIT/go2rtc/master/www/video-rtc.js) ·
[W3C Media Source Extensions](https://www.w3.org/TR/media-source-2/) ·
[W3C WebCodecs](https://www.w3.org/TR/webcodecs/) ·
[WebAudio/web-audio-api#2566 (saída desconectada)](https://github.com/WebAudio/web-audio-api/issues/2566) ·
[WICG Local Network Access](https://github.com/WICG/local-network-access/blob/main/explainer.md) ·
[CA/B Forum: Internal Names](https://cabforum.org/working-groups/server/internal-names/) ·
[CA/B Forum Ballot SC-081v3](https://cabforum.org/2025/04/11/ballot-sc081v3-introduce-schedule-of-reducing-validity-and-data-reuse-periods/) ·
[How Plex is doing HTTPS](https://words.filippo.io/how-plex-is-doing-https-for-all-its-users/) ·
[GitHub Blog: CORS and DNS rebinding](https://github.blog/security/application-security/localhost-dangers-cors-and-dns-rebinding/) ·
[janhq/jan#8453](https://github.com/janhq/jan/issues/8453) ·
[Video-Dev: gaps em buffered](https://websites.fraunhofer.de/video-dev/being-trapped-in-a-gap-with-big-buck-bunny/) ·
[flutter#141207](https://github.com/flutter/flutter/issues/141207) ·
[flutter#172641](https://github.com/flutter/flutter/issues/172641)
