<!-- Translation: AI-generated, pending native review -->

# Definições

A página de Definições reúne tudo o que pode ajustar sem
tocar em código ou YAML. Está organizada como uma **página com
separadores**: escolha um separador e o respetivo painel abre-se, por
isso não precisa de percorrer uma lista longa de cima a baixo. Num ecrã
largo os separadores ficam numa barra lateral à esquerda; num telemóvel
abrem-se a partir de um botão de menu por cima do painel. O endereço
indica o separador aberto (`/settings?tab=data`), por isso uma ligação
ou um recarregamento leva ao mesmo separador; sem ele, a página abre em
**Geral**.

Os separadores estão organizados em quatro grupos:

- **Geral**
    - **Geral**: perfil (nome de exibição, avatar, molduras do avatar),
      aparência (tema, visualização de conteúdo, ordem dos separadores
      do hub de Conteúdo), idioma da interface, interface (dicas dos
      botões, posição do menu no telemóvel), modo de armazenamento,
      preferências de atualização, instalação da aplicação e o
      indicador de modo.
- **Aprendizagem e IA**
    - **Aprendizagem**: como as lições se comportam, em cinco áreas que
      vão do perfil de aprendizagem à motivação e rotina, incluindo as
      definições de voz e a gamificação.
    - **IA**: seletor de fornecedor e de modelo, chaves de API por
      fornecedor com atribuição de fonte e a vista geral dos
      fornecedores configurados.
    - **Plugins**: os plugins instalados e as definições do Repositório
      de aprendizagem.
- **Dados e integrações**
    - **Dados**: fontes de conteúdo, sincronização, conteúdo offline,
      cópia de segurança e exportação (incluindo a exportação cifrada
      de chaves), limpeza e a zona de perigo, com uma barra de secções
      no topo.
    - **Integrações**: a integração com o GitHub (o token para partilhar
      lições como pull request).
- **Info**
    - **Ajuda**: o glossário pesquisável da aplicação.
    - **Diagnóstico e suporte**: o relatório de erro, o Modo
      desenvolvedor e a sonda de toques e viewport.
    - **Sobre**: versão, informações do sistema, créditos, partilha da
      aplicação, doações, licença.

## Perfil

Em *Geral > Perfil* define o seu **Nome de exibição** e personaliza o
seu **avatar**:

- **Carregar imagem** abre a caixa de diálogo de recorte; o resultado
  aparece no canto superior direito da navegação.
- **Ou escolha uma figura**: oito figuras predefinidas como alternativa
  à sua própria foto - basta um clique. Se estiver ativa uma foto
  carregada, uma caixa de diálogo pergunta antes de a figura a
  substituir; a foto fica guardada à parte e pode ser recuperada a
  qualquer momento com **Restaurar foto** (até ser carregada uma nova
  foto).
- **Moldura do avatar**: anéis decorativos à volta do avatar. Bronze,
  prata e ouro desbloqueiam-se com o seu nível, a chama com o emblema de
  sequência de 3 dias; estrela e destaque trocam-se por XP (confirmação
  em dois passos, o custo está indicado no botão). As molduras
  bloqueadas mostram a sua condição.

A sua escolha e as molduras compradas são guardadas e acompanham a sua
[cópia de segurança](backup.md).

## Aparência

O seletor de **Tema** em *Geral > Aparência* organiza os temas em
dois separadores:

- **Recomendados** - Catppuccin Latte, Supabase e Graphite (claros),
  Catppuccin Mocha, **Soft Pop** e Amethyst Haze (escuros). Os novos
  utilizadores começam com **Soft Pop**, e o seletor abre neste
  separador.
- **Clássicos** - os temas originais: Claro, Escuro, Oceano,
  Floresta, Alto contraste (preto, branco e cores de sinal fortes,
  com arestas de cartão nítidas, para máxima legibilidade) e Sépia
  (tons de papel quentes para leitura prolongada). Se o seu tema
  ativo for um clássico, o seletor abre neste separador.

