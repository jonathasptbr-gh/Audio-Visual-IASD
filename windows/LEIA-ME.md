# A casca do computador

O mesmo Áudio Visual IASD, num computador com Windows — **a mesma base web**,
byte a byte, servida por um servidor de loopback que o próprio programa sobe.
Não é um port: é a mesma relação que o Android já tem (casca fina sobre base
web) num segundo sistema operacional.

```
 AudioVisualIASD.exe ──stdio──► nucleo.jar ──http://127.0.0.1:8420──► as janelas
  (C#: janela, monitores,  ◄────  (Kotlin: servidor,  ◄──── SSE ────   (WebView2)
   diálogos, volume)               YouTube, cifra)
```

| peça | onde | o quê |
|---|---|---|
| `casca/ponte.js` | injetada em cada janela | o `__AVBridge` do computador — o `native.js` **não muda uma linha** |
| `AudioVisualIASD.Ponte/` | `net8.0` PORTÁTIL | o codec do envelope. Portátil para **rodar** o oráculo dele em Linux |
| `AudioVisualIASD.Testes/` | `net8.0` | a terceira metade do contrato do envelope |
| `AudioVisualIASD/` | `net8.0-windows` | a casca: janela Win32, WebView2, monitores, o cano com o núcleo |
| `../core/` | Kotlin/JVM | o núcleo: servidor de loopback, rotas, despacho da ponte |

## As decisões que precisam estar ditas

- **`127.0.0.1` não é rede, e o programa não depende de nada.** O socket de
  loopback não passa por placa de rede, roteador nem internet: é o programa
  servindo os próprios arquivos às próprias janelas — exatamente o que o
  `https://appassets.androidplatform.net/` já faz no celular. Servir a si mesmo
  é o preço da **invariante 1**: OPFS e IndexedDB, onde mora o acervo inteiro,
  só existem em contexto seguro, e `file://` não é um.

- **A PORTA É A ORIGEM.** `:8420` e `:8421` são origens diferentes, com
  IndexedDB e OPFS diferentes. O reflexo normal diante de uma porta ocupada —
  "pega outra livre" — **apagaria a biblioteca do operador em silêncio**. Por
  isso colisão é falha alta com frase, e a frase diz explicitamente para NÃO
  trocar a porta.

- **Um segundo monitor é a TV.** A janela do Telão nasce e morre com o monitor
  da projeção, como a `Presentation` nasce e morre com a TV. Sem ele, a
  projeção é a preview em tela cheia — o mesmo recuo do celular sem TV, e sem
  uma linha nova na base web. O degrau de um clique, no lote 3, é a tela cheia
  da própria janela do Telão.

- **Sem WinForms nem WPF, e é decisão.** O SDK do Windows Desktop não existe
  fora do Windows: um projeto que dependesse dele só compilaria num runner
  `windows-latest`, e a metade da casca que não é regra de culto deixaria de
  ser conferível junto com o resto. `net8.0-windows` cru compila em Linux, e a
  hospedagem do WebView2 não perde nada — o controle de WinForms é uma casca
  fina sobre `CreateCoreWebView2Controller(HWND)`, que é o que o `Win32.cs`
  entrega.

- **O envelope da ponte tem TRÊS escritas**, em três linguagens, e por isso
  três oráculos contra **as mesmas fixtures** escritas à mão
  (`tools/fixtures/ponte-envelope.json`). É a forma que este projeto já viu
  falhar em silêncio duas vezes — o `__tela` do `display-ready` e o
  `TIPOS_QUE_SOBEM` do dreno. Nenhum dos três gera as fixtures: se gerasse,
  provaria que um lado concorda consigo mesmo.

- **A rota `/saf/` é a única porta para fora do bundle** — e a sessão vai na
  URL. No Android o WebView do telão é montado **sem** o handler `/saf/`
  (`withSaf = false`): ele não tem como buscar um, nem sabendo o token. Aqui as
  duas janelas dividem **um socket** (a porta é a origem; um segundo socket
  seria um segundo IndexedDB), então a negativa vem de outro lugar:
  `/saf/<sessao>/<token>`, com o registro indexado pelas duas. Como cunhar
  token é privilégio do Controle, uma sessão de Telão **nunca tem entrada
  nenhuma** — a defesa não é o segredo do token, é não haver o que achar.

- **A invariante 9 ganha um degrau.** No Android o papel é `host = null` mais
  uma guarda por método, e o `CLAUDE.md` registra que **não há oráculo para
  ela**. Aqui o papel é selado na SESSÃO pela casca, que é quem cria a janela, e
  o núcleo recusa a superfície privilegiada **no servidor** — o que a torna uma
  linha de tabela, e uma linha de tabela se testa (`NucleoDespachoTest`).

- **A JVM morre com a casca, dos dois lados.** O núcleo sai quando o cano
  fecha; a casca mata o processo no encerramento. Uma JVM órfã seguraria a
  porta, e o operador leria "feche a outra cópia" sem ter nenhuma cópia na tela.

## O que ainda não existe

O lote 3 entrega o transporte inteiro, a casca que abre as duas janelas e a
importação (diálogos de arquivo + a rota `/saf/`). Falta, nesta ordem: YouTube e
cifra (lote 4), o muxer de 1080p e o PDF (lote 5), as telas da rede (lote 6) e o
empacotamento (lote 7).

**Os dois lados dizem o que falta**, e isso é desenho, não sobra: o
`NucleoDespacho.naoImplementados()` e o `Folhas.SemDono` guardam o que foi
pedido e não existe. Sem eles um método sem dono resolveria `null` pelo prazo de
60 s do `native.js` — o botão existe, é tocável, e depois de um minuto não
acontece nada. *A diferença entre "o programa travou" e "esta parte ainda não
existe nesta versão" é uma linha de diagnóstico.*

## Compilar

```bash
dotnet build windows/AudioVisualIASD/AudioVisualIASD.csproj   # compila em Linux
dotnet run --project windows/AudioVisualIASD.Testes            # o oráculo do envelope
node tools/ponte-envelope.test.mjs                             # a metade JavaScript
./gradlew :core:test                                           # o núcleo, e a metade Kotlin
```

**Compilar não é funcionar.** A casca só se fecha numa máquina com Windows, um
projetor ligado e a regra de calendário do projeto: **num dia sem culto**.
