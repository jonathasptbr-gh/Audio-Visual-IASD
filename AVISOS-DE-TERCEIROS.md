# Avisos de terceiros

O app é licenciado sob a **GPLv3** (ver [`LICENSE`](LICENSE)). Este arquivo lista
o software de terceiros que **viaja dentro do APK** e a licença de cada um.

> A regra do projeto é recusar dependências (ver "Regras de desenvolvimento" no
> `CLAUDE.md`), e cada exceção tem justificativa escrita. As que **não** põem um
> byte no APK — JUnit e Playwright, que são arnês de teste — ficam de fora desta
> lista de propósito: quem recebe o binário não recebe nenhuma delas.

## O que vai no APK

| componente | licença | onde |
|---|---|---|
| **NewPipeExtractor** v0.26.4 — extrai a URL do vídeo do YouTube no aparelho | **GPL-3.0** | `app/build.gradle.kts` (dependência Gradle) |
| **@aiden0z/pptx-renderer** 1.2.4 — desenha `.pptx` no próprio navegador | **Apache-2.0** | [`app/src/main/assets/web/vendor/`](app/src/main/assets/web/vendor/) · texto em [`LICENSE-pptx-renderer.txt`](app/src/main/assets/web/vendor/LICENSE-pptx-renderer.txt) · o levantamento que justificou a exceção está no [`LEIA-ME.md`](app/src/main/assets/web/vendor/LEIA-ME.md) da pasta |
| **AndroidX** (`core-ktx`, `activity-ktx`, `webkit`) e `desugar_jdk_libs_nio` | **Apache-2.0** | `app/build.gradle.kts` |

## Por que o app inteiro é GPLv3

**Não é escolha de estilo — é obrigação.** O `NewPipeExtractor` é GPL-3.0 e é
ligado ao APK que este repositório distribui publicamente. A GPLv3 exige que o
conjunto seja licenciado sob ela e que o código correspondente seja oferecido a
quem recebe o binário.

O código está neste repositório, que é público, e cada Release aponta para o
commit de que ela foi compilada — é assim que a oferta de código-fonte é
cumprida.

A Apache-2.0 é **compatível numa via só**: código Apache-2.0 pode entrar num
trabalho GPLv3, e é o caso do renderizador de `.pptx` e do AndroidX. Não há
conflito.

## O que NÃO é nosso e não está aqui

O símbolo e o nome **IASD** são da Igreja Adventista do Sétimo Dia; o wallpaper
padrão (`app/src/main/assets/web/shared/wallpaper-padrao.svg`) reproduz o símbolo
oficial. A licença deste software cobre o CÓDIGO — não concede direito sobre
marcas, nomes ou identidade visual de terceiros.

Hinos, letras e textos bíblicos vêm do banco público LouvorJA em tempo de
execução (ver [`docs/FONTE-DE-DADOS-LOUVORJA.md`](docs/FONTE-DE-DADOS-LOUVORJA.md))
e **não são redistribuídos** por este repositório nem embutidos no APK.
