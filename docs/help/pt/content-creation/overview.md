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
4 passos (Metadados → Editor de cartões → Editor de exercícios
→ Guardar/Partilhar) e **não precisa de chave de IA**:

- Ordena os cartões por arrastar e largar ou **importa de CSV**;
  os cartões podem ter uma **imagem carregada**.
- No passo de metadados escolhes o **domínio de conhecimento**
  (p. ex. idioma, programação, psicologia, treino de cães,
  código da estrada).
- **Gera automaticamente** exercícios a partir dos cartões ou
  **edita-os totalmente tu mesmo** no passo 3: todos os tipos de
  exercício do núcleo podem ser criados, alterados e adicionados
  manualmente — incluindo **escolha múltipla** nativa com um
  controlo destacado de **resposta única/múltipla**.
- O **Ditado** (ditado de áudio) está disponível diretamente no
  seletor de tipos de exercício; carregas o clip de áudio como
  ficheiro (incorporado na lição) ou indicas um caminho de asset.
  A lição é automaticamente marcada como dependente de extensões.
- O **assistente de autoria de extensões** cria com apoio de IA
  todos os cinco tipos de exercício de extensão (categorização,
  correção de erros, compreensão de leitura, questionário
  avaliado, ditado).
- **Modelos** (Vazio / Vocabulário / Gramática / Conversação) e
  **autoguardar de rascunhos**.
- **Pré-visualização** no visualizador de lições real antes de
  guardar.
- **Guardar localmente** ou **partilhar por Pull Request**.

Existem pontos de entrada no Navegador de Conteúdo e no Dashboard.

#### Lição de conhecimento a partir de texto (modo livro)

O quinto cartão de modelo, **«Lição de conhecimento a partir de
texto»**, inicia um fluxo próprio de 3 passos (Metadados → Texto do
livro → Rever): cola uma secção (p. ex. um capítulo) do teu manual —
a IA reformula-a **por palavras próprias** como passos de teoria
(nunca uma cópia) e gera exercícios adequados que remetem para o seu
passo de teoria. Opcionalmente podes registar os dados do livro
(título, autor, URL, ISBN/ASIN); eles mantêm-se quando editares a
lição mais tarde.

Em vez de colar texto podes também **carregar um ficheiro de livro**
(EPUB, DOCX, TXT ou Markdown, até 20 MiB). O ficheiro é analisado
inteiramente **no navegador** — nada é enviado para um servidor — e
os capítulos detetados aparecem como **lista de caixas de seleção**.
Secções que parecem material inicial ou final (prefácio, glossário,
índice, …) ficam **desmarcadas por predefinição** por uma
heurística, mas continuam visíveis e selecionáveis:

- **Uma secção selecionada** — é inserida no campo de texto (com
  pré-visualização; um campo já preenchido pede confirmação).
- **Várias secções selecionadas** — a **geração em lote** cria
  **uma lição por secção** e guarda-as em conjunto como um conjunto
  de várias lições.

Ao **editar** um conjunto de várias lições, um **seletor de lições**
pergunta primeiro qual queres abrir; lições de texto de livro abrem
diretamente o editor de exercícios.

Ao contrário do caminho por cartões, este modo precisa de uma
**chave de IA configurada**. Cola apenas textos sobre os quais tens
direitos ou que se destinam a uso pessoal.

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