Ambos os separadores oferecem ainda **Automático (sistema)**, que
segue a configuração claro/escuro do seu sistema operativo e muda
automaticamente com ele.

Escolha um tema a partir do seu cartão de pré-visualização; a
alteração aplica-se instantaneamente sem recarregamento, e a
sua escolha é lembrada entre visitas. Todos os temas são
concebidos para cumprir o contraste WCAG 2.1 AA, por isso o
texto, gráficos, emblemas e feedback de exercícios mantêm-se
legíveis em todos eles.

Também neste cartão: a **Visualização de conteúdo** - a preferência
global *lista / grelha* para o hub de Conteúdo (padrão **lista**). É a
mesma preferência que o alternador de vista dentro de *Os meus
conteúdos* / *Descobrir*, por isso alterá-la num dos sítios mantém
ambos sincronizados. Logo abaixo do cartão define a **Ordem das abas de
Conteúdo** (Descobrir / Os meus conteúdos / Importar / Criar), para que
o hub abra no separador que mais usa.

## Idioma

*Geral > Idioma* troca em tempo real todas as strings da interface na
próxima renderização via `PATCH /api/settings/{user_id}`. Todos os 11
idiomas são de primeira classe - DE / EL / EN / ES / FR / HI / ID / JA /
KO / PT / TR - cada um com um catálogo totalmente traduzido. Persistido
entre recarregamentos via `localStorage`.

## Interface

*Geral > Interface* tem dois controlos: **Mostrar dicas dos botões**
(uma dica ao passar o rato sobre botões de ícone; as etiquetas para
leitores de ecrã mantêm-se ativas de qualquer forma) e a **Posição do
menu (celular)** (em cima como botão de menu, o padrão, ou em baixo
como barra de separadores ao alcance do polegar). Os gestos de deslizar
são uma definição de lição e vivem em *Aprendizagem > Na lição >
Interação*. O Modo desenvolvedor está no separador **Diagnóstico e
suporte** (ver abaixo).

## Modo de armazenamento

*Geral > Modo de armazenamento* alterna entre armazenamento
**Servidor** e **Local (Navegador)**:

- **Servidor** - cada leitura e escrita atinge o backend
  FastAPI. Requer um backend em execução. Melhor para uso em
  múltiplos dispositivos com sincronização do lado do backend.
- **Local (Navegador)** - cada leitura e escrita atinge o
  IndexedDB neste navegador. As chamadas de IA disparam
  diretamente para o fornecedor. Sem backend necessário. Melhor
  para uma configuração privada e local do dispositivo.

Mudar de modo guarda em `localStorage` e apresenta uma
notificação "reinício necessário". Os dados NÃO são
sincronizados entre modos.

A versão web pública e a aplicação web instalada não têm backend, por
isso aí o cartão não existe e a aplicação usa sempre Local (Navegador).

## Atualizações e instalação da aplicação

O resto do separador **Geral** trata da forma como a aplicação funciona:

- **Atualizações** (só no modo Servidor): **Verificação automática de
  atualizações** e o **Intervalo de verificação** (diário, semanal,
  mensal ou nunca), mais a hora da última verificação e a versão atual.
  O botão manual **Procurar atualizações** está no separador **Sobre**.
- **Instalar aplicativo**: instala o Adaptive Learner como aplicação
  autónoma (janela própria, ícone no ecrã inicial, arranca sem rede).
  Depois de instalada, o botão mostra **Já instalado**.
- **Modo**: o **Modo individual** está ativo; o **Modo multijogador**
  está marcado como brevemente disponível.

## Aprendizagem

O separador **Aprendizagem** agrupa os seus cartões em cinco áreas
etiquetadas, pela ordem em que uma lição decorre. Cada área tem um pequeno
título e uma descrição de uma linha; os cartões lá dentro mantêm os seus
próprios títulos.

