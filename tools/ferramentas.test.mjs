// ============================================================================
// AS FERRAMENTAS DA MÁQUINA FUNCIONAM (2026-11-09)
//
// ## Por que este oráculo existe
//
// `tools/estado.sh` e `tools/portao.sh` viraram o caminho de ENTRADA do
// trabalho: um mede o estado, o outro roda o portão. Nenhum dos dois tinha rede
// de segurança — e a primeira versão do `estado.sh` perdia o pedido `--ci` em
// SILÊNCIO: um `set --` de um bloco reescrevia os posicionais, e o `$1` deixava
// de ser `--ci`. O sintoma era a ausência de sintoma: saía com 0, imprimia
// tudo, e só não consultava o CI.
//
// É a mesma família que este repositório já pagou caro: falha sem exceção, sem
// log e sem sintoma no lugar da causa.
//
// ## O que ele NÃO afere
//
// O conteúdo das ferramentas, nem o dos relatórios delas. Afere o mecânico:
// existem, parseiam, rodam, e a âncora entre o `portao.sh` e o bloco do
// workflow está de pé — se alguém renomear o passo "Sanidade da base web", o
// portão passa a extrair o bloco errado, e é aqui que isso reprova, antes do
// commit, e não na máquina de quem for publicar.
// ============================================================================
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checar, falhas } from './checar.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ler = (p) => readFileSync(join(RAIZ, p), 'utf8');

for (const arq of ['tools/estado.sh', 'tools/portao.sh', 'tools/reverter.sh']) {
  const caminho = join(RAIZ, arq);
  checar(statSync(caminho).isFile(), `a ferramenta existe: ${arq}`);
  checar((statSync(caminho).mode & 0o111) !== 0, `e é EXECUTÁVEL: ${arq}`,
    'sem o bit de execução, `tools/portao.sh` como comando falha');
  try {
    execFileSync('bash', ['-n', caminho], { stdio: 'pipe' });
    checar(true, `e parseia como shell: ${arq}`);
  } catch (e) {
    checar(false, `e parseia como shell: ${arq}`, String(e.stderr || e.message));
  }
}

// 1. O estado roda OFFLINE (sem --ci), sai com 0 e imprime as seções.
try {
  const saida = execFileSync('bash', ['tools/estado.sh'], { cwd: RAIZ, encoding: 'utf8', timeout: 60000 });
  checar(saida.includes('== versão — as quatro casas'),
    'o estado.sh roda e imprime as quatro casas da versão');
  checar(saida.includes('== credencial') && saida.includes('== cobertura do workflow'),
    'e as outras seções (credencial, cobertura, fila)');
} catch (e) {
  checar(false, 'o estado.sh roda e imprime as seções',
    String(e.stdout || '') + String(e.stderr || e.message));
}

// 2. O `--ci` NÃO PODE voltar a ser lido de `$1` depois de um `set --`.
//    A defesa é Guardar a intenção em CI=1 antes de qualquer `set --`.
const estado = ler('tools/estado.sh');
checar(/CI=0; \[ "\$\{1:-\}" = "--ci" \] && CI=1/.test(estado),
  'o estado.sh guarda o `--ci` ANTES de qualquer `set --`');
checar((estado.match(/\$\{1:-\}/g) || []).length === 1,
  'e `$1` é lido UMA vez só (um `set --` reescreve os posicionais)',
  'ocorrências: ' + (estado.match(/\$\{1:-\}/g) || []).length);

// 3. A âncora entre o portão e o workflow: o nome do passo tem de ser o MESMO
//    nos dois arquivos, senão o portão extrai um bloco vazio/errado e reprova
//    longe da causa.
const PASSO = 'Sanidade da base web (sintaxe do JS)';
const workflow = ler('.github/workflows/apk.yml');
const portao = ler('tools/portao.sh');
checar(workflow.includes(PASSO), 'o passo da Sanidade existe no workflow', PASSO);
checar(portao.includes(PASSO),
  'e o portao.sh procura esse mesmo passo (a âncora não pode divergir)', PASSO);

// 3.5. O CONJUNTO "PURO" DO PORTÃO SAI DO IMPORT, NÃO DA MENÇÃO.
//    Em 2026-11-13 o filtro era textual (`grep -lE 'arnes\.mjs|playwright'`) e
//    pulava o `docs-coerentes` — que apenas NOMEIA o `arnes.mjs` num Set. Era o
//    único oráculo puro fora do portão, e o que ficava de fora era justamente o
//    que cobra "todo oráculo roda no CI". O placar ("35 passaram") não denunciava
//    a troca. A régua é EXTRAÍDA do portão aqui e aplicada ao disco.
const cmdPuros = (portao.match(/puros=\$\(comm -23[\s\S]*?\)\)/) || [''])[0];
const reFiltro = cmdPuros.match(/grep -lE "([^"]+)"/);
checar(!!reFiltro, 'o filtro dos puros está no portão como regex entre aspas', cmdPuros);
if (reFiltro) {
  const filtro = new RegExp(reFiltro[1]);
  const testes = readdirSync(join(RAIZ, 'tools')).filter((f) => f.endsWith('.test.mjs'));
  const puros = testes.filter((f) => !filtro.test(ler('tools/' + f)));
  checar(puros.includes('docs-coerentes.test.mjs'),
    'e o `docs-coerentes` roda entre os puros (ele NOMEIA o arnês, não o importa)');
  const importam = testes.filter((f) => /from '\.\/arnes\.mjs'/.test(ler('tools/' + f)));
  checar(importam.length > 30, 'os oráculos de Chromium importam o arnês', 'achou ' + importam.length);
  checar(importam.every((f) => !puros.includes(f)),
    'e nenhum deles entra no conjunto puro');
}

// 4. As duas ferramentas são citadas no CONTRATO — é o que faz a sessão
//    seguinte descobri-las sem procurar.
const contrato = ler('CLAUDE.md');
checar(contrato.includes('tools/estado.sh'), 'o CLAUDE.md cita tools/estado.sh');
checar(contrato.includes('tools/portao.sh'), 'o CLAUDE.md cita tools/portao.sh');

console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTodos passaram.');
process.exit(falhas.length ? 1 : 0);
