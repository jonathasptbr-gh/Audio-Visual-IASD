#!/usr/bin/env bash
# =============================================================================
# O PORTÃO DE VERIFICAÇÃO, EM UM COMANDO.
#
# Antes do commit roda-se a VIZINHANÇA do lote — nunca a suíte inteira, que é do
# CI (decisão do operador, 2026-10-15). Este script faz, na ordem do workflow:
#
#   1. sintaxe do que o lote tocou (node --check) e os oráculos de Chromium que
#      MENCIONAM esses arquivos (a "vizinhança", escolhida por grep, não por
#      memória);
#   2. TODOS os oráculos de Node puro (~8 s);
#   3. a "Sanidade da base web" — o bloco é EXTRAÍDO do próprio workflow a cada
#      execução, jamais copiado: copiar é a divergência que o arnês existe para
#      fechar;
#   4. a cobertura do workflow, nos DOIS sentidos (oráculo no disco × no CI).
#
# Uso:
#   tools/portao.sh                        # passos 2, 3 e 4
#   tools/portao.sh app/.../controle.js    # + passos 1 desse arquivo
#   tools/portao.sh --sem-sanidade         # pula o passo 3 (iteração rápida)
# =============================================================================
set -uo pipefail

RAIZ=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$RAIZ" || { echo "sem repositório em $RAIZ"; exit 1; }

falhas=0
erro() { echo "  FALHOU: $*"; falhas=$((falhas + 1)); }

sem_sanidade=0
arquivos=()
for a in "$@"; do
  case "$a" in
    --sem-sanidade) sem_sanidade=1 ;;
    *) arquivos+=("$a") ;;
  esac
done

# 1 ---------------------------------------------------------------------------
if [ ${#arquivos[@]} -gt 0 ]; then
  echo "== 1. sintaxe e vizinhança (${#arquivos[@]} arquivo(s))"
  for f in "${arquivos[@]}"; do
    case "$f" in
      *.js|*.mjs)
        node --check "$f" >/dev/null 2>&1 \
          && echo "  ok   sintaxe: $f" \
          || erro "sintaxe de $f (node --check)" ;;
    esac
  done
  for f in "${arquivos[@]}"; do
    base=$(basename "$f")
    # OS MÓDULOS DE APOIO E AS FERRAMENTAS DE ARGUMENTO FICAM DE FORA. `arnes`,
    # `checar` e `sem-rede` não são oráculos; `pares-de-comentario` e `miolo` são
    # FERRAMENTAS e exigem argumento (`<arquivo> [ref]`, `<subcomando>`) — rodadas
    # sem nenhum elas imprimem o uso e saem 2, o que o portão leria como vizinho
    # reprovado em TODO lote que tocasse um arquivo citado no texto delas (o
    # `miolo` cita o `controle.js`, o arquivo mais citado do repositório). É a
    # mesma exclusão que a "lista do CI" já faz (CLAUDE.md, §Os oráculos), e ela
    # mora aqui pelo mesmo motivo de sempre: a régua é uma só.
    vizinhos=$(grep -lF "$base" tools/*.mjs 2>/dev/null \
      | grep -vE '/(arnes|checar|sem-rede|pares-de-comentario|miolo)\.mjs$' || true)
    for v in $vizinhos; do
      if timeout 300 node "$v" >/dev/null 2>&1; then
        echo "  ok   vizinho: $v"
      else
        erro "vizinho $v (reproduza com: node $v)"
      fi
    done
  done
fi

# 2 ---------------------------------------------------------------------------
echo "== 2. oráculos de Node puro"
# O FILTRO É O IMPORT, NÃO A MENÇÃO (2026-11-13). Ele era textual
# (`grep -lE 'arnes\.mjs|playwright'`) e por isso pulava um oráculo puro que
# apenas NOMEIA o `arnes.mjs` num Set: o `docs-coerentes` — justamente o que
# cobra que todo oráculo rode no CI e tenha linha na tabela. Ele rodava no CI e
# não no portão, e o placar ("35 passaram") não denunciava a troca. Agora casa
# só quem importa de fato: `from './arnes.mjs'` ou `from 'playwright'`.
puros=$(comm -23 <(ls tools/*.test.mjs | sort) \
               <(grep -lE "from '(\./)?(arnes\.mjs|playwright)'" tools/*.test.mjs | sort))
n=0
for f in $puros; do
  n=$((n + 1))
  if ! saida=$(timeout 120 node "$f" 2>&1); then
    erro "oráculo $f"
    echo "$saida" | tail -5 | sed 's/^/       /'
  fi
done
[ "$falhas" -eq 0 ] && echo "  ok   $n oráculos passaram"

# 3 ---------------------------------------------------------------------------
if [ "$sem_sanidade" -eq 0 ]; then
  echo "== 3. Sanidade da base web (texto extraído do workflow)"
  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' EXIT
  python3 - "$tmp" <<'PY'
import sys
s = open('.github/workflows/apk.yml', encoding='utf-8').read()
i = s.index('      - name: Sanidade da base web (sintaxe do JS)')
b = s[i:s.index('\n      - name:', i + 10)]
c = b[b.index('        run: |\n') + len('        run: |\n'):]
open(sys.argv[1] + '/sanidade.sh', 'w', encoding='utf-8').write(
    '\n'.join(l[10:] if l.startswith(' ' * 10) else l for l in c.split('\n')))
PY
  if bash -e "$tmp/sanidade.sh" >"$tmp/saida.txt" 2>&1; then
    echo "  ok   Sanidade: $(tail -1 "$tmp/saida.txt")"
  else
    erro "Sanidade da base web"
    tail -12 "$tmp/saida.txt" | sed 's/^/       /'
  fi
fi

# 4 ---------------------------------------------------------------------------
echo "== 4. cobertura do workflow (os dois sentidos)"
fora=$(comm -3 <(ls tools/*.test.mjs | sort) \
             <(grep -oE 'tools/[a-z0-9.-]+\.test\.mjs' .github/workflows/apk.yml | sort -u))
if [ -z "$fora" ]; then
  echo "  ok   todos os $(ls tools/*.test.mjs | wc -l) oráculos estão no workflow"
else
  erro "oráculo fora do workflow (ou no workflow e fora do disco)"
  echo "$fora" | sed 's/^/       /'
fi

echo
if [ "$falhas" -eq 0 ]; then
  echo "PORTÃO: tudo passou."
  exit 0
fi
echo "PORTÃO: $falhas falha(s) — o lote não acabou."
exit 1
