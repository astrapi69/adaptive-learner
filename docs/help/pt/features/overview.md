<!-- Translation: AI-generated, pending native review -->

# Visão geral das funcionalidades

Esta página é a resposta canónica à pergunta "o que é que o Adaptive
Learner consegue realmente fazer?". Lista todas as capacidades
principais visíveis para o utilizador, agrupadas por tema, e é mantida
atual a cada lançamento. Outros locais (o README, as páginas de ajuda
individuais) apontam para aqui em vez de manterem cópias próprias
desta lista.

## Núcleo de aprendizagem

- **Seis métodos de aprendizagem** (dedutivo, indutivo, baseado em
  erros, dialógico, contextual, adaptativo por IA) com prompts de IA
  dedicados por método e por passo.
- **Ciclo de sessão em sete passos**: input, foco, tentativa,
  feedback, refinamento, transferência, integração. Um avaliador de
  prompt duplo julga cada interação e decide se avança, repete, salta
  à frente ou recua.
- **Auto-loop**: quando um tema fica integrado, a sessão escolhe um
  novo subtema e inicia um ciclo fresco (com limite por sessão).
- **Mudança de método**: a deteção de estagnação recomenda um método
  diferente quando as avaliações estagnam; aceitação com um clique.
- **Avaliação de nivelamento** (opcional, retomável) que calcula um
  perfil de aprendizagem de seis métodos; um início rápido de dois
  campos funciona sem ela.

Ver [Sessões de aprendizagem](../user-guide/learning-session.md) e
[O método de aprendizagem](../concept/philosophy.md).

## Chat de tutor com IA

- **Chat de sessão baseado em assistant-ui**: respostas transmitidas
  token a token, renderização de Markdown, temas e localização
  completa.
- **Voz**: ditado por microfone para o chat, leitura em voz alta das
  respostas e um modo dedicado de prática de pronúncia.
- **Traga a sua própria chave**: Anthropic Claude, OpenAI GPT e
  Google Gemini como plugins de fornecedor separados; descoberta de
  modelos em tempo real com um seletor recomendados/todos; teste de
  chave por fornecedor e um cofre de chaves com rollback.
- **As conversas importadas continuam como sessões de tutor**,
  mantendo o tópico original e o contexto da análise.
- **"Perguntar à IA"** em blocos de teoria e exercícios, e respostas
  da IA sempre no idioma de interface do aprendente.

## Tipos de exercício

Seis tipos do núcleo que qualquer conjunto pode usar, mais cinco
tipos de extensão que um conjunto pode trazer:

| Tipo do núcleo | O que o aprendente faz |
|---|---|
| Correspondência | Emparelhar termos em duas colunas (a começar por qualquer lado) |
| Escolha de imagem | Escolher a imagem correspondente |
| Texto livre | Escrever a resposta (tolerância a gralhas, várias respostas aceites, segunda opinião de IA opcional) |
| Texto com lacunas (Cloze) | Preencher lacunas escrevendo, selecionando ou com seleção múltipla |
| Peças de palavras | Compor a resposta a partir de peças baralhadas (arrastar por toque) |
| Escolha múltipla | Resposta única ou múltipla |

| Tipo de extensão | O que o aprendente faz |
|---|---|
| Categorização | Ordenar itens em grupos |
| Correção de erros | Encontrar e corrigir o erro numa frase |
| Compreensão de leitura | Ler um texto e responder a perguntas |
| Questionário avaliado | Um mini-questionário com pontuação |
| Ditado de áudio | Ouvir e escrever o que foi dito |

- Os exercícios são **sensíveis à direção** (reconhecer vs.
  produzir), mostram um **indicador de dificuldade por exercício**,
  suportam **conteúdo de código e fórmulas** com realce de sintaxe e
  oferecem variantes de **áudio primeiro** (ouvir antes de ler).
- As respostas erradas recebem **feedback de diferenças ao nível do
  token**; as dicas são faseadas e custam XP.

Ver [Lições](../user-guide/lessons.md) para a perspetiva do
aprendente.

## Lições e mecânica de aprendizagem

- **Sete formas de jogar uma lição ou um conjunto**: Prática, Exame
  (feedback adiado, veredito de aprovação/reprovação, bónus de XP),
  Cronometrado, Inverso, Aleatório, Infinito e um modo desbloqueável
  "Treinar erros" que repete apenas o que correu mal.
- **Repetição espaçada (SRS)** sobre o histórico de erros por
  elemento: fila de revisões pendentes, domínio sensível à direção,
  aumento de intervalo no modo de exame e duração configurável da
  sessão de revisão.
- **Lições adaptativas** geradas a pedido a partir dos seus próprios
  padrões de erro (baseadas em regras, offline, sem chave de API).
- **Replay de erros e uma ronda de correção** no fim da lição treinam
  exatamente as palavras que errou.
- **Controlo de fluxo da lição**: pausar, retomar no passo exato,
  gravação automática e um widget de lições pausadas no painel.
- Classificação de 0 a 3 estrelas, favoritos, sugestões de próximo
  passo, divisão automática de lições demasiado grandes e links de
  regresso à teoria a partir dos exercícios.

## Criação de lições (Create-Lesson)

- **Um assistente sem chave de API** constrói uma lição completa e
  partilhável: editor de cartões com arrastar e largar e importação
  CSV, carregamento de imagem por cartão, modelos, gravação
  automática de rascunhos e pré-visualização no leitor de lições
  real.
- **Todos os exercícios são editáveis**: todos os tipos do núcleo
  podem ser editados após a geração, adicionados à mão e
  equilibrados; um **assistente de autoria de extensões** cobre os
  cinco tipos de extensão, incluindo o carregamento de um ficheiro de
  áudio para o ditado.
