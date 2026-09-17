# Novidades (v1.61 – v2.15)

Uma visão geral orientada ao utilizador dos lançamentos desde a
v1.61.0. As notas técnicas completas por versão estão em
[GitHub Releases](https://github.com/astrapi69/adaptive-learner/releases).

---

## v2.15.0 - Exercícios mais profundos, resumo compacto da lição

- **Exercícios paramétricos**: uma lição pode declarar variáveis cujos valores
  são sorteados de novo em cada tentativa; as respostas numéricas são
  avaliadas dentro de uma tolerância.
- **Três novos tipos de exercício**: Zonas, Parsons e Ordenação, todos
  criáveis no criador de lições.
- **Explicações depois de uma resposta**; quando crias uma lição a partir de
  texto, a IA pode escrevê-las por ti.
- **Resumo compacto da lição** (resultado e XP), a não ser que tenhas
  personalizado as secções do resumo; **Avaliação detalhada** abre a revisão
  completa.
- **Configurações reorganizadas**: secções com título e uma barra de secções
  nos separadores Aprendizagem e Dados; a aplicação de desktop lista os seus
  plugins instalados.
- **Atualizar** em Meu conteúdo aplica de uma só vez todas as atualizações de
  conjuntos disponíveis, exceto as que afetariam o teu progresso; o hub de
  conteúdo tem o seu próprio separador Criar.
- Ficha técnica e política de privacidade em alemão e inglês; correções para
  telemóvel no teclado do iOS, em cabeçalhos sobrecarregados e nas barras de
  separadores dos hubs.

## v2.14.0 - Modo jogo e arcade

- **Modo jogo opcional**: sequências de combo, pontos a voar, checkpoints,
  física das respostas, corações e contagem decrescente, e um conjunto de
  sons próprio.
- **Minijogos do Arcade** desbloqueados com XP (Memory de aprendizagem,
  Snake, Jogo do galo, Simon), mais rondas relâmpago ao concluir um conjunto.
- Variantes de cor do mascote; predefinições e molduras de avatar associadas
  ao desbloqueio de níveis e emblemas.
- As **páginas de conjunto** listam as suas lições com o progresso, sair de
  uma lição leva de volta ao seu conjunto, e uma revisão de conclusão do
  conjunto reúne todos os erros do conjunto.
- As Configurações ganham um separador **Diagnóstico e suporte**.
- Três novos tipos de extensão no assistente de criação: falar e gravar,
  escolha de áudio, blocos de áudio.

## v2.13.0 - Converter tipos de exercício

- **Mudar o tipo de um exercício diretamente** no editor de lições; o
  histórico de revisão é mantido onde o conteúdo se conserva, e a IA preenche
  os campos que uma conversão deixa vazios.
- **Editar como cópia** diretamente num conjunto descarregado; a tua cópia
  fica marcada como edição tua, e reimportar um conjunto mantém o histórico
  de revisão dos exercícios inalterados.
- A ronda de correção no fim da lição volta a registar as tuas respostas, e a
  leitura em voz alta mantém o ecrã ligado.

## v2.12.0 - Recomeçar um conjunto

- Recomeçar um conjunto concluído como **nova rodada**, enquanto o teu
  histórico de repetição espaçada continua.
- Importar chaves de fornecedor a partir de uma exportação Topos `.alk`; o
  **Perplexity** junta-se aos fornecedores de IA.

## v2.11.0 - Progresso estável

- O progresso de aprendizagem fica ancorado a **identidades estáveis dos
  exercícios**. Uma migração local única no primeiro arranque volta a
  associar o progresso existente, pelo que as correções de conteúdo já não
  deixam os teus cartões de revisão órfãos.
- Exercícios de correspondência redesenhados: a ajuda fica na fila de
  botões, o contador de progresso no topo.

## v2.10.0 - Segurança: apenas local por predefinição

- **Atualização recomendada.** O launcher de desktop e o ficheiro compose
  vinculam agora a aplicação a `127.0.0.1`. Antes, qualquer pessoa na mesma
  rede podia abri-la sem autenticação, incluindo as chaves de IA guardadas.
- Para aceder à aplicação de propósito a partir de outro dispositivo, define
  `ADAPTIVE_LEARNER_BIND_ADDRESS=0.0.0.0` no `.env`, e apenas numa rede em que
  confies.

## v2.9.0 - O launcher volta a fechar

- O launcher descarregado termina quando fechas a sua janela, também em
  ambientes de trabalho sem área de notificação (por exemplo Ubuntu GNOME). A
  aplicação continua a correr no Docker.
- A ordem das lições que definires passa a conduzir a sequência de
  aprendizagem, e a edição pertence à lição individual.

## v2.7.0–v2.8.2 - O launcher usa uma imagem publicada

- O launcher de desktop **descarrega uma imagem publicada e verificada** em
  vez de a construir no teu computador (a v2.7.0 recebeu a tag, mas as suas
  alterações só chegaram aos utilizadores com a v2.8.0).
- Um aviso de recuperação ajuda os utilizadores cujo progresso de revisão das
  lições A1 corrigidas de japonês, coreano e chinês ficou órfão; oferece
  primeiro um backup e nunca é executado automaticamente.
- **Patch de segurança v2.8.1/v2.8.2 (atualização recomendada)**: a imagem
  v2.8.0 mostrava uma página em branco no modo de imagem, e o contentor
  executado diretamente já não arranca em modo de depuração.

## v2.6.0–v2.6.1 - Novo chat da sessão, lições a partir de livros

- O **chat da sessão** foi reconstruído sobre o assistant-ui.
- **Criar lições a partir de um livro**: carrega um EPUB, TXT, MD ou DOCX,
  escolhe os capítulos e gera uma lição por cada secção selecionada.
- O editor de ditado aceita o carregamento de ficheiros de áudio; os
  conjuntos de conteúdo podem ser ocultados através do seu manifesto.
- Launcher: deteção do Docker sensível ao contexto e uma interface do
  launcher traduzida.

## v2.5.0 - Criação completa de exercícios

- Todos os tipos de exercício principais são **editáveis no criador de
  lições**, os exercícios podem ser adicionados à mão, e a escolha múltipla
  pode ser criada com modo de resposta única ou múltipla.
- Um **assistente de criação de extensões** abrange categorização, correção
  de erros, compreensão de leitura e questionário avaliado; o **ditado de
  áudio** junta-se como tipo de extensão.

## v2.4.0 - Criação de lições melhorada

- Criar uma lição de conhecimento a partir de **texto de manual colado**,
  editar uma lição própria existente, juntar lições próprias num conjunto e
  carregar imagens para cartões.
- Os exercícios de texto livre aceitam **várias respostas** e oferecem uma
  **segunda opinião da IA** perante uma resposta errada.
- O separador de configurações de IA leva diretamente à importação de chaves.

## v2.3.0 - Leitor de lições reformulado

- Painel de opções recolhível, controlo de pausa no rodapé e uma área de
  título mais estreita.
- **Exercícios de áudio com "Ouça primeiro"**.
- Importação e exportação de ficheiros de lições e de conjuntos mais
  robustas.

## v2.2.0 - Exercícios de extensão

- Quatro **tipos de exercício de extensão criados por IA**, mais escolha
  múltipla nativa.
- Um **registo federado de repositórios de conteúdo** com um fluxo para
  registar um repositório.
- Navegação móvel mais simples, sem a barra de separadores inferior.

## v2.1.0 - Polimento após o lançamento

- Remover um repositório de conteúdo **já não deixa progresso fantasma** no
  Painel, na fila de revisão ou nas lições em pausa.
- Configurações reorganizadas, correções no Percurso de aprendizagem, um
  botão **Perguntar à IA** fácil de encontrar e uma sincronização de conteúdo
  mais robusta.

## v2.0.0 - Lançamento público

- A primeira versão para o público em geral: gratuita e de código aberto
  (MIT), offline-first, sem conta, repetição espaçada, usa a tua própria
  chave de IA, cria e partilha as tuas próprias lições, instala-se como PWA.
- Um marco de lançamento, não uma rutura técnica: nenhuma alteração
  incompatível em relação à v1.99.0.

## v1.99.0 - Reforço para dispositivos móveis

- **Escolha múltipla como botões de resposta tocáveis**, o que corrige toques
  falhados no iPhone.
- Correções de dispositivo: zoom de foco no iOS, o menu de eliminação do
  iPhone e um idioma da interface memorizado.
- Filtro de idioma do conteúdo em Descobrir, seleção múltipla em Meu
  conteúdo, avanço automático opcional e exemplos resolvidos integrados.

## v1.97.0–v1.98.0 - Hub de conteúdo redesenhado

- **Meu conteúdo** mostra apenas conteúdo descarregado; a importação e a
  criação passaram para o separador Importar; visão em lista ou em grade e
  uma barra compacta de pesquisa e filtro.
- Barra lateral recolhível no desktop e estado por conjunto (ativo, adiado,
  concluído) com eliminação.
- Navegação vertical no desktop e ligações diretas para um único conjunto;
  Preencher lacunas com "selecionar todas as que se aplicam"; as respostas de
  exame alongam os intervalos de revisão; exportação `.alk` das chaves de IA
  cifrada com frase-passe.
- Traduções para espanhol e francês revistas.

## v1.95.0–v1.96.0 - Modos de lição

- Jogar uma lição ou um conjunto como **Prática, Exame, Cronometrado ou
  Aleatório**, mais "Treinar erros"; modo de exame com feedback diferido, uma
  vista de resultados, aprovado ou reprovado e um bónus de XP.
- Modos **Inverso e Infinito**, códigos de convite para partilhar conteúdo e
  mudança dos dados da instalação online para uma instalação local.
- Exportar um conjunto para um repositório GitHub.

## v1.92.0–v1.94.1 - Reforço offline e do launcher

- A PWA instalada corre em **modo de armazenamento do navegador**, como
  previsto, com correções para o guia de estudo, a pronúncia e a identidade.
- **Launcher de desktop**: fluxo Docker-first com progresso visível, portas
  configuráveis e uma única janela persistente; o launcher para Windows volta
  a ser compilado.
- Os diálogos de verificação de conteúdo com IA deslocam-se no desktop e
  mostram que fornecedor e modelo executaram a verificação.

## v1.91.0 - Reestruturação da navegação

- **Navegação principal reduzida de mais de 12 entradas para 7 entradas
  agrupadas** (Painel, Percurso de aprendizagem, Meu conteúdo, Descobrir,
  Progresso, Configurações, Ajuda) sem perda de funcionalidade - todas as
  páginas continuam acessíveis.
- **Barra de separadores inferior no telemóvel** (Aprender / Conteúdo /
  Descobrir / Progresso / Mais) com uma folha inferior "Mais".
- **ProgressHub** (`/progress`) agrupa Visão geral / Estatísticas / Meus
  caminhos em separadores; **DiscoverHub** (`/discover`) ganha um separador
  Importar. Os links antigos continuam a funcionar através de
  redirecionamentos.
- O banner de atualização da PWA já não volta a aparecer depois de aceitares
  uma atualização.

## v1.90.0 - Geração de exercícios com IA + atualização automática

- **Pipeline de geração de exercícios com IA**: gerar exercícios para uma
  lição só de teoria, com um controlo de qualidade, equilíbrio de tipos,
  regeneração com feedback e geração em lote para um conjunto inteiro.
- **Resolução animada de pares** no exercício de Correspondência.
- **Botão Testar por fornecedor** na visão geral dos fornecedores
  configurados ([Definições](user-guide/settings.md)).
- **Verificação automática de atualizações no desktop** através da API do
  GitHub Releases.
- As respostas das sessões de IA chegam agora no teu idioma da interface.

## v1.87.0–v1.88.0 - Descoberta de conteúdo + partilha por QR

- **Descoberta de conteúdo (`/discover`)**: um índice de pesquisa sobre a
  biblioteca; o descarregamento por conjunto passou para aqui, separado do
  teu "Meu conteúdo" local.
- **Partilha da aplicação por código QR**: partilhar a aplicação através de
  um código QR digitalizável (copiar / descarregar PNG / partilha nativa).
- **Construtor de currículo** + lembretes diários de aprendizagem.
- **Interface em coreano + indonésio** junta-se aos idiomas disponíveis
  (agora 11).

## v1.86.0–v1.87.0 - Validação de conteúdo com IA + backup `.alb`

- **Validação de conteúdo com IA**: verificações de qualidade para todo o
  conjunto com uma interface de relatório, relatório em cache + exportação
  em Markdown e um badge "Verificado por IA".
- **Integração de media**: uma secção de lição "Aprofundar o tema".
- **Formato de backup ZIP `.alb`** substitui o dump JSON único e inclui agora
  também um snapshot do localStorage
  ([Backup e restauro](features/backup.md)).

## v1.70.0–v1.84.0 - UX, temas e TipTap 3

- **Restauro na primeira execução**: uma instalação vazia oferece
  "Restaurar a partir de um backup existente" durante o onboarding.
- **Revisão da documentação** + ajuda contextual dentro da aplicação.
- **Editor TipTap migrado de v2 → v3** (toda a stack `@tiptap/*`).
- **Gating por feature-strategy**: as funcionalidades de IA alternam entre
  ativa / desativada / oculta sem recarregar.
- Reforço extenso do contraste no tema escuro + do layout móvel.

## v1.69.0 - Links de exemplo + recomendações de livros

- **Links de exemplo na teoria:** Um passo de teoria pode trazer um
  link opcional "Ver exemplo".
- **Recomendações de livros por domínio** no Navegador de Conteúdo
  ([Recomendações de livros](content-creation/books.md)).
- **Atalho Enter também no Replay de Erros** ("Repetir erros").
- **Correção de backup:** o título do conjunto é lido corretamente
  do manifesto ao restaurar.

## v1.68.0 - Exportação de resultados + retro-links de teoria

- **Exportar resultado da lição:** "Copiar resultado" / "Guardar
  como ficheiro" (relatório Markdown para assistentes de IA).
- **Retro-links de teoria:** saltar de um exercício para a teoria
  correspondente e voltar.
- **Exercício de correspondência reformulado:** pares coloridos +
  badges numéricos (seguro para daltónicos).
- **Contraste do modo escuro** corrigido em vários pontos.

## v1.67.1 - Restauro de backup + estabilidade do deploy

- Correção **sistemática de restauro de backup**.
- Recarregamento automático em chunk de deploy desatualizado.
- Polimento do filtro de Subject (oculto com ≤ 1 Subject,
  mais usado primeiro).

## v1.65.0 - Avaliação retomável + atalho Enter

- **Avaliação retomável:** interromper o teste e continuar mais
  tarde de onde paraste.
- **Atalho Enter:** Enter verifica um exercício respondido e avança
  (comutável em Definições → Aprendizagem).
- Exercícios de correspondência mais claros + revisão dos design
  tokens.

## v1.64.0 - Reformulação do onboarding

- **Início rápido apenas com Nome + Tema**; o resto assume
  predefinições.
- **Assistente de onboarding** opcional (uma pergunta por ecrã).
- A **avaliação é agora opcional** ([Onboarding](user-guide/onboarding.md)).

## v1.63.0 - Presets de tema WCAG AA

- **6 temas recomendados** (Catppuccin Latte/Mocha, Supabase,
  Graphite, Soft Pop, Amethyst Haze), conformes com AA por cálculo
  ([Sistema de temas](developer/themes.md)).
- Auditoria sistemática de i18n; filtro do Dashboard orientado ao
  utilizador.

## v1.62.0 - Integridade do backup + proveniência da build

- Reforço do **restauro de backup** (coerção de tipos de dados,
  ordem de FK).
- O About mostra informações reais da build em vez de "unknown".

## v1.61.0 - Conformidade dos botões + retoma de lição

- Conformidade de botões shadcn em toda a aplicação.
- **Lição pausada** continua no passo exato.
- Validação de conteúdo entre repositórios.

---

## Linhas maiores no período

- **Múltiplos repositórios de conteúdo (EXP-023):** ligar repos
  próprios, gerir vários, partilhar por link/QR, níveis de Trust,
  repos recomendados, avaliações locais
  ([Múltiplos repositórios de conteúdo](features/content-repos.md)).
- **Backup como snapshot completo** com importação entre
  identidades
  ([Backup e restauro](features/backup.md)).

---

## Páginas relacionadas

- [Primeiros passos](user-guide/getting-started.md)
- [GitHub Releases](https://github.com/astrapi69/adaptive-learner/releases) - notas completas
