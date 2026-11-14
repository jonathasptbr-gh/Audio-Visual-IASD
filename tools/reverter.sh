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

  # O RESTAURAR MOSTRA O QUE VAI SOBRESCREVER, E GUARDA (Pacote 25/A1). Ele
  # copiava o arquivo inteiro por cima, calado: o que o lote escreveu DEPOIS do
  # `--guardar` sumia sem aviso. Agora cada arquivo que mudou mostra o diff
  # (atual → guardado) e a versão atual vai para `<backup>/.sobrescrito-<hora>/`
  # antes da cópia — desfazer o restaurar é outro `cp`. E a árvore mudou: o
  # portão roda DE NOVO antes do commit.
  --restaurar)
    [ $# -eq 1 ] || { echo "uso: tools/reverter.sh --restaurar <diretório do backup>"; exit 2; }
    dir=$1
    [ -f "$dir/.manifesto" ] || { echo "sem manifesto em $dir"; exit 1; }
    salvo="$dir/.sobrescrito-$(date +%Y%m%d-%H%M%S)"
    n=0
    while IFS= read -r f; do
      [ -n "$f" ] || continue
      [ -f "$dir/$f" ] || { echo "falta no backup: $f"; exit 1; }
      if [ -f "$RAIZ/$f" ] && cmp -s "$dir/$f" "$RAIZ/$f"; then
        echo "igual ao guardado: $f"
        continue
      fi
      if [ -f "$RAIZ/$f" ]; then
        echo "== vai sobrescrever $f (o que some está nas linhas '-'):"
        diff -u "$RAIZ/$f" "$dir/$f" | sed -n '3,42p'
        [ "$(diff "$RAIZ/$f" "$dir/$f" | wc -l)" -gt 40 ] && echo "   … (diff cortado em 40 linhas)"
        mkdir -p "$salvo/$(dirname "$f")" || exit 1
        cp -p "$RAIZ/$f" "$salvo/$f" || { echo "falhou ao guardar o atual: $f"; exit 1; }
      fi
      mkdir -p "$RAIZ/$(dirname "$f")" || exit 1
      cp -p "$dir/$f" "$RAIZ/$f" || { echo "falhou ao restaurar: $f"; exit 1; }
      echo "restaurado: $f"
      n=$((n + 1))
    done < "$dir/.manifesto"
    if [ "$n" -gt 0 ]; then
      [ -d "$salvo" ] && echo "o que foi sobrescrito ficou em $salvo"
      echo "A ÁRVORE MUDOU: rode tools/portao.sh de novo antes do commit."
    fi
    ;;

  *)
    echo "uso: tools/reverter.sh --guardar <arquivo>... | --restaurar <diretório>"
    exit 2
    ;;
esac
