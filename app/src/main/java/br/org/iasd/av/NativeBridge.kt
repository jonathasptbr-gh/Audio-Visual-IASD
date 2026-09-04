package br.org.iasd.av

import android.content.Context
import android.net.Uri
import android.provider.DocumentsContract
import android.provider.OpenableColumns
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.Executors

/**
 * Serviços que só a Activity pode prestar (SAF, telas, volume, mic, share).
 * O Display não tem host — seu WebView só usa o barramento de mensagens.
 */
interface BridgeHost {
    /** Abre o seletor de pasta do sistema (ACTION_OPEN_DOCUMENT_TREE). */
    fun requestFolderPick(onResult: (Uri?) -> Unit)

    /**
     * Abre o seletor de ARQUIVOS do sistema e devolve os `content://`
     * escolhidos (lista vazia se o operador desistir). Ver o porquê de não ser
     * o `<input type="file">` em `MainActivity.docPicker`.
     */
    fun requestDocPick(mimes: Array<String>, onResult: (List<Uri>) -> Unit)

    /**
     * Abre o "Salvar como" do sistema (ACTION_CREATE_DOCUMENT) e ESCREVE o
     * texto no arquivo escolhido. Devolve o nome gravado, ou `""` se o operador
     * desistir.
     *
     * Quem escreve é o shell, e não a página, porque o WebView deste app não
     * tem `DownloadListener`: um `<a download>` sobre um `blob:` simplesmente
     * não faz nada ali — sem erro, sem arquivo, sem nada na tela.
     */
    fun requestTextSave(nome: String, texto: String, onResult: (String) -> Unit)

    /**
     * Declara ao sistema que há download em andamento, para o processo não
     * ser congelado com o app minimizado (ver [SyncService]).
     */
    fun setBackgroundWork(on: Boolean)

    /** Telas de apresentação conectadas agora. */
    fun listDisplays(): JSONArray

    /** Abre o seletor de espelhamento de tela do Android. */
    fun openCastPicker()

    /** Rótulo do alvo de espelhamento disponível neste aparelho. */
    fun describeCastTarget(): String

    /**
     * Abre uma URL `https` FORA do app (navegador, ou o app que a reivindicar).
     * O WebView do Controle recusa navegar para outro origin — ver
     * [WebViewFactory] —, então sem esta rota um link externo não faz nada.
     */
    fun openExternalUrl(url: String)

    /** Interceptar os botões físicos de volume e mandá-los para o app. */
    fun setCaptureVolumeKeys(on: Boolean)

    /**
     * A PROJEÇÃO É ESTE APARELHO — não há tela conectada, e há algo no ar.
     *
     * Ver [NativeBridge.projecaoLocal]: quem sabe responder isso é o lado web
     * (ele conhece as telas e a cena), e o que o shell faz com a resposta é
     * impedir que o WebView do Controle seja suspenso.
     */
    fun setProjecaoLocal(on: Boolean)

    /** Devolver um passo de volume ao SISTEMA (fader já no limite). */
    fun adjustSystemVolume(step: Int)

    /**
     * O tema escolhido no Controle. Ver [NativeBridge.temaClaro] — o CSS não
     * alcança nem os ícones das barras de sistema nem o `windowBackground`.
     */
    fun setTemaClaro(claro: Boolean)

    /** Pede a permissão de microfone ao Android (push-to-talk). */
    fun requestMicPermission(onResult: (Boolean) -> Unit)

    /** Consome (uma única vez) um compartilhamento recebido por intent. */
    fun takePendingShare(): JSONObject?

    /**
     * O LINK que está na ÁREA DE TRANSFERÊNCIA, se ele for novo.
     *
     * `desde` é o carimbo (`ClipDescription.getTimestamp`) do último conteúdo
     * que o lado web já examinou. **A comparação acontece ANTES de ler**, e é o
     * ponto inteiro deste método: do Android 12 em diante, LER a área de
     * transferência de outro app mostra um aviso do sistema na tela
     * ("… colou do seu bloco de notas"). Consultar a DESCRIÇÃO não mostra nada,
     * então perguntar o carimbo primeiro faz o aviso aparecer no máximo uma vez
     * por item recém-copiado — e nunca a cada vinda ao app.
     *
     * Devolve `{ texto, carimbo }` ou `null`. `null` também quando:
     *
     * - o carimbo é `0` (o sistema não sabe dizer quando aquilo foi copiado):
     *   sem carimbo não há como não reler, e reler a cada retomada é o aviso do
     *   sistema em toda vinda ao app — o preço não vale o recurso;
     * - o app não tem foco (do Android 10 em diante a área de transferência só
     *   é legível com foco, e a descrição volta nula);
     * - o conteúdo não é texto simples, ou não COMEÇA com `http://`/`https://`.
     *
     * Esse último filtro é privacidade, não classificação: quem decide se um
     * endereço é do YouTube é o `controle.js` (invariante 5, e o
     * `extractYouTubeId` já existe lá). O que o filtro faz é impedir que uma
     * senha copiada entre no heap do JavaScript para ser descartada um passo
     * depois — a mesma família do `ShareIntake`, que só aceita `content://`.
     */
    fun readClipboardUrl(desde: Long, onResult: (JSONObject?) -> Unit)

    /**
     * Aplica AGORA a base web que esperava o próximo lançamento e recarrega os
     * dois WebViews. Devolve a versão aplicada, ou `null` se não havia nada.
     * Só a Activity pode fazê-lo: é ela que tem as duas páginas.
     */
    fun applyWebUpdate(onResult: (String?) -> Unit)

    // ---------- telão nas telas da rede local ----------

    /**
     * LIGA a transmissão: o servidor HTTP da rede local que serve o próprio
     * `/web/display/` às telas (bundle + comandos por SSE + mídia por `/m/`).
     *
     * `ip` é o endereço ESCOLHIDO pelo operador, e vazio significa "escolha
     * você" — o primeiro da lista de [EspelhoServidor.redeParaServir], que já
     * vem com o ponto de acesso na frente. Ele só existe porque um aparelho
     * pode ter DUAS redes servíveis ao mesmo tempo (a Wi-Fi da igreja e o
     * ponto de acesso, num rádio duplo), e aí a certa não é adivinhável daqui.
     *
     * Só a Activity pode fazê-lo, e o motivo é a fila: ligar isto na fila de IO
     * da ponte venceria pelo prazo de 60 s durante um download (ver o bloco do
     * telão em [NativeBridge]).
     *
     * Devolve o MESMO objeto de [mirrorState] — com `erro` não-vazio quando não
     * deu —, para o lado web ter um formato só e um desenho só.
     */
    fun startMirror(ip: String, onResult: (JSONObject) -> Unit)

    /**
     * DESLIGA o espelho. Síncrono e sem resposta: quem chama já sabe o que
     * pediu, e o desfecho aparece no [mirrorState] seguinte.
     */
    fun stopMirror()

    /** Estado da transmissão para a folha do Controle (endereço, telas). */
    fun mirrorState(onResult: (JSONObject) -> Unit)

    /** O anel de diagnóstico do espelho, em DADO — a frase é do `controle.js`. */
    fun mirrorDiag(onResult: (JSONObject) -> Unit)

    /**
     * DERRUBA UMA tela da rede, pelo RÓTULO ("tela B") — o único identificador
     * que a folha do operador tem. Rótulo em branco é recusado, e não vale
     * "todas".
     */
    fun derrubarTela(rotulo: String, onResult: (Boolean) -> Unit)

    /** Importa o `.p12` do espelho. `onResult("")` = deu certo; senão, a frase. */
    fun mirrorCertImport(origem: String, senha: String, onResult: (String) -> Unit)

    /**
     * `{ temCert, host, ate, nome, noAr, servindoTls }` — o que a folha do
     * espelho desenha. Os dois últimos NÃO são supérfluos: o estado GUARDADO e
     * o estado NO AR divergem (importar um certificado com o espelho já ligado
     * não promove o socket a TLS), e sem eles a folha anuncia "certificado
     * válido" sobre um endereço `http://`.
     */
    fun mirrorCertState(onResult: (JSONObject) -> Unit)

    /** Apaga o certificado: o espelho volta a HTTP claro no próximo ligar. */
    fun mirrorCertRemove(onResult: () -> Unit)
}

/**
 * `window.__AVBridge` — a superfície nativa vista pelo JavaScript.
 *
 * O lado web nunca fala com esta classe diretamente: `shared/native.js`
 * embrulha tudo em Promises e publica a API pública `window.AVNative`
 * documentada no contrato. Aqui só existe o transporte.
 *
 * ATENÇÃO: todo método `@JavascriptInterface` é chamado numa thread própria
 * do WebView — nada aqui pode tocar a UI sem `post`/`runOnUiThread`.
 */