Uma **barra de secções** por cima das áreas lista-as como chips: clique
num para saltar para essa área. Num computador a barra fica visível por
baixo do cabeçalho da aplicação enquanto percorre a página; num
telemóvel desloca-se com a página e a fila pode ser deslizada para o
lado. A barra reflete o endereço: `/settings?tab=learning&section=review`
abre o separador já deslocado até *Depois da lição* (ids: `basics`,
`lessons`, `voice`, `review`, `motivation`), e um clique num chip
atualiza o endereço sem acrescentar uma entrada ao histórico. Mudar para
outro separador remove a secção. Uma área que não é apresentada (a área
de voz num navegador sem Web Speech) não tem chip, e uma secção
desconhecida é ignorada. Enquanto percorre a página, o chip destacado
acompanha a área visível no ecrã.

### Fundamentos

Quem aprende e em que idiomas.

- **Perfil de aprendizagem** - criar, continuar ou refazer o perfil de
  aprendizagem por trás dos pesos dos seis métodos.
- **Idiomas de origem adicionais** - que idiomas de origem a árvore de
  conteúdo mostra além do idioma da aplicação.

### Na lição

Como os exercícios se comportam enquanto responde.

- **Modo de lição** - o **Modo padrão** (Prática / Exame / Cronometrado),
  o **Limite para aprovação** do exame e a **Dificuldade do modo
  cronometrado** (Rápido, Normal, Relaxado); consulte
  [Lições e revisões](lessons.md).
- **Dicas** - se aparece um botão de dica por etapas em cada exercício, e
  o **Custo de XP por dica** (0 para dicas gratuitas).
- **Interação** - **Gestos de deslizar** (deslizar para navegar na
  Avaliação, na Sessão e no Currículo; padrão LIGADO em dispositivos com
  toque), **Atalhos de teclado nas lições** (Enter verifica a resposta,
  Enter de novo avança), **Avançar automaticamente após uma resposta
  correta** e **Mostrar botão 'Perguntar à IA'**.
- **Direção de exercício preferida** - com que direção os exercícios
  direcionais abrem.
- **Exercício de correspondência** - **Correção como visualização
  separada** (padrão LIGADO): depois de verificar, "As minhas respostas"
  mostra apenas os seus próprios pares com os seus erros, as respostas
  corretas estão em "Correções" e a solução em "Resolver". Desligado: a
  resposta correta fica diretamente por baixo de cada erro em "As minhas
  respostas". Inclui ainda a **Animação de resolução**, o efeito que um
  exercício de correspondência resolvido reproduz.

### Leitura em voz alta e ditado

Vozes, velocidade, microfone e prática de pronúncia. A área contém o
cartão **Voz**:

- **Mostrar botões de voz** - adiciona um botão de altifalante ao lado
  das respostas da IA e dos resultados da Avaliação que os lê em voz
  alta.
- **Reproduzir respostas da IA automaticamente** - fala cada resposta da
  IA automaticamente (padrão DESLIGADO - áudio surpresa raramente é o
  que quer).
- **Voz** - a voz de leitura; o padrão escolhe a correspondência mais
  próxima para o idioma do seu projeto.
- **Velocidade** e **Tom** - controlos deslizantes de 0,5 a 2.
- **Mostrar botão do microfone** - adiciona um botão de microfone à
  entrada da Sessão que capta a fala e preenche a área de texto com
  transcrições provisórias antes de enviar.
- **Idioma de ditado** - um código BCP-47 (por exemplo `pt-PT`); deixe-o
  vazio para usar o idioma do projeto ou da interface.
- **Prática de Pronúncia** - mostra um botão *Prática de Pronúncia* nos
  dashboards de projetos de aprendizagem de línguas.

Os controlos de leitura em voz alta (os cinco primeiros) só aparecem
quando o navegador suporta síntese de fala, os dois controlos de ditado
só quando suporta reconhecimento de fala. Quando o navegador não suporta
nenhum dos lados da Web Speech API, a área inteira não existe, título
incluído, e *Depois da lição* segue-se diretamente a *Na lição*.

### Depois da lição

Sessões de revisão, o resumo da lição e a repetição de erros.

