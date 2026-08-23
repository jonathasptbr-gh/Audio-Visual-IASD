package br.org.iasd.av

import android.app.AppOpsManager
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject

/**
 * POR QUE O MICROFONE NÃO ABRE — as perguntas que só o SHELL sabe responder.
 *
 * ## O que este arquivo existe para acabar
 *
 * Quatro rodadas de investigação pelo lado web terminaram no mesmo lugar:
 * `getUserMedia` devolve `NotReadableError` nas TRÊS configurações (com eco, sem
 * eco, cru), em AMBOS os WebViews, com `RECORD_AUDIO` concedida e uma entrada de
 * áudio enumerada. Do lado web não sobra pergunta a fazer: a permissão está lá,
 * o dispositivo está lá, e todas as restrições foram afrouxadas.
 *
 * A assinatura disso é conhecida e o navegador não a enxerga: **`AppOps` pode
 * NEGAR `RECORD_AUDIO` enquanto `checkSelfPermission` devolve `GRANTED`**. É o
 * mecanismo do interruptor de privacidade do Android, dos controles próprios do
 * fabricante (o Auto Blocker da Samsung, por exemplo, sobre app instalado fora
 * da loja) e do "mudo" global do microfone. Nos três a permissão continua
 * concedida e a abertura falha — que é exatamente o que o Registro mostrou.
 *
 * ## O que ele NÃO faz
 *
 * Não abre o microfone, não pede permissão, não muda nada. É leitura, e toda
 * ela é API PÚBLICA sem permissão adicional — `AppOpsManager`, `AudioManager`.
 * O veredito continua sendo montado pelo `controle.js` (invariante 5): aqui só
 * saem os fatos, em JSON.
 */
object MicDiag {

    /**
     * Devolve o que o sistema sabe sobre a captura de áudio, agora.
     *
     * Toda leitura é embrulhada: um fabricante que recuse um `AudioManager` numa
     * chamada específica não pode derrubar o diagnóstico inteiro — um bloco que
     * some é uma linha a menos no Registro, um `throw` é o bloco todo perdido.
     */
    fun paraJson(ctx: Context): JSONObject {
        val o = JSONObject()

        // 1. A PERMISSÃO, como o app a vê. É a que o `requestMic` já consultava,
        //    e ela vinha CONCEDIDA — por isso sozinha ela não explica nada. Entra
        //    para o Registro poder afirmar a contradição em vez de supô-la.
        o.put(
            "permissao",
            runCatching {
                ctx.checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) ==
                    PackageManager.PERMISSION_GRANTED
            }.getOrNull() ?: JSONObject.NULL,
        )

        // 1-B. A OUTRA PERMISSÃO — a que o Chromium exige e o Android não.
        //    `AudioManagerAndroid.hasPermission()` consulta o
        //    `checkSelfPermission` do app HOSPEDEIRO, então sem
        //    `MODIFY_AUDIO_SETTINGS` o `setCommunicationDevice()` devolve
        //    `false`, `MakeLowLatencyInputStream` devolve `nullptr`, e TODA
        //    abertura de áudio morre em `NotReadableError` antes de qualquer
        //    restrição ser negociada. Ela é `normal` (concedida na instalação,
        //    invisível na tela de permissões), e foi a causa do defeito que este
        //    arquivo nasceu para diagnosticar.
        //
        //    FICA depois do conserto, e é isso que a torna útil: ela responde
        //    "o APK instalado JÁ TEM o conserto?" — a pergunta que separa
        //    "continua quebrado" de "é outra coisa".
        o.put(
            "modAudio",
            runCatching {
                ctx.checkSelfPermission(android.Manifest.permission.MODIFY_AUDIO_SETTINGS) ==
                    PackageManager.PERMISSION_GRANTED
            }.getOrNull() ?: JSONObject.NULL,
        )

        // 2. O APPOPS — a resposta que faltava. `checkSelfPermission` lê a
        //    concessão; o AppOps lê se ela está VALENDO agora. É aqui que o
        //    interruptor de privacidade e os controles do fabricante aparecem, e
        //    é a única leitura deste arquivo capaz de explicar sozinha o
        //    `NotReadableError` com tudo o mais em ordem.
        o.put("appops", runCatching { appOps(ctx) }.getOrDefault("?"))

        val am = runCatching { ctx.getSystemService(Context.AUDIO_SERVICE) as? AudioManager }
            .getOrNull()

        // 3. O MUDO GLOBAL. Separado do AppOps de propósito: são interruptores
        //    diferentes, e um Registro que os confundisse mandaria mexer no lugar
        //    errado.
        o.put("mudo", runCatching { am?.isMicrophoneMute }.getOrNull() ?: JSONObject.NULL)

