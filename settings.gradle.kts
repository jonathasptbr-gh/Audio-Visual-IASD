pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        // JitPack, e SÓ para o NewPipeExtractor (ver o `dependencies` do app e
        // a exceção registrada no CLAUDE.md). O filtro por grupo é a diferença
        // entre "abrimos uma porta para uma biblioteca" e "abrimos o projeto
        // para qualquer coisa que alguém publique num repositório de builds
        // automáticos de GitHub".
        maven {
            url = uri("https://jitpack.io")
            content { includeGroupByRegex("com\\.github\\.TeamNewPipe.*") }
        }
    }
}

rootProject.name = "AudioVisualIASD"

// `:core` — A LÓGICA QUE NÃO SABE EM QUE PLATAFORMA ESTÁ.
//
// Ele existe porque metade do Kotlin deste projeto nunca foi Android: seis
// arquivos com ZERO import de `android.*`, já cobertos por JUnit no CI. Eles
// eram Android só por morarem no módulo do app.
//
// Separá-los tem dois efeitos, e o segundo é o que motiva o módulo: o compilador
// passa a IMPEDIR que uma dependência de plataforma entre neles por descuido (a
// pureza deixa de ser uma promessa de comentário e vira erro de compilação), e a
// mesma lógica passa a poder ser hospedada por uma segunda casca — a de
// computador — sem uma linha duplicada.
include(":core")
include(":app")
