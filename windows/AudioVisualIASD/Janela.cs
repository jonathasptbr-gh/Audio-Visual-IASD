using System.Runtime.InteropServices;
using Microsoft.Web.WebView2.Core;

namespace AudioVisualIASD;

/// <summary>
/// UMA JANELA COM UM WEBVIEW2 DENTRO — o Controle ou o Telão.
///
/// ## As quatro invariantes do `WebViewFactory`, aqui
///
/// | # | no Android | aqui |
/// |---|---|---|
/// | 1 — contexto seguro, jamais `file://` | `WebViewAssetLoader` | `http://127.0.0.1:&lt;porta fixa&gt;` — loopback é *potentially trustworthy* por especificação, e é o que faz OPFS e IndexedDB existirem |
/// | 2 — um único origin | mesmo host | **mesma porta**. Ver o `NucleoServidor`: a porta É a origem, e trocá-la apagaria o acervo |
/// | 3 — um perfil | um WebView | um <see cref="CoreWebView2Environment"/> e uma pasta de perfil para as duas janelas. É isso que faz IndexedDB, OPFS e localStorage serem os MESMOS nas duas — documentado pela Microsoft |
/// | 4 — autoplay sem gesto | flag do WebView | `--autoplay-policy=no-user-gesture-required` nos argumentos do Chromium |
///
/// ## E a INVARIANTE 9 nasce aqui
///
/// O papel é injetado como literal em `__AV_CASCA__`, pela casca, que é quem
/// cria a janela — a folha não o escolhe e a página não o alcança. O núcleo
/// recusa a superfície privilegiada de uma sessão que não seja `controle`, no
/// servidor. No Android a mesma invariante é `host = null` mais uma guarda por
/// método, **sem oráculo**; aqui ela tem um (`NucleoDespachoTest`).
/// </summary>
internal sealed class Janela
{
    internal IntPtr Alca { get; private set; }
    internal CoreWebView2Controller? Controlador { get; private set; }
    internal string Sessao { get; }
    internal string Papel { get; }

    readonly Win32.WndProc _proc;   // guardado: um delegate coletado vira crash
    readonly Action _aoFechar;
    bool _cheia;
    int _antesX, _antesY, _antesL, _antesA;

    static bool _classeRegistrada;
    const string CLASSE = "AudioVisualIASD";

    internal Janela(string papel, string titulo, Telas.Monitor? monitor, Action aoFechar)
    {
        Papel = papel;
        Sessao = NovaSessao();
        _aoFechar = aoFechar;
        _proc = Proc;

        var inst = Win32.GetModuleHandleW(null);
        if (!_classeRegistrada)
        {
            var c = new Win32.WNDCLASSEX
            {
                cbSize = (uint)Marshal.SizeOf<Win32.WNDCLASSEX>(),
                lpfnWndProc = _proc,
                hInstance = inst,
                hCursor = Win32.LoadCursorW(IntPtr.Zero, Win32.IDC_ARROW),
                lpszClassName = CLASSE,
            };
            Win32.RegisterClassExW(ref c);
            _classeRegistrada = true;
        }

        if (monitor is not null)
        {
            // A JANELA DO TELÃO NASCE EM TELA CHEIA no monitor da projeção,
            // sem moldura. Ela é o análogo da `Presentation`: o que aparece
            // nela é o que a congregação vê, e uma barra de título ali é uma
            // barra de título projetada.
            Alca = Win32.CreateWindowExW(0, CLASSE, titulo, Win32.WS_POPUP | Win32.WS_VISIBLE,
                monitor.X, monitor.Y, monitor.Largura, monitor.Altura,
                IntPtr.Zero, IntPtr.Zero, inst, IntPtr.Zero);
            _cheia = true;
        }
        else
        {
            Alca = Win32.CreateWindowExW(0, CLASSE, titulo, Win32.WS_OVERLAPPEDWINDOW,
                unchecked((int)0x80000000), unchecked((int)0x80000000), 1100, 760,
                IntPtr.Zero, IntPtr.Zero, inst, IntPtr.Zero);
        }
        // A janela guarda um ponteiro para si mesma, porque a `WndProc` é
        // estática por natureza do Win32 e há mais de uma janela.
        var gc = GCHandle.Alloc(this, GCHandleType.Weak);
        Win32.SetWindowLongPtrW(Alca, Win32.GWLP_USERDATA, GCHandle.ToIntPtr(gc));
        Win32.ShowWindow(Alca, monitor is not null ? Win32.SW_SHOW : Win32.SW_SHOWMAXIMIZED);
        Win32.UpdateWindow(Alca);
    }

    /// <summary>
    /// A sessão da janela — ver `NucleoRotas.sessaoValida`. Aleatória, e não um
    /// contador: ela indexa o fio SSE e o mapa de papéis, e a mesma disciplina
    /// do `SafRegistry` do Android vale aqui (um contador põe as janelas de
    /// qualquer processo ao alcance de quem enumerar).
    /// </summary>
    static string NovaSessao()
    {
        var b = new byte[16];
        System.Security.Cryptography.RandomNumberGenerator.Fill(b);
        return Convert.ToBase64String(b).Replace('+', '-').Replace('/', '_').TrimEnd('=');
    }

