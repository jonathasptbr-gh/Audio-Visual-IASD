using System.Reflection;
using Microsoft.Web.WebView2.Core;
using AudioVisualIASD.Ponte;

namespace AudioVisualIASD;

/// <summary>
/// O PROGRAMA — a casca do Áudio Visual IASD no computador.
///
/// Ela abre duas janelas sobre a MESMA base web que roda no celular, e não
/// decide nada de culto: transporte, playlist, letra sincronizada, Bíblia,
/// Camada de Texto e fades ficam no web (invariante 5), YouTube e cifra ficam
/// no núcleo em Kotlin, e aqui fica o que só o Windows sabe fazer.
///
/// ```
///  AudioVisualIASD.exe ──stdio──► nucleo.jar ──http://127.0.0.1:8420──► as duas janelas
///   (janela, monitores,   ◄──────  (servidor,      ◄──── SSE ─────────   (WebView2)
///    diálogos, volume)              YouTube, cifra)
/// ```
///
/// ## O que abre, e quando
///
/// | há | Controle | Telão |
/// |---|---|---|
/// | um monitor | a janela, com a preview em tela cheia fazendo o papel de projeção | **não existe** |
/// | dois monitores | idem, no primário | tela cheia no secundário, sem moldura |
///
/// **Um segundo monitor é a TV.** No celular a `Presentation` só existe com uma
/// TV conectada, e sem ela a projeção É a preview; aqui é a mesma regra com
/// outro cabo. Foi essa equivalência que dispensou uma linha nova na base web:
/// `displays()` responde o que ela já sabe ler, o `display-ready` da janela
/// nova dispara o reenvio da cena, e tirar o cabo devolve a projeção à preview.
/// </summary>
internal static class Programa
{
    /// <summary>
    /// O contrato da ponte que esta casca cumpre. Ele é o MESMO número do
    /// `NativeBridge.SHELL_VERSION` do Android de propósito: o que ele mede é a
    /// SUPERFÍCIE da ponte, que é uma só para as duas cascas, e o `minShell`
    /// do bundle é comparado contra ele nos dois lados.
    /// </summary>
    const int SHELL = 58;

    /// <summary>
    /// A PORTA — e ela é a ORIGEM.
    ///
    /// `http://127.0.0.1:8420` e `:8421` são origens diferentes, com IndexedDB
    /// e OPFS diferentes. Trocá-la apaga a biblioteca do operador em silêncio:
    /// o Cronograma, o hinário, a Bíblia e os vídeos ficariam órfãos num origin
    /// que ninguém mais abre. Ver o KDoc do `NucleoServidor`.
    /// </summary>
    const int PORTA = 8420;

    static Nucleo? _nucleo;
    static Janela? _controle;
    static Janela? _telao;
    static Folhas? _folhas;
    static CoreWebView2Environment? _ambiente;
    static string _folha = "";
    static string _base = "";

    [STAThread]
    static int Main()
    {
        // STA e um contexto que devolve as continuações a ESTA thread: o
        // WebView2 é COM de apartamento, e uma continuação retomada numa thread
        // do pool é a classe de defeito que só aparece no computador do
        // operador. Ver `LacoUi`.
        var laco = new LacoUi();
        SynchronizationContext.SetSynchronizationContext(laco);

        var aoLado = Path.GetDirectoryName(Environment.ProcessPath ?? AppContext.BaseDirectory)!;
        var raizWeb = Path.Combine(aoLado, "web");
        var jar = Path.Combine(aoLado, "nucleo.jar");
        var java = Path.Combine(aoLado, "jre", "bin", "javaw.exe");
        // O JRE viaja junto (o ZIP portátil e o MSIX o embrulham), e o `java`
        // do PATH é o recuo — para o desenvolvimento, e para uma instalação em
        // que alguém tenha apagado a pasta.
        if (!File.Exists(java)) java = "javaw.exe";

        _base = "http://127.0.0.1:" + PORTA;
        _folha = LerFolhaInjetada();

        _nucleo = new Nucleo(java, jar, raizWeb, PORTA, Atender);
        var recusa = _nucleo.Ligar();
        if (recusa is not null)
        {
            // A FRASE VEM DO NÚCLEO E É MOSTRADA SEM TRADUZIR. Ela já diz o
            // que fazer — inclusive o que NÃO fazer, no caso da porta ocupada,
            // que é justamente o que o operador tentaria sozinho.
            Win32.MessageBoxW(IntPtr.Zero, recusa, "Áudio Visual IASD", Win32.MB_ICONERROR);
            _nucleo.Dispose();
            return 1;
        }

        _folhas = new Folhas(_nucleo, papel => papel == "display" ? _telao : _controle);

        _ = MontarAsync();
        LacoUi.Rodar();

        _telao?.Fechar();
        _controle?.Fechar();
        _nucleo.Dispose();
        return 0;
    }

