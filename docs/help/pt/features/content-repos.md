# Múltiplos repositórios de conteúdo

As lições vêm de **repositórios de conteúdo** - repositórios
GitHub públicos que agrupam conjuntos estruturados de lições. Não
estás limitado ao catálogo oficial: o Adaptive Learner pode
carregar múltiplos repositórios em simultâneo, ligar os teus
próprios e recomendar repositórios curados (EXP-023).

<!-- TODO: Captura de ecrã - Definições → Dados → secção Repositórios de conteúdo com o repo oficial + um repo próprio -->

---

## O repositório oficial

O repo oficial
[`astrapi69/adaptive-learner-content`](https://github.com/astrapi69/adaptive-learner-content)
está sempre carregado e não pode ser removido. Fornece o catálogo
padrão mantido (cursos de idiomas, fundamentos de Python,
psicologia e mais). Cada conjunto dele traz no Navegador de
Conteúdo o badge de origem **Oficial**.

Além disso, uma seleção de lições está diretamente **incorporada**
(Bundled) na aplicação, para que a página pública do GitHub Pages
mostre conteúdo imediatamente mesmo sem ligação à rede. Se um
conjunto existir tanto incorporado como no repo oficial, ganha a
versão mais alta; em caso de empate, prefere-se a variante do GitHub.

---

## Ligar um repositório próprio

Em **Definições → Dados → Repositórios de conteúdo** adicionas um
URL de repo GitHub. A aplicação verifica o repo automaticamente
(ver *Níveis de Trust* abaixo), sincroniza o catálogo de lições e
armazena-o localmente na mesma cache que os conteúdos oficiais
(sistema de ficheiros no modo servidor, IndexedDB no modo apenas
browser).

- **Sincronização manual e automática.** Podes premir
  "Sincronizar agora" a qualquer momento; além disso, cada repo
  atualiza-se automaticamente a cada 24 horas.
- **Badge de origem.** Os conjuntos do teu repo trazem no Navegador
  de Conteúdo um badge de origem próprio, para que vejas sempre de
  onde provém uma lição.

---

## Gerir múltiplos repositórios

Podes ligar quantos repos quiseres. Na lista em
**Definições → Dados** podes:

- **Adicionar** através do URL do repo,
- **Remover** (o repo oficial permanece protegido),
- **Reordenar** - a ordem determina a **prioridade**.
  Se dois repos trouxerem o mesmo conjunto, ganha o que está mais
  acima.

Instalações antigas com apenas um repo ligado são automaticamente
migradas para a nova representação em lista.

---

## Partilhar repositórios

Podes partilhar um repo por **deep link** e **código QR**.
Um link no formato `/add-repo?...` abre na pessoa destinatária
diretamente o diálogo "Adicionar repositório" com o URL
pré-preenchido; o código QR faz o mesmo no smartphone. Assim
partilhas um curso com o teu grupo de estudo sem digitação manual.

<!-- TODO: Captura de ecrã - diálogo de partilha com código QR -->

---

## Níveis de Trust

Cada repo ligado passa por uma **validação técnica automática**,
que corre novamente a cada sincronização. Daí resulta um nível de
Trust:

| Nível | Significado |
|---|---|
| **0** | Ainda não validado ou verificação falhou. |
| **1** | Tecnicamente válido: pelo menos uma lição, sem conteúdo executável. |
| **3** | **Oficialmente recomendado** - da lista curada de recomendações. |

A validação é puramente técnica (estrutura + segurança). Uma
avaliação baseada em conteúdo/comunidade (Trust 2) precisa de um
serviço de backend partilhado e está atualmente adiada.

---

## Repositórios recomendados

O repo oficial mantém uma lista curada
(`recommended-repos.json`). Em **Definições → Dados** existe a
partir dela uma secção de descoberta, na qual adicionas
repositórios recomendados com **um clique**. Aparecem com o
badge **Oficialmente recomendado** (Trust 3).

---

## Avaliações locais

Podes atribuir **estrelas** localmente a cada repo. Esta avaliação
é puramente privada e é guardada apenas no teu dispositivo - ajuda-te
a organizar as tuas próprias fontes. Avaliações à escala da
comunidade também precisam de um serviço de backend partilhado e
estão adiadas.

---

## Repositórios privados e de coach

Um repo pode ser privado (por exemplo, de um docente). Para isso
defines por repo um **token de acesso pessoal**. O token é mantido
localmente (localStorage) e, de propósito, **não** faz parte da
configuração exportável, para que não seja partilhado por engano ao
partilhar as definições.

---

## Páginas relacionadas

- [Navegador de Conteúdo](content-browser.md) - encontrar, filtrar, descarregar conjuntos
- [Criar lições](../content-creation/overview.md) - contribuir com conteúdos próprios
- [Backup e restauro](backup.md) - os repos ligados fazem parte do snapshot
