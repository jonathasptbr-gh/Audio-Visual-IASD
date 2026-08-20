#!/usr/bin/env bash
# RODA OS TESTES JUnit DOS ARQUIVOS PUROS SEM REDE.
#
# POR QUE ISTO EXISTE. O `./gradlew testDebugUnitTest` do CI precisa baixar o
# AGP e o Kotlin plugin do Google Maven. Num ambiente sem essa saída — um agente
# em sandbox, um avião, a rede da igreja — a suíte de Kotlin simplesmente não
# roda, e o lado mais sensível do projeto (o parser HTTP com controle de acesso,
# e a regra que escolhe a trilha de áudio) fica sem oráculo justamente para quem
# está mexendo nele.
#
# Não precisa de rede nenhuma: o próprio distribution do Gradle já traz um
# kotlinc embutido, o JUnit 4 e o hamcrest. Este script os usa direto.
#
# O QUE ELE **NÃO** É: um substituto do CI. Ele compila só os arquivos PUROS
# (zero import de android.*) mais o `cnDe` do EspelhoCert, e não constrói o APK.
# O CI continua sendo a palavra final.
set -euo pipefail
cd "$(dirname "$0")/.."

G=$(ls -d "$HOME"/.gradle/wrapper/dists/gradle-*/*/gradle-*/lib 2>/dev/null | head -1)
[ -n "$G" ] || { echo "não achei o lib/ do Gradle em ~/.gradle/wrapper/dists"; exit 2; }
KV=$(basename "$G"/kotlin-stdlib-*.jar .jar | sed 's/kotlin-stdlib-//')

TRAB=$(mktemp -d); trap 'rm -rf "$TRAB"' EXIT
mkdir -p "$TRAB/src" "$TRAB/out"

# Os PUROS e os testes deles. Um arquivo que ganhe `import android.*` sai daqui
# e o script acusa — é a mesma disciplina que o KDoc de cada um promete.
PUROS=(EspelhoHttp EspelhoPares EspelhoMidiaCache TrilhaAudio)
TESTES=(EspelhoHttpTest EspelhoHttpRangeTest EspelhoMidiaCacheTest EspelhoParesTest TrilhaAudioTest)

for f in "${PUROS[@]}"; do
  a="app/src/main/java/br/org/iasd/av/$f.kt"
  if grep -q "^import android" "$a"; then
    echo "REPROVOU  $f.kt deixou de ser PURO (ganhou import de android.*)"; exit 1
  fi
  cp "$a" "$TRAB/src/"
done
for f in "${TESTES[@]}"; do cp "app/src/test/java/br/org/iasd/av/$f.kt" "$TRAB/src/"; done

# O `EspelhoParesTest` afirma `EspelhoCert.cnDe`, que é uma função de STRING pura
# num arquivo que importa o Android. Em vez de um stub (que testaria o stub), o
# corpo REAL é extraído verbatim do arquivo de verdade: se ele mudar, o que roda
# aqui muda junto.
python3 - "$TRAB/src/_CertExtraido.kt" <<'PY'
import re, sys
FONTE = 'app/src/main/java/br/org/iasd/av/EspelhoCert.kt'
TESTE = 'app/src/test/java/br/org/iasd/av/EspelhoParesTest.kt'
fonte = open(FONTE, encoding='utf-8').read()

# Quais membros do EspelhoCert o teste realmente usa. Descobrir em vez de listar
# à mão é o que impede esta extração de envelhecer calada: um membro novo no
# teste faz o script FALHAR, não passar por cima.
usados = sorted(set(re.findall(r'EspelhoCert\.([a-zA-Z_][\w]*)', open(TESTE, encoding='utf-8').read())))
corpos, faltando = [], []
for nome in usados:
    m = re.search(r'\n(    fun ' + re.escape(nome) + r'\(.*?\n    \})\n', fonte, re.S)
    if not m:
        faltando.append(nome); continue
    corpo = m.group(1)
    # Se o membro tocar o Android, ele não é extraível e o script tem de dizer
    # isso — extrair mesmo assim daria um erro de compilação sem explicação.
    if re.search(r'\b(Log|Uri|Context)\s*\.|\bctx\b', corpo):
        faltando.append(nome + ' (toca o Android)')
        continue
    corpos.append(corpo)
if faltando:
    sys.exit('EspelhoCert: não consegui extrair ' + ', '.join(faltando) +
             ' — o teste usa membros que este script não sabe isolar.')
open(sys.argv[1], 'w', encoding='utf-8').write(
    'package br.org.iasd.av\n'
    '// GERADO em tempo de execução: os corpos são copiados VERBATIM de\n'
    '// EspelhoCert.kt (' + ', '.join(usados) + '). Não edite — edite o original.\n'
    'object EspelhoCert {\n' + '\n'.join(corpos) + '\n}\n')
PY

CPC="$G/kotlin-compiler-embeddable-$KV.jar:$G/kotlin-stdlib-$KV.jar:$G/kotlinx-coroutines-core-jvm-1.6.4.jar:$G/trove4j-1.0.20200330.jar:$G/annotations-24.0.1.jar:$G/kotlin-reflect-$KV.jar:$G/kotlin-daemon-embeddable-$KV.jar:$G/kotlin-script-runtime-$KV.jar"
CPT="$G/junit-4.13.2.jar:$G/hamcrest-core-1.3.jar:$G/kotlin-stdlib-$KV.jar"

echo "compilando ($KV)…"
java -cp "$CPC" org.jetbrains.kotlin.cli.jvm.K2JVMCompiler \
  -no-reflect -nowarn -cp "$CPT" -d "$TRAB/out" "$TRAB"/src/*.kt \
  2>&1 | grep -vE "^(Picked up|warning:|info:)" || true
[ -d "$TRAB/out/br/org/iasd/av" ] || { echo "REPROVOU  a compilação falhou"; exit 1; }

java -cp "$TRAB/out:$CPT" org.junit.runner.JUnitCore \
  br.org.iasd.av.EspelhoHttpTest \
  br.org.iasd.av.EspelhoHttpRangeTest \
  br.org.iasd.av.EspelhoMidiaCacheTest \
  br.org.iasd.av.EspelhoParesTest \
  br.org.iasd.av.TrilhaAudioTest 2>&1 | grep -v "^Picked up"
