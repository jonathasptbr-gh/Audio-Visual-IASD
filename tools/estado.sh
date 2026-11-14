#!/usr/bin/env bash
# =============================================================================
# O ESTADO, MEDIDO — nunca citado de memória.
#
# Número em prosa envelhece em horas (o manual já disse "token ausente" com o
# token na mão). Este script imprime o que muda sozinho: HEAD, árvore, as três
# casas da versão, a última Release (a tag), o degrau da ponte, a cobertura do
# workflow, a credencial e o CI do commit. Quem escreve relatório cita o que ele imprimiu NESTA sessão.
#
# Uso:  tools/estado.sh [--ci]      (--ci consulta a API do GitHub)
# =============================================================================
set -uo pipefail

RAIZ=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$RAIZ" || { echo "sem repositório em $RAIZ"; exit 1; }

g() { git -c safe.directory='*' "$@"; }
# O `--ci` é guardado AQUI, antes de qualquer `set --` dos blocos abaixo: um
# `set --` reescreve os posicionais, e o pedido de CI se perderia em silêncio.
CI=0; [ "${1:-}" = "--ci" ] && CI=1
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

p "versão — as três casas"
python3 - <<'PY'
import json, re, pathlib, subprocess
raiz = pathlib.Path('app/src/main/assets/web')
m = json.load(open(raiz / 'version.json'))
js = (raiz / 'controle/controle.js').read_text(encoding='utf-8')
html = (raiz / 'controle/index.html').read_text(encoding='utf-8')
web = re.search(r"^const WEB_VERSION = '([^']+)'", js, re.M)
app = re.search(r'id="appVersion"[^>]*>[^<]*?v([0-9][0-9.]*)<', html)
kt = pathlib.Path('app/src/main/java/br/org/iasd/av/NativeBridge.kt').read_text(encoding='utf-8')
shell = re.search(r'const val SHELL_VERSION\s*=\s*(\d+)', kt)
casas = {
    'version.json': m['version'],
    'WEB_VERSION': web.group(1) if web else '?',
    '#appVersion': app.group(1) if app else '?',
}
for k, v in casas.items():
    print(f'  {k:<14} {v}')
