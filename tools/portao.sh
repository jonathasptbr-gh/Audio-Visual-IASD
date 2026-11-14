#!/usr/bin/env bash
# =============================================================================
# O PORTÃO DE VERIFICAÇÃO, EM UM COMANDO — e o ÚLTIMO passo antes do commit.
#
# Com a entrega direto em `main` (decisão do operador, 2026-11-14) ele é a
# ÚNICA barreira antes do canal OTA. A ordem é a do rito (`docs/BUILD.md`, "O
# rito de entrega"): versão → portão → commit → push. Qualquer mudança DEPOIS
# dele — um `reverter.sh --restaurar`, uma linha a mais — pede o portão DE NOVO:
# os dois consertos pós-push de 14/11 (`ce8edc1c`, a casa fora de passo;
# `c48d9c8f`, a nota acima de 120) eram coisas que o passo 3 pega.
#
# Antes do commit roda-se a VIZINHANÇA do lote — nunca a suíte inteira, que é do
# CI (decisão do operador, 2026-10-15). Na ordem:
#
#   1. sintaxe do que o lote tocou (node --check) e a VIZINHANÇA: os oráculos de
#      Chromium (`*.test.mjs` não puros e os dois smoke) que MENCIONAM esses
#      arquivos — por grep, não por memória. Acima do TETO ele não escolhe
#      sozinho: lista e reprova até a escolha vir por `--vizinho`;
#   2. os oráculos de Node puro que NÃO estão na Sanidade (os dela rodam no 3 —
#      rodar os dois era pagar duas vezes; com --sem-sanidade, todos rodam aqui);
#   3. a "Sanidade da base web" — o bloco é EXTRAÍDO do próprio workflow a cada
#      execução, jamais copiado: copiar é a divergência que o arnês existe para
#      fechar. Ele inclui o gatilho da Release (shell mudou desde a última tag
#      `v*` ⇒ `shellTag`; base web mudou ⇒ versão maior);
#   4. a cobertura do workflow, nos DOIS sentidos (oráculo no disco × no CI).
#
# Uso (caminhos da RAIZ do clone; o curto `controle/controle.js` é resolvido
# contra `app/src/main/assets/web/`):
#   tools/portao.sh                                    # passos 2, 3 e 4
#   tools/portao.sh app/src/main/assets/web/controle/controle.js
#   tools/portao.sh <arq> --vizinho tools/x.test.mjs   # a vizinhança escolhida
#   tools/portao.sh <arq> --vizinhanca-inteira         # sem teto
#   tools/portao.sh --sem-sanidade                     # pula o 3 (iteração)
# =============================================================================
set -uo pipefail

RAIZ=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$RAIZ" || { echo "sem repositório em $RAIZ"; exit 1; }

WEB=app/src/main/assets/web
# O TETO DA VIZINHANÇA. O `controle.js` é citado por mais de vinte oráculos de
# Chromium, e a régua por menção não sabe quais deles leem o estado
# que o lote mexeu. Quem sabe é quem fez o lote.
TETO=8

falhas=0
erro() { echo "  FALHOU: $*"; falhas=$((falhas + 1)); }

sem_sanidade=0
inteira=0
arquivos=()
escolhidos=()
while [ $# -gt 0 ]; do
  case "$1" in
    --sem-sanidade) sem_sanidade=1 ;;
    --vizinhanca-inteira) inteira=1 ;;
    --vizinho)
      shift
      [ $# -gt 0 ] || { echo "--vizinho pede um arquivo"; exit 2; }
      escolhidos+=("$1") ;;
    *) arquivos+=("$1") ;;
  esac
  shift
done

mkdir -p "$HOME/tmp"
tmp=$(mktemp -d "$HOME/tmp/portao-XXXXXX")
trap 'rm -rf "$tmp"' EXIT

