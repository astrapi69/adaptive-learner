# Criar conteúdos de lições

Este guia descreve passo a passo como configurar um novo conjunto de
lições para o content-loader do Adaptive Learner. Quem quiser
construir um conjunto de idiomas ou de tema — para uso próprio ou
como contribuição para o pool público de conteúdo — deve lê-lo uma
vez por completo antes da primeira lição.

## O que é um conjunto de conteúdo?

Um **conjunto de conteúdo** é um pacote versionado de lições que um
utilizador pode descarregar através da página do navegador de
conjuntos (`/content`). O plugin content-loader (v1.27.0) trata da
descoberta, do download, do caching e da reconciliação de versões em
ambos os modos de armazenamento.

Um conjunto tem três níveis:

1. **Manifesto raiz** (`manifest.yaml`) — lista cada conjunto do
   repo. É lido pelo navegador de conjuntos para o catálogo de
   origem.
2. **Manifesto do conjunto** (`sets/{set-id}/manifest.yaml`) —
   irmão do manifesto raiz, lista os ficheiros de lição do conjunto
   concreto.
3. **Ficheiros de lição** (`sets/{set-id}/lessons/NN-slug.json`) —
   um ficheiro JSON por lição, validado contra o esquema de lição em
   cada download (ver *O esquema é a única fonte de verdade* mais
   abaixo).

