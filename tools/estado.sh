#!/usr/bin/env bash
# =============================================================================
# O ESTADO, MEDIDO — nunca citado de memória.
#
# Número em prosa envelhece em horas (o manual já disse "token ausente" com o
# token na mão). Este script imprime o que muda sozinho: HEAD, árvore, as quatro
# casas da versão, o degrau da ponte, a cobertura do workflow, a credencial e o
# CI do commit. Quem escreve relatório cita o que ele imprimiu NESTA sessão.
#
# Uso:  tools/estado.sh [--ci]      (--ci consulta a API do GitHub)
# =============================================================================
set -uo pipefail

RAIZ=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$RAIZ" || { echo "sem repositório em $RAIZ"; exit 1; }

g() { git -c safe.directory='*' "$@"; }
p() { printf '\n== %s\n' "$1"; }

p "repositório"
echo "raiz:    $RAIZ"
echo "HEAD:    $(g log -1 --format='%h (%ad) %s' --date=short)"
echo "branch:  $(g branch --show-current)"
mudou=$(g status --porcelain | wc -l)
echo "árvore:  $([ "$mudou" -eq 0 ] && echo limpa || echo "$mudou arquivo(s) fora do HEAD")"
if g rev-parse --verify -q origin/main >/dev/null; then
  set -- $(g rev-list --left-right --count origin/main...HEAD 2>/dev/null)
  echo "remoto:  atrás $1 · à frente $2 (main do origin)"
fi

p "versão — as quatro casas"
python3 - <<'PY'
import json, re, pathlib
raiz = pathlib.Path('app/src/main/assets/web')
m = json.load(open(raiz / 'version.json'))
js = (raiz / 'controle/controle.js').read_text(encoding='utf-8')
html = (raiz / 'controle/index.html').read_text(encoding='utf-8')
cl = pathlib.Path('CLAUDE.md').read_text(encoding='utf-8')
web = re.search(r"^const WEB_VERSION = '([^']+)'", js, re.M)
app = re.search(r'id="appVersion"[^>]*>[^<]*?v([0-9][0-9.]*)<', html)
clm = re.search(r'Versão atual: base web v([0-9.]+) · APK v([0-9.]+)', cl)
kt = pathlib.Path('app/src/main/java/br/org/iasd/av/NativeBridge.kt').read_text(encoding='utf-8')
shell = re.search(r'const val SHELL_VERSION\s*=\s*(\d+)', kt)
casas = {
    'version.json': m['version'],
    'WEB_VERSION': web.group(1) if web else '?',
    '#appVersion': app.group(1) if app else '?',
    'CLAUDE.md': clm.group(1) if clm else '?',
}
for k, v in casas.items():
    print(f'  {k:<14} {v}')
ok = len(set(casas.values())) == 1 and '?' not in casas.values()
print(f'  -> as quatro {"BATEM" if ok else "DIVERGEM"}')
print(f"  minShell       {m.get('minShell')}   (SHELL_VERSION {shell.group(1) if shell else '?'})")
print(f"  shellTag       {m.get('shellTag') or '(ausente)'}")
print(f"  APK anunciado  {('v' + clm.group(2)) if clm else '?'}")
PY

p "cobertura do workflow"
fora=$(comm -3 <(ls tools/*.test.mjs | sort) \
             <(grep -oE 'tools/[a-z0-9.-]+\.test\.mjs' .github/workflows/apk.yml | sort -u) | wc -l)
total=$(ls tools/*.test.mjs | wc -l)
puro=$(comm -23 <(ls tools/*.test.mjs | sort) \
             <(grep -lE 'arnes\.mjs|playwright' tools/*.test.mjs | sort) | wc -l)
echo "  oráculos: $total arquivos · $puro de Node puro · $fora fora do workflow"

p "credencial"
if [ -f "$HOME/.dsh-github/token" ]; then
  echo "  token:       presente ($(stat -c%s "$HOME/.dsh-github/token") B, $(stat -c%a "$HOME/.dsh-github/token"))"
else
  echo "  token:       AUSENTE"
fi
if g config --global --get http.https://github.com/.extraHeader >/dev/null 2>&1; then
  echo "  extraHeader: configurado"
else
  echo "  extraHeader: AUSENTE — push e dispatch da Release falham"
fi
echo "  gh CLI:      $(gh auth status >/dev/null 2>&1 && echo logado || echo 'sem login (use a API pelo token)')"

if [ "${1:-}" = "--ci" ] && [ -f "$HOME/.dsh-github/token" ]; then
  p "CI do HEAD"
  node -e '
    const fs = require("fs");
    const token = fs.readFileSync(process.env.HOME + "/.dsh-github/token", "utf8").trim();
    const repo = "jonathasptbr-gh/Audio-Visual-IASD";
    const sha = process.argv[1];
    const ctl = new AbortController();
    setTimeout(() => ctl.abort(), 8000);
    fetch(`https://api.github.com/repos/${repo}/commits/${sha}/check-runs`, {
      headers: { Authorization: "Bearer " + token, "User-Agent": "dsh-estado" },
      signal: ctl.signal,
    }).then(r => r.json()).then(j => {
      for (const c of j.check_runs || []) console.log(`  ${c.status}/${c.conclusion || "-"}  ${c.name}`);
      if (!(j.check_runs || []).length) console.log("  (nenhum check ainda)");
    }).catch(() => console.log("  (API indisponível agora)"));
  ' "$(g rev-parse HEAD)"
elif [ "${1:-}" = "--ci" ]; then
  echo "  (sem token: CI não consultado)"
fi

p "fila do operador"
grep -E '^## Pacote [0-9]+ —' docs/PEDIDOS-EM-ESPERA.md \
  | sed -E 's/^## Pacote ([0-9]+) — (.*)/  \1. \2/' | cut -c1-96
