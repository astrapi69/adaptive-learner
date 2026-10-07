<!-- Translation: AI-generated, pending native review -->

# Verificação de conteúdo por IA

O Adaptive Learner pode **opcionalmente submeter a uma revisão por IA**
um conjunto de lições descarregado (EXP-033). A IA analisa os cartões
do conjunto à procura de problemas de tradução, gramática e nível e
comunica o que encontra - nunca bloqueia nada, apenas aconselha. Além
disso, os repositórios têm um **nível de confiança** que se lê num
relance.

<!-- TODO: Captura de ecrã - Navegador de conteúdo, cartão de conjunto com o botão "Verificar com IA" + emblema "Verificado por IA" -->

---

## Níveis de confiança dos repositórios

Cada conjunto de lições mostra no Navegador de conteúdo um emblema de
origem com um nível de confiança. Este diz respeito à **proveniência**,
não à qualidade do conteúdo:

- **Confiança 0 - não validado.** Um repo recém-ligado cuja
  verificação automática (ainda) não foi aprovada.
- **Confiança 1 - tecnicamente validado.** O repo contém pelo menos
  uma lição e nenhum código executável. A verificação volta a correr
  em cada sincronização.
- **Confiança 3 - oficialmente recomendado.** Um repo curado da lista
  oficial de recomendações.

As avaliações da comunidade (Confiança 2) e um índice central ainda
não estão implementados.

---

## Pré-requisitos para a verificação por IA

A verificação por IA chama um fornecedor de IA diretamente a partir do
navegador. É necessário:

- uma **chave de API guardada** (Configurações > IA) para um dos
  fornecedores (Anthropic, OpenAI ou Gemini);
- o **modo navegador** (Dexie) - a verificação corre diretamente no
  navegador;
- um **conjunto descarregado** (a verificação trabalha sobre os
  cartões guardados em cache local).

Sem chave, o botão fica visível mas desativado; uma indicação remete
para as Configurações.

> **Custo:** a verificação gasta tokens na conta própria junto do
> fornecedor e é faturada às tarifas desse fornecedor. Antes de
> começar, a caixa de diálogo mostra uma **estimativa de custo** que
> tem de ser confirmada.

---

## Verificar um conjunto - passo a passo

1. Abrir o **Navegador de conteúdo** e escolher um conjunto
   descarregado.
2. Clicar em **"Verificar com IA"**.
3. A caixa de diálogo mostra uma **estimativa de custo**. Confirmá-la
   para iniciar a execução.
4. Os cartões são verificados em **lotes**; uma barra de progresso
   acompanha o processo, e é possível **cancelar** a qualquer momento.
5. No fim surge um **relatório por cartão**: só são listados os
   cartões com uma observação, cada um com a lição a que pertence e a
   nota da IA.

Entre duas execuções há um breve **período de espera** (cerca de um
minuto), para que não haja uma faturação dupla por engano.

---

## Aplicar sugestões (conjuntos próprios)

Os conjuntos próprios verificam-se em **Conteúdo > Meu conteúdo**: cada
linha de conjunto aí tem o mesmo botão **Verificar com IA**. Num
conjunto criado pelo próprio utilizador, o relatório traz o botão
**Aplicar sugestões**. Este abre uma tabela com uma linha por cada
sugestão que nomeia um campo do cartão (frente, verso, notas): lição,
cartão, campo, o valor atual e o valor sugerido. Todas as linhas vêm
marcadas; convém desmarcar o que for uma explicação e não um valor. As
observações sem valor aplicável são apenas contadas, nunca escritas. O
botão de confirmação indica o número de campos e de cartões que altera.

A escrita usa o mesmo caminho que o editor: o conjunto inteiro com
todas as suas lições, de modo que o título, os idiomas, o nível e a
descrição se mantêm, os ids dos cartões não mudam e o progresso de
aprendizagem é preservado. Os valores anteriores ficam guardados e
**Desfazer a última aplicação** restaura-os. Depois de uma aplicação, o
relatório guardado fica desatualizado e é descartado; para obter um
resultado novo, basta voltar a verificar o conjunto. Nos conjuntos
descarregados, o botão está desativado com uma nota de que só se aplica
às lições próprias.

## Relatório, cache e o emblema "Verificado por IA"

- **Em cache.** O relatório é guardado localmente (IndexedDB) e
  mostrado de novo na vez seguinte sem voltar a pagar. Inclui um hash
  do conteúdo + uma assinatura, pelo que um conjunto alterado sugere
  uma nova verificação.
- **Exportável.** O relatório pode ser descarregado em **Markdown** -
  prático para colar numa revisão de lição ou num issue.
- **Emblema.** Um conjunto verificado mostra um emblema **"Verificado
  por IA"** no Navegador de conteúdo, para que se veja que existe uma
  verificação.

A IA é **consultiva**: realça possíveis problemas, mas nunca impede de
aprender, editar ou partilhar um conjunto. A decisão cabe sempre a quem
aprende.

---

Para saber como isto funciona nos bastidores, ver a documentação para
programadores sobre [integração de IA](../developer/ai-integration.md).
