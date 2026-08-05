# Instalar o Docker Desktop

O Adaptive Learner corre como um pequeno grupo de containers no teu
próprio computador. O launcher de desktop inicia e para esses
containers por ti, mas primeiro é preciso ter o **Docker** instalado e
em execução. Este guia acompanha-te na instalação do Docker Desktop.

## O que precisas

- Cerca de 800 MB de download para o próprio Docker Desktop.
- Cerca de 2 GB de disco para a imagem do Adaptive Learner na primeira
  execução (isto acontece uma única vez; os arranques seguintes são
  rápidos).
- Alguns minutos para o primeiro build (5-10 minutos é normal).

## Instalar

1. Abre a página oficial de download do Docker Desktop:
   [docs.docker.com/desktop](https://docs.docker.com/desktop/).
2. Descarrega o instalador para o teu sistema operativo (Windows, macOS
   ou Linux).
3. Executa o instalador e segue as instruções. Aceita as predefinições,
   a menos que tenhas uma razão para as alterar.
4. Inicia o Docker Desktop e espera até o ícone da baleia mostrar
   "Docker Desktop is running".

## Iniciar o launcher

Assim que o Docker Desktop estiver a correr, inicia novamente o launcher
do Adaptive Learner. Ele verifica primeiro o Docker, depois descarrega,
constrói e inicia a aplicação e, por fim, oferece um botão
"Abrir no browser".

Se o Docker ainda não estiver a correr quando inicias o launcher, ele
mostra um aviso com um botão "Iniciar o Docker" para que possas
arrancá-lo sem sair do launcher.

Por omissão, a aplicação em execução só é acessível a partir deste
computador (`127.0.0.1`). Não tem início de sessão; abri-la a outros
dispositivos é um passo deliberado - ver
[Iniciar o launcher de desktop](launcher.md).

## É seguro instalar o Docker?

Sim. O Docker Desktop é feito pela Docker, Inc., uma empresa bem
conhecida, e é usado por milhões de programadores em todo o mundo. É a
forma padrão de correr aplicações em containers num computador pessoal.

O Adaptive Learner usa o Docker apenas para correr os seus próprios
containers no teu computador. Os teus dados de aprendizagem ficam
locais; instalar o Docker não envia nada sobre os teus dados à Docker,
Inc. Podes desinstalar o Docker Desktop a qualquer momento através do
teu sistema operativo, tal como qualquer outra aplicação.

## Resolução de problemas

- **O launcher diz que o Docker não está a correr.** Inicia o Docker
  Desktop e espera pelo estado "running", depois clica em
  "Tentar novamente".
- **A porta já está a ser usada.** O launcher deteta isto e oferece uma
  porta alternativa; aceita a sugestão.
- **Algo mais correu mal.** Volta a executar o launcher com o flag
  `--debug` e partilha o ficheiro `launcher-debug.log` gerado:

  ```bash
  python3 -m adaptive_learner_launcher --debug
  ```
