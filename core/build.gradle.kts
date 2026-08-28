// `:core` — A LÓGICA QUE NÃO SABE EM QUE PLATAFORMA ESTÁ.
//
// JVM PURO, e essa é a única regra deste módulo: aqui NÃO ENTRA
// `implementation` de nada de Android, nem de AndroidX, nem de biblioteca de
// UI. Não é preferência de arquitetura — é o que faz o compilador dizer "não"
// quando alguém, um ano depois, resolver "só logar uma coisinha" com
// `android.util.Log` num parser HTTP.
//
// O que mora aqui já era puro antes de o módulo existir (ZERO import de
// `android.*`), e já tinha JUnit rodando no CI sem `continue-on-error`. O lote
// que criou o módulo não alterou uma linha desses arquivos: ele só mudou o
// endereço deles, e é por isso que os mesmos testes continuam passando sem uma
// asserção nova.
plugins {
    id("org.jetbrains.kotlin.jvm")
}

kotlin {
    compilerOptions {
        // O MESMO alvo do `:app` (ver `compileOptions`/`kotlinOptions` lá).
        // Dois alvos diferentes para o mesmo código-fonte é a forma mais
        // silenciosa de as duas cascas divergirem.
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

dependencies {
    // A MESMA versão que o `:app` declarava. O JUnit não põe um byte em
    // artefato nenhum — é a terceira das quatro exceções declaradas no
    // `CLAUDE.md`, e a justificativa dela mudou de endereço junto com os
    // arquivos que a motivavam: o `EspelhoHttp` e o `EspelhoPares` são o
    // primeiro código deste projeto que aceita entrada de um desconhecido.
    testImplementation("junit:junit:4.13.2")
}
