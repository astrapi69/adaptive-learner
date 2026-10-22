<!-- Translation: AI-generated, pending native review -->

# As Minhas Lições: criar, guardar, partilhar

**As Minhas Lições** são lições que *você* cria - convertidas no
mesmo formato offline e jogável que os conjuntos de conteúdo
descarregados. Pode criar uma lição a partir de uma conversa
analisada, guardar uma boa lição adaptativa para repetir, exportar
uma lição para partilhar com outra pessoa e importar lições que
outros partilharam. Tudo funciona offline; nada é enviado para um
servidor.

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
- **Compartilhar com a comunidade** - abre um **pull request** no
  repositório de conteúdo oficial. O JSON da lição fica no caminho
  certo da árvore de conteúdo e a validação do repositório corre
  automaticamente; um mantenedor revê o PR e integra-o, para que todos
  possam descarregar a lição. O pull request é criado por um de dois
  caminhos:
    - **Sem token** - uma lição isolada abre o editor de ficheiros do
      GitHub no caminho certo, com o título e a descrição do PR já
      preenchidos. Uma lição pequena leva também o seu conteúdo; uma
      maior é primeiro descarregada pela aplicação e cola-a no editor.
      Um conjunto com várias lições descarrega os ficheiros e abre a
      página de carregamento do GitHub, para onde os arrasta. O GitHub
      cria o fork e o pull request assim que confirmar lá.
    - **Com um token do GitHub** (Configurações > Integrações, ver
      [Configurações](settings.md)) - partilha uma lição isolada sem
      sair da aplicação: a aplicação faz o fork do repositório, faz
      commit da lição, abre o pull request e depois mostra-lhe a
      ligação. Um conjunto com várias lições continua a seguir o
      caminho sem token. Se o GitHub rejeitar o token, a mensagem
      remete para Configurações > Integrações.
- **Compartilhar como repositório** - envia o conjunto inteiro, no
  formato de repositório de conteúdo, para um repositório GitHub seu
  (criado se ainda não existir) num único commit. Escolhe o
  repositório (`owner/name`), privado ou público, e o ramo. Antes corre
  uma verificação de qualidade: se encontrar problemas que as
  verificações de um repositório de conteúdo rejeitariam, lista-os e o
  botão passa a **Exportar mesmo assim**. Depois pode ligar o
  repositório como fonte de conteúdo (ver
  [Múltiplos repositórios de conteúdo](../features/content-repos.md)).
  Precisa de um token do GitHub e só está disponível na versão de
  navegador da aplicação; caso contrário, o botão fica visível mas
  desativado, com o motivo como dica.

Os ficheiros exportados contêm apenas o conteúdo da lição - sem
progresso, sem historial de erros, nada pessoal.

---

## Importar uma lição

Clique em **Importar Lição**, escolha uma lição `.json` ou um
conjunto `.zip`, e a aplicação valida-o e mostra uma pré-visualização.
Confirme para adicioná-lo a As Minhas Lições. Se o ficheiro for
inválido, verá uma razão específica em vez de uma importação
quebrada.

Isto fecha o ciclo: um aprendente exporta uma lição, outro importa
e joga - completamente offline.
