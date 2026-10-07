<!-- Translation: AI-generated, pending native review -->

# Descobrir conteúdo

**Descobrir** é onde se encontram novos conjuntos de lições em toda
a biblioteca e onde se descarregam. Existe como o **separador
Descobrir dentro do hub de Conteúdo** (`/content`); o link antigo
`/discover` continua a funcionar e redireciona para lá.

A divisão é deliberada: **Meu conteúdo** mostra apenas o que já foi
descarregado, enquanto **Descobrir** é o catálogo que se percorre e
de onde se descarrega. Assim, a superfície de aprendizagem do dia a
dia fica livre de conjuntos que ainda não foram escolhidos.
**Descobrir é o separador predefinido** do hub de Conteúdo, para que
quem o visita pela primeira vez seja levado a encontrar conteúdo em
vez de uma página "Meu conteúdo" vazia.

<!-- TODO: Captura de ecrã - o separador Descobrir com a barra de pesquisa/filtro, o seletor de vista e os botões de descarga por conjunto -->

---

## Pesquisa e filtros

Descobrir assenta num **índice de pesquisa** sobre o catálogo. No
topo está uma **barra compacta de alternância Pesquisar/Filtrar**:
um toque em **Pesquisar** permite escrever uma consulta, um toque em
**Filtrar** restringe o catálogo com **filtros combináveis** -
**Idioma**, **Nível**, **Área**, nível de **Confiança** e
**Verificado por IA**. A pesquisa e os filtros funcionam em
conjunto, e a barra mantém-se compacta (só expande a parte em uso),
para não sobrecarregar os resultados em ecrãs pequenos.

A escrita filtra instantaneamente por títulos de conjuntos,
descrições, domínios, títulos de lições, frente e verso dos cartões
e etiquetas. A pesquisa é tolerante a maiúsculas/minúsculas e
acentos e conhece os dígrafos alemães (ae/oe/ue/ss). O índice é
construído de forma diferida na primeira interação - sem chamada ao
backend, funciona em ambos os modos de armazenamento.

---

## Vista de lista e de grelha

Descobrir respeita a mesma **preferência global de vista de
conteúdo** que *Meu conteúdo*: um **seletor de vista** alterna o
catálogo entre uma **lista** compacta (a predefinição) e uma
**grelha** de cartões mais rica. Alterá-la aqui altera-a também em
*Meu conteúdo*, e a escolha fica memorizada. Também é possível
defini-la em **Configurações > Geral > Aparência**.

---

## Descarregar um conjunto

Cada resultado tem uma ação **Baixar**. Descarregar copia o conjunto
para a cache local (IndexedDB no modo apenas browser, a cache no
sistema de ficheiros no modo servidor), após o que aparece em
**Meu conteúdo** e pode ser usado offline.

Cada conjunto mostra um **badge de origem** - Oficial / Incluído, um
repo próprio ligado, ou Oficialmente recomendado. O filtro
**Confiança** (ver acima) restringe o catálogo a uma única origem ou
a um único nível de confiança. Ver
[Múltiplos repositórios de conteúdo](content-repos.md) para ligar e
gerir fontes próprias.

---

## Separador Importar

O hub de Conteúdo também disponibiliza um separador **Importar**
para trazer uma exportação de chat ou um único ficheiro de lição.
Os **botões de ação** de importação/criação e as **Minhas lições**
(lições criadas ou importadas) estão agora também aqui. Os links
antigos `/import` redirecionam para lá.

---

## Páginas relacionadas

- [Navegador de Conteúdo](content-browser.md) - o "Meu conteúdo" descarregado
- [Múltiplos repositórios de conteúdo](content-repos.md) - fontes e níveis de confiança
- [Lições e revisões](../user-guide/lessons.md) - o fluxo da lição
