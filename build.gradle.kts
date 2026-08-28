// Build raiz — só declara os plugins usados pelos módulos `:app` e `:core`.
plugins {
    id("com.android.application") version "8.7.3" apply false
    id("org.jetbrains.kotlin.android") version "2.0.21" apply false
    // O `:core` é JVM puro: sem Android, sem AGP. A versão do Kotlin é a MESMA
    // do plugin Android acima — duas versões diferentes de compilador para o
    // mesmo código-fonte é a forma mais silenciosa de as duas cascas
    // divergirem.
    id("org.jetbrains.kotlin.jvm") version "2.0.21" apply false
}
