#!/usr/bin/env bash
# =============================================================================
# REVERTER — guardar antes de mexer, devolver para provar a reversão.
#
# A regra do `CLAUDE.md` (*"a reversão se desfaz com uma cópia, nunca com o
# git"*) existia em prosa e dependia de memória: quem esquece o `cp` antes da
# edição acaba apelando para `git checkout`, que restaura do HEAD e **apaga o
# trabalho não commitado do lote inteiro naquele arquivo**. Este script faz a
# cópia ser mais barata que a tentação.
#
# Uso:
#   tools/reverter.sh --guardar app/src/main/assets/web/controle/controle.js
#       → copia para ~/tmp/backup-<data-hora>/ (com manifesto) e imprime o caminho
#   tools/reverter.sh --restaurar ~/tmp/backup-2026-11-10-1200
#       → devolve cada arquivo do manifesto ao lugar de origem
#
# Caminhos são relativos à RAIZ do clone, como no resto dos `tools/`.
# =============================================================================
set -uo pipefail

RAIZ=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
acao=${1:-}
shift || true

case "$acao" in
  --guardar)
    [ $# -gt 0 ] || { echo "uso: tools/reverter.sh --guardar <arquivo>..."; exit 2; }
    destino="$HOME/tmp/backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$destino" || exit 1
    : > "$destino/.manifesto"
    for f in "$@"; do
      if [ ! -f "$RAIZ/$f" ]; then
        echo "não existe: $f"; exit 1
      fi
      mkdir -p "$destino/$(dirname "$f")" || exit 1
      cp -p "$RAIZ/$f" "$destino/$f" || { echo "falhou ao copiar: $f"; exit 1; }
      printf '%s\n' "$f" >> "$destino/.manifesto"
    done
    echo "guardado em $destino"
    echo "restaurar: tools/reverter.sh --restaurar $destino"
    ;;

  --restaurar)
    [ $# -eq 1 ] || { echo "uso: tools/reverter.sh --restaurar <diretório do backup>"; exit 2; }
    dir=$1
    [ -f "$dir/.manifesto" ] || { echo "sem manifesto em $dir"; exit 1; }
    while IFS= read -r f; do
      [ -n "$f" ] || continue
      [ -f "$dir/$f" ] || { echo "falta no backup: $f"; exit 1; }
      mkdir -p "$RAIZ/$(dirname "$f")" || exit 1
      cp -p "$dir/$f" "$RAIZ/$f" || { echo "falhou ao restaurar: $f"; exit 1; }
      echo "restaurado: $f"
    done < "$dir/.manifesto"
    ;;

  *)
    echo "uso: tools/reverter.sh --guardar <arquivo>... | --restaurar <diretório>"
    exit 2
    ;;
esac
