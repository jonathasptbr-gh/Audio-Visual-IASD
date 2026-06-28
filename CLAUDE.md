# Diretrizes para Claude Code — Audio Visual IASD

## Regra obrigatória após qualquer alteração

**Sempre fazer merge com `main` ao finalizar qualquer atualização nos arquivos.**

Fluxo padrão:
```bash
# 1. Desenvolver na branch designada
git add <arquivos>
git commit -m "mensagem descritiva"
git push -u origin <branch>

# 2. Merge obrigatório para main
git checkout main
git merge <branch> --no-ff -m "Merge: <descrição resumida>"
git push origin main
```

---

## Contexto do projeto

Sistema dual-PWA para transmissão e controle de multimídia offline.
Consultar o `README.md` para arquitetura completa, protocolo de comandos e API.

### Arquivos principais

| Arquivo | Responsabilidade |
|---------|-----------------|
| `server.js` | Servidor HTTP estático (Node puro) |
| `public/shared/db.js` | IndexedDB (`av-iasd`) + BroadcastChannel (`av-iasd`) |
| `public/shared/stage.js` | Motor de renderização (`createStage`) |
| `public/controle/controle.js` | Lógica do PWA Controle |
| `public/display/display.js` | Lógica do PWA Display |
| `public/controle/sw.js` | Service worker do Controle (`controle-vN`) |
| `public/display/sw.js` | Service worker do Display (`display-vN`) |

### Regras de desenvolvimento

- Nunca perder funcionalidades existentes ao refatorar.
- Ao alterar assets estáticos, incrementar `N` nos dois `sw.js`.
- Toda operação IDB multi-passo que precise de atomicidade deve usar `storeTx()`.
- Não introduzir dependências externas — o projeto usa Node puro no servidor e
  JavaScript puro no cliente.
- Ao atualizar o código, refletir as mudanças no `README.md` se afetarem
  arquitetura, protocolo de comandos ou API pública.