        // 4. O MODO DE ÁUDIO. `MODE_IN_CALL`/`MODE_IN_COMMUNICATION` é uma
        //    chamada em curso — a causa que a frase da tela sempre acusou e que
        //    nunca foi verificada. Agora ela é um fato, não um palpite.
        o.put("modo", runCatching { am?.mode }.getOrNull() ?: JSONObject.NULL)

        // 5. QUEM ESTÁ GRAVANDO AGORA. A outra metade da mesma acusação: se
        //    outro app segura o microfone, é aqui que ele aparece. A lista vem
        //    ANONIMIZADA (sem `MODIFY_AUDIO_ROUTING`, que este APK nunca terá,
        //    cada entrada volta com uid -1 e pacote vazio) mas COMPLETA: a
        //    contagem é do APARELHO INTEIRO, e é por isso que ela pode acusar
        //    outro app. Ainda assim ZERO não prova ausência — um `AudioRecord`
        //    construído e não iniciado não aparece —, e é por isso que o campo é
        //    a CONTAGEM e o veredito do web fala em "nenhuma sessão VISÍVEL".
        o.put(
            "gravando",
            runCatching { am?.activeRecordingConfigurations?.size }.getOrNull()
                ?: JSONObject.NULL,
        )

        // 6. AS ENTRADAS QUE O SISTEMA ENXERGA, com tipo e nome. O navegador já
        //    contava as dele; esta lista é INDEPENDENTE dele, e a diferença entre
        //    as duas é informação: um microfone que o sistema lista e o navegador
        //    não é um problema do WebView, não do aparelho.
        val entradas = JSONArray()
        runCatching {
            am?.getDevices(AudioManager.GET_DEVICES_INPUTS)?.forEach { d ->
                entradas.put(
                    JSONObject()
                        .put("tipo", nomeDoTipo(d.type))
                        .put("nome", d.productName?.toString() ?: ""),
                )
            }
        }
        o.put("entradas", entradas)
        return o
    }

    /**
     * O estado do AppOps para `RECORD_AUDIO`, em texto.
     *
     * `unsafeCheckOpNoThrow` é da API 29; abaixo dela o nome é `checkOpNoThrow`,
     * que existe desde a 19 e continua funcionando. O `minSdk` do projeto é 26,
     * então os dois ramos são alcançáveis em aparelho de verdade.
     */
    private fun appOps(ctx: Context): String {
        val aom = ctx.getSystemService(Context.APP_OPS_SERVICE) as? AppOpsManager
            ?: return "?"
        val modo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            aom.unsafeCheckOpNoThrow(
                AppOpsManager.OPSTR_RECORD_AUDIO, android.os.Process.myUid(), ctx.packageName,
            )
        } else {
            @Suppress("DEPRECATION")
            aom.checkOpNoThrow(
                AppOpsManager.OPSTR_RECORD_AUDIO, android.os.Process.myUid(), ctx.packageName,
            )
        }
        return when (modo) {
            AppOpsManager.MODE_ALLOWED -> "permitido"
            // O DESFECHO MAIS PROVÁVEL, e sem este ramo ele saía como "modo 4".
            // Do Android 10 em diante, `RECORD_AUDIO` concedida no padrão
            // ("Permitir apenas ao usar o app") devolve MODE_FOREGROUND aqui —
            // e isso é PERMITIDO com o app na frente, que é o único momento em
            // que este diagnóstico roda. Lido pelo `else`, o Registro acusaria
            // bloqueio no estado NORMAL do aparelho: a frase certa pela razão
            // errada, num log que é lido a distância.
            AppOpsManager.MODE_FOREGROUND -> "primeiro plano"
            AppOpsManager.MODE_IGNORED -> "bloqueado"      // silencioso: o app "grava" e não vem som
            AppOpsManager.MODE_ERRORED -> "recusado"       // a abertura FALHA — o nosso caso
            AppOpsManager.MODE_DEFAULT -> "padrao"
            else -> "modo $modo"
        }
    }

    /** O tipo do dispositivo por extenso — o número sozinho não diz nada a quem lê. */
    private fun nomeDoTipo(t: Int): String = when (t) {
        AudioDeviceInfo.TYPE_BUILTIN_MIC -> "microfone embutido"
        AudioDeviceInfo.TYPE_BLUETOOTH_SCO -> "Bluetooth (SCO)"
        AudioDeviceInfo.TYPE_WIRED_HEADSET -> "fone com fio"
        AudioDeviceInfo.TYPE_USB_DEVICE -> "USB"
        AudioDeviceInfo.TYPE_USB_HEADSET -> "fone USB"
        AudioDeviceInfo.TYPE_TELEPHONY -> "telefonia"
        AudioDeviceInfo.TYPE_REMOTE_SUBMIX -> "submix remoto (espelhamento)"
        else -> "tipo $t"
    }
}
