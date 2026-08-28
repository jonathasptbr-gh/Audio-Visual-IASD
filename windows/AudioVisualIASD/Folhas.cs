using System.Diagnostics;
using System.Runtime.InteropServices;
using AudioVisualIASD.Ponte;

namespace AudioVisualIASD;

/// <summary>
/// AS FOLHAS DE UI — o que só o sistema operacional sabe responder.
///
/// É o `BridgeHost` do Android, com os mesmos limites: **nenhuma decisão de
/// culto entra aqui** (invariante 5). Uma folha traduz um pedido da ponte numa
/// chamada do Windows e devolve o resultado; quem decide se o pedido fazia
/// sentido é o lado web.
///
/// ## O que uma folha faz com o que ela não sabe responder
///
/// Resolve `null`, que é o que todo chamador do `native.js` já trata (lista
/// vazia, string vazia, `false`). O que ela **não** pode fazer é ficar calada:
/// a promessa esperaria os 60 s do `CALL_TIMEOUT_MS` e o botão ficaria mudo
/// por um minuto.
/// </summary>
internal sealed class Folhas
{
    readonly Nucleo _nucleo;
    readonly Func<string, Janela?> _janelaDe;
    readonly List<string> _semDono = new();

    internal Folhas(Nucleo nucleo, Func<string, Janela?> janelaDe)
    {
        _nucleo = nucleo;
        _janelaDe = janelaDe;
    }

    /// <summary>A janela que fez o pedido — o diálogo do sistema é MODAL sobre
    /// ela. Sem dono, ele pode nascer atrás da janela do programa, e o que o
    /// operador vê é o app travado.</summary>
    IntPtr Dono(string sessao)
    {
        foreach (var papel in new[] { "controle", "display" })
        {
            var j = _janelaDe(papel);
            if (j is not null && j.Sessao == sessao) return j.Alca;
        }
        return IntPtr.Zero;
    }

    /// <summary>O que a casca ainda não sabe fazer — a mesma lista que o
    /// `NucleoDespacho.naoImplementados` mantém do outro lado, pelo mesmo
    /// motivo: "esta parte ainda não existe" e "o programa travou" são leituras
    /// diferentes, e sem a lista elas são indistinguíveis.</summary>
    internal IReadOnlyList<string> SemDono { get { lock (_semDono) return _semDono.ToArray(); } }