    internal async Task MontarAsync(CoreWebView2Environment ambiente, string baseUrl, string folha, int shell, string nome)
    {
        Controlador = await ambiente.CreateCoreWebView2ControllerAsync(Alca);
        Ajustar();
        var w = Controlador.CoreWebView2;

        // O PREÂMBULO É LITERAL, e é ele que sela o papel. Ele entra ANTES da
        // folha, no mesmo script, porque a folha retorna na entrada sem ele —
        // exatamente como o `native.js` retorna sem `__AVBridge`.
        var preambulo =
            "window.__AV_CASCA__={base:" + Ponte.Envelope.Aspas(baseUrl) +
            ",papel:" + Ponte.Envelope.Aspas(Papel) +
            ",sessao:" + Ponte.Envelope.Aspas(Sessao) +
            ",shell:" + shell +
            ",nome:" + Ponte.Envelope.Aspas(nome) + "};\n";
        // `AddScriptToExecuteOnDocumentCreated` roda ANTES de qualquer script
        // da página — o análogo exato do `addJavascriptInterface`, e é por isso
        // que o `native.js` acha `__AVBridge` já de pé.
        await w.AddScriptToExecuteOnDocumentCreatedAsync(preambulo + folha);

        // A base é servida pelo próprio programa e muda quando o programa
        // muda: um cache intermediário aqui é o defeito do OTA por outro
        // caminho (metade de cada versão na mesma página).
        w.Settings.IsGeneralAutofillEnabled = false;
        w.Settings.IsPasswordAutosaveEnabled = false;
        w.Settings.AreDefaultContextMenusEnabled = false;
        w.Settings.IsSwipeNavigationEnabled = false;
        w.Settings.IsStatusBarEnabled = false;

        // NAVEGAÇÃO PARA FORA DO ORIGIN É RECUSADA — a invariante 2, e ela não
        // pode falhar ABERTO. A conferência é por COMPONENTE do `Uri`, nunca
        // por prefixo de string: `127.0.0.1.exemplo.com` começa com o origin, é
        // um domínio que qualquer um registra, e um `StartsWith` autorizaria a
        // navegação dentro de uma janela que injeta a ponte em TODA página.
        var origem = new Uri(baseUrl);
        w.NavigationStarting += (_, e) =>
        {
            if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out var u) ||
                u.Host != origem.Host || u.Port != origem.Port)
            {
                e.Cancel = true;
            }
        };
        // E uma janela nova (um `target=_blank`) também não: quem abre link
        // externo é o `openExternal` da ponte, no navegador do sistema.
        w.NewWindowRequested += (_, e) => e.Handled = true;

        w.Navigate(baseUrl + (Papel == "display" ? "/display/" : "/controle/"));
    }

    internal void Ajustar()
    {
        if (Controlador is null) return;
        Win32.GetClientRect(Alca, out var r);
        Controlador.Bounds = new System.Drawing.Rectangle(0, 0, r.right - r.left, r.bottom - r.top);
    }

    /// <summary>
    /// O DEGRAU DE UM CLIQUE — tela cheia no monitor em que a janela está.
    ///
    /// Ele existe para o caso que o automático não cobre: o operador quer o
    /// telão num monitor que o Windows não chama de secundário, ou quer vê-lo
    /// numa janela enquanto ensaia.
    /// </summary>
    internal void AlternarTelaCheia()
    {
        if (_cheia)
        {
            Win32.SetWindowLongPtrW(Alca, -16, new IntPtr(Win32.WS_OVERLAPPEDWINDOW | Win32.WS_VISIBLE));
            Win32.SetWindowPos(Alca, IntPtr.Zero, _antesX, _antesY, _antesL, _antesA,
                Win32.SWP_NOZORDER | Win32.SWP_FRAMECHANGED);
            _cheia = false;
        }
        else
        {
            Win32.GetClientRect(Alca, out var r);
            _antesX = r.left; _antesY = r.top; _antesL = r.right - r.left; _antesA = r.bottom - r.top;
            var mon = Telas.Todos().FirstOrDefault(m => m.Alca == Win32.MonitorFromWindow(Alca, 2))
                      ?? Telas.Todos().First();
            Win32.SetWindowLongPtrW(Alca, -16, new IntPtr(Win32.WS_POPUP | Win32.WS_VISIBLE));
            Win32.SetWindowPos(Alca, IntPtr.Zero, mon.X, mon.Y, mon.Largura, mon.Altura,
                Win32.SWP_NOZORDER | Win32.SWP_FRAMECHANGED);
            _cheia = true;
        }
        Ajustar();
    }

    internal void Fechar()
    {
        if (Alca == IntPtr.Zero) return;
        var h = Alca;
        Alca = IntPtr.Zero;
        Controlador?.Close();
        Controlador = null;
        Win32.DestroyWindow(h);
    }

    static IntPtr Proc(IntPtr h, uint m, IntPtr w, IntPtr l)
    {
        var p = Win32.GetWindowLongPtrW(h, Win32.GWLP_USERDATA);
        Janela? j = null;
        if (p != IntPtr.Zero)
        {
            var gc = GCHandle.FromIntPtr(p);
            j = gc.Target as Janela;
        }
        switch (m)
        {
            case Win32.WM_SIZE:
                j?.Ajustar();
                return IntPtr.Zero;
            case Win32.WM_CLOSE:
                j?._aoFechar();
                return IntPtr.Zero;
            case Win32.WM_DESTROY:
                return IntPtr.Zero;
        }
        return Win32.DefWindowProcW(h, m, w, l);
    }
}
