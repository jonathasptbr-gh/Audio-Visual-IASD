# A invariante 8 — o `InputStream` do `shouldInterceptRequest`

O contrato que o WebView impõe a **toda** resposta interceptada. O resumo mora
no [`CLAUDE.md`](../../CLAUDE.md) (§3, invariante 8); aqui está o detalhe, e o
oráculo é [`tools/webview-range.test.mjs`](../../tools/webview-range.test.mjs).

> **A regra nasceu do proxy da transmissão direta, e sobreviveu a ele.** O
> `StreamProxy.kt` (a rota `/stream/<token>`), a `servirTransmissao` do
> `EspelhoServidor` (a rota `/s/<token>` das telas da rede) e a cadeia do
> manifesto no `YoutubeGrab` foram apagados na revisão X2 (v1.13.49). O que
> continua alcançando este contrato é o que interessa agora: o **asset loader**
> e a **janela `/saf/<token>?r=`** — e qualquer caminho futuro que sirva bytes
> por faixa. O porquê da remoção está no [`docs/HISTORICO.md`](../HISTORICO.md)
> (v1.13.49); o "por que era assim" do recurso antigo, lá.

## O contrato

O `InputStream` devolvido **não é "a resposta"**: o Chromium o lê como o
**recurso INTEIRO a partir do byte 0**, e é ELE quem aplica o `Range` da
requisição — incondicionalmente, para toda resposta interceptada. A cadeia, na
fonte:

```
AndroidStreamReaderURLLoader::Start                → ParseRange(resource_request_.headers)  ← incondicional
AndroidStreamReaderURLLoader::OnInputStreamOpened  → InputStreamReader::Seek(byte_range_)
InputStreamReader::Seek                            → VerifyRequestedRange + SkipToRequestedRange
net::HttpByteRange::ComputeBounds                  → confere contra InputStream.available()
```

Devolver só a fatia pedida aplica o deslocamento **duas vezes**:

| faixa pedida | o que acontece |
|---|---|
| `bytes=0-…` | pular 0 é no-op → **funciona**, e esconde o resto atrás de si |
| `A ≥ tamanho da fatia` | `ComputeBounds` reprova → `ERR_FAILED` **antes de qualquer cabeçalho** (erro de rede sem status) |
| `A < tamanho da fatia` | pula `A` DENTRO da fatia e entrega o offset absoluto `2A` — o `fetch` RESOLVE, e o vídeo não toca |

Como todo fragmento de mídia começa a megabytes do início, **só a primeira
requisição de cada faixa podia funcionar** — por isso o defeito se esconde atrás
do segmento de inicialização.

## As três consequências

- **CORPO VAZIO NÃO CHEGA.** Com `available() == 0` e um `Range` fora do zero,
  o `ComputeBounds` reprova e a resposta inteira vira um erro de rede **sem
  status**. Toda resposta de erro precisa de um corpo não vazio: um erro que não
  chega é igual a erro nenhum, e a mensagem do Registro morre no caminho.
- **A razão HTTP é ASCII.** `WebResourceResponse` lança
  `IllegalArgumentException` para qualquer caractere fora de `0x20..0x7E`:
  uma exceção com cedilha dentro do `catch` produz uma **segunda** exceção em
  vez de uma mensagem legível.
- **O teto é TRAVA, não economia.** O maior pedaço é de 24 MB (`SafJanela` e o
  teto do antigo proxy): existe para o dia em que alguém apontar o caminho para
  uma faixa aberta e um vídeo inteiro tentar caber na memória do processo que
  hospeda os dois WebViews e a `Presentation`. O custo normal é a memória de UM
  pedaço.

## A inversão num `ServerSocket`

No `shouldInterceptRequest` quem aplica o `Range` é o WebView. **Num
`ServerSocket` quem aplica somos NÓS** — e é o que a rota `/m/` do telão por
comandos faz: RFC 7233 de verdade, com `206`/`Content-Range`/`416`, por
`EspelhoHttp.alcanceDe` (com JUnit). **Copiar o molde do interceptador para ali
é o erro exato**: ele devolve a fatia como se fosse o todo, porque do outro lado
há um WebView que refatia por cima.

## Onde ele aparece hoje

| caminho | forma | por quê |
|---|---|---|
| asset loader (`WebPathHandler` → `WebViewAssetLoader`) | arquivo INTEIRO desde o 0 | é o próprio WebView que aplica o `Range` de um `<video>`/`<audio>`; `allowFileAccess = false` não atrapalha justamente porque a mídia entra pelo loader |
| `/saf/<token>?r=<ini>-<fim>` (`SafJanela`) | a faixa vai na **QUERY**, resposta **200 seco** | com o `Range` no cabeçalho, o `ParseRange` do WebView aplicaria o deslocamento uma segunda vez. Sem cabeçalho não há `Seek` nem `ComputeBounds`, e o `available()` do array é o tamanho da JANELA — é isso que derruba o teto de 2 GB do arquivo inteiro (`available()` é `int`), e é por isso que o leitor do `.avpkg` lê por janelas |
| `/m/<token>` (`EspelhoHttp.alcanceDe`) | Range NOSSO, RFC 7233 | não há WebView no caminho (a tela é um navegador na rede) |

## O oráculo

O [`tools/webview-range.test.mjs`](../../tools/webview-range.test.mjs)
**transcreve** a regra do Chromium (com `arquivo:função` de cada trecho) e roda
os modelos de `InputStream` contra ela, sobre um recurso em que o byte `i` vale
`i % 251` — primo de propósito: um deslocamento errado sai como **bytes
errados**, não como tamanho errado, que é o único jeito de enxergar a corrupção
silenciosa do terceiro ramo. Se o Chromium mudar essa regra, o lugar de
descobrir é o CI, não o culto.

O caminho feliz não é testável aqui (exige um fMP4 de verdade, e não há ffmpeg
no ambiente). O que se trava é a REGRA.
