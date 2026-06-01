<!-- Translation: AI-generated, pending native review -->

# Currículo

A página do Currículo é o seu material de aprendizagem
estruturado — o "livro" contra o qual as suas sessões
acontecem. É uma camada opcional mas poderosa sobre as sessões
de IA de fluxo livre.

## O que é um currículo

Um currículo é uma árvore de **tópicos** mais uma lista plana
de **lições**, tudo pertencente a um aprendente. Pode ter
múltiplos currículos lado a lado ("Gramática espanhola",
"Spring Boot para devs Java", "Fundamentos de guitarra
principal").

- **Os tópicos** formam uma árvore — capítulos e subcapítulos.
  Cada tópico tem um título, descrição opcional e uma referência
  pai. O botão "Adicionar subtópico" cria um filho.
- **As lições** são planas sob o currículo. Cada uma tem um
  título e um corpo de conteúdo em rich-text. Use-as para
  material escrito: notas, resumos, folhas de exercícios.

## Criar um currículo

A página do Currículo lista todos os currículos que possui. O
formulário "Criar currículo" recebe um título + descrição
opcional + idioma opcional; premir Criar abre imediatamente a
nova vista do currículo.

## A árvore de tópicos

O lado esquerdo da vista do currículo mostra a árvore de
tópicos, reordenável por arraste e largar (compatível com toque
também em dispositivos móveis). Clique num tópico para
aprofundar; o fio de navegação abaixo do cabeçalho mostra o
caminho de volta à raiz.

- **Adicionar tópico** ao nível raiz — irmão de todos os
  tópicos de nível superior existentes.
- **Adicionar subtópico** sob o tópico atualmente focado.
- **Renomear** clicando no título no modo de edição.
- **Eliminar** remove o tópico E os seus descendentes (o modo
  Dexie trata a cascata numa única transação; o modo API delega
  para o backend).

A árvore é apenas metadados; os tópicos não têm conteúdo
próprio. O conteúdo vive nas lições.

## Lições

O lado direito da vista do currículo é a lista de lições,
ordenada por `order_index`. Cada linha mostra o título da lição
e um excerto do seu conteúdo; clicar abre o editor de lições.

O editor de lições é **TipTap rich text** (desde v1.14.0):
negrito / itálico / sublinhado / tachado, cabeçalhos (H1-H3),
listas com marcadores + ordenadas + de tarefas, citação em
bloco, código em linha, blocos de código delimitados com
realce de sintaxe `lowlight` em 11 linguagens (bash / css /
html / java / javascript / json / markdown / python / sql /
typescript / yaml), ligações, alinhamento de texto, realce,
desfazer / refazer, contagem de caracteres. A barra de
ferramentas é compatível com dispositivos móveis com
deslocamento horizontal + alvos de toque de 40px.

As descrições de currículo, notas de sessão e conteúdo de
lições usam todos o mesmo editor. As exportações Markdown /
PDF passam por `renderStoredContent` que percorre a árvore de
documentos TipTap e emite Markdown GFM; o conteúdo em texto
simples de antes da v1.14.0 passa verbatim.

## Como os currículos se ligam às sessões

As sessões podem ser semeadas a partir de uma importação de
historial de chat ou do zero. O analisador de conversa
(`/api/imports`) extrai um campo `suggested_curriculum`; um
clique na importação analisada semeia um Currículo com tópicos
+ lições que correspondem às lacunas identificadas pela IA.

A IA de sessão não puxa ainda automaticamente o conteúdo de
lições individuais para o prompt do sistema — é uma retenção
deliberada até a forma de integração currículo-IA se
estabilizar.

## Comportamento por modo de armazenamento

Tanto o ApiStorage como o DexieStorage implementam o CRUD do
currículo. No modo Local os dados vivem no IndexedDB e
sobrevivem a recarregamentos do navegador enquanto não limpar
os dados do site. No modo Servidor os dados vivem na base de
dados SQLite do backend FastAPI.

[Como funcionam os modos de armazenamento](settings.md#storage-mode)
