<!-- Translation: AI-generated, pending native review -->

# As Minhas Lições: criar, guardar, partilhar

**As Minhas Lições** são lições que *você* cria - convertidas no
mesmo formato offline e jogável que os conjuntos de conteúdo
descarregados. Pode criar uma lição a partir de uma conversa
analisada, guardar uma boa lição adaptativa para repetir, exportar
uma lição para partilhar com outra pessoa e importar lições que
outros partilharam. Estes passos funcionam offline, e as suas lições
ficam no seu dispositivo até utilizar uma funcionalidade que as
transmita, por exemplo uma contribuição para a comunidade
(pull request) ou "Compartilhar como repositório", que carregam a
lição para o GitHub, ou uma verificação por IA, que envia o respetivo
conteúdo ao seu fornecedor de IA.

Encontrará As Minhas Lições no topo do **Navegador de Conjuntos**
(`/content`), acima dos conjuntos descarregados.

---

## Criar uma lição a partir de uma análise de conversa

1. Importe uma conversa e **Analise-a** (ver *Importação*).
2. No resultado da análise, clique em **Guardar como Lição Offline**.
3. Uma pré-visualização mostra a estrutura da lição - quantos
   exercícios e passos teóricos, o tempo estimado. Ajuste o título
   se quiser.
4. Clique em **Guardar**. A lição aparece em **As Minhas Lições**.

A lição é construída a partir do que a análise encontrou:

- **Teoria** a partir do tópico, resumo, subtópicos, os seus pontos
  fortes e fracos, padrões de erros comuns e qualquer currículo
  sugerido.
- **Exercícios** a partir do vocabulário extraído - correspondência e
  escrever-a-tradução para cada palavra, mais preencher-os-espaços e
  exercícios de ordenação de palavras a partir de quaisquer frases
  de exemplo.

Quanto mais rica for a análise (especialmente o vocabulário com
frases de exemplo), mais rica será a lição. Se não houver itens de
vocabulário suficientes, obterá um **guia de estudo só com teoria**
e uma sugestão para importar uma conversa mais longa para mais
material de prática.

As lições geradas correm no visualizador de lições normal com
pontuação completa, exatamente como uma lição descarregada.

---

## Jogar, editar, eliminar

Cada Minha Lição tem:

- **Jogar** - abrir no visualizador de lições.
- **Editar** - abre o **Criador de Lições pré-preenchido** com os
  metadados, os cartões e os exercícios da lição. Se um dos seus
  conjuntos contiver **várias lições**, um **seletor de lições**
  pergunta primeiro qual quer editar. As lições de texto de livro
  abrem diretamente o editor de exercícios; os metadados do livro
  anexados são preservados. Ao guardar, escolha entre **Guardar
  alterações** (substitui a mesma lição - o seu progresso de
  aprendizagem mantém-se para os cartões inalterados, os alterados
  recomeçam do zero) e **Guardar como cópia** (cria uma nova lição,
  o original fica intacto). As lições baseadas em análise continuam
  a abrir a análise de chat subjacente. As lições de terceiros
  (descarregadas) permanecem só de leitura.
- **Eliminar** - removê-la (com confirmação).

---

## Guardar uma lição adaptativa

Quando termina uma **lição adaptativa**, um botão **Guardar esta
lição?** aparece no resumo. Guardar mantém um instantâneo que pode
repetir mais tarde a partir de As Minhas Lições - útil quando uma
sessão adaptativa se revelou especialmente útil. O instantâneo
permanece jogável mesmo que o gerador adaptativo mude numa versão
posterior.

---

## Exportar e partilhar

Cada Minha Lição pode ser partilhada. Exportar não precisa de conta; o
pull request para a comunidade precisa de uma conta GitHub. Um token do
GitHub acelera o pull request e é necessário para partilhar um conjunto
inteiro como repositório próprio:

- **Exportar** - descarregar a lição como um único ficheiro `.json`.
- **Exportar como conjunto** - descarregar um `.zip` de conjunto de
  conteúdo (manifesto + lições).
- **Compartilhar com a comunidade** - leva a um **pull request** no
  repositório oficial de conteúdo. O JSON da lição fica no caminho
  certo da árvore de conteúdo, e a validação do repositório corre
  automaticamente. O pull request fica visível publicamente no GitHub
  assim que é criado. Um mantenedor revê-o; se o aceitar, todos podem
  descarregar a lição. O pull request é criado por um de dois caminhos:
    - **Sem token** - para uma lição isolada, a aplicação abre o editor
      de ficheiros do GitHub no caminho certo, com o título e a
      descrição do PR já preenchidos. O caminho, o título e a descrição
      estão no endereço dessa página, e numa lição pequena também o seu
      conteúdo; o GitHub recebe tudo isso logo que a página abre, antes
      de você confirmar alguma coisa. Numa lição maior, a aplicação
      descarrega primeiro o ficheiro e você cola o conteúdo dele no
      editor. Num conjunto com várias lições, a aplicação descarrega os
      ficheiros e abre a página de carregamento do GitHub, para onde
      você os arrasta. Em todos estes casos, o GitHub só cria o fork e
      o pull request quando você confirmar no GitHub.
    - **Com um token do GitHub** (Configurações > Integrações, ver
      [Configurações](settings.md)) - você partilha uma lição isolada
      sem sair da aplicação: a aplicação faz o fork do repositório, faz
      commit da lição, abre o pull request e depois mostra-lhe a
      ligação. Um conjunto com várias lições continua a seguir o
      caminho sem token. Se o GitHub rejeitar o token, a mensagem
      remete para Configurações > Integrações.
- **Compartilhar como repositório** - envia o conjunto inteiro, no
  formato de repositório de conteúdo, para um repositório GitHub seu
  (criado se ainda não existir) num único commit. Você escolhe o
  repositório (`owner/name`) e o ramo e, caso o repositório seja criado
  nesse momento, se é privado ou público; um repositório existente
  mantém a sua visibilidade. Antes corre
  uma verificação de qualidade: se encontrar problemas que as
  verificações de um repositório de conteúdo rejeitariam, lista-os e o
  botão passa a **Exportar mesmo assim**. Compartilhar como repositório
  precisa de um token do GitHub e só está disponível na versão de
  navegador da aplicação; caso contrário, o botão fica visível mas
  desativado, com o motivo como dica. Depois, você pode ligar o
  repositório enviado como fonte de conteúdo (ver
  [Múltiplos repositórios de conteúdo](../features/content-repos.md)).

O que você partilha ou exporta contém o conteúdo da lição, mas nenhum
progresso de aprendizagem e nenhum historial de erros da aplicação. O
que está na lição vai com ela, também o que é pessoal: por exemplo o seu
nome, se o indicar ao partilhar e o deixar mostrar (fica então na lição
e no pull request), e, numa lição criada a partir de uma análise de
conversa, tudo o que a análise encontrou, incluindo vocabulário e frases
de exemplo da sua conversa, os seus pontos fortes e fracos e os seus
padrões de erro frequentes.

---

## Importar uma lição

Clique em **Importar Lição**, escolha uma lição `.json` ou um
conjunto `.zip`, e a aplicação valida-o e mostra uma pré-visualização.
Confirme para adicioná-lo a As Minhas Lições. Se o ficheiro for
inválido, verá uma razão específica em vez de uma importação
quebrada.

Isto fecha o ciclo: um aprendente exporta uma lição, outro importa
e joga - completamente offline.