Os conjuntos fornecidos com o Adaptive Learner ficam no repo de
conteúdo separado [`astrapi69/adaptive-learner-content`](https://github.com/astrapi69/adaptive-learner-content)
(feito checkout como irmão `../adaptive-learner-content` e empacotado
offline na build do GitHub Pages através de
`frontend/scripts/copy-bundled-content.mjs`) e servem bem como
modelo. O tamanho atual da biblioteca (contagens de lições /
conjuntos / domínios, a tabela por conjunto, e os domínios ativos) é
o bloco CONTENT-STATS no [`README.md`](https://github.com/astrapi69/adaptive-learner#readme) do
projeto — esse bloco é a única fonte de verdade, gerado a partir de
um checkout de conteúdo fresco, por isso este guia não duplica os
números.

## O esquema é a única fonte de verdade (EXP-039)

O formato de lição/exercício tem **uma definição canónica**: o JSON
Schema de lição fornecido pelo pacote npm
[learn-content-engine](https://github.com/astrapi69/learn-content-engine)
(imutável por release publicada). Dentro desta app, a camada Pydantic
**estrutural** no plugin do carregador de conteúdo
(`adaptive_learner_content_loader.schema`) é **regenerada** a partir
desse espelho (`scripts/generate_pydantic_models.py`); apenas os
validadores semânticos entre campos são escritos à mão.
`make sync-schema` atualiza o espelho e volta a emitir os artefactos
derivados, e portões de paridade de bytes provam que `schema/*.json`
é igual à release fixada da engine. Os sítios que antes derivavam já
não o podem fazer:

- `schema/lesson.schema.json` (+ ficheiros irmãos): o JSON Schema
  legível por máquina (Draft 2020-12). Referencia-o a partir de um
  `.json` de lição através de uma chave `"$schema"` de nível de topo
  para obteres autocompletar do IDE e validação inline.
- `schema/quality-rules.json`: os mínimos de qualidade partilhados
  (p. ex. número de exercícios, número de respostas aceites de
  free-text), consumidos pelo validador de conteúdo do lado do
  cliente em vez de uma segunda cópia mantida à mão.
- Os tipos de lição TypeScript do frontend e a página MkDocs
  [Referência do formato de lição](lesson-format-reference.md) também
  são gerados (**não os edites à mão**); seguem o espelho da engine,
  portanto volta a correr o gerador depois de cada re-pin.

Um portão contra deriva (`make sync-schema-check`, parte de
`release-test`, mais `backend/tests/test_lesson_schema_drift.py` em
`make test`) falha se algum artefacto gerado divergir do espelho
fixado da engine. O fecho da cadeia é o portão de paridade de bytes
app-contra-engine: `make engine-parity-check`
(`scripts/check_engine_schema_parity.py`), o pin offline
`engine-schema-parity.test.ts` e o teste de coerência do pin
`engine-pin.test.ts` (dependência de `frontend/package.json` ==
`schema/engine-version.txt`). Os repos de conteúdo espelham **a
release fixada da engine** (não este repo) e validam contra esse
espelho na sua própria CI.

**Procedimento para alterações de formato (autoridade do esquema na
engine):** uma alteração ao formato de lição começa na engine, ou é
ratificada lá: primeiro PR na engine + release npm; depois esta app
sobe o pin da engine (`frontend/package.json` +
`schema/engine-version.txt`) e volta a correr `make sync-schema`, que
atualiza o espelho e regenera a camada Pydantic estrutural; apenas os
novos validadores semânticos são escritos à mão; depois os repos de
conteúdo atualizam o seu pin `engine-version.txt`. Uma edição manual
do espelho (ou um pin desatualizado) põe os portões de paridade de
bytes a vermelho; o passo esquecido torna-se visível, nunca há deriva
silenciosa.

## Pares de idiomas (v1.44.0)

Cada conjunto de conteúdo declara o PAR de idiomas que ensina:

- **`target_language`** — o que o aprendiz APRENDE (p. ex. `fr`).
- **`source_language`** — o que o aprendiz já FALA, ou seja, o
  idioma em que os campos **`back`** dos cartões, as **`notes`** e o
  texto de **teoria** estão escritos (p. ex. `de`).

É justamente isto que torna "Francês para falantes de inglês" num
conjunto *diferente* de "Francês para falantes de alemão": mesmo
destino (`fr`), idioma de origem diferente (`en` vs. `de`), idioma
de explicação diferente. Um aprendiz só vê conjuntos cujo
`source_language` corresponda a um idioma que fala (idioma da
aplicação mais idiomas adicionais opcionais em Definições →
Aprendizagem).

Os IDs de conjunto codificam o par como `{destino}-{nível}-from-{origem}`
(p. ex. `fr-a1-from-de`), e cada conjunto declara um **`path`**
que aponta para o seu diretório de idioma de origem (`sets/de/fr-a1`).
Um conjunto traz ainda **`title`** (no idioma de origem, o que o
aprendiz lê) e **`title_native`** (no idioma de destino, como título
secundário).

Ambos os códigos têm de ser ISO 639-1 (duas letras), e
`source_language` tem de ser diferente de `target_language`. Os
conjuntos anteriores à v1.2 sem estes campos continuam a carregar: a
antiga chave `language` é aceite como `target_language`, e
`source_language` recai em `en`.

## Layout de diretórios

A árvore está organizada por IDIOMA DE ORIGEM, depois destino+nível:

```
my-content-repo/
  manifest.yaml               # Root: lists every set (with path + pair)
  sets/
    de/                       # Source language: German
      fr-a1/                  # Target French, level A1  -> ID fr-a1-from-de
        manifest.yaml         # Set: lists the lessons
        lessons/
          01-begruessung.json
          ...
        assets/               # optional images / audio
    en/                       # Source language: English
      fr-a1/                  # -> ID fr-a1-from-en
        ...
```

### Índice de pesquisa (`search-index.json`)

A descoberta e a pesquisa de conteúdo (a superfície *Descobrir*) são
impulsionadas por um `search-index.json` enxuto publicado na raiz do
repo (~4 KB, apenas metadados — sem conteúdo de cartão). O repo de
conteúdo oficial fornece-o, e a app vai buscar os índices de cada
repo configurado do lado do cliente (seguro para CORS, em cache no
localStorage com um TTL stale-while-revalidate de 24 h) para que um
aprendiz possa ENCONTRAR um conjunto antes de o descarregar. Cada
entrada anuncia o `id`, o `name`, a `description`, o
`source_language` / `target_language`, o `level`, o `domain`, o
`lesson_count`, o `card_count`, as `tags`, um flag `ai_validated`, um
`trust_level`, um `book` companheiro opcional, e um timestamp
`updated_at` do conjunto. Mantém-no em sincronia com os manifestos
dos conjuntos; um PR ao repo oficial regenera-o.

## Formato do manifesto

O esquema de campos do manifesto (o `manifest.yaml` raiz que lista os
conjuntos do repo, e cada campo obrigatório e opcional:
`schema_version`, `name`, e por conjunto `id`, `title`,
`title_native`, `target_language`, `source_language`, `level`,
`version`, `lesson_count`, `path`, `domain`, `tags`, `book`) fica na
referência da engine:
[learn-content-engine, Manifest format](https://github.com/astrapi69/learn-content-engine/blob/main/docs/lesson-format.md#manifest-format).
O esquema estrito da engine (campos desconhecidos são rejeitados)
valida-o, por isso a lista de campos acima não pode derivar. Cria os
campos do par de idiomas (`target_language` / `source_language`) como
descrito em [Pares de idiomas](#pares-de-idiomas-v1440); o alias
`language` anterior à v1.2 ainda carrega mas é desaconselhado para
novos conjuntos.

Comportamento do loader específico da app a ter em mente:

- O manifesto do conjunto lista cada ficheiro de lição sob
  `metadata.lessons`, e o content-loader itera essa lista **pela
  ordem dada**: os nomes dos ficheiros no disco são irrelevantes, só
  conta a ordem do manifesto:

  ```yaml
  metadata:
    lessons:
      - 01-intro.json
      - 02-articles.json
      - ...
  ```

## Esquema de lição

Cada lição é um único ficheiro JSON: metadados de topo (`id`,
`title`, `description`, `estimated_minutes`), uma lista de **cards**
(as menores unidades aprendíveis — ids estáveis, pares front/back,
`notes` em Markdown, `tags` para o SRS) e uma lista de **steps**,
cada um ou um passo THEORY (um `body` em Markdown, opcionalmente um
link `example_url` ou `examples` inline) ou um passo EXERCISE
(exatamente um exercício).

A referência de formato completa, campo a campo — cada campo, cada
tipo de exercício, cada modo de cloze, com exemplos JSON validados
pela suite de testes da engine — fica na **referência da engine**:

- [learn-content-engine — `docs/lesson-format.md`](https://github.com/astrapi69/learn-content-engine/blob/main/docs/lesson-format.md)
  — a referência canónica do formato de lição para autores e
  validadores de terceiros (sem necessidade de checkout da app)
- o esquema legível por máquina empacotado com cada release da
  engine: `import schema from "learn-content-engine/schema/lesson.schema.json"`
- o gémeo na app: a
  [Referência do formato de lição](lesson-format-reference.md) gerada

O esquema empacotado da engine é byte-idêntico ao
`schema/lesson.schema.json` gerado deste repo (garantido por `make
engine-parity-check`), pelo que "valida contra a engine" e "valida na
app" são a mesma afirmação.

## Que tipo de exercício para que objetivo de aprendizagem

Escolhe o tipo de exercício pelo **objetivo de aprendizagem**, não
pela variedade. A avaliação por correspondência exata palavra a
palavra — um `word_tiles` de frase inteira, ou um `free_text` de
frase completa — falha para a **produção livre**: um conceito pode
ser formulado de muitas formas corretas, por isso um aprendiz com o
conteúdo certo é marcado como errado palavra a palavra. Esse é o
momento mais desmotivador que uma lição criada pode produzir. Em vez
disso, adequa o tipo ao objetivo:

| Objetivo de aprendizagem | Tipo certo |
|---|---|
| Um facto com uma resposta | `cloze` (uma lacuna) |
| Reconhecer um conceito | escolha múltipla (`cloze` em modo `select`) / `matching` |
| Definir um conceito | `cloze` com lacunas de termos-chave |
| Explicação livre / transferência / comparação | ainda não há tipo de correspondência exata — usa `cloze` / escolha múltipla por agora; a autoavaliação está planeada |
| Frase com uma ordem de palavras inequívoca (aprendizagem de idiomas) | `word_tiles` |

Regra prática: reserva `word_tiles` para frases cuja ordem de
palavras seja genuinamente única (um exercício de tradução), e cria
definições e factos como `cloze` (ou escolha múltipla via `cloze` em
modo `select`). Nunca ponhas uma definição em forma livre em
`word_tiles` ou `free_text` de frase completa — não há avaliação
justa por correspondência exata para isso. Análise completa: ver
EXP-041
(`docs/explorations/EXP-041-aufgabentyp-eignung-und-faire-bewertung.md`).

## Catálogo de tipos de exercício (estado)

Uma referência de cada tipo de exercício: o que existe, o que é
exprimível sem um tipo novo, o que é candidato e o que é
deliberadamente excluído. O modelo canónico **não** é estendido por
especulação — um tipo só é lançado com o seu renderizador (o registo
`SUPPORTED_EXERCISE_TYPES` tem de ser igual à enum `ExerciseType`; um
teste de paridade impõe-no, a lição aprendida dos casos v1.4-preview
/ `picture_choice`). Novos tipos são adicionados por procura concreta
de conteúdo via a receita
[Adicionar um novo tipo de exercício](adding-exercise-type.md).

### Implementados (a enum `ExerciseType`)

| Tipo | Para quê (objetivo de aprendizagem, EXP-041) | Nota |
|------|-----------------------------------|------|
| `matching` | Reconhecer / emparelhar conceitos | Arrastar pares, ≥ 3 pares. |
| `picture_choice` | Reconhecer a partir de uma **imagem** real | ≥ 2 imagens, exatamente uma correta. Não para escolha múltipla de texto. |
| `free_text` | Produzir uma resposta curta, em forma de facto | Correspondência exata, depois Levenshtein ≤ 1. |
| `word_tiles` | Uma ordem de palavras inequívoca (idioma) | Peças baralhadas; `accept_orderings` para variantes. |
| `cloze` (`type`) | Um facto com uma resposta | Um `<input>` por lacuna. |
| `cloze` (`select`) | Escolha múltipla única (mecanismo legacy) | Renderiza como botões tocáveis (#1342). `accept[0]` correto + `distractors`. |
| `cloze` (`multiselect`) | "Seleciona tudo o que se aplica" (mecanismo legacy) | Correspondência por conjunto exato sobre `accept` (todos corretos) + `distractors` (#1195). |
| `multiple_choice` | **Escolha múltipla de texto nativa** (esquema v1.6, #1525) | `options` (`{text, correct?}`, textos únicos) + `multiple`. Única = exatamente uma correta; múltipla = correspondência por conjunto exato, sem pontos parciais. |

Desde o esquema v1.6 existe um tipo nativo `multiple_choice`.
**Coexiste** com o mecanismo `cloze` `select`/`multiselect` (EXP-036
§4.3, #890) — a escolha múltipla baseada em cloze existente continua
válida, nada fica deprecated. Prefere `multiple_choice` para novo
conteúdo de escolha múltipla de texto: a correção é um flag por
opção, pelo que a armadilha da disjunção accept/distractors não pode
acontecer. Ver [Criação de escolha múltipla](#criacao-de-escolha-multipla).

### Nível de extensão (o namespace `ext:`)

Para além da enum fechada do núcleo, há tipos de exercício no
namespace `ext:<vendor>-<name>`. São estruturalmente opacos ao
esquema do núcleo: uma lição que os usa declara-os em
`requires_extensions`, e o payload é validado pela extensão
registada, nunca pelo esquema do núcleo. O mecanismo está descrito na
referência da engine
[learn-content-engine — `docs/extensions.md`](https://github.com/astrapi69/learn-content-engine/blob/main/docs/extensions.md).
A app adotou cinco tipos de extensão (`SUPPORTED_EXT_EXERCISE_TYPES`
no `ExerciseDispatcher`; um portão de paridade mantém o dispatcher e
o load guard em sincronia, de forma que tudo o que é carregável é
renderizável):

| Tipo | Para quê | Payload (`ext_payload`) | Adotado |
|------|----------|-------------------------|---------|
| `ext:al-categorization` | Ordenar termos em grupos | `categories: [{name, items[]}]`, pelo menos 2 grupos | #1591 (primeiro tipo de extensão, inventário #1579) |
| `ext:al-error-correction` | Corrigir um texto com erro | `tokens[]` + `error_index` + `accept[]` | #1593 |
| `ext:al-reading-comprehension` | Compreensão de leitura (passagem + perguntas) | `passage` + `questions[]` (cada uma uma subpergunta `multiple_choice` / `free_text`) | #1603 |
| `ext:al-graded-quiz` | Questionário avaliado | `questions[]` (cada uma com `points`) + `pass_threshold` opcional | #1616; o conjunto de referência de demonstração está oculto do Descobrir / Os Meus Conteúdos (#1702) |
| `ext:al-dictation` | Ditado de áudio (ouvir, depois transcrever) | `audio` (um clip de `assets/`) + `accept[]` (correspondência tolerante da transcrição) | #1881 (quinta adoção) |

**Dois caminhos de autoria.** Os exercícios de extensão podem ser
criados (a) diretamente como JSON no repo de conteúdo (o caminho
canónico, descrito na referência da engine), ou (b) na aplicação. O
Criador de Lições ganhou um **assistente de autoria de extensões**
(#1852), acedido a partir do modelo *Tipos de exercício avançados* no
passo 1, que cobre os cinco tipos (#1859 categorização + correção de
erros, #1865 compreensão de leitura + questionário avaliado, #1887
ditado). O ditado também é acessível a partir do seletor de tipos de
exercício do núcleo no passo 3, atrás de um portão
`requires_extensions` generalizado (#1895). Qualquer caminho emite o
mesmo JSON de lição e define `requires_extensions` (versionado, p. ex.
`ext:al-dictation@1`).

#### Exemplo por tipo de extensão

Cada bloco é o objeto de exercício tal como aparece num `.json` de
lição; os dados específicos do tipo ficam sob `ext_payload`. A
referência canónica dos campos é o `docs/extensions.md` da engine.

```json
{
  "type": "ext:al-categorization",
  "prompt": "Sort each word into fruit or vegetable.",
  "ext_payload": {
    "categories": [
      {"name": "Fruit", "items": ["apple", "banana"]},
      {"name": "Vegetable", "items": ["carrot", "potato"]}
    ]
  }
}
```

```json
{
  "type": "ext:al-error-correction",
  "prompt": "One word is wrong. Correct it.",
  "ext_payload": {
    "tokens": ["The", "two", "child", "are", "playing"],
    "error_index": 2,
    "accept": ["children"]
  }
}
```

```json
{
  "type": "ext:al-reading-comprehension",
  "prompt": "Read the text and answer.",
  "ext_payload": {
    "passage": "Marie is sitting in a café. She orders a coffee and reads a book.",
    "questions": [
      {
        "prompt": "Where is Marie?",
        "type": "multiple_choice",
        "options": [
          {"text": "In a café", "correct": true},
          {"text": "At home"},
          {"text": "At the station"}
        ]
      }
    ]
  }
}
```

```json
{
  "type": "ext:al-graded-quiz",
  "prompt": "Greetings quiz.",
  "ext_payload": {
    "pass_threshold": 60,
    "questions": [
      {
        "prompt": "How do you say 'hello' in French?",
        "type": "multiple_choice",
        "points": 1,
        "options": [
          {"text": "Bonjour", "correct": true},
          {"text": "Merci"},
          {"text": "Au revoir"}
        ]
      }
    ]
  }
}
```

```json
{
  "type": "ext:al-dictation",
  "prompt": "Listen and type what you hear.",
  "ext_payload": {
    "audio": "assets/audio/comment-ca-va.mp3",
    "accept": ["Comment ça va ?", "Comment ca va"]
  }
}
```

### Disponibilidade no assistente de lições

Jogável (existe um renderizador), gerável (a mistura de IA consegue
produzi-lo) e adicionável manualmente (adicionas e editas um à mão no
passo 3) são três coisas diferentes. Todos os seis tipos do núcleo
são jogáveis E geráveis: o seletor de tipos no assistente de criação
de lições (`ALL_TYPES` em `ExerciseGenerator.tsx`) oferece cada tipo
do núcleo, e cada exercício do passo 3 é editável inline e
reordenável, com um botão manual **+ Adicionar exercício** (#1849,
#1853).

| Tipo | Jogável | Gerável (mistura de IA) | Adicionável manualmente (passo 3) |
|------|----------|----------------------|---------------------------|
| `matching` | sim | sim | sim |
| `free_text` | sim | sim | sim |
| `cloze` | sim | sim | sim |
| `word_tiles` | sim | sim | sim |
| `picture_choice` | sim | sim | sim |
| `multiple_choice` | sim | sim (#1853; controlo de modo única/múltipla #1888) | sim |
| `ext:al-dictation` | sim | não | sim, via o seletor do núcleo (#1895) ou o assistente de extensões (#1887) |
| `ext:al-categorization` | sim | não | via o assistente de extensões (#1859) |
| `ext:al-error-correction` | sim | não | via o assistente de extensões (#1859) |
| `ext:al-reading-comprehension` | sim | não | via o assistente de extensões (#1865) |
| `ext:al-graded-quiz` | sim | não | via o assistente de extensões (#1865) |

Os quatro tipos de extensão que não são ditado são criados no
assistente de extensões (ou como JSON no repo de conteúdo), nunca
misturados na geração de IA do núcleo.

**Ouvir-primeiro é um modo, não um tipo.** Desde #1687 (decisão
#1600, opção A) os exercícios `free_text` e `matching` podem trazer
um elemento de áudio-primeiro (ouvir primeiro, depois responder). O
tipo do exercício não muda. A opção B da mesma decisão, um tipo de
ditado, foi lançada como a extensão `ext:al-dictation` (#1881),
documentada no nível de extensão acima.

### O Criador de Lições como ferramenta de autoria

O Criador de Lições da aplicação (`/create-lesson`) é uma superfície
de autoria completa, não apenas um botão de gerar com IA:

- **Cada exercício do passo 3 é editável no lugar.** Cada exercício
  gerado ou adicionado abre num editor inline (todos os seis tipos do
  núcleo, mais os editores de extensão); reordena por arrasto,
  elimina, ou regenera a mistura inteira (#1845).
- **Adiciona um exercício à mão.** O botão **+ Adicionar exercício**
  escolhe um tipo e acrescenta um exercício vazio diretamente ao
  editor inline, para poderes criar sem qualquer geração de IA
  (#1849, #1853). O seletor lista os seis tipos do núcleo mais o
  ditado (#1895).
- **A frase de exemplo impulsiona a geração.** Um cartão (passo 2)
  pode trazer uma **frase de exemplo** opcional. É o que ativa a
  geração de `cloze` e `word_tiles` para esse cartão (para cloze, a
  frase tem de conter o termo da frente do cartão para poder ser
  transformado em lacuna), e uma imagem de cartão ativa
  `picture_choice`. Sem elas, esses tipos são silenciosamente
  ignorados, e o passo 3 explica qual tipo selecionado não produziu
  nada (#1847, #1848).
- **Os prompts gerados seguem o idioma da interface.** Os modelos de
  instrução de exercício são localizados no momento da geração
  (#1857), pelo que um autor numa interface em alemão obtém prompts
  em alemão, não os predefinidos em inglês. Quando abres uma lição
  mais antiga para a editar, qualquer prompt de exercício ainda
  byte-idêntico a um predefinido em inglês legado é migrado
  oportunisticamente para o modelo no idioma da interface (apenas no
  estado de edição, persistido só se guardares) (#1861).

### Exprimível sem um tipo novo (convenções, não tipos)

| Conceito | Como |
|---------|-----|
| Verdadeiro/Falso, Sim/Não | `multiple_choice` de duas opções (ou um `cloze` `select` de duas opções) |
| Dropdown / radio / checkbox | Apresentação de `multiple_choice` / cloze select — não tipos separados |

### Planeado se necessário (candidatos — NÃO um compromisso)

| Candidato | Próximo de | Quando |
|-----------|------|------|
| Ordenação / classificação | `word_tiles` | Apenas por procura concreta de conteúdo, depois via a receita. |
| Campo numérico (comparação numérica) | `free_text` | Apenas por procura concreta de conteúdo, depois via a receita. |

### Deliberadamente excluído

| Excluído | Porquê (uma linha) |
|----------|----------------|
| Redação / texto longo / desenho / fórmula / revisão por pares / autoavaliação livre | Não avaliável de forma binária pelo SRS; autoavaliação adiada (#1268). |
| Áudio / vídeo / upload de ficheiro | Armazenamento + infraestrutura; conflitua com offline-first. |
| Hotspot / simulação / memória / palavras cruzadas | Esforço de construção sem valor de SRS (uma decisão posterior e separada, se alguma vez). |
| Matriz / Likert / slider | Tipos de inquérito, não tipos de aprendizagem. |
| Seletores de data / hora | Tipos de formulário, não tipos de aprendizagem. |

## Referência dos tipos de exercício

A referência de campos por tipo — `matching`, `picture_choice`,
`free_text`, `word_tiles`, `multiple_choice` e `cloze` com os seus
modos `type` / `select` / `multiselect`: campos obrigatórios,
exemplos JSON e as regras semânticas (marcadores `___` de cloze ==
`blanks`, integridade referencial de `card_ids`, disjunção
accept/distractor no multiselect, exatamente-uma-correta no
picture-choice) — fica na referência da engine:
[learn-content-engine — `docs/lesson-format.md`](https://github.com/astrapi69/learn-content-engine/blob/main/docs/lesson-format.md).
Cada exemplo JSON aí é extraído e validado pela suite de testes da
engine, por isso a referência não pode apodrecer. As convenções de
autoria específicas da app abaixo permanecem aqui.

### Criação de escolha múltipla

**Preferido (esquema v1.6+, #1525): o tipo nativo `multiple_choice`.**
As opções trazem o seu próprio flag `correct`, por isso não há listas
accept/distractors separadas a manter disjuntas. `multiple: false`
(padrão) é escolha única (exatamente uma correta); `multiple: true` é
"seleciona tudo o que se aplica" (avaliação por conjunto exato, sem
pontos parciais):

```json
{
  "id": "ex-capital",
  "type": "multiple_choice",
  "prompt": "What is the capital of France?",
  "card_ids": ["card-paris"],
  "options": [
    {"text": "Paris", "correct": true},
    {"text": "Berlin"},
    {"text": "Madrid"},
    {"text": "Rome"}
  ]
}
```

**Mecanismo legacy (continua plenamente válido — coexistência, nada
deprecated):** antes da v1.6, a escolha múltipla de texto era criada
como `cloze` em modo `select` (EXP-036 §4.3, #890). Uma pergunta de
resposta única é um cloze com uma lacuna: a `sentence` (que termina
em `___`) é a pergunta, o `accept[0]` da lacuna é a opção correta e
os `distractors` são as opções erradas. Exemplo:
`"sentence": "The capital of France is ___."`,
`"blanks": [{"accept": ["Paris"]}]`, `"cloze_mode": "select"`,
`"distractors": ["Berlin", "Madrid", "Rome"]`.

Também podes pôr a pergunta inteira em `prompt` e usar um
`"sentence": "___"` simples — o renderizador mostra um `<select>` com
a resposta correta + os distratores, avalia a escolha, dá feedback e
alimenta o SRS:

```json
{
  "id": "ex-hook-state",
  "type": "cloze",
  "prompt": "Which hook manages local state in a function component?",
  "card_ids": ["card-usestate"],
  "sentence": "___",
  "blanks": [{"accept": ["useState"]}],
  "cloze_mode": "select",
  "distractors": ["useEffect", "useContext", "useRef"]
}
```

> **Nunca cries escolha múltipla de texto como `picture_choice`.**
> Esse tipo é apenas para assets de imagem reais; com opções de texto
> renderiza mosaicos de placeholder, não um controlo utilizável (cf.
> astrapi69/adaptive-learner-content-test#10). A escolha múltipla de
> texto é `multiple_choice` (preferido) ou `cloze` em modo `select`,
> como acima.

**"Seleciona tudo o que se aplica"** (duas ou mais respostas
corretas, p. ex. uma pergunta de exame de condução) usa
`cloze_mode: "multiselect"`:

```json
{
  "type": "cloze",
  "cloze_mode": "multiselect",
  "sentence": "Which cities are in Germany?",
  "accept": ["Berlin", "Hamburg"],
  "distractors": ["Vienna", "Zurich"]
}
```

**Várias lacunas por cloze** são suportadas: cada `___` na frase é
mapeado por ordem para a entrada seguinte em `blanks`. Cada lacuna
pode ter o próprio hint + placeholder + lista accept. O SRS de
elementos desdobra um ElementAttempt por lacuna — quem preenche a
lacuna A com fluência, mas falha constantemente a lacuna B, obtém um
rastreio de domínio granular por lacuna.

**Papéis de tokens nos Cards (Fase 52I / v1.35.0)** — metadados
opcionais de Card com os quais o gerador de cloze pode escolher em
tempo de execução (sessões de revisão + a ronda de correção no fim
da lição) uma lacuna semanticamente significativa:

```json
{
  "id": "art-un",
  "front": "un chat",
  "back": "eine Katze",
  "tags": ["article"],
  "token_roles": [
    {"token": "un", "role": "article"}
  ]
}
```

Enum fechada de papéis: `article` / `verb` / `noun` /
`adjective` / `preposition` / `gender_marker` / `tense_marker`.
Adicionar um papel é um bump de versão menor do esquema —
não estender inline.

## Escritas não latinas: convenção de transliteração

Regras vinculativas para conjuntos cujo idioma de destino usa uma
escrita não latina (japonês, chinês, coreano, grego, hindi, ...).
Estabelecidas e aplicadas no repo de conteúdo — precedentes:
[content#90](https://github.com/astrapi69/adaptive-learner-content/issues/90),
[content#91](https://github.com/astrapi69/adaptive-learner-content/issues/91);
varreduras de lacunas restantes:
[content#106](https://github.com/astrapi69/adaptive-learner-content/issues/106),
[content#107](https://github.com/astrapi69/adaptive-learner-content/issues/107).

**1. Regra de direção.** A transliteração é apenas para o idioma de
**destino** não latino quando o idioma de origem escreve em escrita
latina (de→ja, de→zh, de→ko, ...). Um idioma de **origem** não latino
com um destino em escrita latina (hi→en, el→fr) não recebe
transliteração — o aprendiz já lê a sua própria escrita.

**2. Formato.** Parênteses curvos diretamente a seguir ao original:
こんにちは (konnichiwa). Nos passos de teoria sempre; nas opções e
prompts só onde for inofensivo (ver a regra da não revelação).

**3. Regra da não revelação (o essencial).** A transliteração nunca
pode entregar a solução. As tarefas de leitura de escrita, o
reconhecimento de tons, as peças de `word_tiles` e os contextos de
frase de cloze ficam SEM transliteração no elemento questionado; as
tarefas de significado recebem-na. Na dúvida, deixa-a de fora.

- Exemplo positivo (correspondência de significado, content#91): o
  par de matching `{"left": "妈 (mā)", "right": "Mama / Mutter"}` — o
  conhecimento questionado é o significado, por isso o auxílio de
  leitura não revela nada.
- Exemplo negativo (leitura de escrita, content#91): os exercícios de
  leitura de escrita `ko-a1/01-hangul-lesen` ficam sem
  transliteração, porque a romanização É a resposta (caráter → som);
  `가 (ga)` no prompt entregaria a solução ao aprendiz.

**4. Romanização padrão por idioma, consistente dentro de um
conjunto:** japonês Hepburn, chinês Pinyin COM marcas de tom, coreano
Revised Romanization, grego/hindi uma transliteração simplificada
comum. Nunca misturar sistemas dentro de um conjunto.

**5. Tarefas de digitação** (`free_text` / cloze em modo `type`):
`accept[0]` é a forma romanizada canónica; além disso, aceita
variantes comuns — japonês: grafias Kunrei (si/ti/tu/hu/zi, p. ex.
`konnitiwa` ao lado de `konnichiwa`); chinês: Pinyin sem tons
(`nihao` ao lado de `nǐ hǎo`); coreano: alternativas difundidas
(p. ex. `annyeong haseyo`). Regra mnemónica: **um exercício nunca
pode falhar por causa do teclado do aprendiz.** Precedente (bloqueio
de IME, content#107): um cloze que só aceitava 가 era insolúvel sem um
IME coreano — a forma romanizada `ga` teve também de ser aceite.

Que tipo carrega que objetivo de aprendizagem: ver o
[catálogo de tipos de exercício](#catalogo-de-tipos-de-exercicio-estado).

## Direção do exercício (v1.46.0 / EXP-018)

Cada exercício aceita um campo opcional `direction`, que indica em
que direção os aprendizes praticam o cartão:

- `target_to_source` (padrão) — RECETIVO: o idioma de destino é
  mostrado, o idioma de origem é reconhecido (mais fácil).
- `source_to_target` — PRODUTIVO: o idioma de origem é mostrado, o
  idioma de destino é produzido (mais difícil).
- `both` / `random` — deixa ao renderizador / gerador adaptativo a
  escolha de uma direção concreta por tentativa.

```json
{
  "type": "matching",
  "direction": "source_to_target",
  "card_ids": ["bonjour"],
  "pairs": [{ "left": "Bonjour", "right": "Guten Tag" }]
}
```

O campo é aditivo — o esquema permanece na versão 1.2, e as lições
sem `direction` comportam-se exatamente como antes (recetivo). O SRS
rastreia o domínio por direção: um cartão dominado recetivamente
ainda não está dominado produtivamente. Os exercícios cloze são
ligados ao contexto e ignoram `direction`. Para uma progressão de
dificuldade, mantém-se as primeiras lições recetivas e introduz-se
`source_to_target` em lições posteriores (é exatamente o que faz o
conteúdo piloto empacotado).

### Anotações para o gerador de lições adaptativas (v1.36.0+)

O gerador de lições adaptativas da Fase 53
(`/adaptive-lesson/:setId`, F-114) recombina os exercícios
existentes para abordar de forma dirigida as fraquezas específicas
dos aprendizes. O gerador funciona sem anotações adicionais, mas dois
campos tornam-no bastante mais inteligente:

1. **Cobertura mais ampla de `token_roles` nos cartões.** O gerador
   usa `token_roles` para:
   - Escolher lacunas semanticamente sensatas quando gera variantes
     cloze a partir de erros (já na v1.35.0)
   - Classificar erros como `article_gender` / `verb_conjugation`
     para os chips de "foco de exercício" no Dashboard (53E)
   - Encontrar exercícios ALTERNATIVOS que testam o mesmo elemento
     quando o exercício original esteve errado (lógica de variações
     53D — encontra candidatos cujo cartão tenha uma entrada
     `token_roles` adequada)

   Adiciona a CADA cartão que ensina uma unidade gramatical própria
   (artigo, formas verbais conjugadas, substantivos com género) uma
   entrada `token_roles`. Custo: uma entrada JSON adicional por
   cartão; benefício: uma geração adaptativa bastante mais rica.

2. **Tags de cartão como `tags: ["article", "masculine"]`** são
   lidas pelo classificador de erros como fallback quando faltam
   `token_roles`. Não substituem `token_roles` — são uma anotação a
   meio caminho de baixo custo.

O que ainda NÃO precisamos (adiado para um futuro bump de esquema):

- Referências cruzadas `related_cards` entre cartões de lições
  diferentes
- Classificações de dificuldade por exercício (o gerador estima
  atualmente a dificuldade a partir de `exercise.type`)
- Frases de exemplo por cartão em `notes`, parseáveis como
  contextos cloze alternativos (o gerador de cloze usa exclusivamente
  `front`)

Regra prática: adiciona `token_roles` a cada cartão que ensina um
token gramatical. É de longe o hábito de autoria mais impactante
para o sistema adaptativo.

## Assets (imagens que um conjunto traz) — v1.37.0+

Os exercícios de picture-choice e as imagens de capa de cartão vêm
de duas fontes:
1. **Ficheiros de asset de autor**, declarados no manifesto do
   conjunto e fornecidos ao lado do JSON da lição
2. **SVGs de placeholder**, gerados em tempo de execução quando não
   existe asset (cartões de cor para palavras de cores, dígitos
   grandes para números, estilo avatar para tudo o resto)

Se publicas um conjunto sem assets, o picture-choice funciona na
mesma — o gerador de SVG de placeholder cobre cores + números
automaticamente e recai para tudo o resto num avatar determinístico.

### Layout de diretórios

Dentro do diretório do conjunto, os assets ficam sob `assets/`:

```
sets/
  language-fr-a1/
    manifest.yaml
    lessons/
      01-greetings.json
      02-numbers.json
      ...
    assets/
      img/
        chat.png
        chien.png
        oiseau.png
```

### Declaração no manifesto

Cada asset tem de ser declarado no manifesto do conjunto, para que o
downloader saiba o que ir buscar:

```yaml
sets:
  - id: language-fr-a1
    title: French A1
    language: fr
    level: A1
    version: '1.0.0'
    lesson_count: 10
    assets:
      - path: img/chat.png
        size_kb: 45
      - path: img/chien.png
        size_kb: 38
```

O `path` é relativo ao diretório `assets/` do conjunto (NÃO ao JSON
da lição). No JSON da lição, os exercícios de picture-choice
referenciam os assets COM o prefixo `assets/`:

```json
{
  "type": "picture_choice",
  "prompt": "Welches ist 'chat'?",
  "images": [
    {"src": "assets/img/chat.png", "label": "Katze", "is_correct": "true"},
    {"src": "assets/img/chien.png", "label": "Hund"}
  ]
}
```

O frontend remove o prefixo `assets/` automaticamente ao invocar o
resolver de assets, de forma que o JSON da lição permanece na forma
intuitiva para autores.

### Limites de tamanho + formato

- **Limite por asset**: 500 KiB. O validador de manifesto rejeita
  assets cujo `size_kb` declarado exceda este limite. O downloader
  rejeita também assets cujo tamanho real em bytes exceda a
  declaração em mais de 10% — mantém o manifesto honesto.
- **Soft-limit por conjunto**: 10 MiB de tamanho total. O validador
  avisa, mas não rejeita.
- **Formatos aceites**: `.png` / `.jpg` / `.jpeg` /
  `.webp` / `.svg`. Sem GIF (conteúdo animado distrai), sem BMP (sem
  compressão). Para fotos, prefere WebP — bastante mais pequeno do
  que PNG com qualidade comparável. Para ícones + diagramas, prefere
  SVG — escala de forma limpa + tamanho de ficheiro minúsculo.

### Recomendações de tamanho

As peças de picture-choice são renderizadas até no máximo 150x150 px
no desktop e 100x100 px no mobile (`object-fit: contain`). Imagens
de origem com 300x300 px dão o melhor resultado em ecrãs Retina sem
necessidade de dados desnecessários. PNGs acima de 150 KiB raramente
ficam melhores do que um WebP bem comprimido de metade do tamanho.

### Quando o placeholder de runtime chega

Três tipos de lição em que o placeholder de runtime é tão bom que
imagens de autor não trazem ganho de aprendizagem:

- **Lições de cores** (`rouge` / `rojo` / `rot` / `red`): o gerador
  de placeholder cria uma peça hex colorida correspondente ao nome
  da cor. Peças de autor são redundantes.
- **Lições de números** (`7` / `42` / `1492`): o placeholder
  renderiza os dígitos grandes + centrados. Imagens de autor só
  fariam sentido em sistemas de numeração não arábicos.
- **Conceitos abstratos** sem representação visual óbvia
  (`patience`, `liberté`): o placeholder de avatar fornece uma
  âncora visual clara sem forçar uma escolha de ícone discutível.

Para tudo o resto (animais, objetos, comida, lugares, partes do
corpo), as imagens de autor ajudam de forma mensurável no
reconhecimento + memorização.

## Lista de verificação de qualidade

Antes do PR de uma nova lição, verificar:

- [ ] **3-5 passos de teoria** + **8-12 exercícios** por lição
- [ ] **Pelo menos 3 tipos de exercício** representados (matching, picture-choice, free-text, word-tiles ou cloze — cloze a partir da v1.35.0)
- [ ] **Passos de teoria ≤ 200 palavras** por passo
- [ ] **Exercícios de free-text**: ≥ 3 variantes accept + ≥ 3 distratores
- [ ] **Word-tiles**: ≥ 3 peças por exercício
- [ ] **estimated_minutes**: 10-15 (realista, não idealizado)
- [ ] **Distratores são errados-mas-plausíveis** — semanticamente relacionados, nunca aleatórios
- [ ] **Notas de Card** fornecem valor real (pronúncia, falsos amigos, flag de exceção)
- [ ] **Estrutura progressiva**: conceitos posteriores assentam nos anteriores do mesmo conjunto
- [ ] **Exatidão cultural**: uso real do idioma, não apenas fórmulas de manual
- [ ] **Validação de esquema**: a lição carrega de forma limpa via `dict_to_lesson()` (ver Testes locais)
- [ ] **Integridade de Card-ID**: cada `exercise.card_ids[i]` existe em `cards[]` da lição
- [ ] **Par de idiomas**: `target_language` + `source_language` definidos (ISO 639-1, diferentes), `title_native` presente

## Validação (dois níveis, v1.44.0)

Os conteúdos são protegidos por dois níveis de validação com as
MESMAS verificações:

1. **Na aplicação, antes de partilhar.** Ao partilhar via *As Minhas
   Lições → Disponibilizar para a comunidade*, corre primeiro uma
   verificação baseada em regras (sempre, sem IA). Ela impõe os
   **valores mínimos** abaixo; um conjunto abaixo deles não pode ser
   partilhado. Se passar e estiver configurada uma chave de IA, o
   aprendiz pode iniciar OPCIONALMENTE uma verificação de IA
   complementar (exatidão da tradução, plausibilidade dos
   distratores, gramática, nível, sensibilidade cultural,
   naturalidade). O passo de IA nunca é automático, exige
   consentimento explícito (o conteúdo da lição é enviado ao
   fornecedor configurado) e nunca bloqueia a partilha — a
   verificação baseada em regras é o portão.
2. **Na CI do repo de conteúdo.** Um Pull Request a
   `astrapi69/adaptive-learner-content` executa o seu próprio
   `scripts/validate_content.py` (estrutura contra o espelho de
   esquema fixado à engine e vendorizado + valores mínimos de
   qualidade) mais um portão de conformidade com a engine
   (`learn-content-engine` `validate()` sobre cada lição), de forma
   que um PR manual não pode contornar o portão.

**Valores mínimos de qualidade (portão rígido):** ≥ 5 exercícios por
lição, ≥ 2 tipos de exercício, ≥ 1 passo de teoria, free-text ≥ 2
respostas aceites + distratores, matching ≥ 3 pares, picture-choice
com distratores, sem frente/verso de cartão vazios e (em escritas de
origem não latinas) versos de cartão na escrita de origem. Estes são
valores mínimos, não metas — a lista de verificação acima exige mais.

### Verificação de conteúdo por IA de todo o conjunto (opcional)

Além da verificação no momento da partilha, um conjunto descarregado
pode ser revisto por completo via *Verificar com IA*. Isto é
totalmente opcional e usa o **fornecedor + modelo** que o aprendiz
configurou (Anthropic / OpenAI / Gemini); os cartões são enviados em
lotes a esse fornecedor para revisão. O fluxo mostra uma estimativa
de custo, corre com uma barra de progresso + cancelar, e produz um
**relatório por cartão** que é guardado em cache no navegador e pode
ser exportado como **Markdown** (com uma linha a registar que
fornecedor + modelo correu a verificação). Quando o relatório passa,
o conjunto ganha um **badge "AI-Checked"** apoiado por um hash de
conteúdo + uma assinatura, de forma que uma edição posterior aos
cartões invalida o badge até o conjunto ser reverificado. A
verificação de IA nunca é um portão — é proveniência consultiva, não
um requisito de publicação.

## Testes locais

O validador de esquema do content-loader corre no âmbito de
`make test`. Validar uma única lição à mão:

```bash
cd plugins/adaptive-learner-plugin-content-loader
poetry run python -c "
import json, sys
from adaptive_learner_content_loader.schema import dict_to_lesson
path = '../adaptive-learner-content/sets/en/fr-a1/lessons/01-greetings.json'
with open(path) as f:
    lesson = dict_to_lesson(json.load(f))
print(f'OK: {lesson.id} — {len(lesson.cards)} Cards, {len(lesson.steps)} Steps')
"
```

Validar todas as lições de um repo de conteúdo de uma vez — com o
validador do repo de conteúdo (o mesmo script que a sua CI executa em
cada PR):

```bash
cd ../adaptive-learner-content
python3 scripts/validate_content.py
```

Ele encontra cada conjunto sob `sets/{source}/{target-level}/` e
verifica o esquema mais os valores mínimos de qualidade (≥5
exercícios, ≥2 tipos de exercício, ≥1 passo de teoria, accepts de
free-text + distratores, pares de matching, sem cartões vazios,
integridade de Card-ID). Novas lições são reconhecidas
automaticamente — sem necessidade de alterar testes.

## Fluxo de PR

Assim que o teu conjunto estiver pronto:

1. Abre um PR contra o repo principal (para conjuntos a fornecer com
   a aplicação), OU
2. Cria um repo de conteúdo próprio sob a tua conta GitHub e
   configura o content-loader via
   `backend/config/plugins/content-loader.yaml` (sob
   `default_sources`).

O content-loader suporta qualquer repo GitHub público como fonte. Os
repos privados precisam de um Personal Access Token, definido através
da gestão de chaves em três camadas
(`~/.config/adaptive_learner/secrets.yaml`).

## Armadilhas comuns

**Referências de Card-ID**: Cada entrada `card_ids` num exercício tem
de existir em `cards[]` da lição. Se copias um exercício entre lições
e te esqueces de levar o Card associado, a validação falha.

**IDs slug-seguros**: Todos os IDs (Lesson, Card, Step, Exercise) têm
de corresponder a `^[a-z0-9]+(-[a-z0-9]+)*$`. Sem underscores, sem
apóstrofos, sem maiúsculas, sem hífenes iniciais/finais.

**`is_correct: "true"`**: É uma string, não um booleano JSON. O
esquema exige explicitamente `"true"`, porque os campos do
picture_choice são modelados internamente como dict[str, str].

**Campos adicionais**: Cada modelo tem `extra="forbid"`. Um campo
não documentado leva à rejeição de toda a lição. Mantém-te nos campos
documentados.

**Theory-Body**: Os passos de teoria precisam de um campo `body`
não vazio (Markdown). Os passos de exercício não podem trazer
`body` — usa em vez disso o `prompt` do exercício.

## Referência: os conjuntos fornecidos

O Adaptive Learner traz uma biblioteca considerável em vários
domínios (idiomas, programação, psicologia, IA, tecnologia — ver o
bloco CONTENT-STATS do README para as contagens atuais + a tabela
completa por conjunto). Algumas boas referências canónicas no repo
`adaptive-learner-content`:

- `sets/en/fr-a1/` — Francês A1 para falantes de inglês;
  `sets/de/fr-a1/` é a contraparte de origem alemã.
- `sets/en/es-a1/` + `sets/de/es-a1/` — Espanhol A1 (um por idioma de
  origem).
- O conjunto "Python — Grundlagen" sob `sets/de/` é um exemplo de
  `domain: programming` (origem alemã == destino), útil como
  referência não linguística.

Todos seguem as convenções descritas neste guia. Ler uma lição
completa é o caminho mais rápido para interiorizar a estrutura.

---

## Caminho para a participação na comunidade (v1.42.0)

> **Passo a passo com capturas de ecrã:**
> [Criar uma lição na aplicação, passo a passo](https://medium.com/@asterios-raptis/create-a-lesson-in-the-app-step-by-step-dadd6927829f)
> (Medium) percorre o Criador de Lições da aplicação de ponta a
> ponta, do primeiro cartão à partilha da lição terminada.

Não tens de criar lições do zero à mão. O caminho mais rápido para
contribuir é **criar e partilhar uma lição na aplicação**:

1. Importa um chat e analisa-o, depois **Guardar como lição
   offline** (ou termina uma lição adaptativa e **Guardar esta
   lição?**). A lição aparece sob **As Minhas Lições** no navegador
   de conjuntos.
2. Em "As Minhas Lições", clica em **Exportar como conjunto de
   conteúdo** para descarregar um conjunto de conteúdo como `.zip`
   (manifesto + lições). As exportações contêm apenas o conteúdo da
   lição — sem progresso, sem histórico de erros, nada pessoal.
3. Clica em **Disponibilizar para a comunidade** para abrir um
   **Pull Request** pré-preenchido no repositório de conteúdo — o
   JSON da lição é committado no caminho correto da árvore, sem
   necessidade de anexo `.zip`.
4. A CI do repo valida o PR automaticamente; um maintainer verifica
   a lição, alinha o manifesto (id, title, language, level, tags) com
   as convenções acima e fá-lo o merge sob `sets/`. Após o merge,
   todos a podem descarregar do navegador de conjuntos.

Este é o caminho social: a verificação é **manual** (um maintainer
cura cada adição — nada é publicado automaticamente), e todo o fluxo
só precisa do GitHub. As lições geradas já são validadas contra o
esquema, de forma que uma lição contribuída costuma precisar apenas
de um pouco de afinação do manifesto.

## Assistente de partilha, variações e crédito de autor (Fase 64)

Partilhar uma lição a partir de **As Minhas Lições** abre um
assistente de quatro passos, em vez de saltar diretamente para o
GitHub:

1. **Pré-visualização + colocação.** A aplicação calcula exatamente
   onde a lição aterra na árvore (`sets/{origem}/{destino}-{nível}/`)
   e um nome de ficheiro numerado automaticamente
   (`{nn}-{slug}.json`, o número seguinte após as lições
   existentes). Um par + nível totalmente novo mostra *"Novo
   conjunto! És o primeiro."*
2. **Verificação de duplicados.** A lição é comparada com as lições
   já existentes nesse caminho (sobreposição de cartões e exercícios
   — consultiva, nunca bloqueante). Se algo semelhante existir,
   podes:
   - **Partilhar como variação** — a lição é marcada com
     `variation_of: "{original_id}"` mais uma `variation_note`
     opcional ("Em que difere a tua versão?").
   - **Sugerir apenas os exercícios novos** (em quase-duplicados) —
     o assistente extrai exatamente os exercícios que faltam ao
     original, juntamente com os cartões associados, como variação de
     complemento.
3. **Resumo de qualidade.** Os resultados do validador baseado em
   regras (mais a verificação de IA opcional); os avisos são
   mostrados, mas nunca bloqueiam.
4. **Partilhar + celebrar.** Um clique abre o Pull Request do GitHub
   (editor de ficheiro para lições pequenas, página de upload para
   grandes), e a aplicação agradece com uma pequena celebração.

### Campos de variação e de crédito (Esquema 1.3, todos opcionais)

```json
{
  "variation_of": "10-passe-compose",
  "variation_note": "Mehr Übungen zur Angleichung",
  "contributed_by": "Maria S.",
  "contributed_at": "2026-06-01T14:30:00Z"
}
```

Os quatro são aditivos e opcionais; as lições sem eles comportam-se
exatamente como antes. `contributed_by` é definido quando o autor
ativa o crédito ao partilhar (um campo *"O teu nome (opcional)"* que
é lembrado localmente para a próxima vez). Se presente, o
visualizador mostra uma linha discreta *"Disponibilizado por
{name}"* sob o título, e o texto do Pull Request lista o autor na sua
tabela de metadados.

### Histórico de contribuições e lacunas

As lições partilhadas são lembradas localmente (sem conta
necessária) sob **As Minhas Contribuições** com um contador e uma
distinção *Contribuidor da Comunidade* a partir de cinco lições
partilhadas. O navegador de conjuntos mostra ainda **Lições em
falta** — sugestões encorajadoras para o próximo nível CEFR de um
par existente ou um idioma de destino que existe para um idioma de
origem mas falta para outro ("Podes ajudar?").

---

## Páginas relacionadas

- [Criar lições — Visão geral](../content-creation/overview.md) — introdução + Criador de Lições na aplicação
- [Recomendações de livros](../content-creation/books.md) — manter `books.yaml` por domínio
- [Múltiplos repositórios de conteúdo](../features/content-repos.md) — ligar repo próprio
- [Criar uma lição na aplicação, passo a passo](https://medium.com/@asterios-raptis/create-a-lesson-in-the-app-step-by-step-dadd6927829f) — tutorial externo no Medium com capturas de ecrã
