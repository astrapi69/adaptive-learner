<!-- Translation: AI-generated, pending native review -->

# Repos de conteúdo - publicar um repositório próprio

O Adaptive Learner inclui uma biblioteca de conteúdo oficial, mas o
sistema de conteúdo é aberto: é possível manter um **repositório de
conteúdo próprio** no GitHub, ligá-lo na aplicação e
disponibilizá-lo a outras pessoas que aprendem. Esta página dá a
visão geral; as instruções completas passo a passo estão no
**[Guia de repos de conteúdo](https://github.com/astrapi69/adaptive-learner/blob/main/docs/reference/CONTENT-REPO-GUIDE.md)**.

---

## O que é um repo de conteúdo?

Um repo de conteúdo é um repositório GitHub que contém **conjuntos
de conteúdo** no formato do Adaptive Learner. Um conjunto é uma
coleção de lições para um par de idiomas e um nível (por exemplo
"Espanhol A1 para falantes de alemão") ou para um domínio de
conhecimento (por exemplo "Fundamentos de Python").

A biblioteca oficial e todos os repos de utilizadores usam o
**mesmo formato** - não existe um esquema "oficial" separado. Assim
que o repo passa a validação, é uma fonte de conteúdo de primeira
classe. Nunca é preciso um servidor próprio: um repo de conteúdo são
apenas ficheiros num repositório Git.

---

## Pré-requisitos

- Um **repositório GitHub** (público; também é possível um privado,
  através de um token por repo).
- Um **`manifest.yaml`** na raiz que lista os conjuntos.
- Lições no **formato de lição**.
- Python 3 com PyYAML, para validar localmente antes de publicar.

As referências de formato autoritativas estão no repo de conteúdo
oficial:

- [`docs/GETTING-STARTED.md`](https://github.com/astrapi69/adaptive-learner-content/blob/main/docs/GETTING-STARTED.md)
- [`docs/LESSON-FORMAT.md`](https://github.com/astrapi69/adaptive-learner-content/blob/main/docs/LESSON-FORMAT.md)

---

## Estrutura de diretórios

Um repo de conteúdo segue uma árvore fixa. O idioma de origem (o
idioma em que as explicações estão escritas) é a pasta de topo; o
idioma de destino e o nível formam a seguinte:

```
my-content-repo/
  manifest.yaml                  # root manifest: lists every set
  sets/
    de/                          # source language (German speakers)
      es-a1/                     # target language + level (Spanish A1)
        manifest.yaml            # set manifest: lists the lessons
        lessons/
          01-greetings.json      # one JSON file per lesson (NN-slug.json)
        assets/                  # optional: images / audio
  scripts/validate_content.py    # the validator (from the starter kit)
```

---

## Validar localmente

```bash
pip install pyyaml
python3 scripts/validate_content.py
```

Código de saída 0 quando todos os conjuntos passam, caso contrário
1 com um relatório por ficheiro. Verifica o esquema, a estrutura de
diretórios e os mínimos de qualidade (pelo menos 5 exercícios, 2
tipos de exercício, 1 passo de teoria por lição, campos de cartão
não vazios, etc.).

---

## Como aparece na aplicação?

Depois de o repo ser validado, quem aprende liga-o em
**Configurações > Dados > Repositórios de conteúdo**: cola-se o URL,
a aplicação obtém o manifesto da raiz, valida-o tecnicamente,
sincroniza e guarda os conjuntos em cache. Estes aparecem depois no
**Navegador de conteúdo** com um badge de origem. Os repos também
podem ser partilhados através de um link `/add-repo` e de um código
QR.

Um repo só chega à secção **Repositórios recomendados** da aplicação
através do `recommended-repos.json` curado pela equipa do projeto, o
canal da recomendação oficial (Trust 3).

---

## Níveis de Trust

O nível de Trust indica a quem aprende quanta verificação o conteúdo
recebeu. Diz respeito à proveniência e à revisão, não a um veredicto
de qualidade.

| Nível | Nome | Significado |
|-------|------|-------------|
| **1** | Validado | Esquema correto, mínimos de qualidade cumpridos, automaticamente na sincronização. Conteúdo não revisto individualmente. |
| **2** | Verificado | Contribuído pela comunidade e revisto quanto à correção do conteúdo por quem mantém o projeto. |
| **3** | Oficial | Curado e com qualidade assegurada pela equipa do projeto. |

Trust 2+ pede mais do que os mínimos técnicos: traduções exatas,
artigos/géneros corretos, acentos completos, progressão sensata,
distratores plausíveis e exatidão cultural. Uma **revisão por IA**
opcional na aplicação ajuda os autores a detetar estes problemas
antes de partilhar (ver EXP-033); é apenas consultiva e nunca
bloqueia a partilha.

---

## Reciprocidade para cursos e websites (EXP-029)

As lições e os domínios podem trazer **media complementares**
(vídeos, podcasts, artigos, livros, cursos, websites). O filtro para
media comerciais é a **reciprocidade, não o preço**: os media
gratuitos são sempre permitidos; os cursos/websites comerciais só
quando o fornecedor inclui um link de volta, mantém um repo de
conteúdo próprio ou tem uma parceria documentada. Isto transforma os
autores de conteúdo em parceiros do ecossistema em vez de
anunciantes. Detalhes em `docs/explorations/EXP-029-media-reciprocity.md`.

---

## Kit inicial como modelo

O início mais rápido é o repo inicial pronto a usar
**[`astrapi69/adaptive-learner-content-test`](https://github.com/astrapi69/adaptive-learner-content-test)**:
contém `docs/`, modelos por domínio, uma lição de exemplo completa
(o efeito Inception), um conjunto de exemplo executável,
`books.yaml` e o validador. Basta fazer fork, substituir a lição de
exemplo por uma própria, registá-la no `manifest.yaml` da raiz,
validar e ligar o repo na aplicação.

---

## Ver também

- **[Guia completo de repos de conteúdo](https://github.com/astrapi69/adaptive-learner/blob/main/docs/reference/CONTENT-REPO-GUIDE.md)**
- [Criar lições - visão geral](overview.md)
- [Recomendações de livros](books.md)