- **Ingestão de texto de livro**: cole texto de um manual ou carregue
  um ficheiro de livro (EPUB, DOCX, TXT, Markdown) com seletor de
  capítulos, seleção múltipla das secções detetadas, uma heurística
  automática de exclusão de páginas iniciais e finais e geração de
  lições em lote por secção.
- **Geração de exercícios por IA** (com a sua própria chave) com um
  gate de qualidade determinístico, regenerar com feedback e geração
  em lote para um conjunto inteiro.
- **Gerir as suas próprias lições**: editar qualquer lição de um
  conjunto com várias lições através de um seletor de lições,
  combinar lições próprias num conjunto e escolher um domínio de
  conteúdo (idiomas mais domínios de conhecimento).

Ver [Criar lições](../content-creation/overview.md).

## Importação e análise

- **Importação de históricos de chat** do ChatGPT, Claude, Gemini e
  de Markdown arbitrário ou texto colado.
- **A análise por IA** extrai o tópico, os pontos fracos, os padrões
  de erro, o método recomendado, o vocabulário e um currículo
  sugerido.
- Um clique semeia um **currículo**, inicia uma **sessão dirigida**
  ou converte a análise numa **lição offline rejogável**.

## Gestão de conteúdo

- **Hub de conteúdo** com os separadores Descobrir / Meu conteúdo /
  Importar, vista em lista ou grelha e uma barra de pesquisa e
  filtros (idioma, nível, domínio, confiança, verificado por IA).
- **Conjuntos de lições descarregáveis** de repositórios de conteúdo
  públicos no GitHub, guardados em cache para uso offline; os
  conjuntos podem ser ocultados através de uma flag de visibilidade
  no manifesto.
- **Repositórios federados**: ligar vários repositórios de conteúdo
  próprios ou de terceiros (repos privados via token), uma secção de
  repositórios recomendados e badges de confiança por fonte.
- **Partilha com a comunidade**: um assistente de partilha em quatro
  passos abre um pull request real contra um repositório de conteúdo,
  com colocação inteligente e deteção de duplicados; códigos de
  convite suportam a partilha privada para coaches.
- **Deep links e códigos QR por conjunto**, uma vista de percurso de
  aprendizagem com domínio por conjunto, recomendações de livros por
  domínio e uma secção de livro companheiro por conjunto.

Ver [Navegador de conteúdo](content-browser.md),
[Descobrir](discover.md) e
[Repositórios de conteúdo](content-repos.md).

## Gamificação

- **XP e níveis** com um badge de XP visível e recompensas por lição.
- **Catálogo de badges por escalões** (bronze/prata/ouro; os badges
  bloqueados continuam visíveis com uma dica de desbloqueio).
- **Sequências** com um mapa de calor e **missões diárias** (até três
  objetivos adaptativos por dia).
- **Celebrações**: elogios merecidos e com intensidade configurável,
  overlays de marcos, sons opcionais, tudo seguro para movimento
  reduzido.

## Exportações e backup

- **Anki**: cartões de memória extraídos por IA, revistos na
  aplicação, exportados como `.apkg` ou `.txt`.
- **NotebookLM**: um ZIP com resumo, vocabulário, regras, erros,
  cartões de memória e sessões, mais perguntas de recuperação ativa e
  um guia de estudo.
- **Repositório de aprendizagem**: artefactos Markdown por projeto
  (README, estatísticas, folha de consulta, roadmap), descarregáveis
  como ZIP ou com commit via git no modo servidor.
- **Relatórios de progresso** em Markdown ou PDF; resultados de
  lições exportáveis para prática assistida por IA; folha de partilha
  nativa para os resultados.
- **Backups**: backup ZIP `.alb` que cobre toda a superfície de
  dados, gravação em disco, restauro no primeiro arranque, migração
  de online para local e uma exportação `.alk` separada, encriptada
  com frase-passe, para as chaves de IA.

Ver [Backup e restauro](backup.md).

## Plataforma

- **Progressive Web App (PWA)**: instalável, funciona offline,
  atualizações via service worker com um banner de atualização, corre
  totalmente no browser.
- **Dois modos de armazenamento**: local-first (tudo no IndexedDB do
  browser, as chamadas de IA vão diretas ao fornecedor, sem
  necessidade de servidor) ou modo servidor (backend FastAPI com
  SQLite, vários dispositivos).
- **Sincronização em rede local** entre dispositivos com
  emparelhamento por código QR e resolução de conflitos.
- **Launcher de desktop** para Linux, macOS e Windows: auto-hospedagem
  com um clique baseada em Docker, com deteção de Docker sensível ao
  contexto e autodiagnóstico.
- **Onze idiomas de interface**, totalmente traduzidos, com um
  seletor de idioma pesquisável.
- **Formato de conteúdo aberto**: as lições são JSON simples validado
  contra um esquema publicado; a aplicação consome o motor de
  conteúdo como um pacote.

Ver [Instalação](../install/launcher.md).

## Acessibilidade e UX

- **Temas verificados segundo WCAG AA** (claro, escuro, presets
  coloridos, modo automático que segue o sistema operativo),
  garantidos por verificações de contraste automatizadas.
- **Teclado primeiro**: atalhos globais com um overlay de ajuda,
  Enter avança nas lições, Tab navega pelas lacunas do texto com
  lacunas.
- **Suporte a leitores de ecrã**: landmarks, etiquetas ARIA e regiões
  live, tabelas de dados para os gráficos, gestão de foco nos
  diálogos.
- **Movimento reduzido** é respeitado em todo o lado; leitura em voz
  alta (TTS) para lições e chat.
- **Ajuda contextual na aplicação**: o painel de ajuda abre o artigo
  da vista atual; cada artigo liga a este site de documentação.
