namespace AudioVisualIASD;

/// <summary>
/// O DIÁRIO DA CASCA — e ele existe porque **um `WinExe` não tem console**.
///
/// Todo `Console.Error.WriteLine` desta casca escrevia num descritor que o
/// Windows não liga para um subsistema gráfico: a mensagem não vai para lugar
/// nenhum. E o que passava por ali é exatamente o que se quer saber quando o
/// programa se comporta mal na igreja — a continuação que lançou, o diálogo que
/// falhou, o cano que fechou, a permissão que foi negada.
///
/// Ele NÃO é o Registro. O Registro é do lado web, é o que o operador copia, e
/// continua sendo a porta principal do diagnóstico; este é o rodapé da casca,
/// para o que acontece antes de existir página — ou quando ela já morreu.
///
/// **Ele nunca lança.** Um diário que derruba o programa que ele deveria
/// explicar é pior que diário nenhum.
/// </summary>
internal static class Diario
{
    static readonly object _trava = new();
    static string? _arquivo;

    /// <summary>Um arquivo por execução, ao lado do perfil. Sem rotação: quem
    /// o lê é uma pessoa procurando a última sessão, e o teto é a vida do
    /// processo.</summary>
    internal static void Abrir(string pasta)
    {
        try
        {
            Directory.CreateDirectory(pasta);
            _arquivo = Path.Combine(pasta, "casca.log");
            // O arquivo é RECOMEÇADO a cada abertura: o que interessa é a
            // sessão em que o defeito apareceu, e um log que só cresce vira
            // um arquivo que ninguém abre.
            File.WriteAllText(_arquivo, "");
        }
        catch { _arquivo = null; }
    }

    internal static void Anotar(string linha)
    {
        lock (_trava)
        {
            try
            {
                if (_arquivo is null) return;
                File.AppendAllText(_arquivo, linha + Environment.NewLine);
            }
            catch { /* um diário não derruba o programa que ele explica */ }
        }
    }
}
