# Áudio Visual IASD — app Android

**[audiovisualiasd.com.br](https://audiovisualiasd.com.br/)** — a página do app,
com as telas, o que ele faz e o guia de instalação.

App de projeção de mídia para culto. O celular do operador mostra o
**Controle**; a TV recebe **só o Display**, na resolução nativa dela — sem
espelhar a tela do celular, porque o app usa `android.app.Presentation`: uma
segunda tela de verdade. Playlist, transições, letra sincronizada, Bíblia,
mensagens, coleções do LouvorJA e YouTube rodam numa base web hospedada em dois
WebViews do mesmo processo e mesmo origin — que por isso compartilham IndexedDB,
OPFS e o canal de comandos.

**E a projeção também vai para o navegador de outra tela** — até três, sem
instalar nada nelas. O celular serve o próprio app por HTTP na rede local e
manda os comandos; a mídia viaja sob demanda. Basta o Wi-Fi do lugar, **mesmo
sem internet** — e, se não houver Wi-Fi nenhuma, o próprio celular pode ser o
ponto de acesso a que o computador se conecta.

**Documento também é mídia.** PDF, PowerPoint (`.pptx`) e Google Apresentações
entram pelo mesmo "Importar arquivos" (ou pelo compartilhamento) e viram uma
imagem por página — daí para a frente têm o fade, a cortina, o telão e os
botões ⏮/⏭ passando página, como qualquer outro item. Não há botão nem fluxo
separado para apresentação: é um arquivo como os outros.

## Instalar

Pelo caminho normal: **[audiovisualiasd.com.br](https://audiovisualiasd.com.br/)**,
aberto por um aparelho **Android** — a página traz o botão de baixar e o guia
passo a passo. (É um `.apk`: não instala em computador, iPhone ou iPad.)

Pelo repositório: o `.apk` mais recente está em **[Releases](../../releases)**.
Autorize "instalar apps de fontes desconhecidas" quando o Android pedir,
conecte a TV (Smart View / MiraScreen / cabo USB-C→HDMI) e abra o app: o telão
é detectado sozinho.

**Atualizar não desinstala nada.** As Releases são assinadas com a mesma chave,
então o APK novo instala por cima e a biblioteca (que vive no armazenamento do
app) continua onde estava. A base web se atualiza sozinha, sem APK: o app avisa
e quem aplica é você.

Sem tela nenhuma conectada, a preview do Controle em tela cheia vira a
projeção — e há um "Tocar neste celular" para ensaiar.

## Desenvolver

O contrato — invariantes, rito de entrega, o método dos oráculos — mora no
[`CLAUDE.md`](CLAUDE.md); o detalhe de cada área, em [`docs/`](docs/), com a
árvore anotada em [`docs/ESTRUTURA.md`](docs/ESTRUTURA.md). Como compilar e
entregar: [`docs/BUILD.md`](docs/BUILD.md).

## Licença

**GPLv3** — ver [`LICENSE`](LICENSE).

Não é escolha de estilo: o `NewPipeExtractor`, que extrai a URL do vídeo do
YouTube no próprio aparelho, é GPL-3.0 e viaja dentro do APK. A GPLv3 exige que
o conjunto seja licenciado sob ela e que o código correspondente seja oferecido
a quem recebe o binário — este repositório é público, e cada Release aponta para
o commit de que foi compilada.

O software de terceiros que vai no APK está listado em
[`AVISOS-DE-TERCEIROS.md`](AVISOS-DE-TERCEIROS.md).

> A licença cobre o **código**. O símbolo e o nome **IASD** são da Igreja
> Adventista do Sétimo Dia, e nada aqui concede direito sobre eles.

## Contato

Um problema no sábado de manhã não espera formulário:
**[falar pelo WhatsApp](https://wa.me/5551997572650)**. O app tem o mesmo
atalho no rodapé de Configurações, ao lado do botão que salva o Registro — o
arquivo de diagnóstico que responde metade das perguntas antes de elas serem
feitas.