    static async Task MontarAsync()
    {
        try
        {
            // UM AMBIENTE E UMA PASTA DE PERFIL PARA AS DUAS JANELAS — é a
            // invariante 3, e é o que faz IndexedDB, OPFS e localStorage serem
            // os MESMOS nos dois WebViews. A Microsoft documenta essa
            // equivalência; ela é a peça de que o barramento e o acervo
            // compartilhado dependem.
            var perfil = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "AudioVisualIASD", "perfil");
            Directory.CreateDirectory(perfil);

            var opcoes = new CoreWebView2EnvironmentOptions
            {
                // INVARIANTE 4: a TV não recebe toque, e o telão precisa tocar
                // sem gesto. É o par exato do
                // `mediaPlaybackRequiresUserGesture = false` do Android.
                AdditionalBrowserArguments = "--autoplay-policy=no-user-gesture-required",
            };
            _ambiente = await CoreWebView2Environment.CreateAsync(null, perfil, opcoes);

            _controle = new Janela("controle", "Áudio Visual IASD", null, Encerrar);
            _nucleo!.RegistrarSessao(_controle.Sessao, "controle");
            await _controle.MontarAsync(_ambiente, _base, _folha, SHELL, VersaoDoPrograma());

            await AcertarTelaoAsync();
        }
        catch (Exception e)
        {
            Win32.MessageBoxW(IntPtr.Zero,
                "O programa não conseguiu abrir a janela.\n\n" + e.Message +
                "\n\nSe o computador não tiver o WebView2, instale o " +
                "\"Microsoft Edge WebView2 Runtime\" e abra de novo.",
                "Áudio Visual IASD", Win32.MB_ICONERROR);
            Encerrar();
        }
    }

    /// <summary>
    /// Cria ou derruba a janela do Telão conforme o monitor da projeção.
    ///
    /// Chamada na abertura e a cada `WM_DISPLAYCHANGE`. É o análogo do
    /// `syncPresentation` do Android, e a recuperação vem de graça pelo mesmo
    /// caminho: a janela nova carrega `/display/`, dispara `display-ready`, e o
    /// Controle reenvia a cena. **Não inventar um mecanismo paralelo.**
    /// </summary>
    static async Task AcertarTelaoAsync()
    {
        var monitor = Telas.DaProjecao();
        if (monitor is null)
        {
            if (_telao is not null)
            {
                _nucleo!.FechouSessao(_telao.Sessao);
                _telao.Fechar();
                _telao = null;
            }
            return;
        }
        if (_telao is not null) return;

        _telao = new Janela("display", "Áudio Visual IASD — projeção", monitor, () =>
        {
            // FECHAR O TELÃO NÃO FECHA O PROGRAMA. É a mesma assimetria do
            // Android: perder a `Presentation` é perder a projeção, não a
            // sessão. Ele volta no próximo `WM_DISPLAYCHANGE`.
            if (_telao is null) return;
            _nucleo!.FechouSessao(_telao.Sessao);
            _telao.Fechar();
            _telao = null;
        });
        _nucleo!.RegistrarSessao(_telao.Sessao, "display");
        await _telao.MontarAsync(_ambiente!, _base, _folha, SHELL, VersaoDoPrograma());
    }

    static void Atender(Envelope.Chamada c) => _folhas!.Atender(c);

    static void Encerrar()
    {
        Win32.PostQuitMessage(0);
    }

    /// <summary>
    /// A folha injetada viaja DENTRO do executável (`EmbeddedResource`), e não
    /// como um arquivo ao lado.
    ///
    /// Não é economia de arquivo: uma folha em disco é código que roda no
    /// origin privilegiado e que qualquer coisa pode reescrever — a mesma razão
    /// pela qual o bundle do OTA fica FORA do backup no Android. Embutida, ela
    /// também não tem como divergir da cópia versionada no repositório.
    /// </summary>
    static string LerFolhaInjetada()
    {
        var asm = Assembly.GetExecutingAssembly();
        var nome = asm.GetManifestResourceNames().First(n => n.EndsWith("ponte.js", StringComparison.Ordinal));
        using var s = asm.GetManifestResourceStream(nome)!;
        using var r = new StreamReader(s);
        return r.ReadToEnd();
    }

    /// <summary>O `versionName` do programa — o que o rodapé de Configurações
    /// mostra ao lado da versão da base web (`__SHELL_NAME__`).</summary>
    static string VersaoDoPrograma() =>
        Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "";
}
