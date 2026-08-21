# Achados em aberto

**Nenhum.** Os 21 da auditoria de 2026-08-20 foram corrigidos na v5.315, e os
dois que a campanha de determinismo da v5.316 desenterrou (o read-modify-write
do diário das séries e o `setState` que resolve antes do commit no caminho da
intenção do OTA) saíram no mesmo lote em que foram achados. A nota de cada um
está em [`HISTORICO.md`](HISTORICO.md), e cada regra que sobreviveu a eles foi
para o capítulo que a governa, nunca para cá.

---

## Para que este arquivo existe

Um defeito CONFIRMADO que ainda não foi corrigido não pode morar só numa
conversa. Aqui ele espera, com **arquivo:linha, o cenário concreto de falha e a
correção proposta** — nada de "melhorar X".

**É arquivo para ESVAZIAR.** Item resolvido SAI daqui no mesmo lote em que o
conserto entra, e a regra que ele deixou vai para o capítulo dela. Um arquivo de
achados que vira permanente é a próxima coisa a envelhecer mentindo — que é
exatamente a classe de defeito que a auditoria de agosto/2026 passou uma sessão
inteira varrendo.

**O que NÃO entra:** o que já foi corrigido (vai para o `HISTORICO.md`), o que é
gosto ou refatoração sem defeito, e o que é regra viva (vai para o `CLAUDE.md`
ou para `docs/arquitetura/`).

## Quando um achado fica

Só quando ele **muda comportamento** e a correção é decisão de quem publica —
custo alto, risco em culto, ou uma escolha de produto. Achado de documentação,
comentário ou oráculo não espera: corrige-se no lote em que foi encontrado.

E ele fica **com a ressalva de quem o verificou**. Todo achado desta casa passa
por um cético cuja tarefa é refutá-lo; quando a ressalva estreita o cenário ou
rebaixa a gravidade, é a versão dela que vale — não a do achado original.
