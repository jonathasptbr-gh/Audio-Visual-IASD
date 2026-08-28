using System.Runtime.InteropServices;

namespace AudioVisualIASD;

/// <summary>
/// OS MONITORES — e o degrau de projeção.
///
/// ## O modelo é o mesmo do Android, e isso não é uma analogia
///
/// No celular, a `Presentation` só existe quando há uma TV conectada; sem ela a
/// projeção É a preview em tela cheia do Controle, e o botão do microfone nem
/// é desenhado. **Um segundo monitor é a TV.**
///
/// Por isso a janela do Telão nasce e morre com o monitor secundário, e não com
/// uma escolha do operador: `displays()` passa a responder o que a base web já
/// sabe interpretar, `display-ready` dispara o reenvio da cena, e a preview
/// volta a ser a projeção quando o cabo cai — tudo isso sem uma linha nova na
/// base.
///
/// **O degrau de um clique, no lote 3, é o F11 da própria janela do Telão** —
/// para o caso de o operador querer o telão num monitor que não é o que o
/// Windows chama de secundário, ou numa janela. Um método de ponte que ofereça
/// isso a partir do Controle é degrau de `SHELL_VERSION` e fica para o lote em
/// que a ponte já mudar por outro motivo.
/// </summary>
internal static class Telas
{
    internal sealed record Monitor(IntPtr Alca, int X, int Y, int Largura, int Altura, bool Primario, string Nome);

    internal static List<Monitor> Todos()
    {
        var fora = new List<Monitor>();
        Win32.EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero, (IntPtr h, IntPtr _, ref Win32.RECT _, IntPtr _) =>
        {
            var info = new Win32.MONITORINFOEX { cbSize = Marshal.SizeOf<Win32.MONITORINFOEX>(), szDevice = string.Empty };
            if (Win32.GetMonitorInfoW(h, ref info))
            {
                var r = info.rcMonitor;
                fora.Add(new Monitor(
                    h, r.left, r.top, r.right - r.left, r.bottom - r.top,
                    (info.dwFlags & Win32.MONITORINFOF_PRIMARY) != 0,
                    info.szDevice ?? string.Empty));
            }
            return true;
        }, IntPtr.Zero);
        return fora;
    }

    /// <summary>
    /// O monitor da PROJEÇÃO, ou `null` quando só há um.
    ///
    /// "O primeiro que não é o primário" e não "o segundo da lista": a ordem em
    /// que o Windows enumera monitores não é estável entre sessões, e o que
    /// distingue a tela do operador da tela da congregação é a barra de
    /// tarefas — que mora no primário, por definição.
    /// </summary>
    internal static Monitor? DaProjecao()
    {
        var todos = Todos();
        return todos.Count < 2 ? null : todos.FirstOrDefault(m => !m.Primario);
    }

    /// <summary>Como a ponte descreve os monitores — a mesma forma que o
    /// `displays()` do Android devolve, campo a campo.</summary>
    internal static string ComoJson()
    {
        var b = new System.Text.StringBuilder("[");
        var i = 0;
        foreach (var m in Todos())
        {
            if (i++ > 0) b.Append(',');
            b.Append("{\"id\":").Append(Ponte.Envelope.Aspas(m.Nome))
             .Append(",\"name\":").Append(Ponte.Envelope.Aspas(m.Primario ? "Tela principal" : "Projeção"))
             .Append(",\"w\":").Append(m.Largura)
             .Append(",\"h\":").Append(m.Altura)
             // `density` existe na forma do Android (`DisplayMetrics`), e no
             // computador não tem correspondente honesto: 1 é o valor que
             // nenhuma conta do lado web multiplica errado.
             .Append(",\"density\":1}");
        }
        return b.Append(']').ToString();
    }
}
