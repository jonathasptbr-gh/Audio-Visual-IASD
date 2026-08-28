using System.Runtime.InteropServices;

namespace AudioVisualIASD;

/// <summary>
/// OS DIÁLOGOS DE ARQUIVO — o par do SAF do Android.
///
/// `IFileOpenDialog`/`IFileSaveDialog` e não o `GetOpenFileName` de comdlg32:
/// o legado não sabe escolher PASTA, e escolher pasta é metade do que este
/// arquivo existe para fazer (a sincronização de uma pasta do computador é o
/// `pickFolder` da ponte). Um caminho moderno para tudo é melhor que dois
/// caminhos com regras diferentes.
///
/// **Nada aqui decide nada de culto** (invariante 5): o diálogo devolve
/// CAMINHOS, e quem os transforma em URLs servíveis é o núcleo — porque é ele
/// que vai servir os bytes, e porque o token é ligado à sessão da janela, que é
/// o que impede o Telão de alcançar o disco do operador.
/// </summary>
internal static class Dialogos
{
    // ---------- COM ----------

    [ComImport, Guid("42f85136-db7e-439c-85f1-e4075d135fc8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IFileDialog
    {
        [PreserveSig] int Show(IntPtr pai);
        void SetFileTypes(uint quantos, IntPtr filtros);
        void SetFileTypeIndex(uint i);
        void GetFileTypeIndex(out uint i);
        void Advise(IntPtr ouvinte, out uint cookie);
        void Unadvise(uint cookie);
        void SetOptions(uint opcoes);
        void GetOptions(out uint opcoes);
        void SetDefaultFolder(IShellItem item);
        void SetFolder(IShellItem item);
        void GetFolder(out IShellItem item);
        void GetCurrentSelection(out IShellItem item);
        void SetFileName([MarshalAs(UnmanagedType.LPWStr)] string nome);
        void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string nome);
        void SetTitle([MarshalAs(UnmanagedType.LPWStr)] string titulo);
        void SetOkButtonLabel([MarshalAs(UnmanagedType.LPWStr)] string texto);
        void SetFileNameLabel([MarshalAs(UnmanagedType.LPWStr)] string texto);
        void GetResult(out IShellItem item);
        void AddPlace(IShellItem item, int onde);
        void SetDefaultExtension([MarshalAs(UnmanagedType.LPWStr)] string ext);
        void Close(int hr);
        void SetClientGuid(ref Guid g);
        void ClearClientData();
        void SetFilter(IntPtr filtro);
    }

    [ComImport, Guid("d57c7288-d4ad-4768-be02-9d969532d960"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IFileOpenDialog : IFileDialog
    {
        // Os membros herdados PRECISAM ser redeclarados: o marshaller de COM
        // monta a vtable pela ordem de declaração da interface, e uma herança
        // de C# não a reproduz. Faltando um, todos os índices seguintes
        // escorregam — e o que sai não é erro de compilação, é uma chamada
        // para o método errado.
        new int Show(IntPtr pai);
        new void SetFileTypes(uint quantos, IntPtr filtros);
        new void SetFileTypeIndex(uint i);
        new void GetFileTypeIndex(out uint i);
        new void Advise(IntPtr ouvinte, out uint cookie);
        new void Unadvise(uint cookie);
        new void SetOptions(uint opcoes);
        new void GetOptions(out uint opcoes);
        new void SetDefaultFolder(IShellItem item);
        new void SetFolder(IShellItem item);
        new void GetFolder(out IShellItem item);
        new void GetCurrentSelection(out IShellItem item);
        new void SetFileName([MarshalAs(UnmanagedType.LPWStr)] string nome);
        new void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string nome);
        new void SetTitle([MarshalAs(UnmanagedType.LPWStr)] string titulo);
        new void SetOkButtonLabel([MarshalAs(UnmanagedType.LPWStr)] string texto);
        new void SetFileNameLabel([MarshalAs(UnmanagedType.LPWStr)] string texto);
        new void GetResult(out IShellItem item);
        new void AddPlace(IShellItem item, int onde);
        new void SetDefaultExtension([MarshalAs(UnmanagedType.LPWStr)] string ext);
        new void Close(int hr);
        new void SetClientGuid(ref Guid g);
        new void ClearClientData();
        new void SetFilter(IntPtr filtro);

        void GetResults(out IShellItemArray itens);
        void GetSelectedItems(out IShellItemArray itens);
    }

    [ComImport, Guid("43826d1e-e718-42ee-bc55-a1e261c37bfe"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IShellItem
    {
        void BindToHandler(IntPtr bc, ref Guid bhid, ref Guid riid, out IntPtr ppv);
        void GetParent(out IShellItem pai);
        void GetDisplayName(uint sigdn, [MarshalAs(UnmanagedType.LPWStr)] out string nome);
        void GetAttributes(uint mascara, out uint atributos);
        void Compare(IShellItem outro, uint hint, out int ordem);
    }

    [ComImport, Guid("b63ea76d-1f85-456f-a19c-48159efa858b"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IShellItemArray
    {
        void BindToHandler(IntPtr bc, ref Guid bhid, ref Guid riid, out IntPtr ppv);
        void GetPropertyStore(uint flags, ref Guid riid, out IntPtr ppv);
        void GetPropertyDescriptionList(IntPtr chave, ref Guid riid, out IntPtr ppv);
        void GetAttributes(uint origem, uint mascara, out uint atributos);
        void GetCount(out uint quantos);
        void GetItemAt(uint i, out IShellItem item);
        void EnumItems(out IntPtr enumerador);
    }

    static readonly Guid CLSID_FileOpenDialog = new("dc1c5a9c-e88a-4dde-a5a1-60f82a20aef7");
    static readonly Guid CLSID_FileSaveDialog = new("c0b4e2f3-ba21-4773-8dba-335ec946eb8b");

    const uint FOS_PICKFOLDERS = 0x00000020;
    const uint FOS_ALLOWMULTISELECT = 0x00000200;
    const uint FOS_FILEMUSTEXIST = 0x00001000;
    const uint FOS_PATHMUSTEXIST = 0x00000800;
    const uint FOS_OVERWRITEPROMPT = 0x00000002;
    const uint FOS_FORCEFILESYSTEM = 0x00000040;
    /// <summary>O nome COMPLETO no sistema de arquivos — `SIGDN_FILESYSPATH`.
    /// Com `FOS_FORCEFILESYSTEM` junto, um item que não seja um arquivo de
    /// verdade (uma biblioteca, um item de nuvem) nem chega até aqui.</summary>
    const uint SIGDN_FILESYSPATH = 0x80058000;

    /// <summary>`S_OK`. `Show` devolve `HRESULT_FROM_WIN32(ERROR_CANCELLED)`
    /// quando o operador desiste — que é um desfecho, não um erro, e por isso
    /// `Show` é `[PreserveSig]`.</summary>
    const int S_OK = 0;

    static object Criar(Guid clsid)
    {
        var t = Type.GetTypeFromCLSID(clsid) ?? throw new InvalidOperationException("sem o diálogo do sistema");
        return Activator.CreateInstance(t) ?? throw new InvalidOperationException("sem o diálogo do sistema");
    }

    /// <summary>A pasta que o operador escolheu, ou `null` se desistiu.</summary>
    internal static string? EscolherPasta(IntPtr pai, string titulo)
    {
        var d = (IFileOpenDialog)Criar(CLSID_FileOpenDialog);
        d.GetOptions(out var o);
        d.SetOptions(o | FOS_PICKFOLDERS | FOS_FORCEFILESYSTEM | FOS_PATHMUSTEXIST);
        d.SetTitle(titulo);
        if (d.Show(pai) != S_OK) return null;
        d.GetResult(out var item);
        item.GetDisplayName(SIGDN_FILESYSPATH, out var caminho);
        return caminho;
    }

    /// <summary>
    /// Os arquivos escolhidos, ou lista vazia. Multisseleção LIGADA: o
    /// `pickDoc` do Android já devolve um array, e a importação de um culto é
    /// quase sempre mais de um arquivo.
    /// </summary>
    internal static List<string> EscolherArquivos(IntPtr pai, string titulo)
    {
        var fora = new List<string>();
        var d = (IFileOpenDialog)Criar(CLSID_FileOpenDialog);
        d.GetOptions(out var o);
        d.SetOptions(o | FOS_ALLOWMULTISELECT | FOS_FORCEFILESYSTEM | FOS_FILEMUSTEXIST);
        d.SetTitle(titulo);
        if (d.Show(pai) != S_OK) return fora;
        d.GetResults(out var itens);
        itens.GetCount(out var quantos);
        for (uint i = 0; i < quantos; i++)
        {
            itens.GetItemAt(i, out var item);
            item.GetDisplayName(SIGDN_FILESYSPATH, out var caminho);
            if (!string.IsNullOrEmpty(caminho)) fora.Add(caminho);
        }
        return fora;
    }

    /// <summary>
    /// O "Salvar como" do sistema. Devolve o caminho, ou `null`.
    ///
    /// Ele existe pela MESMA razão do Android: o WebView não tem
    /// `DownloadListener`, e um `&lt;a download&gt;` sobre um `blob:` ali não faz
    /// NADA — sem erro, sem arquivo. Quem escreve os bytes é a casca.
    /// </summary>
    internal static string? OndeSalvar(IntPtr pai, string nomeSugerido)
    {
        var d = (IFileDialog)Criar(CLSID_FileSaveDialog);
        d.GetOptions(out var o);
        d.SetOptions(o | FOS_OVERWRITEPROMPT | FOS_FORCEFILESYSTEM);
        d.SetFileName(nomeSugerido);
        var ponto = nomeSugerido.LastIndexOf('.');
        if (ponto > 0 && ponto < nomeSugerido.Length - 1) d.SetDefaultExtension(nomeSugerido[(ponto + 1)..]);
        if (d.Show(pai) != S_OK) return null;
        d.GetResult(out var item);
        item.GetDisplayName(SIGDN_FILESYSPATH, out var caminho);
        return caminho;
    }
}
