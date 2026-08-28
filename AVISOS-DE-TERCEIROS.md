# Avisos de terceiros

O app é licenciado sob a **GPLv3** (ver [`LICENSE`](LICENSE)). Este arquivo lista
o software de terceiros que **viaja dentro dos binários que este repositório
distribui** e a licença de cada um.

**São DOIS binários desde a v1.4.6**, e a lista é por binário porque eles não
carregam as mesmas coisas: o **APK** do Android e o **programa de Windows**
(`windows/`, a segunda casca — ver [`docs/SEGUNDA-CASCA.md`](docs/SEGUNDA-CASCA.md)).

> A regra do projeto é recusar dependências (ver "Regras de desenvolvimento" no
> `CLAUDE.md`), e cada exceção tem justificativa escrita. As que **não** põem um
> byte em binário nenhum — JUnit e Playwright, que são arnês de teste — ficam de
> fora desta lista de propósito: quem recebe o binário não recebe nenhuma delas.

## O que vai no APK

| componente | licença | onde |
|---|---|---|
| **NewPipeExtractor** v0.26.4 — extrai a URL do vídeo do YouTube no aparelho | **GPL-3.0** | `app/build.gradle.kts` (dependência Gradle) |
| **@aiden0z/pptx-renderer** 1.2.4 — desenha `.pptx` no próprio navegador | **Apache-2.0** | [`app/src/main/assets/web/vendor/`](app/src/main/assets/web/vendor/) · texto em [`LICENSE-pptx-renderer.txt`](app/src/main/assets/web/vendor/LICENSE-pptx-renderer.txt) · o levantamento que justificou a exceção está no [`LEIA-ME.md`](app/src/main/assets/web/vendor/LEIA-ME.md) da pasta |
| **AndroidX** (`core-ktx`, `activity-ktx`, `webkit`) e `desugar_jdk_libs_nio` | **Apache-2.0** | `app/build.gradle.kts` |

## O que vai no programa de Windows

> **Ele ainda não é distribuído.** O empacotamento é o lote 7 de
> `docs/SEGUNDA-CASCA.md`, e até ele existir não há binário publicado desta
> casca. A lista está aqui porque a hora de escrevê-la é quando a dependência
> entra, não quando ela sai pela porta.

| componente | licença | onde |
|---|---|---|
| **Microsoft.Web.WebView2** 1.0.2903.40 — o SDK que hospeda o runtime do Edge numa janela do Windows | **BSD-3-Clause** (LIDO do `LICENSE.txt` do próprio pacote: é o texto BSD de três cláusulas, com a Microsoft como titular — **não** um EULA proprietário, que era a suposição razoável) | `windows/AudioVisualIASD/AudioVisualIASD.csproj` (dependência NuGet) |
| **@aiden0z/pptx-renderer** 1.2.4 · o `:core` · a base web | idem à tabela do APK | a MESMA base web, byte a byte — é o ponto da segunda casca |

**O RUNTIME do WebView2 não é redistribuído por este repositório.** O que o
pacote acima carrega é o SDK; o navegador em si é o Edge que já vem no Windows
10/11, instalado e atualizado pela Microsoft. É essa separação que faz o pacote
do programa não carregar um Chromium inteiro (§3 da `SEGUNDA-CASCA.md`).

**O `NewPipeExtractor` ainda NÃO está no programa de Windows** — é o lote 4. No
dia em que entrar, a linha dele desce para esta tabela também, e a obrigação da
seção seguinte passa a valer para os dois binários pelo mesmo motivo.

## Por que o app inteiro é GPLv3

**Não é escolha de estilo — é obrigação.** O `NewPipeExtractor` é GPL-3.0 e é
ligado ao APK que este repositório distribui publicamente. A GPLv3 exige que o
conjunto seja licenciado sob ela e que o código correspondente seja oferecido a
quem recebe o binário.

O código está neste repositório, que é público, e cada Release aponta para o
commit de que ela foi compilada — é assim que a oferta de código-fonte é
cumprida.

A Apache-2.0 é **compatível numa via só**: código Apache-2.0 pode entrar num
trabalho GPLv3, e é o caso do renderizador de `.pptx` e do AndroidX. **A
BSD-3-Clause do WebView2 é compatível pela mesma via e no mesmo sentido.** Não há
conflito.

## O que NÃO é nosso e não está aqui

O símbolo e o nome **IASD** são da Igreja Adventista do Sétimo Dia; o wallpaper
padrão (`app/src/main/assets/web/shared/wallpaper-padrao.svg`) reproduz o símbolo
oficial. A licença deste software cobre o CÓDIGO — não concede direito sobre
marcas, nomes ou identidade visual de terceiros.

Hinos, letras e textos bíblicos vêm do banco público LouvorJA em tempo de
execução (ver [`docs/FONTE-DE-DADOS-LOUVORJA.md`](docs/FONTE-DE-DADOS-LOUVORJA.md))
e **não são redistribuídos** por este repositório nem embutidos no APK.