    internal void Atender(Envelope.Chamada c)
    {
        // A sessão vai SEMPRE na frente (é o `NucleoDespacho` que a põe ali) —
        // é por ela que a resposta acha o caminho de volta.
        var sessao = c.Args.Count > 0 ? c.Args[0] : "";
        var a = c.Args.Skip(1).ToList();
        string? Arg(int i) => i < a.Count ? a[i] : null;
        void Resolver(string json) => _nucleo.Resolver(sessao, c.Id, json);

        switch (c.Metodo)
        {
            case "displays":
                Resolver(Telas.ComoJson());
                break;

            // ---------- OS ARQUIVOS DO OPERADOR ----------
            //
            // A CASCA DEVOLVE CAMINHOS, NUNCA URLs. Quem cunha o token de
            // `/saf/` é o núcleo — porque é ele que vai servir os bytes, e
            // porque o token é ligado à SESSÃO da janela, que é o que impede o
            // Telão de alcançar o disco do operador (no Android o WebView dele
            // é montado SEM o handler `/saf/`; aqui as duas janelas dividem um
            // socket, e a sessão na URL é o que reproduz aquela negativa).
            //
            // Eles rodam FORA da thread da interface: quem responde é uma
            // PESSOA no seletor, e enquanto ela escolhe a pasta o laço de
            // mensagens precisa continuar girando — senão as duas janelas
            // congelam, projeção inclusive.
            case "pickFolder":
                EmOutraThread(() =>
                {
                    var p = Dialogos.EscolherPasta(Dono(sessao), "Escolha a pasta de mídias");
                    if (p is null) Resolver("null");
                    else _nucleo.Mandar("-", "resolverPasta", new[] { sessao, c.Id, p });
                });
                break;

            case "pickDoc":
                EmOutraThread(() =>
                {
                    var ps = Dialogos.EscolherArquivos(Dono(sessao), "Escolha os arquivos");
                    var args = new List<string> { sessao, c.Id };
                    args.AddRange(ps);
                    _nucleo.Mandar("-", "resolverArquivos", args);
                });
                break;

            // O "Salvar como" — e é a CASCA que escreve os bytes, como no
            // Android. Ele existe porque o WebView não tem `DownloadListener`:
            // um `<a download>` sobre um `blob:` ali não faz NADA, sem erro e
            // sem arquivo.
            case "salvarTexto":
                {
                    var nome = Arg(0) ?? "registro.txt";
                    var texto = Arg(1) ?? "";
                    EmOutraThread(() =>
                    {
                        var alvo = Dialogos.OndeSalvar(Dono(sessao), nome);
                        if (alvo is null) { Resolver("\"\""); return; }
                        try
                        {
                            File.WriteAllText(alvo, texto, new System.Text.UTF8Encoding(false));
                            // O NOME gravado, que é o que o `native.js` promete
                            // — e o operador pode ter trocado no diálogo.
                            Resolver(Ponte.Envelope.Aspas(Path.GetFileName(alvo)));
                        }
                        catch (Exception e)
                        {
                            Console.Error.WriteLine("[casca] não gravou: " + e.Message);
                            Resolver("\"\"");
                        }
                    });
                }
                break;

            // O ESPELHAMENTO DO WINDOWS é o "Conectar" (Win+K) — o análogo do
            // Smart View do Android, e como lá ele não é API: é uma tela do
            // sistema que se abre por URI. Um computador com projetor por cabo
            // não precisa dele, e é por isso que ele nunca é o caminho
            // principal aqui: o caminho principal é o segundo monitor.
            case "openCast":
                Abrir("ms-settings-connectabledevices:devicediscovery");
                break;
            case "castTarget":
                Resolver("{\"label\":\"Conectar (Win+K)\"}");
                break;

            case "openExternal":
                // Só `https`. O `native.js` já confere, e conferir de novo aqui
                // não é redundância: esta é a única camada que de fato entrega
                // a URL ao sistema, e `ShellExecute` abre o que lhe derem —
                // inclusive `file:` e um `.exe`.
                {
                    var u = Arg(0) ?? "";
                    if (Uri.TryCreate(u, UriKind.Absolute, out var uri) && uri.Scheme == "https") Abrir(u);
                }
                break;

            // O PASSO DE VOLUME DEVOLVIDO AO SISTEMA, com a UI DELE — o análogo
            // exato do `adjustStreamVolume(..., FLAG_SHOW_UI)`. É o que
            // acontece quando o fader do app chega ao fim.
            case "systemVolume":
                {
                    var passo = int.TryParse(Arg(0), out var p) ? p : 0;
                    if (passo != 0)
                    {
                        var t = passo > 0 ? Win32.VK_VOLUME_UP : Win32.VK_VOLUME_DOWN;
                        Win32.keybd_event(t, 0, 0, UIntPtr.Zero);
                        Win32.keybd_event(t, 0, Win32.KEYEVENTF_KEYUP, UIntPtr.Zero);
                    }
                }
                break;

            // A MÁQUINA NÃO DORME COM CULTO NO AR. É o par do wake lock do
            // Android, e as duas razões da ponte chegam por métodos diferentes
            // (`keepAlive` = download em curso; `projecaoLocal` = a preview É a
            // projeção). Aqui as duas viram a mesma coisa, e por isso são
            // CONTADAS: desligar uma não pode desligar a outra.
            case "keepAlive":
                Acordado("keepAlive", Arg(0) == "true");
                break;
            case "projecaoLocal":
                Acordado("projecao", Arg(0) == "true");
                break;

            // O TEMA. No Android ele vira os ícones das barras e o
            // `windowBackground`; aqui não há barra do sistema dentro da
            // janela, e o que sobra é o fundo que o WebView2 pinta ANTES de a
            // página existir — o mesmo papel do `windowBackground`, e o mesmo
            // motivo de ele existir: sem ele o primeiro quadro é branco.
            case "temaClaro":
                {
                    var claro = Arg(0) == "true";
                    foreach (var papel in new[] { "controle", "display" })
                    {
                        var j = _janelaDe(papel);
                        if (j?.Controlador is not null)
                        {
                            j.Controlador.DefaultBackgroundColor =
                                claro ? System.Drawing.Color.FromArgb(255, 0xF2, 0xF4, 0xF7)
                                      : System.Drawing.Color.FromArgb(255, 0x14, 0x18, 0x1D);
                        }
                    }
                }
                break;

            // O MICROFONE. No Android há uma permissão de sistema a pedir; no
            // Windows quem pergunta é o WebView2, no `PermissionRequested` — e
            // é lá que a regra mora (só áudio, só no Telão, só do próprio
            // origin). Aqui a resposta é "pode pedir": a decisão real acontece
            // no instante do `getUserMedia`.
            case "requestMic":
                Resolver("true");
                break;

            default:
                lock (_semDono) { if (!_semDono.Contains(c.Metodo)) _semDono.Add(c.Metodo); }
                Resolver("null");
                break;
        }
    }

    // ---------- não deixar a máquina dormir ----------

    readonly HashSet<string> _razoes = new();

    void Acordado(string razao, bool ligado)
    {
        lock (_razoes)
        {
            if (ligado) _razoes.Add(razao); else _razoes.Remove(razao);
            // ES_DISPLAY_REQUIRED junto de ES_SYSTEM_REQUIRED: um download
            // longo só precisa da máquina acordada, mas a projeção precisa da
            // TELA acesa — e separar os dois casos daria uma projeção que
            // apaga sozinha no meio da pregação por ninguém ter tocado no
            // teclado.
            SetThreadExecutionState(_razoes.Count > 0
                ? ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED
                : ES_CONTINUOUS);
        }
    }

    const uint ES_CONTINUOUS = 0x80000000;
    const uint ES_SYSTEM_REQUIRED = 0x00000001;
    const uint ES_DISPLAY_REQUIRED = 0x00000002;

    [DllImport("kernel32.dll")]
    static extern uint SetThreadExecutionState(uint estado);

    /// <summary>
    /// O que espera uma PESSOA sai da thread da interface.
    ///
    /// `IFileDialog.Show` bloqueia até o operador responder. Chamado na thread
    /// do laço, ele para o bombeamento de mensagens das DUAS janelas — a
    /// projeção inclusive —, e o que se vê é o programa travado durante todo o
    /// tempo em que alguém procura uma pasta.
    ///
    /// A thread é STA porque `IFileDialog` é COM de apartamento; fora dela o
    /// `CreateInstance` falha, e falha de um jeito que só aparece na máquina do
    /// operador.
    /// </summary>
    static void EmOutraThread(Action tarefa)
    {
        var t = new Thread(() =>
        {
            try { tarefa(); }
            catch (Exception e) { Console.Error.WriteLine("[casca] diálogo falhou: " + e); }
        });
        t.SetApartmentState(ApartmentState.STA);
        t.IsBackground = true;
        t.Start();
    }

    static void Abrir(string alvo)
    {
        try { Process.Start(new ProcessStartInfo(alvo) { UseShellExecute = true }); }
        catch (Exception e) { Console.Error.WriteLine("[casca] não abriu " + alvo + ": " + e.Message); }
    }
}
