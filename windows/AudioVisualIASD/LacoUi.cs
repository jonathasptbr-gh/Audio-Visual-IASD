using System.Collections.Concurrent;
using System.Runtime.InteropServices;

namespace AudioVisualIASD;

/// <summary>
/// O LAÇO DE MENSAGENS, e o contexto que faz `await` voltar para ele.
///
/// ## Por que ele existe, e o que quebra sem ele
///
/// O WebView2 é COM em apartamento STA: `CreateCoreWebView2ControllerAsync` e
/// tudo o que sai dele **só podem ser tocados na thread que os criou**. Num
/// programa WinForms isso vem de graça, porque o `Application.Run` instala um
/// `SynchronizationContext` que devolve toda continuação de `await` à thread da
/// interface.
///
/// Numa casca Win32 crua não há nenhum, e o padrão do .NET é retomar a
/// continuação **numa thread do pool**. O que sai disso não é uma exceção
/// clara: é uma chamada COM de outro apartamento, que ora funciona, ora
/// devolve `RPC_E_WRONG_THREAD`, ora trava. *É a classe de defeito que aparece
/// no aparelho do operador e não na máquina de quem escreveu.*
///
/// Este contexto enfileira a continuação e cutuca uma janela **só de recado**
/// (filha de `HWND_MESSAGE`, sem pixel nenhum); o laço a desperta e a roda na
/// thread certa.
/// </summary>
internal sealed class LacoUi : SynchronizationContext
{
    readonly ConcurrentQueue<(SendOrPostCallback, object?)> _fila = new();
    readonly IntPtr _recado;
    readonly int _threadDaUi;
    readonly Win32.WndProc _proc; // guardado: um delegate coletado vira crash

    internal LacoUi()
    {
        _threadDaUi = Environment.CurrentManagedThreadId;
        _proc = Proc;
        var inst = Win32.GetModuleHandleW(null);
        var classe = new Win32.WNDCLASSEX
        {
            cbSize = (uint)Marshal.SizeOf<Win32.WNDCLASSEX>(),
            lpfnWndProc = _proc,
            hInstance = inst,
            lpszClassName = "AVRecado",
        };
        Win32.RegisterClassExW(ref classe);
        _recado = Win32.CreateWindowExW(0, "AVRecado", null, 0, 0, 0, 0, 0,
            Win32.HWND_MESSAGE, IntPtr.Zero, inst, IntPtr.Zero);
    }

    IntPtr Proc(IntPtr h, uint m, IntPtr w, IntPtr l)
    {
        if (m != Win32.WM_RODAR) return Win32.DefWindowProcW(h, m, w, l);
        while (_fila.TryDequeue(out var t))
        {
            // Uma continuação que lança não pode derrubar o laço: as duas
            // janelas ficariam de pé e mudas, com a projeção no ar e nada na
            // tela dizendo por quê.
            try { t.Item1(t.Item2); }
            catch (Exception e) { Diario.Anotar("[casca] continuação falhou: " + e); }
        }
        return IntPtr.Zero;
    }

    public override void Post(SendOrPostCallback cb, object? estado)
    {
        _fila.Enqueue((cb, estado));
        Win32.PostMessageW(_recado, Win32.WM_RODAR, IntPtr.Zero, IntPtr.Zero);
    }

    /// <summary>
    /// `Send` BLOQUEIA de verdade — ele não pode ser um `Post`.
    ///
    /// Quem o chama espera o efeito ter acontecido quando a linha seguinte
    /// rodar (é o caso do `Folhas.Dono`, que precisa da alça da janela para
    /// abrir um diálogo). Um `Send` que só enfileira devolve o valor de antes,
    /// e o defeito é mudo: o diálogo nasce sem dono, atrás da janela do
    /// programa, e o operador vê o app travado.
    ///
    /// **Chamado DA PRÓPRIA thread da interface ele executa direto**, senão
    /// esperaria por um laço que é ele mesmo — um travamento total.
    /// </summary>
    public override void Send(SendOrPostCallback cb, object? estado)
    {
        if (Environment.CurrentManagedThreadId == _threadDaUi) { cb(estado); return; }
        using var pronto = new ManualResetEventSlim(false);
        Exception? falha = null;
        Post(_ =>
        {
            try { cb(estado); } catch (Exception e) { falha = e; } finally { pronto.Set(); }
        }, null);
        pronto.Wait();
        if (falha is not null) throw falha;
    }

    /// <summary>Roda o laço até `PostQuitMessage`.</summary>
    internal static void Rodar()
    {
        while (Win32.GetMessageW(out var m, IntPtr.Zero, 0, 0) > 0)
        {
            Win32.TranslateMessage(ref m);
            Win32.DispatchMessageW(ref m);
        }
    }
}