- **Revisão** - as explicações após a resposta (a explicação que o autor
  de um exercício escreveu, mostrada por baixo do exercício depois de
  verificado, e as dicas de regras geradas automaticamente depois de uma
  lição) e o número de perguntas por sessão de revisão. O interruptor
  "Rever também os elementos sem erros" (desligado por padrão) decide se
  a revisão contém apenas elementos com erros ou se também traz de volta,
  ao fim de 3 e 7 dias, elementos em que nunca errou. O cartão termina
  com o bloco só de leitura **Repetição espaçada**: o calendário de
  intervalos (respostas corretas seguidas contra dias até à próxima
  revisão), quando um item conta como dominado, e uma ligação para o
  método de aprendizagem.
- **Resumo após as lições** - que secções o resumo de fim de lição
  mostra, e por que ordem. Por padrão só *Resultado e estatísticas* e
  *Recompensa de XP* estão ativos, a vista compacta que cabe num ecrã de
  telemóvel; tudo o resto é mostrado pelo botão *Avaliação detalhada* no
  fim de uma lição, ou marca-o aqui de forma permanente. *Porque errou
  estes* é uma destas secções; o seu interruptor principal continua a ser
  *Mostrar explicações* em *Revisão*.
- **Repetir erros** - que erros a ronda de repetição recolhe.

### Motivação e rotina

Modo de jogo, feedback, missões diárias e lembretes.

- **Modo jogo** - lições lúdicas, incluindo a **Variante do mascote**, os
  esquemas de cores do Lernfunke que se desbloqueiam com níveis e emblemas
  ou em troca de XP (as variantes bloqueadas mostram a sua condição, as
  compras pedem uma confirmação em dois passos). O que o modo de jogo muda
  em detalhe está em [Elogios e celebrações](celebrations.md).
- **Feedback** - intensidade do feedback e sons (volume, botão de teste).
- **Missões diárias** - se as missões estão ativas, quantas por dia, a
  mistura de dificuldade e um baralhar das missões de hoje.
- **Lembretes** - a hora do lembrete e os dias em que se aplica.
- **Gamificação** - notificações de XP / emblemas, modo de fim de semana,
  a meta diária de sessões e *Redefinir progresso*; o último cartão, ver
  abaixo.

O cartão do modo de jogo mostra o interruptor principal, os sons do modo de
jogo e uma linha de estado que conta quantos extras estão ativados.
**Detalhes do modo de jogo** (corações, contagem regressiva, arcade,
rodadas especiais, tickets, lições bônus, XP de sequência e mascote) está
recolhido e lembra a sua escolha; enquanto **Lições lúdicas** estiver
desligado, as opções lá dentro ficam esbatidas.

O separador termina com a **Gamificação** (abaixo de uma linha divisória,
porque esse cartão contém *Redefinir progresso*). As duas definições de
arrumação - *Aulas pausadas no Painel* e *Tamanho máximo de aula* - são
definições do ciclo de vida dos dados e vivem no separador **Dados**
(consulte *Conteúdo offline* e *Limpeza* em Dados).

A **Visualização de conteúdo** (lista / grelha) e a **Ordem das abas de
Conteúdo** estão no separador **Geral** em *Aparência*.

### Gamificação

Alternâncias para notificações de XP / emblemas / subida de
nível (desligado silencia as notificações toast mas o sistema
continua a registar o estado), **Modo fim de semana** (ignorar
lacunas de Sáb/Dom no mapa de calor de sequência), **Meta diária de
sessões** (1..10) e **Redefinir progresso** (confirmação dupla; apaga
linhas de `user_xp` + `user_badges` + `user_streaks`).

## Fornecedor de IA + seletor de modelo

No separador **IA**, o menu suspenso do fornecedor escreve
`active_provider` em UserSettings; a próxima chamada de IA passa pelo
plugin do novo fornecedor (modo Servidor) ou pelo cliente HTTP do novo
fornecedor (modo Local).

