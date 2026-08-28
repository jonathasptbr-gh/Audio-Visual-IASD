using System.Diagnostics;
using AudioVisualIASD.Ponte;

namespace AudioVisualIASD;

/// <summary>
/// O PROCESSO DO NÚCLEO e o cano que fala com ele.
///
/// O núcleo é o `nucleo.jar` — o Kotlin que já existe, rodando numa JVM sem
/// janela. Ele serve a base web às janelas do programa e responde a ponte;
/// esta casca responde só o que precisa de uma janela ou do sistema operacional.
///
/// ## Ele morre com a casca, dos DOIS lados
///
/// O núcleo termina quando o cano fecha (é o `while` do `NucleoMain`), e a
/// casca mata o processo no encerramento. As duas guardas cobrem coisas
/// diferentes: a primeira sobrevive a um encerramento brusco da casca, a
/// segunda a uma JVM que trave sem ler o cano.
///
/// **Uma JVM órfã é o pior desfecho possível deste desenho:** ela continua
/// segurando a porta, e a porta é a ORIGEM. A abertura seguinte receberia a
/// recusa de porta ocupada, e o operador leria "feche a outra cópia" sem ter
/// nenhuma cópia na tela.
/// </summary>
internal sealed class Nucleo : IDisposable
{
    readonly Process _p;
    readonly Action<Envelope.Chamada> _daPonte;
    readonly object _trava = new();
    Thread? _leitor;

    internal Nucleo(string java, string jar, string raizWeb, int porta, Action<Envelope.Chamada> daPonte)
    {
        _daPonte = daPonte;
        _p = new Process
        {
            StartInfo = new ProcessStartInfo(java)
            {
                // Cada argumento numa entrada da coleção: passar uma linha de
                // comando montada à mão deixaria um caminho com espaço —
                // `C:\Program Files\...`, o caso NORMAL no Windows — quebrar em
                // dois argumentos.
                ArgumentList = { "-jar", jar, "--raiz", raizWeb, "--porta", porta.ToString() },
                RedirectStandardInput = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            },
        };
        _p.ErrorDataReceived += (_, e) => { if (e.Data is not null) Diario.Anotar("[nucleo] " + e.Data); };
    }

    /// <summary>
    /// Sobe o núcleo e espera o primeiro envelope: `pronto` ou `recusa`.
    /// Devolve `null` em sucesso, ou A FRASE — que a casca mostra **sem
    /// traduzir**. Quem decidiu é quem sabe o que dizer, e uma segunda escrita
    /// da explicação envelhece à parte (é a regra do `EspelhoDiag`).
    /// </summary>
    internal string? Ligar()
    {
        try { _p.Start(); }
        catch (Exception e)
        {
            return "Não foi possível iniciar o Java: " + e.Message +
                   "\n\nO programa precisa do Java, que costuma vir junto na instalação.";
        }
        _p.BeginErrorReadLine();

        var saida = _p.StandardOutput.BaseStream;
        // O APERTO DE MÃO TEM PRAZO, e sem ele a falha é a pior possível: uma
        // JVM que suba e não escreva nada — porque o jar não está lá, porque o
        // `Main-Class` está errado, porque uma exceção saiu antes do primeiro
        // envelope — deixaria o programa **pendurado para sempre**, sem janela,
        // sem mensagem e sem nada na tela dizendo por quê. `LerDoCano` bloqueia
        // em `ReadByte()` e só desiste com fim de fluxo.
        //
        // 30 s é generoso de propósito: uma JVM fria num computador de igreja
        // leva segundos, e o custo de um prazo curto é recusar um programa que
        // ia funcionar.
        var espera = Task.Run(() => Envelope.LerDoCano(saida));
        if (!espera.Wait(TimeSpan.FromSeconds(30)))
        {
            return "A parte interna do programa não respondeu a tempo. " +
                   "Feche e abra de novo; se continuar, reinstale.";
        }
        var primeiro = espera.Result;
        var c = primeiro is null ? null : Envelope.Ler(primeiro);
        if (c is null)
        {
            return "O programa não conseguiu iniciar: a parte interna não respondeu.";
        }
        if (c.Metodo == "recusa") return c.Args.FirstOrDefault() ?? "O programa não conseguiu iniciar.";
        if (c.Metodo != "pronto") return "O programa não conseguiu iniciar: resposta inesperada da parte interna.";

        _leitor = new Thread(() =>
        {
            while (true)
            {
                var env = Envelope.LerDoCano(saida);
                if (env is null) break;
                var ch = Envelope.Ler(env);
                if (ch is null) continue;
                // Uma chamada que lance não pode derrubar o leitor: as janelas
                // ficariam de pé com a ponte muda, e nada na tela diria por quê.
                try { _daPonte(ch); }
                catch (Exception e) { Diario.Anotar("[casca] chamada falhou: " + e); }
            }
        }) { IsBackground = true, Name = "cano-do-nucleo" };
        _leitor.Start();
        return null;
    }

    /// <summary>Manda um envelope ao núcleo. Serializado: o cano é um só, e
    /// duas escritas concorrentes intercalariam o comprimento com os bytes.</summary>
    internal void Mandar(string id, string metodo, IReadOnlyList<string> args)
    {
        lock (_trava)
        {
            try { Envelope.EscreverNoCano(_p.StandardInput.BaseStream, Envelope.Montar(id, metodo, args)); }
            catch (Exception e) { Diario.Anotar("[casca] o cano fechou: " + e.Message); }
        }
    }

    /// <summary>A resposta de um método da ponte, endereçada à janela que
    /// perguntou. [valorJson] é JSON JÁ PRONTO — quem o monta é quem sabe o que
    /// ele é, e o núcleo só o transporta.</summary>
    internal void Resolver(string sessao, string id, string valorJson) =>
        Mandar("-", "resolver", new[] { sessao, id, valorJson });

    internal void RegistrarSessao(string sessao, string papel) =>
        Mandar("-", "sessao", new[] { sessao, papel });

    internal void FechouSessao(string sessao) => Mandar("-", "fechou", new[] { sessao });

    public void Dispose()
    {
        try { _p.StandardInput.Close(); } catch { /* já fechado */ }
        // Prazo curto: o núcleo sai sozinho quando o cano fecha, e insistir
        // além disso só atrasaria o encerramento diante de uma JVM travada —
        // que é justamente o caso em que matar é a resposta certa.
        try { if (!_p.WaitForExit(3000)) _p.Kill(entireProcessTree: true); } catch { /* já morreu */ }
        _p.Dispose();
    }
}
