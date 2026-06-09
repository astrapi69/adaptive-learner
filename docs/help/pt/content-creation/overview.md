# Criar lições — Visão geral

O Adaptive Learner vive de conteúdos. Podes construir as tuas
próprias lições — diretamente na aplicação ou como ficheiro no
formato de repositório de conteúdo — e partilhá-las com a
comunidade. Esta página dá a visão geral; os detalhes pormenorizados
do formato estão nas fontes ligadas.

---

## Dois caminhos para criar lições

### 1. Na aplicação: o Criador de Lições

O **Criador de Lições** em `/create-lesson` é um assistente de
4 passos (Metadados → Editor de cartões → Gerador de exercícios
→ Guardar/Partilhar) e **não precisa de chave de IA**:

- Ordena os cartões por arrastar e largar ou **importa de CSV**.
- **Gera automaticamente** exercícios a partir dos cartões (todos
  os cinco tipos de exercício) ou ajusta-os à mão.
- **Modelos** (Vazio / Vocabulário / Gramática / Conversação) e
  **autoguardar de rascunhos**.
- **Pré-visualização** no visualizador de lições real antes de
  guardar.
- **Guardar localmente** ou **partilhar por Pull Request**.

Existem pontos de entrada no Navegador de Conteúdo e no Dashboard.

### 2. Como ficheiro: o formato de repositório de conteúdo

Uma lição é um ficheiro JSON num **conjunto de conteúdo**. Os
conjuntos ficam em repos GitHub públicos e seguem uma árvore de
diretórios fixa (`sets/{idioma-de-origem}/{idioma-de-destino-nível}/`).
As instruções de referência ficam no repositório de conteúdo:

- **Primeiros passos:**
  [`docs/GETTING-STARTED.md`](https://github.com/astrapi69/adaptive-learner-content/blob/main/docs/GETTING-STARTED.md)
- **Formato de lição:**
  [`docs/LESSON-FORMAT.md`](https://github.com/astrapi69/adaptive-learner-content/blob/main/docs/LESSON-FORMAT.md)

Um **kit inicial** pronto para observar e copiar é
[`astrapi69/adaptive-learner-content-test`](https://github.com/astrapi69/adaptive-learner-content-test).

---

## Partilhar por Pull Request

Partilhar uma lição cria um verdadeiro **Pull Request** (Fork →
Commit → PR). A aplicação sugere automaticamente o caminho correto
e um nome de ficheiro numerado, e deteta duplicados/variações.
A **pipeline de validação** do repo de conteúdo verifica cada lição
submetida em cada PR (esquema, par de idiomas, mínimos de
qualidade), para que só entrem conteúdos limpos no catálogo.
Opcionalmente existe uma verificação de conteúdo assistida por IA;
ela nunca bloqueia a partilha.

---

## Páginas relacionadas

- [Criar conteúdos de lições (programador)](../developer/authoring-content.md) — detalhes do esquema, assets, cartões de código/fórmula
- [Recomendações de livros](books.md) — manter `books.yaml`
- [Múltiplos repositórios de conteúdo](../features/content-repos.md) — ligar repo próprio