# O PURO SE DECIDE PELO IMPORT, NÃO PELA MENÇÃO (2026-11-13), e o import conta
# nas DUAS formas: `from '…'` e `import('…')`. O `nome-inexistente` importa o
# `acorn` dinamicamente e roda no passo de Chromium (depois do `npm ci`); o
# filtro só olhava o `from`, e ele entrava na conta dos puros (Pacote 25/A9). A
# lista é a do `package.json` — o `ferramentas.test.mjs` cobra que cada
# `devDependency` esteja aqui.
puros=$(comm -23 <(ls tools/*.test.mjs | sort) \
               <(grep -lE "(from |import\()'(\./)?(arnes\.mjs|playwright|acorn)'" tools/*.test.mjs | sort))

if [ "$sem_sanidade" -eq 0 ]; then
  python3 - "$tmp" <<'PY'
import sys
s = open('.github/workflows/apk.yml', encoding='utf-8').read()
i = s.index('      - name: Sanidade da base web (sintaxe do JS)')
b = s[i:s.index('\n      - name:', i + 10)]
c = b[b.index('        run: |\n') + len('        run: |\n'):]
open(sys.argv[1] + '/sanidade.sh', 'w', encoding='utf-8').write(
    '\n'.join(l[10:] if l.startswith(' ' * 10) else l for l in c.split('\n')))
PY
fi

# 1 ---------------------------------------------------------------------------
if [ ${#arquivos[@]} -gt 0 ] || [ ${#escolhidos[@]} -gt 0 ]; then
  echo "== 1. sintaxe e vizinhança"
  resolvidos=()
  for f in "${arquivos[@]}"; do
    if [ -e "$f" ]; then
      resolvidos+=("$f")
    elif [ -e "$WEB/$f" ]; then
      echo "  nota caminho curto: $f → $WEB/$f"
      resolvidos+=("$WEB/$f")
    else
      erro "não existe: $f (o caminho é da raiz do clone, ou o curto de $WEB/)"
    fi
  done
  for f in "${resolvidos[@]}"; do
    case "$f" in
      *.js|*.mjs)
        node --check "$f" >/dev/null 2>&1 \
          && echo "  ok   sintaxe: $f" \
          || erro "sintaxe de $f (node --check)" ;;
    esac
  done
  # Só oráculo é vizinho: `*.test.mjs` e os dois smoke. Os módulos de apoio e as
  # ferramentas de argumento (`pares-de-comentario`, `miolo`, o
  # `revisao-cobertura`, que sem `--base` sai 2) citam o `controle.js` e
  # reprovariam todo lote. Os puros também ficam de fora: rodam no 2 ou no 3.
  candidatos=$(printf '%s\n' tools/*.test.mjs tools/smoke.mjs tools/display-smoke.mjs \
    | grep -vxF -f <(printf '%s\n' $puros))
  viz=()
  for f in "${resolvidos[@]}"; do
    base=$(basename "$f")
    while IFS= read -r v; do
      [ -n "$v" ] && viz+=("$v")
    done < <(grep -lF "$base" $candidatos 2>/dev/null; printf '%s\n' $candidatos | grep -xF "$f")
  done
  mapfile -t viz < <(printf '%s\n' "${viz[@]}" | grep -v '^$' | sort -u)
  rodar=()
  if [ ${#escolhidos[@]} -gt 0 ]; then
    echo "  a vizinhança por menção tem ${#viz[@]}; rodando os ${#escolhidos[@]} escolhidos"
    rodar=("${escolhidos[@]}")
  elif [ ${#viz[@]} -gt "$TETO" ] && [ "$inteira" -eq 0 ]; then
    erro "vizinhança de ${#viz[@]} oráculos, acima do teto ($TETO): escolha os que leem o estado que o lote mexeu"
    printf '       %s\n' "${viz[@]}"
    echo "       repita com --vizinho <oráculo> (um por oráculo) ou --vizinhanca-inteira"
  else
    rodar=("${viz[@]}")
    [ ${#viz[@]} -eq 0 ] && echo "  ok   nenhum oráculo de Chromium cita esses arquivos"
  fi
  for v in "${rodar[@]}"; do
    if [ ! -f "$v" ]; then
      erro "vizinho não existe: $v"
    elif timeout 300 node "$v" >/dev/null 2>&1; then
      echo "  ok   vizinho: $v"
    else
      erro "vizinho $v (reproduza com: node $v)"
    fi
  done
fi

# 2 ---------------------------------------------------------------------------
echo "== 2. oráculos de Node puro (os que a Sanidade não roda)"
naSanidade=""
# SÓ O EXECUTADO CONTA: um `# ver tools/x.test.mjs` (ou um `echo`) tirava o
# oráculo do portão sem rodá-lo em lugar nenhum — o pulo era o defeito.
[ "$sem_sanidade" -eq 0 ] && naSanidade=$(sed 's/[[:space:]]#.*//' "$tmp/sanidade.sh" \
  | grep -E '(^|[;&|][[:space:]]*)node[[:space:]]' \
  | grep -oE 'tools/[a-z0-9.-]+\.test\.mjs' | sort -u)
antes=$falhas
n=0
m=0
for f in $puros; do
  if [ -n "$naSanidade" ] && printf '%s\n' "$naSanidade" | grep -qxF "$f"; then
    m=$((m + 1))
    continue
  fi
  n=$((n + 1))
  if ! saida=$(timeout 120 node "$f" 2>&1); then
    erro "oráculo $f"
    echo "$saida" | tail -5 | sed 's/^/       /'
  fi
done
[ "$falhas" -eq "$antes" ] && echo "  ok   $n passaram ($m outros rodam dentro da Sanidade, no passo 3)"

# 3 ---------------------------------------------------------------------------
if [ "$sem_sanidade" -eq 0 ]; then
  echo "== 3. Sanidade da base web (texto extraído do workflow)"
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
  echo "PORTÃO: tudo passou. Mexeu em algo depois disto? Rode de novo antes do commit."
  exit 0
fi
echo "PORTÃO: $falhas falha(s) — o lote não acabou."
exit 1
