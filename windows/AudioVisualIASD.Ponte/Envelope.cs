namespace AudioVisualIASD.Ponte;

/// <summary>
/// O ENVELOPE DA PONTE, do lado da casca — o TERCEIRO escritor do formato.
///
/// Os outros dois são a folha injetada (`windows/casca/ponte.js`) e o
/// `NucleoPonte.kt`. O formato está descrito por extenso no KDoc daquele, e o
/// contrato entre as três escritas mora em
/// `tools/fixtures/ponte-envelope.json` — escrito à mão, e lido pelos três
/// oráculos.
///
/// <code>
/// AV1\n &lt;id&gt;\n &lt;metodo&gt;\n &lt;quantos&gt;\n  (&lt;bytes&gt;\n &lt;o argumento&gt;\n)*
/// </code>
///
/// A quebra depois de cada argumento é a CONFERÊNCIA: sem ela um comprimento
/// errado por um byte desloca todos os argumentos seguintes e o envelope
/// continua parseando, com o texto trocado de lugar.
/// </summary>
public static class Envelope
{
    public const string Marca = "AV1";
    public const int TetoCorpo = 1024 * 1024;
    public const int TetoArgs = 8;

    public sealed record Chamada(string Id, string Metodo, IReadOnlyList<string> Args);

    static bool MetodoValido(string m) =>
        m.Length is > 0 and <= 40 && m[0] is >= 'a' and <= 'z' &&
        m.All(c => c is >= 'a' and <= 'z' or >= 'A' and <= 'Z' or >= '0' and <= '9');

    static bool IdValido(string s) =>
        s.Length is > 0 and <= 64 && s.All(c => c >= 0x21 && c <= 0x7E);

    /// <summary>Lê um envelope. <c>null</c> para qualquer coisa que não seja um
    /// envelope INTEIRO e bem formado — não há meio-envelope.</summary>
    public static Chamada? Ler(byte[] corpo)
    {
        int p = 0;

        string? Linha()
        {
            int q = Array.IndexOf(corpo, (byte)'\n', p);
            if (q < 0) return null;
            var s = System.Text.Encoding.UTF8.GetString(corpo, p, q - p);
            p = q + 1;
            return s;
        }

        if (Linha() != Marca) return null;
        var id = Linha();
        if (id is null || !IdValido(id)) return null;
        var metodo = Linha();
        if (metodo is null || !MetodoValido(metodo)) return null;
        var quantosTxt = Linha();
        if (quantosTxt is null || !int.TryParse(quantosTxt, out var quantos)) return null;
        if (quantos < 0 || quantos > TetoArgs) return null;

        var args = new List<string>(quantos);
        for (var i = 0; i < quantos; i++)
        {
            var tamTxt = Linha();
            if (tamTxt is null || !int.TryParse(tamTxt, out var tam)) return null;
            if (tam < 0 || tam > corpo.Length - p) return null;
            args.Add(System.Text.Encoding.UTF8.GetString(corpo, p, tam));
            p += tam;
            if (p >= corpo.Length || corpo[p] != (byte)'\n') return null;
            p++;
        }
        // Sobra depois do último argumento é malformado: aceitá-la deixaria um
        // segundo envelope colado passar despercebido.
        return p != corpo.Length ? null : new Chamada(id, metodo, args);
    }

    public static byte[] Montar(string id, string metodo, IReadOnlyList<string> args)
    {
        var fora = new MemoryStream();
        void Texto(string s) { var b = System.Text.Encoding.UTF8.GetBytes(s); fora.Write(b, 0, b.Length); }
        Texto($"{Marca}\n{id}\n{metodo}\n{args.Count}\n");
        foreach (var a in args)
        {
            var b = System.Text.Encoding.UTF8.GetBytes(a);
            // O comprimento é em BYTES, não em caracteres: 'Ó' são dois.
            Texto(b.Length + "\n");
            fora.Write(b, 0, b.Length);
            fora.WriteByte((byte)'\n');
        }
        return fora.ToArray();
    }

    // ---------- O CANO ----------
    //
    // Uma linha de comprimento na frente, para que [Ler] continue sendo o único
    // parser do formato. Um leitor incremental seria um SEGUNDO parser da mesma
    // gramática, e duas escritas dela divergem no primeiro ajuste.

    public static void EscreverNoCano(Stream saida, byte[] envelope)
    {
        var cab = System.Text.Encoding.ASCII.GetBytes(envelope.Length + "\n");
        saida.Write(cab, 0, cab.Length);
        saida.Write(envelope, 0, envelope.Length);
        saida.Flush();
    }

    /// <summary>Lê um envelope do cano. <c>null</c> = o outro lado fechou, que
    /// é o desfecho NORMAL de encerrar o programa.</summary>
    public static byte[]? LerDoCano(Stream entrada)
    {
        var n = new System.Text.StringBuilder();
        while (true)
        {
            var b = entrada.ReadByte();
            if (b < 0) return null;
            if (b == '\n') break;
            if (n.Length >= 12) return null;
            n.Append((char)b);
        }
        if (!int.TryParse(n.ToString(), out var tam)) return null;
        if (tam < 0 || tam > TetoCorpo) return null;
        var buf = new byte[tam];
        var lidos = 0;
        while (lidos < tam)
        {
            var r = entrada.Read(buf, lidos, tam - lidos);
            if (r <= 0) return null;
            lidos += r;
        }
        return buf;
    }

    /// <summary>
    /// Escape de string JSON. Ele existe aqui pelo mesmo motivo do
    /// `NucleoPonte.aspas`: os quadros que descem SÃO JSON (quem os lê é o
    /// navegador, que tem `JSON.parse` de graça), e a casca monta os valores
    /// que ela responde.
    /// </summary>
    public static string Aspas(string s)
    {
        var b = new System.Text.StringBuilder(s.Length + 2);
        b.Append('"');
        foreach (var c in s)
        {
            switch (c)
            {
                case '"': b.Append("\\\""); break;
                case '\\': b.Append("\\\\"); break;
                case '\n': b.Append("\\n"); break;
                case '\r': b.Append("\\r"); break;
                case '\t': b.Append("\\t"); break;
                default:
                    if (c < 0x20) b.Append("\\u").Append(((int)c).ToString("x4"));
                    else b.Append(c);
                    break;
            }
        }
        return b.Append('"').ToString();
    }
}