class NativeBridge(
    private val ctx: Context,
    private val role: String,
    private val host: BridgeHost?,
    private val webRef: () -> WebView?,
) {

    companion object {
        /**
         * Versão do shell nativo. Um bundle web declara em `minShell` a versão
         * mínima de que precisa, e o OTA recusa atualizações que exijam mais do
         * que o shell instalado oferece (ver [WebUpdater]).
         *
         * **Subir SEMPRE que a superfície da ponte mudar** — e "superfície"
         * inclui a FORMA de um retorno e o COMPORTAMENTO de um método, não só a
         * assinatura. Três regras que o histórico deste contrato já cobrou:
         *
         * - **Remoção de recurso é remoção dos DOIS lados do fio, no mesmo
         *   lote.** Apagar o produtor de um campo e deixar o consumidor de pé
         *   não produz silêncio: `optBoolean`/`optLong` leem ausente como
         *   `false`/`0`, valores LEGÍTIMOS que o consumidor interpreta como
         *   medição. O inverso também vale — um produtor sem consumidor é a
         *   armadilha de quem repuser a leitura amanhã.
         * - **A degradação vale nos dois sentidos:** bundle antigo em shell
         *   novo e bundle novo em shell antigo caem num comportamento
         *   declarado, nunca numa meia-verdade.
         * - **Um método novo NÃO chega por OTA**, então o lado web pergunta
         *   antes de desenhar o que depende dele (`__SHELL_VERSION__ < N`).
         *
         * O degrau a degrau está na tabela da seção "A ponte" do `CLAUDE.md`.
         */
        const val SHELL_VERSION = 62

        /**
         * O CONSUMIDOR DA LAN para o barramento (telão por comandos, E2 —
         * `docs/TELAO-POR-COMANDOS.md` §3.2): a `MainActivity` o aponta para o
         * `EspelhoServidor.difundirJson` enquanto o servidor estiver no ar, e
         * o anula ao desmontar. Ele vive no `companion` porque `busPost` chega
         * pelas pontes de TODOS os WebViews (Controle, telão, espelho) e o
         * consumidor é um só. `@Volatile`: escrito pela main, lido de qualquer
         * thread de WebView. Nulo = nenhum custo no caminho quente.
         */
        @Volatile
        var tapLan: ((String) -> Unit)? = null

        /**
         * Por quanto tempo um `display-status` do TELÃO cala o `tela-status`
         * — ver [snoopDisplayStatus]. Folga sobre o compasso do status (~4 Hz)
         * para uma batida perdida não devolver a palavra às telas da rede.
         */
        private const val PRECEDENCIA_TELAO_MS = 3_000L

        /**
         * Quando o TELÃO de verdade falou pela última vez. NO COMPANION, e a
         * mudança é correção além de conveniência: cada papel tem a PRÓPRIA
         * instância de ponte, então um campo de instância nunca cruzava o
         * display-status (que chega pela ponte do telão) com o `tela-status`
         * — a precedência era comparada contra um relógio que o outro lado
         * nunca escrevia. Compartilhado, ela passa a valer entre papéis — e
         * para o `tela-status` do telão por comandos, que nem ponte tem (chega
         * pelo `POST /r` do servidor da LAN).
         */
        @Volatile
        private var ultimoStatusDoTelaoMs = 0L

        /**
         * Por quanto tempo a TELA ELEITA continua sendo a referência depois de
         * calar. Espelha o `TELA_REF_SILENCIO_MS` do `controle.js`, e o valor
         * espelha de propósito: duas contas de eleição com réguas diferentes
         * elegeriam telas diferentes.
         */
        private const val TELA_REF_SILENCIO_MS = 5_000L

        /**
         * A TELA ELEITA como referência de tempo, e quando ela falou.
         *
         * [ultimoStatusDoTelaoMs] resolve telão × telas; esta é a outra metade
         * da mesma regra, ENTRE as até três telas pareadas. Cada uma emite
         * `tela-status` a ~4 Hz pelo `POST /r` e
         * [SessionService.updateFromDisplay] supõe UMA fonte: com duas
         * alternando, o `playing` e a posição de uma contradizem os da outra a
         * cada batida — uma tela que acabou de entrar (ou de recarregar)
         * reporta 0 s e pausado enquanto as outras reportam o meio do louvor, e
         * a barra da tela de bloqueio anda para a frente e para trás. É o mesmo
         * defeito que a precedência existe para impedir, um nível abaixo.
         *
         * A eleita é a PRIMEIRA VISTA e troca quando cala por
         * [TELA_REF_SILENCIO_MS] — a regra do `controle.js` (`telaRefId`),
         * verbatim; a única diferença é o relógio (`elapsedRealtime`,
         * monotônico, contra o `Date.now()` de lá). Não precisa ser zerada ao
         * fim da cena: o silêncio já troca a eleita.
         */
        @Volatile
        private var telaRefId: String? = null

        @Volatile
        private var telaRefEmMs = 0L

        /**
         * O snoop da notificação de mídia, chamável DE FORA de uma ponte —
         * é o que alimenta a MediaSession quando o status vem do servidor da
         * LAN (`tela-status`, E5) com o app minimizado e o WebView do Controle
         * estrangulado. Não é decisão de transporte: copia campos que o lado
         * web já calculou — a exceção documentada do snoop desde sempre.
         */
        fun snoopStatusDeFora(ctx: Context, json: String) {
            if (!json.contains("display-status") && !json.contains("tela-status")) return
            val o = try { JSONObject(json) } catch (e: Exception) { return }
            val tipo = o.optString("type")
            if (tipo != "display-status" && tipo != "tela-status") return
            // A PRECEDÊNCIA é a mesma do `controle.js`: com um telão de verdade
            // emitindo, espelho e telas da rede são ruído — duas fontes
            // alternadas dão uma barra que anda para a frente e para trás.
            val agora = android.os.SystemClock.elapsedRealtime()
            if (tipo == "display-status") {
                ultimoStatusDoTelaoMs = agora
            } else {
                if (agora - ultimoStatusDoTelaoMs < PRECEDENCIA_TELAO_MS) return
                // E ENTRE AS TELAS vale a ELEIÇÃO — ver [telaRefId]. Sem ela a
                // precedência resolve só metade do problema: calado o telão, as
                // até três telas pareadas passam a alternar entre si.
                val id = o.optString("__tela").ifEmpty { "?" }
                if (telaRefId == null || agora - telaRefEmMs > TELA_REF_SILENCIO_MS) {
                    telaRefId = id
                }
                if (id != telaRefId) return
                telaRefEmMs = agora
            }
            SessionService.updateFromDisplay(
                ctx,
                playing = o.optBoolean("playing"),
                positionMs = (o.optDouble("currentTime", 0.0) * 1000).toLong(),
                durationMs = (o.optDouble("duration", 0.0) * 1000).toLong(),
            )
        }

        /**
         * Fila do IO CURTO da ponte, **compartilhada por todas as instâncias**.
         *
         * Só o que responde em milissegundos: leitura de `version.json`, o
         * estado do OTA, e a varredura de uma pasta pelo `ContentResolver`. O
         * trabalho LONGO mora em [transferencia] e [extracao] — ver o porquê
         * lá.
         *
         * **NADA DE REDE AQUI, nem uma consulta "rápida".** O `apkProcurar`
         * morou nesta fila e é a lição: uma pergunta à API do GitHub com 20 s
         * de connect mais 20 s de read trava, no pior caso, por 40 s a fila de
         * que `otaPending`, `atualizacaoEstado` e `listFolder` dependem — e os
         * três não erram, mentem baixinho (o `call()` do lado web resolve
         * `null` aos 60 s, e a lista vazia do `listFolder` o `controle.js` lê
         * como "a pasta sumiu do aparelho"). Rede lendo metadados é a
         * definição da [extracao].
         *
         * Um executor por instância vazava: `newSingleThreadExecutor` cria uma
         * thread de core sem timeout e não-daemon, viva até um `shutdown` que
         * nunca acontecia — e a ponte é reconstruída a cada morte de renderer e
         * a cada ciclo de desconexão/reconexão do dongle, cada uma retendo a
         * `NativeBridge` inteira (e, por ela, a Activity/Presentation antigas).
         * Nada nesta fila é por-WebView: é IO genérico. Daemon para nunca
         * segurar o encerramento do processo.
         */
        private val io = Executors.newSingleThreadExecutor { r ->
            Thread(r, "av-bridge-io").apply { isDaemon = true }
        }

        /**
         * A fila das TRANSFERÊNCIAS LONGAS — o download do YouTube e o do APK.
         *
         * Ela existe porque [io] é de UMA thread só, e é isso que fazia uma
         * transferência de minutos bloquear tudo o mais que passa pela ponte.
         * Do lado web `CALL_TIMEOUT_MS` é de 60 s e o `call()` resolve `null` ao
         * vencer — então, com um vídeo de 300 MB baixando, `listFolder` devolvia
         * lista vazia, `otaPending` dizia que não há atualização e
         * `atualizacaoEstado` respondia nada. Nenhum deles erra: todos mentem
         * baixinho, e o pior é o `listFolder`, cuja lista vazia o `controle.js`
         * lê como "a pasta sumiu do aparelho".
         *
         * Continua sendo UMA THREAD, e isso é invariante e não economia: o
         * resgate de download do [YoutubeGrab] é um slot único e o mapa de
         * parciais supõe **um download por vez**. O `ytDiscard` mora aqui pelo
         * mesmo motivo — ele mexe nesse mesmo estado, e fora desta fila poderia
         * apagar o parcial de um download em curso.
         */
        private val transferencia = Executors.newSingleThreadExecutor { r ->
            Thread(r, "av-bridge-transf").apply { isDaemon = true }
        }

        /**
         * A fila das EXTRAÇÕES — o que vai à rede ler metadados (busca do
         * YouTube, playlists de um canal, o manifesto da transmissão direta, a
         * procura por APK novo na API do GitHub) e a rasterização de um PDF.
         *
         * Separada da [transferencia] porque estas são de SEGUNDOS e aquela é de
         * minutos: enfileirá-las atrás de um download deixaria o "Tocar agora"
         * de um vídeo esperando o hinário terminar de baixar — e, vencido o
         * prazo de 60 s, caindo no download sem que nada explicasse por quê.
         *
         * Também de uma thread só: as extrações compartilham a inicialização
         * global do NewPipe, e serializá-las é mais barato que auditar a
         * biblioteca inteira. O `apkProcurar` não toca no NewPipe (é um
         * `HttpURLConnection` avulso) e entra aqui pela outra metade da regra —
         * é rede lendo metadados —, aceitando o preço declarado desta fila: o
         * pior caso dele é um "Tocar agora" esperando, que é o desfecho que
         * esta fila já sabe ter. Os DIAGNÓSTICOS não colidem — `diagnostico` é
         * escrito só pelo caminho do download e `diagnosticoStream` só pelo do
         * manifesto, que é justamente por que eles são dois campos.
         *
         * **E é a fila de um TOQUE, nunca de uma varredura.** O preço acima é
         * aceitável para UMA pergunta esporádica na frente do operador; trabalho
         * de MASSA aqui esgota o único fio e empurra todo "Tocar agora" para
         * além dos 60 s. É por isso que a varredura de cifras tem fila própria
         * ([cifra]), e é a pergunta a fazer antes de pôr qualquer coisa aqui.
         */
        private val extracao = Executors.newSingleThreadExecutor { r ->
            Thread(r, "av-bridge-extr").apply { isDaemon = true }
        }

        /**
         * A fila da CIFRA — o `GET` da página do Cifra Club ([cifraHtml]), e
         * só ele.
         *
         * Ela é PRÓPRIA porque o trabalho dela é de MASSA e o da [extracao] é
         * de TOQUE. A varredura do acervo roda na ABERTURA sobre tudo que está
         * baixado e com SEIS requisições concorrentes do lado web, então
         * enquanto ela corre há sempre ~6 tarefas de cifra à frente de quem
         * chegar depois — cada uma com o prazo do [CifraFonte] valendo para
         * connect E para read. Compartilhando a fila, o `ytStream` de um "Tocar
         * agora" esperava essa cabeça inteira e podia vencer os 60 s do
         * `call()`: a promessa resolve `null`, a transmissão direta falha e a
         * cena cai no download de centenas de MB, sem nada na tela que
         * explique.
         *
         * Sair da [extracao] é seguro porque o que obriga AQUELA fila a ser de
         * uma thread só é a inicialização global do NewPipe, e o [CifraFonte]
         * não o toca (é um `HttpURLConnection` avulso). Esta continua de UMA
         * thread pelo motivo dela: `CifraFonte.ultimaTentativa` é o veredito da
         * ÚLTIMA busca, e escritas concorrentes fariam a linha "Cifra:" do
         * Registro descrever uma tentativa que não é a que o `cifra.js` está
         * relatando ao lado.
         */
        private val cifra = Executors.newSingleThreadExecutor { r ->
            Thread(r, "av-bridge-cifra").apply { isDaemon = true }
        }
    }

    // ---------- identidade ----------

    @JavascriptInterface
    fun shellVersion(): Int = SHELL_VERSION

    /** `"controle"` ou `"display"` — o web usa para saber qual papel executa. */
    @JavascriptInterface
    fun role(): String = role

    /**
     * `versionName` do APK instalado — o índice de versão do SHELL mostrado na
     * UI. É diferente de [SHELL_VERSION] (contrato interno da ponte, usado pela
     * válvula `minShell` do OTA): este é legível pelo operador e muda a cada
     * Release. Shell e base web atualizam por caminhos independentes (instalar
     * APK × OTA), então precisam ser legíveis à parte.
     */
    @JavascriptInterface
    fun appVersion(): String = try {
        ctx.packageManager.getPackageInfo(ctx.packageName, 0).versionName ?: ""
    } catch (e: Exception) {
        ""
    }

    /**
     * A base web carregou por inteiro — desarma o watchdog de boot do OTA.
     * Sem esta confirmação, um bundle baixado que quebre é descartado no
     * lançamento seguinte e o app volta ao embutido no APK.
     *
     * **Só o Controle confirma.** O papel já chega aqui pelo construtor, e
     * aceitar a confirmação do telão furava o watchdog por um caminho
     * independente: o Display carrega uma fração do código (não tem playlist,
     * transporte, Bíblia, Cronograma), então um bundle que quebre SÓ o
     * `controle.js` — de longe o arquivo mais provável de quebrar — era
     * confirmado pela página do Display, que carregou bem, e adotado para
     * sempre. Confirmar por ele não prova nada sobre o Controle.
     */
    @JavascriptInterface
    fun otaConfirm() {
        if (role != "controle") return
        WebUpdater.confirmBoot(ctx)
    }

    /**
     * A versão da base web que já está BAIXADA e esperando o próximo lançamento
     * — string vazia quando não há nada novo.
     *
     * Na fila de IO porque lê o `version.json` do bundle staged: é um arquivo
     * minúsculo, mas disco na thread do WebView é disco na thread do WebView.
     */
    @JavascriptInterface
    fun otaPending(callId: String) {
        // Só o Controle, a mesma guarda dos três irmãos otaApply/otaCheck/
        // otaDiag: o telão não pergunta por atualização, e não há por que este
        // ser o único método do bloco a responder a qualquer papel.
        if (host == null) { resolve(callId, JSONObject.quote("")); return }
        io.execute {
            resolve(callId, JSONObject.quote(WebUpdater.pendingVersion(ctx) ?: ""))
        }
    }

    /**
     * APLICA a atualização agora e recarrega as duas páginas — a pedido
     * explícito do operador (ver `WebUpdater.applyNow` para o que isto flexiona
     * e por quê).
     *
     * Só o Controle: o telão não decide isto, e não tem como — ele não tem host.
     */
    @JavascriptInterface
    fun otaApply(callId: String) {
        if (host == null) { resolve(callId, "null"); return }
        host.applyWebUpdate { versao ->
            resolve(callId, if (versao == null) "null" else JSONObject.quote(versao))
        }
    }

    /**
     * PROCURAR. Com `forcar`, pula o piso entre consultas — é o operador
     * tocando um botão, e um botão que não faz nada porque um relógio interno
     * acha que é cedo demais é pior que a requisição extra. Sem ele, é o
     * cutucão de rotina da enquete do lado web, e aí quem decide é o piso
     * PRÓPRIO dela (`WebUpdater.cutucaoDaTela`): a enquete bate a cada 10 s, e
     * o piso comum de 5 s não reprovava nenhuma delas — o que se anunciava como
     * "lê o disco" era uma consulta à rede a cada dez segundos, para sempre.
     *
     * NÃO espera a resposta da rede: quem entrega o desfecho é a enquete do
     * lado web ou o empurrão do shell quando o bundle fica pronto
     * (`window.__avAtualizacao`). Segurar a promise pelo tempo de um download
     * de megabytes só daria um botão travado.
     *
     * Só o Controle — o telão não pede atualização.
     */
    @JavascriptInterface
    fun otaCheck(forcar: Boolean) {
        if (host == null) return
        if (forcar) WebUpdater.checkAsync(ctx, "pedido do operador", true)
        else WebUpdater.cutucaoDaTela(ctx)
    }

    /**
     * O estado da procura, em uma linha, para o Registro.
     *
     * "Não apareceu aviso nenhum" tem pelo menos quatro causas indistinguíveis
     * da tela: não há versão nova, a busca falhou, o bundle exige um shell mais
     * novo, ou a pergunta está esperando o telão esvaziar. Sem isto a única
     * resposta possível era um palpite.
     */
    @JavascriptInterface
    fun otaDiag(callId: String) {
        io.execute {
            resolve(callId, JSONObject.quote(if (host == null) "" else WebUpdater.diag(ctx)))
        }
    }

    /**
     * POR QUE O MICROFONE NÃO ABRE — o que só o shell sabe (shell 53).
     *
     * Ver [MicDiag]: `AppOps`, mudo global, modo de áudio, sessões de gravação
     * ativas e as entradas que o SISTEMA enxerga. Tudo leitura, tudo API
     * pública, nada de permissão nova — e nada que abra o microfone.
     *
     * Na fila `io` porque é isso mesmo: consultas de milissegundos a serviços do
     * sistema, sem rede. Sem `host` devolve `{}` — a superfície privilegiada é
     * do Controle (invariante 9), e o telão não tem o que fazer com ela.
     */
    @JavascriptInterface
    fun micDiag(callId: String) {
        io.execute {
            if (host == null) { resolve(callId, "{}"); return@execute }
            resolve(callId, runCatching { MicDiag.paraJson(ctx).toString() }.getOrDefault("{}"))
        }
    }

    // ---------- o FAROL: medir o alcance sem medir ninguém (shell 58) ----------

    /**
     * O estado do farol → `{ conta, ultimo, diag }`.
     *
     * Ver [Farol] para o desenho. Aqui só o que a ponte precisa dizer:
     *
     * - `conta` é o VEREDITO, não a chave. Ele já embute o build debuggável,
     *   então a tela não precisa saber que existe um segundo motivo para um
     *   aparelho não contar — e não pode ficar desatualizada quando aparecer um
     *   terceiro. Quem decide é [Farol.contar], num lugar só.
     * - `ultimo` é epoch em ms, e `0` é "nunca acendeu". Quem escreve a frase é
     *   o `controle.js`: Kotlin devolve JSON, a UI monta o texto.
     *
     * Na fila [io] porque é isso mesmo — duas leituras de `SharedPreferences`,
     * sem rede. O farol EM SI nunca roda aqui: ele tem fila própria, e é a
     * ronda do OTA que o aciona.
     *
     * ELE É SÓ LEITURA desde o shell 61, e o consumidor é o REGISTRO: a linha
     * "Alcance:" responde *"o farol chegou a acender?"*, que é a pergunta que
     * faz aquele texto ser copiado. A chave que ele acompanhava (`farolContar`)
     * saiu — ver o bloco logo abaixo.
     *
     * Sem `host` devolve `{}` (invariante 9): é diagnóstico do Controle, e um
     * script de terceiro no documento do telão não tem por que saber quando
     * aquele aparelho acendeu — nem que o farol existe.
     */
    @JavascriptInterface
    fun farolEstado(callId: String) {
        io.execute {
            if (host == null) { resolve(callId, "{}"); return@execute }
            val o = JSONObject()
            runCatching {
                o.put("conta", Farol.contar(ctx))
                o.put("ultimo", Farol.ultimo(ctx))
                o.put("diag", Farol.diag())
            }
            resolve(callId, o.toString())
        }
    }

    /*
     * (`farolContar` saiu no shell 61. Era a chave "este aparelho entra na
     *  contagem", e ela foi descartada a pedido do operador — *"descarte a
     *  opção de contagem de uso como opcional, deixe sempre ativo, não preciso
     *  do sistema de exclusividade"*. Ver o KDoc de [Farol]: o que sobra é a
     *  exclusão do build debuggável, que nunca foi opção de ninguém.
     *
     *  ENCOLHER A PONTE É UM LOTE APK + WEB PUBLICADO JUNTO, e é por isso que
     *  este lote leva `shellTag` no `version.json`: um bundle que já não desenha
     *  a chave é inofensivo num shell 60, mas o `Farol.contar` que deixa de ler
     *  a preferência só chega instalando o APK — e é ELE que devolve à contagem
     *  um aparelho marcado "fica de fora" que ficaria sem tela para desmarcar.)
     */

    /**
     * OS DOIS CANAIS DE ATUALIZAÇÃO, numa fotografia só (shell 43).
     *
     * `{ web, webAtual, shell, shellBytes, shellAtual, webNotas, diag }` — ver
     * [WebUpdater.estado] para o que cada campo responde e para por que eles
     * precisam ser lidos no mesmo instante.
     *
     * `webNotas` (shell 47) é a LINHA DO TEMPO do que vem na atualização, lida
     * do `notas.json` do PRÓPRIO bundle baixado — ver [WebUpdater.notasPendentes]
     * para por que ela não viaja no manifesto.
     *
     * Na fila de IO porque lê o `version.json` do bundle staged — e agora o
     * `notas.json` ao lado dele, do mesmo diretório e com teto de tamanho. Só o
     * Controle, como os irmãos: o telão não pergunta por atualização.
     */
    @JavascriptInterface
    fun atualizacaoEstado(callId: String) {
        if (host == null) { resolve(callId, "null"); return }
        io.execute { resolve(callId, WebUpdater.estado(ctx).toString()) }
    }

    // ---------- atualização do PRÓPRIO APK (shell 35) ----------

    /**
     * Há APK novo publicado? → `{}` (nada), `{versao, bytes, notas}` ou
     * `{erro}`.
     *
     * `{}` e `{erro}` são leituras DIFERENTES, e é por isso que o vazio não
     * carrega mensagem: "não há versão nova" é o caso normal, "não deu para
     * perguntar" é a rede. Confundi-los foi o que a linha "Procura:" do
     * Registro existe para não deixar acontecer com o OTA da base web.
     *
     * **Privilégio do Controle** (invariante 9). O telão hospeda código de
     * terceiro por design, e um método que baixa e instala um pacote é o mais
     * poderoso da ponte inteira — ele não pode existir naquele documento.
     *
     * Roda na fila de EXTRAÇÃO, nunca na de [io]: é uma consulta à API do
     * GitHub com 20 s de connect mais 20 s de read, e na [io] ela travava por
     * até 40 s a fila de `otaPending`, `atualizacaoEstado` e `listFolder` —
     * ver o KDoc de [io].
     */
    @JavascriptInterface
    fun apkProcurar(callId: String) {
        val h = host
        if (h == null) { resolve(callId, "null"); return }
        extracao.execute { resolve(callId, ShellUpdater.procurar(ctx).toString()) }
    }

    /**
     * Baixa o APK e ABRE O INSTALADOR do sistema. `''` = deu certo, senão a
     * FRASE do erro — o mesmo contrato do `espelhoCertImportar`.
     *
     * Ele **não instala**: quem instala é o diálogo do Android, e está certo
     * que seja. Instalar derruba o app inteiro, com a projeção junto, e a hora
     * é decisão do operador. Quem nem oferece o botão na hora errada é o
     * `controle.js`, pelo `horaRuimParaAtualizar()`.
     *
     * O progresso vai por `window.__avApk(pct)` — um download de dezenas de MB
     * numa rede de igreja é minutos, e uma tela parada sem número é
     * indistinguível de travamento.
     */
    @JavascriptInterface
    fun apkInstalar(callId: String) {
        val h = host
        if (h == null) { resolve(callId, JSONObject.quote("indisponivel")); return }
        transferencia.execute {
            val erro = ShellUpdater.baixarEInstalar(ctx) { pct ->
                val w = webRef()
                w?.post { w.evaluateJavascript("window.__avApk && window.__avApk($pct);", null) }
            }
            resolve(callId, JSONObject.quote(erro))
        }
    }

    // ---------- barramento de comandos ----------

    @JavascriptInterface
    fun busPost(json: String) {
        MessageBus.post(webRef(), json)
        snoopDisplayStatus(json)
        // O TAP DA LAN (telão por comandos, spec §3.2). Aqui, e NUNCA no
        // `MessageBus.post`: por aqui só passa o que o LADO WEB emitiu — uma
        // mensagem que o Kotlin injetar de volta no barramento (o `tela-status`
        // da E5) entra por `MessageBus.post(null, …)` e não ecoa para as telas
        // da rede. É o que fecha o laço de eco por construção.
        tapLan?.invoke(json)
    }


    /**
     * Lê de passagem o `display-status` que o telão emite a 2 Hz e mantém a
     * sessão de mídia em dia com ele.
     *
     * Existe porque a notificação NÃO pode depender do JS do Controle estar
     * rodando: com o app minimizado e sem áudio audível no celular, o sistema
     * estrangula aquele WebView e `pushNowPlaying` para de ser chamado — a
     * notificação congela com o botão em "play" e a barra parada enquanto o
     * telão segue projetando. (A pista foi que ligar o áudio local fazia o
     * defeito sumir: áudio audível isenta a página do estrangulamento.)
     *
     * O status do telão já passa por aqui de qualquer jeito (o WebView do
     * Display o envia por `busPost`), e a `Presentation` não é estrangulada — é
     * uma fonte que continua viva quando a outra não está.
     *
     * NÃO é decisão de transporte (invariante 5): só copia dois campos que o
     * lado web já calculou. Título, subtítulo e modo de slide continuam vindo de
     * `nowPlaying`; sem cena publicada, nada é inventado aqui.
     */
    private fun snoopDisplayStatus(json: String) = snoopStatusDeFora(ctx, json)

    // ---------- sessão de culto ----------

    /**
     * Ligado enquanto houver QUALQUER download em curso (hinos, álbuns,
     * Bíblia, pastas). O lado web conta as tarefas ativas e só desliga na
     * última — ver `bgWorkBegin`/`bgWorkEnd` em `controle.js`.
     */
    @JavascriptInterface
    fun keepAlive(on: Boolean) {
        host?.setBackgroundWork(on)
    }

    /**
     * Progresso do download em curso, para a notificação do serviço em primeiro
     * plano. Com o app minimizado — o uso normal durante uma sincronização —
     * ela é a única janela para o que está acontecendo.
     *
     * O JSON vem do lado web (`AVNative.bgProgress`), que sabe o que está
     * baixando e a que ritmo:
     * `{ label, done, total, etaMs, items, idleMs, bytes }`. CAMPO NOVO AQUI É
     * CAMPO NOVO NO `native.js`, sempre: ele REMONTA o objeto campo a campo, e
     * `optBoolean`/`optLong` leem ausente como `false`/`0` — valores legítimos,
     * sem exceção e sem log. Foi assim que `bytes` passou dezenove versões sem
     * viajar, e a notificação mostrou BYTES como se fossem ITENS.
     *
     * `items` traz UM nome em destaque. São 6 downloads simultâneos, mas o lado
     * web manda um de cada vez, tirado de uma FILA (FIFO) dos itens que já
     * entraram em download: cada nome sai uma ÚNICA vez, em ordem, no ritmo
     * médio medido por item (`bgItemStart`/`bgSpinMs`). Não é rodízio entre os
     * itens em voo — rodízio traria o mesmo nome de volta e a lista não iria a
     * lugar nenhum — nem espelho do que está no ar: é ilustrativo, e CONGELA
     * quando a tarefa passa de 90 s sem evento real. Continua sendo lista só por
     * compatibilidade com bundles anteriores à v5.13.
     *
     * `idleMs` é há quanto tempo NADA acontece: separa "travado" de "esta faixa
     * é grande", que na tela são a mesma coisa parada.
     */
    @JavascriptInterface
    fun bgProgress(json: String) {
        // Só o Controle, como os onze irmãos que já recusam com `host == null`:
        // Só o Controle, como os onze irmãos que já recusam com `host == null`:
        // a notificação de download não pode ser FALSIFICÁVEL a partir do
        // WebView do telão — é o Controle quem baixa, então é só dele que o
        // progresso pode vir.
        if (host == null) return
        val o = try { JSONObject(json) } catch (e: Exception) { return }
        val arr = o.optJSONArray("items")
        val itens = buildList {
            for (i in 0 until (arr?.length() ?: 0)) {
                arr?.optString(i)?.takeIf { it.isNotBlank() }?.let { add(it) }
            }
        }
        SyncService.updateProgress(
            ctx,
            label = o.optString("label"),
            done = o.optLong("done"),
            total = o.optLong("total"),
            etaMs = o.optLong("etaMs"),
            items = itens,
            idleMs = o.optLong("idleMs"),
            // `bytes` (v5.118): quando ligado, `done`/`total` são BYTES e não
            // itens — é o que dá barra e estimativa a um download único, que é
            // justamente o caso em que a notificação é a única janela. Ver
            // `SyncService.formatBytes` e `bgTaskStart` no lado web.
            //
            // `Long` desde agora, e não `Int`: um vídeo de 1080p passa
            // folgadamente dos 2 GB que o `Int` comporta, e o estouro sairia
            // como uma barra andando para trás.
            bytes = o.optBoolean("bytes"),
        )
    }

    /**
     * O que está no ar, para a notificação de controles e a sessão de mídia
     * (ver [SessionService]). Vem do lado web porque é lá que o estado mora —
     * o mesmo princípio de [bgProgress].
     *
     * `active:false` significa "nada em cena": derruba o serviço, e a
     * notificação some junto. É o lado web que decide isso, não um palpite
     * daqui sobre o que seria "tocando".
     */
    @JavascriptInterface
    fun nowPlaying(json: String) {
        // Só o Controle, como os onze irmãos com guarda de `host`. O WebView do
        // telão carrega script de terceiro por design, e este método DERRUBA o
        // [SessionService] com um `active:false` — justamente o serviço
        // `mediaPlayback` que impede o processo (e a Presentation) de ser morto
        // sob pressão de memória. Como o lado web deduplica por chave e não
        // reenvia estado igual, o serviço derrubado ficaria derrubado.
        if (host == null) return
        val o = try { JSONObject(json) } catch (e: Exception) { return }
        if (!o.optBoolean("active")) {
            SessionService.stop(ctx)
            return
        }
        SessionService.update(
            ctx,
            SessionService.Companion.Scene(
                title = o.optString("title").ifBlank { "Em exibição" },
                subtitle = o.optString("subtitle"),
                playing = o.optBoolean("playing"),
                slideMode = o.optBoolean("slideMode"),
                slideLabel = o.optString("slideLabel"),
                wallpaper = o.optBoolean("wallpaper"),
                positionMs = o.optLong("positionMs"),
                durationMs = o.optLong("durationMs"),
                // OS BOTÕES DA NOTIFICAÇÃO, escolhidos pelo lado web (v5.231 /
                // shell 42) — ver [SessionService.Companion.Scene.actions].
                // Ausente ou vazio = o conjunto clássico de cinco, que é o que
                // um bundle antigo neste shell tem de continuar produzindo.
                actions = o.optJSONArray("actions")?.let { arr ->
                    (0 until arr.length()).mapNotNull { i ->
                        arr.optString(i, "").takeIf { it.isNotBlank() }
                    }
                } ?: emptyList(),
            ),
        )
    }

    // ---------- telas ----------

    @JavascriptInterface
    fun displays(callId: String) {
        val list = host?.listDisplays() ?: JSONArray()
        resolve(callId, list.toString())
    }

    /**
     * Botão de cast da preview: abre o seletor de **espelhamento de tela**
     * (Smart View / Wireless display), não o Google Cast — ver
     * [BridgeHost.openCastPicker], que explica por que os dois não são a mesma
     * coisa e como o alvo é escolhido.
     */
    @JavascriptInterface
    fun openCast() {
        host?.openCastPicker()
    }

    /**
     * Abre uma URL fora do app — hoje a busca do YouTube oferecida no fim da
     * busca do acervo, quando a música não está no LouvorJA.
     *
     * **Só `https`, e a decisão é aqui.** Este método é chamado de JavaScript,
     * e um `ACTION_VIEW` aceita muito mais do que web: `intent://`,
     * `content://`, esquemas de outros apps. Deixar o esquema livre
     * transformaria a ponte num disparador genérico de intents a partir de
     * qualquer script que rodasse no WebView. O `native.js` também filtra, mas
     * ali é conveniência — a guarda que vale é esta, porque `__AVBridge` é
     * alcançável sem passar por ele.
     *
     * O WebView do telão recebe a ponte com `host = null` e não chega aqui.
     */
    @JavascriptInterface
    fun openExternal(url: String) {
        val u = try { Uri.parse(url) } catch (_: Exception) { return }
        if (!u.scheme.equals("https", ignoreCase = true) || u.host.isNullOrBlank()) return
        host?.openExternalUrl(u.toString())
    }

    // ---------- telão nas telas da rede local ----------
    //
    // Os NOVE métodos deste bloco NÃO vão para fila nenhuma, e essa é a decisão
    // que os separa do resto da ponte. Cada fila é de uma thread ÚNICA
    // compartilhada por todas as instâncias, e é na [transferencia] que roda o
    // download do YouTube: um vídeo de 380 MB a segura por minutos. Enfileirado,
    // "ligar a transmissão" no meio de um download não aconteceria — a Promise
    // venceria pelo prazo de 60 s do `native.js` e resolveria `null`, um "erro"
    // sem causa no toque de um botão.
    // Mesmo raciocínio já publicado para o `ytCancel`.
    //
    // Onde o trabalho ACONTECE são TRÊS lugares, não um (ver [BridgeHost]):
    //  · [espelhoLigar], [espelhoLigarEm], [espelhoEstado], [espelhoDiag] e
    //    [espelhoDerrubar]
    //    saltam para a MAIN THREAD (`runOnUiThread`), que é a trava com que a
    //    `MainActivity` serializa `espelhoSrv`/`espelhoMidia`. Não é mais o
    //    requisito de `Looper` do espelho de pixels — aquele criava uma
    //    `Presentation`, que é um `Dialog`, e saiu na v5.187.
    //  · [espelhoDesligar] fica na thread do WebView, de propósito: quem
    //    responde são os laços de cliente do [EspelhoServidor], e enfileirar a
    //    desistência atrás do que se quer parar é o oposto de parar (a lição do
    //    `ytCancel`).
    //  · os três de certificado abrem THREAD PRÓPRIA (`av-cert`) — ler o `.p12`
    //    do SAF e reescrever o PKCS12 é disco e cripto.
    //
    // E é por [espelhoDesligar] escrever `espelhoSrv`/`espelhoMidia` FORA da
    // main thread que os dois campos são `@Volatile`: a anotação não é
    // redundante com a main thread, é o que torna essa escrita segura.
    //
    // Todos guardados por `host != null`: superfície nativa é privilégio do
    // Controle (invariante 9). O WebView do telão recebe a ponte com
    // `host = null`, e sem a guarda um script rodando lá dentro ligaria e
    // desligaria o servidor da rede da igreja.

    /**
     * LIGA o espelho e resolve o estado resultante (o MESMO objeto do
     * [espelhoEstado], com `erro` não-vazio quando não deu).
     *
     * Sem argumentos: o shell escolhe a rede (a melhor da lista, ponto de
     * acesso na frente). Quem quer ESCOLHER usa o [espelhoLigarEm].
     * Ver [BridgeHost.startMirror].
     *
     * O espelho é AUXILIAR por contrato: ele liga por ação do operador e
     * desliga por ação do operador, pelo fechamento do app, ou por uma falha que
     * o app nomeia em texto. Uma TV que conecta não o derruba — e ligar COM a TV
     * já conectada é uma pergunta que o lado web faz antes de chegar aqui.
     */
    @JavascriptInterface
    fun espelhoLigar(callId: String) {
        val h = host
        if (h == null) { resolve(callId, "null"); return }
        h.startMirror("") { estado -> resolve(callId, estado.toString()) }
    }

    /**
     * LIGA NUMA REDE ESCOLHIDA — o irmão ADITIVO do [espelhoLigar] (shell 57).
     *
     * Ele existe porque um aparelho pode ter duas redes servíveis ao mesmo
     * tempo (a Wi-Fi da igreja e o próprio ponto de acesso, num rádio duplo), e
     * qual delas as telas alcançam **não é decidível daqui**: quem sabe onde o
     * computador está conectado é a pessoa. O `espelhoLigar` FICA, e é o
     * caminho de todo aparelho com uma rede só.
     *
     * ADITIVO, e não uma assinatura trocada: encolher ou mudar a forma de um
     * método existente faz o bundle novo chamar contra um APK que ainda tem a
     * forma velha, e o recurso morre sem nada na tela que o explique.
     *
     * **Guardado por `host != null` como os outros — invariante 9: este método
     * abre um servidor na rede da igreja.**
     */
    @JavascriptInterface
    fun espelhoLigarEm(callId: String, ip: String) {
        val h = host
        if (h == null) { resolve(callId, "null"); return }
        h.startMirror(ip) { estado -> resolve(callId, estado.toString()) }
    }

    /**
     * DESLIGA o espelho.
     *
     * Sem `callId` e sem espera, como o [ytCancel]: do outro lado isto escreve
     * um campo `@Volatile` e volta — quem responde são os laços que o consultam
     * (as threads de cliente). Segurar a Promise pelo tempo de soltar os
     * sockets e o fan-out daria um botão travado justamente no caminho de
     * desistir. O desfecho aparece no
     * [espelhoEstado] seguinte.
     */
    @JavascriptInterface
    fun espelhoDesligar() {
        host?.stopMirror()
    }

    /**
     * O estado do espelho para a folha do Controle. O produtor é
     * [MainActivity.mirrorJson], e ele põe exatamente
     * `{ ligado, endereco, erro, telas[] }` — sem `codigo` desde o shell 38 (a
     * porta é o ENDEREÇO) e sem pendentes desde o shell 36 (não há fila de
     * aprovação). Cada tela: `{ rotulo, comando, conectadaMs, telaAcesaMin,
     * aviso, eventos, pronta, fila }` — os seis campos de capacidade saíram no
     * shell 44, por terem ficado sem produtor.
     *
     * DADO, não frase — a mesma regra do [otaDiag] e do [ytDiag] levada ao
     * limite: aqui o Kotlin devolve JSON e quem escreve o texto é o
     * `controle.js` (invariante 5). Um Kotlin que formatasse parágrafos seria
     * UI de diagnóstico escrita do lado errado.
     */
    @JavascriptInterface
    fun espelhoEstado(callId: String) {
        val h = host
        if (h == null) { resolve(callId, "null"); return }
        h.mirrorState { estado -> resolve(callId, estado.toString()) }
    }

    /**
     * O anel de diagnóstico do espelho — o diário mais `ligado`, `servidor` e
     * `servico` ([MainActivity.mirrorDiag]) —, em JSON, pelo mesmo motivo do
     * [espelhoEstado]. Vira um BLOCO do Registro, nunca uma caixa nova.
     */
    @JavascriptInterface
    fun espelhoDiag(callId: String) {
        val h = host
        if (h == null) { resolve(callId, "null"); return }
        h.mirrorDiag { diag -> resolve(callId, diag.toString()) }
    }

    /**
     * DERRUBAR UMA TELA — a única coisa que este método faz, e agora o nome
     * diz isso.
     *
     * `rotulo` é o da tela ("tela B"), o único identificador que a lista do
     * operador tem; rótulo em branco é RECUSADO, e não vale "todas".
     *
     * NÃO HÁ PIN NEM FILA DE PENDENTES: a porta é o ENDEREÇO na rede, e o
     * controle real é o teto de 3 sessões mais este derrubar, com castigo de
     * 2 min (ver [EspelhoPares]). Ver [MainActivity.derrubarTela].
     */
    @JavascriptInterface
    fun espelhoDerrubar(callId: String, rotulo: String) {
        val h = host
        if (h == null) { resolve(callId, "false"); return }
        h.derrubarTela(rotulo) { ok -> resolve(callId, if (ok) "true" else "false") }
    }

    /**
     * O CERTIFICADO DO ESPELHO — importar, consultar, apagar.
     *
     * Três métodos e não um: importar precisa de dois argumentos e devolve uma
     * FRASE de erro, consultar é chamado a cada abertura da folha, e apagar é
     * destrutivo. Espremê-los num só com um verbo em string produziria
     * exatamente o tipo de API que o próprio `espelhoDerrubar` evita ter: ele
     * faz UMA coisa, e o nome diz qual. Aqui são três atos.
     *
     * **Privilégio do Controle** (`host != null`), como os cinco irmãos: o
     * telão e o espelho carregam código de terceiro por design, e importar uma
     * chave privada é a última coisa que eles deveriam poder pedir.
     *
     * A senha vai por argumento e **não é guardada**: o [EspelhoCert] reescreve
     * o `.p12` com uma senha nossa e descarta a do operador (ver o KDoc de lá).
     */
    @JavascriptInterface
    fun espelhoCertImportar(callId: String, origem: String, senha: String) {
        val h = host
        if (h == null) { resolve(callId, "\"sem host\"") ; return }
        h.mirrorCertImport(origem, senha) { erro -> resolve(callId, JSONObject.quote(erro)) }
    }

    @JavascriptInterface
    fun espelhoCertEstado(callId: String) {
        val h = host
        if (h == null) { resolve(callId, "null"); return }
        h.mirrorCertState { json -> resolve(callId, json.toString()) }
    }

    @JavascriptInterface
    fun espelhoCertApagar(callId: String) {
        val h = host
        if (h == null) { resolve(callId, "false"); return }
        h.mirrorCertRemove { resolve(callId, "true") }
    }

    // ---------- vídeo do YouTube como ARQUIVO ----------

    /**
     * Baixa um vídeo do YouTube no aparelho e devolve
     * `{ url, name, size, type }` — com `url` servível pelo mesmo `/saf/` das
     * pastas do dispositivo. O lado web faz `fetch` + `Blob` sem saber de onde
     * veio; ver [YoutubeGrab] para o porquê de a extração ser NATIVA.
     *
     * Roda na fila de TRANSFERÊNCIA, nunca na de [io]: é rede e parsing, e um
     * vídeo leva minutos — ver o KDoc de [transferencia] para o que a mistura
     * quebrava (`listFolder` vencendo o prazo de 60 s do `native.js`). O
     * andamento vai por `window.__avYtProgress(id, lidos, total)` — sem isso o
     * operador ficaria olhando um cartão parado durante todo o download.
     */
    @JavascriptInterface
    fun ytFetch(callId: String, url: String) = ytFetchInterno(callId, url, false)

    /**
     * PARA o download deste link, se ele for o que está em curso.
     *
     * **NÃO vai para fila nenhuma** — e não poderia: a [transferencia] é de uma
     * thread só e está ocupada justamente pelo download que se quer parar. Enfileirar o
     * cancelamento o faria rodar depois de o download terminar, que é o oposto
     * de cancelar. Escrever um campo `@Volatile` da thread do WebView é seguro e
     * imediato; quem responde é o laço de cópia, que o consulta a cada bloco.
     *
     * Sem `callId`: não há o que devolver. O resultado chega pelo caminho de
     * sempre — a Promise do `ytFetch` resolve `null`, como em qualquer falha —,
     * e quem sabe que a causa foi um cancelamento é o lado web, que o pediu.
     *
     * Só o Controle (`host != null`): o telão não baixa nada, logo não tem o que
     * cancelar.
     */
    @JavascriptInterface
    fun ytCancel(url: String) {
        if (host == null) return
        YoutubeGrab.cancelar(url)
    }

    /**
     * O mesmo, mas baixando **só a faixa de áudio** (m4a) — o louvor de fundo,
     * o instrumental da oração, o que não tem por que ocupar o telão.
     *
     * MÉTODO SEPARADO, e não um parâmetro a mais no [ytFetch]: a ponte casa o
     * método pelo NOME e pela quantidade de argumentos, então mudar a assinatura
     * do `ytFetch` quebraria o download inteiro num shell antigo que recebesse o
     * bundle novo por OTA — e "sem YouTube nenhum" é muito pior que "sem a opção
     * de áudio". Assim o shell antigo continua baixando vídeo, e o lado web só
     * oferece a escolha quando `__SHELL_VERSION__` já a tem (ver `openYtMenu`).
     */
    @JavascriptInterface
    fun ytFetchAudio(callId: String, url: String) = ytFetchInterno(callId, url, true)

    /**
     * Vídeo com **teto de resolução escolhido pelo operador** (1080p · 720p ·
     * 480p, na folha de download).
     *
     * TERCEIRO MÉTODO, pelo mesmo motivo que existe o [ytFetchAudio]: a ponte
     * casa o método por nome **e aridade**, então acrescentar o parâmetro ao
     * [ytFetch] deixaria todo download quebrado num shell antigo que recebesse o
     * bundle novo por OTA. Aqui a degradação é a certa — sem este método o lado
     * web nem desenha o seletor e continua chamando o [ytFetch] de sempre, que
     * baixa no padrão de [YoutubeGrab.TETO_ALTURA].
     *
     * E é por isso que o lado web só usa este caminho quando o operador escolhe
     * um teto MENOR que o padrão: pedir 1080p pelo `ytFetch` comum funciona em
     * qualquer shell, então não há razão para exigir um APK novo de quem quer o
     * comportamento de sempre.
     */
    @JavascriptInterface
    fun ytFetchAte(callId: String, url: String, altura: Int) =
        ytFetchInterno(callId, url, false, altura)

    private fun ytFetchInterno(
        callId: String,
        url: String,
        somenteAudio: Boolean,
        teto: Int = YoutubeGrab.TETO_ALTURA,
    ) {
        if (host == null) { resolve(callId, "null"); return }   // telão não baixa nada
        transferencia.execute {
            // O teto é SANEADO aqui, não lá dentro: este parâmetro vem de
            // JavaScript, e um 0 (ou um negativo) esvaziaria a fila de
            // candidatos e derrubaria o download inteiro num caminho que
            // pareceria "vídeo indisponível".
            val alvo = teto.coerceIn(144, YoutubeGrab.TETO_ALTURA)
            // O DOWNLOAD ÓRFÃO, RECLAMADO: se o renderer morreu no meio, o
            // arquivo terminou aqui e ninguém o recebeu. A página nova pede o
            // mesmo download outra vez e leva o resultado guardado, sem rede e
            // sem esperar (ver `YoutubeGrab.resgatar`).
            val resgatado = try {
                YoutubeGrab.resgatar(url, somenteAudio, alvo)
            } catch (_: Exception) { null }
            val r = resgatado ?: try {
                YoutubeGrab.buscar(ctx, url, somenteAudio, alvo) { lidos, total ->
                    ytProgresso(callId, lidos, total)
                }
            } catch (_: Exception) { null }
            resolve(callId, r?.toString() ?: "null")
        }
    }

    /**
     * O MANIFESTO da transmissão direta de um vídeo do YouTube: as duas faixas
     * adaptativas e seus byte-ranges, com URLs servíveis pelo próprio origin do
     * app (ver [StreamProxy]).
     *
     * Devolve `null` quando não há par adaptativo transmissível — e aí o lado
     * web cai no que já existia (baixar, ou o player embutido). É esse `null`
     * que torna o recurso inteiro opcional: nenhum caminho que funciona hoje
     * depende dele.
     *
     * **Privilégio do Controle**, como toda a superfície com `host`. O telão
     * não monta manifesto: ele recebe o já montado pelo registro da mídia, do
     * mesmo IndexedDB compartilhado, e só CONSOME os `/stream/` — que é o que
     * ele precisa para projetar.
     *
     * `altura <= 0` significa "o padrão" ([YoutubeGrab.TETO_ALTURA]) — a mesma
     * convenção do [ytFetch], em que não pedir teto nenhum é pedir o máximo.
     */
    @JavascriptInterface
    fun ytStream(callId: String, url: String, altura: Int) {
        if (host == null) { resolve(callId, "null"); return }
        extracao.execute {
            // `altura <= 0` é "o padrão", como no [ytFetch]: um `coerceIn`
            // sozinho fazia de um 0 vindo do JavaScript um TETO de 144p — o
            // oposto do pedido, e um caminho que pareceria "vídeo péssimo" em
            // vez de erro.
            val alvo = if (altura <= 0) YoutubeGrab.TETO_ALTURA
            else altura.coerceIn(144, YoutubeGrab.TETO_ALTURA)
            val r = try {
                YoutubeGrab.manifesto(url, alvo)
            } catch (_: Exception) { null }
            resolve(callId, r?.toString() ?: "null")
        }
    }

    /**
     * Busca no YouTube, de dentro do app — devolve uma lista de
     * `{ id, url, name, author, seconds, thumb }`. Ver [YoutubeGrab.pesquisar]
     * para por que isto não pode ser um iframe nem a API oficial.
     */
    @JavascriptInterface
    fun ytSearch(callId: String, termo: String) {
        if (host == null) { resolve(callId, "[]"); return }
        extracao.execute {
            val r = try { YoutubeGrab.pesquisar(termo) } catch (_: Exception) { JSONArray() }
            resolve(callId, r.toString())
        }
    }

    /**
     * As PLAYLISTS que um canal publica — `[{ name, url, count }]`.
     *
     * A metade de descoberta das SÉRIES da Biblioteca (shell 41). É a aba
     * Playlists do canal, **não uma busca por texto**, e a diferença é de
     * autoridade: numa busca quem escolhe é o ranking do YouTube, e qualquer
     * pessoa pode nomear uma playlist "Provai e Vede 2026". Vindo do canal, o
     * pior caso é uma playlist a menos — nunca o vídeo de um desconhecido na
     * projeção do culto.
     *
     * Sem opinião sobre o conteúdo: quem lê os nomes é o `serie.js`.
     */
    @JavascriptInterface
    fun ytCanalPlaylists(callId: String, canalUrl: String) {
        if (host == null) { resolve(callId, "[]"); return }
        extracao.execute {
            val r = try { YoutubeGrab.playlistsDoCanal(canalUrl) } catch (_: Exception) { JSONArray() }
            resolve(callId, r.toString())
        }
    }

    /**
     * Os vídeos de UMA playlist — `{ name, author, items:[…] }`.
     *
     * O `name` de cada item é o título CRU do YouTube, sem o `tituloLimpo` que
     * a busca aplica: é dele que o `serie.js` tira a data do episódio
     * (`(15/Ago)`) e a marca de Libras, e cortar antes de entregar seria
     * decidir do lado errado do fio.
     */
    @JavascriptInterface
    fun ytPlaylist(callId: String, url: String) {
        if (host == null) { resolve(callId, "null"); return }
        extracao.execute {
            val r = try { YoutubeGrab.playlist(url) } catch (_: Exception) { null }
            resolve(callId, r?.toString() ?: "null")
        }
    }

    /**
     * OS DADOS DE UM VÍDEO, sob demanda — `{ titulo, canal, seconds, descricao }`
     * ou `null` (shell 62).
     *
     * A metade do card de detalhe que NÃO cabe no índice da série: título,
     * canal e duração a listagem de playlist já entrega e o `serie.js` os
     * guarda (valem offline); a DESCRIÇÃO só existe extraindo o vídeo, uma
     * requisição por vídeo. Ver [YoutubeGrab.detalhes] — inclusive por que o
     * campo `descricao` é **sempre texto simples**, e por que o TIPO original
     * não viaja.
     *
     * **UM TOQUE, e é isso que o autoriza a morar na [extracao].** Ela é de UMA
     * thread, e trabalho de MASSA aqui empurra todo "Tocar agora" para além dos
     * 60 s do `call()` — foi por isso que a cifra ganhou fila própria. Quem
     * chama este método é o botão "Ver os detalhes" de UMA linha, com cache em
     * memória do outro lado: nunca a montagem de uma lista, nunca uma varredura
     * de álbum. As outras três filas estão fora por eliminação: [io] é a de
     * MILISSEGUNDOS (rede ali é o defeito que faz o `listFolder` mentir lista
     * vazia), [transferencia] é de MINUTOS e o download em curso seguraria o
     * toque, e [cifra] é a fila da varredura.
     *
     * `null` no papel `display` (invariante 9): o telão não tem card de detalhe
     * nem lista de acervo, e a superfície nativa é privilégio do Controle.
     */
    @JavascriptInterface
    fun ytDetalhes(callId: String, url: String) {
        if (host == null) { resolve(callId, "null"); return }
        extracao.execute {
            val r = try { YoutubeGrab.detalhes(url) } catch (_: Exception) { null }
            resolve(callId, r?.toString() ?: "null")
        }
    }

    /**
     * O QUE O EXTRATOR DEVOLVEU na última extração, em uma linha — para o
     * rodapé de Configurações. Diagnóstico, não recurso.
     *
     * A pergunta que ele responde não se responde lendo código: sem PO Token a
     * biblioteca busca os streams por um endpoint que devolve um conjunto
     * reduzido de formatos, e o que cabe nesse conjunto varia por vídeo. Saber
     * se as faixas ADAPTATIVAS (1080p e o áudio puro moram nelas) chegam a este
     * aparelho é o que decide se vale implementar o remux — e só o aparelho
     * responde.
     *
     * String vazia antes da primeira extração.
     */
    @JavascriptInterface
    fun ytDiag(callId: String) {
        // `JSONObject.quote` e não uma concatenação com aspas: o texto é montado
        // a partir do que o YouTube devolveu, e é ele que vai INLINE dentro de
        // um `evaluateJavascript` (ver `resolve`).
        // OS DOIS CAMINHOS, em linhas separadas. A transmissão direta e o
        // download escrevem em campos diferentes de propósito (ver
        // `diagnosticoStream`): quando a primeira desiste, o segundo roda em
        // seguida, e com um campo só o motivo da desistência era apagado pela
        // linha do download — o log dizia o que aconteceu depois, nunca por quê.
        //
        // Multi-linha não incomoda ninguém: do lado web isto vai para dentro de
        // um `<pre>` que rola (o "Registro" de Configurações).
        val texto = if (host == null) "" else buildString {
            YoutubeGrab.diagnosticoStream.takeIf { it.isNotEmpty() }?.let {
                append("transmissão: ").append(it)
            }
            YoutubeGrab.diagnostico.takeIf { it.isNotEmpty() }?.let {
                if (isNotEmpty()) append('\n')
                append("download: ").append(it)
            }
        }
        resolve(callId, JSONObject.quote(texto))
    }

    /**
     * A PÁGINA DE CIFRA, CRUA — `{ status, html }` (shell 48).
     *
     * O transporte da aba de cifra do visualizador de letras, e **só o
     * transporte**: quem sabe ler o HTML é `controle/cifra.js`. A razão de a
     * busca sair do Kotlin em vez de um `fetch()` da página é CORS — ver o
     * KDoc de [CifraFonte], que também guarda as guardas (host travado,
     * `https`, teto de bytes, prazos).
     *
     * **Os dois campos do retorno respondem perguntas diferentes**, e é por
     * isso que não é uma string: `status 0` é "não houve resposta" (sem rede,
     * prazo vencido) e `status 404` é "o site respondeu que não tem". A aba
     * diz coisas opostas nos dois casos — e um retorno único as tornaria
     * indistinguíveis, que é o modo de falhar que este projeto chama de mentir
     * baixinho.
     *
     * Na fila [cifra], que é dela e de mais ninguém. Em `io` ela travaria a
     * fila de que `listFolder`, `otaPending` e `atualizacaoEstado` dependem;
     * em `transferencia` ela esperaria um download de minutos para responder a
     * um toque numa aba; e na [extracao] a VARREDURA do acervo põe seis
     * páginas na frente do `ytStream` de um "Tocar agora", que assim vence os
     * 60 s do `call()` e cai no download, calado. Ver o KDoc das duas filas.
     *
     * **Privilégio do Controle** (`host == null` no telão): sem a guarda,
     * qualquer script no documento do Display ganharia um cliente HTTP de
     * saída rodando com o IP do aparelho.
     */
    @JavascriptInterface
    fun cifraHtml(callId: String, url: String) {
        if (host == null) { resolve(callId, "null"); return }
        cifra.execute {
            val (status, html) = try {
                CifraFonte.buscar(url)
            } catch (_: Exception) {
                0 to ""
            }
            resolve(
                callId,
                JSONObject().put("status", status).put("html", html).toString(),
            )
        }
    }

    /**
     * O que a última busca de cifra recebeu — a linha "Cifra:" do Registro.
     *
     * Vazio antes da primeira busca e num papel sem host. Como todo diagnóstico
     * deste app, ele guarda o VEREDITO de quem decidiu ([CifraFonte.buscar]) e
     * não uma segunda opinião montada aqui: quem escreve a frase é o
     * `controle.js`.
     */
    @JavascriptInterface
    fun cifraDiag(callId: String) {
        val texto = if (host == null) "" else CifraFonte.ultimaTentativa
        resolve(callId, JSONObject.quote(texto))
    }

    /**
     * Apaga o arquivo intermediário depois que o lado web copiou os bytes para
     * a biblioteca. Sem isto o vídeo ficaria duas vezes no aparelho.
     */
    @JavascriptInterface
    fun ytDiscard(url: String) {
        if (host == null) return
        transferencia.execute { YoutubeGrab.descartar(ctx, url) }
    }

    // ---------- apresentação (PDF / Google Apresentações) como IMAGENS ----------

    /**
     * Rasteriza uma apresentação e devolve `{ name, pages: [url] }` — uma
     * imagem por página, servível pelo mesmo `/saf/` das pastas do dispositivo.
     * Ver [SlideDeck] para por que o caminho é o PDF e por que ele é nativo.
     *
     * `origem` é o `/saf/<token>` de um PDF que chegou ao app, ou a URL de
     * exportação de uma apresentação do Google (que o próprio Kotlin baixa: o
     * `fetch` do WebView esbarraria no CORS do Google).
     *
     * Roda na fila de EXTRAÇÃO, nunca na de [io] — é disco, rede e
     * rasterização —, e o andamento vai
     * por `window.__avDeckProgress(id, feitas, total)`: uma apresentação de
     * dezenas de páginas leva segundos, e um cartão parado não diz se está
     * andando.
     */
    @JavascriptInterface
    fun deckPages(callId: String, origem: String, nome: String) {
        if (host == null) { resolve(callId, "null"); return }   // telão não importa nada
        extracao.execute {
            // O motivo da falha viaja junto (`{ erro }`) — ver SlideDeck.paginas.
            val r = try {
                SlideDeck.paginas(ctx, origem, nome) { feitas, total ->
                    deckProgresso(callId, feitas, total)
                }
            } catch (e: Exception) {
                JSONObject().put("erro", "ponte: " + e.javaClass.simpleName)
            }
            resolve(callId, r.toString())
        }
    }

    /**
     * A URL de exportação em PDF de uma apresentação do Google, ou `""` se o
     * link não for uma. Quem decide é o Kotlin porque é ele que sabe o que
     * consegue abrir — o lado web só pergunta.
     */
    @JavascriptInterface
    fun deckExportUrl(link: String): String = SlideDeck.urlDeExportacao(link) ?: ""

    /**
     * Apaga as páginas intermediárias depois que o lado web as copiou para a
     * biblioteca. Mesmo motivo do [ytDiscard]: sem isto a apresentação ficaria
     * duas vezes no aparelho.
     */
    @JavascriptInterface
    fun deckDiscard(url: String) {
        if (host == null) return
        extracao.execute { SlideDeck.descartar(ctx, url) }
    }

    private fun deckProgresso(callId: String, feitas: Int, total: Int) {
        val web = webRef() ?: return
        val id = JSONObject.quote(callId)
        web.post {
            web.evaluateJavascript(
                "window.__avDeckProgress && window.__avDeckProgress($id, $feitas, $total);",
                null,
            )
        }
    }

    private fun ytProgresso(callId: String, lidos: Long, total: Long) {
        val web = webRef() ?: return
        val id = JSONObject.quote(callId)
        web.post {
            web.evaluateJavascript(
                "window.__avYtProgress && window.__avYtProgress($id, $lidos, $total);",
                null,
            )
        }
    }

    /**
     * Para onde `openCast()` vai abrir, em texto. O popup de Exibição mostra
     * isso: os alvos de espelhamento variam por fabricante e não são API
     * documentada, então o operador precisa poder ver o que o aparelho tem.
     */
    @JavascriptInterface
    fun castTarget(callId: String) {
        resolve(callId, JSONObject().put("label", host?.describeCastTarget() ?: "").toString())
    }

    // ---------- botões físicos de volume ----------

    /**
     * Pede que a Activity intercepte os botões de volume e os entregue ao
     * Controle (`window.__avVolumeKey`). Ligado pelo lado web só depois de
     * carregar — ver [BridgeHost.setCaptureVolumeKeys].
     */
    @JavascriptInterface
    fun captureVolumeKeys(on: Boolean) {
        host?.setCaptureVolumeKeys(on)
    }

    // ---------- a preview que É a projeção ----------

    /**
     * **Sem tela conectada, quem projeta é o `<video>` da PREVIEW**, no WebView
     * do Controle — e o Chromium pausa o `<video>` de uma página oculta. Com o
     * app minimizado, o louvor calava.
     *
     * Isto é o caminho que `docs/arquitetura/DISPLAY.md` deixou escrito para
     * este dia, palavra por palavra: *"se um dia o louvor calar ao minimizar o
     * app com o som saindo do celular, é aqui que a resposta começa, e o caminho
     * é o `manterVisivel` + `RENDERER_PRIORITY_IMPORTANT`"*. As três correções
     * anteriores da mesma família (v1.26, v1.27, v1.28) protegiam o WebView do
     * TELÃO; esta protege o outro, e só quando ele é a projeção.
     *
     * **A DECISÃO É DO LADO WEB** (invariante 5), e não podia ser de outro: só
     * ele sabe se há TV, se há tela na rede e se há cena no ar. O shell recebe
     * um fato já apurado e responde com o que só ele pode fazer.
     *
     * **E ELA É CONDICIONAL, não permanente.** Com telão conectado o Controle
     * DEVE ser estrangulado em segundo plano — ele é a mesa de comando, o som
     * está na TV, e é justamente o que o `snoopDisplayStatus` existe para
     * contornar. Ligar isto sempre trocaria um defeito por um consumo.
     */
    @JavascriptInterface
    fun projecaoLocal(on: Boolean) {
        host?.setProjecaoLocal(on)
    }

    /**
     * Válvula de escape: com o fader do app já no máximo (ou no zero), a
     * tecla volta a valer para o volume do sistema. Sem isto, um aparelho com
     * o volume de mídia baixo ficaria sem como subir com o app aberto.
     */
    @JavascriptInterface
    fun systemVolume(step: Int) {
        host?.adjustSystemVolume(step)
    }

    // ---------- tema (claro × escuro) ----------

    /**
     * O tema escolhido em Configurações. A cor de tudo é decidida pelo CSS
     * (`shared/tokens.css`); o que sobra para o shell são as duas coisas que uma
     * folha de estilo não alcança:
     *
     * 1. **Os ÍCONES das barras de sistema.** Com `targetSdk` 35 o Android força
     *    edge-to-edge e IGNORA `statusBarColor`/`navigationBarColor` (ver
     *    `res/values/themes.xml`): quem pinta o FUNDO atrás das barras é o body
     *    da base web, com `--bg`. Mas relógio, bateria e botões de navegação
     *    seguem sendo desenhados pelo sistema, e a cor deles vem de
     *    `APPEARANCE_LIGHT_STATUS_BARS`. Sem virar essa chave, o tema claro fica
     *    com ícones brancos sobre fundo quase branco.
     * 2. **O `windowBackground`**, o que aparece ANTES de o WebView carregar. É
     *    recurso do APK, resolvido antes de existir JavaScript: o shell GUARDA a
     *    escolha e a aplica no lançamento seguinte. Trocar de tema tem, portanto,
     *    um lançamento de atraso nesse detalhe — e só nele.
     *
     * Privilégio do Controle por construção: quem responde é a Activity, e o
     * WebView do telão nasce com `host = null` (invariante 9).
     */
    @JavascriptInterface
    fun temaClaro(on: Boolean) {
        host?.setTemaClaro(on)
    }

    // ---------- microfone (push-to-talk) ----------

    /**
     * Garante a permissão `RECORD_AUDIO` do Android antes de o lado web
     * chamar `getUserMedia`. Sem ela, o [MicChromeClient] nega o pedido do
     * WebView de propósito — conceder ao WebView uma permissão que o processo
     * não tem só adiaria a falha para um ponto sem sinal claro.
     */
    @JavascriptInterface
    fun requestMic(callId: String) {
        val h = host
        if (h == null) { resolve(callId, "false"); return }
        h.requestMicPermission { granted -> resolve(callId, if (granted) "true" else "false") }
    }

    // ---------- compartilhamento (substitui o share_target do SW) ----------

    @JavascriptInterface
    fun takeShare(callId: String) {
        val share = host?.takePendingShare()
        resolve(callId, share?.toString() ?: "null")
    }

    /**
     * O link copiado, quando ele é NOVO — ver [BridgeHost.readClipboardUrl] para
     * o contrato e para o porquê do carimbo.
     *
     * **Fora de qualquer fila**, como os métodos do telão por comandos, e pelo
     * mesmo motivo somado a outro: é trabalho de microssegundos que não pode
     * esperar atrás de um download de 380 MB (venceria o prazo de 60 s e
     * resolveria `null`, que aqui é indistinguível de "não havia link"), e o
     * `ClipboardManager` precisa de uma thread com `Looper` — a fila `io` é uma
     * `Thread` daemon sem um.
     *
     * `host == null` (o WebView do telão) resolve `null`: invariante 9. Sem a
     * guarda, um script de terceiro naquele documento leria a área de
     * transferência do aparelho.
     *
     * `desde` chega como STRING de propósito: o carimbo é um `long` em
     * milissegundos e o `@JavascriptInterface` converte número de JS por
     * `double` — o texto atravessa sem intermediário que arredonde.
     */
    @JavascriptInterface
    fun areaTransferencia(callId: String, desde: String) {
        val h = host
        if (h == null) { resolve(callId, "null"); return }
        h.readClipboardUrl(desde.toLongOrNull() ?: 0L) { obj ->
            resolve(callId, obj?.toString() ?: "null")
        }
    }

    // ---------- pastas do dispositivo (SAF) ----------

    /**
     * Substitui `showDirectoryPicker()`, que **não existe no Android**. É o
     * que faz a sincronização de pastas funcionar no celular pela primeira
     * vez — no PWA esse recurso é letra morta em qualquer telefone.
     */
    @JavascriptInterface
    fun pickFolder(callId: String) {
        val h = host
        if (h == null) {
            resolve(callId, "null")
            return
        }
        h.requestFolderPick { uri ->
            if (uri == null) {
                resolve(callId, "null")
            } else {
                val obj = JSONObject()
                    .put("id", uri.toString())
                    .put("uri", uri.toString())
                    .put("name", folderName(uri))
                resolve(callId, obj.toString())
            }
        }
    }

    /**
     * Abre o seletor de ARQUIVOS do sistema (um ou vários) e devolve
     * `[{ url, name, type }]` — com `url` servível pelo mesmo `/saf/` das
     * pastas do dispositivo. É a importação INTEIRA do app no aparelho:
     * imagem, vídeo, áudio, PDF e PPTX pela mesma porta.
     *
     * Por que não o `<input type="file">` da página: ele entrega ao JavaScript
     * um `File` — bytes já lidos —, e o PDF precisa ser aberto pelo Kotlin
     * ([SlideDeck]), que só sabe abrir um ARQUIVO. Devolver os bytes pela ponte
     * inverteria o princípio dela e faria um vídeo de 2 GB passar pela memória
     * do WebView. Com o seletor do sistema, todo import chega como URL
     * servível — inclusive o que já chegava assim pelo compartilhamento.
     *
     * SEM PRAZO no lado web: quem responde aqui é uma PESSOA escolhendo um
     * arquivo, e um timeout resolveria null com o seletor ainda aberto — a
     * mesma regra do [pickFolder] e do [requestMic].
     */
    @JavascriptInterface
    fun pickDoc(callId: String, mimesCsv: String) {
        val h = host
        if (h == null) { resolve(callId, "[]"); return }
        val mimes = mimesCsv.split(',').map { it.trim() }.filter { it.isNotBlank() }
        h.requestDocPick(if (mimes.isEmpty()) arrayOf("*/*") else mimes.toTypedArray()) { uris ->
            val arr = JSONArray()
            for (uri in uris) {
                arr.put(
                    JSONObject()
                        .put("url", SafRegistry.urlFor(uri))
                        .put("name", nomeDoDocumento(uri))
                        .put("type", ctx.contentResolver.getType(uri) ?: "application/octet-stream"),
                )
            }
            resolve(callId, arr.toString())
        }
    }

    /**
     * SALVA UM TEXTO NUM ARQUIVO ESCOLHIDO PELO OPERADOR (shell 55).
     *
     * O Registro deixou de caber numa cópia: com o acervo inteiro varrido ele
     * passa de 70 linhas só na seção de cifras, e o caminho de sempre — copiar
     * e colar — é o que corta o texto no meio sem avisar. Um arquivo não corta.
     *
     * **Por que não um `<a download>` na página:** o WebView deste app não
     * define `DownloadListener`, e sem ele um clique num `blob:` com `download`
     * não faz absolutamente nada — nem erro, nem arquivo. Pôr um listener
     * genérico seria abrir um caminho de gravação para QUALQUER coisa que a
     * página venha a apontar; este método grava UM texto, no arquivo que a
     * pessoa acabou de escolher, e nada mais.
     *
     * SEM PRAZO no lado web: quem responde é uma PESSOA no seletor do sistema —
     * a mesma regra do [pickFolder], do [pickDoc] e do [requestMic].
     *
     * **E É JUSTAMENTE POR NÃO TER PRAZO QUE O NOME PRECISA DE `JSONObject.quote`.**
     * [resolve] injeta o segundo argumento como EXPRESSÃO JavaScript; um nome
     * cru vira `__avResolve("e:1", registro-av-20260823-1030.txt)`, que é
     * `SyntaxError`. O `evaluateJavascript` engole o erro (callback `null`), e
     * sem prazo a promise fica pendurada PARA SEMPRE: o arquivo é gravado e o
     * botão nunca responde — nem ✓, nem "Não foi salvo". O `""` da guarda de
     * host tem o mesmo defeito por outro caminho (`__avResolve("e:1", )` só não
     * quebra porque vírgula final é legal, e resolve `undefined`).
     * Como o nome vem do seletor SAF, ele também é texto de fora: sem as aspas
     * qualquer nome escolhido é JavaScript arbitrário neste origin.
     */
    @JavascriptInterface
    fun salvarTexto(callId: String, nome: String, texto: String) {
        val h = host
        if (h == null) { resolve(callId, JSONObject.quote("")); return }
        h.requestTextSave(nome, texto) { salvo -> resolve(callId, JSONObject.quote(salvo)) }
    }

    /** O nome de exibição do documento, ou "Apresentação" se o provedor não o der. */
    private fun nomeDoDocumento(uri: Uri): String {
        val nome = try {
            ctx.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
                ?.use { c ->
                    val i = c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (i >= 0 && c.moveToFirst()) c.getString(i) else null
                }
        } catch (_: Exception) { null }
        return (nome ?: uri.lastPathSegment ?: "Apresentação").substringAfterLast('/')
    }

    /**
     * Lista os arquivos do primeiro nível da pasta — mesma profundidade do
     * `handle.entries()` usado no navegador (sem recursão), para o
     * comportamento ser idêntico nos dois contextos.
     *
     * Cada item traz uma `url` servível (`/saf/<token>`), nunca bytes.
     *
     * **Só com host** (ou seja, só no Controle). O WebView do telão recebe a
     * ponte com `host = null` justamente para não ter poderes de Activity, e
     * `pickFolder`/`requestMic` já honravam isso; esta era a exceção, porque lê
     * o `ContentResolver` direto. Sem a guarda, qualquer script rodando no
     * documento do Display lia o índice inteiro — nome, tamanho e token
     * servível — de toda pasta que o operador já concedeu, num WebView que por
     * construção deveria ter zero superfície nativa. Devolve lista vazia: o
     * telão nunca chama isto, e um erro seria pior de diagnosticar que um vazio.
     */
    @JavascriptInterface
    fun listFolder(callId: String, treeUri: String) {
        if (host == null) {
            resolve(callId, "[]")
            return
        }
        io.execute {
            val out = try {
                listChildren(Uri.parse(treeUri))
            } catch (_: Exception) {
                JSONArray()
            }
            resolve(callId, out.toString())
        }
    }

    private fun listChildren(treeUri: Uri): JSONArray {
        val out = JSONArray()
        val docId = if (DocumentsContract.isDocumentUri(ctx, treeUri)) {
            DocumentsContract.getDocumentId(treeUri)
        } else {
            DocumentsContract.getTreeDocumentId(treeUri)
        }
        val children = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, docId)
        val projection = arrayOf(
            DocumentsContract.Document.COLUMN_DOCUMENT_ID,
            DocumentsContract.Document.COLUMN_DISPLAY_NAME,
            DocumentsContract.Document.COLUMN_MIME_TYPE,
            DocumentsContract.Document.COLUMN_SIZE,
            DocumentsContract.Document.COLUMN_LAST_MODIFIED,
        )
        ctx.contentResolver.query(children, projection, null, null, null)?.use { c ->
            val iId = c.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DOCUMENT_ID)
            val iName = c.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DISPLAY_NAME)
            val iMime = c.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_MIME_TYPE)
            val iSize = c.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_SIZE)
            val iTime = c.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_LAST_MODIFIED)
            while (c.moveToNext()) {
                val mime = c.getString(iMime) ?: ""
                if (mime == DocumentsContract.Document.MIME_TYPE_DIR) continue
                val id = c.getString(iId) ?: continue
                val name = c.getString(iName) ?: continue
                val uri = DocumentsContract.buildDocumentUriUsingTree(treeUri, id)
                out.put(
                    JSONObject()
                        .put("name", name)
                        .put("type", mime)
                        .put("size", if (c.isNull(iSize)) 0L else c.getLong(iSize))
                        .put("mtime", if (c.isNull(iTime)) 0L else c.getLong(iTime))
                        .put("url", SafRegistry.urlFor(uri)),
                )
            }
        }
        return out
    }

    /** Último segmento legível do tree URI, como nome sugerido da pasta. */
    private fun folderName(treeUri: Uri): String {
        val raw = try {
            DocumentsContract.getTreeDocumentId(treeUri)
        } catch (_: Exception) {
            treeUri.lastPathSegment ?: "Pasta"
        }
        val tail = raw.substringAfterLast(':').substringAfterLast('/')
        return if (tail.isBlank()) "Pasta" else tail
    }

    // ---------- resolução das Promises do lado web ----------

    /**
     * [jsonValue] é injetado como expressão JavaScript (já é JSON válido —
     * `JSONObject`/`JSONArray`/`null`), então o lado web recebe o valor
     * pronto, sem `JSON.parse` de string dupla.
     */
    private fun resolve(callId: String, jsonValue: String) {
        val web = webRef() ?: return
        val id = JSONObject.quote(callId)
        web.post {
            web.evaluateJavascript(
                "window.__avResolve && window.__avResolve($id, $jsonValue);",
                null,
            )
        }
    }
}