O **seletor de Modelo** é um menu suspenso
pesquisável agrupado em Recomendados / Todos, preenchido a
partir do endpoint `/v1/models` em tempo real de cada
fornecedor (cache de 1h). Cada linha mostra o nome legível +
id bruto + emblema de janela de contexto. Quando a lista
descoberta não está disponível (sem chave de API, sem rede),
o seletor usa os padrões estáticos e apresenta uma dica
"usando padrão offline". O cabeçalho da Sessão lê
`<Fornecedor>: <Nome do modelo>`; o id completo + janela de
contexto ficam na dica de ferramenta.

## Chaves de API

Cada fornecedor tem a sua própria linha: uma entrada de chave,
um botão Guardar, um botão Remover, o emblema de fornecedor
ativo, mais o novo emblema de **atribuição de fonte**:

- **Chave de: secrets.yaml** - a chave está guardada com encriptação
  Fernet em `~/.config/adaptive_learner/secrets.yaml`. É aqui que o
  modo Servidor guarda todas as chaves que introduz nesta página, por
  isso depois de Guardar a linha mostra este emblema. Guardar e Remover
  continuam disponíveis; guardar substitui a chave armazenada. Uma linha
  informativa por baixo da linha indica o caminho.
- **Chave de: Definições** - uma chave mais antiga que ainda está na
  base de dados de antes de as chaves passarem para `secrets.yaml`; é
  movida para lá no próximo arranque. No modo Local (navegador) a chave
  vive no IndexedDB e mostra também este emblema. Pode Guardar /
  Remover livremente.
- **Chave de: ambiente** - a chave está configurada via a
  variável de ambiente `ADAPTIVE_LEARNER_<PROVIDER>_API_KEY`.
  Guardar e Remover estão desativados; a variável de ambiente é a
  fonte da verdade.
- **Sem chave configurada** - nada está definido em lado
  nenhum. Escreva e clique em Guardar para começar.

