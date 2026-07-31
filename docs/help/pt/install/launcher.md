# Iniciar o launcher de desktop

!!! tip "A maioria dos utilizadores não precisa do launcher"
    O Adaptive Learner corre diretamente no browser, sem instalação, sem
    Docker, sem launcher:
    **[astrapi69.github.io/adaptive-learner](https://astrapi69.github.io/adaptive-learner/)**.
    O launcher de desktop só é para ti se quiseres alojar a aplicação
    por conta própria ou correr localmente funcionalidades de backend
    (modo servidor, sincronização local).

O launcher de desktop é a forma mais fácil de correr o Adaptive Learner
**com o seu próprio backend** no teu computador. É uma pequena janela que
faz tudo o resto por ti: verifica se o Docker está a correr, descarrega e
constrói a imagem da aplicação no primeiro arranque (uma única vez, 5-10
minutos é normal), inicia os containers e depois abre a aplicação no teu
browser em `http://localhost:8501`. A partir da mesma janela também podes
parar a aplicação, mudar a porta ou desinstalar tudo.

A porta é por predefinição **8501** e pode ser alterada na janela do
launcher; se estiver ocupada, o launcher recorre a uma porta livre.

## Quem consegue aceder à aplicação

Por predefinição, a aplicação só está acessível **a partir deste
computador** (`127.0.0.1`). É intencional: não tem autenticação e guarda
as tuas chaves de fornecedores de IA. Visível na rede, qualquer
dispositivo dessa mesma rede - uma LAN de escritório, o wi-fi de um
hotel ou de uma conferência - poderia simplesmente abri-la e usá-la.

Aceder a partir de outro dispositivo, por exemplo do telemóvel na tua
própria rede, continua a ser possível, mas passa a ser uma decisão
consciente: define `ADAPTIVE_LEARNER_BIND_ADDRESS=0.0.0.0` no ficheiro
`.env`. Faz isso apenas numa rede em que confias e lembra-te de que
todos os que lá estiverem passam a ter o mesmo acesso que tu.

## Pré-requisito: Docker - o launcher verifica-o sozinho

O launcher requer um Docker em execução, porque a própria aplicação corre
como um grupo de containers. **Não** precisas de verificar nada
manualmente: no arranque, o próprio launcher verifica se o Docker está
instalado e a correr, encontra também um Docker que corra sob um contexto
de Docker diferente (como o Docker Desktop para Linux ou o Docker
rootless) e mostra uma mensagem clara com a solução quando algo falta. Se
o Docker ainda não estiver de todo instalado:
[Instalar o Docker Desktop](docker-desktop.md).

As mensagens do launcher e o que significam:

| Mensagem | Significado | Solução |
|----------|-------------|---------|
| "O Docker não está instalado (docker não está no PATH)." | O comando `docker` não foi encontrado. | [Instalar o Docker Desktop](docker-desktop.md). O launcher mostra o link de instalação diretamente. |
| "O Docker está instalado mas não iniciado." ou "O Docker não está a correr. Contexto verificado '...' (...): ..." | O serviço do Docker não está a correr neste momento; a forma detalhada indica o contexto verificado, o socket e o erro original do Docker. | Clica no botão **"Iniciar o Docker"** no launcher (Linux) ou abre o Docker Desktop (macOS/Windows), depois **"Tentar novamente"**. |
| "O Docker está instalado, mas não tens permissão." | O teu utilizador não está no grupo `docker` (Linux). | O launcher mostra o comando exato; termina e reinicia a sessão a seguir. |
| "O Docker não está a responder." | O Docker está muito provavelmente ainda a arrancar (típico logo após abrir o Docker Desktop). | Espera um momento, depois **"Tentar novamente"**. |
| "O Docker está a correr através do contexto '...' - o contexto ativo estava inacessível, o launcher ligou-se automaticamente." | Apenas informativo: o Docker corria sob um contexto diferente, o launcher encontrou-o e usa-o. | Nada a fazer. |
| "O Docker Desktop está instalado mas não está no PATH." | A aplicação Docker Desktop está lá, mas a sua ferramenta de linha de comandos (ainda) não está acessível. | Inicia o Docker Desktop através do botão do launcher e espera um pouco. |

A deteção de contexto com mensagens detalhadas vem incluída na versão do
launcher que se segue a docker-app-launcher#26; as versões mais antigas
mostram as mensagens mais curtas da mesma tabela.

## Download

Os três launchers são disponibilizados em cada release em
[github.com/astrapi69/adaptive-learner/releases](https://github.com/astrapi69/adaptive-learner/releases):

| Plataforma | Ficheiro | Checksum |
|------------|----------|----------|
| Linux | `adaptive-learner-launcher` | `adaptive-learner-launcher.sha256` |
| macOS | `adaptive-learner-launcher-macos.zip` | `adaptive-learner-launcher-macos.zip.sha256` |
| Windows | `adaptive-learner-launcher.exe` | `adaptive-learner-launcher.exe.sha256` |

### O que está verificado e o que não está

Cada um destes programas é iniciado uma vez durante a sua construção,
exatamente no sistema operativo a que se destina. Fica assim comprovado
que arranca: em Linux, em Windows e em macOS com Apple Silicon. A imagem
da aplicação é verificada em cada versão: uma transferência anónima
(sem sessão) e um arranque real com verificação de saúde, separadamente
para os dois tipos de processador (Intel/AMD e ARM), em máquinas desse
tipo. O que ainda não foi medido é a transferência a partir do registo
em motores Docker muito antigos (era 20.10); a própria cadeia do motor
está comprovada num motor desses contra outro registo, e a medição
contra o registo do GitHub é acompanhada upstream.

O que não está comprovado é como o teu sistema operativo reage a um
ficheiro **transferido**: os programas não trazem uma assinatura paga,
por isso o macOS avisa na primeira abertura ("programador não
identificado") e o Windows mostra o aviso SmartScreen. É um aviso, não
um defeito; como confirmá-lo uma única vez está descrito abaixo em
[macOS](#macos) e [Windows](#windows). Verifica antes a soma de
verificação: é uma prova mais fiável do que qualquer diálogo.

## Linux

1. Verifica o checksum (ambos os ficheiros na mesma pasta):

    ```bash
    sha256sum -c adaptive-learner-launcher.sha256
    ```

2. Define a permissão de execução. Os downloads do browser retiram-na
   sempre ao binário, por isso este passo é **sempre** necessário:

    ```bash
    chmod +x adaptive-learner-launcher
    ```

3. Inicia-o, mais facilmente a partir do terminal:

    ```bash
    ./adaptive-learner-launcher
    ```

    Fazer duplo clique no gestor de ficheiros também pode funcionar,
    dependendo do teu ambiente; o GNOME/Nautilus exige "Permitir a
    execução do ficheiro como programa" em Propriedades > Permissões. O
    arranque pelo terminal tem a vantagem de veres as mensagens de erro
    diretamente.

Ciladas conhecidas:

- **"Permission denied"**: o passo 2 foi esquecido (`chmod +x`).
- **Erro de GLIBC no arranque**: o binário é construído no Ubuntu 22.04 e
  precisa de glibc 2.35 ou mais recente (Ubuntu 22.04+, Debian 12+,
  Fedora 36+). Em distribuições mais antigas, corre antes a aplicação
  através do `install.sh` ou diretamente com o Docker Compose.
- **Aplicação inacessível no browser**: a aplicação corre apenas
  localmente (`localhost`), por isso não é necessária nenhuma regra de
  firewall. Se o browser não abrir automaticamente, abre
  `http://localhost:8501` manualmente (ou a porta indicada na janela do
  launcher).

## macOS

1. Verifica o checksum e descompacta o ZIP:

    ```bash
    shasum -a 256 -c adaptive-learner-launcher-macos.zip.sha256
    unzip adaptive-learner-launcher-macos.zip
    ```

2. Na primeira abertura, o Gatekeeper bloqueia o binário por vir de um
   "programador não identificado". Duas formas de contornar:

    - Clica com o botão direito (ou Ctrl-clique) no binário > **Abrir** >
      confirma **Abrir** no diálogo. O macOS memoriza isto para todos os
      arranques seguintes.
    - Ou: Definições do Sistema > **Privacidade e Segurança** > desce até
      à aplicação bloqueada e clica em **Abrir mesmo assim**.

## Windows

1. Verifica o checksum (PowerShell, ambos os ficheiros na mesma pasta):

    ```powershell
    Get-FileHash .\adaptive-learner-launcher.exe -Algorithm SHA256
    Get-Content .\adaptive-learner-launcher.exe.sha256
    ```

    Os dois valores de hash têm de coincidir.

2. Faz duplo clique em `adaptive-learner-launcher.exe`. No primeiro
   arranque, o SmartScreen avisa ("O Windows protegeu o seu PC"): clica
   em **Mais informações**, depois em **Executar mesmo assim**.

## Se algo correr mal

- O próprio launcher mostra um diálogo de aviso quando o Docker não está
  a correr e oferece iniciar o Docker Desktop.
- O primeiro arranque descarrega e constrói a imagem da aplicação; a
  lista de passos na janela do launcher (Check Docker / Download / Build
  / Start / Ready) mostra o progresso. Os arranques seguintes são
  rápidos.
- Enquanto a aplicação está a correr podes sempre aceder a ela em
  `http://localhost:8501` (ou na tua porta alterada); o botão
  "Abrir no browser" no launcher faz o mesmo.