ok = len(set(casas.values())) == 1 and '?' not in casas.values()
print(f'  -> as três {"BATEM" if ok else "DIVERGEM"}')
print(f"  minShell       {m.get('minShell')}   (SHELL_VERSION {shell.group(1) if shell else '?'})")
print(f"  shellTag       {m.get('shellTag') or '(ausente)'}")
# A ÚLTIMA RELEASE SAI DO GIT, NÃO DA PROSA (Pacote 25/A5): a linha "APK v…"
# do CLAUDE.md era lida aqui e conferida contra ela mesma. A tag `v*` é o que
# o workflow cria ao publicar; as locais andam com `git fetch --tags`.
def git(*a):
    r = subprocess.run(['git', '-c', 'safe.directory=*', *a], capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 else ''
tag = git('describe', '--tags', '--abbrev=0', '--match', 'v*', 'HEAD')
if tag:
    d = git('diff', '--name-only', tag, '--', 'app/src/main/java', 'app/src/main/res',
            'app/src/main/AndroidManifest.xml', 'app/build.gradle.kts')
    n = len([l for l in d.splitlines() if l])
    print(f"  última Release {tag} (tag local) · shell mudou desde ela: "
          f"{n} arquivo(s){' → exige shellTag' if n else ''}")
else:
    print("  última Release (nenhuma tag v* local — git fetch --tags)")
PY

p "cobertura do workflow"
fora=$(comm -3 <(ls tools/*.test.mjs | sort) \
             <(grep -oE 'tools/[a-z0-9.-]+\.test\.mjs' .github/workflows/apk.yml | sort -u) | wc -l)
total=$(ls tools/*.test.mjs | wc -l)
# O FILTRO É O IMPORT, NÃO A MENÇÃO (2026-11-13): o `docs-coerentes` NOMEIA o
# `arnes.mjs` num Set e ficava de fora — a mesma régua do `portao.sh`, que conta
# também o `import('…')` dinâmico (o `acorn` do `nome-inexistente`).
puro=$(comm -23 <(ls tools/*.test.mjs | sort) \
             <(grep -lE "(from |import\()'(\./)?(arnes\.mjs|playwright|acorn)'" tools/*.test.mjs | sort) | wc -l)
echo "  oráculos: $total arquivos · $puro de Node puro · $fora fora do workflow"

# O cofre do harness vem primeiro; o arquivo antigo é reserva — a mesma ordem
# da `lib.mjs` do kit `~/.dsh-github/` (Pacote 24/C2, 2026-11-14).
COFRE="${DSH_HOME:-$HOME/.dsh}/.credentials.yaml"
TOKEN=$(sed -n '/^refs:/,/^[^[:space:]]/p' "$COFRE" 2>/dev/null \
  | sed -nE 's/^[[:space:]]+GITHUB_TOKEN:[[:space:]]*(.*)[[:space:]]*$/\1/p' | head -1)
if [ -n "$TOKEN" ]; then
  TOKEN="${TOKEN%\'}"; TOKEN="${TOKEN#\'}"; TOKEN="${TOKEN%\"}"; TOKEN="${TOKEN#\"}"
  ORIGEM="cofre"
elif [ -f "$HOME/.dsh-github/token" ]; then
  TOKEN=$(cat "$HOME/.dsh-github/token")
  ORIGEM="arquivo"
else
  ORIGEM=""
fi

p "credencial"
if [ -n "$TOKEN" ]; then
  echo "  token:       presente ($ORIGEM)"
else
  echo "  token:       AUSENTE (cofre e ~/.dsh-github/token)"
fi
if g config --global --get http.https://github.com/.extraHeader >/dev/null 2>&1; then
  echo "  extraHeader: configurado"
else
  echo "  extraHeader: AUSENTE — push e dispatch da Release falham"
fi
echo "  gh CLI:      $(gh auth status >/dev/null 2>&1 && echo logado || echo 'sem login (use a API pelo token)')"

if [ "$CI" -eq 1 ] && [ -n "$TOKEN" ]; then
  p "CI do HEAD"
  TOKEN_GITHUB="$TOKEN" node -e '
    const token = process.env.TOKEN_GITHUB;
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
      // A Release mais nova NO GITHUB — a tag local pode estar atrás.
      return fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
        headers: { Authorization: "Bearer " + token, "User-Agent": "dsh-estado" },
        signal: ctl.signal,
      }).then(r => r.json()).then(r => console.log(`  Release mais nova no GitHub: ${r.tag_name || "(nenhuma)"}`));
    }).catch(() => console.log("  (API indisponível agora)"));
  ' "$(g rev-parse HEAD)"
elif [ "$CI" -eq 1 ]; then
  echo "  (sem token: CI não consultado)"
fi

p "fila do operador"
grep -E '^## Pacote [0-9]+ —' docs/PEDIDOS-EM-ESPERA.md \
  | sed -E 's/^## Pacote ([0-9]+) — (.*)/  \1. \2/' | cut -c1-96

p "resíduos com dono 'operador' (sem pacote na fila — a regra 6 do RESIDUOS.md)"
# A linha que JÁ GANHOU PACOTE na fila deixou de ser decisão pendente (regra 6)
# e sai daqui. A que cita um pacote que NÃO existe em `PEDIDOS-EM-ESPERA.md`
# continua saindo — citação velha não pode esconder uma decisão. A tabela
# "Fechado/decidido" fica fora: ela é o registro, não a pendência.
PACOTES=$(grep -E '^## Pacote [0-9]+ —' docs/PEDIDOS-EM-ESPERA.md \
  | sed -E 's/^## Pacote ([0-9]+) —.*/ \1 /' | tr -d '\n')
# Seção não achada não é "nenhum": a busca vazia não é prova de ausência.
if ! grep -q '^## Aberto' docs/RESIDUOS.md; then
  echo "  (seção '## Aberto' não achada no RESIDUOS.md — nada conferido)"
else
PEND=$(awk -F'|' -v pacotes="$PACOTES" '
  /^## Aberto/  { dentro = 1; next }
  /^## Fechado/ { dentro = 0 }
  !dentro || $0 !~ /^\| 2026-/ { next }
  {
    d = $5; gsub(/[ \t]/, "", d)
    if (d != "operador") next
    if (match($6, /na fila: Pacote [0-9]+/)) {
      n = substr($6, RSTART + 16, RLENGTH - 16)
      if (index(pacotes, " " n " ") > 0) next
    }
    print "  " $2 " ->" $3
  }' docs/RESIDUOS.md | cut -c1-96)
if [ -n "$PEND" ]; then printf '%s\n' "$PEND"; else echo "  (nenhum)"; fi
fi