Cadeia de resolução (maior prioridade ganha): env >
secrets.yaml > BD. Consulte [o documento de Configuração](https://github.com/astrapi69/adaptive-learner/blob/main/docs/configuration.md)
para a análise completa.

As entradas de chave usam um **campo secreto** mascarado (com um
alternador mostrar/ocultar) e não acionam o gestor de palavras-passe do
navegador.

As chaves de API ficam deliberadamente **excluídas** da cópia de
segurança normal (`.alb`). Para levar as suas chaves para outro
dispositivo ou navegador, use a **exportação cifrada de chaves
(`.alk`)** dedicada - aqui no separador IA há um **botão de referência**,
**Ir para a exportação de chaves (aba Dados)**, que salta diretamente
para ela no **separador Dados** (consulte *Chaves de IA - exportação
criptografada* em *Cópia de segurança e exportação*).

## Fornecedores configurados

O cartão **Provedores de IA configurados** lista os fornecedores de IA
que configurou, cada um com uma **pré-visualização mascarada da chave**
para ver rapidamente quais estão prontos. Cada linha tem um botão
**Testar** que chama o endpoint de lista de modelos do fornecedor e
responde com ok / chave inválida / limite de pedidos / erro de rede -
uma verificação segura que não gasta tokens de geração.

## Plugins

O separador **Plugins** tem dois cartões. **Plugins instalados** lista
todos os plugins que a aplicação de desktop carregou: nome, versão,
origem (pacote ou registado diretamente) e hora de ativação. Um erro de
carregamento ou um filtro de descoberta aparece como marcador na linha,
tal como uma alteração de configuração depois da ativação. No modo
navegador o cartão continua visível com um aviso de que só a aplicação
de desktop tem um anfitrião de plugins. **Repositório de aprendizagem**
contém as definições desse plugin (persistência git, diretório dos
repositórios).

## Dados

O separador **Dados** agrupa os seus cartões em seis áreas, por uma
ordem fixa: de onde vem o conteúdo, o que acontece com ele, o que
resulta, como o protege, o que pode limpar e, por fim, o que não pode
ser desfeito. Cada área tem um pequeno título e uma descrição de uma
linha.

Uma **barra de secções** por cima das áreas lista-as como chips:
*Fontes*, *Sincronização*, *Conteúdo offline*, *Cópia de segurança e
exportação*, *Limpeza* e *Zona de perigo*. Funciona como a do separador
Aprendizagem: um clique salta para a área, num computador a barra fica
visível por baixo do cabeçalho da aplicação, o chip destacado acompanha
a área visível no ecrã, e o endereço reflete-a
(`/settings?tab=data&section=backup`; ids: `sources`, `sync`,
`offline`, `backup`, `cleanup`, `danger`).

### Fontes

- **Repositórios de conteúdo** - os repositórios de onde vêm as suas
  lições; consulte [Repositórios de conteúdo](../features/content-repos.md).
- **Registe o seu repositório** - propõe o seu próprio repositório de
  conteúdo para o diretório partilhado usado pela pesquisa entre
  repositórios.

### Sincronização

Emparelhe este dispositivo com outro pela sua rede local
usando o leitor de código QR (câmara traseira) ou cole o
URL de emparelhamento. Uma vez emparelhado, os botões de
envio + receção trocam dados bidirecionalmente. Os conflitos
passam por um resolvedor de fusão de IA no backend.

Fallback de navegador restrito: carregue uma captura de ecrã
do código QR do seu outro dispositivo (`Html5Qrcode.scanFile`).

A sincronização precisa da aplicação de desktop. No modo navegador a
área continua visível, mas os seus controlos são substituídos por um
aviso de que só está disponível com a aplicação de desktop.

### Conteúdo offline

- **Cache off-line** - o tamanho e o número de lições da cache de lições
  offline, com um botão para a limpar (pede confirmação).
- **Tamanho máximo de aula** - quando uma análise de chat longa é
  guardada como lição offline, as lições com mais etapas do que este
  número são divididas em várias partes. *Etapas por parte* aceita de 5
  a 20; o padrão é 10.

### Cópia de segurança e exportação

O cartão **Backup** oferece três coisas: **Criar backup** (transfere um
ficheiro de cópia de segurança `.alb`), **Restaurar a partir de backup**
(restaurar a partir de ficheiro) e **Comparar** (diferença lado a lado
com o estado atual). As chaves de API são removidas de todas as
exportações.

Restaurar é uma FUSÃO, não uma substituição: novas linhas
inserem, linhas mutáveis atualizam em `updated_at` mais
recente, linhas de historial (sessões / commits / avaliações)
deduplicam em UUID. A pré-visualização de comparação mostra
por tabela adicionado / removido / alterado antes de clicar
em Restaurar; o rótulo do botão Restaurar lê "Restaurar
(N adicionados, M atualizados)" assim que a diferença se
estabiliza.

No modo Local o cartão também mostra o bloco de **Backup
automático**: anel rotativo de 3 instantâneos numa BD IndexedDB
separada, corre a cada 10 sessões OU a cada 7 dias (o que
ocorrer primeiro). Cada instantâneo tem os seus próprios
botões Restaurar + Eliminar + Comparar-como-A/B.

Outros cartões nesta área:

- **Arquivo de identidade** (só no modo Servidor) - uma vista só de
  leitura do ficheiro de recuperação que o backend mantém, para ver se
  existe e onde se encontra.
- **Chaves de IA - exportação criptografada** - ver abaixo.
- **Exportação de dados** - uma cópia de segurança completa com um
  clique, ou uma exportação seletiva em que marca as categorias de dados
  a incluir; ambas produzem o mesmo ficheiro de cópia de segurança
  importável.
- **Exportar** - três relatórios: *Progresso de aprendizado*, *Detalhes
  da sessão* e *Currículo*, cada um em Markdown ou em PDF (através da
  caixa de diálogo de impressão do navegador).

#### Exportação cifrada de chaves (.alk)

A cópia de segurança normal remove as suas chaves de API, o que é
seguro, mas significa que mudar de dispositivo ou de navegador o
obrigaria a introduzir de novo cada chave à mão. A **exportação cifrada
de chaves** (cartão **Chaves de IA - exportação criptografada**) fecha
essa lacuna com um ficheiro separado, protegido por frase-passe:

- Contém **apenas** as credenciais sensíveis - as suas **chaves de API**
  mais as definições do fornecedor (fornecedor ativo, substituições de
  modelo). NÃO contém o resto dos dados da aplicação (esses ficam na
  cópia de segurança `.alb`).
- **Exportar** pede uma frase-passe (mais confirmação) e transfere um
  ficheiro **`.alk`** dedicado. As chaves lá dentro são cifradas com
  **AES-GCM-256**, com a chave derivada da sua frase-passe via
  **PBKDF2** - o ficheiro nunca contém uma chave em texto simples.
- **Importar** lê um `.alk`, pede a frase-passe, decifra e escreve as
  chaves + definições do fornecedor de volta no mesmo armazenamento
  seguro que a introdução manual usa (os fornecedores presentes são
  substituídos, os ausentes ficam intactos).
- Uma **frase-passe errada ou um ficheiro adulterado** é rejeitado de
  forma limpa com uma única mensagem e **sem importação parcial** -
  nada fica escrito a meio.
- Os campos da frase-passe validam **em linha** enquanto escreve - uma
  frase-passe demasiado curta ou uma confirmação que não coincide é
  indicada diretamente no campo (e o botão de envio fica desativado) em
  vez de disparar uma notificação de erro depois de clicar. Tal como as
  entradas de chave de API, estes campos de frase-passe **não** acionam
  o gestor de palavras-passe do navegador.

Esta exportação vive no **separador Dados**, ao lado da cópia de
segurança normal; o **separador IA** só tem um botão de referência que o
traz até aqui. No **modo Local (navegador)** as chaves vivem no
IndexedDB, por isso a exportação está totalmente disponível (e é o caso
de uso principal). No **modo Servidor** as chaves ficam do lado do
servidor e o cliente nunca vê o texto simples, por isso a entrada está
**desativada com uma indicação**. A exportação também está desativada
quando ainda não há nenhuma chave exportável configurada.

### Limpeza

- **Aulas pausadas no Painel**: o cartão de aulas pausadas do Painel só
  mostra as aulas pausadas dentro deste período (*Ocultar aulas pausadas
  com mais de* 7, 14, 30 ou 60 dias, ou *Nunca*; o padrão é 30 dias).
  Uma aula mais antiga apenas sai do cartão: nada é abandonado, e ela
  mantém a sua posição e as suas respostas. O cartão mostra as cinco
  aulas pausadas mais recentemente.
- **Conteúdo desconectado** (modo navegador): o progresso cujo
  repositório de conteúdo já não está ligado fica oculto até o eliminar
  aqui. O cartão só aparece quando há algo para limpar.

*Tamanho máximo de aula* e *Aulas pausadas no Painel* são guardados
neste navegador e aplicam-se tanto no modo Servidor como no modo Local.

### Zona de perigo

A última área, visualmente separada: **Redefinir tudo** apaga todos os
seus dados (no modo Servidor no backend, no modo navegador neste
navegador). Primeiro propõe criar uma cópia de segurança, depois pede
confirmação, e o botão final **Excluir permanentemente** só se
desbloqueia depois de escrever `RESET`.

## Integrações

O separador **Integrações** contém a **Integração com o GitHub**: um
token do GitHub (com a permissão `repo`) que permite à aplicação
partilhar lições como pull request. O campo do token verifica o formato
enquanto escreve, **Testar** verifica o token e mostra a conta a que
pertence, e uma linha de origem indica onde o token está guardado
(secrets.yaml, uma variável de ambiente ou este navegador), com
**Remover** para o apagar. Um token que vem de uma variável de ambiente
não pode ser editado aqui.

## Ajuda

O separador **Ajuda** contém o glossário da aplicação: um campo de
pesquisa filtra as entradas por título e texto, e as entradas estão
agrupadas em *Conceitos centrais*, *Métodos de aprendizagem*, *Etapas do
ciclo* e *Recursos da aplicação*. Um clique numa entrada abre o artigo
completo na gaveta de ajuda.

## Diagnóstico e suporte

O separador **Diagnóstico e suporte** reúne o que ajuda o programador a
ver o que aconteceu no seu dispositivo:

- **Suporte** - **Criar relatório de erro** reúne as suas ações
  recentes num relatório que revê antes de qualquer coisa sair do seu
  navegador.
- **Modo desenvolvedor** - mostra o detalhe técnico completo (código de
  estado, endpoint, stack trace) nas notificações de erro, e um emblema
  "DEV" na barra de navegação enquanto está ativo. O seu padrão depende
  do ramo de build: está **LIGADO por padrão no ramo Latest
  (pré-visualização)** e **DESLIGADO em Main**, para que os testadores
  da pré-visualização vejam o detalhe técnico completo dos erros
  enquanto os utilizadores de produção recebem mensagens amigáveis. Pode
  alterá-lo em qualquer sentido.
- **Sonda de toques e viewport** - regista posições de toque e
  alterações do viewport num protocolo persistente enquanto está ativa,
  para identificar erros de apresentação difíceis de reproduzir.
  **Mostrar barra de medição** mostra ou oculta a barra no topo enquanto
  a gravação continua; **Botão flutuante para a barra de medição**
  adiciona um botão flutuante (com escolha de canto) que alterna a
  barra. **Copiar protocolo** e **Limpar protocolo** atuam sobre os
  eventos registados, e um contador mostra quantos existem.

## Sobre

Cinco blocos só de leitura: **Versão** (versão canónica do
`pyproject.toml`, hash de construção, data de construção),
**Sistema** (modo de armazenamento, diretório de dados, caminho
da BD no modo Servidor, Python + informações da plataforma),
**Créditos** (autor, reconhecimentos de dependências),
**Apoie o desenvolvimento** (ligações para Liberapay /
GitHub Sponsors / Ko-fi), **Licença e recursos** (ligação MIT,
repositório, documentação, rastreador de problemas).

No modo Local o painel oculta as linhas que apenas fazem
sentido para um backend em execução (versão do Python, versões
do FastAPI / SQLAlchemy / Pydantic / PluginForge, caminho da BD).

### Ramo de build: Main vs Latest

O Adaptive Learner corre em dois ramos de implementação, e o separador
Sobre indica em qual está:

- **Main** - o site de produção estável
  (`https://astrapi69.github.io/adaptive-learner/`). Mostrado como um
  emblema discreto, sem estilo de aviso.
- **Latest** - o site de pré-visualização/testes construído a partir de
  `develop` (`https://astrapi69.github.io/adaptive-learner-content-test/`).
  Mostrado com um emblema claro de **versão de teste** para que saiba
  que pode conter erros.

O emblema mostra o ramo juntamente com o branch e o hash curto do
commit. É determinado pela informação de build incorporada no momento
da construção; uma heurística pelo URL é apenas um recurso de reserva
claramente assinalado, e a informação em falta aparece como
"desconhecido" em vez de ser adivinhada.

### Partilhar a aplicação

O separador Sobre tem uma entrada **Compartilhar o app** que mostra um
**código QR** digitalizável do URL público da aplicação, com ações de
copiar / transferir PNG / partilha nativa - prático para levar a
aplicação para um telemóvel.

Quando está no ramo **Latest**, a partilha oferece o URL de
pré-visualização **apenas como ligação - sem código QR** - juntamente
com um aviso de instabilidade, para que um código digitalizado nunca
envie alguém silenciosamente para a versão de teste instável. Em
**Main**, a partilha funciona como antes, com o código QR do URL de
produção.

### Procurar atualizações

Um botão **Procurar atualizações** no bloco Versão compara a sua versão
com o último release do GitHub. A versão de desktop executa ainda um
**verificador automático de atualizações** via a API de GitHub Releases
e avisa quando há uma versão mais recente; o seu intervalo é definido no
separador **Geral** em *Atualizações*. Depois de uma atualização da PWA,
o aviso "nova versão disponível" fica dispensado depois de o aceitar
(já não reaparece a cada recarregamento).
