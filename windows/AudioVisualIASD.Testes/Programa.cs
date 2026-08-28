using System.Text;
using System.Text.Json;
using AudioVisualIASD.Ponte;

// A TERCEIRA METADE do envelope da ponte.
//
// As outras duas são `tools/ponte-envelope.test.mjs` (o produtor JavaScript) e
// `NucleoPonteTest` (o par Kotlin). As três leem AS MESMAS fixtures, escritas à
// mão, e nenhuma delas as gera — se gerassem, cada oráculo provaria que um lado
// concorda consigo mesmo, que é exatamente o que não se enxerga lendo um lado
// de cada vez. Este projeto já pagou por isso duas vezes: o `__tela` do
// `display-ready` e o `TIPOS_QUE_SOBEM` do dreno.
//
// Ele roda em LINUX de propósito (`net8.0`, sem `-windows`): o contrato não
// pode esperar por uma máquina com Windows para ser conferido.

var raiz = Raiz();
var fix = JsonDocument.Parse(File.ReadAllText(Path.Combine(raiz, "tools/fixtures/ponte-envelope.json")));
var falhas = 0;

void Checar(bool ok, string oQue)
{
    if (ok) return;
    falhas++;
    Console.Error.WriteLine("  x " + oQue);
}

Console.WriteLine("envelopes bons:");
foreach (var c in fix.RootElement.GetProperty("bons").EnumerateArray())
{
    var nome = c.GetProperty("nome").GetString()!;
    var fio = c.GetProperty("fio").GetString()!;
    var id = c.GetProperty("id").GetString()!;
    var metodo = c.GetProperty("metodo").GetString()!;
    var esperados = c.GetProperty("args").EnumerateArray().Select(a => a.GetString()!).ToList();
    var bytes = Encoding.UTF8.GetBytes(fio);

    // A metade CONSUMIDORA.
    var lido = Envelope.Ler(bytes);
    if (lido is null) { Checar(false, nome + ": nao leu"); continue; }
    Checar(lido.Id == id, $"{nome}: id {lido.Id} != {id}");
    Checar(lido.Metodo == metodo, $"{nome}: metodo {lido.Metodo} != {metodo}");
    Checar(lido.Args.SequenceEqual(esperados), $"{nome}: argumentos {string.Join("|", lido.Args)}");

    // A metade PRODUTORA — e' ela que fala com o nucleo pelo cano.
    var montado = Envelope.Montar(id, metodo, esperados);
    Checar(montado.SequenceEqual(bytes),
        $"{nome}: o produtor C# diverge da fixture\n     esperado: {fio.Replace("\n", "\\n")}\n     produziu: {Encoding.UTF8.GetString(montado).Replace("\n", "\\n")}");

    Checar(Encoding.UTF8.GetByteCount(fio) == c.GetProperty("bytes").GetInt32(),
        $"{nome}: a fixture nao bate consigo mesma");

    Console.WriteLine("  . " + nome);
}

// A METADE DAS RECUSAS. Um parser que recusa tudo passa em qualquer teste que
// so' olhe as recusas — por isso ela vem DEPOIS da de cima, nunca sozinha.
Console.WriteLine("malformados:");
foreach (var c in fix.RootElement.GetProperty("malformados").EnumerateArray())
{
    var nome = c.GetProperty("nome").GetString()!;
    var bytes = Encoding.UTF8.GetBytes(c.GetProperty("fio").GetString()!);
    Checar(Envelope.Ler(bytes) is null, nome + ": ACEITOU um envelope malformado");
}

// ---------- O CANO ----------
{
    var m = new MemoryStream();
    Envelope.EscreverNoCano(m, Envelope.Montar("a:1", "listFolder", new[] { "x" }));
    // O segundo prova o enquadramento: um argumento com quebra de linha dentro
    // passaria batido numa leitura por linhas.
    Envelope.EscreverNoCano(m, Envelope.Montar("a:2", "salvarTexto", new[] { "r.txt", "linha1\nlinha2" }));
    m.Position = 0;
    Checar(Envelope.Ler(Envelope.LerDoCano(m)!)!.Metodo == "listFolder", "o cano desenquadra o primeiro");
    var dois = Envelope.Ler(Envelope.LerDoCano(m)!)!;
    Checar(dois.Args.SequenceEqual(new[] { "r.txt", "linha1\nlinha2" }), "e o segundo, com quebra dentro");
    Checar(Envelope.LerDoCano(m) is null, "e o fim do cano e' `null`, nao uma excecao");

    Checar(Envelope.LerDoCano(new MemoryStream(Encoding.ASCII.GetBytes("999999999\n"))) is null,
        "comprimento absurdo e' recusado — ninguem nos faz alocar pedindo");
}

// ---------- O ESCAPE ----------
Checar(Envelope.Aspas("a\"b\\c") == "\"a\\\"b\\\\c\"", "o escape fecha aspas e barra");
Checar(!Envelope.Aspas("linha1\nlinha2").Contains('\n'),
    "nenhuma quebra CRUA sai do escape — ela terminaria o evento SSE no meio");

if (falhas > 0)
{
    Console.Error.WriteLine($"\n{falhas} asercao(oes) reprovada(s)");
    return 1;
}
Console.WriteLine("\nenvelope (casca): tudo certo");
return 0;

// A raiz do repositorio, subindo do binario ate' achar a fixture — assim o
// oraculo roda tanto por `dotnet run` quanto pelo binario publicado.
static string Raiz()
{
    var d = AppContext.BaseDirectory;
    for (var i = 0; i < 8; i++)
    {
        if (File.Exists(Path.Combine(d, "tools/fixtures/ponte-envelope.json"))) return d;
        d = Path.GetFullPath(Path.Combine(d, ".."));
    }
    throw new FileNotFoundException("nao achei tools/fixtures/ponte-envelope.json subindo de " + AppContext.BaseDirectory);
}
