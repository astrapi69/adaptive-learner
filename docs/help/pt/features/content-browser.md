# Navegador de Conteúdo

O **Navegador de Conteúdo** em `/content` é o teu ponto central
para encontrar, descarregar e iniciar conjuntos de lições. Está
estruturado em torno do fluxo de aprendizagem: primeiro a pesquisa,
depois continuar a aprender, depois o catálogo.

<!-- TODO: Captura de ecrã - Navegador de Conteúdo com campo de pesquisa, secção Continuar a Aprender e árvore de conjuntos -->

---

## Pesquisa

No topo encontra-se um **campo de pesquisa em largura total**. Ele
filtra instantaneamente (com debounce, contra o catálogo armazenado
localmente em cache) por títulos de conjuntos, descrições, domínio,
títulos de lições, frente e verso de cartões, bem como etiquetas. A
pesquisa é **tolerante** a maiúsculas/minúsculas e acentos e conhece
os dígrafos alemães (ae/oe/ue/ss). Os resultados substituem a árvore
do catálogo, com realce, contagem de resultados e estado vazio.
`Cmd/Ctrl + K` salta diretamente para o campo de pesquisa.

---

## Continuar a Aprender

Logo abaixo da pesquisa, **Continuar a Aprender** mostra a última
lição tocada por conjunto, cada uma com exatamente uma ação:
**continuar** (lição em curso/pausada, passo n de total),
**próxima** lição com estrelas após uma conclusão, ou
**conjunto concluído**.

---

## Idiomas e Conhecimento

O catálogo divide-se em duas árvores:

- **Idiomas** - como árvore *Idioma de origem → Idioma de destino → Nível*,
  filtrada pelo idioma da tua aplicação (idiomas de origem
  adicionais podem ser ativados em Definições → Aprendizagem).
- **Conhecimento** - domínios não linguísticos (p. ex. programação,
  psicologia) com os seus próprios ícones.

---

## Badges de origem e filtro de origem

Cada conjunto descarregado traz um **badge de origem** que mostra
de onde provém:

- **Oficial** / **Bundled** - do catálogo oficial ou
  incorporado na aplicação.
- **Repositório próprio** - de um repositório que ligaste.
- **Oficialmente recomendado** - da lista curada de recomendações.

Um **filtro de origem** mostra, se necessário, apenas conjuntos de
uma origem específica. Mais sobre isto em
[Múltiplos repositórios de conteúdo](content-repos.md).

---

## Recomendações de livros

Se o catálogo mantém livros recomendados para um domínio
(`books.yaml`), o Navegador de Conteúdo mostra-os como **literatura
complementar** para o respetivo domínio. Funciona em ambos os modos
de armazenamento e não precisa de backend. Formato e manutenção:
[Recomendações de livros](../content-creation/books.md).

---

## Filtro de Subject

Se atribuíste Subjects (áreas temáticas) aos teus projetos de
aprendizagem, o **Dashboard** mostra um filtro de Subject que lista
**apenas os teus próprios** Subjects (oculto quando não há nenhum),
ordenados pelo **uso mais frequente** e, a partir de mais de cinco
entradas, agrupados por categoria.

---

## As Minhas Lições

Lições criadas por ti ou importadas aparecem na secção
**As Minhas Lições** com ações para reproduzir, editar,
eliminar, exportar e partilhar. Como criar as tuas próprias lições
está descrito em [Criar lições](../content-creation/overview.md).

---

## Páginas relacionadas

- [Lições e revisões](../user-guide/lessons.md) - o fluxo da lição
- [Múltiplos repositórios de conteúdo](content-repos.md) - ligar e gerir fontes
- [As Minhas Lições](../user-guide/my-lessons.md)
