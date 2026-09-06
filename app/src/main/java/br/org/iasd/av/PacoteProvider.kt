package br.org.iasd.av

import androidx.core.content.FileProvider

/**
 * O `FileProvider` do PACOTE DE TRANSFERÊNCIA — uma subclasse VAZIA, e ela é a
 * correção inteira do "0 KB" (v1.8.22).
 *
 * **DOIS `<provider>` COM A MESMA `android:name` COMPARTILHAM UMA INSTÂNCIA, E
 * COM ELA A TABELA DE CAMINHOS DO PRIMEIRO.** `ActivityThread.installProvider`
 * guarda o provedor local num mapa chaveado por `ComponentName(pacote, CLASSE)`
 * — não por autoridade —, então o segundo a subir encontra o primeiro no mapa e
 * publica o objeto DELE. Este app declarava as duas autoridades sobre
 * `androidx.core.content.FileProvider`: a `.apk` (que mapeia `cache/apk/`) e a
 * `.pacote` (que mapeia `files/pacote/`).
 *
 * O modo de falhar é o pior possível, porque ele é ASSIMÉTRICO e MUDO deste
 * lado:
 *
 * - `FileProvider.getUriForFile` é ESTÁTICO e resolve a tabela pela AUTORIDADE,
 *   consultando o `PackageManager`. A URI sai CERTA, e o seletor abre.
 * - quem SERVE é a instância compartilhada, cuja tabela só conhece
 *   `cache/apk/`. O `query` do outro app não acha raiz para `pacote/…` e
 *   levanta `IllegalArgumentException` — o receptor lê **0 B** e a leitura
 *   falha.
 * - e a `.apk` continua funcionando, porque ela é a PRIMEIRA. Foi essa
 *   assimetria que manteve o defeito de pé: o mesmo mecanismo instala a
 *   atualização do app todo mês.
 *
 * A subclasse trivial desfaz tudo isso por CONSTRUÇÃO — duas classes, dois
 * `ComponentName`, duas instâncias, duas tabelas. Não há o que manter aqui, e é
 * de propósito: qualquer código neste arquivo seria código que a
 * `androidx.core.content.FileProvider` já tem.
 *
 * **Autoridade nova = classe nova.** O oráculo `manifest-provedores.test.mjs`
 * cobra isso, porque nada no build detecta a colisão e ela não aparece em
 * teste de comportamento nenhum deste lado.
 */
class PacoteProvider : FileProvider()
