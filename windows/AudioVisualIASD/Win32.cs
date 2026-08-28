using System.Runtime.InteropServices;

namespace AudioVisualIASD;

/// <summary>
/// AS CHAMADAS DO SISTEMA, num lugar só.
///
/// A casca não usa WinForms nem WPF, e a razão principal não é peso: é que o
/// SDK do Windows Desktop **não existe fora do Windows**, então um projeto que
/// dependesse dele não compilaria em lugar nenhum além de um runner
/// `windows-latest`. Sem ele, `net8.0-windows` compila no Linux — e a metade
/// da casca que não é regra de culto passa a ser conferível no mesmo lugar em
/// que o resto do projeto é.
///
/// O caminho de hospedagem também não perde nada: o controle WinForms do
/// WebView2 é uma casca fina sobre `CreateCoreWebView2Controller(HWND)`, que é
/// o que este arquivo entrega.
/// </summary>
internal static class Win32
{
    internal const int WS_OVERLAPPEDWINDOW = 0x00CF0000;
    internal const int WS_POPUP = unchecked((int)0x80000000);
    internal const int WS_VISIBLE = 0x10000000;
    internal const int SW_SHOW = 5;
    internal const int SW_SHOWMAXIMIZED = 3;

    internal const uint WM_DESTROY = 0x0002;
    internal const uint WM_SIZE = 0x0005;
    internal const uint WM_CLOSE = 0x0010;
    internal const uint WM_APP = 0x8000;
    internal const uint WM_DISPLAYCHANGE = 0x007E;

    /// <summary>O recado que o laço usa para rodar uma continuação de `await`
    /// na thread da interface. Ver <see cref="LacoUi"/>.</summary>
    internal const uint WM_RODAR = WM_APP + 1;

    internal const int GWLP_USERDATA = -21;
    internal static readonly IntPtr HWND_MESSAGE = new(-3);

    [StructLayout(LayoutKind.Sequential)]
    internal struct RECT { public int left, top, right, bottom; }

    [StructLayout(LayoutKind.Sequential)]
    internal struct POINT { public int x, y; }

    [StructLayout(LayoutKind.Sequential)]
    internal struct MSG
    {
        public IntPtr hwnd; public uint message; public IntPtr wParam, lParam;
        public uint time; public POINT pt;
    }

    [StructLayout(LayoutKind.Sequential)]
    internal struct MONITORINFOEX
    {
        public int cbSize;
        public RECT rcMonitor;
        public RECT rcWork;
        public uint dwFlags;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string szDevice;
    }

    /// <summary>O monitor PRIMÁRIO — o que tem a barra de tarefas. É por ele
    /// que se sabe qual dos dois é a projeção.</summary>
    internal const uint MONITORINFOF_PRIMARY = 1;

    internal delegate IntPtr WndProc(IntPtr hwnd, uint msg, IntPtr w, IntPtr l);
    internal delegate bool MonitorEnumProc(IntPtr hMon, IntPtr hdc, ref RECT r, IntPtr dados);

    [StructLayout(LayoutKind.Sequential)]
    internal struct WNDCLASSEX
    {
        public uint cbSize, style;
        [MarshalAs(UnmanagedType.FunctionPtr)] public WndProc lpfnWndProc;
        public int cbClsExtra, cbWndExtra;
        public IntPtr hInstance, hIcon, hCursor, hbrBackground;
        [MarshalAs(UnmanagedType.LPWStr)] public string? lpszMenuName;
        [MarshalAs(UnmanagedType.LPWStr)] public string lpszClassName;
        public IntPtr hIconSm;
    }

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    internal static extern ushort RegisterClassExW(ref WNDCLASSEX c);

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    internal static extern IntPtr CreateWindowExW(
        int exStyle, string classe, string? titulo, int style,
        int x, int y, int w, int h, IntPtr pai, IntPtr menu, IntPtr inst, IntPtr param);

    [DllImport("user32.dll")] internal static extern IntPtr DefWindowProcW(IntPtr h, uint m, IntPtr w, IntPtr l);
    [DllImport("user32.dll")] internal static extern bool DestroyWindow(IntPtr h);
    [DllImport("user32.dll")] internal static extern bool ShowWindow(IntPtr h, int cmd);
    [DllImport("user32.dll")] internal static extern bool UpdateWindow(IntPtr h);
    [DllImport("user32.dll")] internal static extern bool GetClientRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] internal static extern int GetMessageW(out MSG m, IntPtr h, uint min, uint max);
    [DllImport("user32.dll")] internal static extern bool TranslateMessage(ref MSG m);
    [DllImport("user32.dll")] internal static extern IntPtr DispatchMessageW(ref MSG m);
    [DllImport("user32.dll")] internal static extern void PostQuitMessage(int codigo);
    [DllImport("user32.dll")] internal static extern bool PostMessageW(IntPtr h, uint m, IntPtr w, IntPtr l);
    [DllImport("user32.dll")] internal static extern bool SetWindowPos(IntPtr h, IntPtr depois, int x, int y, int w, int alt, uint flags);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] internal static extern IntPtr LoadCursorW(IntPtr inst, IntPtr nome);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] internal static extern int MessageBoxW(IntPtr h, string texto, string titulo, uint tipo);
    [DllImport("user32.dll")] internal static extern IntPtr SetWindowLongPtrW(IntPtr h, int indice, IntPtr valor);
    [DllImport("user32.dll")] internal static extern IntPtr GetWindowLongPtrW(IntPtr h, int indice);
    [DllImport("user32.dll")] internal static extern bool EnumDisplayMonitors(IntPtr hdc, IntPtr rect, MonitorEnumProc cb, IntPtr dados);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] internal static extern bool GetMonitorInfoW(IntPtr hMon, ref MONITORINFOEX info);
    [DllImport("user32.dll")] internal static extern IntPtr MonitorFromWindow(IntPtr h, uint flags);
    [DllImport("user32.dll")] internal static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] internal static extern IntPtr GetModuleHandleW(string? nome);

    internal static readonly IntPtr IDC_ARROW = new(32512);
    internal const uint SWP_NOZORDER = 0x0004;
    internal const uint SWP_NOACTIVATE = 0x0010;
    internal const uint SWP_FRAMECHANGED = 0x0020;
    internal const uint MB_ICONERROR = 0x00000010;

    /// <summary>O passo de volume devolvido ao sistema — com a UI DELE.
    ///
    /// É o análogo exato do `adjustStreamVolume(..., FLAG_SHOW_UI)` do Android,
    /// e é o que o `systemVolume` da ponte significa: o fader do app chegou ao
    /// fim, e daqui em diante quem manda é o volume da máquina.</summary>
    [DllImport("user32.dll")] internal static extern void keybd_event(byte tecla, byte scan, uint flags, UIntPtr extra);

    internal const byte VK_VOLUME_DOWN = 0xAE;
    internal const byte VK_VOLUME_UP = 0xAF;
    internal const uint KEYEVENTF_KEYUP = 0x0002;
}
